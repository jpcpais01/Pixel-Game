// Farming: seeds sown on garden bed floor grow in real time, through four
// stages (a sown mound with its marker, a sprout, a young plant, ripe), even
// while the game is closed. Ripe crops are picked by walking up and pressing E
// (or the touch button), giving produce for the kitchen (see cooking.ts) and
// their seed back, now and then a stray seed of something else. Some crops
// grow again after picking. Seeds come in a starter pouch, from harvests, and
// as packets slain monsters sometimes drop.
//
// What's planted is saved with the player's collection as one string (see
// collection.ts); the world side is world/Farm.ts, the art art/farm.ts.

import type { RGB } from '../art/pixel';
import { tierOf } from './tiers';

/** How a crop's seeds are come by: the starter pouch's, found ones, and the magic two. */
export type SeedKind = 'garden' | 'wild' | 'magic';

export interface CropDef {
  id: string;
  name: string;
  /** The produce's name for one and for several ("Carrot", "Carrots"). */
  one: string;
  many: string;
  kind: SeedKind;
  /** ms from sowing to ripe. */
  grow: number;
  /** How much produce one plant gives. */
  yield: [number, number];
  /** Grows again after picking: it goes back this share of its growing (none: it's pulled up). */
  regrow?: number;
  /** Its colour for sparkles, names and its seed packet's band. */
  tint: number;
  /** The light its ripe produce gives off, for the magic crops. */
  glow?: RGB;
  /** Where its seeds are found, for the seed tray before any are owned. */
  hint: string;
}

const MIN = 60_000;

export const CROPS: CropDef[] = [
  { id: 'carrot', name: 'Carrot', one: 'Carrot', many: 'Carrots', kind: 'garden', grow: 4 * MIN, yield: [2, 3], tint: 0xff8a2a, hint: 'In the starter pouch' },
  { id: 'potato', name: 'Potato', one: 'Potato', many: 'Potatoes', kind: 'garden', grow: 6 * MIN, yield: [2, 4], tint: 0xd8b070, hint: 'In the starter pouch' },
  { id: 'wheat', name: 'Wheat', one: 'Wheat', many: 'Wheat', kind: 'garden', grow: 5 * MIN, yield: [2, 3], tint: 0xf0c860, hint: 'In the starter pouch' },
  { id: 'tomato', name: 'Tomato', one: 'Tomato', many: 'Tomatoes', kind: 'garden', grow: 8 * MIN, yield: [2, 3], regrow: 0.5, tint: 0xf04a3a, hint: 'In the starter pouch' },
  { id: 'cabbage', name: 'Cabbage', one: 'Cabbage', many: 'Cabbages', kind: 'garden', grow: 10 * MIN, yield: [1, 2], tint: 0x9ad070, hint: 'In the starter pouch' },
  { id: 'corn', name: 'Corn', one: 'Corn cob', many: 'Corn cobs', kind: 'wild', grow: 12 * MIN, yield: [2, 3], regrow: 0.5, tint: 0xffd84a, hint: 'Dropped by monsters, or a stray seed' },
  { id: 'strawberry', name: 'Strawberry', one: 'Strawberry', many: 'Strawberries', kind: 'wild', grow: 9 * MIN, yield: [3, 5], regrow: 0.4, tint: 0xff4a6a, hint: 'Dropped by monsters, or a stray seed' },
  { id: 'pumpkin', name: 'Pumpkin', one: 'Pumpkin', many: 'Pumpkins', kind: 'wild', grow: 18 * MIN, yield: [1, 2], tint: 0xf07a20, hint: 'Dropped by monsters, or a stray seed' },
  { id: 'emberpepper', name: 'Ember Pepper', one: 'Ember Pepper', many: 'Ember Peppers', kind: 'magic', grow: 15 * MIN, yield: [2, 3], regrow: 0.5, tint: 0xff6a2a, glow: [255, 120, 40], hint: 'Rare: strong monsters and bosses' },
  { id: 'moonbloom', name: 'Moonbloom', one: 'Moonbloom', many: 'Moonblooms', kind: 'magic', grow: 24 * MIN, yield: [1, 2], tint: 0xa8d8ff, glow: [150, 200, 255], hint: 'Rare: strong monsters and bosses' },
];

export const cropById = (id: string): CropDef | undefined => CROPS.find((c) => c.id === id);

/** A crop's stages: sown, sprout, young, ripe. */
export const STAGES = 4;

/** The pouch every farmer starts with: a few of each garden seed. */
export const STARTER_SEEDS = 5;

/** One planted cell. `t` is when it was sown (ms), moved on after a regrowing crop is picked. */
export interface Plot {
  /** Which farm it's in ('h' for the Home). */
  at: string;
  x: number;
  y: number;
  crop: string;
  t: number;
}

/** How far along a plot is, 0..1 (1 is ripe). */
export function growth(p: Plot, now = Date.now()): number {
  const c = cropById(p.crop);
  if (!c) return 0;
  return Math.max(0, Math.min(1, (now - p.t) / c.grow));
}

/** Its stage: 0 sown, 1 sprout, 2 young, 3 ripe. */
export function stageOf(p: Plot, now = Date.now()): number {
  const g = growth(p, now);
  return g >= 1 ? 3 : g >= 0.55 ? 2 : g >= 0.18 ? 1 : 0;
}

/** Every plot as one string: `at.x.y.crop.seconds`, comma separated. */
export function encodeFarm(plots: Plot[]): string {
  return plots.map((p) => `${p.at}.${p.x}.${p.y}.${p.crop}.${Math.floor(p.t / 1000)}`).join(',');
}

export function decodeFarm(s: string): Plot[] {
  const out: Plot[] = [];
  const seen = new Set<string>();
  for (const e of s ? s.split(',') : []) {
    const [at, x, y, crop, t] = e.split('.');
    const key = `${at}.${x}.${y}`;
    if (!at || !cropById(crop) || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y)) || !(Number(t) > 0) || seen.has(key)) continue;
    seen.add(key);
    out.push({ at, x: Number(x), y: Number(y), crop, t: Number(t) * 1000 });
  }
  return out;
}

/** What a ripe plant gives: its produce, its seed back (sometimes two), and now and then a stray seed of something else. */
export interface Harvest {
  produce: number;
  seeds: number;
  stray: string | null;
}

/** How often a harvest turns up a stray seed of a wild crop, and of a magic one. */
const STRAY_WILD = 0.07;
const STRAY_MAGIC = 0.015;
/** A second seed back. */
const SEED_TWO = 0.35;

const ofKind = (k: SeedKind): CropDef[] => CROPS.filter((c) => c.kind === k);
const pick = <T>(a: T[], rand = Math.random): T => a[Math.floor(rand() * a.length)];

export function rollHarvest(c: CropDef, rand = Math.random): Harvest {
  const produce = c.yield[0] + Math.floor(rand() * (c.yield[1] - c.yield[0] + 1));
  // A regrowing plant stays in the ground, so it gives no seed back but the odd spare.
  const seeds = c.regrow ? (rand() < SEED_TWO * 0.6 ? 1 : 0) : 1 + (rand() < SEED_TWO ? 1 : 0);
  const r = rand();
  const stray = r < STRAY_MAGIC ? pick(ofKind('magic'), rand).id : r < STRAY_MAGIC + STRAY_WILD ? pick(ofKind('wild').filter((w) => w.id !== c.id), rand).id : null;
  return { produce, seeds, stray };
}

/** The chance a slain monster drops a seed packet, by its tier, and how the packet's kind is drawn. */
const SEED_DROP: Record<string, { chance: number; garden: number; wild: number }> = {
  weak: { chance: 0.02, garden: 0.55, wild: 0.38 },
  normal: { chance: 0.03, garden: 0.5, wild: 0.4 },
  strong: { chance: 0.06, garden: 0.3, wild: 0.5 },
  legend: { chance: 0.5, garden: 0, wild: 0.45 },
  myth: { chance: 1, garden: 0, wild: 0.3 },
};

/** A seed packet dropped by a slain monster of `kind`, or null. */
export function rollSeedDrop(kind: string, odds = 1, rand = Math.random): string | null {
  const d = SEED_DROP[tierOf(kind)] ?? SEED_DROP.normal;
  if (rand() >= d.chance * odds) return null;
  const r = rand();
  return pick(ofKind(r < d.garden ? 'garden' : r < d.garden + d.wild ? 'wild' : 'magic'), rand).id;
}

// What the hero can do with E (or the touch button) where they stand in a
// Home, as the world (world/Farm.ts) works it out for the HUD (UIScene shows
// its button) and itself.
export const homeAct = {
  /** Pick the ripe crops in reach, or open the kitchen at a stove or cooking pot; '' for nothing. */
  near: '' as '' | 'harvest' | 'cook',
};
