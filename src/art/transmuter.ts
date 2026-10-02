// The Transmuter, drawn procedurally from a small rig like the alchemist's.
//
// A scholar of the Great Work who turns flesh to metal: a slim woman in a
// long deep-teal scholar's robe, closed down the front with brass frog
// clasps, a high standing collar, and an ivory stole hung round her neck and
// down her front, stitched with sigils that glow faintly. Silver hair swept
// up into a bun pinned with a brass stylus, a brass monocle on her left eye
// on a fine chain, a leather satchel of chalk at her hip. Her right hand is a
// brass gauntlet set with the philosopher's stone, which glows; quicksilver
// gathers over its palm when she flicks it. On her back, the squared circle
// in glowing thread.
//
// Rubedo, the red stage of the Work, is her other look: a crimson robe under
// a stole of cloth of gold, copper hair, a rose-gold gauntlet set with a ruby,
// and everything she makes burns red and gold.
//
// The body keeps to the 24x32 box; frames are larger so raised arms fit.
// Drawing functions work in body-box coordinates. Hands are posed in the
// rig's own terms (forward, out to the side, height) and placed per view, so
// one set of keyframes serves every direction.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { BOOT, EYE, LEATHER, SKIN, TROUSER } from './palette';
import { DIRS, type Dir } from './wizard';
import { iconPainter } from './effects';

export const TRANS_W = 48;
export const TRANS_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const TRANS_ORIGIN_X = BODY_X + 12;
export const TRANS_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet a bead of quicksilver leaves the hand at. */
export const TRANS_HAND_Y = 15;
/** The idle moment's pace. */
const REST_FPS = 8;

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------------------
// Materials

const TEAL_ROBE: Material = { ramp: ramp('#06171b', '#0d2b31', '#154349', '#1e5d62', '#2c7a7b'), outline: hex('#030a0c'), outlineLit: hex('#0a1e22') };
const IVORY_STOLE: Material = { ramp: ramp('#6a604c', '#a4987c', '#d4caac', '#efe8d2', '#fffaec'), outline: hex('#26201a'), outlineLit: hex('#3a3428') };
const TEAL_SIGIL: Material = { ramp: ramp('#14605e', '#24a29c', '#6ae6d8', '#d0fff6'), outline: hex('#04201e'), emissive: 0.55, noAO: true };
const BRASS: Material = { ramp: ramp('#3a2210', '#6a4418', '#a8742a', '#dcae4a', '#fff0b0'), outline: hex('#1e1006'), shine: true, noAO: true };
const GAUNTLET: Material = { ramp: ramp('#2e1a0c', '#5c3a16', '#946226', '#c89640', '#f0d482'), outline: hex('#160a04'), outlineLit: hex('#2a1608'), shine: true };
const QUICK_STONE: Material = { ramp: ramp('#2a6a8a', '#5ab8e0', '#bff0ff', '#ffffff'), outline: hex('#0a2230'), emissive: 1, noAO: true, shine: true };
const ASH_HAIR: Material = { ramp: ramp('#45495a', '#71768a', '#a3a9bc', '#d6dae6', '#f4f6fc'), outline: hex('#1a1c28'), outlineLit: hex('#303246') };
const MERCURY: Material = { ramp: ramp('#2e3644', '#5e6a7e', '#9eaabe', '#dce4f0', '#ffffff'), outline: hex('#10141c'), shine: true, emissive: 0.2, noAO: true };
const LENS: Material = { ramp: ramp('#5a8aa0', '#a8d8ea', '#eaffff'), outline: hex('#0c1c24'), emissive: 0.45, noAO: true, shine: true };
const CHALK: Material = { ramp: ramp('#8a8a92', '#cacad2', '#f4f4fa'), outline: hex('#2a2a32'), noAO: true };

const CRIMSON_ROBE: Material = { ramp: ramp('#1e0308', '#3c0812', '#62101e', '#8c1c28', '#b63234'), outline: hex('#0e0204'), outlineLit: hex('#26060c') };
const GOLD_STOLE: Material = { ramp: ramp('#4a2e0e', '#86601e', '#c49a36', '#ecc85e', '#fff2aa'), outline: hex('#22140a'), outlineLit: hex('#382210') };
const RED_SIGIL: Material = { ramp: ramp('#6a0a10', '#c0202a', '#ff6a50', '#ffdcc4'), outline: hex('#200204'), emissive: 0.6, noAO: true };
const ROSE_GOLD: Material = { ramp: ramp('#3a160e', '#743620', '#b2643e', '#e29c6c', '#ffdcc0'), outline: hex('#180804'), outlineLit: hex('#2c120a'), shine: true };
const RUBY: Material = { ramp: ramp('#5a0610', '#b0182a', '#ff4a50', '#ffd8d0'), outline: hex('#200206'), emissive: 1, noAO: true, shine: true };
const COPPER_HAIR: Material = { ramp: ramp('#360f05', '#68200e', '#a03c1a', '#d06a34', '#f09a5c'), outline: hex('#140502'), outlineLit: hex('#28100a') };
const RED_MERCURY: Material = { ramp: ramp('#3a0610', '#7a1220', '#c02a36', '#ff8080', '#ffe4e0'), outline: hex('#180206'), shine: true, emissive: 0.3, noAO: true };

// ---------------------------------------------------------------------------
// Looks

/** One look for the Transmuter: its texture key, its cloth and metals, and the light of her stone. */
export interface TransmuterLook {
  key: string;
  robe: Material;
  stole: Material;
  sigil: Material;
  /** Clasps, the monocle's rim and chain, the hair's stylus. */
  brass: Material;
  gauntlet: Material;
  stone: Material;
  hair: Material;
  mercury: Material;
  /** The stone's light, brightest first. */
  light: [RGB, RGB, RGB, RGB];
}

export const QUICKSILVER_LOOK: TransmuterLook = {
  key: 'transmuter',
  robe: TEAL_ROBE,
  stole: IVORY_STOLE,
  sigil: TEAL_SIGIL,
  brass: BRASS,
  gauntlet: GAUNTLET,
  stone: QUICK_STONE,
  hair: ASH_HAIR,
  mercury: MERCURY,
  light: [hex('#ffffff'), hex('#c8f4ff'), hex('#6ad0f0'), hex('#2a7a9a')],
};

export const RUBEDO_LOOK: TransmuterLook = {
  key: 'transmuter_rubedo',
  robe: CRIMSON_ROBE,
  stole: GOLD_STOLE,
  sigil: RED_SIGIL,
  brass: BRASS,
  gauntlet: ROSE_GOLD,
  stone: RUBY,
  hair: COPPER_HAIR,
  mercury: RED_MERCURY,
  light: [hex('#fff4e8'), hex('#ffc890'), hex('#ff5a3a'), hex('#9a1420')],
};

export const TRANSMUTER_LOOKS = [QUICKSILVER_LOOK, RUBEDO_LOOK];

/** The look being drawn; set by buildTransmuterFrames. */
let S: TransmuterLook = QUICKSILVER_LOOK;

// ---------------------------------------------------------------------------
// The rig

/** A hand, in the rig's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

export interface Pose {
  /** Whole body raised (walk passing frames). */
  lift: number;
  /** Upper body lowered (a crouch). */
  breath: number;
  /** Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The gauntlet hand (screen left from the front and back, the near arm from the side) and the bare hand. */
  a: Hand;
  b: Hand;
  /** 0..1 how brightly the philosopher's stone burns. */
  stone: number;
  /** A bead of quicksilver over the gauntlet's palm: its radius (0 for none) and how high above the hand. */
  bead: number;
  beadUp: number;
  /** A stick of chalk in the bare hand. */
  chalk?: boolean;
  /** Robe hem swinging behind (side view) or to one side, in pixels. */
  sway: number;
  blink?: boolean;
  /** The monocle catching the light (polished). */
  glint?: boolean;
  /** A ring of sparks over her head (the Great Work gathering). */
  halo?: number;
  /** The head nudged from the body; front view only. */
  headX?: number;
  headY?: number;
}

type View = 'down' | 'up' | 'side';

/** The chest row in body coordinates, the height hands are posed from. */
const CH = 18;
const REACH_FRONT = 4.3;
const REACH_SIDE = 5.0;

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
// Parts

/** The stone's light at (x, y): a hot heart, and a halo that widens as it burns brighter. */
function stoneLight(c: PixelCanvas, x: number, y: number, k: number): void {
  const [core, hot, mid] = S.light;
  c.spark(x, y, core, 0.35 + 0.5 * k);
  if (k < 0.3) return;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) c.spark(x + dx, y + dy, hot, 0.25 + 0.4 * (k - 0.3));
  if (k < 0.75) return;
  for (const [dx, dy] of [[-2, -1], [2, 1], [-1, 2], [1, -2], [2, -2], [-2, 2]] as const) c.spark(x + dx, y + dy, mid, 0.45 * (k - 0.6));
}

/**
 * A bead of quicksilver hanging over the palm at (x, y): a chrome drop, the
 * sky in its top half and the ground in its bottom, a white glint.
 */
function bead(c: PixelCanvas, x: number, y: number, r: number): void {
  c.part();
  c.ellipse(x, y, r, r * 0.92, S.mercury, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy < 0.1 ? dy * 0.6 - 0.35 : dy * 0.9 + 0.2, 1) });
  c.spark(x - r * 0.4, y - r * 0.45, S.light[0], 0.8);
  if (r > 1.2) c.spark(x + r * 0.35, y + r * 0.5, S.light[2], 0.35);
}

/**
 * A sleeved arm from the shoulder, bent at the elbow (towards `hint`). The
 * gauntlet arm ends in a brass bracer and hand with the stone on its back;
 * the other in a bare hand out of an ivory cuff.
 */
function arm(c: PixelCanvas, which: 'a' | 'b', sx: number, sy: number, p: Placed, reach: number, hint: [number, number], pose: Pose, bias = 0): void {
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
  // Where the sleeve ends: most of the way down the forearm.
  const k = which === 'a' ? 0.45 : 0.72;
  const wx = ex + (fx - ex) * k;
  const wy = ey + (fy - ey) * k;
  c.part();
  c.capsule(sx, sy, ex, ey, 1.7, 1.5, S.robe, { bias });
  c.part();
  // The scholar's sleeve widens a little towards its cuff.
  c.capsule(ex, ey, wx, wy, 1.5, 1.65, S.robe, { bias });
  if (which === 'a') {
    // The bracer and the gauntleted hand.
    c.part();
    c.capsule(wx, wy, fx, fy, 1.25, 1.2, S.gauntlet, { bias });
    c.part();
    c.ellipse(fx, fy, 1.45, 1.35, S.gauntlet, { bias: bias + 1 });
    c.part();
    c.px(fx, fy, S.stone, sphere(-0.2, -0.3), { glow: 0.6 + 0.4 * pose.stone });
    stoneLight(c, fx, fy, pose.stone);
    if (pose.bead > 0) bead(c, fx, fy - 2.2 - pose.beadUp, pose.bead);
    return;
  }
  // The ivory cuff, then the bare hand.
  c.part();
  c.ellipse(wx, wy, 1.4, 1.2, S.stole, { bias });
  c.part();
  if (pose.chalk) {
    // A stick of chalk held out past the fingers, the way the hand reaches.
    const l = Math.hypot(fx - ex, fy - ey) || 1;
    const ux = (fx - ex) / l;
    const uy = (fy - ey) / l;
    c.line(fx + ux * 1.2, fy + uy * 1.2, fx + ux * 2.6, fy + uy * 2.6, CHALK, () => sphere(-0.3, -0.4));
  }
  c.ellipse(fx, fy, 1.15, 1.1, SKIN, { bias });
}

function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  c.part();
  c.capsule(hx, hy, fx, fy, 1.35, 1.2, TROUSER, { bias });
}

/** A slim black boot, the toe turned towards the viewer or forward. */
function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x, y, 2.0, 1.15, BOOT, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.45, 1.25, BOOT, { flatten: 0.8, bias });
}

/** The robe's outline: slim at the chest, a little in at the waist, then falling wider to the ankle. */
function robeWidth(y: number, top: number, waist: number, hem: number, chest: number): number {
  if (y <= waist) {
    const u = (y + 0.5 - top) / (waist - top);
    return chest - 0.6 * u * u;
  }
  const u = (y + 0.5 - waist) / (hem - waist);
  return chest - 0.6 + 1.3 * u;
}

/** A sigil stitched on the stole: a pixel of glowing thread and its light. */
function sigil(c: PixelCanvas, x: number, y: number): void {
  c.px(x, y, S.sigil, sphere(0, 0));
  c.spark(x, y, S.light[2], 0.22);
}

/** The bun, pinned through with a brass stylus that pokes out either side. */
function bun(c: PixelCanvas, x: number, y: number, view: View): void {
  c.part();
  c.ellipse(x, y, view === 'side' ? 1.7 : 1.9, 1.6, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  // A twist of hair round it.
  c.shade(x - 0.5, y - 0.6, 1);
  c.shade(x + 0.6, y + 0.4, -1);
  // The stylus, pushed through it and poking out at a slant.
  c.part();
  if (view === 'side') c.line(x + 1.6, y - 2.4, x + 0.4, y - 0.6, S.brass, () => sphere(0.3, -0.5));
  else if (view === 'up') c.line(x + 2.6, y - 2.2, x + 1.2, y - 1.0, S.brass, () => sphere(0.3, -0.5));
  else c.line(x - 2.6, y - 2.2, x - 1.2, y - 1.0, S.brass, () => sphere(-0.3, -0.5));
}

// ---------------------------------------------------------------------------
// Directions

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const armA = () => arm(c, 'a', 7.8, 16.3 + U, fa, REACH_FRONT, [-0.4, 1], p, fa.behind ? -1 : 0);
  const armB = () => arm(c, 'b', 16.2, 16.3 + U, fb, REACH_FRONT, [0.4, 1], p, fb.behind ? -1 : 0);
  // Everything above the collar, drawn nudged by the pose's head offset.
  const head = (draw: () => void) => {
    c.offset(BODY_X + (p.headX ?? 0), BODY_Y + (p.headY ?? 0));
    draw();
    c.offset(BODY_X, BODY_Y);
  };
  if (fa.behind) armA();
  if (fb.behind) armB();

  leg(c, 10.6, 25.5 + L, 10.4, 28.4 - p.footA);
  leg(c, 13.4, 25.5 + L, 13.6, 28.4 - p.footB);
  boot(c, 10.4, 29.6 - p.footA);
  boot(c, 13.6, 29.6 - p.footB);

  // The robe, to the ankle, parted a little below the waist.
  const top = 15 + U;
  const waist = 21 + U;
  const hem = 28 + L;
  const sw = (y: number) => (y > waist ? ((y - waist) / (hem - waist)) * p.sway : 0);
  c.part();
  c.shape(top, hem, (y) => {
    const hw = robeWidth(y, top, waist, hem, 4.3);
    return [cx - hw + sw(y), cx + hw + sw(y)];
  }, S.robe, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.2, 1));
  for (let y = waist + 2; y <= hem; y++) {
    c.shade(cx - 1 + Math.round(sw(y)), y, -1);
    c.shade(cx + Math.round(sw(y)), y, -2);
  }
  // A thin belt, under the stole.
  c.part();
  c.shape(waist, waist, () => [cx - 3.8, cx + 3.8], LEATHER, (_x, _y, t) => cyl(t, 0));

  // The stole, down either side of the clasps, sigils stitched along it and a brass-tipped end.
  const end = 26 + L;
  for (const x0 of [9, 13]) {
    c.part();
    c.shape(top, end, (y) => [x0 + sw(y) * 0.5, x0 + 2 + sw(y) * 0.5], S.stole, (_x, _y, t, u) => sphere(t * 0.6, u * 0.4 - 0.25, 1));
    c.part();
    const inner = x0 === 9 ? 10 : 13;
    for (let y = top + 2, i = 0; y < end - 1; y += 3, i++) sigil(c, (i % 2 ? inner : x0 === 9 ? 9 : 14) + Math.round(sw(y) * 0.5), y);
    c.shape(end, end, () => [x0 + sw(end) * 0.5, x0 + 2 + sw(end) * 0.5], S.brass, (_x, _y, t) => cyl(t, 0.4));
    c.px(inner + Math.round(sw(end) * 0.5), end + 1, S.stole, sphere(0, 0.5), { bias: -1 });
  }
  // Brass frog clasps down the front.
  c.part();
  for (const y of [top + 1, top + 3, top + 5]) {
    c.px(cx - 1, y, S.brass, sphere(-0.4, -0.3));
    c.px(cx, y, S.brass, sphere(0.4, -0.3), { bias: -1 });
  }

  // The satchel at her left hip, chalk poking out under the flap.
  c.part();
  c.px(16, waist - 1, CHALK, sphere(-0.2, -0.6));
  c.px(17, waist - 2, CHALK, sphere(0.2, -0.6));
  c.part();
  c.shape(waist, waist + 3, () => [15.2, 18.6], LEATHER, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.4, 1));
  c.part();
  c.shape(waist, waist + 1, () => [15.0, 18.8], LEATHER, (_x, _y, t) => cyl(t, 0.4), { bias: 1 });
  c.px(17, waist + 1, S.brass, sphere(0, -0.3));

  // The standing collar behind her head.
  c.part();
  c.shape(13 + U, 14 + U, () => [cx - 3.5, cx + 3.5], S.robe, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.4, 1), { bias: 1 });

  head(() => {
    bun(c, cx, 7.2 + U, 'down');
    c.part();
    c.ellipse(cx, 12.1 + U, 2.6, 2.5, SKIN);
    // Hair swept back from the brow, a lock left at each temple.
    c.part();
    c.shape(8 + U, 9 + U, (y) => {
      const hw = [2.4, 3.0][y - 8 - U];
      return [cx - hw, cx + hw];
    }, S.hair, (x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.6 + ((x & 1) === 0 ? 0.1 : -0.1), 1));
    c.shade(cx - 1, 9 + U, 1);
    c.shade(cx + 1, 8 + U, 1);
    c.part();
    c.shape(10 + U, 13 + U, (y) => (y === 10 + U ? [cx - 3.2, cx - 1.2] : [cx - 3.2, cx - 2.2]), S.hair, (_x, _y, _t, u) => sphere(-0.7, u * 0.6 - 0.2, 1));
    c.shape(10 + U, 12 + U, (y) => (y === 10 + U ? [cx + 1.2, cx + 3.2] : [cx + 2.2, cx + 3.2]), S.hair, (_x, _y, _t, u) => sphere(0.7, u * 0.6 - 0.2, 1));
    // Brows, eyes, a fine nose and a thin mouth.
    c.part();
    c.px(10, 11 + U, S.hair, sphere(-0.2, -0.5), { bias: -1 });
    c.px(13, 11 + U, S.hair, sphere(0.2, -0.5), { bias: -1 });
    if (p.blink) {
      c.shade(10, 12 + U, -1);
      c.shade(13, 12 + U, -1);
    } else c.px(10, 12 + U, EYE);
    c.shade(cx, 13 + U, 1);
    c.shade(cx - 1, 14 + U, -1);
    c.shade(cx, 14 + U, -1);
    // The monocle over her left eye, its rim and a chain down to the collar.
    c.part();
    c.px(13, 12 + U, LENS, sphere(-0.3, -0.3), { glow: p.blink ? 0.2 : 0.45 });
    c.px(14, 12 + U, S.brass, sphere(0.6, 0));
    c.px(14, 13 + U, S.brass, sphere(0.6, 0.3), { bias: -1 });
    c.px(15, 14 + U, S.brass, sphere(0.4, 0.4), { bias: -1 });
    c.spark(13, 12 + U, S.light[1], p.glint ? 0.9 : 0.3);
    if (p.glint) for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) c.spark(13 + dx, 12 + U + dy, S.light[1], 0.4);
  });
  // The collar's points, standing up either side of the jaw.
  c.part();
  for (const k of [-1, 1]) {
    c.shape(13 + U, 15 + U, (y) => {
      const w = y === 13 + U ? 0.8 : 1.3;
      const x = cx + k * 3.3;
      return [x - w * 0.5 - (k < 0 ? 0.3 : 0), x + w * 0.5 + (k > 0 ? 0.3 : 0)];
    }, S.robe, (_x, _y, t, u) => sphere(t * 0.6 + k * 0.4, u * 0.6 - 0.4, 1), { bias: 1 });
    c.px(cx + k * 3.3 - (k < 0 ? 1 : 0), 13 + U, S.brass, sphere(k * 0.4, -0.6));
  }

  if (!fa.behind) armA();
  if (!fb.behind) armB();
  if (p.halo) halo(c, cx, 2 + U, p.halo);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const armA = () => arm(c, 'a', 7.8, 16.3 + U, fa, REACH_FRONT, [-0.5, 0.8], p, fa.behind ? -1 : 0);
  const armB = () => arm(c, 'b', 16.2, 16.3 + U, fb, REACH_FRONT, [0.5, 0.8], p, fb.behind ? -1 : 0);
  if (fa.behind) armA();
  if (fb.behind) armB();

  leg(c, 10.6, 25.5 + L, 10.4, 28.4 - p.footB);
  leg(c, 13.4, 25.5 + L, 13.6, 28.4 - p.footA);
  boot(c, 10.4, 29.6 - p.footB);
  boot(c, 13.6, 29.6 - p.footA);

  // The robe from behind: a seam down the back, the squared circle stitched between the shoulders.
  const top = 15 + U;
  const waist = 21 + U;
  const hem = 28 + L;
  const sw = (y: number) => (y > waist ? ((y - waist) / (hem - waist)) * p.sway : 0);
  c.part();
  c.shape(top, hem, (y) => {
    const hw = robeWidth(y, top, waist, hem, 4.3);
    return [cx - hw + sw(y), cx + hw + sw(y)];
  }, S.robe, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.2, 1));
  for (let y = waist + 1; y <= hem; y++) c.shade(cx + Math.round(sw(y)), y, y > hem - 3 ? -2 : -1);
  c.part();
  c.shape(waist, waist, () => [cx - 3.8, cx + 3.8], LEATHER, (_x, _y, t) => cyl(t, 0));
  // The squared circle: a ring of glowing thread round a point.
  c.part();
  const gy = top + 3;
  for (const [dx, dy] of [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-1, 2], [0, 2], [1, 2]] as const) c.px(cx + dx, gy + dy, S.sigil, sphere(dx * 0.3, dy * 0.3), { glow: 0.4 });
  sigil(c, cx, gy);
  c.spark(cx, gy, S.light[2], 0.3);

  // The satchel at her left hip, which is to the left from behind.
  c.part();
  c.shape(waist, waist + 3, () => [5.4, 8.8], LEATHER, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.4, 1));
  c.part();
  c.shape(waist, waist + 1, () => [5.2, 9.0], LEATHER, (_x, _y, t) => cyl(t, 0.4), { bias: 1 });

  // The stole round the back of the neck, the collar standing over it, and her hair.
  c.part();
  c.shape(top, top + 1, (y) => (y === top ? [cx - 3.6, cx + 3.6] : [cx - 3.9, cx + 3.9]), S.stole, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
  c.part();
  c.shape(12 + U, 14 + U, (y) => (y === 12 + U ? [cx - 2.9, cx + 2.9] : [cx - 3.4, cx + 3.4]), S.robe, (_x, _y, t, u) => sphere(t * 0.9, u * 0.5 - 0.5, 1), { bias: 1 });
  for (let x = cx - 3; x <= cx + 2; x++) c.px(x, 12 + U, S.brass, sphere((x - cx + 0.5) * 0.25, -0.6), { bias: x === cx - 3 || x === cx + 2 ? -1 : 0 });
  c.part();
  c.ellipse(cx, 10.8 + U, 3.0, 2.7, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.15, 1) });
  // Strands swept up to the bun, a darker nape under them.
  for (const [x, y0] of [[cx - 2, 10], [cx, 9], [cx + 1, 11], [cx - 1, 12]] as const) for (let y = y0; y <= 13; y++) c.shade(x, y + U, -1);
  for (let x = cx - 2; x <= cx + 1; x++) c.shade(x, 13 + U, -1);
  c.shade(cx - 1, 9 + U, 1);
  c.shade(cx + 1, 9 + U, 1);
  bun(c, cx, 7.6 + U, 'up');

  if (!fa.behind) armA();
  if (!fb.behind) armB();
  if (p.halo) halo(c, cx, 2 + U, p.halo);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean;
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);

  // The far arm, behind everything.
  arm(c, 'b', hx + 1.2, 16.6 + U, fb, REACH_SIDE, [0.3, 1], p, -1);

  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 0.8, 25.5 + L, cx + 1 - p.footB, 28.4 - lift(p.footB), -1);
  boot(c, cx + 0.4 - p.footB, 29.7 - lift(p.footB), true, -1);
  leg(c, cx - 0.6, 25.5 + L, cx - 0.4 - p.footA, 28.4 - lift(p.footA));
  boot(c, cx - 1.2 - p.footA, 29.7 - lift(p.footA), true);

  // The robe in profile, its skirts trailing out behind.
  const top = 15 + U;
  const waist = 21 + U;
  const hem = 28 + L;
  const edge = (y: number): [number, number] => {
    const u = y <= waist ? 0 : (y - waist) / (hem - waist);
    const shift = y <= waist ? hx : hx + (cx - hx) * u;
    const hw = robeWidth(y, top, waist, hem, 3.0);
    return [shift - hw - 0.2, shift + hw + 0.3 + u * p.sway];
  };
  c.part();
  c.shape(top, hem, edge, S.robe, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.2, 1));
  for (let y = waist + 1; y <= hem; y++) c.shade(Math.round(edge(y)[0] + 2), y, -1);
  c.part();
  c.shape(waist, waist, () => [hx - 2.9, hx + 3.0], LEATHER, (_x, _y, t) => cyl(t, 0));
  // The stole down her front edge, sigils along it.
  const end = 26 + L;
  c.part();
  c.shape(top, end, (y) => {
    const [l] = edge(y);
    return [l + 0.2, l + 1.9];
  }, S.stole, (_x, _y, t) => sphere(t * 0.7 - 0.3, 0.1, 1));
  c.part();
  for (let y = top + 2; y < end - 1; y += 3) sigil(c, Math.round(edge(y)[0] + 0.7), y);
  c.shape(end, end, () => {
    const [l] = edge(end);
    return [l + 0.2, l + 1.9];
  }, S.brass, (_x, _y, t) => cyl(t, 0.4));
  // The satchel on her near hip.
  c.part();
  c.px(Math.round(hx + 1), waist - 1, CHALK, sphere(-0.2, -0.6));
  c.part();
  c.shape(waist, waist + 3, () => [hx + 0.2, hx + 3.4], LEATHER, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.4, 1));
  c.part();
  c.shape(waist, waist + 1, () => [hx + 0.0, hx + 3.6], LEATHER, (_x, _y, t) => cyl(t, 0.4), { bias: 1 });
  c.px(Math.round(hx + 1.6), waist + 1, S.brass, sphere(0, -0.3));

  // The collar standing up behind the jaw.
  c.part();
  c.shape(12 + U, 15 + U, (y) => (y === 12 + U ? [hx + 1.2, hx + 2.6] : [hx + 0.6, hx + 3.0]), S.robe, (_x, _y, t, u) => sphere(t * 0.8 + 0.2, u * 0.6 - 0.4, 1), { bias: 1 });
  c.px(Math.round(hx + 1.8), 12 + U, S.brass, sphere(0.2, -0.6));

  // Her head in profile: hair behind, the face, hair swept back over the crown, the bun.
  c.part();
  c.ellipse(hx + 0.9, 11.2 + U, 2.3, 2.6, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8, 1) });
  c.part();
  c.ellipse(hx - 0.6, 12.1 + U, 2.4, 2.4, SKIN);
  c.part();
  c.px(hx - 3.3, 12 + U, SKIN, sphere(-0.6, -0.2), { bias: 1 });
  c.shade(hx - 3, 14 + U, -1);
  c.part();
  c.shape(8 + U, 10 + U, (y) => {
    const r = [[-1.2, 2.6], [-2.4, 3.2], [-2.8, 3.3]][y - 8 - U];
    return [hx + r[0], hx + r[1]];
  }, S.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.6, 1));
  c.px(hx - 3, 11 + U, S.hair, sphere(-0.4, -0.4), { bias: -1 });
  bun(c, hx + 1.9, 7.8 + U, 'side');
  c.part();
  // The eye under its monocle, and the chain falling back to the collar.
  c.px(hx - 2, 12 + U, LENS, sphere(-0.3, -0.3), { glow: p.blink ? 0.2 : 0.45 });
  c.px(hx - 1, 13 + U, S.brass, sphere(0.2, 0.4), { bias: -1 });
  c.px(hx, 14 + U, S.brass, sphere(0.3, 0.4), { bias: -1 });
  c.spark(hx - 2, 12 + U, S.light[1], p.glint ? 0.9 : 0.3);

  arm(c, 'a', hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.3, 1], p);
  if (p.halo) halo(c, hx, 2 + U, p.halo);
}

/** A ring of sparks over her head, turning, for the Great Work gathering: `k` 0..1 how far it has formed. */
function halo(c: PixelCanvas, x: number, y: number, k: number): void {
  const n = 10;
  const [core, hot, mid] = S.light;
  for (let i = 0; i < n; i++) {
    if (i / n > k) break;
    const a = (i / n) * Math.PI * 2 + k * 1.4;
    c.spark(x + Math.cos(a) * 5.5, y + Math.sin(a) * 2.2, i % 3 === 0 ? core : i % 3 === 1 ? hot : mid, 0.55 + 0.35 * k);
  }
  if (k > 0.8) c.spark(x, y, core, 0.9);
}

// ---------------------------------------------------------------------------
// Animations

/** The gauntlet held up before her, stone out; the bare hand resting by the satchel. */
const HOLD_A = H(2.4, 2.8, 0.3);
const HOLD_B = H(0.4, 4.2, -3.4);

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: { ...HOLD_A },
  b: { ...HOLD_B },
  stone: 0.4,
  bead: 0,
  beadUp: 0,
  sway: 0,
});

/** Standing, the stone breathing with her. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.a.h += Math.sin(ph) * 0.4;
    p.sway = Math.sin(ph - 1) * 0.4;
    p.stone = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(ph));
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
    // The gauntlet stays steady; the bare hand swings.
    p.a = H(2.0 + s * 0.4, 3.0, -0.6 + p.lift * 0.4);
    p.b = H(0.6 - s * 1.6, 4.2, -3.4 + p.lift * 0.4);
    frames.push(p);
  }
  return frames;
}

interface Key {
  a?: Hand;
  b?: Hand;
  lean?: number;
  breath?: number;
  step?: number;
  stone?: number;
  bead?: number;
  beadUp?: number;
  chalk?: boolean;
  halo?: number;
}

/** An action as keyframes; anything left out stays at rest. `step` plants the front foot forward. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k) => {
      const p = base(view);
      if (k.a) p.a = { ...k.a };
      if (k.b) p.b = { ...k.b };
      p.breath = k.breath ?? 0;
      p.stone = k.stone ?? 0.4;
      p.bead = k.bead ?? 0;
      p.beadUp = k.beadUp ?? 0;
      p.chalk = k.chalk;
      p.halo = k.halo;
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

/** The flick: quicksilver wells up over the palm, the hand draws back and snaps forward, and the bead flies. */
const flick = action([
  { a: H(1.6, 3.2, 1.2), stone: 0.7, bead: 1.0, beadUp: 0 },
  { a: H(-0.6, 4.0, 3.0), lean: -1, stone: 0.8, bead: 1.4, beadUp: 0.4 },
  { a: H(1.8, 3.2, 3.6), lean: 0, step: 1, stone: 0.9, bead: 1.4, beadUp: 0.2 },
  { a: H(6.6, 1.8, 2.0), b: H(0.2, 4.2, -2.6), lean: 1, step: 1, stone: 1 },
  { a: H(5.6, 2.0, 0.8), b: H(0.3, 4.2, -3), lean: 1, step: 1, stone: 0.7 },
  { a: H(3.4, 2.6, 0.2), stone: 0.5 },
]);

/**
 * The circle: chalk drawn from the satchel, a quick crouch to sweep a circle
 * on the ground ahead, then the gauntlet thrust down at it to kindle it.
 */
const inscribe = action([
  { b: H(0.6, 4.6, -2.6), chalk: true, stone: 0.4 },
  { b: H(2.4, 3.4, 1.2), chalk: true, stone: 0.5 },
  { a: H(1.6, 3.2, 0.8), b: H(5.4, 2.4, -3.6), chalk: true, lean: 1, breath: 1, step: 1, stone: 0.5 },
  { a: H(1.6, 3.2, 0.6), b: H(5.2, -0.6, -4.4), chalk: true, lean: 1, breath: 1, step: 1, stone: 0.6 },
  { a: H(5.6, 2.0, -1.4), b: H(1.4, 4.0, -2.2), lean: 1, step: 1, stone: 1 },
  { a: H(5.8, 2.0, -1.0), b: H(0.8, 4.2, -3.0), lean: 1, step: 1, stone: 0.85 },
  { a: H(3.8, 2.4, -0.2), stone: 0.6 },
  { a: H(2.6, 2.8, 0.2), stone: 0.45 },
]);

/** The Great Work: hands together, raised high as a ring of light forms overhead, then spread wide and pressed down. */
const opus = action([
  { a: H(2.6, 1.2, 0.6), b: H(2.6, 1.0, 0.2), stone: 0.6 },
  { a: H(2.2, 1.6, 4.2), b: H(2.2, 1.4, 3.8), stone: 0.75, halo: 0.2 },
  { a: H(0.8, 2.0, 9.0), b: H(0.8, 1.8, 8.6), stone: 0.9, halo: 0.5 },
  { a: H(0.4, 4.8, 8.6), b: H(0.4, 4.8, 8.4), stone: 1, halo: 0.8 },
  { a: H(0.6, 6.0, 5.0), b: H(0.6, 6.0, 4.8), stone: 1, halo: 1 },
  { a: H(1.6, 6.2, 0.6), b: H(1.6, 6.2, 0.4), stone: 1, breath: 1, halo: 1 },
  { a: H(2.4, 5.2, -2.4), b: H(2.4, 5.2, -2.6), stone: 1, breath: 1, step: 1, lean: 1 },
  { a: H(2.4, 5.0, -2.6), b: H(2.4, 5.0, -2.8), stone: 0.8, breath: 1, step: 1, lean: 1 },
]);

// ---------------------------------------------------------------------------
// The idle moment (`rest`), facing the viewer only

/** A pose from the stand (idle frame 0) with the given changes. */
const from = (k: Partial<Pose>): Pose => ({ ...idle('down')[0], ...k });

/**
 * She calls a bead of quicksilver up out of the stone, rolls it on her palm,
 * tosses it up and watches it fall, catches it and lets it sink back into
 * the stone; then she polishes her monocle with a knuckle, and blinks.
 */
const REST: Pose[] = [
  from({}),
  from({ a: H(2.0, 2.2, 1.4), stone: 0.8, bead: 0.8 }),
  from({ a: H(2.0, 2.2, 1.6), stone: 0.7, bead: 1.4, beadUp: 0.4 }),
  from({ a: H(2.0, 2.2, 2.4), stone: 0.6, bead: 1.4, beadUp: 3, headY: -1 }),
  from({ a: H(2.0, 2.2, 1.8), stone: 0.6, bead: 1.4, beadUp: 6.5, headY: -1, breath: 1 }),
  from({ a: H(2.0, 2.2, 1.6), stone: 0.6, bead: 1.4, beadUp: 4.5, headY: -1 }),
  from({ a: H(2.0, 2.2, 0.8), stone: 0.7, bead: 1.4, beadUp: 0.6 }),
  from({ a: H(2.0, 2.2, 1.2), stone: 1, bead: 0.6 }),
  from({ b: H(1.0, 1.2, 6.6), headX: 0, stone: 0.5 }),
  from({ b: H(1.0, 1.7, 6.3), stone: 0.5, glint: true }),
  from({ b: H(1.0, 1.2, 6.7), stone: 0.5 }),
  from({ b: H(0.8, 3.4, 0.2), stone: 0.45, glint: true }),
  from({ stone: 0.45, blink: true }),
];
const REST_ORDER = [0, 1, 2, 2, 3, 4, 4, 5, 6, 7, 7, 0, 0, 8, 9, 10, 9, 10, 11, 0, 12, 0];

function rest(view: View): Pose[] {
  return view === 'down' ? REST : [];
}

// ---------------------------------------------------------------------------
// Frame generation

export type TransmuterAnim = 'idle' | 'walk' | 'flick' | 'inscribe' | 'opus' | 'rest';

export interface TransmuterAnimDef {
  name: TransmuterAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Frame indices to play in sequence, when some are held or repeated. */
  order?: readonly number[];
}

export const TRANSMUTER_ANIMS: TransmuterAnimDef[] = [
  { name: 'idle', fps: 7, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'flick', fps: 16, loop: false, poses: flick },
  { name: 'inscribe', fps: 13, loop: false, poses: inscribe },
  { name: 'opus', fps: 12, loop: false, poses: opus },
  { name: 'rest', fps: REST_FPS, loop: false, poses: rest, order: REST_ORDER },
];

/** Frame index at which the bead leaves the hand, and the circle is kindled. */
export const TRANS_RELEASE = { flick: 3, inscribe: 4 } as const;

export interface TransmuterFrame {
  key: string;
  anim: TransmuterAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawTransmuterFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(TRANS_W, TRANS_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildTransmuterFrames(look: TransmuterLook = QUICKSILVER_LOOK): TransmuterFrame[] {
  S = look;
  const out: TransmuterFrame[] = [];
  for (const a of TRANSMUTER_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawTransmuterFrame(dir, pose) });
      });
    }
  }
  S = QUICKSILVER_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Button icons: 16x16, outlined, lit from the top left

const ICON_INK = '#0a0c10';

/** The colours an icon is painted in, per look. */
interface IconTones {
  /** Quicksilver from lit to shadowed, and its glint. */
  metal: [string, string, string, string];
  glint: string;
  /** The circle's chalk and the glow in its lines, brightest first. */
  glow: [string, string, string, string];
}

const ICON_TONES: Record<string, IconTones> = {
  transmuter: { metal: ['#e4ecf6', '#a8b4c6', '#6a7688', '#363e4c'], glint: '#ffffff', glow: ['#ffffff', '#c8f4ff', '#6ad0f0', '#2a7a9a'] },
  transmuter_rubedo: { metal: ['#ffd8d4', '#ff7a7a', '#c02a36', '#5a0a14'], glint: '#fff4f0', glow: ['#fff4e8', '#ffc890', '#ff5a3a', '#9a1420'] },
};

/** A chrome drop at (cx, cy), radius r: the sky in its top half, the ground in its bottom, a glint. */
function chromeDrop(put: (x: number, y: number, c: string) => void, cx: number, cy: number, r: number, t: IconTones): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = (x + 0.5 - cx) / r;
      const dy = (y + 0.5 - cy) / r;
      const d = Math.hypot(dx, dy);
      if (d > 1) continue;
      // The horizon sits a little below the middle; the rim catches the ground's light.
      const c = dy < 0.1 ? (dx + dy < -0.5 ? t.metal[0] : t.metal[1]) : d > 0.8 && dy > 0.4 ? t.metal[1] : dx > 0.3 ? t.metal[3] : t.metal[2];
      put(x, y, c);
    }
  }
}

/** Quicksilver: a bead of mercury bursting, two smaller beads flying off from it. */
export function quicksilverIcon(key: string): Uint8ClampedArray {
  const t = ICON_TONES[key] ?? ICON_TONES.transmuter;
  const { px, put, outline } = iconPainter();
  chromeDrop(put, 6.5, 9.5, 4.6, t);
  chromeDrop(put, 12.6, 4.2, 2.2, t);
  chromeDrop(put, 13.2, 11.6, 1.8, t);
  outline(ICON_INK);
  put(4, 7, t.glint);
  put(5, 7, t.glint);
  put(4, 8, t.glint);
  put(12, 3, t.glint);
  put(12, 11, t.glint);
  // Droplets thrown between them.
  put(10, 7, t.metal[1]);
  put(11, 9, t.metal[2]);
  return px;
}

/** Transmutation circle: a chalk circle on the ground at a slant, a triangle and a sigil in it, its lines aglow. */
export function circleIcon(key: string): Uint8ClampedArray {
  const t = ICON_TONES[key] ?? ICON_TONES.transmuter;
  const { px, put } = iconPainter();
  const cx = 8;
  const cy = 9;
  const ring = (r: number, c: string, sq = 0.62) => {
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      put(Math.round(cx - 0.5 + Math.cos(a) * r), Math.round(cy - 0.5 + Math.sin(a) * r * sq), c);
    }
  };
  // The glow under the chalk, then the chalk itself.
  ring(7.2, t.glow[3], 0.66);
  ring(6.6, t.glow[0]);
  ring(4.2, t.glow[2]);
  const tri: [number, number][] = [0, 1, 2].map((i) => {
    const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
    return [cx - 0.5 + Math.cos(a) * 4.2, cy - 0.5 + Math.sin(a) * 4.2 * 0.62];
  });
  for (let i = 0; i < 3; i++) {
    const [x0, y0] = tri[i];
    const [x1, y1] = tri[(i + 1) % 3];
    for (let k = 0; k <= 8; k++) put(Math.round(x0 + ((x1 - x0) * k) / 8), Math.round(y0 + ((y1 - y0) * k) / 8), t.glow[1]);
  }
  put(cx - 1, cy - 1, t.glow[0]);
  put(cx, cy - 1, t.glow[0]);
  // Sigils at the quarters of the rim.
  for (const [x, y] of [[1, 8], [14, 8], [7, 4], [8, 13]] as const) put(x, y, t.glow[1]);
  // A spark of the stone rising from its heart.
  put(cx - 1, 2, t.glow[1]);
  put(cx - 1, 3, t.glow[0]);
  put(cx - 2, 3, t.glow[2]);
  put(cx, 3, t.glow[2]);
  return px;
}

/** Registers the Transmuter's button icons (`icon_quicksilver<_look>`, `icon_transmute<_look>`). */
export function registerTransmuterIcons(add: (key: string, px: Uint8ClampedArray) => void): void {
  for (const look of TRANSMUTER_LOOKS) {
    const sfx = look.key === 'transmuter' ? '' : look.key.slice('transmuter'.length);
    add(`icon_quicksilver${sfx}`, quicksilverIcon(look.key));
    add(`icon_transmute${sfx}`, circleIcon(look.key));
  }
}
