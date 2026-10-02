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
import { LIGHTWRIGHT_KITS } from './lightwright';
import { TRANSMUTER_KITS } from './transmuter';
import { AQUANAUT_KITS } from './aquanaut';
import { BEAR_KITS } from './bear';
import { AVIATOR_KITS } from './aviator';
import { PYRO_KITS } from './pyrotechnist';

export const KITS: Record<string, Kit> = {
  ...ARCANE_KITS,
  ...ORDER_KITS,
  ...SHADOW_KITS,
  ...WILD_KITS,
  ...FORGED_KITS,
  ...SHOW_KITS,
  ...BLADE_KITS,
  ...LIGHTWRIGHT_KITS,
  ...TRANSMUTER_KITS,
  ...AQUANAUT_KITS,
  ...BEAR_KITS,
  ...AVIATOR_KITS,
  ...PYRO_KITS,
};

export const kitFor = (key: string): Kit => KITS[key] ?? {};
