// The wizard, drawn procedurally from a small rig.
//
// Every frame is a Pose (body lift, breathing, foot offsets, staff transform,
// magic trail...) fed to a per-direction draw function. Animations are just
// sequences of poses, so timing and motion stay easy to tweak.

import { FLAT, PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import {
  BEARD,
  BOOT,
  CHAR_WOOD,
  CRYSTAL,
  EMBER_CORE,
  EMBER_CRYSTAL,
  EMBER_DEEP,
  EMBER_HOT,
  EMBER_MID,
  EYE,
  GOLD,
  HAIR,
  HOOD_SHADOW,
  LEATHER,
  MAGIC_CORE,
  MAGIC_DEEP,
  MAGIC_HOT,
  MAGIC_MID,
  OBSIDIAN,
  PALE_SKIN,
  PYRO_BEARD,
  PYRO_INNER,
  PYRO_ROBE,
  PYRO_TRIM,
  ROBE,
  ROBE_INNER,
  SILVER,
  SKIN,
  VOID_CORE,
  VOID_CRYSTAL,
  VOID_DEEP,
  VOID_EYE,
  VOID_HOT,
  VOID_LINING,
  VOID_MID,
  VOID_ROBE,
  WOOD,
} from './palette';
import {
  DEMON_SKIN,
  FEL_CORE,
  FEL_CRYSTAL,
  FEL_DEEP,
  FEL_EYE,
  FEL_HOT,
  FEL_MID,
  FEL_TRIM,
  HELL_HAIR,
  HELL_LINING,
  HELL_ROBE,
  HORN,
  STARWOOD,
  STAR_CORE,
  STAR_CRYSTAL,
  STAR_DEEP,
  STAR_HAIR,
  STAR_HOT,
  STAR_LINING,
  STAR_MID,
  STAR_ROBE,
} from './heroSkins';
import { ABYSS_BONE, ABYSS_DEEP, ABYSS_FIN, ABYSS_HAIR, ABYSS_HOT, ABYSS_INNER, ABYSS_MID, ABYSS_CORE, ABYSS_ROBE, ABYSS_SKIN, CORAL, DRIFTWOOD, FOAM, LURE, PEARL, SEA_HAIR, SHELL, TIDE_CORE, TIDE_DEEP, TIDE_HOT, TIDE_INNER, TIDE_MID, TIDE_ROBE } from './tide';
import { BAMBOO, INK_HAIR, JADE_ROBE, LILY_PAD, LOTUS_CORE, LOTUS_DEEP, LOTUS_GOLD, LOTUS_HOT, LOTUS_MID, LOTUS_PEARL, LOTUS_PINK, LOTUS_SILK } from './tide';
import { FAE_BLOSSOM, FAE_GOLD, FAE_GOWN, FAE_PETAL, FAE_WING, HONEY_HAIR, MOONFLOWER, MOONWOOD, TITANIA_CORE, TITANIA_DEEP, TITANIA_HOT, TITANIA_MID } from './druid';
import { MYC_SKIN } from './druid';
import { ASH_HAIR, ASH_PAINT, CHAR_BONE, CHAR_HIDE, CINDER_CORE, CINDER_DEEP, CINDER_HOT, CINDER_MID, CINDER_TUNIC, CINDER_WOOD, GLOWCAP, LAVA, MAGMA, MYC_CAP, MYC_CORE, MYC_DEEP, MYC_GILL, MYC_HAIR, MYC_HOT, MYC_LOAM, MYC_MID, MYC_ROBE, MYC_SPOT, MYC_STEM, MYC_WOOD, OBSIDIAN_PELT } from './druid';
import { GNARLWOOD, JACK_FIRE, JACK_RIND, JACK_STEM, PUMPKIN_TRIM, WITCH_CORE, WITCH_DEEP, WITCH_EYE, WITCH_GHOST, WITCH_HAIR, WITCH_HAT, WITCH_HOT, WITCH_LINING, WITCH_MID, WITCH_RIBBON, WITCH_ROBE, WITCH_SKIN } from './pumpkin';
import { ASHWOOD, PRISM_CORE, PRISM_DEEP, PRISM_GEM, PRISM_HAIR, PRISM_HOT, PRISM_MID, PRISM_SILVER, QUARTZ, QUARTZ_LINING, QUARTZ_ROBE, SPECTRUM } from './prism';
import { FIREBIRD_CORE, FIREBIRD_DEEP, FIREBIRD_EMBER, FIREBIRD_GOLD, FIREBIRD_HOT, FIREBIRD_INNER, FIREBIRD_MID, FIREBIRD_ROBE, FIREBIRD_ROSE, PLUME } from './firebird';
import { SIREN_CORAL, SIREN_CORE, SIREN_DEEP, SIREN_FIN, SIREN_GLINT, SIREN_HAIR, SIREN_HOT, SIREN_MID, SIREN_PEARL, SIREN_SCALE, SIREN_SHELL, SIREN_SILK } from './tide';
import { ANTLER, AMBER, AUBURN, AUTUMN_LEAF, AUTUMN_ROBE, BARE_ANTLER, BARK, EMBER_SEED, FANG, FROST_HAIR, FROST_HIDE, FROST_TUNIC, FROST_WOOD, HIDE, ICE, ICE_FANG, LEAF, LIVEWOOD, MOSS, MUZZLE, PELT, SEED, SNOW_PELT, TUNIC, WOAD, WOLF_NOSE, AUTUMN_CORE, AUTUMN_DEEP, AUTUMN_HOT, AUTUMN_MID, FROST_CORE, FROST_DEEP, FROST_HOT, FROST_MID, GROVE_CORE, GROVE_DEEP, GROVE_HOT, GROVE_MID, WILD_CORE, WILD_DEEP, WILD_HOT, WILD_MID } from './druid';

// ---------------------------------------------------------------------------
// Looks (skins). Every look shares the rig, poses and staff geometry, so the
// crystal sits on the same pixel in every frame and gameplay is identical.

export interface WizardLook {
  /** Texture and animation key prefix, e.g. "wizard" or "wizard_void". */
  key: string;
  robe: Material;
  inner: Material;
  trim: Material;
  belt: Material;
  boot: Material;
  skin: Material;
  shaft: Material;
  crystal: Material;
  magic: { core: RGB; hot: RGB; mid: RGB; deep: RGB };
  /**
   * false: pointed hat, white beard, gold trim, forked wooden staff.
   * true: a deep cowl with glowing eyes, a shoulder mantle, a tattered hem
   * and a crescent-headed staff.
   */
  hooded: boolean;
  /** Beard and hair of the hatted look (default: white). */
  beard?: Material;
  /** The emblem on the hat: a star, or a flame. */
  sigil?: 'star' | 'flame';
  /**
   * A bare head in place of the hat or the cowl:
   * 'astral': long silver hair under a gold circlet, a tall fan collar and a
   * crown of stars; a starwood staff ringed like an armillary sphere.
   * 'fiend': a horned, crimson-skinned warlock with a goatee and green eyes,
   * bone spikes on a shoulder mantle, a ragged hem smouldering with fel fire,
   * and a black staff crowned with horns round the flame.
   * 'grove': the Druid's Grovekeeper, a hood of moss with antlers growing
   * through it, a mantle and hem of leaves, fireflies about the robe, and a
   * living staff whose twigs cradle a glowing seed.
   * 'wild': the Druid's Shapeshifter, a wolf's pelt worn as a hood (its head
   * over her brow, its eyes still burning), a fur mantle, woad on the cheeks,
   * a ragged hide robe and a staff hung with fangs round a lump of amber.
   * 'tide': the Tidecaller, long sea-green hair drifting as if under water, a
   * crown of coral, a collar of scallop shells, a hem breaking in foam,
   * bubbles rising round her, and a driftwood staff whose coral tines cradle
   * a pearl.
   * 'witch': the Pyromancer's Pumpkin Witch, a tall crooked hat with a bent
   * tip and a jack-o'-lantern charm on its band, long flame-orange hair past
   * the shoulders, a pale green face with glowing eyes, a laced bodice, a
   * ragged hem striped in orange, embers and ghost-motes drifting round her,
   * and a gnarled staff cradling a carved, glowing pumpkin.
   * 'faerie': the Grovekeeper's Titania, the faerie queen: honey-gold hair to
   * the waist under a crown of white blossoms and gold leaves, a gown of
   * petals in tiers from blush to cream, dragonfly wings that flutter as she
   * breathes and walks, fireflies and pollen round her, and a slender
   * moonwood staff whose sepals cup a glowing moonflower bud.
   * 'lotus': the Tidecaller's Lotus, a water-lily priestess: ink-black hair
   * in a high bun with a lotus in it, jade robes crossed over white silk with
   * a pink sash, lily pads on her shoulders, petals drifting round her, and a
   * bamboo staff whose head is an opening lotus cradling a pearl.
   * 'cap': the Grovekeeper's Mycelia, a mushroom druid of the deep woods: a
   * broad spotted toadstool for a hat with glowing gills under its brim, dark
   * hair to the shoulders, glowcaps sprouting on her shoulders and up her
   * staff, a hem frilled into glowing gills, foxfire freckles and spores
   * drifting up round her, and a gnarled staff crowned with luminous mushrooms.
   */
  head?: 'astral' | 'fiend' | 'grove' | 'wild' | 'tide' | 'witch' | 'faerie' | 'lotus' | 'prism' | 'firebird' | 'siren' | 'cap';
  /** The Prism's quartz: its floating crown, pauldrons and hem points. */
  shard?: Material;
  /** The Firebird's flame feathers: crest, mantle, hem and the staff's plumes. */
  plume?: Material;
  /** The Siren's fins at the hem. */
  fin?: Material;
  /** Mycelia's toadstool: its cap, the glowing spots on it, and the mushrooms' pale stems. */
  shroom?: { cap: Material; spot: Material; stem: Material };
  /**
   * The Shapeshifter's Cinderhide: the wolf's head becomes its charred skull
   * (in `trim`, with embers in its sockets), lava cracks open through the pelt
   * and the hide, ash on her face in place of woad, and eyes of ember.
   */
  cinder?: { lava: Material; paint: Material };
  /** Titania's wings. */
  wing?: Material;
  /** Flowers worn in the hair: Titania's white blossoms, Lotus's pink lotus (and her staff's petals). */
  petal?: Material;
  /** Lotus's lily-pad shoulders. */
  pad?: Material;
  /** Hair of the bare heads. */
  hair?: Material;
  /** The Tidecaller's crown and staff tines. */
  coral?: Material;
  /** The Tidecaller's collar of shells. */
  shell?: Material;
  /** The Tidecaller's Abyssal skin: an anglerfish's lure in place of the crown, eyes that glow, and living light on the robe. */
  lure?: boolean;
  /** The idle moment (`rest`) this look plays: its type's, so every skin of a type does the same. */
  rest: RestAct;
}

/**
 * The idle moments, one per type: the Arcanist lets his crystal drift round
 * him while he strokes his beard; the Pyromancer snaps up a flame and juggles
 * it; the Tidecaller bounces a bubble; the Grovekeeper lets a butterfly light
 * on a finger; the Shapeshifter howls, then shakes out her pelt.
 */
export type RestAct = 'arcane' | 'pyro' | 'tide' | 'grove' | 'wild';

export const ARCANE_LOOK: WizardLook = {
  key: 'wizard',
  rest: 'arcane',
  robe: ROBE,
  inner: ROBE_INNER,
  trim: GOLD,
  belt: LEATHER,
  boot: BOOT,
  skin: SKIN,
  shaft: WOOD,
  crystal: CRYSTAL,
  magic: { core: MAGIC_CORE, hot: MAGIC_HOT, mid: MAGIC_MID, deep: MAGIC_DEEP },
  hooded: false,
};

export const VOID_LOOK: WizardLook = {
  key: 'wizard_void',
  rest: 'arcane',
  robe: VOID_ROBE,
  inner: VOID_LINING,
  trim: SILVER,
  belt: VOID_LINING,
  boot: BOOT,
  skin: PALE_SKIN,
  shaft: OBSIDIAN,
  crystal: VOID_CRYSTAL,
  magic: { core: VOID_CORE, hot: VOID_HOT, mid: VOID_MID, deep: VOID_DEEP },
  hooded: true,
};

/** The Pyromancer: the classic hat and beard in fire colours, a flame on the hat. */
export const PYRO_LOOK: WizardLook = {
  key: 'wizard_pyro',
  rest: 'pyro',
  robe: PYRO_ROBE,
  inner: PYRO_INNER,
  trim: PYRO_TRIM,
  belt: PYRO_INNER,
  boot: BOOT,
  skin: SKIN,
  shaft: CHAR_WOOD,
  crystal: EMBER_CRYSTAL,
  magic: { core: EMBER_CORE, hot: EMBER_HOT, mid: EMBER_MID, deep: EMBER_DEEP },
  hooded: false,
  beard: PYRO_BEARD,
  sigil: 'flame',
};

/** The Arcanist's Astral skin: a reader of the stars. */
export const ASTRAL_LOOK: WizardLook = {
  key: 'wizard_astral',
  rest: 'arcane',
  robe: STAR_ROBE,
  inner: STAR_LINING,
  trim: GOLD,
  belt: STAR_LINING,
  boot: BOOT,
  skin: SKIN,
  shaft: STARWOOD,
  crystal: STAR_CRYSTAL,
  magic: { core: STAR_CORE, hot: STAR_HOT, mid: STAR_MID, deep: STAR_DEEP },
  hooded: false,
  head: 'astral',
  hair: STAR_HAIR,
};

/** The Pyromancer's Hellfire skin: a horned warlock of green fire. */
export const HELL_LOOK: WizardLook = {
  key: 'wizard_hell',
  rest: 'pyro',
  robe: HELL_ROBE,
  inner: HELL_LINING,
  trim: FEL_TRIM,
  belt: HELL_LINING,
  boot: BOOT,
  skin: DEMON_SKIN,
  shaft: OBSIDIAN,
  crystal: FEL_CRYSTAL,
  magic: { core: FEL_CORE, hot: FEL_HOT, mid: FEL_MID, deep: FEL_DEEP },
  hooded: false,
  head: 'fiend',
  hair: HELL_HAIR,
};

/** The Druid's Grovekeeper: moss, leaves and antlers, and the light of a sunlit glade. */
export const GROVE_LOOK: WizardLook = {
  key: 'druid',
  rest: 'grove',
  robe: MOSS,
  inner: BARK,
  trim: LEAF,
  belt: LEATHER,
  boot: BOOT,
  skin: SKIN,
  shaft: LIVEWOOD,
  crystal: SEED,
  magic: { core: GROVE_CORE, hot: GROVE_HOT, mid: GROVE_MID, deep: GROVE_DEEP },
  hooded: false,
  head: 'grove',
  hair: ANTLER,
};

/** The Druid's Shapeshifter: a wolf's pelt, hide and fangs, and amber spirit light. */
export const WILD_LOOK: WizardLook = {
  key: 'druid_wild',
  rest: 'wild',
  robe: HIDE,
  inner: TUNIC,
  trim: FANG,
  belt: LEATHER,
  boot: BOOT,
  skin: SKIN,
  shaft: WOOD,
  crystal: AMBER,
  magic: { core: WILD_CORE, hot: WILD_HOT, mid: WILD_MID, deep: WILD_DEEP },
  hooded: false,
  head: 'wild',
  hair: PELT,
  beard: AUBURN,
};

/** The Grovekeeper's Autumn Warden skin: russet leaves, bare antlers and an ember of a seed. */
export const AUTUMN_LOOK: WizardLook = {
  ...GROVE_LOOK,
  key: 'druid_autumn',
  robe: AUTUMN_ROBE,
  trim: AUTUMN_LEAF,
  crystal: EMBER_SEED,
  hair: BARE_ANTLER,
  magic: { core: AUTUMN_CORE, hot: AUTUMN_HOT, mid: AUTUMN_MID, deep: AUTUMN_DEEP },
};

/** The Shapeshifter's Frostfang skin: a white wolf's pelt with eyes of ice, and a shard of ice on the staff. */
export const FROST_LOOK: WizardLook = {
  ...WILD_LOOK,
  key: 'druid_frost',
  robe: FROST_HIDE,
  inner: FROST_TUNIC,
  trim: ICE_FANG,
  shaft: FROST_WOOD,
  crystal: ICE,
  hair: SNOW_PELT,
  beard: FROST_HAIR,
  magic: { core: FROST_CORE, hot: FROST_HOT, mid: FROST_MID, deep: FROST_DEEP },
};

/** The Tidecaller: a sea sorceress in the blues of the open water, crowned with coral. */
export const TIDE_LOOK: WizardLook = {
  key: 'wizard_tide',
  rest: 'tide',
  robe: TIDE_ROBE,
  inner: TIDE_INNER,
  trim: FOAM,
  belt: TIDE_INNER,
  boot: BOOT,
  skin: SKIN,
  shaft: DRIFTWOOD,
  crystal: PEARL,
  magic: { core: TIDE_CORE, hot: TIDE_HOT, mid: TIDE_MID, deep: TIDE_DEEP },
  hooded: false,
  head: 'tide',
  hair: SEA_HAIR,
  coral: CORAL,
  shell: SHELL,
};

/** The Tidecaller's Abyssal skin: a witch of the trench, lit by her own lure. */
export const ABYSS_LOOK: WizardLook = {
  ...TIDE_LOOK,
  key: 'wizard_abyss',
  robe: ABYSS_ROBE,
  inner: ABYSS_INNER,
  trim: ABYSS_FIN,
  belt: ABYSS_INNER,
  skin: ABYSS_SKIN,
  shaft: ABYSS_BONE,
  crystal: LURE,
  magic: { core: ABYSS_CORE, hot: ABYSS_HOT, mid: ABYSS_MID, deep: ABYSS_DEEP },
  hair: ABYSS_HAIR,
  coral: ABYSS_BONE,
  shell: ABYSS_FIN,
  lure: true,
};

/** The Pyromancer's Pumpkin Witch (Hallow's Eve): a witch of candle-orange fire with violet at its edges. */
export const PUMPKIN_LOOK: WizardLook = {
  key: 'wizard_pumpkin',
  rest: 'pyro',
  robe: WITCH_ROBE,
  inner: WITCH_LINING,
  trim: PUMPKIN_TRIM,
  belt: WITCH_LINING,
  boot: BOOT,
  skin: WITCH_SKIN,
  shaft: GNARLWOOD,
  crystal: JACK_RIND,
  magic: { core: WITCH_CORE, hot: WITCH_HOT, mid: WITCH_MID, deep: WITCH_DEEP },
  hooded: false,
  head: 'witch',
  hair: WITCH_HAIR,
};

/** The Grovekeeper's Titania skin: the faerie queen, in petals and gold, on gauzy wings. */
export const TITANIA_LOOK: WizardLook = {
  ...GROVE_LOOK,
  key: 'druid_titania',
  robe: FAE_GOWN,
  inner: FAE_PETAL,
  trim: FAE_GOLD,
  belt: FAE_GOLD,
  boot: FAE_PETAL,
  shaft: MOONWOOD,
  crystal: MOONFLOWER,
  magic: { core: TITANIA_CORE, hot: TITANIA_HOT, mid: TITANIA_MID, deep: TITANIA_DEEP },
  head: 'faerie',
  hair: HONEY_HAIR,
  wing: FAE_WING,
  petal: FAE_BLOSSOM,
};

/** The Tidecaller's Lotus skin: a priestess of still water, in jade and white silk, crowned with a lotus. */
export const LOTUS_LOOK: WizardLook = {
  ...TIDE_LOOK,
  key: 'wizard_lotus',
  robe: JADE_ROBE,
  inner: LOTUS_SILK,
  trim: LOTUS_GOLD,
  belt: LOTUS_PINK,
  boot: LOTUS_SILK,
  shaft: BAMBOO,
  crystal: LOTUS_PEARL,
  magic: { core: LOTUS_CORE, hot: LOTUS_HOT, mid: LOTUS_MID, deep: LOTUS_DEEP },
  head: 'lotus',
  hair: INK_HAIR,
  petal: LOTUS_PINK,
  pad: LILY_PAD,
};

/** The Grovekeeper's Mycelia skin: a mushroom druid of the deep woods, lit only by what grows on her. */
export const MYCELIA_LOOK: WizardLook = {
  ...GROVE_LOOK,
  key: 'druid_mycelia',
  robe: MYC_ROBE,
  inner: MYC_LOAM,
  trim: MYC_GILL,
  belt: MYC_STEM,
  skin: MYC_SKIN,
  shaft: MYC_WOOD,
  crystal: GLOWCAP,
  magic: { core: MYC_CORE, hot: MYC_HOT, mid: MYC_MID, deep: MYC_DEEP },
  head: 'cap',
  hair: MYC_HAIR,
  shroom: { cap: MYC_CAP, spot: MYC_SPOT, stem: MYC_STEM },
};

/** The Shapeshifter's Cinderhide skin: a volcano's shaman, in an obsidian pelt cracked with fire under a charred wolf's skull. */
export const CINDER_LOOK: WizardLook = {
  ...WILD_LOOK,
  key: 'druid_cinder',
  robe: CHAR_HIDE,
  inner: CINDER_TUNIC,
  trim: CHAR_BONE,
  shaft: CINDER_WOOD,
  crystal: MAGMA,
  hair: OBSIDIAN_PELT,
  beard: ASH_HAIR,
  magic: { core: CINDER_CORE, hot: CINDER_HOT, mid: CINDER_MID, deep: CINDER_DEEP },
  cinder: { lava: LAVA, paint: ASH_PAINT },
};

/** The Arcanist's Prism skin: a crystal mage in pale quartz, crowned with floating shards, who splits the light. */
export const PRISM_LOOK: WizardLook = {
  key: 'wizard_prism',
  rest: 'arcane',
  robe: QUARTZ_ROBE,
  inner: QUARTZ_LINING,
  trim: PRISM_SILVER,
  belt: QUARTZ_LINING,
  boot: BOOT,
  skin: SKIN,
  shaft: ASHWOOD,
  crystal: PRISM_GEM,
  magic: { core: PRISM_CORE, hot: PRISM_HOT, mid: PRISM_MID, deep: PRISM_DEEP },
  hooded: false,
  head: 'prism',
  hair: PRISM_HAIR,
  shard: QUARTZ,
};

/** The Pyromancer's Firebird skin: a priestess hooded as the firebird, feathered in crimson and gold. */
export const FIREBIRD_LOOK: WizardLook = {
  key: 'wizard_firebird',
  rest: 'pyro',
  robe: FIREBIRD_ROBE,
  inner: FIREBIRD_INNER,
  trim: FIREBIRD_GOLD,
  belt: FIREBIRD_GOLD,
  boot: BOOT,
  skin: SKIN,
  shaft: FIREBIRD_GOLD,
  crystal: FIREBIRD_EMBER,
  magic: { core: FIREBIRD_CORE, hot: FIREBIRD_HOT, mid: FIREBIRD_MID, deep: FIREBIRD_DEEP },
  hooded: false,
  head: 'firebird',
  plume: PLUME,
};

/** The Tidecaller's Siren skin: a siren of the sunset sea, in iridescent scales and shells, with a coral trident. */
export const SIREN_LOOK: WizardLook = {
  ...TIDE_LOOK,
  key: 'wizard_siren',
  robe: SIREN_SCALE,
  inner: SIREN_SILK,
  trim: SIREN_SHELL,
  belt: SIREN_SILK,
  boot: SIREN_FIN,
  shaft: SIREN_CORAL,
  crystal: SIREN_PEARL,
  magic: { core: SIREN_CORE, hot: SIREN_HOT, mid: SIREN_MID, deep: SIREN_DEEP },
  head: 'siren',
  hair: SIREN_HAIR,
  coral: SIREN_CORAL,
  shell: SIREN_SHELL,
  fin: SIREN_FIN,
};

export const WIZARD_LOOKS = [ARCANE_LOOK, VOID_LOOK, PYRO_LOOK, ASTRAL_LOOK, HELL_LOOK, GROVE_LOOK, WILD_LOOK, AUTUMN_LOOK, FROST_LOOK, TIDE_LOOK, ABYSS_LOOK, PUMPKIN_LOOK, TITANIA_LOOK, LOTUS_LOOK, PRISM_LOOK, FIREBIRD_LOOK, SIREN_LOOK, MYCELIA_LOOK, CINDER_LOOK];

/** The look being drawn. Frame drawing is synchronous, so a module slot is enough. */
let S: WizardLook = ARCANE_LOOK;

export const FRAME_W = 24;
export const FRAME_H = 32;

export type Dir = 'down' | 'up' | 'left' | 'right';
export const DIRS: Dir[] = ['down', 'up', 'left', 'right'];

export interface Staff {
  /** Hand (grip) position in frame pixels. */
  hx: number;
  hy: number;
  /** Degrees; 0 = crystal straight up, positive turns clockwise. */
  angle: number;
  len: number;
  /** Where along the staff the hand holds it, 0 = bottom, 1 = top. */
  grip: number;
  /** Crystal hovers this far past the fork (0 = seated at the tip). */
  float: number;
}

export interface Pose {
  /** Whole body raised by this many pixels (walk passing frames). */
  lift: number;
  /** Upper body lowered by this many pixels (idle breathing). */
  breath: number;
  /** Hat tip sway, in pixels. */
  hat: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Robe hem sway in pixels. */
  hem: number;
  /** Free-arm swing in pixels. */
  arm: number;
  staff: Staff;
  /** Draw the staff behind the body. */
  staffBehind?: boolean;
  blink?: boolean;
  /** 0..1 crystal glow strength. */
  glow: number;
  /** Magic arc swept by the crystal: angles (deg) around the hand, newest last. */
  trail?: number[];
  /** Burst of light at the crystal (0..1). */
  flash?: number;
  /** How far open Titania's wings are, 0 swept back to 1 spread (unset: nearly spread). */
  flap?: number;

  // The idle moment only (facing down); every other frame leaves these unset.
  /** The free hand raised to here, bent at `elbow` (frame pixels, breathing added); the forearm is drawn over the head. */
  free?: { x: number; y: number; ex: number; ey: number };
  /** The eyes glance a pixel this way (x -1..1, y -1..0). */
  gaze?: [number, number];
  /** The crystal lifted off the staff, drifting free at this point; `behind` the head on the far side of its circle. */
  gem?: { x: number; y: number; behind?: boolean };
  /** The Shapeshifter's howl: 1 the head tipping back, 2 muzzle to the sky. */
  howl?: number;
  /** The Shapeshifter shaking out her pelt: its head and her hair thrown this many pixels sideways. */
  shake?: number;
  /** A prop or a puff of magic drawn over the figure (a flame, a bubble, a butterfly). */
  fx?: (c: PixelCanvas) => void;
}

export interface FrameMeta {
  /** Crystal centre in frame pixels. */
  tipX: number;
  tipY: number;
  glow: number;
}

const RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// Shared parts

function staffGeom(s: Staff) {
  const a = s.angle * RAD;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const up = s.len * (1 - s.grip);
  const down = s.len * s.grip;
  const top = { x: s.hx + dx * up, y: s.hy + dy * up };
  const bottom = { x: s.hx - dx * down, y: s.hy - dy * down };
  const gem = { x: top.x + dx * (s.float + 1.6), y: top.y + dy * (s.float + 1.6) };
  return { dx, dy, top, bottom, gem };
}

function drawStaff(c: PixelCanvas, s: Staff, glow: number, free?: { x: number; y: number; behind?: boolean }): { x: number; y: number } {
  const g = staffGeom(s);
  c.part();
  // Wood: lit from the left, with a couple of darker knots along the shaft.
  const woodN: Vec3 = { x: -0.45, y: 0.25, z: 0.86 };
  c.line(g.bottom.x, g.bottom.y, g.top.x, g.top.y, S.shaft, () => woodN);
  const steps = Math.round(Math.max(Math.abs(g.top.x - g.bottom.x), Math.abs(g.top.y - g.bottom.y)));
  for (let i = 5; i < steps - 2; i += 7) {
    const t = i / steps;
    c.shade(Math.round(g.bottom.x + (g.top.x - g.bottom.x) * t), Math.round(g.bottom.y + (g.top.y - g.bottom.y) * t), -1);
  }
  // Cinderhide's staff is charred through, still glowing in its cracks.
  if (S.cinder) {
    for (let i = 3; i < steps - 1; i += 5) {
      const t = i / steps;
      c.px(Math.round(g.bottom.x + (g.top.x - g.bottom.x) * t), Math.round(g.bottom.y + (g.top.y - g.bottom.y) * t), S.cinder.lava, woodN, { glow: 0.3 + glow * 0.3, bias: -1 });
    }
  }
  if (S.hooded) {
    // A silver crescent cradling the crystal, horns curling up past it.
    c.part();
    const cx = g.top.x + g.dx * 1.6;
    const cy = g.top.y + g.dy * 1.6;
    const r = 2.7;
    for (let a = -128; a <= 128; a += 11) {
      const th = a * RAD;
      const ox = -g.dx * Math.cos(th) - g.dy * Math.sin(th);
      const oy = -g.dy * Math.cos(th) + g.dx * Math.sin(th);
      c.px(Math.floor(cx + ox * r), Math.floor(cy + oy * r), S.trim, { x: ox * 0.6, y: -oy * 0.6, z: 0.8 });
    }
  } else if (S.head === 'astral') {
    // An armillary ring round the star: a gold hoop seen at a tilt, a finial above it.
    c.part();
    const px = -g.dy;
    const py = g.dx;
    for (let a = 0; a < 360; a += 12) {
      const th = a * RAD;
      const ox = px * Math.cos(th) * 3.1 + g.dx * Math.sin(th) * 1.3;
      const oy = py * Math.cos(th) * 3.1 + g.dy * Math.sin(th) * 1.3;
      c.px(Math.floor(g.gem.x + ox), Math.floor(g.gem.y + oy), S.trim, { x: Math.cos(th) * 0.5 - 0.2, y: Math.sin(th) * 0.4 + 0.2, z: 0.8 }, { bias: Math.sin(th) > 0 ? 1 : 0 });
    }
    // The shaft's collar where the ring is mounted.
    c.px(Math.round(g.top.x - 0.5), Math.round(g.top.y - 0.5), S.trim, { x: -0.4, y: 0.3, z: 0.85 }, { bias: 1 });
  } else if (S.head === 'fiend') {
    // Two horns rise from the head of the staff and curl in round the flame, over a small skull.
    const px = -g.dy;
    const py = g.dx;
    const at = (side: number, up: number) => ({ x: g.top.x + px * side + g.dx * up, y: g.top.y + py * side + g.dy * up });
    for (const k of [-1, 1]) {
      c.part();
      const a0 = at(k * 1.0, 0.2);
      const a1 = at(k * 2.6, 1.8);
      const a2 = at(k * 2.2, 3.8);
      const a3 = at(k * 1.1, 4.6);
      c.capsule(a0.x, a0.y, a1.x, a1.y, 0.75, 0.62, HORN, { bias: 1 });
      c.capsule(a1.x, a1.y, a2.x, a2.y, 0.62, 0.48, HORN);
      c.capsule(a2.x, a2.y, a3.x, a3.y, 0.48, 0.3, HORN, { bias: 1 });
    }
    c.part();
    const sk = at(0, -0.4);
    c.ellipse(sk.x, sk.y, 1.35, 1.2, HORN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.2, 1) });
    c.px(Math.floor(sk.x - 0.6), Math.floor(sk.y), FEL_EYE, { x: 0, y: 0, z: 1 });
  } else if (S.head === 'grove') {
    // Twigs curl up round the seed from the staff's head, a leaf budding on each.
    const px = -g.dy;
    const py = g.dx;
    const at = (side: number, up: number) => ({ x: g.top.x + px * side + g.dx * up, y: g.top.y + py * side + g.dy * up });
    for (const k of [-1, 1]) {
      c.part();
      const a0 = at(k * 0.6, 0);
      const a1 = at(k * 2.3, 1.7);
      const a2 = at(k * 1.8, 3.8);
      const a3 = at(k * 0.5, 4.6);
      c.capsule(a0.x, a0.y, a1.x, a1.y, 0.6, 0.5, S.shaft, { bias: 1 });
      c.capsule(a1.x, a1.y, a2.x, a2.y, 0.5, 0.38, S.shaft);
      c.capsule(a2.x, a2.y, a3.x, a3.y, 0.38, 0.25, S.shaft, { bias: 1 });
      c.part();
      const leaf = at(k * 3.3, 1.2);
      c.px(leaf.x, leaf.y, S.trim, { x: k * 0.5 - 0.2, y: 0.4, z: 0.8 }, { bias: 1 });
    }
  } else if (S.head === 'cap') {
    return glowcapStaff(c, g, glow);
  } else if (S.head === 'wild') {
    // Two fangs curve up either side of the amber; a feather hangs from a thong below it.
    const px = -g.dy;
    const py = g.dx;
    const at = (side: number, up: number) => ({ x: g.top.x + px * side + g.dx * up, y: g.top.y + py * side + g.dy * up });
    for (const k of [-1, 1]) {
      c.part();
      const a0 = at(k * 0.8, 0.2);
      const a1 = at(k * 2.3, 1.8);
      const a2 = at(k * 1.7, 3.9);
      c.capsule(a0.x, a0.y, a1.x, a1.y, 0.62, 0.5, S.trim, { bias: 1 });
      c.capsule(a1.x, a1.y, a2.x, a2.y, 0.5, 0.25, S.trim);
    }
    c.part();
    const f0 = at(1.3, -0.8);
    const f1 = at(1.9, -3.6);
    c.line(f0.x, f0.y, f1.x, f1.y, S.inner, () => ({ x: 0.3, y: 0.2, z: 0.93 }));
    c.px(f1.x, f1.y, S.trim, { x: 0.2, y: -0.2, z: 0.95 });
  } else if (S.head === 'tide') {
    // Two coral tines curve up round the pearl, a short branch off each; the
    // Abyssal's are bone, and a lure's bulb hangs from a thread below the orb.
    const px = -g.dy;
    const py = g.dx;
    const at = (side: number, up: number) => ({ x: g.top.x + px * side + g.dx * up, y: g.top.y + py * side + g.dy * up });
    const coral = S.coral ?? S.trim;
    for (const k of [-1, 1]) {
      c.part();
      const a0 = at(k * 0.7, 0.1);
      const a1 = at(k * 2.4, 1.6);
      const a2 = at(k * 2.3, 3.6);
      const a3 = at(k * 1.4, 4.9);
      c.capsule(a0.x, a0.y, a1.x, a1.y, 0.62, 0.52, coral, { bias: 1 });
      c.capsule(a1.x, a1.y, a2.x, a2.y, 0.52, 0.42, coral);
      c.capsule(a2.x, a2.y, a3.x, a3.y, 0.42, 0.28, coral, { bias: 1 });
      c.part();
      const nub = at(k * 3.6, 2.9);
      c.px(nub.x, nub.y, coral, { x: k * 0.5 - 0.2, y: 0.5, z: 0.75 }, { bias: 1 });
    }
    // A small shell bound where the tines meet the wood.
    c.part();
    const sh = at(0, -0.9);
    c.ellipse(sh.x, sh.y, 1.2, 1.0, S.shell ?? S.trim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.2, 1) });
  } else if (S.head === 'faerie') {
    // Two cream sepals cup the moonflower bud, and gold leaves unfurl down the slender shaft.
    const px = -g.dy;
    const py = g.dx;
    const at = (side: number, up: number) => ({ x: g.top.x + px * side + g.dx * up, y: g.top.y + py * side + g.dy * up });
    for (const k of [-1, 1]) {
      c.part();
      const a0 = at(k * 0.4, -0.2);
      const a1 = at(k * 1.8, 1.3);
      const a2 = at(k * 1.4, 3.3);
      c.capsule(a0.x, a0.y, a1.x, a1.y, 0.5, 0.62, S.inner, { bias: 1 });
      c.capsule(a1.x, a1.y, a2.x, a2.y, 0.62, 0.3, S.inner, { bias: k < 0 ? 1 : 0 });
    }
    for (const [side, up] of [[1.3, -2.2], [-1.3, -4.6]] as const) {
      c.part();
      const l = at(side, up);
      c.px(l.x, l.y, S.trim, { x: side * 0.4, y: 0.5, z: 0.77 }, { bias: 1 });
    }
  } else if (S.head === 'lotus') {
    // The lotus opening at the staff's head: a petal standing behind the
    // pearl, then two rings of petals curving out round it, the outer ones
    // widest; a green cup beneath where the bloom meets the bamboo.
    const px = -g.dy;
    const py = g.dx;
    const at = (side: number, up: number) => ({ x: g.top.x + px * side + g.dx * up, y: g.top.y + py * side + g.dy * up });
    const petal = S.petal ?? S.trim;
    c.part();
    const b0 = at(0, 0.6);
    const b1 = at(0, 4.9);
    c.capsule(b0.x, b0.y, b1.x, b1.y, 0.95, 0.45, petal, { bias: -1 });
    for (const k of [-1, 1]) {
      c.part();
      const o0 = at(k * 0.8, 0.3);
      const o1 = at(k * 3.0, 2.2);
      const o2 = at(k * 3.4, 3.9);
      c.capsule(o0.x, o0.y, o1.x, o1.y, 0.7, 0.62, petal);
      c.capsule(o1.x, o1.y, o2.x, o2.y, 0.62, 0.3, petal, { bias: 1 });
    }
    for (const k of [-1, 1]) {
      c.part();
      const i0 = at(k * 0.5, 0.2);
      const i1 = at(k * 1.9, 3.3);
      c.capsule(i0.x, i0.y, i1.x, i1.y, 0.8, 0.35, petal, { bias: 1 });
    }
    c.part();
    const cup = at(0, -0.4);
    c.ellipse(cup.x, cup.y, 1.3, 0.9, S.pad ?? S.shaft, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6, 1) });
  } else if (S.head === 'prism') {
    // A silver claw grips the prism's foot: a collar on the ash, and two thin prongs curling up its sides.
    const px = -g.dy;
    const py = g.dx;
    const at = (side: number, up: number) => ({ x: g.top.x + px * side + g.dx * up, y: g.top.y + py * side + g.dy * up });
    for (const k of [-1, 1]) {
      c.part();
      const a0 = at(k * 0.5, 0);
      const a1 = at(k * 2.0, 0.9);
      const a2 = at(k * 2.1, 2.5);
      c.capsule(a0.x, a0.y, a1.x, a1.y, 0.5, 0.45, S.trim, { bias: 1 });
      c.capsule(a1.x, a1.y, a2.x, a2.y, 0.45, 0.28, S.trim, { bias: k < 0 ? 1 : 0 });
    }
    c.part();
    const col = at(0, -0.4);
    c.ellipse(col.x, col.y, 1.1, 0.8, S.trim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6, 1) });
  } else if (S.head === 'firebird') {
    // Three burning plumes fan up behind the ember from a gold cup, the middle
    // one tallest, the outer two curling out; each burns crimson at the quill
    // to gold at the tip.
    const px = -g.dy;
    const py = g.dx;
    const at = (side: number, up: number) => ({ x: g.top.x + px * side + g.dx * up, y: g.top.y + py * side + g.dy * up });
    plumeFeather(c, [at(0, 0.6), at(0, 3.0), at(0.2, 5.4), at(0.9, 6.8)], 0.85, 0.3);
    for (const k of [-1, 1]) plumeFeather(c, [at(k * 0.6, 0.4), at(k * 2.2, 2.0), at(k * 3.0, 4.0), at(k * 2.7, 5.4)], 0.75, 0.25);
    c.part();
    const cup = at(0, -0.3);
    c.ellipse(cup.x, cup.y, 1.5, 1.0, S.trim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6, 1) });
  } else if (S.head === 'siren') {
    // A coral trident: a crossbar at the head of the shaft, two barbed prongs
    // rising either side of the pearl, and the middle one standing tall behind
    // it to a spear point; a shell bound where the coral meets the shaft.
    const px = -g.dy;
    const py = g.dx;
    const at = (side: number, up: number) => ({ x: g.top.x + px * side + g.dx * up, y: g.top.y + py * side + g.dy * up });
    const coral = S.coral ?? S.trim;
    c.part();
    const m0 = at(0, 0);
    const m1 = at(0, 5.4);
    const m2 = at(0, 7.0);
    c.capsule(m0.x, m0.y, m1.x, m1.y, 0.5, 0.45, coral);
    c.capsule(m1.x, m1.y, m2.x, m2.y, 0.6, 0.15, coral, { bias: 1 });
    c.part();
    const b0 = at(-2.1, 0.5);
    const b1 = at(2.1, 0.5);
    c.capsule(b0.x, b0.y, b1.x, b1.y, 0.5, 0.5, coral, { bias: 1 });
    for (const k of [-1, 1]) {
      c.part();
      const p0 = at(k * 2.1, 0.5);
      const p1 = at(k * 2.3, 3.5);
      const p2 = at(k * 2.5, 4.9);
      c.capsule(p0.x, p0.y, p1.x, p1.y, 0.45, 0.4, coral, { bias: k < 0 ? 1 : 0 });
      c.capsule(p1.x, p1.y, p2.x, p2.y, 0.5, 0.15, coral, { bias: 1 });
      const barb = at(k * 3.1, 3.3);
      c.px(barb.x, barb.y, coral, { x: k * 0.5 - 0.2, y: 0.4, z: 0.8 }, { bias: 1 });
    }
    c.part();
    const sh = at(0, -0.9);
    c.ellipse(sh.x, sh.y, 1.2, 1.0, S.shell ?? S.trim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.2, 1) });
  } else if (S.head === 'witch') {
    // Gnarled wood: burls bulging off the shaft, and two crooked twigs curling
    // up round the pumpkin like fingers.
    const px = -g.dy;
    const py = g.dx;
    const at = (side: number, up: number) => ({ x: g.top.x + px * side + g.dx * up, y: g.top.y + py * side + g.dy * up });
    c.part();
    for (const [t, side] of [[0.3, 1], [0.62, -1], [0.85, 1]] as const) {
      const bx = g.bottom.x + (g.top.x - g.bottom.x) * t + px * side * 0.9;
      const by = g.bottom.y + (g.top.y - g.bottom.y) * t + py * side * 0.9;
      c.px(bx, by, S.shaft, { x: side * px * 0.6 - 0.2, y: 0.4, z: 0.8 }, { bias: side < 0 ? 1 : 0 });
    }
    for (const k of [-1, 1]) {
      c.part();
      const a0 = at(k * 0.5, 0);
      const a1 = at(k * 2.0, 0.9);
      const a2 = at(k * 3.0, 2.8);
      const a3 = at(k * 2.2, 4.4);
      c.capsule(a0.x, a0.y, a1.x, a1.y, 0.6, 0.5, S.shaft, { bias: 1 });
      c.capsule(a1.x, a1.y, a2.x, a2.y, 0.5, 0.4, S.shaft);
      c.capsule(a2.x, a2.y, a3.x, a3.y, 0.4, 0.25, S.shaft, { bias: 1 });
    }
    return jackOLantern(c, g.gem.x, g.gem.y, glow);
  } else if (s.float > 0) {
    // Fork cradling the crystal.
    const px = -g.dy;
    const py = g.dx;
    c.px(Math.round(g.top.x + px * 1.2 + g.dx * 0.8 - 0.5), Math.round(g.top.y + py * 1.2 + g.dy * 0.8 - 0.5), S.shaft, { x: -0.6, y: 0.4, z: 0.7 });
    c.px(Math.round(g.top.x - px * 1.2 + g.dx * 0.8 - 0.5), Math.round(g.top.y - py * 1.2 + g.dy * 0.8 - 0.5), S.shaft, { x: 0.6, y: 0.4, z: 0.7 });
  }
  // The idle moment can lift the crystal off the staff to drift on its own
  // (drawn before the body when it passes behind).
  if (free?.behind) return free;
  return crystal(c, free ? free.x : g.gem.x, free ? free.y : g.gem.y, glow);
}

/** The crystal: a small faceted gem, brighter on its upper-left facet. */
function crystal(c: PixelCanvas, gx: number, gy: number, glow: number): { x: number; y: number } {
  if (S.head === 'prism') return prismGem(c, gx, gy, glow);
  c.part();
  const cg = 0.55 + glow * 0.45;
  c.ellipse(gx, gy, 1.55, 2.3, S.crystal, {
    glow: S.crystal.emissive! * cg,
    normal: (_x, _y, dx, dy) => {
      // Faceted: quantise the normal so the gem reads as cut, not round.
      const fx = dx < -0.2 ? -0.7 : dx > 0.2 ? 0.7 : 0;
      const fy = dy < -0.2 ? 0.6 : dy > 0.3 ? -0.6 : 0.1;
      return { x: fx, y: fy, z: 0.7 };
    },
  });
  return { x: gx, y: gy };
}

/**
 * The Prism's prism, where the crystal would be: a triangle of clear glass
 * standing on its base, its two faces toward us meeting at a bright ridge, the
 * one turned to the light paler, its base a darker band.
 */
function prismGem(c: PixelCanvas, gx: number, gy: number, glow: number): { x: number; y: number } {
  c.part();
  const lit = { glow: S.crystal.emissive! * (0.55 + glow * 0.45) };
  const top = gy - 2.9;
  const bot = gy + 1.9;
  const mid = Math.floor(gx);
  for (let y = Math.floor(top); y <= Math.floor(bot); y++) {
    const u = (y + 0.5 - top) / (bot - top);
    if (u < 0 || u > 1.1) continue;
    const hw = 0.5 + Math.min(1, u) * 1.9;
    for (let x = Math.floor(gx - hw); x <= Math.floor(gx + hw); x++) {
      if (Math.abs(x + 0.5 - gx) > hw) continue;
      const base = y === Math.floor(bot);
      const n: Vec3 = base ? { x: 0, y: -0.55, z: 0.83 } : x === mid ? { x: -0.1, y: 0.3, z: 0.95 } : x < mid ? { x: -0.7, y: 0.25, z: 0.67 } : { x: 0.62, y: 0.2, z: 0.76 };
      c.px(x, y, S.crystal, n, { ...lit, bias: x === mid && !base ? 1 : 0 });
    }
  }
  return { x: gx, y: gy };
}

/** A flame feather along a chain of points, quill first: crimson at its root, burning out to gold at its tip. */
function plumeFeather(c: PixelCanvas, pts: { x: number; y: number }[], r0: number, r1: number): void {
  const m = S.plume ?? S.trim;
  c.part();
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const ra = r0 + ((r1 - r0) * i) / n;
    const rb = r0 + ((r1 - r0) * (i + 1)) / n;
    c.capsule(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, ra, rb, m, { bias: Math.round(-1 + (2 * i) / Math.max(1, n - 1)) });
  }
}

/**
 * The Pumpkin Witch's lantern, where the crystal would be: a ribbed pumpkin,
 * lit from within, its carved eyes and grin blazing, a curl of stem on top.
 */
function jackOLantern(c: PixelCanvas, gx: number, gy: number, glow: number): { x: number; y: number } {
  const cg = 0.55 + glow * 0.45;
  c.part();
  c.ellipse(gx, gy, 2.6, 2.1, JACK_RIND, {
    glow: JACK_RIND.emissive! * cg,
    normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.8 - 0.15, 1),
  });
  // The grooves between the lobes, a pixel either side of the middle.
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  for (let y = y0 - 1; y <= y0 + 1; y++) {
    c.shade(x0 - 2, y, -1);
    c.shade(x0 + 1, y, -1);
  }
  // The carving, candle-bright.
  c.part();
  const lit = { glow: 0.7 + glow * 0.3 };
  c.px(x0 - 1, y0 - 1, JACK_FIRE, FLAT_DOWN, lit);
  c.px(x0 + 1, y0 - 1, JACK_FIRE, FLAT_DOWN, lit);
  c.px(x0 - 1, y0 + 1, JACK_FIRE, FLAT_DOWN, lit);
  c.px(x0, y0 + 1, JACK_FIRE, FLAT_DOWN, { ...lit, bias: 1 });
  c.px(x0 + 1, y0 + 1, JACK_FIRE, FLAT_DOWN, lit);
  c.part();
  c.px(x0, y0 - 2, JACK_STEM, { x: -0.3, y: 0.6, z: 0.75 }, { bias: 1 });
  c.px(x0 + 1, y0 - 3, JACK_STEM, { x: 0.3, y: 0.5, z: 0.8 });
  return { x: gx, y: gy };
}

/**
 * Mycelia's staff head, where the crystal would be: the gnarled wood splits
 * into three stems, each topped with a glowcap, the middle one tallest and
 * broadest; two shelf fungi glow on the shaft below. Returns the big cap's
 * heart, where the magic gathers.
 */
function glowcapStaff(c: PixelCanvas, g: ReturnType<typeof staffGeom>, glow: number): { x: number; y: number } {
  const shroom = S.shroom!;
  const px = -g.dy;
  const py = g.dx;
  const at = (side: number, up: number) => ({ x: g.top.x + px * side + g.dx * up, y: g.top.y + py * side + g.dy * up });
  const cg = S.crystal.emissive! * (0.55 + glow * 0.45);
  // Shelf fungi on the shaft: little brackets on either side, lower down.
  for (const [side, up] of [[1.2, -4.6]] as const) {
    c.part();
    const f = at(side, up);
    const f2 = at(side * 1.9, up + 0.3);
    c.px(f.x, f.y, S.crystal, { x: side * 0.3, y: 0.6, z: 0.75 }, { glow: cg * 0.7 });
    c.px(f2.x, f2.y, S.crystal, { x: side * 0.5, y: 0.5, z: 0.7 }, { glow: cg * 0.6, bias: -1 });
  }
  // The stems, the side ones leaning out.
  c.part();
  for (const k of [-1, 1]) {
    const a0 = at(k * 0.5, -0.2);
    const a1 = at(k * 2.3, 1.6);
    c.capsule(a0.x, a0.y, a1.x, a1.y, 0.55, 0.45, shroom.stem, { bias: k < 0 ? 1 : 0 });
  }
  const m0 = at(0, -0.4);
  const m1 = at(0, 2.6);
  c.capsule(m0.x, m0.y, m1.x, m1.y, 0.6, 0.5, shroom.stem, { bias: 1 });
  // The side caps: small domes.
  for (const k of [-1, 1]) {
    c.part();
    const sc = at(k * 2.6, 2.2);
    c.ellipse(sc.x, sc.y, 1.45, 0.95, S.crystal, { glow: cg * 0.85, normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.9 - 0.45, 1) });
  }
  // The crowning cap, broad and domed, a spot or two on it.
  c.part();
  const top = at(0, 3.4);
  c.ellipse(top.x, top.y, 2.6, 1.6, S.crystal, { glow: cg, normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.9 - 0.4, 1) });
  c.part();
  c.px(top.x - 1, top.y - 1, shroom.spot, { x: -0.3, y: 0.6, z: 0.75 }, { glow: 0.9 });
  c.px(top.x + 1, top.y, shroom.spot, { x: 0.3, y: 0.4, z: 0.85 }, { glow: 0.8 });
  return top;
}

function drawTrail(c: PixelCanvas, s: Staff, angles: number[]): void {
  // A sweeping ribbon of light following the crystal around the hand.
  const r = s.len * (1 - s.grip) + s.float + 1.6;
  const n = angles.length;
  for (let k = 0; k < n - 1; k++) {
    const a0 = angles[k];
    const a1 = angles[k + 1];
    const seg = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 7));
    for (let j = 0; j <= seg; j++) {
      const a = (a0 + ((a1 - a0) * j) / seg) * RAD;
      const age = (k + j / seg) / (n - 1); // 0 = oldest, 1 = newest
      const x = s.hx + Math.sin(a) * r;
      const y = s.hy - Math.cos(a) * r;
      const col = age > 0.75 ? S.magic.hot : age > 0.4 ? S.magic.mid : S.magic.deep;
      c.spark(x, y, col, 0.35 + age * 0.65);
      // A thinner inner line gives the ribbon some width.
      if (age > 0.35) {
        const xi = s.hx + Math.sin(a) * (r - 1);
        const yi = s.hy - Math.cos(a) * (r - 1);
        c.spark(xi, yi, S.magic.deep, age * 0.6);
      }
    }
  }
  // Loose sparkles flung off the arc.
  const last = angles[n - 1];
  for (let i = 0; i < 4; i++) {
    const a = (last - 25 - i * 28) * RAD;
    const rr = r + 1.5 + ((i * 7) % 3);
    c.spark(s.hx + Math.sin(a) * rr, s.hy - Math.cos(a) * rr, i % 2 ? S.magic.hot : S.magic.mid, 0.8 - i * 0.15);
  }
}

function drawFlash(c: PixelCanvas, x: number, y: number, f: number): void {
  // Star-shaped burst: bright core, four rays, a faint ring.
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const ray = Math.round(2 + f * 3);
  for (let i = -ray; i <= ray; i++) {
    const a = 1 - Math.abs(i) / (ray + 1);
    c.spark(cx + i, cy, i === 0 ? S.magic.core : S.magic.hot, a * f);
    if (i !== 0) c.spark(cx, cy + i, S.magic.hot, a * f);
  }
  const diag = Math.round(1 + f * 1.5);
  for (let i = 1; i <= diag; i++) {
    const a = (0.6 * f * (diag - i + 1)) / diag;
    c.spark(cx + i, cy + i, S.magic.mid, a);
    c.spark(cx - i, cy + i, S.magic.mid, a);
    c.spark(cx + i, cy - i, S.magic.mid, a);
    c.spark(cx - i, cy - i, S.magic.mid, a);
  }
  c.spark(cx, cy, S.magic.core, 1);
}

function hand(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.ellipse(x, y, 1.2, 1.2, S.skin);
}

function sleeve(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number): void {
  // Wizard sleeves flare toward the cuff.
  c.part();
  const vx = hx - sx;
  const vy = hy - sy;
  const l = Math.hypot(vx, vy) || 1;
  const ex = hx - (vx / l) * 1.3;
  const ey = hy - (vy / l) * 1.3;
  c.capsule(sx, sy, ex, ey, 1.4, 2.0, S.robe);
}

/** Front/back robe body: rows top..hem, flaring toward the hem. */
function robeBody(c: PixelCanvas, cx: number, top: number, hem: number, sway: number): (y: number) => [number, number] {
  const edges = (y: number): [number, number] => {
    const u = (y + 0.5 - top) / (hem + 1 - top);
    const hw = 3.9 + 3.3 * Math.pow(Math.max(0, u), 1.35);
    const x = cx + sway * u * u;
    return [x - hw, x + hw];
  };
  c.part();
  c.shape(top, hem, edges, S.robe, (_x, _y, t, u) => cyl(t, 0.25 - u * 0.25));
  skirtTiers(c, edges, hem, sway);
  hemTrim(c, edges, hem, sway);
  return edges;
}

/**
 * Layered skirts, for the looks that wear them: each band from its `y0` down
 * is repainted in its own cloth, and the cloth above hangs over its top edge
 * in rounded petal tips, every four pixels and drifting with the sway. Titania
 * wears tiers of petals, blush paling to cream; Lotus a jade overskirt over
 * white silk.
 */
function skirtTiers(c: PixelCanvas, edges: (y: number) => [number, number], hem: number, sway: number): void {
  const bands: { y0: number; m: Material; bias: number; overBias: number; phase: number }[] =
    S.head === 'faerie'
      ? [
          { y0: hem - 7, m: S.robe, bias: 1, overBias: 0, phase: 0 },
          { y0: hem - 3, m: S.inner, bias: 0, overBias: 1, phase: 2 },
        ]
      : S.head === 'lotus'
        ? [{ y0: hem - 2, m: S.inner, bias: 1, overBias: 0, phase: 1 }]
        : [];
  let over = S.robe;
  for (const b of bands) {
    c.part();
    for (let y = b.y0; y <= hem; y++) {
      const [l, r] = edges(y);
      for (let x = Math.round(l); x <= Math.round(r) - 1; x++) c.px(x, y, b.m, cyl(((x + 0.5 - l) / (r - l)) * 2 - 1, 0.15 - (y - b.y0) * 0.06), { bias: b.bias });
    }
    // The tier above hangs over this one's top edge.
    c.part();
    const [l, r] = edges(b.y0);
    for (let x = Math.round(l); x <= Math.round(r) - 1; x++) {
      const k = (((x - Math.round(sway) + b.phase) % 4) + 4) % 4;
      if (k === 1 || k === 2) c.px(x, b.y0, over, cyl(((x + 0.5 - l) / (r - l)) * 2 - 1, -0.1), { bias: b.overBias });
    }
    over = b.m;
  }
}

/** Gold trim along the hem, or for the hooded look a ragged, notched hem. */
function hemTrim(c: PixelCanvas, edges: (y: number) => [number, number], hem: number, sway: number): void {
  const [l, r] = edges(hem);
  if (S.head === 'grove') {
    // A hem of leaves: a band, and leaf tips hanging below it that stir with the sway.
    c.part();
    c.shape(hem, hem, () => [l, r], S.trim, (_x, _y, t) => cyl(t, -0.1));
    for (let x = Math.round(l) + 1; x <= Math.round(r) - 2; x++) {
      const k = (((x - Math.round(sway)) % 3) + 3) % 3;
      if (k === 0) c.px(x, hem + 1, S.trim, cyl(0, -0.3));
      else if (k === 2) c.shade(x, hem, -1);
    }
    return;
  }
  if (S.head === 'tide') {
    // The hem breaks in waves: a band of foam with crests curling up off it
    // every few pixels, drifting with the sway so the water seems to roll.
    c.part();
    c.shape(hem, hem, () => [l, r], S.trim, (_x, _y, t) => cyl(t, -0.1));
    for (let x = Math.round(l) + 1; x <= Math.round(r) - 2; x++) {
      const k = (((x - Math.round(sway)) % 4) + 4) % 4;
      if (k === 0) c.px(x, hem - 1, S.trim, cyl(0, 0.5), { bias: 1 });
      else if (k === 1) c.px(x, hem - 1, S.trim, cyl(0, 0.2));
      else if (k === 3) c.shade(x, hem, -1);
    }
    return;
  }
  if (S.head === 'cap') {
    // The hem frills into gills: a glowing band two rows deep, fine dark lines
    // through it like the underside of a mushroom, and soft scallops hanging
    // below that drift with the sway.
    c.part();
    c.shape(hem - 1, hem, edges, S.trim, (_x, _y, t) => cyl(t, -0.35));
    for (let x = Math.round(l); x <= Math.round(r) - 1; x++) {
      const k = (((x - Math.round(sway)) % 3) + 3) % 3;
      if (k === 1) {
        c.shade(x, hem - 1, -1);
        c.shade(x, hem, -1);
      }
      if (k === 0 && x > Math.round(l) && x < Math.round(r) - 1) c.px(x, hem + 1, S.trim, cyl(0, -0.5), { bias: -1 });
    }
    return;
  }
  if (S.head === 'faerie') {
    // Cream petal tips falling below the hem, and a pale one catching the light beside each.
    c.part();
    for (let x = Math.round(l) + 1; x <= Math.round(r) - 2; x++) {
      const k = (((x - Math.round(sway)) % 3) + 3) % 3;
      if (k === 0) c.px(x, hem + 1, S.inner, cyl(0, -0.3));
      else if (k === 1) c.shade(x, hem, 1);
    }
    return;
  }
  if (S.head === 'lotus') {
    // The white silk spills a pixel below the jade, in soft scallops.
    c.part();
    for (let x = Math.round(l) + 1; x <= Math.round(r) - 2; x++) {
      const k = (((x - Math.round(sway)) % 4) + 4) % 4;
      if (k === 1 || k === 2) c.px(x, hem + 1, S.inner, cyl(0, -0.3), { bias: k === 1 ? 0 : -1 });
    }
    return;
  }
  if (S.head === 'prism') {
    // A band of silver, and quartz teeth hanging below it: each a lit facet
    // and a shadowed one, with a gap between, drifting with the sway.
    c.part();
    c.shape(hem, hem, () => [l, r], S.trim, (_x, _y, t) => cyl(t, -0.1));
    const q = S.shard ?? S.trim;
    c.part();
    for (let x = Math.round(l) + 1; x <= Math.round(r) - 2; x++) {
      const k = (((x - Math.round(sway)) % 3) + 3) % 3;
      if (k === 0) c.px(x, hem + 1, q, { x: -0.6, y: -0.1, z: 0.8 }, { bias: 1 });
      else if (k === 1) c.px(x, hem + 1, q, { x: 0.55, y: -0.2, z: 0.8 }, { bias: -1 });
    }
    return;
  }
  if (S.head === 'firebird') {
    // Tail feathers: a row of flame feathers along the hem, quills dark
    // between them, hanging in gold-tipped points that stir with the sway, and
    // fanning out a pixel past the robe at each side like a bird's tail.
    const plume = S.plume ?? S.trim;
    c.part();
    c.shape(hem, hem, () => [l - 1, r + 1], plume, (_x, _y, t) => cyl(t, -0.1), { bias: -1 });
    for (let x = Math.round(l) - 1; x <= Math.round(r); x++) {
      const k = (((x - Math.round(sway)) % 3) + 3) % 3;
      if (k === 0) c.px(x, hem + 1, plume, cyl(0, -0.3), { bias: 1 });
      else if (k === 1) c.px(x, hem + 1, plume, cyl(0, -0.3), { bias: 0 });
      else c.shade(x, hem, -1);
    }
    return;
  }
  if (S.head === 'siren') {
    // The gown flares into fins at the hem: a band of rose fin, ribbed, its
    // lower edge scalloped, and a fin tip sweeping out past each side.
    const fin = S.fin ?? S.trim;
    c.part();
    c.shape(hem - 1, hem, (y) => {
      const [el, er] = edges(y);
      return [el - (y - hem + 1), er + (y - hem + 1)];
    }, fin, (_x, _y, t) => cyl(t, -0.05));
    for (let x = Math.round(l) - 1; x <= Math.round(r); x++) {
      if ((((x - Math.round(sway)) % 2) + 2) % 2 === 0) {
        c.shade(x, hem - 1, -1);
        c.shade(x, hem, -1);
      }
      if ((((x - Math.round(sway)) % 3) + 3) % 3 === 1 && x > Math.round(l) && x < Math.round(r) - 1) c.px(x, hem + 1, fin, cyl(0, -0.3), { bias: -1 });
    }
    c.part();
    for (const [x, b] of [[Math.round(l) - 2, 1], [Math.round(r) + 1, 0]] as const) {
      c.px(x, hem, fin, { x: x < l ? -0.6 : 0.6, y: 0.2, z: 0.77 }, { bias: b });
      c.px(x + (x < l ? -1 : 1), hem + 1, fin, { x: x < l ? -0.6 : 0.6, y: 0, z: 0.8 }, { bias: b + 1 });
    }
    return;
  }
  if (S.head === 'witch') {
    // The witch's robe: an orange stripe a pixel above the rags.
    const [sl, sr] = edges(hem - 1);
    c.part();
    c.shape(hem - 1, hem - 1, () => [sl, sr], S.trim, (_x, _y, t) => cyl(t, -0.1));
  } else if (!S.hooded && S.head !== 'fiend' && S.head !== 'wild') {
    c.part();
    c.shape(hem, hem, () => [l, r], S.trim, (_x, _y, t) => cyl(t, -0.1));
    return;
  }
  // Tatters: points of cloth hanging below the hem every few pixels, darker in
  // the gaps between them. The pattern drifts with the sway, so the rags flutter.
  c.part();
  const x0 = Math.round(l) + 1;
  const x1 = Math.round(r) - 2;
  for (let x = x0; x <= x1; x++) {
    const k = (((x - Math.round(sway)) % 3) + 3) % 3;
    if (k === 0) c.px(x, hem + 1, S.robe, cyl(0, -0.3), { bias: -1 });
    else if (k === 1) c.shade(x, hem, -1);
    // The warlock's rags smoulder: fel embers along the torn edge.
    if (S.head === 'fiend' && k !== 0) c.spark(x, hem, (x + hem) % 2 ? S.magic.mid : S.magic.deep, 0.55);
    // Cinderhide's hide smoulders: embers along its burnt edge.
    if (S.cinder && k === 0 && (x + hem) % 2) c.spark(x, hem + 1, S.magic.mid, 0.5);
    // The witch's rags smoulder faintly violet at the tips.
    if (S.head === 'witch' && k === 0 && (x + hem) % 2) c.spark(x, hem + 1, S.magic.deep, 0.35);
  }
}

function boot(c: PixelCanvas, x: number, y: number, side = false): void {
  c.part();
  if (side) {
    c.ellipse(x, y, 2.2, 1.25, S.boot, { flatten: 0.8 });
  } else {
    c.ellipse(x, y, 1.75, 1.3, S.boot, { flatten: 0.8 });
  }
}

/** Pointed hat. `bend` pushes the tip sideways; `cx` is the base centre. */
function hatCone(c: PixelCanvas, cx: number, tipY: number, baseY: number, baseHW: number, bend: number): void {
  c.part();
  c.shape(
    tipY,
    baseY,
    (y) => {
      const u = (y + 0.5 - tipY) / (baseY + 1 - tipY);
      const hw = 0.55 + (baseHW - 0.55) * Math.pow(u, 1.1);
      const x = cx + bend * Math.pow(1 - u, 2.0);
      return [x - hw, x + hw];
    },
    S.robe,
    (_x, _y, t, u) => cyl(t, 0.45 - u * 0.2),
  );
}

function hatBand(c: PixelCanvas, cx: number, y: number, hw: number): void {
  c.part();
  c.shape(y, y, () => [cx - hw, cx + hw], S.trim, (_x, _y, t) => cyl(t, 0.1));
}

function brim(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number): void {
  c.part();
  c.ellipse(cx, cy, rx, ry, S.robe, {
    normal: (_x, _y, dx, dy) => {
      // A slightly domed disc: mostly facing up, front lip facing us.
      const l = Math.hypot(dx * 0.55, 0.55 - dy * 0.35, 0.75);
      return { x: (dx * 0.55) / l, y: (0.55 - dy * 0.35) / l, z: 0.75 / l };
    },
  });
}

function star(c: PixelCanvas, x: number, y: number): void {
  c.part();
  const n: Vec3 = { x: -0.3, y: 0.4, z: 0.86 };
  if (S.sigil === 'flame') {
    // A little flame: a round base, a hot heart, licking up to a tip that curls right.
    c.px(x - 1, y + 1, S.trim, n);
    c.px(x, y + 1, S.trim, n);
    c.px(x + 1, y + 1, S.trim, n);
    c.px(x - 1, y, S.trim, n);
    c.px(x, y, S.trim, n, { bias: 2 });
    c.px(x, y - 1, S.trim, n, { bias: 1 });
    c.px(x + 1, y - 2, S.trim, n, { bias: 1 });
    return;
  }
  c.px(x, y, S.trim, n, { bias: 1 });
  c.px(x - 1, y, S.trim, n);
  c.px(x + 1, y, S.trim, n);
  c.px(x, y - 1, S.trim, n);
  c.px(x, y + 1, S.trim, n);
}

// ---------------------------------------------------------------------------
// Heads: the classic pointed hat and beard

function beardedHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  // Head: face, sideburns, beard, nose, eyes.
  c.part();
  c.ellipse(cx, 13.4 + U, 3.7, 2.7, S.skin);
  c.part();
  c.shape(12 + U, 14 + U, () => [7.6, 9.2], S.beard ?? BEARD, (_x, _y, t) => cyl(t - 0.6, 0.2));
  c.shape(12 + U, 14 + U, () => [14.8, 16.4], S.beard ?? BEARD, (_x, _y, t) => cyl(t + 0.6, 0.2));
  c.part();
  const bw = [4.3, 4.1, 3.7, 3.1, 2.4, 1.7, 1.0];
  c.shape(14 + U, 20 + U, (y) => {
    const hw = bw[y - 14 - U];
    return [cx - hw, cx + hw];
  }, S.beard ?? BEARD, (_x, _y, t, u) => sphere(t * 0.85, (u - 0.25) * 1.1, 0.9));
  // Strands.
  c.shade(10, 17 + U, -1);
  c.shade(13, 18 + U, -1);
  c.shade(11, 19 + U, -1);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  c.part();
  const [gx, gy] = p.gaze ?? [0, 0];
  if (p.blink) {
    c.px(10 + gx, 13 + U + gy, S.skin, FLAT_DOWN, { bias: -1 });
    c.px(13 + gx, 13 + U + gy, S.skin, FLAT_DOWN, { bias: -1 });
  } else {
    c.px(10 + gx, 13 + U + gy, EYE);
    c.px(13 + gx, 13 + U + gy, EYE);
  }

  // Hat.
  brim(c, cx, 10.7 + U, 8.6, 1.45);
  hatCone(c, cx, 1 + U, 9 + U, 4.9, 3.4 + p.hat);
  hatBand(c, cx, 9 + U, 4.9);
  star(c, 11, 5 + U);
}

function beardedHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  // Back of the head: long hair and beard edges.
  c.part();
  c.ellipse(cx, 13.6 + U, 4.0, 3.0, S.beard ?? HAIR, {
    normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9),
  });
  c.part();
  c.shape(15 + U, 17 + U, (y) => {
    const hw = [3.4, 2.8, 1.8][y - 15 - U];
    return [cx - hw, cx + hw];
  }, S.beard ?? HAIR, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 0.9));
  // Strands of hair.
  c.shade(10, 13 + U, -1);
  c.shade(10, 14 + U, -1);
  c.shade(12, 14 + U, -1);
  c.shade(12, 15 + U, -1);
  c.shade(14, 13 + U, -1);
  c.shade(13, 16 + U, -1);

  brim(c, cx, 10.7 + U, 8.6, 1.45);
  hatCone(c, cx, 1 + U, 9 + U, 4.9, -3.4 - p.hat);
  hatBand(c, cx, 9 + U, 4.9);
}

function beardedHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  // Head: hair at the back, profile face, nose, beard.
  c.part();
  c.ellipse(cx + 1.2, 13.4 + U, 3.3, 2.8, S.beard ?? HAIR, {
    normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 0.9),
  });
  c.part();
  c.ellipse(cx - 1.3, 13.4 + U, 2.8, 2.5, S.skin);
  c.part();
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.px(cx - 5, 14 + U, S.skin, sphere(-0.5, 0.3));
  c.part();
  const bw = [
    [cx - 4.4, cx + 0.6],
    [cx - 4.6, cx + 0.4],
    [cx - 4.6, cx + 0.0],
    [cx - 4.4, cx - 0.6],
    [cx - 4.0, cx - 1.2],
    [cx - 3.6, cx - 1.8],
  ];
  c.shape(14 + U, 19 + U, (y) => bw[y - 14 - U] as [number, number], S.beard ?? BEARD, (_x, _y, t, u) => sphere(t * 0.8 - 0.1, (u - 0.2) * 1.1, 0.9), { bias: 1 });
  c.shade(cx - 3, 17 + U, -1);
  c.shade(cx - 2, 15 + U, -1);
  c.part();
  if (p.blink) c.px(cx - 3, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  else c.px(cx - 3, 13 + U, EYE);

  // Hat: brim, then cone leaning back with the tip flopping behind.
  brim(c, cx - 0.4, 10.7 + U, 8.4, 1.45);
  hatCone(c, cx + 0.6, 1 + U, 9 + U, 4.6, 5.2 + p.hat);
  hatBand(c, cx + 0.6, 9 + U, 4.6);
  star(c, cx, 6 + U);
}

// ---------------------------------------------------------------------------
// Heads: the deep cowl of the hooded look

/** Half-width of the cowl for a row, u = 0 at its peak down to 1 at the shoulders. */
function cowlHW(u: number, full: number): number {
  return 0.6 + (full - 0.6) * Math.sin(Math.min(1, u / 0.62) * (Math.PI / 2));
}

/** Short shoulder cape over the robe, its lower edge cut into points. */
function mantle(c: PixelCanvas, l: number, r: number, U: number, flare: number, sway: number): void {
  const top = 15 + U;
  const bottom = 18 + U;
  const edges = (y: number): [number, number] => {
    const u = (y - top) / (bottom - top);
    return [l - flare * u, r + flare * u];
  };
  c.part();
  c.shape(top, bottom, edges, S.robe, (_x, _y, t, u) => cyl(t, 0.55 - u * 0.4));
  const [bl, br] = edges(bottom);
  for (let x = Math.round(bl) + 1; x < Math.round(br) - 1; x++) {
    if ((((x - sway) % 3) + 3) % 3 === 0) c.px(x, bottom + 1, S.robe, cyl(0, -0.2), { bias: -1 });
  }
  // Light catching the tops of the shoulders.
  c.shade(Math.round(l), top, 1);
  c.shade(Math.round(r) - 1, top, 1);
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  if (blink) return;
  c.part();
  for (const [x, y] of pts) {
    c.px(x, y, VOID_EYE, { x: 0, y: 0, z: 1 });
    c.spark(x, y, S.magic.hot, 0.35);
  }
}

function hoodDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  mantle(c, cx - 5.0, cx + 5.0, U, 1.1, p.hem);
  // Clasp: a silver crescent pin holding the mantle closed.
  c.part();
  c.px(cx - 1, 16 + U, S.trim, { x: -0.4, y: 0.4, z: 0.8 }, { bias: 1 });
  c.px(cx, 17 + U, S.trim, { x: 0.2, y: 0, z: 0.95 });
  c.px(cx - 1, 17 + U, S.trim, { x: -0.3, y: -0.2, z: 0.9 });

  // The cowl, its peak drooping to one side.
  const top = 4 + U;
  const bottom = 16 + U;
  const bend = 1.6 + p.hat;
  c.part();
  c.shape(top, bottom, (y) => {
    const u = (y + 0.5 - top) / (bottom + 1 - top);
    const hw = cowlHW(u, 5.4) - (u > 0.9 ? 0.4 : 0);
    const x = cx + bend * Math.pow(1 - u, 2.2);
    return [x - hw, x + hw];
  }, S.robe, (_x, _y, t, u) => cyl(t, 0.5 - u * 0.4));
  // Folds where the cloth gathers above the face.
  c.shade(cx - 2, 8 + U, -1);
  c.shade(cx + 2, 8 + U, -1);
  c.shade(cx + 1, 7 + U, -1);

  // The opening: a wine-coloured lining around a darkness where only the eyes show.
  c.part();
  c.ellipse(cx, 12.6 + U, 3.6, 3.5, S.inner, {
    normal: (_x, _y, dx, dy) => ({ x: -dx * 0.55, y: dy * 0.45, z: 0.75 }),
  });
  c.part();
  c.ellipse(cx, 13.1 + U, 2.8, 2.9, HOOD_SHADOW, { normal: () => FLAT_DOWN });
  const [gx, gy] = p.gaze ?? [0, 0];
  eyes(c, [[cx - 2 + gx, 12 + U + gy], [cx + 1 + gx, 12 + U + gy]], p.blink);
}

function hoodUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  mantle(c, cx - 5.0, cx + 5.0, U, 1.1, -p.hem);
  const top = 4 + U;
  const bottom = 16 + U;
  const bend = -1.6 - p.hat;
  c.part();
  c.shape(top, bottom, (y) => {
    const u = (y + 0.5 - top) / (bottom + 1 - top);
    const hw = cowlHW(u, 5.4) - (u > 0.9 ? 0.4 : 0);
    const x = cx + bend * Math.pow(1 - u, 2.2);
    return [x - hw, x + hw];
  }, S.robe, (_x, _y, t, u) => cyl(t, 0.45 - u * 0.4));
  // The seam down the back of the hood, and a silver crescent sewn on the mantle.
  for (let y = 8 + U; y <= 15 + U; y++) c.shade(cx, y, -1);
  c.part();
  c.px(cx - 1, 17 + U, S.trim, { x: -0.4, y: 0.3, z: 0.85 }, { bias: 1 });
  c.px(cx, 18 + U, S.trim, { x: 0, y: -0.1, z: 1 });
  c.px(cx + 1, 17 + U, S.trim, { x: 0.4, y: 0.3, z: 0.85 });
}

/** Facing left, like drawSide. */
function hoodSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  mantle(c, cx - 3.8, cx + 3.6, U, 1.0, p.hem);
  const top = 4 + U;
  const bottom = 16 + U;
  // The peak leans back and flops behind him.
  const bend = 2.8 + p.hat;
  c.part();
  c.shape(top, bottom, (y) => {
    const u = (y + 0.5 - top) / (bottom + 1 - top);
    const s = Math.sin(Math.min(1, u / 0.62) * (Math.PI / 2));
    const x = bend * Math.pow(1 - u, 2.2);
    return [cx + x - 0.4 - 4.2 * s, cx + x + 0.4 + 3.8 * s];
  }, S.robe, (_x, _y, t, u) => cyl(t * 0.9 + 0.1, 0.5 - u * 0.4));
  c.shade(cx + 1, 8 + U, -1);
  c.shade(cx + 2, 12 + U, -1);
  c.shade(cx + 2, 13 + U, -1);

  // Opening at the front edge, a sliver of lining around the dark.
  c.part();
  c.ellipse(cx - 3.0, 12.8 + U, 2.0, 3.2, S.inner, {
    normal: (_x, _y, dx, dy) => ({ x: -dx * 0.5, y: dy * 0.45, z: 0.75 }),
  });
  c.part();
  c.ellipse(cx - 3.6, 13.2 + U, 1.4, 2.5, HOOD_SHADOW, { normal: () => FLAT_DOWN });
  eyes(c, [[cx - 4, 12 + U]], p.blink);
}

// ---------------------------------------------------------------------------
// Heads: the Astral's silver hair, circlet, fan collar and crown of stars

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Five small stars in an arc over the head, each twinkling on its own beat. */
function starCrown(c: PixelCanvas, cx: number, y: number, p: Pose, spread = 1): void {
  for (let i = 0; i < 5; i++) {
    const a = (-64 + i * 32) * RAD;
    const x = cx + Math.sin(a) * 5.4 * spread;
    const yy = y - Math.cos(a) * 3.0;
    const k = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(p.glow * 9 + p.staff.float * 2 + i * 2.1));
    c.spark(x, yy, S.magic.core, k);
    if (i === 2) {
      // The middle star is the brightest: four short rays.
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + ox, yy + oy, S.magic.hot, k * 0.65);
    } else c.spark(x, yy + 1, S.magic.deep, k * 0.4);
  }
}

/** The standing fan collar behind the head: its face (lining) toward us, gold along its points. */
function fanCollar(c: PixelCanvas, cx: number, U: number, m: Material): void {
  const top = 9 + U;
  const bottom = 16 + U;
  const edges = (y: number): [number, number] => {
    const u = (y - top) / (bottom - top);
    const hw = 6.3 - 2.1 * u;
    return [cx - hw, cx + hw];
  };
  c.part();
  c.shape(top, bottom, edges, m, (_x, _y, t, u) => sphere(t * 0.7, 0.55 - u * 0.5, 1));
  // Gold edging and four points along the top.
  c.part();
  const [l, r] = edges(top);
  for (let x = Math.round(l); x < Math.round(r); x++) c.px(x, top, S.trim, cyl((x + 0.5 - cx) / 6.3, 0.5));
  for (const x of [6, 9, 14, 17]) c.px(x, top - 1, S.trim, { x: (x - 11.5) * 0.08, y: 0.6, z: 0.8 }, { bias: 1 });
  for (let y = top + 1; y <= top + 3; y++) {
    const [el, er] = edges(y);
    c.px(Math.round(el), y, S.trim, { x: -0.6, y: 0.3, z: 0.75 });
    c.px(Math.round(er) - 1, y, S.trim, { x: 0.6, y: 0.3, z: 0.75 });
  }
}

function astralHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  fanCollar(c, cx, U, S.inner);
  // Long hair behind the face, falling past the shoulders.
  c.part();
  c.shape(10 + U, 18 + U, (y) => {
    const u = (y - 10 - U) / 8;
    const hw = 4.3 - Math.max(0, u - 0.5) * 1.6;
    return [cx - hw, cx + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.3, 0.9));
  c.shade(8, 17 + U, -1);
  c.shade(15, 17 + U, -1);
  // Face.
  c.part();
  c.ellipse(cx, 13.4 + U, 3.1, 2.7, S.skin);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  c.shade(12, 15 + U, -1);
  c.part();
  const gx = p.gaze?.[0] ?? 0;
  if (p.blink) {
    c.px(10 + gx, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
    c.px(13 + gx, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  } else {
    c.px(10 + gx, 13 + U, EYE);
    c.px(13 + gx, 13 + U, EYE);
  }
  // Crown of the head and the fringe, parted in the middle, locks framing the face.
  c.part();
  c.ellipse(cx, 10.6 + U, 3.9, 2.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.5, 1) });
  c.shade(cx, 9 + U, -1);
  for (let y = 12; y <= 17; y++) {
    c.px(8, y + U, hair, cyl(-0.7, 0.1), { bias: y > 15 ? -1 : 0 });
    c.px(15, y + U, hair, cyl(0.7, 0.1), { bias: y > 15 ? -1 : 0 });
  }
  // The circlet, a star-gem at the brow.
  c.part();
  c.shape(11 + U, 11 + U, () => [cx - 3.6, cx + 3.6], S.trim, (_x, _y, t) => cyl(t, 0.15));
  c.part();
  c.px(11, 11 + U, S.crystal, { x: -0.3, y: 0.4, z: 0.86 });
  c.spark(11, 11 + U, S.magic.hot, 0.5 + p.glow * 0.3);
  starCrown(c, cx - 0.5, 8 + U, p);
}

function astralHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  fanCollar(c, cx, U, S.robe);
  c.part();
  c.ellipse(cx, 11.8 + U, 4.0, 3.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 0.9) });
  // Long hair down the back, parting into strands.
  c.part();
  c.shape(13 + U, 20 + U, (y) => {
    const u = (y - 13 - U) / 7;
    const hw = 3.9 - u * 1.6;
    const x = cx - p.hem * u * 0.5;
    return [x - hw, x + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.85, u * 0.7, 0.9));
  for (let y = 13; y <= 20; y++) {
    c.shade(cx - 2, y + U, -1);
    c.shade(cx + 1, y + U, -1);
  }
  c.part();
  c.shape(11 + U, 11 + U, () => [cx - 4.0, cx + 4.0], S.trim, (_x, _y, t) => cyl(t, 0.1));
  starCrown(c, cx - 0.5, 8 + U, p);
}

/** Facing left, like drawSide. */
function astralHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  // The collar stands up behind the neck, gold along its edge.
  c.part();
  c.shape(9 + U, 16 + U, (y) => {
    const u = (y - 9 - U) / 7;
    return [cx + 0.6 + u * 0.4, cx + 4.2 - u * 1.4];
  }, S.inner, (_x, _y, t, u) => cyl(t * 0.7 - 0.2, 0.5 - u * 0.4));
  c.part();
  for (let y = 9; y <= 16; y++) c.px(Math.round(cx + 4.2 - ((y - 9) / 7) * 1.4) - 1, y + U, S.trim, { x: 0.5, y: 0.3, z: 0.8 });
  c.px(cx + 3, 8 + U, S.trim, { x: 0.2, y: 0.6, z: 0.8 }, { bias: 1 });
  // Hair behind, falling long down the back.
  c.part();
  c.ellipse(cx + 0.8, 12.4 + U, 3.4, 3.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9) });
  c.part();
  c.shape(13 + U, 19 + U, (y) => {
    const u = (y - 13 - U) / 6;
    return [cx - 0.4 + u * 0.8 + p.hem * u * 0.4, cx + 3.4 - u * 0.6 + p.hem * u * 0.6];
  }, hair, (_x, _y, t, u) => sphere(t * 0.8 + 0.1, u * 0.7, 0.9));
  c.shade(cx + 1, 16 + U, -1);
  c.shade(cx + 2, 18 + U, -1);
  // Face in profile.
  c.part();
  c.ellipse(cx - 1.3, 13.5 + U, 2.8, 2.5, S.skin);
  c.part();
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.px(cx - 5, 14 + U, S.skin, sphere(-0.5, 0.3));
  c.part();
  if (p.blink) c.px(cx - 3, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  else c.px(cx - 3, 13 + U, EYE);
  // Crown of the head and fringe, then the circlet with its gem at the brow.
  c.part();
  c.shape(9 + U, 10 + U, (y) => (y === 9 + U ? [cx - 3.2, cx + 2.8] : [cx - 4.4, cx + 3.6]), hair, (_x, _y, t, u) => sphere(t * 0.9, u - 0.8, 1));
  c.px(cx - 5, 11 + U, hair, cyl(-0.7, 0.2));
  c.part();
  c.shape(11 + U, 11 + U, () => [cx - 4.4, cx + 2.4], S.trim, (_x, _y, t) => cyl(t * 0.9 - 0.1, 0.15));
  c.part();
  c.px(cx - 4, 11 + U, S.crystal, { x: -0.5, y: 0.4, z: 0.77 });
  c.spark(cx - 4, 11 + U, S.magic.hot, 0.5 + p.glow * 0.3);
  starCrown(c, cx - 0.2, 8 + U, p, 0.75);
}

/** A strewing of stars over the robe: fixed to the cloth, so they ride along with it. */
function starfield(c: PixelCanvas, U: number): void {
  for (let y = 14; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      const m = c.materialAt(x, y);
      if (m !== S.robe && m !== S.inner) continue;
      const h = hash(x, y - U, 11);
      if (h > 0.955) c.spark(x, y, S.magic.core, 0.55);
      else if (h > 0.92) c.spark(x, y, S.magic.mid, 0.3);
    }
  }
}

// ---------------------------------------------------------------------------
// Heads: the Hellfire warlock's horns, demon face and bone-spiked mantle

/** A ram's horn along a chain of points, ridged as it tapers. */
function ramHorn(c: PixelCanvas, pts: [number, number][], r0 = 1.25, r1 = 0.45): void {
  c.part();
  for (let i = 0; i < pts.length - 1; i++) {
    const ra = r0 + ((r1 - r0) * i) / (pts.length - 1);
    const rb = r0 + ((r1 - r0) * (i + 1)) / (pts.length - 1);
    c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], ra, rb, HORN, { bias: i % 2 ? 0 : -1 });
  }
}

function boneSpike(c: PixelCanvas, x: number, y: number, dx: number, dy: number): void {
  c.part();
  c.capsule(x, y, x + dx, y + dy, 0.95, 0.3, HORN, { bias: 1 });
}

function fiendEyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) {
      c.px(x, y, S.skin, FLAT_DOWN, { bias: -1 });
      continue;
    }
    c.px(x, y, FEL_EYE, { x: 0, y: 0, z: 1 });
    c.spark(x, y, S.magic.hot, 0.4);
  }
}

function fiendHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  mantle(c, cx - 5.0, cx + 5.0, U, 1.1, p.hem);
  boneSpike(c, cx - 4.3, 15.8 + U, -1.6, -3.0);
  boneSpike(c, cx + 4.3, 15.8 + U, 1.6, -3.0);
  // A fel clasp at the throat.
  c.part();
  c.px(cx - 1, 16 + U, S.trim, { x: -0.3, y: 0.4, z: 0.86 });
  c.px(cx, 16 + U, S.trim, { x: 0.3, y: 0.4, z: 0.86 });
  // Face, pointed ears, slicked black hair with a widow's peak.
  c.part();
  c.ellipse(cx, 13.1 + U, 3.2, 2.8, S.skin);
  c.part();
  c.px(8, 13 + U, S.skin, sphere(-0.7, 0), { bias: -1 });
  c.px(7, 12 + U, S.skin, sphere(-0.6, -0.4));
  c.px(15, 13 + U, S.skin, sphere(0.7, 0), { bias: -1 });
  c.px(16, 12 + U, S.skin, sphere(0.6, -0.4), { bias: -1 });
  c.part();
  c.shape(9 + U, 11 + U, (y) => {
    const hw = [2.4, 3.3, 3.5][y - 9 - U];
    return [cx - hw, cx + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.9, u - 0.7, 1));
  c.px(11, 12 + U, hair, FLAT_DOWN);
  c.px(12, 12 + U, hair, FLAT_DOWN);
  // Nose and cheekbones.
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.shade(9, 14 + U, -1);
  c.shade(14, 14 + U, -1);
  const [gx, gy] = p.gaze ?? [0, 0];
  fiendEyes(c, [[10 + gx, 13 + U + gy], [13 + gx, 13 + U + gy]], p.blink);
  // A pointed black goatee.
  c.part();
  c.shape(15 + U, 17 + U, (y) => {
    const hw = [1.8, 1.0, 0.6][y - 15 - U];
    return [cx - hw, cx + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
  // The horns sweep out from the temples and curl down at their tips.
  for (const k of [-1, 1]) {
    ramHorn(c, [
      [cx + k * 2.8, 10.2 + U],
      [cx + k * 4.9, 8.8 + U],
      [cx + k * 6.4, 6.8 + U],
      [cx + k * 7.0, 4.6 + U],
      [cx + k * 6.5, 2.8 + U],
    ], 1.35, 0.35);
  }
}

function fiendHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  mantle(c, cx - 5.0, cx + 5.0, U, 1.1, -p.hem);
  boneSpike(c, cx - 4.3, 15.8 + U, -1.6, -3.0);
  boneSpike(c, cx + 4.3, 15.8 + U, 1.6, -3.0);
  c.part();
  c.px(7, 12 + U, S.skin, sphere(-0.6, -0.4), { bias: -1 });
  c.px(16, 12 + U, S.skin, sphere(0.6, -0.4), { bias: -1 });
  c.part();
  c.ellipse(cx, 12.2 + U, 3.7, 3.3, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.shade(cx - 1, 10 + U, 1);
  c.shade(cx, 13 + U, -1);
  c.shade(cx, 14 + U, -1);
  for (const k of [-1, 1]) {
    ramHorn(c, [
      [cx + k * 2.8, 10.2 + U],
      [cx + k * 4.9, 8.8 + U],
      [cx + k * 6.4, 6.8 + U],
      [cx + k * 7.0, 4.6 + U],
      [cx + k * 6.5, 2.8 + U],
    ], 1.35, 0.35);
  }
}

/** Facing left, like drawSide. */
function fiendHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  mantle(c, cx - 3.8, cx + 3.6, U, 1.0, p.hem);
  boneSpike(c, cx + 0.6, 15.8 + U, 1.4, -3.0);
  // The far horn, peeking over the head.
  ramHorn(c, [
    [cx + 1.4, 9.6 + U],
    [cx + 2.8, 7.4 + U],
    [cx + 4.4, 6.6 + U],
  ], 0.9, 0.5);
  c.part();
  c.ellipse(cx + 0.9, 12.3 + U, 3.0, 2.9, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.ellipse(cx - 1.4, 13.3 + U, 2.8, 2.6, S.skin);
  c.part();
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.shade(cx - 3, 14 + U, -1);
  // Hairline sweeping back from the brow.
  c.part();
  c.shape(10 + U, 11 + U, (y) => (y === 10 + U ? [cx - 3.6, cx + 2.4] : [cx - 2.4, cx + 2.8]), hair, (_x, _y, t, u) => sphere(t * 0.9, u - 0.7, 1));
  fiendEyes(c, [[cx - 3, 13 + U]], p.blink);
  // Goatee jutting from the chin.
  c.part();
  c.px(cx - 4, 15 + U, hair, sphere(-0.3, 0.2));
  c.px(cx - 3, 15 + U, hair, sphere(0.2, 0.2), { bias: -1 });
  c.px(cx - 4, 16 + U, hair, sphere(-0.2, 0.4));
  c.px(cx - 5, 17 + U, hair, sphere(-0.4, 0.6), { bias: 1 });
  // The near horn curls back round the pointed ear.
  c.part();
  c.px(cx + 1, 13 + U, S.skin, sphere(0.3, -0.2));
  c.px(cx + 2, 12 + U, S.skin, sphere(0.5, -0.5), { bias: -1 });
  ramHorn(c, [
    [cx - 0.2, 10.4 + U],
    [cx + 1.8, 8.2 + U],
    [cx + 4.0, 7.8 + U],
    [cx + 5.4, 9.6 + U],
    [cx + 4.8, 11.8 + U],
    [cx + 3.2, 12.4 + U],
  ]);
}

/** Fel runes smouldering down the open front of the warlock's robe. */
function felRunes(c: PixelCanvas, x: (y: number) => number, y0: number, y1: number): void {
  for (let y = y0; y <= y1; y++) {
    const k = (y - y0) % 3;
    if (k === 2) continue;
    c.spark(Math.round(x(y)) + (k === 0 ? 0 : -1), y, k === 0 ? S.magic.hot : S.magic.mid, 0.5);
  }
}

// ---------------------------------------------------------------------------
// Heads: the Grovekeeper's hood of moss, antlers and mantle of leaves

/** A mantle over the shoulders, its lower edge a row of leaf points. */
function leafMantle(c: PixelCanvas, l: number, r: number, U: number, flare: number, sway: number): void {
  const top = 15 + U;
  const bottom = 18 + U;
  const edges = (y: number): [number, number] => {
    const u = (y - top) / (bottom - top);
    return [l - flare * u, r + flare * u];
  };
  c.part();
  c.shape(top, bottom, edges, S.robe, (_x, _y, t, u) => cyl(t, 0.55 - u * 0.4));
  // Leaves along the edge: a lit tip hanging below, a lighter leaf on the edge beside it.
  c.part();
  const [bl, br] = edges(bottom);
  for (let x = Math.round(bl); x < Math.round(br); x++) {
    const k = (((x - Math.round(sway)) % 3) + 3) % 3;
    const t = (x + 0.5 - (bl + br) / 2) / ((br - bl) / 2);
    if (k === 0) c.px(x, bottom + 1, S.trim, cyl(t, -0.3));
    else if (k === 1) c.px(x, bottom, S.trim, cyl(t, 0.2), { bias: 1 });
  }
  c.shade(Math.round(l), top, 1);
  c.shade(Math.round(r) - 1, top, 1);
}

/**
 * An antler rooted at (x, y): a beam curving up and out, an inner tine and an
 * outer one. `k` is the way it spreads (-1 left); `s` narrows it (seen from the side).
 */
function antler(c: PixelCanvas, x: number, y: number, k: number, s = 1, bias = 0): void {
  const bone = S.hair ?? ANTLER;
  const at = (dx: number, dy: number) => ({ x: x + k * dx * s, y: y + dy });
  const a = at(0, 0);
  const b = at(1.8, -3.2);
  const tip = at(2.6, -6.2);
  c.part();
  c.capsule(a.x, a.y, b.x, b.y, 0.8, 0.65, bone, { bias });
  c.capsule(b.x, b.y, tip.x, tip.y, 0.65, 0.4, bone, { bias });
  const m = at(1.4, -2.6);
  const inner = at(0.1, -5.3);
  c.capsule(m.x, m.y, inner.x, inner.y, 0.55, 0.35, bone, { bias });
  const o0 = at(2.2, -4.4);
  const o1 = at(4.4, -5.6);
  c.capsule(o0.x, o0.y, o1.x, o1.y, 0.5, 0.35, bone, { bias: bias + 1 });
}

/** A blossom glowing at an antler's tip, breathing with the staff. */
function blossom(c: PixelCanvas, x: number, y: number, p: Pose): void {
  const k = 0.45 + p.glow * 0.4;
  c.spark(x, y, S.magic.core, k);
  c.spark(x + 1, y, S.magic.hot, k * 0.5);
  c.spark(x - 1, y, S.magic.hot, k * 0.5);
  c.spark(x, y - 1, S.magic.mid, k * 0.4);
}

/** The Grovekeeper's hood: round and close, falling to the shoulders. */
function mossHood(c: PixelCanvas, cx: number, U: number, lean: number): void {
  const top = 5 + U;
  const bottom = 16 + U;
  c.part();
  c.shape(top, bottom, (y) => {
    const u = (y + 0.5 - top) / (bottom + 1 - top);
    const hw = cowlHW(u, 5.2) - (u > 0.9 ? 0.4 : 0);
    const x = cx + lean * Math.pow(1 - u, 2.2);
    return [x - hw, x + hw];
  }, S.robe, (_x, _y, t, u) => cyl(t, 0.5 - u * 0.4));
  // Tufts of moss catching the light, and a hollow or two.
  c.shade(cx - 3, 8 + U, 1);
  c.shade(cx + 2, 7 + U, 1);
  c.shade(cx - 1, 6 + U, -1);
  c.shade(cx + 3, 11 + U, -1);
}

function groveHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  leafMantle(c, cx - 5.0, cx + 5.0, U, 1.2, p.hem);
  antler(c, cx - 2.6, 8 + U, -1);
  antler(c, cx + 2.6, 8 + U, 1);
  mossHood(c, cx, U, 0);
  // The opening lined with bark, the face within.
  c.part();
  c.ellipse(cx, 12.8 + U, 3.5, 3.4, S.inner, { normal: (_x, _y, dx, dy) => ({ x: -dx * 0.55, y: dy * 0.45, z: 0.75 }) });
  c.part();
  c.ellipse(cx, 13.4 + U, 2.8, 2.6, S.skin);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  c.shade(12, 15 + U, -1);
  c.part();
  const [gx, gy] = p.gaze ?? [0, 0];
  if (p.blink) {
    c.px(10 + gx, 13 + U + gy, S.skin, FLAT_DOWN, { bias: -1 });
    c.px(13 + gx, 13 + U + gy, S.skin, FLAT_DOWN, { bias: -1 });
  } else {
    c.px(10 + gx, 13 + U + gy, EYE);
    c.px(13 + gx, 13 + U + gy, EYE);
  }
  // A band of young leaves across the brow.
  c.part();
  for (let x = cx - 3; x <= cx + 2; x++) c.px(x, 10 + U, S.trim, cyl((x + 0.5 - cx) / 3.5, 0.4), { bias: x & 1 ? 1 : 0 });
  blossom(c, cx + 7, 2 + U, p);
}

function groveHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  leafMantle(c, cx - 5.0, cx + 5.0, U, 1.2, -p.hem);
  antler(c, cx - 2.6, 8 + U, -1);
  antler(c, cx + 2.6, 8 + U, 1);
  mossHood(c, cx, U, 0);
  // A seam down the back of the hood, and leaves trailing from its point.
  for (let y = 8 + U; y <= 15 + U; y++) c.shade(cx, y, -1);
  c.part();
  c.px(cx - 1, 16 + U, S.trim, cyl(-0.4, 0.2), { bias: 1 });
  c.px(cx, 17 + U, S.trim, cyl(0.2, 0));
  c.px(cx + 1, 16 + U, S.trim, cyl(0.5, 0.2));
  blossom(c, cx - 7, 2 + U, p);
}

/** Facing left, like drawSide. */
function groveHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  leafMantle(c, cx - 3.8, cx + 3.6, U, 1.0, p.hem);
  // The far antler, peeking up behind the near one.
  antler(c, cx + 1.6, 8 + U, 1, 0.8, -1);
  const top = 5 + U;
  const bottom = 16 + U;
  c.part();
  c.shape(top, bottom, (y) => {
    const u = (y + 0.5 - top) / (bottom + 1 - top);
    const s = Math.sin(Math.min(1, u / 0.62) * (Math.PI / 2));
    const x = 1.2 * Math.pow(1 - u, 2.2);
    return [cx + x - 0.4 - 4.2 * s, cx + x + 0.4 + 3.8 * s];
  }, S.robe, (_x, _y, t, u) => cyl(t * 0.9 + 0.1, 0.5 - u * 0.4));
  c.shade(cx + 1, 8 + U, 1);
  c.shade(cx + 2, 12 + U, -1);
  antler(c, cx - 0.6, 8 + U, 1, 0.9);
  // Bark round the opening, the face in profile within.
  c.part();
  c.ellipse(cx - 3.0, 12.8 + U, 2.0, 3.2, S.inner, { normal: (_x, _y, dx, dy) => ({ x: -dx * 0.5, y: dy * 0.45, z: 0.75 }) });
  c.part();
  c.ellipse(cx - 3.4, 13.4 + U, 1.6, 2.4, S.skin);
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.part();
  if (p.blink) c.px(cx - 4, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  else c.px(cx - 4, 13 + U, EYE);
  c.part();
  for (let x = cx - 4; x <= cx - 1; x++) c.px(x, 10 + U, S.trim, cyl((x + 0.5 - cx + 2.5) / 2.5, 0.4), { bias: x & 1 ? 1 : 0 });
  blossom(c, cx + 3, 2 + U, p);
}

/** Leaves caught on the robe near the hem, and fireflies drifting round the Grovekeeper. */
function groveFlecks(c: PixelCanvas, U: number, p: Pose): void {
  for (let y = 22; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      if (c.materialAt(x, y) !== S.robe) continue;
      const h = hash(x, y - U, 23);
      if (h > 0.9 + (28 - y) * 0.012) c.px(x, y, S.trim, cyl(0, 0.2), { bias: h > 0.97 ? 1 : 0 });
    }
  }
  const ph = p.glow * 7 + p.staff.float * 3 + p.breath * 1.3 + p.hem;
  const spots: [number, number][] = [[3.5, 19], [20, 15], [6, 27], [19, 25]];
  spots.forEach(([x, y], i) => {
    const fx = x + Math.sin(ph + i * 2.1) * 1.5;
    const fy = y + Math.cos(ph * 1.3 + i) * 1.5;
    const on = 0.5 + 0.5 * Math.sin(ph * 2 + i * 1.7);
    c.spark(fx, fy, S.magic.hot, 0.35 + on * 0.45);
  });
}

// ---------------------------------------------------------------------------
// Heads: the Shapeshifter's wolf pelt, fur mantle and woad

/** A mantle of grey fur, its lower edge ragged with tufts. */
function furMantle(c: PixelCanvas, l: number, r: number, U: number, flare: number, sway: number): void {
  const pelt = S.hair ?? HAIR;
  const top = 14 + U;
  const bottom = 18 + U;
  const edges = (y: number): [number, number] => {
    const u = (y - top) / (bottom - top);
    return [l - flare * u, r + flare * u];
  };
  c.part();
  c.shape(top, bottom, edges, pelt, (_x, _y, t, u) => cyl(t, 0.55 - u * 0.4));
  const [bl, br] = edges(bottom);
  for (let x = Math.round(bl); x < Math.round(br); x++) {
    const k = (((x - Math.round(sway)) % 3) + 3) % 3;
    if (k === 0) c.px(x, bottom + 1, pelt, cyl(0, -0.3), { bias: -1 });
    if (k === 2) {
      c.shade(x, bottom, -1);
      c.shade(x, bottom - 1, -1);
    }
  }
  c.shade(Math.round(l), top, 1);
  c.shade(Math.round(r) - 1, top, 1);
}

/** The pelt's ears, standing up either side of its skull. */
function wolfEar(c: PixelCanvas, x: number, U: number): void {
  const pelt = S.hair ?? HAIR;
  c.part();
  c.shape(5 + U, 8 + U, (y) => {
    const u = (y - 5 - U) / 3;
    const hw = 0.45 + 1.15 * u;
    return [x - hw, x + hw];
  }, pelt, (_x, _y, t, u) => cyl(t * 0.8, 0.5 - u * 0.3));
  c.part();
  c.px(x - 0.5, 7 + U, S.inner, { x: 0, y: -0.2, z: 0.98 });
}

/** The pelt's eyes, still burning in the colour of the staff's stone. */
function wolfEyes(c: PixelCanvas, pts: [number, number][], p: Pose): void {
  c.part();
  for (const [x, y] of pts) {
    c.px(x, y, S.crystal, { x: 0, y: 0, z: 1 });
    c.spark(x, y, S.magic.hot, 0.35 + p.glow * 0.3);
  }
}

function wildHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const pelt = S.hair ?? HAIR;
  const hair = S.beard ?? HAIR;
  // The idle moment's howl tips her head back (V), and the wolf's head on it
  // further (P), its muzzle turning up to the sky; a shake throws the pelt and
  // her hair sideways. All zero on every other frame.
  const h = p.howl ?? 0;
  const sh = p.shake ?? 0;
  const V = U - (h > 0 ? 1 : 0);
  const P = U - h;
  furMantle(c, cx - 5.2, cx + 5.2, U, 1.3, p.hem);
  // Her hair, falling either side of the face.
  c.part();
  c.shape(11 + U, 17 + U, (y) => {
    const u = (y - 11 - U) / 6;
    const hw = 4.2 - Math.max(0, u - 0.6) * 1.5;
    return [cx - hw + sh * u, cx + hw + sh * u];
  }, hair, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.3, 0.9));
  c.shade(8 + sh, 16 + U, -1);
  c.shade(15 + sh, 16 + U, -1);
  // The face, woad striped under the eyes.
  c.part();
  c.ellipse(cx, 13.7 + V, 2.9, 2.5, S.skin);
  c.part();
  c.px(11, 14 + V, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + V, S.skin, sphere(0.35, -0.2));
  c.shade(12, 15 + V, -1);
  const paint = S.cinder?.paint ?? WOAD;
  c.px(9, 14 + V, paint, FLAT_DOWN);
  c.px(14, 14 + V, paint, FLAT_DOWN);
  // Cinderhide's ash runs across her eyes like a mask.
  if (S.cinder) {
    c.px(9, 13 + V, paint, FLAT_DOWN, { bias: -1 });
    c.px(14, 13 + V, paint, FLAT_DOWN, { bias: -1 });
  }
  c.part();
  const gx = p.gaze?.[0] ?? 0;
  if (p.blink || h > 0) {
    c.px(10 + gx, 13 + V, S.skin, FLAT_DOWN, { bias: -1 });
    c.px(13 + gx, 13 + V, S.skin, FLAT_DOWN, { bias: -1 });
  } else {
    herEye(c, 10 + gx, 13 + V);
    herEye(c, 13 + gx, 13 + V);
  }
  if (h > 0) {
    // The mouth open on the howl: a small o as the head goes back, then wide, the jaw dropped.
    c.part();
    c.px(11, 15 + V, HOOD_SHADOW, FLAT_DOWN);
    if (h > 1) {
      c.px(12, 15 + V, HOOD_SHADOW, FLAT_DOWN);
      c.px(11, 16 + V, HOOD_SHADOW, FLAT_DOWN);
      c.px(12, 16 + V, HOOD_SHADOW, FLAT_DOWN);
      c.px(11, 17 + V, S.skin, sphere(-0.3, 0.7), { bias: -1 });
      c.px(12, 17 + V, S.skin, sphere(0.3, 0.7), { bias: -1 });
    }
  }
  // The wolf's head over her brow: its skull, ears, and the muzzle resting on
  // her forehead. Cinderhide's is the bare skull, charred black, the pelt's
  // ears still standing behind it.
  const skull = !!S.cinder;
  wolfEar(c, cx - 3.3 + sh, P);
  wolfEar(c, cx + 3.3 + sh, P);
  c.part();
  c.ellipse(cx + sh, 9.3 + P, skull ? 4.2 : 4.6, 2.9, skull ? S.trim : pelt, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.4, 1) });
  c.shade(cx - 1 + sh, 7 + P, 1);
  c.shade(cx + sh, 8 + P, -1);
  c.part();
  // Pointing at the sky, the snout stands up past the skull between the ears.
  const my = h > 1 ? 6.5 + P : 11.2 + P - h;
  c.ellipse(cx + sh, my, h > 1 ? 1.6 : skull ? 1.9 : 2.2, h > 1 ? 1.9 : 1.3, skull ? S.trim : MUZZLE, { bias: skull ? 1 : 0, normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.7 - 0.2 - h * 0.25, 1) });
  c.part();
  // Its nose sits at the tip of the muzzle: at the bottom looking at us, on top when it points at the sky.
  const ny = h > 1 ? Math.floor(my) - 1 : Math.floor(my) + (h > 0 ? 0 : 1);
  c.px(11 + sh, ny, skull ? HOOD_SHADOW : WOLF_NOSE, FLAT_DOWN);
  c.px(12 + sh, ny, skull ? HOOD_SHADOW : WOLF_NOSE, FLAT_DOWN);
  if (skull) {
    // Fangs hanging from the skull's jaw over her brow, and a crack of fire across its crown.
    if (h === 0) {
      c.px(10 + sh, 12 + P, S.trim, { x: -0.2, y: 0.2, z: 0.95 }, { bias: 2 });
      c.px(13 + sh, 12 + P, S.trim, { x: 0.2, y: 0.2, z: 0.95 }, { bias: 2 });
    }
    c.px(cx + 1 + sh, 7 + P, S.cinder!.lava, FLAT_DOWN, { glow: 0.6 + p.glow * 0.3 });
    c.px(cx + 2 + sh, 8 + P, S.cinder!.lava, FLAT_DOWN, { glow: 0.5 + p.glow * 0.3 });
    // Its eyes are empty sockets with embers burning deep in them.
    c.px(10 + sh, 9 + P, HOOD_SHADOW, FLAT_DOWN);
    c.px(13 + sh, 9 + P, HOOD_SHADOW, FLAT_DOWN);
  }
  wolfEyes(c, [[9 + sh, 9 + P], [14 + sh, 9 + P]], p);
}

/** Her own eye: plain, or Cinderhide's ember. */
function herEye(c: PixelCanvas, x: number, y: number): void {
  if (!S.cinder) {
    c.px(x, y, EYE);
    return;
  }
  c.px(x, y, S.cinder.lava, { x: 0, y: 0, z: 1 }, { glow: 0.9 });
  c.spark(x, y, S.magic.hot, 0.3);
}

function wildHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const pelt = S.hair ?? HAIR;
  const hair = S.beard ?? HAIR;
  furMantle(c, cx - 5.2, cx + 5.2, U, 1.3, -p.hem);
  c.part();
  c.shape(12 + U, 18 + U, (y) => {
    const u = (y - 12 - U) / 6;
    return [cx - 4.0 + u * 0.8, cx + 4.0 - u * 0.8];
  }, hair, (_x, _y, t, u) => sphere(t * 0.85, u * 0.7, 0.9));
  wolfEar(c, cx - 3.3, U);
  wolfEar(c, cx + 3.3, U);
  c.part();
  c.ellipse(cx, 10.2 + U, 4.6, 3.3, pelt, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  // Cinderhide: the back of the skull's crown shows over the pelt, cracked with fire.
  if (S.cinder) {
    c.part();
    c.ellipse(cx, 8.6 + U, 3.2, 1.8, S.trim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.5, 1) });
    c.px(cx - 1, 8 + U, S.cinder.lava, FLAT_DOWN, { glow: 0.6 + p.glow * 0.3 });
    c.px(cx, 9 + U, S.cinder.lava, FLAT_DOWN, { glow: 0.5 + p.glow * 0.3 });
  }
  // The hide runs down her back to the tail, a darker stripe along its spine.
  const top = 12 + U;
  const tail = 23 + U;
  c.part();
  c.shape(top, tail, (y) => {
    const u = (y - top) / (tail - top);
    const hw = 3.6 - u * 2.6;
    const x = cx - p.hem * u * 0.6;
    return [x - hw, x + hw];
  }, pelt, (_x, _y, t, u) => cyl(t, 0.3 - u * 0.4));
  for (let y = 9 + U; y < tail; y++) c.shade(Math.round(cx - p.hem * Math.max(0, (y - top) / (tail - top)) * 0.6), y, -1);
  c.part();
  // The tail's tip: pale, or on Cinderhide an ember.
  c.px(cx - Math.round(p.hem * 0.6), tail + 1, S.cinder?.lava ?? MUZZLE, cyl(0, -0.2));
}

/** Facing left, like drawSide. */
function wildHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const pelt = S.hair ?? HAIR;
  const hair = S.beard ?? HAIR;
  furMantle(c, cx - 3.9, cx + 3.8, U, 1.1, p.hem);
  // The hide trailing down her back.
  c.part();
  c.shape(11 + U, 21 + U, (y) => {
    const u = (y - 11 - U) / 10;
    return [cx + 0.6 + u * 0.8 + p.hem * u * 0.5, cx + 4.2 - u * 1.4 + p.hem * u * 0.7];
  }, pelt, (_x, _y, t, u) => cyl(t * 0.8 + 0.1, 0.3 - u * 0.4));
  c.part();
  c.ellipse(cx + 0.9, 13.6 + U, 2.8, 2.8, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 0.9) });
  // The face in profile, woad on the cheek.
  c.part();
  c.ellipse(cx - 1.3, 13.9 + U, 2.8, 2.4, S.skin);
  c.part();
  c.px(cx - 5, 14 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  const paint = S.cinder?.paint ?? WOAD;
  c.px(cx - 2, 14 + U, paint, FLAT_DOWN);
  if (S.cinder) c.px(cx - 2, 13 + U, paint, FLAT_DOWN, { bias: -1 });
  c.part();
  if (p.blink) c.px(cx - 3, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  else herEye(c, cx - 3, 13 + U);
  // The wolf's head in profile, its muzzle jutting out over her brow (Cinderhide's a charred skull).
  const skull = !!S.cinder;
  wolfEar(c, cx + 1.6, U);
  c.part();
  c.ellipse(cx + 0.2, 9.6 + U, skull ? 3.7 : 4.0, 2.7, skull ? S.trim : pelt, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 - 0.1, dy * 0.8 - 0.3, 1) });
  c.part();
  c.capsule(cx - 3, 10.6 + U, cx - 6.0, 11.2 + U, skull ? 1.2 : 1.35, skull ? 0.8 : 0.95, skull ? S.trim : MUZZLE, { bias: skull ? 1 : 0 });
  c.part();
  c.px(cx - 7, 11 + U, skull ? HOOD_SHADOW : WOLF_NOSE, FLAT_DOWN);
  if (skull) {
    c.px(cx - 5, 12 + U, S.trim, { x: -0.2, y: 0.2, z: 0.95 }, { bias: 2 });
    c.px(cx - 3, 12 + U, S.trim, { x: -0.1, y: 0.2, z: 0.95 }, { bias: 2 });
    c.px(cx + 1, 8 + U, S.cinder!.lava, FLAT_DOWN, { glow: 0.6 + p.glow * 0.3 });
    c.px(cx - 1, 9 + U, HOOD_SHADOW, FLAT_DOWN);
  }
  wolfEyes(c, [[cx - 2, 9 + U]], p);
}

// ---------------------------------------------------------------------------
// Heads: the Tidecaller's drifting hair, coral crown and shell collar

/** A collar of scallop shells over the shoulders, ridged, the middle two a little higher. */
function shellCollar(c: PixelCanvas, xs: number[], U: number): void {
  const m = S.shell ?? S.trim;
  xs.forEach((x, i) => {
    const mid = i > 0 && i < xs.length - 1;
    const y = (mid ? 16.2 : 16.8) + U;
    c.part();
    c.ellipse(x, y, 1.7, 1.35, m, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.7 - 0.25, 1) });
    // Ridges fanning down from the hinge.
    c.shade(Math.floor(x), Math.floor(y) + 1, -1);
  });
}

/** Coral branching up from a band across the brow, a pearl set at its heart; or, on the Abyssal, a lure. */
function coralCrown(c: PixelCanvas, pts: [number, number][], band: [number, number, number], pearl: [number, number], p: Pose): void {
  const m = S.coral ?? S.trim;
  c.part();
  c.shape(band[2], band[2], () => [band[0], band[1]], m, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  for (const [x, y] of pts) c.px(x, y, m, { x: -0.3, y: 0.5, z: 0.8 }, { bias: (x + y) & 1 ? 1 : 0 });
  c.part();
  c.px(pearl[0], pearl[1], S.crystal, { x: -0.3, y: 0.4, z: 0.86 });
  c.spark(pearl[0], pearl[1], S.magic.hot, 0.45 + p.glow * 0.3);
}

/** The anglerfish's lure: a stalk from the crown of the head, bent over, and a bulb of cold light swinging from it. */
function lure(c: PixelCanvas, pts: [number, number][], bulb: [number, number], p: Pose): void {
  c.part();
  for (const [x, y] of pts) c.px(x, y, S.inner, { x: -0.2, y: 0.6, z: 0.77 }, { bias: 1 });
  c.part();
  const sw = Math.round(p.hat * 0.5);
  c.ellipse(bulb[0] + sw, bulb[1], 1.25, 1.25, LURE);
  const k = 0.55 + p.glow * 0.4;
  c.spark(bulb[0] + sw - 0.5, bulb[1] - 0.5, S.magic.core, k);
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(bulb[0] + sw - 0.5 + ox, bulb[1] - 0.5 + oy, S.magic.mid, k * 0.4);
}

/** Eyes: plain, or on the Abyssal a cold glow like the lure's. */
function tideEyes(c: PixelCanvas, pts: [number, number][], p: Pose): void {
  c.part();
  if (p.blink) {
    for (const [x, y] of pts) c.px(x, y, S.skin, FLAT_DOWN, { bias: -1 });
    return;
  }
  for (const [x, y] of pts) {
    if (S.lure) {
      c.px(x, y, LURE, { x: 0, y: 0, z: 1 });
      c.spark(x, y, S.magic.hot, 0.3);
    } else c.px(x, y, EYE);
  }
}

function tideHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  // Long hair behind the face, drifting outward below the shoulders as if under water.
  c.part();
  c.shape(10 + U, 20 + U, (y) => {
    const u = (y - 10 - U) / 10;
    const hw = 4.3 + Math.max(0, u - 0.45) * 2.2;
    const x = cx + Math.sin(u * 3.2 + p.hem * 0.6) * u * 0.9;
    return [x - hw, x + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.3, 0.9));
  for (let y = 16; y <= 20; y++) {
    c.shade(7 + ((y + Math.round(p.hem)) & 1), y + U, -1);
    c.shade(16 - ((y + Math.round(p.hem)) & 1), y + U, -1);
  }
  shellCollar(c, [cx - 4.6, cx - 1.6, cx + 1.6, cx + 4.6], U);
  // Face.
  c.part();
  c.ellipse(cx, 13.4 + U, 3.1, 2.7, S.skin);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  c.shade(12, 15 + U, -1);
  const gx = p.gaze?.[0] ?? 0;
  tideEyes(c, [[10 + gx, 13 + U], [13 + gx, 13 + U]], p);
  // Crown of the head, the fringe swept aside, wavy locks framing the face.
  c.part();
  c.ellipse(cx, 10.6 + U, 3.9, 2.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.5, 1) });
  c.shade(cx - 1, 10 + U, -1);
  c.shade(cx, 11 + U, 1);
  for (let y = 12; y <= 18; y++) {
    const w = (y + Math.round(p.hem)) % 3 === 0 ? 1 : 0;
    c.px(8 - w, y + U, hair, cyl(-0.7, 0.1), { bias: y > 15 ? -1 : 0 });
    c.px(15 + w, y + U, hair, cyl(0.7, 0.1), { bias: y > 15 ? -1 : 0 });
  }
  if (S.lure) lure(c, [[12, 8 + U], [12, 7 + U], [12, 6 + U], [11, 5 + U], [10, 4 + U], [9, 4 + U], [8, 5 + U]], [8, 7 + U], p);
  else
    coralCrown(
      c,
      [[9, 9 + U], [9, 8 + U], [8, 7 + U], [10, 7 + U], [11, 9 + U], [11, 8 + U], [11, 7 + U], [11, 6 + U], [12, 9 + U], [12, 8 + U], [12, 7 + U], [12, 6 + U], [12, 5 + U], [13, 6 + U], [14, 9 + U], [14, 8 + U], [15, 7 + U]],
      [cx - 3.4, cx + 3.4, 10 + U],
      [11, 10 + U],
      p,
    );
}

function tideHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  shellCollar(c, [cx - 4.6, cx - 1.6, cx + 1.6, cx + 4.6], U);
  c.part();
  c.ellipse(cx, 11.8 + U, 4.0, 3.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 0.9) });
  // The hair falls down the back and fans out, drifting.
  c.part();
  c.shape(13 + U, 22 + U, (y) => {
    const u = (y - 13 - U) / 9;
    const hw = 3.9 + Math.max(0, u - 0.4) * 1.8;
    const x = cx - p.hem * u * 0.5 + Math.sin(u * 3.4 + p.hem * 0.6) * u * 0.9;
    return [x - hw, x + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.85, u * 0.7, 0.9));
  for (let y = 13; y <= 22; y++) {
    const w = Math.round(Math.sin((y - 13) * 0.7 + p.hem) * 0.8);
    c.shade(cx - 2 + w, y + U, -1);
    c.shade(cx + 1 + w, y + U, -1);
  }
  if (S.lure) {
    lure(c, [[12, 8 + U], [12, 7 + U], [12, 6 + U], [13, 5 + U], [14, 4 + U], [15, 4 + U], [16, 5 + U]], [16, 7 + U], p);
  } else {
    // The coral seen from behind: the same branches, the band round the back of the head.
    const m = S.coral ?? S.trim;
    c.part();
    c.shape(10 + U, 10 + U, () => [cx - 3.8, cx + 3.8], m, (_x, _y, t) => cyl(t, 0.1));
    c.part();
    for (const [x, y] of [[9, 9], [9, 8], [8, 7], [11, 9], [11, 8], [11, 7], [11, 6], [12, 9], [12, 8], [12, 7], [12, 6], [12, 5], [10, 7], [13, 6], [14, 9], [14, 8], [15, 7]] as [number, number][]) {
      c.px(x, y + U, m, { x: -0.3, y: 0.5, z: 0.8 }, { bias: -((x + y) & 1) });
    }
  }
}

/** Facing left, like drawSide. */
function tideHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  // Hair behind, falling long down the back and drifting out behind her.
  c.part();
  c.ellipse(cx + 0.8, 12.4 + U, 3.4, 3.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9) });
  c.part();
  c.shape(13 + U, 21 + U, (y) => {
    const u = (y - 13 - U) / 8;
    const drift = p.hem * u * 0.5 + Math.sin(u * 3.2 + p.hem * 0.6) * u * 1.1 + u * 1.2;
    return [cx - 0.4 + u * 0.6 + drift, cx + 3.6 + drift];
  }, hair, (_x, _y, t, u) => sphere(t * 0.8 + 0.1, u * 0.7, 0.9));
  c.shade(cx + 2, 16 + U, -1);
  c.shade(cx + 3, 19 + U, -1);
  shellCollar(c, [cx - 1.8, cx + 1.4], U);
  // Face in profile.
  c.part();
  c.ellipse(cx - 1.3, 13.5 + U, 2.8, 2.5, S.skin);
  c.part();
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.px(cx - 5, 14 + U, S.skin, sphere(-0.5, 0.3));
  tideEyes(c, [[cx - 3, 13 + U]], p);
  // Crown of the head and fringe, a lock falling by the cheek.
  c.part();
  c.shape(9 + U, 10 + U, (y) => (y === 9 + U ? [cx - 3.2, cx + 2.8] : [cx - 4.4, cx + 3.6]), hair, (_x, _y, t, u) => sphere(t * 0.9, u - 0.8, 1));
  c.px(cx - 5, 11 + U, hair, cyl(-0.7, 0.2));
  c.px(cx, 14 + U, hair, cyl(-0.2, 0), { bias: -1 });
  c.px(cx, 15 + U, hair, cyl(-0.2, 0), { bias: -1 });
  if (S.lure) {
    // The stalk arches forward over the brow; the bulb hangs before her face, like the fish's.
    lure(c, [[cx, 8 + U], [cx - 1, 7 + U], [cx - 1, 6 + U], [cx - 2, 5 + U], [cx - 3, 4 + U], [cx - 4, 4 + U], [cx - 5, 4 + U], [cx - 6, 5 + U]], [cx - 6, 7 + U], p);
  } else {
    coralCrown(
      c,
      [[cx - 3, 8 + U], [cx - 4, 7 + U], [cx - 1, 8 + U], [cx - 1, 7 + U], [cx - 1, 6 + U], [cx - 2, 5 + U], [cx, 6 + U], [cx + 1, 8 + U], [cx + 2, 7 + U]],
      [cx - 4.4, cx + 2.2, 9 + U],
      [cx - 4, 9 + U],
      p,
    );
  }
}

/** Bubbles rising round the Tidecaller; on the Abyssal, spots of living light on the robe as well. */
function tideFlecks(c: PixelCanvas, U: number, p: Pose): void {
  if (S.lure) {
    for (let y = 17; y < FRAME_H; y++) {
      for (let x = 0; x < FRAME_W; x++) {
        if (c.materialAt(x, y) !== S.robe) continue;
        const h = hash(x, y - U, 31);
        if (h > 0.955) c.spark(x, y, S.magic.hot, 0.55);
        else if (h > 0.93) c.spark(x, y, S.magic.deep, 0.45);
      }
    }
  }
  const ph = p.glow * 5 + p.staff.float * 2 + p.breath * 1.1 + p.hem * 0.7;
  const spots: [number, number][] = [[3, 27], [20.5, 26], [5, 20], [19, 18]];
  spots.forEach(([x, y], i) => {
    // Each bubble rises and wobbles, then starts again from its spot.
    const rise = ((ph * 1.6 + i * 2.3) % 6 + 6) % 6;
    const bx = x + Math.sin(ph * 2 + i * 1.9) * 0.8;
    const by = y - rise * 1.4;
    const a = 0.55 * (1 - rise / 6) + 0.15;
    c.spark(bx, by, S.magic.hot, a);
    if (i < 2) c.spark(bx + 1, by - 1, S.magic.core, a * 0.45);
  });
}

// ---------------------------------------------------------------------------
// Heads: the Pumpkin Witch's crooked hat, flame-orange hair and glowing eyes

interface WitchHatCfg {
  /** Half-width of the cone at its base. */
  hw: number;
  /** How far the top of the cone leans over, in pixels (negative: to the left). */
  lean: number;
  /** The way the folded tip hangs: -1 left, 1 right. */
  flop: number;
  /** The brim's centre and half-width. */
  brimX: number;
  brimRx: number;
  /** A plum patch sewn on the cone, and the jack-o'-lantern charm hanging off the band (top-left pixels). */
  patch?: [number, number];
  charm?: [number, number];
}

/**
 * The witch's hat: a wide brim, dipping at one end and turned up at the
 * other; a tall cone leaning over, bowed in the middle, with a crease where it
 * bends and its tip folded down; a violet ribbon over an orange band.
 */
function witchHat(c: PixelCanvas, cx: number, U: number, o: WitchHatCfg): void {
  const tipY = 1 + U;
  const baseY = 9 + U;
  const brimY = 10.5 + U;
  c.part();
  c.ellipse(o.brimX, brimY, o.brimRx, 1.7, WITCH_HAT, {
    normal: (_x, _y, dx, dy) => {
      const l = Math.hypot(dx * 0.55, 0.55 - dy * 0.35, 0.75);
      return { x: (dx * 0.55) / l, y: (0.55 - dy * 0.35) / l, z: 0.75 / l };
    },
  });
  const bl = Math.round(o.brimX - o.brimRx);
  const br = Math.round(o.brimX + o.brimRx) - 1;
  c.px(o.flop > 0 ? bl + 1 : br - 1, Math.floor(brimY) + 1, WITCH_HAT, { x: -0.3 * o.flop, y: -0.3, z: 0.9 }, { bias: -1 });
  c.px(o.flop > 0 ? br : bl, Math.floor(brimY) - 1, WITCH_HAT, { x: 0.4 * o.flop, y: 0.6, z: 0.7 }, { bias: 1 });

  // The cone.
  const uOf = (y: number) => (y + 0.5 - tipY) / (baseY + 1 - tipY);
  const mid = (u: number) => cx + o.lean * Math.pow(1 - u, 1.6) + o.flop * 0.8 * Math.sin(u * Math.PI);
  const edges = (y: number): [number, number] => {
    const u = uOf(y);
    const hw = 0.6 + (o.hw - 0.6) * Math.pow(u, 0.85);
    return [mid(u) - hw, mid(u) + hw];
  };
  c.part();
  c.shape(tipY, baseY, edges, WITCH_HAT, (_x, _y, t, u) => cyl(t, 0.45 - u * 0.2));
  // The crease where it bends: a fold in shadow with the lit cloth bunched above it.
  const crease = Math.round(tipY + (baseY - tipY) * 0.42);
  const cm = Math.round(mid(uOf(crease)));
  c.shade(cm - 1, crease, -1);
  c.shade(cm, crease, -1);
  c.shade(cm - 1, crease - 1, 1);
  // The tip, folded over and hanging.
  c.part();
  const tx = mid(0);
  c.capsule(tx, tipY + 0.5, tx + o.flop * 1.6, tipY - 0.2, 0.75, 0.6, WITCH_HAT, { bias: 1 });
  c.capsule(tx + o.flop * 1.6, tipY - 0.2, tx + o.flop * 3.0, tipY + 1.8, 0.6, 0.35, WITCH_HAT);
  if (o.patch) {
    // A square of plum sewn on, a stitch showing at its corner.
    const [x, y] = o.patch;
    c.part();
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) c.px(x + dx, y + U + dy, S.robe, { x: -0.4 + dx * 0.4, y: 0.4, z: 0.82 }, { bias: 1 });
    c.shade(x + 1, y + U, 1);
  }
  // Ribbon and band.
  const [rl, rr] = edges(baseY - 1);
  c.part();
  c.shape(baseY - 1, baseY - 1, () => [rl, rr], WITCH_RIBBON, (_x, _y, t) => cyl(t, 0.2));
  const [nl, nr] = edges(baseY);
  c.part();
  c.shape(baseY, baseY, () => [nl, nr], S.trim, (_x, _y, t) => cyl(t, 0.1));
  if (o.charm) {
    // A tiny jack-o'-lantern hanging from the band, glowing against the brim.
    const [x, y] = o.charm;
    c.part();
    c.px(x, y + U, JACK_STEM, { x: 0, y: 0.5, z: 0.86 });
    c.part();
    c.px(x - 0.5, y + 1 + U, JACK_RIND, sphere(-0.5, -0.3), { bias: 1 });
    c.px(x + 0.5, y + 1 + U, JACK_RIND, sphere(0.5, -0.3));
    c.px(x - 0.5, y + 2 + U, JACK_RIND, sphere(-0.5, 0.4));
    c.px(x + 0.5, y + 2 + U, JACK_RIND, sphere(0.5, 0.4), { bias: -1 });
    c.spark(x - 0.5, y + 1.5 + U, S.magic.hot, 0.45);
  }
}

function witchEyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) {
      c.px(x, y, S.skin, FLAT_DOWN, { bias: -1 });
      continue;
    }
    c.px(x, y, WITCH_EYE, { x: 0, y: 0, z: 1 });
    c.spark(x, y, S.magic.hot, 0.4);
  }
}

function witchHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  // Hair behind the head, then two long curtains falling over the shoulders,
  // flaring toward their ends and swinging with the robe.
  c.part();
  c.ellipse(cx, 12.2 + U, 4.3, 3.2, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9) });
  for (const k of [-1, 1]) {
    c.part();
    c.shape(12 + U, 22 + U, (y) => {
      const u = (y - 12 - U) / 10;
      const inner = 2.4 + u * 1.2;
      const outer = 4.5 + u * 1.7;
      const sw = p.hem * u * 0.6;
      return k < 0 ? [cx - outer + sw, cx - inner + sw] : [cx + inner + sw, cx + outer + sw];
    }, hair, (_x, _y, t, u) => cyl(t * 0.8 + k * 0.25, 0.3 - u * 0.3));
    // Strands down each curtain, and ragged ends.
    for (let y = 15; y <= 22; y++) {
      const u = (y - 12) / 10;
      const x = cx + k * (3.5 + u * 1.45) + p.hem * u * 0.6;
      if ((y + (k > 0 ? 1 : 0)) % 3 !== 0) c.shade(Math.floor(x), y + U, -1);
    }
    c.shade(Math.floor(cx + k * (4.2 + 1.45) + p.hem * 0.6), 22 + U, -1);
  }
  // Face: pale green, a narrow nose, a thin smirk.
  c.part();
  c.ellipse(cx, 13.4 + U, 3.0, 2.6, S.skin);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  c.shade(12, 15 + U, -1);
  c.shade(13, 15 + U, -1);
  const gx = p.gaze?.[0] ?? 0;
  witchEyes(c, [[10 + gx, 13 + U], [13 + gx, 13 + U]], p.blink);
  // The fringe swept to one side under the brim.
  c.part();
  for (const x of [9, 10, 11, 14]) c.px(x, 12 + U, hair, { x: -0.2, y: -0.2, z: 0.95 }, { bias: x === 11 ? -1 : 0 });
  witchHat(c, cx, U, { hw: 4.6, lean: 3.0 + p.hat, flop: 1, brimX: cx, brimRx: 9.6, patch: [9, 6], charm: [8, 9] });
}

function witchHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  c.part();
  c.ellipse(cx, 12.0 + U, 4.2, 3.1, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 0.9) });
  // The hair falls down her back past the shoulders, fanning out and swinging.
  c.part();
  c.shape(13 + U, 23 + U, (y) => {
    const u = (y - 13 - U) / 10;
    const hw = 3.9 + Math.max(0, u - 0.3) * 1.8;
    const x = cx - p.hem * u * 0.6;
    return [x - hw, x + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.85, u * 0.7, 0.9));
  for (let y = 14; y <= 23; y++) {
    const w = Math.round(-p.hem * ((y - 13) / 10) * 0.6);
    c.shade(cx - 2 + w, y + U, -1);
    c.shade(cx + 1 + w, y + U, -1);
    if (y > 18) c.shade(cx - 4 + w, y + U, -1);
  }
  // Ragged ends.
  for (let x = cx - 5; x <= cx + 5; x += 2) c.shade(x - Math.round(p.hem * 0.6), 23 + U, -1);
  witchHat(c, cx, U, { hw: 4.6, lean: -3.0 - p.hat, flop: -1, brimX: cx, brimRx: 9.6 });
}

/** Facing left, like drawSide. */
function witchHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  // Hair behind, falling long down her back and streaming out behind her.
  c.part();
  c.ellipse(cx + 0.8, 12.4 + U, 3.4, 3.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9) });
  c.part();
  c.shape(13 + U, 22 + U, (y) => {
    const u = (y - 13 - U) / 9;
    const drift = p.hem * u * 0.5 + u * 1.5;
    return [cx - 0.4 + u * 0.6 + drift, cx + 3.8 + drift];
  }, hair, (_x, _y, t, u) => sphere(t * 0.8 + 0.1, u * 0.7, 0.9));
  for (let y = 15; y <= 22; y++) if (y % 3) c.shade(Math.round(cx + 1.6 + ((y - 13) / 9) * (1.5 + p.hem * 0.5)), y + U, -1);
  // Face in profile, with a witch's long, pointed nose and chin.
  c.part();
  c.ellipse(cx - 1.3, 13.5 + U, 2.7, 2.5, S.skin);
  c.part();
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.3), { bias: 1 });
  c.px(cx - 5, 14 + U, S.skin, sphere(-0.5, 0.2));
  c.px(cx - 6, 14 + U, S.skin, sphere(-0.8, 0.3));
  c.px(cx - 4, 16 + U, S.skin, sphere(-0.5, 0.6), { bias: -1 });
  c.shade(cx - 4, 15 + U, -1);
  witchEyes(c, [[cx - 3, 13 + U]], p.blink);
  // Fringe under the brim, and a lock by the cheek.
  c.part();
  for (const x of [cx - 4, cx - 3, cx - 1]) c.px(x, 12 + U, hair, { x: -0.3, y: -0.2, z: 0.93 });
  for (let y = 13; y <= 16; y++) c.px(cx, y + U, hair, cyl(-0.2, 0), { bias: y > 14 ? -1 : 0 });
  witchHat(c, cx + 0.6, U, { hw: 4.3, lean: 4.4 + p.hat, flop: 1, brimX: cx - 0.6, brimRx: 9.0, patch: [cx + 1, 6], charm: [cx - 4, 9] });
}

/** Embers and ghost-motes drifting up round the witch, each rising and fading, then starting again. */
function witchFlecks(c: PixelCanvas, p: Pose): void {
  const ph = p.glow * 5 + p.staff.float * 2 + p.breath * 1.1 + p.hem * 0.7;
  const spots: [number, number][] = [[3, 27], [20.5, 25], [4.5, 20], [19.5, 17]];
  spots.forEach(([x, y], i) => {
    const rise = ((ph * 1.4 + i * 2.3) % 6 + 6) % 6;
    const bx = x + Math.sin(ph * 1.7 + i * 2.1) * 0.9;
    const by = y - rise * 1.5;
    const a = 0.6 * (1 - rise / 6) + 0.15;
    if (i % 2 === 0) {
      // An ember: an orange heart, a dimmer spark trailing under it.
      c.spark(bx, by, S.magic.hot, a);
      c.spark(bx, by + 1, S.magic.mid, a * 0.5);
    } else {
      // A ghost-mote: pale green, with a violet haze beneath.
      c.spark(bx, by, WITCH_GHOST, a * 0.9);
      c.spark(bx, by + 1, S.magic.deep, a * 0.5);
    }
  });
}

/** The laced bodice: a dark strip down the front, crossed by two orange ties. */
function witchLacing(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.shape(17 + U, 20 + U, () => [cx - 1, cx + 1], S.inner, (_x, _y, t) => cyl(t * 0.5, 0.1));
  c.part();
  for (const y of [18, 20]) {
    c.px(cx - 1, y + U, S.trim, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
    c.px(cx, y + U, S.trim, { x: 0.3, y: 0.3, z: 0.9 });
  }
}

// ---------------------------------------------------------------------------
// Heads: Titania's honey hair, crown of blossoms and dragonfly wings

/** How far open her wings are; poses that don't say hold them nearly spread. */
const flapOf = (p: Pose) => p.flap ?? 0.85;

/**
 * One wing: a long teardrop from its root at (x0, y0) to its tip at (x1, y1),
 * widest two-thirds of the way out with `w` its half-width there. Lilac at the
 * root paling to pearl at the tip, a vein down its middle, its rim catching a
 * little of her light. `k` is the side it spreads to (-1 left).
 */
function wingLobe(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, w: number, k: number): void {
  const m = S.wing ?? S.inner;
  const vx = x1 - x0;
  const vy = y1 - y0;
  const len = Math.hypot(vx, vy) || 1;
  const ux = vx / len;
  const uy = vy / len;
  c.part();
  for (let y = Math.floor(Math.min(y0, y1) - w - 1); y <= Math.ceil(Math.max(y0, y1) + w + 1); y++) {
    for (let x = Math.floor(Math.min(x0, x1) - w - 1); x <= Math.ceil(Math.max(x0, x1) + w + 1); x++) {
      const ox = x + 0.5 - x0;
      const oy = y + 0.5 - y0;
      const t = (ox * ux + oy * uy) / len;
      if (t < 0 || t > 1) continue;
      const d = -ox * uy + oy * ux;
      const half = w * Math.pow(Math.sin(Math.PI * Math.pow(t, 1.6)), 0.6);
      if (Math.abs(d) > half) continue;
      const vein = Math.abs(d) < 0.5 && t > 0.08 && t < 0.85;
      const rim = Math.abs(d) > half - 0.9 || t > 0.9;
      // The gauze sits in the middle of the ramp, so it reads as see-through
      // lilac; the rim and the tip pale to pearl and catch her light.
      const bias = (t > 0.75 ? 1 : t < 0.25 ? -1 : 0) + (vein ? -1 : 0) + (rim ? 1 : 0);
      c.px(x, y, m, { x: k * 0.15, y: 0.05, z: 0.75 }, { bias });
      if (rim) c.spark(x, y, S.magic.hot, 0.12 + t * 0.2);
      // A wash of other colours across the middle, as on a dragonfly's wing.
      else if (!vein && t > 0.35 && t < 0.7) c.spark(x, y, (x + y) & 1 ? S.magic.mid : IRIDESCENT, 0.16);
    }
  }
}

/** The mint sheen that plays over Titania's wings beside her own pink. */
const IRIDESCENT: RGB = [150, 255, 220];

/**
 * Her wings: two pairs, the upper long and the lower short, rooted between the
 * shoulders. From the front and the back they spread either side of her; in
 * profile both sweep back behind her. Folding (flap 0) draws them in and up.
 */
function faerieWings(c: PixelCanvas, view: 'down' | 'up' | 'side', cx: number, U: number, p: Pose): void {
  const f = flapOf(p);
  if (view === 'side') {
    const rx = cx + 1.6;
    wingLobe(c, rx, 16.4 + U, rx + 4.6 + 3 * f, 7.6 + U + (1 - f) * 2.5, 2.1, 1);
    wingLobe(c, rx, 18.4 + U, rx + 3.6 + 2.2 * f, 24.4 + U - (1 - f) * 1.5, 1.5, 1);
    return;
  }
  for (const k of [-1, 1]) {
    wingLobe(c, cx + k * 1.2, 16.6 + U, cx + k * (4.6 + 4.6 * f), 7.4 + U + (1 - f) * 3, 2.1, k);
    wingLobe(c, cx + k * 1.2, 18.6 + U, cx + k * (3.6 + 3.6 * f), 25 + U - (1 - f) * 1.5, 1.5, k);
  }
}

/** A wreath across the brow: white blossoms with gold hearts, little gold leaves between them. */
function blossomCrown(c: PixelCanvas, blooms: [number, number][], leaves: [number, number][], p: Pose): void {
  const petal = S.petal ?? S.inner;
  c.part();
  for (const [x, y] of leaves) c.px(x, y, S.trim, { x: (x - 12) * 0.08, y: 0.55, z: 0.8 }, { bias: 1 });
  blooms.forEach(([x, y], i) => {
    c.part();
    for (const [ox, oy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) c.px(x + ox, y + oy, petal, sphere(ox * 0.6, oy * 0.6), { bias: oy < 0 || ox < 0 ? 1 : 0 });
    c.px(x, y, S.trim, { x: 0, y: 0.2, z: 0.98 }, { bias: 1 });
    // The blossoms breathe with the staff's light, each on its own beat.
    c.spark(x, y, S.magic.hot, 0.2 + 0.2 * (0.5 + 0.5 * Math.sin(p.glow * 8 + i * 2.2)));
  });
}

/** A rose blush on the cheeks and lips: the gown's cloth lit flat, so it reads as colour, not shape. */
function blush(c: PixelCanvas, pts: [number, number][], lips: [number, number]): void {
  c.part();
  for (const [x, y] of pts) c.px(x, y, S.robe, FLAT_DOWN, { bias: 1 });
  c.px(lips[0], lips[1], S.robe, FLAT_DOWN, { bias: 0 });
}

function faerieHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  // The back of her hair, then two long curtains over the shoulders, down to
  // the waist, swinging with the gown, their ends curling.
  c.part();
  c.ellipse(cx, 12.2 + U, 4.2, 3.2, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9) });
  for (const k of [-1, 1]) {
    c.part();
    c.shape(12 + U, 24 + U, (y) => {
      const u = (y - 12 - U) / 12;
      const inner = 2.7 + u * 1.1;
      const outer = 4.4 + u * 1.3 + (u > 0.85 ? 0.4 : 0);
      const sw = p.hem * u * 0.6 + Math.sin(u * 5 + k) * u * 0.5;
      return k < 0 ? [cx - outer + sw, cx - inner + sw] : [cx + inner + sw, cx + outer + sw];
    }, hair, (_x, _y, t, u) => cyl(t * 0.8 + k * 0.25, 0.3 - u * 0.3));
    for (let y = 15; y <= 24; y++) {
      const u = (y - 12) / 12;
      const x = cx + k * (3.6 + u * 1.2) + p.hem * u * 0.6 + Math.sin(u * 5 + k) * u * 0.5;
      if ((y + (k > 0 ? 1 : 0)) % 3 !== 0) c.shade(Math.floor(x), y + U, -1);
      else c.shade(Math.floor(x) - k, y + U, 1);
    }
  }
  // The neckline: a little skin above the bodice, and a gold drop at the throat.
  c.part();
  c.px(11, 16 + U, S.skin, sphere(-0.2, 0.4));
  c.px(12, 16 + U, S.skin, sphere(0.2, 0.4));
  c.px(11, 17 + U, S.trim, { x: -0.2, y: 0.3, z: 0.93 }, { bias: 1 });
  // Face: soft, with rosy cheeks and lips.
  c.part();
  c.ellipse(cx, 13.4 + U, 3.1, 2.7, S.skin);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  blush(c, [], [12, 15 + U]);
  const [gx, gy] = p.gaze ?? [0, 0];
  c.part();
  if (p.blink) {
    c.px(10 + gx, 13 + U + gy, S.skin, FLAT_DOWN, { bias: -1 });
    c.px(13 + gx, 13 + U + gy, S.skin, FLAT_DOWN, { bias: -1 });
  } else {
    c.px(10 + gx, 13 + U + gy, EYE);
    c.px(13 + gx, 13 + U + gy, EYE);
  }
  // Crown of the head, parted in the middle, and wavy locks framing the face.
  c.part();
  c.ellipse(cx, 10.6 + U, 3.9, 2.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.5, 1) });
  c.shade(cx, 10 + U, -1);
  c.shade(cx - 2, 10 + U, 1);
  for (let y = 12; y <= 16; y++) {
    const w = (y + Math.round(p.hem)) % 3 === 0 ? 1 : 0;
    c.px(8 - w, y + U, hair, cyl(-0.7, 0.1), { bias: y > 14 ? -1 : 0 });
    c.px(15 + w, y + U, hair, cyl(0.7, 0.1), { bias: y > 14 ? -1 : 0 });
  }
  blossomCrown(c, [[9, 9 + U], [12, 8 + U], [15, 9 + U]], [[7, 10 + U], [16, 10 + U]], p);
}

function faerieHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  c.part();
  c.ellipse(cx, 11.8 + U, 4.0, 3.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 0.9) });
  // Her hair falls down her back to the waist over the roots of her wings, fanning and swinging, curling at the ends.
  c.part();
  c.shape(13 + U, 24 + U, (y) => {
    const u = (y - 13 - U) / 11;
    const hw = 3.1 + u * 0.9 - (u > 0.9 ? 0.6 : 0);
    const x = cx - p.hem * u * 0.6;
    return [x - hw, x + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.85, u * 0.7, 0.9));
  for (let y = 14; y <= 24; y++) {
    const u = (y - 13) / 11;
    const w = Math.round(-p.hem * u * 0.6 + Math.sin(y * 0.9) * 0.6);
    c.shade(cx - 2 + w, y + U, -1);
    c.shade(cx + 1 + w, y + U, -1);
    if (y > 17) c.shade(cx - 3 + w, y + U, (y & 1) ? 1 : -1);
  }
  // The curled ends: a lit curl, a dark gap, by turns.
  for (let x = cx - 3; x <= cx + 3; x += 2) c.px(x - Math.round(p.hem * 0.6), 25 + U, hair, cyl((x - cx) / 5, -0.3), { bias: -1 });
  blossomCrown(c, [[9, 10 + U], [12, 9 + U], [15, 10 + U]], [[7, 11 + U], [16, 11 + U]], p);
}

/** Facing left, like drawSide. */
function faerieHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  // Hair behind, falling to the waist and streaming back.
  c.part();
  c.ellipse(cx + 0.8, 12.4 + U, 3.4, 3.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9) });
  c.part();
  c.shape(13 + U, 24 + U, (y) => {
    const u = (y - 13 - U) / 11;
    const drift = p.hem * u * 0.5 + u * 1.2 + Math.sin(u * 5) * u * 0.6;
    return [cx - 0.4 + u * 0.6 + drift, cx + 3.6 + u * 0.3 + drift];
  }, hair, (_x, _y, t, u) => sphere(t * 0.8 + 0.1, u * 0.7, 0.9));
  for (let y = 15; y <= 24; y++) {
    const u = (y - 13) / 11;
    if (y % 3) c.shade(Math.round(cx + 1.6 + u * 1.2 + p.hem * u * 0.5 + Math.sin(u * 5) * u * 0.6), y + U, -1);
  }
  // Face in profile, a rosy cheek.
  c.part();
  c.ellipse(cx - 1.3, 13.5 + U, 2.8, 2.5, S.skin);
  c.part();
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.px(cx - 5, 14 + U, S.skin, sphere(-0.5, 0.3));
  blush(c, [], [cx - 4, 15 + U]);
  c.part();
  if (p.blink) c.px(cx - 3, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  else c.px(cx - 3, 13 + U, EYE);
  // Crown of the head and fringe, a wavy lock by the cheek.
  c.part();
  c.shape(9 + U, 10 + U, (y) => (y === 9 + U ? [cx - 3.2, cx + 2.8] : [cx - 4.4, cx + 3.6]), hair, (_x, _y, t, u) => sphere(t * 0.9, u - 0.8, 1));
  c.px(cx - 5, 11 + U, hair, cyl(-0.7, 0.2));
  for (let y = 13; y <= 16; y++) c.px(cx + ((y + Math.round(p.hem)) % 3 === 0 ? 1 : 0), y + U, hair, cyl(-0.2, 0), { bias: y > 14 ? -1 : 0 });
  blossomCrown(c, [[cx - 3, 9 + U], [cx, 8 + U], [cx + 3, 9 + U]], [[cx - 5, 10 + U]], p);
}

/** Dew glittering on her gown, gold fireflies wandering round her and pollen sifting down past her. */
function faerieFlecks(c: PixelCanvas, U: number, p: Pose): void {
  for (let y = 18; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      const m = c.materialAt(x, y);
      if (m !== S.robe && m !== S.inner) continue;
      if (hash(x, y - U, 37) > 0.965) c.spark(x, y, S.magic.core, 0.4);
    }
  }
  const ph = p.glow * 6 + p.staff.float * 2.5 + p.breath * 1.2 + p.hem * 0.8 + (p.flap ?? 0) * 2;
  const flies: [number, number][] = [[2.5, 18], [21, 14], [4, 27], [20, 25]];
  flies.forEach(([x, y], i) => {
    const fx = x + Math.sin(ph + i * 2.1) * 1.5;
    const fy = y + Math.cos(ph * 1.3 + i) * 1.5;
    const on = 0.5 + 0.5 * Math.sin(ph * 2 + i * 1.7);
    c.spark(fx, fy, S.magic.hot, 0.3 + on * 0.5);
    if (on > 0.8) c.spark(fx, fy - 1, S.magic.core, 0.25);
  });
  [[6, 6], [18, 9], [11, 3]].forEach(([x, y], i) => {
    const fall = ((ph * 1.2 + i * 2.1) % 6 + 6) % 6;
    c.spark(x + Math.sin(ph + i * 1.3) * 0.8, y + fall * 1.7, i === 1 ? S.magic.mid : S.magic.core, 0.4 * (1 - fall / 6) + 0.1);
  });
}

// ---------------------------------------------------------------------------
// Heads: Lotus's high bun and lotus blossom, lily-pad shoulders and crossed collar

/**
 * A lotus seen from the side, its base at (x, y): a shadowed cup, a row of
 * petals and three pointed tips, the middle tallest, glowing faintly within.
 */
function lotusBloom(c: PixelCanvas, x: number, y: number, p: Pose): void {
  const m = S.petal ?? S.trim;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  c.part();
  for (const dx of [-1, 0, 1]) c.px(x0 + dx, y0, m, sphere(dx * 0.5, 0.5), { bias: -1 });
  for (const dx of [-2, -1, 0, 1, 2]) c.px(x0 + dx, y0 - 1, m, sphere(dx * 0.4, 0.1), { bias: dx === 0 ? 1 : Math.abs(dx) === 2 ? -1 : 0 });
  for (const dx of [-2, 0, 2]) c.px(x0 + dx, y0 - 2, m, sphere(dx * 0.3, -0.3), { bias: dx === 0 ? 1 : 0 });
  c.px(x0, y0 - 3, m, sphere(0, -0.6), { bias: 1 });
  c.spark(x0, y0 - 1, S.magic.core, 0.3 + p.glow * 0.2);
}

/** Lily pads over the shoulders: flat, tipped up to the light, a notch toward the neck and veins fanning from it. */
function lilyPads(c: PixelCanvas, pts: [number, number][], cx: number, U: number): void {
  const m = S.pad ?? S.trim;
  for (const [x, y] of pts) {
    c.part();
    c.ellipse(x, y + U, 2.8, 1.5, m, { normal: (_x, _y, dx, dy) => sphere(dx * 0.5, dy * 0.5 - 0.45, 1) });
    const k = x < cx ? 1 : -1;
    const fx = Math.floor(x);
    const fy = Math.floor(y + U);
    // The notch, and veins running out from it.
    c.shade(fx + k * 2, fy, -2);
    c.shade(fx + k, fy, -1);
    c.shade(fx - k, fy - 1, -1);
    c.shade(fx - k, fy + 1, -1);
    // The upturned rim catching the light.
    c.shade(fx, fy - 1, 1);
  }
}

function lotusHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  // Her hair is all drawn up: only a little shows behind the face.
  c.part();
  c.ellipse(cx, 12.0 + U, 4.0, 3.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9) });
  lilyPads(c, [[cx - 4.6, 16.4], [cx + 4.6, 16.4]], cx, U);
  // The robes cross at the throat, white silk over jade, left over right.
  c.part();
  c.px(11, 16 + U, S.skin, sphere(-0.2, 0.4));
  c.px(12, 16 + U, S.skin, sphere(0.2, 0.4));
  c.px(13, 16 + U, S.skin, sphere(0.3, 0.4), { bias: -1 });
  c.px(12, 17 + U, S.skin, sphere(0, 0.5), { bias: -1 });
  c.part();
  for (const [x, y] of [[10, 16], [11, 17], [12, 18], [13, 19]]) c.px(x, y + U, S.inner, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
  for (const [x, y] of [[14, 16], [13, 17]]) c.px(x, y + U, S.inner, { x: 0.3, y: 0.3, z: 0.9 });
  // Face.
  c.part();
  c.ellipse(cx, 13.4 + U, 3.0, 2.7, S.skin);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  c.px(12, 15 + U, S.petal ?? S.skin, FLAT_DOWN, { bias: -1 });
  const gx = p.gaze?.[0] ?? 0;
  tideEyes(c, [[10 + gx, 13 + U], [13 + gx, 13 + U]], p);
  // Her hair, sleek and swept up from the brow, a lock before each ear.
  c.part();
  c.ellipse(cx, 10.4 + U, 3.9, 1.9, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.6, 1) });
  c.shade(10, 10 + U, 1);
  c.shade(14, 10 + U, 1);
  c.shade(cx, 11 + U, -1);
  for (let y = 12; y <= 14; y++) {
    c.px(8, y + U, hair, cyl(-0.7, 0.1), { bias: y > 13 ? -1 : 0 });
    c.px(15, y + U, hair, cyl(0.7, 0.1), { bias: y > 13 ? -1 : 0 });
  }
  lotusBun(c, cx, U, p, 1);
}

/** The high bun, a gold band at its foot, a hairpin through it, and the lotus tucked in on one side (`k`: 1 her left, seen from the front). */
function lotusBun(c: PixelCanvas, cx: number, U: number, p: Pose, k: number): void {
  const hair = S.hair ?? HAIR;
  c.part();
  c.ellipse(cx, 6.8 + U, 2.5, 2.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9, 1) });
  c.shade(cx - 1, 5 + U, 1);
  c.shade(cx + 1, 7 + U, -1);
  c.part();
  c.px(cx - 1, 8 + U, S.trim, { x: -0.3, y: 0.4, z: 0.86 }, { bias: 1 });
  c.px(cx, 8 + U, S.trim, { x: 0.3, y: 0.4, z: 0.86 });
  c.part();
  c.px(cx - k * 3, 5 + U, S.trim, { x: -0.4, y: 0.5, z: 0.77 }, { bias: 1 });
  c.px(cx - k * 4, 4 + U, S.trim, { x: -0.4, y: 0.6, z: 0.7 }, { bias: 1 });
  lotusBloom(c, cx + k * 2.5, 8 + U, p);
}

function lotusHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  lilyPads(c, [[cx - 4.6, 16.4], [cx + 4.6, 16.4]], cx, U);
  // The collar's white silk at the nape.
  c.part();
  c.shape(16 + U, 16 + U, () => [cx - 2.4, cx + 2.4], S.inner, (_x, _y, t) => cyl(t, 0.3));
  c.part();
  c.ellipse(cx, 11.6 + U, 4.0, 3.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 0.9) });
  // The nape, the hair combed up from it to the bun.
  c.part();
  c.shape(14 + U, 15 + U, (y) => (y === 14 + U ? [cx - 2.6, cx + 2.6] : [cx - 1.8, cx + 1.8]), hair, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6 + 0.2, 0.9));
  for (const [x, y, d] of [[10, 12, -1], [14, 12, -1], [11, 10, 1], [13, 13, -1], [12, 9, 1]] as const) c.shade(x, y + U, d);
  lotusBun(c, cx, U, p, -1);
}

/** Facing left, like drawSide. */
function lotusHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  c.part();
  c.ellipse(cx + 0.8, 12.2 + U, 3.3, 2.9, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9) });
  c.part();
  c.shape(14 + U, 15 + U, (y) => (y === 14 + U ? [cx - 0.2, cx + 3.4] : [cx + 0.4, cx + 2.8]), hair, (_x, _y, t, u) => sphere(t * 0.8 + 0.2, u * 0.6 + 0.2, 0.9));
  lilyPads(c, [[cx + 0.8, 16.6]], cx - 4, U);
  // The crossed collar at the throat.
  c.part();
  c.px(cx - 2, 16 + U, S.inner, { x: -0.4, y: 0.3, z: 0.86 }, { bias: 1 });
  c.px(cx - 2, 17 + U, S.inner, { x: -0.4, y: 0.2, z: 0.9 });
  c.px(cx - 1, 18 + U, S.inner, { x: -0.2, y: 0.2, z: 0.95 });
  // Face in profile.
  c.part();
  c.ellipse(cx - 1.3, 13.5 + U, 2.7, 2.5, S.skin);
  c.part();
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.px(cx - 5, 14 + U, S.skin, sphere(-0.5, 0.3));
  c.px(cx - 4, 15 + U, S.petal ?? S.skin, FLAT_DOWN, { bias: -1 });
  tideEyes(c, [[cx - 3, 13 + U]], p);
  // Hair swept back from the brow to the bun, a lock before the ear.
  c.part();
  c.shape(9 + U, 10 + U, (y) => (y === 9 + U ? [cx - 3.0, cx + 2.8] : [cx - 4.2, cx + 3.6]), hair, (_x, _y, t, u) => sphere(t * 0.9, u - 0.8, 1));
  c.shade(cx - 1, 10 + U, 1);
  c.px(cx, 13 + U, hair, cyl(-0.2, 0), { bias: -1 });
  c.px(cx, 14 + U, hair, cyl(-0.2, 0), { bias: -1 });
  // The bun sits high on the back of the head; the lotus on the near side of it.
  c.part();
  c.ellipse(cx + 1.4, 6.9 + U, 2.3, 1.9, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9, 1) });
  c.shade(cx, 6 + U, 1);
  c.part();
  c.px(cx + 1, 9 + U, S.trim, { x: -0.3, y: 0.4, z: 0.86 }, { bias: 1 });
  c.px(cx + 4, 5 + U, S.trim, { x: 0.4, y: 0.5, z: 0.77 }, { bias: 1 });
  c.px(cx + 5, 4 + U, S.trim, { x: 0.4, y: 0.6, z: 0.7 });
  lotusBloom(c, cx - 0.5, 8.6 + U, p);
}

const DRIFT = new Map<WizardLook, Material>();

/** A loose petal: the look's petal colour, glowing a little and drawn without an outline, so it floats light over anything. */
function driftPetal(): Material {
  let m = DRIFT.get(S);
  if (!m) {
    m = { ...(S.petal ?? S.trim), emissive: 0.35, noAO: true, noOutline: true };
    DRIFT.set(S, m);
  }
  return m;
}

/** Pink petals drifting down round her, rocking as they fall, and motes of jade light rising off the water in her hem. */
function lotusFlecks(c: PixelCanvas, p: Pose): void {
  const ph = p.glow * 5 + p.staff.float * 2 + p.breath * 1.1 + p.hem * 0.7;
  const m = driftPetal();
  ([[3.5, 11], [20, 8], [2, 19], [21, 17]] as [number, number][]).forEach(([x, y], i) => {
    const fall = ((ph * 1.1 + i * 2.3) % 6 + 6) % 6;
    const rock = Math.sin(ph * 1.5 + i * 2);
    const px = x + rock * 1.2;
    const py = y + fall * 1.5;
    c.part();
    c.px(px, py, m, { x: rock * 0.5, y: 0.4, z: 0.8 }, { bias: 1 });
    c.px(px + (rock > 0 ? 1 : -1), py + (Math.abs(rock) > 0.6 ? 1 : 0), m, { x: rock * 0.5, y: 0.2, z: 0.9 }, { bias: -1 });
  });
  ([[5, 27], [19, 26]] as [number, number][]).forEach(([x, y], i) => {
    const rise = ((ph * 1.6 + i * 3.1) % 6 + 6) % 6;
    c.spark(x + Math.sin(ph * 2 + i) * 0.7, y - rise * 1.3, S.magic.hot, 0.5 * (1 - rise / 6) + 0.12);
  });
}

// ---------------------------------------------------------------------------
// Heads: Mycelia's toadstool, glowcaps and spores

/**
 * The toadstool: a broad dome from `top` down to its brim at `rim`, `hw` wide
 * either side of `cx` at the brim (`lean` nudges its crown), freckled with
 * glowing spots; with `gills`, the glowing underside shows as a band below the
 * brim, that many pixels either side, scored with fine lines.
 */
function toadstool(c: PixelCanvas, cx: number, top: number, rim: number, hw: number, lean: number, spots: [number, number][], gills: number): void {
  const shroom = S.shroom!;
  c.part();
  c.shape(top, rim, (y) => {
    const u = (y + 0.5 - top) / (rim + 1 - top);
    const w = Math.max(1.4, hw * Math.sqrt(1 - (1 - u) * (1 - u)));
    const x = cx + lean * (1 - u);
    return [x - w, x + w];
  }, shroom.cap, (_x, _y, t, u) => sphere(t * 0.85, u * 1.1 - 0.85, 1));
  // The brim curls under a little: its lowest row a shade darker at the ends.
  c.shade(Math.round(cx - hw), rim, -1);
  c.shade(Math.round(cx + hw) - 1, rim, -1);
  c.part();
  for (const [x, y] of spots) c.px(x, y, shroom.spot, { x: (x - cx) * 0.06, y: 0.55, z: 0.83 });
  if (gills > 0) {
    c.part();
    const y = rim + 1;
    for (let x = Math.round(cx - gills); x <= Math.round(cx + gills) - 1; x++) {
      const t = (x + 0.5 - cx) / gills;
      c.px(x, y, S.trim, { x: t * 0.5, y: -0.5, z: 0.7 }, { bias: (x & 1) === (Math.round(cx) & 1) ? -1 : 0 });
    }
  }
}

/** Little glowcaps sprouting from her shoulders: [x, y of the cap, size 0 small or 1]. */
function shoulderCaps(c: PixelCanvas, caps: [number, number, number][], p: Pose): void {
  const stem = S.shroom!.stem;
  const cg = S.crystal.emissive! * (0.45 + p.glow * 0.3);
  for (const [x, y, big] of caps) {
    c.part();
    c.px(x, y + 1, stem, cyl(0, 0.2));
    if (big) c.px(x, y + 2, stem, cyl(0, 0.1), { bias: -1 });
    c.part();
    for (let ox = -big; ox <= big + 1; ox++) c.px(x - 0.5 + ox, y, S.crystal, { x: ox * 0.4 - 0.1, y: 0.3, z: 0.88 }, { glow: cg, bias: ox === -big ? 1 : 0 });
    if (big) c.px(x, y - 1, S.crystal, { x: -0.2, y: 0.7, z: 0.7 }, { glow: cg, bias: 1 });
  }
}

function capHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  leafMantle(c, cx - 5.0, cx + 5.0, U, 1.2, p.hem);
  // Dark hair to the shoulders, behind the face.
  c.part();
  c.shape(10 + U, 17 + U, (y) => {
    const u = (y - 10 - U) / 7;
    const hw = 4.1 + u * 0.7;
    const sw = p.hem * u * 0.4;
    return [cx - hw + sw, cx + hw + sw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.3, 0.9));
  c.shade(8, 16 + U, -1);
  c.shade(15, 16 + U, -1);
  shoulderCaps(c, [[cx + 4.6, 15.4 + U, 1], [cx + 2.9, 16.6 + U, 0], [cx - 4.4, 16.2 + U, 0]], p);
  // The face, pale as a mushroom's stem.
  c.part();
  c.ellipse(cx, 13.4 + U, 3.0, 2.7, S.skin);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  c.shade(12, 15 + U, -1);
  const [gx, gy] = p.gaze ?? [0, 0];
  c.part();
  if (p.blink) {
    c.px(10 + gx, 13 + U + gy, S.skin, FLAT_DOWN, { bias: -1 });
    c.px(13 + gx, 13 + U + gy, S.skin, FLAT_DOWN, { bias: -1 });
  } else {
    c.px(10 + gx, 13 + U + gy, EYE);
    c.px(13 + gx, 13 + U + gy, EYE);
  }
  // The brim's glow on her brow.
  c.spark(10, 11 + U, S.magic.mid, 0.25);
  c.spark(13, 11 + U, S.magic.mid, 0.25);
  toadstool(c, cx, 2 + U + Math.round(p.hat * 0.3), 9 + U, 7.6, p.hat * 0.5, [[cx - 4, 5 + U], [cx - 3, 5 + U], [cx, 3 + U], [cx + 3, 4 + U], [cx + 5, 7 + U], [cx - 6, 8 + U], [cx + 1, 7 + U]], 6.2);
}

function capHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  leafMantle(c, cx - 5.0, cx + 5.0, U, 1.2, -p.hem);
  // Her hair down her back.
  c.part();
  c.shape(10 + U, 18 + U, (y) => {
    const u = (y - 10 - U) / 8;
    const hw = 4.1 - Math.max(0, u - 0.6) * 1.6;
    const sw = -p.hem * u * 0.5;
    return [cx - hw + sw, cx + hw + sw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.85, u * 0.7, 0.9));
  for (let y = 12; y <= 18; y++) c.shade(cx - 1 + ((y + Math.round(p.hem)) % 3 === 0 ? 1 : 0), y + U, -1);
  shoulderCaps(c, [[cx - 4.6, 15.4 + U, 1], [cx - 2.9, 16.6 + U, 0], [cx + 4.4, 16.2 + U, 0]], p);
  toadstool(c, cx, 2 + U + Math.round(p.hat * 0.3), 9 + U, 7.6, -p.hat * 0.5, [[cx + 3, 5 + U], [cx + 4, 5 + U], [cx - 1, 3 + U], [cx - 4, 4 + U], [cx - 5, 7 + U], [cx + 6, 8 + U], [cx, 6 + U]], 0);
}

/** Facing left, like drawSide. */
function capHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  leafMantle(c, cx - 3.8, cx + 3.6, U, 1.0, p.hem);
  // Hair behind, falling to the shoulders and stirring back.
  c.part();
  c.shape(10 + U, 17 + U, (y) => {
    const u = (y - 10 - U) / 7;
    const d = p.hem * u * 0.4 + u * 0.6;
    return [cx - 1.6 + d, cx + 3.6 + d];
  }, hair, (_x, _y, t, u) => sphere(t * 0.8 + 0.1, u * 0.8 - 0.2, 0.9));
  shoulderCaps(c, [[cx + 2.4, 15.4 + U, 1], [cx + 0.8, 16.4 + U, 0]], p);
  // The face in profile.
  c.part();
  c.ellipse(cx - 2.6, 13.4 + U, 2.0, 2.6, S.skin);
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.part();
  if (p.blink) c.px(cx - 4, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  else c.px(cx - 4, 13 + U, EYE);
  c.spark(cx - 4, 11 + U, S.magic.mid, 0.25);
  // The cap sits a little forward, its brim reaching out over her face.
  toadstool(c, cx - 0.8, 2 + U + Math.round(p.hat * 0.3), 9 + U, 6.8, p.hat * 0.5, [[cx - 4, 5 + U], [cx - 1, 3 + U], [cx + 2, 4 + U], [cx + 4, 7 + U], [cx - 6, 8 + U], [cx, 6 + U]], 5.6);
}

/** Foxfire freckling the robe's lower half, and spores drifting up round her. */
function capFlecks(c: PixelCanvas, U: number, p: Pose): void {
  const spot = S.shroom!.spot;
  c.part();
  for (let y = 23; y < FRAME_H - 3; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      if (c.materialAt(x, y) !== S.robe) continue;
      const h = hash(x, y - U, 41);
      if (h > 0.975 - (y - 23) * 0.004) c.px(x, y, spot, cyl(0, 0.2), { glow: 0.35, bias: h > 0.99 ? 0 : -1 });
    }
  }
  const ph = p.glow * 6 + p.staff.float * 2.5 + p.breath * 1.2 + p.hem * 0.8;
  ([[3, 28], [20.5, 26], [5.5, 22], [18.5, 19]] as [number, number][]).forEach(([x, y], i) => {
    const rise = ((ph * 1.3 + i * 2.7) % 7 + 7) % 7;
    const a = 0.55 * (1 - rise / 7) + 0.1;
    c.spark(x + Math.sin(ph * 1.7 + i * 1.9) * 0.9, y - rise * 1.6, i % 2 ? S.magic.hot : S.magic.core, a);
  });
}

// ---------------------------------------------------------------------------
// Cinderhide's lava cracks

/**
 * Lava cracks through the obsidian pelt (and smouldering low on the hide):
 * a few veins, each starting where the hash picks a spot and zigzagging down
 * a few pixels, now and then forking. Measured on the body (y less the
 * breath), so the same cracks ride with it from frame to frame. Only inside
 * the shape: the edges stay whole, so the silhouette keeps its outline.
 */
function cinderCracks(c: PixelCanvas, U: number, p: Pose): void {
  const lava = S.cinder!.lava;
  const pelt = S.hair;
  const inside = (x: number, y: number): boolean => {
    const m = c.materialAt(x, y);
    if (m !== pelt && m !== lava && (m !== S.robe || y - U < 23)) return false;
    return c.filled(x - 1, y) && c.filled(x + 1, y) && c.filled(x, y - 1) && c.filled(x, y + 1);
  };
  const seeds: [number, number][] = [];
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      const h = hash(x, y - U, 77);
      // Denser on the pelt than on the hide.
      if (h > (c.materialAt(x, y) === pelt ? 0.9 : 0.955) && inside(x, y)) seeds.push([x, y]);
    }
  }
  c.part();
  const lit: [number, number][] = [];
  for (const [sx, sy] of seeds) {
    let x = sx;
    let y = sy;
    const len = 3 + Math.floor(hash(sx, sy - U, 78) * 3);
    for (let i = 0; i < len && inside(x, y); i++) {
      lit.push([x, y]);
      const h = hash(x, y - U, 79 + i);
      // Mostly down, wandering a pixel aside; sometimes a fork off the other way.
      if (h > 0.82 && inside(x + (h > 0.91 ? 1 : -1), y)) lit.push([x + (h > 0.91 ? 1 : -1), y]);
      x += h < 0.3 ? -1 : h > 0.7 ? 1 : 0;
      y += 1;
    }
  }
  for (const [x, y] of lit) {
    // The cracks pulse with the staff's glow, some stretches hotter than others.
    const k = 0.5 + 0.3 * p.glow + 0.2 * hash(x, y - U, 74);
    c.px(x, y, lava, FLAT_DOWN, { glow: k, bias: hash(x, y - U, 75) > 0.55 ? 0 : -1 });
  }
}

// ---------------------------------------------------------------------------
// Heads: the Prism's indigo bob, floating crown of quartz and crystal pauldrons

/**
 * A quartz shard from its foot (x0, y0) to its point (x1, y1), `w` its
 * half-width at the shoulder: two facets either side of a bright ridge, each
 * lit by the way it faces, cut to a sharp point.
 */
function shard(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, w: number): void {
  const m = S.shard ?? S.crystal;
  const vx = x1 - x0;
  const vy = y1 - y0;
  const len = Math.hypot(vx, vy) || 1;
  const ux = vx / len;
  const uy = vy / len;
  c.part();
  for (let y = Math.floor(Math.min(y0, y1) - w - 1); y <= Math.ceil(Math.max(y0, y1) + w + 1); y++) {
    for (let x = Math.floor(Math.min(x0, x1) - w - 1); x <= Math.ceil(Math.max(x0, x1) + w + 1); x++) {
      const ox = x + 0.5 - x0;
      const oy = y + 0.5 - y0;
      const t = (ox * ux + oy * uy) / len;
      if (t < -0.1 || t > 1) continue;
      const d = -ox * uy + oy * ux;
      const half = t < 0.3 ? w * (0.65 + (0.35 * Math.max(0, t)) / 0.3) : (w * (1 - t)) / 0.7;
      if (Math.abs(d) > Math.max(half, t < 0.85 ? 0.5 : 0)) continue;
      const ridge = Math.abs(d) < 0.5;
      // A facet faces square off the shard, toward the side it lies on.
      const s = d < 0 ? -1 : 1;
      const n: Vec3 = ridge ? { x: -0.15, y: 0.25, z: 0.95 } : { x: -uy * s * 0.62, y: -ux * s * 0.62, z: 0.75 };
      c.px(x, y, m, n, { bias: ridge ? 1 : 0 });
    }
  }
}

/** Five quartz shards hovering over the head in an arc, the middle one tallest, each bobbing on its own beat and splitting off a colour. */
function shardCrown(c: PixelCanvas, cx: number, y: number, p: Pose, spread = 1): void {
  const ph = p.glow * 7 + p.staff.float * 2 + p.breath * 2.3 + p.hat * 1.3;
  const shards: [number, number, number][] = [[-60, 2.6, 0.8], [-30, 3.6, 0.95], [0, 4.8, 1.15], [30, 3.6, 0.95], [60, 2.6, 0.8]];
  shards.forEach(([deg, len, w], i) => {
    const a = deg * RAD;
    const bob = Math.round(Math.sin(ph + i * 1.9) * 0.7);
    const bx = cx + Math.sin(a) * 4.5 * spread;
    const by = y + (1 - Math.cos(a)) * 2.6 + bob;
    shard(c, bx, by, bx + Math.sin(a) * len * 0.45 * spread, by - len, w);
    c.spark(bx + Math.sin(a) * len * 0.2 - 0.5, by - len * 0.45, SPECTRUM[(i + Math.round(ph)) % SPECTRUM.length], 0.35 + p.glow * 0.25);
  });
}

/** Quartz on a shoulder at (x, U-relative 17): a long shard leaning out (`k`: the way out) and a short one beside it. */
function quartzPauldron(c: PixelCanvas, x: number, U: number, k: number, lean = 1): void {
  shard(c, x - k * 0.6, 17.0 + U, x - k * 0.3, 14.9 + U, 0.8);
  shard(c, x + k * 0.5, 17.4 + U, x + k * 2.2 * lean, 14.1 + U, 1.15);
  // A colour caught in the long shard, so the quartz reads against the pale robe.
  c.spark(x + k * 1.4 * lean, 15.6 + U, SPECTRUM[k < 0 ? 4 : 1], 0.5);
}

/** The Prism's eyes: plain, a pale glint of the prism's light in them. */
function prismEyes(c: PixelCanvas, pts: [number, number][], p: Pose): void {
  c.part();
  for (const [x, y] of pts) {
    if (p.blink) c.px(x, y, S.skin, FLAT_DOWN, { bias: -1 });
    else c.px(x, y, EYE);
  }
}

function prismHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  // The bob behind the face, cut straight at the jaw.
  c.part();
  c.ellipse(cx, 11.6 + U, 4.4, 3.2, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9) });
  c.shape(12 + U, 15 + U, () => [cx - 4.6, cx + 4.6], hair, (_x, _y, t, u) => cyl(t * 0.9, 0.2 - u * 0.4));
  // A quartz brooch at the throat.
  c.part();
  c.px(cx - 1, 16 + U, S.shard ?? S.crystal, { x: -0.5, y: 0.4, z: 0.77 }, { bias: 1 });
  c.px(cx, 16 + U, S.shard ?? S.crystal, { x: 0.5, y: 0.3, z: 0.8 });
  // Face.
  c.part();
  c.ellipse(cx, 13.4 + U, 3.0, 2.7, S.skin);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  c.shade(12, 15 + U, -1);
  const [gx, gy] = p.gaze ?? [0, 0];
  prismEyes(c, [[10 + gx, 13 + U + gy], [13 + gx, 13 + U + gy]], p);
  // The crown of the head, sleek, a band of light across it; blunt bangs straight over the brow.
  c.part();
  c.ellipse(cx, 10.4 + U, 4.2, 2.1, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.5, 1) });
  c.shade(10, 9 + U, 1);
  c.shade(11, 9 + U, 1);
  c.shape(11 + U, 11 + U, () => [cx - 3.5, cx + 3.5], hair, (_x, _y, t) => cyl(t * 0.8, -0.25));
  c.shade(10, 11 + U, -1);
  c.shade(13, 11 + U, -1);
  // The sides of the bob before the cheeks, the ends turning in at the jaw.
  for (let y = 12; y <= 15; y++) {
    c.px(8, y + U, hair, cyl(-0.6, 0.1), { bias: y === 15 ? -1 : 0 });
    c.px(15, y + U, hair, cyl(0.6, 0.1), { bias: y === 15 ? -1 : 0 });
  }
  c.px(9, 15 + U, hair, cyl(-0.3, -0.3), { bias: -1 });
  c.px(14, 15 + U, hair, cyl(0.3, -0.3), { bias: -1 });
  quartzPauldron(c, 7.6, U, -1);
  quartzPauldron(c, 16.4, U, 1);
  shardCrown(c, cx, 7.0 + U, p);
}

function prismHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  c.part();
  c.ellipse(cx, 11.4 + U, 4.4, 3.3, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 0.9) });
  c.shape(12 + U, 15 + U, () => [cx - 4.6, cx + 4.6], hair, (_x, _y, t, u) => cyl(t * 0.9, 0.2 - u * 0.4));
  // A sheen across the back of the head, strands falling to the blunt ends.
  c.shade(10, 9 + U, 1);
  c.shade(11, 9 + U, 1);
  c.shade(13, 9 + U, 1);
  for (let y = 12; y <= 15; y++) {
    c.shade(cx - 2, y + U, -1);
    c.shade(cx + 1, y + U, -1);
  }
  for (let x = 7; x <= 16; x += 2) c.shade(x, 15 + U, -1);
  quartzPauldron(c, 7.6, U, -1);
  quartzPauldron(c, 16.4, U, 1);
  shardCrown(c, cx, 7.0 + U, p);
}

/** Facing left, like drawSide. */
function prismHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  quartzPauldron(c, cx + 1.6, U, 1, 0.6);
  c.part();
  c.ellipse(cx + 0.8, 12.0 + U, 3.6, 3.1, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9) });
  c.shape(12 + U, 15 + U, () => [cx - 0.6, cx + 4.4], hair, (_x, _y, t, u) => cyl(t * 0.8 + 0.2, 0.2 - u * 0.4));
  c.shade(cx + 2, 13 + U, -1);
  c.shade(cx + 2, 14 + U, -1);
  // Face in profile.
  c.part();
  c.ellipse(cx - 1.3, 13.5 + U, 2.7, 2.5, S.skin);
  c.part();
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.px(cx - 5, 14 + U, S.skin, sphere(-0.5, 0.3));
  prismEyes(c, [[cx - 3, 13 + U]], p);
  // Crown of the head, the bangs cut straight over the brow, and the bob's side before the ear.
  c.part();
  c.shape(9 + U, 10 + U, (y) => (y === 9 + U ? [cx - 3.0, cx + 3.0] : [cx - 4.3, cx + 3.8]), hair, (_x, _y, t, u) => sphere(t * 0.9, u - 0.8, 1));
  c.shade(cx - 1, 9 + U, 1);
  c.shape(11 + U, 11 + U, () => [cx - 4.6, cx - 0.4], hair, (_x, _y, t) => cyl(t * 0.8 - 0.2, -0.25));
  for (let y = 12; y <= 15; y++) c.px(cx, y + U, hair, cyl(-0.3, 0), { bias: y === 15 ? -1 : 0 });
  c.px(cx - 1, 15 + U, hair, cyl(-0.4, -0.3), { bias: -1 });
  shardCrown(c, cx - 0.3, 7.0 + U, p, 0.7);
}

/**
 * Light splitting along the Prism's edges: where the quartz robe meets the
 * air its rim shimmers in colours, warm down one side and cool down the other
 * as through a prism, with a few white glints in the cloth. Fixed to the
 * cloth, so it rides along with it.
 */
function prismFlecks(c: PixelCanvas, U: number, p: Pose): void {
  for (let y = 16; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      const m = c.materialAt(x, y);
      if (m !== S.robe && m !== S.trim) continue;
      const left = !c.materialAt(x - 1, y);
      const right = !c.materialAt(x + 1, y);
      const h = hash(x, y - U, 41);
      if ((left || right) && h > 0.35) {
        const band = ((y - U + Math.round(p.glow * 3)) % 3 + 3) % 3;
        c.spark(x, y, SPECTRUM[left ? band : 3 + band], 0.6);
      } else if (m === S.robe && h > 0.975) c.spark(x, y, S.magic.core, 0.45);
    }
  }
}

// ---------------------------------------------------------------------------
// Heads: the Firebird's crested hood, gold beak and mantle of flame feathers

/** A mantle of flame feathers over the shoulders: crimson rows overlapping, the lowest burning out to gold-tipped points. */
function featherMantle(c: PixelCanvas, l: number, r: number, U: number, flare: number, sway: number): void {
  const plume = S.plume ?? S.trim;
  const top = 15 + U;
  const bottom = 18 + U;
  const edges = (y: number): [number, number] => {
    const u = (y - top) / (bottom - top);
    return [l - flare * u, r + flare * u];
  };
  c.part();
  c.shape(top, top + 1, edges, plume, (_x, _y, t, u) => cyl(t, 0.55 - u * 0.2), { bias: -2 });
  c.shape(top + 2, bottom, edges, plume, (_x, _y, t, u) => cyl(t, 0.35 - u * 0.4), { bias: -1 });
  // The tips of the upper row lying over the lower, and the lowest row's points.
  c.part();
  const [ml, mr] = edges(top + 2);
  for (let x = Math.round(ml); x < Math.round(mr); x++) {
    const k = (((x - Math.round(sway)) % 3) + 3) % 3;
    if (k === 1) c.px(x, top + 2, plume, cyl((x + 0.5 - (ml + mr) / 2) / ((mr - ml) / 2), 0.1), { bias: -1 });
    else if (k === 2) c.shade(x, top + 2, 1);
  }
  const [bl, br] = edges(bottom);
  for (let x = Math.round(bl); x < Math.round(br); x++) {
    const k = (((x - Math.round(sway)) % 3) + 3) % 3;
    const t = (x + 0.5 - (bl + br) / 2) / ((br - bl) / 2);
    if (k === 0) c.px(x, bottom + 1, plume, cyl(t, -0.3), { bias: 1 });
    else if (k === 1) c.shade(x, bottom, 1);
    else c.shade(x, bottom, -1);
  }
  c.shade(Math.round(l), top, 1);
  c.shade(Math.round(r) - 1, top, 1);
}

/** The bird's skull of the hood, round on top and falling to the shoulders: its half-width for a row. */
const birdHoodHW = (y: number, top: number) => 5.2 * Math.sqrt(Math.min(1, Math.max(0, (y + 0.5 - top) / 4.2)));

/** Flame-feather texture on the hood: short rows of scallops, a little lighter at each feather's tip. */
function hoodFeathers(c: PixelCanvas, pts: [number, number][]): void {
  for (const [x, y] of pts) {
    c.shade(x, y, -1);
    c.shade(x + 1, y, -1);
  }
}

function firebirdHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  featherMantle(c, cx - 5.0, cx + 5.0, U, 1.3, p.hem);
  const top = 6 + U;
  c.part();
  c.shape(top, 16 + U, (y) => {
    const hw = birdHoodHW(y, top) - (y === 16 + U ? 0.4 : 0);
    return [cx - hw, cx + hw];
  }, S.robe, (_x, _y, t, u) => cyl(t, 0.5 - u * 0.45));
  hoodFeathers(c, [[cx - 5, 12 + U], [cx + 4, 12 + U], [cx - 5, 15 + U], [cx + 4, 15 + U]]);
  // The opening: a smouldering lining round the face.
  c.part();
  c.ellipse(cx, 13.2 + U, 3.6, 3.3, S.inner, { normal: (_x, _y, dx, dy) => ({ x: -dx * 0.55, y: dy * 0.45, z: 0.75 }) });
  c.part();
  c.ellipse(cx, 13.7 + U, 2.9, 2.5, S.skin);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  // Gold marks under the eyes, like the firebird's.
  c.px(9, 14 + U, S.plume ?? S.trim, FLAT_DOWN, { bias: 1 });
  c.px(14, 14 + U, S.plume ?? S.trim, FLAT_DOWN, { bias: 1 });
  const [gx, gy] = p.gaze ?? [0, 0];
  prismEyes(c, [[10 + gx, 13 + U + gy], [13 + gx, 13 + U + gy]], p);
  // The beak: gold, from the hood's brow down over the forehead to a hooked point between the eyes.
  c.part();
  c.shape(9 + U, 11 + U, (y) => {
    const hw = [2.6, 1.8, 1.0][y - 9 - U];
    return [cx - hw, cx + hw];
  }, S.trim, (_x, _y, t, u) => sphere(t * 0.8, 0.3 - u * 0.9, 1));
  c.px(cx - 1, 12 + U, S.trim, sphere(0, -0.6), { bias: -1 });
  c.shade(cx - 1, 11 + U, 1);
  // The firebird's eyes on the hood, either side of the beak's root.
  c.part();
  for (const x of [cx - 4, cx + 3]) {
    c.px(x, 9 + U, S.trim, { x: 0, y: 0.2, z: 0.98 }, { bias: 1 });
    c.spark(x, 9 + U, S.magic.hot, 0.35);
  }
  // The crest: three burning feathers sweeping back off the crown, swaying with the step.
  const s = p.hat * 0.6;
  plumeFeather(c, [{ x: cx - 1.2, y: 7.6 + U }, { x: cx - 2.6, y: 4.6 + U }, { x: cx - 3.0 - s, y: 2.6 + U }], 0.8, 0.3);
  plumeFeather(c, [{ x: cx + 1.4, y: 7.6 + U }, { x: cx + 3.6, y: 5.0 + U }, { x: cx + 5.0 + s, y: 4.2 + U }], 0.8, 0.3);
  plumeFeather(c, [{ x: cx, y: 7.2 + U }, { x: cx + 0.6, y: 3.6 + U }, { x: cx + 1.8 + s, y: 0.8 + U }], 0.95, 0.3);
  for (const [x, y] of [[cx - 3 - s, 2 + U], [cx + 5 + s, 4 + U], [cx + 2 + s, 0 + U]]) c.spark(x, y, S.magic.hot, 0.35 + p.glow * 0.25);
}

function firebirdHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  featherMantle(c, cx - 5.0, cx + 5.0, U, 1.3, -p.hem);
  const top = 6 + U;
  c.part();
  c.shape(top, 16 + U, (y) => {
    const hw = birdHoodHW(y, top) - (y === 16 + U ? 0.4 : 0);
    return [cx - hw, cx + hw];
  }, S.robe, (_x, _y, t, u) => cyl(t, 0.45 - u * 0.45));
  // Rows of feathers down the back of the hood.
  hoodFeathers(c, [[cx - 3, 10 + U], [cx + 2, 10 + U], [cx - 1, 13 + U], [cx - 4, 15 + U], [cx + 3, 15 + U]]);
  const s = -p.hat * 0.6;
  plumeFeather(c, [{ x: cx + 1.2, y: 7.6 + U }, { x: cx + 2.6, y: 4.6 + U }, { x: cx + 3.0 - s, y: 2.6 + U }], 0.8, 0.3);
  plumeFeather(c, [{ x: cx - 1.4, y: 7.6 + U }, { x: cx - 3.6, y: 5.0 + U }, { x: cx - 5.0 + s, y: 4.2 + U }], 0.8, 0.3);
  plumeFeather(c, [{ x: cx, y: 7.2 + U }, { x: cx - 0.6, y: 3.6 + U }, { x: cx - 1.8 + s, y: 0.8 + U }], 0.95, 0.3);
}

/** Facing left, like drawSide. */
function firebirdHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  featherMantle(c, cx - 3.8, cx + 3.6, U, 1.0, p.hem);
  // The crest streams back off the crown, behind the hood.
  const s = p.hat * 0.6;
  plumeFeather(c, [{ x: cx + 1.4, y: 7.0 + U }, { x: cx + 4.2, y: 5.2 + U }, { x: cx + 6.4 + s, y: 5.6 + U }], 0.8, 0.3);
  plumeFeather(c, [{ x: cx + 0.6, y: 6.6 + U }, { x: cx + 3.0, y: 3.4 + U }, { x: cx + 5.6 + s, y: 2.4 + U }], 0.9, 0.3);
  const top = 6 + U;
  c.part();
  c.shape(top, 16 + U, (y) => {
    const hw = birdHoodHW(y, top);
    const f = hw / 5.2;
    return [cx + 0.2 - 4.4 * f, cx + 0.2 + 3.8 * f];
  }, S.robe, (_x, _y, t, u) => cyl(t * 0.9 + 0.1, 0.5 - u * 0.45));
  hoodFeathers(c, [[cx + 1, 10 + U], [cx + 2, 14 + U]]);
  // The opening at the front, the face in profile within it.
  c.part();
  c.ellipse(cx - 2.2, 13.3 + U, 2.6, 3.1, S.inner, { normal: (_x, _y, dx, dy) => ({ x: -dx * 0.5, y: dy * 0.45, z: 0.75 }) });
  c.part();
  c.ellipse(cx - 2.0, 13.7 + U, 2.3, 2.4, S.skin);
  c.part();
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.px(cx - 5, 14 + U, S.skin, sphere(-0.5, 0.3));
  c.px(cx - 2, 14 + U, S.plume ?? S.trim, FLAT_DOWN, { bias: 1 });
  prismEyes(c, [[cx - 3, 13 + U]], p);
  // The beak juts out over the brow and hooks down before the face.
  c.part();
  c.shape(10 + U, 11 + U, (y) => (y === 10 + U ? [cx - 5.6, cx - 0.8] : [cx - 6.6, cx - 3.6]), S.trim, (_x, _y, t, u) => sphere(t * 0.8 - 0.2, 0.3 - u * 0.8, 1));
  c.px(cx - 6, 12 + U, S.trim, sphere(-0.3, -0.6), { bias: -1 });
  c.part();
  c.px(cx - 1, 9 + U, S.trim, { x: 0, y: 0.2, z: 0.98 }, { bias: 1 });
  c.spark(cx - 1, 9 + U, S.magic.hot, 0.35);
  plumeFeather(c, [{ x: cx - 0.4, y: 6.8 + U }, { x: cx + 1.0, y: 3.2 + U }, { x: cx + 2.8 + s, y: 0.8 + U }], 0.95, 0.3);
  for (const [x, y] of [[cx + 6 + s, 5 + U], [cx + 5 + s, 2 + U], [cx + 3 + s, 0 + U]]) c.spark(x, y, S.magic.hot, 0.35 + p.glow * 0.25);
}

/**
 * The robe feathered below the belt: rows of scalloped feather tips, each row
 * offset from the one above, a little lit at the tips; and embers drifting up
 * round her.
 */
function firebirdFlecks(c: PixelCanvas, U: number, p: Pose): void {
  for (let y = 23 + U; y < FRAME_H; y++) {
    const row = y - 23 - U;
    if (row % 3 !== 2) continue;
    const off = Math.floor(row / 3) % 2 ? 2 : 0;
    for (let x = 0; x < FRAME_W; x++) {
      if (c.materialAt(x, y) !== S.robe) continue;
      if ((x + off) % 4 === 0 && row > 0) c.shade(x, y, -1);
    }
  }
  const ph = p.glow * 5 + p.staff.float * 2 + p.breath * 1.1 + p.hem * 0.7;
  ([[3, 26], [20.5, 24], [4.5, 18], [19.5, 15]] as [number, number][]).forEach(([x, y], i) => {
    const rise = ((ph * 1.6 + i * 2.3) % 6 + 6) % 6;
    const a = 0.6 * (1 - rise / 6) + 0.15;
    const ex = x + Math.sin(ph * 2 + i * 1.9) * 0.8;
    c.spark(ex, y - rise * 1.5, i % 2 ? S.magic.hot : FIREBIRD_ROSE, a);
    if (i < 2) c.spark(ex, y - rise * 1.5 + 1, S.magic.deep, a * 0.5);
  });
}

// ---------------------------------------------------------------------------
// Heads: the Siren's waves of seafoam hair, crown of pearls and shell pauldrons

/**
 * A scallop shell standing on its hinge at (x, y): a fan of ribs, the rim lit,
 * the furrows between the ribs darker, two small ears at the hinge. `w` and
 * `h` its half-width and height.
 */
function scallop(c: PixelCanvas, x: number, y: number, w: number, h: number, lean = 0): void {
  const m = S.shell ?? S.trim;
  c.part();
  for (let yy = Math.floor(y - h); yy <= Math.floor(y); yy++) {
    for (let xx = Math.floor(x - w - 1); xx <= Math.ceil(x + w + 1); xx++) {
      const dx = (xx + 0.5 - x) / w;
      const dy = (yy + 0.5 - (y + 0.4)) / (h + 0.4);
      const d = dx * dx + dy * dy;
      if (d > 1 || dy > 0.05) continue;
      // Ribs fan out from the hinge; every other one sits in a furrow.
      const a = Math.atan2(dx, -dy);
      const rib = Math.floor((a + 1.6) * 2.2) % 2;
      c.px(xx, yy, m, sphere(dx * 0.6 + lean, dy * 0.6 - 0.2, 1), { bias: d > 0.7 ? 1 : rib ? -1 : 0 });
    }
  }
  c.px(x - 1.5, y, m, { x: -0.3, y: -0.2, z: 0.93 }, { bias: -1 });
  c.px(x + 0.5, y, m, { x: 0.3, y: -0.2, z: 0.93 }, { bias: -1 });
}

/** A pearl: one bright, cool pixel and a wink of the sunset in it. */
function pearl(c: PixelCanvas, x: number, y: number, p: Pose, i: number): void {
  c.px(x, y, S.crystal, { x: -0.3, y: 0.4, z: 0.86 });
  if ((i + Math.round(p.glow * 4)) % 3 === 0) c.spark(x, y, SIREN_GLINT, 0.35);
}

/** A long lock of hair falling in waves from (x, top) to `bottom`, rippling sideways, lit on the crest of each wave. */
function waveLock(c: PixelCanvas, x: number, top: number, bottom: number, w0: number, w1: number, k: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  const xAt = (y: number) => {
    const u = (y - top) / (bottom - top);
    return x + Math.sin(u * 7 + k * 1.3 + p.hem * 0.6) * 0.9 * u + p.hem * u * 0.5 + k * u * 0.8;
  };
  c.part();
  c.shape(top, bottom, (y) => {
    const u = (y - top) / (bottom - top);
    const hw = w0 + (w1 - w0) * u - (y === bottom ? 0.4 : 0);
    const m = xAt(y);
    return [m - hw, m + hw];
  }, hair, (_x, _y, t, u) => cyl(t * 0.85 + k * 0.2, 0.3 - u * 0.3));
  for (let y = top + 1; y <= bottom; y++) {
    const ph = ((y + Math.round(p.hem)) % 4 + 4) % 4;
    const m = Math.floor(xAt(y));
    if (ph === 0) c.shade(m, y, 1);
    else if (ph === 2) c.shade(m + (k < 0 ? 1 : -1), y, -1);
  }
  // The curl at its end.
  c.px(Math.floor(xAt(bottom)) + k, bottom, hair, cyl(k * 0.6, -0.3), { bias: 1 });
}

function sirenHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  // The mass of her hair behind, falling past the shoulders.
  c.part();
  c.shape(10 + U, 19 + U, (y) => {
    const u = (y - 10 - U) / 9;
    const hw = 4.4 + Math.max(0, u - 0.4) * 1.4;
    return [cx - hw, cx + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.3, 0.9));
  scallop(c, 7.0, 17.6 + U, 2.6, 2.4, -0.3);
  scallop(c, 17.0, 17.6 + U, 2.6, 2.4, 0.3);
  // Face, coral lips.
  c.part();
  c.ellipse(cx, 13.4 + U, 3.1, 2.7, S.skin);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  c.px(12, 15 + U, S.coral ?? S.skin, FLAT_DOWN);
  const gx = p.gaze?.[0] ?? 0;
  tideEyes(c, [[10 + gx, 13 + U], [13 + gx, 13 + U]], p);
  // The crown of the head, parted in the middle, and two long waves falling before the shoulders.
  c.part();
  c.ellipse(cx, 10.6 + U, 4.0, 2.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.5, 1) });
  c.shade(cx, 10 + U, -1);
  c.shade(cx - 2, 10 + U, 1);
  waveLock(c, 7.9, 11 + U, 24 + U, 0.9, 1.4, -1, p);
  waveLock(c, 16.1, 11 + U, 24 + U, 0.9, 1.4, 1, p);
  // The crown: a band of shell set with pearls, a scallop standing at its heart.
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 3.6, cx + 3.6], S.shell ?? S.trim, (_x, _y, t) => cyl(t, 0.2));
  scallop(c, cx, 9.4 + U, 1.7, 1.9);
  c.part();
  [[8, 10], [10, 10], [14, 10], [16, 10], [12, 10]].forEach(([x, y], i) => pearl(c, x, y + U, p, i));
}

function sirenHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  scallop(c, 7.0, 17.6 + U, 2.6, 2.4, -0.3);
  scallop(c, 17.0, 17.6 + U, 2.6, 2.4, 0.3);
  c.part();
  c.ellipse(cx, 11.8 + U, 4.1, 3.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 0.9) });
  // Her hair falls in waves down her back to the waist: three locks side by side.
  waveLock(c, cx - 2.3, 12 + U, 25 + U, 1.4, 1.6, -1, p);
  waveLock(c, cx + 2.3, 12 + U, 25 + U, 1.4, 1.6, 1, p);
  waveLock(c, cx, 12 + U, 26 + U, 1.5, 1.4, 0, p);
  // The crown seen from behind: the band and its pearls, the scallop's back above.
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 4.0, cx + 4.0], S.shell ?? S.trim, (_x, _y, t) => cyl(t, 0.1));
  scallop(c, cx, 9.4 + U, 1.7, 1.9);
  c.part();
  [[8, 10], [10, 10], [14, 10], [16, 10]].forEach(([x, y], i) => pearl(c, x, y + U, p, i));
}

/** Facing left, like drawSide. */
function sirenHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  // Hair behind, falling in waves down her back and drifting out behind her.
  c.part();
  c.ellipse(cx + 0.8, 12.4 + U, 3.4, 3.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9) });
  waveLock(c, cx + 2.2, 12 + U, 24 + U, 1.6, 1.8, 1, p);
  scallop(c, cx + 0.6, 17.6 + U, 2.2, 2.4, 0.2);
  // Face in profile, coral lips.
  c.part();
  c.ellipse(cx - 1.3, 13.5 + U, 2.8, 2.5, S.skin);
  c.part();
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.px(cx - 5, 14 + U, S.skin, sphere(-0.5, 0.3));
  c.px(cx - 4, 15 + U, S.coral ?? S.skin, FLAT_DOWN);
  tideEyes(c, [[cx - 3, 13 + U]], p);
  // Crown of the head and fringe, a wavy lock by the cheek.
  c.part();
  c.shape(9 + U, 10 + U, (y) => (y === 9 + U ? [cx - 3.2, cx + 2.8] : [cx - 4.4, cx + 3.6]), hair, (_x, _y, t, u) => sphere(t * 0.9, u - 0.8, 1));
  c.px(cx - 5, 11 + U, hair, cyl(-0.7, 0.2));
  for (let y = 13; y <= 17; y++) c.px(cx + ((y + Math.round(p.hem)) % 3 === 0 ? 1 : 0), y + U, hair, cyl(-0.2, 0), { bias: y > 15 ? -1 : 0 });
  // The crown: the band round her head, its pearls, the scallop standing over the brow.
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 4.4, cx + 2.4], S.shell ?? S.trim, (_x, _y, t) => cyl(t * 0.9 - 0.1, 0.2));
  scallop(c, cx - 2.2, 9.4 + U, 1.3, 1.9, -0.2);
  c.part();
  [[cx - 4, 10], [cx + 1, 10], [cx - 1, 10]].forEach(([x, y], i) => pearl(c, x, y + U, p, i));
}

/**
 * The Siren's gown and the sea round her: rows of scales down the gown, each
 * row set half a scale over from the last; sunset glints winking on them, and
 * bubbles rising.
 */
function sirenFlecks(c: PixelCanvas, U: number, p: Pose): void {
  const ph = p.glow * 5 + p.staff.float * 2 + p.breath * 1.1 + p.hem * 0.7;
  for (let y = 16; y < FRAME_H; y++) {
    const row = y - U;
    for (let x = 0; x < FRAME_W; x++) {
      if (c.materialAt(x, y) !== S.robe) continue;
      // A scale's lower edge every other row, the rows staggered.
      if (row % 2 === 1 && (x + (Math.floor(row / 2) % 2) * 2) % 4 === 0) c.shade(x, y, -1);
      else if (row % 2 === 0 && (x + (Math.floor(row / 2) % 2) * 2) % 4 === 1) c.shade(x, y, 1);
      const h = hash(x, row, 53);
      if (h > 0.965) c.spark(x, y, h > 0.985 ? SIREN_GLINT : S.magic.hot, 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(ph * 2 + h * 40)));
    }
  }
  ([[3, 27], [20.5, 26], [4.5, 20], [19.5, 19]] as [number, number][]).forEach(([x, y], i) => {
    const rise = ((ph * 1.6 + i * 2.3) % 6 + 6) % 6;
    const bx = x + Math.sin(ph * 2 + i * 1.9) * 0.8;
    const a = 0.55 * (1 - rise / 6) + 0.15;
    c.spark(bx, y - rise * 1.4, S.magic.hot, a);
    if (i < 2) c.spark(bx + 1, y - rise * 1.4 - 1, SIREN_GLINT, a * 0.5);
  });
}

function headDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  if (S.head === 'prism') prismHeadDown(c, cx, U, p);
  else if (S.head === 'firebird') firebirdHeadDown(c, cx, U, p);
  else if (S.head === 'siren') sirenHeadDown(c, cx, U, p);
  else if (S.head === 'astral') astralHeadDown(c, cx, U, p);
  else if (S.head === 'fiend') fiendHeadDown(c, cx, U, p);
  else if (S.head === 'grove') groveHeadDown(c, cx, U, p);
  else if (S.head === 'wild') wildHeadDown(c, cx, U, p);
  else if (S.head === 'tide') tideHeadDown(c, cx, U, p);
  else if (S.head === 'witch') witchHeadDown(c, cx, U, p);
  else if (S.head === 'faerie') faerieHeadDown(c, cx, U, p);
  else if (S.head === 'lotus') lotusHeadDown(c, cx, U, p);
  else if (S.head === 'cap') capHeadDown(c, cx, U, p);
  else if (S.hooded) hoodDown(c, cx, U, p);
  else beardedHeadDown(c, cx, U, p);
}

function headUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  if (S.head === 'prism') prismHeadUp(c, cx, U, p);
  else if (S.head === 'firebird') firebirdHeadUp(c, cx, U, p);
  else if (S.head === 'siren') sirenHeadUp(c, cx, U, p);
  else if (S.head === 'astral') astralHeadUp(c, cx, U, p);
  else if (S.head === 'fiend') fiendHeadUp(c, cx, U, p);
  else if (S.head === 'grove') groveHeadUp(c, cx, U, p);
  else if (S.head === 'wild') wildHeadUp(c, cx, U, p);
  else if (S.head === 'tide') tideHeadUp(c, cx, U, p);
  else if (S.head === 'witch') witchHeadUp(c, cx, U, p);
  else if (S.head === 'faerie') faerieHeadUp(c, cx, U, p);
  else if (S.head === 'lotus') lotusHeadUp(c, cx, U, p);
  else if (S.head === 'cap') capHeadUp(c, cx, U, p);
  else if (S.hooded) hoodUp(c, cx, U, p);
  else beardedHeadUp(c, cx, U, p);
}

function headSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  if (S.head === 'prism') prismHeadSide(c, cx, U, p);
  else if (S.head === 'firebird') firebirdHeadSide(c, cx, U, p);
  else if (S.head === 'siren') sirenHeadSide(c, cx, U, p);
  else if (S.head === 'astral') astralHeadSide(c, cx, U, p);
  else if (S.head === 'fiend') fiendHeadSide(c, cx, U, p);
  else if (S.head === 'grove') groveHeadSide(c, cx, U, p);
  else if (S.head === 'wild') wildHeadSide(c, cx, U, p);
  else if (S.head === 'tide') tideHeadSide(c, cx, U, p);
  else if (S.head === 'witch') witchHeadSide(c, cx, U, p);
  else if (S.head === 'faerie') faerieHeadSide(c, cx, U, p);
  else if (S.head === 'lotus') lotusHeadSide(c, cx, U, p);
  else if (S.head === 'cap') capHeadSide(c, cx, U, p);
  else if (S.hooded) hoodSide(c, cx, U, p);
  else beardedHeadSide(c, cx, U, p);
}

// ---------------------------------------------------------------------------
// Directions

function drawDown(c: PixelCanvas, p: Pose): FrameMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;

  let tip = { x: 0, y: 0 };
  if (p.staffBehind) tip = drawStaff(c, p.staff, p.glow);
  if (p.gem?.behind) crystal(c, p.gem.x, p.gem.y, p.glow);
  // Titania's wings spread behind everything.
  if (S.wing) faerieWings(c, 'down', cx, U, p);

  boot(c, 9.5, 29.6 - p.footA);
  boot(c, 14.5, 29.6 - p.footB);

  const top = 16 + U;
  const hem = 28 + L;
  const edges = robeBody(c, cx, top, hem, p.hem);

  // Open robe front showing the darker inner layer (Titania's gown is closed, its petals unbroken).
  const belt = 21 + U;
  c.part();
  if (S.head !== 'faerie' && S.head !== 'siren') c.shape(belt + 1, hem - 1, (y) => {
    const u = (y - belt) / (hem - belt);
    const x = cx + p.hem * Math.pow((y + 0.5 - top) / (hem + 1 - top), 2);
    return [x - 0.5 - u * 0.6, x + 0.5 + u * 0.6];
  }, S.inner, (_x, _y, t) => cyl(t * 0.5, 0.1));
  if (S.head === 'fiend') felRunes(c, (y) => cx + p.hem * Math.pow((y + 0.5 - top) / (hem + 1 - top), 2), belt + 2, hem - 1);
  if (S.head === 'witch') witchLacing(c, cx, U);

  // Belt with buckle.
  const [bl, br] = edges(belt);
  c.part();
  c.shape(belt, belt, () => [bl, br], S.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(11, belt, S.trim, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
  c.px(12, belt, S.trim, { x: 0.2, y: 0.3, z: 0.9 });
  if (S.head === 'lotus') sashTails(c, 11, belt, p.hem);

  // Free arm (character's left, screen right). Raised, only the upper arm is
  // drawn here; the forearm and hand come over the head, to reach a beard or chin.
  if (p.free) {
    c.part();
    c.capsule(15.8, 17.2 + U, p.free.ex, p.free.ey + U, 1.4, 1.6, S.robe);
  } else {
    sleeve(c, 15.8, 17.2 + U, 17.6, 21.6 + U + p.arm);
    hand(c, 17.9, 22.4 + U + p.arm);
  }

  headDown(c, cx, U, p);

  if (p.free) {
    sleeve(c, p.free.ex, p.free.ey + U, p.free.x, p.free.y + U);
    hand(c, p.free.x, p.free.y + U);
  }

  // Staff hand.
  if (!p.staffBehind) tip = drawStaff(c, p.staff, p.glow, p.gem);
  sleeve(c, 8.2, 17.2 + U, p.staff.hx + 0.4, p.staff.hy - 0.3);
  hand(c, p.staff.hx, p.staff.hy);

  if (S.head === 'astral') starfield(c, U);
  if (S.head === 'grove') groveFlecks(c, U, p);
  if (S.head === 'tide') tideFlecks(c, U, p);
  if (S.head === 'witch') witchFlecks(c, p);
  if (S.head === 'faerie') faerieFlecks(c, U, p);
  if (S.head === 'lotus') lotusFlecks(c, p);
  if (S.head === 'prism') prismFlecks(c, U, p);
  if (S.head === 'firebird') firebirdFlecks(c, U, p);
  if (S.head === 'siren') sirenFlecks(c, U, p);
  if (S.head === 'cap') capFlecks(c, U, p);
  if (S.cinder) cinderCracks(c, U, p);
  finishMagic(c, p, tip);
  p.fx?.(c);
  return { tipX: tip.x, tipY: tip.y, glow: p.glow };
}

function drawUp(c: PixelCanvas, p: Pose): FrameMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;

  let tip = { x: 0, y: 0 };
  if (p.staffBehind) tip = drawStaff(c, p.staff, p.glow);

  boot(c, 9.5, 29.6 - p.footB);
  boot(c, 14.5, 29.6 - p.footA);

  const top = 16 + U;
  const hem = 28 + L;
  const edges = robeBody(c, cx, top, hem, p.hem);
  // A soft back seam.
  for (let y = top + 2; y < hem; y++) c.shade(12, y, -1);

  const belt = 21 + U;
  const [bl, br] = edges(belt);
  c.part();
  c.shape(belt, belt, () => [bl, br], S.belt, (_x, _y, t) => cyl(t, 0));

  // Lotus ties her sash in a bow at the back.
  if (S.head === 'lotus') sashBow(c, cx, belt, p.hem);

  // Free arm (character's left, now screen left).
  sleeve(c, 8.2, 17.2 + U, 6.4, 21.6 + U + p.arm);
  hand(c, 6.1, 22.4 + U + p.arm);

  // Titania's wings, over her back and under her hair.
  if (S.wing) faerieWings(c, 'up', cx, U, p);

  headUp(c, cx, U, p);

  if (!p.staffBehind) tip = drawStaff(c, p.staff, p.glow);
  sleeve(c, 15.8, 17.2 + U, p.staff.hx - 0.4, p.staff.hy - 0.3);
  hand(c, p.staff.hx, p.staff.hy);

  if (S.head === 'astral') starfield(c, U);
  if (S.head === 'grove') groveFlecks(c, U, p);
  if (S.head === 'tide') tideFlecks(c, U, p);
  if (S.head === 'witch') witchFlecks(c, p);
  if (S.head === 'prism') prismFlecks(c, U, p);
  if (S.head === 'firebird') firebirdFlecks(c, U, p);
  if (S.head === 'siren') sirenFlecks(c, U, p);
  if (S.head === 'faerie') faerieFlecks(c, U, p);
  if (S.head === 'lotus') lotusFlecks(c, p);
  if (S.head === 'cap') capFlecks(c, U, p);
  if (S.cinder) cinderCracks(c, U, p);
  finishMagic(c, p, tip);
  return { tipX: tip.x, tipY: tip.y, glow: p.glow };
}

/** Lotus's sash: two pink tails hanging from the knot at her waist, stirring with the robe. */
function sashTails(c: PixelCanvas, x: number, belt: number, sway: number): void {
  c.part();
  const s = Math.round(sway * 0.5);
  for (let i = 1; i <= 4; i++) c.px(x + (i > 2 ? s : 0), belt + i, S.belt, cyl(-0.3, 0.1), { bias: i === 4 ? -1 : 0 });
  for (let i = 1; i <= 3; i++) c.px(x + 1 + (i > 1 ? s : 0), belt + i, S.belt, cyl(0.4, 0.1), { bias: -1 });
}

/** The bow at the back of Lotus's sash: two loops either side of the knot, and its tails. */
function sashBow(c: PixelCanvas, cx: number, belt: number, sway: number): void {
  c.part();
  for (const [x, y, b] of [[cx - 3, belt - 1, 1], [cx - 2, belt - 1, 1], [cx - 3, belt + 1, -1], [cx + 1, belt - 1, 0], [cx + 2, belt - 1, 0], [cx + 2, belt + 1, -1]] as const) {
    c.px(x, y, S.belt, { x: (x - cx) * 0.2, y: 0.4, z: 0.86 }, { bias: b });
  }
  c.part();
  c.px(cx - 1, belt, S.trim, { x: -0.2, y: 0.3, z: 0.93 }, { bias: 1 });
  sashTails(c, cx - 1, belt, -sway);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): FrameMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 13;

  let tip = { x: 0, y: 0 };
  if (p.staffBehind) tip = drawStaff(c, p.staff, p.glow);
  if (S.wing) faerieWings(c, 'side', cx, U, p);

  // Back foot first, then front foot.
  boot(c, 14.2 - p.footB, 29.6 - Math.max(0, p.footB) * 0.35, true);
  boot(c, 11.2 - p.footA, 29.6 - Math.max(0, p.footA) * 0.35, true);

  const top = 16 + U;
  const hem = 28 + L;
  // Robe in profile: chest in front, flaring more toward the back.
  const edges = (y: number): [number, number] => {
    const u = Math.max(0, (y + 0.5 - top) / (hem + 1 - top));
    const sw = p.hem * u * u;
    const l = cx - 3.6 - 2.2 * Math.pow(u, 1.4) + sw;
    const r = cx + 2.6 + 3.6 * Math.pow(u, 1.2) + sw;
    return [l, r];
  };
  c.part();
  c.shape(top, hem, edges, S.robe, (_x, _y, t, u) => cyl(t * 0.9 - 0.1, 0.25 - u * 0.25));
  skirtTiers(c, edges, hem, p.hem);
  hemTrim(c, edges, hem, p.hem);
  const belt = 21 + U;
  const [bl, br] = edges(belt);
  c.part();
  c.shape(belt, belt, () => [bl, br], S.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(bl), belt, S.trim, { x: -0.5, y: 0.3, z: 0.8 }, { bias: 1 });
  // Front edge of the robe opening.
  for (let y = belt + 1; y < hem && S.head !== 'faerie' && S.head !== 'siren'; y++) {
    const [l] = edges(y);
    c.px(Math.round(l) + 1, y, S.inner, cyl(-0.4, 0));
  }

  // Near arm sits under the beard; the hand is redrawn over the staff later.
  sleeve(c, cx + 0.8, 17.4 + U, p.staff.hx + 0.6, p.staff.hy - 0.4);
  hand(c, p.staff.hx, p.staff.hy);

  headSide(c, cx, U, p);

  if (!p.staffBehind) tip = drawStaff(c, p.staff, p.glow);
  hand(c, p.staff.hx, p.staff.hy);

  if (S.head === 'astral') starfield(c, U);
  if (S.head === 'grove') groveFlecks(c, U, p);
  if (S.head === 'tide') tideFlecks(c, U, p);
  if (S.head === 'witch') witchFlecks(c, p);
  if (S.head === 'faerie') faerieFlecks(c, U, p);
  if (S.head === 'lotus') lotusFlecks(c, p);
  if (S.head === 'prism') prismFlecks(c, U, p);
  if (S.head === 'firebird') firebirdFlecks(c, U, p);
  if (S.head === 'siren') sirenFlecks(c, U, p);
  if (S.head === 'cap') capFlecks(c, U, p);
  if (S.cinder) cinderCracks(c, U, p);
  finishMagic(c, p, tip);
  return { tipX: tip.x, tipY: tip.y, glow: p.glow };
}

const FLAT_DOWN: Vec3 = { x: 0, y: -0.3, z: 0.95 };

function finishMagic(c: PixelCanvas, p: Pose, tip: { x: number; y: number }): void {
  if (p.trail && p.trail.length > 1) drawTrail(c, p.staff, p.trail);
  if (p.flash) drawFlash(c, tip.x, tip.y, p.flash);
  // The crystal hidden behind the head casts no light over it.
  if (p.gem?.behind) return;
  // A single bright glint at the heart of the crystal.
  c.spark(tip.x - 0.4, tip.y - 0.6, S.magic.core, 0.35 + p.glow * 0.5);
  if (S.head === 'fiend') {
    // The crystal is a green flame: its tongue licks up, flickering with the pose.
    const lean = p.hat + (p.staff.float % 2 ? 1 : 0);
    c.spark(tip.x - 0.4, tip.y - 3, S.magic.hot, 0.45 + p.glow * 0.3);
    c.spark(tip.x - 0.4 + (lean % 2 ? 1 : -1), tip.y - 4, S.magic.mid, 0.35 + p.glow * 0.25);
  } else if (S.head === 'witch') {
    // Wisps curl up off the lantern: violet smoke, and a ghost-green fleck above it flickering side to side.
    const lean = p.hat + (p.staff.float % 2 ? 1 : 0);
    c.spark(tip.x - 0.4 + (lean % 2 ? 1 : 0), tip.y - 3.6, S.magic.deep, 0.5 + p.glow * 0.2);
    c.spark(tip.x - 0.4 + (lean % 2 ? 0 : 1), tip.y - 4.8, WITCH_GHOST, 0.3 + p.glow * 0.25);
  } else if (S.head === 'cap') {
    // Spores puff up off the glowcaps and drift away, rising higher each beat.
    const lean = p.hat + (p.staff.float % 2 ? 1 : 0);
    c.spark(tip.x - 0.4 + (lean % 2 ? -2 : 2), tip.y - 2.6, S.magic.hot, 0.35 + p.glow * 0.25);
    c.spark(tip.x - 0.4 + (lean % 2 ? 1 : -1), tip.y - 4.2, S.magic.mid, 0.3 + p.glow * 0.25);
    c.spark(tip.x - 0.4 + (lean % 2 ? -0.5 : 0.5), tip.y - 5.8, S.magic.core, 0.15 + p.glow * 0.2);
  } else if (S.cinder) {
    // The magma breathes: a tongue of flame licks up off it, an ember flicking off to one side.
    const lean = p.hat + (p.staff.float % 2 ? 1 : 0);
    c.spark(tip.x - 0.4, tip.y - 3, S.magic.hot, 0.45 + p.glow * 0.3);
    c.spark(tip.x - 0.4 + (lean % 2 ? 1 : -1), tip.y - 4, S.magic.mid, 0.35 + p.glow * 0.25);
    c.spark(tip.x - 0.4 + (lean % 2 ? -2 : 2), tip.y - 5.5, S.magic.mid, 0.2 + p.glow * 0.2);
  } else if (S.head === 'faerie') {
    // Pollen lifts off the moonflower, a mote either side by turns.
    const lean = p.hat + (p.staff.float % 2 ? 1 : 0);
    c.spark(tip.x - 0.4 + (lean % 2 ? 1.5 : -1.5), tip.y - 3.2, S.magic.hot, 0.35 + p.glow * 0.25);
    c.spark(tip.x - 0.4 + (lean % 2 ? -1 : 1), tip.y - 4.6, S.magic.core, 0.2 + p.glow * 0.2);
  } else if (S.head === 'firebird') {
    // The ember burns: a tongue of gold licking up off it, a rose fleck above flickering side to side.
    const lean = p.hat + (p.staff.float % 2 ? 1 : 0);
    c.spark(tip.x - 0.4, tip.y - 3, S.magic.hot, 0.5 + p.glow * 0.3);
    c.spark(tip.x - 0.4 + (lean % 2 ? 1 : -1), tip.y - 4, FIREBIRD_ROSE, 0.35 + p.glow * 0.25);
  } else if (S.head === 'siren') {
    // The low sun winks on the pearl.
    c.spark(tip.x - 1.4, tip.y - 1.4, SIREN_GLINT, 0.35 + p.glow * 0.3);
  } else if (S.head === 'prism') {
    // The prism throws a little rainbow out of its far face, spreading down and away.
    const a = 0.25 + p.glow * 0.3;
    for (let b = 0; b < SPECTRUM.length; b++) {
      const deg = (14 + b * 10) * RAD;
      for (let j = 2; j <= 4; j++) c.spark(tip.x + 1 + Math.cos(deg) * j, tip.y + Math.sin(deg) * j, SPECTRUM[b], a * (1.2 - j * 0.2));
    }
  } else if (S.head === 'astral') {
    // The star at the staff's head throws out four long rays.
    const r = 2 + Math.round(p.glow * 1.5);
    for (let i = 2; i <= r + 1; i++) {
      const a = (0.5 + p.glow * 0.3) * (1 - (i - 1) / (r + 1));
      c.spark(tip.x + i, tip.y, S.magic.hot, a);
      c.spark(tip.x - i, tip.y, S.magic.hot, a);
      c.spark(tip.x, tip.y + i, S.magic.hot, a);
      c.spark(tip.x, tip.y - i, S.magic.hot, a);
    }
  }
}

// ---------------------------------------------------------------------------
// Animations

const IDLE_STAFF: Record<'down' | 'up' | 'side', Staff> = {
  down: { hx: 4.6, hy: 21.6, angle: 0, len: 23, grip: 0.38, float: 1.2 },
  up: { hx: 19.4, hy: 21.6, angle: 0, len: 23, grip: 0.38, float: 1.2 },
  side: { hx: 7.6, hy: 21.4, angle: -4, len: 23, grip: 0.38, float: 1.2 },
};

const base = (view: 'down' | 'up' | 'side'): Pose => ({
  lift: 0,
  breath: 0,
  hat: 0,
  footA: 0,
  footB: 0,
  hem: 0,
  arm: 0,
  staff: { ...IDLE_STAFF[view] },
  glow: 0.6,
});

function idle(view: 'down' | 'up' | 'side'): Pose[] {
  const frames: Pose[] = [];
  const N = 16;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 4; // two breaths per loop
    const p = base(view);
    p.breath = Math.sin(ph - 0.6) > 0.1 ? 1 : 0;
    p.hat = Math.sin(ph - 1.6) > 0.3 ? (view === 'side' ? -1 : 1) : 0;
    p.staff.hy += p.breath * 0.5;
    p.staff.float = 1.2 + Math.round(Math.sin((f / N) * Math.PI * 2) * 1);
    p.glow = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin((f / N) * Math.PI * 2));
    p.blink = f === 11;
    // Titania's wings open and close twice a loop, slow as breathing.
    p.flap = 0.55 + 0.45 * Math.cos((f / N) * Math.PI * 4);
    frames.push(p);
  }
  return frames;
}

function walk(view: 'down' | 'up' | 'side'): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0; // passing frames rise
    if (view === 'side') {
      p.footA = Math.round(s * 2.4);
      p.footB = -p.footA;
      p.hem = -Math.round(s * 1);
      p.hat = p.lift ? 0 : 1;
      p.staff.angle = -4 - s * 9;
      p.staff.hx += -s * 1.2;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.hem = Math.round(s * 0.9);
      p.arm = Math.round(-s * 1);
      p.hat = p.lift ? 1 : 0;
      p.staff.hy += s > 0 ? -1 : 0;
    }
    p.staff.hy -= p.lift;
    p.glow = 0.7;
    // On the move her wings beat twice a stride.
    p.flap = 0.5 + 0.5 * Math.cos(((f + 0.5) / N) * Math.PI * 4);
    frames.push(p);
  }
  return frames;
}

/** Index of the frame in the cast animation that releases the projectile. */
export const CAST_RELEASE = 6;

// Twirl centre and release pose per view (shared by the cast and the beam).
const CAST_CFG = {
  down: {
    wind: { hx: 6.4, hy: 19.2, angle: -18, len: 21, grip: 0.4, float: 1.2 },
    spin: { hx: 12, hy: 18, len: 15, grip: 0.5 },
    release: { hx: 12, hy: 19.5, angle: 180, len: 12, grip: 0.3, float: 0 },
    recover: { hx: 6.2, hy: 20.6, angle: -8, len: 22, grip: 0.38, float: 1.2 },
    behindRelease: false,
  },
  up: {
    wind: { hx: 17.6, hy: 19.2, angle: 18, len: 21, grip: 0.4, float: 1.2 },
    spin: { hx: 16, hy: 11, len: 12, grip: 0.5 },
    release: { hx: 14.8, hy: 12.5, angle: -8, len: 13, grip: 0.3, float: 0 },
    recover: { hx: 17.8, hy: 20.6, angle: 8, len: 22, grip: 0.38, float: 1.2 },
    behindRelease: true,
  },
  side: {
    wind: { hx: 14.6, hy: 18.6, angle: 24, len: 21, grip: 0.4, float: 1.2 },
    spin: { hx: 9, hy: 17, len: 14, grip: 0.5 },
    release: { hx: 10, hy: 18, angle: -75, len: 11, grip: 0.3, float: 0 },
    recover: { hx: 9, hy: 20.4, angle: -14, len: 22, grip: 0.38, float: 1.2 },
    behindRelease: false,
  },
};

function cast(view: 'down' | 'up' | 'side'): Pose[] {
  const frames: Pose[] = [];
  const twirl = [30, 100, 170, 240, 310];
  const cfg = CAST_CFG[view];

  // 0: wind-up, gathering light.
  const w = base(view);
  w.staff = { ...cfg.wind };
  w.breath = 1;
  w.glow = 0.9;
  w.hat = view === 'side' ? -1 : 1;
  frames.push(w);

  // 1-5: the staff twirls around the hand, crystal carving an arc.
  twirl.forEach((a, i) => {
    const p = base(view);
    p.staff = { ...cfg.spin, angle: a, float: 0 };
    p.glow = 1;
    p.trail = [a - 150, a - 100, a - 50, a];
    p.hat = i % 2 ? 1 : 0;
    p.hem = view === 'side' ? (i % 2 ? 1 : 0) : 0;
    frames.push(p);
  });

  // 6: release, a burst at the crystal.
  const r = base(view);
  r.staff = { ...cfg.release };
  r.staffBehind = cfg.behindRelease;
  r.glow = 1;
  r.flash = 1;
  r.lift = 0;
  r.hem = view === 'side' ? 1 : 0;
  frames.push(r);

  // 7: follow-through, the burst fading.
  const h = base(view);
  h.staff = { ...cfg.release };
  h.staffBehind = cfg.behindRelease;
  h.glow = 0.85;
  h.flash = 0.45;
  frames.push(h);

  // 8: settle back toward idle.
  const s = base(view);
  s.staff = { ...cfg.recover };
  s.glow = 0.7;
  s.breath = 1;
  frames.push(s);
  return frames;
}

/** Beam, part 1: the staff swings from a wind-up to level at the target. */
function aim(view: 'down' | 'up' | 'side'): Pose[] {
  const cfg = CAST_CFG[view];
  const w = base(view);
  w.staff = { ...cfg.wind };
  w.breath = 1;
  w.glow = 0.9;
  w.hat = view === 'side' ? -1 : 1;

  const l = base(view);
  l.staff = { ...cfg.release };
  l.staffBehind = cfg.behindRelease;
  l.glow = 1;
  l.flash = 0.3;
  return [w, l];
}

/** Beam, part 2: braced and gathering light, the crystal thrumming at the staff's end. */
function charge(view: 'down' | 'up' | 'side'): Pose[] {
  const cfg = CAST_CFG[view];
  const flash = [0.25, 0.4, 0.55, 0.4];
  return flash.map((f, i) => {
    const p = base(view);
    p.staff = { ...cfg.release, float: i === 1 || i === 2 ? 1 : 0 };
    p.staffBehind = cfg.behindRelease;
    p.glow = 1;
    p.flash = f;
    p.breath = i === 1 || i === 2 ? 1 : 0;
    // The gathering magic stirs the robe and hat.
    p.hem = view === 'side' ? (i < 2 ? 1 : 0) : [0, 1, 0, -1][i];
    p.hat = i % 2 ? (view === 'side' ? -1 : 1) : 0;
    p.flap = i % 2 ? 0.7 : 1;
    return p;
  });
}

/** Beam, part 3: firing. The staff kicks back against the beam's push. */
function fire(view: 'down' | 'up' | 'side'): Pose[] {
  const cfg = CAST_CFG[view];
  return [1, 0.8].map((f, i) => {
    const p = base(view);
    p.staff = { ...cfg.release };
    p.staffBehind = cfg.behindRelease;
    p.glow = 1;
    p.flash = f;
    p.hem = view === 'side' ? 1 : i ? 1 : -1;
    p.hat = view === 'side' ? -1 : 1;
    return p;
  });
}


// ---------------------------------------------------------------------------
// The idle moment (`rest`): a little performance facing the viewer, played
// once when the hero has stood still a while. Every act shares one timeline
// (REST_ORDER): the stand (0), six frames easing in (1-6), a six-frame beat
// played twice (7-12), four easing out (13-16) and the stand again (17), which
// is idle frame 0 exactly so it swaps in and out without a pop. Props and
// magic are drawn in the look's own colours.

/** Frames in play order: holds on the anticipation, the landing and the settle; the middle beat twice. */
const REST_ORDER: readonly number[] = [0, 1, 1, 2, 3, 4, 5, 6, 6, 7, 8, 9, 10, 11, 12, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 16, 17];
const REST_FPS = 8;

/** The Arcanist's crystal circles over his head on this ellipse (centre and radii, in frame pixels). */
const ORBIT = { x: 12, y: 7.4, rx: 7.4, ry: 2.2 };
/** The Pyromancer's palm, where the flame sits (the flame's foot is just above it). */
const PALM = { x: 17.5, y: 19.6 };
/** The Grovekeeper's hand held out for the butterfly, and where it perches. */
const PERCH = { x: 19.4, y: 17.8 };
/** The pale breath of a howl. */
const BREATH: RGB = [214, 224, 236];

/** Wisps of smoke from a snuffed flame. */
const SMOKE: Material = {
  ramp: [hex('#3b3946'), hex('#5d5b68'), hex('#8b8995'), hex('#b8b6c0')],
  outline: hex('#24222c'),
  noAO: true,
  noOutline: true,
};

/** The stand: idle frame 0, which every rest starts and ends on. */
const stand = (): Pose => idle('down')[0];

/** The free hand raised to (x, y); the elbow hangs below and a little out from it, the way a raised forearm falls. */
const raise = (x: number, y: number): Pose['free'] => ({ x, y, ex: 17.2 + Math.max(0, x - 17) * 0.45, ey: Math.min(21.4, y + 2.6) });

/** A small burst of light: a bright heart and four short rays. */
function twinkle(c: PixelCanvas, x: number, y: number, k: number): void {
  c.spark(x, y, S.magic.core, k);
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + ox, y + oy, S.magic.hot, k * 0.6);
  if (k > 0.7) for (const [ox, oy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) c.spark(x + ox, y + oy, S.magic.mid, k * 0.3);
}

// --- The Arcanist: the crystal drifts off the staff and circles him while he strokes his beard.

function restArcane(look: WizardLook): Pose[] {
  const bearded = !look.hooded && !look.head;
  // Three beats of a stroke: down the point of the beard, or rubbing a bare chin.
  const chin: [number, number][] = bearded ? [[14.2, 17.6], [13.8, 18.8], [13.2, 19.9]] : [[13.9, 16.6], [13.6, 17.2], [13.3, 17.7]];
  // Round his head like a small moon: behind the hat on the far side, across the hat band on the near.
  const orbit = [210, 270, 330, 30, 90, 150].map((a) => ({ x: ORBIT.x + Math.cos(a * RAD) * ORBIT.rx, y: ORBIT.y + Math.sin(a * RAD) * ORBIT.ry, behind: Math.sin(a * RAD) < 0 }));
  // Where the crystal is, frame by frame: seated, lifting off and bobbing, the lazy circle, back over the staff, seated.
  const path: ({ x: number; y: number; behind?: boolean } | undefined)[] = [
    undefined, undefined,
    { x: 4.6, y: 3.2 }, { x: 4.6, y: 2.6 }, { x: 4.8, y: 3.0 }, { x: 5.1, y: 4.0 }, { x: 5.3, y: 5.2 },
    ...orbit,
    { x: 4.9, y: 5.8 }, { x: 4.6, y: 3.4 },
    undefined, undefined,
  ];
  const hands = [
    undefined, raise(18.2, 21.0), raise(16.6, 19.4), raise(...chin[0]), raise(...chin[1]), raise(...chin[2]), raise(...chin[0]),
    raise(...chin[1]), raise(...chin[2]), raise(...chin[0]), raise(...chin[1]), raise(...chin[2]), raise(...chin[0]),
    raise(...chin[0]), raise(16.4, 19.2), raise(17.6, 20.8), undefined,
  ];
  const frames: Pose[] = [stand()];
  for (let i = 1; i <= 16; i++) {
    const p = stand();
    const g = path[i];
    p.free = hands[i];
    p.gem = g;
    p.glow = g ? 1 : i === 1 || i === 15 ? 0.95 : 0.8;
    // Before it lifts off the crystal rises in its fork; after, it drops back in with a click of light.
    if (i === 1) p.staff.float = 2.4;
    if (i === 15) p.staff.float = 2.2;
    if (i === 2) p.flash = 0.35;
    if (i === 15) p.flash = 0.45;
    // His eyes follow it; the stroking nods the head, the hat tip swinging a beat late.
    if (g) p.gaze = [g.x < 9 ? -1 : g.x > 15 ? 1 : 0, g.y < 7 ? -1 : 0];
    else if (i === 1) p.gaze = [-1, 0];
    const beat = i >= 3 && i <= 13 ? (i - 3) % 3 : -1;
    if (beat === 2) {
      p.breath = 1;
      p.staff.hy += 0.5;
    }
    p.hat = beat === 0 || i === 16 || i === 2 ? 1 : 0;
    p.fx = (c) => {
      if (!g || g.behind) return;
      // A fading ribbon behind it where it has just been, and a mote of light dripping from it.
      const a = path[i - 1];
      const b = path[i - 2];
      if (a) c.spark(a.x - 0.4, a.y - 0.4, S.magic.mid, 0.55);
      if (a && b) c.spark((a.x + b.x) / 2 - 0.4, (a.y + b.y) / 2 - 0.4, S.magic.deep, 0.4);
      c.spark(g.x - 0.4 + (i % 2 ? 1 : -1), g.y + 2.6 + (i % 3), S.magic.hot, 0.35);
    };
    frames.push(p);
  }
  frames.push(stand());
  return frames;
}

// --- The Pyromancer: a snap, a flame on the palm, a toss and a catch, then a fist and a puff of smoke.

const FIRES = new Map<WizardLook, Material>();

/** Flame with a body: the look's magic as a lit, glowing material, so it holds its shape against the robe. */
function fireMat(): Material {
  let m = FIRES.get(S);
  if (!m) {
    const k = S.magic;
    m = { ramp: [k.deep, k.mid, k.hot, k.core], outline: k.deep.map((v) => Math.round(v * 0.35)) as RGB, emissive: 0.85, noAO: true };
    FIRES.set(S, m);
  }
  return m;
}

/** Flame pixels [dx, dy, heat] round (x, y); heat 0 at the edges up to 3 at the white heart. */
function burn(c: PixelCanvas, x: number, y: number, px: [number, number, number][]): void {
  const m = fireMat();
  c.part();
  for (const [dx, dy, h] of px) c.px(x + dx, y + dy, m, { x: dx * 0.3, y: 0.3, z: 0.9 }, { bias: h - 1, glow: 0.6 + h * 0.13 });
}

/** A flame standing on the palm, its foot at (x, y); `size` 1..3, its tip leaning `lean` pixels. */
function flame(c: PixelCanvas, x: number, y: number, size: number, lean: number): void {
  const m = S.magic;
  if (size <= 1) {
    burn(c, x, y, [[0, 0, 2], [0, -1, 1]]);
    c.spark(x, y, m.core, 0.4);
    return;
  }
  if (size === 2) {
    burn(c, x, y, [[-1, 0, 1], [0, 0, 3], [1, 0, 1], [0, -1, 2], [lean, -2, 0]]);
  } else {
    burn(c, x, y, [
      [-1, 0, 1], [0, 0, 3], [1, 0, 1],
      [-1, -1, 0], [0, -1, 3], [1, -1, 1],
      [lean, -2, 2], [lean + (lean >= 0 ? -1 : 1), -2, 0],
      [lean, -3, 1],
    ]);
    c.spark(x + lean * 2, y - 4, m.hot, 0.6);
  }
  // Its light spilling on the palm and round it.
  c.spark(x, y + 1, m.mid, 0.4);
  c.spark(x - 2, y, m.deep, 0.35);
  c.spark(x + 2, y, m.deep, 0.35);
}

/** The flame in the air, balled up: `dir` -1 rising (its tail below), 1 falling (tail above), 0 turning over at the top. */
function fireball(c: PixelCanvas, x: number, y: number, dir: number): void {
  const m = S.magic;
  if (dir === 0) {
    burn(c, x, y, [[0, 0, 3], [1, 0, 2], [0, 1, 2], [1, 1, 1], [-1, 0, 0], [2, 1, 0]]);
    c.spark(x + 1, y - 1, m.hot, 0.5);
    c.spark(x, y + 2, m.mid, 0.4);
    return;
  }
  const t = dir < 0 ? 1 : -1;
  burn(c, x, y, [[0, 0, 3], [1, 0, 2], [0, t, 2], [1, t, 1], [0, 2 * t, 0]]);
  c.spark(x, y + 3 * t, m.mid, 0.5);
  c.spark(x + 1, y + 4 * t, m.deep, 0.35);
}

function smoke(c: PixelCanvas, pts: [number, number, number][]): void {
  c.part();
  for (const [x, y, b] of pts) c.px(x, y, SMOKE, { x: -0.3, y: 0.4, z: 0.86 }, { bias: b });
}

function restPyro(): Pose[] {
  const { x: px, y: py } = PALM;
  const frames: Pose[] = [stand()];
  const at = (i: number, f: Partial<Pose>, fx?: (c: PixelCanvas) => void) => {
    const p = { ...stand(), ...f };
    p.fx = fx;
    frames[i] = p;
  };
  // 1-2: the hand comes up and snaps, a spark jumping from the fingers.
  at(1, { free: raise(18.0, 20.8), gaze: [1, 0] });
  at(2, { free: raise(17.3, 18.8), gaze: [1, 0], hat: 1 }, (c) => twinkle(c, 18.4, 17.2, 0.9));
  // 3-6: a flame springs up on the palm and grows; the hand dips to throw.
  at(3, { free: raise(px, py), gaze: [1, 0] }, (c) => flame(c, px, py - 1.4, 1, 0));
  at(4, { free: raise(px, py), gaze: [1, 0] }, (c) => flame(c, px, py - 1.4, 2, 0));
  at(5, { free: raise(px, py), gaze: [1, 0], glow: 0.9 }, (c) => flame(c, px, py - 1.4, 3, 1));
  at(6, { free: raise(px, py + 0.8), gaze: [1, 0], breath: 1 }, (c) => flame(c, px, py - 0.6, 3, -1));
  // 7-12: tossed up, watched to the top, caught with a dip, settled.
  at(7, { free: raise(px - 0.2, py - 0.8), gaze: [1, -1], hat: 1 }, (c) => fireball(c, px + 0.4, 15.4, -1));
  at(8, { free: raise(px, py - 0.2), gaze: [1, -1] }, (c) => fireball(c, px + 1.0, 12.4, -1));
  at(9, { free: raise(px, py), gaze: [1, -1] }, (c) => fireball(c, px + 1.2, 11.2, 0));
  at(10, { free: raise(px, py), gaze: [1, -1] }, (c) => fireball(c, px + 0.8, 13.6, 1));
  at(11, { free: raise(px, py + 0.8), gaze: [1, 0], breath: 1 }, (c) => flame(c, px, py - 0.6, 3, 0));
  at(12, { free: raise(px, py), gaze: [1, 0] }, (c) => flame(c, px, py - 1.4, 3, 1));
  // 13-16: the fist closes on it (light leaking between the fingers), a puff of smoke rises and thins.
  at(13, { free: raise(px - 0.2, py - 0.4), gaze: [1, 0], glow: 0.9 }, (c) => {
    c.spark(px - 0.6, py - 1.8, S.magic.core, 0.7);
    c.spark(px + 0.4, py - 2.4, S.magic.hot, 0.5);
    c.spark(px - 1.6, py - 1.2, S.magic.mid, 0.4);
  });
  at(14, { free: raise(px, py + 0.2), gaze: [1, 0], hat: 1 }, (c) => {
    smoke(c, [[px - 0.6, py - 2.6, -1], [px + 0.4, py - 2.6, -1], [px - 0.6, py - 3.6, 0], [px + 0.4, py - 3.6, 0], [px - 0.6, py - 4.6, -1]]);
    c.spark(px + 1.4, py - 2.4, S.magic.hot, 0.45);
  });
  at(15, { free: raise(px + 0.3, py + 1.3) }, (c) => smoke(c, [[px - 0.8, py - 4.8, -1], [px + 0.2, py - 5.8, 0], [px - 0.8, py - 5.8, -1], [px + 1.2, py - 6.8, -1]]));
  at(16, { hat: 1 }, (c) => smoke(c, [[px + 0.4, py - 8.6, -1], [px + 1.4, py - 9.6, -1]]));
  frames.push(stand());
  return frames;
}

// --- The Tidecaller: a bubble gathers on her palm; she bounces it like a ball until it wobbles and pops.

/** A bubble of water: a ring of light, brighter where the light passes through, a faint fill and a window of highlight. */
function bubble(c: PixelCanvas, x: number, y: number, rx: number, ry: number): void {
  const m = S.magic;
  if (rx < 1.3) {
    c.spark(x, y, m.core, 0.8);
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + ox, y + oy, m.mid, 0.4);
    return;
  }
  // The skin of water is a ring of solid, glowing pixels (the look's magic, as
  // the Pyromancer's flame), so it keeps its shape over the robe; inside, a faint haze.
  const w = fireMat();
  c.part();
  for (let yy = Math.floor(y - ry) - 1; yy <= Math.ceil(y + ry); yy++) {
    for (let xx = Math.floor(x - rx) - 1; xx <= Math.ceil(x + rx); xx++) {
      const dx = (xx + 0.5 - x) / rx;
      const dy = (yy + 0.5 - y) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1.12) continue;
      if (d > 0.42) c.px(xx, yy, w, { x: dx * 0.6, y: -dy * 0.6, z: 0.6 }, { bias: dx + dy > 0.5 ? 0 : -1, glow: 0.55 });
      else c.spark(xx, yy, m.deep, 0.3);
    }
  }
  c.px(x - rx * 0.45, y - ry * 0.5, w, FLAT, { bias: 3, glow: 1 });
}

function droplets(c: PixelCanvas, x: number, y: number, r: number, fall: number, a: number): void {
  for (const deg of [-150, -30, 40, 140, -90]) {
    const dx = Math.cos(deg * RAD) * r;
    const dy = Math.sin(deg * RAD) * r * 0.8 + fall;
    c.spark(x + dx, y + dy, S.magic.hot, a);
    c.spark(x + dx, y + dy - 1, S.magic.deep, a * 0.4);
  }
}

function restTide(): Pose[] {
  const px = PALM.x;
  const py = 19.8;
  const frames: Pose[] = [stand()];
  /** The bubble resting `up` pixels above the palm at `hy`. */
  const b = (hy: number, up: number, rx: number, ry: number) => (c: PixelCanvas) => bubble(c, px, hy - 1.3 - ry - up, rx, ry);
  const at = (i: number, f: Partial<Pose>, fx?: (c: PixelCanvas) => void) => {
    const p = { ...stand(), ...f };
    p.fx = fx;
    frames[i] = p;
  };
  // 1-5: the hand turns up; water gathers from the air into a bubble that swells on the palm.
  at(1, { free: raise(18.0, 20.8), gaze: [1, 0] });
  at(2, { free: raise(px, py), gaze: [1, 0] }, (c) => {
    for (const deg of [200, 320, 80]) c.spark(px + Math.cos(deg * RAD) * 3.4, py - 2.6 + Math.sin(deg * RAD) * 3, S.magic.hot, 0.6);
    c.spark(px, py - 2, S.magic.mid, 0.5);
  });
  at(3, { free: raise(px, py), gaze: [1, 0] }, (c) => {
    for (const deg of [200, 320, 80]) c.spark(px + Math.cos(deg * RAD) * 1.9, py - 2.4 + Math.sin(deg * RAD) * 1.7, S.magic.hot, 0.5);
    bubble(c, px, py - 2.2, 1, 1);
  });
  at(4, { free: raise(px, py), gaze: [1, 0] }, b(py, 0, 1.6, 1.6));
  at(5, { free: raise(px, py), gaze: [1, 0], glow: 0.9 }, b(py, 0, 2.2, 2.2));
  // 6: the palm dips under it, squashing it.
  at(6, { free: raise(px, py + 0.7), gaze: [1, 0], breath: 1 }, b(py + 0.7, 0, 2.7, 1.8));
  // 7-12: flicked up (stretched), round at the top, falling, squashed on the catch, springing back.
  at(7, { free: raise(px - 0.1, py - 0.8), gaze: [1, 0], hat: 1 }, b(py - 0.8, 2.6, 1.8, 2.5));
  at(8, { free: raise(px, py - 0.2), gaze: [1, -1] }, b(py, 5.8, 2.2, 2.2));
  at(9, { free: raise(px, py), gaze: [1, -1] }, b(py, 6.8, 2.4, 2.0));
  at(10, { free: raise(px, py), gaze: [1, -1] }, b(py, 3.6, 1.9, 2.5));
  at(11, { free: raise(px, py + 0.8), gaze: [1, 0], breath: 1 }, b(py + 0.8, 0, 2.8, 1.6));
  at(12, { free: raise(px, py), gaze: [1, 0] }, b(py, 0.3, 2.0, 2.4));
  // 13-16: it wobbles too far (she squints), pops in a ring of spray, and the droplets fall away.
  at(13, { free: raise(px, py), blink: true, glow: 0.9 }, (c) => {
    bubble(c, px, py - 3.8, 2.7, 2.2);
    c.spark(px + 2.6, py - 5.2, S.magic.mid, 0.5);
  });
  at(14, { free: raise(px, py - 0.3), blink: true, hat: 1 }, (c) => {
    twinkle(c, px, py - 3.8, 0.8);
    droplets(c, px, py - 3.8, 2.6, 0, 0.75);
  });
  at(15, { free: raise(17.8, 20.9), gaze: [1, 0] }, (c) => droplets(c, px, py - 3.8, 4.0, 1.8, 0.5));
  at(16, {}, (c) => {
    c.spark(px + 3.6, py + 2.4, S.magic.hot, 0.35);
    c.spark(px - 3.4, py + 3.6, S.magic.hot, 0.3);
  });
  frames.push(stand());
  return frames;
}

// --- The Grovekeeper: a butterfly of light slips out of the antler's blossom, lands on a finger, and flies home.

const WINGS = new Map<WizardLook, Material>();

/** Wings in the look's magic: green and gold in the glade, russet in autumn. */
function wingMat(): Material {
  let m = WINGS.get(S);
  if (!m) {
    const k = S.magic;
    m = { ramp: [k.deep, k.mid, k.hot, k.core], outline: k.deep.map((v) => Math.round(v * 0.4)) as RGB, emissive: 0.3, noAO: true };
    WINGS.set(S, m);
  }
  return m;
}

/** A butterfly with its body at (x, y): wings 0 spread, 1 half raised, 2 closed up over its back. */
function butterfly(c: PixelCanvas, x: number, y: number, wings: number): void {
  const w = wingMat();
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  c.part();
  const lit = (t: number, up: number): Vec3 => ({ x: t * 0.4 - 0.2, y: up, z: 0.85 });
  if (wings === 0) {
    for (const k of [-1, 1]) {
      c.px(x0 + k, y0 - 1, w, lit(k, 0.4), { bias: 0 });
      c.px(x0 + 2 * k, y0 - 1, w, lit(k, 0.4), { bias: -1 });
      c.px(x0 + 2 * k, y0 - 2, w, lit(k, 0.6), { bias: 0 });
      c.px(x0 + k, y0, w, lit(k, -0.1), { bias: -2 });
    }
    c.spark(x0 - 2, y0 - 2, S.magic.hot, 0.35);
    c.spark(x0 + 2, y0 - 2, S.magic.hot, 0.35);
  } else if (wings === 1) {
    for (const k of [-1, 1]) {
      c.px(x0 + k, y0 - 1, w, lit(k, 0.4), { bias: 0 });
      c.px(x0 + k, y0 - 2, w, lit(k, 0.6), { bias: -1 });
      c.px(x0 + k, y0, w, lit(k, 0), { bias: -1 });
    }
    c.spark(x0, y0 - 2, S.magic.hot, 0.3);
  } else {
    c.px(x0, y0 - 2, w, lit(0, 0.6), { bias: 0 });
    c.px(x0, y0 - 1, w, lit(0, 0.4), { bias: -1 });
    c.px(x0 + 1, y0 - 2, w, lit(1, 0.5), { bias: -1 });
    c.spark(x0, y0 - 2, S.magic.hot, 0.35);
  }
  c.part();
  c.px(x0, y0, S.inner, { x: 0, y: 0.2, z: 0.98 });
  if (wings !== 2) c.px(x0, y0 - 1, S.inner, { x: 0, y: 0.4, z: 0.9 }, { bias: 0 });
}

function restGrove(look: WizardLook): Pose[] {
  const frames: Pose[] = [stand()];
  const { x: hx, y: hy } = PERCH;
  // The blossom on the right antler's tip (see groveHeadDown); for Titania, the right blossom of her crown.
  // For Mycelia, the brightest spot on her toadstool.
  const bloom = look.head === 'faerie' ? { x: 15, y: 9 } : look.head === 'cap' ? { x: 17, y: 5 } : { x: 19, y: 2 };
  const at = (i: number, f: Partial<Pose>, fly?: [number, number, number], fx?: (c: PixelCanvas) => void) => {
    const p = { ...stand(), ...f };
    p.fx = (c) => {
      fx?.(c);
      if (fly) butterfly(c, fly[0], fly[1], fly[2]);
    };
    frames[i] = p;
  };
  const perch = (w: number): [number, number, number] => [hx, hy - 1.6, w];
  // 1-6: the blossom brightens and she looks up; out it slips and flutters down in loops; she holds out a hand; it lands.
  at(1, { gaze: [1, -1] }, undefined, (c) => twinkle(c, bloom.x, bloom.y, 0.8));
  at(2, { gaze: [1, -1], free: raise(18.3, 21.2) }, [19.6, 4.2, 2], (c) => twinkle(c, bloom.x, bloom.y, 0.5));
  at(3, { gaze: [1, -1], free: raise(18.8, 20.0) }, [21.2, 6.6, 0]);
  at(4, { gaze: [1, 0], free: raise(19.2, 18.8) }, [20.0, 9.8, 2]);
  at(5, { gaze: [1, 0], free: raise(hx, hy) }, [21.0, 12.8, 0]);
  at(6, { gaze: [1, 0], free: raise(hx, hy + 0.5) }, [hx, hy - 1.1, 0]);
  // 7-12: it rests on the finger, slowly opening and closing its wings; she watches, and blinks.
  const wings = [0, 1, 2, 2, 1, 0];
  for (let k = 0; k < 6; k++) {
    const bob = k === 2 || k === 3 ? 0.3 : 0;
    at(7 + k, { gaze: [1, 0], free: raise(hx, hy + bob), blink: k === 3, glow: 0.8 + k * 0.03 }, perch(wings[k]));
  }
  // 13-16: off it goes, looping back up to the blossom; her hand drops, her eyes follow it home.
  at(13, { gaze: [1, 0], free: raise(hx - 0.1, hy - 0.5) }, [20.4, 13.6, 2]);
  at(14, { gaze: [1, -1], free: raise(19.0, 18.9) }, [19.8, 10.0, 0]);
  at(15, { gaze: [1, -1], free: raise(18.4, 20.4) }, [20.9, 6.4, 2]);
  at(16, { gaze: [1, -1] }, [19.6, 4.2, 1], (c) => twinkle(c, bloom.x, bloom.y, 0.6));
  frames.push(stand());
  return frames;
}

// --- The Shapeshifter: she gathers a breath, tips her head back and howls, then shakes out her pelt.

/** The howl: breath rising off the muzzle, and rings of sound spreading either side, by phase 0..2. */
function howlFx(c: PixelCanvas, U: number, ph: number): void {
  const m = S.magic;
  // Just over the upturned nose, between the ears.
  const top = 1.5 + U;
  const puff: [number, number, number][][] = [
    [[11.5, top, 0.9], [12.5, top, 0.6]],
    [[11.5, top - 1, 0.8], [12.5, top - 1, 0.7], [11, top, 0.45]],
    [[12, top - 2, 0.55], [13, top - 2, 0.45], [11, top - 1, 0.35]],
  ];
  for (const [x, y, a] of puff[ph]) c.spark(x, y, BREATH, a);
  for (let r = 0; r < 2; r++) {
    const rr = 6 + ((ph + r * 1.5) % 3) * 1.2;
    const a = 0.9 - ((ph + r * 1.5) % 3) * 0.22;
    for (const k of [-1, 1]) {
      for (const deg of [-30, 0, 30]) {
        c.spark(12 + k * Math.cos(deg * RAD) * rr, 8 + U + Math.sin(deg * RAD) * rr * 0.8, m.hot, a * (deg ? 0.7 : 1));
      }
    }
  }
}

/** Tufts of fur (or snow off the white pelt) flung off by the shake, to side `k`. */
function furFlung(c: PixelCanvas, k: number): void {
  const pelt = S.hair ?? HAIR;
  c.part();
  for (const [x, y] of [[12 + k * 7.4, 12], [12 + k * 8.4, 16], [12 + k * 6.6, 8]] as const) c.px(x, y, pelt, { x: k * 0.5, y: 0.3, z: 0.8 }, { bias: 1 });
  c.spark(12 + k * 9, 13, S.magic.hot, 0.35);
}

function restWild(): Pose[] {
  const frames: Pose[] = [stand()];
  const at = (i: number, f: Partial<Pose>, fx?: (c: PixelCanvas) => void) => {
    const p = { ...stand(), ...f };
    p.staff.hy += (p.breath > 0 ? 0.5 : 0);
    p.fx = fx;
    frames[i] = p;
  };
  // 1-3: she hunches to draw breath, then her chest lifts and her head tips back.
  at(1, { breath: 1, blink: true, arm: 1 });
  at(2, { howl: 1, hem: 1 });
  at(3, { howl: 2, hat: 1 });
  // 4-12: the howl, held: the breath steaming off the muzzle, the sound rolling out in rings, the pelt stirring.
  at(4, { howl: 2 }, (c) => howlFx(c, 0, 0));
  at(5, { howl: 2 }, (c) => howlFx(c, 0, 1));
  at(6, { howl: 2 }, (c) => howlFx(c, 0, 2));
  for (let k = 0; k < 6; k++) at(7 + k, { howl: 2, hem: [0, 1, 0, -1, 0, 1][k] }, (c) => howlFx(c, 0, k % 3));
  // 13-16: head down, eyes screwed shut, a shake to one side and the other, flinging tufts; the pelt settles last.
  at(13, { shake: -1, hem: -2, blink: true, arm: -1 }, (c) => furFlung(c, -1));
  at(14, { shake: 1, hem: 2, blink: true, arm: 1 }, (c) => furFlung(c, 1));
  at(15, { shake: -1, hem: -1 });
  at(16, { hem: 1 });
  frames.push(stand());
  return frames;
}

/** The look's idle moment, facing the viewer only. */
function rest(view: 'down' | 'up' | 'side', look: WizardLook): Pose[] {
  if (view !== 'down') return [];
  if (look.rest === 'arcane') return restArcane(look);
  if (look.rest === 'pyro') return restPyro();
  if (look.rest === 'tide') return restTide();
  if (look.rest === 'grove') return restGrove(look);
  return restWild();
}

// ---------------------------------------------------------------------------
// Frame generation

export type AnimName = 'idle' | 'walk' | 'cast' | 'aim' | 'charge' | 'beam' | 'rest';

export interface AnimDef {
  name: AnimName;
  fps: number;
  loop: boolean;
  /** Frame indices to play in order, when some are held or repeated. */
  order?: readonly number[];
  poses: (view: 'down' | 'up' | 'side', look: WizardLook) => Pose[];
}

export const ANIMS: AnimDef[] = [
  { name: 'idle', fps: 8, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'cast', fps: 15, loop: false, poses: cast },
  { name: 'aim', fps: 14, loop: false, poses: aim },
  { name: 'charge', fps: 10, loop: true, poses: charge },
  { name: 'beam', fps: 16, loop: true, poses: fire },
  { name: 'rest', fps: REST_FPS, loop: false, order: REST_ORDER, poses: rest },
];

export interface WizardFrame {
  key: string; // e.g. "walk_left_3"
  anim: AnimName;
  dir: Dir;
  index: number;
  canvas: PixelCanvas;
  meta: FrameMeta;
}

export function drawWizardFrame(dir: Dir, pose: Pose, look: WizardLook = ARCANE_LOOK): { canvas: PixelCanvas; meta: FrameMeta } {
  S = look;
  const c = new PixelCanvas(FRAME_W, FRAME_H);
  let meta: FrameMeta;
  if (dir === 'down') meta = drawDown(c, pose);
  else if (dir === 'up') meta = drawUp(c, pose);
  else {
    meta = drawSide(c, pose);
    if (dir === 'right') {
      return { canvas: c.mirrored(), meta: { ...meta, tipX: FRAME_W - meta.tipX } };
    }
  }
  return { canvas: c, meta };
}

export function buildWizardFrames(look: WizardLook = ARCANE_LOOK): WizardFrame[] {
  const out: WizardFrame[] = [];
  for (const a of ANIMS) {
    for (const dir of DIRS) {
      const view = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view, look).forEach((pose, index) => {
        const { canvas, meta } = drawWizardFrame(dir, pose, look);
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, index, canvas, meta });
      });
    }
  }
  return out;
}
