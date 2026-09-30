// A boss's title card, painted when it first makes its entrance (see
// game/BossIntro.ts): its name in big bevelled letters coloured like the boss,
// and a gilded divider with a gem of the boss's colour at its heart.

import { Bitmap, bayer, mix } from './bitmap';
import { hex, type RGB } from './pixel';
import { GLYPHS, GLYPH_H, GLYPH_W } from './glyphs';

/** A boss's colours for its title: bright, body and deep. */
export interface TitleColours {
  light: RGB;
  mid: RGB;
  dark: RGB;
}

const INK = hex('#0b0818');
const WHITE: RGB = [255, 255, 255];
/** The divider's gilt, brightest first. */
const GILT = [hex('#fff4bf'), hex('#f4cf6a'), hex('#d69a3a'), hex('#8a4e22')];

const glyph = (ch: string): string[] => (GLYPHS[ch] ?? GLYPHS['?']).split(' ');

/** The width of `text` in title letters `s` pixels to a font pixel. */
export function titleWidth(text: string, s: number): number {
  const gap = s;
  return [...text].reduce((w, ch) => w + (ch === ' ' ? GLYPH_W * s - s : GLYPH_W * s + gap), 0) - gap + 4;
}

/**
 * The boss's name: each font pixel drawn `s` x `s`, lit from above in the
 * boss's colours (a white rim along every top edge, a bright band high in
 * the letter, deepening to its dark at the foot, in clean steps), inside a
 * dark rim, standing on a short extruded base, all in an ink outline.
 */
export function titleBitmap(text: string, c: TitleColours, s: number): Bitmap {
  const DEPTH = s + 1;
  const pad = 2;
  const chars = [...text.toUpperCase()];
  const W = titleWidth(text, s);
  const H = GLYPH_H * s + DEPTH + pad * 2;
  const fill = new Uint8Array(W * H);
  let x0 = pad;
  for (const ch of chars) {
    if (ch === ' ') {
      x0 += GLYPH_W * s - s;
      continue;
    }
    const rows = glyph(ch);
    for (let y = 0; y < GLYPH_H; y++) {
      for (let x = 0; x < GLYPH_W; x++) {
        if (rows[y][x] !== '#') continue;
        for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) fill[(pad + y * s + sy) * W + x0 + x * s + sx] = 1;
      }
    }
    x0 += GLYPH_W * s + s;
  }
  const at = (a: Uint8Array, x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && a[y * W + x] > 0;

  // The letter's own rim, then the base extruded under letter and rim alike.
  const body = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (at(fill, x, y)) body[y * W + x] = 1;
      else if (at(fill, x - 1, y) || at(fill, x + 1, y) || at(fill, x, y - 1) || at(fill, x, y + 1)) body[y * W + x] = 2;
    }
  }
  const solid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (body[y * W + x]) solid[y * W + x] = 1;
      else for (let d = 1; d <= DEPTH; d++) if (at(body, x, y - d)) { solid[y * W + x] = 1 + d; break; }
    }
  }

  // Tones down the letter, dithered from one to the next.
  const tones: RGB[] = [mix(c.light, WHITE, 0.5), c.light, mix(c.light, c.mid, 0.5), c.mid, mix(c.mid, c.dark, 0.45), c.dark];
  const rim = mix(c.dark, INK, 0.6);
  const base = [mix(c.dark, INK, 0.35), mix(c.dark, INK, 0.55), mix(c.dark, INK, 0.72), mix(c.dark, INK, 0.85)];
  const rowsH = GLYPH_H * s;
  const b = new Bitmap(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = solid[y * W + x];
      if (v === 0) {
        if (at(solid, x - 1, y) || at(solid, x + 1, y) || at(solid, x, y - 1) || at(solid, x, y + 1)) b.set(x, y, INK);
        continue;
      }
      if (v > 1) b.set(x, y, base[Math.min(base.length - 1, v - 2)]);
      else if (body[y * W + x] === 2) b.set(x, y, rim);
      else if (!at(fill, x, y - 1)) {
        // A white rim along each top edge; the very corner of a stroke catches a glint.
        b.set(x, y, !at(fill, x - 1, y) ? WHITE : mix(c.light, WHITE, 0.7));
      } else {
        // Bright high in the letter (a polished band just above the middle), deep at the foot.
        const t = (y - pad) / (rowsH - 1);
        const band = Math.abs(t - 0.38) < 0.07 ? -1.1 : 0;
        const f = Math.max(0, Math.min(tones.length - 1, 1 + t * (tones.length - 1.6) + band));
        b.set(x, y, tones[Math.round(f)]);
      }
    }
  }
  return b;
}

/**
 * The divider under the name: a gilt line that thins away to nothing at both
 * ends (dithered out), a cut gem of the boss's colour at its heart and a
 * little one either side. A Myth's has a second, shorter line above and
 * below, and a larger gem with points reaching out along the line.
 */
export function dividerBitmap(w: number, c: TitleColours, myth: boolean): Bitmap {
  const H = myth ? 15 : 11;
  const cy = Math.floor(H / 2);
  const cx = Math.floor(w / 2);
  const b = new Bitmap(w, H);
  const R = myth ? 5 : 4;
  const line = (y: number, reach: number, lit: boolean) => {
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x - cx) / reach;
      if (d > 1 || Math.abs(x - cx) <= R + 1) continue;
      // Thins away toward the ends.
      if (bayer(x, y) > Math.pow(1 - d, 0.35) * 1.5) continue;
      b.set(x, y, lit ? GILT[d < 0.4 ? 0 : d < 0.75 ? 1 : 2] : GILT[2]);
      b.set(x, y + 1, mix(GILT[3], INK, 0.4));
    }
  };
  line(cy, w / 2, true);
  if (myth) {
    line(cy - 3, w * 0.3, false);
    line(cy + 3, w * 0.3, false);
    // Points of gilt reaching out from the gem along the line.
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const x = cx + sx * (R + 1 + i);
        const hgt = 2 - Math.floor(i / 2);
        for (let dy = -hgt; dy <= hgt; dy++) b.set(x, cy + dy, dy === -hgt ? GILT[0] : GILT[1]);
      }
    }
  }
  const gem = (gx: number, r: number) => {
    for (let dy = -r - 1; dy <= r + 1; dy++) {
      for (let dx = -r - 1; dx <= r + 1; dx++) {
        const m = Math.abs(dx) + Math.abs(dy);
        if (m === r + 1) b.set(gx + dx, cy + dy, INK);
        else if (m === r) b.set(gx + dx, cy + dy, GILT[dy < 0 || (dy === 0 && dx < 0) ? 0 : 2]);
        else if (m < r) {
          // Cut facets: bright upper left, deep lower right, a glint near the top.
          const shade = dx + dy < 0 ? c.light : dx + dy > 0 ? c.dark : c.mid;
          b.set(gx + dx, cy + dy, dx === -1 && dy === -Math.max(1, r - 2) ? WHITE : shade);
        }
      }
    }
  };
  gem(cx, R);
  if (w > 60) for (const sx of [-1, 1]) gem(Math.round(cx + sx * w * 0.3), 1);
  return b;
}

/** A dark band behind the card, strongest at its middle row and fading away above and below. One pixel wide: it is stretched across the screen. */
export function bandBitmap(h: number): Bitmap {
  const b = new Bitmap(1, h);
  for (let y = 0; y < h; y++) {
    const t = Math.abs(y - (h - 1) / 2) / (h / 2);
    b.set(0, y, INK, Math.round(255 * 0.62 * (1 - t * t)));
  }
  return b;
}
