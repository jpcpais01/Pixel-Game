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
// The Void wizard skin: a plum-black hooded robe, silver trim, an obsidian
// staff with a silver crescent, and violet-rose magic with teal sparks.

const VOID_INK = hex('#0a0612');

export const VOID_ROBE: Material = {
  ramp: ramp('#120a1f', '#211537', '#332153', '#4a3072', '#654595'),
  outline: VOID_INK,
  outlineLit: hex('#231838'),
};

/** Hood lining and the robe's open front: a deep wine-magenta. */
export const VOID_LINING: Material = {
  ramp: ramp('#1c0721', '#330e3a', '#4d1856', '#692470'),
  outline: VOID_INK,
};

export const SILVER: Material = {
  ramp: ramp('#262838', '#4b5068', '#858ca8', '#c4cadf', '#f4f6ff'),
  outline: hex('#0e0d18'),
  shine: true,
};

export const OBSIDIAN: Material = {
  ramp: ramp('#0e0b16', '#1f1a2e', '#342c4a', '#51476d'),
  outline: hex('#07050c'),
  shine: true,
};

/** The dark inside of the hood, where only the eyes show. */
export const HOOD_SHADOW: Material = {
  ramp: ramp('#06030b', '#0b0614', '#120a1e'),
  outline: VOID_INK,
  noAO: true,
  noOutline: true,
};

export const VOID_EYE: Material = {
  ramp: ramp('#ff8cf0', '#ffe2fb'),
  outline: VOID_INK,
  emissive: 1,
  noAO: true,
};

/** Pale, cold hands. */
export const PALE_SKIN: Material = {
  ramp: ramp('#4a3450', '#7d6184', '#b79dbc', '#e4d2e6'),
  outline: hex('#1a0f1e'),
  outlineLit: hex('#34233a'),
};

export const VOID_CRYSTAL: Material = {
  ramp: ramp('#5e1a86', '#a642d6', '#e48cff', '#ffe8ff'),
  outline: hex('#1d0830'),
  outlineLit: hex('#3a1057'),
  emissive: 0.85,
  shine: true,
  noAO: true,
};

export const VOID_CORE = hex('#fff0ff');
export const VOID_HOT = hex('#ffa8f4');
export const VOID_MID = hex('#d05cf0');
export const VOID_DEEP = hex('#6a2fd0');
export const VOID_TEAL = hex('#6ff0e0');

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

// ---------------------------------------------------------------------------
// The Jade warrior skin: black lacquered plate laced in brass, a jade
// surcoat and headband, a gold crescent crest, a katana, and jade wind.

const LACQUER_INK = hex('#040509');

export const LACQUER: Material = {
  ramp: ramp('#0b0d12', '#171b24', '#252b37', '#3a4351', '#66728a'),
  outline: LACQUER_INK,
  outlineLit: hex('#161a24'),
  shine: true,
};

/** Arm guards and the skirt of lames: the same lacquer, a step duller. */
export const LACQUER_DARK: Material = {
  ramp: ramp('#0a0c10', '#15181f', '#20242d', '#2f3540'),
  outline: LACQUER_INK,
};

export const JADE: Material = {
  ramp: ramp('#072821', '#0e4334', '#166148', '#22845e', '#3aaa7a'),
  outline: hex('#03120d'),
  outlineLit: hex('#0a2a20'),
};

export const BRASS: Material = {
  ramp: ramp('#33260f', '#634a20', '#977636', '#c9ab5e', '#eee0a0'),
  outline: hex('#1a1208'),
  shine: true,
};

/** Hakama: dark slate trousers. */
export const HAKAMA: Material = {
  ramp: ramp('#12181a', '#1f282b', '#303c40', '#445357'),
  outline: INK,
};

/** Katana steel, with a faint green temper line. */
export const KATANA: Material = {
  ramp: ramp('#3c5550', '#82a39b', '#c5e2d8', '#f2fffa'),
  outline: hex('#0b1512'),
  outlineLit: hex('#18291f'),
  shine: true,
  noAO: true,
};

// Jade wind (light-only pixels) for the blade's glow.
export const WIND_CORE = hex('#f6fff0');
export const WIND_HOT = hex('#b6ffb0');
export const WIND_MID = hex('#3fd98a');
export const WIND_DEEP = hex('#16806a');
