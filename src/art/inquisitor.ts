// The Inquisitor, the Jedi class's hunter, on a rig of his own.
//
// A dark-side hunter in a grey-black armoured bodysuit: gunmetal plates over
// black (chest, bracers, knee guards and greaves) piped in red, a short cape
// over his shoulders lined in crimson, and a high collar. His head is bare,
// pale grey and long, a bony crest running back over the crown, amber eyes
// sunk deep and red marks under them. His weapon is a ring saber: a circular
// hilt with a red blade out of each side, pinwheel-wise, that spins like a
// wheel; he throws it and it comes back to his hand, and he can spin it flat
// on one finger (his idle moment, `rest`).
//
// His Voidhunter skin is obsidian armour with violet seams that glow, a
// horned black helm with a single slit of light for a visor, and a
// violet-white ring blade.
//
// The body keeps to the 24x32 box; frames are larger so the blades and his
// leap can reach past it. Drawing functions work in body-box coordinates;
// right-facing frames are drawn facing left and mirrored. Also here: his two
// button icons.

import { PixelCanvas, hex, sphere, cyl, type Material, type RGB, type Vec3 } from './pixel';
import { HILT_DARK, SABER_RED, SABER_RED_GLOW, blade } from './palette';
import { DIRS, type Dir } from './wizard';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const INQ_W = 48;
export const INQ_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the boots. */
export const INQ_ORIGIN_X = BODY_X + 12;
export const INQ_ORIGIN_Y = BODY_Y + 31;
/** The chest's height above the origin, where his cuts are centred. */
export const INQ_CHEST_Y = 11;

/** The ring hilt's radius, and how long its blades burn, in body pixels. */
const RING_R = 3.6;
const BLADE_LEN = 6.5;

// ---------------------------------------------------------------------------
// Materials

/** The black bodysuit under the armour. */
const SUIT: Material = { ramp: ramp('#07070a', '#111117', '#1c1c25', '#292935'), outline: hex('#030305'), outlineLit: hex('#15151c') };
/** Gunmetal plates. */
const PLATE: Material = { ramp: ramp('#13151b', '#252932', '#3b404c', '#575e6d', '#7c8495'), outline: hex('#06070a'), outlineLit: hex('#1b1e25'), shine: true };
/** Red piping along the plates' edges. */
const TRIM: Material = { ramp: ramp('#45070d', '#7a1018', '#b21c26', '#e3343a'), outline: hex('#170204'), emissive: 0.12 };
const CAPE: Material = { ramp: ramp('#09080b', '#151319', '#211e27', '#2f2b37'), outline: hex('#030305'), outlineLit: hex('#131117') };
const LINING: Material = { ramp: ramp('#2a0509', '#470a10', '#681018', '#8a1a22'), outline: hex('#120204') };
const GLOVE: Material = { ramp: ramp('#0e0e14', '#1a1a24', '#2a2a38', '#3c3c4e'), outline: hex('#050508') };
/** Pale grey skin, cold in the shade. */
const SKIN: Material = { ramp: ramp('#2c2f39', '#4d515e', '#767b89', '#9ea3b0', '#c3c7d1'), outline: hex('#14151b'), outlineLit: hex('#2a2c35') };
/** The red marks under his eyes. */
const MARK: Material = { ramp: ramp('#3e0e14', '#661820', '#8c262c'), outline: hex('#14151b') };
const EYES: Material = { ramp: ramp('#ff9a1a', '#ffe08a'), outline: hex('#0a0408'), emissive: 1, noAO: true };
/** The ring hilt: dark chrome. */
const RING: Material = { ramp: ramp('#2a2d38', '#4f5466', '#828aa0', '#b8c0d4', '#eef1f8'), outline: hex('#07070c'), shine: true };

// The Voidhunter.
const VOID_SUIT: Material = { ramp: ramp('#040306', '#0a080e', '#120f18', '#1c1724'), outline: hex('#020103'), outlineLit: hex('#0e0b12') };
/** Obsidian: glassy black, a violet sheen where the light catches it. */
const OBSIDIAN: Material = { ramp: ramp('#050408', '#0e0b14', '#1a1524', '#2b2340', '#4c3f6e'), outline: hex('#020103'), outlineLit: hex('#120e1a'), shine: true };
/** The seams between the plates, lit from within. */
const VOID_SEAM: Material = { ramp: ramp('#4a1890', '#7a32d8', '#a86cff', '#d8bcff'), outline: hex('#12041e'), emissive: 0.75, noAO: true };
const VOID_CAPE: Material = { ramp: ramp('#050407', '#0c0a10', '#16121c', '#211b2a'), outline: hex('#020103'), outlineLit: hex('#0c0a10') };
const VOID_LINING: Material = { ramp: ramp('#170a28', '#281244', '#3c1a60', '#542484'), outline: hex('#08030e') };
const VOID_GLOVE: Material = { ramp: ramp('#060509', '#0e0c14', '#1a1622', '#282236'), outline: hex('#020103') };
const VOID_HORN: Material = { ramp: ramp('#09070d', '#18141f', '#2a2434', '#463d56', '#6c6086'), outline: hex('#020103'), shine: true };
const VISOR: Material = { ramp: ramp('#b48aff', '#f4ecff'), outline: hex('#0a0412'), emissive: 1, noAO: true, noOutline: true };
const VOID_RING: Material = { ramp: ramp('#0b0910', '#1c1826', '#383050', '#665a88', '#a698c8'), outline: hex('#040308'), shine: true };
const VOID_BLADE = blade(['#efe4ff', '#fdfaff'], ['#6a2ad8', '#9a5aff', '#c8a0ff']);

// ---------------------------------------------------------------------------
// Looks

export interface InqLook {
  /** Texture key; animations are `${key}_${anim}_${dir}`. */
  key: string;
  suit: Material;
  /** Field names follow dress.ts: `plate` is armour, `trim` is trim, `skin` and `eyes` are kept bare. */
  plate: Material;
  trim: Material;
  cape: Material;
  lining: Material;
  glove: Material;
  skin: Material;
  mark: Material;
  eyes: Material;
  ring: Material;
  blade: { core: Material; edge: Material };
  /** The blades' halo in the emissive layer. */
  bladeGlow: RGB;
  /** The light in his empty hand as it calls the ring back: core, hot, mid. */
  force: [RGB, RGB, RGB];
  /** A horned helm with a single visor slit instead of the bare head (the Voidhunter). */
  helm?: { horn: Material; visor: Material };
}

export const INQUISITOR_LOOK: InqLook = {
  key: 'jedi_inquisitor',
  suit: SUIT,
  plate: PLATE,
  trim: TRIM,
  cape: CAPE,
  lining: LINING,
  glove: GLOVE,
  skin: SKIN,
  mark: MARK,
  eyes: EYES,
  ring: RING,
  blade: SABER_RED,
  bladeGlow: SABER_RED_GLOW,
  force: [hex('#fff0ec'), hex('#ff8a7a'), hex('#e8303a')],
};

export const VOIDHUNTER_LOOK: InqLook = {
  key: 'jedi_voidhunter',
  suit: VOID_SUIT,
  plate: OBSIDIAN,
  trim: VOID_SEAM,
  cape: VOID_CAPE,
  lining: VOID_LINING,
  glove: VOID_GLOVE,
  skin: OBSIDIAN,
  mark: OBSIDIAN,
  eyes: VISOR,
  ring: VOID_RING,
  blade: VOID_BLADE,
  bladeGlow: hex('#9a4aff'),
  force: [hex('#fbf6ff'), hex('#d6b8ff'), hex('#9a5aff')],
  helm: { horn: VOID_HORN, visor: VISOR },
};

export const INQUISITOR_LOOKS = [INQUISITOR_LOOK, VOIDHUNTER_LOOK];

/** The look being drawn; set by buildInquisitorFrames. */
let S: InqLook = INQUISITOR_LOOK;

// ---------------------------------------------------------------------------
// Poses

/** The ring saber as held: the hand grips its rim at `grip` (degrees round the ring, 0 = right, 90 = down). */
export interface Ring {
  grip: number;
  /** How round the ring looks: 1 face on, near 0 seen edge on (spun flat). */
  tilt: number;
  /** Where round the ring the first blade's emitter sits, degrees. */
  rot: number;
  /** Blade length (0: put out). */
  len: number;
  /** 0..1 a blur of light round it as it spins. */
  spin?: number;
  /** The ring at this spot instead of in the hand (balanced on a finger, slung on his back). */
  at?: { x: number; y: number };
  /** That spot is behind his body (slung on his back). */
  back?: boolean;
}

interface Pose {
  /** Whole body raised (walk passing frames). */
  lift: number;
  /** Upper body lowered (breathing). */
  breath: number;
  /** Knees bent and body lowered this many pixels (crouches and landings). */
  crouch: number;
  /** Feet drawn up under him in the air. */
  tuck: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** The cape's hem swinging, pixels (side view: streaming back). */
  cape: number;
  /** Free-arm swing in pixels. */
  arm: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The saber hand, in body pixels. */
  hand: { x: number; y: number };
  /** The ring in or near it, or none (thrown). */
  ring: Ring | null;
  /** Ring, arm and hand drawn behind the body. */
  behind?: boolean;
  /** Free hand placed here instead of hanging at the side. */
  free?: { x: number; y: number };
  /** 0..1 light in the empty saber hand. */
  glow?: number;
  /** Both arms drawn over the head and cape (raised high). */
  high?: boolean;
  blink?: boolean;
  /** 0..1 the eyes flaring. */
  glare?: number;
  /** The head turned this many pixels across (the idle moment, looking at the spinning ring). */
  headX?: number;
  /** The saber hand's index finger raised (balancing the ring). */
  finger?: boolean;
}

type View = 'down' | 'up' | 'side';

/** Where each view holds the ring at rest: the hand, and the ring off it. */
const GUARD: Record<View, { hand: { x: number; y: number }; ring: Ring }> = {
  down: { hand: { x: 4.6, y: 21.6 }, ring: { grip: -90, tilt: 1, rot: 180, len: BLADE_LEN } },
  up: { hand: { x: 19.4, y: 21.6 }, ring: { grip: -90, tilt: -1, rot: 180, len: BLADE_LEN } },
  side: { hand: { x: 7.6, y: 21.4 }, ring: { grip: -90, tilt: 0.9, rot: 180, len: BLADE_LEN } },
};

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  crouch: 0,
  tuck: 0,
  footA: 0,
  footB: 0,
  cape: 0,
  arm: 0,
  lean: 0,
  hand: { ...GUARD[view].hand },
  ring: { ...GUARD[view].ring },
});

/** A ring held in the hand with these changes. */
const rg = (grip: number, tilt: number, rot: number, o: Partial<Ring> = {}): Ring => ({ grip, tilt, rot, len: BLADE_LEN, ...o });

// ---------------------------------------------------------------------------
// Shared parts

const RAD = Math.PI / 180;
const FLAT_DOWN: Vec3 = { x: 0, y: -0.3, z: 0.95 };

function each(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void): void {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) fn(x, y);
}

const hash = (a: number, b: number, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * Halo pixels of blades drawn behind the body. Light pixels would otherwise
 * shine straight through him, so they wait until the frame is drawn and only
 * land where nothing solid covers them (see drawFrame).
 */
let hiddenHalo: [number, number, number][] = [];

function glowAt(c: PixelCanvas, x: number, y: number, k: number, hidden: boolean): void {
  if (hidden) hiddenHalo.push([x, y, k]);
  else c.spark(x, y, S.bladeGlow, k);
}

/** One blade of light from (ex, ey) along the unit (dx, dy), `len` long: a white core, its colour, a halo. */
function bladeRun(c: PixelCanvas, ex: number, ey: number, dx: number, dy: number, len: number, hidden: boolean): void {
  if (len < 0.8) {
    glowAt(c, ex, ey, 0.45, hidden);
    return;
  }
  const px = -dy;
  const py = dx;
  const reach = len + 3;
  c.part();
  each(ex - reach, ey - reach, ex + reach, ey + reach, (x, y) => {
    const rx = x + 0.5 - ex;
    const ry = y + 0.5 - ey;
    const along = rx * dx + ry * dy;
    const side = rx * px + ry * py;
    if (along < -1.2 || along > len + 2.2) return;
    const rest = len - along;
    const d = Math.abs(side);
    const halo = rest < 0 ? Math.hypot(rest, side) : along < 0 ? Math.hypot(along, side) : d;
    if (halo < 2.3 && (halo >= 1.0 || rest < -0.9 || along < -0.4)) glowAt(c, x, y, halo < 1.6 ? 0.42 : 0.2, hidden);
    if (rest < -0.9 || along < -0.4) return;
    const hw = rest < 0.6 ? 0.7 : 1.0;
    const n = { x: -0.2, y: 0.3, z: 0.9 };
    if (d < 0.5 && rest > 0.1) c.px(x, y, S.blade.core, n);
    else if (d < hw) c.px(x, y, S.blade.edge, n, { bias: d > 0.75 ? -1 : 0 });
  });
}

/** Where the ring's middle is, held by a hand at (hx, hy). */
function ringCentre(hx: number, hy: number, g: Ring): { x: number; y: number } {
  if (g.at) return g.at;
  const a = g.grip * RAD;
  return { x: hx - Math.cos(a) * RING_R, y: hy - Math.sin(a) * RING_R * g.tilt };
}

/**
 * The ring saber: a chrome ring with a dark emitter on either side, and a
 * blade out of each emitter along the ring's edge, the two turning the same
 * way round like a pinwheel. Tilted, the ring flattens to an ellipse and the
 * blades shorten with it.
 */
function drawRing(c: PixelCanvas, hx: number, hy: number, g: Ring, hidden: boolean): void {
  const { x: cx, y: cy } = ringCentre(hx, hy, g);
  const r = RING_R;
  const t = g.tilt;
  // Spun fast, a disc of blade-light blurs round it.
  if (g.spin && g.len > 0) {
    const R = r + g.len * 0.75;
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      for (const k of [0.55, 0.8, 1]) {
        const x = cx + Math.cos(a) * R * k;
        const y = cy + Math.sin(a) * R * k * t;
        if (hash(Math.round(x * 3), Math.round(y * 3), Math.round(g.rot)) < 0.5) glowAt(c, x, y, g.spin * (k === 1 ? 0.22 : 0.14), hidden);
      }
    }
  }
  // The two blades, from opposite sides of the ring, along its edge.
  for (const off of [0, 180]) {
    const a = (g.rot + off) * RAD;
    const ex = cx + Math.cos(a) * (r + 0.3);
    const ey = cy + Math.sin(a) * (r + 0.3) * t;
    const vx = -Math.sin(a);
    const vy = Math.cos(a) * t;
    const l = Math.hypot(vx, vy) || 1;
    bladeRun(c, ex, ey, vx / l, vy / l, g.len * l, hidden);
  }
  // The rim: a band of chrome round the ring, open in the middle; seen edge on, a solid bar.
  c.part();
  const ry = r * Math.abs(t);
  each(cx - r - 1, cy - ry - 1, cx + r + 1, cy + ry + 1, (x, y) => {
    const dx = (x + 0.5 - cx) / (r + 0.45);
    const dy = (y + 0.5 - cy) / (ry + 0.45);
    const d = Math.hypot(dx, dy);
    if (d > 1) return;
    const inner = ry < 1.4 ? 0 : Math.hypot((x + 0.5 - cx) / Math.max(0.1, r - 1.2), (y + 0.5 - cy) / Math.max(0.1, ry - 1.2));
    if (ry >= 1.4 && inner < 1) return;
    const a = Math.atan2(dy, dx);
    c.px(x, y, S.ring, sphere(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 1), { bias: dy < -0.3 && Math.abs(t) < 0.6 ? -1 : 0 });
  });
  // The emitters: dark nubs on the rim where the blades come out.
  c.part();
  for (const off of [0, 180]) {
    const a = (g.rot + off) * RAD;
    c.px(cx + Math.cos(a) * r, cy + Math.sin(a) * r * t, HILT_DARK, FLAT_DOWN);
  }
}

function limb(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, m: Material, bias = 0): void {
  c.part();
  c.capsule(x0, y0, x1, y1, r0, r1, m, { bias });
}

/** An arm in the bodysuit, a gunmetal bracer on the forearm, a black glove. */
function arm(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number, bias = 0): void {
  const ex = sx + (hx - sx) * 0.48;
  const ey = sy + (hy - sy) * 0.48;
  limb(c, sx, sy, ex, ey, 1.35, 1.2, S.suit, bias);
  const vx = hx - ex;
  const vy = hy - ey;
  const l = Math.hypot(vx, vy) || 1;
  limb(c, ex, ey, hx - (vx / l) * 0.9, hy - (vy / l) * 0.9, 1.3, 1.15, S.plate, bias);
  // A band of piping round the bracer's cuff.
  c.part();
  c.px(hx - (vx / l) * 1.6, hy - (vy / l) * 1.6, S.trim, sphere(0, -0.3), { bias });
}

function hand(c: PixelCanvas, x: number, y: number, finger = false): void {
  c.part();
  c.ellipse(x, y, 1.1, 1.1, S.glove);
  if (finger) {
    // The index finger raised, balancing the ring.
    c.part();
    c.px(x, y - 1.6, S.glove, sphere(-0.3, -0.6, 1), { bias: 1 });
    c.px(x, y - 2.6, S.glove, sphere(-0.3, -0.8, 1), { bias: 1 });
  }
}

/** Light gathered in the empty hand as it steers the flying ring. */
function palmGlow(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.force;
  c.spark(x, y, core, k * 0.8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + k * 3;
    const r = 1.6 + (i % 2) * 0.9 * k;
    c.spark(x + Math.cos(a) * r, y + Math.sin(a) * r, i % 2 ? mid : hot, k * (i % 2 ? 0.45 : 0.7));
  }
}

/** The saber arm, hand and ring (or the empty hand) from the shoulder at (sx, sy). */
function saberArm(c: PixelCanvas, sx: number, sy: number, p: Pose, lift: number, ringFirst: boolean): void {
  const hx = p.hand.x;
  const hy = p.hand.y + lift;
  const g = p.ring;
  const held = g && !g.at;
  if (held && ringFirst) drawRing(c, hx, hy, g, !!p.behind);
  arm(c, sx, sy, hx, hy, p.behind ? -1 : 0);
  hand(c, hx, hy, p.finger);
  if (held && !ringFirst) drawRing(c, hx, hy, g, !!p.behind);
  if (!g) palmGlow(c, hx, hy, p.glow ?? 0);
}

function boot(c: PixelCanvas, x: number, y: number, side: boolean, bias = 0): void {
  c.part();
  if (side) c.ellipse(x, y, 2.2, 1.25, S.plate, { flatten: 0.8, bias: bias - 1 });
  else c.ellipse(x, y, 1.75, 1.3, S.plate, { flatten: 0.8, bias: bias - 1 });
}

/** A leg from the hip to the foot: suit to the knee, then a gunmetal greave, a knee guard on the joint. */
function leg(c: PixelCanvas, hx: number, hy: number, kx: number, ky: number, fx: number, fy: number, bias = 0): void {
  limb(c, hx, hy, kx, ky, 1.4, 1.25, S.suit, bias);
  limb(c, kx, ky, fx, fy, 1.3, 1.15, S.plate, bias);
  c.part();
  c.ellipse(kx, ky, 1.25, 0.95, S.plate, { bias: bias + 1 });
}

function eyes(c: PixelCanvas, pts: [number, number][], blink?: boolean, glare = 0): void {
  if (S.helm) return;
  c.part();
  for (const [x, y] of pts) {
    if (blink) {
      c.px(x, y, S.skin, FLAT_DOWN, { bias: -2 });
      continue;
    }
    c.px(x, y, S.eyes);
    c.spark(x, y, S.force[1], 0.2 + glare * 0.5);
    if (glare > 0) {
      c.spark(x - 1, y, S.eyes.ramp[0], glare * 0.25);
      c.spark(x + 1, y, S.eyes.ramp[0], glare * 0.25);
    }
  }
}

// ---------------------------------------------------------------------------
// Heads

/** His bare head from the front: long and pale, the crest running back over the crown, eyes sunk deep, red marks under them. */
function headFront(c: PixelCanvas, U: number, p: Pose): void {
  const cx = 12 + (p.headX ?? 0);
  if (S.helm) return helmFront(c, cx, U, p);
  c.part();
  c.ellipse(cx, 11.8 + U, 3.4, 3.6, S.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.95 - 0.1, 1) });
  // The crest: a ridge of bone from the brow back over the crown, just standing proud of it.
  c.part();
  c.shape(8 + U, 10 + U, (y) => {
    const u = (y + 0.5 - 8 - U) / 2;
    const hw = 0.5 + 0.4 * u;
    return [cx - hw, cx + hw];
  }, S.skin, (_x, _y, t) => cyl(t * 0.8, 0.6));
  // A heavy brow over sunken sockets, cheekbones and a thin mouth.
  for (let x = cx - 3; x <= cx + 2; x++) c.shade(x, 11 + U, -1);
  for (const x of [cx - 2, cx + 1]) c.shade(x, 11 + U, -1);
  c.shade(cx - 3, 13 + U, -1);
  c.shade(cx + 2, 13 + U, -1);
  c.shade(cx - 1, 14.6 + U, -2);
  c.shade(cx, 14.6 + U, -2);
  // The marks: a red bar down from each eye.
  c.part();
  for (const x of [cx - 2, cx + 1]) {
    c.px(x, 13 + U, S.mark, sphere(0, 0.2, 1));
    c.px(x, 14 + U, S.mark, sphere(0, 0.4, 1), { bias: -1 });
  }
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink, p.glare);
}

/** The Voidhunter's helm from the front: a black dome with a ridge, a slit of light across it, horns sweeping out and up. */
function helmFront(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const h = S.helm!;
  hornPair(c, cx, U, false);
  c.part();
  c.ellipse(cx, 11.6 + U, 3.6, 3.9, S.plate, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.15, 1) });
  // The jaw comes to a point over the collar.
  c.part();
  c.shape(14 + U, 15.6 + U, (y) => {
    const u = (y + 0.5 - 14 - U) / 1.6;
    const hw = 2.4 - 1.6 * u;
    return [cx - hw, cx + hw];
  }, S.plate, (_x, _y, t) => cyl(t, -0.4));
  // The ridge down the middle.
  for (let y = 8; y <= 10; y++) c.shade(cx - 1, y + U, 1);
  // The visor: one slit of light, brighter at the middle.
  c.part();
  for (let x = cx - 3; x <= cx + 2; x++) c.px(x, 12 + U, h.visor, FLAT_DOWN);
  const k = p.blink ? 0.35 : 0.55 + (p.glare ?? 0) * 0.45;
  for (let x = cx - 3; x <= cx + 2; x++) {
    const mid = 1 - Math.abs(x + 0.5 - cx) / 3.5;
    c.spark(x, 12 + U, h.visor.ramp[1], k * (0.5 + mid * 0.5));
    c.spark(x, 11 + U, h.visor.ramp[0], k * 0.18 * mid);
    c.spark(x, 13 + U, h.visor.ramp[0], k * 0.18 * mid);
  }
  // The seam under the slit, lit.
  c.part();
  c.px(cx - 1, 13 + U, S.trim, FLAT_DOWN);
  c.px(cx, 13 + U, S.trim, FLAT_DOWN);
}

/** Two horns from the helm's temples, curving out and up; `back` draws them from behind. */
function hornPair(c: PixelCanvas, cx: number, U: number, back: boolean): void {
  const h = S.helm!;
  c.part();
  const pts: [number, number, number][] = [
    [-3.6, 9.6, 0],
    [-4.6, 8.6, 0],
    [-5.2, 7.4, 1],
    [-5.3, 6.2, 1],
    [-5.0, 5.2, 2],
  ];
  for (const s of [-1, 1]) {
    for (const [dx, y, tip] of pts) {
      const x = cx - 0.5 + s * (dx + 0.5) + (s < 0 ? 0 : 0);
      c.px(x, y + U, h.horn, sphere(s * 0.5, -0.4 - tip * 0.2, 1), { bias: tip === 2 ? 1 : back ? -1 : 0 });
      if (tip === 0) c.px(x - s, y + U, h.horn, sphere(s * 0.3, -0.2, 1), { bias: -1 });
    }
  }
}

function headBack(c: PixelCanvas, U: number): void {
  const cx = 12;
  if (S.helm) {
    hornPair(c, cx, U, true);
    c.part();
    c.ellipse(cx, 11.6 + U, 3.6, 3.9, S.plate, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
    // A seam of light down the back of the helm.
    c.part();
    for (let y = 9; y <= 14; y++) c.px(cx - 1 + (y > 12 ? 0 : 0), y + U, S.trim, sphere(0, (y - 11) / 4, 1));
    return;
  }
  c.part();
  c.ellipse(cx, 11.6 + U, 3.2, 3.7, S.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
  // The crest runs on down the back of the skull.
  c.part();
  c.shape(8 + U, 12.6 + U, (y) => {
    const u = (y + 0.5 - 8 - U) / 4.6;
    const hw = 0.7 + 0.5 * Math.sin(u * Math.PI);
    return [cx - hw, cx + hw];
  }, S.skin, (_x, _y, t) => cyl(t * 0.8, 0.5), { bias: 1 });
  c.shade(cx - 3, 12 + U, -1);
  c.shade(cx + 2, 12 + U, -1);
}

/** The head in profile, facing left: the long skull, the crest over it, the brow, the eye. */
function headSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  if (S.helm) {
    const h = S.helm;
    c.part();
    c.ellipse(hx - 0.8, 11.6 + U, 3.4, 3.8, S.plate, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.15, 1) });
    // The faceplate juts to a point at the chin.
    c.part();
    c.shape(13 + U, 15.5 + U, (y) => {
      const u = (y + 0.5 - 13 - U) / 2.5;
      return [hx - 4.4 + u * 1.6, hx - 1.4];
    }, S.plate, (_x, _y, t) => cyl(t * 0.8 - 0.3, -0.3));
    // The horn sweeps back from the temple and curls up.
    c.part();
    for (const [dx, y, k] of [[0.4, 9, 0], [1.4, 8.2, 0], [2.4, 7.4, 1], [3.2, 6.4, 1], [3.6, 5.4, 2]] as const) {
      c.px(hx + dx, y + U, h.horn, sphere(0.3, -0.5 - k * 0.2, 1), { bias: k === 2 ? 1 : 0 });
      if (k === 0) c.px(hx + dx, y + 1 + U, h.horn, sphere(0.2, 0.1, 1), { bias: -1 });
    }
    // The visor slit along the front.
    c.part();
    for (let x = -4; x <= -2; x++) c.px(hx + x, 12 + U, h.visor, FLAT_DOWN);
    const k = p.blink ? 0.35 : 0.6 + (p.glare ?? 0) * 0.4;
    for (let x = -4; x <= -2; x++) c.spark(hx + x, 12 + U, h.visor.ramp[1], k * (x === -4 ? 0.9 : 0.6));
    c.spark(hx - 5, 12 + U, h.visor.ramp[0], k * 0.3);
    c.part();
    c.px(hx + 1, 12 + U, S.trim, FLAT_DOWN);
    c.px(hx + 1, 13 + U, S.trim, FLAT_DOWN);
    return;
  }
  c.part();
  c.ellipse(hx - 0.8, 11.8 + U, 3.2, 3.6, S.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 - 0.1, dy * 0.95 - 0.1, 1) });
  // The long jaw, forward and down.
  c.part();
  c.shape(13 + U, 15 + U, (y) => {
    const u = (y + 0.5 - 13 - U) / 2;
    return [hx - 3.9 + u * 0.9, hx - 0.6];
  }, S.skin, (_x, _y, t) => cyl(t * 0.8 - 0.3, -0.2));
  // The crest, a ridge from the brow back over the crown to the nape.
  c.part();
  for (const [dx, y] of [[-2, 8], [-1, 8], [0, 8], [1, 8], [2, 9], [3, 10]] as const) c.px(hx + dx, y + U, S.skin, sphere(dx / 4, -0.8, 1), { bias: 1 });
  // The brow over a sunken eye; the nose; the mark down the cheek.
  c.part();
  c.px(hx - 4, 11 + U, S.skin, sphere(-0.7, -0.4, 1), { bias: 1 });
  c.px(hx - 5, 12 + U, S.skin, sphere(-0.8, 0, 1), { bias: 1 });
  c.shade(hx - 3, 11 + U, -1);
  c.shade(hx - 3, 14 + U, -2);
  c.part();
  c.px(hx - 3, 13 + U, S.mark, sphere(-0.3, 0.2, 1));
  c.px(hx - 3, 14 + U, S.mark, sphere(-0.3, 0.4, 1), { bias: -1 });
  eyes(c, [[hx - 3, 12 + U]], p.blink, p.glare);
}

// ---------------------------------------------------------------------------
// The body, by view

/** Hip and knee for a front or back leg: crouching splays the knees out; tucking draws the feet up. */
function legFront(c: PixelCanvas, side: -1 | 1, p: Pose, L: number, foot: number): void {
  const K = p.crouch;
  const hx = 12 + side * 1.9;
  const hy = 24 + L + K;
  const fx = 12 + side * 2.0;
  const fy = 28.6 - foot - p.tuck;
  const kx = hx + side * (K * 0.45 + p.tuck * 0.3);
  const ky = Math.min(fy - 1.2, (hy + fy) / 2 + K * 0.2);
  leg(c, hx, hy, kx, ky, fx, fy);
  boot(c, fx - side * 0.3, fy + 1.3, false);
}

/** The torso from the front: a gunmetal chest plate piped in red, ribbed plates over the belly, a belt, two tassets. */
function torsoFront(c: PixelCanvas, U: number, L: number, p: Pose): void {
  const cx = 12;
  const top = 15 + U;
  const plateEnd = 19 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, plateEnd, (y) => {
    const u = (y + 0.5 - top) / (plateEnd + 1 - top);
    const hw = 4.3 - 0.5 * u * u;
    return [cx - hw, cx + hw];
  }, S.plate, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.4) * 1.1, 1));
  // The chest plate's piping along its lower edge, coming to a point at the middle.
  c.part();
  for (let x = 8; x <= 15; x++) {
    const y = plateEnd + (x === 11 || x === 12 ? 1 : 0);
    c.px(x, y, S.trim, cyl((x + 0.5 - cx) / 4, 0.1));
  }
  // The belly: suit with plate ribs.
  c.part();
  c.shape(plateEnd + 1, waist - 1, (y) => {
    const hw = y === plateEnd + 1 ? 3.6 : 3.5;
    return [cx - hw, cx + hw];
  }, S.suit, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  for (let x = 9; x <= 14; x++) if (x !== 11 && x !== 12) c.px(x, waist - 1, S.plate, cyl((x + 0.5 - cx) / 3.5, 0.2), { bias: -1 });
  // The belt and its buckle.
  c.part();
  c.shape(waist, waist, () => [cx - 3.8, cx + 3.8], S.suit, (_x, _y, t) => cyl(t, 0), { bias: -1 });
  c.part();
  c.px(cx - 1, waist, S.plate, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
  c.px(cx, waist, S.trim, { x: 0.2, y: 0.3, z: 0.9 });
  // Tassets: a plate over each hip, a gap between.
  const hem = 25 + L + Math.round(p.crouch * 0.5);
  for (const side of [-1, 1] as const) {
    c.part();
    c.shape(waist + 1, hem, (y) => {
      const u = (y + 0.5 - waist - 1) / (hem - waist);
      const inner = 0.9 + 0.2 * u;
      const outer = 3.7 + 0.5 * u + (p.crouch > 1 ? 0.4 : 0);
      return side < 0 ? [cx - outer, cx - inner] : [cx + inner, cx + outer];
    }, S.plate, (_x, _y, t, u) => cyl(t * 0.6 + side * 0.4, 0.3 - u * 0.4));
    c.px(side < 0 ? cx - 2 : cx + 1, hem, S.trim, FLAT_DOWN);
  }
}

/** The short cape behind him from the front: its edges past his sides, the crimson lining turned up at the hem. */
function capeBehindFront(c: PixelCanvas, U: number, p: Pose): void {
  const cx = 12;
  const top = 15 + U;
  const hem = 23 + U - (p.tuck ? 1 : 0);
  c.part();
  c.shape(top, hem, (y) => {
    const u = (y + 0.5 - top) / (hem + 1 - top);
    const hw = 5.4 + 1.3 * u;
    const x = cx + p.cape * u * u;
    return [x - hw, x + hw];
  }, S.cape, (_x, _y, t, u) => cyl(t, 0.2 - u * 0.3), { bias: -2 });
  c.part();
  c.shape(hem, hem, () => [cx - 6.6 + p.cape, cx + 6.6 + p.cape], S.lining, (_x, _y, t) => cyl(t, -0.2), { bias: -1 });
}

/** The cape over each shoulder, a red clasp at the front. */
function mantleFront(c: PixelCanvas, U: number): void {
  for (const x of [7.2, 16.8]) {
    c.part();
    c.ellipse(x, 16.3 + U, 2.2, 1.65, S.cape, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.85 - 0.35, 0.95) });
  }
  c.part();
  c.px(9, 16 + U, S.trim, sphere(-0.3, -0.3, 1), { bias: 1 });
  c.px(14, 16 + U, S.trim, sphere(0.3, -0.3, 1), { bias: 1 });
}

function collar(c: PixelCanvas, x: number, U: number, rx = 2.9): void {
  c.part();
  c.ellipse(x, 15.2 + U, rx, 1.5, S.plate, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7 - 0.45, 1) });
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath + p.crouch;
  const sh = { x: 7.6, y: 16.8 + U };
  // The hand's own height is set in body pixels; it rides with the body's bob.
  const bob = L + p.breath + p.crouch;
  const g = p.ring;
  // A ring slung on his back peeks over his shoulder.
  if (g?.at && g.back) drawRing(c, 0, 0, { ...g, at: { x: g.at.x, y: g.at.y + U } }, true);
  if (p.behind) saberArm(c, sh.x, sh.y, p, bob, true);

  capeBehindFront(c, U, p);
  legFront(c, -1, p, L, p.footA);
  legFront(c, 1, p, L, p.footB);
  torsoFront(c, U, L, p);

  const fh = p.free ? { x: p.free.x, y: p.free.y + bob } : { x: 17.4, y: 22.4 + U + p.arm };
  if (!p.high) arm(c, 16.4, 16.8 + U, fh.x, fh.y);
  if (!p.high) hand(c, fh.x, fh.y);
  if (!p.behind && !p.high) saberArm(c, sh.x, sh.y, p, bob, false);
  mantleFront(c, U);
  collar(c, 12, U);
  headFront(c, U, p);
  if (p.high) {
    arm(c, 16.4, 16.8 + U, fh.x, fh.y);
    hand(c, fh.x, fh.y);
    if (!p.behind) saberArm(c, sh.x, sh.y, p, bob, false);
  }
  // The ring balanced on his finger: over everything.
  if (g?.at && !g.back) drawRing(c, 0, 0, { ...g, at: { x: g.at.x, y: g.at.y + bob } }, false);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath + p.crouch;
  const bob = L + p.breath + p.crouch;
  const sh = { x: 16.4, y: 16.8 + U };
  // Seen from behind, a ring held out ahead is beyond him.
  if (p.behind) saberArm(c, sh.x, sh.y, p, bob, true);
  const fh = p.free ? { x: 24 - p.free.x, y: p.free.y + bob } : { x: 6.6, y: 22.4 + U + p.arm };
  const ahead = fh.y < 17 + U && !p.high;
  if (ahead) {
    arm(c, 7.6, 16.8 + U, fh.x, fh.y, -1);
    hand(c, fh.x, fh.y);
  }
  legFront(c, -1, p, L, p.footB);
  legFront(c, 1, p, L, p.footA);
  // The back: suit, a plate across the shoulder blades, the belt.
  const cx = 12;
  c.part();
  c.shape(15 + U, 22 + U, (y) => {
    const u = (y + 0.5 - 15 - U) / 8;
    const hw = 4.3 - 0.7 * u * u;
    return [cx - hw, cx + hw];
  }, S.suit, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.4) * 1.1, 1));
  for (const side of [-1, 1] as const) {
    c.part();
    c.shape(23 + U - p.breath, 25 + L + Math.round(p.crouch * 0.5), (y) => {
      const inner = 0.9;
      const outer = 3.8;
      void y;
      return side < 0 ? [cx - outer, cx - inner] : [cx + inner, cx + outer];
    }, S.plate, (_x, _y, t) => cyl(t * 0.6 + side * 0.4, 0.2), { bias: -1 });
  }
  if (!ahead && !p.high) {
    arm(c, 7.6, 16.8 + U, fh.x, fh.y);
    hand(c, fh.x, fh.y);
  }
  // The cape over his back to the hips, two folds, the lining at the hem.
  const top = 14.6 + U;
  const hem = 23.6 + U - (p.tuck ? 1 : 0);
  const edges = (y: number): [number, number] => {
    const u = Math.max(0, (y + 0.5 - top) / (hem + 1 - top));
    const hw = 4.9 + 1.9 * Math.pow(u, 1.1);
    const x = cx + p.cape * u * u;
    return [x - hw, x + hw];
  };
  c.part();
  c.shape(Math.round(top), Math.round(hem) - 1, edges, S.cape, (_x, _y, t, u) => cyl(t * 0.9, 0.3 - u * 0.4));
  for (let y = Math.round(top + 3); y < Math.round(hem); y++) {
    const [l, r] = edges(y);
    c.shade(Math.round(l + (r - l) * 0.3), y, -1);
    c.shade(Math.round(l + (r - l) * 0.68), y, -1);
  }
  c.part();
  c.shape(Math.round(hem), Math.round(hem), edges, S.lining, (_x, _y, t) => cyl(t, -0.2));
  collar(c, 12, U, 3.1);
  headBack(c, U);
  if (!p.behind && !p.high) saberArm(c, sh.x, sh.y, p, bob, false);
  // The mantle's shoulders, over the arms.
  for (const x of [7.2, 16.8]) {
    c.part();
    c.ellipse(x, 16.3 + U, 2.2, 1.65, S.cape, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.85 - 0.35, 0.95) });
  }
  if (p.high) {
    arm(c, 7.6, 16.8 + U, fh.x, fh.y);
    hand(c, fh.x, fh.y);
    if (!p.behind) saberArm(c, sh.x, sh.y, p, bob, false);
  }
  const g = p.ring;
  if (g?.at) drawRing(c, 0, 0, { ...g, at: { x: 24 - g.at.x, y: g.at.y + (g.back ? U : bob) } }, false);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath + p.crouch;
  const bob = L + p.breath + p.crouch;
  const cx = 12;
  const Sx = -p.lean;
  const hx = cx + Sx;
  const sh = { x: hx + 0.6, y: 17.2 + U };
  const g = p.ring;
  if (g?.at && g.back) drawRing(c, 0, 0, { ...g, at: { x: g.at.x + Sx, y: g.at.y + U } }, true);
  if (p.behind) saberArm(c, sh.x, sh.y, p, bob, true);

  // The cape streaming behind, the lining showing on its inside edge.
  const top = 15 + U;
  const hem = 23.4 + U - (p.tuck ? 1 : 0);
  const back = (y: number) => {
    const u = Math.max(0, (y + 0.5 - top) / (hem + 1 - top));
    return hx + 3.3 + 2.6 * Math.pow(u, 1.2) + p.cape * u * u;
  };
  const front = (y: number) => {
    const u = Math.max(0, (y + 0.5 - top) / (hem + 1 - top));
    return hx + 0.2 + 1.6 * u + p.cape * 0.6 * u * u;
  };
  c.part();
  c.shape(Math.round(top), Math.round(hem), (y) => [front(y), back(y)], S.cape, (_x, _y, t, u) => cyl(t * 0.8 + 0.2, 0.25 - u * 0.3), { bias: -1 });
  c.part();
  for (let y = Math.round(top + 4); y <= Math.round(hem); y++) c.px(Math.round(front(y)), y, S.lining, cyl(-0.4, 0.1));

  // Far arm, mostly hidden behind the body.
  const fh = p.free ? { x: p.free.x + Sx, y: p.free.y + bob } : { x: hx + 2.6 - p.arm, y: 22.4 + U };
  if (!p.high) {
    arm(c, hx + 1.8, 17 + U, fh.x, fh.y, -1);
    hand(c, fh.x, fh.y);
  }

  // Legs: the back leg in shade first.
  const K = p.crouch;
  const lift = (f: number) => Math.max(0, f) * 0.35;
  const sideLeg = (f: number, bias: number, x0: number) => {
    const hy = 24 + L + K;
    const fx = x0 + 0.2 - f - p.tuck * 0.5;
    const fy = 28.6 - lift(f) - p.tuck;
    // A bent knee comes forward (left).
    const kx = (x0 + fx) / 2 - K * 0.7 - p.tuck * 0.9 - (f > 0 ? 0.4 : 0);
    const ky = Math.min(fy - 1.2, (hy + fy) / 2);
    leg(c, x0, hy, kx, ky, fx, fy, bias);
    boot(c, fx - 0.7, fy + 1.3, true, bias);
  };
  sideLeg(p.footB, -1, cx + 0.9);
  sideLeg(p.footA, 0, cx - 0.2);

  // The torso in profile: chest plate, piping, belly, belt, a tasset on the hip.
  c.part();
  c.shape(15 + U, 19 + U, (y) => [hx - 2.8 - (y >= 16 + U && y <= 17 + U ? 0.4 : 0), hx + 2.6], S.plate, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, (u - 0.4) * 1.1, 1));
  c.part();
  c.shape(20 + U, 21 + U, () => [hx - 2.5, hx + 2.4], S.suit, (_x, _y, t) => cyl(t * 0.9 - 0.1, 0.1));
  c.part();
  for (let x = Math.round(hx - 2.8); x < Math.round(hx + 2.6); x++) c.px(x, 19 + U, S.trim, cyl(((x + 0.5 - hx) / 2.7) * 0.9 - 0.1, 0.1));
  c.part();
  c.shape(22 + U, 22 + U, () => [hx - 2.7, hx + 2.6], S.suit, (_x, _y, t) => cyl(t, 0), { bias: -1 });
  c.part();
  c.px(Math.round(hx - 2.7), 22 + U, S.trim, { x: -0.5, y: 0.3, z: 0.8 });
  c.part();
  const tHem = 25 + L + Math.round(K * 0.5);
  c.shape(23 + U, tHem, (y) => {
    const u = (y + 0.5 - 23 - U) / Math.max(1, tHem - 22 - U);
    return [cx - 1.8 - u * 0.6 + Sx * 0.5, cx + 2.2 + u * 0.3];
  }, S.plate, (_x, _y, t, u) => cyl(t * 0.8, 0.3 - u * 0.4));

  collar(c, hx - 0.2, U, 2.4);
  headSide(c, hx, U, p);

  if (!p.behind && !p.high) saberArm(c, sh.x, sh.y, p, bob, false);
  // The mantle over the near shoulder, its clasp at the front.
  c.part();
  c.ellipse(hx + 0.9, 16.4 + U, 2.6, 1.9, S.cape, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.1, dy * 0.85 - 0.35, 0.95) });
  c.part();
  c.px(Math.round(hx - 1.5), 16 + U, S.trim, sphere(-0.4, -0.3, 1), { bias: 1 });
  if (p.high) {
    arm(c, hx + 1.8, 17 + U, fh.x, fh.y, -1);
    hand(c, fh.x, fh.y);
    if (!p.behind) saberArm(c, sh.x, sh.y, p, bob, false);
  }
  if (g?.at && !g.back) drawRing(c, 0, 0, { ...g, at: { x: g.at.x + Sx, y: g.at.y + bob } }, false);
}

// ---------------------------------------------------------------------------
// Animations

function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 8;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph - 0.6) > 0.1 ? 1 : 0;
    // The ring turns lazily in his fingers.
    p.ring!.rot += Math.round(Math.sin(ph) * 2) * 6;
    p.cape = Math.sin(ph - 2.2) > 0.5 ? 1 : 0;
    p.blink = f === 5;
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
    p.cape = view === 'side' ? 1 + (p.lift ? 0 : 1) : Math.round(-s);
    if (view === 'side') {
      p.footA = Math.round(s * 2.4);
      p.footB = -p.footA;
      p.arm = Math.round(s * 1.5);
      p.hand.x += -s;
      p.ring!.rot += s * 10;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.arm = Math.round(-s);
      p.hand.y += s > 0 ? -1 : 0;
    }
    frames.push(p);
  }
  return frames;
}

/** Where the empty saber hand is held while the ring flies: raised, open, steering it. */
const GUIDE: Record<View, { x: number; y: number }> = {
  down: { x: 5, y: 19.5 },
  up: { x: 19, y: 19.5 },
  side: { x: 6.5, y: 18.5 },
};

/** His idle and walk with the ring away: the hand raised and open, a red glow swelling and ebbing in it. */
function bare(of: (view: View) => Pose[]) {
  return (view: View): Pose[] =>
    of(view).map((p, i, all) => {
      const ph = (i / all.length) * Math.PI * 2;
      p.ring = null;
      p.hand = { x: GUIDE[view].x + Math.round(Math.sin(ph) * 0.6), y: GUIDE[view].y + (Math.cos(ph) > 0.5 ? -0.5 : 0) };
      p.glow = 0.4 + 0.2 * Math.sin(ph);
      return p;
    });
}

/** A keyframe: the hand, its ring (null: let go), and the pose's extras. */
type Key = { hand: [number, number]; ring: Ring | null; o?: Partial<Pose> };
const k = (x: number, y: number, ring: Ring | null, o: Partial<Pose> = {}): Key => ({ hand: [x, y], ring, o });

function keyed(keys: Record<View, Key[]>, extra: (p: Pose, i: number, view: View) => void = () => {}) {
  return (view: View): Pose[] =>
    keys[view].map((key, i) => {
      const p = base(view);
      p.hand = { x: key.hand[0], y: key.hand[1] };
      p.ring = key.ring;
      Object.assign(p, key.o);
      extra(p, i, view);
      return p;
    });
}

/**
 * The close cut: the ring whirled across in front of him, spinning in his
 * hand like a saw blade, from high on his weapon side to low on the other.
 */
export const WHIRL_HIT = 2;
const whirl = keyed(
  {
    down: [
      k(4, 17.5, rg(30, 0.8, 120, { spin: 0.3 }), { free: { x: 17.6, y: 21.4 } }),
      k(7.5, 23, rg(-20, 0.75, 200, { spin: 0.8 }), { free: { x: 18.4, y: 20.6 }, crouch: 1 }),
      k(12.5, 24.5, rg(-80, 0.7, 290, { spin: 1 }), { free: { x: 19, y: 20 }, crouch: 1 }),
      k(17, 22, rg(-140, 0.75, 370, { spin: 0.8 }), { free: { x: 19, y: 21 } }),
      k(15, 20, rg(-160, 0.85, 430, { spin: 0.3 }), { free: { x: 18, y: 21.6 } }),
      k(6.5, 22, rg(0, 1, 470)),
    ],
    up: [
      k(20, 17.5, rg(150, 0.8, 60, { spin: 0.3 }), { free: { x: 17.6, y: 21.4 } }),
      k(16.5, 15.5, rg(200, 0.75, -20, { spin: 0.8 }), { free: { x: 18.4, y: 20.6 }, crouch: 1, behind: true }),
      k(11.5, 14.5, rg(260, 0.7, -110, { spin: 1 }), { free: { x: 19, y: 20 }, crouch: 1, behind: true }),
      k(7, 16, rg(320, 0.75, -190, { spin: 0.8 }), { free: { x: 19, y: 21 }, behind: true }),
      k(9, 19.5, rg(340, 0.85, -250, { spin: 0.3 }), { free: { x: 18, y: 21.6 } }),
      k(17.5, 22, rg(180, 1, -290)),
    ],
    side: [
      k(15, 16, rg(150, 0.7, 60, { spin: 0.3 }), { behind: true }),
      k(7.5, 18, rg(30, 0.6, 150, { spin: 0.8 }), { lean: 1, footA: 2, footB: -1, crouch: 1 }),
      k(3.5, 21, rg(-10, 0.55, 240, { spin: 1 }), { lean: 2, footA: 2, footB: -1, crouch: 1, cape: 2 }),
      k(5, 24.5, rg(-40, 0.6, 320, { spin: 0.8 }), { lean: 1, footA: 2, footB: -1, cape: 2 }),
      k(7.5, 24, rg(-30, 0.75, 380, { spin: 0.3 }), { lean: 1, footA: 1, cape: 1 }),
      k(8.4, 22.2, rg(30, 0.85, 400)),
    ],
  },
  (p, i, view) => {
    if (view !== 'side') p.cape = i >= 1 && i <= 3 ? (view === 'down' ? 1 : -1) : 0;
    if (view !== 'side' && i >= 1 && i <= 3) p.footA = 1;
  },
);

/**
 * The throw: the ring drawn back across his body, tilted flat, then whipped
 * out and let go at full stretch (the flying ring is the game's own effect,
 * see game/Inquisitor.ts), the empty hand following through.
 */
export const THROW_RELEASE = 2;
const throwRing = keyed({
  down: [
    k(15.5, 18, rg(-20, 0.45, 40, { spin: 0.4 }), { crouch: 1, free: { x: 18.6, y: 22 } }),
    k(9, 23, rg(-60, 0.4, 130, { spin: 1 }), { crouch: 1, free: { x: 19, y: 20.6 }, footA: 1, cape: 1 }),
    k(5, 24, null, { glow: 0.7, free: { x: 19, y: 20.6 }, footA: 1, cape: 1 }),
    k(5.5, 22, null, { glow: 0.5, free: { x: 18, y: 21.6 } }),
  ],
  up: [
    k(8.5, 18, rg(190, 0.45, 140, { spin: 0.4 }), { crouch: 1, free: { x: 18.6, y: 22 } }),
    k(15, 15.5, rg(230, 0.4, 230, { spin: 1 }), { crouch: 1, free: { x: 19, y: 20.6 }, footA: 1, cape: -1, behind: true }),
    k(19, 13.5, null, { glow: 0.7, free: { x: 19, y: 20.6 }, footA: 1, cape: -1, behind: true }),
    k(18.5, 18, null, { glow: 0.5, free: { x: 18, y: 21.6 } }),
  ],
  side: [
    k(16.5, 18.5, rg(160, 0.45, 40, { spin: 0.4 }), { behind: true, lean: -1, footA: -1, footB: 1, crouch: 1 }),
    k(8, 19.5, rg(10, 0.4, 150, { spin: 1 }), { lean: 1, footA: 2, footB: -1, crouch: 1, cape: 2 }),
    k(2.5, 19, null, { glow: 0.7, lean: 2, footA: 3, footB: -2, cape: 3 }),
    k(4.5, 20.5, null, { glow: 0.5, lean: 1, footA: 2, footB: -1, cape: 2 }),
  ],
});

/** The catch: the open hand up to meet the ring as it comes home spinning, then back to his guard. */
const catchRing = keyed({
  down: [
    k(5, 19, null, { glow: 0.9 }),
    k(5.4, 20.5, rg(10, 0.55, 260, { spin: 1 }), { breath: 1 }),
    k(5.4, 21.8, rg(10, 0.9, 300, { spin: 0.3 })),
  ],
  up: [
    k(19, 19, null, { glow: 0.9 }),
    k(18.6, 20.5, rg(170, 0.55, -80, { spin: 1 }), { breath: 1 }),
    k(18.6, 21.8, rg(170, 0.9, -40, { spin: 0.3 })),
  ],
  side: [
    k(6, 18, null, { glow: 0.9 }),
    k(7, 20, rg(30, 0.55, 300, { spin: 1 }), { breath: 1 }),
    k(8, 21.8, rg(30, 0.8, 250, { spin: 0.3 })),
  ],
});

/**
 * Hunter's leap, played by the game frame by frame as he flies: the crouch,
 * the spring (arms flung up), tucked in the air with the ring spinning at his
 * side, and the ring raised high over his head to bring down.
 */
export const LEAP_FRAMES = 4;
const leap = keyed({
  down: [
    k(5.5, 24, rg(10, 0.9, 210), { crouch: 3, free: { x: 18.5, y: 23.5 }, cape: 1 }),
    k(6, 14.5, rg(40, 0.8, 250, { spin: 0.4 }), { free: { x: 18.5, y: 15 }, footA: 1, footB: 1, cape: -1, high: true }),
    k(5, 19, rg(10, 0.5, 300, { spin: 1 }), { tuck: 3, free: { x: 17.5, y: 20 }, cape: -1 }),
    k(9, 8.5, rg(60, 0.45, 340, { spin: 1 }), { tuck: 1, free: { x: 15, y: 9.5 }, high: true, glare: 1 }),
  ],
  up: [
    k(18.5, 24, rg(170, 0.9, -30), { crouch: 3, free: { x: 18.5, y: 23.5 }, cape: -1 }),
    k(18, 14.5, rg(140, 0.8, -70, { spin: 0.4 }), { free: { x: 18.5, y: 15 }, footA: 1, footB: 1, cape: 1, high: true }),
    k(19, 19, rg(170, 0.5, -120, { spin: 1 }), { tuck: 3, free: { x: 17.5, y: 20 }, cape: 1 }),
    k(15, 8.5, rg(120, 0.45, -160, { spin: 1 }), { tuck: 1, free: { x: 15, y: 9.5 }, high: true }),
  ],
  side: [
    k(7.5, 24, rg(40, 0.85, 210), { crouch: 3, lean: 2, footA: 2, footB: -2, cape: 1 }),
    k(6, 13.5, rg(60, 0.7, 250, { spin: 0.4 }), { lean: 1, footA: -1, footB: -3, cape: 3, high: true }),
    k(6, 19.5, rg(20, 0.5, 300, { spin: 1 }), { tuck: 3, lean: 1, cape: 3 }),
    k(10, 8.5, rg(80, 0.45, 340, { spin: 1 }), { tuck: 1, lean: -1, cape: 2, high: true, glare: 1 }),
  ],
});

/** The landing: the ring driven down to the ground in front of him in a deep crouch, then up out of it. */
const land = keyed({
  down: [
    k(8.5, 27.5, rg(-60, 0.45, 20, { spin: 1 }), { crouch: 4, free: { x: 19.5, y: 22 }, cape: 2, glare: 1 }),
    k(7, 25, rg(-20, 0.75, 80, { spin: 0.4 }), { crouch: 2, free: { x: 18.5, y: 23 }, cape: 1 }),
    k(5.6, 23, rg(10, 1, 160), { crouch: 1 }),
  ],
  up: [
    k(15.5, 27.5, rg(240, 0.45, 160, { spin: 1 }), { crouch: 4, free: { x: 19.5, y: 22 }, cape: -2 }),
    k(17, 25, rg(200, 0.75, 100, { spin: 0.4 }), { crouch: 2, free: { x: 18.5, y: 23 }, cape: -1 }),
    k(18.4, 23, rg(170, 1, 20), { crouch: 1 }),
  ],
  side: [
    k(3.5, 27, rg(-20, 0.5, 20, { spin: 1 }), { crouch: 4, lean: 2, footA: 3, footB: -2, cape: 3, glare: 1 }),
    k(6, 25, rg(10, 0.7, 120, { spin: 0.4 }), { crouch: 2, lean: 1, footA: 2, footB: -1, cape: 2 }),
    k(8, 23, rg(30, 0.85, 200), { crouch: 1, footA: 1, cape: 1 }),
  ],
});

/**
 * Purge, his Special's cast (and his pick on the select screen): the ring
 * swept up over his head and spun there flat, faster and faster, his eyes
 * flaring, then flung out with the hand left raised to drive it round.
 */
const purge = keyed({
  down: [
    k(5.5, 19, rg(20, 0.8, 200, { spin: 0.3 }), { free: { x: 18, y: 22 } }),
    k(7, 9, rg(90, 0.32, 0, { spin: 0.7 }), { free: { x: 18.5, y: 21 }, high: true, glare: 0.3 }),
    k(7, 9, rg(90, 0.32, 60, { spin: 1 }), { free: { x: 18.5, y: 21 }, high: true, glare: 0.7, breath: 1 }),
    k(7, 9, rg(90, 0.32, 120, { spin: 1 }), { free: { x: 18.5, y: 21 }, high: true, glare: 1, breath: 1 }),
    k(5, 10.5, null, { glow: 1, free: { x: 19, y: 20 }, high: true, glare: 1, cape: 1 }),
  ],
  up: [
    k(18.5, 19, rg(160, 0.8, -20, { spin: 0.3 }), { free: { x: 18, y: 22 } }),
    k(17, 9, rg(90, 0.32, 0, { spin: 0.7 }), { free: { x: 18.5, y: 21 }, high: true }),
    k(17, 9, rg(90, 0.32, 60, { spin: 1 }), { free: { x: 18.5, y: 21 }, high: true, breath: 1 }),
    k(17, 9, rg(90, 0.32, 120, { spin: 1 }), { free: { x: 18.5, y: 21 }, high: true, breath: 1 }),
    k(19, 10.5, null, { glow: 1, free: { x: 19, y: 20 }, high: true, cape: -1 }),
  ],
  side: [
    k(7, 19, rg(40, 0.75, 210, { spin: 0.3 }), {}),
    k(9.5, 8.5, rg(90, 0.32, 0, { spin: 0.7 }), { high: true, glare: 0.3, lean: -1 }),
    k(9.5, 8.5, rg(90, 0.32, 60, { spin: 1 }), { high: true, glare: 0.7, lean: -1, breath: 1 }),
    k(9.5, 8.5, rg(90, 0.32, 120, { spin: 1 }), { high: true, glare: 1, lean: -1, breath: 1 }),
    k(7.5, 10, null, { glow: 1, high: true, glare: 1, cape: 2 }),
  ],
});

/** Auto Battle's throw: out, a beat empty-handed while it flies, and the catch, in one move. */
const hurl = (view: View): Pose[] => {
  const t = throwRing(view);
  const c = catchRing(view);
  return [t[0], t[1], t[2], t[3], { ...t[3], glow: 0.7 }, c[0], c[1], c[2]];
};

// ---------------------------------------------------------------------------
// The idle moment (`rest`): he tosses the ring up onto one finger and spins
// it there flat, blades lit, watching it; catches it, puts the blades out
// and slings it on his back; stands a while; then draws it and lights it.
// Facing the viewer only.

function rest(view: View): Pose[] {
  if (view !== 'down') return [];
  const at = (o: Partial<Pose>): Pose => ({ ...base('down'), ...o });
  /** Balanced on the raised finger, spinning flat, blades turned to `rot`. */
  const spinning = (rot: number, o: Partial<Pose> = {}): Pose =>
    at({ hand: { x: 5.5, y: 13.5 }, finger: true, high: true, headX: -1, ring: { grip: 0, tilt: 0.3, rot, len: 6, spin: 0.7, at: { x: 5.5, y: 10 } }, ...o });
  const slung: Ring = { grip: 0, tilt: 1, rot: 225, len: 0, at: { x: 15.5, y: 14 }, back: true };
  return [
    // 0: his guard.
    idle('down')[0],
    // 1: the ring brought up before his chest.
    at({ hand: { x: 7.5, y: 19 }, ring: rg(0, 1, 230), free: { x: 17.6, y: 21.6 } }),
    // 2: tossed up, tipping flat as it lands on the raised finger.
    at({ hand: { x: 5.5, y: 14 }, finger: true, high: true, ring: { grip: 0, tilt: 0.55, rot: 260, len: 6, at: { x: 5.5, y: 9.5 } }, breath: 1 }),
    // 3-6: spinning there, a quarter turn of the blades a frame (the pair repeats every half turn).
    spinning(0),
    spinning(45, { glare: 0.4 }),
    spinning(90, { glare: 0.6 }),
    spinning(135, { glare: 0.4 }),
    // 7: caught out of the air.
    at({ hand: { x: 6, y: 16.5 }, high: true, ring: rg(20, 0.85, 240), breath: 1 }),
    // 8: blades out, the ring held at his shoulder.
    at({ hand: { x: 7.5, y: 16 }, high: true, ring: rg(20, 0.95, 240, { len: 0 }) }),
    // 9: reaching over his shoulder to sling it on his back.
    at({ hand: { x: 10.5, y: 14.5 }, high: true, ring: { ...slung, at: { x: 14, y: 14 } } }),
    // 10-11: standing easy, the ring's rim showing over his shoulder.
    at({ hand: { x: 6.6, y: 22.4 }, ring: slung, free: { x: 17.4, y: 22.4 } }),
    at({ hand: { x: 6.6, y: 22.4 }, ring: slung, free: { x: 17.4, y: 22.4 }, breath: 1, blink: true }),
    // 12: drawn again, the blades springing out.
    at({ hand: { x: 6.5, y: 20 }, ring: rg(10, 1, 215, { len: 3 }), glare: 0.5 }),
  ];
}

const REST_ORDER = [0, 1, 2, 3, 4, 5, 6, 3, 4, 5, 6, 3, 4, 5, 6, 3, 4, 7, 7, 8, 9, 10, 10, 11, 10, 10, 11, 10, 9, 8, 12, 1, 0] as const;

// ---------------------------------------------------------------------------
// Frame generation

export type InqAnim = 'idle' | 'walk' | 'idle_bare' | 'walk_bare' | 'whirl' | 'throw' | 'catch' | 'leap' | 'land' | 'purge' | 'hurl' | 'rest';

interface AnimDef {
  name: InqAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Frame indices to play in sequence, when some are held or repeated. */
  order?: readonly number[];
}

/** The fps of the timed moves. */
export const INQ_FPS = { whirl: 22, throw: 18, catch: 18, land: 14 } as const;

export const INQ_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'idle_bare', fps: 6, loop: true, poses: bare(idle) },
  { name: 'walk_bare', fps: 10, loop: true, poses: bare(walk) },
  { name: 'whirl', fps: INQ_FPS.whirl, loop: false, poses: whirl },
  { name: 'throw', fps: INQ_FPS.throw, loop: false, poses: throwRing },
  { name: 'catch', fps: INQ_FPS.catch, loop: false, poses: catchRing },
  // Played frame by frame by the game, as he flies.
  { name: 'leap', fps: 8, loop: false, poses: leap },
  { name: 'land', fps: INQ_FPS.land, loop: false, poses: land },
  { name: 'purge', fps: 8, loop: false, poses: purge },
  { name: 'hurl', fps: 14, loop: false, poses: hurl },
  { name: 'rest', fps: 8, loop: false, poses: rest, order: REST_ORDER },
];

export interface InqFrame {
  key: string;
  anim: InqAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(INQ_W, INQ_H).offset(BODY_X, BODY_Y);
  hiddenHalo = [];
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  // A blade behind the body glows only where the body doesn't cover it.
  for (const [x, y, a] of hiddenHalo) {
    const under = c.materialAt(x, y);
    if (!under || under === S.blade.core || under === S.blade.edge) c.spark(x, y, S.bladeGlow, a);
  }
  hiddenHalo = [];
  return dir === 'right' ? c.mirrored() : c;
}

export function buildInquisitorFrames(look: InqLook = INQUISITOR_LOOK): InqFrame[] {
  S = look;
  const out: InqFrame[] = [];
  for (const a of INQ_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, pose) }));
    }
  }
  S = INQUISITOR_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Button icons (16x16), drawn additively on black like the Sith's.

type Tones = [RGB, RGB, RGB, RGB];

/** The ring saber's colours, brightest first, and the Voidhunter's. */
export const INQ_ICON: Tones = [hex('#fff6f2'), hex('#ff6a62'), hex('#f0283a'), hex('#a8101e')];
export const VOIDHUNTER_ICON: Tones = [hex('#fbf6ff'), hex('#d0a8ff'), hex('#9a5aff'), hex('#4a1a9a')];

function iconCanvas(): { px: Uint8ClampedArray; add: (x: number, y: number, c: RGB, a?: number) => void } {
  const N = 16;
  const px = new Uint8ClampedArray(N * N * 4);
  const add = (x: number, y: number, c: RGB, a = 1) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const i = (y * N + x) * 4;
    px[i] = Math.min(255, px[i] + c[0] * a);
    px[i + 1] = Math.min(255, px[i + 1] + c[1] * a);
    px[i + 2] = Math.min(255, px[i + 2] + c[2] * a);
    px[i + 3] = 255;
  };
  return { px, add };
}

const CHROME: RGB = [196, 202, 220];
const CHROME_DARK: RGB = [70, 74, 92];

/** The attack: the ring saber spinning, its two blades sweeping round it, the arc of their light behind each. */
export function ringSaberIcon(k: Tones = INQ_ICON): Uint8ClampedArray {
  const { px, add } = iconCanvas();
  const cx = 7.5;
  const cy = 7.5;
  // The blur of the spin: two faint arcs trailing the blades.
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 0.9;
    for (const off of [0, Math.PI]) {
      const r = 6.2;
      add(cx + Math.cos(a + off + 0.4) * r, cy + Math.sin(a + off + 0.4) * r, k[3], 0.25 + (i / 30) * 0.45);
    }
  }
  // The blades: out of opposite sides of the ring, each along its edge.
  for (const [ex, ey, dx, dy] of [[cx + 2.6, cy - 1.2, -0.42, -0.9], [cx - 2.6, cy + 1.2, 0.42, 0.9]] as const) {
    for (let i = 0; i <= 6; i++) {
      const x = ex + dx * i;
      const y = ey + dy * i;
      add(x, y, k[0]);
      add(x + 1, y, k[1], 0.7);
      add(x - 1, y, k[2], 0.45);
    }
  }
  // The ring: chrome, lit at the top left.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const lit = Math.cos(a + 2.3) > 0.2;
    add(cx + Math.cos(a) * 2.6, cy + Math.sin(a) * 2.6, lit ? CHROME : CHROME_DARK, 0.9);
  }
  add(cx + 2.6, cy - 1.2, k[1], 0.6);
  add(cx - 2.6, cy + 1.2, k[1], 0.6);
  return px;
}

/** The ability: a dotted arc of the leap over to the right, coming down on a ring of red shockwave. */
export function hunterLeapIcon(k: Tones = INQ_ICON): Uint8ClampedArray {
  const { px, add } = iconCanvas();
  // The shockwave on the ground: a flat ring, brightest at the front.
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const x = 10 + Math.cos(a) * 5;
    const y = 12.5 + Math.sin(a) * 2.2;
    add(x, y, Math.sin(a) > 0 ? k[1] : k[2], Math.sin(a) > 0 ? 0.95 : 0.6);
  }
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.5;
    add(10 + Math.cos(a) * 6.5, 12.5 + Math.sin(a) * 3.6, k[3], 0.7);
  }
  // The arc of the leap, a dotted trail fading behind.
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = 1 + t * 9;
    const y = 11 - Math.sin(t * Math.PI * 0.85) * 9;
    if (i % 2 === 0) add(x, y, i > 6 ? k[1] : k[2], 0.4 + t * 0.6);
  }
  // The ring coming down at the end of it, blades lit.
  const rx = 10;
  const ry = 6;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    add(rx + Math.cos(a) * 1.8, ry + Math.sin(a) * 1.8, CHROME, 0.8);
  }
  for (let i = 1; i <= 3; i++) {
    add(rx + 1.8, ry - i, k[0]);
    add(rx - 1.8, ry + i, k[0]);
    add(rx + 2.6, ry - i, k[2], 0.5);
    add(rx - 2.6, ry + i, k[2], 0.5);
  }
  // The impact's heart.
  add(10, 12, k[0]);
  add(9, 12, k[1], 0.8);
  add(11, 12, k[1], 0.8);
  add(10, 11, k[1], 0.6);
  return px;
}
