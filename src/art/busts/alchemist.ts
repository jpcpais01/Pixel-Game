// The Alchemist's bust: the plague doctor, a bone-white beaked mask under a
// wide black brim, its round goggles glowing poison green, a dark hood round
// it, a short mantle over the plum coat and a strap of glowing vials.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { LEATHER } from '../palette';
import { PLAGUE_LOOK } from '../alchemist';
import { C, pair, shoulders } from './kit';

export function alchemistBust(c: PixelCanvas): void {
  const L = PLAGUE_LOOK;
  // The coat, the mantle over its shoulders, the strap and two vials.
  shoulders(c, L.coat, 13, 4, 9, 3);
  c.part();
  c.shape(12, 14, (y) => [C - 5.2 - (y - 12), C + 5.2 + (y - 12)], L.mantle, (_x, _y, t, u) => cyl(t, 0.5 - u * 0.4));
  c.part();
  c.line(4, 14, 12, 17, LEATHER, () => cyl(0, 0.3));
  c.part();
  c.px(6, 14, L.brew, sphere(0, 0.3), { glow: 0.7 });
  c.px(9, 15, L.brew, sphere(0, 0.3), { glow: 0.7 });
  // The hood round the mask.
  c.part();
  c.ellipse(C, 9.4, 4.6, 3.8, L.mantle);
  // The mask, and its beak curving down onto the chest.
  c.part();
  c.ellipse(C, 9, 3.3, 2.6, L.face, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.7) });
  c.part();
  const bw = [1.8, 1.7, 1.4, 1.1, 0.7];
  c.shape(10, 14, (y) => [C - bw[y - 10] + (y - 10) * 0.15, C + bw[y - 10] + (y - 10) * 0.15], L.face, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.2));
  // The goggles, glowing green, a glint in each.
  c.part();
  pair(6, (x) => c.ellipse(x + 1, 9, 1.2, 1.1, L.eye, { glow: 0.5, normal: (_x, _y, dx, dy) => sphere(dx * 0.5 - 0.2, dy * 0.5 + 0.2) }));
  pair(6, (x) => c.spark(x + (x < C ? 0 : 1), 8, L.hot, 0.5));
  // The hat: a low crown with its band, on a wide brim.
  c.part();
  c.shape(2, 5, (y) => [C - 3 - (y - 2) * 0.1, C + 3 + (y - 2) * 0.1], L.hat, (_x, _y, t, u) => cyl(t, 0.5 - u * 0.3));
  c.part();
  c.shape(5, 5, () => [C - 3.3, C + 3.3], L.band, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.ellipse(C, 6.5, 7.6, 1.3, L.hat, {
    normal: (_x, _y, dx, dy) => {
      const l = Math.hypot(dx * 0.55, 0.55 - dy * 0.35, 0.75);
      return { x: (dx * 0.55) / l, y: (0.55 - dy * 0.35) / l, z: 0.75 / l };
    },
  });
}
