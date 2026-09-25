// Gear: equipment that monsters drop. Walking over a piece picks it up and
// keeps it for good (see collection.ts). Each piece has one of six slot
// types, and the hero wears one piece per type: only worn pieces count. A
// piece goes on by itself when its slot is empty; otherwise the player swaps
// it in from the Inventory page or the bag in a run. A new piece is one
// entry in GEAR (with its slot type) plus its painter in art/gear.ts.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** Rarities from least to most rare; `tint` colours names, frames and icon backgrounds. */
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITY: Record<Rarity, { name: string; tint: number; weight: number }> = {
  common: { name: 'Common', tint: 0x5fa8ff, weight: 44 },
  uncommon: { name: 'Uncommon', tint: 0x62e07a, weight: 28 },
  rare: { name: 'Rare', tint: 0xffd84a, weight: 17 },
  epic: { name: 'Epic', tint: 0xc084ff, weight: 8 },
  legendary: { name: 'Legendary', tint: 0xfff8ec, weight: 3 },
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

export interface GearDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** Which of the six equip slots it goes in. */
  slot: Slot;
  stats: GearStats;
  /** 32x32 icon, and the 16x16 sprite lying on the ground. */
  icon: string;
  drop: string;
}

const piece = (id: string, name: string, rarity: Rarity, slot: Slot, stats: GearStats): GearDef => ({ id, name, rarity, slot, stats, icon: `gear_${id}`, drop: `gdrop_${id}` });

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
];

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

/** Chance a slain monster drops a piece, by kind; others use the default. The Warden always does. */
const GEAR_CHANCE: Record<string, number> = { beetle: 0.22, barkling: 0.14, warden: 1 };
const DEFAULT_GEAR_CHANCE = 0.08;

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
  /** Totals of every worn piece's stats: these are what count. */
  totals: Required<GearStats> = sumStats([]);

  /** A new run: nothing found yet. Call `wear` with the equipped pieces next. */
  reset(): void {
    this.worn = [];
    this.found.clear();
    this.news = [];
    this.totals = sumStats([]);
  }

  /** Wear these pieces; returns how much max health changed, for the hero's vitals. */
  wear(defs: GearDef[]): number {
    const before = this.totals.hp;
    this.worn = defs;
    this.totals = sumStats(defs);
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
   * Maybe a piece for a slain monster of `kind`: a rarity by weight among those
   * with pieces still to find, then one of them. Pieces found this run, or in
   * `skip` (already owned, or lying on the ground), never drop. The Warden
   * drops epics and up.
   */
  roll(kind: string, skip: Set<string>): GearDef | null {
    if (Math.random() >= (GEAR_CHANCE[kind] ?? DEFAULT_GEAR_CHANCE)) return null;
    const left = GEAR.filter((g) => !this.found.has(g.id) && !skip.has(g.id));
    const boss = kind === 'warden';
    let pool = boss ? left.filter((g) => g.rarity === 'epic' || g.rarity === 'legendary') : left;
    if (!pool.length) pool = left;
    if (!pool.length) return null;
    const rarities = [...new Set(pool.map((g) => g.rarity))];
    let r = Math.random() * rarities.reduce((s, k) => s + RARITY[k].weight, 0);
    let pick = rarities[0];
    for (const k of rarities) {
      r -= RARITY[k].weight;
      if (r < 0) {
        pick = k;
        break;
      }
    }
    const of = pool.filter((g) => g.rarity === pick);
    return of[Math.floor(Math.random() * of.length)];
  }
}

/** The player's gear; the world empties it each run and the UI draws it. */
export const gear = new GearBag();
