// The Wizard's bust: the Arcanist, an old mage with a white beard to his
// chest and a tall pointed hat, its tip bent over, starred in gold.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { BEARD, EYE, SKIN } from '../palette';
import { ARCANE_LOOK } from '../wizard';
import { C, pair, shoulders } from './kit';

export function wizardBust(c: PixelCanvas): void {
  const L = ARCANE_LOOK;
  // The robe, a gold trim down its opening below the beard.
  shoulders(c, L.robe, 24, 8, 17, 6);
  c.part();
  c.line(15, 28, 15, 33, L.trim, () => cyl(-0.4));
  c.line(19, 28, 19, 33, L.trim, () => cyl(0.4));
  // Hair falling past the ears.
  c.part();
  pair(11, (x) => c.ellipse(x + 0.5, 17, 2.4, 4.2, BEARD));
  // The face.
  c.part();
  c.ellipse(C, 15.5, 5.6, 6.2, SKIN, { flatten: 0.9 });
  // The beard, from the cheeks to a point on the chest.
  c.part();
  c.shape(
    17,
    31,
    (y) => {
      const u = (y - 17) / 14;
      const hw = u < 0.25 ? 5.6 + u * 4 : 6.6 * (1 - Math.pow((u - 0.25) / 0.75, 1.6)) + 0.6;
      return [C - hw, C + hw];
    },
    BEARD,
    (_x, _y, t, u) => cyl(t * 0.9, 0.2 + u * 0.3),
  );
  // Strands down the beard.
  c.line(14, 22, 15, 28, BEARD, () => cyl(-0.5), { bias: -1 });
  c.line(19, 22, 18, 28, BEARD, () => cyl(0.5), { bias: -1 });
  c.line(17, 23, 17, 30, BEARD, () => cyl(0.1), { bias: -1 });
  // Moustache, a shade darker where it parts over the mouth.
  c.part();
  c.shape(18, 19, (y) => (y === 18 ? [C - 3.5, C + 3.5] : [C - 4.5, C + 4.5]), BEARD, (_x, _y, t) => sphere(t, -0.3, 0.8));
  c.shade(16, 19, -1);
  c.shade(17, 19, -1);
  // The nose, lit on its left.
  c.px(16, 16, SKIN, sphere(-0.6, 0.2));
  c.px(17, 16, SKIN, sphere(0.6, -0.2));
  c.px(17, 17, SKIN, sphere(0.7, -0.6));
  // Eyes under bushy white brows.
  pair(14, (x) => c.px(x, 15, EYE));
  c.line(13, 13, 15, 13, BEARD, () => sphere(-0.2, 0.6));
  c.line(18, 13, 20, 13, BEARD, () => sphere(0.2, 0.6));
  // The hat: a cone leaning back, its tip bent over to the right.
  c.part();
  c.shape(
    0,
    10,
    (y) => {
      const u = y / 10;
      const hw = 0.9 + 6.4 * Math.pow(u, 1.25);
      const lean = (1 - u) * -1.6;
      return [C + lean - hw, C + lean + hw];
    },
    L.robe,
    (_x, _y, t, u) => cyl(t, 0.1 + (1 - u) * 0.3),
  );
  c.capsule(15.8, 1, 20.5, 2.6, 1.2, 0.6, L.robe);
  // Its gold band, and a star on the front.
  c.part();
  c.shape(7, 8, (y) => [C - 5.6 - (y - 7) * 0.7, C + 5.4 + (y - 7) * 0.7], L.trim, (_x, _y, t) => cyl(t, 0.2));
  c.px(16, 3, L.trim, sphere(-0.3, 0.4), { glow: 0.3 });
  c.px(15, 4, L.trim, sphere(-0.5, 0), { glow: 0.3 });
  c.px(16, 4, L.trim, sphere(0, 0.2), { glow: 0.5 });
  c.px(17, 4, L.trim, sphere(0.5, 0), { glow: 0.3 });
  c.px(16, 5, L.trim, sphere(0, -0.4), { glow: 0.3 });
  // The brim, wide and a little tilted, over the brow.
  c.part();
  c.ellipse(C, 10.8, 12.5, 1.9, L.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, -dy * 0.4 + 0.5, 0.8) });
}
