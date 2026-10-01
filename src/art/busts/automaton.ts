// The Automaton's bust: the yellow mech's head as a face, a gold casing
// round one great porthole eye (teal glass, a glowing red core), a grille for
// a mouth, a lamp on its antenna and heavy pauldrons.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { GLASS, GUNMETAL, HELMET, JOINT, LAMP, PLATE, VENT } from '../mech';
import { C, pair } from './kit';

export function automatonBust(c: PixelCanvas): void {
  // The antenna, behind the head, with its lamp lit.
  c.line(C - 0.5, 2, C - 0.5, 6, GUNMETAL, () => cyl(0, 0.3));
  c.part();
  c.ellipse(C, 2.2, 1.5, 1.5, LAMP);
  // The chassis under the head.
  c.part();
  c.shape(24, 33, (y) => [C - 11 - Math.min(2, y - 24), C + 11 + Math.min(2, y - 24)], PLATE, (_x, _y, t) => cyl(t, 0.25));
  // The neck, dark joints.
  c.part();
  c.shape(21, 25, () => [C - 4, C + 4], JOINT, (_x, _y, t) => cyl(t, 0));
  // A vent grille glowing on the chest.
  c.part();
  for (const y of [29, 31]) c.line(C - 4, y, C + 3, y, VENT, () => sphere(0, 0.2), { glow: 0.7 });
  // Pauldrons: big rounded gold plates, gunmetal rims.
  c.part();
  pair(4, (x) => c.ellipse(x + 0.5, 26.5, 6, 5, GUNMETAL));
  c.part();
  pair(4, (x) => c.ellipse(x + 0.5, 26, 5.4, 4.4, PLATE, { normal: (_x, _y, dx, dy) => sphere(dx, dy - 0.3, 1) }));
  // Rivets on the pauldrons.
  pair(4, (x) => c.px(x, 27, GUNMETAL, sphere(0, 0.5)));
  // The head: a rounded gold box.
  c.part();
  c.shape(
    6,
    22,
    (y) => {
      const u = (y - 6) / 16;
      const r = u < 0.2 ? 9.2 - (0.2 - u) * 12 : u > 0.85 ? 9.2 - (u - 0.85) * 10 : 9.2;
      return [C - r, C + r];
    },
    PLATE,
    (_x, _y, t, u) => cyl(t, 0.5 - u * 0.7),
  );
  // Side lamps for ears.
  c.part();
  pair(7, (x) => c.ellipse(x + 0.5, 14.5, 1.3, 2.2, GUNMETAL));
  c.part();
  pair(7, (x) => c.px(x, 14, LAMP, sphere(0, 0.3)));
  // The porthole: a gunmetal rim, teal glass round a dark cell.
  c.part();
  c.ellipse(C, 14, 6.1, 6.1, GUNMETAL);
  c.part();
  c.ellipse(C, 14, 5, 5, GLASS, { glow: 0.35 });
  c.part();
  c.ellipse(C, 14, 3.6, 3.6, JOINT);
  // The eye's red core, glowing, with a hot pupil and a glint.
  c.part();
  c.ellipse(C, 14, 2.4, 2.4, HELMET, { glow: 0.9 });
  c.px(C - 1, 14, VENT, sphere(0, 0), { glow: 1, bias: 2 });
  c.px(C, 14, VENT, sphere(0, 0), { glow: 1, bias: 1 });
  c.px(C - 1, 13, VENT, sphere(0, 0), { glow: 1, bias: 1 });
  c.px(C - 4, 11, GLASS, sphere(-0.5, 0.5), { bias: 2, glow: 0.6 });
  c.px(C - 3, 10, GLASS, sphere(-0.5, 0.5), { bias: 2, glow: 0.6 });
  // The mouth grille under the eye.
  c.part();
  c.shape(20, 21, () => [C - 3.5, C + 3.5], GUNMETAL, (_x, _y, t) => cyl(t, 0));
  for (let x = C - 3; x <= C + 2; x += 2) c.px(x, 20.5, JOINT);
  // A seam across the brow and bolts at the corners.
  pair(10, (x) => c.px(x, 8, GUNMETAL, sphere(0, 0.5)));
}
