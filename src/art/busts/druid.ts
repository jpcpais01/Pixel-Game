// The Druid's bust: the Grovekeeper, a kind face in a hood of moss with
// antlers growing up through it, a mantle hemmed in young leaves pinned by a
// glowing seed, and a firefly or two drifting by.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { EYE, SKIN } from '../palette';
import { ANTLER, BARK, GROVE_HOT, GROVE_MID, LEAF, MOSS, SEED } from '../druid';
import { ROSE_LIP } from '../valkyrie';
import { C, pair, shoulders } from './kit';

export function druidBust(c: PixelCanvas): void {
  // Antlers first, so the hood sits in front of their roots.
  pair(12, (x, s) => {
    const o = (dx: number) => x - dx * s;
    c.line(o(0), 9, o(-2), 5, ANTLER, () => cyl(-0.3 * s, 0.6));
    c.line(o(-2), 5, o(-3), 2, ANTLER, () => cyl(-0.3 * s, 0.7));
    c.line(o(-1), 7, o(-5), 6, ANTLER, () => sphere(-0.2 * s, 0.6));
    c.px(o(-6), 5, ANTLER, sphere(-0.3 * s, 0.6));
    c.line(o(-2), 4, o(-1), 2, ANTLER, () => sphere(0.2 * s, 0.6));
  });
  // The mantle of moss over the shoulders.
  c.part();
  shoulders(c, MOSS, 23, 8, 17, 6);
  // The hood: a rounded cowl of moss, a little peaked on top.
  c.part();
  c.shape(
    5,
    25,
    (y) => {
      const u = (y - 5) / 20;
      const hw = u < 0.45 ? 2 + 7.6 * Math.sin((u / 0.45) * Math.PI * 0.5) : 9.6 - (u - 0.45) * 4;
      return [C - hw, C + hw];
    },
    MOSS,
    (_x, _y, t, u) => cyl(t, 0.5 - u * 0.6),
  );
  // Its dark bark lining round the face.
  c.part();
  c.ellipse(C, 16.8, 6.8, 7.4, BARK, { normal: (_x, _y, dx, dy) => sphere(-dx * 0.6, -dy * 0.6, 1) });
  // The face, round and young.
  c.part();
  c.ellipse(C, 17.4, 5.6, 5.8, SKIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.55, dy * 0.6, 1) });
  // A fringe of leaves under the hood's rim, over the brow.
  c.part();
  for (const [x, y] of [[12, 12.2], [14.5, 11.4], [17, 11.1], [19.5, 11.4], [22, 12.2]] as const)
    c.ellipse(x, y, 1.6, 1.1, LEAF, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.7 - 0.3, 1) });
  // Eyes, gently curved like a smile, a soft blush and a small smile.
  c.part();
  pair(14, (x) => {
    c.px(x, 16, EYE);
    c.px(x, 17, EYE);
  });
  // Brows of bark, soft and level.
  pair(13, (x, s) => c.line(x, 14, x - s, 14, BARK, () => sphere(0, 0.5)));
  // Rosy cheeks.
  pair(12, (x) => c.px(x, 19, ROSE_LIP, sphere(0, 0), { bias: 1 }));
  c.px(16, 18, SKIN, sphere(-0.6, 0.2));
  c.px(17, 18, SKIN, sphere(0.7, -0.5));
  // A small smile.
  pair(15, (x) => c.px(x, 20, SKIN, sphere(0, -0.5), { bias: -1 }));
  c.px(16, 21, SKIN, sphere(0, -0.5), { bias: -2 });
  c.px(17, 21, SKIN, sphere(0, -0.5), { bias: -2 });
  // Moss tufts and a leaf or two on the hood.
  c.shade(11, 8, 1);
  c.shade(22, 9, 1);
  c.px(10, 10, LEAF, sphere(-0.4, 0.5));
  c.px(24, 14, LEAF, sphere(0.3, 0.4));
  // The mantle's hem of young leaves, low on the chest.
  c.part();
  for (let i = 0; i < 8; i++) {
    const x = 3 + i * 4;
    const y = 29.5 - Math.sin((i / 7) * Math.PI) * 2;
    c.ellipse(x, y, 2.1, 1.5, LEAF, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.2, 1) });
  }
  // The seed at the throat, pinning the mantle shut.
  c.part();
  c.ellipse(C, 26, 1.6, 1.6, SEED);
  // Fireflies in the air.
  for (const [x, y, a] of [[27, 19, 1], [6, 21, 0.8], [28, 9, 0.6]] as const) {
    c.spark(x, y, GROVE_HOT, a);
    c.spark(x - 1, y, GROVE_MID, a * 0.4);
    c.spark(x + 1, y, GROVE_MID, a * 0.4);
    c.spark(x, y - 1, GROVE_MID, a * 0.4);
    c.spark(x, y + 1, GROVE_MID, a * 0.4);
  }
}
