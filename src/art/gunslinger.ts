// The Gunslinger: a clockwork cowboy of blued iron and brass. A wide-brimmed
// hat over a riveted face plate with one glowing eye-slit, a navy bandana, a
// long dun duster with a short cape over the shoulders, open down the front
// over a boiler chest where a revolver's cylinder sits for a heart, its six
// chambers glowing as it turns. Two exhaust pipes stand behind its shoulders,
// iron legs end in boots with brass spurs, and two six-shooters ride in the
// holsters on its gunbelt.
//
// The Desperado skin is built on the same rig but is its own figure: copper
// plate gone to rust in patches, a tall straw sombrero with an upturned brim
// and pompoms, a wire moustache and a glowing cigarillo, a striped poncho over
// the shoulders with a bandolier of brass rounds across it, leather chaps over
// copper legs, big star rowels on its spurs, and fire the colour of a forge.
//
// Three views like every hero: down, up, and the side view drawn facing left
// and mirrored for right. Frames are GUNSL_W x GUNSL_H with the feet on GROUND
// at the centre; the body keeps to about the usual 24x32 box, the hat's crown
// a little over it, guns and steam spilling past.

import { FLAT, PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { DIRS, type Dir } from './wizard';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const GUNSL_W = 48;
export const GUNSL_H = 48;
const CX = 24;
const GROUND = 44;
export const GUNSL_ORIGIN_X = CX;
export const GUNSL_ORIGIN_Y = GROUND;
/** Where the hip sits above the feet, standing, and the body's height hip to shoulders. */
const HIP = 11;
const TORSO = 9;
/** The chest (the cylinder) above the feet: where blows meet it and its steam rises from. */
export const GUNSL_CHEST_Y = HIP + TORSO - 5;
/** How long the duster hangs below the hip. */
const COAT_LEN = 8;

/** Where each hand holds its gun aimed (A his right hand, the near one side on), from the body's middle and the shoulders' top. */
const AIM_FRONT = { x: 3.5, y: 5 };
const AIM_BACK = { x: 6.5, y: 2 };
const AIM_SIDE = [
  { x: -7, y: 3 },
  { x: -6, y: 2 },
];
/** The barrel's line runs this far above the hand (the grip hangs below it), and the muzzle this far along it. */
const BORE = 1.3;
const BARREL = 6;

/**
 * Where the bullets leave the guns, aimed, relative to the feet: A and B, for
 * each view (the side view facing left; mirror x for right).
 */
export const GUNSL_MUZZLE: Record<'down' | 'up' | 'side', [{ x: number; y: number }, { x: number; y: number }]> = {
  down: [
    { x: -AIM_FRONT.x, y: -(HIP + TORSO) + AIM_FRONT.y + 1.5 },
    { x: AIM_FRONT.x, y: -(HIP + TORSO) + AIM_FRONT.y + 1.5 },
  ],
  up: [
    { x: -AIM_BACK.x, y: -(HIP + TORSO) + AIM_BACK.y - 4.5 },
    { x: AIM_BACK.x, y: -(HIP + TORSO) + AIM_BACK.y - 4.5 },
  ],
  side: [
    { x: AIM_SIDE[0].x - BARREL, y: -(HIP + TORSO) + AIM_SIDE[0].y - BORE },
    { x: AIM_SIDE[1].x - BARREL, y: -(HIP + TORSO) + AIM_SIDE[1].y - BORE },
  ],
};

// ---------------------------------------------------------------------------
// Materials

/** Blued gunmetal plate, cool where the light catches it. */
const PLATE: Material = { ramp: ramp('#10141c', '#1e2632', '#323e4c', '#4c5c6e', '#728598', '#a8bccc'), outline: hex('#05070a'), outlineLit: hex('#0e1218'), shine: true };
/** The darker iron of the limbs, hands and joints. */
const IRON: Material = { ramp: ramp('#0a0c10', '#181c24', '#2a3038', '#424a56', '#646e7c'), outline: hex('#030405'), shine: true };
const JOINT: Material = { ramp: ramp('#06070a', '#111318', '#1c2026'), outline: hex('#020203') };
const BRASS: Material = { ramp: ramp('#4a2c0c', '#8a5a1a', '#c8902e', '#f0c860', '#fff0b0'), outline: hex('#1e1004'), outlineLit: hex('#2e1a06'), shine: true };
const STEEL: Material = { ramp: ramp('#1c222a', '#3a4450', '#66748a', '#a6b4c4', '#e8f0f8'), outline: hex('#07090c'), shine: true };
/** The guns' ivory grips. */
const IVORY: Material = { ramp: ramp('#5e5444', '#958a70', '#c8bc9c', '#eee6cc'), outline: hex('#1e1a12') };
/** The duster: dun oilskin, weathered. */
const DUSTER: Material = { ramp: ramp('#170f09', '#2a1d13', '#42301f', '#5a432c', '#76593b'), outline: hex('#080503'), outlineLit: hex('#140d08') };
const FELT: Material = { ramp: ramp('#0c0a0a', '#1a1616', '#2a2422', '#3c3430', '#524842'), outline: hex('#040303'), outlineLit: hex('#0c0a09') };
const LEATHER: Material = { ramp: ramp('#140a05', '#28170b', '#3e2713', '#58391c'), outline: hex('#070301') };
const BANDANA: Material = { ramp: ramp('#08102c', '#122048', '#1e3472', '#30509e'), outline: hex('#030616') };
/** Its eye, the cylinder's chambers and its gunfire: a cold white-blue. */
const EYE: Material = { ramp: ramp('#2a64e8', '#6aaeff', '#c4e6ff', '#ffffff'), outline: hex('#0a1640'), emissive: 1, noAO: true };
const FLASH: Material = { ramp: ramp('#4a8cff', '#a8d6ff', '#e8f6ff', '#ffffff'), outline: hex('#0a1a40'), emissive: 1, noAO: true, noOutline: true };
const SMOKE: Material = { ramp: ramp('#525a68', '#7c8492', '#a8b0bc', '#d0d6de'), outline: hex('#22262e'), emissive: 0.12, noAO: true, noOutline: true };
const STEAM: Material = { ramp: ramp('#8a96a6', '#c0cad6', '#e6ecf2', '#ffffff'), outline: hex('#4a5462'), noAO: true, noOutline: true, emissive: 0.15 };
const VOID: Material = { ramp: ramp('#010203', '#05070a'), outline: hex('#000000'), noAO: true, noOutline: true };

// The Desperado's.
const COPPER: Material = { ramp: ramp('#2a0e05', '#54200c', '#86401e', '#bc6836', '#e69c68', '#ffd0a4'), outline: hex('#120502'), outlineLit: hex('#220b04'), shine: true };
const RUST: Material = { ramp: ramp('#241006', '#3e1e0c', '#5e3014', '#7e461e', '#9a5c2c'), outline: hex('#120502') };
const STRAW: Material = { ramp: ramp('#3a260e', '#644620', '#946e36', '#c29a54', '#e8c886'), outline: hex('#170e04'), outlineLit: hex('#22160a') };
const RED: Material = { ramp: ramp('#320606', '#5c100e', '#8c1e18', '#bc3626', '#e05a3a'), outline: hex('#170202') };
const CREAM: Material = { ramp: ramp('#7a6a4c', '#b0a07c', '#ddcfa8', '#fbf2d4'), outline: hex('#28200e') };
const TEAL: Material = { ramp: ramp('#082828', '#124646', '#1e6a68', '#348e88'), outline: hex('#031212') };
const MUSTARD: Material = { ramp: ramp('#5e3406', '#9a5c0e', '#d69226', '#fcc45a'), outline: hex('#261202') };
const TAN: Material = { ramp: ramp('#26140a', '#462814', '#6a4222', '#8e5c34', '#ae7a4c'), outline: hex('#100703') };
const EMBER: Material = { ramp: ramp('#c8340a', '#ff7a24', '#ffc860', '#fff4d0'), outline: hex('#300a02'), emissive: 1, noAO: true };
const FIRE: Material = { ramp: ramp('#ff5a10', '#ffa040', '#ffe0a0', '#ffffff'), outline: hex('#401002'), emissive: 1, noAO: true, noOutline: true };
const SOOT: Material = { ramp: ramp('#4a3c34', '#74645a', '#a09084', '#c8b8aa'), outline: hex('#201812'), emissive: 0.12, noAO: true, noOutline: true };

export interface GunslLook {
  /** Texture key; animations are `${key}_${anim}_${dir}`. */
  key: string;
  /** The Desperado: copper and rust, a sombrero, a poncho and a bandolier, no duster. */
  desperado: boolean;
  /** Body plate, limb iron and trim (named for the gear sets' dressing). */
  plate: Material;
  iron: Material;
  band: Material;
  /** The guns' frames and cylinders. */
  steel: Material;
  /** The coat (or poncho's ground), and the hat. */
  coat: Material;
  hat: Material;
  /** Its eye and chambers, its muzzle fire and its gun smoke. */
  eye: Material;
  flash: Material;
  smoke: Material;
  /** The colour of light its fire throws. */
  glow: RGB;
}

export const GUNSL_LOOK: GunslLook = { key: 'gunsl', desperado: false, plate: PLATE, iron: IRON, band: BRASS, steel: STEEL, coat: DUSTER, hat: FELT, eye: EYE, flash: FLASH, smoke: SMOKE, glow: [150, 205, 255] };
export const DESPERADO_LOOK: GunslLook = { key: 'gunsl_desperado', desperado: true, plate: COPPER, iron: IRON, band: BRASS, steel: STEEL, coat: RED, hat: STRAW, eye: EMBER, flash: FIRE, smoke: SOOT, glow: [255, 160, 70] };
export const GUNSL_LOOKS = [GUNSL_LOOK, DESPERADO_LOOK];

/** The look being drawn; set by buildGunslFrames. */
let L: GunslLook = GUNSL_LOOK;

type View = 'down' | 'up' | 'side';
type Pt = { x: number; y: number };

/** One arm and its gun. */
export interface GunArm {
  /** 0 hanging by the holster, 1 aimed out. */
  reach: number;
  /** The recoil: the muzzle thrown up, 0..1. */
  kick: number;
  /** Raised beside the hat, barrel skyward, 0..1. */
  up: number;
  /** Hand to the hat's brim, 0..1 (arm A only). */
  brim: number;
  /** Twirling: the gun's angle round the finger, beside it. */
  spin: number | null;
  /** The gun in the hand (else holstered). */
  drawn: boolean;
  /** The palm fanning the other gun's hammer, 0..1 (arm B only). */
  fan: number;
  /** Muzzle fire: 1 the flash, 2 its tail. And smoke drifting off it, 0..1. */
  flash: number;
  smoke: number;
  /** A glint of light along the barrel. */
  glint: boolean;
  /** The hand lifted (fingers hovering over the holster), px. */
  hover: number;
}

export interface GunslPose {
  /** Raised (walking) or lowered (+crouch) at the hip; jolted sideways. */
  bob: number;
  crouch: number;
  shake: number;
  /** The side view's lean, px at the shoulders (+ forward). */
  lean: number;
  /** Feet lifted, and in the side view stepped forward (-) or back. */
  liftA: number;
  liftB: number;
  strideA: number;
  strideB: number;
  a: GunArm;
  b: GunArm;
  /** The hat raised off its head (px), or tipped down over the eye (-1). */
  hat: number;
  /** The eye: 0 dim, 1 as always, 2 blazing (dead-eye). A contented squint. */
  eye: number;
  squint: boolean;
  /** The cylinder's turn, in sixths of a chamber's step (30°), and how bright its chambers are. */
  cyl: number;
  chambers: number;
  /** The coat's tails swung sideways (-1..1), and flared out by a dive (0..1). */
  tails: number;
  flare: number;
  /** Steam boiling off it (overheated), 0..1; a puff from under the hat (a stage of PUFFS). */
  vent: number;
  puff: number;
}

const arm = (o: Partial<GunArm> = {}): GunArm => ({ reach: 0, kick: 0, up: 0, brim: 0, spin: null, drawn: false, fan: 0, flash: 0, smoke: 0, glint: false, hover: 0, ...o });

const base = (): GunslPose => ({
  bob: 0, crouch: 0, shake: 0, lean: 0, liftA: 0, liftB: 0, strideA: 0, strideB: 0, a: arm(), b: arm(),
  hat: 0, eye: 1, squint: false, cyl: 0, chambers: 1, tails: 0, flare: 0, vent: 0, puff: 0,
});

// ---------------------------------------------------------------------------
// Little helpers

const hash = (a: number, b: number, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** A soft blob of steam (or smoke): solid at heart, dithering away as `solid` drops. */
function cloud(c: PixelCanvas, cx: number, cy: number, r: number, solid: number, m: Material): void {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const nx = (x + 0.5 - cx) / r;
      const ny = (y + 0.5 - cy) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      if (solid < 1 && (d2 > 0.35 + solid || ((x + y) & 1 && d2 > solid * 0.6))) continue;
      c.px(x, y, m, sphere(nx, ny, 0.9), { bias: ny < -0.3 ? 1 : 0 });
    }
}

/**
 * Rust on the Desperado's copper: blotches, steady on the body (measured from
 * its own middle, so they ride along with it). Called straight after a part is
 * drawn, so the rust stays in that part's layer.
 */
function rust(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, ox: number, oy: number): void {
  if (!L.desperado) return;
  for (let y = Math.floor(y0); y <= y1; y++)
    for (let x = Math.floor(x0); x <= x1; x++) {
      if (c.materialAt(x, y) !== COPPER) continue;
      const bx = x - Math.round(ox);
      const by = y - Math.round(oy);
      const blotch = hash(Math.floor((bx + 40) / 2), Math.floor((by + 40) / 2), 7) > 0.7 || hash(bx + 40, by + 40, 11) > 0.9;
      if (!blotch) continue;
      const i = y * c.w + x;
      const n: Vec3 = { x: c.nx[i], y: c.ny[i], z: c.nz[i] };
      c.px(x, y, RUST, n, { bias: c.bias[i] });
    }
}

/** A glove of iron, fingers curled. */
function hand(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.ellipse(x, y, 1.15, 1.05, L.iron);
  c.px(x - 1, y - 1, L.iron, { x: -0.5, y: 0.6, z: 0.6 }, { bias: 1 });
}

/**
 * A six-shooter in the hand at (hx, hy): its barrel at angle `a` in the
 * picture, or pointed at the viewer (fore 1, lifting with `tilt`) or away
 * (fore -1). Ivory grip, a fat cylinder over the hand, a long barrel with its
 * ejector rod under it. Returns the muzzle.
 */
function revolver(c: PixelCanvas, hx: number, hy: number, a: number, fore: -1 | 0 | 1, tilt = 0): Pt {
  const st = L.steel;
  const frame = L.desperado ? BRASS : st;
  if (fore === 1) {
    // Pointed at the viewer: the hand round the grip, the cylinder's face, the muzzle's dark mouth in front.
    const my = hy + 1.5 - tilt * 2.2;
    c.part();
    c.px(hx - 0.5, hy + 0.5, IVORY, sphere(0, 0.6), { bias: -1 });
    hand(c, hx, hy);
    c.part();
    if (tilt > 0.3) c.px(hx - 0.5, my + 1.2, st, sphere(0, 0.7), { bias: -1 });
    c.ellipse(hx, my, 1.5, 1.4, frame);
    c.px(hx - 0.5, my - 0.5, VOID);
    return { x: hx, y: my };
  }
  if (fore === -1) {
    // Pointed away: the barrel standing up over the hand, the hammer at its back.
    c.part();
    hand(c, hx, hy);
    c.part();
    c.px(hx - 0.5, hy - 1, frame, sphere(-0.3, -0.3), { bias: 1 });
    c.px(hx + 0.5, hy - 1, frame, sphere(0.4, -0.2));
    for (let i = 2; i <= 3.5; i += 1) c.px(hx - 0.5, hy - i, st, sphere(-0.3, 0.1), { bias: i > 3 ? 1 : 0 });
    c.px(hx + 0.5, hy + 0.2, st, sphere(0.5, 0.3), { bias: -1 });
    return { x: hx, y: hy - 4.5 };
  }
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  // The grip hangs to the side nearer the ground.
  let px = -uy;
  let py = ux;
  if (py < 0 || (py === 0 && px < 0)) {
    px = -px;
    py = -py;
  }
  c.part();
  c.px(hx - ux * 0.5 + px * 0.9, hy - uy * 0.5 + py * 0.9, IVORY, sphere(-ux * 0.4, 0.2), { bias: 1 });
  c.px(hx - ux * 1.1 + px * 1.9, hy - uy * 1.1 + py * 1.9, IVORY, sphere(-ux * 0.4, 0.5));
  c.px(hx - ux * 1.5 + px * 2.7, hy - uy * 1.5 + py * 2.7, st, sphere(0, 0.6), { bias: -1 });
  hand(c, hx, hy);
  const ox = hx - px * BORE;
  const oy = hy - py * BORE;
  c.part();
  // The hammer, cocked back.
  c.px(ox - ux * 1.3 - px * 0.5, oy - uy * 1.3 - py * 0.5, st, sphere(-ux * 0.3, -0.5), { bias: 1 });
  // The cylinder: two px thick, bright along its top, a dark flute.
  for (let i = -0.4; i <= 1.7; i += 0.5) {
    c.px(ox + ux * i, oy + uy * i, frame, sphere(0, -0.6), { bias: 1 });
    c.px(ox + ux * i + px * 0.9, oy + uy * i + py * 0.9, frame, sphere(0, 0.5), { bias: i > 0.4 && i < 1.2 ? -2 : 0 });
  }
  // The barrel, the ejector rod under it, and the front sight.
  for (let i = 2.1; i <= BARREL - 0.4; i += 0.5) {
    c.px(ox + ux * i, oy + uy * i, st, sphere(0, -0.4), { bias: i > BARREL - 1 ? 1 : 0 });
    if (i < BARREL - 1.8) c.px(ox + ux * i + px * 0.9, oy + uy * i + py * 0.9, st, sphere(0, 0.5), { bias: -1 });
  }
  c.px(ox + ux * (BARREL - 0.8) - px * 0.9, oy + uy * (BARREL - 0.8) - py * 0.9, st, sphere(0, -0.8), { bias: 1 });
  return { x: ox + ux * BARREL, y: oy + uy * BARREL };
}

/** Fire out of a muzzle: a hot flash (1), or its fading tail (2). `fore` 1 coming at the viewer, -1 going away. */
function muzzleFire(c: PixelCanvas, m: Pt, ux: number, uy: number, stage: number, fore: -1 | 0 | 1): void {
  if (stage <= 0) return;
  c.part();
  const F = L.flash;
  const g = L.glow;
  const big = stage === 1;
  if (fore === 1) {
    // Straight at the viewer: a star.
    c.ellipse(m.x, m.y, big ? 2.1 : 1.2, big ? 1.9 : 1.1, F, { bias: big ? 1 : -1 });
    if (big)
      for (const [dx, dy, n] of [[1, 0, 4], [-1, 0, 4], [0, 1, 3], [0, -1, 3], [0.7, 0.7, 2], [-0.7, 0.7, 2], [0.7, -0.7, 2], [-0.7, -0.7, 2]] as const)
        for (let i = 2; i <= n + 1; i++) c.px(m.x + dx * i - 0.5, m.y + dy * i - 0.5, F, FLAT, { bias: i > n ? -1 : 0 });
    for (let k = 0; k < 12; k++) {
      const q = (k / 12) * Math.PI * 2;
      c.spark(m.x + Math.cos(q) * 3.5, m.y + Math.sin(q) * 3, g, big ? 0.45 : 0.18);
    }
    return;
  }
  const px = -uy;
  const py = ux;
  if (big) {
    c.ellipse(m.x + ux * 1.2, m.y + uy * 1.2, 1.7, 1.7, F, { bias: 1 });
    // The tongue of fire out along the bore, and two petals either side.
    for (let i = 2; i <= 5; i++) c.px(m.x + ux * (1 + i) - 0.5, m.y + uy * (1 + i) - 0.5, F, FLAT, { bias: i < 4 ? 1 : -1 });
    for (const s of [-1, 1]) {
      c.px(m.x + ux * 1.6 + px * s * 2.3 - 0.5, m.y + uy * 1.6 + py * s * 2.3 - 0.5, F, FLAT);
      c.px(m.x + ux * 2.4 + px * s * 3 - 0.5, m.y + uy * 2.4 + py * s * 3 - 0.5, F, FLAT, { bias: -1 });
    }
    if (fore === -1) for (let i = 1; i <= 3; i++) c.px(m.x - 0.5, m.y - 1 - i, F, FLAT, { bias: -1 });
  } else {
    c.px(m.x + ux * 1.2 - 0.5, m.y + uy * 1.2 - 0.5, F, FLAT, { bias: -1 });
    c.px(m.x + ux * 2.4 - 0.5, m.y + uy * 2.4 - 0.5, F, FLAT, { bias: -2 });
  }
  for (let k = 0; k < 10; k++) {
    const q = (k / 10) * Math.PI * 2;
    c.spark(m.x + ux * 1.5 + Math.cos(q) * 3.2, m.y + uy * 1.5 + Math.sin(q) * 3.2, g, big ? 0.4 : 0.15);
  }
}

/** Gun smoke drifting up off a muzzle, swelling and thinning as `k` runs 0..1. */
function gunSmoke(c: PixelCanvas, m: Pt, ux: number, uy: number, k: number): void {
  if (k <= 0) return;
  c.part();
  for (let i = 0; i < 3; i++) {
    const x = m.x + ux * (1 + i * 1.4) * k - i * 0.6;
    const y = m.y + uy * (1 + i * 1.4) * k - k * (2 + i * 1.6);
    cloud(c, x, y, 0.9 + k * 0.8 + i * 0.25, 1.05 - k * 0.75, L.smoke);
  }
}

/** A glint running along the barrel: a little star of light at the muzzle. */
function glint(c: PixelCanvas, m: Pt): void {
  const g = L.glow;
  c.spark(m.x, m.y, [255, 255, 255], 0.9);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(m.x + dx, m.y + dy, g, 0.6);
  for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) c.spark(m.x + dx, m.y + dy, g, 0.25);
}

/** The stages of the steam let out from under its hat: a gasp, a column, a cloud rolling off, wisps. Offsets [dx, dy, r, solid]. */
const PUFFS: [number, number, number, number][][] = [
  [],
  [[0, -1, 1.2, 1]],
  [[0, -1.5, 1.5, 1], [0.6, -4, 2, 1]],
  [[0.4, -2, 1.3, 1], [1.4, -4.5, 2.3, 1], [3.4, -6, 2.4, 1]],
  [[2, -4.5, 1.8, 0.6], [4.4, -6.5, 2.6, 0.8], [7, -6, 1.8, 0.6]],
  [[5.5, -7, 2.2, 0.45], [8.5, -6.5, 2, 0.35]],
];

function puff(c: PixelCanvas, x: number, y: number, stage: number): void {
  c.part();
  for (const [dx, dy, r, solid] of PUFFS[stage] ?? []) cloud(c, x + dx, y + dy, r, solid, STEAM);
}

/** Steam boiling off an overheated body: out of its collar, its cuffs and the hem of its coat. */
function boilOff(c: PixelCanvas, k: number, tb: number, hb: number, bx: number): void {
  const white: RGB = [230, 236, 244];
  const pts: [number, number][] = [[-7, 1], [7, 1], [-3, -3], [3, -3], [-7, 9], [7, 9], [-5, COAT_LEN + 6], [5, COAT_LEN + 6], [0, -4]];
  pts.forEach(([dx, dy], i) => {
    const r = 1 + k * 1.4 + (i % 2) * 0.5;
    const y0 = (dy > 4 ? hb - TORSO : tb) + dy - k * 3;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) c.spark(bx + dx + x, y0 + y, white, 0.3 * k);
  });
  // A few solid wisps, so it reads at 1x.
  c.part();
  cloud(c, bx - 7, tb - 1 - k * 3, 1.2 + k, 0.5 + k * 0.4, STEAM);
  cloud(c, bx + 7, tb - 2 - k * 2, 1 + k, 0.4 + k * 0.4, STEAM);
  cloud(c, bx, tb - 5 - k * 2, 1 + k * 0.8, 0.3 + k * 0.4, STEAM);
}

// ---------------------------------------------------------------------------
// Shared parts

/** The revolver's cylinder in its chest: steel round a dark pin, six chambers glowing as it turns. */
function cylinder(c: PixelCanvas, cx: number, cy: number, r: number, p: GunslPose): void {
  c.part();
  c.ellipse(cx, cy, r, r, L.desperado ? BRASS : STEEL, { flatten: 0.8 });
  c.part();
  // The pin, and a dark ring round the chambers' mouths.
  for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) c.px(cx + dx, cy + dy, JOINT, FLAT, { bias: dx === -1 && dy === -1 ? 1 : 0 });
  const glow = p.chambers <= 0 ? 0 : 0.35 + 0.65 * Math.min(1, p.chambers);
  for (let i = 0; i < 6; i++) {
    const a = ((p.cyl % 12) / 12) * Math.PI * 2 + (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r * 0.66 - 0.5;
    const y = cy + Math.sin(a) * r * 0.66 * 0.95 - 0.5;
    c.px(x, y, L.eye, FLAT, { glow, bias: i === 0 ? 1 : p.chambers > 1 ? 0 : -1 });
  }
  if (p.chambers > 1) for (let k = 0; k < 10; k++) c.spark(cx + Math.cos(k * 0.63) * (r + 1), cy + Math.sin(k * 0.63) * (r + 1), L.glow, 0.25);
}

/** A holster at the hip with its gun's ivory grip standing out of it, or empty. `s` the side. */
function holster(c: PixelCanvas, x: number, y: number, s: number, full: boolean, view: View): void {
  const tooled = L.desperado ? TAN : LEATHER;
  c.part();
  // The pouch, hanging a little forward off the belt.
  const tilt = view === 'side' ? 0.6 : s * 0.25;
  for (let i = 0; i <= 4; i++) {
    const w = i < 3 ? 1 : 0.6;
    for (let d = -w; d <= w; d += 1) c.px(x + tilt * i + d - 0.5, y + i, tooled, cyl(d / 1.5, 0.2), { bias: i === 0 ? 1 : d > 0 ? -1 : 0 });
  }
  if (L.desperado) c.px(x + tilt * 2 - 0.5, y + 2, BRASS, FLAT, { bias: 1 });
  if (!full) return;
  c.part();
  // The grip and hammer of the gun in it.
  const gx = x - tilt * 1.6 - s * 0.6;
  c.px(gx - 0.5, y - 1, IVORY, sphere(-0.3, -0.4), { bias: 1 });
  c.px(gx - 0.5 - s * 0.8, y - 2, IVORY, sphere(-0.3, -0.5), { bias: 1 });
  c.px(gx - 0.5 + s * 0.9, y - 1, L.steel, sphere(0.3, -0.4));
}

/** A boot: an iron-shod toe, a stacked heel and a spur at the back. `s` the outward side; side view faces left. */
function boot(c: PixelCanvas, fx: number, fy: number, s: number, view: View): void {
  const leather = L.desperado ? TAN : LEATHER;
  c.part();
  if (view === 'side') {
    c.shape(fy - 4, fy - 3, () => [fx - 1.5, fx + 1.5], leather, (_x, _y, t) => cyl(t, 0.2));
    c.shape(fy - 2, fy - 1, (y) => [fx - 3.5 + (y === fy - 2 ? 1 : 0), fx + 1.5], leather, (_x, _y, t, u) => sphere(t * 0.8, u - 0.3, 0.9));
    c.px(fx - 3.5, fy - 1, L.iron, sphere(-0.6, 0.2), { bias: 1 });
    c.px(fx + 1, fy - 1, JOINT, FLAT);
    // The spur: a brass shank and a rowel.
    c.part();
    c.px(fx + 1.5, fy - 2, L.band, sphere(0.4, -0.3), { bias: 1 });
    c.px(fx + 2.5, fy - 2, L.band, sphere(0.6, 0), { bias: 0 });
    if (L.desperado) {
      c.px(fx + 3.5, fy - 2, L.band, FLAT, { bias: 1 });
      c.px(fx + 2.5, fy - 3, L.band, FLAT);
      c.px(fx + 2.5, fy - 1, L.band, FLAT, { bias: -1 });
    }
    return;
  }
  c.shape(fy - 4, fy - 3, () => [fx - 1.5, fx + 1.5], leather, (_x, _y, t) => cyl(t, 0.2));
  c.shape(fy - 2, fy - 1, () => [fx - 1.8 + (s < 0 ? -0.6 : 0), fx + 1.8 + (s > 0 ? 0.6 : 0)], leather, (_x, _y, t, u) => sphere(t * 0.8, u - 0.3, 0.9));
  if (view === 'down') c.px(fx + s * 0.5 - 0.5, fy - 1, L.iron, sphere(s * 0.3, 0.2), { bias: 1 });
  // A spur at the outer heel.
  c.part();
  c.px(fx + s * 2.5 - 0.5, fy - 2, L.band, sphere(s * 0.5, -0.2), { bias: 1 });
  if (L.desperado) {
    c.px(fx + s * 3.5 - 0.5, fy - 2, L.band, FLAT);
    c.px(fx + s * 3.5 - 0.5, fy - 3, L.band, FLAT, { bias: 1 });
    c.px(fx + s * 3.5 - 0.5, fy - 1, L.band, FLAT, { bias: -1 });
  }
}

/** A leg from the hip to the foot: iron thigh and shin round a brass knee (the Desperado's copper, in leather chaps). */
function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, s: number, view: View, bx: number, hb: number): void {
  const kx = (hx + fx) / 2 + (view === 'side' ? -0.8 : s * 0.3);
  const ky = (hy + fy - 3) / 2;
  const limb = L.desperado ? L.plate : L.iron;
  c.part();
  c.capsule(hx, hy, kx, ky, 1.7, 1.5, limb);
  c.capsule(kx, ky, fx, fy - 3.5, 1.5, 1.25, limb);
  rust(c, Math.min(hx, fx) - 3, hy - 2, Math.max(hx, fx) + 3, fy, bx, hb);
  c.part();
  c.ellipse(kx, ky, 1.25, 1.05, L.desperado ? L.iron : L.band);
  if (L.desperado) {
    // Chaps: a leather panel down the outside of the leg, fringed.
    c.part();
    const ox = view === 'side' ? 0.6 : s * 0.9;
    for (let y = Math.round(hy); y <= fy - 4; y++) {
      const k = (y - hy) / (fy - 4 - hy);
      const x = lerp(hx, fx, k) + ox;
      const w = view === 'side' ? 1.6 : 1.1;
      for (let d = -w; d <= w; d += 1) c.px(x + d - 0.5, y, TAN, cyl(d / (w + 0.5) + (view === 'side' ? 0 : s * 0.3), 0.15), { bias: (y + Math.round(d)) % 4 === 0 ? -1 : 0 });
      if (y % 2 === 0) c.px(x + (view === 'side' ? w + 1 : s * (w + 1)) - 0.5, y, TAN, FLAT, { bias: 1 });
    }
  }
  boot(c, fx, fy, s, view);
}

/** An arm from the shoulder, through a bent elbow, to the hand: a coat sleeve with a brass cuff (the Desperado's bare copper). */
function sleeve(c: PixelCanvas, S: Pt, E: Pt, H: Pt, upperOnly: boolean, lowerOnly: boolean, bx: number, hb: number): void {
  const dx = H.x - E.x;
  const dy = H.y - E.y;
  const l = Math.hypot(dx, dy) || 1;
  const W = { x: H.x - (dx / l) * 1.3, y: H.y - (dy / l) * 1.3 };
  c.part();
  if (L.desperado) {
    if (!lowerOnly) c.capsule(S.x, S.y, E.x, E.y, 1.35, 1.15, L.plate);
    if (!upperOnly) c.capsule(E.x, E.y, W.x, W.y, 1.15, 1.05, L.plate);
    rust(c, Math.min(S.x, H.x) - 2, Math.min(S.y, H.y) - 2, Math.max(S.x, H.x) + 2, Math.max(S.y, H.y) + 2, bx, hb);
    c.part();
    if (!upperOnly) c.ellipse(E.x, E.y, 1.05, 1.05, L.iron);
    return;
  }
  if (!lowerOnly) c.capsule(S.x, S.y, E.x, E.y, 1.6, 1.45, L.coat);
  if (!upperOnly) {
    c.capsule(E.x, E.y, W.x, W.y, 1.45, 1.35, L.coat);
    c.part();
    c.ellipse(W.x, W.y, 1.3, 1.2, L.coat, { bias: 1 });
    c.px(W.x - 0.5, W.y - 0.5, L.band, sphere(-0.3, -0.4), { bias: 1 });
  }
}

// ---------------------------------------------------------------------------
// The front view (facing the viewer, 'down') and the back ('up')

interface Hold {
  x: number;
  y: number;
  /** The gun's angle in the picture, or pointed at (1) or away from (-1) the viewer. */
  a: number;
  fore: -1 | 0 | 1;
}

/** Where a hand is and how its gun points, facing the viewer or away. */
function holdFront(g: GunArm, s: number, bx: number, tb: number, hb: number, hy: number, back: boolean): Hold {
  let x = bx + s * 7.5;
  let y = hb + 0.5 - g.hover;
  let a = Math.PI / 2 + s * 0.15;
  let fore: -1 | 0 | 1 = 0;
  if (g.reach > 0) {
    const to = back ? { x: bx + s * AIM_BACK.x, y: tb + AIM_BACK.y } : { x: bx + s * AIM_FRONT.x, y: tb + AIM_FRONT.y };
    x = lerp(x, to.x, g.reach);
    y = lerp(y, to.y, g.reach) - g.kick * 1.2;
    if (g.reach > 0.6) fore = back ? -1 : 1;
    else a = Math.PI / 2 + s * (0.15 + g.reach * 0.9);
  }
  if (g.up > 0) {
    x = lerp(x, bx + s * 8, g.up);
    y = lerp(y, tb - 3, g.up);
    if (g.up > 0.5) {
      fore = 0;
      a = -Math.PI / 2 + s * 0.12;
    }
  }
  if (g.brim > 0) {
    x = lerp(x, bx + s * 4.5, g.brim);
    y = lerp(y, hy - 3.5, g.brim);
  }
  if (g.spin !== null) {
    x = bx + s * 8.5;
    y = hb - 2.5;
    a = g.spin;
    fore = 0;
  }
  return { x, y, a, fore };
}

function drawFront(c: PixelCanvas, p: GunslPose, back: boolean): void {
  const desp = L.desperado;
  const bx = CX + p.shake;
  const hb = GROUND - HIP - p.bob + p.crouch;
  const tb = hb - TORSO;
  const hy = tb - 5;
  const view: View = back ? 'up' : 'down';

  const holds = [
    { g: p.a, s: -1, ...holdFront(p.a, -1, bx, tb, hb, hy, back) },
    { g: p.b, s: 1, ...holdFront(p.b, 1, bx, tb, hb, hy, back) },
  ];
  // Fanning: the palm sweeps across the top of the other gun.
  if (p.b.fan > 0) {
    const A = holds[0];
    holds[1].x = A.x + lerp(3, 0.5, p.b.fan);
    holds[1].y = A.y - 1.5;
  }
  const shoulder = (s: number): Pt => ({ x: bx + s * 5.5, y: tb + 1.5 });
  const elbow = (h: (typeof holds)[number]): Pt => {
    const S = shoulder(h.s);
    const straight = clamp(h.g.reach + h.g.up * 0.4 + h.g.fan * 0.5, 0, 1);
    const out = h.g.brim > 0 ? 2.4 : 1.6 - straight * 1.1;
    return { x: (S.x + h.x) / 2 + h.s * out, y: (S.y + h.y) / 2 + 0.6 - h.g.brim * 1.5 };
  };
  const isUp = (h: (typeof holds)[number]) => h.g.up > 0.3 || h.g.brim > 0.3 || h.g.spin !== null;
  /** An arm and what it holds; `part` 'upper' / 'lower' to split it round the poncho. */
  const drawArm = (h: (typeof holds)[number], part: 'all' | 'upper' | 'lower' = 'all') => {
    const S = shoulder(h.s);
    const E = elbow(h);
    sleeve(c, S, E, h, part === 'upper', part === 'lower', bx, hb);
    if (part === 'upper') return;
    const g = h.g;
    if (!(g.drawn || g.spin !== null)) {
      hand(c, h.x, h.y);
      return;
    }
    const m = revolver(c, h.x, h.y, h.a, h.fore, g.kick);
    const u = h.fore === 1 ? { x: 0, y: 1 } : h.fore === -1 ? { x: 0, y: -1 } : { x: Math.cos(h.a), y: Math.sin(h.a) };
    muzzleFire(c, m, u.x, u.y, g.flash, h.fore);
    gunSmoke(c, m, u.x * 0.3, -0.6, g.smoke);
    if (g.glint) glint(c, m);
  };
  // Guns aimed away go behind the body.
  const behind = (h: (typeof holds)[number]) => back && h.g.reach > 0.6 && !isUp(h);

  // The exhaust pipes behind its shoulders, peeking up past the cape from the front.
  if (!desp && !back) pipes(c, bx, tb, false);
  for (const h of holds) if (behind(h)) drawArm(h);

  // The coat's inside, seen between the legs.
  if (!desp && !back) skirt(c, p, bx, hb, 'lining');
  for (const s of [-1, 1]) {
    const lift = s < 0 ? p.liftA : p.liftB;
    leg(c, bx + s * 2.5, hb + 0.5, bx + s * 3, GROUND - lift, s, view, bx, hb);
  }
  if (!desp) skirt(c, p, bx, hb, back ? 'back' : 'front');

  // The boiler chest.
  c.part();
  c.shape(tb, hb - 1, (y) => {
    const u = (y - tb) / TORSO;
    const hw = 4.6 + 0.7 * Math.sin(u * Math.PI) - (y === hb - 1 ? 0.6 : 0);
    return [bx - hw, bx + hw];
  }, L.plate, (_x, y, t) => cyl(t * 0.9, 0.35 - ((y - tb) / TORSO) * 0.5));
  rust(c, bx - 6, tb, bx + 6, hb, bx, hb);
  if (!back) {
    // A brass band under the cylinder, riveted seams either side.
    c.part();
    for (let x = bx - 4; x < bx + 4; x++) c.px(x, hb - 2, L.band, cyl((x + 0.5 - bx) / 4.6, 0.3), { bias: (x - bx) % 2 === 0 ? 1 : 0 });
    for (const s of [-1, 1]) for (let y = tb + 3; y <= hb - 3; y += 2) c.shade(bx + s * 3.5 - 0.5, y, 1);
    cylinder(c, bx, desp ? tb + 6 : tb + 5, 3, p);
  }

  if (desp) {
    // Upper arms under the poncho, unless raised out from under it.
    for (const h of holds) if (!behind(h) && !isUp(h)) drawArm(h, 'upper');
    poncho(c, p, bx, tb, hb, back);
    bandolier(c, bx, tb, back);
  } else coatTorso(c, bx, tb, hb, back);

  belt(c, bx, hb, back, view, p);
  if (!desp && back) pipes(c, bx, tb, true);
  if (back) headBack(c, p, bx, hy, tb);
  else headFront(c, p, bx, hy, tb);

  for (const h of holds) {
    if (behind(h)) continue;
    if (desp && !isUp(h)) drawArm(h, 'lower');
    else drawArm(h);
  }

  if (p.puff > 0) puff(c, bx + 4, hy - 2 - p.hat * 0.5, p.puff);
  if (p.vent > 0) boilOff(c, p.vent, tb, hb, bx);
}

/** The two exhaust pipes behind its shoulders: brass, banded, their mouths dark (whole from behind; their tips from the front). */
function pipes(c: PixelCanvas, bx: number, tb: number, whole: boolean): void {
  c.part();
  for (const s of [-1, 1]) {
    const x = bx + s * 4.5;
    c.shape(tb - 4, whole ? tb + 2 : tb, () => [x - 1, x + 1], L.band, (_x, _y, t) => cyl(t, 0.3));
    c.px(x - 1, tb - 4, JOINT, FLAT);
    c.px(x, tb - 4, JOINT, FLAT);
    if (whole) for (let k = -1; k < 1; k++) c.shade(x + k, tb - 1, -1);
  }
}

/**
 * The duster's skirt: its inside showing between the legs (lining), the
 * two front panels open over them, or the back, whole, with a vent up the
 * middle. It swings with `tails` and flares out in a dive.
 */
function skirt(c: PixelCanvas, p: GunslPose, bx: number, hb: number, which: 'lining' | 'front' | 'back'): void {
  const top = hb - 1;
  const hem = hb + COAT_LEN - Math.round(p.flare);
  c.part();
  for (let y = top; y <= hem; y++) {
    const u = (y - top) / (hem - top);
    const hw = 5.2 + u * 2.2 + p.flare * u * 2.4;
    const sway = p.tails * u * 1.6;
    const gap = 1.1 + u * 2.1 + p.flare * u * 1.4;
    for (let x = Math.round(bx - hw + sway); x < Math.round(bx + hw + sway); x++) {
      const dx = x + 0.5 - bx - sway;
      const inGap = Math.abs(dx) < gap;
      if (y === hem && hash(x - Math.round(sway), 3) > 0.62) continue;
      const t = dx / hw;
      if (which === 'lining') {
        if (inGap && y > top + 1) c.px(x, y, L.coat, sphere(-t * 0.5, 0.1), { bias: -2 });
        continue;
      }
      if (which === 'front' && inGap) continue;
      const fold = (Math.abs(Math.abs(dx) - lerp(gap, hw, 0.55)) < 0.5 && y > top + 2) || (which === 'back' && Math.abs(dx) < 0.6 && u > 0.35);
      c.px(x, y, L.coat, sphere(t * 0.85, -0.15 - u * 0.3, 1), { bias: fold ? -1 : which === 'front' && Math.abs(dx) - gap < 1 ? 1 : 0 });
    }
  }
}

/** The duster over the body: the cape on its shoulders, the collar turned up, and (in front) the two panels open over the boiler. */
function coatTorso(c: PixelCanvas, bx: number, tb: number, hb: number, back: boolean): void {
  c.part();
  for (let y = tb; y <= hb - 1; y++) {
    const u = (y - tb) / TORSO;
    const hw = 5.6 - u * 0.5;
    const gap = back ? 0 : 3.4 + u * 0.4;
    for (let x = Math.round(bx - hw); x < Math.round(bx + hw); x++) {
      const dx = x + 0.5 - bx;
      if (Math.abs(dx) < gap) continue;
      const t = dx / hw;
      c.px(x, y, L.coat, sphere(t * 0.9, 0.2 - u * 0.4, 1), { bias: !back && Math.abs(dx) - gap < 1 ? 1 : back && Math.abs(dx) < 0.6 ? -1 : 0 });
    }
  }
  // The cape over the shoulders: closed at the throat, parting over the chest in front.
  c.part();
  const caps = [4.4, 6.4, 7.1, 7.1];
  caps.forEach((hw, k) => {
    const y = tb - 1 + k;
    for (let x = Math.round(bx - hw); x < Math.round(bx + hw); x++) {
      const dx = x + 0.5 - bx;
      if (!back && k >= 1 && Math.abs(dx) < 1.6 + k * 0.5) continue;
      const t = dx / hw;
      c.px(x, y, L.coat, sphere(t * 0.95, 0.65 - k * 0.38, 1), { bias: k === 3 ? -1 : k === 0 ? 1 : 0 });
    }
  });
  // The collar, turned up round its neck.
  c.part();
  for (const y of [tb - 3, tb - 2]) {
    for (const s of [-1, 1]) {
      const xs = back ? [s * 0.5, s * 1.5, s * 2.5, s * 3.5] : [s * 2.5, s * 3.5];
      for (const dx of xs) c.px(bx + dx - 0.5, y, L.coat, sphere(dx / 4, 0.5), { bias: y === tb - 3 ? 1 : 0 });
    }
  }
  if (!back) {
    // The bandana, knotted at the throat, its point over the chest.
    c.part();
    const rows: [number, number][] = [[tb - 2, 2], [tb - 1, 2], [tb, 1.5], [tb + 1, 1]];
    for (const [y, hw] of rows) for (let x = Math.round(bx - hw); x < Math.round(bx + hw); x++) c.px(x, y, BANDANA, sphere((x + 0.5 - bx) / 2.5, (y - tb) / 3, 1), { bias: y === tb - 2 ? 1 : 0 });
  }
}

/** The Desperado's poncho: striped, short over the chest in a V, hanging long over the arms, fringed. */
function poncho(c: PixelCanvas, p: GunslPose, bx: number, tb: number, hb: number, back: boolean): void {
  const top = tb - 1;
  const STRIPES = [RED, RED, CREAM, MUSTARD, CREAM, RED, TEAL, TEAL, CREAM, RED, RED, MUSTARD];
  c.part();
  for (let x = Math.round(bx - 8.2); x < Math.round(bx + 8.2); x++) {
    const dx = x + 0.5 - bx;
    const ad = Math.abs(dx);
    const startY = ad < 3.5 ? top : ad < 6.5 ? top + 1 : top + 2;
    const hemY = back ? hb - 2 + Math.round(Math.abs(p.tails) * 0.5) : ad < 5 ? Math.round(tb + 2.5 + ad * 0.6) : hb - 2;
    for (let y = startY; y <= hemY; y++) {
      const r = y - top;
      const m = STRIPES[r % STRIPES.length];
      const t = dx / 8.4;
      const fold = ad > 4.6 && ad < 5.6 && y > top + 2;
      c.px(x, y, m, cyl(t * 0.95, 0.55 - r * 0.1), { bias: fold ? -1 : y === startY ? 1 : 0 });
    }
    // The fringe.
    if ((x + (back ? 1 : 0)) % 2 === 0) c.px(x, hemY + 1, CREAM, sphere(0, 0.5), { bias: -1 });
  }
  if (!back) {
    // The neck opening, shadowed.
    c.part();
    for (let x = bx - 2; x < bx + 2; x++) c.shade(x, top + 1, -2);
  }
}

/** A bandolier of brass rounds slung over the poncho, shoulder to hip. */
function bandolier(c: PixelCanvas, bx: number, tb: number, back: boolean): void {
  c.part();
  const s = back ? 1 : -1;
  const x0 = bx + s * 6.5;
  const y0 = tb - 0.5;
  const x1 = bx - s * 7.5;
  const y1 = tb + 5.5;
  const n = Math.ceil(Math.abs(x1 - x0));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = lerp(x0, x1, k);
    const y = lerp(y0, y1, k);
    c.px(x, y, TAN, sphere(0, -0.3), { bias: 0 });
    c.px(x, y + 1, TAN, sphere(0, 0.4), { bias: -1 });
    // The rounds: a brass case and a copper tip poking up out of each loop.
    if (!back && i % 2 === 1) {
      c.px(x, y - 1, BRASS, sphere(-0.3, -0.3), { bias: 1 });
      c.px(x, y, BRASS, sphere(0, 0));
    }
  }
}

/** The gunbelt, its buckle, and the two holsters hanging off it. */
function belt(c: PixelCanvas, bx: number, hb: number, back: boolean, view: View, p: GunslPose): void {
  const lea = L.desperado ? TAN : LEATHER;
  c.part();
  for (const y of [hb - 1, hb]) for (let x = Math.round(bx - 5.6); x < Math.round(bx + 5.6); x++) c.px(x, y, lea, cyl((x + 0.5 - bx) / 5.8, y === hb - 1 ? 0.4 : -0.2), { bias: y === hb - 1 ? 0 : -1 });
  if (!back) {
    c.part();
    const w = L.desperado ? 2 : 1;
    for (let x = bx - w; x < bx + w; x++) for (const y of [hb - 1, hb]) c.px(x, y, L.band, sphere((x + 0.5 - bx) / 2, y === hb - 1 ? -0.4 : 0.4), { bias: y === hb - 1 ? 1 : 0 });
    if (!L.desperado) c.px(bx - 0.5 + 0, hb, JOINT, FLAT);
  } else {
    // Cartridge loops round the back.
    for (let x = bx - 4; x < bx + 4; x += 2) c.px(x, hb - 1, L.band, sphere(0, -0.5), { bias: 0 });
  }
  for (const s of [-1, 1]) {
    const g = s < 0 ? p.a : p.b;
    holster(c, bx + s * 5.5, hb + 1, s, !(g.drawn || g.spin !== null), view);
  }
}

/** Its head from the front: the riveted face plate, one eye-slit glowing, a grille for a mouth; and its hat. */
function headFront(c: PixelCanvas, p: GunslPose, bx: number, hy: number, tb: number): void {
  const desp = L.desperado;
  // The neck.
  c.part();
  c.shape(hy + 2, tb - 1, () => [bx - 1.5, bx + 1.5], L.iron, (_x, _y, t) => cyl(t, 0.1));
  // The plate: a rounded block, a little bowed.
  c.part();
  c.shape(hy - 3, hy + 2, (y) => (y === hy - 3 || y === hy + 2 ? [bx - 2, bx + 2] : [bx - 3, bx + 3]), L.plate, (_x, y, t) => sphere(t * 0.75, (y - hy + 0.5) / 4.5, 1.1));
  rust(c, bx - 4, hy - 4, bx + 4, hy + 3, bx, tb + TORSO);
  c.part();
  // Rivets at its cheeks, a seam down the middle of the brow.
  c.px(bx - 2.5, hy + 1, L.band, sphere(-0.4, -0.4), { bias: 1 });
  c.px(bx + 2.5, hy + 1, L.band, sphere(0.4, -0.4), { bias: 0 });
  // The eye-slit: a dark band right across, the glow in the middle of it.
  const ey = hy - 1;
  if (p.squint) {
    for (const [x, y] of [[bx - 2, ey], [bx - 1, ey - 1], [bx, ey - 1], [bx + 1, ey]]) c.px(x, y, L.eye, FLAT, { bias: 1 });
  } else {
    for (let x = bx - 3; x < bx + 3; x++) c.px(x, ey, JOINT, FLAT);
    for (let x = bx - 2; x < bx + 2; x++) c.px(x, ey, L.eye, FLAT, { glow: p.eye <= 0 ? 0.35 : 1, bias: (x === bx - 1 || x === bx ? 1 : 0) + (p.eye >= 2 ? 1 : p.eye <= 0 ? -2 : 0) });
    if (p.eye >= 2) {
      for (const dx of [-3.5, 3.5]) c.spark(bx + dx, ey, L.glow, 0.7);
      for (const dx of [-4.5, 4.5, -5.5, 5.5]) c.spark(bx + dx, ey, L.glow, Math.abs(dx) > 5 ? 0.2 : 0.4);
    }
  }
  if (desp) {
    // A wire moustache under the slit, its ends curling down; a cigarillo in the corner of its mouth.
    c.part();
    for (let x = bx - 2; x < bx + 2; x++) c.px(x, hy, L.iron, sphere((x + 0.5 - bx) / 3, -0.3), { bias: x === bx - 2 || x === bx + 1 ? 0 : 1 });
    c.px(bx - 3, hy + 1, L.iron, sphere(-0.5, 0.3));
    c.px(bx + 2, hy + 1, L.iron, sphere(0.5, 0.3));
    c.part();
    c.px(bx + 1, hy + 1, TAN, sphere(0, -0.2), { bias: 1 });
    c.px(bx + 2, hy + 1.6, TAN, sphere(0, 0.2));
    c.px(bx + 3, hy + 1.6, EMBER, FLAT, { bias: 1 });
    c.spark(bx + 3.5, hy + 2, [255, 140, 50], 0.6);
    c.spark(bx + 4.2, hy, [180, 160, 150], 0.25);
  } else {
    // The grille of its mouth.
    for (const [x, b] of [[bx - 2, -3], [bx - 1, -1], [bx, -1], [bx + 1, -3]] as const) c.shade(x, hy + 1, b);
  }
  hat(c, p, bx, hy, false);
}

/** Its head from behind: the back of the plate, a vent grille, and the hat. */
function headBack(c: PixelCanvas, p: GunslPose, bx: number, hy: number, tb: number): void {
  c.part();
  c.shape(hy + 2, tb - 1, () => [bx - 1.5, bx + 1.5], L.iron, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.shape(hy - 3, hy + 2, (y) => (y === hy - 3 || y === hy + 2 ? [bx - 2, bx + 2] : [bx - 3, bx + 3]), L.plate, (_x, y, t) => sphere(t * 0.75, (y - hy + 0.5) / 4.5, 1.1));
  rust(c, bx - 4, hy - 4, bx + 4, hy + 3, bx, tb + TORSO);
  for (const y of [hy, hy + 1]) for (let x = bx - 2; x < bx + 2; x++) c.shade(x, y, (x + y) % 2 ? -2 : -1);
  if (!L.desperado) {
    // The bandana's knot at the nape.
    c.part();
    c.px(bx - 1, tb - 2, BANDANA, sphere(-0.3, -0.3), { bias: 1 });
    c.px(bx, tb - 2, BANDANA, sphere(0.3, -0.3));
    c.px(bx - 1, tb - 1, BANDANA, sphere(-0.2, 0.5), { bias: -1 });
    c.px(bx + 1, tb - 1, BANDANA, sphere(0.4, 0.5), { bias: -1 });
  }
  hat(c, p, bx, hy, true);
}

/** The hat from in front or behind: a cattleman's creased crown and wide brim, or the sombrero. */
function hat(c: PixelCanvas, p: GunslPose, bx: number, hy: number, back: boolean): void {
  const by = hy - 4 - p.hat * (p.hat < 0 ? 0.5 : 1);
  const H = L.hat;
  const brimNormal = (_x: number, _y: number, dx: number, dy: number): Vec3 => (dy < 0.25 ? { x: dx * 0.35, y: 0.75, z: 0.55 } : { x: dx * 0.3, y: -0.45, z: 0.85 });
  if (L.desperado) {
    // The sombrero: a broad brim curling up at its edge, a tall cone of a crown, a red band, pompoms.
    c.part();
    c.ellipse(bx, by + 0.4, 10.6, 2.3, H, { normal: brimNormal });
    for (const s of [-1, 1]) {
      c.px(bx + s * 10.5 - 0.5, by - 1, H, sphere(s * 0.5, -0.6), { bias: 1 });
      c.px(bx + s * 9.5 - 0.5, by - 1, H, sphere(s * 0.4, -0.6));
    }
    // The upturned rim: a lit lip all round the front edge.
    for (let x = bx - 9; x < bx + 9; x++) {
      const dx = (x + 0.5 - bx) / 10.6;
      const ey = Math.floor(by + 0.4 + Math.sqrt(Math.max(0, 1 - dx * dx)) * 2.3 - 0.2);
      if (c.materialAt(x, ey) === H) c.px(x, ey, H, { x: dx * 0.3, y: 0.2, z: 1 }, { bias: 1 });
    }
    c.part();
    c.shape(by - 7, by, (y) => {
      const k = (y - (by - 7)) / 7;
      const w = y === by - 7 ? 1 : 1.6 + k * 2.2;
      return [bx - w, bx + w];
    }, H, (_x, y, t) => cyl(t, 0.5 - (y - by + 7) * 0.06));
    // Weave.
    for (let y = by - 6; y <= by; y++) for (let x = bx - 4; x < bx + 4; x++) if ((x + y * 2) % 4 === 0) c.shade(x, y, -1);
    c.part();
    for (const y of [by - 2, by - 1]) for (let x = bx - 3; x < bx + 3; x++) c.px(x, y, (x + y) % 3 === 0 ? CREAM : RED, cyl((x + 0.5 - bx) / 3.4, 0.3), { bias: y === by - 2 ? 1 : 0 });
    if (!back) {
      // Pompoms bobbing under the brim's edge.
      c.part();
      for (const dx of [-9.5, -6.5, 6.5, 9.5]) {
        const ey = by + 0.4 + Math.sqrt(Math.max(0, 1 - (dx / 10.6) ** 2)) * 2.3;
        c.px(bx + dx - 0.5, ey + 0.6, RED, sphere(0, 0.3), { bias: 1 });
      }
    } else for (let x = bx - 3; x < bx + 3; x++) c.shade(x, by + 1, -1);
    return;
  }
  // The brim, seen a little from above; then the crown on it.
  c.part();
  c.ellipse(bx, by + 0.3, 8.6, 1.75, H, { normal: brimNormal });
  // The brim's edge, curled up at either side.
  for (const s of [-1, 1]) c.px(bx + s * 8.5 - 0.5, by - 1, H, sphere(s * 0.6, -0.6), { bias: 1 });
  c.part();
  const rows = [3.2, 3.5, 3.7, 3.8, 3.8];
  rows.forEach((hw, k) => {
    const y = by - 5 + k;
    for (let x = Math.round(bx - hw); x < Math.round(bx + hw); x++) {
      const dx = x + 0.5 - bx;
      // The cattleman's crease pinched into the top of the crown.
      if (k === 0 && Math.abs(dx) < 1.6) continue;
      c.px(x, y, H, cyl(dx / hw, 0.45 - k * 0.12), { bias: k === 1 && Math.abs(dx) < 1.6 ? -1 : 0 });
    }
  });
  // The band, with a brass concho.
  c.part();
  for (let x = bx - 4; x < bx + 4; x++) c.px(x, by - 1, LEATHER, cyl((x + 0.5 - bx) / 4, 0.3));
  c.px(bx + (back ? 1.5 : -2.5), by - 1, BRASS, sphere(-0.4, -0.4), { bias: 1 });
}

// ---------------------------------------------------------------------------
// The side view, facing left

function holdSide(g: GunArm, near: boolean, bx: number, tb: number, hb: number, hy: number, off: (y: number) => number): Hold {
  const k = near ? 0 : 1;
  let x = bx + (near ? -1 : 2.5);
  let y = hb + 1 - g.hover;
  let a = Math.PI / 2 - 0.25;
  if (g.reach > 0) {
    const to = { x: bx + AIM_SIDE[k].x + off(tb + 3), y: tb + AIM_SIDE[k].y };
    x = lerp(x, to.x, g.reach);
    y = lerp(y, to.y, g.reach) - g.kick * 1.2;
    a = lerp(Math.PI / 2 - 0.25, Math.PI, Math.min(1, g.reach * 1.3)) + g.kick * 0.6;
  }
  if (g.up > 0) {
    x = lerp(x, bx + (near ? -1.5 : 1) + off(tb), g.up);
    y = lerp(y, tb - 3.5, g.up);
    if (g.up > 0.5) a = -Math.PI / 2 - 0.15;
  }
  if (g.brim > 0) {
    x = lerp(x, bx - 3.5 + off(hy), g.brim);
    y = lerp(y, hy - 3.5, g.brim);
  }
  if (g.spin !== null) {
    x = bx - 3 + off(hb - 2);
    y = hb - 2.5;
    a = g.spin;
  }
  return { x, y, a, fore: 0 };
}

function drawSide(c: PixelCanvas, p: GunslPose): void {
  const desp = L.desperado;
  const bx = CX + p.shake;
  const hb = GROUND - HIP - p.bob + p.crouch;
  const tb = hb - TORSO;
  const hy = tb - 5;
  /** How far a point at height y has leant forward (left). */
  const off = (y: number): number => -p.lean * clamp((hb - y) / TORSO, 0, 1.4);

  const near = { g: p.a, ...holdSide(p.a, true, bx, tb, hb, hy, off) };
  const far = { g: p.b, ...holdSide(p.b, false, bx, tb, hb, hy, off) };
  if (p.b.fan > 0) {
    far.x = near.x + lerp(2.5, 0, p.b.fan);
    far.y = near.y - 1.8;
  }
  const drawArm = (h: typeof near, S: Pt, front: boolean, part: 'all' | 'upper' | 'lower' = 'all') => {
    const straight = clamp(h.g.reach + h.g.up * 0.4 + h.g.fan * 0.5, 0, 1);
    const E = { x: (S.x + h.x) / 2 + 0.8 - straight * 0.6, y: (S.y + h.y) / 2 + 1.2 - straight * 0.9 - h.g.brim };
    sleeve(c, S, E, h, part === 'upper', part === 'lower', bx, hb);
    if (part === 'upper') return;
    if (!(h.g.drawn || h.g.spin !== null)) {
      hand(c, h.x, h.y);
      return;
    }
    const m = revolver(c, h.x, h.y, h.a, 0, h.g.kick);
    const u = { x: Math.cos(h.a), y: Math.sin(h.a) };
    muzzleFire(c, m, u.x, u.y, h.g.flash, 0);
    gunSmoke(c, m, u.x * 0.4, -0.6, h.g.smoke);
    if (h.g.glint) glint(c, m);
    if (!front) for (let y = Math.floor(h.y - 2); y <= h.y + 2; y++) for (let x = Math.floor(h.x - 2); x <= h.x + 2; x++) c.shade(x, y, -1);
  };
  const farS = { x: bx + 1.5 + off(tb + 1), y: tb + 1 };
  const nearS = { x: bx + 0.5 + off(tb + 2), y: tb + 2 };
  const nearUp = p.a.up > 0.3 || p.a.brim > 0.3 || p.a.spin !== null;

  // The far arm and leg, behind.
  drawArm(far, farS, false);
  leg(c, bx + 1, hb + 0.5, bx + 1 + p.strideB, GROUND - p.liftB, 1, 'side', bx, hb);
  if (!desp) pipe(c, bx + 3 + off(tb), tb);
  leg(c, bx - 0.5, hb + 0.5, bx - 1 + p.strideA, GROUND - p.liftA, -1, 'side', bx, hb);

  // The duster's skirt, flowing back off the legs.
  if (!desp) {
    c.part();
    const top = hb - 1;
    const hem = hb + COAT_LEN - Math.round(p.flare);
    for (let y = top; y <= hem; y++) {
      const u = (y - top) / (hem - top);
      const l = bx - 3 + off(y) - u * 0.6 - p.flare * u;
      const r = bx + 3.2 + u * 2.2 + p.tails * u * 2.2 + p.flare * u * 3.4;
      for (let x = Math.round(l); x < Math.round(r); x++) {
        if (y === hem && hash(x - bx, 5) > 0.6) continue;
        const t = ((x + 0.5 - l) / (r - l)) * 2 - 1;
        const fold = Math.abs(x + 0.5 - lerp(l, r, 0.6)) < 0.5 && y > top + 2;
        c.px(x, y, L.coat, sphere(t * 0.8, -0.15 - u * 0.3, 1), { bias: fold ? -1 : x === Math.round(l) ? 1 : 0 });
      }
    }
  }

  // The boiler, side on.
  c.part();
  c.shape(tb, hb - 1, (y) => {
    const u = (y - tb) / TORSO;
    const o = off(y);
    return [bx - 3.4 - 0.6 * Math.sin(u * Math.PI) + o, bx + 3 + o];
  }, L.plate, (_x, y, t) => cyl(t * 0.85, 0.35 - ((y - tb) / TORSO) * 0.5));
  rust(c, bx - 6, tb, bx + 5, hb, bx, hb);
  // The cylinder's rim at its breast, a chamber glinting.
  c.part();
  const cy = desp ? tb + 6 : tb + 5;
  for (let y = cy - 2; y <= cy + 2; y++) c.px(bx - 4 + off(y) + (Math.abs(y - cy) === 2 ? 1 : 0), y, desp ? BRASS : STEEL, { x: -0.8, y: (cy - y) * 0.2, z: 0.6 }, { bias: y === cy - 2 ? 1 : 0 });
  c.px(bx - 4 + off(cy), cy - 1 + ((p.cyl >> 1) % 3), L.eye, FLAT, { glow: p.chambers <= 0 ? 0.3 : 1 });
  c.px(bx + 2 + off(hb - 2), hb - 2, L.band, FLAT, { bias: 1 });

  if (desp) {
    if (!nearUp) drawArm(near, nearS, true, 'upper');
    // The poncho, side on: over the shoulder, hanging to the hip behind, short at the chest.
    c.part();
    const STRIPES = [RED, RED, CREAM, MUSTARD, CREAM, RED, TEAL, TEAL, CREAM, RED, RED, MUSTARD];
    const top = tb - 1;
    for (let x = Math.round(bx - 4.6 + off(tb)); x < Math.round(bx + 4.6 + off(tb)); x++) {
      const dx = x + 0.5 - bx - off(tb);
      const startY = Math.abs(dx) < 2.5 ? top : top + 1;
      const hemY = dx < -2 ? Math.round(tb + 3 - dx * 0.3) : Math.round(lerp(tb + 4, hb - 2, clamp((dx + 2) / 4, 0, 1)));
      for (let y = startY; y <= hemY; y++) {
        const r = y - top;
        c.px(x, y, STRIPES[r % STRIPES.length], sphere(dx / 5, 0.5 - r * 0.12, 1), { bias: y === startY ? 1 : 0 });
      }
      if (x % 2 === 0) c.px(x, hemY + 1, CREAM, sphere(0, 0.5), { bias: -1 });
    }
    // The bandolier across its breast.
    c.part();
    for (let i = 0; i <= 5; i++) {
      const x = bx - 3 + i * 0.9 + off(tb + 2);
      const y = tb + 4 - i * 0.9;
      c.px(x, y, TAN, sphere(0, 0));
      if (i % 2 === 0) c.px(x - 1, y, BRASS, sphere(-0.4, -0.3), { bias: 1 });
    }
  } else {
    // The duster over its back and side, the boiler showing at its open front; the cape over the shoulder.
    c.part();
    for (let y = tb; y <= hb - 1; y++) {
      const o = off(y);
      for (let x = Math.round(bx - 0.6 + o); x < Math.round(bx + 3.6 + o); x++) {
        const t = (x + 0.5 - bx - o - 1.5) / 2.2;
        c.px(x, y, L.coat, sphere(t * 0.8, 0.2 - (y - tb) * 0.05, 1), { bias: x === Math.round(bx - 0.6 + o) ? 1 : 0 });
      }
    }
    c.part();
    const caps = [3, 4.4, 4.8, 4.8];
    caps.forEach((hw, k) => {
      const y = tb - 1 + k;
      const o = off(y);
      for (let x = Math.round(bx + 0.5 - hw + o); x < Math.round(bx + 0.8 + hw + o); x++) {
        const t = (x + 0.5 - bx - 0.65 - o) / hw;
        c.px(x, y, L.coat, sphere(t * 0.95, 0.65 - k * 0.38, 1), { bias: k === 3 ? -1 : k === 0 ? 1 : 0 });
      }
    });
    // The collar turned up, and the bandana's point at its throat.
    c.part();
    for (const y of [tb - 3, tb - 2]) for (const dx of [0.5, 1.5]) c.px(bx + dx + off(y), y, L.coat, sphere(0.3, 0.5), { bias: y === tb - 3 ? 1 : 0 });
    c.px(bx - 2 + off(tb), tb - 1, BANDANA, sphere(-0.5, -0.2), { bias: 1 });
    c.px(bx - 1 + off(tb), tb - 1, BANDANA, sphere(-0.2, -0.2));
    c.px(bx - 2 + off(tb), tb, BANDANA, sphere(-0.5, 0.4));
  }

  // The belt and the near holster.
  c.part();
  for (const y of [hb - 1, hb]) for (let x = Math.round(bx - 3.8 + off(y)); x < Math.round(bx + 3.6 + off(y)); x++) c.px(x, y, desp ? TAN : LEATHER, cyl((x + 0.5 - bx) / 4, y === hb - 1 ? 0.4 : -0.2), { bias: y === hb ? -1 : 0 });
  c.px(bx - 4 + off(hb), hb - 1, L.band, sphere(-0.6, -0.3), { bias: 1 });
  c.px(bx - 4 + off(hb), hb, L.band, sphere(-0.6, 0.3));
  holster(c, bx + 0.5 + off(hb), hb + 1, 1, !(p.a.drawn || p.a.spin !== null), 'side');

  // The head, at the front of its shoulders.
  const hx = bx - 0.5 + off(hy);
  c.part();
  c.shape(hy + 2, tb - 1, () => [hx - 0.5, hx + 2.5], L.iron, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.shape(hy - 3, hy + 2, (y) => (y === hy - 3 || y === hy + 2 ? [hx - 2, hx + 2] : [hx - 2.5, hx + 2.5]), L.plate, (_x, y, t) => sphere(t * 0.8 - 0.1, (y - hy + 0.5) / 4.5, 1.1));
  rust(c, hx - 4, hy - 4, hx + 4, hy + 3, bx, hb);
  c.part();
  // A round joint where an ear would be.
  c.px(hx + 1, hy, L.band, sphere(0.2, -0.3), { bias: 1 });
  c.px(hx + 1, hy + 1, L.band, sphere(0.2, 0.4), { bias: -1 });
  // The eye-slit wrapping its front.
  const ey = hy - 1;
  if (p.squint) {
    c.px(hx - 2.5, ey, L.eye, FLAT, { bias: 1 });
    c.px(hx - 1.5, ey - 1, L.eye, FLAT, { bias: 1 });
  } else {
    c.px(hx - 0.5, ey, JOINT, FLAT);
    for (let x = hx - 2.5; x <= hx - 1.5; x++) c.px(x, ey, L.eye, FLAT, { glow: p.eye <= 0 ? 0.35 : 1, bias: (x < hx - 2 ? 1 : 0) + (p.eye >= 2 ? 1 : p.eye <= 0 ? -2 : 0) });
    if (p.eye >= 2) for (const dx of [-4, -5, -6]) c.spark(hx + dx, ey, L.glow, dx === -4 ? 0.6 : 0.25);
  }
  if (desp) {
    c.part();
    c.px(hx - 3, hy, L.iron, sphere(-0.5, -0.3), { bias: 1 });
    c.px(hx - 2, hy, L.iron, sphere(-0.2, -0.3));
    c.px(hx - 3.5, hy + 1, L.iron, sphere(-0.5, 0.4));
    c.px(hx - 3, hy + 1.6, TAN, FLAT, { bias: 1 });
    c.px(hx - 4, hy + 1.6, TAN, FLAT);
    c.px(hx - 5, hy + 1.6, EMBER, FLAT, { bias: 1 });
    c.spark(hx - 5.5, hy + 1.5, [255, 140, 50], 0.6);
  } else c.shade(hx - 2.5, hy + 1, -2);
  hatSide(c, p, hx, hy);

  if (desp && !nearUp) drawArm(near, nearS, true, 'lower');
  else drawArm(near, nearS, true);

  if (p.puff > 0) puff(c, hx + 3, hy - 2 - p.hat * 0.5, p.puff);
  if (p.vent > 0) boilOff(c, p.vent, tb, hb, bx);
}

/** The exhaust pipe at its back, side on (the far one hidden behind it). */
function pipe(c: PixelCanvas, x: number, tb: number): void {
  c.part();
  c.shape(tb - 4, tb + 2, () => [x - 0.5, x + 1.5], L.band, (_x, _y, t) => cyl(t, 0.3));
  c.px(x - 0.5, tb - 4, JOINT, FLAT);
  c.px(x + 0.5, tb - 4, JOINT, FLAT);
  c.shade(x - 0.5, tb - 1, -1);
  c.shade(x + 0.5, tb - 1, -1);
}

/** The hat side on: the brim reaching out over its face, the crown on it. */
function hatSide(c: PixelCanvas, p: GunslPose, hx: number, hy: number): void {
  const by = hy - 4 - p.hat * (p.hat < 0 ? 0.5 : 1);
  const H = L.hat;
  const brimNormal = (_x: number, _y: number, dx: number, dy: number): Vec3 => (dy < 0.25 ? { x: dx * 0.3, y: 0.8, z: 0.5 } : { x: 0, y: -0.4, z: 0.9 });
  c.part();
  if (L.desperado) {
    c.ellipse(hx + 0.5, by + 0.2, 9.6, 1.6, H, { normal: brimNormal });
    // Its rim curled up at front and back.
    for (const dx of [-9.5, -8.5, 8.5, 9.5]) c.px(hx + 0.5 + dx, by - 1 - (Math.abs(dx) > 9 ? 1 : 0), H, sphere(Math.sign(dx) * 0.5, -0.6), { bias: 1 });
    c.part();
    c.shape(by - 7, by, (y) => {
      const k = (y - (by - 7)) / 7;
      const w = y === by - 7 ? 0.8 : 1.4 + k * 1.9;
      return [hx + 0.5 - w, hx + 0.5 + w];
    }, H, (_x, y, t) => cyl(t, 0.5 - (y - by + 7) * 0.06));
    for (let y = by - 6; y <= by; y++) for (let x = Math.floor(hx - 3); x < hx + 4; x++) if ((x + y * 2) % 4 === 0) c.shade(x, y, -1);
    c.part();
    for (const y of [by - 2, by - 1]) for (let x = Math.round(hx + 0.5 - 3.1); x < Math.round(hx + 0.5 + 3.1); x++) c.px(x, y, (x + y) % 3 === 0 ? CREAM : RED, cyl((x - hx) / 3.4, 0.3), { bias: y === by - 2 ? 1 : 0 });
    c.part();
    c.px(hx - 8.5, by + 2, RED, sphere(0, 0.3), { bias: 1 });
    return;
  }
  c.ellipse(hx, by + 0.3, 7.6, 1.35, H, { normal: brimNormal });
  // The back of the brim curling up.
  c.px(hx + 7, by - 1, H, sphere(0.6, -0.6), { bias: 1 });
  c.part();
  const rows = [2.6, 3, 3.2, 3.3, 3.3];
  rows.forEach((hw, k) => {
    const y = by - 5 + k;
    for (let x = Math.round(hx + 0.5 - hw); x < Math.round(hx + 0.5 + hw); x++) {
      const dx = x + 0.5 - hx - 0.5;
      if (k === 0 && Math.abs(dx) < 0.8) continue;
      c.px(x, y, H, cyl(dx / hw, 0.45 - k * 0.12), { bias: k === 1 && Math.abs(dx) < 0.8 ? -1 : 0 });
    }
  });
  c.part();
  for (let x = Math.round(hx - 2.8); x < Math.round(hx + 3.8); x++) c.px(x, by - 1, LEATHER, cyl((x - hx) / 3.4, 0.3));
  c.px(hx - 2, by - 1, BRASS, sphere(-0.4, -0.4), { bias: 1 });
}

// ---------------------------------------------------------------------------
// Animations

export type GunslAnim = 'idle' | 'walk' | 'shootA' | 'shootB' | 'fan' | 'roll' | 'draw' | 'aim' | 'vent' | 'cast' | 'rest';

interface AnimDef {
  name: GunslAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => GunslPose[];
  /** Frame indices to play in order, when some are held or repeated. */
  order?: readonly number[];
}

const at = (o: Partial<GunslPose>): GunslPose => ({ ...base(), ...o });

/** Standing easy: the coat stirring, the cylinder ticking round, the hand hovering by its holster. */
const idle = (): GunslPose[] =>
  [0, 0, 1, 1].map((b, i) => at({ crouch: b, cyl: i, tails: i < 2 ? 0 : 0.25, a: arm({ hover: i === 2 ? 1 : i === 3 ? 0.5 : 0 }), b: arm({ hover: b ? 0.5 : 0 }) }));

/** A rolling walk, spurs on every step, the coat swinging behind. */
const walk = (view: View): GunslPose[] =>
  Array.from({ length: 6 }, (_, i) => {
    const q = (i / 6) * Math.PI * 2;
    const s = Math.sin(q);
    const p = at({ cyl: i * 2 });
    p.bob = Math.round(Math.abs(Math.cos(q)));
    p.liftA = Math.max(0, Math.round(s * 2.5));
    p.liftB = Math.max(0, Math.round(-s * 2.5));
    if (view === 'side') {
      p.strideA = Math.round(-Math.cos(q) * 3);
      p.strideB = Math.round(Math.cos(q) * 3);
      p.lean = 1;
      p.tails = 0.6 + 0.4 * Math.cos(q * 2);
    } else p.tails = Math.sin(q) * 0.5;
    p.a = arm({ hover: Math.max(0, Math.cos(q)) * 1.2 });
    p.b = arm({ hover: Math.max(0, -Math.cos(q)) * 1.2 });
    return p;
  });

/** A shot from one gun: it snaps out with the flash, kicks up, and settles, the other held low and ready. */
const shoot = (which: 'A' | 'B') => (view: View): GunslPose[] =>
  [
    { reach: 1, kick: 0, flash: 1, smoke: 0 },
    { reach: 1, kick: 1, flash: 2, smoke: 0.3 },
    { reach: 0.95, kick: 0.35, flash: 0, smoke: 0.75 },
  ].map((k, i) => {
    const p = at({ cyl: i * 2 + (which === 'B' ? 1 : 0), eye: 1, lean: view === 'side' ? (i === 1 ? 0 : 1) : 0, chambers: 1.2 });
    const firing = arm({ drawn: true, reach: k.reach, kick: k.kick, flash: k.flash, smoke: k.smoke });
    const ready = arm({ drawn: true, reach: 0.4 });
    if (which === 'A') {
      p.a = firing;
      p.b = ready;
    } else {
      p.a = ready;
      p.b = firing;
    }
    return p;
  });

/**
 * Fanning the hammer, every sixth shot: the gun spins round its finger,
 * then it is held at the hip as the other palm slaps the hammer three times,
 * three flashes as fast as the eye can follow.
 */
const fan = (view: View): GunslPose[] => {
  const spinA = view === 'side' ? [Math.PI * 0.25, -Math.PI * 0.5] : [Math.PI * 1.25, -Math.PI * 0.5];
  const out: GunslPose[] = [
    at({ cyl: 0, chambers: 1.6, a: arm({ drawn: true, spin: spinA[0] }), b: arm({ hover: 1 }) }),
    at({ cyl: 2, chambers: 1.6, a: arm({ drawn: true, spin: spinA[1] }), b: arm({ hover: 2 }) }),
  ];
  const shots = [
    { flash: 1, kick: 0, fan: 1, smoke: 0 },
    { flash: 2, kick: 0.4, fan: 0.05, smoke: 0.3 },
    { flash: 1, kick: 0, fan: 1, smoke: 0.2 },
    { flash: 2, kick: 0.4, fan: 0.05, smoke: 0.5 },
    { flash: 1, kick: 0, fan: 1, smoke: 0.4 },
    { flash: 0, kick: 0.6, fan: 0.3, smoke: 0.85 },
  ];
  shots.forEach((k, i) =>
    out.push(
      at({
        cyl: 4 + i * 2,
        chambers: 1.6,
        crouch: 1,
        lean: view === 'side' ? 1 : 0,
        eye: 2,
        a: arm({ drawn: true, reach: 1, kick: k.kick, flash: k.flash, smoke: k.smoke }),
        b: arm({ drawn: false, fan: k.fan }),
      }),
    ),
  );
  return out;
};

/** Quickdraw's dodge: it drops low and slides aside, the coat flaring out. */
const roll = (view: View): GunslPose[] =>
  [
    { crouch: 2, lean: 2, flare: 0.4, liftA: 0, liftB: 1, strideA: -1, strideB: 2, shake: 0 },
    { crouch: 4, lean: 4, flare: 1, liftA: 2, liftB: 1, strideA: -3, strideB: 2, shake: 1 },
    { crouch: 4, lean: 3, flare: 1, liftA: 0, liftB: 2, strideA: -2, strideB: 3, shake: 1 },
    { crouch: 2, lean: 1, flare: 0.5, liftA: 0, liftB: 0, strideA: -1, strideB: 1, shake: 0 },
  ].map((k, i) =>
    at({
      crouch: k.crouch,
      lean: view === 'side' ? k.lean : 0,
      shake: view === 'side' ? 0 : k.shake,
      flare: k.flare,
      liftA: k.liftA,
      liftB: k.liftB,
      strideA: view === 'side' ? k.strideA : 0,
      strideB: view === 'side' ? k.strideB : 0,
      tails: view === 'side' ? 1 : i % 2 ? 0.6 : -0.3,
      cyl: i * 3,
      a: arm({ hover: 1.5 }),
      b: arm({ hover: 1.5 }),
    }),
  );

/** Both guns out of the leather and firing at once: Quickdraw's shots, and High Noon's volley. */
const draw = (view: View): GunslPose[] =>
  [
    { a: { reach: 1, flash: 1 }, b: { reach: 1, flash: 0 } },
    { a: { reach: 1, kick: 0.8, flash: 2, smoke: 0.3 }, b: { reach: 1, flash: 1 } },
    { a: { reach: 1, kick: 0.3, smoke: 0.6 }, b: { reach: 1, kick: 0.8, flash: 2, smoke: 0.3 } },
    { a: { reach: 0.7, smoke: 0.9 }, b: { reach: 0.8, kick: 0.3, smoke: 0.7 } },
  ].map((k, i) => at({ eye: 2, cyl: i * 3, chambers: 1.6, lean: view === 'side' ? 1 : 0, crouch: i < 2 ? 1 : 0, a: arm({ drawn: true, ...k.a }), b: arm({ drawn: true, ...k.b }) }));

/** High Noon's dead-eye: both guns levelled, the brim low, the eye blazing, the cylinder turning. */
const aim = (view: View): GunslPose[] =>
  [0, 1].map((i) => at({ eye: 2, hat: -1, cyl: i * 6, chambers: 2, crouch: i, lean: view === 'side' ? 1 : 0, a: arm({ drawn: true, reach: 1, glint: i === 1 }), b: arm({ drawn: true, reach: 1 }) }));

/** Overheated: hunched, the eye gone dim, steam boiling out of its collar, cuffs and coat. */
const vent = (): GunslPose[] => [1, 0.8, 0.6, 0.8].map((k, i) => at({ vent: k, crouch: 1, eye: 0, chambers: 0, cyl: i, tails: i % 2 ? 0.2 : -0.2, a: arm({ hover: -0.5 }), b: arm({ hover: -0.5 }) }));

/**
 * High Noon (also its pose on the select screen): it touches the brim down
 * over its eye, the eye kindles under it, and it draws both guns and stands
 * them up beside its hat, barrels to the sky, a glint running along them.
 */
const cast = (view: View): GunslPose[] =>
  [
    at({ hat: 0, a: arm({ brim: 0.7 }) }),
    at({ hat: -1, eye: 2, a: arm({ brim: 1 }) }),
    at({ hat: -1, eye: 2, crouch: 1, cyl: 2, chambers: 1.5, a: arm({ drawn: true, reach: 0.5 }), b: arm({ drawn: true, reach: 0.5 }) }),
    at({ hat: -1, eye: 2, cyl: 4, chambers: 2, a: arm({ drawn: true, up: 1 }), b: arm({ drawn: true, up: 1 }) }),
    at({ hat: -1, eye: 2, bob: 1, cyl: 6, chambers: 2, a: arm({ drawn: true, up: 1, glint: true }), b: arm({ drawn: true, up: 1 }) }),
    at({ hat: -1, eye: 2, bob: 1, cyl: 8, chambers: 2, a: arm({ drawn: true, up: 1 }), b: arm({ drawn: true, up: 1, glint: true }) }),
  ].map((p) => ({ ...p, lean: view === 'side' ? 0 : p.lean }));

/**
 * The idle moment, facing the viewer only: it draws a gun and twirls it
 * round its finger, twice over, shows it to the sky, drops it back in the
 * leather, then tips its hat, a puff of steam escaping from under it, its eye
 * squinting with satisfaction.
 */
const rest = (view: View): GunslPose[] => {
  if (view !== 'down') return [];
  const twirl = (spin: number) => arm({ drawn: true, spin });
  return [
    at({}),
    at({ b: arm({ hover: 1.5 }) }),
    at({ b: arm({ drawn: true, reach: 0.25, hover: 1 }), cyl: 1 }),
    at({ b: twirl(0), cyl: 2 }),
    at({ b: twirl(-Math.PI / 2), cyl: 3 }),
    at({ b: twirl(Math.PI), cyl: 4 }),
    at({ b: twirl(Math.PI / 2), cyl: 5 }),
    at({ b: arm({ drawn: true, up: 1, glint: true }), bob: 1, cyl: 6 }),
    at({ b: arm({ drawn: true, reach: 0.1, hover: 2 }), cyl: 7 }),
    at({ b: arm({ hover: 0.5 }), a: arm({ brim: 0.5 }), cyl: 8 }),
    at({ a: arm({ brim: 1 }), hat: 1, puff: 1 }),
    at({ a: arm({ brim: 1 }), hat: 2, puff: 2, squint: true }),
    at({ a: arm({ brim: 1 }), hat: 2, puff: 3, squint: true, bob: 1 }),
    at({ a: arm({ brim: 1 }), hat: 1, puff: 4, squint: true }),
    at({ a: arm({ brim: 0.4 }), hat: 0, puff: 5 }),
  ];
};

export const GUNSL_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 4, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'shootA', fps: 18, loop: false, poses: shoot('A') },
  { name: 'shootB', fps: 18, loop: false, poses: shoot('B') },
  { name: 'fan', fps: 24, loop: false, poses: fan },
  { name: 'roll', fps: 18, loop: false, poses: roll },
  { name: 'draw', fps: 16, loop: false, poses: draw },
  { name: 'aim', fps: 4, loop: true, poses: aim },
  { name: 'vent', fps: 8, loop: true, poses: vent },
  { name: 'cast', fps: 10, loop: false, poses: cast },
  { name: 'rest', fps: 10, loop: false, poses: rest, order: [0, 0, 1, 1, 2, 3, 4, 5, 6, 3, 4, 5, 6, 3, 4, 7, 7, 7, 8, 9, 9, 10, 11, 12, 12, 13, 14, 0] },
];

/** The frames of the fan where its three shots go off. */
export const GUNSL_FAN_SHOTS = [2, 4, 6];

export interface GunslFrame {
  key: string;
  anim: GunslAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: GunslPose): PixelCanvas {
  const c = new PixelCanvas(GUNSL_W, GUNSL_H);
  if (dir === 'down') drawFront(c, p, false);
  else if (dir === 'up') drawFront(c, p, true);
  else drawSide(c, p);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildGunslFrames(look: GunslLook = GUNSL_LOOK): GunslFrame[] {
  L = look;
  const out: GunslFrame[] = [];
  for (const a of GUNSL_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, pose) }));
    }
  }
  L = GUNSL_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Button icons (drawn additively on the buttons: dark is empty)

type Put = (x: number, y: number, c: RGB) => void;

/** A 16x16 icon where later strokes overwrite earlier ones, so dark detail can cut into a bright fill. */
function icon(draw: (put: Put) => void): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  draw((x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    px.set([c[0], c[1], c[2], 255], (y * S + x) * 4);
  });
  return px;
}

type Tones = [RGB, RGB, RGB, RGB];
const STEEL_TONES: Tones = [hex('#ffffff'), hex('#c4d0dc'), hex('#7a8898'), hex('#36404c')];
const COPPER_TONES: Tones = [hex('#fff0d8'), hex('#f0b07a'), hex('#b0602e'), hex('#5a240c')];
const COLD_FIRE: Tones = [hex('#ffffff'), hex('#c4e6ff'), hex('#6aaeff'), hex('#2a64e8')];
const HOT_FIRE: Tones = [hex('#fff6d8'), hex('#ffd070'), hex('#ff8a2a'), hex('#c83a0a')];
const IVORY_RGB: RGB = hex('#e6dcc0');
const IVORY_DARK: RGB = hex('#9a8e70');

/** A six-shooter side on, pointing right, its barrel from (x0, y), cylinder and grip behind. */
function gunIcon(put: Put, x0: number, y: number, m: Tones, frame: Tones): void {
  // Grip, raked back.
  for (const [x, yy, c] of [[x0 - 4, y + 2, IVORY_RGB], [x0 - 5, y + 3, IVORY_RGB], [x0 - 5, y + 4, IVORY_DARK], [x0 - 6, y + 4, IVORY_DARK], [x0 - 6, y + 5, m[3]]] as const) put(x, yy, c);
  put(x0 - 4, y + 3, IVORY_DARK);
  // Hammer.
  put(x0 - 4, y - 1, m[2]);
  // Frame and cylinder.
  for (let x = x0 - 3; x <= x0 - 1; x++) {
    put(x, y, frame[1]);
    put(x, y + 1, frame[2]);
  }
  put(x0 - 2, y + 1, frame[3]);
  put(x0 - 3, y + 2, m[3]);
  // Trigger guard.
  put(x0 - 2, y + 3, m[3]);
  put(x0 - 1, y + 2, m[3]);
  // Barrel and ejector rod.
  for (let x = x0; x <= x0 + 5; x++) put(x, y, x === x0 + 5 ? m[0] : m[1]);
  for (let x = x0; x <= x0 + 3; x++) put(x, y + 1, m[2]);
  put(x0 + 5, y - 1, m[1]);
}

/** Six-shooters: a revolver bucking up as it fires, the flash at its muzzle, a round streaking off. */
export function sixShooterIcon(desperado = false): Uint8ClampedArray {
  const m = STEEL_TONES;
  const frame = desperado ? COPPER_TONES : STEEL_TONES;
  const f = desperado ? HOT_FIRE : COLD_FIRE;
  return icon((put) => {
    gunIcon(put, 6, 8, m, frame);
    // The flash.
    for (const [x, y, k] of [[12, 8, 0], [13, 8, 0], [12, 7, 1], [12, 9, 1], [13, 7, 2], [13, 9, 2], [14, 8, 1], [15, 8, 2], [13, 6, 3], [13, 10, 3]] as const) put(x, y, f[k]);
    // The round, streaking off, and smoke curling over the barrel.
    put(15, 5, f[0]);
    put(14, 5, f[2]);
    for (const [x, y] of [[9, 6], [10, 5], [11, 5], [8, 6]]) put(x, y, hex('#7c8492'));
    // Its chambers glowing in a ring, top left.
    for (const [x, y] of [[2, 1], [3, 1], [1, 2], [4, 2], [2, 3], [3, 3]]) put(x, y, f[2]);
    put(2, 2, f[0]);
    put(3, 2, f[3]);
  });
}

/** Quickdraw: a slide aside (speed lines), the gun already out, two tracers cracking off to their marks. */
export function quickdrawIcon(desperado = false): Uint8ClampedArray {
  const m = STEEL_TONES;
  const frame = desperado ? COPPER_TONES : STEEL_TONES;
  const f = desperado ? HOT_FIRE : COLD_FIRE;
  return icon((put) => {
    // Speed lines from the slide.
    for (const [y, x0, x1] of [[11, 0, 3], [13, 1, 4], [15, 0, 2]] as const) for (let x = x0; x <= x1; x++) put(x, y, x === x0 ? hex('#3a4450') : hex('#8a96a6'));
    gunIcon(put, 7, 11, m, frame);
    // Two tracers out from the muzzle, up and to the right, to two little marks.
    for (let i = 0; i <= 5; i++) put(13 - Math.round(i * 0.2), 10 - i, i < 2 ? f[0] : f[1]);
    for (let i = 0; i <= 3; i++) put(13 + Math.round(i * 0.5), 10 - i, i < 2 ? f[0] : f[2]);
    for (const [x, y] of [[12, 3], [11, 4], [13, 4], [12, 5]]) put(x, y, f[2]);
    put(12, 4, f[0]);
    for (const [x, y] of [[15, 6], [14, 7]]) put(x, y, f[2]);
    put(15, 7, f[0]);
    put(13, 11, f[0]);
    put(14, 11, f[1]);
  });
}
