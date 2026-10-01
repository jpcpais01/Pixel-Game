// The Phantom's bust: the Poltergeist, a round mint ghost with big dark
// eyes, a little smile and blushing cheeks, its sheet thinning into wisps
// of mist at the bottom.

import { sphere, type PixelCanvas } from '../pixel';
import { BLUSH, MIST, SHEET, VOID } from '../poltergeist';
import { C, pair } from './kit';

export function phantomBust(c: PixelCanvas): void {
  // Wisps of mist curling down from the hem's three points, thinning as
  // they go, so the ghost fades out rather than stands on legs.
  for (const [x0, dir, len] of [[9, -1, 6], [17, 1, 7], [25, 1, 6]] as const)
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      c.ellipse(x0 + Math.sin(t * Math.PI * 1.3) * 1.6 * dir, 25 + t * len, 1.9 - t * 1.4, 1.2, MIST);
    }
  // The sheet: a round head over a body that flares a little, the hem in
  // three soft scallops.
  c.part();
  c.ellipse(C, 14.5, 10, 10.5, SHEET, { flatten: 0.9 });
  c.shape(
    14,
    27,
    (y) => {
      const u = (y - 14) / 13;
      const hw = 10 + u * 1.6;
      return [C - hw, C + hw];
    },
    SHEET,
    (_x, _y, t, u) => sphere(t * 0.9, -u * 0.6, 0.9),
  );
  // Cut the hem into scallops, so it reads as a sheet that drifts.
  for (let x = 5; x < 29; x++) {
    const k = ((x - 5) / 24) * 3;
    const dip = Math.round(2.6 * Math.abs(Math.sin(k * Math.PI)));
    for (let y = 27; y > 27 - (2.6 - dip); y--) c.erase(x, y);
  }
  // Little arms raised at the sides.
  c.part();
  pair(6.5, (x) => c.ellipse(x + 0.5, 21, 2, 1.6, SHEET));
  // Big dark eyes, each with a glint.
  c.part();
  pair(13, (x) => c.ellipse(x + 0.5, 14.5, 1.5, 2.3, VOID));
  pair(13, (x) => c.px(x, 13, SHEET, sphere(-0.4, 0.6), { bias: 4, glow: 0.6 }));
  // Blush under the eyes.
  pair(10, (x, s) => {
    c.px(x, 18, BLUSH);
    c.px(x - s, 18, BLUSH);
  });
  // A small smile.
  c.px(15, 18, VOID);
  c.px(16, 19, VOID);
  c.px(17, 19, VOID);
  c.px(18, 18, VOID);
}
