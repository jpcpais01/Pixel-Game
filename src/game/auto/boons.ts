// Boons: every third round of an Auto Battle (3, 6, 9...) each player is
// offered three and keeps one for the rest of the match. A pick is all one
// tier: silver first, then gold, then prism, then gold and prism by turns.
// Some pay out at once (gold, XP, a hero), some change the shop and income
// (match.ts), and some go into every fight (sim.ts reads `fightMods`, so they
// travel with the board online and both screens play the same fight).

import { TRAITS, TRAIT_IDS, type TraitId } from './units';

export type BoonTier = 0 | 1 | 2;

/** Boons are offered at the start of these rounds' planning: every `BOON_EVERY` from `BOON_EVERY` on. */
export const BOON_EVERY = 3;
/** Extra planning seconds on a boon round, to read the cards. */
export const BOON_SECONDS = 15;
/** Cards in an offer. */
export const BOON_OFFER = 3;
/** Most boons one player can hold (a guard on what's sent online). */
export const MAX_BOONS = 16;

export const TIER_NAMES = ['Silver', 'Gold', 'Prism'];

export interface BoonDef {
  id: string;
  name: string;
  tier: BoonTier;
  /** What it does, in a short sentence for the card. */
  text: string;
  /** Its picture (art/boonArt.ts). */
  icon: string;
  /** A crest's trait. */
  trait?: TraitId;
}

const def = (id: string, tier: BoonTier, name: string, text: string, icon = id): BoonDef => ({ id, tier, name, text, icon });

const LIST: BoonDef[] = [
  // Silver: a step up.
  def('purse', 0, 'Coin Purse', '10 gold now'),
  def('tome', 0, 'Old Tome', '6 XP now, and 1 more XP every round'),
  def('dice', 0, "Fate's Dice", 'Your next 4 rerolls are free'),
  def('titan', 0, "Titan's Blood", 'Your heroes have 20% more HP'),
  def('drums', 0, 'War Drums', 'Your heroes attack 15% faster'),
  def('spring', 0, 'Mana Spring', 'Your heroes start fights with 30 mana'),
  // Gold: a real turn in the match.
  def('goose', 1, 'Golden Goose', '3 more gold every round'),
  def('clover', 1, 'Lucky Clover', 'Your first reroll each round is free'),
  def('hoard', 1, "Dragon's Hoard", 'Interest goes up to 5 gold'),
  def('banner', 1, "Warlord's Banner", 'Your heroes deal 15% more damage'),
  def('aegis', 1, 'Aegis', 'Your heroes start fights with a 25% barrier'),
  def('pact', 1, 'Blood Pact', 'Your heroes heal 12% of the damage they deal'),
  def('axe', 1, 'Executioner', '35% more damage to foes under 35% HP'),
  def('lifeline', 1, 'Lifeline', 'Lost rounds cost 30% less health'),
  def('ascend', 1, 'Ascension', 'Your weakest 1-star hero on the board stars up'),
  // Prism: the rare ones that make a match.
  def('host', 2, 'Banner of the Host', 'One more hero on the board'),
  def('star', 2, 'Starforged', 'Starred heroes get 30% more HP and damage'),
  def('glass', 2, 'Glass Cannon', 'Your heroes deal 40% more damage but have 20% less HP'),
  def('ransom', 2, "King's Ransom", '25 gold now'),
  def('wish', 2, 'Wish of Legends', 'A random 5-cost hero joins your bench'),
];

/** Every boon by id, crests (one per trait) included. */
export const BOONS: Record<string, BoonDef> = Object.fromEntries(LIST.map((b) => [b.id, b]));
for (const t of TRAIT_IDS)
  BOONS[`crest_${t}`] = { id: `crest_${t}`, tier: 0, name: `${TRAITS[t].name} Crest`, text: `Your ${TRAITS[t].name} heroes count one more`, icon: 'crest', trait: t };

export const boonDef = (id: string): BoonDef | undefined => BOONS[id];

export const isBoonRound = (round: number): boolean => round >= BOON_EVERY && round % BOON_EVERY === 0;

/** The tier of a match's `n`th pick (0 first): silver, gold, prism, then gold and prism by turns. */
export const tierOf = (n: number): BoonTier => (n < 3 ? (n as BoonTier) : n % 2 === 1 ? 1 : 2);

/** The tier offered on a boon round. */
export const roundTier = (round: number): BoonTier => tierOf(Math.floor(round / BOON_EVERY) - 1);

/**
 * Three boons to choose from, all of `tier` where it has enough: none the
 * player holds, and at most one crest, for a trait they field.
 */
export function offerBoons(tier: BoonTier, held: string[], traits: TraitId[], rand: () => number): string[] {
  const free = (b: BoonDef) => !held.includes(b.id) && (!b.trait || traits.includes(b.trait));
  const pool = (t: BoonTier) => Object.values(BOONS).filter((b) => b.tier === t && free(b));
  const out: string[] = [];
  const take = (list: BoonDef[]) => {
    const left = list.filter((b) => !out.includes(b.id) && !(b.trait && out.some((o) => BOONS[o].trait)));
    if (!left.length) return false;
    // Crests are many; they come up about as often as one other boon, not one each.
    const weight = (b: BoonDef) => (b.trait ? 1 / Math.max(1, left.filter((x) => x.trait).length) : 1);
    let roll = rand() * left.reduce((a, b) => a + weight(b), 0);
    for (const b of left) {
      roll -= weight(b);
      if (roll < 0) return !!out.push(b.id);
    }
    return !!out.push(left[left.length - 1].id);
  };
  while (out.length < BOON_OFFER && take(pool(tier))) {
    /* drawing */
  }
  // A tier run dry (late in a long match) is topped up from the others.
  for (const t of [1, 2, 0] as BoonTier[]) while (out.length < BOON_OFFER && take(pool(t))) {
    /* topping up */
  }
  return out;
}

/** What a side's boons do to its heroes in a fight. */
export interface FightMods {
  hp: number;
  dmg: number;
  aps: number;
  mana: number;
  /** Barrier at the start, a share of max HP. */
  shield: number;
  /** Share of damage dealt healed back. */
  steal: number;
  /** Damage lift on foes under `EXECUTE_AT` of their HP. */
  exec: number;
  /** HP and damage lift for heroes of two stars or more. */
  starred: number;
}

export const EXECUTE_AT = 0.35;

export function fightMods(boons: readonly string[]): FightMods {
  const has = (id: string) => boons.includes(id);
  return {
    hp: (has('titan') ? 1.2 : 1) * (has('glass') ? 0.8 : 1),
    dmg: (has('banner') ? 1.15 : 1) * (has('glass') ? 1.4 : 1),
    aps: has('drums') ? 1.15 : 1,
    mana: has('spring') ? 30 : 0,
    shield: has('aegis') ? 0.25 : 0,
    steal: has('pact') ? 0.12 : 0,
    exec: has('axe') ? 1.35 : 1,
    starred: has('star') ? 1.3 : 1,
  };
}

/** Extra heroes counted toward traits by a player's crests. */
export function crestBonus(boons: readonly string[]): Map<TraitId, number> {
  const out = new Map<TraitId, number>();
  for (const id of boons) {
    const t = BOONS[id]?.trait;
    if (t) out.set(t, (out.get(t) ?? 0) + 1);
  }
  return out;
}

/** Health a lost round costs with these boons. */
export const lossTaken = (boons: readonly string[], dmg: number): number => (boons.includes('lifeline') && dmg > 0 ? Math.round(dmg * 0.7) : dmg);

/** Boons as sent online: known ids, no repeats, at most `MAX_BOONS`. */
export function cleanBoons(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    const id = String(v);
    if (BOONS[id] && !out.includes(id)) out.push(id);
    if (out.length >= MAX_BOONS) break;
  }
  return out;
}
