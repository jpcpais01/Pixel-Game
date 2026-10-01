// The Necromancer's bust: the bonecaller, a gaunt grey face sunk in a deep
// grave-violet hood, two soul-green eyes burning in their sockets, and a
// collar of old bone over the shoulders with a little skull at its clasp.

import { sphere, type PixelCanvas } from '../pixel';
import { BONE } from '../palette';
import { NECRO_LOOK } from '../necromancer';
import { C, pair, shoulders } from './kit';

export function necromancerBust(c: PixelCanvas): void {
  const L = NECRO_LOOK;
  const [core, hot, mid] = L.light;
  // The robe, soul-green trim down its opening.
  shoulders(c, L.robe, 24, 8, 17, 6);
  c.part();
  c.line(15, 27, 15, 33, L.trim, () => sphere(-0.4, 0));
  c.line(18, 27, 18, 33, L.trim, () => sphere(0.4, 0));
  c.shape(27, 33, () => [16, 18], L.inner, () => sphere(0, 0.2));
  // The hood: a deep cowl, its point falling back and to one side.
  c.part();
  c.ellipse(C, 14.8, 8.6, 8.8, L.robe, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.shape(2, 7, (y) => {
    const u = (y - 2) / 5;
    const hw = 0.7 + u * 5;
    const lean = (1 - u) * 2.2;
    return [C - 0.5 + lean - hw, C - 0.5 + lean + hw];
  }, L.robe, (_x, _y, t, u) => sphere(t * 0.8, -0.8 + u * 0.4, 1));
  // Folds gathering at the hood's sides.
  for (let y = 14; y <= 21; y++) {
    c.shade(10, y, -1);
    c.shade(24, y, -1);
  }
  // The hollow of the hood, near black.
  c.part();
  c.ellipse(C, 17.2, 6.0, 6.6, L.inner, { normal: () => sphere(0, 0.2, 1) });
  // The face: long and gaunt, grey, the lower half catching a little light.
  c.part();
  c.shape(13, 23, (y) => {
    const u = (y - 13) / 10;
    const hw = u < 0.45 ? 4.3 : 4.3 - Math.pow((u - 0.45) / 0.55, 1.4) * 2.6;
    return [C - hw, C + hw];
  }, L.skin, (_x, _y, t, u) => sphere(t * 0.85, u * 0.9 - 0.25, 1), { bias: -1 });
  // The hood's shadow over the brow.
  for (let x = 13; x <= 20; x++) {
    c.shade(x, 13, -2);
    c.shade(x, 14, -1);
  }
  // Sunken cheeks under high cheekbones, a hard thin mouth.
  pair(13, (x) => {
    c.shade(x, 19, -1);
    c.shade(x, 20, -1);
  });
  pair(14, (x) => c.shade(x, 18, 1));
  c.px(16, 21, L.inner);
  c.px(17, 21, L.inner);
  c.shade(15, 21, -1);
  c.shade(18, 21, -1);
  c.shade(16, 18, -1);
  c.shade(17, 18, -1);
  // Deep sockets with soul fire burning in them.
  c.part();
  pair(14, (x, side) => {
    c.px(x, 16, L.inner);
    c.px(x + (side < 0 ? -1 : 1), 16, L.inner);
    c.px(x, 15, L.eye, sphere(0, 0), { glow: 1 });
    c.px(x + (side < 0 ? -1 : 1), 15, L.eye, sphere(0.5, 0), { glow: 0.8 });
    c.spark(x, 15, core, 0.6);
    c.spark(x, 14, mid, 0.35);
    c.spark(x, 16, hot, 0.25);
  });
  // The hood's edge in trim, down both sides of the face.
  c.part();
  for (let y = 17; y <= 22; y++) {
    c.px(11, y, L.trim, sphere(-0.4, 0.2));
    c.px(22, y, L.trim, sphere(0.4, 0.2), { bias: -1 });
  }
  // The mantle: a collar of bone plates hung round the neck, sagging to the clasp.
  c.part();
  const n = 9;
  for (let i = 0; i < n; i++) {
    const k = (i / (n - 1)) * 2 - 1;
    const x = C - 0.5 + k * 9;
    const y = 23 + (1 - k * k) * 3.6;
    c.ellipse(x + 0.5, y, 1.2, 2.1, BONE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + k * 0.3, dy * 0.8 - 0.2, 1), bias: i & 1 ? -1 : 0 });
  }
  // The skull at its clasp, its sockets lit.
  c.part();
  c.ellipse(C, 28.8, 2.7, 2.3, BONE);
  c.shape(31, 31, () => [C - 1.6, C + 1.6], BONE, (_x, _y, t) => sphere(t * 0.8, 0.6, 1), { bias: -1 });
  for (const x of [15, 18]) {
    c.px(x, 29, L.inner);
    c.spark(x, 29, hot, 0.9);
  }
  c.px(16, 30, L.inner);
  c.px(17, 30, L.inner);
}
