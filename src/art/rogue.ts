// The rogue, drawn procedurally from a small rig like the archer's.
//
// A cutpurse of the back alleys: a charcoal hood and a short mantle, a
// crimson scarf pulled up over the nose with its tails hanging behind, a dark
// leather vest over a slate shirt, a crimson sash knotted at the hip, belts
// with a pouch, wrapped trousers and soft boots. A dagger in each gloved hand,
// held reverse-grip at rest and turned point-first to strike.
//
// The body keeps to the 24x32 box inside a larger frame. Hands are posed in
// the rogue's own terms (forward, out to the side, height) and each dagger
// points along a direction in the same terms, so one set of keyframes aims
// the blades right in every view.
//
// The shadow dancer is his other look on the same rig: a midnight-violet hood,
// a pale porcelain mask with eyes lit violet, a silver sash, long scarf tails,
// and blades of living shadow that glow.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { BLADE, BOOT, CRIMSON, EYE, GOLD, SKIN, STEEL } from './palette';
import { DIRS, type Dir } from './wizard';

export const ROGUE_W = 48;
export const ROGUE_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const ROGUE_ORIGIN_X = BODY_X + 12;
export const ROGUE_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet the blades strike at. */
export const ROGUE_CHEST_Y = 13;

// ---------------------------------------------------------------------------
// Materials

const INK = hex('#0b0910');
const ramp = (...c: string[]): RGB[] => c.map(hex);

const HOOD: Material = { ramp: ramp('#110f18', '#1d1a27', '#2b2738', '#3d374d', '#554d66'), outline: INK, outlineLit: hex('#1e1a2a') };
const SHIRT: Material = { ramp: ramp('#16161f', '#24242f', '#343443', '#474759'), outline: INK };
const VEST: Material = { ramp: ramp('#1c110e', '#311f18', '#4a2e22', '#654030', '#80553d'), outline: INK };
const WRAPS: Material = { ramp: ramp('#15141b', '#221f29', '#322e3a', '#44404c'), outline: INK };
const GLOVE: Material = { ramp: ramp('#150e11', '#26191c', '#382628', '#4e3634'), outline: INK };
const HILT: Material = { ramp: ramp('#1a1012', '#2c1c1c', '#40292a', '#583a36'), outline: INK };

const DANCER_HOOD: Material = { ramp: ramp('#0f0a1e', '#1a1236', '#281c52', '#3a2a72', '#503c94'), outline: hex('#07040f'), outlineLit: hex('#1a1034') };
const DANCER_SHIRT: Material = { ramp: ramp('#110d1c', '#1c162c', '#2a2240', '#3a3056'), outline: hex('#07040f') };
const DANCER_VEST: Material = { ramp: ramp('#120c1e', '#1e1432', '#2c1e48', '#3e2b62', '#553c80'), outline: hex('#07040f') };
const DANCER_SCARF: Material = { ramp: ramp('#240c3e', '#3e1664', '#5e2490', '#8238bc', '#a85ce0'), outline: hex('#0c0418'), outlineLit: hex('#220a3a') };
const DANCER_SASH: Material = { ramp: ramp('#2e2c44', '#4a4866', '#6e6c8e', '#9a98b8', '#c8c6e0'), outline: hex('#12101e'), shine: true };
const MASK: Material = { ramp: ramp('#5a5670', '#8e8ca6', '#c4c4d8', '#e8e8f4', '#ffffff'), outline: hex('#15121f'), outlineLit: hex('#2a2640') };
const SHADOW_BLADE: Material = {
  ramp: ramp('#3a1a80', '#6a3ad0', '#a47cff', '#dccaff', '#f8f2ff'),
  outline: hex('#0e0620'),
  emissive: 0.7,
  shine: true,
  noAO: true,
};
const DANCER_HILT: Material = { ramp: ramp('#0e0a18', '#1a1428', '#2a2240', '#3c3258'), outline: hex('#07040f') };

/** One look for the rogue: its texture key, its cloth and its blades. */
export interface RogueLook {
  key: string;
  hood: Material;
  shirt: Material;
  vest: Material;
  scarf: Material;
  sash: Material;
  blade: Material;
  hilt: Material;
  /** The guard and the buckles. */
  metal: Material;
  /** A silver half-mask across the eyes, above the scarf. */
  mask: boolean;
  /** How long the scarf's tails hang, in pixels. */
  tails: number;
  /** Eyes lit from within, and light along the edges of the blades. */
  lit?: RGB;
}

export const ROGUE_LOOK: RogueLook = {
  key: 'rogue',
  hood: HOOD,
  shirt: SHIRT,
  vest: VEST,
  scarf: CRIMSON,
  sash: CRIMSON,
  blade: BLADE,
  hilt: HILT,
  metal: STEEL,
  mask: false,
  tails: 5,
};

export const DANCER_LOOK: RogueLook = {
  key: 'rogue_dancer',
  hood: DANCER_HOOD,
  shirt: DANCER_SHIRT,
  vest: DANCER_VEST,
  scarf: DANCER_SCARF,
  sash: DANCER_SASH,
  blade: SHADOW_BLADE,
  hilt: DANCER_HILT,
  metal: GOLD,
  mask: true,
  tails: 8,
  lit: hex('#c49cff'),
};

export const ROGUE_LOOKS = [ROGUE_LOOK, DANCER_LOOK];

/** The look being drawn; set by buildRogueFrames. */
let S: RogueLook = ROGUE_LOOK;

// ---------------------------------------------------------------------------
// Rig

/** A point in the rogue's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

export interface Pose {
  /** Whole body raised (walk passing frames); negative crouches. */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The hands (screen left from the front and back, the near arm from the side), and where each blade points. */
  a: Hand;
  b: Hand;
  da: Hand;
  db: Hand;
  /** Scarf tails streaming back, 0 hanging .. 1 flying. */
  stream: number;
  /** Tails swinging to one side (front and back views). */
  sway: number;
  /** 0..1 light running along the blades (the dancer's, or a strike's gleam). */
  gleam: number;
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

/** Where a point in the rogue's terms lands on screen in each view. `hx` is the upper body's centre (side view). */
function place(view: View, arm: 'a' | 'b', q: Hand, U: number, hx: number): Placed {
  const side = arm === 'a' ? -1 : 1;
  if (view === 'down') return { x: 12 + side * q.s, y: CH + U - q.h + q.f * 0.7, behind: q.f < -1 };
  if (view === 'up') return { x: 12 + side * q.s, y: CH + U - q.h - q.f * 0.8, behind: q.f > 1 };
  // Facing left; the far arm sits a touch higher and behind the body.
  const far = arm === 'b';
  return { x: hx - 1 - q.f * 1.05 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), behind: far };
}

/** The blade's tip on screen: the hand pushed along the blade's direction, never shorter than a stub. */
function bladeTip(view: View, arm: 'a' | 'b', hand: Hand, d: Hand, U: number, hx: number, at: Placed): [number, number] {
  const len = 4.6;
  const t = place(view, arm, H(hand.f + d.f * len, hand.s + d.s * len, hand.h + d.h * len), U, hx);
  let vx = t.x - at.x;
  let vy = t.y - at.y;
  const l = Math.hypot(vx, vy);
  // Seen end-on a blade still shows a little of itself.
  if (l < 2) {
    const k = l < 0.01 ? 0 : 2 / l;
    vx = l < 0.01 ? 0 : vx * k;
    vy = l < 0.01 ? 2 : vy * k;
  }
  return [at.x + vx, at.y + vy];
}

/** A dagger in the hand at `p`, its point at (tx, ty): a pommel behind the fist, a small guard, the blade. */
function dagger(c: PixelCanvas, p: Placed, tx: number, ty: number, gleam: number, bias = 0): void {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  // Pommel peeking out behind the fist.
  c.part();
  c.px(p.x - ux * 1.6, p.y - uy * 1.6, S.hilt, sphere(-0.3, -0.3), { bias });
  // The guard, across the blade at the fist.
  c.part();
  const gx = p.x + ux * 1.1;
  const gy = p.y + uy * 1.1;
  c.px(gx - uy, gy + ux, S.metal, sphere(-0.4, -0.4), { bias });
  c.px(gx + uy, gy - ux, S.metal, sphere(0.4, 0.2), { bias });
  // The blade, a lit edge and a darker back.
  c.part();
  const glow = S.lit ? { glow: 0.55 + gleam * 0.4, bias } : { bias };
  c.line(gx + ux * 0.9, gy + uy * 0.9, tx, ty, S.blade, (i, n) => sphere(-0.35, -0.4 + (i / Math.max(1, n)) * 0.2), glow);
  if (S.lit) {
    const [r, g, b] = S.lit;
    c.spark(tx, ty, [r, g, b], 0.5 + gleam * 0.5);
    if (gleam > 0.3) c.spark(tx + ux, ty + uy, [r, g, b], gleam * 0.5);
  } else if (gleam > 0) {
    // A glint running to the point.
    c.spark(tx - ux, ty - uy, [255, 255, 255], 0.6 * gleam);
    c.spark(tx, ty, [255, 250, 236], gleam);
  }
}

// ---------------------------------------------------------------------------
// Parts

/** A sleeved arm from the shoulder, bent at the elbow (towards `hint`), a wrapped forearm and a gloved fist. */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bias = 0): void {
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
  c.capsule(sx, sy, ex, ey, 1.45, 1.25, S.shirt, { bias });
  c.part();
  c.capsule(ex, ey, fx, fy, 1.25, 1.1, WRAPS, { bias });
  c.part();
  c.ellipse(fx, fy, 1.15, 1.1, GLOVE, { bias });
}

function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  c.part();
  c.capsule(hx, hy, fx, fy, 1.55, 1.25, WRAPS, { bias });
  // Bindings round the shin.
  const y = Math.round(hy + (fy - hy) * 0.72);
  const x = hx + (fx - hx) * 0.72;
  c.shade(x - 1, y, -1);
  c.shade(x, y, -1);
}

/** A soft boot, laced up the ankle. */
function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x - 0.3, y, 2.2, 1.15, BOOT, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.55, 1.25, BOOT, { flatten: 0.8, bias });
  c.part();
  c.shape(Math.round(y - 2.2), Math.round(y - 1.4), () => [x - 1.3, x + 1.3], BOOT, (_x, _y, t) => cyl(t, 0.2), { bias: bias + 1 });
}

/** The hood's short mantle over the shoulders. */
function mantle(c: PixelCanvas, cx: number, U: number, l: number, r: number): void {
  const top = 14 + U;
  c.part();
  c.shape(top, top + 2, (y) => {
    const u = (y - top) / 2;
    const k = Math.sqrt(u) * 0.7 + 0.3;
    return [cx - l * k, cx + r * k];
  }, S.hood, (_x, _y, t, u) => sphere(t * 0.95, u - 0.6, 1));
  // A ragged, notched hem.
  const y = top + 2;
  for (let x = Math.floor(cx - l); x <= Math.ceil(cx + r); x++) if (c.filled(x, y) && (x & 1) === 1) c.shade(x, y, -1);
}

/**
 * The scarf's two tails from the knot at the nape (x, y): hanging, swinging
 * to one side, or streaming back (`dir` -1/1) as he runs. Length from the look.
 */
function tails(c: PixelCanvas, x: number, y: number, dir: number, stream: number, sway: number, bias = 0): void {
  const n = S.tails;
  for (const [k, off] of [[0, 0], [1, 1.2]] as const) {
    c.part();
    let px = x + off * dir * 0.4;
    let py = y + off * 0.4;
    for (let i = 0; i < n + (k === 0 ? 0 : -1); i++) {
      const u = (i + 1) / n;
      // Hanging drops straight down; streaming lifts the tail out behind, rippling.
      const nx = px + dir * stream * (0.9 + off * 0.05) + sway * 0.25 * u + Math.sin(i * 1.7 + off * 2) * 0.35 * stream;
      const ny = py + (1 - stream) * 0.95 + stream * (0.25 + off * 0.12) + Math.cos(i * 1.3) * 0.2 * stream;
      c.capsule(px, py, nx, ny, 0.75 - u * 0.2, 0.7 - u * 0.25, S.scarf, { bias: bias + (k ? -1 : 0) });
      px = nx;
      py = ny;
    }
  }
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) c.px(x, y, S.mask ? MASK : SKIN, sphere(0, -0.3), { bias: -1 });
    else if (S.lit) {
      c.px(x, y, EYE);
      c.spark(x, y, S.lit, 0.9);
    } else c.px(x, y, EYE);
  }
}

// ---------------------------------------------------------------------------
// Directions

const REACH_FRONT = 4.3;
const REACH_SIDE = 5.1;

/** The torso's outline: broad at the chest, narrowing to the belt. */
function torsoWidth(y: number, top: number, waist: number, chest: number): number {
  const u = Math.max(0, (y + 0.5 - top) / (waist - top));
  return chest - 0.8 * u * u;
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const [tax, tay] = bladeTip('down', 'a', p.a, p.da, U, cx, fa);
  const [tbx, tby] = bladeTip('down', 'b', p.b, p.db, U, cx, fb);
  // A blade pointing up past the fist is behind the arm; otherwise in front of it.
  const armA = (bias: number) => {
    if (tay < fa.y - 1) dagger(c, fa, tax, tay, p.gleam, bias);
    arm(c, 7.6, 16.4 + U, fa, REACH_FRONT, [-0.35, 1], bias);
    if (tay >= fa.y - 1) dagger(c, fa, tax, tay, p.gleam, bias);
  };
  const armB = (bias: number) => {
    if (tby < fb.y - 1) dagger(c, fb, tbx, tby, p.gleam, bias);
    arm(c, 16.4, 16.4 + U, fb, REACH_FRONT, [0.35, 1], bias);
    if (tby >= fb.y - 1) dagger(c, fb, tbx, tby, p.gleam, bias);
  };

  // The scarf's tails, flicking out past his shoulder.
  tails(c, cx + 2.5, 13.5 + U, 1, Math.max(0.35, p.stream), p.sway, -1);
  if (fa.behind) armA(-1);
  if (fb.behind) armB(-1);

  leg(c, 10.3, 22.5 + L, 10 - p.footA * 0.2, 28.4 - p.footA);
  leg(c, 13.7, 22.5 + L, 14 + p.footB * 0.2, 28.4 - p.footB);
  boot(c, 10, 29.6 - p.footA);
  boot(c, 14, 29.6 - p.footB);

  // Shirt, then the vest over it, open at the front in a narrow V.
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist + 1, (y) => {
    const hw = torsoWidth(y, top, waist, 4.2);
    return [cx - hw, cx + hw];
  }, S.shirt, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.8 - 0.35, 1));
  c.part();
  c.shape(top, waist + 1, (y) => {
    const hw = torsoWidth(y, top, waist, 4.2) + 0.1;
    return [cx - hw, cx + hw];
  }, S.vest, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.8 - 0.3, 1));
  for (let y = top; y <= waist - 2; y++) {
    const v = Math.max(0, 1.4 - (y - top) * 0.28);
    for (let x = Math.round(cx - v); x < Math.round(cx + v); x++) c.erase(x, y);
  }
  for (let y = top + 3; y <= waist + 1; y++) c.shade(cx, y, -1);
  // The sash, knotted at his left hip, a short tail hanging from the knot.
  c.part();
  c.shape(waist, waist + 1, () => [cx - 4.1, cx + 4.1], S.sash, (_x, y, t) => cyl(t, y === waist ? 0.3 : -0.2));
  c.part();
  c.ellipse(cx + 2.6, waist + 0.6, 1.1, 1, S.sash);
  c.capsule(cx + 2.8, waist + 1.5, cx + 3.2 + p.sway * 0.2, waist + 4, 0.8, 0.55, S.sash);
  // A belt slung from the right shoulder to the left hip, a pouch on it.
  c.part();
  c.capsule(8.4, 15.6 + U, 15, 21.2 + U, 0.5, 0.5, HILT);
  c.part();
  c.ellipse(9, 22.6 + U, 1.2, 1, S.hilt);
  c.px(9, 22 + U, S.metal, sphere(-0.3, -0.5));

  mantle(c, cx, U, 5.4, 5.4);

  // Head: the hood, the face in its shadow, the scarf pulled up over the nose (or the mask).
  c.part();
  c.ellipse(cx, 11.3 + U, 3.9, 3.7, S.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  // The hood's peak.
  c.px(cx - 1, 7 + U, S.hood, sphere(-0.3, -0.8));
  c.px(cx, 7 + U, S.hood, sphere(0.1, -0.8));
  c.part();
  c.ellipse(cx, 12.7 + U, 2.5, 2.3, SKIN);
  // The hood's brim low over the brow, only the eyes showing under it.
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 2.6, cx + 2.6], S.hood, (_x, _y, t) => sphere(t * 0.8, -0.5, 1));
  for (let x = cx - 2; x <= cx + 1; x++) c.shade(x, 11 + U, -1);
  c.part();
  c.shape(13 + U, 15 + U, (y) => {
    const hw = y === 15 + U ? 2.3 : 2.7;
    return [cx - hw, cx + hw];
  }, S.scarf, (_x, y, t) => sphere(t * 0.9, (y - 13 - U) * 0.35 - 0.2, 1));
  c.shade(cx - 1, 14 + U, -1);
  if (S.mask) {
    // A silver half-mask across the eyes, swept up at the temples.
    c.part();
    c.shape(11 + U, 12 + U, (y) => (y === 11 + U ? [cx - 3.2, cx + 3.2] : [cx - 2.8, cx + 2.8]), MASK, (_x, y, t) => sphere(t * 0.9, y === 11 + U ? 0.4 : -0.1, 1));
  }
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);

  if (!fb.behind) armB(0);
  if (!fa.behind) armA(0);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const [tax, tay] = bladeTip('up', 'a', p.a, p.da, U, cx, fa);
  const [tbx, tby] = bladeTip('up', 'b', p.b, p.db, U, cx, fb);
  const armA = (bias: number) => {
    dagger(c, fa, tax, tay, p.gleam, bias);
    arm(c, 7.6, 16.4 + U, fa, REACH_FRONT, [-0.35, 0.8], bias);
  };
  const armB = (bias: number) => {
    dagger(c, fb, tbx, tby, p.gleam, bias);
    arm(c, 16.4, 16.4 + U, fb, REACH_FRONT, [0.35, 0.8], bias);
  };
  if (fa.behind) armA(-1);
  if (fb.behind) armB(-1);

  leg(c, 10.3, 22.5 + L, 10, 28.4 - p.footB);
  leg(c, 13.7, 22.5 + L, 14, 28.4 - p.footA);
  boot(c, 10, 29.6 - p.footB);
  boot(c, 14, 29.6 - p.footA);

  // The vest's back, the sash round it, the knot's tail at his left hip.
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist + 1, (y) => {
    const hw = torsoWidth(y, top, waist, 4.2) + 0.1;
    return [cx - hw, cx + hw];
  }, S.vest, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.8 - 0.3, 1));
  for (let y = top + 2; y <= waist; y++) c.shade(cx, y, -1);
  c.part();
  c.shape(waist, waist + 1, () => [cx - 4.1, cx + 4.1], S.sash, (_x, y, t) => cyl(t, y === waist ? 0.3 : -0.2));
  c.part();
  c.capsule(cx - 2.8, waist + 1.5, cx - 3.2 + p.sway * 0.2, waist + 4, 0.8, 0.55, S.sash);
  // The belt across his back.
  c.part();
  c.capsule(15.6, 15.6 + U, 9, 21.2 + U, 0.5, 0.5, HILT);

  mantle(c, cx, U, 5.4, 5.4);
  // The back of the hood, drawn to a point.
  c.part();
  c.ellipse(cx, 11.4 + U, 3.9, 3.7, S.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  c.part();
  c.shape(14 + U, 16 + U, (y) => {
    const hw = 1.4 - (y - 14 - U) * 0.5;
    return hw < 0.3 ? null : [cx - hw, cx + hw];
  }, S.hood, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
  c.shade(cx, 9 + U, 1);
  // The scarf knotted at the nape, its tails down his back.
  c.part();
  c.ellipse(cx, 14.2 + U, 1.3, 0.9, S.scarf);
  tails(c, cx - 0.4, 14.6 + U, p.sway >= 0 ? 1 : -1, p.stream * 0.3, p.sway);

  if (!fb.behind) armB(0);
  if (!fa.behind) armA(0);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean; // upper body centre
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);
  const [tax, tay] = bladeTip('side', 'a', p.a, p.da, U, hx, fa);
  const [tbx, tby] = bladeTip('side', 'b', p.b, p.db, U, hx, fb);

  // The scarf's tails behind his head, streaming as he runs.
  tails(c, hx + 2.6, 13.4 + U, 1, p.stream, 0, -1);

  // Far arm and its dagger behind everything.
  dagger(c, fb, tbx, tby, p.gleam, -1);
  arm(c, hx + 1.2, 16.6 + U, fb, REACH_SIDE, [0.3, 1], -1);

  // Legs: back leg in shade first, then the front leg.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 0.8, 22.5 + L, cx + 1 - p.footB, 28.4 - lift(p.footB), -1);
  boot(c, cx + 0.4 - p.footB, 29.7 - lift(p.footB), true, -1);
  leg(c, cx - 0.6, 22.5 + L, cx - 0.4 - p.footA, 28.4 - lift(p.footA));
  boot(c, cx - 1.2 - p.footA, 29.7 - lift(p.footA), true);

  // The torso in profile: shirt, vest, the sash with its tail behind.
  const ttop = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(ttop, waist + 1, (y) => {
    const u = y <= waist ? 0 : 1;
    const shift = hx + (cx - hx) * u * 0.5;
    const hw = torsoWidth(y, ttop, waist, 3);
    return [shift - hw - 0.2, shift + hw + 0.2];
  }, S.vest, (_x, y, t) => sphere(t * 0.9 - 0.1, ((y - ttop) / (waist - ttop)) * 0.8 - 0.3, 1));
  c.part();
  // The shirt showing at the vest's open front.
  c.shape(ttop + 1, waist - 2, () => [hx - 3.2, hx - 2.2], S.shirt, () => sphere(-0.6, 0, 1));
  c.part();
  c.shape(waist, waist + 1, () => [hx - 3.2, hx + 3.2], S.sash, (_x, y, t) => cyl(t, y === waist ? 0.3 : -0.2));
  c.part();
  c.capsule(hx + 2.8, waist + 1, hx + 3.8 + p.stream * 1.6, waist + 3.6 - p.stream * 1.2, 0.8, 0.55, S.sash);
  // The belt down the chest.
  c.part();
  c.capsule(hx + 1.8, 15.4 + U, hx - 2.3, 21.4 + U, 0.5, 0.5, HILT);

  mantle(c, hx, U, 4, 4.2);

  // Head: the hood in profile, the face peeking out, the scarf over the nose.
  c.part();
  c.ellipse(hx + 0.4, 11.4 + U, 3.4, 3.6, S.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
  c.part();
  c.ellipse(hx - 1.4, 12.8 + U, 2.2, 2.2, SKIN);
  c.part();
  c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
  c.part();
  c.shape(13 + U, 15 + U, (y) => [hx - 4.1 + (y === 13 + U ? 0 : 0.3), hx + 0.6], S.scarf, (_x, y, t) => sphere(t * 0.9, (y - 13 - U) * 0.35 - 0.2, 1));
  if (S.mask) {
    c.part();
    c.shape(11 + U, 12 + U, (y) => [hx - 4.2, hx + (y === 11 + U ? 0.8 : 0.2)], MASK, (_x, y, t) => sphere(t * 0.9 - 0.2, y === 11 + U ? 0.4 : -0.1, 1));
  }
  c.part();
  // The hood's peak over the brow.
  c.shape(8 + U, 9 + U, (y) => [hx - 3.6 + (9 + U - y) * 0.8, hx + 3], S.hood, (_x, _y, t, u) => sphere(t * 0.9, u - 0.7, 1));
  c.shade(hx - 3, 10 + U, -1);
  c.shade(hx - 2, 10 + U, -1);
  eyes(c, [[hx - 3, 12 + U]], p.blink);

  // Near shoulder, the near arm and its dagger (behind the fist when it points back past him).
  const back = tax > fa.x + 1;
  if (back) dagger(c, fa, tax, tay, p.gleam);
  arm(c, hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.4, 1]);
  if (!back) dagger(c, fa, tax, tay, p.gleam);
}

// ---------------------------------------------------------------------------
// Animations

/** At rest: fists low by the hips, the blades turned down and out, ready. */
const REST_A = H(1.4, 3.6, -3.4);
const REST_B = H(1.4, 3.6, -3.4);
const REST_D = H(0.5, 0.45, -0.75);
/** From the side the far hand rides a little ahead, so its blade shows. */
const REST_B_SIDE = H(2.2, 0, -2.4);

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: { ...REST_A },
  b: view === 'side' ? { ...REST_B_SIDE } : { ...REST_B },
  da: { ...REST_D },
  db: { ...REST_D },
  stream: 0,
  sway: 0,
  gleam: 0,
});

/** Standing light on his feet, weight shifting, blades turning idly. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.a.h += Math.sin(ph) * 0.4;
    p.b.h += Math.sin(ph + 1) * 0.4;
    p.sway = Math.sin(ph - 1) * 0.8;
    p.blink = f === 4;
    if (f === 2) p.gleam = 0.6;
    frames.push(p);
  }
  return frames;
}

/** A quick, low prowl. */
function walk(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0;
    p.breath = 1;
    p.stream = 0.5;
    if (view === 'side') {
      p.footA = Math.round(s * 2.4);
      p.footB = -p.footA;
      p.lean = 1;
      p.stream = 0.7 + Math.abs(s) * 0.2;
      p.a = H(1.2 - s * 1.8, 4.2, -2.6 + p.lift * 0.4);
      p.b = H(2.2 + s * 1.2, 0, -2.2 + p.lift * 0.4);
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 1.2;
      p.a = H(0.6 + s * 1.4, 4.2, -3 + p.lift * 0.4);
      p.b = H(0.6 - s * 1.4, 4.2, -3 + p.lift * 0.4);
    }
    frames.push(p);
  }
  return frames;
}

interface Key {
  a: Hand;
  b: Hand;
  da: Hand;
  db: Hand;
  /** Side-view hands, where the front pose doesn't carry over. */
  aSide?: Hand;
  bSide?: Hand;
  lean?: number;
  breath?: number;
  lift?: number;
  step?: number;
  stream?: number;
  gleam?: number;
}

/** An action as keyframes; anything left out stays at rest. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k) => {
      const p = base(view);
      p.a = { ...(view === 'side' && k.aSide ? k.aSide : k.a) };
      p.b = { ...(view === 'side' && k.bSide ? k.bSide : k.b) };
      p.da = { ...k.da };
      p.db = { ...k.db };
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
      p.gleam = k.gleam ?? 0;
      p.stream = k.stream ?? 0.3;
      const step = k.step ?? 0;
      if (view === 'side') {
        p.lean = k.lean ?? 0;
        p.footA = 1 + step;
        p.footB = -1 - Math.round(step * 0.6);
      } else {
        p.footA = step > 0 ? 1 : 0;
        p.sway = (k.lean ?? 0) * -0.5;
      }
      return p;
    });
}

/** Point-first, straight ahead. */
const FWD = H(1, 0, 0.1);
/** Point up and out, drawn back over the shoulder for a cut. */
const RAISED = H(-0.3, 0.3, 1);

/** The first stab: the near hand drawn back, then driven straight in, the blade turned point-first. */
const stab1 = action([
  { a: H(-0.6, 3.4, 0.6), b: REST_B, da: H(0.6, 0, 0.6), db: REST_D, bSide: REST_B_SIDE, breath: 1, lean: -1 },
  { a: H(6.2, 1.2, 1.2), b: H(0.2, 4.2, -2.4), da: FWD, db: REST_D, bSide: H(1.4, 0, -2), step: 2, lean: 2, gleam: 1, stream: 0.8 },
  { a: H(5.6, 1.4, 1), b: H(0.2, 4.2, -2.4), da: FWD, db: REST_D, bSide: H(1.4, 0, -2), step: 2, lean: 2, gleam: 0.4, stream: 0.6 },
  { a: H(2.2, 3.4, -1.6), b: REST_B, da: H(0.2, 0.3, -0.8), db: REST_D, bSide: REST_B_SIDE, step: 1, lean: 1 },
]);

/** The second stab from the other hand, a half step deeper. */
const stab2 = action([
  { a: H(1.6, 4, -1.6), b: H(-0.6, 3.4, 0.6), da: REST_D, db: H(0.6, 0, 0.6), aSide: H(1.8, 0, -1.4), bSide: H(-0.4, 0, 0.8), breath: 1, lean: -1 },
  { a: H(0.6, 4.2, -2.4), b: H(6.4, 1.2, 1.4), da: REST_D, db: FWD, aSide: H(0.4, 0, -2), bSide: H(6.4, 0, 1.6), step: 2, lean: 2, gleam: 1, stream: 0.8 },
  { a: H(0.6, 4.2, -2.4), b: H(5.8, 1.4, 1.1), da: REST_D, db: FWD, aSide: H(0.4, 0, -2), bSide: H(5.8, 0, 1.4), step: 2, lean: 2, gleam: 0.4, stream: 0.6 },
  { a: REST_A, b: H(2.2, 3.4, -1.6), da: REST_D, db: H(0.2, 0.3, -0.8), bSide: H(2.4, 0, -1.8), step: 1, lean: 1 },
]);

/**
 * The finisher: both blades raised high at the shoulders, torn down across
 * each other in an X, flung wide, and brought home.
 */
const cross = action([
  { a: H(0.6, 3.2, 4.2), b: H(0.6, 3.2, 4.2), da: RAISED, db: RAISED, aSide: H(0.6, 0, 5.6), bSide: H(1.6, 0, 5), lift: 1, lean: -1, stream: 0.2 },
  { a: H(1.4, 3.6, 5), b: H(1.4, 3.6, 5), da: H(0.2, 0.5, 1), db: H(0.2, 0.5, 1), aSide: H(1, 0, 6.2), bSide: H(2, 0, 5.6), lift: 1, lean: -1, gleam: 0.6, stream: 0.2 },
  { a: H(5.2, -1.2, 0.4), b: H(5.2, -1.2, 0.4), da: H(0.6, -0.8, -0.6), db: H(0.6, -0.8, -0.6), aSide: H(6, 0, 0.2), bSide: H(5, 0, -1.2), step: 2, lean: 2, breath: 2, gleam: 1, stream: 0.9 },
  { a: H(3.6, 4.8, -2), b: H(3.6, 4.8, -2), da: H(0.4, 1, -0.3), db: H(0.4, 1, -0.3), aSide: H(4.4, 0, -2), bSide: H(2.6, 0, -3), step: 2, lean: 2, breath: 2, gleam: 0.5, stream: 0.7 },
  { a: H(1.6, 3.8, -3), b: H(1.6, 3.8, -3), da: REST_D, db: REST_D, aSide: H(1.6, 0, -2.6), bSide: REST_B_SIDE, step: 1, lean: 1, breath: 1 },
]);

/** The shadowstep: a crouch, then a low dart, blades swept back, the scarf flying. */
const dash = action([
  { a: H(1.4, 3, -1.6), b: H(1.4, 3, -1.6), da: FWD, db: FWD, aSide: H(2, 0, -1), bSide: H(2.8, 0, -1.4), breath: 2, lift: -1, lean: 1, stream: 0.6 },
  { a: H(-1.4, 3.4, -2.2), b: H(-1.4, 3.4, -2.2), da: H(-0.6, 0.6, -0.6), db: H(-0.6, 0.6, -0.6), aSide: H(-3, 0, -1), bSide: H(-2, 0, -1.6), breath: 2, lean: 3, step: 2, stream: 1, gleam: 0.5 },
  { a: H(-1.8, 3.6, -2), b: H(-1.8, 3.6, -2), da: H(-0.6, 0.6, -0.5), db: H(-0.6, 0.6, -0.5), aSide: H(-3.4, 0, -0.6), bSide: H(-2.4, 0, -1.2), breath: 2, lean: 3, step: 3, stream: 1, gleam: 0.8 },
]);

// ---------------------------------------------------------------------------
// Frame generation

export type RogueAnim = 'idle' | 'walk' | 'stab1' | 'stab2' | 'cross' | 'dash';

export interface RogueAnimDef {
  name: RogueAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
}

export const ROGUE_ANIMS: RogueAnimDef[] = [
  { name: 'idle', fps: 7, loop: true, poses: idle },
  { name: 'walk', fps: 12, loop: true, poses: walk },
  { name: 'stab1', fps: 20, loop: false, poses: stab1 },
  { name: 'stab2', fps: 20, loop: false, poses: stab2 },
  { name: 'cross', fps: 15, loop: false, poses: cross },
  { name: 'dash', fps: 14, loop: true, poses: dash },
];

/** Frame index at which each strike lands. */
export const STRIKE_FRAME = { stab1: 1, stab2: 1, cross: 2 } as const;

export interface RogueFrame {
  key: string; // e.g. "walk_left_3"
  anim: RogueAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawRogueFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(ROGUE_W, ROGUE_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildRogueFrames(look: RogueLook = ROGUE_LOOK): RogueFrame[] {
  S = look;
  const out: RogueFrame[] = [];
  for (const a of ROGUE_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawRogueFrame(dir, pose) });
      });
    }
  }
  S = ROGUE_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Icons and smoke

/** The colours of a rogue's icons: the blades, their hilts, and the smoke or shadow of the special. */
export interface DaggerColors {
  blade: [string, string, string];
  hilt: [string, string];
  guard: string;
  /** Smoke (or shadow) from light to dark, and the glint or glow. */
  smoke: [string, string, string];
  glint: string;
  ink: string;
}

export const ROGUE_DAGGERS: DaggerColors = {
  blade: ['#f4f8ff', '#cbd7ec', '#6f7fa0'],
  hilt: ['#583a36', '#2c1c1c'],
  guard: '#8f9db8',
  smoke: ['#9a98ac', '#5e5c72', '#34323f'],
  glint: '#ff6a5a',
  ink: '#0b0910',
};

export const DANCER_DAGGERS: DaggerColors = {
  blade: ['#f8f2ff', '#c4a4ff', '#6a3ad0'],
  hilt: ['#3c3258', '#1a1428'],
  guard: '#f4cf6a',
  smoke: ['#a47cff', '#5a34a8', '#2a1658'],
  glint: '#e8d8ff',
  ink: '#07040f',
};

function painter(): { px: Uint8ClampedArray; put: (x: number, y: number, c: string) => void; outline: (c: string) => void } {
  const N = 16;
  const px = new Uint8ClampedArray(N * N * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * N + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  const outline = (c: string) => {
    const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && px[(y * N + x) * 4 + 3] === 255;
    const out: [number, number][] = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!filled(x, y) && (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1))) out.push([x, y]);
    for (const [x, y] of out) put(x, y, c);
  };
  return { px, put, outline };
}

/** One dagger for an icon, hilt at (x, y), pointing along (ux, uy) (a diagonal). */
function iconDagger(put: (x: number, y: number, c: string) => void, k: DaggerColors, x: number, y: number, ux: number, uy: number, len: number): void {
  // Hilt and pommel.
  put(x - ux, y - uy, k.hilt[1]);
  put(x, y, k.hilt[0]);
  put(x + ux, y + uy, k.hilt[1]);
  // The guard, square across the blade.
  put(x + ux * 2 - uy, y + uy * 2 + ux, k.guard);
  put(x + ux * 2, y + uy * 2, k.guard);
  put(x + ux * 2 + uy, y + uy * 2 - ux, k.guard);
  // The blade: a lit edge beside a darker spine, narrowing to the point.
  for (let i = 3; i < 3 + len; i++) {
    const bx = x + ux * i;
    const by = y + uy * i;
    put(bx, by, k.blade[i === 2 + len ? 0 : 1]);
    if (i < 1 + len) put(bx + (uy === ux ? -1 : 0), by + (uy === ux ? 0 : 1), k.blade[2]);
  }
}

/** 16x16 icon for the attack: two daggers crossed point-up, a glint at the crossing. */
export function daggersIcon(k: DaggerColors = ROGUE_DAGGERS): Uint8ClampedArray {
  const { px, put, outline } = painter();
  iconDagger(put, k, 3, 13, 1, -1, 8);
  iconDagger(put, k, 12, 13, -1, -1, 8);
  outline(k.ink);
  put(7, 7, k.glint);
  put(8, 7, k.glint);
  put(7, 6, '#ffffff');
  return px;
}

/** 16x16 icon for the special: a puff of smoke, a dagger darting out of it and a streak behind. */
export function shadowstepIcon(k: DaggerColors = ROGUE_DAGGERS, dance = false): Uint8ClampedArray {
  const { px, put, outline } = painter();
  // The cloud: three lumps, lit from the upper left.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const lumps = [[5, 10, 3.6], [8.5, 8.5, 3.2], [3.5, 7, 2.4]] as const;
      let inside = false;
      let lit = 0;
      for (const [cx, cy, r] of lumps) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r) {
          inside = true;
          lit = Math.max(lit, (cx - (x + 0.5) + cy - (y + 0.5)) / r);
        }
      }
      if (inside) put(x, y, lit > 0.45 ? k.smoke[0] : lit > -0.4 ? k.smoke[1] : k.smoke[2]);
    }
  }
  outline(k.ink);
  // The dagger leaping out to the upper right.
  iconDagger(put, k, 8, 7, 1, -1, 5);
  // Speed lines.
  for (const [x, y] of [[12, 9], [13, 8], [11, 11], [12, 10]] as const) put(x, y, k.smoke[1]);
  if (dance) {
    // The dancer's echo: a second, ghostly blade.
    for (let i = 0; i < 4; i++) put(2 + i, 4 - Math.floor(i / 2), k.blade[2]);
  }
  put(14, 1, k.glint);
  return px;
}

/** A soft puff of smoke for the shadowstep, `size` px square: grey, lighter on top, dithered at the edge. */
export function smokeCanvas(size: number, tone: [number, number, number][]): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  const m = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - m) / m;
      const dy = (y + 0.5 - m) / m;
      // Three overlapping lumps make it cloudy rather than round.
      const d = Math.min(Math.hypot(dx + 0.25, dy + 0.1) / 0.72, Math.hypot(dx - 0.28, dy + 0.05) / 0.7, Math.hypot(dx, dy - 0.3) / 0.62, Math.hypot(dx * 0.9, dy + 0.35) / 0.55);
      if (d > 1) continue;
      // Ragged at the edge: every other pixel of the outer ring.
      if (d > 0.82 && (x + y) % 2 === 0) continue;
      const lit = -dy * 0.6 - dx * 0.3;
      const c = lit > 0.25 ? tone[0] : lit > -0.2 ? tone[1] : tone[2];
      const i = (y * size + x) * 4;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    }
  }
  return px;
}
