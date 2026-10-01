// The Rune Temple's two keepers and the Forge's smith, as the world and the
// HUD share them: the world asks for a keeper's counter when the hero walks up
// to them, and the HUD opens it (see ui/keeperHud.ts). A season's stall keeper
// in the Clearing, and Hazel the Naturalist at her camp, open counters the
// same way.

export type Keeper = 'disenchant' | 'upgrade' | 'forge';

export const KEEPERS: Record<Keeper, { name: string; title: string; tint: number; texture: string; hello: string }> = {
  disenchant: {
    name: 'Nyx',
    title: 'the Unmaker',
    tint: 0xc9a0ff,
    texture: 'rs_nyx',
    hello: 'Everything made can be unmade. Give me what you no longer wear, and I will give you its dust.',
  },
  upgrade: {
    name: 'Tharn',
    title: 'the Runesmith',
    tint: 0xffc86a,
    texture: 'rs_tharn',
    hello: 'Bring me dust and a fine piece, and I will beat another rune into it. Pick where its strength goes.',
  },
  forge: {
    name: 'Brenna',
    title: 'the Forgemaster',
    tint: 0xff9a4a,
    texture: 'fg_brenna',
    hello: 'The great beasts leave something of themselves behind. Bring it to me with some dust, and I will forge the piece fate keeps from you.',
  },
};

/** Hazel, who buys spare critters at her camp on the Clearing's east lawn (see world/Naturalist.ts and ui/critterView.ts). */
export const NATURALIST = {
  name: 'Hazel',
  title: 'the Naturalist',
  tint: 0x9ad870,
  texture: 'nt_hazel',
  hello: 'Every creature in Aurendel has a story. Keep the first of each kind in its jar and bring me your spares. I pay in dust, and handsomely for rare ones.',
};

/** A counter the HUD can open: a Rune Temple keeper's, Hazel's, a season's stall (see season.ts and ui/candyView.ts), or the Home's kitchen (ui/cookView.ts). */
export type Counter = Keeper | 'candy' | 'critters' | 'kitchen';

export const keeperCall = {
  /** The counter the world wants open; the HUD takes it. */
  want: null as Counter | null,
  /** The counter open now, if any. */
  open: null as Counter | null,
  /** The hero walked away from the keeper: the HUD closes their counter. */
  leave: false,
};
