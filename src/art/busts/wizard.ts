// The Wizard's bust: the Arcanist as his sprite draws him, a white beard to
// his chest under a tall pointed hat bent at the tip, its gold band and star.

import { cyl, sphere, type PixelCanvas, type Vec3 } from '../pixel';
import { BEARD, EYE, SKIN } from '../palette';
import { ARCANE_LOOK } from '../wizard';
import { C, pair, shoulders } from './kit';

export function wizardBust(c: PixelCanvas): void {
  const L = ARCANE_LOOK;
  // The robe, its gold trim showing either side of the beard.
  shoulders(c, L.robe, 13, 4, 9, 3);
  c.part();
  pair(6, (x, s) => c.line(x, 15, x + s, 17, L.trim, () => cyl(s * 0.5)));
  // Hair falling past the ears.
  c.part();
  pair(5, (x) => c.shape(8, 12, () => [x, x + 1.6], BEARD, (_x, _y, t) => cyl(t, 0.2)));
  // The face.
  c.part();
  c.ellipse(C, 9.4, 3.7, 2.8, SKIN);
  // The beard, from the cheeks to a point on the chest.
  c.part();
  const bw = [4.1, 3.9, 3.5, 2.9, 2.2, 1.4, 0.7];
  c.shape(10, 16, (y) => [C - bw[y - 10], C + bw[y - 10]], BEARD, (_x, _y, t, u) => sphere(t * 0.85, (u - 0.25) * 1.1, 0.9));
  // Strands.
  c.shade(7, 12, -1);
  c.shade(10, 13, -1);
  c.shade(8, 14, -1);
  // The nose, and the eyes.
  c.part();
  c.px(8, 10, SKIN, sphere(-0.4, -0.3), { bias: 1 });
  c.px(9, 10, SKIN, sphere(0.35, -0.2));
  pair(7, (x) => c.px(x, 9, EYE));
  // The hat: a cone bent over to the right at the tip.
  c.part();
  c.shape(
    0,
    6,
    (y) => {
      const u = (y + 0.5) / 7;
      const hw = 0.55 + 2.9 * Math.pow(u, 1.1);
      const x = C + 2.6 * Math.pow(1 - u, 2);
      return [x - hw, x + hw];
    },
    L.robe,
    (_x, _y, t, u) => cyl(t, 0.45 - u * 0.2),
  );
  // Its gold band, and a star on the front.
  c.part();
  c.shape(6, 6, () => [C - 3.4, C + 3.4], L.trim, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  const n: Vec3 = { x: -0.3, y: 0.4, z: 0.86 };
  c.px(8, 3, L.trim, n, { bias: 1 });
  c.px(7, 3, L.trim, n);
  c.px(9, 3, L.trim, n);
  c.px(8, 2, L.trim, n);
  c.px(8, 4, L.trim, n);
  // The brim over the brow, a domed disc facing up with its lip to us.
  c.part();
  c.ellipse(C, 7.4, 7.2, 1.3, L.robe, {
    normal: (_x, _y, dx, dy) => {
      const l = Math.hypot(dx * 0.55, 0.55 - dy * 0.35, 0.75);
      return { x: (dx * 0.55) / l, y: (0.55 - dy * 0.35) / l, z: 0.75 / l };
    },
  });
}
