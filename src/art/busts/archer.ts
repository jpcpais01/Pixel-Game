// The Archer's bust: the Ranger, a freckled face in a forest-green hood with
// ginger hair spilling from it, a strap across the chest and red-fletched
// arrows standing up over his shoulder.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { SKIN } from '../palette';
import { RANGER_LOOK } from '../archer';
import { C, pair, shoulders } from './kit';

export function archerBust(c: PixelCanvas): void {
  const L = RANGER_LOOK;
  // The arrows in the quiver behind his right shoulder.
  for (const [x0, x1] of [[12, 14], [13, 15.5]] as const) {
    c.line(x0, 13, x1, 6, L.shaft, () => cyl(0.3, 0.3));
    c.px(Math.round(x1), 5, L.fletch, sphere(0.2, 0.5));
    c.px(Math.round(x1), 6, L.fletch, sphere(0.2, 0));
  }
  // The tunic under the cloak, and the strap across.
  c.part();
  shoulders(c, L.cloak, 13, 4, 9, 3);
  c.part();
  c.shape(13, 17, (y) => [C - 1 - (y - 13) * 0.4, C + 1 + (y - 13) * 0.4], L.tunic, (_x, _y, t) => cyl(t, 0.3));
  c.part();
  c.line(5, 13, 13, 17, L.jerkin, () => cyl(0, 0.3));
  // The hood, peaked a little, round the head.
  c.part();
  c.shape(
    2,
    12,
    (y) => {
      const u = (y - 2) / 10;
      const hw = u < 0.5 ? 1 + 3.8 * Math.sin((u / 0.5) * Math.PI * 0.5) : 4.8 + (u - 0.5) * 0.8;
      return [C + (1 - u) * 0.6 - hw, C + (1 - u) * 0.6 + hw];
    },
    L.cloak,
    (_x, _y, t, u) => cyl(t, 0.5 - u * 0.6),
  );
  // The face, freckled across the nose.
  c.part();
  c.ellipse(C, 9.6, 3.3, 2.7, SKIN);
  pair(7, (x) => c.px(x, 9, L.eye));
  pair(6, (x) => c.shade(x, 10, -1));
  // Ginger hair: a fringe across the brow, locks spilling by the cheeks.
  c.part();
  c.shape(7, 7, () => [C - 3.4, C + 2.6], L.hair, (_x, _y, t) => sphere(t * 0.8, 0.4));
  c.px(11, 8, L.hair, sphere(0.5, 0.1));
  pair(5, (x) => c.shape(8, 11, () => [x + 0.1, x + 1], L.hair, (_x, _y, t) => cyl(t, 0.1)));
}
