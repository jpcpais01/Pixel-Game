import type Phaser from 'phaser';
import { sound } from '../../audio';
import { Venom, type ToxStyle } from '../Toxins';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, circle, clamp01, dither, easeOut, flare, Fx, GROUND, hash, line, pool, ring, stroke, strikeGround, type Ink, type Pal } from './ink';
import { pickSpots, Ray } from './holy';
import type { Cast } from './types';

// The dark classes' Specials: the Cutthroat's fan of knives, the Shadow
// dancer's eclipse, the Bonecaller's storm of souls and the Blood mage's moon.

/** Bleeding from the knives: ticks like poison, in red. */
const BLEED: ToxStyle = {
  core: 0xffe0e0,
  hot: 0xff8a8a,
  mid: 0xe8505a,
  deep: 0x8a1c2c,
  murk: 0x3a0a10,
  tints: [0xffb0b0, 0xe8505a, 0x8a1c2c],
  light: 0xff5060,
  numbers: 0xff6a7a,
  suffix: '',
};

const KNIFE_WAVES = 3;
const KNIVES = 14;
const KNIFE_SPEED = 250;
const KNIFE_REACH = 84;

interface Knife {
  a: number;
  born: number;
  dead: boolean;
}

/** The Cutthroat's Fan of Knives: three rings of daggers burst out from the spinning rogue, each one cutting the first foe it meets. */
export class FanOfKnives extends Fx {
  private pix: Ink;
  private ground: Ink;
  private knives: Knife[] = [];
  private bleed: Venom;
  private wave = 0;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, 3400);
    this.pix = this.ink(2 * KNIFE_REACH + 24, 2 * KNIFE_REACH + 24);
    this.ground = this.ink(60, 40);
    this.bleed = new Venom(world, BLEED, 3);
    world.evade(500);
  }

  protected step(dt: number): void {
    const { c, t, world } = this;
    const p = c.pal;
    const cx = c.x;
    const cy = c.y - 10;
    while (this.wave < KNIFE_WAVES && t >= this.wave * 150) {
      const off = ((this.wave % 2) * Math.PI) / KNIVES + Math.atan2(c.dy, c.dx);
      for (let i = 0; i < KNIVES; i++) this.knives.push({ a: off + (i / KNIVES) * Math.PI * 2, born: t, dead: false });
      sound.knife(world.pan(cx), this.wave + 1, this.wave === KNIFE_WAVES - 1);
      world.debris(p.tints, cx, cy, 6, c.y + 10, 'burst');
      this.wave++;
    }

    const g = this.pix.begin(cx, cy, c.y + 12);
    for (const k of this.knives) {
      if (k.dead) continue;
      const d = 6 + (KNIFE_SPEED * (t - k.born)) / 1000;
      if (d > KNIFE_REACH) {
        k.dead = true;
        continue;
      }
      const ux = Math.cos(k.a);
      const uy = Math.sin(k.a);
      const x = cx + ux * d;
      const y = cy + uy * d;
      const foe = world.firstHurtbox((h) => Math.hypot(h.x - x, h.y - h.bodyY - y) < h.radius + 3);
      if (foe) {
        k.dead = true;
        foe.hurt({ damage: 16, heavy: false, knock: 50, fromX: x - ux * 8, fromY: y - uy * 8 });
        this.bleed.dose(foe, 2500);
        world.debris(BLEED.tints, x, y, 4, foe.y + 10, 'burst');
        sound.knifeHit(world.pan(x));
        continue;
      }
      // Blade (bright at the point), a dark grip, and a faint streak behind.
      for (let i = 0; i < 4; i++) g.put(x - ux * i, y - uy * i, i === 0 ? p.core : i < 2 ? p.hot : p.mid);
      g.put(x - ux * 4, y - uy * 4, p.deep);
      g.put(x - ux * 5, y - uy * 5, 0x3a2a2e);
      for (let i = 7; i < 13; i++) if (dither(Math.round(x - ux * i), Math.round(y - uy * i)) < 0.4) g.put(x - ux * i, y - uy * i, p.mid, 0.8);
    }
    g.end();

    const gg = this.ground.begin(c.x, c.y, 2.5);
    for (let w = 0; w < this.wave; w++) {
      const k = (t - w * 150) / 300;
      if (k >= 0 && k < 1) ring(gg, c.x, c.y, 4 + 20 * easeOut(k), 1.5, p, 1 - k);
    }
    gg.end();
    this.bleed.update(dt);
  }
}

/** One slash of the eclipse: two crossing cuts across a body, drawn in fast and fading. */
class CrossCut extends Fx {
  private pix: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private depth: number,
    private a: number,
    private p: Pal,
  ) {
    super(world, 320);
    this.pix = this.ink(36, 36);
  }

  protected step(): void {
    const { x, y, a, p, t } = this;
    const g = this.pix.begin(x, y, this.depth);
    for (const [k, off] of [
      [0, 0],
      [1, Math.PI / 2],
    ] as const) {
      const grow = clamp01((t - k * 50) / 70);
      if (grow <= 0) continue;
      const fade = 1 - clamp01((t - 120 - k * 50) / 180);
      const ux = Math.cos(a + off);
      const uy = Math.sin(a + off);
      const L = 14;
      stroke(g, x - ux * L, y - uy * L, x - ux * L + ux * 2 * L * grow, y - uy * L + uy * 2 * L * grow, 1.3 * fade, p, fade);
    }
    g.end();
  }
}

const CUTS = 12;

/** The Shadow dancer's Eclipse: darkness spills out round her, and from it a storm of blades crosses every foe inside, while she can't be touched. */
export class Eclipse extends Fx {
  private ground: Ink;
  private spots: ReturnType<typeof pickSpots>;
  private next = 0;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, 2000);
    this.ground = this.ink(190, 116);
    this.spots = pickSpots(world, c.x, c.y, 92, CUTS, 70);
    world.evade(1700);
    sound.vanish(world.pan(c.x), true);
  }

  protected step(): void {
    const { c, t, world } = this;
    const p = c.pal;
    while (this.next < CUTS && t >= 240 + this.next * 100) {
      const s = this.spots[this.next++];
      const f = s.foe;
      const x = f ? f.x : s.x;
      const y = f ? f.y - f.bodyY : s.y - 10;
      const feet = f ? f.y : s.y;
      if (f?.alive) f.hurt({ damage: 22, heavy: this.next === CUTS, knock: 40, fromX: x + (Math.random() - 0.5) * 10, fromY: y - 6 });
      world.addEffect(new CrossCut(world, x, y, feet + 20, hash(this.next, 7) * Math.PI, p));
      world.debris(p.tints, x, y, 5, feet + 20, 'burst');
      sound.blink(world.pan(x));
    }
    const g = this.ground.begin(c.x, c.y, 2.5);
    const open = easeOut(t / 260) * (1 - clamp01((t - 1600) / 400));
    pool(g, c.x, c.y, 82 * open, 0x0c0616, p.deep, open, GROUND, 0.7);
    circle(g, c.x, c.y, 82 * open, p.mid, open * 0.9);
    circle(g, c.x, c.y, 80 * open, p.deep, open * 0.6, GROUND, t * 0.003, t * 0.003 + Math.PI);
    // Petals of shadow drifting up out of the dark.
    if (Math.floor(t / 70) !== Math.floor((t - 16) / 70) && open > 0.3) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 70;
      world.debris([p.hot, p.mid, p.deep], c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * GROUND, 1, c.y + 30, 'spores');
    }
    g.end();
  }
}

const SOULS = 9;

/** The Bonecaller's Soul Storm: a ring of wailing souls whirls out round him, biting whatever they pass and feeding him its life. */
export class SoulStorm extends Fx {
  private pix: Ink;
  private ground: Ink;
  private bitten = new Map<string, number>();
  private wail = 0;
  private radius = 14;
  private angle = 0;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, 2700);
    this.pix = this.ink(210, 150);
    this.ground = this.ink(60, 40);
    sound.soulCast(world.pan(c.x));
  }

  protected step(dt: number): void {
    const { c, t, world } = this;
    const p = c.pal;
    const hx = c.hero.x;
    const hy = c.hero.y;
    const leaving = clamp01((t - 2200) / 500);
    this.radius = 14 + 60 * easeOut(t / 2000) + leaving * 50;
    this.angle += dt * 0.0042;
    const rr = this.radius;
    const hurtboxes = world.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - hx, h.y - hy) < rr + 24);
    this.wail -= dt;

    const g = this.pix.begin(hx, hy - 10, hy + 14);
    for (let i = 0; i < SOULS; i++) {
      const base = this.angle + (i / SOULS) * Math.PI * 2;
      const x = hx + Math.cos(base) * rr;
      const y = hy - 10 + Math.sin(base) * rr * 0.62 - Math.sin(t * 0.008 + i) * 2;
      const a = 1 - leaving;
      // A tail of fading wisps along the orbit behind it.
      for (let k = 8; k >= 1; k--) {
        const b = base - k * 0.06;
        const tx = hx + Math.cos(b) * rr;
        const ty = hy - 10 + Math.sin(b) * rr * 0.62 - Math.sin(t * 0.008 + i) * 2 + k * 0.4;
        const col = k < 3 ? p.hot : k < 6 ? p.mid : p.deep;
        if (dither(Math.round(tx), Math.round(ty)) < a * (1 - k / 10)) g.put(tx, ty, col);
        if (k < 6) g.put(tx, ty + 1, k < 3 ? p.mid : p.deep, a * 0.9);
      }
      // The soul: a pale little skull with hollow eyes and a ragged jaw.
      const SKULL = ['.hch.', 'hcccc', 'ceced', 'hcccm', '.m.m.'];
      SKULL.forEach((row, dy) => {
        for (let dx = 0; dx < 5; dx++) {
          const ch = row[dx];
          if (ch === '.') continue;
          g.put(x + dx - 2, y + dy - 3, ch === 'c' ? p.core : ch === 'h' ? p.hot : ch === 'm' ? p.mid : p.deep, a);
        }
      });

      if (leaving > 0.6) continue;
      for (const h of hurtboxes) {
        if (Math.hypot(h.x - x, h.y - h.bodyY - y) > h.radius + 5) continue;
        const idKey = this.keyOf(h, i);
        if ((this.bitten.get(idKey) ?? -1e9) + 450 > t) continue;
        this.bitten.set(idKey, t);
        h.hurt({ damage: 14, heavy: false, knock: 40, fromX: hx, fromY: hy - 10 });
        const got = c.hero.vitals.heal(2);
        if (got) world.debris([p.core, p.hot], hx, hy - 14, 2, hy + 10, 'spores');
        world.debris(p.tints, x, y, 4, h.y + 10, 'burst');
        if (this.wail <= 0) {
          this.wail = 120;
          sound.soulHit(world.pan(x));
        }
      }
    }
    g.end();

    const gg = this.ground.begin(c.hero.x, c.hero.y, 2.5);
    rune2(gg, hx, hy, 16 * easeOut(t / 300) * (1 - leaving), t, p);
    gg.end();
  }

  private ids = new Map<Hurtbox, number>();
  private keyOf(h: Hurtbox, soul: number): string {
    let id = this.ids.get(h);
    if (id === undefined) this.ids.set(h, (id = this.ids.size));
    return `${soul}:${id}`;
  }
}

/** A small turning circle of runes under the necromancer's feet. */
function rune2(g: Ink, x: number, y: number, r: number, t: number, p: Pal): void {
  if (r < 2) return;
  circle(g, x, y, r, p.mid, 0.9);
  for (let i = 0; i < 6; i++) {
    const a = t * 0.003 + (i / 6) * Math.PI * 2;
    g.put(x + Math.cos(a) * r, y + Math.sin(a) * r * GROUND, p.core);
    line(g, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5 * GROUND, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8 * GROUND, p.deep, 0.9);
  }
}

const LANCES = 12;
const MOON_H = 74;
const MOON_R = 11;

/** The Blood mage's Blood Moon: a crimson moon rises over the spot, rains lances of blood on every foe below, then bursts. */
export class BloodMoon extends Fx {
  private sky: Ink;
  private ground: Ink;
  private glow: Phaser.GameObjects.Image;
  private lamp: Phaser.GameObjects.Light;
  private spots: ReturnType<typeof pickSpots>;
  private next = 0;
  private burst = false;
  private static readonly BURST = 450 + LANCES * 85 + 150;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private c: Cast,
  ) {
    super(world, BloodMoon.BURST + 700);
    this.sky = this.ink(40, 40);
    this.ground = this.ink(160, 100);
    this.glow = this.halo(c.pal.mid, 2, y - MOON_H);
    this.lamp = this.light(x, y - 30, 130, c.pal.light, 0);
    this.spots = pickSpots(world, x, y, 66, LANCES, 56);
    sound.soulCast(world.pan(x), true);
  }

  protected step(): void {
    const { x, y, c, t, world } = this;
    const p = c.pal;
    const rise = easeOut(t / 420);
    const mx = x;
    const my = y - 40 - (MOON_H - 40) * rise;
    const B = BloodMoon.BURST;

    while (this.next < LANCES && t >= 450 + this.next * 85) {
      const s = this.spots[this.next++];
      const gx = s.foe ? s.foe.x : s.x;
      const gy = s.foe ? s.foe.y : s.y;
      world.addEffect(
        new Ray(world, mx + (Math.random() - 0.5) * 10, my + 6, gx, gy, p, 'lance', (lx, ly) => {
          const hit = strikeGround(world, lx, ly, 12, { damage: 24, heavy: false, knock: 60, fromX: lx, fromY: ly - 20 });
          if (hit.length) c.hero.vitals.heal(2 * hit.length);
          world.debris([p.hot, p.mid, p.deep], lx, ly - 3, 6, ly + 20, 'burst');
          sound.soulHit(world.pan(lx), true);
        }),
      );
    }
    if (!this.burst && t >= B) {
      this.burst = true;
      const hit = strikeGround(world, x, y, 64, { damage: 32, heavy: true, knock: 150, fromX: x, fromY: y - 10 });
      if (hit.length) {
        const got = c.hero.vitals.heal(3 * hit.length);
        if (got) world.popNumber(Math.round(c.hero.x), Math.round(c.hero.y) - 38, `+${got}`, 0x9dff9a);
      }
      world.debris(p.tints, mx, my, 26, y + 20, 'burst');
      world.cameras.main.shake(220, 0.003);
      flare(world, x, y - 20, 220, p.light, 4, 700);
      bloom(world, mx, my, p.hot, 4, 450, y + 30);
      sound.bloodNova(world.pan(x));
    }

    // The moon: a lit crescent edge, a shadowed body and dark seas.
    const s = this.sky.begin(mx, my, y + 30);
    if (t < B) {
      const a = Math.min(1, t / 250);
      for (let dy = -MOON_R; dy <= MOON_R; dy++) {
        for (let dx = -MOON_R; dx <= MOON_R; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > MOON_R) continue;
          const lit = Math.hypot(dx + 4, dy + 3) < MOON_R - 1;
          let col = d > MOON_R - 1 ? p.hot : lit ? p.mid : p.deep;
          if (hash(Math.floor((dx + 20) / 3), Math.floor((dy + 20) / 3), 5) > 0.72 && d < MOON_R - 2) col = p.deep;
          if (dx < -5 && dy < -4 && d < MOON_R - 1) col = p.core;
          if (dither(dx + 32, dy + 32) < a) s.put(mx + dx, my + dy, col);
        }
      }
    }
    s.end();

    const g = this.ground.begin(x, y, 2.5);
    const spread = easeOut((t - 300) / 800) * (1 - clamp01((t - B - 200) / 500));
    pool(g, x, y, 60 * spread, 0x3a0610, p.deep, spread, GROUND, 0.75);
    circle(g, x, y, 60 * spread, p.mid, spread);
    if (t >= B) {
      const k = (t - B) / 500;
      if (k < 1) ring(g, x, y, 4 + 64 * easeOut(k), 3.5 * (1 - k) + 1, p, 1 - k);
    }
    g.end();
    const on = t < B ? rise : 0;
    this.glow.setPosition(mx, my).setAlpha(0.55 * on).setScale(1.8 + 0.2 * Math.sin(t * 0.006));
    this.lamp.setPosition(mx, y - 20);
    this.lamp.intensity = 2.4 * on;
  }
}
