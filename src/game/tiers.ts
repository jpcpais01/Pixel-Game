// Mob tiers: every monster is Weak, Normal, Strong, a Legend or a Myth, and
// its tier decides what it drops (see GearBag.roll in gear.ts). A new monster
// gets one line in MOB_TIER; one left out counts as Normal.

import type { Rarity } from './gear';

export type Tier = 'weak' | 'normal' | 'strong' | 'legend' | 'myth';

export const TIER_NAME: Record<Tier, string> = {
  weak: 'Weak',
  normal: 'Normal',
  strong: 'Strong',
  legend: 'Legend',
  myth: 'Myth',
};

/**
 * Each tier's chance, per kill, of dropping one piece of each rarity. One roll
 * picks at most one rarity; whatever is left over is no drop.
 */
export const TIER_DROPS: Record<Tier, Record<Rarity, number>> = {
  weak: { common: 0.1, uncommon: 0.05, rare: 0.03, epic: 0.02, legendary: 0.01 },
  normal: { common: 0.15, uncommon: 0.1, rare: 0.05, epic: 0.03, legendary: 0.01 },
  strong: { common: 0.1, uncommon: 0.2, rare: 0.1, epic: 0.05, legendary: 0.03 },
  legend: { common: 0, uncommon: 0.1, rare: 0.5, epic: 0.3, legendary: 0.1 },
  myth: { common: 0, uncommon: 0, rare: 0.2, epic: 0.5, legendary: 0.3 },
};

/** Chance a Legend or Myth with an item set also drops a piece of it, rolled on its own. */
export const TIER_SET_CHANCE: Record<Tier, number> = { weak: 0, normal: 0, strong: 0, legend: 0.5, myth: 1 };

/** Every monster's tier, by kind. */
export const MOB_TIER: Record<string, Tier> = {
  // Plaza and the old forest.
  frog: 'weak',
  puffcap: 'weak',
  glowmoth: 'weak',
  beetle: 'strong',
  barkling: 'strong',
  // Spirit Dungeon.
  wisp: 'weak',
  banshee: 'normal',
  shade: 'normal',
  queen: 'legend',
  // Elementinho Temple.
  blob_water: 'weak',
  blob_fire: 'weak',
  blob_earth: 'weak',
  blob_air: 'weak',
  gale: 'normal',
  undine: 'normal',
  salamander: 'normal',
  golem: 'strong',
  elementinho: 'legend',
  // Cosmos Arena.
  warden: 'myth',
  // The Glimmerdeep.
  sporeling: 'weak',
  glimbat: 'weak',
  shardling: 'normal',
  myconid: 'normal',
  geodeback: 'strong',
  sporemother: 'legend',
  wyrm: 'myth',
  // Hallow's Eve (October), in every arena.
  gourdling: 'weak',
  hexbat: 'weak',
  pumpkin_king: 'legend',
};

export const tierOf = (kind: string): Tier => MOB_TIER[kind] ?? 'normal';

/**
 * Each tier's numbers, set against an average hero (Damage 10, 100 HP): `hp`
 * and `defense` decide how many blows it takes (weak 3, normal 6, strong 15,
 * a Legend about 130, a Myth about 240), `hit` how hard its main attack lands
 * before the hero's own Defense. Defense works as on heroes: damage taken is
 * multiplied by 100 / (100 + Defense).
 */
export const TIER_STATS: Record<Tier, { hp: number; hit: number; defense: number }> = {
  weak: { hp: 30, hit: 8, defense: 0 },
  normal: { hp: 55, hit: 11, defense: 5 },
  strong: { hp: 140, hit: 17, defense: 10 },
  legend: { hp: 1150, hit: 20, defense: 15 },
  myth: { hp: 2000, hit: 26, defense: 20 },
};

/**
 * A monster's size within its tier: its health is the tier's times this
 * (0.75 to 1.3, like a hero's budget allows some spread). One left out is 1.
 */
export const MOB_BULK: Record<string, number> = {
  frog: 1.1,
  puffcap: 1.3,
  glowmoth: 1.05,
  wisp: 0.9,
  blob_water: 1,
  blob_fire: 0.9,
  blob_earth: 1.3,
  blob_air: 0.75,
  sporeling: 0.8,
  glimbat: 0.75,
  banshee: 0.95,
  shade: 1.3,
  gale: 0.8,
  undine: 1,
  salamander: 1.3,
  shardling: 0.9,
  myconid: 1.1,
  beetle: 0.8,
  barkling: 0.95,
  golem: 1.3,
  geodeback: 1.3,
  queen: 1,
  elementinho: 1.1,
  sporemother: 1.2,
  warden: 0.9,
  wyrm: 1.3,
  gourdling: 1,
  hexbat: 0.85,
  pumpkin_king: 1.1,
};

/** A monster's full health: its tier's, times its bulk. */
export const mobHp = (kind: string): number => Math.round(TIER_STATS[tierOf(kind)].hp * (MOB_BULK[kind] ?? 1));

/** What one of its attacks deals: its tier's hit times `k` (1 for its main attack). */
export const mobHit = (kind: string, k = 1): number => Math.round(TIER_STATS[tierOf(kind)].hit * k);

/** A monster's Defense, from its tier. */
export const mobDefense = (kind: string): number => TIER_STATS[tierOf(kind)].defense;

/** Each tier's chance, per kill, of dropping gems, and how many (each count in the range equally likely). */
export const TIER_GEMS: Record<Tier, { chance: number; min: number; max: number }> = {
  weak: { chance: 0.001, min: 1, max: 1 },
  normal: { chance: 0.005, min: 1, max: 2 },
  strong: { chance: 0.01, min: 1, max: 3 },
  legend: { chance: 0.05, min: 2, max: 5 },
  myth: { chance: 1, min: 5, max: 20 },
};

/** How many gems a slain monster of `kind` drops: usually none. */
export function rollGems(kind: string, luck = 1): number {
  const g = TIER_GEMS[tierOf(kind)];
  // Luck (a companion's) makes gems likelier, never more at once.
  if (Math.random() >= Math.min(1, g.chance * luck)) return 0;
  return g.min + Math.floor(Math.random() * (g.max - g.min + 1));
}
