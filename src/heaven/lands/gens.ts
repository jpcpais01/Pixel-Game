// The pure halves of every land, by id: what the land worker and the node
// script grow, and what each LandDef hands the world. One gen per land per
// thread, made on first use (they keep caches of their own). A land's
// sheets are listed here too, so the node script can draw them.

import type { LandGen, SheetDef } from './types';
import { ShoreGen } from './shore/gen';
import { shoreSheets } from './shore/art';
import { SaltGen } from './saltflats/gen';
import { saltSheets } from './saltflats/art';
import { HushGen } from './hushfall/gen';
import { hushSheets } from './hushfall/art';
import { LumenGen } from './lumen/gen';
import { lumenSheets } from './lumen/art';

const MAKERS: Record<string, { gen: () => LandGen; sheets: () => SheetDef[] }> = {
  shore: { gen: () => new ShoreGen(), sheets: shoreSheets },
  saltflats: { gen: () => new SaltGen(), sheets: saltSheets },
  hushfall: { gen: () => new HushGen(), sheets: hushSheets },
  lumen: { gen: () => new LumenGen(), sheets: lumenSheets },
};

const made = new Map<string, LandGen>();

/** The pure half of land `id`, or null if there's no such land. */
export function landGen(id: string): LandGen | null {
  let g = made.get(id);
  if (g) return g;
  const make = MAKERS[id];
  if (!make) return null;
  made.set(id, (g = make.gen()));
  return g;
}

/** Land `id`'s prop sheets (drawn when asked, not here). */
export function landSheets(id: string): SheetDef[] {
  return MAKERS[id]?.sheets() ?? [];
}
