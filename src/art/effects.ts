// Magic effects: the energy ball, its impact burst, and small helper sprites.
// These are pure light, so they only produce emissive pixels.

import { PixelCanvas, type RGB } from './pixel';
import { MAGIC_CORE, MAGIC_DEEP, MAGIC_HOT, MAGIC_MID, MAGIC_VIOLET } from './palette';

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const ORB_SIZE = 16;
export const ORB_FRAMES = 4;

/** Energy ball: white-hot core, cyan body, flickering deep-blue halo, two orbiting motes. */
export function orbFrame(f: number): PixelCanvas {
  const c = new PixelCanvas(ORB_SIZE, ORB_SIZE);
  const cx = 8;
  const cy = 8;
  const pulse = f % 2 === 0 ? 0 : 0.35;
  for (let y = 0; y < ORB_SIZE; y++) {
    for (let x = 0; x < ORB_SIZE; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= 1.6) c.spark(x, y, MAGIC_CORE, 1);
      else if (d <= 2.9) c.spark(x, y, MAGIC_HOT, 1);
      else if (d <= 4.0 + pulse) c.spark(x, y, MAGIC_MID, 0.85);
      else if (d <= 5.4 + pulse && hash(x, y, f) > 0.35) c.spark(x, y, MAGIC_DEEP, 0.55);
      else if (d <= 6.6 && hash(x, y, f + 9) > 0.86) c.spark(x, y, MAGIC_DEEP, 0.35);
    }
  }
  for (let k = 0; k < 2; k++) {
    const a = ((f * 45 + k * 180) * Math.PI) / 180;
    c.spark(cx + Math.cos(a) * 5.6, cy + Math.sin(a) * 5.6, MAGIC_HOT, 1);
    c.spark(cx + Math.cos(a - 0.5) * 5.6, cy + Math.sin(a - 0.5) * 5.6, MAGIC_MID, 0.5);
  }
  return c;
}

export const BURST_SIZE = 32;
export const BURST_FRAMES = 7;

/** Impact: a flash, an expanding shock ring and sparks flung outward. */
export function burstFrame(f: number): PixelCanvas {
  const c = new PixelCanvas(BURST_SIZE, BURST_SIZE);
  const cx = 16;
  const cy = 16;
  const t = f / (BURST_FRAMES - 1);
  const r = 2.5 + f * 2.0;
  const thick = Math.max(0.7, 2.2 - f * 0.3);
  const ringCol: RGB = f < 2 ? MAGIC_HOT : f < 4 ? MAGIC_MID : MAGIC_DEEP;
  for (let y = 0; y < BURST_SIZE; y++) {
    for (let x = 0; x < BURST_SIZE; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (f <= 1 && d <= 3.6 - f * 1.2) c.spark(x, y, MAGIC_CORE, 1);
      else if (f <= 2 && d <= 5 - f) c.spark(x, y, MAGIC_HOT, 0.7);
      if (Math.abs(d - r) <= thick / 2 && hash(x, y, f) > t * 0.55) c.spark(x, y, ringCol, 1 - t * 0.6);
    }
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + hash(k, 1) * 0.5;
    const dist = r + 1.5 + hash(k, 2) * 3;
    const col = k % 3 === 0 ? MAGIC_VIOLET : MAGIC_HOT;
    if (f < BURST_FRAMES - 1) c.spark(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, col, 1 - t);
  }
  return c;
}

/** Banded radial halo, drawn additively and tinted at runtime. */
export function glowCanvas(size = 32): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  const bands = [
    [0.22, 0.55],
    [0.4, 0.3],
    [0.62, 0.15],
    [0.86, 0.07],
    [1.0, 0.03],
  ];
  const h = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - h, y + 0.5 - h) / h;
      const band = bands.find((b) => d <= b[0]);
      const a = band ? band[1] : 0;
      const i = (y * size + x) * 4;
      // Premultiplied white: brightness carries the falloff for ADD blending.
      px[i] = px[i + 1] = px[i + 2] = Math.round(255 * a);
      px[i + 3] = 255;
    }
  }
  return px;
}

/** Soft two-band contact shadow. */
export function shadowCanvas(w = 16, h = 6): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2);
      const dy = (y + 0.5 - h / 2) / (h / 2);
      const d = dx * dx + dy * dy;
      const i = (y * w + x) * 4;
      px[i] = 8;
      px[i + 1] = 6;
      px[i + 2] = 20;
      px[i + 3] = d <= 0.45 ? 150 : d <= 1 ? 90 : 0;
    }
  }
  return px;
}

// ---------------------------------------------------------------------------
// Sky: cloud shadows, sun shafts, motes and the day/night icons.

/** Tileable value noise: lattice wraps every `period` cells. */
function tileNoise(x: number, y: number, cell: number, period: number, seed: number): number {
  const fx = x / cell;
  const fy = y / cell;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const h = (a: number, b: number) => hash(((a % period) + period) % period, ((b % period) + period) % period, seed);
  const a = h(x0, y0);
  const b = h(x0 + 1, y0);
  const c = h(x0, y0 + 1);
  const d = h(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Soft, banded cloud shadows that tile seamlessly (size must divide by 64). */
export function cloudShadowCanvas(size = 256): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n =
        tileNoise(x, y, 64, size / 64, 1) * 0.6 + tileNoise(x, y, 32, size / 32, 2) * 0.28 + tileNoise(x, y, 16, size / 16, 3) * 0.12;
      const a = n > 0.66 ? 0.26 : n > 0.6 ? 0.17 : n > 0.56 ? 0.08 : 0;
      const i = (y * size + x) * 4;
      px[i] = 18;
      px[i + 1] = 26;
      px[i + 2] = 58;
      px[i + 3] = Math.round(a * 255);
    }
  }
  return px;
}

/** Diagonal shafts of sunlight (drawn additively, very faint). */
export function sunShaftCanvas(w = 256, h = 256): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  const shafts = [
    { at: 40, width: 18, a: 0.5 },
    { at: 92, width: 9, a: 0.35 },
    { at: 150, width: 26, a: 0.45 },
    { at: 205, width: 12, a: 0.3 },
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Rays run from the top-left toward the bottom-right.
      const u = x - y * 0.55;
      let a = 0;
      for (const s of shafts) {
        const d = Math.abs(u - s.at) / s.width;
        if (d < 1) a = Math.max(a, (d < 0.5 ? 1 : 0.55) * s.a);
      }
      a *= Math.max(0, 1 - y / h) ** 0.7; // fade toward the bottom
      const i = (y * w + x) * 4;
      px[i] = Math.round(255 * a);
      px[i + 1] = Math.round(236 * a);
      px[i + 2] = Math.round(190 * a);
      px[i + 3] = 255;
    }
  }
  return px;
}

/** 12x12 pixel sun and moon icons for the time-of-day toggle. */
export function skyIcon(kind: 'sun' | 'moon'): Uint8ClampedArray {
  const S = 12;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * S + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - 6;
      const dy = y + 0.5 - 6;
      const d = Math.hypot(dx, dy);
      if (kind === 'sun') {
        if (d <= 2.6) put(x, y, dx + dy < -1.5 ? '#fff6c8' : '#ffd24a');
        else if (d <= 3.4) put(x, y, '#f29a2e');
      } else {
        const cut = Math.hypot(dx - 1.8, dy + 1.4);
        if (d <= 4.4 && cut > 3.4) put(x, y, dx < -2 && dy < 1 ? '#f2f0ff' : '#c9c8f0');
      }
    }
  }
  if (kind === 'sun') {
    for (const [x, y] of [
      [6, 0], [5, 0], [6, 11], [5, 11], [0, 5], [0, 6], [11, 5], [11, 6],
      [2, 2], [9, 2], [2, 9], [9, 9],
    ]) put(x, y, '#ffc23a');
  } else {
    put(9, 2, '#ffffff');
    put(10, 5, '#b8c0ff');
    put(8, 9, '#dfe4ff');
  }
  return px;
}
