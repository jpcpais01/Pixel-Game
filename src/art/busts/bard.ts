// The Bard's bust: the minstrel, a cheerful troubadour with chestnut hair
// to his shoulders under a tilted wine cap and its long white plume, a teal
// doublet with puffed wine sleeves, and his lute's neck up by his shoulder.

import { cyl, hex, sphere, type Material, type PixelCanvas } from '../pixel';
import { EYE, GOLD, SKIN } from '../palette';
import { CHESTNUT, MINSTREL_LOOK, PLUME, STRING } from '../bard';
import { C, pair, shoulders } from './kit';

/** A warm flush on the cheeks: he's mid-song. */
const BLUSH: Material = { ramp: [hex('#c8705e'), hex('#e48a72'), hex('#f0a084')], outline: hex('#2a1418'), noOutline: true, noAO: true };

export function bardBust(c: PixelCanvas): void {
  const D = MINSTREL_LOOK.dress;
  // The doublet, a cream collar at the neck and gold buttons down the front.
  shoulders(c, D.coat, 24, 7, 15, 5);
  c.part();
  c.shape(23, 26, (y) => [C - 3.6 + (y - 23) * 0.9, C + 3.6 - (y - 23) * 0.9], D.cuff, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6 - 0.3, 1));
  for (const y of [28, 31]) c.px(16, y, GOLD, sphere(-0.3, -0.3));
  // Puffed wine sleeves on both shoulders, slashed to show the shirt.
  c.part();
  pair(3, (x, side) => {
    c.ellipse(x + 1 + side * 0.5, 29.5, 4.2, 4.0, D.cloak, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.8 - 0.2, 1) });
  });
  c.part();
  pair(4, (x, side) => {
    c.line(x - side, 27, x - side, 31, D.cuff, () => sphere(side * 0.3, 0));
  });
  // Hair behind, falling to the shoulders.
  c.part();
  c.ellipse(C, 15, 7.4, 7.6, CHESTNUT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  pair(10, (x, side) => c.capsule(x + 0.5, 16, x + 0.5 + side * 0.6, 23, 2.4, 1.8, CHESTNUT));
  // The face.
  c.part();
  c.ellipse(C, 16.2, 5.5, 6.0, SKIN, { flatten: 0.9 });
  // A fringe swept to one side under the cap.
  c.part();
  c.shape(10, 12, (y) => (y === 10 ? [C - 6, C + 5.5] : y === 11 ? [C - 6, C + 1] : [C - 5.5, C - 2.5]), CHESTNUT, (_x, y, t) => sphere(t * 0.8, y === 10 ? -0.4 : 0.1, 1));
  // Eyes, bright and smiling: a dark eye with a lid curving over it.
  c.part();
  pair(14, (x) => {
    c.px(x, 15, EYE);
    c.px(x, 16, EYE);
  });
  pair(13, (x, side) => c.px(x + (side < 0 ? 0 : 0), 14, CHESTNUT, sphere(0, -0.4)));
  pair(14, (x) => c.px(x, 14, CHESTNUT, sphere(0, -0.4)));
  // Rosy cheeks, the nose and a wide open-mouthed smile.
  c.part();
  pair(12, (x) => c.px(x, 18, BLUSH, sphere(0, 0)));
  c.px(16, 17, SKIN, sphere(-0.6, 0.2));
  c.px(17, 17, SKIN, sphere(0.6, -0.4));
  c.shade(17, 18, -1);
  c.shade(14, 19, -1);
  c.shade(19, 19, -1);
  c.shape(20, 20, () => [15, 19], SKIN, () => sphere(0, 0.5), { bias: -3 });
  c.shade(16, 21, -1);
  c.shade(17, 21, -1);
  // The cap: a wide wine brim tilted over one eye, a soft crown, a gold band.
  c.part();
  c.ellipse(C + 0.6, 10.2, 8.4, 2.1, D.cloak, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.4 - 0.6, 1) });
  for (let x = 12; x <= 22; x++) c.shade(x, 12, -1);
  c.part();
  c.ellipse(C + 1.8, 7.0, 5.6, 3.4, D.cloak, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  c.part();
  c.shape(9, 9, () => [C - 3.4, C + 7], GOLD, (_x, _y, t) => cyl(t, 0.2));
  // The long white plume from the band, arching up and back.
  c.part();
  // A quill along its top edge, the vanes hanging below it and thinning to the tip.
  for (let i = 0; i <= 18; i++) {
    const k = i / 18;
    const x = 21 + k * 6.2;
    const y = 8.6 - Math.sin(k * 2.6) * 6 + k * k * 3.2;
    c.px(x, y, PLUME, sphere(0.2, -0.8 + k * 0.6), { bias: 1 });
    if (k > 0.1 && k < 0.92) c.px(x, y + 1, PLUME, sphere(0.3, 0.1 + k * 0.4), { bias: k > 0.6 ? -1 : 0 });
    if (k > 0.3 && k < 0.8) c.px(x, y + 2, PLUME, sphere(0.3, 0.6), { bias: -1 });
  }
  // The lute's neck rising past his shoulder, frets and strings along it, the pegbox bent back.
  c.part();
  c.line(19, 33, 28, 20, D.neck, () => sphere(-0.5, 0.2));
  c.line(20, 33, 29, 20, D.neck, () => sphere(0.5, -0.2));
  c.line(20, 32, 28, 21, STRING, () => sphere(0, 0));
  // The pegbox, bent back from the nut, three pegs sticking out of its side.
  c.part();
  c.line(28, 19, 30, 17, D.neck, () => sphere(-0.3, -0.4));
  c.line(29, 20, 31, 18, D.neck, () => sphere(0.4, 0.2), { bias: -1 });
  c.part();
  for (const [x, y] of [[27, 18], [28, 17], [29, 16]] as const) c.px(x, y, D.lute, sphere(-0.3, -0.5));
}
