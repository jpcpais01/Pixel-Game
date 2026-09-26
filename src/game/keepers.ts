// The Rune Temple's two keepers, as the world and the HUD share them: the
// world asks for a keeper's counter when the hero walks up to them, and the
// HUD opens it (see ui/keeperHud.ts).

export type Keeper = 'disenchant' | 'upgrade';

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
};

export const keeperCall = {
  /** The counter the world wants open; the HUD takes it. */
  want: null as Keeper | null,
  /** The counter open now, if any. */
  open: null as Keeper | null,
  /** The hero walked away from the keeper: the HUD closes their counter. */
  leave: false,
};
