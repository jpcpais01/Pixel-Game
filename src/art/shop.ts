// Art for gems and the shop: cut gems in every size (inline icons, drops on
// the ground, little heaps of them), the Wish Crystal and its altar, the
// shop's hall, and the cards a wish turns over. All flat and unlit, painted
// pixel by pixel in the menus' style (see ui/widgets.ts).

import Phaser from 'phaser';
import { Bitmap, bayer, clamp01, mix } from './bitmap';
import { hex, type RGB } from './pixel';

// ---- Gems ----

const G_OUT = hex('#1a0a2e');
const G_SPEC = hex('#ffffff');
const G_TABLE = hex('#c8faff');
const G_CROWN_L = hex('#86ecff');
const G_CROWN_R = hex('#3ab8ec');
const G_PAV_L = hex('#3a8ee8');
const G_PAV_C = hex('#5a6af0');
const G_PAV_R = hex('#2a3aa8');
/** A glint of another colour where the light splits: the gem's prism. */
const G_PRISM = hex('#ff7ae6');

/** Paint one cut gem `w` wide (odd widths look best) with its top at (x0, y0); returns its height. */
function paintGem(b: Bitmap, x0: number, y0: number, w: number): number {
  const half = w / 2;
  const crown = Math.max(2, Math.round(w * 0.32));
  const pav = Math.max(3, Math.round(w * 0.58));
  const table = Math.max(1, half * 0.5);
  const cx = x0 + half;
  for (let y = 0; y < crown + pav; y++) {
    const inCrown = y < crown;
    const hw = inCrown ? table + (half - table) * (y / Math.max(1, crown - 1)) : half * (1 - (y - crown + 0.5) / pav);
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
      const dx = x + 0.5 - cx;
      if (Math.abs(dx) > hw) continue;
      let c: RGB;
      if (inCrown) {
        if (y === 0 || Math.abs(dx) < table * 0.7) c = G_TABLE;
        else c = dx < 0 ? G_CROWN_L : G_CROWN_R;
      } else {
        const t = dx / Math.max(0.5, hw);
        c = t < -0.35 ? G_PAV_L : t > 0.35 ? G_PAV_R : G_PAV_C;
        // The prism: a streak of rose down the left of the pavilion.
        if (t > -0.45 && t < -0.2 && y > crown + 1) c = G_PRISM;
      }
      b.set(x, y0 + y, c);
    }
  }
  // Specular glints on the table, and a hot one where crown meets girdle.
  b.set(Math.floor(cx - table * 0.6), y0, G_SPEC);
  if (w >= 9) b.set(Math.floor(cx - table * 0.6) + 1, y0 + 1, G_SPEC);
  b.set(Math.floor(cx - half + 1), y0 + crown - 1, G_SPEC);
  return crown + pav;
}

/** Ring every filled pixel of `b` in an outline. */
function outline(b: Bitmap, c: RGB = G_OUT): void {
  const out: [number, number][] = [];
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (b.alpha(x, y)) continue;
      if (b.alpha(x + 1, y) || b.alpha(x - 1, y) || b.alpha(x, y + 1) || b.alpha(x, y - 1)) out.push([x, y]);
    }
  }
  for (const [x, y] of out) b.set(x, y, c);
}

/** A single gem, outlined, `w` wide: 7 for inline text, 11 on buttons, 15 as a big icon. */
export function gemBitmap(w: number): Bitmap {
  const h = Math.max(2, Math.round(w * 0.32)) + Math.max(3, Math.round(w * 0.58));
  const b = new Bitmap(w + 2, h + 2);
  paintGem(b, 1, 1, w);
  outline(b);
  return b;
}

/** Drop sprites by how many gems fell: one, a few, a heap, a hoard. Width and height of each, feet at the bottom. */
export const GEM_DROPS = {
  one: { w: 11, h: 11 },
  few: { w: 17, h: 13 },
  heap: { w: 23, h: 17 },
  hoard: { w: 31, h: 22 },
} as const;
export type GemDrop = keyof typeof GEM_DROPS;

/** Which drop sprite `n` gems lie as. */
export const gemDropFor = (n: number): GemDrop => (n >= 10 ? 'hoard' : n >= 5 ? 'heap' : n >= 2 ? 'few' : 'one');

/** Gems in a pile: each [x, y, width], drawn back to front. */
const PILES: Record<GemDrop, [number, number, number][]> = {
  one: [[1, 1, 9]],
  few: [[1, 4, 7], [8, 4, 7], [4, 1, 9]],
  heap: [[1, 8, 7], [14, 8, 7], [4, 4, 7], [11, 4, 7], [7, 1, 9], [8, 9, 7]],
  hoard: [[1, 12, 7], [22, 12, 7], [5, 8, 7], [18, 8, 7], [8, 4, 9], [14, 4, 9], [11, 1, 9], [4, 13, 7], [11, 12, 9], [19, 13, 7]],
};

export function gemDrop(kind: GemDrop): Bitmap {
  const { w, h } = GEM_DROPS[kind];
  const b = new Bitmap(w, h);
  for (const [x, y, gw] of PILES[kind]) {
    // Each gem gets its own outline, so the heap reads as separate stones.
    const g = gemBitmap(gw);
    for (let py = 0; py < g.h; py++) {
      for (let px = 0; px < g.w; px++) {
        const i = (py * g.w + px) * 4;
        if (g.data[i + 3]) b.set(x - 1 + px, y - 1 + py, [g.data[i], g.data[i + 1], g.data[i + 2]]);
      }
    }
  }
  return b;
}

// ---- Small icons ----

/** A padlock, 7x9. */
export function lockBitmap(): Bitmap {
  const rows = ['..###..', '.#...#.', '.#...#.', '#######', '#ooXoo#', '#ooXoo#', '#ooooo#', '#######'];
  const b = new Bitmap(7, 8);
  const pal: Record<string, RGB> = { '#': hex('#2a2150'), o: hex('#c8b8ff'), X: hex('#2a2150') };
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && b.set(x, y, ch === '#' && y < 3 ? hex('#a898e0') : pal[ch])));
  return b;
}

/** A five-point star, 7x7, for rarity. */
export function starBitmap(): Bitmap {
  const rows = ['...#...', '..#o#..', '##ooo##', '.#ooo#.', '.#o#o#.', '#o#.#o#', '##...##'];
  const b = new Bitmap(7, 7);
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && b.set(x, y, ch === 'o' ? hex('#ffffff') : hex('#8a8aa8'))));
  return b;
}

// ---- The Wish Crystal and its altar ----

export const CRYSTAL_W = 35;
export const CRYSTAL_H = 58;
/** Frames in one turn of the crystal: a hexagon looks the same every 60 degrees, so they cover a sixth of a turn and loop. */
export const CRYSTAL_FRAMES = 24;

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * The Wish Crystal's shape: a quartz shard, a six-sided prism with a tall
 * point above and a longer one below, in model units (y up, z toward the
 * viewer). Returns its faces, each a convex polygon wound either way.
 */
function crystalFaces(): V3[][] {
  const r = 10.5;
  const ringTop = 7;
  const ringBottom = -6;
  const apexTop: V3 = [0, 27, 0];
  const apexBottom: V3 = [0, -28, 0];
  const ring = (y: number): V3[] => Array.from({ length: 6 }, (_, i) => [r * Math.cos((i * Math.PI) / 3), y, r * Math.sin((i * Math.PI) / 3)] as V3);
  const top = ring(ringTop);
  const bottom = ring(ringBottom);
  const faces: V3[][] = [];
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    faces.push([apexTop, top[i], top[j]]);
    faces.push([top[i], top[j], bottom[j], bottom[i]]);
    faces.push([bottom[i], bottom[j], apexBottom]);
  }
  return faces;
}

/** Deep violet to cyan-white: the crystal's colours from its darkest facet to its brightest. */
const CRYSTAL_RAMP = ['#12083a', '#2a1470', '#4a24b0', '#7040e0', '#8a78f8', '#7ec8ff', '#b8ecff', '#f2fdff'].map(hex);

/**
 * One frame of the Wish Crystal turned `angle` radians about its axis, seen
 * from a little above. Each facet is lit from the top left (with a rim of
 * light where it turns away from the eye and a glint where it catches the
 * light), the edges between facets shine, and a heart of light glows
 * through from inside. With `light`, only the brightness in white: the layer
 * added over it in a rarity's colour as a wish charges.
 */
export function wishCrystalFrame(angle: number, light = false): Bitmap {
  const W = CRYSTAL_W;
  const H = CRYSTAL_H;
  const cx = W / 2;
  const cy = H / 2 + 0.5;
  const tilt = 0.32;
  const L = unit([-0.55, 0.65, 0.55]);
  const V: V3 = [0, 0, 1];
  const Hv = unit([L[0] + V[0], L[1] + V[1], L[2] + V[2]]);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  // Turn about the upright axis, then tip the top toward the viewer.
  const view = (p: V3): V3 => {
    const x = p[0] * ca + p[2] * sa;
    const z0 = -p[0] * sa + p[2] * ca;
    return [x, p[1] * ct - z0 * st, p[1] * st + z0 * ct];
  };
  const face = new Int8Array(W * H).fill(-1);
  const bright = new Float32Array(W * H);
  const glint = new Uint8Array(W * H);
  crystalFaces().forEach((poly, fi) => {
    const v = poly.map(view);
    let n = unit(cross(sub(v[1], v[0]), sub(v[2], v[0])));
    // Outward: away from the crystal's centre.
    const mid = v.reduce<V3>((a, p) => [a[0] + p[0] / v.length, a[1] + p[1] / v.length, a[2] + p[2] / v.length], [0, 0, 0]);
    if (dot(n, mid) < 0) n = [-n[0], -n[1], -n[2]];
    // A convex shape: only the facets turned toward the eye show, and never overlap.
    if (n[2] <= 0.02) return;
    const diff = Math.max(0, dot(n, L));
    const spec = Math.pow(Math.max(0, dot(n, Hv)), 28);
    const rim = Math.pow(1 - n[2], 1.6);
    const pts = v.map((p) => [cx + p[0], cy - p[1]]);
    const minX = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0]))));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(...pts.map((p) => p[0]))));
    const minY = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(...pts.map((p) => p[1]))));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let pos = 0;
        let neg = 0;
        for (let k = 0; k < pts.length; k++) {
          const a = pts[k];
          const b = pts[(k + 1) % pts.length];
          const c = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
          if (c > 1e-6) pos++;
          else if (c < -1e-6) neg++;
        }
        if (pos && neg) continue;
        const i = y * W + x;
        face[i] = fi;
        // Upper facets catch more of the sky; the lower point sinks into violet.
        const height = 1 - py / H;
        bright[i] = 0.14 + 0.58 * diff + 0.32 * rim + 0.12 * height;
        if (spec > 0.55) glint[i] = 1;
      }
    }
  });

  const b = new Bitmap(W, H);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && face[y * W + x] >= 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (face[i] < 0) continue;
      let k = bright[i];
      // The heart of light, seen through the crystal: brightest a little above the middle.
      const hd = Math.hypot((x + 0.5 - cx) / 6.5, (y + 0.5 - (cy - 4)) / 11);
      if (hd < 1) k += 0.34 * (1 - hd) * (bayer(x, y) < 1 - hd * 0.8 ? 1 : 0.35);
      // Where two facets meet, the edge shines.
      const f = face[i];
      const edge = (inside(x + 1, y) && face[i + 1] !== f) || (inside(x, y + 1) && face[i + W] !== f);
      if (edge) k += 0.26;
      const silhouette = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (light) {
        const v = glint[i] ? 1 : clamp01((k - 0.35) * 1.5);
        if (v > 0.04) b.set(x, y, [255, 255, 255], Math.round(255 * v * (0.55 + 0.45 * bayer(x, y))));
        continue;
      }
      const step = clamp01(k) * (CRYSTAL_RAMP.length - 1) + (bayer(x, y) - 0.5) * 0.7;
      let c = CRYSTAL_RAMP[Math.max(0, Math.min(CRYSTAL_RAMP.length - 1, Math.round(step)))];
      if (glint[i]) c = G_SPEC;
      // A thin dark outline where the crystal meets the air, a lit one on its upper left.
      if (silhouette) c = (x < cx && y < cy) || !inside(x, y - 1) ? mix(c, CRYSTAL_RAMP[6], 0.35) : hex('#12082a');
      b.set(x, y, c);
    }
  }
  if (!light) outline(b, hex('#0b0620'));
  return b;
}

/** Every frame of the crystal's turn side by side, one sheet: the crystal itself, or its light layer. */
export function wishCrystalSheet(light = false): Bitmap {
  const W = CRYSTAL_W;
  const sheet = new Bitmap(W * CRYSTAL_FRAMES, CRYSTAL_H);
  for (let f = 0; f < CRYSTAL_FRAMES; f++) {
    const fr = wishCrystalFrame((f / CRYSTAL_FRAMES) * (Math.PI / 3), light);
    for (let y = 0; y < CRYSTAL_H; y++) sheet.data.set(fr.data.subarray(y * W * 4, (y + 1) * W * 4), (y * sheet.w + f * W) * 4);
  }
  return sheet;
}

export const ALTAR_W = 72;
export const ALTAR_H = 34;
/** Where the altar's top face is centred, from its top-left. */
export const ALTAR_TOP = 9;

/** The altar the crystal floats over: a round dais of violet stone with a gold band and a rune ring on its face. */
export function altar(): Bitmap {
  const W = ALTAR_W;
  const H = ALTAR_H;
  const b = new Bitmap(W, H);
  const cx = W / 2;
  const rx = W / 2 - 2;
  const ry = 8;
  const side = 16;
  const stone = [hex('#1a1238'), hex('#2a1e58'), hex('#3e2e7e'), hex('#5a48a8'), hex('#7e6cd0')];
  const gold = [hex('#6a3a12'), hex('#b8742c'), hex('#f4cf6a'), hex('#fff4c0')];
  const rune = hex('#9ff6ff');
  // The drum: shaded round its curve, a gold band across it.
  for (let y = ALTAR_TOP; y < ALTAR_TOP + side + ry; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / rx;
      if (Math.abs(dx) > 1) continue;
      const bottom = ALTAR_TOP + side + ry * Math.sqrt(1 - dx * dx);
      if (y > bottom) continue;
      const light = clamp01(0.75 - dx * 0.55);
      let c = stone[Math.min(4, Math.floor(light * 4 + bayer(x, y) * 0.9))];
      const band = y - ALTAR_TOP - ry * Math.sqrt(1 - dx * dx);
      if (band > 5 && band < 9) c = gold[Math.min(3, Math.floor(light * 3 + bayer(x, y) * 0.8))];
      if (y >= bottom - 1) c = stone[0];
      b.set(x, y, c);
    }
  }
  // The top face: an ellipse, lit, with a ring of runes glowing on it.
  for (let y = ALTAR_TOP - ry; y <= ALTAR_TOP + ry; y++) {
    for (let x = 0; x < W; x++) {
      const e = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - ALTAR_TOP) / ry);
      if (e > 1) continue;
      let c = e > 0.9 ? stone[4] : mix(stone[3], stone[2], clamp01(e + (bayer(x, y) - 0.5) * 0.3));
      if (Math.abs(e - 0.68) < 0.07) {
        const a = Math.atan2((y + 0.5 - ALTAR_TOP) / ry, (x + 0.5 - cx) / rx);
        // Short strokes round the ring: runes.
        if (Math.sin(a * 11) > 0.1) c = rune;
      }
      if (e < 0.25) c = mix(stone[3], hex('#c8f8ff'), 0.35);
      b.set(x, y, c);
    }
  }
  outline(b, hex('#0b0818'));
  return b;
}

/** Just the rune ring of the altar's face, white on transparent, for a tinted glow over it. */
export function altarRunes(): Bitmap {
  const W = ALTAR_W;
  const b = new Bitmap(W, 18);
  const cx = W / 2;
  const rx = W / 2 - 2;
  const ry = 8;
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < W; x++) {
      const e = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - 9) / ry);
      if (Math.abs(e - 0.68) < 0.07 && Math.sin(Math.atan2((y + 0.5 - 9) / ry, (x + 0.5 - cx) / rx) * 11) > 0.1) b.set(x, y, [255, 255, 255]);
      else if (Math.abs(e - 0.68) < 0.16) b.set(x, y, [255, 255, 255], 60);
    }
  }
  return b;
}

// ---- The shop's hall ----

const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

/**
 * The Wish Sanctum, filling a `w` x `h` view: a starry vault of indigo
 * under a great arch, velvet drapes either side, and a tiled floor running
 * back to where the altar stands (its foot at `floorY`). Lamps hang at the
 * drapes' edges; their light is added by the scene.
 */
export function shopHall(w: number, h: number, floorY: number): Bitmap {
  const b = new Bitmap(w, h);
  const R = rng(w * 31 + h);
  const cx = w / 2;
  const top = hex('#07061a');
  const vault = hex('#1c1250');
  const horizon = hex('#3a1c6a');
  // The sky under the arch: a gradient, dithered in steps, with a violet bloom behind the altar.
  for (let y = 0; y < floorY; y++) {
    for (let x = 0; x < w; x++) {
      const t = y / floorY;
      const q = Math.floor(t * 6 + bayer(x, y)) / 6;
      let c = q < 0.5 ? mix(top, vault, q * 2) : mix(vault, horizon, (q - 0.5) * 2);
      const bloom = clamp01(1 - Math.hypot((x - cx) / (w * 0.32), (y - floorY * 0.72) / (floorY * 0.55)));
      if (bloom > 0) c = mix(c, hex('#7a3ac0'), Math.floor(bloom * bloom * 5 + bayer(x, y)) / 5 * 0.55);
      b.set(x, y, c);
    }
  }
  // Stars, a few of them crossed.
  for (let i = 0; i < (w * floorY) / 260; i++) {
    const x = Math.floor(R() * w);
    const y = Math.floor(R() * floorY * 0.85);
    const s = R();
    const c = s > 0.8 ? hex('#fff4d0') : s > 0.4 ? hex('#c8d8ff') : hex('#8a7ad0');
    b.set(x, y, c);
    if (s > 0.93) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(x + dx, y + dy, mix(c, vault, 0.5));
  }
  // The floor: tiles in perspective, running back to the horizon.
  const fl = [hex('#120c2e'), hex('#1e1648'), hex('#2c2266'), hex('#3c3080')];
  for (let y = floorY; y < h; y++) {
    const d = (y - floorY + 1) / (h - floorY);
    for (let x = 0; x < w; x++) {
      const u = (x - cx) / (d * w * 0.9 + 1);
      const v = 1 / d;
      const tile = (Math.floor(u * 6) + Math.floor(v * 1.4)) & 1;
      const grout = Math.abs(u * 6 - Math.round(u * 6)) < 0.04 / d || Math.abs(v * 1.4 - Math.round(v * 1.4)) < 0.06;
      let c = fl[Math.min(3, Math.floor(d * 2.2 + tile * 0.8 + bayer(x, y) * 0.6))];
      if (grout) c = fl[0];
      // The altar's glow on the floor.
      const pool = clamp01(1 - Math.hypot((x - cx) / (w * 0.22), (y - floorY - 4) / 18));
      if (pool > 0) c = mix(c, hex('#8a5ae8'), Math.floor(pool * 4 + bayer(x, y)) / 4 * 0.5);
      b.set(x, y, c);
    }
  }
  // The great arch: two columns and a rounded head framing the vault.
  const archW = Math.min(w * 0.62, 300);
  const archL = Math.round(cx - archW / 2);
  const archR = Math.round(cx + archW / 2);
  const col = 10;
  const stone = [hex('#0e0a24'), hex('#1e1846'), hex('#2e2664'), hex('#453a8a')];
  const headY = Math.round(floorY * 0.34);
  for (let y = 0; y < floorY; y++) {
    for (let x = 0; x < w; x++) {
      const inL = x >= archL - col && x < archL;
      const inR = x >= archR && x < archR + col;
      // The head: a band following a half-ellipse.
      const ex = (x - cx) / (archW / 2);
      const ey = (y - headY) / headY;
      const e = ex * ex + (y < headY ? ey * ey : 0);
      const inHead = y < headY + 1 && e >= 1 && e < 1 + 0.18 && Math.abs(ex) < 1.12;
      if (!inL && !inR && !inHead) continue;
      const lx = inL ? (x - archL + col) / col : inR ? (x - archR) / col : 0.5;
      let c = stone[Math.min(3, Math.floor((1 - lx) * 3 + bayer(x, y) * 0.8))];
      if ((inL || inR) && (y % 18 === 0)) c = stone[0];
      if (inHead && e < 1.03) c = hex('#b8742c');
      b.set(x, y, c);
    }
  }
  // Gold trim down the inside of each column.
  for (let y = headY; y < floorY; y++) {
    b.set(archL, y, hex('#b8742c'));
    b.set(archR - 1, y, hex('#b8742c'));
  }
  // Velvet drapes at the edges, in folds, gathered with a gold tie.
  const drape = Math.round(Math.min(w * 0.16, 70));
  const velvet = [hex('#1a0620'), hex('#3a0c3a'), hex('#621a5a'), hex('#8a2e7a')];
  for (const side of [0, 1]) {
    for (let y = 0; y < h; y++) {
      // Gathered in at the tie, two thirds down, then flaring to the floor.
      const tieY = h * 0.62;
      const pinch = y < tieY ? 1 - 0.35 * (y / tieY) ** 2 : 0.65 + 0.35 * ((y - tieY) / (h - tieY));
      const dw = Math.round(drape * pinch);
      for (let i = 0; i < dw; i++) {
        const x = side ? w - 1 - i : i;
        const fold = Math.sin((i / dw) * Math.PI * 3.2 + y * 0.01);
        const edge = i > dw - 3;
        let c = velvet[Math.min(3, Math.max(0, Math.floor(1.6 + fold * 1.4 + bayer(x, y) * 0.8)))];
        if (edge) c = i === dw - 1 ? hex('#0b0818') : hex('#d8a040');
        if (Math.abs(y - tieY) < 2 && !edge) c = y - tieY < 0 ? hex('#f4cf6a') : hex('#b8742c');
        b.set(x, y, c);
      }
    }
  }
  return b;
}

// ---- Wish cards ----

/** The front of a card of a rarity: a jewelled frame round a dark window lit from where the hero will stand, and a plate for its name. */
export function cardFront(w: number, h: number, tint: number, deep: number, legendary: boolean): Bitmap {
  const b = new Bitmap(w, h);
  const col = hex(`#${tint.toString(16).padStart(6, '0')}`);
  const dark = hex(`#${deep.toString(16).padStart(6, '0')}`);
  const lit = mix(col, [255, 255, 255], 0.55);
  const out = hex('#0b0818');
  const plateY = h - 22;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      if (ex + ey < 2) continue;
      let c: RGB;
      if (ex === 0 || ey === 0 || ex + ey === 2) c = out;
      else if (ex <= 2 || ey <= 2) c = x < w / 2 && y < h / 2 ? lit : ex === 2 || ey === 2 ? dark : col;
      else if (ex === 3 || ey === 3) c = out;
      else if (y >= plateY) {
        // The name plate: a darker strip with the frame's colour along its top.
        c = y === plateY ? col : mix(hex('#0e0a22'), dark, 0.25 + 0.15 * bayer(x, y));
      } else {
        // The window: dark, lit from behind the hero in the rarity's colour.
        const glow = clamp01(1 - Math.hypot((x - w / 2) / (w * 0.5), (y - plateY * 0.55) / (plateY * 0.55)));
        const q = Math.floor(glow * glow * 5 + bayer(x, y)) / 5;
        c = mix(hex('#0c0920'), dark, q * 0.9);
        if (q >= 0.8) c = mix(dark, col, 0.35);
      }
      b.set(x, y, c);
    }
  }
  // Jewels at the corners, and for a legendary a crest over the top.
  const jewel = (x: number, y: number) => {
    b.set(x, y - 1, lit);
    b.set(x - 1, y, col);
    b.set(x, y, [255, 255, 255]);
    b.set(x + 1, y, dark);
    b.set(x, y + 1, dark);
  };
  jewel(4, 4);
  jewel(w - 5, 4);
  jewel(4, h - 5);
  jewel(w - 5, h - 5);
  if (legendary) {
    const cx = Math.floor(w / 2);
    for (let i = -6; i <= 6; i++) b.set(cx + i, 1, Math.abs(i) < 4 ? lit : col);
    for (let i = -3; i <= 3; i++) b.set(cx + i, 2, col);
    jewel(cx, 2);
  }
  return b;
}

/** The back of a card: indigo, a gold frame and a star at its heart over a lattice of little diamonds. */
export function cardBack(w: number, h: number): Bitmap {
  const b = new Bitmap(w, h);
  const out = hex('#0b0818');
  const gold = hex('#d8a040');
  const goldLit = hex('#fff0a8');
  const goldDark = hex('#8a4e22');
  const base = [hex('#1a1244'), hex('#2a1e66'), hex('#3a2c8a')];
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      if (ex + ey < 2) continue;
      let c: RGB;
      if (ex === 0 || ey === 0 || ex + ey === 2) c = out;
      else if (ex <= 2 || ey <= 2) c = x < cx && y < cy ? goldLit : ex === 2 || ey === 2 ? goldDark : gold;
      else if (ex === 3 || ey === 3) c = out;
      else if (ex === 6 || ey === 6) c = goldDark;
      else {
        const lattice = (Math.abs(((x + y) % 8) - 4) + Math.abs(((x - y + 800) % 8) - 4)) < 2;
        const glow = clamp01(1 - Math.hypot((x - cx) / (w * 0.45), (y - cy) / (h * 0.4)));
        c = base[Math.min(2, Math.floor(glow * 2.5 + bayer(x, y) * 0.7))];
        if (lattice) c = mix(c, gold, 0.25);
      }
      b.set(x, y, c);
    }
  }
  // An eight-point star in the middle.
  const R = Math.min(w, h) * 0.22;
  for (let y = Math.floor(cy - R); y <= cy + R; y++) {
    for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const a = Math.atan2(dy, dx);
      const r = Math.hypot(dx, dy);
      const reach = R * (0.35 + 0.65 * Math.pow(Math.abs(Math.cos(a * 4)), 6)) + (Math.abs(Math.cos(a * 2)) > 0.99 ? R * 0.15 : 0);
      if (r > reach) continue;
      b.set(x, y, r < R * 0.2 ? [255, 255, 255] : dx + dy < 0 ? goldLit : gold);
    }
  }
  return b;
}

// ---- Registering ----

/** Put a bitmap in the texture manager under `key`, once. */
export function addBitmap(scene: Phaser.Scene, key: string, b: Bitmap): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** Gems for everywhere (the world's drops and the menus' counters): made at boot. */
export function registerGemArt(scene: Phaser.Scene): void {
  addBitmap(scene, 'gem_s', gemBitmap(7));
  addBitmap(scene, 'gem_m', gemBitmap(11));
  addBitmap(scene, 'gem_l', gemBitmap(15));
  for (const k of Object.keys(GEM_DROPS) as GemDrop[]) addBitmap(scene, `gem_drop_${k}`, gemDrop(k));
  addBitmap(scene, 'icon_lock', lockBitmap());
  addBitmap(scene, 'icon_star', starBitmap());
}

/** The shop's own art, made the first time it opens. */
export function registerShopArt(scene: Phaser.Scene): void {
  for (const [key, light] of [['shop_crystal', false], ['shop_crystal_w', true]] as const) {
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.addCanvas(key, wishCrystalSheet(light).toCanvas())!;
    for (let f = 0; f < CRYSTAL_FRAMES; f++) tex.add(f, 0, f * CRYSTAL_W, 0, CRYSTAL_W, CRYSTAL_H);
  }
  addBitmap(scene, 'shop_altar', altar());
  addBitmap(scene, 'shop_altar_runes', altarRunes());
}
