// The Cosmos Arena's art: the deep-space backdrop (unlit, mostly black, with
// faint nebulae, stars, a far galaxy and a dark ringed planet), the floating
// platform of star-stone (lit, with its own normal map and a glow layer for
// its inlays), obelisks, floating rocks, and the light and spell textures
// the arena and its boss use.

import { bayer, clamp01, mix } from './bitmap';
import { hash2, rng, valueNoise } from './env';
import { KEY_LIGHT, PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { COSMOS_CX, COSMOS_CY, COSMOS_H, COSMOS_RIM, COSMOS_RX, COSMOS_RY, COSMOS_W } from '../world/cosmosLayout';

const ramp = (...c: string[]): RGB[] => c.map(hex);

function fbm(x: number, y: number, scale: number, seed: number, octaves = 4): number {
  let v = 0;
  let amp = 0.5;
  let s = scale;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    v += valueNoise(x, y, s, seed + i * 17) * amp;
    total += amp;
    amp *= 0.5;
    s *= 0.5;
  }
  return v / total;
}

const smooth = (a: number, b: number, v: number): number => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- Deep space

const SPACE_BASE: RGB = hex('#03030a');
const NEB_A: RGB[] = ramp('#2a0e3e', '#5a1a6a', '#a0307e', '#e05aa0');
const NEB_B: RGB[] = ramp('#06203a', '#0c3e5e', '#1a7088', '#48b8c0');
const NEB_C: RGB[] = ramp('#1a1040', '#342070', '#5a3aa8');
const STARS: RGB[] = [hex('#ffffff'), hex('#cfe6ff'), hex('#9cc8ff'), hex('#ffe8b0'), hex('#ffc0d8')];

/** Pick along a colour ramp, 0..1, blending between its steps. */
function along(r: RGB[], t: number): RGB {
  const f = clamp01(t) * (r.length - 1);
  const i = Math.min(r.length - 2, Math.floor(f));
  return mix(r[i], r[i + 1], f - i);
}

/** Add `c` scaled by `k` into the pixel. */
function add(px: Uint8ClampedArray, i: number, c: RGB, k: number): void {
  px[i] = Math.min(255, px[i] + c[0] * k);
  px[i + 1] = Math.min(255, px[i + 1] + c[1] * k);
  px[i + 2] = Math.min(255, px[i + 2] + c[2] * k);
}

/**
 * The backdrop, one image the size of the arena. Mostly near-black: the
 * nebulae stay dim and are dithered to a few steps, so they read as pixel
 * art rather than a smooth gradient.
 */
export function spaceCanvas(): Uint8ClampedArray {
  const W = COSMOS_W;
  const H = COSMOS_H;
  const px = new Uint8ClampedArray(W * H * 4);
  const R = rng(4242);

  // The noise is costly, so it is sampled every other pixel and blended;
  // the dither below still works per pixel.
  const GW = Math.ceil(W / 2) + 1;
  const GH = Math.ceil(H / 2) + 1;
  const gN = new Float32Array(GW * GH);
  const gF = new Float32Array(GW * GH);
  const gL = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const x = gx * 2;
      const y = gy * 2;
      // Domain warp for wispy, folded clouds.
      const wx = x + (fbm(x, y, 90, 11, 3) - 0.5) * 120;
      const wy = y + (fbm(x, y, 90, 29, 3) - 0.5) * 120;
      const j = gy * GW + gx;
      gN[j] = fbm(wx, wy, 150, 3);
      gF[j] = fbm(wx, wy, 26, 7, 2);
      // Dark lanes of dust cut through the clouds where this noise crosses the middle.
      const l = fbm(wx * 1.4, wy * 1.4, 60, 41, 3);
      gL[j] = 1 - Math.max(0, 1 - Math.abs(l - 0.5) / 0.04) * 0.8;
    }
  }
  const sample = (g: Float32Array, x: number, y: number) => {
    const fx = x / 2;
    const fy = y / 2;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const j = y0 * GW + x0;
    const top = g[j] + (g[j + 1] - g[j]) * tx;
    const bot = g[j + GW] + (g[j + GW + 1] - g[j + GW]) * tx;
    return top + (bot - top) * ty;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const n = sample(gN, x, y);
      const fine = sample(gF, x, y);
      const lane = sample(gL, x, y);
      // A rose nebula across the upper left, a teal one low on the right,
      // and a violet veil between them.
      const a = Math.exp(-(((x - 150) / 260) ** 2 + ((y - 150) / 190) ** 2));
      const b = Math.exp(-(((x - 600) / 240) ** 2 + ((y - 470) / 200) ** 2));
      const c = Math.exp(-(((x - 420) / 320) ** 2 + ((y - 90) / 120) ** 2)) * 0.8;
      const shape = smooth(0.42, 0.78, n) * (0.7 + fine * 0.5);
      const ka = shape * a * lane;
      const kb = shape * b * lane;
      const kc = smooth(0.35, 0.8, n) * c * lane;
      let col: RGB = [SPACE_BASE[0], SPACE_BASE[1] + Math.round(y / H) * 1, SPACE_BASE[2] + Math.round((1 - y / H) * 4)];
      col = mix(col, along(NEB_C, kc * 1.2), Math.min(0.55, kc * 0.9));
      col = mix(col, along(NEB_A, ka * 1.3), Math.min(0.6, ka * 1.1));
      col = mix(col, along(NEB_B, kb * 1.3), Math.min(0.6, kb * 1.1));
      // Quantise with an ordered dither: a handful of steps per channel.
      const q = 7;
      const d = bayer(x, y);
      px[i] = Math.floor(col[0] / q + d) * q;
      px[i + 1] = Math.floor(col[1] / q + d) * q;
      px[i + 2] = Math.floor(col[2] / q + d) * q;
      px[i + 3] = 255;
    }
  }

  // A glow of violet haze around the platform, as if it lit the dust near it.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.hypot((x - COSMOS_CX) / (COSMOS_RX * 1.25), (y - COSMOS_CY - 12) / (COSMOS_RY * 1.3));
      const k = Math.exp(-((r - 0.8) ** 2) * 6) * 0.22;
      if (k < 0.02 || bayer(x, y) > k * 4) continue;
      add(px, (y * W + x) * 4, [58, 34, 110], 0.35);
    }
  }

  // A distant spiral galaxy in the upper left.
  const gx = 112;
  const gy = 96;
  for (let y = gy - 30; y <= gy + 30; y++) {
    for (let x = gx - 44; x <= gx + 44; x++) {
      const dx = (x - gx) / 40;
      const dy = (y - gy) / 16;
      const r = Math.hypot(dx, dy);
      if (r > 1.1) continue;
      const a = Math.atan2(dy, dx) - r * 5.5;
      const arm = Math.pow(Math.max(0, Math.cos(a * 2)), 4) * (1 - r);
      const bulge = Math.exp(-r * r * 30);
      const k = arm * 0.55 + bulge * 0.9;
      if (k < 0.04 || bayer(x, y) > k * 2.5) continue;
      add(px, (y * W + x) * 4, bulge > 0.3 ? [255, 236, 200] : [170, 170, 255], Math.min(1, k * 0.9));
    }
  }

  // A dark ringed planet low on the right, lit on its upper left rim.
  const pX = 640;
  const pY = 548;
  const pR = 92;
  const ring = (x: number, y: number) => {
    const dx = x - pX;
    const dy = (y - pY) * 3.2 + dx * 0.55;
    const r = Math.hypot(dx, dy) / pR;
    return r > 1.35 && r < 1.9 ? Math.sin((r - 1.35) * 40) * 0.25 + 0.6 : 0;
  };
  for (let y = pY - pR - 40; y < H; y++) {
    for (let x = pX - pR * 2; x < W; x++) {
      if (x < 0 || y < 0) continue;
      const i = (y * W + x) * 4;
      const dx = (x - pX) / pR;
      const dy = (y - pY) / pR;
      const d = Math.hypot(dx, dy);
      const rk = ring(x, y);
      const front = (y - pY) * 3.2 + (x - pX) * 0.55 > 0;
      if (d <= 1) {
        // Hidden behind the planet, unless it's the ring's near side.
        const lit = clamp01(-dx * 0.6 - dy * 0.75 - Math.sqrt(1 - d * d) * 0.2);
        const band = Math.sin(dy * 22 + fbm(x, y, 20, 91, 2) * 4) * 0.5 + 0.5;
        let col: RGB = mix(hex('#07061a'), hex('#1c1a4a'), band * 0.35);
        col = mix(col, hex('#8a7ae0'), smooth(0.45, 0.85, lit) * (d > 0.9 ? 1 : 0.6));
        if (d > 0.97 && lit > 0.3) col = hex('#c8c0ff');
        const q = 6;
        const bd = bayer(x, y);
        px[i] = Math.floor(col[0] / q + bd) * q;
        px[i + 1] = Math.floor(col[1] / q + bd) * q;
        px[i + 2] = Math.floor(col[2] / q + bd) * q;
        if (rk > 0 && front) add(px, i, [150, 130, 190], rk * 0.45);
      } else if (rk > 0) {
        add(px, i, [150, 130, 190], rk * 0.4);
      }
    }
  }

  // A small moon, top right.
  for (let y = 40; y < 84; y++) {
    for (let x = 606; x < 650; x++) {
      const dx = (x - 628) / 11;
      const dy = (y - 62) / 11;
      const d = Math.hypot(dx, dy);
      if (d > 1) continue;
      const lit = clamp01(-dx * 0.7 - dy * 0.5 + 0.2);
      const crater = fbm(x, y, 5, 33, 2) > 0.62 ? 0.75 : 1;
      const col = mix(hex('#141430'), hex('#d8d4f0'), smooth(0.3, 0.9, lit) * crater);
      const i = (y * W + x) * 4;
      px.set([col[0], col[1], col[2], 255], i);
    }
  }

  // Stars: many faint, a few bright with little crosses of light.
  for (let n = 0; n < 2600; n++) {
    const x = Math.floor(R() * W);
    const y = Math.floor(R() * H);
    const b = Math.pow(R(), 3);
    const c = STARS[Math.floor(R() * STARS.length)];
    const i = (y * W + x) * 4;
    add(px, i, c, 0.25 + b * 0.75);
    if (b > 0.55) {
      for (const [ox, oy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const xx = x + ox;
        const yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        add(px, (yy * W + xx) * 4, c, (b - 0.4) * 0.5);
      }
    }
  }
  return px;
}

/** Bright stars that twinkle as sprites over the backdrop, clear of the platform. */
export function twinkleSpots(count: number): { x: number; y: number; seed: number }[] {
  const R = rng(777);
  const out: { x: number; y: number; seed: number }[] = [];
  while (out.length < count) {
    const x = Math.floor(R() * COSMOS_W);
    const y = Math.floor(R() * COSMOS_H);
    const r = Math.hypot((x - COSMOS_CX) / COSMOS_RX, (y - COSMOS_CY - 14) / (COSMOS_RY + COSMOS_RIM));
    if (r < 1.12) continue;
    out.push({ x, y, seed: R() * 100 });
  }
  return out;
}

// ---------------------------------------------------------------- The platform

/** The platform image's box in arena coordinates: the top surface, its side and what hangs under it. */
export const PLATFORM_X = COSMOS_CX - COSMOS_RX - 2;
export const PLATFORM_Y = COSMOS_CY - COSMOS_RY - 2;
export const PLATFORM_W = COSMOS_RX * 2 + 4;
export const PLATFORM_H = COSMOS_RY * 2 + COSMOS_RIM + 30;

const TILE = ramp('#0c0e22', '#151934', '#1e2448', '#29315e', '#384478', '#4c5c96');
const INNER = ramp('#141630', '#1d2142', '#272d58', '#343d70', '#465290', '#6070b0');
const STAR_INLAY = ramp('#1a1238', '#241a4c', '#302264', '#3e2e7e');
const RIM = ramp('#10182e', '#1e2c4e', '#324874', '#50709e', '#86a8d0', '#c8e0ff');
const GOLD = ramp('#5a3a10', '#9a6a1c', '#d4a038', '#ffe08a');
const ROCK = ramp('#07060f', '#0e0c1c', '#16132a', '#201c3a', '#2c2650');
const GLOW_CYAN: RGB = hex('#4ae0ff');
const GLOW_VIOLET: RGB = hex('#a070ff');
const GLOW_GOLD: RGB = hex('#ffd070');

export interface PlatformArt {
  diffuse: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  emissive: Uint8ClampedArray;
}

/** Is (u, v) inside a regular 8-pointed star of outer radius `ro` and inner `ri`? */
function inStar(u: number, v: number, ro: number, ri: number, points = 8): boolean {
  const r = Math.hypot(u, v);
  if (r > ro) return false;
  const seg = (Math.PI * 2) / points;
  let a = Math.atan2(v, u) + Math.PI / 2;
  a = ((a % seg) + seg) % seg;
  const t = Math.abs(a / seg - 0.5) * 2; // 1 at a point, 0 between points
  return r <= ri + (ro - ri) * t;
}

/**
 * The platform: a disc of dark star-stone tiles with a raised star-metal
 * rim, an inlaid compass star and constellation ring in its heart, glowing
 * channels, and a round dais in the middle where the Warden hovers. Its
 * side hangs below: layered rock with crystal veins, breaking off into
 * jagged spurs.
 */
export function platformArt(): PlatformArt {
  const W = PLATFORM_W;
  const H = PLATFORM_H;
  const diffuse = new Uint8ClampedArray(W * H * 4);
  const normal = new Uint8ClampedArray(W * H * 4);
  const emissive = new Uint8ClampedArray(W * H * 4);
  const L = KEY_LIGHT;
  const Ll = Math.hypot(L.x, L.y, L.z);

  const put = (i: number, c: RGB, n: [number, number, number], glow?: RGB, gk = 1) => {
    diffuse.set([c[0], c[1], c[2], 255], i);
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    normal.set([Math.round((n[0] / l) * 127.5 + 127.5), Math.round((n[1] / l) * 127.5 + 127.5), Math.round((n[2] / l) * 127.5 + 127.5), 255], i);
    if (glow) emissive.set([Math.round(glow[0] * gk), Math.round(glow[1] * gk), Math.round(glow[2] * gk), 255], i);
  };
  const shadeOf = (n: [number, number, number]) => {
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    return (n[0] * L.x + n[1] * L.y + n[2] * L.z) / (l * Ll);
  };
  const pick = (r: RGB[], idx: number) => r[Math.max(0, Math.min(r.length - 1, Math.round(idx)))];

  // The constellation ring: twelve stars joined by faint lines.
  const constel: { u: number; v: number }[] = [];
  const CR = rng(99);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + (CR() - 0.5) * 0.3;
    const r = 0.4 + (CR() - 0.5) * 0.08;
    constel.push({ u: Math.cos(a) * r, v: Math.sin(a) * r });
  }
  const nearSeg = (u: number, v: number, a: { u: number; v: number }, b: { u: number; v: number }, w: number) => {
    const vx = b.u - a.u;
    const vy = b.v - a.v;
    const t = clamp01(((u - a.u) * vx + (v - a.v) * vy) / (vx * vx + vy * vy));
    return Math.hypot(u - a.u - vx * t, v - a.v - vy * t) < w;
  };

  for (let py = 0; py < H; py++) {
    for (let pxl = 0; pxl < W; pxl++) {
      const x = pxl + PLATFORM_X + 0.5;
      const y = py + PLATFORM_Y + 0.5;
      const i = (py * W + pxl) * 4;
      const u = (x - COSMOS_CX) / COSMOS_RX;
      const v = (y - COSMOS_CY) / COSMOS_RY;
      const r = Math.hypot(u, v);
      const ang = Math.atan2(v, u);
      const px1 = 1 / COSMOS_RX; // one pixel, in radii (roughly)

      if (r <= 1) {
        const ou: [number, number, number] = [u / (r || 1), -v / (r || 1), 0];
        if (r > 0.935) {
          // The raised rim: star-metal sloping outward, gold on its inner edge.
          const k = (r - 0.935) / 0.065;
          const n: [number, number, number] = [ou[0] * (k * 0.9), ou[1] * (k * 0.9), 1 - k * 0.3];
          if (r < 0.935 + px1 * 1.2) {
            put(i, pick(GOLD, 2 + shadeOf(n) * 1.5), n);
            continue;
          }
          const idx = 2.2 + shadeOf(n) * 3 + (hash2(pxl, py, 5) - 0.5) * 0.6;
          // Rune gems set into the rim every 22.5 degrees.
          const seg = (Math.PI * 2) / 16;
          const off = Math.abs((((ang % seg) + seg) % seg) - seg / 2) * r * COSMOS_RX;
          if (off < 1.2 && Math.abs(r - 0.968) < px1 * 1.5) {
            put(i, hex('#b8f4ff'), [0, 0, 1], GLOW_CYAN, 0.9);
            continue;
          }
          put(i, pick(RIM, idx), n);
          continue;
        }
        if (r > 0.62) {
          // Outer tiles: rings of wedges, with grout that catches the light on one side.
          const seg = (Math.PI * 2) / (r > 0.78 ? 36 : 30);
          const sa = ((ang % seg) + seg) % seg;
          const edgeA = Math.min(sa, seg - sa) * r * COSMOS_RX;
          const edgeR = Math.min(Math.abs(r - 0.62), Math.abs(r - 0.78), Math.abs(r - 0.935)) * COSMOS_RY;
          const tile = hash2(Math.floor((ang + Math.PI) / seg), r > 0.78 ? 1 : 0, 13);
          if (edgeA < 0.7 || edgeR < 0.8) {
            put(i, TILE[0], [0, 0, 1]);
            continue;
          }
          const bevel = edgeA < 1.7 || edgeR < 1.8;
          const n: [number, number, number] = bevel ? [ou[0] * 0.3, ou[1] * 0.3, 1] : [0, 0, 1];
          let idx = 2 + (tile - 0.5) * 1.6 + (fbm(x, y, 9, 21, 2) - 0.5) * 1.2 + (bevel ? 0.8 : 0);
          if (hash2(pxl, py, 8) > 0.994) idx = 5; // flecks of mica
          put(i, pick(TILE, idx), n);
          continue;
        }
        if (r > 0.585) {
          // A glowing channel around the heart.
          const k = 1 - Math.abs(r - 0.6025) / 0.0175;
          put(i, mix(hex('#0a1a2e'), hex('#3ac0e8'), k * 0.6), [0, 0, 1], GLOW_CYAN, 0.35 + k * 0.5);
          continue;
        }
        if (r > 0.2) {
          // The heart: polished stone, a violet compass star inlaid in gold,
          // and a ring of constellations.
          let n: [number, number, number] = [0, 0, 1];
          const starOut = inStar(u, v, 0.55, 0.24);
          const starEdge = starOut && !inStar(u, v, 0.55 - px1 * 1.6, 0.24 - px1 * 1.6);
          if (starEdge) {
            put(i, pick(GOLD, 2 + (hash2(pxl, py, 3) > 0.7 ? 1 : 0)), [0, 0.2, 1], GLOW_GOLD, 0.25);
            continue;
          }
          // Compass lines along the eight points.
          const seg = Math.PI / 4;
          const la = Math.abs((((ang + Math.PI / 2) % seg) + seg) % seg);
          const lineOff = Math.min(la, seg - la) * r * COSMOS_RX;
          if (lineOff < 0.55 && !starOut) {
            put(i, pick(GOLD, 1.5), [0, 0, 1], GLOW_GOLD, 0.2);
            continue;
          }
          for (let k = 0; k < constel.length && !starOut; k++) {
            const s = constel[k];
            const d = Math.hypot((u - s.u) * COSMOS_RX, (v - s.v) * COSMOS_RY);
            if (d < 1.3) {
              put(i, hex('#fff4d8'), [0, 0, 1], GLOW_GOLD, 0.9);
              n = [2, 2, 2]; // mark as drawn
              break;
            }
            if (k % 4 !== 3 && nearSeg(u, v, s, constel[(k + 1) % 12], px1 * 0.5)) {
              put(i, mix(INNER[2], hex('#c8a060'), 0.5), [0, 0, 1], GLOW_GOLD, 0.12);
              n = [2, 2, 2];
              break;
            }
          }
          if (n[0] === 2) continue;
          const base = starOut ? STAR_INLAY : INNER;
          const sheen = Math.sin((u - v) * 9 + fbm(x, y, 16, 44, 2) * 3) * 0.5 + 0.5;
          let idx = 2 + sheen * 0.9 + (fbm(x, y, 7, 61, 2) - 0.5) * 0.8;
          if (!starOut && hash2(pxl, py, 12) > 0.992) idx = 5;
          if (starOut && hash2(pxl, py, 14) > 0.985) {
            put(i, hex('#e0d0ff'), n, GLOW_VIOLET, 0.6);
            continue;
          }
          put(i, pick(base, idx), n);
          continue;
        }
        if (r > 0.16) {
          const k = 1 - Math.abs(r - 0.18) / 0.02;
          put(i, mix(hex('#1a0e38'), hex('#a070ff'), k * 0.6), [0, 0, 1], GLOW_VIOLET, 0.35 + k * 0.5);
          continue;
        }
        // The dais: a low round step, with a four-pointed star of light at its centre.
        const edge = r > 0.14;
        const n: [number, number, number] = edge ? [ou[0] * 0.6, ou[1] * 0.6, 1] : [0, 0, 1];
        if (inStar(u * 1.0, v * 1.0, 0.12, 0.03, 4)) {
          const hot = inStar(u, v, 0.06, 0.015, 4);
          put(i, hot ? hex('#fffbe8') : pick(GOLD, 3), [0, 0, 1], GLOW_GOLD, hot ? 1 : 0.55);
          continue;
        }
        put(i, pick(RIM, 2 + shadeOf(n) * 2.5 + (edge ? 0 : -0.5)), n);
        continue;
      }

      // Below the top edge: the platform's side, and the rock hanging under it.
      if (Math.abs(u) >= 1 || v < 0) continue;
      const edgeY = COSMOS_CY + COSMOS_RY * Math.sqrt(1 - u * u);
      const front = Math.sqrt(1 - u * u);
      const drop = y - edgeY;
      const spur = Math.pow(fbm(x, 0, 7, 88, 2), 2.2) * 30 + (hash2(Math.floor(x / 3), 0, 9) > 0.8 ? 6 : 0);
      const depth = COSMOS_RIM * (0.55 + 0.45 * front) + spur * front;
      if (drop < 0 || drop > depth) continue;
      const sideN: [number, number, number] = [u * 0.7, -0.35, 0.75];
      if (drop < 3) {
        // The rim's gold band continues round the lip.
        put(i, pick(drop < 1.5 ? GOLD : RIM, drop < 1.5 ? 2 + shadeOf(sideN) : 1), sideN);
        continue;
      }
      const strata = Math.floor((drop + fbm(x, 0, 18, 51, 2) * 6) / 6) % 2;
      const fade = drop / depth;
      let idx = 3 - fade * 2.6 - strata * 0.5 + shadeOf(sideN) * 1.2 + (fbm(x, y, 4, 71, 2) - 0.5) * 0.8;
      // Crystal veins through the rock, glowing violet and cyan.
      const vein = fbm(x * 0.8, y * 2.2, 14, 23, 3);
      if (Math.abs(vein - 0.5) < 0.018 && fade < 0.85) {
        const cyan = hash2(Math.floor(x / 20), 0, 4) > 0.5;
        put(i, cyan ? hex('#8ae8ff') : hex('#c8a0ff'), sideN, cyan ? GLOW_CYAN : GLOW_VIOLET, 0.7 * (1 - fade));
        continue;
      }
      if (fade > 0.92) idx -= 1;
      put(i, pick(ROCK, idx), sideN);
    }
  }
  return { diffuse, normal, emissive };
}

// ---------------------------------------------------------------- Props

const OB_METAL: Material = { ramp: ramp('#10172e', '#1e2a4c', '#304470', '#4c6a9c', '#86a8d4'), outline: hex('#05040f'), outlineLit: hex('#1a2444'), shine: true };
const OB_GOLD: Material = { ramp: ramp('#4a2c0c', '#8a5c18', '#c89430', '#f4d070'), outline: hex('#1c1006'), shine: true };
const OB_CRYSTAL: Material = { ramp: ramp('#2a4a90', '#4a8ae0', '#8ad4ff', '#e0f8ff', '#ffffff'), outline: hex('#08122a'), emissive: 0.7, shine: true, noAO: true };
const OB_RUNE: Material = { ramp: ramp('#4ae0ff', '#c8f8ff'), outline: hex('#05040f'), emissive: 0.9, noAO: true };
const FLOAT_ROCK: Material = { ramp: ramp('#07060f', '#110f22', '#1c1836', '#2a2450', '#3e3670'), outline: hex('#03020a'), outlineLit: hex('#18142e') };

export const OBELISK_W = 18;
export const OBELISK_H = 50;
/** Feet in the obelisk frame. */
export const OBELISK_OY = 47;

/** An obelisk of star-metal with a crystal floating over its tip. `bob` lifts the crystal. */
export function obelisk(bob: number): PixelCanvas {
  const c = new PixelCanvas(OBELISK_W, OBELISK_H);
  const cx = 9;
  // Stepped base.
  c.part();
  c.shape(43, 47, () => [cx - 7, cx + 7], OB_METAL, (_x, _y, t, u) => cyl(t, 0.6 - u));
  c.part();
  c.shape(40, 43, () => [cx - 5.5, cx + 5.5], OB_GOLD, (_x, _y, t) => cyl(t, 0.5));
  // Tapering shaft.
  c.part();
  c.shape(17, 40, (y) => {
    const hw = 3 + ((y - 17) / 23) * 1.8;
    return [cx - hw, cx + hw];
  }, OB_METAL, (_x, _y, t) => cyl(t, 0.1));
  // Glowing runes down its face.
  c.part();
  for (const y of [21, 25, 29, 33, 37]) c.px(cx, y, OB_RUNE);
  c.px(cx - 1, 29, OB_RUNE);
  c.px(cx + 1, 29, OB_RUNE);
  // Pyramid tip.
  c.part();
  c.shape(12, 17, (y) => {
    const hw = ((y - 12) / 5) * 3.2 + 0.4;
    return [cx - hw, cx + hw];
  }, OB_GOLD, (_x, _y, t, u) => sphere(t * 0.8, 0.6 - u * 0.4));
  // The crystal, floating above.
  c.part();
  const top = 1 + bob;
  c.shape(top, top + 8, (y) => {
    const u = (y - top) / 8;
    const hw = 0.4 + Math.sin(u * Math.PI) * 2.4;
    return [cx - hw, cx + hw];
  }, OB_CRYSTAL, (_x, _y, t, u) => sphere(t * 0.8, (0.5 - u) * 0.9));
  c.spark(cx - 1, top + 3, hex('#ffffff'), 0.8);
  return c;
}

export const FLOAT_ROCK_W = 30;
export const FLOAT_ROCK_H = 26;

/** A chunk of rock drifting in space, crystals poking from its top. */
export function floatingRock(seed: number): PixelCanvas {
  const c = new PixelCanvas(FLOAT_ROCK_W, FLOAT_ROCK_H);
  const R = rng(seed * 131 + 7);
  const cx = 15;
  const top = 8;
  const w = 8 + R() * 4;
  c.part();
  // A flat top face, then a hanging, pointed underside.
  c.shape(top, 23, (y) => {
    const u = (y - top) / 15;
    const hw = u < 0.25 ? w * (0.7 + u * 1.2) : w * (1 - (u - 0.25) / 0.75) ** 1.3 + 0.5;
    const skew = (R() - 0.5) * 0.8;
    return [cx - hw + skew, cx + hw + skew];
  }, FLOAT_ROCK, (_x, _y, t, u) => sphere(t * 0.85, u < 0.25 ? 0.7 : -0.3 - u * 0.4));
  c.part();
  const n = 1 + Math.floor(R() * 3);
  for (let k = 0; k < n; k++) {
    const x = cx - w * 0.5 + R() * w;
    const h = 3 + R() * 5;
    c.shape(Math.round(top + 1 - h), top + 1, (y) => {
      const u = (y - (top + 1 - h)) / h;
      const hw = 0.3 + u * 1.3;
      return [x - hw, x + hw];
    }, OB_CRYSTAL, (_x, _y, t) => cyl(t, 0.4));
  }
  return c;
}

// ---------------------------------------------------------------- Light and spells (premultiplied, drawn additively)

export const RAY_W = 44;
export const RAY_H = 240;

/**
 * A shaft of starlight falling from high above: a soft beam that widens a
 * little toward the ground, with brighter strands inside it. White; tinted
 * in the game.
 */
export function cosmicRay(seed: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(RAY_W * RAY_H * 4);
  const R = rng(seed);
  const strands = [0, 1, 2, 3].map(() => ({ at: (R() - 0.5) * 1.1, w: 0.12 + R() * 0.2, a: 0.3 + R() * 0.5 }));
  for (let y = 0; y < RAY_H; y++) {
    const u = y / RAY_H;
    const hw = 9 + u * 10;
    // Fades in from nothing up high, full near the ground, a soft landing.
    const along = smooth(0, 0.55, u) * (u > 0.94 ? 1 - (u - 0.94) / 0.06 * 0.7 : 1);
    for (let x = 0; x < RAY_W; x++) {
      const t = (x + 0.5 - RAY_W / 2) / hw;
      if (Math.abs(t) > 1.3) continue;
      let a = Math.max(0, 1 - (t * t) / 1.69) ** 1.6 * 0.5;
      for (const s of strands) {
        const d = (t - s.at) / s.w;
        if (Math.abs(d) < 1) a += (1 - d * d) * s.a * 0.35;
      }
      a = Math.round(Math.min(1, a * along) * 9) / 9;
      const i = (y * RAY_W + x) * 4;
      const v = Math.round(255 * a * 0.7);
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }
  }
  return px;
}

/** A pool of light where a ray lands: an ellipse in soft bands. White. */
export function lightPool(w: number, h: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2));
      const a = d < 0.35 ? 0.5 : d < 0.6 ? 0.32 : d < 0.82 ? 0.17 : d < 1 ? 0.07 : 0;
      const i = (y * w + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = Math.round(255 * a);
      px[i + 3] = 255;
    }
  }
  return px;
}

export const METEOR_W = 11;
export const METEOR_H = 34;

/** A falling star: a white-hot head at the bottom and a tapering violet tail above it. */
export function meteor(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(METEOR_W * METEOR_H * 4);
  const hx = METEOR_W / 2;
  const hy = METEOR_H - 5.5;
  for (let y = 0; y < METEOR_H; y++) {
    for (let x = 0; x < METEOR_W; x++) {
      const dx = x + 0.5 - hx;
      const dy = y + 0.5 - hy;
      const head = Math.hypot(dx, dy);
      let c: RGB | null = null;
      if (head < 1.6) c = [255, 255, 255];
      else if (head < 2.8) c = [210, 236, 255];
      else if (head < 4.2) c = [150, 120, 255];
      else if (dy < 0) {
        const u = -dy / (METEOR_H - 6);
        const hw = 3.2 * (1 - u);
        if (Math.abs(dx) < hw) {
          const k = (1 - u) * (1 - Math.abs(dx) / hw);
          c = k > 0.55 ? [230, 240, 255] : k > 0.25 ? [160, 130, 255] : k > 0.08 ? [90, 50, 170] : null;
        }
      }
      if (!c) continue;
      px.set([c[0], c[1], c[2], 255], (y * METEOR_W + x) * 4);
    }
  }
  return px;
}

/** A thick ring of light, for shockwaves: `w` x `h`, `k` of its radius thick. White. */
export function shockRing(w: number, h: number, k: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2));
      if (d > 1) continue;
      const t = (d - (1 - k)) / k;
      if (t < 0) continue;
      const a = t > 0.75 ? 1 : t > 0.45 ? 0.6 : 0.25;
      const i = (y * w + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = Math.round(255 * a);
      px[i + 3] = 255;
    }
  }
  return px;
}

export const HOLE_SIZE = 40;

/**
 * The singularity: a black disc (drawn normally, it blots out what is
 * behind it) and, as a second image, the ring of light bent around it.
 */
export function singularity(): { core: Uint8ClampedArray; ring: Uint8ClampedArray } {
  const n = HOLE_SIZE;
  const core = new Uint8ClampedArray(n * n * 4);
  const ring = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - n / 2;
      const dy = y + 0.5 - n / 2;
      const d = Math.hypot(dx, dy) / (n / 2);
      const i = (y * n + x) * 4;
      if (d < 0.42) core.set([2, 1, 8, 255], i);
      else if (d < 0.47) core.set([2, 1, 8, 170], i);
      // The accretion ring: brightest just outside the core, fading out in
      // spiral streaks.
      if (d >= 0.4 && d < 1) {
        const a = Math.atan2(dy, dx);
        const swirl = Math.sin(a * 3 + d * 9) * 0.5 + 0.5;
        const k = Math.max(0, 1 - (d - 0.44) / 0.56) ** 1.6 * (0.55 + swirl * 0.45);
        const s = Math.round(k * 6) / 6;
        if (s <= 0) continue;
        const c: RGB = d < 0.52 ? [255, 250, 255] : mix([255, 150, 220], [120, 70, 230], (d - 0.52) / 0.48);
        ring.set([Math.round(c[0] * s), Math.round(c[1] * s), Math.round(c[2] * s), 255], i);
      }
    }
  }
  return { core, ring };
}

/** A shooting star's streak, drawn additively: a bright head at the right end. */
export function streak(w: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * 3 * 4);
  for (let x = 0; x < w; x++) {
    const u = x / (w - 1);
    const a = u * u;
    const mid = (1 * w + x) * 4;
    px.set([Math.round(220 * a), Math.round(235 * a), Math.round(255 * a), 255], mid);
    if (u > 0.85) {
      for (const row of [0, 2]) px.set([Math.round(120 * a), Math.round(140 * a), Math.round(220 * a), 255], (row * w + x) * 4);
    }
  }
  return px;
}
