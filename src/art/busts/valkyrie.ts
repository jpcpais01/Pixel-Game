// The Valkyrie's bust: the Spearmaiden, golden braids falling over blue and
// gold armour, under a silver helm with a swan's wing swept up either side.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { EYE, GOLD, SKIN, STEEL } from '../palette';
import { BLONDE, ROSE_LIP, SKY_CLOTH, SWAN } from '../valkyrie';
import { C, pair, shoulders } from './kit';

export function valkyrieBust(c: PixelCanvas): void {
  // The wings on the helm, behind it: three long feathers each, rooted up
  // the helm's side and swept up and out, the upper ones behind the lower so
  // every tier casts a little shadow on the next.
  for (const s of [-1, 1] as const) {
    const mx = (x: number) => (s < 0 ? x : 34 - x);
    for (const [rx, ry, tx, ty, r] of [
      [12.5, 8.5, 8, 3.2, 1.7],
      [11.5, 10.5, 5.5, 5.6, 1.9],
      [11.5, 12.5, 4.5, 9.4, 1.8],
    ] as const) {
      c.part();
      c.capsule(mx(rx), ry, mx(tx), ty, r, 0.8, SWAN);
    }
  }
  // The blue tunic, under steel pauldrons edged in gold.
  c.part();
  shoulders(c, SKY_CLOTH, 23, 7, 17, 5);
  c.part();
  pair(6, (x) => c.ellipse(x + 0.5, 27.4, 6, 5, GOLD));
  c.part();
  pair(6, (x) => c.ellipse(x + 0.5, 28.2, 5.4, 4.4, STEEL, { normal: (_x, _y, dx, dy) => sphere(dx, dy - 0.3, 1) }));
  // A gold collar at the throat.
  c.part();
  c.shape(23, 23, () => [C - 4, C + 4], GOLD, (_x, _y, t) => cyl(t, 0.4));
  // Hair behind the face, down to the jaw.
  c.part();
  pair(11.5, (x) => c.ellipse(x + 0.5, 16.5, 2.2, 5, BLONDE));
  // The face, lit softly so its shaded side stays warm.
  c.part();
  c.ellipse(C, 17, 5.6, 5.8, SKIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.55, dy * 0.6, 1) });
  // The braids, banded in gold, falling over the chest.
  c.part();
  pair(11, (x) => {
    for (let i = 0; i < 4; i++) c.ellipse(x + 0.5, 21 + i * 2.5, 1.6, 1.5, BLONDE, { normal: (_x, _y, dx, dy) => sphere(dx, dy - 0.2, 1) });
    c.line(x - 1, 28.5, x + 1, 28.5, GOLD, () => sphere(0, 0.5));
    c.ellipse(x + 0.5, 31.5, 1, 1.6, BLONDE);
  });
  // Wide eyes under golden brows, a straight nose, rosy lips.
  c.part();
  pair(14, (x) => {
    c.px(x, 16, EYE);
    c.px(x, 17, EYE);
  });
  pair(13, (x, s) => c.line(x, 14, x - s, 14, BLONDE, () => sphere(0, 0.5), { bias: -1 }));
  c.px(16, 18, SKIN, sphere(-0.6, 0.2));
  c.px(17, 19, SKIN, sphere(0.6, -0.6));
  c.px(16, 20, ROSE_LIP);
  c.px(17, 20, ROSE_LIP);
  // The helm: a silver dome down to the brow.
  c.part();
  c.shape(
    4,
    12,
    (y) => {
      const u = (y - 4) / 8;
      const hw = 7 * Math.sqrt(Math.min(1, 0.18 + u * 1.3));
      return [C - hw, C + hw];
    },
    STEEL,
    (_x, _y, t, u) => cyl(t, 0.6 - u * 0.5),
  );
  // A gold ridge over the crown, and a gold brow band with a stone.
  c.part();
  c.line(C - 0.5, 4, C - 0.5, 11, GOLD, () => cyl(0, 0.5));
  c.shape(12, 12, () => [C - 7.4, C + 7.4], GOLD, (_x, _y, t) => cyl(t, 0.3));
  c.px(C - 0.5, 12, GOLD, sphere(0, 0.5), { bias: 1, glow: 0.3 });
}
