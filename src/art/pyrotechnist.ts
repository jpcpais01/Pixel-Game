// The Pyrotechnist, the Alchemist class's fireworks-maker, drawn
// procedurally from a small rig like the alchemist's.
//
// Vermilion: a long coat of glossy vermilion lacquer frogged across the
// chest with gold cord, gold epaulettes and a high collar, a bandolier of
// paper rockets in every colour, a leather quiver-tube of rockets on the
// back, dark trousers and boots. Smoked round goggles are pushed up on a
// mop of dark hair, and his cheeks are streaked with soot. In one hand, a
// striped Roman candle; in the other, a linstock whose slow match smoulders.
//
// Masquerade is his other look on the same rig: a white Venetian half-mask
// trimmed in gold, a harlequin coat of purple and teal diamonds, and a
// feathered tricorne with a plume of teal, gold and magenta.
//
// The body keeps to the 24x32 box; frames are larger so the raised linstock
// and the candle fit. Drawing works in body-box coordinates. Hands are posed
// in the rig's own terms (forward, out to the side, height) and placed for
// each view, and so is the way the candle and the linstock point.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { BOOT, EYE, GOLD, LEATHER, SKIN, TROUSER, WOOD } from './palette';
import { DIRS, type Dir } from './wizard';
import { iconPainter } from './effects';

export const PYRO_W = 48;
export const PYRO_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const PYRO_ORIGIN_X = BODY_X + 12;
export const PYRO_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet the stars leave the candle at. */
export const PYRO_MUZZLE_H = 14;
/** The idle moment's pace. */
const REST_FPS = 8;
/** How long the candle is from the hand to its mouth, px. */
const CANDLE_LEN = 6.5;
/** And the linstock, from the hand to the match. */
const LINSTOCK_LEN = 7;

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------------------
// Materials

const LACQUER: Material = { ramp: ramp('#3a0806', '#6e120c', '#a8221a', '#d8402a', '#f47a52'), outline: hex('#1a0302'), outlineLit: hex('#2c0604'), shine: true };
const DARK_HAIR: Material = { ramp: ramp('#140a08', '#2a1610', '#45261a', '#643a26'), outline: hex('#080404'), outlineLit: hex('#1a0c08') };
const SMOKED: Material = { ramp: ramp('#0c0c14', '#1c1e2c', '#343a54', '#6a7898'), outline: hex('#06060a'), shine: true, noAO: true };
const BRASS_RIM: Material = { ramp: ramp('#33260f', '#634a20', '#977636', '#c9ab5e', '#eee0a0'), outline: hex('#1a1208'), shine: true };
const MATCH: Material = { ramp: ramp('#8a2a08', '#e86a1a', '#ffc04a', '#fff4c0'), outline: hex('#3a1004'), emissive: 0.95, noAO: true };
const SMOKE: Material = { ramp: ramp('#4a4650', '#76707e', '#a8a2b0', '#d4d0da'), outline: hex('#2a2830'), noAO: true, noOutline: true };
const FUSE: Material = { ramp: ramp('#1a1410', '#3a2c20', '#5a4632'), outline: hex('#0c0806') };

// Paper for the rockets and the Roman candle.
const RED_PAPER: Material = { ramp: ramp('#4a0a0a', '#8a1612', '#c8301e', '#ec6040'), outline: hex('#1c0404') };
const GOLD_PAPER: Material = { ramp: ramp('#5a3a0a', '#9a6a14', '#d8a430', '#f8d870'), outline: hex('#241604') };
const ROSE_PAPER: Material = { ramp: ramp('#5a0a2e', '#9a1a52', '#d8407e', '#f888b0'), outline: hex('#240414') };
const JADE_PAPER: Material = { ramp: ramp('#06301e', '#0e5a36', '#1e8a52', '#4cc07c'), outline: hex('#021208') };
const AZURE_PAPER: Material = { ramp: ramp('#0a1e4a', '#14387e', '#2a5ec0', '#5a94f0'), outline: hex('#040a1e') };
const WHITE_PAPER: Material = { ramp: ramp('#7a7068', '#b8aea2', '#e6dcd0', '#fff8ee'), outline: hex('#2a2620') };

// Masquerade's.
const HARLEQUIN_PURPLE: Material = { ramp: ramp('#1e0a30', '#3a1458', '#5c2288', '#8238b8', '#a868e0'), outline: hex('#0c0414'), outlineLit: hex('#1a0828'), shine: true };
const HARLEQUIN_TEAL: Material = { ramp: ramp('#04221e', '#0a443c', '#126a5e', '#1e9684', '#4ec8b0'), outline: hex('#020e0c'), shine: true };
const PORCELAIN: Material = { ramp: ramp('#5a5260', '#a69cae', '#dcd4e2', '#f6f2fa', '#ffffff'), outline: hex('#1e1824'), outlineLit: hex('#34303c'), shine: true };
const TRICORNE: Material = { ramp: ramp('#12061e', '#24103a', '#3a1c58', '#542a78'), outline: hex('#06020c'), outlineLit: hex('#10061c') };
const RAVEN_HAIR: Material = { ramp: ramp('#08060c', '#141020', '#221c34', '#362c4c'), outline: hex('#030206') };
const TEAL_PLUME: Material = { ramp: ramp('#06403a', '#127a6a', '#2ac0a4', '#8af4dc'), outline: hex('#021612') };
const MAGENTA_PLUME: Material = { ramp: ramp('#4a0838', '#8a1266', '#d02a98', '#ff7ad0'), outline: hex('#1c0216') };
const GOLD_PLUME: Material = { ramp: ramp('#6a4208', '#b07a14', '#e8b030', '#fff090'), outline: hex('#281804') };
const VIOLET_PAPER: Material = { ramp: ramp('#26083e', '#481470', '#7428a8', '#a860e0'), outline: hex('#0e0218') };
const GEM: Material = { ramp: ramp('#0a4a40', '#18a088', '#5af0d0', '#e0fff6'), outline: hex('#021612'), emissive: 0.5, noAO: true, shine: true };

// ---------------------------------------------------------------------------
// Looks

export interface PyroLook {
  key: string;
  /** The coat; Masquerade's is harlequin, `coat` and `coatB` in diamonds. */
  coat: Material;
  coatB?: Material;
  /** Gold frogging, epaulettes, cuffs and hem. */
  trim: Material;
  trouser: Material;
  hair: Material;
  skin: Material;
  eyes: Material;
  /** The Roman candle's stripes. */
  candle: [Material, Material];
  /** The papers of the rockets on the bandolier and in the quiver. */
  papers: Material[];
  /** Masquerade: the half-mask, the feathered tricorne and its plume. */
  carnival?: boolean;
  mask?: Material;
  hat?: Material;
  plumes?: Material[];
  /** The colours his stars burn in, brightest first (for the icons). */
  stars: [RGB, RGB, RGB, RGB][];
}

const STAR = (core: string, hot: string, mid: string, deep: string): [RGB, RGB, RGB, RGB] => [hex(core), hex(hot), hex(mid), hex(deep)];

export const VERMILION_LOOK: PyroLook = {
  key: 'pyrotechnist',
  coat: LACQUER,
  trim: GOLD,
  trouser: TROUSER,
  hair: DARK_HAIR,
  skin: SKIN,
  eyes: EYE,
  candle: [WHITE_PAPER, AZURE_PAPER],
  papers: [GOLD_PAPER, ROSE_PAPER, JADE_PAPER, AZURE_PAPER, WHITE_PAPER],
  stars: [STAR('#fffbe0', '#ffe070', '#ffb020', '#c06a10'), STAR('#fff0f6', '#ffa0c8', '#ff4a8a', '#a8185a'), STAR('#f0fff4', '#a0ffc0', '#30d878', '#108a48'), STAR('#f0f8ff', '#a0d0ff', '#4a98ff', '#1a4ab0')],
};

export const CARNIVAL_LOOK: PyroLook = {
  ...VERMILION_LOOK,
  key: 'pyrotechnist_carnival',
  coat: HARLEQUIN_PURPLE,
  coatB: HARLEQUIN_TEAL,
  hair: RAVEN_HAIR,
  candle: [WHITE_PAPER, GOLD_PAPER],
  papers: [GOLD_PAPER, VIOLET_PAPER, JADE_PAPER, ROSE_PAPER, WHITE_PAPER],
  carnival: true,
  mask: PORCELAIN,
  hat: TRICORNE,
  plumes: [TEAL_PLUME, GOLD_PLUME, MAGENTA_PLUME],
  stars: [STAR('#fbf0ff', '#d8a0ff', '#a050f0', '#5a1ea0'), STAR('#f0fffb', '#90ffe8', '#20d0b0', '#0a7a6a'), STAR('#fffbe0', '#ffe070', '#ffb020', '#c06a10'), STAR('#fff0fa', '#ff9ae0', '#e83ab8', '#8a1270')],
};

export const PYRO_LOOKS = [VERMILION_LOOK, CARNIVAL_LOOK];

/** The look being drawn; set by buildPyroFrames. */
let S: PyroLook = VERMILION_LOOK;

// ---------------------------------------------------------------------------
// The rig

/** A hand (or the way a thing in it points), in the rig's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

type View = 'down' | 'up' | 'side';

export interface Pose {
  /** Whole body raised. */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The candle hand (screen left from the front and back, the near arm from the side) and the off hand. */
  a: Hand;
  b: Hand;
  /** Which way the candle points, and the linstock or the string. */
  ta: Hand;
  tb: Hand;
  /** What the off hand holds: the linstock, a string of firecrackers, or nothing. */
  bItem: 'match' | 'string' | 'none';
  /** 0..1 how hard the slow match burns. */
  ember: number;
  /** 0..1 a star bursting from the candle's mouth. */
  flash: number;
  /** Coat hem swinging behind (side view) or to one side, in pixels. */
  sway: number;
  blink?: boolean;
  /** The head nudged from the body; front view only. */
  headX?: number;
  headY?: number;
  /** 1..2 sparks at the ground before him (lighting the battery). */
  fuse?: number;
  /** The idle moment's dud: 1 the pop in his face, 2..3 its smoke rising. */
  pop?: number;
  /** Fresh soot about his eyes, after the dud. */
  sooty?: boolean;
}

/** The chest row in body coordinates, the height hands are posed from. */
const CH = 18;

interface Placed {
  x: number;
  y: number;
  /** Drawn behind the body. */
  behind: boolean;
}

/** Where a hand lands on screen in each view. `hx` is the upper body's centre (side view). */
function place(view: View, arm: 'a' | 'b', q: Hand, U: number, hx: number): Placed {
  const side = arm === 'a' ? -1 : 1;
  if (view === 'down') return { x: 12 + side * q.s, y: CH + U - q.h + q.f * 0.7, behind: q.f < -1 };
  if (view === 'up') return { x: 12 + side * q.s, y: CH + U - q.h - q.f * 0.8, behind: q.f > 1 };
  // Facing left; the far arm sits a touch higher and behind the body.
  const far = arm === 'b';
  return { x: hx - 1 - q.f * 1.05 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), behind: far };
}

/**
 * Which way a held thing points on screen, as a unit vector and how much of
 * its length shows (pointing at the viewer or away, it is foreshortened).
 */
function pointing(view: View, arm: 'a' | 'b', t: Hand): { ux: number; uy: number; k: number } {
  const side = arm === 'a' ? -1 : 1;
  let x: number;
  let y: number;
  if (view === 'down') {
    x = side * t.s;
    y = -t.h + t.f * 0.55;
  } else if (view === 'up') {
    x = side * t.s;
    y = -t.h - t.f * 0.6;
  } else {
    x = -t.f;
    y = -t.h;
  }
  const full = Math.hypot(t.f, t.s, t.h) || 1;
  const l = Math.hypot(x, y) || 1;
  return { ux: x / l, uy: y / l, k: Math.max(0.35, Math.min(1, l / full)) };
}

// ---------------------------------------------------------------------------
// Parts

/** A fill like PixelCanvas.shape, but with a material chosen per pixel (the harlequin's diamonds). */
function fill(c: PixelCanvas, y0: number, y1: number, edges: (y: number) => [number, number], mat: (x: number, y: number) => Material, normal: (x: number, y: number, t: number, u: number) => ReturnType<typeof sphere>, bias = 0): void {
  for (let y = y0; y <= y1; y++) {
    const [l, r] = edges(y);
    const u = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
    for (let x = Math.round(l); x <= Math.round(r) - 1; x++) {
      const t = r - l > 0.001 ? ((x + 0.5 - l) / (r - l)) * 2 - 1 : 0;
      c.px(x, y, mat(x, y), normal(x, y, t, u), { bias });
    }
  }
}

/** The coat's cloth at a pixel: plain lacquer, or a harlequin diamond. */
function cloth(x: number, y: number): Material {
  if (!S.coatB) return S.coat;
  const a = Math.floor((x + y) / 3);
  const b = Math.floor((x - y + 99) / 3);
  return (a + b) & 1 ? S.coatB : S.coat;
}

/** The striped paper tube of the Roman candle from the hand at (x, y), its mouth `len` px along (ux, uy); a star bursting from it at `flash`. */
function candle(c: PixelCanvas, x: number, y: number, ux: number, uy: number, len: number, flash: number, bias: number): void {
  c.part();
  const back = 1.6;
  const steps = Math.ceil((len + back) * 2);
  for (let i = 0; i <= steps; i++) {
    const d = -back + (i / steps) * (len + back);
    // Bands of the two papers, two pixels each.
    const m = Math.floor((d + back) / 1.6) % 2 ? S.candle[1] : S.candle[0];
    c.capsule(x + ux * d, y + uy * d, x + ux * d, y + uy * d, 0.95, 0.95, m, { bias });
  }
  // The mouth: a dark ring of scorched paper.
  c.part();
  const mx = x + ux * (len + 0.4);
  const my = y + uy * (len + 0.4);
  c.px(mx, my, FUSE, sphere(ux * 0.5, uy * 0.5), { bias: bias - 1 });
  c.spark(mx, my, [255, 150, 60], 0.25);
  if (flash > 0) {
    // A star leaving the mouth: a white heart, a bloom of colour, and a ring of sparks.
    const k = flash;
    const [core, hot, mid] = S.stars[0];
    const ex = mx + ux * 1.5;
    const ey = my + uy * 1.5;
    c.spark(ex, ey, core, 1.6 * k);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.spark(ex + dx, ey + dy, hot, 1.1 * k);
    for (let i = 0; i < 6; i++) {
      const th = (i / 6) * Math.PI * 2 + 0.4;
      c.spark(ex + Math.cos(th) * 2.4, ey + Math.sin(th) * 2.4, i % 2 ? mid : S.stars[1][1], 0.8 * k);
    }
  }
}

/** The linstock from the hand at (x, y): a short staff, a brass fork at its head holding the slow match, its ember glowing at `ember`. */
function linstock(c: PixelCanvas, x: number, y: number, ux: number, uy: number, len: number, ember: number, seed: number, bias: number): void {
  c.part();
  c.line(x - ux * 2, y - uy * 2, x + ux * len, y + uy * len, WOOD, () => cyl(0.2, 0.2), { bias });
  c.part();
  const fx = x + ux * (len + 0.6);
  const fy = y + uy * (len + 0.6);
  c.px(fx, fy, BRASS_RIM, sphere(-0.3, -0.5), { bias });
  c.part();
  const ex = fx + ux;
  const ey = fy + uy;
  c.px(ex, ey, MATCH, sphere(0, -0.3), { glow: 0.6 + 0.4 * ember });
  // The match smoulders: its light, and a spark or two winking off it.
  c.spark(ex, ey, [255, 200, 120], 0.5 + 0.6 * ember);
  c.spark(ex - 1, ey, [255, 120, 40], 0.25 * ember);
  c.spark(ex + 1, ey, [255, 120, 40], 0.25 * ember);
  if (ember > 0.5) {
    c.spark(ex + ux, ey + uy, [255, 230, 160], ember * 0.9);
    c.spark(ex + ux * 2 + ((seed % 3) - 1), ey + uy * 2 - 1, [255, 170, 60], ember * 0.6);
  }
  if (seed % 2 === 0) c.spark(ex + ((seed >> 1) % 2 ? 1 : -1), ey - 2, [255, 150, 60], 0.45);
}

/** A string of firecrackers from the hand at (x, y), hanging `len` px along (ux, uy): red crackers paired along a braided fuse, its end spitting. */
function crackers(c: PixelCanvas, x: number, y: number, ux: number, uy: number, len: number, seed: number, bias: number): void {
  c.part();
  c.line(x, y, x + ux * len, y + uy * len, FUSE, () => cyl(0, 0), { bias });
  c.part();
  const nx = -uy;
  const ny = ux;
  for (let d = 1.2; d <= len - 0.5; d += 1.5) {
    const k = Math.round(d / 1.5) % 2 ? 1 : -1;
    c.px(x + ux * d + nx * k, y + uy * d + ny * k, RED_PAPER, sphere(k * 0.5, 0.1), { bias });
  }
  const ex = x + ux * (len + 0.8);
  const ey = y + uy * (len + 0.8);
  c.spark(ex, ey, [255, 240, 180], 1);
  c.spark(ex + ((seed % 3) - 1), ey - 1, [255, 180, 60], 0.7);
  c.spark(ex + 1, ey + ((seed >> 1) % 2), [255, 120, 40], 0.5);
}

/**
 * A sleeved arm from the shoulder, bent at the elbow (towards `hint`), a
 * gold cuff, and the bare hand with what it holds.
 */
function arm(c: PixelCanvas, view: View, which: 'a' | 'b', sx: number, sy: number, p: Placed, reach: number, hint: [number, number], pose: Pose, bias = 0): void {
  const { x: fx, y: fy } = p;
  const dx = fx - sx;
  const dy = fy - sy;
  const d = Math.hypot(dx, dy) || 0.01;
  let ex = sx + dx / 2;
  let ey = sy + dy / 2;
  if (d < reach * 2) {
    // Two equal bones: the elbow sits where they meet, on the side the hint points.
    const ang = Math.acos(Math.min(1, d / (reach * 2)));
    const base = Math.atan2(dy, dx);
    let best = -Infinity;
    for (const t of [base + ang, base - ang]) {
      const cx = sx + Math.cos(t) * reach;
      const cy = sy + Math.sin(t) * reach;
      const score = (cx - sx) * hint[0] + (cy - sy) * hint[1];
      if (score > best) {
        best = score;
        ex = cx;
        ey = cy;
      }
    }
  }
  c.part();
  c.capsule(sx, sy, ex, ey, 1.75, 1.5, S.coat, { bias });
  c.part();
  c.capsule(ex, ey, fx, fy, 1.5, 1.3, S.coat, { bias });
  // The cuff, turned back in gold.
  c.part();
  const kx = ex + (fx - ex) * 0.72;
  const ky = ey + (fy - ey) * 0.72;
  c.ellipse(kx, ky, 1.45, 1.2, S.trim, { bias });
  // What the hand holds, under the fingers.
  if (which === 'a') {
    const u = pointing(view, 'a', pose.ta);
    candle(c, fx, fy, u.ux, u.uy, CANDLE_LEN * u.k, pose.flash, bias);
  } else if (pose.bItem === 'match') {
    const u = pointing(view, 'b', pose.tb);
    linstock(c, fx, fy, u.ux, u.uy, LINSTOCK_LEN * u.k, pose.ember, Math.round(fx * 7 + fy * 3), bias);
  } else if (pose.bItem === 'string') {
    const u = pointing(view, 'b', pose.tb);
    crackers(c, fx, fy, u.ux, u.uy, 7 * u.k, Math.round(fx * 5 + fy), bias);
  }
  c.part();
  c.ellipse(fx, fy, 1.2, 1.15, S.skin, { bias });
}

function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  c.part();
  c.capsule(hx, hy, fx, fy, 1.5, 1.3, S.trouser, { bias });
}

/** A boot, the toe turned towards the viewer or forward. */
function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x, y, 2.2, 1.2, BOOT, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.6, 1.3, BOOT, { flatten: 0.8, bias });
}

/** A paper rocket on the bandolier at (x, y): a pixel of paper under a pixel of its cap. */
function bandRocket(c: PixelCanvas, x: number, y: number, i: number): void {
  const m = S.papers[i % S.papers.length];
  c.px(x, y, m, sphere(-0.2, 0.2));
  c.px(x, y - 1, m, sphere(-0.3, -0.6), { bias: 1 });
}

/** Rockets standing up out of the quiver's mouth at (x, y), leaning along (ux, uy): sticks and coloured paper heads with pointed caps. */
function quiverRockets(c: PixelCanvas, x: number, y: number, ux: number, uy: number, bias: number): void {
  const nx = -uy;
  const ny = ux;
  const heads: [number, number][] = [[-1.1, 2.6], [0.2, 3.6], [1.3, 2.2]];
  heads.forEach(([o, up], i) => {
    const bx = x + nx * o;
    const by = y + ny * o;
    const m = S.papers[(i + 1) % S.papers.length];
    c.part();
    c.capsule(bx, by, bx + ux * up, by + uy * up, 0.75, 0.75, m, { bias });
    c.part();
    c.px(bx + ux * (up + 1.1), by + uy * (up + 1.1), S.papers[i % S.papers.length], sphere(ux * 0.4, -0.7), { bias: bias + 1 });
  });
}

/** The quiver-tube across his back, from the hip at (x0, y0) to its mouth at (x1, y1): leather, two brass bands, rockets out of the top. */
function quiver(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, bias = 0): void {
  const l = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / l;
  const uy = (y1 - y0) / l;
  quiverRockets(c, x1 + ux * 0.6, y1 + uy * 0.6, ux, uy, bias);
  c.part();
  c.capsule(x0, y0, x1, y1, 1.55, 1.7, LEATHER, { bias });
  c.part();
  for (const t of [0.22, 0.8]) {
    const bx = x0 + (x1 - x0) * t;
    const by = y0 + (y1 - y0) * t;
    c.capsule(bx - uy * 1.4, by + ux * 1.4, bx + uy * 1.4, by - ux * 1.4, 0.5, 0.5, BRASS_RIM, { bias });
  }
}

/** Smoked round goggles pushed up on the brow: a strap round the head and two brass-rimmed lenses at (lx, y) and (rx, y). */
function goggles(c: PixelCanvas, lenses: number[], y: number, strap: [number, number] | null, small = false): void {
  if (strap) {
    c.part();
    c.line(strap[0], y + 0.4, strap[1], y + 0.4, LEATHER, () => cyl(0, 0.3));
  }
  for (const x of lenses) {
    c.part();
    c.ellipse(x, y, small ? 1.1 : 1.45, small ? 1.05 : 1.35, BRASS_RIM);
    c.part();
    if (small) c.px(x, y, SMOKED, sphere(-0.3, -0.3));
    else c.ellipse(x, y, 0.85, 0.8, SMOKED);
    c.spark(x - 0.5, y - 0.5, [200, 220, 255], 0.35);
  }
}

/** Soot smudged on his cheeks (and round his eyes, after the dud). */
function soot(c: PixelCanvas, pts: [number, number][]): void {
  for (const [x, y] of pts) c.shade(x, y, -2);
}

/**
 * Masquerade's tricorne: a cocked brim with gold lace, a low crown, and a
 * plume of teal, gold and magenta curling up from a jewelled brooch.
 */
function tricorne(c: PixelCanvas, cx: number, U: number, view: View): void {
  const hat = S.hat!;
  const plumes = S.plumes!;
  const side = view === 'side';
  const plume = (pts: [number, number, number, number][]) => {
    pts.forEach(([x0, y0, x1, y1], i) => {
      c.part();
      c.capsule(x0, y0 + U, x1, y1 + U, 0.65, 1.05, plumes[i % plumes.length], { bias: view === 'up' ? -1 : 0 });
      c.part();
      c.px(x1, y1 + U - 0.6, plumes[i % plumes.length], sphere(0, -0.7), { bias: 1 });
    });
  };
  // The plume rises behind the crown, so it goes first.
  if (view === 'down') plume([[cx + 2.4, 7.4, cx + 5.4, 2.2], [cx + 1.6, 7.2, cx + 3.2, 1.2], [cx + 3, 7.8, cx + 6.6, 4.4]]);
  else if (view === 'up') plume([[cx - 2.4, 7.4, cx - 5.4, 2.2], [cx - 1.6, 7.2, cx - 3.2, 1.2], [cx - 3, 7.8, cx - 6.6, 4.4]]);
  else plume([[cx + 1.2, 6.8, cx + 4.6, 1.8], [cx + 0.6, 6.6, cx + 2.4, 1], [cx + 1.8, 7.4, cx + 6.2, 4.2]]);
  // The crown.
  c.part();
  const off = side ? 0.6 : 0;
  const crown = [2.2, 2.9, 3.2];
  c.shape(5 + U, 7 + U, (y) => {
    const hw = crown[y - 5 - U];
    return [cx + off - hw, cx + off + hw];
  }, hat, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.8, 1));
  // The brim, cocked up: from the front its point dips towards us, from the side it sweeps up at both ends.
  c.part();
  if (view === 'side') {
    c.shape(7 + U, 9 + U, (y) => {
      const k = y - 7 - U;
      return k === 0 ? [cx - 5.2, cx - 3] : k === 1 ? [cx - 5, cx + 4.8] : [cx - 3.4, cx + 3.6];
    }, hat, (_x, _y, t, u) => sphere(t * 0.6, u * 0.6 - 0.4, 1));
    c.px(cx + 4.6, 7 + U, hat, sphere(0.5, -0.5));
  } else {
    c.shape(7 + U, 9 + U, (y) => {
      const k = y - 7 - U;
      return k === 0 ? [cx - 5.8, cx + 5.8] : k === 1 ? [cx - 5.2, cx + 5.2] : [cx - 2.2, cx + 2.2];
    }, hat, (_x, _y, t, u) => sphere(t * 0.6, u * 0.8 - 0.4, 1));
    // The upturned corners at either side.
    c.px(cx - 6, 6 + U, hat, sphere(-0.6, -0.5));
    c.px(cx + 5, 6 + U, hat, sphere(0.6, -0.5), { bias: -1 });
  }
  // Gold lace along the brim's edge.
  c.part();
  for (let x = Math.floor(cx - 6.5); x <= Math.ceil(cx + 6.5); x++) {
    for (let y = 9 + U; y >= 6 + U; y--) {
      if (c.materialAt(x, y) === hat && c.materialAt(x, y + 1) !== hat) {
        c.px(x, y, S.trim, sphere(0, 0.4));
        break;
      }
    }
  }
  // The brooch the plume springs from.
  if (view !== 'up') {
    c.part();
    const bx = view === 'down' ? cx + 2 : cx + 1.4;
    c.px(bx, 6 + U, GEM, sphere(-0.3, -0.3));
    c.spark(bx, 6 + U, [160, 255, 230], 0.4);
  }
}

/** Masquerade's half-mask from the front: white porcelain over the brow and eyes, its corners swept up into points, gold lace round the eyeholes. */
function maskFront(c: PixelCanvas, cx: number, U: number, blink: boolean | undefined): void {
  const m = S.mask!;
  c.part();
  c.shape(10 + U, 12 + U, (y) => {
    const k = y - 10 - U;
    return k === 2 ? [cx - 2.4, cx + 2.4] : [cx - 3.3, cx + 3.3];
  }, m, (_x, _y, t, u) => sphere(t * 0.85, u * 0.6 - 0.3, 1));
  c.px(cx - 4, 9 + U, m, sphere(-0.6, -0.5));
  c.px(cx + 3, 9 + U, m, sphere(0.6, -0.5), { bias: -1 });
  c.part();
  // Gold over each eyehole, and a gold drop between the brows.
  for (const x of [cx - 2, cx + 1]) c.px(x, 10 + U, S.trim, sphere(0, -0.4));
  c.px(cx, 10 + U, S.trim, sphere(0, -0.3), { bias: 1 });
  c.part();
  for (const x of [cx - 2, cx + 1]) c.px(x, 11 + U, blink ? m : S.eyes, sphere(0, 0), blink ? { bias: -1 } : {});
}

// ---------------------------------------------------------------------------
// Directions

const REACH_FRONT = 4.4;
const REACH_SIDE = 5.2;

/** The coat's outline: broad at the chest, nipped at the belt, flaring to the hem. */
function coatWidth(y: number, top: number, waist: number, hem: number, chest: number): number {
  if (y <= waist) {
    const u = (y + 0.5 - top) / (waist - top);
    return chest - 0.5 * u * u;
  }
  const u = (y + 0.5 - waist) / (hem - waist);
  return chest - 0.5 + 1.5 * u;
}

/** The dud's pop in his face and its smoke, from the candle's mouth at (x, y). */
function dud(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k === 1) {
    // A bang of sparks in every colour.
    S.stars.forEach((st, i) => {
      for (let j = 0; j < 3; j++) {
        const th = ((i * 3 + j) / 12) * Math.PI * 2;
        c.spark(x + Math.cos(th) * 2.6, y + Math.sin(th) * 2.2, st[1], 1);
        c.spark(x + Math.cos(th) * 1.4, y + Math.sin(th) * 1.2, st[0], 0.8);
      }
    });
    c.spark(x, y, [255, 255, 255], 1.6);
    return;
  }
  // A puff of grey smoke drifting up and spreading.
  const px = x + (k - 1) * 0.8;
  const py = y - (k - 1) * 2.6;
  const r = 1.2 + (k - 1) * 0.7;
  c.part();
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      const d = Math.hypot(dx, dy * 1.2) / r;
      if (d > 1) continue;
      if (k > 2 && d > 0.6 && ((dx + dy) & 1)) continue;
      c.px(px + dx, py + dy, SMOKE, sphere(dx / r, dy / r), { bias: k > 2 ? -1 : 0 });
    }
  }
}

/** Gold epaulettes on both shoulders (front and back views), their fringe in shadow. */
function epaulettes(c: PixelCanvas, U: number): void {
  c.part();
  for (const [x, k] of [[7.3, -1], [16.7, 1]] as const) {
    c.ellipse(x, 15.4 + U, 1.9, 1.05, S.trim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + k * 0.1, dy * 0.6 - 0.3, 1) });
  }
  for (let x = 5; x <= 18; x++) if ((x & 1) === 0 && c.materialAt(x, 16 + U) === S.trim) c.shade(x, 16 + U, -1);
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const armA = () => arm(c, 'down', 'a', 7.4, 16.4 + U, fa, REACH_FRONT, [-0.4, 1], p, fa.behind ? -1 : 0);
  const armB = () => arm(c, 'down', 'b', 16.6, 16.4 + U, fb, REACH_FRONT, [0.4, 1], p, fb.behind ? -1 : 0);
  const head = (draw: () => void) => {
    c.offset(BODY_X + (p.headX ?? 0), BODY_Y + (p.headY ?? 0));
    draw();
    c.offset(BODY_X, BODY_Y);
  };
  // The quiver's rockets peek over his left shoulder.
  quiverRockets(c, 16.4, 13.4 + U, 0.35, -0.94, -1);
  if (fa.behind) armA();
  if (fb.behind) armB();

  leg(c, 10.2, 25.5 + L, 10, 28.4 - p.footA);
  leg(c, 13.8, 25.5 + L, 14, 28.4 - p.footB);
  boot(c, 10, 29.6 - p.footA);
  boot(c, 14, 29.6 - p.footB);

  // The coat, its skirts parted below the belt.
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 27 + L;
  c.part();
  fill(c, top, hem, (y) => {
    const hw = coatWidth(y, top, waist, hem, 4.7);
    const sw = y > waist ? ((y - waist) / (hem - waist)) * p.sway : 0;
    return [cx - hw + sw, cx + hw + sw];
  }, cloth, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.2, 1));
  for (let y = waist + 1; y <= hem; y++) c.shade(cx + Math.round(((y - waist) / (hem - waist)) * p.sway), y, -2);
  // Gold along the hem.
  c.part();
  for (let x = cx - 8; x <= cx + 8; x++) if (c.filled(x, hem) && !c.filled(x, hem + 1) && c.materialAt(x, hem) !== BOOT) c.px(x, hem, S.trim, sphere((x - cx) / 7, 0.5));
  // Frogging: gold cords across the chest, a knot at either end.
  c.part();
  for (const y of [17, 19, 21]) {
    for (let x = cx - 2; x <= cx + 1; x++) c.px(x, y + U, S.trim, cyl((x - cx + 0.5) / 2.5, 0.2), { bias: x === cx - 2 || x === cx + 1 ? 1 : 0 });
  }
  // The belt and its buckle.
  c.part();
  c.shape(waist, waist, () => [cx - 4.3, cx + 4.3], BOOT, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx, waist, S.trim, sphere(0, -0.3));
  c.px(cx - 1, waist, S.trim, sphere(-0.4, -0.3), { bias: -1 });
  // The bandolier, shoulder to hip, its rockets in every colour.
  c.part();
  c.capsule(7.8, 15.6 + U, 16.2, 22.4 + U, 0.6, 0.6, LEATHER);
  [0.3, 0.5, 0.7, 0.88].forEach((t, i) => bandRocket(c, Math.round(7.8 + 8.4 * t), Math.round(15.6 + 6.8 * t + U) - 1, i));
  // The high collar.
  c.part();
  c.shape(14 + U, 15 + U, () => [cx - 2.4, cx + 2.4], S.coat, (_x, _y, t, u) => sphere(t * 0.8, u * 0.5 - 0.4, 1));
  c.shape(14 + U, 14 + U, () => [cx - 2.4, cx + 2.4], S.trim, (_x, _y, t) => cyl(t, -0.2));

  head(() => {
    if (S.carnival) {
      // Black hair under the tricorne, the face, the half-mask over it, then the hat.
      c.part();
      c.ellipse(cx, 11.2 + U, 3.6, 2.8, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7 - 0.2, 1) });
      c.part();
      c.ellipse(cx, 12.2 + U, 2.9, 2.6, S.skin);
      c.shade(cx - 1, 14 + U, -2);
      c.shade(cx, 14 + U, -2);
      c.shade(cx + 1, 13 + U, -1);
      maskFront(c, cx, U, p.blink);
      tricorne(c, cx, U, 'down');
      if (p.sooty) soot(c, [[cx - 3, 12 + U], [cx + 2, 12 + U]]);
      return;
    }
    // A mop of dark hair, the face, soot on the cheeks, then the goggles pushed up on the brow.
    c.part();
    c.ellipse(cx, 9.8 + U, 3.7, 2.7, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7 - 0.4, 1) });
    for (const [x, y] of [[cx - 2, 7], [cx, 6.5], [cx + 2, 7]] as const) c.px(x, y + U, S.hair, sphere(0, -0.8), { bias: 1 });
    c.part();
    c.ellipse(cx, 12.4 + U, 2.9, 2.5, S.skin);
    // Sideburns.
    c.part();
    c.px(cx - 3, 11 + U, S.hair, sphere(-0.6, 0));
    c.px(cx + 2, 11 + U, S.hair, sphere(0.6, 0), { bias: -1 });
    // Eyes, a grin, and soot.
    c.part();
    for (const x of [cx - 2, cx + 1]) c.px(x, 12 + U, p.blink ? S.skin : S.eyes, sphere(0, 0), p.blink ? { bias: -1 } : {});
    c.shade(cx - 1, 14 + U, -2);
    c.shade(cx, 14 + U, -2);
    c.shade(cx + 1, 13 + U, -1);
    soot(c, [[cx - 3, 13 + U], [cx + 2, 13 + U]]);
    if (p.sooty) soot(c, [[cx - 3, 12 + U], [cx - 1, 12 + U], [cx + 2, 12 + U], [cx, 11 + U]]);
    goggles(c, [cx - 1.8, cx + 1.8], 9.6 + U, [cx - 3.6, cx + 3.6]);
  });

  // Gold epaulettes on top of the shoulders, their fringe in shadow; the arms and what they hold go over them.
  epaulettes(c, U);
  if (!fa.behind) armA();
  if (!fb.behind) armB();
  if (p.pop) dud(c, 9.4 + (p.headX ?? 0), 10.6 + U, p.pop);
  if (p.fuse) groundSparks(c, 19, 30.5, p.fuse);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const armA = () => arm(c, 'up', 'a', 7.4, 16.4 + U, fa, REACH_FRONT, [-0.5, 0.8], p, fa.behind ? -1 : 0);
  const armB = () => arm(c, 'up', 'b', 16.6, 16.4 + U, fb, REACH_FRONT, [0.5, 0.8], p, fb.behind ? -1 : 0);
  if (fa.behind) armA();
  if (fb.behind) armB();

  leg(c, 10.2, 25.5 + L, 10, 28.4 - p.footB);
  leg(c, 13.8, 25.5 + L, 14, 28.4 - p.footA);
  boot(c, 10, 29.6 - p.footB);
  boot(c, 14, 29.6 - p.footA);

  // The coat from behind: a seam down the back to a vent at the hem.
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 27 + L;
  c.part();
  fill(c, top, hem, (y) => {
    const hw = coatWidth(y, top, waist, hem, 4.7);
    const sw = y > waist ? ((y - waist) / (hem - waist)) * p.sway : 0;
    return [cx - hw + sw, cx + hw + sw];
  }, cloth, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.2, 1));
  for (let y = top + 3; y <= hem; y++) c.shade(cx + (y > waist ? Math.round(((y - waist) / (hem - waist)) * p.sway) : 0), y, y > hem - 3 ? -2 : -1);
  c.part();
  for (let x = cx - 8; x <= cx + 8; x++) if (c.filled(x, hem) && !c.filled(x, hem + 1) && c.materialAt(x, hem) !== BOOT) c.px(x, hem, S.trim, sphere((x - cx) / 7, 0.5));
  c.part();
  c.shape(waist, waist, () => [cx - 4.3, cx + 4.3], BOOT, (_x, _y, t) => cyl(t, 0));
  // The bandolier crossing the back.
  c.part();
  c.capsule(16.2, 15.6 + U, 8.2, 22.4 + U, 0.6, 0.6, LEATHER);
  // The collar, then the head from behind.
  c.part();
  c.shape(14 + U, 15 + U, () => [cx - 2.4, cx + 2.4], S.coat, (_x, _y, t) => sphere(t * 0.8, 0.2, 1));
  c.part();
  if (S.carnival) {
    c.ellipse(cx, 11.6 + U, 3.4, 2.9, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    // The mask's ribbons, tied at the back and hanging.
    c.part();
    c.capsule(cx - 0.6, 12 + U, cx - 1.4, 15.6 + U, 0.5, 0.4, S.trim);
    c.capsule(cx + 0.6, 12 + U, cx + 1.6, 15 + U, 0.5, 0.4, S.trim, { bias: -1 });
  } else {
    c.ellipse(cx, 11.4 + U, 3.4, 3.0, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    for (const [x, y] of [[cx - 2, 8], [cx, 7.5], [cx + 2, 8]] as const) c.px(x, y + U, S.hair, sphere(0, -0.8), { bias: 1 });
    // A tuft at the nape.
    c.px(cx - 1, 14 + U, S.hair, sphere(0, 0.6), { bias: -1 });
    c.px(cx, 14 + U, S.hair, sphere(0, 0.6), { bias: -1 });
    // The goggle strap round the back of the head.
    c.part();
    c.line(cx - 3.4, 10 + U, cx + 3.4, 10 + U, LEATHER, () => cyl(0, 0.3));
  }
  // The quiver-tube across his back, over the coat.
  quiver(c, 9, 24.5 + U, 15.6, 14.6 + U);
  if (S.carnival) tricorne(c, cx, U, 'up');

  epaulettes(c, U);
  if (!fa.behind) armA();
  if (!fb.behind) armB();
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean;
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);

  // Far arm, behind everything.
  arm(c, 'side', 'b', hx + 1.2, 16.6 + U, fb, REACH_SIDE, [0.3, 1], p, -1);

  // The quiver on his back, leaning back over the far shoulder.
  quiver(c, hx + 3.4, 24 + U, hx + 4.8, 14 + U, -1);

  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 0.8, 25.5 + L, cx + 1 - p.footB, 28.4 - lift(p.footB), -1);
  boot(c, cx + 0.4 - p.footB, 29.7 - lift(p.footB), true, -1);
  leg(c, cx - 0.6, 25.5 + L, cx - 0.4 - p.footA, 28.4 - lift(p.footA));
  boot(c, cx - 1.2 - p.footA, 29.7 - lift(p.footA), true);

  // The coat in profile, its tails swinging out behind.
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 27 + L;
  c.part();
  fill(c, top, hem, (y) => {
    const u = y <= waist ? 0 : (y - waist) / (hem - waist);
    const shift = y <= waist ? hx : hx + (cx - hx) * u;
    const hw = coatWidth(y, top, waist, hem, 3.2);
    return [shift - hw - 0.2, shift + hw + 0.3 + u * p.sway];
  }, cloth, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.2, 1));
  for (let y = waist + 1; y <= hem; y++) c.shade(Math.round(hx + (cx - hx) * ((y - waist) / (hem - waist)) - 1.5), y, -1);
  c.part();
  for (let x = cx - 8; x <= cx + 8; x++) if (c.filled(x, hem) && !c.filled(x, hem + 1) && c.materialAt(x, hem) !== BOOT) c.px(x, hem, S.trim, sphere((x - cx) / 7, 0.5));
  // Frogging at the coat's front edge.
  c.part();
  for (const y of [17, 19, 21]) {
    c.px(hx - 3, y + U, S.trim, sphere(-0.5, 0), { bias: 1 });
    c.px(hx - 2, y + U, S.trim, sphere(0, 0));
  }
  c.part();
  c.shape(waist, waist, () => [hx - 3.1, hx + 3.2], BOOT, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(hx - 3.1), waist, S.trim, sphere(-0.5, -0.3));
  // The bandolier down the near side, rockets along it.
  c.part();
  c.capsule(hx + 1.6, 15.4 + U, hx - 2.2, 22.2 + U, 0.6, 0.6, LEATHER);
  [0.4, 0.68].forEach((t, i) => bandRocket(c, Math.round(hx + 1.6 - 3.8 * t), Math.round(15.4 + 6.8 * t + U) - 1, i + 1));
  // The collar.
  c.part();
  c.shape(14 + U, 15 + U, () => [hx - 2, hx + 1.8], S.coat, (_x, _y, t, u) => sphere(t * 0.8 - 0.1, u * 0.5 - 0.4, 1));
  c.shape(14 + U, 14 + U, () => [hx - 2, hx + 1.8], S.trim, (_x, _y, t) => cyl(t, -0.2));

  if (S.carnival) {
    // Black hair at the back of the head, the face in profile, the mask's swept point, the hat.
    c.part();
    c.ellipse(hx + 1.2, 11.8 + U, 2.2, 2.6, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8, 1) });
    c.part();
    c.ellipse(hx - 0.6, 12.4 + U, 2.4, 2.4, S.skin);
    c.px(hx - 3, 12.6 + U, S.skin, sphere(-0.7, 0.2));
    c.shade(hx - 2, 14 + U, -2);
    c.part();
    c.shape(10 + U, 12 + U, (y) => (y - 10 - U === 2 ? [hx - 3, hx - 0.4] : [hx - 3.2, hx + 0.6]), S.mask!, (_x, _y, t, u) => sphere(t * 0.6 - 0.3, u * 0.6 - 0.3, 1));
    c.px(hx + 1, 9 + U, S.mask!, sphere(0.5, -0.6));
    c.px(hx - 2, 10 + U, S.trim, sphere(0, -0.4));
    c.part();
    c.px(hx - 2, 11 + U, p.blink ? S.mask! : S.eyes, sphere(0, 0));
    c.part();
    c.capsule(hx + 1, 12 + U, hx + 2.4, 15.4 + U, 0.5, 0.4, S.trim);
    tricorne(c, hx, U, 'side');
    if (p.sooty) soot(c, [[hx - 3, 12 + U]]);
  } else {
    // Hair swept back, the face in profile, the goggles on the brow.
    c.part();
    c.ellipse(hx + 0.8, 10.6 + U, 3.0, 2.9, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.3, 1) });
    for (const [x, y] of [[hx - 1, 7.4], [hx + 1, 7], [hx + 3, 7.6], [hx + 4, 9]] as const) c.px(x, y + U, S.hair, sphere(0.3, -0.8), { bias: 1 });
    c.part();
    c.ellipse(hx - 0.7, 12.5 + U, 2.4, 2.4, S.skin);
    c.px(hx - 3, 12.8 + U, S.skin, sphere(-0.7, 0.2));
    c.part();
    c.px(hx + 0.6, 12 + U, S.hair, sphere(0.4, 0));
    c.part();
    c.px(hx - 2, 12 + U, p.blink ? S.skin : S.eyes, sphere(0, 0), p.blink ? { bias: -1 } : {});
    c.shade(hx - 2, 14 + U, -2);
    soot(c, [[hx - 1, 13 + U]]);
    if (p.sooty) soot(c, [[hx - 3, 12 + U], [hx - 1, 11 + U]]);
    goggles(c, [hx - 1.8], 9.2 + U, [hx - 2.6, hx + 3], true);
  }

  // Near shoulder and arm, then the epaulette over it.
  arm(c, 'side', 'a', hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.3, 1], p);
  c.part();
  c.ellipse(hx + 0.4, 15.6 + U, 2.0, 1.05, S.trim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.3, 1) });
  for (let x = Math.floor(hx - 2); x <= Math.ceil(hx + 3); x++) if ((x & 1) === 0 && c.materialAt(x, 16 + U) === S.trim) c.shade(x, 16 + U, -1);
  if (p.fuse) groundSparks(c, hx - 6, 30.5, p.fuse);
}

/** Sparks spitting off the battery's fuse on the ground at (x, y) as he lights it. */
function groundSparks(c: PixelCanvas, x: number, y: number, k: number): void {
  const n = k > 1 ? 9 : 6;
  for (let i = 0; i < n; i++) {
    const th = -Math.PI * (0.1 + (i / (n - 1)) * 0.8);
    const r = 1.5 + ((i * 7) % 3) + (k - 1) * 1.5;
    c.spark(x + Math.cos(th) * r, y + Math.sin(th) * r * 0.9, i % 3 === 0 ? [255, 255, 220] : i % 3 === 1 ? [255, 200, 80] : [255, 120, 40], 1.1);
  }
  c.spark(x, y, [255, 255, 255], 1.4);
}

// ---------------------------------------------------------------------------
// Animations

/** At the ready: the candle held up like a torch, the linstock low at his side. */
const HOLD_A = H(2.0, 5.0, -0.8);
const HOLD_B = H(0.8, 5.4, -3.0);
const UP_A = H(0.4, 0.45, 1);
const UP_B = H(0.3, 0.5, 1);

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: { ...HOLD_A },
  b: { ...HOLD_B },
  ta: { ...UP_A },
  tb: { ...UP_B },
  bItem: 'match',
  ember: 0.3,
  flash: 0,
  sway: 0,
});

/** Standing easy, the match smouldering, the candle bobbing. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.a.h += Math.sin(ph) * 0.5;
    p.sway = Math.sin(ph - 1) * 0.4;
    p.ember = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(ph * 2));
    p.blink = f === 4;
    frames.push(p);
  }
  return frames;
}

function walk(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0;
    if (view === 'side') {
      p.footA = Math.round(s * 2.2);
      p.footB = -p.footA;
      p.lean = 1;
      p.sway = 1 + Math.abs(s) * 0.8;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.7;
    }
    p.a = H(2.2 + s * 0.4, 3.4, -0.8 + p.lift * 0.4);
    p.b = H(0.6 - s * 1.6, 4.4, -3.4 + p.lift * 0.4);
    p.ember = 0.35 + 0.15 * Math.abs(s);
    frames.push(p);
  }
  return frames;
}

interface Key {
  a?: Hand;
  b?: Hand;
  ta?: Hand;
  tb?: Hand;
  bItem?: Pose['bItem'];
  lean?: number;
  breath?: number;
  lift?: number;
  step?: number;
  ember?: number;
  flash?: number;
  fuse?: number;
  headY?: number;
}

/** An action as keyframes; anything left out stays at the ready. `step` plants the front foot forward. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k) => {
      const p = base(view);
      if (k.a) p.a = { ...k.a };
      if (k.b) p.b = { ...k.b };
      if (k.ta) p.ta = { ...k.ta };
      if (k.tb) p.tb = { ...k.tb };
      p.bItem = k.bItem ?? 'match';
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
      p.ember = k.ember ?? 0.3;
      p.flash = k.flash ?? 0;
      p.fuse = k.fuse;
      p.headY = k.headY;
      const step = k.step ?? 0;
      if (view === 'side') {
        p.lean = k.lean ?? 0;
        p.footA = 1 + step;
        p.footB = -1 - Math.round(step * 0.5);
        p.sway = Math.max(0, (k.lean ?? 0) * 0.8);
      } else {
        p.footA = step > 0 ? 1 : 0;
        p.sway = (k.lean ?? 0) * -0.4;
      }
      return p;
    });
}

/** The Roman candle: levelled at the foe, a star bursting from its mouth with a kick, then up again. */
const fire = action([
  { a: H(5.2, 1.8, 2.2), ta: H(1, 0, 0.12), lean: 1, step: 1 },
  { a: H(4.2, 2.0, 3.0), ta: H(1, 0, 0.4), lean: 0, step: 1, flash: 1 },
  { a: H(4.8, 1.9, 2.5), ta: H(1, 0, 0.2), lean: 1, step: 1, flash: 0.35 },
  { a: H(3.6, 2.6, 1.0), ta: H(0.8, 0, 0.6), lean: 0 },
]);

/** The firecrackers: a string whipped off the belt, its fuse lit, swung back past the ear and flung. */
const toss = action([
  { b: H(0.6, 4.6, -2.6), tb: H(0, 0.2, -1), bItem: 'string', a: H(2.0, 3.6, -1) },
  { b: H(-1.0, 4.6, 3.5), tb: H(-0.4, 0.3, -1), bItem: 'string', lean: -1, breath: 1, a: H(2.2, 3.4, -0.6) },
  { b: H(-2.4, 4.0, 6), tb: H(-1, 0.2, -0.6), bItem: 'string', lean: -1, a: H(2.4, 3.2, 0) },
  { b: H(5.0, 3.0, 4.6), bItem: 'none', lean: 2, step: 1, a: H(1.6, 3.8, -1.4) },
  { b: H(6.2, 2.6, 1.0), bItem: 'none', lean: 1, step: 1, a: H(1.8, 3.8, -1.2) },
  { b: H(2.4, 4.0, -1.6), lean: 0 },
]);

/**
 * The Special: the linstock raised high and its match blown to a blaze,
 * then a crouch to touch it to the battery's fuse at his feet, and up again
 * to watch the sky.
 */
const finale = action([
  { ember: 0.5 },
  { b: H(1.4, 3.6, 7), tb: H(0.2, 0.2, 1), ember: 1 },
  { b: H(1.0, 3.0, 10.5), tb: H(0.1, 0.1, 1), ember: 1, lift: 1 },
  { b: H(3.6, 3.0, 4), tb: H(1, 0.1, 0.3), ember: 1, breath: 1 },
  { b: H(5.0, 3.4, -3.0), tb: H(1, 0.7, -0.9), ember: 1, breath: 2, lean: 2, step: 1 },
  { b: H(4.8, 3.4, -3.2), tb: H(1, 0.7, -0.9), ember: 0.8, breath: 2, lean: 2, step: 1, fuse: 1 },
  { b: H(2.0, 3.8, -1), a: H(2.6, 3.4, 1.4), ember: 0.6, headY: -1, fuse: 2 },
  { b: H(1.0, 3.0, 9), tb: H(0.3, 0.3, 1), a: H(2.4, 3.6, -0.6), ember: 0.5, headY: -1 },
]);

// ---------------------------------------------------------------------------
// The idle moment (`rest`), facing the viewer only

/** A pose from the stand (idle frame 0) with the given changes. */
const from = (k: Partial<Pose>): Pose => ({ ...idle('down')[0], ...k });

/** Peering into the candle's mouth from below his left eye. */
const PEER_A = H(1.0, 5.6, 4.4);
const PEER_T = H(0.3, -0.6, 0.8);

/**
 * The dud: he lifts the Roman candle, frowns at it, peers into its mouth and
 * shakes it, peers again, and it goes off in his face with a bang of sparks.
 * He reels, blinking through the smoke, shakes his head clear, wipes his
 * sooty cheek and grins.
 */
const REST: Pose[] = [
  from({}),
  from({ a: H(2.2, 3.0, 3.2), ta: H(0.2, -0.3, 1), headX: -1 }),
  from({ a: { ...PEER_A }, ta: { ...PEER_T }, headX: -1 }),
  from({ a: H(1.2, 5.0, 4.0), ta: H(0.3, -0.2, 1), sway: 0.2 }),
  from({ a: H(1.2, 6.0, 5.0), ta: H(0.3, -1, 0.5), sway: -0.2 }),
  from({ a: { ...PEER_A }, ta: { ...PEER_T }, headX: -1, headY: 1 }),
  from({ a: { ...PEER_A }, ta: { ...PEER_T }, pop: 1, flash: 0.6, headY: -1, lift: 1, blink: true, sooty: true }),
  from({ a: H(2.2, 3.8, 0.4), pop: 2, blink: true, headX: 1, sooty: true }),
  from({ a: H(2.2, 3.6, -0.2), pop: 3, headX: 1, sooty: true }),
  from({ a: H(2.2, 3.6, -0.2), headX: -1, sooty: true }),
  from({ b: H(1.8, 1.6, 4.4), tb: H(0, 0.6, -1), headX: -1, sooty: true }),
  from({ breath: 1, sway: 0.3, sooty: true }),
];

/** Which pose plays at each step. */
const REST_ORDER = [0, 1, 1, 2, 2, 3, 4, 3, 4, 5, 5, 5, 6, 7, 7, 8, 9, 8, 10, 10, 10, 11, 11, 0];

function rest(view: View): Pose[] {
  return view === 'down' ? REST : [];
}

// ---------------------------------------------------------------------------
// Frame generation

export type PyroAnim = 'idle' | 'walk' | 'fire' | 'toss' | 'finale' | 'rest';

export interface PyroAnimDef {
  name: PyroAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Frame indices to play in sequence, when some are held or repeated. */
  order?: readonly number[];
}

export const PYRO_ANIMS: PyroAnimDef[] = [
  { name: 'idle', fps: 7, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'fire', fps: 14, loop: false, poses: fire },
  { name: 'toss', fps: 14, loop: false, poses: toss },
  { name: 'finale', fps: 10, loop: false, poses: finale },
  { name: 'rest', fps: REST_FPS, loop: false, poses: rest, order: REST_ORDER },
];

/** Each move's frame count and rate, and the frame its star or string leaves the hand on. */
export const PYRO_MOVES = {
  fire: { frames: 4, fps: 14, release: 1 },
  toss: { frames: 6, fps: 14, release: 3 },
} as const;

export interface PyroFrame {
  key: string;
  anim: PyroAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(PYRO_W, PYRO_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildPyroFrames(look: PyroLook = VERMILION_LOOK): PyroFrame[] {
  S = look;
  const out: PyroFrame[] = [];
  for (const a of PYRO_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawFrame(dir, pose) });
      });
    }
  }
  S = VERMILION_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Button icons (16x16, outlined, lit from the top left)

const css = (c: RGB): string => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const INK = '#0c0806';

/** The attack: a striped Roman candle aimed up and right, a star bursting from its mouth and two more flying ahead. */
export function candleIcon(look: PyroLook = VERMILION_LOOK): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const [a, b] = look.candle.map((m) => [css(m.ramp[m.ramp.length - 1]), css(m.ramp[m.ramp.length - 2]), css(m.ramp[1])]);
  // The tube, butt at the lower left, in bands of its two papers.
  for (let i = 0; i <= 8; i++) {
    const x = 2 + i;
    const y = 13 - i;
    const band = Math.floor(i / 2) % 2 ? b : a;
    put(x, y, band[1]);
    put(x - 1, y, band[0]);
    put(x, y + 1, band[2]);
  }
  outline(INK);
  put(10, 4, '#2a1a10');
  // The stars: one bursting at the mouth, two flying on.
  const [s0, s1, s2] = look.stars;
  const burst = (x: number, y: number, st: [RGB, RGB, RGB, RGB], big: boolean) => {
    put(x, y, css(st[0]));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(x + dx, y + dy, css(st[1]));
    if (big) for (const [dx, dy] of [[2, -2], [-2, 2], [2, 2], [-2, -2]] as const) put(x + dx, y + dy, css(st[2]));
  };
  burst(12, 3, s0, true);
  burst(14, 9, s1, false);
  burst(6, 1, s2, false);
  return px;
}

/** The ability: a string of red firecrackers on a braided fuse, its end spitting sparks, and one going off in a bang. */
export function crackerIcon(look: PyroLook = VERMILION_LOOK): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const red = ['#ec6040', '#c8301e', '#8a1612'];
  const gold = '#f8d870';
  // The crackers in pairs down the fuse, a slant from the top left.
  for (let i = 0; i < 5; i++) {
    const cx = 3 + i * 2;
    const cy = 3 + i * 2;
    for (const k of [-1, 1]) {
      const x = cx + (k < 0 ? -1 : 1);
      const y = cy + (k < 0 ? 1 : -1);
      put(x, y, red[0]);
      put(x + 1, y, red[1]);
      put(x, y + 1, red[2]);
      put(x + 1, y + 1, red[2]);
    }
  }
  outline(INK);
  // The fuse down the middle, gold caps on each.
  for (let i = 0; i < 11; i++) put(2 + i, 2 + i, '#3a2c20');
  for (let i = 0; i < 5; i++) put(3 + i * 2, 1 + i * 2, gold);
  // The spitting end, and a bang in the star colours.
  const st = look.stars[0];
  put(13, 13, css(st[0]));
  put(14, 14, css(st[1]));
  put(14, 12, css(st[2]));
  put(12, 14, css(st[2]));
  put(15, 15, css(st[1]));
  const st2 = look.stars[1];
  put(13, 1, css(st2[0]));
  put(12, 1, css(st2[1]));
  put(14, 1, css(st2[1]));
  put(13, 0, css(st2[1]));
  put(13, 2, css(st2[1]));
  put(11, 3, css(st2[2]));
  put(15, 3, css(st2[2]));
  return px;
}

/** Every button icon by texture key, for textures.ts to register. */
export function pyroIcons(): [string, Uint8ClampedArray][] {
  return PYRO_LOOKS.flatMap((look) => {
    const sfx = look.key.slice('pyrotechnist'.length);
    return [
      [`icon_candle${sfx}`, candleIcon(look)],
      [`icon_crackers${sfx}`, crackerIcon(look)],
    ] as [string, Uint8ClampedArray][];
  });
}
