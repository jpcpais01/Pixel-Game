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
};

export const tierOf = (kind: string): Tier => MOB_TIER[kind] ?? 'normal';
