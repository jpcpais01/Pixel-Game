// Gear: fifty-two pieces of equipment that monsters drop. Walking over a piece picks it up and
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

export interface GearStats {
  /** Damage dealt, +share (0.1 = +10%). */
  power?: number;
  /** Damage taken, -share. */
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

/** Sets of gear that grant more when every piece is worn together. */
export type SetId = 'wraith' | 'ember';

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
  wraith: { name: 'Wraithbound', tint: 0x6af4dc, bonus: { power: 0.15, speed: 0.1, leech: 0.05 }, effect: 'Spectral form: a ghostly aura follows you', boss: 'the Hollow Queen' },
  ember: { name: 'Emberborn', tint: 0xffa040, bonus: { power: 0.2, speed: 0.08, regen: 1 }, effect: 'Living flame: fire wreathes you', boss: 'the Elementinho' },
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

const piece = (id: string, name: string, rarity: Rarity, slot: Slot, stats: GearStats, set?: SetId): GearDef => ({ id, name, rarity, slot, stats, set, icon: `gear_${id}`, drop: `gdrop_${id}` });

export const GEAR: GearDef[] = [
  piece('iron_sword', 'Iron Sword', 'common', 'weapon', { power: 0.1 }),
  piece('leather_boots', 'Leather Boots', 'common', 'boots', { speed: 0.08 }),
  piece('oak_shield', 'Oak Shield', 'common', 'defence', { armor: 0.08 }),
  piece('iron_helm', 'Iron Helm', 'common', 'headwear', { hp: 15 }),
  piece('ruby_amulet', 'Ruby Amulet', 'common', 'accessory', { hp: 20 }),
  piece('battle_axe', 'Battle Axe', 'rare', 'weapon', { power: 0.18 }),
  piece('frost_spear', 'Frost Spear', 'uncommon', 'weapon', { power: 0.12, speed: 0.06 }),
  piece('bloodfang', 'Bloodfang', 'uncommon', 'weapon', { power: 0.06, leech: 0.05 }),
  piece('knight_plate', 'Knight Plate', 'rare', 'chest', { hp: 25, armor: 0.1 }),
  piece('winged_boots', 'Winged Boots', 'rare', 'boots', { speed: 0.18 }),
  piece('gauntlets', 'Gauntlets of Might', 'uncommon', 'defence', { power: 0.1, armor: 0.06 }),
  piece('emerald_ring', 'Emerald Ring', 'uncommon', 'accessory', { regen: 1.5 }),
  piece('arcane_staff', 'Arcane Staff', 'rare', 'weapon', { power: 0.15 }),
  piece('thunder_hammer', 'Thunder Hammer', 'epic', 'weapon', { power: 0.25, hp: 10 }),
  piece('emberbrand', 'Emberbrand', 'epic', 'weapon', { power: 0.22, leech: 0.04 }),
  piece('tome_of_embers', 'Tome of Embers', 'epic', 'accessory', { power: 0.18, regen: 1 }),
  piece('moonstone_orb', 'Moonstone Orb', 'epic', 'defence', { regen: 2, armor: 0.1 }),
  piece('dragonfang', 'Dragonfang', 'legendary', 'weapon', { power: 0.35, hp: 20 }),
  piece('golden_aegis', 'Golden Aegis', 'legendary', 'defence', { armor: 0.2, hp: 40 }),
  piece('phoenix_feather', 'Phoenix Feather', 'legendary', 'headwear', { regen: 3, speed: 0.12, hp: 20 }),
  // The second twenty, weighted toward what the first twenty had least of: helms, body armour, boots and shields.
  piece('leather_hood', 'Ranger Hood', 'common', 'headwear', { hp: 8, speed: 0.04 }),
  piece('wizard_hat', 'Starry Hat', 'uncommon', 'headwear', { power: 0.08, regen: 0.5 }),
  piece('horned_helm', 'Horned Helm', 'rare', 'headwear', { hp: 20, power: 0.06 }),
  piece('jeweled_crown', 'Jeweled Crown', 'epic', 'headwear', { hp: 25, regen: 1.5 }),
  piece('valkyrie_helm', 'Valkyrie Helm', 'legendary', 'headwear', { armor: 0.12, hp: 30, speed: 0.06 }),
  piece('padded_tunic', 'Padded Tunic', 'common', 'chest', { hp: 12, armor: 0.03 }),
  piece('chainmail', 'Chainmail', 'uncommon', 'chest', { armor: 0.08, hp: 10 }),
  piece('shadow_cloak', 'Shadow Cloak', 'rare', 'chest', { speed: 0.1, leech: 0.03 }),
  piece('dragonscale_mail', 'Dragonscale Mail', 'epic', 'chest', { armor: 0.14, hp: 30 }),
  piece('fur_boots', 'Fur Boots', 'common', 'boots', { speed: 0.04, regen: 0.3 }),
  piece('iron_greaves', 'Iron Greaves', 'uncommon', 'boots', { armor: 0.06, speed: 0.04 }),
  piece('lava_striders', 'Lava Striders', 'epic', 'boots', { speed: 0.16, power: 0.08 }),
  piece('leather_bracers', 'Leather Bracers', 'common', 'defence', { armor: 0.05 }),
  piece('spiked_buckler', 'Spiked Buckler', 'uncommon', 'defence', { armor: 0.05, power: 0.05 }),
  piece('tower_shield', 'Tower Shield', 'rare', 'defence', { armor: 0.14, hp: 10 }),
  piece('frostguard', 'Frostguard', 'epic', 'defence', { armor: 0.14, regen: 1 }),
  piece('wolf_tooth', 'Wolf Tooth Charm', 'common', 'accessory', { power: 0.06 }),
  piece('clover_charm', 'Clover Locket', 'uncommon', 'accessory', { regen: 0.8, speed: 0.04 }),
  piece('hunter_longbow', 'Hunter Longbow', 'rare', 'weapon', { power: 0.14, speed: 0.04 }),
  piece('void_scythe', 'Void Scythe', 'legendary', 'weapon', { power: 0.3, leech: 0.08 }),
  // The Wraithbound set: one legendary for each slot, dropped only by the Hollow Queen in the Spirit Dungeon.
  piece('wraith_crown', 'Wraith Crown', 'legendary', 'headwear', { hp: 30, regen: 2 }, 'wraith'),
  piece('wraith_shroud', 'Shroud of the Hollow', 'legendary', 'chest', { armor: 0.14, hp: 30 }, 'wraith'),
  piece('wraith_treads', 'Ghoststep Treads', 'legendary', 'boots', { speed: 0.16, armor: 0.04 }, 'wraith'),
  piece('soulreaver', 'Soulreaver', 'legendary', 'weapon', { power: 0.3, leech: 0.06 }, 'wraith'),
  piece('phantom_ward', 'Phantom Ward', 'legendary', 'defence', { armor: 0.16, regen: 1.5 }, 'wraith'),
  piece('soul_lantern', 'Lantern of Souls', 'legendary', 'accessory', { power: 0.12, regen: 2, hp: 15 }, 'wraith'),
  // The Emberborn set: one legendary for each slot, dropped only by the Elementinho in its temple.
  piece('flame_crown', 'Crown of Living Flame', 'legendary', 'headwear', { power: 0.1, hp: 25 }, 'ember'),
  piece('ember_mail', 'Emberheart Mail', 'legendary', 'chest', { armor: 0.12, hp: 30, power: 0.05 }, 'ember'),
  piece('cinder_boots', 'Cinderstep Boots', 'legendary', 'boots', { speed: 0.18, power: 0.05 }, 'ember'),
  piece('surgefire', 'Blazing Surge', 'legendary', 'weapon', { power: 0.34, hp: 10 }, 'ember'),
  piece('ember_aegis', 'Aegis of Ember Rain', 'legendary', 'defence', { armor: 0.15, hp: 20 }, 'ember'),
  piece('flame_heart', 'Heart of Elementinho', 'legendary', 'accessory', { power: 0.12, regen: 2, hp: 15 }, 'ember'),
];

/** How many pieces of `set` are among `defs`, out of how many there are. */
export function setCount(defs: GearDef[], set: SetId): { worn: number; of: number } {
  return { worn: defs.filter((g) => g.set === set).length, of: GEAR.filter((g) => g.set === set).length };
}

/** The sets worn whole among `defs`. */
export function fullSets(defs: GearDef[]): SetId[] {
  return (Object.keys(GEAR_SETS) as SetId[]).filter((k) => {
    const c = setCount(defs, k);
    return c.worn === c.of;
  });
}

export const gearById = (id: string): GearDef | undefined => GEAR.find((g) => g.id === id);


/** The stats in the order they're listed, with short names and how to show a value. */
export const STAT_KEYS = ['power', 'armor', 'speed', 'hp', 'regen', 'leech'] as const;
export const STAT_LABEL: Record<keyof GearStats, string> = { power: 'DMG', armor: 'ARMOR', speed: 'SPEED', hp: 'HP', regen: 'REGEN', leech: 'LEECH' };

/** A stat value as shown: "+10%", "+15", "+1.5/S". */
export function statValue(k: keyof GearStats, v: number): string {
  const sign = v < 0 ? '-' : '+';
  const a = Math.abs(v);
  if (k === 'hp') return `${sign}${Math.round(a)}`;
  if (k === 'regen') return `${sign}${Math.round(a * 10) / 10}/S`;
  return `${sign}${Math.round(a * 100)}%`;
}

/** Where a total stops counting, so no set of gear makes the hero untouchable or uncontrollably fast. */
export const STAT_CAP: Partial<Record<keyof GearStats, number>> = { armor: 0.6, speed: 0.5 };

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

/** Sets only their own boss drops. */
const SET_BOSS: Record<string, SetId> = { queen: 'wraith', elementinho: 'ember' };

/** A piece picked up this run, for the HUD's banner; `worn` if it went straight into an empty slot. */
export interface GearNews {
  def: GearDef;
  worn: boolean;
}

export class GearBag {
  /** What the hero wears this run: the equip slots on the Inventory page, changeable from the bag. */
  worn: GearDef[] = [];
  /** Pieces picked up this run; they won't drop again until the next. */
  found = new Set<string>();
  /** Pieces just picked up, for the HUD's banner; it takes them off the front. */
  news: GearNews[] = [];
  /** Totals of every worn piece's stats, with set bonuses: these are what count. */
  totals: Required<GearStats> = sumStats([]);
  /** Sets worn whole right now. */
  sets: SetId[] = [];

  /** A new run: nothing found yet. Call `wear` with the equipped pieces next. */
  reset(): void {
    this.worn = [];
    this.found.clear();
    this.news = [];
    this.totals = sumStats([]);
    this.sets = [];
  }

  /** Wear these pieces; returns how much max health changed, for the hero's vitals. */
  wear(defs: GearDef[]): number {
    const before = this.totals.hp;
    this.worn = defs;
    this.totals = wornStats(defs);
    this.sets = fullSets(defs);
    return this.totals.hp - before;
  }

  /** A piece was picked up this run. */
  pick(def: GearDef, worn: boolean): void {
    this.found.add(def.id);
    this.news.push({ def, worn });
  }

  /** Multiplier on damage dealt. */
  get power(): number {
    return 1 + this.totals.power;
  }

  /** Multiplier on damage taken. */
  get guard(): number {
    return 1 - Math.min(STAT_CAP.armor!, this.totals.armor);
  }

  /** Multiplier on walking speed. */
  get speed(): number {
    return 1 + Math.min(STAT_CAP.speed!, this.totals.speed);
  }

  /**
   * What a slain monster of `kind` drops, by its tier (tiers.ts): one roll for
   * a regular piece of some rarity, and for a Legend or Myth with an item set,
   * its own roll for a piece of that set. Pieces found this run, or in `skip`
   * (already owned, or lying on the ground), never drop; when every piece of
   * the rolled rarity is taken, that roll drops nothing.
   */
  roll(kind: string, skip: Set<string>): GearDef[] {
    const tier = tierOf(kind);
    const out: GearDef[] = [];
    const free = (g: GearDef) => !this.found.has(g.id) && !skip.has(g.id);
    const any = (of: GearDef[]) => of[Math.floor(Math.random() * of.length)];
    const set = SET_BOSS[kind];
    if (set && Math.random() < TIER_SET_CHANCE[tier]) {
      const missing = GEAR.filter((g) => g.set === set && free(g));
      if (missing.length) out.push(any(missing));
    }
    const odds = TIER_DROPS[tier];
    let r = Math.random();
    for (const k of RARITIES) {
      r -= odds[k];
      if (r >= 0) continue;
      const of = GEAR.filter((g) => !g.set && g.rarity === k && free(g));
      if (of.length) out.push(any(of));
      break;
    }
    return out;
  }
}

/** The player's gear; the world empties it each run and the UI draws it. */
export const gear = new GearBag();
