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
// The Pyromancer wizard: a smouldering crimson robe over charcoal, molten-gold
// trim that glows faintly, an ash-white beard, a charred staff and an ember crystal.
// Its magic uses the EMBER colours above.

export const PYRO_ROBE: Material = {
  ramp: ramp('#1e0a0c', '#3a1014', '#5e1a1a', '#8a2a1e', '#b8432a'),
  outline: INK,
  outlineLit: hex('#2a0c10'),
};

export const PYRO_INNER: Material = {
  ramp: ramp('#120808', '#221010', '#341816', '#48221e'),
  outline: INK,
};

/** Molten gold: the trim smoulders in the dark. */
export const PYRO_TRIM: Material = {
  ramp: ramp('#5a1e0c', '#a8481a', '#e88a2a', '#ffc85a', '#fff0b0'),
  outline: hex('#2a0c08'),
  shine: true,
  emissive: 0.3,
};

/** A beard gone ash-white in the heat, warm against the crimson. */
export const PYRO_BEARD: Material = {
  ramp: ramp('#5a4644', '#8c7470', '#c2aca2', '#f2e4d8'),
  outline: hex('#1e0e0c'),
  outlineLit: hex('#3a2220'),
};

export const CHAR_WOOD: Material = {
  ramp: ramp('#120a0a', '#261412', '#3e2018', '#5a3020'),
  outline: hex('#080404'),
};

export const EMBER_CRYSTAL: Material = {
  ramp: ramp('#8a1e0e', '#e0501c', '#ffa63a', '#fff2c0'),
  outline: hex('#2a0806'),
  outlineLit: hex('#4a1008'),
  emissive: 0.9,
  shine: true,
  noAO: true,
};

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

// ---------------------------------------------------------------------------
// The Jedi: an oat-coloured tunic under a brown hooded robe, a silver saber
// hilt and a blade of light. The Sith skin: black robes, the hood up, amber
// eyes and a red blade.

export const JEDI_ROBE: Material = {
  ramp: ramp('#22140e', '#3d2517', '#5c3b24', '#7d5634', '#a0774b'),
  outline: hex('#120a08'),
  outlineLit: hex('#2c1a12'),
};

export const JEDI_TUNIC: Material = {
  ramp: ramp('#554333', '#86705a', '#b69d7c', '#dcc9a4'),
  outline: hex('#1e1510'),
  outlineLit: hex('#382a20'),
};

export const JEDI_HAIR: Material = {
  ramp: ramp('#26140d', '#452716', '#6a3f22', '#93602f'),
  outline: hex('#140a07'),
};

export const SITH_ROBE: Material = {
  ramp: ramp('#09080d', '#141219', '#211e28', '#312d3a', '#46404f'),
  outline: hex('#030205'),
  outlineLit: hex('#17141d'),
};

export const SITH_TUNIC: Material = {
  ramp: ramp('#12090c', '#221117', '#351a22', '#4b2530'),
  outline: hex('#030205'),
};

export const SITH_EYE: Material = {
  ramp: ramp('#ffb23a', '#fff0a0'),
  outline: hex('#030205'),
  emissive: 1,
  noAO: true,
};

/** Hilt metal: dark bands between bright chrome. */
export const HILT_DARK: Material = {
  ramp: ramp('#07070b', '#16161e', '#2a2a36'),
  outline: hex('#050408'),
};

/** A saber blade: a white-hot core and the coloured light around it. Blades cast no outline. */
const blade = (core: string[], edge: string[]): { core: Material; edge: Material } => ({
  core: { ramp: ramp(...core), outline: INK, emissive: 1, noAO: true, noOutline: true },
  edge: { ramp: ramp(...edge), outline: INK, emissive: 1, noAO: true, noOutline: true },
});

export const SABER_BLUE = blade(['#d6f6ff', '#f6feff'], ['#2a7cff', '#4aa6ff', '#86d2ff']);
export const SABER_RED = blade(['#ffe0da', '#fff6f2'], ['#c81628', '#f0283a', '#ff6a62']);

// Saber light (light-only pixels).
export const SABER_BLUE_GLOW = hex('#3f9cff');
export const SABER_RED_GLOW = hex('#ff2a3a');

// ---------------------------------------------------------------------------
// The fighter: a sleeveless off-white gi with a black belt over indigo
// trousers, a red headband, taped forearms and red leather gloves.

export const GI: Material = {
  ramp: ramp('#4a4466', '#7c7896', '#b8b3c8', '#e6e0d6', '#fffaf0'),
  outline: hex('#15121f'),
  outlineLit: hex('#2c2840'),
};

export const GI_TROUSER: Material = {
  ramp: ramp('#12132e', '#1f2352', '#2f387e', '#4552a6'),
  outline: INK,
};

export const BLACK_BELT: Material = {
  ramp: ramp('#0b0a10', '#19161f', '#2b2735', '#433d50'),
  outline: hex('#050408'),
};

export const HEADBAND: Material = {
  ramp: ramp('#4a0c16', '#8a1822', '#c92e2e', '#f25a48'),
  outline: hex('#1c070c'),
};

export const GLOVE: Material = {
  ramp: ramp('#3d0a14', '#7a1420', '#bd262c', '#ea4838', '#ff8c66'),
  outline: hex('#1c070c'),
  outlineLit: hex('#3a0e16'),
  shine: true,
};

/** Hand and foot tape. */
export const WRAP: Material = {
  ramp: ramp('#5c5670', '#968fa8', '#cfc9d8', '#f2eef4'),
  outline: hex('#1a1624'),
};

export const FIGHTER_HAIR: Material = {
  ramp: ramp('#0f0c14', '#1e1824', '#322838', '#4c3c4c'),
  outline: hex('#060409'),
};

// Chi (light-only pixels): the special's fists of fire.
export const CHI_CORE = hex('#fffbe8');
export const CHI_HOT = hex('#ffd66b');
export const CHI_MID = hex('#ff8a36');

// ---------------------------------------------------------------------------
// The alchemist: a plague doctor in a plum greatcoat and shoulder mantle, a
// black wide-brimmed hat, a bone-white beaked mask with glowing green lenses,
// and a bandolier of poison vials across the chest.

const PLUM_INK = hex('#0b0612');

export const PLAGUE_COAT: Material = {
  ramp: ramp('#1f1229', '#341d4a', '#4d2d66', '#6a4484', '#8c62a4'),
  outline: PLUM_INK,
  outlineLit: hex('#1e1030'),
};

export const MANTLE: Material = {
  ramp: ramp('#150c1e', '#251634', '#3a234f', '#52346c'),
  outline: PLUM_INK,
};

export const PLAGUE_HAT: Material = {
  ramp: ramp('#09080d', '#15131c', '#24202e', '#383244', '#4e4760'),
  outline: hex('#040308'),
  outlineLit: hex('#15121c'),
};

/** The beaked mask: waxed leather gone the colour of old bone. */
export const BEAK: Material = {
  ramp: ramp('#4e3e34', '#85705a', '#b9a283', '#e0cfad', '#fbf1d6'),
  outline: hex('#1e140f'),
  outlineLit: hex('#3a2a20'),
};

/** Goggle lenses lit from within by the fumes. */
export const LENS: Material = {
  ramp: ramp('#1f7a22', '#3fc02a', '#6ee83a', '#98f850'),
  outline: hex('#0c1a08'),
  emissive: 0.55,
  noAO: true,
};

export const GLASS: Material = {
  ramp: ramp('#26404c', '#4d7886', '#8fc0c8', '#d8f6f4'),
  outline: hex('#0a141a'),
  shine: true,
  noAO: true,
};

/** The poison itself: it glows. */
export const TOXIN: Material = {
  ramp: ramp('#1e6a1a', '#3fae2a', '#6ee03a', '#a8ff4a'),
  outline: hex('#0a1a06'),
  emissive: 0.75,
  noAO: true,
};

// Toxic light (light-only pixels): fumes, bubbles and splashes.
export const TOX_CORE = hex('#f2ffd2');
export const TOX_HOT = hex('#b8ff5c');
export const TOX_MID = hex('#52d62e');
export const TOX_DEEP = hex('#1c7a3a');

// ---------------------------------------------------------------------------
// The hex witch (the alchemist's other look): a crooked pointed hat, long
// silver hair round a pale green face, a tattered robe of deep swamp teal
// under an aubergine shawl, and a brew that glows violet.

export const WITCH_ROBE: Material = {
  ramp: ramp('#0a171c', '#132a33', '#1c404a', '#285a62', '#3c7a7a'),
  outline: hex('#04090c'),
  outlineLit: hex('#0c1c22'),
};

export const WITCH_SHAWL: Material = {
  ramp: ramp('#1a0d1a', '#2e182e', '#472744', '#61395c'),
  outline: hex('#0a040c'),
};

export const WITCH_SKIN: Material = {
  ramp: ramp('#2c4634', '#517652', '#80a474', '#b2cc9c', '#dcebc4'),
  outline: hex('#0c180e'),
  outlineLit: hex('#1e3222'),
};

export const WITCH_HAIR: Material = {
  ramp: ramp('#433d58', '#716a8c', '#a7a0c2', '#dcd8ee'),
  outline: hex('#161222'),
  outlineLit: hex('#2c2640'),
};

/** Her eyes, lit from within like the brew. */
export const HEX_EYE: Material = {
  ramp: ramp('#861c9c', '#cc3cdc', '#f56cf0', '#ffb2fa'),
  outline: hex('#1a0620'),
  emissive: 0.6,
  noAO: true,
};

export const HEX_BREW: Material = {
  ramp: ramp('#581a76', '#9a30b6', '#d24ee0', '#ff92f4'),
  outline: hex('#1a0620'),
  emissive: 0.75,
  noAO: true,
};

export const HEX_CORE = hex('#fff0fe');
export const HEX_HOT = hex('#ff9cf2');
export const HEX_MID = hex('#d64ce0');

// ---------------------------------------------------------------------------
// Chemtech (the alchemist's gameplay subtype): an undercity chem-tinker in a
// charcoal rubber coat and leather apron, rusted copper pauldrons, a steel
// helmet over a black gas mask with twin filters and round acid lenses, a
// pressure tank on the back and canisters of glowing chartreuse chem.

export const CHEM_COAT: Material = {
  ramp: ramp('#14171a', '#23292b', '#343d3e', '#4b5756', '#687673'),
  outline: hex('#06070a'),
  outlineLit: hex('#15171c'),
};

/** Rusted copper pauldrons. */
export const CHEM_COPPER: Material = {
  ramp: ramp('#26110b', '#4a2314', '#76391d', '#a2582b', '#cc8446'),
  outline: hex('#120805'),
  shine: true,
};

/** Helmet, tank and canisters: dark gunmetal. */
export const CHEM_STEEL: Material = {
  ramp: ramp('#121419', '#23272f', '#373d48', '#535b69', '#7d8796'),
  outline: hex('#07080b'),
  outlineLit: hex('#1a1d24'),
  shine: true,
};

/** The gas mask's black rubber. */
export const CHEM_RUBBER: Material = {
  ramp: ramp('#101114', '#1e2024', '#2f3238', '#454a52'),
  outline: hex('#030304'),
};

/** Round lenses lit by the chem. */
export const CHEM_LENS: Material = {
  ramp: ramp('#5f6e0c', '#9cba16', '#d2ec34', '#f2ff86'),
  outline: hex('#121606'),
  emissive: 0.6,
  noAO: true,
};

export const CHEM_BREW: Material = {
  ramp: ramp('#46660a', '#82ac12', '#c2e21e', '#eeff5c'),
  outline: hex('#101806'),
  emissive: 0.8,
  noAO: true,
};

export const CHEM_CORE = hex('#fbffd6');
export const CHEM_HOT = hex('#e2ff4a');
export const CHEM_MID = hex('#a6d80e');

// ---------------------------------------------------------------------------
// The archer: a ranger in a forest-green hooded cloak over a moss tunic and a
// tan leather jerkin, auburn hair under the hood, a yew longbow and a quiver
// of red-fletched arrows on the back.

export const RANGER_CLOAK: Material = {
  ramp: ramp('#0f1d14', '#1b3321', '#2a4d30', '#3d6b41', '#578a55'),
  outline: hex('#060d08'),
  outlineLit: hex('#12241a'),
};

export const RANGER_TUNIC: Material = {
  ramp: ramp('#23260f', '#3a3f1a', '#555c28', '#737b3a', '#939a52'),
  outline: hex('#0c0e06'),
};

export const JERKIN: Material = {
  ramp: ramp('#2a170e', '#4a2c1a', '#6e4428', '#93603a', '#b6824f'),
  outline: hex('#140a06'),
  outlineLit: hex('#2a180e'),
};

export const RANGER_HAIR: Material = {
  ramp: ramp('#34140c', '#5e2614', '#8c3c1e', '#b85a2c', '#dc8448'),
  outline: hex('#140604'),
};

/** Yew: pale sapwood, polished by the hand. */
export const YEW: Material = {
  ramp: ramp('#3a1f10', '#65391c', '#94602e', '#c28c4a', '#e6b872'),
  outline: hex('#170c06'),
  outlineLit: hex('#2c1a0c'),
  shine: true,
};

export const BOWSTRING: Material = {
  ramp: ramp('#5e5848', '#8a8270', '#b4ac94'),
  outline: hex('#2a261e'),
  noAO: true,
  noOutline: true,
};

export const FLETCH: Material = {
  ramp: ramp('#4a0e14', '#86202a', '#bc363a', '#e65a4e', '#ff8c72'),
  outline: hex('#1c0608'),
};

// The storm archer (the archer's other look): a hood and cloak of thunderhead
// indigo edged in silver, silver hair, a bow of dark steel strung with living
// lightning, and arrows fletched with it.

export const STORM_CLOAK: Material = {
  ramp: ramp('#0a0d22', '#141a3c', '#20295a', '#303e7c', '#4a5ca2'),
  outline: hex('#04050e'),
  outlineLit: hex('#10142e'),
};

export const STORM_TUNIC: Material = {
  ramp: ramp('#161a26', '#262c3c', '#3a4256', '#525c74', '#707c96'),
  outline: hex('#080a10'),
};

export const STORM_JERKIN: Material = {
  ramp: ramp('#10121c', '#1e2230', '#30364a', '#484f68', '#666e8c'),
  outline: hex('#06070c'),
  outlineLit: hex('#141824'),
};

export const STORM_TRIM: Material = {
  ramp: ramp('#4a5470', '#7a86a6', '#b4c0dc', '#eaf2ff'),
  outline: hex('#141a2a'),
  shine: true,
};

export const STORM_BOW: Material = {
  ramp: ramp('#161826', '#282c40', '#40465e', '#646c8c', '#9ca8cc'),
  outline: hex('#06070c'),
  outlineLit: hex('#141828'),
  shine: true,
};

/** The string and fletching of the storm bow: lightning held still. */
export const ARC: Material = {
  ramp: ramp('#2c6ae0', '#4ab4ff', '#a8e8ff', '#ffffff'),
  outline: hex('#0a1a3a'),
  emissive: 0.9,
  noAO: true,
  noOutline: true,
};

export const ARC_FLETCH: Material = {
  ramp: ramp('#2a5ad8', '#3e9cff', '#8ad8ff', '#e8faff'),
  outline: hex('#0a1636'),
  emissive: 0.7,
  noAO: true,
};

export const STORM_EYE: Material = {
  ramp: ramp('#2a80e0', '#58c4ff', '#b0ecff', '#ffffff'),
  outline: hex('#0a1636'),
  emissive: 0.8,
  noAO: true,
};

// Lightning (light-only pixels): the storm archer's arcs and bolts.
export const BOLT_CORE = hex('#ffffff');
export const BOLT_HOT = hex('#bff0ff');
export const BOLT_MID = hex('#4ab4ff');
export const BOLT_DEEP = hex('#2a5ad8');
