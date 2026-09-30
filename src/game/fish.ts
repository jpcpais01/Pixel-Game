// Fish: caught with the rod in a bucket (a Home part) cast into any water
// within three squares of it. A few are common, some rare, and one is a
// legend that fights like nothing else; some only bite at certain times of
// day. What the player has landed is saved with the rest of their collection
// (see collection.ts); the Inventory's Fish page shows them mounted on
// plaques. The world side is world/Fishing.ts, the minigame's overlay
// scenes/FishScene.ts, and the art art/fish.ts.

import { hex, type RGB } from '../art/pixel';
import type { Phase } from './daynight';

export type FishRarity = 'common' | 'rare' | 'legendary';

export interface FishDef {
  id: string;
  name: string;
  rarity: FishRarity;
  /** The times of day it bites (every one if 'any'). */
  when: Phase[] | 'any';
  /** How hard it fights on the line, 0..1: how fast and wild it darts, and how small the reel's zone is. */
  pull: number;
  /** Its colour for sparkles and its name. */
  tint: number;
  /** The light it gives off, if it glows (its plaque and the leap glow with it). */
  glow?: RGB;
  /** Where and when to find it, for its plaque before it's landed. */
  hint: string;
  /** A line about it on the card when it's landed. */
  line: string;
}

export const FISH: FishDef[] = [
  { id: 'minnow', name: 'Silver Minnow', rarity: 'common', when: 'any', pull: 0.12, tint: 0xc8d8e8, hint: 'Any water, any hour', line: 'Small, quick and everywhere.' },
  { id: 'perch', name: 'Reed Perch', rarity: 'common', when: ['morning', 'day'], pull: 0.3, tint: 0xb8d05a, hint: 'By day', line: 'Striped like the reeds it hides in.' },
  { id: 'sunfish', name: 'Sunfish', rarity: 'common', when: ['day'], pull: 0.25, tint: 0xffa040, hint: 'In the full sun', line: 'Wears the noon on its belly.' },
  { id: 'carp', name: 'Mud Carp', rarity: 'common', when: 'any', pull: 0.4, tint: 0xd0a050, hint: 'Any water, any hour', line: 'Old, slow and very stubborn.' },
  { id: 'catfish', name: 'Whiskercat', rarity: 'common', when: ['sunset', 'night'], pull: 0.45, tint: 0x9aa8b0, hint: 'From sunset into the night', line: 'Hunts by whisker in the dark.' },
  { id: 'trout', name: 'Rainbow Trout', rarity: 'rare', when: ['morning'], pull: 0.55, tint: 0xff8ab0, hint: 'Early in the morning, rarely', line: 'It keeps the first light of day.' },
  { id: 'koi', name: 'Koi', rarity: 'rare', when: ['morning', 'day'], pull: 0.5, tint: 0xff7a3a, hint: 'By day, rarely', line: 'Said to bring a year of luck.' },
  { id: 'pike', name: 'Pike', rarity: 'rare', when: ['day', 'sunset'], pull: 0.72, tint: 0x9ac05a, hint: 'Day and sunset, rarely', line: 'All teeth and temper.' },
  { id: 'emberfin', name: 'Emberfin', rarity: 'rare', when: ['sunset'], pull: 0.6, tint: 0xff8a2a, glow: hex('#ff9a3a'), hint: 'Only at sunset', line: 'Its fins still hold the dusk.' },
  { id: 'moonscale', name: 'Moonscale', rarity: 'rare', when: ['night'], pull: 0.6, tint: 0xb8d8ff, glow: hex('#a8d0ff'), hint: 'Only at night', line: 'Silver as the moon on water.' },
  { id: 'glasseel', name: 'Glass Eel', rarity: 'rare', when: ['night'], pull: 0.66, tint: 0x9af0e0, glow: hex('#7af0d0'), hint: 'Only at night', line: 'You can see its heart glow.' },
  { id: 'goldmaw', name: 'Goldmaw', rarity: 'legendary', when: 'any', pull: 0.95, tint: 0xffd060, glow: hex('#ffc848'), hint: 'Once in a very long while', line: 'The old king of every pond.' },
];

export const fishById = (id: string): FishDef | undefined => FISH.find((f) => f.id === id);

/** How likely each rarity is to bite: the legend a little likelier after dark. */
const RARE_CHANCE = 0.22;
const LEGEND_CHANCE = 0.02;
const LEGEND_NIGHT = 0.035;

/** The fish biting at this time of day. */
export const fishPool = (phase: Phase): FishDef[] => FISH.filter((f) => f.when === 'any' || f.when.includes(phase));

/** Which fish takes the bait now: a rarity first, then any of that rarity biting at this hour. */
export function rollFish(phase: Phase, rand = Math.random): FishDef {
  const pool = fishPool(phase);
  const r = rand();
  const legend = phase === 'night' ? LEGEND_NIGHT : LEGEND_CHANCE;
  const rarity: FishRarity = r < legend ? 'legendary' : r < legend + RARE_CHANCE ? 'rare' : 'common';
  const some = pool.filter((f) => f.rarity === rarity);
  const from = some.length ? some : pool.filter((f) => f.rarity === 'common');
  return from[Math.floor(rand() * from.length)] ?? FISH[0];
}

/** A rarity's rank, for sounds and shows: 0 common, 1 rare, 2 legendary. */
export const fishTier = (f: FishDef): number => (f.rarity === 'legendary' ? 2 : f.rarity === 'rare' ? 1 : 0);

// The fishing state shared by the world (world/Fishing.ts, which runs it),
// its overlay (scenes/FishScene.ts, which draws it and takes the reel's
// presses) and the HUD (the touch button, UIScene).

export type FishPhase = 'idle' | 'ready' | 'cast' | 'wait' | 'bite' | 'reel' | 'landed' | 'lost';

export const fishHud = {
  /** A rod by the water is in reach: the touch button shows (E on a keyboard). */
  near: false,
  /** Fishing: the overlay shows, the hero stands with the rod. */
  active: false,
  phase: 'idle' as FishPhase,
  /** ms spent in this phase. */
  t: 0,
  /** The reel is held (a press anywhere, or Space/E): written by the overlay. */
  hold: false,
  /** A press just began: to hook a bite, or to cast again. The world takes it. */
  press: false,
  /** Put the rod away: the overlay's button, Esc, or walking off. The world takes it. */
  stop: false,
  // The reel: everything from 0 (bottom of the gauge) to 1 (top).
  /** The catch zone's bottom, and its height. */
  zone: 0,
  zoneH: 0.3,
  /** Where the fish is, and whether it's heading up. */
  fish: 0.5,
  rising: false,
  /** How close it is to landing: full lands it, empty loses it. */
  progress: 0.3,
  /** The fish on the line is the legend (a bigger shadow in the gauge). */
  big: false,
  /** What was landed, and whether it's the first of its kind; set as the landing shows. */
  landed: null as { id: string; first: boolean } | null,
  /** A short line for the player ("Too soon..."), and how long it has left to show. */
  message: '',
  messageT: 0,
};

/** Say something over the fishing for a moment. */
export function fishSay(text: string, ms = 1600): void {
  fishHud.message = text;
  fishHud.messageT = ms;
}
