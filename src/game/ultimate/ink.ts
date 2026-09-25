import Phaser from 'phaser';
import { PixelLayer } from '../Beam';
import { onGround } from '../Toxins';
import type { Hurtbox, Strike } from '../combat';
import type { Effect } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';

// The drawing kit the Specials are made from. Like the beam and the blades,
// every shape is solid pixels on a small canvas (see PixelLayer) laid on the
// world's pixel grid, with soft additive glows and a few real lights around
// them for the bloom. Circles on the ground are squashed, seen at an angle.

/** A Special's colours, brightest first, plus the colour of the light it casts and its spark tints. */
export interface Pal {
  core: number;
  hot: number;
  mid: number;
  deep: number;
  light: number;
  tints: number[];
}

export const pal = (core: number, hot: number, mid: number, deep: number, light = hot): Pal => ({ core, hot, mid, deep, light, tints: [core, hot, mid, deep] });

/** How flat a circle on the ground looks (the same as the alchemist's pools, so hits match what is drawn). */
export const GROUND = 0.58;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
/** An ordered-dither threshold for a pixel: shapes fade out in a clean checker, not in smears of alpha. */
export const dither = (x: number, y: number): number => BAYER[((y & 3) << 2) | (x & 3)];

export const hash = (a: number, b: number, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
export const easeOut = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
export const easeIn = (t: number): number => Math.pow(clamp01(t), 2.2);
/** 0 → 1 → 0 over t in 0..1. */
export const bump = (t: number): number => Math.sin(clamp01(t) * Math.PI);

/** Pick a colour across a band: 0 is its heart, 1 its outer edge. */
export const shade = (p: Pal, u: number): number => (u < 0.28 ? p.core : u < 0.55 ? p.hot : u < 0.8 ? p.mid : p.deep);

/** A canvas of pixels placed in the world, drawn in world coordinates. */
export class Ink {
  private layer: PixelLayer;
  private ox = 0;
  private oy = 0;

  constructor(
    scene: Phaser.Scene,
    readonly w: number,
    readonly h: number,
  ) {
    this.layer = new PixelLayer(scene, w, h);
  }

  get image(): Phaser.GameObjects.Image {
    return this.layer.image;
  }

  /** Clear, and place the canvas with (cx, cy) at its anchor (0.5, 0.5 is the centre; 0.5, 1 the bottom). */
  begin(cx: number, cy: number, depth: number, ax = 0.5, ay = 0.5): this {
    this.ox = Math.round(cx - this.w * ax);
    this.oy = Math.round(cy - this.h * ay);
    this.layer.image.setPosition(this.ox, this.oy).setDepth(depth);
    this.layer.clear();
    return this;
  }

  put(x: number, y: number, c: number, a = 1): void {
    this.layer.put(Math.round(x) - this.ox, Math.round(y) - this.oy, c, a);
  }

  end(): void {
    this.layer.flush();
  }

  destroy(): void {
    this.layer.destroy();
  }
}

/** A ring on the ground, `w` px thick either side of radius `r`. `gaps` 0..1 breaks it into arcs. */
export function ring(ink: Ink, cx: number, cy: number, r: number, w: number, p: Pal, a = 1, sq = GROUND, gaps = 0, seed = 0): void {
  if (r + w <= 0 || a <= 0) return;
  const R = r + w;
  const ry = Math.ceil(R * sq);
  const rx = Math.ceil(R);
  const r0 = Math.max(0, r - w);
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const d = Math.hypot(dx, dy / sq);
      if (d > R || d < r0) continue;
      if (gaps > 0 && hash(Math.floor(((Math.atan2(dy / sq, dx) + Math.PI) * R) / 6), seed) < gaps) continue;
      const u = Math.abs(d - r) / w;
      ink.put(cx + dx, cy + dy, shade(p, u), a);
    }
  }
}

/** A thin circle outline on the ground, one pixel wide. */
export function circle(ink: Ink, cx: number, cy: number, r: number, c: number, a = 1, sq = GROUND, from = 0, to = Math.PI * 2): void {
  const steps = Math.max(12, Math.ceil(Math.abs(to - from) * r * 1.3));
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    ink.put(cx + Math.cos(t) * r, cy + Math.sin(t) * r * sq, c, a);
  }
}

/** A filled patch on the ground that thins out towards its rim in a dithered checker. */
export function pool(ink: Ink, cx: number, cy: number, r: number, inner: number, outer: number, a = 1, sq = GROUND, alpha = 0.85): void {
  if (r <= 0 || a <= 0) return;
  const ry = Math.ceil(r * sq);
  const rx = Math.ceil(r);
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const d = Math.hypot(dx, dy / sq) / r;
      if (d > 1) continue;
      const k = a * (1 - d * d * d);
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      if (dither(x, y) >= k) continue;
      ink.put(x, y, d < 0.55 ? inner : outer, alpha);
    }
  }
}

/** A one-pixel line. */
export function line(ink: Ink, x0: number, y0: number, x1: number, y1: number, c: number, a = 1): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) ink.put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, a);
}

/** A glowing stroke `w` px either side of the line: white heart, the palette out to the edge. */
export function stroke(ink: Ink, x0: number, y0: number, x1: number, y1: number, w: number, p: Pal, a = 1): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(len * 1.5));
  const ux = (x1 - x0) / (len || 1);
  const uy = (y1 - y0) / (len || 1);
  const steps = Math.max(1, Math.ceil(w * 2));
  for (let i = 0; i <= n; i++) {
    const cx = x0 + ((x1 - x0) * i) / n;
    const cy = y0 + ((y1 - y0) * i) / n;
    for (let j = -steps; j <= steps; j++) {
      const o = (j / steps) * w;
      ink.put(cx - uy * o, cy + ux * o, shade(p, Math.abs(o) / (w || 1)), a);
    }
  }
}

/** A four-pointed glint: long arms up/down/left/right and short diagonals. */
export function star(ink: Ink, x: number, y: number, s: number, p: Pal, a = 1): void {
  ink.put(x, y, p.core, a);
  for (let i = 1; i <= s; i++) {
    const c = shade(p, i / (s + 1));
    ink.put(x + i, y, c, a);
    ink.put(x - i, y, c, a);
    ink.put(x, y + i, c, a);
    ink.put(x, y - i, c, a);
  }
  for (let i = 1; i <= Math.floor(s / 2.5); i++) {
    const c = shade(p, 0.4 + i / (s + 1));
    ink.put(x + i, y + i, c, a);
    ink.put(x - i, y + i, c, a);
    ink.put(x + i, y - i, c, a);
    ink.put(x - i, y - i, c, a);
  }
}

/** A jagged bolt of lightning from one point to another; a new `seed` each frame makes it crackle. */
export function bolt(ink: Ink, x0: number, y0: number, x1: number, y1: number, p: Pal, seed: number, a = 1, jag = 0.5): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, Math.round(len / 7));
  const nx = -(y1 - y0) / (len || 1);
  const ny = (x1 - x0) / (len || 1);
  let px = x0;
  let py = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const off = i === n ? 0 : (hash(i, seed, 3) - 0.5) * jag * (len / n) * 2;
    const qx = x0 + (x1 - x0) * t + nx * off;
    const qy = y0 + (y1 - y0) * t + ny * off;
    line(ink, px + 1, py, qx + 1, qy, p.mid, a * 0.9);
    line(ink, px - 1, py, qx - 1, qy, p.deep, a * 0.8);
    line(ink, px, py, qx, qy, p.core, a);
    px = qx;
    py = qy;
  }
}

/** A column of light standing on (x, yBase), `h` tall, `w` px either side: tapered and dithered away towards the top. */
export function column(ink: Ink, x: number, yBase: number, h: number, w: number, p: Pal, a = 1, t = 0): void {
  for (let dy = 0; dy < h; dy++) {
    const up = dy / h;
    const fade = a * (1 - up * up);
    const ww = w * (0.55 + 0.45 * Math.sqrt(1 - up)) * (1 + 0.12 * Math.sin(t * 0.03 + dy * 0.35));
    const y = Math.round(yBase - dy);
    for (let dx = -Math.ceil(ww); dx <= Math.ceil(ww); dx++) {
      const u = Math.abs(dx) / (ww || 1);
      if (u > 1) continue;
      const xx = Math.round(x + dx);
      if (u > 0.6 && dither(xx, y) >= fade) continue;
      ink.put(xx, y, shade(p, u), Math.min(1, fade * 1.4));
    }
  }
}

/**
 * A magic circle on the ground: two rings, a turning band of ticks, and a
 * hexagram turning the other way inside.
 */
export function rune(ink: Ink, cx: number, cy: number, r: number, rot: number, p: Pal, a = 1, sq = GROUND): void {
  if (r < 3 || a <= 0) return;
  circle(ink, cx, cy, r, p.hot, a, sq);
  circle(ink, cx, cy, r * 0.8, p.mid, a * 0.9, sq);
  const ticks = r > 18 ? 16 : 8;
  for (let i = 0; i < ticks; i++) {
    const th = rot + (i / ticks) * Math.PI * 2;
    const c = Math.cos(th);
    const s = Math.sin(th) * sq;
    if (i % 4 === 0) {
      const mx = cx + c * r * 0.9;
      const my = cy + s * r * 0.9;
      ink.put(mx, my, p.core, a);
      ink.put(mx + 1, my, p.hot, a);
      ink.put(mx - 1, my, p.hot, a);
      ink.put(mx, my - 1, p.hot, a);
      ink.put(mx, my + 1, p.hot, a);
    } else line(ink, cx + c * r * 0.83, cy + s * r * 0.83, cx + c * r * 0.97, cy + s * r * 0.97, p.mid, a * 0.9);
  }
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const th = -rot * 1.3 + (i / 6) * Math.PI * 2;
    pts.push([cx + Math.cos(th) * r * 0.72, cy + Math.sin(th) * r * 0.72 * sq]);
  }
  for (let i = 0; i < 6; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 2) % 6];
    line(ink, x0, y0, x1, y1, p.deep, a * 0.85);
  }
  circle(ink, cx, cy, r * 0.3, p.mid, a * 0.7, sq);
}

/** Strike everything standing inside a circle on the ground; returns who was struck. */
export function strikeGround(world: WorldScene, x: number, y: number, r: number, s: Strike, skip?: Set<Hurtbox>): Hurtbox[] {
  const hit = world.hurtboxesWhere((h) => h.alive && !skip?.has(h) && onGround(h, x, y, r));
  for (const h of hit) h.hurt({ damage: s.damage, heavy: !!s.heavy, knock: s.knock ?? (s.heavy ? 130 : 60), fromX: s.fromX ?? x, fromY: s.fromY ?? y - 4, poison: s.poison });
  return hit;
}

let flares = 0;
/** A brief flash of real light that swells and fades. Few at once: the renderer only has so many lights. */
export function flare(world: WorldScene, x: number, y: number, radius: number, color: number, intensity: number, ms: number): void {
  if (flares >= 4) return;
  flares++;
  const light = world.lights.addLight(x, y, radius * 0.6, color, intensity);
  world.tweens.add({
    targets: light,
    intensity: 0,
    radius,
    duration: ms,
    ease: 'Quad.easeOut',
    onComplete: () => {
      world.lights.removeLight(light);
      flares--;
    },
  });
}

/** A soft additive glow that swells and fades away. */
export function bloom(world: WorldScene, x: number, y: number, tint: number, scale: number, ms: number, depth: number, alpha = 0.9): void {
  const img = world.add.image(Math.round(x), Math.round(y), 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(scale * 0.5).setAlpha(alpha).setDepth(depth);
  world.tweens.add({ targets: img, scale, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
}

/**
 * The base of every Special's effect: a clock, a lifetime, and the parts it
 * owns, all destroyed with it. `step` runs each frame with the time so far.
 */
export abstract class Fx implements Effect {
  dead = false;
  protected t = 0;
  private parts: { destroy(): void }[] = [];

  constructor(
    protected world: WorldScene,
    protected life: number,
  ) {}

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    this.step(dt);
    if (this.t >= this.life) this.destroy();
  }

  protected abstract step(dt: number): void;

  protected own<T extends { destroy(): void }>(o: T): T {
    this.parts.push(o);
    return o;
  }

  protected ink(w: number, h: number): Ink {
    return this.own(new Ink(this.world, w, h));
  }

  protected light(x: number, y: number, radius: number, color: number, intensity: number): Phaser.GameObjects.Light {
    const l = this.world.lights.addLight(x, y, radius, color, intensity);
    this.own({ destroy: () => this.world.lights.removeLight(l) });
    return l;
  }

  protected halo(tint: number, scale: number, depth: number): Phaser.GameObjects.Image {
    return this.own(this.world.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(scale).setDepth(depth));
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const p of this.parts) p.destroy();
    this.parts = [];
  }
}

/** Drag a body toward (x, y) at `speed` px/s (bosses and anything pinned stay put). */
export function drag(h: Hurtbox, x: number, y: number, speed: number, dt: number): void {
  const m = h as Hurtbox & { shove?(dx: number, dy: number): void };
  const dx = x - h.x;
  const dy = y - h.y;
  const d = Math.hypot(dx, dy);
  if (d < 3 || !m.shove) return;
  const s = Math.min(d - 2, (speed * dt) / 1000);
  m.shove((dx / d) * s, (dy / d) * s);
}

/** Distance from (px, py) to the segment (x0, y0)-(x1, y1). */
export function segDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const vx = x1 - x0;
  const vy = y1 - y0;
  const t = clamp01(((px - x0) * vx + (py - y0) * vy) / (vx * vx + vy * vy || 1));
  return Math.hypot(px - (x0 + vx * t), py - (y0 + vy * t));
}
