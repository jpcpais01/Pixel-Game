// Class busts, part of the set (see kit.ts and index.ts).

import type { BustPainter } from './kit';
import { bardBust } from './bard';
import { chronomancerBust } from './chronomancer';
import { necromancerBust } from './necromancer';
import { puppeteerBust } from './puppeteer';
import { rogueBust } from './rogue';
import { samuraiBust } from './samurai';

export const BUSTS_B: Record<string, BustPainter> = {
  rogue: rogueBust,
  necromancer: necromancerBust,
  bard: bardBust,
  chronomancer: chronomancerBust,
  puppeteer: puppeteerBust,
  samurai: samuraiBust,
};
