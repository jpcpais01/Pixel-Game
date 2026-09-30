// Sky Glide's art, flat and unlit with its light painted in from the upper
// left like the Floating Island's sky: the sea of clouds far below (one tile
// that repeats), cloud tops on the deck, the floating islets (grass, strata,
// hanging roots, trees, ruins, the beacons' lanterns and the goal's landing
// meadow), rings with a glint running round them, the swirl of an updraft,
// a wind streak, the finish arch, and the glider itself, painted in the
// hero's own colour. All of it but the glider is drawn by the arena worker,
// so none of it may touch the page.

import { Bitmap, bayer, clamp01, mix } from './bitmap';
import { hash2, rng, valueNoise } from './env';
import { hex, type RGB } from './pixel';
import { BEACON_AT, type SkyIslet } from '../world/glideLayout';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** A ramp step, dithered between neighbours so gradients read as pixel art. */
const pick = (r: RGB[], idx: number, x: number, y: number): RGB => r[Math.max(0, Math.min(r.length - 1, Math.floor(idx + bayer(x, y))))];

const smooth = (a: number, b: number, v: number): number => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Pick along a colour ramp, 0..1, blending between its steps. */
function along(r: RGB[], t: number): RGB {
  const f = clamp01(t) * (r.length - 1);
  const i = Math.min(r.length - 2, Math.floor(f));
  return mix(r[i], r[i + 1], f - i);
}

const SKY_DEEP = ramp('#2e66b4', '#3a78c6', '#4a8ad2', '#5e9edc', '#78b4e8', '#96c8f0');
const CLOUD = ramp('#7c8cc0', '#98a8d4', '#b4c2e2', '#d0daf0', '#e6ecf8', '#f6f9ff', '#ffffff');
const WARM: RGB = hex('#fff0d6');
const HAZE: RGB = hex('#b4d6f2');

// ---------------------------------------------------------------- The sea of clouds

export const SEA_TILE = 256;

/** Value noise that repeats every `period` pixels, on cells `cx` by `cy`. */
function pnoise(x: number, y: number, cx: number, cy: number, period: number, seed: number): number {
  const nx = period / cx;
  const ny = period / cy;
  const fx = x / cx;
  const fy = y / cy;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const w = (i: number, n: number) => ((i % n) + n) % n;
  const a = hash2(w(x0, nx), w(y0, ny), seed);
  const b = hash2(w(x0 + 1, nx), w(y0, ny), seed);
  const c = hash2(w(x0, nx), w(y0 + 1, ny), seed);
  const d = hash2(w(x0 + 1, nx), w(y0 + 1, ny), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Tiling fbm: clouds wider than tall, as seen from this angle. */
function pfbm(x: number, y: number, seed: number, cells: [number, number][]): number {
  let v = 0;
  let amp = 0.5;
  let total = 0;
  for (let i = 0; i < cells.length; i++) {
    v += pnoise(x, y, cells[i][0], cells[i][1], SEA_TILE, seed + i * 17) * amp;
    total += amp;
    amp *= 0.5;
  }
  return v / total;
}

const SEA_CELLS: [number, number][] = [
  [128, 64],
  [64, 32],
  [32, 16],
  [16, 8],
];
const WARP_CELLS: [number, number][] = [
  [128, 128],
  [64, 64],
];

/**
 * The sea of clouds far below, one tile that repeats both ways: sunlit
 * billows with deep blue sky in their gaps, hazed by the distance.
 */
export function* seaTile(): Generator<void, Uint8ClampedArray, void> {
  const S = SEA_TILE;
  const dens = new Float32Array(S * S);
  const fine = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    if (y % 16 === 0) yield;
    for (let x = 0; x < S; x++) {
      const wx = x + (pfbm(x, y, 13, WARP_CELLS) - 0.5) * 70;
      const wy = y + (pfbm(x, y, 31, WARP_CELLS) - 0.5) * 44;
      dens[y * S + x] = pfbm(wx, wy, 5, SEA_CELLS);
      fine[y * S + x] = pnoise(x, y, 16, 16, S, 9) * 0.6 + pnoise(x, y, 8, 8, S, 21) * 0.4;
    }
  }
  const at = (g: Float32Array, x: number, y: number) => g[(((y % S) + S) % S) * S + (((x % S) + S) % S)];
  const px = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) {
    if (y % 32 === 0) yield;
    for (let x = 0; x < S; x++) {
      const n = at(dens, x, y);
      const f = at(fine, x, y);
      let col = along(SKY_DEEP, 0.4 + (f - 0.5) * 0.35);
      const d = smooth(0.45, 0.63, n + (f - 0.5) * 0.08);
      if (d > 0) {
        // Sunward sides (upper left) glow; the far sides sink into lavender.
        const lit = (n - at(dens, x + 5, y + 7)) * 6;
        let c = along(CLOUD, clamp01(0.36 + d * 0.3 + lit + (f - 0.5) * 0.18));
        if (lit > 0.12) c = mix(c, WARM, Math.min(0.45, (lit - 0.12) * 2));
        col = mix(col, c, Math.min(1, d * 1.5));
      }
      col = mix(col, HAZE, 0.14);
      const q = 6;
      const b = bayer(x, y);
      const i = (y * S + x) * 4;
      px[i] = Math.min(255, Math.floor(col[0] / q + b) * q);
      px[i + 1] = Math.min(255, Math.floor(col[1] / q + b) * q);
      px[i + 2] = Math.min(255, Math.floor(col[2] / q + b) * q);
      px[i + 3] = 255;
    }
  }
  return px;
}

// ---------------------------------------------------------------- Cloud tops on the deck

export const PUFF_W = 150;
export const PUFF_H = 60;

/** A billow of cloud tops, lit from the upper left, shaded lavender beneath, soft at its edges. */
export function deckPuff(v: number): Bitmap {
  const out = new Bitmap(PUFF_W, PUFF_H);
  const R = rng(900 + v * 37);
  const blobs = Array.from({ length: 9 + v }, () => {
    const t = R();
    return { x: 22 + t * (PUFF_W - 44), y: PUFF_H * 0.58 + (R() - 0.5) * 12 - Math.sin(t * Math.PI) * 8, r: 9 + R() * 11 + Math.sin(t * Math.PI) * 6 };
  });
  const H = new Float32Array(PUFF_W * PUFF_H);
  for (let y = 0; y < PUFF_H; y++) {
    for (let x = 0; x < PUFF_W; x++) {
      let d = 0;
      for (const b of blobs) {
        const k = 1 - Math.hypot((x - b.x) / (b.r * 1.55), (y - b.y) / b.r);
        if (k > 0) d = Math.max(d, Math.sqrt(k));
      }
      H[y * PUFF_W + x] = d + (valueNoise(x, y, 7, 40 + v) - 0.5) * 0.22;
    }
  }
  const h = (x: number, y: number) => (x < 0 || y < 0 || x >= PUFF_W || y >= PUFF_H ? 0 : H[y * PUFF_W + x]);
  for (let y = 0; y < PUFF_H; y++) {
    for (let x = 0; x < PUFF_W; x++) {
      const d = h(x, y);
      if (d <= 0.06) continue;
      // Soft edge: a dithered fade over the outer rim.
      if (d < 0.2 && bayer(x, y) > (d - 0.06) / 0.14) continue;
      const lit = (h(x + 1, y) - h(x - 1, y)) * -0.6 + (h(x, y + 1) - h(x, y - 1)) * -0.8;
      // Seen a little from the side: the lower rim of each billow is in shade.
      const under = smooth(0.1, 0.5, h(x, y - 3) - d);
      let c = along(CLOUD, clamp01(0.55 + d * 0.25 - lit * 1.6 - under * 0.45 + (hash2(x, y, v) - 0.5) * 0.06));
      if (-lit > 0.12) c = mix(c, WARM, Math.min(0.4, (-lit - 0.12) * 2));
      const a = d > 0.35 ? 240 : d > 0.2 ? 190 : 130;
      out.set(x, y, c, a);
    }
  }
  return out;
}

// ---------------------------------------------------------------- Floating islets

const GRASS = ramp('#1e4830', '#28603a', '#347a40', '#468e46', '#5ca64e', '#78bc58', '#9ad066', '#c0e27a');
const SOIL = ramp('#3c2418', '#553421', '#6e472b');
const ROCK = ramp('#2e2638', '#3e3448', '#514458', '#665868', '#7c6e7c', '#948690', '#aca0a6');
const LEAF = ramp('#163c26', '#20542e', '#2e6c38', '#448a46', '#62a654', '#86c064', '#aad674');
const BARK = ramp('#2e1c14', '#4a2e1c', '#6a4428');
const MARBLE = ramp('#6a6480', '#88829a', '#a6a0b4', '#c6c2d0', '#e0dde6', '#f4f2f6', '#ffffff');
const STONE = ramp('#4c4a5c', '#666478', '#848296', '#a4a2b4', '#c4c2d0');
const CRYSTAL = ramp('#1a5a8a', '#2a86c0', '#4ab8e8', '#8ae4ff', '#dcfaff');
const FLOWERS: RGB[] = ramp('#ff9ec8', '#fff4fa', '#ffe07a', '#c8a4ff', '#ff8a6a');

/** An islet's picture and where in it the middle of its top surface lies. */
export interface IsletArt {
  img: Bitmap;
  /** The top surface's middle, in image pixels. */
  ox: number;
  oy: number;
}

/** Room left above the top surface for what stands on it. */
const PAD_TOP: Record<SkyIslet['kind'], number> = { grove: 30, rock: 14, ruin: 26, beacon: 30, goal: 34 };

/** An islet image's size, and where in it the middle of its top surface lies (the game places it by that). */
export function isletBox(l: SkyIslet): { w: number; h: number; ox: number; oy: number } {
  const w = Math.ceil(l.rx * 2.25) + 12;
  const pad = PAD_TOP[l.kind];
  return { w, h: pad + Math.ceil(l.ry * 2.2) + Math.ceil(l.thick * 1.15) + 18, ox: w / 2, oy: pad + l.ry + 2 };
}

/**
 * A floating islet, seen from a little above: its grassy top lit from the
 * upper left with a bright rim, the soil under the turf, and rock in
 * strata hanging beneath its front, tapering to a ragged point, with roots
 * and vines dangling. On top: trees (a grove), boulders (a rock), marble
 * ruins, a beacon's crystal lantern, or the goal's landing meadow.
 */
export function isletArt(l: SkyIslet): IsletArt {
  const { rx, ry, thick, kind, seed } = l;
  const R = rng(seed * 131 + 7);
  const { w: W, h: H, ox, oy } = isletBox(l);
  const out = new Bitmap(W, H);
  const put = (x: number, y: number, c: RGB, a = 255) => out.set(x, y, c, a);
  const wob = (a: number) => 1 + Math.sin(a * 3 + seed) * 0.06 + Math.sin(a * 5 + seed * 2.3) * 0.035 + Math.sin(a * 11 + seed) * 0.015;
  const rOf = (x: number, y: number) => {
    const u = (x + 0.5 - ox) / rx;
    const v = (y + 0.5 - oy) / ry;
    return Math.hypot(u, v) / wob(Math.atan2(v, u));
  };

  // The rock underneath first: each column hangs from the top's front edge.
  const front: number[] = new Array(W).fill(-1);
  for (let x = 0; x < W; x++) {
    for (let y = Math.floor(oy); y < oy + ry * 1.3; y++) if (rOf(x, y) <= 1) front[x] = y;
  }
  const hang: number[] = new Array(W).fill(0);
  for (let x = 0; x < W; x++) {
    const e = front[x];
    if (e < 0) continue;
    const u = (x + 0.5 - ox) / rx;
    const taper = Math.pow(Math.max(0, 1 - Math.abs(u) ** 1.7), 0.85);
    const depth = Math.round(thick * taper * (0.78 + 0.34 * valueNoise(x, 0, 4, seed)) + (hash2(x >> 1, 1, seed) - 0.5) * 3);
    hang[x] = depth;
    for (let d = 1; d <= depth; d++) {
      const y = e + d;
      if (d <= 1) {
        put(x, y, pick(GRASS, 2.2 - u * 1.5, x, y));
        continue;
      }
      if (d <= 4) {
        put(x, y, pick(SOIL, 1.6 - u * 0.9 - (d - 2) * 0.4, x, y));
        continue;
      }
      const f = d / Math.max(1, depth);
      // Strata: bands every few rows, a crack now and then, lit on the left.
      const band = Math.floor((d + Math.floor(valueNoise(x, d, 9, seed) * 3)) / 5) % 2;
      const crack = hash2(x, Math.floor(d / 3), seed + 5) > 0.93 || (hash2(x >> 1, 7, seed) > 0.9 && d % 7 < 4);
      let idx = 4.6 - u * 2.2 - f * 2.6 - band * 0.55 + (hash2(x, y, seed) - 0.5) * 0.5;
      if (crack) idx -= 1.6;
      // The lowest rows curl back into shadow.
      if (d > depth - 2) idx -= 1.2;
      put(x, y, pick(ROCK, idx, x, y));
    }
  }
  // A dark rim along the rock's outline, so the islet stands clear of the clouds.
  for (let x = 0; x < W; x++) {
    const e = front[x];
    if (e < 0) continue;
    const y = e + hang[x] + 1;
    put(x, y, ROCK[0], 200);
  }
  // Roots and vines dangling from the underside.
  const vines = Math.round(rx / 7);
  for (let k = 0; k < vines; k++) {
    const x = Math.round(ox + (R() - 0.5) * rx * 1.5);
    if (front[x] < 0) continue;
    const y0 = front[x] + Math.round(hang[x] * (0.2 + R() * 0.6));
    const len = 3 + Math.round(R() * (hang[x] * 0.5 + 6));
    const vine = R() < 0.6;
    for (let i = 0; i < len; i++) {
      const y = y0 + i;
      const xx = x + (Math.sin(i * 0.5 + k) > 0.6 ? 1 : 0);
      if (y > front[xx] + hang[xx] + len) break;
      if (vine) {
        put(xx, y, pick(LEAF, 3 - i / len * 2, xx, y));
        if (i % 3 === 1) put(xx + (i % 2 ? 1 : -1), y, LEAF[4]);
      } else put(xx, y, BARK[i < len - 2 ? 1 : 0]);
    }
  }

  // The grassy top.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = rOf(x, y);
      if (r > 1) continue;
      const u = (x + 0.5 - ox) / rx;
      const v = (y + 0.5 - oy) / ry;
      let idx = 4.1 - u * 0.9 - v * 0.9 + (valueNoise(x, y, 6, seed) - 0.5) * 1.4 + (hash2(x, y, seed + 1) - 0.5) * 0.7;
      // A sunlit rim to the north-west, a darker lip to the south-east.
      if (r > 0.88) idx += u + v < 0 ? 1.6 : -0.9;
      // Tufts: a lighter blade over a darker root.
      if (hash2(x, y, seed + 2) > 0.94) idx += 1.3;
      if (hash2(x, y - 1, seed + 2) > 0.94) idx -= 1;
      let c = pick(GRASS, idx, x, y);
      if (kind === 'rock' && valueNoise(x, y, 7, seed + 9) > 0.62) c = pick(STONE, 2.6 - u - v + (hash2(x, y, seed) - 0.5), x, y);
      put(x, y, c);
      // A few flowers in the meadows.
      const bloom = kind === 'goal' ? 0.985 : kind === 'grove' || kind === 'beacon' ? 0.99 : 1;
      if (r < 0.9 && hash2(x, y, seed + 3) > bloom) put(x, y, FLOWERS[Math.floor(hash2(x, y, seed + 4) * FLOWERS.length)]);
    }
  }
  // Grass blades hanging over the front lip.
  for (let x = 0; x < W; x++) if (front[x] >= 0 && hash2(x, 3, seed) > 0.55) put(x, front[x] + 2, pick(GRASS, 3 - (x - ox) / rx, x, 0));

  // What stands on it, back to front.
  const things: { y: number; draw: () => void }[] = [];
  const shadowAt = (cx: number, cy: number, w: number, h: number) => {
    for (let y = -h; y <= h; y++) {
      for (let x = -w; x <= w; x++) {
        if ((x / w) ** 2 + (y / h) ** 2 > 1) continue;
        const X = Math.round(cx + x + 2);
        const Y = Math.round(cy + y + 1);
        if (rOf(X, Y) > 1 || out.alpha(X, Y) === 0) continue;
        const i = (Y * W + X) * 4;
        put(X, Y, [Math.round(out.data[i] * 0.62), Math.round(out.data[i + 1] * 0.66), Math.round(out.data[i + 2] * 0.74)]);
      }
    }
  };
  const tree = (cx: number, cy: number, s: number) => {
    shadowAt(cx + s * 0.5, cy, s * 1.2, s * 0.45);
    for (let y = 0; y < 5; y++) {
      put(cx, cy - y, BARK[1]);
      put(cx + 1, cy - y, BARK[0]);
      put(cx - 1, cy - y, BARK[2]);
    }
    const blobs = [
      { x: cx, y: cy - s * 1.35, r: s },
      { x: cx - s * 0.55, y: cy - s * 0.95, r: s * 0.75 },
      { x: cx + s * 0.6, y: cy - s * 0.9, r: s * 0.72 },
      { x: cx + s * 0.1, y: cy - s * 2, r: s * 0.62 },
    ];
    for (let y = Math.floor(cy - s * 2.8); y <= cy; y++) {
      for (let x = Math.floor(cx - s * 1.6); x <= cx + s * 1.6; x++) {
        let best = -1;
        let nx = 0;
        let ny = 0;
        for (const b of blobs) {
          const dx = (x + 0.5 - b.x) / b.r;
          const dy = (y + 0.5 - b.y) / b.r;
          const k = 1 - (dx * dx + dy * dy);
          if (k > best) {
            best = k;
            nx = dx;
            ny = dy;
          }
        }
        if (best < 0) continue;
        const edge = best < 0.12;
        let idx = 3.4 - nx * 1.6 - ny * 1.8 + (hash2(x, y, seed + 6) - 0.5) * 1.3;
        if (edge && ny > 0) idx = 0.6;
        // Leaf clumps: little highlights.
        if (hash2(x >> 1, y >> 1, seed + 7) > 0.8 && ny < 0.3) idx += 0.9;
        put(x, y, pick(LEAF, idx, x, y));
      }
    }
  };
  const column = (cx: number, cy: number, h: number, broken: boolean) => {
    shadowAt(cx + 3, cy, 5, 2);
    for (let y = 0; y < h; y++) {
      for (let x = -2; x <= 2; x++) {
        if (broken && y === h - 1 && (x + cx) % 2 === 0) continue;
        const idx = 4.8 - (x + 2) * 0.9 - (y === 0 ? 1.2 : 0) + (x === -2 ? 0.6 : 0);
        put(cx + x, cy - y, pick(MARBLE, idx, cx + x, cy - y));
      }
    }
    for (let x = -3; x <= 3; x++) {
      put(cx + x, cy + 1, pick(MARBLE, 3.8 - (x + 3) * 0.5, cx + x, cy + 1));
      if (!broken) put(cx + x, cy - h, pick(MARBLE, 5.4 - (x + 3) * 0.6, cx + x, cy - h));
    }
  };
  const boulder = (cx: number, cy: number, s: number) => {
    shadowAt(cx + s * 0.4, cy + 1, s * 1.1, s * 0.4);
    for (let y = -Math.ceil(s * 1.3); y <= 1; y++) {
      for (let x = -Math.ceil(s); x <= Math.ceil(s); x++) {
        const dx = x / s;
        const dy = (y + s * 0.55) / (s * 0.85);
        if (dx * dx + dy * dy > 1) continue;
        put(cx + x, cy + y, pick(STONE, 3 - dx * 1.4 - dy * 1.3 + (hash2(x, y, seed) - 0.5) * 0.6, cx + x, cy + y));
      }
    }
  };
  const lantern = (cx: number, cy: number) => {
    shadowAt(cx + 5, cy, 7, 2);
    // Flagstones round its foot.
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const fx = Math.round(cx + Math.cos(a) * 8);
      const fy = Math.round(cy + Math.sin(a) * 4);
      for (let x = -1; x <= 1; x++) put(fx + x, fy, pick(STONE, 3 - x * 0.7, fx + x, fy));
    }
    // A stone post, a bronze cage and the crystal inside.
    for (let y = 0; y < 16; y++) for (let x = -1; x <= 1; x++) put(cx + x, cy - y, pick(STONE, 3.2 - (x + 1) * 1.1 - (y > 13 ? 0.5 : 0), cx + x, cy - y));
    for (let x = -3; x <= 3; x++) {
      put(cx + x, cy - 16, pick(ramp('#5e3a10', '#946420', '#c89232', '#eec258'), 3 - (x + 3) * 0.4, cx + x, 0));
      put(cx + x, cy - 26, pick(ramp('#5e3a10', '#946420', '#c89232', '#eec258'), 3.2 - (x + 3) * 0.4, cx + x, 0));
    }
    for (let y = 17; y < 26; y++) {
      for (let x = -2; x <= 2; x++) {
        const dy = (y - 21.5) / 4.5;
        if (Math.abs(x) / 2.4 + Math.abs(dy) > 1.15) continue;
        put(cx + x, cy - y, pick(CRYSTAL, 3.6 - x * 0.7 - dy * 0.8, cx + x, cy - y));
      }
      put(cx - 3, cy - y, hex('#946420'));
      put(cx + 3, cy - y, hex('#5e3a10'));
    }
    put(cx, cy - 28, hex('#eec258'));
    put(cx, cy - 27, hex('#c89232'));
  };

  if (kind === 'grove') {
    const n = rx > 44 ? 4 : 3;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI * (0.15 + (k / n) * 0.7) + (R() - 0.5) * 0.4;
      const d = 0.35 + R() * 0.3;
      const cx = Math.round(ox + Math.cos(a) * rx * d);
      const cy = Math.round(oy + Math.sin(a) * ry * d + 2);
      things.push({ y: cy, draw: () => tree(cx, cy, 5 + R() * 2.5) });
    }
    for (let k = 0; k < 3; k++) {
      const cx = Math.round(ox + (R() - 0.5) * rx);
      const cy = Math.round(oy + R() * ry * 0.5);
      things.push({ y: cy, draw: () => tree(cx, cy, 2.6) });
    }
  } else if (kind === 'rock') {
    for (let k = 0; k < 3; k++) {
      const cx = Math.round(ox + (R() - 0.5) * rx * 1.1);
      const cy = Math.round(oy + (R() - 0.5) * ry * 0.9);
      things.push({ y: cy, draw: () => boulder(cx, cy, 2.5 + R() * 3) });
    }
  } else if (kind === 'ruin') {
    const n = 3;
    for (let k = 0; k < n; k++) {
      const cx = Math.round(ox - rx * 0.45 + k * rx * 0.45);
      const cy = Math.round(oy - ry * 0.25 + (k % 2) * 4);
      const h = k === 1 ? 17 : 9 + Math.round(R() * 6);
      things.push({ y: cy, draw: () => column(cx, cy, h, k !== 1) });
    }
    const bx = Math.round(ox + rx * 0.3);
    const by = Math.round(oy + ry * 0.4);
    things.push({
      y: by,
      draw: () => {
        shadowAt(bx + 2, by + 1, 7, 2);
        for (let y = -3; y <= 0; y++) for (let x = -6; x <= 5; x++) put(bx + x, by + y, pick(MARBLE, 4.5 - (y + 3) * 0.6 - (x > 3 ? 1 : 0), bx + x, by + y));
      },
    });
  } else if (kind === 'beacon') {
    const cx = Math.round(ox + BEACON_AT.dx * rx);
    const cy = Math.round(oy + BEACON_AT.dy * ry);
    things.push({ y: cy, draw: () => lantern(cx, cy) });
    for (let k = 0; k < 3; k++) {
      const tx = Math.round(ox - rx * 0.5 + (R() - 0.5) * 10);
      const ty = Math.round(oy - ry * 0.4 + k * 6);
      things.push({ y: ty, draw: () => tree(tx, ty, k === 0 ? 5.5 : 3) });
    }
  } else if (kind === 'goal') {
    // The landing meadow: a ring of white stones round a bed of flowers, a
    // path of flagstones to it from the arch, lanterns and a few trees behind.
    const mx = Math.round(ox);
    const my = Math.round(oy + ry * 0.12);
    for (let y = -22; y <= 22; y++) {
      for (let x = -40; x <= 40; x++) {
        const d = Math.hypot(x / 38, y / 20);
        const X = mx + x;
        const Y = my + y;
        if (d > 1.02) continue;
        if (d > 0.9) {
          // The stones: white, with a shade at their foot.
          const a = Math.atan2(y, x);
          if (Math.floor(((a + Math.PI) / (Math.PI * 2)) * 30) % 2 === 0) put(X, Y, pick(MARBLE, d > 0.97 ? 3 : 5.2 - x / 40, X, Y));
        } else if (d < 0.34) {
          if (hash2(X, Y, 77) > 0.35) put(X, Y, FLOWERS[(Math.floor(d * 9) + (X & 1)) % FLOWERS.length]);
        } else if (d > 0.6 && d < 0.66) put(X, Y, pick(GRASS, 6.4, X, Y));
      }
    }
    for (let k = 0; k < 5; k++) {
      const fy = my - 26 - k * 5;
      for (let x = -3; x <= 3; x++) put(mx + x + (k % 2), fy, pick(STONE, 3.4 - x * 0.4, mx + x, fy));
    }
    for (const side of [-1, 1]) {
      for (const k of [0, 1]) {
        const lx = Math.round(mx + side * (54 + k * 26));
        const ly = Math.round(my - 8 + k * 16);
        things.push({
          y: ly,
          draw: () => {
            shadowAt(lx + 3, ly, 4, 1.5);
            for (let y = 0; y < 11; y++) put(lx, ly - y, BARK[y > 8 ? 2 : 1]);
            put(lx + 1, ly - 10, BARK[0]);
            for (let y = 11; y < 15; y++) for (let x = -1; x <= 1; x++) put(lx + x, ly - y, x === 0 ? hex('#fff4c2') : hex('#ffcf5a'));
            put(lx, ly - 15, BARK[0]);
          },
        });
      }
    }
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI * (0.18 + k * 0.16);
      const cx = Math.round(ox + Math.cos(a) * rx * 0.78);
      const cy = Math.round(oy + Math.sin(a) * ry * 0.72);
      things.push({ y: cy, draw: () => tree(cx, cy, 5 + (k % 2) * 2) });
    }
  }
  things.sort((a, b) => a.y - b.y);
  for (const t of things) t.draw();
  return { img: out, ox, oy };
}

// ---------------------------------------------------------------- Rings, updrafts, wind

export const RING_FRAMES = 8;
/** Image sizes and the hoop's radius, for the gold ring and the big blue one. */
export const RING = { gold: { size: 30, r: 11, tube: 2.3 }, big: { size: 40, r: 15, tube: 3 } };

const GOLD = ramp('#5a3408', '#8a5a14', '#b8801e', '#e0aa34', '#f8d266', '#fff0b0');
const AZURE = ramp('#123a78', '#1e5aa8', '#3084d0', '#5cb0ec', '#9cdcff', '#e6f8ff');

/**
 * A hoop standing across the course, seen face on: a lit metal tube with
 * a dark rim, four gem studs, and a glint that runs round it frame by frame.
 */
export function ringFrame(big: boolean, f: number): Bitmap {
  const { size, r, tube } = big ? RING.big : RING.gold;
  const out = new Bitmap(size, size);
  const c = size / 2;
  const metal = big ? AZURE : GOLD;
  const rim: RGB = big ? hex('#0a1a3c') : hex('#2e1804');
  const gem = big ? ramp('#8a4a08', '#e0aa34', '#fff0b0') : ramp('#0e5a7a', '#3ac0e8', '#c8f8ff');
  const L = [-0.5, -0.62, 0.6];
  const ll = Math.hypot(L[0], L[1], L[2]);
  const glintA = (f / RING_FRAMES) * Math.PI * 2 - Math.PI * 0.75;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const d = Math.hypot(dx, dy) || 1;
      const t = (d - r) / tube;
      if (Math.abs(t) > 1.45) continue;
      if (Math.abs(t) > 1) {
        out.set(x, y, rim, 230);
        continue;
      }
      const nz = Math.sqrt(1 - t * t);
      const nx = (t * dx) / d;
      const ny = (t * dy) / d;
      const diff = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / ll);
      let idx = 0.6 + diff * 4.4;
      // The inside of the lower rim sits in the hoop's own shade.
      if (t < -0.4 && dy > 0) idx -= 0.9;
      let col = pick(metal, idx, x, y);
      if (diff > 0.93) col = metal[metal.length - 1];
      // The glint running round.
      const a = Math.atan2(dy, dx);
      let da = Math.abs(a - glintA);
      if (da > Math.PI) da = Math.PI * 2 - da;
      if (da < 0.22 && t < 0.3) col = mix(col, hex('#ffffff'), 1 - da / 0.22);
      out.set(x, y, col);
    }
  }
  // Studs at the four points.
  for (const [sx, sy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]) {
    const gx = Math.round(c + sx * r - 0.5);
    const gy = Math.round(c + sy * r - 0.5);
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (Math.abs(x) + Math.abs(y) <= 1) out.set(gx + x, gy + y, gem[x + y < 0 ? 2 : x + y > 0 ? 0 : 1]);
  }
  return out;
}

export const DRAFT_W = 72;
export const DRAFT_H = 26;
export const DRAFT_FRAMES = 6;

/** A swirl of rising air seen from above: three comets of light chasing round an ellipse, thin at the back. */
export function draftFrame(f: number): Bitmap {
  const out = new Bitmap(DRAFT_W, DRAFT_H);
  const cx = DRAFT_W / 2;
  const cy = DRAFT_H / 2;
  const rx = DRAFT_W / 2 - 3;
  const ry = DRAFT_H / 2 - 4;
  const turn = (f / DRAFT_FRAMES) * ((Math.PI * 2) / 3);
  for (let i = 0; i < 900; i++) {
    const a = (i / 900) * Math.PI * 2;
    // Where along its comet this point is: 0 at the tail, 1 at the head.
    const k = (((a + turn) % ((Math.PI * 2) / 3)) + (Math.PI * 2) / 3) % ((Math.PI * 2) / 3) / ((Math.PI * 2) / 3);
    if (k < 0.25) continue;
    const s = (k - 0.25) / 0.75;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    const nearSide = Math.sin(a) > 0;
    const alpha = Math.round(255 * Math.min(1, s * 1.4) * (nearSide ? 1 : 0.7));
    const X = Math.floor(x);
    const Y = Math.floor(y);
    // A bright streak with a blue-grey edge under it, so it reads over white cloud as well as blue sky.
    if (out.alpha(X, Y + 1) < alpha) out.set(X, Y + 1, hex(nearSide ? '#e4f2ff' : '#d0e4f8'), alpha);
    if (out.alpha(X, Y) < alpha) out.set(X, Y, hex(s > 0.8 ? '#ffffff' : '#f0f8ff'), alpha);
    if (out.alpha(X, Y + 2) < alpha * 0.55) out.set(X, Y + 2, hex('#6c8cc0'), Math.round(alpha * 0.55));
  }
  return out;
}

/** A thin streak of wind, bright at its head and fading down a long tail: 16 x 2. */
export function streak(): Bitmap {
  const out = new Bitmap(16, 2);
  for (let x = 0; x < 16; x++) {
    const a = x < 13 ? (x / 13) ** 1.5 : 1 - (x - 13) / 4;
    out.set(x, 0, hex('#ffffff'), Math.round(255 * a));
    out.set(x, 1, hex('#d8ecff'), Math.round(150 * a));
  }
  return out;
}

// ---------------------------------------------------------------- The finish arch

export const ARCH_W = 104;
export const ARCH_H = 58;

/**
 * Two carved posts with lanterns on top and, slung between them, a sagging
 * chequered banner hung with bunting: the finish line on the goal meadow.
 * Its feet are at the bottom middle.
 */
export function archArt(): Bitmap {
  const out = new Bitmap(ARCH_W, ARCH_H);
  const put = (x: number, y: number, c: RGB, a = 255) => out.set(x, y, c, a);
  const wood = ramp('#2e1c14', '#4a2e1c', '#6a4428', '#8c5e36', '#b07c48');
  const posts = [8, ARCH_W - 9];
  for (const px of posts) {
    // A stone foot, the post, a cap and a lantern.
    for (let y = ARCH_H - 4; y < ARCH_H; y++) for (let x = -3; x <= 3; x++) put(px + x, y, pick(STONE, 3.6 - (x + 3) * 0.45 - (y - ARCH_H + 4) * 0.3, px + x, y));
    for (let y = 9; y < ARCH_H - 4; y++) {
      for (let x = -2; x <= 1; x++) {
        const ring = y % 12 === 0;
        put(px + x, y, pick(wood, 3.8 - (x + 2) * 0.9 + (ring ? 0.8 : 0) + (hash2(x, y, px) - 0.5) * 0.4, px + x, y));
      }
    }
    for (let x = -3; x <= 2; x++) put(px + x, 8, pick(wood, 4 - (x + 3) * 0.5, px + x, 8));
    for (let y = 2; y < 8; y++) for (let x = -1; x <= 0; x++) put(px + x, y, y < 3 || y > 6 ? wood[1] : x === -1 ? hex('#fff4c2') : hex('#ffcf5a'));
    put(px - 1, 1, wood[0]);
  }
  // The banner: a chequered cloth sagging between the posts.
  const x0 = posts[0] + 2;
  const x1 = posts[1] - 2;
  const sagAt = (x: number) => 11 + Math.round(Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 5);
  for (let x = x0; x <= x1; x++) {
    const top = sagAt(x);
    for (let y = 0; y < 7; y++) {
      const check = (Math.floor((x - x0) / 3) + Math.floor(y / 3)) % 2 === 0;
      const shade = y === 6 ? 0.7 : y === 0 ? 1.08 : 1;
      const base: RGB = check ? [250, 248, 246] : [40, 36, 56];
      put(x, top + y, [Math.min(255, Math.round(base[0] * shade)), Math.min(255, Math.round(base[1] * shade)), Math.min(255, Math.round(base[2] * shade))]);
    }
    put(x, top - 1, wood[1]);
  }
  // Bunting under it, in bright colours.
  const bunt = ramp('#ff5a6a', '#ffcf5a', '#5ad8ff', '#8aff9a', '#d49aff');
  for (let k = 0; k < 11; k++) {
    const bx = x0 + 4 + k * 8;
    const by = sagAt(bx) + 9;
    for (let y = 0; y < 5; y++) for (let x = -2 + Math.ceil(y / 2); x <= 2 - Math.ceil(y / 2); x++) put(bx + x, by + y, mix(bunt[k % bunt.length], hex('#000000'), x > 0 ? 0.18 : 0));
  }
  return out;
}

// ---------------------------------------------------------------- The glider (drawn in the page, in the hero's colour)

export const GLIDER_W = 64;
export const GLIDER_H = 46;
/** Where the lines meet at the pilot's shoulders, in frame pixels. */
export const GLIDER_HX = 32;
export const GLIDER_HY = 44;
/** Banks from hard left to hard right, and pitch: flared, gliding, diving. */
export const GLIDER_BANKS = 5;
export const GLIDER_PITCHES = 3;

const toRgb = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/**
 * A paraglider's wing in `accent`, every bank and pitch side by side
 * (frame `g<bank>_<pitch>`): a crescent of inflated cells seen from above
 * and ahead, lit from the upper left, with white stripes near its tips and a
 * pale one down its middle, dark intakes along its leading edge, a crisp
 * outline, and its lines running down to the pilot's shoulders.
 */
export function gliderSheet(accent: number): { img: Bitmap; frames: { name: string; x: number }[] } {
  const n = GLIDER_BANKS * GLIDER_PITCHES;
  const img = new Bitmap(GLIDER_W * n, GLIDER_H);
  const frames: { name: string; x: number }[] = [];
  const a = toRgb(accent);
  // The wing's own ramp from the accent: deep shade up to a sunlit tint.
  const dark = mix(a, hex('#0c0a24'), 0.62);
  const cloth = [dark, mix(a, hex('#0c0a24'), 0.38), mix(a, hex('#0c0a24'), 0.16), a, mix(a, hex('#ffffff'), 0.3), mix(a, hex('#ffffff'), 0.55)];
  const white = ramp('#6c7090', '#9aa0bc', '#c8ccde', '#e8eaf4', '#ffffff', '#ffffff');
  const pale = cloth.map((c) => mix(c, hex('#fff4dc'), 0.6));
  const outline: RGB = mix(a, hex('#08061a'), 0.8);
  const lineCol: RGB = hex('#e4e8f4');
  const CELLS = 14;
  let k = 0;
  for (let b = 0; b < GLIDER_BANKS; b++) {
    for (let p = 0; p < GLIDER_PITCHES; p++, k++) {
      const fx = k * GLIDER_W;
      frames.push({ name: `g${b}_${p}`, x: fx });
      const tilt = (b - 2) * 0.13;
      // Flared: a deeper chord and the wing a touch lower; diving: foreshortened, pulled higher.
      const chord = p === 0 ? 8.5 : p === 1 ? 7 : 5;
      const baseY = p === 0 ? 20 : p === 1 ? 18 : 15;
      const S = p === 2 ? 25 : 27;
      const A = 8;
      const px0 = 32;
      const py0 = 26;
      const cos = Math.cos(tilt);
      const sin = Math.sin(tilt);
      // Wing space (u across, v down) to frame pixels, turned about the middle of the lines.
      const toFrame = (u: number, v: number) => ({ x: px0 + u * cos - (v - (py0 - baseY)) * sin, y: py0 + u * sin + (v - (py0 - baseY)) * cos });
      const mask = new Uint8Array(GLIDER_W * GLIDER_H);
      const put = (x: number, y: number, c: RGB, al = 255) => {
        if (x < 0 || y < 0 || x >= GLIDER_W || y >= GLIDER_H) return;
        img.set(fx + x, y, c, al);
      };
      // The lines first, so the wing sits over their tops.
      for (const t of [-0.94, -0.62, -0.28, 0.28, 0.62, 0.94]) {
        const lead = -A * (1 - t * t);
        const e = toFrame(t * S, lead);
        const sx = t < 0 ? GLIDER_HX - 3 : GLIDER_HX + 3;
        const sy = GLIDER_HY;
        const steps = Math.ceil(Math.hypot(sx - e.x, sy - e.y));
        for (let i = 0; i <= steps; i++) {
          const x = Math.round(e.x + ((sx - e.x) * i) / steps);
          const y = Math.round(e.y + ((sy - e.y) * i) / steps);
          put(x, y, lineCol, i < steps * 0.2 ? 200 : 150);
        }
      }
      for (let y = 0; y < GLIDER_H; y++) {
        for (let x = 0; x < GLIDER_W; x++) {
          // Back into wing space.
          const dx = x + 0.5 - px0;
          const dy = y + 0.5 - py0;
          const u = dx * cos + dy * sin;
          const v = -dx * sin + dy * cos + (py0 - baseY);
          const t = u / S;
          if (Math.abs(t) > 1) continue;
          const lead = -A * (1 - t * t) + Math.abs(t) ** 6 * 2;
          const c = chord * (0.5 + 0.5 * Math.sqrt(1 - t * t));
          const s = (lead - v) / c;
          if (s < 0 || s > 1) continue;
          mask[y * GLIDER_W + x] = 1;
          const cell = Math.min(CELLS - 1, Math.floor(((t + 1) / 2) * CELLS));
          const inCell = ((t + 1) / 2) * CELLS - cell;
          // Light: the left of the arc faces the sun, and the rounded leading edge catches it.
          let idx = 3.1 - t * 1.3 + (s > 0.12 && s < 0.4 ? 0.9 : 0) - s * 0.9 - (b - 2) * 0.25;
          // Each cell bulges a little; its seams sit in shade.
          idx += Math.sin(inCell * Math.PI) * 0.5 - (inCell < 0.12 ? 0.8 : 0);
          const ramp6 = cell === 1 || cell === CELLS - 2 ? white : cell === 6 || cell === 7 ? pale : cell === 0 || cell === CELLS - 1 ? cloth.map((q) => mix(q, dark, 0.5)) : cloth;
          let col = pick(ramp6, idx, x, y);
          // Intakes: dark mouths along the leading edge, one per cell.
          if (s < 0.14 && inCell > 0.3 && inCell < 0.75) col = dark;
          put(x, y, col);
        }
      }
      // A crisp outline round the wing.
      for (let y = 0; y < GLIDER_H; y++) {
        for (let x = 0; x < GLIDER_W; x++) {
          if (mask[y * GLIDER_W + x]) continue;
          const near = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < GLIDER_W && yy < GLIDER_H && mask[yy * GLIDER_W + xx] === 1;
          if (near(x - 1, y) || near(x + 1, y) || near(x, y - 1) || near(x, y + 1)) put(x, y, outline);
        }
      }
    }
  }
  return { img, frames };
}
