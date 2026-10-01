// Every class's medallion bust, by class id (see kit.ts).

import { PixelCanvas, type RenderedFrame } from '../pixel';
import { BUST, type BustPainter } from './kit';
import { wizardBust } from './wizard';
import { BUSTS_A } from './group-a';
import { BUSTS_B } from './group-b';
import { BUSTS_C } from './group-c';

export { BUST } from './kit';

const BUSTS: Record<string, BustPainter> = {
  wizard: wizardBust,
  ...BUSTS_A,
  ...BUSTS_B,
  ...BUSTS_C,
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
