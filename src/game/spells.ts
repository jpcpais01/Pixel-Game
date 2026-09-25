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
