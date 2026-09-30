// Companions: small creatures won from the Wishing Nest (the shop's second
// banner) that follow the hero on every run. The rare ones give one gentle
// perk. Most epics and every legendary have a power of their own, played out
// by Companion.ts: the wyrmling spits crystal shards, the phoenix chick
// rekindles the hero once a run, the yeti cub stamps out frost that slows
// foes, the storm cloud zaps them, the old turtle wards off a blow, the
// fairy mends wounds, the gryphon swoops on foes, the krakling lashes them
// with its tentacles, and the mimic coughs up gems. Companions have their own
// wishes: the same prices, rarities and odds as skins, with their own count
// toward a legendary.

import { collection } from './collection';
import { DUPE_GEMS, PITY, RARITY_INFO, WISH10_COST, WISH_COST, type SkinRarity } from './gacha';

/** What the worn companion adds; the world reads these. 1 (or 0) with none. */
export interface PetMods {
  damage: number;
  speed: number;
  /** Multiplies the damage the hero takes. */
  guard: number;
  /** Health a second. */
  regen: number;
  /** Multiplies Special energy from kills. */
  energy: number;
  /** Multiplies the chance of gems from kills. */
  luck: number;
  /** Multiplies how far loot on the ground is drawn to the hero. */
  reach: number;
}

/**
 * What a companion does beyond its perk (see Companion.ts): stamp out a ring
 * of frost, zap foes, ward off the next blow, mend the hero, swoop on foes,
 * lash them with tentacles, or cough up a gem when gems are picked up.
 */
export type PetPower = 'chill' | 'zap' | 'ward' | 'mend' | 'dive' | 'lash' | 'hoard';

export interface PetDef {
  id: string;
  name: string;
  rarity: SkinRarity;
  /** Its perk, in a few words, for its card. */
  perk: string;
  mods: Partial<PetMods>;
  /** How it gets about: flying (it hovers), hopping, or walking. */
  gait: 'fly' | 'hop' | 'walk';
  /** The colour of the light it gives off, and of its sparkles. */
  tint: number;
  /** The wyrmling: spits crystal shards at foes near the hero. */
  fights?: boolean;
  /** The phoenix chick: rekindles the hero once a run. */
  rebirth?: boolean;
  power?: PetPower;
}

export const PETS: PetDef[] = [
  { id: 'slime', name: 'Jelly', rarity: 'rare', perk: 'Slow healing', mods: { regen: 0.4 }, gait: 'hop', tint: 0x8ef08a },
  { id: 'bunny', name: 'Mossbun', rarity: 'rare', perk: '+5% speed', mods: { speed: 1.05 }, gait: 'hop', tint: 0xb8f06a },
  { id: 'pebble', name: 'Pebble', rarity: 'rare', perk: '6% less harm', mods: { guard: 0.94 }, gait: 'walk', tint: 0x6fe4ff },
  { id: 'owl', name: 'Owlet', rarity: 'rare', perk: 'More gems', mods: { luck: 1.5 }, gait: 'fly', tint: 0xffd070 },
  { id: 'fox', name: 'Kitsune', rarity: 'epic', perk: '+7% damage', mods: { damage: 1.07 }, gait: 'walk', tint: 0x8ad8ff },
  { id: 'wisp', name: 'Starwisp', rarity: 'epic', perk: '+25% energy', mods: { energy: 1.25 }, gait: 'fly', tint: 0xffe08a },
  { id: 'wyrm', name: 'Wyrmling', rarity: 'legendary', perk: 'Fights for you', mods: { damage: 1.05 }, gait: 'fly', tint: 0xc890ff, fights: true },
  { id: 'phoenix', name: 'Phoenix', rarity: 'legendary', perk: 'Revives once', mods: { speed: 1.05 }, gait: 'fly', tint: 0xffb850, rebirth: true },
  { id: 'crab', name: 'Snapclaw', rarity: 'rare', perk: '5% less harm', mods: { guard: 0.95 }, gait: 'walk', tint: 0xffa878 },
  { id: 'frog', name: 'Lilyhop', rarity: 'rare', perk: '+15% energy', mods: { energy: 1.15 }, gait: 'hop', tint: 0xf69ad0 },
  { id: 'bat', name: 'Duskwing', rarity: 'rare', perk: '+6% speed', mods: { speed: 1.06 }, gait: 'fly', tint: 0xe0b0ff },
  { id: 'shroom', name: 'Puffcap', rarity: 'rare', perk: 'Slow healing', mods: { regen: 0.5 }, gait: 'hop', tint: 0xfff0a0 },
  { id: 'scarab', name: 'Scarab', rarity: 'rare', perk: 'Pulls in loot', mods: { reach: 2.2, luck: 1.15 }, gait: 'walk', tint: 0xffd060 },
  { id: 'yeti', name: 'Snowpaw', rarity: 'epic', perk: 'Chills foes', mods: {}, gait: 'walk', tint: 0x9ae4ff, power: 'chill' },
  { id: 'cloud', name: 'Nimbus', rarity: 'epic', perk: 'Zaps foes', mods: {}, gait: 'fly', tint: 0xfff080, power: 'zap' },
  { id: 'turtle', name: 'Mossback', rarity: 'epic', perk: 'Blocks a blow', mods: {}, gait: 'walk', tint: 0x5ae8d8, power: 'ward' },
  { id: 'pixie', name: 'Pixie', rarity: 'epic', perk: 'Mends wounds', mods: {}, gait: 'fly', tint: 0xb8ffb0, power: 'mend' },
  { id: 'gryphon', name: 'Gryphon', rarity: 'legendary', perk: 'Swoops on foes', mods: { damage: 1.04 }, gait: 'fly', tint: 0xffd070, power: 'dive' },
  { id: 'kraken', name: 'Krakling', rarity: 'legendary', perk: 'Lashes foes', mods: { guard: 0.96 }, gait: 'fly', tint: 0x5ae8ff, power: 'lash' },
  { id: 'mimic', name: 'Mimic', rarity: 'legendary', perk: 'Coughs up gems', mods: { luck: 1.4 }, gait: 'hop', tint: 0xffc030, power: 'hoard' },
];

export const petById = (id: string): PetDef | undefined => PETS.find((p) => p.id === id);

const NEUTRAL: PetMods = { damage: 1, speed: 1, guard: 1, regen: 0, energy: 1, luck: 1, reach: 1 };

export const petMods: PetMods = { ...NEUTRAL };

/** The worn companion's perk counts from now on (none: nothing). */
export function wearPet(def: PetDef | undefined): void {
  Object.assign(petMods, NEUTRAL, def?.mods ?? {});
}

/** How many companions the player owns, out of all of them. */
export function ownedPets(): { owned: number; of: number } {
  return { owned: PETS.filter((p) => collection.hasPet(p.id)).length, of: PETS.length };
}

export interface PetWishResult {
  pet: PetDef;
  fresh: boolean;
  refund: number;
}

function rollRarity(): SkinRarity {
  let r = Math.random();
  for (const k of ['legendary', 'epic'] as const) {
    r -= RARITY_INFO[k].odds;
    if (r < 0) return k;
  }
  return 'rare';
}

const pick = <T>(of: T[]): T => of[Math.floor(Math.random() * of.length)];

/**
 * Make `count` companion wishes (1 or 10), the way skin wishes work: spend
 * the gems, roll, give each companion (or half a wish's gems for one owned).
 * Ten at once hold an epic or better; a legendary comes within PITY wishes.
 * Null when there aren't gems enough.
 */
export function petWish(count: 1 | 10): PetWishResult[] | null {
  if (!collection.spendGems(count === 10 ? WISH10_COST : WISH_COST)) return null;
  const rarities: SkinRarity[] = [];
  let pity = collection.petPity;
  for (let i = 0; i < count; i++) {
    let r = rollRarity();
    if (pity + 1 >= PITY) r = 'legendary';
    if (count === 10 && i === count - 1 && r === 'rare' && !rarities.some((x) => x !== 'rare')) r = 'epic';
    pity = r === 'legendary' ? 0 : pity + 1;
    rarities.push(r);
  }
  collection.petPity = pity;
  let refund = 0;
  const out = rarities.map((r) => {
    const pet = pick(PETS.filter((p) => p.rarity === r));
    const fresh = collection.unlockPet(pet.id);
    // The first companion won comes along at once.
    if (fresh && !collection.pet) collection.pet = pet.id;
    const back = fresh ? 0 : DUPE_GEMS;
    refund += back;
    return { pet, fresh, refund: back };
  });
  collection.addGems(refund);
  return out;
}
