// The Lich, the necromancer kit's third type, drawn procedurally on his own
// rig (in the manner of the necromancer's: hands posed in the caster's terms
// and placed for each view).
//
// An undead sorcerer-king of frost and bone. A bare skull, ice-blue lights
// burning deep in its sockets, sits low in a great mantle of frost-rimed
// fur, an iron crown on its brow whose points are shards of ice. Heavy
// midnight-blue robes fall to the ground, a silver-edged panel down the
// front, the hem white with rime; his bony hands come out of fur-cuffed bell
// sleeves. His staff is black, and at its head two iron prongs curl up round
// nothing: above them, held in the air, turns his phylactery, a diamond of
// blue light that is his soul. Cold breath steams from his teeth.
//
// The Drowned King is his skin: a sea king risen from the deep. The same
// skull under a verdigris crown crusted with barnacles and set with coral
// points, kelp hanging from his shoulders in place of the fur, robes of sea
// green gone black at the hem, sea-fire teal in his eyes, a staff of
// driftwood with coral branching round a pearl for his phylactery, and water
// dripping from everything.
//
// The body keeps to the 24x32 box; frames are larger so the staff can be
// raised overhead and the frost can creep out round his feet.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { iconPainter } from './effects';
import { DIRS, type Dir } from './wizard';

export const LICH_W = 48;
export const LICH_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const LICH_ORIGIN_X = BODY_X + 12;
export const LICH_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet a bolt leaves the casting hand at. */
export const LICH_BOLT_H = 14;

/** A hand, in the caster's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
interface Hand {
  f: number;
  s: number;
  h: number;
}

interface Pose {
  /** Whole body raised. */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Feet under the hem. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The casting hand (screen left from the front and back, the far arm from the side) and the staff hand. */
  a: Hand;
  b: Hand;
  /** The staff leaning out from upright. */
  tilt: number;
  /** 0..1 frost gathering in the casting palm. */
  palm: number;
  /** 0..1 the phylactery blazing. */
  flare: number;
  /** The robe's hem swinging, in pixels. */
  sway: number;
  /** Frame counter, for the gem's bob and the motes. */
  tick: number;
  /** 0..1 cold breath steaming from his teeth. */
  mist: number;
  /** 0..1 the lights in his sockets (dim between breaths). */
  eyes: number;
  /** The idle moment's: the head shifted (x, y) (front view only). */
  head?: [number, number];
  /** The idle moment's: the phylactery off the staff, at (x, y) in body coordinates, pulsing at `glow`. */
  gem?: { x: number; y: number; glow: number };
  /** The idle moment's: 0..1 frost creeping out over the ground round his feet. */
  frost?: number;
}

/** One look for the lich: its texture key, cloth, mantle, bone, crown and staff. */
export interface LichLook {
  key: string;
  robe: Material;
  inner: Material;
  trim: Material;
  /** The frost-rimed fur over his shoulders (or the drowned king's kelp). */
  mantle: Material;
  bone: Material;
  crown: Material;
  /** The crown's points and the staff's tips: ice (or coral). */
  points: Material;
  eye: Material;
  /** The phylactery: an ice-blue diamond (or a pearl). */
  gem: Material;
  shaft: Material;
  prong: Material;
  /** The drowned king: kelp, barnacles, coral, a pearl, and water dripping. */
  sea: boolean;
  /** His magic's light, brightest first. */
  light: [RGB, RGB, RGB, RGB];
}

const ramp = (...c: string[]): RGB[] => c.map(hex);

const ROBE: Material = { ramp: ramp('#080a18', '#10142c', '#1a2044', '#262f5e', '#36427a'), outline: hex('#04050c'), outlineLit: hex('#0b0e20') };
const INNER: Material = { ramp: ramp('#04050c', '#090b18', '#10142a', '#181e3a'), outline: hex('#020306') };
const SILVER: Material = { ramp: ramp('#3a4458', '#64728c', '#98a8c0', '#c8d6e8', '#eef6ff'), outline: hex('#121824'), shine: true };
const FUR: Material = { ramp: ramp('#3a4250', '#5e6878', '#8a96a8', '#b8c6d4', '#e2eef8'), outline: hex('#141820'), outlineLit: hex('#242a36') };
const BONE: Material = { ramp: ramp('#3c3c42', '#68665f', '#9c988a', '#cac4b0', '#eee8d4'), outline: hex('#121214') };
const IRON: Material = { ramp: ramp('#14161e', '#262a38', '#3c4254', '#5a6276', '#828ca2'), outline: hex('#06070a'), shine: true };
const ICE: Material = { ramp: ramp('#18406e', '#2a64a0', '#4a92cc', '#7cc2ea', '#bce8fc'), outline: hex('#081830'), emissive: 0.2, shine: true };
const EYE: Material = { ramp: ramp('#2a8ad8', '#6ad4ff'), outline: hex('#04060c'), emissive: 0.9, noAO: true };
const SOUL_GEM: Material = { ramp: ramp('#123c88', '#2266c8', '#3a9af0', '#8ad4ff'), outline: hex('#061430'), emissive: 0.7, noAO: true };
const SHAFT: Material = { ramp: ramp('#100e16', '#1e1a26', '#2e2a3a', '#423c52'), outline: hex('#050408') };

const SEA_ROBE: Material = { ramp: ramp('#061410', '#0c221a', '#143628', '#1e4c38', '#2c664c'), outline: hex('#020806'), outlineLit: hex('#071410') };
const SEA_INNER: Material = { ramp: ramp('#030a08', '#071410', '#0c1e18', '#122a22'), outline: hex('#010403') };
const VERDIGRIS: Material = { ramp: ramp('#183630', '#285a4c', '#3c866e', '#5eb094', '#98dabc'), outline: hex('#08140f'), shine: true };
const KELP: Material = { ramp: ramp('#0c1a06', '#182c0e', '#264218', '#385a22', '#4e7630'), outline: hex('#050a02'), outlineLit: hex('#0c1606') };
const SEA_BONE: Material = { ramp: ramp('#343a34', '#5a6258', '#8a9282', '#b8bea8', '#dfe4cc'), outline: hex('#0e100c') };
const CORAL: Material = { ramp: ramp('#561222', '#962a36', '#d0504a', '#f28a70', '#ffc6a8'), outline: hex('#1c0408'), emissive: 0.12, shine: true };
const SEA_EYE: Material = { ramp: ramp('#14c8a4', '#4af4d0'), outline: hex('#020806'), emissive: 0.9, noAO: true };
const PEARL: Material = { ramp: ramp('#6a7894', '#a8b4c8', '#dce4ee', '#ffffff'), outline: hex('#141a26'), emissive: 0.55, noAO: true, shine: true };
const DRIFT: Material = { ramp: ramp('#2a2218', '#463a2a', '#6a5a42', '#92805e'), outline: hex('#0c0906') };
const BARNACLE: Material = { ramp: ramp('#4a4640', '#7a7468', '#aaa496', '#d8d4c6'), outline: hex('#141210') };

const ICE_CORE = hex('#f4fdff');
const ICE_HOT = hex('#a8e8ff');
const ICE_MID = hex('#4ab4f0');
const ICE_DEEP = hex('#1c4aa8');
const SEA_CORE = hex('#f0fffa');
const SEA_HOT = hex('#9cffe4');
const SEA_MID = hex('#2ad8b4');
const SEA_DEEP = hex('#0c6a72');

export const LICH_LOOK: LichLook = {
  key: 'necro_lich',
  robe: ROBE,
  inner: INNER,
  trim: SILVER,
  mantle: FUR,
  bone: BONE,
  crown: IRON,
  points: ICE,
  eye: EYE,
  gem: SOUL_GEM,
  shaft: SHAFT,
  prong: IRON,
  sea: false,
  light: [ICE_CORE, ICE_HOT, ICE_MID, ICE_DEEP],
};

/** The Drowned King: sea green and verdigris, kelp and coral, a pearl for a soul. */
export const DROWNED_LOOK: LichLook = {
  key: 'necro_drowned',
  robe: SEA_ROBE,
  inner: SEA_INNER,
  trim: VERDIGRIS,
  mantle: KELP,
  bone: SEA_BONE,
  crown: VERDIGRIS,
  points: CORAL,
  eye: SEA_EYE,
  gem: PEARL,
  shaft: DRIFT,
  prong: CORAL,
  sea: true,
  light: [SEA_CORE, SEA_HOT, SEA_MID, SEA_DEEP],
};

export const LICH_LOOKS = [LICH_LOOK, DROWNED_LOOK];

/** The look being drawn; set by buildLichFrames. */
let S: LichLook = LICH_LOOK;

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

/** A cheap repeatable hash for scattering tufts, barnacles and rime. */
const hash = (a: number, b: number): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** His magic's light: a small cross of it, the arms growing with `k`. */
function flareAt(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.light;
  c.spark(x, y, core, k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + dx, y + dy, hot, 0.65 * k);
  if (k > 0.6) {
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) c.spark(x + dx, y + dy, mid, 0.5 * k);
    for (const [dx, dy] of [[0, -3], [0, 3], [-3, 0], [3, 0]]) c.spark(x + dx, y + dy, mid, 0.25 * k);
  }
}

// ---------------------------------------------------------------------------
// The staff and the phylactery

/** From the grip towards the staff's head. */
function staffDir(view: View, tilt: number): [number, number] {
  if (view === 'side') {
    const a = tilt * 1.35;
    return [-Math.sin(a), -Math.cos(a)];
  }
  const a = tilt * 0.75;
  return [Math.sin(a), -Math.cos(a)];
}

const STAFF_TOP = 14;
const STAFF_BOT = 9.5;
/** How far over the prongs the phylactery floats. */
const GEM_LIFT = 3.6;

/**
 * The phylactery at (x, y): a diamond of blue light (or the drowned king's
 * pearl), glinting, ringed with light as it pulses (`glow` over 0.6).
 */
function phylactery(c: PixelCanvas, x: number, y: number, glow: number, tick: number): void {
  const [core, hot, mid, deep] = S.light;
  c.part();
  if (S.sea) {
    c.ellipse(x, y, 1.45, 1.45, S.gem, { glow: 0.45 + glow * 0.4 });
    c.spark(x - 0.6, y - 0.6, core, 0.5 + glow * 0.4);
    c.spark(x + 0.4, y + 0.4, hot, 0.3 * glow);
  } else {
    const n = (dx: number, dy: number) => sphere(dx * 0.7, dy * 0.6 - 0.2, 1);
    const cells: [number, number][] = [[0, -2], [-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [0, 1]];
    for (const [dx, dy] of cells) c.px(x + dx, y + dy, S.gem, n(dx, dy), { glow: 0.6 + glow * 0.35 });
    // A facet's glint, and the heart of it.
    c.spark(x - 1, y - 1, core, 0.55 + glow * 0.4);
    c.spark(x, y, core, 0.35 + glow * 0.4);
  }
  // Motes of its light circling it.
  for (let i = 0; i < 2; i++) {
    const a = tick * 1.1 + i * Math.PI;
    c.spark(x + Math.cos(a) * 2.6, y + Math.sin(a) * 1.4, i ? mid : hot, 0.4 + glow * 0.3);
  }
  if (glow > 0.6) {
    const k = (glow - 0.6) / 0.4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.spark(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.4, i & 1 ? deep : mid, 0.25 + 0.4 * k);
    }
    c.spark(x, y - 3.4, hot, 0.4 * k);
    c.spark(x, y + 2.6, hot, 0.3 * k);
  }
}

/**
 * The staff in the hand: a black shaft (driftwood for the drowned king)
 * through the grip, and at its head two iron prongs curling up round the
 * floating phylactery (or coral branching round the pearl).
 */
function drawStaff(c: PixelCanvas, view: View, p: Pose, fb: Placed, bias = 0): void {
  const [ux, uy] = staffDir(view, p.tilt);
  const vx = -uy;
  const vy = ux;
  c.part();
  c.capsule(fb.x - ux * STAFF_BOT, fb.y - uy * STAFF_BOT, fb.x + ux * STAFF_TOP, fb.y + uy * STAFF_TOP, 0.7, 0.75, S.shaft, { bias });
  // Bands of silver (or knots of the driftwood) down the shaft.
  c.part();
  for (const t of [-6.5, 5, 9.5]) {
    if (S.sea) c.shade(fb.x + ux * t + 0.5, fb.y + uy * t, -1);
    else c.px(fb.x + ux * t, fb.y + uy * t, S.trim, sphere(0, -0.3), { bias });
  }
  const hx = fb.x + ux * STAFF_TOP;
  const hy = fb.y + uy * STAFF_TOP;
  const at = (a: number, b: number): [number, number] => [hx + ux * a + vx * b, hy + uy * a + vy * b];
  c.part();
  if (S.sea) {
    // Coral branching up out of the driftwood, three ways, knobbed at the tips.
    for (const s of [-1, 1]) {
      const k = at(0.6, s * 0.6);
      const m = at(1.8, s * 2.0);
      const t = at(3.6, s * 2.4);
      c.capsule(k[0], k[1], m[0], m[1], 0.6, 0.5, S.prong, { bias });
      c.capsule(m[0], m[1], t[0], t[1], 0.5, 0.45, S.prong, { bias });
      const twig = at(2.4, s * 3.4);
      c.px(twig[0], twig[1], S.prong, sphere(s * 0.6, -0.4), { bias });
      c.px(t[0], t[1], S.prong, sphere(s * 0.3, -0.8), { bias: bias + 1 });
    }
  } else {
    // Iron prongs curling out and up, each tipped with a sliver of ice.
    for (const s of [-1, 1]) {
      const pts = [at(-0.4, s * 0.4), at(0.9, s * 1.8), at(2.4, s * 2.4), at(3.9, s * 1.9)];
      for (let i = 0; i < pts.length - 1; i++) c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0.62 - i * 0.08, 0.55 - i * 0.08, S.prong, { bias });
      const tip = at(4.9, s * 1.5);
      c.px(tip[0], tip[1], S.points, sphere(s * 0.3, -0.8), { bias: bias + 1 });
    }
    // Rime on the iron.
    const r = at(1.2, 1.4);
    c.spark(r[0], r[1], S.light[1], 0.35);
  }
  if (p.gem) return;
  // The phylactery, held in the air over the prongs, bobbing.
  const bob = [0, -0.5, -1, -0.5, 0, 0.5][p.tick % 6];
  const g = at(GEM_LIFT - bob, 0);
  const glow = 0.4 + p.flare * 0.6;
  phylactery(c, g[0], g[1], glow, p.tick);
  flareAt(c, g[0], g[1], p.flare);
}

// ---------------------------------------------------------------------------
// Parts

/**
 * A heavy bell-sleeved arm from the shoulder, bent at the elbow (towards
 * `hint`), the sleeve widening to a cuff of fur (or kelp) and a bony hand;
 * the casting hand fills with frost.
 */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], palm: number, bias = 0, piece: 'all' | 'upper' | 'lower' = 'all'): void {
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
  const k = 0.76;
  const wx = ex + (fx - ex) * k;
  const wy = ey + (fy - ey) * k;
  if (piece !== 'lower') {
    c.part();
    c.capsule(sx, sy, ex, ey, 1.75, 1.6, S.robe, { bias });
  }
  if (piece === 'upper') return;
  c.part();
  c.capsule(ex, ey, wx, wy, 1.6, 2.1, S.robe, { bias });
  // The cuff: a thick roll of fur (or a fringe of kelp) round the sleeve's mouth.
  const nl = Math.hypot(fy - ey, fx - ex) || 1;
  const [nx, ny] = [-(fy - ey) / nl, (fx - ex) / nl];
  c.part();
  c.capsule(wx - nx * 1.7, wy - ny * 1.7, wx + nx * 1.7, wy + ny * 1.7, 0.75, 0.75, S.mantle, { bias });
  if (!S.sea) c.spark(wx - nx * 1.2, wy - ny * 1.2 - 0.5, S.light[1], 0.25);
  // The hand: bare bone, two fingers' worth of claw.
  c.part();
  c.ellipse(fx, fy, 1.15, 1.05, S.bone, { bias });
  const ox = (fx - wx) / (Math.hypot(fx - wx, fy - wy) || 1);
  const oy = (fy - wy) / (Math.hypot(fx - wx, fy - wy) || 1);
  c.px(fx + ox * 1.6 - 0.5, fy + oy * 1.6, S.bone, sphere(ox * 0.5, oy * 0.5 - 0.3), { bias });
  if (palm > 0) {
    const [core, hot, mid, deep] = S.light;
    c.spark(fx, fy, core, palm);
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, -1], [0, 1]]) c.spark(fx + ax, fy + ay, hot, 0.55 * palm);
    if (palm > 0.45) {
      // A crystal of ice forming over the palm, motes drawn in to it.
      c.spark(fx, fy - 2, hot, 0.7 * palm);
      c.spark(fx, fy - 3, mid, 0.5 * palm);
      for (const [ax, ay] of [[-2, -1], [2, -1], [-2, 1], [2, 1]]) c.spark(fx + ax, fy + ay, palm > 0.8 ? mid : deep, 0.45 * palm);
    }
  }
}

/** An iron-shod foot (bare bone for the drowned king) under the hem. */
function foot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  const m = S.sea ? S.bone : S.crown;
  if (side) c.ellipse(x - 0.4, y, 2.1, 1.1, m, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.5, 1.2, m, { flatten: 0.8, bias });
}

/** The robe's outline: broad at the shoulders, falling heavy to the ground. */
function robeWidth(u: number, chest: number, flare: number): number {
  return chest + u * u * flare;
}

/** The front panel down from the belt: darker cloth, edged in silver (verdigris), a rune of frost (a shell) on it. */
function panel(c: PixelCanvas, cx: number, waist: number, hem: number, sway: number): void {
  c.part();
  for (let y = waist + 1; y <= hem; y++) {
    const u = (y - waist) / Math.max(1, hem - waist);
    const w = 1.2 + u * 1.0;
    const x0 = cx - w + u * u * sway;
    const x1 = cx + w + u * u * sway;
    for (let x = Math.round(x0); x < Math.round(x1); x++) if (c.filled(x, y)) c.px(x, y, S.inner, sphere(0, 0.2), { bias: -1 });
    if (c.filled(Math.round(x0) - 1, y)) c.px(Math.round(x0) - 1, y, S.trim, sphere(-0.3, 0));
    if (c.filled(Math.round(x1), y)) c.px(Math.round(x1), y, S.trim, sphere(0.3, 0));
  }
  // The rune: a small cross of light (the lich), a scallop shell (the drowned king).
  const x = Math.round(cx + 0.25 * sway) - 1;
  const y = waist + 3;
  const [, hot, mid] = S.light;
  if (S.sea) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) c.px(x + dx + 0.5, y + dy, S.trim, sphere(dx * 0.4, -0.2), { bias: -1 });
  } else {
    c.spark(x + 0.5, y + 1, hot, 0.55);
    c.spark(x + 0.5, y, mid, 0.4);
    c.spark(x + 0.5, y + 2, mid, 0.4);
    c.spark(x - 0.5, y + 1, mid, 0.35);
    c.spark(x + 1.5, y + 1, mid, 0.35);
  }
}

/** The hem's bottom row: white with rime (the lich), or ragged and dripping (the drowned king). */
function hemEdge(c: PixelCanvas, hem: number, x0: number, x1: number, tick: number): void {
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (!c.filled(x, hem)) continue;
    if (S.sea) {
      // Torn: a notch here and there; the trim between.
      if (hash(x, 3) < 0.28) c.erase(x, hem);
      else c.px(x, hem, S.trim, sphere(0, 0.4), { bias: -1 });
      if (hash(x, 9) < 0.18 && c.filled(x, hem - 1)) c.shade(x, hem - 1, -1);
    } else {
      c.px(x, hem, S.trim, sphere(0, 0.4));
      if (hash(x, 5) < 0.4 && c.filled(x, hem - 1)) c.shade(x, hem - 1, 1);
      if (hash(x, tick + 11) < 0.12) c.spark(x, hem, S.light[1], 0.4);
    }
  }
  if (S.sea) {
    // Water dripping from the hem.
    const drip = [[-4, 0], [3, 2], [0, 4], [-2, 1], [5, 3], [1, 5]];
    const [dx, ph] = drip[tick % drip.length];
    const cx = (x0 + x1) / 2;
    c.spark(cx + dx, hem + 1 + (ph % 2), S.light[2], 0.5);
  }
}

/**
 * The mantle over his shoulders, seen from the front or behind: a great
 * roll of fur, its lower edge in shaggy tufts, its top white with frost; or
 * for the drowned king a collar of kelp with long strands hanging from it.
 */
function mantleFront(c: PixelCanvas, cx: number, U: number, l: number, r: number, sway: number, back: boolean): void {
  const cy = 16.7 + U;
  c.part();
  if (S.sea) {
    c.shape(Math.round(14 + U), Math.round(17 + U), (y) => {
      const u = (y - 14 - U) / 3;
      const k = 0.8 + Math.sqrt(Math.max(0, u)) * 0.2;
      return [cx - l * k, cx + r * k];
    }, S.mantle, (_x, _y, t, u) => sphere(t * 0.9, u * 0.7 - 0.4, 1));
    // Strands hanging down, swaying, a leaf here and there.
    c.part();
    const strands = back ? [-4.6, -2.2, 0.2, 2.6, 4.8] : [-5.2, -3.6, 3.2, 5.0];
    strands.forEach((sx, i) => {
      const len = 5 + Math.round(hash(i, 7) * 4);
      for (let k = 0; k <= len; k++) {
        const x = cx + sx + Math.sin(k * 0.9 + i) * 0.5 + (k / len) * sway * 0.6;
        const y = 17 + U + k;
        c.px(x, y, S.mantle, sphere(sx < 0 ? -0.4 : 0.4, 0.2), { bias: k > len - 2 ? -1 : 0 });
        if (k % 3 === 1) c.px(x + (sx < 0 ? -1 : 1), y, S.mantle, sphere(sx < 0 ? -0.7 : 0.7, 0), { bias: -1 });
      }
    });
    // Barnacles crusting the shoulders.
    c.part();
    for (const [bx, by] of [[-4, 15], [4, 15], [-5, 16]]) c.px(cx + bx, by + U, BARNACLE, sphere(bx < 0 ? -0.4 : 0.4, -0.5));
    return;
  }
  for (let y = Math.floor(cy - 3); y <= Math.ceil(cy + 3.4); y++) {
    for (let x = Math.floor(cx - l - 1); x <= Math.ceil(cx + r + 1); x++) {
      const w = x + 0.5 < cx ? l : r;
      const dx = (x + 0.5 - cx) / w;
      const dy = (y + 0.5 - cy) / 2.7;
      // Tufts: the lower edge is ragged.
      const tuft = dy > 0 ? (hash(x, 1) - 0.5) * 0.5 : 0;
      if (dx * dx + dy * dy > 1 + tuft) continue;
      c.px(x, y, S.mantle, sphere(dx * 0.85, dy * 0.75 - 0.25, 1));
    }
  }
  // Locks of fur: a dark parting every few pixels along the lower edge, frost glittering on top.
  for (let x = Math.floor(cx - l); x <= Math.ceil(cx + r); x += 2) {
    for (let y = Math.ceil(cy + 3.4); y >= cy; y--) {
      if (c.filled(x, y) && c.materialAt(x, y) === S.mantle) {
        c.shade(x, y - 1, -1);
        break;
      }
    }
  }
  for (let x = Math.floor(cx - l); x <= Math.ceil(cx + r); x++) {
    for (let y = Math.floor(cy - 3); y < cy; y++) {
      if (c.materialAt(x, y) !== S.mantle) continue;
      c.shade(x, y, 1);
      if (hash(x, 13) < 0.3) c.spark(x, y, S.light[1], 0.3);
      break;
    }
  }
}

/** The mantle from the side, facing left: the fur bunched over his shoulder (the kelp hanging from it). */
function mantleSide(c: PixelCanvas, hx: number, U: number, sway: number): void {
  U += 0.5;
  c.part();
  if (S.sea) {
    c.shape(Math.round(14 + U), Math.round(17 + U), (y) => {
      const u = (y - 14 - U) / 3;
      return [hx - 3.6 - u * 0.4, hx + 3.8 + u * 0.4];
    }, S.mantle, (_x, _y, t, u) => sphere(t * 0.9, u * 0.7 - 0.4, 1));
    c.part();
    [-3.2, 1.0, 3.4].forEach((sx, i) => {
      const len = 5 + Math.round(hash(i, 5) * 4);
      for (let k = 0; k <= len; k++) c.px(hx + sx + Math.sin(k * 0.9 + i) * 0.5 + (k / len) * (sway * 0.6 + 0.8), 17 + U + k, S.mantle, sphere(0.3, 0.2), { bias: k > len - 2 ? -1 : 0 });
    });
    c.part();
    c.px(hx + 2, 15 + U, BARNACLE, sphere(0.2, -0.6));
    c.px(hx - 2, 15 + U, BARNACLE, sphere(-0.3, -0.6));
    return;
  }
  const cy = 16 + U;
  for (let y = Math.floor(cy - 3); y <= Math.ceil(cy + 3.2); y++) {
    for (let x = Math.floor(hx - 5); x <= Math.ceil(hx + 6); x++) {
      const dx = (x + 0.5 - hx - 0.4) / 4.6;
      const dy = (y + 0.5 - cy) / 2.6;
      const tuft = dy > 0 ? (hash(x, 2) - 0.5) * 0.5 : 0;
      if (dx * dx + dy * dy > 1 + tuft) continue;
      c.px(x, y, S.mantle, sphere(dx * 0.85 + 0.1, dy * 0.75 - 0.25, 1));
    }
  }
  for (let x = Math.floor(hx - 4); x <= Math.ceil(hx + 5); x++) {
    for (let y = Math.floor(cy - 3); y < cy; y++) {
      if (c.materialAt(x, y) !== S.mantle) continue;
      c.shade(x, y, 1);
      if (hash(x, 17) < 0.3) c.spark(x, y, S.light[1], 0.3);
      break;
    }
  }
}

// The skull is 7 px across, its middle column at x = cx (the body's centre
// line is between two columns, so the skull sits half a pixel to the right).
// Rows from the top: crown points 3-6, the band 7-8, brow 9, eyes 10, nose
// 11, teeth 12, jaw 13; the mantle rises to 14.

/** The crown: a band round the skull's brow and its points, seen from the front or behind; `back` hides the stone. */
function crownFront(c: PixelCanvas, x: number, U: number, back: boolean, tick: number): void {
  c.part();
  c.shape(Math.round(7 + U), Math.round(8 + U), () => [x - 3.5, x + 4.5], S.crown, (_x, y, t) => cyl(t, y < 8 + U ? -0.45 : 0.15));
  // Studs along the band.
  for (const dx of [-3, 3]) c.shade(x + dx, 8 + U, 1);
  // The points: a tall one in the middle, a short one at each side, shards of ice (or coral, curling outwards).
  c.part();
  const pts: [number, number][] = [[-3, 2], [0, 4], [3, 2]];
  for (const [dx, h] of pts) {
    for (let k = 1; k <= h; k++) {
      const lean = S.sea && dx !== 0 && k === h ? Math.sign(dx) : 0;
      c.px(x + dx + lean, 7 + U - k, S.points, sphere(dx * 0.2 - 0.25, -0.1 - k * 0.15), { bias: k === h ? 1 : 0 });
      // The middle point is broad at its root.
      if (dx === 0 && k <= 2) {
        c.px(x - 1, 7 + U - k, S.points, sphere(-0.6, -0.2), { bias: k === 2 ? 0 : -1 });
        c.px(x + 1, 7 + U - k, S.points, sphere(0.6, -0.2), { bias: k === 2 ? -1 : -1 });
      }
    }
    if (!S.sea) c.spark(x + dx, 7 + U - h, S.light[1], dx === 0 ? 0.55 : 0.3);
  }
  if (S.sea) {
    c.part();
    for (const dx of [-2, 2]) c.px(x + dx, 7 + U, BARNACLE, sphere(dx * 0.2, -0.5));
  }
  if (back) return;
  // A stone of the phylactery's light at the brow.
  c.part();
  c.px(x, 8 + U, S.gem, sphere(0, -0.2), { glow: 0.8 });
  c.spark(x, 8 + U, S.light[1], 0.4 + (tick % 3 === 0 ? 0.2 : 0));
}

/** Cold breath steaming from his teeth at (x, y), drifting `dir` (-1 left, 1 right, 0 out to both). */
function mist(c: PixelCanvas, x: number, y: number, k: number, tick: number, dir: number): void {
  if (k <= 0) return;
  const [, hot, mid] = S.light;
  const puffs: [number, number][] = dir === 0 ? [[-1, 1], [1, 1], [-2, 0], [2, 0], [-3, -1], [3, -1]] : [[dir, 0], [dir * 2, -1], [dir * 3, -1], [dir * 3, -2], [dir * 4, -3]];
  puffs.forEach(([dx, dy], i) => {
    const drift = ((tick + i) % 3) * 0.4;
    c.spark(x + dx, y + dy - drift, i < 2 ? hot : mid, k * (0.45 - i * 0.05));
  });
}

/** The skull from the front: cranium, burning sockets, the nasal pit, a grin of teeth, the crown. */
function headDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const x = cx;
  c.part();
  c.ellipse(x + 0.5, 10 + U, 3.5, 3.1, S.bone, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  // The jaw, narrower, under the cheekbones.
  c.part();
  c.shape(Math.round(13 + U), Math.round(13 + U), () => [x - 1.5, x + 2.5], S.bone, (_x, _y, t) => sphere(t * 0.8, 0.6, 1));
  // Hollow temples, deep sockets, the light burning in them.
  c.part();
  c.shade(x - 3, 11 + U, -1);
  c.shade(x + 3, 11 + U, -1);
  for (const s of [-1, 1]) {
    c.shade(x + s * 2, 9 + U, -1);
    c.px(x + s, 10 + U, S.inner);
    c.px(x + s * 2, 10 + U, S.eye, sphere(0, 0), { glow: 0.5 + p.eyes * 0.5 });
    c.spark(x + s * 2, 10 + U, S.light[1], 0.25 + p.eyes * 0.3);
  }
  c.px(x, 11 + U, S.inner);
  // Teeth: gaps between them; the jaw's corners in shadow.
  for (const dx of [-2, 0, 2]) c.shade(x + dx, 12 + U, -2);
  c.shade(x - 1, 13 + U, -1);
  c.shade(x + 1, 13 + U, -1);
  crownFront(c, x, U, false, p.tick);
  mist(c, x, 14 + U, p.mist, p.tick, 0);
}

/** The skull from behind: the bare back of the cranium under the crown. */
function headUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const x = cx;
  c.part();
  c.ellipse(x + 0.5, 10.2 + U, 3.5, 3.1, S.bone, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  // A crack running down the back of it.
  c.shade(x + 1, 9 + U, -1);
  c.shade(x, 10 + U, -1);
  c.shade(x, 11 + U, -1);
  c.shade(x - 1, 12 + U, -1);
  crownFront(c, x, U, true, p.tick);
}

/** The skull in profile, facing left: cranium, the socket alight, the teeth jutting, the jaw back under it. */
function headSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  const x = Math.round(hx);
  c.part();
  c.ellipse(x + 0.3, 10 + U, 3.2, 3.1, S.bone, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 - 0.1, dy * 0.8 - 0.2, 1) });
  // The face juts forward: cheekbone and teeth, the jaw sloping back under them.
  c.part();
  c.shape(Math.round(11 + U), Math.round(13 + U), (y) => {
    const k = y - 11 - U;
    return [x - 3.5 + k * 0.6, x + 1.5 - k * 0.6];
  }, S.bone, (_x, _y, t, u) => sphere(t * 0.7 - 0.2, 0.2 + u * 0.4, 1));
  c.part();
  c.shade(x - 2, 9 + U, -1);
  c.px(x - 1, 10 + U, S.inner);
  c.px(x - 2, 10 + U, S.eye, sphere(0, 0), { glow: 0.5 + p.eyes * 0.5 });
  c.spark(x - 2, 10 + U, S.light[1], 0.25 + p.eyes * 0.3);
  c.px(x - 3, 11 + U, S.inner);
  c.shade(x + 1, 11 + U, -1);
  c.shade(x - 2, 12 + U, -2);
  c.shade(x, 12 + U, -2);
  c.shade(x - 1, 13 + U, -1);
  // The crown in profile: band, a point at the brow, the tall one, one behind.
  c.part();
  c.shape(Math.round(7 + U), Math.round(8 + U), () => [x - 3.4, x + 3.6], S.crown, (_x, y, t) => cyl(t * 0.8 - 0.2, y < 8 + U ? -0.45 : 0.15));
  c.part();
  for (const [dx, h] of [[-3, 2], [0, 4], [3, 2]] as const) {
    for (let k = 1; k <= h; k++) {
      const lean = S.sea && dx !== 0 && k === h ? Math.sign(dx) : 0;
      c.px(x + dx + lean, 7 + U - k, S.points, sphere(-0.25, -0.1 - k * 0.15), { bias: k === h ? 1 : dx > 0 ? -1 : 0 });
      if (dx === 0 && k <= 2) c.px(x + 1, 7 + U - k, S.points, sphere(0.5, -0.2), { bias: -1 });
    }
    if (!S.sea) c.spark(x + dx, 7 + U - h, S.light[1], dx === 0 ? 0.55 : 0.3);
  }
  c.part();
  c.px(x - 3, 8 + U, S.gem, sphere(-0.5, -0.2), { glow: 0.8 });
  if (S.sea) c.px(x + 1, 7 + U, BARNACLE, sphere(0, -0.5));
  mist(c, x - 4, 13 + U, p.mist, p.tick, -1);
}

/** Frost creeping out over the ground round his feet (the idle moment): crystals of ice in a widening ring. */
function groundFrost(c: PixelCanvas, k: number, tick: number): void {
  if (k <= 0) return;
  const cx = 12;
  const cy = 30.6;
  const R = 3 + k * 8;
  c.part();
  for (let y = Math.floor(cy - R * 0.45); y <= Math.ceil(cy + R * 0.45); y++) {
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const d = Math.hypot((x + 0.5 - cx) / R, (y + 0.5 - cy) / (R * 0.45));
      if (d > 1) continue;
      // Thicker near him, breaking up into scattered crystals at the rim.
      const keep = hash(x * 3, y * 7) < 1.1 - d * 0.9;
      if (!keep) continue;
      c.px(x, y, S.points, sphere((x + 0.5 - cx) / R * 0.4, -0.6, 1), { bias: d > 0.7 ? -1 : 0, glow: 0.15 });
    }
  }
  // Glints catching the light along the rim.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + tick * 0.4;
    c.spark(cx + Math.cos(a) * R * 0.85, cy + Math.sin(a) * R * 0.38, S.light[i % 2], 0.45 * k);
  }
}

// ---------------------------------------------------------------------------
// Directions

const REACH_FRONT = 4.6;
const REACH_SIDE = 5.2;

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  // An arm in front is drawn in two pieces: the upper sleeve under the mantle's fur, the rest over everything.
  const armA = (piece: 'all' | 'upper' | 'lower' = 'all') => arm(c, 7.2, 16.4 + U, fa, REACH_FRONT, [-0.6, 1], p.palm, fa.behind ? -1 : 0, piece);
  const armB = (piece: 'all' | 'upper' | 'lower' = 'all') => arm(c, 16.8, 16.4 + U, fb, REACH_FRONT, [0.6, 1], 0, fb.behind ? -1 : 0, piece);
  groundFrost(c, p.frost ?? 0, p.tick);
  if (fa.behind) armA();
  if (fb.behind) {
    drawStaff(c, 'down', p, fb, -1);
    armB();
  }

  foot(c, 10, 30.3 - p.footA);
  foot(c, 14, 30.3 - p.footB);

  // The robe, heavy, falling to a hem that swings as he goes.
  const top = 15 + U;
  const hem = 29 + L;
  const waist = 22 + U;
  c.part();
  c.shape(top, hem, (y) => {
    const u = (y - top) / (hem - top);
    const hw = robeWidth(u, 4.9, 2.5);
    const sw = u * u * p.sway;
    return [cx - hw + sw, cx + hw + sw];
  }, S.robe, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  // Deep folds falling from the belt.
  for (let y = waist + 2; y <= hem; y++) {
    const u = (y - top) / (hem - top);
    c.shade(Math.round(cx - 4 + u * u * p.sway - u * 1.4), y, -1);
    c.shade(Math.round(cx + 4 + u * u * p.sway + u * 1.4), y, -1);
  }
  panel(c, cx, waist, hem, p.sway);
  hemEdge(c, hem, cx - 9, cx + 9, p.tick);
  // The belt, a chain of silver, and its clasp.
  c.part();
  c.shape(waist, waist, () => [cx - 4.8, cx + 4.8], S.trim, (_x, _y, t) => cyl(t, 0));
  for (let x = cx - 4; x <= cx + 4; x += 2) c.shade(x, waist, -1);
  c.part();
  c.px(cx - 1, waist, S.gem, sphere(0, -0.3), { glow: 0.6 });
  c.px(cx, waist, S.gem, sphere(0.3, -0.3), { glow: 0.6 });

  const hcx = cx + (p.head?.[0] ?? 0);
  const hU = U + (p.head?.[1] ?? 0);
  if (!fa.behind) armA('upper');
  if (!fb.behind) armB('upper');
  mantleFront(c, cx, U, 6.6, 6.6, p.sway, false);
  headDown(c, hcx, hU, p);
  // The fur's front lip rises round the jaw: the skull sits low in it.
  if (!S.sea) {
    c.part();
    for (const x of [cx - 3, cx - 2, cx + 2, cx + 3]) c.px(x, 13 + U, S.mantle, sphere((x - cx) * 0.25, -0.6), { bias: 1 });
  }

  if (!fb.behind) {
    armB('lower');
    drawStaff(c, 'down', p, fb);
  }
  if (!fa.behind) armA('lower');
  if (p.gem) phylactery(c, p.gem.x, p.gem.y, p.gem.glow, p.tick);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const armA = (piece: 'all' | 'upper' | 'lower' = 'all') => arm(c, 7.2, 16.4 + U, fa, REACH_FRONT, [-0.6, 0.8], p.palm, fa.behind ? -1 : 0, piece);
  const armB = (piece: 'all' | 'upper' | 'lower' = 'all') => arm(c, 16.8, 16.4 + U, fb, REACH_FRONT, [0.6, 0.8], 0, fb.behind ? -1 : 0, piece);
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
    const hw = robeWidth(u, 4.9, 2.5);
    const sw = u * u * p.sway;
    return [cx - hw + sw, cx + hw + sw];
  }, S.robe, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
  for (let y = waist + 1; y <= hem; y++) {
    const u = (y - top) / (hem - top);
    c.shade(Math.round(cx + u * u * p.sway), y, -1);
    c.shade(Math.round(cx - 3.5 + u * u * p.sway - u), y, -1);
    c.shade(Math.round(cx + 3.5 + u * u * p.sway + u), y, -1);
  }
  hemEdge(c, hem, cx - 9, cx + 9, p.tick);
  c.part();
  c.shape(waist, waist, () => [cx - 4.8, cx + 4.8], S.trim, (_x, _y, t) => cyl(t, 0));
  for (let x = cx - 4; x <= cx + 4; x += 2) c.shade(x, waist, -1);

  headUp(c, cx, U, p);
  if (!fa.behind) armA('upper');
  if (!fb.behind) armB('upper');
  mantleFront(c, cx, U - 0.6, 6.6, 6.6, p.sway, true);

  if (!fb.behind) {
    armB('lower');
    drawStaff(c, 'up', p, fb);
  }
  if (!fa.behind) armA('lower');
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean;
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);

  if (fa.behind) arm(c, hx + 1.2, 16.4 + U, fa, REACH_SIDE, [0.3, 1], p.palm, -1);

  const lift = (f: number) => Math.max(0, f) * 0.35;
  foot(c, cx + 0.8 - p.footB, 30.4 - lift(p.footB), true, -1);
  foot(c, cx - 0.8 - p.footA, 30.4 - lift(p.footA), true);

  // The robe in profile, its weight trailing back.
  const top = 15 + U;
  const hem = 29 + L;
  const waist = 22 + U;
  c.part();
  c.shape(top, hem, (y) => {
    const u = (y - top) / (hem - top);
    const shift = hx + (cx - hx) * u;
    const hw = robeWidth(u, 3.6, 1.9);
    return [shift - hw - 0.2 - u * 0.4, shift + hw + 0.4 + u * u * (0.8 + p.sway)];
  }, S.robe, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  // The panel's edge down the front.
  for (let y = waist + 1; y <= hem; y++) {
    const u = (y - top) / (hem - top);
    const shift = hx + (cx - hx) * u;
    const x = Math.round(shift - robeWidth(u, 3.6, 1.9) - 0.2 - u * 0.4);
    if (c.filled(x, y)) c.px(x, y, S.inner, sphere(-0.5, 0.2), { bias: -1 });
    if (c.filled(x + 1, y)) c.px(x + 1, y, S.trim, sphere(-0.3, 0));
  }
  for (let y = waist + 2; y <= hem; y++) {
    c.shade(Math.round(hx + 1.5 + (y - waist) * 0.25), y, -1);
    c.shade(Math.round(hx + 3.5 + (y - waist) * 0.35), y, -1);
  }
  hemEdge(c, hem, cx - 9, cx + 9, p.tick);
  c.part();
  c.shape(waist, waist, () => [hx - 3.7, hx + 3.7], S.trim, (_x, _y, t) => cyl(t, 0));
  for (let x = Math.round(hx - 3); x <= hx + 3; x += 2) c.shade(x, waist, -1);
  c.part();
  c.px(Math.round(hx - 3.7), waist, S.gem, sphere(-0.5, -0.3), { glow: 0.6 });

  mantleSide(c, hx, U, p.sway);
  headSide(c, hx, U, p);
  if (!S.sea) {
    // The fur's lip in front of the jaw.
    c.part();
    for (const x of [hx - 1, hx]) c.px(x, 13 + U, S.mantle, sphere(-0.4, -0.6), { bias: 1 });
  }

  drawStaff(c, 'side', p, fb);
  arm(c, hx + 0.2, 16.6 + U, fb, REACH_SIDE, [0.4, 1], 0);
  if (!fa.behind) arm(c, hx + 0.8, 16.4 + U, fa, REACH_SIDE, [0.3, 1], p.palm);
}

// ---------------------------------------------------------------------------
// Animations

/** The casting hand hanging loose, the staff planted at his side. */
const REST_A = H(0.6, 4.6, -3.2);
const REST_B = H(1.6, 5.6, -2.2);
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
  mist: 0,
  eyes: 0.7,
});

/** Standing still: the shoulders rise and fall, his breath steams out cold, the phylactery bobs. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.a.h += Math.sin(ph) * 0.4;
    p.b.h += p.breath * -0.3;
    p.sway = Math.sin(ph - 1) * 0.5;
    p.tick = f;
    // He breathes out as his shoulders settle.
    p.mist = f === 3 ? 0.9 : f === 4 ? 0.6 : 0;
    p.eyes = f === 1 || f === 2 ? 1 : 0.6;
    frames.push(p);
  }
  return frames;
}

/** A slow, heavy glide, the staff swung forward with each step. */
function walk(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0;
    p.tick = f;
    p.mist = f === 2 ? 0.5 : 0;
    if (view === 'side') {
      p.footA = Math.round(s * 2.2);
      p.footB = -p.footA;
      p.lean = 1;
      p.sway = 0.8 + Math.abs(s) * 0.9;
      p.b = H(3.2 - s * 0.6, 0, -2 + p.lift * 0.4);
      p.a = H(0.2 + s * 1.2, 0, -3.2 + p.lift * 0.4);
      p.tilt = 0.08 + s * 0.06;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.7;
      p.b = H(1.6 - s * 0.5, 5.6, -2.2 + p.lift * 0.4);
      p.a = H(0.6 + s * 1.2, 4.6, -3.2 + p.lift * 0.4);
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
  mist?: number;
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
      p.mist = k.mist ?? 0;
      p.eyes = 0.7 + (k.flare ?? 0) * 0.3;
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

/**
 * The rime bolt: the hand drawn across his chest as a shard of ice forms in
 * it, then flung out backhand.
 */
const cast = action([
  { a: H(0.6, 1.4, 2.4), b: REST_B, aSide: H(1.0, 0, 2.4), bSide: REST_B_SIDE, palm: 0.4, flare: 0.2, tilt: 0.04 },
  { a: H(-0.2, 0.4, 3.4), b: REST_B, aSide: H(-0.6, 0, 3.4), bSide: REST_B_SIDE, palm: 0.85, flare: 0.45, tilt: 0.07, lean: -1 },
  { a: H(5.8, 2.6, 2.0), b: REST_B, aSide: H(5.8, 0, 1.8), bSide: H(2.6, 0, -2), palm: 1, flare: 0.7, tilt: 0.12, lean: 1, step: 1, mist: 0.6 },
  { a: H(5.2, 3.8, 0.8), b: REST_B, aSide: H(5.0, 0, 0.8), bSide: H(2.8, 0, -2), palm: 0.35, flare: 0.3, tilt: 0.08, lean: 1, step: 1, mist: 0.4 },
  { a: H(2.2, 4.0, -1.6), b: REST_B, aSide: H(1.8, 0, -1.6), bSide: REST_B_SIDE, palm: 0.1, tilt: 0.03 },
]);

/**
 * Bone spikes: he rears back, hand high and the phylactery blazing, then
 * drives the staff's heel down and rakes his claw at the ground ahead.
 */
const spikes = action([
  { a: H(0.8, 4.8, 4.0), b: H(1.0, 5.4, 0), aSide: H(0.4, 0, 4.0), bSide: H(2.6, 0, 0.4), palm: 0.4, flare: 0.3, lean: -1, tilt: -0.05 },
  { a: H(0.6, 4.6, 7.0), b: H(1.0, 5.0, 3.2), aSide: H(0.2, 0, 7.0), bSide: H(2.4, 0, 3.4), palm: 0.7, flare: 0.6, lift: 1, lean: -1, tilt: -0.08 },
  { a: H(0.4, 4.4, 8.4), b: H(1.0, 4.8, 4.2), aSide: H(0.0, 0, 8.4), bSide: H(2.2, 0, 4.4), palm: 1, flare: 0.9, lift: 1, lean: -1, tilt: -0.1 },
  { a: H(5.2, 2.4, -4.6), b: H(3.0, 5.4, -3.2), aSide: H(5.4, 0, -4.4), bSide: H(4.2, 0, -3.4), palm: 1, flare: 1, breath: 1, lean: 2, step: 1, tilt: 0.12, mist: 0.8 },
  { a: H(5.0, 2.6, -5.0), b: H(3.0, 5.4, -3.2), aSide: H(5.2, 0, -4.8), bSide: H(4.2, 0, -3.4), palm: 0.6, flare: 0.6, breath: 1, lean: 2, step: 1, tilt: 0.12, mist: 0.5 },
  { a: H(3.6, 3.2, -3.6), b: H(2.4, 5.4, -2.8), aSide: H(3.6, 0, -3.6), bSide: H(3.8, 0, -2.6), palm: 0.3, flare: 0.3, lean: 1, tilt: 0.06 },
  { a: REST_A, b: REST_B, aSide: REST_A_SIDE, bSide: REST_B_SIDE, palm: 0.1, flare: 0.1 },
]);

/**
 * Eternal Winter (the Special's pose, and the pick on the select screen):
 * he gathers himself, then spreads his arms wide and lifts the staff high,
 * the phylactery blazing over his crown.
 */
const winter = action([
  { a: H(0.8, 5.0, -1.0), b: H(1.6, 5.4, -0.6), aSide: H(0.6, 0, -1.0), bSide: H(3.0, 0, -0.6), palm: 0.3, flare: 0.25, breath: 1 },
  { a: H(1.2, 6.6, 2.0), b: H(1.6, 5.2, 3.4), aSide: H(0.8, 0, 2.6), bSide: H(3.0, 0, 3.4), palm: 0.5, flare: 0.45, lift: 1 },
  { a: H(1.4, 8.0, 4.0), b: H(1.4, 4.6, 6.6), aSide: H(1.0, 0, 5.0), bSide: H(2.8, 0, 6.6), palm: 0.7, flare: 0.65, lift: 1, mist: 0.4 },
  { a: H(1.6, 9.0, 5.4), b: H(1.2, 4.0, 8.6), aSide: H(1.2, 0, 6.4), bSide: H(2.6, 0, 8.6), palm: 0.9, flare: 0.85, lift: 1, lean: -1, mist: 0.7 },
  { a: H(1.6, 9.4, 6.0), b: H(1.2, 3.8, 9.4), aSide: H(1.2, 0, 7.0), bSide: H(2.6, 0, 9.4), palm: 1, flare: 1, lift: 1, lean: -1, mist: 1 },
  { a: H(1.6, 9.4, 6.2), b: H(1.2, 3.8, 9.6), aSide: H(1.2, 0, 7.2), bSide: H(2.6, 0, 9.6), palm: 1, flare: 1, lift: 1, lean: -1, mist: 0.8 },
  { a: H(1.0, 5.4, 0), b: H(1.6, 5.6, -1.2), aSide: H(0.6, 0, 0), bSide: H(3.2, 0, -1.4), palm: 0.3, flare: 0.3 },
]);

/** One beat of the idle moment: what differs from the plain stand. */
interface RestKey {
  a?: Hand;
  breath?: number;
  head?: [number, number];
  palm?: number;
  flare?: number;
  mist?: number;
  eyes?: number;
  gem?: { x: number; y: number; glow: number };
  frost?: number;
}

/**
 * The lich's idle moment: the phylactery lifts off the staff and drifts to
 * him; he cradles it at his chest and bows his head over it, and it beats
 * like the heart he no longer has, frost creeping out over the ground round
 * his feet with each beat. Then he lets it go, and it floats back home.
 * Faces the viewer only. The gem's spots are in body coordinates.
 */
const CRADLE = H(3.4, 1.0, 4.2);
const HELD = { x: 11.0, y: 14.6 };
const LICH_REST: RestKey[] = [
  {},
  // It stirs on the staff and lifts away.
  { breath: 1, gem: { x: 17.4, y: 4.6, glow: 0.6 } },
  { a: H(1.2, 4.0, 0), gem: { x: 16.8, y: 3.0, glow: 0.7 }, eyes: 1 },
  { a: H(2.2, 2.6, 2.4), gem: { x: 15.0, y: 3.4, glow: 0.7 }, eyes: 1 },
  { a: H(3.0, 1.4, 3.8), gem: { x: 12.6, y: 8.6, glow: 0.65 }, head: [0, 0] },
  // In his hand; he bows over it.
  { a: CRADLE, gem: { ...HELD, glow: 0.5 }, head: [0, 1] },
  // It beats, and the frost spreads.
  { a: CRADLE, gem: { ...HELD, glow: 1 }, head: [0, 1], palm: 0.3, frost: 0.25 },
  { a: CRADLE, gem: { ...HELD, glow: 0.45 }, head: [0, 1], frost: 0.3 },
  { a: CRADLE, gem: { ...HELD, glow: 1 }, head: [0, 1], palm: 0.35, frost: 0.55, mist: 0.6 },
  { a: CRADLE, gem: { ...HELD, glow: 0.5 }, head: [-1, 1], frost: 0.6, mist: 0.4 },
  { a: H(3.4, 1.0, 4.4), gem: { x: 11.0, y: 14.4, glow: 1 }, head: [-1, 1], palm: 0.45, frost: 0.85, eyes: 1 },
  { a: CRADLE, gem: { ...HELD, glow: 0.55 }, head: [0, 1], frost: 0.95, eyes: 1 },
  // He lifts his head and lets it go; it floats back to the staff, the frost fading.
  { a: H(3.2, 1.2, 5.0), gem: { x: 12.0, y: 9.4, glow: 0.7 }, frost: 0.7 },
  { a: H(2.2, 2.6, 2.2), gem: { x: 14.6, y: 5.0, glow: 0.7 }, frost: 0.45 },
  { a: H(1.2, 4.0, -1.4), gem: { x: 16.8, y: 3.6, glow: 0.65 }, frost: 0.2 },
  { flare: 0.5, frost: 0.05 },
  {},
];

/** Slots of the idle moment in playing order, holds and beats repeated (8 fps). */
const REST_ORDER = [0, 1, 1, 2, 3, 4, 5, 5, 6, 7, 6, 7, 8, 9, 8, 9, 10, 11, 10, 11, 11, 12, 13, 14, 15, 16];

/** The idle moment, drawn facing the viewer only; it starts and ends on the idle's first frame exactly. */
function rest(view: View): Pose[] {
  if (view !== 'down') return [];
  return LICH_REST.map((k, i) => {
    const p = idle('down')[0];
    const edge = i === 0 || i === LICH_REST.length - 1;
    if (k.a) p.a = { ...k.a };
    p.breath = k.breath ?? 0;
    p.palm = k.palm ?? 0;
    p.flare = k.flare ?? 0;
    p.mist = k.mist ?? 0;
    p.eyes = k.eyes ?? p.eyes;
    p.head = k.head;
    p.gem = k.gem;
    p.frost = k.frost;
    if (!edge) p.sway += Math.sin(i * 0.9) * 0.3;
    p.tick = edge ? 0 : i;
    return p;
  });
}

// ---------------------------------------------------------------------------
// Frame generation

export type LichAnim = 'idle' | 'walk' | 'cast' | 'spikes' | 'winter' | 'rest';

export interface LichAnimDef {
  name: LichAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  order?: readonly number[];
}

export const LICH_ANIMS: LichAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 8, loop: true, poses: walk },
  { name: 'cast', fps: 14, loop: false, poses: cast },
  { name: 'spikes', fps: 12, loop: false, poses: spikes },
  { name: 'winter', fps: 10, loop: false, poses: winter },
  { name: 'rest', fps: 8, loop: false, poses: rest, order: REST_ORDER },
];

/** Frame index at which each move is released. */
export const LICH_RELEASE = { cast: 2, spikes: 3 } as const;

export interface LichFrame {
  key: string;
  anim: LichAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawLichFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(LICH_W, LICH_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildLichFrames(look: LichLook = LICH_LOOK): LichFrame[] {
  S = look;
  const out: LichFrame[] = [];
  for (const a of LICH_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawLichFrame(dir, pose) });
      });
    }
  }
  S = LICH_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Ability icons (16x16)

/** Colours the lich's icons are painted in: the magic brightest first, bone, and the outline. */
export interface LichIconColors {
  light: [string, string, string, string];
  bone: [string, string];
  /** The spikes, lit to dark. */
  spike: [string, string, string];
  outline: string;
  /** The drowned king's: coral instead of ice. */
  sea: boolean;
}
export const LICH_ICON: LichIconColors = { light: ['#f4fdff', '#a8e8ff', '#4ab4f0', '#1c4aa8'], bone: ['#eee8d4', '#9c988a'], spike: ['#e4f8ff', '#9cd8f4', '#4e92cc'], outline: '#06102a', sea: false };
export const DROWNED_ICON: LichIconColors = { light: ['#f0fffa', '#9cffe4', '#2ad8b4', '#0c6a72'], bone: ['#c8fff0', '#4ad8b8'], spike: ['#ffd8c4', '#f28a70', '#c0404a'], outline: '#1a0408', sea: true };

/** The rime bolt: a long shard of ice (brine and coral) flying up and to the right, a splinter of bone down its spine, frost streaming off. */
export function rimeBoltIcon(k: LichIconColors = LICH_ICON): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const [core, hot, mid, deep] = k.light;
  // The shard: a long diamond along the diagonal.
  for (let i = 0; i <= 11; i++) {
    const x = 3 + i;
    const y = 12 - i;
    const w = i < 8 ? Math.min(2, 0.6 + i * 0.25) : (11 - i) * 0.6;
    for (let o = -Math.ceil(w); o <= Math.ceil(w); o++) {
      if (Math.abs(o) > w + 0.2) continue;
      // Across the shard: lit edge up-left, deep edge down-right.
      put(x + (o > 0 ? 1 : 0) * 0, y + o, o < 0 ? hot : o === 0 ? (i > 7 ? core : hot) : o === 1 ? mid : deep);
    }
  }
  // The bone (or coral) spine down its middle.
  const spine = k.sea ? [k.spike[0], k.spike[2]] : k.bone;
  for (let i = 2; i <= 7; i++) put(3 + i, 12 - i, i % 2 ? spine[0] : spine[1]);
  outline(k.outline);
  // Frost streaming off behind it.
  for (const [x, y, c] of [[1, 13, mid], [2, 15, deep], [0, 11, deep], [4, 15, mid], [1, 14, hot]] as const) put(x, y, c);
  put(14, 1, core);
  return px;
}

/** Bone spikes: three jagged spikes of ice and bone (coral) bursting from cracked ground, splinters flying. */
export function boneSpikesIcon(k: LichIconColors = LICH_ICON): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const [core, , mid, deep] = k.light;
  const [sLit, sFace, sDark] = k.spike;
  // The ground, cracked.
  for (let x = 0; x < 16; x++) {
    put(x, 14, deep);
    if (x % 3 !== 1) put(x, 15, deep);
  }
  // Spikes: x of the base, height, lean.
  const spikes: [number, number, number][] = [[3, 7, -1], [8, 12, 0], [12, 8, 1]];
  for (const [bx, h, lean] of spikes) {
    for (let j = 0; j < h; j++) {
      const y = 13 - j;
      const u = j / h;
      const w = Math.floor((1 - u) * (h > 10 ? 2.6 : 1.9));
      const x = Math.round(bx + lean * u * 2);
      for (let o = -w; o <= w; o++) put(x + o, y, o < 0 ? sLit : o === 0 ? (u > 0.7 ? sLit : sFace) : sDark);
      // A band of bone (a ring of sea-glow) across each spike.
      if (j === Math.round(h * 0.35)) for (let o = -w; o <= w; o++) put(x + o, y, o <= 0 ? k.bone[0] : k.bone[1]);
    }
  }
  outline(k.outline);
  if (k.sea) {
    // Coral twigs.
    put(6, 6, sFace);
    put(5, 5, sLit);
    put(10, 6, sFace);
    put(11, 5, sLit);
  }
  for (const [x, y] of [[1, 5], [6, 2], [14, 3], [15, 8]]) put(x, y, mid);
  put(8, 1, core);
  return px;
}
