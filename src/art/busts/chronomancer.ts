// The Chronomancer's bust: the timekeeper, an old sage bald under a wine
// skullcap, white tufts at his ears, little brass spectacles and a long white
// beard, in a midnight robe trimmed in brass, his staff's glowing hourglass
// raised beside his head.

import { cyl, sphere, type PixelCanvas } from '../pixel';
import { EYE, SKIN } from '../palette';
import { GLASS, KEEPER_LOOK, STAFF_WOOD } from '../chrono';
import { C, pair, shoulders } from './kit';

export function chronomancerBust(c: PixelCanvas): void {
  const L = KEEPER_LOOK;
  const [core, hot, mid, deep] = L.light;
  // The robe, the wine stole down its front edged in brass.
  shoulders(c, L.robe, 24, 8, 17, 6);
  c.part();
  pair(13, (x, side) => {
    c.shape(26, 33, () => [x - 1, x + 1], L.inner, (_x, _y, t) => cyl(t + side * 0.2, 0.2));
    c.line(x + (side < 0 ? 1 : -1), 26, x + (side < 0 ? 1 : -1), 33, L.trim, () => cyl(side * 0.4));
  });
  // The staff on his left, rising past the head to the hourglass.
  c.part();
  c.line(6, 33, 6, 15, STAFF_WOOD, () => cyl(-0.3));
  c.line(7, 33, 7, 15, STAFF_WOOD, () => cyl(0.5));
  // The hourglass: brass caps, two bulbs of glass pinched in the middle, brass rods.
  c.part();
  for (const y of [14, 5]) c.capsule(4.4, y + 0.5, 8.6, y + 0.5, 0.8, 0.8, L.trim);
  c.part();
  for (const [y, w] of [[13, 1.9], [12, 1.5], [11, 0.9], [10, 0.4], [9, 0.9], [8, 1.5], [7, 1.9]] as const) {
    c.shape(y, y, () => [6.5 - w, 6.5 + w], GLASS, (_x, _y, t) => sphere(t * 0.7, 0, 1));
  }
  c.part();
  for (const x of [4, 9]) c.line(x, 6, x, 13, L.trim, () => cyl(x < 6 ? -0.5 : 0.5));
  // The sand: a glowing heap below, a thread falling, what's left above.
  for (const [x, y, k, col] of [[6, 13, 1, hot], [5, 13, 0.7, mid], [7, 13, 0.7, mid], [6, 12, 0.8, mid], [6, 11, 0.8, core], [6, 10, 0.7, core], [6, 7, 0.5, deep], [5, 7, 0.4, deep], [7, 7, 0.4, deep]] as const) {
    c.spark(x, y, col, k);
  }
  c.spark(6, 14, mid, 0.3);
  // Tufts of white hair over the ears.
  c.part();
  pair(11, (x, side) => c.ellipse(x + 0.5 - side * 0.3, 16, 2.3, 3.4, L.hair));
  // The face: bald on top, a high domed brow.
  c.part();
  c.ellipse(C, 15.2, 5.4, 6.4, SKIN, { flatten: 0.9 });
  // The wine skullcap on the crown, rimmed in brass.
  c.part();
  c.ellipse(C, 9.6, 4.6, 2.6, L.inner, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.5, 1) });
  c.part();
  c.shape(11, 11, () => [C - 4.5, C + 4.5], L.trim, (_x, _y, t) => cyl(t, 0.2));
  c.px(16, 7, L.trim, sphere(-0.2, -0.6));
  // A furrowed brow.
  c.shade(15, 13, -1);
  c.shade(18, 13, -1);
  // The beard from the cheeks to a point on the chest, and the moustache.
  c.part();
  c.shape(17, 31, (y) => {
    const u = (y - 17) / 14;
    const hw = u < 0.2 ? 5.4 + u * 3 : 6.0 * (1 - Math.pow((u - 0.2) / 0.8, 1.5)) + 0.5;
    return [C - hw, C + hw];
  }, L.hair, (_x, _y, t, u) => cyl(t * 0.9, 0.2 + u * 0.3));
  c.line(14, 22, 15, 28, L.hair, () => cyl(-0.5), { bias: -1 });
  c.line(19, 22, 18, 28, L.hair, () => cyl(0.5), { bias: -1 });
  c.part();
  c.shape(18, 19, (y) => (y === 18 ? [C - 3.5, C + 3.5] : [C - 4.5, C + 4.5]), L.hair, (_x, _y, t) => sphere(t, -0.3, 0.8));
  c.shade(16, 19, -1);
  c.shade(17, 19, -1);
  // The nose.
  c.px(16, 17, SKIN, sphere(-0.6, 0.2));
  c.px(17, 17, SKIN, sphere(0.6, -0.4));
  // Little half-moon brass spectacles, a glint on each lens, and bushy white brows above.
  c.part();
  pair(13, (x, side) => {
    const e = x + (side < 0 ? 1 : -1);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1]] as const) c.px(e + dx, 16 + dy, L.trim, sphere(dx * 0.6, dy * 0.6));
    c.px(e, 16, EYE);
    c.spark(e, 16, hot, 0.35);
  });
  c.px(16, 16, L.trim, sphere(0, -0.4));
  c.px(17, 16, L.trim, sphere(0, -0.4));
  pair(12, (x, side) => {
    for (let i = 0; i < 3; i++) c.px(x - side * i, i === 0 ? 13 : 14, L.hair, sphere(0, -0.6));
  });
}
