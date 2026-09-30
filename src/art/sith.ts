// Materials and button icons for the Sith (the Jedi class's dark-side type)
// and for two skins: the Sith's Warlord and the Jedi knight's Grand Master.
// The figures are drawn by the Jedi's rig (jedi.ts), switched by look flags:
// `staff` gives the Sith its double-bladed saber and its own moves.

import { blade } from './palette';
import { hex, type Material, type RGB } from './pixel';
import type { IconColors } from './effects';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------------------
// The Warlord (the Sith's skin): a horned, bare-headed dark-side reaver. Red
// skin under black tattoos, a crown of short ivory horns, gloves and leathers
// in black and old blood, and a saberstaff burning orange-red.

export const WARLORD_SKIN: Material = {
  ramp: ramp('#3a0a0e', '#661418', '#961f22', '#c2302c', '#e0503f'),
  outline: hex('#1a0406'),
  outlineLit: hex('#34090c'),
};

/** The tattoos: near-black ink over the red. */
export const WARLORD_INK: Material = {
  ramp: ramp('#050304', '#0d090b', '#171114'),
  outline: hex('#030203'),
};

export const HORN: Material = {
  ramp: ramp('#4e4032', '#85725a', '#b6a486', '#ddd2b8', '#f8f2e2'),
  outline: hex('#1e160c'),
  outlineLit: hex('#3a2e20'),
  shine: true,
};

/** Dark leathers, brown-black. */
export const WARLORD_ROBE: Material = {
  ramp: ramp('#0a0707', '#171010', '#251a18', '#362622', '#4c3530'),
  outline: hex('#040202'),
  outlineLit: hex('#1c1210'),
};

export const WARLORD_TUNIC: Material = {
  ramp: ramp('#08060a', '#121014', '#1d1a20', '#2a262e'),
  outline: hex('#030203'),
};

/** Old blood: the sash and the robe's edges. */
export const WARLORD_TRIM: Material = {
  ramp: ramp('#34060a', '#5e0c12', '#8e161a', '#c02a26', '#e2483a'),
  outline: hex('#140204'),
};

export const WARLORD_GLOVE: Material = {
  ramp: ramp('#050405', '#0e0c0f', '#19161a', '#262228'),
  outline: hex('#020102'),
};

export const SABER_EMBER = blade(['#ffe6d4', '#fff8f0'], ['#b01c08', '#e8380e', '#ff7a36']);
export const SABER_EMBER_GLOW = hex('#ff3a14');

// ---------------------------------------------------------------------------
// The Grand Master (the Jedi knight's skin): an old master of the order, white
// hair swept back and a long white beard, in indigo robes edged with silver
// over pale linen, and a saber of green light.

export const MASTER_ROBE: Material = {
  ramp: ramp('#0b0f22', '#161e3c', '#243058', '#34467c', '#4c62a2'),
  outline: hex('#05070f'),
  outlineLit: hex('#131a32'),
};

export const MASTER_TUNIC: Material = {
  ramp: ramp('#5a564e', '#8a8478', '#b8b2a2', '#dfd9c8'),
  outline: hex('#1c1a16'),
  outlineLit: hex('#34312a'),
};

/** White hair and beard, with a cool grey in the shade. */
export const MASTER_WHITE: Material = {
  ramp: ramp('#5e606c', '#8e909c', '#bcbec8', '#e2e3ea', '#ffffff'),
  outline: hex('#24252c'),
  outlineLit: hex('#3e4048'),
};

export const MASTER_TRIM: Material = {
  ramp: ramp('#343a4a', '#636d82', '#a0aabd', '#d6deec', '#ffffff'),
  outline: hex('#12141c'),
  shine: true,
};

export const SABER_GREEN = blade(['#dcffe0', '#f4fff4'], ['#0e9a36', '#2ed058', '#86f09a']);
export const SABER_GREEN_GLOW = hex('#2ee05a');

// ---------------------------------------------------------------------------
// Button icons (16x16), drawn additively like the Jedi's (see effects.ts).

type Px = { px: Uint8ClampedArray; add: (x: number, y: number, c: RGB, a?: number) => void };

function icon(): Px {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const add = (x: number, y: number, c: RGB, a = 1) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    px[i] = Math.min(255, px[i] + c[0] * a);
    px[i + 1] = Math.min(255, px[i + 1] + c[1] * a);
    px[i + 2] = Math.min(255, px[i + 2] + c[2] * a);
    px[i + 3] = 255;
  };
  return { px, add };
}

const hash = (a: number, b: number, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const CHROME: RGB = [200, 208, 224];
const GRIP: RGB = [70, 72, 86];

/** The Sith's attack: a saberstaff across the button, a blade of light out of each end of a long hilt. */
export function staffIcon(cols: IconColors): Uint8ClampedArray {
  const { px, add } = icon();
  // The hilt runs from (6, 9) to (9, 6); the blades carry on either way to the corners.
  for (let i = 0; i < 6; i++) {
    const hx = 6 + i * 0.6;
    const hy = 9.6 - i * 0.6;
    add(hx, hy, i === 0 || i === 5 ? CHROME : GRIP, i === 0 || i === 5 ? 0.9 : 0.8);
  }
  add(7, 8, CHROME, 0.5);
  add(8, 7, CHROME, 0.5);
  const bladeRun = (x0: number, y0: number, dx: number, dy: number) => {
    for (let i = 0; i < 6; i++) {
      const x = x0 + dx * i;
      const y = y0 + dy * i;
      add(x, y, cols[0]);
      add(x + 1, y, cols[1], 0.85);
      add(x, y - 1, cols[1], 0.85);
      add(x + 1, y + 1, cols[3], 0.35);
      add(x - 1, y - 1, cols[3], 0.35);
    }
  };
  bladeRun(10, 5, 1, -1);
  bladeRun(5, 10, -1, 1);
  return px;
}

/** The Sith's ability: a clawed hand at the lower left, forked lightning pouring out of it to the upper right. */
export function lightningIcon(cols: IconColors, hand: RGB = [150, 140, 170]): Uint8ClampedArray {
  const { px, add } = icon();
  // Three bolts, each a zigzag with a white heart and a coloured fringe.
  const bolts: [number, number][][] = [
    [[4, 11], [7, 8], [6, 6], [10, 4], [9, 2], [13, 0]],
    [[4, 11], [8, 9], [9, 7], [12, 7], [13, 5], [15, 4]],
    [[4, 11], [7, 11], [9, 10], [11, 11], [13, 9], [15, 10]],
  ];
  bolts.forEach((pts, b) => {
    for (let s = 0; s < pts.length - 1; s++) {
      const [x0, y0] = pts[s];
      const [x1, y1] = pts[s + 1];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const y = y0 + ((y1 - y0) * i) / n;
        add(x, y, b === 0 ? cols[0] : cols[1], b === 0 ? 1 : 0.9);
        add(x + 1, y, cols[2], 0.5);
        if (hash(Math.round(x), Math.round(y), b) > 0.55) add(x, y + 1, cols[3], 0.6);
      }
    }
  });
  // The hand: a palm with hooked fingers reaching out, lit by what it pours.
  for (const [x, y] of [[1, 12], [2, 12], [1, 13], [2, 13], [3, 13], [2, 14], [1, 14], [0, 15], [1, 15]] as const) add(x, y, hand, 0.8);
  for (const [x, y] of [[3, 10], [4, 9], [3, 12], [4, 12], [2, 10], [2, 11]] as const) add(x, y, hand, 0.65);
  add(4, 11, cols[0]);
  add(3, 11, cols[1], 0.9);
  add(5, 11, cols[1], 0.7);
  add(4, 10, cols[2], 0.6);
  return px;
}

// The Sith's lightning and saber in its own colours, and the Warlord's.
export const SITH_STAFF_ICON: IconColors = [hex('#fff6f2'), hex('#ff6a62'), hex('#f0283a'), hex('#c81628')];
export const SITH_BOLT_ICON: IconColors = [hex('#fbf6ff'), hex('#d6b8ff'), hex('#9a6cff'), hex('#4a2a9a')];
export const WARLORD_STAFF_ICON: IconColors = [hex('#fff8f0'), hex('#ffa060'), hex('#ec3a10'), hex('#a01806')];
export const WARLORD_BOLT_ICON: IconColors = [hex('#fff4ee'), hex('#ffa08a'), hex('#ff3a2a'), hex('#8a0a14')];
export const MASTER_SABER_ICON: IconColors = [hex('#f4fff4'), hex('#8af09a'), hex('#2ed058'), hex('#0e9a36')];
export const MASTER_FORCE_ICON: IconColors = [hex('#ffffff'), hex('#dcffe4'), hex('#8ee8a4'), hex('#2e8a4e')];
