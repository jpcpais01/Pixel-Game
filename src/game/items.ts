// Items and the hotbar. Nine slots, bound to keys 1 to 9 and tappable on the
// HUD; each holds a stack of one item. An item's `use` gets a small context
// from the world, so items never reach into a scene directly. A new item is
// one entry in ITEMS plus its icon and drop art (art/items.ts, built in
// art/textures.ts).

import type { Hero } from './characters';
import { SWIFTNESS, type BuffDef } from './buffs';

export interface ItemContext {
  hero: Hero;
  /** Heal the hero; returns how much health it restored. */
  heal(amount: number): number;
  addBuff(def: BuffDef): void;
  /** A word or number floating up over the hero's head. */
  pop(text: string, tint: number): void;
}

export interface ItemDef {
  id: string;
  name: string;
  /** Hotbar icon texture (16x16) and the texture lying on the ground when dropped. */
  icon: string;
  drop: string;
  /** Glow colour for the drop and the slot's flash when used. */
  tint: number;
  /** ms before this item can be used again. */
  cooldown: number;
  /** Returns false if it can't be used now (nothing is spent). */
  use(ctx: ItemContext): boolean;
}

export const ITEMS = {
  health: {
    id: 'health',
    name: 'Health potion',
    icon: 'item_health',
    drop: 'drop_health',
    tint: 0xff5a6a,
    cooldown: 1200,
    use(ctx) {
      const v = ctx.hero.vitals;
      if (v.hp >= v.max) {
        ctx.pop('FULL', 0xffd35c);
        return false;
      }
      const got = ctx.heal(Math.round(v.max * 0.45));
      ctx.pop(`+${got}`, 0x8cff7a);
      return true;
    },
  },
  speed: {
    id: 'speed',
    name: 'Speed potion',
    icon: 'item_speed',
    drop: 'drop_speed',
    tint: 0x5fd8ff,
    cooldown: 1200,
    use(ctx) {
      ctx.addBuff(SWIFTNESS);
      ctx.pop('SWIFT', 0x9cecff);
      return true;
    },
  },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

export const HOTBAR_SIZE = 9;
export const MAX_STACK = 9;

export interface Slot {
  item: ItemDef;
  count: number;
}

export class Inventory {
  slots: (Slot | null)[] = new Array(HOTBAR_SIZE).fill(null);
  /** ms left on each item's cooldown, by item id. */
  private cooling = new Map<string, number>();
  /** Time each slot was last used or filled, for the HUD's flash (ms, counting down). */
  flash: number[] = new Array(HOTBAR_SIZE).fill(0);

  reset(start: [ItemId, number][]): void {
    this.slots.fill(null);
    this.cooling.clear();
    this.flash.fill(0);
    for (const [id, n] of start) this.add(id, n);
  }

  /** Stacks onto a slot holding the same item, else takes the first empty one. Returns how many fit. */
  add(id: ItemId, count = 1): number {
    const item = ITEMS[id];
    let left = count;
    for (let i = 0; i < HOTBAR_SIZE && left > 0; i++) {
      const s = this.slots[i];
      if (s?.item !== item || s.count >= MAX_STACK) continue;
      const n = Math.min(left, MAX_STACK - s.count);
      s.count += n;
      left -= n;
      this.flash[i] = 300;
    }
    for (let i = 0; i < HOTBAR_SIZE && left > 0; i++) {
      if (this.slots[i]) continue;
      const n = Math.min(left, MAX_STACK);
      this.slots[i] = { item, count: n };
      left -= n;
      this.flash[i] = 300;
    }
    return count - left;
  }

  /** Room for at least one more of `id`? */
  canTake(id: ItemId): boolean {
    const item = ITEMS[id];
    return this.slots.some((s) => !s || (s.item === item && s.count < MAX_STACK));
  }

  /** 0..1 of the cooldown left for the item in slot `i`. */
  cooldown(i: number): number {
    const s = this.slots[i];
    if (!s) return 0;
    return (this.cooling.get(s.item.id) ?? 0) / s.item.cooldown;
  }

  /** Use one item from slot `i`. Returns the item if it was used. */
  use(i: number, ctx: ItemContext): ItemDef | null {
    const s = this.slots[i];
    if (!s || (this.cooling.get(s.item.id) ?? 0) > 0) return null;
    if (!s.item.use(ctx)) return null;
    this.cooling.set(s.item.id, s.item.cooldown);
    this.flash[i] = 300;
    if (--s.count <= 0) this.slots[i] = null;
    return s.item;
  }

  update(dt: number): void {
    for (const [id, t] of this.cooling) this.cooling.set(id, Math.max(0, t - dt));
    for (let i = 0; i < HOTBAR_SIZE; i++) this.flash[i] = Math.max(0, this.flash[i] - dt);
  }
}

/** The player's hotbar; the world fills it each run and the UI draws it. */
export const inventory = new Inventory();

/** What a hero carries at the start of a run. */
export const STARTING_ITEMS: [ItemId, number][] = [
  ['health', 3],
  ['speed', 2],
];

/** Chance a slain monster leaves a potion, by kind; others use the default. */
export const DROP_CHANCE: Record<string, number> = { beetle: 0.6, barkling: 0.3 };
export const DEFAULT_DROP_CHANCE = 0.18;

/** Which potion drops: mostly health. */
export function rollDrop(kind: string): ItemId | null {
  if (Math.random() >= (DROP_CHANCE[kind] ?? DEFAULT_DROP_CHANCE)) return null;
  return Math.random() < 0.65 ? 'health' : 'speed';
}
