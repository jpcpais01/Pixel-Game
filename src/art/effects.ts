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
