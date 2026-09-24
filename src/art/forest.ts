// The home screen's forest at dusk: a sky with a low sun, then strips of
// mountains, a pine ridge, forest, mist and foreground grass. Each strip is
// STRIP_W px wide and tiles seamlessly, so the home scene can scroll them at
// different speeds. The light comes from behind: silhouettes get a warm rim
// on their top edges, and haze thickens toward each layer's base.

import { hex, type RGB } from './pixel';
import { rng } from './env';
import { Bitmap, bayer, clamp01, mix } from './bitmap';

export const STRIP_W = 512;
export const STRIP_H = 256;
/** Where the sky meets the land, in art px above the bottom of the screen. */
export const HORIZON = 92;

function h1(i: number, s: number): number {
  let h = (i * 374761393 + s * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const wrap = (x: number) => ((x % STRIP_W) + STRIP_W) % STRIP_W;

/** Value noise that repeats every STRIP_W px (`scale` must divide it). */
function pnoise(x: number, scale: number, s: number): number {
  const cells = STRIP_W / scale;
  const f = x / scale;
  const i = Math.floor(f);
  const t = f - i;
  const u = t * t * (3 - 2 * t);
  const v = (k: number) => h1(((k % cells) + cells) % cells, s);
  return v(i) + (v(i + 1) - v(i)) * u;
}

/** 2D value noise, periodic in x only. */
function pnoise2(x: number, y: number, scale: number, s: number): number {
  const cells = STRIP_W / scale;
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const v = (i: number, j: number) => h1((((i % cells) + cells) % cells) + j * 4099, s);
  const a = v(x0, y0);
  const b = v(x0 + 1, y0);
  const c = v(x0, y0 + 1);
  const d = v(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Material ids per pixel; x wraps so shapes can cross the seam. */
class Mask {
  readonly m = new Uint8Array(STRIP_W * STRIP_H);

  set(x: number, y: number, v: number): void {
    y = Math.floor(y);
    if (y < 0 || y >= STRIP_H) return;
    this.m[y * STRIP_W + wrap(Math.floor(x))] = v;
  }

  get(x: number, y: number): number {
    if (y < 0) return 0;
    if (y >= STRIP_H) return 1;
    return this.m[y * STRIP_W + wrap(x)];
  }

  /** Fill from `top` down to the bottom of the strip. */
  column(x: number, top: number, v: number): void {
    for (let y = Math.max(0, Math.round(top)); y < STRIP_H; y++) this.set(x, y, v);
  }

  disc(cx: number, cy: number, r: number, v: number): void {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, v);
      }
    }
  }
}

interface Style {
  mats: Record<number, RGB>;
  /** Top edges, lit from behind. */
  rim: RGB;
  /** The row under the rim. */
  rim2?: RGB;
  /** Left and right edges. */
  side?: RGB;
  /** Materials that keep their own colour (flowers, mushrooms). */
  keep?: number[];
  /** Haze from row `from` (none) to row `to` (`max`), in strip rows. */
  fog?: { color: RGB; from: number; to: number; max: number };
}

function paint(mask: Mask, st: Style): Bitmap {
  const out = new Bitmap(STRIP_W, STRIP_H);
  for (let y = 0; y < STRIP_H; y++) {
    for (let x = 0; x < STRIP_W; x++) {
      const v = mask.get(x, y);
      if (!v) continue;
      let c = st.mats[v];
      if (!st.keep?.includes(v)) {
        if (!mask.get(x, y - 1)) c = st.rim;
        else if (st.rim2 && !mask.get(x, y - 2)) c = st.rim2;
        else if (st.side && (!mask.get(x - 1, y) || !mask.get(x + 1, y))) c = st.side;
        if (st.fog) {
          const f = clamp01((y - st.fog.from) / (st.fog.to - st.fog.from)) * st.fog.max;
          const q = Math.min(1, Math.floor(f * 4 + bayer(x, y)) / 4);
          if (q > 0) c = mix(c, st.fog.color, q);
        }
      }
      out.set(x, y, c);
    }
  }
  return out;
}

/** Row in the strip for a height above the bottom of the screen. */
const row = (above: number) => STRIP_H - Math.round(above);

interface PineOpts {
  /** Trunk height below the crown. */
  trunk?: number;
  /** Shaded tiers, lit tips and bark (big trees only). */
  detail?: boolean;
}

/** A layered pine standing on `base` (strip row), `h` tall and `w` wide. */
function pine(m: Mask, r: () => number, cx: number, base: number, h: number, w: number, o: PineOpts = {}): void {
  const trunk = Math.round(o.trunk ?? Math.max(1, h * 0.07));
  const crown = Math.round(h - trunk);
  const top = base - Math.round(h);
  const tiers = Math.max(2, Math.round(crown / (o.detail ? 11 : 7)));
  const ragged = w >= 9;
  const tw = Math.max(0, Math.round(w * 0.06));
  for (let y = base - trunk - 1; y <= base; y++) {
    for (let dx = -tw; dx <= tw; dx++) m.set(cx + dx, y, o.detail ? 4 : 1);
  }
  for (let i = 0; i <= crown; i++) {
    const k = i / crown; // 0 at the tip
    const t = (k * tiers) % 1; // position within the current tier
    const hw = (w / 2) * (0.08 + 0.92 * k) * (0.42 + 0.58 * t);
    const l = Math.round(cx - hw - (ragged && r() < 0.35 ? 1 : 0));
    const rr = Math.round(cx + hw + (ragged && r() < 0.35 ? 1 : 0));
    const y = top + i;
    for (let x = l; x <= rr; x++) {
      let v = 1;
      if (o.detail && i > 2) {
        const out = Math.abs(x - cx) / Math.max(1, hw);
        // Tier tips catch the light; right under a tier the needles sit in shade.
        if (t > 0.78 && out > 0.55) v = 3;
        else if (t < 0.22 && out < 0.7) v = 2;
      }
      m.set(x, y, v);
    }
  }
  m.set(cx, top - 1, 1);
}

/** A broadleaf tree: a flared trunk and a canopy of overlapping clumps. */
function oak(m: Mask, r: () => number, cx: number, base: number, h: number, w: number): void {
  const canopyY = base - h * 0.66;
  for (let y = Math.round(canopyY); y <= base; y++) {
    const k = (y - canopyY) / (base - canopyY);
    const hw = 1.6 + k * 1.2 + (y > base - 4 ? (y - (base - 4)) * 1.1 : 0);
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) m.set(x, y, 4);
  }
  // Two boughs.
  for (const s of [-1, 1]) {
    for (let i = 0; i < h * 0.22; i++) m.set(cx + s * (2 + i * 0.8), base - h * 0.42 - i, 4);
  }
  const clumps: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.8;
    clumps.push({ x: cx + Math.cos(a) * d * w * 0.4, y: canopyY + Math.sin(a) * d * h * 0.22, r: 6 + r() * w * 0.14 });
  }
  clumps.sort((a, b) => a.y - b.y);
  for (const c of clumps) {
    for (let y = Math.floor(c.y - c.r); y <= c.y + c.r; y++) {
      for (let x = Math.floor(c.x - c.r); x <= c.x + c.r; x++) {
        const dx = (x + 0.5 - c.x) / c.r;
        const dy = (y + 0.5 - c.y) / c.r;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        // The lower right of each clump turns into shade, outlining the clump above.
        m.set(x, y, dx * 0.6 + dy * 0.8 > 0.5 && d > 0.45 ? 2 : d < 0.3 && dy < 0 ? 3 : 1);
      }
    }
  }
}

function bush(m: Mask, r: () => number, cx: number, base: number, w: number): void {
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const rad = 3 + r() * w * 0.25;
    m.disc(cx + (r() - 0.5) * w * 0.7, base - rad * 0.6, rad, 1);
  }
}

/** A grass blade leaning `lean` px at its tip. */
function blade(m: Mask, x: number, base: number, len: number, lean: number, v = 1): void {
  for (let i = 0; i < len; i++) {
    const k = i / len;
    m.set(x + Math.round(lean * k * k), base - i, v);
  }
}

// ---------------------------------------------------------------------------
// Strips, far to near.

export function farMountains(): Bitmap {
  const m = new Mask();
  const shape = (x: number) => {
    const r1 = 1 - Math.abs(2 * pnoise(x, 128, 11) - 1);
    const r2 = 1 - Math.abs(2 * pnoise(x, 64, 12) - 1);
    return 100 + r1 * 40 + r2 * 13;
  };
  for (let x = 0; x < STRIP_W; x++) {
    const hb = shape(x) + pnoise(x, 16, 13) * 4 + pnoise(x, 8, 14) * 1.5;
    const top = row(hb);
    m.column(x, top, 1);
    // Faces falling away to the right catch the sun.
    if (shape(x + 3) < shape(x - 3)) {
      const depth = 5 + pnoise(x, 32, 15) * 24;
      for (let y = top; y < top + depth; y++) m.set(x, y, 2);
    }
    if (hb > 142) {
      const snow = (hb - 142) * 0.8 + pnoise(x, 8, 16) * 2;
      for (let y = top; y < top + snow; y++) m.set(x, y, 3);
    }
  }
  return paint(m, {
    mats: { 1: hex('#6c4585'), 2: hex('#8d5a93'), 3: hex('#e7afb6') },
    rim: hex('#ffc9a2'),
    fog: { color: hex('#f7a47f'), from: row(150), to: row(HORIZON - 4), max: 0.9 },
  });
}

export function ridge(): Bitmap {
  const m = new Mask();
  const r = rng(21);
  const hill = (x: number) => HORIZON - 12 + pnoise(x, 128, 21) * 14 + pnoise(x, 32, 22) * 5;
  for (let x = 0; x < STRIP_W; x++) m.column(x, row(hill(x)), 1);
  for (let x = 0; x < STRIP_W; x += 2 + Math.floor(r() * 5)) {
    pine(m, r, x, row(hill(x)) + 2, 5 + r() * 9, 3 + r() * 4);
  }
  return paint(m, {
    mats: { 1: hex('#523470') },
    rim: hex('#ee9294'),
    fog: { color: hex('#dc7a84'), from: row(HORIZON + 10), to: row(HORIZON - 40), max: 0.75 },
  });
}

export function midForest(): Bitmap {
  const m = new Mask();
  const r = rng(31);
  const ground = (x: number) => 44 + pnoise(x, 64, 31) * 8;
  for (let x = 0; x < STRIP_W; x++) m.column(x, row(ground(x)), 1);
  const trees: { x: number; h: number; w: number }[] = [];
  for (let x = 0; x < STRIP_W; ) {
    const dense = pnoise(x, 128, 32);
    const h = (24 + r() * 26) * (0.55 + dense * 0.7);
    trees.push({ x, h, w: h * 0.4 + r() * 4 });
    x += 5 + Math.floor(r() * 8) + (dense < 0.35 ? 12 : 0);
  }
  trees.sort((a, b) => b.h - a.h);
  for (const t of trees) pine(m, r, t.x, row(ground(t.x)) + 3, t.h, t.w, { detail: true });
  return paint(m, {
    mats: { 1: hex('#33224f'), 2: hex('#281a42'), 3: hex('#443065'), 4: hex('#2b1d45') },
    rim: hex('#ff9f7c'),
    rim2: hex('#8a4868'),
    side: hex('#4f2d5c'),
    fog: { color: hex('#a4527a'), from: row(62), to: row(18), max: 0.6 },
  });
}

export function nearForest(): Bitmap {
  const m = new Mask();
  const r = rng(41);
  const bank = (x: number) => 16 + pnoise(x, 64, 41) * 9 + pnoise(x, 16, 42) * 2;
  for (let x = 0; x < STRIP_W; x++) m.column(x, row(bank(x)), 1);
  const kinds = ['pine', 'oak', 'pine', 'pine'] as const;
  kinds.forEach((kind, k) => {
    const x = Math.round(24 + k * 128 + r() * 56);
    const base = row(bank(x)) + 4;
    if (kind === 'oak') oak(m, r, x, base, 104 + r() * 20, 76 + r() * 16);
    else pine(m, r, x, base, 122 + r() * 34, 44 + r() * 14, { detail: true, trunk: 16 + r() * 6 });
  });
  for (let i = 0; i < 7; i++) {
    const x = Math.round(r() * STRIP_W);
    bush(m, r, x, row(bank(x)) + 3, 16 + r() * 16);
  }
  return paint(m, {
    mats: { 1: hex('#1b1331'), 2: hex('#120c24'), 3: hex('#281c44'), 4: hex('#221633') },
    rim: hex('#ffb482'),
    rim2: hex('#9c4f6a'),
    side: hex('#35203f'),
  });
}

export function foreground(): Bitmap {
  const m = new Mask();
  const r = rng(51);
  const ground = (x: number) => 6 + pnoise(x, 32, 51) * 5;
  for (let x = 0; x < STRIP_W; x++) {
    m.column(x, row(ground(x)), 1);
    const clump = pnoise(x, 64, 52);
    if (r() < 0.35 + clump * 0.5) blade(m, x, row(ground(x)), 2 + r() * (3 + clump * 14), (r() - 0.5) * 5);
  }
  // Tufts of tall grass.
  for (let i = 0; i < 7; i++) {
    const x = Math.round(r() * STRIP_W);
    for (let j = 0; j < 7; j++) blade(m, x + j - 3, row(ground(x)) + 1, 12 + r() * 16, (j - 3) * 2.2 + (r() - 0.5) * 3);
  }
  // Flowers on thin stems: 5 = rose, 6 = pale.
  for (let i = 0; i < 12; i++) {
    const x = Math.round(r() * STRIP_W);
    const len = 8 + r() * 12;
    const top = row(ground(x)) - Math.round(len);
    blade(m, x, row(ground(x)), len, 0);
    const v = r() < 0.5 ? 5 : 6;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1], [0, 0]]) m.set(x + dx, top + dy, v);
  }
  // Glowing mushrooms: 7 = cap, 8 = its bright top.
  for (let i = 0; i < 4; i++) {
    const x0 = Math.round(r() * STRIP_W);
    for (let j = 0; j < 2 + Math.floor(r() * 2); j++) {
      const x = x0 + j * 5 + Math.floor(r() * 2);
      const base = row(ground(x)) + 1;
      const tall = 2 + Math.floor(r() * 3);
      for (let y = 0; y < tall; y++) m.set(x, base - y, 1);
      const w = j === 0 ? 2 : 1;
      for (let dx = -w; dx <= w; dx++) m.set(x + dx, base - tall, 7);
      for (let dx = -w + 1; dx <= w - 1; dx++) m.set(x + dx, base - tall - 1, 8);
    }
  }
  return paint(m, {
    mats: { 1: hex('#0c0a17'), 5: hex('#d8657f'), 6: hex('#f0d2c4'), 7: hex('#3fb8e0'), 8: hex('#b8f6ff') },
    rim: hex('#5c2c48'),
    keep: [5, 6, 7, 8],
  });
}

/** A band of drifting mist (translucent). */
export function mist(seed: number, color = hex('#f7b6a8')): Bitmap {
  const out = new Bitmap(STRIP_W, STRIP_H);
  for (let y = row(80); y < STRIP_H; y++) {
    for (let x = 0; x < STRIP_W; x++) {
      const center = row(40) + (pnoise(x, 64, seed) - 0.5) * 18;
      const d = Math.abs(y - center) / 13;
      const a = clamp01((1 - d) * (0.25 + 0.75 * pnoise2(x, y, 32, seed + 1))) * 0.5;
      const q = Math.floor(a * 6 + bayer(x, y)) / 6;
      if (q > 0) out.set(x, y, color, Math.round(q * 255));
    }
  }
  return out;
}

/** Long flat clouds, lit from below by the setting sun. */
export function clouds(): Bitmap {
  const out = new Bitmap(STRIP_W, STRIP_H);
  const r = rng(61);
  const ramp = ['#4a3470', '#6a4684', '#98598c', '#d77a88', '#ffb28e', '#ffdcaa'].map(hex);
  for (let k = 0; k < 7; k++) {
    const cx = k * 73 + r() * 40;
    const y0 = row(HORIZON + 34 + r() * 70);
    const w = 40 + r() * 70;
    const hgt = 6 + r() * 8;
    const count = Math.max(3, Math.round(w / 10));
    const puffs = Array.from({ length: count }, (_, i) => {
      const pr = hgt * (0.45 + 0.65 * Math.sin((Math.PI * (i + 0.5)) / count)) * (0.75 + r() * 0.4);
      return { x: cx - w / 2 + ((i + 0.5) * w) / count + (r() - 0.5) * 4, y: y0 - pr * 0.3, r: pr };
    });
    const inside = (x: number, y: number) =>
      y <= y0 &&
      puffs.some((p) => {
        let dx = x + 0.5 - p.x;
        dx -= Math.round(dx / STRIP_W) * STRIP_W;
        return dx * dx + ((y + 0.5 - p.y) * 1.25) ** 2 <= p.r * p.r;
      });
    for (let y = Math.floor(y0 - hgt * 1.6); y <= y0; y++) {
      for (let xi = Math.floor(cx - w / 2 - hgt); xi <= cx + w / 2 + hgt; xi++) {
        if (!inside(xi, y)) continue;
        const d = y0 - y;
        let c: RGB;
        if (d === 0) c = ramp[5];
        else if (d === 1) c = ramp[4];
        else {
          const f = clamp01(1 - (d - 2) / (hgt * 1.1));
          let i = Math.max(0, Math.min(3, Math.floor(f * 3.99 + (bayer(xi, y) - 0.5) * 0.9)));
          if (!inside(xi, y - 1)) i = Math.min(3, i + 1);
          c = ramp[i];
        }
        out.set(wrap(xi), y, c);
      }
    }
  }
  return out;
}

export const RAYS_W = 320;
export const RAYS_H = 200;

/** Sun rays fanning out from the centre, for additive blending. */
export function sunRays(seed: number): Bitmap {
  const out = new Bitmap(RAYS_W, RAYS_H);
  const ox = RAYS_W / 2;
  const oy = RAYS_H / 2;
  const col = hex('#ffcf9a');
  for (let y = 0; y < RAYS_H; y++) {
    for (let x = 0; x < RAYS_W; x++) {
      const dx = x + 0.5 - ox;
      const dy = y + 0.5 - oy;
      const d = Math.hypot(dx, dy);
      const a = ((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * STRIP_W;
      const n = pnoise(a, 16, seed) * 0.7 + pnoise(a, 64, seed + 1) * 0.3;
      const ray = clamp01((n - 0.5) / 0.25);
      const fall = clamp01(1 - d / (RAYS_H * 0.75)) ** 1.3 * clamp01((d - 8) / 12);
      const q = Math.floor(ray * fall * 4 + bayer(x, y)) / 4;
      out.set(x, y, mix([0, 0, 0], col, q * 0.5));
    }
  }
  return out;
}

const SKY = ['#130f2c', '#221a4a', '#3b2b68', '#613a84', '#9a4a88', '#d0617f', '#f18876', '#fbad78', '#ffd08e'].map(hex);

/**
 * The sky for a `w` x `h` view: a dithered dusk gradient that reaches its
 * brightest at the horizon, stars overhead, and the sun's disc and halo.
 */
export function paintSky(w: number, h: number, sunX: number, sunY: number, sunR: number): Bitmap {
  const out = new Bitmap(w, h);
  const horizon = h - HORIZON;
  const glow = hex('#ffdca6');
  const n = SKY.length - 1;
  for (let y = 0; y < h; y++) {
    const t = clamp01(1 - (horizon - y) / 170);
    for (let x = 0; x < w; x++) {
      const f = t * n;
      const i = Math.floor(f);
      // Dither only across the middle of each band, so bands stay clean.
      const fr = clamp01((f - i - 0.5) * 2.6 + 0.5);
      let c = SKY[Math.min(n, i + (fr > bayer(x, y) ? 1 : 0))];

      const d = Math.hypot(x + 0.5 - sunX, y + 0.5 - sunY);
      if (d <= sunR) {
        const k = clamp01((y + 0.5 - (sunY - sunR)) / (sunR * 2));
        c = d > sunR - 1 ? hex('#ffe7b2') : mix(hex('#fffbe9'), hex('#ffd889'), k);
      } else {
        const g = clamp01(1 - (d - sunR) / (sunR * 4.5)) ** 1.7 * 0.9;
        const q = Math.floor(g * 5 + bayer(x, y)) / 5;
        if (q > 0) c = mix(c, glow, q);
        if (t < 0.5) {
          const s = h1(x + y * 4099, 71);
          if (s > 0.9965) c = mix(c, s > 0.9992 ? [255, 255, 255] : hex('#c9cdf5'), 1 - t);
        }
      }
      out.set(x, y, c);
    }
  }
  return out;
}

/** 1px light mote and three 3x2 leaves (frames l0..l2), for particles. */
export function leafSheet(): Bitmap {
  const b = new Bitmap(9, 2);
  const cols = ['#ff9a6a', '#e0607a', '#ffc27a'].map(hex);
  cols.forEach((c, i) => {
    b.set(i * 3 + 1, 0, c);
    b.set(i * 3 + 2, 0, mix(c, [255, 255, 255], 0.35));
    b.set(i * 3, 1, mix(c, [40, 20, 40], 0.3));
    b.set(i * 3 + 1, 1, c);
  });
  return b;
}
