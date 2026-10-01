// The Aurora Colosseum's art.
//
// The sky (one plain picture the size of the arena): night over the roof of
// the world, the northern lights hanging in curtains, a low moon, ranges of
// snow peaks, and a sea of cloud far below with the near peaks standing out
// of it.
//
// The colosseum (one lit picture, with its normal map and a glow layer): it
// is built as a height field (the floor, the frozen lake sunk a pixel into
// it, the wall's walkway and coping, the tiered stands behind the north wall
// with their crown and merlons, the stairs through the parapet) and drawn
// the game's way, z up drawn z px higher, a column at a time from the front
// back, so every rise shows its face: the north wall's inner face with its
// three arches, rune frieze, banners and icicles; the risers of the stands,
// where the ghosts of the old crowd still sit; the parapet's outer face, the
// great masonry it stands on and the crag below, fading into the cloud.
//
// And its pieces: the frozen champions on their plinths, the braziers of
// blue fire, the light that kindles in each arch, and the aurora ribbons the
// arena scrolls over its sky.

import { bayer, clamp01, mix } from './bitmap';
import { hash2, valueNoise } from './env';
import { KEY_LIGHT, PixelCanvas, hex, sphere, cyl, type Material, type RGB } from './pixel';
import { C_AURORA, C_ICE, C_TEAL, C_VIOLET, C_WHITE, C_PINK, GLOW_AURORA, GLOW_ICE, ICE, ICE_DARK, ICE_GLOW, IRON, RIME, SNOW, crystal, icicles, ramp } from './frostKit';
import { FROST_CX, FROST_CY, FROST_H, FROST_RX, FROST_RY, FROST_W, GATES, BANNERS, LAKE_K, STANDS_H, STANDS_K, WALL_K, archSize, northK, standsK, wallH, type Gate } from '../world/frostLayout';

/** Pick along a colour ramp, 0..1, blending between its steps. */
function along(r: RGB[], t: number): RGB {
  const f = clamp01(t) * (r.length - 1);
  const i = Math.min(r.length - 2, Math.floor(f));
  return mix(r[i], r[i + 1], f - i);
}
const pick = (r: RGB[], idx: number): RGB => r[Math.max(0, Math.min(r.length - 1, Math.round(idx)))];
const add = (a: RGB, b: RGB, k: number): RGB => [Math.min(255, a[0] + b[0] * k), Math.min(255, a[1] + b[1] * k), Math.min(255, a[2] + b[2] * k)];
const RAD = Math.PI / 180;

// ---------------------------------------------------------------- The sky

const NIGHT = ramp('#02040b', '#040919', '#071029', '#0a1838', '#0e2246', '#132c54', '#193860');
const CLOUD = ramp('#081022', '#0c1630', '#122040', '#192c52', '#213a66', '#2c4a7a', '#3c5e90', '#5276a8', '#6e92c2');
const FAR_PEAK = ramp('#0a1428', '#0f1c36', '#152646', '#1d3256', '#28406a', '#3a5682', '#56729e');
const NEAR_PEAK = ramp('#060c1a', '#0a1426', '#101e36', '#182a48', '#24395e', '#365078', '#4e6c96', '#7090ba', '#9cb6da');
const MOON = ramp('#5a6a8e', '#8494b8', '#aebcda', '#d4def0', '#f0f6ff');

/** The northern lights' curtains: where each hangs, how it waves, how far its rays climb, how bright. */
const CURTAINS = [
  { base: 132, amp: 22, f1: 0.0105, p1: 0.4, f2: 0.031, p2: 1.7, h: 78, k: 1, seed: 3 },
  { base: 86, amp: 18, f1: 0.0078, p1: 2.1, f2: 0.022, p2: 0.3, h: 58, k: 0.62, seed: 7 },
  { base: 186, amp: 16, f1: 0.0132, p1: 4.4, f2: 0.027, p2: 2.6, h: 52, k: 0.48, seed: 11 },
];

/** The light of the aurora at (x, y): how bright, and its colour (green low, teal, violet high, a blush under its hem). */
function auroraAt(x: number, y: number): { k: number; c: RGB } {
  let k = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const cu of CURTAINS) {
    const by = cu.base + cu.amp * Math.sin(x * cu.f1 + cu.p1) + cu.amp * 0.5 * Math.sin(x * cu.f2 + cu.p2);
    const d = by - y;
    if (d < -4 || d > cu.h * 3) continue;
    // Rays: streaks that lean a little, brighter in bands along the curtain.
    const ray = 0.35 + 0.75 * Math.pow(valueNoise(x + d * 0.16, 0, 5, cu.seed), 1.6) * (0.6 + 0.4 * valueNoise(x, 0, 60, cu.seed + 1));
    const i = (d < 0 ? (1 + d / 4) * 0.8 : Math.exp(-d / cu.h) * (d < 3 ? 1.25 : 1)) * ray * cu.k;
    if (i <= 0) continue;
    const t = clamp01(d / (cu.h * 1.4));
    const c = d < 0 ? mix(C_PINK, C_AURORA, 0.5) : t < 0.45 ? mix(C_AURORA, C_TEAL, t / 0.45) : mix(C_TEAL, C_VIOLET, (t - 0.45) / 0.55);
    r += c[0] * i;
    g += c[1] * i;
    b += c[2] * i;
    k += i;
  }
  return k > 0 ? { k, c: [r / k, g / k, b / k] } : { k: 0, c: [0, 0, 0] };
}

/** A ridged noise: sharp crests, soft valleys. */
const ridged = (x: number, scale: number, s: number) => 1 - Math.abs(valueNoise(x, 0, scale, s) * 2 - 1);
/** The far range's skyline. */
const farTop = (x: number) => 262 - 64 * ridged(x, 92, 21) - 26 * ridged(x + 40, 31, 22) - 8 * valueNoise(x, 0, 9, 23);
/** How much the near peaks stand out at each side (none in the middle, where the colosseum hides them). */
const nearK = (x: number) => clamp01((Math.abs(x - FROST_CX) - 150) / 170);
const nearTop = (x: number) => 392 - nearK(x) * (150 * ridged(x, 70, 31) + 46 * ridged(x + 13, 23, 32));
/** The cloud sea's top, and its bands of billows below, each nearer and taller. */
const cloudTop = (x: number) => 340 + 12 * Math.sin(x * 0.019) + 10 * valueNoise(x, 0, 34, 41);

/** The sky behind the colosseum, the size of the arena. */
export function* frostSkyArt(): Generator<void, Uint8ClampedArray, void> {
  const W = FROST_W;
  const H = FROST_H;
  const px = new Uint8ClampedArray(W * H * 4);
  const moonX = 118;
  const moonY = 56;
  const moonR = 12;
  for (let y = 0; y < H; y++) {
    if (y % 8 === 0) yield;
    for (let x = 0; x < W; x++) {
      const by = bayer(x, y);
      // Night, deepest at the top, paler toward the horizon.
      let c = along(NIGHT, Math.floor((y / 330) * 9 + by) / 9);
      // Stars, thinning toward the horizon; a few bright ones with a cross.
      const st = hash2(x, y, 51);
      if (st > 0.9965 - (y > 200 ? (y - 200) * -0.00002 : 0) && y < 300) c = mix(c, hash2(x, y, 52) > 0.5 ? C_WHITE : C_ICE, 0.45 + hash2(x, y, 53) * 0.5);
      // The moon, low in the west: a pale disc, its seas, and a halo.
      const md = Math.hypot(x - moonX, y - moonY);
      if (md < moonR) {
        const n = sphere((x + 0.5 - moonX) / moonR, (y + 0.5 - moonY) / moonR);
        const l = n.x * KEY_LIGHT.x * -0.2 + n.y * 0.3 + n.z * 0.9;
        let idx = 1.4 + l * 2.6;
        if (valueNoise(x, y, 4, 61) > 0.62) idx -= 1;
        c = pick(MOON, idx + by * 0.5);
      } else if (md < moonR + 34) {
        const h = Math.pow(1 - (md - moonR) / 34, 2);
        c = add(c, [110, 140, 190], Math.floor(h * 5 + by) / 5 * 0.35);
      }
      // The aurora, in a few dithered steps.
      const a = auroraAt(x, y);
      if (a.k > 0.02) c = add(c, a.c, Math.min(0.85, Math.floor(Math.min(1, a.k) * 7 + by) / 7) * 0.62);
      // The far range, snow on its shoulders, lit on its west faces, the aurora on its crests.
      const ft = farTop(x);
      if (y >= ft) {
        const slope = farTop(x + 1) - farTop(x - 1);
        const lit = slope < 0;
        const depth = y - ft;
        const snow = depth < 28 + 20 * valueNoise(x, 0, 17, 25);
        let idx = snow ? (lit ? 5 : 3.4) : lit ? 2.4 : 1.4;
        idx -= Math.min(2.2, depth / 60);
        if (valueNoise(x * 3, y * 0.4, 6, 26) > 0.66) idx -= 0.8;
        c = pick(FAR_PEAK, idx + by * 0.6);
        if (depth < 1.2) c = mix(c, C_AURORA, 0.35);
        // Haze toward its foot.
        c = mix(c, NIGHT[5], clamp01((depth - 30) / 90) * 0.6);
      }
      // The cloud sea, in bands of billows, each nearer one taller, their tops lit by the moon and the aurora.
      const ct = cloudTop(x);
      if (y >= ct) {
        let top = ct;
        let hBand = 18;
        let k = 0;
        while (k < 12) {
          const next = top + hBand + 9 * valueNoise(x, k * 50, 19 + k * 3, 43 + k) + 4 * Math.abs(Math.sin(x * (0.09 - k * 0.005) + k * 1.7));
          if (y < next) break;
          top = next;
          hBand += 7;
          k++;
        }
        const local = (y - top) / hBand;
        const billow = valueNoise(x, y * 1.6, 15 + k * 3, 44 + k);
        let idx = 6.2 - local * 4.2 + billow * 1.6 - Math.max(0, 3 - k) * 0.6;
        if (local < 0.06) idx += 1.2;
        c = pick(CLOUD, Math.floor(idx + by * 0.9));
        if (local < 0.1) c = mix(c, C_AURORA, 0.08);
      }
      // The near peaks at the sides, standing out of the cloud.
      const nt = nearTop(x);
      if (nearK(x) > 0 && y >= nt && y < ct + 40 + 30 * valueNoise(x, 0, 23, 33)) {
        const slope = nearTop(x + 1) - nearTop(x - 1);
        const lit = slope < -0.2;
        const depth = y - nt;
        const snow = depth < 30 + 60 * valueNoise(x, 0, 13, 34) && valueNoise(x * 0.8 + y * (lit ? -0.5 : 0.5), y, 11, 35) > 0.32;
        let idx = snow ? (lit ? 7.2 : 5) : lit ? 3.4 : 1.6;
        // Gullies running down the faces.
        if (Math.abs(valueNoise(x * 3 + y * (lit ? 1 : -1), 0, 9, 36) - 0.5) < 0.05) idx -= 1.6;
        idx -= depth / 90;
        c = pick(NEAR_PEAK, idx + by * 0.7);
        if (depth < 1.2) c = mix(c, lit ? C_WHITE : C_AURORA, 0.4);
        const fog = clamp01((y - ct - 10) / 40);
        if (fog > 0) c = mix(c, CLOUD[4], Math.floor(fog * 4 + by) / 4);
      }
      px.set([c[0], c[1], c[2], 255], (y * W + x) * 4);
    }
  }
  return px;
}

// ---------------------------------------------------------------- The colosseum's shape

const K_NONE = 0;
const K_FLOOR = 1;
const K_LAKE = 2;
const K_WALK = 3;
const K_COPING = 4;
const K_STAND = 5;
const K_CROWN = 6;
const K_MERLON = 7;
const K_STAIR = 8;
const K_POST = 9;

/** The coping's lip along the wall's inner edge, as a share of the radii, and how far it stands above the walkway. */
const COPING_K = 0.014;
const COPING_UP = 2;
/** The stands: four tiers of seats, then the crown wall. */
const TIERS = 4;
const TIER_Q = 0.18;
const TIER_RISE = 0.17;
const MERLON_UP = 7;
/** The stairs through the parapet: steps of this height down across the wall's width. */
const STAIR_STEPS = 4;
const STAIR_STEP = 3;

/** How far round the floor one px of wall runs, near angle `deg`: the ellipse's local radius. */
const localR = (deg: number) => Math.hypot(FROST_RX * Math.sin(deg * RAD), FROST_RY * Math.cos(deg * RAD));
const angDiff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;

/** The stair gate at angle `deg`, if any, and how far into its gap (0 middle, 1 its edge, up to 1.4 its posts). */
function stairAt(deg: number): { g: Gate; t: number } | null {
  for (const g of GATES) {
    if (g.kind !== 'stair') continue;
    const half = ((archSize(g).w / 2) / localR(g.deg)) / RAD;
    const t = Math.abs(angDiff(deg, g.deg)) / half;
    if (t < 1.4) return { g, t };
  }
  return null;
}

/** How deep the masonry and the crag below the south parapet hang, at column x. */
function dropAt(x: number): number {
  const u = (x - FROST_CX) / (FROST_RX * (1 + WALL_K));
  const front = Math.sqrt(Math.max(0, 1 - u * u));
  return 40 + 56 * front + 20 * Math.pow(valueNoise(x, 0, 13, 88), 2) + (hash2(Math.floor(x / 5), 0, 9) > 0.8 ? 7 : 0) * front;
}

/** The colosseum's height at a point on the ground, and what stands there. */
function heightAt(x: number, y: number): { z: number; kind: number; tier: number } {
  const u = (x - FROST_CX) / FROST_RX;
  const v = (y - FROST_CY) / FROST_RY;
  const r = Math.hypot(u, v);
  if (r < LAKE_K) return { z: -1, kind: K_LAKE, tier: 0 };
  if (r <= 1) return { z: 0, kind: K_FLOOR, tier: 0 };
  const deg = Math.atan2(v, u) / RAD;
  const H = wallH(deg);
  if (r <= 1 + WALL_K) {
    const st = stairAt(deg);
    if (st && st.t < 1) return { z: -Math.floor(((r - 1) / WALL_K) * STAIR_STEPS) * STAIR_STEP, kind: K_STAIR, tier: 0 };
    if (st) return { z: H + 4, kind: K_POST, tier: 0 };
    if (r <= 1 + COPING_K) return { z: H + COPING_UP, kind: K_COPING, tier: 0 };
    return { z: H, kind: K_WALK, tier: 0 };
  }
  const nk = standsK(deg);
  if (nk > 0.03) {
    const q = (r - 1 - WALL_K) / (STANDS_K * nk);
    if (q <= 1) {
      const SH = STANDS_H * nk;
      const t = Math.floor(q / TIER_Q);
      if (t < TIERS) return { z: Math.round(H + (t + 1) * TIER_RISE * SH), kind: K_STAND, tier: t };
      // The crown wall along the top, crenellated.
      const s = deg * RAD * 230;
      const merlon = ((s % 12) + 12) % 12 < 7;
      return { z: Math.round(H + SH) + (merlon && q > 0.9 ? MERLON_UP : 0), kind: merlon && q > 0.9 ? K_MERLON : K_CROWN, tier: TIERS };
    }
  }
  // Beyond the wall: the drop (south) or nothing (behind the stands).
  return { z: -dropAt(x), kind: K_NONE, tier: 0 };
}

/** Where a tier's riser (or, with `t` = TIERS, the crown's face) rises from, at angle `deg`. */
function standBase(deg: number, t: number): number {
  const H = wallH(deg);
  const SH = STANDS_H * standsK(deg);
  return t === 0 ? H : Math.round(H + t * TIER_RISE * SH);
}

// ---------------------------------------------------------------- Arches

/** The floor's north edge at column x (where the wall's inner face stands). */
const northEdge = (x: number) => FROST_CY - FROST_RY * Math.sqrt(Math.max(0, 1 - ((x - FROST_CX) / FROST_RX) ** 2));

/**
 * What of an arch is at column x, `h` px above the floor's edge: 2 inside its
 * opening, 1 its ring of stones, 0 nothing. `sp` is how far along the wall
 * from its middle, `top` the opening's height there.
 */
function archAt(g: Gate, x: number, h: number): { part: 0 | 1 | 2; sp: number; top: number; hw: number } {
  const { w, h: ah } = archSize(g);
  const hw = w / 2;
  const deg = Math.atan2((northEdge(x) - FROST_CY) / FROST_RY, (x - FROST_CX) / FROST_RX) / RAD;
  const sp = angDiff(deg, g.deg) * RAD * localR(g.deg);
  const ring = g.great ? 5 : 3;
  if (Math.abs(sp) > hw + ring) return { part: 0, sp, top: 0, hw };
  const spring = ah - hw * 0.72;
  const curve = (half: number, a: number) => (Math.abs(a) < half ? spring + Math.sqrt(half * half - a * a) * 0.72 : -1);
  const top = curve(hw, sp);
  if (top > 0 && h < top) return { part: 2, sp, top, hw };
  const outer = curve(hw + ring, sp);
  if (outer > 0 && h < outer + (g.great ? 1 : 0)) return { part: 1, sp, top: outer, hw };
  return { part: 0, sp, top, hw };
}

const ARCHES = GATES.filter((g) => g.kind === 'arch');

// ---------------------------------------------------------------- The colosseum

const FLAG = ramp('#0c121e', '#151e2e', '#1f2b40', '#2b3a52', '#3a4b66', '#4d607e', '#647a98', '#8296b2');
const WALLSTONE = ramp('#0a0e18', '#121a28', '#1b2638', '#25334a', '#32435e', '#435674', '#586c8c', '#7286a6');
const SNOWR = ramp('#3e4e74', '#5a6e98', '#7e94bc', '#a6bad8', '#c8d8ee', '#e4eefa', '#f8fbff');
const LAKE = ramp('#030a18', '#061226', '#0a1d38', '#0f2b4c', '#163c62', '#1f5078', '#2c688f', '#4486aa', '#6aa8c8', '#a4d4ec');
const ROCK = ramp('#05080f', '#0a0f1b', '#111829', '#1a2338', '#24304a', '#33425e');
const BANNER = ramp('#071a2c', '#0c2a44', '#13405e', '#1c5678', '#286e94', '#3a8ab0');
const SILVER = ramp('#3a4660', '#6a7a98', '#a4b2cc', '#dfe8f6');
const MORTAR: RGB = hex('#05080f');
const GHOST: RGB = hex('#9cc2ee');

export interface FrostArenaArt {
  diffuse: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  emissive: Uint8ClampedArray;
}

/** Nearest and second-nearest distance to jittered points on a grid of cells `size` px wide. */
function cells(x: number, y: number, size: number, s: number): { d1: number; d2: number; id: number } {
  const gx = Math.floor(x / size);
  const gy = Math.floor(y / size);
  let d1 = Infinity;
  let d2 = Infinity;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i;
      const cy = gy + j;
      const px = (cx + 0.15 + hash2(cx, cy, s) * 0.7) * size;
      const py = (cy + 0.15 + hash2(cx, cy, s + 1) * 0.7) * size;
      const d = Math.hypot(x - px, (y - py) * 1.4);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash2(cx, cy, s + 2);
      } else if (d < d2) d2 = d;
    }
  }
  return { d1, d2, id };
}

/** A rune: a few strokes on a 3x5 grid, from a seed. */
function runeBit(seed: number, gx: number, gy: number): boolean {
  if (gx === 1) return hash2(seed, 0, 71) > 0.25 || gy === 2;
  const k = gy * 2 + (gx === 0 ? 0 : 1);
  return hash2(seed, k, 72) > 0.62;
}

/** The colosseum, lit: diffuse, normal map and glow, the size of the arena. */
export function* frostArenaArt(): Generator<void, FrostArenaArt, void> {
  const W = FROST_W;
  const H = FROST_H;
  const diffuse = new Uint8ClampedArray(W * H * 4);
  const normal = new Uint8ClampedArray(W * H * 4);
  const emissive = new Uint8ClampedArray(W * H * 4);
  // Which ground point each pixel shows, and how far down its face (0: its top).
  const gyOf = new Int16Array(W * H).fill(-1);
  const faceOf = new Int16Array(W * H);
  const zOf = new Int16Array(W * H);
  const kindOf = new Uint8Array(W * H);
  const tierOf = new Uint8Array(W * H);

  // Columns, from the front back: each ground point higher on the picture
  // than everything nearer fills the pixels down to them, its top then its face.
  const GY0 = H + 140;
  for (let x = 0; x < W; x++) {
    if (x % 16 === 0) yield;
    let ymin = H + 400;
    for (let gy = GY0; gy >= 0; gy--) {
      const h = heightAt(x + 0.5, gy + 0.5);
      const sy = Math.floor(gy - h.z);
      if (sy >= ymin) continue;
      if (h.kind !== K_NONE) {
        for (let py = Math.max(0, sy); py < Math.min(ymin, H); py++) {
          const i = py * W + x;
          gyOf[i] = gy;
          faceOf[i] = py - sy;
          zOf[i] = h.z;
          kindOf[i] = h.kind;
          tierOf[i] = h.tier;
        }
      }
      ymin = sy;
    }
  }

  const L = KEY_LIGHT;
  const Ll = Math.hypot(L.x, L.y, L.z);
  const shadeOf = (n: [number, number, number]) => {
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    return (n[0] * L.x + n[1] * L.y + n[2] * L.z) / (l * Ll);
  };
  const put = (i: number, c: RGB, n: [number, number, number], glow?: RGB, gk = 1) => {
    diffuse.set([c[0], c[1], c[2], 255], i * 4);
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    normal.set([Math.round((n[0] / l) * 127.5 + 127.5), Math.round((n[1] / l) * 127.5 + 127.5), Math.round((n[2] / l) * 127.5 + 127.5), 255], i * 4);
    if (glow) emissive.set([Math.round(glow[0] * gk), Math.round(glow[1] * gk), Math.round(glow[2] * gk), 255], i * 4);
  };
  const UP: [number, number, number] = [0, 0, 1];

  /** Snow lying over a top: its cover (0..1) at a point; more against the walls. */
  const snowCover = (x: number, y: number, extra: number) =>
    valueNoise(x * 0.5 + y * 0.35, y * 1.6, 24, 11) * 0.7 + valueNoise(x * 0.6, y * 1.4, 7, 12) * 0.3 + extra;
  /** Snow's colour and normal, with wind ripples and the odd glint. */
  const snowPx = (i: number, x: number, y: number, bright: number) => {
    const rip = Math.sin((x * 0.5 + y * 1.1) * 0.9 + valueNoise(x, y, 9, 13) * 5);
    const n: [number, number, number] = [rip * 0.12, 0.08, 1];
    let idx = 3.6 + bright + shadeOf(n) * 1.2 + rip * 0.35;
    if (hash2(x, y, 14) > 0.993) {
      put(i, SNOWR[6], n, C_WHITE, 0.5);
      return;
    }
    idx += (bayer(x, y) - 0.5) * 0.6;
    put(i, pick(SNOWR, idx), n);
  };

  for (let py = 0; py < H; py++) {
    if (py % 8 === 0) yield;
    for (let x = 0; x < W; x++) {
      const i = py * W + x;
      const gy = gyOf[i];
      if (gy < 0) continue;
      const kind = kindOf[i];
      const f = faceOf[i];
      const z = zOf[i];
      const X = x + 0.5;
      const Y = gy + 0.5;
      const u = (X - FROST_CX) / FROST_RX;
      const v = (Y - FROST_CY) / FROST_RY;
      const r = Math.hypot(u, v);
      const deg = Math.atan2(v, u) / RAD;
      const by = bayer(x, py);

      // ------------------------------------------------ Tops
      if (f === 0) {
        if (kind === K_LAKE) {
          // Clear black ice: depth in it, streaks of glassy light, cracks, a few bubbles, wisps of snow blown across.
          const n: [number, number, number] = [0, 0, 1];
          let idx = 2.6 + valueNoise(X, Y, 38, 5) * 2.2 + (1 - r / LAKE_K) * 0.8;
          // Something long and coiled sleeps far beneath: a shadow under the ice.
          const sx = X - FROST_CX;
          const along = Math.abs(sx) / 118;
          if (along < 1) {
            const cy = FROST_CY + 4 + 20 * Math.sin(sx * 0.036 + 0.6) * (1 - along * 0.4);
            const wdt = 8.5 * Math.sqrt(1 - along) + 1;
            const d = Math.abs(Y - cy) / wdt;
            if (d < 1) idx -= (1 - d * d) * 2.1 * (0.6 + 0.4 * by);
            if (d < 0.18 && hash2(Math.floor(X / 3), 0, 81) > 0.5) emissive.set([20, 70, 60, 255], i * 4);
          }
          if (Math.sin((X - Y * 1.6) * 0.11 + valueNoise(X, Y, 20, 6) * 3) > 0.95) idx += 2;
          const c = cells(X, Y, 30, 90);
          if (c.d2 - c.d1 < 0.9 && valueNoise(X, Y, 26, 91) > 0.42) {
            put(i, mix(LAKE[8], LAKE[9], c.id), n, C_ICE, 0.12);
            continue;
          }
          if (hash2(x, gy, 92) > 0.992) {
            put(i, LAKE[8], n, C_ICE, 0.25);
            continue;
          }
          // Wisps of snow on the ice, thicker toward its rim.
          const wisp = valueNoise(X * 0.3 + Y * 0.2, Y * 2.6, 16, 93) * 0.8 + valueNoise(X, Y, 4, 96) * 0.2 + Math.pow(r / LAKE_K, 3) * 0.22;
          if (wisp > 0.84 + by * 0.08) {
            put(i, pick(SNOWR, 3 + wisp), n);
            continue;
          }
          // The sky's lights mirrored in the ice.
          const refl = valueNoise(X, Y * 0.3, 16, 94);
          let glow: RGB | undefined;
          if (refl > 0.6) glow = mix(C_AURORA, C_VIOLET, valueNoise(X, 0, 60, 95));
          // The sigil at the heart: an eight-pointed star in a ring, inlaid with silver.
          const a = deg * RAD;
          if (r < 0.15) {
            const star = Math.abs(Math.cos(a * 4)) * 0.075 + 0.02;
            if (Math.abs(r - 0.135) < 0.008 || (r < star && r > star - 0.02) || (r < 0.03)) {
              put(i, SILVER[3], n, C_TEAL, 0.65);
              continue;
            }
          }
          put(i, pick(LAKE, idx + by * 0.8), n, glow, glow ? (refl - 0.6) * 0.5 : 1);
          continue;
        }
        if (kind === K_FLOOR) {
          // The rune ring round the lake: silver lines and glowing runes, cycling through the aurora's colours.
          if (r < 0.585) {
            const n = UP;
            // Measured in pixels across the band, so it is as fine at the sides as at the ends.
            const across = Math.hypot(FROST_RX * Math.cos(deg * RAD), FROST_RY * Math.sin(deg * RAD));
            const dIn = (r - LAKE_K) * across;
            const dOut = (0.585 - r) * across;
            if (dIn < 1.1 || (dOut > 0.9 && dOut < 2)) {
              put(i, SILVER[2], n, C_TEAL, 0.35);
              continue;
            }
            const sArc = deg * RAD * localR(deg) * 0.56;
            const cell = Math.floor(sArc / 7);
            const lx = Math.floor(sArc - cell * 7) - 2;
            const ly = Math.floor(dIn - (across * 0.085 - 5) / 2 - 0.5);
            const hue = 0.5 + 0.5 * Math.sin(deg * RAD * 2);
            if (lx >= 0 && lx < 3 && ly >= 0 && ly < 5 && runeBit(cell, lx, ly)) {
              put(i, mix(SILVER[3], C_AURORA, 0.3), n, hue > 0.5 ? mix(C_AURORA, C_TEAL, (hue - 0.5) * 2) : mix(C_VIOLET, C_AURORA, hue * 2), 0.95);
              continue;
            }
            const idx = 3.2 + valueNoise(X, Y, 8, 31) * 1.2;
            put(i, pick(FLAG, idx + by * 0.5), n);
            continue;
          }
          // Flagstones in courses round the lake, under drifts of snow; drifts deepest against the wall.
          const drift = r > 0.84 ? (r - 0.84) * 3.6 : 0;
          const cover = snowCover(X, Y, drift - 0.1);
          // The north wall's shadow falls across the floor at its foot.
          const nk = northK(deg);
          const fromWall = Y - northEdge(X);
          const shade = v < 0 && nk > 0 && fromWall < wallH(deg) * 0.42 + valueNoise(X, 0, 9, 17) * 3 ? -1.4 : 0;
          if (cover > 0.62 + by * 0.12) {
            snowPx(i, x, gy, shade * 0.9 + (cover - 0.7) * 1.5);
            continue;
          }
          const d = (1 - r) * 170;
          const course = Math.floor(d / 11);
          const len = 15 + Math.floor(hash2(course, 0, 33) * 9);
          const sArc = deg * RAD * r * 210 + hash2(course, 1, 34) * len;
          const stone = Math.floor(sArc / len);
          const inS = sArc - stone * len;
          const inD = d - course * 11;
          if (inS < 1 || inD < 1) {
            // Snow packed into the joints wherever any lies near.
            put(i, cover > 0.42 ? pick(SNOWR, 2.4 + shade * 0.6 + by) : MORTAR, UP);
            continue;
          }
          const id = hash2(course, stone, 35);
          // A bevel: the stone's far and west edges catch the light, its near and east edges fall away.
          const bevel: [number, number, number] = inD > 9.4 ? [0, 0.5, 0.8] : inS < 2.2 ? [-0.5, 0, 0.8] : inS > len - 1.4 ? [0.5, 0, 0.8] : inD < 2.2 ? [0, -0.5, 0.8] : [0, 0, 1];
          let idx = 3.1 + (id - 0.5) * 1.6 + (valueNoise(X, Y, 5, 36) - 0.5) * 0.9 + (shadeOf(bevel) - 0.74) * 3 + shade;
          // A crack across the odd stone, and frost in the corners.
          if (id > 0.82 && Math.abs((inS - len / 2) - (inD - 5.5) * (id > 0.91 ? 1.2 : -0.9)) < 0.6) idx = 0.6;
          // A dusting at the edges of the drifts.
          if (cover > 0.52 && hash2(x, gy, 37) < (cover - 0.52) * 6) {
            put(i, pick(SNOWR, 2.6 + shade * 0.6 + by), bevel);
            continue;
          }
          put(i, pick(FLAG, idx + by * 0.6), bevel);
          continue;
        }
        if (kind === K_WALK || kind === K_COPING || kind === K_CROWN || kind === K_MERLON || kind === K_POST) {
          // The tops of walls, coping and crown: snow lying thick, edges of stone showing.
          const cover = snowCover(X, Y, kind === K_COPING || kind === K_MERLON || kind === K_POST ? 0.35 : 0.12);
          if (cover > 0.48 + by * 0.1) {
            snowPx(i, x, gy, kind === K_COPING ? 0.8 : 0.4);
            continue;
          }
          put(i, pick(WALLSTONE, 4.4 + valueNoise(X, Y, 4, 41) * 1.4 + by * 0.5), UP);
          continue;
        }
        if (kind === K_STAND) {
          // Stone seats under snow, their front lips bare.
          const nk = standsK(deg);
          const q = (r - 1 - WALL_K) / (STANDS_K * nk);
          const inTier = q / TIER_Q - tierOf[i];
          if (inTier < 0.22) {
            put(i, pick(WALLSTONE, 5 + by * 0.6), [0, -0.3, 0.9]);
            continue;
          }
          const cover = snowCover(X, Y, 0.2);
          if (cover > 0.5 + by * 0.1) {
            snowPx(i, x, gy, 0.2);
            continue;
          }
          put(i, pick(WALLSTONE, 4 + valueNoise(X, Y, 4, 42) + by * 0.5), UP);
          continue;
        }
        if (kind === K_STAIR) {
          // Stair treads, worn, snow lying at their backs.
          const step = ((r - 1) / WALL_K) * STAIR_STEPS;
          const back = step - Math.floor(step) < 0.35;
          if (back && valueNoise(X, Y, 3, 43) > 0.35) {
            snowPx(i, x, gy, 0);
            continue;
          }
          put(i, pick(WALLSTONE, 4.6 + valueNoise(X, Y, 3, 44) + by * 0.5), UP);
          continue;
        }
        continue;
      }

      // ------------------------------------------------ Faces
      const zf = z - f + 0.5;
      // Facing in toward the floor (the north wall and the stands), or out (the south parapet and below).
      const inward = v < 0;
      const nIn: [number, number, number] = [(-u / (r || 1)) * 0.9, (v / (r || 1)) * 0.9, 0.32];
      const nOut: [number, number, number] = [(u / (r || 1)) * 0.9, (-v / (r || 1)) * 0.9, 0.32];
      const sAbs = deg * RAD * 214;

      if (kind === K_LAKE || kind === K_FLOOR) {
        // The lake's bank: a lip of ice.
        put(i, LAKE[9], nIn, C_ICE, 0.2);
        continue;
      }
      if ((kind === K_COPING || kind === K_POST) && inward) {
        // The north wall's inner face: courses of blocks, a frieze of runes, three arches, banners, icicles under the coping, snow at its foot.
        const H0 = wallH(deg);
        const nk = northK(deg);
        // The arches.
        let arch: ReturnType<typeof archAt> | null = null;
        let gate: Gate | null = null;
        for (const g of ARCHES) {
          const a = archAt(g, X, zf);
          if (a.part) {
            arch = a;
            gate = g;
            break;
          }
        }
        if (arch && gate && arch.part === 2) {
          // Inside: a tunnel running back into the dark, its walls catching a little light, cold light far within.
          const depthK = 1 - Math.abs(arch.sp) / arch.hw;
          const inner = Math.abs(arch.sp) < arch.hw * 0.56 && zf < arch.top * 0.74;
          if (zf < 2.5 && hash2(x, py, 45) > 0.3 - depthK * 0.2) {
            snowPx(i, x, py, -1.6);
            continue;
          }
          if (inner) {
            // The far end: dark, a cold light lying along the tunnel's floor.
            const low = clamp01(1 - (zf - 2) / 7) * (1 - Math.abs(arch.sp) / (arch.hw * 0.56));
            const q = Math.floor(low * 3 + by) / 3;
            put(i, mix(hex('#03060e'), hex('#1c4064'), q), [0, 0, 1], C_ICE, q * 0.4);
            continue;
          }
          const lit = arch.sp > 0;
          put(i, pick(WALLSTONE, (lit ? 2.2 : 0.8) + depthK * 0.6 + by * 0.6), lit ? [-0.8, 0, 0.5] : [0.8, 0, 0.5]);
          continue;
        }
        if (arch && gate && arch.part === 1) {
          // The arch's ring of stones (voussoirs), a glowing keystone on the Great Gate.
          const ang = Math.atan2(zf - (archSize(gate).h - arch.hw * 0.72), arch.sp);
          const joint = Math.abs(((ang / Math.PI) * (gate.great ? 13 : 9)) % 1) < 0.12;
          if (gate.great && Math.abs(arch.sp) < 2.6 && zf > archSize(gate).h - 2) {
            put(i, SILVER[3], nIn, C_AURORA, 0.95);
            continue;
          }
          put(i, joint ? MORTAR : pick(WALLSTONE, 5 + (hash2(Math.floor(ang * 9), 0, 46) - 0.5) + by * 0.5), nIn);
          continue;
        }
        // The coping: a band of paler stone along the top.
        if (zf > H0 - 1.5) {
          put(i, pick(WALLSTONE, 5.6 + by * 0.6), [nIn[0], nIn[1] * 0.6, 0.7]);
          continue;
        }
        // Banners hanging from under the coping.
        let banner = false;
        for (const b of BANNERS) {
          const sp = angDiff(deg, b) * RAD * localR(b);
          if (Math.abs(sp) > 5.5) continue;
          const len = H0 * 0.48;
          const bottom = H0 - 2 - len + 4 * (1 - Math.abs(sp) / 5.5);
          if (zf < bottom || zf > H0 - 1.5) continue;
          banner = true;
          if (zf > H0 - 3) {
            put(i, pick(IRON.ramp, 4 + by), nIn);
            break;
          }
          if (Math.abs(sp) > 4.5) {
            put(i, SILVER[2], nIn);
            break;
          }
          // The emblem: a snowflake of six arms, glinting.
          const ez = zf - (H0 - 3 - len * 0.42);
          const ea = Math.atan2(ez, sp);
          const er = Math.hypot(sp, ez);
          if (er < 3.6 && (Math.abs(((ea / (Math.PI / 3)) % 1 + 1) % 1 - 0.5) > 0.36 || er < 1)) {
            put(i, SILVER[3], nIn, C_ICE, 0.35);
            break;
          }
          const fold = Math.sin(sp * 1.25 + 0.6);
          put(i, pick(BANNER, 2.4 + fold * 1.4 + by * 0.6 - (zf < bottom + 3 ? 0.8 : 0)), [fold * 0.5, nIn[1], 0.6]);
          break;
        }
        if (banner) continue;
        // Icicles hanging under the coping.
        const col = Math.round(sAbs);
        const ic = hash2(col, 0, 47);
        const icLen = ic > 0.5 ? Math.pow((ic - 0.5) * 2, 2) * (6 + nk * 9) : 0;
        if (zf > H0 - 1.5 - icLen) {
          put(i, pick(ICE.ramp, 5 - (H0 - zf) / (icLen + 1) * 2 + by * 0.6), nIn, C_ICE, 0.12);
          continue;
        }
        // Snow drifted against its foot.
        const drift = 2 + 6 * Math.pow(valueNoise(sAbs, 0, 13, 48), 1.4);
        if (zf < drift) {
          snowPx(i, x, py, -0.4 - (drift - zf) * 0.1);
          continue;
        }
        // The frieze of runes, across the full height of the wall.
        const fz = H0 * 0.6;
        if (nk > 0.75 && Math.abs(zf - fz) < 3.5) {
          const edge = Math.abs(zf - fz) > 2.6;
          const cell = Math.floor(sAbs / 6);
          const lx = Math.floor(sAbs - cell * 6) - 1;
          const ly = Math.floor(zf - (fz - 2.5));
          if (!edge && lx >= 0 && lx < 3 && ly >= 0 && ly < 5 && runeBit(cell + 500, lx, 4 - ly)) {
            put(i, mix(WALLSTONE[6], C_TEAL, 0.4), nIn, mix(C_AURORA, C_TEAL, hash2(cell, 0, 49)), 0.55);
            continue;
          }
          put(i, pick(WALLSTONE, (edge ? 2 : 4.4) + by * 0.5), nIn);
          continue;
        }
        // Courses of ashlar, the joints staggered, streaked by melt and frost.
        const course = Math.floor(zf / 7);
        const off = course % 2 ? 7 : 0;
        const inB = (sAbs + off) % 14;
        if (zf - course * 7 < 1 || inB < 1 || inB > 13.6) {
          put(i, MORTAR, nIn);
          continue;
        }
        const id = hash2(Math.floor((sAbs + off) / 14), course, 50);
        let idx = 3.1 + (id - 0.5) * 1.3 + (shadeOf(nIn) + 0.2) * 1.5 + (zf / H0) * 0.8;
        if (valueNoise(sAbs * 3, zf * 0.15, 4, 51) > 0.7) idx -= 0.8;
        if (zf - course * 7 > 5.6) idx += 0.7;
        put(i, pick(WALLSTONE, idx + by * 0.6), nIn);
        continue;
      }
      // Below a riser's foot, or the crown's: the colosseum's outside, seen round its flanks.
      const standsZ = kind === K_STAND || kind === K_CROWN || kind === K_MERLON ? standBase(deg, kind === K_STAND ? tierOf[i] : TIERS) : 0;
      const exterior = (kind === K_STAND || kind === K_CROWN || kind === K_MERLON) && zf < standsZ - 0.5;
      if ((kind === K_STAND || kind === K_CROWN || kind === K_MERLON) && !exterior) {
        // Risers of the stands, and the crown's face with its niches.
        const nk = standsK(deg);
        const H0 = wallH(deg);
        const SH = STANDS_H * nk;
        if (kind === K_STAND) {
          const t = tierOf[i];
          const floorZ = t === 0 ? H0 : Math.round(H0 + t * TIER_RISE * SH);
          const up = zf - floorZ;
          // A ghost of the old crowd, still sitting where they sat: pale shoulders and a hood, two cold eyes.
          const slot = Math.floor(sAbs / 7);
          const sx = sAbs - slot * 7 - 3.5;
          if (hash2(slot, t, 52) > 0.8 && up < 9) {
            const w = up < 5 ? 2.6 - up * 0.1 : up < 8.5 ? 1.7 : 0;
            if (Math.abs(sx) < w) {
              const eye = Math.abs(up - 6.5) < 0.6 && Math.abs(Math.abs(sx) - 0.7) < 0.5;
              const base = pick(WALLSTONE, 3);
              put(i, eye ? hex('#dff6ff') : mix(base, GHOST, 0.5 + (up / 9) * 0.15), nIn, eye ? C_ICE : GHOST, eye ? 0.9 : 0.14);
              continue;
            }
          }
          // Icicles off each tread's lip.
          const ic = hash2(Math.round(sAbs), t, 53);
          const zTop = z;
          if (ic > 0.7 && zTop - zf < (ic - 0.7) * 14) {
            put(i, pick(ICE.ramp, 4.6 + by), nIn, C_ICE, 0.1);
            continue;
          }
          const course = Math.floor(up / 5);
          const inB = (sAbs + (course % 2) * 5) % 10;
          if (up - course * 5 < 0.8 || inB < 0.8) {
            put(i, MORTAR, nIn);
            continue;
          }
          put(i, pick(WALLSTONE, 2.7 + hash2(Math.floor(sAbs / 10), course + t * 9, 54) * 1.2 + (up / (TIER_RISE * SH)) * 0.8 + by * 0.6), nIn);
          continue;
        }
        // The crown: a tall face with dark arched niches, a cold light in each.
        const crownBase = Math.round(H0 + TIERS * TIER_RISE * SH);
        const up = zf - crownBase;
        const niche = Math.floor(sAbs / 16);
        const nx = sAbs - niche * 16 - 8;
        const top = SH * (1 - TIERS * TIER_RISE);
        if (kind !== K_MERLON && top > 12 && Math.abs(nx) < 2.6 && up > 3 && up < top - 4 + Math.sqrt(Math.max(0, 6.8 - nx * nx)) - 2.6) {
          const lit = up < 5;
          put(i, lit ? hex('#16304e') : hex('#03060e'), [0, 0, 1], C_ICE, lit ? 0.35 : 0.06);
          continue;
        }
        const course = Math.floor(up / 6);
        const inB = (sAbs + (course % 2) * 6) % 12;
        if (up - course * 6 < 0.8 || inB < 0.8) {
          put(i, MORTAR, nIn);
          continue;
        }
        put(i, pick(WALLSTONE, 2.9 + hash2(Math.floor(sAbs / 12), course, 55) * 1.2 + (kind === K_MERLON ? 1.4 : 0) + by * 0.6), nIn);
        continue;
      }
      if (kind === K_STAIR && zf > z - STAIR_STEP) {
        // A step's riser, its lip catching the light.
        put(i, pick(WALLSTONE, (f === 1 ? 4.2 : 2) + by * 0.5), nOut);
        continue;
      }
      // The south: the parapet's outer face, the great masonry under it, the crag under that.
      const H0 = exterior ? z : wallH(deg);
      const st = exterior ? null : stairAt(deg);
      if (zf >= 0 && exterior && H0 > 22) {
        // The outer wall behind the stands: storeys of arcades, a cornice between them, snow on every sill.
        const storey = Math.floor(zf / 24);
        const up = zf - storey * 24;
        const bay = ((sAbs % 16) + 16) % 16 - 8;
        if (zf > H0 - 3) {
          put(i, pick(WALLSTONE, 4.6 + by * 0.6), nOut);
          continue;
        }
        if (up < 2.2) {
          put(i, up > 1.2 ? pick(SNOWR, 3.4 + by) : pick(WALLSTONE, 4.2), up > 1.2 ? UP : nOut);
          continue;
        }
        const archTop = 15 + Math.sqrt(Math.max(0, 16 - bay * bay)) * 0.9;
        if (Math.abs(bay) < 4 && up > 3 && up < archTop && zf < H0 - 6) {
          put(i, up < 4.2 ? pick(SNOWR, 2 + by) : hex('#04070f'), up < 4.2 ? UP : [0, 0, 1]);
          continue;
        }
        const inB = (sAbs + (Math.floor(up / 6) % 2) * 5) % 10;
        put(i, inB < 0.8 || up % 6 < 0.8 ? MORTAR : pick(WALLSTONE, 2.4 + (shadeOf(nOut) + 0.3) * 1.6 + (Math.abs(bay) > 6 ? 0.6 : 0) + by * 0.6), nOut);
        continue;
      }
      if (zf >= 0) {
        // The parapet: big blocks, icicles off its coping.
        const ic = hash2(Math.round(sAbs), 1, 56);
        if (ic > 0.55 && zf > H0 - 0.5 - (ic - 0.55) * 14) {
          put(i, pick(ICE.ramp, 4.4 + by), nOut, C_ICE, 0.1);
          continue;
        }
        if (zf > H0 - 1.6) {
          put(i, pick(WALLSTONE, 5.2 + by * 0.5), nOut);
          continue;
        }
        const inB = (sAbs + 3) % 11;
        put(i, inB < 0.9 ? MORTAR : pick(WALLSTONE, 3 + (shadeOf(nOut) + 0.3) * 1.4 + hash2(Math.floor((sAbs + 3) / 11), 0, 57) + by * 0.6), nOut);
        continue;
      }
      const below = -zf;
      const drop = dropAt(x);
      const masonry = 26 + 10 * valueNoise(X, 0, 31, 58);
      // The crag fades into the cloud below, stairs and all.
      const fade = (below - masonry) / Math.max(1, drop - masonry);
      if (fade > 0.55 && fade - 0.55 > by * 0.45 * (0.6 + 0.4 * valueNoise(X, below, 6, 61))) continue;
      // Below the stairs through the parapet, the flight runs on down the masonry and the crag into the cloud.
      if (st && st.t < 1.3) {
        if (st.t > 1) {
          // Its walls, a lip of snow along their tops.
          const left = angDiff(deg, st.g.deg) > 0;
          put(i, pick(WALLSTONE, (left ? 4.2 : 2.6) - fade * 1.5 + by * 0.6), left ? [-0.7, -0.2, 0.6] : [0.7, -0.2, 0.6]);
          continue;
        }
        const step = below % 5;
        if (step < 2) {
          put(i, step < 1 && hash2(x, Math.floor(below / 5), 66) > 0.25 ? pick(SNOWR, 3.4 - fade * 2 + by) : pick(WALLSTONE, 5 - fade * 2 + by * 0.5), UP);
          continue;
        }
        put(i, pick(WALLSTONE, 2.6 - fade * 1.6 + (step < 2.6 ? 0.8 : 0) + by * 0.6), nOut);
        continue;
      }
      if (below < masonry) {
        // Great blocks and buttresses between arched bays, crusted with rime.
        const bay = ((sAbs % 46) + 46) % 46 - 23;
        const buttress = Math.abs(bay) > 17;
        const archTop = 12 + Math.sqrt(Math.max(0, 16 * 16 - bay * bay)) * 0.5;
        if (!buttress && below > archTop && below < masonry - 2) {
          put(i, pick(WALLSTONE, 0.4 + by * 0.7), nOut);
          continue;
        }
        const course = Math.floor(below / 8);
        const inB = (sAbs + (course % 2) * 9) % 18;
        if (below - course * 8 < 1 || inB < 1) {
          put(i, MORTAR, nOut);
          continue;
        }
        let idx = 2.6 + (buttress ? 0.9 : 0) - below / masonry * 1.1 + hash2(Math.floor((sAbs + (course % 2) * 9) / 18), course, 59) * 1.1;
        if (valueNoise(sAbs, below * 2, 5, 60) > 0.72) {
          put(i, pick(RIME.ramp, 1.6 + by), nOut);
          continue;
        }
        put(i, pick(WALLSTONE, idx + by * 0.6), nOut);
        continue;
      }
      // The crag: rock fractured into facets, each turned its own way to the moon, snow on their upper edges.
      const cl = cells(X, below * 1.25, 11, 62);
      const fa = cl.id * Math.PI * 2;
      const n: [number, number, number] = [nOut[0] * 0.5 + Math.cos(fa) * 0.6, nOut[1] * 0.5 + Math.sin(fa) * 0.35, 0.55];
      if (cl.d2 - cl.d1 < 0.8) {
        put(i, ROCK[0], nOut);
        continue;
      }
      const above = cells(X, (below - 2) * 1.25, 11, 62);
      if (above.id !== cl.id && cl.id > 0.3 && fade < 0.7) {
        put(i, pick(SNOWR, 2.8 - fade * 2 + by), UP);
        continue;
      }
      if (cl.id > 0.93 && cl.d1 < 3) {
        put(i, pick(ICE.ramp, 3.6 + by), n, C_ICE, 0.15 * (1 - fade));
        continue;
      }
      put(i, pick(ROCK, 3.2 + (shadeOf(n) - 0.2) * 2.4 - fade * 2 + by * 0.6), n);
    }
  }
  return { diffuse, normal, emissive };
}

// ---------------------------------------------------------------- The light in the arches

/** Where an arch's light goes: the box round its opening and the spill before it. */
export function archGlowBox(g: Gate): { x: number; y: number; w: number; h: number } {
  const { w: aw, h: ah } = archSize(g);
  const x0 = Math.floor(g.x - aw / 2 - 2);
  const x1 = Math.ceil(g.x + aw / 2 + 2);
  const yTop = Math.floor(Math.min(northEdge(x0), northEdge(x1), northEdge(g.x)) - ah - 2);
  const yBot = Math.ceil(Math.max(northEdge(x0), northEdge(x1), northEdge(g.x)) + 6);
  return { x: x0, y: yTop, w: x1 - x0, h: yBot - yTop };
}

/** An arch's opening as pure light: where its glow image goes, and its pixels (brightest at its foot, deep in the tunnel). */
export function archGlowArt(g: Gate): { x: number; y: number; w: number; h: number; px: Uint8ClampedArray } {
  const { x: x0, y: yTop, w, h } = archGlowBox(g);
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const X = x0 + x + 0.5;
      const zf = northEdge(X) - (yTop + y + 0.5);
      let k = 0;
      if (zf >= 0) {
        const a = archAt(g, X, zf);
        if (a.part === 2) {
          const inner = Math.abs(a.sp) < a.hw * 0.56 && zf < a.top * 0.74;
          k = inner ? 0.45 + 0.55 * (1 - zf / (a.top * 0.74)) : 0.18 * (1 - Math.abs(a.sp) / a.hw) + 0.12 * (1 - zf / a.top);
        }
      } else if (zf > -6) {
        // A spill of light on the snow before it.
        const a = archAt(g, X, 0);
        if (a.part === 2) k = (1 + zf / 6) * 0.45 * (1 - Math.abs(a.sp) / a.hw);
      }
      if (k <= 0) continue;
      const q = Math.floor(Math.min(1, k) * 5 + bayer(x, y)) / 5;
      if (q <= 0) continue;
      const c = mix(C_ICE, C_WHITE, q * 0.5);
      px.set([c[0] * q, c[1] * q, c[2] * q, 255], (y * w + x) * 4);
    }
  }
  return { x: x0, y: yTop, w, h, px };
}

// ---------------------------------------------------------------- Aurora ribbons

export const AURORA_W = 400;
export const AURORA_H = 96;

/**
 * One curtain of the northern lights as pure light, seamless side to side
 * (the arena scrolls a few of these over its sky, each at its own pace):
 * its hem bright and green, rays climbing into teal and violet.
 */
export function auroraRibbon(seed: number): Uint8ClampedArray {
  const W = AURORA_W;
  const H = AURORA_H;
  const px = new Uint8ClampedArray(W * H * 4);
  const TAU = Math.PI * 2;
  for (let x = 0; x < W; x++) {
    const t = x / W;
    // Whole waves round the strip, so it wraps.
    const hem = H - 18 + 9 * Math.sin(TAU * t * 2 + seed) + 5 * Math.sin(TAU * t * 5 + seed * 2.3);
    let rays = 0;
    for (let k = 1; k <= 4; k++) rays += Math.sin(TAU * t * (11 * k + Math.round(seed * 3)) + seed * k * 1.7) / k;
    const ray = clamp01(0.55 + rays * 0.35);
    const band = 0.6 + 0.4 * Math.sin(TAU * t * 3 + seed * 0.7);
    for (let y = 0; y < H; y++) {
      const d = hem - y;
      if (d < -3) continue;
      const i = (d < 0 ? (1 + d / 3) * 0.9 : Math.exp(-d / 30) * (d < 2 ? 1.3 : 1)) * ray * band;
      const q = Math.floor(Math.min(1, i) * 6 + bayer(x, y)) / 6;
      if (q <= 0) continue;
      const tt = clamp01(d / 52);
      const c = d < 0 ? mix(C_PINK, C_AURORA, 0.6) : tt < 0.45 ? mix(C_AURORA, C_TEAL, tt / 0.45) : mix(C_TEAL, C_VIOLET, (tt - 0.45) / 0.55);
      px.set([c[0] * q, c[1] * q, c[2] * q, 255], (y * W + x) * 4);
    }
  }
  return px;
}

// ---------------------------------------------------------------- The frozen champions

export const STATUE_W = 36;
export const STATUE_H = 64;
/** The statue's foot (its plinth's middle) in its frame. */
export const STATUE_OY = 58;

const PLINTH: Material = { ramp: WALLSTONE, outline: hex('#04060c'), outlineLit: hex('#1a2436') };
const PLINTH_DARK: Material = { ramp: WALLSTONE.slice(0, 5), outline: hex('#04060c') };
/** Carved ice, clearer than a creature's: champions sculpted by the winter itself. */
const SCULPT: Material = { ramp: ramp('#10264a', '#1a3e6e', '#2a5c94', '#4282bc', '#6aaede', '#a6daf6', '#e6f8ff'), outline: hex('#071630'), outlineLit: hex('#2a5888'), emissive: 0.18, shine: true };

/**
 * A champion of an old age, frozen where they stood and left on a plinth
 * round the lake: a knight on his sword, a spear-maiden winged, an archer
 * with bow lowered, a mage on her staff. All clear ice, eyes still lit.
 */
export function frostStatue(v: number): PixelCanvas {
  const c = new PixelCanvas(STATUE_W, STATUE_H);
  const cx = 18;
  const top = 46;
  // The plinth: a squat block with a moulded top and foot, a rune lit on its face.
  c.part();
  c.shape(top + 2, STATUE_OY + 1, (y) => [cx - 13 + (y > STATUE_OY - 2 ? -1 : 0), cx + 13 + (y > STATUE_OY - 2 ? 1 : 0)], PLINTH, (_x, _y, t) => ({ x: t * 0.5, y: -0.3, z: 0.8 }));
  c.ellipse(cx, top + 2, 14, 4.2, PLINTH, { normal: () => ({ x: 0, y: 0.3, z: 1 }) });
  c.part();
  for (let x = cx - 12; x <= cx + 12; x++) if ((x * 7) % 5 < 3) c.px(x, top + 1 + ((x * 3) % 2), SNOW, { x: 0, y: 0.2, z: 1 });
  icicles(c, cx - 12, cx + 12, top + 6, 4, v + 3, ICE);
  c.part();
  const rx = cx;
  const ry = top + 9;
  for (const [dx, dy] of [[0, 0], [0, 1], [0, 2], [0, 3], [-1, 1], [1, 2], [-1, 3], [1, 0]] as [number, number][]) c.px(rx + dx, ry + dy, GLOW_AURORA);
  for (let x = cx - 12; x <= cx + 12; x++) c.px(x, STATUE_OY - 3, PLINTH_DARK, { x: 0, y: -0.6, z: 0.6 });

  // The figure, carved in ice, about a head taller than a hero.
  c.part();
  const foot = top + 1;
  const n = (t: number) => cyl(t, 0.1);
  if (v === 0) {
    // A knight, both hands on the pommel of a greatsword planted before him, a round shield on his back.
    c.ellipse(cx + 5, foot - 22, 7, 8, SCULPT);
    c.part();
    c.capsule(cx - 3, foot - 1, cx - 3, foot - 12, 2.6, 2.8, SCULPT);
    c.capsule(cx + 3, foot - 1, cx + 3, foot - 12, 2.6, 2.8, SCULPT);
    c.shape(foot - 26, foot - 12, (y) => { const k = (y - (foot - 26)) / 14; return [cx - 6 + k * 1.2, cx + 6 - k * 1.2]; }, SCULPT, (_x, _y, t) => n(t));
    c.shape(foot - 14, foot - 7, (y) => { const k = (y - (foot - 14)) / 7; return [cx - 5 - k * 2, cx + 5 + k * 2]; }, SCULPT, (_x, _y, t) => n(t));
    c.ellipse(cx - 6, foot - 24, 3.4, 3, SCULPT);
    c.ellipse(cx + 6, foot - 24, 3.4, 3, SCULPT);
    c.part();
    c.ellipse(cx, foot - 30, 4.2, 4.6, SCULPT);
    c.shape(foot - 35, foot - 30, (y) => [cx - 4.4 + (y < foot - 33 ? 1 : 0), cx + 4.4 - (y < foot - 33 ? 1 : 0)], SCULPT, (_x, _y, t) => n(t));
    c.px(cx - 4, foot - 37, SCULPT);
    c.px(cx + 4, foot - 37, SCULPT);
    c.px(cx - 4, foot - 38, SCULPT);
    c.px(cx + 4, foot - 38, SCULPT);
    c.part();
    c.line(cx, foot - 2, cx, foot - 17, ICE_GLOW, () => ({ x: -0.4, y: 0, z: 0.9 }));
    c.line(cx + 1, foot - 3, cx + 1, foot - 16, SCULPT, () => ({ x: 0.5, y: 0, z: 0.8 }));
    c.line(cx - 4, foot - 17, cx + 4, foot - 17, SCULPT);
    c.capsule(cx - 5, foot - 23, cx - 1, foot - 18, 1.6, 1.6, SCULPT);
    c.capsule(cx + 5, foot - 23, cx + 1, foot - 18, 1.6, 1.6, SCULPT);
    c.ellipse(cx, foot - 19, 1.6, 1.4, SCULPT);
    c.part();
    c.px(cx - 2, foot - 31, GLOW_ICE);
    c.px(cx + 1, foot - 31, GLOW_ICE);
    c.line(cx - 3, foot - 32, cx + 3, foot - 32, ICE_DARK);
  } else if (v === 1) {
    // A spear-maiden: wings half spread, spear upright in her right hand, a winged helm.
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) c.capsule(cx + s * 5, foot - 26, cx + s * (9 + k * 1.3), foot - 30 + k * 3 - (k < 2 ? 4 : 0), 1.6, 1.2, SCULPT);
    }
    c.part();
    c.capsule(cx - 2, foot - 1, cx - 2, foot - 11, 2.2, 2.6, SCULPT);
    c.capsule(cx + 2, foot - 1, cx + 3, foot - 11, 2.2, 2.6, SCULPT);
    c.shape(foot - 16, foot - 5, (y) => { const k = (y - (foot - 16)) / 11; return [cx - 4 - k * 3, cx + 4 + k * 3]; }, SCULPT, (_x, _y, t) => n(t));
    c.shape(foot - 26, foot - 15, (y) => { const k = (y - (foot - 26)) / 11; return [cx - 4.6 + k, cx + 4.6 - k]; }, SCULPT, (_x, _y, t) => n(t));
    c.part();
    c.ellipse(cx, foot - 29, 3.6, 4, SCULPT);
    c.capsule(cx - 3, foot - 28, cx - 4, foot - 18, 1.4, 1, SCULPT);
    c.part();
    for (const s of [-1, 1]) c.line(cx + s * 3, foot - 31, cx + s * 6, foot - 34, SCULPT);
    c.px(cx - 1, foot - 29, GLOW_ICE);
    c.px(cx + 2, foot - 29, GLOW_ICE);
    c.line(cx + 7, foot - 1, cx + 7, foot - 44, SCULPT, () => ({ x: 0.4, y: 0, z: 0.9 }));
    crystal(c, cx + 7, foot - 43, cx + 7, foot - 51, 2, ICE_GLOW);
    c.capsule(cx + 4, foot - 24, cx + 7, foot - 20, 1.4, 1.3, SCULPT);
  } else if (v === 2) {
    // An archer, hooded and cloaked, bow lowered in the left hand, an arrow nocked and at rest.
    c.shape(foot - 27, foot - 1, (y) => { const k = (y - (foot - 27)) / 26; return [cx - 4 - k * 4.5, cx + 4 + k * 4.5]; }, SCULPT, (_x, _y, t) => n(t * 0.8));
    c.part();
    for (let y = foot - 22; y < foot; y += 4) c.line(cx - 2 - (y - foot + 22) * 0.12, y, cx - 1, y + 3, ICE_DARK);
    c.ellipse(cx, foot - 29, 4, 4.4, SCULPT);
    c.shape(foot - 34, foot - 27, (y) => { const k = (y - (foot - 34)) / 7; return [cx - 1 - k * 4.6, cx + 2 + k * 3.6]; }, SCULPT, (_x, _y, t) => n(t));
    c.part();
    c.px(cx - 1, foot - 28, GLOW_ICE);
    c.px(cx + 2, foot - 28, GLOW_ICE);
    // The bow: a long curve held low on her left.
    for (let k = 0; k <= 22; k++) {
      const a = (k / 22) * Math.PI;
      c.px(cx - 9 - Math.sin(a) * 3.5, foot - 26 + k, SCULPT, { x: -0.6, y: 0, z: 0.8 });
    }
    c.line(cx - 9, foot - 26, cx - 9, foot - 4, ICE_GLOW);
    c.capsule(cx - 3, foot - 20, cx - 9, foot - 15, 1.4, 1.2, SCULPT);
    c.line(cx - 9, foot - 15, cx + 2, foot - 9, SCULPT);
    crystal(c, cx + 2, foot - 9, cx + 5, foot - 7, 1.2, ICE_GLOW, null);
    // The quiver over her shoulder.
    c.line(cx + 5, foot - 30, cx + 3, foot - 20, SCULPT);
    c.line(cx + 6, foot - 30, cx + 6, foot - 32, ICE_GLOW);
  } else {
    // A mage, robed, both hands on a tall staff crowned with a crystal, her hood up.
    c.shape(foot - 26, foot - 1, (y) => { const k = (y - (foot - 26)) / 25; return [cx - 4 - k * 5.5, cx + 4 + k * 5.5]; }, SCULPT, (_x, _y, t) => n(t * 0.85));
    c.part();
    for (let k = 0; k < 4; k++) c.line(cx - 6 + k * 4, foot - 2, cx - 4 + k * 3, foot - 16, ICE_DARK);
    c.ellipse(cx, foot - 29, 4, 4.4, SCULPT);
    c.shape(foot - 36, foot - 27, (y) => { const k = (y - (foot - 36)) / 9; return [cx - 1 - k * 4.6, cx + 1 + k * 4.6]; }, SCULPT, (_x, _y, t) => n(t));
    c.part();
    c.line(cx - 2, foot - 28, cx + 2, foot - 28, ICE_DARK);
    c.px(cx - 1, foot - 28, GLOW_ICE);
    c.px(cx + 1, foot - 28, GLOW_ICE);
    c.line(cx + 6, foot - 1, cx + 6, foot - 40, SCULPT, () => ({ x: 0.5, y: 0, z: 0.8 }));
    c.capsule(cx + 1, foot - 21, cx + 6, foot - 22, 1.6, 1.4, SCULPT);
    c.capsule(cx - 1, foot - 17, cx + 6, foot - 17, 1.6, 1.4, SCULPT);
    c.part();
    crystal(c, cx + 6, foot - 39, cx + 6, foot - 48, 2.6, ICE_GLOW);
    crystal(c, cx + 6, foot - 40, cx + 9, foot - 45, 1.4, ICE);
    crystal(c, cx + 6, foot - 40, cx + 3, foot - 45, 1.4, ICE);
  }
  // Snow settled on the shoulders and head, a glint on each.
  c.part();
  for (let x = 0; x < STATUE_W; x++) {
    for (let y = 1; y < top - 1; y++) {
      if (c.filled(x, y) && !c.filled(x, y - 1) && c.materialAt(x, y) === SCULPT && hash2(x, y, v + 70) > 0.45) {
        c.px(x, y, SNOW, { x: 0, y: 0.4, z: 1 });
        if (hash2(x, y, v + 71) > 0.85) c.spark(x, y, C_WHITE, 0.6);
      }
    }
  }
  return c;
}

// ---------------------------------------------------------------- Braziers

export const BRAZIER_W = 20;
export const BRAZIER_H = 38;
export const BRAZIER_OY = 35;
export const BRAZIER_FRAMES = 6;

const FLAME: Material = { ramp: ramp('#1a6ad8', '#3ab0ff', '#9ae8ff', '#e8fbff', '#ffffff'), outline: hex('#0a2a60'), emissive: 1, noAO: true, noOutline: true };

/** A brazier of frost-iron on the wall: a stone foot, a tripod bowl, and a fire burning cold and blue. Frame `f` of its flicker. */
export function frostBrazier(f: number): PixelCanvas {
  const c = new PixelCanvas(BRAZIER_W, BRAZIER_H);
  const cx = 10;
  c.part();
  c.shape(BRAZIER_OY - 4, BRAZIER_OY, () => [cx - 5, cx + 5], PLINTH, (_x, _y, t) => ({ x: t * 0.5, y: -0.2, z: 0.8 }));
  c.ellipse(cx, BRAZIER_OY - 4, 5.4, 1.8, PLINTH);
  c.part();
  c.line(cx - 4, BRAZIER_OY - 5, cx - 2, BRAZIER_OY - 15, IRON);
  c.line(cx + 4, BRAZIER_OY - 5, cx + 2, BRAZIER_OY - 15, IRON);
  c.line(cx, BRAZIER_OY - 5, cx, BRAZIER_OY - 15, IRON, () => ({ x: 0.4, y: 0, z: 0.8 }));
  c.part();
  c.shape(BRAZIER_OY - 21, BRAZIER_OY - 15, (y) => { const k = (y - (BRAZIER_OY - 21)) / 6; return [cx - 7 + k * 3, cx + 7 - k * 3]; }, IRON, (_x, _y, t) => cyl(t, 0.2));
  c.ellipse(cx, BRAZIER_OY - 21, 7.4, 2, IRON, { normal: () => ({ x: 0, y: 0.5, z: 0.8 }) });
  c.part();
  for (let x = cx - 6; x <= cx + 6; x += 3) c.px(x, BRAZIER_OY - 18, RIME);
  icicles(c, cx - 5, cx + 5, BRAZIER_OY - 15, 3, 9 + f, ICE);
  // The fire: tongues of cold flame licking up, each frame a little different, embers of light above.
  c.part();
  const flick = (k: number) => Math.sin(f * 1.05 + k * 2.1);
  for (let k = -2; k <= 2; k++) {
    const h = 9 + (2 - Math.abs(k)) * 3 + flick(k) * 2;
    const x0 = cx + k * 2;
    const lean = flick(k + 7) * 1.5;
    for (let y = 0; y < h; y++) {
      const w = Math.max(0.6, (1 - y / h) * 2.1);
      const xm = x0 + lean * (y / h);
      for (let x = Math.floor(xm - w); x <= Math.ceil(xm + w); x++) {
        const t = Math.abs(x + 0.5 - xm) / w;
        if (t > 1) continue;
        const hot = 1 - y / h - t * 0.5;
        c.px(x, BRAZIER_OY - 21 - y, FLAME, { x: 0, y: 0, z: 1 }, { bias: Math.round(hot * 3) - 1 });
      }
    }
  }
  for (let k = 0; k < 3; k++) {
    const sx = cx + Math.round(Math.sin(f * 1.7 + k * 2.4) * 4);
    const sy = BRAZIER_OY - 34 + ((f * 3 + k * 4) % 7);
    c.spark(sx, sy, k === 1 ? C_TEAL : C_ICE, 0.9);
  }
  return c;
}
