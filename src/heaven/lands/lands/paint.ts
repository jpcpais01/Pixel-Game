// The painter every land shares: a tile of ground from a land's `cell` and
// `kinds` (see types.ts). One pass asks the land what each pixel is; normals
// come from its heights; then each look (day, night) picks every pixel's
// colour off its kind's ramp, lit from the same warm top-left key light the
// sprites are drawn with (art/pixel.ts KEY_LIGHT), so props and ground agree.
// No Phaser here: the land worker and the node script paint with it too.

import { nightify } from '../../art/ground';
import { KEY_LIGHT, type RGB } from '../../art/pixel';
import { TILE_H, TILE_W, type GroundCell, type LandGround, type LandTile, type TileFields } from './types';

/** How steep the height field's slopes read in the normals. */
const SLOPE = 2.6;
/** The light a flat pixel gets, the zero of each kind's relief. */
const FLAT_LIT = 0.78;

/** Night ramps made once per kinds list. */
const nightRamps = new WeakMap<object, RGB[][]>();

/** Paint a tile in one go (the worker, the node script). */
export function paintTile(g: LandGround, col: number, row: number): LandTile {
  const steps = paintSteps(g, col, row);
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
}

/** Paint a tile a few rows at a time, yielding between (the main thread, when there are no workers). */
export function* paintSteps(g: LandGround, col: number, row: number): Generator<void, LandTile, void> {
  const W = TILE_W;
  const H = TILE_H;
  const x0 = col * W;
  const y0 = row * H;
  const PW = W + 2;
  const n = PW * (H + 2);
  const f: TileFields = {
    x0,
    y0,
    w: W,
    h: H,
    pw: PW,
    kind: new Uint8Array(n),
    height: new Float32Array(n),
    tone: new Float32Array(n),
    glow: new Float32Array(n),
  };
  const c: GroundCell = { kind: 0, height: 0, tone: 0, glow: 0 };
  for (let py = 0; py < H + 2; py++) {
    const wy = y0 - 1 + py;
    for (let px = 0; px < PW; px++) {
      c.kind = 0;
      c.height = 0;
      c.tone = 0;
      c.glow = 0;
      g.cell(x0 - 1 + px, wy, c);
      const i = py * PW + px;
      f.kind[i] = c.kind;
      f.height[i] = c.height;
      f.tone[i] = c.tone;
      f.glow[i] = c.glow;
    }
    if ((py & 7) === 7) yield;
  }
  g.decorate?.(f);

  let nights = nightRamps.get(g.kinds);
  if (!nights) nightRamps.set(g.kinds, (nights = g.kinds.map((k) => k.night ?? k.day.map(nightify))));
  const L = KEY_LIGHT;
  const Ll = Math.hypot(L.x, L.y, L.z);
  const dayD = new Uint8ClampedArray(W * H * 4);
  const nightD = new Uint8ClampedArray(W * H * 4);
  const normal = new Uint8ClampedArray(W * H * 4);
  const glow = new Uint8ClampedArray(W * H * 4);
  let glows = false;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y + 1) * PW + x + 1;
      const o = (y * W + x) * 4;
      const k = f.kind[i];
      const style = g.kinds[k];
      let nx = (f.height[i - 1] - f.height[i + 1]) * SLOPE;
      let ny = (f.height[i + PW] - f.height[i - PW]) * SLOPE;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const lit = (nx * L.x + ny * L.y + nz * L.z) / Ll;
      const step = style.mid + (lit - FLAT_LIT) * style.relief + f.tone[i] + (style.dither ? (bayer(x0 + x, y0 + y) - 0.5) * style.dither : 0);
      const dr = style.day;
      const nr = nights[k];
      const dc = dr[clampI(Math.round(step), dr.length)];
      const nc = nr[clampI(Math.round(step), nr.length)];
      dayD[o] = dc[0];
      dayD[o + 1] = dc[1];
      dayD[o + 2] = dc[2];
      dayD[o + 3] = 255;
      nightD[o] = nc[0];
      nightD[o + 1] = nc[1];
      nightD[o + 2] = nc[2];
      nightD[o + 3] = 255;
      normal[o] = Math.round((nx * 0.5 + 0.5) * 255);
      normal[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normal[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normal[o + 3] = 255;
      const gl = f.glow[i];
      if (gl > 0 && style.glow) {
        const gc = style.glow;
        const a = gl > 1 ? 1 : gl;
        glow[o] = gc[0] * a;
        glow[o + 1] = gc[1] * a;
        glow[o + 2] = gc[2] * a;
        glow[o + 3] = 255;
        glows = true;
      }
    }
    if ((y & 15) === 15) yield;
  }
  return { col, row, w: W, h: H, day: dayD, night: nightD, normal, glow: glows ? glow : null };
}

const clampI = (v: number, len: number): number => (v < 0 ? 0 : v >= len ? len - 1 : v);

// ---------------------------------------------------------------- helpers for lands

/** Smooth 0..1 between a and b. */
export const smooth = (a: number, b: number, v: number): number => {
  const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a);
  return t * t * (3 - 2 * t);
};

/** 4x4 ordered dither threshold at a pixel (0..1): soft edges between bands that stay crisp pixel art. */
export const bayer = (x: number, y: number): number => BAYER[(y & 3) * 4 + (x & 3)];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
