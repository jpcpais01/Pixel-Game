// The fighter, drawn procedurally from a small rig like the Jedi.
//
// A bare-knuckle martial artist: a sleeveless off-white gi tied with a black
// belt, indigo trousers, taped feet and forearms, red gloves, and a red
// headband whose tails stream behind him as he moves.
//
// The body keeps to the 24x32 box; frames are larger so a straight punch can
// reach past it. Drawing functions work in body-box coordinates. Fists are
// posed in the fighter's own terms (forward, out to the side, height) and
// placed for each view, so one set of keyframes serves every direction.

import { PixelCanvas, cyl, sphere, type Material, type RGB, type Vec3 } from './pixel';
import {
  BLACK_BELT, BRONZE, CHI_CORE, CHI_HOT, CHI_MID, EYE, FIGHTER_HAIR, GI, GI_TROUSER, GLOVE, HEADBAND, MONK_BROW, MONK_ROBE, MONK_SASH,
  MONK_TROUSER, MONK_WRAP, PRAYER_BEAD, QI_CORE, QI_HOT, QI_MID, SKIN, WRAP,
} from './palette';
import { DIRS, type Dir } from './wizard';

export const FIGHTER_W = 48;
export const FIGHTER_H = 50;
export const BODY_X = 12;
export const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const FIGHTER_ORIGIN_X = BODY_X + 12;
export const FIGHTER_ORIGIN_Y = BODY_Y + 31;
/** The chest's height above the origin, where punches fly from. */
export const CHEST_Y = 12;

/** A fist, in the fighter's terms: `f` forward, `s` out to its own side, `h` up. */
export interface Fist {
  f: number;
  s: number;
  h: number;
}

export interface Pose {
  /** Whole body raised (bounce, walk passing frames). */
  lift: number;
  /** Upper body lowered (crouching into a blow). */
  breath: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** Lead fist (screen left from the front and back, the near arm from the side) and rear fist. */
  a: Fist;
  b: Fist;
  /** Headband tails: how far they swing out behind. */
  tails: number;
  /** 0..1 chi burning round the fists. */
  chi: number;
  blink?: boolean;
}

const F = (f: number, s: number, h: number): Fist => ({ f, s, h });

/** Guard: the lead fist forward at the chin, the rear one tucked by the cheek. */
const GUARD_A = F(2.2, 3.0, 1.0);
const GUARD_B = F(1.4, 3.3, 2.2);

const FLAT_DOWN: Vec3 = { x: 0, y: -0.3, z: 0.95 };

/**
 * One of the fighter's styles: what he wears and which moves he knows. The
 * brawler is the default; the iron monk is a heavier fighter with his own
 * palm strikes and leap (see Fighter.ts), drawn on the same rig.
 */
export interface FighterLook {
  /** Texture key and animation prefix, e.g. "fighter" or "fighter_monk". */
  key: string;
  /** Shaved head, prayer beads and a sash over the shoulder, in place of the spiky hair and headband. */
  monk?: boolean;
  gi: Material;
  trouser: Material;
  belt: Material;
  band: Material;
  /** The hand: a red glove on the brawler, a bare palm on the monk. */
  glove: Material;
  /** Forearm tape, or bracers. */
  wrap: Material;
  feet: Material;
  hair: Material;
  /** Light-only colours round the hands: core, hot, mid. */
  chi: RGB[];
  /** Hand size. */
  hand: number;
  anims: FighterAnimDef[];
}

/** The style being drawn (set per frame by drawFighterFrame). */
let LK: FighterLook;

type View = 'down' | 'up' | 'side';

/** The chest row in body coordinates, the height fists are posed from. */
const CH = 18;

interface Placed {
  x: number;
  y: number;
  scale: number;
  /** Drawn behind the body. */
  behind: boolean;
}

/** Where a fist lands on screen in each view. `hx` is the upper body's centre (side view). */
function place(view: View, arm: 'a' | 'b', q: Fist, U: number, hx: number): Placed {
  const side = arm === 'a' ? -1 : 1;
  if (view === 'down') {
    // Towards us: lower on screen and a little larger.
    return { x: 12 + side * q.s, y: CH + U - q.h + q.f * 0.7, scale: 1 + Math.max(0, q.f - 3) * 0.03, behind: q.f < -1 };
  }
  if (view === 'up') {
    // Away from us: higher on screen, and out past the head so it shows.
    // Out past the head when thrown, tucked in behind the shoulders on guard.
    const s = q.f > 4 ? Math.max(q.s, 4.6) : Math.min(q.s, 2.4);
    return { x: 12 + side * s, y: CH + U - q.h - q.f * 0.8, scale: 1 - Math.max(0, q.f - 3) * 0.02, behind: q.f > 1 };
  }
  // Facing left; the far arm sits a touch higher and behind the body.
  const far = arm === 'b';
  return { x: hx - 1.5 - q.f * 1.1 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), scale: 1, behind: far };
}

// ---------------------------------------------------------------------------
// Parts

/** A bare arm from the shoulder, bent at the elbow (towards `hint`), taped at the wrist, ending in a glove. */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], chi: number, bias = 0): void {
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
  c.capsule(sx, sy, ex, ey, 1.65, 1.35, SKIN, { bias });
  c.part();
  c.capsule(ex, ey, fx, fy, 1.4, 1.2, SKIN, { bias });
  c.part();
  const band = LK.monk ? 1.5 : 1.3;
  c.capsule(ex + (fx - ex) * 0.45, ey + (fy - ey) * 0.45, fx, fy, band, band, LK.wrap, { bias });
  c.part();
  c.ellipse(fx, fy, LK.hand * p.scale, LK.hand * 0.92 * p.scale, LK.glove, { bias });
  chiGlow(c, fx, fy, chi * (bias < 0 ? 0.6 : 1));
}

/** Chi flickering round a fist, in the emissive layer. */
function chiGlow(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k <= 0) return;
  const cols = LK.chi;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + x * 0.7;
    const r = 2.4 + (i % 3) * 0.6;
    c.spark(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.9, cols[1 + (i % 2)], k * (i % 2 ? 0.45 : 0.7));
  }
  c.spark(x, y, cols[0], k * 0.35);
}

function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  c.part();
  c.capsule(hx, hy, fx, fy, 1.8, 1.45, LK.trouser, { bias });
}

/** A taped foot. */
function foot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x, y, 2.2, 1.15, LK.feet, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.7, 1.2, LK.feet, { flatten: 0.8, bias });
}

/** Bare shoulder: the gi has no sleeves. The monk's sash covers one of his. */
function deltoid(c: PixelCanvas, x: number, y: number, rx = 2.1, m: Material = SKIN): void {
  c.part();
  c.ellipse(x, y, rx, 1.8, m, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 0.95) });
}

function tail(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  c.part();
  c.capsule(x0, y0, x1, y1, 0.75, 0.55, LK.band);
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    // Heavy brows over a hard stare.
    c.px(x, y - 1, LK.hair, FLAT_DOWN);
    if (blink) c.px(x, y, SKIN, FLAT_DOWN, { bias: -1 });
    else c.px(x, y, EYE);
  }
}

/** Spiky hair on top of the head: tufts along row `y0 - 1`, taller ones on row `y0 - 2`. */
function spikes(c: PixelCanvas, low: number[], high: number[], y0: number): void {
  c.part();
  for (const x of low) c.px(x, y0 - 1, LK.hair, sphere(0, -0.8));
  for (const x of high) c.px(x, y0 - 2, LK.hair, sphere(-0.2, -0.9), { bias: 1 });
}

/** The monk's string of prayer beads, and the bronze disc hanging from it. */
function beads(c: PixelCanvas, pts: [number, number][], pendant?: [number, number]): void {
  c.part();
  pts.forEach(([x, y], i) => c.px(x, y, PRAYER_BEAD, sphere(i % 2 ? 0.3 : -0.3, -0.6)));
  if (pendant) {
    c.part();
    c.px(pendant[0], pendant[1], BRONZE, sphere(-0.3, -0.5), { bias: 1 });
  }
}

/**
 * The monk's sash slung across the torso: a band whose centre runs from x0 at
 * the top row to x1 at the bottom, clipped to the body's edges.
 */
function sash(c: PixelCanvas, top: number, bottom: number, x0: number, x1: number, half: number, edges: (y: number) => [number, number]): void {
  c.part();
  c.shape(top, bottom, (y) => {
    const k = (y - top) / Math.max(1, bottom - top);
    const m = x0 + (x1 - x0) * k;
    const [el, er] = edges(y);
    const l = Math.max(el, m - half);
    const r = Math.min(er, m + half);
    return r - l < 0.5 ? null : [l, r];
  }, MONK_SASH, (_x, _y, t, u) => sphere(t * 0.7 - 0.1, (u - 0.4) * 0.9, 1));
}

// ---------------------------------------------------------------------------
// Directions

const REACH_FRONT = 4.6;
const REACH_SIDE = 5.4;

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  // A punching shoulder rolls in behind the fist.
  const shA = { x: 7.3 + (p.a.f > 6 ? 0.8 : 0), y: 16.6 + U };
  const shB = { x: 16.7 - (p.b.f > 6 ? 0.8 : 0), y: 16.6 + U };
  const armA = () => arm(c, shA.x, shA.y, fa, REACH_FRONT, [-0.3, 1], p.chi, fa.behind ? -1 : 0);
  const armB = () => arm(c, shB.x, shB.y, fb, REACH_FRONT, [0.3, 1], p.chi, fb.behind ? -1 : 0);

  // Headband tails, knotted behind the head, flying out past it.
  if (!LK.monk) {
    tail(c, 14.6, 10.2 + U, 17.4 + p.tails, 11.8 + U - p.tails * 0.4);
    tail(c, 14.6, 10.6 + U, 16.8 + p.tails * 0.6, 13.8 + U);
  }
  if (fa.behind) armA();
  if (fb.behind) armB();

  // Legs in a wide stance.
  leg(c, 10, 23.5 + L, 9.2, 28.2 - p.footA);
  leg(c, 14, 23.5 + L, 14.8, 28.2 - p.footB);
  foot(c, 9, 29.6 - p.footA);
  foot(c, 15, 29.6 - p.footB);
  c.part();
  c.shape(22 + U, 24 + L, () => [cx - 4.2, cx + 4.2], LK.trouser, (_x, _y, t) => cyl(t, 0.1));

  // The gi: broad through the chest, a V of skin at the neck, the flap crossing down to the belt.
  const top = 15 + U;
  const waist = 22 + U;
  const torso = (y: number): [number, number] => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 4.9 - 1.1 * u * u;
    return [cx - hw, cx + hw];
  };
  c.part();
  c.shape(top, waist - 1, torso, LK.gi, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  c.part();
  c.shape(top, top + 3, (y) => {
    const hw = 2.1 - (y - top) * 0.6;
    return hw < 0.4 ? null : [cx - hw, cx + hw];
  }, SKIN, (_x, _y, t, u) => sphere(t * 0.7, u * 0.5 - 0.2, 1));
  if (LK.monk) {
    // The sash from his left shoulder down across to the right hip, the beads over it.
    sash(c, top, waist - 1, 15.4, 8.8, 1.15, torso);
    beads(c, [[9, top], [9, top + 1], [10, top + 2], [11, top + 3], [12, top + 3], [13, top + 2], [14, top + 1], [14, top]], [12, top + 4]);
  } else {
    for (let y = top + 3; y < waist; y++) c.shade(Math.round(cx - 0.5 + (y - top - 3) * 0.45), y, -1);
  }
  // The jacket's skirt below the belt, split at the front.
  c.part();
  c.shape(waist + 1, waist + 2, () => [cx - 4.4, cx + 4.4], LK.gi, (_x, _y, t) => cyl(t, -0.1), { bias: -1 });
  c.shade(cx, waist + 1, -1);
  c.shade(cx, waist + 2, -1);
  // Black belt, knotted at the front, its ends hanging.
  c.part();
  c.shape(waist, waist, () => [cx - 4.2, cx + 4.2], LK.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx - 1, waist, LK.belt, sphere(-0.3, -0.3), { bias: 1 });
  c.px(cx, waist, LK.belt, sphere(0.2, -0.3), { bias: 1 });
  c.part();
  c.capsule(cx - 1, waist + 1, cx - 1.6 + p.tails * 0.25, waist + 3.2, 0.55, 0.5, LK.belt);
  c.capsule(cx + 0.4, waist + 1, cx + 0.9 + p.tails * 0.25, waist + 3.6, 0.55, 0.5, LK.belt);

  deltoid(c, 7.1, 16.8 + U);
  deltoid(c, 16.9, 16.8 + U, 2.1, LK.monk ? MONK_SASH : SKIN);

  // Head: a square jaw, spiky hair, the headband across the brow.
  c.part();
  c.ellipse(cx, 12.4 + U, 3.2, 2.95, SKIN);
  c.part();
  c.px(11, 13 + U, SKIN, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 13 + U, SKIN, sphere(0.35, -0.2));
  c.shade(11, 14 + U, -1);
  c.shade(12, 14 + U, -1);
  if (LK.monk) {
    // A shaved dome catching the light, and ears.
    c.part();
    const dome = [2.7, 3.5];
    c.shape(8 + U, 9 + U, (y) => [cx - dome[y - 8 - U], cx + dome[y - 8 - U]], SKIN, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.9, 1));
    c.shade(cx - 2, 9 + U, 1);
    c.part();
    c.px(8, 12 + U, SKIN, cyl(-0.8, 0));
    c.px(15, 12 + U, SKIN, cyl(0.8, 0));
  } else {
    c.part();
    const widths = [2.8, 3.7, 4.0];
    c.shape(7 + U, 9 + U, (y) => [cx - widths[y - 7 - U], cx + widths[y - 7 - U]], LK.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1));
    spikes(c, [9, 11, 12, 14], [10, 13], 7 + U);
    c.part();
    c.shape(10 + U, 10 + U, () => [cx - 3.6, cx + 3.6], LK.band, (_x, _y, t) => cyl(t, 0.2));
    c.part();
    c.px(8, 11 + U, LK.hair, cyl(-0.8, 0));
    c.px(15, 11 + U, LK.hair, cyl(0.8, 0));
  }
  eyes(c, [[10, 12 + U], [13, 12 + U]], p.blink);

  if (!fa.behind) armA();
  if (!fb.behind) armB();
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const shA = { x: 7.3 + (p.a.f > 6 ? 0.6 : 0), y: 16.6 + U };
  const shB = { x: 16.7 - (p.b.f > 6 ? 0.6 : 0), y: 16.6 + U };
  // Fists thrown ahead are beyond the body, so they go behind it.
  const armA = () => arm(c, shA.x, shA.y, fa, REACH_FRONT, [-0.5, 0.8], p.chi, fa.behind ? -1 : 0);
  const armB = () => arm(c, shB.x, shB.y, fb, REACH_FRONT, [0.5, 0.8], p.chi, fb.behind ? -1 : 0);
  if (fa.behind) armA();
  if (fb.behind) armB();

  leg(c, 10, 23.5 + L, 9.2, 28.2 - p.footB);
  leg(c, 14, 23.5 + L, 14.8, 28.2 - p.footA);
  foot(c, 9, 29.6 - p.footB);
  foot(c, 15, 29.6 - p.footA);
  c.part();
  c.shape(22 + U, 24 + L, () => [cx - 4.2, cx + 4.2], LK.trouser, (_x, _y, t) => cyl(t, 0.1));

  // The gi from behind, a crease down the spine.
  const top = 15 + U;
  const waist = 22 + U;
  const torso = (y: number): [number, number] => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 4.9 - 1.1 * u * u;
    return [cx - hw, cx + hw];
  };
  c.part();
  c.shape(top, waist - 1, torso, LK.gi, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  for (let y = top + 2; y < waist; y++) c.shade(cx, y, -1);
  // The sash across his back, from the left shoulder (screen left from behind) down to the right hip.
  if (LK.monk) sash(c, top, waist - 1, 8.6, 15.2, 1.15, torso);
  c.part();
  c.shape(waist + 1, waist + 2, () => [cx - 4.4, cx + 4.4], LK.gi, (_x, _y, t) => cyl(t, -0.1), { bias: -1 });
  c.part();
  c.shape(waist, waist, () => [cx - 4.2, cx + 4.2], LK.belt, (_x, _y, t) => cyl(t, 0));

  deltoid(c, 7.1, 16.8 + U, 2.1, LK.monk ? MONK_SASH : SKIN);
  deltoid(c, 16.9, 16.8 + U);
  if (!fa.behind) armA();
  if (!fb.behind) armB();

  if (LK.monk) {
    // The shaved back of the head, and the beads round the neck below it.
    beads(c, [[9, top], [10, top], [11, top], [13, top], [14, top], [15, top]]);
    c.part();
    c.ellipse(cx, 11.6 + U, 3.5, 3.4, SKIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
    c.shade(cx - 1, 9 + U, 1);
    c.part();
    c.px(8, 12 + U, SKIN, cyl(-0.8, 0));
    c.px(16, 12 + U, SKIN, cyl(0.8, 0));
    return;
  }

  // The back of the head, the headband round it, knotted with its tails hanging.
  c.part();
  c.ellipse(cx, 11.2 + U, 3.9, 3.8, LK.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
  c.shade(cx - 1, 8 + U, 1);
  spikes(c, [9, 11, 13, 15], [10, 14], 8 + U);
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 3.9, cx + 3.9], LK.band, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  c.px(cx, 10 + U, LK.band, sphere(0, -0.5), { bias: 1 });
  c.part();
  // The tails fly out beside the head rather than down its back, where they'd read as a face.
  c.capsule(cx - 3.6, 10.4 + U, cx - 5.2 - p.tails * 0.6, 11.6 + U + p.tails * 0.3, 0.55, 0.45, LK.band);
  c.capsule(cx + 3.6, 10.6 + U, cx + 5.0 + p.tails * 0.4, 12.2 + U, 0.55, 0.45, LK.band);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean; // upper body centre
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);

  // Far arm, behind everything.
  arm(c, hx + 1.4, 16.6 + U, fb, REACH_SIDE, [0.3, 1], p.chi, -1);

  // Headband tails streaming back.
  if (!LK.monk) {
    tail(c, hx + 3, 10.2 + U, hx + 6.6 + p.tails, 10.8 + U + (p.tails > 1 ? 0 : 1));
    tail(c, hx + 3, 10.6 + U, hx + 5.8 + p.tails * 0.8, 13 + U);
  }

  // Legs: back leg in shade first, then the front leg.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 1, 23.5 + L, cx + 1.3 - p.footB, 28.3 - lift(p.footB), -1);
  foot(c, cx + 0.6 - p.footB, 29.7 - lift(p.footB), true, -1);
  leg(c, cx - 0.3, 23.5 + L, cx - p.footA, 28.3 - lift(p.footA));
  foot(c, cx - 0.9 - p.footA, 29.7 - lift(p.footA), true);
  c.part();
  c.shape(22 + U, 24 + L, () => [cx - 2.8, cx + 3.0], LK.trouser, (_x, _y, t) => cyl(t * 0.9 - 0.1, 0.1));

  // The gi in profile, the chest pushing forward, skin at the collar.
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist - 1, (y) => [hx - 3.0 - (y >= top + 1 && y <= top + 3 ? 0.5 : 0), hx + 2.8], LK.gi, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, (u - 0.35) * 1.1, 1));
  c.part();
  c.shape(top, top + 1, (y) => [hx - 3.0, hx - 1.2 - (y - top)], SKIN, (_x, _y, t) => sphere(t * 0.6 - 0.4, -0.2, 1));
  if (LK.monk) {
    // The sash runs from the near shoulder back to the far hip; the beads hang at the collar.
    sash(c, top, waist - 1, hx + 0.2, hx + 1.8, 1.1, (y) => [hx - 3.0 - (y >= top + 1 && y <= top + 3 ? 0.5 : 0), hx + 2.8]);
    beads(c, [[hx - 1, top], [hx - 2, top + 1], [hx - 3, top + 2], [hx - 3, top + 3]], [hx - 3, top + 4]);
  }
  c.part();
  c.shape(waist + 1, waist + 2, () => [hx - 3.2, hx + 3.0], LK.gi, (_x, _y, t) => cyl(t * 0.9 - 0.1, -0.1), { bias: -1 });
  c.part();
  c.shape(waist, waist, () => [hx - 3.2, hx + 3.0], LK.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(hx - 3.2), waist, LK.belt, sphere(-0.4, -0.3), { bias: 1 });
  c.capsule(hx - 3.3, waist + 1, hx - 3.8 + p.tails * 0.4, waist + 3.4, 0.55, 0.5, LK.belt);

  // Head in profile.
  c.part();
  c.ellipse(hx - 1.1, 12.6 + U, 2.9, 2.8, SKIN);
  c.part();
  c.px(hx - 5, 13 + U, SKIN, sphere(-0.6, -0.2), { bias: 1 });
  c.shade(hx - 4, 14 + U, -1);
  if (LK.monk) {
    // A shaved crown and the back of the skull, an ear, heavy brows.
    c.part();
    const skull: [number, number][] = [
      [-3.0, 2.6],
      [-3.8, 3.1],
      [-4.0, 3.3],
      [0.0, 3.2],
      [0.4, 3.0],
      [0.8, 2.4],
    ];
    c.shape(8 + U, 13 + U, (y) => [hx + skull[y - 8 - U][0], hx + skull[y - 8 - U][1]], SKIN, (_x, _y, t, u) => sphere(t * 0.9, u * 1.3 - 0.8, 1));
    c.shade(Math.round(hx - 1), 9 + U, 1);
    c.part();
    c.px(hx + 1, 12 + U, SKIN, sphere(0.4, 0), { bias: 1 });
    c.shade(hx + 1, 13 + U, -1);
    eyes(c, [[hx - 3, 12 + U]], p.blink);
    deltoid(c, hx + 0.2, 17 + U, 1.9, MONK_SASH);
    arm(c, hx + 0.2, 17 + U, fa, REACH_SIDE, [0.3, 1], p.chi);
    return;
  }
  c.part();
  const rows: [number, number][] = [
    [-2.6, 2.4],
    [-3.6, 3.0],
    [-4.1, 3.3],
    [0, 0],
    [0.0, 3.2],
    [0.4, 3.0],
    [0.8, 2.4],
  ];
  c.shape(7 + U, 13 + U, (y) => {
    const [l, r] = rows[y - 7 - U];
    return l === r ? null : [hx + l, hx + r];
  }, LK.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.4 - 0.9, 1));
  spikes(c, [Math.round(hx - 2), Math.round(hx), Math.round(hx + 2)], [Math.round(hx + 1), Math.round(hx + 3)], 7 + U);
  c.px(hx + 3.5, 7 + U, LK.hair, sphere(0.4, -0.6));
  c.part();
  c.shape(10 + U, 10 + U, () => [hx - 4.1, hx + 3.3], LK.band, (_x, _y, t) => cyl(t * 0.9, 0.2));
  c.part();
  c.ellipse(hx + 3.2, 10.5 + U, 1.1, 1.0, LK.band);
  eyes(c, [[hx - 3, 12 + U]], p.blink);

  // Near shoulder and arm.
  deltoid(c, hx + 0.2, 17 + U, 1.9);
  arm(c, hx + 0.2, 17 + U, fa, REACH_SIDE, [0.3, 1], p.chi);
}

// ---------------------------------------------------------------------------
// Animations

type Guard = [Fist, Fist];
const BRAWL_GUARD: Guard = [GUARD_A, GUARD_B];
/** The monk's stance: the lead palm open and low in front, the other upright at his chest. */
const MONK_GUARD: Guard = [F(4, 2.0, 0.6), F(0.8, 1.2, 2.6)];

const base = (view: View, guard: Guard = BRAWL_GUARD): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: { ...guard[0] },
  b: { ...guard[1] },
  tails: 0,
  chi: 0,
});

/** Bouncing on his toes, guard up. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.lift = Math.sin(ph) > 0.2 ? 1 : 0;
    const bob = Math.sin(ph + 0.9) * 0.6;
    p.a.h += bob;
    p.b.h += bob * 0.7;
    p.a.f += Math.sin(ph) * 0.4;
    p.tails = Math.sin(ph - 1) * 0.8;
    p.blink = f === 4;
    frames.push(p);
  }
  return frames;
}

const walk = (view: View): Pose[] => walkIn(view, BRAWL_GUARD);

function walkIn(view: View, guard: Guard): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view, guard);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0;
    p.tails = 1 + Math.cos(ph * 2) * 0.6;
    if (view === 'side') {
      p.footA = Math.round(s * 2.4);
      p.footB = -p.footA;
      p.lean = 1;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
    }
    // The guard shuffles with his steps.
    p.a.f += s * 0.6;
    p.b.f -= s * 0.6;
    p.a.h += p.lift * 0.5;
    p.b.h += p.lift * 0.5;
    frames.push(p);
  }
  return frames;
}

interface Key {
  a?: Fist;
  b?: Fist;
  lean?: number;
  breath?: number;
  lift?: number;
  step?: number;
  chi?: number;
  /** Both feet drawn up off the ground (the monk's leap). */
  tuck?: number;
}

/** A blow as keyframes; anything left out stays at the guard. `step` plants the front foot forward. */
function blow(keys: Key[], guard: Guard = BRAWL_GUARD) {
  return (view: View): Pose[] =>
    keys.map((k, i) => {
      const p = base(view, guard);
      if (k.a) p.a = { ...k.a };
      if (k.b) p.b = { ...k.b };
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
      p.chi = k.chi ?? 0;
      const step = k.step ?? 0;
      if (view === 'side') {
        p.lean = k.lean ?? 0;
        p.footA = 1 + step;
        p.footB = -1 - Math.round(step * 0.5);
      } else {
        p.footA = step > 0 ? 1 : 0;
      }
      if (k.tuck) {
        p.footA = view === 'side' ? 1 + k.tuck : k.tuck;
        p.footB = view === 'side' ? k.tuck - 1 : k.tuck;
      }
      // The tails whip back as he throws his weight.
      p.tails = 0.4 + Math.max(0, k.lean ?? 0) * 0.5 + (i % 2) * 0.4;
      return p;
    });
}

const jab = blow([
  { a: F(0.6, 3.2, 1.2) },
  { a: F(9, 1.2, 1.6), b: F(1.0, 3.3, 2.4), lean: 1, step: 1 },
  { a: F(8.4, 1.3, 1.5), b: F(1.0, 3.3, 2.4), lean: 1, step: 1 },
  { a: F(3.5, 2.8, 1.2), step: 1 },
]);

const cross = blow([
  { b: F(0.2, 3.6, 1.8), a: F(2.6, 2.8, 1.2) },
  { b: F(10, 0.6, 1.8), a: F(0.8, 3.4, 1.8), lean: 2, step: 2 },
  { b: F(9.4, 0.8, 1.7), a: F(0.8, 3.4, 1.8), lean: 2, step: 2 },
  { b: F(4, 2.6, 1.8), lean: 1, step: 1 },
]);

const hook = blow([
  { a: F(1.5, 6.5, 1.2), lean: -1 },
  { a: F(7.5, 2.5, 1.6), lean: 1, step: 1 },
  { a: F(5.5, -2.5, 1.6), b: F(1.2, 3.4, 2.4), lean: 1, step: 1 },
  { a: F(2.5, 1.5, 1.2), step: 1 },
]);

const upper = blow([
  { b: F(1.5, 2.5, -3.5), breath: 2 },
  { b: F(5, 1, 5), lift: 1, lean: 1, step: 1 },
  { b: F(4, 1, 8.5), lift: 1, lean: 1, step: 1 },
  { b: F(2.5, 2.8, 2.5), step: 1 },
]);

/** The finisher: wound all the way back, then an explosive straight with his whole body behind it. */
const smash = blow([
  { a: F(-2, 4, 1.5), b: F(3, 2, 2), lean: -1, breath: 1, chi: 0.5 },
  { a: F(-3, 4.5, 1.8), b: F(3, 2, 2), lean: -1, breath: 1, chi: 0.8 },
  { a: F(12, 0.5, 1.6), b: F(0.6, 3.4, 2), lean: 3, step: 2, chi: 1 },
  { a: F(11.5, 0.6, 1.6), b: F(0.6, 3.4, 2), lean: 3, step: 2, chi: 0.6 },
  { a: F(4, 2.6, 1.2), lean: 1, step: 1, chi: 0.2 },
]);

/** The special: fists hammering out in turn, a blur of straight punches. */
function barrage(view: View): Pose[] {
  const keys: [Fist, Fist][] = [
    [F(10, 1.5, 1.6), F(1.5, 3.2, 2)],
    [F(3, 2.8, 1.2), F(10, 0.5, 2.6)],
    [F(10, 0.4, 2.8), F(2, 3.2, 1.6)],
    [F(2, 3.0, 1.4), F(10, 1.8, 1.0)],
  ];
  return blow(keys.map(([a, b]) => ({ a, b, lean: 1, step: 2, chi: 0.8 })))(view).map((p, i) => {
    p.breath = i % 2;
    p.tails = 1.2 + (i % 2) * 0.5;
    return p;
  });
}

// ---------------------------------------------------------------------------
// The iron monk's moves

/** Standing still and rooted, breathing slowly. */
function monkIdle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view, MONK_GUARD);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.a.h += Math.sin(ph + 0.6) * 0.4;
    p.b.f += Math.sin(ph) * 0.3;
    p.blink = f === 3;
    frames.push(p);
  }
  return frames;
}

const monkWalk = (view: View): Pose[] => walkIn(view, MONK_GUARD);

/** Lead palm: a short, heavy heel-of-the-hand strike. */
const palm = blow(
  [
    { a: F(1.5, 2.6, 1.2), breath: 1 },
    { a: F(9.5, 0.8, 1.8), b: F(0.6, 1.2, 2.6), lean: 1, step: 1, chi: 0.5 },
    { a: F(9, 0.9, 1.7), lean: 1, step: 1, chi: 0.3 },
    { a: F(5, 1.8, 1), step: 1 },
  ],
  MONK_GUARD,
);

/** Rear palm, the hips turning behind it. */
const palm2 = blow(
  [
    { b: F(-0.5, 3.2, 2), a: F(3, 2.2, 0.8), lean: -1 },
    { b: F(10, 0.4, 2.2), a: F(0.6, 2.8, 1.4), lean: 2, step: 2, chi: 0.5 },
    { b: F(9.4, 0.5, 2.1), a: F(0.6, 2.8, 1.4), lean: 2, step: 2, chi: 0.3 },
    { b: F(3, 1.5, 2.2), lean: 1, step: 1 },
  ],
  MONK_GUARD,
);

/** The finisher: both hands drawn in to the chest, then driven out together in a wall of force. */
const thrust = blow(
  [
    { a: F(-1, 3.2, 1.2), b: F(-1, 3.2, 2.2), breath: 1, lean: -1, chi: 0.6 },
    { a: F(-1.5, 3.4, 1.2), b: F(-1.5, 3.4, 2.2), breath: 2, lean: -1, chi: 0.9 },
    { a: F(11, 1.8, 1.2), b: F(11, 1.8, 2.6), lean: 3, step: 2, chi: 1 },
    { a: F(10.5, 1.9, 1.2), b: F(10.5, 1.9, 2.6), lean: 3, step: 2, chi: 0.7 },
    { a: F(4, 2, 1), b: F(2, 1.5, 2.2), lean: 1, step: 1, chi: 0.2 },
  ],
  MONK_GUARD,
);

/**
 * The special: he crouches, springs up with his palms joined overhead, and
 * comes down driving both of them into the earth. Fighter.ts carries him
 * through the air between the spring and the landing.
 */
const leap = blow(
  [
    { a: F(0, 4, -2.5), b: F(0, 4, -2.5), breath: 2, chi: 0.3 },
    { a: F(1, 2.6, 10), b: F(1, 2.6, 10), lift: 1, tuck: 1, chi: 0.5 },
    { a: F(0.5, 1.6, 13), b: F(0.5, 1.6, 13), lift: 2, tuck: 2, chi: 0.8 },
    { a: F(0.5, 1.6, 13), b: F(0.5, 1.6, 13), lift: 2, tuck: 2, chi: 1 },
    { a: F(4, 1.4, 4), b: F(4, 1.4, 4), lift: 1, tuck: 1, chi: 1 },
    { a: F(6, 2.4, -5), b: F(6, 2.4, -5), breath: 3, lean: 2, step: 1, chi: 1 },
    { a: F(5, 2.4, -4), b: F(5, 2.4, -4), breath: 2, lean: 1, step: 1, chi: 0.6 },
    { a: F(3, 2.2, 0), breath: 1, chi: 0.2 },
  ],
  MONK_GUARD,
);

/** Screen angle (0 = right, 90 = down) he faces in each direction. */
export const FACING_DEG: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

// ---------------------------------------------------------------------------
// Frame generation

export type FighterAnim = 'idle' | 'walk' | 'jab' | 'cross' | 'hook' | 'upper' | 'smash' | 'barrage' | 'palm' | 'palm2' | 'thrust' | 'leap';

export interface FighterAnimDef {
  name: FighterAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
}

export const FIGHTER_ANIMS: FighterAnimDef[] = [
  { name: 'idle', fps: 8, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'jab', fps: 24, loop: false, poses: jab },
  { name: 'cross', fps: 22, loop: false, poses: cross },
  { name: 'hook', fps: 22, loop: false, poses: hook },
  { name: 'upper', fps: 20, loop: false, poses: upper },
  { name: 'smash', fps: 16, loop: false, poses: smash },
  { name: 'barrage', fps: 24, loop: true, poses: barrage },
];

export const MONK_ANIMS: FighterAnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: monkIdle },
  { name: 'walk', fps: 9, loop: true, poses: monkWalk },
  { name: 'palm', fps: 16, loop: false, poses: palm },
  { name: 'palm2', fps: 16, loop: false, poses: palm2 },
  { name: 'thrust', fps: 13, loop: false, poses: thrust },
  { name: 'leap', fps: 12, loop: false, poses: leap },
];

/** Frame index at which each blow lands (the leap: where he meets the ground). */
export const HIT_FRAME: Partial<Record<FighterAnim, number>> = { jab: 1, cross: 1, hook: 1, upper: 1, smash: 2, palm: 1, palm2: 1, thrust: 2, leap: 5 };
/** The leap's frames in the air: from the spring (frame 1) to the landing. */
export const LEAP_AIR = { from: 1, to: 5, fps: 12 } as const;

/** The brawler: gi, black belt, red gloves and headband. */
export const BRAWLER_LOOK: FighterLook = {
  key: 'fighter',
  gi: GI,
  trouser: GI_TROUSER,
  belt: BLACK_BELT,
  band: HEADBAND,
  glove: GLOVE,
  wrap: WRAP,
  feet: WRAP,
  hair: FIGHTER_HAIR,
  chi: [CHI_CORE, CHI_HOT, CHI_MID],
  hand: 1.9,
  anims: FIGHTER_ANIMS,
};

/** The iron monk: saffron robe and crimson sash, bronze bracers, bare palms of golden qi. */
export const MONK_LOOK: FighterLook = {
  key: 'fighter_monk',
  monk: true,
  gi: MONK_ROBE,
  trouser: MONK_TROUSER,
  belt: MONK_SASH,
  band: MONK_SASH,
  glove: SKIN,
  wrap: BRONZE,
  feet: MONK_WRAP,
  hair: MONK_BROW,
  chi: [QI_CORE, QI_HOT, QI_MID],
  hand: 1.7,
  anims: MONK_ANIMS,
};

export const FIGHTER_LOOKS = [BRAWLER_LOOK, MONK_LOOK];

export interface FighterFrame {
  key: string; // e.g. "walk_left_3"
  anim: FighterAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFighterFrame(look: FighterLook, dir: Dir, pose: Pose): PixelCanvas {
  LK = look;
  const c = new PixelCanvas(FIGHTER_W, FIGHTER_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildFighterFrames(look: FighterLook = BRAWLER_LOOK): FighterFrame[] {
  const out: FighterFrame[] = [];
  for (const a of look.anims) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawFighterFrame(look, dir, pose) });
      });
    }
  }
  return out;
}
