// The Aviator, the Inventor class's flyer, drawn procedurally on her own rig.
//
// A daring young flyer who built her own machines: a brown leather flight
// jacket with a shearling collar and a harness over it, a long white silk
// scarf knotted at the throat with its tail thrown back over the shoulder
// (it streams behind her when she runs or flies), a leather flying cap with
// loose ear flaps and brass goggles pushed up on the brow, khaki jodhpurs
// flaring at the thigh and tall riding boots. On her back rides a compact
// jetpack: two brass tanks banded in copper, little fins, a pressure gauge
// between them and two steel nozzles that roar with flame when she hops. In
// her hand, a chunky brass flare pistol.
//
// The Flying Ace is her skin: a crimson jacket, a cream scarf, an oxblood cap
// with silver goggles, cream jodhpurs and black boots, white gauntlets, a
// silver jetpack with red fins, and red-white fire.
//
// The body keeps to the 24x32 box; frames are larger so the scarf, the
// raised pistol and the jet flames fit. Hands are posed in the rig's terms
// (forward, out to the side, height) and placed per view, like the
// Inventor's.
//
// Also here: her biplane for the Special (a top-down sprite in sixteen
// headings, its propeller in two frames), its bombs, and her button icons.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { EYE, SKIN } from './palette';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';
import { BRASS, LENS, STEEL } from './inventor';
import type { FxRegistrar } from './frostKit';

export const AVI_W = 48;
export const AVI_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const AVI_ORIGIN_X = BODY_X + 12;
export const AVI_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet that flares leave the pistol. */
export const AVI_HAND_Y = 15;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#120e1f');

// ---------------------------------------------------------------------------
// Materials

const JACKET: Material = { ramp: ramp('#241008', '#43200e', '#683619', '#8e5228', '#b47644'), outline: hex('#120804'), outlineLit: hex('#2a1408'), shine: true };
const SHEARLING: Material = { ramp: ramp('#5e5040', '#9a8a70', '#cdbd9e', '#ece2c8', '#fffaec'), outline: hex('#2a2218'), outlineLit: hex('#3e3426') };
const SILK: Material = { ramp: ramp('#6c7284', '#a8aebe', '#d8dce6', '#f4f6fa', '#ffffff'), outline: hex('#262a36'), outlineLit: hex('#3a3e4c'), shine: true };
const CAP: Material = { ramp: ramp('#170a04', '#2e170a', '#4a2814', '#6a3e22', '#8a5634'), outline: hex('#0a0402'), shine: true };
const AUBURN: Material = { ramp: ramp('#240a04', '#4e1a0a', '#7c3016', '#a84e24', '#cc7440'), outline: hex('#120402') };
const KHAKI: Material = { ramp: ramp('#2e2616', '#504428', '#7a6a44', '#a09062', '#c4b486'), outline: INK, outlineLit: hex('#1e1a10') };
const RIDING_BOOT: Material = { ramp: ramp('#120804', '#24120a', '#3c2214', '#5a3622', '#7a5034'), outline: hex('#080402'), shine: true };
const GLOVE: Material = { ramp: ramp('#1e1008', '#3a2010', '#5c361c', '#7e502c'), outline: hex('#0e0804'), shine: true };
const HARNESS: Material = { ramp: ramp('#100804', '#22140a', '#382414', '#4e3420'), outline: hex('#080402') };
const COPPER: Material = { ramp: ramp('#2a1208', '#4e2210', '#7a3a1a', '#b0602c', '#e09050'), outline: hex('#140804'), shine: true };
const WOOD_GRIP: Material = { ramp: ramp('#1e0e06', '#3a1e0e', '#5a3218', '#7a4a26'), outline: hex('#0e0602') };
const SMOKE: Material = { ramp: ramp('#3e3a44', '#625e68', '#8a8690', '#b2aeb6', '#d6d2da'), outline: hex('#26232c'), noAO: true };
const MOUTH: Material = { ramp: ramp('#5a1a1e', '#8a2e30', '#b44a48'), outline: hex('#2a0a0c') };

const CRIMSON: Material = { ramp: ramp('#2c0406', '#560a10', '#8a141c', '#be2a2c', '#e8604e'), outline: hex('#140204'), outlineLit: hex('#2a0608'), shine: true };
const CREAM_SILK: Material = { ramp: ramp('#7a6a4c', '#b8a682', '#e2d4b2', '#f8eedc', '#fffcf2'), outline: hex('#2e2618'), outlineLit: hex('#40362a'), shine: true };
const OXBLOOD: Material = { ramp: ramp('#160404', '#320a0a', '#521614', '#722820', '#943c30'), outline: hex('#0a0202'), shine: true };
const GOLDEN_HAIR: Material = { ramp: ramp('#3a2408', '#6e4a14', '#a87a24', '#d8aa3e', '#f4d670'), outline: hex('#1e1204') };
const CREAM_JODHPUR: Material = { ramp: ramp('#4e463a', '#86806e', '#b8b09a', '#dcd6c2', '#f4f0e2'), outline: hex('#1a1812'), outlineLit: hex('#2a2620') };
const BLACK_BOOT: Material = { ramp: ramp('#070608', '#141216', '#26222a', '#3e3844', '#5e5866'), outline: hex('#030204'), shine: true };
const GAUNTLET: Material = { ramp: ramp('#6e6a66', '#aaa6a0', '#d6d2cc', '#f2f0ec', '#ffffff'), outline: hex('#24221e'), shine: true };
const RED_FIN: Material = { ramp: ramp('#360406', '#6a0c10', '#a81a1e', '#dc3a32', '#ff7a62'), outline: hex('#180202'), shine: true };
const RED_PAINT: Material = { ramp: ramp('#3a0406', '#700c10', '#ac1c1c', '#de3c30', '#ff8268'), outline: hex('#1a0204'), shine: true };

// The biplanes.
const CANVAS_YELLOW: Material = { ramp: ramp('#4a3206', '#86600e', '#c49420', '#eec440', '#fff090'), outline: hex('#221602'), outlineLit: hex('#3a2808') };
const VARNISH: Material = { ramp: ramp('#2a1406', '#4c2810', '#74401c', '#9c5e2e', '#c08048'), outline: hex('#140804'), shine: true };
const CANVAS_RED: Material = { ramp: ramp('#340406', '#640a0e', '#9e161a', '#d0302a', '#f4664c'), outline: hex('#160204'), outlineLit: hex('#2a0406') };
const CANVAS_CREAM: Material = { ramp: ramp('#6a5e48', '#a89a7c', '#d8ccae', '#f4ead4', '#fffcf0'), outline: hex('#2a2418'), outlineLit: hex('#3a3226') };
const COCKPIT: Material = { ramp: ramp('#06040a', '#120e16', '#221c26'), outline: hex('#020104') };
const RUBBER: Material = { ramp: ramp('#08080a', '#18181c', '#2a2a30'), outline: hex('#020204') };
const BOMB_IRON: Material = { ramp: ramp('#14161c', '#262a34', '#3e4452', '#5c6474', '#8a94a6'), outline: hex('#06070a'), shine: true };

// ---------------------------------------------------------------------------
// Looks

export interface PlaneParts {
  /** The wings and tailplane's canvas. */
  wing: Material;
  /** The fuselage. */
  body: Material;
  /** Stripes and roundels. */
  trim: Material;
  /** The engine's cowling at the nose. */
  cowl: Material;
}

export interface AviatorLook {
  key: string;
  ace: boolean;
  jacket: Material;
  scarf: Material;
  cap: Material;
  hair: Material;
  jodhpurs: Material;
  boots: Material;
  gloves: Material;
  /** Goggle rims and the jetpack's tanks. */
  goggles: Material;
  tank: Material;
  fin: Material;
  gun: Material;
  /** Flare and jet fire, brightest first. */
  light: [RGB, RGB, RGB, RGB];
  plane: PlaneParts;
}

export const AVIATOR_LOOK: AviatorLook = {
  key: 'aviator',
  ace: false,
  jacket: JACKET,
  scarf: SILK,
  cap: CAP,
  hair: AUBURN,
  jodhpurs: KHAKI,
  boots: RIDING_BOOT,
  gloves: GLOVE,
  goggles: BRASS,
  tank: BRASS,
  fin: COPPER,
  gun: BRASS,
  light: [hex('#fffbe8'), hex('#ffd870'), hex('#ff8a2a'), hex('#c03a1a')],
  plane: { wing: CANVAS_YELLOW, body: VARNISH, trim: VARNISH, cowl: BRASS },
};

export const ACE_LOOK: AviatorLook = {
  key: 'aviator_ace',
  ace: true,
  jacket: CRIMSON,
  scarf: CREAM_SILK,
  cap: OXBLOOD,
  hair: GOLDEN_HAIR,
  jodhpurs: CREAM_JODHPUR,
  boots: BLACK_BOOT,
  gloves: GAUNTLET,
  goggles: STEEL,
  tank: STEEL,
  fin: RED_FIN,
  gun: RED_PAINT,
  light: [hex('#ffffff'), hex('#ffd6d0'), hex('#ff4a42'), hex('#a01020')],
  plane: { wing: CANVAS_RED, body: CANVAS_RED, trim: CANVAS_CREAM, cowl: STEEL },
};

export const AVIATOR_LOOKS = [AVIATOR_LOOK, ACE_LOOK];

/** The look being drawn; set by buildAviatorFrames. */
let S: AviatorLook = AVIATOR_LOOK;

const hash = (a: number, b: number, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------------------
// The rig

/** A hand (or the way the pistol points), in the rig's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

export interface Pose {
  /** Whole body raised. */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The free hand and the pistol hand. */
  a: Hand;
  b: Hand;
  /** Which way the pistol points. */
  t: Hand;
  /** 0..1 the pistol's muzzle lit. */
  glow: number;
  /** 0..1 fire roaring from the jetpack's nozzles. */
  jet: number;
  /** 0..1 how far the scarf's tail streams out behind (0 hangs). */
  stream: number;
  /** 0..1 smoke billowing round the nozzles. */
  smoke: number;
  /** Pixels the body sinks into a crouch (knees bent out). */
  crouch: number;
  /** 0..1 legs tucked up under her in the air. */
  tuck: number;
  /** The goggles pulled down over the eyes. */
  gog: boolean;
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

/** The pistol's direction on screen, foreshortened when it points at or away from the viewer; also whether it dips behind the body. */
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

/** An arm: the leather sleeve to the wrist, a gauntlet cuff, the gloved hand. */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bias = 0): void {
  const [ex, ey] = elbow(sx, sy, p.x, p.y, reach, hint);
  const wx = ex + (p.x - ex) * 0.62;
  const wy = ey + (p.y - ey) * 0.62;
  c.part();
  c.capsule(sx, sy, ex, ey, 1.75, 1.5, S.jacket, { bias });
  c.part();
  c.capsule(ex, ey, wx, wy, 1.5, 1.35, S.jacket, { bias });
  c.part();
  c.ellipse(wx, wy, 1.4, 1.15, S.gloves, { bias });
  c.part();
  c.ellipse(p.x, p.y, 1.2, 1.15, S.gloves, { bias });
}

/** A small cross of light, the arms growing with `k`. */
function glowAt(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.light;
  c.spark(x, y, core, k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + dx, y + dy, hot, 0.6 * k);
  if (k > 0.6) for (const [dx, dy] of [[2, 0], [-2, 0], [0, -2], [0, 2]]) c.spark(x + dx, y + dy, mid, 0.4 * k);
}

/**
 * Jet fire pouring down from a nozzle at (x, y): a white-hot core, then the
 * look's fire out to ragged tips that change frame to frame. `lean` bends
 * it back (side view); `masked` leaves it out where the body is drawn, for
 * flames that burn behind her.
 */
function jetFlame(c: PixelCanvas, x: number, y: number, k: number, tick: number, lean = 0, masked = false): void {
  if (k <= 0) return;
  const [core, hot, mid, deep] = S.light;
  const len = 2 + k * 5 + ((tick * 7 + Math.round(x)) % 3) - 1;
  const put = (px: number, py: number, col: RGB, a: number) => {
    if (masked && c.filled(Math.floor(px), Math.floor(py))) return;
    c.spark(px, py, col, a);
  };
  for (let i = 0; i < len; i++) {
    const f = i / Math.max(1, len - 1);
    const px = x + lean * i * 0.45;
    const py = y + i;
    put(px, py, f < 0.25 ? core : f < 0.55 ? hot : f < 0.85 ? mid : deep, k * (1 - f * 0.35));
    // Wider near the nozzle, licking out either side.
    if (f < 0.6 && k > 0.35) {
      const w = (tick + i) % 2 ? 1 : 0;
      put(px - 1 - w * 0.5, py + 0.5, f < 0.3 ? hot : mid, k * 0.7);
      put(px + 1 + w * 0.5, py + 0.5, f < 0.3 ? hot : mid, k * 0.7);
    }
  }
  // A spark spat off the flame now and then.
  if (k > 0.5) put(x + ((tick % 3) - 1) * 2, y + len + 1, mid, 0.6 * k);
}

/** Smoke rolling round the nozzles: puffs swelling and rising, more and bigger with `k`. */
function smokePuffs(c: PixelCanvas, x: number, y: number, k: number, tick: number, spread: number): void {
  if (k <= 0) return;
  const n = 2 + Math.round(k * 3);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const dx = side * (1 + hash(i, tick) * spread * k);
    const dy = -hash(i, tick, 3) * 3 * k - i * 0.6;
    const r = 0.9 + k * 1.2 * (1 - i / (n + 1)) + hash(i, 7) * 0.5;
    c.part();
    c.ellipse(x + dx, y + dy, r * 1.15, r, SMOKE, { bias: i % 3 === 0 ? 1 : 0 });
  }
}

// ---------------------------------------------------------------------------
// The pistol

/**
 * The flare pistol along (ux, uy) from the hand: a fat brass barrel (red on
 * the Ace's) with a darker muzzle ring, a wooden grip under the hand and the
 * hammer behind; the muzzle flares as it fires. The hand is drawn again over
 * the grip.
 */
function drawGun(c: PixelCanvas, p: Placed, d: { x: number; y: number; k: number }, glow: number, bias = 0): void {
  const { x: ux, y: uy, k } = d;
  const vx = -uy;
  const vy = ux;
  const hx = p.x;
  const hy = p.y;
  const len = 4.6 * k;
  // The grip drops from under the barrel, down and back.
  const gx = vy >= 0 ? vx : -vx;
  const gy = vy >= 0 ? vy : -vy;
  c.part();
  c.capsule(hx, hy, hx - ux * 0.8 + gx * 1.4, hy - uy * 0.8 + gy * 1.4, 0.8, 0.7, WOOD_GRIP, { bias });
  c.part();
  c.capsule(hx - ux * 1.4, hy - uy * 1.4, hx + ux * len, hy + uy * len, 1.15, 1.1, S.gun, { bias });
  // The muzzle's ring and the hammer.
  c.part();
  c.px(hx + ux * (len + 0.6), hy + uy * (len + 0.6), S.ace ? STEEL : COPPER, sphere(ux * 0.6, -uy * 0.6), { bias });
  c.px(hx - ux * 2.2 - vx * 0.6, hy - uy * 2.2 - vy * 0.6, STEEL, sphere(-ux * 0.5, 0.5), { bias });
  const mx = hx + ux * (len + 1.6);
  const my = hy + uy * (len + 1.6);
  if (glow > 0.15) {
    const [core, hot] = S.light;
    c.spark(mx, my, core, glow);
    c.spark(mx + ux, my + uy, hot, glow * 0.8);
    if (glow > 0.6) {
      glowAt(c, mx + ux, my + uy, (glow - 0.5) * 2);
      c.spark(mx + ux * 3, my + uy * 3, hot, (glow - 0.6) * 2);
    }
  }
  c.part();
  c.ellipse(hx, hy, 1.2, 1.15, S.gloves, { bias });
}

// ---------------------------------------------------------------------------
// Heads

/** Goggles on the brow (or down over the eyes): a strap, two round rims, lenses catching the light. */
function goggles(c: PixelCanvas, cx: number, y: number, down: boolean): void {
  c.part();
  c.shape(Math.round(y), Math.round(y), () => [cx - 4, cx + 4], HARNESS, (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
  c.part();
  for (const x of [cx - 1.9, cx + 1.4]) {
    c.ellipse(x, y, 1.5, down ? 1.3 : 1.2, S.goggles);
    c.px(x - 0.5, y - 0.5, LENS, sphere(-0.3, 0.4));
    if (down) c.px(x + 0.5, y + 0.4, LENS, sphere(0.3, -0.2), { bias: -1 });
  }
}

/** The face and cap from the front: a short bob under the cap, loose ear flaps, goggles, a quick smile. */
function headDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  // The bob behind the face, peeking out under the flaps.
  c.part();
  c.ellipse(cx - 0.5, 12.9 + U, 4.1, 3.4, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7 - 0.2, 1) });
  c.part();
  c.ellipse(cx - 0.5, 12.6 + U, 3.0, 2.9, SKIN);
  // The cap: a snug dome and the flaps hanging loose either side of the face.
  c.part();
  const widths = [2.4, 3.4, 3.9, 4.1];
  c.shape(Math.round(7 + U), Math.round(10 + U), (y) => {
    const w = widths[Math.min(3, Math.max(0, y - Math.round(7 + U)))];
    return [cx - 0.5 - w, cx - 0.5 + w];
  }, S.cap, (_x, y, t) => sphere(t * 0.9, (y - 7 - U) / 4 - 0.8, 1));
  // A seam down the crown.
  for (let y = 7; y <= 9; y++) c.shade(cx - 1, y + U, -1);
  c.part();
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? cx - 5.4 : cx + 2.2;
    c.shape(Math.round(10 + U), Math.round(14 + U), (y) => (y === Math.round(14 + U) ? [x0 + 0.3, x0 + 1.9] : [x0, x0 + 2.2]), S.cap, (_x, y, t) => sphere(t * 0.6 + s * 0.4, (y - 12 - U) / 3, 1), { bias: -1 });
  }
  // Two locks of the fringe under the cap's rim.
  c.part();
  c.px(cx - 2, 11 + U, S.hair, sphere(-0.3, -0.5));
  c.px(cx + 0, 11 + U, S.hair, sphere(0.2, -0.5), { bias: -1 });
  if (p.gog) goggles(c, cx - 0.5, 12 + U, true);
  else {
    c.part();
    if (p.blink) for (const x of [cx - 2, cx + 1]) c.px(x, 12 + U, SKIN, sphere(0, -0.3), { bias: -1 });
    else for (const x of [cx - 2, cx + 1]) c.px(x, 12 + U, EYE);
    goggles(c, cx - 0.5, 9 + U, false);
  }
  c.part();
  c.px(cx - 1, 13 + U, SKIN, sphere(-0.2, -0.4), { bias: 1 });
  c.px(cx - 1, 14 + U, MOUTH, sphere(0, 0));
  c.px(cx, 14 + U, MOUTH, sphere(0.3, 0), { bias: 1 });
}

/** The back of her head: the bob, the cap with its seam and flaps, the goggles' strap round the back. */
function headUp(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.ellipse(cx, 12.6 + U, 4.0, 3.2, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7 - 0.1, 1) });
  c.part();
  c.shape(Math.round(7 + U), Math.round(12 + U), (y) => {
    const w = [2.4, 3.4, 3.9, 4.1, 4.1, 3.8][Math.min(5, Math.max(0, y - Math.round(7 + U)))];
    return [cx - w, cx + w];
  }, S.cap, (_x, y, t) => sphere(t * 0.9, (y - 7 - U) / 5 - 0.6, 1));
  for (let y = 7; y <= 12; y++) c.shade(cx - 1, y + U, -1);
  c.part();
  for (const x0 of [cx - 4.6, cx + 2.4]) c.shape(Math.round(12 + U), Math.round(14 + U), () => [x0, x0 + 2.2], S.cap, (_x, y, t) => cyl(t, (y - 12 - U) / 3), { bias: -1 });
  c.part();
  c.shape(Math.round(9 + U), Math.round(9 + U), () => [cx - 4, cx + 4], HARNESS, (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
  // The buckle at the back of the strap.
  c.px(cx - 1, 9 + U, S.goggles, sphere(0, 0.2));
}

// ---------------------------------------------------------------------------
// The scarf

/**
 * The scarf's long tail, from (x, y) at the neck: hanging down (stream 0),
 * swinging with `sway`, or streaming straight back along `dir` (stream 1),
 * rippling. Two pixels wide with a fringed end.
 */
function scarfTail(c: PixelCanvas, x: number, y: number, dir: number, stream: number, tick: number, len: number, bias = 0): void {
  c.part();
  const N = Math.round(len);
  let px = x;
  let py = y;
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    // Hanging: straight down, curling a touch toward `dir`; streaming: out along `dir`, rising a little.
    const hang = { x: dir * f * 1.2, y: f * len };
    const fly = { x: dir * f * len, y: -f * 1.5 };
    const wave = Math.sin(f * 5 - tick * 1.6) * (0.4 + stream * 1.3) * f;
    const tx = x + hang.x + (fly.x - hang.x) * stream + (stream > 0.3 ? 0 : wave);
    const ty = y + hang.y + (fly.y - hang.y) * stream + (stream > 0.3 ? wave : 0);
    const n: Vec3 = sphere(dir * 0.3, -0.4 + f * 0.5);
    c.px(tx, ty, S.scarf, n, { bias: bias - (i % 4 === 3 ? 1 : 0) });
    // Its width: a second row, across the flow.
    if (stream > 0.3) c.px(tx, ty + 1, S.scarf, sphere(dir * 0.2, 0.3), { bias: bias - 1 });
    else c.px(tx + dir, ty, S.scarf, sphere(dir * 0.6, 0), { bias: bias - 1 });
    px = tx;
    py = ty;
  }
  // The fringe at its end.
  if (stream > 0.3) {
    c.px(px + dir, py, S.scarf, sphere(dir * 0.4, -0.2), { bias: bias + 1 });
    c.px(px + dir, py + 2, S.scarf, sphere(dir * 0.4, 0.4), { bias: bias - 1 });
  } else {
    c.px(px, py + 1, S.scarf, sphere(0, 0.6), { bias: bias + 1 });
    c.px(px + dir, py + 1, S.scarf, sphere(dir * 0.4, 0.6), { bias: bias - 1 });
  }
}

// ---------------------------------------------------------------------------
// Bodies (front and back)

/** The jacket from the front: shearling collar, the zip, the harness straps with their buckle and gauge, the ribbed hem. */
function jacketFront(c: PixelCanvas, cx: number, U: number): void {
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 4.7 - 1.1 * u;
    return [cx - hw, cx + hw];
  }, S.jacket, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  // The zip, and the ribbed band at the hem.
  for (let y = top + 2; y < waist; y++) c.shade(cx - 1, y, -1);
  for (let x = cx - 4; x <= cx + 3; x++) c.shade(x, waist, x % 2 ? -1 : 0);
  // The harness: a strap down from each shoulder, a strap across the chest, a brass buckle and the pack's gauge.
  c.part();
  c.line(cx - 3.2, top + 0.5, cx - 2.6, top + 5, HARNESS, () => sphere(-0.3, -0.2));
  c.line(cx + 2.2, top + 0.5, cx + 1.6, top + 5, HARNESS, () => sphere(0.3, -0.2));
  c.line(cx - 3, top + 4, cx + 2, top + 4, HARNESS, () => sphere(0, 0.1));
  c.part();
  c.px(cx - 1, top + 4, S.goggles, sphere(0, -0.2));
  c.px(cx - 3, top + 2, S.goggles, sphere(-0.4, -0.3));
  c.px(cx - 3, top + 3, LENS, sphere(-0.3, 0), { glow: 0.2 });
  // The shearling collar, thick and woolly.
  c.part();
  c.shape(top - 1, top + 1, (y) => {
    // Under the chin it opens round the neck: only its sides stand up there.
    if (y === top - 1) return null;
    const w = y === top ? 4.6 : 4.2;
    return [cx - 0.5 - w, cx - 0.5 + w];
  }, SHEARLING, (x, y, t) => sphere(t * 0.8 + (hash(x, y) - 0.5) * 0.5, -0.3 + (hash(y, x) - 0.5) * 0.6, 1));
  // Its points falling either side of the zip.
  c.px(cx - 3, top + 2, SHEARLING, sphere(-0.4, 0.4));
  c.px(cx + 1, top + 2, SHEARLING, sphere(0.4, 0.4));
  // The hips of the jodhpurs under the jacket.
  c.part();
  c.shape(waist + 1, waist + 2, () => [cx - 4.1, cx + 4.1], S.jodhpurs, (_x, _y, t) => cyl(t, 0.1));
}

/** The jacket from behind, the scarf knotted at the nape. */
function jacketBack(c: PixelCanvas, cx: number, U: number): void {
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 4.7 - 1.1 * u;
    return [cx - hw, cx + hw];
  }, S.jacket, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  for (let x = cx - 4; x <= cx + 3; x++) c.shade(x, waist, x % 2 ? -1 : 0);
  c.part();
  c.shape(waist + 1, waist + 2, () => [cx - 4.1, cx + 4.1], S.jodhpurs, (_x, _y, t) => cyl(t, 0.1));
  // The collar standing up behind the neck.
  c.part();
  c.shape(top - 1, top, () => [cx - 4, cx + 4], SHEARLING, (x, y, t) => sphere(t * 0.8 + (hash(x, y) - 0.5) * 0.5, -0.4, 1));
}

/**
 * The jetpack seen from behind: two brass tanks banded in copper with domed
 * caps, a pressure gauge between them, fins at their feet and the nozzles
 * under them; the harness straps over the shoulders.
 */
function packBack(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  for (const x of [cx - 2.4, cx + 1.4]) c.capsule(x, 16.6 + U, x, 21.6 + U, 1.9, 1.9, S.tank);
  c.part();
  // Copper bands round each tank.
  for (const x of [cx - 2.4, cx + 1.4]) {
    for (const y of [18, 21]) for (let dx = -1; dx <= 1; dx++) c.px(x + dx, y + U, COPPER, sphere(dx * 0.6, 0));
  }
  // The gauge between them, and its needle.
  c.part();
  c.ellipse(cx - 0.5, 18.4 + U, 1.3, 1.2, S.tank);
  c.px(cx - 1, 18 + U, LENS, sphere(-0.2, 0.3), { glow: 0.3 });
  // Fins splaying out at the tanks' feet.
  c.part();
  for (const s of [-1, 1]) {
    const x = s < 0 ? cx - 4.6 : cx + 3.6;
    c.px(x, 21 + U, S.fin, sphere(s * 0.7, -0.2));
    c.px(x, 22 + U, S.fin, sphere(s * 0.7, 0.2));
    c.px(x + s, 22 + U, S.fin, sphere(s * 0.9, 0.3), { bias: -1 });
  }
  // The nozzles.
  c.part();
  for (const x of [cx - 2.4, cx + 1.4]) c.capsule(x, 23.2 + U, x, 24.2 + U, 1.2, 0.9, STEEL);
  // The harness straps over the shoulders to the tanks.
  c.part();
  c.line(cx - 3.6, 15 + U, cx - 3.2, 17 + U, HARNESS, () => sphere(-0.3, -0.4));
  c.line(cx + 2.6, 15 + U, cx + 2.2, 17 + U, HARNESS, () => sphere(0.3, -0.4));
}

// ---------------------------------------------------------------------------
// Views

const REACH_FRONT = 4.4;
const REACH_SIDE = 5.0;

/** Legs from the front or back: jodhpurs flaring at the thigh into tall riding boots. `crouch` bends the knees out; `l`/`r` lift a foot. */
function legsFront(c: PixelCanvas, L: number, fa: number, fb: number, back: boolean, crouch: number): void {
  const [l, r] = back ? [fb, fa] : [fa, fb];
  for (const [side, lift] of [[-1, l], [1, r]] as const) {
    const hip = { x: 12 + side * 1.9, y: 24 + L };
    const foot = { x: 12 + side * (2.2 + crouch * 0.25), y: 30.3 - lift };
    const knee = { x: 12 + side * (2.3 + crouch * 0.6), y: Math.min(hip.y + 3.4, foot.y - 2.4) };
    c.part();
    c.capsule(hip.x, hip.y, knee.x, knee.y, 1.9, 1.55, S.jodhpurs);
    // The flare of the breeches at mid-thigh.
    c.ellipse(hip.x + side * 0.6, hip.y + 1.4, 1.7, 1.6, S.jodhpurs, { bias: 0 });
    // The boot: shaft to the knee, its cuff, then the foot.
    c.part();
    c.capsule(knee.x, knee.y + 0.4, foot.x, foot.y - 1, 1.45, 1.3, S.boots);
    c.px(knee.x - 0.5, knee.y + 0.2, S.boots, sphere(side * 0.2, -0.7), { bias: 1 });
    c.part();
    c.ellipse(foot.x, foot.y, 1.7, 1.2, S.boots, { flatten: 0.8 });
  }
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift + p.crouch;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const td = toolDir('down', p.t);
  const armA = () => arm(c, 7.4, 16.4 + U, fa, REACH_FRONT, [-0.6, 1], fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.6, 16.4 + U, fb, REACH_FRONT, [0.6, 1], fb.behind ? -1 : 0);
  const gun = (bias = 0) => drawGun(c, fb, td, p.glow, bias);

  // Behind her: the scarf's tail thrown back over the shoulder (seen when it streams), the tanks' caps over her shoulders.
  if (p.stream > 0.2) scarfTail(c, cx - 3, 15 + U, -1, p.stream, p.tick, 7 + p.stream * 3, -1);
  c.part();
  for (const x of [cx - 4, cx + 3]) c.ellipse(x, 15.2 + U, 1.2, 0.9, S.tank, { bias: -1 });
  // The nozzles poking out beside her hips.
  c.part();
  c.px(cx - 5, 23 + U, STEEL, sphere(-0.6, 0.3), { bias: -1 });
  c.px(cx + 4, 23 + U, STEEL, sphere(0.6, 0.3), { bias: -1 });
  const gunBack = td.away || fb.behind;
  if (fa.behind) armA();
  if (fb.behind) armB();
  if (gunBack) gun(-1);

  legsFront(c, L, p.footA + p.tuck * 3, p.footB + p.tuck * 3, false, p.crouch);
  jacketFront(c, cx, U);
  headDown(c, cx, U, p);
  // The scarf at her throat: a band over the collar, the knot, a short end hanging down the front.
  c.part();
  c.shape(Math.round(15 + U), Math.round(15 + U), () => [cx - 3.4, cx + 2.4], S.scarf, (_x, _y, t) => cyl(t, -0.2));
  c.part();
  c.ellipse(cx + 1, 16 + U, 1.2, 1.0, S.scarf);
  scarfTail(c, cx + 1, 17 + U, 1, 0, p.tick, 3.5 - p.stream * 1.5);

  if (!fb.behind) armB();
  if (!gunBack) gun();
  if (!fa.behind) armA();
  smokePuffs(c, cx - 5, 26 + L, p.smoke, p.tick, 3);
  smokePuffs(c, cx + 4, 26 + L, p.smoke, p.tick + 5, 3);
  // The jets burn behind her legs: only what shows beside them.
  jetFlame(c, cx - 5, 24 + U, p.jet, p.tick, -0.6, true);
  jetFlame(c, cx + 4, 24 + U, p.jet, p.tick + 1, 0.6, true);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift + p.crouch;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const td = toolDir('up', p.t);
  const armA = () => arm(c, 16.6, 16.4 + U, fa, REACH_FRONT, [0.6, 0.8], fa.behind ? -1 : 0);
  const armB = () => arm(c, 7.4, 16.4 + U, fb, REACH_FRONT, [-0.6, 0.8], fb.behind ? -1 : 0);
  const gun = (bias = 0) => drawGun(c, fb, td, p.glow, bias);

  const gunBack = td.away || fb.behind;
  if (fa.behind) armA();
  if (fb.behind) armB();
  if (gunBack) gun(-1);

  legsFront(c, L, p.footA + p.tuck * 3, p.footB + p.tuck * 3, true, p.crouch);
  jacketBack(c, cx, U);
  headUp(c, cx, U);
  packBack(c, cx, U);
  // The scarf's knot at the nape and its long tail down her back (out to the side as it streams).
  c.part();
  c.shape(Math.round(15 + U), Math.round(15 + U), () => [cx - 3, cx + 3], S.scarf, (_x, _y, t) => cyl(t, -0.3));
  scarfTail(c, cx + 2, 16 + U, 1, p.stream, p.tick, 7 + p.stream * 2);

  if (!fb.behind) armB();
  if (!gunBack) gun();
  if (!fa.behind) armA();
  smokePuffs(c, cx - 2.4, 26 + L, p.smoke, p.tick, 3);
  smokePuffs(c, cx + 1.4, 26 + L, p.smoke, p.tick + 5, 3);
  jetFlame(c, cx - 2.4, 25 + U, p.jet, p.tick, -0.3);
  jetFlame(c, cx + 1.4, 25 + U, p.jet, p.tick + 1, 0.3);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift + p.crouch;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean;
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);
  const td = toolDir('side', p.t);
  const top = 15 + U;
  const waist = 22 + U;

  // The far arm behind the body, unless it reaches out in front.
  const armA = (bias: number) => arm(c, hx + 1.2, 16.4 + U, fa, REACH_SIDE, [0.3, 1], bias);
  if (fa.behind) armA(-1);
  const gunBack = td.x > 0.55 && fb.x > hx - 1;
  if (gunBack) drawGun(c, fb, td, p.glow, -1);

  // The jetpack on her back: a tank in profile with its band, fin and nozzle.
  c.part();
  c.capsule(hx + 4.4, 16.4 + U, hx + 4.4, 21.4 + U, 1.9, 1.9, S.tank, { bias: -1 });
  c.part();
  for (const y of [18, 21]) for (let dx = -1; dx <= 1; dx++) c.px(hx + 4.4 + dx, y + U, COPPER, sphere(dx * 0.6, 0));
  c.part();
  c.px(hx + 6.6, 21 + U, S.fin, sphere(0.7, -0.2));
  c.px(hx + 6.6, 22 + U, S.fin, sphere(0.7, 0.2));
  c.px(hx + 7.6, 22 + U, S.fin, sphere(0.9, 0.3), { bias: -1 });
  c.part();
  c.capsule(hx + 4.6, 23 + U, hx + 5, 24.2 + U, 1.2, 0.9, STEEL);
  // The scarf's tail thrown back over the shoulder: down over the pack, or streaming out behind.
  scarfTail(c, hx + 2, top, 1, Math.max(0.15, p.stream), p.tick, 7 + p.stream * 3);

  // Legs: the back one in shade first; tucked up in the air, knees forward.
  const lift = (f: number) => Math.max(0, f) * 0.35 + p.tuck * 2.6;
  const kneeF = p.tuck * 1.8 + p.crouch * 0.5;
  for (const [f, x0, bias] of [[p.footB, cx + 0.8, -1], [p.footA, cx - 0.6, 0]] as const) {
    const hip = { x: x0, y: 24 + L };
    const foot = { x: x0 - 0.2 - f + p.tuck * 1.2, y: 30.3 - lift(f) };
    const knee = { x: (hip.x + foot.x) / 2 - kneeF - 0.3, y: Math.min(hip.y + 3, foot.y - 2.4) };
    c.part();
    c.capsule(hip.x, hip.y, knee.x, knee.y, 1.9, 1.5, S.jodhpurs, { bias });
    c.ellipse(hip.x + 0.4, hip.y + 1.2, 2.1, 1.5, S.jodhpurs, { bias });
    c.part();
    c.capsule(knee.x, knee.y + 0.4, foot.x + 0.4, foot.y - 1, 1.45, 1.3, S.boots, { bias });
    c.part();
    c.ellipse(foot.x - 0.4, foot.y, 2.2, 1.2, S.boots, { flatten: 0.8, bias });
  }

  // The jacket in profile, its collar and the harness strap down the front.
  c.part();
  c.shape(top, waist, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 3.3 - 0.6 * u;
    return [hx - hw - 0.3, hx + hw];
  }, S.jacket, (_x, y, t) => sphere(t * 0.9 - 0.1, ((y - top) / (waist - top)) * 0.8 - 0.35, 1));
  for (let x = Math.round(hx - 3); x <= hx + 2; x++) c.shade(x, waist, x % 2 ? -1 : 0);
  c.part();
  c.shape(waist + 1, Math.round(24 + L), () => [cx - 3.2, cx + 2.6], S.jodhpurs, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.line(hx - 1.4, top + 0.5, hx - 2.2, top + 5, HARNESS, () => sphere(-0.3, -0.3));
  c.line(hx - 2.4, top + 4, hx + 2.4, top + 4, HARNESS, () => sphere(0, 0.1));
  c.px(hx - 2.6, top + 4, S.goggles, sphere(-0.4, -0.2));
  c.part();
  // The collar turned up round the back of the neck, open under the chin.
  c.shape(top - 1, top + 1, (y) => (y === top - 1 ? [hx - 0.4, hx + 2.4] : [hx - 1.8, hx + 2.8]), SHEARLING, (x, y, t) => sphere(t * 0.8 + (hash(x, y) - 0.5) * 0.5, -0.3 + (hash(y, x) - 0.5) * 0.5, 1));

  // The head in profile: the bob behind, the face, the cap with its flap, goggles on the brow or over the eye.
  c.part();
  c.ellipse(hx + 0.9, 12.9 + U, 3.1, 3.1, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7 - 0.2, 1) });
  c.part();
  c.ellipse(hx - 0.7, 12.6 + U, 2.8, 2.9, SKIN);
  c.part();
  c.px(hx - 4, 13 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
  c.px(hx - 3, 14 + U, MOUTH, sphere(-0.5, 0));
  c.part();
  c.shape(Math.round(7 + U), Math.round(11 + U), (y) => {
    const r = y - Math.round(7 + U);
    const w = [[-2.4, 2.2], [-3.4, 3.2], [-3.8, 3.6], [-3.9, 3.8], [-2.6, 3.8]][Math.min(4, r)];
    return [hx + w[0], hx + w[1]];
  }, S.cap, (_x, y, t) => sphere(t * 0.9 - 0.1, (y - 7 - U) / 4 - 0.8, 1));
  for (let y = 7; y <= 10; y++) c.shade(Math.round(hx + 1), y + U, -1);
  c.part();
  c.shape(Math.round(11 + U), Math.round(14 + U), (y) => (y === Math.round(14 + U) ? [hx + 0.6, hx + 2.2] : [hx + 0.2, hx + 2.6]), S.cap, (_x, y, t) => sphere(t * 0.6 - 0.2, (y - 12 - U) / 3, 1));
  c.part();
  c.shape(Math.round((p.gog ? 12 : 9) + U), Math.round((p.gog ? 12 : 9) + U), () => [hx - 2.6, hx + 3.6], HARNESS, (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
  if (p.gog) {
    c.part();
    c.ellipse(hx - 2.8, 12.2 + U, 1.3, 1.3, S.goggles);
    c.px(hx - 4, 12 + U, LENS, sphere(-0.5, 0.4));
  } else {
    c.part();
    if (p.blink) c.px(hx - 3, 12 + U, SKIN, sphere(-0.3, -0.3), { bias: -1 });
    else c.px(hx - 3, 12 + U, EYE);
    c.px(hx - 2, 11 + U, S.hair, sphere(-0.3, -0.5));
    c.part();
    c.ellipse(hx - 2.6, 9.2 + U, 1.3, 1.2, S.goggles);
    c.px(hx - 3.6, 8.6 + U, LENS, sphere(-0.5, 0.4));
  }
  // The scarf knotted at the throat.
  c.part();
  c.shape(top, top, () => [hx - 2.6, hx + 2.4], S.scarf, (_x, _y, t) => cyl(t, -0.2));

  if (!fa.behind) armA(0);
  // The near arm last, the pistol in its hand.
  arm(c, hx + 0.2, 16.7 + U, fb, REACH_SIDE, [0.4, 1], 0);
  if (!gunBack) drawGun(c, fb, td, p.glow);
  smokePuffs(c, hx + 5.4, 26 + L, p.smoke, p.tick, 4);
  jetFlame(c, hx + 5, 25.2 + U, p.jet, p.tick, 0.9, true);
}

// ---------------------------------------------------------------------------
// Animations

/** The free hand easy at the side, the pistol held low and ready, pointing ahead. */
const REST_A = H(0.6, 4.4, -3.2);
const GUN_B = H(1.6, 4.4, -1.8);
const GUN_T = H(1, 0.2, -0.45);

/** Side-view hands: a little further forward, both at the body's line. */
const side = (h: Hand, arm: 'a' | 'b'): Hand => H(h.f + (arm === 'b' ? 0.6 : 0.4), 0, h.h);

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: view === 'side' ? side(REST_A, 'a') : { ...REST_A },
  b: view === 'side' ? side(GUN_B, 'b') : { ...GUN_B },
  t: { ...GUN_T },
  glow: 0,
  jet: 0,
  stream: 0,
  smoke: 0,
  crouch: 0,
  tuck: 0,
  gog: false,
  tick: 0,
});

function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.tick = f;
    p.blink = f === 4;
    // The pistol bobs, and a breeze lifts the scarf's tail now and then.
    p.b.h += Math.sin(ph) * 0.4;
    p.stream = view === 'side' ? 0.15 + 0.1 * Math.max(0, Math.sin(ph)) : 0;
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
    p.stream = 0.55 + 0.1 * Math.abs(s);
    if (view === 'side') {
      p.footA = Math.round(s * 2.2);
      p.footB = -p.footA;
      p.lean = 1;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
    }
    p.a.f -= s * 1.3;
    p.b.h += p.lift * 0.4;
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
  glow?: number;
  jet?: number;
  stream?: number;
  smoke?: number;
  crouch?: number;
  tuck?: number;
  gog?: boolean;
  lean?: number;
  breath?: number;
  lift?: number;
  step?: number;
  blink?: boolean;
}

/** An action as keyframes; anything left out stays at rest. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k, i) => {
      const p = base(view);
      if (k.a) p.a = view === 'side' ? { ...(k.aSide ?? side(k.a, 'a')) } : { ...k.a };
      if (k.b) p.b = view === 'side' ? { ...(k.bSide ?? side(k.b, 'b')) } : { ...k.b };
      if (k.t) p.t = { ...k.t };
      p.glow = k.glow ?? 0;
      p.jet = k.jet ?? 0;
      p.stream = k.stream ?? (view === 'side' ? 0.15 : 0);
      p.smoke = k.smoke ?? 0;
      p.crouch = k.crouch ?? 0;
      p.tuck = k.tuck ?? 0;
      p.gog = !!k.gog;
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
      p.blink = k.blink;
      p.tick = i;
      const step = k.step ?? 0;
      if (view === 'side') {
        p.lean = k.lean ?? 0;
        p.footA = 1 + step;
        p.footB = -1 - Math.round(step * 0.5);
      } else p.footA = step > 0 ? 1 : 0;
      return p;
    });
}

/** The flare pistol: up to the aim, the shot (a kick up and a flash), the recoil, and down again. */
const shoot = action([
  { b: H(3, 3.6, 0.8), t: H(1, 0.1, 0), glow: 0.25, lean: 0 },
  { b: H(4.4, 2.8, 1.2), t: H(1, 0, 0.2), glow: 1, lean: 1, step: 1 },
  { b: H(3.8, 3, 2.2), t: H(1, 0, 0.75), glow: 0.45, lean: -1, smoke: 0 },
  { b: H(2.8, 3.6, 0.6), t: H(1, 0.1, -0.1), glow: 0.1 },
]);

/**
 * The rocket hop: she crouches as the jets light, kicks off on a roar of
 * fire, flies with her legs tucked and her arms out for balance, scarf
 * streaming, and comes down in a crouch as they cut out.
 */
const hop = action([
  { a: H(-0.6, 4.8, -1.4), b: H(0, 4.8, -1.2), t: H(0.4, 0.4, -1), crouch: 2, jet: 0.35, smoke: 0.5, stream: 0.3, breath: 1 },
  { a: H(1, 5.4, 2.4), b: H(1.2, 5.2, 2.2), t: H(1, 0.3, 0.3), jet: 1, stream: 0.9, lean: 1 },
  { a: H(1.6, 5.6, 0.8), b: H(2, 5.4, 1), t: H(1, 0.2, 0), jet: 0.85, tuck: 1, stream: 1, lean: 1 },
  { a: H(1.6, 5.6, 0.4), b: H(2, 5.4, 0.6), t: H(1, 0.2, -0.1), jet: 0.55, tuck: 0.6, stream: 1, lean: 1 },
  { a: H(1.2, 5.6, -0.4), b: H(1.6, 5.4, -0.2), t: H(1, 0.3, -0.4), crouch: 2.5, smoke: 0.8, stream: 0.5, breath: 1 },
  { a: H(0.8, 4.8, -2), b: H(1.4, 4.6, -1.4), crouch: 1, smoke: 0.4, stream: 0.3 },
]);
/** Crouch, launch, the air (held), landing, up: frames played in this order. */
const HOP_ORDER = [0, 1, 2, 2, 3, 3, 4, 5];

/**
 * The signal, the Special's pose: she pulls her goggles down, then thrusts
 * the flare pistol straight up overhead and fires a signal flare for her
 * plane, the free hand on her hip.
 */
const signal = action([
  { a: H(1.8, 1.8, 6.4), aSide: H(2.4, 0, 6.4), b: H(2, 4.2, 0.2), t: H(1, 0.2, 0.4), breath: 1 },
  { a: H(1.6, 2.2, 5.2), aSide: H(2, 0, 5), b: H(1.4, 4, 3.6), t: H(0.3, 0.1, 1), gog: true },
  { a: H(0.2, 4.8, -1), aSide: H(-0.6, 0, -0.6), b: H(0.8, 3, 7.2), t: H(0, 0, 1), glow: 0.6, gog: true, lift: 1 },
  { a: H(0.2, 4.8, -1), aSide: H(-0.6, 0, -0.6), b: H(0.8, 2.8, 7.6), t: H(0, 0, 1), glow: 1, gog: true, lift: 1, stream: 0.4 },
  { a: H(0.2, 4.8, -1), aSide: H(-0.6, 0, -0.6), b: H(0.8, 2.8, 7.4), t: H(0, 0, 1), glow: 0.8, gog: true, lift: 1, stream: 0.4 },
  { a: H(0.2, 4.8, -1), aSide: H(-0.6, 0, -0.6), b: H(0.8, 3, 7), t: H(0.1, 0, 1), glow: 0.5, gog: true },
]);

// ---------------------------------------------------------------------------
// The idle moment (`rest`), played facing us when she has stood still a while.
// It starts and ends on idle's first frame so it slips in and out unseen.

/** Idle's first frame, with changes. */
const still = (o: Partial<Pose> = {}): Pose => ({ ...idle('down')[0], ...o });

/** The free hand at the gauge on her harness strap. */
const GAUGE_A = H(1.6, 2.6, 2.4);
const ARMS_OUT_A = H(1, 5.6, 1);
const ARMS_OUT_B = H(1.2, 5.4, 1.2);

/**
 * A test of the jetpack: she taps the gauge on her strap, the pack coughs
 * smoke and sputters alight, lifting her a hand's breadth off the ground; she
 * wobbles there with her arms out, it coughs again and drops her, and she
 * fans the smoke away with a grin.
 */
function jetTest(view: View): Pose[] {
  if (view !== 'down') return [];
  return [
    still(),
    still({ a: GAUGE_A, tick: 1 }),
    still({ a: H(1.8, 2.4, 2.2), smoke: 0.4, breath: 1, tick: 2 }),
    still({ a: GAUGE_A, smoke: 0.7, jet: 0.3, blink: true, tick: 3 }),
    still({ a: ARMS_OUT_A, b: ARMS_OUT_B, t: H(1, 0.4, -0.3), lift: 1, jet: 0.7, smoke: 0.5, tick: 4 }),
    still({ a: ARMS_OUT_A, b: H(1.2, 5.2, 2), t: H(1, 0.4, 0), lift: 2, jet: 0.9, smoke: 0.3, tick: 5 }),
    still({ a: H(1, 5.4, 2.2), b: ARMS_OUT_B, t: H(1, 0.4, -0.3), lift: 2, jet: 0.8, smoke: 0.3, tick: 6 }),
    still({ a: ARMS_OUT_A, b: ARMS_OUT_B, t: H(1, 0.4, -0.3), lift: 1, jet: 0.15, smoke: 1, blink: true, tick: 7 }),
    still({ a: H(1, 4.8, -0.6), b: H(1.4, 4.8, -0.6), crouch: 1.5, smoke: 0.8, tick: 8 }),
    still({ a: H(2.4, 2.2, 4.6), smoke: 0.6, tick: 9 }),
    still({ a: H(2.4, 4.2, 4.8), smoke: 0.4, tick: 10 }),
    still({ breath: 1, blink: true, smoke: 0.15, tick: 11 }),
  ];
}
const JET_TEST_ORDER = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 5, 6, 7, 8, 8, 9, 10, 9, 10, 11, 11, 0];

// ---------------------------------------------------------------------------
// Frame generation

export type AviatorAnim = 'idle' | 'walk' | 'shoot' | 'hop' | 'signal' | 'rest';

export interface AviatorAnimDef {
  name: AviatorAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Frames played in this order, some held or repeated. */
  order?: readonly number[];
}

export const AVIATOR_ANIMS: AviatorAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'shoot', fps: 14, loop: false, poses: shoot },
  { name: 'hop', fps: 14, loop: false, poses: hop, order: HOP_ORDER },
  { name: 'signal', fps: 10, loop: false, poses: signal },
  { name: 'rest', fps: 8, loop: false, poses: jetTest, order: JET_TEST_ORDER },
];

/** Timing of the moves, in ms from their start, matching their frames. */
export const AVIATOR_TIMING = {
  /** The shot leaves the pistol on frame 1; the whole move. */
  shootLand: (1 / 14) * 1000,
  shootMs: (4 / 14) * 1000,
  /** The hop: off the ground on frame 1 of its order, down on frame 6, done after 8. */
  hopLift: (1 / 14) * 1000,
  hopLand: (6 / 14) * 1000,
  hopMs: (8 / 14) * 1000,
} as const;

export interface AviatorFrame {
  key: string;
  anim: AviatorAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawAviatorFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(AVI_W, AVI_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildAviatorFrames(look: AviatorLook = AVIATOR_LOOK): AviatorFrame[] {
  S = look;
  const out: AviatorFrame[] = [];
  for (const a of AVIATOR_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawAviatorFrame(dir, pose) });
      });
    }
  }
  S = AVIATOR_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// The biplane

export const PLANE_SIZE = 36;
/** Headings drawn: 0 is flying right, then clockwise in sixteenths. */
export const PLANE_HEADINGS = 16;
/** How flat the ground plane looks from the camera, for things seen from above. */
const PLANE_FLAT = 0.72;

/** A wing's normal: facing up, a touch toward the key light so the canvas reads lit, turning a little with the heading. */
const WING_N = (uy: number): Vec3 => {
  const x = -uy * 0.15;
  const l = Math.hypot(x, 0.25, 0.95);
  return { x: x / l, y: 0.25 / l, z: 0.95 / l };
};

/** Fill the convex polygon `pts` (screen pixels) with one material and normal. */
function poly(c: PixelCanvas, pts: [number, number][], m: Material, n: Vec3, bias = 0): void {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let sign = 0;
      let inside = true;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        const cr = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
        if (Math.abs(cr) < 1e-6) continue;
        const s = Math.sign(cr);
        if (sign === 0) sign = s;
        else if (s !== sign) {
          inside = false;
          break;
        }
      }
      if (inside) c.px(x, y, m, n, { bias });
    }
  }
}

/**
 * One frame of the biplane seen from above, flying along `heading`: the
 * lower wing, the fuselage with its cockpit (and the little clockwork pilot
 * she built to fly it), the upper wing over them with its struts, the
 * tailplane and fin, the cowling at the nose and the propeller, its blades in
 * one of two places (`prop`) so it spins as the frames swap, a blur of light
 * round them.
 */
export function planeFrame(look: AviatorLook, heading: number, prop: number): PixelCanvas {
  const c = new PixelCanvas(PLANE_SIZE, PLANE_SIZE);
  const P = look.plane;
  const th = (heading / PLANE_HEADINGS) * Math.PI * 2;
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  const C = PLANE_SIZE / 2;
  // A point on the plane (u forward, v to its right, z up) to the screen.
  const at = (u: number, v: number, z: number): [number, number] => [C + ux * u - uy * v, C + (uy * u + ux * v) * PLANE_FLAT - z * 0.8 + 2];
  const wing = (u0: number, u1: number, span: number, z: number, m: Material, bias = 0, round = 1.2) => {
    // A wing with its tips rounded off.
    poly(c, [at(u1, -span + round, z), at(u1, span - round, z), at(u1 - round * 0.5, span, z), at(u0 + round * 0.5, span, z), at(u0, span - round, z), at(u0, -span + round, z), at(u0 + round * 0.5, -span, z), at(u1 - round * 0.5, -span, z)], m, WING_N(uy), bias);
  };

  // The wheels, peeking out under the lower wing.
  c.part();
  for (const v of [-2.6, 2.6]) {
    const [x, y] = at(4.5, v, -2.5);
    c.ellipse(x, y, 1, 0.9, RUBBER);
  }
  // The lower wing.
  c.part();
  wing(-0.5, 3.5, 11, 0, P.wing, -1);
  // The tailplane.
  c.part();
  wing(-12.5, -10, 5, 1.5, P.wing, 0, 0.8);
  // The fuselage: round, tapering to the tail, a stripe along it.
  c.part();
  const [nx, ny] = at(8, 0, 2);
  const [tx, ty] = at(-12, 0, 2);
  c.capsule(nx, ny, tx, ty, 2.3, 0.9, P.body);
  c.part();
  const [s0x, s0y] = at(4, 0, 2.8);
  const [s1x, s1y] = at(-11, 0, 2.6);
  c.line(s0x, s0y, s1x, s1y, P.trim, () => sphere(0, -0.6));
  // The fin, standing up off the tail.
  c.part();
  for (let z = 2; z <= 6; z++) {
    const [fx, fy] = at(-11 + (z - 2) * 0.25, 0, 2 + z);
    c.px(fx, fy, look.ace ? P.trim : P.wing, sphere(-uy * 0.4, 0.2));
    const [gx, gy] = at(-12.2 + (z - 2) * 0.3, 0, 2 + z * 0.9);
    c.px(gx, gy, look.ace ? P.trim : P.wing, sphere(-uy * 0.4, 0.4), { bias: -1 });
  }
  // The cockpit behind the upper wing, the clockwork pilot's brass dome in it.
  c.part();
  const [kx, ky] = at(-3.4, 0, 3.4);
  c.ellipse(kx, ky, 1.6, 1.3, COCKPIT);
  c.part();
  c.px(kx - 0.5, ky - 1, BRASS, sphere(-0.3, 0.6));
  c.px(kx + ux * 0.5 - 0.5, ky - 1 + uy * 0.4, LENS, sphere(0.2, 0.4));
  // The struts between the wings.
  c.part();
  for (const v of [-7, 7]) {
    const [a0, a1] = at(1.5, v, 0.5);
    const [b0, b1] = at(1.5, v, 5);
    c.line(a0, a1, b0, b1, P.trim, () => sphere(0, 0));
  }
  // The upper wing, over everything; roundels (the Ace's) or stripes near its tips.
  c.part();
  wing(-0.5, 4.5, 13, 5, P.wing);
  c.part();
  for (const v of [-9.5, 9.5]) {
    const [rx, ry] = at(2, v, 5);
    if (look.ace) {
      c.ellipse(rx, ry, 1.6, 1.3, P.trim);
      c.px(rx - 0.5, ry - 0.5, P.wing, sphere(0, 0));
    } else {
      const [ax, ay] = at(0, v, 5);
      const [bx, by] = at(4, v, 5);
      c.line(ax, ay, bx, by, P.trim, () => sphere(0, 0.2));
    }
  }
  // The cowling at the nose.
  c.part();
  const [cx0, cy0] = at(9.6, 0, 2.2);
  c.ellipse(cx0, cy0, 2.2, 2.0, P.cowl);
  c.part();
  c.px(cx0 - 0.5, cy0 - 0.5, STEEL, sphere(0, 0));
  // The propeller: two blades across the nose, or edge on; a pale blur of light round where they spin.
  const [px0, py0] = at(11.4, 0, 2.2);
  c.part();
  if (prop === 0) {
    const [ax, ay] = at(11.4, -4.5, 2.2);
    const [bx, by] = at(11.4, 4.5, 2.2);
    c.line(ax, ay, bx, by, VARNISH, () => sphere(0, 0.3));
  } else {
    const [ax, ay] = at(11.4, -1.5, 5.5);
    const [bx, by] = at(11.4, 1.5, -1.1);
    c.line(ax, ay, bx, by, VARNISH, () => sphere(0, 0.3));
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + prop * 0.26;
    const [bx, by] = at(11.4, Math.cos(a) * 4.5, 2.2 + Math.sin(a) * 3.6);
    c.spark(bx, by, [214, 220, 232], 0.22);
  }
  c.spark(px0, py0, [240, 240, 250], 0.3);
  return c;
}

export const BOMB_W = 7;
export const BOMB_H = 11;
export const BOMB_FRAMES = 4;

/** A falling bomb: an iron teardrop nose down, tail fins in the look's colour, wobbling as it drops (frames tilt it). */
export function bombFrame(look: AviatorLook, f: number): PixelCanvas {
  const c = new PixelCanvas(BOMB_W, BOMB_H);
  const tilt = [0, 0.35, 0, -0.35][f % 4];
  const cx = 3.5;
  c.part();
  // The fins at the top.
  for (const dx of [-1.6, 1.6]) c.line(cx + tilt * 2 + dx, 1, cx + tilt * 2 + dx * 0.6, 3.5, look.fin, () => sphere(dx * 0.4, 0));
  c.part();
  c.capsule(cx + tilt * 1.6, 3, cx - tilt * 0.6, 8.2, 1.4, 2.0, BOMB_IRON);
  c.part();
  c.px(cx + tilt - 0.5, 5, look.ace ? CANVAS_CREAM : CANVAS_YELLOW, sphere(-0.3, 0));
  c.px(cx + tilt + 0.5, 5, look.ace ? CANVAS_CREAM : CANVAS_YELLOW, sphere(0.3, 0), { bias: -1 });
  return c;
}

// ---------------------------------------------------------------------------
// Button icons

const FLARE_TONES: Tones = [hex('#fffbe8'), hex('#ffd870'), hex('#ff8a2a'), hex('#a8380e')];
const ACE_TONES: Tones = [hex('#ffffff'), hex('#ffd6d0'), hex('#ff4a42'), hex('#8a0c18')];

/** The flare pistol: a fat-barrelled pistol on the diagonal, a flare streaking out of it trailing sparks. */
export function flareIcon(ace = false): Uint8ClampedArray {
  const t = ace ? ACE_TONES : FLARE_TONES;
  const barrel: RGB = ace ? hex('#de3c30') : hex('#dcae4a');
  const dark: RGB = ace ? hex('#700c10') : hex('#6a4418');
  const grip: RGB = hex('#5a3218');
  return icon16((put) => {
    // The grip, the barrel's two tones, the muzzle.
    seg(put, 3, 14, 2, 11, grip);
    seg(put, 4, 14, 3, 11, grip);
    for (let i = 0; i <= 5; i++) {
      put(2 + i, 10 - i, barrel);
      put(3 + i, 10 - i, barrel);
      put(3 + i, 11 - i, dark);
    }
    put(8, 4, hex('#ffffff'));
    // The flare's streak and its sparks.
    seg(put, 9, 4, 13, 1, t[1]);
    seg(put, 10, 4, 14, 1, t[2]);
    put(14, 1, t[0]);
    put(13, 1, t[0]);
    put(14, 2, t[0]);
    put(15, 0, t[1]);
    for (const [x, y] of [[12, 5], [15, 4], [11, 2], [14, 6]]) put(x, y, t[2]);
    put(7, 12, t[3]);
    put(9, 13, t[3]);
  });
}

/** The rocket hop: a little figure flying up an arc on twin flames, a smoke trail curling behind. */
export function hopIcon(ace = false): Uint8ClampedArray {
  const t = ace ? ACE_TONES : FLARE_TONES;
  const smoke: RGB = hex('#8a8690');
  const smokeLt: RGB = hex('#c2bec8');
  const jacket: RGB = ace ? hex('#be2a2c') : hex('#8e5228');
  const tank: RGB = ace ? hex('#aab4c8') : hex('#dcae4a');
  const scarf: RGB = ace ? hex('#f8eedc') : hex('#ffffff');
  return icon16((put) => {
    // The smoke trail, up from the ground behind.
    for (let i = 0; i < 9; i++) {
      const x = 1 + i * 0.9;
      const y = 14 - Math.sin((i / 9) * 1.4) * 8;
      put(x, y, i % 2 ? smoke : smokeLt);
      if (i > 3) put(x, y + 1, smoke);
    }
    // The flyer: pack, body, head, scarf streaming.
    for (let y = 4; y <= 8; y++) for (let x = 9; x <= 11; x++) put(x, y, jacket);
    put(8, 5, tank);
    put(8, 6, tank);
    put(8, 7, tank);
    for (const [x, y] of [[10, 2], [11, 2], [10, 3], [11, 3]]) put(x, y, hex('#e8b48c'));
    put(10, 1, hex('#4a2814'));
    put(11, 1, hex('#4a2814'));
    seg(put, 9, 4, 6, 3, scarf);
    put(12, 5, jacket);
    put(13, 4, jacket);
    // Legs tucked, and the jets.
    put(10, 9, hex('#a09062'));
    put(11, 9, hex('#a09062'));
    put(11, 10, hex('#3c2214'));
    put(8, 9, t[0]);
    put(7, 10, t[1]);
    put(8, 10, t[1]);
    put(6, 11, t[2]);
    put(7, 12, t[3]);
  });
}

// ---------------------------------------------------------------------------
// Textures

/**
 * Everything of the Aviator's that isn't her hero sheet (see heroSheets.ts):
 * per look, the biplane ('plane_<look>': frames 'p<heading>_<prop>'), its
 * bombs ('bomb_<look>': 'b0'..'b3'), and her two button icons
 * ('icon_flare_<look>', 'icon_hop_<look>').
 */
export function aviatorTextures(reg: FxRegistrar): void {
  for (const look of AVIATOR_LOOKS) {
    const planes: { name: string; canvas: PixelCanvas }[] = [];
    for (let h = 0; h < PLANE_HEADINGS; h++) for (const prop of [0, 1]) planes.push({ name: `p${h}_${prop}`, canvas: planeFrame(look, h, prop) });
    reg.frames(`plane_${look.key}`, planes, PLANE_SIZE, PLANE_SIZE);
    reg.frames(`bomb_${look.key}`, Array.from({ length: BOMB_FRAMES }, (_, f) => ({ name: `b${f}`, canvas: bombFrame(look, f) })), BOMB_W, BOMB_H);
    reg.image(`icon_flare_${look.key}`, 16, 16, flareIcon(look.ace));
    reg.image(`icon_hop_${look.key}`, 16, 16, hopIcon(look.ace));
  }
}
