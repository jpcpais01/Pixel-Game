// The necromancer, drawn procedurally from a small rig like the archer.
//
// A gaunt figure in a grave-violet robe, deep hood and bell sleeves, the face
// lost in the hood's shadow but for a grey chin and two soul-green eyes. A
// mantle of old bone lies over the shoulders with a small skull at its clasp,
// soul-green trim runs down the robe's opening and round its hem, and a
// gnarled staff crowned with a skull burns with green soul fire. The free hand
// casts, a pale palm filling with light.
//
// The blood mage is his other look on the same rig: crimson over black, the
// hood thrown back from a bone-white mane, a high black collar, eyes like
// embers, and a blood orb caged in bone on the staff.
//
// The tomb king is a skin of the bonecaller: a dead pharaoh risen, wound in
// old linen, a gold death mask for a face with kohl-dark eyes burning lapis
// blue, a striped gold-and-lapis headdress whose flaps fall to his chest and
// whose braid hangs down his back, a cobra rearing at the brow, a plaited
// false beard, a broad beaded collar over the shoulders and a striped apron
// down the front of the robe. His staff ends in a golden ankh, blue soul fire
// burning in its loop.
//
// The wyrmblood is a skin of the blood mage: a sorcerer with a dragon's blood
// in him and it shows. Black scales run over his robe, cracked through with
// seams of molten light, two great horns sweep back from his brow, ash-dark
// hair behind them, scales on his cheeks and eyes like forge coals, and a
// pair of folded leathery wings rises behind his shoulders, their claws
// above his head, flaring when he casts. A dragon's black talon grips the
// molten orb on his staff.
//
// The gravedigger is a skin of the bonecaller: the old keeper of the
// cemetery, hunched from a lifetime of digging. A battered stovepipe hat,
// long grey hair and a stubbled jaw under it, a patched mud-brown greatcoat
// with its sleeves rolled to the elbow, an oxblood scarf wound twice round
// his neck, and a lantern at his hip burning with a sickly green soul flame.
// He carries a long grave spade instead of a staff, runes cut into its blade
// glowing the same green.
//
// The vampire lord is a skin of the blood mage: an old aristocrat of the
// night. Black hair slicked back to a widow's peak, skin pale as candle wax,
// pointed ears and red eyes, a tall upturned collar fanned behind his head,
// a white jabot and a ruby brooch at the throat over a burgundy waistcoat,
// and a black cape lined in crimson whose hem is cut like a bat's wing. The
// cape sweeps behind him as he walks and opens like wings when he casts. His
// cane is crowned with a ruby held between two silver bat wings.
//
// The body keeps to the 24x32 box; frames are larger so the staff can be
// raised overhead. Hands are posed in the caster's own terms (forward, out to
// the side, height) and placed for each view, like the archer's.

import { PixelCanvas, cyl, hex, sphere, type Material, type NormalFn, type RGB } from './pixel';
import { poly } from './shapes';
import {
  BLOOD_CORE,
  BLOOD_DEEP,
  BLOOD_EYE,
  BLOOD_GEM,
  BLOOD_HAIR,
  BLOOD_HOT,
  BLOOD_INNER,
  BLOOD_MID,
  BLOOD_ROBE,
  BONE,
  BOOT,
  GOLD,
  GRAVE_SKIN,
  GRAVE_WOOD,
  NECRO_INNER,
  NECRO_ROBE,
  PALE_SKIN,
  SOUL_CORE,
  SOUL_DEEP,
  SOUL_EYE,
  SOUL_HOT,
  SOUL_MID,
  SOUL_TRIM,
} from './palette';
import { iconPainter, type SpellColors } from './effects';
import { DIRS, type Dir } from './wizard';

export const NECRO_W = 48;
export const NECRO_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const NECRO_ORIGIN_X = BODY_X + 12;
export const NECRO_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet a bolt leaves the casting hand at. */
export const BOLT_H = 14;

/** A hand, in the caster's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

export interface Pose {
  /** Whole body raised (walk passing frames, the stretch before the slam). */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Feet peeking under the hem. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The casting hand (screen left from the front and back, the far arm from the side) and the staff hand. */
  a: Hand;
  b: Hand;
  /** The staff leaning out from upright: 0 upright, 1 well over (out to the side from the front, forward from the side). */
  tilt: number;
  /** 0..1 light in the casting palm. */
  palm: number;
  /** 0..1 the staff's head flaring. */
  flare: number;
  /** The robe's hem swinging, in pixels. */
  sway: number;
  /** Frame counter, for flickering soul fire. */
  tick: number;
  blink?: boolean;
  /** The idle moment's: the head shifted (x, y) in pixels, leaning in or nodding (front view only). */
  head?: [number, number];
  /** The bonecaller's little skull, sat on the casting palm. */
  skull?: Skull;
  /** The blood mage's orb, floating off the casting palm. */
  orb?: Orb;
}

/** A skull conjured onto the palm: `form` 0..1 as it gathers out of soul fire (or comes apart), its jaw dropped, its sockets lit. */
export interface Skull {
  form: number;
  jaw: number;
  glow: number;
  /** Raised off the palm, in pixels (a little hop as it talks back). */
  rise?: number;
}

/** A blood orb at (dx, dy) from the palm, radius `r`, a trail of light behind it through `trail` (nearest first). */
export interface Orb {
  dx: number;
  dy: number;
  r: number;
  glow: number;
  trail?: [number, number][];
}

/** One look for the caster: its texture key, cloth, face and staff. */
export interface NecroLook {
  key: string;
  robe: Material;
  inner: Material;
  trim: Material;
  skin: Material;
  eye: Material;
  /** The blood mage: hood down, a mane of hair, a high collar, a caged orb for a staff head. */
  blood: boolean;
  /** A skin that changes more than colours: the tomb king and the gravedigger (on the bonecaller), the wyrmblood and the vampire lord (on the blood mage). */
  style?: 'tomb' | 'wyrm' | 'digger' | 'vampire';
  /** What the feet are shod in. */
  feet?: Material;
  /** Light of the soul fire or the blood, brightest first. */
  light: [RGB, RGB, RGB, RGB];
}

export const NECRO_LOOK: NecroLook = {
  key: 'necro',
  robe: NECRO_ROBE,
  inner: NECRO_INNER,
  trim: SOUL_TRIM,
  skin: GRAVE_SKIN,
  eye: SOUL_EYE,
  blood: false,
  light: [SOUL_CORE, SOUL_HOT, SOUL_MID, SOUL_DEEP],
};

export const BLOOD_LOOK: NecroLook = {
  key: 'necro_blood',
  robe: BLOOD_ROBE,
  inner: BLOOD_INNER,
  trim: GOLD,
  skin: PALE_SKIN,
  eye: BLOOD_EYE,
  blood: true,
  light: [BLOOD_CORE, BLOOD_HOT, BLOOD_MID, BLOOD_DEEP],
};

// The tomb king and the wyrmblood.
const ramp = (...c: string[]): RGB[] => c.map(hex);
const LINEN: Material = { ramp: ramp('#3e3428', '#6e604a', '#a08e6e', '#cbb994', '#ebdfbe'), outline: hex('#1a140c'), outlineLit: hex('#2c2418') };
const WRAPS: Material = { ramp: ramp('#322a20', '#5a4e3c', '#86765a', '#b0a07e'), outline: hex('#1a140c') };
const LAPIS: Material = { ramp: ramp('#0a1236', '#14225e', '#20388e', '#3052b8', '#5078dc'), outline: hex('#050818'), outlineLit: hex('#0a1030') };
const TURQ: Material = { ramp: ramp('#0a3a40', '#146664', '#22988a', '#48c8b0', '#8af0d8'), outline: hex('#041a1c'), shine: true };
const KOHL: Material = { ramp: ramp('#06050a', '#100c16'), outline: hex('#06050a'), noAO: true };
const TOMB_EYE: Material = { ramp: ramp('#3c8cff', '#b4dcff'), outline: hex('#06050a'), emissive: 0.9, noAO: true };
const OBSIDIAN: Material = { ramp: ramp('#0c080a', '#181014', '#261a1c', '#382628', '#4e3632'), outline: hex('#050304'), outlineLit: hex('#120a0a') };
const EMBER: Material = { ramp: ramp('#8a2a08', '#d0520e', '#ff8a24', '#ffc860'), outline: hex('#2a0a02'), emissive: 0.75, noAO: true };
const WYRM_INNER: Material = { ramp: ramp('#1a0604', '#2e0c06', '#44140a', '#5c1e10'), outline: hex('#0a0302') };
const ASH_SKIN: Material = { ramp: ramp('#4a3a36', '#7a6660', '#a89284', '#d2bca6'), outline: hex('#140c0a') };
const ASH_HAIR: Material = { ramp: ramp('#0e0c0e', '#1e1a1e', '#302a2e', '#443c40'), outline: hex('#050405'), outlineLit: hex('#141014') };
const HORN: Material = { ramp: ramp('#241c18', '#4e4238', '#7e6e5a', '#ae9a7c', '#d8c8a4'), outline: hex('#080504'), shine: true };
const WING: Material = { ramp: ramp('#2a0808', '#4a0e0e', '#701816', '#98261e', '#bc3a26'), outline: hex('#0a0202'), outlineLit: hex('#200606') };
const WYRM_GEM: Material = { ramp: ramp('#7a1c04', '#d04a0a', '#ff9a2a', '#ffe08a'), outline: hex('#1e0602'), emissive: 0.8, noAO: true };
const WYRM_EYE: Material = { ramp: ramp('#ff7a1a', '#ffe0a0'), outline: hex('#140604'), emissive: 1, noAO: true };

const TOMB_CORE = hex('#f4fbff');
const TOMB_HOT = hex('#a8dcff');
const TOMB_MID = hex('#3c94f0');
const TOMB_DEEP = hex('#1a3894');
const WYRM_CORE = hex('#fff8e0');
const WYRM_HOT = hex('#ffc860');
const WYRM_MID = hex('#ff6a1a');
const WYRM_DEEP = hex('#8a1e0a');

/** The bonecaller's tomb king skin: linen, gold and lapis, soul fire burning blue. */
export const TOMB_LOOK: NecroLook = {
  key: 'necro_tomb',
  robe: LINEN,
  inner: LAPIS,
  trim: GOLD,
  skin: WRAPS,
  eye: TOMB_EYE,
  blood: false,
  style: 'tomb',
  feet: WRAPS,
  light: [TOMB_CORE, TOMB_HOT, TOMB_MID, TOMB_DEEP],
};

/** The blood mage's wyrmblood skin: black scales, molten seams, horns and wings. */
export const WYRM_LOOK: NecroLook = {
  key: 'necro_wyrm',
  robe: OBSIDIAN,
  inner: WYRM_INNER,
  trim: EMBER,
  skin: ASH_SKIN,
  eye: WYRM_EYE,
  blood: true,
  style: 'wyrm',
  light: [WYRM_CORE, WYRM_HOT, WYRM_MID, WYRM_DEEP],
};

// The gravedigger.
const COAT: Material = { ramp: ramp('#1c140e', '#342618', '#4c3824', '#664e34', '#82684a'), outline: hex('#0c0806'), outlineLit: hex('#1a120c') };
const PATCH: Material = { ramp: ramp('#22201a', '#3a382a', '#54513c', '#706c50'), outline: hex('#0c0c08') };
const DIG_INNER: Material = { ramp: ramp('#0e0c0c', '#1a1816', '#282422', '#36302c'), outline: hex('#060504') };
const DIG_LEATHER: Material = { ramp: ramp('#120a06', '#22140c', '#362214', '#4c321e'), outline: hex('#070403') };
const SCARF: Material = { ramp: ramp('#260a08', '#441410', '#62201a', '#823426', '#a04a34'), outline: hex('#120403'), outlineLit: hex('#200806') };
const DIG_SKIN: Material = { ramp: ramp('#3c2c26', '#685044', '#947462', '#b89a82'), outline: hex('#140c0a'), outlineLit: hex('#22160f') };
const GREY_HAIR: Material = { ramp: ramp('#38383a', '#5e5e60', '#888886', '#b0aea6', '#d4d2c8'), outline: hex('#121212'), outlineLit: hex('#1e1e1e') };
const HAT: Material = { ramp: ramp('#0c0a0a', '#181414', '#26201e', '#342c28', '#463c36'), outline: hex('#040303'), outlineLit: hex('#120e0c') };
const HAT_BAND: Material = { ramp: ramp('#161a0e', '#262e16', '#38441e', '#4a5a28'), outline: hex('#080a04') };
const IRON: Material = { ramp: ramp('#121418', '#262a30', '#42484e', '#646c72', '#8e969a'), outline: hex('#060708'), shine: true };
const BRASS: Material = { ramp: ramp('#3a2a10', '#6a5020', '#9a7a34', '#c8a85a'), outline: hex('#1a1206'), shine: true };
const ASH_WOOD: Material = { ramp: ramp('#24180e', '#3e2a1a', '#5a3e28', '#76563a'), outline: hex('#0c0805') };
const DIG_EYE: Material = { ramp: ramp('#5aa82e', '#c8f08a'), outline: hex('#0a1404'), emissive: 0.7, noAO: true };
/** The lantern's glass, lit from within. */
const LANTERN: Material = { ramp: ramp('#2e5a14', '#6ab82a', '#b4f064', '#eaffc4'), outline: hex('#0a1404'), emissive: 0.95, noAO: true };

// The vampire lord.
const VAMP_COAT: Material = { ramp: ramp('#060509', '#0e0c13', '#17141e', '#221e2b', '#302a3a'), outline: hex('#020103'), outlineLit: hex('#0b0910') };
const CAPE: Material = { ramp: ramp('#050408', '#0c0a10', '#15121b', '#201b28', '#352e42'), outline: hex('#010102'), outlineLit: hex('#0a080e'), shine: true };
const LINING: Material = { ramp: ramp('#280208', '#460612', '#6c0a1c', '#94142a', '#bc243a'), outline: hex('#100003'), outlineLit: hex('#1e0206'), shine: true };
const WAISTCOAT: Material = { ramp: ramp('#280810', '#44101c', '#601a28', '#7c2838'), outline: hex('#0e0206') };
const LACE: Material = { ramp: ramp('#6e6e7a', '#a8a8b6', '#d4d4de', '#f6f6fc'), outline: hex('#2e2e38') };
const VAMP_TRIM: Material = { ramp: ramp('#1e1a26', '#36303f', '#524a5e', '#6e6680'), outline: hex('#08070b'), shine: true };
const VAMP_SKIN: Material = { ramp: ramp('#56566c', '#8a8aa0', '#c0c0d0', '#e8e8f2'), outline: hex('#18161f'), outlineLit: hex('#2a2834') };
const VAMP_HAIR: Material = { ramp: ramp('#030306', '#0a0a12', '#151824', '#252a3c', '#3a4058'), outline: hex('#010102'), shine: true };
const VAMP_EYE: Material = { ramp: ramp('#ff1030', '#ffa0aa'), outline: hex('#200008'), emissive: 1, noAO: true };
const RUBY: Material = { ramp: ramp('#3a0010', '#8a0820', '#e01838', '#ff7086'), outline: hex('#140004'), emissive: 0.85, shine: true, noAO: true };
const SILVER: Material = { ramp: ramp('#26262e', '#50526a', '#8689a0', '#c0c3d4', '#eef0ff'), outline: hex('#0a0a10'), shine: true };

const DIG_CORE = hex('#f6ffe0');
const DIG_HOT = hex('#d4ff8a');
const DIG_MID = hex('#8ad83a');
const DIG_DEEP = hex('#3a6a1a');
const VAMP_CORE = hex('#ffe8ec');
const VAMP_HOT = hex('#ff6a7a');
const VAMP_MID = hex('#c0102a');
const VAMP_DEEP = hex('#3a0410');

/** The bonecaller's gravedigger skin: greatcoat, stovepipe, spade and a lantern of green soul fire. */
export const DIGGER_LOOK: NecroLook = {
  key: 'necro_digger',
  robe: COAT,
  inner: DIG_INNER,
  trim: DIG_LEATHER,
  skin: DIG_SKIN,
  eye: DIG_EYE,
  blood: false,
  style: 'digger',
  light: [DIG_CORE, DIG_HOT, DIG_MID, DIG_DEEP],
};

/** The blood mage's vampire lord skin: black and crimson, a bat-winged cape and a ruby at his throat. */
export const VAMPIRE_LOOK: NecroLook = {
  key: 'necro_vampire',
  robe: VAMP_COAT,
  inner: LINING,
  trim: VAMP_TRIM,
  skin: VAMP_SKIN,
  eye: VAMP_EYE,
  blood: true,
  style: 'vampire',
  feet: VAMP_COAT,
  light: [VAMP_CORE, VAMP_HOT, VAMP_MID, VAMP_DEEP],
};

export const NECRO_LOOKS = [NECRO_LOOK, BLOOD_LOOK, TOMB_LOOK, WYRM_LOOK, DIGGER_LOOK, VAMPIRE_LOOK];

/** The soul bolt's orb and burst: green soul fire with bone-white flecks. */
export const SOUL_SPELL: SpellColors = { core: SOUL_CORE, hot: SOUL_HOT, mid: SOUL_MID, deep: SOUL_DEEP, accent: [248, 242, 218], hollow: true };
/** The blood lance's: white-hot pink to deep crimson. */
export const BLOOD_SPELL: SpellColors = { core: BLOOD_CORE, hot: BLOOD_HOT, mid: BLOOD_MID, deep: BLOOD_DEEP, accent: [255, 200, 200] };
/** The tomb king's: blue soul fire flecked with gold. */
export const TOMB_SPELL: SpellColors = { core: TOMB_CORE, hot: TOMB_HOT, mid: TOMB_MID, deep: TOMB_DEEP, accent: [255, 214, 120], hollow: true };
/** The wyrmblood's: a molten drop spitting sparks. */
export const WYRM_SPELL: SpellColors = { core: WYRM_CORE, hot: WYRM_HOT, mid: WYRM_MID, deep: WYRM_DEEP, accent: [255, 240, 180], flame: true };
/** The gravedigger's: sickly lantern green, flecked with grave dirt. */
export const DIGGER_SPELL: SpellColors = { core: DIG_CORE, hot: DIG_HOT, mid: DIG_MID, deep: DIG_DEEP, accent: [150, 110, 72], hollow: true };
/** The vampire lord's: dark blood, little bats wheeling round it. */
export const VAMPIRE_SPELL: SpellColors = { core: VAMP_CORE, hot: VAMP_HOT, mid: VAMP_MID, deep: VAMP_DEEP, accent: [255, 150, 160], bats: true };

/** The look being drawn; set by buildNecroFrames. */
let S: NecroLook = NECRO_LOOK;

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

// ---------------------------------------------------------------------------
// The staff

/** From the grip towards the staff's head. */
function staffDir(view: View, tilt: number): [number, number] {
  if (view === 'side') {
    const a = tilt * 1.35;
    return [-Math.sin(a), -Math.cos(a)];
  }
  const a = tilt * 0.75;
  return [Math.sin(a), -Math.cos(a)];
}

/** Where the staff's head sits for a pose (the skull, or the caged orb). */
function staffHead(view: View, p: Pose, fb: Placed): [number, number] {
  const [ux, uy] = staffDir(view, p.tilt);
  return [fb.x + ux * 14.6, fb.y + uy * 14.6];
}

/** Soul fire or blood light: a small cross of it, the arms growing with `k`. */
function flareAt(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.light;
  c.spark(x, y, core, k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + dx, y + dy, hot, 0.7 * k);
  if (k > 0.6) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [1, -1], [-1, 1]]) c.spark(x + dx, y + dy, mid, 0.45 * k);
}

/**
 * The staff in the hand: a gnarled shaft through the grip, and at its head a
 * skull burning with soul fire (or, for the blood mage, an orb of blood held
 * in a cage of bone prongs).
 */
function drawStaff(c: PixelCanvas, view: View, p: Pose, fb: Placed, bias = 0): void {
  const [ux, uy] = staffDir(view, p.tilt);
  const top = 13;
  const bot = 9.5;
  c.part();
  const shaft = S.style === 'tomb' ? LAPIS : S.style === 'digger' ? ASH_WOOD : S.style === 'vampire' ? CAPE : GRAVE_WOOD;
  if (S.style === 'digger') {
    // A spade's long ash handle, a little thinner than a staff, ending in a D-grip at the heel.
    c.capsule(fb.x - ux * bot, fb.y - uy * bot, fb.x + ux * 9.6, fb.y + uy * 9.6, 0.6, 0.65, shaft, { bias });
  } else c.capsule(fb.x - ux * bot, fb.y - uy * bot, fb.x + ux * top, fb.y + uy * top, 0.7, 0.8, shaft, { bias });
  if (S.style === 'tomb' || S.style === 'vampire') {
    // Gold bands round a lapis shaft, or silver round black lacquer.
    c.part();
    for (const t of S.style === 'tomb' ? [-5, 5.5, 9] : [-5]) c.px(fb.x + ux * t, fb.y + uy * t, S.style === 'tomb' ? GOLD : SILVER, sphere(0, -0.3), { bias });
  } else if (S.style === 'digger') {
    spadeGrip(c, fb.x - ux * bot, fb.y - uy * bot, ux, uy, bias);
  } else {
    // Knots along the shaft.
    for (const t of [-5, 5.5, 9]) c.shade(fb.x + ux * t + 0.5, fb.y + uy * t, 1);
  }
  const [hx, hy] = staffHead(view, p, fb);
  const glow = 0.35 + p.flare * 0.65;
  if (S.style === 'tomb') {
    ankh(c, hx, hy, ux, uy, p, bias);
    return;
  }
  if (S.style === 'wyrm') {
    talonOrb(c, hx, hy, ux, uy, p, bias);
    return;
  }
  if (S.style === 'digger') {
    spadeBlade(c, fb.x + ux * 9.6, fb.y + uy * 9.6, ux, uy, p, bias);
    return;
  }
  if (S.style === 'vampire') {
    batOrb(c, hx, hy, ux, uy, p, bias);
    return;
  }
  if (S.blood) {
    // Bone prongs curling up round the orb.
    c.part();
    for (const s of [-1, 1]) {
      c.px(hx + s * 2.1, hy + 1.2, BONE, sphere(s * 0.6, 0.2));
      c.px(hx + s * 2.4, hy, BONE, sphere(s * 0.8, -0.1));
      c.px(hx + s * 2.0, hy - 1.3, BONE, sphere(s * 0.5, -0.5));
      c.px(hx + s * 1.2, hy - 2.2, BONE, sphere(s * 0.3, -0.8), { bias: 1 });
    }
    c.part();
    c.ellipse(hx, hy, 1.75, 1.75, BLOOD_GEM, { glow: 0.55 + p.flare * 0.45 });
    c.spark(hx - 0.6, hy - 0.6, BLOOD_CORE, 0.6 * glow);
    // A drip hanging from it, now and then.
    if (p.tick % 3 === 1) c.spark(hx, hy + 2.4, BLOOD_MID, 0.6);
    flareAt(c, hx, hy, p.flare);
    return;
  }
  // The skull, seen from the front, the side or behind.
  c.part();
  c.ellipse(hx, hy, 2.05, 1.85, BONE);
  c.part();
  c.shape(Math.round(hy + 1.2), Math.round(hy + 1.2), () => (view === 'side' ? [hx - 2.1, hx + 0.6] : [hx - 1.3, hx + 1.3]), BONE, (_x, _y, t) => cyl(t, 0.3), { bias: -1 });
  const [core, hot, mid, deep] = S.light;
  const sockets: [number, number][] = view === 'down' ? [[hx - 1.2, hy], [hx + 0.6, hy]] : view === 'side' ? [[hx - 1.6, hy]] : [];
  for (const [x, y] of sockets) {
    c.px(x, y, NECRO_INNER);
    c.spark(x, y, hot, glow);
  }
  if (view !== 'up') for (const x of view === 'side' ? [hx - 2, hx - 1] : [hx - 1, hx, hx + 1]) c.shade(x, Math.round(hy + 1.2), (Math.round(x) & 1) === 0 ? -1 : 0);
  // Soul fire licking up from the crown, flickering.
  const flick = [0, 1, 0, -1, 1, 0][p.tick % 6];
  const tall = 3 + Math.round(p.flare * 2);
  for (let i = 0; i < tall; i++) {
    const y = hy - 2.2 - i;
    const x = hx + (i > 0 ? (((i + p.tick) & 1) === 0 ? flick * 0.6 : 0) : 0);
    const col = i === 0 ? core : i < tall - 2 ? hot : i < tall - 1 ? mid : deep;
    c.spark(x, y, col, (1 - i / (tall + 1)) * (0.6 + glow * 0.4));
    if (i < tall - 2) c.spark(x + (i & 1 ? 1 : -1), y + 0.5, mid, 0.35 * glow);
  }
  flareAt(c, hx, hy - 1, p.flare);
}

/** Soul fire licking up from (x, y), flickering with the frame, taller as the staff flares. */
function soulFlame(c: PixelCanvas, x0: number, y0: number, p: Pose, glow: number): void {
  const [core, hot, mid, deep] = S.light;
  const flick = [0, 1, 0, -1, 1, 0][p.tick % 6];
  const tall = 3 + Math.round(p.flare * 2);
  for (let i = 0; i < tall; i++) {
    const y = y0 - i;
    const x = x0 + (i > 0 ? (((i + p.tick) & 1) === 0 ? flick * 0.6 : 0) : 0);
    const col = i === 0 ? core : i < tall - 2 ? hot : i < tall - 1 ? mid : deep;
    c.spark(x, y, col, (1 - i / (tall + 1)) * (0.6 + glow * 0.4));
    if (i < tall - 2) c.spark(x + (i & 1 ? 1 : -1), y + 0.5, mid, 0.35 * glow);
  }
}

/** The tomb king's ankh: a gold cross with a loop for a head, blue soul fire burning inside the loop and licking up from it. */
function ankh(c: PixelCanvas, hx: number, hy: number, ux: number, uy: number, p: Pose, bias: number): void {
  const vx = -uy;
  const vy = ux;
  const glow = 0.35 + p.flare * 0.65;
  // The stem up from the shaft, and the crossbar.
  c.part();
  c.capsule(hx - ux * 1.8, hy - uy * 1.8, hx, hy, 0.65, 0.65, GOLD, { bias });
  c.part();
  c.capsule(hx - vx * 2.3, hy - vy * 2.3, hx + vx * 2.3, hy + vy * 2.3, 0.6, 0.6, GOLD, { bias });
  // The loop: a ring of gold, open in the middle.
  const lx = hx + ux * 2.3;
  const ly = hy + uy * 2.3;
  c.part();
  for (let y = Math.floor(ly - 3); y <= Math.ceil(ly + 3); y++) {
    for (let x = Math.floor(lx - 3); x <= Math.ceil(lx + 3); x++) {
      const dx = x + 0.5 - lx;
      const dy = y + 0.5 - ly;
      const along = dx * ux + dy * uy;
      const across = dx * vx + dy * vy;
      const d = Math.hypot(across / 1.75, along / 2.1);
      if (d > 0.52 && d <= 1) c.px(x, y, GOLD, sphere(across / 1.75, -along / 2.1), { bias });
    }
  }
  // Fire in the loop, and rising from its top.
  const [core, hot] = S.light;
  c.spark(lx, ly, core, 0.55 + glow * 0.45);
  c.spark(lx + ux * 0.8, ly + uy * 0.8, hot, 0.5 * glow);
  soulFlame(c, lx + ux * 2.4, ly + uy * 2.4 - 0.2, p, glow);
  flareAt(c, lx, ly, p.flare);
}

/** The wyrmblood's staff head: black talons curling up round a molten orb, a drop of it spitting now and then. */
function talonOrb(c: PixelCanvas, hx: number, hy: number, ux: number, uy: number, p: Pose, bias: number): void {
  const vx = -uy;
  const vy = ux;
  const at = (a: number, b: number): [number, number] => [hx + ux * a + vx * b, hy + uy * a + vy * b];
  c.part();
  for (const s of [-1, 1]) {
    const knuckle = at(-1.6, s * 1.4);
    const mid = at(-0.2, s * 2.3);
    const up = at(1.3, s * 2.1);
    const tip = at(2.3, s * 1.0);
    c.capsule(knuckle[0], knuckle[1], mid[0], mid[1], 0.75, 0.6, HORN, { bias });
    c.capsule(mid[0], mid[1], up[0], up[1], 0.6, 0.5, HORN, { bias });
    c.px(tip[0], tip[1], HORN, sphere(s * 0.3, -0.7), { bias: bias + 1 });
  }
  c.part();
  c.ellipse(hx, hy, 1.75, 1.75, WYRM_GEM, { glow: 0.6 + p.flare * 0.4 });
  const glow = 0.35 + p.flare * 0.65;
  c.spark(hx - 0.6, hy - 0.6, S.light[0], 0.6 * glow);
  // A molten drop falls, or a spark leaps, now and then.
  if (p.tick % 3 === 1) c.spark(hx, hy + 2.4, S.light[2], 0.7);
  if (p.tick % 4 === 2) c.spark(hx + 1, hy - 2.6, S.light[1], 0.6);
  flareAt(c, hx, hy, p.flare);
}

/** The D-grip at the spade's heel: a small iron-capped loop across the handle's end. */
function spadeGrip(c: PixelCanvas, x: number, y: number, ux: number, uy: number, bias: number): void {
  const vx = -uy;
  const vy = ux;
  c.part();
  c.capsule(x - vx * 1.2 - ux * 0.6, y - vy * 1.2 - uy * 0.6, x + vx * 1.2 - ux * 0.6, y + vy * 1.2 - uy * 0.6, 0.55, 0.55, ASH_WOOD, { bias });
  c.px(x - ux * 0.4, y - uy * 0.4, IRON, sphere(0, 0.3), { bias });
}

/**
 * The spade's head, carried blade up: an iron socket over the handle, the
 * blade's shoulders where he sets his boot, and a long blade worn bright at
 * its edge, three grave runes cut down its middle that burn green as he casts.
 */
function spadeBlade(c: PixelCanvas, sx: number, sy: number, ux: number, uy: number, p: Pose, bias: number): void {
  const vx = -uy;
  const vy = ux;
  const glow = 0.3 + p.flare * 0.7;
  const at = (a: number, b: number): [number, number] => [sx + ux * a + vx * b, sy + uy * a + vy * b];
  // The socket, a hand's width of iron round the handle's end.
  c.part();
  c.capsule(...at(-0.4, 0), ...at(1.4, 0), 0.75, 0.9, IRON, { bias });
  // The blade: square shoulders, slightly tapering sides, a rounded worn tip.
  c.part();
  poly(c, [at(1.4, -2.3), at(1.4, 2.3), at(5.6, 1.9), at(6.6, 0.9), at(6.9, 0), at(6.6, -0.9), at(5.6, -1.9)], IRON, (_x, _y, t, u) => sphere(t * 0.55, u * 0.4 - 0.45, 1), { bias });
  // Rust along one side, a bright worn edge at the tip.
  for (const [a, b] of [[2.4, -1.6], [3.6, -1.7], [4.8, -1.4]] as const) c.shade(...at(a, b), -1);
  c.part();
  c.px(...at(6.5, 0.4), IRON, sphere(0, -0.9), { bias: bias + 2 });
  // Runes: three marks down the blade's spine, lit with the lantern's fire.
  const [core, hot, mid] = S.light;
  for (const [a, k] of [[2.6, 0], [3.9, 1], [5.1, 2]] as const) {
    const [rx, ry] = at(a, 0);
    c.spark(rx, ry, k === 1 ? core : hot, 0.35 + glow * 0.55);
  }
  c.spark(...at(3.25, 0), mid, 0.25 * glow);
  c.spark(...at(4.5, 0), mid, 0.25 * glow);
  if (p.flare > 0) {
    // The whole blade wreathed in it for the cast.
    for (const [a, b] of [[2, -2.4], [4, -2.3], [6, -1.5], [2, 2.4], [4, 2.3], [6, 1.5], [7.6, 0]] as const) c.spark(...at(a, b), (a + b) % 2 ? mid : hot, 0.45 * p.flare);
    flareAt(c, ...at(4, 0), p.flare * 0.8);
  }
}

/** The vampire's cane head: a ruby held between two silver bat wings, a drop of blood welling under it now and then. */
function batOrb(c: PixelCanvas, hx: number, hy: number, ux: number, uy: number, p: Pose, bias: number): void {
  const vx = -uy;
  const vy = ux;
  const at = (a: number, b: number): [number, number] => [hx + ux * a + vx * b, hy + uy * a + vy * b];
  const spread = p.flare * 0.8;
  // A silver collar under the ruby.
  c.part();
  c.capsule(...at(-2.6, 0), ...at(-1.4, 0), 0.75, 1.0, SILVER, { bias });
  // The wings: a bony top edge rising out to a claw, the membrane hanging in two scallops below it.
  c.part();
  for (const s of [-1, 1]) {
    poly(c, [at(-0.6, s * 1.1), at(1.0 + spread, s * (2.4 + spread)), at(1.9 + spread, s * (3.4 + spread)), at(0.2 + spread * 0.5, s * (3.2 + spread)), at(-0.4, s * 2.6), at(-1.3, s * 2.6), at(-1.6, s * 1.6)], CAPE, (_x, _y, t, u) => sphere(t * 0.6 * s, u * 0.6 - 0.45, 1), { bias });
  }
  for (const s of [-1, 1]) {
    // Silver along the wing's bony top edge, and its claw.
    c.px(...at(0.2 + spread * 0.5, s * (1.8 + spread * 0.5)), SILVER, sphere(s * 0.3, -0.7), { bias });
    c.px(...at(1.9 + spread, s * (3.4 + spread)), SILVER, sphere(s * 0.4, -0.8), { bias: bias + 1 });
  }
  c.part();
  c.ellipse(hx, hy, 1.7, 1.7, RUBY, { glow: 0.55 + p.flare * 0.45 });
  const glow = 0.35 + p.flare * 0.65;
  c.spark(hx - 0.6, hy - 0.6, S.light[0], 0.6 * glow);
  if (p.tick % 3 === 1) c.spark(...at(-3.2, 0.4), S.light[2], 0.65);
  flareAt(c, hx, hy, p.flare);
}

/** The gravedigger's lantern hanging at his hip: an iron cap and ring, green-lit glass, the soul flame flickering inside. */
function lantern(c: PixelCanvas, x: number, y: number, p: Pose, swing = 0): void {
  const lx = Math.round(x + swing);
  const ly = Math.round(y);
  const [core, hot, mid, deep] = S.light;
  c.part();
  // The hook from the belt, the ring, the cap.
  c.px(Math.round(x), ly - 2, IRON, sphere(0, -0.5));
  c.px(lx, ly - 1, IRON, sphere(0, -0.6));
  c.shape(ly, ly, () => [lx - 1, lx + 2], IRON, (_x, _y, t) => cyl(t, -0.4));
  // The glass, framed by iron bars, and the base.
  c.part();
  c.shape(ly + 1, ly + 2, () => [lx - 1, lx + 2], LANTERN, (_x, _y, t) => cyl(t, 0.1));
  c.px(lx - 1, ly + 1, IRON, sphere(-0.6, 0));
  c.px(lx + 1, ly + 1, IRON, sphere(0.6, 0));
  c.px(lx - 1, ly + 2, IRON, sphere(-0.6, 0.2));
  c.px(lx + 1, ly + 2, IRON, sphere(0.6, 0.2));
  c.part();
  c.shape(ly + 3, ly + 3, () => [lx - 1, lx + 2], IRON, (_x, _y, t) => cyl(t, 0.5));
  // The flame inside, and its sickly light spilling round.
  const flick = [1, 0.75, 0.95, 0.65, 1, 0.8][p.tick % 6];
  c.spark(lx, ly + 2, core, 0.8 * flick);
  c.spark(lx, ly + 1, hot, 0.7 * flick);
  for (const [dx, dy] of [[-2, 1], [2, 1], [-2, 2], [2, 2], [0, 4], [-1, 4], [1, 4]]) c.spark(lx + dx, ly + dy, dy === 4 ? deep : mid, 0.28 * flick);
}

// ---------------------------------------------------------------------------
// Parts

/**
 * A bell-sleeved arm from the shoulder, bent at the elbow (towards `hint`),
 * the sleeve widening to a trimmed cuff and a bony hand; the casting hand
 * fills with light.
 */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], palm: number, bias = 0): void {
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
  if (S.style === 'digger') {
    rolledSleeve(c, sx, sy, ex, ey, fx, fy, palm, bias);
    return;
  }
  // The sleeve stops a little short of the hand.
  const k = 0.78;
  const wx = ex + (fx - ex) * k;
  const wy = ey + (fy - ey) * k;
  c.part();
  c.capsule(sx, sy, ex, ey, 1.6, 1.45, S.robe, { bias });
  c.part();
  c.capsule(ex, ey, wx, wy, 1.45, 2.0, S.robe, { bias });
  // A thin trimmed rim round the cuff's mouth.
  const [nx, ny] = [-(fy - ey), fx - ex];
  const nl = Math.hypot(nx, ny) || 1;
  c.part();
  c.line(wx - (nx / nl) * 1.6, wy - (ny / nl) * 1.6, wx + (nx / nl) * 1.6, wy + (ny / nl) * 1.6, S.trim, () => sphere(0, -0.2), { bias });
  c.part();
  c.ellipse(fx, fy, 1.15, 1.1, S.skin, { bias });
  if (palm > 0) {
    const [core, hot, mid] = S.light;
    c.spark(fx, fy, core, palm);
    c.spark(fx - 1, fy, hot, 0.6 * palm);
    c.spark(fx + 1, fy, hot, 0.6 * palm);
    c.spark(fx, fy - 1, hot, 0.6 * palm);
    if (palm > 0.5) for (const [ox, oy] of [[-2, -1], [2, -1], [0, -2], [-1, 1], [1, 1]]) c.spark(fx + ox, fy + oy, mid, 0.4 * palm);
  }
}

/** The casting palm filling with light. */
function palmLight(c: PixelCanvas, fx: number, fy: number, palm: number): void {
  if (palm <= 0) return;
  const [core, hot, mid] = S.light;
  c.spark(fx, fy, core, palm);
  c.spark(fx - 1, fy, hot, 0.6 * palm);
  c.spark(fx + 1, fy, hot, 0.6 * palm);
  c.spark(fx, fy - 1, hot, 0.6 * palm);
  if (palm > 0.5) for (const [ox, oy] of [[-2, -1], [2, -1], [0, -2], [-1, 1], [1, 1]]) c.spark(fx + ox, fy + oy, mid, 0.4 * palm);
}

/** The gravedigger's arm: a plain coat sleeve rolled up past the elbow, a thick roll of cloth, a bare weathered forearm and a broad hand. */
function rolledSleeve(c: PixelCanvas, sx: number, sy: number, ex: number, ey: number, fx: number, fy: number, palm: number, bias: number): void {
  const rx = ex + (fx - ex) * 0.22;
  const ry = ey + (fy - ey) * 0.22;
  c.part();
  c.capsule(sx, sy, ex, ey, 1.6, 1.45, S.robe, { bias });
  c.part();
  c.capsule(ex, ey, fx, fy, 0.85, 0.8, S.skin, { bias });
  c.part();
  c.capsule(ex, ey, rx, ry, 1.45, 1.55, S.robe, { bias });
  // The roll's lit edge.
  c.shade(rx, ry - 1, 1);
  c.part();
  c.ellipse(fx, fy, 1.2, 1.15, S.skin, { bias });
  palmLight(c, fx, fy, palm);
}

/** A pointed shoe peeking out from under the hem. */
function foot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  const m = S.feet ?? BOOT;
  if (side) c.ellipse(x - 0.4, y, 2.1, 1.1, m, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.5, 1.2, m, { flatten: 0.8, bias });
}

/** The robe's outline: narrow at the shoulders, flaring to the hem. */
function robeWidth(u: number, chest: number, flare: number): number {
  return chest + u * u * flare;
}

/** The front opening down from the belt: the dark under-robe, edged in trim. */
function opening(c: PixelCanvas, cx: number, waist: number, hem: number, sway: number): void {
  c.part();
  for (let y = waist + 1; y <= hem; y++) {
    const u = (y - waist) / Math.max(1, hem - waist);
    const w = 0.5 + u * 1.3;
    const x0 = cx - w + u * u * sway;
    const x1 = cx + w + u * u * sway;
    for (let x = Math.round(x0); x < Math.round(x1); x++) if (c.filled(x, y)) c.px(x, y, S.inner, sphere(0, 0.2), { bias: -1 });
    if (c.filled(Math.round(x0) - 1, y)) c.px(Math.round(x0) - 1, y, S.trim, sphere(-0.3, 0));
    if (c.filled(Math.round(x1), y)) c.px(Math.round(x1), y, S.trim, sphere(0.3, 0));
  }
}

/** Trim along the hem's bottom row. */
function hemTrim(c: PixelCanvas, hem: number, x0: number, x1: number): void {
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (c.filled(x, hem)) c.px(x, hem, S.trim, sphere(0, 0.4));
}

/** The necromancer's mantle: a collar of bone plates draped over the shoulders, a small skull at its clasp. */
function boneMantle(c: PixelCanvas, cx: number, U: number, n: number, span: number, clasp: boolean): void {
  c.part();
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const x = cx + k * span;
    const y = 15.2 + U + (1 - k * k) * 1.3;
    c.ellipse(x, y, 0.95, 1.35, BONE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + k * 0.3, dy * 0.8 - 0.2, 1) });
  }
  if (!clasp) return;
  c.part();
  c.ellipse(cx, 17.4 + U, 1.6, 1.35, BONE);
  c.px(cx - 1, 17 + U, NECRO_INNER);
  c.px(cx, 17 + U, NECRO_INNER);
  c.spark(cx - 1, 17 + U, S.light[2], 0.6);
  c.spark(cx, 17 + U, S.light[2], 0.6);
}

/** The blood mage's high collar, standing up behind the head, gold along its rim. */
function highCollar(c: PixelCanvas, cx: number, U: number, l: number, r: number): void {
  const top = 11 + U;
  c.part();
  c.shape(top, 16 + U, (y) => {
    const u = (y - top) / 5;
    return [cx - l * (1 - u * 0.45), cx + r * (1 - u * 0.45)];
  }, BLOOD_INNER, (_x, _y, t, u) => sphere(-t * 0.8, u * 0.6 - 0.1, 1));
  for (let x = Math.floor(cx - l); x <= Math.ceil(cx + r); x++) if (c.filled(x, top)) c.px(x, top, GOLD, sphere(0, -0.4));
}

/** The hood's cowl, draped over the shoulders from the collar. */
function cowl(c: PixelCanvas, cx: number, U: number, l: number, r: number): void {
  const top = 14 + U;
  c.part();
  c.shape(top, top + 3, (y) => {
    const u = (y - top) / 3;
    const k = Math.sqrt(u) * 0.75 + 0.25;
    return [cx - l * k, cx + r * k];
  }, S.robe, (_x, _y, t, u) => sphere(t * 0.95, u - 0.6, 1));
}

/** The belt: gold for the tomb king, worn leather for the gravedigger, else the under-robe's cloth. */
function beltMat(): Material {
  if (S.style === 'tomb') return GOLD;
  if (S.style === 'digger') return DIG_LEATHER;
  return S.inner;
}

/** The stone at the belt's clasp: bone, the blood gem, a turquoise scarab, a molten stone, a brass buckle or a ruby. */
function clasp(): Material {
  if (S.style === 'wyrm') return WYRM_GEM;
  if (S.style === 'digger') return BRASS;
  if (S.style === 'vampire') return RUBY;
  if (S.style === 'tomb') return TURQ;
  return S.blood ? BLOOD_GEM : BONE;
}

/**
 * The cloth's own texture over rows y0..y1: the tomb king's linen wound
 * round him in faint diagonal wraps, the wyrmblood's robe laid with scales.
 */
function robeTexture(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number): void {
  if (S.style === 'tomb') {
    for (let y = Math.floor(y0); y <= y1; y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        if (!c.filled(x, y)) continue;
        const k = (((x + y * 2) % 5) + 5) % 5;
        if (k === 0) c.shade(x, y, -1);
        else if (k === 1 && ((x + y) & 3) === 0) c.shade(x, y, 1);
      }
    }
  } else if (S.style === 'wyrm') {
    // Rows of scales, each a small dark arc, every other row set half a scale over.
    for (let sy = Math.floor(y0); sy <= y1; sy += 3) {
      const shift = ((sy - Math.floor(y0)) / 3) & 1 ? 2 : 0;
      for (let sx = Math.floor(x0) + shift; sx <= x1; sx += 4) {
        if (!c.filled(sx, sy)) continue;
        c.shade(sx - 1, sy, -1);
        c.shade(sx + 1, sy, -1);
        c.shade(sx, sy + 1, -1);
        c.shade(sx, sy - 1, 1);
      }
    }
  }
}

/** Fill rows y0..y1 between `edges`, the material changing every row: stripes of `a` and `b`. */
function striped(c: PixelCanvas, y0: number, y1: number, edges: (y: number) => [number, number] | null, a: Material, b: Material, normal: NormalFn, bias = 0): void {
  for (let y = Math.round(y0); y <= Math.round(y1); y++) c.shape(y, y, edges, (y & 1) === 0 ? a : b, normal, { bias });
}

/** The tomb king's apron down the front of the robe: bands of gold and lapis, widening to the hem. */
function apron(c: PixelCanvas, cx: number, waist: number, hem: number, sway: number): void {
  c.part();
  const edges = (y: number): [number, number] => {
    const u = (y - waist) / Math.max(1, hem - waist);
    const w = 1.5 + u * 1.5;
    const s = u * u * sway;
    return [cx - w + s, cx + w + s];
  };
  striped(c, waist + 1, hem - 1, edges, GOLD, LAPIS, (_x, _y, t) => cyl(t, 0.2));
}

/** The broad collar over his shoulders: rings of gold, lapis-and-turquoise beads, and gold, hanging from the throat. */
function usekh(c: PixelCanvas, cx: number, cy: number): void {
  c.part();
  for (let y = Math.floor(cy); y <= Math.ceil(cy + 5.2); y++) {
    for (let x = Math.floor(cx - 6.4); x <= Math.ceil(cx + 6.4); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dy < 0) continue;
      const d = Math.hypot(dx, dy / 0.8);
      if (d < 2.6 || d > 6.2) continue;
      const ring = Math.min(2, Math.floor((d - 2.6) / 1.2));
      const m = ring === 1 ? (((x + y) & 1) === 0 ? LAPIS : TURQ) : GOLD;
      c.px(x, y, m, sphere((dx / 6.2) * 0.8, (dy / 5) * 0.6 - 0.35, 1));
    }
  }
}

/** A cobra rearing from the brow: a turquoise head on a gold hood. */
function uraeus(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.px(x, y + 1, GOLD, sphere(0, -0.5), { bias: 1 });
  c.px(x, y, TURQ, sphere(0, -0.6), { bias: 1 });
  c.spark(x, y, S.light[1], 0.35);
}

/** The tomb king from the front: the striped headdress with its flaps falling to his chest, the gold death mask, kohl-rimmed burning eyes, the plaited beard. */
function headTombDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const nrm: NormalFn = (_x, _y, t, u) => sphere(t * 0.85, u * 0.7 - 0.35, 1);
  // The cloth spreading wide behind the face, and the flaps falling in front of the shoulders.
  c.part();
  striped(c, 9 + U, 12.5 + U, () => [cx - 5.2, cx + 5.2], GOLD, LAPIS, nrm);
  c.part();
  for (const sd of [-1, 1]) {
    striped(c, 12.5 + U, 17.6 + U, (y) => {
      const u = (y - 12.5 - U) / 5;
      const inner = cx + sd * (2.3 + u * 0.3);
      const outer = cx + sd * (5.2 - u * 0.9);
      return sd < 0 ? [outer, inner] : [inner, outer];
    }, GOLD, LAPIS, (_x, _y, t, u) => sphere(t * 0.6, u * 0.5 - 0.1, 1));
  }
  // The crown of the headdress, rounded over the brow.
  c.part();
  striped(c, 6.6 + U, 9.6 + U, (y) => {
    const u = (y - 6.6 - U) / 3;
    const hw = 2.4 + Math.sqrt(Math.max(0, u)) * 2.4;
    return [cx - hw, cx + hw];
  }, LAPIS, GOLD, nrm);
  // The mask.
  c.part();
  c.ellipse(cx - 0.2, 12.7 + U, 2.6, 2.7, GOLD, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.8 - 0.1, 1) });
  c.part();
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [cx - 3.4, cx + 3.2], GOLD, (_x, _y, t) => cyl(t, 0.3), { bias: 1 });
  // Kohl sweeping out from the eyes, a thin mouth.
  c.part();
  c.px(cx - 3, 12 + U, KOHL);
  c.px(cx + 2, 12 + U, KOHL);
  c.shade(cx - 1, 14 + U, -1);
  c.shade(cx, 14 + U, -1);
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
  // The plaited beard, banded.
  c.part();
  striped(c, 15 + U, 17 + U, (y) => (y < 16.5 + U ? [cx - 1.4, cx + 0.8] : [cx - 1, cx + 0.4]), LAPIS, GOLD, (_x, _y, t) => cyl(t, 0.2));
  uraeus(c, cx - 0.4, 8 + U);
}

/** The tomb king from behind: the headdress gathered into a banded braid down his back. */
function headTombUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const nrm: NormalFn = (_x, _y, t, u) => sphere(t * 0.85, u * 0.7 - 0.3, 1);
  c.part();
  striped(c, 6.6 + U, 12.6 + U, (y) => {
    const u = (y - 6.6 - U) / 6;
    const hw = 2.4 + Math.sqrt(Math.max(0, u)) * 2.9;
    return [cx - hw, cx + hw];
  }, LAPIS, GOLD, nrm);
  // The flaps' edges show past his shoulders.
  c.part();
  for (const sd of [-1, 1]) striped(c, 13 + U, 15 + U, () => (sd < 0 ? [cx - 5.2, cx - 3.6] : [cx + 3.6, cx + 5.2]), GOLD, LAPIS, nrm);
  // The braid.
  c.part();
  c.capsule(cx, 12 + U, cx + p.sway * 0.4, 18.4 + U, 1.35, 0.7, LAPIS);
  c.part();
  for (const y of [13, 15, 17]) c.shape(Math.round(y + U), Math.round(y + U), () => [cx - 1.3 + (y - 12) * 0.06, cx + 1.3 - (y - 12) * 0.12], GOLD, (_x, _y, t) => cyl(t, 0.2));
}

/** The tomb king in profile, facing left: the headdress flaring back, a flap over his shoulder, the mask, the beard jutting. */
function headTombSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  const nrm: NormalFn = (_x, _y, t, u) => sphere(t * 0.85 + 0.15, u * 0.7 - 0.35, 1);
  // The braid behind, then the cloth.
  c.part();
  c.capsule(hx + 2.8, 12 + U, hx + 3.6 + p.sway * 0.4, 17.4 + U, 1.2, 0.6, LAPIS);
  c.part();
  for (const y of [14, 16]) c.px(hx + 3.2 + (y - 12) * 0.1 + p.sway * 0.2, y + U, GOLD, sphere(0.3, 0));
  c.part();
  striped(c, 6.6 + U, 12.6 + U, (y) => {
    const u = (y - 6.6 - U) / 6;
    return [hx - 3.4 + Math.max(0, 0.6 - u) * 1.4, hx + 2.4 + u * 1.8];
  }, LAPIS, GOLD, nrm);
  // The mask turned to the left, the gold band across the brow.
  c.part();
  c.ellipse(hx - 1.8, 12.8 + U, 2.0, 2.4, GOLD, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85 - 0.2, dy * 0.8 - 0.1, 1) });
  c.part();
  c.px(hx - 4, 12.6 + U, GOLD, sphere(-0.7, -0.1), { bias: 1 });
  c.part();
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [hx - 3.9, hx + 1.2], GOLD, (_x, _y, t) => cyl(t, 0.3), { bias: 1 });
  c.part();
  c.px(hx - 2, 12 + U, KOHL);
  eyes(c, [[hx - 3, 12 + U]], p.blink);
  c.shade(hx - 3, 14 + U, -1);
  // The flap falling over his shoulder, behind the jaw.
  c.part();
  striped(c, 11 + U, 17.4 + U, (y) => {
    const u = (y - 11 - U) / 6.4;
    return [hx - 0.6 + u * 0.2, hx + 1.4 - u * 0.2];
  }, GOLD, LAPIS, (_x, _y, t) => sphere(t * 0.6, 0.1, 1));
  // The beard, jutting down and forward.
  c.part();
  striped(c, 15 + U, 17 + U, (y) => {
    const k = y - 15 - U;
    return [hx - 3.6 - k * 0.3, hx - 2.2 - k * 0.3];
  }, LAPIS, GOLD, (_x, _y, t) => cyl(t, 0.2));
  uraeus(c, hx - 3.4, 8 + U);
}

/**
 * The wyrmblood's folded wings: a bone arm from the shoulder up to a clawed
 * wrist above the head, dark membrane falling from it to a scalloped edge,
 * a finger bone or two through it; `spread` opens them as he casts.
 */
function wings(c: PixelCanvas, view: View, cx: number, U: number, L: number, flare: number): void {
  const spread = flare * 1.4;
  const one = (root: [number, number], wrist: [number, number], ends: [number, number][], s: number, bias: number) => {
    // The membrane, the edge between two finger tips pulled up into a scallop.
    const edge: [number, number][] = [root, wrist];
    ends.forEach((e, i) => {
      edge.push(e);
      const n = ends[i + 1];
      if (n) edge.push([(e[0] + n[0]) / 2, (e[1] + n[1]) / 2 - 2]);
    });
    c.part();
    poly(c, edge, WING, (_x, _y, t, u) => sphere(t * 0.5 * s, u * 0.6 - 0.35, 1), { bias });
    // Ember veins, faintly alight.
    for (const e of ends.slice(0, -1)) {
      for (let k = 0.25; k < 0.9; k += 0.2) c.spark(wrist[0] + (e[0] - wrist[0]) * k + s * 0.6, wrist[1] + (e[1] - wrist[1]) * k, S.light[3], 0.3);
    }
    // The finger bones, the arm and the claw.
    c.part();
    for (const e of ends.slice(0, -1)) c.line(wrist[0], wrist[1], e[0], e[1], HORN, () => sphere(s * 0.3, -0.2), { bias });
    c.part();
    c.capsule(root[0], root[1], wrist[0], wrist[1], 0.9, 0.65, HORN, { bias });
    c.part();
    c.px(wrist[0] + s * 0.4, wrist[1] - 1.3, HORN, sphere(s * 0.3, -0.8), { bias: bias + 1 });
  };
  if (view === 'down') {
    for (const s of [-1, 1]) {
      one(
        [cx + s * 3.2, 16 + U],
        [cx + s * (7.4 + spread), 10.4 + U - spread * 0.8],
        [[cx + s * (8.6 + spread), 21 + L], [cx + s * (6.9 + spread * 0.6), 24.4 + L], [cx + s * 4.8, 25.4 + L]],
        s,
        -1,
      );
    }
  } else if (view === 'up') {
    for (const s of [-1, 1]) {
      one(
        [cx + s * 1.4, 15.6 + U],
        [cx + s * (7.0 + spread), 10.2 + U - spread * 0.8],
        [[cx + s * (7.8 + spread), 21.4 + L], [cx + s * (5.2 + spread * 0.5), 25 + L], [cx + s * 1.2, 25.6 + L]],
        s,
        0,
      );
    }
  } else {
    // Facing left: the far wing a little higher and in shade, the near one against his back.
    const hx = cx;
    one([hx + 0.4, 15 + U], [hx + 3.8 + spread, 9 + U - spread], [[hx + 5.6 + spread, 19.6 + L], [hx + 4.2, 23 + L], [hx + 1.2, 23.6 + L]], 1, -2);
    one([hx + 1.6, 15.5 + U], [hx + 5.4 + spread, 10 + U - spread * 0.8], [[hx + 7.0 + spread, 21 + L], [hx + 5.6 + spread * 0.5, 24.4 + L], [hx + 2.2, 25 + L]], 1, -1);
  }
}

/** A horn from the temple at (x, y), sweeping up and out to a glowing tip; `s` is the side, `back` sweeps it backwards (profile). */
function horn(c: PixelCanvas, x: number, y: number, s: number, back = false): void {
  const pts: [number, number, number][] = back
    ? [[x, y, 1.0], [x + 2.6, y - 2.4, 0.8], [x + 5.0, y - 2.8, 0.55], [x + 6.4, y - 1.6, 0.3]]
    : [[x, y, 1.1], [x + s * 2.2, y - 2.4, 0.9], [x + s * 2.6, y - 4.8, 0.6], [x + s * 1.8, y - 6.2, 0.35]];
  c.part();
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0, r0] = pts[i];
    const [x1, y1, r1] = pts[i + 1];
    c.capsule(x0, y0, x1, y1, r0, r1, HORN);
  }
  // Ridges along it, and embers at the tip.
  for (let i = 1; i < pts.length - 1; i++) c.shade(pts[i][0], pts[i][1], -1);
  const [tx, ty] = pts[pts.length - 1];
  c.spark(tx, ty, S.light[1], 0.5);
  c.spark(tx - (back ? 1 : s), ty + 1, S.light[2], 0.3);
}

/** The wyrmblood from the front: ash-dark hair swept back, scaled cheeks, coal eyes, horns rising from his brow. */
function headWyrmDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  c.part();
  c.ellipse(cx, 11.3 + U, 3.8, 3.7, ASH_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.capsule(cx - 3.3, 12 + U, cx - 3.7, 15.6 + U, 1.2, 0.8, ASH_HAIR);
  c.capsule(cx + 2.9, 12 + U, cx + 3.3, 15.6 + U, 1.2, 0.8, ASH_HAIR);
  c.part();
  c.ellipse(cx - 0.3, 12.8 + U, 2.5, 2.4, S.skin);
  // A widow's peak, swept back.
  c.part();
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [cx - 3, cx + 2.4], ASH_HAIR, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
  c.px(cx - 1, 11 + U, ASH_HAIR, sphere(0, 0.1));
  // Scales along the cheekbones, a hard mouth.
  c.part();
  c.px(cx - 3, 13 + U, OBSIDIAN, sphere(-0.6, 0.1));
  c.px(cx + 2, 13 + U, OBSIDIAN, sphere(0.6, 0.1));
  c.px(cx - 3, 14 + U, OBSIDIAN, sphere(-0.5, 0.4), { bias: -1 });
  c.spark(cx - 3, 13 + U, S.light[3], 0.35);
  c.shade(cx - 1, 14 + U, -1);
  c.shade(cx, 14 + U, -1);
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
  horn(c, cx - 2.8, 9.8 + U, -1);
  horn(c, cx + 2.4, 9.8 + U, 1);
}

/** The wyrmblood from behind: his hair over the nape, the horns sweeping up. */
function headWyrmUp(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.ellipse(cx, 11.3 + U, 3.8, 3.7, ASH_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  c.part();
  c.shape(13 + U, 16 + U, (y) => {
    const hw = 2.8 - (y - 13 - U) * 0.5;
    return [cx - hw, cx + hw];
  }, ASH_HAIR, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
  for (let y = 12 + U; y <= 15 + U; y++) c.shade(cx - 1 + ((y & 1) === 0 ? 0 : 2), y, -1);
  horn(c, cx - 2.6, 9.8 + U, -1);
  horn(c, cx + 2.6, 9.8 + U, 1);
}

/** The wyrmblood in profile, facing left: the horn sweeping back over his hair. */
function headWyrmSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  c.part();
  c.ellipse(hx + 0.5, 11.4 + U, 3.4, 3.6, ASH_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
  c.part();
  c.capsule(hx + 2.2, 12.5 + U, hx + 2.8 + p.sway * 0.3, 16 + U, 1.4, 0.8, ASH_HAIR);
  c.part();
  c.ellipse(hx - 1.4, 12.9 + U, 2.2, 2.3, S.skin);
  c.part();
  c.px(hx - 4, 12.6 + U, S.skin, sphere(-0.7, -0.1), { bias: 1 });
  c.shade(hx - 2, 14 + U, -1);
  c.part();
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [hx - 3.4, hx + 1], ASH_HAIR, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
  c.px(hx - 0.4, 11 + U, ASH_HAIR, sphere(0.3, 0.2));
  c.part();
  c.px(hx - 1, 13 + U, OBSIDIAN, sphere(0.2, 0.1));
  c.px(hx, 14 + U, OBSIDIAN, sphere(0.3, 0.3), { bias: -1 });
  c.spark(hx - 1, 13 + U, S.light[3], 0.35);
  eyes(c, [[hx - 3, 12 + U]], p.blink);
  horn(c, hx - 1.2, 9.8 + U, 1, true);
}

// ---------------------------------------------------------------------------
// The gravedigger

/**
 * His stovepipe hat, battered: a narrow brim curling up at its ends, a tall
 * crown leaning over (to the right from the front, back in profile) with a
 * dent in it and a dingy band. `x` is the crown's centre, the brim on row 10.
 */
function stovepipe(c: PixelCanvas, x: number, U: number, view: View): void {
  const side = view === 'side';
  const lean = side ? 0.22 : view === 'down' ? 0.12 : -0.12;
  const brim = Math.round(10 + U);
  c.part();
  c.shape(brim, brim, () => (side ? [x - 5.2, x + 3.4] : [x - 4.9, x + 4.5]), HAT, (_x, _y, t) => sphere(t * 0.9, 0.2, 1));
  // The brim's ends curl up.
  if (side) {
    c.px(x - 6, brim - 1, HAT, sphere(-0.6, -0.5));
    c.px(x + 3, brim - 1, HAT, sphere(0.6, -0.5), { bias: -1 });
  } else {
    c.px(x - 5, brim - 1, HAT, sphere(-0.7, -0.5));
    c.px(x + 4, brim - 1, HAT, sphere(0.7, -0.5));
  }
  // The crown, a little crooked, the top knocked in on one side.
  c.part();
  const top = Math.round(3 + U);
  c.shape(top, brim - 1, (y) => {
    const up = brim - 1 - y;
    const sh = up * lean;
    if (y === top) return side ? [x - 1.6 + sh, x + 1.6 + sh] : [x - 1.4 + sh, x + 2.3 + sh];
    return side ? [x - 2.6 + sh, x + 1.6 + sh] : [x - 2.5 + sh, x + 2.3 + sh];
  }, HAT, (_x, _y, t, u) => sphere(t * 0.85, u * 0.3 - 0.35, 1));
  // The band, a dent, and a crease catching the light.
  c.part();
  const band = brim - 2;
  c.shape(band, band, () => [x - 2.5 + lean, x + 2.3 + lean + (side ? -0.7 : 0)], HAT_BAND, (_x, _y, t) => cyl(t, 0));
  if (view !== 'up') {
    c.shade(x + (side ? 0 : 1) + lean * 4, top + 2, -2);
    c.shade(x + lean * 5, top + 1, -1);
    c.shade(x - 1 + lean * 3, top + 2, 1);
  } else {
    c.shade(x - 1 - lean * 4, top + 2, -1);
  }
}

/** Long grey hair hanging lank to his shoulders on either side, behind the face. */
function diggerHairDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  c.part();
  c.ellipse(cx, 11.8 + U, 3.7, 3.0, GREY_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.6, 1) });
  c.part();
  const sw = p.sway * 0.25;
  c.capsule(cx - 3.3, 11.6 + U, cx - 3.9 + sw, 17 + U, 1.25, 0.8, GREY_HAIR);
  c.capsule(cx + 2.9, 11.6 + U, cx + 3.4 + sw, 17 + U, 1.25, 0.8, GREY_HAIR);
  // Strands.
  for (const y of [13, 15]) {
    c.shade(cx - 4 + sw, y + U, -1);
    c.shade(cx + 3 + sw, y + 1 + U, -1);
  }
}

/** The gravedigger from the front: hat, grey hair, a weathered stubbled face in the brim's shadow, the green glint of his eyes. */
function headDiggerDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  diggerHairDown(c, cx, U, p);
  c.part();
  c.ellipse(cx - 0.2, 12.7 + U, 2.6, 2.6, S.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.8 - 0.1, 1) });
  // The brim's shadow over the brow, a big nose, a sour mouth and a grey stubble.
  for (let x = Math.floor(cx - 3); x <= cx + 2; x++) c.shade(x, 11 + U, -1);
  c.part();
  c.px(cx - 1, 13 + U, S.skin, sphere(-0.1, -0.6), { bias: 1 });
  c.shade(cx - 2, 14 + U, -1);
  c.shade(cx - 1, 14 + U, -2);
  c.shade(cx, 14 + U, -1);
  for (let y = 14; y <= 15; y++) {
    for (let x = Math.floor(cx - 3); x <= cx + 2; x++) {
      if (((x + y) & 1) === 0 && c.materialAt(x, y + U) === S.skin) c.px(x, y + U, GREY_HAIR, sphere((x - cx) * 0.3, 0.5), { bias: -2 });
    }
  }
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
  stovepipe(c, cx - 0.2, U, 'down');
}

/** From behind: the hat, and the long grey hair down over his collar. */
function headDiggerUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  c.part();
  c.ellipse(cx, 11.6 + U, 3.5, 3.2, GREY_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7 - 0.1, 1) });
  c.part();
  const sw = p.sway * 0.25;
  c.shape(Math.round(13 + U), Math.round(17.4 + U), (y) => {
    const u = (y - 13 - U) / 4.4;
    const hw = 2.8 - u * 0.9;
    return [cx - hw + u * sw, cx + hw + u * sw];
  }, GREY_HAIR, (_x, _y, t, u) => sphere(t * 0.85, u * 0.5, 1));
  // Strands, and a ragged end.
  for (let y = 12; y <= 17; y++) {
    c.shade(cx - 2 + ((y & 1) === 0 ? 0 : 1), y + U, -1);
    c.shade(cx + 1 + ((y & 1) === 0 ? 1 : 0), y + U, -1);
  }
  for (const x of [cx - 2, cx, cx + 2]) c.erase(x + Math.round(sw), Math.round(17.4 + U));
  stovepipe(c, cx + 0.2, U, 'up');
}

/** In profile, facing left and hunched forward: the hook of a nose, stubble, hair hanging down his back. */
function headDiggerSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  c.part();
  c.ellipse(hx + 0.8, 11.8 + U, 3.0, 3.0, GREY_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.7, 1) });
  c.part();
  c.capsule(hx + 1.8, 11.6 + U, hx + 2.6 + p.sway * 0.35, 17 + U, 1.6, 0.9, GREY_HAIR);
  for (const y of [13, 15]) c.shade(hx + 2 + (y - 12) * 0.15 + p.sway * 0.2, y + U, -1);
  c.part();
  c.ellipse(hx - 1.4, 12.9 + U, 2.2, 2.4, S.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85 - 0.2, dy * 0.8 - 0.1, 1) });
  for (let x = Math.floor(hx - 3); x <= hx; x++) c.shade(x, 11 + U, -1);
  // The nose, jutting out under the brim.
  c.part();
  c.px(hx - 4, 13 + U, S.skin, sphere(-0.7, -0.2), { bias: 1 });
  c.shade(hx - 3, 14 + U, -2);
  for (let y = 14; y <= 15; y++) {
    for (let x = Math.floor(hx - 3); x <= hx; x++) {
      if (((x + y) & 1) === 1 && c.materialAt(x, y + U) === S.skin) c.px(x, y + U, GREY_HAIR, sphere(-0.3, 0.5), { bias: -2 });
    }
  }
  eyes(c, [[hx - 3, 12 + U]], p.blink);
  stovepipe(c, hx - 0.6, U, 'side');
}

/** His scarf, wound round the neck: from the front a knot and two ragged tails down his chest; from the side one tail hanging forward; from behind only the wrap. */
function scarf(c: PixelCanvas, view: View, x: number, U: number, sway: number): void {
  const nrm: NormalFn = (_x, _y, t, u) => sphere(t * 0.85, u * 0.6 - 0.3, 1);
  c.part();
  if (view === 'side') c.shape(Math.round(15.6 + U), Math.round(17 + U), () => [x - 3.4, x + 2.4], SCARF, nrm);
  else c.shape(Math.round(15.6 + U), Math.round(17 + U), () => [x - 3.4, x + 3.2], SCARF, nrm);
  if (view === 'up') return;
  const tx = view === 'side' ? x - 2.8 : x - 1.6;
  c.part();
  c.ellipse(tx, 17.8 + U, 1.1, 0.9, SCARF);
  c.part();
  const sw = sway * 0.35;
  c.capsule(tx - 0.3, 18.4 + U, tx - 0.8 + sw, 22.6 + U, 0.75, 0.6, SCARF);
  if (view === 'down') c.capsule(tx + 0.7, 18.4 + U, tx + 0.9 + sw, 21.4 + U, 0.65, 0.55, SCARF, { bias: -1 });
  // A faded stripe across the tails, and their frayed ends.
  c.shade(tx - 0.6 + sw * 0.5, 20.6 + U, 1);
  c.shade(tx - 1 + sw, 22.6 + U, -1);
}

/** The greatcoat's wear: patches sewn over its tears, brass buttons, and grave mud dried along the hem. */
function coatWear(c: PixelCanvas, view: View, cx: number, top: number, waist: number, hem: number, sway: number): void {
  const patch = (x: number, y: number) => {
    c.part();
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (c.filled(x + dx, y + dy)) c.px(x + dx, y + dy, PATCH, sphere(dx ? 0.3 : -0.3, dy ? 0.2 : -0.3));
    // Coarse stitches round it.
    c.shade(x - 1, y, -1);
    c.shade(x + 2, y + 1, -1);
  };
  const u = (y: number) => (y - top) / Math.max(1, hem - top);
  const sx = (y: number) => u(y) * u(y) * sway;
  if (view === 'down') {
    patch(Math.round(cx + 2.6 + sx(waist + 4)), waist + 3);
    patch(Math.round(cx - 5 + sx(hem - 2)), hem - 2);
    c.part();
    for (const y of [top + 4, top + 6]) c.px(cx + 1, y, BRASS, sphere(0.2, -0.3));
  } else if (view === 'up') {
    patch(Math.round(cx - 3), top + 4);
    patch(Math.round(cx + 2 + sx(hem - 3)), hem - 3);
  } else {
    patch(Math.round(cx + 1.6 + sx(hem - 3)), hem - 3);
  }
  // Mud: the bottom rows darkened, unevenly.
  for (let x = cx - 9; x <= cx + 9; x++) {
    if (c.filled(x, hem - 1) && (x * 7) % 3 === 0) c.shade(x, hem - 1, -1);
    if (c.filled(x, hem - 2) && (x * 5) % 4 === 0) c.shade(x, hem - 2, -1);
  }
}

// ---------------------------------------------------------------------------
// The vampire lord

/** The bat-wing hem: how far the cape's bottom edge rises at `d` px out from the middle, tips every 3 px with scallops between. */
function scallop(d: number, tips: number): number {
  const k = (((Math.abs(d) - tips) % 3) + 3) % 3;
  return Math.sin((k / 3) * Math.PI) * 1.8;
}

/**
 * The cape seen from the front, hanging behind him: its crimson lining shows
 * past his sides, a black rim where it folds, the bat-wing hem's points
 * reaching wider at the bottom. Casting spreads it like wings.
 */
function capeDown(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const open = p.flare * 2.4 + Math.abs(p.sway) * 0.3;
  const top = Math.round(15 + U);
  const hem = 30 + L;
  const lift = p.flare * 3;
  c.part();
  for (let y = top; y <= hem + 1; y++) {
    const u = (y - top) / (hem - top);
    const hw = 5.0 + u * (4.0 + open);
    const sw = u * u * p.sway;
    for (let x = Math.floor(cx - hw + sw); x <= Math.ceil(cx + hw + sw); x++) {
      const d = x + 0.5 - cx - sw;
      if (Math.abs(d) > hw) continue;
      // The hem: lifted between the points, the outer points raised as it spreads.
      const bottom = hem - scallop(d, 1.5) - (Math.max(0, Math.abs(d) - 5) / 4) * lift;
      if (y > bottom) continue;
      const rim = Math.abs(d) > hw - 1 || y > bottom - 1;
      c.px(x, y, rim ? CAPE : LINING, sphere((d / hw) * 0.8, u * 0.4 - 0.2, 1), { bias: rim ? 0 : -1 });
    }
  }
}

/** From behind, the cape covers his back: black satin falling in folds to its bat-wing hem. */
function capeUp(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const open = p.flare * 2.4 + Math.abs(p.sway) * 0.3;
  const top = Math.round(15 + U);
  const hem = 30 + L;
  const lift = p.flare * 3;
  c.part();
  for (let y = top; y <= hem + 1; y++) {
    const u = (y - top) / (hem - top);
    const hw = 4.8 + u * (3.0 + open);
    const sw = u * u * p.sway;
    for (let x = Math.floor(cx - hw + sw); x <= Math.ceil(cx + hw + sw); x++) {
      const d = x + 0.5 - cx - sw;
      if (Math.abs(d) > hw) continue;
      const bottom = hem - scallop(d, 1.5) - (Math.max(0, Math.abs(d) - 5) / 4) * lift;
      if (y > bottom) continue;
      // Folds: soft ridges every few pixels.
      const fold = Math.sin(d * 1.3) * 0.35;
      // The hem turns up a little at its points, showing the crimson.
      const turned = y > bottom - 1 && Math.abs(d) > 2;
      c.px(x, y, turned ? LINING : CAPE, sphere((d / hw) * 0.85 + fold, u * 0.5 - 0.3, 1));
    }
  }
  // The lining shows at the points as it spreads.
  if (p.flare > 0.3) {
    for (const s of [-1, 1]) {
      for (let y = hem - 4; y <= hem - 1; y++) {
        const x = Math.round(cx + s * (4.8 + ((y - top) / (hem - top)) * (3.0 + open)) - (s > 0 ? 1 : 0));
        if (c.materialAt(x, y) === CAPE) c.px(x, y, LINING, sphere(s * 0.6, 0));
      }
    }
  }
}

/** In profile, the cape streams back from his shoulders, its points trailing, the crimson lining catching at its back edge. */
function capeSide(c: PixelCanvas, hx: number, cx: number, U: number, L: number, p: Pose): void {
  const back = p.sway * 1.2 + p.flare * 2.6;
  const lift = p.flare * 2.4;
  const pts: [number, number][] = [
    [hx + 0.2, 15 + U],
    [hx + 2.8, 15.4 + U],
    [cx + 4.0 + back * 0.6, 22 + U],
    [cx + 5.6 + back, 29.6 + L - lift],
    [cx + 4.0 + back * 0.8, 28.2 + L - lift * 0.6],
    [cx + 2.8 + back * 0.6, 30.4 + L - lift * 0.3],
    [cx + 1.4 + back * 0.3, 29 + L],
    [cx, 30.4 + L],
    [cx - 0.6, 26 + U],
  ];
  c.part();
  poly(c, pts, CAPE, (_x, _y, t, u) => sphere(t * 0.7 + 0.15, u * 0.5 - 0.3, 1), { bias: -1 });
  // The lining along the trailing edge.
  for (let y = Math.round(16 + U); y <= 31 + L; y++) {
    let x = Math.ceil(cx + 10);
    while (x > cx - 2 && c.materialAt(x, y) !== CAPE) x--;
    if (c.materialAt(x, y) === CAPE) c.px(x, y, LINING, sphere(0.5, 0), { bias: -1 });
  }
}

/** The tall collar fanned up behind his head: crimson inside, black at its rim, its points standing above his ears. */
function vampCollar(c: PixelCanvas, view: View, x: number, U: number): void {
  const top = Math.round((view === 'up' ? 11 : 8) + U);
  const bot = Math.round(16 + U);
  c.part();
  if (view === 'side') {
    // Facing left: it stands behind his head, its inside towards his face.
    c.shape(top, bot, (y) => {
      const u = (y - top) / (bot - top);
      return [x + 0.2 + u * 0.6, x + 4.0 - u * 1.4];
    }, LINING, (_x, _y, t, u) => sphere(t * 0.6 - 0.2, u * 0.5 - 0.3, 1));
    for (let y = top; y <= bot; y++) {
      const u = (y - top) / (bot - top);
      c.px(Math.round(x + 4.0 - u * 1.4) - 1, y, CAPE, sphere(0.6, 0));
    }
    c.px(Math.round(x + 4), top - 1, CAPE, sphere(0.5, -0.6));
    return;
  }
  const front = view === 'down';
  c.shape(top, bot, (y) => {
    const u = (y - top) / (bot - top);
    const hw = 6.2 - u * 3.2;
    return [x - hw, x + hw];
  }, front ? LINING : CAPE, (_x, _y, t, u) => sphere(t * 0.75, u * 0.5 - 0.3, 1));
  if (front) {
    // The black outside shows at its rim.
    for (let y = top; y <= bot; y++) {
      const u = (y - top) / (bot - top);
      const hw = 6.2 - u * 3.2;
      c.px(Math.round(x - hw), y, CAPE, sphere(-0.7, 0));
      c.px(Math.round(x + hw) - 1, y, CAPE, sphere(0.7, 0));
    }
    for (let xx = Math.round(x - 6.2); xx < Math.round(x + 6.2); xx++) c.px(xx, top, CAPE, sphere(0, -0.6));
  }
  // The points.
  c.px(Math.round(x - 7), top - 1, CAPE, sphere(-0.6, -0.6));
  c.px(Math.round(x + 6), top - 1, CAPE, sphere(0.6, -0.6));
}

/** His chest from the front: a burgundy waistcoat under the black coat, a white jabot falling from his throat, the ruby brooch pinning it. */
function vestDown(c: PixelCanvas, cx: number, U: number, waist: number, p: Pose): void {
  c.part();
  c.shape(Math.round(16 + U), waist - 1, (y) => {
    const u = (y - 16 - U) / Math.max(1, waist - 17 - U);
    const hw = 2.1 - u * 0.7;
    return [cx - hw, cx + hw];
  }, WAISTCOAT, (_x, _y, t, u) => sphere(t * 0.7, u * 0.5 - 0.2, 1));
  // Two silver buttons.
  c.part();
  c.px(cx, waist - 3, SILVER, sphere(0.2, -0.3));
  c.px(cx, waist - 1, SILVER, sphere(0.2, -0.3));
  // The jabot's frills, wider and narrower by turns.
  c.part();
  const frills = [1.6, 1.1, 1.5, 0.8];
  frills.forEach((w, i) => c.shape(Math.round(16.6 + U) + i, Math.round(16.6 + U) + i, () => [cx - 0.4 - w, cx - 0.4 + w], LACE, (_x, _y, t) => sphere(t * 0.7, -0.2 + i * 0.15, 1)));
  c.shade(cx - 1, 18 + U, -1);
  // The brooch: a ruby that beats with light.
  c.part();
  c.ellipse(cx - 0.5, 16.3 + U, 1.05, 0.95, RUBY);
  const beat = [0.45, 0.6, 0.9, 0.6, 0.45, 0.4][p.tick % 6];
  c.spark(cx - 1, 16 + U, S.light[1], beat);
}

/** The vampire's ears: pale and pointed, their tips above the slicked hair's line. */
function ear(c: PixelCanvas, x: number, y: number, s: number): void {
  c.part();
  c.px(x, y, S.skin, sphere(s * 0.7, 0.1), { bias: -1 });
  c.px(x + s, y - 1, S.skin, sphere(s * 0.7, -0.6));
}

/** From the front: black hair slicked back to a widow's peak, a waxen face, red eyes, hollow cheeks and one white fang. */
function headVampDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  // The hair behind the face, slicked flat to the skull.
  c.part();
  c.ellipse(cx - 0.2, 11.0 + U, 3.6, 3.4, VAMP_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.35, 1) });
  ear(c, cx - 3.6, 12.4 + U, -1);
  ear(c, cx + 3.0, 12.4 + U, 1);
  c.part();
  c.ellipse(cx - 0.3, 12.9 + U, 2.55, 2.45, S.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.8 - 0.1, 1) });
  // The hairline: high at the temples, dipping to a point over the brow.
  c.part();
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [cx - 1.8, cx + 1.0], VAMP_HAIR, (_x, _y, t) => sphere(t * 0.6, -0.4, 1));
  c.px(cx - 1, 11 + U, VAMP_HAIR, sphere(0, -0.2));
  // A sheen along the slicked crown.
  c.shade(cx - 2, 8 + U, 1);
  c.shade(cx - 1, 8 + U, 1);
  // Arched brows' shadow, hollow cheeks, a thin mouth and a fang.
  c.shade(cx - 2, 11 + U, -1);
  c.shade(cx + 1, 11 + U, -1);
  c.shade(cx - 2, 13 + U, -1);
  c.shade(cx + 1, 13 + U, -1);
  c.shade(cx - 1, 14 + U, -2);
  c.shade(cx, 14 + U, -1);
  c.part();
  c.px(cx, 15 + U, LACE, sphere(0, 0.3), { bias: 1 });
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
}

/** From behind: the slick black back of his head and the tips of his ears. */
function headVampUp(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.ellipse(cx, 11.2 + U, 3.7, 3.6, VAMP_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  // Combed straight back: fine grooves.
  for (const x of [cx - 2, cx, cx + 2]) for (let y = 9; y <= 12; y++) if ((y & 1) === 0) c.shade(x, y + U, -1);
  c.shade(cx - 1, 8 + U, 1);
  ear(c, cx - 3.9, 12.2 + U, -1);
  ear(c, cx + 3.1, 12.2 + U, 1);
}

/** In profile, facing left: slick hair swept back to the nape, a pointed ear, a sharp nose, the fang. */
function headVampSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  c.part();
  c.ellipse(hx + 0.6, 11.2 + U, 3.2, 3.3, VAMP_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.3, 1) });
  c.part();
  c.ellipse(hx - 1.4, 12.9 + U, 2.2, 2.3, S.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85 - 0.2, dy * 0.8 - 0.1, 1) });
  c.part();
  c.px(hx - 4, 12.6 + U, S.skin, sphere(-0.7, -0.1), { bias: 1 });
  c.shade(hx - 2, 13 + U, -1);
  // The hairline sweeping back from a point at the brow.
  c.part();
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [hx - 3.0, hx + 1.4], VAMP_HAIR, (_x, _y, t) => sphere(t * 0.7, -0.4, 1));
  c.px(hx - 3, 11 + U, VAMP_HAIR, sphere(-0.3, -0.1));
  c.px(hx + 0, 11 + U, VAMP_HAIR, sphere(0.3, 0));
  c.shade(hx - 1, 9 + U, 1);
  c.shade(hx, 9 + U, 1);
  ear(c, hx, 12.6 + U, 1);
  c.shade(hx - 3, 14 + U, -2);
  c.part();
  c.px(hx - 3, 15 + U, LACE, sphere(0, 0.3), { bias: 1 });
  eyes(c, [[hx - 3, 12 + U]], p.blink);
}

// ---------------------------------------------------------------------------
// Directions

const REACH_FRONT = 4.4;
const REACH_SIDE = 5.0;

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const armA = () => arm(c, 7.5, 16.2 + U, fa, REACH_FRONT, [-0.6, 1], p.palm, fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.5, 16.2 + U, fb, REACH_FRONT, [0.6, 1], 0, fb.behind ? -1 : 0);
  if (S.style === 'wyrm') wings(c, 'down', cx, U, L, p.flare);
  else if (S.style === 'vampire') {
    capeDown(c, cx, U, L, p);
    vampCollar(c, 'down', cx + (p.head?.[0] ?? 0) - 0.3, U + (p.head?.[1] ?? 0));
  } else if (S.blood) highCollar(c, cx, U, 5.6, 5.6);
  if (fa.behind) armA();
  if (fb.behind) {
    drawStaff(c, 'down', p, fb, -1);
    armB();
  }

  foot(c, 10, 30.3 - p.footA);
  foot(c, 14, 30.3 - p.footB);

  // The robe, flaring to a hem that swings as he goes.
  const top = 15 + U;
  const hem = 29 + L;
  const waist = 22 + U;
  c.part();
  c.shape(top, hem, (y) => {
    const u = (y - top) / (hem - top);
    const hw = robeWidth(u, 4.3, 2.1);
    const sw = u * u * p.sway;
    return [cx - hw + sw, cx + hw + sw];
  }, S.robe, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  // Folds falling from the belt.
  for (let y = waist + 2; y <= hem; y++) {
    const u = (y - top) / (hem - top);
    c.shade(Math.round(cx - 3 + u * u * p.sway - u), y, -1);
    c.shade(Math.round(cx + 3 + u * u * p.sway + u), y, -1);
  }
  robeTexture(c, cx - 8, cx + 8, top + 1, hem);
  if (S.style === 'tomb') apron(c, cx, waist, hem, p.sway);
  else opening(c, cx, waist, hem, p.sway);
  hemTrim(c, hem, cx - 8, cx + 8);
  if (S.style === 'digger') coatWear(c, 'down', cx, top, waist, hem, p.sway);
  // The belt, and its clasp.
  c.part();
  c.shape(waist, waist, () => [cx - 4.4, cx + 4.4], beltMat(), (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx, waist, clasp(), sphere(0, -0.3));
  // The gravedigger's lantern swings at his hip.
  if (S.style === 'digger') lantern(c, cx - 3.4, waist + 2, p, p.sway * 0.5);

  // The head may lean or nod on its own (the idle moment); everything else stays put.
  const hcx = cx + (p.head?.[0] ?? 0);
  const hU = U + (p.head?.[1] ?? 0);
  if (S.style === 'wyrm') {
    // Black scales over the shoulders, a molten stone at the throat.
    cowl(c, cx, U, 5.4, 5.4);
    c.part();
    c.ellipse(cx, 16.3 + U, 1.15, 1.05, WYRM_GEM);
    headWyrmDown(c, hcx, hU, p);
  } else if (S.style === 'tomb') {
    cowl(c, cx, U, 5.3, 5.3);
    usekh(c, cx, 14.6 + U);
    headTombDown(c, hcx, hU, p);
  } else if (S.style === 'digger') {
    // Hunched: the coat's shoulders up round his ears, the head sunk a pixel into them.
    cowl(c, cx, U - 0.4, 5.7, 5.7);
    headDiggerDown(c, hcx, hU + 1, p);
    scarf(c, 'down', cx, U, p.sway);
  } else if (S.style === 'vampire') {
    cowl(c, cx, U, 5.4, 5.4);
    vestDown(c, cx, U, waist, p);
    headVampDown(c, hcx, hU, p);
  } else if (S.blood) {
    // Crimson over the shoulders, the gem clasp at the throat.
    cowl(c, cx, U, 5.4, 5.4);
    c.part();
    c.ellipse(cx, 16.3 + U, 1.15, 1.05, BLOOD_GEM);
    headBloodDown(c, hcx, hU, p);
  } else {
    cowl(c, cx, U, 5.3, 5.3);
    boneMantle(c, cx, U, 7, 5.0, true);
    headHoodDown(c, hcx, hU);
  }

  if (!fb.behind) {
    armB();
    drawStaff(c, 'down', p, fb);
  }
  if (!fa.behind) armA();
  if (p.skull) heldSkull(c, fa.x, fa.y, p.skull, p.tick);
  if (p.orb) bloodOrb(c, fa.x, fa.y, p.orb);
}

// ---------------------------------------------------------------------------
// The idle moment's props

/**
 * The bonecaller's little skull on his palm, turned three-quarters towards
 * him so it can talk back: a bone cranium, two sockets lit with soul fire,
 * a row of teeth and a jaw that drops open. While `form` is under 1 it is
 * still gathering out of (or coming apart into) wisps of soul fire.
 */
function heldSkull(c: PixelCanvas, x: number, y: number, s: Skull, tick: number): void {
  const [core, hot, mid, deep] = S.light;
  const sx = x + 0.4;
  const sy = y - 2.6 - (s.rise ?? 0);
  if (s.form < 1) {
    // Wisps circling in to the palm (or drifting up off it), tighter as the skull forms.
    const r = 1.6 + (1 - s.form) * 2.6;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + tick * 0.9 + s.form * 2;
      const wx = sx + Math.cos(a) * r;
      const wy = sy + Math.sin(a) * r * 0.8 - (1 - s.form) * 0.8;
      c.spark(wx, wy, i & 1 ? hot : mid, 0.75);
      c.spark(wx - Math.sin(a) * 1.1, wy + Math.cos(a) * 0.9, deep, 0.4);
    }
    c.spark(sx, sy, core, 0.6 + s.form * 0.4);
    if (s.form < 0.5) return;
  }
  // The cranium, the cheek and teeth jutting towards him, the jaw under them.
  c.part();
  c.ellipse(sx - 0.1, sy - 0.2, 2.2, 1.95, BONE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85 + 0.15, dy * 0.8 - 0.2, 1) });
  c.part();
  c.shape(Math.round(sy + 1.6), Math.round(sy + 1.6), () => [sx - 1.2, sx + 2.1], BONE, (_x, _y, t) => cyl(t, 0.3));
  const jy = Math.round(sy + 2.6 + s.jaw);
  c.part();
  c.shape(jy, jy, () => [sx - 0.6, sx + 1.8], BONE, (_x, _y, t) => cyl(t, 0.5));
  // Teeth: a dark gap between every other one, and the open mouth's dark.
  for (const tx of [sx - 0.2, sx + 1.3]) c.shade(tx, Math.round(sy + 1.6), -1);
  if (s.jaw > 0) {
    c.part();
    c.px(sx + 0.3, jy - 1, NECRO_INNER);
    c.px(sx + 1.3, jy - 1, NECRO_INNER);
  }
  // The sockets, lit from within.
  c.part();
  // Kept dark (the dark is what reads as a skull at this size), a pinpoint of fire deep in each.
  for (const ox of [-0.6, 1.4]) {
    c.px(sx + ox, sy + 0.3, NECRO_INNER);
    c.spark(sx + ox, sy + 0.3, s.glow > 0.8 ? hot : mid, 0.15 + s.glow * 0.4);
  }
  if (s.glow > 0.8) for (const ox of [-0.6, 1.4]) c.spark(sx + ox, sy - 1, mid, 0.25);
  // Still half made of fire: the light runs over the bone.
  if (s.form < 1) for (let yy = Math.floor(sy - 1); yy <= Math.round(sy + 2); yy++) c.spark(sx - 1 + ((yy + tick) & 1) * 2, yy, mid, 0.5);
  if (s.form === 1 && s.glow > 0.95) flareAt(c, sx + 0.5, sy - 0.2, 0.55);
}

/** The blood mage's orb: a drop of blood hung in the air, pulsing, a ribbon of it trailing where it has been. */
function bloodOrb(c: PixelCanvas, x: number, y: number, o: Orb): void {
  const [core, hot, mid, deep] = S.light;
  const ox = x + o.dx;
  const oy = y + o.dy;
  (o.trail ?? []).forEach(([tx, ty], i) => c.spark(x + tx, y + ty, i === 0 ? mid : deep, i === 0 ? 0.7 : 0.45));
  if (o.r < 1) {
    // Only a bead yet, welling in the palm.
    c.spark(ox, oy, core, 0.7);
    c.spark(ox, oy + 1, mid, 0.5);
    return;
  }
  c.part();
  c.ellipse(ox, oy, o.r, o.r, S.style === 'wyrm' ? WYRM_GEM : S.style === 'vampire' ? RUBY : BLOOD_GEM, { glow: 0.5 + o.glow * 0.5 });
  c.spark(ox - o.r * 0.35, oy - o.r * 0.35, core, 0.5 + o.glow * 0.5);
  if (o.glow > 0.6) {
    // A beat: light swells round it.
    const k = (o.glow - 0.6) / 0.4;
    const R = o.r + 1;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.spark(ox + Math.cos(a) * R, oy + Math.sin(a) * R, i & 1 ? mid : hot, 0.3 + 0.35 * k);
    }
  }
}

/** The hood from the front: its point, a face lost in shadow, a grey chin and two burning eyes. */
function headHoodDown(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.ellipse(cx, 11.2 + U, 4.1, 3.9, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.shape(6 + U, 7 + U, (y) => {
    const hw = (y - 6 - U) * 1.1 + 0.7;
    return [cx - hw - 0.4, cx + hw - 0.4];
  }, S.robe, (_x, _y, t) => sphere(t * 0.8, -0.8, 1));
  c.part();
  c.ellipse(cx, 12.7 + U, 2.7, 2.5, S.inner, { normal: () => sphere(0, 0.2, 1) });
  // Cheekbones and chin catching a little light.
  c.part();
  c.px(cx - 2, 13 + U, S.skin, sphere(-0.4, 0.2), { bias: -1 });
  c.px(cx + 1, 13 + U, S.skin, sphere(0.4, 0.2), { bias: -1 });
  c.shape(14 + U, 14 + U, () => [cx - 1.5, cx + 0.5], S.skin, (_x, _y, t) => sphere(t * 0.6, 0.5, 1), { bias: -1 });
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], false);
  // The hood's edge in trim, down both sides of the face.
  c.part();
  for (const [x, y] of [[cx - 3, 13], [cx - 3, 14], [cx + 2, 13], [cx + 2, 14]] as const) c.px(x, y + U, S.trim, sphere(x < cx ? -0.4 : 0.4, 0.2), { bias: -1 });
}

/** The blood mage from the front: a white mane, a pale gaunt face, ember eyes. */
function headBloodDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  // The mane, falling behind the shoulders on either side.
  c.part();
  c.ellipse(cx, 11.2 + U, 4.0, 3.9, BLOOD_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.capsule(cx - 3.4, 12 + U, cx - 3.8, 16.4 + U, 1.3, 0.9, BLOOD_HAIR);
  c.capsule(cx + 3.0, 12 + U, cx + 3.4, 16.4 + U, 1.3, 0.9, BLOOD_HAIR);
  c.part();
  c.ellipse(cx - 0.3, 12.8 + U, 2.55, 2.45, S.skin);
  // A fringe swept to one side over the brow.
  c.part();
  c.shape(9 + U, 10 + U, (y) => (y === 9 + U ? [cx - 3.2, cx + 3.2] : [cx - 3, cx + 0.4]), BLOOD_HAIR, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
  c.px(cx - 3, 11 + U, BLOOD_HAIR, sphere(-0.6, 0.2));
  c.px(cx + 2, 11 + U, BLOOD_HAIR, sphere(0.6, 0.2), { bias: -1 });
  // Hollow cheeks, a thin mouth.
  c.shade(cx - 2, 13 + U, -1);
  c.shade(cx + 1, 13 + U, -1);
  c.shade(cx - 1, 14 + U, -1);
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) c.px(x, y, S.skin, sphere(0, -0.3), { bias: -1 });
    else {
      c.px(x, y, S.eye);
      c.spark(x, y, S.light[1], 0.5);
    }
  }
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const armA = () => arm(c, 7.5, 16.2 + U, fa, REACH_FRONT, [-0.6, 0.8], p.palm, fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.5, 16.2 + U, fb, REACH_FRONT, [0.6, 0.8], 0, fb.behind ? -1 : 0);
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
    const hw = robeWidth(u, 4.3, 2.1);
    const sw = u * u * p.sway;
    return [cx - hw + sw, cx + hw + sw];
  }, S.robe, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
  for (let y = waist + 1; y <= hem; y++) {
    const u = (y - top) / (hem - top);
    c.shade(Math.round(cx + u * u * p.sway), y, -1);
  }
  robeTexture(c, cx - 8, cx + 8, top + 1, hem);
  hemTrim(c, hem, cx - 8, cx + 8);
  if (S.style === 'digger') coatWear(c, 'up', cx, top, waist, hem, p.sway);
  c.part();
  c.shape(waist, waist, () => [cx - 4.4, cx + 4.4], beltMat(), (_x, _y, t) => cyl(t, 0));
  if (S.style === 'digger') lantern(c, cx - 3.6, waist + 2, p, p.sway * 0.5);

  if (S.style === 'wyrm') {
    cowl(c, cx, U, 5.4, 5.4);
    // The wings folded down his back, then the back of his head and his horns.
    wings(c, 'up', cx, U, L, p.flare);
    headWyrmUp(c, cx, U);
  } else if (S.style === 'tomb') {
    cowl(c, cx, U, 5.3, 5.3);
    headTombUp(c, cx, U, p);
  } else if (S.style === 'digger') {
    cowl(c, cx, U - 0.4, 5.7, 5.7);
    scarf(c, 'up', cx, U, p.sway);
    headDiggerUp(c, cx, U + 1, p);
  } else if (S.style === 'vampire') {
    // The cape over his back, then his head, the collar standing up round it.
    cowl(c, cx, U, 5.4, 5.4);
    capeUp(c, cx, U, L, p);
    headVampUp(c, cx, U);
    vampCollar(c, 'up', cx, U);
  } else if (S.blood) {
    cowl(c, cx, U, 5.4, 5.4);
    // The mane down the back, over the collar's rim.
    highCollar(c, cx, U, 5.6, 5.6);
    c.part();
    c.ellipse(cx, 11.2 + U, 4.0, 3.9, BLOOD_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    c.part();
    c.shape(13 + U, 17 + U, (y) => {
      const hw = 2.6 - (y - 13 - U) * 0.4;
      return [cx - hw, cx + hw];
    }, BLOOD_HAIR, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
    for (let y = 12 + U; y <= 17 + U; y++) c.shade(cx - 1 + ((y & 1) === 0 ? 0 : 2), y, -1);
  } else {
    cowl(c, cx, U, 5.3, 5.3);
    boneMantle(c, cx, U - 0.6, 7, 5.0, false);
    // The back of the hood, drawn to a point that hangs down the back.
    c.part();
    c.ellipse(cx, 11.3 + U, 4.1, 3.9, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    c.part();
    c.shape(6 + U, 7 + U, (y) => {
      const hw = (y - 6 - U) * 1.1 + 0.7;
      return [cx - hw - 0.4, cx + hw - 0.4];
    }, S.robe, (_x, _y, t) => sphere(t * 0.8, -0.8, 1));
    c.part();
    c.shape(14 + U, 18 + U, (y) => {
      const hw = 1.8 - (y - 14 - U) * 0.4;
      return hw < 0.3 ? null : [cx - hw, cx + hw];
    }, S.robe, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
    c.shade(cx, 9 + U, 1);
  }

  if (!fb.behind) {
    armB();
    drawStaff(c, 'up', p, fb);
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

  if (S.style === 'wyrm') wings(c, 'side', hx, U, L, p.flare);
  else if (S.style === 'vampire') {
    capeSide(c, hx, cx, U, L, p);
    vampCollar(c, 'side', hx, U);
  } else if (S.blood) {
    // The collar standing up behind the head, and the mane streaming back.
    c.part();
    c.shape(11 + U, 16 + U, (y) => [hx + 0.6, hx + 3.6 - (y - 11 - U) * 0.3], BLOOD_INNER, (_x, _y, t, u) => sphere(t * 0.8 + 0.2, u * 0.6 - 0.1, 1));
    c.px(Math.round(hx + 1), 11 + U, GOLD, sphere(0, -0.4));
    c.px(Math.round(hx + 2), 11 + U, GOLD, sphere(0.2, -0.4));
  }
  // The casting arm behind everything, unless it reaches out in front.
  if (fa.behind) arm(c, hx + 1.2, 16.4 + U, fa, REACH_SIDE, [0.3, 1], p.palm, -1);

  // Feet: the back one in shade first.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  foot(c, cx + 0.8 - p.footB, 30.4 - lift(p.footB), true, -1);
  foot(c, cx - 0.8 - p.footA, 30.4 - lift(p.footA), true);

  // The robe in profile, the hem billowing back.
  const top = 15 + U;
  const hem = 29 + L;
  const waist = 22 + U;
  c.part();
  c.shape(top, hem, (y) => {
    const u = (y - top) / (hem - top);
    const shift = hx + (cx - hx) * u;
    const hw = robeWidth(u, 3.2, 1.6);
    return [shift - hw - 0.2 - u * 0.4, shift + hw + 0.2 + u * u * (0.6 + p.sway)];
  }, S.robe, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  // The opening down the front edge, trimmed.
  for (let y = waist + 1; y <= hem; y++) {
    const u = (y - top) / (hem - top);
    const shift = hx + (cx - hx) * u;
    const x = Math.round(shift - robeWidth(u, 3.2, 1.6) - 0.2 - u * 0.4);
    if (c.filled(x, y)) c.px(x, y, S.trim, sphere(-0.5, 0));
    if (c.filled(x + 1, y)) c.px(x + 1, y, S.inner, sphere(-0.3, 0.2), { bias: -1 });
  }
  for (let y = waist + 2; y <= hem; y++) c.shade(Math.round(hx + 1.5 + (y - waist) * 0.2), y, -1);
  robeTexture(c, cx - 8, cx + 8, top + 1, hem);
  hemTrim(c, hem, cx - 8, cx + 8);
  if (S.style === 'digger') coatWear(c, 'side', cx, top, waist, hem, p.sway);
  c.part();
  c.shape(waist, waist, () => [hx - 3.3, hx + 3.3], beltMat(), (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(hx - 3.3), waist, clasp(), sphere(-0.5, -0.3));
  if (S.style === 'digger') lantern(c, hx - 1.2, waist + 2, p, p.sway * 0.4);

  if (S.style === 'wyrm') {
    cowl(c, hx, U, 4.0, 4.2);
    c.part();
    c.px(Math.round(hx - 3), 16 + U, WYRM_GEM, sphere(-0.5, -0.2));
    headWyrmSide(c, hx, U, p);
  } else if (S.style === 'tomb') {
    cowl(c, hx, U, 4.2, 4.4);
    // The broad collar's edge on his chest.
    c.part();
    for (let y = 16; y <= 18; y++) {
      c.px(Math.round(hx - 3.6 + (y - 16) * 0.2), y + U, y === 17 ? ((y & 1) ? TURQ : LAPIS) : GOLD, sphere(-0.5, 0));
      c.px(Math.round(hx - 2.6 + (y - 16) * 0.2), y + U, y === 17 ? LAPIS : GOLD, sphere(-0.3, 0));
    }
    headTombSide(c, hx, U, p);
  } else if (S.style === 'digger') {
    // Hunched: his head thrust forward and sunk between his shoulders.
    cowl(c, hx, U - 0.4, 4.4, 4.6);
    headDiggerSide(c, hx - 1, U + 1, p);
    scarf(c, 'side', hx, U, p.sway);
  } else if (S.style === 'vampire') {
    cowl(c, hx, U, 4.0, 4.2);
    // The waistcoat's edge, the jabot frothing forward, the ruby at his throat.
    c.part();
    for (let y = 17; y <= 21; y++) c.px(Math.round(hx - 3.2), y + U, WAISTCOAT, sphere(-0.6, 0));
    c.part();
    for (const [x, y] of [[-3.6, 16], [-4.4, 17], [-3.6, 18], [-4.0, 19]] as const) c.px(Math.round(hx + x), y + U, LACE, sphere(-0.6, -0.1 + (y - 16) * 0.15));
    c.part();
    c.px(Math.round(hx - 3), 16 + U, RUBY, sphere(-0.5, -0.2));
    c.spark(Math.round(hx - 3), 16 + U, S.light[1], [0.45, 0.6, 0.9, 0.6, 0.45, 0.4][p.tick % 6]);
    headVampSide(c, hx, U, p);
  } else if (S.blood) {
    cowl(c, hx, U, 4.0, 4.2);
    c.part();
    c.px(Math.round(hx - 3), 16 + U, BLOOD_GEM, sphere(-0.5, -0.2));
    // The mane, then the face turned to the left.
    c.part();
    c.ellipse(hx + 0.5, 11.3 + U, 3.5, 3.8, BLOOD_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
    c.part();
    c.capsule(hx + 2.2, 12.5 + U, hx + 3.2 + p.sway * 0.4, 17.5 + U, 1.6, 0.9, BLOOD_HAIR);
    c.part();
    c.ellipse(hx - 1.4, 12.9 + U, 2.2, 2.3, S.skin);
    c.part();
    c.px(hx - 4, 12.6 + U, S.skin, sphere(-0.7, -0.1), { bias: 1 });
    c.shade(hx - 2, 14 + U, -1);
    c.part();
    c.shape(9 + U, 10 + U, (y) => (y === 9 + U ? [hx - 3.2, hx + 3] : [hx - 3.4, hx - 0.6]), BLOOD_HAIR, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
    c.px(hx - 0.4, 11 + U, BLOOD_HAIR, sphere(0.3, 0.2));
    c.px(hx - 0.2, 12 + U, BLOOD_HAIR, sphere(0.4, 0.4), { bias: -1 });
    eyes(c, [[hx - 3, 12 + U]], p.blink);
  } else {
    cowl(c, hx, U, 4.2, 4.4);
    boneMantle(c, hx - 0.6, U, 4, 3.4, false);
    // The hood in profile, its point hanging back, the face deep inside it.
    c.part();
    c.ellipse(hx + 0.4, 11.3 + U, 3.5, 3.9, S.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
    c.part();
    c.capsule(hx + 2.4, 9 + U, hx + 4.2 + p.sway * 0.3, 13.6 + U, 1.4, 0.6, S.robe);
    c.part();
    c.shape(7 + U, 8 + U, (y) => [hx - 3.2 + (8 + U - y) * 0.9, hx + 2.8], S.robe, (_x, _y, t, u) => sphere(t * 0.9, u - 0.7, 1));
    c.part();
    c.ellipse(hx - 1.7, 12.7 + U, 1.9, 2.3, S.inner, { normal: () => sphere(-0.2, 0.2, 1) });
    c.part();
    c.px(hx - 3, 14 + U, S.skin, sphere(-0.5, 0.4));
    c.px(hx - 2, 14 + U, S.skin, sphere(-0.2, 0.5), { bias: -1 });
    c.px(hx - 3, 13 + U, S.skin, sphere(-0.6, 0.1), { bias: -1 });
    eyes(c, [[hx - 3, 12 + U]], false);
    c.part();
    c.px(Math.round(hx - 4), 13 + U, S.trim, sphere(-0.5, 0.2), { bias: -1 });
    c.px(Math.round(hx - 4), 14 + U, S.trim, sphere(-0.5, 0.3), { bias: -1 });
  }

  // The staff held out ahead, the near arm gripping it; the casting hand in front once it reaches out.
  drawStaff(c, 'side', p, fb);
  arm(c, hx + 0.2, 16.6 + U, fb, REACH_SIDE, [0.4, 1], 0);
  if (!fa.behind) arm(c, hx + 0.8, 16.4 + U, fa, REACH_SIDE, [0.3, 1], p.palm);
}

// ---------------------------------------------------------------------------
// Animations

/** The casting hand hanging loose, the staff planted at his side. */
const REST_A = H(0.6, 4.4, -3.2);
const REST_B = H(1.6, 5.4, -2.2);
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
});

/** Standing still, the robe stirring, soul fire flickering on the staff. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.a.h += Math.sin(ph) * 0.4;
    p.b.h += p.breath * -0.3;
    p.sway = Math.sin(ph - 1) * 0.6;
    p.palm = f === 2 || f === 3 ? 0.25 : 0;
    p.tick = f;
    p.blink = f === 4;
    frames.push(p);
  }
  return frames;
}

/** A slow, gliding walk, the staff swung forward with each step. */
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
      p.footA = Math.round(s * 2.2);
      p.footB = -p.footA;
      p.lean = 1;
      p.sway = 0.8 + Math.abs(s) * 0.9;
      p.b = H(3.2 - s * 0.6, 0, -2 + p.lift * 0.4);
      p.a = H(0.2 + s * 1.4, 0, -3.2 + p.lift * 0.4);
      p.tilt = 0.08 + s * 0.06;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.7;
      p.b = H(1.6 - s * 0.5, 5.4, -2.2 + p.lift * 0.4);
      p.a = H(0.6 + s * 1.4, 4.4, -3.2 + p.lift * 0.4);
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

/** The bolt: the hand drawn back to the shoulder as it fills with light, then thrust out and opened. */
const cast = action([
  { a: H(-0.6, 4.2, 1.2), b: REST_B, aSide: H(-1, 0, 1.2), bSide: REST_B_SIDE, palm: 0.35, flare: 0.2, tilt: 0.05 },
  { a: H(1.2, 3.2, 2.2), b: REST_B, aSide: H(0.8, 0, 2), bSide: REST_B_SIDE, palm: 0.75, flare: 0.5, tilt: 0.08, lean: -1 },
  { a: H(5.6, 1.2, 1.8), b: REST_B, aSide: H(5.6, 0, 1.6), bSide: H(2.6, 0, -2), palm: 1, flare: 0.8, tilt: 0.12, lean: 1, step: 1 },
  { a: H(5.0, 1.6, 1.2), b: REST_B, aSide: H(5, 0, 1.2), bSide: H(2.8, 0, -2), palm: 0.4, flare: 0.3, tilt: 0.08, lean: 1, step: 1 },
  { a: H(2.0, 3.4, -1.4), b: REST_B, aSide: H(1.8, 0, -1.6), bSide: REST_B_SIDE, palm: 0.1, tilt: 0.03 },
]);

/**
 * Raising the dead: staff and hand lifted high while the soul fire swells,
 * then the staff's heel driven down into the ground.
 */
const raise = action([
  { a: H(1.2, 4.6, 3), b: H(1.8, 5.2, 1.5), aSide: H(1.4, 0, 3), bSide: H(3.2, 0, 1.2), palm: 0.2, flare: 0.2 },
  { a: H(1.0, 4.8, 7), b: H(1.6, 4.8, 5.5), aSide: H(1.2, 0, 7), bSide: H(3.2, 0, 5), palm: 0.5, flare: 0.5, lift: 1 },
  { a: H(0.8, 4.6, 9.5), b: H(1.4, 4.4, 8.5), aSide: H(1.0, 0, 9.2), bSide: H(3.0, 0, 8), palm: 0.8, flare: 0.8, lift: 1, lean: -1 },
  { a: H(0.8, 4.4, 10), b: H(1.4, 4.2, 9), aSide: H(1.0, 0, 9.8), bSide: H(3.0, 0, 8.6), palm: 1, flare: 1, lift: 1, lean: -1 },
  { a: H(3.2, 3.6, -1.6), b: H(2.4, 5.0, -3.2), aSide: H(3.4, 0, -1.6), bSide: H(3.6, 0, -3.4), palm: 1, flare: 1, breath: 1, lean: 1, step: 1 },
  { a: H(2.4, 4.0, -2.4), b: H(2.2, 5.0, -3.0), aSide: H(2.4, 0, -2.4), bSide: H(3.5, 0, -3.2), palm: 0.5, flare: 0.5, breath: 1, lean: 1, step: 1 },
  { a: REST_A, b: REST_B, aSide: REST_A_SIDE, bSide: REST_B_SIDE, palm: 0.15, flare: 0.15 },
]);

/** One beat of the idle moment: what differs from the plain stand. */
interface RestKey {
  a?: Hand;
  breath?: number;
  head?: [number, number];
  palm?: number;
  flare?: number;
  blink?: boolean;
  skull?: Skull;
  orb?: Orb;
}

/**
 * The bonecaller's idle moment: soul fire gathers in his palm into a little
 * skull, which he lifts to eye level at arm's length and addresses, Hamlet
 * fashion. It clacks back at him, they share a dry laugh, and he lets it
 * come apart into wisps. Slot for slot with the blood mage's (they share
 * one playing order).
 */
const HAMLET = H(2.4, 10.4, 3.8);
const BONE_REST: RestKey[] = [
  {},
  // Anticipation: the shoulders settle, the hand draws in.
  { breath: 1, a: H(0.8, 4.8, -2.6), palm: 0.15 },
  // Up and out, the palm filling, wisps circling in.
  { a: H(1.8, 7.4, 1.2), palm: 0.5, skull: { form: 0.2, jaw: 0, glow: 0.4 } },
  { a: H(2.2, 9.4, 3.2), palm: 0.7, skull: { form: 0.7, jaw: 0, glow: 0.7 } },
  // There it is, with a flash; the arm overshoots a touch, then settles.
  { a: H(2.4, 10.8, 4.4), palm: 0.3, flare: 0.25, skull: { form: 1, jaw: 1, glow: 1 } },
  { a: HAMLET, skull: { form: 1, jaw: 0, glow: 0.55 } },
  // He leans in to it, then speaks: a slow nod.
  { a: HAMLET, head: [-1, 0], skull: { form: 1, jaw: 0, glow: 0.5 } },
  { a: HAMLET, head: [-1, 1], skull: { form: 1, jaw: 0, glow: 0.45 } },
  // It answers: the jaw clacking, sockets flaring, a little hop on the palm.
  { a: HAMLET, head: [-1, 0], skull: { form: 1, jaw: 1, glow: 1, rise: 1 } },
  { a: HAMLET, head: [-1, 0], skull: { form: 1, jaw: 0, glow: 0.6 } },
  // He listens, head tipped.
  { a: HAMLET, head: [0, 0], skull: { form: 1, jaw: 0, glow: 0.5 } },
  // A shared laugh: his shoulders shaking, its jaw hanging open.
  { a: HAMLET, breath: 1, head: [-1, 0], flare: 0.2, skull: { form: 1, jaw: 1, glow: 0.85 } },
  { a: H(2.4, 10.4, 4.3), head: [-1, -1], flare: 0.35, skull: { form: 1, jaw: 1, glow: 1, rise: 1 } },
  // Enough: it comes apart into soul fire, and the hand sinks back.
  { a: H(2.4, 10.2, 3.6), palm: 0.4, skull: { form: 0.6, jaw: 1, glow: 0.8 } },
  { a: H(2.0, 8.4, 2.0), palm: 0.45, skull: { form: 0.15, jaw: 0, glow: 0.5 } },
  { a: H(1.2, 5.2, -1.2), palm: 0.15 },
  {},
];

/**
 * The blood mage's idle moment: a bead of blood wells in his palm, rises
 * into an orb and swirls once round his hand, then hangs at eye level and
 * beats like a heart, the staff (and the wyrmblood's wings) answering each
 * beat, before it sinks back and soaks into the palm.
 */
const HEART = H(3.4, 10.4, 4.6);
const BLOOD_REST: RestKey[] = [
  {},
  { breath: 1, a: H(1.2, 4.2, -2.2), palm: 0.15 },
  // A bead wells up, and rises.
  { a: H(2.6, 7.4, 1.4), palm: 0.45, orb: { dx: 0.5, dy: -1.4, r: 0.6, glow: 0.5 } },
  { a: H(3.2, 9.6, 2.6), palm: 0.3, orb: { dx: 0.5, dy: -3.6, r: 1.2, glow: 0.4, trail: [[0.5, -2.3], [0.5, -1.3]] } },
  // Once round the hand, a ribbon trailing: out, over the top (smaller, further off), and back in front.
  { a: H(3.2, 9.6, 2.8), orb: { dx: -2.6, dy: -5.0, r: 1.3, glow: 0.45, trail: [[-1.8, -3.8], [-0.6, -3.3]] } },
  { a: H(3.2, 9.6, 3.0), orb: { dx: 0.5, dy: -7.0, r: 1.0, glow: 0.4, trail: [[-1.4, -6.6], [-2.5, -5.8]] } },
  { a: H(3.3, 9.8, 3.4), orb: { dx: 3.4, dy: -5.2, r: 1.3, glow: 0.45, trail: [[2.5, -6.5], [1.2, -7.1]] } },
  // Lifted to eye level, and he looks into it.
  { a: HEART, head: [-1, 0], orb: { dx: 0.6, dy: -3.8, r: 1.5, glow: 0.5, trail: [[2.0, -4.6]] } },
  // It beats.
  { a: HEART, head: [-1, 0], orb: { dx: 0.6, dy: -3.8, r: 1.5, glow: 0.5 } },
  { a: H(3.4, 10.4, 4.9), head: [-1, 0], palm: 0.3, flare: 0.55, orb: { dx: 0.6, dy: -4.0, r: 2.1, glow: 1 } },
  // He tips his head, savouring it.
  { a: HEART, head: [-1, 1], blink: true, orb: { dx: 0.6, dy: -3.8, r: 1.5, glow: 0.4 } },
  // Stronger now.
  { a: HEART, head: [-1, 0], orb: { dx: 0.6, dy: -3.8, r: 1.6, glow: 0.55 } },
  { a: H(3.4, 10.4, 5.0), head: [-1, 0], palm: 0.5, flare: 0.85, orb: { dx: 0.6, dy: -4.1, r: 2.3, glow: 1 } },
  // It sinks to the palm, and soaks in.
  { a: H(3.2, 9.8, 3.2), orb: { dx: 0.5, dy: -1.5, r: 1.1, glow: 0.7, trail: [[0.5, -2.9], [0.5, -4.0]] } },
  { a: H(3.0, 9.4, 2.6), palm: 1, flare: 0.3 },
  { a: H(2.0, 6.8, -0.6), palm: 0.35 },
  {},
];

/** Slots of the idle moment in playing order, holds and repeats included (8 fps). */
const REST_ORDER = [0, 1, 1, 2, 3, 4, 5, 6, 7, 7, 8, 9, 8, 9, 8, 10, 10, 10, 11, 12, 11, 12, 11, 10, 13, 14, 15, 15, 16];

/**
 * The idle moment, drawn facing the viewer only. It starts and ends on the
 * idle's first frame exactly, so it swaps in and out without a pop.
 */
function rest(view: View): Pose[] {
  if (view !== 'down') return [];
  const keys = S.blood ? BLOOD_REST : BONE_REST;
  return keys.map((k, i) => {
    const p = idle('down')[0];
    const edge = i === 0 || i === keys.length - 1;
    if (k.a) p.a = { ...k.a };
    p.breath = k.breath ?? 0;
    p.palm = k.palm ?? 0;
    p.flare = k.flare ?? 0;
    p.blink = k.blink;
    p.head = k.head;
    p.skull = k.skull;
    p.orb = k.orb;
    // The robe settles a beat behind the arm; the fire keeps flickering.
    if (!edge) p.sway += Math.sin(i * 0.9) * 0.3;
    p.tick = edge ? 0 : i;
    return p;
  });
}

// ---------------------------------------------------------------------------
// Frame generation

export type NecroAnim = 'idle' | 'walk' | 'cast' | 'raise' | 'rest';

export interface NecroAnimDef {
  name: NecroAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Frame indices to play, in order, when some are held or repeated. */
  order?: readonly number[];
}

export const NECRO_ANIMS: NecroAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 9, loop: true, poses: walk },
  { name: 'cast', fps: 16, loop: false, poses: cast },
  { name: 'raise', fps: 10, loop: false, poses: raise },
  { name: 'rest', fps: 8, loop: false, poses: rest, order: REST_ORDER },
];

/** Frame index at which each spell is released. */
export const RELEASE_FRAME = { cast: 2, raise: 4 } as const;

export interface NecroFrame {
  key: string; // e.g. "walk_left_3"
  anim: NecroAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawNecroFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(NECRO_W, NECRO_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildNecroFrames(look: NecroLook = NECRO_LOOK): NecroFrame[] {
  S = look;
  const out: NecroFrame[] = [];
  for (const a of NECRO_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawNecroFrame(dir, pose) });
      });
    }
  }
  S = NECRO_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Ability icons (16x16)

/** Colours the bonecaller's icons are painted in: soul fire brightest first, the outline, and the gravedigger's flourishes. */
export interface SoulIconColors {
  light: [string, string, string, string];
  outline: string;
  socket: string;
  /** Clods of grave dirt flung off the bolt, and a spade driven into the mound. */
  grave?: boolean;
}
export const SOUL_ICON: SoulIconColors = { light: ['#f0fff8', '#9dffd4', '#3fe0a0', '#127a62'], outline: '#06281e', socket: '#0c3a2c' };
export const DIGGER_ICON: SoulIconColors = { light: ['#f6ffe0', '#d4ff8a', '#8ad83a', '#3a6a1a'], outline: '#0e1e06', socket: '#16300a', grave: true };

/** The soul bolt: a green wisp with a skull's face, its flame streaming back. */
export function soulBoltIcon(k: SoulIconColors = SOUL_ICON): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  // The tail, streaming up and back to the upper right.
  for (let i = 0; i < 9; i++) {
    const x = 8 + i * 0.7;
    const y = 8 - i * 0.75;
    const w = 2.6 - i * 0.25;
    for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
      const d = Math.abs(dx) / w;
      if (d > 1) continue;
      put(Math.round(x + dx * 0.7), Math.round(y + dx * 0.7), d < 0.35 ? k.light[1] : d < 0.7 ? k.light[2] : k.light[3]);
    }
  }
  // The head: a round skull of light.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 6, y + 0.5 - 10);
      if (d <= 2.2) put(x, y, k.light[0]);
      else if (d <= 3.4) put(x, y, k.light[1]);
      else if (d <= 4.2) put(x, y, k.light[2]);
    }
  }
  outline(k.outline);
  // Sockets and teeth.
  put(4, 9, k.socket);
  put(7, 9, k.socket);
  put(5, 12, k.light[3]);
  put(6, 12, k.light[0]);
  put(7, 12, k.light[3]);
  // Clods of grave dirt tumbling off its tail.
  if (k.grave) for (const [x, y, c] of [[13, 4, '#8a6446'], [14, 5, '#4a3226'], [12, 1, '#6a4a36'], [15, 2, '#8a6446'], [10, 0, '#4a3226']] as const) put(x, y, c);
  return px;
}

/** Raise dead: a skeletal hand clawing up out of a grave mound, soul fire rising (and, for the gravedigger, his spade stuck in the mound). */
export function raiseIcon(k: SoulIconColors = SOUL_ICON): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  // The mound.
  for (let y = 11; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const q = Math.hypot((x + 0.5 - 8) / 7.5, (y + 0.5 - 15.5) / 4);
      if (q <= 1) put(x, y, q < 0.5 ? '#6a4a36' : y < 13 ? '#8a6446' : '#4a3226');
    }
  }
  // The forearm and hand, fingers splayed.
  const bone = ['#f8f2da', '#dcd4b4', '#a39d84'];
  for (let y = 7; y <= 12; y++) {
    put(7, y, bone[1]);
    put(8, y, bone[0]);
  }
  for (const [x, y] of [[6, 6], [7, 6], [8, 6], [9, 6]]) put(x, y, bone[0]);
  // Fingers: bent claws.
  for (const [x0, len, lean] of [[5, 3, -1], [7, 4, 0], [9, 4, 0], [10, 3, 1]] as const) {
    for (let i = 1; i <= len; i++) put(x0 + (i === len ? lean : 0), 6 - i, i === len ? bone[1] : bone[0]);
  }
  put(4, 8, bone[1]);
  put(5, 7, bone[0]);
  if (k.grave) {
    // The spade, leaning in the mound: an ash handle and an iron blade.
    for (let i = 0; i < 6; i++) put(12 + Math.round(i * 0.35), 4 + i, i < 2 ? '#a07a52' : '#76563a');
    for (const [x, y, c] of [[13, 10, '#9aa2a8'], [14, 10, '#6a727a'], [13, 11, '#8e969a'], [14, 11, '#464c54'], [14, 12, '#6a727a']] as const) put(x, y, c);
    put(11, 3, '#76563a');
    put(12, 3, '#76563a');
  }
  outline('#1a1814');
  // Soul fire rising round it.
  const [, hot, mid, deep] = k.light;
  for (const [x, y, c] of [[2, 4, mid], [3, 2, hot], [13, 5, mid], [12, 3, hot], [13, 1, mid], [1, 9, deep], [14, 9, deep]] as const) {
    if (k.grave && x >= 12 && y >= 3) continue;
    put(x, y, c);
  }
  if (k.grave) for (const [x, y, c] of [[10, 2, mid], [11, 0, hot]] as const) put(x, y, c);
  return px;
}

/** The tomb king's bolt: an ankh of blue soul fire, a trail of sand blowing off behind it. */
export function ankhBoltIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  // The sand trail, streaming down to the lower left.
  for (const [x, y, c] of [[3, 13, '#c8a060'], [2, 14, '#8a6a3a'], [4, 11, '#e8c880'], [1, 12, '#8a6a3a'], [5, 13, '#c8a060'], [3, 10, '#8a6a3a']] as const) put(x, y, c);
  // The loop.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot((x + 0.5 - 9.5) / 2.6, (y + 0.5 - 4) / 3.2);
      if (d <= 1 && d >= 0.45) put(x, y, d < 0.7 ? '#f4fbff' : '#a8dcff');
    }
  }
  // The crossbar and the stem, gold edged.
  for (let x = 5; x <= 14; x++) {
    put(x, 8, x === 5 || x === 14 ? '#3c94f0' : '#a8dcff');
    put(x, 9, '#3c94f0');
  }
  for (let y = 10; y <= 15; y++) {
    put(9, y, '#f4fbff');
    put(10, y, '#a8dcff');
  }
  outline('#08142e');
  for (const [x, y] of [[9, 7], [10, 7], [11, 9]]) put(x, y, '#ffd678');
  return px;
}

/** Tomb guard: a mummy's wrapped arm clawing up out of the sand, blue fire rising round it. */
export function tombRaiseIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let y = 11; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const q = Math.hypot((x + 0.5 - 8) / 7.5, (y + 0.5 - 15.5) / 4);
      if (q <= 1) put(x, y, q < 0.5 ? '#c8a060' : y < 13 ? '#e8c880' : '#8a6a3a');
    }
  }
  const wrap = ['#f0e6cc', '#cbbd98', '#8a7c5a'];
  for (let y = 6; y <= 12; y++) {
    put(7, y, (y % 2 === 0) ? wrap[1] : wrap[2]);
    put(8, y, (y % 2 === 0) ? wrap[0] : wrap[1]);
  }
  for (const [x, y] of [[6, 5], [7, 5], [8, 5], [9, 5]]) put(x, y, wrap[0]);
  for (const [x0, len, lean] of [[5, 3, -1], [7, 4, 0], [9, 3, 0], [10, 2, 1]] as const) {
    for (let i = 1; i <= len; i++) put(x0 + (i === len ? lean : 0), 5 - i, i === len ? wrap[1] : wrap[0]);
  }
  // A loose strip of linen hanging off the wrist.
  put(9, 8, wrap[1]);
  put(10, 9, wrap[1]);
  put(10, 10, wrap[2]);
  // A gold bracelet.
  put(7, 9, '#f4cf6a');
  put(8, 9, '#ffe89a');
  outline('#1a140a');
  for (const [x, y, c] of [[2, 4, '#3c94f0'], [3, 2, '#a8dcff'], [13, 5, '#3c94f0'], [12, 3, '#a8dcff'], [13, 1, '#3c94f0'], [1, 9, '#1a3894'], [14, 9, '#1a3894']] as const) put(x, y, c);
  return px;
}

/** Colours the blood mage's icons are painted in, brightest first, and the outline. */
export interface BloodIconColors {
  light: [string, string, string, string, string];
  outline: string;
  /** Little black bats fluttering off it (the vampire lord). */
  bats?: boolean;
}
export const BLOOD_ICON: BloodIconColors = { light: ['#fff0f0', '#ff8a96', '#e8243c', '#a8102a', '#7a0a1e'], outline: '#1e0208' };
/** The wyrmblood's: molten, running from white-gold to cinder. */
export const WYRM_ICON: BloodIconColors = { light: ['#fff8e0', '#ffc860', '#ff6a1a', '#b82a0a', '#5a1206'], outline: '#1a0602' };
/** The vampire lord's: dark blood, near black at its deepest, with bats. */
export const VAMPIRE_ICON: BloodIconColors = { light: ['#ffe8ec', '#ff6a7a', '#c0102a', '#7a0618', '#3a0410'], outline: '#0c0004', bats: true };

/** A black bat silhouette, wings spread, two red eyes: drawn over an icon at (x, y). */
function iconBat(put: (x: number, y: number, c: string) => void, x: number, y: number): void {
  const rows = ['r.....r', 'kr.k.rk', '.kkekk.', '..kkk..', '...k...'];
  const col: Record<string, string> = { k: '#0a070c', r: '#4a2a4a', e: '#ff3048' };
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < 7; dx++) if (col[row[dx]]) put(x + dx - 3, y + dy - 2, col[row[dx]]);
  });
}

/** The blood lance: a crimson spear of blood with drops flung off it. */
export function bloodLanceIcon(k: BloodIconColors = BLOOD_ICON): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let i = 0; i < 12; i++) {
    const x = 2 + i;
    const y = 13 - i;
    const tip = i >= 9;
    put(x, y, tip ? k.light[0] : k.light[1]);
    if (!tip) {
      put(x + 1, y, k.light[2]);
      put(x, y + 1, k.light[3]);
    }
    if (i < 5) put(x - 1, y + 1, k.light[4]);
  }
  put(14, 1, k.light[0]);
  put(13, 1, k.light[1]);
  put(14, 2, k.light[1]);
  outline(k.outline);
  for (const [x, y] of [[3, 7], [6, 3], [10, 13], [12, 9]]) put(x, y, k.light[2]);
  if (k.bats) {
    iconBat(put, 4, 3);
    iconBat(put, 11, 12);
  }
  return px;
}

/** The crimson nova: a ring of blood bursting out from a heart of light. */
export function novaIcon(k: BloodIconColors = BLOOD_ICON): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
      const a = Math.atan2(y + 0.5 - 8, x + 0.5 - 8);
      const jag = Math.sin(a * 6) * 0.5;
      if (d <= 1.8) put(x, y, k.light[0]);
      else if (d <= 2.8) put(x, y, k.light[1]);
      else if (Math.abs(d - (6 + jag)) <= 0.9) put(x, y, d < 6 + jag ? k.light[1] : k.light[2]);
    }
  }
  outline(k.outline);
  // Drops flung between the heart and the ring.
  for (const [x, y] of [[8, 4], [12, 8], [8, 12], [4, 8]]) put(x, y, k.light[3]);
  if (k.bats) {
    // Bats bursting out with it.
    iconBat(put, 3, 2);
    iconBat(put, 12, 13);
  }
  return px;
}

/** A little black bat, 7x5, wings up or down: the vampire lord's bats (black, a dusky rim, two red eyes). */
export function batCanvas(up: boolean): Uint8ClampedArray {
  const rows = up ? ['r.....r', 'kr.k.rk', '.kkekk.', '..kkk..', '...k...'] : ['.......', '...k...', '.kkekk.', 'kr.k.rk', 'r.....r'];
  const col: Record<string, [number, number, number]> = { k: [12, 8, 16], r: [70, 40, 70], e: [255, 48, 72] };
  const px = new Uint8ClampedArray(7 * 5 * 4);
  rows.forEach((row, y) => {
    for (let x = 0; x < 7; x++) {
      const c = col[row[x]];
      if (c) px.set([...c, 255], (y * 7 + x) * 4);
    }
  });
  return px;
}
