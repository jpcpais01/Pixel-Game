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
import { BANSHEE_AUTO } from './banshee';
import { YUREI_AUTO } from './yurei';
import { CAPTAIN_AUTO } from './captain';
import { BALLERINA_AUTO } from './ballerina';
import { DIVER_AUTO } from './diver';
import { JUGG_AUTO } from './juggernaut';

export const KITS: Record<string, Kit> = {
  ...ARCANE_KITS,
  ...ORDER_KITS,
  ...SHADOW_KITS,
  ...WILD_KITS,
  ...FORGED_KITS,
  ...SHOW_KITS,
  ...BLADE_KITS,
  ...BANSHEE_AUTO,
  ...YUREI_AUTO,
  ...CAPTAIN_AUTO,
  ...BALLERINA_AUTO,
  ...DIVER_AUTO,
  ...JUGG_AUTO,
};

export const kitFor = (key: string): Kit => KITS[key] ?? {};
