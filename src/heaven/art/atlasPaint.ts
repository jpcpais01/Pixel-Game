// Painting tools shared by the Atlas's art (atlas.ts, atlasIsles.ts): a
// bitmap with a few drawing helpers, noise, dithered ramps, and the cloud
// painter that builds billows out of lit puffs.
//
// The Atlas is lit like the rest of the game, from the top left, but low and
// golden: lit faces go cream and apricot, shade goes rose, then lavender,
// then deep violet, never plain darker copies of a colour.

import { Bitmap, bayer, clamp01, mix } from '../../art/bitmap';
import { hex, type RGB } from '../../art/pixel';
import { hash2, valueNoise } from '../../art/env';

export { bayer, clamp01, mix, hash2, valueNoise, hex };
export type { RGB };

export const ramp = (...c: string[]): RGB[] => c.map(hex);

/** Outline round everything painted on the Atlas: a warm, deep plum, not black. */
export const INK = hex('#26182e');

/** Light on a surface facing (nx, ny) on the picture plane (-1..1), from the top left: about 0..1. */
export const lit = (nx: number, ny: number, base = 0.5): number => base - nx * 0.3 - ny * 0.34 + Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) * 0.12;

/**
 * A step of a ramp for a value 0..1. Dithers only near the boundary between
 * two steps (`spread` 1 dithers the whole way), so flat areas stay clean.
 */
export const tone = (r: RGB[], v: number, x: number, y: number, spread = 0.5): RGB =>
  r[Math.max(0, Math.min(r.length - 1, Math.floor(clamp01(v) * (r.length - 1) + 0.5 + (bayer(x, y) - 0.5) * spread)))];

export function fbm(x: number, y: number, scale: number, seed: number, octaves = 3): number {
  let v = 0;
  let amp = 0.5;
  let s = scale;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    v += valueNoise(x, y, s, seed + i * 31) * amp;
    total += amp;
    amp *= 0.5;
    s *= 0.5;
  }
  return v / total;
}

export const smooth = (a: number, b: number, v: number): number => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Deterministic randomness, so the Atlas looks the same every time. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A bitmap with a few drawing tools. */
export class Art extends Bitmap {
  get(x: number, y: number): RGB {
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }

  /** Lay colour over what's there at strength a (0..1); on empty pixels it becomes that see-through. */
  over(x: number, y: number, c: RGB, a: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const al = this.alpha(x, y);
    if (al === 0) return this.set(x, y, c, Math.round(a * 255));
    this.set(x, y, mix(this.get(x, y), c, Math.min(1, a)), Math.max(al, Math.round(a * 255)));
  }

  /** Darken what's there (k < 1) toward violet, keeping its alpha: shade here is cool, not grey. */
  shade(x: number, y: number, k: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (this.data[i + 3] === 0) return;
    this.data[i] = Math.round(this.data[i] * k * 0.93);
    this.data[i + 1] = Math.round(this.data[i + 1] * k * 0.95);
    this.data[i + 2] = Math.round(this.data[i + 2] * Math.min(1.05, k * 1.08));
  }

  erase(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[(y * this.w + x) * 4 + 3] = 0;
  }

  /** Fill an oval; `fn` gets the pixel and its place on the oval (-1..1 each way), and may skip it. */
  oval(cx: number, cy: number, rx: number, ry: number, fn: (x: number, y: number, nx: number, ny: number) => RGB | null): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const c = fn(x, y, nx, ny);
        if (c) this.set(x, y, c);
      }
    }
  }

  /** Fill a polygon (even-odd); `fn` may skip pixels. */
  poly(pts: [number, number][], fn: (x: number, y: number) => RGB | null): void {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % pts.length];
        if (y1 <= yc !== y2 <= yc) xs.push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
          const c = fn(x, y);
          if (c) this.set(x, y, c);
        }
      }
    }
  }

  rect(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number, u: number, v: number) => RGB | null): void {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const c = fn(x, y, (x - x0) / Math.max(1, x1 - x0), (y - y0) / Math.max(1, y1 - y0));
        if (c) this.set(x, y, c);
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const n = Math.max(Math.abs(Math.round(x1) - Math.round(x0)), Math.abs(Math.round(y1) - Math.round(y0)), 1);
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  }

  /** A rim round everything drawn so far; the lit (top/left) side may take a softer colour. */
  outline(c: RGB = INK, lit?: RGB): void {
    const edge: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y) > 0) continue;
        const r = this.alpha(x + 1, y) > 128;
        const d = this.alpha(x, y + 1) > 128;
        const l = this.alpha(x - 1, y) > 128;
        const u = this.alpha(x, y - 1) > 128;
        if (r || d || l || u) edge.push(x, y, lit && (r || d) && !l && !u ? 1 : 0);
      }
    }
    for (let i = 0; i < edge.length; i += 3) this.set(edge[i], edge[i + 1], edge[i + 2] && lit ? lit : c);
  }

  /** Draw another bitmap over this one at (ox, oy). */
  stamp(src: Bitmap, ox: number, oy: number, alpha = 1): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const a = src.alpha(x, y);
        if (a === 0) continue;
        const i = (y * src.w + x) * 4;
        const c: RGB = [src.data[i], src.data[i + 1], src.data[i + 2]];
        if (a === 255 && alpha >= 1) this.set(ox + x, oy + y, c);
        else this.over(ox + x, oy + y, c, (a / 255) * alpha);
      }
    }
  }
}

/** A small piece drawn in its own box with a rim, then stamped where it stands: (x, y) is the box's top left. */
export function piece(a: Art, x: number, y: number, w: number, h: number, draw: (p: Art) => void, rim: RGB = INK, rimLit?: RGB): void {
  const p = new Art(w + 2, h + 2);
  draw(p);
  p.outline(rim, rimLit);
  a.stamp(p, x - 1, y - 1);
}

/** A soft shadow on what's already painted: an oval, darkest in the middle. */
export function softShadow(a: Art, cx: number, cy: number, rx: number, ry: number, k = 0.72): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      // Two steps, the outer one dithered, so the edge is soft but still pixels.
      if (d < 0.45) a.shade(x, y, k);
      else if (bayer(x, y) > (d - 0.45) / 0.55) a.shade(x, y, (k + 1) / 2);
    }
  }
}

// ---------------------------------------------------------------- Clouds

/** Golden-hour cloud: deep violet hollows, lavender, rose, apricot, cream tops. */
export const CLOUD = ramp('#33295a', '#45376e', '#5a4682', '#745796', '#9168a2', '#b07aa8', '#cc8ea8', '#e2a4a4', '#f0bca0', '#f8d2a6', '#fde6bc', '#fff4dc');
/** The same cloud lit by the night over Starwatch. */
export const MOON_CLOUD = ramp('#141436', '#1a1a44', '#222454', '#2c2f66', '#383c78', '#464c8a', '#565e9c', '#6a72ac', '#8088bc', '#9aa0cc', '#b8bcdc', '#d8daee');

/** One round billow of a cloud: where it is, its size, and how high it stands (0..1: higher is lighter). */
export interface Puff {
  x: number;
  y: number;
  r: number;
  alt: number;
  /** 0..1: how much its shading is flattened toward its middle tone (low billows read softer). */
  soft?: number;
}

/** Cloud billows are a little flatter than round, as clouds are seen from above at a slant. */
export const PUFF_SQUASH = 0.78;

/**
 * Paint billows back to front, each a lit dome with a fluffy edge, so the
 * ones in front cover the ones behind and their sunny tops stand out against
 * the shade beneath. `colour` turns a light value into a pixel (and may skip it).
 */
export function paintPuffs(a: Art, puffs: Puff[], seed: number, colour: (v: number, x: number, y: number) => RGB | null): void {
  const sorted = puffs.slice().sort((p, q) => p.y + p.r * 0.3 - (q.y + q.r * 0.3));
  for (const p of sorted) paintPuff(a, p, seed, colour);
}

export function paintPuff(a: Art, p: Puff, seed: number, colour: (v: number, x: number, y: number) => RGB | null): void {
  const ry = p.r * PUFF_SQUASH;
  const x0 = Math.max(0, Math.floor(p.x - p.r - 1));
  const x1 = Math.min(a.w - 1, Math.ceil(p.x + p.r + 1));
  const y0 = Math.max(0, Math.floor(p.y - ry - 1));
  const y1 = Math.min(a.h - 1, Math.ceil(p.y + ry + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - p.x) / p.r;
      const dy = (y + 0.5 - p.y) / ry;
      const d2 = dx * dx + dy * dy;
      // A fluffy rim: the edge wavers a little, more on the big billows.
      const edge = 0.9 + 0.2 * valueNoise(x, y, p.r > 10 ? 3 : 2, seed);
      if (d2 > edge * edge) continue;
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d2)));
      let v = 0.14 + (-dx * 0.42 - dy * 0.55 + nz * 0.5) * 0.5 + p.alt * 0.42;
      // A rim of sun on the side toward the light, and a darker belly away from it.
      if (d2 > 0.62 && dx + dy * 1.2 < -0.55) v += 0.1;
      if (d2 > 0.55 && dy > 0.35) v -= 0.07;
      if (p.soft) v = v * (1 - p.soft) + (0.3 + p.alt * 0.42) * p.soft;
      const c = colour(v, x, y);
      if (c) a.set(x, y, c);
    }
  }
}

/**
 * A heap of cloud (a cumulus seen from above): billows biggest and highest in
 * the middle, smaller and lower round the edge.
 */
export function heapPuffs(cx: number, cy: number, size: number, alt: number, rand: () => number, count = Math.round(size / 2.6)): Puff[] {
  const out: Puff[] = [];
  for (let i = 0; i < count; i++) {
    const ang = rand() * Math.PI * 2;
    const k = Math.sqrt(rand());
    const d = size * 0.9 * k;
    const r = size * (0.3 + rand() * 0.22) * (1 - k * 0.45);
    out.push({ x: cx + Math.cos(ang) * d, y: cy + Math.sin(ang) * d * 0.5 - (1 - k) * size * 0.28, r: Math.max(2.5, r), alt: alt + (1 - k) * 0.28 });
  }
  return out;
}

/** A soft round glow, white in dithered steps, for additive light. */
export function glowArt(size: number): Art {
  const a = new Art(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
      if (d >= 1) continue;
      const v = Math.pow(1 - d, 1.8);
      const q = Math.floor(v * 5 + bayer(x, y)) / 5;
      if (q > 0) a.set(x, y, [255, 255, 255], Math.round(q * 255));
    }
  }
  return a;
}
