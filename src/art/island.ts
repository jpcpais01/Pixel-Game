// The Floating Island's art: the sky below and around it (a sea of sunlit
// clouds with far islands hazed into it, unlit), the island itself (lit, with
// its own normal map: a meadow, brooks and a pond, the white marble duelling
// ring, and the rock and roots hanging under its front edge), marble
// columns, the nearer islets that drift in the sky, cloud wisps, and the
// foam where the brooks tip over the edge.

import { Bitmap, bayer, clamp01, mix } from './bitmap';
import { hash2, rng, valueNoise } from './env';
import { KEY_LIGHT, PixelCanvas, cyl, hex, type Material, type RGB, type Vec3 } from './pixel';
import {
  BROOKS,
  ISLE_CX,
  ISLE_CY,
  ISLE_H,
  ISLE_RX,
  ISLE_RY,
  ISLE_UNDER,
  ISLE_W,
  MARKS,
  POND,
  RING_CX,
  RING_CY,
  RING_RX,
  RING_RY,
  brookDist,
  frontEdgeY,
  isleR,
  pondR,
  ringR,
} from '../world/islandLayout';

const ramp = (...c: string[]): RGB[] => c.map(hex);

function fbm(x: number, y: number, scale: number, seed: number, octaves = 3): number {
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

/** Pick along a colour ramp, 0..1, blending between its steps. */
function along(r: RGB[], t: number): RGB {
  const f = clamp01(t) * (r.length - 1);
  const i = Math.min(r.length - 2, Math.floor(f));
  return mix(r[i], r[i + 1], f - i);
}

/** A ramp step, dithered between neighbours so gradients read as pixel art. */
const pick = (r: RGB[], idx: number, x: number, y: number): RGB => r[Math.max(0, Math.min(r.length - 1, Math.floor(idx + bayer(x, y))))];

// ---------------------------------------------------------------- The sky

const SKY_DEEP = ramp('#3674c4', '#4486d2', '#5698dc', '#6cace6', '#86c0ee', '#a2d2f4');
const CLOUD = ramp('#8494c4', '#9eaed6', '#bac6e4', '#d4dcf0', '#e8eef8', '#f6f9ff', '#ffffff');
const WARM: RGB = hex('#fff2dc');
/** The haze far things fade into. */
export const HAZE: RGB = hex('#b4d6f2');

/** Far islands painted into the sky: centre, width, and what stands on them. */
const FAR_ISLES: { x: number; y: number; s: number; ruin: boolean }[] = [
  { x: 232, y: 44, s: 26, ruin: true },
  { x: 548, y: 34, s: 18, ruin: false },
  { x: 26, y: 330, s: 22, ruin: false },
  { x: 774, y: 262, s: 16, ruin: true },
  { x: 250, y: 636, s: 28, ruin: false },
  { x: 566, y: 652, s: 20, ruin: true },
  { x: 776, y: 452, s: 14, ruin: false },
];

/**
 * The backdrop, one image the size of the arena: a sea of clouds far below,
 * lit from the upper left, with deep blue sky showing through its gaps and
 * a few far islands hazed into the distance.
 */
export function* skyCanvas(): Generator<void, Uint8ClampedArray, void> {
  const W = ISLE_W;
  const H = ISLE_H;
  const px = new Uint8ClampedArray(W * H * 4);

  // The noise is costly, so it is sampled every other pixel and blended.
  const GW = Math.ceil(W / 2) + 3;
  const GH = Math.ceil(H / 2) + 3;
  const gN = new Float32Array(GW * GH);
  const gF = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) {
    if (gy % 8 === 0) yield;
    for (let gx = 0; gx < GW; gx++) {
      const x = gx * 2;
      const y = gy * 2;
      const wx = x + (fbm(x, y, 110, 13) - 0.5) * 90;
      const wy = y + (fbm(x, y, 110, 31) - 0.5) * 60;
      // Clouds are wider than they are tall, seen from this angle.
      gN[gy * GW + gx] = fbm(wx, wy * 1.5, 120, 5, 4);
      gF[gy * GW + gx] = fbm(x, y, 22, 9, 2);
    }
  }
  const sample = (g: Float32Array, x: number, y: number) => {
    const fx = Math.max(0, Math.min(GW - 2, x / 2));
    const fy = Math.max(0, Math.min(GH - 2, y / 2));
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
    if (y % 16 === 0) yield;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const n = sample(gN, x, y);
      const fine = sample(gF, x, y);
      // Deeper blue far below, brighter toward the top of the view.
      let col = along(SKY_DEEP, 0.75 - (y / H) * 0.55 + (fine - 0.5) * 0.25);
      const dens = smooth(0.44, 0.64, n + (fine - 0.5) * 0.08);
      if (dens > 0) {
        // Sunward (upper left) sides glow; the far sides sink into lavender shade.
        const lit = (n - sample(gN, x + 5, y + 7)) * 6;
        let c = along(CLOUD, clamp01(0.42 + dens * 0.3 + lit + (fine - 0.5) * 0.2));
        if (lit > 0.12) c = mix(c, WARM, Math.min(0.5, (lit - 0.12) * 2));
        col = mix(col, c, Math.min(1, dens * 1.5));
      }
      const q = 6;
      const d = bayer(x, y);
      px[i] = Math.min(255, Math.floor(col[0] / q + d) * q);
      px[i + 1] = Math.min(255, Math.floor(col[1] / q + d) * q);
      px[i + 2] = Math.min(255, Math.floor(col[2] / q + d) * q);
      px[i + 3] = 255;
    }
  }

  // Far islands, small and hazy.
  for (const f of FAR_ISLES) farIsle(px, W, H, f.x, f.y, f.s, f.ruin);
  return px;
}

function farIsle(px: Uint8ClampedArray, W: number, H: number, cx: number, cy: number, s: number, ruin: boolean): void {
  const rx = s / 2;
  const ry = Math.max(2, s * 0.28);
  const grass = ramp('#6e9c86', '#86b294', '#a2c6a4');
  const rock = ramp('#6e6a94', '#8480a8', '#9c98bc');
  const haze = 0.35;
  const put = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const h = mix(c, HAZE, haze);
    px.set([h[0], h[1], h[2], 255], (y * W + x) * 4);
  };
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const u = (x + 0.5 - cx) / rx;
    if (Math.abs(u) > 1) continue;
    const half = ry * Math.sqrt(1 - u * u);
    const top = Math.round(cy - half);
    const edge = Math.round(cy + half);
    for (let y = top; y <= edge; y++) put(x, y, grass[u < -0.3 || y < cy - half * 0.4 ? 2 : u > 0.5 ? 0 : 1]);
    const depth = s * 0.75 * (1 - Math.abs(u) ** 1.5) * (0.75 + 0.35 * hash2(Math.floor(x / 2), 0, s));
    for (let y = edge + 1; y <= edge + depth; y++) put(x, y, rock[u < -0.2 ? 2 : u > 0.4 ? 0 : 1]);
  }
  if (ruin) {
    const white: RGB = hex('#f4f2f6');
    for (const ox of [-2, 0, 2]) for (let k = 1; k <= 3; k++) put(Math.round(cx + ox), Math.round(cy - k), white);
    for (let ox = -2; ox <= 2; ox++) put(Math.round(cx + ox), Math.round(cy - 4), white);
  } else {
    const leaf = ramp('#3e7a52', '#5a9868', '#7cb680');
    const tx = Math.round(cx - s * 0.12);
    for (let y = -4; y <= 0; y++) for (let x = -2; x <= 2; x++) if (x * x + (y + 2) * (y + 2) <= 5) put(tx + x, Math.round(cy - 1 + y), leaf[x + y < -2 ? 2 : x + y > 0 ? 0 : 1]);
  }
}

// ---------------------------------------------------------------- The island

/** The island image's box in arena coordinates: its top, and the rock under its front edge. */
export const ISLAND_X = Math.floor(ISLE_CX - ISLE_RX * 1.1) - 2;
export const ISLAND_Y = Math.floor(ISLE_CY - ISLE_RY * 1.1) - 2;
export const ISLAND_W = (ISLE_CX - ISLAND_X) * 2;
export const ISLAND_H = Math.ceil(ISLE_CY + ISLE_RY * 1.1 + ISLE_UNDER + 8) - ISLAND_Y;

const GRASS = ramp('#1c4430', '#255a38', '#30723e', '#428a46', '#58a44e', '#74ba58', '#98d066', '#c2e47c');
const SAND = ramp('#6a5a44', '#8a785a', '#a89872', '#c6b88e', '#e0d6ae');
const WATER = ramp('#1e5898', '#2a70b4', '#3a8ccc', '#56a8e0', '#7cc6ee', '#b4e4f8', '#f0fcff');
const PEBBLE = ramp('#5c5a68', '#7a7886', '#9a98a4', '#bcbac4', '#dcdae0');
const LILY = ramp('#1e5a30', '#2e7a3c', '#46984a', '#68b45a');
const MARBLE = ramp('#6a6480', '#88829a', '#a6a0b4', '#c2becc', '#d9d6e0', '#eae8ef', '#f7f5f7', '#ffffff');
const BLUESTONE = ramp('#56668e', '#7486b0', '#96a8d0', '#b8c8e6', '#d6e2f4');
const GOLD = ramp('#5e3a10', '#946420', '#c89232', '#eec258', '#fff0a8');
const CRIMSON = ramp('#4a0c1a', '#7e1828', '#b8303e', '#e45a64', '#ff9aa0');
const AZURE = ramp('#0e2452', '#1a4488', '#3480d0', '#6ab8f4', '#b0e2ff');
const SOIL = ramp('#321e16', '#4a2e1e', '#634028', '#7e5434', '#9a6c44');
const ROCK = ramp('#261c2c', '#382a3a', '#4e3c4a', '#66505a', '#80686c', '#9c8280', '#b89e94', '#d4bcac');
const MOSS = ramp('#1c3424', '#27482c', '#355c32', '#4a723a');
const ROOT = ramp('#24160e', '#3a2618', '#553a24');
const VINE = ramp('#1a4424', '#2a6032', '#407e40');
const FLOWERS: RGB[] = [hex('#fffaf0'), hex('#ffe066'), hex('#ffa4c8'), hex('#cdb0ff'), hex('#9cd4ff'), hex('#ffffff')];
const PINK: RGB = hex('#ffb0d0');

const GLOW_GOLD: RGB = hex('#ffcc60');
const GLOW_RED: RGB = hex('#ff4a5a');
const GLOW_BLUE: RGB = hex('#4aa8ff');

export interface IslandArt {
  diffuse: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  emissive: Uint8ClampedArray;
}

type N3 = [number, number, number];

/** The colour of a wildflower whose left petal sits at (x, y), or -1: most grow in drifts, a few stray. */
function flowerAt(x: number, y: number): number {
  const h = hash2(x, y, 61);
  if (h < 0.975) return -1;
  const drift = fbm(x, y, 34, 77, 2);
  if (drift < 0.6 && h < 0.9985) return -1;
  // Keep blooms apart: none right next to another's left petal.
  if (hash2(x - 2, y, 61) >= 0.975 || hash2(x - 1, y - 1, 61) >= 0.975) return -1;
  return Math.floor(hash2(Math.floor(x / 30), Math.floor(y / 24), 7) * 5 + (h > 0.992 ? 1 : 0)) % FLOWERS.length;
}

/** Is (u, v) inside a star with `points` points, outer radius `ro` and inner `ri`? */
function inStar(u: number, v: number, ro: number, ri: number, points: number): boolean {
  const r = Math.hypot(u, v);
  if (r > ro) return false;
  const seg = (Math.PI * 2) / points;
  let a = Math.atan2(v, u) + Math.PI / 2;
  a = ((a % seg) + seg) % seg;
  const t = Math.abs(a / seg - 0.5) * 2;
  return r <= ri + (ro - ri) * t;
}

/**
 * The island: a meadow of dithered grass and wildflowers, three brooks with
 * pebbly banks, a pond with lily pads, and in the middle a ring of white
 * marble: a raised kerb with a gold inlay, rings of veined slabs, a band of
 * blue-and-white mosaic, a gold sun at its heart, and a crimson and an azure
 * duelling mark facing each other. Under the front edge hang a lip of grass,
 * a band of soil, and rock tapering down into spurs, with roots and
 * flowering vines dangling from it and wet streaks where the falls run.
 */
export function* islandArt(): Generator<void, IslandArt, void> {
  const W = ISLAND_W;
  const H = ISLAND_H;
  const diffuse = new Uint8ClampedArray(W * H * 4);
  const normal = new Uint8ClampedArray(W * H * 4);
  const emissive = new Uint8ClampedArray(W * H * 4);
  const L = KEY_LIGHT;
  const Ll = Math.hypot(L.x, L.y, L.z);
  const shadeOf = (n: N3) => (n[0] * L.x + n[1] * L.y + n[2] * L.z) / ((Math.hypot(n[0], n[1], n[2]) || 1) * Ll);
  const put = (i: number, c: RGB, n: N3, glow?: RGB, gk = 1) => {
    diffuse.set([c[0], c[1], c[2], 255], i);
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    normal.set([Math.round((n[0] / l) * 127.5 + 127.5), Math.round((n[1] / l) * 127.5 + 127.5), Math.round((n[2] / l) * 127.5 + 127.5), 255], i);
    if (glow) emissive.set([Math.round(glow[0] * gk), Math.round(glow[1] * gk), Math.round(glow[2] * gk), 255], i);
  };
  const UP: N3 = [0, 0, 1];

  // The front edge of each column, and where the falls run down the rock.
  const edgeY = new Int32Array(W);
  for (let px = 0; px < W; px++) edgeY[px] = frontEdgeY(ISLAND_X + px);
  const falls = BROOKS.map((b) => b.fall.x);
  yield;

  // Lily pads on the pond, some in flower.
  const LR = rng(515);
  const lilies = [0, 1, 2, 3].map(() => ({ x: POND.x + (LR() - 0.5) * POND.rx * 1.1, y: POND.y + (LR() - 0.5) * POND.ry * 0.9, r: 2.2 + LR() * 1.4, bloom: LR() < 0.6 }));

  for (let py = 0; py < H; py++) {
    if (py % 10 === 0) yield;
    for (let px = 0; px < W; px++) {
      const X = ISLAND_X + px;
      const Y = ISLAND_Y + py;
      const x = X + 0.5;
      const y = Y + 0.5;
      const i = (py * W + px) * 4;
      const ir = isleR(x, y);

      if (ir <= 1) {
        // ------------------------------------------------ The top surface
        const rr = ringR(x, y);
        const ru = (x - RING_CX) / RING_RX;
        const rv = (y - RING_CY) / RING_RY;
        const sheen = (-ru - rv) * 0.18;

        if (rr <= 1) {
          const ou = ru / (rr || 1);
          const ov = rv / (rr || 1);
          // The duelling marks, one either side of the heart.
          let marked = false;
          for (let m = 0; m < 2 && !marked; m++) {
            const dx = (x - MARKS[m].x) / 13;
            const dy = (y - MARKS[m].y) / 9.5;
            const dm = Math.hypot(dx, dy);
            if (dm >= 1) continue;
            marked = true;
            const col = m === 0 ? CRIMSON : AZURE;
            const glow = m === 0 ? GLOW_RED : GLOW_BLUE;
            if (dm > 0.74) put(i, pick(col, 2.2 + sheen * 3 + (dm > 0.9 ? -0.6 : 0.3), X, Y), UP, glow, 0.28);
            else if (Math.abs(dx) + Math.abs(dy) < 0.36) put(i, pick(col, Math.abs(dx) + Math.abs(dy) < 0.16 ? 3.6 : 2.6, X, Y), UP, glow, 0.5);
            else if (dm > 0.62) put(i, pick(GOLD, 2.6, X, Y), UP);
            else put(i, pick(MARBLE, 6 + sheen * 2, X, Y), UP);
          }
          if (marked) continue;

          if (rr > 0.935) {
            // The kerb: a raised rim of polished marble with a gold inlay.
            let n: N3 = UP;
            if (rr < 0.947) n = [-ou * 0.55, ov * 0.55, 0.83];
            else if (rr > 0.988) n = [ou * 0.55, -ov * 0.55, 0.83];
            if (Math.abs(rr - 0.964) * RING_RY < 0.6) {
              put(i, pick(GOLD, 3 + shadeOf(n), X, Y), n, GLOW_GOLD, 0.08);
              continue;
            }
            put(i, pick(MARBLE, 5.4 + sheen * 2 + (shadeOf(n) - 0.7) * 2.5 + (hash2(X, Y, 3) - 0.5) * 0.5, X, Y), n);
            continue;
          }
          // Gold rings between the bands.
          if (Math.abs(rr - 0.425) * RING_RY < 0.6 || Math.abs(rr - 0.685) * RING_RY < 0.6 || Math.abs(rr - 0.208) * RING_RY < 0.6) {
            put(i, pick(GOLD, 2.8 + sheen * 2, X, Y), UP, GLOW_GOLD, 0.06);
            continue;
          }
          const ang = Math.atan2(rv, ru);
          if (rr < 0.2) {
            // The sun at the heart: twelve gold rays round a bright disc.
            if (rr < 0.085) {
              put(i, pick(GOLD, rr < 0.035 ? 4 : 3.2 + sheen * 2, X, Y), UP, GLOW_GOLD, rr < 0.035 ? 0.35 : 0.18);
              continue;
            }
            if (Math.abs(rr - 0.1) * RING_RY < 0.5) {
              put(i, pick(GOLD, 1.8, X, Y), UP);
              continue;
            }
            if (inStar(ru, rv, 0.19, 0.11, 12)) {
              put(i, pick(GOLD, 2.6 + sheen * 2 + (inStar(ru, rv, 0.19, 0.11, 24) ? 0.6 : 0), X, Y), UP, GLOW_GOLD, 0.08);
              continue;
            }
            put(i, pick(MARBLE, 6.2 + sheen * 2, X, Y), UP);
            continue;
          }
          if (rr > 0.43 && rr < 0.68) {
            // The mosaic band: wedges of white and blue stone, a gold stud in each.
            const segs = 32;
            const seg = (Math.PI * 2) / segs;
            const k = Math.floor((ang + Math.PI) / seg);
            const sa = (((ang + Math.PI) % seg) + seg) % seg;
            const edgeA = Math.min(sa, seg - sa) * rr * RING_RX;
            if (edgeA < 0.55) {
              put(i, pick(MARBLE, 2.4, X, Y), UP);
              continue;
            }
            const midA = Math.abs(sa - seg / 2) * rr * RING_RX;
            if (Math.abs(rr - 0.555) * RING_RY < 1.2 && midA < 1.3) {
              put(i, pick(GOLD, 3.2, X, Y), UP, GLOW_GOLD, 0.1);
              continue;
            }
            if (k % 2 === 0) put(i, pick(MARBLE, 5.6 + sheen * 2 + (hash2(k, 0, 5) - 0.5) * 0.6, X, Y), UP);
            else put(i, pick(BLUESTONE, 2.6 + sheen * 2 + (hash2(k, 1, 5) - 0.5) * 0.6, X, Y), UP);
            continue;
          }
          // Veined slabs, laid in rings.
          const outer = rr > 0.68;
          const segs = outer ? (rr > 0.81 ? 36 : 30) : 14;
          const seg = (Math.PI * 2) / segs;
          const sa = (((ang + Math.PI) % seg) + seg) % seg;
          const edgeA = Math.min(sa, seg - sa) * rr * RING_RX;
          const edgeR = Math.min(Math.abs(rr - 0.69), Math.abs(rr - 0.81), Math.abs(rr - 0.935), Math.abs(rr - 0.215), Math.abs(rr - 0.425)) * RING_RY;
          if (edgeA < 0.55 || edgeR < 0.6) {
            put(i, pick(MARBLE, 2.6, X, Y), UP);
            continue;
          }
          const slab = hash2(Math.floor((ang + Math.PI) / seg), outer ? (rr > 0.81 ? 2 : 1) : 0, 13);
          let idx = 5.1 + (slab - 0.5) * 1.1 + sheen * 2;
          if (edgeA < 1.5 || edgeR < 1.5) idx += 0.5;
          const vein = fbm(x + slab * 300, y * 1.3, 16, 23);
          if (Math.abs(vein - 0.5) < 0.013) idx -= 1.7;
          else if (Math.abs(vein - 0.5) < 0.03) idx -= 0.6;
          put(i, pick(MARBLE, idx, X, Y), UP);
          continue;
        }

        // The kerb's south face, three pixels tall.
        if (rv > 0 && ringR(x, y - 3) <= 1) {
          const n: N3 = [ru * 0.5, -0.55, 0.65];
          const top = ringR(x, y - 1) <= 1;
          put(i, pick(MARBLE, (top ? 3.6 : 2.8) + shadeOf(n) * 1.5 + sheen, X, Y), n);
          continue;
        }

        // The pond, ringed with pebbles, lily pads floating on it.
        const pr = pondR(x, y);
        if (pr < 1) {
          let lily = false;
          for (const l of lilies) {
            const d = Math.hypot(x - l.x, (y - l.y) * 1.5);
            if (d > l.r) continue;
            lily = true;
            // A notch cut in each pad.
            if (x > l.x && Math.abs(y - l.y) < 0.6) break;
            if (l.bloom && d < 1) put(i, PINK, UP);
            else put(i, pick(LILY, 2 + (l.x - x) * 0.3 + (l.y - y) * 0.4, X, Y), UP);
            break;
          }
          if (lily && diffuse[i + 3]) continue;
          const deep = 1 - pr;
          let idx = 3.2 - deep * 2.2 + (fbm(x, y * 2, 6, 44, 2) - 0.5) * 0.8;
          // The sky's reflection glints on the ripples.
          if (valueNoise(x * 1.5, y * 3, 5, 91) > 0.8) idx = 5.2;
          put(i, pick(WATER, idx, X, Y), UP);
          continue;
        }
        if (pr < 1.2) {
          const s = hash2(Math.floor(x / 3), Math.floor(y / 2), 17);
          const bump: N3 = [(hash2(X, Y, 8) - 0.5) * 0.6, 0.3, 0.9];
          put(i, pick(PEBBLE, 1.6 + s * 2 + (pr < 1.06 ? -0.8 : 0), X, Y), bump);
          continue;
        }

        // The brooks and their pebbly banks.
        const bd = brookDist(x, y);
        if (bd < 0) {
          const flow = valueNoise(x * 0.8 + y * 0.8, x * 0.8 - y * 0.8, 3.2, 57);
          let idx = 3.2 + bd * 0.35 + (flow - 0.5) * 1.2;
          if (flow > 0.78) idx = 5.4;
          put(i, pick(WATER, idx, X, Y), UP);
          continue;
        }
        if (bd < 1.8) {
          const s = hash2(X, Y, 23);
          put(i, s > 0.55 ? pick(PEBBLE, 1.5 + s * 2.5, X, Y) : pick(SAND, 1.6 + s * 2, X, Y), [0, 0.2, 1]);
          continue;
        }

        // The meadow: broad sunlit and shaded swathes, then finer tufts.
        const big = fbm(x, y, 70, 5);
        const mid = fbm(x, y, 18, 15, 2);
        const fine = valueNoise(x, y, 5, 9);
        let idx = 3.5 + (big - 0.5) * 3.2 + (mid - 0.5) * 1.2 + (fine - 0.5) * 0.9 + (-ru - rv) * 0.05;
        // Blades: a bright tip over a shaded root.
        if (hash2(X, Y, 31) > 0.9) idx += 1.3;
        else if (hash2(X, Y - 1, 31) > 0.9) idx -= 0.9;
        // Damper, lusher grass along the water.
        if (bd < 7 || pr < 1.5) idx -= 0.5;
        // Shade at the kerb's foot.
        if (rr < 1.05) idx -= 0.9;
        // The far rim catches the light; the front one leads down to the lip.
        if (ir > 0.992) idx += Y < ISLE_CY ? 1.2 : -0.6;
        // Wildflowers in drifts: two-pixel blooms with a shadow under them.
        const f = flowerAt(X, Y);
        if (f >= 0 || flowerAt(X - 1, Y) >= 0) {
          const k = f >= 0 ? f : flowerAt(X - 1, Y);
          put(i, f >= 0 ? FLOWERS[k] : mix(FLOWERS[k], hex('#ffffff'), 0.35), [0, 0.3, 0.95]);
          continue;
        }
        if (flowerAt(X, Y - 1) >= 0 || flowerAt(X - 1, Y - 1) >= 0) idx -= 1.4;
        const nx = (valueNoise(x + 1, y, 5, 9) - valueNoise(x - 1, y, 5, 9)) * 1.4;
        const ny = (valueNoise(x, y - 1, 5, 9) - valueNoise(x, y + 1, 5, 9)) * 1.4;
        put(i, pick(GRASS, idx, X, Y), [nx, ny, 1]);
        continue;
      }

      // ------------------------------------------------ Under the front edge
      const e = edgeY[px];
      if (e < 0 || Y <= e) continue;
      const d = Y - e;
      const u = (x - ISLE_CX) / ISLE_RX;
      const au = Math.min(1, Math.abs(u) / 1.09);
      const lip = 2 + (hash2(X, 0, 5) > 0.7 ? Math.floor(hash2(X, 1, 5) * 3) : 0);
      const soil = 3 + 6 + Math.floor(fbm(x, 0, 9, 3, 2) * 4);
      const spur = Math.pow(fbm(x, 0, 7, 91, 2), 3) * 30 * (1 - au);
      const depth = Math.min(ISLE_UNDER, 14 + (ISLE_UNDER - 30) * Math.pow(1 - au, 1.35) * (0.78 + 0.4 * fbm(x, 0, 26, 88, 2)) + spur);
      const fall = falls.some((f) => Math.abs(X - f) <= 5);

      // Roots and vines dangle from the soil, some past the rock's end.
      const rh = hash2(X, 0, 41);
      if (d > soil && !fall && rh > 0.9) {
        const len = 8 + hash2(X, 2, 41) * (rh > 0.96 ? 46 : 22);
        if (d < soil + len) {
          const vine = hash2(X, 3, 41) > 0.55;
          if (vine) {
            const bloom = hash2(X, Y, 43) > 0.8;
            put(i, bloom ? PINK : pick(VINE, 1 + ((d + X) % 3 === 0 ? 1 : 0), X, Y), [u * 0.4, -0.3, 0.85]);
          } else {
            put(i, pick(ROOT, 1 + (d % 4 === 0 ? 1 : 0), X, Y), [u * 0.4, -0.3, 0.85]);
          }
          continue;
        }
      }
      if (d > depth) continue;
      if (d <= lip) {
        // A lip of grass curling over the edge, tufts hanging from it.
        const n: N3 = [u * 0.3, -0.55, 0.8];
        put(i, pick(GRASS, 2.6 - d * 0.5 + shadeOf(n), X, Y), n);
        continue;
      }
      // Facets: the rock breaks into rough vertical faces, some catching the sun.
      const facet = (valueNoise(x, 0, 5, 13) - 0.5) * 1.1 + (valueNoise(x, y, 11, 17) - 0.5) * 0.4;
      const sideN: N3 = [u * 0.75 + facet, -0.25 - (d / depth) * 0.35, 0.7];
      if (d <= soil) {
        let idx = 2.6 - ((d - lip) / (soil - lip)) * 1.2 + shadeOf(sideN) * 1.2 + (hash2(X, Y, 19) - 0.5) * 0.8;
        if (hash2(X, Y, 29) > 0.93) idx = 0; // root ends
        put(i, pick(fall ? ROCK : SOIL, fall ? idx - 0.5 : idx, X, Y), sideN);
        continue;
      }
      const fade = (d - soil) / Math.max(1, depth - soil);
      const layer = d + fbm(x, 0, 20, 51, 2) * 8;
      const strata = Math.floor(layer / 7) % 2;
      let idx = 4.6 - fade * 3 - strata * 0.6 + (shadeOf(sideN) - 0.4) * 2.2 + (fbm(x, y, 4, 71, 2) - 0.5) * 0.9;
      // A dark seam between the layers.
      if (layer % 7 < 0.9 && hash2(Math.floor(x / 4), Math.floor(layer / 7), 3) > 0.25) idx -= 1.3;
      if (fade > 0.92) idx -= 0.8;
      if (fall) {
        // Wet, dark rock where the water runs.
        put(i, mix(pick(ROCK, idx - 1.2, X, Y), hex('#2a4a78'), 0.35), sideN);
        continue;
      }
      if (fade < 0.24 && fbm(x, y, 7, 37, 2) > 0.62 - (0.24 - fade) * 0.7) {
        put(i, pick(MOSS, 2.2 - fade * 3 + shadeOf(sideN), X, Y), sideN);
        continue;
      }
      put(i, pick(ROCK, idx, X, Y), sideN);
    }
  }
  return { diffuse, normal, emissive };
}

// ---------------------------------------------------------------- Columns

const M_MARBLE: Material = { ramp: MARBLE, outline: hex('#3c3652'), outlineLit: hex('#6a6480') };
const M_GOLD: Material = { ramp: GOLD, outline: hex('#3a2208'), shine: true };
const M_VINE: Material = { ramp: ramp('#163c20', '#22542c', '#34703a', '#4c8e46', '#6aaa56'), outline: hex('#0c2012') };
const M_BLOSSOM: Material = { ramp: ramp('#a84476', '#dc76a4', '#ffb0cc', '#fff0f6'), outline: hex('#3e1028'), noOutline: true, noAO: true };

const TOP: Vec3 = { x: 0, y: 0.62, z: 0.78 };
const FRONT: Vec3 = { x: 0, y: -0.16, z: 0.99 };
const side = (x: number, y: number, z: number): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};

export const COLUMN_W = 16;
export const COLUMN_H = 58;
/** Feet in the column's frame. */
export const COLUMN_BASE = 55;

/**
 * A white marble column: a square plinth, a round base, a fluted shaft that
 * swells a little, a gold-banded capital and a square abacus. Variant 1 has
 * a flowering vine winding up it.
 */
export function column(v: number): PixelCanvas {
  const c = new PixelCanvas(COLUMN_W, COLUMN_H);
  const cx = 8;
  const B = COLUMN_BASE;
  // Plinth.
  c.part();
  for (let x = 2; x <= 13; x++) {
    const n = x === 2 ? side(-0.4, -0.1, 0.9) : x === 13 ? side(0.4, -0.1, 0.9) : FRONT;
    for (let y = B - 3; y <= B; y++) c.px(x, y, M_MARBLE, n, { bias: y === B - 3 ? 1 : 0 });
    for (let y = B - 7; y < B - 3; y++) c.px(x, y, M_MARBLE, TOP, { bias: 1 });
  }
  // Round base.
  c.part();
  c.shape(B - 10, B - 7, () => [cx - 5.5, cx + 5.5], M_MARBLE, (_x, _y, t, u) => cyl(t, 0.5 - u * 0.6));
  // Fluted shaft, swelling a touch a third of the way up.
  c.part();
  const top = 15;
  c.shape(top, B - 10, (y) => {
    const k = (y - top) / (B - 10 - top);
    const hw = 3.9 + Math.sin(k * Math.PI * 0.8 + 0.3) * 0.35;
    return [cx - hw, cx + hw];
  }, M_MARBLE, (_x, _y, t) => cyl(t, 0.08));
  for (let y = top; y < B - 10; y++) {
    for (const fx of [cx - 2, cx + 1]) c.shade(fx, y, -1);
  }
  // Gold band under the capital.
  c.part();
  c.shape(12, 14, () => [cx - 4.4, cx + 4.4], M_GOLD, (_x, _y, t) => cyl(t, 0.2));
  // Echinus.
  c.part();
  c.shape(9, 11, (y) => {
    const hw = 5 + (11 - y) * 0.6;
    return [cx - hw, cx + hw];
  }, M_MARBLE, (_x, _y, t, u) => cyl(t, 0.6 - u * 0.5));
  // Abacus.
  c.part();
  for (let x = 1; x <= 14; x++) {
    for (let y = 7; y <= 8; y++) c.px(x, y, M_MARBLE, FRONT, { bias: y === 7 ? 1 : 0 });
    for (let y = 4; y <= 6; y++) c.px(x, y, M_MARBLE, TOP, { bias: 1 });
  }
  if (v === 1) {
    // A vine winding up, in flower.
    c.part();
    for (let y = 6; y <= B - 4; y++) {
      const a = (y / 40) * Math.PI * 2 * 1.4 + 1;
      const front = Math.cos(a);
      if (front < -0.25) continue;
      const x = Math.round(cx + Math.sin(a) * 4.6);
      c.px(x, y, M_VINE, cyl(Math.sin(a), 0.2));
      if (hash2(x, y, 5) > 0.72) c.px(x + (Math.sin(a) > 0 ? 1 : -1), y, M_VINE, TOP, { bias: 1 });
    }
    c.part();
    for (const [x, y] of [[4, 18], [12, 26], [5, 34], [11, 42], [9, 7], [4, 50]]) {
      c.px(x, y, M_BLOSSOM, TOP, { bias: 1 });
      c.px(x + 1, y, M_BLOSSOM, FRONT);
      c.px(x, y + 1, M_BLOSSOM, FRONT, { bias: -1 });
    }
  }
  return c;
}

// ---------------------------------------------------------------- The sky's moving parts (flat, unlit)

/** A small floating island `s` pixels wide, hazed a little: a tree, a ruin or a waterfall on it. */
export function islet(s: number, seed: number, kind: 'tree' | 'ruin' | 'fall'): Bitmap {
  const W = s + 6;
  const H = Math.round(s * 1.2) + 8;
  const out = new Bitmap(W, H);
  const R = rng(seed);
  const cx = W / 2;
  const rx = s / 2;
  const ry = Math.max(3, s * 0.3);
  const top = Math.round(s * 0.28) + 2;
  const cy = top + ry;
  const haze = 0.2;
  const put = (x: number, y: number, c: RGB, a = 255) => out.set(x, y, mix(c, HAZE, haze), a);
  const grass = ramp('#2e6a3c', '#428a46', '#5ea64e', '#80c05a', '#a6d468');
  const rock = ramp('#3a3044', '#4e4258', '#64566c', '#7c6e82', '#968a9a');
  const soil = ramp('#4a2e1e', '#634028');
  const bottom: number[] = [];
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5 - cx) / rx;
    if (Math.abs(u) > 1) {
      bottom.push(-1);
      continue;
    }
    const half = ry * Math.sqrt(1 - u * u);
    const t = Math.round(cy - half);
    const e = Math.round(cy + half);
    for (let y = t; y <= e; y++) {
      const v = (y + 0.5 - cy) / ry;
      const l = 2.2 - u * 0.9 - v * 0.8 + (hash2(x, y, seed) - 0.5) * 0.7 + (y === t ? 0.8 : 0);
      put(x, y, pick(grass, l, x, y));
    }
    bottom.push(e);
    const depth = s * 0.85 * (1 - Math.abs(u) ** 1.5) * (0.72 + 0.4 * valueNoise(x, 0, 3, seed));
    for (let y = e + 1; y <= e + depth; y++) {
      const d = y - e;
      if (d <= 1) put(x, y, pick(grass, 0.8 - u * 0.5, x, y));
      else if (d <= 3) put(x, y, pick(soil, 1 - u * 0.6, x, y));
      else put(x, y, pick(rock, 3 - u * 1.6 - (d / depth) * 2 + (Math.floor(d / 4) % 2) * -0.4, x, y));
    }
  }
  const px = Math.round(cx + (R() - 0.5) * s * 0.3);
  const py = Math.round(cy - 1);
  if (kind === 'tree') {
    const leaf = ramp('#1e4a2c', '#2c6a38', '#44884a', '#66a85a', '#8cc66a');
    const r = Math.max(2.5, s * 0.16);
    for (let y = -Math.ceil(r * 2.4); y <= 0; y++) {
      for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
        const dy = (y + r * 1.4) / r;
        const dx = x / r;
        if (dx * dx + dy * dy > 1) continue;
        put(px + x, py + y, pick(leaf, 2.4 - dx * 1.2 - dy * 1.1 + (hash2(x, y, seed) - 0.5) * 0.6, px + x, py + y));
      }
    }
    put(px, py, hex('#4a3020'));
  } else if (kind === 'ruin') {
    const white = ramp('#9a94ac', '#d6d2de', '#f6f4f8');
    const n = s > 30 ? 3 : 2;
    const gap = 3;
    const x0 = px - Math.floor(((n - 1) * gap) / 2);
    for (let k = 0; k < n; k++) {
      for (let y = 1; y <= 5; y++) {
        put(x0 + k * gap, py - y, white[y === 5 ? 2 : 1]);
        put(x0 + k * gap + 1, py - y, white[0]);
      }
    }
    for (let x = x0 - 1; x <= x0 + (n - 1) * gap + 2; x++) put(x, py - 6, white[2]);
  }
  if (kind === 'fall') {
    // A thread of water from the edge, fading as it falls.
    const fx = Math.round(cx + s * 0.18);
    const e = bottom[fx] ?? cy;
    const water = ramp('#8cc4e8', '#d0f0fc', '#ffffff');
    for (let y = e - 1; y < H; y++) {
      const a = Math.round(255 * clamp01(1 - (y - e) / (H - e)) * 0.9);
      if (a < 20) break;
      put(fx, y, water[(y + seed) % 3 === 0 ? 2 : 1], a);
      put(fx + 1, y, water[0], Math.round(a * 0.7));
    }
  }
  return out;
}

/** The nearer islets drifting round the island: centre, width, seed and what stands on each. */
export const ISLETS: { x: number; y: number; s: number; seed: number; kind: 'tree' | 'ruin' | 'fall' }[] = [
  { x: 78, y: 128, s: 60, seed: 11, kind: 'ruin' },
  { x: 722, y: 150, s: 48, seed: 23, kind: 'tree' },
  { x: 70, y: 560, s: 70, seed: 37, kind: 'fall' },
  { x: 735, y: 575, s: 56, seed: 41, kind: 'tree' },
  { x: 730, y: 380, s: 36, seed: 53, kind: 'fall' },
];

export const WISP_W = 112;
export const WISP_H = 40;

/** A wisp of cloud drifting in the sky, in three steps of softness. */
export function wisp(seed: number): Bitmap {
  const out = new Bitmap(WISP_W, WISP_H);
  const R = rng(seed);
  const blobs = Array.from({ length: 7 }, () => ({ x: 16 + R() * (WISP_W - 32), y: WISP_H * 0.55 + (R() - 0.5) * 8, r: 8 + R() * 10 }));
  const lit: RGB = hex('#ffffff');
  const mid: RGB = hex('#e8eef8');
  const shade: RGB = hex('#c4cee8');
  for (let y = 0; y < WISP_H; y++) {
    for (let x = 0; x < WISP_W; x++) {
      let d = 0;
      for (const b of blobs) d = Math.max(d, 1 - Math.hypot((x - b.x) / (b.r * 1.5), (y - b.y) / b.r));
      d += (valueNoise(x, y, 6, seed) - 0.5) * 0.3;
      if (d <= 0.05) continue;
      const a = d > 0.5 ? 0.72 : d > 0.25 ? 0.46 : 0.2;
      if (d < 0.25 && bayer(x, y) > 0.6) continue;
      // Lit on top, shaded underneath.
      const up = blobs.some((b) => Math.hypot((x - b.x) / (b.r * 1.5), (y + 3 - b.y) / b.r) > 1 && Math.hypot((x - b.x) / (b.r * 1.5), (y - b.y) / b.r) < 1);
      const c = y > WISP_H * 0.62 ? shade : up ? lit : mid;
      out.set(x, y, c, Math.round(a * 255));
    }
  }
  return out;
}

/** White water churning where a brook tips over the edge: 12 x 5. */
export function foam(): Bitmap {
  const out = new Bitmap(12, 5);
  const c = [hex('#ffffff'), hex('#dcf4ff'), hex('#a8dcf4')];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 12; x++) {
      const d = Math.hypot((x + 0.5 - 6) / 6, (y + 0.5 - 2.5) / 2.5);
      if (d > 1) continue;
      const h = hash2(x, y, 3);
      out.set(x, y, c[d < 0.5 ? 0 : h > 0.5 ? 1 : 2], Math.round(255 * (d < 0.6 ? 0.95 : 0.6)));
    }
  }
  return out;
}

/** A tileable 10 x 32 strip of falling water, brighter down its middle. */
export function fallStrip(): Bitmap {
  const W = 10;
  const H = 32;
  const out = new Bitmap(W, H);
  const cols = ramp('#6aaee0', '#a8dcf4', '#e4f8ff', '#ffffff');
  for (let x = 0; x < W; x++) {
    const edge = x === 0 || x === W - 1;
    for (let y = 0; y < H; y++) {
      // Streaks that repeat every 32 rows, so the strip tiles.
      const n = (Math.sin(((y + hash2(x, 0, 7) * 32) / H) * Math.PI * 2 * 2) * 0.5 + 0.5) * 0.6 + hash2(x, y, 9) * 0.4 + (x > 2 && x < W - 3 ? 0.15 : 0);
      const i = n > 0.78 ? 3 : n > 0.55 ? 2 : n > 0.3 ? 1 : 0;
      out.set(x, y, cols[edge ? Math.max(0, i - 1) : i], edge ? 150 : 230);
    }
  }
  return out;
}
