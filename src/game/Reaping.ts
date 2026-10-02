import Phaser from 'phaser';
import { PixelLayer } from './Beam';
import { snap } from './display';
import type { Hurtbox } from './combat';
import type { Effect } from './Slash';
import type { Pal } from './ultimate/ink';
import type { WorldScene } from '../scenes/WorldScene';

// The Reaper's own effects, shared by his hero and his Special:
//  - ReapSoul: a soul (a marigold petal in rose flame for the Catrina) torn
//    from a foe by the scythe, springing up off it and flying back into his
//    chest, where it heals him.
//  - DeathMark: a little skull of soul-light hanging over a foe his step cut
//    through, while his reaps bite it deeper.
//  - ShadeStreak: the smear of shade Death's step leaves along its path.

/** How a soul flies: first flung up off the foe, then pulled in ever faster. */
const SOUL_POP = 70;
const SOUL_PULL = 520;
const SOUL_MAX_SPEED = 260;
/** It reaches him within this (px), or gives up after this long (ms) and lands anyway. */
const SOUL_CATCH = 5;
const SOUL_LIFE = 1400;
/** His chest, above his feet, where the souls go in. */
const CHEST = 15;

const hash = (a: number, b: number, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Anything with feet to fly back to. */
export interface Reaped {
  x: number;
  y: number;
}

export class ReapSoul implements Effect {
  dead = false;
  private layer: PixelLayer;
  private glow: Phaser.GameObjects.Image;
  private vx: number;
  private vy: number;
  private age = 0;
  private trailT = 0;
  private readonly seed = Math.floor(Math.random() * 1000);

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private to: Reaped,
    private pal: Pal,
    private petal: boolean,
    private onArrive: () => void,
  ) {
    // Flung up and away from him first, so each soul curves in on its own path.
    const a = Math.atan2(y - (to.y - CHEST), x - to.x) + (Math.random() - 0.5) * 1.6;
    this.vx = Math.cos(a) * SOUL_POP * 0.6;
    this.vy = Math.sin(a) * SOUL_POP * 0.4 - SOUL_POP;
    this.layer = new PixelLayer(world, 9, 9);
    this.glow = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(pal.mid).setScale(0.45).setAlpha(0.7);
    this.place();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    const s = dt / 1000;
    const tx = this.to.x;
    const ty = this.to.y - CHEST;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    // Pulled harder the longer it flies, and the drift of its first fling dies away.
    const pull = SOUL_PULL * Math.min(1, 0.25 + this.age / 350);
    this.vx += (dx / d) * pull * s;
    this.vy += (dy / d) * pull * s;
    const damp = Math.pow(0.08, s);
    this.vx *= damp + (1 - damp) * 0.6;
    this.vy *= damp + (1 - damp) * 0.6;
    const v = Math.hypot(this.vx, this.vy);
    if (v > SOUL_MAX_SPEED) {
      this.vx *= SOUL_MAX_SPEED / v;
      this.vy *= SOUL_MAX_SPEED / v;
    }
    this.x += this.vx * s;
    this.y += this.vy * s;
    if (Math.hypot(tx - this.x, ty - this.y) <= SOUL_CATCH || this.age >= SOUL_LIFE) {
      this.arrive();
      return;
    }
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = this.petal ? 40 : 28;
      this.world.debris(this.petal ? [this.pal.hot, this.pal.mid] : [this.pal.hot, this.pal.mid, this.pal.deep], snap(this.x), snap(this.y), 1, this.to.y + 30, 'trail');
    }
    this.place();
  }

  private arrive(): void {
    const p = this.pal;
    this.world.debris([p.core, p.hot, p.mid], snap(this.to.x), snap(this.to.y - CHEST), this.petal ? 4 : 3, this.to.y + 20, 'spores');
    this.onArrive();
    this.destroy();
  }

  /** The head: a flame licking back the way it came (or a petal turning over, ringed in flame). */
  private place(): void {
    const b = this.layer;
    const p = this.pal;
    b.clear();
    const v = Math.hypot(this.vx, this.vy) || 1;
    const bx = -this.vx / v;
    const by = -this.vy / v;
    const f = Math.floor(this.age / 60);
    if (this.petal) {
      const w = [2, 1, 0, 1][(f + this.seed) % 4];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -w; dx <= w; dx++) b.put(4 + dx, 4 + dy, dx === 0 && dy === 0 ? p.core : Math.abs(dx) === w ? p.mid : p.hot);
      b.put(4 + Math.round(bx * 2), 4 + Math.round(by * 2), p.mid, 0.8);
      b.put(4 + Math.round(bx * 3), 4 + Math.round(by * 3), p.deep, 0.6);
    } else {
      b.put(4, 4, p.core);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.put(4 + dx, 4 + dy, p.hot);
      // The tongue of the flame, flickering, streaming back.
      const lick = ((f + this.seed) % 3) - 1;
      for (let k = 2; k <= 4; k++) b.put(4 + Math.round(bx * k - by * lick * (k - 1) * 0.4), 4 + Math.round(by * k + bx * lick * (k - 1) * 0.4), k < 3 ? p.mid : p.deep, 1 - (k - 2) * 0.2);
    }
    b.flush();
    const x = snap(this.x);
    const y = snap(this.y);
    b.image.setPosition(x - 4, y - 4).setDepth(this.to.y + 25);
    this.glow.setPosition(x + 0.5, y + 0.5).setDepth(this.to.y + 24.9);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
    this.glow.destroy();
  }
}

/** The mark's glyph: a little skull, rows of letters (c core, h hot, m mid, d deep). */
const SKULL = ['.hhh.', 'hcccm', 'c.c.m', 'hcchm', '.mdm.', '.d.d.'];
/** The Catrina's: a sugar skull with a marigold on its brow. */
const SUGAR = ['.mhm.', 'hcccc', 'c.c.c', 'ccmcc', '.cdc.', '.d.d.'];

export class DeathMark implements Effect {
  dead = false;
  private layer: PixelLayer;
  private glow: Phaser.GameObjects.Image;
  private age = 0;
  private flash = 0;

  constructor(
    world: WorldScene,
    private foe: Hurtbox,
    private pal: Pal,
    private sugar: boolean,
    private life: number,
  ) {
    this.layer = new PixelLayer(world, 7, 8);
    this.glow = world.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(pal.mid).setScale(0.4);
    this.draw();
  }

  /** Time it has left, ms. */
  get left(): number {
    return Math.max(0, this.life - this.age);
  }

  /** Marked again: its time starts over. */
  renew(life: number): void {
    this.life = this.age + life;
    this.flash = 1;
  }

  /** A reap bit deeper through it: it flares. */
  pop(): void {
    this.flash = 1;
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    this.flash = Math.max(0, this.flash - dt / 220);
    if (this.age >= this.life || !this.foe.alive) {
      this.destroy();
      return;
    }
    this.draw();
  }

  private draw(): void {
    const p = this.pal;
    const b = this.layer;
    const rows = this.sugar ? SUGAR : SKULL;
    const left = this.life - this.age;
    // It blinks out over its last half second.
    const a = left < 500 && Math.floor(left / 80) % 2 === 0 ? 0.45 : 1;
    const cols: Record<string, number> = { c: this.flash > 0.4 ? 0xffffff : p.core, h: p.hot, m: p.mid, d: p.deep };
    b.clear();
    rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && b.put(x + 1, y + 1, cols[ch], a)));
    b.flush();
    const bob = Math.round(Math.sin(this.age * 0.006));
    const x = snap(this.foe.x) - 3;
    const y = snap(this.foe.y - this.foe.bodyY * 2) - 11 + bob;
    b.image.setPosition(x, y).setDepth(this.foe.y + 40);
    this.glow.setPosition(x + 3.5, y + 4).setDepth(this.foe.y + 39.9).setAlpha((0.35 + 0.5 * this.flash) * a);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
    this.glow.destroy();
  }
}

/** Death's step's path: a ribbon of shade torn along it, soul-light at its edges, thinning from where he left. */
export class ShadeStreak implements Effect {
  dead = false;
  private layer: PixelLayer;
  private ox: number;
  private oy: number;
  private age = 0;
  private readonly life = 520;
  private light: Phaser.GameObjects.Light;

  constructor(
    private world: WorldScene,
    private x0: number,
    private y0: number,
    private x1: number,
    private y1: number,
    private pal: Pal,
    private shade: number,
    private petals: boolean,
  ) {
    const pad = 10;
    this.ox = Math.floor(Math.min(x0, x1) - pad);
    this.oy = Math.floor(Math.min(y0, y1) - pad - CHEST);
    const w = Math.ceil(Math.abs(x1 - x0)) + pad * 2 + 1;
    const h = Math.ceil(Math.abs(y1 - y0)) + pad * 2 + 1;
    this.layer = new PixelLayer(world, w, h);
    this.layer.image.setPosition(this.ox, this.oy).setDepth(Math.max(y0, y1) + 2);
    this.light = world.lights.addLight((x0 + x1) / 2, (y0 + y1) / 2 - CHEST, 90, pal.light, 1.6);
    this.draw();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    if (this.age >= this.life) {
      this.destroy();
      return;
    }
    this.draw();
  }

  private draw(): void {
    const k = this.age / this.life;
    const b = this.layer;
    const p = this.pal;
    b.clear();
    const dx = this.x1 - this.x0;
    const dy = this.y1 - this.y0;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const f = Math.floor(this.age / 40);
    for (let py = 0; py < b.h; py++) {
      for (let px = 0; px < b.w; px++) {
        // Measured from the path at chest height.
        const rx = this.ox + px + 0.5 - this.x0;
        const ry = this.oy + py + 0.5 - (this.y0 - CHEST);
        const along = (rx * ux + ry * uy) / len;
        if (along < -0.05 || along > 1.05) continue;
        const perp = Math.abs(rx * -uy + ry * ux);
        // It is eaten from where he left towards where he came out, and frays at its edges.
        if (along < k * 1.3 - 0.15) continue;
        const width = (3.4 + 2.6 * along) * (1 - k * 0.5);
        const n = hash(px, py, f);
        if (perp > width + n * 1.5) continue;
        const edge = perp > width - 1.2;
        if (edge) {
          if (n > 0.45) b.put(px, py, this.petals && n > 0.85 ? p.hot : n > 0.75 ? p.hot : p.mid, 0.9 - k * 0.5);
        } else b.put(px, py, perp < 1 && along > 0.2 ? p.deep : this.shade, 0.85 - k * 0.6);
      }
    }
    // The cut itself: a hair of light through the middle, where the scythe went.
    if (k < 0.45) {
      for (let i = 0; i <= len; i++) {
        const px = Math.round(this.x0 + ux * i - this.ox);
        const py = Math.round(this.y0 - CHEST + uy * i - this.oy);
        b.put(px, py, i > len * (0.3 + k) ? p.core : p.hot, 1 - k * 2);
      }
    }
    b.flush();
    this.light.intensity = 1.6 * (1 - k);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
    this.world.lights.removeLight(this.light);
  }
}
