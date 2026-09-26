// The home screen's Sky Arena: a marble arena on a floating island above a
// sea of clouds, at golden sunset. The sun sinks low on the left over a
// range of far peaks, so the arena's columns and blossom tree throw long
// shadows across the warm stone, clouds burn gold and rose on their sunward
// sides and sink into violet shade, and waterfalls spill off the island's
// edge into the cloud sea.
//
// Pieces are painted separately so the home scene can move them: a sky for
// the view size, three cloud strips that tile horizontally (far, middle and a
// near one in front of the island), the island itself, a few small islets,
// a waterfall strip, sun rays, a bird and a petal.

import { hex, type RGB } from './pixel';
import { rng } from './env';
import { Bitmap, bayer, clamp01, mix } from './bitmap';

const ramp = (...c: string[]) => c.map(hex);

const MARBLE = 1;
const GOLD = 2;
const ROCK = 3;
const GRASS = 4;
const BLOSSOM = 5;
const BARK = 6;
const CRYSTAL = 7;
const WATER = 8;
const CLOTH = 9;

const RAMPS: RGB[][] = [
  [],
  ramp('#3a2436', '#57374a', '#7a4e58', '#a06a66', '#c48c78', '#e0ae8e', '#f4cea6', '#ffe8c4'),
  ramp('#4a2a14', '#7a4a1c', '#a87028', '#d49a38', '#f0c452', '#ffe08a', '#fff4c8'),
  ramp('#241c2e', '#35283c', '#4a3646', '#62464e', '#7e5a58', '#9c7466', '#bf9478', '#e0b892'),
  ramp('#1e3228', '#27482e', '#356232', '#4f7e34', '#72983a', '#9cb044', '#c8c458', '#f0dc7c'),
  ramp('#6e3a5c', '#9a4f72', '#c2708c', '#e095a8', '#f4b9c4', '#ffd9de', '#fff0f0'),
  ramp('#2a1a20', '#3e2628', '#5a3830', '#7a4e3a', '#9c6848', '#be8a5e'),
  ramp('#1c3a6a', '#2a64a0', '#44a0d0', '#7ad6ec', '#c4f4ff', '#ffffff'),
  ramp('#4a5a98', '#7a86b8', '#d0a8b0', '#f8d4b8', '#fff0dc'),
  ramp('#3a0e1c', '#62182a', '#8e2434', '#bc3a3c', '#e0624a', '#ff9a6a'),
];

const CLOUD = ramp('#3e2a5a', '#553566', '#6e4270', '#8a5276', '#a86478', '#c87c78', '#e49a7a', '#f6b880', '#ffd49a', '#ffeabc');
const SKY = ramp('#1e1a4a', '#2c2260', '#442a72', '#62307a', '#86387c', '#a8467a', '#c85a72', '#e27468', '#f29060', '#fbb060', '#ffd07a', '#ffe8a8');
/** Where the cloud sea meets the sky, as a fraction of the view height. */
export const HORIZON = 0.6;

function hash(i: number, s: number): number {
  let h = (i * 374761393 + s * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** Smooth 1D value noise, repeating every `period` cells (0 for never). */
function noise(x: number, s: number, period = 0): number {
  const i = Math.floor(x);
  const t = x - i;
  const u = t * t * (3 - 2 * t);
  const k = (n: number) => (period ? ((n % period) + period) % period : n);
  const a = hash(k(i), s);
  return a + (hash(k(i + 1), s) - a) * u;
}

const pick = (rp: RGB[], l: number, x: number, y: number): RGB =>
  rp[Math.max(0, Math.min(rp.length - 1, Math.floor(l * (rp.length - 1) + bayer(x, y) * 0.55 + 0.22)))];

/** The sun's place in the view. */
export const sunAt = (w: number, h: number) => ({ x: Math.round(w * 0.22), y: Math.round(h * 0.4) });

/** A far floating island, hazed into the sky; `temple` crowns it with a domed shrine. */
function farIsland(w: number, h: number, fx: number, fy: number, fs: number, seed: number, temple: boolean) {
  const cx = Math.round(w * fx);
  const cy = Math.round(h * fy);
  const s = Math.max(8, Math.round(w * fs));
  const haze = 0.55;
  const rock = [hex('#9a6a86'), hex('#7a5074'), hex('#5e3c62')];
  const grass = hex('#b0a060');
  const stone = hex('#ffd8b8');
  /** Colour at (x, y) or null; `sky` is the colour behind. */
  return (x: number, y: number, sky: RGB): RGB | null => {
    const u = (x + 0.5 - cx) / s;
    if (Math.abs(u) > 1.2) return null;
    const au = Math.abs(u);
    if (au <= 1) {
      const topY = cy - s * 0.08 * Math.sqrt(1 - u * u) - (noise(x / 3, seed) > 0.55 ? noise(x / 2, seed + 1) * s * 0.12 : 0);
      const botY = cy + s * 0.75 * (1 - au ** 1.3) ** 1.2 * (0.7 + 0.3 * noise(u * 5, seed + 2));
      if (y >= topY && y <= botY) {
        const c = y < cy + 1 ? grass : rock[u < -0.3 ? 0 : u < 0.3 ? 1 : 2];
        return mix(c, sky, haze);
      }
      // A thin waterfall from its underside.
      if (Math.abs(u - 0.25) < 0.5 / s && y > botY && y < botY + s * 0.6) return mix(hex('#ffe4c4'), sky, 0.5 + 0.5 * ((y - botY) / (s * 0.6)));
    }
    if (!temple) return null;
    // The shrine: a colonnade under a dome and a gold spire.
    const tw = s * 0.34;
    const base = cy - s * 0.08;
    const colTop = base - s * 0.22;
    if (Math.abs(x + 0.5 - cx) <= tw && y < base && y >= colTop) {
      const k = Math.floor((x - (cx - tw)) / 2);
      if (y < colTop + 2 || k % 2 === 0) return mix(stone, sky, haze * 0.8);
      return null;
    }
    const dr = tw * 0.8;
    const dd = Math.hypot(x + 0.5 - cx, (y + 0.5 - colTop) * 1.3);
    if (y < colTop && dd <= dr) return mix(x < cx ? stone : hex('#c49aa8'), sky, haze * 0.8);
    if (Math.abs(x + 0.5 - cx) < 1 && y < colTop - dr / 1.3 && y > colTop - dr / 1.3 - s * 0.14) return mix(hex('#ffe08a'), sky, 0.3);
    return null;
  };
}

/** Ridged noise: sharp crests where smooth noise crosses its middle. */
const ridged = (x: number, s: number) => 1 - Math.abs(noise(x, s) * 2 - 1);

interface Range {
  /** Height above the horizon per column. */
  top: Float32Array;
  /** Height where snow starts. */
  snow: number;
  shadow: RGB;
  lit: RGB;
  snowShadow: RGB;
  snowLit: RGB;
  /** How far it fades into the sky. */
  haze: number;
}

/** A mountain range along the horizon, `amp` px tall at its highest. */
function range(w: number, amp: number, seed: number, cols: string[], haze: number): Range {
  const top = new Float32Array(w + 2);
  for (let x = -1; x <= w; x++) {
    const env = 0.35 + 0.65 * noise(x / (w * 0.22), seed);
    const ridge = 0.6 * ridged(x / (w * 0.07), seed + 1) + 0.28 * ridged(x / (w * 0.028), seed + 2) + 0.12 * ridged(x / 5, seed + 3);
    top[x + 1] = amp * env * ridge;
  }
  const [shadow, lit, snowShadow, snowLit] = cols.map(hex);
  return { top, snow: amp * 0.55, shadow, lit, snowShadow, snowLit, haze };
}

/**
 * The sky for a `w` x `h` view at sunset: deep violet overhead burning to
 * rose, orange and gold at the horizon, high cirrus lit pink from below, far
 * snowy peaks with their sunward faces aflame, floating islands in the haze
 * and the sun sinking toward the peaks on the left, blooming out over
 * everything near it.
 */
export function paintSky(w: number, h: number): Bitmap {
  const out = new Bitmap(w, h);
  const hy = Math.round(h * HORIZON);
  const sun = sunAt(w, h);
  const R = 11;
  const n = SKY.length - 1;
  const cirrus = [0.08, 0.17, 0.28].map((f, i) => ({ y: h * f, th: 2 + i, seed: 80 + i }));
  const islands = [
    farIsland(w, h, 0.74, 0.42, 0.085, 91, true),
    farIsland(w, h, 0.05, 0.47, 0.035, 92, false),
    farIsland(w, h, 0.95, 0.5, 0.028, 93, false),
    farIsland(w, h, 0.4, 0.49, 0.022, 94, false),
  ];
  const ranges = [
    range(w, h * 0.25, 70, ['#8a4a7a', '#e8889a', '#c48aa8', '#ffe0c0'], 0.4),
    range(w, h * 0.15, 74, ['#4e2c5c', '#b45a72', '#8a5a82', '#ffc8a0'], 0.12),
  ];
  const warm = hex('#ffd890');
  const pink = hex('#ff8a86');
  const gold = hex('#ffd08a');
  for (let y = 0; y < h; y++) {
    const t = clamp01(1 - (hy - y) / (hy * 0.95));
    for (let x = 0; x < w; x++) {
      let c: RGB;
      let solid = false;
      if (y >= hy) c = CLOUD[4];
      else {
        const f = t ** 1.5 * n;
        const i = Math.floor(f);
        const fr = clamp01((f - i - 0.5) * 2.6 + 0.5);
        c = SKY[Math.min(n, i + (fr > bayer(x, y) ? 1 : 0))];
        const nearSun = Math.exp(-(((x - sun.x) / (w * 0.35)) ** 2));
        for (const ci of cirrus) {
          const yy = ci.y + x * 0.04 + (noise(x / 50, ci.seed) - 0.5) * 10;
          const band = Math.exp(-(((y - yy) / ci.th) ** 2));
          const k = band * clamp01((noise(x / 38, ci.seed + 5) * noise(x / 7 + y * 0.5, ci.seed + 6) - 0.2) * 2.2);
          const q = Math.floor(k * 3 + bayer(x, y)) / 3;
          if (q > 0) c = mix(c, mix(pink, gold, nearSun), q * 0.6);
        }
        // The horizon burns brightest under the sun.
        const hg = Math.exp(-(((x - sun.x) / (w * 0.35)) ** 2)) * clamp01(1 - (hy - y) / (h * 0.25));
        const hq = Math.floor(hg * 4 + bayer(x, y)) / 4;
        if (hq > 0) c = mix(c, warm, hq * 0.6);
        const sky = c;
        // Peaks, far range first; the nearer one covers it.
        for (const rg of ranges) {
          const H = rg.top[x + 1];
          const top = hy - H;
          if (y < top) continue;
          solid = true;
          // Faces rising toward the right look back at the sun on the left.
          const slope = rg.top[x + 2] - rg.top[x];
          const litK = clamp01(slope * 0.8 + 0.5 + (noise(x / 3 + y / 4, 77) - 0.5) * 0.5);
          const lq = Math.floor(litK * 3 + bayer(x, y)) / 3;
          const snowLine = hy - rg.snow - (noise(x / 4, 78) - 0.5) * 4;
          const snowy = y < snowLine;
          let m = mix(snowy ? rg.snowShadow : rg.shadow, snowy ? rg.snowLit : rg.lit, lq);
          // The crest catches a rim of sunlight.
          if (y - top < 1 && slope > -0.3) m = mix(m, warm, 0.5);
          // Mist gathers at the feet.
          const mist = clamp01((y - top) / Math.max(4, H) - 0.35) * 0.9;
          c = mix(mix(m, sky, rg.haze), sky, Math.floor(mist * 4 + bayer(x, y)) / 4 * 0.7);
        }
        for (const isl of islands) {
          const ic = isl(x, y, c);
          if (ic) {
            c = ic;
            solid = true;
            break;
          }
        }
      }
      const d = Math.hypot(x + 0.5 - sun.x, y + 0.5 - sun.y);
      if (d <= R) {
        // The sun sits behind the peaks.
        if (!solid) c = d > R - 1 ? hex('#ffe0a0') : d > R - 3 ? hex('#fff2c8') : hex('#fffbe8');
      } else {
        const g = clamp01(1 - (d - R) / (R * 6)) ** 1.5;
        const q = Math.floor(g * 6 + bayer(x, y)) / 6;
        if (q > 0) c = mix(c, hex('#ffc070'), q * (solid ? 0.5 : 0.9));
      }
      out.set(x, y, c);
    }
  }
  // Baked in so the home screen draws fewer full-screen layers: the far
  // cloud bank (it drifts too slowly to miss), then the sun's rays and a wide
  // bloom added over sky and clouds alike.
  const far = CLOUD_LAYERS[0];
  const fb = cloudStrip(far);
  const top = hy - far.base;
  for (let y = Math.max(0, top); y < Math.min(h, top + far.h); y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y - top) * CLOUD_W + (x % CLOUD_W)) * 4;
      if (!fb.data[i + 3]) continue;
      out.set(x, y, [fb.data[i], fb.data[i + 1], fb.data[i + 2]]);
    }
  }
  const rays = godRays(w, h, 61);
  const bloom = hex('#ff9c50');
  const bw = w * 0.55;
  const bh = h * 0.5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const g = clamp01(1 - Math.hypot((x + 0.5 - sun.x) / bw, (y + 0.5 - sun.y) / bh)) ** 2 * 0.24;
      const q = Math.floor(g * 8 + bayer(x, y)) / 8;
      for (let k = 0; k < 3; k++) out.data[i + k] = Math.min(255, out.data[i + k] + rays.data[i + k] + bloom[k] * q);
    }
  }
  return out;
}

/**
 * Crepuscular rays fanning out from the sun across the whole view, for
 * additive blending over the sky and clouds.
 */
export function godRays(w: number, h: number, seed: number): Bitmap {
  const out = new Bitmap(w, h);
  const s = sunAt(w, h);
  const col = hex('#ffc890');
  const reach = Math.hypot(w, h) * 0.8;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - s.x;
      const dy = y + 0.5 - s.y;
      const d = Math.hypot(dx, dy);
      if (d < 8) continue;
      const a = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
      const n = noise(a * 72, seed, 72) * 0.65 + noise(a * 18, seed + 1, 18) * 0.35;
      const ray = clamp01((n - 0.5) / 0.22);
      const fall = clamp01(1 - d / reach) ** 1.6 * clamp01((d - 8) / 24);
      // Rays reaching down across the scene read strongest.
      const dir = 0.45 + 0.55 * Math.max(0, dy / d);
      const q = Math.floor(ray * fall * dir * 5 + bayer(x, y)) / 5;
      if (q > 0) out.set(x, y, mix([0, 0, 0], col, q * 0.28));
    }
  }
  return out;
}

/** A faint rainbow arc of radius `r`, for additive blending in waterfall mist. */
export function rainbow(r: number): Bitmap {
  const bands = ramp('#ff5a5a', '#ffa04a', '#ffe45a', '#6ade6a', '#5aa8ff', '#9a6aff');
  const W = r * 2 + 2;
  const H = r + 2;
  const out = new Bitmap(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x + 0.5 - W / 2, y + 0.5 - H);
      const k = Math.floor(r - d);
      if (k < 0 || k >= bands.length) continue;
      // Fades toward both feet.
      const up = clamp01((H - y) / (r * 0.8));
      const a = 0.28 * up;
      const q = Math.floor(a * 6 + bayer(x, y) * 0.9) / 6;
      if (q > 0) out.set(x, y, mix([0, 0, 0], bands[k], q));
    }
  }
  return out;
}

export const CLOUD_W = 512;

interface CloudLayer {
  h: number;
  /** Row where the solid cloud sea starts; puffs rise above it. */
  base: number;
  rMin: number;
  rMax: number;
  /** How much the layer fades into the horizon's haze. */
  haze: number;
  seed: number;
}

export const CLOUD_LAYERS: CloudLayer[] = [
  { h: 110, base: 26, rMin: 4, rMax: 10, haze: 0.45, seed: 3 },
  { h: 150, base: 40, rMin: 7, rMax: 18, haze: 0.2, seed: 5 },
  { h: 170, base: 58, rMin: 12, rMax: 30, haze: 0, seed: 9 },
];

/** A strip of cumulus that tiles every CLOUD_W px, lit from the upper left. */
export function cloudStrip(L: CloudLayer): Bitmap {
  const out = new Bitmap(CLOUD_W, L.h);
  const r = rng(L.seed);
  const puffs: { x: number; y: number; r: number }[] = [];
  // Dome-shaped masses: a row of puffs, tallest in the middle, with billows on top.
  for (let x = 0; x < CLOUD_W - L.rMin; ) {
    const big = noise((x / CLOUD_W) * 8, L.seed, 8);
    const mr = L.rMin + (L.rMax - L.rMin) * (0.25 + 0.75 * big) * (0.75 + r() * 0.35);
    const n = 3 + Math.floor(r() * 4);
    for (let j = 0; j < n; j++) {
      const k = Math.sin((Math.PI * (j + 0.5)) / n);
      const pr = mr * (0.45 + 0.55 * k) * (0.8 + r() * 0.35);
      const px = x + j * mr * 0.62 + (r() - 0.5) * mr * 0.2;
      const py = L.base - pr * 0.35 + (r() - 0.5) * mr * 0.15;
      puffs.push({ x: px, y: py, r: pr });
      if (k > 0.6 && r() < 0.8) {
        const tr = pr * (0.5 + r() * 0.25);
        puffs.push({ x: px + (r() - 0.5) * pr * 0.6, y: py - pr * (0.5 + r() * 0.3), r: tr });
        if (r() < 0.4) puffs.push({ x: px + (r() - 0.5) * tr, y: py - pr * 0.6 - tr * 0.7, r: tr * 0.6 });
      }
    }
    x += n * mr * 0.62 + r() * mr * 0.6;
  }
  puffs.sort((a, b) => a.y - b.y);
  const lx = -0.78;
  const ly = -0.42;
  const lz = 0.46;
  const horizon = hex('#f0a07e');
  const cell = new Float32Array(CLOUD_W * L.h).fill(-1);
  for (const p of puffs) {
    for (let y = Math.floor(p.y - p.r); y <= p.y + p.r; y++) {
      if (y < 0 || y >= L.h) continue;
      for (let xi = Math.floor(p.x - p.r); xi <= p.x + p.r; xi++) {
        const nx = (xi + 0.5 - p.x) / p.r;
        const ny = (y + 0.5 - p.y) / (p.r * 0.85);
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        const nz = Math.sqrt(1 - d);
        let lam = clamp01(lx * nx + ly * ny + lz * nz);
        // Silver lining where the edge faces the sun.
        if (nz < 0.35 && lx * nx + ly * ny > 0.3) lam += 0.25;
        cell[y * CLOUD_W + (((xi % CLOUD_W) + CLOUD_W) % CLOUD_W)] = 0.04 + lam * 0.98;
      }
    }
  }
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < CLOUD_W; x++) {
      let l = cell[y * CLOUD_W + x];
      const sea = L.base + (noise((x / CLOUD_W) * 32, L.seed + 1, 32) - 0.5) * 4;
      if (l < 0) {
        if (y < sea) continue;
        l = 0.34 - (y - sea) * 0.0045 + (noise((x / CLOUD_W) * 64 + y * 0.3, L.seed + 2, 64) - 0.5) * 0.08;
      }
      let c = pick(CLOUD, l, x, y);
      if (L.haze) c = mix(c, horizon, L.haze);
      out.set(x, y, c);
    }
  }
  return out;
}

/** A tileable 8 x 32 strip of falling water. */
export function waterfall(): Bitmap {
  const W = 8;
  const H = 32;
  const out = new Bitmap(W, H);
  const cols = ramp('#8a88b8', '#f0c8b0', '#fff0dc');
  // Brighter and denser down the middle of the fall.
  for (let x = 0; x < W; x++) {
    const edge = x === 0 || x === W - 1;
    for (let y = 0; y < H; y++) {
      const n = noise(y / 4 + x * 7.3, 40 + x, 8) + (x > 1 && x < W - 2 ? 0.12 : 0);
      const i = n > 0.62 ? 2 : n > 0.35 ? 1 : 0;
      out.set(x, y, cols[edge ? Math.max(0, i - 1) : i], edge ? 150 : 235);
    }
  }
  return out;
}

/** A distant bird: two 5 x 3 frames, wings up then down. */
export function birdSheet(): Bitmap {
  const b = new Bitmap(10, 3);
  const c = hex('#2a1a3a');
  for (const [x, y] of [[0, 0], [4, 0], [1, 1], [3, 1], [2, 2]]) b.set(x, y, c);
  for (const [x, y] of [[0, 1], [1, 1], [3, 1], [4, 1], [2, 2]]) b.set(5 + x, y, c);
  return b;
}

/** Two 2 x 2 blossom petals. */
export function petalSheet(): Bitmap {
  const b = new Bitmap(4, 2);
  const [a, l] = ramp('#f4b9c4', '#fff0f0');
  b.set(0, 0, l);
  b.set(1, 0, a);
  b.set(0, 1, a);
  b.set(2, 0, a);
  b.set(3, 1, l);
  b.set(2, 1, a);
  return b;
}

/** Per-pixel material and light, then one pass through the ramps. */
class Paint {
  readonly mat: Uint8Array;
  readonly lum: Float32Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.mat = new Uint8Array(w * h);
    this.lum = new Float32Array(w * h);
  }

  put(x: number, y: number, m: number, l: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.mat[y * this.w + x] = m;
    this.lum[y * this.w + x] = l;
  }

  at(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.mat[y * this.w + x];
  }

  /** Darken (x, y) if it holds material `m`. */
  shade(x: number, y: number, m: number, dl: number): void {
    if (this.at(x, y) === m) this.lum[y * this.w + x] += dl;
  }

  toBitmap(): Bitmap {
    const out = new Bitmap(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const m = this.mat[y * this.w + x];
        if (!m) continue;
        let l = this.lum[y * this.w + x];
        // Sky light catches every upper-left edge.
        if (m !== GOLD && (!this.at(x - 1, y) || !this.at(x, y - 1))) l += 0.1;
        out.set(x, y, pick(RAMPS[m], l, x, y));
      }
    }
    return out;
  }
}

/** A cumulus-like clump of leaves or blossom, lit from the upper left. */
function clump(p: Paint, m: number, cx: number, cy: number, r: number, base = 0.3): void {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const nx = (x + 0.5 - cx) / r;
      const ny = (y + 0.5 - cy) / r;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const lam = clamp01(-0.6 * nx - 0.65 * ny + 0.46 * Math.sqrt(1 - d));
      p.put(x, y, m, base + lam * 0.65);
    }
  }
}

export interface IslandArt {
  bmp: Bitmap;
  /** Centre of the arena floor within the bitmap. */
  cx: number;
  cy: number;
  /** Where waterfalls leave the island (top of each fall's left edge). */
  falls: { x: number; y: number }[];
  /** The blossom tree's canopy, for falling petals. */
  canopy: { x: number; y: number; w: number; h: number };
}

/** The floating arena island; `rx` is the arena floor's half-width. */
export function paintIsland(rx: number): IslandArt {
  const r = rng(17);
  const ry = Math.round(rx * 0.28);
  const thick = Math.max(4, Math.round(rx * 0.045));
  const lip = 3;
  const D = Math.round(rx * 0.85);
  const T = Math.round(rx * 0.82);
  const W = Math.round(rx * 2 + 30);
  const H = T + ry * 2 + thick + lip + D + 12;
  const cx = W / 2;
  const cy = T + ry;
  const p = new Paint(W, H);
  const floor = new Uint8Array(W * H);

  const front = (x: number) => {
    const u = (x + 0.5 - cx) / rx;
    return Math.abs(u) > 1 ? -1 : cy + ry * Math.sqrt(1 - u * u);
  };

  // --- Rock underside, soil lip and the platform's marble side. -------
  for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const u = (x + 0.5 - cx) / rx;
    const au = Math.abs(u);
    const edge = front(x);
    if (edge < 0) continue;
    const sideB = edge + thick;
    const lipB = sideB + lip;
    const depth = D * (1 - au ** 1.5) ** 1.3 * (0.72 + 0.28 * noise(u * 5 + 9, 23)) + (noise(x / 3, 24) > 0.72 ? 7 * (1 - au) : 0);
    const bottom = lipB + depth;
    for (let y = Math.floor(edge); y < bottom; y++) {
      if (y < sideB) {
        // Marble blocks with a gold band.
        const k = y - Math.floor(edge);
        let l = 0.5 - u * 0.2 - (x % 9 === 0 ? 0.08 : 0);
        if (k === Math.floor(thick / 2)) {
          p.put(x, y, GOLD, 0.45 - u * 0.2);
          continue;
        }
        if (k === 0) l += 0.12;
        p.put(x, y, MARBLE, l);
      } else if (y < lipB) {
        p.put(x, y, GRASS, 0.5 - u * 0.15 - (y - sideB) * 0.08);
      } else {
        const t = (y - lipB) / Math.max(1, D);
        const strata = noise((y + noise(x / 11, 25) * 7) / 4, 26) - 0.5;
        const l = 0.46 - u * 0.24 - t * 0.35 + strata * 0.12 + (hash(x * 131 + y, 27) < 0.04 ? -0.08 : 0);
        p.put(x, y, ROCK, l);
      }
    }
    // Grass hanging over the lip.
    if (r() < 0.6) {
      const len = 1 + Math.floor(r() * 4);
      for (let k = 0; k < len; k++) p.put(x, lipB + k, GRASS, 0.4 - u * 0.15 - k * 0.05);
    }
  }
  // Roots and vines dangling from under the lip.
  for (let i = 0; i < 16; i++) {
    const u = (r() - 0.5) * 1.6;
    let x = Math.round(cx + u * rx);
    const y0 = Math.round(front(x) + thick + lip);
    const len = 5 + r() * 14;
    const vine = r() < 0.5;
    for (let k = 0; k < len; k++) {
      if (r() < 0.25) x += r() < 0.5 ? -1 : 1;
      p.put(x, y0 + k, vine ? GRASS : BARK, (vine ? 0.36 : 0.3) - u * 0.1);
      if (vine && k % 3 === 2) p.put(x + 1, y0 + k, GRASS, 0.5);
    }
  }
  // Crystals growing out of the rock.
  for (let i = 0; i < 5; i++) {
    const u = (r() - 0.5) * 1.1;
    const x = Math.round(cx + u * rx);
    const y = Math.round(front(x) + thick + lip + 6 + r() * D * 0.35 * (1 - Math.abs(u)));
    if (p.at(x, y) !== ROCK) continue;
    const s = 2 + Math.floor(r() * 3);
    for (let k = 0; k < s * 2; k++) {
      const hw = Math.max(0, Math.round(s * 0.5 - Math.abs(k - s) * 0.5));
      for (let dx = -hw; dx <= hw; dx++) p.put(x + dx, y - k + s, CRYSTAL, 0.45 + (dx < 0 ? 0.25 : 0) + (k > s ? 0.1 : 0));
    }
  }
  // Springs where the waterfalls leave the rock.
  const falls: { x: number; y: number }[] = [];
  for (const u of [-0.5, 0.02, 0.4]) {
    const x = Math.round(cx + u * rx);
    const y = Math.round(front(x) + thick + lip + 1);
    for (let dx = -5; dx <= 5; dx++) for (let dy = -2; dy <= 1; dy++) if (Math.abs(dx) + Math.abs(dy) * 2 < 6) p.put(x + dx, y + dy, ROCK, 0.08);
    for (let dx = -3; dx <= 4; dx++) p.put(x + dx, y + 1, WATER, 0.6 + (dx === 0 || dx === 1 ? 0.3 : 0));
    falls.push({ x: x - 3, y: y + 2 });
  }

  // --- Arena floor. -----------------------------------------------------
  const grad = (u: number, v: number, rr: number) => Math.hypot(u / rx, v / ry) / Math.max(rr, 1e-6);
  const segAt = (x: number, y: number) => {
    const u = (x + 0.5 - cx) / rx;
    const v = (y + 0.5 - cy) / ry;
    const rr = Math.hypot(u, v);
    const a = Math.atan2(v, u) / (Math.PI * 2) + 0.5;
    const ring = rr < 0.34 ? -1 : rr < 0.62 ? Math.floor(rr / 0.14) : 10 + Math.floor(rr / 0.12);
    const seg = rr < 0.34 ? -1 : Math.floor(a * (rr < 0.62 ? 16 : 32));
    return ring * 100 + seg;
  };
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      const rr = Math.hypot(u, v);
      if (rr > 1) continue;
      floor[y * W + x] = 1;
      const dist = (rr - 1) / grad(u, v, rr);
      let m = MARBLE;
      // Polished marble: the sun's reflection blooms on the far left of the floor.
      const glint = Math.exp(-(((u + 0.42) / 0.38) ** 2) - ((v + 0.3) / 0.45) ** 2);
      let l = 0.76 + (hash(segAt(x, y) + 7, 28) - 0.5) * 0.05 - v * 0.04 + glint * 0.16;
      if (dist > -2) l = 0.92;
      else if (dist > -3) l = 0.5;
      else if (Math.abs(rr - 0.62) < 0.018 || Math.abs(rr - 0.34) < 0.016) {
        m = GOLD;
        l = 0.6;
      } else if (rr < 0.34) {
        const a = Math.atan2(v, u);
        const star = 0.3 * (0.35 + 0.65 * Math.abs(Math.cos(a * 4)) ** 10);
        if (rr < star) {
          m = GOLD;
          l = 0.55 + (Math.cos(a * 4) * Math.sin(a * 8) > 0 ? 0.12 : 0);
        } else l = 0.62;
      } else if (segAt(x, y) !== segAt(x - 1, y) || segAt(x, y) !== segAt(x, y - 1)) l -= 0.12;
      p.put(x, y, m, l);
    }
  }

  // --- Shadows: the sun is low on the left, so they reach right and toward us.
  const SX = 1;
  const SY = 0.3;
  const shadow = (x: number, y: number) => {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= H || !floor[y * W + x]) return;
    if (floor[y * W + x] === 2) return;
    floor[y * W + x] = 2;
    p.lum[y * W + x] -= 0.3;
  };

  // Columns around the rim, leaving the front open; some broken.
  const angles = [150, 176, 202, 228, 250, 290, 332, 358, 24];
  /** The two columns at the back carry a lintel: a gateway facing us. */
  const GATE = [4, 5];
  const cols = angles.map((deg, k) => {
    const a = (deg * Math.PI) / 180;
    const s = 0.85 + 0.15 * Math.sin(a);
    const hc = Math.round(rx * 0.28 * s * (!GATE.includes(k) && hash(k, 29) < 0.3 ? 0.45 + hash(k, 30) * 0.2 : 1));
    return { k, x: Math.round(cx + Math.cos(a) * rx * 0.9), y: Math.round(cy + Math.sin(a) * ry * 0.9), hc, cw: Math.max(3, Math.round(rx * 0.05 * s)) | 1, broken: hc < rx * 0.2 };
  });
  for (const c of cols) {
    const L = c.hc * 1.15;
    for (let k = 0; k < L; k++) {
      for (let dx = -Math.ceil(c.cw / 2); dx <= Math.floor(c.cw / 2); dx++) {
        for (const dy of [0, 0.5]) shadow(c.x + dx + k * SX, c.y + dy + k * SY);
      }
    }
  }
  // The blossom tree at the back right.
  const tx = Math.round(cx + rx * 0.4);
  const ty = Math.round(cy - ry * 0.6);
  const th = Math.round(rx * 0.22);
  const rc = rx * 0.2;
  const canopyY = ty - th - rc * 0.35;
  {
    const L = th + rc;
    const ox = tx + L * SX * 0.9;
    const oy = ty + L * SY * 0.9;
    for (let y = Math.floor(oy - rc * 0.45); y <= oy + rc * 0.45; y++) {
      for (let x = Math.floor(ox - rc * 1.2); x <= ox + rc * 1.2; x++) {
        const d = ((x + 0.5 - ox) / (rc * 1.2)) ** 2 + ((y + 0.5 - oy) / (rc * 0.45)) ** 2;
        // Dappled: sun flecks come through the blossom.
        if (d <= 1 && noise(x / 2.3 + y * 1.7, 31) < 0.72) shadow(x, y);
      }
    }
    for (let k = 0; k < th; k++) for (let dx = -1; dx <= 1; dx++) shadow(tx + dx + k * SX, ty + k * SY);
  }

  // Shrubs crowding the back of the rim, between the columns.
  for (let i = 0; i < 14; i++) {
    const deg = 192 + r() * 156;
    if (angles.some((a) => Math.abs(((a - deg + 540) % 360) - 180) < 7)) continue;
    const a = (deg * Math.PI) / 180;
    const br = rx * (0.022 + r() * 0.018);
    const bx = cx + Math.cos(a) * rx * 0.95;
    const by = cy + Math.sin(a) * ry * 0.95 - br * 0.4;
    // A few small leafy clumps rather than one ball.
    for (let j = 0; j < 3; j++) clump(p, GRASS, bx + (j - 1) * br * 0.9, by + (j === 1 ? -br * 0.4 : 0) + r() * br * 0.3, br * (j === 1 ? 1 : 0.75), 0.12);
    if (r() < 0.35) p.put(bx - br * 0.3, by - br, BLOSSOM, 0.9);
  }

  // Columns, back to front.
  const tree = { x: tx, y: ty, draw: true };
  const drawTree = () => {
    for (let k = 0; k <= th; k++) {
      const t = k / th;
      const bx = tx + Math.round(Math.sin(t * 2.2) * 2);
      const hw = Math.round(2 - t * 1.2);
      for (let dx = -hw; dx <= hw; dx++) p.put(bx + dx, ty - k, BARK, 0.5 - (dx + hw) * 0.12);
    }
    for (const s of [-1, 1]) {
      for (let k = 0; k < rc * 0.6; k++) p.put(tx + s * (1 + k * 0.8), ty - th * 0.7 - k * 0.6, BARK, 0.4);
    }
    const blobs: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < 15; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r());
      blobs.push({ x: tx + 2 + Math.cos(a) * d * rc * 1.05, y: canopyY + Math.sin(a) * d * rc * 0.6, r: rc * (0.32 + r() * 0.16) });
    }
    blobs.sort((a, b) => a.y - b.y);
    for (const b of blobs) clump(p, BLOSSOM, b.x, b.y, b.r, 0.26);
    // Bright single blooms on the sunny side.
    for (let i = 0; i < 26; i++) {
      const x = Math.round(tx - rc + r() * rc * 2);
      const y = Math.round(canopyY - rc * 0.6 + r() * rc * 1.2);
      if (p.at(x, y) === BLOSSOM && p.lum[y * W + x] > 0.55) p.put(x, y, BLOSSOM, 0.98);
    }
    for (let i = -4; i <= 4; i++) if (r() < 0.8) p.put(tx + i, ty + 1 - (r() < 0.4 ? 1 : 0), GRASS, 0.55);
  };
  const byDepth = [...cols.map((c) => ({ ...c, tree: false })), { ...tree, k: -1, hc: 0, cw: 0, broken: false, tree: true }].sort((a, b) => a.y - b.y);
  for (const c of byDepth) {
    if (c.tree) {
      drawTree();
      continue;
    }
    const hw = Math.floor(c.cw / 2);
    const x0 = c.x - hw;
    const x1 = c.x + hw;
    const top = c.y - c.hc;
    for (let y = top; y <= c.y + 1; y++) {
      let e = 0;
      if (y >= c.y - 1) e = 1;
      else if (!c.broken && y <= top + 2) e = y === top ? 2 : 1;
      for (let x = x0 - e; x <= x1 + e; x++) {
        const n = (x - (x0 - e)) / Math.max(1, x1 - x0 + 2 * e);
        let l = 0.9 - n * 0.55;
        if (!e && x > x0 && x < x1 && (x - x0) % 2 === 1) l -= 0.06;
        if (c.broken && y < top + 3 && hash(x * 7 + y, 32) < 0.5) continue;
        p.put(x, y, MARBLE, l);
      }
      if (!c.broken && y === top + 3) for (let x = x0; x <= x1; x++) p.put(x, y, GOLD, 0.7 - ((x - x0) / Math.max(1, x1 - x0)) * 0.4);
    }
    // A tuft of grass at the foot.
    for (let i = -hw - 2; i <= hw + 2; i++) if (r() < 0.45) p.put(c.x + i, c.y + 1, GRASS, 0.6);
    // Once both gate columns stand, lay the lintel across their capitals.
    if (c.k === GATE[1] || (c.k === GATE[0] && cols[GATE[1]].y < c.y)) {
      const a = cols[GATE[0]];
      const b = cols[GATE[1]];
      const ly = Math.min(a.y - a.hc, b.y - b.hc);
      const lx0 = Math.min(a.x, b.x) - Math.floor(a.cw / 2) - 3;
      const lx1 = Math.max(a.x, b.x) + Math.floor(b.cw / 2) + 3;
      for (let y = ly - 5; y < ly; y++) {
        for (let x = lx0; x <= lx1; x++) {
          const k = y - (ly - 5);
          if (k === 3) p.put(x, y, GOLD, 0.72 - ((x - lx0) / (lx1 - lx0)) * 0.3);
          else p.put(x, y, MARBLE, (k === 0 ? 0.95 : k === 4 ? 0.5 : 0.8) - ((x - lx0) / (lx1 - lx0)) * 0.25);
        }
      }
      // A gold crest in the middle.
      const mx = Math.round((lx0 + lx1) / 2);
      for (let k = 0; k < 4; k++) for (let dx = -k; dx <= k; dx++) p.put(mx + dx, ly - 9 + k, GOLD, 0.75 - k * 0.08 + (dx < 0 ? 0.1 : 0));
    }
  }

  // Wildflowers along the inside of the rim.
  const petals = [BLOSSOM, GOLD, CLOTH, MARBLE];
  for (let i = 0; i < rx * 1.6; i++) {
    const a = r() * Math.PI * 2;
    if (Math.sin(a) > 0.5 && Math.abs(Math.cos(a)) < 0.6) continue;
    const k = 0.86 + r() * 0.06;
    const x = Math.round(cx + Math.cos(a) * rx * k);
    const y = Math.round(cy + Math.sin(a) * ry * k);
    if (p.at(x, y) !== MARBLE || !floor[y * W + x]) continue;
    p.put(x, y, GRASS, 0.55);
    if (r() < 0.55) p.put(x, y - 1, petals[Math.floor(r() * petals.length)], 0.85);
    else p.put(x + (r() < 0.5 ? -1 : 1), y, GRASS, 0.7);
  }

  // Banners flanking the open front.
  for (const deg of [58, 122]) {
    const a = (deg * Math.PI) / 180;
    const bx = Math.round(cx + Math.cos(a) * rx * 0.97);
    const by = Math.round(cy + Math.sin(a) * ry * 0.97);
    const ph = Math.round(rx * 0.3);
    for (let k = 0; k < ph; k++) {
      p.put(bx, by - k, GOLD, 0.62);
      p.put(bx + 1, by - k, GOLD, 0.35);
    }
    p.put(bx, by - ph, GOLD, 0.9);
    p.put(bx + 1, by - ph, GOLD, 0.7);
    const fw = Math.round(rx * 0.14);
    const fh = Math.round(rx * 0.1);
    for (let i = 1; i <= fw; i++) {
      const t = i / fw;
      const wave = Math.round(Math.sin(t * Math.PI * 1.5) * 1.5);
      const half = fh * (1 - t * 0.8);
      for (let j = 0; j < half; j++) {
        const y = by - ph + 2 + j + wave;
        p.put(bx + 1 + i, y, j === 0 || j >= half - 1 ? GOLD : CLOTH, j === 0 || j >= half - 1 ? 0.6 : 0.5 + (wave > 0 ? -0.12 : 0.1));
      }
    }
  }

  return {
    bmp: p.toBitmap(),
    cx,
    cy,
    falls,
    canopy: { x: tx + 2 - rc, y: canopyY - rc * 0.6, w: rc * 2, h: rc * 1.2 },
  };
}

/** A small floating islet of grass and rock, `s` px wide. */
export function paintIslet(s: number, seed: number): Bitmap {
  const r = rng(seed);
  const W = s + 4;
  const H = Math.round(s * 1.3) + 6;
  const p = new Paint(W, H);
  const cx = W / 2;
  const top = Math.round(s * 0.25);
  const ry = Math.max(2, Math.round(s * 0.16));
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5 - cx) / (s / 2);
    if (Math.abs(u) > 1) continue;
    const e = top + ry * Math.sqrt(1 - u * u);
    const depth = s * 0.9 * (1 - Math.abs(u) ** 1.4) * (0.7 + 0.3 * noise(u * 4, seed));
    for (let y = Math.floor(top - ry * Math.sqrt(1 - u * u)); y < e + 2 + depth; y++) {
      if (y < e) p.put(x, y, GRASS, 0.62 - u * 0.12);
      else if (y < e + 2) p.put(x, y, GRASS, 0.42 - u * 0.12);
      else p.put(x, y, ROCK, 0.46 - u * 0.24 - ((y - e) / (s * 0.9)) * 0.35);
    }
  }
  if (s >= 12) clump(p, r() < 0.5 ? GRASS : BLOSSOM, cx + (r() - 0.5) * s * 0.3, top - s * 0.12, s * 0.2, 0.3);
  return p.toBitmap();
}
