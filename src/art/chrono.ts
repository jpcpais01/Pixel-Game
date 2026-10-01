// The chronomancer, drawn procedurally from a small rig like the bard's.
//
// The timekeeper: an old scholar of the hours in a long midnight robe trimmed
// in brass, a wine stole hanging down its front, a clock-buckled belt. He is
// bald on top with white tufts at the ears, bushy brows, little brass
// spectacles and a long white beard, and a brass clock ring floats behind his
// head like a halo, a light running round its hours. He leans on a tall staff
// crowned with an hourglass whose sand glows as it falls.
//
// The paradox is the class's other type on the same rig: younger and hooded,
// in a long charcoal coat split by seams of violet light that run down its
// front edges and crack apart at the hem, where splinters of the coat drift
// loose like moments coming undone. White hair spills from under the hood and
// the eyes burn in its shadow. A pocket watch on a chain glows in one hand.
//
// The clockwork is a skin of the timekeeper: no man at all but an automaton
// built like a clock. His head is an alarm clock, a cream dial for a face with
// two radium-green hours for eyes and hands that turn as he stands there, two
// brass bells on top and a hammer between them that rings when he casts. His
// chest is a copper barrel with a porthole where a gear turns, his arms are
// jointed copper pipes, and his lower half is a grandfather clock's case with
// a pendulum swinging behind its glass. A wind-up key turns in his back, and
// his staff is crowned with a turning cog round a radium lamp.
//
// The anomaly is a skin of the paradox: something that should not exist, a
// glitch in time wearing a man's shape. A long white coat seamed with cyan
// light, black gloves and boots, a high split collar, and for a face a smooth
// black visor with one slit of light scanning across it. Shards of him orbit
// his head, a tesseract of light turns in his hand, and every so often a band
// of him tears sideways, fringed in cyan and magenta, and snaps back.
//
// The body keeps to the 24x32 box; frames are larger so the staff and the
// halo fit. Hands are posed in the chronomancer's own terms (forward, out to
// the side, height) and placed per view.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { shiftRow } from './shapes';
import { BOOT, EYE, GOLD, SKIN } from './palette';
import { iconPainter } from './effects';
import { DIRS, type Dir } from './wizard';

export const CHRONO_W = 48;
export const CHRONO_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const CHRONO_ORIGIN_X = BODY_X + 12;
export const CHRONO_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet that bolts and shards leave the hand at. */
export const BOLT_H = 14;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#120e1f');

// ---------------------------------------------------------------------------
// Looks

/** One look for the chronomancer: its texture key, its type, its cloth and the light of its magic. */
export interface ChronoLook {
  key: string;
  /** The paradox (hood, coat and pocket watch) rather than the timekeeper (robe, beard, staff and halo). */
  rift: boolean;
  /** The robe or the coat. */
  robe: Material;
  /** The timekeeper's stole; the paradox's lining, hood shadow and trousers. */
  inner: Material;
  /** Brass (or silver) trim; the paradox's glowing seams. */
  trim: Material;
  /** Beard and hair. */
  hair: Material;
  /** Light of the magic, brightest first. */
  light: [RGB, RGB, RGB, RGB];
  /** A skin that changes the cut, not just the cloth: the clockwork (a timekeeper) or the anomaly (a paradox). */
  style?: 'clockwork' | 'anomaly' | 'primavera';
  /** Hands, when not bare. */
  hand?: Material;
}

const WHITE_HAIR: Material = { ramp: ramp('#6a6878', '#a4a2b0', '#d8d6e0', '#f8f8fc'), outline: hex('#24222e'), outlineLit: hex('#3a3846') };
const BRASS: Material = { ramp: ramp('#3a2210', '#6a4418', '#a8742a', '#dcae4a', '#fff0b0'), outline: hex('#1e1006'), shine: true, noAO: true };
const SILVER: Material = { ramp: ramp('#2a2e3a', '#4e5466', '#8a92a8', '#c8d0e0', '#ffffff'), outline: hex('#10121a'), shine: true, noAO: true };
const STAFF_WOOD: Material = { ramp: ramp('#1a0e0a', '#321c12', '#4e2e1c', '#6a4028'), outline: hex('#0c0604') };
const GLASS: Material = { ramp: ramp('#2a3440', '#4a5a6a', '#7a8e9e'), outline: hex('#141a22'), noAO: true };

export const KEEPER_LOOK: ChronoLook = {
  key: 'chrono',
  rift: false,
  robe: { ramp: ramp('#0c1030', '#161f4e', '#233174', '#34489a', '#5068bc'), outline: INK, outlineLit: hex('#0e1438') },
  inner: { ramp: ramp('#240812', '#421022', '#6a1a34', '#922846'), outline: INK },
  trim: BRASS,
  hair: WHITE_HAIR,
  light: [hex('#fffbe8'), hex('#ffe6a0'), hex('#ffc050'), hex('#b8701e')],
};

export const MOON_LOOK: ChronoLook = {
  key: 'chrono_moon',
  rift: false,
  robe: { ramp: ramp('#07081a', '#10142c', '#1a2244', '#283660', '#3c5080'), outline: hex('#05060e'), outlineLit: hex('#0c1024') },
  inner: { ramp: ramp('#0a1834', '#122a56', '#1c407e', '#2c5aa4'), outline: hex('#05060e') },
  trim: SILVER,
  hair: { ramp: ramp('#5a6274', '#949cb0', '#ccd4e4', '#f4f8ff'), outline: hex('#1e2230'), outlineLit: hex('#343a4c') },
  light: [hex('#f4fbff'), hex('#c4e4ff'), hex('#7ab8ff'), hex('#2a5aa8')],
};

export const PARADOX_LOOK: ChronoLook = {
  key: 'chrono_rift',
  rift: true,
  robe: { ramp: ramp('#171022', '#261b38', '#3a2a52', '#533e72', '#6e5694'), outline: hex('#08060c'), outlineLit: hex('#140e1c') },
  inner: { ramp: ramp('#060409', '#0e0a14', '#18121f', '#221a2c'), outline: hex('#040306') },
  trim: { ramp: ramp('#4a2490', '#7a44e0', '#a070ff', '#c8a4ff'), outline: hex('#1a0c30'), emissive: 0.55, noAO: true },
  hair: WHITE_HAIR,
  light: [hex('#f6eeff'), hex('#d4b0ff'), hex('#9a5cff'), hex('#4a2a9a')],
};

export const AEON_LOOK: ChronoLook = {
  key: 'chrono_aeon',
  rift: true,
  robe: { ramp: ramp('#0a1714', '#122824', '#1c3c36', '#28544c', '#387068'), outline: hex('#030806'), outlineLit: hex('#0a1612') },
  inner: { ramp: ramp('#030605', '#080e0c', '#0e1714', '#16221e'), outline: hex('#020403') },
  trim: { ramp: ramp('#0e7a5a', '#1eb888', '#50e8b0', '#a0ffd8'), outline: hex('#04241a'), emissive: 0.55, noAO: true },
  hair: { ramp: ramp('#3a3a3e', '#6a6a70', '#a0a0a8', '#d8d8de'), outline: hex('#141416'), outlineLit: hex('#26262a') },
  light: [hex('#eafff6'), hex('#9affd8'), hex('#2ee0a0'), hex('#127a6a')],
};

const COPPER: Material = { ramp: ramp('#2a1208', '#4e2210', '#7a3a1a', '#a85a2a', '#d4884a', '#f0b070'), outline: hex('#140804'), outlineLit: hex('#241008'), shine: true };
const DIAL: Material = { ramp: ramp('#6a6252', '#b0a88e', '#e0d8c0', '#fcf6e4'), outline: hex('#2a2418'), noAO: true };
const IRON: Material = { ramp: ramp('#141418', '#24242c', '#3a3a46', '#56566a', '#7a7a90'), outline: hex('#060608'), shine: true };
const CASE_GLASS: Material = { ramp: ramp('#06100a', '#0c1a12', '#14261a'), outline: hex('#040a06'), noAO: true };
const DIAL_INK: Material = { ramp: ramp('#1a1410', '#2e241c'), outline: hex('#1a1410'), noOutline: true, noAO: true };
const WHITE_COAT: Material = { ramp: ramp('#4a4e5a', '#7e8494', '#b0b6c4', '#dce0ea', '#f8faff'), outline: hex('#14161e'), outlineLit: hex('#2a2e3a') };
const VOID_BLACK: Material = { ramp: ramp('#040408', '#0a0a12', '#12121c', '#1c1c28'), outline: hex('#020204') };
const VISOR: Material = { ramp: ramp('#040408', '#0c0c16', '#1a1a2a', '#2e2e44', '#5a5a7a'), outline: hex('#020204'), shine: true };

/** The timekeeper's clockwork skin: copper and brass, radium-green light. */
export const CLOCKWORK_LOOK: ChronoLook = {
  key: 'chrono_clockwork',
  rift: false,
  robe: COPPER,
  inner: DIAL,
  trim: BRASS,
  hair: IRON,
  hand: IRON,
  style: 'clockwork',
  light: [hex('#f6ffe8'), hex('#d8ffa0'), hex('#8ef040'), hex('#2e8a2a')],
};

/** The paradox's anomaly skin: white and void, cyan light torn with magenta. */
export const ANOMALY_LOOK: ChronoLook = {
  key: 'chrono_anomaly',
  rift: true,
  robe: WHITE_COAT,
  inner: VOID_BLACK,
  trim: { ramp: ramp('#0a6a8a', '#18a8d0', '#40e0ff', '#b0f8ff'), outline: hex('#04202c'), emissive: 0.6, noAO: true },
  hair: WHITE_COAT,
  hand: VOID_BLACK,
  style: 'anomaly',
  light: [hex('#f0ffff'), hex('#a0faff'), hex('#20d8f0'), hex('#1a4aa0')],
};

// Primavera's own materials: her skin, the blossoms, leaves and living wood.
const FAIR: Material = { ramp: ramp('#94706a', '#ccaaa0', '#f0d8cc', '#fff0e8'), outline: hex('#3a2020') };
const ROSE_PETAL: Material = { ramp: ramp('#a8406a', '#e0709a', '#ffa8c4', '#ffd8e4'), outline: hex('#4a1428'), emissive: 0.25, noAO: true, noOutline: true };
const WHITE_PETAL: Material = { ramp: ramp('#b0a49c', '#e2dad2', '#fbf6f0', '#ffffff'), outline: hex('#3a2e2a'), emissive: 0.2, noAO: true, noOutline: true };
const PEACH_PETAL: Material = { ramp: ramp('#b86a4a', '#f0a07a', '#ffc8a4', '#ffe6d2'), outline: hex('#4a2414'), emissive: 0.2, noAO: true, noOutline: true };
const POLLEN: Material = { ramp: ramp('#c8902a', '#f6d050', '#fff4a8'), outline: hex('#4a3010'), emissive: 0.5, noAO: true, noOutline: true };
const LEAF: Material = { ramp: ramp('#1e4a24', '#347a36', '#58a64e', '#8ed070'), outline: hex('#0c200e'), noAO: true, noOutline: true };
const VINE_WOOD: Material = { ramp: ramp('#2a2410', '#4a4020', '#6a6232', '#8e8a4a'), outline: hex('#141006') };
/** The blossoms her clocks and crown are made of, in turn. */
const BLOSSOMS = [ROSE_PETAL, WHITE_PETAL, PEACH_PETAL];

/**
 * Primavera, the timekeeper's skin: the spirit of spring and the turning
 * seasons. A gown of spring green embroidered with blossoms over a rose
 * underskirt, flowing rose-gold hair under a crown of fresh blossoms, and for
 * a clock a flower clock: a garland ring of twelve blossoms behind her head,
 * each hour's flower opening as the light comes round to it, and a staff of
 * living wood crowned with a dial of petals. Butterflies keep her company and
 * petals drift off her hem. Her magic is soft rose and mint.
 */
export const PRIMAVERA_LOOK: ChronoLook = {
  key: 'chrono_primavera',
  rift: false,
  robe: { ramp: ramp('#14301a', '#24502a', '#3a743c', '#5c9a52', '#88c272'), outline: hex('#08160a'), outlineLit: hex('#122a14') },
  inner: { ramp: ramp('#6a2a42', '#a4526c', '#d4869e', '#f4bccb'), outline: hex('#2e0c18') },
  trim: { ramp: ramp('#5a2e22', '#9a5a42', '#d0907a', '#f4c4aa', '#fff0e2'), outline: hex('#2a140c'), shine: true, noAO: true },
  hair: { ramp: ramp('#5e2430', '#9a4250', '#cc6a70', '#ec9a94', '#ffcabe'), outline: hex('#2a0c14'), outlineLit: hex('#44161e'), shine: true },
  hand: FAIR,
  style: 'primavera',
  light: [hex('#fffaf2'), hex('#ffd0de'), hex('#f48cae'), hex('#4cb88c')],
};

/** The anomaly's other light, where it tears. */
const MAGENTA: RGB = hex('#ff38c8');

export const CHRONO_LOOKS = [KEEPER_LOOK, MOON_LOOK, PARADOX_LOOK, AEON_LOOK, CLOCKWORK_LOOK, ANOMALY_LOOK, PRIMAVERA_LOOK];

/** The look being drawn; set by buildChronoFrames. */
let S: ChronoLook = KEEPER_LOOK;

// ---------------------------------------------------------------------------
// The rig

/** A hand, in the chronomancer's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

export interface Pose {
  /** Whole body raised (walk passing frames, rising with the spell). */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The staff (or watch) hand and the casting hand. */
  a: Hand;
  b: Hand;
  /** The staff leaning forward from upright, in radians. */
  tilt: number;
  /** 0..1 the hourglass (or the watch) lit. */
  glow: number;
  /** 0..1 light gathered in the casting hand. */
  cast: number;
  /** The hem swinging, in pixels. */
  sway: number;
  tick: number;
  blink?: boolean;
  /** The timekeeper's pocket watch in his free hand (the idle moment). */
  pocket?: Pocket;
  /** Eyes turned this many pixels to the viewer's right (the paradox's idle moment). */
  look?: number;
  /** A time-echo of him, `dx` px aside and `k` strong, standing in its own pose (the paradox's idle moment). */
  echo?: { pose: Pose; dx: number; k: number };
}

/** The pocket watch: its lid open or shut, a glint as it snaps, ticks rising off it when held to the ear. */
interface Pocket {
  open: boolean;
  glint?: number;
  ticks?: boolean;
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
  if (view === 'up') return { x: 12 - side * q.s, y: CH + U - q.h - q.f * 0.8, behind: q.f > 1 };
  // Facing left; `a` is the far arm, a touch higher and behind the body.
  const far = arm === 'a';
  return { x: hx - 1 - q.f * 1.05 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), behind: far && q.f < 1 };
}

/** A small cross of light, the arms growing with `k`. */
function glowAt(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.light;
  c.spark(x, y, core, k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + dx, y + dy, hot, 0.6 * k);
  if (k > 0.6) for (const [dx, dy] of [[2, 0], [-2, 0], [0, -2], [0, 2]]) c.spark(x + dx, y + dy, mid, 0.4 * k);
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

/**
 * An arm: the timekeeper's wide bell sleeve with a brass cuff, or the
 * paradox's fitted coat sleeve with a seam of light at the wrist; then the hand.
 */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bias = 0): void {
  const [ex, ey] = elbow(sx, sy, p.x, p.y, reach, hint);
  const wx = ex + (p.x - ex) * 0.72;
  const wy = ey + (p.y - ey) * 0.72;
  if (S.style === 'clockwork') {
    // Jointed pipes: copper upper arm and forearm, brass balls at the shoulder and elbow, an iron hand.
    c.part();
    c.capsule(sx, sy, ex, ey, 1.2, 1.1, S.robe, { bias });
    c.part();
    c.capsule(ex, ey, wx, wy, 1.1, 1.2, S.robe, { bias });
    c.part();
    c.ellipse(ex, ey, 1.1, 1.1, S.trim, { bias });
    c.ellipse(wx, wy, 1.2, 0.9, S.trim, { bias });
    c.part();
    c.ellipse(p.x, p.y, 1.2, 1.1, IRON, { bias });
    return;
  }
  c.part();
  c.capsule(sx, sy, ex, ey, 1.8, 1.55, S.robe, { bias });
  c.part();
  if (S.rift) c.capsule(ex, ey, wx, wy, 1.5, 1.3, S.robe, { bias });
  else c.capsule(ex, ey, wx, wy, 1.5, 2.1, S.robe, { bias });
  c.part();
  c.ellipse(wx, wy, S.rift ? 1.1 : 1.5, S.rift ? 1.0 : 1.2, S.trim, { bias });
  c.part();
  c.ellipse(p.x, p.y, 1.15, 1.1, S.hand ?? SKIN, { bias });
}

/** Small dark boots under the hem. */
function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  c.ellipse(x, y, side ? 2.1 : 1.6, 1.2, BOOT, { flatten: 0.8, bias });
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) c.px(x, y, SKIN, sphere(0, -0.3), { bias: -1 });
    else c.px(x, y, EYE);
  }
}

// ---------------------------------------------------------------------------
// The staff and the watch

/**
 * The timekeeper's staff: dark wood shod in brass at the foot, rising to an
 * hourglass in a brass cage. The sand in its lower bulb glows, a thread of it
 * falling from the upper; `up` is the staff's direction from the hand.
 */
function drawStaff(c: PixelCanvas, p: Placed, ux: number, uy: number, glow: number, tick: number, bias = 0): void {
  const below = 10;
  const above = 11.5;
  const vx = -uy;
  const vy = ux;
  c.part();
  c.line(p.x - ux * below, p.y - uy * below, p.x + ux * above, p.y + uy * above, STAFF_WOOD, () => sphere(vx * 0.6, vy * 0.6 - 0.2), { bias });
  c.part();
  c.px(p.x - ux * below, p.y - uy * below, S.trim, sphere(0, 0.3), { bias });
  // The hourglass: a cap, two bulbs of glass pinched in the middle, a cap.
  const at = (k: number) => [p.x + ux * (above + k), p.y + uy * (above + k)] as const;
  const [bx, by] = at(0.8);
  const [tx, ty] = at(6.2);
  c.part();
  for (const k of [0.8, 6.2]) {
    const [x, y] = at(k);
    c.capsule(x - vx * 1.9, y - vy * 1.9, x + vx * 1.9, y + vy * 1.9, 0.75, 0.75, S.trim, { bias });
  }
  c.part();
  for (const [k, w] of [[1.9, 1.3], [2.8, 0.7], [3.5, 0.35], [4.2, 0.7], [5.1, 1.3]] as const) {
    const [x, y] = at(k);
    c.capsule(x - vx * w, y - vy * w, x + vx * w, y + vy * w, 0.55, 0.55, GLASS, { bias });
  }
  // Brass rods caging the glass.
  c.part();
  for (const s of [-1, 1]) c.line(bx + vx * 1.8 * s, by + vy * 1.8 * s, tx + vx * 1.8 * s, ty + vy * 1.8 * s, S.trim, () => sphere(s * 0.5, 0), { bias });
  // The sand: a heap glowing in the lower bulb, a thread falling, what's left above.
  const [core, hot, mid, deep] = S.light;
  const k = 0.35 + 0.65 * glow;
  const [lx, ly] = at(1.9);
  c.spark(lx, ly, hot, 0.9 * k);
  c.spark(lx + vx, ly + vy, mid, 0.7 * k);
  c.spark(lx - vx, ly - vy, mid, 0.7 * k);
  const [mx, my] = at(2.9 + (tick % 2) * 0.6);
  c.spark(mx, my, core, 0.8 * k);
  const [hx, hy] = at(4.6);
  c.spark(hx, hy, deep, 0.6 * k);
  if (glow > 0.5) glowAt(c, lx, ly - 1, (glow - 0.5) * 1.6);
}

/** The paradox's pocket watch: a brass case with a glowing face, on a chain back to his belt. */
function drawWatch(c: PixelCanvas, p: Placed, belt: [number, number], glow: number, tick: number, bias = 0): void {
  c.part();
  c.line(belt[0], belt[1], p.x, p.y + 0.5, GOLD, () => sphere(0, -0.4), { bias });
  const x = p.x + 0.4;
  const y = p.y + 1.6;
  c.part();
  c.ellipse(x, y, 1.7, 1.6, GOLD, { bias });
  c.part();
  c.px(x, y - 2, GOLD, sphere(0, -0.6), { bias });
  const [core, hot, mid] = S.light;
  const k = 0.45 + 0.55 * glow;
  c.spark(x, y, core, k);
  c.spark(x - 1, y, mid, 0.5 * k);
  // The hand turning round the face.
  const a = (tick % 4) * (Math.PI / 2);
  c.spark(x + Math.round(Math.cos(a)), y + Math.round(Math.sin(a)), hot, 0.9 * k);
  if (glow > 0.4) glowAt(c, x, y, (glow - 0.4) * 1.5);
}

/**
 * The timekeeper's own pocket watch, fished from his belt in the idle
 * moment: a small case in the trim's metal on a chain back to the belt, its
 * lid flipped up to the side when open and its face lit in the magic's light.
 */
function pocketWatch(c: PixelCanvas, h: Placed, belt: [number, number], w: Pocket, tick: number): void {
  const x = h.x;
  const y = h.y - 0.8;
  const [core, hot, mid] = S.light;
  c.part();
  c.line(belt[0], belt[1], x - 0.5, y + 1.4, S.trim, () => sphere(0, -0.4));
  c.part();
  c.ellipse(x, y, 1.6, 1.5, S.trim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.2, 1) });
  if (w.open) {
    // The lid stands up off the case's far side, seen nearly edge-on.
    c.part();
    c.ellipse(x + 2.2, y - 1.6, 0.8, 1.4, S.trim, { normal: (_x, _y, dx, dy) => sphere(0.5 + dx * 0.4, dy * 0.6 - 0.3, 1) });
    glowAt(c, x, y, 0.55);
    c.spark(x - 1, y, mid, 0.45);
    // The second hand going round the face.
    const a = (tick % 4) * (Math.PI / 2) - Math.PI / 2;
    c.spark(x + Math.round(Math.cos(a)), y + Math.round(Math.sin(a)), hot, 0.8);
  } else {
    c.part();
    c.px(x, y - 2, S.trim, sphere(0, -0.7));
  }
  if (w.glint) {
    c.spark(x - 1, y - 1, core, w.glint);
    glowAt(c, x, y - 1, w.glint * 0.8);
  }
  // Ticks rising off it, away from his ear: two short marks of light, taking turns.
  if (w.ticks) {
    const t = tick % 2;
    c.spark(x + 2 + t, y - 2 - t, hot, 0.75);
    c.spark(x + 3 + t, y - 3 - t, mid, 0.4);
  }
}

/** The belt buckle a watch chain hangs from, in body coordinates. */
const CHAIN_AT: [number, number] = [14.5, 21];

// ---------------------------------------------------------------------------
// The halo

/**
 * The timekeeper's clock ring, floating behind his head: brass with twelve
 * notches, drawn only where it shows round the head, a light running round
 * its hours. `rx` and `ry` squash it for the side view.
 */
function halo(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, tick: number, front: boolean): void {
  const [core, hot, mid] = S.light;
  // Seen from the front the ring hides behind the head and the shoulders; find what shows before drawing any of it.
  const shows = (x: number, y: number, s: number) => front || (s <= 0.45 && !c.filled(x, y));
  const ring: [number, number, number, number][] = [];
  const steps = 64;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    if (shows(x, y, Math.sin(a))) ring.push([x, y, Math.cos(a), Math.sin(a)]);
  }
  const hours: [number, number, number][] = [];
  for (let h = 0; h < 12; h++) {
    const a = -Math.PI / 2 + (h / 12) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    if (shows(x, y, Math.sin(a))) hours.push([x, y, h]);
  }
  c.part();
  if (S.style === 'primavera') {
    // Primavera's flower clock: a garland of leaves, a flower at each hour,
    // and each hour's flower open wide as the light comes round to it.
    for (const [i, [x, y]] of ring.entries()) if (i % 2 === 0) c.spark(x, y, S.light[3], 0.4);
    const lit = tick % 12;
    for (const [x, y, h] of hours) {
      const on = h === lit || h === (lit + 6) % 12;
      if (on) blossom(c, x, y, BLOSSOMS[h % 3], true, front ? 0 : -1);
      else {
        c.part();
        c.px(x, y, BLOSSOMS[h % 3], sphere(0, -0.2), { bias: front ? 0 : -1 });
      }
      c.spark(x, y, on ? core : hot, on ? 0.9 : 0.25);
    }
    return;
  }
  for (const [x, y, dx, dy] of ring) c.px(x, y, S.trim, sphere(dx * 0.6, dy * 0.6), { bias: front ? 0 : -1 });
  // The hours: a spark at each, and a light running round.
  const lit = tick % 12;
  for (const [x, y, h] of hours) {
    const on = h === lit || h === (lit + 6) % 12;
    c.spark(x, y, on ? core : h % 3 === 0 ? hot : mid, on ? 1 : h % 3 === 0 ? 0.6 : 0.3);
  }
}

// ---------------------------------------------------------------------------
// Heads

/** The timekeeper's head from the front: bald crown, white tufts, brows, spectacles, and the long beard. */
function sageDown(c: PixelCanvas, cx: number, U: number, blink: boolean | undefined): void {
  c.part();
  c.ellipse(cx, 11.8 + U, 3.0, 3.1, SKIN);
  // Tufts over the ears.
  c.part();
  c.ellipse(cx - 3.0, 12.4 + U, 1.2, 1.7, S.hair);
  c.ellipse(cx + 3.0, 12.4 + U, 1.2, 1.7, S.hair);
  skullcap(c, cx, U);
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], blink);
  // Spectacles: a glint on each lens, a brass bridge between.
  if (!blink) {
    c.spark(cx - 2, 12 + U, S.light[1], 0.35);
    c.spark(cx + 1, 12 + U, S.light[1], 0.35);
  }
  c.part();
  c.px(cx - 1, 12 + U, S.trim, sphere(0, -0.4));
  c.px(cx, 12 + U, S.trim, sphere(0, -0.4));
  // Bushy brows.
  c.part();
  for (const x of [cx - 3, cx - 2, cx + 1, cx + 2]) c.px(x, 11 + U, S.hair, sphere(0, -0.6));
  beardDown(c, cx, U);
}

/** A small wine skullcap on the crown, rimmed in brass. */
function skullcap(c: PixelCanvas, cx: number, U: number, x = cx): void {
  c.part();
  c.ellipse(x, 9.4 + U, 2.7, 1.6, S.inner, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.5, 1) });
  c.part();
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [x - 2.6, x + 2.6], S.trim, (_x, _y, t) => cyl(t, 0.2));
}

/** A long white beard from the cheeks to the chest, coming to a point. */
function beardDown(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.shape(Math.round(13 + U), Math.round(20 + U), (y) => {
    const u = (y - 13 - U) / 7;
    const hw = 3.1 - u * u * 2.6;
    return [cx - hw - 0.5, cx + hw - 0.5];
  }, S.hair, (_x, _y, t, u) => sphere(t * 0.8, u * 0.8 - 0.2, 1));
  // The moustache, and strands down the beard.
  c.shade(cx - 2, 14 + U, 1);
  c.shade(cx + 1, 14 + U, 1);
  c.shade(cx - 1, 14 + U, -1);
  c.shade(cx, 14 + U, -1);
  for (let y = 16; y <= 19; y++) c.shade(cx - 1 + ((y & 1) === 0 ? -1 : 1), y + U, -1);
}

/** The paradox's hood from the front: a deep cowl, white hair spilling out, eyes burning in the shadow. */
function hoodDown(c: PixelCanvas, cx: number, U: number, blink: boolean | undefined, look = 0): void {
  c.part();
  c.shape(Math.round(7 + U), Math.round(16 + U), (y) => {
    const u = (y - 7 - U) / 9;
    const hw = u < 0.35 ? 2.2 + Math.sqrt(u / 0.35) * 2.2 : 4.4 + (u - 0.35) * 1.2;
    return [cx - hw, cx + hw];
  }, S.robe, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.4, 1));
  // A seam of light up the hood's crown.
  c.part();
  c.px(cx, 7 + U, S.trim, sphere(0, -0.7));
  c.px(cx, 8 + U, S.trim, sphere(0, -0.5));
  // The opening, deep in shadow, the face inside it.
  c.part();
  c.ellipse(cx - 0.3, 12.8 + U, 2.8, 3.0, S.inner);
  c.part();
  c.ellipse(cx - 0.3 + look * 0.5, 13.2 + U, 2.2, 2.2, SKIN, { bias: -1 });
  // White hair falling across the brow and down one side.
  c.part();
  c.shape(Math.round(10 + U), Math.round(11 + U), (y) => (y === Math.round(10 + U) ? [cx - 2.6, cx + 2] : [cx - 2.4, cx - 0.2]), S.hair, (_x, _y, t) => sphere(t * 0.7, -0.4, 1));
  c.px(cx - 3, 12 + U, S.hair, sphere(-0.6, 0));
  c.px(cx - 3, 13 + U, S.hair, sphere(-0.6, 0.3));
  const ex = cx + look;
  eyes(c, [[ex - 2, 13 + U], [ex + 1, 13 + U]], blink);
  if (!blink) {
    const [core, hot] = S.light;
    c.spark(ex - 2, 13 + U, core, 0.9);
    c.spark(ex + 1, 13 + U, core, 0.9);
    c.spark(ex - 3, 13 + U, hot, 0.3);
    c.spark(ex + 2, 13 + U, hot, 0.3);
  }
}

// ---------------------------------------------------------------------------
// The clockwork

/** A gear of `teeth` teeth round (x, y), turned by `turn` of a tooth, in `m`; its hub left open for a light. */
function gear(c: PixelCanvas, x: number, y: number, r: number, teeth: number, turn: number, m: Material, bias = 0): void {
  c.part();
  for (let yy = Math.floor(y - r - 1); yy <= Math.ceil(y + r + 1); yy++) {
    for (let xx = Math.floor(x - r - 1); xx <= Math.ceil(x + r + 1); xx++) {
      const dx = xx + 0.5 - x;
      const dy = yy + 0.5 - y;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const tooth = Math.cos(a * teeth - turn * Math.PI * 2) > 0.2;
      if (d > r + (tooth ? 0.9 : 0) || d < r * 0.4) continue;
      c.px(xx, yy, m, sphere((dx / (r + 1)) * 0.8, (dy / (r + 1)) * 0.8 - 0.2, 1), { bias });
    }
  }
}

/** The clockwork's staff: an iron rod, a brass cog turning at its head round a radium lamp. */
function drawCogStaff(c: PixelCanvas, p: Placed, ux: number, uy: number, glow: number, tick: number, bias = 0): void {
  const below = 10;
  const above = 11.5;
  const vx = -uy;
  const vy = ux;
  c.part();
  c.line(p.x - ux * below, p.y - uy * below, p.x + ux * above, p.y + uy * above, IRON, () => sphere(vx * 0.6, vy * 0.6 - 0.2), { bias });
  c.part();
  c.px(p.x - ux * below, p.y - uy * below, S.trim, sphere(0, 0.3), { bias });
  c.px(p.x + ux * 4, p.y + uy * 4, S.trim, sphere(0, -0.3), { bias });
  const hx = p.x + ux * (above + 2.8);
  const hy = p.y + uy * (above + 2.8);
  gear(c, hx, hy, 2.3, 8, tick / 8, S.trim, bias);
  const [core, hot, mid] = S.light;
  const k = 0.45 + 0.55 * glow;
  c.spark(hx, hy, core, k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(hx + dx, hy + dy, hot, 0.5 * k);
  if (glow > 0.5) glowAt(c, hx, hy, (glow - 0.5) * 1.6);
  else c.spark(hx + 1, hy + 1, mid, 0.3);
}

/** The alarm clock's bells on his head, the hammer between them shaking (and ringing) when `ring`. */
function bells(c: PixelCanvas, cx: number, top: number, ring: number, tick: number, side = false): void {
  const shake = ring > 0.5 ? (tick % 4 < 2 ? -1 : 1) * 0.6 : 0;
  c.part();
  for (const s of side ? [1, -1] : [-1, 1]) {
    const x = cx + s * (side ? 1.2 : 2.5);
    c.px(x - s * 0.6, top + 1.4, S.trim, sphere(0, 0), { bias: side && s > 0 ? -1 : 0 });
    c.ellipse(x, top, 1.7, 1.35, S.trim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7 - 0.3, 1), bias: side && s > 0 ? -1 : 0 });
  }
  c.part();
  c.px(cx + shake, top - 0.2, IRON, sphere(0, -0.4));
  c.px(cx + shake, top - 1.2, S.trim, sphere(0, -0.7));
  if (ring > 0.5) {
    const [core, hot] = S.light;
    c.spark(cx - 3.6, top - 1.6, hot, ring * 0.6);
    c.spark(cx + 3.6, top - 1.6, hot, ring * 0.6);
    c.spark(cx + shake, top - 2.2, core, ring * 0.5);
  }
}

/** The clock face from the front: a cream dial in a copper rim, radium hours for eyes, hands that turn with `tick`. */
function clockHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  bells(c, cx, 7.6 + U, p.glow, p.tick);
  c.part();
  c.ellipse(cx, 11.4 + U, 3.5, 3.4, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.ellipse(cx, 11.5 + U, 2.6, 2.5, DIAL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.5, dy * 0.5 - 0.1, 1) });
  // Hour marks at twelve, three, six and nine.
  c.part();
  for (const [x, y] of [[cx, 9.4], [cx + 2, 11.5], [cx, 13.6], [cx - 2.4, 11.5]] as const) c.px(x, y + U, DIAL_INK);
  // The hands, from the middle: a long one turning round, a short one.
  const a = (p.tick / 12) * Math.PI * 2 - Math.PI / 2;
  c.px(cx + Math.round(Math.cos(a) * 1.6), 11.5 + U + Math.round(Math.sin(a) * 1.6), DIAL_INK);
  c.px(cx + Math.round(Math.cos(a) * 0.9), 11.5 + U + Math.round(Math.sin(a) * 0.9), DIAL_INK);
  c.px(cx, 11.5 + U, S.trim, sphere(0, -0.3));
  // Two radium hours for eyes.
  if (!p.blink) {
    const [core, hot] = S.light;
    for (const x of [cx - 1.6, cx + 1.4]) {
      c.spark(x, 10.4 + U, core, 0.95);
      c.spark(x, 11.4 + U, hot, 0.25);
    }
  }
}

/** The copper barrel of his chest, a porthole with a gear turning inside it (front), or the key in his back. */
function clockChest(c: PixelCanvas, cx: number, U: number, tick: number, back: boolean): void {
  const top = 15 + U;
  const waist = 21 + U;
  c.part();
  c.shape(top, waist, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 4.2 + Math.sin(u * Math.PI) * 0.6;
    return [cx - hw, cx + hw];
  }, S.robe, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.4, 1));
  // Rivets down the seams.
  for (let y = top + 1; y < waist; y += 2) {
    c.shade(cx - 4, y, 2);
    c.shade(cx + 3, y, 2);
  }
  // Brass bands at the top and bottom of the barrel.
  c.part();
  c.shape(top, top, () => [cx - 4.1, cx + 4.1], S.trim, (_x, _y, t) => cyl(t, 0.2));
  c.shape(waist, waist, () => [cx - 4.2, cx + 4.2], S.trim, (_x, _y, t) => cyl(t, 0));
  if (back) return;
  c.part();
  c.ellipse(cx, 18 + U, 2.3, 2.1, CASE_GLASS);
  gear(c, cx - 0.3, 18.2 + U, 1.3, 6, tick / 6, S.trim);
  c.spark(cx - 0.3, 18.2 + U, S.light[1], 0.6);
  c.part();
  for (let a = 0; a < 12; a++) {
    const t = (a / 12) * Math.PI * 2;
    c.px(cx + Math.cos(t) * 2.5, 18 + U + Math.sin(t) * 2.3, S.trim, sphere(Math.cos(t) * 0.6, Math.sin(t) * 0.6));
  }
}

/** Brass pauldrons like cogs on each shoulder. */
function cogShoulders(c: PixelCanvas, cx: number, U: number, span: number, tick: number): void {
  for (const s of [-1, 1]) gear(c, cx + s * span, 15.8 + U, 1.4, 6, (tick + (s > 0 ? 3 : 0)) / 12, S.trim);
}

/** The grandfather clock's case that is his lower half: a copper box on a moulded base, a pendulum swinging behind the glass at the front. */
function clockCase(c: PixelCanvas, cx: number, U: number, L: number, tick: number, back: boolean): void {
  const top = 21 + U;
  const hem = 29 + L;
  c.part();
  c.shape(top + 1, hem, (y) => {
    const base = y >= hem - 1 ? 0.7 : 0;
    const hw = 3.7 + (y - top) * 0.08 + base;
    return [cx - hw, cx + hw];
  }, S.robe, (_x, y, t) => sphere(t * 0.9, y >= hem - 1 ? 0.4 : 0.1, 1));
  c.part();
  c.shape(hem, hem, () => [cx - 4.8, cx + 4.8], S.trim, (_x, _y, t) => cyl(t, 0.4));
  if (back) {
    for (let y = top + 2; y < hem - 1; y++) c.shade(cx, y, -1);
    return;
  }
  // The window, the pendulum's rod and bob swinging across it.
  c.part();
  c.shape(Math.round(top + 2), Math.round(hem - 2), () => [cx - 1.9, cx + 1.9], CASE_GLASS, () => sphere(0, 0, 1));
  const sw = Math.sin((tick / 12) * Math.PI * 2) * 1.1;
  c.part();
  c.line(cx, top + 2, cx + sw * 0.7, hem - 3.4, S.trim, () => sphere(0, 0));
  c.ellipse(cx + sw, hem - 2.8, 0.9, 0.9, S.trim);
  c.spark(cx + sw, hem - 2.8, S.light[2], 0.35);
  // A brass frame round the glass.
  for (let y = Math.round(top + 2); y <= Math.round(hem - 2); y++) {
    c.shade(cx - 2, y, 1);
    c.shade(cx + 1, y, 1);
  }
}

/** The wind-up key in his back, turning: `w` from edge-on (0) to broadside (1). */
function windKey(c: PixelCanvas, x: number, y: number, tick: number, side: boolean): void {
  const w = Math.abs(Math.cos((tick / 8) * Math.PI));
  c.part();
  if (side) {
    // Seen from the side it sticks out behind him.
    c.line(x, y, x + 2, y, S.trim, () => sphere(0, -0.4));
    c.ellipse(x + 3, y, 0.8, 0.8 + w * 1.6, S.trim);
    return;
  }
  c.px(x, y + 0.6, S.trim, sphere(0, -0.3));
  for (const s of [-1, 1]) c.ellipse(x + s * (0.6 + w * 1.4), y, 0.5 + w * 0.9, 1.3, S.trim, { bias: w < 0.4 ? -1 : 0 });
}

/** The clockwork in profile, facing left: the case and the barrel, the key sticking out behind, the clock head turned, its dial edge-on. */
function clockSide(c: PixelCanvas, cx: number, hx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 21 + U;
  const hem = 29 + L;
  windKey(c, hx + 3.6, 18 + U, p.tick, true);
  c.part();
  c.shape(waist + 1, hem, (y) => {
    const base = y >= hem - 1 ? 0.7 : 0;
    const shift = hx + (cx - hx) * ((y - waist) / (hem - waist));
    const hw = 3.2 + base;
    return [shift - hw, shift + hw];
  }, S.robe, (_x, y, t) => sphere(t * 0.9 - 0.1, y >= hem - 1 ? 0.4 : 0.1, 1));
  c.part();
  c.shape(hem, hem, () => [cx - 4.2, cx + 4.2], S.trim, (_x, _y, t) => cyl(t, 0.4));
  for (let y = waist + 2; y < hem - 1; y++) c.shade(Math.round(hx - 2 + ((y - waist) / (hem - waist)) * (cx - hx)), y, 1);
  c.part();
  c.shape(top, waist, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 3.2 + Math.sin(u * Math.PI) * 0.5;
    return [hx - hw - 0.2, hx + hw];
  }, S.robe, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, u * 0.8 - 0.4, 1));
  c.part();
  c.shape(top, top, () => [hx - 3.3, hx + 3.2], S.trim, (_x, _y, t) => cyl(t, 0.2));
  c.shape(waist, waist, () => [hx - 3.4, hx + 3.2], S.trim, (_x, _y, t) => cyl(t, 0));
  // The porthole's rim on his front.
  for (let y = 17; y <= 19; y++) c.px(Math.round(hx - 3.6), y + U, S.trim, sphere(-0.6, 0));
  c.spark(hx - 3, 18 + U, S.light[2], 0.3);
  gear(c, hx - 0.2, 15.8 + U, 1.4, 6, p.tick / 12, S.trim);
  bells(c, hx - 0.2, 7.6 + U, p.glow, p.tick, true);
  c.part();
  c.ellipse(hx - 0.2, 11.4 + U, 3.2, 3.4, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  // The dial, seen edge-on on the front of the clock.
  c.part();
  c.ellipse(hx - 2.4, 11.5 + U, 1.1, 2.4, DIAL, { normal: (_x, _y, dx, dy) => sphere(-0.5 + dx * 0.3, dy * 0.5, 1) });
  c.px(hx - 3, 11.5 + U, DIAL_INK);
  if (!p.blink) {
    c.spark(hx - 3, 10.4 + U, S.light[0], 0.95);
    c.spark(hx - 3, 11.4 + U, S.light[1], 0.25);
  }
}

// ---------------------------------------------------------------------------
// The anomaly

/** Shards of him orbiting his head, passing behind it and in front. */
function orbiters(c: PixelCanvas, cx: number, cy: number, tick: number): void {
  const [core, hot] = S.light;
  for (let i = 0; i < 3; i++) {
    const a = (tick / 12) * Math.PI * 2 + (i / 3) * Math.PI * 2;
    const x = cx + Math.cos(a) * 5.2;
    const y = cy + Math.sin(a) * 1.3;
    const behind = Math.sin(a) < 0;
    if (behind && c.filled(Math.floor(x), Math.floor(y))) continue;
    c.part();
    c.px(x, y, S.robe, sphere(0, -0.3), { bias: behind ? -1 : 1 });
    c.spark(x, y - 1, i === 1 ? MAGENTA : hot, 0.5);
    c.spark(x + 1, y, core, 0.25);
  }
}

/** The visor from the front: a smooth black head in a high split collar, one slit of light scanning across it. */
function visorDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  c.part();
  c.ellipse(cx, 11.2 + U, 3.2, 3.4, VISOR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.25, 1) });
  // The collar standing up round his jaw, split at the front, lined with light.
  c.part();
  for (const s of [-1, 1]) {
    c.shape(Math.round(13 + U), Math.round(16 + U), (y) => {
      const u = (y - 13 - U) / 3;
      const inner = 2.4 - u * 1.2;
      const outer = 3.8 - u * 0.2;
      return s < 0 ? [cx - outer, cx - inner] : [cx + inner, cx + outer];
    }, S.robe, (_x, _y, t, u) => sphere(t * 0.6 + s * 0.3, u * 0.6 - 0.2, 1));
  }
  c.part();
  for (let y = 13; y <= 15; y++) {
    const u = (y - 13) / 3;
    c.px(Math.round(cx - 2.4 + u * 1.2), y + U, S.trim, sphere(0.3, 0));
    c.px(Math.round(cx + 2.4 - u * 1.2) - 1, y + U, S.trim, sphere(-0.3, 0));
  }
  const look = p.look ?? 0;
  visorSlit(c, cx - 2 + look, cx + 1 + look, 11 + U, p);
}

/** The visor in profile, facing left: the black head in its collar, the slit of light at its front. */
function visorSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  c.part();
  c.ellipse(hx - 0.8, 11.2 + U, 3.0, 3.4, VISOR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 - 0.1, dy * 0.8 - 0.25, 1) });
  c.part();
  c.shape(Math.round(13 + U), Math.round(16 + U), (y) => {
    const u = (y - 13 - U) / 3;
    return [hx - 0.6 - u * 1.8, hx + 3.0 - u * 0.4];
  }, S.robe, (_x, _y, t, u) => sphere(t * 0.8 + 0.2, u * 0.6 - 0.2, 1));
  c.part();
  for (let y = 13; y <= 15; y++) c.px(Math.round(hx - 0.6 - ((y - 13) / 3) * 1.8), y + U, S.trim, sphere(-0.4, 0));
  visorSlit(c, Math.round(hx - 3.6), Math.round(hx - 2), 11 + U, p);
  orbiters(c, hx, 7.4 + U, p.tick);
}

/** The slit of light across the visor, from x0 to x1 on row y, a brighter point scanning along it (dark for a blink). */
function visorSlit(c: PixelCanvas, x0: number, x1: number, y: number, p: Pose): void {
  if (p.blink) return;
  const [core, hot, mid] = S.light;
  const scan = x0 + ((p.tick >> 1) % (x1 - x0 + 1));
  c.part();
  for (let x = x0; x <= x1; x++) {
    c.px(x, y, S.trim, sphere(0, 0));
    c.spark(x, y, x === scan ? core : hot, x === scan ? 1 : 0.5);
  }
  c.spark(x0 - 1, y, mid, 0.4);
  c.spark(x1 + 1, y, MAGENTA, 0.4);
}

/** A tesseract of light turning in his hand: two squares, one inside the other, their corners joined. */
function drawCube(c: PixelCanvas, p: Placed, glow: number, tick: number): void {
  const [core, hot, mid] = S.light;
  const x = p.x + 0.4;
  const y = p.y - 1.6;
  const k = 0.5 + 0.5 * glow;
  const t = (tick / 8) * Math.PI;
  const outer = 2.2;
  for (let i = 0; i < 4; i++) {
    const a = t + (i / 4) * Math.PI * 2;
    const b = t + ((i + 1) / 4) * Math.PI * 2;
    const ax = x + Math.cos(a) * outer;
    const ay = y + Math.sin(a) * outer * 0.8;
    const bx = x + Math.cos(b) * outer;
    const by = y + Math.sin(b) * outer * 0.8;
    for (let j = 0; j <= 3; j++) c.spark(ax + ((bx - ax) * j) / 3, ay + ((by - ay) * j) / 3, i === 0 ? MAGENTA : mid, 0.6 * k);
    // The inner square's corner, and the strut to it.
    const ix = x + Math.cos(a - t * 2) * 0.9;
    const iy = y + Math.sin(a - t * 2) * 0.9;
    c.spark(ix, iy, hot, 0.8 * k);
  }
  c.spark(x, y, core, k);
  if (glow > 0.4) glowAt(c, x, y, (glow - 0.4) * 1.5);
}

/**
 * The glitch: on some frames a band of rows tears a pixel or two sideways,
 * cyan light fringing its left edge and magenta its right. Picked from the
 * frame's tick and view, so each frame always tears the same way.
 */
function glitch(c: PixelCanvas, tick: number, view: View): void {
  const h = (tick * 5 + (view === 'down' ? 0 : view === 'up' ? 3 : 6)) % 7;
  if (h > 2) return;
  const y0 = BODY_Y + 8 + ((tick * 7 + h * 5) % 17);
  const dx = (tick + h) % 2 ? 1 : -1;
  const rows = h === 0 ? 2 : 1;
  const [, hot] = S.light;
  for (let y = y0; y < y0 + rows; y++) {
    shiftRow(c, y, dx * (h === 1 ? 2 : 1));
    let l = -1;
    let r = -1;
    for (let x = 0; x < c.w; x++) {
      if (c.mat[y * c.w + x] < 0) continue;
      if (l < 0) l = x;
      r = x;
    }
    if (l < 0) continue;
    // Spark takes figure coordinates; undo the frame's offset.
    c.spark(l - 1 - BODY_X, y - BODY_Y, hot, 0.8);
    c.spark(r + 1 - BODY_X, y - BODY_Y, MAGENTA, 0.8);
  }
}

// ---------------------------------------------------------------------------
// Primavera: blossoms, her head, her gown, her staff and her butterflies

const LIP: Material = { ramp: ramp('#a84a62', '#d8728a'), outline: hex('#4a1828'), noOutline: true, noAO: true };

/** A blossom a few pixels across: a heart of pollen and four petals round it, or, `open` false, a closed bud. */
function blossom(c: PixelCanvas, x: number, y: number, m: Material, open = true, bias = 0): void {
  c.part();
  if (!open) {
    c.px(x, y, m, sphere(0, -0.3), { bias });
    c.px(x, y + 1, LEAF, sphere(0, 0.4), { bias });
    return;
  }
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) c.px(x + dx, y + dy, m, sphere(dx * 0.6, dy * 0.6), { bias });
  c.px(x, y, POLLEN, sphere(0, 0), { bias });
}

/** Her crown of fresh blossoms across the top of her head, a sprig of leaves between them. */
function crown(c: PixelCanvas, cx: number, y: number, bias = 0): void {
  c.part();
  for (const dx of [-2, -1, 1, 2]) c.px(cx + dx - 0.5, y + 1, LEAF, sphere(dx * 0.2, -0.3), { bias });
  blossom(c, cx - 3.5, y + 0.6, ROSE_PETAL, true, bias);
  blossom(c, cx + 2.5, y + 0.6, ROSE_PETAL, true, bias);
  blossom(c, cx - 0.5, y - 0.4, WHITE_PETAL, true, bias);
}

/** Her head from the front: a soft face, a centre parting, rose-gold hair flowing to her waist, the crown. */
function springHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  c.part();
  c.ellipse(cx - 0.5, 11.6 + U, 3.9, 3.9, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  // Long locks falling over her shoulders, waved.
  c.part();
  for (const s of [-1, 1]) {
    c.capsule(cx + s * 3.1 - 0.5, 12 + U, cx + s * 4.0 - 0.5 + p.sway * 0.3, 21 + U, 1.5, 1.1, S.hair);
    for (let y = 14; y <= 20; y += 2) c.shade(cx + s * 3.4 - 0.5 + (y % 4 === 0 ? s : 0), y + U, -1);
  }
  c.part();
  c.ellipse(cx - 0.5, 12.8 + U, 2.5, 2.7, FAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 + 0.1, 1) });
  // The fringe, parted in the middle and swept to the sides.
  c.part();
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [cx - 3.2, cx + 2.2], S.hair, (_x, _y, t) => sphere(t * 0.8, -0.5, 1));
  for (const x of [cx - 3, cx - 2, cx + 1]) c.px(x, 11 + U, S.hair, sphere((x - cx) * 0.3, 0));
  eyes(c, [[cx - 2, 13 + U], [cx, 13 + U]], p.blink);
  c.part();
  c.px(cx - 1, 15 + U, LIP, sphere(0, 0.3));
  crown(c, cx, 8.2 + U);
}

/** Her head from behind: her hair falling long to her waist in waves, the crown over it. */
function springHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  c.part();
  c.ellipse(cx - 0.5, 11.6 + U, 3.9, 3.9, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.shape(Math.round(13 + U), Math.round(23 + U), (y) => {
    const u = (y - 13 - U) / 10;
    const hw = 3.6 - u * 1.4;
    const s = u * u * p.sway * 0.8;
    return [cx - 0.5 - hw + s, cx - 0.5 + hw + s];
  }, S.hair, (_x, _y, t, u) => sphere(t * 0.8, u * 0.5 - 0.1, 1));
  // Waves down it, and the tips parting at the end.
  for (let y = 14; y <= 22; y++) {
    const w = y % 4 < 2 ? 0 : 1;
    c.shade(cx - 2 + w, y + U, -1);
    c.shade(cx + 1 - w, y + U, -1);
  }
  c.erase(cx - 1, Math.round(23 + U));
  c.shade(cx - 1, 10 + U, 1);
  crown(c, cx, 8.2 + U, -1);
}

/** Her head in profile, facing left: her face, her hair flowing down her back, the crown. */
function springHeadSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  c.part();
  c.ellipse(hx + 0.6, 11.8 + U, 3.4, 3.8, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.2, 1) });
  c.part();
  c.shape(Math.round(13 + U), Math.round(22 + U), (y) => {
    const u = (y - 13 - U) / 9;
    const back = hx + 3.8 + u * (1 + p.sway * 0.6);
    return [back - 3.4 + u * 1.2, back];
  }, S.hair, (_x, _y, t, u) => sphere(t * 0.8 + 0.2, u * 0.5 - 0.1, 1));
  for (let y = 14; y <= 21; y++) c.shade(hx + 2 + (y % 4 < 2 ? 0 : 1) + Math.round((y - 14) * 0.15), y + U, -1);
  c.part();
  c.ellipse(hx - 1.5, 12.9 + U, 2.0, 2.5, FAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 - 0.3, dy * 0.6 + 0.1, 1) });
  c.px(hx - 4, 13 + U, FAIR, sphere(-0.8, 0));
  c.part();
  c.shape(Math.round(10 + U), Math.round(11 + U), () => [hx - 3.4, hx + 0.6], S.hair, (_x, _y, t, u) => sphere(t * 0.8 - 0.2, u * 0.5 - 0.5, 1));
  c.capsule(hx - 0.2, 12 + U, hx - 0.2, 17 + U, 0.8, 0.6, S.hair);
  eyes(c, [[hx - 3, 13 + U]], p.blink);
  c.part();
  c.px(hx - 3, 15 + U, LIP, sphere(-0.3, 0.3));
  blossom(c, hx - 2, 9 + U, ROSE_PETAL);
  blossom(c, hx + 1, 8.4 + U, WHITE_PETAL);
  c.part();
  c.px(hx + 3, 9 + U, LEAF, sphere(0.4, -0.3));
}

/**
 * Her gown from the front or back: spring green, fitted at the bodice and
 * flaring wide, open at the front over a rose underskirt, blossoms
 * embroidered over the skirt, a rose sash tied in a bow, a hem of rose gold.
 */
function gownFront(c: PixelCanvas, cx: number, U: number, L: number, sway: number, back: boolean): void {
  const top = 15 + U;
  const waist = 21 + U;
  const hem = 30 + L;
  c.part();
  c.shape(top, hem, (y) => {
    const hw = y <= waist ? 4.2 - 0.9 * ((y + 0.5 - top) / (waist - top)) : 3.5 + (y - waist) * 0.42;
    const s = y > waist ? ((y - waist) / (hem - waist)) * sway : 0;
    return [cx - hw + s, cx + hw + s];
  }, S.robe, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  // Soft folds falling from the waist.
  for (let y = waist + 2; y < hem; y++) {
    const s = ((y - waist) / (hem - waist)) * sway;
    for (const k of [-3.4, 3.4]) c.shade(Math.round(cx + (k * (y - waist)) / (hem - waist) + s), y, -1);
  }
  if (!back) {
    // The underskirt in the opening.
    c.part();
    for (let y = waist + 1; y <= hem; y++) {
      const s = ((y - waist) / (hem - waist)) * sway;
      const hw = (y - waist) * 0.24;
      c.shape(y, y, () => [cx - hw - 0.3 + s, cx + hw + 0.3 + s], S.inner, (_x, _y, t) => sphere(t * 0.5, 0.4, 1));
    }
    // The neckline: a curve of skin under a line of rose gold.
    c.part();
    for (const x of [cx - 2, cx - 1, cx, cx + 1]) c.px(x, top, FAIR, sphere((x - cx) * 0.3, -0.2));
    c.px(cx - 1, top + 1, FAIR, sphere(0, 0));
    c.px(cx, top + 1, FAIR, sphere(0, 0));
    c.part();
    for (const x of [cx - 3, cx + 2]) c.px(x, top + 1, S.trim, sphere(0, -0.3));
    for (const x of [cx - 2, cx + 1]) c.px(x, top + 2, S.trim, sphere(0, -0.3));
  }
  // Blossoms embroidered over the skirt.
  const flowers: [number, number][] = back ? [[-3, 3], [2, 5], [-1, 7], [3, 8]] : [[-3, 3], [3, 5], [-4, 7], [4, 8]];
  flowers.forEach(([dx, dy], i) => {
    const y = waist + dy;
    const x = cx + dx + ((y - waist) / (hem - waist)) * sway;
    if (!c.filled(Math.round(x), y)) return;
    c.part();
    c.px(x, y, BLOSSOMS[i % 3], sphere(0, 0), { glow: 0.1 });
    c.px(x + 1, y, BLOSSOMS[i % 3], sphere(0.4, 0), { glow: 0.1, bias: -1 });
    c.px(x, y - 1, LEAF, sphere(0, -0.3));
  });
  // The rose-gold hem.
  c.part();
  for (let x = cx - 9; x <= cx + 9; x++) if (c.filled(x, hem)) c.px(x, hem, S.trim, sphere((x - cx) / 8, 0.3));
  // The sash, and its bow at her side.
  c.part();
  c.shape(waist, waist, () => [cx - 3.4, cx + 3.4], S.inner, (_x, _y, t) => cyl(t, 0));
  const bx = back ? cx - 1 : cx + 2;
  c.part();
  c.px(bx - 1, waist - 1, S.inner, sphere(-0.4, -0.3));
  c.px(bx + 1, waist - 1, S.inner, sphere(0.4, -0.3));
  c.px(bx, waist, POLLEN, sphere(0, 0));
  c.px(bx - 1, waist + 1, S.inner, sphere(-0.3, 0.4));
  c.px(bx + 1, waist + 2, S.inner, sphere(0.3, 0.4));
}

/**
 * Her staff: living wood with leaves budding from it, crowned with a flower
 * clock, a ring of petals round a heart of light and a hand of light going
 * round it. `up` is the staff's direction from the hand.
 */
function drawBloomStaff(c: PixelCanvas, p: Placed, ux: number, uy: number, glow: number, tick: number, bias = 0): void {
  const below = 10;
  const above = 11;
  const vx = -uy;
  const vy = ux;
  c.part();
  c.line(p.x - ux * below, p.y - uy * below, p.x + ux * above, p.y + uy * above, VINE_WOOD, () => sphere(vx * 0.6, vy * 0.6 - 0.2), { bias });
  // Leaves budding off it.
  c.part();
  for (const [k, s] of [[-6, 1], [4, -1], [8, 1]] as const) c.px(p.x + ux * k + vx * s, p.y + uy * k + vy * s, LEAF, sphere(s * 0.5, -0.3), { bias });
  // The dial of petals at its head.
  const x = p.x + ux * (above + 2.6);
  const y = p.y + uy * (above + 2.6);
  c.part();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    c.px(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, BLOSSOMS[i % 3], sphere(Math.cos(a) * 0.6, Math.sin(a) * 0.6), { bias });
  }
  const [core, hot, mid] = S.light;
  const k = 0.4 + 0.6 * glow;
  c.spark(x, y, core, k);
  const a = (tick % 8) * (Math.PI / 4) - Math.PI / 2;
  c.spark(x + Math.round(Math.cos(a)), y + Math.round(Math.sin(a)), hot, 0.9 * k);
  c.spark(x - 1, y, mid, 0.4 * k);
  if (glow > 0.5) glowAt(c, x, y, (glow - 0.5) * 1.6);
}

/**
 * Two small butterflies of light keeping her company, one rose and one mint,
 * looping round her at their own paces, their wings opening and closing; and
 * a petal or two drifting off her hem.
 */
function springCompany(c: PixelCanvas, tick: number, view: View): void {
  const [core, hot, mid, deep] = S.light;
  const fly = (x: number, y: number, col: RGB, beat: boolean) => {
    c.spark(x, y, core, 0.9);
    if (beat) {
      c.spark(x - 1, y - 1, col, 0.85);
      c.spark(x + 1, y - 1, col, 0.85);
      c.spark(x - 1, y, col, 0.6);
      c.spark(x + 1, y, col, 0.6);
    } else {
      c.spark(x, y - 1, col, 0.85);
    }
  };
  const a = tick * 0.52;
  const back = view === 'side' ? 3 : 0;
  fly(Math.round(12 + back + Math.cos(a) * 9), Math.round(9 + Math.sin(a * 2) * 2), hot, (tick >> 1) % 2 === 0);
  fly(Math.round(12 + back - Math.cos(a * 0.8 + 1) * 8), Math.round(19 + Math.sin(a * 1.6 + 1) * 2), deep, (tick >> 1) % 2 === 1);
  // Petals off the hem, drifting down and aside.
  for (let i = 0; i < 2; i++) {
    const d = (tick + i * 5) % 10;
    if (d > 7) continue;
    c.spark(5 + i * 13 + Math.round(d * 0.5), 26 + Math.round(d * 0.5), i ? mid : hot, 0.7 - d * 0.06);
  }
}

// ---------------------------------------------------------------------------
// Bodies

/** The timekeeper's robe from the front or back: brass-hemmed, the stole down its front, a clock for a buckle. */
function robeFront(c: PixelCanvas, cx: number, U: number, L: number, sway: number, back: boolean): void {
  const top = 15 + U;
  const waist = 21 + U;
  const hem = 30 + L;
  c.part();
  c.shape(top, hem, (y) => {
    const hw = y <= waist ? 4.6 - 0.6 * ((y + 0.5 - top) / (waist - top)) ** 2 : 4.0 + (y - waist) * 0.24;
    const s = y > waist ? ((y - waist) / (hem - waist)) * sway : 0;
    return [cx - hw + s, cx + hw + s];
  }, S.robe, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  // Folds falling from the belt.
  for (let y = waist + 2; y < hem; y++) {
    const s = ((y - waist) / (hem - waist)) * sway;
    c.shade(Math.round(cx - 2 + s), y, -1);
    c.shade(Math.round(cx + 2 + s), y, -1);
  }
  // The brass hem.
  c.part();
  for (let x = cx - 7; x <= cx + 7; x++) if (c.filled(x, hem)) c.px(x, hem, S.trim, sphere((x - cx) / 7, 0.3));
  if (!back) {
    // The stole: two bands down the front below the beard, fringed in brass.
    c.part();
    for (const s of [-1, 1]) c.shape(Math.round(19 + U), Math.round(27 + L), () => (s < 0 ? [cx - 2.4, cx - 0.6] : [cx + 0.6, cx + 2.4]), S.inner, (_x, _y, t) => cyl(t * 0.8, 0.1));
    c.part();
    for (const x of [cx - 2, cx - 1, cx + 1, cx + 2]) c.px(x, Math.round(28 + L), S.trim, sphere(0, 0.4));
  } else {
    // The stole's back: one wide band over the shoulders.
    c.part();
    c.shape(top, Math.round(17 + U), () => [cx - 3.6, cx + 3.6], S.inner, (_x, _y, t) => cyl(t * 0.8, 0.2));
  }
  // The belt, and its clock buckle.
  c.part();
  c.shape(waist, waist, () => [cx - 4.0, cx + 4.0], S.trim, (_x, _y, t) => cyl(t, 0));
  if (!back) {
    c.part();
    c.ellipse(cx, waist + 0.5, 1.5, 1.4, S.trim);
    c.spark(cx, waist, S.light[0], 0.7);
    c.spark(cx, waist + 1, S.light[2], 0.4);
  }
}

/** The paradox's coat from the front: open below the belt, seams of light down its edges, the hem cracking apart. */
function coatFront(c: PixelCanvas, cx: number, U: number, L: number, sway: number, tick: number, back: boolean): void {
  const top = 15 + U;
  const waist = 21 + U;
  const hem = 28 + L;
  // Trousers glimpsed through the opening.
  if (!back) {
    c.part();
    c.shape(waist, hem, () => [cx - 1.6, cx + 1.6], S.inner, (_x, _y, t) => cyl(t, 0.2));
  }
  c.part();
  c.shape(top, hem, (y) => {
    const hw = y <= waist ? 4.4 - 0.5 * ((y + 0.5 - top) / (waist - top)) ** 2 : 3.9 + (y - waist) * 0.22;
    const s = y > waist ? ((y - waist) / (hem - waist)) * sway : 0;
    return [cx - hw + s, cx + hw + s];
  }, S.robe, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  if (!back) {
    // The opening: the coat parts from the belt down.
    for (let y = waist + 1; y <= hem; y++) {
      const s = ((y - waist) / (hem - waist)) * sway;
      const w = 0.6 + (y - waist) * 0.18;
      for (let x = Math.round(cx - w + s); x < Math.round(cx + w + s); x++) c.erase(x, y);
    }
    c.part();
    c.shape(waist + 1, hem, (y) => {
      const s = ((y - waist) / (hem - waist)) * sway;
      const w = 0.6 + (y - waist) * 0.18;
      return [cx - w + s, cx + w + s];
    }, S.inner, (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
    // Seams of light down both front edges, from the collar.
    c.part();
    for (let y = top + 1; y <= hem; y++) {
      const s = y > waist ? ((y - waist) / (hem - waist)) * sway : 0;
      const w = y > waist ? 0.6 + (y - waist) * 0.18 : 1.2;
      c.px(Math.round(cx - w - 1 + s), y, S.trim, sphere(-0.3, 0));
      c.px(Math.round(cx + w + s), y, S.trim, sphere(0.3, 0));
    }
  } else {
    // A seam of light down the back.
    c.part();
    for (let y = top + 2; y <= hem; y++) c.px(cx + Math.round(y > waist ? ((y - waist) / (hem - waist)) * sway : 0), y, S.trim, sphere(0, 0));
  }
  // The collar, high and stiff, lined with light.
  c.part();
  c.ellipse(cx, top + 0.2, 3.2, 1.2, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.5 - 0.5, 1) });
  c.px(cx - 3, top, S.trim, sphere(-0.5, -0.4));
  c.px(cx + 2, top, S.trim, sphere(0.5, -0.4));
  // The belt.
  c.part();
  c.shape(waist, waist, () => [cx - 4.0, cx + 4.0], S.inner, (_x, _y, t) => cyl(t, 0));
  fractures(c, cx, hem, sway, tick, 4.8);
}

/** Splinters of the coat drifting loose below its hem, glowing at their edges, rising and fading as he moves. */
function fractures(c: PixelCanvas, cx: number, hem: number, sway: number, tick: number, span: number): void {
  const [, hot, mid, deep] = S.light;
  c.part();
  for (let i = 0; i < 4; i++) {
    const k = (i / 3) * 2 - 1;
    const drift = (tick + i * 2) % 6;
    const x = Math.round(cx + k * span + sway * 0.8 + (i % 2 ? 0.5 : -0.5));
    const y = hem + 1 + ((drift + i) % 3);
    if (drift > 4) continue;
    c.px(x, y, S.robe, sphere(k * 0.5, 0.2), { bias: -1 });
    c.spark(x, y - 1, drift < 2 ? hot : mid, 0.5);
    if (i % 2 === 0) c.spark(x + 1, y + 1, deep, 0.35);
  }
}

// ---------------------------------------------------------------------------
// Views

const REACH_FRONT = 4.5;
const REACH_SIDE = 5.2;

/** The look's staff: brass and hourglass, the clockwork's cog, or Primavera's flower clock. */
const staffOf = () => (S.style === 'clockwork' ? drawCogStaff : S.style === 'primavera' ? drawBloomStaff : drawStaff);

/** The staff's direction from the hand: upright, tipping forward (towards the viewer, or out to the side from the front). */
function staffUp(view: View, tilt: number): [number, number] {
  if (view === 'side') return [-Math.sin(tilt), -Math.cos(tilt)];
  const s = view === 'down' ? -1 : 1;
  return [s * Math.sin(tilt) * 0.35, -Math.cos(tilt)];
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const armA = () => arm(c, 7.4, 16.3 + U, fa, REACH_FRONT, [-0.6, 1], fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.6, 16.3 + U, fb, REACH_FRONT, [0.6, 1], fb.behind ? -1 : 0);
  const [sx, sy] = staffUp('down', p.tilt);
  const staff = staffOf();

  if (S.rift && S.style !== 'anomaly') {
    // The hood's back drapes behind the shoulders.
    c.part();
    c.ellipse(cx, 16 + U, 4.8, 2.2, S.robe, { bias: -1 });
  }
  if (fa.behind) {
    armA();
    if (!S.rift) staff(c, fa, sx, sy, p.glow, p.tick, -1);
  }
  if (fb.behind) armB();

  boot(c, 10, 30.4 - p.footA);
  boot(c, 14, 30.4 - p.footB);
  if (S.rift) {
    c.part();
    c.capsule(10.2, 26 + L, 10, 29 - p.footA, 1.3, 1.2, S.inner);
    c.capsule(13.8, 26 + L, 14, 29 - p.footB, 1.3, 1.2, S.inner);
    coatFront(c, cx, U, L, p.sway, p.tick, false);
    if (S.style === 'anomaly') {
      visorDown(c, cx, U, p);
      orbiters(c, cx, 7.4 + U, p.tick);
    } else hoodDown(c, cx, U, p.blink, p.look);
  } else if (S.style === 'clockwork') {
    clockCase(c, cx, U, L, p.tick, false);
    clockChest(c, cx, U, p.tick, false);
    cogShoulders(c, cx, U, 4.6, p.tick);
    clockHeadDown(c, cx, U, p);
  } else if (S.style === 'primavera') {
    gownFront(c, cx, U, L, p.sway, false);
    springHeadDown(c, cx, U, p);
    halo(c, cx - 0.5, 10.6 + U, 7.2, 6.6, p.tick, false);
  } else {
    robeFront(c, cx, U, L, p.sway, false);
    sageDown(c, cx, U, p.blink);
    halo(c, cx, 10.4 + U, 5.6, 5.4, p.tick, false);
  }

  if (!fb.behind) armB();
  if (!fa.behind) armA();
  if (S.style === 'anomaly') drawCube(c, fa, p.glow, p.tick);
  else if (S.rift) drawWatch(c, fa, [CHAIN_AT[0] - 5, CHAIN_AT[1] + U], p.glow, p.tick);
  else if (!fa.behind) staff(c, fa, sx, sy, p.glow, p.tick);
  if (p.pocket) pocketWatch(c, fb, [cx + 2, 21.6 + U], p.pocket, p.tick);
  glowAt(c, fb.x, fb.y, p.cast);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const armA = () => arm(c, 16.6, 16.3 + U, fa, REACH_FRONT, [0.6, 0.8], fa.behind ? -1 : 0);
  const armB = () => arm(c, 7.4, 16.3 + U, fb, REACH_FRONT, [-0.6, 0.8], fb.behind ? -1 : 0);
  const [sx, sy] = staffUp('up', p.tilt);

  // What he holds is in front of him, hidden but for what rises past.
  if (!S.rift) staffOf()(c, fa, sx, sy, p.glow, p.tick, -1);
  if (fa.behind) armA();
  if (fb.behind) armB();

  boot(c, 10, 30.4 - p.footB);
  boot(c, 14, 30.4 - p.footA);
  if (S.rift) {
    c.part();
    c.capsule(10.2, 26 + L, 10, 29 - p.footB, 1.3, 1.2, S.inner);
    c.capsule(13.8, 26 + L, 14, 29 - p.footA, 1.3, 1.2, S.inner);
    coatFront(c, cx, U, L, p.sway, p.tick, true);
    if (S.style === 'anomaly') {
      // The back of the visor, the collar standing up behind it, a seam of light down its middle.
      c.part();
      c.ellipse(cx, 11.2 + U, 3.2, 3.4, VISOR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
      c.part();
      c.shape(Math.round(13 + U), Math.round(16 + U), (y) => {
        const u = (y - 13 - U) / 3;
        const hw = 3.9 - u * 0.4;
        return [cx - hw, cx + hw];
      }, S.robe, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6 - 0.3, 1));
      c.part();
      for (let y = 13; y <= 16; y++) c.px(cx, y + U, S.trim, sphere(0, 0));
      orbiters(c, cx, 7.4 + U, p.tick);
    } else {
    // The hood from behind, a seam of light down its crown to a point at the nape.
    c.part();
    c.shape(Math.round(7 + U), Math.round(16 + U), (y) => {
      const u = (y - 7 - U) / 9;
      const hw = u < 0.35 ? 2.2 + Math.sqrt(u / 0.35) * 2.2 : 4.4 - (u - 0.35) * 2.4;
      return [cx - hw, cx + hw];
    }, S.robe, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.4, 1));
    c.part();
    for (let y = 7; y <= 15; y++) c.px(cx, y + U, S.trim, sphere(0, 0));
    // Hair spilling out at one side.
    c.part();
    c.px(cx - 4, 14 + U, S.hair, sphere(-0.5, 0.2));
    c.px(cx - 4, 15 + U, S.hair, sphere(-0.5, 0.4));
    }
  } else if (S.style === 'clockwork') {
    clockCase(c, cx, U, L, p.tick, true);
    clockChest(c, cx, U, p.tick, true);
    windKey(c, cx, 18 + U, p.tick, false);
    cogShoulders(c, cx, U, 4.6, p.tick);
    // The back of the clock, and its bells.
    bells(c, cx, 7.6 + U, p.glow, p.tick);
    c.part();
    c.ellipse(cx, 11.4 + U, 3.5, 3.4, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    c.shade(cx - 1, 10 + U, 1);
    c.shade(cx, 12 + U, -1);
  } else if (S.style === 'primavera') {
    gownFront(c, cx, U, L, p.sway, true);
    springHeadUp(c, cx, U, p);
    halo(c, cx - 0.5, 10.6 + U, 7.2, 6.6, p.tick, true);
  } else {
    robeFront(c, cx, U, L, p.sway, true);
    // The back of the head: the bald crown, the fringe of white hair round it.
    c.part();
    c.ellipse(cx, 11.8 + U, 3.0, 3.1, SKIN);
    c.part();
    c.ellipse(cx, 13.6 + U, 3.1, 1.4, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.6, 1) });
    skullcap(c, cx, U);
    // The beard's edges show past his jaw.
    c.part();
    c.px(cx - 4, 14 + U, S.hair, sphere(-0.6, 0.2));
    c.px(cx + 3, 14 + U, S.hair, sphere(0.6, 0.2));
    halo(c, cx, 10.4 + U, 5.6, 5.4, p.tick, true);
  }

  if (!fb.behind) armB();
  if (!fa.behind) armA();
  glowAt(c, fb.x, fb.y, p.cast * 0.6);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean; // upper body centre
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);
  const top = 15 + U;
  const waist = 21 + U;
  const [sx, sy] = staffUp('side', p.tilt);
  const staff = staffOf();

  // The far arm behind everything, unless it reaches out in front.
  const armA = (bias: number) => arm(c, hx + 1.2, 16.4 + U, fa, REACH_SIDE, [0.3, 1], bias);
  if (fa.behind) {
    armA(-1);
    if (!S.rift) staff(c, fa, sx, sy, p.glow, p.tick, -1);
  }

  // Feet: the back one in shade first.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  if (S.rift) {
    c.part();
    c.capsule(cx + 0.8, 25.5 + L, cx + 1 - p.footB, 29 - lift(p.footB), 1.3, 1.2, S.inner, { bias: -1 });
    c.capsule(cx - 0.6, 25.5 + L, cx - 0.4 - p.footA, 29 - lift(p.footA), 1.3, 1.2, S.inner);
  }
  boot(c, cx + 0.4 - p.footB, 30.4 - lift(p.footB), true, -1);
  boot(c, cx - 1.2 - p.footA, 30.4 - lift(p.footA), true);

  const hem = (S.rift ? 28 : 30) + L;
  if (S.style === 'clockwork') {
    clockSide(c, cx, hx, U, L, p);
  } else {
  // The robe or coat in profile, trailing back as he moves.
  c.part();
  c.shape(top, hem, (y) => {
    const u = y <= waist ? 0 : (y - waist) / (hem - waist);
    const shift = y <= waist ? hx : hx + (cx - hx) * Math.min(1, u * 2);
    const hw = y <= waist ? 3.3 - 0.4 * ((y + 0.5 - top) / (waist - top)) ** 2 : 3.0 + (y - waist) * (S.rift ? 0.2 : S.style === 'primavera' ? 0.36 : 0.26);
    return [shift - hw - 0.2, shift + hw + 0.2 + u * p.sway];
  }, S.robe, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  for (let y = waist + 2; y < hem; y++) c.shade(Math.round(hx + 1 + ((y - waist) / (hem - waist)) * p.sway), y, -1);
  if (S.rift) {
    // The seam down the front edge, and the belt.
    c.part();
    for (let y = top + 1; y <= hem; y++) {
      const u = y <= waist ? 0 : (y - waist) / (hem - waist);
      const shift = y <= waist ? hx : hx + (cx - hx) * Math.min(1, u * 2);
      const hw = y <= waist ? 3.3 - 0.4 * ((y + 0.5 - top) / (waist - top)) ** 2 : 3.0 + (y - waist) * 0.2;
      c.px(Math.round(shift - hw), y, S.trim, sphere(-0.5, 0));
    }
    c.part();
    c.shape(waist, waist, () => [hx - 3.1, hx + 3.1], S.inner, (_x, _y, t) => cyl(t, 0));
    fractures(c, cx + 0.5, hem, p.sway, p.tick, 3);
    if (S.style === 'anomaly') {
      visorSide(c, hx, U, p);
    } else {
    // The hood in profile, its cowl forward over the face.
    c.part();
    c.shape(Math.round(7 + U), Math.round(16 + U), (y) => {
      const u = (y - 7 - U) / 9;
      const back = hx + 3.2 - Math.abs(u - 0.5) * 1.6;
      const front = hx - 1.6 - Math.sqrt(Math.min(1, u * 2.4)) * 2.6;
      return [front, back];
    }, S.robe, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.4, 1));
    c.part();
    for (let y = 7; y <= 15; y++) c.px(Math.round(hx + 3.2 - Math.abs((y - 7) / 9 - 0.5) * 1.6) - 1, y + U, S.trim, sphere(0.5, 0));
    c.part();
    c.ellipse(hx - 2.6, 12.9 + U, 1.6, 2.4, S.inner);
    c.part();
    c.ellipse(hx - 2.9, 13.3 + U, 1.1, 1.8, SKIN, { bias: -1 });
    c.part();
    c.px(hx - 3, 11 + U, S.hair, sphere(-0.5, -0.3));
    c.px(hx - 2, 11 + U, S.hair, sphere(-0.3, -0.3));
    c.px(hx - 1, 12 + U, S.hair, sphere(0, 0));
    eyes(c, [[hx - 4, 13 + U]], p.blink);
    if (!p.blink) {
      c.spark(hx - 4, 13 + U, S.light[0], 0.9);
      c.spark(hx - 5, 13 + U, S.light[1], 0.35);
    }
    }
  } else if (S.style === 'primavera') {
    // The neckline, the sash and its bow at her back, blossoms on the skirt, the rose-gold hem.
    c.part();
    c.px(hx - 3, top, FAIR, sphere(-0.4, -0.2));
    c.px(hx - 2, top, FAIR, sphere(0, -0.2));
    c.px(hx - 3, top + 1, S.trim, sphere(-0.3, -0.3));
    c.part();
    c.shape(waist, waist, () => [hx - 2.8, hx + 2.8], S.inner, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.px(hx + 3, waist - 1, S.inner, sphere(0.4, -0.3));
    c.px(hx + 3, waist + 1, S.inner, sphere(0.4, 0.3));
    c.px(hx + 4, waist + 2, S.inner, sphere(0.5, 0.4));
    c.px(hx + 3, waist, POLLEN, sphere(0, 0));
    ([[-2, 3], [1, 5], [-3, 7], [2, 8]] as const).forEach(([dx, dy], i) => {
      const y = waist + dy;
      const x = Math.round(hx + (cx - hx) * Math.min(1, (dy / (hem - waist)) * 2) + dx + (dy / (hem - waist)) * p.sway * 0.5);
      if (!c.filled(x, y) || !c.filled(x + 1, y)) return;
      c.part();
      c.px(x, y, BLOSSOMS[i % 3], sphere(0, 0), { glow: 0.1 });
      c.px(x + 1, y, BLOSSOMS[i % 3], sphere(0.4, 0), { glow: 0.1, bias: -1 });
      c.px(x, y - 1, LEAF, sphere(0, -0.3));
    });
    c.part();
    for (let x = cx - 8; x <= cx + 9; x++) if (c.filled(x, hem)) c.px(x, hem, S.trim, sphere(0, 0.3));
    springHeadSide(c, hx, U, p);
    halo(c, hx + 3, 10.4 + U, 1.8, 6.6, p.tick, false);
  } else {
    // The stole over the shoulder, the belt, the brass hem.
    c.part();
    c.shape(top, Math.round(27 + L), (y) => {
      const u = (y - top) / (27 + L - top);
      const x = hx - 2.2 + u * 0.4;
      return [x - 1, x + 0.8];
    }, S.inner, (_x, _y, t) => cyl(t * 0.8, 0.1));
    c.part();
    c.shape(waist, waist, () => [hx - 3.2, hx + 3.2], S.trim, (_x, _y, t) => cyl(t, 0));
    c.part();
    for (let x = cx - 6; x <= cx + 7; x++) if (c.filled(x, hem)) c.px(x, hem, S.trim, sphere(0, 0.3));
    // The head in profile: bald crown, a tuft behind the ear, brow and spectacle, the beard jutting.
    c.part();
    c.ellipse(hx - 0.6, 11.9 + U, 2.8, 3.0, SKIN);
    c.part();
    c.px(hx - 3.6, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
    c.part();
    c.ellipse(hx + 1.7, 12.4 + U, 1.3, 1.8, S.hair);
    skullcap(c, hx, U, hx - 0.2);
    eyes(c, [[hx - 3, 12 + U]], p.blink);
    if (!p.blink) c.spark(hx - 3, 12 + U, S.light[1], 0.35);
    c.part();
    c.px(hx - 2, 12 + U, S.trim, sphere(0, -0.4));
    c.px(hx - 3, 11 + U, S.hair, sphere(0, -0.6));
    c.px(hx - 2, 11 + U, S.hair, sphere(0, -0.6));
    c.part();
    c.shape(Math.round(13 + U), Math.round(20 + U), (y) => {
      const u = (y - 13 - U) / 7;
      return [hx - 4.2 - u * 0.6, hx - 0.2 - u * 2.6];
    }, S.hair, (_x, _y, t, u) => sphere(t * 0.8 - 0.2, u * 0.8 - 0.2, 1));
    for (let y = 15; y <= 19; y++) c.shade(hx - 3 + ((y & 1) === 0 ? 0 : -1), y + U, -1);
    halo(c, hx + 2.4, 10.2 + U, 1.5, 5.4, p.tick, false);
  }
  }

  if (!fa.behind) {
    armA(0);
    if (!S.rift) staff(c, fa, sx, sy, p.glow, p.tick);
  }
  // The near arm last.
  arm(c, hx + 0.2, 16.7 + U, fb, REACH_SIDE, [0.4, 1], 0);
  if (S.style === 'anomaly') drawCube(c, fa.behind ? fb : fa, p.glow, p.tick);
  else if (S.rift) drawWatch(c, fa.behind ? fb : fa, [hx - 1.5, waist], p.glow, p.tick, fa.behind ? 0 : 0);
  glowAt(c, fb.x - 0.5, fb.y, p.cast);
}

// ---------------------------------------------------------------------------
// Animations

/** The timekeeper's staff hand at his side, the other hand easy. */
const STAFF_A = H(0.8, 5.8, -1.2);
const REST_B = H(1.0, 3.8, -3.4);
/** The paradox's watch held at the hip; the other hand loose. */
const WATCH_A = H(1.8, 3.0, -2.6);
/** Side-view hands: the staff planted ahead, the watch held out, the free hand low. */
const side = (h: Hand, arm: 'a' | 'b'): Hand => (arm === 'a' ? H(h.f + (S.rift ? 1.2 : 3.4), 0, h.h + (S.rift ? 0.6 : 0)) : H(h.f + 0.4, 0, h.h));

const base = (view: View): Pose => {
  const a = S.rift ? WATCH_A : STAFF_A;
  return {
    lift: 0,
    breath: 0,
    footA: view === 'side' ? 1 : 0,
    footB: view === 'side' ? -1 : 0,
    lean: 0,
    a: view === 'side' ? side(a, 'a') : { ...a },
    b: view === 'side' ? side(REST_B, 'b') : { ...REST_B },
    tilt: 0,
    glow: 0,
    cast: 0,
    sway: 0,
    tick: 0,
  };
};

/** Standing easy: the halo's light runs round, the sand falls, the watch ticks. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.sway = Math.sin(ph - 1) * 0.5;
    p.tick = f * 2;
    p.blink = f === 4;
    p.glow = 0.15 + 0.15 * Math.sin(ph);
    if (S.rift) p.a.h += Math.sin(ph) * 0.5;
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
    p.tick = f * 2;
    p.glow = 0.15;
    if (view === 'side') {
      p.footA = Math.round(s * 2.2);
      p.footB = -p.footA;
      p.lean = 1;
      p.sway = 1 + Math.abs(s) * 0.9;
      // The staff swings forward with each stride.
      if (!S.rift) {
        p.tilt = 0.12 + s * 0.1;
        p.a.f += s * 0.8;
      }
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.7;
    }
    p.b.f -= s * 1.1;
    p.a.h += p.lift * 0.4;
    frames.push(p);
  }
  return frames;
}

interface Key {
  a?: Hand;
  b: Hand;
  aSide?: Hand;
  bSide?: Hand;
  tilt?: number;
  glow?: number;
  cast?: number;
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
      if (k.a) p.a = view === 'side' ? { ...(k.aSide ?? side(k.a, 'a')) } : { ...k.a };
      p.b = view === 'side' ? { ...(k.bSide ?? side(k.b, 'b')) } : { ...k.b };
      p.tilt = k.tilt ?? 0;
      p.glow = k.glow ?? 0.15;
      p.cast = k.cast ?? 0;
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
      p.tick = i * 2;
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

/** The cast: the free hand drawn back, light gathering in it, then thrust out as the bolt leaves. */
const cast = action([
  { b: H(-0.4, 3.6, -0.6), bSide: H(-1.2, 0, 0.2), cast: 0.3, lean: -1 },
  { b: H(-0.8, 3.4, 0.6), bSide: H(-1.6, 0, 1.2), cast: 0.7, lean: -1, tilt: -0.05 },
  { b: H(3.2, 2.2, 1.6), bSide: H(4.4, 0, 1.4), cast: 1, lean: 1, step: 1, tilt: 0.12, glow: 0.4 },
  { b: H(3.0, 2.4, 1.2), bSide: H(4.0, 0, 1.0), cast: 0.4, lean: 1, step: 1, tilt: 0.08 },
  { b: REST_B, cast: 0 },
]);

/** The stasis clock: the staff lifted high in both hands, the hourglass blazing, then planted as the clock is set. */
const HIGH_A = H(1.2, 2.6, 5.6);
const HIGH_B = H(1.4, 1.2, 4.2);
const field = action([
  { a: H(1.0, 3.6, 1.2), b: H(1.2, 2.4, 0.4), aSide: H(2.6, 0, 1.8), bSide: H(2.2, 0, 0.8), glow: 0.4, lean: -1 },
  { a: H(1.1, 3.0, 3.6), b: H(1.3, 1.6, 2.4), aSide: H(2.2, 0, 4.2), bSide: H(1.8, 0, 3.0), glow: 0.6, lean: -1, lift: 1 },
  { a: HIGH_A, b: HIGH_B, aSide: H(2.0, 0, 6.2), bSide: H(1.6, 0, 4.8), glow: 0.9, lean: -1, lift: 1 },
  { a: HIGH_A, b: HIGH_B, aSide: H(2.0, 0, 6.2), bSide: H(1.6, 0, 4.8), glow: 1, lean: -1, lift: 1, cast: 0.5 },
  { a: H(1.6, 3.2, 0.2), b: H(1.6, 1.8, -0.8), aSide: H(3.4, 0, 0.4), bSide: H(2.8, 0, -0.6), glow: 1, lean: 1, step: 1, breath: 1, tilt: 0.1 },
  { a: H(1.6, 3.4, -0.4), b: H(1.6, 2.0, -1.4), aSide: H(3.4, 0, -0.2), bSide: H(2.8, 0, -1.2), glow: 0.7, lean: 1, step: 1, breath: 1, tilt: 0.1 },
  { a: STAFF_A, b: REST_B, glow: 0.3 },
]);

/** The rewind: the watch raised before his eyes, its light flaring as time runs back, then snapped shut. */
const rewind = action([
  { a: H(2.0, 2.6, 0.6), b: H(0.4, 3.8, -1.6), aSide: H(3.0, 0, 1.2), glow: 0.4 },
  { a: H(2.4, 1.8, 3.4), b: H(0.2, 4.2, -0.6), aSide: H(3.4, 0, 3.8), glow: 0.7, lean: -1 },
  { a: H(2.6, 1.2, 5.0), b: H(-0.2, 4.4, 0.8), aSide: H(3.6, 0, 5.4), bSide: H(-1, 0, 1.2), glow: 1, lean: -1, lift: 1 },
  { a: H(2.6, 1.2, 5.2), b: H(-0.2, 4.6, 1.4), aSide: H(3.6, 0, 5.6), bSide: H(-1.2, 0, 1.6), glow: 1, lean: -1, lift: 1, cast: 0.4 },
  { a: H(2.4, 1.4, 4.4), b: H(1.6, 2.6, 3.0), aSide: H(3.4, 0, 4.8), bSide: H(2.4, 0, 3.4), glow: 1, lift: 1, cast: 0.8 },
  { a: H(2.0, 2.4, 1.0), b: H(1.4, 3.2, 0.2), aSide: H(3.0, 0, 1.4), bSide: H(2.0, 0, 0.4), glow: 0.6, step: 1, breath: 1 },
  { a: WATCH_A, b: REST_B, glow: 0.3 },
]);

// ---------------------------------------------------------------------------
// The idle moment (`rest`), facing the viewer

/** A pose built from the idle's first frame, so the moment starts and ends on it exactly. */
const still = (o: Partial<Pose> = {}): Pose => {
  const p = idle('down')[0];
  return { ...p, a: { ...p.a }, b: { ...p.b }, ...o };
};

/** The free hand at his belt pocket, before the beard, and up at his ear. */
const POCKET_B = H(1.4, 2.2, -2.6);
const READ_B = H(2.4, 3.4, 0.8);
const EAR_B = H(0.6, 3.6, 6.0);

/**
 * The timekeeper checks the time: fishes his pocket watch from his belt,
 * flips it open and peers at it, frowns and gives it a shake (the halo's
 * running light stalls with it), holds it to his ear with his eyes shut until
 * it ticks again, then snaps it shut, satisfied, and tucks it away.
 */
function keeperRest(): Pose[] {
  const shut: Pocket = { open: false };
  const open: Pocket = { open: true };
  return [
    still(),
    still({ b: POCKET_B, breath: 1, sway: -0.2, tick: 1 }),
    still({ b: H(2.4, 2.6, 0.2), pocket: shut, sway: 0, tick: 2 }),
    still({ b: READ_B, pocket: shut, sway: 0.2, tick: 3 }),
    still({ b: READ_B, pocket: { open: true, glint: 0.5 }, sway: 0.2, tick: 4 }),
    still({ b: H(2.6, 3.2, 1.4), pocket: open, breath: 1, tick: 5 }),
    still({ b: H(2.4, 4.6, 1.2), pocket: open, breath: 1, tick: 5, sway: 0.3 }),
    still({ b: H(2.4, 2.4, 1.0), pocket: open, breath: 1, tick: 5, sway: -0.3 }),
    still({ b: EAR_B, pocket: { open: true, ticks: true }, blink: true, sway: 0.2, tick: 6 }),
    still({ b: EAR_B, pocket: { open: true, ticks: true }, blink: true, sway: 0.2, tick: 7 }),
    still({ b: READ_B, pocket: open, sway: 0, tick: 8 }),
    still({ b: READ_B, pocket: { open: false, glint: 1 }, breath: 1, tick: 9 }),
    still({ b: POCKET_B, pocket: shut, breath: 1, sway: -0.2, tick: 10 }),
    still(),
  ];
}
const KEEPER_REST_ORDER = [0, 1, 2, 3, 4, 4, 5, 5, 5, 6, 7, 6, 7, 5, 8, 9, 8, 9, 8, 9, 10, 10, 11, 11, 12, 13];

/** The paradox's watch raised to look at, and the free hand at his chin. */
const PEEK_A = H(2.4, 2.0, 1.2);
const CHIN_B = H(1.8, 1.0, 3.6);

/**
 * The paradox glances at his watch and it flares: a time-echo of him peels
 * out of his side and steps away, still holding its watch up a moment behind
 * him. He turns and looks at it; it turns and looks back; he puts a hand to
 * his chin and, a beat late, so does the echo. He winds the watch and the
 * echo is pulled back into him, and he sighs.
 */
function paradoxRest(): Pose[] {
  const peek = still({ a: PEEK_A, glow: 1, breath: 1, tick: 2 });
  const echo = (o: Partial<Pose>, dx: number, k: number) => ({ pose: still({ ...o }), dx, k });
  const late = { a: PEEK_A, glow: 0.8, breath: 1 };
  return [
    still(),
    still({ a: PEEK_A, glow: 0.5, breath: 1, tick: 1, sway: 0 }),
    { ...peek, cast: 0.3, echo: echo(late, 1, 0.45) },
    still({ a: PEEK_A, glow: 0.8, breath: 1, tick: 3, echo: echo({ ...late, footB: 1, tick: 3 }, 4, 0.75) }),
    still({ a: H(2.2, 2.4, 0.4), glow: 0.6, tick: 4, echo: echo({ ...late, footA: 1, tick: 4, sway: -0.6 }, 7, 0.85) }),
    still({ glow: 0.4, tick: 5, echo: echo({ ...late, tick: 5 }, 9, 0.9) }),
    still({ glow: 0.3, look: 1, tick: 6, echo: echo({ ...late, tick: 6 }, 9, 0.9) }),
    still({ glow: 0.3, look: 1, b: CHIN_B, tick: 7, echo: echo({ look: -1, tick: 7 }, 9, 0.9) }),
    still({ glow: 0.3, look: 1, b: CHIN_B, tick: 8, echo: echo({ look: -1, b: CHIN_B, tick: 8 }, 9, 0.9) }),
    still({ a: PEEK_A, glow: 1, cast: 0.6, breath: 1, tick: 9, echo: echo({ look: -1, b: CHIN_B, tick: 9, sway: 0.6 }, 4, 0.7) }),
    still({ a: PEEK_A, glow: 0.8, cast: 0.3, lift: 1, tick: 10, echo: echo({ a: PEEK_A, tick: 10 }, 1, 0.45) }),
    still({ glow: 0.3, blink: true, breath: 1, tick: 11 }),
    still(),
  ];
}
const PARADOX_REST_ORDER = [0, 1, 1, 2, 3, 4, 5, 5, 5, 6, 6, 6, 7, 7, 8, 8, 8, 8, 8, 9, 10, 11, 11, 12];

const rest = (view: View): Pose[] => (view !== 'down' ? [] : S.rift ? paradoxRest() : keeperRest());

// ---------------------------------------------------------------------------
// Frame generation

export type ChronoAnim = 'idle' | 'walk' | 'cast' | 'field' | 'rewind' | 'rest';

export interface ChronoAnimDef {
  name: ChronoAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Only drawn for the paradox (true) or the timekeeper (false); both when left out. */
  rift?: boolean;
  /** Frame indices to play in order, when some are held or repeated. */
  order?: readonly number[];
}

export const CHRONO_ANIMS: ChronoAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 9, loop: true, poses: walk },
  { name: 'cast', fps: 15, loop: false, poses: cast },
  { name: 'field', fps: 11, loop: false, poses: field, rift: false },
  { name: 'rewind', fps: 12, loop: false, poses: rewind, rift: true },
];

/** The idle moment: the same poses function for both types, each playing its own order. */
const REST_FPS = 8;

/** The anims a look has. */
export const chronoAnims = (look: ChronoLook): ChronoAnimDef[] => [
  ...CHRONO_ANIMS.filter((a) => a.rift === undefined || a.rift === look.rift),
  { name: 'rest', fps: REST_FPS, loop: false, poses: rest, order: look.rift ? PARADOX_REST_ORDER : KEEPER_REST_ORDER },
];

/** Frame index at which each action lands. */
export const CHRONO_RELEASE = { cast: 2, field: 4, rewind: 4 } as const;

export interface ChronoFrame {
  key: string; // e.g. "walk_left_3"
  anim: ChronoAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

/**
 * The paradox's time-echo: his figure drawn again in another pose, then laid
 * down `dx` px aside as light only, wherever he himself isn't. Its outline
 * burns brightest, the seams between its parts show faintly inside, and its
 * own lights (eyes, watch) carry over dimmed, so it reads as an afterimage
 * of him rather than a second man. The anomaly's echo is fringed in magenta.
 */
function stampEcho(c: PixelCanvas, pose: Pose, dx: number, k: number): void {
  const e = new PixelCanvas(CHRONO_W, CHRONO_H).offset(BODY_X, BODY_Y);
  drawDown(e, pose);
  const [, hot, mid] = S.light;
  const { w, h } = c;
  const add = (t: number, col: RGB, a: number) => {
    for (let q = 0; q < 3; q++) c.light[t * 4 + q] = Math.min(255, c.light[t * 4 + q] + col[q] * a);
    c.light[t * 4 + 3] = 1;
  };
  const empty = (s: number) => s < 0 || s >= w * h || e.mat[s] < 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= w) continue;
      const s = y * w + x;
      const t = y * w + tx;
      if (c.mat[t] >= 0) continue;
      if (e.mat[s] >= 0) {
        const edge = x === 0 || x === w - 1 || empty(s - 1) || empty(s + 1) || empty(s - w) || empty(s + w);
        if (edge) {
          add(t, hot, 0.95 * k);
          if (S.style === 'anomaly' && empty(s + 1)) add(t, MAGENTA, 0.45 * k);
        } else if (e.mat[s - w] !== e.mat[s]) add(t, mid, 0.6 * k);
        else add(t, e.glow[s] > 0 ? hot : mid, e.glow[s] > 0 ? 0.6 * k : 0.28 * k);
      }
      if (e.light[s * 4 + 3] > 0) add(t, [e.light[s * 4], e.light[s * 4 + 1], e.light[s * 4 + 2]], 0.8 * k);
    }
  }
}

function drawChronoFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(CHRONO_W, CHRONO_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  if (pose.echo) stampEcho(c, pose.echo.pose, pose.echo.dx, pose.echo.k);
  if (S.style === 'anomaly') glitch(c, pose.tick, dir === 'down' || dir === 'up' ? dir : 'side');
  if (S.style === 'primavera') springCompany(c, pose.tick, dir === 'down' || dir === 'up' ? dir : 'side');
  return dir === 'right' ? c.mirrored() : c;
}

export function buildChronoFrames(look: ChronoLook = KEEPER_LOOK): ChronoFrame[] {
  S = look;
  const out: ChronoFrame[] = [];
  for (const a of chronoAnims(look)) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawChronoFrame(dir, pose) });
      });
    }
  }
  S = KEEPER_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Bolts and shards in flight (11x11, light only)

export const BOLT_SIZE = 11;
export const BOLT_FRAMES = 4;

/**
 * The timekeeper's second hand: a small clock face of light, its hand
 * spinning round; the paradox's shard: a sliver of broken glass-light,
 * tumbling. Frame `i` of four.
 */
export function boltFrame(i: number, look: ChronoLook): PixelCanvas {
  const c = new PixelCanvas(BOLT_SIZE, BOLT_SIZE);
  const [core, hot, mid, deep] = look.light;
  const o = 5;
  if (look.style === 'clockwork') {
    // A cog of light, eight teeth, turning an eighth of a turn a frame.
    const turn = (i / BOLT_FRAMES) * (Math.PI / 4);
    for (let y = 0; y < BOLT_SIZE; y++) {
      for (let x = 0; x < BOLT_SIZE; x++) {
        const dx = x - o;
        const dy = y - o;
        const d = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx) - turn;
        const tooth = Math.cos(a * 8) > 0.2;
        if (d > (tooth ? 4.6 : 3.4) || d < 1.1) continue;
        c.spark(x, y, d > 3.4 ? mid : d > 2.4 ? hot : core, d > 3.4 ? 0.85 : 1);
      }
    }
    c.spark(o, o, deep, 0.7);
    return c;
  }
  if (look.style === 'primavera') {
    // A blossom of light, five petals round a bright heart, turning a fifth of a petal a frame, a mint leaf at its side.
    const turn = (i / BOLT_FRAMES) * ((Math.PI * 2) / 5);
    for (let y = 0; y < BOLT_SIZE; y++) {
      for (let x = 0; x < BOLT_SIZE; x++) {
        const dx = x - o;
        const dy = y - o;
        const d = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx) - turn;
        const petal = 2.2 + 2.4 * Math.max(0, Math.cos(a * 5));
        if (d > petal) continue;
        c.spark(x, y, d < 1.2 ? core : d < petal - 1.2 ? hot : mid, d < petal - 1.2 ? 1 : 0.85);
      }
    }
    const la = turn + Math.PI / 5;
    c.spark(o + Math.round(Math.cos(la) * 4.6), o + Math.round(Math.sin(la) * 4.6), deep, 0.8);
    return c;
  }
  if (look.style === 'anomaly') {
    // A broken square of light that will not hold still: its body jumps a
    // pixel frame to frame, and a magenta ghost of it lags a step behind.
    const jx = [0, 1, -1, 0][i];
    const jy = [0, 0, 1, -1][i];
    const block = (x0: number, y0: number, w: number, h: number, col: RGB, a: number) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) c.spark(x, y, col, a);
    };
    block(2 - jx, 3 - jy, 5, 5, MAGENTA, 0.55);
    block(3 + jx, 3 + jy, 5, 5, mid, 0.9);
    block(4 + jx, 4 + jy, 3, 3, hot, 1);
    c.spark(5 + jx, 5 + jy, core);
    // A torn scanline sliding off one side.
    const ty = 3 + ((i * 2) % 5) + jy;
    for (let x = 0; x < 4; x++) c.spark(8 + jx + x - (i % 2) * 5, ty, x === 0 ? core : hot, 0.9 - x * 0.2);
    return c;
  }
  if (!look.rift) {
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      c.spark(o + Math.round(Math.cos(t) * 3.4), o + Math.round(Math.sin(t) * 3.4), a % 6 === 0 ? core : mid, a % 6 === 0 ? 1 : 0.8);
    }
    c.spark(o, o, core);
    const t = (i / BOLT_FRAMES) * Math.PI * 2 - Math.PI / 2;
    for (let r = 1; r <= 3; r++) c.spark(o + Math.round(Math.cos(t) * r), o + Math.round(Math.sin(t) * r), r < 3 ? core : hot);
    // A short hour hand, and a soft glow inside the face.
    const t2 = t + Math.PI * 0.7;
    c.spark(o + Math.round(Math.cos(t2)), o + Math.round(Math.sin(t2)), hot, 0.8);
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) c.spark(o + dx, o + dy, deep, 0.5);
    return c;
  }
  // A long diamond sliver turned a quarter each frame.
  const t = (i / BOLT_FRAMES) * Math.PI;
  const ux = Math.cos(t);
  const uy = Math.sin(t);
  for (let y = 0; y < BOLT_SIZE; y++) {
    for (let x = 0; x < BOLT_SIZE; x++) {
      const dx = x - o;
      const dy = y - o;
      const u = dx * ux + dy * uy;
      const v = -dx * uy + dy * ux;
      const d = Math.abs(u) / 4.6 + Math.abs(v) / 1.6;
      if (d > 1) continue;
      c.spark(x, y, d < 0.35 ? core : d < 0.65 ? hot : d < 0.85 ? mid : deep, d < 0.85 ? 1 : 0.7);
    }
  }
  return c;
}

/** The clock over a slowed foe's head (9x9, white light, tinted in game): a ring of light and a hand at notch `i` of eight. */
export const MARK_SIZE = 9;
export const MARK_FRAMES = 8;

export function markFrame(i: number): PixelCanvas {
  const c = new PixelCanvas(MARK_SIZE, MARK_SIZE);
  const o = 4;
  const W: RGB = [255, 255, 255];
  const G: RGB = [150, 150, 150];
  for (let a = 0; a < 20; a++) {
    const t = (a / 20) * Math.PI * 2;
    c.spark(o + Math.round(Math.cos(t) * 3.2), o + Math.round(Math.sin(t) * 3.2), a % 5 === 0 ? W : G, a % 5 === 0 ? 0.9 : 0.6);
  }
  const t = (i / MARK_FRAMES) * Math.PI * 2 - Math.PI / 2;
  c.spark(o, o, W);
  for (let r = 1; r <= 2; r++) c.spark(o + Math.round(Math.cos(t) * r), o + Math.round(Math.sin(t) * r), W);
  return c;
}

// ---------------------------------------------------------------------------
// Ability icons (16x16)

/** Colours an icon is painted in: metal (dark to light) and light (brightest first). */
export interface ChronoIconColors {
  metal: [string, string, string];
  light: [string, string, string, string];
  outline: string;
  /** Flowers instead of ticks: blossoms at the hours and at the hand's root (Primavera). */
  bloom?: boolean;
}

export const BRASS_ICON: ChronoIconColors = { metal: ['#6a4418', '#a8742a', '#f0cc6a'], light: ['#fffbe8', '#ffe6a0', '#ffc050', '#b8701e'], outline: '#1e1006' };
export const MOON_ICON: ChronoIconColors = { metal: ['#4e5466', '#8a92a8', '#dfe4ee'], light: ['#f4fbff', '#c4e4ff', '#7ab8ff', '#2a5aa8'], outline: '#0c0e18' };
export const RIFT_ICON: ChronoIconColors = { metal: ['#2b203c', '#56406e', '#8a70a8'], light: ['#f6eeff', '#d4b0ff', '#9a5cff', '#4a2a9a'], outline: '#0c0614' };
export const AEON_ICON: ChronoIconColors = { metal: ['#142c27', '#2c5850', '#5a8a80'], light: ['#eafff6', '#9affd8', '#2ee0a0', '#127a6a'], outline: '#03100c' };
export const CLOCKWORK_ICON: ChronoIconColors = { metal: ['#5a2c14', '#a85a2a', '#f0a060'], light: ['#f6ffe8', '#d8ffa0', '#8ef040', '#2e8a2a'], outline: '#140804' };
export const ANOMALY_ICON: ChronoIconColors = { metal: ['#1a1c24', '#e8eef4', '#ffffff'], light: ['#f0ffff', '#a0faff', '#20d8f0', '#1a4aa0'], outline: '#04060c' };
/** Primavera's: living green for the metal, rose and mint light, and blossoms at the hours. */
export const PRIMAVERA_ICON: ChronoIconColors = { metal: ['#2e5a32', '#5c9a52', '#a8dc88'], light: ['#fffaf2', '#ffd0de', '#f48cae', '#2e6a4e'], outline: '#0c1a0e', bloom: true };

/** The second hand: a clock's long hand of light, loosed and flying, a ring of ticks behind it. */
export function handIcon(k: ChronoIconColors): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2;
    if (Math.cos(t) > 0.5 && Math.sin(t) < 0) continue;
    put(Math.round(6 + Math.cos(t) * 5.2), Math.round(9 + Math.sin(t) * 5.2), a % 10 === 0 ? k.metal[2] : k.metal[0]);
  }
  // The hand: a long diamond from the centre up to the right.
  for (let i = 0; i <= 11; i++) {
    const x = 6 + i * 0.72;
    const y = 9 - i * 0.62;
    const w = i < 2 ? 0 : i < 8 ? 1 : 0;
    put(Math.round(x), Math.round(y), i > 8 ? k.light[0] : k.light[1]);
    if (w) put(Math.round(x), Math.round(y) + 1, k.light[2]);
  }
  put(6, 9, k.light[0]);
  put(5, 9, k.metal[2]);
  put(6, 10, k.metal[1]);
  if (k.bloom) {
    // A blossom at the hand's root, and petals drifting off the hand.
    for (const [x, y] of [[5, 9], [7, 9], [6, 8], [6, 10]]) put(x, y, '#ffa8c4');
    put(6, 9, '#f6d050');
    put(13, 6, '#ffd0de');
    put(11, 9, '#ffffff');
  }
  outline(k.outline);
  return px;
}

/** The stasis clock: a clock face seen from above, its hands stopped, sand frozen round it. */
export function stasisIcon(k: ChronoIconColors): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
      if (d <= 6.8) put(x, y, d > 5.6 ? k.metal[1] : d > 4.8 ? k.metal[0] : k.light[3]);
    }
  }
  for (let h = 0; h < 12; h++) {
    const t = (h / 12) * Math.PI * 2;
    const x = Math.round(7.5 + Math.cos(t) * 4.2);
    const y = Math.round(7.5 + Math.sin(t) * 4.2);
    put(x, y, k.bloom ? ['#ffa8c4', '#ffffff', '#ffc8a4'][h % 3] : h % 3 === 0 ? k.light[0] : k.light[2]);
  }
  for (let r = 0; r <= 3; r++) put(8, 8 - r, k.light[r < 2 ? 1 : 0]);
  for (let r = 0; r <= 2; r++) put(8 + r, 8, k.light[1]);
  put(8, 8, k.light[0]);
  for (let x = 6; x <= 10; x++) put(x, 0, k.metal[2]);
  outline(k.outline);
  return px;
}

/** Echo shards: three slivers of light flying in a fan, the last two fainter, like the same throw repeated. */
export function shardsIcon(k: ChronoIconColors): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const sliver = (x0: number, y0: number, fade: number) => {
    for (let i = 0; i <= 7; i++) {
      const x = x0 + i;
      const y = y0 - i * 0.55;
      const c = fade === 0 ? (i > 4 ? k.light[0] : k.light[1]) : fade === 1 ? k.light[2] : k.light[3];
      put(Math.round(x), Math.round(y), c);
      if (i > 1 && i < 6) put(Math.round(x), Math.round(y) + 1, fade === 0 ? k.light[2] : k.light[3]);
    }
  };
  sliver(1, 14, 2);
  sliver(4, 11, 1);
  sliver(7, 8, 0);
  outline(k.outline);
  return px;
}

/** The rewind: a pocket watch, an arrow of light running backwards round it. */
export function rewindIcon(k: ChronoIconColors): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 9);
      if (d <= 4.2) put(x, y, d > 3.2 ? '#d69a3a' : k.light[3]);
      else if (Math.abs(d - 6.4) < 0.6) {
        const a = Math.atan2(y + 0.5 - 9, x + 0.5 - 8);
        if (a > -2.4 && a < 2.0) put(x, y, a < -1.4 ? k.light[0] : k.light[2]);
      }
    }
  }
  // The arrowhead at the running end, pointing back (anticlockwise).
  for (const [x, y] of [[4, 3], [5, 3], [3, 4], [4, 5], [5, 2]]) put(x, y, k.light[0]);
  put(8, 9, k.light[0]);
  put(8, 8, k.light[1]);
  put(8, 7, k.light[1]);
  put(9, 10, k.light[1]);
  put(8, 3, '#f4cf6a');
  outline(k.outline);
  return px;
}
