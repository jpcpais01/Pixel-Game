// Every Auto Battle hero's own effects, by piece key (`class.type`, as in
// UNITS). Each group's heroes are drawn in their own file with the shared
// kit in ../paint.ts.

import type { Kit } from '../paint';
import { ARCANE_KITS } from './arcane';
import { ORDER_KITS } from './order';
import { SHADOW_KITS } from './shadow';
import { WILD_KITS } from './wild';
import { FORGED_KITS } from './forged';
import { SHOW_KITS } from './show';
import { BLADE_KITS } from './blade';
import { SAGE_KITS } from './sage';
import { BARROW_KITS } from './barrow';
import { FALCONER_KITS } from './falconer';
import { TWIN_KITS } from './twin';
import { INQUISITOR_KITS } from './inquisitor';
import { REAPER_KITS } from './reaper';
import { LICH_KITS } from './lich';

export const KITS: Record<string, Kit> = {
  ...ARCANE_KITS,
  ...ORDER_KITS,
  ...SHADOW_KITS,
  ...WILD_KITS,
  ...FORGED_KITS,
  ...SHOW_KITS,
  ...BLADE_KITS,
  ...SAGE_KITS,
  ...BARROW_KITS,
  ...FALCONER_KITS,
  ...TWIN_KITS,
  ...INQUISITOR_KITS,
  ...REAPER_KITS,
  ...LICH_KITS,
};

export const kitFor = (key: string): Kit => KITS[key] ?? {};
