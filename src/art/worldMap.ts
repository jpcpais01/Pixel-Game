// The world map of Aurendel, the arena select's picture of the realm: seas
// and coasts, the lands (meadow, bloom, the dark Gloamwood, the Emberwaste,
// the Sundered Reach, the Shardspine Mountains), the river out of the
// Glimmerdeep, the road between the arenas, and a landmark for each arena.
//
// Everything here is drawn once into a few textures (in the arena worker,
// see arenaWorker.ts), so the map costs a handful of images a frame. It is
// lit like the rest of the game: from the top left, with shade and cast
// shadows falling to the bottom right, and outlines in darker tones.

import type Phaser from 'phaser';
import { Bitmap, bayer, clamp01, mix } from './bitmap';
import { hex, type RGB } from './pixel';
import { hash2, rng, valueNoise } from './env';
import { LEGS, MAP_H, MAP_W, PLACES, legRoad, smoothLine, standAt } from '../world/realm';

const W = MAP_W;
const H = MAP_H;
const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------- Tuning

/** The land: overlapping ovals (x, y, rx, ry), roughened by noise into coasts. */
const BLOBS: [number, number, number, number][] = [
  [300, 262, 190, 150],
  [150, 222, 96, 122],
  [162, 118, 84, 64],
  [285, 114, 132, 66],
  [438, 228, 96, 106],
  [474, 172, 62, 56],
  [300, 372, 150, 58],
  [200, 360, 84, 56],
  [496, 314, 34, 30],
];
/** Bays bitten out of the coast (x, y, rx, ry). */
const BAYS: [number, number, number, number][] = [
  [58, 318, 30, 26],
  [396, 36, 40, 22],
  [452, 420, 44, 26],
  [548, 250, 26, 34],
  [96, 90, 26, 22],
];
/** Small isles off the coast (x, y, r). */
const ISLES: [number, number, number][] = [
  [44, 160, 9],
  [30, 244, 6],
  [70, 424, 8],
  [572, 104, 10],
  [590, 132, 5],
  [520, 424, 7],
];
/** Mirrormere, the lake below the Sunken Garden. */
const LAKE = { x: 240, y: 392, rx: 26, ry: 12 };
/** The Shardspine's crest: mountains stand thickest along it. */
const RIDGE: [number, number][] = [
  [176, 100],
  [214, 88],
  [258, 96],
  [300, 110],
  [340, 120],
  [384, 128],
  [420, 140],
];
const VOLCANO = { x: 494, y: 188 };
/** The Glimmerdeep's river, from the cave's mouth to the sea. */
const RIVER: [number, number][] = [
  [348, 184],
  [358, 210],
  [362, 238],
  [352, 266],
  [340, 294],
  [344, 324],
  [356, 354],
  [364, 388],
  [368, 420],
  [370, 452],
];
const COMPASS = { x: 598, y: 58 };

// Lands, each a set of centres: a pixel belongs to the nearest one.
const MEADOW = 0;
const BLOOM = 1;
const GLOAM = 2;
const EMBER = 3;
const WASTE = 4;
const HIGH = 5;
const ROCK = 6;
const CENTRES: [number, number, number][] = [
  [MEADOW, 300, 330],
  [MEADOW, 262, 256],
  [MEADOW, 390, 352],
  [MEADOW, 232, 300],
  [MEADOW, 300, 400],
  [BLOOM, 196, 374],
  [BLOOM, 168, 346],
  [GLOAM, 118, 238],
  [GLOAM, 96, 190],
  [GLOAM, 150, 268],
  [GLOAM, 196, 200],
  [EMBER, 458, 258],
  [EMBER, 488, 198],
  [EMBER, 500, 304],
  [EMBER, 420, 214],
  [WASTE, 150, 128],
  [WASTE, 110, 120],
  [WASTE, 196, 112],
  [HIGH, 338, 190],
  [HIGH, 290, 170],
  [HIGH, 380, 176],
  [HIGH, 236, 150],
];

const GROUND: RGB[][] = [
  ramp('#2e5a36', '#3c7440', '#4f8c48', '#6ea552', '#94c064'),
  ramp('#3a6040', '#4c7a4a', '#619152', '#7fa85e', '#a2c070'),
  ramp('#132628', '#1a3432', '#22423a', '#2d5244', '#3c644c'),
  ramp('#4a2422', '#6a3326', '#8c4a2e', '#b26a3a', '#d4924e'),
  ramp('#261c36', '#342848', '#44365a', '#58486e', '#6e5c84'),
  ramp('#34463a', '#465a44', '#58704e', '#6e865a', '#8c9e6a'),
  ramp('#3c3650', '#4e4866', '#645e7c', '#7e7894', '#a09ab2'),
];
/** The cliff under each land's coast, top (lit lip) to bottom. */
const CLIFF: RGB[][] = [
  ramp('#9a7a4e', '#6e5236', '#4a3426', '#2e2018'),
  ramp('#9a7a4e', '#6e5236', '#4a3426', '#2e2018'),
  ramp('#5a5a48', '#3e4034', '#2a2c24', '#1a1c18'),
  ramp('#8a4632', '#622e24', '#421e1a', '#281010'),
  ramp('#6a5a7a', '#4a3c60', '#322646', '#1e162c'),
  ramp('#8a7e5e', '#62583e', '#443c2c', '#2a241c'),
  ramp('#8e88a4', '#625c7a', '#443e58', '#2a2638'),
];
const SAND = ramp('#c4a676', '#dcc28a', '#f0dca8');
const FOAM = hex('#e2f6f0');
/** Water by distance from the shore: shallows to the open sea. */
const WATER = ramp('#6cc8c4', '#4aa8bc', '#3088ac', '#256c9c', '#1e5688', '#1a4776', '#163c66', '#13325a');
const WATER_AT = [2.2, 4.6, 8, 13, 19, 27, 38];
/** The open sea: also the colour beyond the map's edge. */
export const SEA_COLOUR = 0x13325a;
const RIVER_C = ramp('#2a6e8e', '#3fa0b8', '#6cc8c4', '#b4ecea');

const TREE = {
  green: ramp('#16301e', '#24502c', '#367036', '#4f9044', '#76b456'),
  pine: ramp('#0e221c', '#183828', '#224c32', '#30643e', '#44804c'),
  gloam: ramp('#081416', '#0f2222', '#16322c', '#204236', '#2e5444'),
  gloamPine: ramp('#061012', '#0c1e1e', '#132c28', '#1c3c32', '#284e40'),
  blossom: ramp('#6a2e4e', '#a24874', '#d86e9a', '#f898c2', '#ffd0e6'),
  autumn: ramp('#4a2418', '#7a3a1e', '#a85a26', '#d08a36', '#f0b84e'),
};
const TRUNK = ramp('#2a1a12', '#4a3020', '#6a4428');
const ROCKS = ramp('#2c2640', '#3e3658', '#544a72', '#6e628e', '#8e82ac', '#b0a6c8');
const SNOW = ramp('#9aa6c8', '#c4cee6', '#eef4ff');
const LAVA = ramp('#a02a14', '#ff5a1e', '#ff9a2e', '#ffe08a');
const INK = hex('#0e0a16');

// ---------------------------------------------------------------- Helpers

function fbm(x: number, y: number, scale: number, seed: number, octaves = 3): number {
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

/** A tone from a ramp for a value 0..1, dithered between neighbours. */
const tone = (r: RGB[], v: number, x: number, y: number): RGB => r[Math.min(r.length - 1, Math.floor(clamp01(v) * (r.length - 1) + bayer(x, y)))];

const idx = (x: number, y: number) => y * W + x;

/** A bitmap with a few drawing tools, for the landmarks and small art. */
class Art extends Bitmap {
  get(x: number, y: number): RGB {
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }

  /** Lay colour over what's there, at strength a (0..1). */
  over(x: number, y: number, c: RGB, a: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const al = this.data[i + 3];
    if (al === 0) return this.set(x, y, c, Math.round(a * 255));
    this.set(x, y, mix(this.get(x, y), c, a), Math.max(al, Math.round(a * 255)));
  }

  /** Darken what's there (k < 1), keeping its alpha. */
  shade(x: number, y: number, k: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (this.data[i + 3] === 0) return;
    // Shadows go cool, not just dark.
    this.data[i] = Math.round(this.data[i] * k * 0.94);
    this.data[i + 1] = Math.round(this.data[i + 1] * k * 0.97);
    this.data[i + 2] = Math.round(this.data[i + 2] * Math.min(1, k * 1.06));
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
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  }

  /** A dark rim around everything drawn so far: the outside edge of the shape. */
  outline(c: RGB = INK): void {
    const edge: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y) > 0) continue;
        if (this.alpha(x - 1, y) > 128 || this.alpha(x + 1, y) > 128 || this.alpha(x, y - 1) > 128 || this.alpha(x, y + 1) > 128) edge.push(x, y);
      }
    }
    for (let i = 0; i < edge.length; i += 2) this.set(edge[i], edge[i + 1], c);
  }

  /** Draw another bitmap over this one at (ox, oy). */
  stamp(src: Bitmap, ox: number, oy: number): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const a = src.alpha(x, y);
        if (a === 0) continue;
        const i = (y * src.w + x) * 4;
        const c: RGB = [src.data[i], src.data[i + 1], src.data[i + 2]];
        if (a === 255) this.set(ox + x, oy + y, c);
        else this.over(ox + x, oy + y, c, a / 255);
      }
    }
  }
}

/** Light on a surface facing (nx, ny) on the ground plane (-1..1), from the top left: about 0..1. */
const lit = (nx: number, ny: number, base = 0.5): number => base - nx * 0.32 - ny * 0.34 + Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) * 0.12;

/** Two-pass distance (in px) from every pixel to the nearest source pixel. */
function distanceFrom(src: Uint8Array): Float32Array {
  const d = new Float32Array(W * H);
  const BIG = 1e6;
  for (let i = 0; i < d.length; i++) d[i] = src[i] ? 0 : BIG;
  const D = Math.SQRT2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - W] + 1);
        if (x > 0) v = Math.min(v, d[i - W - 1] + D);
        if (x < W - 1) v = Math.min(v, d[i - W + 1] + D);
      }
      d[i] = v;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const i = idx(x, y);
      let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + 1);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + D);
        if (x > 0) v = Math.min(v, d[i + W - 1] + D);
      }
      d[i] = v;
    }
  }
  return d;
}

function distToLine(x: number, y: number, line: [number, number][]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, ay] = line[i];
    const [bx, by] = line[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const t = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
}

// ---------------------------------------------------------------- The land

interface Land {
  map: Art;
  land: Uint8Array;
  biome: Uint8Array;
  /** Mountain weight, 0..1: how far into the Shardspine. */
  mount: Float32Array;
  /** Distance from water (on land). */
  inland: Float32Array;
  /** Water in rivers (1) and under bridges. */
  river: Uint8Array;
  /** Kept clear of trees and mountains: the road, landmarks, the river's banks. */
  clear: Uint8Array;
  /** Spots out on open water, for the sea's glints. */
  sea: [number, number][];
}

function* paintLand(): Generator<void, Land, void> {
  const map = new Art(W, H);
  const field = new Float32Array(W * H);
  const land = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Warp the point a little so coasts wander instead of following ovals.
      const wx = x + (fbm(x, y, 48, 11) - 0.5) * 56;
      const wy = y + (fbm(x, y, 48, 23) - 0.5) * 56;
      let f = -1;
      for (const [cx, cy, rx, ry] of BLOBS) f = Math.max(f, 1 - Math.hypot((wx - cx) / rx, (wy - cy) / ry));
      for (const [cx, cy, rx, ry] of BAYS) f = Math.min(f, Math.hypot((wx - cx) / rx, (wy - cy) / ry) - 1);
      for (const [cx, cy, r] of ISLES) f = Math.max(f, (1 - Math.hypot(wx - cx, wy - cy) / r) * 0.6);
      f += (fbm(x, y, 14, 37) - 0.5) * 0.24 + (fbm(x, y, 5, 39) - 0.5) * 0.06;
      const lk = Math.hypot((x - LAKE.x) / LAKE.rx, (y - LAKE.y) / LAKE.ry);
      if (lk < 1.3) f -= (1.3 - lk) * 0.9;
      field[idx(x, y)] = f;
      land[idx(x, y)] = f > 0 ? 1 : 0;
    }
    if (y % 32 === 31) yield;
  }
  // Tiny specks of land read as noise: sink any smaller than a few pixels.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      if (!land[i]) continue;
      const n = land[i - 1] + land[i + 1] + land[i - W] + land[i + W];
      if (n <= 1) land[i] = 0;
    }
  }

  const water = new Uint8Array(W * H);
  for (let i = 0; i < land.length; i++) water[i] = land[i] ? 0 : 1;
  const inland = distanceFrom(water);
  yield;

  // Which land, and how mountainous.
  const biome = new Uint8Array(W * H);
  const mount = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (!land[i]) continue;
      const m = clamp01(1 - distToLine(x, y, RIDGE) / 30 + (fbm(x, y, 12, 51) - 0.5) * 0.6);
      mount[i] = m;
      const wx = x + (fbm(x, y, 30, 61) - 0.5) * 56;
      const wy = y + (fbm(x, y, 30, 67) - 0.5) * 56;
      let d1 = Infinity;
      let d2 = Infinity;
      let b1 = MEADOW;
      let b2 = MEADOW;
      for (const [b, cx, cy] of CENTRES) {
        const d = Math.hypot(wx - cx, wy - cy);
        if (d < d1) {
          if (b !== b1) {
            d2 = d1;
            b2 = b1;
          }
          d1 = d;
          b1 = b;
        } else if (d < d2 && b !== b1) {
          d2 = d;
          b2 = b;
        }
      }
      // Lands fray into each other over a few pixels instead of meeting on a line.
      const t = (d2 - d1) / 9;
      let b = t < 1 && hash2(x, y, 5) > 0.5 + t * 0.5 ? b2 : b1;
      if (m > 0.5) b = ROCK;
      biome[i] = b;
    }
    if (y % 32 === 31) yield;
  }

  // Height, for the light: rising inland and into the mountains.
  const height = new Float32Array(W * H);
  for (let i = 0; i < height.length; i++) {
    if (!land[i]) continue;
    const x = i % W;
    const y = (i / W) | 0;
    height[i] = Math.min(inland[i], 18) / 18 * 0.35 + mount[i] * 1.1 + fbm(x, y, 22, 71) * 0.5 + fbm(x, y, 7, 73) * 0.12;
  }

  const volcanoD = (x: number, y: number) => Math.hypot(x - VOLCANO.x, (y - VOLCANO.y) * 1.3);
  const rift = PLACES.find((p) => p.id === 'rift')!;
  const riftD = (x: number, y: number) => Math.hypot(x - rift.x, (y - rift.y + 4) * 1.6);

  // The ground.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (!land[i]) continue;
      const b = biome[i];
      const h0 = height[idx(Math.max(0, x - 1), Math.max(0, y - 1))];
      const h1 = height[idx(Math.min(W - 1, x + 1), Math.min(H - 1, y + 1))];
      const slope = (h0 - h1) * 5;
      let v = 0.5 + slope + (fbm(x, y, 5, 81) - 0.5) * 0.3;
      if (b === ROCK) v += (valueNoise(x * 3, y, 4, 83) - 0.5) * 0.2;
      let c = tone(GROUND[b], v, x, y);
      const r = hash2(x, y, 91);
      if (b === MEADOW && r < 0.025) c = GROUND[b][4];
      else if (b === MEADOW && r > 0.985) c = hex('#e8e0a0');
      else if (b === BLOOM && r < 0.06) c = [hex('#ff9ec8'), hex('#fff4fa'), hex('#ffe08a'), hex('#e2b4ff')][Math.floor(hash2(x, y, 93) * 4)];
      else if (b === GLOAM && r < 0.03) c = hex('#4e7a60');
      else if (b === HIGH && r < 0.03) c = hex('#a4a494');
      else if (b === EMBER || b === WASTE) {
        // Cracked ground: in the Emberwaste, cracks near the volcano run with lava.
        const crack = Math.abs(valueNoise(x, y, 14, 97) - 0.5) < 0.012 && fbm(x, y, 40, 98) > 0.45;
        const hot = b === EMBER && volcanoD(x, y) < 50 && Math.abs(valueNoise(x, y, 11, 99) - 0.5) < 0.016;
        if (hot) c = LAVA[volcanoD(x, y) < 34 && r < 0.5 ? 2 : 1];
        else if (crack) c = mix(c, b === EMBER ? hex('#2a1414') : hex('#160e22'), 0.7);
        else if (b === WASTE && r < 0.012) c = hex('#c89cff');
      }
      // The ground about the Rift is stained by its light.
      const rd = riftD(x, y);
      if (rd < 46) c = mix(c, hex('#a0306e'), (1 - rd / 46) * 0.3);
      // A beach where the shore is low and gentle.
      if (inland[i] <= 2.5 && (b === MEADOW || b === BLOOM || b === HIGH) && fbm(x, y, 26, 101) > 0.5) c = SAND[Math.min(2, Math.floor(inland[i] - 0.5 + bayer(x, y)))];
      map.set(x, y, c);
    }
    if (y % 32 === 31) yield;
  }

  // Cliffs: the coast is a low plateau, its south-facing edges showing a face of rock.
  const solid = land.slice();
  for (let y = 1; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (land[i]) continue;
      for (let k = 1; k <= 3; k++) {
        const up = idx(x, y - k);
        if (y - k < 0 || !land[up]) continue;
        const b = biome[up];
        if (inland[up] <= 2.5 && SAND.some((s) => { const c = map.get(x, y - k); return c[0] === s[0] && c[1] === s[1] && c[2] === s[2]; })) break;
        const face = CLIFF[b];
        let c = face[Math.min(3, k - 1 + (hash2(x, y, 7) < 0.25 ? 1 : 0))];
        if (k === 1 && hash2(x, y, 9) < 0.4) c = face[0];
        map.set(x, y, c);
        solid[i] = 1;
        break;
      }
    }
  }
  yield;

  // The sea: shallows by the shore to the open sea, foam on the rocks.
  const shoreD = distanceFrom(solid);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (solid[i]) continue;
      const d = shoreD[i];
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      let t = d + (fbm(x, y, 18, 111) - 0.5) * 5 + (bayer(x, y) - 0.5) * 1.8;
      if (edge < 36) t += (36 - edge) * 1.6;
      let band = WATER_AT.length;
      for (let k = 0; k < WATER_AT.length; k++) {
        if (t < WATER_AT[k]) {
          band = k;
          break;
        }
      }
      let c = WATER[band];
      if (d < 1.5 && hash2(x, y, 13) < 0.82) c = FOAM;
      else if (d > 3.2 && d < 4.3 && valueNoise(x, y, 6, 117) > 0.55) c = hex('#8ed8d6');
      else if (d > 7 && d < 8 && valueNoise(x, y, 9, 119) > 0.62) c = mix(c, hex('#6cb8d0'), 0.5);
      map.set(x, y, c);
    }
    if (y % 32 === 31) yield;
  }
  // Wave marks on the open sea.
  const rand = rng(131);
  for (let gy = 0; gy < H; gy += 22) {
    for (let gx = 0; gx < W; gx += 26) {
      const x = Math.round(gx + rand() * 18);
      const y = Math.round(gy + rand() * 14);
      if (rand() > 0.55 || x < 4 || y < 4 || x > W - 10 || y > H - 6) continue;
      if (solid[idx(x, y)] || shoreD[idx(x, y)] < 12) continue;
      const base = map.get(x, y);
      const c = mix(base, hex('#6aa0d0'), 0.45);
      for (const [dx, dy] of [[0, 1], [1, 0], [2, 0], [3, 1], [4, 1], [5, 0]]) map.set(x + dx, y + dy, c);
    }
  }
  // The Floating Island's shadow on the sea below it.
  const isle = PLACES.find((p) => p.id === 'island')!;
  map.oval(isle.x + 8, isle.y + 20, 17, 5, (x, y, nx, ny) => (nx * nx + ny * ny > 0.7 && bayer(x, y) > 0.5 ? null : mix(map.get(x, y), hex('#0a1a38'), 0.4)));

  // The river out of the Glimmerdeep, widening to the sea.
  const river = new Uint8Array(W * H);
  const flow = smoothLine(RIVER.map(([x, y]) => ({ x, y })));
  flow.forEach((p, k) => {
    const r = 1.1 + (k / flow.length) * 1.4;
    for (let y = Math.floor(p.y - r); y <= Math.ceil(p.y + r); y++) {
      for (let x = Math.floor(p.x - r); x <= Math.ceil(p.x + r); x++) {
        if (x < 0 || y < 0 || x >= W || y >= H || Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) > r) continue;
        if (solid[idx(x, y)]) river[idx(x, y)] = 1;
      }
    }
  });
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      if (!river[i]) {
        // A dark bank under the water's lower edge: the river is cut into the land.
        if (solid[i] && river[i - W]) map.set(x, y, mix(map.get(x, y), INK, 0.45));
        continue;
      }
      let c = RIVER_C[1];
      if (!river[i - W - 1] || !river[i - W]) c = RIVER_C[2];
      if (!river[i + W + 1] || !river[i + 1]) c = RIVER_C[0];
      if (hash2(x, y, 17) < 0.06) c = RIVER_C[3];
      map.set(x, y, c);
    }
  }
  yield;

  const clear = new Uint8Array(W * H);
  const clearDisc = (cx: number, cy: number, r: number) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (x >= 0 && y >= 0 && x < W && y < H && Math.hypot(x - cx, y - cy) <= r) clear[idx(x, y)] = 1;
      }
    }
  };
  for (const p of flow) clearDisc(p.x, p.y, 4);
  for (const p of PLACES) {
    // The landmark stands on this oval, and the hero at the road's end.
    for (let y = p.y - 34; y <= p.y + 8; y++) {
      for (let x = p.x - 26; x <= p.x + 26; x++) {
        if (x >= 0 && y >= 0 && x < W && y < H && Math.hypot((x - p.x) / 26, (y - p.y + 12) / 22) <= 1) clear[idx(x, y)] = 1;
      }
    }
    const s = standAt(p);
    clearDisc(s.x, s.y - 4, 9);
  }
  const sea: [number, number][] = [];
  const pick = rng(191);
  for (let n = 0; n < 4000 && sea.length < 96; n++) {
    const x = Math.floor(pick() * W);
    const y = Math.floor(pick() * H);
    const d = shoreD[idx(x, y)];
    if (d > 5 && d < 44 && Math.min(x, y, W - 1 - x, H - 1 - y) > 12) sea.push([x, y]);
  }
  return { map, land, biome, mount, inland, river, clear, sea };
}

// ---------------------------------------------------------------- The road

function paintRoad(l: Land): void {
  const { map, land, river, clear } = l;
  const dot = (x: number, y: number) => {
    const c = [hex('#fff4d6'), hex('#f0dca8'), hex('#f0dca8'), hex('#c8a870')];
    map.set(x, y, c[0]);
    map.set(x + 1, y, c[1]);
    map.set(x, y + 1, c[2]);
    map.set(x + 1, y + 1, c[3]);
    for (const [dx, dy] of [[0, 2], [1, 2], [2, 2], [2, 1]]) if (land[idx(x + dx, y + dy)] && !river[idx(x + dx, y + dy)]) map.set(x + dx, y + dy, mix(map.get(x + dx, y + dy), INK, 0.4));
  };
  for (const leg of LEGS) {
    const { walk, sky } = legRoad(leg, PLACES);
    // A worn track first, then the dots and the bridges over it.
    for (const p of walk) {
      for (let y = Math.floor(p.y - 2); y <= Math.ceil(p.y + 2); y++) {
        for (let x = Math.floor(p.x - 2); x <= Math.ceil(p.x + 2); x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = idx(x, y);
          clear[i] = 1;
          const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
          if (d < 1.6 && land[i] && !river[i] && hash2(x, y, 3) < 0.55) map.set(x, y, mix(map.get(x, y), hex('#b89a64'), 0.22));
        }
      }
    }
    walk.forEach((p, k) => {
      const ahead = walk[Math.min(walk.length - 1, k + 1)];
      const behind = walk[Math.max(0, k - 1)];
      const tx = ahead.x - behind.x;
      const ty = ahead.y - behind.y;
      const tl = Math.hypot(tx, ty) || 1;
      const nx = -ty / tl;
      const ny = tx / tl;
      // A plank bridge wherever the road crosses the river.
      let wet = false;
      for (let s = -3; s <= 3; s++) if (river[idx(Math.round(p.x + nx * s), Math.round(p.y + ny * s))]) wet = true;
      if (wet) {
        for (let s = -2.5; s <= 2.5; s += 0.5) {
          const x = Math.round(p.x + nx * s);
          const y = Math.round(p.y + ny * s);
          map.set(x, y, Math.abs(s) >= 2.5 ? hex('#3e2616') : Math.floor(k / 2) % 2 ? hex('#b07a44') : hex('#8e5e34'));
        }
        map.set(Math.round(p.x + nx * 3 + 1), Math.round(p.y + ny * 3 + 1), mix(map.get(Math.round(p.x + nx * 3 + 1), Math.round(p.y + ny * 3 + 1)), INK, 0.4));
      } else if (k % 5 === 2) dot(Math.round(p.x - 1), Math.round(p.y - 1));
    });
    // Over the sea: stepping lights, each with a faint shadow on the water.
    sky.forEach((p, k) => {
      if (k % 6 !== 3) return;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      map.set(x + 2, y + 6, mix(map.get(x + 2, y + 6), hex('#0a1a38'), 0.35));
      map.set(x + 3, y + 6, mix(map.get(x + 3, y + 6), hex('#0a1a38'), 0.35));
      map.set(x, y, hex('#f4fcff'));
      map.set(x + 1, y, hex('#bfe8ff'));
      map.set(x, y + 1, hex('#bfe8ff'));
      map.set(x + 1, y + 1, hex('#7ac0e8'));
    });
  }
}

// ---------------------------------------------------------------- Trees, rocks and mountains

interface Prop {
  y: number;
  shadow(m: Art): void;
  draw(m: Art): void;
}

function roundTree(x: number, y: number, pal: RGB[], big: boolean): Prop {
  const rx = big ? 4.2 : 3.4;
  const ry = big ? 3.6 : 3;
  const cy = y - (big ? 6 : 5);
  return {
    y,
    shadow: (m) => m.oval(x + 2, y + 0.5, rx + 0.5, 1.6, (px, py) => (m.shade(px, py, 0.6), null)),
    draw: (m) => {
      m.set(x, y, TRUNK[0]);
      m.set(x, y - 1, TRUNK[1]);
      if (big) m.set(x, y - 2, TRUNK[2]);
      m.oval(x + 0.5, cy, rx, ry, (px, py, nx, ny) => {
        const edge = nx * nx + ny * ny > 0.62;
        let v = lit(nx, ny, 0.55) + (hash2(px, py, 21) - 0.5) * 0.25;
        if (edge && (nx > 0.2 || ny > 0.3)) v -= 0.35;
        return tone(pal, v, px, py);
      });
      // A few leaf clumps catching the sun.
      m.set(x - 1, cy - 1, pal[4]);
      if (big) m.set(x - 2, cy, pal[4]);
    },
  };
}

function pine(x: number, y: number, pal: RGB[], snow: boolean): Prop {
  const rows = [0, 1, 1, 2, 1, 2, 3, 2, 3];
  const top = y - rows.length;
  return {
    y,
    shadow: (m) => {
      for (let k = 0; k < 4; k++) m.shade(x + 1 + k, y - (k >> 1), 0.6);
    },
    draw: (m) => {
      m.set(x, y, TRUNK[0]);
      rows.forEach((hw, r) => {
        for (let dx = -hw; dx <= hw; dx++) {
          let v = 0.62 - (dx / 3) * 0.6 - (r / rows.length) * 0.2;
          if (dx === hw) v -= 0.25;
          let c = tone(pal, v, x + dx, top + r);
          if (snow && r < 3 && dx <= 0) c = SNOW[2];
          m.set(x + dx, top + r, c);
        }
      });
    },
  };
}

function deadTree(x: number, y: number, pal: RGB[]): Prop {
  return {
    y,
    shadow: (m) => {
      for (let k = 0; k < 4; k++) m.shade(x + 1 + k, y, 0.65);
    },
    draw: (m) => {
      m.line(x, y, x, y - 6, pal[1]);
      m.set(x - 1, y - 4, pal[0]);
      m.set(x - 2, y - 5, pal[0]);
      m.set(x + 1, y - 5, pal[1]);
      m.set(x + 2, y - 6, pal[1]);
      m.set(x - 1, y - 7, pal[0]);
      m.set(x, y - 6, pal[2]);
    },
  };
}

function crystal(x: number, y: number, pal: RGB[], h: number): Prop {
  return {
    y,
    shadow: (m) => m.shade(x + 1, y, 0.6),
    draw: (m) => {
      for (let k = 0; k < h; k++) {
        m.set(x, y - k, k === h - 1 ? pal[4] : pal[3]);
        if (k < h - 1) m.set(x + 1, y - k, pal[1]);
      }
      m.set(x - 1, y, pal[2]);
    },
  };
}

function boulder(x: number, y: number, pal: RGB[]): Prop {
  return {
    y,
    shadow: (m) => m.oval(x + 1.5, y, 2.5, 1, (px, py) => (m.shade(px, py, 0.65), null)),
    draw: (m) => m.oval(x, y - 1.5, 2.2, 1.8, (px, py, nx, ny) => tone(pal, lit(nx, ny, 0.5), px, py)),
  };
}

/** One peak of a mountain: a jagged cone from its apex down to its base, lit on the left of its ridge. */
function peak(m: Art, ax: number, ay: number, bl: number, br: number, by: number, seed: number, pal: RGB[], snowy: boolean, dim: number): void {
  const h = by - ay;
  const snowAt = 0.34 + (hash2(seed, 1, 3) - 0.5) * 0.12;
  const ridgeTo = ax + (br - ax) * 0.3;
  for (let y = Math.floor(ay); y <= by; y++) {
    const t = (y - ay) / h;
    const jl = (valueNoise(y * 1.3, seed, 2.5, seed) - 0.5) * 2.4 * Math.min(1, t * 3);
    const jr = (valueNoise(y * 1.3, seed + 9, 2.5, seed) - 0.5) * 2.4 * Math.min(1, t * 3);
    const l = Math.round(ax + (bl - ax) * t + jl);
    const r = Math.round(ax + (br - ax) * t + jr);
    const ridge = ax + (ridgeTo - ax) * t + (valueNoise(y, seed + 3, 3, seed) - 0.5) * 1.6;
    for (let x = l; x <= r; x++) {
      const left = x < ridge;
      // Gullies run down from the summit: streaks fanning out from the apex.
      const fan = (x - ax) / (y - ay + 2);
      const gully = valueNoise(fan * 26, t * 3, 1, seed + 5);
      let v = (left ? 0.8 - t * 0.28 : 0.36 - t * 0.14) - dim;
      if (gully > 0.68) v -= left ? 0.2 : 0.08;
      else if (gully < 0.2 && left) v += 0.08;
      v += (hash2(x, y, seed) - 0.5) * 0.12;
      let c = tone(pal, v, x, y);
      const line = snowAt + (gully > 0.6 ? 0.12 : 0) + (valueNoise(x, 0, 2, seed + 7) - 0.5) * 0.1;
      if (snowy && t < line) c = left ? (t < line - 0.08 ? SNOW[2] : SNOW[1]) : t < line - 0.1 ? SNOW[1] : SNOW[0];
      if (x === r || y === by) c = mix(c, INK, 0.55);
      else if (x === l) c = mix(c, INK, t < 0.15 ? 0.15 : 0.35);
      m.set(x, y, c);
    }
  }
}

/** A mountain: a main peak and a lower shoulder beside it, and its shadow cast to the right. */
function mountain(cx: number, by: number, r: number, h: number, seed: number, pal: RGB[], snowy: boolean): Prop {
  const rand = rng(seed);
  const ax = cx + (rand() - 0.5) * r * 0.5;
  const side = rand() < 0.5 ? -1 : 1;
  const shoulder = { x: cx + side * r * (0.5 + rand() * 0.2), h: h * (0.45 + rand() * 0.2) };
  return {
    y: by,
    shadow: (m) => {
      for (let y = Math.floor(by - h * 0.7); y <= by + 1; y++) {
        const t = (y - (by - h)) / h;
        const x0 = ax + (cx + r - ax) * t;
        for (let x = Math.floor(x0); x < x0 + t * r * 0.8; x++) m.shade(x, y, 0.72);
      }
    },
    draw: (m) => {
      const sw = r * 0.6;
      peak(m, shoulder.x, by - shoulder.h, shoulder.x - sw, shoulder.x + sw, by, seed + 11, pal, snowy && shoulder.h > 14, 0.08);
      peak(m, ax, by - h, cx - r, cx + r, by, seed, pal, snowy, 0);
    },
  };
}

function volcano(): Prop {
  const { x: cx, y: by } = VOLCANO;
  const r = 30;
  const h = 34;
  const top = by - h;
  const craterW = 6;
  const pal = ramp('#241010', '#3e1e1a', '#5a2c22', '#7a3e2a', '#9e5634', '#c07a48');
  const half = (y: number) => craterW + (r - craterW) * Math.pow((y - top) / h, 0.9);
  return {
    y: by,
    shadow: (m) => {
      for (let y = top; y <= by + 2; y++) {
        const t = (Math.min(y, by) - top) / h;
        const x0 = cx + half(Math.min(y, by));
        for (let x = Math.floor(x0 - 2); x < x0 + t * 22; x++) m.shade(x, y, 0.7);
      }
    },
    draw: (m) => {
      for (let y = top; y <= by; y++) {
        const t = (y - top) / h;
        const hw = half(y);
        const jl = (valueNoise(y * 1.3, 3, 2.5, 141) - 0.5) * 2.4 * t;
        const jr = (valueNoise(y * 1.3, 5, 2.5, 141) - 0.5) * 2.4 * t;
        const l = Math.round(cx - hw + jl);
        const rr = Math.round(cx + hw + jr);
        for (let x = l; x <= rr; x++) {
          const u = (x - cx) / hw;
          const fan = (x - cx) / (y - top + 6);
          const gully = valueNoise(fan * 22, t * 3, 1, 143);
          let v = 0.66 - u * 0.42 - t * 0.12 + (gully > 0.66 ? -0.16 : 0) + (hash2(x, y, 5) - 0.5) * 0.1;
          let c = tone(pal, v, x, y);
          // Lava runs down the lit flank, and a thinner stream down the other.
          const run = cx - 3 - t * 9 + Math.sin(y * 0.45) * 1.4;
          const run2 = cx + 6 + t * 7 + Math.sin(y * 0.35 + 2) * 1.2;
          if (Math.abs(x - run) < 0.7 + t * 0.7) c = LAVA[t < 0.3 ? 3 : t < 0.65 ? 2 : 1];
          else if (t < 0.62 && Math.abs(x - run2) < 0.6) c = LAVA[t < 0.3 ? 2 : 1];
          if (y <= top + 1 && Math.abs(x - cx) < craterW) c = y === top ? LAVA[3] : LAVA[2];
          if (x === rr || y === by) c = mix(c, INK, 0.55);
          else if (x === l) c = mix(c, INK, 0.3);
          m.set(x, y, c);
        }
      }
      // Smoke, drifting off with the wind.
      const smoke = ramp('#2e2632', '#4a4050', '#6e6478', '#948ca0');
      for (const [x, y, rr] of [
        [cx + 1, top - 4, 3.5],
        [cx + 5, top - 10, 4.5],
        [cx + 12, top - 16, 5.5],
      ] as [number, number, number][]) {
        m.oval(x, y, rr, rr * 0.8, (px, py, nx, ny) => {
          if (nx * nx + ny * ny > 0.75 && bayer(px, py) > 0.6) return null;
          return tone(smoke, lit(nx, ny, 0.5), px, py);
        });
      }
    },
  };
}

function* paintProps(l: Land): Generator<void, void, void> {
  const { map, land, biome, mount, inland, river, clear } = l;
  const props: Prop[] = [];
  const open = (x: number, y: number) => {
    if (x < 2 || y < 12 || x >= W - 2 || y >= H - 2) return false;
    const i = idx(x, y);
    if (!land[i] || clear[i] || inland[i] < 3) return false;
    for (let k = -2; k <= 2; k++) if (river[idx(x + k, y)] || river[idx(x, y + k)]) return false;
    return true;
  };
  const near = (x: number, y: number, id: string, r: number) => {
    const p = PLACES.find((q) => q.id === id)!;
    return Math.hypot(x - p.x, y - p.y) < r;
  };

  // Mountains along the Shardspine, biggest on the crest, scattered rather than in rows.
  const rand = rng(151);
  const peaks: [number, number, number][] = [];
  for (let n = 0; n < 1400; n++) {
    const x = Math.round(130 + rand() * 340);
    const y = Math.round(36 + rand() * 170);
    const i = idx(x, y);
    const m = mount[i];
    if (!land[i] || clear[i] || inland[i] < 5 || m < 0.4) continue;
    const r = 5 + m * 10 + rand() * 4;
    if (peaks.some(([px, py, pr]) => Math.abs(px - x) < (pr + r) * 0.55 && Math.abs(py - y) < (pr + r) * 0.32)) continue;
    // Keep the road and the landmarks clear of a mountain's whole footprint.
    let blocked = false;
    for (let k = -r; k <= r && !blocked; k += 2) {
      const bx = Math.max(0, Math.min(W - 1, Math.round(x + k)));
      if (clear[idx(bx, y)] || clear[idx(bx, Math.max(0, y - Math.round(r)))]) blocked = true;
    }
    if (blocked) continue;
    peaks.push([x, y, r]);
    props.push(mountain(x, y, r, r * (1.0 + rand() * 0.45), 1000 + x * 7 + y, GROUND[ROCK], m > 0.55));
  }
  props.push(volcano());
  yield;

  // Forests and groves.
  for (let gy = 8; gy < H; gy += 4) {
    for (let gx = 2 + ((gy / 4) % 2) * 2; gx < W; gx += 5) {
      const x = Math.round(gx + (hash2(gx, gy, 161) - 0.5) * 3);
      const y = Math.round(gy + (hash2(gx, gy, 163) - 0.5) * 2);
      if (!open(x, y)) continue;
      const b = biome[idx(x, y)];
      const r = hash2(x, y, 167);
      const g = fbm(x, y, 34, 169);
      const kind = hash2(x, y, 171);
      const vol = Math.hypot(x - VOLCANO.x, y - VOLCANO.y);
      if (vol < 38) continue;
      if (b === GLOAM) {
        // Glades here and there, so the wood isn't one wall of trees.
        if (r > 0.25 + g * 0.7 || fbm(x, y, 18, 173) > 0.62) continue;
        if (near(x, y, 'spirit', 44) && kind < 0.35) props.push(deadTree(x, y, ramp('#140e14', '#2a2028', '#3e3440')));
        else props.push(kind < 0.55 ? pine(x, y, TREE.gloamPine, false) : roundTree(x, y, TREE.gloam, kind > 0.85));
      } else if (b === MEADOW && near(x, y, 'forest', 62)) {
        // The Everwood: a thick wood of every colour round its elder, with a glade or two.
        if (r > 0.8 || fbm(x, y, 14, 175) > 0.66) continue;
        const pal = kind < 0.28 ? TREE.pine : kind < 0.5 ? TREE.autumn : kind < 0.62 ? TREE.blossom : TREE.green;
        props.push(pal === TREE.pine ? pine(x, y, pal, false) : roundTree(x, y, pal, kind > 0.8));
      } else if (b === MEADOW) {
        if (g < 0.56 ? r > 0.012 : r > Math.min(0.85, (g - 0.56) * 6)) continue;
        props.push(kind < 0.2 ? pine(x, y, TREE.pine, false) : roundTree(x, y, kind > 0.975 ? TREE.autumn : TREE.green, kind > 0.8));
      } else if (b === BLOOM) {
        if (g < 0.5 ? r > 0.03 : r > Math.min(0.7, (g - 0.5) * 4)) continue;
        props.push(roundTree(x, y, kind < 0.5 ? TREE.blossom : TREE.green, kind > 0.8));
      } else if (b === HIGH) {
        if (r > (g - 0.4) * 1.4) continue;
        props.push(kind < 0.75 ? pine(x, y, TREE.pine, false) : boulder(x, y, ramp('#2e3430', '#46504a', '#626c62', '#848c80', '#a4aa9c')));
      } else if (b === ROCK) {
        const m = mount[idx(x, y)];
        if (m > 0.5 || r > 0.22) continue;
        props.push(kind < 0.8 ? pine(x, y, TREE.pine, kind < 0.3) : boulder(x, y, GROUND[ROCK]));
      } else if (b === EMBER) {
        if (r > 0.045) continue;
        props.push(kind < 0.5 ? deadTree(x, y, ramp('#1a0e0c', '#2e1a16', '#4a2a22')) : boulder(x, y, ramp('#2a1414', '#4a2420', '#6a3428', '#8e4a30', '#b06a3e')));
      } else if (b === WASTE) {
        if (r > 0.05) continue;
        const shard = ramp('#3a2a5a', '#6a4aa0', '#9a70e0', '#c89cff', '#f0e0ff');
        props.push(kind < 0.55 ? crystal(x, y, shard, 3 + Math.floor(kind * 6)) : deadTree(x, y, ramp('#120c18', '#261c30', '#3a2e46')));
      }
    }
  }
  yield;

  props.sort((a, b) => a.y - b.y);
  for (const p of props) p.shadow(map);
  yield;
  for (const p of props) p.draw(map);
}

/** A compass rose, out on the open sea. */
function paintCompass(map: Art): void {
  const { x: cx, y: cy } = COMPASS;
  const gold = ramp('#7a431e', '#b8742c', '#f4cf6a', '#fff4bf');
  // A faint ring.
  for (let a = 0; a < 360; a += 3) {
    const x = Math.round(cx + Math.cos((a * Math.PI) / 180) * 12);
    const y = Math.round(cy + Math.sin((a * Math.PI) / 180) * 12);
    map.set(x, y, mix(map.get(x, y), hex('#e8d4a0'), 0.4));
  }
  const point = (dx: number, dy: number, len: number, w: number) => {
    for (let k = 0; k <= len; k++) {
      const hw = Math.round(w * (1 - k / len));
      for (let s = -hw; s <= hw; s++) {
        const x = cx + dx * k + (dy !== 0 ? s : 0);
        const y = cy + dy * k + (dx !== 0 ? s : 0);
        // One half of each point in light, the other in shade.
        const litSide = dx !== 0 ? s < 0 : s < 0;
        map.set(x, y, k === len ? gold[3] : litSide ? gold[2] : gold[1]);
      }
    }
  };
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    for (let k = 1; k <= 6; k++) map.set(cx + dx * k, cy + dy * k, k === 6 ? hex('#fff4d6') : hex('#d8c8a0'));
  }
  point(0, -1, 14, 2);
  point(0, 1, 10, 2);
  point(1, 0, 10, 2);
  point(-1, 0, 10, 2);
  map.set(cx, cy, hex('#fff4d6'));
}

// ---------------------------------------------------------------- Landmarks

/** Each landmark's frame, and where its foot (its place on the map) is in it. */
export const LANDMARKS: Record<string, { w: number; h: number; ax: number; ay: number }> = {
  clearing: { w: 52, h: 46, ax: 26, ay: 42 },
  garden: { w: 52, h: 46, ax: 26, ay: 42 },
  spirit: { w: 52, h: 48, ax: 26, ay: 44 },
  temple: { w: 54, h: 48, ax: 27, ay: 44 },
  deep: { w: 56, h: 44, ax: 28, ay: 40 },
  cosmos: { w: 60, h: 76, ax: 30, ay: 72 },
  rift: { w: 60, h: 36, ax: 30, ay: 30 },
  island: { w: 52, h: 58, ax: 26, ay: 54 },
  glide: { w: 46, h: 40, ax: 20, ay: 34 },
  forest: { w: 64, h: 58, ax: 32, ay: 54 },
  waymark: { w: 16, h: 20, ax: 8, ay: 18 },
};

const STONE = ramp('#4a4458', '#6e6878', '#948c98', '#bab2b4', '#ded6cc', '#f4eee2');
const MARBLE = ramp('#7a7490', '#a8a2b8', '#d0cad8', '#eeeaf0', '#fffcf6');
const SLATE = ramp('#1e1c3a', '#2c2a56', '#3e3c74', '#555496', '#6e70b4');
const GRASS = ramp('#2e5a36', '#3c7440', '#4f8c48', '#6ea552', '#94c064', '#b8d880');
const WARM = ramp('#a8521e', '#ff9a3a', '#ffd08a', '#fff4d6');

/** A soft patch of ground under a landmark, so it sits on the map rather than on top of it. */
function groundPatch(a: Art, cx: number, cy: number, rx: number, ry: number, pal: RGB[]): void {
  a.oval(cx, cy, rx, ry, (x, y, nx, ny) => {
    const d = nx * nx + ny * ny;
    if (d > 0.72 && bayer(x, y) < (d - 0.72) * 3.6) return null;
    return tone(pal, lit(nx, ny, 0.52) + (hash2(x, y, 3) - 0.5) * 0.2, x, y);
  });
}

/** A standing shape's shadow cast to the bottom right on what's under it. */
function castShadow(a: Art, x0: number, x1: number, y: number, len: number): void {
  for (let k = 0; k < len; k++) for (let x = x0 + k; x <= x1 + k + 1; x++) a.shade(x, y - Math.floor(k / 2), 0.62);
}

function runestone(a: Art, x: number, y: number): void {
  a.rect(x, y - 6, x + 2, y, (px, py, u) => tone(STONE, 0.65 - u * 0.5 - (py === y - 6 ? -0.1 : 0), px, py));
  a.set(x + 1, y - 4, hex('#7ae8ff'));
  a.set(x + 1, y - 2, hex('#bff6ff'));
  a.set(x, y - 6, STONE[2]);
}

function brazier(a: Art, x: number, y: number): void {
  a.rect(x - 1, y - 2, x + 1, y, (px, py, u) => (py === y - 2 ? hex('#6a5a5a') : tone(ramp('#1e1a22', '#3a3238', '#5a4e50'), 0.7 - u * 0.6, px, py)));
  a.set(x, y - 3, WARM[1]);
  a.set(x - 1, y - 3, WARM[0]);
  a.set(x + 1, y - 3, WARM[1]);
  a.set(x, y - 4, WARM[2]);
  a.set(x, y - 5, WARM[3]);
}

/** Runestone Clearing: the Rune Temple, a stone chapel with a slate roof and a lit door, in its clearing. */
function clearingArt(): Art {
  const a = new Art(52, 46);
  groundPatch(a, 26, 39, 24, 7, GRASS);
  // The plaza.
  a.oval(26, 40, 13, 4.2, (x, y, nx, ny) => {
    const ring = nx * nx + ny * ny > 0.7;
    const flag = ((x >> 1) + (y % 2)) % 3 === 0;
    return ring ? STONE[1] : tone(STONE, lit(nx, ny, 0.62) - (flag ? 0.12 : 0), x, y);
  });
  const b = new Art(52, 46);
  // Walls: the front face and, to the right, its shaded side.
  b.rect(16, 25, 34, 37, (x, y, u, v) => {
    const course = (y - 25) % 3 === 2;
    const joint = ((x + (Math.floor((y - 25) / 3) % 2) * 2) % 5) === 0;
    let t = 0.78 - u * 0.25 - v * 0.2;
    if (course || joint) t -= 0.16;
    return tone(STONE, t, x, y);
  });
  b.poly([[35, 25], [38, 23], [38, 35], [35, 37]], (x, y) => tone(STONE, 0.28 - (y % 3 === 0 ? 0.08 : 0), x, y));
  // The roof: slate in rows, lit from the left.
  b.poly([[13, 26], [19, 13], [35, 13], [39, 24], [38, 26]], (x, y) => {
    const row = (y - 13) % 3 === 2;
    const u = (x - 13) / 26;
    let t = 0.8 - u * 0.5 - ((y - 13) / 13) * 0.25;
    if (row) t -= 0.18;
    if (y === 13) t += 0.2;
    return tone(SLATE, t, x, y);
  });
  // The eave's edge.
  b.rect(13, 26, 38, 26, (x) => (x < 30 ? SLATE[1] : SLATE[0]));
  // The bell tower on the ridge, with its rune crystal.
  b.rect(24, 6, 28, 13, (x, y, u) => tone(STONE, 0.8 - u * 0.6 - (y === 9 ? 0.2 : 0), x, y));
  b.rect(25, 9, 26, 10, () => hex('#1a1422'));
  b.poly([[23, 7], [26, 2], [30, 7]], (x, y) => tone(SLATE, x < 26 ? 0.8 : 0.3, x, y));
  // Arched door, warm light spilling out.
  b.rect(23, 30, 27, 37, (x, y) => {
    if (y === 30 && (x === 23 || x === 27)) return null;
    if (y >= 35) return WARM[y === 37 ? 2 : 1];
    return y === 30 || x === 23 || x === 27 ? hex('#2a1a14') : hex('#4a2a1a');
  });
  for (const wx of [19, 31]) {
    b.set(wx, 29, hex('#1a1422'));
    b.set(wx, 30, WARM[2]);
    b.set(wx, 31, WARM[1]);
  }
  b.outline(hex('#140e1c'));
  castShadow(a, 34, 38, 38, 7);
  a.stamp(b, 0, 0);
  // Its rune crystal on top.
  a.set(26, 0, hex('#e0fbff'));
  a.set(26, 1, hex('#7ae8ff'));
  a.set(25, 1, hex('#4ab8e8'));
  // Runestones on the plaza, braziers by the door.
  runestone(a, 5, 40);
  runestone(a, 44, 39);
  brazier(a, 20, 40);
  brazier(a, 32, 40);
  return a;
}

function column(a: Art, x: number, y: number, h: number, broken: boolean): void {
  for (let k = 0; k < h; k++) {
    const py = y - k;
    a.set(x, py, MARBLE[4]);
    a.set(x + 1, py, MARBLE[3]);
    a.set(x + 2, py, MARBLE[1]);
  }
  // Base and capital.
  a.rect(x - 1, y, x + 3, y, (px) => (px < x + 2 ? MARBLE[2] : MARBLE[0]));
  if (!broken) a.rect(x - 1, y - h, x + 3, y - h, (px) => (px < x + 2 ? MARBLE[4] : MARBLE[1]));
  else {
    // Snapped off: a jagged stump.
    a.set(x, y - h, MARBLE[4]);
    a.set(x, y - h - 1, MARBLE[3]);
    a.set(x + 1, y - h, MARBLE[2]);
  }
}

/** A giant flower on a tall stalk: five shaded petals round a gold heart, a leaf on the stalk. */
function bloom(a: Art, x: number, y: number, stalkTo: number, pal: RGB[], big: boolean): void {
  const stem = ramp('#1e3a24', '#2e5a36', '#4f8c48');
  for (let py = y + 2; py <= stalkTo; py++) {
    const sx = x + Math.round(Math.sin(py * 0.4) * 0.7);
    a.set(sx, py, stem[1]);
    a.set(sx + 1, py, stem[0]);
  }
  const ly = Math.round((y + stalkTo) / 2) + 2;
  a.oval(x - 2, ly, 2.5, 1.2, (px, py, nx, ny) => tone(stem, lit(nx, ny, 0.65), px, py));
  const pr = big ? 2 : 1.5;
  const reach = big ? 2.4 : 1.8;
  const petals: [number, number][] = [];
  for (let k = 0; k < 5; k++) {
    const ang = (k * 72 - 90) * (Math.PI / 180);
    petals.push([x + 0.5 + Math.cos(ang) * reach, y + Math.sin(ang) * reach * 0.8]);
  }
  // Back petals first, so the front ones overlap them.
  petals.sort((p, q) => p[1] - q[1]);
  for (const [px, py] of petals) {
    a.oval(px, py, pr, pr * 0.85, (qx, qy, nx, ny) => {
      const edge = nx * nx + ny * ny > 0.6 && (nx > 0.1 || ny > 0.2);
      return tone(pal, lit(nx, ny, 0.62) - (edge ? 0.3 : 0), qx, qy);
    });
  }
  a.set(x, y, hex('#fff0a0'));
  a.set(x + 1, y, hex('#e0a030'));
  if (big) {
    a.set(x, y - 1, hex('#ffe08a'));
    a.set(x + 1, y - 1, hex('#ffe08a'));
  }
}

/** Sunken Garden: a marble fountain pool among broken columns and flowers taller than them. */
function gardenArt(): Art {
  const a = new Art(52, 46);
  groundPatch(a, 26, 38, 25, 8, ramp('#3a6040', '#4c7a4a', '#619152', '#7fa85e', '#a2c070'));
  const pink = ramp('#8a3a5e', '#c85a88', '#f08ab4', '#ffbad6', '#fff0f8');
  const violet = ramp('#5a3a8a', '#8a5ac0', '#b48ae8', '#d8bcff', '#f4ecff');
  // Back: the broken arch and far columns.
  const b = new Art(52, 46);
  column(b, 12, 32, 15, false);
  column(b, 36, 32, 10, true);
  // What's left of the arch between them: the left half, snapped off past the top.
  for (let deg = 180; deg <= 290; deg += 2) {
    const ang = (deg * Math.PI) / 180;
    for (const rr of [11, 12.5]) {
      const x = Math.round(25 + Math.cos(ang) * rr);
      const y = Math.round(17 + Math.sin(ang) * rr * 0.9);
      b.set(x, y, rr > 12 ? MARBLE[4] : MARBLE[1]);
    }
  }
  b.outline(hex('#2a2238'));
  a.stamp(b, 0, 0);
  // Flowers behind the pool.
  bloom(a, 7, 12, 34, pink, true);
  bloom(a, 44, 16, 34, violet, true);
  bloom(a, 30, 7, 26, pink, false);
  // The pool: marble rim, water, and the fountain in its middle.
  const p = new Art(52, 46);
  p.oval(26, 35, 16, 6.5, (x, y, nx, ny) => {
    const d = nx * nx + ny * ny;
    if (d > 0.55) return tone(MARBLE, lit(nx, ny, 0.55) + (ny > 0 ? 0.1 : -0.15), x, y);
    const deep = ny < -0.2 ? 0 : 1;
    return hash2(x, y, 5) < 0.08 ? hex('#e0fbff') : [hex('#2a86a8'), hex('#4ab4c8')][deep];
  });
  p.rect(25, 26, 27, 34, (x) => (x === 25 ? MARBLE[4] : x === 26 ? MARBLE[3] : MARBLE[1]));
  p.oval(26, 27, 4, 1.5, (_x, _y, nx) => (nx < 0.2 ? MARBLE[4] : MARBLE[2]));
  p.outline(hex('#2a2238'));
  a.stamp(p, 0, 0);
  // Spouting water.
  a.set(26, 24, hex('#e0fbff'));
  a.set(26, 25, hex('#9ae8ff'));
  a.set(24, 26, hex('#9ae8ff'));
  a.set(28, 26, hex('#9ae8ff'));
  // Leaves and small flowers in front.
  for (const [x, y] of [[6, 40], [45, 40], [16, 43], [36, 43]] as [number, number][]) {
    a.oval(x, y, 3.5, 1.5, (px, py, nx, ny) => tone(GRASS, lit(nx, ny, 0.55), px, py));
    a.set(x - 1, y - 1, hex('#fff4fa'));
  }
  bloom(a, 4, 30, 38, violet, false);
  return a;
}

/** Spirit Dungeon: a crypt with a spired roof and a doorway full of ghost-light, among dead trees. */
function spiritArt(): Art {
  const a = new Art(52, 48);
  groundPatch(a, 26, 41, 24, 7, ramp('#132628', '#1a3432', '#22423a', '#2d5244', '#3c644c'));
  const moss = ramp('#2a3a36', '#3e524a', '#56685e', '#728278', '#909e92');
  const roof = ramp('#141c22', '#1e2a32', '#2c3a44', '#3e4e58', '#566670');
  const ghost = ramp('#1a6a64', '#3ac4b4', '#6af4dc', '#d0fff6');
  const trees = new Art(52, 48);
  const branch = (pts: [number, number][]) => {
    for (let i = 0; i + 1 < pts.length; i++) trees.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], hex('#2a2230'));
  };
  branch([[6, 42], [6, 30], [4, 24], [2, 18]]);
  branch([[6, 32], [9, 26], [10, 20]]);
  branch([[5, 27], [2, 25]]);
  branch([[45, 42], [46, 32], [48, 26], [47, 18]]);
  branch([[46, 30], [43, 24], [41, 20]]);
  branch([[48, 26], [50, 23]]);
  trees.outline(hex('#0a0810'));
  a.stamp(trees, 0, 0);
  const b = new Art(52, 48);
  // Steps.
  b.rect(13, 38, 39, 41, (x, y, u) => tone(moss, (y === 38 ? 0.8 : 0.5) - u * 0.3, x, y));
  // Walls.
  b.rect(15, 22, 37, 37, (x, y, u) => {
    let t = 0.7 - u * 0.4;
    if ((y - 22) % 4 === 3 || (x + (Math.floor((y - 22) / 4) % 2) * 3) % 6 === 0) t -= 0.14;
    const c = tone(moss, t, x, y);
    return hash2(x, y, 7) < 0.08 ? hex('#3e6a4e') : c;
  });
  // The pointed roof.
  b.poly([[12, 23], [26, 5], [40, 23]], (x, y) => {
    const left = x < 26;
    let t = left ? 0.75 - (26 - x) * 0.01 : 0.25;
    if ((y - 5) % 3 === 2) t -= 0.15;
    return tone(roof, t, x, y);
  });
  // Door: a pointed arch glowing from within.
  b.poly([[21, 38], [21, 29], [26, 24], [31, 29], [31, 38]], (x, y) => {
    const d = Math.hypot((x - 26) / 5, (y - 36) / 10);
    return tone(ghost, 1 - d * 0.9, x, y);
  });
  // Round window.
  b.oval(26, 16, 2.2, 2.2, (_x, _y, nx, ny) => (nx * nx + ny * ny > 0.5 ? hex('#1a2a2a') : ghost[3]));
  b.outline(hex('#0a0e12'));
  a.stamp(b, 0, 0);
  // Gravestones.
  for (const [x, y] of [[4, 44], [10, 45], [42, 44]] as [number, number][]) {
    a.rect(x, y - 4, x + 2, y, (px, py, u) => (py === y - 4 && px !== x + 1 ? null : tone(moss, 0.75 - u * 0.5, px, py)));
    a.set(x + 1, y - 2, moss[0]);
  }
  // Wisps.
  for (const [x, y] of [[11, 22], [42, 16], [36, 10]] as [number, number][]) {
    a.set(x, y, ghost[3]);
    a.set(x + 1, y, ghost[2]);
    a.set(x, y + 1, ghost[1]);
  }
  return a;
}

/** Elementinho Temple: a stepped sandstone temple, four element fires on its tiers and a flame on top. */
function templeArt(): Art {
  const a = new Art(54, 48);
  groundPatch(a, 27, 42, 25, 6, ramp('#4a2422', '#6a3326', '#8c4a2e', '#b26a3a', '#d4924e'));
  const sand = ramp('#6a3a22', '#9a5a34', '#c8864a', '#e8aa62', '#ffd08a', '#fff0c8');
  const b = new Art(54, 48);
  const tier = (x0: number, x1: number, y0: number, y1: number) => {
    b.rect(x0, y0, x1, y1, (x, y, u, v) => {
      let t = 0.72 - v * 0.35 - u * 0.12;
      if (y === y0) t = 0.95;
      if ((y - y0) % 3 === 2) t -= 0.1;
      return tone(sand, t, x, y);
    });
    b.rect(x1 + 1, y0 + 1, x1 + 2, y1, (x, y) => tone(sand, 0.15, x, y));
  };
  tier(6, 45, 31, 42);
  tier(12, 39, 21, 30);
  tier(18, 33, 12, 20);
  // The shrine on top.
  b.rect(22, 6, 29, 11, (x, y, u) => tone(sand, 0.8 - u * 0.5, x, y));
  b.rect(24, 8, 27, 11, () => hex('#2a140e'));
  // The stair up the middle.
  b.rect(23, 12, 28, 42, (x, y) => ((y % 2 === 0 ? 0 : 1) ? (x < 26 ? sand[4] : sand[3]) : x < 26 ? sand[2] : sand[1]));
  b.outline(hex('#1e0e0a'));
  castShadow(a, 44, 48, 42, 6);
  a.stamp(b, 0, 0);
  // The four elements on the tiers' corners.
  const orb = (x: number, y: number, light: string, core: string) => {
    a.set(x, y, hex(core));
    a.set(x + 1, y, hex(light));
    a.set(x, y - 1, hex(light));
    a.set(x + 1, y - 1, hex(core));
    a.set(x, y + 1, hex('#3a2418'));
    a.set(x + 1, y + 1, hex('#3a2418'));
  };
  orb(8, 29, '#5ac8ff', '#d0f4ff');
  orb(43, 29, '#7ad060', '#d8ffc0');
  orb(14, 19, '#c8e8ff', '#ffffff');
  orb(37, 19, '#ff5a2a', '#ffd060');
  // The flame that would not go out.
  const flame: [number, number, string][] = [
    [26, 0, '#ffd060'],
    [25, 1, '#ff8a2a'], [26, 1, '#fff0b0'], [27, 1, '#ffc048'],
    [24, 2, '#ff5a1e'], [25, 2, '#ffc048'], [26, 2, '#fff0b0'], [27, 2, '#ffc048'],
    [24, 3, '#ff5a1e'], [25, 3, '#ff8a2a'], [26, 3, '#ffd060'], [27, 3, '#ff8a2a'], [28, 3, '#c83a1a'],
    [25, 4, '#c83a1a'], [26, 4, '#ff8a2a'], [27, 4, '#c83a1a'],
    [25, 5, '#6a2a14'], [26, 5, '#8a3a1a'], [27, 5, '#6a2a14'],
  ];
  for (const [x, y, c] of flame) a.set(x, y, hex(c));
  return a;
}

function prism(a: Art, x: number, y: number, h: number, w: number, pal: RGB[]): void {
  for (let k = 0; k < h; k++) {
    const hw = k >= h - 2 ? 0 : w;
    for (let dx = 0; dx <= hw; dx++) a.set(x + dx - (hw >> 1), y - k, dx === 0 ? pal[4] : dx === hw ? pal[1] : pal[3]);
  }
  a.set(x, y - h, pal[4]);
}

/** The Glimmerdeep: a cave mouth in a crystal-crowned hill, violet light within, glowing mushrooms by it. */
function deepArt(): Art {
  const a = new Art(56, 44);
  groundPatch(a, 28, 38, 26, 6, ramp('#34463a', '#465a44', '#58704e', '#6e865a', '#8c9e6a'));
  const b = new Art(56, 44);
  // The hill of rock.
  b.oval(28, 30, 25, 16, (x, y, nx, ny) => {
    if (y > 40) return null;
    // A lumpy crown of boulders instead of a smooth dome.
    if (ny < -1 + valueNoise(x, 0, 4, 5) * 0.45 + Math.abs(nx) * 0.1) return null;
    let v = lit(nx, ny, 0.55) + (valueNoise(x * 2, y, 3, 9) - 0.5) * 0.3;
    if ((y + (x >> 2)) % 5 === 0) v -= 0.1;
    return tone(ROCKS, v, x, y);
  });
  // The cave's mouth.
  b.poly([[18, 41], [19, 32], [23, 26], [28, 24], [33, 26], [37, 32], [38, 41]], (x, y) => {
    const d = Math.hypot((x - 28) / 9, (y - 41) / 14);
    return tone(ramp('#0a0614', '#1a0e2e', '#3a1e60', '#6a3aa0', '#b37aff'), 0.95 - d * 1.1, x, y);
  });
  b.outline(hex('#0a0814'));
  castShadow(a, 44, 52, 40, 5);
  a.stamp(b, 0, 0);
  const amethyst = ramp('#3a1e6a', '#6a3aa8', '#9a6ae0', '#c8a0ff', '#f0e0ff');
  prism(a, 10, 26, 7, 2, amethyst);
  prism(a, 13, 27, 4, 1, amethyst);
  prism(a, 41, 22, 9, 2, amethyst);
  prism(a, 45, 24, 5, 1, amethyst);
  prism(a, 30, 16, 8, 2, amethyst);
  prism(a, 26, 17, 5, 1, amethyst);
  // Glowing mushrooms.
  for (const [x, y] of [[9, 41], [47, 40], [15, 42]] as [number, number][]) {
    a.set(x, y, hex('#c8d0e0'));
    a.set(x, y - 1, hex('#c8d0e0'));
    a.rect(x - 1, y - 3, x + 1, y - 2, (px, py) => (py === y - 3 ? hex('#b0ffff') : px === x + 1 ? hex('#2aa8c8') : hex('#5af0ff')));
  }
  return a;
}

/** The Cosmos Arena: a platform of dark stone adrift above Starfall Peak, rune-ringed, under a scatter of stars. */
function cosmosArt(): Art {
  const a = new Art(60, 76);
  // The summit.
  const peak = mountain(30, 72, 28, 40, 777, GROUND[ROCK], true);
  peak.draw(a);
  // The beam from the platform to the peak.
  for (let y = 22; y < 34; y++) for (let x = 28; x <= 32; x++) a.over(x, y, hex('#e0d0ff'), x === 30 ? 0.7 : 0.35);
  const void_ = ramp('#120c28', '#1e1640', '#2e2460', '#443884', '#6050b0');
  const b = new Art(60, 76);
  // The platform's underside: rock tapering to a point.
  b.poly([[13, 17], [47, 17], [40, 22], [34, 26], [30, 29], [26, 26], [20, 22]], (x, y) => tone(ROCKS, 0.62 - (x - 13) / 34 * 0.5 - (y - 17) * 0.02, x, y));
  // Its top.
  b.oval(30, 15, 17, 5.2, (x, y, nx, ny) => {
    const d = nx * nx + ny * ny;
    if (d > 0.82) return tone(void_, ny > 0 ? 0.2 : 0.7, x, y);
    if (Math.abs(d - 0.45) < 0.08) return hash2(x, y, 3) < 0.7 ? hex('#d8c8ff') : hex('#9a80ff');
    return hash2(x, y, 9) < 0.06 ? hex('#fff4d6') : tone(void_, lit(nx, ny, 0.45), x, y);
  });
  b.outline(hex('#08061a'));
  a.stamp(b, 0, 0);
  // Stars about it.
  const star = (x: number, y: number, big: boolean) => {
    a.set(x, y, hex('#fff4d6'));
    if (!big) return;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) a.set(x + dx, y + dy, hex('#b89cff'));
  };
  star(6, 6, true);
  star(52, 3, true);
  star(46, 9, false);
  star(14, 2, false);
  star(30, 3, true);
  star(56, 20, false);
  star(3, 18, false);
  return a;
}

/** The Endless Rift: a torn fissure in the purple waste, hot light inside, shards hanging over it. */
function riftArt(): Art {
  const a = new Art(60, 36);
  groundPatch(a, 30, 26, 29, 8, ramp('#1a1226', '#261c36', '#342848', '#44365a', '#58486e'));
  const tear = new Art(60, 36);
  const top: [number, number][] = [[3, 26], [9, 24], [14, 25], [19, 21], [25, 22], [30, 19], [35, 22], [40, 21], [45, 24], [50, 23], [57, 25]];
  const bottom: [number, number][] = [[50, 27], [45, 29], [39, 28], [34, 31], [29, 29], [24, 31], [19, 28], [14, 29], [8, 27]];
  tear.poly([...top, ...bottom], (x, y) => {
    const mid = 25.5 - Math.abs(x - 30) * 0.03;
    const d = Math.abs(y - mid) / 4 + Math.abs(x - 30) / 34;
    return tone(ramp('#3a0c34', '#8a1a6a', '#ff5ac0', '#ff9ad8', '#ffe4f6'), 1.05 - d * 0.9, x, y);
  });
  tear.outline(hex('#0e0816'));
  // The torn lips catch the light on their upper side.
  for (const [x, y] of top) tear.set(x, y - 1, hex('#8a74a8'));
  a.stamp(tear, 0, 0);
  const shard = ramp('#4a1a4a', '#8a2a78', '#d04aa8', '#ff8ad8', '#ffe0f4');
  const diamond = (cx: number, cy: number, h: number) => {
    for (let k = -h; k <= h; k++) {
      const hw = Math.round((1 - Math.abs(k) / h) * 2);
      for (let dx = -hw; dx <= hw; dx++) a.set(cx + dx, cy + k, dx < 0 ? shard[3] : dx === 0 ? shard[4] : shard[1]);
    }
  };
  diamond(17, 11, 4);
  diamond(31, 5, 5);
  diamond(44, 12, 3);
  a.set(24, 14, hex('#ffd0f0'));
  a.set(38, 16, hex('#ffd0f0'));
  return a;
}

/** The Floating Island: a grassy disc with a marble duelling ring, on a tapering rock, adrift over the sea. */
function islandArt(): Art {
  const a = new Art(52, 58);
  const earth = ramp('#2e2018', '#4a3426', '#6e5236', '#9a7a4e', '#c4a676');
  const b = new Art(52, 58);
  // Underside.
  const under: [number, number][] = [[4, 16], [48, 16], [44, 24], [38, 30], [34, 38], [29, 47], [26, 54], [23, 46], [18, 36], [12, 28], [7, 22]];
  b.poly(under, (x, y) => {
    let v = 0.72 - (x - 4) / 44 * 0.6 - (y - 16) * 0.008;
    if ((y + (x >> 3)) % 4 === 0) v -= 0.12;
    return tone(earth, v, x, y);
  });
  // The top: grass, and the marble ring.
  b.oval(26, 14, 22, 7.5, (x, y, nx, ny) => {
    const d = nx * nx + ny * ny;
    const ring = Math.abs(Math.hypot(nx * 22 / 13, ny * 7.5 / 4.6) - 1) < 0.16;
    if (ring) return ny < 0 ? MARBLE[4] : MARBLE[2];
    if (d < 0.3 && Math.hypot(nx * 22 / 13, ny * 7.5 / 4.6) < 1) return tone(MARBLE, 0.55 + (hash2(x, y, 5) - 0.5) * 0.2, x, y);
    return tone(GRASS, lit(nx, ny, 0.55) + (hash2(x, y, 3) - 0.5) * 0.2, x, y);
  });
  b.rect(4, 17, 48, 18, (x, y) => {
    const nx = (x - 26) / 22;
    if (Math.abs(nx) > Math.sqrt(1 - 0.02)) return null;
    return y === 17 ? GRASS[1] : earth[2];
  });
  b.outline(hex('#140e14'));
  a.stamp(b, 0, 0);
  // Columns round the ring.
  for (const [x, y, h] of [[13, 13, 5], [37, 13, 5], [18, 18, 4], [32, 18, 4], [25, 9, 4]] as [number, number, number][]) {
    for (let k = 0; k < h; k++) {
      a.set(x, y - k, MARBLE[4]);
      a.set(x + 1, y - k, MARBLE[1]);
    }
    a.set(x, y - h, MARBLE[4]);
    a.set(x + 1, y - h, MARBLE[3]);
  }
  // A thread of waterfall off the edge.
  for (let y = 18; y < 34; y++) if (y < 28 || hash2(9, y, 3) < 0.6) a.set(8 + (y > 26 ? 1 : 0), y, y < 24 ? hex('#bfe8ff') : hex('#7ac0e8'));
  // Clouds about its roots.
  const cloud = ramp('#8a8cb8', '#b8bcd8', '#e4e6f4', '#ffffff');
  for (const [x, y, r] of [[10, 34, 4], [15, 36, 3.5], [40, 32, 4.5], [35, 35, 3]] as [number, number, number][]) {
    a.oval(x, y, r, r * 0.6, (px, py, nx, ny) => tone(cloud, lit(nx, ny, 0.6), px, py));
  }
  return a;
}

/** Sky Glide: a wooden launch deck out over the cliff, a glider resting on it and a windsock streaming. */
function glideArt(): Art {
  const a = new Art(46, 40);
  groundPatch(a, 16, 34, 15, 5, GRASS);
  const wood = ramp('#3e2616', '#6a4428', '#8e5e34', '#b07a44', '#d8a46a');
  const sail = ramp('#1e5a86', '#3a8ec0', '#6ac4e8', '#bfeaff', '#ffffff');
  const b = new Art(46, 40);
  // Posts under the deck, the far ones reaching down the cliff.
  for (const [x, h] of [[12, 4], [24, 6], [36, 8]] as [number, number][]) b.rect(x, 32, x + 1, 32 + h, (px) => (px === x ? wood[1] : wood[0]));
  b.line(24, 37, 35, 32, wood[1]);
  // The deck, planks running out over the edge.
  b.rect(8, 29, 42, 31, (x, y) => (y === 29 ? (x % 4 === 0 ? wood[3] : wood[4]) : y === 30 ? (x % 4 === 0 ? wood[1] : wood[2]) : wood[0]));
  // The windsock's pole.
  b.rect(10, 5, 10, 28, (_x, y) => (y < 7 ? hex('#ffe08a') : wood[1]));
  b.outline(hex('#140e14'));
  a.stamp(b, 0, 0);
  // The windsock, striped, streaming out to sea.
  for (let x = 11; x <= 21; x++) {
    const hw = Math.max(0, Math.round(2 - (x - 11) * 0.18));
    const y0 = 8 + Math.round((x - 11) * 0.15);
    for (let dy = -hw; dy <= hw; dy++) a.set(x, y0 + dy, Math.floor((x - 11) / 3) % 2 ? hex('#ff8a5a') : dy < 0 ? sail[4] : sail[3]);
  }
  // The glider resting on the deck: a swept wing on its frame.
  a.poly([[18, 27], [31, 17], [42, 27], [31, 24]], (x, y) => {
    const left = x < 31;
    let v = left ? 0.8 - (31 - x) * 0.012 : 0.42 - (x - 31) * 0.02;
    if (y === 24 || (x - 31) % 5 === 0) v -= 0.12;
    return tone(sail, v, x, y);
  });
  a.line(18, 27, 31, 17, hex('#1a2a3a'));
  a.line(31, 17, 42, 27, hex('#1a2a3a'));
  a.line(31, 17, 31, 28, hex('#3a3a4a'));
  // Curls of wind.
  for (const [x, y] of [[33, 9], [34, 8], [35, 8], [36, 9], [39, 13], [40, 12], [41, 12]] as [number, number][]) a.set(x, y, hex('#e0f4ff'));
  return a;
}

/**
 * The Everwood: an elder oak towering over a wood of every colour (green,
 * autumn gold, blossom pink and dark pine), a trail winding in under it to a
 * campfire at its roots, and fireflies about its crown.
 */
function forestArt(): Art {
  const a = new Art(64, 58);
  groundPatch(a, 32, 50, 30, 8, GRASS);
  const elderLeaf = ramp('#123424', '#1c4a2c', '#2a6434', '#3e803e', '#5c9e48', '#86bc5a');
  const bark = ramp('#241810', '#3e2a1c', '#5a3e28', '#7a563a');
  const glow = ramp('#2a8a7a', '#5ad8c0', '#b8fff0');
  // The wood behind: a ragged line of crowns in many colours.
  const back = new Art(64, 58);
  const crowns: [number, number, number, RGB[]][] = [
    [6, 34, 5, TREE.pine], [13, 30, 6, TREE.autumn], [22, 27, 6, TREE.green], [42, 27, 6, TREE.blossom],
    [51, 30, 6, TREE.green], [58, 34, 5, TREE.autumn], [3, 40, 4, TREE.green], [61, 41, 4, TREE.pine],
  ];
  for (const [x, y, r, pal] of crowns) {
    back.oval(x, y, r, r * 0.85, (px, py, nx, ny) => tone(pal, lit(nx, ny, 0.5) + (hash2(px, py, 41) - 0.5) * 0.3, px, py));
    back.rect(x, y + Math.round(r * 0.8), x, y + Math.round(r * 0.8) + 2, () => TRUNK[1]);
  }
  back.outline(hex('#0a140e'));
  a.stamp(back, 0, 0);
  // The elder: a thick, twisted trunk splitting into limbs, and roots gripping the ground.
  const tree = new Art(64, 58);
  tree.poly([[27, 50], [29, 30], [35, 30], [37, 50], [41, 52], [23, 52]], (x, y) => {
    const u = (x - 23) / 18;
    const seam = Math.abs(Math.sin((y + x * 0.7) * 0.5)) > 0.85;
    return tone(bark, 0.8 - u * 0.6 - (seam ? 0.25 : 0), x, y);
  });
  tree.line(29, 32, 22, 22, bark[2]);
  tree.line(35, 32, 42, 21, bark[1]);
  tree.line(32, 31, 32, 18, bark[2]);
  // Its runes, glowing faintly.
  tree.set(31, 40, glow[2]);
  tree.set(31, 42, glow[1]);
  tree.set(32, 41, glow[1]);
  tree.set(31, 44, glow[1]);
  // The great crown: clumps piled into a hill of leaves.
  const clumps: [number, number, number][] = [[32, 12, 10], [20, 18, 9], [44, 18, 9], [26, 7, 7], [39, 8, 7], [14, 24, 6], [50, 24, 6], [32, 22, 8]];
  for (const [x, y, r] of clumps) {
    tree.oval(x, y, r, r * 0.8, (px, py, nx, ny) => {
      const edge = nx * nx + ny * ny > 0.66 && (nx > 0.2 || ny > 0.3);
      return tone(elderLeaf, lit(nx, ny, 0.56) + (hash2(px, py, 43) - 0.5) * 0.28 - (edge ? 0.3 : 0) - (y - 7) * 0.012, px, py);
    });
  }
  tree.outline(hex('#08120c'));
  a.stamp(tree, 0, 0);
  // Moss hanging from the crown's underside.
  for (const [x, len] of [[18, 4], [23, 6], [41, 5], [46, 3], [29, 3]] as [number, number][]) for (let k = 0; k < len; k++) a.set(x, 26 + k, elderLeaf[k % 2 ? 1 : 2]);
  // The trail winding in, and the campfire at the elder's roots.
  for (let k = 0; k < 14; k++) {
    const x = Math.round(44 + k * 0.9 + Math.sin(k * 0.6) * 2);
    const y = 51 + Math.round(k * 0.4);
    a.set(x, y, hex('#b89a6a'));
    a.set(x + 1, y, hex('#8a6e4a'));
  }
  a.set(44, 50, WARM[1]);
  a.set(43, 50, WARM[0]);
  a.set(45, 50, WARM[0]);
  a.set(44, 49, WARM[2]);
  a.set(44, 48, WARM[3]);
  // Fireflies.
  for (const [x, y] of [[9, 20], [55, 16], [48, 6], [12, 10], [58, 26]] as [number, number][]) {
    a.set(x, y, hex('#e8ff9a'));
    a.set(x + 1, y, hex('#9ac84a'));
  }
  return a;
}

/** A waymarker for an arena that has no landmark of its own yet. */
function waymarkArt(): Art {
  const a = new Art(16, 20);
  a.rect(7, 6, 8, 18, (x) => (x === 7 ? TRUNK[2] : TRUNK[1]));
  a.rect(2, 4, 13, 8, (x, y) => (y === 4 ? hex('#e8c890') : x === 13 || y === 8 ? hex('#7a5230') : hex('#b88a54')));
  a.rect(4, 6, 11, 6, () => hex('#5a3a22'));
  a.outline(hex('#1a1016'));
  return a;
}

const LANDMARK_ART: Record<string, () => Art> = {
  clearing: clearingArt,
  garden: gardenArt,
  spirit: spiritArt,
  temple: templeArt,
  deep: deepArt,
  cosmos: cosmosArt,
  rift: riftArt,
  island: islandArt,
  glide: glideArt,
  forest: forestArt,
  waymark: waymarkArt,
};

// ---------------------------------------------------------------- Small pieces

/** A soft cloud of fog: rounded puffs, lit on top. */
function cloudArt(seed: number): Art {
  const a = new Art(44, 24);
  const rand = rng(seed);
  const cloud = ramp('#7a7ca8', '#a4a8cc', '#ccd0e8', '#eceef8', '#ffffff');
  const puffs: [number, number, number][] = [
    [12, 15, 7],
    [22, 11, 9],
    [32, 14, 7.5],
    [17, 17, 6],
    [28, 18, 6],
  ].map(([x, y, r]) => [x + (rand() - 0.5) * 3, y + (rand() - 0.5) * 2, r * (0.9 + rand() * 0.2)]);
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 44; x++) {
      let best = -1;
      let nx = 0;
      let ny = 0;
      for (const [cx, cy, r] of puffs) {
        const dx = (x + 0.5 - cx) / r;
        const dy = (y + 0.5 - cy) / (r * 0.78);
        const f = 1 - (dx * dx + dy * dy);
        if (f > best) {
          best = f;
          nx = dx;
          ny = dy;
        }
      }
      if (best <= 0) continue;
      // The underside is flat and shaded; the edge dithers away.
      if (y > 20) continue;
      if (best < 0.18 && bayer(x, y) > best * 5) continue;
      a.set(x, y, tone(cloud, lit(nx, ny, 0.62) - (y > 17 ? 0.25 : 0), x, y));
    }
  }
  return a;
}

/** A pennant on a pole: planted where a boss was slain (red for a Legend, violet for a Myth). */
function flagArt(myth: boolean, wave: number): Art {
  const a = new Art(10, 15);
  const cloth = myth ? ramp('#3a1e6a', '#6a3aa8', '#9a6ae0', '#c8a0ff') : ramp('#6a1414', '#a82a22', '#e04a32', '#ff8a5a');
  a.rect(1, 1, 1, 14, (_x, y) => (y === 14 ? hex('#2a1a12') : hex('#8a5a30')));
  a.set(1, 0, hex('#ffe08a'));
  for (let x = 2; x <= 8; x++) {
    const sag = Math.round(Math.sin((x + wave * 2) * 0.9) * 0.6);
    const hh = Math.round(4 - (x - 2) * 0.45);
    for (let y = 0; y <= hh; y++) a.set(x, 2 + y + sag, y === 0 ? cloth[3] : y === hh ? cloth[0] : cloth[(x + wave) % 2 ? 2 : 1]);
  }
  a.set(4, 3 + Math.round(Math.sin((4 + wave * 2) * 0.9) * 0.6), hex('#ffe08a'));
  return a;
}

/** A soft round glow, for additive light: white, in dithered steps. */
function glowArt(): Art {
  const a = new Art(32, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16) / 16;
      if (d >= 1) continue;
      const v = Math.floor((1 - d) * (1 - d) * 5 + bayer(x, y) * 0.9) / 5;
      if (v > 0) a.set(x, y, [255, 255, 255], Math.round(v * 255));
    }
  }
  return a;
}

function sparkArt(size: number): Art {
  const a = new Art(5, 5);
  a.set(2, 2, hex('#ffffff'));
  if (size > 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) a.set(2 + dx, 2 + dy, hex('#bfe8ff'));
  if (size > 1) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) a.set(2 + dx, 2 + dy, hex('#6cb8d0'));
  return a;
}

function shadowArt(): Art {
  const a = new Art(14, 5);
  a.oval(7, 2.5, 7, 2.5, () => [10, 8, 20]);
  for (let i = 3; i < a.data.length; i += 4) if (a.data[i]) a.data[i] = 110;
  return a;
}

/** A little ship with a white sail, facing right (flipped to sail left). */
function shipArt(bob: number): Art {
  const a = new Art(16, 14);
  const y0 = bob;
  a.poly([[1, 9 + y0], [15, 9 + y0], [13, 12 + y0], [3, 12 + y0]], (x, y) => (y === 9 + y0 ? hex('#b07a44') : x > 11 ? hex('#4a2e1a') : hex('#7a5230')));
  a.rect(7, 1 + y0, 7, 9 + y0, () => hex('#4a3020'));
  a.poly([[8, 1 + y0], [14, 7 + y0], [8, 8 + y0]], (x) => (x > 11 ? hex('#c8ccd8') : hex('#fffcf6')));
  a.poly([[6, 3 + y0], [6, 8 + y0], [2, 8 + y0]], () => hex('#e4e6f0'));
  a.set(7, y0, hex('#ff5a4a'));
  a.outline(hex('#140e14'));
  // Wake.
  a.set(0, 13, hex('#bfe8ff'));
  a.set(2, 13, hex('#e0fbff'));
  return a;
}

/** Pack art into one texture, left to right in rows, and name each frame. */
function atlas(scene: Phaser.Scene, key: string, parts: [string, Art][], width: number): void {
  let x = 0;
  let y = 0;
  let rowH = 0;
  const at: [string, number, number, Art][] = [];
  for (const [name, art] of parts) {
    if (x + art.w > width) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    at.push([name, x, y, art]);
    x += art.w + 1;
    rowH = Math.max(rowH, art.h);
  }
  const sheet = new Art(width, y + rowH);
  for (const [, px, py, art] of at) sheet.stamp(art, px, py);
  const tex = scene.textures.addCanvas(key, sheet.toCanvas())!;
  for (const [name, px, py, art] of at) tex.add(name, 0, px, py, art.w, art.h);
}

/**
 * The world map's textures: `wm_land` (the whole map), `wm_places` (a
 * landmark per arena) and `wm_bits` (fog, flags, glow, sparkles, the hero's
 * shadow and the ship). Run a step at a time; `wm_bits` comes last.
 */
export function* worldMapTextures(scene: Phaser.Scene): Generator<void, void, void> {
  const land = yield* paintLand();
  paintRoad(land);
  yield;
  yield* paintProps(land);
  paintCompass(land.map);
  const tex = scene.textures.addCanvas('wm_land', land.map.toCanvas())!;
  // Where the sea may glint, carried as named single-pixel frames.
  land.sea.forEach(([x, y], i) => tex.add(`sea${i}`, 0, x, y, 1, 1));
  yield;
  atlas(
    scene,
    'wm_places',
    Object.entries(LANDMARK_ART).map(([id, draw]) => [id, draw()]),
    256,
  );
  yield;
  atlas(
    scene,
    'wm_bits',
    [
      ['cloud0', cloudArt(1)],
      ['cloud1', cloudArt(2)],
      ['cloud2', cloudArt(3)],
      ['glow', glowArt()],
      ['legend0', flagArt(false, 0)],
      ['legend1', flagArt(false, 1)],
      ['myth0', flagArt(true, 0)],
      ['myth1', flagArt(true, 1)],
      ['spark0', sparkArt(0)],
      ['spark1', sparkArt(1)],
      ['spark2', sparkArt(2)],
      ['shadow', shadowArt()],
      ['ship0', shipArt(0)],
      ['ship1', shipArt(1)],
    ],
    160,
  );
}
