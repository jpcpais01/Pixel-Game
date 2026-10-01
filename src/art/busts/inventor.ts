// The Inventor's bust: the Engineer, a friendly face under a yellow hard
// hat with brass goggles pushed up on it, a big brown moustache, an orange
// work shirt under blue overalls, and a wrench resting on his shoulder.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { EYE, SKIN } from '../palette';
import { BRASS, DENIM, HARD_HAT, LENS, MOUSTACHE, STEEL, WORK_SHIRT } from '../inventor';
import { C, pair, shoulders } from './kit';

export function inventorBust(c: PixelCanvas): void {
  // The work shirt.
  shoulders(c, WORK_SHIRT, 24, 7, 17, 5);
  // The overalls' bib and straps, with brass buttons.
  c.part();
  c.shape(28, 33, () => [C - 5, C + 5], DENIM, (_x, _y, t) => cyl(t, 0.2));
  pair(10, (x, s) => c.line(x, 24, x - s, 33, DENIM, () => cyl(0.3 * s, 0.3)));
  c.part();
  pair(13, (x) => c.px(x, 29, BRASS, sphere(0, 0.5)));
  // The neck.
  c.part();
  c.shape(21, 24, () => [C - 3, C + 3], SKIN, (_x, _y, t) => cyl(t, 0), { bias: -1 });
  // Ears, then the face.
  c.part();
  pair(11.2, (x) => c.ellipse(x + 0.5, 16.5, 1.5, 2, SKIN));
  c.part();
  c.ellipse(C, 16.2, 5.6, 5.9, SKIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.55, dy * 0.6, 1) });
  // Sideburns.
  pair(11, (x) => {
    c.px(x, 13, MOUSTACHE, cyl(0, 0.3));
    c.px(x, 14, MOUSTACHE, cyl(0, 0.3));
  });
  // Eyes under bushy brows, a big round nose.
  c.part();
  pair(14, (x) => {
    c.px(x, 15, EYE);
    c.px(x, 16, EYE);
  });
  pair(13, (x, s) => c.line(x, 13, x - s, 13, MOUSTACHE, () => sphere(0, 0.6)));
  c.part();
  c.ellipse(C, 17.6, 1.5, 1.3, SKIN, { flatten: 1.2 });
  // The moustache: broad and bushy, curling down at its ends, with a grin
  // showing under it.
  c.part();
  c.shape(19, 20, (y) => (y === 19 ? [C - 3, C + 3] : [C - 4.5, C + 4.5]), MOUSTACHE, (_x, _y, t) => sphere(t, 0.2, 0.8));
  c.shade(16, 20, -1);
  c.shade(17, 20, -1);
  pair(12, (x) => c.px(x, 21, MOUSTACHE, sphere(0, -0.5)));
  c.line(15, 21, 18, 21, SKIN, () => sphere(0, -0.6), { bias: -2 });
  // The hard hat: a dome with a ridge down its middle, over a wide brim.
  c.part();
  c.shape(
    4,
    11,
    (y) => {
      const u = (y - 4) / 7;
      const hw = 7 * Math.sqrt(Math.min(1, 0.2 + u * 1.1));
      return [C - hw, C + hw];
    },
    HARD_HAT,
    (_x, _y, t, u) => cyl(t, 0.6 - u * 0.4),
  );
  c.part();
  c.line(C - 1, 4, C - 1, 10, HARD_HAT, () => cyl(-0.2, 0.6), { bias: 1 });
  c.line(C, 4, C, 10, HARD_HAT, () => cyl(0.3, 0.6));
  c.part();
  c.ellipse(C, 11.6, 9.2, 1.6, HARD_HAT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, -dy * 0.4 + 0.5, 0.8) });
  // Brass goggles pushed up on the hat, lenses catching the light.
  c.part();
  c.shape(8, 8, () => [C - 7, C + 7], BRASS, (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
  c.part();
  pair(14, (x) => c.ellipse(x + 0.5, 8.3, 2.1, 1.9, BRASS));
  c.part();
  pair(14, (x) => c.ellipse(x + 0.5, 8.3, 1.3, 1.1, LENS));
  // A wrench over his right shoulder, its jaw open by his ear.
  c.part();
  c.capsule(31, 34, 27.5, 23.5, 1.1, 1, STEEL);
  c.ellipse(27, 21, 2.6, 2.6, STEEL);
  // Its open jaw, facing up.
  for (const [x, y] of [[26, 19], [27, 19], [26, 20], [27, 20]]) c.erase(x, y);
}
