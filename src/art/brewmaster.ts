// The Brewmaster, drawn procedurally from a small rig like the engineer's.
//
// A stout, broad dwarf of a brewer-alchemist: wide and low, a great red
// beard forked at the end over a leather apron, a rolled-sleeve linen shirt,
// a moss-green knit cap, and on his back a copper pot still with a swan-neck
// pipe, a pressure gauge and a little fire glowing in its box. A
// cork-stoppered clay jug hangs at his hip, and he swings a big wooden mash
// paddle with holes in its blade.
//
// The Mead Jarl is his other look: a northern mead-brewer with a braided
// blond beard, a plain iron cap, a wolf-fur mantle, a blue tunic, leather
// bracers, an oak cask of honey mead banded in gold on his back and a
// drinking horn at his hip.
//
// The body keeps to the 24x32 box (drawn in body coordinates, BODY_X/BODY_Y
// into a larger frame so the paddle can swing out past it). Hands are posed in
// the rig's own terms (forward, out to the side, height) and placed for each
// view, so one set of keyframes serves every direction. The keg his Special
// bowls is drawn here too, rolling, at every heading.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { BOOT, EYE, GOLD, LEATHER } from './palette';
import { BRASS, STEEL } from './inventor';
import { DIRS, type Dir } from './wizard';
import { iconPainter } from './effects';

export const BREW_W = 48;
export const BREW_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const BREW_ORIGIN_X = BODY_X + 12;
export const BREW_ORIGIN_Y = BODY_Y + 31;
/** The mouth's height above the feet, where his fire leaves him. */
export const BREW_MOUTH_Y = 16;
/** The paces of the idle moment and of the moves. */
const REST_FPS = 8;
export const BREW_FPS = { swing: 12, swing2: 12, slam: 12, breath: 10, heave: 9 } as const;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#140c0a');

// ---------------------------------------------------------------------------
// Materials

const ROSY: Material = { ramp: ramp('#6a3226', '#a8583e', '#d88a64', '#f4b48c', '#ffd8b8'), outline: hex('#2a120c'), outlineLit: hex('#48201a') };
const CHEEK: Material = { ramp: ramp('#7a2a22', '#b84a3a', '#e4705a', '#f8987c'), outline: hex('#2a120c') };
const RED_BEARD: Material = { ramp: ramp('#3e1206', '#6e240c', '#a43e16', '#d06226', '#ee8a40', '#ffb46a'), outline: hex('#1e0804'), outlineLit: hex('#34120a') };
const LINEN: Material = { ramp: ramp('#6a5a44', '#9c8a6c', '#c8b896', '#e6dabc', '#faf2dc'), outline: hex('#2a2218'), outlineLit: hex('#40362a') };
const APRON: Material = { ramp: ramp('#28140a', '#462612', '#6a3c1e', '#8e562e', '#b07444'), outline: hex('#120804'), outlineLit: hex('#22100a') };
const WOOL: Material = { ramp: ramp('#18200e', '#2a3818', '#3e5424', '#587234', '#78924a'), outline: hex('#0a0e06'), outlineLit: hex('#162010') };
const BREECH: Material = { ramp: ramp('#1c140e', '#30241a', '#463628', '#5e4a38'), outline: INK };
const COPPER: Material = { ramp: ramp('#3a1408', '#6a2a10', '#a24c1c', '#d47a34', '#f4ae6a', '#fff0c8'), outline: hex('#1a0804'), outlineLit: hex('#2e1008'), shine: true };
const CLAY: Material = { ramp: ramp('#3a2214', '#62391e', '#94592e', '#c0824a', '#e0ac74'), outline: hex('#180c06'), outlineLit: hex('#2c180c') };
const GLAZE: Material = { ramp: ramp('#2a3426', '#465a3e', '#6a8a5a', '#98b884'), outline: hex('#101810'), shine: true };
const CORK: Material = { ramp: ramp('#5a3a1e', '#8a5e34', '#b88a54', '#dcb47e'), outline: hex('#20140a') };
const OAK: Material = { ramp: ramp('#2e1a0c', '#4e2e16', '#764a24', '#9c6a38', '#c4925a'), outline: hex('#140a04'), outlineLit: hex('#26140a') };
const PADDLE: Material = { ramp: ramp('#3a2410', '#5e3c1c', '#88602e', '#b28a4a', '#d8b47a'), outline: hex('#180e06'), outlineLit: hex('#2c1a0c') };
const FIREBOX: Material = { ramp: ramp('#8a2a08', '#e06418', '#ffb040', '#fff0a0'), outline: hex('#2a0a02'), emissive: 0.9, noAO: true };
const GAUGE: Material = { ramp: ramp('#8a9a8a', '#c8d8c4', '#f0fff0'), outline: hex('#1a2018'), emissive: 0.25, noAO: true };
const FOAM: Material = { ramp: ramp('#a89a7a', '#d8ccae', '#f4eedc', '#fffcf2'), outline: hex('#5a4a30'), noAO: true };

// The Mead Jarl's.
const NORD_SKIN: Material = { ramp: ramp('#6a3a30', '#a86650', '#d89c7c', '#f2c2a2', '#ffe2cc'), outline: hex('#2a140e'), outlineLit: hex('#48241c') };
const BLOND: Material = { ramp: ramp('#5a3a0e', '#8e6418', '#c49432', '#e8c45e', '#fae69a', '#fffadc'), outline: hex('#2a1806'), outlineLit: hex('#40280c') };
const TUNIC: Material = { ramp: ramp('#0c1630', '#16264e', '#22407a', '#3462a8', '#5486cc'), outline: hex('#060a18'), outlineLit: hex('#0e1630') };
const FUR: Material = { ramp: ramp('#241e18', '#3e352c', '#5e5242', '#82745e', '#a89a80', '#cec2a8'), outline: hex('#100c08'), outlineLit: hex('#1e1812') };
const IRON: Material = { ramp: ramp('#1e2028', '#363a46', '#585e6e', '#848c9c', '#b8c0cc', '#eef2f8'), outline: hex('#0a0b10'), shine: true };
const HONEY_OAK: Material = { ramp: ramp('#3a200a', '#5e3812', '#8a5620', '#b47c34', '#d8a456'), outline: hex('#180c04'), outlineLit: hex('#2a1608') };
const HORN: Material = { ramp: ramp('#3a2a1a', '#6a5236', '#a08460', '#cab48a', '#ece0bc'), outline: hex('#1a120a'), shine: true };
const BRACER: Material = { ramp: ramp('#1e100a', '#3a2214', '#5a3820', '#7c5232'), outline: INK };
const MEAD: Material = { ramp: ramp('#8a5a0e', '#d0921e', '#f4c444', '#fff0a0'), outline: hex('#3a2206'), emissive: 0.35, noAO: true };
const HONEY_FOAM: Material = { ramp: ramp('#a8904e', '#dcc48a', '#f6e8bc', '#fffaea'), outline: hex('#5a4418'), noAO: true };

// ---------------------------------------------------------------------------
// Looks

export interface BrewLook {
  key: string;
  skin: Material;
  beard: Material;
  cap: Material;
  /** The sleeves (the shirt, or the Jarl's tunic). */
  shirt: Material;
  apron: Material;
  trouser: Material;
  /** What he carries on his back: the copper still, or the oak cask. */
  still: Material;
  /** Its fittings and hoops, and the buckle. */
  band: Material;
  /** The jug at his hip, or the drinking horn. */
  jug: Material;
  /** The foam his brew throws up, and the froth on top of it. */
  foam: Material;
  froth: [RGB, RGB, RGB];
  /** His fire: core, hot, mid. */
  flame: [RGB, RGB, RGB];
  /** The Mead Jarl: iron cap, braided beard, fur mantle, cask and horn. */
  jarl: boolean;
}

export const BREW_LOOK: BrewLook = {
  key: 'brewmaster',
  skin: ROSY,
  beard: RED_BEARD,
  cap: WOOL,
  shirt: LINEN,
  apron: APRON,
  trouser: BREECH,
  still: COPPER,
  band: BRASS,
  jug: CLAY,
  foam: FOAM,
  froth: [hex('#fffdf4'), hex('#fff0c8'), hex('#f0c878')],
  flame: [hex('#fff8e0'), hex('#ffc848'), hex('#ff7a1a')],
  jarl: false,
};

export const JARL_LOOK: BrewLook = {
  key: 'brewmaster_jarl',
  skin: NORD_SKIN,
  beard: BLOND,
  cap: IRON,
  shirt: TUNIC,
  apron: APRON,
  trouser: BREECH,
  still: HONEY_OAK,
  band: GOLD,
  jug: HORN,
  foam: HONEY_FOAM,
  froth: [hex('#fffbe6'), hex('#ffe69a'), hex('#f4b830')],
  flame: [hex('#ffffff'), hex('#c8e8ff'), hex('#5a9cff')],
  jarl: true,
};

export const BREW_LOOKS = [BREW_LOOK, JARL_LOOK];

/** The look being drawn; set by buildBrewFrames. */
let S: BrewLook = BREW_LOOK;

// ---------------------------------------------------------------------------
// The rig

/** A hand (or the way the paddle points), in the rig's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
interface Hand {
  f: number;
  s: number;
  h: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

interface Pose {
  /** Whole body raised. */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The free hand and the paddle hand. */
  a: Hand;
  b: Hand;
  /** Which way the paddle points from its hand. */
  t: Hand;
  /** The paddle in hand; when not, it is slung across his back. */
  paddle: boolean;
  /** The jug in the free hand (else it hangs at his hip), and tipped to his mouth 0..1. */
  jug: boolean;
  tip: number;
  /** A keg held in both hands (the Special's heave). */
  keg: boolean;
  /** 0..1 a little flame struck in the free hand's fingers. */
  flame: number;
  /** Cheeks puffed out with a mouthful; the mouth open (spitting). */
  puffed?: boolean;
  open?: boolean;
  /** 1..3: a burp of foam rising off his beard and popping. */
  burp?: number;
  /** 0..1 steam puffing from the still's pipe. */
  steam: number;
  /** The apron's hem swinging, in pixels. */
  sway: number;
  tick: number;
  blink?: boolean;
  /** The head nudged from the body (a tilt back to drink, a nod); front view only. */
  headX?: number;
  headY?: number;
}

type View = 'down' | 'up' | 'side';

/** The chest row in body coordinates, the height hands are posed from. */
const CH = 18;
const REACH_FRONT = 4.4;
const REACH_SIDE = 4.9;

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

/** The paddle's direction on screen, foreshortened when it points at or away from the viewer; also whether it dips behind the body. */
function toolDir(view: View, t: Hand): { x: number; y: number; k: number; away: boolean } {
  const l = Math.hypot(t.f, t.s, t.h) || 1;
  const f = t.f / l;
  const s = t.s / l;
  const h = t.h / l;
  let x: number;
  let y: number;
  let away: boolean;
  if (view === 'down') {
    x = s;
    y = -h + f * 0.55;
    away = f < -0.35;
  } else if (view === 'up') {
    x = -s;
    y = -h - f * 0.55;
    away = f > 0.35;
  } else {
    x = -f;
    y = -h;
    away = false;
  }
  const k = Math.max(0.35, Math.hypot(x, y));
  const n = Math.hypot(x, y) || 1;
  return { x: x / n, y: y / n, k, away };
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

/** A thick arm: the shirt sleeve rolled to the elbow, a brawny bare forearm (the Jarl's in a leather bracer), a big hand. */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bias = 0): void {
  const [ex, ey] = elbow(sx, sy, p.x, p.y, reach, hint);
  const wx = ex + (p.x - ex) * 0.72;
  const wy = ey + (p.y - ey) * 0.72;
  c.part();
  c.capsule(sx, sy, ex, ey, 2.1, 1.8, S.shirt, { bias });
  c.part();
  c.ellipse(ex, ey, 1.85, 1.45, S.shirt, { bias: bias + 1 });
  c.part();
  c.capsule(ex, ey, wx, wy, 1.7, 1.45, S.skin, { bias });
  if (S.jarl) {
    c.part();
    c.capsule(ex + (wx - ex) * 0.35, ey + (wy - ey) * 0.35, wx, wy, 1.75, 1.55, BRACER, { bias });
  }
  hand(c, p.x, p.y, bias);
}

function hand(c: PixelCanvas, x: number, y: number, bias = 0): void {
  c.part();
  c.ellipse(x, y, 1.55, 1.4, S.skin, { bias });
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) c.px(x, y, S.skin, sphere(0, -0.3), { bias: -1 });
    else c.px(x, y, EYE);
  }
}

/** A small cross of light in the look's flame colours, growing with `k`. */
function glowAt(c: PixelCanvas, x: number, y: number, k: number, cols: [RGB, RGB, RGB] = S.flame): void {
  if (k <= 0) return;
  const [core, hot, mid] = cols;
  c.spark(x, y, core, k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + dx, y + dy, hot, 0.6 * k);
  if (k > 0.6) for (const [dx, dy] of [[0, -2], [1, -2], [-1, 1], [1, 1]]) c.spark(x + dx, y + dy, mid, 0.45 * k);
}

// ---------------------------------------------------------------------------
// What he holds

/**
 * The mash paddle along (ux, uy) from the hand: a long ash handle with a
 * knob at its butt, and a broad blade with two holes in it. The hand is drawn
 * again over the grip.
 */
function drawPaddle(c: PixelCanvas, p: Placed, d: { x: number; y: number; k: number }, bias = 0): void {
  const { x: ux, y: uy, k } = d;
  const vx = -uy;
  const vy = ux;
  const hx = p.x;
  const hy = p.y;
  const len = 13 * k;
  const blade = 5.4 * k;
  const s0 = len - blade;
  c.part();
  c.capsule(hx - ux * 2.6 * k, hy - uy * 2.6 * k, hx + ux * (s0 + 0.5), hy + uy * (s0 + 0.5), 0.7, 0.65, PADDLE, { bias });
  c.px(hx - ux * 2.9 * k, hy - uy * 2.9 * k, PADDLE, sphere(-ux * 0.5, -uy * 0.5), { bias: bias + 1 });
  // The blade: broad, its corners rounded, lit across its face.
  c.part();
  const hw = 1.9;
  for (let s = s0; s <= len; s += 0.3) {
    const u = (s - s0) / Math.max(0.1, blade);
    const w = hw * (u < 0.2 ? 0.55 + u * 2.25 : u > 0.88 ? 1 - (u - 0.88) * 2.4 : 1);
    for (let q = -w; q <= w; q += 0.3) c.px(hx + ux * s + vx * q, hy + uy * s + vy * q, PADDLE, sphere(vx * (q / hw) * 0.7, vy * (q / hw) * 0.7 - 0.2, 1), { bias: bias + (q < -w * 0.4 ? 1 : 0) });
  }
  // Two holes through it (the mash runs through them), shown when it faces us enough.
  if (blade > 3.2) {
    for (const f of [0.38, 0.72]) {
      const s = s0 + blade * f;
      c.erase(hx + ux * s, hy + uy * s);
    }
  }
  hand(c, hx, hy, bias);
}

/** The paddle slung across his back while his hands are full: its handle shows over his shoulder. */
function slungPaddle(c: PixelCanvas, view: View, U: number, hx: number): void {
  c.part();
  if (view === 'side') c.capsule(hx + 4, 25 + U, hx + 7.5, 9 + U, 0.7, 0.65, PADDLE, { bias: -1 });
  else if (view === 'down') c.capsule(5, 25 + U, 18.5, 9 + U, 0.7, 0.65, PADDLE, { bias: -1 });
  else c.capsule(19, 25 + U, 5.5, 9 + U, 0.7, 0.65, PADDLE);
}

/**
 * The clay jug with its neck along (ux, uy) from the hand: a round glazed
 * belly behind the hand, a neck and a cork (out while he drinks). The Jarl's
 * is a drinking horn: a wide gold-rimmed mouth curving away to a point.
 */
function drawJug(c: PixelCanvas, x: number, y: number, ux: number, uy: number, open: boolean, bias = 0): void {
  if (S.jarl) {
    drawHorn(c, x, y, ux, uy, open, bias);
    return;
  }
  const bx = x - ux * 1.9;
  const by = y - uy * 1.9;
  c.part();
  c.ellipse(bx, by, 2.0, 2.1, CLAY, { bias });
  // A band of green glaze round its shoulder.
  c.part();
  c.px(bx + ux * 1.2 - uy * 0.8, by + uy * 1.2 + ux * 0.8, GLAZE, sphere(-uy * 0.5, ux * 0.5), { bias });
  c.px(bx + ux * 1.2 + uy * 0.8, by + uy * 1.2 - ux * 0.8, GLAZE, sphere(uy * 0.5, -ux * 0.5), { bias });
  c.part();
  c.capsule(x, y, x + ux * 1.6, y + uy * 1.6, 0.75, 0.7, CLAY, { bias: bias + 1 });
  if (!open) c.px(x + ux * 2.6, y + uy * 2.6, CORK, sphere(ux * 0.5, uy * 0.5 - 0.3), { bias });
  // The little loop handle on its side.
  c.px(bx + uy * 2.4, by - ux * 2.4, CLAY, sphere(uy, -ux), { bias: bias - 1 });
}

function drawHorn(c: PixelCanvas, x: number, y: number, ux: number, uy: number, open: boolean, bias: number): void {
  // From the mouth, the horn sweeps back past the hand and curls to its tip.
  const pts: [number, number][] = [];
  const vx = -uy;
  const vy = ux;
  for (let i = 0; i <= 6; i++) {
    const f = i / 6;
    const back = 1.8 - f * 5.2;
    const curl = f * f * 2.6;
    pts.push([x + ux * back + vx * curl, y + uy * back + vy * curl]);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const r0 = 1.45 - (i / 6) * 1.05;
    const r1 = 1.45 - ((i + 1) / 6) * 1.05;
    c.part();
    c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r0, r1, HORN, { bias });
  }
  // The gold rim at its mouth, and mead glinting in it.
  c.part();
  c.px(pts[0][0] + vx * 1, pts[0][1] + vy * 1, GOLD, sphere(vx * 0.6, vy * 0.6), { bias });
  c.px(pts[0][0] - vx * 1, pts[0][1] - vy * 1, GOLD, sphere(-vx * 0.6, -vy * 0.6), { bias });
  c.px(pts[0][0] + ux * 0.6, pts[0][1] + uy * 0.6, open ? MEAD : HONEY_FOAM, sphere(ux * 0.4, uy * 0.4 - 0.4), { bias });
  c.px(pts[3][0], pts[3][1], GOLD, sphere(0, -0.3), { bias: bias - 1 });
}

/** The jug (or horn) hanging at his hip from its cord. */
function jugAtHip(c: PixelCanvas, x: number, y: number, bias = 0): void {
  if (S.jarl) {
    c.part();
    c.line(x - 0.5, y - 2.6, x + 0.5, y - 0.6, LEATHER, () => sphere(0, -0.2), { bias });
    drawHorn(c, x - 1.6, y + 0.4, -0.92, -0.38, false, bias);
    return;
  }
  c.part();
  c.line(x, y - 2.4, x, y - 1, LEATHER, () => sphere(0, -0.2), { bias });
  drawJug(c, x, y, 0, -1, false, bias);
}

/** A keg held in both hands at (x, y): lying across from the front and back, end on from the side. */
function heldKeg(c: PixelCanvas, x: number, y: number, view: View): void {
  const wood = S.jarl ? HONEY_OAK : OAK;
  const hoop = S.jarl ? GOLD : COPPER;
  c.part();
  if (view === 'side') {
    // Its head towards us: round, a chime ring, boards across it.
    c.ellipse(x, y, 3.7, 3.9, wood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.35, dy * 0.35, 1) });
    c.part();
    for (let a = 0; a < 28; a++) {
      const th = (a / 28) * Math.PI * 2;
      c.px(x + Math.cos(th) * 3.3, y + Math.sin(th) * 3.5, hoop, sphere(Math.cos(th) * 0.7, Math.sin(th) * 0.7));
    }
    for (const dx of [-1, 1]) for (let dy = -2; dy <= 2; dy++) c.shade(x + dx, y + dy, -1);
    c.px(x, y + 1, S.band, sphere(0, 0.2));
    return;
  }
  // Lying across: round top to bottom, bulging at the middle, hoops at each end.
  const hw = 5.6;
  for (let yy = Math.round(y - 4); yy <= Math.round(y + 3); yy++) {
    const v = (yy + 0.5 - y) / 4;
    const bulge = Math.sqrt(Math.max(0, 1 - v * v * 0.55));
    for (let xx = Math.round(x - hw); xx < x + hw; xx++) {
      const u = (xx + 0.5 - x) / hw;
      if (Math.abs(v) > 0.95 * (1 - u * u * 0.18)) continue;
      const m = Math.abs(Math.abs(u) - 0.62) < 0.09 || Math.abs(u) > 0.9 ? hoop : wood;
      c.px(xx, yy, m, sphere(u * 0.35, v * 0.95 * bulge, 1), { bias: (xx & 1) && m === wood ? -1 : 0 });
    }
  }
  if (view === 'down') c.px(x, Math.round(y - 4), S.band, sphere(0, -0.6), { bias: 1 });
}

// ---------------------------------------------------------------------------
// The still (or the cask) on his back

/**
 * The still from the front, behind him: its copper shoulders between his own
 * and his head, a swan-neck pipe rising over his right shoulder (screen
 * left) and curling down to a spout, a brass gauge on the other side. The
 * Jarl's cask shows only its rim and gold hoop over his shoulders.
 */
function stillFront(c: PixelCanvas, cx: number, U: number, steam: number, tick: number): void {
  c.part();
  if (S.jarl) {
    c.shape(Math.round(11 + U), Math.round(16 + U), (y) => {
      const u = (y - 11 - U) / 5;
      const hw = 3.6 + u * 1.2;
      return [cx - hw, cx + hw];
    }, S.still, (_x, y, t) => sphere(t * 0.9, (y - 11 - U) / 5 - 0.7, 1), { bias: -1 });
    for (let x = Math.round(cx - 4.6); x < cx + 4.6; x++) c.px(x, Math.round(12 + U), S.band, cyl((x + 0.5 - cx) / 4.6, -0.3), { bias: -1 });
    return;
  }
  c.ellipse(cx, 16.2 + U, 5.6, 3.0, S.still, { bias: -1 });
  c.part();
  c.ellipse(cx, 12.6 + U, 3.4, 2.4, S.still, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.4, 1) });
  // The swan neck, up from the dome and over to the spout.
  const pipe: [number, number][] = [[cx - 1.8, 11], [cx - 3.6, 8.6], [cx - 5.6, 7.6], [cx - 7.2, 8.4], [cx - 7.6, 10.2]];
  for (let i = 0; i < pipe.length - 1; i++) {
    c.part();
    c.capsule(pipe[i][0], pipe[i][1] + U, pipe[i + 1][0], pipe[i + 1][1] + U, 0.85 - i * 0.06, 0.8 - i * 0.06, S.still);
  }
  c.part();
  c.px(cx - 3.6, 8.6 + U, S.band, sphere(-0.2, -0.5));
  // The gauge, a brass ring round a pale face and its needle.
  c.part();
  c.ellipse(cx + 5.2, 14.2 + U, 1.5, 1.4, S.band, { bias: -1 });
  c.part();
  c.px(cx + 5, 14 + U, GAUGE, sphere(0, 0));
  c.px(cx + 5, 13 + U, INK_MAT, sphere(0, 0));
  if (steam > 0) puffSteam(c, cx - 7.6, 11 + U, steam, tick);
}

/** A material that is only ink (a gauge's needle). */
const INK_MAT: Material = { ramp: ramp('#1a1210', '#2a1e18'), outline: INK, noAO: true };

/** Steam puffing from a spout at (x, y), rising and spreading as `k` grows. */
function puffSteam(c: PixelCanvas, x: number, y: number, k: number, tick: number): void {
  const W: RGB = [236, 240, 246];
  const G: RGB = [190, 198, 210];
  const rise = 1 + k * 3;
  const drift = (tick % 2 ? -1 : 0) - k;
  c.spark(x, y + 1, W, 0.5 * k);
  c.spark(x + drift * 0.5, y + 1 - rise * 0.5, W, 0.6 * k);
  c.spark(x + drift, y + 1 - rise, W, 0.5 * k);
  c.spark(x + drift - 1, y + 1 - rise, G, 0.4 * k);
  c.spark(x + drift + 1, y - rise, G, 0.35 * k);
  if (k > 0.6) c.spark(x + drift - 0.5, y - rise - 1.5, G, 0.3 * k);
}

/**
 * The still from behind: a fat copper pot strapped to his back with a brass
 * band round it, its dome and swan neck, the gauge, a riveted seam and,
 * under it all, a little firebox glowing. The Jarl's is an upright oak cask,
 * staved, banded in gold, a spigot near its foot.
 */
function stillBack(c: PixelCanvas, cx: number, U: number, steam: number, tick: number): void {
  if (S.jarl) {
    c.part();
    c.shape(Math.round(12 + U), Math.round(24 + U), (y) => {
      const u = (y + 0.5 - 12 - U) / 12;
      const hw = 3.8 + Math.sin(u * Math.PI) * 0.9;
      return [cx - hw, cx + hw];
    }, S.still, (_x, y, t) => sphere(t * 0.95, ((y - 12 - U) / 12) * 0.6 - 0.35, 1));
    // Staves, and the gold hoops round them.
    for (let y = Math.round(13 + U); y <= 23 + U; y++) for (const dx of [-3, -1, 1, 3]) if (c.materialAt(cx + dx, y) === S.still) c.shade(cx + dx, y, -1);
    c.part();
    for (const hy of [14, 22]) c.shape(Math.round(hy + U), Math.round(hy + U), () => [cx - 4.7, cx + 4.7], S.band, (_x, _y, t) => cyl(t, 0.1));
    // The spigot, a drip of mead hanging from it.
    c.part();
    c.px(cx + 1, 21 + U, S.band, sphere(0.3, 0.2));
    c.px(cx + 1, 22 + U, MEAD, sphere(0, 0.4));
    c.spark(cx + 1, 22 + U, S.froth[2], 0.3);
    // The lid's rim at the top.
    c.part();
    c.shape(Math.round(12 + U), Math.round(12 + U), () => [cx - 3.8, cx + 3.8], S.still, (_x, _y, t) => cyl(t, -0.6), { bias: 1 });
    return;
  }
  c.part();
  c.ellipse(cx, 19.6 + U, 5.0, 4.8, S.still, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.85 - 0.1, 1) });
  // The seam's rivets down its middle and the brass band round its belly.
  for (let y = 16; y <= 23; y += 2) c.shade(cx, y + U, 1);
  c.part();
  c.shape(Math.round(18 + U), Math.round(18 + U), () => [cx - 5, cx + 5], S.band, (_x, _y, t) => cyl(t, 0.1));
  // The dome on top and the swan neck curling away over his left shoulder (screen left from behind it is his right).
  c.part();
  c.ellipse(cx, 14 + U, 3.4, 2.2, S.still, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.4, 1) });
  const pipe: [number, number][] = [[cx + 1.8, 12.4], [cx + 3.6, 9.6], [cx + 5.6, 8.4], [cx + 7.2, 9.2], [cx + 7.6, 11]];
  for (let i = 0; i < pipe.length - 1; i++) {
    c.part();
    c.capsule(pipe[i][0], pipe[i][1] + U, pipe[i + 1][0], pipe[i + 1][1] + U, 0.85 - i * 0.06, 0.8 - i * 0.06, S.still);
  }
  c.part();
  c.px(cx + 3.6, 9.6 + U, S.band, sphere(0.2, -0.5));
  // The gauge on its shoulder.
  c.part();
  c.ellipse(cx - 3, 16.6 + U, 1.5, 1.4, S.band);
  c.part();
  c.px(cx - 3, 16 + U, GAUGE, sphere(0, 0));
  c.px(cx - 3, 17 + U, GAUGE, sphere(0, 0), { bias: -1 });
  c.px(cx - 2, 16 + U, INK_MAT, sphere(0, 0));
  // The firebox under it, its grate glowing.
  c.part();
  c.shape(Math.round(24 + U), Math.round(25 + U), () => [cx - 2.4, cx + 2.4], STEEL, (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
  c.part();
  for (const dx of [-1, 1]) c.px(cx + dx - 0.5, 24.6 + U, FIREBOX, sphere(0, 0));
  c.spark(cx - 0.5, 24.6 + U, S.flame[1], 0.5 + 0.2 * (tick % 2));
  if (steam > 0) puffSteam(c, cx + 7.6, 12 + U, steam, tick);
}

/** The still from the side, on his back behind him: the pot, its dome, the swan neck curling back to its spout, the firebox's glow. */
function stillSide(c: PixelCanvas, hx: number, U: number, steam: number, tick: number): void {
  if (S.jarl) {
    c.part();
    c.shape(Math.round(12 + U), Math.round(24 + U), (y) => {
      const u = (y + 0.5 - 12 - U) / 12;
      const w = 2.4 + Math.sin(u * Math.PI) * 0.7;
      return [hx + 5.2 - w, hx + 5.2 + w];
    }, S.still, (_x, y, t) => sphere(t * 0.9, ((y - 12 - U) / 12) * 0.6 - 0.35, 1), { bias: -1 });
    for (let y = Math.round(13 + U); y <= 23 + U; y++) c.shade(hx + 6, y, -1);
    c.part();
    for (const hy of [14, 22]) c.shape(Math.round(hy + U), Math.round(hy + U), () => [hx + 2.4, hx + 8.2], S.band, (_x, _y, t) => cyl(t, 0.1), { bias: -1 });
    return;
  }
  c.part();
  c.ellipse(hx + 5.2, 19.4 + U, 3.4, 4.6, S.still, { bias: -1, normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.85 - 0.1, 1) });
  c.part();
  c.shape(Math.round(18 + U), Math.round(18 + U), () => [hx + 1.9, hx + 8.6], S.band, (_x, _y, t) => cyl(t, 0.1), { bias: -1 });
  c.part();
  c.ellipse(hx + 5, 14 + U, 2.4, 2.0, S.still, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.4, 1) });
  const pipe: [number, number][] = [[hx + 5.6, 12.4], [hx + 6.6, 9.4], [hx + 8.4, 8.4], [hx + 9.8, 9.6], [hx + 10, 11.4]];
  for (let i = 0; i < pipe.length - 1; i++) {
    c.part();
    c.capsule(pipe[i][0], pipe[i][1] + U, pipe[i + 1][0], pipe[i + 1][1] + U, 0.8 - i * 0.05, 0.75 - i * 0.05, S.still);
  }
  c.part();
  c.px(hx + 8, 16 + U, S.band, sphere(0.4, 0));
  c.px(hx + 8, 16 + U, GAUGE, sphere(0.4, 0));
  c.part();
  c.shape(Math.round(24 + U), Math.round(25 + U), () => [hx + 3.4, hx + 7.4], STEEL, (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
  c.part();
  c.px(hx + 5, 24.6 + U, FIREBOX, sphere(0, 0));
  c.px(hx + 6, 24.6 + U, FIREBOX, sphere(0, 0));
  c.spark(hx + 5.5, 24.6 + U, S.flame[1], 0.5 + 0.2 * (tick % 2));
  if (steam > 0) puffSteam(c, hx + 10, 12.4 + U, steam, tick);
}

// ---------------------------------------------------------------------------
// The body

/** The torso's half width at row y: broad shoulders, then the belly swelling out before the belt. */
function torsoWidth(y: number, top: number, waist: number): number {
  const u = (y + 0.5 - top) / (waist - top);
  if (u < 0.2) return 5.0 + u * 7;
  return 6.3 + Math.sin(((u - 0.2) / 0.8) * Math.PI * 0.9) * 0.6;
}

/** Short, thick legs and big boots (the Jarl's wrapped in fur at the top). */
function legsFront(c: PixelCanvas, L: number, fa: number, fb: number, back: boolean): void {
  const [l, r] = back ? [fb, fa] : [fa, fb];
  c.part();
  c.capsule(9.2, 25 + L, 9.0, 28.6 - l, 2.1, 1.8, S.trouser);
  c.capsule(14.8, 25 + L, 15.0, 28.6 - r, 2.1, 1.8, S.trouser);
  boot(c, 8.9, 30.2 - l);
  boot(c, 15.1, 30.2 - r);
}

function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  c.ellipse(x, y, side ? 2.7 : 2.3, 1.5, BOOT, { flatten: 0.8, bias });
  c.part();
  if (S.jarl) c.ellipse(x + (side ? 0.6 : 0), y - 1.4, side ? 2.0 : 2.2, 0.9, FUR, { bias });
  else c.ellipse(x + (side ? 0.6 : 0), y - 1.3, side ? 1.8 : 2.0, 0.7, BOOT, { bias: bias + 1 });
}

/**
 * From the front: the shirt over the broad chest and belly, the belt at the
 * sides, the apron over the front with its bib strap and a pocket, the jug
 * at the hip; the Jarl's fur mantle over his shoulders.
 */
function torsoDown(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const top = 15.4 + U;
  const waist = 24 + U;
  const hem = 27.6 + L;
  c.part();
  c.shape(Math.round(top), Math.round(waist), (y) => {
    const hw = torsoWidth(y, top, waist);
    return [cx - hw, cx + hw];
  }, S.shirt, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top) - 0.4) * 1.1, 1));
  // Seat of the breeches under the belt.
  c.part();
  c.shape(Math.round(waist), Math.round(25.5 + L), () => [cx - 5.6, cx + 5.6], S.trouser, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.shape(Math.round(waist), Math.round(waist), () => [cx - 6.5, cx + 6.5], LEATHER, (_x, _y, t) => cyl(t, 0));
  // The apron: a narrow bib under the beard, wide over the belly, its skirt swinging.
  c.part();
  c.shape(Math.round(top + 2), Math.round(hem), (y) => {
    const u = (y - top - 2) / (hem - top - 2);
    const hw = u < 0.55 ? 3.0 + Math.sin((u / 0.55) * Math.PI * 0.5) * 2.0 : 5.0 - (u - 0.55) * 0.8;
    const sw = y > waist ? ((y - waist) / (hem - waist)) * p.sway : 0;
    return [cx - hw + sw, cx + hw + sw];
  }, S.apron, (_x, y, t) => sphere(t * 0.85, ((y - top) / (hem - top)) * 0.9 - 0.35, 1));
  // Its tie, a pocket on the belly with a brass rivet at each corner, and the bib's strap.
  for (let x = Math.round(cx - 4.6); x <= cx + 3.6; x++) if (c.materialAt(x, Math.round(waist)) === S.apron) c.shade(x, Math.round(waist), -1);
  for (let x = Math.round(cx - 2); x <= cx + 1; x++) c.shade(x, Math.round(waist + 1.6), -1);
  c.part();
  c.px(cx - 3, Math.round(waist + 1.6), S.band, sphere(-0.3, 0));
  c.px(cx + 2, Math.round(waist + 1.6), S.band, sphere(0.3, 0));
  c.part();
  for (const s of [-1, 1]) {
    const x = s < 0 ? cx - 3 : cx + 2;
    c.line(x - s * 1.6, top, x, top + 2.6, S.apron, () => sphere(s * 0.3, -0.4));
  }
  if (S.jarl) mantleFront(c, cx, U);
  if (!p.jug) jugAtHip(c, cx - 6.4, waist - 0.4);
}

/** The Jarl's wolf-fur mantle over his shoulders, its edge tufted, pinned with a gold brooch. */
function mantleFront(c: PixelCanvas, cx: number, U: number): void {
  const top = 14.2 + U;
  c.part();
  c.shape(Math.round(top), Math.round(top + 4), (y) => {
    const u = (y - top) / 4;
    const hw = 4.6 + Math.sqrt(u) * 2.8;
    return [cx - hw, cx + hw];
  }, FUR, (x, y, t, u) => sphere(t * 0.95, u - 0.6 + ((x + y) & 1 ? 0.2 : -0.1), 1));
  // A tufted lower edge: every other pixel of the last row gone, the next shaded.
  const y = Math.round(top + 4);
  for (let x = Math.round(cx - 8); x <= cx + 8; x++) {
    if (!c.filled(x, y)) continue;
    if ((x & 1) === 0) c.erase(x, y);
    else c.shade(x, y - 1, -1);
  }
  c.part();
  c.px(cx - 4, Math.round(top + 2), GOLD, sphere(-0.3, -0.3), { bias: 1 });
  c.px(cx - 3, Math.round(top + 2), GOLD, sphere(0.2, -0.2));
}

/** The head from the front: a ruddy face, bushy brows, a big round nose, the beard and the cap. */
function headDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const puffed = !!p.puffed;
  // Hair at his temples under the cap.
  c.part();
  c.ellipse(cx - 3.5, 12 + U, 1.3, 1.9, S.beard);
  c.ellipse(cx + 3.5, 12 + U, 1.3, 1.9, S.beard, { bias: -1 });
  c.part();
  c.ellipse(cx, 12.6 + U, 3.3 + (puffed ? 0.5 : 0), 3.0, S.skin);
  // Rosy cheeks, puffed out round a mouthful.
  c.part();
  c.px(cx - 3, 13 + U, CHEEK, sphere(-0.5, 0.1));
  c.px(cx + 2, 13 + U, CHEEK, sphere(0.5, 0.1));
  if (puffed) {
    c.px(cx - 4, 13 + U, CHEEK, sphere(-0.8, 0.1));
    c.px(cx + 3, 13 + U, CHEEK, sphere(0.8, 0.1));
  }
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
  // Bushy brows.
  c.part();
  for (const x of [cx - 3, cx - 2, cx + 1, cx + 2]) c.px(x, 11 + U, S.beard, sphere((x + 0.5 - cx) / 4, -0.5), { bias: 1 });
  // The nose: big, round and red at the tip.
  c.part();
  c.px(cx - 1, 13 + U, S.skin, sphere(-0.3, -0.3), { bias: 1 });
  c.px(cx, 13 + U, S.skin, sphere(0.3, -0.3));
  c.px(cx - 1, 14 + U, CHEEK, sphere(-0.2, 0.4));
  c.px(cx, 14 + U, CHEEK, sphere(0.2, 0.4), { bias: -1 });
  if (S.jarl) jarlBeard(c, cx, U, p);
  else redBeard(c, cx, U, p);
  cap(c, cx, U, 'down');
}

/** The great red beard: a moustache over the mouth, then a broad fan down over his chest, forked at its end. */
function redBeard(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const widths = [3.9, 4.3, 4.3, 4.0, 3.5, 2.9, 2.2, 1.6];
  const top = Math.round(14 + U);
  c.part();
  c.shape(top, top + widths.length - 1, (y) => {
    const hw = widths[y - top];
    return [cx - hw, cx + hw];
  }, S.beard, (x, y, t) => sphere(t * 0.85, (y - top) / 8 - 0.2 + ((x & 1) ? 0.12 : -0.12), 1));
  // Strands: every other column a shade darker down its length, and the fork at the bottom.
  for (let y = top + 2; y < top + widths.length; y++) for (let x = cx - 4; x <= cx + 3; x++) if ((x + (y >> 1)) % 3 === 0) c.shade(x, y, -1);
  c.erase(cx, top + 7);
  c.erase(cx - 1, top + 7);
  c.shade(cx, top + 6, -1);
  c.shade(cx - 1, top + 6, -1);
  // The moustache, lit, drooping at its ends.
  c.part();
  for (let x = cx - 3; x <= cx + 2; x++) c.px(x, top, S.beard, sphere((x + 0.5 - cx) / 3.5, -0.4), { bias: 1 });
  c.px(cx - 4, top + 1, S.beard, sphere(-0.7, 0.2), { bias: 1 });
  c.px(cx + 3, top + 1, S.beard, sphere(0.7, 0.2), { bias: 1 });
  mouth(c, cx, top + 1, p);
}

/** The Jarl's beard: a short full one, and two long braids bound in gold. */
function jarlBeard(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const top = Math.round(14 + U);
  const widths = [3.9, 4.1, 3.6, 2.6];
  c.part();
  c.shape(top, top + 3, (y) => {
    const hw = widths[y - top];
    return [cx - hw, cx + hw];
  }, S.beard, (x, y, t) => sphere(t * 0.85, (y - top) / 4 - 0.2 + ((x & 1) ? 0.12 : -0.12), 1));
  for (const bx of [cx - 1.6, cx + 1.1]) braid(c, bx, top + 3, top + 8, bx < cx ? -0.4 : 0.4);
  c.part();
  for (let x = cx - 4; x <= cx + 3; x++) c.px(x, top, S.beard, sphere((x + 0.5 - cx) / 4, -0.4), { bias: 1 });
  c.px(cx - 4, top + 1, S.beard, sphere(-0.7, 0.2), { bias: 1 });
  c.px(cx + 3, top + 1, S.beard, sphere(0.7, 0.2), { bias: 1 });
  mouth(c, cx, top + 1, p);
}

/** A braid from (x, y0) down to y1, drifting `dx`: plaits shaded by turns, a gold ring at its end. */
function braid(c: PixelCanvas, x: number, y0: number, y1: number, dx: number): void {
  c.part();
  for (let y = y0; y <= y1; y++) {
    const u = (y - y0) / Math.max(1, y1 - y0);
    const bx = x + dx * u;
    const k = y & 1 ? 1 : -1;
    c.px(bx, y, S.beard, cyl(k * 0.5, 0.2), { bias: k > 0 ? 1 : -1 });
    if (u < 0.6) c.px(bx + (k > 0 ? -1 : 1), y, S.beard, cyl(-k * 0.4, 0.2), { bias: -1 });
  }
  c.part();
  c.px(x + dx, y1 + 1, GOLD, sphere(0, 0.2), { bias: 1 });
  c.px(x + dx, y1 + 2, S.beard, sphere(0, 0.5));
}

/** The mouth in the beard: a dark gap when open (spitting), nothing when shut. */
function mouth(c: PixelCanvas, cx: number, y: number, p: Pose): void {
  if (!p.open) return;
  c.part();
  c.px(cx - 1, y, INK_MAT, sphere(0, 0));
  c.px(cx, y, INK_MAT, sphere(0, 0));
}

/**
 * The cap: a moss-green knit cap rolled up at the brim, ribbed, with a nub
 * on top; or the Jarl's plain iron cap with a ridge and a gold rim.
 */
function cap(c: PixelCanvas, cx: number, U: number, view: View, hx = cx): void {
  const x0 = view === 'side' ? hx + 0.2 : cx;
  c.part();
  const widths = S.jarl ? [2.2, 3.2, 3.7, 3.9] : [2.6, 3.4, 3.8, 3.9];
  c.shape(Math.round(7 + U), Math.round(10 + U), (y) => {
    const w = widths[Math.min(3, Math.max(0, y - Math.round(7 + U)))];
    return [x0 - w, x0 + w];
  }, S.cap, (_x, y, t) => sphere(t * 0.9, (y - 7 - U) / 4 - 0.8, 1));
  if (S.jarl) {
    // The ridge, and the gold rim round its brow.
    if (view !== 'side') for (let y = 7; y <= 9; y++) c.shade(Math.round(x0 - 0.5), y + U, 1);
    c.part();
    c.shape(Math.round(10 + U), Math.round(10 + U), () => [x0 - 4.3, x0 + 4.3], GOLD, (_x, _y, t) => cyl(t, 0.3));
    return;
  }
  // The ribbed roll at the brim.
  c.part();
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [x0 - 4.3, x0 + 4.3], S.cap, (_x, _y, t) => cyl(t, 0.2), { bias: 1 });
  for (let x = Math.round(x0 - 4); x <= x0 + 4; x += 2) c.shade(x, Math.round(10 + U), -1);
  // The nub on top, flopping back.
  c.part();
  c.px(x0 + (view === 'side' ? 1 : 0), Math.round(6 + U), S.cap, sphere(0.2, -0.6), { bias: 1 });
}

/** A burp of froth rising off his beard: a bubble that swells (1, 2) and pops into droplets (3). */
function burp(c: PixelCanvas, x: number, y: number, k: number): void {
  c.part();
  if (k === 1) {
    c.ellipse(x, y, 1.3, 1.2, S.foam);
    c.spark(x - 0.5, y - 0.5, S.froth[0], 0.3);
  } else if (k === 2) {
    c.ellipse(x - 1, y - 3, 2.3, 2.1, S.foam);
    c.px(x, y - 1, S.foam, sphere(0, 0));
    c.spark(x - 2, y - 4, S.froth[0], 0.45);
  } else {
    for (const [dx, dy] of [[-4, -4], [-2, -6], [1, -5], [-3, -2], [2, -3]]) c.px(x + dx, y + dy, S.foam, sphere(0, -0.3));
  }
}

// ---------------------------------------------------------------------------
// The views

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const td = toolDir('down', p.t);
  const armA = () => arm(c, 5.8, 16.8 + U, fa, REACH_FRONT, [-0.6, 1], fa.behind ? -1 : 0);
  const armB = () => arm(c, 18.2, 16.8 + U, fb, REACH_FRONT, [0.6, 1], fb.behind ? -1 : 0);
  const tool = (bias = 0) => drawPaddle(c, fb, td, bias);
  const head = (draw: () => void) => {
    c.offset(BODY_X + (p.headX ?? 0), BODY_Y + (p.headY ?? 0));
    draw();
    c.offset(BODY_X, BODY_Y);
  };

  stillFront(c, cx, U, p.steam, p.tick);
  if (!p.paddle) slungPaddle(c, 'down', U, cx);
  const toolBack = p.paddle && (td.away || fb.behind);
  if (fa.behind) armA();
  if (fb.behind) armB();
  if (toolBack) tool(-1);

  legsFront(c, L, p.footA, p.footB, false);
  torsoDown(c, cx, U, L, p);
  head(() => headDown(c, cx, U, p));

  if (!fb.behind) armB();
  if (p.paddle && !toolBack) tool();
  if (!fa.behind) armA();
  held(c, p, fa, fb, 'down', cx + (p.headX ?? 0), 15 + U + (p.headY ?? 0));
  if (p.burp) burp(c, cx - 1 + (p.headX ?? 0), 14 + U + (p.headY ?? 0), p.burp);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const td = toolDir('up', p.t);
  const armA = () => arm(c, 18.2, 16.8 + U, fa, REACH_FRONT, [0.6, 0.8], fa.behind ? -1 : 0);
  const armB = () => arm(c, 5.8, 16.8 + U, fb, REACH_FRONT, [-0.6, 0.8], fb.behind ? -1 : 0);
  const tool = (bias = 0) => drawPaddle(c, fb, td, bias);

  const toolBack = p.paddle && (td.away || fb.behind);
  if (fa.behind) armA();
  if (fb.behind) armB();
  if (toolBack) tool(-1);
  if (p.keg && fa.behind) heldKeg(c, (fa.x + fb.x) / 2, (fa.y + fb.y) / 2 - 1, 'up');

  legsFront(c, L, p.footA, p.footB, true);
  // The shirt's back, the belt, the apron's strings crossing and its bow.
  const top = 15.4 + U;
  const waist = 24 + U;
  c.part();
  c.shape(Math.round(top), Math.round(waist), (y) => {
    const hw = torsoWidth(y, top, waist) - 0.3;
    return [cx - hw, cx + hw];
  }, S.shirt, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top) - 0.4) * 1.1, 1));
  c.part();
  c.shape(Math.round(waist), Math.round(25.5 + L), () => [cx - 5.6, cx + 5.6], S.trouser, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.shape(Math.round(waist), Math.round(waist), () => [cx - 6.4, cx + 6.4], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx - 1, Math.round(waist), S.apron, sphere(-0.4, -0.2), { bias: 1 });
  c.px(cx, Math.round(waist), S.apron, sphere(0.4, -0.2), { bias: 1 });
  c.px(cx - 1, Math.round(waist + 1), S.apron, sphere(-0.2, 0.4));
  c.px(cx + 1, Math.round(waist + 1), S.apron, sphere(0.2, 0.4));
  if (!p.jug) jugAtHip(c, cx + 6.4, waist - 0.4, -1);
  // The back of his head under the cap: hair, and his beard's edges past his jaw.
  c.part();
  c.ellipse(cx, 12.4 + U, 3.4, 3.0, S.beard, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7, 1) });
  c.part();
  c.px(cx - 4, 13 + U, S.skin, cyl(-0.8, 0));
  c.px(cx + 3, 13 + U, S.skin, cyl(0.8, 0));
  c.px(cx - 4, 15 + U, S.beard, sphere(-0.7, 0.3));
  c.px(cx + 3, 15 + U, S.beard, sphere(0.7, 0.3));
  cap(c, cx, U, 'up');
  // The still over it all, its straps over his shoulders.
  c.part();
  for (const s of [-1, 1]) c.line(cx + s * 3.4, top - 0.4, cx + s * 4.6, top + 3, LEATHER, () => sphere(s * 0.4, -0.3));
  stillBack(c, cx, U, p.steam, p.tick);
  if (S.jarl) {
    c.part();
    c.shape(Math.round(13.8 + U), Math.round(16.6 + U), (y) => {
      const u = (y - 13.8 - U) / 2.8;
      const hw = 5.4 + u * 1.8;
      return [cx - hw, cx + hw];
    }, FUR, (x, y, t, u) => sphere(t * 0.95, u - 0.6 + ((x + y) & 1 ? 0.2 : -0.1), 1));
    for (let x = Math.round(cx - 3); x <= cx + 3; x++) c.erase(x, Math.round(16.6 + U));
  }
  if (!p.paddle) slungPaddle(c, 'up', U, cx);

  if (!fb.behind) armB();
  if (p.paddle && !toolBack) tool();
  if (!fa.behind) armA();
  if (p.keg && !fa.behind) {
    heldKeg(c, (fa.x + fb.x) / 2, (fa.y + fb.y) / 2 - 1, 'up');
    hand(c, fa.x, fa.y);
    hand(c, fb.x, fb.y);
  } else held(c, p, fa, fb, 'up', cx, 15 + U);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean;
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);
  const td = toolDir('side', p.t);
  const top = 15.4 + U;
  const waist = 23.6 + U;
  const hem = 27.4 + L;

  stillSide(c, hx, U, p.steam, p.tick);
  if (!p.paddle) slungPaddle(c, 'side', U, hx);
  // The far arm behind everything, unless it reaches out in front.
  const armA = (bias: number) => arm(c, hx + 1.2, 16.4 + U, fa, REACH_SIDE, [0.3, 1], bias);
  if (fa.behind) armA(-1);
  // A paddle swung back past the body goes behind it.
  const toolBack = p.paddle && td.x > 0.55 && fb.x > hx - 1;
  if (toolBack) drawPaddle(c, fb, td, -1);

  // Legs: the back one in shade first, short and thick.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  c.part();
  c.capsule(cx + 1, 25 + L, cx + 1.2 - p.footB, 28.8 - lift(p.footB), 2.0, 1.7, S.trouser, { bias: -1 });
  boot(c, cx + 0.6 - p.footB, 30.2 - lift(p.footB), true, -1);
  c.part();
  c.capsule(cx - 0.8, 25 + L, cx - 0.6 - p.footA, 28.8 - lift(p.footA), 2.0, 1.7, S.trouser);
  boot(c, cx - 1.4 - p.footA, 30.2 - lift(p.footA), true);

  // The jug at his back hip.
  if (!p.jug) jugAtHip(c, hx + 3.8, waist - 0.2, -1);
  // The torso in profile: the back straight, the belly out in front.
  c.part();
  c.shape(Math.round(top), Math.round(25.4 + L), (y) => {
    const u = Math.min(1, (y + 0.5 - top) / (waist - top));
    const belly = Math.sin(Math.min(1, u * 1.05) * Math.PI * 0.85) * 2.3;
    const shift = y <= waist ? hx : hx + (cx - hx) * Math.min(1, (y - waist) / 2);
    return [shift - 3.5 - belly, shift + 3.6];
  }, S.shirt, (_x, y, t) => sphere(t * 0.9 - 0.1, ((y - top) / (waist - top)) * 0.9 - 0.35, 1));
  c.part();
  c.shape(Math.round(waist), Math.round(waist), () => [hx - 4.8, hx + 3.7], LEATHER, (_x, _y, t) => cyl(t, 0));
  // The apron down his front, swinging out at the hem.
  c.part();
  c.shape(Math.round(top + 2), Math.round(hem), (y) => {
    const u = Math.min(1, (y + 0.5 - top) / (waist - top));
    const belly = Math.sin(Math.min(1, u * 1.05) * Math.PI * 0.85) * 2.3;
    const below = y > waist ? (y - waist) / (hem - waist) : 0;
    const x0 = (y <= waist ? hx : hx + (cx - hx) * Math.min(1, below * 2)) - 3.5 - belly * (y <= waist ? 1 : 1 - below * 0.6) - below * p.sway * 0.4;
    return [x0 - 0.3, x0 + 2.2];
  }, S.apron, (_x, _y, t) => sphere(t * 0.8 - 0.3, 0.1, 1));
  c.part();
  c.px(Math.round(hx - 5.6), Math.round(waist), S.band, sphere(-0.5, -0.2));
  if (S.jarl) {
    // The fur mantle over his shoulder.
    c.part();
    c.shape(Math.round(14 + U), Math.round(17.6 + U), (y) => {
      const u = (y - 14 - U) / 3.6;
      return [hx - 2.6 - u * 1.6, hx + 3.4 + u * 1.2];
    }, FUR, (x, y, t, u) => sphere(t * 0.9, u - 0.6 + ((x + y) & 1 ? 0.2 : -0.1), 1));
    const y = Math.round(17.6 + U);
    for (let x = Math.round(hx - 5); x <= hx + 5; x++) if ((x & 1) === 0 && c.filled(x, y)) c.erase(x, y);
  }

  // The head in profile: hair at the back, the face, a great round nose, the beard jutting forward.
  c.part();
  c.ellipse(hx + 1.2, 12.2 + U, 2.2, 2.6, S.beard, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8, 1) });
  c.part();
  c.ellipse(hx - 0.8, 12.6 + U, 2.9 + (p.puffed ? 0.4 : 0), 2.9, S.skin);
  c.part();
  c.px(hx + 0.8, 12 + U, S.skin, cyl(0.6, 0), { bias: -1 });
  c.part();
  c.ellipse(hx - 3.9, 13.1 + U, 1.15, 1.05, S.skin, { bias: 1 });
  c.px(hx - 4.4, 13.4 + U, CHEEK, sphere(-0.5, 0.3));
  c.px(hx - 2.2, 13.4 + U, CHEEK, sphere(0, 0.1));
  eyes(c, [[hx - 3, 12 + U]], p.blink);
  c.part();
  c.px(hx - 3, 11 + U, S.beard, sphere(-0.3, -0.5), { bias: 1 });
  c.px(hx - 2, 11 + U, S.beard, sphere(-0.3, -0.5), { bias: 1 });
  // The beard: from the jaw forward and down over his chest.
  c.part();
  const bTop = Math.round(14 + U);
  const bLen = S.jarl ? 4 : 7;
  c.shape(bTop, bTop + bLen - 1, (y) => {
    const u = (y - bTop) / bLen;
    return [hx - 4.6 - u * 1.2, hx + 0.8 - u * 2.6];
  }, S.beard, (x, y, t) => sphere(t * 0.8 - 0.2, (y - bTop) / bLen - 0.2 + ((x & 1) ? 0.12 : -0.12), 1));
  for (let y = bTop + 1; y < bTop + bLen; y++) for (let x = Math.round(hx - 6); x <= hx; x++) if ((x + (y >> 1)) % 3 === 0) c.shade(x, y, -1);
  if (S.jarl) braid(c, hx - 4, bTop + bLen - 1, bTop + bLen + 4, -0.6);
  // The moustache over the mouth.
  c.part();
  for (const x of [hx - 5, hx - 4, hx - 3]) c.px(x, bTop, S.beard, sphere(-0.3, -0.4), { bias: 1 });
  if (p.open) c.px(hx - 5, bTop + 1, INK_MAT, sphere(0, 0));
  cap(c, cx, U, 'side', hx);
  if (p.burp) burp(c, hx - 5, 14 + U, p.burp);

  if (!fa.behind) armA(0);
  // The near arm last, the paddle in its hand.
  arm(c, hx + 0.2, 16.7 + U, fb, REACH_SIDE, [0.4, 1], 0);
  if (p.paddle && !toolBack) drawPaddle(c, fb, td);
  held(c, p, fa, fb, 'side', hx - 4, 14.6 + U);
}

/**
 * What the hands hold besides the paddle: the jug (tipped towards the mouth
 * at (mx, my) as he drinks), a flame struck in the free hand's fingers, or
 * the keg in both.
 */
function held(c: PixelCanvas, p: Pose, fa: Placed, fb: Placed, view: View, mx: number, my: number): void {
  if (p.keg) {
    heldKeg(c, (fa.x + fb.x) / 2, (fa.y + fb.y) / 2 - (view === 'side' ? 1.5 : 1), view);
    hand(c, fa.x, fa.y);
    hand(c, fb.x, fb.y);
    return;
  }
  if (p.jug) {
    // Upright by the neck, or tipped with its neck to his lips.
    let ux = 0;
    let uy = -1;
    if (p.tip > 0) {
      const dx = mx - fa.x;
      const dy = my - fa.y;
      const l = Math.hypot(dx, dy) || 1;
      ux = (dx / l) * p.tip;
      uy = (dy / l) * p.tip - (1 - p.tip);
      const n = Math.hypot(ux, uy) || 1;
      ux /= n;
      uy /= n;
    }
    drawJug(c, fa.x, fa.y, ux, uy, p.tip > 0);
    hand(c, fa.x, fa.y);
  }
  if (p.flame > 0) {
    // A flint struck in the fingers: a little flame dancing over them.
    const fx = fa.x + (view === 'side' ? -0.5 : 0);
    const fy = fa.y - 2;
    c.spark(fx, fy + 1, S.flame[2], 0.5 * p.flame);
    glowAt(c, fx, fy, p.flame);
    if (p.flame > 0.7) c.spark(fx + (p.tick % 2 ? 1 : -1), fy - 2, S.flame[1], 0.5);
  }
}

// ---------------------------------------------------------------------------
// Animations

/** The free hand easy at his side, by his belly. */
const REST_A = H(0.8, 6.6, -4.6);
/** The paddle stood upright at his side like a staff, its blade up by his head (in profile, held out before him so it never hides his face). */
const PADDLE_B = H(0.4, 7.4, -0.6);
const PADDLE_T = H(0.12, 0.22, 1);
const PADDLE_B_SIDE = H(4, 0, -0.6);
const PADDLE_T_SIDE = H(0.22, 0, 1);

/** Side-view hands: a little further forward, both at the body's line. */
const side = (h: Hand, arm: 'a' | 'b'): Hand => H(h.f + (arm === 'b' ? 0.6 : 0.4), 0, h.h);

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: view === 'side' ? side(REST_A, 'a') : { ...REST_A },
  b: view === 'side' ? { ...PADDLE_B_SIDE } : { ...PADDLE_B },
  t: view === 'side' ? { ...PADDLE_T_SIDE } : { ...PADDLE_T },
  paddle: true,
  jug: false,
  tip: 0,
  keg: false,
  flame: 0,
  steam: 0,
  sway: 0,
  tick: 0,
});

/** Standing broad, breathing deep, the paddle tapping his shoulder; the still lets off a puff now and then. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.sway = Math.sin(ph - 1) * 0.5;
    p.tick = f;
    p.blink = f === 4;
    p.t.f += Math.sin(ph) * 0.06;
    p.steam = f === 2 ? 0.4 : f === 3 ? 0.8 : f === 4 ? 0.5 : 0;
    frames.push(p);
  }
  return frames;
}

/** A rolling, side-to-side waddle: short legs, the apron swinging, the free arm pumping. */
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
      p.footA = Math.round(s * 2);
      p.footB = -p.footA;
      p.lean = 1;
      p.sway = 1 + Math.abs(s) * 0.9;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.9;
    }
    p.a.f -= s * 1.4;
    p.b.h += p.lift * 0.4;
    p.steam = f === 1 ? 0.5 : f === 2 ? 0.3 : 0;
    frames.push(p);
  }
  return frames;
}

interface Key {
  a?: Hand;
  b?: Hand;
  t?: Hand;
  aSide?: Hand;
  bSide?: Hand;
  lean?: number;
  breath?: number;
  lift?: number;
  step?: number;
  paddle?: boolean;
  jug?: boolean;
  tip?: number;
  keg?: boolean;
  flame?: number;
  puffed?: boolean;
  open?: boolean;
  headY?: number;
  blink?: boolean;
  steam?: number;
}

/** An action as keyframes; anything left out stays at rest. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k, i) => {
      const p = base(view);
      if (k.a) p.a = view === 'side' ? { ...(k.aSide ?? side(k.a, 'a')) } : { ...k.a };
      if (k.b) p.b = view === 'side' ? { ...(k.bSide ?? side(k.b, 'b')) } : { ...k.b };
      if (k.t) p.t = { ...k.t };
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
      p.tick = i;
      p.paddle = k.paddle ?? true;
      p.jug = !!k.jug;
      p.tip = k.tip ?? 0;
      p.keg = !!k.keg;
      p.flame = k.flame ?? 0;
      p.puffed = k.puffed;
      p.open = k.open;
      p.blink = k.blink;
      p.steam = k.steam ?? 0;
      if (view === 'down') p.headY = k.headY;
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

// The paddle: a forehand sweep, a backhand, and a two-handed slam he throws his whole belly behind.
const swing = action([
  { b: H(0.4, 7, 3), t: H(-0.6, 0.9, 0.6), lean: -1 },
  { b: H(4, 4.4, 1.4), t: H(1, 0.6, 0.1), lean: 1, step: 1 },
  { b: H(4.2, -0.6, 0.6), t: H(0.6, -1, -0.1), lean: 1, step: 1 },
  { b: H(1.8, 3, 0), t: H(0.3, 0.2, -1) },
]);

const swing2 = action([
  { b: H(2.6, -1.4, 1.6), t: H(0.3, -1, 0.4), lean: -1 },
  { b: H(4.4, 2.4, 1), t: H(1, 0.4, 0), lean: 1, step: 1 },
  { b: H(3.2, 6.6, 0.6), t: H(0.3, 1, -0.3), lean: 1 },
  { b: H(1.6, 5, 0.6), t: H(0.15, 0.2, 1) },
]);

const slam = action([
  { b: H(0.4, 2.4, 6), a: H(0.4, 1.0, 5.4), aSide: H(0.6, 0, 5.2), t: H(-0.6, 0, 0.8), lean: -1 },
  { b: H(-0.4, 2, 8), a: H(-0.4, 0.8, 7.6), aSide: H(0, 0, 7.4), t: H(-0.8, 0, 0.6), lean: -2, lift: 1 },
  { b: H(4.6, 1.8, 0.4), a: H(4.2, 0.6, 0.6), aSide: H(4.6, 0, 0.8), t: H(1, 0, -0.9), lean: 2, step: 1, breath: 1 },
  { b: H(4.8, 1.8, -0.2), a: H(4.4, 0.6, 0), aSide: H(4.8, 0, 0.2), t: H(1, 0, -1), lean: 2, step: 1, breath: 1 },
  { b: H(3, 2.6, 0), a: H(2, 3.4, -1.6), t: H(0.6, 0.2, -1), lean: 1 },
  { b: H(1.4, 3.6, 0.6), t: H(0.2, 0.1, 1) },
]);

/**
 * Firebreath: a hand to the jug, a long swig with his head back, cheeks
 * bulging as he stows it, a flint struck in his fingers, and the mouthful
 * sprayed out through the flame.
 */
const breathing = action([
  { a: H(0.6, 6.4, -4.4), aSide: H(-1, 0, -4.2), jug: true, breath: 1 },
  { a: H(2.2, 2.0, 4.4), aSide: H(2.4, 0, 4.6), jug: true, tip: 1, headY: -1, lean: -1 },
  { a: H(2.2, 1.8, 4.8), aSide: H(2.2, 0, 5), jug: true, tip: 1, headY: -1, lean: -1, blink: true },
  { a: H(1.0, 6.2, -3.6), aSide: H(-0.6, 0, -3.4), puffed: true, breath: 1 },
  { a: H(3.2, 1.8, 2.6), aSide: H(3.6, 0, 3), puffed: true, flame: 0.7 },
  { a: H(3.6, 2.2, 2.2), aSide: H(4, 0, 2.6), open: true, flame: 1, lean: 1, step: 1 },
  { a: H(3.6, 2.4, 2.0), aSide: H(4, 0, 2.4), open: true, flame: 1, lean: 2, step: 1, breath: 1 },
  { a: H(3.4, 2.6, 1.8), aSide: H(3.8, 0, 2.2), open: true, flame: 0.8, lean: 1, step: 1 },
  { a: H(1.6, 5.4, -2), lean: 0, steam: 0.4 },
]);

/**
 * Rolling Thunder's heave (the Special's pose, and the select screen's): the
 * keg hauled up from his feet, hoisted overhead, a lean back, and bowled out
 * low along the ground.
 */
const heave = action([
  { a: H(2.6, 4.2, -6.4), b: H(2.6, 4.2, -6.4), aSide: H(2.6, 0, -6.2), bSide: H(3, 0, -6.2), keg: true, paddle: false, breath: 2 },
  { a: H(2.6, 4.2, -1.8), b: H(2.6, 4.2, -1.8), aSide: H(2.6, 0, -1.4), bSide: H(3, 0, -1.4), keg: true, paddle: false, breath: 1 },
  { a: H(0.6, 4.2, 7.8), b: H(0.6, 4.2, 7.8), aSide: H(0.6, 0, 8), bSide: H(1, 0, 8), keg: true, paddle: false, lift: 1, steam: 0.6 },
  { a: H(-0.8, 4.2, 8.6), b: H(-0.8, 4.2, 8.6), aSide: H(-0.6, 0, 8.6), bSide: H(-0.2, 0, 8.6), keg: true, paddle: false, lean: -2, steam: 1 },
  { a: H(4.4, 4.2, -2.8), b: H(4.4, 4.2, -2.8), aSide: H(5, 0, -2.6), bSide: H(5.4, 0, -2.6), keg: true, paddle: false, lean: 2, step: 1, breath: 2 },
  { a: H(5, 5.6, -0.6), b: H(5, 5.6, -0.6), aSide: H(5.4, 0, -0.4), bSide: H(5.8, 0, -0.4), paddle: false, lean: 2, step: 1, breath: 1, steam: 0.5 },
  { a: H(2.4, 6.2, -2.6), b: H(2.4, 5, -1), aSide: H(2.6, 0, -2.4), bSide: H(3, 0, -1), paddle: false, lean: 1, step: 1 },
]);

// ---------------------------------------------------------------------------
// The idle moment (`rest`), facing us when he has stood still a while. It
// starts and ends on idle's first frame, so it slips in and out unseen.

/** Idle's first frame, with changes. */
const still = (o: Partial<Pose> = {}): Pose => ({ ...idle('down')[0], ...o });

/**
 * A quiet swig: he unhooks the jug, uncorks it, tips his head back and
 * drinks deep, wipes his beard with his forearm, hangs it back, lets out a
 * burp that puffs foam off his beard, pats his belly twice, and the still
 * on his back sighs a puff of steam as he settles, eyes shut, content.
 */
function swig(view: View): Pose[] {
  if (view !== 'down') return [];
  return [
    still(),
    still({ breath: 1, a: H(0.6, 6.4, -4.4), jug: true, tick: 1 }),
    still({ a: H(2.2, 3.4, 1.2), jug: true, tick: 2 }),
    still({ a: H(2.2, 2.0, 4.4), jug: true, tip: 1, headY: -1, blink: true, tick: 3 }),
    still({ a: H(2.2, 1.8, 4.8), jug: true, tip: 1, headY: -1, breath: 1, blink: true, tick: 4 }),
    still({ a: H(2.2, 3.6, 0.6), jug: true, tick: 5 }),
    still({ a: H(1.8, 0.4, 2.6), jug: true, headY: 1, tick: 6 }),
    still({ a: H(0.8, 6.4, -4.2), tick: 7 }),
    still({ lift: 1, burp: 1, headY: -1, tick: 8 }),
    still({ burp: 2, headY: -1, tick: 9 }),
    still({ burp: 3, tick: 10 }),
    still({ a: H(2.6, 3.0, -3.4), breath: 1, tick: 11 }),
    still({ a: H(2.6, 3.0, -2.6), tick: 12 }),
    still({ blink: true, steam: 0.9, tick: 13 }),
    still({ blink: true, steam: 0.5, breath: 1, tick: 14 }),
  ];
}
const SWIG_ORDER = [0, 1, 2, 3, 4, 3, 4, 4, 5, 6, 6, 7, 0, 8, 9, 10, 0, 11, 12, 11, 12, 13, 14, 14, 0];

// ---------------------------------------------------------------------------
// Frame generation

export type BrewAnim = 'idle' | 'walk' | 'swing' | 'swing2' | 'slam' | 'breath' | 'heave' | 'rest';

export interface BrewAnimDef {
  name: BrewAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Frames played in this order, some held or repeated. */
  order?: readonly number[];
}

/** The firebreath played with its spitting frames rocked to and fro, so the fire pours a while; the fire runs from the 6th step to the last but one. */
export const BREATH_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 6, 7, 6, 7, 8] as const;

export const BREW_ANIMS: BrewAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 9, loop: true, poses: walk },
  { name: 'swing', fps: BREW_FPS.swing, loop: false, poses: swing },
  { name: 'swing2', fps: BREW_FPS.swing2, loop: false, poses: swing2 },
  { name: 'slam', fps: BREW_FPS.slam, loop: false, poses: slam },
  { name: 'breath', fps: BREW_FPS.breath, loop: false, poses: breathing, order: BREATH_ORDER },
  { name: 'heave', fps: BREW_FPS.heave, loop: false, poses: heave },
  { name: 'rest', fps: REST_FPS, loop: false, poses: swig, order: SWIG_ORDER },
];

/** Frames in each move, and the frame each one lands on (the paddle connects, the fire leaves him). */
export const BREW_FRAMES = { swing: 4, swing2: 4, slam: 6, breath: 9 } as const;
export const BREW_RELEASE = { swing: 1, swing2: 1, slam: 2, breath: 5 } as const;

export interface BrewFrame {
  key: string;
  anim: BrewAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawBrewFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(BREW_W, BREW_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildBrewFrames(look: BrewLook = BREW_LOOK): BrewFrame[] {
  S = look;
  const out: BrewFrame[] = [];
  for (const a of BREW_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawBrewFrame(dir, pose) });
      });
    }
  }
  S = BREW_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// The keg, rolling

export const KEG_SIZE = 30;
/** Where the keg touches the ground, from the top of its frame. */
export const KEG_FOOT = 25;
/** Headings over half a turn (a keg rolling one way looks like one rolling back the other), and roll frames over a whole turn. */
export const KEG_HEADINGS = 8;
export const KEG_ROLLS = 8;
/** The keg's radius and half its length, world px. */
export const KEG_R = 6.4;
const KEG_HALF = 7.6;
/** How the ground and heights are drawn: ground depth squashed, heights as they are. */
const GROUND_SQ = 0.6;
/** The eye looks down at the ground this steeply (for what faces it and how it's lit). */
const VIEW: Vec3 = { x: 0, y: 0.6, z: 0.8 };

/**
 * The great keg lying on its side, rolling the way `heading` points
 * (0..KEG_HEADINGS over half a turn from east), turned `roll` frames of a
 * whole revolution: oak staves, two pairs of hoops (copper, or the Jarl's
 * gold), its heads with their boards and chime, and a brass bung that comes
 * round as it rolls. Sampled as a solid and lit like any sprite.
 */
export function kegFrame(heading: number, roll: number, look: BrewLook = BREW_LOOK): PixelCanvas {
  const c = new PixelCanvas(KEG_SIZE, KEG_SIZE);
  const th = (heading / KEG_HEADINGS) * Math.PI;
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  // Its axis lies across the way it rolls.
  const ax = -uy;
  const ay = ux;
  const spin = (roll / KEG_ROLLS) * Math.PI * 2;
  const wood = look.jarl ? HONEY_OAK : OAK;
  const hoop = look.jarl ? GOLD : COPPER;
  const head: Material = { ...wood, bias: 1 };
  const STAVES = 12;
  const pts: { x: number; y: number; d: number; m: Material; n: Vec3; bias: number }[] = [];
  const toScreen = (gx: number, gy: number, z: number) => ({ x: KEG_SIZE / 2 + gx, y: KEG_FOOT + gy * GROUND_SQ - z, d: gy * VIEW.y + z * VIEW.z });
  // The eye's frame for a world normal: x right, y up the screen, z towards the eye.
  const lit = (nx: number, ny: number, nz: number): Vec3 => ({ x: nx, y: nz * 0.8 - ny * 0.6, z: nz * 0.6 + ny * 0.8 });
  const facing = (nx: number, ny: number, nz: number) => nx * VIEW.x + ny * VIEW.y + nz * VIEW.z > -0.05;
  const radius = (a: number) => KEG_R * (1 - 0.1 * (a / KEG_HALF) ** 2);

  // The body: around the axis, along it.
  for (let a = -KEG_HALF; a <= KEG_HALF; a += 0.3) {
    const r = radius(a);
    const steps = Math.ceil(r * Math.PI * 2 * 3);
    for (let i = 0; i < steps; i++) {
      const phi = (i / steps) * Math.PI * 2;
      const nx = ux * Math.cos(phi);
      const ny = uy * Math.cos(phi);
      const nz = Math.sin(phi);
      if (!facing(nx, ny, nz)) continue;
      const gx = ax * a + nx * r;
      const gy = ay * a + ny * r;
      const s = toScreen(gx, gy, KEG_R + nz * r);
      const q = Math.abs(a) / KEG_HALF;
      const isHoop = Math.abs(q - 0.5) < 0.08 || Math.abs(q - 0.88) < 0.07;
      // The stave a point is on turns with the roll.
      const turn = (((phi - spin) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const seam = ((turn / (Math.PI * 2)) * STAVES) % 1 < 0.14;
      const bung = Math.abs(a) < 0.9 && Math.abs(turn - Math.PI * 0.5) < 0.22;
      const m = bung ? BRASS : isHoop ? hoop : wood;
      // The bulge leans its normal a touch out along the axis towards the heads.
      const lean = -(a / KEG_HALF) * 0.25;
      const n = lit(nx + ax * lean, ny + ay * lean, nz);
      pts.push({ ...s, m, n, bias: seam && m === wood ? -1 : 0 });
    }
  }
  // The head that faces the eye: boards across it turning with the roll, a darker chime round its edge.
  for (const sgn of [-1, 1]) {
    const hnx = ax * sgn;
    const hny = ay * sgn;
    if (!facing(hnx, hny, 0)) continue;
    const r = radius(KEG_HALF);
    for (let rr = 0; rr <= r; rr += 0.3) {
      const steps = Math.max(6, Math.ceil(rr * Math.PI * 2 * 3));
      for (let i = 0; i < steps; i++) {
        const psi = (i / steps) * Math.PI * 2;
        const cx = Math.cos(psi) * rr;
        const cz = Math.sin(psi) * rr;
        const gx = ax * KEG_HALF * sgn + ux * cx;
        const gy = ay * KEG_HALF * sgn + uy * cx;
        const s = toScreen(gx, gy, KEG_R + cz);
        // Boards: bands across the head, at the roll's angle.
        const along = Math.cos(psi - spin) * rr;
        const board = Math.abs(((along / 2.6) % 1 + 1) % 1) < 0.18;
        const chime = rr > r - 1.1;
        const tap = !look.jarl && Math.abs(Math.cos(psi + spin) * rr) < 0.8 && Math.abs(Math.sin(psi + spin) * rr + 3.2) < 0.8;
        const m = tap ? BRASS : chime ? hoop : head;
        pts.push({ ...s, d: s.d + 0.01, m, n: lit(hnx * 0.9 + ux * (cx / r) * 0.2, hny * 0.9 + uy * (cx / r) * 0.2, (cz / r) * 0.2), bias: board && m === head ? -1 : 0 });
      }
    }
  }
  pts.sort((p, q) => p.d - q.d);
  c.part();
  for (const p of pts) c.px(p.x, p.y, p.m, p.n, { bias: p.bias });
  return c;
}

/** The keg's frame for a roll the way (dx, dy) goes, `turns` revolutions in. */
export function kegFrameName(dx: number, dy: number, turns: number): string {
  let a = Math.atan2(dy, dx);
  let back = false;
  if (a < 0) {
    a += Math.PI;
    back = true;
  }
  const h = Math.round((a / Math.PI) * KEG_HEADINGS) % KEG_HEADINGS;
  // Past half a turn of heading the keg is drawn from its other side, so it rolls the other way round.
  const wrapped = Math.round((a / Math.PI) * KEG_HEADINGS) >= KEG_HEADINGS;
  const k = Math.floor((((turns % 1) + 1) % 1) * KEG_ROLLS) % KEG_ROLLS;
  const r = back !== wrapped ? (KEG_ROLLS - k) % KEG_ROLLS : k;
  return `h${h}_${r}`;
}

/** Every keg frame, for the textures. */
export function kegFrames(look: BrewLook): { name: string; canvas: PixelCanvas }[] {
  const out: { name: string; canvas: PixelCanvas }[] = [];
  for (let h = 0; h < KEG_HEADINGS; h++) for (let r = 0; r < KEG_ROLLS; r++) out.push({ name: `h${h}_${r}`, canvas: kegFrame(h, r, look) });
  return out;
}

/** The keg's texture key for a look. */
export const kegKey = (look: BrewLook): string => `keg_${look.key}`;

// ---------------------------------------------------------------------------
// Button icons

/** The attack: the mash paddle swung across, foam flying off its blade. */
export function paddleIcon(look: BrewLook = BREW_LOOK): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const wood = ['#ead0a0', '#c8a066', '#9c7440', '#6a4822'];
  const holes: [number, number][] = [];
  // Measured along the paddle from its butt at the lower left, and across it.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const ox = x + 0.5 - 2;
      const oy = y + 0.5 - 14;
      const along = (ox - oy) / Math.SQRT2;
      const across = (ox + oy) / Math.SQRT2;
      const handle = along >= -0.4 && along <= 9.6 && Math.abs(across) <= 0.75;
      const tipR = along > 15.4 ? Math.sqrt(Math.max(0, 1 - ((along - 15.4) / 1.8) ** 2)) : 1;
      const neck = along < 10.6 ? 0.55 + (along - 9) * 1.15 : 1;
      const blade = along >= 9 && along <= 17.2 && Math.abs(across) <= 2.5 * Math.min(neck, tipR);
      if (!handle && !blade) continue;
      const lit = across < -0.9 ? 0 : across > 1 ? 2 : 1;
      put(x, y, blade ? wood[lit] : wood[Math.min(3, lit + 1)]);
      if (blade && Math.abs(across) < 0.6 && (Math.abs(along - 12.2) < 0.6 || Math.abs(along - 14.8) < 0.6)) holes.push([x, y]);
    }
  }
  // The knob at its butt.
  put(1, 14, wood[3]);
  put(1, 15, wood[3]);
  put(2, 15, wood[2]);
  outline('#140a04');
  for (const [x, y] of holes) put(x, y, '#2a1a0c');
  // Foam flicking off its blade.
  const foam = look.jarl ? ['#fffaea', '#f6e8bc', '#e8c870'] : ['#ffffff', '#f4eedc', '#d8c8a0'];
  for (const [x, y, c] of [[15, 6, 0], [14, 8, 1], [15, 9, 2], [8, 1, 0], [6, 2, 1], [5, 0, 2], [12, 11, 1]] as const) put(x, y, foam[c]);
  return px;
}

/** The ability: the jug (or the Jarl's horn) tipped up, and a gout of fire bursting from its mouth. */
export function fireIcon(look: BrewLook = BREW_LOOK): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  if (look.jarl) {
    // The horn: from its point at the lower left, curving and widening up to a gold-rimmed mouth.
    const horn = ['#f4ead0', '#d6c29a', '#a88c66', '#6a5236'];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const cx = 1.6 + t * 6.4 + Math.sin(t * Math.PI) * 1.4;
      const cy = 14.4 - t * 6.6 + Math.sin(t * Math.PI) * 1.4;
      const r = 0.45 + 1.75 * t ** 1.2;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d > r) continue;
          const lit = x + 0.5 - cx - (y + 0.5 - cy);
          put(x, y, t > 0.96 ? (lit < 0 ? '#ffe27a' : '#d0961e') : horn[lit < -0.9 * r ? 0 : lit < 0.1 * r ? 1 : t < 0.35 ? 3 : 2]);
        }
      }
    }
  } else {
    const clay = ['#e0ac74', '#c0824a', '#94592e', '#62391e'];
    for (let y = 7; y < 16; y++) for (let x = 0; x < 9; x++) if (Math.hypot(x + 0.5 - 4.2, y + 0.5 - 11.4) <= 3.6) put(x, y, x - y < -9 ? clay[2] : x + y < 13 ? clay[0] : x + y < 17 ? clay[1] : clay[2]);
    // Its neck up to the right, and the green glaze dripping round its shoulder.
    for (const [x, y] of [[6, 8], [7, 7], [7, 8], [8, 6]]) put(x, y, clay[1]);
    for (const [x, y] of [[2, 9], [3, 8], [4, 8], [1, 10]]) put(x, y, '#6a8a5a');
    put(3, 9, '#98b884');
  }
  outline('#140a04');
  // The fire, bursting out along the upper right from the mouth.
  const fl = look.jarl ? ['#ffffff', '#c8e8ff', '#5a9cff', '#2a5ad8'] : ['#fff8e0', '#ffc848', '#ff7a1a', '#c03a10'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 9;
      const dy = y + 0.5 - 6.4;
      const along = (dx - dy) / Math.SQRT2;
      const across = (dx + dy) / Math.SQRT2;
      if (along < 0 || along > 8.6) continue;
      const w = 0.8 + along * 0.5 - Math.max(0, along - 7) * 0.9;
      const a = Math.abs(across);
      if (a > w) continue;
      const k = a / w + along / 14;
      put(x, y, k < 0.35 ? fl[0] : k < 0.65 ? fl[1] : k < 0.95 ? fl[2] : fl[3]);
    }
  }
  // Embers flung past the gout.
  for (const [x, y, c] of [[15, 5, 2], [11, 0, 2], [14, 1, 1]] as const) put(x, y, fl[c]);
  return px;
}
