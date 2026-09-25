// The forest's standing things: oaks, birches and pines whose canopies
// overlap the heroes, undergrowth (bushes, ferns, stumps, a fallen log,
// mushrooms), shafts of sunlight and the leafy boughs that hang between the
// camera and the path. Trees and props are lit (diffuse + normal); the
// rays and boughs are flat art.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { hash2, rng } from './env';

const ramp = (...c: string[]): RGB[] => c.map(hex);

const BARK: Material = { ramp: ramp('#1c120c', '#322117', '#4a3324', '#654731', '#826147'), outline: hex('#100a07') };
const BIRCH_BARK: Material = { ramp: ramp('#6d685f', '#99948a', '#c6c1b3', '#e9e5d8'), outline: hex('#26221e') };
const LEAF_OAK: Material = {
  ramp: ramp('#10291a', '#173823', '#1f4a2b', '#2b5e33', '#3b753c', '#528d46', '#71a653', '#97c264'),
  outline: hex('#08160d'),
  outlineLit: hex('#16341e'),
};
const LEAF_BIRCH: Material = {
  ramp: ramp('#223c1b', '#314f22', '#43682a', '#588233', '#709c3d', '#8eb54c', '#b2cd62', '#d2e287'),
  outline: hex('#101c0c'),
  outlineLit: hex('#2a4418'),
};
const LEAF_PINE: Material = {
  ramp: ramp('#0a1e1c', '#0f2a26', '#153730', '#1c4639', '#255644', '#306850', '#407a5d', '#57906e'),
  outline: hex('#05100e'),
  outlineLit: hex('#12302a'),
};
const LEAF_BUSH: Material = {
  ramp: ramp('#132d1b', '#1b3d24', '#26512d', '#346836', '#48803f', '#63994b'),
  outline: hex('#08150d'),
};
const FERN: Material = { ramp: ramp('#18381c', '#245024', '#34692c', '#4b8436', '#68a043', '#8cbc55'), outline: hex('#0a180c'), noOutline: true };
const WOOD_END: Material = { ramp: ramp('#5a3f26', '#7a5836', '#9c7648', '#bf985e', '#d9b77a'), outline: hex('#1c120a') };
const MOSS: Material = { ramp: ramp('#1c3a1c', '#2a5226', '#3c6c2e', '#56883a'), outline: hex('#0c1a0c'), noOutline: true };
const BERRY: Material = { ramp: ramp('#5a0f1a', '#a01e2a', '#e0404a', '#ff8a8a'), outline: hex('#1a060a'), noOutline: true, shine: true };
const CAP_GLOW: Material = { ramp: ramp('#15635c', '#23918a', '#48c8bb', '#8ff0e0', '#dcfff6'), outline: hex('#08221f'), emissive: 0.55, noAO: true };
const CAP_RED: Material = { ramp: ramp('#4a0c10', '#7e1a1c', '#b82e2a', '#e0543e', '#f68a62'), outline: hex('#1a0608') };
const STEM: Material = { ramp: ramp('#6e6858', '#9c9580', '#c9c1a6', '#ece4cb'), outline: hex('#24201a') };
const DOTS: Material = { ramp: ramp('#d8d0c0', '#f4efe4', '#ffffff'), outline: hex('#24201a'), noOutline: true };

export const TREE_W = 96;
export const TREE_H = 128;
/** Where a tree's trunk meets the ground, in its frame. */
export const TREE_BASE_Y = 124;
export const TREE_VARIANTS = 3;

export const PROP_W = 48;
export const PROP_H = 26;
export const PROP_BASE_Y = 23;

/** A leafy dome made of clumps, each lit as a sphere; leaves ruffle its edges. */
function canopy(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, count: number, leaf: Material, R: () => number, size = 1): void {
  const clumps: { x: number; y: number; r: number }[] = [];
  for (let k = 0; k < count; k++) {
    const a = R() * Math.PI * 2;
    const d = Math.sqrt(R()) * 0.72;
    const r = (8 + R() * 5) * size;
    clumps.push({ x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r });
  }
  // One big mass behind them holds the shape together.
  c.part();
  c.ellipse(cx, cy, rx * 0.86, ry * 0.86, leaf, { bias: -1, flatten: 0.9 });
  // Back clumps first, then the ones nearer the viewer (lower on screen).
  clumps.sort((a, b) => a.y - b.y);
  for (const k of clumps) {
    c.part();
    c.ellipse(k.x, k.y, k.r, k.r * 0.86, leaf, { flatten: 0.95 });
    // Ruffled edge: stray leaves poking out, mostly on top.
    for (let j = 0; j < 10; j++) {
      const a = -Math.PI * (0.05 + R() * 0.9) + (R() < 0.3 ? Math.PI : 0);
      const x = k.x + Math.cos(a) * (k.r + 0.6);
      const y = k.y + Math.sin(a) * (k.r * 0.86 + 0.6);
      c.px(x, y, leaf, sphere(Math.cos(a) * 0.8, Math.sin(a) * 0.8));
    }
  }
  // Leaf texture: little clusters a step lighter or darker.
  for (let y = Math.floor(cy - ry - 8); y < cy + ry + 8; y++) {
    for (let x = Math.floor(cx - rx - 8); x < cx + rx + 8; x++) {
      if (!c.filled(x, y)) continue;
      const h = hash2(x >> 1, y >> 1, 17) + (hash2(x, y, 19) - 0.5) * 0.3;
      if (h > 0.78) c.shade(x, y, 1);
      else if (h < 0.18) c.shade(x, y, -1);
    }
  }
}

function trunk(c: PixelCanvas, bx: number, by: number, height: number, hw: number, bark: Material, lean: number): void {
  c.part();
  c.shape(by - height, by, (y) => {
    const u = (y - (by - height)) / height;
    // Flares out into roots at the base.
    const w = hw * (0.8 + u * 0.35) + (u > 0.82 ? (u - 0.82) * 12 : 0);
    const x = bx + lean * (1 - u) * (1 - u) * 4;
    return [x - w, x + w];
  }, bark, (_x, _y, t) => cyl(t, 0.1));
}

function roots(c: PixelCanvas, bx: number, by: number, spread: number, bark: Material, R: () => number): void {
  c.part();
  for (const s of [-1, 1]) {
    c.capsule(bx + s * 2, by - 4, bx + s * (spread + R() * 3), by + 0.5, 2, 0.8, bark);
  }
  c.capsule(bx + 1, by - 3, bx + 2 + R() * 2, by + 1.5, 1.6, 0.8, bark);
}

export function oak(v: number): PixelCanvas {
  const c = new PixelCanvas(TREE_W, TREE_H);
  const R = rng(300 + v * 17);
  const bx = 48;
  const by = TREE_BASE_Y;
  const lean = (R() - 0.5) * 1.5;
  trunk(c, bx, by, 50, 3.4 + v * 0.3, BARK, lean);
  // Bark: vertical furrows.
  for (let k = 0; k < 36; k++) {
    const x = bx - 3 + Math.floor(R() * 7);
    const y = by - 48 + Math.floor(R() * 44);
    for (let j = 0; j < 2 + Math.floor(R() * 4); j++) c.shade(x, y + j, -1);
  }
  roots(c, bx, by, 8, BARK, R);
  // Boughs reaching up into the crown.
  c.part();
  c.capsule(bx, by - 36, bx - 15 - R() * 4, by - 60, 2.4, 1.3, BARK);
  c.capsule(bx + 1, by - 40, bx + 14 + R() * 4, by - 64, 2.2, 1.2, BARK);
  canopy(c, bx + lean, by - 72, 33 + v * 2, 27, 11 + v, LEAF_OAK, R);
  return c;
}

export function birch(v: number): PixelCanvas {
  const c = new PixelCanvas(TREE_W, TREE_H);
  const R = rng(500 + v * 23);
  const bx = 48;
  const by = TREE_BASE_Y;
  const lean = (R() - 0.5) * 2.5;
  trunk(c, bx, by, 64, 2.2, BIRCH_BARK, lean);
  // Black marks across the white bark.
  for (let k = 0; k < 16; k++) {
    const y = by - 60 + Math.floor(R() * 56);
    const x = bx - 2 + Math.floor(R() * 3) + Math.round(lean * (1 - (y - by + 64) / 64) ** 2 * 4);
    const len = 1 + Math.floor(R() * 3);
    for (let j = 0; j < len; j++) c.shade(x + j, y, -3);
  }
  roots(c, bx, by, 5, BIRCH_BARK, R);
  c.part();
  c.capsule(bx + lean * 2, by - 50, bx - 10, by - 70, 1.4, 0.8, BIRCH_BARK);
  canopy(c, bx + lean * 3, by - 80, 20 + v, 27, 9, LEAF_BIRCH, R, 0.8);
  return c;
}

export function pine(v: number): PixelCanvas {
  const c = new PixelCanvas(TREE_W, TREE_H);
  const R = rng(700 + v * 29);
  const bx = 48;
  const by = TREE_BASE_Y;
  trunk(c, bx, by, 30, 2.6, BARK, 0);
  roots(c, bx, by, 6, BARK, R);
  // Tiers of boughs, top down, each lower one in front of the one above.
  const top = by - 112 + v * 4;
  const tiers = 5;
  for (let k = 0; k < tiers; k++) {
    const t0 = top + k * 16;
    const t1 = t0 + 22 + k * 2;
    const w = 7 + k * 5 + v;
    c.part();
    c.shape(t0, t1, (y) => {
      const u = (y - t0) / (t1 - t0);
      // Saw-toothed hem along the bottom of each tier.
      const jag = u > 0.7 ? (hash2(y, k, 31 + v) - 0.5) * 3 : 0;
      const hw = 1 + u * w + jag;
      return [bx - hw, bx + hw];
    }, LEAF_PINE, (_x, _y, t, u) => cyl(t, 0.55 - u * 0.4));
    for (let x = Math.floor(bx - w); x <= bx + w; x++) {
      if (hash2(x, k, 37 + v) > 0.55) c.px(x, t1 + 1, LEAF_PINE, cyl((x - bx) / w, -0.2), { bias: -1 });
    }
  }
  for (let y = top; y < by - 12; y++) {
    for (let x = bx - 32; x < bx + 32; x++) {
      if (!c.filled(x, y)) continue;
      const h = hash2(x, y >> 1, 41);
      if (h > 0.8) c.shade(x, y, 1);
      else if (h < 0.15) c.shade(x, y, -1);
    }
  }
  return c;
}

export const TREE_FRAMES: { name: string; draw: () => PixelCanvas }[] = [];
for (let v = 0; v < TREE_VARIANTS; v++) {
  TREE_FRAMES.push({ name: `oak${v}`, draw: () => oak(v) });
  TREE_FRAMES.push({ name: `birch${v}`, draw: () => birch(v) });
  TREE_FRAMES.push({ name: `pine${v}`, draw: () => pine(v) });
}

// ---------------------------------------------------------------------------
// Undergrowth, each drawn standing on (24, PROP_BASE_Y) of a 48x26 frame.

function bush(v: number): PixelCanvas {
  const c = new PixelCanvas(PROP_W, PROP_H);
  const R = rng(900 + v * 11);
  const cx = 24;
  const by = PROP_BASE_Y;
  canopy(c, cx, by - 8, 11, 7, 5, LEAF_BUSH, R, 0.62);
  if (v === 1) {
    for (let k = 0; k < 7; k++) {
      c.part();
      c.px(cx - 9 + R() * 18, by - 13 + R() * 10, BERRY, sphere(-0.4, -0.4));
    }
  }
  return c;
}

function fern(v: number): PixelCanvas {
  const c = new PixelCanvas(PROP_W, PROP_H);
  const R = rng(1100 + v * 13);
  const cx = 24;
  const by = PROP_BASE_Y;
  const fronds = 7 + v * 2;
  for (let k = 0; k < fronds; k++) {
    c.part();
    const a = -Math.PI * (0.12 + (k / (fronds - 1)) * 0.76) + (R() - 0.5) * 0.2;
    const len = 9 + R() * 5;
    let px = cx;
    let py = by - 1;
    for (let s = 0; s < len; s++) {
      // Fronds arch outward and droop at the tips.
      const u = s / len;
      px += Math.cos(a) * (1 + u * 0.3);
      py += Math.sin(a) * (1 - u * 1.3) + u * 0.4;
      const side = Math.cos(a) < 0 ? -1 : 1;
      c.px(px, py, FERN, sphere(Math.cos(a) * 0.5, -0.4));
      if (s > 1 && s % 2 === 0) {
        const leaf = Math.max(1, Math.round((1 - u) * 3));
        for (let j = 1; j <= leaf; j++) {
          c.px(px - Math.sin(a) * j * side * 0.6, py - j * 0.8, FERN, sphere(0, -0.8), { bias: 1 });
          c.px(px + Math.sin(a) * j * side * 0.3, py + j * 0.5, FERN, sphere(0, 0.5), { bias: -1 });
        }
      }
    }
  }
  return c;
}

function stump(v: number): PixelCanvas {
  const c = new PixelCanvas(PROP_W, PROP_H);
  const R = rng(1300 + v * 7);
  const cx = 24;
  const by = PROP_BASE_Y;
  roots(c, cx, by, 8, BARK, R);
  c.part();
  c.shape(by - 9, by, (y) => {
    const u = (y - by + 9) / 9;
    const hw = 5.6 + u * 1.2;
    return [cx - hw, cx + hw];
  }, BARK, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.ellipse(cx, by - 9.5, 5.8, 2.4, WOOD_END, { normal: () => ({ x: 0, y: 0.55, z: 0.84 }) });
  // Growth rings.
  c.shade(cx - 2, by - 10, -1);
  c.shade(cx + 1, by - 10, -1);
  c.shade(cx + 3, by - 9, -1);
  c.shade(cx - 3, by - 9, -1);
  c.part();
  c.px(cx - 5, by - 7, MOSS, sphere(-0.5, -0.5));
  c.px(cx - 4, by - 7, MOSS, sphere(0, -0.6));
  c.px(cx - 5, by - 6, MOSS, sphere(-0.6, 0));
  return c;
}

function log(): PixelCanvas {
  const c = new PixelCanvas(PROP_W, PROP_H);
  const by = PROP_BASE_Y;
  c.part();
  c.capsule(7, by - 6, 38, by - 6, 5.2, 5.2, BARK);
  for (let x = 6; x < 38; x++) {
    if (hash2(x, 3, 43) > 0.5) c.shade(x, by - 6 + Math.floor(hash2(x, 4, 44) * 6) - 3, -1);
  }
  c.part();
  c.ellipse(40, by - 6, 3, 5, WOOD_END, { normal: () => ({ x: 0.8, y: 0.1, z: 0.6 }) });
  c.shade(40, by - 7, -1);
  c.shade(40, by - 5, -1);
  // Moss along its back.
  c.part();
  for (let x = 8; x < 36; x++) {
    if (hash2(x, 1, 45) > 0.3) c.px(x, by - 11 - (hash2(x, 2, 46) > 0.6 ? 1 : 0), MOSS, sphere(0, -0.7));
  }
  return c;
}

function shrooms(v: number): PixelCanvas {
  const c = new PixelCanvas(PROP_W, PROP_H);
  const R = rng(1500 + v * 3);
  const cap = v === 0 ? CAP_GLOW : CAP_RED;
  const list = [
    { x: 22, h: 7, r: 3.6 },
    { x: 27, h: 4, r: 2.6 },
    { x: 18, h: 3, r: 2 },
    { x: 30, h: 2, r: 1.6 },
  ];
  for (const m of list) {
    const by = PROP_BASE_Y - R() * 1.5;
    c.part();
    c.capsule(m.x, by, m.x, by - m.h, 1, 0.8, STEM);
    c.part();
    c.ellipse(m.x, by - m.h - 0.5, m.r, m.r * 0.62, cap);
    if (v === 1 && m.r > 2.5) {
      c.part();
      c.px(m.x - 1, by - m.h - 1, DOTS, sphere(0, -0.6));
      c.px(m.x + 1, by - m.h, DOTS, sphere(0.4, -0.2));
    }
  }
  return c;
}

export const PROP_FRAMES: { name: string; draw: () => PixelCanvas }[] = [
  { name: 'bush0', draw: () => bush(0) },
  { name: 'bush1', draw: () => bush(1) },
  { name: 'fern0', draw: () => fern(0) },
  { name: 'fern1', draw: () => fern(1) },
  { name: 'stump0', draw: () => stump(0) },
  { name: 'stump1', draw: () => stump(1) },
  { name: 'log0', draw: () => log() },
  { name: 'log1', draw: () => log() },
  { name: 'shrooms0', draw: () => shrooms(0) },
  { name: 'shrooms1', draw: () => shrooms(1) },
];

// ---------------------------------------------------------------------------
// Light and overhead leaves: flat art.

export const RAY_W = 72;
export const RAY_H = 200;
/** Where the ray meets the ground, in its frame. */
export const RAY_FOOT_X = 54;

/**
 * A shaft of sunlight slanting down from the upper left onto the ground at
 * the bottom of the frame. Premultiplied, for additive blending; the
 * brightness falls off in a few flat steps, so it reads as pixel art.
 */
export function rayCanvas(seed: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(RAY_W * RAY_H * 4);
  const R = rng(seed);
  const strands = [0, 1, 2].map(() => ({ at: (R() - 0.5) * 1.2, w: 0.25 + R() * 0.3, a: 0.35 + R() * 0.4 }));
  for (let y = 0; y < RAY_H; y++) {
    const u = y / RAY_H;
    const cx = RAY_FOOT_X - (RAY_H - y) * 0.22;
    const hw = 5 + u * 6;
    // Faint high up, full a little above the ground, softer at the landing.
    const along = Math.min(1, u / 0.45) * (u > 0.93 ? 1 - (u - 0.93) * 6 : 1);
    for (let x = 0; x < RAY_W; x++) {
      const t = (x + 0.5 - cx) / hw;
      if (Math.abs(t) > 1.6) continue;
      let a = Math.max(0, 1 - t * t / 2.56) ** 1.4 * 0.55;
      for (const s of strands) {
        const d = (t - s.at) / s.w;
        if (Math.abs(d) < 1) a += (1 - d * d) * s.a * 0.45;
      }
      a = Math.round(Math.min(1, a * along) * 7) / 7;
      const i = (y * RAY_W + x) * 4;
      px[i] = Math.round(255 * a * 0.62);
      px[i + 1] = Math.round(240 * a * 0.62);
      px[i + 2] = Math.round(196 * a * 0.62);
      px[i + 3] = 255;
    }
  }
  return px;
}

export const BOUGH_W = 150;
export const BOUGH_H = 104;

/**
 * A leafy bough seen from beneath, hanging in from the left edge. Drawn
 * dark (it is between the viewer and the light), with sun catching the
 * tips of its leaves.
 */
export function bough(v: number): PixelCanvas {
  const c = new PixelCanvas(BOUGH_W, BOUGH_H);
  const R = rng(1700 + v * 31);
  const leaf: Material = { ...LEAF_OAK, bias: -2 };
  const wood: Material = { ...BARK, bias: -1 };
  const y0 = 40 + R() * 20;
  const x1 = 90 + R() * 30;
  const y1 = 30 + R() * 40;
  c.part();
  c.capsule(-4, y0, x1, y1, 5, 1.5, wood);
  c.part();
  c.capsule(x1 * 0.45, (y0 + y1) / 2, x1 * 0.75, y1 + 26, 2.4, 1, wood);
  const n = 7 + v;
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    const x = t * x1 * 1.02 + (R() - 0.5) * 8;
    const y = y0 + (y1 - y0) * t + (R() - 0.5) * 26;
    canopy(c, x, y, 16 - t * 4, 13 - t * 3, 3, leaf, R, 0.9 - t * 0.2);
  }
  return c;
}

/** A single falling leaf, white so particles can tint it. */
export function leafBit(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(3 * 2 * 4);
  for (const [x, y] of [[0, 0], [1, 0], [1, 1], [2, 1]]) {
    const i = (y * 3 + x) * 4;
    px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 255;
  }
  return px;
}
