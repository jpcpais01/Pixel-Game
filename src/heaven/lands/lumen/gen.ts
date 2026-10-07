// Lumen Meadow, grown: an endless rolling meadow under a wide sky. Tall soft
// grass going gold in patches, drifts of wildflowers, streams winding through
// with glowing water, worn footpaths that come and go, willows hung with
// lantern fruit, giant old glow-mushrooms, boulders split by crystal veins,
// a bench or a little shrine by the path, and now and then a ring of
// standing stones humming with light. Everything is a function of the fixed
// seed and the position (see ../types.ts).
//
// The big, smooth fields (the land's rolls, where the streams and paths run,
// the gold patches, the wind's lean) are worked out on a 4 px lattice and
// kept (`point`), and each pixel blends its four corners and adds only its
// own small noise: the blades of grass, ripples, dither. Streams and paths
// are contours of noise, kept as signed distances in px (the noise's value
// over its slope), so they stay the same width however the noise bends.
//
// No Phaser here: the land worker and scripts/lands.ts grow it too.

import { hash2, valueNoise } from '../../../art/env';
import { bayer, smooth } from '../paint';
import { CHUNK, LAND_MID, type ChunkLayout, type GroundCell, type LandGen, type LandGround, type LandLight, type LandProp, type LifeSpot, type TileFields } from '../types';
import { K, LUMEN_KINDS } from './palette';

/** The one Lumen Meadow everyone walks. */
export const LUMEN_SEED = 77213;

// ---------------------------------------------------------------- the land's shape (px)

/** The lattice the smooth fields are worked out on, and how many of its points are kept. */
const LAT = 4;
const CACHE = 1 << 14;
/** The rolls of the land: long swells and smaller hummocks (height units, see GroundCell). */
const ROLL_SCALE = 380;
const ROLL_AMP = 26;
const HUMMOCK_SCALE = 120;
const HUMMOCK_AMP = 7;
/** Streams: the noise they follow, how much it is warped (so they meander), their half width (at least, plus up to). */
const STREAM_SCALE = 620;
const STREAM_FINE = 210;
const WARP_SCALE = 280;
const WARP = 200;
const STREAM_HALF: [number, number] = [4.5, 5.5];
/** The banks: damp earth this far past the water, and lush clover further out. */
const BANK = 2.5;
const LUSH = 12;
/** How deep (height units) a stream lies below the meadow round it, and how far out the dip reaches. */
const VALLEY = 4;
const VALLEY_W = 30;
/** Feet may wade this far into the water from its edge (px). */
const WADE = 1.5;
/** Footpaths: the noise they follow, where they show (their mask's threshold) and their widest half width. */
const PATH_SCALE = 440;
const PATH_MASK_SCALE = 900;
const PATH_FROM = 0.44;
const PATH_HALF = 3.6;
/** Gold grass where its field passes this (with a dithered edge). */
const GOLD_AT = 0.67;

// ---------------------------------------------------------------- flowers

/** Flowers in the ground: one may stand in each cell of this grid (px). */
const FLOWER_CELL = 4;
/** Where drifts of flowers bloom, and how thick they get there; and the odd stray anywhere. */
const BLOOM_SCALE = 280;
const DRIFT_SCALE = 150;
const DRIFT_DENSITY = 0.82;
const STRAYS = 0.05;
/** Glowmoss specks in the grass (chance per pixel-ish cell). */
const SPECKS = 0.022;

/** The flower kinds drifts are made of, in the order of their noise fields. */
const SPECIES = [K.Bluebell, K.Moonpetal, K.Lavender, K.Buttercup, K.Campion, K.Clock] as const;
export type Species = (typeof SPECIES)[number];

// ---------------------------------------------------------------- what stands

/** Big things stand one at most to a cell of their own grid (px), so they never crowd. */
const WILLOW_CELL = 184;
const SHROOM_CELL = 152;
const ROCK_CELL = 136;
/** Their chances in a cell, and how much more in their groves. */
const WILLOW_ODDS = 0.14;
const WILLOW_GROVE = 0.55;
const SHROOM_ODDS = 0.08;
const SHROOM_GROVE = 0.6;
const ROCK_ODDS = 0.16;
/** The small things' grid (px). */
const SMALL = 24;
/** Chances of a tuft of long grass in a small cell, between swathes and added within them. */
const LONG_GRASS: [number, number] = [0.08, 0.6];
/** The stone circle: one may stand in each cell of this grid (px), at these odds, this wide (px to its stones). */
const CIRCLE_CELL = 1200;
const CIRCLE_ODDS = 0.3;
const CIRCLE_R = 62;
/** How flat a circle looks from above (its ry over rx). */
const SQUASH = 0.78;
/** The standing stones round it. */
const CIRCLE_STONES = 8;
/** A bench, a shrine by a path: the chance a chunk has one. */
const BENCH_ODDS = 0.3;
const SHRINE_ODDS = 0.18;

/** The lights: lantern fruit in a willow, a shrine's lamp, the circle's heart, a glowcap's gills. */
const WILLOW_LIGHT: Omit<LandLight, 'x' | 'y'> = { radius: 72, color: 0xffb860, intensity: 0.85, day: 0, flicker: 0.12, halo: 0.32 };
const SHRINE_LIGHT: Omit<LandLight, 'x' | 'y'> = { radius: 60, color: 0xffd48a, intensity: 1, day: 0, flicker: 0.35, halo: 0.5 };
const CIRCLE_LIGHT: Omit<LandLight, 'x' | 'y'> = { radius: 130, color: 0x9c84ff, intensity: 1.1, day: 0.1, flicker: 0.08, halo: 0.45 };
const SHROOM_LIGHT: Omit<LandLight, 'x' | 'y'> = { radius: 80, color: 0x4ee0d6, intensity: 0.8, day: 0, flicker: 0.05, halo: 0.3 };

/**
 * Value noise without its grid: the mean of two copies turned against each
 * other, stretched back to full contrast. Plain value noise lines its edges up
 * with the axes, which shows in big soft fields (gold patches, drifts).
 */
export function softNoise(x: number, y: number, scale: number, seed: number): number {
  const a = valueNoise(x * 0.8 + y * 0.6, y * 0.8 - x * 0.6, scale, seed);
  const b = valueNoise(x * 0.28 - y * 0.96, x * 0.96 + y * 0.28, scale * 0.9, seed + 7919);
  const v = 0.5 + (a + b - 1) * 0.85;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** A big thing's spot: where, and which of its looks. */
interface Big {
  x: number;
  y: number;
  v: number;
}

export interface Circle {
  x: number;
  y: number;
  seed: number;
}

export class LumenGen implements LandGen {
  readonly seed = LUMEN_SEED;
  readonly ground: LandGround;
  // The lattice: which point each slot holds, and its fields.
  private lx = new Int32Array(CACHE).fill(-0x7fffffff);
  private ly = new Int32Array(CACHE);
  private fSd = new Float32Array(CACHE);
  private fSw = new Float32Array(CACHE);
  private fTd = new Float32Array(CACHE);
  private fTm = new Float32Array(CACHE);
  private fH = new Float32Array(CACHE);
  private fGold = new Float32Array(CACHE);
  private fWind = new Float32Array(CACHE);
  private circles = new Map<number, Circle | null>();
  // The fields at the last pixel sampled.
  /** Signed distance to the nearest stream's middle (px), and its half width there. */
  sd = 0;
  sw = 0;
  /** Signed distance to the nearest path's middle (px), and how much the path shows (0..1). */
  td = 0;
  tm = 0;
  h = 0;
  gold = 0;
  wind = 0;

  constructor() {
    const self = this;
    this.ground = {
      kinds: LUMEN_KINDS,
      cell: (x, y, c) => self.cell(x, y, c),
      decorate: (f) => self.decorate(f),
    };
  }

  /** A well-mixed 0..1 draw for cell (i, j) (the per-pixel hash2 is too lumpy for rare one-offs). */
  private draw(i: number, j: number, salt: number): number {
    let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(j + 0x632be5ab, 0x27d4eb2f) ^ Math.imul(salt + this.seed, 0xc2b2ae35);
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ---------------------------------------------------------------- the smooth fields

  /** The stream noise at (x, y), warped so its contours meander. */
  private streamNoise(x: number, y: number): number {
    const s = this.seed;
    const wx = (valueNoise(x, y, WARP_SCALE, s + 1) - 0.5) * WARP;
    const wy = (valueNoise(x, y, WARP_SCALE, s + 2) - 0.5) * WARP;
    return valueNoise(x + wx, y + wy, STREAM_SCALE, s + 3) * 0.78 + valueNoise(x + wx, y + wy, STREAM_FINE, s + 4) * 0.22;
  }

  private pathNoise(x: number, y: number): number {
    const s = this.seed;
    return valueNoise(x, y, PATH_SCALE, s + 5) * 0.82 + valueNoise(x, y, 140, s + 6) * 0.18;
  }

  /** Signed distance (px) to a noise's 0.5 contour: its value over its slope. */
  private static dist(f: (x: number, y: number) => number, x: number, y: number): number {
    const v = f(x, y);
    const gx = f(x + 1, y) - f(x - 1, y);
    const gy = f(x, y + 1) - f(x, y - 1);
    const g = Math.hypot(gx, gy) * 0.5;
    const d = (v - 0.5) / Math.max(g, 1e-5);
    return d > 400 ? 400 : d < -400 ? -400 : d;
  }

  /** The lattice point (i, j): its slot, worked out on first use. */
  private point(i: number, j: number): number {
    const k = (Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) & (CACHE - 1);
    if (this.lx[k] === i && this.ly[k] === j) return k;
    const x = i * LAT;
    const y = j * LAT;
    const s = this.seed;
    this.lx[k] = i;
    this.ly[k] = j;
    this.fSd[k] = LumenGen.dist((a, b) => this.streamNoise(a, b), x, y);
    this.fSw[k] = STREAM_HALF[0] + valueNoise(x, y, 260, s + 11) * STREAM_HALF[1];
    this.fTd[k] = LumenGen.dist((a, b) => this.pathNoise(a, b), x, y);
    this.fTm[k] = softNoise(x, y, PATH_MASK_SCALE, s + 10);
    this.fH[k] = valueNoise(x, y, ROLL_SCALE, s + 7) * ROLL_AMP + valueNoise(x, y, HUMMOCK_SCALE, s + 8) * HUMMOCK_AMP;
    this.fGold[k] = softNoise(x, y, 260, s + 9) * 0.82 + valueNoise(x, y, 60, s + 12) * 0.18;
    this.fWind[k] = valueNoise(x, y, 330, s + 13);
    return k;
  }

  /** Blend the lattice's fields at (x, y) into this.sd, sw, td, tm, h, gold, wind. */
  sample(x: number, y: number): void {
    const fx = x / LAT;
    const fy = y / LAT;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const a = this.point(i, j);
    const b = this.point(i + 1, j);
    const c = this.point(i, j + 1);
    const d = this.point(i + 1, j + 1);
    const wa = (1 - tx) * (1 - ty);
    const wb = tx * (1 - ty);
    const wc = (1 - tx) * ty;
    const wd = tx * ty;
    const mix = (f: Float32Array) => f[a] * wa + f[b] * wb + f[c] * wc + f[d] * wd;
    this.sd = mix(this.fSd);
    this.sw = mix(this.fSw);
    this.td = mix(this.fTd);
    this.tm = mix(this.fTm);
    this.h = mix(this.fH);
    this.gold = mix(this.fGold);
    this.wind = mix(this.fWind);
  }

  /** How wide the path runs at the last sample (0 where it fades out). */
  private pathHalf(): number {
    return Math.max(0, Math.min(PATH_HALF, (this.tm - PATH_FROM) * 30));
  }

  // ---------------------------------------------------------------- the stone circles

  /** The stone circle of grid cell (i, j), if it has one. */
  circleOf(i: number, j: number): Circle | null {
    const key = i * 4096 + j;
    const had = this.circles.get(key);
    if (had !== undefined) return had;
    let c: Circle | null = null;
    if (this.draw(i, j, 401) < CIRCLE_ODDS) {
      const x = Math.round((i + 0.2 + this.draw(i, j, 402) * 0.6) * CIRCLE_CELL);
      const y = Math.round((j + 0.2 + this.draw(i, j, 403) * 0.6) * CIRCLE_CELL);
      // Never by a stream: the ring wants dry, open ground all round.
      let dry = true;
      for (let k = 0; k < 8 && dry; k++) {
        const a = (k / 8) * Math.PI * 2;
        this.sample(x + Math.cos(a) * (CIRCLE_R + 26), y + Math.sin(a) * (CIRCLE_R + 26) * SQUASH);
        if (Math.abs(this.sd) < this.sw + 24) dry = false;
      }
      this.sample(x, y);
      if (dry && Math.abs(this.sd) > this.sw + 24) c = { x, y, seed: Math.floor(this.draw(i, j, 404) * 1000) };
    }
    if (this.circles.size > 256) this.circles.clear();
    this.circles.set(key, c);
    return c;
  }

  /** The stone circle (x, y) is in or near, and how far out from its middle (in radii of its ring). */
  circleAt(x: number, y: number): { c: Circle; r: number } | null {
    const i = Math.floor(x / CIRCLE_CELL);
    const j = Math.floor(y / CIRCLE_CELL);
    // A circle stands well inside its cell, so only this cell's can reach.
    const c = this.circleOf(i, j);
    if (!c) return null;
    const dx = x - c.x;
    const dy = (y - c.y) / SQUASH;
    if (Math.abs(dx) > CIRCLE_R * 2 || Math.abs(dy) > CIRCLE_R * 2) return null;
    return { c, r: Math.hypot(dx, dy) / CIRCLE_R };
  }

  // ---------------------------------------------------------------- the ground, a pixel at a time

  cell(x: number, y: number, c: GroundCell): void {
    const s = this.seed;
    const near = this.circleAt(x, y);
    if (near && near.r < 1.45 && this.ring(x, y, near.c, near.r, c)) return;

    this.sample(x, y);
    const ad = Math.abs(this.sd);
    const sw = this.sw;
    // The land, with each stream lying a little low in its own shallow valley.
    const dip = 1 - smooth(0, VALLEY_W, ad - sw);
    const ground = this.h - dip * VALLEY;
    const jag = (valueNoise(x, y, 5, s + 31) - 0.5) * 1.6;
    const ph = this.pathHalf();
    const onPath = ph > 0 && Math.abs(this.td) < ph + 3;

    if (ad < sw + jag) {
      // Stepping stones where a path fords a stream.
      if (onPath && Math.abs(this.td) < ph + 1.5 && this.stone(x, y, c, ground)) return;
      // The water: pale at its edges, deeper toward its middle.
      c.kind = K.Water;
      const depth = (sw + jag - ad) / sw;
      const t = 9.2 - depth * 8.5;
      const fl = Math.floor(t);
      let tone = t - fl > bayer(x, y) ? fl + 1 : fl;
      // Ripples drawn out along the current, and the odd glint.
      const along = valueNoise(x + this.sd * 3, y - this.sd * 3, 9, s + 33);
      if (depth > 0.25 && along > 0.74) tone += 1;
      if (depth > 0.3 && hash2(x, y, s + 35) > 0.985) tone += 2;
      c.tone = tone;
      c.height = ground - 2;
      // Bright where it lips the bank, and glowing motes drifting in the current.
      if (depth < 0.22) c.glow = 0.85 * (1 - depth / 0.22);
      else c.glow = 0.22 + (along > 0.7 ? 0.25 : 0) + (hash2(x >> 1, y >> 1, s + 37) > 0.97 ? 0.6 : 0);
      return;
    }
    if (ad < sw + BANK + jag * 0.6) {
      // Damp earth, moss and pebbles at the water's edge.
      c.kind = K.Bank;
      c.tone = (valueNoise(x, y, 4, s + 39) - 0.5) * 1.4 + (ad < sw + 1 ? -0.6 : 0.4);
      c.height = ground - 0.6;
      if (ad < sw + 1) c.glow = 0.35;
      if (hash2(x, y, s + 41) > 0.93) {
        c.kind = K.Stone;
        c.tone = 3 + hash2(x, y, s + 42) * 2;
        c.height = ground + 0.4;
      }
      return;
    }
    if (onPath && Math.abs(this.td) < ph + (valueNoise(x, y, 6, s + 43) - 0.5) * 1.4) {
      // The path: trodden earth in its middle, flattened grass at its edges.
      c.kind = K.Path;
      const e = Math.abs(this.td) / Math.max(1, ph);
      c.tone = (valueNoise(x, y, 5, s + 45) - 0.5) * 1.2 + (e > 0.7 ? -0.8 : 0.3) + (hash2(x, y, s + 47) > 0.96 ? 1.5 : 0);
      c.height = ground - 0.4;
      return;
    }
    this.grass(x, y, c, ground, ad - sw);
  }

  /** Meadow grass: tall blades leaning with the wind, combed into long bands of sheen. */
  private grass(x: number, y: number, c: GroundCell, ground: number, fromWater: number): void {
    const s = this.seed;
    const lush = fromWater < LUSH && (fromWater < LUSH - 5 || bayer(x, y) < (LUSH - fromWater) / 5);
    const goldEdge = (this.gold - GOLD_AT) / 0.03;
    const gold = !lush && (goldEdge > 1 || (goldEdge > -1 && bayer(x, y) < (goldEdge + 1) / 2));
    c.kind = lush ? K.Lush : gold ? K.Gold : K.Grass;
    // Blades: short strokes, each column of the grass its own, sheared by the wind's lean.
    const lean = (this.wind - 0.5) * 1.6;
    const col = Math.floor(x + y * lean * 0.5);
    const ch = hash2(col, 0, s + 21);
    const period = 5 + Math.floor(ch * 4);
    const off = Math.floor(hash2(col, 1, s + 22) * 97);
    const ph = (((y + off) % period) + period) % period / period;
    const blade = 0.5 - ph;
    // Patches lighter and darker, and the wind's long bands of sheen across the tops.
    const patch = valueNoise(x, y, 46, s + 23) - 0.5;
    const sheen = Math.sin((x * 0.42 + y) * 0.05 + valueNoise(x, y, 110, s + 24) * 7);
    c.tone = blade * 1.7 + (ch - 0.5) * 0.7 + patch * 1.6 + sheen * 0.75;
    c.height = ground + (1 - ph) * 0.45;
    if (lush) c.tone -= (LUSH - fromWater) / LUSH * 0.6;
  }

  /** A stepping stone in a ford; false in the water between them. */
  private stone(x: number, y: number, c: GroundCell, ground: number): boolean {
    const G = 6;
    const gx = Math.floor(x / G);
    const gy = Math.floor(y / G);
    for (let j = 0; j <= 1; j++) {
      for (let i = 0; i <= 1; i++) {
        const ci = gx + i - (x - gx * G < G / 2 ? 1 : 0);
        const cj = gy + j - (y - gy * G < G / 2 ? 1 : 0);
        const h = hash2(ci, cj, this.seed + 51);
        if (h < 0.15) continue;
        const sx = (ci + 0.5) * G + (hash2(ci, cj, this.seed + 52) - 0.5) * 1.5;
        const sy = (cj + 0.5) * G + (hash2(ci, cj, this.seed + 53) - 0.5) * 1.5;
        const r = 2.2 + h * 0.9;
        const dx = (x + 0.5 - sx) / r;
        const dy = (y + 0.5 - sy) / (r * 0.8);
        const e = dx * dx + dy * dy;
        if (e >= 1) continue;
        c.kind = K.Stone;
        c.height = ground + 1.5 + Math.sqrt(1 - e) * 1.6;
        c.tone = (h - 0.5) * 1.4 + (dy > 0.5 ? -1 : 0);
        return true;
      }
    }
    return false;
  }

  /** The stone circle's ground: moss inside, a ring of flagstones under its stones, a glowing rune ring, a slab at its heart. */
  private ring(x: number, y: number, ci: Circle, r: number, c: GroundCell): boolean {
    const s = this.seed + ci.seed;
    const R = CIRCLE_R;
    const d = r * R;
    // The moss fades out into the meadow, dithered.
    const edge = (1.42 - r) / 0.16;
    if (edge < 1 && bayer(x, y) > edge) return false;
    this.sample(x, y);
    const ground = this.h;
    const a = Math.atan2((y - ci.y) / SQUASH, x - ci.x);
    if (Math.abs(d - R) < 5.5) {
      // Flagstones laid round the ring, mortar between.
      const seg = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 44);
      const inner = d < R ? 1 : 0;
      const segA = ((a + Math.PI) / (Math.PI * 2)) * 44 - seg;
      const gap = segA < 0.12 || Math.abs(d - R) > 5 || Math.abs(d - R) < 0.5;
      c.kind = gap ? K.Moss : K.Stone;
      c.tone = gap ? -1 : (hash2(seg, inner, s + 61) - 0.5) * 1.6 + (d < R - 3 ? 0.6 : 0);
      c.height = ground + (gap ? 0 : 1.2);
      return true;
    }
    const runeR = R * 0.48;
    if (Math.abs(d - runeR) < 1.6) {
      // The rune ring: a pale band, broken by glyphs that glow.
      c.kind = K.Rune;
      c.tone = d < runeR ? 1 : 0;
      c.height = ground + 0.6;
      c.glow = 0.55;
      return true;
    }
    if (d > runeR + 1.6 && d < runeR + 5.5) {
      // Glyphs round the outside of the rune ring.
      const seg = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 18);
      const u = ((a + Math.PI) / (Math.PI * 2)) * 18 - seg;
      const g = GLYPHS[Math.floor(hash2(seg, 0, s + 63) * GLYPHS.length)];
      const gx = Math.floor(u * 5);
      const gy = Math.floor(d - runeR - 1.6);
      if (u > 0.15 && u < 0.85 && gy >= 0 && gy < 4 && g[gy] && g[gy][Math.min(3, Math.max(0, gx - 1))] === '#') {
        c.kind = K.Rune;
        c.tone = 2;
        c.height = ground + 0.3;
        c.glow = 1;
        return true;
      }
    }
    if (d < 7.5) {
      // The heart stone: a round slab with a glowing mark.
      c.kind = d < 2.2 ? K.Rune : K.Stone;
      c.tone = d < 2.2 ? 3 : (7.5 - d > 1.5 ? 1 : -1) + (hash2(x >> 1, y >> 1, s + 65) - 0.5);
      c.height = ground + 1.8 + (7.5 - d) * 0.1;
      if (d < 2.2) c.glow = 1;
      return true;
    }
    c.kind = K.Moss;
    c.tone = (valueNoise(x, y, 7, s + 67) - 0.5) * 1.6 + (hash2(x, y, s + 69) > 0.8 ? 0.8 : 0);
    c.height = ground + valueNoise(x, y, 4, s + 71) * 0.4;
    if (hash2(x, y, s + 73) > 0.975) c.glow = 0.9;
    return true;
  }

  /** The flower drift at (x, y): which kind blooms there, and how thickly (0..1). */
  drift(x: number, y: number): { kind: Species; d: number } {
    const s = this.seed;
    const bloom = smooth(0.42, 0.7, softNoise(x, y, BLOOM_SCALE, s + 80));
    let best = -1;
    let kind: Species = SPECIES[0];
    for (let k = 0; k < SPECIES.length; k++) {
      const v = softNoise(x, y, DRIFT_SCALE, s + 81 + k);
      if (v > best) {
        best = v;
        kind = SPECIES[k];
      }
    }
    return { kind, d: bloom * DRIFT_DENSITY };
  }

  /** Flowers and glowing specks over the finished grass, placed by a world grid so they run seamlessly across tiles. */
  decorate(f: TileFields): void {
    const s = this.seed;
    const at = (x: number, y: number) => (y - f.y0 + 1) * f.pw + (x - f.x0) + 1;
    const inside = (x: number, y: number) => x >= f.x0 - 1 && x <= f.x0 + f.w && y >= f.y0 - 1 && y <= f.y0 + f.h;
    const grassy = (k: number) => k === K.Grass || k === K.Gold || k === K.Lush;
    const G = FLOWER_CELL;
    const gx0 = Math.floor((f.x0 - 4) / G);
    const gx1 = Math.floor((f.x0 + f.w + 4) / G);
    const gy0 = Math.floor((f.y0 - 4) / G);
    const gy1 = Math.floor((f.y0 + f.h + 6) / G);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const x = gx * G + Math.floor(hash2(gx, gy, s + 300) * G);
        const y = gy * G + Math.floor(hash2(gx, gy, s + 301) * G);
        const p = hash2(gx, gy, s + 302);
        // A glowmoss speck, most often down by the water.
        if (p < SPECKS) {
          if (!inside(x, y)) continue;
          const i = at(x, y);
          if (!grassy(f.kind[i])) continue;
          f.kind[i] = K.Speck;
          f.tone[i] = 1 + (p / SPECKS) * 2;
          f.glow[i] = 0.7 + (p / SPECKS) * 0.3;
          continue;
        }
        const dr = this.drift(x, y);
        let kind: Species = dr.kind;
        if (p > dr.d) {
          if (p < 1 - STRAYS) continue;
          kind = SPECIES[Math.floor(hash2(gx, gy, s + 303) * SPECIES.length)];
        }
        if (!inside(x, y) || !grassy(f.kind[at(x, y)])) continue;
        const shape = SHAPES[kind];
        const v = hash2(gx, gy, s + 304);
        const mirror = v < 0.5 ? -1 : 1;
        const lift = (v - 0.5) * 0.8;
        for (const [dx, dy, part, tone, glow] of shape) {
          const X = x + dx * mirror;
          const Y = y + dy;
          if (!inside(X, Y)) continue;
          const i = at(X, Y);
          const k0 = f.kind[i];
          if (!grassy(k0) && k0 !== kind) continue;
          if (part === STEM_PX) {
            if (!grassy(k0)) continue;
            f.tone[i] = Math.min(f.tone[i], -1.5);
            f.height[i] += 0.3;
            continue;
          }
          f.kind[i] = kind;
          f.tone[i] = tone + lift;
          f.height[i] += 0.9 + tone * 0.15;
          f.glow[i] = glow;
        }
      }
    }
  }

  // ---------------------------------------------------------------- feet

  open(x: number, y: number): boolean {
    const near = this.circleAt(x, y);
    if (near && near.r < 1.3) return true;
    this.sample(x, y);
    const ad = Math.abs(this.sd);
    if (ad >= this.sw - WADE) return true;
    // Across a ford, on its stepping stones.
    const ph = this.pathHalf();
    return ph > 0 && Math.abs(this.td) < ph + 1.5;
  }

  spawn(): { x: number; y: number } {
    // A path near a stream, so the first look takes in water, flowers and the way on.
    for (let k = 0; k < 2000; k++) {
      const a = k * 2.399;
      const r = 24 * Math.sqrt(k);
      const x = Math.round(LAND_MID + Math.cos(a) * r);
      const y = Math.round(LAND_MID + Math.sin(a) * r);
      const near = this.circleAt(x, y);
      if (near && near.r < 2) continue;
      this.sample(x, y);
      const ad = Math.abs(this.sd);
      const ph = this.pathHalf();
      if (ph > 2 && Math.abs(this.td) < 2 && ad > 60 && ad < 260) return { x, y };
    }
    return { x: LAND_MID, y: LAND_MID };
  }

  // ---------------------------------------------------------------- what stands

  /** The big thing of a grid cell, if one stands there. */
  private big(kind: 'willow' | 'shroom' | 'rock', i: number, j: number): Big | null {
    const cell = kind === 'willow' ? WILLOW_CELL : kind === 'shroom' ? SHROOM_CELL : ROCK_CELL;
    const salt = kind === 'willow' ? 501 : kind === 'shroom' ? 511 : 521;
    const x = Math.round((i + 0.18 + this.draw(i, j, salt) * 0.64) * cell);
    const y = Math.round((j + 0.18 + this.draw(i, j, salt + 1) * 0.64) * cell);
    const s = this.seed;
    let odds = ROCK_ODDS;
    if (kind === 'willow') odds = WILLOW_ODDS + smooth(0.55, 0.8, softNoise(x, y, 520, s + 90)) * WILLOW_GROVE;
    else if (kind === 'shroom') odds = SHROOM_ODDS + smooth(0.6, 0.82, softNoise(x, y, 440, s + 91)) * SHROOM_GROVE;
    if (this.draw(i, j, salt + 2) >= odds) return null;
    if (!this.roomy(x, y, kind === 'willow' ? 16 : 10)) return null;
    return { x, y, v: this.draw(i, j, salt + 3) };
  }

  /** Dry, off the paths and clear of the stone circles: room for something to stand. */
  private roomy(x: number, y: number, pad: number): boolean {
    const near = this.circleAt(x, y);
    if (near && near.r < 1.7) return false;
    this.sample(x, y);
    if (Math.abs(this.sd) < this.sw + pad) return false;
    const ph = this.pathHalf();
    if (ph > 0 && Math.abs(this.td) < ph + pad * 0.6 + 3) return false;
    return true;
  }

  /** Every big thing whose feet fall in [x0, x1) x [y0, y1). */
  private bigsIn(kind: 'willow' | 'shroom' | 'rock', x0: number, y0: number, x1: number, y1: number): Big[] {
    const cell = kind === 'willow' ? WILLOW_CELL : kind === 'shroom' ? SHROOM_CELL : ROCK_CELL;
    const out: Big[] = [];
    for (let j = Math.floor(y0 / cell); j <= Math.floor((y1 - 1) / cell); j++) {
      for (let i = Math.floor(x0 / cell); i <= Math.floor((x1 - 1) / cell); i++) {
        const b = this.big(kind, i, j);
        if (b && b.x >= x0 && b.x < x1 && b.y >= y0 && b.y < y1) out.push(b);
      }
    }
    return out;
  }

  layout(cx: number, cy: number): ChunkLayout {
    const props: LandProp[] = [];
    const lights: LandLight[] = [];
    const life: LifeSpot[] = [];
    const s = this.seed;
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const x1 = x0 + CHUNK;
    const y1 = y0 + CHUNK;
    const inChunk = (x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;

    // The big things first, the willows standing first in line; each kind keeps clear of those before it.
    const PAD = 60;
    const willowsNear = this.bigsIn('willow', x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD);
    const shroomsNear = this.bigsIn('shroom', x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD).filter((m) => !willowsNear.some((w) => Math.abs(w.x - m.x) < 52 && Math.abs(w.y - m.y) < 34));
    const rocksNear = this.bigsIn('rock', x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD).filter(
      (r) => !willowsNear.some((w) => Math.abs(w.x - r.x) < 46 && Math.abs(w.y - r.y) < 30) && !shroomsNear.some((m) => Math.abs(m.x - r.x) < 40 && Math.abs(m.y - r.y) < 26),
    );
    const taken: { x: number; y: number; r: number }[] = [];
    for (const w of willowsNear) {
      taken.push({ x: w.x, y: w.y, r: 22 });
      if (!inChunk(w.x, w.y)) continue;
      const v = Math.floor(w.v * 2);
      props.push({ sheet: 'lumen_willow', frame: `w${v}_0`, x: w.x, y: w.y, flip: w.v * 10 % 1 < 0.5, anim: `sway${v}`, block: { rx: 6, ry: 3 } });
      lights.push({ x: w.x, y: w.y - 34, ...WILLOW_LIGHT });
    }
    for (const m of shroomsNear) {
      taken.push({ x: m.x, y: m.y, r: 18 });
      if (!inChunk(m.x, m.y)) continue;
      const v = Math.min(2, Math.floor(m.v * 3));
      props.push({ sheet: 'lumen_shroom', frame: `m${v}`, x: m.x, y: m.y, flip: m.v * 10 % 1 < 0.5, block: { rx: 7, ry: 3.5 } });
      lights.push({ x: m.x, y: m.y - 40, ...SHROOM_LIGHT });
    }
    for (const r of rocksNear) {
      taken.push({ x: r.x, y: r.y, r: 20 });
      if (!inChunk(r.x, r.y)) continue;
      const v = Math.min(2, Math.floor(r.v * 3));
      props.push({ sheet: 'lumen_rock', frame: `r${v}`, x: r.x, y: r.y, flip: r.v * 10 % 1 < 0.5, block: { rx: [15, 11, 17][v], ry: [6, 5, 6.5][v] } });
    }

    // The stone circle, if this chunk holds its heart.
    const circ = this.circleOf(Math.floor((x0 + CHUNK / 2) / CIRCLE_CELL), Math.floor((y0 + CHUNK / 2) / CIRCLE_CELL));
    if (circ && inChunk(circ.x, circ.y)) {
      for (let k = 0; k < CIRCLE_STONES; k++) {
        const a = (k / CIRCLE_STONES) * Math.PI * 2 + 0.35;
        const x = Math.round(circ.x + Math.cos(a) * CIRCLE_R);
        const y = Math.round(circ.y + Math.sin(a) * CIRCLE_R * SQUASH);
        const v = Math.floor(hash2(k, circ.seed, s + 95) * 4);
        props.push({ sheet: 'lumen_stone', frame: `s${v}`, x, y, flip: hash2(k, circ.seed, s + 96) < 0.5, block: { rx: 6, ry: 3 } });
      }
      lights.push({ x: circ.x, y: circ.y - 6, ...CIRCLE_LIGHT });
    }
    const nearCircle = (x: number, y: number) => {
      const n = this.circleAt(x, y);
      return !!n && n.r < 1.55;
    };
    const clear = (x: number, y: number, r: number) => !taken.some((t) => Math.abs(t.x - x) < t.r + r && Math.abs(t.y - y) < (t.r + r) * 0.6);

    // A bench by a path, facing it, and a little shrine.
    for (const [what, odds, salt] of [['bench', BENCH_ODDS, 601], ['shrine', SHRINE_ODDS, 611]] as const) {
      if (this.draw(cx, cy, salt) >= odds) continue;
      const spot = this.byPath(x0, y0, salt, what === 'bench' ? 12 : 10);
      if (!spot || !clear(spot.x, spot.y, 18) || nearCircle(spot.x, spot.y)) continue;
      taken.push({ x: spot.x, y: spot.y, r: 18 });
      if (what === 'bench') props.push({ sheet: 'lumen_bench', frame: `b${Math.floor(this.draw(cx, cy, salt + 5) * 2)}`, x: spot.x, y: spot.y, block: { rx: 14, ry: 3.5, oy: -1 } });
      else {
        props.push({ sheet: 'lumen_shrine', frame: 'h0', x: spot.x, y: spot.y, block: { rx: 8, ry: 3.5 } });
        lights.push({ x: spot.x, y: spot.y - 18, ...SHRINE_LIGHT });
      }
    }

    // The small things: tall grass, clumps of flowers, reeds by the water, the odd hare.
    for (let gy = 0; gy < CHUNK / SMALL; gy++) {
      for (let gx = 0; gx < CHUNK / SMALL; gx++) {
        const i = cx * (CHUNK / SMALL) + gx;
        const j = cy * (CHUNK / SMALL) + gy;
        const x = Math.round(x0 + (gx + 0.1 + this.draw(i, j, 701) * 0.8) * SMALL);
        const y = Math.round(y0 + (gy + 0.1 + this.draw(i, j, 702) * 0.8) * SMALL);
        const r = this.draw(i, j, 703);
        const v = this.draw(i, j, 704);
        const flip = this.draw(i, j, 705) < 0.5;
        if (nearCircle(x, y) || !clear(x, y, 6)) continue;
        this.sample(x, y);
        const ad = Math.abs(this.sd) - this.sw;
        if (ad < 1.5) continue;
        if (ad < 10) {
          if (r < 0.42) props.push({ sheet: 'lumen_reed', frame: `e${Math.floor(v * 3)}`, x, y, flip, shadow: false });
          continue;
        }
        const ph = this.pathHalf();
        if (ph > 0 && Math.abs(this.td) < ph + 4) continue;
        const gold = this.gold > GOLD_AT;
        // Long grass gathers in swathes (where the fireflies gather by night), and stands thin between.
        const tall = LONG_GRASS[0] + this.longGrass(x, y) * LONG_GRASS[1];
        if (r < tall) {
          const n = 1 + Math.floor(this.draw(i, j, 706) * 2.4);
          for (let k = 0; k < n; k++) {
            const tx = Math.round(x + (k ? (this.draw(i, j, 710 + k) - 0.5) * 16 : 0));
            const ty = Math.round(y + (k ? (this.draw(i, j, 720 + k) - 0.5) * 10 : 0));
            const tv = Math.floor(this.draw(i, j, 730 + k) * 3) + (gold ? 3 : 0);
            props.push({ sheet: 'lumen_grass', frame: `g${tv}_0`, x: tx, y: ty, flip: this.draw(i, j, 740 + k) < 0.5, anim: `sway${tv}`, shadow: false });
          }
        } else if (r < tall + 0.16) {
          const dr = this.drift(x, y);
          if (this.draw(i, j, 707) > dr.d + 0.25) continue;
          props.push({ sheet: 'lumen_bloom', frame: BLOOM_OF[dr.kind][Math.floor(v * BLOOM_OF[dr.kind].length)], x, y, flip, shadow: false });
        } else if (r < tall + 0.165) life.push({ kind: 'hare', x, y });
      }
    }
    return { props, lights, life };
  }

  /** A spot beside a path in the chunk at (x0, y0), `gap` px north of its middle, so a bench there faces it; null if no path passes. */
  private byPath(x0: number, y0: number, salt: number, gap: number): { x: number; y: number } | null {
    const st = Math.floor(this.draw(x0, y0, salt + 1) * 64);
    for (let k = 0; k < 64; k++) {
      const n = (st + k * 37) % 64;
      const x = x0 + 24 + (n % 8) * 26;
      const yy = y0 + 24 + Math.floor(n / 8) * 26;
      // Walk down the column to where the path is, then step back up off it.
      for (let y = yy; y < yy + 26; y += 2) {
        this.sample(x, y);
        const ph = this.pathHalf();
        if (ph < 2 || Math.abs(this.td) > 1.2) continue;
        const by = y - gap;
        if (!this.roomy(x, by, 6) || !this.roomy(x - 14, by, 4) || !this.roomy(x + 14, by, 4)) return null;
        return { x, y: by };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- for the living parts

  /** Is (x, y) stream water (for its glints and glowing motes)? */
  water(x: number, y: number): boolean {
    const near = this.circleAt(x, y);
    if (near && near.r < 1.45) return false;
    this.sample(x, y);
    return Math.abs(this.sd) < this.sw - 1;
  }

  /** Is (x, y) open meadow grass (for the hares, fireflies and seeds)? */
  meadow(x: number, y: number): boolean {
    this.sample(x, y);
    if (Math.abs(this.sd) < this.sw + 4) return false;
    const ph = this.pathHalf();
    return !(ph > 0 && Math.abs(this.td) < ph + 1);
  }

  /** How thick the long grass stands at (x, y), 0..1. */
  longGrass(x: number, y: number): number {
    return smooth(0.45, 0.78, softNoise(x, y, 300, this.seed + 120));
  }

  /** How thick the fireflies gather at (x, y), 0..1: over the long grass and down by the streams. */
  fireflies(x: number, y: number): number {
    this.sample(x, y);
    const water = 1 - smooth(4, 70, Math.abs(this.sd) - this.sw);
    return Math.min(1, this.longGrass(x, y) + water * 0.6);
  }
}

/** The parts of a flower stamped in the ground: [dx, dy, part, tone, glow]. */
const STEM_PX = 0;
const HEAD = 1;
type Px = [number, number, number, number, number];
const SHAPES: Record<Species, Px[]> = {
  // Two or three nodding bells off an arched stem.
  [K.Bluebell]: [[0, 1, STEM_PX, 0, 0], [0, 0, STEM_PX, 0, 0], [-1, 0, HEAD, 0.4, 0.8], [-1, 1, HEAD, -0.6, 0.7], [1, -1, HEAD, 1.2, 0.85], [1, 0, HEAD, 0, 0.75], [0, -1, HEAD, 2, 0.95]],
  // A white star with a bright eye.
  [K.Moonpetal]: [[0, 1, STEM_PX, 0, 0], [0, 0, HEAD, 4, 0.7], [-1, 0, HEAD, 2, 0.3], [1, 0, HEAD, 1, 0.25], [0, -1, HEAD, 3, 0.35]],
  // A spike of tiny florets.
  [K.Lavender]: [[0, 1, STEM_PX, 0, 0], [0, 0, HEAD, 1, 0.55], [0, -1, HEAD, 3, 0.7], [0, -2, HEAD, 2, 0.75], [0, -3, HEAD, 4, 0.9], [1, -1, HEAD, 0.5, 0.5]],
  // A little gold cup.
  [K.Buttercup]: [[0, 1, STEM_PX, 0, 0], [0, 0, HEAD, 4, 0], [1, 0, HEAD, 2, 0], [0, -1, HEAD, 3, 0], [1, -1, HEAD, 1, 0]],
  // Five pink petals round a dark eye.
  [K.Campion]: [[0, 1, STEM_PX, 0, 0], [0, 0, HEAD, 0, 0.1], [-1, 0, HEAD, 3, 0.18], [1, 0, HEAD, 2, 0.15], [0, -1, HEAD, 4, 0.22], [-1, -1, HEAD, 3, 0.15]],
  // A round silver puff on a stalk.
  [K.Clock]: [[0, 2, STEM_PX, 0, 0], [0, 1, STEM_PX, 0, 0], [0, -1, HEAD, 3, 0.55], [-1, -1, HEAD, 1, 0.3], [1, -1, HEAD, 0, 0.25], [0, -2, HEAD, 4, 0.45], [0, 0, HEAD, 0, 0.25], [-1, -2, HEAD, 2, 0.3], [1, -2, HEAD, 2, 0.3]],
};

/** The bloom props (art.ts) each flower drift grows. */
const BLOOM_OF: Record<Species, string[]> = {
  [K.Bluebell]: ['bluebell', 'bluebell2'],
  [K.Moonpetal]: ['moonpetal', 'moonpetal2'],
  [K.Lavender]: ['lavender', 'lupine'],
  [K.Buttercup]: ['wild', 'daisy'],
  [K.Campion]: ['wild', 'lupine'],
  [K.Clock]: ['clock', 'clock2'],
};

/** The rune ring's glyphs, 4 wide and 4 tall. */
const GLYPHS: string[][] = [
  ['.#..', '.##.', '.#..', '.#..'],
  ['#..#', '.##.', '.##.', '#..#'],
  ['.##.', '#...', '#...', '.##.'],
  ['#...', '###.', '#.#.', '#...'],
  ['.#..', '###.', '.#..', '#.#.'],
  ['##..', '.#..', '.##.', '..#.'],
];
