// The Warrior's bust: the Knight, a young face in a round steel helm with
// cheek guards and a crimson plume tumbling back off its crown, round
// pauldrons over mail and the red tabard edged in gold.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { EYE } from '../palette';
import { KNIGHT_LOOK } from '../warrior';
import { C, pair, shoulders } from './kit';

export function warriorBust(c: PixelCanvas): void {
  const L = KNIGHT_LOOK;
  // The plume first, so the helm sits in front of its root.
  c.capsule(9.5, 2, 12.6, 2.6, 1.2, 1, L.plume);
  c.capsule(12.6, 2.6, 13.8, 6.4, 1, 0.6, L.plume);
  // Mail, the tabard down the middle and its gold edges.
  c.part();
  shoulders(c, L.mail, 13, 4, 9, 3);
  c.part();
  c.shape(14, 17, (y) => [C - 2.2 - (y - 14) * 0.2, C + 2.2 + (y - 14) * 0.2], L.cloth, (_x, _y, t) => cyl(t, 0.2));
  pair(6, (x, s) => c.line(x + s * 0.0, 14, x - s, 17, L.trim, () => cyl(s * 0.4, 0.2)));
  // Round pauldrons.
  c.part();
  pair(3, (x) => c.ellipse(x + 0.5, 14.6, 2.8, 2.2, L.plate, { normal: (_x, _y, dx, dy) => sphere(dx, dy - 0.4) }));
  // The face.
  c.part();
  c.ellipse(C, 9.6, 3.4, 2.7, L.skin);
  pair(7, (x) => c.px(x, 9, EYE));
  // The helm: a steel dome down to the brow, cheek guards down the sides.
  c.part();
  c.shape(
    2,
    8,
    (y) => {
      const d = (y + 0.5 - 7.6) / 5.6;
      const hw = 4.6 * Math.sqrt(Math.max(0, 1 - d * d));
      return [C - hw, C + hw];
    },
    L.plate,
    (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1),
  );
  pair(4, (x, s) => c.shape(8, 11, (y) => (s < 0 ? [x + 0.4, x + 2 - (y - 8) * 0.25] : [x - 1 + (y - 8) * 0.25, x + 0.6]), L.plate, (_x, _y, t) => cyl(t * 0.6 + s * 0.4, 0)));
  // A gold rim along its brow.
  c.part();
  c.shape(7, 7, () => [C - 4.3, C + 4.3], L.trim, (_x, _y, t) => cyl(t, 0.2));
}
