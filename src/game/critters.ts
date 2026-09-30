// Critters: small creatures living in the arenas, caught with a net and kept
// in jars. Each arena has its own; some come out only by day or by night
// (in arenas with day and night), a few are rare, and two appear only while
// an Omen is running. What the player has caught is saved with the rest of
// their collection (see collection.ts); the Inventory's Critters page shows
// the jars. The world side is CritterField.ts.

import { hex, type RGB } from '../art/pixel';

export type CritterRarity = 'common' | 'rare' | 'omen' | 'secret';

export interface CritterDef {
  id: string;
  name: string;
  /** The arenas it lives in (for an Omen critter: every arena that has critters). */
  arenas: string[];
  /** When it's out, in arenas that have day and night. */
  when: 'day' | 'night' | 'any';
  rarity: CritterRarity;
  /** How it gets about: fluttering, crawling slowly, hopping, or scurrying. */
  gait: 'fly' | 'crawl' | 'hop' | 'walk';
  /** Its colour for sparkles and its jar's name. */
  tint: number;
  /** The light it gives off (its jar glows with it, like a lantern), if it glows. */
  glow?: RGB;
  /** Never out on its own: only where something brings it out (the Moon Hare, at its hollow). */
  secret?: boolean;
  /** Only out while this Omen runs (see setCritterOmen). */
  omen?: string;
  /** Where to find it, for its jar before it's caught. */
  hint: string;
}

export const CRITTERS: CritterDef[] = [
  { id: 'firefly', name: 'Firefly', arenas: ['clearing', 'forest'], when: 'night', rarity: 'common', gait: 'fly', tint: 0xd8ff5a, glow: hex('#d8ff5a'), hint: 'Clearing and Everwood, by night' },
  { id: 'butterfly', name: 'Sky Morpho', arenas: ['clearing', 'forest'], when: 'day', rarity: 'common', gait: 'fly', tint: 0x6ac0ff, hint: 'Clearing and Everwood, by day' },
  { id: 'ladybug', name: 'Ladybird', arenas: ['clearing', 'garden', 'forest'], when: 'day', rarity: 'common', gait: 'crawl', tint: 0xff6a58, hint: 'Clearing, Garden, Everwood, by day' },
  { id: 'moonmoth', name: 'Luna Moth', arenas: ['clearing', 'forest'], when: 'night', rarity: 'rare', gait: 'fly', tint: 0xc8ffe8, glow: hex('#a8f0d0'), hint: 'Clearing and Everwood, late at night' },
  { id: 'glowfrog', name: 'Glowfrog', arenas: ['garden'], when: 'any', rarity: 'common', gait: 'hop', tint: 0x8af0ff, glow: hex('#8af0ff'), hint: 'The Sunken Garden' },
  { id: 'dragonfly', name: 'Jewelwing', arenas: ['garden', 'island', 'forest'], when: 'day', rarity: 'common', gait: 'fly', tint: 0x6affb0, hint: 'Garden, Island and Everwood' },
  { id: 'pearlsnail', name: 'Pearl Snail', arenas: ['garden'], when: 'any', rarity: 'rare', gait: 'crawl', tint: 0xf0d8ff, hint: 'The Sunken Garden, rarely' },
  { id: 'starbeetle', name: 'Star Beetle', arenas: ['cosmos'], when: 'any', rarity: 'common', gait: 'crawl', tint: 0xc8d8ff, glow: hex('#8aa0ff'), hint: 'The Cosmos Arena' },
  { id: 'cometmoth', name: 'Comet Moth', arenas: ['cosmos'], when: 'any', rarity: 'rare', gait: 'fly', tint: 0xb8a0ff, glow: hex('#b8a0ff'), hint: 'The Cosmos Arena, rarely' },
  { id: 'ghostmoth', name: 'Ghost Moth', arenas: ['spirit'], when: 'any', rarity: 'common', gait: 'fly', tint: 0xa0e8f0, glow: hex('#a0e8f0'), hint: 'The Spirit Dungeon' },
  { id: 'candlemouse', name: 'Candle Mouse', arenas: ['spirit'], when: 'any', rarity: 'rare', gait: 'walk', tint: 0xffd070, glow: hex('#ffc060'), hint: 'The Spirit Dungeon, rarely' },
  { id: 'emberbeetle', name: 'Ember Beetle', arenas: ['temple'], when: 'any', rarity: 'common', gait: 'crawl', tint: 0xff9a3a, glow: hex('#ff8a2a'), hint: 'The Elementinho Temple' },
  { id: 'salamander', name: 'Salamander', arenas: ['temple'], when: 'any', rarity: 'rare', gait: 'walk', tint: 0xffa040, glow: hex('#ff9030'), hint: 'The Elementinho Temple, rarely' },
  { id: 'crystalbeetle', name: 'Crystal Beetle', arenas: ['deep'], when: 'any', rarity: 'common', gait: 'crawl', tint: 0xd8a8ff, glow: hex('#b37aff'), hint: 'The Glimmerdeep' },
  { id: 'sporepuff', name: 'Spore Puff', arenas: ['deep'], when: 'any', rarity: 'common', gait: 'fly', tint: 0xff9ae0, glow: hex('#6ae8f0'), hint: 'The Glimmerdeep' },
  { id: 'axolotl', name: 'Glowlotl', arenas: ['deep'], when: 'any', rarity: 'rare', gait: 'walk', tint: 0xff8ad8, glow: hex('#ff6ad8'), hint: 'The Glimmerdeep, rarely' },
  { id: 'bloodmoth', name: 'Blood Moth', arenas: [], when: 'any', rarity: 'omen', gait: 'fly', tint: 0xff4a4a, glow: hex('#ff4a4a'), omen: 'blood-moon', hint: 'Only under a Blood Moon' },
  { id: 'moonhare', name: 'Moon Hare', arenas: ['forest'], when: 'any', rarity: 'secret', gait: 'hop', tint: 0xd8f0ff, glow: hex('#b8e0ff'), secret: true, hint: 'Where the White Stag leads' },
  { id: 'goldscarab', name: 'Gold Scarab', arenas: [], when: 'any', rarity: 'omen', gait: 'crawl', tint: 0xffe070, glow: hex('#ffd060'), omen: 'golden-hour', hint: 'Only in the Golden Hour' },
];

export const critterById = (id: string): CritterDef | undefined => CRITTERS.find((c) => c.id === id);

/**
 * What Hazel the Naturalist pays in dust for each spare critter (see
 * world/Naturalist.ts): a little for a common one, well for a rare one, and
 * handsomely for one only an Omen brings out, and best of all for the Moon
 * Hare, which only the White Stag leads to. The first of each kind always
 * stays in its jar; only the ones caught after it are spares.
 */
export const CRITTER_PRICE: Record<CritterRarity, number> = { common: 2, rare: 10, omen: 25, secret: 40 };
/** How many of each kind the player keeps: the first one caught. */
export const CRITTER_KEEP = 1;

/** Arenas with critters of their own; Omen critters turn up in any of them. */
export const CRITTER_ARENAS = [...new Set(CRITTERS.flatMap((c) => c.arenas))];

/**
 * The Omen running now ('' for none). The Omens code calls setCritterOmen
 * when one begins and ends; while it runs, its critters come out in every
 * arena that has critters.
 */
let omen = '';

export function setCritterOmen(id: string | null): void {
  omen = id ?? '';
}

export const critterOmen = (): string => omen;

/** How much likelier each rarity is to be the one that comes out. */
const WEIGHT: Record<CritterRarity, number> = { common: 10, rare: 1.6, omen: 7, secret: 0 };

/**
 * The critters that can come out in `arena` now: by its time of day (0
 * night .. 1 day; only where the arena has day and night), and the Omen
 * running, if any. Each with how likely it is to be the next one.
 */
export function critterPool(arena: string, daylight: number, dayNight: boolean): { def: CritterDef; weight: number }[] {
  if (!CRITTER_ARENAS.includes(arena)) return [];
  // Morning counts as day; the night's critters come out from sunset on (sunset sits at 0.5).
  const day = daylight > 0.6;
  const night = daylight < 0.55;
  const out: { def: CritterDef; weight: number }[] = [];
  for (const def of CRITTERS) {
    if (def.omen) {
      if (def.omen === omen) out.push({ def, weight: WEIGHT.omen });
      continue;
    }
    if (!def.arenas.includes(arena) || def.secret) continue;
    if (dayNight && ((def.when === 'day' && !day) || (def.when === 'night' && !night))) continue;
    // Out of doors without day and night, the day-lovers come out when it's bright and the night ones never.
    if (!dayNight && ((def.when === 'day' && daylight < 0.5) || (def.when === 'night' && daylight >= 0.5))) continue;
    out.push({ def, weight: WEIGHT[def.rarity] });
  }
  return out;
}
