// Gear: forty pieces of equipment that monsters drop. Gear is not used like
// a potion: walking over a piece picks it up, and its stats count from then
// on, for the rest of the run. Each piece is found once per run; the bag
// shows every piece found, and the ones still missing as shadows. A new piece
// is one entry in GEAR plus its painter in art/gear.ts.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** Where a piece is worn. */
export type Slot = 'headwear' | 'chest' | 'boots' | 'accessory' | 'weapon' | 'defence';

export const RARITY: Record<Rarity, { name: string; tint: number; weight: number }> = {
  common: { name: 'Common', tint: 0xd8dde8, weight: 52 },
  uncommon: { name: 'Uncommon', tint: 0x7ee08a, weight: 40 },
  rare: { name: 'Rare', tint: 0x5fb4ff, weight: 30 },
  epic: { name: 'Epic', tint: 0xc084ff, weight: 14 },
  legendary: { name: 'Legendary', tint: 0xffc84a, weight: 4 },
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
  slot?: Slot;
  stats: GearStats;
  /** 32x32 icon, and the 16x16 sprite lying on the ground. */
  icon: string;
  drop: string;
}

const piece = (id: string, name: string, rarity: Rarity, stats: GearStats, slot?: Slot): GearDef => ({ id, name, rarity, slot, stats, icon: `gear_${id}`, drop: `gdrop_${id}` });

export const GEAR: GearDef[] = [
  piece('iron_sword', 'Iron Sword', 'common', { power: 0.1 }),
  piece('leather_boots', 'Leather Boots', 'common', { speed: 0.08 }),
  piece('oak_shield', 'Oak Shield', 'common', { armor: 0.08 }),
  piece('iron_helm', 'Iron Helm', 'common', { hp: 15 }),
  piece('ruby_amulet', 'Ruby Amulet', 'common', { hp: 20 }),
  piece('battle_axe', 'Battle Axe', 'rare', { power: 0.18 }),
  piece('frost_spear', 'Frost Spear', 'rare', { power: 0.12, speed: 0.06 }),
  piece('bloodfang', 'Bloodfang', 'rare', { power: 0.06, leech: 0.05 }),
  piece('knight_plate', 'Knight Plate', 'rare', { hp: 25, armor: 0.1 }),
  piece('winged_boots', 'Winged Boots', 'rare', { speed: 0.18 }),
  piece('gauntlets', 'Gauntlets of Might', 'rare', { power: 0.1, armor: 0.06 }),
  piece('emerald_ring', 'Emerald Ring', 'rare', { regen: 1.5 }),
  piece('arcane_staff', 'Arcane Staff', 'rare', { power: 0.15 }),
  piece('thunder_hammer', 'Thunder Hammer', 'epic', { power: 0.25, hp: 10 }),
  piece('emberbrand', 'Emberbrand', 'epic', { power: 0.22, leech: 0.04 }),
  piece('tome_of_embers', 'Tome of Embers', 'epic', { power: 0.18, regen: 1 }),
  piece('moonstone_orb', 'Moonstone Orb', 'epic', { regen: 2, armor: 0.1 }),
  piece('dragonfang', 'Dragonfang', 'legendary', { power: 0.35, hp: 20 }),
  piece('golden_aegis', 'Golden Aegis', 'legendary', { armor: 0.2, hp: 40 }),
  piece('phoenix_feather', 'Phoenix Feather', 'legendary', { regen: 3, speed: 0.12, hp: 20 }),
  // The second twenty, weighted toward what the first twenty had least of: helms, body armour, boots and shields.
  piece('leather_hood', 'Ranger Hood', 'common', { hp: 8, speed: 0.04 }, 'headwear'),
  piece('wizard_hat', 'Starry Hat', 'uncommon', { power: 0.08, regen: 0.5 }, 'headwear'),
  piece('horned_helm', 'Horned Helm', 'rare', { hp: 20, power: 0.06 }, 'headwear'),
  piece('jeweled_crown', 'Jeweled Crown', 'epic', { hp: 25, regen: 1.5 }, 'headwear'),
  piece('valkyrie_helm', 'Valkyrie Helm', 'legendary', { armor: 0.12, hp: 30, speed: 0.06 }, 'headwear'),
  piece('padded_tunic', 'Padded Tunic', 'common', { hp: 12, armor: 0.03 }, 'chest'),
  piece('chainmail', 'Chainmail', 'uncommon', { armor: 0.08, hp: 10 }, 'chest'),
  piece('shadow_cloak', 'Shadow Cloak', 'rare', { speed: 0.1, leech: 0.03 }, 'chest'),
  piece('dragonscale_mail', 'Dragonscale Mail', 'epic', { armor: 0.14, hp: 30 }, 'chest'),
  piece('fur_boots', 'Fur Boots', 'common', { speed: 0.04, regen: 0.3 }, 'boots'),
  piece('iron_greaves', 'Iron Greaves', 'uncommon', { armor: 0.06, speed: 0.04 }, 'boots'),
  piece('lava_striders', 'Lava Striders', 'epic', { speed: 0.16, power: 0.08 }, 'boots'),
  piece('leather_bracers', 'Leather Bracers', 'common', { armor: 0.05 }, 'defence'),
  piece('spiked_buckler', 'Spiked Buckler', 'uncommon', { armor: 0.05, power: 0.05 }, 'defence'),
  piece('tower_shield', 'Tower Shield', 'rare', { armor: 0.14, hp: 10 }, 'defence'),
  piece('frostguard', 'Frostguard', 'epic', { armor: 0.14, regen: 1 }, 'defence'),
  piece('wolf_tooth', 'Wolf Tooth Charm', 'common', { power: 0.06 }, 'accessory'),
  piece('clover_charm', 'Clover Locket', 'uncommon', { regen: 0.8, speed: 0.04 }, 'accessory'),
  piece('hunter_longbow', 'Hunter Longbow', 'rare', { power: 0.14, speed: 0.04 }, 'weapon'),
  piece('void_scythe', 'Void Scythe', 'legendary', { power: 0.3, leech: 0.08 }, 'weapon'),
];

export const gearById = (id: string): GearDef | undefined => GEAR.find((g) => g.id === id);

/** Stat totals stop here, so a full bag never makes the hero untouchable or uncontrollably fast. */
const MAX_ARMOR = 0.6;
const MAX_SPEED = 0.5;

/** Short lines for a stat block, in the HUD's pixel font: "+10% DMG", "+15 HP". */
export function statLines(s: GearStats): string[] {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const out: string[] = [];
  if (s.power) out.push(`+${pct(s.power)} DMG`);
  if (s.armor) out.push(`+${pct(s.armor)} ARMOR`);
  if (s.speed) out.push(`+${pct(s.speed)} SPEED`);
  if (s.hp) out.push(`+${s.hp} HP`);
  if (s.regen) out.push(`+${s.regen} HP/S`);
  if (s.leech) out.push(`${pct(s.leech)} LIFESTEAL`);
  return out;
}

/** Chance a slain monster drops a piece, by kind; others use the default. The Warden always does. */
const GEAR_CHANCE: Record<string, number> = { beetle: 0.22, barkling: 0.14, warden: 1 };
const DEFAULT_GEAR_CHANCE = 0.08;

export class GearBag {
  owned: GearDef[] = [];
  /** Pieces just picked up, for the HUD's banner; it takes them off the front. */
  news: GearDef[] = [];
  /** Totals of every owned piece's stats. */
  totals: Required<GearStats> = { power: 0, armor: 0, speed: 0, hp: 0, regen: 0, leech: 0 };

  /** Empty the bag for a new run, starting with the `start` pieces (the player's equipped gear). */
  reset(start: GearDef[] = []): void {
    this.owned = [...start];
    this.news = [];
    this.sum();
  }

  has(id: string): boolean {
    return this.owned.some((g) => g.id === id);
  }

  /** Adds a piece; returns false if it was already owned. */
  add(def: GearDef): boolean {
    if (this.has(def.id)) return false;
    this.owned.push(def);
    this.news.push(def);
    this.sum();
    return true;
  }

  private sum(): void {
    const t = { power: 0, armor: 0, speed: 0, hp: 0, regen: 0, leech: 0 };
    for (const g of this.owned) for (const k of Object.keys(t) as (keyof GearStats)[]) t[k] += g.stats[k] ?? 0;
    t.regen = Math.round(t.regen * 10) / 10;
    this.totals = t;
  }

  /** Multiplier on damage dealt. */
  get power(): number {
    return 1 + this.totals.power;
  }

  /** Multiplier on damage taken. */
  get guard(): number {
    return 1 - Math.min(MAX_ARMOR, this.totals.armor);
  }

  /** Multiplier on walking speed. */
  get speed(): number {
    return 1 + Math.min(MAX_SPEED, this.totals.speed);
  }

  /**
   * Maybe a piece for a slain monster of `kind`: a rarity by weight among those
   * with pieces still to find, then one of them. Pieces owned or already lying
   * on the ground (`away`) never drop again. The Warden drops epics and up.
   */
  roll(kind: string, away: Set<string>): GearDef | null {
    if (Math.random() >= (GEAR_CHANCE[kind] ?? DEFAULT_GEAR_CHANCE)) return null;
    const left = GEAR.filter((g) => !this.has(g.id) && !away.has(g.id));
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
