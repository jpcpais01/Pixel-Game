// Environment art for the preview arena: a mossy forest clearing with a
// flagstone plaza, a faint rune circle, braziers, crystals, rocks and a
// training dummy. Everything is generated with diffuse + normal (+ emissive)
// layers so it responds to the dynamic lights.

import { PixelCanvas, hex, KEY_LIGHT, cyl, sphere, type Material, type RGB, type RenderedFrame } from './pixel';
import { MAGIC_VIOLET } from './palette';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// Deterministic randomness so the arena looks the same every load.
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hash2 = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function valueNoise(x: number, y: number, scale: number, s: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash2(x0, y0, s);
  const b = hash2(x0 + 1, y0, s);
  const c = hash2(x0, y0 + 1, s);
  const d = hash2(x0 + 1, y0 + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export interface GroundPalette {
  grass: RGB[];
  stone: RGB[];
  grout: RGB[];
  dirt: RGB[];
  flowers: RGB[];
  /** How strongly the forest edge sinks into shadow. */
  edgeDark: number;
}

/** Night: cool, deep, low contrast so fire and magic carry the scene. */
export const NIGHT_GROUND: GroundPalette = {
  grass: ramp('#0c1a1b', '#12282a', '#183a33', '#20503d', '#2d6645', '#437d4e'),
  stone: ramp('#1c1a24', '#2a2733', '#3a3644', '#4d4857', '#625c6b', '#7b7483'),
  grout: ramp('#0d0c13', '#151a1a', '#1a2a24'),
  dirt: ramp('#141418', '#1e1d21', '#29272a', '#353133'),
  flowers: ramp('#5d6a8a', '#4a4f78', '#6a5a80'),
  edgeDark: 2.4,
};

/** Day: sunlit meadow greens, warm sandstone, wildflowers. */
export const DAY_GROUND: GroundPalette = {
  grass: ramp('#1f4a2c', '#2b6233', '#3b7a38', '#56943f', '#76ad4a', '#9cc75c'),
  stone: ramp('#4a4450', '#605862', '#7a7078', '#948a8a', '#b0a59c', '#cabfae'),
  grout: ramp('#2a2a2c', '#2e3d2a', '#3c5a30'),
  dirt: ramp('#4f3d33', '#654e3e', '#7e644c', '#97795b'),
  flowers: ramp('#fff6d8', '#ffd84a', '#ff9ec4', '#b9a6ff'),
  edgeDark: 1.3,
};

const RUNE: RGB = [150, 110, 255];

export interface GroundLayers extends RenderedFrame {}

/**
 * Ground texture for a w x h pixel world. The plaza is centred; the ground
 * darkens toward the edges to frame the clearing.
 */
export function buildGround(w: number, h: number, pal: GroundPalette, seed = 7): GroundLayers {
  const { grass: GRASS, stone: STONE, grout: GROUT, dirt: DIRT } = pal;
  const n = w * h;
  const height = new Float32Array(n);
  const kind = new Uint8Array(n); // 0 grass, 1 stone, 2 grout, 3 dirt
  const tone = new Float32Array(n);
  const emissive = new Uint8ClampedArray(n * 4);
  const cx = w / 2;
  const cy = h / 2;
  const plazaR = Math.min(w, h) * 0.3;
  const R = rng(seed);

  // Flagstone seeds on a jittered grid.
  const cell = 19;
  const seeds: { x: number; y: number; t: number }[][] = [];
  for (let gy = -1; gy <= Math.ceil(h / cell) + 1; gy++) {
    const row: { x: number; y: number; t: number }[] = [];
    for (let gx = -1; gx <= Math.ceil(w / cell) + 1; gx++) {
      row.push({ x: (gx + 0.2 + R() * 0.6) * cell, y: (gy + 0.2 + R() * 0.6) * cell, t: R() });
    }
    seeds.push(row);
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = Math.hypot(x - cx, (y - cy) * 1.15);
      const edgeNoise = (valueNoise(x, y, 9, 3) - 0.5) * 22;
      const inPlaza = d < plazaR + edgeNoise;
      const mossy = valueNoise(x, y, 14, 5);
      if (inPlaza) {
        // Nearest two seeds: distance difference gives a bevel toward edges.
        const gx = Math.floor(x / cell) + 1;
        const gy = Math.floor(y / cell) + 1;
        let d1 = 1e9;
        let d2 = 1e9;
        let t = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const s = seeds[gy + oy]?.[gx + ox];
            if (!s) continue;
            const dd = Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y);
            if (dd < d1) {
              d2 = d1;
              d1 = dd;
              t = s.t;
            } else if (dd < d2) d2 = dd;
          }
        }
        const edge = (d2 - d1) / 2;
        if (edge < 0.55) {
          kind[i] = 2;
          height[i] = 0;
          tone[i] = mossy > 0.55 ? 2 : mossy > 0.4 ? 1 : 0;
        } else {
          kind[i] = 1;
          height[i] = Math.min(1, edge / 2.2) * 0.7 + valueNoise(x, y, 3, 11) * 0.08;
          tone[i] = (t - 0.5) * 0.9 + (valueNoise(x, y, 6, 13) - 0.5) * 0.6;
          // Moss creeping onto stones near the plaza edge.
          if (mossy > 0.62 && d > plazaR * 0.55 && hash2(x, y, 3) > 0.35) kind[i] = 0;
        }
      } else {
        const dirt = valueNoise(x, y, 20, 21);
        if (dirt > 0.8 && d < plazaR + 40) {
          kind[i] = 3;
          height[i] = valueNoise(x, y, 2, 23) * 0.2;
          tone[i] = (valueNoise(x, y, 4, 29) - 0.5) * 1.5;
        } else {
          kind[i] = 0;
          height[i] = valueNoise(x, y, 4, 17) * 0.25 + valueNoise(x, y, 11, 19) * 0.25;
          tone[i] = (valueNoise(x, y, 18, 31) - 0.5) * 2.2;
        }
      }
    }
  }

  // Grass blades: short strokes that catch the light.
  for (let k = 0; k < (w * h) / 22; k++) {
    const x = Math.floor(R() * w);
    const y = Math.floor(R() * h);
    const len = 1 + Math.floor(R() * 3);
    for (let j = 0; j < len; j++) {
      const i = (y - j) * w + x;
      if (y - j < 0 || kind[i] !== 0) break;
      height[i] = 0.55 + j * 0.2;
      tone[i] += 0.9 + j * 0.4;
    }
  }

  // Wildflowers: tiny clusters in the meadow, one colour per cluster.
  for (let k = 0; k < (w * h) / 900; k++) {
    const x0 = Math.floor(R() * w);
    const y0 = Math.floor(R() * h);
    const colour = Math.floor(R() * 8);
    for (let j = 0; j < 4; j++) {
      const x = x0 + Math.floor(R() * 7) - 3;
      const y = y0 + Math.floor(R() * 5) - 2;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x;
      if (kind[i] !== 0) continue;
      kind[i] = 4;
      height[i] = 0.9;
      tone[i] = colour;
    }
  }

  // Faint rune circle in the plaza.
  const runeR = plazaR * 0.42;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) * 1.15;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const ring = Math.abs(d - runeR) < 0.6 || Math.abs(d - runeR * 0.82) < 0.55;
      const tick = Math.abs(d - runeR * 0.91) < 2.2 && Math.abs(((a * 12) / Math.PI) % 2) < 0.18;
      const glyph = Math.abs(d - runeR * 0.91) < 1.8 && hash2(Math.floor(a * 30), Math.floor(d), 5) > 0.72;
      if (ring || tick || glyph) {
        const i = (y * w + x) * 4;
        const s = ring ? 0.55 : 0.4;
        emissive[i] = RUNE[0] * s;
        emissive[i + 1] = RUNE[1] * s;
        emissive[i + 2] = RUNE[2] * s;
        emissive[i + 3] = 255;
        kind[y * w + x] = kind[y * w + x] === 0 || kind[y * w + x] === 4 ? 0 : 2;
      }
    }
  }

  const diffuse = new Uint8ClampedArray(n * 4);
  const normal = new Uint8ClampedArray(n * 4);
  const L = KEY_LIGHT;
  const Ll = Math.hypot(L.x, L.y, L.z);
  const H = (x: number, y: number) => height[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const k = 3.2;
      let nx = (H(x - 1, y) - H(x + 1, y)) * k;
      let ny = (H(x, y + 1) - H(x, y - 1)) * k;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const lit = (nx * L.x + ny * L.y + nz * L.z) / Ll;
      // Vignette the clearing: the forest edges sink into shadow.
      const vd = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
      const dark = Math.max(0, vd - 0.55) * pal.edgeDark;
      let col: RGB;
      const shade = (lit - 0.78) * 6 + tone[i] - dark;
      if (kind[i] === 1) col = STONE[clamp(Math.round(3 + shade), 0, STONE.length - 1)];
      else if (kind[i] === 2) col = GROUT[clamp(Math.round(tone[i]), 0, GROUT.length - 1)];
      else if (kind[i] === 3) col = DIRT[clamp(Math.round(2 + shade), 0, DIRT.length - 1)];
      else if (kind[i] === 4) col = pal.flowers[Math.floor(tone[i]) % pal.flowers.length];
      else col = GRASS[clamp(Math.round(2.4 + shade), 0, GRASS.length - 1)];
      const o = i * 4;
      diffuse[o] = col[0];
      diffuse[o + 1] = col[1];
      diffuse[o + 2] = col[2];
      diffuse[o + 3] = 255;
      normal[o] = Math.round((nx * 0.5 + 0.5) * 255);
      normal[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normal[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normal[o + 3] = 255;
    }
  }
  return { w, h, diffuse, normal, emissive };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------------------
// Props

const INK = hex('#0e0c16');
const PROP_STONE: Material = { ramp: ramp('#23202b', '#343040', '#4a4556', '#625c6e', '#7e7889'), outline: INK };
const IRON: Material = { ramp: ramp('#15131b', '#26222e', '#3b3544', '#5a5063'), outline: INK, shine: true };
const EMBER: Material = { ramp: ramp('#5a1a10', '#b33a14', '#ff8a2a', '#ffd36a'), outline: INK, emissive: 0.9, noAO: true };
const SHARD: Material = {
  ramp: ramp('#2c1a5e', '#4b2ea0', '#7a52e0', '#b494ff', '#efe4ff'),
  outline: hex('#140a2c'),
  outlineLit: hex('#2a1850'),
  emissive: 0.55,
  shine: true,
  noAO: true,
};
const ROCK: Material = { ramp: ramp('#1d1b24', '#2c2935', '#3f3b4a', '#57515f', '#6f6878'), outline: INK };
const MOSS: Material = { ramp: ramp('#15301f', '#22492c', '#356338', '#4d7d45'), outline: INK };
const STRAW: Material = { ramp: ramp('#4a2e18', '#7d5424', '#b58436', '#e0b457', '#f6dc8c'), outline: hex('#1f120c') };
const SACK: Material = { ramp: ramp('#3b2a22', '#62473a', '#8c6c56', '#b39478'), outline: hex('#1a1210') };
const POST: Material = { ramp: ramp('#24160f', '#43291b', '#65402a', '#86593a'), outline: hex('#120a08') };
const PAINT: Material = { ramp: ramp('#5a1320', '#8e1f2c', '#c8323a', '#e8605a'), outline: hex('#1a0a0e') };

export const FIRE_COLS: RGB[] = [hex('#fff4c2'), hex('#ffcf5a'), hex('#ff8a26'), hex('#d8431a'), hex('#7a1d12')];

/** Stone brazier with a flickering fire (4 frames), 16x26. */
export function brazierFrame(f: number): PixelCanvas {
  const c = new PixelCanvas(16, 26);
  // Pedestal.
  c.part();
  c.shape(15, 24, (y) => {
    const hw = y > 22 ? 4.5 : y < 17 ? 3.2 : 2.6;
    return [8 - hw, 8 + hw];
  }, PROP_STONE, (_x, _y, t) => cyl(t, 0.2));
  // Bowl.
  c.part();
  c.shape(11, 15, (y) => {
    const hw = [6.2, 6.0, 5.4, 4.4, 3.2][y - 11];
    return [8 - hw, 8 + hw];
  }, IRON, (_x, _y, t, u) => cyl(t, 0.4 - u * 0.8));
  c.part();
  c.ellipse(8, 11.2, 5.4, 1.3, EMBER, { normal: () => ({ x: 0, y: 0.6, z: 0.8 }) });
  // Flames: layered tongues that shift per frame.
  const R = rng(100 + f * 17);
  for (let y = 1; y <= 11; y++) {
    const u = (y - 1) / 10; // 0 top .. 1 base
    const hw = 0.6 + u * 4.2;
    const sway = Math.sin(f * 1.7 + y * 0.8) * (1 - u) * 1.4;
    for (let x = 0; x < 16; x++) {
      const dx = (x + 0.5 - 8 - sway) / hw;
      if (Math.abs(dx) > 1) continue;
      const heat = (1 - Math.abs(dx)) * (0.4 + u * 0.8) + (R() - 0.5) * 0.35;
      if (heat < 0.18) continue;
      const col = heat > 0.95 ? FIRE_COLS[0] : heat > 0.7 ? FIRE_COLS[1] : heat > 0.45 ? FIRE_COLS[2] : heat > 0.28 ? FIRE_COLS[3] : FIRE_COLS[4];
      c.spark(x, y, col, 1);
    }
  }
  // An ember or two drifting up.
  c.spark(5 + ((f * 3) % 6), 1 + (f % 2), FIRE_COLS[1], 0.8);
  return c;
}

/** Cluster of glowing violet crystals, 20x22. */
export function crystalCluster(seed: number): PixelCanvas {
  const c = new PixelCanvas(20, 22);
  const R = rng(seed);
  c.part();
  c.ellipse(10, 18.5, 7.5, 2.6, ROCK);
  const shards = [
    { x: 10, base: 18, h: 15, w: 3.2, lean: -0.3 },
    { x: 6, base: 19, h: 9, w: 2.4, lean: -1.2 },
    { x: 14, base: 19, h: 10, w: 2.6, lean: 1.1 },
  ];
  shards.forEach((s, k) => {
    c.part();
    const top = s.base - s.h;
    c.shape(top, s.base, (y) => {
      const u = (y + 0.5 - top) / (s.h + 1);
      const hw = u < 0.25 ? (u / 0.25) * s.w : s.w;
      const x = s.x + s.lean * (1 - u) * 3 + (R() - 0.5) * 0.05;
      return [x - hw, x + hw];
    }, SHARD, (_x, _y, t) => ({ x: t < -0.1 ? -0.75 : t > 0.3 ? 0.75 : 0.05, y: 0.35, z: 0.6 }), { glow: 0.45 + k * 0.1 });
  });
  c.part();
  c.ellipse(4.5, 19.5, 2.4, 1.3, MOSS);
  return c;
}

export function rock(seed: number): PixelCanvas {
  const c = new PixelCanvas(18, 14);
  const R = rng(seed);
  c.part();
  c.ellipse(9, 8.5, 7 + R(), 4.6, ROCK, { flatten: 0.8 });
  c.part();
  c.ellipse(5 + R() * 2, 5.5, 3.4, 1.6, MOSS, { flatten: 0.7 });
  return c;
}

/** Straw training dummy, 18x28. `hit` shows it flinching. */
export function dummyFrame(hit: boolean): PixelCanvas {
  const c = new PixelCanvas(18, 28);
  c.part();
  c.shape(17, 26, () => [8, 10], POST, (_x, _y, t) => cyl(t, 0.1));
  // Cross arm.
  c.part();
  c.shape(12, 13, () => [2, 16], POST, (_x, _y, _t, u) => sphere(0, u - 0.5));
  // Straw body.
  c.part();
  c.ellipse(9, 15.5, 4.6, 5.2, STRAW, { bias: hit ? 1 : 0 });
  for (let y = 11; y < 21; y += 2) c.shade(7 + (y % 4), y, -1);
  // Rope bands.
  c.part();
  c.shape(13, 13, () => [4.6, 13.4], POST, (_x, _y, t) => cyl(t, 0));
  c.shape(18, 18, () => [5.0, 13.0], POST, (_x, _y, t) => cyl(t, 0));
  // Straw tufts at the arms.
  c.part();
  c.px(1, 12, STRAW, sphere(-0.6, 0));
  c.px(16, 13, STRAW, sphere(0.6, 0));
  // Sack head with a painted target.
  c.part();
  c.ellipse(9, 6.5, 3.8, 3.6, SACK, { bias: hit ? 1 : 0 });
  c.part();
  c.px(8, 6, PAINT, sphere(-0.2, -0.2), { bias: 1 });
  c.px(9, 6, PAINT, sphere(0.2, -0.2));
  c.px(8, 7, PAINT, sphere(-0.2, 0.2));
  c.px(9, 7, PAINT, sphere(0.2, 0.2));
  return c;
}

export { MAGIC_VIOLET };
