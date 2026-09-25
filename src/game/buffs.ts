// Timed effects on the hero: the speed potion, and the blooms of the Sunken
// Garden. A buff is a def with modifiers; the world multiplies them in where
// they apply (walking speed in WorldScene.update, damage dealt as blows land,
// damage taken in WorldScene.hurtHero, healing each frame) and the UI draws
// the active ones with their time left. Adding a buff that is already active
// refreshes its time.

export interface BuffMods {
  /** Multiplies walking speed. */
  speed?: number;
  /** Multiplies the damage the hero's blows deal. */
  damage?: number;
  /** Multiplies the damage the hero takes. */
  guard?: number;
  /** Health restored per second. */
  regen?: number;
}

export interface BuffDef {
  id: string;
  name: string;
  /** Texture drawn on the buff's badge in the HUD. */
  icon: string;
  /** Badge and trail colour. */
  tint: number;
  /** ms */
  duration: number;
  mods: BuffMods;
}

export interface ActiveBuff {
  def: BuffDef;
  /** ms left */
  left: number;
}

export class Buffs {
  active: ActiveBuff[] = [];

  add(def: BuffDef): void {
    const had = this.active.find((b) => b.def.id === def.id);
    if (had) had.left = def.duration;
    else this.active.push({ def, left: def.duration });
  }

  has(id: string): boolean {
    return this.active.some((b) => b.def.id === id);
  }

  update(dt: number): void {
    for (const b of this.active) b.left -= dt;
    this.active = this.active.filter((b) => b.left > 0);
  }

  clear(): void {
    this.active = [];
  }

  /** The product of every active buff's `key` modifier. */
  mod(key: Exclude<keyof BuffMods, 'regen'>): number {
    let m = 1;
    for (const b of this.active) m *= b.def.mods[key] ?? 1;
    return m;
  }

  /** Health per second from every active buff. */
  get regen(): number {
    let r = 0;
    for (const b of this.active) r += b.def.mods.regen ?? 0;
    return r;
  }
}

/** The player's buffs; the world resets them each run and the UI reads them. */
export const heroBuffs = new Buffs();

export const SWIFTNESS: BuffDef = {
  id: 'swift',
  name: 'Swiftness',
  icon: 'item_speed',
  tint: 0x5fd8ff,
  duration: 10000,
  mods: { speed: 1.5 },
};

// The Sunken Garden's blooms. Its swift bloom gives Swiftness, like the potion.

export const MIGHT: BuffDef = {
  id: 'might',
  name: 'Might',
  icon: 'buff_might',
  tint: 0xffc23a,
  duration: 20000,
  mods: { damage: 1.4 },
};

export const WARD: BuffDef = {
  id: 'ward',
  name: 'Ward',
  icon: 'buff_ward',
  tint: 0xa98aff,
  duration: 20000,
  mods: { guard: 0.6 },
};

export const RENEW: BuffDef = {
  id: 'renew',
  name: 'Renew',
  icon: 'buff_renew',
  tint: 0xff7aa8,
  duration: 10000,
  mods: { regen: 5 },
};
