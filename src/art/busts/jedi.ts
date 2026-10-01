// The Jedi's bust: a young knight with swept brown hair parted to one side,
// his hood lowered round his neck, the oat tunic crossed over his chest under
// the brown robe, and his blue saber lit upright beside him.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { EYE, HILT_DARK, SILVER } from '../palette';
import { JEDI_LOOK } from '../jedi';
import { C, pair, shoulders } from './kit';

export function jediBust(c: PixelCanvas): void {
  const L = JEDI_LOOK;
  // The robe, the tunic crossed in a V under it.
  shoulders(c, L.robe, 13, 4, 9, 3);
  c.part();
  c.shape(13, 17, (y) => [C - 1 - (y - 13) * 0.5, C + 1 + (y - 13) * 0.5], L.tunic, (_x, _y, t) => cyl(t, 0.3));
  c.line(8, 14, 10, 17, L.tunic, () => cyl(0.3, 0.2), { bias: -1 });
  // The lowered hood, bunched round the neck.
  c.part();
  c.shape(12, 13, (y) => (y === 12 ? [C - 4.6, C + 4.6] : [C - 5.4, C - 1.4]), L.robe, (_x, _y, t) => cyl(t, 0.6));
  c.part();
  c.shape(13, 13, () => [C + 1.4, C + 5.4], L.robe, (_x, _y, t) => cyl(t, 0.6));
  // The face.
  c.part();
  c.ellipse(C, 9.4, 3.6, 2.9, L.skin);
  c.px(8, 10, L.skin, sphere(-0.4, -0.3), { bias: 1 });
  pair(7, (x) => c.px(x, 9, EYE));
  // Hair: a cap over the crown, swept from a parting on his left, a lock over the brow.
  c.part();
  c.shape(
    5,
    7,
    (y) => {
      const d = (y + 0.5 - 8.2) / 3.4;
      const hw = 4 * Math.sqrt(Math.max(0, 1 - d * d)) + 0.2;
      return [C - hw, C + hw];
    },
    L.hair,
    (_x, _y, t, u) => sphere(t * 0.9, u - 0.8, 1),
  );
  c.line(9, 8, 11, 8, L.hair, () => sphere(0.3, 0.2));
  c.px(5, 8, L.hair, sphere(-0.5, 0));
  c.px(12, 8, L.hair, sphere(0.5, 0));
  c.shade(7, 6, -1);
  // The saber, lit, upright beside him: a silver hilt in a dark grip.
  c.part();
  c.line(14, 3, 14, 13, L.blade.edge, () => sphere(0, 0));
  c.line(14, 4, 14, 12, L.blade.core, () => sphere(0, 0), { bias: 1 });
  for (let y = 4; y <= 12; y += 2) {
    c.spark(13, y, L.bladeGlow, 0.6);
    c.spark(15, y, L.bladeGlow, 0.6);
  }
  c.part();
  c.px(14, 14, SILVER, sphere(0.2, 0.4));
  c.px(14, 15, HILT_DARK, sphere(0.2, 0));
  c.px(14, 16, SILVER, sphere(0.2, -0.3));
}
