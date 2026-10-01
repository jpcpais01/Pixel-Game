import type Phaser from 'phaser';
import { sound } from '../../audio';
import { onGround } from '../Toxins';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, bump, clamp01, column, dither, drag, easeOut, flare, Fx, GROUND, hash, strikeGround, type Ink, type Pal } from './ink';

// The Tidecaller's Special, the Maelstrom: the sea opens into a whirlpool
// where she aims. Its arms drag everything near into the eye and grind at all
// caught in it; then the eye bursts upward in a great spout that hurls them away.

const R = 46;
/** It drags in from a little past its rim. */
const PULL_R = R * 1.35;
const PULL_SPEED = 62;
const TICK = 400;
const TICK_DAMAGE = 5;
const ERUPT_AT = 2300;
const ERUPT_R = R * 0.85;
const ERUPT_DAMAGE = 30;
const LIFE = 3000;
const SPOUT_H = 78;

// Lotus's lilies: how many pads ride the whirlpool, and the colours of pads and petals.
const LILIES = 9;
const LILY_LIGHT = 0x5ec850;
const LILY_DARK = 0x2e7e32;
const LOTUS_PINK = 0xf080a8;
const LOTUS_BLUSH = 0xffa0c8;

export class Maelstrom extends Fx {
  private ground: Ink;
  private spout: Ink;
  private lamp: Phaser.GameObjects.Light;
  private tick = TICK;
  private erupted = false;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
    /** Lotus's Thousand-Petal Lotus: lily pads circle the whirlpool, a lotus opens at its eye, and the spout throws petals. */
    private lotus = false,
  ) {
    super(world, LIFE);
    this.ground = this.ink(R * 2 + 12, Math.ceil(R * 2 * GROUND) + 12);
    this.spout = this.ink(40, SPOUT_H + 16);
    this.lamp = this.light(x, y - 8, 150, p.light, 0);
    sound.bog(world.pan(x));
    sound.gust(world.pan(x));
  }

  protected step(dt: number): void {
    const { x, y, t, world } = this;
    const open = easeOut(t / 500);
    const fade = 1 - clamp01((t - ERUPT_AT - 150) / (LIFE - ERUPT_AT - 150));

    if (!this.erupted) {
      // Everything near is dragged round and in toward the eye.
      for (const h of world.hurtboxesWhere((b) => b.alive && onGround(b, x, y, PULL_R * open))) {
        const a = Math.atan2((h.y - y) / GROUND, h.x - x) + 0.9;
        const d = Math.hypot(h.x - x, (h.y - y) / GROUND);
        drag(h, x + Math.cos(a) * d * 0.5, y + Math.sin(a) * d * 0.5 * GROUND, PULL_SPEED, dt);
      }
      this.tick -= dt;
      if (this.tick <= 0 && t > 300) {
        this.tick += TICK;
        strikeGround(world, x, y, R * open, { damage: TICK_DAMAGE, knock: 0, fromX: x, fromY: y });
      }
      if (t >= ERUPT_AT) this.erupt();
    }
    this.lamp.intensity = (this.erupted ? 2.4 * (1 - clamp01((t - ERUPT_AT) / 500)) : 0.9 + 0.2 * Math.sin(t * 0.01)) * open;

    this.drawPool(open * (this.erupted ? 1 - 0.3 * clamp01((t - ERUPT_AT) / 400) : 1), fade);
    if (this.erupted) {
      const e = (t - ERUPT_AT) / (LIFE - ERUPT_AT);
      const s = this.spout.begin(x, y + 2, y + 6, 0.5, (SPOUT_H + 10) / this.spout.h);
      column(s, x, y + 1, Math.round(SPOUT_H * bump(Math.min(1, e * 1.6)) * (e < 0.3 ? 1 : 1 - (e - 0.3) * 0.6)), 7 + 3 * (1 - e), this.p, 1 - e * e, t);
      s.end();
    }
  }

  /** The whirlpool: arms of foam spiralling in over the water, darkening to the eye. */
  private drawPool(scale: number, fade: number): void {
    const { x, y, t, p } = this;
    const r = R * scale;
    const g = this.ground.begin(x, y, 2.4);
    if (r > 1 && fade > 0) {
      const spin = t * 0.0065;
      const ry = Math.ceil(r * GROUND);
      for (let oy = -ry; oy <= ry; oy++) {
        for (let ox = -Math.ceil(r); ox <= Math.ceil(r); ox++) {
          const d = Math.hypot(ox, oy / GROUND) / r;
          if (d > 1) continue;
          const px = Math.round(x + ox);
          const py = Math.round(y + oy);
          // The rim thins out in a dithered edge.
          if (d > 0.78 && dither(px, py) >= ((1 - d) / 0.22) * fade) continue;
          if (d < 0.8 && fade < 1 && dither(px, py) >= fade) continue;
          const th = Math.atan2(oy / GROUND, ox);
          const v = 0.5 + 0.5 * Math.sin(th * 3 + d * 9 - spin * 3);
          let c: number;
          if (d < 0.14) c = 0x040a14;
          else if (v > 0.9 && d > 0.2) c = p.core;
          else if (v > 0.68) c = p.hot;
          else if (v > 0.3 || d > 0.85) c = p.mid;
          else c = p.deep;
          // A little churn so the foam doesn't read as painted stripes.
          if (c === p.core && hash(px, py, Math.floor(t / 110)) > 0.8) c = p.hot;
          g.put(px, py, c, d < 0.14 ? 0.9 : 0.78);
        }
      }
      if (this.lotus) this.drawLilies(g, r, spin, fade);
    }
    g.end();
  }

  /**
   * Lotus's touch: lily pads riding round the whirlpool's arms, and over the
   * eye a great lotus opening petal by petal until the spout bursts through it.
   */
  private drawLilies(g: Ink, r: number, spin: number, fade: number): void {
    const { x, y, t } = this;
    for (let i = 0; i < LILIES; i++) {
      const d = r * (0.42 + 0.4 * ((i * 0.37) % 1));
      const a = (i / LILIES) * Math.PI * 2 + spin * (1.6 - d / r);
      const px = Math.round(x + Math.cos(a) * d);
      const py = Math.round(y + Math.sin(a) * d * GROUND);
      for (const ox of [-1, 0, 1]) g.put(px + ox, py, LILY_LIGHT, fade);
      g.put(px - 1, py + 1, LILY_DARK, fade);
      g.put(px + 2, py, LILY_DARK, fade);
      if (i % 3 === 0) g.put(px, py - 1, LOTUS_BLUSH, fade);
    }
    if (this.erupted) return;
    // The lotus at the eye: its petals open out one ring after another.
    const open = clamp01((t - 300) / (ERUPT_AT - 500));
    const n = Math.round(4 + open * 8);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.3;
      const len = 1.5 + open * 4.5;
      for (let j = 1; j <= len; j++) {
        g.put(x + Math.cos(a) * j, y + Math.sin(a) * j * GROUND - j * 0.4 * open, j > len - 1.2 ? 0xfff0f6 : j > len * 0.5 ? LOTUS_BLUSH : LOTUS_PINK, fade);
      }
    }
    g.put(x, y - 1, this.p.core, fade);
  }

  /** The eye bursts upward: everything in it is struck hard and flung out, under a rain of spray. */
  private erupt(): void {
    this.erupted = true;
    const { world, x, y, p } = this;
    strikeGround(world, x, y, ERUPT_R, { damage: ERUPT_DAMAGE, heavy: true, knock: 150, fromX: x, fromY: y });
    flare(world, x, y - 20, 200, p.light, 3, 700);
    bloom(world, x, y - 18, p.hot, 3.2, 600, y + 30);
    world.debris(p.tints, x, y - 30, 26, y + 20, 'burst');
    world.debris([0xffffff, p.hot, p.mid], x, y - 50, 14, y + 20, 'spores');
    if (this.lotus) world.debris([LOTUS_PINK, LOTUS_BLUSH, 0xfff0f6], x, y - 40, 24, y + 20, 'spores');
    world.cameras.main.shake(220, 0.0016);
    sound.quakeSlam(world.pan(x));
    sound.splash(world.pan(x));
  }
}
