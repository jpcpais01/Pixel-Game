// Materials, brew colours and button icons for Carnevale, the plague doctor's
// Venetian carnival skin. The figure is drawn by the alchemist's rig
// (alchemist.ts), switched by its `carnival` flag: a gilded medico mask with
// painted swirls, a black tricorn laced in gold under tall plumes, a
// harlequin coat of crimson and black diamonds, a white ruff at the throat,
// white kid gloves and flasks of magenta brew tied with ribbons.

import { hex, type Material, type RGB } from './pixel';
import { iconPainter, type BrewColors } from './effects';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** The crimson diamonds of the harlequin coat, and its sleeves. */
export const CRIMSON: Material = { ramp: ramp('#2a0610', '#56101e', '#8c1a2c', '#c02a3a', '#e8546a'), outline: hex('#120206'), outlineLit: hex('#24060c') };
/** Black velvet: the coat's other diamonds, the tricorn, the cape and the belt. */
export const VELVET: Material = { ramp: ramp('#08060a', '#16101a', '#261c2a', '#3a2c40', '#544660'), outline: hex('#020103'), outlineLit: hex('#0e0a10') };
/** Gilt: the mask, the hat's lace, the flasks' caps. */
export const GILT: Material = { ramp: ramp('#5a3a0c', '#9a6a1a', '#d0a030', '#f0d060', '#fff4b0'), outline: hex('#1e1204'), outlineLit: hex('#3a2408'), shine: true };
/** The starched ruff, and the white plume. */
export const RUFF: Material = { ramp: ramp('#7c7884', '#b4b0bc', '#e0dce6', '#fcfaff'), outline: hex('#26222c'), outlineLit: hex('#3a3644') };
/** White kid gloves. */
export const KID: Material = { ramp: ramp('#6e6458', '#aaa090', '#d8d0c0', '#f6f0e4'), outline: hex('#24201a') };
/** The crimson plume, a shade brighter than the coat. */
export const PLUME: Material = { ramp: ramp('#4a0816', '#8a1428', '#cc2a44', '#f4607a', '#ffa0b0'), outline: hex('#1a0208') };
/** Paint on the mask: the swirls round its eyes and down the beak. */
export const MASK_PAINT: Material = { ramp: ramp('#3a0418', '#6a0a2a', '#9a1640', '#c42a58'), outline: hex('#1a0208'), noAO: true };
/** The ribbons tied round the flasks' necks. */
export const RIBBON_MAGENTA: Material = { ramp: ramp('#5a0a48', '#9a1a7c', '#d83aaa', '#ff7ad4'), outline: hex('#20041a') };
/** The lenses behind the mask: glowing magenta. */
export const MASK_EYE: Material = { ramp: ramp('#6a0a50', '#c02a98', '#ff6ad8', '#ffe0f6'), outline: hex('#24021c'), emissive: 0.9, noAO: true };
/** The brew: magenta shot with gold. */
export const CARNIVAL_BREW: Material = { ramp: ramp('#5a0a4a', '#b01a8a', '#f04ac8', '#ffd0f2'), outline: hex('#20041a'), emissive: 0.8, noAO: true };

/** Confetti colours, for the sparkles round a boiling flask. */
export const CONFETTI: RGB[] = [hex('#ffd860'), hex('#ff6ad8'), hex('#6ae0ff'), hex('#fff4d0')];

/** Carnevale's brew on the icons and in the bog's fumes. */
export const CARNIVAL_BREW_COLORS: BrewColors = {
  ramp: ['#ffd0f2', '#f04ac8', '#b01a8a', '#5a0a4a'],
  surface: '#ff8ae0',
  glint: '#fff0fa',
  bone: ['#fff0b0', '#d0a030', '#3a0418'],
  ink: '#16040f',
  fume: ['#ffd8f4', '#f88ad8', '#d04ab0', '#7a1a6a'],
};

const GOLD_ICON = ['#fff4b0', '#f0d060', '#d0a030', '#9a6a1a'] as const;
const DOTS = ['#ffd860', '#ff6ad8', '#6ae0ff', '#fff4d0'] as const;

/** Carnevale's attack: a round flask of magenta brew with a gilt cap, ribbons streaming from its neck, confetti round it. */
export function carnFlaskIcon(b: BrewColors = CARNIVAL_BREW_COLORS): Uint8ClampedArray {
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
      if (dy < -1.2) put(x, y, dx + dy < -4 ? '#f8eef6' : '#c8b4c8');
      else {
        const k = dx + dy * 0.6;
        put(x, y, d > r - 1 && k > 1 ? b.ramp[3] : k < -2.2 ? b.ramp[0] : k < 0.6 ? b.ramp[1] : b.ramp[2]);
      }
    }
  }
  for (let x = 4; x <= 10; x++) if (Math.hypot(x + 0.5 - cx, 9 - cy) <= r) put(x, 8, b.surface);
  put(5, 7, '#ffffff');
  // Flecks of gold leaf swirling in the brew.
  put(8, 11, GOLD_ICON[0]);
  put(6, 12, GOLD_ICON[1]);
  // The neck, and its gilt cap.
  for (let y = 4; y <= 6; y++) {
    put(6, y, '#c8b4c8');
    put(7, y, '#8a7490');
  }
  put(5, 3, GOLD_ICON[1]);
  put(6, 3, GOLD_ICON[0]);
  put(7, 3, GOLD_ICON[2]);
  put(8, 3, GOLD_ICON[3]);
  put(6, 2, GOLD_ICON[1]);
  put(7, 2, GOLD_ICON[2]);
  outline(b.ink);
  // Ribbons streaming from the neck, magenta and gold, over the outline.
  for (const [x, y, c] of [[8, 6, '#d83aaa'], [9, 5, '#ff7ad4'], [10, 5, '#d83aaa'], [11, 4, '#ff7ad4'], [12, 4, '#9a1a7c'], [9, 7, GOLD_ICON[1]], [10, 7, GOLD_ICON[0]], [11, 8, GOLD_ICON[2]], [12, 8, GOLD_ICON[1]]] as const) put(x, y, c);
  // Confetti.
  put(13, 1, DOTS[2]);
  put(2, 3, DOTS[0]);
  put(14, 11, DOTS[1]);
  put(11, 14, DOTS[0]);
  return px;
}

/** Carnevale's special: a magenta cloud with a gilded half-mask staring out of it, confetti falling. */
export function carnBogIcon(b: BrewColors = CARNIVAL_BREW_COLORS): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const puffs: [number, number, number][] = [
    [5, 8.5, 4],
    [10.5, 7.5, 4.6],
    [8, 11, 4.2],
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
  // The half-mask: a gilt band with upswept tips, two eye holes, a crimson swirl.
  const mask: [number, number, number][] = [
    [3, 6, 1], [4, 7, 1], [5, 7, 0], [6, 7, 0], [7, 8, 0], [8, 8, 1], [9, 7, 1], [10, 7, 1], [11, 7, 2], [12, 6, 2],
    [4, 8, 1], [5, 8, 1], [6, 8, 1], [9, 8, 2], [10, 8, 2], [11, 8, 2],
    [5, 9, 2], [6, 9, 2], [7, 9, 1], [8, 9, 2], [9, 9, 3], [10, 9, 3],
  ];
  for (const [x, y, k] of mask) put(x, y, GOLD_ICON[k]);
  put(5, 8, '#16040f');
  put(10, 8, '#16040f');
  put(6, 8, '#ff6ad8');
  put(9, 8, '#ff6ad8');
  outline(b.ink);
  put(3, 5, '#cc2a44');
  put(12, 5, '#cc2a44');
  // Confetti.
  for (const [x, y, k] of [[2, 1, 0], [6, 0, 1], [13, 2, 2], [1, 12, 3], [14, 13, 0], [9, 3, 2]] as const) put(x, y, DOTS[k]);
  return px;
}
