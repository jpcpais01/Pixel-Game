// The Reaper: Death's own harvester, a type of the Necromancer on a rig of
// its own. A tall, gaunt figure in a tattered black-green shroud, a ragged
// mantle over narrow shoulders and a deep hood whose point hangs down his
// back; inside it a bone-white skull, two pale-green lights in its sockets.
// Bony hands grip a great scythe: an old ash snath bound in iron, a grip peg
// on it, and a long curved blade of blackened steel whose edge is honed
// bright. An hourglass hangs at his rope belt, bony toes show under the hem.
//
// His Catrina skin is a Día de Muertos calavera on the same rig: a painted
// sugar-skull face (flowers round the eyes, a heart for a nose, a stitched
// smile), black hair under a wide-brimmed black hat crowned with marigolds and
// a pink plume, an elegant black gown with a magenta panel, a black lace
// shawl and marigold ruffles, and a scythe of black lacquer and gold wound
// with a marigold garland, a silver blade glowing rose-gold along its edge.
//
// The body keeps to the 24x32 box; frames are larger so the scythe can reach
// out round him. The scythe is posed by its grip, the way its snath points
// (screen degrees) and which side its blade curls to; the hands sit on the
// snath and the arms reach for them. The spin is drawn once as a turn of
// eight frames shared by every facing (like the Sith's dervish).
//
// Also here: the button icons.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const REAPER_W = 56;
export const REAPER_H = 54;
/** Drawn in the 24x32 body box every hero uses, placed in a larger frame. */
const BODY_X = 16;
const BODY_Y = 19;
export const REAPER_ORIGIN_X = BODY_X + 12;
export const REAPER_ORIGIN_Y = BODY_Y + 31;
/** The chest's height above the feet, where cuts are centred. */
export const REAPER_CHEST_Y = 15;

/** The frame each move's blow lands on (0-based). */
export const REAP_HIT = { reap1: 2, reap2: 2 } as const;
/** The spin: frames in a whole turn, its pace, and the frames of it that cut (from, to). */
export const SPIN_FRAMES = 8;
export const SPIN_FPS = 22;
export const SPIN_LEN = 10;
export const SPIN_CUTS = { from: 2, to: 8 } as const;
/** Death's step: the frame he is gone on (where he crosses), and the frame he cuts as he forms again. */
export const STEP_GONE = 2;
export const STEP_CUT = 4;

// ---------------------------------------------------------------------------
// Materials

// The Reaper.
const SHROUD: Material = { ramp: ramp('#05070a', '#0b110f', '#131d19', '#1c2b25', '#283c33'), outline: hex('#010202'), outlineLit: hex('#0a110e') };
const RAG: Material = { ramp: ramp('#141c19', '#22302a', '#34483e', '#4a6256'), outline: hex('#040706') };
const HOOD_DARK: Material = { ramp: ramp('#000000', '#020303', '#050807'), outline: hex('#000000'), noAO: true, noOutline: true };
const BONE: Material = { ramp: ramp('#3e3c34', '#76705e', '#aea78e', '#d8d1b6', '#f4efda'), outline: hex('#15130e'), shine: true };
const SOCKET: Material = { ramp: ramp('#040404', '#0c0b0a'), outline: hex('#020202'), noAO: true };
const EYE: Material = { ramp: ramp('#5ab84a', '#c4ff9a', '#f4ffe6'), outline: hex('#0a2008'), emissive: 1, noAO: true, noOutline: true };
const SNATH: Material = { ramp: ramp('#120c08', '#24180f', '#382617', '#4e3820', '#664a2c'), outline: hex('#050302') };
const IRON: Material = { ramp: ramp('#0c0e12', '#1a1e26', '#2c323e', '#454e5e', '#687486'), outline: hex('#030405'), shine: true };
const EDGE: Material = { ramp: ramp('#7e8c84', '#b8c8bc', '#e4f2e6', '#ffffff'), outline: hex('#1a221e'), shine: true, emissive: 0.12 };
const ROPE: Material = { ramp: ramp('#2a2216', '#4a3c26', '#6a583a', '#8a7650'), outline: hex('#0c0906') };
const BRASS: Material = { ramp: ramp('#241a08', '#4a3612', '#70561e', '#947630', '#b89a4c'), outline: hex('#0e0a03'), shine: true };
const SAND: Material = { ramp: ramp('#6a5222', '#9a7c3a', '#c4a660'), outline: hex('#2a1e08'), noOutline: true };
const WHETSTONE: Material = { ramp: ramp('#2a2a2e', '#4a4a50', '#6e6e76', '#94949a'), outline: hex('#0a0a0c') };
/** The soul-light of the Reaper: pale lime, brightest first. */
const REAP_LIGHT: [RGB, RGB, RGB, RGB] = [hex('#f6fff0'), hex('#d4ffb0'), hex('#8ee86a'), hex('#2e7a3a')];

// The Catrina.
const GOWN: Material = { ramp: ramp('#060406', '#120a10', '#20121c', '#301a2a', '#44263a'), outline: hex('#010001'), outlineLit: hex('#0e060c') };
const MAGENTA: Material = { ramp: ramp('#3a0426', '#6a0a44', '#a01868', '#d8348e', '#ff6ab4'), outline: hex('#1a0210'), outlineLit: hex('#2e0620') };
const MARIGOLD: Material = { ramp: ramp('#7a2a04', '#c85a0a', '#f08e1c', '#ffbe3a', '#ffe28a'), outline: hex('#2a0e02'), shine: true, emissive: 0.1 };
const MARI_DEEP: Material = { ramp: ramp('#5a1a02', '#9a3a06', '#d0640e'), outline: hex('#200a02'), noAO: true };
const LACE: Material = { ramp: ramp('#050405', '#0e0b10', '#1a1620', '#28222e'), outline: hex('#010001'), noAO: true };
const SUGAR: Material = { ramp: ramp('#7e786e', '#bcb6a8', '#e6e2d6', '#fbf8ee', '#ffffff'), outline: hex('#1e1814'), shine: true, emissive: 0.06 };
const INK: Material = { ramp: ramp('#060408', '#120c16'), outline: hex('#020103'), noAO: true };
const PAINT_PINK: Material = { ramp: ramp('#a01060', '#ff3a96', '#ff8ac4'), outline: hex('#3a0420'), noOutline: true, noAO: true, emissive: 0.2 };
const PAINT_TEAL: Material = { ramp: ramp('#0a7a7a', '#22c8be', '#8af4ea'), outline: hex('#043a3a'), noOutline: true, noAO: true, emissive: 0.2 };
const CAT_EYE: Material = { ramp: ramp('#ff8a2a', '#ffd070', '#fff6d8'), outline: hex('#3a1404'), emissive: 1, noAO: true, noOutline: true };
const HAT: Material = { ramp: ramp('#040306', '#0c0a10', '#18141e', '#26202e', '#383040'), outline: hex('#010001'), outlineLit: hex('#0c0a10') };
const HAIR: Material = { ramp: ramp('#040306', '#0e0a10', '#1c1620', '#2c2232'), outline: hex('#010001') };
const PLUME: Material = { ramp: ramp('#a8306e', '#e45aa0', '#ff9ccc', '#ffd8ec'), outline: hex('#3a0a20'), noAO: true };
const LACQUER: Material = { ramp: ramp('#06040a', '#120c16', '#221826', '#342636', '#4a3a4c'), outline: hex('#020103'), shine: true };
const GOLD: Material = { ramp: ramp('#5a3a08', '#9a6a14', '#d4a028', '#f6d460', '#fff2b0'), outline: hex('#1e1204'), shine: true };
const SILVER: Material = { ramp: ramp('#2a2a34', '#525466', '#8a8ca0', '#c4c6d6', '#f0f0fa'), outline: hex('#0a0a10'), shine: true };
const ROSE_EDGE: Material = { ramp: ramp('#c8628a', '#ffa8c8', '#ffe4ee', '#ffffff'), outline: hex('#3a1020'), shine: true, emissive: 0.35 };
/** The Catrina's spirit flame: marigold to rose, brightest first. */
const CAT_LIGHT: [RGB, RGB, RGB, RGB] = [hex('#fff4e0'), hex('#ffc060'), hex('#ff6a9a'), hex('#8a1a5a')];

/** One look for the Reaper: its texture key, cloth, bones and scythe. */
export interface ReaperLook {
  key: string;
  robe: Material;
  rag: Material;
  skin: Material;
  eye: Material;
  snath: Material;
  /** The scythe's rings and blade. */
  steel: Material;
  edge: Material;
  trim: Material;
  /** The Catrina: sugar skull, hat, gown, marigolds. */
  catrina: boolean;
  /** Light of the soul (or spirit) flame, brightest first. */
  light: [RGB, RGB, RGB, RGB];
}

export const REAPER_LOOK: ReaperLook = {
  key: 'necro_reaper',
  robe: SHROUD,
  rag: RAG,
  skin: BONE,
  eye: EYE,
  snath: SNATH,
  steel: IRON,
  edge: EDGE,
  trim: BRASS,
  catrina: false,
  light: REAP_LIGHT,
};

export const CATRINA_LOOK: ReaperLook = {
  key: 'necro_catrina',
  robe: GOWN,
  rag: LACE,
  skin: SUGAR,
  eye: CAT_EYE,
  snath: LACQUER,
  steel: SILVER,
  edge: ROSE_EDGE,
  trim: GOLD,
  catrina: true,
  light: CAT_LIGHT,
};

export const REAPER_LOOKS = [REAPER_LOOK, CATRINA_LOOK];

/** The look being drawn; set by buildReaperFrames. */
let S: ReaperLook = REAPER_LOOK;

type View = 'down' | 'up' | 'side';

/** How the scythe is held: its grip, the way the snath points, how far it runs each way, and the blade. */
interface Scythe {
  /** The lead hand's grip, body coordinates. */
  gx: number;
  gy: number;
  /** Screen degrees from the grip towards the blade end (0 right, 90 down). */
  a: number;
  /** Grip to the blade end, and grip to the butt. */
  up: number;
  down: number;
  /** The blade curls to this side of the snath: +1 clockwise on screen, -1 the other way. */
  side: number;
  /** The blade's length, as a share of its full length (shorter pointing at or away from the eye). */
  reach: number;
  /** Drawn behind the body. */
  behind: boolean;
  /** 0..1 soul-light along the edge. */
  glow: number;
  /** A swing's smear: the snath's angle a moment ago, the light left along the blade tip's path. */
  smear?: number;
  /** The off hand on the snath this far down from the grip (null: the off hand is free). */
  off: number | null;
}

export interface ReaperPose {
  /** Whole body raised (walk, the spin's lift). */
  bob: number;
  /** Upper body pitched forward (side view) or hunched (front and back), px. */
  lean: number;
  /** The hem swinging, px, and the tatters' flutter phase. */
  sway: number;
  flutter: number;
  /** Bony feet lifted (front/back) or forward (+) / back (side). */
  footA: number;
  footB: number;
  sc: Scythe;
  /** The off hand, when free (body coordinates). */
  hand2: [number, number];
  /** 0..1 the eye-lights' blaze. */
  eyes: number;
  /** The idle moment's head shift (x, y). */
  head?: [number, number];
  /** The whetstone in the off hand, and a shower of sparks off the edge 0..1. */
  stone?: number;
  /** 0..1: dissolved into shade (Death's step), and how far its wisps have drifted. */
  fade?: number;
  scatter?: number;
}

const rad = (d: number) => (d * Math.PI) / 180;

// ---------------------------------------------------------------------------
// The scythe

/** Where the scythe's ends are for a hold. */
function ends(s: Scythe): { ux: number; uy: number; hx: number; hy: number; bx: number; by: number; nx: number; ny: number } {
  const ux = Math.cos(rad(s.a));
  const uy = Math.sin(rad(s.a));
  // The blade's way out from the snath: the snath's way turned a right angle to its side.
  const nx = -uy * s.side;
  const ny = ux * s.side;
  return { ux, uy, hx: s.gx + ux * s.up, hy: s.gy + uy * s.up, bx: s.gx - ux * s.down, by: s.gy - uy * s.down, nx, ny };
}

/** A point along the blade, 0 at its heel, 1 at the tip: out from the snath and curling back towards the hands. */
function bladeAt(s: Scythe, k: number): [number, number] {
  const e = ends(s);
  const L = 11 * s.reach;
  return [e.hx + e.nx * L * k - e.ux * L * 0.42 * k * k, e.hy + e.ny * L * k - e.uy * L * 0.42 * k * k];
}

/** The blade tip's path round the grip during a swing: soul-light left in the air from `from` to the scythe's angle now. */
function smear(c: PixelCanvas, s: Scythe): void {
  if (s.smear === undefined) return;
  const [core, hot, mid, deep] = S.light;
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const a = s.smear + (s.a - s.smear) * k;
    const q: Scythe = { ...s, a };
    // The tip's path, and the edge's a little way in: a crescent thickening towards the blade.
    for (const along of [1, 0.8, 0.6]) {
      const [x, y] = bladeAt(q, along);
      const col = k > 0.75 ? core : k > 0.45 ? hot : k > 0.2 ? mid : deep;
      c.spark(x, y, col, (0.25 + 0.55 * k) * (along === 1 ? 1 : 0.6));
    }
  }
}

/**
 * The scythe: the snath from butt to head with a grip peg on it, an iron ring
 * at the head, and the blade curving off it, its inner edge honed bright.
 * The Catrina's is black lacquer ringed in gold, wound with a marigold
 * garland, a ribbon at the head and a silver blade.
 */
function drawScythe(c: PixelCanvas, s: Scythe): void {
  const e = ends(s);
  const cat = S.catrina;
  c.part();
  // The snath, bowing a touch along its length.
  const len = s.up + s.down;
  const n = Math.ceil(len * 1.4);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const bow = Math.sin(t * Math.PI) * 0.6;
    const x = e.bx + (e.hx - e.bx) * t - e.nx * bow;
    const y = e.by + (e.hy - e.by) * t - e.ny * bow;
    // Lit along the side facing the light (up-left), as a round pole.
    const lit = -e.nx * 0.5 - e.ny * 0.5;
    c.px(x, y, S.snath, cyl(lit * 0.6, 0.1), { bias: t > 0.92 ? -1 : 0 });
  }
  // The grip peg, standing off the snath on the blade's side.
  c.part();
  const px = s.gx - e.ux * 2.5;
  const py = s.gy - e.uy * 2.5;
  c.line(px, py, px + e.nx * 2, py + e.ny * 2, S.snath, () => sphere(0, -0.3));
  if (cat) {
    // A marigold garland winding round the lacquer, and gold rings.
    c.part();
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      const w = (i % 2 ? 1 : -1) * 0.9;
      const x = e.bx + (e.hx - e.bx) * t + e.nx * w;
      const y = e.by + (e.hy - e.by) * t + e.ny * w;
      c.px(x, y, i % 3 === 0 ? MARI_DEEP : MARIGOLD, sphere(-0.3, -0.3));
    }
    for (const t of [0.04, 0.97]) c.px(e.bx + (e.hx - e.bx) * t, e.by + (e.hy - e.by) * t, GOLD, sphere(0, -0.4));
  } else {
    // Iron bands at the butt and under the grip.
    c.part();
    c.px(e.bx + e.ux * 0.5, e.by + e.uy * 0.5, IRON, sphere(0, -0.4));
    c.px(s.gx - e.ux * 5, s.gy - e.uy * 5, IRON, sphere(0, -0.4));
  }
  // The blade: a spine tapering from the heel to the point, its inner edge bright.
  c.part();
  const steps = Math.max(8, Math.ceil(11 * s.reach * 1.6));
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const [x, y] = bladeAt(s, k);
    const w = 1.25 * (1 - k) + 0.35;
    c.ellipse(x, y, w, w, S.steel, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.7 - 0.2, 1) });
  }
  c.part();
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const [x, y] = bladeAt(s, k);
    const [x2, y2] = bladeAt(s, Math.min(1, k + 0.05));
    // The edge lies on the blade's inner, hollow side: towards the hands.
    let ix = -(y2 - y);
    let iy = x2 - x;
    if (ix * -e.ux + iy * -e.uy < 0) {
      ix = -ix;
      iy = -iy;
    }
    const l = Math.hypot(ix, iy) || 1;
    const w = 1.25 * (1 - k) + 0.35;
    const ex = x + (ix / l) * (w + 0.2);
    const ey = y + (iy / l) * (w + 0.2);
    c.px(ex, ey, S.edge, sphere(0, -0.5), { glow: (S.edge.emissive ?? 0) + s.glow * 0.6 });
    if (s.glow > 0) c.spark(ex, ey, S.light[k > 0.8 ? 0 : 1], 0.25 * s.glow);
  }
  // The ring binding the blade to the snath; the Catrina's ribbon flying from it.
  c.part();
  c.ellipse(e.hx, e.hy, 1.1, 1.1, cat ? GOLD : IRON);
  if (cat) {
    c.part();
    for (let i = 1; i <= 4; i++) c.px(e.hx - e.ux * (i * 0.5) - e.nx * (i * 0.9), e.hy - e.uy * (i * 0.5) - e.ny * (i * 0.9) + (i > 2 ? 1 : 0), MAGENTA, sphere(0, -0.2), { bias: i % 2 });
    c.px(e.hx + e.nx * 0.5 - e.ux, e.hy + e.ny * 0.5 - e.uy, MARIGOLD, sphere(0, -0.5));
  }
}

// ---------------------------------------------------------------------------
// The body (body-box coordinates: 24 wide, the ground at y 31)

const hash = (x: number, y: number): number => {
  const h = Math.imul(Math.round(x) * 374761393 + Math.round(y) * 668265263, 1274126177) >>> 0;
  return (((h ^ (h >>> 13)) >>> 0) % 1000) / 1000;
};

/** A sleeve from the shoulder to the hand: wide and ragged at the cuff (ruffled marigold for the Catrina), a bony hand. */
function arm(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number, flutter: number, bias = 0): void {
  const dx = hx - sx;
  const dy = hy - sy;
  const d = Math.hypot(dx, dy) || 1;
  // The sleeve stops short of the hand.
  const k = Math.max(0, (d - 1.6) / d);
  const wx = sx + dx * k;
  const wy = sy + dy * k;
  c.part();
  c.capsule(sx, sy, wx, wy, 1.5, 1.9, S.robe, { bias });
  c.part();
  // Rags (or a ruffle) hanging from the cuff.
  for (let i = -1; i <= 1; i++) {
    const tx = Math.round(wx + i * 1.2);
    const ty = Math.round(wy + 1.6 + ((i + Math.round(flutter)) & 1));
    if (S.catrina) c.px(tx, ty - 1, i === 0 ? MAGENTA : MARIGOLD, sphere(i * 0.4, 0.2), { bias });
    else if (i !== 0 || (Math.round(flutter) & 1)) c.px(tx, ty, S.rag, sphere(0, 0.3), { bias });
  }
  c.part();
  c.ellipse(hx, hy, 1.05, 1.05, S.catrina ? BONE : S.skin, { bias });
  c.px(hx + (dx / d) * 0.8, hy + (dy / d) * 0.8, S.catrina ? BONE : S.skin, sphere(dx / d, -0.2), { bias: bias + 1 });
}

/** The hem: tattered strips that flutter (or the Catrina's marigold ruffle, scalloped). */
function hem(c: PixelCanvas, l: number, r: number, y: number, p: ReaperPose, view: View): void {
  c.part();
  for (let x = Math.round(l); x < r; x++) {
    if (S.catrina) {
      // A ruffle of marigold under a band of magenta, scalloped every other pixel.
      if (c.filled(x, y)) c.px(x, y, MAGENTA, sphere(0, 0.3), { bias: x & 1 ? 0 : -1 });
      c.px(x, y + 1, MARIGOLD, sphere(0, 0.4), { bias: (x + Math.round(p.flutter)) & 1 ? 1 : -1 });
      if ((x + Math.round(p.flutter)) % 2 === 0) c.px(x, y + 2, MARI_DEEP, sphere(0, 0.5));
      continue;
    }
    const n = 1 + Math.floor(hash(x, 7) * 2.4) + ((x + Math.round(p.flutter)) % 3 === 0 ? 1 : 0);
    for (let i = 1; i <= n; i++) {
      const drift = view === 'side' ? Math.round((i / n) * (0.6 + Math.abs(p.sway) * 0.4)) : Math.round(Math.sin(x * 0.9 + p.flutter) * (i / n) * 0.8);
      if (i === n && hash(x, i + 3) > 0.6) continue;
      c.px(x + drift, y + i, i === n ? S.rag : S.robe, sphere(0, -0.2), { bias: i === n ? 0 : -1 });
    }
  }
}

/** A bony foot peeking out under the hem. */
function foot(c: PixelCanvas, x: number, y: number, side: boolean): void {
  c.part();
  const m = S.catrina ? INK : BONE;
  if (side) {
    c.px(x - 1, y, m, sphere(-0.4, -0.5));
    c.px(x, y, m, sphere(0.2, -0.5));
    c.px(x + 1, y, m, sphere(0.6, -0.3), { bias: -1 });
  } else {
    c.px(x, y, m, sphere(-0.3, -0.5));
    c.px(x + 1, y, m, sphere(0.4, -0.5), { bias: -1 });
  }
}

/** The robe: narrow, gaunt shoulders falling to a wide hem; folds, a rope belt (a magenta sash), the hourglass. */
function robe(c: PixelCanvas, cx: number, top: number, bottom: number, p: ReaperPose, view: View): (y: number) => [number, number] {
  const side = view === 'side';
  const edge = (y: number): [number, number] => {
    const u = Math.max(0, (y - top) / (bottom - top));
    const hw = (side ? 3.0 : 3.6) + Math.pow(u, 1.6) * (side ? 2.3 : 2.7);
    const sw = u * u * p.sway;
    const back = side ? u * u * 1.2 : 0;
    return [cx - hw + sw, cx + hw + sw + back];
  };
  c.part();
  c.shape(Math.round(top), Math.round(bottom), edge, S.robe, (_x, y, t) => sphere(t * 0.9, 0.35 - ((y - top) / (bottom - top)) * 0.6, 1));
  // Long folds falling to the hem.
  for (let y = Math.round(top + 4); y <= bottom; y++) {
    const u = (y - top) / (bottom - top);
    const sw = u * u * p.sway;
    c.shade(Math.round(cx - 1.8 - u * 1.4 + sw), y, -1);
    if (!side) c.shade(Math.round(cx + 1.8 + u * 1.4 + sw), y, -1);
    else c.shade(Math.round(cx + 0.5 + u + sw), y, -1);
  }
  if (S.catrina && view !== 'up') {
    // The gown's magenta panel, opening down the front from the sash, edged in marigold.
    const waist = top + 6;
    c.part();
    for (let y = Math.round(waist + 1); y <= bottom; y++) {
      const u = (y - waist) / (bottom - waist);
      const sw = u * u * p.sway;
      const w = 0.6 + u * 1.9;
      const x0 = (side ? cx - 2.2 - u * 1.5 : cx - w) + sw;
      const x1 = (side ? cx - 2.2 - u * 1.5 + 1.2 + u : cx + w) + sw;
      for (let x = Math.round(x0); x < Math.round(x1); x++) if (c.filled(x, y)) c.px(x, y, MAGENTA, sphere(((x + 0.5 - x0) / Math.max(1, x1 - x0)) * 1.2 - 0.6, 0.15), { bias: (x + y) % 5 === 0 ? 1 : 0 });
      if (!side && c.filled(Math.round(x0) - 1, y)) c.px(Math.round(x0) - 1, y, MARIGOLD, sphere(-0.3, 0), { bias: -1 });
      if (c.filled(Math.round(x1), y)) c.px(Math.round(x1), y, MARIGOLD, sphere(0.3, 0), { bias: -1 });
    }
  }
  const [l, r] = edge(bottom);
  hem(c, l, r, Math.round(bottom), p, view);
  return edge;
}

/** The belt: a knotted rope with the hourglass hanging from it (or a magenta sash knotted with a marigold). */
function belt(c: PixelCanvas, cx: number, y: number, edge: (y: number) => [number, number], view: View): void {
  const [l, r] = edge(y);
  c.part();
  for (let x = Math.round(l); x < r; x++) if (c.filled(x, y)) c.px(x, y, S.catrina ? MAGENTA : ROPE, cyl(((x + 0.5 - l) / (r - l)) * 2 - 1, 0), { bias: S.catrina ? 0 : (x & 1) - 1 });
  if (view === 'up') return;
  const side = view === 'side';
  const kx = side ? l + 1 : cx - 2.5;
  c.part();
  if (S.catrina) {
    // The sash's knot, a marigold tucked in it, and its tails.
    c.ellipse(kx, y + 0.3, 1.2, 1.1, MARIGOLD);
    c.px(kx - 0.5, y, MARI_DEEP);
    c.px(kx - 1, y + 2, MAGENTA, sphere(-0.3, 0.3));
    c.px(kx, y + 3, MAGENTA, sphere(0, 0.4));
    return;
  }
  // The rope's knot and its hanging ends.
  c.px(kx, y, ROPE, sphere(0, -0.3), { bias: 1 });
  c.px(kx, y + 1, ROPE, sphere(0, 0.3));
  c.px(kx + 1, y + 2, ROPE, sphere(0, 0.3), { bias: -1 });
  // The hourglass, on a cord at the hip: brass ends, sand running.
  if (side) return;
  const hx = cx + 2.6;
  const hy = y + 2;
  c.part();
  c.line(hx, y + 0.5, hx, hy - 0.5, ROPE);
  c.part();
  c.px(hx, hy, BRASS, sphere(-0.3, -0.5));
  c.px(hx + 1, hy, BRASS, sphere(0.4, -0.5));
  c.px(hx, hy + 1, SAND, sphere(-0.2, 0));
  c.px(hx + 1, hy + 1, S.robe, sphere(0.3, 0), { bias: 2 });
  c.px(hx, hy + 2, BRASS, sphere(-0.3, 0.4));
  c.px(hx + 1, hy + 2, BRASS, sphere(0.4, 0.4));
}

/** The mantle: a ragged capelet over the shoulders, its edge torn in points (the Catrina's a black lace shawl). */
function mantle(c: PixelCanvas, cx: number, top: number, view: View, p: ReaperPose): void {
  const side = view === 'side';
  const hw = side ? 4.2 : 5.3;
  const ox = side ? 0.6 : 0;
  c.part();
  c.shape(Math.round(top), Math.round(top + 4), (y) => {
    const u = (y - top) / 4;
    const w = hw * (0.55 + 0.45 * Math.sqrt(u));
    return [cx + ox - w, cx + ox + w];
  }, S.catrina ? LACE : S.robe, (_x, _y, t, u) => sphere(t * 0.95, u - 0.6, 1));
  // Its torn edge: points hanging down at different lengths.
  const y0 = Math.round(top + 5);
  for (let x = Math.round(cx + ox - hw); x < cx + ox + hw; x++) {
    const n = S.catrina ? 1 + ((x + 1) & 1) : Math.floor(hash(x, 31) * 3);
    for (let i = 0; i < n; i++) {
      const fl = i === n - 1 ? Math.round(Math.sin(x + p.flutter) * 0.5) : 0;
      if (S.catrina) {
        // Lace: a scalloped edge with holes, a marigold bead at each point.
        if (i === n - 1 && n === 2) c.px(x, y0 + i, (x >> 1) % 3 === 0 ? MARIGOLD : LACE, sphere(0, 0.3));
        else if ((x + i) % 2 === 0) c.px(x, y0 + i, LACE, sphere(0, 0.2));
      } else c.px(x + fl, y0 + i, i === n - 1 ? S.rag : S.robe, sphere(0, 0.3), { bias: -1 });
    }
  }
  if (S.catrina) {
    // Lace holes over the shawl.
    for (let y = Math.round(top + 2); y <= top + 4; y++) for (let x = Math.round(cx + ox - hw); x < cx + ox + hw; x++) if ((x + y * 2) % 4 === 0 && c.materialAt(x, y) === LACE) c.shade(x, y, 2);
  }
}

/** Two eye-lights in the sockets, a soft glow round each when they blaze. */
function eyeLights(c: PixelCanvas, pts: [number, number][], k: number): void {
  for (const [x, y] of pts) {
    c.px(x, y, S.eye, { x: 0, y: 0, z: 1 }, { glow: 0.6 + 0.4 * k, bias: k > 0.6 ? 1 : 0 });
    c.spark(x, y, S.light[1], 0.25 + 0.45 * k);
    if (k > 0.5) for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) c.spark(x + dx, y + dy, S.light[2], (k - 0.5) * 0.6);
  }
}

/** The hood seen from the front: deep, the skull in its shadow. */
function headDown(c: PixelCanvas, cx: number, cy: number, p: ReaperPose): void {
  c.part();
  c.ellipse(cx, cy, 4.5, 4.6, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.25, 1) });
  // The hood's point, falling back behind the crown.
  c.capsule(cx + 0.5, cy - 3.2, cx + 1.8, cy - 5.6, 1.6, 0.5, S.robe);
  c.part();
  c.ellipse(cx, cy + 1.1, 3.2, 3.5, HOOD_DARK);
  // The skull, set back in the dark: cheekbones, sockets, the nose's hollow, teeth.
  c.part();
  c.ellipse(cx, cy + 1.4, 2.9, 2.7, S.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7 + 0.1, 1) });
  c.shape(Math.round(cy + 3.5), Math.round(cy + 4.4), () => [cx - 1.6, cx + 1.6], S.skin, (_x, _y, t) => sphere(t * 0.7, 0.6, 1));
  const top = Math.round(cy - 1.3);
  for (let x = Math.round(cx - 3); x <= cx + 2; x++) {
    c.shade(x, top, -2);
    c.shade(x, top + 1, -1);
  }
  const ey = Math.round(cy + 1);
  for (const ex of [Math.round(cx - 2), Math.round(cx + 1)]) {
    c.px(ex, ey, SOCKET);
    c.px(ex, ey + 1, SOCKET, FLAT_N, { bias: 1 });
  }
  c.px(Math.round(cx - 1), ey + 2, SOCKET);
  c.px(Math.round(cx), ey + 2, SOCKET, FLAT_N, { bias: 1 });
  for (let x = Math.round(cx - 2); x <= cx + 1; x++) if (x & 1) c.px(x, ey + 3, SOCKET, FLAT_N, { bias: 1 });
  eyeLights(c, [[Math.round(cx - 2), ey], [Math.round(cx + 1), ey]], p.eyes);
  // The hood's rim catching a little light round the opening.
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * 0.08 + (i / 10) * Math.PI * 0.84;
    c.shade(Math.round(cx - 0.5 - Math.cos(a) * 3.4), Math.round(cy + 1.1 - Math.sin(a) * 3.7), 1);
  }
}

const FLAT_N = { x: 0, y: 0, z: 1 };

/** The hood from behind: its point hanging down the back like a tail. */
function headUp(c: PixelCanvas, cx: number, cy: number): void {
  c.part();
  c.ellipse(cx, cy, 4.5, 4.6, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 1) });
  c.part();
  c.capsule(cx, cy + 1, cx + 0.6, cy + 7.5, 1.9, 0.6, S.robe);
  c.px(Math.round(cx + 0.6), Math.round(cy + 8.4), S.rag, sphere(0, 0.4));
  // A seam down the hood.
  for (let y = Math.round(cy - 3); y <= cy + 6; y++) c.shade(Math.round(cx), y, -1);
}

/** The hood in profile, facing left: the skull's jaw and brow just out of the dark, the point flopping back. */
function headSide(c: PixelCanvas, cx: number, cy: number, p: ReaperPose): void {
  c.part();
  c.ellipse(cx + 0.6, cy, 4.0, 4.6, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.25, 1) });
  c.capsule(cx + 2, cy - 3, cx + 4.6, cy - 1, 1.6, 0.5, S.robe);
  c.part();
  c.ellipse(cx - 1.7, cy + 1.1, 2.2, 3.4, HOOD_DARK);
  c.part();
  c.ellipse(cx - 1.6, cy + 1.5, 2.0, 2.6, S.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 - 0.3, dy * 0.7 + 0.1, 1) });
  // The jaw jutting forward under the cheekbone.
  c.shape(Math.round(cy + 3.4), Math.round(cy + 4.2), () => [cx - 3.6, cx - 0.6], S.skin, (_x, _y, t) => sphere(t * 0.5 - 0.3, 0.6, 1));
  for (let y = Math.round(cy - 1.2); y <= cy - 0.2; y++) for (let x = Math.round(cx - 3.5); x <= cx; x++) c.shade(x, y, -2);
  const ey = Math.round(cy + 1);
  const ex = Math.round(cx - 3);
  c.px(ex, ey, SOCKET);
  c.px(ex, ey + 1, SOCKET, FLAT_N, { bias: 1 });
  c.px(ex - 1, ey + 2, SOCKET);
  c.px(ex, ey + 3, SOCKET, FLAT_N, { bias: 1 });
  c.px(ex + 2, ey + 3, SOCKET, FLAT_N, { bias: 1 });
  eyeLights(c, [[ex, ey]], p.eyes);
}

// --- The Catrina's head --------------------------------------------------------

/** A marigold bloom: a ruffled orange ball, deeper at its heart. */
function marigold(c: PixelCanvas, x: number, y: number, r = 1.2): void {
  c.part();
  c.ellipse(x, y, r, r * 0.9, MARIGOLD);
  c.px(Math.round(x - 0.5), Math.round(y - 0.5), MARI_DEEP, FLAT_N);
  c.shade(Math.round(x - 1), Math.round(y - 1), 1);
}

/** The painted sugar skull, facing the viewer: petal-ringed eyes, a heart for a nose, a stitched smile, a flower on the brow. */
function sugarFace(c: PixelCanvas, cx: number, cy: number, p: ReaperPose, side: boolean): void {
  c.part();
  if (side) {
    c.ellipse(cx - 1.2, cy + 1.2, 2.4, 2.8, SUGAR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 - 0.3, dy * 0.7, 1) });
    c.shape(Math.round(cy + 3.4), Math.round(cy + 4.2), () => [cx - 3.3, cx - 0.4], SUGAR, (_x, _y, t) => sphere(t * 0.5 - 0.3, 0.6, 1));
    const ex = Math.round(cx - 3);
    const ey = Math.round(cy + 1);
    c.px(ex, ey, INK);
    c.px(ex, ey + 1, INK, FLAT_N, { bias: 1 });
    c.px(ex + 1, ey - 1, PAINT_PINK, FLAT_N);
    c.px(ex + 1, ey + 1, PAINT_TEAL, FLAT_N);
    c.px(ex - 1, ey + 2, PAINT_PINK, FLAT_N);
    for (let x = ex - 1; x <= ex + 2; x++) c.px(x, ey + 3, INK, FLAT_N, { bias: x & 1 });
    eyeLights(c, [[ex, ey]], p.eyes);
    return;
  }
  c.ellipse(cx, cy + 1.2, 3.0, 2.9, SUGAR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7 + 0.1, 1) });
  c.shape(Math.round(cy + 3.6), Math.round(cy + 4.4), () => [cx - 1.7, cx + 1.7], SUGAR, (_x, _y, t) => sphere(t * 0.7, 0.6, 1));
  c.part();
  const ey = Math.round(cy + 1);
  for (const [ex, s] of [[Math.round(cx - 2), -1], [Math.round(cx + 1), 1]] as const) {
    c.px(ex, ey, INK);
    c.px(ex, ey + 1, INK, FLAT_N, { bias: 1 });
    // Petals painted round each socket: pink above and outside, teal below.
    c.px(ex + s, ey, PAINT_PINK, FLAT_N);
    c.px(ex + s, ey - 1, PAINT_PINK, FLAT_N, { bias: 1 });
    c.px(ex, ey - 1, PAINT_TEAL, FLAT_N);
    c.px(ex + s, ey + 1, PAINT_TEAL, FLAT_N);
  }
  // A heart for a nose, and the stitched smile.
  c.px(Math.round(cx - 1), ey + 2, PAINT_PINK, FLAT_N, { bias: -1 });
  c.px(Math.round(cx), ey + 2, PAINT_PINK, FLAT_N, { bias: -1 });
  for (let x = Math.round(cx - 2); x <= cx + 1; x++) c.px(x, ey + 3, INK, FLAT_N, { bias: x & 1 });
  eyeLights(c, [[Math.round(cx - 2), ey], [Math.round(cx + 1), ey]], p.eyes);
}

/** Long black hair falling from under the hat to the shoulders. */
function hair(c: PixelCanvas, cx: number, cy: number, view: View): void {
  c.part();
  if (view === 'up') {
    c.shape(Math.round(cy - 1), Math.round(cy + 6), (y) => [cx - 3.4 + (y - cy) * 0.1, cx + 3.4 - (y - cy) * 0.1], HAIR, (_x, _y, t) => sphere(t * 0.8, -0.2, 1));
    return;
  }
  if (view === 'side') {
    c.capsule(cx + 1.4, cy - 1, cx + 2.4, cy + 5.5, 2.0, 1.2, HAIR);
    return;
  }
  for (const s of [-1, 1]) c.capsule(cx + s * 3.1, cy - 0.5, cx + s * 3.5, cy + 5.2, 1.3, 0.9, HAIR);
}

/** The wide-brimmed hat: a black felt crown banded in magenta, marigolds massed on the brim, a pink plume curling up. */
function hat(c: PixelCanvas, cx: number, cy: number, view: View): void {
  const side = view === 'side';
  const by = cy - 2.6;
  // The brim: a broad flat ellipse, seen from above a little, so its top shows.
  c.part();
  c.ellipse(cx + (side ? 0.4 : 0), by, side ? 6.6 : 7.2, side ? 1.3 : 2.2, HAT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.5, -0.6 + dy * 0.3, 1) });
  // The crown on it.
  c.part();
  c.shape(Math.round(by - 4), Math.round(by), (y) => {
    const u = (y - (by - 4)) / 4;
    const w = 2.6 + u * 0.6;
    return [cx + (side ? 0.8 : 0) - w, cx + (side ? 0.8 : 0) + w];
  }, HAT, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.4, 1));
  c.part();
  for (let x = Math.round(cx + (side ? 0.8 : 0) - 3.2); x < cx + (side ? 0.8 : 0) + 3.2; x++) if (c.filled(x, Math.round(by - 1))) c.px(x, Math.round(by - 1), MAGENTA, cyl((x - cx) / 3.2, 0));
  // Marigolds massed on one side of the brim, and the plume springing from them.
  if (view === 'up') {
    marigold(c, cx + 3.4, by - 0.6);
    marigold(c, cx + 5, by + 0.2, 1);
  } else if (side) {
    marigold(c, cx + 3.6, by - 0.8);
    marigold(c, cx + 2.2, by - 1.3, 1);
  } else {
    marigold(c, cx - 3.6, by - 0.8);
    marigold(c, cx - 5.2, by + 0.1, 1);
    marigold(c, cx - 2.3, by - 1.4, 1);
  }
  c.part();
  const px = side ? cx + 4 : view === 'up' ? cx + 4 : cx - 4;
  const dir = side || view === 'up' ? 1 : -1;
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    c.px(px + dir * (t * 3.2 + Math.sin(t * 3) * 0.6), by - 2 - t * 4.2 + t * t * 1.4, PLUME, sphere(dir * 0.4, -0.4), { bias: i > 3 ? 1 : 0 });
  }
}

function headCatrina(c: PixelCanvas, cx: number, cy: number, view: View, p: ReaperPose): void {
  hair(c, cx, cy, view);
  if (view === 'up') {
    hat(c, cx, cy, view);
    return;
  }
  sugarFace(c, cx + (view === 'side' ? 0.2 : 0), cy, p, view === 'side');
  hat(c, cx, cy, view);
}

// ---------------------------------------------------------------------------
// The whole figure

/** Where the off hand holds the snath, if it does. */
function offGrip(s: Scythe): [number, number] | null {
  if (s.off === null) return null;
  const e = ends(s);
  return [s.gx - e.ux * s.off, s.gy - e.uy * s.off];
}

/** The whetstone in the off hand, drawn along the edge with sparks flying. */
function whetstone(c: PixelCanvas, x: number, y: number, k: number): void {
  c.part();
  c.capsule(x - 1.2, y - 0.4, x + 1.2, y - 0.4, 0.8, 0.8, WHETSTONE);
  if (k <= 0) return;
  const [core, hot, mid] = S.light;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * (0.2 + hash(i, Math.round(x * 3)) * 0.6);
    const d = 1.5 + i * 0.9 * k;
    c.spark(x + Math.cos(a) * d - 1, y + Math.sin(a) * d * 0.8 - 1, i < 2 ? core : i < 4 ? hot : mid, 0.9 - i * 0.12);
  }
}

function drawFigure(c: PixelCanvas, p: ReaperPose, view: View): void {
  const side = view === 'side';
  const U = -p.bob;
  const cx = 12 - (side ? p.lean * 0.5 : 0);
  const top = 13.6 + U + (side ? 0 : p.lean * 0.5);
  const bottom = 28.4 - p.bob * 0.4;
  const headX = cx + (side ? -p.lean : 0) + (p.head?.[0] ?? 0);
  const headY = 9.2 + U + (side ? p.lean * 0.3 : p.lean) + (p.head?.[1] ?? 0);
  const s = p.sc;
  const lead: [number, number] = [s.gx, s.gy];
  const off = offGrip(s) ?? p.hand2;
  // Shoulders: the lead hand takes the nearer one.
  let sh: [number, number][];
  if (side) sh = [[cx - 0.6 - p.lean * 0.6, top + 1.4], [cx + 1.6 - p.lean * 0.6, top + 1]];
  else sh = [[cx - 4.2, top + 1.6], [cx + 4.2, top + 1.6]];
  const near = (h: [number, number]) => (Math.hypot(h[0] - sh[0][0], h[1] - sh[0][1]) <= Math.hypot(h[0] - sh[1][0], h[1] - sh[1][1]) ? 0 : 1);
  let li = near(lead);
  let oi = 1 - li;
  if (side) {
    // From the side the near arm (screen front) leads, and the far one reaches past the body.
    li = 0;
    oi = 1;
  }
  const backView = view === 'up';
  // A scythe held behind takes its lead hand with it; in the back view a hand near the body is hidden by it too.
  const leadBehind = s.behind;
  const offBehind = side ? true : backView ? off[1] > top - 2 && Math.abs(off[0] - cx) < 5 : false;

  if (s.behind) {
    smear(c, s);
    drawScythe(c, s);
    arm(c, sh[li][0], sh[li][1], lead[0], lead[1], p.flutter, -1);
  }
  if (offBehind || (s.behind && s.off !== null)) arm(c, sh[oi][0], sh[oi][1], off[0], off[1], p.flutter, -1);

  // Feet under the hem.
  if (side) {
    foot(c, Math.round(cx - 1 - p.footA), 31, true);
    foot(c, Math.round(cx + 1 - p.footB), 31, true);
  } else if (!backView) {
    foot(c, 9, Math.round(30.6 - p.footA), false);
    foot(c, 13, Math.round(30.6 - p.footB), false);
  }

  const edge = robe(c, cx, top, bottom, p, view);
  belt(c, cx, Math.round(top + 6.4), edge, view);
  if (backView) {
    if (S.catrina) headCatrina(c, headX, headY, view, p);
    else headUp(c, headX, headY);
    mantle(c, cx, top - 1, view, p);
  } else {
    mantle(c, cx, top - 1, view, p);
    if (S.catrina) headCatrina(c, headX, headY, view, p);
    else if (side) headSide(c, headX, headY, p);
    else headDown(c, headX, headY, p);
  }
  if (!s.behind) {
    if (!offBehind && s.off === null) arm(c, sh[oi][0], sh[oi][1], off[0], off[1], p.flutter);
    smear(c, s);
    drawScythe(c, s);
    if (!offBehind && s.off !== null) arm(c, sh[oi][0], sh[oi][1], off[0], off[1], p.flutter);
    if (!leadBehind) arm(c, sh[li][0], sh[li][1], lead[0], lead[1], p.flutter);
  } else if (!offBehind && s.off === null) arm(c, sh[oi][0], sh[oi][1], off[0], off[1], p.flutter);
  if (p.stone !== undefined) whetstone(c, off[0] - 0.5, off[1] - 1.2, p.stone);
  if ((p.fade ?? 0) > 0) dissolve(c, cx, headX, headY, p, view);
}

/**
 * Death's step: the body comes apart into shade from the hem up (into
 * marigold petals and rose flame for the Catrina), until only the eyes hang
 * in the air; drawn backwards it gathers again.
 */
function dissolve(c: PixelCanvas, cx: number, hx: number, hy: number, p: ReaperPose, view: View): void {
  const fade = p.fade ?? 0;
  const scatter = p.scatter ?? 0;
  const y0 = -14;
  const y1 = 34;
  for (let y = y0; y <= y1; y++) {
    const v = (y - y0) / (y1 - y0);
    for (let x = -16; x <= 40; x++) {
      if (!c.filled(x, y)) continue;
      if (hash(x, y) + (1 - v) * 0.5 < fade * 1.5) c.erase(x, y);
    }
  }
  c.part();
  const [core, hot, mid, deep] = S.light;
  for (let i = 0; i < 22; i++) {
    const r = hash(i, 91);
    if (r > fade * 1.3 || (fade > 0.9 && r > 1.2 - scatter * 0.6)) continue;
    const ox = cx - 6 + hash(i, 7) * 12;
    const oy = 6 + hash(i, 13) * 22;
    const x = Math.round(ox + (ox - cx) * 0.7 * scatter + (view === 'side' ? 4 * scatter : 0));
    const y = Math.round(oy - (2 + hash(i, 29) * 5) * scatter);
    if (S.catrina) {
      c.px(x, y, i % 3 === 0 ? MAGENTA : MARIGOLD, { x: 0, y: 0.3, z: 0.9 }, { glow: 0.3 });
      c.spark(x, y, i % 2 ? hot : mid, 0.3);
    } else if (i % 3 === 0) {
      c.spark(x, y, i % 2 ? hot : mid, 0.4);
    } else {
      // Shreds of shade, a lit wisp at their heart now and then.
      c.px(x, y, S.robe, { x: 0, y: -0.3, z: 0.9 }, { bias: 1 });
      if (scatter > 0.3) c.px(x, y + 1, S.robe, FLAT_N, { bias: -1 });
      c.spark(x, y, deep, 0.25);
    }
  }
  if (fade < 0.85) return;
  // The eyes stay, cold, the last to go and the first back.
  c.part();
  const eyes: [number, number][] = view === 'side' ? [[Math.round(hx - 3), Math.round(hy + 1)]] : view === 'up' ? [] : [[Math.round(hx - 2), Math.round(hy + 1)], [Math.round(hx + 1), Math.round(hy + 1)]];
  for (const [x, y] of eyes) {
    c.px(x, y, S.eye, FLAT_N, { glow: 1, bias: 2 });
    c.spark(x, y, core, 0.6);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + dx, y + dy, hot, 0.35);
  }
}

// ---------------------------------------------------------------------------
// Poses

/** The way each view faces, in screen degrees (the side view faces left). */
const FACE: Record<View, number> = { down: 90, up: -90, side: 180 };

/** The chest, round which the scythe swings. */
const pivot = (view: View, bob = 0): [number, number] => (view === 'side' ? [11, 16.5 - bob] : [12, 16.8 - bob]);

/** The scythe held out from the chest at angle `a`: the grip a little way out, the off hand behind it on the snath. */
function swung(view: View, a: number, side: number, o: Partial<Scythe> = {}, bob = 0): Scythe {
  const [px, py] = pivot(view, bob);
  const ux = Math.cos(rad(a));
  const uy = Math.sin(rad(a));
  // Pointing at or away from the eye, the blade is seen foreshortened.
  const toward = view === 'side' ? 0 : Math.abs(Math.sin(rad(a))) * 0.2;
  return {
    gx: px + ux * 3.4,
    gy: py + uy * 2.4,
    a,
    up: 12,
    down: 6,
    side,
    reach: 1 - toward,
    // Whatever is north of him is farther from the eye.
    behind: uy < -0.25,
    glow: 0,
    off: 4.2,
    ...o,
  };
}

/** Standing with the scythe upright beside him, the blade over his head. */
function held(view: View, bob: number, tilt = 0): Scythe {
  if (view === 'side') return { gx: 7.4, gy: 17.6 - bob, a: -96 + tilt, up: 16, down: 12, side: -1, reach: 1, behind: false, glow: 0, off: null };
  if (view === 'up') return { gx: 5, gy: 17.4 - bob, a: -90 + tilt, up: 18, down: 12, side: 1, reach: 0.95, behind: true, glow: 0, off: null };
  return { gx: 18.6, gy: 17.4 - bob, a: -90 - tilt, up: 18, down: 12, side: -1, reach: 0.95, behind: false, glow: 0, off: null };
}

/** The free hand hanging at his side. */
const hang = (view: View, bob: number, swing = 0): [number, number] => (view === 'side' ? [12.6 + swing, 20.6 - bob] : view === 'up' ? [17.6, 20.6 - bob] : [6.2, 20.8 - bob]);

const pose = (o: Partial<ReaperPose> & { sc: Scythe; hand2: [number, number] }): ReaperPose => ({ bob: 0, lean: 0, sway: 0, flutter: 0, footA: 0, footB: 0, eyes: 0.3, ...o });

function idle(view: View): ReaperPose[] {
  return [0, 1, 2, 3].map((i) => {
    const bob = [0, 0, 1, 0][i] * 0.5 + [0, 0.5, 0.5, 0][i];
    return pose({ bob: Math.round(bob), sc: held(view, Math.round(bob), [0, 1, 2, 1][i] * 0.7), hand2: hang(view, Math.round(bob)), flutter: i, sway: [0, 0.3, 0, -0.3][i], eyes: [0.3, 0.45, 0.6, 0.45][i] });
  });
}

function walk(view: View): ReaperPose[] {
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const ph = (i / 6) * Math.PI * 2;
    const bob = [0, 1, 1, 0, 1, 1][i];
    const side = view === 'side';
    const a = side ? Math.sin(ph) * 2.2 : Math.max(0, Math.sin(ph)) * 1.4;
    const b = side ? -Math.sin(ph) * 2.2 : Math.max(0, -Math.sin(ph)) * 1.4;
    return pose({
      bob,
      lean: side ? 1 : 0,
      footA: a,
      footB: b,
      sway: (side ? 0.8 : 0) + Math.sin(ph) * 0.8,
      flutter: i * 1.5,
      sc: { ...held(view, bob, Math.sin(ph) * 4 + (side ? -10 : 0)), gx: held(view, bob).gx + (side ? -1 : 0) },
      hand2: hang(view, bob, -Math.sin(ph) * 1.2),
      eyes: 0.35,
    });
  });
}

/**
 * A sweep: wound up, round through the front, and out the far side. `rel` is
 * the snath's angle from the facing for each frame; `side` the way it travels.
 */
function sweep(rels: number[], side: number) {
  return (view: View): ReaperPose[] =>
    rels.map((rel, i) => {
      const a = FACE[view] + rel;
      const prev = i > 0 ? FACE[view] + rels[i - 1] : undefined;
      const striking = i === 2 || i === 3;
      const lean = [-1, -1, 1, 2, 1, 0][i] ?? 0;
      return pose({
        lean: view === 'side' ? lean : 0,
        sway: side * [-0.6, -1, 1.2, 1.6, 1, 0.4][i],
        flutter: i,
        footA: view === 'side' ? [0, -1, 1, 2, 1, 0][i] : 0,
        sc: swung(view, a, side, { glow: striking ? 1 : i === 1 ? 0.4 : 0, smear: striking && prev !== undefined ? prev : undefined, up: i === 1 ? 11 : 12 }),
        hand2: hang(view, 0),
        eyes: striking ? 1 : 0.6,
      });
    });
}

const reap1 = sweep([-150, -120, -10, 70, 100, 90], 1);
const reap2 = sweep([150, 120, 10, -70, -100, -90], -1);

/** The spin, one frame per eighth of a turn: the body turns with the scythe, flung out at full stretch. */
function spinPose(k: number): { view: View; mirror: boolean; pose: ReaperPose } {
  const a = k * 45;
  const view: View = k === 0 ? 'side' : k === 4 ? 'side' : k < 4 ? 'down' : 'up';
  const mirror = k === 0;
  // A mirrored frame is drawn facing left and flipped: its angles are drawn flipped too.
  const da = mirror ? 180 - a : a;
  const sc = swung(view, da, mirror ? -1 : 1, { glow: 1, smear: mirror ? 180 - (a - 50) : a - 50, up: 13, down: 5, off: 3.6 }, 1);
  return { view, mirror, pose: pose({ bob: 1, sway: 1.6, flutter: k, sc, hand2: hang(view, 1), eyes: 1, lean: view === 'side' ? 1 : 0 }) };
}

/** Death's step: hunched to spring, gone into shade, and forming again at the end of the cut. */
function step(view: View): ReaperPose[] {
  const F = FACE[view];
  const keys: [number, number, number, number, number][] = [
    // rel, fade, scatter, glow, lean
    [-130, 0, 0, 0.5, -1],
    [-100, 0.55, 0.3, 0.8, 1],
    [-100, 1, 0.6, 1, 2],
    [-100, 1, 1, 1, 2],
    [40, 0.45, 0.4, 1, 2],
    [95, 0, 0, 0.6, 1],
  ];
  return keys.map(([rel, fade, scatter, glow, lean], i) =>
    pose({
      lean: view === 'side' ? lean : 0,
      sway: [-1, 1.5, 2, 2, 1.5, 0.5][i],
      flutter: i,
      fade,
      scatter,
      sc: swung(view, F + rel, 1, { glow, smear: i === 4 ? F - 60 : undefined }),
      hand2: hang(view, 0),
      eyes: 1,
    }),
  );
}

/** The Harvest called: the scythe lifted overhead in both hands, blade up, burning with soul-light. */
function harvest(view: View): ReaperPose[] {
  return [0, 0.35, 0.7, 1, 1].map((k, i) => {
    const h = held(view, 0);
    const up: Scythe = { gx: view === 'side' ? 9 : 16.6, gy: 7.2, a: 180, up: 13, down: 7, side: 1, reach: 1, behind: false, glow: 1, off: 7.2 };
    const lerp = (a: number, b: number) => a + (b - a) * k;
    // Swing the hold round from upright to overhead.
    const sc: Scythe = k < 1 ? { ...up, gx: lerp(h.gx, up.gx), gy: lerp(h.gy, up.gy), a: lerp(h.a, view === 'down' ? -180 : 180), glow: k, off: k > 0.3 ? 7.2 : null } : { ...up, glow: i === 4 ? 1 : 0.8 };
    return pose({ bob: k > 0.6 ? 1 : 0, sway: [0, 0.6, 1.2, 1.6, 1.2][i], flutter: i * 2, sc, hand2: hang(view, 0), eyes: 0.5 + k * 0.5 });
  });
}

/**
 * The idle moment, facing the viewer: he lowers the scythe across his front
 * and draws a whetstone down its edge, stroke after stroke, sparks flying;
 * then he lifts it to the light and turns his head to look along the edge.
 */
function rest(view: View): ReaperPose[] {
  if (view !== 'down') return [];
  const across = (k: number, stone: number | undefined, sx: number, o: Partial<ReaperPose> = {}): ReaperPose => {
    const h = held('down', 0);
    const low: Scythe = { gx: 17.6, gy: 19.6, a: 192, up: 12, down: 8, side: -1, reach: 1, behind: false, glow: 0, off: null };
    const sc: Scythe = { ...low, gx: h.gx + (low.gx - h.gx) * k, gy: h.gy + (low.gy - h.gy) * k, a: -90 - (360 - 192 - 90) * k };
    // The stone rides the blade's edge, root to point.
    const [bx, by] = bladeAt(low, sx);
    const hand2: [number, number] = k < 1 ? hang('down', 0) : [bx + 0.5, by + 1.4];
    return pose({ sc, hand2, stone, eyes: 0.4, ...o });
  };
  return [
    across(0, undefined, 0),
    across(0.5, undefined, 0),
    across(1, 0, 0.15),
    across(1, 0.4, 0.35, { flutter: 1 }),
    across(1, 1, 0.65, { flutter: 2, eyes: 0.6 }),
    across(1, 0.7, 0.9, { flutter: 3 }),
    // Lifted to the light: the edge flaring, his head cocked along it.
    { ...across(1, undefined, 0), sc: { gx: 17.2, gy: 15.4, a: -128, up: 14, down: 10, side: -1, reach: 1, behind: false, glow: 1, off: null }, hand2: [7.4, 19.6], head: [-1, 0], eyes: 0.9 },
  ];
}

interface AnimDef {
  name: string;
  fps: number;
  loop: boolean;
  poses: (view: View) => ReaperPose[];
  order?: readonly number[];
}

export const REAPER_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'reap1', fps: 16, loop: false, poses: reap1 },
  { name: 'reap2', fps: 16, loop: false, poses: reap2 },
  { name: 'step', fps: 16, loop: false, poses: step },
  { name: 'harvest', fps: 10, loop: false, poses: harvest },
  { name: 'rest', fps: 7, loop: false, poses: rest, order: [0, 1, 2, 3, 4, 5, 3, 4, 5, 3, 4, 5, 2, 6, 6, 6, 6, 6, 2, 1, 0] },
];

export interface ReaperFrame {
  key: string;
  anim: string;
  dir: Dir | null;
  canvas: PixelCanvas;
}

function drawFrame(view: View, p: ReaperPose, mirror: boolean): PixelCanvas {
  const c = new PixelCanvas(REAPER_W, REAPER_H).offset(BODY_X, BODY_Y);
  drawFigure(c, p, view);
  return mirror ? c.mirrored() : c;
}

export function buildReaperFrames(look: ReaperLook = REAPER_LOOK): ReaperFrame[] {
  S = look;
  const out: ReaperFrame[] = [];
  for (const a of REAPER_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(view, pose, dir === 'right') }));
    }
  }
  for (let k = 0; k < SPIN_FRAMES; k++) {
    const sp = spinPose(k);
    out.push({ key: `spin_${k}`, anim: 'spin', dir: null, canvas: drawFrame(sp.view, sp.pose, sp.mirror) });
  }
  S = REAPER_LOOK;
  return out;
}

/** The facing's eighth of a turn (0 right, 2 down, 4 left, 6 up). */
const SPIN_AT: Record<Dir, number> = { right: 0, down: 2, left: 4, up: 6 };

/** The third reap for each facing: the spin from the scythe out at his side, round past where it began. */
export function reaperSpins(key: string): { key: string; frames: string[]; fps: number; loop: boolean }[] {
  return DIRS.map((d) => {
    const k0 = SPIN_AT[d] - 2 + SPIN_FRAMES;
    return { key: `${key}_reap3_${d}`, frames: Array.from({ length: SPIN_LEN }, (_, i) => `spin_${(k0 + i) % SPIN_FRAMES}`), fps: SPIN_FPS, loop: false };
  });
}

// ---------------------------------------------------------------------------
// Icons

const REAP_TONES: Tones = [hex('#f6fff0'), hex('#d4ffb0'), hex('#8ee86a'), hex('#2e7a3a')];
const CAT_TONES: Tones = [hex('#fff4e0'), hex('#ffc060'), hex('#ff6a9a'), hex('#8a1a5a')];

/** Reap: a scythe blade sweeping through a crescent of soul-light, a wisp freed from the cut. */
export function reapIcon(cat = false): Uint8ClampedArray {
  const t = cat ? CAT_TONES : REAP_TONES;
  const snath: RGB = cat ? hex('#3a2a40') : hex('#5a4028');
  return icon16((put) => {
    // The sweep's crescent.
    for (let i = 0; i <= 18; i++) {
      const a = Math.PI * (0.62 + (i / 18) * 0.95);
      const r = 7.2;
      put(9 + Math.cos(a) * r, 8 + Math.sin(a) * r * 0.8, i > 12 ? t[1] : i > 6 ? t[2] : t[3]);
      if (i > 4) put(9 + Math.cos(a) * (r - 1), 8 + Math.sin(a) * (r - 1) * 0.8, t[3]);
    }
    // The snath.
    seg(put, 12, 15, 9, 3, snath);
    // The blade, curling off the head to the left.
    const blade: [number, number][] = [[9, 3], [8, 2], [7, 2], [6, 2], [5, 3], [4, 3], [3, 4], [2, 5]];
    blade.forEach(([x, y], i) => {
      put(x, y, cat ? hex('#c4c6d6') : hex('#5a6270'));
      put(x, y + 1, i > 5 ? t[0] : t[1]);
    });
    put(9, 3, cat ? hex('#f6d460') : hex('#454e5e'));
    // A wisp rising from the cut.
    put(13, 6, t[0]);
    put(13, 5, t[1]);
    put(14, 4, t[2]);
    if (cat) put(12, 5, hex('#ffbe3a'));
  });
}

/** Death's step: a hooded shade streaking across, the dark trail behind it, its eyes lit. */
export function deathStepIcon(cat = false): Uint8ClampedArray {
  const t = cat ? CAT_TONES : REAP_TONES;
  const dark: RGB = cat ? hex('#3a1430') : hex('#1c2b25');
  return icon16((put) => {
    // The trail of shade, thinning back.
    for (let y = 6; y <= 13; y++) {
      const len = 8 - Math.abs(y - 9.5) * 1.6;
      for (let x = 1; x < 1 + len; x++) if ((x + y) % 3 !== 0 || x > len - 1) put(x, y, x > len - 2 ? t[3] : dark);
    }
    // The shade: a hood leaning into the dash.
    for (let y = 3; y <= 14; y++) {
      const w = y < 8 ? 2.6 : 2 + (y - 8) * 0.35;
      for (let x = Math.round(10 - w); x <= Math.round(10 + w); x++) {
        const rim = x === Math.round(10 + w) || y === 3;
        put(x + (y < 8 ? 1 : 0), y, rim ? t[3] : dark);
      }
    }
    put(10, 6, t[0]);
    put(12, 6, t[0]);
    // Its cut: a bright line through where it passed.
    seg(put, 2, 11, 15, 8, t[1]);
    put(15, 8, t[0]);
    if (cat) {
      put(3, 4, hex('#ffbe3a'));
      put(6, 14, hex('#ffbe3a'));
    }
  });
}
