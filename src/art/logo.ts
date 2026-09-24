// The home screen's EVERLANDS logo: tall hand-drawn serif capitals in a
// polished gold (bright crown, a darker horizon line, a warm lower sheen), a
// bronze extruded base and a dark outline, over a leafy vine with an emerald
// gem at its heart. It comes as a strip of frames: frame 0 is the resting
// logo and the rest sweep a glint across it, so the scene can shimmer the
// title by switching frames.

import { Bitmap, mix } from './bitmap';
import { hex, type RGB } from './pixel';

const GLYPH_H = 13;

// '#' is letter. Thick 2px stems, thin 1px bars, small serifs.
const GLYPHS: Record<string, string[]> = {
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

const GAP = 2;
const DEPTH = 3;
/** Room around the art for the soft shadow. */
const PAD = 4;
/** Vine band under the letters: its centre line sits this far below them. */
const VINE_DROP = 9;
const VINE_H = 5;

/** Frames in the strip: the resting logo, then the glint's sweep. */
export const LOGO_FRAMES = 14;

// Gold fill by row: a light crown down to a dark horizon line at row 6,
// then a warmer sheen rising again below it, like polished metal.
const RAMP = ['#fffbe8', '#fff0b0', '#ffe08a', '#fad06a', '#f2bd52', '#e8a73e', '#cf8a36', '#f8cc60', '#f2b84c', '#eaa23e', '#df8e34', '#cc792d', '#b56628'].map(hex);
const RIM = hex('#4a1f14');
const EXTRUDE = [hex('#8a4a24'), hex('#62301c'), hex('#3e1c18')];
const INK = hex('#120e1f');
const WHITE: RGB = [255, 255, 255];
const STEM = hex('#3f7a3c');
const LEAF = hex('#5fae4e');
const LEAF_LIT = hex('#a6e07a');
const GEM = [hex('#d8fff0'), hex('#5fe0a0'), hex('#2fae78'), hex('#1b7452')];

export interface Logo {
  /** LOGO_FRAMES frames of frameW x frameH, stacked top to bottom. */
  sheet: Bitmap;
  frameW: number;
  frameH: number;
  /** Where twinkles look good, in frame px. */
  sparkles: { x: number; y: number }[];
}

export function everlandsLogo(text = 'EVERLANDS'): Logo {
  const chars = [...text.toUpperCase()].filter((c) => GLYPHS[c]);
  const textW = chars.reduce((w, c) => w + GLYPHS[c][0].length + GAP, -GAP);
  const W = textW + 2 + PAD * 2;
  const tx = PAD + 1;
  const ty = PAD + 1;
  const vineY = ty + GLYPH_H + VINE_DROP;
  const H = vineY + VINE_H + PAD;
  const idx = (x: number, y: number) => y * W + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

  // Letter mask.
  const fill = new Uint8Array(W * H);
  let x0 = tx;
  let apexA = { x: tx, y: ty };
  for (const c of chars) {
    const g = GLYPHS[c];
    g.forEach((row, y) => [...row].forEach((p, x) => p === '#' && (fill[idx(x0 + x, ty + y)] = 1)));
    if (c === 'A') apexA = { x: x0 + 5, y: ty };
    x0 += g[0].length + GAP;
  }
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
      let c = RAMP[y - ty];
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

  // The vine: a gently waving stem, mirrored about the centre, with leaves
  // leaning outward and a curl at each tip.
  const cx = Math.floor(W / 2);
  const half = Math.round(textW * 0.4);
  const stemY = (d: number) => vineY + Math.round(1.3 * Math.sin(d * 0.3));
  for (let d = 4; d <= half; d++) {
    for (const s of [-1, 1]) {
      const x = cx + s * d;
      const y = stemY(d);
      put(x, y, STEM);
      if (d % 7 === 3) {
        // Leaves alternate above and below the stem.
        const up = (Math.floor(d / 7) & 1) === 0 ? -1 : 1;
        put(x + s, y + up, LEAF);
        put(x + 2 * s, y + up, up < 0 ? LEAF_LIT : LEAF);
        put(x + s, y + 2 * up, LEAF);
        put(x + 2 * s, y + 2 * up, LEAF);
        put(x + 3 * s, y + 2 * up, LEAF_LIT);
      }
    }
  }
  for (const s of [-1, 1]) {
    const x = cx + s * half;
    const y = stemY(half);
    put(x + s, y - 1, STEM);
    put(x + s, y - 2, STEM);
    put(x, y - 3, LEAF_LIT);
  }
  // Emerald at the heart of the vine: a small cut diamond.
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const m = Math.abs(dx) + Math.abs(dy);
      if (m > 3) continue;
      const shade = m === 3 ? RIM : dx + dy < -1 ? GEM[0] : dy < 0 || (dy === 0 && dx < 0) ? GEM[1] : dx + dy > 1 ? GEM[3] : GEM[2];
      put(cx + dx, vineY + dy, shade, m < 3);
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
      { x: tx + 1, y: ty },
      apexA,
      { x: tx + textW - 2, y: ty + GLYPH_H - 1 },
      { x: cx, y: vineY - 3 },
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
