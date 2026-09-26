// The bard, drawn procedurally from a small rig like the necromancer's.
//
// The minstrel: a troubadour in a teal doublet with gold buttons and puffed
// wine sleeves, cream hose and tall brown boots, a wine half-cape over one
// shoulder, chestnut hair to the shoulders under a tilted cap with a long
// white plume. He always has his lute in hand, its honey-wood belly at his
// hip and its neck across his chest; the strumming hand sweeps the strings
// and light spills off them as notes.
//
// The war drummer is the bard's other type on the same rig: broad and bare-
// armed, a fur mantle on the shoulders, a bronze helm with two short horns,
// red war paint across the eyes and a braided ginger beard. A war drum hangs
// at his belly from a strap, red-lacquered with bronze rims and rope lacing,
// and he beats it with two padded mallets; each blow lights the drum's head.
//
// The wildsong minstrel is a skin of the minstrel: a wanderer out of the deep
// wood, face lost in a moss-green hood with two lamps of light for eyes, twigs
// sprouting from its crown, a bark-brown tunic under a full cloak whose hem
// is cut like leaves, a vine belt hung with little brass chimes, and a lute
// grown rather than carved, pale living wood with leaves budding at its head.
// Two wisps of forest light drift round him wherever he goes.
//
// The body keeps to the 24x32 box; frames are larger so the mallets can be
// raised overhead and the plume can stream back. Hands are posed in the
// bard's own terms (forward, out to the side, height) and placed per view.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { BONE, BOOT, EYE, GOLD, LEATHER, SKIN } from './palette';
import { iconPainter } from './effects';
import { DIRS, type Dir } from './wizard';

export const BARD_W = 48;
export const BARD_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const BARD_ORIGIN_X = BODY_X + 12;
export const BARD_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet that notes leave the lute at. */
export const NOTE_H = 13;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#120e1f');

// ---------------------------------------------------------------------------
// Materials

const DOUBLET: Material = { ramp: ramp('#0c2430', '#143e50', '#1d6076', '#2c889c', '#4cb2bc'), outline: INK, outlineLit: hex('#0e2a38') };
const WINE: Material = { ramp: ramp('#240812', '#421022', '#6a1a34', '#922846', '#b84660'), outline: INK, outlineLit: hex('#2c0a18') };
const SHIRT: Material = { ramp: ramp('#6a6258', '#a89e8a', '#d8d0bc', '#f6f0e0'), outline: hex('#221c18') };
const HOSE: Material = { ramp: ramp('#5a4e44', '#8a7c68', '#b8a88c', '#dccdae'), outline: INK };
const TALL_BOOT: Material = { ramp: ramp('#1e120c', '#3a2216', '#583420', '#7a4a2c'), outline: INK };
const CHESTNUT: Material = { ramp: ramp('#26120a', '#442214', '#683820', '#8e5432'), outline: hex('#140a08'), outlineLit: hex('#2a140c') };
const PLUME: Material = { ramp: ramp('#8a8698', '#c2c0cc', '#e8e6ea', '#ffffff'), outline: hex('#2a2634'), outlineLit: hex('#4a4658') };
const LUTE: Material = { ramp: ramp('#2e1406', '#5a2c10', '#8a4a1c', '#b87030', '#e0a050'), outline: hex('#1a0c06'), shine: true };
const ROSEWOOD: Material = { ramp: ramp('#160a08', '#2e1610', '#4a2418', '#663424'), outline: hex('#0a0404') };
const HOLE: Material = { ramp: ramp('#0a0404', '#140806'), outline: hex('#0a0404'), noAO: true, noOutline: true };
const STRING: Material = { ramp: ramp('#8a8070', '#c8bea8', '#f4ecd8'), outline: hex('#1a0c06'), noOutline: true, noAO: true };

const FUR: Material = { ramp: ramp('#2a2018', '#46382a', '#665440', '#8a7658', '#a8946e'), outline: hex('#140e0a'), outlineLit: hex('#241a12') };
const BRONZE: Material = { ramp: ramp('#2a140a', '#522c14', '#7e4c22', '#a8743a', '#d0a060'), outline: hex('#140a04'), shine: true };
const IRON: Material = { ramp: ramp('#18181f', '#2c2c36', '#44444f', '#62626e', '#8e8e9a'), outline: hex('#0a0a0e'), shine: true };
const VEST: Material = { ramp: ramp('#1c100c', '#321c14', '#4c2c1e', '#664030'), outline: INK };
const WARPAINT: Material = { ramp: ramp('#5a0a0e', '#8a1418', '#b82024'), outline: hex('#2a0406'), noOutline: true };
const GINGER: Material = { ramp: ramp('#4a1a0a', '#7a3012', '#aa4c1c', '#d0703a'), outline: hex('#1e0a04'), outlineLit: hex('#34120a') };
const KILT: Material = { ramp: ramp('#1e0e0c', '#3a1814', '#5c2820', '#7a3a2c'), outline: INK };
const LACQUER: Material = { ramp: ramp('#2a0608', '#4e0c10', '#7a1618', '#a42420', '#c8402e'), outline: hex('#140204'), shine: true };
const HIDE: Material = { ramp: ramp('#8a7a5c', '#b8a480', '#dccaa2', '#f4e6c4'), outline: hex('#3a2a18') };
const ROPE: Material = { ramp: ramp('#8a7a5a', '#c8b88e', '#ece0bc'), outline: hex('#3a2a18'), noOutline: true };
const MALLET: Material = { ramp: ramp('#5a1a14', '#8a2a1e', '#b8482e', '#d8704a'), outline: hex('#1e0806') };
const HANDLE: Material = { ramp: ramp('#2a1810', '#4a2e1c', '#6e4a2c', '#906a42'), outline: hex('#140a06') };

// The wildsong minstrel.
const MOSS: Material = { ramp: ramp('#0a1a10', '#14301c', '#22482a', '#34663a', '#50884a'), outline: hex('#08120a'), outlineLit: hex('#0e2414') };
const BARK: Material = { ramp: ramp('#1c120c', '#322218', '#4a3422', '#664a30', '#846442'), outline: INK };
const LEAF: Material = { ramp: ramp('#2a5222', '#447e30', '#6aac44', '#9ed866'), outline: hex('#10200c') };
const ROOT: Material = { ramp: ramp('#160e0a', '#281c12', '#3c2c1c', '#524028'), outline: INK };
const SAGE: Material = { ramp: ramp('#34443a', '#566c5a', '#7e9a7c', '#aac4a0'), outline: hex('#121a14'), outlineLit: hex('#22302a') };
const BIRCH: Material = { ramp: ramp('#3a2c16', '#6a542c', '#9a7e48', '#c8ac6c', '#ecdc9e'), outline: hex('#1a1208'), shine: true };
const BRANCH: Material = { ramp: ramp('#120e08', '#241c10', '#382c1a', '#4e4026'), outline: hex('#080604') };
/** The dark inside the hood. */
const HOOD_DARK: Material = { ramp: ramp('#040806', '#08100c'), outline: hex('#040806'), noAO: true, noOutline: true };

/** What the minstrel wears, by part. */
interface Dress {
  /** Doublet or tunic. */
  coat: Material;
  /** Sleeve puffs, cape (or cloak) and cap (or hood). */
  cloak: Material;
  /** Cuffs and collar (the wildsong's leaf trim). */
  cuff: Material;
  hose: Material;
  boot: Material;
  hand: Material;
  /** The lute's belly and its neck. */
  lute: Material;
  neck: Material;
}

const TROUBADOUR: Dress = { coat: DOUBLET, cloak: WINE, cuff: SHIRT, hose: HOSE, boot: TALL_BOOT, hand: SKIN, lute: LUTE, neck: ROSEWOOD };
const WILDWOOD: Dress = { coat: BARK, cloak: MOSS, cuff: LEAF, hose: ROOT, boot: ROOT, hand: SAGE, lute: BIRCH, neck: BRANCH };

/** One look for the bard: its texture key, its instrument, and the light of its music. */
export interface BardLook {
  key: string;
  /** The war drummer, with his drum and mallets, rather than the minstrel with his lute. */
  drum: boolean;
  /** The minstrel's clothes. */
  dress: Dress;
  /** The wildsong: hooded, cloaked in moss, wisps drifting round him. */
  wild?: boolean;
  /** Light of the music, brightest first. */
  light: [RGB, RGB, RGB, RGB];
}

export const MINSTREL_LOOK: BardLook = {
  key: 'bard',
  drum: false,
  dress: TROUBADOUR,
  light: [hex('#f4fffc'), hex('#a8fff0'), hex('#3fd8c8'), hex('#1a7a8a')],
};

/** The minstrel's wildsong skin: firefly light, gold-green. */
export const WILD_LOOK: BardLook = {
  key: 'bard_wild',
  drum: false,
  dress: WILDWOOD,
  wild: true,
  light: [hex('#fffde6'), hex('#eaffa0'), hex('#9ee85a'), hex('#2e7a3e')],
};

export const DRUMMER_LOOK: BardLook = {
  key: 'bard_drum',
  drum: true,
  dress: TROUBADOUR,
  light: [hex('#fffbe8'), hex('#ffd98a'), hex('#ff9a3a'), hex('#b8401e')],
};

export const BARD_LOOKS = [MINSTREL_LOOK, DRUMMER_LOOK, WILD_LOOK];

/** The look being drawn; set by buildBardFrames. */
let S: BardLook = MINSTREL_LOOK;
/** Its clothes. */
let D: Dress = TROUBADOUR;

// ---------------------------------------------------------------------------
// The rig

/** A hand, in the bard's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

export interface Pose {
  /** Whole body raised (walk passing frames, a hop on the beat). */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The strumming hand (or the right mallet) and the hand on the lute's neck (or the left mallet). */
  a: Hand;
  b: Hand;
  /** The mallets: 0 pointing down onto the drum's head, 1 raised high. */
  stickA: number;
  stickB: number;
  /** 0..1 the instrument lit with music. */
  glow: number;
  /** The cape or kilt swinging, in pixels. */
  sway: number;
  tick: number;
  blink?: boolean;
}

type View = 'down' | 'up' | 'side';

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
  // Facing left; `a` is the far arm, a touch higher and behind the body.
  const far = arm === 'a';
  return { x: hx - 1 - q.f * 1.05 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), behind: far && q.f < 1 };
}

/** Light off the strings or the drum: a small cross of it, the arms growing with `k`. */
function glowAt(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.light;
  c.spark(x, y, core, k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + dx, y + dy, hot, 0.6 * k);
  if (k > 0.6) for (const [dx, dy] of [[2, 0], [-2, 0], [0, -2], [1, -1], [-1, -1]]) c.spark(x + dx, y + dy, mid, 0.4 * k);
}

/** Two bones from the shoulder to the hand, the elbow on the side `hint` points. */
function elbow(sx: number, sy: number, fx: number, fy: number, reach: number, hint: [number, number]): [number, number] {
  const dx = fx - sx;
  const dy = fy - sy;
  const d = Math.hypot(dx, dy) || 0.01;
  let ex = sx + dx / 2;
  let ey = sy + dy / 2;
  if (d < reach * 2) {
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
  return [ex, ey];
}

/** The minstrel's arm: a puffed, slashed wine sleeve, a teal forearm, a cream cuff and the hand (in his dress's colours). */
function sleevedArm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bias = 0): void {
  const [ex, ey] = elbow(sx, sy, p.x, p.y, reach, hint);
  c.part();
  c.capsule(sx, sy, ex, ey, 2.0, 1.6, D.cloak, { bias });
  // A slash of the doublet down the puff (the wildsong's is all cloak).
  if (!S.wild) {
    c.part();
    c.px((sx + ex) / 2, (sy + ey) / 2, D.coat, sphere(0, -0.2), { bias: bias + 1 });
  }
  c.part();
  const wx = ex + (p.x - ex) * 0.8;
  const wy = ey + (p.y - ey) * 0.8;
  c.capsule(ex, ey, wx, wy, 1.35, 1.2, D.coat, { bias });
  c.part();
  c.ellipse(wx, wy, 1.25, 1.1, D.cuff, { bias });
  c.part();
  c.ellipse(p.x, p.y, 1.15, 1.1, D.hand, { bias });
}

/** The drummer's arm: bare and heavy, a leather bracer on the forearm, a mallet in the fist. */
function bareArm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bias = 0): void {
  const [ex, ey] = elbow(sx, sy, p.x, p.y, reach, hint);
  c.part();
  c.capsule(sx, sy, ex, ey, 1.9, 1.5, SKIN, { bias });
  c.part();
  c.capsule(ex + (p.x - ex) * 0.3, ey + (p.y - ey) * 0.3, p.x, p.y, 1.45, 1.35, VEST, { bias });
  c.part();
  c.ellipse(p.x, p.y, 1.25, 1.2, SKIN, { bias });
}

/** Which way a mallet points from the fist, for `k` from 0 (onto the drum) to 1 (raised). */
function stickDir(view: View, arm: 'a' | 'b', k: number): [number, number] {
  if (view === 'side') {
    const t = ((123 + 164 * k) * Math.PI) / 180;
    return [Math.cos(t), Math.sin(t)];
  }
  // From the front (and the back): down and in onto the drum, round through outward, up and out.
  let t = ((72 + 178 * k) * Math.PI) / 180;
  if (arm === 'b') t = Math.PI - t;
  return [Math.cos(t), Math.sin(t)];
}

/** A mallet in the fist: a short wooden handle and a padded red head, lit on the beat. */
function mallet(c: PixelCanvas, view: View, arm: 'a' | 'b', p: Placed, k: number, glow: number, bias = 0): void {
  const [ux, uy] = stickDir(view, arm, k);
  const len = 5.2;
  c.part();
  c.line(p.x - ux * 0.8, p.y - uy * 0.8, p.x + ux * len, p.y + uy * len, HANDLE, () => sphere(-uy * 0.5, ux * 0.5 - 0.3), { bias });
  c.part();
  const hx = p.x + ux * (len + 0.6);
  const hy = p.y + uy * (len + 0.6);
  c.ellipse(hx, hy, 1.35, 1.3, MALLET, { bias });
  if (glow > 0 && k < 0.35) glowAt(c, hx, hy, glow * 0.7);
}

/** Legs in hose (or dark wraps) from the hip to the ankle. */
function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  c.part();
  c.capsule(hx, hy, fx, fy, 1.55, 1.3, S.drum ? KILT : D.hose, { bias });
}

/** The minstrel's tall boot with a turned cuff; the drummer's boot wrapped in fur. */
function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x, y, 2.2, 1.2, S.drum ? BOOT : D.boot, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.6, 1.3, S.drum ? BOOT : D.boot, { flatten: 0.8, bias });
  c.part();
  const w = side ? 1.6 : 1.8;
  const top = Math.round(y - 2.4);
  if (S.drum) {
    // A ruff of fur round the ankle.
    c.shape(top, top + 1, () => [x - w - 0.2, x + w + 0.2], FUR, (_x, _y, t, u) => sphere(t * 0.8, u - 0.6, 1), { bias: bias + 1 });
    c.shade(x - 1, top + 1, -1);
  } else {
    c.shape(top - 1, top, () => [x - w, x + w], D.boot, (_x, _y, t) => cyl(t, 0.3), { bias: bias + 1 });
  }
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) c.px(x, y, SKIN, sphere(0, -0.3), { bias: -1 });
    else c.px(x, y, EYE);
  }
}

// ---------------------------------------------------------------------------
// The lute

/**
 * The lute: a pear-shaped honey-wood belly at the strumming hand with a dark
 * sound hole, strings running up a rosewood neck to the other hand, and a
 * pegbox bent back at its end. Light spills off the strings as he plays.
 */
function drawLute(c: PixelCanvas, view: View, p: Pose, fa: Placed, fb: Placed, bias = 0): void {
  const bx = fa.x + (view === 'side' ? -0.3 : 0.9);
  const by = fa.y + 0.6;
  let ux = fb.x - bx;
  let uy = fb.y - by;
  const l = Math.hypot(ux, uy) || 1;
  ux /= l;
  uy /= l;
  const vx = -uy;
  const vy = ux;
  // The neck and its pegbox first, so the belly overlaps its root.
  const n0 = 3.2;
  const n1 = 10.5;
  c.part();
  c.capsule(bx + ux * n0, by + uy * n0, bx + ux * n1, by + uy * n1, 0.8, 0.7, D.neck, { bias });
  // The pegbox bends back from the neck, two gold pegs at its sides.
  const ex = bx + ux * n1;
  const ey = by + uy * n1;
  const bend = view === 'side' ? 1 : -1;
  const px = ux * 0.35 + vx * 0.94 * bend;
  const py = uy * 0.35 + vy * 0.94 * bend;
  c.part();
  c.capsule(ex, ey, ex + px * 2.6, ey + py * 2.6, 0.85, 0.7, D.neck, { bias });
  c.part();
  if (S.wild) {
    // The wildsong's lute is still growing: leaves bud where the pegs would be, and a bud of light at its tip.
    c.px(ex + px * 1.2 - ux * 1.2, ey + py * 1.2 - uy * 1.2, LEAF, sphere(-0.3, -0.5), { bias });
    c.px(ex + px * 1.2 - ux * 2.1, ey + py * 1.2 - uy * 2.1, LEAF, sphere(-0.5, -0.2), { bias });
    c.px(ex + px * 2.2 + ux * 1.2, ey + py * 2.2 + uy * 1.2, LEAF, sphere(0.3, -0.5), { bias });
    c.px(ex + px * 3.2 + ux * 0.4, ey + py * 3.2 + uy * 0.4, LEAF, sphere(0, -0.6), { bias });
    c.spark(ex + px * 3.4 + ux * 0.4, ey + py * 3.4 + uy * 0.4, S.light[1], 0.55 + p.glow * 0.45);
  } else {
    c.px(ex + px * 1.2 - ux * 1.1, ey + py * 1.2 - uy * 1.1, GOLD, sphere(0, -0.4), { bias });
    c.px(ex + px * 2.2 + ux * 1.1, ey + py * 2.2 + uy * 1.1, GOLD, sphere(0, -0.4), { bias });
  }

  // The belly: a round bowl with a narrower shoulder towards the neck.
  c.part();
  for (let y = Math.floor(by - 5); y <= Math.ceil(by + 5); y++) {
    for (let x = Math.floor(bx - 5); x <= Math.ceil(bx + 5); x++) {
      const dx = x + 0.5 - bx;
      const dy = y + 0.5 - by;
      const u = dx * ux + dy * uy;
      const v = dx * vx + dy * vy;
      const bowl = (u * u) / (3.8 * 3.8) + (v * v) / (3.3 * 3.3) <= 1;
      const shoulder = ((u - 2.4) * (u - 2.4)) / (2.6 * 2.6) + (v * v) / (2.2 * 2.2) <= 1;
      if (bowl || shoulder) c.px(x, y, D.lute, sphere(dx / 4, dy / 3.7, 1), { bias });
    }
  }
  // The rosette, the bridge, and the strings between them.
  const hx = bx + ux * 1.1;
  const hy = by + uy * 1.1;
  c.part();
  c.line(bx - ux * 2.2, by - uy * 2.2, bx + ux * (n0 + 0.6), by + uy * (n0 + 0.6), STRING, () => sphere(0, -0.3), { bias });
  c.part();
  c.px(hx, hy, HOLE);
  c.px(hx + vx * 0.9, hy + vy * 0.9, HOLE);
  c.part();
  c.px(bx - ux * 2.4 + vx * 0.5, by - uy * 2.4 + vy * 0.5, D.neck, sphere(0, -0.3), { bias });
  if (S.wild) {
    // The rosette glows softly from within, and a vine curls round the bowl.
    c.spark(hx, hy, S.light[2], 0.35 + p.glow * 0.4);
    c.part();
    for (const [du, dv] of [[-3.2, -1.4], [-2.2, -2.6], [-0.8, -3.2], [2.2, 2.4]] as const) {
      c.px(bx + ux * du + vx * dv, by + uy * du + vy * dv, LEAF, sphere(dv * 0.2, -0.4), { bias });
    }
  }
  if (p.glow > 0) {
    // Light off the strings, brightest where they're struck.
    glowAt(c, bx - ux * 0.6, by - uy * 0.6, p.glow);
    const [, hot, mid] = S.light;
    for (let i = 1; i <= 4; i++) c.spark(bx + ux * (i * 1.6), by + uy * (i * 1.6), i < 3 ? hot : mid, p.glow * (0.7 - i * 0.12));
  }
}

// ---------------------------------------------------------------------------
// The drum

/**
 * The war drum at the belly: a red-lacquered shell laced with rope between
 * two bronze rims, its hide head seen from above, lit when it's struck.
 */
function drawDrum(c: PixelCanvas, cx: number, top: number, rx: number, glow: number, bias = 0): void {
  const bot = top + 4.4;
  c.part();
  c.shape(Math.round(top), Math.round(bot), () => [cx - rx, cx + rx], LACQUER, (_x, _y, t) => cyl(t, 0.1), { bias });
  // The bottom rim, curving with the shell.
  c.part();
  for (let x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++) {
    const t = (x + 0.5 - cx) / rx;
    if (Math.abs(t) > 1) continue;
    c.px(x, Math.round(bot) + Math.round((1 - t * t) * 0.9), BRONZE, cyl(t, 0.4), { bias });
  }
  // Rope laced in a zigzag round the shell.
  c.part();
  for (let x = Math.floor(cx - rx) + 1; x < Math.ceil(cx + rx) - 1; x++) {
    const k = Math.abs((((x - Math.floor(cx - rx)) % 4) + 4) % 4 - 2);
    c.px(x, Math.round(top) + 1 + k, ROPE, sphere((x + 0.5 - cx) / rx, 0), { bias });
  }
  // The head: a bronze hoop round a pale hide.
  c.part();
  c.ellipse(cx, top, rx + 0.4, 1.9, BRONZE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.3 - 0.8, 1), bias });
  c.part();
  c.ellipse(cx, top - 0.1, rx - 0.7, 1.25, HIDE, { normal: (_x, _y, dx) => sphere(dx * 0.3, -0.9, 1), bias });
  if (glow > 0) {
    const [core, hot, mid] = S.light;
    c.spark(cx, top, core, glow);
    for (let i = 1; i <= Math.round(rx - 1); i++) {
      c.spark(cx - i, top, i < 2 ? hot : mid, glow * (0.8 - i * 0.12));
      c.spark(cx + i, top, i < 2 ? hot : mid, glow * (0.8 - i * 0.12));
    }
    c.spark(cx, top - 1, hot, glow * 0.5);
    c.spark(cx, top + 1, mid, glow * 0.4);
  }
}

// ---------------------------------------------------------------------------
// Heads

/** The minstrel's cap from the front: a tilted wine crown on a wide brim, a gold band, a white plume sweeping back. */
function capDown(c: PixelCanvas, cx: number, U: number, t: number): void {
  c.part();
  c.ellipse(cx + 0.4, 9.8 + U, 5.5, 1.7, WINE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.4 - 0.7, 1) });
  // The brim's shadow on the brow.
  for (let x = cx - 3; x <= cx + 3; x++) c.shade(x, 11 + U, -1);
  c.part();
  c.ellipse(cx + 1.2, 7.6 + U, 3.7, 2.3, WINE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  c.part();
  c.shape(Math.round(9 + U), Math.round(9 + U), () => [cx - 2.4, cx + 4.6], GOLD, (_x, _y, tt) => cyl(tt, 0.2));
  plume(c, cx + 3.4, 8.2 + U, 1, t);
}

/** The long plume from the band, arching up and back, its tip stirring. */
function plume(c: PixelCanvas, x: number, y: number, dir: number, t: number): void {
  const flick = [0, 0.4, 0.6, 0.3, 0, -0.2][t % 6];
  c.part();
  for (let i = 0; i <= 14; i++) {
    const k = i / 14;
    const px = x + dir * (k * 6.6);
    const py = y - Math.sin(k * 2.5) * 5.2 + k * k * 2.6 + (k > 0.6 ? flick * (k - 0.6) * 2.5 : 0);
    c.px(px, py, PLUME, sphere(dir * 0.3, -0.7 + k * 0.8), { bias: k > 0.85 ? -1 : 0 });
    if (k < 0.8) c.px(px, py + 1, PLUME, sphere(dir * 0.2, 0.3 + k * 0.5), { bias: k > 0.5 ? -1 : 0 });
    if (k > 0.15 && k < 0.55) c.px(px - dir, py - 1, PLUME, sphere(dir * 0.1, -0.9), { bias: 1 });
  }
}

/** The drummer's helm from the front: a bronze cap riveted at the brow, two short horns curving up. */
function helmDown(c: PixelCanvas, cx: number, U: number): void {
  for (const s of [-1, 1]) {
    c.part();
    c.capsule(cx + s * 3.4, 9.6 + U, cx + s * 5.2, 7.6 + U, 0.95, 0.7, BONE);
    c.part();
    c.capsule(cx + s * 5.2, 7.6 + U, cx + s * 5.4, 5.8 + U, 0.7, 0.4, BONE);
  }
  c.part();
  c.shape(Math.round(6.5 + U), Math.round(9 + U), (y) => {
    const u = (y - 6.5 - U) / 2.5;
    const hw = 2.4 + Math.sqrt(Math.max(0, u)) * 1.5;
    return [cx - hw, cx + hw];
  }, IRON, (_x, _y, t, u) => sphere(t * 0.9, u * 0.7 - 0.5, 1));
  c.part();
  c.shape(Math.round(9.5 + U), Math.round(9.5 + U), () => [cx - 4.2, cx + 4.2], BRONZE, (_x, _y, t) => cyl(t, 0.3), { bias: -1 });
  // A ridge down the middle and rivets on the brow band.
  c.shade(cx, 7 + U, 1);
  c.shade(cx, 8 + U, 1);
  for (const x of [cx - 3, cx + 2]) c.shade(x, 10 + U, 2);
}


// ---------------------------------------------------------------------------
// The wildsong

/** A leaf-cut hem under row `y`: scallops hanging off every filled pixel, a lighter leaf tip on some. */
function leafHem(c: PixelCanvas, x0: number, x1: number, y: number, bias = 0): void {
  c.part();
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (!c.filled(x, y)) continue;
    const k = ((x % 3) + 3) % 3;
    if (k !== 2) c.px(x, y + 1, MOSS, sphere(0, 0.6), { bias });
    if (k === 1) c.px(x, y + 2, LEAF, sphere(0, 0.5), { bias: bias - 1 });
  }
}

/** A twig sprouting from the hood's crown, forked, a leaf at each tip; `s` is the side it leans to. */
function twig(c: PixelCanvas, x: number, y: number, s: number, bias = 0): void {
  c.part();
  c.line(x, y, x + s * 1.6, y - 3.4, BRANCH, () => sphere(s * 0.3, -0.5), { bias });
  c.line(x + s * 0.9, y - 1.7, x + s * 2.5, y - 2.3, BRANCH, () => sphere(s * 0.3, -0.5), { bias });
  c.part();
  c.px(x + s * 1.9, y - 4.4, LEAF, sphere(s * 0.3, -0.7), { bias });
  c.px(x + s * 3.2, y - 2.8, LEAF, sphere(s * 0.5, -0.4), { bias });
}

/** Brass chimes hanging from the belt, each catching the light in turn. */
function chimes(c: PixelCanvas, xs: number[], y: number, tick: number): void {
  c.part();
  xs.forEach((x, i) => {
    const len = i % 2 ? 3 : 2;
    for (let j = 0; j < len; j++) c.px(x, y + j, GOLD, sphere(0, -0.3 + j * 0.3), { bias: 1 });
    c.spark(x, y + len - 1, S.light[0], (tick + i * 2) % 3 === 0 ? 0.55 : 0.15);
  });
}

/** Two lamps of light in the dark of the hood (dark for a blink). */
function hoodEyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  if (blink) return;
  const [core, hot] = S.light;
  for (const [x, y] of pts) {
    c.spark(x, y, core, 1);
    c.spark(x, y + 1, hot, 0.25);
  }
}

/** The hood from the front: falling onto the shoulders, peaked at the crown, twigs sprouting, the face lost in its dark. */
function hoodDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  c.part();
  c.capsule(cx - 3.4, 12 + U, cx - 4.0, 15.6 + U, 1.5, 1.1, MOSS);
  c.capsule(cx + 3.4, 12 + U, cx + 4.0, 15.6 + U, 1.5, 1.1, MOSS);
  hoodCrown(c, cx, U, 0);
  twig(c, cx - 2.2, 8.4 + U, -1);
  twig(c, cx + 2.4, 8.2 + U, 1);
  c.part();
  c.ellipse(cx - 0.2, 12.7 + U, 3.0, 2.7, LEAF, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6 - 0.3, 1) });
  c.part();
  c.ellipse(cx - 0.2, 13.0 + U, 2.3, 2.1, HOOD_DARK);
  // The rim's lower edge falls into shadow.
  for (let x = cx - 2; x <= cx + 1; x++) c.shade(x, 15 + U, -1);
  hoodEyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
}

/** The hood's round, with a soft peak at the crown. */
function hoodCrown(c: PixelCanvas, cx: number, U: number, lean: number): void {
  c.part();
  c.ellipse(cx, 11.4 + U, 4.5, 4.2, MOSS, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + lean, dy * 0.8 - 0.2, 1) });
  c.part();
  c.shape(Math.round(6 + U), Math.round(7 + U), (y) => {
    const hw = y === Math.round(6 + U) ? 0.8 : 1.9;
    return [cx - hw + 0.4, cx + hw + 0.4];
  }, MOSS, (_x, _y, t) => sphere(t * 0.8, -0.8, 1));
}

/** The full cloak seen from the front: behind him on both sides, down to a leaf-cut hem. */
function wildCloakBehind(c: PixelCanvas, cx: number, U: number, L: number, sway: number): void {
  const top = 15 + U;
  const hem = 26 + L;
  c.part();
  c.shape(top, hem, (y) => {
    const u = (y - top) / (hem - top);
    return [cx - 5.4 - u * 1.2 + u * sway, cx + 5.4 + u * 1.2 + u * sway];
  }, MOSS, (_x, _y, t, u) => sphere(t * 0.9, u * 0.4, 1), { bias: -1 });
  leafHem(c, cx - 8, cx + 8, hem, -1);
}

/** The wildsong from the front: a bark tunic, a vine belt with chimes, the cloak over his shoulders, the hood. */
function wildDown(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 24.5 + L;
  c.part();
  c.shape(top, Math.round(hem), (y) => {
    const hw = y <= waist ? 4.5 - 0.5 * ((y + 0.5 - top) / (waist - top)) ** 2 : 4.1 + (y - waist) * 0.55;
    return [cx - hw, cx + hw];
  }, BARK, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
  for (let y = waist + 1; y <= hem; y++) {
    c.shade(cx - 2, y, -1);
    c.shade(cx + 2, y, -1);
  }
  // A fold down the front, the vine belt and its seed of light, the chimes.
  for (let y = top + 3; y < waist; y++) c.shade(cx, y, -1);
  c.part();
  c.shape(waist, waist, () => [cx - 4.1, cx + 4.1], LEAF, (_x, _y, t) => cyl(t, 0));
  c.spark(cx, waist, S.light[1], 0.6 + p.glow * 0.4);
  chimes(c, [cx - 3, cx - 2, cx + 3], waist + 1, p.tick);
  // The cloak over both shoulders, closed at the throat with a leaf.
  c.part();
  c.ellipse(cx, 16.2 + U, 5.4, 1.9, MOSS, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.4, 1) });
  c.part();
  c.px(cx, 17 + U, LEAF, sphere(0, -0.5));
  c.px(cx - 1, 17 + U, LEAF, sphere(-0.4, -0.3));
  hoodDown(c, cx, U, p);
}

/** The wildsong from behind: the cloak covering his back, the hood's tail trailing down it. */
function wildUp(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const hem = 26 + L;
  const top = 14.5 + U;
  c.part();
  c.shape(top, hem, (y) => {
    const u = (y - top) / (hem - top);
    return [cx - 5.2 - u * 0.8 + u * p.sway * 0.5, cx + 5.2 + u * (1 + p.sway)];
  }, MOSS, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
  for (let y = 18 + U; y <= hem; y++) {
    const u = (y - top) / (hem - top);
    c.shade(Math.round(cx - 2 + u * p.sway * 0.5), y, -1);
    c.shade(Math.round(cx + 2 + u * p.sway), y, -1);
  }
  leafHem(c, cx - 8, cx + 9, hem);
  hoodCrown(c, cx, U, 0);
  c.part();
  c.capsule(cx + 0.4, 13 + U, cx + 1 + p.sway * 0.3, 18.6 + U, 1.3, 0.6, MOSS);
  c.part();
  c.px(cx + 1 + p.sway * 0.3, 19.6 + U, LEAF, sphere(0, 0.4));
  for (let y = 9 + U; y <= 13 + U; y++) c.shade(cx, y, -1);
  twig(c, cx - 2.2, 8.4 + U, -1);
  twig(c, cx + 2.4, 8.2 + U, 1);
}

/** Two wisps of forest light drifting round him, passing behind him and in front. */
function wisps(c: PixelCanvas, U: number, tick: number): void {
  const [core, hot, mid, deep] = S.light;
  for (let i = 0; i < 2; i++) {
    // Half a turn per six frames, so the two wisps trade places and the loops run on seamlessly.
    const a = (tick / 6) * Math.PI + i * Math.PI;
    const x = 12 + Math.cos(a) * 10.5;
    const y = 12 + U + Math.sin(a) * 2.2 - Math.sin(a * 2) * 1.2;
    const behind = Math.sin(a) < 0;
    const put = (px: number, py: number, col: RGB, k: number) => {
      if (behind && c.filled(Math.floor(px), Math.floor(py))) return;
      c.spark(px, py, col, k);
    };
    put(x, y, core, 1);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(x + dx, y + dy, hot, 0.45);
    // A tail of light behind it along the orbit.
    const tx = Math.sin(a);
    const ty = -Math.cos(a) * 0.3;
    put(x + tx * 2, y + ty * 2, mid, 0.45);
    put(x + tx * 3.2, y + ty * 3.2, deep, 0.35);
  }
}

// ---------------------------------------------------------------------------
// Views

const REACH_FRONT = 4.5;
const REACH_SIDE = 5.2;

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const drum = S.drum;
  const armA = () => (drum ? bareArm : sleevedArm)(c, 7.2, 16.3 + U, fa, REACH_FRONT, [-0.6, 1], fa.behind ? -1 : 0);
  const armB = () => (drum ? bareArm : sleevedArm)(c, 16.8, 16.3 + U, fb, REACH_FRONT, [0.6, 1], fb.behind ? -1 : 0);
  const sticks = (arm: 'a' | 'b') => drum && mallet(c, 'down', arm, arm === 'a' ? fa : fb, arm === 'a' ? p.stickA : p.stickB, p.glow, (arm === 'a' ? fa : fb).behind ? -1 : 0);

  if (S.wild) wildCloakBehind(c, cx, U, L, p.sway);
  else if (!drum) {
    // The half-cape hangs from his left shoulder, showing behind him on that side.
    c.part();
    c.shape(15 + U, 25 + L, (y) => {
      const u = (y - 15 - U) / (10 + L - U);
      return [cx + 0.5 + u * p.sway, cx + 5.6 + u * (1.2 + p.sway)];
    }, WINE, (_x, _y, t, u) => sphere(t * 0.9, u * 0.4, 1), { bias: -1 });
  }
  if (fa.behind) {
    armA();
    sticks('a');
  }
  if (fb.behind) {
    armB();
    sticks('b');
  }

  leg(c, 10.2, 24.5 + L, 10, 28.4 - p.footA);
  leg(c, 13.8, 24.5 + L, 14, 28.4 - p.footB);
  boot(c, 10, 29.6 - p.footA);
  boot(c, 14, 29.6 - p.footB);

  const top = 15 + U;
  const waist = 22 + U;
  const hem = (drum ? 26 : 24.5) + L;
  if (drum) {
    // A kilt of leather strips, then the bare chest under an open vest.
    c.part();
    c.shape(waist, Math.round(hem), (y) => {
      const hw = 4.6 + (y - waist) * 0.35;
      return [cx - hw + (y - waist) * 0.1 * p.sway, cx + hw + (y - waist) * 0.1 * p.sway];
    }, KILT, (_x, _y, t) => sphere(t * 0.9, 0.25, 1));
    for (let y = waist + 1; y <= hem; y++) for (const x of [cx - 3, cx - 1, cx + 1, cx + 3]) c.shade(x, y, -1);
    c.part();
    c.shape(top, waist - 1, (y) => {
      const u = (y + 0.5 - top) / (waist - top);
      const hw = 5.1 - 0.7 * u * u;
      return [cx - hw, cx + hw];
    }, SKIN, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.8 - 0.35, 1));
    // Pecs, and the vest's open sides.
    c.shade(cx - 2, top + 3, -1);
    c.shade(cx + 1, top + 3, -1);
    c.shade(cx - 1, top + 4, -1);
    c.shade(cx, top + 4, -1);
    c.part();
    for (let y = top; y < waist; y++) {
      const u = (y + 0.5 - top) / (waist - top);
      const hw = 5.1 - 0.7 * u * u;
      c.shape(y, y, () => [cx - hw, cx - hw + 2 - u * 0.4], VEST, (_x, _y, t) => sphere(t * 0.5 - 0.6, 0, 1));
      c.shape(y, y, () => [cx + hw - 2 + u * 0.4, cx + hw], VEST, (_x, _y, t) => sphere(t * 0.5 + 0.6, 0, 1));
    }
    // The belt, the drum's strap across the chest, and the fur mantle.
    c.part();
    c.shape(waist, waist, () => [cx - 4.6, cx + 4.6], LEATHER, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.capsule(15.8, 15.4 + U, 8.6, 21.2 + U, 0.6, 0.6, LEATHER);
    mantle(c, cx, U, 5.6);
    drawDrum(c, cx, 21 + U, 4.6, p.glow);
    // The head: a broad face, war paint across the eyes, a braided beard.
    c.part();
    c.ellipse(cx, 12.2 + U, 3.0, 2.9, SKIN);
    c.part();
    c.shape(Math.round(12 + U), Math.round(12 + U), () => [cx - 3, cx + 3], WARPAINT, () => sphere(0, 0, 1));
    c.px(cx - 3, 11 + U, WARPAINT, sphere(0, 0, 1));
    c.px(cx + 2, 11 + U, WARPAINT, sphere(0, 0, 1));
    eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
    beardDown(c, cx, U);
    helmDown(c, cx, U);
  } else if (S.wild) {
    wildDown(c, cx, U, L, p);
  } else {
    // The doublet, a short skirt flaring below the belt.
    c.part();
    c.shape(top, Math.round(hem), (y) => {
      const hw = y <= waist ? 4.5 - 0.5 * ((y + 0.5 - top) / (waist - top)) ** 2 : 4.1 + (y - waist) * 0.55;
      return [cx - hw, cx + hw];
    }, DOUBLET, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
    for (let y = waist + 1; y <= hem; y++) {
      c.shade(cx - 2, y, -1);
      c.shade(cx + 2, y, -1);
    }
    // A seam down the front with gold buttons.
    c.part();
    for (let y = top + 2; y < waist; y++) c.shade(cx, y, -1);
    for (const y of [top + 2, top + 4, top + 6]) c.px(cx, y, GOLD, sphere(0, -0.4));
    // Belt and buckle, and a cream collar.
    c.part();
    c.shape(waist, waist, () => [cx - 4.1, cx + 4.1], LEATHER, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.px(cx, waist, GOLD, sphere(0, -0.3));
    c.part();
    c.ellipse(cx, 15.2 + U, 2.6, 1.1, SHIRT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.5 - 0.4, 1) });
    // The cape's drape over his left shoulder, pinned with gold.
    c.part();
    c.ellipse(cx + 3.6, 16 + U, 2.5, 1.6, WINE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + 0.2, dy * 0.6 - 0.4, 1) });
    c.part();
    c.px(cx + 2, 16 + U, GOLD, sphere(-0.3, -0.4));
    // Head: chestnut hair to the shoulders, the face, the cap.
    c.part();
    c.ellipse(cx, 11.6 + U, 3.9, 3.7, CHESTNUT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
    c.part();
    c.capsule(cx - 3.2, 12 + U, cx - 3.6, 15.4 + U, 1.3, 1.0, CHESTNUT);
    c.capsule(cx + 3.0, 12 + U, cx + 3.4, 15.4 + U, 1.3, 1.0, CHESTNUT);
    c.part();
    c.ellipse(cx - 0.2, 12.8 + U, 2.55, 2.4, SKIN);
    c.part();
    c.shape(Math.round(10 + U), Math.round(10 + U), () => [cx - 2.8, cx + 1.2], CHESTNUT, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
    c.px(cx - 3, 11 + U, CHESTNUT, sphere(-0.6, 0.2));
    eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
    // A small, easy smile.
    c.shade(cx - 1, 14 + U, -1);
    c.shade(cx, 14 + U, -1);
    capDown(c, cx, U, p.tick);
  }

  if (!drum) drawLute(c, 'down', p, fa, fb);
  if (!fb.behind) {
    armB();
    sticks('b');
  }
  if (!fa.behind) {
    armA();
    sticks('a');
  }
  if (drum) {
    // Fur spilling over the tops of his shoulders, over the arms.
    c.part();
    for (const s of [-1, 1]) {
      c.ellipse(cx + s * 5.2, 15.6 + U, 1.9, 1.5, FUR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + s * 0.3, dy * 0.8 - 0.3, 1) });
      c.shade(cx + s * 5, 17 + U, -1);
    }
  }
  if (S.wild) wisps(c, U, p.tick);
}

/** The fur mantle: a ruff of tufts along the shoulders. */
function mantle(c: PixelCanvas, cx: number, U: number, span: number): void {
  c.part();
  const n = 7;
  for (let i = 0; i < n; i++) {
    const k = (i / (n - 1)) * 2 - 1;
    const x = cx + k * span;
    const y = 15.4 + U - (1 - k * k) * 0.6;
    c.ellipse(x, y, 1.4, 1.3, FUR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + k * 0.3, dy * 0.8 - 0.2, 1) });
  }
}

/** A braided ginger beard falling from the chin, bound near its end. */
function beardDown(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.shape(Math.round(14 + U), Math.round(15 + U), (y) => (y === Math.round(14 + U) ? [cx - 2.8, cx + 2.8] : [cx - 2.2, cx + 2.2]), GINGER, (_x, _y, t) => sphere(t * 0.8, 0.2, 1));
  c.part();
  c.capsule(cx - 0.4, 15.5 + U, cx - 0.4, 18.6 + U, 1.1, 0.8, GINGER);
  for (let y = 16; y <= 18; y++) c.shade(cx - 1 + ((y & 1) === 0 ? 0 : 1), y + U, -1);
  c.part();
  c.px(cx - 1, 18 + U, BRONZE, sphere(0, -0.3));
  // A moustache over the mouth.
  c.shade(cx - 2, 14 + U, -1);
  c.shade(cx + 1, 14 + U, -1);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const drum = S.drum;
  const armA = () => (drum ? bareArm : sleevedArm)(c, 7.2, 16.3 + U, fa, REACH_FRONT, [-0.6, 0.8], fa.behind ? -1 : 0);
  const armB = () => (drum ? bareArm : sleevedArm)(c, 16.8, 16.3 + U, fb, REACH_FRONT, [0.6, 0.8], fb.behind ? -1 : 0);
  const sticks = (arm: 'a' | 'b') => drum && mallet(c, 'up', arm, arm === 'a' ? fa : fb, arm === 'a' ? p.stickA : p.stickB, 0, (arm === 'a' ? fa : fb).behind ? -1 : 0);

  // The lute or the drum is in front of him, hidden but for what peeks past.
  if (!drum) drawLute(c, 'up', p, fa, fb, -1);
  else drawDrum(c, cx, 21 + U, 4.6, 0, -1);
  if (fa.behind) {
    armA();
    sticks('a');
  }
  if (fb.behind) {
    armB();
    sticks('b');
  }

  leg(c, 10.2, 24.5 + L, 10, 28.4 - p.footB);
  leg(c, 13.8, 24.5 + L, 14, 28.4 - p.footA);
  boot(c, 10, 29.6 - p.footB);
  boot(c, 14, 29.6 - p.footA);

  const top = 15 + U;
  const waist = 22 + U;
  if (drum) {
    c.part();
    c.shape(waist, 26 + L, (y) => {
      const hw = 4.6 + (y - waist) * 0.35;
      return [cx - hw, cx + hw];
    }, KILT, (_x, _y, t) => sphere(t * 0.9, 0.25, 1));
    for (let y = waist + 1; y <= 26 + L; y++) for (const x of [cx - 3, cx - 1, cx + 1, cx + 3]) c.shade(x, y, -1);
    // The vest covers his back; the strap crosses it.
    c.part();
    c.shape(top, waist - 1, (y) => {
      const u = (y + 0.5 - top) / (waist - top);
      const hw = 5.1 - 0.7 * u * u;
      return [cx - hw, cx + hw];
    }, VEST, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
    for (let y = top + 1; y < waist; y++) c.shade(cx, y, -1);
    c.part();
    c.shape(waist, waist, () => [cx - 4.6, cx + 4.6], LEATHER, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.capsule(8.2, 15.4 + U, 15.4, 21.2 + U, 0.6, 0.6, LEATHER);
    mantle(c, cx, U - 0.4, 5.6);
    // The back of the head under the helm, the beard's braid just showing.
    c.part();
    c.ellipse(cx, 12.2 + U, 3.0, 2.8, SKIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8, 1) });
    helmDown(c, cx, U);
    c.part();
    c.shape(Math.round(11 + U), Math.round(13 + U), () => [cx - 3, cx + 3], GINGER, (_x, _y, t) => sphere(t * 0.9, 0.2, 1));
    c.shade(cx - 1, 12 + U, -1);
    c.shade(cx + 1, 12 + U, -1);
  } else if (S.wild) {
    wildUp(c, cx, U, L, p);
  } else {
    c.part();
    c.shape(top, Math.round(24.5 + L), (y) => {
      const hw = y <= waist ? 4.5 - 0.5 * ((y + 0.5 - top) / (waist - top)) ** 2 : 4.1 + (y - waist) * 0.55;
      return [cx - hw, cx + hw];
    }, DOUBLET, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
    c.part();
    c.shape(waist, waist, () => [cx - 4.1, cx + 4.1], LEATHER, (_x, _y, t) => cyl(t, 0));
    // The half-cape falls down his back from the left shoulder.
    const hem = 25 + L;
    c.part();
    c.shape(14.5 + U, hem, (y) => {
      const u = (y - 14.5 - U) / (hem - 14.5 - U);
      return [cx - 3.4 + u * (0.6 + p.sway), cx + 5.2 + u * (1 + p.sway)];
    }, WINE, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
    for (let y = 17 + U; y <= hem; y++) {
      const u = (y - 14.5 - U) / (hem - 14.5 - U);
      c.shade(Math.round(cx + 1 + u * p.sway), y, -1);
    }
    for (let x = cx - 3; x <= cx + 6; x++) if (c.filled(x, Math.round(hem))) c.px(x, Math.round(hem), GOLD, sphere(0, 0.4));
    // The back of the head: hair to the shoulders, the cap and its plume.
    c.part();
    c.ellipse(cx, 11.6 + U, 3.9, 3.7, CHESTNUT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    c.part();
    c.shape(Math.round(13 + U), Math.round(15.6 + U), (y) => {
      const hw = 3.4 - (y - 13 - U) * 0.3;
      return [cx - hw, cx + hw];
    }, CHESTNUT, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
    for (let y = 12 + U; y <= 15 + U; y++) c.shade(cx + ((y & 1) === 0 ? -1 : 1), y, -1);
    capDown(c, cx, U, p.tick);
  }

  if (!fb.behind) {
    armB();
    sticks('b');
  }
  if (!fa.behind) {
    armA();
    sticks('a');
  }
  if (S.wild) wisps(c, U, p.tick);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean; // upper body centre
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);
  const drum = S.drum;
  const top = 15 + U;
  const waist = 22 + U;

  if (S.wild) {
    // The cloak streaming behind him, its hem cut like leaves.
    const hem = 26 + L;
    c.part();
    c.shape(top - 0.5, hem, (y) => {
      const u = (y - top + 0.5) / (hem - top + 0.5);
      return [hx + 0.2 - u * 0.4, hx + 4.2 + u * (1.8 + p.sway)];
    }, MOSS, (_x, _y, t, u) => sphere(t * 0.9 + 0.1, u * 0.5 - 0.2, 1), { bias: -1 });
    for (let y = Math.round(top + 3); y <= hem; y++) {
      const u = (y - top + 0.5) / (hem - top + 0.5);
      c.shade(Math.round(hx + 2.6 + u * (1 + p.sway)), y, -1);
    }
    leafHem(c, hx - 2, hx + 9, hem, -1);
  } else if (!drum) {
    // The cape streaming behind him.
    const hem = 25 + L;
    c.part();
    c.shape(top - 0.5, hem, (y) => {
      const u = (y - top + 0.5) / (hem - top + 0.5);
      return [hx + 0.8, hx + 3.8 + u * (1.4 + p.sway)];
    }, WINE, (_x, _y, t, u) => sphere(t * 0.9 + 0.1, u * 0.5 - 0.2, 1), { bias: -1 });
    for (let y = Math.round(top + 1); y <= hem; y++) {
      const u = (y - top + 0.5) / (hem - top + 0.5);
      c.px(Math.round(hx + 3.8 + u * (1.4 + p.sway)) - 1, y, GOLD, sphere(0.5, 0), { bias: -1 });
    }
  }
  // The far arm behind everything, unless it reaches out in front.
  const armA = (bias: number) => (drum ? bareArm : sleevedArm)(c, hx + 1.2, 16.4 + U, fa, REACH_SIDE, [0.3, 1], bias);
  if (fa.behind) {
    armA(-1);
    if (drum) mallet(c, 'side', 'a', fa, p.stickA, p.glow, -1);
  }

  // Legs: the back leg in shade first.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 0.8, 24.5 + L, cx + 1 - p.footB, 28.4 - lift(p.footB), -1);
  boot(c, cx + 0.4 - p.footB, 29.7 - lift(p.footB), true, -1);
  leg(c, cx - 0.6, 24.5 + L, cx - 0.4 - p.footA, 28.4 - lift(p.footA));
  boot(c, cx - 1.2 - p.footA, 29.7 - lift(p.footA), true);

  if (drum) {
    c.part();
    c.shape(waist, 26 + L, (y) => {
      const u = (y - waist) / 4;
      const shift = hx + (cx - hx) * u;
      const hw = 3.4 + (y - waist) * 0.3;
      return [shift - hw, shift + hw + u * p.sway * 0.5];
    }, KILT, (_x, _y, t) => sphere(t * 0.9 - 0.1, 0.25, 1));
    for (let y = waist + 1; y <= 26 + L; y++) for (const x of [hx - 2, hx, hx + 2]) c.shade(x, y, -1);
    c.part();
    c.shape(top, waist - 1, (y) => {
      const u = (y + 0.5 - top) / (waist - top);
      const hw = 3.6 - 0.5 * u * u;
      return [hx - hw - 0.4, hx + hw];
    }, SKIN, (_x, y, t) => sphere(t * 0.9 - 0.1, ((y - top) / (waist - top)) * 0.8 - 0.35, 1));
    c.part();
    c.shape(top, waist - 1, (y) => {
      const u = (y + 0.5 - top) / (waist - top);
      const hw = 3.6 - 0.5 * u * u;
      return [hx - hw + 1.6, hx + hw];
    }, VEST, (_x, _y, t) => sphere(t * 0.8 + 0.1, 0, 1));
    c.part();
    c.shape(waist, waist, () => [hx - 3.4, hx + 3.4], LEATHER, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.capsule(hx + 1.6, 15.2 + U, hx - 2.2, 21 + U, 0.6, 0.6, LEATHER);
    mantle(c, hx - 0.4, U, 3.6);
    // The head in profile: helm and horn, war paint, the braid of beard.
    c.part();
    c.capsule(hx + 1.0, 9.6 + U, hx + 2.6, 7.2 + U, 0.95, 0.6, BONE);
    c.part();
    c.capsule(hx + 2.6, 7.2 + U, hx + 2.2, 5.6 + U, 0.6, 0.4, BONE);
    c.part();
    c.ellipse(hx - 1.2, 12.6 + U, 2.5, 2.5, SKIN);
    c.part();
    c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
    c.part();
    c.shape(Math.round(12 + U), Math.round(12 + U), () => [hx - 3.8, hx], WARPAINT, () => sphere(0, 0, 1));
    eyes(c, [[hx - 3, 12 + U]], p.blink);
    c.part();
    c.shape(Math.round(14 + U), Math.round(15 + U), () => [hx - 3.6, hx + 0.4], GINGER, (_x, _y, t) => sphere(t * 0.8, 0.2, 1));
    c.part();
    c.capsule(hx - 2.4, 15.6 + U, hx - 2.8, 18.4 + U, 1.0, 0.7, GINGER);
    c.px(hx - 3, 18 + U, BRONZE, sphere(0, -0.3));
    c.part();
    c.shape(Math.round(7 + U), Math.round(9 + U), (y) => {
      const u = (y - 7 - U) / 2;
      return [hx - 3 - u * 0.9, hx + 2.4 + u * 0.8];
    }, IRON, (_x, _y, t, u) => sphere(t * 0.9, u * 0.7 - 0.6, 1));
    c.part();
    c.shape(Math.round(10 + U), Math.round(10 + U), () => [hx - 3.9, hx + 3.2], BRONZE, (_x, _y, t) => cyl(t, 0.3));
  } else if (S.wild) {
    wildSide(c, cx, hx, U, L, p);
  } else {
    c.part();
    c.shape(top, Math.round(24.5 + L), (y) => {
      const u = y <= waist ? 0 : (y - waist) / 2.5;
      const shift = y <= waist ? hx : hx + (cx - hx) * u;
      const hw = y <= waist ? 3.2 - 0.4 * ((y + 0.5 - top) / (waist - top)) ** 2 : 2.9 + (y - waist) * 0.5;
      return [shift - hw - 0.2, shift + hw + 0.2];
    }, DOUBLET, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
    c.part();
    for (const y of [top + 2, top + 4, top + 6]) c.px(Math.round(hx - 3.2), y, GOLD, sphere(-0.5, -0.3));
    c.part();
    c.shape(waist, waist, () => [hx - 3.1, hx + 3.1], LEATHER, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.ellipse(hx - 0.6, 15.3 + U, 2.0, 1.0, SHIRT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.5 - 0.4, 1) });
    // Head: hair behind, face turned left, the cap and its plume streaming back.
    c.part();
    c.ellipse(hx + 0.6, 11.8 + U, 3.4, 3.6, CHESTNUT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
    c.part();
    c.capsule(hx + 1.8, 12.5 + U, hx + 2.4 + p.sway * 0.3, 15.8 + U, 1.5, 1.0, CHESTNUT);
    c.part();
    c.ellipse(hx - 1.4, 12.9 + U, 2.2, 2.3, SKIN);
    c.part();
    c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
    c.shade(hx - 3, 14 + U, -1);
    c.part();
    c.shape(Math.round(10 + U), Math.round(10 + U), () => [hx - 3.4, hx + 0.6], CHESTNUT, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
    eyes(c, [[hx - 3, 12 + U]], p.blink);
    c.part();
    c.ellipse(hx - 0.2, 9.8 + U, 5.0, 1.5, WINE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.4 - 0.7, 1) });
    c.part();
    c.ellipse(hx + 0.4, 7.9 + U, 2.9, 2.0, WINE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    c.part();
    c.shape(Math.round(9 + U), Math.round(9 + U), () => [hx - 2.4, hx + 3.2], GOLD, (_x, _y, t) => cyl(t, 0.2));
    plume(c, hx + 2.4, 8.2 + U, 1, p.tick);
  }

  if (drum) drawDrum(c, hx - 3.6, 21 + U, 3.4, p.glow);
  else drawLute(c, 'side', p, fa, fb);
  if (!fa.behind) {
    armA(0);
    if (drum) mallet(c, 'side', 'a', fa, p.stickA, p.glow);
  }
  // The near arm last.
  (drum ? bareArm : sleevedArm)(c, hx + 0.2, 16.7 + U, fb, REACH_SIDE, [0.4, 1], 0);
  if (drum) mallet(c, 'side', 'b', fb, p.stickB, p.glow);
  if (S.wild) wisps(c, U, p.tick);
}

/** The wildsong in profile, facing left: tunic and vine belt, the cloak on his shoulder, the hood's tail streaming back. */
function wildSide(c: PixelCanvas, cx: number, hx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, Math.round(24.5 + L), (y) => {
    const u = y <= waist ? 0 : (y - waist) / 2.5;
    const shift = y <= waist ? hx : hx + (cx - hx) * u;
    const hw = y <= waist ? 3.2 - 0.4 * ((y + 0.5 - top) / (waist - top)) ** 2 : 2.9 + (y - waist) * 0.5;
    return [shift - hw - 0.2, shift + hw + 0.2];
  }, BARK, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
  c.part();
  c.shape(waist, waist, () => [hx - 3.1, hx + 3.1], LEAF, (_x, _y, t) => cyl(t, 0));
  c.spark(hx - 3, waist, S.light[1], 0.6 + p.glow * 0.4);
  chimes(c, [hx, hx + 1], waist + 1, p.tick);
  // The cloak over his shoulder.
  c.part();
  c.ellipse(hx + 0.6, 16.2 + U, 3.4, 1.8, MOSS, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + 0.1, dy * 0.6 - 0.4, 1) });
  // The hood: its tail streaming back, its fall on the shoulder, the far twig behind.
  twig(c, hx + 1.8, 8.2 + U, 1, -1);
  c.part();
  c.capsule(hx + 2.6, 9.4 + U, hx + 5.4 + p.sway * 0.4, 12.2 + U, 1.4, 0.6, MOSS);
  c.part();
  c.px(hx + 6 + p.sway * 0.4, 12.8 + U, LEAF, sphere(0.4, 0.3));
  c.part();
  c.capsule(hx + 1.6, 12.5 + U, hx + 2.2 + p.sway * 0.3, 15.8 + U, 1.5, 1.0, MOSS);
  hoodCrown(c, hx + 0.2, U, 0.2);
  twig(c, hx - 0.6, 8.4 + U, -1);
  // The opening at the front, trimmed in leaves, dark within but for one eye.
  c.part();
  c.ellipse(hx - 2.3, 12.7 + U, 1.9, 2.5, LEAF, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6 - 0.3, dy * 0.6 - 0.3, 1) });
  c.part();
  c.ellipse(hx - 2.6, 13.0 + U, 1.4, 2.0, HOOD_DARK);
  hoodEyes(c, [[hx - 3, 12 + U]], p.blink);
}

// ---------------------------------------------------------------------------
// Animations

/** The minstrel's lute held ready: the belly at his right hip, the neck across his chest. */
const LUTE_A = H(1.5, 3.0, -3.5);
const LUTE_B = H(2.5, 3.2, 2.0);
/** The drummer's mallets hanging at his sides. */
const DRUM_A = H(0.6, 4.8, -3.5);
/** Side-view hands: the lute held out ahead, or the mallets low at his front. */
const side = (h: Hand, arm: 'a' | 'b'): Hand => (S.drum ? H(h.f + 1.4, 0, h.h) : H(arm === 'a' ? h.f + 1 : h.f + 4.5, 0, h.h - (arm === 'b' ? 2 : 0)));

const base = (view: View): Pose => {
  const a = S.drum ? DRUM_A : LUTE_A;
  const b = S.drum ? DRUM_A : LUTE_B;
  return {
    lift: 0,
    breath: 0,
    footA: view === 'side' ? 1 : 0,
    footB: view === 'side' ? -1 : 0,
    lean: 0,
    a: view === 'side' ? side(a, 'a') : { ...a },
    b: view === 'side' ? side(b, 'b') : { ...b },
    stickA: 0.2,
    stickB: 0.2,
    glow: 0,
    sway: 0,
    tick: 0,
  };
};

/** Standing easy: the minstrel idly picks a string or two; the drummer rolls his shoulders. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.sway = Math.sin(ph - 1) * 0.6;
    p.tick = f;
    p.blink = f === 4;
    if (S.drum) {
      p.a.h += Math.sin(ph) * 0.4;
      p.b.h += Math.sin(ph + 1) * 0.4;
      p.stickA = 0.2 + Math.sin(ph) * 0.06;
      p.stickB = 0.2 + Math.sin(ph + 1) * 0.06;
    } else {
      p.a.h += f === 1 || f === 2 ? 0.8 : 0;
      p.glow = f === 2 ? 0.3 : 0;
    }
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
    p.tick = f;
    if (view === 'side') {
      p.footA = Math.round(s * 2.2);
      p.footB = -p.footA;
      p.lean = 1;
      p.sway = 1 + Math.abs(s) * 0.9;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.8;
    }
    if (S.drum) {
      // The mallets swing with his stride.
      p.a.f += s * 1.4;
      p.b.f -= s * 1.4;
      p.a.h += p.lift * 0.4;
      p.b.h += p.lift * 0.4;
    } else {
      // The lute rides steady; he bobs with it.
      p.a.h += p.lift * 0.4;
      p.b.h += p.lift * 0.4;
    }
    frames.push(p);
  }
  return frames;
}

interface Key {
  a: Hand;
  b: Hand;
  aSide?: Hand;
  bSide?: Hand;
  stickA?: number;
  stickB?: number;
  glow?: number;
  lean?: number;
  breath?: number;
  lift?: number;
  step?: number;
}

/** An action as keyframes; anything left out stays at rest. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k, i) => {
      const p = base(view);
      p.a = view === 'side' ? { ...(k.aSide ?? side(k.a, 'a')) } : { ...k.a };
      p.b = view === 'side' ? { ...(k.bSide ?? side(k.b, 'b')) } : { ...k.b };
      p.stickA = k.stickA ?? 0.2;
      p.stickB = k.stickB ?? 0.2;
      p.glow = k.glow ?? 0;
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
      p.tick = i;
      const step = k.step ?? 0;
      if (view === 'side') {
        p.lean = k.lean ?? 0;
        p.footA = 1 + step;
        p.footB = -1 - Math.round(step * 0.5);
        p.sway = Math.max(0, (k.lean ?? 0) * 0.6) + 0.4;
      } else {
        p.footA = step > 0 ? 1 : 0;
        p.sway = (k.lean ?? 0) * -0.4;
      }
      return p;
    });
}

/** The strum: the hand lifted over the strings, then swept down across them in a flash of light. */
const strum = action([
  { a: H(1.8, 2.8, -2.0), b: LUTE_B, glow: 0.2 },
  { a: H(1.5, 3.0, -2.8), b: H(2.5, 3.1, 2.4), glow: 0.5, lean: -1 },
  { a: H(1.1, 3.3, -4.6), b: H(2.5, 3.1, 2.6), glow: 1, lean: 1, step: 1 },
  { a: H(1.2, 3.2, -4.4), b: H(2.5, 3.1, 2.4), glow: 0.5, lean: 1, step: 1 },
  { a: LUTE_A, b: LUTE_B, glow: 0.15 },
]);

/** The song: the lute raised, strummed on the beat with a little hop, light pouring off it. */
const song = action([
  { a: H(1.5, 3.0, -2.8), b: H(2.5, 3.2, 3.5), glow: 0.3 },
  { a: H(1.3, 3.2, -4.4), b: H(2.4, 3.0, 4.6), glow: 0.7, lift: 1 },
  { a: H(1.6, 3.0, -2.2), b: H(2.4, 2.9, 5.6), glow: 0.8, lift: 1, lean: -1 },
  { a: H(1.1, 3.3, -4.6), b: H(2.4, 2.8, 6.2), glow: 1, step: 1, lean: 1 },
  { a: H(1.6, 3.0, -2.2), b: H(2.4, 2.8, 6.2), glow: 1, lift: 1 },
  { a: H(1.1, 3.3, -4.6), b: H(2.4, 2.9, 5.6), glow: 0.9, step: 1 },
  { a: H(1.5, 3.0, -3.0), b: H(2.5, 3.1, 4.0), glow: 0.5 },
  { a: LUTE_A, b: LUTE_B, glow: 0.2 },
]);

/** Mallet poses: over the drum's head (struck), cocked back, and raised high. */
const HIT = H(2, 2.5, 1.9);
const COCK = H(0.8, 3.8, 5.0);
const HIGH = H(0.4, 4.0, 8.0);
/** From the side: over the drum out in front, and raised. */
const HIT_SIDE = H(3.2, 0, 1.2);
const COCK_SIDE = H(1.6, 0, 5.4);
const HIGH_SIDE = H(1.0, 0, 8.2);

/** One mallet cocked and brought down on the drum; the other waits low. */
const beatWith = (arm: 'a' | 'b') => {
  const k = (hit: Hand, hitSide: Hand, stick: number, rest: Hand, restSide: Hand, other = 0.35, extra: Partial<Key> = {}): Key => {
    const key: Key = arm === 'a'
      ? { a: hit, b: rest, aSide: hitSide, bSide: restSide, stickA: stick, stickB: other }
      : { a: rest, b: hit, aSide: restSide, bSide: hitSide, stickA: other, stickB: stick };
    return { ...key, ...extra };
  };
  const REST = H(1.8, 3.4, -0.8);
  const REST_SIDE = H(2.4, 0, -0.6);
  return action([
    k(COCK, COCK_SIDE, 0.8, REST, REST_SIDE, 0.3, { lean: -1 }),
    k(HIGH, HIGH_SIDE, 1, REST, REST_SIDE, 0.3, { lean: -1, glow: 0.1 }),
    k(HIT, HIT_SIDE, 0, REST, REST_SIDE, 0.3, { glow: 1, lean: 1, step: 1, breath: 1 }),
    k(H(1.8, 2.6, 2.6), H(3, 0, 1.8), 0.1, REST, REST_SIDE, 0.3, { glow: 0.4, lean: 1, step: 1 }),
    k(REST, REST_SIDE, 0.25, REST, REST_SIDE, 0.25, { glow: 0.1 }),
  ]);
};
const beat = beatWith('a');
const beat2 = beatWith('b');

/** The boom: both mallets raised high over his head, then brought down together with all his weight. */
const boom = action([
  { a: COCK, b: COCK, aSide: COCK_SIDE, bSide: COCK_SIDE, stickA: 0.8, stickB: 0.8, lean: -1 },
  { a: HIGH, b: HIGH, aSide: HIGH_SIDE, bSide: HIGH_SIDE, stickA: 1, stickB: 1, lean: -1, lift: 1 },
  { a: H(0.3, 3.8, 8.6), b: H(0.3, 3.8, 8.6), aSide: H(0.8, 0, 8.8), bSide: H(0.8, 0, 8.8), stickA: 1, stickB: 1, lean: -1, lift: 1, glow: 0.3 },
  { a: HIT, b: HIT, aSide: HIT_SIDE, bSide: HIT_SIDE, stickA: 0, stickB: 0, glow: 1, lean: 1, step: 1, breath: 1 },
  { a: H(1.9, 2.6, 2.4), b: H(1.9, 2.6, 2.4), aSide: H(3, 0, 1.6), bSide: H(3, 0, 1.6), stickA: 0.08, stickB: 0.08, glow: 0.6, lean: 1, step: 1, breath: 1 },
  { a: DRUM_A, b: DRUM_A, stickA: 0.2, stickB: 0.2, glow: 0.15 },
]);

/** The drum roll: quick alternating strokes that build, both mallets raised, and a last great beat. */
const roll = action([
  { a: HIT, b: COCK, aSide: HIT_SIDE, bSide: COCK_SIDE, stickA: 0, stickB: 0.7, glow: 0.5 },
  { a: COCK, b: HIT, aSide: COCK_SIDE, bSide: HIT_SIDE, stickA: 0.7, stickB: 0, glow: 0.6 },
  { a: HIT, b: COCK, aSide: HIT_SIDE, bSide: COCK_SIDE, stickA: 0, stickB: 0.7, glow: 0.7, lift: 1 },
  { a: COCK, b: HIT, aSide: COCK_SIDE, bSide: HIT_SIDE, stickA: 0.7, stickB: 0, glow: 0.8 },
  { a: HIT, b: COCK, aSide: HIT_SIDE, bSide: COCK_SIDE, stickA: 0, stickB: 0.7, glow: 0.9, lift: 1 },
  { a: COCK, b: HIT, aSide: COCK_SIDE, bSide: HIT_SIDE, stickA: 0.7, stickB: 0, glow: 1 },
  { a: HIGH, b: HIGH, aSide: HIGH_SIDE, bSide: HIGH_SIDE, stickA: 1, stickB: 1, lean: -1, lift: 1, glow: 0.4 },
  { a: HIT, b: HIT, aSide: HIT_SIDE, bSide: HIT_SIDE, stickA: 0, stickB: 0, glow: 1, lean: 1, step: 1, breath: 1 },
  { a: DRUM_A, b: DRUM_A, stickA: 0.2, stickB: 0.2, glow: 0.3 },
]);

// ---------------------------------------------------------------------------
// Frame generation

export type BardAnim = 'idle' | 'walk' | 'strum' | 'song' | 'beat' | 'beat2' | 'boom' | 'roll';

export interface BardAnimDef {
  name: BardAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Only drawn for the drummer (true) or the minstrel (false); both when left out. */
  drum?: boolean;
}

export const BARD_ANIMS: BardAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 9, loop: true, poses: walk },
  { name: 'strum', fps: 15, loop: false, poses: strum, drum: false },
  { name: 'song', fps: 10, loop: false, poses: song, drum: false },
  { name: 'beat', fps: 16, loop: false, poses: beat, drum: true },
  { name: 'beat2', fps: 16, loop: false, poses: beat2, drum: true },
  { name: 'boom', fps: 13, loop: false, poses: boom, drum: true },
  { name: 'roll', fps: 14, loop: false, poses: roll, drum: true },
];

/** The anims a look has. */
export const bardAnims = (look: BardLook): BardAnimDef[] => BARD_ANIMS.filter((a) => a.drum === undefined || a.drum === look.drum);

/** Frame index at which each action lands. */
export const BARD_RELEASE = { strum: 2, song: 3, beat: 2, beat2: 2, boom: 3, roll: 7 } as const;

export interface BardFrame {
  key: string; // e.g. "walk_left_3"
  anim: BardAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawBardFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(BARD_W, BARD_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildBardFrames(look: BardLook = MINSTREL_LOOK): BardFrame[] {
  S = look;
  D = look.dress;
  const out: BardFrame[] = [];
  for (const a of bardAnims(look)) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawBardFrame(dir, pose) });
      });
    }
  }
  S = MINSTREL_LOOK;
  D = TROUBADOUR;
  return out;
}

// ---------------------------------------------------------------------------
// Notes: the minstrel's music in flight (11x11, light only)

export const NOTE_SIZE = 11;
export const NOTE_FRAMES = 2;

/** A glowing note: 0 is a single flagged eighth note, 1 two notes beamed together. */
export function noteFrame(i: number, look: BardLook = MINSTREL_LOOK): PixelCanvas {
  const c = new PixelCanvas(NOTE_SIZE, NOTE_SIZE);
  const [core, hot, mid, deep] = look.light;
  const lit = (x: number, y: number, col: RGB, a = 1) => c.spark(x, y, col, a);
  const head = (cx: number, cy: number) => {
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        const d = Math.hypot((x + 0.3) / 1.9, (y - 0.2) / 1.45);
        if (d > 1.15) continue;
        lit(cx + x, cy + y, d < 0.55 ? core : d < 0.9 ? hot : mid, d < 0.9 ? 1 : 0.8);
      }
    }
  };
  const stem = (x: number, y0: number, y1: number) => {
    for (let y = y0; y <= y1; y++) {
      lit(x, y, hot);
      lit(x + 1, y, deep, 0.5);
    }
  };
  if (look.wild) {
    if (i === 0) {
      // A note whose flag is a leaf.
      head(4, 8);
      stem(5, 1, 7);
      for (const [x, y, col] of [[6, 1, hot], [7, 1, mid], [6, 2, core], [7, 2, hot], [8, 2, mid], [7, 3, core], [8, 3, hot], [9, 3, mid], [8, 4, mid], [9, 4, deep]] as const) lit(x, y, col);
    } else {
      // A wisp: a round little spirit with two dark eyes, a sprout on its head and a curl of a tail.
      for (let y = 2; y <= 8; y++) {
        for (let x = 2; x <= 9; x++) {
          const d = Math.hypot((x + 0.5 - 6) / 2.7, (y + 0.5 - 5.5) / 2.4);
          if (d > 1.1 || ((x === 5 || x === 7) && y === 5)) continue;
          lit(x, y, d < 0.5 ? core : d < 0.85 ? hot : mid, d < 0.85 ? 1 : 0.8);
        }
      }
      for (const [x, y, col] of [[6, 2, hot], [7, 1, mid], [8, 0, mid], [3, 8, mid], [2, 9, mid], [2, 10, deep], [3, 10, deep]] as const) lit(x, y, col);
    }
    return c;
  }
  if (i === 0) {
    head(4, 8);
    stem(5, 1, 7);
    // The flag curling down from the stem's top.
    for (const [x, y, col] of [[6, 1, hot], [7, 2, hot], [8, 3, mid], [8, 4, mid], [7, 5, deep]] as const) lit(x, y, col);
  } else {
    head(2, 8);
    head(7, 7);
    stem(3, 2, 7);
    stem(8, 1, 6);
    // The beam joining them.
    for (let x = 3; x <= 8; x++) {
      const y = Math.round(2 - (x - 3) * 0.2);
      lit(x, y, core);
      lit(x, y + 1, hot, 0.9);
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// Ability icons (16x16)

/** The lute: a honey-wood belly with its dark rosette, the neck running up to a bent pegbox (the wildsong's grown of pale wood, budding leaves). */
export function luteIcon(wild = false): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const neck = wild ? ['#382c1a', '#4e4026'] : ['#4a2418', '#663424'];
  const belly = wild ? ['#ecdc9e', '#c8ac6c', '#8a6e3c'] : ['#f0c474', '#cc9244', '#9c5e26'];
  const peg = wild ? '#6aac44' : '#f4cf6a';
  // Neck from the belly up to the top right.
  for (let i = 0; i < 7; i++) {
    put(8 + i, 7 - i, neck[0]);
    put(9 + i, 7 - i, neck[1]);
  }
  put(14, 0, '#2e1610');
  put(15, 1, '#2e1610');
  put(13, 0, peg);
  put(15, 2, peg);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 6, y + 0.5 - 10);
      const d2 = Math.hypot(x + 0.5 - 8.2, y + 0.5 - 7.8);
      if (d <= 4.6 || d2 <= 2.9) put(x, y, d < 2.6 ? belly[0] : x + y < 15 ? belly[1] : belly[2]);
    }
  }
  outline(wild ? '#10180a' : '#1a0c06');
  const hole = wild ? '#9ee85a' : '#140806';
  put(7, 9, hole);
  put(7, 10, hole);
  put(6, 9, hole);
  // Strings, and a glint of light off them.
  for (let i = 0; i < 5; i++) put(5 + i, 12 - i, '#f4ecd8');
  put(3, 13, neck[0]);
  put(12, 3, wild ? '#eaffa0' : '#a8fff0');
  if (wild) {
    // A vine of leaves round the bowl, and a leaf at the pegbox.
    for (const [x, y] of [[1, 9], [1, 10], [2, 13], [3, 14], [9, 13], [10, 12], [12, 1]]) put(x, y, '#6aac44');
    for (const [x, y] of [[0, 10], [2, 14], [10, 13]]) put(x, y, '#9ed866');
  }
  return px;
}

/** The song: two beamed notes with sparks of light round them (the wildsong's in firefly green, a leaf on the beam). */
export function songIcon(wild = false): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const [core, hot, mid] = wild ? ['#fffde6', '#eaffa0', '#9ee85a'] : ['#f4fffc', '#a8fff0', '#3fd8c8'];
  const head = (cx: number, cy: number) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot((x + 0.5 - cx) / 2.3, (y + 0.5 - cy) / 1.7) <= 1) put(x, y, x + 0.5 < cx && y + 0.5 < cy ? core : mid);
  };
  head(4.5, 12.5);
  head(11.5, 11);
  for (let y = 3; y <= 12; y++) put(6, y, hot);
  for (let y = 2; y <= 10; y++) put(13, y, hot);
  for (let x = 6; x <= 13; x++) {
    const y = Math.round(3 - (x - 6) * 0.15);
    put(x, y, core);
    put(x, y + 1, mid);
  }
  if (wild) for (const [x, y] of [[8, 0], [9, 0], [9, 1], [10, 0]]) put(x, y, '#6aac44');
  outline(wild ? '#0c2410' : '#0a2a2e');
  for (const [x, y] of [[1, 3], [2, 6], [9, 6], [14, 14]]) put(x, y, wild ? '#eaffa0' : '#ffe89a');
  return px;
}

/** The war drum: a red shell laced with rope under a pale head, two mallets crossed over it. */
export function drumIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let y = 7; y < 14; y++) for (let x = 2; x < 14; x++) put(x, y, x < 6 ? '#c8402e' : x < 10 ? '#a42420' : '#7a1618');
  for (let x = 2; x < 14; x++) {
    put(x, 13, '#d4984a');
    const k = Math.abs(((x - 2) % 4) - 2);
    put(x, 9 + k, '#ece0bc');
  }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot((x + 0.5 - 8) / 6.2, (y + 0.5 - 7) / 2.2);
    if (d <= 1) put(x, y, d > 0.8 ? '#d4984a' : '#f4e6c4');
  }
  // Mallets crossed above.
  for (let i = 0; i < 6; i++) {
    put(3 + i, 1 + i * 0.5 | 0, '#906a42');
    put(12 - i, 1 + i * 0.5 | 0, '#906a42');
  }
  for (const [x, y] of [[2, 0], [3, 0], [2, 1], [12, 0], [13, 0], [13, 1]]) put(x, y, '#d8704a');
  outline('#140204');
  return px;
}

/** The battle rhythm: the drum's head lit in the middle, waves of sound rolling out from it. */
export function rhythmIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot((x + 0.5 - 8) / 1.0, (y + 0.5 - 9) / 0.7);
      if (d <= 3.2) put(x, y, d < 1.6 ? '#fffbe8' : '#ffd98a');
      else if (Math.abs(d - 5.6) <= 0.6 && y < 13) put(x, y, '#ff9a3a');
      else if (Math.abs(d - 7.8) <= 0.6 && y < 12) put(x, y, '#b8401e');
    }
  }
  for (let x = 5; x <= 11; x++) put(x, 13, '#7a1618');
  for (let x = 6; x <= 10; x++) put(x, 14, '#7a1618');
  outline('#1e0806');
  return px;
}
