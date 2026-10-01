// The Beastkin's bust: the Eagle, a white-feathered head with a hooked
// yellow beak and fierce golden eyes under a heavy brow, a ruff of white
// spilling over brown-feathered shoulders, and its wings rising behind.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { EYE } from '../palette';
import { EAGLE_LOOK } from '../beast';
import { C, pair, shoulders } from './kit';

export function beastBust(c: PixelCanvas): void {
  const L = EAGLE_LOOK;
  // The wings' elbows, hunched behind the shoulders, long feathers hanging.
  pair(4, (x, s) => {
    c.ellipse(x + 0.5, 22.5, 5, 4, L.wing);
    for (let i = 0; i < 3; i++) c.capsule(x + 0.5 - s * (1 + i * 1.5), 23, x + 0.5 - s * (2 + i * 1.6), 30, 1.3, 0.8, L.wing);
  });
  // Brown-feathered shoulders, with rows of feather tips.
  c.part();
  shoulders(c, L.hide, 24, 8, 17, 5);
  // Rows of feather tips over them, each row overlapping the one below.
  for (const [y, x0] of [[33, 1], [30, 3], [27, 1]] as const) {
    c.part();
    for (let x = x0; x < 34; x += 4) c.ellipse(x + 0.5, y, 2.3, 1.8, L.hide, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.2, 1) });
  }
  // A gold-trimmed blue sash across the chest.
  c.part();
  c.line(9, 33, 22, 26, L.cloth, () => cyl(0, 0.3));
  c.line(9, 32, 22, 25, L.cloth, () => cyl(0, 0.3));
  c.line(10, 33, 23, 26, L.trim, () => cyl(0, 0.3));
  // The white ruff, its edge jagged like feathers.
  c.part();
  c.shape(
    18,
    27,
    (y) => {
      const hw = 7.6 - Math.max(0, y - 23) * 1.3;
      return [C - hw, C + hw];
    },
    L.head,
    (_x, _y, t, u) => cyl(t, 0.2 - u * 0.4),
  );
  for (let x = 10; x <= 24; x += 2) c.erase(x, 27);
  for (let x = 12; x <= 22; x += 4) c.px(x, 28, L.head, sphere(0, -0.5));
  // The head, its cheek feathers ruffled into points.
  c.part();
  pair(11, (x, s) => {
    c.capsule(x + 0.5, 14, x + 0.5 - s * 2.5, 17.5, 1.6, 0.5, L.head);
    c.capsule(x + 0.5, 17, x + 0.5 - s * 1.5, 20.5, 1.4, 0.5, L.head);
  });
  c.ellipse(C, 13.5, 7, 7.2, L.head, { flatten: 0.9 });
  // Fierce eyes: gold, with dark pupils, under a scowling dark lid that
  // slopes down to the beak.
  c.part();
  pair(12, (x, s) => {
    c.px(x, 13, L.eye, sphere(0, 0.3));
    c.px(x - s, 13, L.eye, sphere(0, 0.3));
    c.px(x, 14, L.eye, sphere(0, -0.2));
    c.px(x - s, 14, EYE);
    c.px(x + s, 12, EYE);
    c.px(x, 12, EYE);
    c.px(x - s, 12, EYE);
    c.px(x - 2 * s, 13, EYE);
  });
  // The brow ridge over them, in shadow.
  pair(11, (x, s) => c.line(x, 11, x - s * 3, 11, L.head, () => sphere(0, 0.9)));
  // The beak: broad at its base, hooking down to a point.
  c.part();
  c.shape(
    13,
    21,
    (y) => {
      const u = (y - 13) / 8;
      const hw = u < 0.3 ? 1.6 + u * 4 : 2.8 * (1 - Math.pow((u - 0.3) / 0.7, 1.5)) + 0.5;
      return [C - hw, C + hw];
    },
    L.beak,
    (_x, _y, t, u) => sphere(t * 0.9, 0.4 - u * 1.1, 0.9),
  );
  // The gape, a dark line either side of the hook.
  pair(14, (x) => c.shade(x, 17, -2));
  pair(15, (x) => c.shade(x, 18, -2));
  c.px(16, 15, L.beak, sphere(-0.4, 0.5), { bias: 1 });
}
