// The Endless Rift's art: the void behind it (a slow spiral of violet and
// magenta round a pale eye, dithered to a few steps), the obsidian platform
// (lit, with its own normal map and a glow layer for its fissures and seal),
// the tears the waves pour through (pure light, a few frames each), the
// shards standing on it, and the icons of the blessings chosen between waves.

import { bayer, clamp01, mix } from './bitmap';
import { hash2, valueNoise } from './env';
import { KEY_LIGHT, PixelCanvas, hex, sphere, type Material, type RGB } from './pixel';
import { icon16, seg, type Put } from './druid';
import { RIFT_CX, RIFT_CY, RIFT_H, RIFT_RIM, RIFT_RX, RIFT_RY, RIFT_W } from '../world/riftLayout';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** Pick along a colour ramp, 0..1, blending between its steps. */
function along(r: RGB[], t: number): RGB {
  const f = clamp01(t) * (r.length - 1);
  const i = Math.min(r.length - 2, Math.floor(f));
  return mix(r[i], r[i + 1], f - i);
}

// ---------------------------------------------------------------- The void

const VOID: RGB[] = ramp('#050309', '#0c0618', '#1a0a2e', '#34104a', '#5a1a62', '#8e2a78', '#d05aa0', '#ffd0ea');
const STARS: RGB[] = [hex('#ffffff'), hex('#ffd0ec'), hex('#d8c0ff')];

/** The void, one image the size of the arena: a spiral turning round an eye behind the platform. */
export function* riftVoidCanvas(): Generator<void, Uint8ClampedArray, void> {
  const W = RIFT_W;
  const H = RIFT_H;
  const px = new Uint8ClampedArray(W * H * 4);
  // The eye hangs above the platform's far edge, where it can be seen.
  const ex = RIFT_CX;
  const ey = RIFT_CY - RIFT_RY - 70;
  for (let y = 0; y < H; y++) {
    if (y % 10 === 0) yield;
    for (let x = 0; x < W; x++) {
      const dx = x - ex;
      const dy = (y - ey) * 1.4;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      // Three arms, wound tighter towards the eye, broken up by noise.
      const warp = valueNoise(x, y, 44, 7) * 2.4;
      const arm = 0.5 + 0.5 * Math.sin(a * 3 - Math.log(r + 10) * 5.2 + warp);
      const fall = clamp01(1 - r / 460);
      let k = arm * arm * fall * (0.7 + 0.6 * valueNoise(x, y, 20, 3));
      k += Math.pow(clamp01(1 - r / 60), 2) * 1.1;
      const q = Math.min(1, Math.floor(k * 7 + bayer(x, y)) / 7);
      let c = along(VOID, q * 0.92);
      if (hash2(x, y, 17) > 0.9975) c = mix(c, STARS[Math.floor(hash2(x, y, 5) * 3)], 0.9 - fall * 0.5);
      px.set([c[0], c[1], c[2], 255], (y * W + x) * 4);
    }
  }
  return px;
}

// ---------------------------------------------------------------- The platform

export const RIFT_PLATFORM_X = RIFT_CX - RIFT_RX - 2;
export const RIFT_PLATFORM_Y = RIFT_CY - RIFT_RY - 2;
export const RIFT_PLATFORM_W = RIFT_RX * 2 + 4;
export const RIFT_PLATFORM_H = RIFT_RY * 2 + RIFT_RIM + 30;

const OBSIDIAN = ramp('#07050c', '#0f0b18', '#171226', '#211a36', '#2e2549', '#43386a');
const RIM = ramp('#0c0814', '#1a1228', '#2a1e40', '#40305e', '#5e4a86', '#8a74b8');
const ROCK = ramp('#050309', '#0b0714', '#130d22', '#1c1432', '#281c46');
const FISSURE: RGB = hex('#ff4ab8');
const FISSURE_HOT: RGB = hex('#ffd0ec');
const SEAL: RGB = hex('#b070ff');

export interface RiftPlatformArt {
  diffuse: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  emissive: Uint8ClampedArray;
}

/** Nearest and second-nearest distance to jittered points on a grid of cells `size` px wide, and the nearest cell's hash. */
function cells(x: number, y: number, size: number): { d1: number; d2: number; id: number } {
  const gx = Math.floor(x / size);
  const gy = Math.floor(y / size);
  let d1 = Infinity;
  let d2 = Infinity;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i;
      const cy = gy + j;
      const px = (cx + 0.15 + hash2(cx, cy, 31) * 0.7) * size;
      const py = (cy + 0.15 + hash2(cx, cy, 37) * 0.7) * size;
      const d = Math.hypot(x - px, (y - py) * 1.3);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash2(cx, cy, 41);
      } else if (d < d2) d2 = d;
    }
  }
  return { d1, d2, id };
}

/**
 * The platform: slabs of obsidian split by grout, some of the cracks
 * glowing with the rift's light; a violet seal of two rings and six runes
 * round the heart; a raised rim set with glowing studs; and the broken
 * stone hanging under its front edge, veined with the same light.
 */
export function* riftPlatformArt(): Generator<void, RiftPlatformArt, void> {
  const W = RIFT_PLATFORM_W;
  const H = RIFT_PLATFORM_H;
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

  for (let py = 0; py < H; py++) {
    if (py % 10 === 0) yield;
    for (let pxl = 0; pxl < W; pxl++) {
      const x = pxl + RIFT_PLATFORM_X + 0.5;
      const y = py + RIFT_PLATFORM_Y + 0.5;
      const i = (py * W + pxl) * 4;
      const u = (x - RIFT_CX) / RIFT_RX;
      const v = (y - RIFT_CY) / RIFT_RY;
      const r = Math.hypot(u, v);
      const ang = Math.atan2(v, u);
      const px1 = 1 / RIFT_RX;

      if (r <= 1) {
        const ou: [number, number, number] = [u / (r || 1), -v / (r || 1), 0];
        if (r > 0.93) {
          // The raised rim, sloping outward, studded every 30 degrees with the rift's light.
          const k = (r - 0.93) / 0.07;
          const n: [number, number, number] = [ou[0] * k * 0.9, ou[1] * k * 0.9, 1 - k * 0.3];
          const segA = (Math.PI * 2) / 12;
          const off = Math.abs((((ang % segA) + segA) % segA) - segA / 2) * r * RIFT_RX;
          if (off < 1.3 && Math.abs(r - 0.965) < px1 * 1.6) {
            put(i, FISSURE_HOT, [0, 0, 1], FISSURE, 0.9);
            continue;
          }
          put(i, pick(RIM, 1.5 + shadeOf(n) * 2.6 + (hash2(pxl, py, 5) - 0.5) * 0.6), n);
          continue;
        }
        // The seal: two rings round the heart, and six runes between them.
        const ringA = Math.abs(r - 0.455) < 0.012;
        const ringB = Math.abs(r - 0.3) < 0.01;
        if (ringA || ringB) {
          put(i, mix(hex('#1a0e30'), hex('#8a5ae0'), 0.55), [0, 0, 1], SEAL, ringA ? 0.55 : 0.4);
          continue;
        }
        if (r > 0.33 && r < 0.425) {
          const segA = Math.PI / 3;
          const aOff = ((((ang + Math.PI / 6) % segA) + segA) % segA) - segA / 2;
          const along = aOff * r * RIFT_RX;
          const mid = Math.abs(r - 0.378) * RIFT_RY;
          const stem = Math.abs(along) < 0.6;
          const bar = Math.abs(mid) < 0.7 && Math.abs(along) < 3.2;
          const tick = Math.abs(r - 0.35) * RIFT_RY < 0.6 && Math.abs(along - 2) < 0.8;
          if (stem || bar || tick) {
            put(i, hex('#d8c0ff'), [0, 0, 1], SEAL, 0.8);
            continue;
          }
        }
        if (r < 0.1) {
          // The heart: an eight-pointed star of light cracked across.
          const star = Math.abs(Math.cos(ang * 4)) * 0.05 + 0.03;
          if (r < star) {
            put(i, r < star * 0.5 ? hex('#fff0fa') : hex('#e08ad0'), [0, 0, 1], FISSURE, r < star * 0.5 ? 1 : 0.6);
            continue;
          }
        }
        // Slabs of obsidian, split by grout; some cracks burn with the rift's light.
        const c = cells(x, y, 24);
        const edge = c.d2 - c.d1;
        const fis = valueNoise(x, y, 34, 9);
        if (edge < 1.1 && fis > 0.6 && r > 0.1) {
          const k = clamp01((fis - 0.6) / 0.25);
          put(i, mix(FISSURE, FISSURE_HOT, k * 0.6), [0, 0, 1], FISSURE, 0.45 + k * 0.5);
          continue;
        }
        if (edge < 0.9) {
          put(i, OBSIDIAN[0], [0, 0, 1]);
          continue;
        }
        const bevel = edge < 2.2;
        const n: [number, number, number] = bevel ? [0.25, 0.3, 1] : [0, 0, 1];
        let idx = 2.2 + (c.id - 0.5) * 1.6 + (valueNoise(x, y, 9, 21) - 0.5) * 0.9 + (bevel ? 0.9 : 0);
        // Glassy streaks across each slab.
        if (Math.sin((x + y * 0.6) * 0.35 + c.id * 20) > 0.93) idx += 1;
        if (hash2(pxl, py, 8) > 0.995) idx = 5;
        put(i, pick(OBSIDIAN, idx), n);
        continue;
      }

      // Below the top edge: the platform's broken side, hanging into the void.
      if (Math.abs(u) >= 1 || v < 0) continue;
      const edgeY = RIFT_CY + RIFT_RY * Math.sqrt(1 - u * u);
      const front = Math.sqrt(1 - u * u);
      const drop = y - edgeY;
      const spur = Math.pow(valueNoise(x, 0, 9, 88), 2) * 40 + (hash2(Math.floor(x / 4), 0, 9) > 0.8 ? 7 : 0);
      const depth = RIFT_RIM * (0.5 + 0.5 * front) + spur * front;
      if (drop < 0 || drop > depth) continue;
      const sideN: [number, number, number] = [u * 0.7, -0.35, 0.75];
      if (drop < 2.5) {
        put(i, pick(RIM, 1 + shadeOf(sideN) * 1.5), sideN);
        continue;
      }
      const fade = drop / depth;
      const vein = valueNoise(x, y * 3, 36, 23);
      if (Math.abs(vein - 0.5) < 0.014 && fade > 0.15 && fade < 0.85) {
        put(i, hex('#7a2068'), sideN, FISSURE, 0.3 * (1 - fade));
        continue;
      }
      const strata = Math.floor((drop + valueNoise(x, 0, 18, 51) * 6) / 6) % 2;
      put(i, pick(ROCK, 3 - fade * 2.6 - strata * 0.5 + shadeOf(sideN) * 1.2), sideN);
    }
  }
  return { diffuse, normal, emissive };
}

// ---------------------------------------------------------------- The tears

export const TEAR_W = 24;
export const TEAR_H = 48;
export const TEAR_FRAMES = 4;

/** A tear in the air, frame `f`: a jagged slit of light, white at its heart, magenta out to a violet haze. */
export function riftTear(f: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(TEAR_W * TEAR_H * 4);
  const ph = (f / TEAR_FRAMES) * Math.PI * 2;
  const set = (x: number, y: number, c: RGB, a = 255) => {
    if (x < 0 || y < 0 || x >= TEAR_W || y >= TEAR_H) return;
    px.set([c[0], c[1], c[2], a], (y * TEAR_W + x) * 4);
  };
  for (let y = 0; y < TEAR_H; y++) {
    const t = (y + 0.5) / TEAR_H;
    const w = Math.pow(Math.sin(Math.PI * t), 0.8) * (3.3 + Math.sin(t * 11 + ph) * 0.8);
    const cx = TEAR_W / 2 + Math.sin(t * 9 + ph * 0.5) * 1.7 + Math.sin(t * 23 + ph) * 0.6;
    for (let x = 0; x < TEAR_W; x++) {
      const d = Math.abs(x + 0.5 - cx);
      if (d < w * 0.3) set(x, y, hex('#fff4fc'));
      else if (d < w * 0.65) set(x, y, hex('#ff8ad8'));
      else if (d < w) set(x, y, hex('#c03aa0'));
      else if (d < w + 2 && bayer(x, y + f) < 0.5 - (d - w) * 0.2) set(x, y, hex('#5a1a8a'));
    }
    // Motes torn loose at its edges.
    if (hash2(y, f, 3) > 0.86) set(Math.round(cx + (hash2(y, f, 4) - 0.5) * (w * 2 + 8)), y, hex('#ffc0ec'));
  }
  return px;
}

// ---------------------------------------------------------------- The shards

export const SHARD_W = 20;
export const SHARD_H = 36;
/** The shard's foot in its frame. */
export const SHARD_OY = 33;

const SHARD_M: Material = { ramp: ramp('#07050c', '#120d20', '#1e1636', '#2e2450', '#4a3c78', '#7a68b0'), outline: hex('#030206'), outlineLit: hex('#14102a'), shine: true };
const SHARD_VEIN: Material = { ramp: ramp('#c03aa0', '#ff8ad8', '#fff0fa'), outline: hex('#2a0820'), emissive: 0.95, noAO: true };

/** A spire of obsidian standing up out of the platform, a vein of the rift's light running up it. */
export function riftShard(v: number): PixelCanvas {
  const c = new PixelCanvas(SHARD_W, SHARD_H);
  const lean = [1.5, -1.2, 0.8, -2][v % 4];
  const top = [4, 7, 5, 9][v % 4];
  const base = SHARD_OY;
  const cx = SHARD_W / 2;
  c.part();
  c.shape(top, base, (y) => {
    const u = (y - top) / (base - top);
    const hw = 0.6 + 4.6 * Math.pow(u, 0.7);
    const x = cx + lean * (1 - u);
    return [x - hw, x + hw];
  }, SHARD_M, (_x, _y, t, u) => {
    // Two facets: the left one catches the light.
    const f = t < -0.1 ? -0.7 : t > 0.35 ? 0.75 : 0.1;
    return { x: f, y: 0.35 - u * 0.2, z: 0.75 };
  });
  // A smaller shard leaning against its foot.
  c.part();
  c.shape(base - 9, base, (y) => {
    const u = (y - base + 9) / 9;
    const hw = 0.4 + 2.2 * u;
    const x = cx + 4.5 + (1 - u) * 1.5;
    return [x - hw, x + hw];
  }, SHARD_M, (_x, _y, t) => ({ x: t * 0.8, y: 0.3, z: 0.8 }));
  // The vein, zigzagging up the face.
  c.part();
  for (let y = base - 2; y > top + 3; y--) {
    const u = (y - top) / (base - top);
    const x = cx + lean * (1 - u) + (Math.floor(y / 3) % 2 ? 0.5 : -0.8);
    c.px(x, y, SHARD_VEIN, sphere(0, 0));
  }
  c.part();
  c.ellipse(cx, base + 0.5, 5.5, 1.4, SHARD_M, { normal: () => ({ x: 0, y: 0.8, z: 0.6 }) });
  return c;
}

// ---------------------------------------------------------------- Blessings

export type BlessingIcon = 'might' | 'swift' | 'vigor' | 'fang' | 'ward' | 'renew' | 'surge' | 'fortune';

type Tones4 = [RGB, RGB, RGB, RGB];
const TONES: Record<BlessingIcon, Tones4> = {
  might: [hex('#fff4e8'), hex('#ffb070'), hex('#f06a3a'), hex('#8a2a1a')],
  swift: [hex('#f0fff8'), hex('#a8ffd8'), hex('#4ae0a0'), hex('#1a7a5a')],
  vigor: [hex('#fff0f2'), hex('#ff9aa8'), hex('#f04a5a'), hex('#8a1a2a')],
  fang: [hex('#fff0f0'), hex('#ff7a7a'), hex('#c82a3a'), hex('#5a0a1a')],
  ward: [hex('#f0f8ff'), hex('#a8d0ff'), hex('#4a8ae0'), hex('#1a3a8a')],
  renew: [hex('#f6ffe0'), hex('#d8ff8a'), hex('#7ee05a'), hex('#2e8a4a')],
  surge: [hex('#fffbe8'), hex('#ffe68a'), hex('#f0b030'), hex('#8a5a18')],
  fortune: [hex('#f2fdff'), hex('#9ff6ff'), hex('#5ae8ff'), hex('#ff7ae6')],
};

/** A blessing's colour, for its card and its name. */
export const BLESSING_TINT: Record<BlessingIcon, number> = Object.fromEntries(
  Object.entries(TONES).map(([k, t]) => [k, (t[1][0] << 16) | (t[1][1] << 8) | t[1][2]]),
) as Record<BlessingIcon, number>;

/** A 16x16 icon for a blessing, in its own colours. */
export function blessingIcon(kind: BlessingIcon): Uint8ClampedArray {
  const k = TONES[kind];
  const disc = (put: Put, cx: number, cy: number, r: number, c: RGB) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) put(x, y, c);
  };
  return icon16((put) => {
    switch (kind) {
      case 'might':
        // A sword, point up, flames at its hilt.
        for (let y = 1; y <= 10; y++) {
          put(7, y, k[0]);
          put(8, y, k[1]);
        }
        seg(put, 4, 11, 11, 11, k[2]);
        put(7, 12, k[3]);
        put(8, 13, k[3]);
        put(7, 14, k[2]);
        for (const [x, y] of [[3, 9], [12, 9], [2, 12], [13, 12]]) put(x, y, k[2]);
        break;
      case 'swift':
        // A wing, swept back.
        for (let i = 0; i < 5; i++) seg(put, 3 + i * 2, 12 - i, 14 - i, 3 + i * 0.5, i < 2 ? k[0] : i < 4 ? k[1] : k[2]);
        seg(put, 1, 13, 5, 13, k[3]);
        break;
      case 'vigor':
        // A heart.
        disc(put, 5.5, 6, 3, k[1]);
        disc(put, 10.5, 6, 3, k[1]);
        for (let y = 6; y <= 13; y++) {
          const hw = Math.max(0, 7 - (y - 6));
          for (let x = 8 - hw; x < 8 + hw; x++) put(x, y, k[1]);
        }
        put(5, 5, k[0]);
        put(6, 4, k[0]);
        break;
      case 'fang':
        // A fang, a drop of blood at its tip.
        for (let y = 1; y <= 10; y++) {
          const hw = Math.max(0, 3 - y * 0.28);
          for (let x = Math.round(8 - hw); x <= Math.round(8 + hw - 1); x++) put(x, y, y < 4 ? k[0] : k[1]);
        }
        disc(put, 8, 13, 1.8, k[2]);
        put(7, 12, k[1]);
        break;
      case 'ward':
        // A shield with a bright boss.
        for (let y = 2; y <= 14; y++) {
          const hw = y < 9 ? 6 : 6 - (y - 9) * 1.2;
          for (let x = Math.round(8 - hw); x < Math.round(8 + hw); x++) put(x, y, y === 2 || Math.abs(x + 0.5 - 8) > hw - 1.2 ? k[1] : k[3]);
        }
        disc(put, 8, 7.5, 1.8, k[0]);
        break;
      case 'renew':
        // A leaf and a sprouting curl.
        for (let y = 2; y <= 12; y++) {
          const t = (y - 2) / 10;
          const hw = Math.sin(t * Math.PI) * 4;
          for (let x = Math.round(8 - hw); x < Math.round(8 + hw); x++) put(x, y, Math.abs(x + 0.5 - 8) < 0.8 ? k[0] : k[2]);
        }
        seg(put, 8, 12, 8, 15, k[3]);
        break;
      case 'surge':
        // A bolt through a star.
        for (const [x0, y0, x1, y1] of [[10, 1, 5, 8], [5, 8, 10, 8], [10, 8, 6, 15]]) seg(put, x0, y0, x1, y1, k[0]);
        seg(put, 11, 1, 6, 8, k[1]);
        seg(put, 11, 8, 7, 15, k[1]);
        for (const [x, y] of [[2, 3], [13, 11], [3, 13], [13, 4]]) put(x, y, k[2]);
        break;
      case 'fortune':
        // A cut gem.
        for (let y = 3; y <= 13; y++) {
          const hw = y < 7 ? 2 + (y - 3) * 1.2 : 7 - (y - 7) * 1.1;
          for (let x = Math.round(8 - hw); x < Math.round(8 + hw); x++) put(x, y, y < 7 ? k[0] : x < 8 ? k[1] : k[2]);
        }
        put(3, 2, k[3]);
        put(13, 5, k[0]);
        break;
    }
  });
}
