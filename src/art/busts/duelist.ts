// The Duelist's bust: a charcoal hood pulled low, a crimson scarf up over the
// nose and only a pair of narrow, watchful eyes between, and a katana slung on
// his back, its wrapped hilt rising over his shoulder.

import { cyl, hex, sphere, type Material, type PixelCanvas } from '../pixel';
import { EYE, SKIN } from '../palette';
import { ROGUE_LOOK } from '../rogue';
import { C, pair, shoulders } from './kit';

/** The whites of the eyes, dimmed in the hood's shade. */
const WHITE: Material = { ramp: [hex('#8e8a98'), hex('#c8c4d0')], outline: hex('#0b0910'), noAO: true };

export function duelistBust(c: PixelCanvas): void {
  const L = ROGUE_LOOK;
  // The katana's hilt over his right shoulder, its guard at the shoulder.
  c.line(12, 12, 15, 5, L.hilt, () => cyl(0.3, 0.4));
  c.part();
  c.line(11, 12, 13, 12, L.metal, () => sphere(0.2, 0.5));
  // The vest.
  c.part();
  shoulders(c, L.vest, 13, 4, 9, 3);
  // The hood, its cowl falling over the shoulders.
  c.part();
  c.shape(
    2,
    13,
    (y) => {
      const u = (y - 2) / 11;
      const hw = u < 0.5 ? 1.2 + 3.8 * Math.sin((u / 0.5) * Math.PI * 0.5) : 5 + (u - 0.5) * 1.6;
      return [C - hw, C + hw];
    },
    L.hood,
    (_x, _y, t, u) => cyl(t, 0.5 - u * 0.6),
  );
  // The face in the hood's shade, the brow under its rim.
  c.part();
  c.ellipse(C, 9.8, 3.2, 2.4, SKIN, { bias: -1 });
  pair(6, (x) => {
    c.px(x, 9, WHITE);
    c.px(x + (x < C ? 1 : -1), 9, EYE);
  });
  c.part();
  c.shape(7, 8, (y) => (y === 7 ? [C - 3.6, C + 3.6] : [C - 3.2, C + 3.2]), L.hood, (_x, _y, t) => sphere(t * 0.8, -0.6, 1));
  // The scarf, up over the nose and wound round the neck.
  c.part();
  c.shape(10, 13, (y) => [C - 3.6 - (y - 10) * 0.3, C + 3.6 + (y - 10) * 0.3], L.scarf, (_x, _y, t, u) => cyl(t, 0.4 - u * 0.6));
  c.shade(7, 11, -1);
  c.shade(10, 12, -1);
}
