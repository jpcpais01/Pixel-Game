// The Jedi's bust: a young knight with swept brown hair parted to one side,
// his hood lowered and bunched round his neck, an oat tunic crossed over his
// chest under the brown robe, and his blue saber lit and held upright beside him.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { EYE, SILVER, HILT_DARK } from '../palette';
import { JEDI_LOOK } from '../jedi';
import { C, pair, shoulders } from './kit';

export function jediBust(c: PixelCanvas): void {
  const L = JEDI_LOOK;
  // The robe over the shoulders.
  shoulders(c, L.robe, 23, 7, 17, 5);
  // The tunic's two flaps crossing in a V down the chest, the robe open round them.
  c.part();
  c.shape(23, 33, (y) => [C - 5 + (y - 23) * 0.15, C + 5 - (y - 23) * 0.15], L.tunic, (_x, _y, t) => cyl(t * 0.7, 0.2));
  // The flap from the left shoulder lies over the other: a fold line down the V.
  c.part();
  c.shape(23, 33, (y) => [C - 5 + (y - 23) * 0.15, Math.min(C + 2, C - 3 + (y - 23) * 0.55)], L.tunic, (_x, _y, t) => cyl(t * 0.6 - 0.2, 0.25));
  // The robe's lapels either side of the tunic.
  pair(10, (x, s) => {
    c.part();
    c.shape(24, 33, (y) => (s < 0 ? [x - 2, x + 2 - (y - 24) * 0.12] : [x - 1 + (y - 24) * 0.12, x + 3]), L.robe, (_x, _y, t) => cyl(t * 0.5 + s * 0.3, 0.2));
  });

  // The lowered hood: a thick roll of cloth round the back of the neck, its
  // ends falling onto the shoulders.
  c.part();
  c.ellipse(C, 22.6, 9.4, 3.2, L.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.35, 1) });
  c.shade(C - 0.5, 24, -1);

  // The face.
  c.part();
  c.ellipse(C, 16, 5.3, 6, L.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.45 - 0.15) });
  // Ears either side.
  pair(11, (x, s) => c.ellipse(x + 0.5 + s * 0.3, 16.5, 1.2, 1.6, L.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.5 + s * 0.4, dy * 0.6) }));
  // Eyes, brows, nose and a calm mouth.
  c.part();
  pair(14, (x) => {
    c.px(x, 15, EYE);
    c.px(x, 16, EYE);
  });
  c.line(13, 13, 15, 13, L.hair, () => sphere(-0.2, 0.4));
  c.line(19, 13, 21, 13, L.hair, () => sphere(0.2, 0.4));
  c.px(16, 17, L.skin, sphere(-0.6, 0.2), { bias: 1 });
  c.px(17, 17, L.skin, sphere(0.6, -0.4));
  c.shade(16, 19, -1);
  c.shade(17, 19, -1);

  // Swept hair with a parting over his right brow (screen left), falling to the jaw.
  c.part();
  c.shape(
    7,
    12,
    (y) => {
      const u = (y - 6.6) / 6;
      const hw = 6.6 * Math.sqrt(Math.min(1, u * 1.6));
      return [C - hw, C + hw];
    },
    L.hair,
    (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1),
  );
  // Locks down past the temples to the jaw.
  c.shape(12, 18, (y) => [C - 6.6 + (y - 12) * 0.12, C - 4.8 - (y - 12) * 0.12], L.hair, (_x, _y, t) => cyl(t * 0.5 - 0.6, 0.1));
  c.shape(12, 18, (y) => [C + 4.8 + (y - 12) * 0.12, C + 6.6 - (y - 12) * 0.12], L.hair, (_x, _y, t) => cyl(t * 0.5 + 0.6, 0.1));
  // The fringe sweeps from the parting across to the right, leaving the brow bare under it.
  c.shape(12, 12, () => [C - 3.5, C + 4.8], L.hair, (_x, _y, t) => cyl(t * 0.8, -0.3));
  c.px(13, 12, L.skin, sphere(0.1, -0.6));
  c.px(14, 12, L.skin, sphere(0.2, -0.6));
  // The parting line and a few strands catching the light.
  c.line(13, 8, 13, 11, L.hair, () => sphere(-0.2, 0.2), { bias: -1 });
  c.line(15, 8, 19, 10, L.hair, () => sphere(-0.2, 0.9), { bias: 1 });

  // The saber, held upright at his side: a silver hilt in his fist and a blade of blue light.
  const bx = 6;
  c.part();
  c.line(bx, 7, bx, 25, L.blade.edge, () => sphere(0, 0));
  c.line(bx + 1, 7, bx + 1, 25, L.blade.edge, () => sphere(0, 0));
  c.line(bx, 8, bx, 25, L.blade.core, () => sphere(-0.3, 0.3));
  c.px(bx + 1, 8, L.blade.core, sphere(0.3, 0.3));
  // Its glow, soft on the robe round it.
  for (let y = 6; y <= 26; y++) {
    c.spark(bx - 1, y, L.bladeGlow, 0.35);
    c.spark(bx + 2, y, L.bladeGlow, 0.35);
  }
  c.part();
  c.shape(26, 29, () => [bx - 0.6, bx + 2.6], SILVER, (_x, _y, t) => cyl(t, 0.1));
  c.shape(27, 27, () => [bx - 0.6, bx + 2.6], HILT_DARK, (_x, _y, t) => cyl(t, 0.1));
  // His fist round the hilt, out of the robe's sleeve.
  c.part();
  c.capsule(bx + 1, 32.5, bx + 3, 34, 2.6, 2.8, L.robe);
  c.part();
  c.ellipse(bx + 1, 29.6, 2, 1.7, L.skin, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 0.9) });
  c.shade(bx + 1, 29, -1);
}
