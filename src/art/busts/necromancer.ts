// The Necromancer's bust: the bonecaller, a gaunt grey face sunk in a deep
// grave-violet hood, two soul-green eyes burning in their sockets, and a
// collar of old bone over the shoulders with a little skull at its clasp.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { BONE } from '../palette';
import { NECRO_LOOK } from '../necromancer';
import { C, pair, shoulders } from './kit';

export function necromancerBust(c: PixelCanvas): void {
  const L = NECRO_LOOK;
  shoulders(c, L.robe, 13, 4, 9, 3);
  // The hood: tall and peaked, deep round the face.
  c.part();
  c.shape(
    1,
    13,
    (y) => {
      const u = (y - 1) / 12;
      const hw = u < 0.55 ? 0.8 + 4.4 * Math.sin((u / 0.55) * Math.PI * 0.5) : 5.2 + (u - 0.55) * 1.4;
      return [C - hw, C + hw];
    },
    L.robe,
    (_x, _y, t, u) => cyl(t, 0.5 - u * 0.6),
  );
  c.part();
  c.ellipse(C, 9.8, 3.4, 3.4, L.inner, { normal: (_x, _y, dx, dy) => sphere(-dx * 0.6, -dy * 0.6) });
  // The face, gaunt, its cheeks hollow.
  c.part();
  c.ellipse(C, 10.2, 3, 2.6, L.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.7) });
  pair(6, (x) => c.shade(x, 11, -1));
  pair(7, (x) => c.px(x, 9, L.eye, sphere(0, 0), { glow: 1 }));
  // A collar of bone across the shoulders, a skull at the clasp.
  c.part();
  c.shape(13, 14, (y) => [C - 5.4 - (y - 13), C + 5.4 + (y - 13)], BONE, (_x, _y, t, u) => cyl(t, 0.5 - u));
  for (const x of [5, 7, 10, 12]) c.shade(x, 14, -1);
  c.part();
  c.shape(14, 16, (y) => (y < 16 ? [C - 1, C + 1] : [C - 0.6, C + 0.6]), BONE, (_x, _y, t, u) => sphere(t, u - 0.3));
  c.px(8, 15, L.eye, sphere(0, 0), { glow: 0.6 });
  c.px(9, 15, L.eye, sphere(0, 0), { glow: 0.6 });
}
