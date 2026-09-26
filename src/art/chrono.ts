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
// The body keeps to the 24x32 box; frames are larger so the staff and the
// halo fit. Hands are posed in the chronomancer's own terms (forward, out to
// the side, height) and placed per view.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
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

export const CHRONO_LOOKS = [KEEPER_LOOK, MOON_LOOK, PARADOX_LOOK, AEON_LOOK];

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
  c.part();
  c.capsule(sx, sy, ex, ey, 1.8, 1.55, S.robe, { bias });
  c.part();
  if (S.rift) c.capsule(ex, ey, wx, wy, 1.5, 1.3, S.robe, { bias });
  else c.capsule(ex, ey, wx, wy, 1.5, 2.1, S.robe, { bias });
  c.part();
  c.ellipse(wx, wy, S.rift ? 1.1 : 1.5, S.rift ? 1.0 : 1.2, S.trim, { bias });
  c.part();
  c.ellipse(p.x, p.y, 1.15, 1.1, SKIN, { bias });
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
function hoodDown(c: PixelCanvas, cx: number, U: number, blink: boolean | undefined): void {
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
  c.ellipse(cx - 0.3, 13.2 + U, 2.2, 2.2, SKIN, { bias: -1 });
  // White hair falling across the brow and down one side.
  c.part();
  c.shape(Math.round(10 + U), Math.round(11 + U), (y) => (y === Math.round(10 + U) ? [cx - 2.6, cx + 2] : [cx - 2.4, cx - 0.2]), S.hair, (_x, _y, t) => sphere(t * 0.7, -0.4, 1));
  c.px(cx - 3, 12 + U, S.hair, sphere(-0.6, 0));
  c.px(cx - 3, 13 + U, S.hair, sphere(-0.6, 0.3));
  eyes(c, [[cx - 2, 13 + U], [cx + 1, 13 + U]], blink);
  if (!blink) {
    const [core, hot] = S.light;
    c.spark(cx - 2, 13 + U, core, 0.9);
    c.spark(cx + 1, 13 + U, core, 0.9);
    c.spark(cx - 3, 13 + U, hot, 0.3);
    c.spark(cx + 2, 13 + U, hot, 0.3);
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

  if (S.rift) {
    // The hood's back drapes behind the shoulders.
    c.part();
    c.ellipse(cx, 16 + U, 4.8, 2.2, S.robe, { bias: -1 });
  }
  if (fa.behind) {
    armA();
    if (!S.rift) drawStaff(c, fa, sx, sy, p.glow, p.tick, -1);
  }
  if (fb.behind) armB();

  boot(c, 10, 30.4 - p.footA);
  boot(c, 14, 30.4 - p.footB);
  if (S.rift) {
    c.part();
    c.capsule(10.2, 26 + L, 10, 29 - p.footA, 1.3, 1.2, S.inner);
    c.capsule(13.8, 26 + L, 14, 29 - p.footB, 1.3, 1.2, S.inner);
    coatFront(c, cx, U, L, p.sway, p.tick, false);
    hoodDown(c, cx, U, p.blink);
  } else {
    robeFront(c, cx, U, L, p.sway, false);
    sageDown(c, cx, U, p.blink);
    halo(c, cx, 10.4 + U, 5.6, 5.4, p.tick, false);
  }

  if (!fb.behind) armB();
  if (!fa.behind) armA();
  if (S.rift) drawWatch(c, fa, [CHAIN_AT[0] - 5, CHAIN_AT[1] + U], p.glow, p.tick);
  else if (!fa.behind) drawStaff(c, fa, sx, sy, p.glow, p.tick);
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
  if (!S.rift) drawStaff(c, fa, sx, sy, p.glow, p.tick, -1);
  if (fa.behind) armA();
  if (fb.behind) armB();

  boot(c, 10, 30.4 - p.footB);
  boot(c, 14, 30.4 - p.footA);
  if (S.rift) {
    c.part();
    c.capsule(10.2, 26 + L, 10, 29 - p.footB, 1.3, 1.2, S.inner);
    c.capsule(13.8, 26 + L, 14, 29 - p.footA, 1.3, 1.2, S.inner);
    coatFront(c, cx, U, L, p.sway, p.tick, true);
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

  // The far arm behind everything, unless it reaches out in front.
  const armA = (bias: number) => arm(c, hx + 1.2, 16.4 + U, fa, REACH_SIDE, [0.3, 1], bias);
  if (fa.behind) {
    armA(-1);
    if (!S.rift) drawStaff(c, fa, sx, sy, p.glow, p.tick, -1);
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
  // The robe or coat in profile, trailing back as he moves.
  c.part();
  c.shape(top, hem, (y) => {
    const u = y <= waist ? 0 : (y - waist) / (hem - waist);
    const shift = y <= waist ? hx : hx + (cx - hx) * Math.min(1, u * 2);
    const hw = y <= waist ? 3.3 - 0.4 * ((y + 0.5 - top) / (waist - top)) ** 2 : 3.0 + (y - waist) * (S.rift ? 0.2 : 0.26);
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

  if (!fa.behind) {
    armA(0);
    if (!S.rift) drawStaff(c, fa, sx, sy, p.glow, p.tick);
  }
  // The near arm last.
  arm(c, hx + 0.2, 16.7 + U, fb, REACH_SIDE, [0.4, 1], 0);
  if (S.rift) drawWatch(c, fa.behind ? fb : fa, [hx - 1.5, waist], p.glow, p.tick, fa.behind ? 0 : 0);
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
// Frame generation

export type ChronoAnim = 'idle' | 'walk' | 'cast' | 'field' | 'rewind';

export interface ChronoAnimDef {
  name: ChronoAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Only drawn for the paradox (true) or the timekeeper (false); both when left out. */
  rift?: boolean;
}

export const CHRONO_ANIMS: ChronoAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 9, loop: true, poses: walk },
  { name: 'cast', fps: 15, loop: false, poses: cast },
  { name: 'field', fps: 11, loop: false, poses: field, rift: false },
  { name: 'rewind', fps: 12, loop: false, poses: rewind, rift: true },
];

/** The anims a look has. */
export const chronoAnims = (look: ChronoLook): ChronoAnimDef[] => CHRONO_ANIMS.filter((a) => a.rift === undefined || a.rift === look.rift);

/** Frame index at which each action lands. */
export const CHRONO_RELEASE = { cast: 2, field: 4, rewind: 4 } as const;

export interface ChronoFrame {
  key: string; // e.g. "walk_left_3"
  anim: ChronoAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawChronoFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(CHRONO_W, CHRONO_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
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
}

export const BRASS_ICON: ChronoIconColors = { metal: ['#6a4418', '#a8742a', '#f0cc6a'], light: ['#fffbe8', '#ffe6a0', '#ffc050', '#b8701e'], outline: '#1e1006' };
export const MOON_ICON: ChronoIconColors = { metal: ['#4e5466', '#8a92a8', '#dfe4ee'], light: ['#f4fbff', '#c4e4ff', '#7ab8ff', '#2a5aa8'], outline: '#0c0e18' };
export const RIFT_ICON: ChronoIconColors = { metal: ['#2b203c', '#56406e', '#8a70a8'], light: ['#f6eeff', '#d4b0ff', '#9a5cff', '#4a2a9a'], outline: '#0c0614' };
export const AEON_ICON: ChronoIconColors = { metal: ['#142c27', '#2c5850', '#5a8a80'], light: ['#eafff6', '#9affd8', '#2ee0a0', '#127a6a'], outline: '#03100c' };

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
    put(Math.round(7.5 + Math.cos(t) * 4.2), Math.round(7.5 + Math.sin(t) * 4.2), h % 3 === 0 ? k.light[0] : k.light[2]);
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
