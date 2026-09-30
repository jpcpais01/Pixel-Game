// Seasonal events: for one month of the year a season dresses the Runestone
// Clearing, brings its own monsters into the arenas and has them drop its own
// currency, which buys the season's limited skins and companions at a stall
// in the Clearing. When the month ends the stall closes and the monsters go;
// whatever was bought stays for good. Hallow's Eve (October) is the first; a
// winter or spring festival is one more entry in SEASONS, its art and its
// monsters.
//
// Whether a season runs follows the player's own calendar. For trying one out
// any day, open the game with `?season=<id>` (remembered on this device),
// `?season=off` to force none, and `?season=auto` to follow the calendar again.

import { collection } from './collection';
import { tierOf } from './tiers';
import type { MonsterKind, SpawnSpot } from './monsters';

/** Something the season's stall sells: a skin ("class:skin") or a companion (its id), for its currency. */
export interface SeasonWare {
  kind: 'skin' | 'pet';
  id: string;
  price: number;
}

export interface SeasonDef {
  id: string;
  name: string;
  /** The month it runs, 1 to 12, from the 1st to the last day. */
  month: number;
  /** What its monsters drop and its stall takes. */
  currency: { name: string; tint: number };
  /** The stall's keeper, and what they say when the hero walks up. */
  keeper: { name: string; title: string; tint: number; hello: string };
  wares: SeasonWare[];
  /**
   * Monsters that join each arena with monsters of its own while the season
   * runs: one beside every `every`th of the arena's spots, taking turns
   * through `mobs`. A boss waits in one arena, at a spot of its own.
   */
  mobs: string[];
  every: number;
  boss?: { arena: string; kind: string; x: number; y: number; respawn: number };
  /** How much of the currency each seasonal monster carries, [least, most]. */
  loot: Record<string, [number, number]>;
}

export const SEASONS: SeasonDef[] = [
  {
    id: 'hallows',
    name: "Hallow's Eve",
    month: 10,
    currency: { name: 'Candy', tint: 0xff9a3a },
    keeper: {
      name: 'Old Wick',
      title: 'the Candlewitch',
      tint: 0xffa84a,
      hello: "Sweets for the brave! Bring me candy from the pumpkins and bats, and take something wicked home. Gone when the month is.",
    },
    wares: [
      { kind: 'skin', id: 'warrior:headless', price: 320 },
      { kind: 'skin', id: 'wizard:pumpkin', price: 240 },
      { kind: 'skin', id: 'archer:scarecrow', price: 240 },
      { kind: 'pet', id: 'pumpling', price: 160 },
      { kind: 'pet', id: 'hexcat', price: 200 },
    ],
    mobs: ['gourdling', 'hexbat'],
    every: 3,
    // The Pumpkin King holds court in the Sunken Garden's north lawn, beyond the ruined wall.
    boss: { arena: 'garden', kind: 'pumpkin_king', x: 408, y: 184, respawn: 120000 },
    loot: { gourdling: [1, 2], hexbat: [1, 2], pumpkin_king: [30, 45] },
  },
];

const OVERRIDE_KEY = 'pixel-battle.season';

/** A season picked by hand for this device (see the top of this file): an id, 'off', or null to follow the calendar. */
function override(): string | null {
  try {
    const asked = new URLSearchParams(location.search).get('season');
    if (asked === 'auto') localStorage.removeItem(OVERRIDE_KEY);
    else if (asked) localStorage.setItem(OVERRIDE_KEY, asked);
    return localStorage.getItem(OVERRIDE_KEY);
  } catch {
    return null;
  }
}

let picked: string | null | undefined;

/** The season running now, or null. Read once per launch, so a run never changes season halfway. */
export function activeSeason(): SeasonDef | null {
  picked ??= override();
  if (picked === 'off') return null;
  if (picked) {
    const s = SEASONS.find((x) => x.id === picked);
    if (s) return s;
  }
  const month = new Date().getMonth() + 1;
  return SEASONS.find((s) => s.month === month) ?? null;
}

export const seasonById = (id: string): SeasonDef | undefined => SEASONS.find((s) => s.id === id);

/** Whole days left in the season, counting today (1 on its last day). */
export function daysLeft(s: SeasonDef): number {
  const now = new Date();
  const last = new Date(now.getFullYear(), s.month, 0).getDate();
  // Forced on outside its month (a preview): as if it had just begun.
  if (now.getMonth() + 1 !== s.month) return last;
  return last - now.getDate() + 1;
}

/** Does the player own this ware already? */
export const ownsWare = (w: SeasonWare): boolean => (w.kind === 'skin' ? collection.hasSkin(w.id) : collection.hasPet(w.id));

/**
 * Buy a ware from the running season's stall: spend its currency and give
 * the skin or companion. False when it can't be (not this season's, owned,
 * or not enough currency).
 */
export function buyWare(s: SeasonDef, w: SeasonWare): boolean {
  if (activeSeason()?.id !== s.id || ownsWare(w) || !collection.spendCandy(s.id, w.price)) return false;
  if (w.kind === 'skin') collection.unlockSkin(w.id);
  else {
    collection.unlockPet(w.id);
    // The first companion comes along at once, as one won from the Nest does.
    if (!collection.pet) collection.pet = w.id;
  }
  return true;
}

/** Any other monster slain while a season runs sometimes carries a little of its currency too: its tier's chance, and how much. */
const STRAY: Record<string, { chance: number; min: number; max: number }> = {
  weak: { chance: 0.08, min: 1, max: 1 },
  normal: { chance: 0.14, min: 1, max: 1 },
  strong: { chance: 0.3, min: 1, max: 3 },
  legend: { chance: 1, min: 8, max: 14 },
  myth: { chance: 1, min: 15, max: 25 },
};

/** How much of the running season's currency a slain `kind` drops: usually none. */
export function rollCandy(kind: string): number {
  const s = activeSeason();
  if (!s) return 0;
  const r = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const own = s.loot[kind];
  if (own) return r(own[0], own[1]);
  const g = STRAY[tierOf(kind)];
  return g && Math.random() < g.chance ? r(g.min, g.max) : 0;
}


/** How far from an arena's own spot its seasonal neighbour stands, in px. */
const BESIDE = 26;

/**
 * The running season's monsters for an arena: one beside every `every`th of
 * its own spots (never beside a boss's), and the season's boss if it holds
 * court there. Worked out from the arena alone, so every player in a room
 * gets the same list; they come after the arena's own spots, so those keep
 * their places either way.
 */
export function seasonalSpots(arena: string, spots: readonly SpawnSpot[], walkable: (x: number, y: number) => boolean): SpawnSpot[] {
  const s = activeSeason();
  if (!s) return [];
  const out: SpawnSpot[] = [];
  let turn = 0;
  spots.forEach((spot, i) => {
    if (i % s.every !== s.every - 1) return;
    const tier = tierOf(spot.kind);
    if (tier === 'legend' || tier === 'myth') return;
    const at = nearWalkable(spot.x, spot.y, BESIDE, walkable, i);
    if (at) out.push({ kind: s.mobs[turn++ % s.mobs.length] as MonsterKind, x: at.x, y: at.y });
  });
  const b = s.boss;
  if (b && b.arena === arena) {
    const at = nearWalkable(b.x, b.y, 0, walkable, 0) ?? { x: b.x, y: b.y };
    out.push({ kind: b.kind as MonsterKind, x: at.x, y: at.y, respawn: b.respawn, keepAway: 160 });
  }
  return out;
}

/** Walkable ground `r` px from (x, y), trying round the circle from an angle set by `seed`; failing that, anywhere a little nearer or further. */
function nearWalkable(x: number, y: number, r: number, walkable: (x: number, y: number) => boolean, seed: number): { x: number; y: number } | null {
  for (let d = r; d <= r + 30; d += 6) {
    for (let k = 0; k < 12; k++) {
      const a = seed * 2.4 + (k * Math.PI) / 6;
      const px = Math.round(x + Math.cos(a) * d);
      const py = Math.round(y + Math.sin(a) * d * 0.75);
      if (walkable(px, py)) return { x: px, y: py };
      if (d === 0) break;
    }
  }
  return null;
}
