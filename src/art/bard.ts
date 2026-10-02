// The bard, drawn procedurally from a small rig like the necromancer's.
//
// The minstrel: a troubadour in a teal doublet with gold buttons and puffed
// wine sleeves, cream hose and tall brown boots, a wine half-cape over one
// shoulder, chestnut hair to the shoulders under a tilted cap with a long
// white plume. He always has his lute in hand, its honey-wood belly at his
// hip and its neck across his chest; the strumming hand sweeps the strings
// and light spills off them as notes.
//
// The war drummer is the bard's other type on the same rig: broad and bare-
// armed, a fur mantle on the shoulders, a bronze helm with two short horns,
// red war paint across the eyes and a braided ginger beard. A war drum hangs
// at his belly from a strap, red-lacquered with bronze rims and rope lacing,
// and he beats it with two padded mallets; each blow lights the drum's head.
//
// The wildsong minstrel is a skin of the minstrel: a wanderer out of the deep
// wood, face lost in a moss-green hood with two lamps of light for eyes, twigs
// sprouting from its crown, a bark-brown tunic under a full cloak whose hem
// is cut like leaves, a vine belt hung with little brass chimes, and a lute
// grown rather than carved, pale living wood with leaves budding at its head.
// Two wisps of forest light drift round him wherever he goes.
//
// The vagabond is a minstrel of the open road: a wide-brimmed felt hat with
// a hawk's feather in its band, shaggy hair and a stubbled chin, a striped
// scarf, a long ochre duster worn open over a rust waistcoat and patched at
// the elbows and skirts, and a bedroll strapped across his back. He plays a
// banjo, its round vellum head ringed in nickel, a fifth peg halfway up the
// neck; his music is the lavender of the sky at dusk, blown about like
// dandelion seeds.
//
// The fadista sings fado, Coimbra's way: a long black student's cape over
// his shoulders, its collar turned up behind his head, a black frock coat
// buttoned to a white collar, black hair combed back, a blue-and-white
// swallow pinned to his breast. He plays the Portuguese guitar, its spruce
// belly round as a pear and its head a gleaming fan of tuning screws; his
// notes fly as swallows and azulejo tiles, in cobalt and white.
//
// Orpheus, whose song moved the dead: golden curls under a wreath of golden
// laurel, its violet ribbons trailing behind, a white chiton bordered in a
// gold key pattern and belted with gold cord, a violet himation over one
// shoulder pinned with a gold brooch, bare arms banded in gold, sandals laced
// up the shins. His golden lyre, its bowl a tortoise shell, never quite stops
// shining; its light is gold with the violet of the underworld at its edge.
//
// The skald sings the sagas of the north: an iron spangenhelm with a nasal
// guard over flaxen braids, a beard braided in two, a bearskin over his
// shoulders clasped with a gold trefoil, a blue-grey wool tunic with a madder
// braid at its hem, gold rings on his arms and linen wrapped up his shins. He
// plays a carved round lyre, the old northern kind with a hand-hole through
// its head and knotwork on its frame; his music flies as runes, pale gold
// edged in ice blue.
//
// The taiko drummer is a skin of the war drummer: a white hachimaki tied
// round his brow, its ends flicking, his black hair up in a knot; an indigo
// happi coat with a white collar band, white waves at its hem and a white
// crest on its back, tied with a vermilion obi; bare arms with indigo hand
// guards, dark momohiki and split-toed tabi. His drum is a barrel-bodied
// odaiko of lacquered zelkova, brass tacks round its heads, a vermilion cord
// round its belly and three commas painted on its skin, beaten with long
// hinoki bachi; its blows break like brushed waves in vermilion and gold.
//
// The body keeps to the 24x32 box; frames are larger so the mallets can be
// raised overhead and the plume can stream back. Hands are posed in the
// bard's own terms (forward, out to the side, height) and placed per view.

import { PixelCanvas, cyl, hex, sphere, type Material, type NormalFn, type RGB } from './pixel';
import { poly } from './shapes';
import { BONE, BOOT, EYE, GOLD, LEATHER, SKIN } from './palette';
import { iconPainter } from './effects';
import { DIRS, type Dir } from './wizard';

export const BARD_W = 48;
export const BARD_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const BARD_ORIGIN_X = BODY_X + 12;
export const BARD_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet that notes leave the lute at. */
export const NOTE_H = 13;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#120e1f');

// ---------------------------------------------------------------------------
// Materials

const DOUBLET: Material = { ramp: ramp('#0c2430', '#143e50', '#1d6076', '#2c889c', '#4cb2bc'), outline: INK, outlineLit: hex('#0e2a38') };
const WINE: Material = { ramp: ramp('#240812', '#421022', '#6a1a34', '#922846', '#b84660'), outline: INK, outlineLit: hex('#2c0a18') };
const SHIRT: Material = { ramp: ramp('#6a6258', '#a89e8a', '#d8d0bc', '#f6f0e0'), outline: hex('#221c18') };
const HOSE: Material = { ramp: ramp('#5a4e44', '#8a7c68', '#b8a88c', '#dccdae'), outline: INK };
const TALL_BOOT: Material = { ramp: ramp('#1e120c', '#3a2216', '#583420', '#7a4a2c'), outline: INK };
export const CHESTNUT: Material = { ramp: ramp('#26120a', '#442214', '#683820', '#8e5432'), outline: hex('#140a08'), outlineLit: hex('#2a140c') };
export const PLUME: Material = { ramp: ramp('#8a8698', '#c2c0cc', '#e8e6ea', '#ffffff'), outline: hex('#2a2634'), outlineLit: hex('#4a4658') };
export const LUTE: Material = { ramp: ramp('#2e1406', '#5a2c10', '#8a4a1c', '#b87030', '#e0a050'), outline: hex('#1a0c06'), shine: true };
export const ROSEWOOD: Material = { ramp: ramp('#160a08', '#2e1610', '#4a2418', '#663424'), outline: hex('#0a0404') };
const HOLE: Material = { ramp: ramp('#0a0404', '#140806'), outline: hex('#0a0404'), noAO: true, noOutline: true };
export const STRING: Material = { ramp: ramp('#8a8070', '#c8bea8', '#f4ecd8'), outline: hex('#1a0c06'), noOutline: true, noAO: true };

const FUR: Material = { ramp: ramp('#2a2018', '#46382a', '#665440', '#8a7658', '#a8946e'), outline: hex('#140e0a'), outlineLit: hex('#241a12') };
const BRONZE: Material = { ramp: ramp('#2a140a', '#522c14', '#7e4c22', '#a8743a', '#d0a060'), outline: hex('#140a04'), shine: true };
const IRON: Material = { ramp: ramp('#18181f', '#2c2c36', '#44444f', '#62626e', '#8e8e9a'), outline: hex('#0a0a0e'), shine: true };
const VEST: Material = { ramp: ramp('#1c100c', '#321c14', '#4c2c1e', '#664030'), outline: INK };
const WARPAINT: Material = { ramp: ramp('#5a0a0e', '#8a1418', '#b82024'), outline: hex('#2a0406'), noOutline: true };
const GINGER: Material = { ramp: ramp('#4a1a0a', '#7a3012', '#aa4c1c', '#d0703a'), outline: hex('#1e0a04'), outlineLit: hex('#34120a') };
const KILT: Material = { ramp: ramp('#1e0e0c', '#3a1814', '#5c2820', '#7a3a2c'), outline: INK };
const LACQUER: Material = { ramp: ramp('#2a0608', '#4e0c10', '#7a1618', '#a42420', '#c8402e'), outline: hex('#140204'), shine: true };
const HIDE: Material = { ramp: ramp('#8a7a5c', '#b8a480', '#dccaa2', '#f4e6c4'), outline: hex('#3a2a18') };
const ROPE: Material = { ramp: ramp('#8a7a5a', '#c8b88e', '#ece0bc'), outline: hex('#3a2a18'), noOutline: true };
const MALLET: Material = { ramp: ramp('#5a1a14', '#8a2a1e', '#b8482e', '#d8704a'), outline: hex('#1e0806') };
const HANDLE: Material = { ramp: ramp('#2a1810', '#4a2e1c', '#6e4a2c', '#906a42'), outline: hex('#140a06') };

// The wildsong minstrel.
const MOSS: Material = { ramp: ramp('#0a1a10', '#14301c', '#22482a', '#34663a', '#50884a'), outline: hex('#08120a'), outlineLit: hex('#0e2414') };
const BARK: Material = { ramp: ramp('#1c120c', '#322218', '#4a3422', '#664a30', '#846442'), outline: INK };
const LEAF: Material = { ramp: ramp('#2a5222', '#447e30', '#6aac44', '#9ed866'), outline: hex('#10200c') };
const ROOT: Material = { ramp: ramp('#160e0a', '#281c12', '#3c2c1c', '#524028'), outline: INK };
const SAGE: Material = { ramp: ramp('#34443a', '#566c5a', '#7e9a7c', '#aac4a0'), outline: hex('#121a14'), outlineLit: hex('#22302a') };
const BIRCH: Material = { ramp: ramp('#3a2c16', '#6a542c', '#9a7e48', '#c8ac6c', '#ecdc9e'), outline: hex('#1a1208'), shine: true };
const BRANCH: Material = { ramp: ramp('#120e08', '#241c10', '#382c1a', '#4e4026'), outline: hex('#080604') };
/** The dark inside the hood. */
const HOOD_DARK: Material = { ramp: ramp('#040806', '#08100c'), outline: hex('#040806'), noAO: true, noOutline: true };

/** What the minstrel wears, by part. */
interface Dress {
  /** Doublet or tunic. */
  coat: Material;
  /** Sleeve puffs, cape (or cloak) and cap (or hood). */
  cloak: Material;
  /** Cuffs and collar (the wildsong's leaf trim). */
  cuff: Material;
  hose: Material;
  boot: Material;
  hand: Material;
  /** The lute's belly and its neck. */
  lute: Material;
  neck: Material;
  /**
   * Plain sleeves rather than the minstrel's slashed puffs: the upper arm, the
   * forearm, and a short cap of cloth over the shoulder (Orpheus's chiton).
   */
  sleeve?: { upper: Material; fore: Material; cap?: Material };
}

const TROUBADOUR: Dress = { coat: DOUBLET, cloak: WINE, cuff: SHIRT, hose: HOSE, boot: TALL_BOOT, hand: SKIN, lute: LUTE, neck: ROSEWOOD };
const WILDWOOD: Dress = { coat: BARK, cloak: MOSS, cuff: LEAF, hose: ROOT, boot: ROOT, hand: SAGE, lute: BIRCH, neck: BRANCH };

// The harlequin.
const MOTLEY_A: Material = { ramp: ramp('#3a0624', '#620c3c', '#921a5a', '#c02c7a', '#e85a9e'), outline: INK, outlineLit: hex('#2a0418') };
const MOTLEY_B: Material = { ramp: ramp('#0c0a12', '#18141e', '#26202e', '#362e40', '#4a4056'), outline: hex('#050408'), outlineLit: hex('#100c16') };
const RUFF: Material = { ramp: ramp('#8a8494', '#c0bcc8', '#e6e2ec', '#ffffff'), outline: hex('#2a2632') };
const MASK: Material = { ramp: ramp('#8a8494', '#c4c0cc', '#ece8f0', '#ffffff'), outline: hex('#24202c'), outlineLit: hex('#3a3642') };
const LIP: Material = { ramp: ramp('#5a0a1e', '#a8183a', '#e0305a'), outline: hex('#2a0410'), noOutline: true };
const LACQ_BLACK: Material = { ramp: ramp('#08060a', '#141018', '#221c26', '#342a38', '#5a4a60'), outline: hex('#040306'), shine: true };
const IVORY: Material = { ramp: ramp('#6a6252', '#a89e86', '#d8d0b8', '#f4eedc'), outline: hex('#1a160e') };
const MOTLEY: Dress = { coat: MOTLEY_A, cloak: MOTLEY_B, cuff: RUFF, hose: MOTLEY_A, boot: MOTLEY_B, hand: MASK, lute: LACQ_BLACK, neck: IVORY };

// The moonhowl.
const WOLF: Material = { ramp: ramp('#24262e', '#3e424e', '#626876', '#8e94a2', '#c0c6d0'), outline: hex('#0c0d12'), outlineLit: hex('#1a1c24') };
const WOAD: Material = { ramp: ramp('#1a2a78', '#2c46b0', '#5a7ae8'), outline: hex('#0a1030'), noOutline: true, emissive: 0.35 };
const BLACK_BEARD: Material = { ramp: ramp('#0c0a0c', '#1c181c', '#302a2e', '#463e42'), outline: hex('#050405'), outlineLit: hex('#141014') };
const HIDE_KILT: Material = { ramp: ramp('#2a1c12', '#46301e', '#664a2e', '#86683e'), outline: INK };
const SPIRIT_SHELL: Material = { ramp: ramp('#080a26', '#121848', '#1e286c', '#2e3c94', '#4658bc'), outline: hex('#04050e'), shine: true };
const SINEW: Material = { ramp: ramp('#6a6252', '#a89c80', '#d8ccaa'), outline: hex('#2a2418'), noOutline: true };
const PALE_HIDE: Material = { ramp: ramp('#8a8474', '#b8b09a', '#dcd4bc', '#f2ecd8'), outline: hex('#3a3428') };
const FEATHER: Material = { ramp: ramp('#2a2a30', '#5a5a64', '#9a9aa4', '#e0e0e6'), outline: hex('#0e0e12'), noAO: true };
const NOSE: Material = { ramp: ramp('#060608', '#18181c'), outline: hex('#060608'), shine: true };

/** What the war drummer wears and beats, by part. */
interface Gear {
  /** The mantle and the ruffs at his ankles. */
  fur: Material;
  /** The vest, and the bracers on his forearms. */
  vest: Material;
  paint: Material;
  beard: Material;
  /** The bead binding the beard's braid. */
  bead: Material;
  kilt: Material;
  /** The drum: its shell, rims, lacing and head. */
  shell: Material;
  rim: Material;
  rope: Material;
  hide: Material;
  /** The mallets' handles and heads. */
  handle: Material;
  knob: Material;
}

const WARBAND: Gear = { fur: FUR, vest: VEST, paint: WARPAINT, beard: GINGER, bead: BRONZE, kilt: KILT, shell: LACQUER, rim: BRONZE, rope: ROPE, hide: HIDE, handle: HANDLE, knob: MALLET };
const DARKWOOD: Material = { ramp: ramp('#140e0a', '#2a1e14', '#44321e', '#5e4a2c'), outline: hex('#080504'), shine: true };
const PACK: Gear = { fur: WOLF, vest: WOLF, paint: WOAD, beard: BLACK_BEARD, bead: BONE, kilt: HIDE_KILT, shell: SPIRIT_SHELL, rim: DARKWOOD, rope: SINEW, hide: PALE_HIDE, handle: BONE, knob: WOLF };

// The vagabond.
const DUSTER: Material = { ramp: ramp('#2a1a08', '#503416', '#7e5a26', '#a8843c', '#cca85a'), outline: INK, outlineLit: hex('#22160a') };
const RUST: Material = { ramp: ramp('#280b06', '#4c190c', '#7a2c16', '#a44622', '#c86636'), outline: INK, outlineLit: hex('#220a06') };
const CHARCOAL: Material = { ramp: ramp('#121218', '#22222c', '#343442', '#484858'), outline: INK };
const FELT: Material = { ramp: ramp('#100b08', '#221812', '#38281c', '#4e3c2a', '#665036'), outline: hex('#080504'), outlineLit: hex('#18100a') };
const ASH_HAIR: Material = { ramp: ramp('#2e2014', '#5a4228', '#8a6c40', '#b4955e', '#d2b884'), outline: hex('#140e08'), outlineLit: hex('#22180e') };
/** The scarf: plum wool, striped lighter. */
const PLUM: Material = { ramp: ramp('#1c0c20', '#36183c', '#56285c', '#783e80', '#9a5aa2'), outline: INK, outlineLit: hex('#1a0a1e') };
const HAWK: Material = { ramp: ramp('#2e241c', '#5e4c3c', '#94806a', '#cbb89a', '#efe2c8'), outline: hex('#140e0a'), noAO: true };
const BEDROLL: Material = { ramp: ramp('#14221f', '#223a36', '#34544e', '#4c706a', '#6a908a'), outline: INK };
const NICKEL: Material = { ramp: ramp('#26262c', '#4e5058', '#868a94', '#c4c8d0', '#f2f4f8'), outline: hex('#0c0c10'), shine: true };
const VELLUM: Material = { ramp: ramp('#7e7258', '#ae9f7e', '#d6c9a6', '#f2e8cc'), outline: hex('#2a2216') };
const WALNUT: Material = { ramp: ramp('#180c06', '#2e180c', '#482814', '#62381c'), outline: hex('#0a0503') };
const ROAD: Dress = { coat: DUSTER, cloak: RUST, cuff: SHIRT, hose: CHARCOAL, boot: TALL_BOOT, hand: SKIN, lute: VELLUM, neck: WALNUT, sleeve: { upper: DUSTER, fore: DUSTER } };

// The fadista.
const BATINA: Material = { ramp: ramp('#05060a', '#0d0f17', '#171b27', '#232a3b', '#343d55'), outline: hex('#020204'), outlineLit: hex('#090b12') };
const CAPA: Material = { ramp: ramp('#040509', '#0a0c14', '#131724', '#1d2436', '#2c354d'), outline: hex('#020204'), outlineLit: hex('#080a12') };
const SHOE: Material = { ramp: ramp('#050508', '#121218', '#24242e', '#4a4a58'), outline: hex('#020203'), shine: true };
const RAVEN: Material = { ramp: ramp('#100a08', '#22160f', '#382419', '#503628', '#6c4c38'), outline: hex('#060403'), outlineLit: hex('#140c08') };
const SPRUCE: Material = { ramp: ramp('#4e3214', '#82582a', '#b48848', '#dab474', '#f2d8a2'), outline: hex('#1a0e06'), shine: true };
const AZULEJO: Material = { ramp: ramp('#0a1a5a', '#16308e', '#2a52c4', '#5a86ea', '#9cbcff'), outline: hex('#050a24') };
const LISBON: Dress = { coat: BATINA, cloak: CAPA, cuff: SHIRT, hose: BATINA, boot: SHOE, hand: SKIN, lute: SPRUCE, neck: ROSEWOOD, sleeve: { upper: BATINA, fore: BATINA } };

// Orpheus.
const CHITON: Material = { ramp: ramp('#6a6252', '#9c947e', '#c4bca4', '#e0d8c2', '#f2ecdc'), outline: hex('#26221c'), outlineLit: hex('#3a362e') };
const HIMATION: Material = { ramp: ramp('#1c0826', '#380f46', '#581b6c', '#7c2c92', '#a048b6'), outline: INK, outlineLit: hex('#22081c') };
const CURLS: Material = { ramp: ramp('#482808', '#784c14', '#ac7c2c', '#d8ac54', '#f4d686'), outline: hex('#281404'), outlineLit: hex('#3a2006') };
/** The wreath and the brooch: gold that catches the light even in the dark. */
const BROOCH: Material = { ...GOLD, emissive: 0.22 };
/** Laurel leaves, dark and glossy. */
const LAUREL: Material = { ramp: ramp('#14280e', '#244816', '#3a6c22', '#5a9632', '#8cc456'), outline: hex('#0a1406'), shine: true };
const TORTOISE: Material = { ramp: ramp('#180a04', '#381c0a', '#663814', '#985c22', '#c4883a'), outline: hex('#0c0502'), shine: true };
const LYRE_STRING: Material = { ramp: ramp('#7a5a22', '#b88c3c', '#ecc870'), outline: hex('#2a1606'), noOutline: true, noAO: true, emissive: 0.18 };
const HELLAS: Dress = { coat: CHITON, cloak: HIMATION, cuff: GOLD, hose: SKIN, boot: LEATHER, hand: SKIN, lute: TORTOISE, neck: GOLD, sleeve: { upper: SKIN, fore: SKIN, cap: CHITON } };

// The skald.
/** Undyed wool woven blue-grey, the colour of the northern sea. */
const WADMAL: Material = { ramp: ramp('#161e28', '#263444', '#3a4e62', '#566e84', '#7a94a8'), outline: INK, outlineLit: hex('#141c26') };
/** The bearskin: thick brown fur, frosted lighter at its tips. */
const BEAR: Material = { ramp: ramp('#1a110a', '#302014', '#4a3220', '#664830', '#866646'), outline: hex('#0c0805'), outlineLit: hex('#1c120a') };
/** Flaxen hair and beard. */
const FLAX: Material = { ramp: ramp('#4e3816', '#86662e', '#b8964e', '#dcc07a', '#f4e0a6'), outline: hex('#24180a'), outlineLit: hex('#382610') };
const BREECH: Material = { ramp: ramp('#14110e', '#26201a', '#3a3128', '#50463a'), outline: INK };
/** Linen leg wraps. */
const WRAP: Material = { ramp: ramp('#5e5444', '#8e826a', '#bcb094', '#dcd2b6'), outline: hex('#221c12'), noOutline: true };
/** Tablet-woven braid along the hems: madder red. */
const MADDER: Material = { ramp: ramp('#3a0a08', '#62140e', '#8e2418', '#b43a24'), outline: hex('#1a0404'), noOutline: true };
/** Carved oak, the lyre's frame, dark and oiled. */
const OAK: Material = { ramp: ramp('#1c1008', '#341f0e', '#523418', '#6e4a24', '#8e6636'), outline: hex('#0c0603'), shine: true };
/** The lyre's soundboard: paler maple. */
const MAPLE: Material = { ramp: ramp('#3e2810', '#62421e', '#88602e', '#a87e44', '#c49a5c'), outline: hex('#1e1206'), shine: true };
/** A rune cut in the lyre, holding a little light. */
const RUNE_CUT: Material = { ramp: ramp('#6a8ab0', '#a8ccef', '#e8f4ff'), outline: hex('#0c1a2c'), noOutline: true, noAO: true, emissive: 0.45 };
const SAGA: Dress = { coat: WADMAL, cloak: BEAR, cuff: GOLD, hose: BREECH, boot: LEATHER, hand: SKIN, lute: MAPLE, neck: OAK, sleeve: { upper: WADMAL, fore: WADMAL } };

// The taiko drummer.
/** The happi coat: deep indigo cotton. */
const AI: Material = { ramp: ramp('#080c22', '#121a3e', '#1c285c', '#2a3c80', '#4256a6'), outline: hex('#03040c'), outlineLit: hex('#0a0e22') };
/** White cotton: the collar band, the crest, the headband. */
const COTTON: Material = { ramp: ramp('#767a88', '#acb0bc', '#dcdee6', '#ffffff'), outline: hex('#1e202a') };
/** Vermilion: the obi and the drum's cord. */
const SHU: Material = { ramp: ramp('#480806', '#7c120c', '#b22214', '#de3a1e', '#ff6a3a'), outline: hex('#1c0402'), outlineLit: hex('#360804') };
/** The odaiko's barrel: one trunk of zelkova, lacquered to a warm shine. */
const KEYAKI: Material = { ramp: ramp('#240c04', '#44190a', '#6c2e14', '#94481e', '#c06c34'), outline: hex('#100402'), shine: true };
/** Brass tacks round the head, and the iron ring. */
const TACK: Material = { ramp: ramp('#4a3010', '#8a6420', '#d4a83c', '#fff0a0'), outline: hex('#1a1004'), noOutline: true, shine: true };
/** The bachi: pale hinoki sticks. */
const HINOKI: Material = { ramp: ramp('#7a5c32', '#a88650', '#d0b07a', '#ecd4a2'), outline: hex('#2a1c0a') };
/** Momohiki, tight trousers in the darkest indigo, and the split-toed tabi. */
const MOMOHIKI: Material = { ramp: ramp('#070914', '#0e1226', '#181e3a', '#242c52'), outline: hex('#020308') };
const TABI: Material = { ramp: ramp('#050610', '#0c0e1c', '#181a2e', '#282c46'), outline: hex('#020206') };
const RAVEN_HAIR: Material = { ramp: ramp('#060506', '#121014', '#201c22', '#322c34'), outline: hex('#020202'), outlineLit: hex('#0e0c10') };
const TAIKO: Gear = { fur: AI, vest: AI, paint: SHU, beard: RAVEN_HAIR, bead: GOLD, kilt: MOMOHIKI, shell: KEYAKI, rim: KEYAKI, rope: SHU, hide: HIDE, handle: HINOKI, knob: HINOKI };

/** One look for the bard: its texture key, its instrument, and the light of its music. */
export interface BardLook {
  key: string;
  /** The war drummer, with his drum and mallets, rather than the minstrel with his lute. */
  drum: boolean;
  /** The minstrel's clothes. */
  dress: Dress;
  /** The wildsong: hooded, cloaked in moss, wisps drifting round him. */
  wild?: boolean;
  /** A skin that changes the cut, not just the cloth: the harlequin (a minstrel) or the moonhowl (a drummer). */
  style?: 'harlequin' | 'howl' | 'vagabond' | 'fadista' | 'orpheus' | 'skald' | 'taiko';
  /** The drummer's kit. */
  gear?: Gear;
  /** Light of the music, brightest first. */
  light: [RGB, RGB, RGB, RGB];
}

export const MINSTREL_LOOK: BardLook = {
  key: 'bard',
  drum: false,
  dress: TROUBADOUR,
  light: [hex('#f4fffc'), hex('#a8fff0'), hex('#3fd8c8'), hex('#1a7a8a')],
};

/** The minstrel's wildsong skin: firefly light, gold-green. */
export const WILD_LOOK: BardLook = {
  key: 'bard_wild',
  drum: false,
  dress: WILDWOOD,
  wild: true,
  light: [hex('#fffde6'), hex('#eaffa0'), hex('#9ee85a'), hex('#2e7a3e')],
};

export const DRUMMER_LOOK: BardLook = {
  key: 'bard_drum',
  drum: true,
  dress: TROUBADOUR,
  light: [hex('#fffbe8'), hex('#ffd98a'), hex('#ff9a3a'), hex('#b8401e')],
};

/** The minstrel's harlequin skin: rose and gold. */
export const HARLEQUIN_LOOK: BardLook = {
  key: 'bard_harlequin',
  drum: false,
  dress: MOTLEY,
  style: 'harlequin',
  light: [hex('#fff4fb'), hex('#ffb0e8'), hex('#ff4ab8'), hex('#8a1a6a')],
};

/** The war drummer's moonhowl skin: spirit light, pale indigo. */
export const HOWL_LOOK: BardLook = {
  key: 'bard_howl',
  drum: true,
  dress: TROUBADOUR,
  style: 'howl',
  gear: PACK,
  light: [hex('#f2f4ff'), hex('#bcc8ff'), hex('#6c7cff'), hex('#2c2a9a')],
};

/** The minstrel's vagabond skin: lavender, the sky on the road at dusk. */
export const VAGABOND_LOOK: BardLook = {
  key: 'bard_vagabond',
  drum: false,
  dress: ROAD,
  style: 'vagabond',
  light: [hex('#fbf6ff'), hex('#e2d0ff'), hex('#b08cff'), hex('#5a3aa8')],
};

/** The minstrel's fadista skin: azulejo cobalt and white. */
export const FADISTA_LOOK: BardLook = {
  key: 'bard_fadista',
  drum: false,
  dress: LISBON,
  style: 'fadista',
  light: [hex('#f4f8ff'), hex('#b8d2ff'), hex('#3c7cff'), hex('#1a2e9a')],
};

/** The minstrel's Orpheus skin: gold, with the underworld's violet at its edge. */
export const ORPHEUS_LOOK: BardLook = {
  key: 'bard_orpheus',
  drum: false,
  dress: HELLAS,
  style: 'orpheus',
  light: [hex('#fffdf2'), hex('#ffeeaa'), hex('#ffc84a'), hex('#7a3ab0')],
};

/** The minstrel's skald skin: runes in pale gold, edged in the ice blue of a northern sky. */
export const SKALD_LOOK: BardLook = {
  key: 'bard_skald',
  drum: false,
  dress: SAGA,
  style: 'skald',
  light: [hex('#fffcee'), hex('#ffe8a0'), hex('#8ccfff'), hex('#2c5c9e')],
};

/** The war drummer's taiko skin: vermilion and gold. */
export const TAIKO_LOOK: BardLook = {
  key: 'bard_taiko',
  drum: true,
  dress: TROUBADOUR,
  style: 'taiko',
  gear: TAIKO,
  light: [hex('#fff8e6'), hex('#ffd24a'), hex('#ff4a1e'), hex('#8a1208')],
};

export const BARD_LOOKS = [MINSTREL_LOOK, DRUMMER_LOOK, WILD_LOOK, HARLEQUIN_LOOK, HOWL_LOOK, VAGABOND_LOOK, FADISTA_LOOK, ORPHEUS_LOOK, SKALD_LOOK, TAIKO_LOOK];

/** The look being drawn; set by buildBardFrames. */
let S: BardLook = MINSTREL_LOOK;
/** Its clothes. */
let D: Dress = TROUBADOUR;
/** The drummer's kit. */
let G: Gear = WARBAND;

// ---------------------------------------------------------------------------
// The rig

/** A hand, in the bard's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

export interface Pose {
  /** Whole body raised (walk passing frames, a hop on the beat). */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The strumming hand (or the right mallet) and the hand on the lute's neck (or the left mallet). */
  a: Hand;
  b: Hand;
  /** The mallets: 0 pointing down onto the drum's head, 1 raised high. */
  stickA: number;
  stickB: number;
  /** 0..1 the instrument lit with music. */
  glow: number;
  /** The cape or kilt swinging, in pixels. */
  sway: number;
  tick: number;
  blink?: boolean;
  /** The idle moment's: the head shifted (x, y) in pixels, bobbing to the tune (front view only). */
  head?: [number, number];
  /** Little notes of light floating up off the music. */
  notes?: Note[];
  /** Rings of light spreading over the drum's head from a beat, by radius; `ringK` is their brightness. */
  rings?: number[];
  ringK?: number;
}

/** A floating note at (x, y) in body coordinates (its head's foot), faded by `k`; `two` beams a pair. */
export interface Note {
  x: number;
  y: number;
  k: number;
  two?: boolean;
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
  if (view === 'up') return { x: 12 + side * q.s, y: CH + U - q.h - q.f * 0.8, behind: q.f > 1 };
  // Facing left; `a` is the far arm, a touch higher and behind the body.
  const far = arm === 'a';
  return { x: hx - 1 - q.f * 1.05 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), behind: far && q.f < 1 };
}

/** Light off the strings or the drum: a small cross of it, the arms growing with `k`. */
function glowAt(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.light;
  c.spark(x, y, core, k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + dx, y + dy, hot, 0.6 * k);
  if (k > 0.6) for (const [dx, dy] of [[2, 0], [-2, 0], [0, -2], [1, -1], [-1, -1]]) c.spark(x + dx, y + dy, mid, 0.4 * k);
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

/** The minstrel's arm: a puffed, slashed wine sleeve, a teal forearm, a cream cuff and the hand (in his dress's colours). */
function sleevedArm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bias = 0, swap = false): void {
  const [ex, ey] = elbow(sx, sy, p.x, p.y, reach, hint);
  // The harlequin's sleeves are motley: each arm the other way round.
  const plain = D.sleeve;
  const puff = plain ? plain.upper : swap ? D.coat : D.cloak;
  const fore = plain ? plain.fore : swap ? D.cloak : D.coat;
  c.part();
  if (plain) c.capsule(sx, sy, ex, ey, 1.7, 1.45, puff, { bias });
  else c.capsule(sx, sy, ex, ey, 2.0, 1.6, puff, { bias });
  if (plain?.cap) {
    // A short cap of cloth over the shoulder.
    c.part();
    c.capsule(sx, sy, sx + (ex - sx) * 0.35, sy + (ey - sy) * 0.35, 1.95, 1.75, plain.cap, { bias });
  }
  if (S.style === 'vagabond') {
    // A patch sewn on at the elbow.
    c.part();
    c.px(ex - 0.5, ey - 0.5, BEDROLL, sphere(0, -0.2), { bias: bias + 1 });
  }
  if (S.style === 'skald') {
    // A twisted gold ring round the upper arm, over the sleeve.
    c.part();
    const rx = sx + (ex - sx) * 0.62;
    const ry = sy + (ey - sy) * 0.62;
    c.px(rx - 0.6, ry, GOLD, sphere(-0.4, -0.3), { bias: bias + 1 });
    c.px(rx + 0.6, ry, GOLD, sphere(0.4, -0.3), { bias: bias + 1 });
  }
  // A slash of the doublet down the puff (the wildsong's is all cloak).
  if (!S.wild && !plain) {
    c.part();
    c.px((sx + ex) / 2, (sy + ey) / 2, fore, sphere(0, -0.2), { bias: bias + 1 });
  }
  c.part();
  const wx = ex + (p.x - ex) * 0.8;
  const wy = ey + (p.y - ey) * 0.8;
  c.capsule(ex, ey, wx, wy, 1.35, 1.2, fore, { bias });
  c.part();
  c.ellipse(wx, wy, 1.25, 1.1, D.cuff, { bias });
  c.part();
  c.ellipse(p.x, p.y, 1.15, 1.1, D.hand, { bias });
}

/** The drummer's arm: bare and heavy, a leather bracer on the forearm, a mallet in the fist. */
function bareArm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bias = 0): void {
  const [ex, ey] = elbow(sx, sy, p.x, p.y, reach, hint);
  c.part();
  c.capsule(sx, sy, ex, ey, 1.9, 1.5, SKIN, { bias });
  c.part();
  c.capsule(ex + (p.x - ex) * 0.3, ey + (p.y - ey) * 0.3, p.x, p.y, 1.45, 1.35, G.vest, { bias });
  if (S.style === 'howl') {
    // A band of woad round the upper arm.
    c.part();
    c.px((sx + ex * 2) / 3, (sy + ey * 2) / 3, G.paint, sphere(0, 0), { bias });
  }
  c.part();
  c.ellipse(p.x, p.y, 1.25, 1.2, SKIN, { bias });
}

/** Which way a mallet points from the fist, for `k` from 0 (onto the drum) to 1 (raised). */
function stickDir(view: View, arm: 'a' | 'b', k: number): [number, number] {
  if (view === 'side') {
    const t = ((123 + 164 * k) * Math.PI) / 180;
    return [Math.cos(t), Math.sin(t)];
  }
  // From the front (and the back): down and in onto the drum, round through outward, up and out.
  let t = ((72 + 178 * k) * Math.PI) / 180;
  if (arm === 'b') t = Math.PI - t;
  return [Math.cos(t), Math.sin(t)];
}

/** A mallet in the fist: a short wooden handle and a padded red head, lit on the beat. */
function mallet(c: PixelCanvas, view: View, arm: 'a' | 'b', p: Placed, k: number, glow: number, bias = 0): void {
  const [ux, uy] = stickDir(view, arm, k);
  if (S.style === 'taiko') {
    // Long bachi of pale hinoki, no padded head: a straight stick with a rounded, lighter tip.
    const blen = 6.6;
    c.part();
    c.line(p.x - ux * 1.0, p.y - uy * 1.0, p.x + ux * blen, p.y + uy * blen, G.handle, () => sphere(-uy * 0.5, ux * 0.5 - 0.3), { bias });
    c.part();
    const tx = p.x + ux * (blen + 0.6);
    const ty = p.y + uy * (blen + 0.6);
    c.px(tx, ty, G.handle, sphere(ux * 0.4, uy * 0.4 - 0.5), { bias: bias + 1 });
    if (glow > 0 && k < 0.35) glowAt(c, tx, ty, glow * 0.7);
    return;
  }
  const len = 5.2;
  c.part();
  c.line(p.x - ux * 0.8, p.y - uy * 0.8, p.x + ux * len, p.y + uy * len, G.handle, () => sphere(-uy * 0.5, ux * 0.5 - 0.3), { bias });
  c.part();
  const hx = p.x + ux * (len + 0.6);
  const hy = p.y + uy * (len + 0.6);
  c.ellipse(hx, hy, 1.35, 1.3, G.knob, { bias });
  if (glow > 0 && k < 0.35) glowAt(c, hx, hy, glow * 0.7);
}

/** Legs in hose (or dark wraps) from the hip to the ankle. */
function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0, m?: Material): void {
  c.part();
  c.capsule(hx, hy, fx, fy, 1.55, 1.3, m ?? (S.drum ? G.kilt : D.hose), { bias });
}

/** The minstrel's tall boot with a turned cuff; the drummer's boot wrapped in fur. */
function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  if (S.style === 'orpheus') {
    sandal(c, x, y, side, bias);
    return;
  }
  if (S.style === 'taiko') {
    // Jika-tabi: soft dark cloth to the ankle, the big toe split from the rest.
    c.part();
    if (side) c.ellipse(x, y, 2.1, 1.15, TABI, { flatten: 0.8, bias });
    else c.ellipse(x, y, 1.5, 1.25, TABI, { flatten: 0.8, bias });
    c.part();
    const w = side ? 1.3 : 1.5;
    const top = Math.round(y - 2.2);
    c.shape(top, top + 1, () => [x - w, x + w], TABI, (_x, _y, t) => cyl(t, 0.2), { bias: bias + 1 });
    if (side) c.shade(x - 2, y, -2);
    else c.shade(x - 0.5, y + 1, -2);
    return;
  }
  if (S.style === 'skald') {
    // Low turnshoes, and linen wrapped in a spiral up the shin.
    c.part();
    if (side) c.ellipse(x, y, 2.2, 1.2, D.boot, { flatten: 0.8, bias });
    else c.ellipse(x, y, 1.6, 1.3, D.boot, { flatten: 0.8, bias });
    c.part();
    // Linen strips crossing up the dark trousers, one way and back.
    for (let i = 0; i < 3; i++) {
      const yy = Math.round(y - 1.6 - i * 1.1);
      const o = i & 1 ? 0.6 : -0.6;
      c.px(x + o - 0.5, yy, WRAP, sphere(o, -0.2), { bias: bias + 1 });
      if (!side) c.px(x - o - 0.5, yy, WRAP, sphere(-o, -0.2), { bias: bias + 1 });
    }
    return;
  }
  c.part();
  if (side) c.ellipse(x, y, 2.2, 1.2, S.drum ? BOOT : D.boot, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.6, 1.3, S.drum ? BOOT : D.boot, { flatten: 0.8, bias });
  if (S.style === 'fadista') {
    // Polished shoes: no boot tops, a glint on the toe.
    c.shade(side ? x - 2 : x - 1, y - 1, 1);
    return;
  }
  c.part();
  const w = side ? 1.6 : 1.8;
  const top = Math.round(y - 2.4);
  if (S.drum) {
    // A ruff of fur round the ankle.
    c.shape(top, top + 1, () => [x - w - 0.2, x + w + 0.2], G.fur, (_x, _y, t, u) => sphere(t * 0.8, u - 0.6, 1), { bias: bias + 1 });
    c.shade(x - 1, top + 1, -1);
  } else {
    c.shape(top - 1, top, () => [x - w, x + w], D.boot, (_x, _y, t) => cyl(t, 0.3), { bias: bias + 1 });
  }
}

/** Orpheus's sandal: a bare foot on a leather sole, its laces crossing up the shin. */
function sandal(c: PixelCanvas, x: number, y: number, side: boolean, bias: number): void {
  c.part();
  if (side) c.ellipse(x, y - 0.2, 2.0, 1.0, SKIN, { flatten: 0.8, bias });
  else c.ellipse(x, y - 0.2, 1.4, 1.1, SKIN, { flatten: 0.8, bias });
  c.part();
  const w = side ? 2.2 : 1.6;
  c.shape(Math.round(y + 0.8), Math.round(y + 0.8), () => [x - w, x + w], LEATHER, (_x, _y, t) => cyl(t, 0.4), { bias });
  // The laces, crossing as they climb.
  c.part();
  for (let i = 0; i < 3; i++) {
    const yy = Math.round(y - 1 - i * 1.2);
    const lx = side ? x - 0.6 + (i & 1) : x - 1 + (i & 1) * 1.4;
    c.px(lx, yy, LEATHER, sphere(0, -0.3), { bias: bias + 1 });
    if (!side) c.px(lx + ((i & 1) ? -1 : 1), yy, LEATHER, sphere(0, -0.2), { bias: bias + 1 });
  }
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) c.px(x, y, SKIN, sphere(0, -0.3), { bias: -1 });
    else c.px(x, y, EYE);
  }
}

// ---------------------------------------------------------------------------
// The lute

/**
 * The lute: a pear-shaped honey-wood belly at the strumming hand with a dark
 * sound hole, strings running up a rosewood neck to the other hand, and a
 * pegbox bent back at its end. Light spills off the strings as he plays.
 */
function drawLute(c: PixelCanvas, view: View, p: Pose, fa: Placed, fb: Placed, bias = 0): void {
  const bx = fa.x + (view === 'side' ? -0.3 : 0.9);
  const by = fa.y + 0.6;
  let ux = fb.x - bx;
  let uy = fb.y - by;
  const l = Math.hypot(ux, uy) || 1;
  ux /= l;
  uy /= l;
  const vx = -uy;
  const vy = ux;
  if (S.style === 'orpheus') {
    drawLyre(c, p, bx, by, ux, uy, vx, vy, bias);
    return;
  }
  if (S.style === 'skald') {
    drawRoundLyre(c, p, bx, by, ux, uy, vx, vy, bias);
    return;
  }
  const banjo = S.style === 'vagabond';
  const guitarra = S.style === 'fadista';
  // The neck and its pegbox first, so the belly overlaps its root.
  const n0 = 3.2;
  const n1 = banjo ? 11.2 : 10.5;
  c.part();
  c.capsule(bx + ux * n0, by + uy * n0, bx + ux * n1, by + uy * n1, 0.8, 0.7, D.neck, { bias });
  const ex = bx + ux * n1;
  const ey = by + uy * n1;
  const bend = view === 'side' ? 1 : -1;
  const px = ux * 0.35 + vx * 0.94 * bend;
  const py = uy * 0.35 + vy * 0.94 * bend;
  if (banjo) {
    // A straight headstock, nickel pegs either side, and the banjo's own short fifth string pegged halfway up the neck.
    c.part();
    c.capsule(ex, ey, ex + ux * 2.4, ey + uy * 2.4, 1.0, 0.85, D.neck, { bias });
    c.part();
    for (const k of [0.8, 2.0]) for (const s2 of [-1, 1]) c.px(ex + ux * k + vx * s2 * 1.6, ey + uy * k + vy * s2 * 1.6, NICKEL, sphere(s2 * 0.3, -0.4), { bias });
    c.px(bx + ux * 7.2 + vx * 1.2 * bend, by + uy * 7.2 + vy * 1.2 * bend, NICKEL, sphere(0, -0.5), { bias });
  } else if (guitarra) {
    // The Portuguese guitar's head: a fan of brass tuning screws spread round the neck's end like a shell.
    c.part();
    for (let a = -1.25; a <= 1.25; a += 0.18) {
      for (let r = 0.4; r <= 2.0; r += 0.5) {
        const fx = ex + (ux * Math.cos(a) + vx * Math.sin(a)) * r;
        const fy = ey + (uy * Math.cos(a) + vy * Math.sin(a)) * r;
        c.px(fx, fy, GOLD, sphere(Math.sin(a) * 0.6, -0.5 + r * 0.1), { bias });
      }
    }
    // A dark seam between each screw, the fan's ribs.
    for (const a of [-0.8, 0, 0.8]) c.shade(ex + (ux * Math.cos(a) + vx * Math.sin(a)) * 1.4, ey + (uy * Math.cos(a) + vy * Math.sin(a)) * 1.4, -1);
    c.spark(ex + ux * 2.2, ey + uy * 2.2, S.light[0], 0.25 + p.glow * 0.3);
  } else {
    // The pegbox bends back from the neck, two gold pegs at its sides.
    c.part();
    c.capsule(ex, ey, ex + px * 2.6, ey + py * 2.6, 0.85, 0.7, D.neck, { bias });
  }
  c.part();
  if (banjo || guitarra) {
    // (pegged above)
  } else if (S.wild) {
    // The wildsong's lute is still growing: leaves bud where the pegs would be, and a bud of light at its tip.
    c.px(ex + px * 1.2 - ux * 1.2, ey + py * 1.2 - uy * 1.2, LEAF, sphere(-0.3, -0.5), { bias });
    c.px(ex + px * 1.2 - ux * 2.1, ey + py * 1.2 - uy * 2.1, LEAF, sphere(-0.5, -0.2), { bias });
    c.px(ex + px * 2.2 + ux * 1.2, ey + py * 2.2 + uy * 1.2, LEAF, sphere(0.3, -0.5), { bias });
    c.px(ex + px * 3.2 + ux * 0.4, ey + py * 3.2 + uy * 0.4, LEAF, sphere(0, -0.6), { bias });
    c.spark(ex + px * 3.4 + ux * 0.4, ey + py * 3.4 + uy * 0.4, S.light[1], 0.55 + p.glow * 0.45);
  } else {
    c.px(ex + px * 1.2 - ux * 1.1, ey + py * 1.2 - uy * 1.1, GOLD, sphere(0, -0.4), { bias });
    c.px(ex + px * 2.2 + ux * 1.1, ey + py * 2.2 + uy * 1.1, GOLD, sphere(0, -0.4), { bias });
  }

  if (banjo) {
    drawBanjoPot(c, p, bx, by, ux, uy, vx, vy, n0, bias);
    return;
  }
  // The belly: a round bowl with a narrower shoulder towards the neck (the Portuguese guitar's rounder, a pear).
  const [bu, bv, su, sv] = guitarra ? [4.0, 3.7, 2.5, 2.7] : [3.8, 3.3, 2.6, 2.2];
  c.part();
  for (let y = Math.floor(by - 5); y <= Math.ceil(by + 5); y++) {
    for (let x = Math.floor(bx - 5); x <= Math.ceil(bx + 5); x++) {
      const dx = x + 0.5 - bx;
      const dy = y + 0.5 - by;
      const u = dx * ux + dy * uy;
      const v = dx * vx + dy * vy;
      const bowl = (u * u) / (bu * bu) + (v * v) / (bv * bv) <= 1;
      const shoulder = ((u - 2.4) * (u - 2.4)) / (su * su) + (v * v) / (sv * sv) <= 1;
      if (bowl || shoulder) c.px(x, y, D.lute, sphere(dx / 4, dy / 3.7, 1), { bias });
    }
  }
  // The rosette, the bridge, and the strings between them.
  const hx = bx + ux * 1.1;
  const hy = by + uy * 1.1;
  if (guitarra) {
    // A ring of blue and white tile-work round the sound hole.
    c.part();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.px(hx + 0.4 + Math.cos(a) * 1.6, hy + 0.4 + Math.sin(a) * 1.6, i & 1 ? SHIRT : AZULEJO, sphere(Math.cos(a) * 0.3, -0.4), { bias });
    }
  }
  c.part();
  c.line(bx - ux * 2.2, by - uy * 2.2, bx + ux * (n0 + 0.6), by + uy * (n0 + 0.6), STRING, () => sphere(0, -0.3), { bias });
  c.part();
  c.px(hx, hy, HOLE);
  c.px(hx + vx * 0.9, hy + vy * 0.9, HOLE);
  c.part();
  c.px(bx - ux * 2.4 + vx * 0.5, by - uy * 2.4 + vy * 0.5, D.neck, sphere(0, -0.3), { bias });
  if (S.style === 'harlequin') {
    // Gold inlaid round the rosette, and a gold diamond by the bridge.
    c.part();
    for (const [du, dv] of [[0, -1.5], [0, 1.9], [-1.3, 0.4], [1.4, 0.4]] as const) c.px(hx + ux * du + vx * dv, hy + uy * du + vy * dv, GOLD, sphere(dv * 0.2, -0.4), { bias });
    c.spark(bx - ux * 1.6 - vx * 1.6, by - uy * 1.6 - vy * 1.6, S.light[1], 0.35 + p.glow * 0.4);
  }
  if (S.wild) {
    // The rosette glows softly from within, and a vine curls round the bowl.
    c.spark(hx, hy, S.light[2], 0.35 + p.glow * 0.4);
    c.part();
    for (const [du, dv] of [[-3.2, -1.4], [-2.2, -2.6], [-0.8, -3.2], [2.2, 2.4]] as const) {
      c.px(bx + ux * du + vx * dv, by + uy * du + vy * dv, LEAF, sphere(dv * 0.2, -0.4), { bias });
    }
  }
  if (p.glow > 0) {
    // Light off the strings, brightest where they're struck.
    glowAt(c, bx - ux * 0.6, by - uy * 0.6, p.glow);
    const [, hot, mid] = S.light;
    for (let i = 1; i <= 4; i++) c.spark(bx + ux * (i * 1.6), by + uy * (i * 1.6), i < 3 ? hot : mid, p.glow * (0.7 - i * 0.12));
  }
}

/** Light off struck strings running from (x, y) along (ux, uy): brightest where they're struck. */
function stringLight(c: PixelCanvas, x: number, y: number, ux: number, uy: number, glow: number): void {
  if (glow <= 0) return;
  glowAt(c, x, y, glow);
  const [, hot, mid] = S.light;
  for (let i = 1; i <= 4; i++) c.spark(x + ux * (i * 1.6), y + uy * (i * 1.6), i < 3 ? hot : mid, glow * (0.7 - i * 0.12));
}

/**
 * The banjo's pot: a round vellum head stretched in a nickel rim, a dark
 * bridge standing on it and a tailpiece at its foot, the strings running
 * from there up the neck.
 */
function drawBanjoPot(c: PixelCanvas, p: Pose, bx: number, by: number, ux: number, uy: number, vx: number, vy: number, n0: number, bias: number): void {
  const R = 3.9;
  c.part();
  for (let y = Math.floor(by - R - 1); y <= Math.ceil(by + R + 1); y++) {
    for (let x = Math.floor(bx - R - 1); x <= Math.ceil(bx + R + 1); x++) {
      const dx = x + 0.5 - bx;
      const dy = y + 0.5 - by;
      const d = Math.hypot(dx, dy);
      if (d > R) continue;
      // The rim's hooks show as a ring of brighter nickel nubs.
      if (d > R - 1) c.px(x, y, NICKEL, sphere(dx / R, dy / R - 0.3, 1), { bias: bias + ((x + y) % 3 === 0 ? 1 : 0) });
      else c.px(x, y, D.lute, sphere((dx / R) * 0.5, (dy / R) * 0.5 - 0.6, 1), { bias });
    }
  }
  // A soft shadow under the strings on the head, the bridge across them, the tailpiece at the rim.
  c.part();
  c.line(bx - ux * 3.0, by - uy * 3.0, bx + ux * (n0 + 0.6), by + uy * (n0 + 0.6), STRING, () => sphere(0, -0.3), { bias });
  c.part();
  c.px(bx - ux * 1.2 + vx * 0.5, by - uy * 1.2 + vy * 0.5, WALNUT, sphere(0, -0.4), { bias });
  c.px(bx - ux * 1.2 - vx * 0.5, by - uy * 1.2 - vy * 0.5, WALNUT, sphere(0, -0.4), { bias });
  c.px(bx - ux * 3.4, by - uy * 3.4, NICKEL, sphere(0, -0.5), { bias });
  stringLight(c, bx - ux * 0.2, by - uy * 0.2, ux, uy, p.glow);
}

/**
 * Orpheus's lyre: a tortoise-shell bowl at his hip, two golden arms rising
 * from it and curling out at their tips like horns, a yoke across them, and
 * four strings from the bowl to the yoke that never quite stop shining.
 */
function drawLyre(c: PixelCanvas, p: Pose, bx: number, by: number, ux: number, uy: number, vx: number, vy: number, bias: number): void {
  const at = (u: number, v: number): [number, number] => [bx + ux * u + vx * v, by + uy * u + vy * v];
  // The arms first, behind the strings: out from the bowl, bowing wide, in at the yoke, curling out at the tips.
  c.part();
  for (const s2 of [-1, 1]) {
    const pts: [number, number, number][] = [[0.6, 2.0, 0.85], [3.4, 3.2, 0.8], [6.4, 3.1, 0.7], [8.6, 2.3, 0.65], [10.0, 2.6, 0.6], [10.6, 3.6, 0.5]].map(([u, v, r]) => [...at(u, v * s2), r] as [number, number, number]);
    chain(c, pts, D.neck, bias);
  }
  // The yoke across the tops of the arms, a gold bead at each end.
  c.part();
  const [y0x, y0y] = at(8.8, -2.6);
  const [y1x, y1y] = at(8.8, 2.6);
  c.capsule(y0x, y0y, y1x, y1y, 0.7, 0.7, D.neck, { bias });
  // The bowl: a tortoise shell, mottled.
  c.part();
  for (let y = Math.floor(by - 4); y <= Math.ceil(by + 4); y++) {
    for (let x = Math.floor(bx - 4); x <= Math.ceil(bx + 4); x++) {
      const dx = x + 0.5 - bx;
      const dy = y + 0.5 - by;
      const u = dx * ux + dy * uy;
      const v = dx * vx + dy * vy;
      if (((u + 0.4) * (u + 0.4)) / (2.6 * 2.6) + (v * v) / (3.2 * 3.2) > 1) continue;
      const mottle = ((x * 7 + y * 13) % 5 === 0 ? -1 : 0) + ((x * 3 + y * 5) % 7 === 0 ? 1 : 0);
      c.px(x, y, D.lute, sphere(dx / 3.4, dy / 3.2, 1), { bias: bias + mottle });
    }
  }
  // A gold rim along the bowl's top edge, where the strings are tied.
  c.part();
  for (let v = -2.4; v <= 2.4; v += 0.8) {
    const [x, y] = at(1.6 - (v * v) * 0.08, v);
    c.px(x, y, GOLD, sphere(v * 0.15, -0.5), { bias });
  }
  // The strings, from the bowl's bridge to the yoke.
  c.part();
  for (const v of [-1.3, -0.45, 0.45, 1.3]) {
    const [sx, sy] = at(-0.6, v * 0.8);
    const [tx, ty] = at(8.6, v);
    c.line(sx, sy, tx, ty, LYRE_STRING, () => sphere(0, -0.3), { bias });
  }
  // The strings hold a little light always, and blaze when struck.
  const [, hot, mid] = S.light;
  for (let i = 0; i < 5; i++) {
    const [x, y] = at(1 + i * 1.7, ((p.tick + i) % 4) * 0.8 - 1.2);
    c.spark(x, y, i % 2 ? mid : hot, 0.12 + p.glow * 0.35);
  }
  const [gx, gy] = at(0.6, 0);
  stringLight(c, gx, gy, ux, uy, p.glow);
}

/**
 * The skald's round lyre, the old northern kind: one long slab of oak
 * rounded at both ends, a hand-hole cut through its head for the fingers
 * that stop the strings, a pale maple soundboard below it with a bridge and
 * a tailpiece, knotwork carved round the frame, and a rune cut in its crown
 * that holds a little light.
 */
function drawRoundLyre(c: PixelCanvas, p: Pose, bx: number, by: number, ux: number, uy: number, vx: number, vy: number, bias: number): void {
  const at = (u: number, v: number): [number, number] => [bx + ux * u + vx * v, by + uy * u + vy * v];
  const MID = 3.4;
  const HALF = 6.6;
  const HW = 2.9;
  const [mx, my] = at(MID, 0);
  c.part();
  for (let y = Math.floor(my - 9); y <= Math.ceil(my + 9); y++) {
    for (let x = Math.floor(mx - 9); x <= Math.ceil(mx + 9); x++) {
      const dx = x + 0.5 - bx;
      const dy = y + 0.5 - by;
      const u = dx * ux + dy * uy;
      const v = dx * vx + dy * vy;
      // A squircle: straight sides, rounded ends.
      const e = ((u - MID) / HALF) ** 4 + (v / HW) ** 4;
      if (e > 1) continue;
      // The hand-hole, right through.
      if (u > 6.1 && u < 8.7 && Math.abs(v) < 1.45) continue;
      const frame = e > 0.3 || u > 5.4;
      const n = sphere((v / HW) * 0.7, -0.35 + ((u - MID) / HALF) * 0.3, 1);
      if (!frame) {
        c.px(x, y, D.lute, n, { bias });
        continue;
      }
      // Knotwork: two strands crossing over and under along the frame, cut as light and dark.
      const k = (((x + y * 2) % 4) + 4) % 4;
      c.px(x, y, D.neck, n, { bias: bias + (k === 0 ? 1 : 0) });
    }
  }
  // The strings, from the tailpiece over the bridge to the yoke under the hand-hole.
  c.part();
  for (const v of [-1.0, 0, 1.0]) {
    const [sx, sy] = at(-2.4, v * 0.7);
    const [tx, ty] = at(6.0, v);
    c.line(sx, sy, tx, ty, STRING, () => sphere(0, -0.3), { bias });
  }
  c.part();
  for (const v of [-1.3, 0, 1.3]) {
    const [x, y] = at(-0.5, v);
    c.px(x, y, D.neck, sphere(0, -0.5), { bias: bias + 1 });
  }
  const [tx, ty] = at(-2.7, 0);
  c.px(tx, ty, GOLD, sphere(0, -0.4), { bias: bias + 1 });
  // The rune in the crown, and a glint of it travelling round the knotwork.
  const [rx, ry] = at(9.4, 0);
  c.part();
  c.px(rx, ry, RUNE_CUT, sphere(0, -0.5), { bias: bias + 1 });
  c.spark(rx, ry, S.light[1], 0.35 + p.glow * 0.4);
  const round: [number, number][] = [[4.6, 2.3], [7.6, 2.4], [9.6, 1.0], [9.6, -1.0], [7.6, -2.4], [4.6, -2.3]];
  const [gx, gy] = at(...round[p.tick % round.length]);
  c.spark(gx, gy, S.light[2], 0.3 + p.glow * 0.3);
  const [sx, sy] = at(0.6, 0);
  stringLight(c, sx, sy, ux, uy, p.glow);
}

// ---------------------------------------------------------------------------
// The drum

/**
 * The war drum at the belly: a red-lacquered shell laced with rope between
 * two bronze rims, its hide head seen from above, lit when it's struck.
 */
function drawDrum(c: PixelCanvas, cx: number, top: number, rx: number, glow: number, bias = 0): void {
  if (S.style === 'taiko') {
    drawOdaiko(c, cx, top, rx + 0.6, glow, bias);
    return;
  }
  const bot = top + 4.4;
  c.part();
  c.shape(Math.round(top), Math.round(bot), () => [cx - rx, cx + rx], G.shell, (_x, _y, t) => cyl(t, 0.1), { bias });
  // The bottom rim, curving with the shell.
  c.part();
  for (let x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++) {
    const t = (x + 0.5 - cx) / rx;
    if (Math.abs(t) > 1) continue;
    c.px(x, Math.round(bot) + Math.round((1 - t * t) * 0.9), G.rim, cyl(t, 0.4), { bias });
  }
  // Rope laced in a zigzag round the shell.
  c.part();
  for (let x = Math.floor(cx - rx) + 1; x < Math.ceil(cx + rx) - 1; x++) {
    const k = Math.abs((((x - Math.floor(cx - rx)) % 4) + 4) % 4 - 2);
    c.px(x, Math.round(top) + 1 + k, G.rope, sphere((x + 0.5 - cx) / rx, 0), { bias });
  }
  // The head: a bronze hoop round a pale hide.
  c.part();
  c.ellipse(cx, top, rx + 0.4, 1.9, G.rim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.3 - 0.8, 1), bias });
  c.part();
  c.ellipse(cx, top - 0.1, rx - 0.7, 1.25, G.hide, { normal: (_x, _y, dx) => sphere(dx * 0.3, -0.9, 1), bias });
  if (glow > 0) {
    const [core, hot, mid] = S.light;
    c.spark(cx, top, core, glow);
    for (let i = 1; i <= Math.round(rx - 1); i++) {
      c.spark(cx - i, top, i < 2 ? hot : mid, glow * (0.8 - i * 0.12));
      c.spark(cx + i, top, i < 2 ? hot : mid, glow * (0.8 - i * 0.12));
    }
    c.spark(cx, top - 1, hot, glow * 0.5);
    c.spark(cx, top + 1, mid, glow * 0.4);
  }
}

/**
 * The taiko drummer's odaiko: a barrel of lacquered zelkova bulging at its
 * belly, brass tacks in a ring under the head, a vermilion cord round its
 * waist with an iron ring for carrying, and three commas (mitsudomoe)
 * painted on the pale skin of its head.
 */
function drawOdaiko(c: PixelCanvas, cx: number, top: number, rx: number, glow: number, bias: number): void {
  const H = 5.2;
  const bot = top + H;
  const hw = (y: number) => rx + Math.sin(Math.PI * Math.min(1, Math.max(0, (y + 0.5 - top) / H))) * 0.9;
  c.part();
  c.shape(Math.round(top), Math.round(bot), (y) => [cx - hw(y), cx + hw(y)], G.shell, (x, y) => {
    const t = (x + 0.5 - cx) / hw(y);
    return sphere(t * 0.9, ((y + 0.5 - top) / H - 0.5) * 0.9, 1);
  }, { bias });
  // The bottom edge, curving with the barrel, a shade darker.
  c.part();
  for (let x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++) {
    const t = (x + 0.5 - cx) / rx;
    if (Math.abs(t) > 1) continue;
    c.px(x, Math.round(bot) + Math.round((1 - t * t) * 0.9), G.shell, cyl(t, 0.6), { bias: bias - 1 });
  }
  // Brass tacks in a ring just under the head, curving round the barrel.
  c.part();
  for (let x = Math.floor(cx - rx) + 1; x < Math.ceil(cx + rx); x += 2) {
    const t = (x + 0.5 - cx) / rx;
    if (Math.abs(t) > 0.95) continue;
    c.px(x, Math.round(top + 1.4 + (1 - t * t) * 0.6), TACK, sphere(t * 0.6, -0.4), { bias: bias + 1 });
  }
  // The cord round its belly, twisted vermilion, and the iron ring hanging from it.
  c.part();
  const mid = top + H * 0.62;
  for (let x = Math.floor(cx - hw(mid)); x <= Math.ceil(cx + hw(mid)); x++) {
    const t = (x + 0.5 - cx) / hw(mid);
    if (Math.abs(t) > 1) continue;
    c.px(x, Math.round(mid + (1 - t * t) * 0.8), G.rope, sphere(t * 0.8, -0.2), { bias: bias + ((x & 1) ? 1 : 0) });
  }
  c.part();
  c.px(cx + rx * 0.55, Math.round(mid + 1.6), TACK, sphere(0.3, 0.2), { bias: bias + 1 });
  // The head: the skin's rolled edge, then the skin itself.
  c.part();
  c.ellipse(cx, top, rx + 0.5, 2.0, G.hide, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.3 - 0.8, 1), bias: bias - 1 });
  c.part();
  c.ellipse(cx, top - 0.1, rx - 0.6, 1.35, G.hide, { normal: (_x, _y, dx) => sphere(dx * 0.3, -0.9, 1), bias });
  // Three commas swirling round the head's middle.
  c.part();
  for (const [dx, dy] of [[-2, 0], [-1, -1], [1, -1], [2, 0], [0, 1], [-1, 1]] as const) {
    c.px(Math.round(cx) + dx - 0.5, Math.round(top) + dy, (dx + dy) & 1 ? SHU : RAVEN_HAIR, sphere(0, -0.9), { bias: bias + 1 });
  }
  if (glow > 0) {
    const [core, hot, mid2] = S.light;
    c.spark(cx, top, core, glow);
    for (let i = 1; i <= Math.round(rx - 1); i++) {
      c.spark(cx - i, top, i < 2 ? hot : mid2, glow * (0.8 - i * 0.11));
      c.spark(cx + i, top, i < 2 ? hot : mid2, glow * (0.8 - i * 0.11));
    }
    c.spark(cx, top - 1, hot, glow * 0.5);
    c.spark(cx, top + 1, mid2, glow * 0.4);
  }
}

// ---------------------------------------------------------------------------
// Heads

/** The minstrel's cap from the front: a tilted wine crown on a wide brim, a gold band, a white plume sweeping back. */
function capDown(c: PixelCanvas, cx: number, U: number, t: number): void {
  c.part();
  c.ellipse(cx + 0.4, 9.8 + U, 5.5, 1.7, WINE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.4 - 0.7, 1) });
  // The brim's shadow on the brow.
  for (let x = cx - 3; x <= cx + 3; x++) c.shade(x, 11 + U, -1);
  c.part();
  c.ellipse(cx + 1.2, 7.6 + U, 3.7, 2.3, WINE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  c.part();
  c.shape(Math.round(9 + U), Math.round(9 + U), () => [cx - 2.4, cx + 4.6], GOLD, (_x, _y, tt) => cyl(tt, 0.2));
  plume(c, cx + 3.4, 8.2 + U, 1, t);
}

/** The long plume from the band, arching up and back, its tip stirring. */
function plume(c: PixelCanvas, x: number, y: number, dir: number, t: number): void {
  const flick = [0, 0.4, 0.6, 0.3, 0, -0.2][t % 6];
  c.part();
  for (let i = 0; i <= 14; i++) {
    const k = i / 14;
    const px = x + dir * (k * 6.6);
    const py = y - Math.sin(k * 2.5) * 5.2 + k * k * 2.6 + (k > 0.6 ? flick * (k - 0.6) * 2.5 : 0);
    c.px(px, py, PLUME, sphere(dir * 0.3, -0.7 + k * 0.8), { bias: k > 0.85 ? -1 : 0 });
    if (k < 0.8) c.px(px, py + 1, PLUME, sphere(dir * 0.2, 0.3 + k * 0.5), { bias: k > 0.5 ? -1 : 0 });
    if (k > 0.15 && k < 0.55) c.px(px - dir, py - 1, PLUME, sphere(dir * 0.1, -0.9), { bias: 1 });
  }
}

/** The drummer's helm from the front: a bronze cap riveted at the brow, two short horns curving up. */
function helmDown(c: PixelCanvas, cx: number, U: number): void {
  for (const s of [-1, 1]) {
    c.part();
    c.capsule(cx + s * 3.4, 9.6 + U, cx + s * 5.2, 7.6 + U, 0.95, 0.7, BONE);
    c.part();
    c.capsule(cx + s * 5.2, 7.6 + U, cx + s * 5.4, 5.8 + U, 0.7, 0.4, BONE);
  }
  c.part();
  c.shape(Math.round(6.5 + U), Math.round(9 + U), (y) => {
    const u = (y - 6.5 - U) / 2.5;
    const hw = 2.4 + Math.sqrt(Math.max(0, u)) * 1.5;
    return [cx - hw, cx + hw];
  }, IRON, (_x, _y, t, u) => sphere(t * 0.9, u * 0.7 - 0.5, 1));
  c.part();
  c.shape(Math.round(9.5 + U), Math.round(9.5 + U), () => [cx - 4.2, cx + 4.2], BRONZE, (_x, _y, t) => cyl(t, 0.3), { bias: -1 });
  // A ridge down the middle and rivets on the brow band.
  c.shade(cx, 7 + U, 1);
  c.shade(cx, 8 + U, 1);
  for (const x of [cx - 3, cx + 2]) c.shade(x, 10 + U, 2);
}


// ---------------------------------------------------------------------------
// The wildsong

/** A leaf-cut hem under row `y`: scallops hanging off every filled pixel, a lighter leaf tip on some. */
function leafHem(c: PixelCanvas, x0: number, x1: number, y: number, bias = 0): void {
  c.part();
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (!c.filled(x, y)) continue;
    const k = ((x % 3) + 3) % 3;
    if (k !== 2) c.px(x, y + 1, MOSS, sphere(0, 0.6), { bias });
    if (k === 1) c.px(x, y + 2, LEAF, sphere(0, 0.5), { bias: bias - 1 });
  }
}

/** A twig sprouting from the hood's crown, forked, a leaf at each tip; `s` is the side it leans to. */
function twig(c: PixelCanvas, x: number, y: number, s: number, bias = 0): void {
  c.part();
  c.line(x, y, x + s * 1.6, y - 3.4, BRANCH, () => sphere(s * 0.3, -0.5), { bias });
  c.line(x + s * 0.9, y - 1.7, x + s * 2.5, y - 2.3, BRANCH, () => sphere(s * 0.3, -0.5), { bias });
  c.part();
  c.px(x + s * 1.9, y - 4.4, LEAF, sphere(s * 0.3, -0.7), { bias });
  c.px(x + s * 3.2, y - 2.8, LEAF, sphere(s * 0.5, -0.4), { bias });
}

/** Brass chimes hanging from the belt, each catching the light in turn. */
function chimes(c: PixelCanvas, xs: number[], y: number, tick: number): void {
  c.part();
  xs.forEach((x, i) => {
    const len = i % 2 ? 3 : 2;
    for (let j = 0; j < len; j++) c.px(x, y + j, GOLD, sphere(0, -0.3 + j * 0.3), { bias: 1 });
    c.spark(x, y + len - 1, S.light[0], (tick + i * 2) % 3 === 0 ? 0.55 : 0.15);
  });
}

/** Two lamps of light in the dark of the hood (dark for a blink). */
function hoodEyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  if (blink) return;
  const [core, hot] = S.light;
  for (const [x, y] of pts) {
    c.spark(x, y, core, 1);
    c.spark(x, y + 1, hot, 0.25);
  }
}

/** The hood from the front: falling onto the shoulders, peaked at the crown, twigs sprouting, the face lost in its dark. */
function hoodDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  c.part();
  c.capsule(cx - 3.4, 12 + U, cx - 4.0, 15.6 + U, 1.5, 1.1, MOSS);
  c.capsule(cx + 3.4, 12 + U, cx + 4.0, 15.6 + U, 1.5, 1.1, MOSS);
  hoodCrown(c, cx, U, 0);
  twig(c, cx - 2.2, 8.4 + U, -1);
  twig(c, cx + 2.4, 8.2 + U, 1);
  c.part();
  c.ellipse(cx - 0.2, 12.7 + U, 3.0, 2.7, LEAF, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6 - 0.3, 1) });
  c.part();
  c.ellipse(cx - 0.2, 13.0 + U, 2.3, 2.1, HOOD_DARK);
  // The rim's lower edge falls into shadow.
  for (let x = cx - 2; x <= cx + 1; x++) c.shade(x, 15 + U, -1);
  hoodEyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
}

/** The hood's round, with a soft peak at the crown. */
function hoodCrown(c: PixelCanvas, cx: number, U: number, lean: number): void {
  c.part();
  c.ellipse(cx, 11.4 + U, 4.5, 4.2, MOSS, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + lean, dy * 0.8 - 0.2, 1) });
  c.part();
  c.shape(Math.round(6 + U), Math.round(7 + U), (y) => {
    const hw = y === Math.round(6 + U) ? 0.8 : 1.9;
    return [cx - hw + 0.4, cx + hw + 0.4];
  }, MOSS, (_x, _y, t) => sphere(t * 0.8, -0.8, 1));
}

/** The full cloak seen from the front: behind him on both sides, down to a leaf-cut hem. */
function wildCloakBehind(c: PixelCanvas, cx: number, U: number, L: number, sway: number): void {
  const top = 15 + U;
  const hem = 26 + L;
  c.part();
  c.shape(top, hem, (y) => {
    const u = (y - top) / (hem - top);
    return [cx - 5.4 - u * 1.2 + u * sway, cx + 5.4 + u * 1.2 + u * sway];
  }, MOSS, (_x, _y, t, u) => sphere(t * 0.9, u * 0.4, 1), { bias: -1 });
  leafHem(c, cx - 8, cx + 8, hem, -1);
}

/** The wildsong from the front: a bark tunic, a vine belt with chimes, the cloak over his shoulders, the hood. */
function wildDown(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 24.5 + L;
  c.part();
  c.shape(top, Math.round(hem), (y) => {
    const hw = y <= waist ? 4.5 - 0.5 * ((y + 0.5 - top) / (waist - top)) ** 2 : 4.1 + (y - waist) * 0.55;
    return [cx - hw, cx + hw];
  }, BARK, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
  for (let y = waist + 1; y <= hem; y++) {
    c.shade(cx - 2, y, -1);
    c.shade(cx + 2, y, -1);
  }
  // A fold down the front, the vine belt and its seed of light, the chimes.
  for (let y = top + 3; y < waist; y++) c.shade(cx, y, -1);
  c.part();
  c.shape(waist, waist, () => [cx - 4.1, cx + 4.1], LEAF, (_x, _y, t) => cyl(t, 0));
  c.spark(cx, waist, S.light[1], 0.6 + p.glow * 0.4);
  chimes(c, [cx - 3, cx - 2, cx + 3], waist + 1, p.tick);
  // The cloak over both shoulders, closed at the throat with a leaf.
  c.part();
  c.ellipse(cx, 16.2 + U, 5.4, 1.9, MOSS, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.4, 1) });
  c.part();
  c.px(cx, 17 + U, LEAF, sphere(0, -0.5));
  c.px(cx - 1, 17 + U, LEAF, sphere(-0.4, -0.3));
  hoodDown(c, cx + (p.head?.[0] ?? 0), U + (p.head?.[1] ?? 0), p);
}

/** The wildsong from behind: the cloak covering his back, the hood's tail trailing down it. */
function wildUp(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const hem = 26 + L;
  const top = 14.5 + U;
  c.part();
  c.shape(top, hem, (y) => {
    const u = (y - top) / (hem - top);
    return [cx - 5.2 - u * 0.8 + u * p.sway * 0.5, cx + 5.2 + u * (1 + p.sway)];
  }, MOSS, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
  for (let y = 18 + U; y <= hem; y++) {
    const u = (y - top) / (hem - top);
    c.shade(Math.round(cx - 2 + u * p.sway * 0.5), y, -1);
    c.shade(Math.round(cx + 2 + u * p.sway), y, -1);
  }
  leafHem(c, cx - 8, cx + 9, hem);
  hoodCrown(c, cx, U, 0);
  c.part();
  c.capsule(cx + 0.4, 13 + U, cx + 1 + p.sway * 0.3, 18.6 + U, 1.3, 0.6, MOSS);
  c.part();
  c.px(cx + 1 + p.sway * 0.3, 19.6 + U, LEAF, sphere(0, 0.4));
  for (let y = 9 + U; y <= 13 + U; y++) c.shade(cx, y, -1);
  twig(c, cx - 2.2, 8.4 + U, -1);
  twig(c, cx + 2.4, 8.2 + U, 1);
}

/** Two wisps of forest light drifting round him, passing behind him and in front. */
function wisps(c: PixelCanvas, U: number, tick: number): void {
  const [core, hot, mid, deep] = S.light;
  for (let i = 0; i < 2; i++) {
    // Half a turn per six frames, so the two wisps trade places and the loops run on seamlessly.
    const a = (tick / 6) * Math.PI + i * Math.PI;
    const x = 12 + Math.cos(a) * 10.5;
    const y = 12 + U + Math.sin(a) * 2.2 - Math.sin(a * 2) * 1.2;
    const behind = Math.sin(a) < 0;
    const put = (px: number, py: number, col: RGB, k: number) => {
      if (behind && c.filled(Math.floor(px), Math.floor(py))) return;
      c.spark(px, py, col, k);
    };
    put(x, y, core, 1);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(x + dx, y + dy, hot, 0.45);
    // A tail of light behind it along the orbit.
    const tx = Math.sin(a);
    const ty = -Math.cos(a) * 0.3;
    put(x + tx * 2, y + ty * 2, mid, 0.45);
    put(x + tx * 3.2, y + ty * 3.2, deep, 0.35);
  }
}

// ---------------------------------------------------------------------------
// The harlequin

/** Fill rows between `edges` in the harlequin's diamonds, `a` and `b` in turn. */
function motley(c: PixelCanvas, y0: number, y1: number, edges: (y: number) => [number, number] | null, a: Material, b: Material, normal: NormalFn, bias = 0): void {
  for (let y = Math.round(y0); y <= Math.round(y1); y++) {
    const e = edges(y);
    if (!e) continue;
    const [l, r] = e;
    for (let x = Math.round(l); x <= Math.round(r) - 1; x++) {
      const t = r - l > 0.001 ? ((x + 0.5 - l) / (r - l)) * 2 - 1 : 0;
      const k = (Math.floor((x + y) / 3) + Math.floor((x - y + 300) / 3)) & 1;
      c.px(x, y, k ? b : a, normal(x, y, t, (y - y0) / Math.max(1, y1 - y0)), { bias });
    }
  }
}

/** The hem cut into points below row `y`, rose and black in turn, a little gold bell on every other one. */
function dags(c: PixelCanvas, x0: number, x1: number, y: number, tick: number, bias = 0): void {
  c.part();
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (!c.filled(x, y)) continue;
    const k = ((x % 4) + 4) % 4;
    const g = Math.floor(x / 4) & 1;
    const m = g ? MOTLEY_B : MOTLEY_A;
    if (k === 1 || k === 2) c.px(x, y + 1, m, sphere(0, 0.6), { bias });
    if (k === 1 && g) {
      c.px(x, y + 2, GOLD, sphere(0, 0.2), { bias: bias + 1 });
      if ((tick + x) % 3 === 0) c.spark(x, y + 2, S.light[0], 0.4);
    }
  }
}

/** A white ruff, pleated round its rim. */
function ruff(c: PixelCanvas, x: number, y: number, rx: number, ry: number): void {
  c.part();
  c.ellipse(x, y, rx, ry, RUFF, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.2, 1) });
  for (let xx = Math.floor(x - rx); xx <= Math.ceil(x + rx); xx++) {
    if ((((xx % 2) + 2) % 2) !== 0) continue;
    c.shade(xx, Math.round(y + ry - 0.6), -1);
    c.shade(xx, Math.round(y - ry + 0.4), -1);
  }
}

/** A chain of capsules through `pts` ([x, y, radius] each). */
function chain(c: PixelCanvas, pts: [number, number, number][], m: Material, bias = 0): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0, r0] = pts[i];
    const [x1, y1, r1] = pts[i + 1];
    c.capsule(x0, y0, x1, y1, r0, r1, m, { bias });
  }
}

/** One of the cap's floppy points, drooping to a gold bell that swings as he moves. */
function capPoint(c: PixelCanvas, pts: [number, number][], m: Material, tick: number, s: number, bias = 0): void {
  const flick = [0, 0.3, 0.5, 0.3, 0, -0.2][tick % 6];
  const r = [1.3, 1.05, 0.8, 0.6, 0.45];
  const n = pts.length;
  const swung = pts.map(([x, y], i): [number, number, number] => {
    const k = i / (n - 1);
    return [x + s * flick * k * 0.5, y + flick * k * k, r[Math.min(i, r.length - 1)]];
  });
  c.part();
  chain(c, swung, m, bias);
  const [tx, ty] = swung[n - 1];
  c.part();
  c.ellipse(tx, ty + 1.2, 0.95, 0.95, GOLD, { bias });
  c.spark(tx - 0.3, ty + 0.9, S.light[0], 0.45);
}

/**
 * The jester's cap: a crown split rose and black over a gold band, two long
 * points flopping out to either side, a bell at each tip. From behind the
 * colours are the other way round; from the side one point falls forward
 * and one back.
 */
function jesterCap(c: PixelCanvas, cx: number, U: number, tick: number, view: View): void {
  const left = view === 'up' ? MOTLEY_B : MOTLEY_A;
  const right = view === 'up' ? MOTLEY_A : MOTLEY_B;
  if (view === 'side') {
    capPoint(c, [[cx + 1.6, 8.2 + U], [cx + 4.2, 5.4 + U], [cx + 6.4, 6.2 + U], [cx + 7.4, 8.6 + U], [cx + 7.6, 10.6 + U]], MOTLEY_B, tick, 1, -1);
  } else {
    capPoint(c, [[cx - 1.6, 8.2 + U], [cx - 3.9, 5.2 + U], [cx - 6.1, 5.6 + U], [cx - 7.1, 8.0 + U], [cx - 7.3, 10.2 + U]], left, tick, -1);
    capPoint(c, [[cx + 1.6, 8.2 + U], [cx + 3.9, 5.2 + U], [cx + 6.1, 5.6 + U], [cx + 7.1, 8.0 + U], [cx + 7.3, 10.2 + U]], right, tick, 1);
  }
  // The crown, cut off flat at the band.
  const ox = view === 'side' ? cx + 0.2 : cx;
  const rx = view === 'side' ? 3.5 : 3.9;
  const oy = 9.6 + U;
  c.part();
  for (let y = Math.floor(oy - 2.6); y <= Math.round(10 + U); y++) {
    for (let x = Math.floor(ox - rx); x <= Math.ceil(ox + rx); x++) {
      const dx = (x + 0.5 - ox) / rx;
      const dy = (y + 0.5 - oy) / 2.6;
      if (dx * dx + dy * dy > 1) continue;
      const m = view === 'side' ? (x + 0.5 < ox - 0.4 ? MOTLEY_A : MOTLEY_B) : x + 0.5 < ox ? left : right;
      c.px(x, y, m, sphere(dx * 0.9, dy * 0.8 - 0.2, 1));
    }
  }
  c.part();
  c.shape(Math.round(10 + U), Math.round(10 + U), () => (view === 'side' ? [ox - 3.8, ox + 3.2] : [ox - 3.9, ox + 3.9]), GOLD, (_x, _y, t) => cyl(t, 0.2));
  if (view === 'side') capPoint(c, [[cx - 1.2, 8.0 + U], [cx - 3.2, 5.0 + U], [cx - 5.2, 5.6 + U], [cx - 6.0, 8.0 + U], [cx - 6.0, 9.8 + U]], MOTLEY_A, tick, -1);
}

/** The porcelain mask from the front: dark eyes, a rose diamond through one and a black tear under the other, a small red smile. */
function maskDown(c: PixelCanvas, cx: number, U: number, blink: boolean | undefined): void {
  c.part();
  c.ellipse(cx - 0.2, 12.8 + U, 2.6, 2.5, MASK, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.8 - 0.1, 1) });
  c.part();
  c.px(cx - 2, 11 + U, MOTLEY_A, sphere(0, -0.3));
  c.px(cx - 2, 13 + U, MOTLEY_A, sphere(0, 0.2));
  c.px(cx + 1, 14 + U, MOTLEY_B, sphere(0, 0.2));
  c.px(cx - 1, 14 + U, LIP, sphere(0, 0.3));
  c.px(cx, 14 + U, LIP, sphere(0, 0.3));
  c.part();
  for (const x of [cx - 2, cx + 1]) c.px(x, 12 + U, blink ? MASK : EYE, sphere(0, -0.3), { bias: blink ? -1 : 0 });
}

/** The harlequin's doublet from the front or back: diamonds of rose and black, the hem cut into belled points, a black belt. */
function harlequinBody(c: PixelCanvas, cx: number, U: number, L: number, tick: number, back: boolean): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 24.5 + L;
  c.part();
  motley(c, top, hem, (y) => {
    const hw = y <= waist ? 4.5 - 0.5 * ((y + 0.5 - top) / (waist - top)) ** 2 : 4.1 + (y - waist) * 0.55;
    return [cx - hw, cx + hw];
  }, back ? MOTLEY_B : MOTLEY_A, back ? MOTLEY_A : MOTLEY_B, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
  dags(c, cx - 6, cx + 6, Math.round(hem), tick);
  c.part();
  c.shape(waist, waist, () => [cx - 4.1, cx + 4.1], MOTLEY_B, (_x, _y, t) => cyl(t, 0));
  if (!back) {
    c.part();
    c.px(cx, waist, GOLD, sphere(0, -0.3));
    // Gold buttons, each on a diamond's point.
    for (const y of [top + 2, top + 5]) c.px(cx, y, GOLD, sphere(0, -0.4));
  }
}

// ---------------------------------------------------------------------------
// The moonhowl

/** The wolf's pricked ears, from the front or the back. */
function wolfEars(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  for (const s of [-1, 1]) {
    poly(c, [[cx + s * 1.2, 8.6 + U], [cx + s * 3.4, 4.0 + U], [cx + s * 4.4, 8.8 + U]], G.fur, (_x, _y, t, u) => sphere(t * 0.6, u * 0.6 - 0.5, 1));
    c.shade(cx + s * 3.1 - (s < 0 ? 1 : 0), 6.6 + U, -2);
    c.shade(cx + s * 3.1 - (s < 0 ? 1 : 0), 7.6 + U, -2);
  }
}

/** The wolf's head worn as a hood, from the front: ears up, its snout over his brow, its glinting eyes, the pelt falling to his shoulders. */
function wolfHoodDown(c: PixelCanvas, cx: number, U: number, tick: number): void {
  c.part();
  c.capsule(cx - 3.6, 11 + U, cx - 4.6, 15.6 + U, 1.5, 1.2, G.fur);
  c.capsule(cx + 3.6, 11 + U, cx + 4.6, 15.6 + U, 1.5, 1.2, G.fur);
  wolfEars(c, cx, U);
  c.part();
  c.ellipse(cx, 9.3 + U, 4.0, 2.7, G.fur, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 1) });
  // Fur ruffling along the brow.
  for (const x of [cx - 3, cx - 1, cx + 2]) c.shade(x, 11 + U, -1);
  c.part();
  c.ellipse(cx - 0.2, 10.4 + U, 1.9, 1.3, G.fur, { bias: 1 });
  c.part();
  c.px(cx - 1, 10 + U, NOSE, sphere(-0.2, -0.4));
  c.px(cx, 10 + U, NOSE, sphere(0.2, -0.4));
  // The wolf's eyes, and its fangs over his brow.
  c.part();
  c.px(cx - 2, 8 + U, NOSE);
  c.px(cx + 1, 8 + U, NOSE);
  const k = tick % 6 === 3 ? 0.9 : 0.55;
  c.spark(cx - 2, 8 + U, S.light[1], k);
  c.spark(cx + 1, 8 + U, S.light[1], k);
  c.px(cx - 2, 11 + U, BONE, sphere(0, 0.3), { bias: 1 });
  c.px(cx + 1, 11 + U, BONE, sphere(0, 0.3), { bias: 1 });
}

/** The wolf's head from behind, its pelt down his back to the tail. */
function wolfHoodUp(c: PixelCanvas, cx: number, U: number, L: number, sway: number): void {
  c.part();
  c.shape(Math.round(11 + U), Math.round(24 + L), (y) => {
    const u = (y - 11 - U) / (13 + L - U);
    const hw = 3.9 - u * 1.4 + Math.sin(u * 9) * 0.2;
    const s = u * u * sway;
    return [cx - hw + s, cx + hw + s];
  }, G.fur, (_x, _y, t, u) => sphere(t * 0.85, u * 0.5 - 0.3, 1));
  // Strands of fur down it.
  for (let y = Math.round(13 + U); y <= 23 + L; y += 2) {
    c.shade(cx - 2 + ((y >> 1) & 1), y, -1);
    c.shade(cx + 2 - ((y >> 1) & 1), y, -1);
  }
  c.part();
  c.capsule(cx + sway * 0.6, 23.5 + L, cx + sway * 1.2, 27.5 + L, 1.5, 0.6, G.fur);
  c.part();
  c.px(cx + sway * 1.2, 28 + L, G.fur, sphere(0, 0.4), { bias: 2 });
  wolfEars(c, cx, U);
  c.part();
  c.ellipse(cx, 9.4 + U, 4.0, 2.8, G.fur, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.shade(cx, 8 + U, 1);
}

/** The wolf's head in profile, facing left: an ear up, the long snout out over his brow, the pelt hanging behind. */
function wolfHoodSide(c: PixelCanvas, hx: number, U: number, sway: number, tick: number): void {
  c.part();
  c.capsule(hx + 2.4, 11 + U, hx + 3.6 + sway * 0.3, 18.4 + U, 1.8, 1.2, G.fur);
  c.part();
  poly(c, [[hx - 0.2, 8.6 + U], [hx + 1.0, 4.2 + U], [hx + 2.8, 8.4 + U]], G.fur, (_x, _y, t, u) => sphere(t * 0.6 + 0.2, u * 0.6 - 0.5, 1));
  c.shade(hx + 1, 7 + U, -2);
  c.part();
  c.ellipse(hx + 0.4, 9.5 + U, 3.4, 2.5, G.fur, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 1) });
  c.part();
  c.capsule(hx - 2.0, 10 + U, hx - 5.2, 10.7 + U, 1.35, 0.9, G.fur, { bias: 1 });
  c.part();
  c.px(hx - 6, 10.4 + U, NOSE, sphere(-0.5, -0.3));
  c.px(hx - 5, 11.4 + U, BONE, sphere(0, 0.4), { bias: 1 });
  c.px(hx - 3, 11.4 + U, BONE, sphere(0, 0.4), { bias: 1 });
  c.px(hx - 2, 9 + U, NOSE);
  c.spark(hx - 2, 9 + U, S.light[1], tick % 6 === 3 ? 0.9 : 0.55);
}

/** A string of wolf's teeth hanging across his chest. */
function toothNecklace(c: PixelCanvas, cx: number, y0: number, span: number): void {
  c.part();
  for (let x = Math.floor(cx - span); x <= Math.ceil(cx + span); x++) {
    const k = (x + 0.5 - cx) / span;
    if (Math.abs(k) > 1) continue;
    const y = y0 + (1 - k * k) * 1.6;
    c.px(x, y, SINEW, sphere(k * 0.5, -0.2));
    if ((x & 1) === 0 && Math.abs(k) < 0.85) c.px(x, y + 1, BONE, sphere(k * 0.4, 0.3), { bias: 1 });
  }
}

/** Woad on his chest: a ring for the moon on one side, three claw marks on the other. */
function woadChest(c: PixelCanvas, cx: number, top: number): void {
  c.part();
  for (const [x, y] of [[cx - 3, top + 3], [cx - 2, top + 2], [cx - 2, top + 4], [cx - 1, top + 3]]) c.px(x, y, G.paint, sphere(0, 0));
  for (let i = 0; i < 3; i++) {
    c.px(cx + 1 + i, top + 3 + (i & 1), G.paint, sphere(0, 0));
    c.px(cx + 1 + i, top + 4 + (i & 1), G.paint, sphere(0, 0));
  }
}

/** The wolf's forelegs, tied across his chest to hold the pelt on. */
function peltPaws(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.capsule(cx - 4.6, 15.8 + U, cx - 1, 17.8 + U, 1.1, 0.8, G.fur);
  c.capsule(cx + 4.6, 15.8 + U, cx + 1, 17.8 + U, 1.1, 0.8, G.fur);
  c.part();
  c.px(cx - 1, 18 + U, SINEW, sphere(0, -0.3));
  c.px(cx, 18 + U, SINEW, sphere(0, -0.3));
}

/** A fringe of hide strips below row `y`. */
function fringe(c: PixelCanvas, x0: number, x1: number, y: number): void {
  c.part();
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (!c.filled(x, y) || (x & 1)) continue;
    c.px(x, y + 1, G.kilt, sphere(0, 0.6), { bias: -1 });
  }
}

/** Feathers hanging from the drum's rim at `x`, stirring. */
function feathers(c: PixelCanvas, x: number, y: number, tick: number): void {
  c.part();
  const drift = [0, 0, 1, 1, 0, 0][tick % 6] * 0.5;
  for (let i = 0; i < 4; i++) c.px(x + (i > 1 ? drift : 0), y + i, FEATHER, sphere(0, -0.2 + i * 0.2), { bias: i === 3 ? 1 : 0 });
  c.spark(x + drift, y + 3, S.light[2], 0.3);
}

// ---------------------------------------------------------------------------
// Shared cuts

/** Half the width of a fitted body at row `y`: narrowing to the waist, then a skirt flaring by `flare` a row. */
const fitHw = (y: number, top: number, waist: number, flare: number): number => (y <= waist ? 4.5 - 0.5 * ((y + 0.5 - top) / (waist - top)) ** 2 : 4.1 + (y - waist) * flare);

/** Light falling on a fitted body from the front or the back at (x, y), `hw` its half width there. */
const fitNormal = (x: number, y: number, cx: number, hw: number, top: number, waist: number) =>
  sphere(((x + 0.5 - cx) / hw) * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1);

/** A fitted coat or tunic from the front or back, down to `hem`. */
function fitted(c: PixelCanvas, cx: number, top: number, waist: number, hem: number, m: Material, flare = 0.55): void {
  c.part();
  c.shape(top, Math.round(hem), (y) => {
    const hw = fitHw(y, top, waist, flare);
    return [cx - hw, cx + hw];
  }, m, (x, y) => fitNormal(x, y, cx, fitHw(y, top, waist, flare), top, waist));
}

/** The same in profile, facing left: the chest at `hx`, the skirt swinging back over the hips at `cx`; `tail` widens it behind. */
function fittedSide(c: PixelCanvas, cx: number, hx: number, top: number, waist: number, hem: number, m: Material, flare = 0.5, tail = 0): void {
  c.part();
  c.shape(top, Math.round(hem), (y) => {
    const u = y <= waist ? 0 : (y - waist) / 2.5;
    const shift = y <= waist ? hx : hx + (cx - hx) * Math.min(1, u);
    const hw = y <= waist ? 3.2 - 0.4 * ((y + 0.5 - top) / (waist - top)) ** 2 : 2.9 + (y - waist) * flare;
    const back = y <= waist ? 0 : ((y - waist) / Math.max(1, hem - waist)) * tail;
    return [shift - hw - 0.2, shift + hw + 0.2 + back];
  }, m, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
}

/** The front edge of the profile body at row `y` (as fittedSide cuts it). */
const sideFront = (cx: number, hx: number, top: number, waist: number, y: number, flare = 0.5): number => {
  if (y <= waist) return hx - (3.2 - 0.4 * ((y + 0.5 - top) / (waist - top)) ** 2) - 0.2;
  const u = Math.min(1, (y - waist) / 2.5);
  return hx + (cx - hx) * u - (2.9 + (y - waist) * flare) - 0.2;
};

// ---------------------------------------------------------------------------
// The vagabond

/** A hawk's feather tucked in the hat band, barred light and dark, its tip stirring. */
function hawkFeather(c: PixelCanvas, x: number, y: number, dir: number, tick: number): void {
  const flick = [0, 0.3, 0.5, 0.3, 0, -0.2][tick % 6];
  c.part();
  for (let i = 0; i <= 8; i++) {
    const k = i / 8;
    const fx = x + dir * k * 3.4;
    const fy = y - k * 4.4 + k * k * 1.3 + (k > 0.6 ? flick * (k - 0.6) * 2.4 : 0);
    c.px(fx, fy, HAWK, sphere(dir * 0.3, -0.6 + k * 0.6), { bias: k > 0.85 ? 1 : 0 });
    if (k > 0.2 && k < 0.8) c.px(fx + dir, fy + 0.4, HAWK, sphere(dir * 0.5, -0.2), { bias: i % 3 === 0 ? -1 : 0 });
  }
}

/** The wide felt hat from the front (or behind): a broad brim tipped down to one side, a pinched crown, a rust band and the feather. */
function slouchHat(c: PixelCanvas, cx: number, U: number, tick: number, back: boolean): void {
  const tip = back ? -0.09 : 0.09;
  c.part();
  for (let y = Math.floor(7.6 + U); y <= Math.ceil(12 + U); y++) {
    for (let x = Math.floor(cx - 7.2); x <= Math.ceil(cx + 7.4); x++) {
      const dx = (x + 0.5 - cx - 0.2) / 6.7;
      const dy = (y + 0.5 - 9.9 - U - (x + 0.5 - cx) * tip) / 1.75;
      if (dx * dx + dy * dy > 1) continue;
      c.px(x, y, FELT, sphere(dx * 0.8, dy * 0.4 - 0.7, 1));
    }
  }
  // The brim's underside, in its own shadow; a rim worn lighter at the front.
  for (let x = cx - 5; x <= cx + 5; x++) c.shade(x, Math.round(11 + U + (x + 0.5 - cx) * tip), -1);
  c.part();
  c.shape(Math.round(6 + U), Math.round(9 + U), (y) => {
    const hw = 2.4 + ((y - 6 - U) / 3) * 1.1;
    return [cx - hw + 0.2, cx + hw + 0.2];
  }, FELT, (_x, _y, t, u) => sphere(t * 0.9, u * 0.7 - 0.5, 1));
  // The pinch down the crown's top.
  c.shade(cx, 6 + U, -2);
  c.shade(cx, 7 + U, -1);
  c.part();
  c.shape(Math.round(9 + U), Math.round(9 + U), () => [cx - 3.4, cx + 3.8], RUST, (_x, _y, t) => cyl(t, 0.2));
  hawkFeather(c, back ? cx - 3.0 : cx + 3.2, 8.8 + U, back ? -1 : 1, tick);
}

/** A striped scarf wound at the throat, from the front: one end hanging down his chest. */
function scarfDown(c: PixelCanvas, cx: number, U: number, sway: number): void {
  c.part();
  const tx = cx - 2.2 + sway * 0.4;
  c.capsule(cx - 1.6, 16.6 + U, tx, 20.8 + U, 1.0, 0.85, PLUM);
  for (let x = Math.floor(tx) - 1; x <= Math.ceil(tx) + 1; x++) if (c.materialAt(x, Math.round(18.6 + U)) === PLUM) c.shade(x, 18.6 + U, 2);
  // A fringe on its end.
  c.part();
  for (const dx of [-1, 0, 1]) c.px(tx + dx * 0.9, 21.4 + U, PLUM, sphere(0, 0.5), { bias: -1 });
  c.part();
  c.ellipse(cx, 15.9 + U, 3.2, 1.15, PLUM, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.4, 1) });
  for (const x of [cx - 2, cx + 1]) c.shade(x, 16 + U, 2);
}

/** The bedroll strapped across his back, seen from the front: its ends standing out past his shoulders. */
function bedrollFront(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.capsule(cx - 7.3, 14.6 + U, cx + 7.3, 14.6 + U, 1.5, 1.5, BEDROLL, { bias: -1 });
  for (const x of [cx - 6, cx + 5]) for (let y = 13; y <= 16; y++) c.shade(x, y + U, 1);
  // The rolled ends, a dark curl in each.
  c.shade(cx - 8, 14.6 + U, -2);
  c.shade(cx + 7, 14.6 + U, -2);
}

/** The vagabond's shaggy head and stubbled face from the front, under his hat. */
function vagabondHead(c: PixelCanvas, hx: number, hU: number, p: Pose): void {
  c.part();
  c.ellipse(hx, 11.8 + hU, 3.9, 3.6, ASH_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.capsule(hx - 3.3, 12 + hU, hx - 3.7, 14.8 + hU, 1.3, 0.9, ASH_HAIR);
  c.capsule(hx + 3.1, 12 + hU, hx + 3.5, 14.8 + hU, 1.3, 0.9, ASH_HAIR);
  c.part();
  c.ellipse(hx - 0.2, 12.8 + hU, 2.55, 2.4, SKIN);
  c.part();
  c.px(hx - 3, 11 + hU, ASH_HAIR, sphere(-0.6, 0.2));
  c.px(hx + 2, 11 + hU, ASH_HAIR, sphere(0.6, 0.2));
  eyes(c, [[hx - 2, 12 + hU], [hx + 1, 12 + hU]], p.blink);
  // Stubble along the jaw, and a lopsided grin.
  c.shade(hx - 2, 14 + hU, -1);
  c.shade(hx + 1, 14 + hU, -1);
  c.shade(hx - 1, 14 + hU, -2);
  c.shade(hx, 14 + hU, -1);
  slouchHat(c, hx, hU, p.tick, false);
}

/** The vagabond from the front: the long duster open over a rust waistcoat, patched, the scarf, the bedroll's ends behind. */
function vagabondDown(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 27 + L;
  const flare = 0.42;
  fitted(c, cx, top, waist + 1, waist + 1, RUST);
  c.part();
  c.shape(waist, waist, () => [cx - 4.1, cx + 4.1], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.px(cx, waist, NICKEL, sphere(0, -0.4));
  for (const y of [top + 2, top + 4]) c.px(cx, y, GOLD, sphere(0, -0.4));
  // The duster, open down the front; its skirts swing.
  const open = (y: number) => (y <= waist ? 1.3 + (0.5 * (y - top)) / (waist - top) : 1.8 + (y - waist) * 0.3);
  const swing = (y: number) => (y > waist ? ((y - waist) / (hem - waist)) * p.sway * 0.6 : 0);
  const normal = (x: number, y: number) => fitNormal(x - swing(y), y, cx, fitHw(y, top, waist, flare), top, waist);
  c.part();
  c.shape(top, Math.round(hem), (y) => [cx - fitHw(y, top, waist, flare) + swing(y), cx - open(y) + swing(y)], DUSTER, normal);
  c.shape(top, Math.round(hem), (y) => [cx + open(y) + swing(y), cx + fitHw(y, top, waist, flare) + swing(y)], DUSTER, normal);
  for (let y = top; y <= Math.round(hem); y++) {
    const s2 = swing(y);
    // Lapels turned back at the chest, folds down the skirts.
    if (y <= top + 3) {
      c.shade(Math.round(cx - open(y) + s2) - 1, y, 1);
      c.shade(Math.round(cx + open(y) + s2), y, 1);
    }
    if (y > waist + 1) {
      c.shade(Math.round(cx - 4 + s2), y, -1);
      c.shade(Math.round(cx + 3 + s2), y, -1);
    }
  }
  // Patches: blue-grey wool on a skirt, rust on the breast, both stitched on.
  c.part();
  for (const [x, y, m] of [[cx - 4, waist + 2, BEDROLL], [cx - 3, waist + 2, BEDROLL], [cx - 4, waist + 3, BEDROLL], [cx - 3, waist + 3, BEDROLL], [cx + 3, top + 3, RUST], [cx + 2, top + 3, RUST], [cx + 3, top + 4, RUST]] as const) {
    const sx = x + Math.round(swing(y));
    if (c.materialAt(sx, y) === DUSTER) c.px(sx, y, m, sphere(0, -0.2), { bias: (sx + y) & 1 ? 0 : 1 });
  }
  scarfDown(c, cx, U, p.sway);
  vagabondHead(c, cx + (p.head?.[0] ?? 0), U + (p.head?.[1] ?? 0), p);
}

/** The vagabond from behind: the duster's back with its vent and half-belt, the bedroll strapped across, the hat. */
function vagabondUp(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 27 + L;
  const flare = 0.42;
  const swing = (y: number) => (y > waist ? ((y - waist) / (hem - waist)) * p.sway * 0.6 : 0);
  c.part();
  c.shape(top, Math.round(hem), (y) => {
    const hw = fitHw(y, top, waist, flare);
    return [cx - hw + swing(y), cx + hw + swing(y)];
  }, DUSTER, (x, y) => fitNormal(x - swing(y), y, cx, fitHw(y, top, waist, flare), top, waist));
  for (let y = waist + 1; y <= Math.round(hem); y++) c.shade(Math.round(cx + swing(y)), y, -2);
  c.part();
  c.shape(waist, waist, () => [cx - 2.6, cx + 2.6], DUSTER, (_x, _y, t) => sphere(t * 0.6, -0.4, 1), { bias: 1 });
  c.px(cx - 2, waist, GOLD, sphere(0, -0.4));
  c.px(cx + 1, waist, GOLD, sphere(0, -0.4));
  c.part();
  for (const [x, y] of [[cx + 2, top + 5], [cx + 3, top + 5], [cx + 2, top + 6], [cx + 3, top + 6]]) c.px(x, y, BEDROLL, sphere(0.3, 0), { bias: (x + y) & 1 ? 0 : 1 });
  // Shaggy hair to the collar.
  c.part();
  c.ellipse(cx, 11.8 + U, 3.9, 3.7, ASH_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  c.part();
  c.shape(Math.round(13 + U), Math.round(15.6 + U), (y) => {
    const hw = 3.5 - (y - 13 - U) * 0.3;
    return [cx - hw, cx + hw];
  }, ASH_HAIR, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
  for (let x = cx - 3; x <= cx + 2; x += 2) c.shade(x, 15.6 + U, -1);
  // The bedroll, strapped on with two leather straps.
  c.part();
  c.capsule(cx - 6.6, 16.2 + U, cx + 6.6, 16.2 + U, 1.55, 1.55, BEDROLL);
  for (const x of [cx - 5, cx + 4]) for (let y = 15; y <= 17; y++) c.shade(x, y + U, 1);
  c.part();
  for (const x of [cx - 3, cx + 2]) c.line(x, 14.4 + U, x, 18 + U, LEATHER, () => sphere(0, -0.2));
  slouchHat(c, cx, U, p.tick, true);
}

/** The vagabond in profile, facing left: the duster's tails swinging, the bedroll on his back, scarf trailing, the hat. */
function vagabondSide(c: PixelCanvas, cx: number, hx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 27 + L;
  // The bedroll's end, behind his shoulders.
  c.part();
  c.ellipse(hx + 3.5, 15.6 + U, 1.9, 1.8, BEDROLL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6 + 0.3, dy * 0.6 - 0.2, 1) });
  c.shade(hx + 3, 15 + U, -1);
  c.shade(hx + 4, 16 + U, -1);
  c.shade(hx + 3, 16 + U, -2);
  fittedSide(c, cx, hx, top, waist, hem, DUSTER, 0.42, 1.2 + p.sway);
  // The waistcoat showing where the duster hangs open, and the belt.
  c.part();
  for (let y = top + 1; y < waist; y++) c.px(Math.round(sideFront(cx, hx, top, waist, y)), y, RUST, sphere(-0.6, 0));
  c.shape(waist, waist, () => [hx - 3.4, hx - 1.4], LEATHER, (_x, _y, t) => cyl(t, 0));
  for (let y = waist + 1; y <= Math.round(hem); y++) c.shade(Math.round(sideFront(cx, hx, top, waist, y, 0.42)) + 1, y, -1);
  c.part();
  for (const [x, y] of [[hx + 1, waist + 2], [hx + 2, waist + 2], [hx + 1, waist + 3], [hx + 2, waist + 3]]) if (c.materialAt(x, y) === DUSTER) c.px(x, y, BEDROLL, sphere(0, -0.2), { bias: (x + y) & 1 ? 0 : 1 });
  // The strap across his chest.
  c.part();
  c.line(hx + 2.2, 15.2 + U, hx - 2.6, 20.4 + U, LEATHER, () => sphere(-0.3, -0.3));
  // The scarf, its end trailing back.
  c.part();
  c.capsule(hx + 1.6, 16.2 + U, hx + 4.4 + p.sway * 0.6, 18 + U, 0.95, 0.75, PLUM);
  c.shade(Math.round(hx + 3 + p.sway * 0.3), 17 + U, 2);
  c.part();
  c.ellipse(hx - 0.4, 15.8 + U, 2.4, 1.1, PLUM, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.4, 1) });
  c.shade(hx - 1, 16 + U, 2);
  // Head: shaggy hair behind, the stubbled face turned left.
  c.part();
  c.ellipse(hx + 0.6, 11.8 + U, 3.4, 3.6, ASH_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
  c.part();
  c.capsule(hx + 1.8, 12.5 + U, hx + 2.6 + p.sway * 0.3, 15.2 + U, 1.5, 1.0, ASH_HAIR);
  c.part();
  c.ellipse(hx - 1.4, 12.9 + U, 2.2, 2.3, SKIN);
  c.part();
  c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
  c.px(hx - 1, 11 + U, ASH_HAIR, sphere(0.2, 0.2));
  c.shade(hx - 3, 14 + U, -2);
  c.shade(hx - 2, 14 + U, -1);
  c.shade(hx - 1, 14 + U, -1);
  eyes(c, [[hx - 3, 12 + U]], p.blink);
  // The hat in profile: the brim wide, the pinched crown, the feather in the band at the back.
  c.part();
  c.ellipse(hx - 0.4, 9.9 + U, 5.9, 1.45, FELT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.4 - 0.7, 1) });
  for (let x = hx - 5; x <= hx + 4; x++) c.shade(x, 11 + U, -1);
  c.part();
  c.shape(Math.round(6 + U), Math.round(9 + U), (y) => {
    const hw = 2.3 + ((y - 6 - U) / 3) * 0.9;
    return [hx - hw + 0.2, hx + hw + 0.4];
  }, FELT, (_x, _y, t, u) => sphere(t * 0.9, u * 0.7 - 0.5, 1));
  c.shade(hx - 1, 6 + U, -1);
  c.part();
  c.shape(Math.round(9 + U), Math.round(9 + U), () => [hx - 3.0, hx + 3.6], RUST, (_x, _y, t) => cyl(t, 0.2));
  hawkFeather(c, hx + 2.6, 8.8 + U, 1, p.tick);
}

// ---------------------------------------------------------------------------
// The fadista

/** The long student's cape seen from the front: behind him on both sides, down to his ankles. */
function capaBehind(c: PixelCanvas, cx: number, U: number, L: number, sway: number): void {
  const top = 14.6 + U;
  const hem = 28.4 + L;
  c.part();
  c.shape(top, Math.round(hem), (y) => {
    const u = (y - top) / (hem - top);
    return [cx - 5.6 - u * 1.4 + u * sway, cx + 5.6 + u * 1.4 + u * sway];
  }, CAPA, (_x, _y, t, u) => sphere(t * 0.9, u * 0.4, 1), { bias: -1 });
  // Long folds down the cloth either side of him.
  for (let y = Math.round(top + 5); y <= Math.round(hem); y++) {
    const u = (y - top) / (hem - top);
    c.shade(Math.round(cx - 6.2 - u * 0.8 + u * sway), y, 1);
    c.shade(Math.round(cx + 5.6 + u * 0.8 + u * sway), y, 1);
  }
  tears(c, [cx - 7, cx + 6], Math.round(hem));
}

/** Tears cut in the cape's hem, Coimbra's way: one for each love, at columns `xs` of row `hem`. */
function tears(c: PixelCanvas, xs: number[], hem: number): void {
  for (const x of xs) {
    if (!c.filled(x, hem - 1) || c.materialAt(x, hem) !== CAPA) continue;
    c.erase(x, hem);
    c.erase(x + 1, hem);
    c.erase(x, hem - 1);
    c.shade(x - 1, hem - 1, -1);
  }
}

/** A tiny swallow in blue and white, pinned over his heart. */
function swallowPin(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.px(x - 1, y - 1, AZULEJO, sphere(-0.3, -0.5));
  c.px(x, y, AZULEJO, sphere(0, -0.4));
  c.px(x + 1, y - 1, AZULEJO, sphere(0.3, -0.5));
  c.px(x, y - 1, SHIRT, sphere(0, -0.5));
  c.spark(x, y - 1, S.light[1], 0.35);
}

/** The fadista's head from the front: black hair combed back in a wave, the face solemn, the cape's collar standing up behind. */
function fadistaHead(c: PixelCanvas, hx: number, hU: number, p: Pose): void {
  // The cape's collar standing up either side of his jaw.
  c.part();
  for (const s2 of [-1, 1]) {
    c.shape(Math.round(12.6 + hU), Math.round(15 + hU), (y) => {
      const hw = 3.9 + ((y - 12.6 - hU) / 2.4) * 1.2;
      return s2 < 0 ? [hx - hw, hx - 2.2] : [hx + 2.0, hx + hw];
    }, CAPA, (_x, _y, t) => sphere(t * 0.5 + s2 * 0.5, -0.3, 1));
  }
  c.part();
  c.ellipse(hx, 11.4 + hU, 3.8, 3.6, RAVEN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.25, 1) });
  c.part();
  c.capsule(hx - 3.1, 11.8 + hU, hx - 3.2, 13.6 + hU, 1.0, 0.7, RAVEN);
  c.capsule(hx + 2.9, 11.8 + hU, hx + 3.0, 13.6 + hU, 1.0, 0.7, RAVEN);
  c.part();
  c.ellipse(hx - 0.2, 12.8 + hU, 2.55, 2.4, SKIN);
  c.part();
  c.shape(Math.round(10 + hU), Math.round(10 + hU), () => [hx - 2.8, hx + 2.4], RAVEN, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
  // A wave falling over one brow, and the sheen along the combed crown.
  c.px(hx + 1, 11 + hU, RAVEN, sphere(0.4, 0.2));
  for (let x = hx - 2; x <= hx + 1; x++) c.shade(x, 8 + hU, 2);
  c.shade(hx - 1, 9 + hU, 1);
  eyes(c, [[hx - 2, 12 + hU], [hx + 1, 12 + hU]], p.blink);
  c.shade(hx - 2, 11 + hU, -1);
  c.shade(hx - 1, 14 + hU, -1);
  c.shade(hx, 14 + hU, -1);
}

/** The fadista from the front: the black frock coat buttoned to a white collar, the cape over his shoulders, a swallow pinned on it. */
function fadistaDown(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 25.6 + L;
  fitted(c, cx, top, waist, hem, BATINA, 0.45);
  for (let y = waist + 1; y <= Math.round(hem); y++) c.shade(cx, y, -2);
  for (let y = top + 2; y <= waist; y += 2) c.shade(cx, y, 2);
  // The cape's fronts falling either side of the coat.
  c.part();
  for (const s2 of [-1, 1]) {
    c.shape(Math.round(16 + U), Math.round(23.5 + U), (y) => {
      const u = (y - 16 - U) / 7.5;
      const o = 4.3 + u * 0.4 + u * p.sway * 0.3 * s2;
      return s2 < 0 ? [cx - o - 1.6, cx - o] : [cx + o, cx + o + 1.6];
    }, CAPA, (_x, _y, t) => sphere(t * 0.6 + s2 * 0.4, 0, 1));
  }
  c.part();
  c.ellipse(cx, 16.1 + U, 5.6, 1.9, CAPA, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.4, 1) });
  // The white collar at the throat.
  c.part();
  c.shape(top, top, () => [cx - 2, cx + 2], SHIRT, (_x, _y, t) => sphere(t * 0.6, -0.5, 1));
  c.shape(top + 1, top + 1, () => [cx - 1, cx + 1], SHIRT, (_x, _y, t) => sphere(t * 0.6, -0.3, 1));
  swallowPin(c, cx + 3, 17 + U);
  fadistaHead(c, cx + (p.head?.[0] ?? 0), U + (p.head?.[1] ?? 0), p);
}

/** The fadista from behind: the cape covering him from the turned-up collar to his ankles. */
function fadistaUp(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const top = 14.4 + U;
  const hem = 28.4 + L;
  c.part();
  c.shape(top, Math.round(hem), (y) => {
    const u = (y - top) / (hem - top);
    return [cx - 5.4 - u * 1.2 + u * p.sway * 0.5, cx + 5.4 + u * (1.2 + p.sway)];
  }, CAPA, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
  for (let y = Math.round(18 + U); y <= Math.round(hem); y++) {
    const u = (y - top) / (hem - top);
    c.shade(Math.round(cx - 2.5 + u * p.sway * 0.5 - u), y, -1);
    c.shade(Math.round(cx + 2 + u * p.sway + u), y, -1);
    c.shade(Math.round(cx + u * p.sway * 0.7), y, 1);
  }
  tears(c, [cx - 4, cx + 1, cx + 5], Math.round(hem));
  // Two ribbons, cobalt and white, pinned at his shoulder and hanging down the cape.
  c.part();
  for (const [i, m] of [[0, AZULEJO], [1, SHIRT]] as const) {
    const x0 = cx - 3.2 + i;
    c.line(x0, 16 + U, x0 - 0.6 + p.sway * 0.4, 22.4 + U - i * 0.8, m, () => sphere(-0.3, -0.2));
  }
  c.px(cx - 3, 16 + U, GOLD, sphere(0, -0.5));
  c.part();
  c.ellipse(cx, 11.4 + U, 3.8, 3.6, RAVEN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.15, 1) });
  for (let y = 9; y <= 12; y++) c.shade(cx + ((y & 1) === 0 ? -1 : 0), y + U, 1);
  c.part();
  c.shape(Math.round(12.8 + U), Math.round(15.4 + U), (y) => {
    const hw = 3.6 + ((y - 12.8 - U) / 2.6) * 1.8;
    return [cx - hw, cx + hw];
  }, CAPA, (_x, _y, t, u) => sphere(t * 0.9, -0.6 + u * 0.5, 1), { bias: 1 });
}

/** The fadista in profile, facing left: the cape streaming long behind him, its collar up at his nape. */
function fadistaSide(c: PixelCanvas, cx: number, hx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  fittedSide(c, cx, hx, top, waist, 25.6 + L, BATINA, 0.45);
  for (const y of [top + 2, top + 4, top + 6]) c.shade(Math.round(sideFront(cx, hx, top, waist, y)) + 1, y, 2);
  c.part();
  c.px(Math.round(hx - 3.2), top, SHIRT, sphere(-0.5, -0.4));
  c.px(Math.round(hx - 2.2), top, SHIRT, sphere(-0.2, -0.4));
  // The cape over his shoulder, the collar standing at his nape.
  c.part();
  c.ellipse(hx + 0.8, 16.2 + U, 3.6, 1.9, CAPA, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + 0.1, dy * 0.6 - 0.4, 1) });
  swallowPin(c, hx - 1.6, 17 + U);
  c.part();
  c.capsule(hx + 2.0, 12.4 + U, hx + 2.6, 15.6 + U, 1.8, 1.6, CAPA);
  // Head: hair combed back, the face turned left.
  c.part();
  c.ellipse(hx + 0.6, 11.6 + U, 3.4, 3.5, RAVEN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.2, 1) });
  for (let x = hx - 2; x <= hx + 2; x++) c.shade(x, 8 + U, 2);
  c.part();
  c.ellipse(hx - 1.4, 12.9 + U, 2.2, 2.3, SKIN);
  c.part();
  c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [hx - 3.2, hx + 0.6], RAVEN, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
  c.px(hx, 11 + U, RAVEN, sphere(0.3, 0));
  c.px(hx, 12 + U, RAVEN, sphere(0.3, 0));
  eyes(c, [[hx - 3, 12 + U]], p.blink);
  c.shade(hx - 3, 11 + U, -1);
  c.shade(hx - 3, 14 + U, -1);
}

// ---------------------------------------------------------------------------
// Orpheus

/** A gold key-pattern border along row `y` and the row above it, wherever the cloth is. */
function keyHem(c: PixelCanvas, x0: number, x1: number, y: number): void {
  const cloth = new Set<number>();
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (c.materialAt(x, y) === CHITON) cloth.add(x);
  c.part();
  for (const x of cloth) {
    const k = ((x % 3) + 3) % 3;
    c.px(x, y, GOLD, sphere(0, 0.3), { bias: k === 1 ? -1 : 0 });
    if (k === 0 && c.materialAt(x, y - 1) === CHITON) c.px(x, y - 1, GOLD, sphere(0, 0));
  }
}

/** Golden curls: the hair pricked out in light and dark wherever it shows. */
function curlTexture(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number): void {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (c.materialAt(x, y) !== CURLS) continue;
      const k = (((x * 2 + y * 3) % 5) + 5) % 5;
      if (k === 0) c.shade(x, y, -1);
      else if (k === 2) c.shade(x, y, 1);
    }
  }
}

/**
 * The laurel wreath: a band of dark glossy leaves round his brow, a leaf
 * springing from it every other pixel, alternately up and down, and gold
 * berries among them that catch the light in turn.
 */
function wreath(c: PixelCanvas, cx: number, U: number, tick: number, view: View): void {
  const pts: [number, number][] = [];
  if (view === 'side') for (let x = -3.6; x <= 3.4; x += 1) pts.push([cx + x, 9.9 + U - (x + 3.6) * 0.12]);
  else for (let x = -4.2; x <= 3.4; x += 1) pts.push([cx + x + 0.4, 9.7 + U + (1 - ((x + 0.4) / 4.2) ** 2) * (view === 'up' ? -0.5 : 0.6)]);
  c.part();
  pts.forEach(([x, y], i) => {
    c.px(x, y, LAUREL, sphere(0, -0.4));
    const up = i % 2 === 0;
    // Leaves lean towards the front of his head (in profile, back along the band).
    const lean = view === 'side' ? 1 : x < cx ? 1 : -1;
    if (up) c.px(x + lean * 0.6, y - 1, LAUREL, sphere(lean * 0.3, -0.8), { bias: 1 });
    else if (i % 4 === 1) c.px(x, y + 1, LAUREL, sphere(0, 0.4), { bias: -1 });
  });
  c.part();
  pts.forEach(([x, y], i) => {
    if (i % 3 !== 1) return;
    c.px(x, y, BROOCH, sphere(0, -0.5));
    if ((tick + i) % 4 === 0) c.spark(x, y, S.light[0], 0.5);
  });
}

/** The two violet ribbons hanging from the wreath's knot, stirring as he moves. */
function wreathRibbons(c: PixelCanvas, x: number, y: number, ends: [number, number][], tick: number): void {
  const flick = [0, 0.3, 0.5, 0.3, 0, -0.2][tick % 6];
  c.part();
  ends.forEach(([ex, ey], i) => c.capsule(x, y, ex + flick * (i ? 0.6 : -0.4), ey + flick * 0.3, 0.6, 0.5, HIMATION));
  c.part();
  c.px(x, y, BROOCH, sphere(0, -0.4));
}

/** The himation hanging down his back from the left shoulder, seen from the front. */
function himationBehind(c: PixelCanvas, cx: number, U: number, L: number, sway: number): void {
  const top = 15 + U;
  const hem = 25.6 + L;
  c.part();
  c.shape(top, Math.round(hem), (y) => {
    const u = (y - top) / (hem - top);
    return [cx + 0.6 + u * sway, cx + 5.8 + u * (1.4 + sway)];
  }, HIMATION, (_x, _y, t, u) => sphere(t * 0.9, u * 0.4, 1), { bias: -1 });
  const row = Math.round(hem);
  for (let x = cx; x <= cx + 9; x++) if (c.materialAt(x, row) === HIMATION) c.px(x, row, GOLD, sphere(0, 0.3), { bias: -1 });
}

/** Orpheus's head from the front: golden curls, a calm face, the laurel. */
function orpheusHead(c: PixelCanvas, hx: number, hU: number, p: Pose): void {
  c.part();
  c.ellipse(hx, 11.4 + hU, 4.0, 3.7, CURLS, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.capsule(hx - 3.4, 12 + hU, hx - 3.7, 14.6 + hU, 1.4, 1.1, CURLS);
  c.capsule(hx + 3.2, 12 + hU, hx + 3.5, 14.6 + hU, 1.4, 1.1, CURLS);
  c.part();
  c.ellipse(hx - 0.2, 12.8 + hU, 2.5, 2.4, SKIN);
  c.part();
  for (let x = hx - 3; x <= hx + 2; x++) c.px(x, 10 + hU, CURLS, sphere((x - hx) * 0.25, -0.2));
  c.px(hx - 3, 11 + hU, CURLS, sphere(-0.6, 0.2));
  c.px(hx + 2, 11 + hU, CURLS, sphere(0.6, 0.2));
  curlTexture(c, hx - 5, hx + 5, 7 + hU, 16 + hU);
  eyes(c, [[hx - 2, 12 + hU], [hx + 1, 12 + hU]], p.blink);
  c.shade(hx - 1, 14 + hU, -1);
  c.shade(hx, 14 + hU, -1);
  wreath(c, hx, hU, p.tick, 'down');
}

/** Orpheus from the front: the white chiton bordered in gold, the himation across him from shoulder to hip, a gold brooch. */
function orpheusDown(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 25.2 + L;
  fitted(c, cx, top, waist, hem, CHITON, 0.6);
  for (let y = waist + 1; y <= Math.round(hem); y++) {
    c.shade(cx - 2, y, -1);
    c.shade(cx + 1, y, -1);
  }
  c.shade(cx - 2, top + 3, -1);
  c.shade(cx - 3, top + 4, -1);
  keyHem(c, cx - 8, cx + 8, Math.round(hem));
  c.part();
  c.shape(waist, waist, () => [cx - 4.1, cx + 4.1], GOLD, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  c.ellipse(cx + 3.8, 16 + U, 2.4, 1.6, HIMATION, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + 0.2, dy * 0.6 - 0.4, 1) });
  c.part();
  c.px(cx + 3, 16 + U, BROOCH, sphere(-0.3, -0.5));
  c.spark(cx + 3, 16 + U, S.light[0], 0.45);
  orpheusHead(c, cx + (p.head?.[0] ?? 0), U + (p.head?.[1] ?? 0), p);
}

/** Orpheus from behind: the himation falling across his back, curls to his nape, the wreath's ribbons hanging. */
function orpheusUp(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 25.2 + L;
  fitted(c, cx, top, waist, hem, CHITON, 0.6);
  for (let y = waist + 1; y <= Math.round(hem); y++) c.shade(cx + 2, y, -1);
  keyHem(c, cx - 8, cx + 8, Math.round(hem));
  c.part();
  c.shape(waist, waist, () => [cx - 4.1, cx + 4.1], GOLD, (_x, _y, t) => cyl(t, 0.2));
  // The himation, over his left shoulder and widening down across his back.
  const hHem = 25.8 + L;
  const right = (y: number) => cx - 1.2 + (y - top) * 0.5 + ((y - top) / (hHem - top)) * p.sway;
  c.part();
  c.shape(Math.round(top - 0.5), Math.round(hHem), (y) => {
    const u = (y - top) / (hHem - top);
    return [cx - 5.0 - u * 0.6 + u * p.sway * 0.5, right(y)];
  }, HIMATION, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
  for (let y = Math.round(top); y <= Math.round(hHem); y++) c.px(Math.round(right(y)) - 1, y, GOLD, sphere(0.4, 0));
  for (let y = Math.round(top + 3); y <= Math.round(hHem); y++) c.shade(Math.round(cx - 3 + ((y - top) / (hHem - top)) * p.sway * 0.5), y, -1);
  c.part();
  c.ellipse(cx - 3.6, 16 + U, 2.4, 1.6, HIMATION, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 - 0.2, dy * 0.6 - 0.4, 1) });
  // Curls from behind, to the nape.
  c.part();
  c.ellipse(cx, 11.4 + U, 4.0, 3.8, CURLS, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  c.part();
  c.shape(Math.round(13 + U), Math.round(15.2 + U), (y) => {
    const hw = 3.6 - (y - 13 - U) * 0.4;
    return [cx - hw, cx + hw];
  }, CURLS, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
  curlTexture(c, cx - 5, cx + 5, 7 + U, 16 + U);
  wreath(c, cx, U, p.tick, 'up');
  wreathRibbons(c, cx, 9.6 + U, [[cx - 1.4 - p.sway * 0.3, 15.8 + U], [cx + 1.4 + p.sway * 0.4, 15.2 + U]], p.tick);
}

/** Orpheus in profile, facing left: the himation streaming back from his shoulder, the ribbons from the wreath. */
function orpheusSide(c: PixelCanvas, cx: number, hx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 25.2 + L;
  fittedSide(c, cx, hx, top, waist, hem, CHITON, 0.55);
  for (let y = waist + 1; y <= Math.round(hem); y++) c.shade(Math.round(sideFront(cx, hx, top, waist, y, 0.55)) + 2, y, -1);
  keyHem(c, cx - 8, cx + 8, Math.round(hem));
  c.part();
  c.shape(waist, waist, () => [hx - 3.1, hx + 3.1], GOLD, (_x, _y, t) => cyl(t, 0.2));
  // The himation across his chest, from the far shoulder to the near hip, edged in gold.
  c.part();
  const band = (y: number) => hx + 1.6 - ((y - top) / (waist + 1 - top)) * 3.6;
  c.shape(top, waist + 1, (y) => [band(y) - 1.2, band(y) + 1.2], HIMATION, (_x, _y, t) => sphere(t * 0.7 - 0.3, -0.1, 1));
  c.part();
  c.ellipse(hx + 0.4, 16 + U, 3.0, 1.7, HIMATION, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + 0.1, dy * 0.6 - 0.4, 1) });
  c.part();
  c.px(hx + 1, 15 + U, BROOCH, sphere(0, -0.6));
  // The ribbons first, then the head: curls, the face turned left, the wreath.
  wreathRibbons(c, hx + 3.2, 10 + U, [[hx + 6.0 + p.sway * 0.5, 13.4 + U], [hx + 5.0 + p.sway * 0.4, 14.8 + U]], p.tick);
  c.part();
  c.ellipse(hx + 0.6, 11.6 + U, 3.5, 3.6, CURLS, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.15, 1) });
  c.part();
  c.capsule(hx + 1.8, 12.5 + U, hx + 2.4 + p.sway * 0.3, 15.2 + U, 1.5, 1.1, CURLS);
  c.part();
  c.ellipse(hx - 1.4, 12.9 + U, 2.2, 2.3, SKIN);
  c.part();
  c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [hx - 3.4, hx + 0.6], CURLS, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
  c.px(hx - 3, 11 + U, CURLS, sphere(-0.5, 0.2));
  curlTexture(c, hx - 5, hx + 5, 7 + U, 16 + U);
  eyes(c, [[hx - 3, 12 + U]], p.blink);
  c.shade(hx - 3, 14 + U, -1);
  wreath(c, hx, U, p.tick, 'side');
}

/** The himation streaming behind him in profile, its hem edged in gold. */
function himationSide(c: PixelCanvas, hx: number, top: number, L: number, sway: number): void {
  const hem = 25.6 + L;
  c.part();
  c.shape(Math.round(top - 0.5), Math.round(hem), (y) => {
    const u = (y - top + 0.5) / (hem - top + 0.5);
    return [hx + 0.6, hx + 3.8 + u * (1.6 + sway)];
  }, HIMATION, (_x, _y, t, u) => sphere(t * 0.9 + 0.1, u * 0.5 - 0.2, 1), { bias: -1 });
  const row = Math.round(hem);
  for (let x = Math.floor(hx); x <= hx + 9; x++) if (c.materialAt(x, row) === HIMATION) c.px(x, row, GOLD, sphere(0.3, 0.3), { bias: -1 });
}

/** The fadista's cape streaming long behind him in profile. */
function capaSide(c: PixelCanvas, hx: number, top: number, L: number, sway: number): void {
  const hem = 28.4 + L;
  c.part();
  c.shape(Math.round(top - 1), Math.round(hem), (y) => {
    const u = (y - top + 1) / (hem - top + 1);
    return [hx + 0.2 - u * 0.4, hx + 4.4 + u * (2.2 + sway)];
  }, CAPA, (_x, _y, t, u) => sphere(t * 0.9 + 0.1, u * 0.5 - 0.2, 1), { bias: -1 });
  for (let y = Math.round(top + 3); y <= Math.round(hem); y++) {
    const u = (y - top + 1) / (hem - top + 1);
    c.shade(Math.round(hx + 2.8 + u * (1.2 + sway)), y, 1);
  }
  tears(c, [Math.round(hx + 3), Math.round(hx + 6)], Math.round(hem));
}

// ---------------------------------------------------------------------------
// The skald

/** A ragged fur hem under row `y`: tufts hanging off the fur here and there, a frosted tip on some. */
function furHem(c: PixelCanvas, x0: number, x1: number, y: number, bias = 0): void {
  c.part();
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (c.materialAt(x, y) !== BEAR) continue;
    const k = (((x * 5) % 7) + 7) % 7;
    if (k < 3) c.px(x, y + 1, BEAR, sphere(0, 0.6), { bias: bias + (k === 0 ? 1 : 0) });
    if (k === 0) c.px(x, y + 2, BEAR, sphere(0, 0.7), { bias });
  }
}

/** Strands of fur combed down the bearskin: dark streaks broken every few rows, a lighter tip here and there. */
function furStrands(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number): void {
  for (let y = Math.round(y0); y <= Math.round(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (c.materialAt(x, y) !== BEAR) continue;
      const k = (((x * 3 + (y >> 1)) % 5) + 5) % 5;
      if (k === 0) c.shade(x, y, -1);
      else if (k === 3 && (y & 1)) c.shade(x, y, 1);
    }
  }
}

/** The bearskin seen from the front: hanging behind him on both sides, to his knees. */
function bearBehind(c: PixelCanvas, cx: number, U: number, L: number, sway: number): void {
  const top = 14.8 + U;
  const hem = 27 + L;
  c.part();
  c.shape(top, Math.round(hem), (y) => {
    const u = (y - top) / (hem - top);
    return [cx - 5.8 - u * 1.3 + u * sway, cx + 5.8 + u * 1.3 + u * sway];
  }, BEAR, (_x, _y, t, u) => sphere(t * 0.9, u * 0.4, 1), { bias: -1 });
  furStrands(c, cx - 9, cx + 9, top + 2, hem);
  furHem(c, cx - 9, cx + 9, Math.round(hem), -1);
}

/** The fur over his shoulders from the front: a thick roll of it, falling a little down his chest either side. */
function bearShoulders(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  for (const s of [-1, 1]) c.capsule(cx + s * 4.3, 15.6 + U, cx + s * 3.6, 19.4 + U, 1.5, 1.0, BEAR);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const k = (i / (n - 1)) * 2 - 1;
    c.ellipse(cx + k * 5.4, 15.5 + U - (1 - k * k) * 0.5, 1.5, 1.35, BEAR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + k * 0.3, dy * 0.8 - 0.25, 1) });
  }
  furStrands(c, cx - 7, cx + 7, 15 + U, 20 + U);
}

/** Fur heaped over a shoulder, over the arm. */
function bearCap(c: PixelCanvas, x: number, y: number, s: number): void {
  c.part();
  c.ellipse(x, y, 2.0, 1.6, BEAR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + s * 0.3, dy * 0.8 - 0.3, 1) });
  c.shade(Math.round(x), Math.round(y + 1), -1);
  c.shade(Math.round(x - s), Math.round(y - 1), 1);
}

/** A gold trefoil brooch: three lobes and a bright heart. */
function trefoil(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.px(x - 1, y, BROOCH, sphere(-0.4, -0.3));
  c.px(x + 1, y, BROOCH, sphere(0.4, -0.3));
  c.px(x, y + 1, BROOCH, sphere(0, 0.2));
  c.px(x, y, GOLD, sphere(0, -0.6), { bias: 1 });
  c.spark(x, y, S.light[1], 0.3);
}

/** A braid: a rope of hair from (x0, y0) to (x1, y1), its plaits pricked out, bound with a gold ring at its end. */
function braid(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, r: number): void {
  c.part();
  c.capsule(x0, y0, x1, y1, r, r * 0.75, FLAX);
  const n = Math.max(1, Math.round(Math.abs(y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    c.shade(Math.round(x0 + (x1 - x0) * t - 0.5 + (i & 1)), Math.round(y0 + (y1 - y0) * t), i & 1 ? -1 : 1);
  }
  c.part();
  c.px(x1, y1 + 0.6, GOLD, sphere(0, -0.3), { bias: 1 });
}

/** A madder braid woven along the hem's row `y`, a gold thread through it, wherever the tunic is. */
function sagaHem(c: PixelCanvas, x0: number, x1: number, y: number): void {
  const cloth: number[] = [];
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (c.materialAt(x, y) === WADMAL) cloth.push(x);
  c.part();
  for (const x of cloth) c.px(x, y, ((x % 3) + 3) % 3 === 1 ? GOLD : MADDER, sphere(0, 0.3));
}

/** The spangenhelm from the front: an iron dome riveted to bronze strips, a brow band and a nasal guard. */
function spangenDown(c: PixelCanvas, cx: number, U: number, nasal = true): void {
  c.part();
  c.shape(Math.round(6.2 + U), Math.round(9.6 + U), (y) => {
    const u = (y - 6.2 - U) / 3.4;
    const hw = 1.6 + Math.sqrt(Math.max(0, u)) * 2.5;
    return [cx - hw - 0.3, cx + hw - 0.1];
  }, IRON, (_x, _y, t, u) => sphere(t * 0.9, u * 0.7 - 0.6, 1));
  // The spangen: bronze strips up the front and the sides to the crown.
  c.part();
  for (let y = Math.round(6.6 + U); y <= Math.round(9.4 + U); y++) c.px(cx - 0.5, y, BRONZE, sphere(0, -0.5));
  for (const s of [-1, 1]) c.px(cx - 0.4 + s * 2.6, 9 + U, BRONZE, sphere(s * 0.6, -0.3));
  c.px(cx - 0.5, 5.8 + U, BRONZE, sphere(0, -0.9), { bias: 1 });
  c.part();
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [cx - 4.2, cx + 3.9], BRONZE, (_x, _y, t) => cyl(t, 0.3));
  for (const x of [cx - 3, cx + 2]) c.shade(x, 10 + U, 2);
  if (!nasal) return;
  // The nasal guard, down over the bridge of his nose.
  c.part();
  c.px(cx - 1, 11 + U, IRON, sphere(0, -0.3), { bias: 1 });
  c.px(cx - 1, 12 + U, IRON, sphere(0, 0), { bias: 1 });
}

/** The skald's head from the front: helm, flaxen braids at his temples, the beard braided in two. */
function skaldHead(c: PixelCanvas, hx: number, hU: number, p: Pose): void {
  c.part();
  c.ellipse(hx, 11.8 + hU, 3.9, 3.5, FLAX, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.ellipse(hx - 0.2, 12.8 + hU, 2.55, 2.4, SKIN);
  eyes(c, [[hx - 2, 12 + hU], [hx + 1, 12 + hU]], p.blink);
  // The helm's shadow over the brow.
  for (let x = hx - 2; x <= hx + 1; x++) c.shade(x, 11 + hU, -1);
  // A full beard over the jaw, the mouth lost in it, then two braids.
  c.part();
  c.shape(Math.round(13.6 + hU), Math.round(15 + hU), (y) => (y <= Math.round(14 + hU) ? [hx - 2.9, hx + 2.5] : [hx - 2.3, hx + 1.9]), FLAX, (_x, _y, t) => sphere(t * 0.8, 0.2, 1));
  c.shade(hx - 1, 14 + hU, -1);
  c.shade(hx, 14 + hU, -1);
  braid(c, hx - 1.4, 15.6 + hU, hx - 1.6, 18.2 + hU, 0.85);
  braid(c, hx + 0.8, 15.6 + hU, hx + 1.0, 18.2 + hU, 0.85);
  // Braids at the temples, falling over the fur in front of his shoulders.
  braid(c, hx - 3.5, 12.6 + hU, hx - 3.9, 17.4 + hU, 0.8);
  braid(c, hx + 3.1, 12.6 + hU, hx + 3.5, 17.4 + hU, 0.8);
  spangenDown(c, hx, hU);
}

/** The skald from the front: the wool tunic and its braid, belt and horn, the bearskin and its brooch. */
function skaldDown(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 25.4 + L;
  fitted(c, cx, top, waist, hem, WADMAL, 0.5);
  for (let y = waist + 1; y <= Math.round(hem); y++) {
    c.shade(cx - 2, y, -1);
    c.shade(cx + 2, y, -1);
  }
  // The keyhole at the throat, trimmed in madder.
  c.part();
  c.px(cx - 1, top + 1, MADDER, sphere(-0.3, -0.4));
  c.px(cx, top + 1, MADDER, sphere(0.3, -0.4));
  c.shade(cx, top + 2, -2);
  sagaHem(c, cx - 8, cx + 8, Math.round(hem));
  // The belt and its buckle, and a drinking horn hung at his hip.
  c.part();
  c.shape(waist, waist, () => [cx - 4.1, cx + 4.1], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx, waist, GOLD, sphere(0, -0.3));
  c.part();
  c.capsule(cx + 4.4, waist + 0.8, cx + 5.0, waist + 3.2, 0.9, 0.6, IVORY);
  c.px(cx + 4.6, waist + 3.8, BRONZE, sphere(0.2, 0.4), { bias: 1 });
  c.px(cx + 4.2, waist + 0.4, BRONZE, sphere(0, -0.4), { bias: 1 });
  bearShoulders(c, cx, U);
  trefoil(c, cx - 2, 16.6 + U);
  skaldHead(c, cx + (p.head?.[0] ?? 0), U + (p.head?.[1] ?? 0), p);
}

/** The skald from behind: the bearskin over his back to the knee, a braid down it, the helm. */
function skaldUp(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  fitted(c, cx, top, waist, 25.4 + L, WADMAL, 0.5);
  sagaHem(c, cx - 8, cx + 8, Math.round(25.4 + L));
  const hem = 27 + L;
  c.part();
  c.shape(Math.round(top - 0.6), Math.round(hem), (y) => {
    const u = (y - top) / (hem - top);
    return [cx - 5.6 - u * 1.0 + u * p.sway * 0.5, cx + 5.6 + u * (1.0 + p.sway)];
  }, BEAR, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
  furStrands(c, cx - 9, cx + 9, top, hem);
  furHem(c, cx - 9, cx + 9, Math.round(hem));
  // Flaxen hair to the nape, a long braid down the fur, the helm (no nasal from behind).
  c.part();
  c.ellipse(cx, 11.6 + U, 3.9, 3.6, FLAX, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  c.part();
  c.shape(Math.round(13 + U), Math.round(15.4 + U), (y) => {
    const hw = 3.4 - (y - 13 - U) * 0.9;
    return [cx - hw, cx + hw];
  }, FLAX, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
  braid(c, cx - 0.2, 15 + U, cx + p.sway * 0.4, 19.0 + U, 0.8);
  spangenDown(c, cx, U, false);
}

/** The skald in profile, facing left: the tunic, the fur on his shoulder, the helm's nasal out over his nose. */
function skaldSide(c: PixelCanvas, cx: number, hx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 25.4 + L;
  fittedSide(c, cx, hx, top, waist, hem, WADMAL, 0.5);
  sagaHem(c, cx - 8, cx + 8, Math.round(hem));
  c.part();
  c.shape(waist, waist, () => [hx - 3.1, hx + 3.1], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(hx - 3.1), waist, GOLD, sphere(-0.5, -0.3));
  // The horn hangs at the back of his hip.
  c.part();
  c.capsule(hx + 2.8, waist + 0.7, hx + 3.6 + p.sway * 0.2, waist + 3.0, 0.9, 0.6, IVORY);
  c.px(hx + 3.8 + p.sway * 0.2, waist + 3.6, BRONZE, sphere(0.2, 0.4), { bias: 1 });
  // The fur over his shoulder.
  c.part();
  c.ellipse(hx + 0.6, 16.0 + U, 3.8, 2.0, BEAR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + 0.1, dy * 0.6 - 0.4, 1) });
  furStrands(c, hx - 4, hx + 5, 14 + U, 18 + U);
  trefoil(c, hx - 2, 16.6 + U);
  // Head: hair to the nape, the face turned left, the beard and its braid.
  c.part();
  c.ellipse(hx + 0.6, 11.8 + U, 3.4, 3.5, FLAX, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
  c.part();
  c.ellipse(hx - 1.4, 12.9 + U, 2.2, 2.3, SKIN);
  c.part();
  c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
  eyes(c, [[hx - 3, 12 + U]], p.blink);
  c.shade(hx - 3, 11 + U, -1);
  c.part();
  c.shape(Math.round(13.8 + U), Math.round(15 + U), (y) => (y <= Math.round(14 + U) ? [hx - 3.8, hx + 0.6] : [hx - 3.4, hx + 0.2]), FLAX, (_x, _y, t) => sphere(t * 0.8, 0.2, 1));
  braid(c, hx - 2.4, 15.6 + U, hx - 2.8, 18.2 + U, 0.85);
  braid(c, hx + 1.8, 12.6 + U, hx + 2.4 + p.sway * 0.3, 17.0 + U, 0.85);
  // The helm in profile.
  c.part();
  c.shape(Math.round(6.4 + U), Math.round(9.6 + U), (y) => {
    const u = Math.sqrt(Math.max(0, (y - 6.4 - U) / 3.2));
    return [hx - 1.4 - u * 2.1, hx + 1.6 + u * 1.8];
  }, IRON, (_x, _y, t, u) => sphere(t * 0.9, u * 0.7 - 0.6, 1));
  c.part();
  for (let y = Math.round(6.8 + U); y <= Math.round(9.4 + U); y++) c.px(hx - 0.4 - (y - 6.8 - U) * 0.35, y, BRONZE, sphere(-0.2, -0.5));
  c.px(hx, 5.9 + U, BRONZE, sphere(0, -0.9), { bias: 1 });
  c.part();
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [hx - 3.9, hx + 3.4], BRONZE, (_x, _y, t) => cyl(t, 0.3));
  c.shade(hx + 1, 10 + U, 2);
  c.part();
  c.px(hx - 4, 11 + U, IRON, sphere(-0.5, -0.2), { bias: 1 });
  c.px(hx - 4, 12 + U, IRON, sphere(-0.5, 0.1), { bias: 1 });
}

/** The bearskin streaming behind him in profile, to his knees. */
function bearSide(c: PixelCanvas, hx: number, top: number, L: number, sway: number): void {
  const hem = 27 + L;
  c.part();
  c.shape(Math.round(top - 1), Math.round(hem), (y) => {
    const u = (y - top + 1) / (hem - top + 1);
    return [hx + 0.2 - u * 0.4, hx + 4.6 + u * (1.8 + sway)];
  }, BEAR, (_x, _y, t, u) => sphere(t * 0.9 + 0.1, u * 0.5 - 0.2, 1), { bias: -1 });
  furStrands(c, hx - 1, hx + 9, top, hem);
  furHem(c, hx - 1, hx + 9, Math.round(hem), -1);
}

// ---------------------------------------------------------------------------
// The taiko drummer

/** White waves along the happi's hem: a white border on row `y`, crests rising off it every third pixel. */
function waveHem(c: PixelCanvas, x0: number, x1: number, y: number): void {
  const cloth: number[] = [];
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (c.materialAt(x, y) === AI) cloth.push(x);
  c.part();
  for (const x of cloth) {
    c.px(x, y, COTTON, sphere(0, 0.3));
    const k = ((x % 3) + 3) % 3;
    if (k === 0 && c.materialAt(x, y - 1) === AI) c.px(x, y - 1, COTTON, sphere(0, 0));
  }
}

/** A cord twisted of vermilion and white, from (x0, y0) to (x1, y1). */
function twistCord(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  c.part();
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    c.px(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, i % 3 === 2 ? COTTON : SHU, sphere(0, -0.3));
  }
}

/** The hachimaki's two ends, out from its knot at (x, y), flicking in the air as he moves. */
function headbandTails(c: PixelCanvas, x: number, y: number, dir: number, tick: number, drop = 0): void {
  const flick = [0, 0.5, 0.8, 0.4, 0, -0.3][tick % 6];
  c.part();
  c.capsule(x, y, x + dir * 2.2, y - 1.2 + flick + drop, 0.65, 0.45, COTTON);
  c.capsule(x, y + 0.3, x + dir * 1.8, y + 1.5 + flick * 0.6 + drop, 0.6, 0.4, COTTON);
  c.part();
  c.px(x, y, COTTON, sphere(dir * 0.4, -0.4), { bias: 1 });
}

/** The taiko drummer's head from the front: black hair up in a knot, a white hachimaki, a hard stare. */
function taikoHead(c: PixelCanvas, hx: number, hU: number, p: Pose): void {
  headbandTails(c, hx + 3.2, 10.2 + hU, 1, p.tick);
  c.part();
  c.ellipse(hx, 11.2 + hU, 3.3, 3.2, RAVEN_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 1) });
  c.part();
  c.ellipse(hx, 7.6 + hU, 1.4, 1.2, RAVEN_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.4, 1) });
  c.shade(hx - 1, 7 + hU, 2);
  c.part();
  c.ellipse(hx, 12.4 + hU, 3.0, 2.8, SKIN);
  // Sideburns cut short.
  c.part();
  c.px(hx - 3, 11 + hU, RAVEN_HAIR, sphere(-0.6, 0));
  c.px(hx + 2, 11 + hU, RAVEN_HAIR, sphere(0.6, 0));
  // The hachimaki round his brow, a red sun at its front.
  c.part();
  c.shape(Math.round(10 + hU), Math.round(10 + hU), () => [hx - 3.4, hx + 3.2], COTTON, (_x, _y, t) => cyl(t, 0.2));
  c.px(hx - 1, 10 + hU, SHU, sphere(0, -0.3), { bias: 1 });
  eyes(c, [[hx - 2, 12 + hU], [hx + 1, 12 + hU]], p.blink);
  // Brows set hard, and a mouth ready to shout the kiai.
  c.shade(hx - 2, 11 + hU, -2);
  c.shade(hx + 1, 11 + hU, -2);
  c.shade(hx - 1, 14 + hU, -1);
  c.shade(hx, 14 + hU, -1);
}

/** The happi's front: indigo to the hips, the white collar band crossing over the chest, waves at the hem, the vermilion obi knotted at the side. */
function taikoDown(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 25.6 + L;
  c.part();
  c.shape(top, Math.round(hem), (y) => {
    if (y < waist) {
      const u = (y + 0.5 - top) / (waist - top);
      const hw = 5.1 - 0.7 * u * u;
      return [cx - hw, cx + hw];
    }
    const hw = 4.5 + (y - waist) * 0.25;
    const s = (y - waist) * 0.1 * p.sway;
    return [cx - hw + s, cx + hw + s];
  }, AI, (_x, y, t) => sphere(t * 0.9, y < waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
  for (let y = waist + 2; y <= Math.round(hem); y++) for (const x of [cx - 3, cx + 3]) c.shade(x, y, -1);
  // His chest in the V of the collar, then the collar band: the long side crossing down to the obi.
  c.part();
  for (let y = top; y <= top + 2; y++) {
    const hw = 1.6 - (y - top) * 0.6;
    c.shape(y, y, () => [cx - 0.5 - hw, cx - 0.5 + hw], SKIN, (_x, _y, t) => sphere(t * 0.5, -0.2, 1));
  }
  c.part();
  c.line(cx + 2.2, top, cx - 1.6, waist - 1, COTTON, () => sphere(0.2, -0.3));
  c.line(cx - 2.6, top, cx - 0.8, top + 2.6, COTTON, () => sphere(-0.2, -0.3));
  // Characters brushed down the long band.
  c.shade(cx + 1, top + 2, -3);
  c.shade(cx, top + 4, -3);
  waveHem(c, cx - 8, cx + 8, Math.round(hem));
  // The obi, knotted at his right hip, its ends hanging.
  c.part();
  c.shape(waist, waist + 1, () => [cx - 4.7, cx + 4.7], SHU, (_x, y, t) => sphere(t * 0.9, y === waist ? -0.3 : 0.3, 1));
  c.part();
  c.ellipse(cx - 3.2, waist + 0.5, 1.2, 1.0, SHU, { bias: 1 });
  c.px(cx - 4, waist + 2, SHU, sphere(-0.3, 0.4), { bias: 1 });
  c.px(cx - 3, waist + 3, SHU, sphere(0, 0.5), { bias: 1 });
  twistCord(c, 15.8, 15.4 + U, 8.6, 21.2 + U);
  drawDrum(c, cx, 21 + U, 4.6, p.glow);
  taikoHead(c, cx + (p.head?.[0] ?? 0), U + (p.head?.[1] ?? 0), p);
}

/** The happi's back: a white crest between the shoulders, the obi's bow, the headband knotted at the nape. */
function taikoUp(c: PixelCanvas, cx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 25.6 + L;
  c.part();
  c.shape(top, Math.round(hem), (y) => {
    if (y < waist) {
      const u = (y + 0.5 - top) / (waist - top);
      const hw = 5.1 - 0.7 * u * u;
      return [cx - hw, cx + hw];
    }
    const hw = 4.5 + (y - waist) * 0.25;
    return [cx - hw, cx + hw];
  }, AI, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
  for (let y = waist + 2; y <= Math.round(hem); y++) c.shade(cx, y, -1);
  // The crest: a white ring round three commas, the drum's own sign.
  const my = top + 3.4;
  c.part();
  c.ellipse(cx, my, 2.3, 2.2, COTTON, { normal: (_x, _y, dx, dy) => sphere(dx * 0.5, dy * 0.5 - 0.3, 1) });
  c.part();
  for (const [dx, dy] of [[-1, -1], [0, 0], [-1, 0]] as const) c.px(cx + dx, Math.round(my) + dy, AI, sphere(0, -0.3), { bias: 1 });
  waveHem(c, cx - 8, cx + 8, Math.round(hem));
  c.part();
  c.shape(waist, waist + 1, () => [cx - 4.7, cx + 4.7], SHU, (_x, y, t) => sphere(t * 0.9, y === waist ? -0.3 : 0.3, 1));
  // The obi's bow at the small of his back.
  c.part();
  c.ellipse(cx - 2, waist + 0.4, 1.4, 1.0, SHU, { bias: 1 });
  c.ellipse(cx + 1.4, waist + 0.4, 1.4, 1.0, SHU, { bias: 1 });
  c.px(cx - 0.5, waist + 0.5, SHU, sphere(0, -0.4), { bias: 2 });
  c.px(cx - 1, waist + 2, SHU, sphere(0, 0.4), { bias: 1 });
  c.px(cx, waist + 2.6, SHU, sphere(0, 0.5), { bias: 1 });
  twistCord(c, 8.2, 15.4 + U, 15.4, 21.2 + U);
  // His head from behind: black hair, the knot, the band's knot at the nape and its ends hanging.
  c.part();
  c.ellipse(cx, 11.6 + U, 3.2, 3.2, RAVEN_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  c.part();
  c.ellipse(cx, 7.6 + U, 1.4, 1.2, RAVEN_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.4, 1) });
  c.part();
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [cx - 3.3, cx + 3.3], COTTON, (_x, _y, t) => cyl(t, 0.2));
  // The knot at the nape, its two ends hanging down it and stirring.
  const flick = [0, 0.4, 0.6, 0.3, 0, -0.2][p.tick % 6];
  c.part();
  c.capsule(cx - 0.6, 10.6 + U, cx - 1.2 - flick * 0.5, 13.8 + U, 0.6, 0.45, COTTON);
  c.capsule(cx + 0.2, 10.6 + U, cx + 0.9 + flick, 13.4 + U, 0.6, 0.45, COTTON);
  c.part();
  c.px(cx - 0.5, 10 + U, COTTON, sphere(0, -0.5), { bias: 2 });
}

/** The taiko drummer in profile, facing left: the happi and its collar band, the obi, the headband's ends streaming back. */
function taikoSide(c: PixelCanvas, cx: number, hx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  const hem = 25.6 + L;
  c.part();
  c.shape(top, Math.round(hem), (y) => {
    if (y < waist) {
      const u = (y + 0.5 - top) / (waist - top);
      const hw = 3.6 - 0.5 * u * u;
      return [hx - hw - 0.4, hx + hw];
    }
    const u = Math.min(1, (y - waist) / 3);
    const shift = hx + (cx - hx) * u;
    const hw = 3.4 + (y - waist) * 0.25;
    return [shift - hw, shift + hw + u * p.sway * 0.5];
  }, AI, (_x, y, t) => sphere(t * 0.9 - 0.1, y < waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
  c.part();
  c.px(hx - 3.6, top, SKIN, sphere(-0.5, -0.3));
  c.line(hx - 2.4, top, hx - 3.6, waist - 1, COTTON, () => sphere(-0.4, -0.2));
  c.shade(Math.round(hx - 3), top + 3, -3);
  waveHem(c, cx - 8, cx + 8, Math.round(hem));
  c.part();
  c.shape(waist, waist + 1, () => [hx - 3.6, hx + 3.6], SHU, (_x, y, t) => sphere(t * 0.9 - 0.1, y === waist ? -0.3 : 0.3, 1));
  c.part();
  c.ellipse(hx + 3.6, waist + 0.4, 1.0, 1.1, SHU, { bias: 1 });
  c.px(hx + 4 + p.sway * 0.3, waist + 2, SHU, sphere(0.3, 0.4), { bias: 1 });
  twistCord(c, hx + 1.6, 15.2 + U, hx - 2.2, 21 + U);
  // Head: hair and its knot, the face turned left, the band and its ends streaming back.
  headbandTails(c, hx + 3.0, 10.2 + U, 1, p.tick, 0.4);
  c.part();
  c.ellipse(hx + 0.6, 11.4 + U, 3.0, 3.1, RAVEN_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.2, 1) });
  c.part();
  c.ellipse(hx + 0.8, 7.6 + U, 1.3, 1.2, RAVEN_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.4, 1) });
  c.part();
  c.ellipse(hx - 1.2, 12.6 + U, 2.5, 2.5, SKIN);
  c.part();
  c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
  c.px(hx + 0.4, 11 + U, RAVEN_HAIR, sphere(0.3, 0));
  c.part();
  c.shape(Math.round(10 + U), Math.round(10 + U), () => [hx - 3.8, hx + 3.0], COTTON, (_x, _y, t) => cyl(t, 0.2));
  c.px(hx - 4, 10 + U, SHU, sphere(-0.5, -0.3), { bias: 1 });
  eyes(c, [[hx - 3, 12 + U]], p.blink);
  c.shade(hx - 3, 11 + U, -2);
  c.shade(hx - 3, 14 + U, -1);
}

/** The happi's short sleeves capping his shoulders over the bare arms, hemmed in white. */
function happiSleeve(c: PixelCanvas, x: number, y: number, s: number): void {
  c.part();
  c.ellipse(x, y, 1.9, 1.5, AI, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + s * 0.3, dy * 0.8 - 0.3, 1) });
  c.part();
  c.px(x - 0.5, y + 1.4, COTTON, sphere(s * 0.3, 0.4));
  c.px(x + 0.5 * s, y + 1.2, COTTON, sphere(s * 0.3, 0.4));
}

// ---------------------------------------------------------------------------
// Views

const REACH_FRONT = 4.5;
const REACH_SIDE = 5.2;

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const drum = S.drum;
  const armA = () => (drum ? bareArm : sleevedArm)(c, 7.2, 16.3 + U, fa, REACH_FRONT, [-0.6, 1], fa.behind ? -1 : 0);
  const armB = () => (drum ? bareArm(c, 16.8, 16.3 + U, fb, REACH_FRONT, [0.6, 1], fb.behind ? -1 : 0) : sleevedArm(c, 16.8, 16.3 + U, fb, REACH_FRONT, [0.6, 1], fb.behind ? -1 : 0, S.style === 'harlequin'));
  const sticks = (arm: 'a' | 'b') => drum && mallet(c, 'down', arm, arm === 'a' ? fa : fb, arm === 'a' ? p.stickA : p.stickB, p.glow, (arm === 'a' ? fa : fb).behind ? -1 : 0);

  if (S.wild) wildCloakBehind(c, cx, U, L, p.sway);
  else if (S.style === 'vagabond') bedrollFront(c, cx, U);
  else if (S.style === 'fadista') capaBehind(c, cx, U, L, p.sway);
  else if (S.style === 'orpheus') himationBehind(c, cx, U, L, p.sway);
  else if (S.style === 'skald') bearBehind(c, cx, U, L, p.sway);
  else if (!drum && !S.style) {
    // The half-cape hangs from his left shoulder, showing behind him on that side.
    c.part();
    c.shape(15 + U, 25 + L, (y) => {
      const u = (y - 15 - U) / (10 + L - U);
      return [cx + 0.5 + u * p.sway, cx + 5.6 + u * (1.2 + p.sway)];
    }, WINE, (_x, _y, t, u) => sphere(t * 0.9, u * 0.4, 1), { bias: -1 });
  }
  if (fa.behind) {
    armA();
    sticks('a');
  }
  if (fb.behind) {
    armB();
    sticks('b');
  }

  const harl = S.style === 'harlequin';
  leg(c, 10.2, 24.5 + L, 10, 28.4 - p.footA, 0, harl ? MOTLEY_A : undefined);
  leg(c, 13.8, 24.5 + L, 14, 28.4 - p.footB, 0, harl ? MOTLEY_B : undefined);
  boot(c, 10, 29.6 - p.footA);
  boot(c, 14, 29.6 - p.footB);

  const top = 15 + U;
  const waist = 22 + U;
  const hem = (drum ? 26 : 24.5) + L;
  const howl = S.style === 'howl';
  // The head may bob on its own (the idle moment); everything else stays put.
  const hx = cx + (p.head?.[0] ?? 0);
  const hU = U + (p.head?.[1] ?? 0);
  if (drum && S.style === 'taiko') {
    taikoDown(c, cx, U, L, p);
  } else if (drum) {
    // A kilt of leather strips, then the bare chest under an open vest.
    c.part();
    c.shape(waist, Math.round(hem), (y) => {
      const hw = 4.6 + (y - waist) * 0.35;
      return [cx - hw + (y - waist) * 0.1 * p.sway, cx + hw + (y - waist) * 0.1 * p.sway];
    }, G.kilt, (_x, _y, t) => sphere(t * 0.9, 0.25, 1));
    for (let y = waist + 1; y <= hem; y++) for (const x of [cx - 3, cx - 1, cx + 1, cx + 3]) c.shade(x, y, -1);
    if (howl) fringe(c, cx - 6, cx + 6, Math.round(hem));
    c.part();
    c.shape(top, waist - 1, (y) => {
      const u = (y + 0.5 - top) / (waist - top);
      const hw = 5.1 - 0.7 * u * u;
      return [cx - hw, cx + hw];
    }, SKIN, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.8 - 0.35, 1));
    // Pecs, and the vest's open sides (the moonhowl's chest is bare, painted and hung with teeth).
    c.shade(cx - 2, top + 3, -1);
    c.shade(cx + 1, top + 3, -1);
    c.shade(cx - 1, top + 4, -1);
    c.shade(cx, top + 4, -1);
    if (howl) {
      woadChest(c, cx, top);
      toothNecklace(c, cx, top + 0.6, 3.6);
    } else {
      c.part();
      for (let y = top; y < waist; y++) {
        const u = (y + 0.5 - top) / (waist - top);
        const hw = 5.1 - 0.7 * u * u;
        c.shape(y, y, () => [cx - hw, cx - hw + 2 - u * 0.4], G.vest, (_x, _y, t) => sphere(t * 0.5 - 0.6, 0, 1));
        c.shape(y, y, () => [cx + hw - 2 + u * 0.4, cx + hw], G.vest, (_x, _y, t) => sphere(t * 0.5 + 0.6, 0, 1));
      }
    }
    // The belt, the drum's strap across the chest, and the fur mantle.
    c.part();
    c.shape(waist, waist, () => [cx - 4.6, cx + 4.6], LEATHER, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.capsule(15.8, 15.4 + U, 8.6, 21.2 + U, 0.6, 0.6, LEATHER);
    mantle(c, cx, U, 5.6);
    if (howl) peltPaws(c, cx, U);
    drawDrum(c, cx, 21 + U, 4.6, p.glow);
    if (howl) {
      feathers(c, cx - 5, 22 + U, p.tick);
      feathers(c, cx + 5, 22 + U, p.tick + 2);
    }
    // The head: a broad face, war paint across the eyes, a braided beard.
    c.part();
    c.ellipse(hx, 12.2 + hU, 3.0, 2.9, SKIN);
    c.part();
    c.shape(Math.round(12 + hU), Math.round(12 + hU), () => [hx - 3, hx + 3], G.paint, () => sphere(0, 0, 1));
    c.px(hx - 3, 11 + hU, G.paint, sphere(0, 0, 1));
    c.px(hx + 2, 11 + hU, G.paint, sphere(0, 0, 1));
    if (howl) {
      // Woad running down his cheeks like claw marks.
      c.px(hx - 3, 13 + hU, G.paint, sphere(0, 0, 1));
      c.px(hx + 2, 13 + hU, G.paint, sphere(0, 0, 1));
    }
    eyes(c, [[hx - 2, 12 + hU], [hx + 1, 12 + hU]], p.blink);
    beardDown(c, hx, hU);
    if (howl) wolfHoodDown(c, hx, hU, p.tick);
    else helmDown(c, hx, hU);
  } else if (S.style === 'harlequin') {
    harlequinBody(c, cx, U, L, p.tick, false);
    ruff(c, cx, 15.4 + U, 4.3, 1.5);
    maskDown(c, hx, hU, p.blink);
    jesterCap(c, hx, hU, p.tick, 'down');
  } else if (S.style === 'vagabond') {
    vagabondDown(c, cx, U, L, p);
  } else if (S.style === 'fadista') {
    fadistaDown(c, cx, U, L, p);
  } else if (S.style === 'skald') {
    skaldDown(c, cx, U, L, p);
  } else if (S.style === 'orpheus') {
    orpheusDown(c, cx, U, L, p);
  } else if (S.wild) {
    wildDown(c, cx, U, L, p);
  } else {
    // The doublet, a short skirt flaring below the belt.
    c.part();
    c.shape(top, Math.round(hem), (y) => {
      const hw = y <= waist ? 4.5 - 0.5 * ((y + 0.5 - top) / (waist - top)) ** 2 : 4.1 + (y - waist) * 0.55;
      return [cx - hw, cx + hw];
    }, DOUBLET, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
    for (let y = waist + 1; y <= hem; y++) {
      c.shade(cx - 2, y, -1);
      c.shade(cx + 2, y, -1);
    }
    // A seam down the front with gold buttons.
    c.part();
    for (let y = top + 2; y < waist; y++) c.shade(cx, y, -1);
    for (const y of [top + 2, top + 4, top + 6]) c.px(cx, y, GOLD, sphere(0, -0.4));
    // Belt and buckle, and a cream collar.
    c.part();
    c.shape(waist, waist, () => [cx - 4.1, cx + 4.1], LEATHER, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.px(cx, waist, GOLD, sphere(0, -0.3));
    c.part();
    c.ellipse(cx, 15.2 + U, 2.6, 1.1, SHIRT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.5 - 0.4, 1) });
    // The cape's drape over his left shoulder, pinned with gold.
    c.part();
    c.ellipse(cx + 3.6, 16 + U, 2.5, 1.6, WINE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + 0.2, dy * 0.6 - 0.4, 1) });
    c.part();
    c.px(cx + 2, 16 + U, GOLD, sphere(-0.3, -0.4));
    // Head: chestnut hair to the shoulders, the face, the cap.
    c.part();
    c.ellipse(hx, 11.6 + hU, 3.9, 3.7, CHESTNUT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
    c.part();
    c.capsule(hx - 3.2, 12 + hU, hx - 3.6, 15.4 + hU, 1.3, 1.0, CHESTNUT);
    c.capsule(hx + 3.0, 12 + hU, hx + 3.4, 15.4 + hU, 1.3, 1.0, CHESTNUT);
    c.part();
    c.ellipse(hx - 0.2, 12.8 + hU, 2.55, 2.4, SKIN);
    c.part();
    c.shape(Math.round(10 + hU), Math.round(10 + hU), () => [hx - 2.8, hx + 1.2], CHESTNUT, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
    c.px(hx - 3, 11 + hU, CHESTNUT, sphere(-0.6, 0.2));
    eyes(c, [[hx - 2, 12 + hU], [hx + 1, 12 + hU]], p.blink);
    // A small, easy smile.
    c.shade(hx - 1, 14 + hU, -1);
    c.shade(hx, 14 + hU, -1);
    capDown(c, hx, hU, p.tick);
  }

  if (!drum) drawLute(c, 'down', p, fa, fb);
  if (!fb.behind) {
    armB();
    sticks('b');
  }
  if (!fa.behind) {
    armA();
    sticks('a');
  }
  if (S.style === 'taiko') {
    // The happi's short sleeves capping his shoulders, over the arms.
    for (const s of [-1, 1]) happiSleeve(c, cx + s * 5.0, 15.9 + U, s);
  } else if (S.style === 'skald') {
    for (const s of [-1, 1]) bearCap(c, cx + s * 5.0, 15.7 + U, s);
  } else if (drum) {
    // Fur spilling over the tops of his shoulders, over the arms.
    c.part();
    for (const s of [-1, 1]) {
      c.ellipse(cx + s * 5.2, 15.6 + U, 1.9, 1.5, G.fur, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + s * 0.3, dy * 0.8 - 0.3, 1) });
      c.shade(cx + s * 5, 17 + U, -1);
    }
  }
  if (S.wild) wisps(c, U, p.tick);
  if (p.rings) beatRings(c, cx, 21 + U, p.rings, p.ringK ?? 1);
  for (const n of p.notes ?? []) tinyNote(c, n);
}

// ---------------------------------------------------------------------------
// The idle moment's light

/** A little note of light (a few pixels: a head, a stem and a flag, or two beamed), in the music's colours. */
function tinyNote(c: PixelCanvas, n: Note): void {
  const [core, hot, mid] = S.light;
  const x = Math.round(n.x);
  const y = Math.round(n.y);
  const lit = (dx: number, dy: number, col: RGB, a = 1) => c.spark(x + dx, y + dy, col, a * n.k);
  // A round head two pixels square, bright at its heart, and a stem up its right side.
  const head = (hx: number) => {
    lit(hx, -1, hot);
    lit(hx + 1, -1, core);
    lit(hx, 0, core);
    lit(hx + 1, 0, hot);
    for (let i = 2; i <= 4; i++) lit(hx + 1, -i, i === 4 ? core : hot);
  };
  head(0);
  if (n.two) {
    // A second note, and the beam across their tops.
    head(4);
    for (let i = 2; i <= 4; i++) lit(i, -4, hot);
  } else {
    // The flag, curling off the stem's top.
    lit(2, -4, hot);
    lit(3, -3, mid);
  }
}

/** Rings of light spreading out flat from the drum's head, passing behind him where he stands in their way. */
function beatRings(c: PixelCanvas, cx: number, cy: number, radii: number[], k: number): void {
  const [, hot, mid, deep] = S.light;
  radii.forEach((r, j) => {
    const n = Math.round(r * 5);
    const a = k * (1 - j * 0.35);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const x = cx + Math.cos(t) * r;
      const y = cy + Math.sin(t) * r * 0.42;
      if (Math.sin(t) < 0 && c.filled(Math.floor(x), Math.floor(y))) continue;
      c.spark(x, y, r < 7 ? hot : r < 10 ? mid : deep, a * (r < 7 ? 0.8 : 0.6));
    }
  });
}



/** The fur mantle: a ruff of tufts along the shoulders. */
function mantle(c: PixelCanvas, cx: number, U: number, span: number): void {
  c.part();
  const n = 7;
  for (let i = 0; i < n; i++) {
    const k = (i / (n - 1)) * 2 - 1;
    const x = cx + k * span;
    const y = 15.4 + U - (1 - k * k) * 0.6;
    c.ellipse(x, y, 1.4, 1.3, G.fur, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + k * 0.3, dy * 0.8 - 0.2, 1) });
  }
}

/** A braided ginger beard falling from the chin, bound near its end. */
function beardDown(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.shape(Math.round(14 + U), Math.round(15 + U), (y) => (y === Math.round(14 + U) ? [cx - 2.8, cx + 2.8] : [cx - 2.2, cx + 2.2]), G.beard, (_x, _y, t) => sphere(t * 0.8, 0.2, 1));
  c.part();
  c.capsule(cx - 0.4, 15.5 + U, cx - 0.4, 18.6 + U, 1.1, 0.8, G.beard);
  for (let y = 16; y <= 18; y++) c.shade(cx - 1 + ((y & 1) === 0 ? 0 : 1), y + U, -1);
  c.part();
  c.px(cx - 1, 18 + U, G.bead, sphere(0, -0.3));
  // A moustache over the mouth.
  c.shade(cx - 2, 14 + U, -1);
  c.shade(cx + 1, 14 + U, -1);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const drum = S.drum;
  const armA = () => (drum ? bareArm(c, 7.2, 16.3 + U, fa, REACH_FRONT, [-0.6, 0.8], fa.behind ? -1 : 0) : sleevedArm(c, 7.2, 16.3 + U, fa, REACH_FRONT, [-0.6, 0.8], fa.behind ? -1 : 0, S.style === 'harlequin'));
  const armB = () => (drum ? bareArm : sleevedArm)(c, 16.8, 16.3 + U, fb, REACH_FRONT, [0.6, 0.8], fb.behind ? -1 : 0);
  const sticks = (arm: 'a' | 'b') => drum && mallet(c, 'up', arm, arm === 'a' ? fa : fb, arm === 'a' ? p.stickA : p.stickB, 0, (arm === 'a' ? fa : fb).behind ? -1 : 0);

  // The lute or the drum is in front of him, hidden but for what peeks past.
  if (!drum) drawLute(c, 'up', p, fa, fb, -1);
  else drawDrum(c, cx, 21 + U, 4.6, 0, -1);
  if (fa.behind) {
    armA();
    sticks('a');
  }
  if (fb.behind) {
    armB();
    sticks('b');
  }

  const harl = S.style === 'harlequin';
  leg(c, 10.2, 24.5 + L, 10, 28.4 - p.footB, 0, harl ? MOTLEY_B : undefined);
  leg(c, 13.8, 24.5 + L, 14, 28.4 - p.footA, 0, harl ? MOTLEY_A : undefined);
  boot(c, 10, 29.6 - p.footB);
  boot(c, 14, 29.6 - p.footA);

  const top = 15 + U;
  const waist = 22 + U;
  const howl = S.style === 'howl';
  if (drum && S.style === 'taiko') {
    taikoUp(c, cx, U, L, p);
  } else if (drum) {
    c.part();
    c.shape(waist, 26 + L, (y) => {
      const hw = 4.6 + (y - waist) * 0.35;
      return [cx - hw, cx + hw];
    }, G.kilt, (_x, _y, t) => sphere(t * 0.9, 0.25, 1));
    for (let y = waist + 1; y <= 26 + L; y++) for (const x of [cx - 3, cx - 1, cx + 1, cx + 3]) c.shade(x, y, -1);
    if (howl) fringe(c, cx - 6, cx + 6, 26 + L);
    // The vest covers his back (the moonhowl's is bare); the strap crosses it.
    c.part();
    c.shape(top, waist - 1, (y) => {
      const u = (y + 0.5 - top) / (waist - top);
      const hw = 5.1 - 0.7 * u * u;
      return [cx - hw, cx + hw];
    }, howl ? SKIN : G.vest, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
    for (let y = top + 1; y < waist; y++) c.shade(cx, y, -1);
    c.part();
    c.shape(waist, waist, () => [cx - 4.6, cx + 4.6], LEATHER, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.capsule(8.2, 15.4 + U, 15.4, 21.2 + U, 0.6, 0.6, LEATHER);
    mantle(c, cx, U - 0.4, 5.6);
    // The back of the head under the helm, the beard's braid just showing.
    c.part();
    c.ellipse(cx, 12.2 + U, 3.0, 2.8, SKIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8, 1) });
    if (howl) {
      // His black hair, then the wolf's head and its pelt down his back to the tail.
      c.part();
      c.shape(Math.round(11 + U), Math.round(14 + U), () => [cx - 3, cx + 3], G.beard, (_x, _y, t) => sphere(t * 0.9, 0.2, 1));
      wolfHoodUp(c, cx, U, L, p.sway);
    } else {
      helmDown(c, cx, U);
      c.part();
      c.shape(Math.round(11 + U), Math.round(13 + U), () => [cx - 3, cx + 3], G.beard, (_x, _y, t) => sphere(t * 0.9, 0.2, 1));
      c.shade(cx - 1, 12 + U, -1);
      c.shade(cx + 1, 12 + U, -1);
    }
  } else if (S.style === 'harlequin') {
    harlequinBody(c, cx, U, L, p.tick, true);
    ruff(c, cx, 15.4 + U, 4.3, 1.5);
    // The cap's hood over the back of his head, split like the rest of him.
    c.part();
    for (let y = Math.round(9 + U); y <= Math.round(14.6 + U); y++) {
      for (let x = cx - 4; x <= cx + 4; x++) {
        const dx = (x + 0.5 - cx) / 3.7;
        const dy = (y + 0.5 - 11.6 - U) / 3.3;
        if (dx * dx + dy * dy > 1) continue;
        c.px(x, y, x + 0.5 < cx ? MOTLEY_B : MOTLEY_A, sphere(dx * 0.9, dy * 0.8 - 0.1, 1));
      }
    }
    jesterCap(c, cx, U, p.tick, 'up');
  } else if (S.style === 'vagabond') {
    vagabondUp(c, cx, U, L, p);
  } else if (S.style === 'fadista') {
    fadistaUp(c, cx, U, L, p);
  } else if (S.style === 'skald') {
    skaldUp(c, cx, U, L, p);
  } else if (S.style === 'orpheus') {
    orpheusUp(c, cx, U, L, p);
  } else if (S.wild) {
    wildUp(c, cx, U, L, p);
  } else {
    c.part();
    c.shape(top, Math.round(24.5 + L), (y) => {
      const hw = y <= waist ? 4.5 - 0.5 * ((y + 0.5 - top) / (waist - top)) ** 2 : 4.1 + (y - waist) * 0.55;
      return [cx - hw, cx + hw];
    }, DOUBLET, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
    c.part();
    c.shape(waist, waist, () => [cx - 4.1, cx + 4.1], LEATHER, (_x, _y, t) => cyl(t, 0));
    // The half-cape falls down his back from the left shoulder.
    const hem = 25 + L;
    c.part();
    c.shape(14.5 + U, hem, (y) => {
      const u = (y - 14.5 - U) / (hem - 14.5 - U);
      return [cx - 3.4 + u * (0.6 + p.sway), cx + 5.2 + u * (1 + p.sway)];
    }, WINE, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.3, 1));
    for (let y = 17 + U; y <= hem; y++) {
      const u = (y - 14.5 - U) / (hem - 14.5 - U);
      c.shade(Math.round(cx + 1 + u * p.sway), y, -1);
    }
    for (let x = cx - 3; x <= cx + 6; x++) if (c.filled(x, Math.round(hem))) c.px(x, Math.round(hem), GOLD, sphere(0, 0.4));
    // The back of the head: hair to the shoulders, the cap and its plume.
    c.part();
    c.ellipse(cx, 11.6 + U, 3.9, 3.7, CHESTNUT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    c.part();
    c.shape(Math.round(13 + U), Math.round(15.6 + U), (y) => {
      const hw = 3.4 - (y - 13 - U) * 0.3;
      return [cx - hw, cx + hw];
    }, CHESTNUT, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
    for (let y = 12 + U; y <= 15 + U; y++) c.shade(cx + ((y & 1) === 0 ? -1 : 1), y, -1);
    capDown(c, cx, U, p.tick);
  }

  if (!fb.behind) {
    armB();
    sticks('b');
  }
  if (!fa.behind) {
    armA();
    sticks('a');
  }
  if (S.style === 'taiko') for (const s of [-1, 1]) happiSleeve(c, cx + s * 5.0, 15.6 + U, s);
  if (S.style === 'skald') for (const s of [-1, 1]) bearCap(c, cx + s * 5.0, 15.4 + U, s);
  if (S.wild) wisps(c, U, p.tick);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean; // upper body centre
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);
  const drum = S.drum;
  const top = 15 + U;
  const waist = 22 + U;

  if (S.wild) {
    // The cloak streaming behind him, its hem cut like leaves.
    const hem = 26 + L;
    c.part();
    c.shape(top - 0.5, hem, (y) => {
      const u = (y - top + 0.5) / (hem - top + 0.5);
      return [hx + 0.2 - u * 0.4, hx + 4.2 + u * (1.8 + p.sway)];
    }, MOSS, (_x, _y, t, u) => sphere(t * 0.9 + 0.1, u * 0.5 - 0.2, 1), { bias: -1 });
    for (let y = Math.round(top + 3); y <= hem; y++) {
      const u = (y - top + 0.5) / (hem - top + 0.5);
      c.shade(Math.round(hx + 2.6 + u * (1 + p.sway)), y, -1);
    }
    leafHem(c, hx - 2, hx + 9, hem, -1);
  } else if (S.style === 'fadista') {
    capaSide(c, hx, top, L, p.sway);
  } else if (S.style === 'orpheus') {
    himationSide(c, hx, top, L, p.sway);
  } else if (S.style === 'skald') {
    bearSide(c, hx, top, L, p.sway);
  } else if (!drum && !S.style) {
    // The cape streaming behind him.
    const hem = 25 + L;
    c.part();
    c.shape(top - 0.5, hem, (y) => {
      const u = (y - top + 0.5) / (hem - top + 0.5);
      return [hx + 0.8, hx + 3.8 + u * (1.4 + p.sway)];
    }, WINE, (_x, _y, t, u) => sphere(t * 0.9 + 0.1, u * 0.5 - 0.2, 1), { bias: -1 });
    for (let y = Math.round(top + 1); y <= hem; y++) {
      const u = (y - top + 0.5) / (hem - top + 0.5);
      c.px(Math.round(hx + 3.8 + u * (1.4 + p.sway)) - 1, y, GOLD, sphere(0.5, 0), { bias: -1 });
    }
  }
  // The far arm behind everything, unless it reaches out in front.
  const armA = (bias: number) => (drum ? bareArm : sleevedArm)(c, hx + 1.2, 16.4 + U, fa, REACH_SIDE, [0.3, 1], bias);
  if (fa.behind) {
    armA(-1);
    if (drum) mallet(c, 'side', 'a', fa, p.stickA, p.glow, -1);
  }

  // Legs: the back leg in shade first.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  const harl = S.style === 'harlequin';
  const howl = S.style === 'howl';
  leg(c, cx + 0.8, 24.5 + L, cx + 1 - p.footB, 28.4 - lift(p.footB), -1, harl ? MOTLEY_B : undefined);
  boot(c, cx + 0.4 - p.footB, 29.7 - lift(p.footB), true, -1);
  leg(c, cx - 0.6, 24.5 + L, cx - 0.4 - p.footA, 28.4 - lift(p.footA), 0, harl ? MOTLEY_A : undefined);
  boot(c, cx - 1.2 - p.footA, 29.7 - lift(p.footA), true);

  if (drum && S.style === 'taiko') {
    taikoSide(c, cx, hx, U, L, p);
  } else if (drum) {
    c.part();
    c.shape(waist, 26 + L, (y) => {
      const u = (y - waist) / 4;
      const shift = hx + (cx - hx) * u;
      const hw = 3.4 + (y - waist) * 0.3;
      return [shift - hw, shift + hw + u * p.sway * 0.5];
    }, G.kilt, (_x, _y, t) => sphere(t * 0.9 - 0.1, 0.25, 1));
    for (let y = waist + 1; y <= 26 + L; y++) for (const x of [hx - 2, hx, hx + 2]) c.shade(x, y, -1);
    if (howl) fringe(c, cx - 6, cx + 6, 26 + L);
    c.part();
    c.shape(top, waist - 1, (y) => {
      const u = (y + 0.5 - top) / (waist - top);
      const hw = 3.6 - 0.5 * u * u;
      return [hx - hw - 0.4, hx + hw];
    }, SKIN, (_x, y, t) => sphere(t * 0.9 - 0.1, ((y - top) / (waist - top)) * 0.8 - 0.35, 1));
    if (howl) {
      // Woad claw marks and the teeth on their cord, seen from the side.
      c.part();
      for (const [x, y] of [[hx - 2, top + 3], [hx - 1, top + 4], [hx - 2, top + 5], [hx - 1, top + 6]]) c.px(x, y, G.paint, sphere(0, 0));
      for (let i = 0; i < 4; i++) {
        c.px(hx - 3.6 + i * 0.9, top + 1 + i * 0.3, SINEW, sphere(-0.3, -0.2));
        if (i % 2 === 0) c.px(hx - 3.6 + i * 0.9, top + 2 + i * 0.3, BONE, sphere(-0.3, 0.3), { bias: 1 });
      }
    } else {
      c.part();
      c.shape(top, waist - 1, (y) => {
        const u = (y + 0.5 - top) / (waist - top);
        const hw = 3.6 - 0.5 * u * u;
        return [hx - hw + 1.6, hx + hw];
      }, G.vest, (_x, _y, t) => sphere(t * 0.8 + 0.1, 0, 1));
    }
    c.part();
    c.shape(waist, waist, () => [hx - 3.4, hx + 3.4], LEATHER, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.capsule(hx + 1.6, 15.2 + U, hx - 2.2, 21 + U, 0.6, 0.6, LEATHER);
    mantle(c, hx - 0.4, U, 3.6);
    // The head in profile: helm and horn, war paint, the braid of beard.
    if (!howl) {
      c.part();
      c.capsule(hx + 1.0, 9.6 + U, hx + 2.6, 7.2 + U, 0.95, 0.6, BONE);
      c.part();
      c.capsule(hx + 2.6, 7.2 + U, hx + 2.2, 5.6 + U, 0.6, 0.4, BONE);
    }
    c.part();
    c.ellipse(hx - 1.2, 12.6 + U, 2.5, 2.5, SKIN);
    c.part();
    c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
    c.part();
    c.shape(Math.round(12 + U), Math.round(12 + U), () => [hx - 3.8, hx], G.paint, () => sphere(0, 0, 1));
    eyes(c, [[hx - 3, 12 + U]], p.blink);
    c.part();
    c.shape(Math.round(14 + U), Math.round(15 + U), () => [hx - 3.6, hx + 0.4], G.beard, (_x, _y, t) => sphere(t * 0.8, 0.2, 1));
    c.part();
    c.capsule(hx - 2.4, 15.6 + U, hx - 2.8, 18.4 + U, 1.0, 0.7, G.beard);
    c.px(hx - 3, 18 + U, G.bead, sphere(0, -0.3));
    if (howl) {
      c.px(hx - 3, 13 + U, G.paint, sphere(0, 0, 1));
      wolfHoodSide(c, hx, U, p.sway, p.tick);
    } else {
      c.part();
      c.shape(Math.round(7 + U), Math.round(9 + U), (y) => {
        const u = (y - 7 - U) / 2;
        return [hx - 3 - u * 0.9, hx + 2.4 + u * 0.8];
      }, IRON, (_x, _y, t, u) => sphere(t * 0.9, u * 0.7 - 0.6, 1));
      c.part();
      c.shape(Math.round(10 + U), Math.round(10 + U), () => [hx - 3.9, hx + 3.2], BRONZE, (_x, _y, t) => cyl(t, 0.3));
    }
  } else if (harl) {
    c.part();
    motley(c, top, Math.round(24.5 + L), (y) => {
      const u = y <= waist ? 0 : (y - waist) / 2.5;
      const shift = y <= waist ? hx : hx + (cx - hx) * u;
      const hw = y <= waist ? 3.2 - 0.4 * ((y + 0.5 - top) / (waist - top)) ** 2 : 2.9 + (y - waist) * 0.5;
      return [shift - hw - 0.2, shift + hw + 0.2];
    }, MOTLEY_A, MOTLEY_B, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
    dags(c, cx - 6, cx + 6, Math.round(24.5 + L), p.tick);
    c.part();
    c.shape(waist, waist, () => [hx - 3.1, hx + 3.1], MOTLEY_B, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.px(Math.round(hx - 3.1), waist, GOLD, sphere(-0.5, -0.3));
    ruff(c, hx - 0.4, 15.3 + U, 3.2, 1.4);
    // The mask in profile: a white face, a dark eye with its rose diamond, a red mouth.
    c.part();
    c.ellipse(hx - 1.2, 12.3 + U, 2.6, 2.6, MOTLEY_B, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
    c.part();
    c.ellipse(hx - 1.6, 12.9 + U, 2.1, 2.3, MASK);
    c.part();
    c.px(hx - 4, 12.6 + U, MASK, sphere(-0.7, -0.1), { bias: 1 });
    c.px(hx - 3, 11 + U, MOTLEY_A, sphere(-0.3, -0.3));
    c.px(hx - 3, 13 + U, MOTLEY_A, sphere(-0.3, 0.2));
    c.px(hx - 3, 14 + U, LIP, sphere(-0.3, 0.3));
    c.px(hx - 3, 12 + U, p.blink ? MASK : EYE, sphere(0, -0.3), { bias: p.blink ? -1 : 0 });
    jesterCap(c, hx, U, p.tick, 'side');
  } else if (S.style === 'vagabond') {
    vagabondSide(c, cx, hx, U, L, p);
  } else if (S.style === 'fadista') {
    fadistaSide(c, cx, hx, U, L, p);
  } else if (S.style === 'skald') {
    skaldSide(c, cx, hx, U, L, p);
  } else if (S.style === 'orpheus') {
    orpheusSide(c, cx, hx, U, L, p);
  } else if (S.wild) {
    wildSide(c, cx, hx, U, L, p);
  } else {
    c.part();
    c.shape(top, Math.round(24.5 + L), (y) => {
      const u = y <= waist ? 0 : (y - waist) / 2.5;
      const shift = y <= waist ? hx : hx + (cx - hx) * u;
      const hw = y <= waist ? 3.2 - 0.4 * ((y + 0.5 - top) / (waist - top)) ** 2 : 2.9 + (y - waist) * 0.5;
      return [shift - hw - 0.2, shift + hw + 0.2];
    }, DOUBLET, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
    c.part();
    for (const y of [top + 2, top + 4, top + 6]) c.px(Math.round(hx - 3.2), y, GOLD, sphere(-0.5, -0.3));
    c.part();
    c.shape(waist, waist, () => [hx - 3.1, hx + 3.1], LEATHER, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.ellipse(hx - 0.6, 15.3 + U, 2.0, 1.0, SHIRT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.5 - 0.4, 1) });
    // Head: hair behind, face turned left, the cap and its plume streaming back.
    c.part();
    c.ellipse(hx + 0.6, 11.8 + U, 3.4, 3.6, CHESTNUT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
    c.part();
    c.capsule(hx + 1.8, 12.5 + U, hx + 2.4 + p.sway * 0.3, 15.8 + U, 1.5, 1.0, CHESTNUT);
    c.part();
    c.ellipse(hx - 1.4, 12.9 + U, 2.2, 2.3, SKIN);
    c.part();
    c.px(hx - 4, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
    c.shade(hx - 3, 14 + U, -1);
    c.part();
    c.shape(Math.round(10 + U), Math.round(10 + U), () => [hx - 3.4, hx + 0.6], CHESTNUT, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
    eyes(c, [[hx - 3, 12 + U]], p.blink);
    c.part();
    c.ellipse(hx - 0.2, 9.8 + U, 5.0, 1.5, WINE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.4 - 0.7, 1) });
    c.part();
    c.ellipse(hx + 0.4, 7.9 + U, 2.9, 2.0, WINE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    c.part();
    c.shape(Math.round(9 + U), Math.round(9 + U), () => [hx - 2.4, hx + 3.2], GOLD, (_x, _y, t) => cyl(t, 0.2));
    plume(c, hx + 2.4, 8.2 + U, 1, p.tick);
  }

  if (drum) drawDrum(c, hx - 3.6, 21 + U, 3.4, p.glow);
  else drawLute(c, 'side', p, fa, fb);
  if (S.style === 'howl') feathers(c, hx - 7.2, 22 + U, p.tick);
  if (!fa.behind) {
    armA(0);
    if (drum) mallet(c, 'side', 'a', fa, p.stickA, p.glow);
  }
  // The near arm last.
  if (drum) bareArm(c, hx + 0.2, 16.7 + U, fb, REACH_SIDE, [0.4, 1], 0);
  else sleevedArm(c, hx + 0.2, 16.7 + U, fb, REACH_SIDE, [0.4, 1], 0, S.style === 'harlequin');
  if (drum) mallet(c, 'side', 'b', fb, p.stickB, p.glow);
  if (S.style === 'taiko') happiSleeve(c, hx + 0.4, 16.4 + U, -1);
  if (S.style === 'skald') bearCap(c, hx + 0.6, 16.0 + U, -1);
  if (S.wild) wisps(c, U, p.tick);
}

/** The wildsong in profile, facing left: tunic and vine belt, the cloak on his shoulder, the hood's tail streaming back. */
function wildSide(c: PixelCanvas, cx: number, hx: number, U: number, L: number, p: Pose): void {
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, Math.round(24.5 + L), (y) => {
    const u = y <= waist ? 0 : (y - waist) / 2.5;
    const shift = y <= waist ? hx : hx + (cx - hx) * u;
    const hw = y <= waist ? 3.2 - 0.4 * ((y + 0.5 - top) / (waist - top)) ** 2 : 2.9 + (y - waist) * 0.5;
    return [shift - hw - 0.2, shift + hw + 0.2];
  }, BARK, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
  c.part();
  c.shape(waist, waist, () => [hx - 3.1, hx + 3.1], LEAF, (_x, _y, t) => cyl(t, 0));
  c.spark(hx - 3, waist, S.light[1], 0.6 + p.glow * 0.4);
  chimes(c, [hx, hx + 1], waist + 1, p.tick);
  // The cloak over his shoulder.
  c.part();
  c.ellipse(hx + 0.6, 16.2 + U, 3.4, 1.8, MOSS, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + 0.1, dy * 0.6 - 0.4, 1) });
  // The hood: its tail streaming back, its fall on the shoulder, the far twig behind.
  twig(c, hx + 1.8, 8.2 + U, 1, -1);
  c.part();
  c.capsule(hx + 2.6, 9.4 + U, hx + 5.4 + p.sway * 0.4, 12.2 + U, 1.4, 0.6, MOSS);
  c.part();
  c.px(hx + 6 + p.sway * 0.4, 12.8 + U, LEAF, sphere(0.4, 0.3));
  c.part();
  c.capsule(hx + 1.6, 12.5 + U, hx + 2.2 + p.sway * 0.3, 15.8 + U, 1.5, 1.0, MOSS);
  hoodCrown(c, hx + 0.2, U, 0.2);
  twig(c, hx - 0.6, 8.4 + U, -1);
  // The opening at the front, trimmed in leaves, dark within but for one eye.
  c.part();
  c.ellipse(hx - 2.3, 12.7 + U, 1.9, 2.5, LEAF, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6 - 0.3, dy * 0.6 - 0.3, 1) });
  c.part();
  c.ellipse(hx - 2.6, 13.0 + U, 1.4, 2.0, HOOD_DARK);
  hoodEyes(c, [[hx - 3, 12 + U]], p.blink);
}

// ---------------------------------------------------------------------------
// Animations

/** The minstrel's lute held ready: the belly at his right hip, the neck across his chest. */
const LUTE_A = H(1.5, 3.0, -3.5);
const LUTE_B = H(2.5, 3.2, 2.0);
/** The drummer's mallets hanging at his sides. */
const DRUM_A = H(0.6, 4.8, -3.5);
/** Side-view hands: the lute held out ahead, or the mallets low at his front. */
const side = (h: Hand, arm: 'a' | 'b'): Hand => (S.drum ? H(h.f + 1.4, 0, h.h) : H(arm === 'a' ? h.f + 1 : h.f + 4.5, 0, h.h - (arm === 'b' ? 2 : 0)));

const base = (view: View): Pose => {
  const a = S.drum ? DRUM_A : LUTE_A;
  const b = S.drum ? DRUM_A : LUTE_B;
  return {
    lift: 0,
    breath: 0,
    footA: view === 'side' ? 1 : 0,
    footB: view === 'side' ? -1 : 0,
    lean: 0,
    a: view === 'side' ? side(a, 'a') : { ...a },
    b: view === 'side' ? side(b, 'b') : { ...b },
    stickA: 0.2,
    stickB: 0.2,
    glow: 0,
    sway: 0,
    tick: 0,
  };
};

/** Standing easy: the minstrel idly picks a string or two; the drummer rolls his shoulders. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.sway = Math.sin(ph - 1) * 0.6;
    p.tick = f;
    p.blink = f === 4;
    if (S.drum) {
      p.a.h += Math.sin(ph) * 0.4;
      p.b.h += Math.sin(ph + 1) * 0.4;
      p.stickA = 0.2 + Math.sin(ph) * 0.06;
      p.stickB = 0.2 + Math.sin(ph + 1) * 0.06;
    } else {
      p.a.h += f === 1 || f === 2 ? 0.8 : 0;
      p.glow = f === 2 ? 0.3 : 0;
    }
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
    if (view === 'side') {
      p.footA = Math.round(s * 2.2);
      p.footB = -p.footA;
      p.lean = 1;
      p.sway = 1 + Math.abs(s) * 0.9;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.8;
    }
    if (S.drum) {
      // The mallets swing with his stride.
      p.a.f += s * 1.4;
      p.b.f -= s * 1.4;
      p.a.h += p.lift * 0.4;
      p.b.h += p.lift * 0.4;
    } else {
      // The lute rides steady; he bobs with it.
      p.a.h += p.lift * 0.4;
      p.b.h += p.lift * 0.4;
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
  stickA?: number;
  stickB?: number;
  glow?: number;
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
      p.a = view === 'side' ? { ...(k.aSide ?? side(k.a, 'a')) } : { ...k.a };
      p.b = view === 'side' ? { ...(k.bSide ?? side(k.b, 'b')) } : { ...k.b };
      p.stickA = k.stickA ?? 0.2;
      p.stickB = k.stickB ?? 0.2;
      p.glow = k.glow ?? 0;
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

/** The strum: the hand lifted over the strings, then swept down across them in a flash of light. */
const strum = action([
  { a: H(1.8, 2.8, -2.0), b: LUTE_B, glow: 0.2 },
  { a: H(1.5, 3.0, -2.8), b: H(2.5, 3.1, 2.4), glow: 0.5, lean: -1 },
  { a: H(1.1, 3.3, -4.6), b: H(2.5, 3.1, 2.6), glow: 1, lean: 1, step: 1 },
  { a: H(1.2, 3.2, -4.4), b: H(2.5, 3.1, 2.4), glow: 0.5, lean: 1, step: 1 },
  { a: LUTE_A, b: LUTE_B, glow: 0.15 },
]);

/** The song: the lute raised, strummed on the beat with a little hop, light pouring off it. */
const song = action([
  { a: H(1.5, 3.0, -2.8), b: H(2.5, 3.2, 3.5), glow: 0.3 },
  { a: H(1.3, 3.2, -4.4), b: H(2.4, 3.0, 4.6), glow: 0.7, lift: 1 },
  { a: H(1.6, 3.0, -2.2), b: H(2.4, 2.9, 5.6), glow: 0.8, lift: 1, lean: -1 },
  { a: H(1.1, 3.3, -4.6), b: H(2.4, 2.8, 6.2), glow: 1, step: 1, lean: 1 },
  { a: H(1.6, 3.0, -2.2), b: H(2.4, 2.8, 6.2), glow: 1, lift: 1 },
  { a: H(1.1, 3.3, -4.6), b: H(2.4, 2.9, 5.6), glow: 0.9, step: 1 },
  { a: H(1.5, 3.0, -3.0), b: H(2.5, 3.1, 4.0), glow: 0.5 },
  { a: LUTE_A, b: LUTE_B, glow: 0.2 },
]);

/** Mallet poses: over the drum's head (struck), cocked back, and raised high. */
const HIT = H(2, 2.5, 1.9);
const COCK = H(0.8, 3.8, 5.0);
const HIGH = H(0.4, 4.0, 8.0);
/** From the side: over the drum out in front, and raised. */
const HIT_SIDE = H(3.2, 0, 1.2);
const COCK_SIDE = H(1.6, 0, 5.4);
const HIGH_SIDE = H(1.0, 0, 8.2);

/** One mallet cocked and brought down on the drum; the other waits low. */
const beatWith = (arm: 'a' | 'b') => {
  const k = (hit: Hand, hitSide: Hand, stick: number, rest: Hand, restSide: Hand, other = 0.35, extra: Partial<Key> = {}): Key => {
    const key: Key = arm === 'a'
      ? { a: hit, b: rest, aSide: hitSide, bSide: restSide, stickA: stick, stickB: other }
      : { a: rest, b: hit, aSide: restSide, bSide: hitSide, stickA: other, stickB: stick };
    return { ...key, ...extra };
  };
  const REST = H(1.8, 3.4, -0.8);
  const REST_SIDE = H(2.4, 0, -0.6);
  return action([
    k(COCK, COCK_SIDE, 0.8, REST, REST_SIDE, 0.3, { lean: -1 }),
    k(HIGH, HIGH_SIDE, 1, REST, REST_SIDE, 0.3, { lean: -1, glow: 0.1 }),
    k(HIT, HIT_SIDE, 0, REST, REST_SIDE, 0.3, { glow: 1, lean: 1, step: 1, breath: 1 }),
    k(H(1.8, 2.6, 2.6), H(3, 0, 1.8), 0.1, REST, REST_SIDE, 0.3, { glow: 0.4, lean: 1, step: 1 }),
    k(REST, REST_SIDE, 0.25, REST, REST_SIDE, 0.25, { glow: 0.1 }),
  ]);
};
const beat = beatWith('a');
const beat2 = beatWith('b');

/** The boom: both mallets raised high over his head, then brought down together with all his weight. */
const boom = action([
  { a: COCK, b: COCK, aSide: COCK_SIDE, bSide: COCK_SIDE, stickA: 0.8, stickB: 0.8, lean: -1 },
  { a: HIGH, b: HIGH, aSide: HIGH_SIDE, bSide: HIGH_SIDE, stickA: 1, stickB: 1, lean: -1, lift: 1 },
  { a: H(0.3, 3.8, 8.6), b: H(0.3, 3.8, 8.6), aSide: H(0.8, 0, 8.8), bSide: H(0.8, 0, 8.8), stickA: 1, stickB: 1, lean: -1, lift: 1, glow: 0.3 },
  { a: HIT, b: HIT, aSide: HIT_SIDE, bSide: HIT_SIDE, stickA: 0, stickB: 0, glow: 1, lean: 1, step: 1, breath: 1 },
  { a: H(1.9, 2.6, 2.4), b: H(1.9, 2.6, 2.4), aSide: H(3, 0, 1.6), bSide: H(3, 0, 1.6), stickA: 0.08, stickB: 0.08, glow: 0.6, lean: 1, step: 1, breath: 1 },
  { a: DRUM_A, b: DRUM_A, stickA: 0.2, stickB: 0.2, glow: 0.15 },
]);

/** The drum roll: quick alternating strokes that build, both mallets raised, and a last great beat. */
const roll = action([
  { a: HIT, b: COCK, aSide: HIT_SIDE, bSide: COCK_SIDE, stickA: 0, stickB: 0.7, glow: 0.5 },
  { a: COCK, b: HIT, aSide: COCK_SIDE, bSide: HIT_SIDE, stickA: 0.7, stickB: 0, glow: 0.6 },
  { a: HIT, b: COCK, aSide: HIT_SIDE, bSide: COCK_SIDE, stickA: 0, stickB: 0.7, glow: 0.7, lift: 1 },
  { a: COCK, b: HIT, aSide: COCK_SIDE, bSide: HIT_SIDE, stickA: 0.7, stickB: 0, glow: 0.8 },
  { a: HIT, b: COCK, aSide: HIT_SIDE, bSide: COCK_SIDE, stickA: 0, stickB: 0.7, glow: 0.9, lift: 1 },
  { a: COCK, b: HIT, aSide: COCK_SIDE, bSide: HIT_SIDE, stickA: 0.7, stickB: 0, glow: 1 },
  { a: HIGH, b: HIGH, aSide: HIGH_SIDE, bSide: HIGH_SIDE, stickA: 1, stickB: 1, lean: -1, lift: 1, glow: 0.4 },
  { a: HIT, b: HIT, aSide: HIT_SIDE, bSide: HIT_SIDE, stickA: 0, stickB: 0, glow: 1, lean: 1, step: 1, breath: 1 },
  { a: DRUM_A, b: DRUM_A, stickA: 0.2, stickB: 0.2, glow: 0.3 },
]);

/**
 * The idle moment's tick: 0 on the stand frames, and otherwise climbing from
 * 1 so the frame before the last lands on 5, one short of the idle's own
 * 0 (the wisps, bells and plume run on into the idle without a jump).
 */
const restTick = (i: number, n: number): number => (i === 0 || i === n - 1 ? 0 : 1 + Math.round(((i - 1) * 16) / Math.max(1, n - 3)));

/** The frame the idle moment starts and ends on: the idle's first, exactly. */
const restStand = (): Pose => idle('down')[0];

/** Strums in the minstrel's little tune, and the frames each one takes (down, then up). */
const TUNE = 8;
/** The minstrel's head bobbing through the tune, one step per strum: over to one side for a bar, then the other. */
const BOB_X = [0, 1, 1, 0, 0, -1, -1, 0];
/** Strums that send a note floating up, and which way it drifts. */
const NOTE_ON: Record<number, number> = { 0: -1, 2: 1, 4: -1, 6: 1, 7: -1 };
/** How long a note floats, in frames, and how fast it rises. */
const NOTE_LIFE = 7;
const NOTE_RISE = 1.6;

/**
 * The minstrel's idle moment: he draws a breath and strums a little tune,
 * eight strokes over two bars, head bobbing side to side and a toe tapping
 * on the off-beat; in the second bar his eyes fall shut. Notes of light
 * float up off the strings. He ends with a flourish, the neck swung up and a
 * little hop, then settles back.
 */
function minstrelRest(view: View): Pose[] {
  if (view !== 'down') return [];
  const frames: Pose[] = [restStand()];
  const at = (f: Partial<Pose>): void => {
    frames.push({ ...restStand(), ...f });
  };
  // Anticipation: a breath in, the hand lifted over the strings, the neck raised.
  at({ breath: 1, a: H(1.8, 2.8, -2.0), b: H(2.5, 3.1, 2.8), glow: 0.1 });
  const chord = [2.4, 2.4, 3.4, 3.4, 2.6, 2.6, 3.8, 3.2];
  for (let k = 0; k < TUNE; k++) {
    const accent = k === 0 || k === 4 || k === 7;
    const b = H(2.5, 3.1 - (chord[k] - 2.4) * 0.15, chord[k]);
    const closed = k >= 4;
    // Down: the stroke lands, his head and shoulders dip with it.
    at({ a: H(1.1, 3.3, -4.6), b, glow: accent ? 1 : 0.75, breath: 1, head: [BOB_X[k], 1], blink: closed });
    // Up: the hand comes back over the strings, a toe taps.
    at({ a: H(1.6, 3.0, -2.6), b, glow: 0.25, head: [BOB_X[k], 0], footA: 1, blink: closed });
  }
  // The flourish: the neck swung high, a hop, then the landing.
  at({ a: H(1.1, 3.3, -4.4), b: H(2.4, 2.8, 6.2), glow: 1, lift: 1, head: [0, -1], blink: true });
  at({ a: H(1.3, 3.2, -4.0), b: H(2.4, 2.9, 5.2), glow: 0.5, breath: 1, head: [0, 0] });
  at({ a: H(1.5, 3.0, -3.5), b: H(2.5, 3.2, 3.0), glow: 0.15 });
  frames.push(restStand());

  const n = frames.length;
  return frames.map((p, i) => {
    p.tick = restTick(i, n);
    // The notes: each born on its strum at the strings, rising and drifting, fading as it goes.
    const notes: Note[] = [];
    for (const [ks, side] of Object.entries(NOTE_ON)) {
      const born = 2 + Number(ks) * 2;
      const age = i - born;
      if (age < 0 || age >= NOTE_LIFE || i >= n - 1) continue;
      notes.push({
        // Off to either side of him, clear of his silhouette, so they read.
        x: (side < 0 ? 2 : 18) + side * age * 0.6 + Math.sin(age * 1.3) * 0.7,
        y: 21 - age * NOTE_RISE,
        k: age === 0 ? 0.75 : 1 - (age - 1) / NOTE_LIFE,
        two: Number(ks) === 4,
      });
    }
    // The flourish throws a beamed pair up off the lute.
    const fl = n - 4;
    if (i >= fl && i < n - 1) notes.push({ x: 18 + (i - fl) * 0.8, y: 12 - (i - fl) * 2.6, k: 1 - (i - fl) * 0.3, two: true });
    if (notes.length) p.notes = notes;
    return p;
  });
}

/** The drummer's mallets held low and ready over the drum. */
const LOW = H(1.6, 3.2, 3.6);

/**
 * The war drummer's idle moment: he rolls his shoulders, cocks the mallets
 * and plays a drum roll that builds, stroke on stroke, the head glowing
 * hotter; then both mallets go up high, a held breath, and come down
 * together on one great beat, eyes squeezed shut, rings of light rolling out
 * across the ground and two notes leaping off the drum. A satisfied beat,
 * and the mallets drop back to his sides.
 */
function drummerRest(view: View): Pose[] {
  if (view !== 'down') return [];
  const frames: Pose[] = [restStand()];
  const at = (f: Partial<Pose>): void => {
    frames.push({ ...restStand(), ...f });
  };
  at({ breath: 1, a: H(1.8, 3.4, -0.8), b: H(1.8, 3.4, -0.8), stickA: 0.3, stickB: 0.3 });
  at({ a: LOW, b: LOW, stickA: 0.85, stickB: 0.85 });
  // The roll: alternating strokes, building.
  for (let j = 0; j < 8; j++) {
    const left = (j & 1) === 0;
    const g = 0.35 + j * 0.07;
    at({
      a: left ? HIT : LOW,
      b: left ? LOW : HIT,
      stickA: left ? 0 : 0.85,
      stickB: left ? 0.85 : 0,
      glow: g,
      head: [0, j >= 4 && left ? 1 : 0],
      rings: j >= 3 ? [5.2] : undefined,
      ringK: 0.25 + j * 0.04,
    });
  }
  // Both up high, a held breath.
  at({ a: HIGH, b: HIGH, stickA: 1, stickB: 1, lift: 1, glow: 0.2 });
  at({ a: H(0.3, 3.8, 8.6), b: H(0.3, 3.8, 8.6), stickA: 1, stickB: 1, lift: 1, glow: 0.1, head: [0, -1] });
  // BOOM.
  at({ a: HIT, b: HIT, stickA: 0, stickB: 0, glow: 1, breath: 1, blink: true, head: [0, 1], rings: [5.6], ringK: 1 });
  at({ a: H(1.9, 2.6, 2.4), b: H(1.9, 2.6, 2.4), stickA: 0.08, stickB: 0.08, glow: 0.6, breath: 1, rings: [8.6, 5.6], ringK: 0.8 });
  // The mallets bounce off the head; he savours it.
  at({ a: H(1.8, 3.2, 0.2), b: H(1.8, 3.2, 0.2), stickA: 0.35, stickB: 0.35, glow: 0.3, rings: [11.6, 8.6], ringK: 0.5 });
  at({ a: H(1.2, 4.2, -2.4), b: H(1.2, 4.2, -2.2), stickA: 0.25, stickB: 0.25, glow: 0.1, rings: [11.6], ringK: 0.22 });
  frames.push(restStand());

  const n = frames.length;
  const boom = n - 5;
  return frames.map((p, i) => {
    p.tick = restTick(i, n);
    // Two notes leap off the drum's rim on the beat, one to each side.
    const age = i - boom;
    if (age >= 0 && i < n - 1) {
      const k = 1 - age * 0.28;
      p.notes = [
        { x: 5 - age * 1.1, y: 20 - age * 3.4, k },
        { x: 16 + age * 1.1, y: 19 - age * 3.4, k, two: age >= 1 },
      ];
    }
    return p;
  });
}

/** Slots of each idle moment in playing order, holds and repeats included. */
const MINSTREL_REST_ORDER = [0, 1, 1, ...Array.from({ length: TUNE * 2 }, (_, i) => 2 + i), 18, 18, 19, 19, 20, 21];
const DRUMMER_REST_ORDER = [0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 15, 15, 16, 16, 17];

// ---------------------------------------------------------------------------
// Frame generation

export type BardAnim = 'idle' | 'walk' | 'strum' | 'song' | 'beat' | 'beat2' | 'boom' | 'roll' | 'rest';

export interface BardAnimDef {
  name: BardAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Only drawn for the drummer (true) or the minstrel (false); both when left out. */
  drum?: boolean;
  /** Frame indices to play, in order, when some are held or repeated. */
  order?: readonly number[];
}

export const BARD_ANIMS: BardAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 9, loop: true, poses: walk },
  { name: 'strum', fps: 15, loop: false, poses: strum, drum: false },
  { name: 'song', fps: 10, loop: false, poses: song, drum: false },
  { name: 'beat', fps: 16, loop: false, poses: beat, drum: true },
  { name: 'beat2', fps: 16, loop: false, poses: beat2, drum: true },
  { name: 'boom', fps: 13, loop: false, poses: boom, drum: true },
  { name: 'roll', fps: 14, loop: false, poses: roll, drum: true },
  { name: 'rest', fps: 8, loop: false, poses: minstrelRest, drum: false, order: MINSTREL_REST_ORDER },
  { name: 'rest', fps: 10, loop: false, poses: drummerRest, drum: true, order: DRUMMER_REST_ORDER },
];

/** The anims a look has. */
export const bardAnims = (look: BardLook): BardAnimDef[] => BARD_ANIMS.filter((a) => a.drum === undefined || a.drum === look.drum);

/** Frame index at which each action lands. */
export const BARD_RELEASE = { strum: 2, song: 3, beat: 2, beat2: 2, boom: 3, roll: 7 } as const;

export interface BardFrame {
  key: string; // e.g. "walk_left_3"
  anim: BardAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawBardFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(BARD_W, BARD_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildBardFrames(look: BardLook = MINSTREL_LOOK): BardFrame[] {
  S = look;
  D = look.dress;
  G = look.gear ?? WARBAND;
  const out: BardFrame[] = [];
  for (const a of bardAnims(look)) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawBardFrame(dir, pose) });
      });
    }
  }
  S = MINSTREL_LOOK;
  D = TROUBADOUR;
  G = WARBAND;
  return out;
}

// ---------------------------------------------------------------------------
// Notes: the minstrel's music in flight (11x11, light only)

export const NOTE_SIZE = 11;
export const NOTE_FRAMES = 2;

/** A glowing note: 0 is a single flagged eighth note, 1 two notes beamed together. */
export function noteFrame(i: number, look: BardLook = MINSTREL_LOOK): PixelCanvas {
  const c = new PixelCanvas(NOTE_SIZE, NOTE_SIZE);
  const [core, hot, mid, deep] = look.light;
  const lit = (x: number, y: number, col: RGB, a = 1) => c.spark(x, y, col, a);
  const head = (cx: number, cy: number) => {
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        const d = Math.hypot((x + 0.3) / 1.9, (y - 0.2) / 1.45);
        if (d > 1.15) continue;
        lit(cx + x, cy + y, d < 0.55 ? core : d < 0.9 ? hot : mid, d < 0.9 ? 1 : 0.8);
      }
    }
  };
  const stem = (x: number, y0: number, y1: number) => {
    for (let y = y0; y <= y1; y++) {
      lit(x, y, hot);
      lit(x + 1, y, deep, 0.5);
    }
  };
  if (look.style === 'harlequin') {
    if (i === 0) {
      // A note with a diamond for a head and a pennant for a flag.
      for (let y = -2; y <= 2; y++) {
        for (let x = -3; x <= 3; x++) {
          const d = Math.abs(x) / 3.2 + Math.abs(y) / 2.3;
          if (d > 1) continue;
          lit(4 + x, 8 + y, d < 0.4 ? core : d < 0.75 ? hot : mid, d < 0.75 ? 1 : 0.85);
        }
      }
      stem(6, 1, 7);
      for (const [x, y, col] of [[7, 1, core], [8, 1, hot], [9, 1, mid], [7, 2, hot], [8, 2, mid], [7, 3, mid], [8, 3, deep]] as const) lit(x, y, col);
    } else {
      // A spinning diamond of the motley, lit down one half and dim down the other, with a glint.
      for (let y = 0; y < NOTE_SIZE; y++) {
        for (let x = 0; x < NOTE_SIZE; x++) {
          const dx = x - 5;
          const dy = y - 5;
          const d = Math.abs(dx) / 3.2 + Math.abs(dy) / 4.8;
          if (d > 1) continue;
          const bright = dx < 0 === dy < 0;
          lit(x, y, d > 0.8 ? deep : bright ? (d < 0.45 ? core : hot) : mid, d > 0.8 ? 0.8 : 1);
        }
      }
      for (const [x, y] of [[9, 1], [10, 1], [9, 0], [9, 2], [8, 1]]) lit(x, y, core, x === 9 && y === 1 ? 1 : 0.6);
    }
    return c;
  }
  if (look.style === 'vagabond') {
    if (i === 0) {
      // A note with a hawk's feather for its flag.
      head(4, 8);
      stem(5, 1, 7);
      for (const [x, y, col] of [[6, 1, core], [7, 1, hot], [6, 2, hot], [7, 2, core], [8, 2, mid], [7, 3, hot], [8, 3, mid], [9, 3, deep], [8, 4, mid], [9, 5, deep]] as const) lit(x, y, col);
    } else {
      // A dandelion seed adrift: a crown of fine threads over a stalk and the seed.
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * (1.05 + (k / 8) * 0.9);
        for (let r = 1; r <= 3; r++) lit(5 + Math.cos(a) * r, 4 + Math.sin(a) * r, r === 3 ? core : r === 2 ? hot : mid, r === 3 ? 0.9 : 0.7);
      }
      lit(5, 4, core);
      for (let y = 5; y <= 8; y++) lit(5, y, y < 7 ? hot : mid, 0.85);
      lit(5, 9, deep);
      lit(5, 10, deep, 0.7);
    }
    return c;
  }
  if (look.style === 'fadista') {
    if (i === 0) {
      // A swallow, flying right: swept wings, a forked tail, a white breast.
      for (const [x, y, col] of [
        [9, 4, hot], [10, 4, mid], [8, 4, hot], [8, 5, core], [9, 5, core], [10, 5, hot],
        [4, 5, mid], [5, 5, hot], [6, 5, hot], [7, 5, hot], [5, 6, core], [6, 6, core], [7, 6, core],
        [3, 5, mid], [2, 4, mid], [1, 3, deep], [0, 2, deep], [3, 6, mid], [2, 7, mid], [1, 8, deep],
        [6, 4, mid], [5, 3, mid], [4, 2, deep], [3, 1, deep], [6, 7, mid], [5, 8, deep], [4, 9, deep],
      ] as const) lit(x, y, col);
    } else {
      // An azulejo: a square tile, a four-petalled flower at its heart.
      for (let y = 2; y <= 8; y++) {
        for (let x = 2; x <= 8; x++) {
          const edge = x === 2 || x === 8 || y === 2 || y === 8;
          const petal = (x === 5 && Math.abs(y - 5) <= 2) || (y === 5 && Math.abs(x - 5) <= 2);
          const corner = (x === 3 || x === 7) && (y === 3 || y === 7);
          lit(x, y, x === 5 && y === 5 ? core : petal ? hot : edge ? mid : corner ? hot : deep, edge || petal || corner ? 1 : 0.45);
        }
      }
    }
    return c;
  }
  if (look.style === 'skald') {
    // Runes cut in light: Fehu (wealth, the song's reward) and Sowilo (the sun). Each stroke pale gold at its heart,
    // a glow of ice blue round it.
    const strokes: [number, number, number, number][] =
      i === 0
        ? [[4, 1, 4, 9], [4, 2, 7, 0], [4, 5, 7, 3]]
        : [[7, 1, 3, 4], [3, 4, 7, 6], [7, 6, 3, 9]];
    const core0 = new Set<string>();
    for (const [x0, y0, x1, y1] of strokes) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let s = 0; s <= n; s++) core0.add(`${Math.round(x0 + ((x1 - x0) * s) / n)},${Math.round(y0 + ((y1 - y0) * s) / n)}`);
    }
    for (const key of core0) {
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!core0.has(`${x + dx},${y + dy}`)) lit(x + dx, y + dy, mid, 0.55);
    }
    for (const key of core0) {
      const [x, y] = key.split(',').map(Number);
      lit(x, y, (x + y) % 3 === 0 ? core : hot);
    }
    lit(9, 9, deep, 0.6);
    lit(1, 1, deep, 0.5);
    return c;
  }
  if (look.style === 'orpheus') {
    if (i === 0) {
      // A golden note whose flag is a sprig of laurel.
      head(4, 8);
      stem(5, 1, 7);
      for (const [x, y, col] of [[6, 1, core], [7, 2, hot], [8, 3, mid], [7, 1, hot], [8, 2, mid], [6, 3, hot], [7, 4, mid], [9, 4, deep]] as const) lit(x, y, col);
    } else {
      // A little lyre: two horned arms, a yoke, three strings, the bowl.
      for (const [x, y] of [[2, 1], [2, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7], [8, 1], [8, 2], [7, 3], [7, 4], [7, 5], [7, 6], [7, 7]]) lit(x, y, y < 3 ? core : hot);
      for (let x = 3; x <= 7; x++) lit(x, 3, core);
      for (const x of [4, 5, 6]) for (let y = 4; y <= 7; y++) lit(x, y, mid, 0.7);
      for (let x = 3; x <= 7; x++) lit(x, 8, hot);
      for (let x = 4; x <= 6; x++) lit(x, 9, deep);
    }
    return c;
  }
  if (look.wild) {
    if (i === 0) {
      // A note whose flag is a leaf.
      head(4, 8);
      stem(5, 1, 7);
      for (const [x, y, col] of [[6, 1, hot], [7, 1, mid], [6, 2, core], [7, 2, hot], [8, 2, mid], [7, 3, core], [8, 3, hot], [9, 3, mid], [8, 4, mid], [9, 4, deep]] as const) lit(x, y, col);
    } else {
      // A wisp: a round little spirit with two dark eyes, a sprout on its head and a curl of a tail.
      for (let y = 2; y <= 8; y++) {
        for (let x = 2; x <= 9; x++) {
          const d = Math.hypot((x + 0.5 - 6) / 2.7, (y + 0.5 - 5.5) / 2.4);
          if (d > 1.1 || ((x === 5 || x === 7) && y === 5)) continue;
          lit(x, y, d < 0.5 ? core : d < 0.85 ? hot : mid, d < 0.85 ? 1 : 0.8);
        }
      }
      for (const [x, y, col] of [[6, 2, hot], [7, 1, mid], [8, 0, mid], [3, 8, mid], [2, 9, mid], [2, 10, deep], [3, 10, deep]] as const) lit(x, y, col);
    }
    return c;
  }
  if (i === 0) {
    head(4, 8);
    stem(5, 1, 7);
    // The flag curling down from the stem's top.
    for (const [x, y, col] of [[6, 1, hot], [7, 2, hot], [8, 3, mid], [8, 4, mid], [7, 5, deep]] as const) lit(x, y, col);
  } else {
    head(2, 8);
    head(7, 7);
    stem(3, 2, 7);
    stem(8, 1, 6);
    // The beam joining them.
    for (let x = 3; x <= 8; x++) {
      const y = Math.round(2 - (x - 3) * 0.2);
      lit(x, y, core);
      lit(x, y + 1, hot, 0.9);
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// Ability icons (16x16)

/** The lute: a honey-wood belly with its dark rosette, the neck running up to a bent pegbox (the wildsong's grown of pale wood, budding leaves). */
export function luteIcon(style: 'wild' | 'harlequin' | false = false): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const wild = style === 'wild';
  const harl = style === 'harlequin';
  const neck = wild ? ['#382c1a', '#4e4026'] : harl ? ['#d8ccc0', '#f4ece4'] : ['#4a2418', '#663424'];
  const belly = wild ? ['#ecdc9e', '#c8ac6c', '#8a6e3c'] : harl ? ['#4a3c50', '#2a2030', '#160e1a'] : ['#f0c474', '#cc9244', '#9c5e26'];
  const peg = wild ? '#6aac44' : '#f4cf6a';
  // Neck from the belly up to the top right.
  for (let i = 0; i < 7; i++) {
    put(8 + i, 7 - i, neck[0]);
    put(9 + i, 7 - i, neck[1]);
  }
  put(14, 0, '#2e1610');
  put(15, 1, '#2e1610');
  put(13, 0, peg);
  put(15, 2, peg);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 6, y + 0.5 - 10);
      const d2 = Math.hypot(x + 0.5 - 8.2, y + 0.5 - 7.8);
      if (d <= 4.6 || d2 <= 2.9) put(x, y, d < 2.6 ? belly[0] : x + y < 15 ? belly[1] : belly[2]);
    }
  }
  outline(wild ? '#10180a' : harl ? '#08040a' : '#1a0c06');
  const hole = wild ? '#9ee85a' : harl ? '#ff4ab8' : '#140806';
  put(7, 9, hole);
  put(7, 10, hole);
  put(6, 9, hole);
  // Strings, and a glint of light off them.
  for (let i = 0; i < 5; i++) put(5 + i, 12 - i, '#f4ecd8');
  put(3, 13, neck[0]);
  put(12, 3, wild ? '#eaffa0' : harl ? '#ffb0e8' : '#a8fff0');
  if (harl) {
    // Rose diamonds inlaid round the black lacquer, gold at their points.
    for (const [x, y] of [[3, 8], [2, 9], [3, 10], [4, 9], [8, 12], [9, 11], [9, 13], [10, 12]]) put(x, y, '#ff5ab8');
    for (const [x, y] of [[3, 9], [9, 12]]) put(x, y, '#ffd0ee');
    put(4, 13, '#f4cf6a');
  }
  if (wild) {
    // A vine of leaves round the bowl, and a leaf at the pegbox.
    for (const [x, y] of [[1, 9], [1, 10], [2, 13], [3, 14], [9, 13], [10, 12], [12, 1]]) put(x, y, '#6aac44');
    for (const [x, y] of [[0, 10], [2, 14], [10, 13]]) put(x, y, '#9ed866');
  }
  return px;
}

/** The song: two beamed notes with sparks of light round them (the wildsong's in firefly green, a leaf on the beam). */
export function songIcon(style: 'wild' | 'harlequin' | false = false): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const wild = style === 'wild';
  const harl = style === 'harlequin';
  const [core, hot, mid] = wild ? ['#fffde6', '#eaffa0', '#9ee85a'] : harl ? ['#fff4fb', '#ffb0e8', '#ff4ab8'] : ['#f4fffc', '#a8fff0', '#3fd8c8'];
  // The harlequin's note heads are diamonds.
  const head = (cx: number, cy: number) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = (x + 0.5 - cx) / (harl ? 2.8 : 2.3);
        const dy = (y + 0.5 - cy) / (harl ? 2.2 : 1.7);
        if ((harl ? Math.abs(dx) + Math.abs(dy) : Math.hypot(dx, dy)) <= 1) put(x, y, x + 0.5 < cx && y + 0.5 < cy ? core : mid);
      }
    }
  };
  head(4.5, 12.5);
  head(11.5, 11);
  for (let y = 3; y <= 12; y++) put(6, y, hot);
  for (let y = 2; y <= 10; y++) put(13, y, hot);
  for (let x = 6; x <= 13; x++) {
    const y = Math.round(3 - (x - 6) * 0.15);
    put(x, y, core);
    put(x, y + 1, mid);
  }
  if (wild) for (const [x, y] of [[8, 0], [9, 0], [9, 1], [10, 0]]) put(x, y, '#6aac44');
  if (harl) for (const [x, y] of [[14, 1], [14, 2], [15, 2], [15, 1]]) put(x, y, '#f4cf6a');
  outline(wild ? '#0c2410' : harl ? '#2a0620' : '#0a2a2e');
  for (const [x, y] of [[1, 3], [2, 6], [9, 6], [14, 14]]) put(x, y, wild ? '#eaffa0' : '#ffe89a');
  return px;
}

/** Colours a drum icon is painted in. */
export interface DrumIconColors {
  shell: [string, string, string];
  rim: string;
  lace: string;
  head: string;
  handle: string;
  knob: string;
  /** The rhythm's light, brightest first, and its outline. */
  light: [string, string, string, string];
  outline: string;
}

export const WAR_DRUM_ICON: DrumIconColors = { shell: ['#c8402e', '#a42420', '#7a1618'], rim: '#d4984a', lace: '#ece0bc', head: '#f4e6c4', handle: '#906a42', knob: '#d8704a', light: ['#fffbe8', '#ffd98a', '#ff9a3a', '#b8401e'], outline: '#140204' };
/** The moonhowl's: a black spirit drum painted with woad, bone mallets, a moon-pale head. */
export const HOWL_DRUM_ICON: DrumIconColors = { shell: ['#3c3a58', '#2a2840', '#1a1828'], rim: '#5a4430', lace: '#6c7cff', head: '#e4e8f4', handle: '#e8e0cc', knob: '#bcc8ff', light: ['#f2f4ff', '#bcc8ff', '#6c7cff', '#2c2a9a'], outline: '#06060e' };
/** The taiko's: a lacquered zelkova barrel, brass tacks, a vermilion cord, long pale bachi; vermilion and gold. */
export const TAIKO_DRUM_ICON: DrumIconColors = { shell: ['#c06c34', '#94481e', '#6c2e14'], rim: '#d4a83c', lace: '#de3a1e', head: '#f4e6c4', handle: '#ecd4a2', knob: '#ecd4a2', light: ['#fff8e6', '#ffd24a', '#ff4a1e', '#8a1208'], outline: '#100402' };

/** The war drum: a red shell laced with rope under a pale head, two mallets crossed over it. */
export function drumIcon(k: DrumIconColors = WAR_DRUM_ICON): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let y = 7; y < 14; y++) for (let x = 2; x < 14; x++) put(x, y, x < 6 ? k.shell[0] : x < 10 ? k.shell[1] : k.shell[2]);
  for (let x = 2; x < 14; x++) {
    put(x, 13, k.rim);
    const z = Math.abs(((x - 2) % 4) - 2);
    put(x, 9 + z, k.lace);
  }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot((x + 0.5 - 8) / 6.2, (y + 0.5 - 7) / 2.2);
    if (d <= 1) put(x, y, d > 0.8 ? k.rim : k.head);
  }
  if (k === TAIKO_DRUM_ICON) {
    // A straight cord round its belly instead of lacing, brass tacks under the head, three commas on the skin.
    for (let x = 2; x < 14; x++) {
      for (let y = 9; y <= 12; y++) put(x, y, x < 6 ? k.shell[0] : x < 10 ? k.shell[1] : k.shell[2]);
      put(x, 11, x % 3 === 0 ? '#ffffff' : k.lace);
      if (x % 2 === 0) put(x, 9, k.rim);
    }
    for (const [x, y] of [[6, 6], [7, 6], [9, 7], [9, 6], [7, 8], [8, 8]]) put(x, y, k.lace);
    put(8, 7, '#140806');
  }
  if (k === HOWL_DRUM_ICON) {
    // A wolf's paw painted on the head in woad.
    for (const [x, y] of [[7, 7], [8, 7], [9, 7], [8, 8], [6, 6], [8, 5], [10, 6]]) put(x, y, k.light[2]);
  }
  // Mallets crossed above.
  for (let i = 0; i < 6; i++) {
    put(3 + i, 1 + i * 0.5 | 0, k.handle);
    put(12 - i, 1 + i * 0.5 | 0, k.handle);
  }
  if (k === TAIKO_DRUM_ICON) {
    // Bachi: long and plain, reaching further.
    put(2, 0, k.handle);
    put(13, 0, k.handle);
  } else for (const [x, y] of [[2, 0], [3, 0], [2, 1], [12, 0], [13, 0], [13, 1]]) put(x, y, k.knob);
  outline(k.outline);
  return px;
}

/** The battle rhythm: the drum's head lit in the middle, waves of sound rolling out from it. */
export function rhythmIcon(k: DrumIconColors = WAR_DRUM_ICON): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot((x + 0.5 - 8) / 1.0, (y + 0.5 - 9) / 0.7);
      // The taiko's waves break like brushstrokes: thick where the brush lands, a dry gap where it lifts.
      const brush = k === TAIKO_DRUM_ICON;
      const a = Math.atan2(y + 0.5 - 9, x + 0.5 - 8);
      const dry = brush && a > -1.1 && a < -0.5;
      const w = brush ? 0.45 + (a + Math.PI) * 0.12 : 0.6;
      if (d <= 3.2) put(x, y, d < 1.6 ? k.light[0] : k.light[1]);
      else if (!dry && Math.abs(d - 5.6) <= w && y < 13) put(x, y, k.light[2]);
      else if (!dry && Math.abs(d - 7.8) <= w && y < 12) put(x, y, k.light[3]);
    }
  }
  for (let x = 5; x <= 11; x++) put(x, 13, k.shell[2]);
  for (let x = 6; x <= 10; x++) put(x, 14, k.shell[2]);
  if (k === HOWL_DRUM_ICON) {
    // The moon the pack howls at, over the waves.
    for (const [x, y] of [[13, 0], [14, 0], [15, 1], [15, 2], [14, 3], [13, 3], [14, 1], [14, 2]]) put(x, y, x === 14 && (y === 1 || y === 2) ? '#6c7cff' : k.light[0]);
  }
  if (k === TAIKO_DRUM_ICON) for (const [x, y] of [[14, 1], [15, 3], [13, 0]]) put(x, y, k.light[2]);
  outline(k === HOWL_DRUM_ICON ? '#06060e' : '#1e0806');
  return px;
}

/** Colours of a minstrel skin's song icon: its light, brightest first, its outline, and its sparks. */
interface SongIconColors {
  light: [string, string, string];
  outline: string;
  spark: string;
}

const SONG_ICONS: Record<'vagabond' | 'fadista' | 'orpheus' | 'skald', SongIconColors> = {
  skald: { light: ['#fffcee', '#ffe8a0', '#8ccfff'], outline: '#0c1c34', spark: '#bfe2ff' },
  vagabond: { light: ['#fbf6ff', '#e2d0ff', '#b08cff'], outline: '#1c0e3a', spark: '#ffe8c0' },
  fadista: { light: ['#f4f8ff', '#b8d2ff', '#3c7cff'], outline: '#06103a', spark: '#ffffff' },
  orpheus: { light: ['#fffdf2', '#ffeeaa', '#ffc84a'], outline: '#2a1040', spark: '#c890ff' },
};

/** The song in a newer minstrel skin's colours, with its own sign over the beam: a seed adrift, a swallow, a sprig of laurel. */
export function skinSongIcon(style: 'vagabond' | 'fadista' | 'orpheus' | 'skald'): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const k = SONG_ICONS[style];
  const [core, hot, mid] = k.light;
  const head = (cx: number, cy: number) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot((x + 0.5 - cx) / 2.3, (y + 0.5 - cy) / 1.7) <= 1) put(x, y, x + 0.5 < cx && y + 0.5 < cy ? core : mid);
  };
  head(4.5, 12.5);
  head(11.5, 11);
  for (let y = 4; y <= 12; y++) put(6, y, hot);
  for (let y = 3; y <= 10; y++) put(13, y, hot);
  for (let x = 6; x <= 13; x++) {
    const y = Math.round(4 - (x - 6) * 0.15);
    put(x, y, core);
    put(x, y + 1, mid);
  }
  if (style === 'vagabond') for (const [x, y] of [[2, 1], [3, 0], [4, 1], [3, 2], [3, 3], [3, 4]]) put(x, y, y < 2 ? core : '#8a6c40');
  if (style === 'fadista') for (const [x, y] of [[1, 2], [2, 3], [3, 3], [4, 2], [3, 1], [5, 1], [2, 4]]) put(x, y, x === 3 && y === 3 ? '#ffffff' : '#2a52c4');
  if (style === 'orpheus') for (const [x, y] of [[8, 0], [9, 1], [10, 0], [11, 1], [12, 0]]) put(x, y, (x & 1) ? '#5a9632' : '#8cc456');
  // The skald's: Fehu, a rune of gold.
  if (style === 'skald') for (const [x, y] of [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [3, 1], [4, 0], [3, 3], [4, 2]]) put(x, y, '#ffe8a0');
  outline(k.outline);
  for (const [x, y] of [[1, 7], [9, 7], [14, 14], [15, 4]]) put(x, y, k.spark);
  return px;
}

/** The vagabond's banjo: a round vellum head in a nickel rim, a long neck, a straight headstock with its pegs. */
export function banjoIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let i = 0; i < 8; i++) {
    put(8 + i, 7 - i, '#482814');
    put(9 + i, 7 - i, '#62381c');
  }
  for (const [x, y] of [[13, 0], [15, 2], [15, 0]]) put(x, y, '#c4c8d0');
  put(11, 6, '#c4c8d0');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 6, y + 0.5 - 10);
      if (d <= 5.2) put(x, y, d > 4.2 ? ((x + y) % 3 === 0 ? '#f2f4f8' : '#868a94') : d < 2.4 ? '#f2e8cc' : x + y < 16 ? '#d6c9a6' : '#ae9f7e');
    }
  }
  outline('#0c0c10');
  for (let i = 0; i < 6; i++) put(4 + i, 12 - i, '#8a8070');
  put(5, 11, '#36180c');
  put(6, 11, '#36180c');
  put(12, 3, '#e2d0ff');
  return px;
}

/** The fadista's Portuguese guitar: a pear-round spruce belly, a tiled rosette, and the bright fan of its head. */
export function guitarraIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let i = 0; i < 6; i++) {
    put(8 + i, 7 - i, '#4a2418');
    put(9 + i, 7 - i, '#663424');
  }
  for (let y = 0; y < 5; y++) for (let x = 11; x < 16; x++) if (Math.hypot(x + 0.5 - 14.5, y + 0.5 - 1.5) <= 2.8 && x + y >= 13) put(x, y, (x + y) % 2 ? '#f4cf6a' : '#d69a3a');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 6, y + 0.5 - 10);
      const d2 = Math.hypot(x + 0.5 - 8.4, y + 0.5 - 7.6);
      if (d <= 5.0 || d2 <= 3.2) put(x, y, d < 2.8 ? '#f2d8a2' : x + y < 15 ? '#dab474' : '#b48848');
    }
  }
  outline('#1a0e06');
  for (const [x, y, c] of [[6, 8, '#2a52c4'], [8, 8, '#ffffff'], [8, 10, '#2a52c4'], [6, 10, '#ffffff'], [5, 9, '#2a52c4'], [9, 9, '#2a52c4']] as const) put(x, y, c);
  put(7, 9, '#140806');
  for (let i = 0; i < 5; i++) put(4 + i, 13 - i, '#f4ecd8');
  put(12, 2, '#b8d2ff');
  return px;
}

/** Orpheus's lyre: a tortoise-shell bowl, two golden arms curling out at the top, a yoke and shining strings. */
export function lyreIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (const [x, y] of [[2, 1], [3, 1], [3, 2], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [4, 8], [4, 9], [13, 1], [12, 1], [12, 2], [11, 3], [11, 4], [11, 5], [11, 6], [11, 7], [11, 8], [11, 9]]) put(x, y, x < 8 ? '#f4cf6a' : '#d69a3a');
  for (let x = 3; x <= 12; x++) put(x, 4, x % 3 === 0 ? '#fff4bf' : '#d69a3a');
  for (const x of [6, 8, 9]) for (let y = 5; y <= 11; y++) put(x, y, '#ffeeaa');
  for (let y = 10; y < 16; y++) for (let x = 2; x < 14; x++) if (Math.hypot((x + 0.5 - 7.5) / 5.4, (y + 0.5 - 11.5) / 3.6) <= 1) put(x, y, (x * 7 + y * 13) % 5 === 0 ? '#381c0a' : y < 12 ? '#c4883a' : '#985c22');
  outline('#2a1040');
  put(7, 6, '#fffdf2');
  put(1, 0, '#c890ff');
  put(14, 0, '#c890ff');
  return px;
}

/** The skald's round lyre: a slab of carved oak, a hand-hole through its head, a paler soundboard and its strings, a rune glowing in the crown. */
export function skaldLyreIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const u = (y + 0.5 - 8) / 7.6;
      const v = (x + 0.5 - 8) / 4.6;
      if (u ** 4 + v ** 4 > 1) continue;
      const hole = y >= 2 && y <= 4 && x >= 6 && x <= 9;
      if (hole) continue;
      const frame = u ** 4 + v ** 4 > 0.35 || y < 6;
      put(x, y, frame ? ((x + y * 2) % 4 === 0 ? '#8e6636' : x < 8 ? '#6e4a24' : '#523418') : y < 10 ? '#c49a5c' : '#a87e44');
    }
  }
  outline('#0c0603');
  for (const x of [6, 8, 10]) for (let y = 6; y <= 13; y++) put(x - (x === 10 ? 1 : 0), y, '#f4ecd8');
  for (let x = 5; x <= 10; x++) put(x, 12, '#341f0e');
  put(7, 1, '#e8f4ff');
  put(8, 1, '#a8ccef');
  put(13, 3, '#bfe2ff');
  put(2, 12, '#ffe8a0');
  return px;
}
