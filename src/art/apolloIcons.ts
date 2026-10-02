// Button icons for Apollo, the archer's sun-god skin: his gilded bow with a
// little sun at each tip, and his arrow rain falling as shafts of sunlight.
// Drawn over the ranger's icons in gold, 16x16 like the rest.

import { bowIcon, rainIcon, type QuiverColors } from './effects';

/** The gilded bow, its string of sunlight, swan fletching and white-hot heads. */
const SUN_QUIVER: QuiverColors = {
  bow: ['#fff2b0', '#f0cc54', '#8a5c12'],
  string: '#fff0b0',
  fletch: ['#ffffff', '#d4c8a8'],
  head: ['#ffffff', '#ffe080'],
  light: ['#fffbe8', '#ffd860', '#ffa020'],
  ink: '#1c1004',
};

/** Paint (x, y) on a 16x16 icon; `under` only where it's still empty. */
function paint(px: Uint8ClampedArray, x: number, y: number, c: string, under = false): void {
  if (x < 0 || y < 0 || x >= 16 || y >= 16) return;
  const i = (y * 16 + x) * 4;
  if (under && px[i + 3] === 255) return;
  const n = parseInt(c.slice(1), 16);
  px[i] = n >> 16;
  px[i + 1] = (n >> 8) & 255;
  px[i + 2] = n & 255;
  px[i + 3] = 255;
}

/** A little sun at (x, y): a white-hot heart, gold round it, rays out to the sides. */
function sun(px: Uint8ClampedArray, x: number, y: number): void {
  paint(px, x, y, '#ffffff');
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) paint(px, x + dx, y + dy, '#ffd860');
  for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) paint(px, x + dx, y + dy, '#ffa020', true);
}

/** Apollo's attack: the gilded bow drawn, an arrow of light on it, a sun at each tip. */
export function sunBowIcon(): Uint8ClampedArray {
  const px = bowIcon(SUN_QUIVER);
  // The arrow's shaft is light, not wood.
  for (let i = 2; i <= 7; i++) paint(px, 4 + i, 11 - i, '#ffe890');
  sun(px, 3, 3);
  sun(px, 13, 13);
  return px;
}

/** Apollo's Special button: arrows plunging down shafts of sunlight onto the ring, the sun above. */
export function sunRainIcon(): Uint8ClampedArray {
  const px = rainIcon(SUN_QUIVER);
  // Shafts of light behind the arrows, brightest where they meet the ground.
  for (const x of [2, 7, 11]) for (let y = 3; y <= 12; y++) paint(px, x, y, y > 8 ? '#ffe890' : '#ffc840', true);
  sun(px, 14, 1);
  return px;
}
