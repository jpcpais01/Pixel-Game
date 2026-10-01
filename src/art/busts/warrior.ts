// The Warrior's bust: the Knight, a young face framed by a round steel helm
// with cheek guards, a crimson horsehair plume rising off its crown and
// tumbling back, round pauldrons over mail, and the red tabard edged in gold.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { EYE } from '../palette';
import { KNIGHT_LOOK } from '../warrior';
import { C, pair, shoulders } from './kit';

export function warriorBust(c: PixelCanvas): void {
  const L = KNIGHT_LOOK;
  // Mail over the shoulders and up the neck, under everything else.
  shoulders(c, L.mail, 21, 5, 16, 5);
  // The breastplate, and the tabard hanging down its middle in a gold edge.
  c.part();
  c.shape(24, 33, (y) => [C - 6.5 - (y - 24) * 0.2, C + 6.5 + (y - 24) * 0.2], L.plate, (_x, _y, t) => cyl(t * 0.8, 0.3));
  c.part();
  c.shape(26, 33, () => [C - 4, C + 4], L.trim, (_x, _y, t) => cyl(t * 0.6, 0.2));
  c.part();
  c.shape(27, 33, () => [C - 3, C + 3], L.cloth, (_x, _y, t) => cyl(t * 0.6, 0.2));
  // A gold cross-stroke stitched on the tabard, so it reads as a herald's coat.
  c.line(C - 0.5, 29, C - 0.5, 33, L.trim, () => cyl(-0.2));
  c.line(15, 30, 18, 30, L.trim, () => cyl(0, 0.4));
  // Round pauldrons, banded in gold near the rim.
  pair(5, (x, s) => {
    c.part();
    c.ellipse(x + 0.5 + s * 0.5, 26, 5.4, 4.4, L.plate, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 0.8) });
    // A second lame below, then the gold rim.
    c.part();
    c.shape(29, 30, (y) => [x + 0.5 + s * 0.5 - 5.6 + (y - 29), x + 0.5 + s * 0.5 + 5.6 - (y - 29)], L.plate, (_x, _y, t) => cyl(t, 0.1));
    c.part();
    c.shape(31, 31, () => [x + 0.5 + s * 0.5 - 4.4, x + 0.5 + s * 0.5 + 4.4], L.trim, (_x, _y, t) => cyl(t, 0));
  });

  // The face, with ears tucked into the helm.
  c.part();
  // Its normals kept gentle, so the whole face sits in the light under the helm.
  c.ellipse(C, 16, 5.2, 5.8, L.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.45 - 0.15) });
  // Eyes, a straight brow, a nose lit on its left and a set mouth.
  c.part();
  pair(14, (x) => {
    c.px(x, 15, EYE);
    c.px(x, 16, EYE);
  });
  c.shade(13, 13, -1);
  c.shade(14, 13, -1);
  c.shade(19, 13, -1);
  c.shade(20, 13, -1);
  c.px(16, 17, L.skin, sphere(-0.6, 0.2), { bias: 1 });
  c.px(17, 17, L.skin, sphere(0.6, -0.4));
  c.shade(16, 19, -1);
  c.shade(17, 19, -1);

  // The plume: a thick tail of horsehair from the crown, arching back to the right.
  c.part();
  const plume: [number, number, number][] = [
    [17, 5.5, 2.4],
    [17.6, 2.8, 2.4],
    [19.8, 1.6, 2.2],
    [22.6, 2.6, 2],
    [24.6, 5, 1.6],
    [25.6, 8, 1],
  ];
  for (let i = 0; i < plume.length - 1; i++) {
    const [x0, y0, r0] = plume[i];
    const [x1, y1, r1] = plume[i + 1];
    c.capsule(x0, y0, x1, y1, r0, r1, L.plume);
  }
  // Strands down the plume's fall.
  c.line(19, 3, 23, 5, L.plume, () => sphere(0.3, 0.2), { bias: -1 });
  c.line(21, 1, 24, 3, L.plume, () => sphere(-0.3, 0.8), { bias: 1 });

  // The helm: a steel dome down to the brow, a raised ridge over its crown.
  c.part();
  c.shape(
    5,
    13,
    (y) => {
      const dy = (13.4 - y) / 8.4;
      const hw = 7.4 * Math.sqrt(Math.max(0, 1 - dy * dy));
      return [C - hw, C + hw];
    },
    L.plate,
    (_x, y, t) => sphere(t * 0.95, (13.4 - y) / 8.4, 0.9),
  );
  c.line(C - 0.5, 6, C - 0.5, 11, L.plate, () => sphere(-0.2, 0.6), { bias: 1 });
  // A rim round its brow.
  c.part();
  c.shape(13, 13, () => [C - 7.6, C + 7.6], L.plate, (_x, _y, t) => cyl(t, 0.5), { bias: -1 });
  // Cheek guards hanging past the cheeks, narrowing to the jaw.
  const guard = [2.8, 2.6, 2.4, 2.2, 1.9, 1.5, 1];
  c.part();
  c.shape(14, 20, (y) => [C - 7.6, C - 7.6 + guard[y - 14]], L.plate, (_x, _y, t) => cyl(t * 0.4 - 0.5, 0.1));
  c.shape(14, 20, (y) => [C + 7.6 - guard[y - 14], C + 7.6], L.plate, (_x, _y, t) => cyl(t * 0.4 + 0.5, 0.1));
  // Rivets down the guards.
  pair(11, (x) => {
    c.px(x, 16, L.trim, sphere(-0.3, 0.4));
  });
}
