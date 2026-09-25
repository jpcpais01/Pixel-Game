// A name and an icon for any item id a save might hold, so the Inventory
// page can show it. Ids the game no longer knows still get a row.

import { ITEMS } from './items';

export interface ItemInfo {
  name: string;
  icon: string;
}

export function itemInfo(id: string): ItemInfo {
  const def = (ITEMS as Record<string, { name: string; icon: string }>)[id];
  return def ? { name: def.name, icon: def.icon } : { name: id, icon: '' };
}
