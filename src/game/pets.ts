// Companions: small creatures won from the Wishing Nest (the shop's second
// banner) that follow the hero on every run. Each gives one gentle perk; the
// two legendaries do more: the wyrmling spits crystal shards at foes near
// the hero, and the phoenix chick rekindles the hero once a run instead of
// letting them fall. Companions have their own wishes: the same prices,
// rarities and odds as skins, with their own count toward a legendary.

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
}

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
  /** A seasonal companion (a season's id, see season.ts): bought at its stall, never wished for. */
  season?: string;
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
  // Hallow's Eve's, sold for candy at Old Wick's stall.
  { id: 'pumpling', name: 'Pumpling', rarity: 'epic', perk: '+20% energy', mods: { energy: 1.2 }, gait: 'hop', tint: 0xff9a3a, season: 'hallows' },
  { id: 'hexcat', name: 'Hexcat', rarity: 'epic', perk: '+6% damage', mods: { damage: 1.06 }, gait: 'walk', tint: 0xb07aff, season: 'hallows' },
];

export const petById = (id: string): PetDef | undefined => PETS.find((p) => p.id === id);

const NEUTRAL: PetMods = { damage: 1, speed: 1, guard: 1, regen: 0, energy: 1, luck: 1 };

export const petMods: PetMods = { ...NEUTRAL };

/** The worn companion's perk counts from now on (none: nothing). */
export function wearPet(def: PetDef | undefined): void {
  Object.assign(petMods, NEUTRAL, def?.mods ?? {});
}

/** How many companions the player owns, out of all of them (a season's count once owned). */
export function ownedPets(): { owned: number; of: number } {
  const owned = PETS.filter((p) => collection.hasPet(p.id));
  return { owned: owned.length, of: PETS.filter((p) => !p.season).length + owned.filter((p) => p.season).length };
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
    const pet = pick(PETS.filter((p) => p.rarity === r && !p.season));
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
