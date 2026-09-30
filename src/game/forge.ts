// The Forge in the Runestone Clearing: Brenna the Forgemaster turns dust and a
// boss's materials into the one piece of its set the player is still missing,
// so bad luck never keeps a set from being finished. Drops themselves stay as
// random as ever: each Legend or Myth with a set also drops its material, a
// few at a time, and that is all this adds to what falls.

import { GEAR_SETS, SET_BOSS, type SetId } from './gear';
import { tierOf, type Tier } from './tiers';

export interface MaterialDef {
  name: string;
  /** Its colour, for its name, its drop's light and its glow in the Forge. */
  tint: number;
}

/** One material per boss, named for what it leaves behind. */
export const MATERIALS: Record<SetId, MaterialDef> = {
  wraith: { name: 'Hollow Veil', tint: GEAR_SETS.wraith.tint },
  ember: { name: 'Ember Core', tint: GEAR_SETS.ember.tint },
  spore: { name: 'Spore Heart', tint: GEAR_SETS.spore.tint },
  geode: { name: 'Wyrm Shard', tint: GEAR_SETS.geode.tint },
  astral: { name: 'Star Fragment', tint: GEAR_SETS.astral.tint },
};

/** The order the Forge lists the sets in: roughly the order they are met. */
export const FORGE_SETS: SetId[] = ['wraith', 'ember', 'spore', 'geode', 'astral'];

/** What forging one set piece costs. A Legend drops 2-3 materials, so about four kills' worth; dust from a spare or two. */
export const FORGE_COST = { dust: 60, mats: 8 };

/** How many materials a slain boss drops, by its tier (each count in the range equally likely). */
const MAT_DROP: Partial<Record<Tier, [number, number]>> = { legend: [2, 3], myth: [3, 4] };

/** A material's icon is this many pixels square, flat (see art/forge.ts). */
export const MAT_SIZE = 16;

/** Its texture's key. */
export const matIcon = (set: SetId): string => `mat_${set}`;

/** The materials a slain monster of `kind` drops: only a boss with a set does. */
export function rollMats(kind: string): { set: SetId; n: number } | null {
  const set = SET_BOSS[kind];
  const range = set ? MAT_DROP[tierOf(kind)] : undefined;
  if (!set || !range) return null;
  return { set, n: range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1)) };
}
