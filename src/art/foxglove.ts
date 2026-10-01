// Materials, brew colours and button icons for Foxglove, the plague doctor's
// hedge-witch skin. The figure itself is drawn by the alchemist's rig
// (alchemist.ts), switched by its `herbal` flag: a wide straw hat with
// foxglove spikes and a ribbon, a freckled face, a chestnut braid over one
// shoulder, a sage dress with a laced bodice and a linen apron, rolled
// sleeves, a satchel of herbs and tinctures of violet and pink.

import { hex, type Material, type RGB } from './pixel';
import { iconPainter, type BrewColors } from './effects';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** Her dress: soft sage green. */
export const SAGE: Material = { ramp: ramp('#1c3022', '#324e38', '#4a6e4e', '#6a926a', '#92b88c'), outline: hex('#0a140c'), outlineLit: hex('#16241a') };
/** Linen: the apron, the chemise at her neck and her rolled cuffs. */
export const LINEN: Material = { ramp: ramp('#766a56', '#aea286', '#dcd2b6', '#f6f0dc'), outline: hex('#2a2418'), outlineLit: hex('#3e3626') };
/** The straw of her hat, woven. */
export const STRAW: Material = { ramp: ramp('#5a4018', '#8c6a2a', '#c29a46', '#e4c472', '#f8e4a2'), outline: hex('#221806'), outlineLit: hex('#382a0e') };
/** The rose ribbon round the hat, at her waist and tying her braid. */
export const RIBBON: Material = { ramp: ramp('#5e1a3e', '#963060', '#c8508a', '#ec80b0'), outline: hex('#200814') };
/** Chestnut hair. */
export const CHESTNUT: Material = { ramp: ramp('#2a140a', '#4e2814', '#764022', '#a05e32', '#c47e48'), outline: hex('#120804'), outlineLit: hex('#22100a') };
/** Foxglove bells: purple-pink, glowing faintly at night. */
export const PETAL: Material = { ramp: ramp('#521656', '#8c3492', '#c45ec0', '#ee96dc'), outline: hex('#1e061e'), emissive: 0.3 };
/** Stems and leaves. */
export const STEM: Material = { ramp: ramp('#18300e', '#2e5220', '#4a7a30', '#6e9e44'), outline: hex('#0a1406') };
/** Her lips. */
export const LIPS: Material = { ramp: ramp('#7a2a3a', '#a84458', '#cc6676', '#e88c98'), outline: hex('#2a1018'), noAO: true };
/** Freckles: a warm brown dusted over her cheeks. */
export const FRECKLE: Material = { ramp: ramp('#7a4a34', '#9a5e40', '#b2704c'), outline: hex('#2a1418'), noAO: true };
/** Her violet tincture, and the pink one in the vials. */
export const VIOLET_BREW: Material = { ramp: ramp('#4a1a6a', '#8a3ac0', '#c070f0', '#f0c8ff'), outline: hex('#18062a'), emissive: 0.8, noAO: true };
export const PINK_BREW: Material = { ramp: ramp('#7a1a4a', '#c03a80', '#f070b8', '#ffd0ec'), outline: hex('#2a0618'), emissive: 0.8, noAO: true };

/** Foxglove's tincture on the icons and in the bog's fumes. */
export const FOXGLOVE_BREW: BrewColors = {
  ramp: ['#f0c8ff', '#c070f0', '#8a3ac0', '#4a1a6a'],
  surface: '#ff9ad8',
  glint: '#fff0fa',
  bone: ['#f8e8f4', '#c8a8c0', '#2a0e2a'],
  ink: '#16061a',
  fume: ['#ffe0f4', '#f8a0dc', '#c868d0', '#7a3090'],
};

const BELL = ['#ffc8ee', '#f07ad0', '#a83aa8'] as const;
const LEAF = ['#8ec060', '#4e8a3a', '#2a5220'] as const;

/** A foxglove spike on an icon: a stem from (x, y) up `h` px, bells hanging off it in turn, a bud on top. */
function iconSpike(put: (x: number, y: number, c: string) => void, x: number, y: number, h: number): void {
  for (let i = 0; i <= h; i++) put(x, y - i, LEAF[1]);
  for (let i = 1; i < h; i++) {
    const k = i % 2 ? 1 : -1;
    put(x + k, y - i, i < 3 ? BELL[2] : BELL[1]);
    if (i < h - 1) put(x + k, y - i + 1, BELL[0]);
  }
  put(x, y - h - 1, BELL[1]);
}

/** Foxglove's attack: a round flask of violet tincture with a sprig of foxglove tied at its neck in a pink ribbon. */
export function foxFlaskIcon(b: BrewColors = FOXGLOVE_BREW): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const cx = 7;
  const cy = 10.5;
  const r = 4.3;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      if (dy < -1.2) put(x, y, dx + dy < -4 ? '#f4eef8' : '#c0b4d0');
      else {
        const k = dx + dy * 0.6;
        put(x, y, d > r - 1 && k > 1 ? b.ramp[3] : k < -2.2 ? b.ramp[0] : k < 0.6 ? b.ramp[1] : b.ramp[2]);
      }
    }
  }
  for (let x = 4; x <= 10; x++) if (Math.hypot(x + 0.5 - cx, 9 - cy) <= r) put(x, 8, b.surface);
  put(5, 7, '#ffffff');
  // The neck and its cork.
  for (let y = 4; y <= 6; y++) {
    put(6, y, '#c0b4d0');
    put(7, y, '#8a7c9a');
  }
  put(6, 3, '#a9774c');
  put(7, 3, '#7d4f33');
  // The ribbon round the neck, its tails fluttering.
  put(5, 6, '#c8508a');
  put(8, 6, '#c8508a');
  put(9, 7, '#ec80b0');
  outline(b.ink);
  // The sprig leaning out of the knot, over the outline.
  iconSpike(put, 11, 7, 6);
  put(10, 6, LEAF[0]);
  put(12, 7, LEAF[2]);
  return px;
}

/** Foxglove's special: a pink cloud with three foxglove spikes rising out of it and pollen drifting. */
export function foxBogIcon(b: BrewColors = FOXGLOVE_BREW): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const puffs: [number, number, number][] = [
    [4.5, 10.5, 3.6],
    [10.5, 10, 4],
    [7.5, 12, 3.8],
  ];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      let inside = false;
      let lit = -Infinity;
      for (const [px0, py0, rr] of puffs) {
        const dx = x + 0.5 - px0;
        const dy = y + 0.5 - py0;
        if (Math.hypot(dx, dy) <= rr) {
          inside = true;
          lit = Math.max(lit, -(dx + dy) / rr);
        }
      }
      if (!inside || y > 14) continue;
      put(x, y, b.fume[lit > 0.8 ? 0 : lit > 0.1 ? 1 : lit > -0.6 ? 2 : 3]);
    }
  }
  outline(b.ink);
  // The spikes standing up out of the cloud, tallest in the middle.
  iconSpike(put, 4, 9, 5);
  iconSpike(put, 8, 8, 7);
  iconSpike(put, 12, 9, 5);
  // Pollen.
  put(1, 4, '#ffe27a');
  put(14, 3, '#ffe27a');
  put(11, 1, '#fff6c0');
  return px;
}
