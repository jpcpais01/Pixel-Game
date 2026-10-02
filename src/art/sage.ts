// The Force Sage: the Jedi class's scholar, who fights with the mind and
// leaves her saber at her belt. A woman in long layered robes (an ivory
// outer robe open over a pale blue under-robe), a wide teal sash knotted at
// the hip with its tails hanging, a high stand-up collar, and chestnut hair
// in a crown of braids with one long braid over her shoulder. She stands
// with her hands folded in her wide bell sleeves; the Force she works is a
// sea-glass teal.
//
// Her Starseer skin: deep night-blue robes embroidered with silver stars, a
// violet under-robe, a silver sash, a pale silver braid, and starlight-white
// Force touched with violet.
//
// Also here: the stones she tears out of the ground and throws (and the
// Starseer's glowing meteorites), drawn turned to eight angles so they spin
// cleanly, and her button icons.
//
// The body keeps to the 24x32 box (the ground at y 31); frames are larger so
// raised arms and the idle moment's orbiting pebbles fit. Drawing functions
// work in body-box coordinates; right-facing frames mirror the left ones.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { EYE, HILT_DARK, PALE_SKIN, SILVER, SKIN } from './palette';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const SAGE_W = 48;
export const SAGE_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, at her feet. */
export const SAGE_ORIGIN_X = BODY_X + 12;
export const SAGE_ORIGIN_Y = BODY_Y + 31;
/** Her chest above her feet. */
export const SAGE_CHEST_Y = 14;

/** Sitting down for the idle moment: how far the upper body sinks. */
const SIT_DROP = 5;
/** Pebbles circling her as she reads. */
const PEBBLES = 4;
const cx0 = 12;

// ---------------------------------------------------------------------------
// Materials

const SCHOLAR_ROBE: Material = { ramp: ramp('#5e5a54', '#9a958a', '#c9c3b4', '#e8e2d2', '#fbf8ee'), outline: hex('#26221c'), outlineLit: hex('#38332a') };
const SCHOLAR_UNDER: Material = { ramp: ramp('#34445a', '#56708c', '#84a0ba', '#b2c8da'), outline: hex('#121a26') };
const SCHOLAR_SASH: Material = { ramp: ramp('#082a30', '#0f4a54', '#18707a', '#2c989e', '#56c0be'), outline: hex('#041418') };
const SCHOLAR_TRIM: Material = { ramp: ramp('#5a3e14', '#9a7024', '#d0a440', '#f4d878'), outline: hex('#20160a'), shine: true };
const CHESTNUT: Material = { ramp: ramp('#2a120a', '#4a2214', '#743a1e', '#a0582e', '#c47c48'), outline: hex('#140804'), outlineLit: hex('#24100a') };
const LIPS: Material = { ramp: ramp('#7a3038', '#b45a5e', '#d8847e'), outline: hex('#2a1418'), noOutline: true };
const LEATHER_BOOK: Material = { ramp: ramp('#2a1008', '#4e2010', '#78381c', '#9c5428'), outline: hex('#120604') };
const PAGE: Material = { ramp: ramp('#a89a7a', '#d8ccac', '#f4ecd2', '#fffaec'), outline: hex('#2a2414') };
const PEBBLE: Material = { ramp: ramp('#3a3630', '#5e5850', '#8a8478', '#b4ae9e'), outline: hex('#16140f') };

const STAR_ROBE: Material = { ramp: ramp('#070a1e', '#10183a', '#1a2656', '#28387a', '#3e509c'), outline: hex('#03040c'), outlineLit: hex('#0a0e22') };
const STAR_UNDER: Material = { ramp: ramp('#120a28', '#221446', '#36266a', '#523f94'), outline: hex('#08040e') };
const STAR_SASH: Material = { ramp: ramp('#4a5068', '#8a90aa', '#c4c8da', '#eef0fa'), outline: hex('#161824'), shine: true };
const STAR_TRIM: Material = { ramp: ramp('#40465e', '#7e86a2', '#bcc2d8', '#f0f4ff'), outline: hex('#121420'), shine: true, emissive: 0.12 };
const STAR_HAIR: Material = { ramp: ramp('#5a5e76', '#8a8ea8', '#b8bcd2', '#dfe2f0', '#fbfcff'), outline: hex('#1e2030'), outlineLit: hex('#2c2e42'), emissive: 0.06 };
const STAR_STITCH: Material = { ramp: ramp('#b8c0e0', '#ffffff'), outline: hex('#121630'), emissive: 0.7, noOutline: true, noAO: true };
const STAR_THREAD: Material = { ramp: ramp('#4a5684', '#6e7cb0'), outline: hex('#121630'), emissive: 0.25, noOutline: true, noAO: true };
const STAR_BOOK: Material = { ramp: ramp('#0a0e2a', '#162050', '#24327a', '#3a4ca0'), outline: hex('#04050e') };
const METEOR_PEBBLE: Material = { ramp: ramp('#1a1622', '#2e2838', '#4a4058', '#6a5e7e'), outline: hex('#08060c'), emissive: 0.1 };

export interface SageLook {
  /** Texture key; animations are `${key}_${anim}_${dir}`. */
  key: string;
  /** The outer robe, open down the front, with wide bell sleeves and the high collar. */
  robe: Material;
  /** The under-robe, showing down the front and at the hem, and inside the sleeves. */
  under: Material;
  sash: Material;
  /** Edging: the collar's rim, the robe's front and hem, the cuffs, the sash's tips. */
  trim: Material;
  skin: Material;
  hair: Material;
  /** The book she reads in her idle moment, and the pebbles circling her. */
  book: Material;
  pebble: Material;
  /** Force light in her palms: core, hot, mid. */
  force: [RGB, RGB, RGB];
  /** Silver stars stitched over the robe (the Starseer). */
  stars?: boolean;
  /** What the stones she throws are made of, and the glow round them. */
  stone: 'rock' | 'meteor';
}

export const SAGE_LOOK: SageLook = {
  key: 'jedi_sage',
  robe: SCHOLAR_ROBE,
  under: SCHOLAR_UNDER,
  sash: SCHOLAR_SASH,
  trim: SCHOLAR_TRIM,
  skin: SKIN,
  hair: CHESTNUT,
  book: LEATHER_BOOK,
  pebble: PEBBLE,
  force: [hex('#f0fffc'), hex('#9cf6e8'), hex('#3ad0c0')],
  stone: 'rock',
};

export const STARSEER_LOOK: SageLook = {
  key: 'jedi_starseer',
  robe: STAR_ROBE,
  under: STAR_UNDER,
  sash: STAR_SASH,
  trim: STAR_TRIM,
  skin: PALE_SKIN,
  hair: STAR_HAIR,
  book: STAR_BOOK,
  pebble: METEOR_PEBBLE,
  force: [hex('#ffffff'), hex('#e6dcff'), hex('#a68cff')],
  stars: true,
  stone: 'meteor',
};

export const SAGE_LOOKS = [SAGE_LOOK, STARSEER_LOOK];

/** The look being drawn; set by buildSageFrames. */
let S: SageLook = SAGE_LOOK;

// ---------------------------------------------------------------------------
// Poses

interface Pt {
  x: number;
  y: number;
}

export interface SagePose {
  /** Whole body raised (a walk's passing frames). */
  lift: number;
  /** Floating off the ground: the whole figure drawn this many px up (her shadow stays below). */
  hover: number;
  /** Upper body lowered (breathing, crouching). */
  breath: number;
  /** Hem sway in px; the braid and sash tails follow it. */
  robe: number;
  /** Upper body shifted forward (side view). */
  lean: number;
  /**
   * Hands in body pixels, for an upright body (the drawing moves them with
   * the breath). Front and back views: a is the one on screen left, b on the
   * right. Side view: a is the near hand, b the far one.
   */
  a: Pt;
  b: Pt;
  /** 0..1 Force light in each palm. */
  ga: number;
  gb: number;
  /** Walking: which slipper toe shows (front views), or the feet apart (side, px). */
  step: number;
  /** Robe flaring out round her (casting her Special). */
  flare: number;
  blink?: boolean;
  /** Eyes cast down, reading. */
  read?: boolean;
  // The idle moment's extras, drawn facing the viewer only.
  /** 0..1 lowered into a cross-legged seat. */
  sit?: number;
  /** The book floating before her: 0..1 open, and a page turning over (0: none, 1..3 its stage). */
  book?: number;
  page?: number;
  /** The pebbles circling her: their turn, in radians (undefined: none). */
  orbit?: number;
  /** Motes of the Force rising round her, set by this seed (0: none). */
  motes?: number;
}

/** Hands folded in her sleeves before her sash: her calm, scholarly stance. */
const FOLD: Record<View, [Pt, Pt]> = {
  down: [{ x: 10.9, y: 21.2 }, { x: 13.1, y: 21.2 }],
  up: [{ x: 10.9, y: 21.2 }, { x: 13.1, y: 21.2 }],
  side: [{ x: 8.8, y: 21 }, { x: 9.4, y: 20.6 }],
};

type View = 'down' | 'up' | 'side';

const base = (view: View): SagePose => ({
  lift: 0,
  hover: 0,
  breath: 0,
  robe: 0,
  lean: 0,
  a: { ...FOLD[view][0] },
  b: { ...FOLD[view][1] },
  ga: 0,
  gb: 0,
  step: 0,
  flare: 0,
});

const hash = (a: number, b: number, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const FLAT_DOWN: Vec3 = { x: 0, y: -0.3, z: 0.95 };

// ---------------------------------------------------------------------------
// Shared parts

/** Force light held in an open palm: a white heart and a ring of motes. */
function palm(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.force;
  c.spark(x, y, core, Math.min(1, k));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + k * 2.4;
    const r = 1.6 + (i % 2) * 1.1 * k;
    c.spark(x + Math.cos(a) * r, y + Math.sin(a) * r, i % 2 ? mid : hot, k * (i % 2 ? 0.45 : 0.7));
  }
}

/**
 * A wide bell sleeve from the shoulder to the wrist, its cuff edged, the
 * cloth hanging below the wrist, and the hand coming out of its dark inside.
 */
function arm(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number, glow: number, bias = 0): void {
  const vx = hx - sx;
  const vy = hy - sy;
  const l = Math.hypot(vx, vy) || 1;
  const ux = vx / l;
  const uy = vy / l;
  const wx = hx - ux * 1.1;
  const wy = hy - uy * 1.1;
  c.part();
  c.capsule(sx, sy, wx, wy, 1.25, 1.85, S.robe, { bias });
  // The bell hangs from the wrist, whichever way the arm points.
  c.part();
  c.capsule(wx - ux * 0.4, wy, wx + ux * 0.3, wy + 2.3, 1.75, 0.95, S.robe, { bias: bias - (uy < -0.5 ? 1 : 0) });
  // The cuff's edging, along the bell's lower rim.
  c.part();
  c.px(wx + ux * 0.3 - 1, wy + 3, S.trim, sphere(-0.3, 0.4, 1));
  c.px(wx + ux * 0.3, wy + 3.2, S.trim, sphere(0.2, 0.5, 1));
  // The dark inside of the sleeve round the wrist, then the hand.
  c.part();
  c.ellipse(hx - ux * 0.35, hy - uy * 0.35, 1.1, 0.95, S.under, { bias: -2 });
  c.part();
  c.ellipse(hx, hy, 1.05, 1.05, S.skin);
  palm(c, hx, hy, glow);
}

/** One plait of a braid: a little bead of hair, lit one way then the other down its length. */
function plait(c: PixelCanvas, x: number, y: number, i: number, rx = 1.15, ry = 0.85): void {
  c.ellipse(x, y, rx, ry, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + (i % 2 ? 0.25 : -0.25), dy * 0.8 - 0.1, 1), bias: i % 2 ? 0 : -1 });
}

/** A long braid hanging from (x0, y0) to (x1, y1): plaits, a tie of the trim, and a tuft. */
function braid(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 1.3));
  c.part();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = i % 2 ? 0.35 : -0.35;
    plait(c, x0 + (x1 - x0) * t + w, y0 + (y1 - y0) * t, i, 1.15 - t * 0.25, 0.85);
  }
  c.part();
  c.px(x1, y1 + 1, S.trim, sphere(-0.3, -0.2, 1));
  c.px(x1 + 1, y1 + 1, S.trim, sphere(0.4, -0.2, 1));
  c.part();
  c.px(x1, y1 + 2, S.hair, sphere(-0.2, 0.3, 1));
  c.px(x1 + 1, y1 + 2, S.hair, sphere(0.3, 0.3, 1), { bias: -1 });
  c.px(x1 + 0.5, y1 + 3, S.hair, sphere(0, 0.6, 1), { bias: -1 });
}

/** The crown of braids: a plaited band round the head along an ellipse, from angle `from` to `to`. */
function crown(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, from: number, to: number): void {
  c.part();
  const n = Math.ceil(Math.abs(to - from) * rx * 0.9);
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    plait(c, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, i, 1.05, 0.9);
  }
}

/** The robe's skirt: the under-robe, then the outer robe open over it (front view), its edges and hem trimmed. */
function skirt(c: PixelCanvas, top: number, hemUnder: number, hemOuter: number, hw: (u: number) => number, shift: (u: number) => number, open: boolean, view: View): void {
  const span = hemUnder + 1 - top;
  c.part();
  c.shape(Math.round(top), Math.round(hemUnder), (y) => {
    const u = (y + 0.5 - top) / span;
    const w = hw(u);
    return [shift(u) - w, shift(u) + w];
  }, S.under, (_x, _y, t, u) => cyl(t, 0.15 - u * 0.25), { bias: open ? 0 : -1 });
  const ospan = hemOuter + 1 - top;
  const gap = (u: number) => (open ? 0.7 + 1.5 * u : -99);
  const edge = (side: -1 | 1) => (y: number): [number, number] | null => {
    const u = (y + 0.5 - top) / ospan;
    const w = hw(u) + 0.3;
    const g = gap(u);
    if (!open) return side < 0 ? [shift(u) - w, shift(u) + w] : null;
    return side < 0 ? [shift(u) - w, shift(u) - g] : [shift(u) + g, shift(u) + w];
  };
  for (const side of [-1, 1] as const) {
    c.part();
    c.shape(Math.round(top), Math.round(hemOuter), edge(side), S.robe, (_x, _y, t, u) => cyl(open ? t * 0.6 + side * 0.35 : t, 0.25 - u * 0.35));
  }
  // Pleats: soft folds falling from the sash.
  for (let y = Math.round(top + 2); y <= hemOuter; y++) {
    const u = (y + 0.5 - top) / ospan;
    const w = hw(u) + 0.3;
    const x = shift(u);
    if (open) {
      c.shade(Math.round(x - w * 0.62), y, -1);
      c.shade(Math.round(x + w * 0.62), y, -1);
    } else if (view === 'up') {
      c.shade(Math.round(x - w * 0.34), y, -1);
      c.shade(Math.round(x + w * 0.34), y, -1);
    } else c.shade(Math.round(x + w * 0.2), y, -1);
    if (open) {
      // The front edges, trimmed.
      const g = gap(u);
      c.px(Math.round(x - g) - 1, y, S.trim, cyl(0.3, 0.2));
      c.px(Math.round(x + g), y, S.trim, cyl(-0.3, 0.2), { bias: -1 });
    }
  }
  // The outer robe's hem, edged; the under-robe shows a row below it.
  const hu = 1 - 0.5 / ospan;
  for (let x = Math.round(shift(hu) - hw(hu) - 0.3); x < shift(hu) + hw(hu) + 0.3; x++) {
    if (c.materialAt(x, Math.round(hemOuter)) === S.robe) c.px(x, Math.round(hemOuter), S.trim, cyl((x - shift(hu)) / (hw(hu) + 0.3), -0.2));
  }
}

/** A slipper's toe peeping from under the hem. */
function toe(c: PixelCanvas, x: number, y: number, side = false): void {
  c.part();
  c.ellipse(x, y, side ? 1.6 : 1.2, 0.8, S.sash, { flatten: 0.7 });
}

/** The saber she no longer draws, hanging from her sash: a short chrome hilt with a dark grip. */
function hilt(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  c.part();
  c.capsule(x0, y0, x1, y1, 0.6, 0.55, SILVER);
  c.part();
  const n = 3;
  for (let i = 1; i <= n; i++) {
    const t = 0.35 + i * 0.14;
    c.px(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, HILT_DARK, { x: -0.3, y: 0, z: 0.95 });
  }
  c.px(x0, y0, HILT_DARK, { x: 0, y: 0.6, z: 0.8 });
}

function eyes(c: PixelCanvas, pts: [number, number, number][], p: SagePose): void {
  c.part();
  for (const [x, y, lash] of pts) {
    if (p.blink) c.px(x, y, S.skin, FLAT_DOWN, { bias: -1 });
    else if (p.read) {
      // Lowered to the page: the lid half down.
      c.px(x, y, S.skin, FLAT_DOWN, { bias: -2 });
      c.px(x, y + 1, EYE);
    } else c.px(x, y, EYE);
    // A lash at the outer corner.
    if (lash) c.px(x + lash, y - 1, EYE);
  }
}

/** Motes of the Force drifting up round her, each twinkling in and out by the seed. */
function motes(c: PixelCanvas, seed: number, L: number): void {
  if (!seed) return;
  const [core, hot, mid] = S.force;
  for (let i = 0; i < 7; i++) {
    const on = hash(i, seed, 5);
    if (on < 0.35) continue;
    const h = hash(i, 1, 2);
    const x = h < 0.5 ? 0 + h * 9 : 15 + h * 9;
    const y = 16 + hash(i, 2, 2) * 14 - ((seed + i) % 5) + L;
    c.spark(x, y, on > 0.8 ? core : on > 0.6 ? hot : mid, 0.35 + on * 0.4);
  }
}

/**
 * The pebbles circling her as she reads, on a flat ring round her middle:
 * the far ones (behind her) or the near ones, each lit and glinting.
 */
function pebbles(c: PixelCanvas, turn: number | undefined, U: number, half: 'back' | 'front'): void {
  if (turn === undefined) return;
  for (let i = 0; i < PEBBLES; i++) {
    const a = turn + (i / PEBBLES) * Math.PI * 2;
    const sa = Math.sin(a);
    if ((sa < 0) !== (half === 'back')) continue;
    const x = cx0 + Math.cos(a) * 10.5;
    const y = 21 + U + sa * 3.4 + Math.sin(a * 2 + i) * 0.8;
    c.part();
    const r = i % 2 ? 0.9 : 1.2;
    c.ellipse(x, y, r + 0.2, r, S.pebble, { bias: sa < 0 ? -1 : 0 });
    // A thread of the Force under each.
    c.spark(x, y + 2, S.force[2], 0.3);
    if (S.stone === 'meteor') c.spark(x, y, S.force[1], 0.45);
  }
}

/** The book floating before her: open, lit by the Force under it, a page turning over. */
function book(c: PixelCanvas, x: number, y: number, open: number, page: number): void {
  if (open <= 0) return;
  const w = 1.2 + 2 * open;
  c.part();
  // The covers: a sliver when shut, opening out into a V.
  c.shape(Math.round(y), Math.round(y + 1), () => [x - w - 0.3, x + w + 0.3], S.book, (_x, _y, t) => cyl(t * 0.6, 0.6));
  c.part();
  c.shape(Math.round(y - 1), Math.round(y), (yy) => {
    const sag = yy - (y - 1) < 1 ? 0.6 : 0;
    return [x - w + sag, x + w - sag];
  }, PAGE, (_x, _y, t) => sphere(t * 0.5, -0.4, 1));
  // The spine's fold, and lines of writing.
  for (let yy = Math.round(y - 1); yy <= y; yy++) c.shade(Math.round(x), yy, -1);
  for (let yy = Math.round(y - 1); yy <= y; yy++) {
    for (let xx = Math.round(x - w + 1); xx < x - 0.5; xx += 2) c.shade(xx, yy, -1);
    for (let xx = Math.round(x + 1); xx < x + w - 1; xx += 2) c.shade(xx, yy, -1);
  }
  if (page > 0) {
    // A page standing up as it turns from right to left.
    c.part();
    const px = page === 1 ? x + w * 0.5 : page === 2 ? x : x - w * 0.5;
    const top = y - (page === 2 ? 5 : 4);
    for (let yy = Math.round(top); yy <= y - 1; yy++) {
      c.px(px, yy, PAGE, sphere(page === 1 ? 0.5 : page === 3 ? -0.5 : 0, -0.5, 1));
      if (page !== 2) c.px(px + (page === 1 ? -1 : 1), yy + 1, PAGE, sphere(0, -0.6, 1), { bias: -1 });
    }
  }
  // The Force holding it up, and the light off the page on her face.
  const [core, hot, mid] = S.force;
  for (let i = -3; i <= 3; i++) c.spark(x + i, y + 3, Math.abs(i) < 2 ? hot : mid, 0.45 - Math.abs(i) * 0.06);
  c.spark(x, y - 1, core, 0.15 * open);
}

// ---------------------------------------------------------------------------
// The three views

function drawDown(c: PixelCanvas, p: SagePose): void {
  const L = -p.lift;
  const s = p.sit ?? 0;
  const D = Math.round(s * SIT_DROP);
  const U = L + p.breath + D;
  const cx = cx0;
  pebbles(c, p.orbit, U, 'back');

  // Slippers, under the hem.
  if (s === 0) {
    toe(c, 10.4, 30.6 + L - (p.step > 0 ? 1 : 0));
    toe(c, 13.6, 30.6 + L - (p.step < 0 ? 1 : 0));
  }
  // The skirt: seated, it pools out into a wide mound over her folded legs.
  const top = 22.5 + U;
  const hemU = 30 + L;
  const f = p.flare;
  const hw = (u: number) => (3.2 + 3.5 * Math.pow(u, 1.2) + f * 2.2 * u * u) * (1 - s) + (3.4 + 6.8 * Math.sqrt(u)) * s;
  skirt(c, top, hemU, hemU - 1 + Math.round(s), hw, (u) => cx + p.robe * u * u, true, 'down');
  if (s > 0.5) {
    // The knees under the cloth.
    c.shade(cx - 6, Math.round(26 + L + D * 0.4), 1);
    c.shade(cx + 5, Math.round(26 + L + D * 0.4), 1);
  }

  // Bodice: wrapped, the over-flap edged from her right shoulder to her left hip.
  const btop = 15.6 + U;
  const waist = 20 + U;
  c.part();
  c.shape(Math.round(btop), Math.round(waist), (y) => {
    const u = (y + 0.5 - btop) / (waist + 1 - btop);
    const hw2 = 3.7 - 0.9 * u;
    return [cx - hw2, cx + hw2];
  }, S.robe, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  c.part();
  for (let y = Math.round(btop); y <= waist; y++) {
    const k = (y - btop) / (waist - btop);
    c.px(Math.round(cx + 1.6 - k * 3.4), y, S.trim, sphere(0.1, -0.2, 1));
  }
  // The wide sash, its knot at her left hip and the tails hanging from it.
  c.part();
  c.shape(Math.round(waist), Math.round(waist + 2), () => [cx - 3.5, cx + 3.5], S.sash, (_x, y, t) => cyl(t, y === Math.round(waist) ? 0.5 : y === Math.round(waist + 2) ? -0.3 : 0.1));
  c.part();
  c.capsule(14.3, waist + 2, 14.9 + p.robe * 0.5, 27.4 + L, 0.75, 0.6, S.sash);
  c.capsule(13.5, waist + 2, 13.1 + p.robe * 0.35, 26.4 + L, 0.7, 0.55, S.sash, { bias: -1 });
  c.part();
  c.px(14.9 + p.robe * 0.5, 28.2 + L, S.trim, sphere(0.2, 0.3, 1));
  c.px(13.1 + p.robe * 0.35, 27.2 + L, S.trim, sphere(-0.2, 0.3, 1));
  c.part();
  c.ellipse(14.3, waist + 1, 1.3, 1.1, S.sash, { bias: 1 });
  // Her saber hilt, hanging from the sash at her left hip.
  hilt(c, 16.3, waist + 1.5, 16.7, waist + 5);

  // The high collar standing round her neck; the head is drawn over it.
  c.part();
  c.shape(Math.round(13 + U), Math.round(15.6 + U), (y) => {
    const u = (y - 13 - U) / 2.6;
    const hw2 = 3.9 - 0.4 * u;
    return [cx - hw2, cx + hw2];
  }, S.robe, (_x, _y, t) => cyl(t, 0.3));
  c.part();
  for (const [x, y] of [[8, 13], [9, 13], [14, 13], [15, 13], [8, 14], [15, 14]] as const) c.px(x, y + U, S.trim, sphere((x - cx + 0.5) / 4, -0.5, 1));

  // Head.
  c.part();
  c.ellipse(cx, 11.8 + U, 2.9, 2.8, S.skin);
  c.part();
  c.px(11, 12.8 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  // The throat in the collar's opening.
  c.px(11, 15 + U, S.skin, FLAT_DOWN, { bias: -1 });
  c.px(12, 15 + U, S.skin, FLAT_DOWN, { bias: -2 });
  c.part();
  c.px(11, 14 + U, LIPS, sphere(-0.2, 0.2, 1));
  // Hair parted in the middle, falling to the jaw either side.
  c.part();
  const widths = [2.4, 3.3, 3.6];
  c.shape(Math.round(8.4 + U), Math.round(10.4 + U), (y) => {
    const w = widths[Math.max(0, Math.min(2, Math.round(y - 8.4 - U)))];
    return [cx - w, cx + w];
  }, S.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1));
  c.shade(11, Math.round(9.4 + U), -1);
  c.shade(12, Math.round(9.4 + U), -1);
  c.px(11, Math.round(10.4 + U), S.skin, sphere(-0.1, -0.8));
  c.px(12, Math.round(10.4 + U), S.skin, sphere(0.1, -0.8));
  for (const y of [11, 12, 13]) {
    c.px(8, y + U, S.hair, cyl(-0.8, 0), { bias: y === 13 ? -1 : 0 });
    c.px(15, y + U, S.hair, cyl(0.8, 0), { bias: y === 13 ? -1 : 0 });
  }
  // The crown of braids over the top of her head.
  crown(c, cx, 10.6 + U, 3.7, 2.7, Math.PI * 1.06, Math.PI * 1.94);
  eyes(c, [[10, 12 + U, 0], [13, 12 + U, 0]], p);

  // The long braid over her right shoulder (screen left).
  braid(c, 8.8, 14.2 + U, 8.2 + p.robe * 0.35, 21.4 + U);
  // Shoulders, and the arms in their bell sleeves.
  c.part();
  c.ellipse(8.2, 16.6 + U, 1.9, 1.4, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 0.95) });
  c.part();
  c.ellipse(15.8, 16.6 + U, 1.9, 1.4, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 0.95) });
  const ha = { x: p.a.x, y: p.a.y + U };
  const hb = { x: p.b.x, y: p.b.y + U };
  arm(c, 8.2, 17 + U, ha.x, ha.y, p.ga);
  arm(c, 15.8, 17 + U, hb.x, hb.y, p.gb);

  book(c, cx, 23 + U, p.book ?? 0, p.page ?? 0);
  pebbles(c, p.orbit, U, 'front');
  motes(c, p.motes ?? 0, L);
}

function drawUp(c: PixelCanvas, p: SagePose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = cx0;
  // From behind, a hand before her is hidden by her body; one raised or out wide is seen.
  const shown = (h: Pt) => h.y < 14.5 || Math.abs(h.x - cx) > 6.2;
  const ha = { x: p.a.x, y: p.a.y + U };
  const hb = { x: p.b.x, y: p.b.y + U };
  if (!shown(p.a)) arm(c, 8.2, 17 + U, ha.x, ha.y, 0, -1);
  if (!shown(p.b)) arm(c, 15.8, 17 + U, hb.x, hb.y, 0, -1);

  toe(c, 10.4, 30.8 + L - (p.step < 0 ? 1 : 0));
  toe(c, 13.6, 30.8 + L - (p.step > 0 ? 1 : 0));
  const top = 22.5 + U;
  const hemU = 30 + L;
  const f = p.flare;
  skirt(c, top, hemU, hemU - 1, (u) => 3.3 + 3.5 * Math.pow(u, 1.2) + f * 2.2 * u * u, (u) => cx + p.robe * u * u, false, 'up');

  const btop = 15.6 + U;
  const waist = 20 + U;
  c.part();
  c.shape(Math.round(btop), Math.round(waist), (y) => {
    const u = (y + 0.5 - btop) / (waist + 1 - btop);
    const hw = 3.8 - 0.9 * u;
    return [cx - hw, cx + hw];
  }, S.robe, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  c.part();
  c.shape(Math.round(waist), Math.round(waist + 2), () => [cx - 3.5, cx + 3.5], S.sash, (_x, y, t) => cyl(t, y === Math.round(waist) ? 0.5 : -0.1));
  // The bow at the small of her back, and its tails.
  c.part();
  c.capsule(cx - 0.4, waist + 2, cx - 1.2 + p.robe * 0.4, 27 + L, 0.75, 0.6, S.sash, { bias: -1 });
  c.capsule(cx + 0.4, waist + 2, cx + 1.3 + p.robe * 0.5, 26.4 + L, 0.75, 0.6, S.sash);
  c.part();
  c.ellipse(cx - 1.8, waist + 1, 1.4, 1, S.sash, { bias: 1 });
  c.ellipse(cx + 1.8, waist + 1, 1.4, 1, S.sash, { bias: 1 });
  c.part();
  c.ellipse(cx, waist + 1, 0.9, 1, S.sash);

  // The collar from behind, standing up round her neck.
  c.part();
  c.shape(Math.round(13.2 + U), Math.round(15.6 + U), () => [cx - 3.6, cx + 3.6], S.robe, (_x, _y, t, u) => cyl(t, 0.5 - u * 0.4));
  c.part();
  for (let x = Math.round(cx - 3.6); x < cx + 3.6; x++) c.px(x, Math.round(13.2 + U), S.trim, cyl((x + 0.5 - cx) / 3.6, 0.6));

  // The back of her head, the crown of braids wound round it, the long braid down her back.
  c.part();
  c.ellipse(cx, 11.4 + U, 3.3, 3.1, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
  crown(c, cx, 9.8 + U, 3.5, 2.2, Math.PI * 0.08, Math.PI * 0.92);
  braid(c, cx, 13.6 + U, cx + p.robe * 0.5, 23.6 + U);

  c.part();
  c.ellipse(8.2, 16.6 + U, 1.9, 1.4, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 0.95) });
  c.part();
  c.ellipse(15.8, 16.6 + U, 1.9, 1.4, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 0.95) });
  if (shown(p.a)) arm(c, 8.2, 17 + U, ha.x, ha.y, p.ga);
  else palm(c, ha.x, ha.y, p.ga * 0.6);
  if (shown(p.b)) arm(c, 15.8, 17 + U, hb.x, hb.y, p.gb);
  else palm(c, hb.x, hb.y, p.gb * 0.6);
  motes(c, p.motes ?? 0, L);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: SagePose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = cx0;
  const Sx = -p.lean;
  const hx = cx + Sx;
  const f = p.flare;
  const ha = { x: p.a.x + Sx, y: p.a.y + U };
  const hb = { x: p.b.x + Sx, y: p.b.y + U };

  // The far arm, behind her.
  arm(c, hx + 1.4, 17 + U, hb.x, hb.y, p.gb, -1);
  // The long braid down her back, swinging with her stride.
  braid(c, hx + 2.6, 13.4 + U, hx + 3.6 + p.robe * 0.6, 22.6 + U);

  // Slippers: the far one a step behind.
  toe(c, cx - 0.4 + Math.max(0, -p.step), 30.7 + L, true);
  toe(c, cx - 1.8 - Math.max(0, p.step), 30.7 + L - (p.step > 1 ? 0.6 : 0), true);

  // The skirt in profile: open at the front, trailing behind.
  const top = 22.5 + U;
  const hemU = 30 + L;
  const span = hemU + 1 - top;
  const back = (u: number) => hx + 2.3 + 3.2 * Math.pow(u, 1.2) + p.robe * u * u - Sx * u + f * 1.6 * u;
  const front = (u: number) => hx - 2.3 - 1.5 * u - Sx * u * 0.6 - f * 1.6 * u;
  c.part();
  c.shape(Math.round(top), Math.round(hemU), (y) => {
    const u = (y + 0.5 - top) / span;
    return [front(u), back(u)];
  }, S.under, (_x, _y, t, u) => cyl(t * 0.8 - 0.1, 0.15 - u * 0.25));
  const hemO = hemU - 1;
  const ospan = hemO + 1 - top;
  c.part();
  c.shape(Math.round(top), Math.round(hemO), (y) => {
    const u = (y + 0.5 - top) / ospan;
    return [front(u) + 0.9 + 0.6 * u, back(u) + 0.3];
  }, S.robe, (_x, _y, t, u) => cyl(t * 0.8 - 0.05, 0.25 - u * 0.35));
  for (let y = Math.round(top + 1); y <= hemO; y++) {
    const u = (y + 0.5 - top) / ospan;
    c.px(Math.round(front(u) + 0.9 + 0.6 * u), y, S.trim, cyl(-0.5, 0.2));
    c.shade(Math.round(hx + 0.8 + u * 1.6), y, -1);
  }
  for (let x = Math.round(front(1) + 1.5); x < back(1) + 0.3; x++) if (c.materialAt(x, Math.round(hemO)) === S.robe) c.px(x, Math.round(hemO), S.trim, cyl(0, -0.2));

  // Bodice in profile.
  const btop = 15.6 + U;
  const waist = 20 + U;
  c.part();
  c.shape(Math.round(btop), Math.round(waist), (y) => {
    const bust = y === Math.round(17 + U) || y === Math.round(18 + U) ? 0.5 : 0;
    return [hx - 2.3 - bust, hx + 2.2];
  }, S.robe, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, (u - 0.35) * 1.1, 1));
  c.part();
  for (let y = Math.round(btop); y <= waist; y++) c.px(Math.round(hx - 1.4 + (y - btop) * 0.15), y, S.trim, sphere(-0.3, -0.2, 1));
  // The sash, its knot at the far hip and the tails trailing behind.
  c.part();
  c.shape(Math.round(waist), Math.round(waist + 2), () => [hx - 2.5, hx + 2.4], S.sash, (_x, y, t) => cyl(t * 0.9 - 0.1, y === Math.round(waist) ? 0.5 : 0.05));
  c.part();
  c.capsule(hx + 2.4, waist + 1.5, hx + 3.6 + p.robe * 0.7, 26.6 + L, 0.75, 0.6, S.sash, { bias: -1 });
  c.part();
  c.ellipse(hx + 2.4, waist + 1, 1.1, 1.1, S.sash, { bias: 1 });
  // The saber hilt at her near hip.
  hilt(c, hx + 0.3, waist + 1.5, hx + 0.7, waist + 5);

  // The collar, higher at the nape.
  c.part();
  c.shape(Math.round(12.8 + U), Math.round(15.6 + U), (y) => {
    const u = (y - 12.8 - U) / 2.8;
    return [hx - 1.4 - u * 0.8, hx + 2.6];
  }, S.robe, (_x, _y, t) => cyl(t * 0.8 + 0.1, 0.3));
  c.part();
  c.px(Math.round(hx + 1), Math.round(12.8 + U), S.trim, sphere(0, -0.6, 1));
  c.px(Math.round(hx + 2), Math.round(12.8 + U), S.trim, sphere(0.4, -0.6, 1));
  c.px(Math.round(hx - 2), Math.round(14 + U), S.trim, sphere(-0.4, -0.4, 1));

  // Head in profile.
  c.part();
  c.ellipse(hx - 0.9, 11.9 + U, 2.7, 2.7, S.skin);
  c.part();
  c.px(hx - 4, 12.4 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.shade(hx - 3, 13.6 + U, -1);
  // Hair swept back over the ear, the crown of braids, the braid's root at her nape.
  c.part();
  const rows: [number, number][] = [
    [-2.2, 1.8],
    [-3.2, 2.6],
    [-3.2, 2.9],
    [-0.4, 2.9],
    [0.2, 2.7],
    [0.8, 2.4],
  ];
  c.shape(Math.round(8.4 + U), Math.round(13.4 + U), (y) => {
    const [l, r] = rows[Math.max(0, Math.min(5, Math.round(y - 8.4 - U)))];
    return [hx + l, hx + r];
  }, S.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.4 - 0.9, 1));
  crown(c, hx - 0.3, 10.4 + U, 3.3, 2.4, Math.PI * 1.22, Math.PI * 2.02);
  eyes(c, [[hx - 3, 12 + U, 0]], p);

  // The near arm, over her body.
  c.part();
  c.ellipse(hx + 0.4, 16.6 + U, 1.9, 1.5, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 0.95) });
  arm(c, hx + 0.4, 17 + U, ha.x, ha.y, p.ga);
  motes(c, p.motes ?? 0, L);
}

// ---------------------------------------------------------------------------
// The Starseer's embroidery: silver stars stitched over the robe, a few of
// them joined by faint threads into constellations. Placed by where they lie
// on her body, so they stay put on the cloth as she moves.

function stitchStars(c: PixelCanvas, U: number): void {
  const at = (x: number, y: number) => c.materialAt(x, y) === S.robe;
  for (let y = 0; y < 34; y++) {
    for (let x = -4; x < 28; x++) {
      if (!at(x, y)) continue;
      const k = hash(x, y - U, 77);
      if (k < 0.055) {
        c.px(x, y, STAR_STITCH, sphere(0, -0.3, 1));
        c.spark(x, y, [200, 210, 255], 0.35);
        // A constellation: a thread on to the next stitched star, if it's near.
        if (k < 0.02 && at(x + 1, y + 1) && at(x + 2, y + 1)) {
          c.px(x + 1, y + 1, STAR_THREAD, FLAT_DOWN);
          c.px(x + 2, y + 1, STAR_STITCH, sphere(0, -0.3, 1));
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Animations

const P = (x: number, y: number): Pt => ({ x, y });

function idle(view: View): SagePose[] {
  const out: SagePose[] = [];
  const N = 8;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph - 0.6) > 0.1 ? 1 : 0;
    // The hem and the braid stir as in a faint breeze.
    p.robe = Math.sin(ph - 2.2) > 0.55 ? 1 : Math.sin(ph - 2.2) < -0.75 ? -1 : 0;
    p.blink = f === 5;
    out.push(p);
  }
  return out;
}

/** She glides: hands folded, the hem swaying, a slipper toe showing at each step. */
function walk(view: View): SagePose[] {
  const out: SagePose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0;
    if (view === 'side') {
      p.step = Math.round(s * 2.2);
      p.robe = 1 + (p.lift ? 0 : 1);
      p.a.y += p.lift ? -0.5 : 0;
    } else {
      p.step = s > 0.3 ? 1 : s < -0.3 ? -1 : 0;
      p.robe = Math.round(-s);
    }
    out.push(p);
  }
  return out;
}

/** Throw keyframes for the throwing hand, per view: gather low, lift, draw back, thrust, follow through, recover. */
const THROW: Record<View, Pt[]> = {
  down: [P(17.6, 24.6), P(18.6, 19.6), P(17.4, 14.6), P(14.4, 22.8), P(13.6, 24.2), P(14.6, 22)],
  up: [P(17.4, 24), P(18.6, 19.2), P(17.6, 15.2), P(15.4, 11.2), P(15, 12.4), P(16, 19)],
  side: [P(13.6, 24.6), P(15.6, 19.6), P(16.4, 14.6), P(5, 17.4), P(5.6, 19), P(8.4, 20.6)],
};
const THROW_GLOW = [0.45, 0.75, 1, 1, 0.5, 0.15];

/**
 * A throw with one hand: she sweeps it low (and the stone tears free of the
 * ground), lifts it, draws it back over her shoulder and flings it forward.
 * `second` throws with the other hand.
 */
function throwAnim(second: boolean) {
  return (view: View): SagePose[] =>
    THROW[view].map((h, i) => {
      const p = base(view);
      const out = i === 3 || i === 4;
      const k = THROW_GLOW[i];
      // The other hand: a front view's mirror, or in profile the far hand reaching past her.
      const hand = view === 'side' ? (second ? { x: h.x + 0.6, y: h.y - 0.4 } : h) : second ? { x: 24 - h.x, y: h.y } : h;
      const rest = view === 'side' ? FOLD.side[second ? 0 : 1] : { x: second ? 13.6 : 10.4, y: 21.6 };
      if (view === 'side') {
        if (second) {
          p.b = hand;
          p.gb = k;
          p.a = { ...rest };
        } else {
          p.a = hand;
          p.ga = k;
          p.b = { ...rest };
        }
        p.lean = out ? 1 : i === 2 ? -1 : 0;
        p.step = out ? 2 : 0;
        p.robe = out ? 2 : 1;
      } else if (second) {
        p.a = hand;
        p.ga = k;
        p.b = rest;
      } else {
        p.b = hand;
        p.gb = k;
        p.a = rest;
      }
      p.breath = out ? 1 : 0;
      if (view !== 'side') p.robe = out ? (second ? 1 : -1) * (view === 'down' ? 1 : -1) : 0;
      return p;
    });
}

/** The heave: both hands low, swept up overhead hauling a slab out of the ground, held, and hurled. */
const HEAVE: Record<View, [Pt, Pt][]> = {
  down: [
    [P(7.4, 24.4), P(16.6, 24.4)],
    [P(6.4, 19.6), P(17.6, 19.6)],
    [P(9.2, 9.6), P(14.8, 9.6)],
    [P(9.6, 9), P(14.4, 9)],
    [P(10.4, 21), P(13.6, 21)],
    [P(10.2, 23.4), P(13.8, 23.4)],
    [P(10.4, 22.2), P(13.6, 22.2)],
    [P(10.9, 21.4), P(13.1, 21.4)],
  ],
  up: [
    [P(7.4, 24.4), P(16.6, 24.4)],
    [P(6.4, 19.6), P(17.6, 19.6)],
    [P(9.2, 10.6), P(14.8, 10.6)],
    [P(9.6, 10), P(14.4, 10)],
    [P(8.8, 7.6), P(15.2, 7.6)],
    [P(9.2, 9.4), P(14.8, 9.4)],
    [P(8, 16), P(16, 16)],
    [P(10.9, 21.4), P(13.1, 21.4)],
  ],
  side: [
    [P(14.4, 24.4), P(13.2, 24.6)],
    [P(15.6, 19.6), P(14.6, 19.6)],
    [P(13.6, 9.4), P(14.6, 9.8)],
    [P(14.2, 9), P(15.2, 9.4)],
    [P(5.2, 19), P(5.8, 19.6)],
    [P(5.6, 22), P(6.2, 22.4)],
    [P(7.6, 21.4), P(8.2, 21.2)],
    [P(8.8, 21), P(9.4, 20.6)],
  ],
};
const HEAVE_GLOW = [0.4, 0.7, 1, 1, 1, 0.55, 0.25, 0.05];

function heave(view: View): SagePose[] {
  return HEAVE[view].map(([a, b], i) => {
    const p = base(view);
    p.a = a;
    p.b = b;
    p.ga = p.gb = HEAVE_GLOW[i];
    const up = i === 2 || i === 3;
    const out = i === 4 || i === 5;
    p.breath = i === 0 || out ? 1 : 0;
    p.lift = up ? 1 : 0;
    p.robe = out ? (view === 'side' ? 3 : 0) : up ? (view === 'side' ? 0 : 0) : 0;
    if (view === 'side') {
      p.lean = out ? 2 : up ? -1 : 0;
      p.step = out ? 2 : up ? -1 : 0;
      if (!out) p.robe = 1;
    }
    p.flare = out ? 0.4 : 0;
    return p;
  });
}

/** The barrier: hands crossed at her breast, then flung wide, palms out, as the dome springs up. */
const BARRIER: Record<View, [Pt, Pt][]> = {
  down: [
    [P(11.2, 18.4), P(12.8, 18.4)],
    [P(12.6, 17.8), P(11.4, 17.8)],
    [P(5, 19.4), P(19, 19.4)],
    [P(4.6, 20), P(19.4, 20)],
    [P(7, 22.4), P(17, 22.4)],
    [P(10.4, 21.6), P(13.6, 21.6)],
  ],
  up: [
    [P(11.2, 18.4), P(12.8, 18.4)],
    [P(12.6, 17.8), P(11.4, 17.8)],
    [P(5, 19.4), P(19, 19.4)],
    [P(4.6, 20), P(19.4, 20)],
    [P(7, 22.4), P(17, 22.4)],
    [P(10.4, 21.6), P(13.6, 21.6)],
  ],
  side: [
    [P(9, 18.2), P(9.6, 18.6)],
    [P(9.6, 17.6), P(9, 17.8)],
    [P(5, 18.6), P(17.6, 18.6)],
    [P(4.6, 19.2), P(18, 19.2)],
    [P(7, 21.4), P(15, 21.4)],
    [P(8.8, 21), P(9.4, 20.6)],
  ],
};
const BARRIER_GLOW = [0.5, 0.9, 1, 0.8, 0.4, 0.1];

function barrier(view: View): SagePose[] {
  return BARRIER[view].map(([a, b], i) => {
    const p = base(view);
    p.a = a;
    p.b = b;
    p.ga = p.gb = BARRIER_GLOW[i];
    p.breath = i === 1 ? 1 : 0;
    const wide = i === 2 || i === 3;
    p.flare = wide ? 0.5 : 0;
    p.robe = wide ? (i === 2 ? 1 : -1) : 0;
    if (view === 'side') p.robe = wide ? 2 : 1;
    return p;
  });
}

/** Her Special's pose: arms rising from her sides to above her head, palms up, as she floats off the ground. */
const RAISE: Record<View, [Pt, Pt][]> = {
  down: [
    [P(7.2, 24), P(16.8, 24)],
    [P(5.8, 20), P(18.2, 20)],
    [P(5.4, 15.8), P(18.6, 15.8)],
    [P(6.4, 11.8), P(17.6, 11.8)],
    [P(8, 8.8), P(16, 8.8)],
    [P(8, 8.4), P(16, 8.4)],
  ],
  up: [
    [P(7.2, 24), P(16.8, 24)],
    [P(5.8, 20), P(18.2, 20)],
    [P(5.4, 15.8), P(18.6, 15.8)],
    [P(6.4, 11.8), P(17.6, 11.8)],
    [P(8, 8.8), P(16, 8.8)],
    [P(8, 8.4), P(16, 8.4)],
  ],
  side: [
    [P(10.4, 24), P(13.2, 24)],
    [P(8.4, 20), P(14.6, 20)],
    [P(7.4, 15.8), P(15, 16)],
    [P(8.2, 11.6), P(14.4, 11.8)],
    [P(9.6, 8.8), P(13.4, 9)],
    [P(9.8, 8.4), P(13.2, 8.6)],
  ],
};
const RAISE_GLOW = [0.3, 0.5, 0.7, 0.9, 1, 1];

function levitate(view: View): SagePose[] {
  return RAISE[view].map(([a, b], i) => {
    const p = base(view);
    p.a = a;
    p.b = b;
    p.ga = p.gb = RAISE_GLOW[i];
    p.hover = i >= 4 ? 2 : i >= 2 ? 1 : 0;
    p.flare = Math.min(1, i * 0.22);
    p.robe = view === 'side' ? 1 + (i % 2) : i % 2 ? 1 : -1;
    p.motes = i >= 2 ? i : 0;
    return p;
  });
}

/** Holding them all up: arms raised and trembling with the strain, floating, the Force pulsing in her palms. */
function hold(view: View): SagePose[] {
  const top = RAISE[view][5];
  return [0, 1, 2, 3].map((i) => {
    const p = base(view);
    const j = i % 2 ? 0.4 : -0.4;
    p.a = { x: top[0].x + j, y: top[0].y + (i === 1 ? 0.5 : 0) };
    p.b = { x: top[1].x - j, y: top[1].y + (i === 3 ? 0.5 : 0) };
    p.ga = p.gb = 0.8 + (i % 2) * 0.2;
    p.hover = i < 2 ? 2 : 3;
    p.flare = 0.8 + (i % 2) * 0.2;
    p.robe = view === 'side' ? 1 + (i % 2) : [1, 0, -1, 0][i];
    p.motes = 3 + i;
    return p;
  });
}

/** And brings them down: the arms swept down hard, palms to the ground, her robe blown out round her. */
const SLAM: Record<View, [Pt, Pt][]> = {
  down: [
    [P(8.6, 7.4), P(15.4, 7.4)],
    [P(6.4, 16.6), P(17.6, 16.6)],
    [P(6.6, 25.4), P(17.4, 25.4)],
    [P(6.6, 25.8), P(17.4, 25.8)],
    [P(9.4, 23.2), P(14.6, 23.2)],
  ],
  up: [
    [P(8.6, 7.4), P(15.4, 7.4)],
    [P(6.4, 16.6), P(17.6, 16.6)],
    [P(6.6, 25.4), P(17.4, 25.4)],
    [P(6.6, 25.8), P(17.4, 25.8)],
    [P(9.4, 23.2), P(14.6, 23.2)],
  ],
  side: [
    [P(10, 7.4), P(13, 7.6)],
    [P(6.4, 16.4), P(14.6, 16.4)],
    [P(6.2, 25), P(13.6, 25.2)],
    [P(6.2, 25.4), P(13.6, 25.6)],
    [P(8.2, 22.4), P(11, 22.2)],
  ],
};

function slam(view: View): SagePose[] {
  return SLAM[view].map(([a, b], i) => {
    const p = base(view);
    p.a = a;
    p.b = b;
    p.ga = p.gb = [1, 1, 1, 0.6, 0.2][i];
    p.hover = [3, 1, 0, 0, 0][i];
    p.breath = [0, 1, 2, 2, 1][i];
    p.flare = [0.6, 0.8, 1, 0.6, 0.2][i];
    p.robe = view === 'side' ? [1, 2, 3, 2, 1][i] : 0;
    if (view === 'side') {
      p.lean = [0, 1, 2, 2, 1][i];
      p.step = [0, 1, 2, 2, 1][i];
    }
    return p;
  });
}

/**
 * The idle moment, facing the viewer: she sits down cross-legged in the air,
 * opens her hands on her knees, and a book rises before her, falling open;
 * she reads, a page turning itself over now and then, while pebbles lift off
 * the ground and circle her slowly. Then she closes it and stands.
 */
function rest(view: View): SagePose[] {
  if (view !== 'down') return [];
  const at = (o: Partial<SagePose>): SagePose => ({ ...base('down'), ...o });
  // Hands on her knees, palms up: placed in body pixels whatever the seat's drop.
  const knees = (sit: number, hover: number, extra: Partial<SagePose> = {}): SagePose => {
    const D = Math.round(sit * SIT_DROP);
    return at({ sit, hover, a: P(6.2, 26.2 - D), b: P(17.8, 26.2 - D), ga: 0.35, gb: 0.35, ...extra });
  };
  return [
    // 0: standing.
    at({}),
    // 1-2: lowering into the seat, the robe gathering.
    at({ sit: 0.4, breath: 0, a: P(9.4, 22.6), b: P(14.6, 22.6), robe: 1 }),
    at({ sit: 0.8, a: P(7.4, 24.4), b: P(16.6, 24.4) }),
    // 3: seated and risen off the ground, hands open on her knees.
    knees(1, 1),
    // 4-5: the book rises before her and falls open.
    knees(1, 2, { book: 0.3, motes: 1 }),
    knees(1, 2, { book: 1, motes: 2, read: true, orbit: 0 }),
    // 6-11: reading as the pebbles circle; 8-10 a page turning.
    knees(1, 2, { book: 1, read: true, orbit: 0.5, motes: 3 }),
    knees(1, 3, { book: 1, read: true, orbit: 1, motes: 4, robe: 1 }),
    knees(1, 3, { book: 1, read: true, orbit: 1.5, page: 1, ga: 0.6 }),
    knees(1, 3, { book: 1, read: true, orbit: 2, page: 2, ga: 0.6, motes: 5 }),
    knees(1, 2, { book: 1, read: true, orbit: 2.5, page: 3, ga: 0.5 }),
    knees(1, 2, { book: 1, read: true, orbit: 3, motes: 6, robe: -1 }),
    // 12: the book closing.
    knees(1, 2, { book: 0.3, orbit: 3.5, blink: true }),
    // 13: settling down to stand.
    knees(1, 1),
  ];
}

/** Played: sit, read on with the pages turning and the pebbles circling the whole way round twice, close, stand. */
const REST_ORDER = [0, 1, 2, 3, 3, 4, 5, 6, 7, 6, 7, 8, 9, 10, 11, 6, 7, 6, 7, 8, 9, 10, 11, 6, 7, 12, 13, 2, 1, 0] as const;

export type SageAnim = 'idle' | 'walk' | 'throw1' | 'throw2' | 'heave' | 'barrier' | 'levitate' | 'hold' | 'slam' | 'rest';

interface AnimDef {
  name: SageAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => SagePose[];
  order?: readonly number[];
}

export const SAGE_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'throw1', fps: 16, loop: false, poses: throwAnim(false) },
  { name: 'throw2', fps: 16, loop: false, poses: throwAnim(true) },
  { name: 'heave', fps: 14, loop: false, poses: heave },
  { name: 'barrier', fps: 12, loop: false, poses: barrier },
  { name: 'levitate', fps: 8, loop: false, poses: levitate },
  { name: 'hold', fps: 8, loop: true, poses: hold },
  { name: 'slam', fps: 16, loop: false, poses: slam },
  { name: 'rest', fps: 7, loop: false, poses: rest, order: REST_ORDER },
];

/** The frame of each move on which the stone leaves her hand (or the dome springs up). */
export const SAGE_RELEASE = { throw1: 3, throw2: 3, heave: 4, barrier: 2 } as const;

/** Where the stone is held before it's thrown, per view, in body pixels from her feet: over the throwing hand's lift. */
export interface SageFrame {
  key: string;
  anim: SageAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: SagePose): PixelCanvas {
  const c = new PixelCanvas(SAGE_W, SAGE_H).offset(BODY_X, BODY_Y - p.hover);
  const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
  if (view === 'down') drawDown(c, p);
  else if (view === 'up') drawUp(c, p);
  else drawSide(c, p);
  if (S.stars) stitchStars(c, -p.lift + p.breath + Math.round((p.sit ?? 0) * SIT_DROP));
  return dir === 'right' ? c.mirrored() : c;
}

export function buildSageFrames(look: SageLook = SAGE_LOOK): SageFrame[] {
  S = look;
  const out: SageFrame[] = [];
  for (const a of SAGE_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, pose) }));
    }
  }
  S = SAGE_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// The stones she throws: a chunk of rock torn out of the ground (a slab for
// the heave), or the Starseer's meteorites, dark and veined with light.
// Each is drawn turned to STONE_TURNS angles: the outline and its facets are
// worked out in the stone's own frame, so it tumbles without smearing.

export const STONE_SIZE = 20;
export const STONE_TURNS = 8;
export type StoneKind = 'rock' | 'slab';

const ROCK: Material = { ramp: ramp('#2a2620', '#4a443a', '#6e665a', '#958c7c', '#bcb4a0'), outline: hex('#110f0c') };
const ROCK_MOSS: Material = { ramp: ramp('#1e2a14', '#344a20', '#4e6a2c'), outline: hex('#0c1208') };
const EARTH: Material = { ramp: ramp('#2a1a10', '#4a3020', '#6a4a30'), outline: hex('#120a06') };
const BASALT: Material = { ramp: ramp('#0c0a12', '#1a1622', '#2c2638', '#423a52', '#5a5070'), outline: hex('#050408'), shine: true };
const VEIN: Material = { ramp: ramp('#8a70ff', '#d4c8ff', '#ffffff'), outline: hex('#2a1a5a'), emissive: 1, noAO: true, noOutline: true };

/** The stone's radius at angle `a` in its own frame: lumpy, with a flat broken face or two. */
function stoneRadius(kind: StoneKind, seed: number, a: number): number {
  const r0 = kind === 'slab' ? 6.8 : 4.4;
  let r = r0 * (1 + 0.13 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 5 + seed * 2.3));
  if (kind === 'slab') r *= 0.82 + 0.18 * Math.abs(Math.cos(a));
  return r;
}

/** One stone, turned by `turn` of a whole turn. */
export function stoneFrame(kind: StoneKind, meteor: boolean, turn: number, seed = 1.3): PixelCanvas {
  const c = new PixelCanvas(STONE_SIZE, STONE_SIZE);
  const m = STONE_SIZE / 2;
  const phi = turn * Math.PI * 2;
  const facets = kind === 'slab' ? 7 : 6;
  const body = meteor ? BASALT : ROCK;
  c.part();
  for (let y = 0; y < STONE_SIZE; y++) {
    for (let x = 0; x < STONE_SIZE; x++) {
      const dx = x + 0.5 - m;
      const dy = y + 0.5 - m;
      // Into the stone's own frame.
      const lx = dx * Math.cos(-phi) - dy * Math.sin(-phi);
      const ly = dx * Math.sin(-phi) + dy * Math.cos(-phi);
      const a = Math.atan2(ly, lx);
      const d = Math.hypot(lx, ly);
      const R = stoneRadius(kind, seed, a);
      if (d > R) continue;
      // Faceted: each face takes one normal, tilted out by how far from the middle it lies.
      const f = Math.floor(((a + Math.PI) / (Math.PI * 2)) * facets);
      const fa = ((f + 0.5) / facets) * Math.PI * 2 - Math.PI + phi;
      const out = d / R > 0.5 ? 0.75 : 0.25;
      const n: Vec3 = sphere(Math.cos(fa) * out, Math.sin(fa) * out, 1);
      // The face it was torn from: earth still clinging (rock), or veins of light (meteor).
      let mat = body;
      if (!meteor && lx < -R * 0.45 && hash(Math.round(lx * 2), Math.round(ly * 2), 3) < 0.7) mat = EARTH;
      if (!meteor && ly < -R * 0.55 && lx > 0) mat = ROCK_MOSS;
      if (meteor) {
        const v = Math.abs(Math.sin(lx * 1.3 + ly * 0.7 + seed) + Math.sin(ly * 1.7 - lx * 0.4));
        if (v < 0.22 && d < R - 0.8) mat = VEIN;
      }
      c.px(x, y, mat, n, { bias: f % 2 ? 0 : -1 });
    }
  }
  // A crack across it.
  const ca = phi + 0.6;
  for (let k = -2; k <= 2; k++) c.shade(m + Math.cos(ca) * k * 1.1 + Math.sin(ca) * 0.6, m + Math.sin(ca) * k * 1.1 - Math.cos(ca) * 0.6, -1);
  // Held by the Force: its light hugging the outline.
  const glow: RGB = meteor ? [196, 176, 255] : [120, 240, 220];
  for (let y = 0; y < STONE_SIZE; y++) {
    for (let x = 0; x < STONE_SIZE; x++) {
      if (c.filled(x, y)) continue;
      if (c.filled(x - 1, y) || c.filled(x + 1, y) || c.filled(x, y - 1) || c.filled(x, y + 1)) c.spark(x, y, glow, meteor ? 0.5 : 0.4);
    }
  }
  return c;
}

/** Every stone frame, named `<rock|slab>_<turn>`, for one look's texture. */
export function stoneFrames(meteor: boolean): { name: string; canvas: PixelCanvas }[] {
  const out: { name: string; canvas: PixelCanvas }[] = [];
  for (const kind of ['rock', 'slab'] as const) {
    for (let i = 0; i < STONE_TURNS; i++) out.push({ name: `${kind}_${i}`, canvas: stoneFrame(kind, meteor, i / STONE_TURNS, kind === 'slab' ? 2.1 : 1.3) });
  }
  return out;
}

/** The texture key of a look's stones. */
export const stoneKey = (meteor: boolean): string => (meteor ? 'sage_meteor' : 'sage_stone');

// ---------------------------------------------------------------------------
// Icons

export const SAGE_TONES: Tones = [hex('#f0fffc'), hex('#9cf6e8'), hex('#3ad0c0'), hex('#14605a')];
export const STARSEER_TONES: Tones = [hex('#ffffff'), hex('#e6dcff'), hex('#a68cff'), hex('#3a2a7a')];

/** The Force throw: a stone flying, a trail of Force behind it and grit falling off it. */
export function throwIcon(t: Tones, meteor = false): Uint8ClampedArray {
  const rock: [RGB, RGB, RGB] = meteor ? [hex('#4a4058'), hex('#2c2638'), hex('#1a1622')] : [hex('#b4ac98'), hex('#7e7666'), hex('#4a443a')];
  return icon16((put) => {
    // The trail, curving up from the lower left.
    for (let i = 0; i < 7; i++) {
      const x = 1 + i * 1.2;
      const y = 13 - i * 1.1 + Math.sin(i * 0.9) * 0.4;
      put(x, y, i > 4 ? t[1] : t[2]);
      if (i > 1) put(x, y + 1, t[3]);
    }
    // The stone: lit top-left, darker below, its outline glowing.
    for (let y = 2; y <= 10; y++) {
      for (let x = 6; x <= 14; x++) {
        const dx = x - 10;
        const dy = y - 6;
        const r = Math.hypot(dx * 1.05, dy) - (Math.sin(Math.atan2(dy, dx) * 3) * 0.5);
        if (r > 4.2) continue;
        if (r > 3.4) put(x, y, t[2]);
        else put(x, y, dx + dy < -2 ? rock[0] : dx + dy < 2 ? rock[1] : rock[2]);
      }
    }
    if (meteor) for (const [x, y] of [[9, 5], [10, 6], [11, 7], [8, 8]]) put(x, y, t[0]);
    else for (const [x, y] of [[9, 7], [10, 8], [11, 8]]) put(x, y, rock[2]);
    // Grit falling.
    for (const [x, y] of [[7, 12], [10, 13], [12, 12], [13, 14]]) put(x, y, t[1]);
  });
}

/** The Force barrier: a dome of light over the ground, a glint on its shoulder. */
export function barrierIcon(t: Tones): Uint8ClampedArray {
  return icon16((put) => {
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI + (i / 40) * Math.PI;
      const x = 8 + Math.cos(a) * 6.6;
      const y = 12 + Math.sin(a) * 8.4;
      put(x, y, t[1]);
      put(8 + Math.cos(a) * 5.4, 12 + Math.sin(a) * 7, i % 3 ? t[3] : t[2]);
    }
    // Hexes across it.
    for (const [x, y] of [[6, 7], [10, 7], [8, 9], [5, 10], [11, 10], [8, 5]]) {
      put(x, y, t[2]);
      put(x + 1, y, t[3]);
    }
    seg(put, 0, 12, 15, 12, t[2]);
    seg(put, 2, 13, 13, 13, t[3]);
    put(4, 5, t[0]);
    put(5, 4, t[0]);
    put(3, 6, t[1]);
  });
}
