// The necromancer, drawn procedurally from a small rig like the archer.
//
// A gaunt figure in a grave-violet robe, deep hood and bell sleeves, the face
// lost in the hood's shadow but for a grey chin and two soul-green eyes. A
// mantle of old bone lies over the shoulders with a small skull at its clasp,
// soul-green trim runs down the robe's opening and round its hem, and a
// gnarled staff crowned with a skull burns with green soul fire. The free hand
// casts, a pale palm filling with light.
//
// The blood mage is his other look on the same rig: crimson over black, the
// hood thrown back from a bone-white mane, a high black collar, eyes like
// embers, and a blood orb caged in bone on the staff.
//
// The body keeps to the 24x32 box; frames are larger so the staff can be
// raised overhead. Hands are posed in the caster's own terms (forward, out to
// the side, height) and placed for each view, like the archer's.

import { PixelCanvas, cyl, sphere, type Material, type RGB } from './pixel';
import {
  BLOOD_CORE,
  BLOOD_DEEP,
  BLOOD_EYE,
  BLOOD_GEM,
  BLOOD_HAIR,
  BLOOD_HOT,
  BLOOD_INNER,
  BLOOD_MID,
  BLOOD_ROBE,
  BONE,
  BOOT,
  GOLD,
  GRAVE_SKIN,
  GRAVE_WOOD,
  NECRO_INNER,
  NECRO_ROBE,
  PALE_SKIN,
  SOUL_CORE,
  SOUL_DEEP,
  SOUL_EYE,
  SOUL_HOT,
  SOUL_MID,
  SOUL_TRIM,
} from './palette';
import { iconPainter, type SpellColors } from './effects';
import { DIRS, type Dir } from './wizard';

export const NECRO_W = 48;
export const NECRO_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const NECRO_ORIGIN_X = BODY_X + 12;
export const NECRO_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet a bolt leaves the casting hand at. */
export const BOLT_H = 14;

/** A hand, in the caster's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

export interface Pose {
  /** Whole body raised (walk passing frames, the stretch before the slam). */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Feet peeking under the hem. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The casting hand (screen left from the front and back, the far arm from the side) and the staff hand. */
  a: Hand;
  b: Hand;
  /** The staff leaning out from upright: 0 upright, 1 well over (out to the side from the front, forward from the side). */
  tilt: number;
  /** 0..1 light in the casting palm. */
  palm: number;
  /** 0..1 the staff's head flaring. */
  flare: number;
  /** The robe's hem swinging, in pixels. */
  sway: number;
  /** Frame counter, for flickering soul fire. */
  tick: number;
  blink?: boolean;
}

/** One look for the caster: its texture key, cloth, face and staff. */
export interface NecroLook {
  key: string;
  robe: Material;
  inner: Material;
  trim: Material;
  skin: Material;
  eye: Material;
  /** The blood mage: hood down, a mane of hair, a high collar, a caged orb for a staff head. */
  blood: boolean;
  /** Light of the soul fire or the blood, brightest first. */
  light: [RGB, RGB, RGB, RGB];
}

export const NECRO_LOOK: NecroLook = {
  key: 'necro',
  robe: NECRO_ROBE,
  inner: NECRO_INNER,
  trim: SOUL_TRIM,
  skin: GRAVE_SKIN,
  eye: SOUL_EYE,
  blood: false,
  light: [SOUL_CORE, SOUL_HOT, SOUL_MID, SOUL_DEEP],
};

export const BLOOD_LOOK: NecroLook = {
  key: 'necro_blood',
  robe: BLOOD_ROBE,
  inner: BLOOD_INNER,
  trim: GOLD,
  skin: PALE_SKIN,
  eye: BLOOD_EYE,
  blood: true,
  light: [BLOOD_CORE, BLOOD_HOT, BLOOD_MID, BLOOD_DEEP],
};

export const NECRO_LOOKS = [NECRO_LOOK, BLOOD_LOOK];

/** The soul bolt's orb and burst: green soul fire with bone-white flecks. */
export const SOUL_SPELL: SpellColors = { core: SOUL_CORE, hot: SOUL_HOT, mid: SOUL_MID, deep: SOUL_DEEP, accent: [248, 242, 218], hollow: true };
/** The blood lance's: white-hot pink to deep crimson. */
export const BLOOD_SPELL: SpellColors = { core: BLOOD_CORE, hot: BLOOD_HOT, mid: BLOOD_MID, deep: BLOOD_DEEP, accent: [255, 200, 200] };

/** The look being drawn; set by buildNecroFrames. */
let S: NecroLook = NECRO_LOOK;

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

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
  // Facing left; the casting arm is the far one, a touch higher and behind the body.
  const far = arm === 'a';
  return { x: hx - 1 - q.f * 1.05 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), behind: far && q.f < 2 };
}

// ---------------------------------------------------------------------------
// The staff

/** From the grip towards the staff's head. */
function staffDir(view: View, tilt: number): [number, number] {
  if (view === 'side') {
    const a = tilt * 1.35;
    return [-Math.sin(a), -Math.cos(a)];
  }
  const a = tilt * 0.75;
  return [Math.sin(a), -Math.cos(a)];
}

/** Where the staff's head sits for a pose (the skull, or the caged orb). */
function staffHead(view: View, p: Pose, fb: Placed): [number, number] {
  const [ux, uy] = staffDir(view, p.tilt);
  return [fb.x + ux * 14.6, fb.y + uy * 14.6];
}

/** Soul fire or blood light: a small cross of it, the arms growing with `k`. */
function flareAt(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.light;
  c.spark(x, y, core, k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + dx, y + dy, hot, 0.7 * k);
  if (k > 0.6) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [1, -1], [-1, 1]]) c.spark(x + dx, y + dy, mid, 0.45 * k);
}

/**
 * The staff in the hand: a gnarled shaft through the grip, and at its head a
 * skull burning with soul fire (or, for the blood mage, an orb of blood held
 * in a cage of bone prongs).
 */
function drawStaff(c: PixelCanvas, view: View, p: Pose, fb: Placed, bias = 0): void {
  const [ux, uy] = staffDir(view, p.tilt);
  const top = 13;
  const bot = 9.5;
  c.part();
  c.capsule(fb.x - ux * bot, fb.y - uy * bot, fb.x + ux * top, fb.y + uy * top, 0.7, 0.8, GRAVE_WOOD, { bias });
  // Knots along the shaft.
  for (const t of [-5, 5.5, 9]) c.shade(fb.x + ux * t + 0.5, fb.y + uy * t, 1);
  const [hx, hy] = staffHead(view, p, fb);
  const glow = 0.35 + p.flare * 0.65;
  if (S.blood) {
    // Bone prongs curling up round the orb.
    c.part();
    for (const s of [-1, 1]) {
      c.px(hx + s * 2.1, hy + 1.2, BONE, sphere(s * 0.6, 0.2));
      c.px(hx + s * 2.4, hy, BONE, sphere(s * 0.8, -0.1));
      c.px(hx + s * 2.0, hy - 1.3, BONE, sphere(s * 0.5, -0.5));
      c.px(hx + s * 1.2, hy - 2.2, BONE, sphere(s * 0.3, -0.8), { bias: 1 });
    }
    c.part();
    c.ellipse(hx, hy, 1.75, 1.75, BLOOD_GEM, { glow: 0.55 + p.flare * 0.45 });
    c.spark(hx - 0.6, hy - 0.6, BLOOD_CORE, 0.6 * glow);
    // A drip hanging from it, now and then.
    if (p.tick % 3 === 1) c.spark(hx, hy + 2.4, BLOOD_MID, 0.6);
    flareAt(c, hx, hy, p.flare);
    return;
  }
  // The skull, seen from the front, the side or behind.
  c.part();
  c.ellipse(hx, hy, 2.05, 1.85, BONE);
  c.part();
  c.shape(Math.round(hy + 1.2), Math.round(hy + 1.2), () => (view === 'side' ? [hx - 2.1, hx + 0.6] : [hx - 1.3, hx + 1.3]), BONE, (_x, _y, t) => cyl(t, 0.3), { bias: -1 });
  const [core, hot, mid, deep] = S.light;
  const sockets: [number, number][] = view === 'down' ? [[hx - 1.2, hy], [hx + 0.6, hy]] : view === 'side' ? [[hx - 1.6, hy]] : [];
  for (const [x, y] of sockets) {
    c.px(x, y, NECRO_INNER);
    c.spark(x, y, hot, glow);
  }
  if (view !== 'up') for (const x of view === 'side' ? [hx - 2, hx - 1] : [hx - 1, hx, hx + 1]) c.shade(x, Math.round(hy + 1.2), (Math.round(x) & 1) === 0 ? -1 : 0);
  // Soul fire licking up from the crown, flickering.
  const flick = [0, 1, 0, -1, 1, 0][p.tick % 6];
  const tall = 3 + Math.round(p.flare * 2);
  for (let i = 0; i < tall; i++) {
    const y = hy - 2.2 - i;
    const x = hx + (i > 0 ? (((i + p.tick) & 1) === 0 ? flick * 0.6 : 0) : 0);
    const col = i === 0 ? core : i < tall - 2 ? hot : i < tall - 1 ? mid : deep;
    c.spark(x, y, col, (1 - i / (tall + 1)) * (0.6 + glow * 0.4));
    if (i < tall - 2) c.spark(x + (i & 1 ? 1 : -1), y + 0.5, mid, 0.35 * glow);
  }
  flareAt(c, hx, hy - 1, p.flare);
}

// ---------------------------------------------------------------------------
// Parts

/**
 * A bell-sleeved arm from the shoulder, bent at the elbow (towards `hint`),
 * the sleeve widening to a trimmed cuff and a bony hand; the casting hand
 * fills with light.
 */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], palm: number, bias = 0): void {
  const { x: fx, y: fy } = p;
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
  // The sleeve stops a little short of the hand.
  const k = 0.78;
  const wx = ex + (fx - ex) * k;
  const wy = ey + (fy - ey) * k;
  c.part();
  c.capsule(sx, sy, ex, ey, 1.6, 1.45, S.robe, { bias });
  c.part();
  c.capsule(ex, ey, wx, wy, 1.45, 2.0, S.robe, { bias });
  // A thin trimmed rim round the cuff's mouth.
  const [nx, ny] = [-(fy - ey), fx - ex];
  const nl = Math.hypot(nx, ny) || 1;
  c.part();
  c.line(wx - (nx / nl) * 1.6, wy - (ny / nl) * 1.6, wx + (nx / nl) * 1.6, wy + (ny / nl) * 1.6, S.trim, () => sphere(0, -0.2), { bias });
  c.part();
  c.ellipse(fx, fy, 1.15, 1.1, S.skin, { bias });
  if (palm > 0) {
    const [core, hot, mid] = S.light;
    c.spark(fx, fy, core, palm);
    c.spark(fx - 1, fy, hot, 0.6 * palm);
    c.spark(fx + 1, fy, hot, 0.6 * palm);
    c.spark(fx, fy - 1, hot, 0.6 * palm);
    if (palm > 0.5) for (const [ox, oy] of [[-2, -1], [2, -1], [0, -2], [-1, 1], [1, 1]]) c.spark(fx + ox, fy + oy, mid, 0.4 * palm);
  }
}

/** A pointed shoe peeking out from under the hem. */
function foot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x - 0.4, y, 2.1, 1.1, BOOT, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.5, 1.2, BOOT, { flatten: 0.8, bias });
}

/** The robe's outline: narrow at the shoulders, flaring to the hem. */
function robeWidth(u: number, chest: number, flare: number): number {
  return chest + u * u * flare;
}

/** The front opening down from the belt: the dark under-robe, edged in trim. */
function opening(c: PixelCanvas, cx: number, waist: number, hem: number, sway: number): void {
  c.part();
  for (let y = waist + 1; y <= hem; y++) {
    const u = (y - waist) / Math.max(1, hem - waist);
    const w = 0.5 + u * 1.3;
    const x0 = cx - w + u * u * sway;
    const x1 = cx + w + u * u * sway;
    for (let x = Math.round(x0); x < Math.round(x1); x++) if (c.filled(x, y)) c.px(x, y, S.inner, sphere(0, 0.2), { bias: -1 });
    if (c.filled(Math.round(x0) - 1, y)) c.px(Math.round(x0) - 1, y, S.trim, sphere(-0.3, 0));
    if (c.filled(Math.round(x1), y)) c.px(Math.round(x1), y, S.trim, sphere(0.3, 0));
  }
}

/** Trim along the hem's bottom row. */
function hemTrim(c: PixelCanvas, hem: number, x0: number, x1: number): void {
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (c.filled(x, hem)) c.px(x, hem, S.trim, sphere(0, 0.4));
}

/** The necromancer's mantle: a collar of bone plates draped over the shoulders, a small skull at its clasp. */
function boneMantle(c: PixelCanvas, cx: number, U: number, n: number, span: number, clasp: boolean): void {
  c.part();
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const x = cx + k * span;
    const y = 15.2 + U + (1 - k * k) * 1.3;
    c.ellipse(x, y, 0.95, 1.35, BONE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + k * 0.3, dy * 0.8 - 0.2, 1) });
  }
  if (!clasp) return;
  c.part();
  c.ellipse(cx, 17.4 + U, 1.6, 1.35, BONE);
  c.px(cx - 1, 17 + U, NECRO_INNER);
  c.px(cx, 17 + U, NECRO_INNER);
  c.spark(cx - 1, 17 + U, S.light[2], 0.6);
  c.spark(cx, 17 + U, S.light[2], 0.6);
}

/** The blood mage's high collar, standing up behind the head, gold along its rim. */
function highCollar(c: PixelCanvas, cx: number, U: number, l: number, r: number): void {
  const top = 11 + U;
  c.part();
  c.shape(top, 16 + U, (y) => {
    const u = (y - top) / 5;
    return [cx - l * (1 - u * 0.45), cx + r * (1 - u * 0.45)];
  }, BLOOD_INNER, (_x, _y, t, u) => sphere(-t * 0.8, u * 0.6 - 0.1, 1));
  for (let x = Math.floor(cx - l); x <= Math.ceil(cx + r); x++) if (c.filled(x, top)) c.px(x, top, GOLD, sphere(0, -0.4));
}

/** The hood's cowl, draped over the shoulders from the collar. */
function cowl(c: PixelCanvas, cx: number, U: number, l: number, r: number): void {
  const top = 14 + U;
  c.part();
  c.shape(top, top + 3, (y) => {
    const u = (y - top) / 3;
    const k = Math.sqrt(u) * 0.75 + 0.25;
    return [cx - l * k, cx + r * k];
  }, S.robe, (_x, _y, t, u) => sphere(t * 0.95, u - 0.6, 1));
}

// ---------------------------------------------------------------------------
// Directions

const REACH_FRONT = 4.4;
const REACH_SIDE = 5.0;

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const armA = () => arm(c, 7.5, 16.2 + U, fa, REACH_FRONT, [-0.6, 1], p.palm, fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.5, 16.2 + U, fb, REACH_FRONT, [0.6, 1], 0, fb.behind ? -1 : 0);
  if (S.blood) highCollar(c, cx, U, 5.6, 5.6);
  if (fa.behind) armA();
  if (fb.behind) {
    drawStaff(c, 'down', p, fb, -1);
    armB();
  }

  foot(c, 10, 30.3 - p.footA);
  foot(c, 14, 30.3 - p.footB);

  // The robe, flaring to a hem that swings as he goes.
  const top = 15 + U;
  const hem = 29 + L;
  const waist = 22 + U;
  c.part();
  c.shape(top, hem, (y) => {
    const u = (y - top) / (hem - top);
    const hw = robeWidth(u, 4.3, 2.1);
    const sw = u * u * p.sway;
    return [cx - hw + sw, cx + hw + sw];
  }, S.robe, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  // Folds falling from the belt.
  for (let y = waist + 2; y <= hem; y++) {
    const u = (y - top) / (hem - top);
    c.shade(Math.round(cx - 3 + u * u * p.sway - u), y, -1);
    c.shade(Math.round(cx + 3 + u * u * p.sway + u), y, -1);
  }
  opening(c, cx, waist, hem, p.sway);
  hemTrim(c, hem, cx - 8, cx + 8);
  // The belt, and its clasp.
  c.part();
  c.shape(waist, waist, () => [cx - 4.4, cx + 4.4], S.inner, (_x, _y, t) => cyl(t, 0));
  c.part();
  if (S.blood) c.px(cx, waist, BLOOD_GEM, sphere(0, -0.3));
  else c.px(cx, waist, BONE, sphere(0, -0.3));

  if (S.blood) {
    // Crimson over the shoulders, the gem clasp at the throat.
    cowl(c, cx, U, 5.4, 5.4);
    c.part();
    c.ellipse(cx, 16.3 + U, 1.15, 1.05, BLOOD_GEM);
    headBloodDown(c, cx, U, p);
  } else {
    cowl(c, cx, U, 5.3, 5.3);
    boneMantle(c, cx, U, 7, 5.0, true);
    headHoodDown(c, cx, U);
  }

  if (!fb.behind) {
    armB();
    drawStaff(c, 'down', p, fb);
  }
  if (!fa.behind) armA();
}

/** The hood from the front: its point, a face lost in shadow, a grey chin and two burning eyes. */
function headHoodDown(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.ellipse(cx, 11.2 + U, 4.1, 3.9, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.shape(6 + U, 7 + U, (y) => {
    const hw = (y - 6 - U) * 1.1 + 0.7;
    return [cx - hw - 0.4, cx + hw - 0.4];
  }, S.robe, (_x, _y, t) => sphere(t * 0.8, -0.8, 1));
  c.part();
  c.ellipse(cx, 12.7 + U, 2.7, 2.5, S.inner, { normal: () => sphere(0, 0.2, 1) });
  // Cheekbones and chin catching a little light.
  c.part();
  c.px(cx - 2, 13 + U, S.skin, sphere(-0.4, 0.2), { bias: -1 });
  c.px(cx + 1, 13 + U, S.skin, sphere(0.4, 0.2), { bias: -1 });
  c.shape(14 + U, 14 + U, () => [cx - 1.5, cx + 0.5], S.skin, (_x, _y, t) => sphere(t * 0.6, 0.5, 1), { bias: -1 });
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], false);
  // The hood's edge in trim, down both sides of the face.
  c.part();
  for (const [x, y] of [[cx - 3, 13], [cx - 3, 14], [cx + 2, 13], [cx + 2, 14]] as const) c.px(x, y + U, S.trim, sphere(x < cx ? -0.4 : 0.4, 0.2), { bias: -1 });
}

/** The blood mage from the front: a white mane, a pale gaunt face, ember eyes. */
function headBloodDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  // The mane, falling behind the shoulders on either side.
  c.part();
  c.ellipse(cx, 11.2 + U, 4.0, 3.9, BLOOD_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.capsule(cx - 3.4, 12 + U, cx - 3.8, 16.4 + U, 1.3, 0.9, BLOOD_HAIR);
  c.capsule(cx + 3.0, 12 + U, cx + 3.4, 16.4 + U, 1.3, 0.9, BLOOD_HAIR);
  c.part();
  c.ellipse(cx - 0.3, 12.8 + U, 2.55, 2.45, S.skin);
  // A fringe swept to one side over the brow.
  c.part();
  c.shape(9 + U, 10 + U, (y) => (y === 9 + U ? [cx - 3.2, cx + 3.2] : [cx - 3, cx + 0.4]), BLOOD_HAIR, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
  c.px(cx - 3, 11 + U, BLOOD_HAIR, sphere(-0.6, 0.2));
  c.px(cx + 2, 11 + U, BLOOD_HAIR, sphere(0.6, 0.2), { bias: -1 });
  // Hollow cheeks, a thin mouth.
  c.shade(cx - 2, 13 + U, -1);
  c.shade(cx + 1, 13 + U, -1);
  c.shade(cx - 1, 14 + U, -1);
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) c.px(x, y, S.skin, sphere(0, -0.3), { bias: -1 });
    else {
      c.px(x, y, S.eye);
      c.spark(x, y, S.light[1], 0.5);
    }
  }
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const armA = () => arm(c, 7.5, 16.2 + U, fa, REACH_FRONT, [-0.6, 0.8], p.palm, fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.5, 16.2 + U, fb, REACH_FRONT, [0.6, 0.8], 0, fb.behind ? -1 : 0);
  if (fa.behind) armA();
  if (fb.behind) {
    drawStaff(c, 'up', p, fb, -1);
    armB();
  }

  foot(c, 10, 30.3 - p.footB);
  foot(c, 14, 30.3 - p.footA);

  const top = 15 + U;
  const hem = 29 + L;
  const waist = 22 + U;
  c.part();
  c.shape(top, hem, (y) => {
    const u = (y - top) / (hem - top);
    const hw = robeWidth(u, 4.3, 2.1);
    const sw = u * u * p.sway;
    return [cx - hw + sw, cx + hw + sw];
  }, S.robe, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
  for (let y = waist + 1; y <= hem; y++) {
    const u = (y - top) / (hem - top);
    c.shade(Math.round(cx + u * u * p.sway), y, -1);
  }
  hemTrim(c, hem, cx - 8, cx + 8);
  c.part();
  c.shape(waist, waist, () => [cx - 4.4, cx + 4.4], S.inner, (_x, _y, t) => cyl(t, 0));

  if (S.blood) {
    cowl(c, cx, U, 5.4, 5.4);
    // The mane down the back, over the collar's rim.
    highCollar(c, cx, U, 5.6, 5.6);
    c.part();
    c.ellipse(cx, 11.2 + U, 4.0, 3.9, BLOOD_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    c.part();
    c.shape(13 + U, 17 + U, (y) => {
      const hw = 2.6 - (y - 13 - U) * 0.4;
      return [cx - hw, cx + hw];
    }, BLOOD_HAIR, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
    for (let y = 12 + U; y <= 17 + U; y++) c.shade(cx - 1 + ((y & 1) === 0 ? 0 : 2), y, -1);
  } else {
    cowl(c, cx, U, 5.3, 5.3);
    boneMantle(c, cx, U - 0.6, 7, 5.0, false);
    // The back of the hood, drawn to a point that hangs down the back.
    c.part();
    c.ellipse(cx, 11.3 + U, 4.1, 3.9, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    c.part();
    c.shape(6 + U, 7 + U, (y) => {
      const hw = (y - 6 - U) * 1.1 + 0.7;
      return [cx - hw - 0.4, cx + hw - 0.4];
    }, S.robe, (_x, _y, t) => sphere(t * 0.8, -0.8, 1));
    c.part();
    c.shape(14 + U, 18 + U, (y) => {
      const hw = 1.8 - (y - 14 - U) * 0.4;
      return hw < 0.3 ? null : [cx - hw, cx + hw];
    }, S.robe, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
    c.shade(cx, 9 + U, 1);
  }

  if (!fb.behind) {
    armB();
    drawStaff(c, 'up', p, fb);
  }
  if (!fa.behind) armA();
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean; // upper body centre
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);

  if (S.blood) {
    // The collar standing up behind the head, and the mane streaming back.
    c.part();
    c.shape(11 + U, 16 + U, (y) => [hx + 0.6, hx + 3.6 - (y - 11 - U) * 0.3], BLOOD_INNER, (_x, _y, t, u) => sphere(t * 0.8 + 0.2, u * 0.6 - 0.1, 1));
    c.px(Math.round(hx + 1), 11 + U, GOLD, sphere(0, -0.4));
    c.px(Math.round(hx + 2), 11 + U, GOLD, sphere(0.2, -0.4));
  }
  // The casting arm behind everything, unless it reaches out in front.
  if (fa.behind) arm(c, hx + 1.2, 16.4 + U, fa, REACH_SIDE, [0.3, 1], p.palm, -1);

  // Feet: the back one in shade first.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  foot(c, cx + 0.8 - p.footB, 30.4 - lift(p.footB), true, -1);
  foot(c, cx - 0.8 - p.footA, 30.4 - lift(p.footA), true);

  // The robe in profile, the hem billowing back.
  const top = 15 + U;
  const hem = 29 + L;
  const waist = 22 + U;
  c.part();
  c.shape(top, hem, (y) => {
    const u = (y - top) / (hem - top);
    const shift = hx + (cx - hx) * u;
    const hw = robeWidth(u, 3.2, 1.6);
    return [shift - hw - 0.2 - u * 0.4, shift + hw + 0.2 + u * u * (0.6 + p.sway)];
  }, S.robe, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  // The opening down the front edge, trimmed.
  for (let y = waist + 1; y <= hem; y++) {
    const u = (y - top) / (hem - top);
    const shift = hx + (cx - hx) * u;
    const x = Math.round(shift - robeWidth(u, 3.2, 1.6) - 0.2 - u * 0.4);
    if (c.filled(x, y)) c.px(x, y, S.trim, sphere(-0.5, 0));
    if (c.filled(x + 1, y)) c.px(x + 1, y, S.inner, sphere(-0.3, 0.2), { bias: -1 });
  }
  for (let y = waist + 2; y <= hem; y++) c.shade(Math.round(hx + 1.5 + (y - waist) * 0.2), y, -1);
  hemTrim(c, hem, cx - 8, cx + 8);
  c.part();
  c.shape(waist, waist, () => [hx - 3.3, hx + 3.3], S.inner, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(hx - 3.3), waist, S.blood ? BLOOD_GEM : BONE, sphere(-0.5, -0.3));

  if (S.blood) {
    cowl(c, hx, U, 4.0, 4.2);
    c.part();
    c.px(Math.round(hx - 3), 16 + U, BLOOD_GEM, sphere(-0.5, -0.2));
    // The mane, then the face turned to the left.
    c.part();
    c.ellipse(hx + 0.5, 11.3 + U, 3.5, 3.8, BLOOD_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
    c.part();
    c.capsule(hx + 2.2, 12.5 + U, hx + 3.2 + p.sway * 0.4, 17.5 + U, 1.6, 0.9, BLOOD_HAIR);
    c.part();
    c.ellipse(hx - 1.4, 12.9 + U, 2.2, 2.3, S.skin);
    c.part();
    c.px(hx - 4, 12.6 + U, S.skin, sphere(-0.7, -0.1), { bias: 1 });
    c.shade(hx - 2, 14 + U, -1);
    c.part();
    c.shape(9 + U, 10 + U, (y) => (y === 9 + U ? [hx - 3.2, hx + 3] : [hx - 3.4, hx - 0.6]), BLOOD_HAIR, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
    c.px(hx - 0.4, 11 + U, BLOOD_HAIR, sphere(0.3, 0.2));
    c.px(hx - 0.2, 12 + U, BLOOD_HAIR, sphere(0.4, 0.4), { bias: -1 });
    eyes(c, [[hx - 3, 12 + U]], p.blink);
  } else {
    cowl(c, hx, U, 4.2, 4.4);
    boneMantle(c, hx - 0.6, U, 4, 3.4, false);
    // The hood in profile, its point hanging back, the face deep inside it.
    c.part();
    c.ellipse(hx + 0.4, 11.3 + U, 3.5, 3.9, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
    c.part();
    c.capsule(hx + 2.4, 9 + U, hx + 4.2 + p.sway * 0.3, 13.6 + U, 1.4, 0.6, S.robe);
    c.part();
    c.shape(7 + U, 8 + U, (y) => [hx - 3.2 + (8 + U - y) * 0.9, hx + 2.8], S.robe, (_x, _y, t, u) => sphere(t * 0.9, u - 0.7, 1));
    c.part();
    c.ellipse(hx - 1.7, 12.7 + U, 1.9, 2.3, S.inner, { normal: () => sphere(-0.2, 0.2, 1) });
    c.part();
    c.px(hx - 3, 14 + U, S.skin, sphere(-0.5, 0.4));
    c.px(hx - 2, 14 + U, S.skin, sphere(-0.2, 0.5), { bias: -1 });
    c.px(hx - 3, 13 + U, S.skin, sphere(-0.6, 0.1), { bias: -1 });
    eyes(c, [[hx - 3, 12 + U]], false);
    c.part();
    c.px(Math.round(hx - 4), 13 + U, S.trim, sphere(-0.5, 0.2), { bias: -1 });
    c.px(Math.round(hx - 4), 14 + U, S.trim, sphere(-0.5, 0.3), { bias: -1 });
  }

  // The staff held out ahead, the near arm gripping it; the casting hand in front once it reaches out.
  drawStaff(c, 'side', p, fb);
  arm(c, hx + 0.2, 16.6 + U, fb, REACH_SIDE, [0.4, 1], 0);
  if (!fa.behind) arm(c, hx + 0.8, 16.4 + U, fa, REACH_SIDE, [0.3, 1], p.palm);
}

// ---------------------------------------------------------------------------
// Animations

/** The casting hand hanging loose, the staff planted at his side. */
const REST_A = H(0.6, 4.4, -3.2);
const REST_B = H(1.6, 5.4, -2.2);
const REST_A_SIDE = H(0.2, 0, -3.2);
const REST_B_SIDE = H(3.2, 0, -2.0);

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: view === 'side' ? { ...REST_A_SIDE } : { ...REST_A },
  b: view === 'side' ? { ...REST_B_SIDE } : { ...REST_B },
  tilt: 0,
  palm: 0,
  flare: 0,
  sway: 0,
  tick: 0,
});

/** Standing still, the robe stirring, soul fire flickering on the staff. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.a.h += Math.sin(ph) * 0.4;
    p.b.h += p.breath * -0.3;
    p.sway = Math.sin(ph - 1) * 0.6;
    p.palm = f === 2 || f === 3 ? 0.25 : 0;
    p.tick = f;
    p.blink = f === 4;
    frames.push(p);
  }
  return frames;
}

/** A slow, gliding walk, the staff swung forward with each step. */
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
      p.sway = 0.8 + Math.abs(s) * 0.9;
      p.b = H(3.2 - s * 0.6, 0, -2 + p.lift * 0.4);
      p.a = H(0.2 + s * 1.4, 0, -3.2 + p.lift * 0.4);
      p.tilt = 0.08 + s * 0.06;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.7;
      p.b = H(1.6 - s * 0.5, 5.4, -2.2 + p.lift * 0.4);
      p.a = H(0.6 + s * 1.4, 4.4, -3.2 + p.lift * 0.4);
      p.tilt = s * 0.05;
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
  tilt?: number;
  palm?: number;
  flare?: number;
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
      p.a = { ...(view === 'side' && k.aSide ? k.aSide : k.a) };
      p.b = { ...(view === 'side' && k.bSide ? k.bSide : k.b) };
      p.tilt = k.tilt ?? 0;
      p.palm = k.palm ?? 0;
      p.flare = k.flare ?? 0;
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

/** The bolt: the hand drawn back to the shoulder as it fills with light, then thrust out and opened. */
const cast = action([
  { a: H(-0.6, 4.2, 1.2), b: REST_B, aSide: H(-1, 0, 1.2), bSide: REST_B_SIDE, palm: 0.35, flare: 0.2, tilt: 0.05 },
  { a: H(1.2, 3.2, 2.2), b: REST_B, aSide: H(0.8, 0, 2), bSide: REST_B_SIDE, palm: 0.75, flare: 0.5, tilt: 0.08, lean: -1 },
  { a: H(5.6, 1.2, 1.8), b: REST_B, aSide: H(5.6, 0, 1.6), bSide: H(2.6, 0, -2), palm: 1, flare: 0.8, tilt: 0.12, lean: 1, step: 1 },
  { a: H(5.0, 1.6, 1.2), b: REST_B, aSide: H(5, 0, 1.2), bSide: H(2.8, 0, -2), palm: 0.4, flare: 0.3, tilt: 0.08, lean: 1, step: 1 },
  { a: H(2.0, 3.4, -1.4), b: REST_B, aSide: H(1.8, 0, -1.6), bSide: REST_B_SIDE, palm: 0.1, tilt: 0.03 },
]);

/**
 * Raising the dead: staff and hand lifted high while the soul fire swells,
 * then the staff's heel driven down into the ground.
 */
const raise = action([
  { a: H(1.2, 4.6, 3), b: H(1.8, 5.2, 1.5), aSide: H(1.4, 0, 3), bSide: H(3.2, 0, 1.2), palm: 0.2, flare: 0.2 },
  { a: H(1.0, 4.8, 7), b: H(1.6, 4.8, 5.5), aSide: H(1.2, 0, 7), bSide: H(3.2, 0, 5), palm: 0.5, flare: 0.5, lift: 1 },
  { a: H(0.8, 4.6, 9.5), b: H(1.4, 4.4, 8.5), aSide: H(1.0, 0, 9.2), bSide: H(3.0, 0, 8), palm: 0.8, flare: 0.8, lift: 1, lean: -1 },
  { a: H(0.8, 4.4, 10), b: H(1.4, 4.2, 9), aSide: H(1.0, 0, 9.8), bSide: H(3.0, 0, 8.6), palm: 1, flare: 1, lift: 1, lean: -1 },
  { a: H(3.2, 3.6, -1.6), b: H(2.4, 5.0, -3.2), aSide: H(3.4, 0, -1.6), bSide: H(3.6, 0, -3.4), palm: 1, flare: 1, breath: 1, lean: 1, step: 1 },
  { a: H(2.4, 4.0, -2.4), b: H(2.2, 5.0, -3.0), aSide: H(2.4, 0, -2.4), bSide: H(3.5, 0, -3.2), palm: 0.5, flare: 0.5, breath: 1, lean: 1, step: 1 },
  { a: REST_A, b: REST_B, aSide: REST_A_SIDE, bSide: REST_B_SIDE, palm: 0.15, flare: 0.15 },
]);

// ---------------------------------------------------------------------------
// Frame generation

export type NecroAnim = 'idle' | 'walk' | 'cast' | 'raise';

export interface NecroAnimDef {
  name: NecroAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
}

export const NECRO_ANIMS: NecroAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 9, loop: true, poses: walk },
  { name: 'cast', fps: 16, loop: false, poses: cast },
  { name: 'raise', fps: 10, loop: false, poses: raise },
];

/** Frame index at which each spell is released. */
export const RELEASE_FRAME = { cast: 2, raise: 4 } as const;

export interface NecroFrame {
  key: string; // e.g. "walk_left_3"
  anim: NecroAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawNecroFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(NECRO_W, NECRO_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildNecroFrames(look: NecroLook = NECRO_LOOK): NecroFrame[] {
  S = look;
  const out: NecroFrame[] = [];
  for (const a of NECRO_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawNecroFrame(dir, pose) });
      });
    }
  }
  S = NECRO_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Ability icons (16x16)

/** The soul bolt: a green wisp with a skull's face, its flame streaming back. */
export function soulBoltIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  // The tail, streaming up and back to the upper right.
  for (let i = 0; i < 9; i++) {
    const x = 8 + i * 0.7;
    const y = 8 - i * 0.75;
    const w = 2.6 - i * 0.25;
    for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
      const d = Math.abs(dx) / w;
      if (d > 1) continue;
      put(Math.round(x + dx * 0.7), Math.round(y + dx * 0.7), d < 0.35 ? '#9dffd4' : d < 0.7 ? '#3fe0a0' : '#127a62');
    }
  }
  // The head: a round skull of light.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 6, y + 0.5 - 10);
      if (d <= 2.2) put(x, y, '#f0fff8');
      else if (d <= 3.4) put(x, y, '#9dffd4');
      else if (d <= 4.2) put(x, y, '#3fe0a0');
    }
  }
  outline('#06281e');
  // Sockets and teeth.
  put(4, 9, '#0c3a2c');
  put(7, 9, '#0c3a2c');
  put(5, 12, '#127a62');
  put(6, 12, '#f0fff8');
  put(7, 12, '#127a62');
  return px;
}

/** Raise dead: a skeletal hand clawing up out of a grave mound, soul fire rising. */
export function raiseIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  // The mound.
  for (let y = 11; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const q = Math.hypot((x + 0.5 - 8) / 7.5, (y + 0.5 - 15.5) / 4);
      if (q <= 1) put(x, y, q < 0.5 ? '#6a4a36' : y < 13 ? '#8a6446' : '#4a3226');
    }
  }
  // The forearm and hand, fingers splayed.
  const bone = ['#f8f2da', '#dcd4b4', '#a39d84'];
  for (let y = 7; y <= 12; y++) {
    put(7, y, bone[1]);
    put(8, y, bone[0]);
  }
  for (const [x, y] of [[6, 6], [7, 6], [8, 6], [9, 6]]) put(x, y, bone[0]);
  // Fingers: bent claws.
  for (const [x0, len, lean] of [[5, 3, -1], [7, 4, 0], [9, 4, 0], [10, 3, 1]] as const) {
    for (let i = 1; i <= len; i++) put(x0 + (i === len ? lean : 0), 6 - i, i === len ? bone[1] : bone[0]);
  }
  put(4, 8, bone[1]);
  put(5, 7, bone[0]);
  outline('#1a1814');
  // Soul fire rising round it.
  for (const [x, y, c] of [[2, 4, '#3fe0a0'], [3, 2, '#9dffd4'], [13, 5, '#3fe0a0'], [12, 3, '#9dffd4'], [13, 1, '#3fe0a0'], [1, 9, '#127a62'], [14, 9, '#127a62']] as const) put(x, y, c);
  return px;
}

/** The blood lance: a crimson spear of blood with drops flung off it. */
export function bloodLanceIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let i = 0; i < 12; i++) {
    const x = 2 + i;
    const y = 13 - i;
    const tip = i >= 9;
    put(x, y, tip ? '#fff0f0' : '#ff8a96');
    if (!tip) {
      put(x + 1, y, '#e8243c');
      put(x, y + 1, '#a8102a');
    }
    if (i < 5) put(x - 1, y + 1, '#7a0a1e');
  }
  put(14, 1, '#fff0f0');
  put(13, 1, '#ff8a96');
  put(14, 2, '#ff8a96');
  outline('#1e0208');
  for (const [x, y] of [[3, 7], [6, 3], [10, 13], [12, 9]]) put(x, y, '#e8243c');
  return px;
}

/** The crimson nova: a ring of blood bursting out from a heart of light. */
export function novaIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
      const a = Math.atan2(y + 0.5 - 8, x + 0.5 - 8);
      const jag = Math.sin(a * 6) * 0.5;
      if (d <= 1.8) put(x, y, '#fff0f0');
      else if (d <= 2.8) put(x, y, '#ff8a96');
      else if (Math.abs(d - (6 + jag)) <= 0.9) put(x, y, d < 6 + jag ? '#ff8a96' : '#e8243c');
    }
  }
  outline('#1e0208');
  // Drops flung between the heart and the ring.
  for (const [x, y] of [[8, 4], [12, 8], [8, 12], [4, 8]]) put(x, y, '#a8102a');
  return px;
}
