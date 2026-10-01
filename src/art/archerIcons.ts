// Button icons for the archer's second and third types: the arbalest's
// crossbow and net bolt, the windrunner's fan of arrows and wind vault.
// 16x16, outlined, lit from the top left like the other ability icons.

import { iconPainter } from './effects';

const INK = '#0c0806';

/** The arbalest's attack: a heavy crossbow seen from above, aimed up and right, a bolt in the groove. */
export function crossbowIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  // The stock, butt at the lower left, swelling towards it.
  const stock = ['#b88050', '#94603a', '#6e4426'];
  for (let i = 0; i <= 9; i++) {
    const x = 2 + i;
    const y = 13 - i;
    put(x, y, stock[i < 3 ? 2 : i < 7 ? 1 : 0]);
    if (i < 4) put(x - 1, y, stock[2]);
    if (i < 3) put(x, y + 1, stock[2]);
  }
  // The steel prod across the nose, its tips bent back by the spanned string.
  const steel = ['#e6eef8', '#a8b4c8', '#5c6880'];
  const prod: [number, number, number][] = [[6, 2, 2], [7, 2, 1], [8, 3, 1], [9, 4, 0], [10, 5, 0], [11, 6, 0], [12, 7, 1], [13, 8, 1], [13, 9, 2]];
  for (const [x, y, c] of prod) put(x, y, steel[c]);
  outline(INK);
  // The string, from each tip back to the nut, and the bolt's broad head past the prod.
  for (const [x, y] of [[7, 3], [7, 4], [7, 5], [7, 6], [12, 9], [11, 9], [10, 9], [9, 8]]) put(x, y, '#d8d0b8');
  put(8, 7, '#a8b4c8');
  for (const [x, y, c] of [[12, 3, 0], [13, 2, 0], [13, 3, 1], [12, 2, 1]] as const) put(x, y, steel[c]);
  put(6, 9, '#e8664a');
  put(5, 9, '#9e2725');
  return px;
}

/** The arbalest's ability: a weighted net spread over the ground, its diamond mesh and lead weights, a bolt plunging into its middle. */
export function netBoltIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const cx = 8;
  const cy = 10;
  const inside = (x: number, y: number, k = 1) => ((x + 0.5 - cx) / (7 * k)) ** 2 + ((y + 0.5 - cy) / (4.6 * k)) ** 2 <= 1;
  // The rim cord first, outlined, so the open mesh inside stays open.
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (inside(x, y) && !inside(x, y, 0.8)) put(x, y, '#ae904e');
  outline(INK);
  // The mesh: cords crossing on the diagonals, lit towards the top left.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!inside(x, y, 0.86)) continue;
      if ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0) put(x, y, x + y < 17 ? '#e0c888' : '#ae904e');
    }
  }
  // Lead weights round its rim.
  for (let a = 0; a < 8; a++) {
    const th = (a / 8) * Math.PI * 2 + 0.2;
    put(Math.round(cx - 0.5 + Math.cos(th) * 7), Math.round(cy - 0.5 + Math.sin(th) * 4.6), '#5c6478');
  }
  // The bolt, coming down from the upper right into its middle.
  for (let i = 0; i < 6; i++) put(14 - i, 1 + i, i < 2 ? '#e8664a' : '#94603a');
  put(8, 7, '#e6eef8');
  put(7, 8, '#ffffff');
  return px;
}

/** The windrunner's attack: three arrows fanning out from a single nock, up and right. */
export function fanShotIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const shaft = '#a8b8c8';
  const heads = ['#e8fffa', '#82f2e0'];
  const ox = 2;
  const oy = 13;
  for (const a of [-0.5, 0, 0.5]) {
    const th = -Math.PI / 4 + a;
    const ux = Math.cos(th);
    const uy = Math.sin(th);
    const at = (r: number, o = 0) => [Math.round(ox + ux * r - uy * o), Math.round(oy + uy * r + ux * o)] as const;
    for (let r = 1.5; r <= 9; r += 0.5) put(...at(r), shaft);
    // A leaf-shaped head, bright on its upper edge.
    put(...at(11), heads[0]);
    put(...at(10), heads[0]);
    put(...at(9.5, -0.9), heads[0]);
    put(...at(9.5, 0.9), heads[1]);
    // White fletching at the nock.
    put(...at(0.5, -0.9), '#e0ecf2');
    put(...at(0.5, 0.9), '#e0ecf2');
  }
  outline('#08141a');
  // A breath of wind behind them.
  for (const [x, y] of [[1, 9], [2, 8], [3, 8], [5, 15], [6, 14], [7, 14]]) put(x, y, '#a2f4e6');
  return px;
}

/** The windrunner's ability: a figure leaping back in an arc of wind, a gale arrow streaking ahead. */
export function vaultIcon(): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  // The arc of the leap, from lower right up and over to the left.
  const wind = ['#f0fffb', '#a2f4e6', '#4ac2ba'];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = 13 - t * 10;
    const y = 13 - Math.sin(t * Math.PI) * 9;
    put(Math.round(x), Math.round(y), wind[t < 0.35 ? 2 : t < 0.7 ? 1 : 0]);
    if (i % 3 === 0) put(Math.round(x), Math.round(y) + 1, wind[2]);
  }
  outline('#08141a');
  // The gale arrow loosed from the top of the leap, flying right.
  for (let x = 6; x <= 14; x++) put(x, 6, x > 12 ? '#e8fffa' : '#a8b8c8');
  put(14, 5, '#82f2e0');
  put(14, 7, '#82f2e0');
  put(15, 6, '#ffffff');
  for (const [x, y] of [[7, 4], [9, 4], [11, 8], [9, 8]]) put(x, y, wind[1]);
  return px;
}
