// What every class bust shares: the round class medallions on the character
// select show a head and shoulders drawn for them, at the heroes' own pixel
// size and shown at the same 2x as the sprite heads on the character cards,
// so they read as the game's sprites: a face about 8 px wide, 1 px eyes, a
// few tones a material and a dark outline, rather than a finer portrait.
//
// A bust is drawn on a BUST x BUST canvas with the same engine and the same
// materials as its hero (lit from the top left, outlined, contact shadows),
// and is seen through a disc of radius R round (C, C): keep the hat tips,
// ears and horns inside it, and let the shoulders run off its bottom.

import { PixelCanvas, cyl, type Material } from '../pixel';

/** The bust's canvas, and the disc it is shown through. */
export const BUST = 18;
/** The middle of the disc. */
export const C = BUST / 2;
/** The disc's radius: the medallion's face is a pixel narrower than the canvas. */
export const R = 8.5;

export type BustPainter = (c: PixelCanvas) => void;

/**
 * Shoulders and chest, from `top` (the neckline) down past the canvas,
 * widening from `neck` to `wide` half-widths over `drop` rows and rounded
 * like a body.
 */
export function shoulders(c: PixelCanvas, m: Material, top: number, neck = 4, wide = 9, drop = 3, cx = C): void {
  c.shape(
    top,
    BUST - 1,
    (y) => {
      const t = Math.min(1, (y - top + 0.5) / drop);
      const hw = neck + (wide - neck) * Math.sqrt(t);
      return [cx - hw, cx + hw];
    },
    m,
    (_x, _y, t, u) => cyl(t, 0.3 - u * 0.3),
  );
}

/** Mirror a pair of features about the middle: draws at x and at its reflection. */
export function pair(x: number, draw: (x: number, side: -1 | 1) => void, cx = C): void {
  draw(x, -1);
  draw(2 * cx - 1 - x, 1);
}
