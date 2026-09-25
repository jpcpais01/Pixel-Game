// Timed effects on the hero (the speed potion, for now). A buff is a def
// with modifiers; the world multiplies them in where they apply (walking
// speed in WorldScene.update) and the UI draws the active ones with their
// time left. Adding a buff that is already active refreshes its time.

export interface BuffMods {
  /** Multiplies walking speed. */
  speed?: number;
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
  mod(key: keyof BuffMods): number {
    let m = 1;
    for (const b of this.active) m *= b.def.mods[key] ?? 1;
    return m;
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
