// Wishes: the shop's gacha. Every skin (a type's own look is free) is won
// from the Wish Crystal with gems. Each skin has a rarity; a wish rolls a
// rarity by its odds, then any skin of that rarity, owned or not. A skin
// already owned evaporates into gems: half what a wish costs. Ten wishes at once always
// hold an epic or better, and a legendary is guaranteed within PITY wishes.

import { CLASSES, kitOf, type ClassDef, type SkinDef, type TypeDef } from './characters';
import { worn } from './skins';
import { collection } from './collection';

export type SkinRarity = 'rare' | 'epic' | 'legendary';

export const WISH_COST = 20;
export const WISH10_COST = 180;
/** A legendary is certain by this many wishes since the last one. */
export const PITY = 40;
/** A skin already owned evaporates into this many gems. */
export const DUPE_GEMS = WISH_COST / 2;

export const SKIN_RARITIES: SkinRarity[] = ['rare', 'epic', 'legendary'];

/** How each rarity looks: its chance per wish, its colours and its stars. */
export const RARITY_INFO: Record<SkinRarity, { name: string; odds: number; tint: number; core: number; deep: number; stars: number }> = {
  rare: { name: 'Rare', odds: 0.7, tint: 0x5fb4ff, core: 0xe8f6ff, deep: 0x2a4aa8, stars: 3 },
  epic: { name: 'Epic', odds: 0.25, tint: 0xc084ff, core: 0xf6e8ff, deep: 0x5a2aa8, stars: 4 },
  legendary: { name: 'Legendary', odds: 0.05, tint: 0xffc84a, core: 0xfffbe8, deep: 0xa85a18, stars: 5 },
};

/** Every skin's rarity, by "kit:skin" (see KitDef in characters.ts); any not listed is rare. */
const RARITY_OF: Record<string, SkinRarity> = {
  'wizard:hellfire': 'legendary',
  'paladin:seraph': 'legendary',
  'jedi:warlord': 'legendary',
  'necromancer:wyrm': 'legendary',
  'chronomancer:anomaly': 'legendary',
  'chronomancer:primavera': 'legendary',
  'samurai:kitsune': 'legendary',
  'valkyrie:raven': 'legendary',
  'valkyrie:swan': 'legendary',
  'warrior:afonso': 'legendary',
  'automaton:hive': 'legendary',
  'phantom:cala': 'legendary',
  'fighter:champ': 'legendary',
  'inventor:einstein': 'legendary',
  'inventor:tesla': 'epic',
  'beast:benfica': 'legendary',
  'beast:sporting': 'legendary',
  'beast:porto': 'legendary',
  'bard:orpheus': 'legendary',
  'druid:titania': 'legendary',
  'wizard:astral': 'epic',
  'jedi:master': 'epic',
  'wizard:abyssal': 'epic',
  'warrior:spartan': 'epic',
  'paladin:oathbreaker': 'epic',
  'fighter:guardian': 'epic',
  'alchemist:shaman': 'epic',
  'alchemist:foxglove': 'epic',
  'archer:hunt': 'epic',
  'archer:wisteria': 'epic',
  'rogue:kitsune': 'epic',
  'rogue:nightbloom': 'epic',
  'necromancer:tomb': 'epic',
  'bard:harlequin': 'epic',
  'bard:fadista': 'epic',
  'chronomancer:clockwork': 'epic',
  'samurai:shogun': 'epic',
  'druid:autumn': 'epic',
  'wizard:lotus': 'epic',
  'druid:frostfang': 'epic',
  'automaton:scrap': 'epic',
  'phantom:tea': 'epic',
  // Hallow's Eve's, bought with candy rather than wished for (see game/season.ts).
  'warrior:headless': 'legendary',
  'wizard:pumpkin': 'epic',
  'archer:scarecrow': 'epic',
};

/** One skin as the shop knows it. */
export interface SkinEntry {
  /** "kit:skin". */
  id: string;
  cls: ClassDef;
  type: TypeDef;
  skin: SkinDef;
  rarity: SkinRarity;
}

export const ALL_SKINS: SkinEntry[] = CLASSES.flatMap((cls) =>
  cls.types.flatMap((type) =>
    (type.skins ?? []).map((skin) => {
      const id = skinId(skin);
      return { id, cls, type, skin, rarity: RARITY_OF[id] ?? 'rare' };
    }),
  ),
);

/** A skin's id as it is owned and saved: "kit:skin". */
export function skinId(skin: SkinDef): string {
  return `${kitOf(skin).id}:${skin.id}`;
}

/** A skin's rarity. */
export const rarityOf = (skin: SkinDef): SkinRarity => RARITY_OF[skinId(skin)] ?? 'rare';

/** The skins a wish can give: every one but the seasons' limited skins, which only their stalls sell. */
export const WISH_SKINS: SkinEntry[] = ALL_SKINS.filter((s) => !s.skin.season);

/** How many skins the player owns, out of all of them (a season's limited skins count once owned). */
export function ownedSkins(): { owned: number; of: number } {
  const owned = ALL_SKINS.filter((s) => collection.hasSkin(s.id));
  return { owned: owned.length, of: WISH_SKINS.length + owned.filter((s) => s.skin.season).length };
}

/** The skin as it plays, for previews: the class in that type and skin. */
export const wornSkin = (e: SkinEntry) => worn(e.cls, { type: e.type, skin: e.skin });

/** What one wish gave. */
export interface WishResult {
  entry: SkinEntry;
  /** First time the player has it. */
  fresh: boolean;
  /** Gems given back for a skin already owned. */
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
 * Make `count` wishes (1 or 10): spend the gems, roll the skins, give them
 * (or their gems, for ones owned) and return what came out, in order. Null
 * when there aren't gems enough.
 */
export function wish(count: 1 | 10): WishResult[] | null {
  if (!collection.spendGems(count === 10 ? WISH10_COST : WISH_COST)) return null;
  const rarities: SkinRarity[] = [];
  let pity = collection.pity;
  for (let i = 0; i < count; i++) {
    let r = rollRarity();
    if (pity + 1 >= PITY) r = 'legendary';
    // Ten at once: the last is at least epic if nothing else was.
    if (count === 10 && i === count - 1 && r === 'rare' && !rarities.some((x) => x !== 'rare')) r = 'epic';
    pity = r === 'legendary' ? 0 : pity + 1;
    rarities.push(r);
  }
  collection.pity = pity;
  let refund = 0;
  const out = rarities.map((r) => {
    const entry = pick(WISH_SKINS.filter((s) => s.rarity === r));
    const fresh = collection.unlockSkin(entry.id);
    const back = fresh ? 0 : DUPE_GEMS;
    refund += back;
    return { entry, fresh, refund: back };
  });
  collection.addGems(refund);
  return out;
}
