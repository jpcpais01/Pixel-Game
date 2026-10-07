// Glowtide Shore's props, drawn with the shared pixel engine (art/pixel.ts):
// coconut palms whose fronds sway, sea-grape bushes of round coin leaves,
// dune grass, smooth stones and a cairn, bleached driftwood, a lantern on a
// post, a rowboat drawn up on the sand, a crab, a gull, and the foam the
// waves leave. Lit from the warm top-left like everything else. Pure: the
// node script paints them too.

import { FLAT, PixelCanvas, cyl, sphere, type Material, type Vec3 } from '../../../art/pixel';
import { rng } from '../../../art/env';
import type { SheetDef } from '../types';
import {
  BEAK, BOARDS, BRANCH, COCONUT, DRIFT, DUNE_GRASS, EYE, FEATHER, FLAME, FOAM, FOAM_GLOW, FROND, FROND_DRY, GLASS, GRAPE, HULL, IRON, LEAF, LEAF_RED, POST, ROPE, SHELL_CRAB, STONE, STONE_BLUE, STONE_PALE, TRIM, TRUNK, TRUNK_RING, WING, WINGTIP,
} from './palette';

/** Normals: facing up to the sky, and facing the viewer. */
const UP: Vec3 = { x: 0, y: 0.6, z: 0.8 };

// ---------------------------------------------------------------- palms

export const PALM_W = 84;
export const PALM_H = 88;
export const PALM_FOOT_Y = 84;
/** The palms' looks: how far the crown leans (px), trunk height, fronds, and whether dry fronds hang. */
const PALMS = [
  { lean: 11, height: 58, fronds: 9, dry: true, seed: 3 },
  { lean: -7, height: 64, fronds: 8, dry: false, seed: 11 },
  { lean: 15, height: 50, fronds: 10, dry: true, seed: 23 },
];
/** Sway frames: how far (px) the wind pushes a frond's tip. */
const SWAY = [-1.6, 0, 1.6];

function palmFrame(v: number, f: number): PixelCanvas {
  const L = PALMS[v];
  const c = new PixelCanvas(PALM_W, PALM_H);
  const R = rng(900 + L.seed);
  const bx = PALM_W / 2 - Math.round(L.lean * 0.35);
  const by = PALM_FOOT_Y;
  const trunkX = (t: number) => bx + L.lean * Math.pow(t, 1.7);
  // The trunk: a slim curve, wider at its foot, ringed with old frond scars.
  for (let s = 0; s <= L.height; s++) {
    const t = s / L.height;
    const x = trunkX(t);
    const y = by - s;
    const hw = 2.6 - t * 0.9 + (s < 4 ? (4 - s) * 0.35 : 0);
    const ring = s % 4 === 2 && s > 2 && s < L.height - 2;
    for (let px = Math.floor(x - hw); px <= Math.ceil(x + hw) - 1; px++) {
      const u = (px + 0.5 - x) / hw;
      if (Math.abs(u) > 1) continue;
      c.px(px, y, ring ? TRUNK_RING : TRUNK, cyl(u, 0.2), { bias: ring && u < -0.2 ? 1 : 0 });
    }
  }
  const cx = trunkX(1);
  const cy = by - L.height;
  // Dry fronds hanging under the crown, drawn first, behind.
  if (L.dry) {
    c.part();
    for (const side of [-1, 1]) {
      for (let s = 0; s < 14; s++) {
        const x = cx + side * (2 + s * 0.35);
        const y = cy + 2 + s;
        c.px(x, y, FROND_DRY, cyl(side * 0.4, 0), { bias: s < 7 ? 1 : 0 });
        if (s > 2 && s % 2 === 0) c.px(x + side, y, FROND_DRY, FLAT, { bias: -1 });
      }
    }
  }
  // Fronds radiating round the crown: the far ones first and darker, the near ones last.
  const fronds: { a: number; len: number; droop: number }[] = [];
  for (let k = 0; k < L.fronds; k++) {
    const a = (k / L.fronds) * Math.PI * 2 + (R() - 0.5) * 0.5 + 0.3;
    fronds.push({ a, len: 21 + R() * 7, droop: 0.55 + R() * 0.35 });
  }
  fronds.sort((p, q) => Math.sin(p.a) - Math.sin(q.a));
  for (const fr of fronds) {
    c.part();
    const dx = Math.cos(fr.a);
    const dy = Math.sin(fr.a) * 0.5;
    const far = Math.sin(fr.a) < -0.2;
    const steps = Math.round(fr.len);
    let px = cx;
    let py = cy;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      // Out from the crown, arching up a little then drooping, pushed by the wind at the tip.
      const x = cx + dx * fr.len * t + SWAY[f] * t * t;
      const y = cy + dy * fr.len * t - 3 * t + fr.droop * fr.len * t * t * 0.55;
      const tx = x - px;
      const ty = y - py;
      px = x;
      py = y;
      const tl = Math.hypot(tx, ty) || 1;
      // Leaflets fall to either side of the rib, hanging down, shorter toward the tip.
      const nx = -ty / tl;
      const ny = tx / tl;
      const len = (1 - t) * 4.5 + 1.2;
      for (const side of [-1, 1]) {
        const lx = nx * side;
        const ly = ny * side;
        const hx = lx * 0.75;
        const hy = ly * 0.55 + 0.75;
        const hl = Math.hypot(hx, hy);
        const upper = ly < 0;
        for (let q = 1; q <= len; q++) {
          const qx = x + (hx / hl) * q;
          const qy = y + (hy / hl) * q;
          const bias = (upper ? 1 : -1) + (t > 0.55 ? 1 : 0) - (far ? 2 : 0) + (q > len - 1.5 ? -1 : 0);
          c.px(qx, qy, FROND, upper ? UP : sphere(lx * 0.4, 0.2, 0.8), { bias });
        }
      }
      c.px(x, y, FROND, UP, { bias: (far ? -1 : 1) + (t > 0.5 ? 1 : 0) });
    }
  }
  // Coconuts tucked under the crown.
  c.part();
  for (const [ox, oy] of [[-2, 2], [2, 2.5], [0, 3.5]]) c.ellipse(cx + ox, cy + oy, 1.8, 1.6, COCONUT, { flatten: 0.9 });
  return c;
}

// ---------------------------------------------------------------- sea grape

export const BUSH_W = 34;
export const BUSH_H = 30;
export const BUSH_FOOT_Y = 27;

function bushFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(BUSH_W, BUSH_H);
  const R = rng(1300 + v * 17);
  const cx = BUSH_W / 2;
  const base = BUSH_FOOT_Y;
  const rx = [12, 14, 10][v];
  const ry = [10, 11, 9][v];
  const cy = base - ry - 1;
  // A few stems, seen between the leaves at the bottom.
  for (let k = -2; k <= 2; k++) c.capsule(cx + k * 2, base, cx + k * 4, base - 6, 0.8, 0.5, BRANCH);
  // Round coin leaves, back to front; the odd one gone red, as sea grape does.
  const leaves: { x: number; y: number; r: number; red: boolean }[] = [];
  for (let k = 0; k < 34 + v * 4; k++) {
    const a = R() * Math.PI * 2;
    const d = Math.sqrt(R());
    leaves.push({ x: cx + Math.cos(a) * d * rx, y: cy + Math.sin(a) * d * ry, r: 2.4 + R() * 1.3, red: R() < 0.1 });
  }
  leaves.sort((a, b) => a.y - b.y);
  for (const l of leaves) {
    c.part();
    // Leaves high on the dome face the sky and catch the low sun.
    const u = (l.x - cx) / rx;
    const w = (l.y - cy) / ry;
    const lift = Math.round(-w * 1.6 - u * 0.6);
    c.ellipse(l.x, l.y, l.r, l.r * 0.82, l.red ? LEAF_RED : LEAF, { flatten: 0.6, bias: lift });
  }
  // Bunches of grapes hanging at the front.
  c.part();
  for (let k = 0; k < (v === 1 ? 2 : 1); k++) {
    const gx = cx - 5 + k * 9 + Math.round(R() * 2);
    const gy = cy + ry * 0.4;
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [-1, 1]]) c.px(gx + ox, gy + oy, GRAPE, sphere(ox * 0.5 - 0.3, -oy * 0.3 + 0.3, 0.8));
  }
  return c;
}

// ---------------------------------------------------------------- dune grass

export const TUFT_W = 20;
export const TUFT_H = 18;
export const TUFT_FOOT_Y = 16;

function tuftFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(TUFT_W, TUFT_H);
  const R = rng(1700 + v * 29);
  const n = 6 + v;
  const cx = TUFT_W / 2;
  for (let k = 0; k < n; k++) {
    c.part();
    const u = n === 1 ? 0 : (k / (n - 1)) * 2 - 1;
    const len = Math.round(7 + (1 - Math.abs(u)) * 6 + R() * 3);
    const lean = u * (4 + R() * 3) + (R() - 0.5) * 2;
    for (let s = 0; s < len; s++) {
      const t = s / len;
      const x = cx + u * 2 + lean * t * t;
      const y = TUFT_FOOT_Y - s;
      // Lit on the side facing the sun, gold at the tips.
      c.px(x, y, DUNE_GRASS, sphere(Math.sign(lean) * 0.5, -0.2, 0.8), { bias: Math.round(-u * 1.2 + t * 3) - 1 });
    }
  }
  // A seed head or two, pale.
  if (v % 2 === 0) {
    c.part();
    const x = cx + 1;
    for (let s = 0; s < 3; s++) c.px(x + (s > 1 ? 1 : 0), TUFT_FOOT_Y - 14 - s, DUNE_GRASS, UP, { bias: 3 });
  }
  return c;
}

// ---------------------------------------------------------------- stones

export const STONE_W = 32;
export const STONE_H = 24;
export const STONE_FOOT_Y = 20;

function stoneFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(STONE_W, STONE_H);
  const cx = STONE_W / 2;
  const b = STONE_FOOT_Y;
  const rock = (x: number, y: number, rx: number, ry: number, m: Material) => {
    c.part();
    c.ellipse(x, y, rx, ry, m, { flatten: 0.75 });
  };
  if (v === 0) {
    rock(cx - 2, b - 2, 3.2, 2.2, STONE_PALE);
    rock(cx + 3, b - 1, 2.2, 1.6, STONE);
  } else if (v === 1) {
    rock(cx, b - 4, 6.5, 4.4, STONE_BLUE);
    rock(cx + 6, b - 1, 2.4, 1.7, STONE_PALE);
  } else if (v === 2) {
    rock(cx - 1, b - 7, 10.5, 7.5, STONE);
    rock(cx + 8, b - 2.5, 4, 3, STONE_PALE);
    rock(cx - 9, b - 1.5, 2.4, 1.7, STONE_BLUE);
  } else {
    // A cairn: flat stones stacked by some earlier walker.
    rock(cx, b - 2.6, 6.4, 2.8, STONE);
    rock(cx + 0.5, b - 6.4, 4.8, 2.3, STONE_PALE);
    rock(cx - 0.5, b - 9.6, 3.4, 1.9, STONE_BLUE);
    rock(cx, b - 12.2, 1.9, 1.4, STONE_PALE);
  }
  return c;
}

// ---------------------------------------------------------------- driftwood

export const DRIFT_W = 40;
export const DRIFT_H = 16;
export const DRIFT_FOOT_Y = 12;

function driftFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(DRIFT_W, DRIFT_H);
  const R = rng(2100 + v * 7);
  if (v === 0) {
    c.capsule(5, 10, 34, 8, 2.6, 1.8, DRIFT);
    c.part();
    c.capsule(24, 8, 29, 3, 1.2, 0.6, DRIFT);
  } else {
    c.capsule(6, 9, 33, 10, 1.8, 1.4, DRIFT);
    c.part();
    c.capsule(16, 9, 10, 4, 1.1, 0.6, DRIFT);
    c.capsule(27, 10, 35, 6, 1, 0.5, DRIFT);
  }
  // Grain along the wood, and a knot or two.
  for (let k = 0; k < 10; k++) {
    const x = 7 + Math.floor(R() * 26);
    for (let y = 0; y < DRIFT_H; y++) if (c.materialAt(x, y) === DRIFT && c.materialAt(x + 1, y) === DRIFT && R() < 0.5) c.shade(x, y, -1);
  }
  return c;
}

// ---------------------------------------------------------------- the lantern

export const LAMP_W = 14;
export const LAMP_H = 40;
export const LAMP_FOOT_Y = 38;

function lampFrame(): PixelCanvas {
  const c = new PixelCanvas(LAMP_W, LAMP_H);
  const x = LAMP_W / 2;
  // The post, with a turn of rope round it.
  for (let y = 16; y <= LAMP_FOOT_Y; y++) {
    for (let px = x - 1.5; px < x + 1.5; px++) c.px(px, y, POST, cyl((px + 0.5 - x) / 1.5, 0.1));
  }
  c.part();
  for (let y = 27; y <= 28; y++) for (let px = x - 2; px < x + 2; px++) c.px(px, y, ROPE, cyl((px + 0.5 - x) / 2, 0.1), { bias: y === 27 ? 1 : 0 });
  // Its lantern: an iron cap, warm glass, a little flame.
  c.part();
  for (let px = x - 3; px < x + 3; px++) c.px(px, 16, IRON, UP);
  c.part();
  for (let y = 10; y <= 15; y++) for (let px = x - 3; px < x + 3; px++) c.px(px, y, GLASS, FLAT, { bias: y < 12 ? 1 : 0 });
  c.part();
  for (let y = 10; y <= 15; y++) {
    c.px(x - 3, y, IRON, cyl(-0.8));
    c.px(x + 2, y, IRON, cyl(0.8));
  }
  c.part();
  c.px(x - 1, 13, FLAME, FLAT);
  c.px(x - 1, 12, FLAME, FLAT, { bias: 1 });
  c.px(x, 13, FLAME, FLAT);
  c.part();
  for (let px = x - 4; px < x + 4; px++) c.px(px, 9, IRON, UP, { bias: 1 });
  for (let px = x - 3; px < x + 3; px++) c.px(px, 8, IRON, UP, { bias: 1 });
  for (let px = x - 1; px < x + 1; px++) c.px(px, 7, IRON, UP);
  c.px(x - 1, 6, IRON, UP);
  return c;
}

// ---------------------------------------------------------------- the rowboat

export const BOAT_W = 54;
export const BOAT_H = 30;
export const BOAT_FOOT_Y = 24;

function boatFrame(): PixelCanvas {
  const c = new PixelCanvas(BOAT_W, BOAT_H);
  const x0 = 5;
  const x1 = 49;
  const cy = 13;
  const half = (x: number) => {
    const t = (x - x0) / (x1 - x0);
    if (t < 0 || t > 1) return 0;
    // A square-ish stern on the left, a pointed bow on the right.
    return t < 0.45 ? 8.5 * (1 - Math.pow((0.45 - t) / 0.45, 3) * 0.45) : 8.5 * Math.pow(1 - Math.pow((t - 0.45) / 0.55, 1.7), 0.75);
  };
  // The outside of the hull, seen below the gunwale on the near side.
  for (let x = x0; x <= x1; x++) {
    const h = half(x + 0.5);
    if (h < 0.5) continue;
    for (let y = Math.round(cy - h); y <= Math.round(cy + h) + 4; y++) {
      const side = y > cy + h - 1;
      c.px(x, y, HULL, side ? { x: 0, y: -0.5, z: 0.86 } : UP, { bias: side ? -1 + (y - cy - h > 2 ? -1 : 0) : 0 });
    }
  }
  // The gunwale: a pale rim all round.
  c.part();
  for (let x = x0; x <= x1; x++) {
    const h = half(x + 0.5);
    if (h < 0.5) continue;
    for (let y = Math.round(cy - h); y <= Math.round(cy + h); y++) c.px(x, y, TRIM, UP, { bias: y < cy ? 1 : 0 });
  }
  // The inside: planks running its length, two seats across, an oar.
  c.part();
  for (let x = x0 + 2; x <= x1 - 2; x++) {
    const h = half(x + 0.5) - 1.6;
    if (h < 0.5) continue;
    for (let y = Math.round(cy - h); y <= Math.round(cy + h); y++) {
      const seam = (y - cy + 20) % 3 === 0;
      c.px(x, y, BOARDS, { x: 0, y: 0.3, z: 0.95 }, { bias: (seam ? -1 : 0) + (y < cy - h + 1.5 ? -1 : 0) });
    }
  }
  c.part();
  for (const sx of [17, 31]) {
    const h = half(sx) - 1.6;
    for (let x = sx; x < sx + 3; x++) for (let y = Math.round(cy - h); y <= Math.round(cy + h); y++) c.px(x, y, BOARDS, UP, { bias: x === sx ? 2 : 1 });
  }
  c.part();
  c.capsule(10, 9, 41, 16, 0.7, 0.7, DRIFT);
  c.ellipse(42.5, 16.5, 2.4, 1.4, DRIFT, { flatten: 0.6 });
  // A coil of rope in the bow.
  c.part();
  for (let a = 0; a < 16; a++) {
    const t = (a / 16) * Math.PI * 2;
    c.px(42 + Math.cos(t) * 2.2, 11 + Math.sin(t) * 1.4, ROPE, sphere(Math.cos(t) * 0.6, -Math.sin(t) * 0.6, 0.8));
  }
  return c;
}

// ---------------------------------------------------------------- the crab

export const CRAB_W = 14;
export const CRAB_H = 10;
export const CRAB_FOOT_Y = 8;

function crabFrame(walk: number, wave: number): PixelCanvas {
  const c = new PixelCanvas(CRAB_W, CRAB_H);
  const cx = CRAB_W / 2;
  const cy = 5;
  // Legs, three a side, stepping in turn.
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const lift = (k + walk + (side > 0 ? 1 : 0)) % 2 === 0 ? -1 : 0;
      const x = cx + side * 2.5;
      const y = cy + k * 0.8;
      c.line(x, y, x + side * 2, y + 1 + lift, SHELL_CRAB, () => FLAT);
      c.px(x + side * 3, y + 2 + lift, SHELL_CRAB, FLAT, { bias: -1 });
    }
  }
  c.part();
  c.ellipse(cx, cy, 3.3, 2.3, SHELL_CRAB, { flatten: 0.7 });
  // Claws, raised in a wave now and then.
  c.part();
  for (const side of [-1, 1]) {
    const up = wave && side > 0 ? -2 : 0;
    c.ellipse(cx + side * 4.6, cy - 1.5 + up, 1.5, 1.2, SHELL_CRAB, { flatten: 0.8, bias: 1 });
    c.px(cx + side * 5.5, cy - 3 + up, SHELL_CRAB, UP, { bias: 1 });
  }
  c.part();
  c.px(cx - 1, cy - 3, EYE, FLAT, { bias: 2 });
  c.px(cx, cy - 3, EYE, FLAT, { bias: 2 });
  return c;
}

// ---------------------------------------------------------------- the gull

export const GULL_W = 26;
export const GULL_H = 18;

/** Wing spread by frame: how far out (px) and how swept back the tips are. */
const GULL_WINGS = [
  { span: 10, sweep: 4, lift: 0 },
  { span: 8, sweep: 3, lift: 1 },
  { span: 5, sweep: 1, lift: 2 },
  { span: 8, sweep: 3, lift: 1 },
];

function gullFrame(f: number): PixelCanvas {
  const c = new PixelCanvas(GULL_W, GULL_H);
  const cx = 13;
  const cy = 9;
  const w = GULL_WINGS[f];
  // Wings out to either side (north and south of a gull flying east), swept back, black at the tips.
  for (const side of [-1, 1]) {
    c.part();
    for (let s = 0; s <= w.span; s++) {
      const t = s / w.span;
      const x = cx + 1 - w.sweep * t * t - (side < 0 ? w.lift * t : 0);
      const y = cy + side * (1 + s * (side < 0 ? 0.85 : 0.6));
      const tip = t > 0.75;
      const chord = Math.round(3 - t * 1.5);
      for (let q = 0; q < chord; q++) c.px(x - q, y, tip ? WINGTIP : WING, side < 0 ? UP : sphere(0, -0.2, 0.9), { bias: q === 0 ? 1 : 0 });
    }
  }
  c.part();
  c.capsule(cx - 4, cy, cx + 4, cy, 1.3, 1.6, FEATHER);
  c.part();
  c.ellipse(cx + 5, cy - 0.5, 1.6, 1.4, FEATHER, { flatten: 0.8 });
  c.px(cx + 7, cy - 0.5, BEAK, FLAT);
  c.px(cx - 6, cy, FEATHER, FLAT, { bias: -1 });
  c.px(cx + 5, cy - 1, EYE, FLAT);
  return c;
}

// ---------------------------------------------------------------- foam

export const FOAM_W = 26;
export const FOAM_H = 8;
/** Foam frames, from a fresh band to the last bubbles. */
export const FOAM_FRAMES = 4;

function foamFrame(f: number, glow: boolean): PixelCanvas {
  const c = new PixelCanvas(FOAM_W, FOAM_H);
  const m = glow ? FOAM_GLOW : FOAM;
  const R = rng(4100);
  const top: number[] = [];
  for (let x = 0; x < FOAM_W; x++) top.push(2 + Math.round(Math.sin(x * 0.7 + R() * 0.8) * 0.8 + R() * 0.6));
  for (let x = 0; x < FOAM_W; x++) {
    const end = Math.min(x, FOAM_W - 1 - x);
    if (end < 1) continue;
    const thick = Math.max(1, Math.min(end, 3 - f * 0.7 + (R() - 0.5)));
    for (let y = top[x]; y < top[x] + thick + 1; y++) {
      const keep = R();
      // Lace: holes open as the foam thins.
      if (keep < f * 0.24 + (y > top[x] ? 0.12 : 0)) continue;
      c.px(x, y, m, UP, { bias: y === top[x] ? 1 : y > top[x] + 1 ? -1 : 0 });
    }
    // Bubbles left behind on the landward side.
    if (R() < 0.12 + f * 0.05) c.px(x, top[x] - 1 - Math.round(R()), m, UP, { bias: 0 });
  }
  return c;
}

// ---------------------------------------------------------------- the sheets

export function shoreSheets(): SheetDef[] {
  const palmFrames: SheetDef['frames'] = [];
  for (let v = 0; v < PALMS.length; v++) for (let f = 0; f < SWAY.length; f++) palmFrames.push({ name: `p${v}_${f}`, draw: () => palmFrame(v, f) });
  return [
    {
      key: 'shore_palm',
      w: PALM_W,
      h: PALM_H,
      footX: PALM_W / 2,
      footY: PALM_FOOT_Y,
      frames: palmFrames,
      anims: PALMS.map((_, v) => ({ name: `sway${v}`, frames: [`p${v}_0`, `p${v}_1`, `p${v}_2`, `p${v}_1`], fps: 1.6, loop: true })),
    },
    { key: 'shore_bush', w: BUSH_W, h: BUSH_H, footX: BUSH_W / 2, footY: BUSH_FOOT_Y, frames: [0, 1, 2].map((v) => ({ name: `b${v}`, draw: () => bushFrame(v) })) },
    { key: 'shore_tuft', w: TUFT_W, h: TUFT_H, footX: TUFT_W / 2, footY: TUFT_FOOT_Y, frames: [0, 1, 2, 3].map((v) => ({ name: `t${v}`, draw: () => tuftFrame(v) })) },
    { key: 'shore_stone', w: STONE_W, h: STONE_H, footX: STONE_W / 2, footY: STONE_FOOT_Y, frames: [0, 1, 2, 3].map((v) => ({ name: `s${v}`, draw: () => stoneFrame(v) })) },
    { key: 'shore_drift', w: DRIFT_W, h: DRIFT_H, footX: DRIFT_W / 2, footY: DRIFT_FOOT_Y, frames: [0, 1].map((v) => ({ name: `d${v}`, draw: () => driftFrame(v) })) },
    { key: 'shore_lamp', w: LAMP_W, h: LAMP_H, footX: LAMP_W / 2, footY: LAMP_FOOT_Y, frames: [{ name: 'l0', draw: lampFrame }], glows: true },
    { key: 'shore_boat', w: BOAT_W, h: BOAT_H, footX: BOAT_W / 2, footY: BOAT_FOOT_Y, frames: [{ name: 'boat', draw: boatFrame }] },
    {
      key: 'shore_crab',
      w: CRAB_W,
      h: CRAB_H,
      footX: CRAB_W / 2,
      footY: CRAB_FOOT_Y,
      frames: [
        { name: 'w0', draw: () => crabFrame(0, 0) },
        { name: 'w1', draw: () => crabFrame(1, 0) },
        { name: 'i0', draw: () => crabFrame(0, 0) },
        { name: 'i1', draw: () => crabFrame(0, 1) },
      ],
      anims: [
        { name: 'walk', frames: ['w0', 'w1'], fps: 12, loop: true },
        { name: 'idle', frames: ['i0', 'i0', 'i0', 'i1', 'i0', 'i1'], fps: 3, loop: true },
      ],
    },
    {
      key: 'shore_gull',
      w: GULL_W,
      h: GULL_H,
      footX: GULL_W / 2,
      footY: GULL_H / 2,
      frames: GULL_WINGS.map((_, f) => ({ name: `g${f}`, draw: () => gullFrame(f) })),
      anims: [{ name: 'fly', frames: ['g0', 'g0', 'g0', 'g1', 'g2', 'g3', 'g0', 'g1', 'g2', 'g3', 'g0', 'g0'], fps: 7, loop: true }],
    },
    {
      key: 'shore_foam',
      w: FOAM_W,
      h: FOAM_H,
      footX: FOAM_W / 2,
      footY: FOAM_H / 2,
      frames: [
        ...Array.from({ length: FOAM_FRAMES }, (_, f) => ({ name: `f${f}`, draw: () => foamFrame(f, false) })),
        ...Array.from({ length: FOAM_FRAMES }, (_, f) => ({ name: `n${f}`, draw: () => foamFrame(f, true) })),
      ],
      glows: true,
    },
  ];
}
