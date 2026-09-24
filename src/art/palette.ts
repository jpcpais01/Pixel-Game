import { hex, type Material, type RGB } from './pixel';

// Hand-tuned ramps: shadows lean cool and violet, highlights lean warm.
const ramp = (...c: string[]): RGB[] => c.map(hex);

const INK = hex('#120e1f');
const INK_LIT = hex('#2a2250');

export const ROBE: Material = {
  ramp: ramp('#171236', '#251f5c', '#342f8e', '#4747b8', '#6468d8'),
  outline: INK,
  outlineLit: INK_LIT,
};

export const ROBE_INNER: Material = {
  ramp: ramp('#150f33', '#211a52', '#2f2877', '#3d3895'),
  outline: INK,
};

export const GOLD: Material = {
  ramp: ramp('#5b2f1d', '#9a5a26', '#d69a3a', '#f4cf6a', '#fff4bf'),
  outline: hex('#2a140f'),
  shine: true,
};

export const LEATHER: Material = {
  ramp: ramp('#26140f', '#45261a', '#6a3d26', '#8f5a36'),
  outline: INK,
};

export const SKIN: Material = {
  ramp: ramp('#6b3a3a', '#a85f50', '#e09a78', '#f7c9a3'),
  outline: hex('#2a1418'),
  outlineLit: hex('#4a2530'),
};

export const BEARD: Material = {
  ramp: ramp('#5d6180', '#9197b4', '#cdd2e6', '#f4f6ff'),
  outline: hex('#1d1a33'),
  outlineLit: hex('#3a3858'),
};

export const HAIR: Material = {
  ramp: ramp('#4a4c6a', '#767b9c', '#a9aec8', '#d6daea'),
  outline: hex('#1d1a33'),
  outlineLit: hex('#3a3858'),
};

export const WOOD: Material = {
  ramp: ramp('#2c1a16', '#523023', '#7d4f33', '#a9774c'),
  outline: hex('#140c10'),
};

export const BOOT: Material = {
  ramp: ramp('#1a1216', '#33242a', '#4e3a3c', '#6b5452'),
  outline: INK,
};

export const EYE: Material = {
  ramp: ramp('#0c0816', '#0c0816'),
  outline: INK,
  noAO: true,
};

export const CRYSTAL: Material = {
  ramp: ramp('#1b6f9e', '#2fb4e0', '#7ceeff', '#e6ffff'),
  outline: hex('#0b2440'),
  outlineLit: hex('#12406a'),
  emissive: 0.85,
  shine: true,
  noAO: true,
};

// Magic colours (light-only pixels, drawn additively).
export const MAGIC_CORE = hex('#f2ffff');
export const MAGIC_HOT = hex('#9ff6ff');
export const MAGIC_MID = hex('#39c6f0');
export const MAGIC_DEEP = hex('#3a5ce0');
export const MAGIC_VIOLET = hex('#8a55f0');

// ---------------------------------------------------------------------------
// The warrior: cool polished steel, a crimson tabard and cape, gold trim.

const STEEL_INK = hex('#0c0f18');

export const STEEL: Material = {
  ramp: ramp('#1d2233', '#353f58', '#5a6883', '#8f9db8', '#cdd8ea'),
  outline: STEEL_INK,
  outlineLit: hex('#232a3e'),
  shine: true,
};

/** Chainmail: darker, duller steel for sleeves and the mail skirt. */
export const MAIL: Material = {
  ramp: ramp('#191d29', '#2b3244', '#434d63', '#5f6b84'),
  outline: STEEL_INK,
};

export const BLADE: Material = {
  ramp: ramp('#4a5878', '#8d9dbd', '#cbd7ec', '#f4f8ff'),
  outline: hex('#10141f'),
  outlineLit: hex('#1e2638'),
  shine: true,
  noAO: true,
};

export const CRIMSON: Material = {
  ramp: ramp('#360b1b', '#611326', '#8f2033', '#bd383d', '#df6556'),
  outline: hex('#1a0710'),
  outlineLit: hex('#3b1020'),
};

export const TROUSER: Material = {
  ramp: ramp('#1b1824', '#2c2839', '#413b53', '#58506c'),
  outline: INK,
};

// Ember colours for the warrior's special (light-only pixels).
export const EMBER_CORE = hex('#fff8e0');
export const EMBER_HOT = hex('#ffd66b');
export const EMBER_MID = hex('#ff9a2e');
export const EMBER_DEEP = hex('#d9432b');

// ---------------------------------------------------------------------------
// The paladin: bright white-silver plate, a royal azure cape and shield, an
// ivory tabard, gold trim and holy light.

const PLATE_INK = hex('#0e1120');

export const PLATE: Material = {
  ramp: ramp('#262b41', '#48536f', '#7f8ba8', '#bcc6dc', '#eef2fb'),
  outline: PLATE_INK,
  outlineLit: hex('#262d45'),
  shine: true,
};

/** Plate on the legs and arms: the same steel, a step darker so the body reads first. */
export const PLATE_DARK: Material = {
  ramp: ramp('#1e2236', '#394260', '#626f8e', '#96a3bf'),
  outline: PLATE_INK,
};

export const AZURE: Material = {
  ramp: ramp('#0d1640', '#182b70', '#2544a0', '#3866c9', '#5a92e6'),
  outline: hex('#070b22'),
  outlineLit: hex('#12204f'),
};

export const IVORY: Material = {
  ramp: ramp('#5a4b45', '#948273', '#c9baa2', '#ede3cf'),
  outline: hex('#1f1614'),
  outlineLit: hex('#3a2d28'),
};

/** Holy light that glows in the dark: the shield's sun and the mace when blessed. */
export const HALLOW: Material = {
  ramp: ramp('#c98a2a', '#f2c65a', '#fff0a8', '#fffdf0'),
  outline: hex('#3a2410'),
  emissive: 0.7,
  shine: true,
  noAO: true,
};

// Holy colours (light-only pixels): white-gold light with an azure edge.
export const HOLY_CORE = hex('#fffdf0');
export const HOLY_HOT = hex('#fff0a8');
export const HOLY_MID = hex('#ffd35c');
export const HOLY_SKY = hex('#8cc8ff');
