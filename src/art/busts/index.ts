// Every class's medallion bust, by class id (see kit.ts).

import { PixelCanvas, type RenderedFrame } from '../pixel';
import { BUST, type BustPainter } from './kit';
import { alchemistBust } from './alchemist';
import { archerBust } from './archer';
import { automatonBust } from './automaton';
import { beastBust } from './beast';
import { duelistBust } from './duelist';
import { inventorBust } from './inventor';
import { jediBust } from './jedi';
import { mysticBust } from './mystic';
import { necromancerBust } from './necromancer';
import { phantomBust } from './phantom';
import { warriorBust } from './warrior';
import { wizardBust } from './wizard';

export { BUST } from './kit';

const BUSTS: Record<string, BustPainter> = {
  mage: wizardBust,
  warrior: warriorBust,
  jedi: jediBust,
  alchemist: alchemistBust,
  archer: archerBust,
  duelist: duelistBust,
  necromancer: necromancerBust,
  mystic: mysticBust,
  automaton: automatonBust,
  phantom: phantomBust,
  inventor: inventorBust,
  beast: beastBust,
};

const done = new Map<string, RenderedFrame>();

/** A class's bust, lit and outlined, or null for a class that has none yet. */
export function classBust(id: string): RenderedFrame | null {
  const paint = BUSTS[id];
  if (!paint) return null;
  let r = done.get(id);
  if (!r) {
    const c = new PixelCanvas(BUST, BUST);
    paint(c);
    r = c.render();
    done.set(id, r);
  }
  return r;
}
