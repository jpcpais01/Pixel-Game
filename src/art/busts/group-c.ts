// Class busts, part of the set (see kit.ts and index.ts).

import type { BustPainter } from './kit';
import { automatonBust } from './automaton';
import { beastBust } from './beast';
import { druidBust } from './druid';
import { inventorBust } from './inventor';
import { phantomBust } from './phantom';
import { valkyrieBust } from './valkyrie';

export const BUSTS_C: Record<string, BustPainter> = {
  druid: druidBust,
  valkyrie: valkyrieBust,
  automaton: automatonBust,
  phantom: phantomBust,
  inventor: inventorBust,
  beast: beastBust,
};
