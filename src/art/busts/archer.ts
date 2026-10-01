// The Archer's bust: the Ranger, a freckled face under a forest-green hood
// with ginger hair spilling from it, a leather quiver strap across the chest
// and red-fletched arrows standing up over his shoulder.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { SKIN } from '../palette';
import { RANGER_LOOK } from '../archer';
import { C, pair, shoulders } from './kit';

export function archerBust(c: PixelCanvas): void {
  const L = RANGER_LOOK;
  // The quiver slung on his back, its mouth showing over his right shoulder
  // (screen left), the arrows' red fletching fanned out of it.
  c.part();
  c.capsule(6.4, 16, 9.4, 26, 2.4, 2.6, L.jerkin, { bias: -1 });
  for (const [x, y] of [
    [3.6, 10.4],
    [6, 8.2],
    [8.8, 7.4],
  ] as [number, number][]) {
    c.part();
    c.line(x + 1, y + 3, 6.5 + (x - 6) * 0.3, 15, L.shaft, () => cyl(-0.3, 0.2));
    // The fletching: two red vanes either side of the shaft's end, a dark notch between.
    c.part();
    c.shape(y, y + 3, (yy) => [x - 0.6 + (yy - y) * 0.25, x + 1.8 - (yy - y) * 0.1], L.fletch, (_x, _y, t, u) => sphere(t, 0.5 - u * 0.7, 0.9), { bias: 1 });
    c.shade(x + 0.5, y + 1, -1);
    c.shade(x + 0.5, y + 2, -1);
  }
  // The quiver's leather rim.
  c.part();
  c.ellipse(6.6, 15.2, 3, 1.4, L.jerkin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, -dy * 0.3 + 0.5, 0.8) });
  c.px(6, 15, L.metal, sphere(-0.3, 0.5));

  // The cloak over the shoulders.
  shoulders(c, L.cloak, 22, 7, 17, 5);
  // The moss tunic at the neck and the leather jerkin over the chest.
  c.part();
  c.shape(23, 33, (y) => [C - 4.4 - (y - 23) * 0.3, C + 4.4 + (y - 23) * 0.3], L.jerkin, (_x, _y, t) => cyl(t * 0.8, 0.25));
  c.part();
  c.shape(23, 27, (y) => [C - 2.4 + (y - 23) * 0.5, C + 2.4 - (y - 23) * 0.5], L.tunic, (_x, _y, t) => cyl(t * 0.6, 0.3));
  // Laces across the jerkin's opening.
  c.px(16, 28, L.tunic, sphere(0, 0.4), { bias: 1 });
  c.px(17, 30, L.tunic, sphere(0, 0.4), { bias: 1 });
  // The quiver strap, from over his right shoulder down across to the left hip, with a brass buckle.
  c.part();
  c.line(7, 22, 21, 33, L.jerkin, (i, n) => cyl(-0.3 + (i / n) * 0.4, 0.4), { bias: 1 });
  c.line(8, 22, 22, 33, L.jerkin, (i, n) => cyl(-0.3 + (i / n) * 0.4, 0.2), { bias: -1 });
  c.part();
  c.px(14, 27, L.metal, sphere(-0.4, 0.5));
  c.px(15, 27, L.metal, sphere(0.2, 0.4));
  c.px(14, 28, L.metal, sphere(-0.2, -0.2));
  c.px(15, 28, L.metal, sphere(0.3, -0.3));

  // The hood: rounded over the head with a little point at its crown, its
  // sides falling onto the shoulders.
  c.part();
  c.shape(
    4,
    24,
    (y) => {
      const u = (y - 4) / 20;
      const hw = u < 0.45 ? 8.4 * Math.sqrt(Math.min(1, (u + 0.02) / 0.45)) : 8.4 + (u - 0.45) * 2.6;
      return [C - hw, C + hw];
    },
    L.cloak,
    (_x, _y, t, u) => sphere(t * 0.95, 0.75 - u * 1.4, 0.9),
  );
  c.capsule(C + 0.4, 5.4, C + 1.8, 2.4, 2.2, 0.7, L.cloak);
  // A fold down the hood's crown.
  c.line(C + 1, 4, C - 0.5, 8, L.cloak, () => sphere(0.3, 0.3), { bias: -1 });
  // The hood's opening: deep shade round the face.
  c.part();
  c.ellipse(C, 16, 6.4, 7.6, L.cloak, { normal: () => sphere(0, 0), bias: -2 });

  // The face, its normals kept gentle so it reads in the hood's shade.
  c.part();
  c.ellipse(C, 16.4, 5, 5.6, SKIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.45 - 0.15) });
  // Eyes, a nose lit on its left, a small grin, and freckles over the cheeks.
  c.part();
  pair(14, (x) => {
    c.px(x, 16, L.eye);
    c.px(x, 17, L.eye);
  });
  c.px(16, 18, SKIN, sphere(-0.6, 0.2), { bias: 1 });
  c.px(17, 18, SKIN, sphere(0.6, -0.4));
  c.shade(16, 20, -1);
  c.shade(17, 20, -1);
  c.shade(18, 19, -1);
  pair(13, (x) => {
    c.shade(x, 18, -1);
    c.shade(x + 1, 19, -1);
  });

  // Ginger hair spilling out of the hood: a swept fringe and locks by the cheeks.
  c.part();
  c.shape(9, 13, (y) => {
    const u = (y - 9) / 4;
    const hw = 5.6 - u * 0.4;
    return [C - hw, C + hw - u * 2.5];
  }, L.hair, (_x, _y, t, u) => sphere(t * 0.9, 0.6 - u * 0.8, 0.9));
  // The fringe's tips flicking across the brow.
  c.px(18, 14, L.hair, sphere(0.2, -0.2));
  c.px(20, 14, L.hair, sphere(0.4, -0.2));
  c.px(13, 14, L.hair, sphere(-0.4, -0.2));
  c.line(13, 10, 16, 12, L.hair, () => sphere(-0.4, 0.8), { bias: 1 });
  pair(11, (x, s) => c.shape(13, 20, (y) => [x - 0.2 + (s < 0 ? 0 : 0.4), x + 1.4 + (s < 0 ? -0.4 : 0) + (y > 18 ? -0.4 : 0)], L.hair, (_x, _y, t) => cyl(t * 0.5 + s * 0.5, 0.1)));
}
