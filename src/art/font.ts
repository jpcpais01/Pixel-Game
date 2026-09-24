// A 5x7 pixel font, drawn from the glyph table below. It becomes a Phaser
// bitmap font ('pixel': white letters with a dark outline, tint to colour)
// and also paints the gold title logo.

import Phaser from 'phaser';
import { Bitmap } from './bitmap';
import { hex, type RGB } from './pixel';

const GLYPHS: Record<string, string> = {
  A: '.###. #...# #...# ##### #...# #...# #...#',
  B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.',
  D: '####. #...# #...# #...# #...# #...# ####.',
  E: '##### #.... #.... ####. #.... #.... #####',
  F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .####',
  H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
  J: '..### ...#. ...#. ...#. #..#. #..#. .##..',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
  L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#',
  N: '#...# #...# ##..# #.#.# #..## #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.',
  P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#',
  R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.###. #...# #.... .###. ....# #...# .###.',
  T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.',
  V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.',
  X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  Z: '##### ....# ...#. ..#.. .#... #.... #####',
  '0': '.###. #...# #..## #.#.# ##..# #...# .###.',
  '1': '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  '2': '.###. #...# ....# ...#. ..#.. .#... #####',
  '3': '####. ....# ....# .###. ....# ....# ####.',
  '4': '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
  '5': '##### #.... ####. ....# ....# #...# .###.',
  '6': '.###. #.... #.... ####. #...# #...# .###.',
  '7': '##### ....# ...#. ..#.. .#... .#... .#...',
  '8': '.###. #...# #...# .###. #...# #...# .###.',
  '9': '.###. #...# #...# .#### ....# ....# .###.',
  ' ': '..... ..... ..... ..... ..... ..... .....',
  '.': '..... ..... ..... ..... ..... .##.. .##..',
  ',': '..... ..... ..... ..... .##.. ..#.. .#...',
  ':': '..... .##.. .##.. ..... .##.. .##.. .....',
  '-': '..... ..... ..... .###. ..... ..... .....',
  '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..',
  '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
  "'": '..#.. ..#.. .#... ..... ..... ..... .....',
  '/': '....# ....# ...#. ..#.. .#... #.... #....',
  '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
  '>': '.#... ..#.. ...#. ....# ...#. ..#.. .#...',
  '<': '...#. ..#.. .#... #.... .#... ..#.. ...#.',
  '(': '...#. ..#.. .#... .#... .#... ..#.. ...#.',
  ')': '.#... ..#.. ...#. ...#. ...#. ..#.. .#...',
  '%': '##..# ##..# ...#. ..#.. .#... #..## #..##',
  // A diamond, used as a bullet.
  '*': '..... ..#.. .###. ##### .###. ..#.. .....',
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** Font cell: the glyph plus a 1px outline on every side. */
export const CELL_W = GLYPH_W + 2;
export const CELL_H = GLYPH_H + 2;

const CHARS = Object.keys(GLYPHS).join('');
const PER_ROW = 16;

function glyph(ch: string): boolean[][] {
  const rows = (GLYPHS[ch] ?? GLYPHS['?']).split(' ');
  return rows.map((r) => [...r].map((c) => c === '#'));
}

/** Register the 'pixel' bitmap font. Letters are white with a near-black outline. */
export function buildPixelFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists('pixel')) return;
  const rows = Math.ceil(CHARS.length / PER_ROW);
  const b = new Bitmap(PER_ROW * CELL_W, rows * CELL_H);
  const white: RGB = [255, 255, 255];
  const ink: RGB = hex('#0b0818');
  [...CHARS].forEach((ch, i) => {
    const ox = (i % PER_ROW) * CELL_W;
    const oy = Math.floor(i / PER_ROW) * CELL_H;
    const g = glyph(ch);
    const on = (x: number, y: number) => y >= 0 && y < GLYPH_H && x >= 0 && x < GLYPH_W && g[y][x];
    for (let y = -1; y <= GLYPH_H; y++) {
      for (let x = -1; x <= GLYPH_W; x++) {
        if (on(x, y)) b.set(ox + 1 + x, oy + 1 + y, white);
        else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1)) {
          b.set(ox + 1 + x, oy + 1 + y, ink);
        }
      }
    }
  });
  scene.textures.addCanvas('pixelfont', b.toCanvas());
  // Parse returns a complete cache entry ({ data, texture, frame }).
  const entry = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: 'pixelfont',
    width: CELL_W,
    height: CELL_H,
    chars: CHARS,
    charsPerRow: PER_ROW,
    'spacing.x': 0,
    'spacing.y': 0,
    'offset.x': 0,
    'offset.y': 0,
    lineSpacing: 1,
  });
  scene.cache.bitmapFont.add('pixel', entry);
}

/**
 * The title logo: chunky gold letters (each font pixel drawn 2x2) with a
 * bright top edge, a dark outline and a 3px extruded base.
 */
export function titleBitmap(text: string): Bitmap {
  const S = 2;
  const GAP = 2;
  const DEPTH = 3;
  const pad = 2;
  const chars = [...text.toUpperCase()];
  const advance = (ch: string) => (ch === ' ' ? 6 : GLYPH_W * S + GAP);
  const textW = chars.reduce((w, ch) => w + advance(ch), 0) - GAP;
  const W = textW + pad * 2;
  const H = GLYPH_H * S + DEPTH + pad * 2;

  // 1 = letter fill.
  const fill = new Uint8Array(W * H);
  let x0 = pad;
  for (const ch of chars) {
    const g = glyph(ch);
    for (let y = 0; y < GLYPH_H; y++) {
      for (let x = 0; x < GLYPH_W; x++) {
        if (!g[y][x]) continue;
        for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) fill[(pad + y * S + sy) * W + x0 + x * S + sx] = 1;
      }
    }
    x0 += advance(ch);
  }
  const at = (a: Uint8Array, x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && a[y * W + x] > 0;

  const ramp = ['#fff4bf', '#fff4bf', '#f4cf6a', '#f4cf6a', '#f4cf6a', '#e6b24c', '#d69a3a', '#d69a3a', '#c07f30', '#b8742c', '#a4632a', '#9a5a26', '#8a4e22', '#7a431e'].map(hex);
  const top = hex('#fffbe8');
  const rim = hex('#3a1a12');
  const extrude = [hex('#5b2f1d'), hex('#43220f'), hex('#2a140f')];
  const outer = hex('#120e1f');

  // Inner outline around the letters.
  const body = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (at(fill, x, y)) body[y * W + x] = 1;
      else if (at(fill, x - 1, y) || at(fill, x + 1, y) || at(fill, x, y - 1) || at(fill, x, y + 1)) body[y * W + x] = 2;
    }
  }
  // Extrude the letters (and their outline) downward.
  const solid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (body[y * W + x]) solid[y * W + x] = 1;
      else for (let d = 1; d <= DEPTH; d++) if (at(body, x, y - d)) { solid[y * W + x] = 1 + d; break; }
    }
  }

  const b = new Bitmap(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = solid[y * W + x];
      if (s === 0) {
        if (at(solid, x - 1, y) || at(solid, x + 1, y) || at(solid, x, y - 1) || at(solid, x, y + 1)) b.set(x, y, outer);
        continue;
      }
      if (s > 1) {
        b.set(x, y, extrude[Math.min(extrude.length - 1, s - 2)]);
      } else if (body[y * W + x] === 2) {
        b.set(x, y, rim);
      } else {
        const row = y - pad;
        b.set(x, y, at(fill, x, y - 1) ? ramp[Math.max(0, Math.min(ramp.length - 1, row))] : top);
      }
    }
  }
  return b;
}
