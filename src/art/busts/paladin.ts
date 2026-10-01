// The Paladin's bust: the Templar, an open white-silver helm with a gold crest
// and little ivory wings sweeping up from its sides, gold-rimmed pauldrons
// over an azure cape, and an ivory tabard bearing the holy sun.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { EYE, SKIN } from '../palette';
import { HOLY_LOOK } from '../paladin';
import { C, pair, shoulders } from './kit';

export function paladinBust(c: PixelCanvas): void {
  const L = HOLY_LOOK;
  // The azure cape over the shoulders, behind everything.
  shoulders(c, L.cape, 21, 6, 17, 4);
  // A mail collar at the neck.
  c.part();
  c.shape(21, 24, () => [C - 4, C + 4], L.plateDark, (_x, _y, t) => cyl(t, 0.2));
  // The breastplate, and the ivory tabard down its middle, edged in gold.
  c.part();
  c.shape(24, 33, (y) => [C - 6.5 - (y - 24) * 0.25, C + 6.5 + (y - 24) * 0.25], L.plate, (_x, _y, t) => cyl(t * 0.8, 0.3));
  c.part();
  c.shape(26, 33, (y) => [C - 4.2 - (y - 26) * 0.1, C + 4.2 + (y - 26) * 0.1], L.trim, (_x, _y, t) => cyl(t * 0.6, 0.2));
  c.part();
  c.shape(27, 33, (y) => [C - 3.2 - (y - 27) * 0.1, C + 3.2 + (y - 27) * 0.1], L.tabard, (_x, _y, t) => cyl(t * 0.6, 0.2));
  // The holy sun on the tabard: a small glowing cross with a bright heart.
  c.part();
  c.line(16, 28, 16, 33, L.trim, () => sphere(-0.2, 0.3));
  c.line(14, 30, 18, 30, L.trim, () => sphere(0, 0.3));
  c.px(16, 30, L.emblem, sphere(-0.3, 0.6), { glow: 0.9 });
  c.spark(16, 30, [255, 240, 168], 0.6);
  // Rounded pauldrons with a gold rim and a gold stud.
  pair(5, (x, s) => {
    const cx = x + 0.5 + s * 0.5;
    c.part();
    c.ellipse(cx, 27.4, 4.8, 3.8, L.plate, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 0.8) });
    c.part();
    c.shape(30, 31, (y) => [cx - 4.8 + (y - 30), cx + 4.8 - (y - 30)], L.trim, (_x, _y, t) => cyl(t, 0.1));
    c.px(cx - 0.5 - s * 0.5, 26, L.trim, sphere(-0.3, 0.5));
  });

  // The face, its normals kept gentle so it sits in the light inside the helm.
  c.part();
  c.ellipse(C, 16, 5.2, 5.8, SKIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.45 - 0.15) });
  // Calm eyes under soft brows, a nose lit on its left, a small smile.
  c.part();
  pair(14, (x) => {
    c.px(x, 15, EYE);
    c.px(x, 16, EYE);
  });
  c.shade(13, 13, -1);
  c.shade(14, 13, -1);
  c.shade(19, 13, -1);
  c.shade(20, 13, -1);
  c.px(16, 17, SKIN, sphere(-0.6, 0.2), { bias: 1 });
  c.px(17, 17, SKIN, sphere(0.6, -0.4));
  c.shade(15, 19, -1);
  c.shade(16, 20, -1);
  c.shade(17, 20, -1);
  c.shade(18, 19, -1);

  // The wings: three ivory feathers a side fanning up and out from the helm's temples.
  const feathers: [number, number, number][] = [
    [-6.6, -1.4, 1.2],
    [-6.4, -4, 1.3],
    [-4.6, -6.2, 1.3],
  ];
  for (const s of [-1, 1]) {
    const rx = C + s * 7;
    for (const [dx, dy, r] of feathers) {
      c.part();
      c.capsule(rx, 10, rx - dx * s, 10 + dy, r + 0.4, r * 0.6, L.tabard, { bias: 1 });
    }
    // The quill lines between the feathers, shaded in.
    c.shade(rx - 3.2 * s, 7.6, -1);
    c.shade(rx - 4.2 * s, 8.6, -1);
    c.shade(rx - 2.6 * s, 6.2, -1);
  }

  // The helm: a white-silver dome down to the brow.
  c.part();
  c.shape(
    5,
    13,
    (y) => {
      const dy = (13.4 - y) / 8.4;
      const hw = 7.4 * Math.sqrt(Math.max(0, 1 - dy * dy));
      return [C - hw, C + hw];
    },
    L.plate,
    (_x, y, t) => sphere(t * 0.95, (13.4 - y) / 8.4, 0.9),
  );
  // A gold band round its brow, and a gold crest over the crown.
  c.part();
  c.shape(12, 13, () => [C - 7.6, C + 7.6], L.trim, (_x, y, t) => cyl(t, y === 12 ? 0.5 : -0.2));
  c.part();
  c.capsule(C, 3.2, C, 9, 1.5, 1.1, L.trim, { bias: 1 });
  // Cheek guards down past the cheeks, a gold rivet on each.
  const guard = [2.8, 2.6, 2.4, 2.2, 1.9, 1.5, 1];
  c.part();
  c.shape(14, 20, (y) => [C - 7.6, C - 7.6 + guard[y - 14]], L.plate, (_x, _y, t) => cyl(t * 0.4 - 0.5, 0.1));
  c.shape(14, 20, (y) => [C + 7.6 - guard[y - 14], C + 7.6], L.plate, (_x, _y, t) => cyl(t * 0.4 + 0.5, 0.1));
  pair(11, (x) => c.px(x, 16, L.trim, sphere(-0.3, 0.4)));
}
