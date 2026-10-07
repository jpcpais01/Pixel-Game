// The creator's two fonts, from the game's 5x7 glyphs: 'hl_ink', bare
// letters to tint any colour on parchment (the game's own font has a
// near-black outline, too heavy on cream), and 'hl_soft', white letters with
// a soft plum outline for the sky and the rosy buttons. Kept apart from
// creatorArt.ts so the art there can be painted without Phaser (scripts).

import Phaser from 'phaser';
import { Bitmap } from '../../art/bitmap';
import type { RGB } from '../../art/pixel';
import { GLYPHS, GLYPH_H, GLYPH_W } from '../../art/glyphs';
import { rgb } from './creatorArt';

/** Register both fonts (once; they're small and stay for the game's life). */
export function buildCreatorFonts(scene: Phaser.Scene): void {
  const chars = Object.keys(GLYPHS).join('');
  const per = 16;
  const rows = Math.ceil(chars.length / per);
  const glyph = (ch: string) => (GLYPHS[ch] ?? GLYPHS['?']).split(' ').map((r) => [...r].map((c) => c === '#'));
  const make = (name: string, cw: number, ch: number, pad: number, outline: RGB | null) => {
    if (scene.cache.bitmapFont.exists(name)) return;
    const b = new Bitmap(per * cw, rows * ch);
    [...chars].forEach((c, i) => {
      const ox = (i % per) * cw + pad;
      const oy = Math.floor(i / per) * ch + pad;
      const g = glyph(c);
      const on = (x: number, y: number) => y >= 0 && y < GLYPH_H && x >= 0 && x < GLYPH_W && g[y][x];
      for (let y = -1; y <= GLYPH_H; y++) {
        for (let x = -1; x <= GLYPH_W; x++) {
          if (on(x, y)) b.set(ox + x, oy + y, [255, 255, 255]);
          else if (outline && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1))) {
            b.set(ox + x, oy + y, outline);
          }
        }
      }
    });
    const tex = `${name}_img`;
    if (!scene.textures.exists(tex)) scene.textures.addCanvas(tex, b.toCanvas());
    const entry = Phaser.GameObjects.RetroFont.Parse(scene, {
      image: tex,
      width: cw,
      height: ch,
      chars,
      charsPerRow: per,
      'spacing.x': 0,
      'spacing.y': 0,
      'offset.x': 0,
      'offset.y': 0,
      lineSpacing: 2,
    });
    scene.cache.bitmapFont.add(name, entry);
  };
  make('hl_ink', GLYPH_W + 1, GLYPH_H + 1, 0, null);
  make('hl_soft', GLYPH_W + 2, GLYPH_H + 2, 1, rgb(0x7a3f5c));
}
