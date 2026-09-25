// The archer, drawn procedurally from a small rig like the alchemist.
//
// A ranger: a forest-green hooded cloak over a moss tunic and a tan leather
// jerkin, auburn hair under the hood, a leather bracer on the bow arm and a
// quiver of red-fletched arrows on the back. The yew longbow is always in the
// off hand; the draw hand nocks, draws to the jaw and looses.
//
// The body keeps to the 24x32 box; frames are larger so the bow can be raised
// overhead. Drawing functions work in body-box coordinates. Hands are posed in
// the archer's own terms (forward, out to the side, height) and placed for
// each view. While the bow is raised it points from the draw hand through the
// grip, so one set of keyframes aims it right in every direction. The arrows
// he looses are drawn here too, as small sprites in sixteen headings.
//
// The storm archer is his other look on the same rig: a thunderhead-indigo
// hood and cloak edged in silver, silver hair, eyes lit blue, a bow of dark
// steel strung with lightning and arrows fletched with it.

import { PixelCanvas, cyl, sphere, type Material, type RGB } from './pixel';
import {
  ARC,
  ARC_FLETCH,
  BOLT_CORE,
  BOLT_HOT,
  BOLT_MID,
  BOOT,
  BOWSTRING,
  EYE,
  FLETCH,
  GOLD,
  HAIR,
  JERKIN,
  LEATHER,
  RANGER_CLOAK,
  RANGER_HAIR,
  RANGER_TUNIC,
  SKIN,
  STEEL,
  STORM_BOW,
  STORM_CLOAK,
  STORM_EYE,
  STORM_JERKIN,
  STORM_TRIM,
  STORM_TUNIC,
  TROUSER,
  YEW,
} from './palette';
import { DIRS, type Dir } from './wizard';

export const ARCHER_W = 48;
export const ARCHER_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const ARCHER_ORIGIN_X = BODY_X + 12;
export const ARCHER_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet an arrow flies at: the draw hand at the jaw. */
export const ARROW_H = 15;

/** A hand, in the archer's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

export interface Pose {
  /** Whole body raised (walk passing frames). */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The draw hand (screen left from the front and back, the near arm from the side) and the bow hand. */
  a: Hand;
  b: Hand;
  /** The bow is up and aimed (pointing from the draw hand through the grip), not carried. */
  raised: boolean;
  /** An arrow sits on the string, its nock in the draw hand. */
  nock: boolean;
  /** 0..1 how far the string is drawn. */
  draw: number;
  /** 0..1 the arrowhead gathering light (the volley). */
  glint: number;
  /** Cloak swinging behind (side view) or to one side, in pixels. */
  sway: number;
  blink?: boolean;
}

/** One look for the archer: its texture key, its cloth and its bow. */
export interface ArcherLook {
  key: string;
  cloak: Material;
  tunic: Material;
  jerkin: Material;
  hair: Material;
  eye: Material;
  bow: Material;
  string: Material;
  fletch: Material;
  /** The arrowhead, and the shaft behind it. */
  head: Material;
  shaft: Material;
  /** Buckles and the hood's edge. */
  metal: Material;
  /** Silver edging along the hood and cloak. */
  trim?: Material;
  /** Light the arrowhead gathers, brightest first. */
  light: [RGB, RGB, RGB];
  /** The storm archer: the string and arrows crackle. */
  storm: boolean;
}

export const RANGER_LOOK: ArcherLook = {
  key: 'archer',
  cloak: RANGER_CLOAK,
  tunic: RANGER_TUNIC,
  jerkin: JERKIN,
  hair: RANGER_HAIR,
  eye: EYE,
  bow: YEW,
  string: BOWSTRING,
  fletch: FLETCH,
  head: STEEL,
  shaft: YEW,
  metal: GOLD,
  light: [[255, 250, 232], [255, 222, 150], [236, 168, 80]],
  storm: false,
};

export const STORM_LOOK: ArcherLook = {
  key: 'archer_storm',
  cloak: STORM_CLOAK,
  tunic: STORM_TUNIC,
  jerkin: STORM_JERKIN,
  hair: HAIR,
  eye: STORM_EYE,
  bow: STORM_BOW,
  string: ARC,
  fletch: ARC_FLETCH,
  head: ARC,
  shaft: STORM_BOW,
  metal: STORM_TRIM,
  trim: STORM_TRIM,
  light: [BOLT_CORE, BOLT_HOT, BOLT_MID],
  storm: true,
};

export const ARCHER_LOOKS = [RANGER_LOOK, STORM_LOOK];

/** The look being drawn; set by buildArcherFrames. */
let S: ArcherLook = RANGER_LOOK;

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
  // Facing left; the far arm sits a touch higher and behind the body.
  const far = arm === 'b';
  return { x: hx - 1 - q.f * 1.05 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), behind: far };
}

// ---------------------------------------------------------------------------
// The bow

/** How the bow sits: its grip, the way it points (n) and the line of its limbs (axis). */
interface BowFrame {
  x: number;
  y: number;
  nx: number;
  ny: number;
  ax: number;
  ay: number;
}

const unit = (x: number, y: number): [number, number] => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

function bowFrame(view: View, p: Pose, fa: Placed, fb: Placed): BowFrame {
  let nx: number;
  let ny: number;
  if (p.raised) {
    // Aimed: from the draw hand through the grip, or straight ahead once the hand has flown off it.
    const d = Math.hypot(fb.x - fa.x, fb.y - fa.y);
    if (d > 2) [nx, ny] = unit(fb.x - fa.x, fb.y - fa.y);
    else [nx, ny] = view === 'side' ? [-1, 0] : view === 'down' ? [0, 1] : [0, -1];
  } else {
    // Carried low at his side, belly out.
    [nx, ny] = view === 'side' ? unit(-1, 0.45) : unit(1, -0.25);
  }
  // The limbs cross the aim; the upper limb tips back a little from the front, as a bow is canted.
  let [ax, ay] = [-ny, nx];
  if (ay > 0 || (ay === 0 && ax > 0)) [ax, ay] = [-ax, -ay];
  return { x: fb.x, y: fb.y, nx, ny, ax, ay };
}

/**
 * The bow at its grip: two limbs bending back from the handle to the tips, a
 * leather grip, the string (drawn to the hand, or straight), and the nocked
 * arrow along the aim.
 */
function drawBow(c: PixelCanvas, view: View, p: Pose, fa: Placed, fb: Placed, bias = 0): void {
  const f = bowFrame(view, p, fa, fb);
  const L = view === 'side' ? 7.6 : 7.1;
  const bend = 2.1 + p.draw * 1.4;
  const at = (t: number): [number, number] => {
    // Recurved tips flick forward again at the very ends.
    const back = bend * t * t - (Math.abs(t) > 0.82 ? (Math.abs(t) - 0.82) * 2.4 : 0);
    return [f.x + f.ax * t * L - f.nx * back, f.y + f.ay * t * L - f.ny * back];
  };
  // Limbs, grip outward to each tip, thinning as they go.
  c.part();
  const steps = 10;
  for (const s of [-1, 1]) {
    for (let i = 0; i < steps; i++) {
      const t0 = (i / steps) * s;
      const t1 = ((i + 1) / steps) * s;
      const [x0, y0] = at(t0);
      const [x1, y1] = at(t1);
      c.capsule(x0, y0, x1, y1, 1.1 - (i / steps) * 0.5, 1.1 - ((i + 1) / steps) * 0.5, S.bow, { bias });
    }
  }
  const [tx0, ty0] = at(-1);
  const [tx1, ty1] = at(1);
  c.part();
  c.capsule(f.x - f.ax * 1.4, f.y - f.ay * 1.4, f.x + f.ax * 1.4, f.y + f.ay * 1.4, 1.05, 1.05, S.storm ? STORM_JERKIN : LEATHER, { bias });

  // The string, from tip to tip, pulled back to the hand while an arrow is on it.
  c.part();
  const glow = S.storm ? { glow: 0.9 } : {};
  if (p.nock) {
    c.line(tx0, ty0, fa.x, fa.y, S.string, () => sphere(0, -0.2), glow);
    c.line(fa.x, fa.y, tx1, ty1, S.string, () => sphere(0, -0.2), glow);
  } else {
    c.line(tx0, ty0, tx1, ty1, S.string, () => sphere(0, -0.2), glow);
  }
  if (S.storm) {
    // Lightning living in the string: sparks along it.
    for (let k = 0; k < 3; k++) {
      const u = (k + 0.5) / 3;
      const [sx, sy] = p.nock ? (u < 0.5 ? [tx0 + (fa.x - tx0) * u * 2, ty0 + (fa.y - ty0) * u * 2] : [fa.x + (tx1 - fa.x) * (u - 0.5) * 2, fa.y + (ty1 - fa.y) * (u - 0.5) * 2]) : [tx0 + (tx1 - tx0) * u, ty0 + (ty1 - ty0) * u];
      c.spark(sx, sy, BOLT_HOT, 0.35);
    }
  }
  if (p.nock) arrowOnString(c, fa.x, fa.y, f.nx, f.ny, p.glint);
}

/** An arrow nocked at (x, y), pointing along (nx, ny): fletching at the nock, the shaft, a steel head. */
function arrowOnString(c: PixelCanvas, x: number, y: number, nx: number, ny: number, glint: number): void {
  const len = 10.5;
  const hx = x + nx * len;
  const hy = y + ny * len;
  c.part();
  c.line(x + nx * 1.5, y + ny * 1.5, hx - nx * 1.2, hy - ny * 1.2, S.shaft, () => sphere(0, -0.3));
  // Fletching: a feather either side of the shaft near the nock.
  c.part();
  for (const k of [1.2, 2.4]) {
    c.px(x + nx * k - ny, y + ny * k + nx, S.fletch, sphere(-0.3, 0.2));
    c.px(x + nx * k + ny, y + ny * k - nx, S.fletch, sphere(0.3, -0.2));
  }
  c.part();
  c.px(hx - nx * 0.6, hy - ny * 0.6, S.head, sphere(-0.3, -0.4));
  c.px(hx, hy, S.head, sphere(-0.5, -0.5), { bias: 1 });
  if (S.storm) {
    c.spark(hx, hy, BOLT_CORE, 0.5 + glint * 0.5);
    c.spark(hx + nx, hy + ny, BOLT_HOT, 0.3 + glint * 0.4);
  }
  if (glint > 0) {
    // Light gathering at the head: a small cross of it, the arms growing with the glint.
    const [core, hot, mid] = S.light;
    c.spark(hx, hy, core, glint);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(hx + dx, hy + dy, hot, 0.7 * glint);
    if (glint > 0.6) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) c.spark(hx + dx, hy + dy, mid, 0.5 * glint);
  }
}

// ---------------------------------------------------------------------------
// Parts

/**
 * A sleeved arm from the shoulder, bent at the elbow (towards `hint`), a hand
 * at the end; the bow arm wears a leather bracer on its forearm.
 */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bracer: boolean, bias = 0): void {
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
  c.capsule(sx, sy, ex, ey, 1.65, 1.4, S.tunic, { bias });
  c.part();
  if (bracer) {
    c.capsule(ex, ey, ex + (fx - ex) * 0.35, ey + (fy - ey) * 0.35, 1.35, 1.35, S.tunic, { bias });
    c.part();
    c.capsule(ex + (fx - ex) * 0.35, ey + (fy - ey) * 0.35, fx, fy, 1.45, 1.35, S.jerkin, { bias: bias + 1 });
  } else {
    c.capsule(ex, ey, fx, fy, 1.4, 1.25, S.tunic, { bias });
  }
  c.part();
  c.ellipse(fx, fy, 1.2, 1.15, SKIN, { bias });
}

function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  c.part();
  c.capsule(hx, hy, fx, fy, 1.5, 1.3, TROUSER, { bias });
}

/** A soft leather boot with a turned-down cuff. */
function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x, y, 2.2, 1.2, BOOT, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.6, 1.3, BOOT, { flatten: 0.8, bias });
  c.part();
  c.shape(Math.round(y - 2.4), Math.round(y - 2.4), () => [x - (side ? 1.4 : 1.7), x + (side ? 1.6 : 1.7)], BOOT, (_x, _y, t) => cyl(t, 0.3), { bias: bias + 1 });
}

/** The quiver's mouth: arrow fletchings fanned at (x, y), leaning `lean` px per row. */
function fletchings(c: PixelCanvas, x: number, y: number, lean: number): void {
  c.part();
  const tips: [number, number][] = [[-1, 0], [0, -1], [1, 0]];
  for (const [dx, dy] of tips) {
    c.px(x + dx + lean * 2, y + dy - 1, S.fletch, sphere(dx * 0.4 - 0.2, -0.6));
    c.px(x + dx + lean, y + dy, S.fletch, sphere(dx * 0.4, -0.2));
  }
  if (S.storm) {
    c.spark(x + lean * 2, y - 2, BOLT_HOT, 0.35);
    c.spark(x - 1 + lean, y, BOLT_MID, 0.25);
  }
}

/** The quiver on his back, a leather tube from (x0, y0) at its mouth to (x1, y1), arrows fanned out of it. */
function quiver(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, bias = 0): void {
  fletchings(c, x0, y0 - 1, (x0 - x1) / Math.max(1, y1 - y0) * 1.2);
  c.part();
  c.capsule(x0, y0, x1, y1, 1.7, 1.45, S.storm ? STORM_JERKIN : LEATHER, { bias });
  c.part();
  // A rim at the mouth and a band round the middle.
  c.capsule(x0 - 0.1, y0, x0 + (x1 - x0) * 0.08, y0 + (y1 - y0) * 0.08, 1.8, 1.8, S.jerkin, { bias: bias + 1 });
  c.px(x0 + (x1 - x0) * 0.55, y0 + (y1 - y0) * 0.55, S.metal, sphere(-0.3, -0.3));
}

/** The hood's cowl, draped over the shoulders from the collar. */
function cowl(c: PixelCanvas, cx: number, U: number, l: number, r: number): void {
  const top = 14 + U;
  c.part();
  c.shape(top, top + 3, (y) => {
    const u = (y - top) / 3;
    const k = Math.sqrt(u) * 0.75 + 0.25;
    return [cx - l * k, cx + r * k];
  }, S.cloak, (_x, _y, t, u) => sphere(t * 0.95, u - 0.6, 1));
  // A ragged, leaf-cut edge (or a silver hem on the storm cloak).
  const y = top + 3;
  for (let x = Math.floor(cx - l); x <= Math.ceil(cx + r); x++) {
    if (!c.filled(x, y)) continue;
    if (S.trim) c.px(x, y, S.trim, sphere(0, 0.3));
    else if ((x & 1) === 0) c.shade(x, y, -1);
  }
}

// ---------------------------------------------------------------------------
// Directions

const REACH_FRONT = 4.4;
const REACH_SIDE = 5.2;

/** The tunic's outline: broad at the chest, nipped at the belt, a short skirt below. */
function tunicWidth(y: number, top: number, waist: number, chest: number): number {
  if (y <= waist) {
    const u = (y + 0.5 - top) / (waist - top);
    return chest - 0.5 * u * u;
  }
  return chest - 0.4 + (y - waist) * 0.35;
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const armA = () => arm(c, 7.4, 16.4 + U, fa, REACH_FRONT, [-0.5, 1], false, fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.6, 16.4 + U, fb, REACH_FRONT, [0.5, 1], true, fb.behind ? -1 : 0);

  // The quiver's fletchings peek over his right shoulder.
  fletchings(c, 7.4, 12.6 + U, -0.4);
  c.part();
  c.capsule(6.9, 13.8 + U, 8.2, 13.8 + U, 0.8, 0.8, S.storm ? STORM_JERKIN : LEATHER);
  // The cloak hangs behind him, showing at his sides.
  c.part();
  c.shape(15 + U, 26 + L, (y) => {
    const u = (y - 15 - U) / (11 + L - U);
    const hw = 5.0 + u * 1.3;
    const sw = u * p.sway;
    return [cx - hw + sw, cx + hw + sw];
  }, S.cloak, (_x, _y, t, u) => sphere(t * 0.9, u * 0.4, 1), { bias: -1 });
  if (fa.behind) armA();
  if (fb.behind) {
    armB();
    drawBow(c, 'down', p, fa, fb, -1);
  }

  leg(c, 10.2, 24.5 + L, 10, 28.4 - p.footA);
  leg(c, 13.8, 24.5 + L, 14, 28.4 - p.footB);
  boot(c, 10, 29.6 - p.footA);
  boot(c, 14, 29.6 - p.footB);

  // The tunic, its skirt split at the front.
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 25 + L;
  c.part();
  c.shape(top, hem, (y) => {
    const hw = tunicWidth(y, top, waist, 4.4);
    return [cx - hw, cx + hw];
  }, S.tunic, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  for (let y = waist + 1; y <= hem; y++) c.shade(cx, y, -2);
  // The jerkin over the chest, laced at a V-neck.
  c.part();
  c.shape(top + 1, waist - 1, (y) => {
    const hw = tunicWidth(y, top, waist, 4.4) - 0.3;
    return [cx - hw, cx + hw];
  }, S.jerkin, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.8 - 0.3, 1));
  for (let y = top + 1; y <= top + 3; y++) {
    const v = 1.6 - (y - top - 1) * 0.6;
    for (let x = Math.round(cx - v); x < Math.round(cx + v); x++) c.erase(x, y);
  }
  for (let y = top + 4; y < waist; y++) c.shade(cx, y, -1);
  c.px(cx - 1, top + 3, S.metal, sphere(-0.3, -0.3));
  // Belt and buckle.
  c.part();
  c.shape(waist, waist, () => [cx - 4.2, cx + 4.2], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx, waist, S.metal, sphere(0, -0.3));
  // The quiver strap across his chest, right shoulder to left hip.
  c.part();
  c.capsule(8.2, 15.4 + U, 15.4, 21.4 + U, 0.55, 0.55, LEATHER);

  cowl(c, cx, U, 5.8, 5.8);

  // Head: the hood, a face in its shadow, a fringe of hair under its edge.
  c.part();
  c.ellipse(cx, 11.3 + U, 3.9, 3.7, S.cloak, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.px(cx - 1, 7 + U, S.cloak, sphere(-0.3, -0.8));
  if (S.trim) {
    c.part();
    c.ellipse(cx, 12.5 + U, 2.95, 2.75, S.trim);
  }
  c.part();
  c.ellipse(cx, 12.7 + U, 2.5, 2.3, SKIN);
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 2.5, cx + 2.5], S.hair, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
  c.px(cx - 3, 11 + U, S.hair, sphere(-0.6, 0.2));
  c.px(cx + 1, 11 + U, S.hair, sphere(0.2, 0), { bias: -1 });
  // The hood's shadow across the brow, the eyes under it.
  for (let x = cx - 2; x <= cx + 1; x++) c.shade(x, 11 + U, -1);
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
  c.shade(cx - 1, 14 + U, -1);

  if (!fb.behind) {
    armB();
    drawBow(c, 'down', p, fa, fb);
  }
  if (!fa.behind) armA();
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) c.px(x, y, SKIN, sphere(0, -0.3), { bias: -1 });
    else {
      c.px(x, y, S.eye);
      if (S.storm) c.spark(x, y, BOLT_HOT, 0.5);
    }
  }
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const armA = () => arm(c, 7.4, 16.4 + U, fa, REACH_FRONT, [-0.5, 0.8], false, fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.6, 16.4 + U, fb, REACH_FRONT, [0.5, 0.8], true, fb.behind ? -1 : 0);
  if (fa.behind) armA();
  if (fb.behind) {
    armB();
    drawBow(c, 'up', p, fa, fb, -1);
  }

  leg(c, 10.2, 24.5 + L, 10, 28.4 - p.footB);
  leg(c, 13.8, 24.5 + L, 14, 28.4 - p.footA);
  boot(c, 10, 29.6 - p.footB);
  boot(c, 14, 29.6 - p.footA);

  // The tunic's skirt below the cloak.
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(waist - 1, 25 + L, (y) => {
    const hw = tunicWidth(y, top, waist, 4.4);
    return [cx - hw, cx + hw];
  }, S.tunic, (_x, _y, t) => sphere(t * 0.9, 0.25, 1));

  // The cloak down his back to the knees, swinging.
  const hem = 26 + L;
  c.part();
  c.shape(14 + U, hem, (y) => {
    const u = (y - 14 - U) / (hem - 14 - U);
    const hw = 4.6 + u * 1.4;
    const sw = u * p.sway;
    return [cx - hw + sw, cx + hw + sw];
  }, S.cloak, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
  for (let y = 18 + U; y <= hem; y++) {
    const u = (y - 14 - U) / (hem - 14 - U);
    c.shade(Math.round(cx - 2 + u * p.sway), y, -1);
    c.shade(Math.round(cx + 2 + u * p.sway), y, -1);
  }
  for (let x = cx - 7; x <= cx + 7; x++) {
    if (!c.filled(x, hem)) continue;
    if (S.trim) c.px(x, hem, S.trim, sphere(0, 0.4));
    else if ((x & 1) === 0) c.erase(x, hem);
  }

  // The quiver slung across the cloak, its mouth at his right shoulder.
  quiver(c, 16.2, 13.4 + U, 10.8, 22 + U);

  cowl(c, cx, U, 5.8, 5.8);
  // The back of the hood, drawn to a point.
  c.part();
  c.ellipse(cx, 11.4 + U, 3.9, 3.7, S.cloak, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  c.part();
  c.shape(14 + U, 17 + U, (y) => {
    const hw = 1.6 - (y - 14 - U) * 0.45;
    return hw < 0.3 ? null : [cx - hw, cx + hw];
  }, S.cloak, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
  c.shade(cx, 9 + U, 1);

  if (!fb.behind) {
    armB();
    drawBow(c, 'up', p, fa, fb);
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

  // The quiver on his back, fletchings over the shoulder.
  quiver(c, hx + 3.2, 12.6 + U, hx + 1.4, 21.4 + U, -1);
  // The cloak hanging behind him, streaming out as he goes.
  const top = 14 + U;
  const hem = 26 + L;
  c.part();
  c.shape(top, hem, (y) => {
    const u = (y - top) / (hem - top);
    return [hx + 0.6, hx + 3.6 + u * (1.4 + p.sway)];
  }, S.cloak, (_x, _y, t, u) => sphere(t * 0.9 + 0.1, u * 0.5 - 0.2, 1), { bias: -1 });
  if (S.trim) for (let y = top + 2; y <= hem; y++) {
    const u = (y - top) / (hem - top);
    c.px(Math.round(hx + 3.6 + u * (1.4 + p.sway)) - 1, y, S.trim, sphere(0.5, 0), { bias: -1 });
  }

  // Far arm behind everything; the bow it carries low goes behind him too.
  arm(c, hx + 1.2, 16.6 + U, fb, REACH_SIDE, [0.3, 1], true, -1);

  // Legs: back leg in shade first, then the front leg.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 0.8, 24.5 + L, cx + 1 - p.footB, 28.4 - lift(p.footB), -1);
  boot(c, cx + 0.4 - p.footB, 29.7 - lift(p.footB), true, -1);
  leg(c, cx - 0.6, 24.5 + L, cx - 0.4 - p.footA, 28.4 - lift(p.footA));
  boot(c, cx - 1.2 - p.footA, 29.7 - lift(p.footA), true);

  // The tunic in profile, the jerkin over it.
  const ttop = 15 + U;
  const waist = 22 + U;
  const skirt = 25 + L;
  c.part();
  c.shape(ttop, skirt, (y) => {
    const u = y <= waist ? 0 : (y - waist) / (skirt - waist);
    const shift = y <= waist ? hx : hx + (cx - hx) * u;
    const hw = tunicWidth(y, ttop, waist, 3.1);
    return [shift - hw - 0.2, shift + hw + 0.2];
  }, S.tunic, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - ttop) / (waist - ttop)) * 0.8 - 0.35 : 0.25, 1));
  c.part();
  c.shape(ttop + 1, waist - 1, (y) => {
    const hw = tunicWidth(y, ttop, waist, 3.1) - 0.2;
    return [hx - hw - 0.2, hx + hw];
  }, S.jerkin, (_x, y, t) => sphere(t * 0.9 - 0.1, ((y - ttop) / (waist - ttop)) * 0.8 - 0.3, 1));
  c.part();
  c.shape(waist, waist, () => [hx - 3.1, hx + 3.1], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(hx - 3.1), waist, S.metal, sphere(-0.5, -0.3));
  // The quiver strap down the chest.
  c.part();
  c.capsule(hx + 1.8, 15.2 + U, hx - 2.4, 21.6 + U, 0.55, 0.55, LEATHER);

  cowl(c, hx, U, 4.2, 4.4);

  // Head: the hood in profile, the face peeking out of it.
  c.part();
  c.ellipse(hx + 0.4, 11.4 + U, 3.4, 3.6, S.cloak, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
  c.part();
  // The hood's tail hanging down the back of the neck.
  c.capsule(hx + 2.8, 12.5 + U, hx + 3.6 + p.sway * 0.3, 15.2 + U, 1.1, 0.6, S.cloak);
  if (S.trim) {
    c.part();
    c.ellipse(hx - 1.3, 12.6 + U, 2.6, 2.5, S.trim);
  }
  c.part();
  c.ellipse(hx - 1.4, 12.8 + U, 2.2, 2.2, SKIN);
  c.part();
  c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
  c.shade(hx - 3, 14 + U, -1);
  // Hair spilling from the hood's edge over the brow and down behind the ear.
  c.part();
  c.shape(10 + U, 10 + U, () => [hx - 3.4, hx + 0.4], S.hair, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
  c.px(hx - 0.2, 11 + U, S.hair, sphere(0.3, 0.2));
  c.px(hx, 12 + U, S.hair, sphere(0.4, 0.4), { bias: -1 });
  c.part();
  // The hood's peak over the brow.
  c.shape(8 + U, 9 + U, (y) => [hx - 3.6 + (9 + U - y) * 0.8, hx + 3], S.cloak, (_x, _y, t, u) => sphere(t * 0.9, u - 0.7, 1));
  eyes(c, [[hx - 3, 12 + U]], p.blink);

  // The bow is held out ahead of him, raised or carried.
  drawBow(c, 'side', p, fa, fb);
  // Near shoulder and the draw arm.
  arm(c, hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.4, 1], false);
}

// ---------------------------------------------------------------------------
// Animations

/** The bow carried low at his side, the draw hand loose. */
const CARRY_A = H(0.8, 4.2, -3.4);
const CARRY_B = H(1.6, 4.6, -3.0);
/** From the side the bow hand rides a little ahead, so the bow shows in front of him. */
const CARRY_B_SIDE = H(3.2, 0, -2.6);

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: { ...CARRY_A },
  b: view === 'side' ? { ...CARRY_B_SIDE } : { ...CARRY_B },
  raised: false,
  nock: false,
  draw: 0,
  glint: 0,
  sway: 0,
});

/** Standing easy, the cloak stirring. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.b.h += Math.sin(ph) * 0.3;
    p.a.h += Math.sin(ph) * 0.4;
    p.sway = Math.sin(ph - 1) * 0.6;
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
      p.sway = 1 + Math.abs(s) * 0.9;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.8;
    }
    // The bow stays steady at his side; the free hand swings.
    p.b = view === 'side' ? H(3.2 - s * 0.4, 0, -2.6 + p.lift * 0.4) : H(1.6 - s * 0.5, 4.6, -3 + p.lift * 0.4);
    p.a = H(0.8 + s * 1.6, 4.2, -3.4 + p.lift * 0.4);
    frames.push(p);
  }
  return frames;
}

interface Key {
  a: Hand;
  b: Hand;
  /** Side-view hands, where the front pose doesn't carry over. */
  aSide?: Hand;
  bSide?: Hand;
  nock?: boolean;
  draw?: number;
  glint?: number;
  lean?: number;
  breath?: number;
  step?: number;
}

/** An action as keyframes, the bow raised throughout; anything left out stays at rest. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k) => {
      const p = base(view);
      p.a = { ...(view === 'side' && k.aSide ? k.aSide : k.a) };
      p.b = { ...(view === 'side' && k.bSide ? k.bSide : k.b) };
      p.raised = true;
      p.nock = k.nock ?? false;
      p.draw = k.draw ?? 0;
      p.glint = k.glint ?? 0;
      p.breath = k.breath ?? 0;
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

/** Bow arm straight out ahead. */
const AIM_B = H(5.5, 0.6, 2);
/** The shot: nock, draw to the jaw, loose, the hand flying back past the ear. */
const shoot = action([
  { a: H(4.2, 0.6, 1.8), b: AIM_B, nock: true, draw: 0.1, step: 1 },
  { a: H(1.8, 0.9, 2.6), b: AIM_B, nock: true, draw: 0.55, step: 1 },
  { a: H(-0.5, 1.2, 3.2), b: AIM_B, nock: true, draw: 1, step: 1, lean: -1 },
  { a: H(-2.2, 2.4, 3.8), b: H(6, 0.6, 2.2), step: 1, lean: 0 },
  { a: H(-1.2, 2.8, 1.5), b: H(5.2, 0.8, 1.2), step: 1 },
]);

/**
 * The volley: the bow raised to the sky, drawn slowly while the arrowhead
 * gathers light, loosed straight up; the rain comes down where he aimed.
 */
const SKY_B = H(1.8, 0.6, 12);
const SKY_B_SIDE = H(2.9, 0, 9.8);
const volley = action([
  { a: H(1.6, 0.8, 9), b: SKY_B, aSide: H(2, 0, 7), bSide: SKY_B_SIDE, nock: true, draw: 0.15, breath: 1 },
  { a: H(1.2, 0.9, 8), b: SKY_B, aSide: H(1, 0, 6.2), bSide: SKY_B_SIDE, nock: true, draw: 0.5, glint: 0.3 },
  { a: H(0.6, 1.0, 7.2), b: SKY_B, aSide: H(0, 0, 5.5), bSide: SKY_B_SIDE, nock: true, draw: 1, glint: 0.6, lean: -1 },
  { a: H(0.6, 1.0, 7.2), b: SKY_B, aSide: H(0, 0, 5.5), bSide: SKY_B_SIDE, nock: true, draw: 1, glint: 1, lean: -1 },
  { a: H(-0.4, 2.6, 8.4), b: H(1.8, 0.6, 12.6), aSide: H(-1.6, 0, 6.6), bSide: H(3, 0, 10.4), lean: -1 },
  { a: H(-0.2, 3.0, 5), b: H(2.4, 0.8, 9), aSide: H(-1, 0, 3.5), bSide: H(4, 0, 6), lean: 0 },
  { a: H(0.4, 3.6, 0), b: H(3.4, 1.4, 3), aSide: H(0, 0, 0), bSide: H(4.4, 0, 2.5) },
]);

// ---------------------------------------------------------------------------
// Frame generation

export type ArcherAnim = 'idle' | 'walk' | 'shoot' | 'volley';

export interface ArcherAnimDef {
  name: ArcherAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
}

export const ARCHER_ANIMS: ArcherAnimDef[] = [
  { name: 'idle', fps: 7, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'shoot', fps: 18, loop: false, poses: shoot },
  { name: 'volley', fps: 11, loop: false, poses: volley },
];

/** Frame index at which each shot is loosed. */
export const LOOSE_FRAME = { shoot: 3, volley: 4 } as const;

export interface ArcherFrame {
  key: string; // e.g. "walk_left_3"
  anim: ArcherAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawArcherFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(ARCHER_W, ARCHER_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildArcherFrames(look: ArcherLook = RANGER_LOOK): ArcherFrame[] {
  S = look;
  const out: ArcherFrame[] = [];
  for (const a of ARCHER_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawArcherFrame(dir, pose) });
      });
    }
  }
  S = RANGER_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Arrows in flight

/** Headings an arrow is drawn in: frame `r<i>` points i/ARROW_DIRS of a turn from screen right, clockwise. */
export const ARROW_DIRS = 16;
export const ARROW_SIZE = 15;

/** An arrow in flight along heading `i`: steel head, shaft, fletching. */
export function arrowFrame(i: number, look: ArcherLook = RANGER_LOOK): PixelCanvas {
  const c = new PixelCanvas(ARROW_SIZE, ARROW_SIZE);
  const a = (i / ARROW_DIRS) * Math.PI * 2;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const m = (ARROW_SIZE - 1) / 2 + 0.5;
  const px = (t: number, side = 0): [number, number] => [m + ux * t - uy * side, m + uy * t + ux * side];
  c.part();
  const [x0, y0] = px(-5.2);
  const [x1, y1] = px(4.2);
  c.line(x0, y0, x1, y1, look.shaft, () => sphere(-uy * 0.3, -0.4));
  c.part();
  for (const t of [-5, -3.8]) {
    for (const s of [-1, 1]) {
      const [fx, fy] = px(t - 0.4, s);
      c.px(fx, fy, look.fletch, sphere(-uy * s * 0.4, ux * s * 0.4 - 0.2));
    }
  }
  c.part();
  const [hx, hy] = px(5.6);
  const [bx, by] = px(4.6);
  c.px(bx, by, look.head, sphere(-0.3, -0.3));
  c.px(hx, hy, look.head, sphere(-0.5, -0.5), { bias: 1 });
  if (look.storm) {
    c.spark(hx, hy, BOLT_CORE, 0.8);
    const [sx, sy] = px(6.6);
    c.spark(sx, sy, BOLT_HOT, 0.5);
    const [fx, fy] = px(-4.6);
    c.spark(fx, fy, BOLT_MID, 0.4);
  }
  return c;
}

/** Stuck in the ground, the head buried: `k` 0 leans left, 1 stands straight, 2 leans right. Its foot is at the bottom centre. */
export function stuckArrowFrame(k: number, look: ArcherLook = RANGER_LOOK): PixelCanvas {
  const c = new PixelCanvas(ARROW_SIZE, ARROW_SIZE);
  const lean = (k - 1) * 0.45;
  const x0 = (ARROW_SIZE - 1) / 2 + 0.5;
  const y0 = ARROW_SIZE - 1.5;
  const len = 7;
  c.part();
  c.line(x0, y0, x0 + lean * len, y0 - len, look.shaft, () => sphere(-0.3, -0.3));
  c.part();
  for (const t of [len - 1.6, len - 0.4]) {
    const x = x0 + lean * t;
    const y = y0 - t;
    c.px(x - 1, y + 0.5, look.fletch, sphere(-0.5, 0));
    c.px(x + 1, y + 0.5, look.fletch, sphere(0.5, 0));
  }
  if (look.storm) c.spark(x0, y0, BOLT_HOT, 0.6);
  return c;
}

/** Stuck-arrow frame for a heading: leaning back the way it flew. */
export function stuckFrameFor(ux: number): number {
  return ux < -0.35 ? 2 : ux > 0.35 ? 0 : 1;
}
