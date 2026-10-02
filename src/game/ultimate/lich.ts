import Phaser from 'phaser';
import { sound } from '../../audio';
import type { Hurtbox } from '../combat';
import { onGround } from '../Toxins';
import { DROWNED_RIME, FrostLock, LICH_RIME } from '../Rime';
import type { WorldScene } from '../../scenes/WorldScene';
import type { Cast, IconPainter } from './types';
import { bloom, circle, clamp01, dither, easeOut, flare, Fx, GROUND, hash, pool, type Ink } from './ink';

// The Lich's Special, Eternal Winter: a blizzard rings round him for five
// seconds and goes where he goes. Snow and motes of ice whirl round him, a
// wall of it thickest at the rim, frost spreading over the ground beneath
// with a rune turning in it; every foe inside is slowed hard and takes a
// steady bite of cold. At the end everything inside is locked in ice and,
// a breath later, shatters. The Drowned King's is a swirl of sea spray.

/** How long the storm blows, its radius on the ground, and the first moments it takes to spread. */
const WINTER_MS = 5000;
const WINTER_R = 54;
const SPREAD_MS = 500;
/** It bites every so often, slowing what it bites to this pace. */
const TICK = 400;
const TICK_DAMAGE = 4;
const WINTER_PACE = 0.35;
/** At the end: locked in ice this long, then shattered for this much. */
const LOCK_MS = 600;
const SHATTER_DAMAGE = 24;
/** Flakes in the storm. */
const FLAKES = 90;

export class EternalWinter extends Fx {
  private air: Ink;
  private ground: Ink;
  private flakes: { r: number; a: number; z: number; spin: number; size: number }[] = [];
  private lamp: Phaser.GameObjects.Light;
  private tickT = TICK;
  private gustT = 0;
  private ended = false;
  private sea: boolean;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, WINTER_MS + LOCK_MS + 300);
    this.sea = c.look === 'drowned';
    this.ground = this.ink(WINTER_R * 2 + 16, Math.ceil(WINTER_R * 2 * GROUND) + 16);
    this.air = this.ink(WINTER_R * 2 + 24, Math.ceil(WINTER_R * 2 * GROUND) + 70);
    for (let i = 0; i < FLAKES; i++) {
      // More of them out at the rim: the wall of the storm.
      const rim = hash(i, 1) < 0.55;
      const r = rim ? 0.78 + hash(i, 2) * 0.24 : 0.2 + hash(i, 2) * 0.6;
      this.flakes.push({ r, a: hash(i, 3) * Math.PI * 2, z: 2 + hash(i, 4) * 30, spin: (rim ? 2.6 : 1.6) + hash(i, 5) * 1.2, size: hash(i, 6) < 0.2 ? 2 : 1 });
    }
    this.lamp = this.light(c.x, c.y - 12, 120, c.pal.light, 0);
    sound.frost('howl', world.pan(c.x), true);
    sound.frost('freeze', world.pan(c.x), true);
    world.cameras.main.shake(140, 0.0006);
    bloom(world, c.x, c.y - 10, c.pal.hot, 3, 500, c.y + 30);
    flare(world, c.x, c.y - 10, 140, c.pal.light, 2.2, 600);
  }

  protected step(dt: number): void {
    const { c, t, world } = this;
    const p = c.pal;
    const hx = c.hero.x;
    const hy = c.hero.y;
    const blowing = t < WINTER_MS;
    const open = easeOut(t / SPREAD_MS);
    const fade = 1 - clamp01((t - WINTER_MS) / (LOCK_MS + 300));
    const R = WINTER_R * (0.35 + 0.65 * open);
    this.lamp.setPosition(hx, hy - 14);
    this.lamp.intensity = 1.8 * open * fade;

    // The ground: frost spreading out, a rune turning in it, crystals round the rim.
    const g = this.ground.begin(hx, hy, 2.5);
    pool(g, hx, hy, R, p.hot, p.mid, 0.75 * fade, GROUND, 0.55);
    circle(g, hx, hy, R, p.hot, 0.9 * fade);
    circle(g, hx, hy, R * 0.62, p.mid, 0.7 * fade);
    for (let i = 0; i < 12; i++) {
      const th = t * 0.0009 + (i / 12) * Math.PI * 2;
      const x = hx + Math.cos(th) * R * 0.81;
      const y = hy + Math.sin(th) * R * 0.81 * GROUND;
      g.put(x, y, i % 3 === 0 ? p.core : p.deep, fade);
      if (i % 3 === 0) {
        g.put(x + 1, y, p.hot, fade);
        g.put(x - 1, y, p.hot, fade);
        g.put(x, y - 1, p.hot, fade);
      }
    }
    // Shards of ice (spray) jutting from the frost at the rim.
    for (let i = 0; i < 16; i++) {
      const th = (i / 16) * Math.PI * 2 + hash(i, 8) * 0.3;
      const x = hx + Math.cos(th) * R * 0.96;
      const y = hy + Math.sin(th) * R * 0.96 * GROUND;
      const h = Math.round((2 + hash(i, 9) * 3) * open * fade);
      for (let k = 0; k < h; k++) g.put(x, y - k, k === h - 1 ? p.core : p.mid, fade);
    }
    g.end();

    // The air: snow whirling round him, streaking as it goes, thickest at the rim.
    const a = this.air.begin(hx, hy - 20, hy + 40);
    for (const f of this.flakes) {
      f.a += (f.spin * dt) / 1000;
      const r = f.r * R;
      const z = f.z + Math.sin(t * 0.004 + f.a * 2) * 3;
      const x = hx + Math.cos(f.a) * r;
      const y = hy + Math.sin(f.a) * r * GROUND - z;
      // In front of him or behind: the near half is brighter.
      const near = Math.sin(f.a) > 0;
      const alpha = fade * (near ? 1 : 0.7);
      if (dither(Math.round(x), Math.round(y)) > alpha + 0.15) continue;
      a.put(x, y, near ? p.core : p.hot, alpha);
      if (f.size > 1) a.put(x + 1, y, p.hot, alpha);
      // The streak behind it along its way round.
      for (let k = 1; k <= 3; k++) {
        const b = f.a - k * 0.06 * f.spin;
        a.put(hx + Math.cos(b) * r, hy + Math.sin(b) * r * GROUND - z, k === 1 ? p.hot : k === 2 ? p.mid : p.deep, alpha * (1 - k * 0.22));
      }
    }
    // Motes of ice rising from the frost.
    for (let i = 0; i < 14; i++) {
      const life = (t * 0.0012 + hash(i, 11)) % 1;
      const th = hash(i, 12) * Math.PI * 2;
      const rr = hash(i, 13) * R * 0.9;
      a.put(hx + Math.cos(th) * rr, hy + Math.sin(th) * rr * GROUND - life * 34, life < 0.5 ? p.hot : p.mid, fade * (1 - life));
    }
    a.end();

    if (blowing) {
      // The bite of the cold on everything inside.
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT += TICK;
        for (const h of this.inside(hx, hy, R)) {
          h.hurt({ damage: TICK_DAMAGE, heavy: false, knock: 0, fromX: hx, fromY: hy });
          h.slow?.(WINTER_PACE, TICK + 200, p.hot);
          world.debris([p.core, p.hot], Math.round(h.x), Math.round(h.y - h.bodyY), 2, h.y + 20, 'spores');
        }
      }
      this.gustT -= dt;
      if (this.gustT <= 0) {
        this.gustT = 1100;
        if (this.sea) sound.splash(world.pan(hx));
        else sound.frost('gust', world.pan(hx));
      }
    } else if (!this.ended) this.lockAll(hx, hy);
  }

  private inside(x: number, y: number, r: number): Hurtbox[] {
    return this.world.hurtboxesWhere((h) => h.alive && onGround(h, x, y, r));
  }

  /** The storm ends: everything inside is locked in ice, then shatters. */
  private lockAll(hx: number, hy: number): void {
    this.ended = true;
    const { world, c } = this;
    const p = c.pal;
    const look = this.sea ? DROWNED_RIME : LICH_RIME;
    for (const h of this.inside(hx, hy, WINTER_R)) {
      h.slow?.(0, LOCK_MS + 100, p.hot);
      world.addEffect(
        new FrostLock(world, h, LOCK_MS, look, (f) => {
          if (f.alive) f.hurt({ damage: SHATTER_DAMAGE, heavy: true, knock: 120, fromX: hx, fromY: hy });
        }),
      );
    }
    world.time.delayedCall(LOCK_MS, () => {
      if (!world.scene.isActive()) return;
      world.cameras.main.shake(180, 0.0012);
      sound.shatter(world.pan(hx), true);
      bloom(world, hx, hy - 8, p.hot, 4, 450, hy + 30);
      flare(world, hx, hy - 8, 160, p.light, 2.6, 500);
      for (let i = 0; i < 10; i++) {
        const th = (i / 10) * Math.PI * 2;
        world.debris(p.tints, Math.round(hx + Math.cos(th) * WINTER_R * 0.7), Math.round(hy + Math.sin(th) * WINTER_R * 0.7 * GROUND - 6), 5, hy + 30);
      }
    });
  }
}

/** Eternal Winter's icon: a crowned skull's crown of ice in a whirl of snow. */
export const eternalWinterIcon: IconPainter = (put, p) => {
  // The whirl: snow spiralling in.
  for (let k = 0; k < 30; k++) {
    const a = k * 0.42;
    const r = 7.2 - k * 0.17;
    put(Math.round(8 + Math.cos(a) * r - 0.5), Math.round(8.5 + Math.sin(a) * r * 0.85 - 0.5), k % 4 === 0 ? p.core : k % 2 ? p.mid : p.deep);
  }
  // A snowflake at its heart: six arms and their barbs.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
    for (let s = 1; s <= 3; s++) put(Math.round(8 + Math.cos(a) * s - 0.5 + 0.5), Math.round(8 + Math.sin(a) * s), s === 3 ? p.hot : p.core);
  }
  put(8, 8, p.core);
};
