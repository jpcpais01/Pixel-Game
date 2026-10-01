// The Beastkin's bust: the Eagle, a white-feathered head with a hooked
// yellow beak and fierce golden eyes under a heavy brow, a ruff of white
// over brown-feathered shoulders, and its wings rising behind.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { EYE } from '../palette';
import { EAGLE_LOOK } from '../beast';
import { C, pair } from './kit';

export function beastBust(c: PixelCanvas): void {
  const L = EAGLE_LOOK;
  // The wings, rising behind the shoulders.
  pair(2, (x, s) => c.capsule(x + 0.5, 15, x + 0.5 - s * 0.5, 9, 1.8, 1, L.wing));
  // Brown-feathered shoulders, the ruff of white over them.
  c.part();
  c.shape(13, 17, (y) => [C - 5 - (y - 13), C + 5 + (y - 13)], L.hide, (_x, _y, t) => cyl(t, 0.25));
  for (const [x, y] of [[4, 16], [13, 16], [6, 17], [11, 17]] as const) c.shade(x, y, -1);
  c.part();
  c.shape(12, 15, (y) => [C - 4.4 + (y - 12) * 0.9, C + 4.4 - (y - 12) * 0.9], L.head, (_x, _y, t, u) => sphere(t, u - 0.3));
  // The head, white and round.
  c.part();
  c.ellipse(C, 8.6, 4.2, 4, L.head, { flatten: 0.9 });
  // Fierce golden eyes under a heavy brow.
  c.part();
  pair(6, (x, s) => {
    c.px(x, 8, L.eye, sphere(0, 0.3));
    c.px(x - s, 8, EYE);
  });
  pair(5, (x, s) => c.line(x, 7, x - s * 2, 7, L.head, () => sphere(0, 0.9), { bias: -1 }));
  // The beak: yellow, hooked down at the tip.
  c.part();
  c.shape(8, 11, (y) => (y < 10 ? [C - 1.2, C + 1.2] : y === 10 ? [C - 0.9, C + 0.9] : [C - 0.4, C + 0.6]), L.beak, (_x, _y, t, u) => sphere(t * 0.8, u - 0.4));
  c.px(8, 9, L.beak, sphere(-0.4, 0.5), { bias: 1 });
}
