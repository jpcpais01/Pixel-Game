// The Samurai, drawn procedurally from a small rig like the Jedi's.
//
// A swordsman in a kimono top (the gi) tied with an obi over wide pleated
// hakama, a curved katana with a guard (tsuba) and a wrapped grip. Looks
// swap the cloth and add parts: the Bladewind wears a lacquered shoulder
// guard and a long high ponytail; the Oni a red demon face guard; the Ronin a
// straw kasa hat over a worn haori jacket with a crest on its back; the
// Kitsune fox ears, a fox mask and a great tail tipped in foxfire; the Shogun
// laced black armour and a helmet crowned with a golden crescent.
//
// The body keeps to the 24x32 box; frames are larger so the blade can reach
// past it. Drawing functions work in body-box coordinates.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { EYE, SKIN } from './palette';
import { DIRS, type Dir } from './wizard';

export const SAMURAI_W = 48;
export const SAMURAI_H = 50;
export const BODY_X = 12;
export const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const SAMURAI_ORIGIN_X = BODY_X + 12;
export const SAMURAI_ORIGIN_Y = BODY_Y + 31;
/** The chest's height above the origin, where cuts are centred. */
export const CHEST_Y = 11;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const mat = (outline: string, ...c: string[]): Material => ({ ramp: ramp(...c), outline: hex(outline) });

export interface SamuraiLook {
  /** Texture key; animations are `${key}_${anim}_${dir}`. */
  key: string;
  gi: Material;
  /** The white under-kimono showing at the collar. */
  collar: Material;
  hakama: Material;
  obi: Material;
  skin: Material;
  hair: Material;
  /** Tabi and sandals. */
  foot: Material;
  /** A short jacket over the gi, open in front, with a crest on its back. */
  haori: Material | null;
  /** The crest, and the rims of lacquer. */
  trim: Material;
  /** A wide straw hat over the eyes. */
  hat: Material | null;
  /** A demon face guard over the mouth and nose. */
  mask: Material | null;
  /** One lacquered guard on the free shoulder. */
  pad: Material | null;
  /** A long ponytail from a high knot. */
  ponytail: boolean;
  eye: Material;
  steel: Material;
  /** The tempered edge (the hamon), brighter than the spine. */
  edge: Material;
  tsuba: Material;
  grip: Material;
  /** A faint light along the edge in the emissive layer. */
  bladeGlow: RGB;
  /** A fox spirit's ears, a white fox mask over the face and a great brush of a tail tipped in foxfire. */
  fox?: { fur: Material; fire: Material; mask: Material; paint: Material };
  /**
   * A warlord's armour: a lacquered cuirass, a plated skirt and great shoulder
   * guards, all laced in bands; a helmet with a flaring neck guard and a
   * crescent moon crest over the brow.
   */
  armor?: { plate: Material; lace: Material; crest: Material };
}

const TABI = mat('#0d0b12', '#1d1a24', '#34303e', '#4e4858', '#6c6476');
const STEEL = { ...mat('#0e0f18', '#3a4052', '#6c768e', '#a6b0c6', '#dfe6f4'), shine: true };
const HAMON = { ...mat('#0e0f18', '#8e9ab4', '#c8d2e6', '#f0f6ff', '#ffffff'), shine: true };
const GOLD_TSUBA = { ...mat('#1e1008', '#5b3418', '#9a6424', '#d6a044', '#f6d88a'), shine: true };
const IRON_TSUBA = { ...mat('#08070b', '#1c1a22', '#34303c', '#4e4858'), shine: true };
const WRAP = mat('#07060a', '#141219', '#262230', '#3a3446');
const WHITE_COLLAR = mat('#2a2630', '#8e8a98', '#c8c4d0', '#eeeaf4');
const DARK_HAIR = mat('#07050a', '#141019', '#241c2a', '#382c3e', '#4e3e54');

/** The Bladewind: a storm-blue gi, charcoal hakama, a steel-blue shoulder guard and a long ponytail. */
export const BLADEWIND_LOOK: SamuraiLook = {
  key: 'samurai',
  gi: mat('#0c1220', '#1c2a42', '#2e4466', '#46628c', '#6a8ab4'),
  collar: WHITE_COLLAR,
  hakama: mat('#08090f', '#161822', '#262a38', '#3a3f52', '#50566c'),
  obi: mat('#1a1410', '#6a5a44', '#a08c6a', '#cbb892', '#e8dab8'),
  skin: SKIN,
  hair: DARK_HAIR,
  foot: TABI,
  haori: null,
  trim: GOLD_TSUBA,
  hat: null,
  mask: null,
  pad: { ...mat('#070a12', '#1a2438', '#2c3e5c', '#48648e', '#78a0c8'), shine: true },
  ponytail: true,
  eye: EYE,
  steel: STEEL,
  edge: HAMON,
  tsuba: GOLD_TSUBA,
  grip: WRAP,
  bladeGlow: hex('#8ad8ff'),
};

/** The Oni skin: black and crimson, a red demon face guard, burning eyes and a blade edged in red light. */
export const ONI_LOOK: SamuraiLook = {
  ...BLADEWIND_LOOK,
  key: 'samurai_oni',
  gi: mat('#050305', '#120a0e', '#22121a', '#361c26', '#4c2834'),
  collar: mat('#2a0a10', '#6a1420', '#a02230', '#d03a44'),
  hakama: mat('#040304', '#0e0b0e', '#1a151a', '#282028', '#3a2e38'),
  obi: mat('#1a0406', '#5a0c14', '#9a1622', '#d0283a', '#f25a5a'),
  hair: mat('#020203', '#0a0a0e', '#16161c', '#24242c', '#34343e'),
  trim: GOLD_TSUBA,
  mask: { ...mat('#1a0206', '#5a0a12', '#9a1220', '#d0283a', '#ff5a5a'), shine: true },
  pad: { ...mat('#1a0206', '#4a0a12', '#80141e', '#b4222e', '#e04a4a'), shine: true },
  eye: { ramp: ramp('#ff5a3a', '#ffd08a'), outline: hex('#030205'), emissive: 1, noAO: true },
  steel: { ...mat('#050408', '#1a1820', '#34303c', '#565060', '#7a7486'), shine: true },
  edge: { ...mat('#1a0206', '#b4222e', '#ff4a4a', '#ff9a8a', '#ffe0da'), shine: true },
  tsuba: IRON_TSUBA,
  bladeGlow: hex('#ff3a3a'),
};

/** The Ronin: a worn grey gi under a faded indigo haori, slate hakama and a straw kasa. */
export const RONIN_LOOK: SamuraiLook = {
  key: 'ronin',
  gi: mat('#16130f', '#2e2822', '#4a4238', '#6a6054', '#8e8474'),
  collar: WHITE_COLLAR,
  hakama: mat('#0b0c10', '#1a1d25', '#2a2f3b', '#3e4454', '#545c70'),
  obi: mat('#150806', '#3a1610', '#5e2618', '#823a24', '#a8563a'),
  skin: SKIN,
  hair: DARK_HAIR,
  foot: mat('#120c08', '#2e2016', '#4a3624', '#6a5034', '#8a6c48'),
  haori: mat('#070812', '#141a2e', '#222c4a', '#34426a', '#4c5c88'),
  trim: mat('#2a2630', '#8e8a98', '#c8c4d0', '#eeeaf4'),
  hat: mat('#20160a', '#4a3518', '#7a5a2a', '#a8843f', '#d0ae62', '#ecd394'),
  mask: null,
  pad: null,
  ponytail: false,
  eye: EYE,
  steel: STEEL,
  edge: HAMON,
  tsuba: IRON_TSUBA,
  grip: WRAP,
  bladeGlow: hex('#ffd08a'),
};

/** The Sakura skin: a white gi under a blossom-pink haori, plum hakama, a pale kasa and a pink-tempered edge. */
export const SAKURA_LOOK: SamuraiLook = {
  ...RONIN_LOOK,
  key: 'ronin_sakura',
  gi: mat('#3a3038', '#8a7e88', '#c2b8c0', '#e6dee4', '#fbf6fa'),
  collar: mat('#4a1a2a', '#a04a66', '#dc7a98', '#f8b0c4'),
  hakama: mat('#0e0610', '#22102a', '#361a40', '#4e2a5a', '#6a3c76'),
  obi: { ...mat('#1e1008', '#5b3418', '#9a6424', '#d6a044', '#f6d88a'), shine: true },
  haori: mat('#2a0c1a', '#6a2440', '#a84868', '#dc7a98', '#f8b0c4'),
  trim: mat('#3a1422', '#c84a70', '#f07a9a', '#ffd6e2'),
  hat: mat('#2a1e10', '#6a5230', '#a08450', '#cfb47a', '#eedcaa', '#fff4d6'),
  edge: { ...mat('#2a0c1a', '#c86a8a', '#f4a0bc', '#ffd6e2', '#fff4f8'), shine: true },
  tsuba: GOLD_TSUBA,
  bladeGlow: hex('#ff9ac0'),
};

/**
 * The Kitsune skin: a fox spirit in a shrine's white and vermilion, silver
 * hair between fox ears, a white fox mask painted in red, and a great white
 * tail whose tip burns with ghostly green foxfire, as does the blade's edge.
 */
export const KITSUNE_LOOK: SamuraiLook = {
  ...BLADEWIND_LOOK,
  key: 'samurai_kitsune',
  gi: mat('#4a4050', '#9a90a0', '#d0c8d4', '#eee8f0', '#fdfaff'),
  collar: mat('#3a0a0a', '#8a1a14', '#c8321e', '#f0603a'),
  hakama: mat('#2a0604', '#5e120a', '#921e12', '#c42e1c', '#ea4a2a'),
  obi: { ...mat('#1e1008', '#5b3418', '#9a6424', '#d6a044', '#f6d88a'), shine: true },
  hair: mat('#2a2436', '#5a5070', '#8e84a8', '#c0b8d6', '#ece6fa'),
  pad: null,
  ponytail: false,
  eye: { ramp: ramp('#40f0c0', '#d0fff0'), outline: hex('#030205'), emissive: 1, noAO: true },
  edge: { ...mat('#062a24', '#1a9a80', '#50e8c0', '#b0ffe8', '#f0fffa'), shine: true },
  grip: mat('#1a0406', '#4a0a0c', '#86161a', '#b82a24'),
  bladeGlow: hex('#40f0c0'),
  fox: {
    fur: mat('#3a2e3e', '#8a7e90', '#c8bece', '#ece6f0', '#ffffff'),
    fire: { ramp: ramp('#0e6a5a', '#2ac8a0', '#7affd8', '#d0fff4'), outline: hex('#063a30'), emissive: 0.85, noAO: true },
    mask: { ...mat('#4a4658', '#a8a4b8', '#dcdae6', '#f6f4fa', '#ffffff'), shine: true },
    paint: { ramp: ramp('#b01e18', '#e8402a'), outline: hex('#4a0a08'), noOutline: true, noAO: true },
  },
};

/**
 * The Shogun skin: a warlord in black lacquered armour laced in indigo, great
 * shoulder guards and a plated skirt over the hakama, a black face guard, and
 * a helmet crowned with a golden crescent moon; his blade is tempered in
 * moonlight.
 */
export const SHOGUN_LOOK: SamuraiLook = {
  ...RONIN_LOOK,
  key: 'ronin_shogun',
  gi: mat('#0a0a18', '#161a34', '#242a50', '#343c6c', '#48528a'),
  hakama: mat('#08070c', '#15121c', '#221d2c', '#322a40', '#443a56'),
  obi: mat('#0e0a2a', '#262070', '#3c34a8', '#5a52d0'),
  foot: TABI,
  haori: null,
  trim: { ...mat('#1e1008', '#5b3418', '#9a6424', '#d6a044', '#f6d88a'), shine: true },
  hat: null,
  mask: { ...mat('#030305', '#0c0c12', '#1a1a24', '#2a2a38', '#3e3e52'), shine: true },
  pad: { ...mat('#050508', '#12121c', '#20202e', '#323246', '#4a4a64'), shine: true },
  edge: { ...mat('#1a1640', '#8a8ad0', '#c8c8f4', '#f4f2ff', '#ffffff'), shine: true },
  tsuba: GOLD_TSUBA,
  bladeGlow: hex('#b8b0ff'),
  armor: {
    plate: { ...mat('#050508', '#12121c', '#20202e', '#323246', '#4a4a64'), shine: true },
    lace: mat('#0e0a2a', '#241e66', '#34309a', '#4c46c0'),
    crest: { ...mat('#1e1008', '#7a4a18', '#c08a2a', '#ecc050', '#fff0a0'), shine: true, emissive: 0.25 },
  },
};

export const SAMURAI_LOOKS = [BLADEWIND_LOOK, ONI_LOOK, KITSUNE_LOOK, RONIN_LOOK, SAKURA_LOOK, SHOGUN_LOOK];

/** The look being drawn; set by buildSamuraiFrames. */
let S: SamuraiLook = BLADEWIND_LOOK;

export interface Blade {
  /** Hand (grip) position in body pixels. */
  hx: number;
  hy: number;
  /** Degrees; 0 = blade straight up, positive turns clockwise. */
  angle: number;
  /** Blade length past the guard. */
  len: number;
}

export interface Pose {
  /** Whole body raised (walk passing frames). */
  lift: number;
  /** Upper body lowered (breathing, crouching). */
  breath: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Hem and ponytail sway in pixels. */
  sway: number;
  /** Free-arm swing in pixels. */
  arm: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  blade: Blade;
  /** Blade, its arm and hand drawn behind the body. */
  bladeBehind?: boolean;
  /** Free hand placed here instead of hanging at the side. */
  free?: { x: number; y: number };
  blink?: boolean;
}

export interface SamuraiMeta {
  /** Blade tip and grip in frame pixels. */
  tipX: number;
  tipY: number;
  handX: number;
  handY: number;
}

const RAD = Math.PI / 180;
/** The guard's distance along the blade from the hand. */
const GUARD = 1.6;
/** How much the blade curves back towards its spine. */
const CURVE = 0.012;
const FLAT_DOWN: Vec3 = { x: 0, y: -0.3, z: 0.95 };

// ---------------------------------------------------------------------------
// Shared parts

function each(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void): void {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) fn(x, y);
}

/** A katana: a wrapped grip, a round guard and a slim, faintly curved blade with a bright edge. */
function drawKatana(c: PixelCanvas, s: Blade): { x: number; y: number } {
  const a = s.angle * RAD;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const px = -dy;
  const py = dx;
  const end = GUARD + s.len;
  const reach = end + 4;
  const box = (fn: (x: number, y: number, along: number, side: number) => void) =>
    each(s.hx - reach, s.hy - reach, s.hx + reach, s.hy + reach, (x, y) => {
      const rx = x + 0.5 - s.hx;
      const ry = y + 0.5 - s.hy;
      fn(x, y, rx * dx + ry * dy, rx * px + ry * py);
    });
  const facing = (sx: number, sy: number, z: number): Vec3 => {
    const l = Math.hypot(sx, sy, z) || 1;
    return { x: sx / l, y: -sy / l, z: z / l };
  };

  // The blade: the spine darker, the tempered edge bright, curving gently back to a point.
  c.part();
  box((x, y, along, side) => {
    if (along < GUARD + 0.2 || along > end) return;
    const out = along - GUARD;
    const sd = side - CURVE * out * out;
    const rest = end - along;
    const hw = rest < 1.4 ? 0.55 : 0.9;
    if (Math.abs(sd) >= hw) return;
    const n = facing(-0.25, 0.35, 0.9);
    if (sd < 0) {
      c.px(x, y, S.edge, n);
      c.spark(x, y, S.bladeGlow, 0.14);
    } else c.px(x, y, S.steel, n, { bias: rest < 3 ? 1 : 0 });
  });
  // The guard, a disc across the blade.
  c.part();
  box((x, y, along, side) => {
    if (along < GUARD - 0.7 || along > GUARD + 0.2 || Math.abs(side) > 1.55) return;
    c.px(x, y, S.tsuba, facing(px * side - 0.3, py * side + 0.3, 0.8));
  });
  // The grip, wrapped in diamonds, with a small metal cap.
  c.part();
  box((x, y, along, side) => {
    if (along < -3.4 || along > GUARD - 0.7 || Math.abs(side) > 0.62) return;
    const n = facing(px * side - 0.3, py * side + 0.3, 0.8);
    if (along < -2.7) c.px(x, y, S.tsuba, n);
    else c.px(x, y, S.grip, n, { bias: Math.floor(along * 1.4) % 2 === 0 ? 1 : 0 });
  });
  const out = s.len;
  const tipSide = CURVE * out * out;
  return { x: s.hx + dx * end + px * tipSide, y: s.hy + dy * end + py * tipSide };
}

/** A wide kimono sleeve from the shoulder, ending short of the hand. */
function sleeve(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number, bias = 0): void {
  c.part();
  const vx = hx - sx;
  const vy = hy - sy;
  const l = Math.hypot(vx, vy) || 1;
  c.capsule(sx, sy, hx - (vx / l) * 1.1, hy - (vy / l) * 1.1, 1.45, 1.85, S.haori ?? S.gi, { bias });
}

function hand(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.ellipse(x, y, 1.1, 1.1, S.skin);
}

function foot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x, y, 2.1, 1.15, S.foot, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.6, 1.2, S.foot, { flatten: 0.8, bias });
}

function shoulder(c: PixelCanvas, x: number, y: number, rx = 2.2, ry = 1.6): void {
  c.part();
  c.ellipse(x, y, rx, ry, S.haori ?? S.gi, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 0.95) });
}

/** The lacquered shoulder guard: a rounded plate in bands, with a bright rim. */
function pad(c: PixelCanvas, x: number, y: number, rx = 2.7, ry = 2.2): void {
  if (!S.pad) return;
  c.part();
  c.ellipse(x, y, rx, ry, S.pad, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.35, 0.9) });
  for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++) c.shade(Math.round(x + i - 0.5), Math.round(y + 0.2), -1);
  c.part();
  for (let i = -1; i <= 1; i++) c.px(Math.round(x + i * (rx - 0.6) - 0.5), Math.round(y + ry - 0.6), S.trim, { x: i * 0.3, y: 0.2, z: 0.9 });
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) c.px(x, y, S.fox ? S.fox.mask : S.skin, FLAT_DOWN, { bias: -1 });
    else c.px(x, y, S.eye);
  }
}

/** A wide straw kasa from the front or back: a shallow cone over the head, woven in rings. */
function kasa(c: PixelCanvas, hx: number, U: number, rim = 6.9): void {
  if (!S.hat) return;
  const top = 5 + U;
  const bottom = 10 + U;
  c.part();
  c.shape(top, bottom, (y) => {
    const u = (y + 0.5 - top) / (bottom + 1 - top);
    const hw = 0.9 + (rim - 0.9) * Math.pow(u, 0.85);
    return [hx - hw, hx + hw];
  }, S.hat, (_x, _y, t, u) => sphere(t * 0.95, u * 0.8 - 0.65, 0.75));
  // Woven rings, and the rim's thin lip.
  for (let x = Math.floor(hx - rim); x <= Math.ceil(hx + rim); x++) {
    if ((x & 1) === 0) c.shade(x, top + 3, -1);
    c.shade(x, bottom, (x & 1) === 0 ? -1 : 0);
  }
  c.px(Math.floor(hx), top, S.hat, sphere(-0.2, -0.8), { bias: 1 });
}

/** The demon face guard over nose and mouth, with a snarl of teeth. */
function menpo(c: PixelCanvas, x0: number, x1: number, y: number, teeth: number[]): void {
  if (!S.mask) return;
  c.part();
  c.shape(y, y + 2, (row) => (row === y + 2 ? [x0 + 0.8, x1 - 0.8] : [x0, x1]), S.mask, (_x, _y, t, u) => sphere(t * 0.8, u - 0.4, 1));
  c.part();
  for (const tx of teeth) c.px(tx, y + 1, S.collar, { x: 0, y: 0.2, z: 0.95 }, { bias: 2 });
}

/**
 * The fox's tail: a great brush from the small of the back along a curve
 * (start, bend, end), fattest two-thirds along, its tip burning with foxfire.
 */
function foxTail(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, sway: number, bias = 0): void {
  if (!S.fox) return;
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * x2,
    y: (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * y1 + t * t * y2,
  });
  const N = 12;
  c.part();
  for (let i = 0; i < N; i++) {
    const t0 = i / N;
    const t1 = (i + 1) / N;
    const a = at(t0);
    const b = at(t1);
    const r = (t: number) => 0.8 + 1.9 * Math.sin(Math.PI * Math.pow(t, 0.7));
    c.capsule(a.x, a.y, b.x, b.y, r(t0), r(t1), t1 > 0.9 ? S.fox.fire : S.fox.fur, { bias });
  }
  // Fur tufts along the outer edge, and the flame licking off the tip.
  for (const t of [0.35, 0.55, 0.7]) {
    const p = at(t);
    c.shade(Math.round(p.x), Math.round(p.y), 1);
  }
  const tip = at(1);
  const lick = [0, 1, 0, -1][((sway % 4) + 4) % 4];
  c.spark(tip.x + lick * 0.5, tip.y - 2, S.fox.fire.ramp[2], 0.7);
  c.spark(tip.x, tip.y - 3, S.fox.fire.ramp[3], 0.45);
}

/** A pointed fox ear rising from the head, its tip at (x, top); the inside darker from the front. */
function foxEar(c: PixelCanvas, x: number, top: number, inner: boolean, bias = 0): void {
  if (!S.fox) return;
  c.part();
  c.shape(top, top + 3, (y) => {
    const hw = 0.5 + (y - top) * 0.5;
    return [x - hw, x + hw];
  }, S.fox.fur, (_x, _y, t, u) => sphere(t * 0.8, u - 0.6, 1), { bias });
  if (inner) {
    c.shade(x, top + 2, -2);
    c.shade(x, top + 3, -2);
  }
}

/** The warlord's crescent crest: a thin golden moon over the brow, horns up. */
function crescent(c: PixelCanvas, cx: number, y: number, half: number): void {
  if (!S.armor) return;
  c.part();
  const n = Math.ceil(half * 4);
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 - 1;
    const x = cx + t * half;
    const yy = y - Math.pow(Math.abs(t), 1.6) * 4.2;
    const nrm = sphere(t * 0.6, -0.5, 1);
    c.px(x, yy, S.armor.crest, nrm);
    if (Math.abs(t) < 0.55) c.px(x, yy + 1, S.armor.crest, sphere(t * 0.6, 0.3, 1), { bias: -1 });
  }
}

/** Lacquered plates in `rows`, laced across every other row with dots of cord. */
function laced(c: PixelCanvas, y0: number, y1: number, edges: (y: number) => [number, number], normal: (t: number, u: number) => Vec3, start = 1): void {
  if (!S.armor) return;
  const A = S.armor;
  c.part();
  c.shape(y0, y1, edges, A.plate, (_x, _y, t, u) => normal(t, u));
  c.part();
  for (let y = y0 + start; y <= y1; y += 3) {
    const [l, r] = edges(y);
    for (let x = Math.round(l); x < Math.round(r); x++) if (((x + y) & 1) === 0 && c.filled(x, y)) c.px(x, y, A.lace, cyl(((x + 0.5 - l) / (r - l)) * 2 - 1, 0.1));
  }
}

const NOSE = mat('#050408', '#141019', '#241c2a');

/** The fox mask from the front: a white face narrowing to a snout, red paint at the eyes, a black nose. */
function foxMaskFront(c: PixelCanvas, cx: number, U: number): void {
  if (!S.fox) return;
  const F = S.fox;
  const rows = [[-3.2, 3.2], [-3.2, 3.2], [-2.2, 2.2], [-1.2, 1.2]];
  c.part();
  c.shape(11 + U, 14 + U, (y) => [cx + rows[y - 11 - U][0], cx + rows[y - 11 - U][1]], F.mask, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.3, 1));
  c.part();
  c.px(cx - 3, 11 + U, F.paint);
  c.px(cx + 2, 11 + U, F.paint);
  c.px(cx - 1, 11 + U, F.paint, FLAT_DOWN, { bias: -1 });
  c.px(cx, 11 + U, F.paint, FLAT_DOWN, { bias: -1 });
  c.px(cx - 1, 14 + U, NOSE);
  c.px(cx, 14 + U, NOSE);
}

/** The fox mask in profile (facing left): the snout jutting forward past the face. */
function foxMaskSide(c: PixelCanvas, hx: number, U: number): void {
  if (!S.fox) return;
  const F = S.fox;
  const rows = [[-4.4, -0.4], [-4.8, -0.4], [-5.9, -1.0], [-4.6, -1.8]];
  c.part();
  c.shape(11 + U, 14 + U, (y) => [hx + rows[y - 11 - U][0], hx + rows[y - 11 - U][1]], F.mask, (_x, _y, t, u) => sphere(t * 0.8 - 0.3, u * 0.9 - 0.3, 1));
  c.part();
  c.px(hx - 2, 11 + U, F.paint);
  c.px(hx - 4, 11 + U, F.paint, FLAT_DOWN, { bias: -1 });
  c.px(hx - 6, 13 + U, NOSE);
}

/** The warlord's helmet: a ridged black bowl, the neck guard flaring out in laced plates, the golden crescent. */
function kabuto(c: PixelCanvas, view: 'front' | 'back' | 'side', cx: number, U: number): void {
  if (!S.armor) return;
  const A = S.armor;
  if (view === 'back') crescent(c, cx, 8.8 + U, 5.6);
  c.part();
  if (view === 'side') {
    const w = [[-2.2, 2.4], [-3.4, 3.2], [-3.9, 3.5], [-4.1, 3.6], [-4.4, 3.6]];
    c.shape(6 + U, 10 + U, (y) => [cx + w[y - 6 - U][0], cx + w[y - 6 - U][1]], A.plate, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, u * 1.2 - 0.9, 1));
    c.px(cx - 5, 10 + U, A.plate, sphere(-0.6, 0.2), { bias: 1 });
    for (let y = 7; y <= 9; y++) c.shade(cx, y + U, 1);
    laced(c, 10 + U, 14 + U, (y) => [cx - 0.2 + (y - 10 - U) * 0.2, cx + 3.6 + (y - 10 - U) * 0.8], (t, u) => cyl(t * 0.8 + 0.2, 0.3 - u * 0.3), 0);
    c.part();
    c.px(cx - 0.4, 10 + U, A.crest, sphere(-0.3, -0.4));
    // The crescent seen edge on: one golden horn curving up over the brow.
    c.part();
    for (const [x, y] of [[-3, 9], [-3, 8], [-4, 7], [-4, 6], [-5, 5], [-5, 4]]) c.px(cx + x, y + U, A.crest, sphere(-0.4, -0.3));
    return;
  }
  const w = [2.4, 3.4, 3.9, 4.1, 4.2];
  c.shape(6 + U, 10 + U, (y) => [cx - w[y - 6 - U], cx + w[y - 6 - U]], A.plate, (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1));
  for (let y = 7; y <= 9; y++) {
    c.shade(cx - 2, y + U, 1);
    c.shade(cx + 1, y + U, 1);
  }
  if (view === 'back') {
    laced(c, 10 + U, 14 + U, (y) => [cx - 4.2 - (y - 10 - U) * 0.55, cx + 4.2 + (y - 10 - U) * 0.55], (t, u) => cyl(t * 0.9, 0.3 - u * 0.3), 0);
    return;
  }
  // From the front the guard flares out only at the sides, the face open between.
  laced(c, 10 + U, 14 + U, (y) => [cx - 4.2 - (y - 10 - U) * 0.7, cx - 2.8], (t, u) => cyl(t * 0.6 - 0.4, 0.3 - u * 0.3), 0);
  laced(c, 10 + U, 14 + U, (y) => [cx + 2.8, cx + 4.2 + (y - 10 - U) * 0.7], (t, u) => cyl(t * 0.6 + 0.4, 0.3 - u * 0.3), 0);
  c.part();
  c.px(cx - 4, 10 + U, A.crest, sphere(-0.5, -0.4));
  c.px(cx + 3, 10 + U, A.crest, sphere(0.5, -0.4));
  crescent(c, cx, 8.8 + U, 5.6);
}

// ---------------------------------------------------------------------------
// Directions

type Meta = { tip: { x: number; y: number }; hand: { x: number; y: number } };

/** The hakama from the front or back: wide pleated legs from the obi to the ankles. */
function hakama(c: PixelCanvas, cx: number, U: number, L: number, fa: number, fb: number, sway: number): void {
  const waist = 22 + U;
  const leg = (side: -1 | 1, lift: number) => {
    const hem = 28 + L - lift;
    c.part();
    c.shape(waist, hem, (y) => {
      const u = (y + 0.5 - waist) / (hem + 1 - waist);
      const hw = 4.1 + 2.1 * u;
      const x = cx + sway * 0.5 * u * u;
      return side < 0 ? [x - hw, x + 0.1] : [x - 0.1, x + hw];
    }, S.hakama, (_x, _y, t, u) => cyl(t * 0.8 + side * 0.25, 0.15 - u * 0.25), { bias: side > 0 ? 0 : -1 + (lift ? 1 : 0) });
    // Pleats.
    for (let y = waist + 2; y <= hem; y++) {
      const u = (y + 0.5 - waist) / (hem + 1 - waist);
      c.shade(Math.round(cx + side * (1.6 + 1.6 * u)), y, -1);
    }
  };
  leg(-1, fa);
  leg(1, fb);
  // The split between the legs, at the hem.
  for (let y = 26 + L; y <= 28 + L; y++) c.shade(cx - 0.5, y, -2);
}

function drawDown(c: PixelCanvas, p: Pose): Meta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  let tip = { x: 0, y: 0 };
  const sh = { x: 7.6, y: 16.8 + U }; // sword shoulder (screen left)
  const swordArm = () => {
    tip = drawKatana(c, p.blade);
    sleeve(c, sh.x, sh.y, p.blade.hx, p.blade.hy, p.bladeBehind ? -1 : 0);
    hand(c, p.blade.hx, p.blade.hy);
  };
  // The fox's tail sweeping out and up behind him.
  foxTail(c, 14.5, 23 + U, 21 + p.sway, 24 + U, 19.5 + p.sway * 0.5, 13.5 + U, p.sway, -1);
  if (p.bladeBehind) swordArm();

  // The ponytail swinging behind the head, peeking out at the side.
  if (S.ponytail && !S.hat) {
    c.part();
    c.capsule(14.2, 8.6 + U, 15.8 + p.sway * 0.6, 16.5 + U, 1.2, 0.7, S.hair, { bias: -1 });
  }

  foot(c, 9.7, 29.7 - p.footA);
  foot(c, 14.3, 29.7 - p.footB);
  hakama(c, cx, U, L, p.footA, p.footB, p.sway);

  // The gi: a wrapped chest, the left side crossing over the right.
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist - 1, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 4.3 - 0.5 * u * u;
    return [cx - hw, cx + hw];
  }, S.gi, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  // The collar: skin at the throat inside two white lapels meeting at the sash.
  c.part();
  for (let y = top; y < waist - 1; y++) {
    const k = y - top;
    const w = Math.max(0, 1.6 - k * 0.45);
    for (let x = Math.round(cx - w - 0.5); x < Math.round(cx + w); x++) c.px(x, y, S.skin, sphere((x + 0.5 - cx) / 2, -0.3));
    c.px(Math.round(cx - w - 1.2), y, S.collar, cyl(-0.4, 0.2));
    if (k < 4) c.px(Math.round(cx + w + 0.2), y, S.collar, cyl(0.4, 0.2), { bias: -1 });
  }
  // The obi, a knot at the side.
  c.part();
  c.shape(waist - 1, waist, () => [cx - 4.1, cx + 4.1], S.obi, (_x, _y, t, u) => cyl(t, 0.2 - u * 0.4));
  c.part();
  c.px(cx + 2, waist, S.obi, sphere(0.3, 0.2), { bias: 1 });
  c.px(cx + 2, waist + 1, S.obi, sphere(0.3, 0.6));

  if (S.armor) {
    // The cuirass in laced bands with a gold crest, and the plated skirt over the hakama.
    laced(c, top + 1, waist, (y) => {
      const u = (y + 0.5 - top) / (waist - top);
      const hw = 4.6 - 0.5 * u * u;
      return [cx - hw, cx + hw];
    }, (t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
    c.part();
    c.px(cx - 1, top + 3, S.armor.crest, sphere(-0.2, -0.3));
    c.px(cx, top + 3, S.armor.crest, sphere(0.2, -0.3));
    laced(c, waist + 1, waist + 4, (y) => {
      const u = (y - waist - 1) / 3;
      const x = cx + p.sway * 0.3 * u;
      const hw = 4.8 + 0.8 * u;
      return [x - hw, x + hw];
    }, (t, u) => cyl(t * 0.8, 0.2 - u * 0.3));
    for (let y = waist + 1; y <= waist + 4; y++) {
      c.shade(cx - 2, y, -2);
      c.shade(cx + 1, y, -2);
    }
  }

  // The haori: open panels from the shoulders to the hips.
  if (S.haori) {
    const rt = 15 + U;
    const rb = 24 + L;
    const panel = (side: -1 | 1) => (y: number): [number, number] => {
      const u = (y + 0.5 - rt) / (rb + 1 - rt);
      const hw = 4.9 + 1.4 * u;
      const gap = 1.9 + 0.9 * u;
      const x = cx + p.sway * 0.4 * u;
      return side < 0 ? [x - hw, x - gap] : [x + gap, x + hw];
    };
    c.part();
    c.shape(rt, rb, panel(-1), S.haori, (_x, _y, t, u) => cyl(t * 0.6 - 0.35, 0.25 - u * 0.35));
    c.part();
    c.shape(rt, rb, panel(1), S.haori, (_x, _y, t, u) => cyl(t * 0.6 + 0.35, 0.25 - u * 0.35));
    for (let y = rt + 1; y <= rb; y++) {
      c.shade(Math.round(panel(-1)(y)[1]) - 1, y, 1);
      c.shade(Math.round(panel(1)(y)[0]), y, 1);
    }
  }

  // Free arm (the character's left, screen right).
  const fh = p.free ? { x: p.free.x, y: p.free.y + U } : { x: 17.4, y: 22.4 + U + p.arm };
  sleeve(c, 16.4, 16.8 + U, fh.x, fh.y);
  hand(c, fh.x, fh.y);
  shoulder(c, 16.8, 16.2 + U);
  pad(c, 17.3, 16.4 + U);

  // Head.
  c.part();
  c.ellipse(cx, 12.6 + U, 3.2, 2.9, S.skin);
  c.part();
  c.px(11, 13 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 13 + U, S.skin, sphere(0.35, -0.2));
  c.shade(11, 14 + U, -1);
  c.shade(12, 14 + U, -1);
  if (S.hat) {
    kasa(c, cx, U);
    // The brim's shadow across the brow.
    for (let x = 9; x <= 14; x++) c.shade(x, 11 + U, -2);
  } else if (S.armor) {
    kabuto(c, 'front', cx, U);
  } else {
    // Hair swept back to the knot, one loose lock over the brow.
    c.part();
    const widths = [2.2, 3.4, 3.9, 4.1];
    c.shape(7 + U, 10 + U, (y) => [cx - widths[y - 7 - U], cx + widths[y - 7 - U]], S.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1));
    c.part();
    for (const y of [11, 12]) {
      c.px(8, y + U, S.hair, cyl(-0.8, 0));
      c.px(15, y + U, S.hair, cyl(0.8, 0));
    }
    c.px(10, 11 + U, S.hair, sphere(-0.2, 0.4));
    c.px(10, 12 + U, S.hair, sphere(-0.2, 0.6), { bias: -1 });
    c.shade(13, 8 + U, 1);
    if (S.fox) {
      // Fox ears instead of a knot, and the mask.
      foxEar(c, 9.5, 5 + U, true);
      foxEar(c, 14.5, 5 + U, true);
      foxMaskFront(c, cx, U);
    } else {
      // The knot on top.
      c.part();
      c.ellipse(cx + 0.5, 6.6 + U, 1.4, 1.1, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx, dy - 0.3) });
    }
  }
  eyes(c, [[10, 12 + U], [13, 12 + U]], p.blink);
  menpo(c, cx - 2.6, cx + 2.6, 13 + U, [11, 12]);

  if (!p.bladeBehind) swordArm();
  shoulder(c, 7.2, 16.2 + U);
  if (S.armor) pad(c, 6.7, 16.4 + U);
  return { tip, hand: { x: p.blade.hx, y: p.blade.hy } };
}

function drawUp(c: PixelCanvas, p: Pose): Meta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  let tip = { x: 0, y: 0 };
  const sh = { x: 16.4, y: 16.8 + U }; // sword shoulder (screen right)
  const swordArm = () => {
    tip = drawKatana(c, p.blade);
    sleeve(c, sh.x, sh.y, p.blade.hx, p.blade.hy, p.bladeBehind ? -1 : 0);
    hand(c, p.blade.hx, p.blade.hy);
  };
  if (p.bladeBehind) swordArm();

  // Free hand reaching ahead (away from us) is hidden behind the body.
  const fh = p.free ? { x: 24 - p.free.x, y: p.free.y + U } : { x: 6.6, y: 22.4 + U + p.arm };
  const ahead = fh.y < 17 + U;
  if (ahead) {
    sleeve(c, 7.6, 16.8 + U, fh.x, fh.y, -1);
    hand(c, fh.x, fh.y);
  }

  foot(c, 9.7, 29.7 - p.footB);
  foot(c, 14.3, 29.7 - p.footA);
  hakama(c, cx, U, L, p.footB, p.footA, p.sway);

  // The back of the gi, or the haori over it down to the hips, with its crest.
  const top = 14.5 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist - 1, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    return [cx - 4.4 + 0.4 * u, cx + 4.4 - 0.4 * u];
  }, S.gi, (_x, _y, t, u) => cyl(t * 0.9, 0.3 - u * 0.4));
  c.part();
  c.shape(waist - 1, waist, () => [cx - 4.2, cx + 4.2], S.obi, (_x, _y, t, u) => cyl(t, 0.2 - u * 0.4));
  // The hakama's stiff back plate over the obi.
  c.part();
  c.shape(waist, waist + 2, (y) => {
    const u = (y - waist) / 2;
    return [cx - 2.4 + u * 0.4, cx + 2.4 - u * 0.4];
  }, S.hakama, (_x, _y, t) => cyl(t * 0.7, 0.3), { bias: 1 });
  if (S.armor) {
    // The back plate in laced bands, a great knotted cord between the shoulders, and the plated skirt.
    const t0 = Math.ceil(top);
    laced(c, t0, waist, (y) => {
      const u = (y + 0.5 - t0) / (waist + 1 - t0);
      return [cx - 4.5 + 0.4 * u, cx + 4.5 - 0.4 * u];
    }, (t, u) => cyl(t * 0.9, 0.3 - u * 0.4));
    c.part();
    for (const [x, y] of [[10, 17], [13, 17], [11, 18], [12, 18], [10, 19], [13, 19], [10, 20], [13, 20]]) c.px(x, y + U, S.armor.lace, sphere((x - 11.5) * 0.3, 0), { bias: 1 });
    laced(c, waist + 1, waist + 4, (y) => {
      const u = (y - waist - 1) / 3;
      const x = cx + p.sway * 0.3 * u;
      const hw = 4.8 + 0.8 * u;
      return [x - hw, x + hw];
    }, (t, u) => cyl(t * 0.8, 0.2 - u * 0.3));
    for (let y = waist + 1; y <= waist + 4; y++) {
      c.shade(cx - 2, y, -2);
      c.shade(cx + 1, y, -2);
    }
  }
  if (S.haori) {
    const rb = 24 + L;
    c.part();
    c.shape(top, rb, (y) => {
      const u = Math.max(0, (y + 0.5 - top) / (rb + 1 - top));
      const hw = 4.7 + 1.4 * u;
      const x = cx + p.sway * 0.4 * u;
      return [x - hw, x + hw];
    }, S.haori, (_x, _y, t, u) => cyl(t * 0.9, 0.25 - u * 0.35));
    // The crest between the shoulders: a ring round a dot.
    c.part();
    for (const [x, y] of [[11, 16], [12, 16], [10, 17], [13, 17], [10, 18], [13, 18], [11, 19], [12, 19]]) c.px(x, y + U, S.trim, { x: 0, y: 0.3, z: 0.95 });
    c.px(11, 17.5 + U, S.trim, { x: 0, y: 0.3, z: 0.95 }, { bias: 1 });
  }
  // The fox's tail over the hakama, curling up to one side.
  foxTail(c, 12.5, 22.5 + U, 19 + p.sway, 26 + U, 18.5 + p.sway * 0.6, 15 + U, p.sway);

  if (!ahead) {
    sleeve(c, 7.6, 16.8 + U, fh.x, fh.y);
    hand(c, fh.x, fh.y);
  }

  if (S.hat) {
    // The back of the head under the kasa, then the hat.
    c.part();
    c.ellipse(cx, 12 + U, 3.4, 3, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
    kasa(c, cx, U);
  } else if (S.armor) {
    kabuto(c, 'back', cx, U);
  } else {
    c.part();
    c.ellipse(cx, 11 + U, 3.9, 3.9, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
    c.shade(cx - 1, 8 + U, 1);
    c.part();
    if (S.fox) {
      foxEar(c, 9.5, 5 + U, false);
      foxEar(c, 14.5, 5 + U, false);
    } else c.ellipse(cx, 7.2 + U, 1.4, 1.1, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx, dy - 0.3) });
    if (S.ponytail) {
      // The tail down the back, swinging.
      c.part();
      c.capsule(cx, 8 + U, cx + p.sway * 0.8, 19 + U, 1.35, 0.8, S.hair);
      c.shade(cx, 10 + U, 1);
    }
  }

  if (!p.bladeBehind) swordArm();
  shoulder(c, 7.2, 16.2 + U);
  shoulder(c, 16.8, 16.2 + U);
  pad(c, 6.7, 16.4 + U);
  if (S.armor) pad(c, 17.3, 16.4 + U);
  return { tip, hand: { x: p.blade.hx, y: p.blade.hy } };
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): Meta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const Sx = -p.lean; // lean forward = toward the left
  const hx = cx + Sx; // upper body centre
  let tip = { x: 0, y: 0 };
  const sh = { x: hx + 0.6, y: 17.4 + U };
  // The fox's tail streaming out behind and curling up.
  foxTail(c, hx + 2.8, 22 + U, hx + 9.5 + p.sway, 23.5 + U, hx + 8.5 + p.sway * 0.5, 13 + U, p.sway, -1);
  if (p.bladeBehind) tip = drawKatana(c, p.blade);

  // The ponytail streaming behind.
  if (S.ponytail && !S.hat) {
    c.part();
    c.capsule(hx + 1.6, 8 + U, hx + 4.6 + p.sway * 0.8, 15.5 + U - Math.max(0, p.sway) * 0.6, 1.3, 0.75, S.hair, { bias: -1 });
  }
  // The guard on the far shoulder, peeking over the back.
  pad(c, hx + 2.2, 16 + U, 1.8, 2);

  // Far arm, mostly hidden behind the body.
  const fh = p.free ? { x: p.free.x + Sx, y: p.free.y + U } : { x: hx + 2.6 - p.arm, y: 22.4 + U };
  sleeve(c, hx + 1.8, 17 + U, fh.x, fh.y, -1);
  hand(c, fh.x, fh.y);

  // Hakama in profile: each leg a wide pleated tube swinging with its foot.
  const waist = 22 + U;
  const leg = (f: number, bias: number) => {
    const hem = 28 + L - Math.max(0, f) * 0.35;
    c.part();
    c.shape(waist, hem, (y) => {
      const u = (y + 0.5 - waist) / (hem + 1 - waist);
      const x = cx + 0.3 - f * 0.9 * u + Sx * 0.4 * (1 - u);
      const hw = 2.3 + 1.6 * u;
      return [x - hw, x + hw];
    }, S.hakama, (_x, _y, t, u) => cyl(t * 0.9, 0.15 - u * 0.25), { bias });
    for (let y = waist + 2; y <= hem; y++) {
      const u = (y + 0.5 - waist) / (hem + 1 - waist);
      c.shade(Math.round(cx + 0.3 - f * 0.9 * u), y, -1);
    }
  };
  const lift = (f: number) => Math.max(0, f) * 0.35;
  foot(c, cx + 0.6 - p.footB, 29.7 - lift(p.footB), true, -1);
  leg(p.footB, -1);
  foot(c, cx - 0.5 - p.footA, 29.7 - lift(p.footA), true);
  leg(p.footA, 0);

  // The gi in profile, the collar at the front, the obi, and the haori over the back half.
  const top = 15 + U;
  c.part();
  c.shape(top, waist - 1, (y) => [hx - 2.8 - (y >= top + 1 && y <= top + 3 ? 0.4 : 0), hx + 2.6], S.gi, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, (u - 0.35) * 1.1, 1));
  c.part();
  for (let y = top; y < top + 4; y++) c.px(Math.round(hx - 2.6 + (y - top) * 0.6), y, S.collar, cyl(-0.5, 0.2));
  c.px(Math.round(hx - 2.4), top, S.skin, cyl(-0.6, 0));
  c.part();
  c.shape(waist - 1, waist, () => [hx - 3.1, hx + 2.7], S.obi, (_x, _y, t, u) => cyl(t, 0.2 - u * 0.4));
  if (S.armor) {
    laced(c, top + 1, waist, () => [hx - 3.2, hx + 2.9], (t, u) => sphere(t * 0.9 - 0.1, (u - 0.35) * 1.1, 1));
    c.part();
    c.px(hx - 3, top + 3, S.armor.crest, sphere(-0.6, -0.3));
    laced(c, waist + 1, waist + 4, (y) => {
      const u = (y - waist - 1) / 3;
      return [cx - 3.2 - u * 1.0 + Sx * 0.3, cx + 3.4 + u * 1.2 + p.sway * 0.4 * u];
    }, (t, u) => cyl(t * 0.8 - 0.1, 0.2 - u * 0.3));
    for (let y = waist + 1; y <= waist + 4; y++) c.shade(cx, y, -2);
  }
  if (S.haori) {
    const rt = 15 + U;
    const rb = 24 + L;
    c.part();
    c.shape(rt, rb, (y) => {
      const u = Math.max(0, (y + 0.5 - rt) / (rb + 1 - rt));
      return [hx - 0.8 - 1.2 * u, hx + 3.1 + 1.6 * u + p.sway * 0.5 * u];
    }, S.haori, (_x, _y, t, u) => cyl(t * 0.8 - 0.1, 0.25 - u * 0.3));
    for (let y = rt + 2; y <= rb; y++) {
      const u = (y + 0.5 - rt) / (rb + 1 - rt);
      c.shade(Math.round(hx - 0.8 - 1.2 * u), y, 1);
    }
  }

  // Head.
  c.part();
  c.ellipse(hx - 1.2, 12.8 + U, 2.9, 2.7, S.skin);
  c.part();
  c.px(hx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.shade(hx - 4, 14 + U, -1);
  if (S.hat) {
    kasa(c, hx - 0.6, U, 6.6);
    for (let x = Math.floor(hx - 5); x <= hx + 1; x++) c.shade(x, 11 + U, -2);
  } else if (S.armor) {
    kabuto(c, 'side', hx, U);
  } else {
    c.part();
    const rows: [number, number][] = [
      [-2.6, 2.4],
      [-3.6, 3.0],
      [-4.1, 3.2],
      [-4.0, 3.2],
      [0.0, 3.1],
      [0.4, 3.0],
    ];
    c.shape(7 + U, 12 + U, (y) => {
      const [l, r] = rows[y - 7 - U];
      return [hx + l, hx + r];
    }, S.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.4 - 0.9, 1));
    c.px(hx - 4, 11 + U, S.hair, sphere(-0.3, 0.4), { bias: -1 });
    if (S.fox) {
      foxEar(c, hx + 1.9, 5 + U, false, -1);
      foxEar(c, hx - 0.6, 5 + U, true);
      foxMaskSide(c, hx, U);
    } else {
      c.part();
      c.ellipse(hx + 0.6, 6.8 + U, 1.4, 1.1, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx, dy - 0.3) });
    }
  }
  eyes(c, [[hx - 3, 12 + U]], p.blink);
  menpo(c, hx - 5.2, hx - 1.4, 13 + U, [hx - 4]);

  // Near arm and blade.
  if (!p.bladeBehind) tip = drawKatana(c, p.blade);
  sleeve(c, sh.x, sh.y, p.blade.hx, p.blade.hy);
  hand(c, p.blade.hx, p.blade.hy);
  shoulder(c, hx + 0.8, 16.8 + U, 2.1, 1.6);
  if (S.armor) pad(c, hx + 1, 17.2 + U, 2.3, 2.5);
  return { tip, hand: { x: p.blade.hx, y: p.blade.hy } };
}

// ---------------------------------------------------------------------------
// Animations

type View = 'down' | 'up' | 'side';

const bl = (hx: number, hy: number, angle: number, len = 12): Blade => ({ hx, hy, angle, len });

/** A low guard: the blade held down and out beside him. */
const IDLE_BLADE: Record<View, Blade> = {
  down: bl(5.5, 22, 208),
  up: bl(18.5, 22, 152),
  side: bl(9, 22.5, -122),
};

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: 0,
  footB: 0,
  sway: 0,
  arm: 0,
  lean: 0,
  blade: { ...IDLE_BLADE[view] },
});

function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 8;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph - 0.6) > 0.1 ? 1 : 0;
    p.blade.hy += p.breath * 0.5;
    p.blade.angle += Math.sin(ph) * 2;
    p.sway = Math.sin(ph - 2.2) > 0.5 ? 1 : 0;
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
    p.sway = view === 'side' ? 1 + (p.lift ? 0 : 1) : Math.round(-s);
    if (view === 'side') {
      p.footA = Math.round(s * 2.4);
      p.footB = -p.footA;
      p.arm = Math.round(s * 1.5);
      p.blade.angle += -s * 6;
      p.blade.hx += -s;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.arm = Math.round(-s);
      p.blade.hy += s > 0 ? -1 : 0;
    }
    p.blade.hy -= p.lift;
    frames.push(p);
  }
  return frames;
}

/** The thrust, straight ahead: draw back, drive the point out, hold it, recover. */
function stab(view: View): Pose[] {
  const keys: Record<View, (Blade & { behind?: boolean })[]> = {
    down: [bl(9.5, 19.5, 182, 9), bl(11, 25, 180, 10), bl(11, 24.5, 180, 10), bl(7, 22.5, 200)],
    up: [{ ...bl(15, 20.5, 2), behind: true }, { ...bl(13, 13.5, 0), behind: true }, { ...bl(13, 14, 0), behind: true }, bl(17.5, 21.5, 164)],
    side: [bl(14.5, 20.5, -92), bl(4.5, 20, -90), bl(5, 20, -90), bl(8.5, 22, -112)],
  };
  return keys[view].map((b, i) => {
    const p = base(view);
    p.blade = { hx: b.hx, hy: b.hy, angle: b.angle, len: b.len };
    p.bladeBehind = b.behind;
    const out = i === 1 || i === 2;
    p.breath = out ? 1 : 0;
    p.sway = out ? (view === 'side' ? 2 : 1) : 0;
    if (view === 'side') {
      p.lean = out ? 2 : i === 0 ? -1 : 0;
      p.footA = out ? 3 : 0;
      p.footB = out ? -2 : 0;
    } else {
      p.free = { x: 16.5, y: 21 };
      if (out) p.footA = 1;
    }
    return p;
  });
}

/** Blade keyframes per view: wind-up, strike, follow-through, follow-through, recover. */
const SWINGS: Record<'slash1' | 'slash2', Record<View, (Blade & { behind?: boolean })[]>> = {
  // Forehand: across the body from the sword side.
  slash1: {
    down: [bl(3.5, 16.5, -70), bl(9.5, 25, 190), bl(14.5, 24, 130), bl(15.5, 22, 104), bl(6, 21.5, 200)],
    up: [bl(20.5, 16.5, 70), { ...bl(14.5, 14, -8), behind: true }, { ...bl(8, 15.5, -60), behind: true }, { ...bl(6, 19, -86), behind: true }, bl(18, 21.5, 160)],
    side: [bl(15, 15, 25), bl(5.5, 20, -88), bl(8.5, 24, -140), bl(10.5, 25, -175), bl(9, 22.5, -125)],
  },
  // Backhand: back the other way.
  slash2: {
    down: [bl(14.5, 19, 75), bl(13.5, 25, 172), bl(5.5, 24, 232), bl(3.5, 21, 262), bl(5.5, 22, 206)],
    up: [{ ...bl(6, 17, -70), behind: true }, { ...bl(9.5, 14, 5), behind: true }, bl(17, 16, 60), bl(19.5, 19.5, 88), bl(18.5, 22, 154)],
    side: [bl(11, 25, 165), bl(5.5, 20.5, -92), bl(7.5, 15.5, -38), bl(10.5, 13.5, -8), bl(9, 22.5, -122)],
  },
};

function slash(kind: 'slash1' | 'slash2') {
  return (view: View): Pose[] =>
    SWINGS[kind][view].map((b, i) => {
      const p = base(view);
      p.blade = { hx: b.hx, hy: b.hy, angle: b.angle, len: b.len };
      p.bladeBehind = b.behind;
      p.breath = i === 1 || i === 2 ? 1 : 0;
      const dirSign = kind === 'slash1' ? 1 : -1;
      p.sway = i === 0 ? 0 : i < 4 ? -dirSign : 0;
      if (view === 'side') {
        p.lean = i === 1 || i === 2 ? 1 : 0;
        p.footA = i >= 1 && i <= 3 ? 2 : 0;
        p.footB = i >= 1 && i <= 3 ? -1 : 0;
        p.sway = i >= 1 && i <= 3 ? 2 : 1;
      } else {
        p.free = { x: 18.4, y: 20.6 };
        if (i >= 1 && i <= 3) p.footA = 1;
      }
      return p;
    });
}

/** The dash: crouched low and driving forward, the blade trailing behind him. */
function dash(view: View): Pose[] {
  const trail: Record<View, Blade> = { down: bl(6, 21.5, -38), up: bl(18, 21.5, 146), side: bl(15.5, 22.5, 112) };
  return [0, 1, 2].map((i) => {
    const p = base(view);
    p.blade = { ...trail[view] };
    p.blade.angle += i * (view === 'side' ? 4 : 3);
    p.breath = 1;
    p.lift = i === 1 ? 1 : 0;
    p.sway = view === 'side' ? 3 : view === 'down' ? -2 : 2;
    if (view === 'side') {
      p.lean = 2;
      p.footA = 3;
      p.footB = -2;
      p.free = { x: 13, y: 21 };
    } else {
      p.footA = i === 1 ? 0 : 1;
      p.footB = i === 1 ? 1 : 0;
      p.free = { x: 16.5, y: 20.5 };
    }
    return p;
  });
}

/** Screen angle (0 = right, 90 = down) he faces in each direction. */
export const FACING_DEG: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

/** The spin: a full turn with the blade held straight out, one pose per eighth of a turn. */
export const SPIN_FRAMES = 8;

function spinFrame(k: number): { dir: Dir; pose: Pose } {
  const phi = (k * 360) / SPIN_FRAMES;
  const dir: Dir = phi >= 45 && phi < 135 ? 'down' : phi >= 135 && phi < 225 ? 'left' : phi >= 225 && phi < 315 ? 'up' : 'right';
  const deg = dir === 'right' ? 180 - phi : phi;
  const a = deg * RAD;
  const view: View = dir === 'down' || dir === 'up' ? dir : 'side';
  const p = base(view);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  p.blade = bl(12 + ca * 5.5, 20.5 + sa * 3.5, deg + 90, 13);
  p.bladeBehind = sa < -0.35;
  p.breath = 1;
  p.sway = Math.round(-ca * 2);
  if (view !== 'side') p.free = { x: 12 - ca * 6, y: 19.5 - sa * 2 };
  p.footA = view === 'side' ? 1 : k % 2;
  p.footB = view === 'side' ? -1 : 1 - (k % 2);
  return { dir, pose: p };
}

/** The frame index of the spin facing `dir`, where a spin starting that way begins. */
export const spinStart = (dir: Dir): number => Math.round(FACING_DEG[dir] / (360 / SPIN_FRAMES)) % SPIN_FRAMES;

/** A whole turn in a bit over a quarter of a second. */
export const SPIN_FPS = 30;

// ---------------------------------------------------------------------------
// Frame generation

export type SamuraiAnim = 'idle' | 'walk' | 'stab' | 'slash1' | 'slash2' | 'dash';

export interface SamuraiAnimDef {
  name: SamuraiAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
}

export const SAMURAI_ANIMS: SamuraiAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'stab', fps: 26, loop: false, poses: stab },
  { name: 'slash1', fps: 22, loop: false, poses: slash('slash1') },
  { name: 'slash2', fps: 22, loop: false, poses: slash('slash2') },
  { name: 'dash', fps: 18, loop: true, poses: dash },
];

/** Frame index at which each move lands. */
export const HIT_FRAME = { stab: 1, slash1: 1, slash2: 1 } as const;

export interface SamuraiFrame {
  key: string; // e.g. "walk_left_3", or "spin_5"
  anim: SamuraiAnim | 'spin';
  dir: Dir | null;
  canvas: PixelCanvas;
  meta: SamuraiMeta;
}

function drawSamuraiFrame(dir: Dir, pose: Pose): { canvas: PixelCanvas; meta: SamuraiMeta } {
  const c = new PixelCanvas(SAMURAI_W, SAMURAI_H).offset(BODY_X, BODY_Y);
  const m = dir === 'down' ? drawDown(c, pose) : dir === 'up' ? drawUp(c, pose) : drawSide(c, pose);
  const meta: SamuraiMeta = { tipX: m.tip.x + BODY_X, tipY: m.tip.y + BODY_Y, handX: m.hand.x + BODY_X, handY: m.hand.y + BODY_Y };
  if (dir === 'right') return { canvas: c.mirrored(), meta: { ...meta, tipX: SAMURAI_W - meta.tipX, handX: SAMURAI_W - meta.handX } };
  return { canvas: c, meta };
}

export function buildSamuraiFrames(look: SamuraiLook = BLADEWIND_LOOK): SamuraiFrame[] {
  S = look;
  const out: SamuraiFrame[] = [];
  for (const a of SAMURAI_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        const { canvas, meta } = drawSamuraiFrame(dir, pose);
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas, meta });
      });
    }
  }
  for (let k = 0; k < SPIN_FRAMES; k++) {
    const { dir, pose } = spinFrame(k);
    const { canvas, meta } = drawSamuraiFrame(dir, pose);
    out.push({ key: `spin_${k}`, anim: 'spin', dir: null, canvas, meta });
  }
  S = BLADEWIND_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Marks and icons

/** An 11x7 mark of `n` cuts (1-3), white, to hang over a foe's head and tint. */
export function cutMark(n: number): Uint8ClampedArray {
  const W = 11;
  const H = 7;
  const px = new Uint8ClampedArray(W * H * 4);
  const put = (x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  };
  const x0 = 5 - (n - 1) * 1.5;
  for (let k = 0; k < n; k++) {
    const bx = Math.round(x0 + k * 3);
    for (let i = 0; i < 6; i++) put(bx + 2 - Math.round(i * 0.6), i, i === 0 || i === 5 ? 150 : 255);
  }
  return px;
}

type Cols = [string, string, string, string];

function icon(): { px: Uint8ClampedArray; put: (x: number, y: number, c: string) => void } {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: string) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * S + x) * 4;
    px[i] = (n >> 16) & 255;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  return { px, put };
}

/** A katana from the lower left up to the upper right, a gold guard, and `wind` curling round the point. */
export function katanaIcon(edge: string, steel: string, wind: Cols | null): Uint8ClampedArray {
  const { px, put } = icon();
  if (wind) {
    for (let k = 0; k < 16; k++) {
      const a = k * 0.55;
      const r = 1.5 + k * 0.28;
      put(11 + Math.cos(a) * r, 5 + Math.sin(a) * r * 0.8, wind[k < 5 ? 0 : k < 10 ? 1 : 2]);
    }
  }
  for (let i = 0; i < 10; i++) {
    const x = 4 + i;
    const y = 11 - i + (i > 6 ? 0 : 0);
    put(x, y, edge);
    put(x + 1, y, steel);
  }
  put(14, 1, edge);
  for (const [x, y] of [[2, 12], [3, 11], [4, 13], [3, 12]]) put(x, y, '#d6a044');
  for (const [x, y] of [[1, 14], [2, 13], [0, 15]]) put(x, y, '#3a3446');
  put(1, 13, '#6a6476');
  return px;
}

/** The dash: a blade streaking right between lines of wind. */
export function dashIcon(wind: Cols, edge: string): Uint8ClampedArray {
  const { px, put } = icon();
  for (let x = 0; x < 11; x++) {
    if (x % 4 !== 3) put(x, 4, wind[2]);
    if (x % 3 !== 1) put(x + 2, 12, wind[2]);
    if (x > 2 && x % 5 !== 4) put(x - 1, 8, wind[1]);
  }
  for (let x = 6; x < 15; x++) put(x, 7 + (x > 12 ? 0 : 0), x > 11 ? wind[0] : edge);
  for (let x = 7; x < 15; x++) put(x, 8, x > 12 ? wind[1] : '#8e9ab4');
  put(15, 7, wind[0]);
  for (const y of [6, 7, 8, 9]) put(5, y, '#d6a044');
  put(4, 7, '#3a3446');
  put(3, 8, '#3a3446');
  put(2, 8, '#6a6476');
  return px;
}

/** Two cuts crossing, flaring where they meet. */
export function crossIcon(cols: Cols): Uint8ClampedArray {
  const { px, put } = icon();
  for (let i = 1; i < 15; i++) {
    const k = Math.abs(i - 7.5) / 7.5;
    const c = k < 0.3 ? cols[0] : k < 0.65 ? cols[1] : cols[2];
    put(i, i, c);
    put(15 - i, i, c);
    if (k < 0.55) {
      put(i + 1, i, cols[2]);
      put(14 - i, i, cols[2]);
    }
  }
  for (const [x, y] of [[7, 5], [8, 10], [5, 8], [10, 7]]) put(x, y, cols[3]);
  return px;
}
