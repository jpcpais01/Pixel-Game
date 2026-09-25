// The home screen's MYTHS AND LEGENDS logo: two lines of tall hand-drawn
// serif capitals in a polished gold (bright crown, a darker horizon line, a
// warm lower sheen) with a bronze extruded base and a dark outline. Between
// them a small italic "and" sits on a gold rule that ends in emeralds. It
// comes as a strip of frames: frame 0 is the resting logo and the rest sweep
// a glint across it, so the scene can shimmer the title by switching frames.

import { Bitmap, mix } from './bitmap';
import { hex, type RGB } from './pixel';

const GLYPH_H = 13;

// '#' is letter. Thick 2px stems, thin 1px bars, small serifs.
const GLYPHS: Record<string, string[]> = {
  M: [
    '###.......###',
    '.###.....###.',
    '.####...####.',
    '.##.##.##.##.',
    '.##.##.##.##.',
    '.##..###..##.',
    '.##..###..##.',
    '.##...#...##.',
    '.##.......##.',
    '.##.......##.',
    '.##.......##.',
    '.##.......##.',
    '####.....####',
  ],
  Y: [
    '####...####',
    '.##.....##.',
    '..##...##..',
    '..##...##..',
    '...##.##...',
    '...##.##...',
    '....###....',
    '....##.....',
    '....##.....',
    '....##.....',
    '....##.....',
    '....##.....',
    '...####....',
  ],
  T: [
    '##########',
    '##..##..##',
    '#...##...#',
    '....##....',
    '....##....',
    '....##....',
    '....##....',
    '....##....',
    '....##....',
    '....##....',
    '....##....',
    '....##....',
    '...####...',
  ],
  H: [
    '####...####',
    '.##.....##.',
    '.##.....##.',
    '.##.....##.',
    '.##.....##.',
    '.##.....##.',
    '.#########.',
    '.##.....##.',
    '.##.....##.',
    '.##.....##.',
    '.##.....##.',
    '.##.....##.',
    '####...####',
  ],
  G: [
    '...#####.#',
    '..##...###',
    '.##.....##',
    '##.......#',
    '##........',
    '##........',
    '##...#####',
    '##.....##.',
    '##.....##.',
    '.##....##.',
    '.##....##.',
    '..##..###.',
    '...####.#.',
  ],
  E: [
    '#########',
    '.##....##',
    '.##.....#',
    '.##......',
    '.##......',
    '.##......',
    '.#######.',
    '.##......',
    '.##......',
    '.##......',
    '.##.....#',
    '.##....##',
    '#########',
  ],
  V: [
    '####...####',
    '.##.....##.',
    '.##.....##.',
    '.##.....##.',
    '..##...##..',
    '..##...##..',
    '..##...##..',
    '...##.##...',
    '...##.##...',
    '...##.##...',
    '....###....',
    '....###....',
    '.....#.....',
  ],
  R: [
    '########..',
    '.##....##.',
    '.##.....##',
    '.##.....##',
    '.##.....##',
    '.##....##.',
    '.#######..',
    '.##..##...',
    '.##...##..',
    '.##...##..',
    '.##....##.',
    '.##....##.',
    '####...###',
  ],
  L: [
    '####.....',
    '.##......',
    '.##......',
    '.##......',
    '.##......',
    '.##......',
    '.##......',
    '.##......',
    '.##......',
    '.##.....#',
    '.##.....#',
    '.##....##',
    '#########',
  ],
  A: [
    '.....#.....',
    '....###....',
    '....###....',
    '...##.##...',
    '...##.##...',
    '...##.##...',
    '..##...##..',
    '..#######..',
    '..##...##..',
    '.##.....##.',
    '.##.....##.',
    '.##.....##.',
    '####...####',
  ],
  N: [
    '###.....###',
    '.###.....#.',
    '.####....#.',
    '.#.##....#.',
    '.#..##...#.',
    '.#..##...#.',
    '.#...##..#.',
    '.#...##..#.',
    '.#....##.#.',
    '.#....####.',
    '.#.....###.',
    '.#......##.',
    '###......#.',
  ],
  D: [
    '########...',
    '.##....##..',
    '.##.....##.',
    '.##......##',
    '.##......##',
    '.##......##',
    '.##......##',
    '.##......##',
    '.##......##',
    '.##......##',
    '.##.....##.',
    '.##....##..',
    '########...',
  ],
  S: [
    '..#####.#',
    '.##...###',
    '##.....##',
    '##......#',
    '.##......',
    '..###....',
    '....###..',
    '......##.',
    '.......##',
    '#......##',
    '##.....##',
    '###...##.',
    '#.#####..',
  ],
};

// The small italic "and": 7 rows, sheared as it is drawn.
const SMALL: Record<string, string[]> = {
  a: ['....', '....', '.##.', '...#', '.###', '#..#', '.###'],
  n: ['....', '....', '###.', '#..#', '#..#', '#..#', '#..#'],
  d: ['...#', '...#', '.###', '#..#', '#..#', '#..#', '.###'],
};
const SMALL_H = 7;

const GAP = 2;
const DEPTH = 3;
/** Room around the art for the soft shadow. */
const PAD = 4;
/** Rows between a line of capitals (plus its extrusion) and the "and" band. */
const BAND_GAP = 2;
/** Frames in the strip: the resting logo, then the glint's sweep. */
export const LOGO_FRAMES = 14;

// Gold fill by row: a light crown down to a dark horizon line at row 6,
// then a warmer sheen rising again below it, like polished metal.
const RAMP = ['#fffbe8', '#fff0b0', '#ffe08a', '#fad06a', '#f2bd52', '#e8a73e', '#cf8a36', '#f8cc60', '#f2b84c', '#eaa23e', '#df8e34', '#cc792d', '#b56628'].map(hex);
const RIM = hex('#4a1f14');
const EXTRUDE = [hex('#8a4a24'), hex('#62301c'), hex('#3e1c18')];
const INK = hex('#120e1f');
const WHITE: RGB = [255, 255, 255];
const RULE = [hex('#fff0b0'), hex('#e8a73e'), hex('#b56628')];
const GEM = [hex('#d8fff0'), hex('#5fe0a0'), hex('#2fae78'), hex('#1b7452')];

export interface Logo {
  /** LOGO_FRAMES frames of frameW x frameH, stacked top to bottom. */
  sheet: Bitmap;
  frameW: number;
  frameH: number;
  /** Where twinkles look good, in frame px. */
  sparkles: { x: number; y: number }[];
}

const lineW = (text: string) => [...text].reduce((w, c) => w + GLYPHS[c][0].length + GAP, -GAP);

export function mythsLogo(): Logo {
  const top = 'MYTHS';
  const bottom = 'LEGENDS';
  const textW = Math.max(lineW(top), lineW(bottom));
  const W = textW + 2 + PAD * 2;
  const tx = PAD + 1;
  const ty = PAD + 1;
  const bandY = ty + GLYPH_H + DEPTH + BAND_GAP;
  const ty2 = bandY + SMALL_H + BAND_GAP;
  const H = ty2 + GLYPH_H + DEPTH + PAD;
  const idx = (x: number, y: number) => y * W + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

  // Letter mask, and each lit pixel's row within its glyph (for the gold ramp).
  const fill = new Uint8Array(W * H);
  const rowOf = new Int8Array(W * H);
  const lay = (text: string, y0: number) => {
    let x0 = tx + Math.floor((textW - lineW(text)) / 2);
    for (const c of text) {
      const g = GLYPHS[c];
      g.forEach((row, y) =>
        [...row].forEach((p, x) => {
          if (p !== '#') return;
          fill[idx(x0 + x, y0 + y)] = 1;
          rowOf[idx(x0 + x, y0 + y)] = y;
        }),
      );
      x0 += g[0].length + GAP;
    }
    return x0 - GAP;
  };
  const topEnd = lay(top, ty);
  lay(bottom, ty2);
  const on = (a: Uint8Array, x: number, y: number) => inside(x, y) && a[idx(x, y)] > 0;

  // Colour per pixel (null = empty) and which pixels the glint may brighten.
  const col: (RGB | null)[] = new Array(W * H).fill(null);
  const shiny = new Uint8Array(W * H);
  const put = (x: number, y: number, c: RGB, glint = false) => {
    if (!inside(x, y)) return;
    col[idx(x, y)] = c;
    shiny[idx(x, y)] = glint ? 1 : 0;
  };

  // Letters: gradient fill with a bright top edge and a shaded right edge.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!on(fill, x, y)) continue;
      let c = RAMP[rowOf[idx(x, y)]];
      if (!on(fill, x, y - 1)) c = mix(c, WHITE, 0.55);
      else if (!on(fill, x + 1, y)) c = mix(c, RIM, 0.28);
      put(x, y, c, true);
    }
  }
  // The extruded base under the letters.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (on(fill, x, y)) continue;
      for (let d = 1; d <= DEPTH; d++) {
        if (on(fill, x, y - d)) {
          put(x, y, EXTRUDE[d - 1]);
          break;
        }
      }
    }
  }

  // The "and": small italic letters in the middle of a gold rule.
  const cx = Math.floor(W / 2);
  const andW = 3 * 4 + 2 * 2 + 1;
  const ax = cx - Math.floor(andW / 2);
  let x0 = ax;
  for (const c of 'and') {
    SMALL[c].forEach((row, y) =>
      [...row].forEach((p, x) => {
        if (p !== '#') return;
        const shear = y < 3 ? 1 : 0;
        put(x0 + x + shear, bandY + y, y < 3 ? RAMP[1] : y < 5 ? RAMP[4] : RAMP[8], true);
      }),
    );
    x0 += 6;
  }
  // The rule runs out from the "and" on both sides and ends in an emerald.
  const ruleY = bandY + 4;
  const reach = Math.round(textW * 0.42);
  for (const s of [-1, 1]) {
    const start = s < 0 ? ax - 4 : ax + andW + 4;
    const end = cx + s * reach;
    for (let x = start; s < 0 ? x >= end : x <= end; x += s) {
      const k = Math.abs(x - start) / Math.abs(end - start);
      put(x, ruleY - 1, RULE[0], k < 0.7);
      put(x, ruleY, RULE[k < 0.5 ? 1 : 2]);
    }
    // A tiny diamond right beside the "and".
    put(start - s * 2, ruleY - 1, RULE[0], true);
    put(start - s * 2, ruleY, RULE[1]);
    put(start - s * 1, ruleY - 1, RULE[1]);
    put(start - s * 3, ruleY - 1, RULE[1]);
    put(start - s * 2, ruleY - 2, WHITE, true);
    // Emerald at the end: a small cut diamond.
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const m = Math.abs(dx) + Math.abs(dy);
        if (m > 2) continue;
        const shade = m === 2 ? RIM : dx + dy < 0 ? GEM[0] : dx + dy === 0 ? GEM[1] : GEM[3];
        put(end + s * 2 + dx, ruleY + dy, shade, m < 2);
      }
    }
  }

  // Outline everything, then a soft shadow fading out around it.
  const solid = col.map((c) => (c ? 1 : 0));
  const isSolid = (x: number, y: number) => inside(x, y) && solid[idx(x, y)] === 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isSolid(x, y) && (isSolid(x - 1, y) || isSolid(x + 1, y) || isSolid(x, y - 1) || isSolid(x, y + 1))) put(x, y, INK);
    }
  }
  const shadow = new Uint8Array(W * H);
  const SHADOW_A = [0, 110, 60, 26];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (col[idx(x, y)]) continue;
      let best = 99;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (inside(x + dx, y + dy) && col[idx(x + dx, y + dy)]) best = Math.min(best, Math.max(Math.abs(dx), Math.abs(dy)));
        }
      }
      if (best <= 3) shadow[idx(x, y)] = SHADOW_A[best];
    }
  }

  // Paint the frames. The glint is a slanted band that crosses the logo
  // from left to right over frames 1..LOGO_FRAMES-1.
  const sheet = new Bitmap(W, H * LOGO_FRAMES);
  const sweep = W + H;
  for (let f = 0; f < LOGO_FRAMES; f++) {
    const c = f === 0 ? -99 : -H / 2 + (sweep * (f - 1)) / (LOGO_FRAMES - 2);
    const oy = f * H;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        const p = col[i];
        if (!p) {
          if (shadow[i]) sheet.set(x, oy + y, INK, shadow[i]);
          continue;
        }
        const u = x + (H - y) * 0.6;
        const k = shiny[i] ? Math.max(0, 1 - Math.abs(u - c) / 3) : 0;
        sheet.set(x, oy + y, k > 0 ? mix(p, WHITE, 0.8 * k) : p);
      }
    }
  }

  return {
    sheet,
    frameW: W,
    frameH: H,
    sparkles: [
      { x: tx + Math.floor((textW - lineW(top)) / 2) + 1, y: ty },
      { x: topEnd - 1, y: ty + GLYPH_H - 1 },
      { x: tx + 1, y: ty2 + 1 },
      { x: tx + textW - 2, y: ty2 + GLYPH_H - 1 },
      { x: cx - reach - 2, y: ruleY - 2 },
      { x: cx + reach + 2, y: ruleY - 2 },
    ],
  };
}

/** A small four-pointed twinkle, 7x7: white core, pale gold arms. */
export function sparkleBitmap(): Bitmap {
  const b = new Bitmap(7, 7);
  const core = hex('#ffffff');
  const arm = hex('#fff0b0');
  const tip = hex('#f8cd62');
  b.set(3, 3, core);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    b.set(3 + dx, 3 + dy, arm);
    b.set(3 + 2 * dx, 3 + 2 * dy, tip, 200);
    b.set(3 + 3 * dx, 3 + 3 * dy, tip, 90);
  }
  return b;
}
