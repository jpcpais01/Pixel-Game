// The Rogue's bust: the cutpurse, a charcoal hood pulled low, a crimson
// scarf up over the nose, and only a pair of narrow, watchful eyes between.

import { hex, sphere, type Material, type PixelCanvas } from '../pixel';
import { EYE, SKIN } from '../palette';
import { ROGUE_LOOK } from '../rogue';
import { C, pair, shoulders } from './kit';

/** The whites of the eyes, a little dimmed by the hood's shadow. */
const WHITE: Material = { ramp: [hex('#8e8a98'), hex('#c8c4d0')], outline: hex('#0b0910'), noAO: true };

export function rogueBust(c: PixelCanvas): void {
  const L = ROGUE_LOOK;
  // The leather vest under the mantle.
  shoulders(c, L.vest, 25, 8, 17, 5);
  // A strap across the chest for the knives at his back, buckled in steel.
  c.part();
  c.line(11, 26, 21, 33, L.hilt, () => sphere(0, 0.4), { bias: 1 });
  c.line(12, 26, 22, 33, L.hilt, () => sphere(0, -0.2));
  c.px(15, 29, L.metal, sphere(-0.3, 0.4));
  c.px(16, 29, L.metal, sphere(0.3, 0.2));
  // The hood's short mantle over the shoulders, parted down the front so the
  // vest shows, its hem cut ragged.
  c.part();
  const hem = (x: number) => 23.5 + 5.5 * Math.min(1, Math.abs(x + 0.5 - C) / 8);
  for (let y = 21; y <= 30; y++) {
    const hw = 7.5 + 7 * Math.sqrt(Math.min(1, (y - 21) / 6));
    for (let x = Math.round(C - hw); x < Math.round(C + hw); x++) {
      const h = hem(x);
      if (y > h || (y > h - 1 && (x & 1) === 1)) continue;
      const t = (x + 0.5 - C) / hw;
      c.px(x, y, L.hood, sphere(t * 0.95, ((y - 21) / 9) * 1.4 - 0.6, 1), { bias: y > h - 1 ? -1 : 0 });
    }
  }
  // The scarf's tails, knotted at the side of the neck, hanging over the mantle.
  c.part();
  c.capsule(22.5, 23.5, 23.8, 31, 1.2, 0.9, L.scarf);
  c.capsule(23.5, 23.5, 26.2, 30, 1.0, 0.8, L.scarf, { bias: -1 });
  // The hood: a deep round cowl drawn up to a peak that droops back.
  c.part();
  c.ellipse(C, 14.5, 8.4, 8.6, L.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.shape(3, 7, (y) => {
    const hw = (y - 3) * 1.15 + 0.6;
    return [C - 0.8 - hw, C - 0.8 + hw];
  }, L.hood, (_x, _y, t) => sphere(t * 0.8, -0.7, 1));
  // Folds where the cloth gathers at the cheeks.
  for (let y = 15; y <= 21; y++) {
    c.shade(9, y, -1);
    c.shade(25, y, -1);
  }
  // The dark inside of the hood, round the face.
  c.part();
  c.ellipse(C, 17.2, 6.2, 6.1, L.hood, { normal: () => sphere(0, 0.3, 1), bias: -2 });
  // The face, mostly in that shadow.
  c.part();
  c.ellipse(C, 16.8, 5.0, 5.4, SKIN, { flatten: 0.9 });
  // The hood's brim low over the brow, arched round the face, and its shadow.
  c.part();
  c.shape(11, 13, (y) => (y === 11 ? [C - 6, C + 6] : y === 12 ? [C - 5.6, C + 5.6] : [C - 5.2, C - 3]), L.hood, (_x, y, t) => sphere(t * 0.8, y === 11 ? -0.7 : y === 12 ? -0.2 : 0.2, 1));
  c.shape(13, 13, () => [C + 3, C + 5.2], L.hood, (_x, _y, t) => sphere(t * 0.8, 0.3, 1));
  for (let x = 13; x <= 20; x++) c.shade(x, 13, -1);
  // The scarf pulled up over the nose, its folds sagging under the chin.
  c.part();
  c.shape(17, 24, (y) => {
    const hw = y === 17 ? 5.2 : y < 21 ? 5.6 : 5.6 - (y - 20) * 0.5;
    return [C - hw, C + hw];
  }, L.scarf, (_x, y, t) => sphere(t * 0.9, (y - 17) * 0.12 - 0.2, 1));
  c.shape(16, 16, () => [C - 1.5, C + 1.5], L.scarf, (_x, _y, t) => sphere(t * 0.7, -0.6, 1));
  for (const [x, y] of [[13, 19], [14, 20], [19, 20], [20, 19], [15, 22], [16, 22], [18, 22]] as const) c.shade(x, y, -1);
  c.shade(16, 17, 1);
  // Narrow eyes: a white and a dark pupil looking aside, under hard slanted brows.
  c.part();
  pair(13, (x, side) => {
    c.px(x + (side < 0 ? 0 : 1), 15, WHITE, sphere(0, 0));
    c.px(x + (side < 0 ? 1 : 0), 15, EYE);
  });
  pair(12, (x, side) => {
    const s = side < 0 ? 1 : -1;
    c.px(x, 14, L.hood, sphere(0, -0.3), { bias: -1 });
    c.px(x + s, 14, L.hood, sphere(0, -0.3), { bias: -1 });
    c.px(x + 2 * s, 14, L.hood, sphere(0, -0.3), { bias: -1 });
  });
  c.shade(15, 15, -1);
  c.shade(18, 15, -1);
}
