// The Alchemist's bust: the plague doctor, a bone-white beaked mask under a
// wide black brim, its round goggle lenses glowing poison green, a dark hood
// round the mask, a short mantle over the plum coat and a strap of glowing vials.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { GOLD, LEATHER } from '../palette';
import { PLAGUE_LOOK } from '../alchemist';
import { C, pair, shoulders } from './kit';

export function alchemistBust(c: PixelCanvas): void {
  const L = PLAGUE_LOOK;
  // The plum coat, buttoned in brass down the front.
  shoulders(c, L.coat, 23, 7, 17, 5);
  c.part();
  c.line(C - 0.5, 27, C - 0.5, 33, L.coat, () => cyl(0, 0.3), { bias: -1 });
  for (const y of [28, 31]) c.px(15, y, GOLD, sphere(-0.3, 0.4));
  // The short mantle over the shoulders, its hem scalloped a little.
  c.part();
  c.shape(
    21,
    27,
    (y) => {
      const t = (y - 20.5) / 6.5;
      const hw = 7 + 9.5 * Math.sqrt(t);
      return [C - hw, C + hw];
    },
    L.mantle,
    (_x, _y, t, u) => cyl(t * 0.9, 0.4 - u * 0.4),
  );
  for (const x of [4, 9, 24, 29]) c.shade(x, 27, -1);

  // The strap of vials across the chest, from his right shoulder down to the left.
  c.part();
  c.line(8, 24, 24, 33, LEATHER, (i, n) => cyl(-0.2 + (i / n) * 0.2, 0.5), { bias: 1 });
  c.line(9, 24, 25, 33, LEATHER, (i, n) => cyl(-0.2 + (i / n) * 0.2, 0.3));
  // Vials in it, each with a green glow and a cork.
  for (const [x, y] of [
    [11, 25],
    [21, 29],
  ]) {
    c.part();
    c.px(x, y - 1, GOLD, sphere(-0.3, 0.6));
    c.shape(y, y + 3, (yy) => (yy === y ? [x, x + 1] : [x - 0.6, x + 1.6]), L.brew, (_x, _y, t) => sphere(t, 0.2), { glow: 0.6 });
    c.spark(x, y + 2, L.mid, 0.35);
  }

  // A dark hood round the mask, falling onto the mantle.
  c.part();
  c.shape(
    9,
    23,
    (y) => {
      const u = (y - 9) / 14;
      const hw = 6.4 + Math.sin(u * Math.PI) * 1.4 - u * 0.6;
      return [C - hw, C + hw];
    },
    L.mantle,
    (_x, _y, t, u) => cyl(t, 0.2 - u * 0.3),
    { bias: -1 },
  );

  // The mask: a smooth bone-white face.
  c.part();
  c.ellipse(C, 14.5, 5, 4.6, L.face, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.6 - 0.1) });
  // The beak, curving out toward us and down onto the chest, narrowing to a point.
  c.part();
  c.shape(
    15,
    26,
    (y) => {
      const u = (y - 15) / 11;
      const hw = 2.8 * (1 - Math.pow(u, 1.3)) + 0.5;
      const sway = u * u * 0.8;
      return [C - hw + sway, C + hw + sway];
    },
    L.face,
    (_x, _y, t, u) => sphere(t * 0.85, 0.5 - u * 0.7, 1),
  );
  // Its ridge catching the light, its nostril holes, and stitching across its root.
  c.line(16, 16, 17, 24, L.face, () => sphere(-0.4, 0.6), { bias: 1 });
  c.shade(15, 18, -2);
  c.shade(19, 18, -2);
  c.line(14, 16, 20, 16, L.face, () => sphere(0, 0.2), { bias: -1 });

  // The goggles: brass-rimmed rounds with lenses lit green from within.
  pair(13, (x) => {
    c.part();
    c.ellipse(x + 1, 13.5, 2.4, 2.3, GOLD, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 0.6), bias: -1 });
    c.part();
    c.ellipse(x + 1, 13.5, 1.75, 1.7, L.eye, { normal: (_x, _y, dx, dy) => sphere(dx * 0.5 - 0.3, dy * 0.5 + 0.3) });
    c.spark(x + 1, 13, L.hot, 0.5);
    c.spark(x, 13, L.mid, 0.3);
  });

  // The hat: a tall black crown with a plum band, over a brim wide as the disc.
  c.part();
  c.shape(1, 8, (y) => [C - 5.4 + (8 - y) * 0.12, C + 5.4 - (8 - y) * 0.12], L.hat, (_x, _y, t) => cyl(t, 0.2));
  c.ellipse(C, 1.6, 5, 1.2, L.hat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, 0.6 - dy * 0.3, 0.6) });
  c.part();
  c.shape(6, 7, () => [C - 5.5, C + 5.5], L.band, (_x, y, t) => cyl(t, y === 6 ? 0.4 : -0.1));
  c.part();
  c.ellipse(C, 9.2, 14.6, 2.3, L.hat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, -dy * 0.4 + 0.5, 0.8) });
  // The brim's shadow over the top of the mask.
  for (let x = 12; x <= 21; x++) c.shade(x, 11, -1);
}
