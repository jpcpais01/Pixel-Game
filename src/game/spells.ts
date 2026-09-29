// Runtime colours for the wizard's spells, one set per look. The art side of
// each look (sprites, orb and burst frames) lives in art/wizard.ts and
// art/effects.ts; these are the matching tints and lights.

export interface SpellStyle {
  core: number;
  hot: number;
  mid: number;
  deep: number;
  /** Contrasting flecks and strands (violet for arcane, teal for void). */
  accent: number;
  /** Tints for spark particles. */
  sparks: number[];
  /** Tint of the additive halos around the crystal, the ball and the beam. */
  glow: number;
  /** Light2D colour cast by the crystal, the ball and the beam. */
  light: number;
  /** Brighter light for the moment of release. */
  flash: number;
  /** Halo tint once a held charge turns unstable. */
  unstable: number;
  /** A fizzled charge: its puff tint, sparks and light. */
  fizzle: number;
  fizzleSparks: number[];
  /** Emissive textures and animations of the energy ball and its impact. */
  orb: { texture: string; anim: string };
  burst: { texture: string; anim: string };
}

export const ARCANE_STYLE: SpellStyle = {
  core: 0xf2ffff,
  hot: 0x9ff6ff,
  mid: 0x39c6f0,
  deep: 0x3a5ce0,
  accent: 0x8a55f0,
  sparks: [0x9ff6ff, 0x39c6f0, 0x3a5ce0, 0x8a55f0],
  glow: 0x39c6f0,
  light: 0x6fe4ff,
  flash: 0xbff8ff,
  unstable: 0x7f6cf0,
  fizzle: 0xb49cff,
  fizzleSparks: [0xb49cff, 0x8a55f0, 0xf2ffff],
  orb: { texture: 'orb_e', anim: 'orb_spin' },
  burst: { texture: 'burst_e', anim: 'burst_pop' },
};

export const VOID_STYLE: SpellStyle = {
  core: 0xfff0ff,
  hot: 0xffa8f4,
  mid: 0xd05cf0,
  deep: 0x6a2fd0,
  accent: 0x6ff0e0,
  sparks: [0xffa8f4, 0xd05cf0, 0x6a2fd0, 0x6ff0e0],
  glow: 0xb04ae0,
  light: 0xc47cff,
  flash: 0xf4d4ff,
  unstable: 0x4fd0e0,
  fizzle: 0x7af0e0,
  fizzleSparks: [0x7af0e0, 0x3fb8c8, 0xfff0ff],
  orb: { texture: 'orb_void_e', anim: 'orb_void_spin' },
  burst: { texture: 'burst_void_e', anim: 'burst_void_pop' },
};

export const PYRO_STYLE: SpellStyle = {
  core: 0xfff8e0,
  hot: 0xffd66b,
  mid: 0xff9a2e,
  deep: 0xd9432b,
  accent: 0xffeeaa,
  sparks: [0xffd66b, 0xff9a2e, 0xd9432b, 0xfff8e0],
  glow: 0xff7a24,
  light: 0xff9a40,
  flash: 0xffd890,
  unstable: 0xff4a2a,
  fizzle: 0x8a6a60,
  fizzleSparks: [0x8a6a60, 0xff9a2e, 0xd9432b],
  orb: { texture: 'orb_pyro_e', anim: 'orb_pyro_spin' },
  burst: { texture: 'burst_pyro_e', anim: 'burst_pyro_pop' },
};

/** The Arcanist's Astral skin: starlight, white and gold with an indigo edge and rose motes. */
export const ASTRAL_STYLE: SpellStyle = {
  core: 0xfffdf2,
  hot: 0xfff0a8,
  mid: 0xffc860,
  deep: 0x6a5ae0,
  accent: 0xff9ad8,
  sparks: [0xfff0a8, 0xffc860, 0x6a5ae0, 0xff9ad8],
  glow: 0xffc860,
  light: 0xffe08a,
  flash: 0xfff4c8,
  unstable: 0x8a7aff,
  fizzle: 0x9a8ae0,
  fizzleSparks: [0x9a8ae0, 0x6a5ae0, 0xfffdf2],
  orb: { texture: 'orb_astral_e', anim: 'orb_astral_spin' },
  burst: { texture: 'burst_astral_e', anim: 'burst_astral_pop' },
};

/** The Pyromancer's Hellfire skin: fel fire, green burning down to deep green. */
export const HELL_STYLE: SpellStyle = {
  core: 0xf4ffe8,
  hot: 0xc8ff7a,
  mid: 0x5ee83a,
  deep: 0x1a8a3a,
  accent: 0xeaffb0,
  sparks: [0xc8ff7a, 0x5ee83a, 0x1a8a3a, 0xf4ffe8],
  glow: 0x46d83a,
  light: 0x7aff5a,
  flash: 0xd8ffa0,
  unstable: 0x2ab83a,
  fizzle: 0x5a6a58,
  fizzleSparks: [0x5a6a58, 0x5ee83a, 0x1a8a3a],
  orb: { texture: 'orb_hell_e', anim: 'orb_hell_spin' },
  burst: { texture: 'burst_hell_e', anim: 'burst_hell_pop' },
};

/** The Druid's Grovekeeper: sunlit green deepening to forest, flecked with gold. */
export const GROVE_STYLE: SpellStyle = {
  core: 0xf6ffe0,
  hot: 0xd8ff8a,
  mid: 0x7ee05a,
  deep: 0x2e8a4a,
  accent: 0xffd66b,
  sparks: [0xd8ff8a, 0x7ee05a, 0x2e8a4a, 0xffd66b],
  glow: 0x5ed84a,
  light: 0x9aff6a,
  flash: 0xe0ffb0,
  unstable: 0xffd66b,
  fizzle: 0x8a9a6a,
  fizzleSparks: [0x8a9a6a, 0x7ee05a, 0x2e8a4a],
  orb: { texture: 'orb_grove_e', anim: 'orb_grove_spin' },
  burst: { texture: 'burst_grove_e', anim: 'burst_grove_pop' },
};

/** The Druid's Shapeshifter: amber spirit light burning down to russet. */
export const WILD_STYLE: SpellStyle = {
  core: 0xfff6e0,
  hot: 0xffd27a,
  mid: 0xf09a3a,
  deep: 0x8a3a1e,
  accent: 0xfff0c0,
  sparks: [0xffd27a, 0xf09a3a, 0x8a3a1e, 0xfff0c0],
  glow: 0xf08a30,
  light: 0xffb050,
  flash: 0xffe0a0,
  unstable: 0xff6a2a,
  fizzle: 0x8a7060,
  fizzleSparks: [0x8a7060, 0xf09a3a, 0x8a3a1e],
  orb: { texture: 'orb_wild_e', anim: 'orb_wild_spin' },
  burst: { texture: 'burst_wild_e', anim: 'burst_wild_pop' },
};

/** The Grovekeeper's Autumn Warden skin: ember orange and gold, deepening to rust. */
export const AUTUMN_STYLE: SpellStyle = {
  core: 0xfff4e0,
  hot: 0xffc870,
  mid: 0xf0803a,
  deep: 0x9a3a1a,
  accent: 0xffe08a,
  sparks: [0xffc870, 0xf0803a, 0x9a3a1a, 0xffe08a],
  glow: 0xf07a2a,
  light: 0xffa050,
  flash: 0xffdca0,
  unstable: 0xd8401e,
  fizzle: 0x8a6a58,
  fizzleSparks: [0x8a6a58, 0xf0803a, 0x9a3a1a],
  orb: { texture: 'orb_autumn_e', anim: 'orb_autumn_spin' },
  burst: { texture: 'burst_autumn_e', anim: 'burst_autumn_pop' },
};

/** The Shapeshifter's Frostfang skin: ice, white and pale blue, deepening to a winter night. */
export const FROST_STYLE: SpellStyle = {
  core: 0xf0faff,
  hot: 0xb8e8ff,
  mid: 0x5ab8f0,
  deep: 0x2a5aa8,
  accent: 0xe0f6ff,
  sparks: [0xb8e8ff, 0x5ab8f0, 0x2a5aa8, 0xf0faff],
  glow: 0x4aa8f0,
  light: 0x8ad0ff,
  flash: 0xd8f2ff,
  unstable: 0x7a6aff,
  fizzle: 0x6a7a90,
  fizzleSparks: [0x6a7a90, 0x5ab8f0, 0x2a5aa8],
  orb: { texture: 'orb_frost_e', anim: 'orb_frost_spin' },
  burst: { texture: 'burst_frost_e', anim: 'burst_frost_pop' },
};

/** The Tidecaller: sea water, white foam through clear aqua down to the deep blue. */
export const TIDE_STYLE: SpellStyle = {
  core: 0xf0ffff,
  hot: 0x9cf4ff,
  mid: 0x2ec4e0,
  deep: 0x1a5ab8,
  accent: 0xe8fff8,
  sparks: [0x9cf4ff, 0x2ec4e0, 0x1a5ab8, 0xf0ffff],
  glow: 0x2ab4e0,
  light: 0x6ae0ff,
  flash: 0xc8faff,
  unstable: 0x3a6ae0,
  fizzle: 0x5a8a9a,
  fizzleSparks: [0x5a8a9a, 0x2ec4e0, 0xf0ffff],
  orb: { texture: 'orb_tide_e', anim: 'orb_tide_spin' },
  burst: { texture: 'burst_tide_e', anim: 'burst_tide_pop' },
};

/** The Tidecaller's Abyssal skin: the living light of the deep, cold teal with a violet dark. */
export const ABYSS_STYLE: SpellStyle = {
  core: 0xf0fffc,
  hot: 0xa8fff0,
  mid: 0x3ae0d0,
  deep: 0x5a2ab8,
  accent: 0xc8a8ff,
  sparks: [0xa8fff0, 0x3ae0d0, 0x5a2ab8, 0xc8a8ff],
  glow: 0x2ad0c0,
  light: 0x5af0e0,
  flash: 0xc8fff4,
  unstable: 0x8a4af0,
  fizzle: 0x4a4a6a,
  fizzleSparks: [0x4a4a6a, 0x3ae0d0, 0x5a2ab8],
  orb: { texture: 'orb_abyss_e', anim: 'orb_abyss_spin' },
  burst: { texture: 'burst_abyss_e', anim: 'burst_abyss_pop' },
};
