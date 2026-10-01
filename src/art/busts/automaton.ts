// The Automaton's bust: the yellow mech's head as a face, a gunmetal ring
// round one great porthole eye (teal glass, a glowing red core), a lamp on
// its antenna and heavy gold pauldrons.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { GLASS, GUNMETAL, HELMET, JOINT, LAMP, PLATE, VENT } from '../mech';
import { C, pair } from './kit';

export function automatonBust(c: PixelCanvas): void {
  // The antenna behind the head, its lamp lit.
  c.line(9, 2, 9, 4, GUNMETAL, () => cyl(0, 0.3));
  c.part();
  c.px(9, 1, LAMP, sphere(0, 0.3), { glow: 0.8 });
  // The chassis, the neck's dark joints and a glowing vent.
  c.part();
  c.shape(14, 17, (y) => [C - 6 - (y - 14), C + 6 + (y - 14)], PLATE, (_x, _y, t) => cyl(t, 0.25));
  c.part();
  c.shape(12, 13, () => [C - 2.5, C + 2.5], JOINT, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.line(7, 16, 10, 16, VENT, () => sphere(0, 0.2), { glow: 0.7 });
  // Pauldrons: big rounded gold plates.
  c.part();
  pair(3, (x) => c.ellipse(x + 0.5, 14.2, 3, 2.4, PLATE, { normal: (_x, _y, dx, dy) => sphere(dx, dy - 0.4) }));
  pair(3, (x) => c.px(x, 15, GUNMETAL, sphere(0, 0.5)));
  // The head: a rounded gold box, lamps for ears.
  c.part();
  c.shape(
    4,
    12,
    (y) => {
      const u = (y - 4) / 8;
      const r = u < 0.15 ? 4 : u > 0.85 ? 4.3 : 5;
      return [C - r, C + r];
    },
    PLATE,
    (_x, _y, t, u) => cyl(t, 0.5 - u * 0.7),
  );
  c.part();
  pair(3, (x) => c.px(x, 8, LAMP, sphere(0, 0.3), { glow: 0.5 }));
  // The porthole: a gunmetal rim, teal glass round the eye's glowing core.
  c.part();
  c.ellipse(C, 8.2, 3.4, 3.4, GUNMETAL);
  c.part();
  c.ellipse(C, 8.2, 2.5, 2.5, GLASS, { glow: 0.35 });
  c.part();
  c.ellipse(C, 8.2, 1.3, 1.3, HELMET, { glow: 0.9 });
  c.px(8, 7, GLASS, sphere(-0.5, 0.5), { bias: 2, glow: 0.6 });
  // A grille for a mouth.
  c.part();
  c.line(7, 11, 10, 11, JOINT, () => sphere(0, 0));
  c.shade(8, 11, 1);
  c.shade(10, 11, 1);
}
