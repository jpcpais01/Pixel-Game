// Gear: seventy pieces of equipment that monsters drop. Walking over a piece picks it up and
// keeps it for good (see collection.ts). Each piece has one of six slot
// types, and the hero wears one piece per type: only worn pieces count. A
// piece goes on by itself when its slot is empty; otherwise the player swaps
// it in from the Inventory page or the bag in a run. A new piece is one
// entry in GEAR (with its slot type) plus its painter in art/gear.ts.

import { TIER_DROPS, TIER_SET_CHANCE, tierOf } from './tiers';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** Rarities from least to most rare; `tint` colours names, frames and icon backgrounds. */
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITY: Record<Rarity, { name: string; tint: number }> = {
  common: { name: 'Common', tint: 0x5fa8ff },
  uncommon: { name: 'Uncommon', tint: 0x62e07a },
  rare: { name: 'Rare', tint: 0xffd84a },
  epic: { name: 'Epic', tint: 0xc084ff },
  legendary: { name: 'Legendary', tint: 0xfff8ec },
};

/** The six kinds of gear; the hero wears one of each, in this order. */
export type Slot = 'headwear' | 'chest' | 'boots' | 'accessory' | 'weapon' | 'defence';

export const SLOTS: Slot[] = ['headwear', 'chest', 'boots', 'weapon', 'defence', 'accessory'];

export const SLOT_NAME: Record<Slot, string> = {
  headwear: 'Headwear',
  chest: 'Chest',
  boots: 'Boots',
  accessory: 'Accessory',
  weapon: 'Weapon',
  defence: 'Defence',
};

/**
 * What gear adds to the hero's stats (see stats.ts). The keys keep their old
 * names so saved upgrades still load: `power` is Damage and `armor` Defense.
 */
export interface GearStats {
  /** Damage, +share (0.1 = +10%): a share, so it lifts every hero alike. */
  power?: number;
  /** Defense, added to the hero's own. */
  armor?: number;
  /** Walking speed, +share. */
  speed?: number;
  /** Max health. */
  hp?: number;
  /** Health per second. */
  regen?: number;
  /** Share of damage dealt healed back. */
  leech?: number;
}

// The item budget. Every piece has points to spend by its rarity, and what
// a point buys is the same for every piece; a piece only says how it splits
// its points between stats. Set pieces have a little more, and a whole set
// worn together adds its own bonus on top.

/** What one point buys of each stat: 1% Damage, 1 Defense, 1% move speed, 3 HP, 0.1 regen, 0.5% lifesteal. */
export const POINT: Required<GearStats> = { power: 0.01, armor: 1, speed: 0.01, hp: 3, regen: 0.1, leech: 0.005 };

/** Points a piece spends, by rarity. */
export const RARITY_POINTS: Record<Rarity, number> = { common: 6, uncommon: 11, rare: 16, epic: 24, legendary: 34 };

/** Points of a piece of a boss's set (all legendary). */
export const SET_PIECE_POINTS = 30;

/** Points a whole set adds when all six pieces are worn. */
export const SET_BONUS_POINTS = 36;

/** `points` spent by `split`, rounded to what the HUD shows. */
function spend(points: number, split: GearStats): GearStats {
  const out: GearStats = {};
  for (const k of Object.keys(split) as (keyof GearStats)[]) {
    const v = points * split[k]! * POINT[k];
    out[k] = k === 'hp' || k === 'armor' ? Math.round(v) : k === 'regen' ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
  }
  return out;
}

const setBonus = (split: GearStats): GearStats => spend(SET_BONUS_POINTS, split);

/** Sets of gear that grant more when every piece is worn together. */
export type SetId = 'wraith' | 'ember' | 'spore' | 'geode' | 'astral';

export interface GearSet {
  name: string;
  /** Colour of the set's name and marks. */
  tint: number;
  /** Stats added on top of the pieces' own while all of them are worn. */
  bonus: GearStats;
  /** What else the full set does, in a few words. */
  effect: string;
  /** The only foe that drops it, as the Inventory names it. */
  boss: string;
}

export const GEAR_SETS: Record<SetId, GearSet> = {
  wraith: { name: 'Wraithbound', tint: 0x6af4dc, bonus: setBonus({ power: 0.4, speed: 0.3, leech: 0.3 }), effect: 'Spectral form: a ghostly aura follows you', boss: 'the Hollow Queen' },
  ember: { name: 'Emberborn', tint: 0xffa040, bonus: setBonus({ power: 0.5, speed: 0.2, regen: 0.3 }), effect: 'Living flame: fire wreathes you', boss: 'the Elementinho' },
  spore: { name: 'Sporeveil', tint: 0xff78e0, bonus: setBonus({ regen: 0.4, leech: 0.3, hp: 0.3 }), effect: 'Spore veil: glowing spores drift about you', boss: 'the Sporemother' },
  geode: { name: 'Wyrmshard', tint: 0xc49cff, bonus: setBonus({ power: 0.6, armor: 0.2, speed: 0.2 }), effect: 'Crystal form: amethyst glitters about you', boss: 'Amethrax' },
  astral: { name: 'Starborn', tint: 0x9ab4ff, bonus: setBonus({ power: 0.5, speed: 0.2, regen: 0.3 }), effect: 'Starborn: starlight wheels about you', boss: 'the Astral Warden' },
};

/** A power a set gives once `at` of its pieces are worn: the Myth sets' (see game/setPowers.ts). */
export type PowerId = 'shardskin' | 'wake' | 'burrow' | 'stardust' | 'starfall' | 'singularity';

export interface SetPower {
  id: PowerId;
  at: number;
  name: string;
  /** One short line for the Inventory. */
  text: string;
}

/**
 * The Myth sets grow stronger piece by piece: a power at 2, 4 and 6 worn,
 * shaped after their boss's own. They stack with the full set's stats and
 * aura, and a hero wearing parts of both sets gets the powers of each.
 */
export const SET_POWERS: Partial<Record<SetId, SetPower[]>> = {
  geode: [
    { id: 'shardskin', at: 2, name: 'Shardskin', text: 'Hit, you burst shards at foes' },
    { id: 'wake', at: 4, name: 'Crystal Wake', text: 'Every 4th attack raises crystals' },
    { id: 'burrow', at: 6, name: 'Burrow', text: 'Below 30% HP, dive and erupt. 60s' },
  ],
  astral: [
    { id: 'stardust', at: 2, name: 'Stardust', text: 'Kills call a star on a foe' },
    { id: 'starfall', at: 4, name: 'Starfall', text: 'A star hits your target every 3s' },
    { id: 'singularity', at: 6, name: 'Singularity', text: 'Ability opens a black hole. 8s' },
  ],
};

export interface GearDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** Which of the six equip slots it goes in. */
  slot: Slot;
  stats: GearStats;
  /** The set it belongs to, if any. */
  set?: SetId;
  /** 32x32 icon, and the 16x16 sprite lying on the ground. */
  icon: string;
  drop: string;
}

/** A piece: `split` says what share of its rarity's points goes into each stat (shares add up to 1). */
const piece = (id: string, name: string, rarity: Rarity, slot: Slot, split: GearStats, set?: SetId): GearDef => ({
  id,
  name,
  rarity,
  slot,
  stats: spend(set ? SET_PIECE_POINTS : RARITY_POINTS[rarity], split),
  set,
  icon: `gear_${id}`,
  drop: `gdrop_${id}`,
});

export const GEAR: GearDef[] = [
  piece('iron_sword', 'Iron Sword', 'common', 'weapon', { power: 1 }),
  piece('leather_boots', 'Leather Boots', 'common', 'boots', { speed: 1 }),
  piece('oak_shield', 'Oak Shield', 'common', 'defence', { armor: 1 }),
  piece('iron_helm', 'Iron Helm', 'common', 'headwear', { hp: 1 }),
  piece('ruby_amulet', 'Ruby Amulet', 'common', 'accessory', { hp: 1 }),
  piece('battle_axe', 'Battle Axe', 'rare', 'weapon', { power: 1 }),
  piece('frost_spear', 'Frost Spear', 'uncommon', 'weapon', { power: 0.7, speed: 0.3 }),
  piece('bloodfang', 'Bloodfang', 'uncommon', 'weapon', { power: 0.4, leech: 0.6 }),
  piece('knight_plate', 'Knight Plate', 'rare', 'chest', { hp: 0.4, armor: 0.6 }),
  piece('winged_boots', 'Winged Boots', 'rare', 'boots', { speed: 1 }),
  piece('gauntlets', 'Gauntlets of Might', 'uncommon', 'defence', { power: 0.6, armor: 0.4 }),
  piece('emerald_ring', 'Emerald Ring', 'uncommon', 'accessory', { regen: 1 }),
  piece('arcane_staff', 'Arcane Staff', 'rare', 'weapon', { power: 1 }),
  piece('thunder_hammer', 'Thunder Hammer', 'epic', 'weapon', { power: 0.9, hp: 0.1 }),
  piece('emberbrand', 'Emberbrand', 'epic', 'weapon', { power: 0.7, leech: 0.3 }),
  piece('tome_of_embers', 'Tome of Embers', 'epic', 'accessory', { power: 0.6, regen: 0.4 }),
  piece('moonstone_orb', 'Moonstone Orb', 'epic', 'defence', { regen: 0.6, armor: 0.4 }),
  piece('dragonfang', 'Dragonfang', 'legendary', 'weapon', { power: 0.8, hp: 0.2 }),
  piece('golden_aegis', 'Golden Aegis', 'legendary', 'defence', { armor: 0.7, hp: 0.3 }),
  piece('phoenix_feather', 'Phoenix Feather', 'legendary', 'headwear', { regen: 0.7, speed: 0.2, hp: 0.1 }),
  // The second twenty, weighted toward what the first twenty had least of: helms, body armour, boots and shields.
  piece('leather_hood', 'Ranger Hood', 'common', 'headwear', { hp: 0.4, speed: 0.6 }),
  piece('wizard_hat', 'Starry Hat', 'uncommon', 'headwear', { power: 0.6, regen: 0.4 }),
  piece('horned_helm', 'Horned Helm', 'rare', 'headwear', { hp: 0.5, power: 0.5 }),
  piece('jeweled_crown', 'Jeweled Crown', 'epic', 'headwear', { hp: 0.4, regen: 0.6 }),
  piece('valkyrie_helm', 'Valkyrie Helm', 'legendary', 'headwear', { armor: 0.5, hp: 0.3, speed: 0.2 }),
  piece('padded_tunic', 'Padded Tunic', 'common', 'chest', { hp: 0.6, armor: 0.4 }),
  piece('chainmail', 'Chainmail', 'uncommon', 'chest', { armor: 0.7, hp: 0.3 }),
  piece('shadow_cloak', 'Shadow Cloak', 'rare', 'chest', { speed: 0.6, leech: 0.4 }),
  piece('dragonscale_mail', 'Dragonscale Mail', 'epic', 'chest', { armor: 0.6, hp: 0.4 }),
  piece('fur_boots', 'Fur Boots', 'common', 'boots', { speed: 0.6, regen: 0.4 }),
  piece('iron_greaves', 'Iron Greaves', 'uncommon', 'boots', { armor: 0.6, speed: 0.4 }),
  piece('lava_striders', 'Lava Striders', 'epic', 'boots', { speed: 0.7, power: 0.3 }),
  piece('leather_bracers', 'Leather Bracers', 'common', 'defence', { armor: 1 }),
  piece('spiked_buckler', 'Spiked Buckler', 'uncommon', 'defence', { armor: 0.5, power: 0.5 }),
  piece('tower_shield', 'Tower Shield', 'rare', 'defence', { armor: 0.8, hp: 0.2 }),
  piece('frostguard', 'Frostguard', 'epic', 'defence', { armor: 0.6, regen: 0.4 }),
  piece('wolf_tooth', 'Wolf Tooth Charm', 'common', 'accessory', { power: 1 }),
  piece('clover_charm', 'Clover Locket', 'uncommon', 'accessory', { regen: 0.7, speed: 0.3 }),
  piece('hunter_longbow', 'Hunter Longbow', 'rare', 'weapon', { power: 0.8, speed: 0.2 }),
  piece('void_scythe', 'Void Scythe', 'legendary', 'weapon', { power: 0.7, leech: 0.3 }),
  // The Wraithbound set: one legendary for each slot, dropped only by the Hollow Queen in the Spirit Dungeon.
  piece('wraith_crown', 'Wraith Crown', 'legendary', 'headwear', { hp: 0.3, regen: 0.7 }, 'wraith'),
  piece('wraith_shroud', 'Shroud of the Hollow', 'legendary', 'chest', { armor: 0.6, hp: 0.4 }, 'wraith'),
  piece('wraith_treads', 'Ghoststep Treads', 'legendary', 'boots', { speed: 0.8, armor: 0.2 }, 'wraith'),
  piece('soulreaver', 'Soulreaver', 'legendary', 'weapon', { power: 0.7, leech: 0.3 }, 'wraith'),
  piece('phantom_ward', 'Phantom Ward', 'legendary', 'defence', { armor: 0.6, regen: 0.4 }, 'wraith'),
  piece('soul_lantern', 'Lantern of Souls', 'legendary', 'accessory', { power: 0.3, regen: 0.6, hp: 0.1 }, 'wraith'),
  // The Emberborn set: one legendary for each slot, dropped only by the Elementinho in its temple.
  piece('flame_crown', 'Crown of Living Flame', 'legendary', 'headwear', { power: 0.5, hp: 0.5 }, 'ember'),
  piece('ember_mail', 'Emberheart Mail', 'legendary', 'chest', { armor: 0.5, hp: 0.3, power: 0.2 }, 'ember'),
  piece('cinder_boots', 'Cinderstep Boots', 'legendary', 'boots', { speed: 0.8, power: 0.2 }, 'ember'),
  piece('surgefire', 'Blazing Surge', 'legendary', 'weapon', { power: 0.9, hp: 0.1 }, 'ember'),
  piece('ember_aegis', 'Aegis of Ember Rain', 'legendary', 'defence', { armor: 0.7, hp: 0.3 }, 'ember'),
  piece('flame_heart', 'Heart of Elementinho', 'legendary', 'accessory', { power: 0.3, regen: 0.6, hp: 0.1 }, 'ember'),
  // The Sporeveil set: one legendary for each slot, dropped only by the Sporemother in the Glimmerdeep.
  piece('veilcap', 'Veilcap Hood', 'legendary', 'headwear', { hp: 0.3, regen: 0.7 }, 'spore'),
  piece('mycelium_mantle', 'Mycelium Mantle', 'legendary', 'chest', { armor: 0.4, hp: 0.3, regen: 0.3 }, 'spore'),
  piece('rootwalkers', 'Rootwalkers', 'legendary', 'boots', { speed: 0.6, regen: 0.4 }, 'spore'),
  piece('bloomreaper', 'Bloomreaper', 'legendary', 'weapon', { power: 0.7, leech: 0.3 }, 'spore'),
  piece('puffball_bulwark', 'Puffball Bulwark', 'legendary', 'defence', { armor: 0.7, hp: 0.3 }, 'spore'),
  piece('spore_heart', 'Heart of the Sporemother', 'legendary', 'accessory', { regen: 0.7, hp: 0.2, leech: 0.1 }, 'spore'),
  // The Wyrmshard set: one legendary for each slot, dropped only by Amethrax at the bottom of the Glimmerdeep.
  piece('amethrax_crown', 'Crown of Amethrax', 'legendary', 'headwear', { power: 0.4, hp: 0.4, armor: 0.2 }, 'geode'),
  piece('geodeplate', 'Geodeplate', 'legendary', 'chest', { armor: 0.6, hp: 0.4 }, 'geode'),
  piece('wyrmscale_greaves', 'Wyrmscale Greaves', 'legendary', 'boots', { speed: 0.8, armor: 0.2 }, 'geode'),
  piece('amethrax_fang', 'Fang of Amethrax', 'legendary', 'weapon', { power: 0.8, leech: 0.2 }, 'geode'),
  piece('geode_aegis', 'Geode Aegis', 'legendary', 'defence', { armor: 0.7, hp: 0.3 }, 'geode'),
  piece('heartgeode', 'Heartgeode', 'legendary', 'accessory', { power: 0.3, regen: 0.5, hp: 0.2 }, 'geode'),
  // The Starborn set: one legendary for each slot, dropped only by the Astral Warden in the Cosmos Arena.
  piece('star_diadem', 'Diadem of the Warden', 'legendary', 'headwear', { hp: 0.4, power: 0.4, armor: 0.2 }, 'astral'),
  piece('nebula_vestments', 'Nebula Vestments', 'legendary', 'chest', { armor: 0.4, hp: 0.3, regen: 0.3 }, 'astral'),
  piece('comet_treads', 'Comet Treads', 'legendary', 'boots', { speed: 0.8, armor: 0.2 }, 'astral'),
  piece('starfall', 'Starfall', 'legendary', 'weapon', { power: 0.8, leech: 0.2 }, 'astral'),
  piece('orrery_aegis', 'Orrery Aegis', 'legendary', 'defence', { armor: 0.7, hp: 0.3 }, 'astral'),
  piece('warden_eye', 'Eye of the Warden', 'legendary', 'accessory', { power: 0.4, regen: 0.5, hp: 0.1 }, 'astral'),
];

/** How many pieces of `set` are among `defs`, out of how many there are. */
export function setCount(defs: GearDef[], set: SetId): { worn: number; of: number } {
  return { worn: defs.filter((g) => g.set === set).length, of: GEAR.filter((g) => g.set === set).length };
}

/** Pieces of one set worn before the hero's own sprite takes on its look (see art/dress.ts). */
export const DRESS_AT = 4;

/** The set the hero is dressed in: the one with DRESS_AT or more pieces worn, if any (six slots fit only one). */
export function dressSet(defs: GearDef[]): SetId | null {
  return (Object.keys(GEAR_SETS) as SetId[]).find((k) => setCount(defs, k).worn >= DRESS_AT) ?? null;
}

/** The sets worn whole among `defs`. */
export function fullSets(defs: GearDef[]): SetId[] {
  return (Object.keys(GEAR_SETS) as SetId[]).filter((k) => {
    const c = setCount(defs, k);
    return c.worn === c.of;
  });
}

/** The set powers the worn pieces reach. */
export function wornPowers(defs: GearDef[]): SetPower[] {
  const out: SetPower[] = [];
  for (const [set, powers] of Object.entries(SET_POWERS) as [SetId, SetPower[]][]) {
    const n = setCount(defs, set).worn;
    for (const p of powers) if (n >= p.at) out.push(p);
  }
  return out;
}

export const gearById = (id: string): GearDef | undefined => GEAR.find((g) => g.id === id);


/** The stats in the order they're listed, with short names and how to show a value. */
export const STAT_KEYS = ['power', 'armor', 'speed', 'hp', 'regen', 'leech'] as const;
export const STAT_LABEL: Record<keyof GearStats, string> = { power: 'DMG', armor: 'DEF', speed: 'SPEED', hp: 'HP', regen: 'REGEN', leech: 'LEECH' };

/** A stat value as shown: "+10%", "+15", "+1.5/S". */
export function statValue(k: keyof GearStats, v: number): string {
  const sign = v < 0 ? '-' : '+';
  const a = Math.abs(v);
  if (k === 'hp' || k === 'armor') return `${sign}${Math.round(a)}`;
  if (k === 'regen') return `${sign}${Math.round(a * 10) / 10}/S`;
  return `${sign}${Math.round(a * 100)}%`;
}

/** Where a total stops counting, so no set of gear makes the hero uncontrollably fast. (Defense needs no cap: it never makes anyone immune.) */
export const STAT_CAP: Partial<Record<keyof GearStats, number>> = { speed: 0.5 };

/** Short lines for a stat block, in the HUD's pixel font: "+10% DMG", "+15 HP". */
export function statLines(s: GearStats): string[] {
  return STAT_KEYS.filter((k) => s[k]).map((k) => `${statValue(k, s[k]!)} ${STAT_LABEL[k]}`);
}

/** The stats of several pieces added up. */
export function sumStats(defs: GearDef[]): Required<GearStats> {
  const t = { power: 0, armor: 0, speed: 0, hp: 0, regen: 0, leech: 0 };
  for (const g of defs) for (const k of STAT_KEYS) t[k] += g.stats[k] ?? 0;
  t.regen = Math.round(t.regen * 10) / 10;
  return t;
}

/** What the worn pieces add up to, with the bonus of every set worn whole. */
export function wornStats(defs: GearDef[]): Required<GearStats> {
  const t = sumStats(defs);
  for (const k of fullSets(defs)) for (const s of STAT_KEYS) t[s] += GEAR_SETS[k].bonus[s] ?? 0;
  t.regen = Math.round(t.regen * 10) / 10;
  return t;
}

// ---------------------------------------------------------------------------
// Dust and upgrades. Any piece can be disenchanted into dust at the Rune
// Temple; dust takes an epic or legendary piece from level 1 up to 10, and
// each level gained puts one point into a stat of the player's choice.

export type StatKey = keyof GearStats;

/** Dust a piece breaks down into, by rarity. */
export const DUST_VALUE: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 5, epic: 15, legendary: 40 };

export const MAX_LEVEL = 10;

/** Share of the dust spent upgrading a piece that comes back when it is disenchanted. */
export const UPGRADE_REFUND = 0.5;

/** What a level adds to the stat picked: two points' worth (see POINT). */
export const STAT_STEP: Required<GearStats> = { power: 0.02, armor: 2, speed: 0.02, hp: 6, regen: 0.2, leech: 0.01 };

/** Only epic and legendary pieces can be upgraded. */
export const canUpgrade = (d: GearDef): boolean => d.rarity === 'epic' || d.rarity === 'legendary';

/** Dust to take a piece from `level` to the next: 10, 20, 40... for a legendary, half that for an epic. */
export function upgradeCost(d: GearDef, level: number): number {
  const legendary = 10 * 2 ** (level - 1);
  return d.rarity === 'legendary' ? legendary : legendary / 2;
}

/** All the dust spent taking a piece from level 1 to `level`. */
export function dustSpent(d: GearDef, level: number): number {
  let n = 0;
  for (let l = 1; l < level; l++) n += upgradeCost(d, l);
  return n;
}

/** A piece with the points of its levels added (the same def when it has none). */
export function levelled(def: GearDef, picks: readonly StatKey[]): GearDef {
  if (!picks.length) return def;
  const stats: GearStats = { ...def.stats };
  for (const k of picks) stats[k] = Math.round(((stats[k] ?? 0) + STAT_STEP[k]) * 1e4) / 1e4;
  return { ...def, stats };
}

/** Sets only their own boss drops. */
export const SET_BOSS: Record<string, SetId> = { queen: 'wraith', elementinho: 'ember', sporemother: 'spore', wyrm: 'geode', warden: 'astral' };

/** A piece picked up this run, for the HUD's banner; `worn` if it went straight into an empty slot. */
export interface GearNews {
  def: GearDef;
  worn: boolean;
  /** The player had one already: it's a spare, for dust. */
  dupe?: boolean;
}

export class GearBag {
  /** What the hero wears this run: the equip slots on the Inventory page, changeable from the bag. */
  worn: GearDef[] = [];
  /** Pieces picked up this run; they drop again only as duplicates. */
  found = new Set<string>();
  /** Pieces just picked up, for the HUD's banner; it takes them off the front. */
  news: GearNews[] = [];
  /** Totals of every worn piece's stats, with set bonuses: these are what count. */
  totals: Required<GearStats> = sumStats([]);
  /** Sets worn whole right now. */
  sets: SetId[] = [];
  /** Set powers the worn pieces reach right now. */
  powers = new Set<PowerId>();
  /** The set the hero's sprite is dressed in, if any. */
  dress: SetId | null = null;

  /** A new run: nothing found yet. Call `wear` with the equipped pieces next. */
  reset(): void {
    this.worn = [];
    this.found.clear();
    this.news = [];
    this.totals = sumStats([]);
    this.sets = [];
    this.powers.clear();
    this.dress = null;
  }

  /** Wear these pieces; returns how much max health changed, for the hero's vitals. */
  wear(defs: GearDef[]): number {
    const before = this.totals.hp;
    this.worn = defs;
    this.totals = wornStats(defs);
    this.sets = fullSets(defs);
    this.powers = new Set(wornPowers(defs).map((p) => p.id));
    this.dress = dressSet(defs);
    return this.totals.hp - before;
  }

  /** A piece was picked up this run. */
  pick(def: GearDef, worn: boolean, dupe = false): void {
    this.found.add(def.id);
    this.news.push({ def, worn, dupe });
  }

  /** Multiplier on damage dealt. */
  get power(): number {
    return 1 + this.totals.power;
  }

  /** Multiplier on walking speed. */
  get speed(): number {
    return 1 + Math.min(STAT_CAP.speed!, this.totals.speed);
  }

  /**
   * What a slain monster of `kind` drops, by its tier (tiers.ts): one roll for
   * a regular piece of some rarity, and for a Legend or Myth with an item set,
   * its own roll for a piece of that set. Every piece of the rolled rarity
   * is as likely as any other: what the player already has makes no
   * difference, and a piece they own drops again as a spare, for dust.
   * `bump` raises the rarity rolled that many steps (a Blood Moon's), and
   * `odds` multiplies every chance (the Rift's Hard and Impossible), scaled
   * back so they never add up past a certain drop.
   */
  roll(kind: string, bump = 0, odds = 1): GearDef[] {
    const tier = tierOf(kind);
    const out: GearDef[] = [];
    const pick = (of: GearDef[]) => {
      if (of.length) out.push(of[Math.floor(Math.random() * of.length)]);
    };
    const set = SET_BOSS[kind];
    if (set && Math.random() < TIER_SET_CHANCE[tier] * odds) pick(GEAR.filter((g) => g.set === set));
    const chances = TIER_DROPS[tier];
    const total = RARITIES.reduce((a, k) => a + chances[k], 0) * odds;
    const scale = total > 1 ? odds / total : odds;
    let r = Math.random();
    for (const [i, k] of RARITIES.entries()) {
      r -= chances[k] * scale;
      if (r >= 0) continue;
      const got = RARITIES[Math.min(RARITIES.length - 1, i + bump)];
      pick(GEAR.filter((g) => !g.set && g.rarity === got));
      break;
    }
    return out;
  }
}

/** The player's gear; the world empties it each run and the UI draws it. */
export const gear = new GearBag();
