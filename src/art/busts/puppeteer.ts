// The Puppeteer's bust: the marionettist, a showman under a tall black top
// hat with a red feather in its gold band, a white half-mask over his eyes
// and a knowing smile, a plum tailcoat piped in gold over an ivory cravat,
// and one white-gloved hand raised to his control cross, its strings
// glowing as they run down out of the picture.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { EYE, SKIN } from '../palette';
import { CARNIVAL_LOOK, CRAVAT, CROSS, GLOVE } from '../puppeteer';
import { C, pair, shoulders } from './kit';

export function puppeteerBust(c: PixelCanvas): void {
  const L = CARNIVAL_LOOK;
  const [core, hot, mid] = L.light;
  // The tailcoat, the waistcoat in its opening, gold piping down the lapels.
  shoulders(c, L.coat, 24, 7, 16, 5);
  c.part();
  c.shape(25, 33, (y) => [C - 2.5 - (y - 25) * 0.35, C + 2.5 + (y - 25) * 0.35], L.under, (_x, _y, t) => cyl(t, 0.2));
  for (let y = 27; y <= 33; y += 2) c.px(16, y, L.stripe, sphere(0, 0.2));
  c.part();
  pair(13, (x, side) => {
    for (let y = 25; y <= 33; y++) c.px(x - side * (y - 25) * 0.35, y, L.trim, cyl(side * 0.4));
  });
  // The ivory cravat, tied in a full knot at the throat.
  c.part();
  c.ellipse(C, 24.6, 2.6, 1.8, CRAVAT);
  c.ellipse(C, 26.8, 1.6, 1.8, CRAVAT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.7 + 0.1, 1) });
  // The raised arm: a plum sleeve up past his shoulder to a gold cuff.
  c.part();
  c.capsule(28.2, 34, 27.8, 21.5, 2.7, 2.1, L.coat);
  c.part();
  c.capsule(27.8, 20.4, 27.8, 21.2, 2.2, 2.2, L.trim, { bias: -1 });
  // Dark hair, short at the sides.
  c.part();
  c.ellipse(C, 15.5, 6.3, 6.6, L.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8, 1) });
  // The face.
  c.part();
  c.ellipse(C, 16.6, 5.2, 5.6, SKIN, { flatten: 0.9 });
  // The white half-mask over the eyes, swept up to points at the temples, gold at its tips.
  c.part();
  c.shape(13, 16, (y) => (y === 13 ? [C - 6.4, C + 6.4] : y === 14 ? [C - 5.8, C + 5.8] : y === 15 ? [C - 5.4, C + 5.4] : [C - 4.4, C + 4.4]), L.mask, (_x, y, t) => sphere(t * 0.9, (y - 14.5) * 0.3, 1));
  c.shape(17, 17, () => [C - 3.4, C - 1], L.mask, (_x, _y, t) => sphere(t * 0.5, 0.6, 1), { bias: -1 });
  c.shape(17, 17, () => [C + 1, C + 3.4], L.mask, (_x, _y, t) => sphere(t * 0.5, 0.6, 1), { bias: -1 });
  pair(10, (x, side) => {
    c.px(x + (side < 0 ? 0.5 : -0.5), 12, L.mask, sphere(side * 0.6, -0.6));
    c.px(x, 13, L.trim, sphere(side * 0.4, -0.4));
  });
  // Eyes through the mask's holes, almond-cut.
  pair(14, (x, side) => {
    c.px(x, 15, EYE);
    c.px(x + (side < 0 ? -1 : 1), 15, EYE);
    c.px(x, 16, EYE);
  });
  // A thin, knowing smile, curling up at one side.
  c.part();
  for (const [x, y] of [[15, 20], [16, 20], [17, 20], [18, 20], [19, 19]] as const) c.shade(x, y, -2);
  c.shade(16, 18, -1);
  // The top hat: a wide brim, a tall crown, a gold band and the red feather.
  c.part();
  c.ellipse(C, 10.6, 8.4, 1.8, L.hat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.4 - 0.7, 1) });
  for (let x = 13; x <= 21; x++) c.shade(x, 12, -1);
  c.part();
  c.shape(1, 10, (y) => {
    const hw = y === 1 ? 4.6 : 4.3 + (y < 4 ? 0 : 0);
    return [C - hw, C + hw];
  }, L.hat, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.shape(8, 9, () => [C - 4.3, C + 4.3], L.trim, (_x, y, t) => cyl(t, y === 8 ? 0.3 : -0.1));
  c.part();
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    const x = 20.6 + k * 4.4;
    const y = 8 - k * 6.6 + k * k * 1.8;
    c.px(x, y, L.plume, sphere(0.3, -0.5 + k), { bias: k > 0.8 ? -1 : 0 });
    if (k < 0.8) c.px(x + 1, y, L.plume, sphere(0.6, 0.3), { bias: -1 });
  }
  // The control cross in the white glove: a wooden upright and crossbar, and
  // its strings hanging glowing from both ends of the bar and from its foot.
  c.part();
  c.line(27, 9, 27, 19, CROSS, () => cyl(-0.3));
  c.line(28, 9, 28, 19, CROSS, () => cyl(0.5), { bias: -1 });
  c.line(23, 12, 32, 12, CROSS, () => sphere(0, 0.5));
  c.line(24, 13, 31, 13, CROSS, () => sphere(0, -0.5), { bias: -1 });
  c.part();
  c.ellipse(27.6, 17.6, 2.0, 1.8, GLOVE);
  c.px(26, 16, GLOVE, sphere(-0.6, -0.6));
  for (const x of [23, 32]) {
    for (let y = 14; y <= 33; y++) {
      if (c.filled(x, y)) continue;
      c.spark(x, y, y % 3 === 0 ? core : y % 3 === 1 ? hot : mid, 0.75);
    }
  }
}
