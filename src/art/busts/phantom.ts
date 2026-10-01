// The Phantom's bust: the Poltergeist, a round mint ghost with big dark
// eyes, a little smile and blushing cheeks, its sheet thinning into wisps.

import { sphere, type PixelCanvas } from '../pixel';
import { BLUSH, MIST, SHEET, VOID } from '../poltergeist';
import { C, pair } from './kit';

export function phantomBust(c: PixelCanvas): void {
  // Wisps of mist trailing off the hem.
  for (const [x, y] of [[4, 15], [8, 16], [12, 15]] as const) c.ellipse(x + 0.5, y + 0.5, 1.6, 1.2, MIST);
  // The sheet: a dome that widens to a ragged hem.
  c.part();
  c.shape(
    2,
    15,
    (y) => {
      const d = (y + 0.5 - 8.5) / 6.5;
      const hw = y < 9 ? 5.8 * Math.sqrt(Math.max(0, 1 - d * d)) + 0.4 : 6.2 + (y - 9) * 0.25;
      return [C - hw, C + hw];
    },
    SHEET,
    (_x, _y, t, u) => sphere(t * 0.9, u * 1.6 - 0.6, 1),
  );
  for (const x of [5, 9, 12]) c.erase(x, 15);
  // Big dark eyes, a glint in each, blushing cheeks and a little smile.
  c.part();
  pair(6, (x) => {
    c.px(x, 8, VOID);
    c.px(x + (x < C ? 1 : -1), 8, VOID);
    c.px(x, 9, VOID);
    c.px(x + (x < C ? 1 : -1), 9, VOID);
  });
  pair(6, (x) => c.px(x, 8, SHEET, sphere(-0.4, 0.6), { bias: 4, glow: 0.6 }));
  pair(5, (x) => c.px(x, 10, BLUSH));
  c.px(8, 11, VOID);
  c.px(9, 11, VOID);
}
