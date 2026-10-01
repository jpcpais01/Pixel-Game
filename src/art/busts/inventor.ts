// The Inventor's bust: the Engineer, a friendly face under a yellow hard
// hat with brass goggles pushed up on it, a big brown moustache, an orange
// work shirt under blue overalls, and a wrench resting on his shoulder.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { EYE, SKIN } from '../palette';
import { BRASS, DENIM, HARD_HAT, LENS, MOUSTACHE, STEEL, WORK_SHIRT } from '../inventor';
import { C, pair, shoulders } from './kit';

export function inventorBust(c: PixelCanvas): void {
  // The shirt, the overalls' bib and straps over it.
  shoulders(c, WORK_SHIRT, 13, 4, 9, 3);
  c.part();
  c.shape(15, 17, () => [C - 3, C + 3], DENIM, (_x, _y, t) => cyl(t, 0.3));
  pair(5, (x) => c.line(x, 13, x, 15, DENIM, () => cyl(0, 0.3)));
  c.px(6, 15, BRASS, sphere(0, 0.4));
  c.px(11, 15, BRASS, sphere(0, 0.4));
  // The wrench on his right shoulder, its jaw up by his ear.
  c.part();
  c.line(13, 14, 15, 9, STEEL, () => cyl(0.3, 0.3));
  c.px(15, 8, STEEL, sphere(0.2, 0.5));
  c.px(16, 9, STEEL, sphere(0.4, 0.3));
  // The face, a nose and a big moustache.
  c.part();
  c.ellipse(C, 9.4, 3.7, 2.9, SKIN);
  pair(7, (x) => c.px(x, 9, EYE));
  c.part();
  c.shape(11, 11, () => [C - 3, C + 3], MOUSTACHE, (_x, _y, t) => sphere(t * 0.9, 0.1));
  c.px(8, 10, SKIN, sphere(-0.4, -0.3), { bias: 1 });
  c.px(9, 10, SKIN, sphere(0.35, -0.2));
  // The hard hat: a dome with a ridge, a short brim.
  c.part();
  c.shape(
    3,
    7,
    (y) => {
      const d = (y + 0.5 - 7.4) / 4.4;
      const hw = 4.4 * Math.sqrt(Math.max(0, 1 - d * d)) + 0.3;
      return [C - hw, C + hw];
    },
    HARD_HAT,
    (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9),
  );
  c.line(9, 3, 9, 6, HARD_HAT, () => sphere(0, 0.5), { bias: 1 });
  c.part();
  c.shape(7, 7, () => [C - 5.6, C + 5.6], HARD_HAT, (_x, _y, t) => cyl(t, 0.4));
  // Brass goggles pushed up on the hat, their lenses catching the light.
  c.part();
  c.line(4, 6, 13, 6, BRASS, () => cyl(0, 0.2));
  c.part();
  pair(6, (x) => c.ellipse(x + 1, 5.5, 1.2, 1.1, BRASS));
  pair(6, (x) => c.px(x + (x < C ? 1 : -1) * 0, 5, LENS, sphere(-0.4, 0.4), { glow: 0.3 }));
}
