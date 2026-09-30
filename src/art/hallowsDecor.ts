// Hallow's Eve decorations: the jack-o'-lanterns on the Runestone Clearing's
// lawn, the witch's candy stall, Old Wick the Candlewitch who keeps it, and
// banks of violet ground fog. The world places them; this file only draws
// them and registers them as textures.
//
// The pumpkins are traced as real ribbed, squashed spheres seen from a little
// above (see `gourd`), so their ribs curve round the body and converge on a
// dimpled crown, and the key light rakes across the lobes. Carvings are holes
// through the skin: the glow of the candle inside is emissive and flickers,
// the cut flesh shows on each hole's lower lip, and a faint halo of light
// spills round the face.
//
// The stall comes in two layers with Old Wick standing between them: behind
// her, the posts, a striped purple-and-orange scalloped awning, a plank back
// wall with shelves of candy jars and two hanging lanterns that sway; in
// front of her, the counter (a painted SWEETS sign and a candy-corn skirt), a
// basket of sweets and a jar of lollipops on top, and at its foot a bubbling
// green cauldron on a small fire and a couple of pumpkins.
//
// Old Wick: an old witch, kindly and a little sinister, in a crooked, wide
// hat with lit candles standing on its brim, wild white hair, a long hooked
// nose, a deep purple shawl trimmed in orange, holding up a wrapped sweet.

import type Phaser from 'phaser';
import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { hash2, valueNoise } from './env';
import { packAtlas, registerAtlas } from './atlas';
import { pixelCanvas } from './canvas';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------- Tuning

/** How far above the horizon the pumpkins are seen from, in degrees: low enough that their faces read, high enough to see the crown. */
const VIEW_ELEVATION = 25;
/** Candle flicker over the lanterns' four frames (each kind starts at a different step so they never pulse together). */
const FLICKER = [1, 0.72, 0.9, 0.62];

export const LANTERN_W = 22;
export const LANTERN_H = 24;
/** Feet row: where the lantern sits on the ground, centred in the frame. */
export const LANTERN_OY = 21;
export const LANTERN_KINDS = 3;
export const LANTERN_FRAMES = 4;

export const STALL_W = 72;
export const STALL_H = 64;
/** Feet point: the middle of the counter's foot. */
export const STALL_OX = 36;
export const STALL_OY = 60;
export const STALL_FRAMES = 6;
/** Where Old Wick's feet go in the stall's frame, so she shows from the waist up over the counter. */
export const STALL_WICK_X = 36;
export const STALL_WICK_Y = 50;

export const WICK_W = 30;
export const WICK_H = 38;
/** Feet in the frame. */
export const WICK_OX = 15;
export const WICK_OY = 35;
export const WICK_FRAMES = 6;

export const FOG_W = 96;
export const FOG_H = 36;
export const FOG_KINDS = 3;

// ---------------------------------------------------------------- Materials

const INK = hex('#0c0610');

const PUMPKIN: Material = { ramp: ramp('#3a1004', '#6a2006', '#a23c0a', '#d4621a', '#f08a2c', '#ffb456', '#ffdc9c'), outline: hex('#1c0804'), outlineLit: hex('#3a1406'), shine: true };
/** A redder, older pumpkin, for variety. */
const PUMPKIN_RED: Material = { ramp: ramp('#300808', '#5a140a', '#8a2a0e', '#b8441a', '#d8642a', '#f08e48', '#ffc080'), outline: hex('#180404'), outlineLit: hex('#321008'), shine: true };
/** A pale ghost pumpkin. */
const PUMPKIN_PALE: Material = { ramp: ramp('#3a3028', '#5e5040', '#8a7a62', '#b4a488', '#d6caae', '#eee6ce', '#fffaea'), outline: hex('#1a140e'), outlineLit: hex('#2e261c'), shine: true };
/** A dark green gourd with a waxy skin. */
const GOURD_GREEN: Material = { ramp: ramp('#0a1a0e', '#142e16', '#20461e', '#326226', '#4e8230', '#7aa844', '#b4d070'), outline: hex('#060e06'), outlineLit: hex('#10200e'), shine: true };
const STEM: Material = { ramp: ramp('#1a1408', '#33280e', '#524018', '#6e5a26', '#8e7a3e', '#b0a060'), outline: hex('#0c0804'), outlineLit: hex('#1e160a') };
const LEAF: Material = { ramp: ramp('#0c200e', '#163814', '#24541c', '#367228', '#509036', '#78b048'), outline: hex('#061006'), outlineLit: hex('#0e1e0c') };
const LEAF_AUTUMN: Material = { ramp: ramp('#2a1004', '#4e1e06', '#7a340a', '#a85210', '#d07a1c', '#eca040'), outline: hex('#140602'), outlineLit: hex('#2a0e04') };
/**
 * The inside of a carving: dark in the lit layer, so the holes read as holes
 * by day; the candlelight in them is added as pure light (see `carve`).
 */
const CARVED: Material = { ramp: ramp('#1e0602', '#34100a', '#521c0c', '#742c10'), outline: INK, noAO: true };
const CANDLE_CORE: RGB = [255, 226, 140];
/** The cut flesh on a carving's lip, lit from inside. */
const FLESH: Material = { ramp: ramp('#3e1604', '#6a300a', '#96521a', '#ba742c'), outline: INK, emissive: 0.6, noAO: true };
const WAX: Material = { ramp: ramp('#5a4a3a', '#8e7c64', '#c4b08e', '#e6d8b8', '#fbf2dc', '#fffcf2'), outline: hex('#241a12'), outlineLit: hex('#3e3024'), shine: true };
const FLAME: Material = { ramp: ramp('#c04a0a', '#ff8a24', '#ffc860', '#fff4c8'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const WICK_BLACK: Material = { ramp: ramp('#0a0806', '#1e1812'), outline: INK, noOutline: true };

const FLAME_HOT: RGB = [255, 214, 120];
const FLAME_HALO: RGB = [255, 130, 36];
const BREW_HALO: RGB = [120, 255, 90];

// The stall.
const WOOD_DK: Material = { ramp: ramp('#140c08', '#241610', '#382418', '#4e3322', '#66452e', '#7e583a'), outline: hex('#080404'), outlineLit: hex('#1c120c') };
const WOOD: Material = { ramp: ramp('#1e120c', '#321e12', '#4a2e1a', '#644024', '#80562e', '#9c6e3c', '#b88a52'), outline: hex('#0c0604'), outlineLit: hex('#24160c') };
const CURTAIN: Material = { ramp: ramp('#050b0b', '#0a1616', '#10221f', '#172e2a', '#1f3c36', '#284c44'), outline: hex('#020504'), outlineLit: hex('#0a1412') };
const PLANK: Material = { ramp: ramp('#160e0c', '#241814', '#34241c', '#463226', '#5a4232', '#6e543e'), outline: hex('#0a0606'), outlineLit: hex('#1c1410') };
const CLOTH_P: Material = { ramp: ramp('#1a0a2a', '#2c1244', '#421c62', '#5a2a82', '#7440a2', '#9058c0', '#ae7ad8'), outline: hex('#0a0412'), outlineLit: hex('#1e0e2e') };
const CLOTH_O: Material = { ramp: ramp('#4a1606', '#7a280a', '#ae4612', '#dc6c1e', '#f69438', '#ffbc68', '#ffdca0'), outline: hex('#1e0802'), outlineLit: hex('#3a1204') };
const PAINT_P: Material = { ramp: ramp('#140a1e', '#20102e', '#2e1842', '#3e2258', '#50306e', '#644084'), outline: hex('#08040c'), outlineLit: hex('#1a0e26') };
const PAINT_CREAM: Material = { ramp: ramp('#4a3a2a', '#7a664c', '#aa946e', '#d2be94', '#eee0bc', '#fff6de'), outline: hex('#1a120a'), outlineLit: hex('#34281a') };
const CORN_Y: Material = { ramp: ramp('#6a4a06', '#a87a10', '#e0ae22', '#fcd650', '#fff08e'), outline: hex('#281a02'), shine: true };
const CORN_O: Material = { ramp: ramp('#5a1c04', '#9a360a', '#dc5c16', '#fa8a2a', '#ffb45a'), outline: hex('#240a02'), shine: true };
const CORN_W: Material = { ramp: ramp('#6a6258', '#a49c90', '#d8d0c4', '#f6f0e6', '#ffffff'), outline: hex('#2a2620'), shine: true };
const GLASS: Material = { ramp: ramp('#18242e', '#263844', '#3a525e', '#5a7682', '#8aa8b2', '#c4dce2', '#f0fcff'), outline: hex('#0a1016'), outlineLit: hex('#1a2a32'), shine: true };
const BRASS: Material = { ramp: ramp('#3a2408', '#6a4414', '#9e6c22', '#d4a040', '#f4d070', '#fff4c0'), outline: hex('#1a0e04'), shine: true };
const IRON: Material = { ramp: ramp('#08080c', '#121218', '#1c1c24', '#282834', '#383846', '#50505e', '#7a7a8c'), outline: hex('#030306'), outlineLit: hex('#141418'), shine: true };
const WICKER: Material = { ramp: ramp('#2a1a0a', '#4a3014', '#6e4a20', '#946a30', '#b88c44', '#d8ae64'), outline: hex('#140a04'), outlineLit: hex('#2a1a0a') };
const BREW: Material = { ramp: ramp('#0e3a0a', '#1e6a12', '#3aa41e', '#7ee03a', '#d4ff8a'), outline: hex('#041404'), emissive: 0.85, noAO: true, noOutline: true };
const EMBERS: Material = { ramp: ramp('#5a1a04', '#a0400a', '#e08a20', '#ffc860', '#fff4c0'), outline: hex('#2a0a02'), emissive: 0.9, noAO: true };
const LOG: Material = { ramp: ramp('#120a06', '#22140c', '#342014', '#48301e'), outline: hex('#060302') };
const LANTERN_PAPER: Material = { ramp: ramp('#6a2004', '#b04a0c', '#ec7a1c', '#ffae48', '#ffe09a'), outline: hex('#200804'), emissive: 0.55, noAO: true };
const CANDY: Record<string, Material> = {
  pink: { ramp: ramp('#5a1030', '#9a2052', '#dc4884', '#ff86b4', '#ffd0e4'), outline: hex('#24060e'), shine: true },
  green: { ramp: ramp('#0e3a14', '#1c6a22', '#38a838', '#7ade5a', '#ccffa8'), outline: hex('#061a08'), shine: true },
  yellow: { ramp: ramp('#5a4004', '#9a760c', '#dcb420', '#fce25a', '#fff8b8'), outline: hex('#241a02'), shine: true },
  orange: CORN_O,
  violet: { ramp: ramp('#1e0c3a', '#3a1a66', '#6030a0', '#9a60dc', '#d4b0ff'), outline: hex('#0c0418'), shine: true },
  white: CORN_W,
  red: { ramp: ramp('#3a0406', '#6e0a10', '#a8141e', '#e03038', '#ff8a8a'), outline: hex('#180204'), shine: true },
};
const CANDY_KEYS = ['pink', 'green', 'yellow', 'orange', 'violet', 'white', 'red'];

// Old Wick.
const HAT_FELT: Material = { ramp: ramp('#07040c', '#110a1a', '#1c1228', '#2a1c3c', '#3c2a54', '#523a70'), outline: hex('#030206'), outlineLit: hex('#140c1e') };
const SHAWL: Material = { ramp: ramp('#18082a', '#281040', '#3c1a5c', '#52267a', '#6a3496', '#8448b2'), outline: hex('#08030e'), outlineLit: hex('#1e0c30') };
const TRIM: Material = { ramp: ramp('#5a1e06', '#a0400e', '#e0701c', '#ffa040', '#ffd080'), outline: hex('#1e0802'), outlineLit: hex('#3a1204'), shine: true };
const DRESS: Material = { ramp: ramp('#07050a', '#0f0b14', '#18121f', '#221a2c', '#2e243a'), outline: hex('#030204'), outlineLit: hex('#120e18') };
const WHITE_HAIR: Material = { ramp: ramp('#34323e', '#5c5a6a', '#8c8a9a', '#b8b6c2', '#dcdae2', '#f6f4fa'), outline: hex('#121018'), outlineLit: hex('#26242e') };
/** Old, sallow skin with the faintest green in it. */
const OLD_SKIN: Material = { ramp: ramp('#34321e', '#5c5a3c', '#88845e', '#b0aa82', '#d2caa4', '#ece4c4'), outline: hex('#18160c'), outlineLit: hex('#2e2a1a') };
const EYE_DARK: Material = { ramp: ramp('#07050a', '#16101c'), outline: INK, noAO: true, noOutline: true };
const EYE_GLINT: Material = { ramp: ramp('#ff9a30', '#ffe0a0'), outline: INK, emissive: 0.9, noAO: true, noOutline: true };
const BOOT: Material = { ramp: ramp('#0a080c', '#16121a', '#241e2a', '#342c3c'), outline: hex('#030204') };

// ---------------------------------------------------------------- Helpers

const SE = Math.sin((VIEW_ELEVATION * Math.PI) / 180);
const CE = Math.cos((VIEW_ELEVATION * Math.PI) / 180);
const front = (t: number): Vec3 => ({ x: t * 0.35, y: -0.4, z: 0.85 });
const top = (t = 0): Vec3 => ({ x: t * 0.2, y: 0.75, z: 0.65 });
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

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

interface GourdOpts {
  /** Lobes all the way round. */
  ribs?: number;
  /** How deep the grooves between lobes cut into the silhouette, as a share of the radius. */
  groove?: number;
  bias?: number;
  /** Twists the ribs a little, so no two pumpkins look turned out of the same mould. */
  twist?: number;
}

/**
 * A ribbed gourd: an ellipsoid `r` across and `h` tall (half-sizes, in
 * pixels) whose middle lands on screen at (cx, cy), traced from a camera
 * VIEW_ELEVATION degrees above the horizon. Each pixel's ray is solved
 * against the body (twice, since the grooves pull the radius in), the
 * lobes tilt the normal to either side of their crest, the grooves darken,
 * and the crown dimples in round the stem. Returns the screen y of the
 * crown (where the stem goes).
 */
function gourd(c: PixelCanvas, cx: number, cy: number, r: number, h: number, m: Material, o: GourdOpts = {}): number {
  const ribs = o.ribs ?? 10;
  const depth = o.groove ?? 0.07;
  const twist = o.twist ?? 0;
  const hy = Math.sqrt((h * CE) ** 2 + (r * SE) ** 2);
  for (let y = Math.floor(cy - hy - 1); y <= Math.ceil(cy + hy + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const sx = x + 0.5 - cx;
      const v = -(y + 0.5 - cy);
      let R = r;
      let P: [number, number, number] | null = null;
      let frac = 0.5;
      let phi = 0;
      for (let it = 0; it < 3; it++) {
        // Ray through the screen pixel: P = sx*X + v*U + t*D, with the
        // screen's up U = (0, CE, -SE) and the view direction D = (0, -SE, -CE).
        const a = SE * SE / (h * h) + CE * CE / (R * R);
        const b = (-2 * v * CE * SE) / (h * h) + (2 * v * SE * CE) / (R * R);
        const cc = (sx * sx) / (R * R) + (v * v * CE * CE) / (h * h) + (v * v * SE * SE) / (R * R) - 1;
        const disc = b * b - 4 * a * cc;
        if (disc < 0) {
          P = null;
          break;
        }
        const t = (-b - Math.sqrt(disc)) / (2 * a);
        P = [sx, v * CE - t * SE, -v * SE - t * CE];
        phi = Math.atan2(P[0], P[2]) + twist * (P[1] / h);
        const k = (phi * ribs) / (Math.PI * 2) + 0.5;
        frac = k - Math.floor(k);
        const g = 1 - Math.sin(Math.PI * frac);
        R = r * (1 - depth * g * g);
      }
      if (!P) continue;
      const [px, py, pz] = P;
      const rho = Math.hypot(px, pz) / R;
      let nx = px / (R * R);
      let ny = py / (h * h);
      let nz = pz / (R * R);
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      // Each lobe bulges: its left half faces a little further left, its right half further right.
      const tilt = (frac - 0.5) * 1.3 * Math.min(1, rho * 1.4);
      nx += Math.cos(phi) * tilt;
      nz += -Math.sin(phi) * tilt;
      // The crown sinks toward the stem.
      let bias = o.bias ?? 0;
      if (py > 0 && rho < 0.34) {
        const pull = (0.34 - rho) * 2.2;
        const hl = Math.hypot(px, pz) || 1;
        nx -= (px / hl) * pull;
        nz -= (pz / hl) * pull;
        if (rho < 0.2) bias -= 1;
      }
      const g = 1 - Math.sin(Math.PI * frac);
      if (g > 0.72 && rho > 0.22) bias -= 1;
      else if (g < 0.08 && rho > 0.5) bias += 0;
      const n = { x: nx, y: ny * CE - nz * SE, z: ny * SE + nz * CE };
      const l = Math.hypot(n.x, n.y, n.z) || 1;
      c.px(x, y, m, { x: n.x / l, y: n.y / l, z: n.z / l }, { bias });
    }
  }
  return cy - h * CE;
}

/** A curved stem rising from (x, y), `len` tall, leaning `bend` pixels at its tip, its cut end catching the light. */
function stem(c: PixelCanvas, x: number, y: number, len: number, bend: number, w = 1.3): void {
  c.part();
  c.capsule(x, y + 0.5, x + bend * 0.4, y - len * 0.55, w, w * 0.85, STEM);
  c.capsule(x + bend * 0.4, y - len * 0.55, x + bend, y - len, w * 0.85, w * 0.7, STEM);
  c.part();
  c.px(x + bend, y - len - 0.3, STEM, top(0), { bias: 1 });
}

/** A leaf from (x, y) pointing along `ang` (radians, 0 = right), `len` long and `w` wide, with a darker vein. */
function leaf(c: PixelCanvas, x: number, y: number, ang: number, len: number, w: number, m: Material = LEAF, lift = 0.5): void {
  c.part();
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const R = len + w + 1;
  for (let py = Math.floor(y - R); py <= Math.ceil(y + R); py++) {
    for (let px = Math.floor(x - R); px <= Math.ceil(x + R); px++) {
      const qx = px + 0.5 - x;
      const qy = py + 0.5 - y;
      const a = qx * dx + qy * dy;
      const b = -qx * dy + qy * dx;
      if (a < 0 || a > len) continue;
      const u = a / len;
      // A leaf's outline: broad near the base, drawn to a point, with a lobe notch.
      const half = w * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.1)), 0.7) * (1 - 0.25 * Math.max(0, Math.sin(u * Math.PI * 3)));
      if (Math.abs(b) > half) continue;
      const s = half > 0 ? b / half : 0;
      // Cupped along the vein: each half tilts toward its own side, the whole leaf tilted up to the sky by `lift`.
      const n = { x: -dy * s * 0.6, y: dx * s * 0.6 * -1 + lift, z: 0.8 };
      c.px(px, py, m, n, { bias: Math.abs(b) < 0.5 && u > 0.1 ? -1 : 0 });
    }
  }
}

/** A curling tendril of vine from (x, y), `turns` of a shrinking spiral. */
function tendril(c: PixelCanvas, x: number, y: number, r: number, dir: number, turns = 1.3): void {
  c.part();
  const n = Math.ceil(r * 10 * turns);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = u * turns * Math.PI * 2 * dir;
    const rr = r * (1 - u * 0.7);
    c.px(x + Math.cos(a) * rr - r, y + Math.sin(a) * rr, LEAF, { x: Math.cos(a) * 0.5, y: 0.4, z: 0.8 }, { bias: 1 });
  }
}

/**
 * Carve a face into an already drawn pumpkin: `rows` is a little bitmap
 * ('#' = cut through) centred on (cx, y0). Rows bow upward toward the sides,
 * following the pumpkin's curve as seen from above. Inside the holes the
 * candlelight is brightest in the middle of the face; each hole's lower lip
 * shows the cut flesh, its upper edge the dark inner wall; and a faint halo
 * of light spills over the skin round the carving.
 */
function carve(c: PixelCanvas, cx: number, y0: number, rows: string[], flick: number, seed: number, bow = 1): void {
  const w = rows[0].length;
  const x0 = Math.round(cx - (w - 1) / 2);
  y0 = Math.round(y0);
  const hole = new Set<number>();
  const key = (x: number, y: number) => y * 1000 + x;
  for (let j = 0; j < rows.length; j++) {
    for (let i = 0; i < w; i++) {
      if (rows[j][i] !== '#') continue;
      const u = (i - (w - 1) / 2) / ((w - 1) / 2);
      const x = x0 + i;
      const y = y0 + j - Math.round(bow * u * u);
      if (c.filled(x, y)) hole.add(key(x, y));
    }
  }
  c.part();
  const cyMid = y0 + rows.length / 2;
  for (const k of hole) {
    const y = Math.floor(k / 1000);
    const x = k - y * 1000;
    const above = hole.has(key(x, y - 1));
    const below = hole.has(key(x, y + 1));
    const d = Math.hypot((x + 0.5 - cx) / (w / 2), (y + 0.5 - cyMid) / (rows.length / 2));
    const n = hash2(x, y, seed);
    if (!below && above && hole.has(key(x, y - 2))) {
      c.px(x, y, FLESH, top(0), { glow: 0.3 + flick * 0.25, bias: flick > 0.8 ? 1 : 0 });
      continue;
    }
    const glow = clamp(flick * (1.05 - d * 0.35) + (n - 0.5) * 0.15, 0.3, 1);
    // The far wall under a hole's top edge is in its own shadow; the rest takes the candle's colour, hottest mid-face.
    c.px(x, y, CARVED, { x: 0, y: 0, z: 1 }, { bias: above ? 1 : 0 });
    const hot = clamp(1.2 - d, 0, 1) * (above ? 1 : 0.5);
    c.spark(x, y, [CANDLE_CORE[0], Math.round(CANDLE_CORE[1] * (0.55 + hot * 0.45)), Math.round(CANDLE_CORE[2] * (0.25 + hot * 0.75))], clamp((0.5 + glow * 0.6) * (above ? 1 : 0.85), 0, 1));
  }
  // The halo on the skin round the holes.
  for (const k of hole) {
    const y = Math.floor(k / 1000);
    const x = k - y * 1000;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!hole.has(key(x + ox, y + oy)) && c.filled(x + ox, y + oy)) c.spark(x + ox, y + oy, FLAME_HALO, 0.05 * flick);
    }
  }
}

/** A candle stub standing on (x, base): `h` tall, 2 px wide, wax run down its side, its flame flickering on frame `f`. */
function candle(c: PixelCanvas, x: number, base: number, h: number, f: number, seed: number, wide = true): void {
  const w = wide ? 2 : 1;
  c.part();
  c.shape(base - h + 1, base, () => [x - w / 2, x + w / 2], WAX, (_x, _y, t) => cyl(t, 0.1));
  // The melted rim and drips running down the lit side.
  c.part();
  c.px(x - w / 2, base - h + 1, WAX, top(-0.3), { bias: 1 });
  if (h > 2 && hash2(seed, 1, 71) > 0.35) c.px(x - w / 2, base - h + 2, WAX, cyl(-0.8, 0.2), { bias: 1 });
  if (h > 3 && wide) c.px(x + w / 2 - 1, base - 1, WAX, cyl(0.8, 0.2), { bias: 1 });
  flame(c, x - (wide ? 0 : 0.5), base - h, f, seed);
}

/** A candle flame whose base sits just above (x, y); it leans and stretches from frame to frame. */
function flame(c: PixelCanvas, x: number, y: number, f: number, seed: number): void {
  const r = hash2(f, seed, 311);
  const tall = r > 0.66 ? 3 : r > 0.25 ? 2 : 1.5;
  const lean = hash2(f, seed, 313) > 0.6 ? 1 : 0;
  c.part();
  c.px(x - 0.5, y, WICK_BLACK, top(0));
  c.part();
  c.px(x - 0.5, y - 1, FLAME, { x: 0, y: 0, z: 1 }, { glow: 1, bias: 2 });
  if (tall >= 2) c.px(x - 0.5 + lean * 0.6, y - 2, FLAME, { x: 0, y: 0, z: 1 }, { glow: 1, bias: 1 });
  if (tall >= 3) c.spark(x - 0.5 + lean, y - 3, FLAME_HOT, 0.8);
  c.spark(x - 0.5, y - 1, FLAME_HOT, 0.5);
  // A little halo of light round it.
  const a = 0.18 + r * 0.14;
  for (const [ox, oy] of [[-1, -1], [1, -1], [-1, -2], [1, -2], [0, -3], [0, 0]]) c.spark(x - 0.5 + ox, y + oy, FLAME_HALO, a);
}

// ---------------------------------------------------------------- Jack-o'-lanterns

/** Kind 0: one big pumpkin with a classic toothy grin. */
const GRIN = [
  '..#.......#..',
  '.###.....###.',
  '####..#..####',
  '.....###.....',
  '#...........#',
  '###.#####.###',
  '.###########.',
  '...###.###...',
];
/** Kind 1: the little pumpkin atop the stack, mischievous. */
const SLY = [
  '##...##',
  '.##.##.',
  '...#...',
  '#.#.#.#',
  '.#####.',
];
/** Kind 2: the candle pumpkin, round-eyed and cheerful. */
const CHEER = [
  '.##.....##.',
  '####...####',
  '.##.....##.',
  '.....#.....',
  '#.........#',
  '.#########.',
  '...#####...',
];

/**
 * A jack-o'-lantern for the lawn, frame `f` of LANTERN_FRAMES: the carving
 * flickers. Kind 0 is one big grinning pumpkin; kind 1 a stack of two with
 * the little one carved, a vine and a green gourd; kind 2 a round pumpkin
 * with a candle stub dripping wax on its crown, a ghost-white gourd and
 * autumn leaves beside it.
 */
export function jackLantern(kind: number, frame: number): PixelCanvas {
  const c = new PixelCanvas(LANTERN_W, LANTERN_H);
  const k = ((kind % LANTERN_KINDS) + LANTERN_KINDS) % LANTERN_KINDS;
  const flick = FLICKER[(frame + k * 3) % FLICKER.length];
  const floor = LANTERN_OY + 0.5;
  if (k === 0) {
    c.part();
    const cy = floor - 7.7;
    const crown = gourd(c, 11, cy, 9.5, 7.2, PUMPKIN, { ribs: 10, groove: 0.08, twist: 0.08 });
    carve(c, 11, 11, GRIN, flick, 17, 1.2);
    stem(c, 11, crown + 0.5, 4, 1.8, 1.4);
    leaf(c, 12.5, crown - 0.5, -0.25, 6, 2.2, LEAF, 0.6);
    leaf(c, 16, floor - 0.5, 0.12, 5.5, 2, LEAF_AUTUMN, 0.8);
  } else if (k === 1) {
    // A green gourd at the foot, behind and left.
    c.part();
    gourd(c, 4, floor - 3, 3, 3.8, GOURD_GREEN, { ribs: 8, groove: 0.05 });
    stem(c, 4, floor - 6.4, 1.5, -0.8, 0.8);
    c.part();
    const crown = gourd(c, 12, floor - 6.3, 8, 5.8, PUMPKIN_RED, { ribs: 12, groove: 0.09, twist: -0.2 });
    // The little one sits in the big one's crown.
    c.part();
    const top2 = gourd(c, 12, crown - 3.2, 5.6, 4.4, PUMPKIN, { ribs: 10, groove: 0.08, twist: 0.25 });
    carve(c, 12, crown - 3.7, SLY, flick, 29, 0.8);
    stem(c, 12, top2 + 0.4, 2.8, -1.3, 1.1);
    leaf(c, 11, top2 - 0.5, Math.PI + 0.35, 5, 1.8, LEAF, 0.6);
    tendril(c, 6.8, crown + 1, 1.6, -1);
    leaf(c, 17, floor - 0.5, 0.1, 5, 2, LEAF, 0.8);
  } else {
    // Ghost-white gourd behind, on the right.
    c.part();
    const gTop = gourd(c, 18, floor - 3.2, 3.6, 3, PUMPKIN_PALE, { ribs: 10, groove: 0.1 });
    stem(c, 18, gTop + 0.3, 1.6, 0.8, 0.8);
    c.part();
    const crown = gourd(c, 10, floor - 6.8, 8.2, 6.4, PUMPKIN, { ribs: 12, groove: 0.08, twist: 0.1 });
    carve(c, 10, crown + 4.2, CHEER, flick, 43, 1);
    stem(c, 12.2, crown + 0.6, 2.2, 1.1, 1.1);
    // A puddle of wax on the crown, and the candle stub standing in it.
    c.part();
    c.ellipse(8.4, crown + 1.2, 2.6, 1.1, WAX, { normal: (_x, _y, dx) => top(dx) });
    c.part();
    c.px(6, crown + 2, WAX, cyl(-0.6, 0.2), { bias: 1 });
    c.px(6, crown + 3, WAX, cyl(-0.6, 0.2), { bias: 0 });
    c.px(10.4, crown + 2, WAX, cyl(0.5, 0.2));
    candle(c, 8.5, Math.round(crown + 0.8), 4, frame, 7 + k);
    leaf(c, 5, floor - 0.5, Math.PI - 0.1, 5, 2, LEAF_AUTUMN, 0.8);
  }
  return c;
}

// ---------------------------------------------------------------- The candy stall

const TEXT: Record<string, string[]> = {
  S: ['###', '#..', '###', '..#', '###'],
  W: ['#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  E: ['###', '#..', '##.', '#..', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
};

/** A glass jar of sweets on a shelf, its foot at (x, base), `w` wide and `h` tall. */
function candyJar(c: PixelCanvas, x: number, base: number, w: number, h: number, seed: number, lid: Material = BRASS): void {
  const x0 = Math.round(x - w / 2);
  const top0 = base - h + 1;
  c.part();
  c.shape(top0 + 1, base, (y) => (y === base ? [x0 + 0.5, x0 + w - 0.5] : [x0, x0 + w]), GLASS, (_x, _y, t) => cyl(t, 0.1));
  // The sweets inside, filling it most of the way, a colour per jar with a stray or two.
  const fill = Math.max(2, h - 3);
  const main = CANDY[CANDY_KEYS[Math.floor(hash2(seed, 3, 91) * CANDY_KEYS.length)]];
  c.part();
  for (let y = base - fill + 1; y <= base; y++) {
    for (let px = x0 + 1; px < x0 + w - (y === base ? 1 : 0); px++) {
      const r = hash2(px, y, seed);
      const m = r > 0.82 ? CANDY[CANDY_KEYS[Math.floor(r * 97) % CANDY_KEYS.length]] : main;
      c.px(px, y, m, sphere((r - 0.5) * 1.4, ((px + y) % 2) * 0.6 - 0.3), { bias: -1 });
    }
  }
  // The lit edge of the glass, and the lid.
  c.part();
  for (let y = top0 + 1; y < base; y++) c.px(x0, y, GLASS, cyl(-0.9, 0.2), { bias: 1 });
  c.px(x0 + 1, top0 + 2, GLASS, sphere(-0.4, 0.4), { bias: 2 });
  c.part();
  c.shape(top0, top0, () => [x0 - 0.3, x0 + w + 0.3], lid, (_x, _y, t) => cyl(t, 0.5));
  c.part();
  c.px(x + 0.5 - 1, top0 - 1, lid, top(0));
}

/** A lollipop: a stick from (x, y) up to a swirled round sweet `r` wide. */
function lollipop(c: PixelCanvas, x: number, y: number, len: number, lean: number, r: number, m: Material): void {
  c.part();
  c.line(x, y, x + lean, y - len, CORN_W, () => cyl(0, 0.2));
  c.part();
  const hx = x + lean;
  const hy = y - len - r + 0.5;
  c.ellipse(hx, hy, r, r, m);
  // The swirl: every other ring pixel pales.
  for (let py = Math.floor(hy - r); py <= hy + r; py++) {
    for (let px = Math.floor(hx - r); px <= hx + r; px++) {
      const a = Math.atan2(py + 0.5 - hy, px + 0.5 - hx);
      const d = Math.hypot(px + 0.5 - hx, py + 0.5 - hy);
      if (d < r && Math.sin(a + d * 2.4) > 0.35) c.shade(px, py, 1);
    }
  }
}

/** A sweet in a twist of paper: a round middle and two twisted ends, lying at (x, y). */
function wrappedSweet(c: PixelCanvas, x: number, y: number, body: Material, ends: Material, vertical = false): void {
  c.part();
  if (vertical) {
    c.px(x, y - 2, ends, sphere(0, 0.6));
    c.px(x - 1, y - 3, ends, sphere(-0.5, 0.8));
    c.px(x + 1, y - 3, ends, sphere(0.5, 0.8));
  } else {
    c.px(x - 2, y, ends, sphere(-0.6, 0));
    c.px(x - 3, y - 1, ends, sphere(-0.8, 0.5));
    c.px(x - 3, y + 1, ends, sphere(-0.8, -0.5));
    c.px(x + 2, y, ends, sphere(0.6, 0));
    c.px(x + 3, y - 1, ends, sphere(0.8, 0.5));
    c.px(x + 3, y + 1, ends, sphere(0.8, -0.5));
  }
  c.part();
  c.ellipse(x + 0.5, y + 0.5, 1.7, 1.4, body);
}

/** A paper lantern hung on a string from (x, top), swinging `dx` pixels at its foot. */
function paperLantern(c: PixelCanvas, x: number, topY: number, dx: number, flick: number): void {
  c.part();
  c.line(x, topY, x + dx, topY + 4, WICK_BLACK, () => FLAT_N);
  const lx = x + dx + 0.5;
  const ly = topY + 8.5;
  c.part();
  c.shape(ly - 3, ly - 3, () => [lx - 1.5, lx + 1.5], IRON, (_x, _y, t) => cyl(t, 0.4));
  c.part();
  c.ellipse(lx, ly + 0.3, 3.6, 3.2, LANTERN_PAPER, { glow: 0.45 + flick * 0.35, normal: (_x, _y, dx2, dy) => sphere(dx2 * 0.9, dy * 0.4, 1) });
  // Bamboo ribs across the paper.
  for (const ry of [-1.5, 0.5, 2.5]) for (let px = Math.floor(lx - 3.6); px <= lx + 3.6; px++) c.shade(px, ly + ry, -2);
  c.part();
  c.shape(ly + 3.5, ly + 3.5, () => [lx - 1.5, lx + 1.5], IRON, (_x, _y, t) => cyl(t, 0.4));
  c.part();
  c.px(lx - 0.5, ly + 4.5, TRIM, sphere(0, 0));
  c.px(lx - 0.5, ly + 5.5, TRIM, sphere(0, -0.3), { bias: -1 });
  // Its light spilling round it.
  for (let a = 0; a < 12; a++) {
    const t = (a / 12) * Math.PI * 2;
    c.spark(lx + Math.cos(t) * 4.6, ly + 0.3 + Math.sin(t) * 4.2, FLAME_HALO, 0.1 * flick);
  }
}
const FLAT_N: Vec3 = { x: 0, y: 0, z: 1 };

/** A small jack-o'-lantern hung from (x, top) by a wire bail, swinging `dx`. */
function hangingPumpkin(c: PixelCanvas, x: number, topY: number, dx: number, flick: number): void {
  c.part();
  c.line(x, topY, x + dx, topY + 4, WICK_BLACK, () => FLAT_N);
  const px = x + dx + 0.5;
  const py = topY + 8.5;
  c.part();
  c.line(px - 3, py - 1, px - 0.5, topY + 4, IRON, () => FLAT_N);
  c.line(px + 3, py - 1, px + 0.5, topY + 4, IRON, () => FLAT_N);
  c.part();
  const crown = gourd(c, px, py, 4.2, 3.4, PUMPKIN, { ribs: 10, groove: 0.08 });
  carve(c, px, py - 1, ['#...#', '.....', '#####', '.###.'], flick, 61, 0.5);
  stem(c, px, crown + 0.3, 1.4, 0.6, 0.8);
}

/** The awning's stripe index at (x, y): stripes run from the back edge to the front, fanning a little. */
function stripeAt(x: number, y: number): number {
  const u = clamp((y - AWN_BACK) / (AWN_FRONT - AWN_BACK), 0, 1);
  const hw = 32 + u * 3.5;
  const s = (x + 0.5 - STALL_OX) / hw;
  return Math.floor((s + 1) * AWN_STRIPES * 0.5);
}
const AWN_BACK = 2;
const AWN_FRONT = 9;
const AWN_STRIPES = 10;
const COUNTER_TOP = 39;

/**
 * The part of the stall behind the keeper, frame `f`: back posts, the plank
 * back wall with shelves of candy jars, the striped scalloped awning, and
 * two lanterns hung from its front edge swaying.
 */
export function stallBack(frame: number): PixelCanvas {
  const c = new PixelCanvas(STALL_W, STALL_H);
  const ph = (frame / STALL_FRAMES) * Math.PI * 2;
  const flick = FLICKER[frame % FLICKER.length];

  // The back posts.
  for (const x of [9, 62]) {
    c.part();
    c.shape(8, 46, () => [x - 1.5, x + 1.5], WOOD_DK, (_x, _y, t) => cyl(t, 0.1), { bias: -1 });
  }
  // The plank back wall, in the awning's shade.
  c.part();
  c.shape(10, 46, () => [10.5, 61.5], PLANK, (px, py) => {
    const k = (px - 11) % 5;
    const n = hash2(Math.floor((px - 11) / 5), Math.floor(py / 3), 501);
    return { x: k === 0 ? -0.5 : k === 4 ? 0.4 : (n - 0.5) * 0.2, y: -0.15, z: 0.9 };
  });
  for (let y = 10; y <= 46; y++) {
    for (let x = 11; x <= 61; x++) {
      if ((x - 11) % 5 === 0) c.shade(x, y, -1);
      else if (hash2(x, y, 503) > 0.9) c.shade(x, y, -1);
      if (y < 13) c.shade(x, y, -1);
    }
  }
  // Two shelves with iron brackets, candy jars along them.
  for (const [sy, seed] of [
    [21, 1],
    [31, 2],
  ]) {
    c.part();
    c.shape(sy, sy, () => [10.5, 61.5], WOOD, (_x, _y, t) => top(t));
    c.part();
    c.shape(sy + 1, sy + 1, () => [10.5, 61.5], WOOD, (_x, _y, t) => front(t), { bias: 1 });
    for (const bx of [14, 58]) {
      c.part();
      c.px(bx, sy + 2, IRON, front(0));
      c.px(bx, sy + 3, IRON, front(0), { bias: -1 });
    }
    const jars: [number, number, number][] = sy === 21
      ? [[14, 5, 6], [19.5, 4, 5], [52.5, 5, 7], [58, 4, 5]]
      : [[13.5, 4, 5], [18.5, 5, 7], [52.5, 4, 5], [58, 5, 7]];
    jars.forEach(([jx, w, h], i) => candyJar(c, jx, sy - 1, w, h, seed * 10 + i, i % 3 === 1 ? CLOTH_P : BRASS));
    if (sy === 31) {
      // A lollipop jar needs its lollipops, and a pumpkin sits on the end.
      lollipop(c, 17.5, 25, 2, -1, 1.5, CANDY.pink);
      lollipop(c, 19.5, 25, 3, 1, 1.5, CANDY.green);
    }
  }
  // A velvet curtain hung in the middle, so the keeper stands out against something quiet.
  c.part();
  c.shape(12, 46, () => [24, 49], CURTAIN, (px, py) => {
    const fold = Math.sin((px - 24) * 1.15 + (py > 30 ? (py - 30) * 0.05 : 0));
    return { x: fold * 0.6, y: -0.1, z: 0.8 };
  });
  for (let y = 12; y <= 46; y++) for (let x = 24; x < 49; x++) if (Math.sin((x - 24) * 1.15) < -0.85) c.shade(x, y, -1);
  c.part();
  c.shape(11, 11, () => [22.5, 50.5], BRASS, (_x, _y, t) => cyl(t, 0.5));
  for (const rx of [22, 50]) {
    c.part();
    c.ellipse(rx + 0.5, 11.5, 1.2, 1.2, BRASS);
  }
  // Tiebacks: an orange cord with a tassel gathering each side.
  for (const tx of [25, 47]) {
    c.part();
    c.px(tx, 30, TRIM, sphere(0, 0.2));
    c.px(tx, 31, TRIM, sphere(0, -0.2), { bias: -1 });
    c.px(tx, 32, TRIM, sphere(0, -0.4), { bias: -1 });
  }

  // The awning: a sloped canvas of purple and orange stripes, a valance, and scallops below.
  const cloth = (x: number, y: number) => (stripeAt(x, y) % 2 === 0 ? CLOTH_P : CLOTH_O);
  c.part();
  for (let y = AWN_BACK; y <= AWN_FRONT; y++) {
    const u = (y - AWN_BACK) / (AWN_FRONT - AWN_BACK);
    const hw = 32 + u * 3.5;
    for (let x = Math.round(STALL_OX - hw); x < Math.round(STALL_OX + hw); x++) {
      const s = (x + 0.5 - STALL_OX) / hw;
      const t = ((s + 1) * AWN_STRIPES * 0.5) % 1;
      // The canvas sags between the ribs a stripe apart.
      const sag = (t - 0.5) * -0.5;
      c.px(x, y, cloth(x, y), { x: sag + s * 0.1, y: 0.6, z: 0.8 }, { bias: t < 0.1 || t > 0.9 ? -1 : 0 });
    }
  }
  // The ridge pole along the back, with a finial each end.
  c.part();
  c.shape(AWN_BACK - 1, AWN_BACK - 1, () => [STALL_OX - 32.5, STALL_OX + 32.5], WOOD, (_x, _y, t) => cyl(t, 0.6));
  for (const fx of [STALL_OX - 33, STALL_OX + 33]) {
    c.part();
    c.ellipse(fx, AWN_BACK - 1, 1.6, 1.6, CLOTH_O);
  }
  // The valance: the canvas turned down over the front edge, piped along the top.
  c.part();
  for (let y = AWN_FRONT + 1; y <= AWN_FRONT + 2; y++) {
    for (let x = STALL_OX - 36; x < STALL_OX + 36; x++) c.px(x, y, cloth(x, AWN_FRONT), front((x - STALL_OX) / 36));
  }
  c.part();
  for (let x = STALL_OX - 36; x < STALL_OX + 36; x++) c.px(x, AWN_FRONT + 1, (x & 1) === 0 ? BRASS : TRIM, cyl((x - STALL_OX) / 40, 0.5));
  // Scallops: a rounded tab hanging under every stripe.
  c.part();
  for (let x = STALL_OX - 36; x < STALL_OX + 36; x++) {
    const hw = 35.5;
    const s = (x + 0.5 - STALL_OX) / hw;
    const t = ((s + 1) * AWN_STRIPES * 0.5) % 1;
    const d = Math.round(Math.sqrt(Math.max(0, 1 - (t * 2 - 1) ** 2)) * 2.6);
    for (let k = 1; k <= d; k++) c.px(x, AWN_FRONT + 2 + k, cloth(x, AWN_FRONT), { x: (t - 0.5) * 0.8, y: -0.5 - k * 0.1, z: 0.8 }, { bias: k === d ? -1 : 0 });
  }

  // Lanterns hanging from under the awning's front, swaying out of step.
  const sw1 = Math.round(Math.sin(ph) * 0.9);
  const sw2 = Math.round(Math.sin(ph + 2.2) * 0.9);
  paperLantern(c, 15, AWN_FRONT + 4, sw1, flick);
  hangingPumpkin(c, 57, AWN_FRONT + 4, sw2, FLICKER[(frame + 2) % FLICKER.length]);
  return c;
}

/**
 * The part of the stall in front of the keeper, frame `f`: the counter with
 * its sign and candy-corn skirt, sweets on top, the front posts, and a
 * cauldron bubbling green and a couple of pumpkins at its foot.
 */
export function stallFront(frame: number): PixelCanvas {
  const c = new PixelCanvas(STALL_W, STALL_H);
  const ph = (frame / STALL_FRAMES) * Math.PI * 2;
  const L = 5;
  const R = 67;
  const faceTop = COUNTER_TOP + 3;
  const foot = STALL_OY;

  // The counter's front: purple-painted planks, worn to the wood at the edges.
  c.part();
  c.shape(faceTop, foot, () => [L, R], PAINT_P, (px) => {
    const k = (px - L) % 7;
    return { x: k === 0 ? -0.5 : k === 6 ? 0.45 : 0, y: -0.35, z: 0.9 };
  });
  for (let y = faceTop; y <= foot; y++) {
    for (let x = L; x < R; x++) {
      if ((x - L) % 7 === 0) c.shade(x, y, -1);
      if (hash2(x, y, 521) > 0.93) c.shade(x, y, 1);
    }
  }
  // A candy-corn skirt: a row of kernels, yellow at the base, orange, then a white tip.
  c.part();
  const band0 = foot - 6;
  c.shape(band0 - 1, band0 - 1, () => [L, R], TRIM, (_x, _y, t) => cyl(t, 0.3));
  for (let x = L + 1; x < R - 1; x++) {
    const k = (x - L - 1) % 6;
    for (let y = band0; y <= foot - 1; y++) {
      // Each kernel is a triangle, point up, narrowing a pixel a side every two rows.
      const rise = foot - 1 - y;
      if (Math.abs(k - 2.5) + 0.5 > 3 - Math.floor(rise / 2)) continue;
      const m = rise < 2 ? CORN_Y : rise < 4 ? CORN_O : CORN_W;
      c.px(x, y, m, { x: (k - 2.5) * 0.15, y: -0.3, z: 0.9 });
    }
  }
  // The sign: a cream board with SWEETS painted on it, hung on two nails.
  const sx0 = STALL_OX - 15;
  const sx1 = STALL_OX + 15;
  const sy0 = faceTop + 2;
  const sy1 = sy0 + 8;
  c.part();
  c.shape(sy0, sy1, () => [sx0, sx1 + 1], WOOD, (px, py) => (py === sy0 ? top(0) : front((px - STALL_OX) / 16)));
  c.part();
  c.shape(sy0 + 1, sy1 - 1, () => [sx0 + 1, sx1], PAINT_CREAM, (px) => front((px - STALL_OX) / 16));
  for (let x = sx0 + 1; x <= sx1; x++) if (hash2(x, 7, 531) > 0.8) c.shade(x, sy1 - 1, -1);
  c.part();
  let tx = STALL_OX - 12;
  for (const ch of 'SWEETS') {
    const g = TEXT[ch];
    for (let j = 0; j < 5; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] === '#') c.px(tx + i, sy0 + 2 + j, PAINT_P, front(0), { bias: 2 });
    tx += g[0].length + 1;
  }
  for (const nx of [sx0 + 1, sx1 - 1]) {
    c.part();
    c.px(nx, sy0 + 1, IRON, sphere(0, 0.4), { bias: 2 });
  }

  // The counter top: a thick oak board, its front lip catching the light.
  c.part();
  c.shape(COUNTER_TOP, COUNTER_TOP + 1, () => [L - 1, R + 1], WOOD, (px) => top((px - STALL_OX) / 40));
  for (let x = L - 1; x <= R; x++) if (hash2(x, 1, 541) > 0.7) c.shade(x, COUNTER_TOP + (x % 2), -1);
  c.part();
  c.shape(COUNTER_TOP + 2, COUNTER_TOP + 2, () => [L - 1, R + 1], WOOD, (px) => front((px - STALL_OX) / 40), { bias: 1 });

  // On the counter: a wicker basket heaped with wrapped sweets on the left...
  c.part();
  c.shape(COUNTER_TOP - 3, COUNTER_TOP + 1, (y) => [8 + (y - COUNTER_TOP + 3) * 0.3, 21 - (y - COUNTER_TOP + 3) * 0.3], WICKER, (px, py, t) => {
    const weave = ((px + py) & 1) === 0 ? 0.25 : -0.25;
    return cyl(t + weave * 0.3, 0.1);
  });
  for (let y = COUNTER_TOP - 3; y <= COUNTER_TOP + 1; y++) for (let x = 8; x <= 21; x++) if (((x + y * 2) & 3) === 0) c.shade(x, y, -1);
  c.part();
  c.shape(COUNTER_TOP - 4, COUNTER_TOP - 4, () => [7.5, 21.5], WICKER, (_x, _y, t) => cyl(t, 0.6), { bias: 1 });
  const sweets: [number, number, string, string][] = [
    [11, COUNTER_TOP - 6, 'orange', 'violet'],
    [17, COUNTER_TOP - 6, 'violet', 'orange'],
    [14, COUNTER_TOP - 8, 'pink', 'white'],
  ];
  for (const [x, y, b, e] of sweets) wrappedSweet(c, x, y, CANDY[b], CANDY[e]);
  // ...candy apples on sticks in the middle, before the keeper...
  for (const [ax, m] of [
    [28, CANDY.red],
    [44, CANDY.red],
  ] as [number, Material][]) {
    c.part();
    c.line(ax, COUNTER_TOP - 5, ax, COUNTER_TOP - 2, WOOD, () => cyl(0, 0.3));
    c.part();
    c.ellipse(ax + 0.5, COUNTER_TOP - 0.2, 2.3, 2, m);
    c.part();
    c.ellipse(ax + 0.5, COUNTER_TOP + 1, 2.8, 0.9, CORN_Y, { normal: (_x, _y, dx) => top(dx) });
  }
  wrappedSweet(c, 36, COUNTER_TOP, CANDY.green, CANDY.yellow);
  // ...and a big jar of lollipops with a tiny pumpkin by it on the right.
  lollipop(c, 54.5, COUNTER_TOP - 6, 3, -1.5, 1.8, CANDY.violet);
  lollipop(c, 56.5, COUNTER_TOP - 6, 5, 0, 1.8, CANDY.orange);
  lollipop(c, 58.5, COUNTER_TOP - 6, 3, 1.5, 1.8, CANDY.green);
  candyJar(c, 56.5, COUNTER_TOP + 1, 7, 8, 77, CLOTH_P);
  c.part();
  const tp = gourd(c, 63.5, COUNTER_TOP - 1.2, 3.2, 2.5, PUMPKIN_PALE, { ribs: 8 });
  stem(c, 63.5, tp + 0.3, 1.2, 0.6, 0.7);

  // The front posts, a ribbon of orange wound round each.
  for (const x of [4, 68]) {
    c.part();
    c.shape(AWN_FRONT + 3, foot, () => [x - 1.8, x + 1.8], WOOD_DK, (_x, _y, t) => cyl(t, 0.1));
    c.part();
    for (let y = AWN_FRONT + 4; y < foot - 1; y++) {
      const k = (y + (x > 36 ? 3 : 0)) % 6;
      if (k < 2) c.px(x - 1 + k * 1.5, y, TRIM, cyl(-0.3 + k * 0.6, 0.2));
    }
    c.part();
    c.shape(foot - 1, foot, () => [x - 2.3, x + 2.3], WOOD_DK, (_x, _y, t) => cyl(t, 0.3), { bias: 1 });
  }

  // A pair of pumpkins at the foot on the right.
  c.part();
  const p1 = gourd(c, 63.5, foot - 2.8, 6, 4.5, PUMPKIN, { ribs: 12, groove: 0.08, twist: 0.2 });
  stem(c, 64, p1 + 0.4, 2, 1.2, 1);
  leaf(c, 65, p1 - 0.3, -0.3, 4, 1.6, LEAF, 0.6);
  c.part();
  const p2 = gourd(c, 55, foot + 0.2, 3.8, 2.9, PUMPKIN_RED, { ribs: 10, groove: 0.08 });
  stem(c, 55, p2 + 0.3, 1.2, -0.6, 0.8);

  // The cauldron on the left: three iron feet over a little fire, green brew bubbling in it.
  const kx = 8.5;
  const ky = foot - 4;
  c.part();
  c.capsule(kx - 4, ky + 3, kx + 4, ky + 3.5, 1, 1, LOG);
  c.capsule(kx - 3, ky + 4, kx + 3.5, ky + 2.6, 0.9, 0.9, LOG, { bias: 1 });
  for (let k = 0; k < 4; k++) c.px(kx - 2 + k * 1.5, ky + 3 + (k % 2), EMBERS, top(0), { glow: 0.6 + 0.4 * Math.sin(ph * 2 + k) });
  for (const lx of [kx - 5, kx + 5]) {
    c.part();
    c.capsule(lx, ky - 1, lx + (lx < kx ? -0.6 : 0.6), ky + 3, 0.8, 0.7, IRON);
  }
  c.part();
  c.shape(ky - 6, ky + 2, (y) => {
    const u = (y - (ky - 6)) / 8;
    const hw = 6.4 * Math.sqrt(Math.max(0, 1 - Math.pow(u * 1.3 - 0.3, 2)));
    return hw > 0.5 ? [kx - hw, kx + hw] : null;
  }, IRON, (_x, y, t) => sphere(t * 0.95, (ky - 3 - y) / 6, 1));
  c.part();
  c.ellipse(kx, ky - 6.2, 6.2, 1.9, IRON, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, -dy * 0.5 + 0.4, 1) });
  c.part();
  for (let y = Math.floor(ky - 7); y <= ky - 5; y++) {
    for (let x = Math.floor(kx - 5); x <= kx + 5; x++) {
      const dx = (x + 0.5 - kx) / 4.9;
      const dy = (y + 0.5 - (ky - 6.2)) / 1.3;
      const r = dx * dx + dy * dy;
      if (r > 1) continue;
      const s = Math.sin(x * 1.3 + y * 2 + ph * 2) * 0.5 + 0.5;
      c.px(x, y, BREW, { x: 0, y: 0.6, z: 0.8 }, { bias: Math.round(s * 2 - r), glow: 0.6 + s * 0.35 });
    }
  }
  // Bubbles rising and popping, and a green fume curling up.
  for (let b = 0; b < 3; b++) {
    const t = ((frame + b * 2) % STALL_FRAMES) / STALL_FRAMES;
    const bx = kx - 3 + b * 3 + (b === 1 ? 0 : 0.5);
    if (t < 0.5) c.spark(bx, ky - 6.5, [220, 255, 160], 0.9 - t);
    else c.spark(bx, ky - 7 - (t - 0.5) * 4, BREW_HALO, 0.6);
  }
  for (let k = 0; k < 4; k++) {
    const t = ((frame / STALL_FRAMES) + k / 4) % 1;
    c.spark(kx + Math.sin(ph + k * 1.7) * 2, ky - 8 - t * 9, BREW_HALO, (1 - t) * 0.45);
  }
  c.part();
  c.shape(ky - 5, ky - 5, () => [kx - 7, kx - 6], IRON, () => cyl(-0.8, 0.3));
  c.shape(ky - 5, ky - 5, () => [kx + 6, kx + 7], IRON, () => cyl(0.8, 0.3));
  return c;
}

// ---------------------------------------------------------------- Old Wick, the Candlewitch

/**
 * Old Wick, frame `f`: she breathes, bobs the wrapped sweet she holds up,
 * and the candles on her hat brim flicker, each on its own beat.
 */
export function oldWick(frame: number): PixelCanvas {
  const c = new PixelCanvas(WICK_W, WICK_H);
  const cx = WICK_OX;
  const ph = (frame / WICK_FRAMES) * Math.PI * 2;
  const U = Math.round(Math.sin(ph) * 0.5 * 2) / 2;
  const bob = Math.round(Math.sin(ph + 1.2) * 0.8);
  const hdy = 16.4 + U;
  const by = 11.6 + U;
  const BRIM_RX = 10.2;
  const BRIM_RY = 2.4;

  // Wild white hair behind her, spilling past the shoulders.
  c.part();
  for (const s of [-1, 1]) {
    c.ellipse(cx + s * 4.6, 19.6 + U, 3, 4.6, WHITE_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, -dy * 0.6, 1), bias: -1 });
  }
  for (const [x, y] of [[cx - 8, 16], [cx - 8, 20], [cx - 7, 23], [cx + 8, 17], [cx + 8, 21], [cx + 7, 24], [cx + 8, 19]]) {
    c.px(x, y + U, WHITE_HAIR, sphere(x < cx ? -0.7 : 0.7, 0.2), { bias: hash2(x, y, 601) > 0.5 ? 0 : -1 });
  }

  // Skirts to the ground, a ragged hem, pointed boots peeking out.
  for (const s of [-1, 1]) {
    c.part();
    c.ellipse(cx + s * 2.6, 34.4, 2.2, 1.2, BOOT, { flatten: 0.8 });
    c.px(cx + s * 4.6, 33.8, BOOT, sphere(s * 0.6, 0.5));
  }
  c.part();
  c.shape(25 + U, 34, (y) => {
    const u = (y - 25 - U) / (9 - U);
    const hw = 4.4 + u * 3.2;
    return [cx - hw, cx + hw];
  }, DRESS, (_x, y, t) => sphere(t * 0.9, 0.15 - (y - 25) * 0.02, 1));
  for (let x = cx - 7; x <= cx + 7; x++) if (hash2(x, 3, 607) > 0.55) c.erase(x, 34);
  for (let y = 28; y <= 33; y++) {
    c.shade(cx - 2, y, -1);
    c.shade(cx + 3, y, -1);
  }
  // The bodice, and a belt hung with a little brass key.
  c.part();
  c.shape(19.5 + U, 26 + U, (y) => {
    const hw = 4.4 - (y - 19.5 - U) * 0.08;
    return [cx - hw, cx + hw];
  }, DRESS, (_x, y, t) => sphere(t * 0.9, (22 - y) / 8, 1));
  c.part();
  c.shape(Math.round(25.5 + U), Math.round(25.5 + U), () => [cx - 4.4, cx + 4.4], WOOD_DK, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx + 1, 25.5 + U, BRASS, sphere(0, 0.3), { bias: 1 });
  c.px(cx + 2, 26.5 + U, BRASS, sphere(0.3, 0));
  c.px(cx + 2, 27.5 + U, BRASS, sphere(0.3, -0.2), { bias: -1 });

  // The shawl: over the shoulders and down to a point in front, trimmed and fringed in orange.
  const shawlEdge = (x: number) => 22.6 + U + (1 - Math.abs(x - cx) / 7.5) * 3.6;
  c.part();
  for (let x = cx - 7; x <= cx + 7; x++) {
    const e = shawlEdge(x + 0.5);
    for (let y = Math.round(19.4 + U + Math.abs(x + 0.5 - cx) * 0.16); y < e; y++) {
      const t = (x + 0.5 - cx) / 7.5;
      const fold = Math.sin((x - cx) * 1.3 + y * 0.4) * 0.25;
      c.px(x, y, SHAWL, sphere(t * 0.9 + fold, (20.5 + U - y) / 6, 1), { bias: -1 });
    }
  }
  c.part();
  for (let x = cx - 7; x <= cx + 7; x++) {
    const y = Math.floor(shawlEdge(x + 0.5));
    c.px(x, y, TRIM, sphere((x - cx) / 8, -0.3), { bias: -1 });
    if ((x & 1) === 0) c.px(x, y + 1, TRIM, sphere((x - cx) / 8, -0.5), { bias: -2 });
  }
  // A brooch at her throat: a little amber jewel, lit as if a candle's in it.
  c.part();
  c.px(cx, 20.4 + U, EYE_GLINT, sphere(0, 0), { glow: 0.5 + 0.3 * FLICKER[frame % 4] });

  // Her right arm (our right) hangs, a gnarled hand holding the shawl's corner.
  c.part();
  c.capsule(cx + 6.2, 20.5 + U, cx + 7.4, 24.5 + U, 1.6, 1.4, SHAWL, { bias: -1 });
  c.part();
  c.ellipse(cx + 7.2, 25.6 + U, 1.4, 1.3, OLD_SKIN);
  c.px(cx + 6.2, 26.2 + U, OLD_SKIN, sphere(-0.4, -0.3), { bias: -1 });

  // Her left arm (our left) raised out to the side, offering a wrapped sweet.
  const hx = cx - 9.5;
  const hy = 18 + U + bob;
  c.part();
  c.capsule(cx - 6, 20.5 + U, cx - 8.6, 23 + U, 1.6, 1.5, SHAWL, { bias: -1 });
  c.part();
  c.capsule(cx - 8.6, 23 + U, hx, hy + 1.4, 1.4, 1.2, SHAWL, { bias: -2 });
  c.part();
  c.ellipse(hx + 0.2, hy + 0.3, 1.4, 1.3, OLD_SKIN);
  c.px(hx + 1.2, hy - 0.6, OLD_SKIN, sphere(0.5, 0.5));
  wrappedSweet(c, hx, hy - 2.2, TRIM, CLOTH_P, false);
  if (frame % 3 === 0) c.spark(hx - 3, hy - 4, [255, 236, 180], 0.7);

  // Her head: sallow and lined, a long hooked nose with a wart, a sly smile.
  c.part();
  c.ellipse(cx, hdy, 3.3, 3.5, OLD_SKIN);
  c.part();
  c.capsule(cx - 3.9, 14 + U, cx - 4.8, 20.5 + U, 1, 1.3, WHITE_HAIR);
  c.capsule(cx + 3.9, 14 + U, cx + 4.8, 20.5 + U, 1, 1.3, WHITE_HAIR);
  c.part();
  for (const s of [-1, 1]) {
    c.px(cx + s * 1.5, hdy - 0.5, EYE_DARK, FLAT_N);
    c.px(cx + s * 1.5, hdy - 1.5, WHITE_HAIR, sphere(0, 0.6), { bias: 1 });
    c.px(cx + s * 2.5, hdy - 1.5, WHITE_HAIR, sphere(s * 0.4, 0.6));
  }
  // One eye glints with candlelight.
  c.px(cx + 1.5, hdy - 0.5, EYE_GLINT, FLAT_N, { glow: 0.55 + 0.35 * FLICKER[(frame + 1) % 4] });
  c.part();
  c.capsule(cx + 0.2, hdy - 0.2, cx + 1, hdy + 2.9, 0.85, 0.6, OLD_SKIN);
  c.part();
  c.px(cx + 1, hdy + 1, OLD_SKIN, sphere(0.6, 0.4), { bias: 1 });
  // A crooked grin to one side, a pointed chin.
  c.shade(cx - 1, hdy + 2, -2);
  c.shade(cx - 2, hdy + 1.6, -2);
  c.shade(cx + 2, hdy + 2, -1);
  c.shade(cx, hdy + 3, -1);
  c.shade(cx - 2, hdy + 0.6, 1);
  for (let x = cx - 3; x <= cx + 3; x++) c.shade(x, hdy - 2.5, -1);

  // The hat: a crooked brim, a tall crown bent over at the tip.
  const tiltAt = (x: number) => (x - cx) * 0.07;
  // A candle on the far side of the brim, behind the crown.
  candle(c, cx - 6, Math.round(by - 1.2 + tiltAt(cx - 6)), 3, frame, 101);
  c.part();
  for (let y = Math.floor(by - BRIM_RY - 1); y <= by + BRIM_RY + 1; y++) {
    for (let x = cx - 11; x <= cx + 11; x++) {
      const dx = (x + 0.5 - cx) / BRIM_RX;
      const dy = (y + 0.5 - by - tiltAt(x)) / BRIM_RY;
      const r = dx * dx + dy * dy;
      if (r > 1) continue;
      // The brim's top face dishes up at the rim, so the rim itself catches the light.
      const rim = r > 0.65 ? 0.4 : 0;
      c.px(x, y, HAT_FELT, { x: dx * rim, y: 0.7 - dy * rim, z: 0.7 }, { bias: r > 0.65 && dy > 0.3 ? 1 : 0 });
    }
  }
  const crownTop = U;
  const crownAt = (y: number) => {
    const u = (y - crownTop) / (by - 0.2 - crownTop);
    return { hw: 0.6 + u * 4.2, lean: Math.pow(1 - u, 2) * 5.5 - u * 0.4 };
  };
  c.part();
  c.shape(Math.round(crownTop), Math.round(by - 0.2), (y) => {
    const { hw, lean } = crownAt(y);
    return [cx + lean - hw, cx + lean + hw];
  }, HAT_FELT, (_x, y, t) => cyl(t, 0.3 - (y - U) * 0.02));
  // A dent in the crown, and the tip flopped over.
  c.shade(cx + 1, by - 5, -1);
  c.shade(cx + 2, by - 5, -1);
  c.shade(cx + 2, by - 6, -1);
  c.part();
  c.px(cx + 7, U + 1, HAT_FELT, sphere(0.6, 0.2));
  c.px(cx + 8, U + 2, HAT_FELT, sphere(0.7, -0.2), { bias: -1 });
  // The band: orange, with a brass buckle.
  c.part();
  for (let y = Math.round(by - 2); y <= Math.round(by - 1); y++) {
    const { hw, lean } = crownAt(y);
    c.shape(y, y, () => [cx + lean - hw, cx + lean + hw], TRIM, (_x, _y, t) => cyl(t, 0.2));
  }
  c.part();
  c.px(cx - 1, by - 2, BRASS, sphere(-0.2, 0.3), { bias: 1 });
  c.px(cx - 1, by - 1, BRASS, sphere(-0.2, 0));
  c.px(cx, by - 2, BRASS, sphere(0, 0.3));
  c.px(cx, by - 1, BRASS, sphere(0, 0), { bias: -1 });
  // Candles along the near brim, each with its own flicker and a drip of wax over the rim.
  const brimCandles: [number, number, number][] = [
    [cx - 8.5, 3, 103],
    [cx - 5, 2, 107],
    [cx + 5.5, 4, 109],
    [cx + 8.5, 2, 113],
  ];
  for (const [x, h, seed] of brimCandles) {
    const dx = (x - cx) / BRIM_RX;
    const base = Math.round(by + tiltAt(x) + Math.sqrt(Math.max(0, 1 - dx * dx)) * BRIM_RY * 0.55);
    candle(c, x, base, h, (frame + seed) % WICK_FRAMES, seed);
    c.part();
    c.px(x - 1, base + 1, WAX, cyl(-0.5, 0.2), { bias: 1 });
  }
  return c;
}

// ---------------------------------------------------------------- Ground fog

/**
 * A low bank of fog, FOG_W x FOG_H RGBA (unlit, straight alpha): wisps
 * stretched along the ground, heaped a little higher in the middle, their
 * edges torn by noise and feathered to nothing at every border. Violet-grey,
 * paler on the tops of the swells. Alpha steps in eighths so it stays
 * pixel art when drawn scaled.
 */
export function fogBank(kind: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(FOG_W * FOG_H * 4);
  const seed = 900 + kind * 37;
  for (let y = 0; y < FOG_H; y++) {
    for (let x = 0; x < FOG_W; x++) {
      const u = ((x + 0.5) / FOG_W) * 2 - 1;
      const v = ((y + 0.5) / FOG_H) * 2 - 1;
      // The bank's outline: an oval, its top edge rolling in swells.
      const swell = (fbm(x + kind * 300, 0, 18, seed + 5, 2) - 0.5) * 0.9;
      const d = u * u + Math.pow(Math.max(0, -v - swell * 0.5) + Math.max(0, v), 2) * 1.2 + (v < 0 ? v * v * 0.3 : 0);
      const env = clamp((1 - d) / 0.55, 0, 1);
      if (env <= 0 || x === 0 || y === 0 || x === FOG_W - 1 || y === FOG_H - 1) continue;
      // Wisps: noise stretched along the ground.
      const n = fbm(x * 0.35 + kind * 200, y * 2.2, 10, seed, 4);
      // Finer streaks drawn out along the ground, tearing gaps through the body.
      const streak = fbm(x * 0.2 + kind * 90, y * 3.4, 6, seed + 11, 2);
      const wisp = clamp((n * 0.7 + streak * 0.3 - 0.4 + env * 0.12) / 0.26, 0, 1);
      let a = Math.pow(env, 1.6) * wisp * 0.9;
      a = Math.round(a * 8) / 8;
      if (a <= 0) continue;
      const lift = clamp(0.5 - v * 0.5 + (n - 0.5) * 0.6, 0, 1);
      const i = (y * FOG_W + x) * 4;
      px[i] = Math.round(128 + lift * 70);
      px[i + 1] = Math.round(120 + lift * 66);
      px[i + 2] = Math.round(158 + lift * 66);
      px[i + 3] = Math.round(a * 255);
    }
  }
  return px;
}

// ---------------------------------------------------------------- Registration

/**
 * Register the decorations once: 'hw_lantern' (frames l<kind>_<frame>,
 * animations hw_lantern_<kind> and hw_lantern_e_<kind> for the glow),
 * 'hw_stall_back' / 'hw_stall_front' and 'hw_wick' (frames f<n>, with
 * <key>_loop and <key>_e_loop), and 'hw_fog' (frames g0..g2, unlit).
 */
export function registerHallowsDecor(scene: Phaser.Scene): void {
  if (scene.textures.exists('hw_lantern')) return;
  const lanterns: { name: string; r: ReturnType<PixelCanvas['render']> }[] = [];
  for (let k = 0; k < LANTERN_KINDS; k++) for (let f = 0; f < LANTERN_FRAMES; f++) lanterns.push({ name: `l${k}_${f}`, r: jackLantern(k, f).render() });
  registerAtlas(scene, 'hw_lantern', packAtlas(lanterns, LANTERN_W, LANTERN_H, LANTERN_FRAMES), LANTERN_W, LANTERN_H);
  for (let k = 0; k < LANTERN_KINDS; k++) {
    for (const [anim, tex] of [[`hw_lantern_${k}`, 'hw_lantern'], [`hw_lantern_e_${k}`, 'hw_lantern_e']]) {
      if (scene.anims.exists(anim)) continue;
      scene.anims.create({ key: anim, frames: scene.anims.generateFrameNames(tex, { prefix: `l${k}_`, start: 0, end: LANTERN_FRAMES - 1 }), frameRate: 6, repeat: -1 });
    }
  }

  const sheet = (key: string, n: number, w: number, h: number, draw: (f: number) => PixelCanvas, fps: number) => {
    const frames = Array.from({ length: n }, (_, f) => ({ name: `f${f}`, r: draw(f).render() }));
    registerAtlas(scene, key, packAtlas(frames, w, h, n), w, h);
    for (const [anim, tex] of [[`${key}_loop`, key], [`${key}_e_loop`, `${key}_e`]]) {
      if (scene.anims.exists(anim)) continue;
      scene.anims.create({ key: anim, frames: scene.anims.generateFrameNames(tex, { prefix: 'f', start: 0, end: n - 1 }), frameRate: fps, repeat: -1 });
    }
  };
  sheet('hw_stall_back', STALL_FRAMES, STALL_W, STALL_H, stallBack, 6);
  sheet('hw_stall_front', STALL_FRAMES, STALL_W, STALL_H, stallFront, 6);
  sheet('hw_wick', WICK_FRAMES, WICK_W, WICK_H, oldWick, 5);

  const W = FOG_W * FOG_KINDS;
  const fog = new Uint8ClampedArray(W * FOG_H * 4);
  for (let k = 0; k < FOG_KINDS; k++) {
    const px = fogBank(k);
    for (let y = 0; y < FOG_H; y++) fog.set(px.subarray(y * FOG_W * 4, (y + 1) * FOG_W * 4), (y * W + k * FOG_W) * 4);
  }
  const tex = scene.textures.addCanvas('hw_fog', pixelCanvas(W, FOG_H, fog))!;
  for (let k = 0; k < FOG_KINDS; k++) tex.add(`g${k}`, 0, k * FOG_W, 0, FOG_W, FOG_H);
}
