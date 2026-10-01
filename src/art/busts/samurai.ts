// The Samurai's bust: the Bladewind, dark hair swept back to a high knot and
// a long ponytail, a calm, level gaze, a storm-blue gi crossed over a white
// collar, a lacquered guard on one shoulder, and his katana's wrapped hilt
// and gold tsuba rising over the other.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { BLADEWIND_LOOK } from '../samurai';
import { C, pair, shoulders } from './kit';

export function samuraiBust(c: PixelCanvas): void {
  const L = BLADEWIND_LOOK;
  // The ponytail, hanging from the knot down behind the head.
  c.part();
  c.capsule(19, 5.5, 22.8, 9.5, 1.7, 1.5, L.hair);
  c.capsule(22.8, 9.5, 24, 17, 1.5, 1.0, L.hair);
  // The katana slung across his back, its wrapped hilt rising over his right
  // shoulder past a gold tsuba, a gold cap at the pommel.
  c.part();
  c.capsule(23.2, 23.5, 28.2, 13.8, 1.3, 1.2, L.grip);
  for (let i = 1; i < 6; i++) {
    const k = i / 6;
    c.px(23.2 + 5 * k, 23.5 - 9.7 * k, L.obi, sphere(0.2, -0.2), { bias: -1 });
  }
  c.part();
  c.ellipse(28.5, 13.4, 1.2, 1.1, L.tsuba);
  c.part();
  c.capsule(20.6, 22.2, 25.4, 24.8, 0.9, 0.9, L.tsuba);
  // The gi, crossed left over right at the chest over the white collar.
  shoulders(c, L.gi, 24, 7, 16, 5);
  c.part();
  for (let y = 24; y <= 33; y++) {
    const d = (y - 24) * 0.75;
    c.px(C - 3 + d, y, L.collar, cyl(-0.5));
    c.px(C - 2 + d, y, L.collar, cyl(0.3));
    if (y < 29) {
      c.px(C + 2 - d, y, L.collar, cyl(0.5), { bias: -1 });
      c.px(C + 1 - d, y, L.collar, cyl(-0.3), { bias: -1 });
    }
  }
  // The lacquered guard on his left shoulder, riveted in gold.
  c.part();
  c.ellipse(5.8, 27.6, 4.4, 3.4, L.pad!, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  c.part();
  for (const x of [4, 7]) c.px(x, 29, L.trim, sphere(0, 0.2));
  // Hair behind the head and by the ears.
  c.part();
  c.ellipse(C, 14.5, 6.6, 7.2, L.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
  // The face.
  c.part();
  c.ellipse(C, 16.4, 5.3, 6.0, L.skin, { flatten: 0.9 });
  // The hair swept back from the brow to the knot, a lock falling at the parting.
  c.part();
  c.shape(8, 12, (y) => {
    const w = [4.4, 5.4, 6, 6.2, 6.2][y - 8];
    return [C - w, C + w];
  }, L.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1));
  pair(11, (x, side) => {
    c.px(x, 13, L.hair, cyl(side * 0.8, 0));
    c.px(x, 14, L.hair, cyl(side * 0.8, 0));
    c.px(x - side, 13, L.hair, cyl(side * 0.6, 0));
  });
  for (let y = 9; y <= 11; y++) c.shade(C + 1 - (y - 9), y, 1);
  c.px(15, 13, L.hair, sphere(-0.2, 0.4));
  // The knot on top, bound in a gold cord.
  c.part();
  c.ellipse(C + 0.5, 5.8, 2.2, 1.9, L.hair, { normal: (_x, _y, dx, dy) => sphere(dx, dy - 0.3) });
  c.part();
  c.line(16, 7, 18, 7, L.trim, () => sphere(0, -0.3));
  // Level eyes, white to the outside, under straight dark brows, the nose and a firm mouth.
  c.part();
  pair(14, (x, side) => {
    c.px(x, 16, L.eye);
    c.px(x + (side < 0 ? -1 : 1), 16, L.collar, sphere(0, 0), { bias: -1 });
  });
  pair(13, (x, side) => {
    for (let i = 0; i < 3; i++) c.px(x + (side < 0 ? i : -i), 14, L.hair, sphere(0, -0.4));
  });
  c.px(16, 18, L.skin, sphere(-0.6, 0.2));
  c.px(17, 18, L.skin, sphere(0.6, -0.4));
  c.shade(17, 19, -1);
  for (let x = 15; x <= 18; x++) c.shade(x, 20, -2);
}
