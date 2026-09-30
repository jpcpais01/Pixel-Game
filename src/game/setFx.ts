import Phaser from 'phaser';
import { sound } from '../audio';
import { snap } from './display';
import { SHARD_TINTS, SPIKE_H, SPIKE_OY } from '../art/deepMonsters';
import { METEOR_H } from '../art/cosmos';
import { WYRM_TINTS } from '../art/wyrm';
import { WARDEN_TINTS } from '../art/warden';
import type { Hurtbox } from './combat';
import type { Effect } from './Slash';
import type { WorldScene } from '../scenes/WorldScene';
import { bloom, bump, circle, clamp01, column, drag, easeOut, flare, Fx, GROUND, hash, line, pal, pool, ring, star, strikeGround, type Ink, type Pal } from './ultimate/ink';

// What the Myth sets' powers look like (setPowers.ts decides when). The
// Wyrmshard's are Amethrax's own: breath shards, amethyst bursting up out of
// the floor, and its burrow. The Starborn's are the Astral Warden's: falling
// stars and its black hole. The spikes, shards and stars are sprites baked at
// boot (set_* in art/textures.ts); the rest is solid pixels like the Specials.

export const AMETHYST: Pal = pal(0xffffff, 0xead8ff, 0xb37aff, 0x5a2e9a, 0xb888ff);
export const STARLIGHT: Pal = pal(0xffffff, 0xd8e8ff, 0xa882ff, 0x4a2a9a, 0xa070ff);
/** The Warden's heart: the pink in its nova and black hole. */
const NEBULA: Pal = pal(0xffffff, 0xffc8ec, 0xff9ad8, 0x9a3a8a, 0xff7ad0);
/** Churned earth round the burrow. */
const EARTH = { dark: 0x160c22, mid: 0x2e1c3e, lit: 0x4a3060 };

type Point = { x: number; y: number };

/** The middle of a body, where a shard aims. */
const bodyOf = (h: Hurtbox): Point => ({ x: h.x, y: h.y - h.bodyY });

/**
 * One amethyst shard flung from the hero: at a foe it homes in and strikes;
 * with none (`to` null) it flies out `range` px and shatters, for show.
 */
export class ShardBolt implements Effect {
  dead = false;
  private body: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private vx: number;
  private vy: number;
  private t = 0;
  private gone = 0;
  private static readonly SPEED = 280;
  /** How fast it turns toward its mark, radians a second. */
  private static readonly TURN = 9;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    angle: number,
    private to: Hurtbox | null,
    private damage: number,
    private range = 60,
  ) {
    this.vx = Math.cos(angle);
    this.vy = Math.sin(angle);
    this.body = world.add.image(x, y, 'set_shard_e', 's0').setBlendMode(Phaser.BlendModes.ADD);
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(AMETHYST.mid).setScale(0.28).setAlpha(0.55);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const to = this.to?.alive ? this.to : null;
    if (to) {
      // Bend toward the foe's body, harder the longer it flies, so it never circles.
      const b = bodyOf(to);
      const want = Math.atan2(b.y - this.y, b.x - this.x);
      const now = Math.atan2(this.vy, this.vx);
      const d = Math.atan2(Math.sin(want - now), Math.cos(want - now));
      const turn = ShardBolt.TURN * (1 + this.t / 250) * (dt / 1000);
      const a = now + Phaser.Math.Clamp(d, -turn, turn);
      this.vx = Math.cos(a);
      this.vy = Math.sin(a);
    }
    const s = (ShardBolt.SPEED * dt) / 1000;
    this.x += this.vx * s;
    this.y += this.vy * s;
    this.gone += s;
    const depth = this.y + 16;
    this.body.setPosition(snap(this.x), snap(this.y)).setRotation(Math.atan2(this.vy, this.vx)).setDepth(depth);
    this.halo.setPosition(this.x, this.y).setDepth(depth - 0.1);
    if (Math.random() < dt / 40) this.world.debris(WYRM_TINTS, this.x, this.y, 1, depth - 0.2, 'trail');
    if (to) {
      const b = bodyOf(to);
      if (Math.hypot(b.x - this.x, b.y - this.y) < to.radius + 4) {
        to.hurt({ damage: this.damage, heavy: false, knock: 70, fromX: this.x - this.vx * 12, fromY: this.y - this.vy * 12 });
        this.world.debris(SHARD_TINTS, snap(this.x), snap(this.y), 7, to.y + 2);
        this.destroy();
        return;
      }
    }
    // Lost its foe, flown its course, or met a wall: it shatters.
    if (this.gone > (this.to ? 220 : this.range) || this.t > 1200 || !this.world.walkable(this.x, this.y + 14)) {
      this.world.debris(WYRM_TINTS, snap(this.x), snap(this.y), 4, depth);
      this.destroy();
    }
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.body.destroy();
    this.halo.destroy();
  }
}

/**
 * Amethyst bursting up out of the floor under the hero's foes: a violet glow
 * gathers in the ground, then the crystal shoots up past its height, settles,
 * and sinks back. Foes standing on it are struck once (`skip` shares that
 * across a whole line or ring, so one burst of spikes hits each foe once).
 */
export class ShardSpike implements Effect {
  dead = false;
  private t = 0;
  private up = false;
  private gather: Phaser.GameObjects.Image;
  private body: Phaser.GameObjects.Image | null = null;
  private glow: Phaser.GameObjects.Image | null = null;
  private flash: Phaser.GameObjects.Image | null = null;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private delay: number,
    private damage: number,
    private skip: Set<Hurtbox>,
    private size = 1,
    private stand = 700,
    private knock = 90,
    private from: Point = { x, y },
  ) {
    this.gather = world.add.image(snap(x), snap(y), 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(AMETHYST.mid).setDepth(2.4).setScale(0).setAlpha(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const size = this.size;
    if (!this.up) {
      const k = clamp01(this.t / Math.max(1, this.delay));
      this.gather.setScale(0.25 * size * (0.4 + k), 0.14 * size * (0.4 + k)).setAlpha(0.2 + k * 0.6);
      if (this.t >= this.delay) this.erupt();
      return;
    }
    const a = this.t - this.delay;
    // Shoots up past its height and settles; later sinks back into the floor.
    const pop = a < 70 ? a / 70 : a < 150 ? 1.15 - ((a - 70) / 80) * 0.15 : 1;
    const sink = Math.max(0, (a - this.stand) / 260);
    const h = Math.max(0, pop - sink);
    this.body?.setScale(size, size * h).setAlpha(Math.min(1, 1.4 - sink));
    this.glow?.setScale(size, size * h).setAlpha(Math.min(1, 1.2 - sink));
    this.flash?.setAlpha(Math.max(0, 0.9 - a / 200)).setScale((0.8 + a / 220) * size);
    this.gather.setAlpha(Math.max(0, 0.6 - a / 300));
    if (sink >= 1) this.destroy();
  }

  private erupt(): void {
    this.up = true;
    const { world: w, x, y, size } = this;
    const v = `k${Math.floor(Math.random() * 3)}`;
    const oy = SPIKE_OY / SPIKE_H;
    const flip = Math.random() < 0.5;
    this.body = w.add.image(snap(x), snap(y) + 1, 'set_spike', v).setOrigin(0.5, oy).setPipeline('Lit').setDepth(y).setFlipX(flip).setScale(size, 0);
    this.glow = w.add.image(snap(x), snap(y) + 1, 'set_spike_e', v).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).setFlipX(flip).setScale(size, 0);
    this.flash = w.add.image(snap(x), snap(y) - 6, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xd8b8ff).setDepth(y + 0.2);
    const hit = strikeGround(w, x, y, 10 * size, { damage: this.damage, knock: this.knock, fromX: this.from.x, fromY: this.from.y }, this.skip);
    for (const h of hit) this.skip.add(h);
    w.debris(SHARD_TINTS, snap(x), snap(y) - 4, hit.length ? 8 : 4, y + 2);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.gather, this.body, this.glow, this.flash]) o?.destroy();
  }
}

/**
 * Crystal Wake: a line of amethyst bursting up one after another from the
 * hero's feet along `(ux, uy)`, the way Amethrax's breath leaves crystals
 * behind it. Stops at the first wall.
 */
export function crystalWake(world: WorldScene, x: number, y: number, ux: number, uy: number, damage: number): void {
  const skip = new Set<Hurtbox>();
  const n = 6;
  for (let i = 0; i < n; i++) {
    const d = 16 + i * 16;
    const px = x + ux * d;
    const py = y + uy * d * 0.9;
    if (!world.walkable(px, py)) break;
    // Each a little bigger than the last, a touch off the line, like a crack running.
    const off = (hash(i, Math.round(x), Math.round(y)) - 0.5) * 6;
    world.addEffect(new ShardSpike(world, px - uy * off, py + ux * off, 40 + i * 55, damage, skip, 0.72 + i * 0.07, 520, 90, { x, y }));
  }
  sound.shatter(world.pan(x));
}

/**
 * Burrow: the ground under the hero churns as they go under. A mark of
 * cracked earth and amethyst follows them while they're below, brightening
 * as they come up; then they burst out in spokes of crystal (`onRise`).
 */
export class BurrowFx extends Fx {
  private ground: Ink;
  private risen = false;
  private lamp: Phaser.GameObjects.Light;
  private static readonly RX = 18;

  constructor(
    world: WorldScene,
    private at: () => Point,
    private under: number,
    private onRise: (x: number, y: number) => void,
  ) {
    super(world, under + 460);
    this.ground = this.ink(72, 48);
    this.lamp = this.light(0, 0, 60, AMETHYST.light, 0.6);
    const p = at();
    world.debris(WYRM_TINTS, snap(p.x), snap(p.y) - 6, 26, p.y + 2);
    world.debris([EARTH.lit, EARTH.mid, AMETHYST.mid], snap(p.x), snap(p.y) - 2, 16, p.y + 2, 'spores');
    bloom(world, p.x, p.y - 4, AMETHYST.hot, 1.4, 360, p.y + 1, 0.7);
    world.cameras.main.shake(160, 0.002);
    sound.slam(world.pan(p.x));
  }

  /** Still below the floor. */
  get below(): boolean {
    return !this.risen && !this.dead;
  }

  protected step(dt: number): void {
    const p = this.at();
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const { t, under } = this;
    const R = BurrowFx.RX;
    const g = this.ground.begin(x, y, 2.5);
    if (t < under) {
      // Rising toward the surface over the last third: the mark brightens and fills.
      const k = clamp01((t - under * 0.66) / (under * 0.34));
      const grow = easeOut(t / 200);
      const shake = Math.sin(t * 0.06) * (0.5 + k);
      pool(g, x + shake, y, R * grow, EARTH.dark, EARTH.mid, 0.95, GROUND, 0.9);
      // Cracks glowing out from the middle, longer and brighter as it comes up.
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + hash(i, 5) * 0.5;
        const len = R * (0.55 + hash(i, 9) * 0.45) * (0.6 + k * 0.5) * grow;
        const ex = x + Math.cos(a) * len;
        const ey = y + Math.sin(a) * len * GROUND;
        line(g, x, y, ex, ey, k > 0.5 ? AMETHYST.hot : AMETHYST.mid, 0.55 + k * 0.45);
        g.put(ex, ey, AMETHYST.core, 0.4 + k * 0.6);
      }
      // Rubble heaving up round the rim.
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + t * 0.002;
        const r = R * (0.85 + 0.15 * Math.sin(t * 0.02 + i));
        const hop = Math.max(0, Math.sin(t * 0.018 + i * 1.7)) * (1.5 + k * 2);
        g.put(x + Math.cos(a) * r, y + Math.sin(a) * r * GROUND - hop, i % 3 ? EARTH.lit : AMETHYST.deep, 0.9);
      }
      ring(g, x, y, R * grow * (0.9 + k * 0.15), 1 + k, AMETHYST, 0.25 + k * 0.6);
      this.lamp.setPosition(x, y - 6);
      this.lamp.intensity = 0.5 + k * 1.4;
      if (Math.random() < dt / 30) this.world.debris([EARTH.lit, AMETHYST.mid, EARTH.mid], x + (Math.random() - 0.5) * R * 2, y + (Math.random() - 0.5) * R, 1, y + 1, 'spores');
    } else {
      if (!this.risen) {
        this.risen = true;
        this.onRise(p.x, p.y);
      }
      // The shock of it racing out over the ground.
      const f = (t - under) / 460;
      ring(g, x, y, 6 + 24 * easeOut(f), 2.5 * (1 - f) + 0.5, AMETHYST, 1 - f);
      this.lamp.intensity = 2 * (1 - f);
    }
    g.end();
  }
}

/**
 * The hero bursts up out of the floor: a blast where they rise and spokes of
 * crystal ring after ring outward, like Amethrax's Geode Eruption.
 */
export function crystalEruption(world: WorldScene, x: number, y: number, blast: number, spike: number): void {
  const hit = strikeGround(world, x, y, 28, { damage: blast, heavy: true, knock: 230, fromX: x, fromY: y + 2 });
  const skip = new Set<Hurtbox>(hit);
  const spokes = 8;
  const a0 = Math.random() * Math.PI * 2;
  for (let s = 0; s < spokes; s++) {
    const a = a0 + (s / spokes) * Math.PI * 2;
    for (let r = 0; r < 3; r++) {
      const d = 24 + r * 17;
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d * 0.62;
      if (!world.walkable(px, py)) break;
      world.addEffect(new ShardSpike(world, px, py, 30 + r * 70, spike, skip, 0.9 + r * 0.12, 650, 160, { x, y }));
    }
  }
  flare(world, x, y - 10, 170, AMETHYST.light, 3.2, 600);
  bloom(world, x, y - 8, AMETHYST.hot, 3, 420, y + 30);
  world.debris(WYRM_TINTS, snap(x), snap(y) - 8, 34, y + 2);
  world.debris([EARTH.lit, EARTH.mid, AMETHYST.hot], snap(x), snap(y) - 4, 18, y + 2, 'spores');
  world.cameras.main.shake(280, 0.004);
  sound.shatter(world.pan(x), true);
  sound.slam(world.pan(x));
}

/**
 * A star called down on a foe: a twinkling mark under it and a column of
 * starlight that follows it until the star falls, slanting in like the
 * Warden's, then a flash and a scorch of violet light.
 */
export class StarStrike extends Fx {
  private ground: Ink;
  private air: Ink;
  private meteor: Phaser.GameObjects.Image;
  private flash: Phaser.GameObjects.Image | null = null;
  private scorch: Phaser.GameObjects.Image | null = null;
  private landed = false;
  private static readonly MARK = 360;
  private static readonly FALL = 190;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private to: Hurtbox | null,
    private damage: number,
    /** 1 for a kill's star, more for Starfall's. */
    private k = 1,
  ) {
    super(world, StarStrike.MARK + StarStrike.FALL + 820);
    this.ground = this.ink(Math.ceil(44 * k), Math.ceil(28 * k));
    this.air = this.ink(20, 110);
    this.meteor = this.own(world.add.image(x, y, 'set_meteor').setOrigin(0.5, (METEOR_H - 5.5) / METEOR_H).setBlendMode(Phaser.BlendModes.ADD).setAngle(-14).setVisible(false).setScale(k));
  }

  protected step(): void {
    const { t, k } = this;
    const M = StarStrike.MARK;
    const F = StarStrike.FALL;
    // It follows its foe until it falls.
    if (t < M && this.to?.alive) {
      this.x = this.to.x;
      this.y = this.to.y;
    }
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const r = 9 * k;
    const g = this.ground.begin(x, y, 2.5);
    const a = this.air.begin(x, y + 1, y + 40, 0.5, 1);
    if (!this.landed) {
      const m = easeOut(t / M);
      // A small star-rune on the ground, turning, and the column of light over it.
      circle(g, x, y, r * m, STARLIGHT.hot, 0.8, GROUND);
      circle(g, x, y, r * 0.6 * m, NEBULA.mid, 0.6, GROUND);
      for (let i = 0; i < 4; i++) {
        const th = t * 0.006 + (i * Math.PI) / 2;
        g.put(x + Math.cos(th) * r * m, y + Math.sin(th) * r * m * GROUND, STARLIGHT.core, 0.95);
      }
      column(a, x, y, 100 * m, 1.6 + m * 1.4, STARLIGHT, 0.35 + m * 0.3, t);
      if (t > M) {
        const f = clamp01((t - M) / F);
        const h = (1 - f * f) * 150;
        this.meteor.setVisible(true).setPosition(snap(x - h * 0.25), snap(y - h)).setDepth(y + 40);
        if (f >= 1) this.land(x, y);
      }
    } else {
      const f = (t - M - F) / 820;
      ring(g, x, y, r * (0.6 + easeOut(f * 1.6) * 1.1), 1.5 * (1 - f) + 0.4, NEBULA, 1 - clamp01(f * 1.4));
      star(a, x, y - 8 - f * 6, Math.round(4 * k * bump(f * 1.5)), STARLIGHT, 1 - f);
      this.flash?.setAlpha(Math.max(0, 1 - f * 3)).setScale((1 + f * 4) * k);
      this.scorch?.setAlpha(0.7 * (1 - f));
    }
    g.end();
    a.end();
  }

  private land(x: number, y: number): void {
    this.landed = true;
    const w = this.world;
    this.meteor.setVisible(false);
    strikeGround(w, x, y, 10 + 6 * this.k, { damage: this.damage, knock: 90 + 40 * this.k, fromX: x, fromY: y - 6 });
    this.flash = this.own(w.add.image(x, y - 4, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xd8ccff).setDepth(y + 20));
    this.scorch = this.own(w.add.image(x, y, 'set_pool').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8a5cff).setDepth(2).setScale(0.45 * this.k));
    flare(w, x, y - 8, 90 * this.k, STARLIGHT.light, 1.6 * this.k, 380);
    w.debris(WARDEN_TINTS, x, y - 3, Math.round(10 * this.k), y + 2);
    w.cameras.main.shake(70, 0.0008 * this.k);
    sound.starImpact(w.pan(x));
  }
}

/**
 * Singularity: the Warden's black hole, opened where the hero's ability goes.
 * Light spirals in along three arms and foes are dragged together, ground
 * down; then it collapses into a nova.
 */
export class BlackHole extends Fx {
  private ground: Ink;
  private air: Ink;
  private glow: Phaser.GameObjects.Image;
  private lamp: Phaser.GameObjects.Light;
  private tick = 0;
  private burst = false;
  private static readonly R = 38;
  private static readonly COLLAPSE = 1700;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private grind: number,
    private nova: number,
  ) {
    super(world, BlackHole.COLLAPSE + 560);
    this.ground = this.ink(120, 76);
    this.air = this.ink(96, 72);
    this.glow = this.halo(NEBULA.mid, 1, y + 21);
    this.lamp = this.light(x, y - 14, 100, STARLIGHT.light, 0);
    bloom(world, x, y - 14, STARLIGHT.hot, 1.6, 300, y + 22, 0.7);
    sound.gravityWell(1.6);
  }

  protected step(dt: number): void {
    const { x, y, t } = this;
    const R = BlackHole.R;
    const C = BlackHole.COLLAPSE;
    const open = easeOut(t / 280);
    const oy = y - 15;

    if (t < C) {
      for (const h of this.world.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - x, (b.y - y) / GROUND) < R + 28)) drag(h, x, y, 44, dt);
      this.tick -= dt;
      if (this.tick <= 0 && t > 280) {
        this.tick = 260;
        strikeGround(this.world, x, y, R, { damage: this.grind, knock: 0 });
      }
    } else if (!this.burst) {
      this.burst = true;
      strikeGround(this.world, x, y, R + 12, { damage: this.nova, heavy: true, knock: 170, fromX: x, fromY: y - 6 });
      this.world.cameras.main.shake(240, 0.0035);
      this.world.debris(WARDEN_TINTS, x, oy, 30, y + 30, 'burst');
      this.world.debris([0xffffff, NEBULA.mid, 0xffe6a0], x, y - 2, 16, y + 30, 'spores');
      flare(this.world, x, y - 10, 200, NEBULA.light, 4, 700);
      bloom(this.world, x, oy, NEBULA.hot, 4, 450, y + 40);
      sound.nova();
    }

    // The ground: a violet stain and a ring of starlight; after the burst, the nova's rings.
    const g = this.ground.begin(x, y, 2.5);
    if (t < C) {
      pool(g, x, y, R * 0.75 * open, 0x0a0616, STARLIGHT.deep, 0.85, GROUND, 0.55);
      circle(g, x, y, R * open, STARLIGHT.mid, 0.7);
      for (let i = 0; i < 10; i++) {
        // Specks on the rim, drifting inward.
        const f = (t * 0.0008 + hash(i, 2)) % 1;
        const th = (i / 10) * Math.PI * 2 + f * 2.2;
        const rho = R * (1 - f) * open;
        g.put(x + Math.cos(th) * rho, y + Math.sin(th) * rho * GROUND, f > 0.7 ? STARLIGHT.core : STARLIGHT.hot, 0.9);
      }
    } else {
      const k = (t - C) / 540;
      ring(g, x, y, 4 + (R + 16) * easeOut(k), 4 * (1 - k) + 1, NEBULA, 1 - k);
      ring(g, x, y, 2 + R * easeOut(k * 1.3), 2, STARLIGHT, 0.7 * (1 - k), GROUND, 0.4, 7);
    }
    g.end();

    // The air: three arms of light spiralling in and up into the black star.
    const a = this.air.begin(x, oy + 4, y + 20);
    const grow = t < C ? easeOut(t / 800) : 1 - clamp01((t - C) / 140);
    const orb = 2 + 6 * grow;
    if (t < C + 140) {
      const spin = t * 0.0045;
      for (let arm = 0; arm < 3; arm++) {
        for (let k = 0; k < 22; k++) {
          const f = k / 22;
          const rho = R * (1 - f) * open;
          const th = spin + (arm * Math.PI * 2) / 3 + f * 3.4;
          const px = x + Math.cos(th) * rho;
          const py = y + Math.sin(th) * rho * GROUND - f * 15;
          const p = arm === 1 ? NEBULA : STARLIGHT;
          a.put(px, py, f > 0.8 ? p.core : f > 0.55 ? p.hot : f > 0.3 ? p.mid : p.deep, grow);
          if (f > 0.4) a.put(px + 1, py, p.deep, grow * 0.7);
        }
      }
      // The black star: nothing at its heart, a bright rim, and a tilted disc round it.
      for (let dy = -Math.ceil(orb) - 1; dy <= orb + 1; dy++) {
        for (let dx = -Math.ceil(orb) - 1; dx <= orb + 1; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > orb + 1) continue;
          a.put(x + dx, oy + dy, d < orb - 1.2 ? 0x07040f : d < orb ? NEBULA.core : NEBULA.mid, 1);
        }
      }
      const disc = orb * 2.1;
      for (let i = 0; i < 56; i++) {
        const th = (i / 56) * Math.PI * 2 + t * 0.006;
        const px = x + Math.cos(th) * disc;
        const py = oy + Math.sin(th) * disc * 0.3;
        // The far half of the disc hides behind the star.
        if (Math.sin(th) < 0 && Math.abs(px - x) < orb) continue;
        a.put(px, py, hash(i, 3) > 0.5 ? NEBULA.hot : STARLIGHT.mid, 0.95);
      }
    }
    a.end();

    this.glow.setPosition(x, oy).setScale(0.5 + grow * 1.1).setAlpha(t < C ? 0.32 + 0.14 * Math.sin(t * 0.01) : 0);
    this.lamp.intensity = t < C ? 2 * open : 0;
  }
}

/** A word and a flourish over the hero when a set power wakes (put on mid-run, or used). */
export function powerShout(world: WorldScene, x: number, y: number, text: string, tint: number, tints: number[]): void {
  world.popNumber(snap(x), snap(y) - 40, text, tint);
  world.debris(tints, snap(x), snap(y) - 12, 18, y + 20, 'spores');
}
