// Art for gems and the shop: cut gems in every size (inline icons, drops on
// the ground, little heaps of them), the Wish Crystal and its altar, the
// shop's hall, and the cards a wish turns over. All flat and unlit, painted
// pixel by pixel in the menus' style (see ui/widgets.ts).

import Phaser from 'phaser';
import { Bitmap, bayer, clamp01, mix } from './bitmap';
import { hex, type RGB } from './pixel';
import { SIGIL_FRAMES, SIGIL_H, SIGIL_W, crystalIcon, eggHalves, eggIcon, sigilSheet } from './wishArt';

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
  // Two round steps up to the altar, of the same violet stone, a gilt line along each riser.
  const step = [hex('#0b0818'), hex('#1a1238'), hex('#2a1e58'), hex('#3e2e7e'), hex('#5a48a8'), hex('#7e6cd0')];
  for (const [sy, rx, ry, rise] of [[floorY + 20, 58, 11, 4], [floorY + 16, 45, 8, 3]] as const) {
    for (let y = sy - ry - 1; y <= sy + ry + rise + 1; y++) {
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const topE = Math.hypot(dx, (y + 0.5 - sy) / ry);
        const lowE = Math.hypot(dx, (y + 0.5 - sy - rise) / ry);
        if (topE <= 1) {
          const light = clamp01(0.7 - dx * 0.45 - ((y - sy) / ry) * 0.25);
          let c = step[Math.min(5, 3 + Math.floor(light * 2 + bayer(x, y) * 0.8))];
          if (topE > 0.93) c = y < sy ? step[5] : step[4];
          b.set(x, y, c);
        } else if (lowE <= 1 && y > sy) {
          const light = clamp01(0.65 - dx * 0.55);
          let c = step[Math.min(3, 1 + Math.floor(light * 2 + bayer(x, y) * 0.7))];
          if (y - sy - ry * Math.sqrt(Math.max(0, 1 - dx * dx)) < 1.5) c = hex('#b8742c');
          if (lowE > 0.95) c = step[0];
          b.set(x, y, c);
        } else if (Math.min(topE, lowE) <= 1.04) b.set(x, y, step[0]);
      }
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

const INK = hex('#0b0818');
const WHITE: RGB = [255, 255, 255];
/** Gilt for the finer cards' trim, brightest first. */
const GILT = [hex('#fff4bf'), hex('#f4cf6a'), hex('#d69a3a'), hex('#8a4e22')];
const toRGB = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** A little hash of a pixel, 0..1, for scattering stars without a generator. */
const speck = (x: number, y: number, seed: number): number => {
  let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

/** Stamp a little picture of characters onto `b` from a palette, mirrored as asked ('.' is left alone). */
function stamp(b: Bitmap, x0: number, y0: number, rows: string[], pal: Record<string, RGB>, flipX = false, flipY = false): void {
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === '.') return;
      b.set(flipX ? x0 - x : x0 + x, flipY ? y0 - y : y0 + y, pal[ch]);
    }),
  );
}

/** A cut gem `r` pixels from its middle to its points, at (cx, cy): bright upper left, deep lower right, a glint. */
function cutGem(b: Bitmap, cx: number, cy: number, r: number, light: RGB, mid: RGB, dark: RGB, rim: RGB): void {
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const m = Math.abs(dx) + Math.abs(dy);
      if (m === r + 1) b.set(cx + dx, cy + dy, INK);
      else if (m === r) b.set(cx + dx, cy + dy, dy < 0 || (dy === 0 && dx < 0) ? rim : mix(rim, INK, 0.45));
      else if (m < r) b.set(cx + dx, cy + dy, dx === -1 && dy === -Math.max(1, r - 2) ? WHITE : dx + dy < 0 ? light : dx + dy > 0 ? dark : mid);
    }
  }
}

/** Is (x, y) on a `w` x `h` card, whose corners are cut? */
const onCard = (x: number, y: number, w: number, h: number): boolean => Math.min(x, w - 1 - x) + Math.min(y, h - 1 - y) >= 2;

/**
 * The front of a card of a rarity (`tier` 0 rare, 1 epic, 2 legendary): a
 * bevelled frame round a dark window lit from where the hero will stand, and
 * a plate `plate` tall for its name. The finer the rarity, the finer the
 * card: a rare's is plain steel-blue with a jewel at each corner; an epic's
 * gains a gilt fillet, gilt brackets in the window's corners, a gem atop its
 * frame and a scatter of stars behind the hero; a legendary's is all gilt,
 * with filigree corners, a winged crest holding a cut gem, gilt ends to its
 * plate and a sunburst behind the hero.
 */
export function cardFront(w: number, h: number, tint: number, deep: number, tier: number, plate = 22): Bitmap {
  const b = new Bitmap(w, h);
  const col = toRGB(tint);
  const dark = toRGB(deep);
  const lit = mix(col, WHITE, 0.55);
  const plateY = h - plate;
  const cx = w / 2;
  // Where the window's light comes from: behind the hero, a little above the middle.
  const gy = plateY * 0.55;
  // The frame's bevel: a legendary's is gilt whatever its colour.
  const band = tier >= 2 ? [GILT[0], GILT[1], GILT[2], GILT[3]] : [lit, col, mix(col, dark, 0.5), dark];
  const fillet = tier === 0 ? INK : tier === 1 ? GILT[2] : GILT[1];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      if (ex + ey < 2) continue;
      let c: RGB;
      if (ex === 0 || ey === 0 || ex + ey === 2) c = INK;
      else if (ex <= 2 || ey <= 2) {
        // Lit from the top left: the top and left sides catch it, the others fall into shade.
        const horiz = ey <= ex;
        const litSide = horiz ? y < h / 2 : x < w / 2;
        const outer = (horiz ? ey : ex) === 1;
        c = litSide ? band[outer ? 0 : 1] : band[outer ? 2 : 3];
        // Polished metal: a soft gleam travels along a legendary's frame.
        if (tier >= 2 && litSide && Math.sin((x + y) * 0.21) > 0.75) c = mix(c, WHITE, 0.45);
      } else if (ex === 3 || ey === 3) c = y >= plateY && ey !== 3 ? INK : fillet;
      else if (y >= plateY) {
        // The name plate: a darker strip, lit along its top in the frame's trim.
        if (y === plateY) c = tier >= 1 ? GILT[1] : col;
        else if (y === plateY + 1) c = INK;
        else c = mix(hex('#0e0a22'), dark, 0.22 + 0.14 * bayer(x, y) + 0.1 * (1 - (y - plateY) / plate));
      } else {
        // The window: dark, lit from behind the hero in the rarity's colour.
        const d = Math.hypot((x - cx) / (w * 0.5), (y - gy) / (plateY * 0.55));
        const glow = clamp01(1 - d);
        let q = glow * glow;
        if (tier >= 2) {
          // Sunburst: alternate wedges of light turning out from behind the hero.
          const a = Math.atan2(y - gy, x - cx);
          const wedge = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 16) & 1;
          if (wedge) q += 0.22 * clamp01(1.25 - d);
        }
        const step = Math.floor(clamp01(q) * 5 + bayer(x, y)) / 5;
        c = mix(hex('#0c0920'), dark, step * 0.9);
        if (step >= 0.8) c = mix(dark, col, 0.35);
        // An epic's and a legendary's window is sown with little stars.
        if (tier >= 1 && glow < 0.7) {
          const s = speck(x, y, w + h);
          if (s < 0.018) c = mix(col, WHITE, 0.5);
          else if (s < 0.03) c = mix(c, col, 0.45);
        }
        // A soft dark rim inside the frame, so the window sits back.
        if (ex === 4 || ey === 4) c = mix(c, INK, 0.45);
      }
      b.set(x, y, c);
    }
  }

  const jewel = (x: number, y: number) => {
    b.set(x, y - 1, lit);
    b.set(x - 1, y, col);
    b.set(x, y, WHITE);
    b.set(x + 1, y, dark);
    b.set(x, y + 1, dark);
  };
  const midX = Math.floor(w / 2);
  if (tier === 0) {
    jewel(4, 4);
    jewel(w - 5, 4);
    jewel(4, plateY - 4);
    jewel(w - 5, plateY - 4);
  } else {
    // Brackets of gilt in the window's corners; a legendary's curl into filigree.
    const G = { G: GILT[1], W: GILT[0], d: GILT[3], o: INK, c: col, l: lit };
    const corner = tier >= 2 ? ['WGGGGd', 'GlcGd.', 'GcGd..', 'GGd...', 'Gd..W.', 'd.....'] : ['WGGd', 'Gd..', 'G...', 'd...'];
    const far = plateY - 4;
    stamp(b, 4, 4, corner, G);
    stamp(b, w - 5, 4, corner, G, true);
    stamp(b, 4, far, corner, G, false, true);
    stamp(b, w - 5, far, corner, G, true, true);
  }
  if (tier === 1) {
    // A small gem set in the top of the frame.
    cutGem(b, midX, 2, 2, lit, col, dark, GILT[1]);
  }
  if (tier >= 2) {
    // A winged crest astride the top of the frame, holding one of the shop's own cut gems.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const x = midX + s * (5 + i);
        const top = i < 3 ? 0 : i < 6 ? 1 : 2;
        for (let y = top; y <= 3; y++) b.set(x, y, y === top ? INK : y === top + 1 ? GILT[0] : y === 3 ? GILT[3] : GILT[1]);
      }
    }
    cutGem(b, midX, 3, 3, hex('#c8faff'), hex('#86ecff'), hex('#2a3aa8'), GILT[0]);
    // Gilt ends to the name plate, each with a bead.
    for (const x of [4, w - 5]) {
      b.set(x, plateY, GILT[0]);
      b.set(x, plateY - 1, GILT[1]);
      b.set(x, plateY + 1, GILT[2]);
    }
    for (const x of [midX - 3, midX + 3]) b.set(x, plateY, GILT[0]);
    b.set(midX, plateY, WHITE);
  }
  return b;
}

/**
 * The back of a card. The Sanctum's: indigo, a gilt frame with a fillet
 * inside it, a lattice of little diamonds, and at its heart the Wish Crystal
 * in a ring of runes. The Nest's (`egg`): forest green, the lattice of
 * leaves, and the wishing egg in a ring of leaves.
 */
export function cardBack(w: number, h: number, egg = false): Bitmap {
  const b = new Bitmap(w, h);
  const base = egg ? [hex('#0e2418'), hex('#183a24'), hex('#285a34')] : [hex('#1a1244'), hex('#2a1e66'), hex('#3a2c8a')];
  const rune = egg ? hex('#9ee85a') : hex('#9ff6ff');
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const R = Math.min(w, h) * 0.3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      if (ex + ey < 2) continue;
      let c: RGB;
      if (ex === 0 || ey === 0 || ex + ey === 2) c = INK;
      else if (ex <= 2 || ey <= 2) {
        const horiz = ey <= ex;
        const litSide = horiz ? y < h / 2 : x < w / 2;
        const outer = (horiz ? ey : ex) === 1;
        c = litSide ? GILT[outer ? 0 : 1] : GILT[outer ? 2 : 3];
      } else if (ex === 3 || ey === 3) c = INK;
      else if ((ex === 6 || ey === 6) && ex >= 6 && ey >= 6) c = (ex === 6 ? x < cx : y < cy) ? GILT[2] : GILT[3];
      else {
        const glow = clamp01(1 - Math.hypot((x - cx) / (w * 0.5), (y - cy) / (h * 0.42)));
        c = base[Math.min(2, Math.floor(glow * 2.6 + bayer(x, y) * 0.7))];
        // The lattice: diamonds (the Sanctum) or little leaves along slanting lines (the Nest).
        const u = (x + y) % 8;
        const v = (x - y + 800) % 8;
        const lattice = egg ? (u === 0 && v < 3) || (v === 0 && u > 5) : Math.abs(u - 4) + Math.abs(v - 4) < 2;
        if (lattice && ex > 6 && ey > 6) c = mix(c, GILT[2], 0.28);
      }
      b.set(x, y, c);
    }
  }
  // Studs where the fillet turns its corners.
  for (const [x, y] of [[6, 6], [w - 7, 6], [6, h - 7], [w - 7, h - 7]]) {
    b.set(x, y, GILT[0]);
    b.set(x + 1, y + 1, GILT[2]);
  }
  // The ring round the emblem, set with runes (or leaves) that glow.
  for (let a = 0; a < 360; a += 1) {
    const t = (a * Math.PI) / 180;
    const x = Math.round(cx + Math.cos(t) * R);
    const y = Math.round(cy + Math.sin(t) * R * 1.05);
    b.set(x, y, a % 45 < 6 ? rune : y < cy ? GILT[1] : GILT[2]);
  }
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.round(cx + Math.cos(t) * (R + 2.5));
    const y = Math.round(cy + Math.sin(t) * (R + 2.5) * 1.05);
    b.set(x, y, rune);
    if (R > 14) b.set(x, y - 1, mix(rune, WHITE, 0.5));
  }
  // A soft light inside the ring.
  for (let y = Math.floor(cy - R); y <= cy + R; y++) {
    for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const d = Math.hypot(x - cx, (y - cy) / 1.05) / (R - 1);
      if (d >= 1) continue;
      if (bayer(x, y) < (1 - d) * 0.5) b.set(x, y, mix(base[2], rune, 0.25));
    }
  }
  if (egg) {
    // The egg: pale, round below, with a gilt band and teal spots.
    const eh = R * 1.25;
    for (let y = Math.floor(cy - eh * 0.55); y <= cy + eh * 0.5; y++) {
      const v = (y + 0.5 - cy) / (eh * 0.5);
      const k = v < 0 ? 0.78 + 0.22 * (1 + v) : 1;
      const hw = R * 0.55 * Math.sqrt(Math.max(0, 1 - v * v)) * k;
      for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
        const dx = (x + 0.5 - cx) / Math.max(1, hw);
        if (Math.abs(dx) > 1) continue;
        const edge = Math.abs(dx) > 0.82 || v > 0.9;
        let c = edge ? hex('#5a4a30') : dx < -0.2 && v < 0.2 ? hex('#fff8e8') : dx > 0.4 ? hex('#b8a480') : hex('#e6d8b8');
        if (!edge && Math.abs(v - dx * 0.6 - 0.05) < 0.09) c = GILT[1];
        b.set(x, y, c);
      }
    }
    for (const [dx, dy] of [[-0.25, -0.1], [0.2, 0.25], [0.05, -0.45]]) b.set(Math.round(cx + dx * R), Math.round(cy + dy * R), hex('#2ea88a'));
  } else {
    // The Wish Crystal: a tall point of faceted violet, lit on the left, brightest down its middle.
    const top = R * 0.85;
    const half = R * 0.38;
    for (let y = Math.floor(cy - top); y <= cy + top; y++) {
      const v = (y + 0.5 - cy) / top;
      const hw = half * (1 - Math.abs(v)) * (v < 0 ? 1 : 1.0);
      for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
        const dx = (x + 0.5 - cx) / Math.max(0.6, hw);
        if (Math.abs(dx) > 1) continue;
        let c = dx < -0.25 ? hex('#8a78f8') : dx > 0.3 ? hex('#4a24b0') : hex('#b8ecff');
        if (v > 0) c = mix(c, hex('#2a1470'), 0.35);
        if (Math.abs(dx) > 0.8) c = mix(c, INK, 0.5);
        b.set(x, y, c);
      }
    }
    b.set(Math.round(cx), Math.round(cy - top * 0.45), WHITE);
  }
  return b;
}

/**
 * A card's aura, `pad` pixels round a `w` x `h` card: white light hugging
 * its edge and falling away in dithered steps, tinted by the scene in the
 * colour of what the card holds, to hint before it turns.
 */
export function cardAura(w: number, h: number, pad = 7): Bitmap {
  const W = w + pad * 2;
  const H = h + pad * 2;
  const b = new Bitmap(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = Math.max(pad - x, x - (W - 1 - pad), 0);
      const dy = Math.max(pad - y, y - (H - 1 - pad), 0);
      const inside = dx === 0 && dy === 0;
      const d = inside ? 0 : Math.hypot(dx, dy) + (dx && dy ? 1 : 0);
      if (inside) {
        // Only a thin ring inside the card's edge.
        const e = Math.min(x - pad, W - 1 - pad - x, y - pad, H - 1 - pad - y);
        if (e < 2) b.set(x, y, WHITE, e === 0 ? 150 : 70);
        continue;
      }
      const t = 1 - d / pad;
      if (t <= 0) continue;
      const level = Math.floor(t * t * 4 + bayer(x, y) * 0.9) / 4;
      if (level > 0) b.set(x, y, WHITE, Math.round(230 * level));
    }
  }
  return b;
}

/** A card's shape in white, for the flash as it turns. */
export function cardFlash(w: number, h: number): Bitmap {
  const b = new Bitmap(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (onCard(x, y, w, h)) b.set(x, y, WHITE);
  return b;
}

/** Frames in a card's sheen. */
export const SHEEN_FRAMES = 12;

/** The sheen that sweeps over a fine card: a slanting band of light, `SHEEN_FRAMES` frames across it, side by side. */
export function cardSheen(w: number, h: number): Bitmap {
  const F = SHEEN_FRAMES;
  const b = new Bitmap(w * F, h);
  const span = w + h * 0.5;
  for (let f = 0; f < F; f++) {
    const at = -0.15 + (1.3 * f) / (F - 1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!onCard(x, y, w, h)) continue;
        const u = (x + (h - y) * 0.5) / span;
        const d = Math.abs(u - at);
        if (d < 0.035) b.set(f * w + x, y, WHITE, 170);
        else if (d < 0.07 && bayer(x, y) < 0.6) b.set(f * w + x, y, WHITE, 80);
        else if (d < 0.1 && bayer(x, y) < 0.25) b.set(f * w + x, y, WHITE, 50);
      }
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
  addBitmap(scene, 'wish_icon_crystal', crystalIcon());
  addBitmap(scene, 'wish_icon_egg', eggIcon());
  if (!scene.textures.exists('shop_sigil')) {
    const tex = scene.textures.addCanvas('shop_sigil', sigilSheet().toCanvas())!;
    for (let f = 0; f < SIGIL_FRAMES; f++) tex.add(f, 0, f * SIGIL_W, 0, SIGIL_W, SIGIL_H);
  }
  // The egg's two halves, broken from its own picture, for when it hatches.
  if (!scene.textures.exists('nest_half_top') && scene.textures.exists('nest_egg')) {
    const src = scene.textures.get('nest_egg').getSourceImage() as HTMLCanvasElement;
    const ctx = src.getContext?.('2d');
    if (ctx) {
      const [top, bottom] = eggHalves(ctx.getImageData(0, 0, src.width, src.height).data, src.width, src.height);
      addBitmap(scene, 'nest_half_top', top);
      addBitmap(scene, 'nest_half_bottom', bottom);
    }
  }
}

/** A card's back, aura, flash and sheen at a size, made once each. */
export function registerCardArt(scene: Phaser.Scene, w: number, h: number): void {
  addBitmap(scene, `wish_back_${w}x${h}`, cardBack(w, h));
  addBitmap(scene, `wish_backegg_${w}x${h}`, cardBack(w, h, true));
  addBitmap(scene, `wish_aura_${w}x${h}`, cardAura(w, h));
  addBitmap(scene, `wish_flash_${w}x${h}`, cardFlash(w, h));
  const sheen = `wish_sheen_${w}x${h}`;
  if (!scene.textures.exists(sheen)) {
    const tex = scene.textures.addCanvas(sheen, cardSheen(w, h).toCanvas())!;
    for (let f = 0; f < SHEEN_FRAMES; f++) tex.add(f, 0, f * w, 0, w, h);
  }
}
