// The Fighter's bust: the Brawler, black hair spiked up over a red headband
// whose tails stream off to the side, a fierce brow, a sleeveless gi over
// bare shoulders, and one red-gloved fist raised by his cheek.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { BRAWLER_LOOK } from '../fighter';
import { C, pair, shoulders } from './kit';

export function fighterBust(c: PixelCanvas): void {
  const L = BRAWLER_LOOK;
  // Bare shoulders and a thick neck.
  shoulders(c, L.skin, 23, 6, 17, 4);
  // Shoulders are bare, so the shapes beneath must carry them: rounded traps
  // sloping from the neck, and a deltoid on each arm.
  pair(9, (x, s) => {
    c.part();
    c.ellipse(x + 0.5 + s * 1.2, 24.4, 4.6, 2.2, L.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.9 - 0.2, 0.9) });
  });
  c.part();
  c.shape(19, 24, () => [C - 3.4, C + 3.4], L.skin, (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
  // The sleeveless gi over the chest, its lapels crossing low to bare a V of chest.
  c.part();
  c.shape(24, 33, (y) => [C - 7 - (y - 24) * 0.25, C + 7 + (y - 24) * 0.25], L.gi, (_x, _y, t) => cyl(t * 0.8, 0.25));
  c.part();
  c.shape(24, 30, (y) => [C - 2.6 + (y - 24) * 0.4, C + 2.6 - (y - 24) * 0.4], L.skin, (_x, _y, t) => cyl(t * 0.6, 0.3));
  // The lapel edges, a shade darker where the cloth folds.
  for (let y = 24; y <= 30; y++) {
    c.shade(Math.floor(C - 3 + (y - 24) * 0.4), y, -1);
    c.shade(Math.floor(C + 2.6 - (y - 24) * 0.4), y, -1);
  }
  pair(4, (x, s) => {
    c.part();
    c.ellipse(x + 0.5 - s * 0.5, 28.6, 4.2, 4.6, L.skin, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 0.8) });
  });

  // The headband's tails, streaming out behind his head to the left.
  c.part();
  c.capsule(10, 12, 6, 14, 1.3, 1.0, L.band);
  c.capsule(6, 14, 3.6, 17.6, 1.0, 0.7, L.band);
  c.capsule(10, 13, 6.6, 17.2, 1.1, 0.7, L.band, { bias: -1 });

  // The face, broad at the jaw.
  c.part();
  c.ellipse(C, 16, 5.4, 6, L.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.45 - 0.15) });
  c.shape(18, 21, (y) => [C - 4.6 + (y - 18) * 0.5, C + 4.6 - (y - 18) * 0.5], L.skin, (_x, _y, t, u) => sphere(t * 0.5, u * 0.5 - 0.3));
  pair(11, (x, s) => c.ellipse(x + 0.5 + s * 0.3, 16.5, 1.2, 1.6, L.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.5 + s * 0.4, dy * 0.6) }));
  // Eyes under brows knitted down toward the nose: fierce, not cross.
  c.part();
  pair(14, (x) => {
    c.px(x, 15, L.eye);
    c.px(x, 16, L.eye);
  });
  c.px(13, 13, L.hair, sphere(-0.2, 0.4));
  c.px(14, 13, L.hair, sphere(-0.2, 0.4));
  c.px(15, 14, L.hair, sphere(-0.2, 0.4));
  c.px(20, 13, L.hair, sphere(0.2, 0.4));
  c.px(19, 13, L.hair, sphere(0.2, 0.4));
  c.px(18, 14, L.hair, sphere(0.2, 0.4));
  c.px(16, 17, L.skin, sphere(-0.6, 0.2), { bias: 1 });
  c.px(17, 17, L.skin, sphere(0.6, -0.4));
  // A grin pulled to one side.
  c.shade(15, 19, -1);
  c.shade(16, 19, -1);
  c.shade(17, 19, -1);
  c.shade(18, 18, -1);

  // Spiky black hair: a cap over the crown with spikes thrusting up and out.
  c.part();
  c.ellipse(C, 10.4, 6.6, 4.4, L.hair, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 0.9) });
  const spikes: [number, number, number, number, number][] = [
    [12, 9, 7.6, 5.8, 1.8],
    [14, 8, 11.4, 3.2, 1.8],
    [16.6, 7.4, 16.2, 1.6, 1.9],
    [19.4, 7.6, 21.2, 2.6, 1.8],
    [21.6, 8.6, 25, 5, 1.7],
    [22.6, 10.6, 26, 9.6, 1.5],
  ];
  for (const [x0, y0, x1, y1, r] of spikes) c.capsule(x0, y0, x1, y1, r, 0.45, L.hair);
  // Lit edges along a few spikes, so they read in the black.
  c.line(12, 5, 14, 7, L.hair, () => sphere(-0.6, 0.6), { bias: 1 });
  c.line(16, 3, 16, 6, L.hair, () => sphere(-0.6, 0.6), { bias: 1 });
  c.line(20, 4, 19, 6, L.hair, () => sphere(-0.6, 0.6), { bias: 1 });
  // Sideburns down past the ears.
  pair(11, (x) => c.shape(12, 15, () => [x - 0.2, x + 1.2], L.hair, (_x, _y, t) => cyl(t, 0)));

  // The red headband across his brow, knotted at the side the tails fly from.
  c.part();
  c.shape(11, 12, (y) => [C - 6.6 + (12 - y) * 0.2, C + 6.6 - (12 - y) * 0.2], L.band, (_x, y, t) => cyl(t, y === 11 ? 0.5 : -0.1));
  c.ellipse(10.4, 12, 1.4, 1.3, L.band, { bias: -1 });

  // A red-gloved fist raised by his cheek, the forearm taped below it.
  c.part();
  c.capsule(28.4, 34, 26.4, 27, 2.6, 2.1, L.skin);
  c.part();
  c.shape(26, 27, (y) => [24.2 + (y - 26) * 0.3, 28.8 + (y - 26) * 0.3], L.wrap, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  // A fist is boxy: a rounded block, fingers curled toward us across its top.
  const fist = [2.4, 3.3, 3.5, 3.5, 3.5, 3.3, 2.6];
  c.shape(19, 25, (y) => [26 - fist[y - 19], 26 + fist[y - 19]], L.glove, (_x, y, t) => sphere(t * 0.85, (22 - y) / 4, 0.9));
  // The knuckles' crease and the thumb folded across under them.
  for (const x of [24, 26, 28]) {
    c.shade(x, 19, -1);
    c.shade(x, 20, -2);
    c.shade(x, 21, -1);
  }
  c.line(23, 23, 26, 23, L.glove, () => sphere(-0.2, 0.7));
  c.shade(23, 24, -1);
  c.shade(24, 24, -1);
  c.shade(25, 24, -1);
  c.shade(26, 24, -1);
}
