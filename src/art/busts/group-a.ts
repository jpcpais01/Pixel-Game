// Class busts, part of the set (see kit.ts and index.ts).

import type { BustPainter } from './kit';
import { alchemistBust } from './alchemist';
import { archerBust } from './archer';
import { fighterBust } from './fighter';
import { jediBust } from './jedi';
import { paladinBust } from './paladin';
import { warriorBust } from './warrior';

export const BUSTS_A: Record<string, BustPainter> = {
  warrior: warriorBust,
  paladin: paladinBust,
  jedi: jediBust,
  fighter: fighterBust,
  alchemist: alchemistBust,
  archer: archerBust,
};
