// A name, an icon and a short description for any item id a save might hold,
// so the Inventory page can show potions and gear alike. Only gear can go in
// the equip slots. Ids the game no longer knows still get a row.

import { ITEMS } from './items';
import { gearById, RARITY, statLines } from './gear';

export interface ItemInfo {
  name: string;
  icon: string;
  /** Rarity colour for gear; potions use their own tint. */
  tint: number;
  /** One line under the name: gear stats, or what a potion is for. */
  detail: string;
  equippable: boolean;
}

export function itemInfo(id: string): ItemInfo {
  const g = gearById(id);
  if (g) return { name: g.name, icon: g.icon, tint: RARITY[g.rarity].tint, detail: statLines(g.stats).join('  '), equippable: true };
  const def = (ITEMS as Record<string, { name: string; icon: string; tint: number }>)[id];
  if (def) return { name: def.name, icon: def.icon, tint: def.tint, detail: 'Potion: used from the hotbar', equippable: false };
  return { name: id, icon: '', tint: 0xfff4d6, detail: '', equippable: false };
}
