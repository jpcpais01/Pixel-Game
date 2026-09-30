// The game mode menu's three windows, each a small painted scene:
//
// - Arenas: Aurendel at golden hour. A road winds from the meadow up to the
//   Rune Temple on its hill, a lone hero walking it; the Shardspine peaks
//   stand in the haze behind and the Floating Island hangs in the sky.
// - Home: a cottage at blue hour. Warm windows, a hipped tile roof, smoke
//   from the chimney, a cherry tree in bloom and a pond holding the moon.
// - Auto Battle: a floating stone board in the starry void, your blue squad
//   (seen from behind) facing the red one across the glowing midline, a
//   blade clash, a fireball and an arrow in flight.
//
// Painted like the Hall of Legends: every pixel gets a material and a light
// level, and the level picks a colour from that material's ramp with an
// ordered dither between steps. What glows (sun, windows, runes, eyes, the
// fireball) goes into its own layer, drawn additively so the menu can pulse
// it. Each window is painted larger than it is ever shown and cropped to fit.

import { hex, type RGB } from './pixel';
import { Bitmap, bayer, clamp01 } from './bitmap';

export interface ModeArt {
  /** The lit scene. */
  base: Bitmap;
  /** What glows, for an additive layer over it. */
  glow: Bitmap;
  /** The spot the crop keeps centred, and how far down the crop sits (0 top, 1 bottom). */
  focusX: number;
  focusY: number;
  /** Points of interest for the menu's live touches (chimney, clash...). */
  spots: Record<string, [number, number]>;
}

export const ARENAS_SIZE = { w: 400, h: 240 };
export const SIDE_SIZE = { w: 260, h: 150 };

const ramp = (...c: string[]) => c.map(hex);

const SKY = 1;
const CLOUD = 2;
const MOUNT = 3;
const SNOW = 4;
const GRASS = 5;
const LEAF = 6;
const STONE = 7;
const SAND = 8;
const WOOD = 9;
const NIGHT = 10;
const HILL = 11;
const NGRASS = 12;
const PLASTER = 13;
const ROOF = 14;
const CHERRY = 15;
const WATER = 16;
const VOID = 17;
const BLUE = 18;
const RED = 19;
const MOON = 20;
const FLOWER = 21;
const CLOTH = 22;

/** Colour ramps per material, darkest first. */
const RAMPS: RGB[][] = [];
RAMPS[SKY] = ramp('#1a1238', '#2a1a4e', '#46246a', '#6e3278', '#a04a7c', '#d06a78', '#f09270', '#ffc07a', '#ffe8b0');
RAMPS[CLOUD] = ramp('#2a1a4a', '#43285e', '#673a72', '#94507c', '#c46a7e', '#e88a7a', '#fbb27a', '#ffd79a', '#fff2d0');
RAMPS[MOUNT] = ramp('#1c1a3e', '#2a2650', '#3a3262', '#4e4272', '#685682', '#866c92', '#a888a2', '#ccaab4', '#f0d4c8');
RAMPS[SNOW] = ramp('#3a3262', '#54487a', '#72628e', '#9282a4', '#b4a2b8', '#d4bcc4', '#ecd2cc', '#fbe4d4', '#fff6ec');
RAMPS[GRASS] = ramp('#10180f', '#1a2a17', '#27401f', '#385a28', '#4f7530', '#6e8f38', '#96a844', '#c4bf5c', '#f0d88a');
RAMPS[LEAF] = ramp('#07080c', '#0e1216', '#15201c', '#1e2e22', '#2a3e28', '#3e5230', '#5c6a38', '#8a8444', '#c8a458');
RAMPS[STONE] = ramp('#1a1420', '#2a2030', '#3c2e3e', '#54404c', '#70565a', '#907068', '#b48e7a', '#d8b494', '#f8dcb8');
RAMPS[SAND] = ramp('#1e1418', '#33221e', '#4c3426', '#6a4a30', '#8c643c', '#b08248', '#d0a45e', '#ecc882', '#fff0c0');
RAMPS[WOOD] = ramp('#0e0808', '#1c100e', '#2c1a14', '#40261a', '#563422', '#6e462c', '#8a5c38', '#aa7848', '#cc9c64');
RAMPS[NIGHT] = ramp('#0a0a1e', '#12122e', '#1a1a40', '#262452', '#363064', '#4e3c72', '#6e4c7c', '#9a6280', '#d8887c');
RAMPS[HILL] = ramp('#080a18', '#0e1224', '#141a30', '#1c243e', '#26304c', '#323e5a', '#424e68', '#566278', '#6e788a');
RAMPS[NGRASS] = ramp('#0a120f', '#0f1a16', '#15241c', '#1c3022', '#243e28', '#2e4e2e', '#3e6034', '#5a7a3c', '#86984c');
RAMPS[PLASTER] = ramp('#1a1620', '#2a2430', '#3e3440', '#564852', '#726064', '#907a74', '#b09888', '#d0bca4', '#f0e0c8');
RAMPS[ROOF] = ramp('#1a0e14', '#2c141c', '#461c22', '#642628', '#84342e', '#a44a36', '#c46a46', '#e09060', '#f6c08a');
RAMPS[CHERRY] = ramp('#1e0e1c', '#321428', '#4e1e3a', '#6e2a4c', '#92405e', '#b85c74', '#d8808c', '#f0aab0', '#ffd8dc');
RAMPS[WATER] = ramp('#060a1a', '#0a1228', '#101c38', '#182848', '#22385a', '#30506e', '#467084', '#6a98a0', '#a8d0c8');
RAMPS[VOID] = ramp('#05040c', '#0a0818', '#120e26', '#1c1436', '#281c48', '#38265a', '#4c326c', '#684284', '#9058a0');
RAMPS[BLUE] = ramp('#0c1020', '#141a34', '#1c2648', '#26345e', '#324474', '#42588a', '#5a72a0', '#7c92b8', '#aab8d4');
RAMPS[RED] = ramp('#1a0c14', '#2a1220', '#40182a', '#582036', '#722a42', '#8e3a50', '#ac5262', '#c8747a', '#e4a4a0');
RAMPS[MOON] = ramp('#3a3a5a', '#54547a', '#707096', '#8e8eae', '#aaaac4', '#c4c4d6', '#dcdce6', '#eeeef4', '#ffffff');
RAMPS[FLOWER] = ramp('#2a0e1e', '#4a1430', '#742044', '#a0325a', '#c84e6e', '#e8708a', '#f89aa8', '#ffc4c8', '#fff0e8');
RAMPS[CLOTH] = ramp('#16060d', '#290b17', '#431221', '#641a2c', '#8c2634', '#b53c3c', '#dd6446', '#f79a66', '#ffd3a0');

function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** Smooth 1D value noise, 0..1. */
function noise(x: number, s: number): number {
  const i = Math.floor(x);
  const t = x - i;
  const u = t * t * (3 - 2 * t);
  const a = hash(i, 0, s);
  return a + (hash(i + 1, 0, s) - a) * u;
}

/** Smooth 2D value noise, 0..1. */
function noise2(x: number, y: number, s: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s);
  const b = hash(ix + 1, iy, s);
  const c = hash(ix, iy + 1, s);
  const d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

const fbm = (x: number, y: number, s: number) => noise2(x, y, s) * 0.55 + noise2(x * 2.1, y * 2.1, s + 1) * 0.3 + noise2(x * 4.3, y * 4.3, s + 2) * 0.15;

/** Per-pixel material and light, plus a glow layer, resolved to colours at the end. */
class Paint {
  readonly mat: Uint8Array;
  readonly lum: Float32Array;
  /** Additive glow, linear RGB 0..255 (can pile up; clamped when resolved). */
  readonly gl: Float32Array;
  /** Pixels set straight to a colour after the ramps (the little figures). */
  readonly over: Bitmap;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.mat = new Uint8Array(w * h);
    this.lum = new Float32Array(w * h);
    this.gl = new Float32Array(w * h * 3);
    this.over = new Bitmap(w, h);
  }

  put(x: number, y: number, m: number, l: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.mat[i] = m;
    this.lum[i] = l;
  }

  /** Shift the light already at a pixel. */
  shade(x: number, y: number, d: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.lum[y * this.w + x] += d;
  }

  lumAt(x: number, y: number): number {
    x = Math.max(0, Math.min(this.w - 1, Math.floor(x)));
    y = Math.max(0, Math.min(this.h - 1, Math.floor(y)));
    return this.lum[y * this.w + x];
  }

  /** Fill every pixel of a box where `inside` holds, lit by `l`. */
  fill(x0: number, y0: number, x1: number, y1: number, m: number, l: (x: number, y: number) => number, inside?: (x: number, y: number) => boolean): void {
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(this.w - 1, Math.ceil(x1)); x++) {
        if (!inside || inside(x, y)) this.put(x, y, m, l(x, y));
      }
    }
  }

  glow(x: number, y: number, c: RGB, a: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = (y * this.w + x) * 3;
    this.gl[i] += c[0] * a;
    this.gl[i + 1] += c[1] * a;
    this.gl[i + 2] += c[2] * a;
  }

  /** A soft round glow, strongest at the middle. */
  halo(cx: number, cy: number, r: number, c: RGB, a: number, sy = 1): void {
    for (let y = Math.floor(cy - r * sy); y <= Math.ceil(cy + r * sy); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot((x + 0.5 - cx) / r, (y + 0.5 - cy) / (r * sy));
        if (d < 1) this.glow(x, y, c, a * (1 - d) * (1 - d));
      }
    }
  }

  /** Set a pixel straight to a colour, over the painted scene. */
  ink(x: number, y: number, c: RGB): void {
    this.over.set(x, y, c);
  }

  resolve(): { base: Bitmap; glow: Bitmap } {
    const base = new Bitmap(this.w, this.h);
    const glow = new Bitmap(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const o = this.over.alpha(x, y);
        if (o) {
          const j = i * 4;
          base.set(x, y, [this.over.data[j], this.over.data[j + 1], this.over.data[j + 2]]);
        } else {
          const r = RAMPS[this.mat[i]] ?? RAMPS[SKY];
          const v = clamp01(this.lum[i]) * (r.length - 1) + (bayer(x, y) - 0.5) * 0.9;
          base.set(x, y, r[Math.max(0, Math.min(r.length - 1, Math.round(v)))]);
        }
        const g = i * 3;
        const gr = this.gl[g];
        const gg = this.gl[g + 1];
        const gb = this.gl[g + 2];
        if (gr + gg + gb > 3) {
          // Dither the glow's faint edge so it fades in steps like everything else.
          const k = Math.max(gr, gg, gb);
          if (k < 40 && bayer(x, y) * 40 > k) continue;
          glow.set(x, y, [Math.min(255, gr), Math.min(255, gg), Math.min(255, gb)]);
        }
      }
    }
    return { base, glow };
  }
}

/** Is (x, y) inside the polygon? */
function inPoly(pts: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * A crown of leaf clumps: discs unioned into a mask, shaded dark with a bright
 * rim on the side facing the light (`lx`, `ly`: a unit step toward it) and a
 * scatter of lighter leaf clusters.
 */
function crown(p: Paint, clumps: [number, number, number][], m: number, base: number, rim: number, lx: number, ly: number, seed: number): void {
  const x0 = Math.min(...clumps.map((c) => c[0] - c[2]));
  const x1 = Math.max(...clumps.map((c) => c[0] + c[2]));
  const y0 = Math.min(...clumps.map((c) => c[1] - c[2]));
  const y1 = Math.max(...clumps.map((c) => c[1] + c[2]));
  const within = (x: number, y: number) => {
    for (const [cx, cy, r] of clumps) {
      // A ragged edge, so the crown reads as leaves rather than circles.
      const rr = r - hash(x, y, seed) * 1.6;
      if ((x - cx) ** 2 + (y - cy) ** 2 < rr * rr) return true;
    }
    return false;
  };
  for (let y = Math.floor(y0); y <= y1; y++) {
    for (let x = Math.floor(x0); x <= x1; x++) {
      if (!within(x, y)) continue;
      let l = base + (noise2(x / 4, y / 4, seed) - 0.5) * 0.14;
      if (!within(x + lx * 2, y + ly * 2)) l = rim;
      else if (!within(x + lx * 4, y + ly * 4)) l = base + (rim - base) * 0.55;
      // Lit leaf clusters on the side toward the light.
      if (noise2(x / 3, y / 3, seed + 5) > 0.72 && within(x + lx * 5, y + ly * 5) === false) l += 0.12;
      p.put(x, y, m, l);
    }
  }
}

// ---------------------------------------------------------------- Arenas

export function paintArenas(): ModeArt {
  const { w: W, h: H } = ARENAS_SIZE;
  const p = new Paint(W, H);
  const sun: [number, number] = [292, 112];
  const HORIZON = 150;
  const sunLight = (x: number, y: number) => {
    const d = Math.hypot(x - sun[0], (y - sun[1]) * 1.4);
    return 0.45 * Math.exp(-d / 60) + 0.3 * Math.exp(-d / 14);
  };

  // Sky: violet overhead down to a peach and gold horizon, brightest round the sun.
  p.fill(0, 0, W - 1, HORIZON + 10, SKY, (x, y) => 0.06 + 0.72 * Math.pow(y / HORIZON, 1.5) + sunLight(x, y));
  for (let y = sun[1] - 9; y <= sun[1] + 9; y++) {
    for (let x = sun[0] - 9; x <= sun[0] + 9; x++) {
      if (Math.hypot(x + 0.5 - sun[0], y + 0.5 - sun[1]) < 8.5) p.put(x, y, SKY, 1);
    }
  }
  p.halo(sun[0], sun[1], 70, hex('#ff9a50'), 0.55, 0.7);
  p.halo(sun[0], sun[1], 16, hex('#fff0c0'), 0.9);

  // Long sunset clouds with flat, sunlit undersides.
  const bands: [number, number, number][] = [
    [34, 1, 0.7],
    [58, 2, 0.85],
    [86, 3, 1],
    [104, 4, 0.8],
  ];
  for (const [yc, s, k] of bands) {
    for (let x = 0; x < W; x++) {
      const prof = noise(x / 38 + s * 7, s) * 0.6 + noise(x / 12 + s * 3, s + 10) * 0.4;
      const th = (prof - 0.46) * 34 * k;
      if (th <= 0.5) continue;
      // Puffed tops over a flat, sunlit base.
      const top = yc - th * 0.8 - noise(x / 5 + s * 11, s + 20) * th * 0.35;
      const bot = yc + Math.min(3, th * 0.3);
      const near = Math.exp(-Math.abs(x - sun[0]) / 110);
      for (let y = Math.floor(top); y <= Math.ceil(bot); y++) {
        const f = (y - top) / Math.max(1, bot - top);
        let l = 0.18 + (yc / HORIZON) * 0.4 + f * 0.25 + near * 0.3;
        if (y >= Math.ceil(bot) - 1) l += 0.18 + near * 0.2;
        // Wispy ends: thin clouds dither away.
        if (th < 3 && bayer(x, y) > th / 3) continue;
        p.put(x, y, CLOUD, l);
      }
    }
  }

  // Birds, far off.
  for (const [bx, by] of [
    [236, 72],
    [245, 67],
    [228, 66],
  ] as const) {
    p.put(bx - 1, by - 1, MOUNT, 0.12);
    p.put(bx, by, MOUNT, 0.12);
    p.put(bx + 1, by - 1, MOUNT, 0.12);
  }

  // The Floating Island, hung in the sky, spilling a thin waterfall.
  const isl: [number, number] = [84, 64];
  for (let y = isl[1] - 3; y <= isl[1] + 30; y++) {
    const f = (y - isl[1]) / 30;
    const half = f < 0 ? 20 * Math.sqrt(1 - (f * 10) ** 2 / 9) : 21 * (1 - f) ** 1.3 + (noise(y / 3, 21) - 0.5) * 3;
    for (let x = Math.floor(isl[0] - half); x <= isl[0] + half; x++) {
      const side = (x - isl[0]) / Math.max(1, half);
      if (y <= isl[1]) p.put(x, y, GRASS, 0.42 + side * 0.15 + (y === isl[1] - 3 ? 0.1 : 0));
      else if (y <= isl[1] + 1) p.put(x, y, GRASS, 0.3 + side * 0.1);
      else p.put(x, y, STONE, 0.28 + side * 0.22 - f * 0.12 + (hash(x, y, 22) - 0.5) * 0.08);
    }
  }
  crown(p, [[76, isl[1] - 7, 5], [80, isl[1] - 10, 4], [72, isl[1] - 6, 3]], LEAF, 0.2, 0.55, 1, 0.3, 30);
  p.fill(77, isl[1] - 4, 77, isl[1] - 2, WOOD, () => 0.3);
  const fall = 38;
  for (let y = 0; y < fall; y++) {
    const fy = isl[1] + 2 + y;
    const fade = y / fall;
    for (let dx = 0; dx < 2; dx++) {
      if (bayer(99 + dx, fy) > 1 - fade) continue;
      p.put(99 + dx, fy, SNOW, 0.75 - fade * 0.3);
    }
  }
  p.halo(100, isl[1] + fall, 8, hex('#c0a8e0'), 0.25, 0.6);

  // The Shardspine peaks in the haze, snow on their sunward faces.
  const ridge1 = (x: number) => 134 - 30 * noise(x / 64, 1) - 11 * noise(x / 21, 2) - 4 * noise(x / 7, 3);
  for (let x = 0; x < W; x++) {
    const r = ridge1(x);
    const slope = ridge1(x + 2) - ridge1(x - 2);
    const lit = clamp01(slope / 5);
    for (let y = Math.floor(r); y <= HORIZON + 4; y++) {
      const depth = (y - r) / 40;
      const snowLine = r + Math.max(0, (116 - r) * 0.55) + noise(x / 3, 9) * 2;
      if (r < 116 && y < snowLine) p.put(x, y, SNOW, 0.42 + lit * 0.45 - depth * 0.2);
      else p.put(x, y, MOUNT, 0.46 + lit * 0.2 - depth * 0.14 + sunLight(x, y) * 0.3);
    }
  }
  const ridge2 = (x: number) => 148 - 14 * noise(x / 44, 4) - 6 * noise(x / 13, 5);
  for (let x = 0; x < W; x++) {
    const r = ridge2(x);
    const lit = clamp01((ridge2(x + 2) - ridge2(x - 2)) / 4);
    for (let y = Math.floor(r); y <= HORIZON + 8; y++) p.put(x, y, MOUNT, 0.27 + lit * 0.14 - (y - r) * 0.004 + sunLight(x, y) * 0.2);
  }

  // Rolling ground with the temple's hill in the middle; warmer toward the sun and brighter up close.
  const hill = (x: number) => 156 - 13 * Math.exp(-(((x - 210) / 62) ** 2)) - 3 * noise(x / 26, 6);
  for (let x = 0; x < W; x++) {
    const top = hill(x);
    for (let y = Math.floor(top); y < H; y++) {
      const near = (y - 150) / 90;
      let l = 0.36 + 0.24 * Math.exp(-(((x - sun[0]) / 150) ** 2)) * (1 - near * 0.5) + near * 0.1;
      if (y - top < 1.5) l += 0.2;
      else if (y - top < 3) l += 0.08;
      // Swells of the meadow and grass streaks.
      l += (fbm(x / 40, y / 10, 7) - 0.5) * 0.22;
      l += (hash(x, Math.floor(y / 2), 8) - 0.5) * 0.12;
      p.put(x, y, GRASS, l);
    }
  }

  // The road, winding from the meadow to the temple steps.
  const TX = 210;
  const roadAt = (y: number) => {
    const t = (y - 146) / (H - 146);
    return { t, cx: TX - 36 * Math.sin(t * 2.5) * t + 8 * t, half: 5 + 40 * Math.pow(t, 1.6) };
  };
  for (let y = 146; y < H; y++) {
    const { t, cx, half } = roadAt(y);
    for (let x = Math.floor(cx - half - 1); x <= cx + half + 1; x++) {
      const e = half - Math.abs(x - cx);
      if (e < -0.5) continue;
      if (e < 0.8) {
        p.shade(x, y, -0.14);
        continue;
      }
      let l = 0.5 + (1 - t) * 0.12 + (noise2(x / 5, y / 3, 11) - 0.5) * 0.14;
      // Two worn ruts.
      const rut = Math.abs(Math.abs(x - cx) - half * 0.42);
      if (rut < 0.8 + t) l -= 0.1;
      if (e < 1.8) l -= 0.08;
      p.put(x, y, SAND, l);
      if (e < 2.2 && hash(x, y, 12) > 0.93) p.put(x, y, STONE, 0.62);
    }
  }

  // The Rune Temple: three steps, five columns, a frieze of runes and a pediment.
  const GY = 147;
  const steps = [66, 58, 50];
  steps.forEach((sw, i) => {
    const y1 = GY - i * 3;
    const y0 = y1 - 2;
    p.fill(TX - sw / 2, y0, TX + sw / 2, y1, STONE, (x, y) => (y === y0 ? 0.72 : 0.46) + ((x - TX) / sw) * 0.25);
  });
  const floor = GY - 9;
  p.fill(TX - 23, floor - 19, TX + 23, floor, STONE, (x, y) => 0.12 + (y - (floor - 19)) * 0.004 + (x > TX ? 0.02 : 0));
  // The doorway, lit from within.
  p.fill(TX - 4, floor - 12, TX + 4, floor, STONE, () => 0.05);
  for (let y = floor - 14; y <= floor; y++) {
    for (let x = TX - 5; x <= TX + 5; x++) {
      const arch = y < floor - 11 && Math.hypot(x - TX, (y - (floor - 11)) * 1.6) > 5;
      if (!arch && Math.abs(x - TX) === 5) p.put(x, y, STONE, 0.4);
    }
  }
  p.halo(TX, floor - 6, 11, hex('#a070ff'), 0.7);
  p.halo(TX, floor - 5, 4, hex('#d8c0ff'), 0.9);
  for (const cx of [TX - 20, TX - 11, TX + 11, TX + 20]) {
    p.fill(cx - 2, floor - 17, cx + 2, floor - 1, STONE, (x) => [0.36, 0.5, 0.62, 0.74, 0.66][x - (cx - 2)]);
    p.fill(cx - 3, floor - 19, cx + 3, floor - 18, STONE, (x, y) => (y === floor - 19 ? 0.78 : 0.56) + (x - cx) * 0.02);
    p.fill(cx - 3, floor - 1, cx + 3, floor, STONE, (x) => 0.55 + (x - cx) * 0.03);
  }
  const ent = floor - 23;
  p.fill(TX - 27, ent, TX + 27, ent + 3, STONE, (x, y) => (y === ent ? 0.8 : y === ent + 3 ? 0.38 : 0.6) + (x - TX) * 0.002);
  for (let x = TX - 24; x <= TX + 24; x += 4) {
    p.put(x, ent + 1, STONE, 0.3);
    p.glow(x, ent + 1, hex('#8a5aff'), 0.9);
    p.glow(x, ent + 2, hex('#8a5aff'), 0.35);
  }
  const apex = ent - 12;
  p.fill(TX - 29, apex, TX + 29, ent - 1, STONE, (x, y) => {
    const edge = Math.abs(x - TX) > (y - apex) * 2.35 - 1.5;
    return edge ? 0.84 : x > TX ? 0.64 : 0.5;
  }, (x, y) => Math.abs(x - TX) <= (y - apex) * 2.4);
  p.put(TX, apex - 1, STONE, 0.9);
  p.halo(TX, apex + 5, 3, hex('#c8a0ff'), 1);
  // A faint pillar of rune light rising from the roof.
  for (let y = apex - 2; y > 18; y--) {
    const f = (apex - y) / (apex - 18);
    for (let dx = -2; dx <= 2; dx++) p.glow(TX + dx, y, hex('#7a58e0'), (1 - f) * (1 - f) * (dx === 0 ? 0.45 : Math.abs(dx) === 1 ? 0.25 : 0.1));
  }
  // Braziers either side of the steps.
  for (const bx of [TX - 38, TX + 38]) {
    p.fill(bx - 1, GY - 7, bx + 1, GY, STONE, (x) => 0.4 + (x - bx) * 0.12);
    p.fill(bx - 2, GY - 9, bx + 2, GY - 8, STONE, (x) => 0.55 + (x - bx) * 0.05);
    p.halo(bx, GY - 11, 6, hex('#ff8a30'), 0.9);
    p.halo(bx, GY - 11, 2, hex('#fff0a0'), 1);
  }

  // A waymarker with a lantern beside the road.
  const wx = 150;
  const wy = 204;
  p.fill(wx, wy - 18, wx + 1, wy, WOOD, (x) => (x === wx ? 0.32 : 0.52));
  p.fill(wx - 1, wy - 18, wx + 5, wy - 17, WOOD, (_x, y) => (y === wy - 18 ? 0.6 : 0.4));
  p.fill(wx + 4, wy - 16, wx + 6, wy - 12, WOOD, (x) => (x === wx + 6 ? 0.5 : 0.25));
  p.fill(wx + 5, wy - 15, wx + 5, wy - 13, SKY, () => 1);
  p.halo(wx + 5, wy - 14, 9, hex('#ffa040'), 0.8);
  p.halo(wx + 5, wy - 14, 2, hex('#fff0b0'), 1);
  for (let x = wx - 5; x <= wx + 6; x++) p.shade(x, wy + 1, -0.12);

  // The hero on the road, walking toward the temple: cloak, hood and a blade on the back, rim-lit by the sun.
  const hx = 194;
  const hy = 216;
  for (let x = hx - 9; x <= hx + 1; x++) for (let y = hy; y <= hy + 1; y++) p.shade(x - (y - hy), y, -0.16);
  const hero = [
    '...kk...',
    '..kHHk..',
    '..kHHh..',
    '.kCCCCk.',
    'kCCCCCck',
    'kCCCCCck',
    '.kCCCck.',
    '.kCCCck.',
    '.kccccr.',
    '..kbkbr.',
    '..kbkbk.',
  ];
  const HC: Record<string, RGB> = {
    k: hex('#140c14'),
    H: hex('#3a2230'),
    h: hex('#f0b070'),
    C: hex('#6a2030'),
    c: hex('#4a1422'),
    r: hex('#f6a060'),
    b: hex('#2a1a1c'),
  };
  hero.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && p.ink(hx - 4 + x, hy - 11 + y, HC[ch])));
  // The sword over the shoulder.
  for (let i = 0; i < 6; i++) p.ink(hx + 3 - Math.floor(i / 2), hy - 13 + i, hex(i < 2 ? '#fff4d6' : '#b8b0c0'));
  p.ink(hx + 3, hy - 7, hex('#c07f30'));

  // Trees framing the view, dark against the sky, their sunward edges lit.
  const trunk = (x: number, top: number, wd: number, lit: 1 | -1) => {
    for (let y = top; y < H; y++) {
      const flare = y > H - 14 ? (y - (H - 14)) * 0.35 : 0;
      for (let dx = -wd - flare; dx <= wd + flare; dx++) p.put(x + dx, y, WOOD, 0.14 + (dx * lit > wd * 0.4 ? 0.3 : 0) + hash(x + dx, y, 40) * 0.05);
    }
  };
  trunk(16, 60, 4, 1);
  for (let i = 0; i < 16; i++) p.put(20 + i, 92 - i * 0.9, WOOD, 0.2 + (i % 3 === 0 ? 0.2 : 0));
  crown(p, [[0, 16, 28], [28, 8, 22], [50, 24, 15], [12, 50, 20], [36, 44, 14], [60, 6, 13], [4, 78, 12]], LEAF, 0.1, 0.58, 1, 0.2, 41);
  trunk(388, 66, 4, -1);
  for (let i = 0; i < 14; i++) p.put(384 - i, 96 - i * 0.9, WOOD, 0.2 + (i % 3 === 0 ? 0.2 : 0));
  crown(p, [[400, 20, 28], [372, 12, 20], [350, 30, 14], [388, 54, 18], [364, 50, 12], [398, 82, 12]], LEAF, 0.1, 0.5, -1, 0.3, 42);
  // Undergrowth at the corners.
  crown(p, [[6, 226, 18], [30, 234, 14], [48, 238, 8]], LEAF, 0.14, 0.52, 1, -0.4, 43);
  crown(p, [[396, 222, 20], [372, 234, 14], [356, 240, 8]], LEAF, 0.14, 0.46, -1, -0.4, 44);

  // Grass tufts and wildflowers in the near meadow.
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(hash(i, 1, 50) * W);
    const y = Math.floor(165 + hash(i, 2, 50) ** 0.7 * (H - 168));
    const r = roadAt(y);
    if (Math.abs(x - r.cx) < r.half + 3) continue;
    const tall = 1 + Math.floor(((y - 160) / 80) * 3);
    for (let k = 0; k < tall; k++) p.put(x, y - k, GRASS, 0.62 + k * 0.08);
    if (hash(i, 3, 50) > 0.8) {
      p.put(x, y - tall, FLOWER, hash(i, 4, 50) > 0.5 ? 0.78 : 0.95);
    }
  }

  const { base, glow } = p.resolve();
  return { base, glow, focusX: TX - 6, focusY: 0.72, spots: { sun, temple: [TX, floor - 6], beam: [TX, apex], lantern: [wx + 5, wy - 14] } };
}

// ---------------------------------------------------------------- Home

export function paintHome(): ModeArt {
  const { w: W, h: H } = SIDE_SIZE;
  const p = new Paint(W, H);
  const GROUND = 100;

  // Blue hour: deep indigo overhead, a last warm band along the hills.
  p.fill(0, 0, W - 1, GROUND + 4, NIGHT, (x, y) => 0.04 + 0.8 * Math.pow(y / GROUND, 2.1) + (noise2(x / 50, y / 12, 60) - 0.5) * 0.08);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash(i, 1, 61) * W);
    const y = Math.floor(hash(i, 2, 61) ** 1.5 * 62);
    const a = 0.3 + hash(i, 3, 61) * 0.7;
    p.glow(x, y, hex('#e8e0ff'), a);
    if (a > 0.9) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.glow(x + dx, y + dy, hex('#9080d0'), 0.35);
    }
  }
  // A crescent moon.
  const moon: [number, number] = [44, 24];
  for (let y = moon[1] - 8; y <= moon[1] + 8; y++) {
    for (let x = moon[0] - 8; x <= moon[0] + 8; x++) {
      const d = Math.hypot(x + 0.5 - moon[0], y + 0.5 - moon[1]);
      const bite = Math.hypot(x + 0.5 - moon[0] - 4, y + 0.5 - moon[1] + 2);
      if (d < 7.5 && bite > 6.5) p.put(x, y, MOON, 0.7 + (moon[0] - x) * 0.04 + (noise2(x / 2, y / 2, 62) - 0.5) * 0.15);
    }
  }
  p.halo(moon[0], moon[1], 26, hex('#8878d0'), 0.35);

  // Far hills and a line of pines along them.
  const hills = (x: number) => 90 - 9 * noise(x / 40, 63) - 4 * noise(x / 13, 64);
  for (let x = 0; x < W; x++) for (let y = Math.floor(hills(x)); y <= GROUND + 2; y++) p.put(x, y, HILL, 0.36 - (y - hills(x)) * 0.012);
  for (let i = 0; i < 26; i++) {
    const px = Math.floor(hash(i, 1, 65) * W);
    const ph = 6 + hash(i, 2, 65) * 9;
    const base = hills(px) + 6;
    for (let y = 0; y < ph; y++) {
      const half = (y / ph) * 3.2;
      for (let dx = -Math.floor(half); dx <= half; dx++) p.put(px + dx, base - ph + y, HILL, 0.16 + (dx < 0 ? 0.05 : 0));
    }
  }

  // The garden: grass that picks up the windows' warm light.
  const CX = 132;
  const WALL_TOP = 96;
  const FOOT = 116;
  const warmth = (x: number, y: number) => Math.exp(-(((x - CX) / 40) ** 2) - (((y - 120) / 12) ** 2));
  p.fill(0, GROUND, W - 1, H - 1, NGRASS, (x, y) => 0.28 + (y - GROUND) * 0.0035 + (fbm(x / 30, y / 8, 66) - 0.5) * 0.2 + (hash(x, Math.floor(y / 2), 67) - 0.5) * 0.1 + warmth(x, y) * 0.18);

  // A pond holding the moon.
  const pond: [number, number] = [214, 134];
  const inPond = (x: number, y: number) => ((x - pond[0]) / 26) ** 2 + ((y - pond[1]) / 7.5) ** 2 < 1;
  p.fill(pond[0] - 27, pond[1] - 8, pond[0] + 27, pond[1] + 8, WATER, (x, y) => {
    const edge = ((x - pond[0]) / 26) ** 2 + ((y - pond[1]) / 7.5) ** 2;
    let l = 0.22 + (y - pond[1]) * 0.012 + (edge > 0.75 ? -0.1 : 0);
    if (Math.sin(x * 0.7 + y * 3.1) > 0.93) l += 0.16;
    return l;
  }, inPond);
  for (let y = pond[1] - 5; y <= pond[1] + 6; y++) {
    for (let x = pond[0] - 18; x <= pond[0] - 12; x++) {
      if (!inPond(x, y)) continue;
      const k = 1 - Math.abs(x - (pond[0] - 15)) / 3.5;
      if (k > 0 && bayer(x, y) < k * (0.9 - Math.abs(y - pond[1]) * 0.08)) p.glow(x, y, hex('#b8b0e8'), 0.55);
    }
  }
  for (let i = 0; i < 12; i++) {
    const rx = pond[0] - 26 + Math.floor(hash(i, 1, 68) * 52);
    const onEdge = pond[1] - 7.5 * Math.sqrt(Math.max(0, 1 - ((rx - pond[0]) / 26) ** 2));
    const rh = 3 + Math.floor(hash(i, 2, 68) * 5);
    for (let k = 0; k < rh; k++) p.put(rx + (k > 3 ? 1 : 0), onEdge - k, NGRASS, 0.42 + k * 0.04);
    if (hash(i, 3, 68) > 0.6) p.put(rx + 1, onEdge - rh, WOOD, 0.45);
  }

  // Stepping stones from the door down the garden.
  for (let i = 0; i < 6; i++) {
    const sy = FOOT + 3 + i * 5.5 + i * i * 0.3;
    const sx = CX + Math.sin(i * 0.9) * 4;
    const rx = 3 + i * 0.5;
    p.fill(sx - rx, sy - 2, sx + rx, sy + 2, STONE, (x, y) => 0.3 + (y < sy ? 0.14 : 0) + warmth(x, y) * 0.22 - (x - sx) * 0.02, (x, y) => ((x - sx) / rx) ** 2 + ((y - sy) / 1.8) ** 2 < 1);
  }

  // The cottage.
  // Stone footing.
  p.fill(CX - 28, FOOT - 4, CX + 28, FOOT, STONE, (x, y) => {
    const course = Math.floor((y - (FOOT - 4)) / 2);
    const seam = (x + course * 3) % 6 === 0 || (y - (FOOT - 4)) % 2 === 1;
    return 0.34 - (x - CX) * 0.003 + (seam ? -0.1 : 0) + hash(Math.floor((x + course * 3) / 6), course, 70) * 0.08;
  });
  // Plaster walls in a timber frame, lit a little by the moon on the left.
  p.fill(CX - 27, WALL_TOP, CX + 27, FOOT - 5, PLASTER, (x, y) => 0.44 - (x - CX) * 0.004 + (noise2(x / 3, y / 3, 71) - 0.5) * 0.06 + (y < WALL_TOP + 2 ? -0.18 : 0));
  const beams = [CX - 27, CX - 14, CX - 1, CX + 13, CX + 26];
  for (const bx of beams) p.fill(bx, WALL_TOP, bx + 1, FOOT - 5, WOOD, (x) => (x === bx ? 0.3 : 0.2));
  p.fill(CX - 27, WALL_TOP + 7, CX + 27, WALL_TOP + 7, WOOD, () => 0.28);
  // Braces in the outer panels.
  for (let i = 0; i < 7; i++) {
    p.put(CX - 25 + i * 1.6, WALL_TOP + 8 + i, WOOD, 0.24);
    p.put(CX + 24 - i * 1.6, WALL_TOP + 8 + i, WOOD, 0.24);
  }
  // Two warm windows with cross mullions and sills, and a flowerbox.
  for (const wx of [CX - 21, CX + 5]) {
    const wy = WALL_TOP + 1;
    p.fill(wx - 1, wy - 1, wx + 9, wy + 6, WOOD, () => 0.36);
    for (let y = wy; y <= wy + 5; y++) {
      for (let x = wx; x <= wx + 8; x++) {
        const mull = x === wx + 4 || y === wy + 3;
        if (mull) p.put(x, y, WOOD, 0.2);
        else {
          p.put(x, y, SKY, 0.93 - (y - wy) * 0.03);
          p.glow(x, y, hex('#ff9a40'), 0.35);
        }
      }
    }
    p.fill(wx - 2, wy + 6, wx + 10, wy + 6, WOOD, () => 0.5);
    p.halo(wx + 4, wy + 3, 12, hex('#ff9040'), 0.35);
  }
  for (let x = CX - 22; x <= CX - 12; x++) {
    p.put(x, WALL_TOP + 8, WOOD, 0.32);
    p.put(x, WALL_TOP + 9, WOOD, 0.24);
    if (x % 2 === 0) p.put(x, WALL_TOP + 7, FLOWER, 0.55 + hash(x, 1, 72) * 0.3);
  }
  // The door, arched, with light at its seams and a lantern beside it.
  const door = { x0: CX + 17, x1: CX + 23, y0: WALL_TOP + 3, y1: FOOT - 1 };
  p.fill(door.x0 - 1, door.y0 - 1, door.x1 + 1, door.y1, WOOD, (x, y) => {
    if (x === door.x0 - 1 || x === door.x1 + 1 || y === door.y0 - 1) return 0.4;
    return 0.26 + ((x - door.x0) % 2 === 0 ? 0.04 : 0) + (y > door.y1 - 3 ? 0.03 : 0);
  }, (x, y) => !(y === door.y0 - 1 && (x === door.x0 - 1 || x === door.x1 + 1)));
  for (let y = door.y0; y <= door.y1; y++) p.glow(door.x1, y, hex('#ffb050'), 0.5);
  p.put(door.x0 + 1, (door.y0 + door.y1) / 2, SKY, 0.85);
  p.halo(door.x0 - 4, door.y0 + 1, 10, hex('#ff9a40'), 0.6);
  p.halo(door.x0 - 4, door.y0 + 1, 2, hex('#fff0b0'), 1);
  p.fill(door.x0 - 5, door.y0 - 1, door.x0 - 3, door.y0 + 2, WOOD, (x) => (x === door.x0 - 4 ? 0.2 : 0.35));
  p.fill(door.x0 - 4, door.y0, door.x0 - 4, door.y0 + 1, SKY, () => 1);
  // Light spilling onto the grass.
  p.halo(CX - 17, FOOT + 5, 16, hex('#ff8a30'), 0.22, 0.35);
  p.halo(CX + 20, FOOT + 5, 14, hex('#ff8a30'), 0.25, 0.4);

  // The hipped roof, seen from above and in front: back slope, two hips, front slope; tiles in rows.
  const E = { l: CX - 34, r: CX + 34, t: 64, b: WALL_TOP };
  const RIDGE = { y: 78, l: CX - 14, r: CX + 14 };
  const front: [number, number][] = [[E.l, E.b], [E.r, E.b], [RIDGE.r, RIDGE.y], [RIDGE.l, RIDGE.y]];
  const back: [number, number][] = [[E.l + 4, E.t], [E.r - 4, E.t], [RIDGE.r, RIDGE.y], [RIDGE.l, RIDGE.y]];
  const hipL: [number, number][] = [[E.l + 4, E.t], [RIDGE.l, RIDGE.y], [E.l, E.b]];
  const hipR: [number, number][] = [[E.r - 4, E.t], [RIDGE.r, RIDGE.y], [E.r, E.b]];
  const faces: [typeof front, number, number][] = [
    [back, 0.46, 3],
    [hipL, 0.6, 3],
    [hipR, 0.22, 3],
    [front, 0.38, 3],
  ];
  for (const [poly, l, row] of faces) {
    p.fill(E.l, E.t, E.r, E.b, ROOF, (x, y) => {
      let v = l + (hash(Math.floor(x / 5 + Math.floor(y / row) * 0.5), Math.floor(y / row), 73) - 0.5) * 0.08;
      if (y % row === row - 1) v -= 0.12;
      if ((x + (Math.floor(y / row) % 2) * 3) % 6 === 0) v -= 0.06;
      return v;
    }, (x, y) => inPoly(poly, x + 0.5, y + 0.5));
  }
  // Ridge and hip lines catch the moonlight; the eave's edge is dark with a shadow on the wall.
  for (let x = RIDGE.l; x <= RIDGE.r; x++) p.put(x, RIDGE.y, ROOF, 0.66);
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    p.put(RIDGE.l + (E.l - RIDGE.l) * t, RIDGE.y + (E.b - RIDGE.y) * t, ROOF, 0.7);
    p.put(RIDGE.l + (E.l + 4 - RIDGE.l) * t, RIDGE.y + (E.t - RIDGE.y) * t, ROOF, 0.72);
    p.put(RIDGE.r + (E.r - RIDGE.r) * t, RIDGE.y + (E.b - RIDGE.y) * t, ROOF, 0.34);
    p.put(RIDGE.r + (E.r - 4 - RIDGE.r) * t, RIDGE.y + (E.t - RIDGE.y) * t, ROOF, 0.4);
  }
  for (let x = E.l; x <= E.r; x++) p.put(x, E.b, ROOF, 0.2);
  // The chimney on the back slope.
  const ch = { x: CX + 16, y: 56 };
  p.fill(ch.x, ch.y, ch.x + 6, ch.y + 16, STONE, (x, y) => {
    const course = Math.floor((y - ch.y) / 2);
    const seam = (y - ch.y) % 2 === 1 || (x + course * 2) % 4 === 0;
    return (x < ch.x + 4 ? 0.4 : 0.24) + (seam ? -0.08 : 0);
  });
  p.fill(ch.x - 1, ch.y - 1, ch.x + 7, ch.y, STONE, (_x, y) => (y === ch.y - 1 ? 0.56 : 0.34));
  p.halo(ch.x + 3, ch.y - 2, 4, hex('#ff7020'), 0.35);

  // A cherry tree in bloom on the left, and a bush on the right.
  const tx = 64;
  for (let y = 86; y <= FOOT + 2; y++) {
    const wd = y > FOOT - 3 ? 3 : 2;
    for (let dx = -wd; dx <= wd - 1; dx++) p.put(tx + dx + Math.round(Math.sin(y * 0.2) * 0.6), y, WOOD, 0.2 + (dx < 0 ? 0.14 : 0));
  }
  for (let i = 0; i < 10; i++) {
    p.put(tx - 1 - i, 88 - i * 0.7, WOOD, 0.3);
    p.put(tx + 1 + i * 0.8, 86 - i, WOOD, 0.24);
  }
  crown(p, [[64, 72, 15], [48, 78, 10], [80, 76, 11], [58, 60, 10], [74, 62, 9], [88, 82, 6], [42, 86, 6]], CHERRY, 0.34, 0.8, -0.7, -0.7, 74);
  for (let i = 0; i < 16; i++) {
    const fx = 34 + hash(i, 1, 75) * 70;
    const fy = FOOT + 2 + hash(i, 2, 75) * 18;
    p.put(fx, fy, CHERRY, 0.7);
  }
  crown(p, [[196, 110, 9], [208, 112, 7], [186, 114, 6], [214, 116, 5]], NGRASS, 0.24, 0.5, -0.7, -0.7, 76);

  // A picket fence along the garden's front, open for the path.
  const fenceY = 128;
  for (let x = 20; x < 250; x++) {
    if (Math.abs(x - CX) < 9 || inPond(x, fenceY + 2) || (x > 180 && x < 244)) continue;
    const post = x % 4 === 0;
    if (post) {
      for (let y = fenceY - 7; y <= fenceY; y++) p.put(x, y, WOOD, y === fenceY - 7 ? 0.62 : 0.46);
      p.shade(x + 1, fenceY + 1, -0.1);
    }
    if (!post) {
      p.put(x, fenceY - 5, WOOD, 0.36);
      p.put(x, fenceY - 2, WOOD, 0.32);
    }
  }
  // A lamp at the garden gate.
  const lamp: [number, number] = [CX - 12, 124];
  p.fill(lamp[0], lamp[1] - 14, lamp[0], lamp[1], WOOD, () => 0.3);
  p.fill(lamp[0] - 1, lamp[1] - 17, lamp[0] + 1, lamp[1] - 15, SKY, () => 1);
  p.halo(lamp[0], lamp[1] - 16, 12, hex('#ffa040'), 0.6);
  p.halo(lamp[0], lamp[1] - 16, 2, hex('#fff4c0'), 1);
  p.halo(lamp[0], lamp[1] + 2, 12, hex('#ff8a30'), 0.18, 0.35);

  const { base, glow } = p.resolve();
  return { base, glow, focusX: CX - 6, focusY: 0.6, spots: { chimney: [ch.x + 3, ch.y - 2], bush: [200, 110], pond, tree: [64, 72] } };
}

// ---------------------------------------------------------------- Auto Battle

/** Figures for the board: blue ones from behind, red ones facing us. */
const UNITS: Record<string, { rows: string[]; ink: Record<string, string>; glow?: string }> = {
  knight: {
    rows: [
      '...ooo.....',
      '..oSSso..o.',
      '.oSSssso.wo',
      '.osGGGso.wo',
      'oSoBBBosowo',
      'oSBBBBbsoho',
      '.oBBBBbo.o.',
      '.oBBBBbo...',
      '.oBBbBbo...',
      '.obBbbbo...',
      '..oso.so...',
      '..oo..oo...',
    ],
    ink: { o: '#0c0a14', S: '#c8d0e4', s: '#7a82a0', G: '#e8b84a', B: '#4a74d8', b: '#2a4296', w: '#fff4d6', h: '#8a5a2a' },
  },
  mage: {
    rows: [
      '.*....o....',
      '*#*..oPo...',
      '.*..oPPpo..',
      '.h.oPPPPpo.',
      '.hoGGGGGGo.',
      '.hoRRRRRro.',
      '.hRRRRRRro.',
      '.hoRRRRRro.',
      '.hoRRrRRro.',
      '.hRRRRrRrro',
      '.hoRRRRRro.',
      '..oooooooo.',
    ],
    ink: { o: '#0c0a14', P: '#3a4aa8', p: '#222c70', G: '#e8b84a', R: '#3a60c8', r: '#223a80', h: '#8a5a2a', '*': '#a8f0ff', '#': '#ffffff' },
    glow: '*#',
  },
  archer: {
    rows: [
      '...ooo..o..',
      '..oHHho.oo.',
      '.oHHHhho.o.',
      '.oHHHHho.bo',
      'oGoTTTohobo',
      'oTTTTTTtobo',
      '.oTTTTto.bo',
      '.oTTqTto.o.',
      '.oTTTTto...',
      '.otTttto...',
      '..obo.bo...',
      '..oo..oo...',
    ],
    ink: { o: '#0c0a14', H: '#2e8a6a', h: '#1a5a48', G: '#e8b84a', T: '#3a6ac0', t: '#243e84', q: '#8a5a2a', b: '#c89a58' },
  },
  brute: {
    rows: [
      'o.........o',
      'Wo.oooo..oW',
      '.WoRRRRo.W.',
      '..oR*R*Ro..',
      '.oRRRRRRRo.',
      'oRRrmmmrRRo',
      'oRRrrrrrRRoc',
      'oRoRRRRRoRcc',
      '.o.RRrRR.occ',
      '..oRRRRRo.c.',
      '..oRo.oRo...',
      '..ooo.ooo...',
    ],
    ink: { o: '#0c0a14', W: '#e8dcc0', R: '#c83a3a', r: '#80202a', m: '#3a1418', '*': '#ffd040', c: '#6a4428' },
    glow: '*',
  },
  skull: {
    rows: [
      '...ooooo...',
      '..oWWWWWo..',
      '..oW*W*Wo..',
      '..oWWmWWo..',
      '...owmwo...',
      '.o.oWWWo.o.',
      'owoWwWwWoso',
      '.o.oWWWo.so',
      '...oWwWo.so',
      '...oWoWo.o.',
      '...oWoWo...',
      '...oo.oo...',
    ],
    ink: { o: '#0c0a14', W: '#e0d8c8', w: '#8a8078', m: '#2a1a20', '*': '#ff3a4a', s: '#b8b0c0' },
    glow: '*',
  },
  shaman: {
    rows: [
      '.....ooo..o.',
      '....oRRRo*#*',
      '...oRr*r*oo*',
      '...oRmmmRoh.',
      '..oRRRRRRRoh',
      '.oRRGGGGGRoh',
      '.oRRRRRRRRoh',
      '.oRrRRRRrRoh',
      '.oRRRrRRRRoh',
      '.orRRRRRRro.',
      '..oRRRRRRo..',
      '..oooooooo..',
    ],
    ink: { o: '#0c0a14', R: '#a0283a', r: '#621826', m: '#1a0a10', G: '#e8b84a', h: '#6a4428', '*': '#ff7a30', '#': '#fff0a0' },
    glow: '*#',
  },
};

export function paintAuto(): ModeArt {
  const { w: W, h: H } = SIDE_SIZE;
  const p = new Paint(W, H);

  // The void: a starry dark with violet nebula drifting across it.
  p.fill(0, 0, W - 1, H - 1, VOID, (x, y) => {
    const band = Math.exp(-(((y - 40 - x * 0.18) / 38) ** 2));
    return 0.1 + fbm(x / 60, y / 34, 80) * 0.26 * (0.4 + band) + band * 0.12;
  });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const teal = fbm(x / 44 + 3, y / 26, 81);
      if (teal > 0.6) p.glow(x, y, hex('#2a8aa8'), (teal - 0.6) * 0.8);
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(hash(i, 1, 82) * W);
    const y = Math.floor(hash(i, 2, 82) * H);
    const a = 0.25 + hash(i, 3, 82) * 0.75;
    p.glow(x, y, hash(i, 4, 82) > 0.7 ? hex('#ffd0f0') : hex('#d8e4ff'), a);
  }

  // The board: a trapezoid in perspective, 7 columns by 4 rows, red across the far half and blue on the near.
  const TOP = 50;
  const BOT = 104;
  const COLS = 6;
  const ROWS = 4;
  const edgeL = (y: number) => 86 - ((y - TOP) / (BOT - TOP)) * 34;
  const edgeR = (y: number) => 174 + ((y - TOP) / (BOT - TOP)) * 34;
  // Rows grow toward us: y = TOP + (BOT-TOP) * (0.7u + 0.3u^2).
  const rowOf = (y: number) => {
    const f = (y - TOP) / (BOT - TOP);
    return (-0.7 + Math.sqrt(0.49 + 1.2 * f)) / 0.6;
  };
  const yOfRow = (u: number) => TOP + (BOT - TOP) * (0.7 * u + 0.3 * u * u);
  const cell = (c: number, r: number): [number, number] => {
    const y = yOfRow((r + 0.62) / ROWS);
    const l = edgeL(y);
    const rr = edgeR(y);
    return [l + ((c + 0.5) / COLS) * (rr - l), y];
  };
  for (let y = TOP; y <= BOT; y++) {
    const u = rowOf(y) * ROWS;
    const row = Math.min(ROWS - 1, Math.floor(u));
    const l = edgeL(y);
    const r = edgeR(y);
    for (let x = Math.ceil(l); x <= r; x++) {
      const v = ((x - l) / (r - l)) * COLS;
      const col = Math.min(COLS - 1, Math.floor(v));
      const m = row < 2 ? RED : BLUE;
      let lum = (col + row) % 2 ? 0.46 : 0.58;
      lum += (1 - (y - TOP) / (BOT - TOP)) * -0.08 + (hash(x, y, 83) - 0.5) * 0.06;
      // Grout between the tiles.
      const fx = v - Math.floor(v);
      const fy = u - Math.floor(u);
      const px = (r - l) / COLS;
      if (fx * px < 0.9 || fy < 0.07) lum -= 0.22;
      if (fy < 0.14 && fy >= 0.07) lum += 0.1;
      // The board's rim.
      if (x - l < 1.5 || r - x < 1.5 || y === TOP) lum = 0.72;
      p.put(x, y, m, lum);
    }
  }
  // The glowing midline between the halves.
  const midY = Math.round(yOfRow(0.5));
  for (let x = Math.ceil(edgeL(midY)); x <= edgeR(midY); x++) {
    p.glow(x, midY, hex('#ffd060'), 0.9);
    p.glow(x, midY - 1, hex('#ff9a30'), 0.3);
    p.glow(x, midY + 1, hex('#ff9a30'), 0.3);
  }
  // The platform's front face and the rock hanging under it.
  const FACE = 10;
  for (let y = BOT + 1; y <= BOT + FACE; y++) {
    for (let x = Math.ceil(edgeL(BOT)); x <= edgeR(BOT); x++) {
      const seam = (x - 52) % 12 === 0 || y === BOT + 5;
      p.put(x, y, STONE, 0.3 - (y - BOT) * 0.012 + (seam ? -0.1 : 0) + (x > 130 ? -0.04 : 0));
      if (y === BOT + 1) p.put(x, y, STONE, 0.5);
    }
  }
  for (let x = 54; x <= 198; x += 12) {
    p.glow(x + 7, BOT + 5, hex('#40d8ff'), 0.9);
    p.glow(x + 6, BOT + 5, hex('#40d8ff'), 0.35);
    p.glow(x + 8, BOT + 5, hex('#40d8ff'), 0.35);
    p.halo(x + 7, BOT + 5, 4, hex('#2090c0'), 0.3);
  }
  for (let y = BOT + FACE + 1; y < H; y++) {
    const f = (y - BOT - FACE) / 34;
    const half = 80 * (1 - f) ** 1.6 + (noise(y / 2, 84) - 0.5) * 8;
    for (let x = Math.floor(130 - half); x <= 130 + half; x++) {
      p.put(x, y, STONE, 0.16 + (x < 130 ? 0.06 : 0) - f * 0.08 + (hash(x, y, 85) - 0.5) * 0.06);
    }
  }
  for (const [rx, ry, rs] of [
    [34, 124, 4],
    [226, 118, 3],
    [214, 138, 2],
  ] as const) {
    p.fill(rx - rs, ry - rs, rx + rs, ry + rs, STONE, (x, y) => 0.22 + (y < ry ? 0.14 : 0) + (x < rx ? 0.06 : 0), (x, y) => Math.abs(x - rx) + Math.abs(y - ry) * 1.3 <= rs);
  }

  // Crystal pylons at the corners in each side's colour.
  const pylon = (x: number, y: number, c: RGB, m: number) => {
    for (let dy = -12; dy <= 0; dy++) {
      const half = dy < -8 ? (12 + dy) * 0.75 : (-dy) * 0.3 + 1;
      for (let dx = -Math.floor(half); dx <= half; dx++) p.put(x + dx, y + dy, m, 0.7 + (dx < 0 ? 0.2 : -0.1) + (dy < -9 ? 0.1 : 0));
    }
    p.halo(x, y - 7, 10, c, 0.55);
    p.halo(x, y - 8, 2, hex('#ffffff'), 0.6);
  };
  pylon(88, TOP - 1, hex('#ff4060'), RED);
  pylon(172, TOP - 1, hex('#ff4060'), RED);
  pylon(54, BOT - 1, hex('#40a0ff'), BLUE);
  pylon(206, BOT - 1, hex('#40a0ff'), BLUE);

  // The squads.
  const place = (kind: string, c: number, r: number, hp: number, stars: number, blue: boolean) => {
    const u = UNITS[kind];
    const [cx, cy] = cell(c, r);
    const w = u.rows[0].length;
    const h = u.rows.length;
    const x0 = Math.round(cx - w / 2);
    const y0 = Math.round(cy - h + 2);
    for (let dx = -5; dx <= 5; dx++) for (let dy = 0; dy <= 1; dy++) if (Math.abs(dx) < 5 - dy * 2) p.shade(cx + dx, cy + 1 + dy, -0.22);
    u.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const col = hex(u.ink[ch]);
        p.ink(x0 + x, y0 + y, col);
        if (u.glow?.includes(ch)) p.halo(x0 + x + 0.5, y0 + y + 0.5, 3, col, 0.5);
      }),
    );
    // A health bar over each, green for ours and red for theirs, and gold star pips.
    const by = y0 - 4;
    const bx = Math.round(cx - 5);
    for (let x = bx - 1; x <= bx + 10; x++) for (let y = by - 1; y <= by + 2; y++) p.ink(x, y, hex('#0c0a14'));
    const fill = Math.round(hp * 10);
    for (let x = 0; x < 10; x++) {
      p.ink(bx + x, by, hex(x < fill ? (blue ? '#7ae05a' : '#ff5a5a') : '#2a2438'));
      p.ink(bx + x, by + 1, hex(x < fill ? (blue ? '#3a9a30' : '#a82a3a') : '#1c1828'));
    }
    for (let s = 0; s < stars; s++) p.ink(bx + 4 - (stars - 1) + s * 2, by - 2, hex('#ffd060'));
  };
  place('shaman', 4, 0, 0.8, 1, false);
  place('skull', 1, 0, 0.55, 1, false);
  place('brute', 3, 1, 0.45, 2, false);
  place('archer', 4, 3, 0.9, 1, true);
  place('knight', 3, 2, 0.7, 2, true);
  place('mage', 1, 3, 1, 2, true);

  // The clash between knight and brute: a white-gold starburst.
  const [kx, ky] = cell(3, 2);
  const [, by2] = cell(3, 1);
  const clash: [number, number] = [kx + 2, Math.round((ky + by2) / 2) - 8];
  p.halo(clash[0], clash[1], 9, hex('#ffc050'), 0.8);
  for (let i = -5; i <= 5; i++) {
    const a = 1 - Math.abs(i) / 6;
    p.glow(clash[0] + i, clash[1], hex('#fff0c0'), a);
    p.glow(clash[0], clash[1] + i * 0.7, hex('#fff0c0'), a);
    p.glow(clash[0] + i * 0.6, clash[1] + i * 0.6, hex('#ffd080'), a * 0.5);
    p.glow(clash[0] + i * 0.6, clash[1] - i * 0.6, hex('#ffd080'), a * 0.5);
  }
  // A fireball from the mage toward the skeleton, trailing embers.
  const [mx, my] = cell(1, 3);
  const [sx, sy] = cell(1, 0);
  const fb: [number, number] = [mx + (sx - mx) * 0.55 + 2, my - 14 + (sy - my) * 0.55];
  for (let i = 0; i < 16; i++) {
    const t = i / 16;
    const tx = fb[0] - (sx - mx) * 0.02 * i + Math.sin(i * 1.7) * 0.8;
    const ty = fb[1] + i * 1.1;
    if (bayer(Math.round(tx), Math.round(ty)) < 1 - t) p.glow(tx, ty, hex('#ff7020'), 0.9 * (1 - t));
  }
  p.halo(fb[0], fb[1], 7, hex('#ff6010'), 0.9);
  p.halo(fb[0], fb[1], 3, hex('#fff0a0'), 1);
  // An arrow in flight toward the shaman.
  const [ax, ay] = cell(4, 3);
  const arrow: [number, number] = [ax + 3, ay - 30];
  for (let i = 0; i < 7; i++) p.ink(arrow[0], arrow[1] + i, hex(i === 0 ? '#e8e0f0' : '#c89a58'));
  p.ink(arrow[0] - 1, arrow[1] + 6, hex('#e8e0f0'));
  p.ink(arrow[0] + 1, arrow[1] + 6, hex('#e8e0f0'));
  for (let i = 7; i < 13; i++) p.glow(arrow[0], arrow[1] + i, hex('#a0c0ff'), 0.5 * (1 - (i - 7) / 6));

  const { base, glow } = p.resolve();
  return { base, glow, focusX: 130, focusY: 0.8, spots: { clash, fireball: fb, board: [130, (TOP + BOT) / 2] } };
}
