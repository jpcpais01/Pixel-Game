// The Mystic's bust: the Druid and the Bard in one. A kind face in a hood
// of moss with antlers growing up through it, a mantle hemmed in young leaves
// pinned by a glowing seed, a lute's neck over the shoulder and a firefly.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { EYE, SKIN } from '../palette';
import { ANTLER, BARK, GROVE_HOT, GROVE_MID, LEAF, MOSS, SEED } from '../druid';
import { STRING } from '../bard';
import { ROSE_LIP } from '../valkyrie';
import { C, pair, shoulders } from './kit';

export function mysticBust(c: PixelCanvas): void {
  // Antlers first, so the hood sits in front of their roots.
  pair(6, (x, s) => {
    c.line(x, 5, x + s * 2, 2, ANTLER, () => cyl(-0.3 * s, 0.6));
    c.px(x + s * 2, 4, ANTLER, sphere(-0.3 * s, 0.6));
    c.px(x + s * 3, 4, ANTLER, sphere(-0.3 * s, 0.6));
  });
  // The lute's neck over the left shoulder, its pegs at the top.
  c.part();
  c.line(3, 13, 2, 7, BARK, () => cyl(-0.3, 0.4));
  c.px(2, 6, STRING, sphere(-0.3, 0.4));
  // The mantle of moss, its hem of young leaves.
  c.part();
  shoulders(c, MOSS, 13, 4, 9, 3);
  c.part();
  for (let i = 0; i < 6; i++) c.px(3 + i * 2 + (i > 2 ? 1 : 0), 16 - (i === 0 || i === 5 ? 0 : 1), LEAF, sphere(0, 0.4));
  // The hood: a rounded cowl of moss, peaked on top.
  c.part();
  c.shape(
    3,
    13,
    (y) => {
      const u = (y - 3) / 10;
      const hw = u < 0.5 ? 1.4 + 3.6 * Math.sin((u / 0.5) * Math.PI * 0.5) : 5 + (u - 0.5) * 0.8;
      return [C - hw, C + hw];
    },
    MOSS,
    (_x, _y, t, u) => cyl(t, 0.5 - u * 0.6),
  );
  // Its bark lining round the face.
  c.part();
  c.ellipse(C, 9.8, 3.9, 3.3, BARK, { normal: (_x, _y, dx, dy) => sphere(-dx * 0.6, -dy * 0.6) });
  // The face, round and kind, rosy cheeks.
  c.part();
  c.ellipse(C, 10, 3.3, 2.7, SKIN);
  pair(7, (x) => c.px(x, 10, EYE));
  pair(6, (x) => c.px(x, 11, ROSE_LIP, sphere(0, 0), { bias: 1 }));
  // A fringe of leaves under the hood's rim.
  c.part();
  for (const x of [6.5, 9, 11.5]) c.ellipse(x, 7.6, 1.3, 0.9, LEAF, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.7 - 0.3) });
  // The seed at the throat, pinning the mantle shut, and a firefly by the hood.
  c.part();
  c.px(8, 14, SEED, sphere(-0.3, 0.3), { glow: 0.8 });
  c.px(9, 14, SEED, sphere(0.3, 0.3), { glow: 0.8 });
  c.spark(14.5, 9.5, GROVE_HOT, 0.9);
  c.spark(15.5, 9.5, GROVE_MID, 0.3);
}
