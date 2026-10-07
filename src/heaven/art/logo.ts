// Heaven Lands' title logo: two lines of soft, rounded capitals in a warm
// cream (white at the crown, peach towards the foot) ringed in gold, standing
// on a rosy-lilac base like a cloud bank lit from below, all in a deep plum
// outline. Between the lines a little winged sun rises, its gold rule running
// out to a puff of cloud each side. Like Myths' logo it comes as a strip of
// frames: frame 0 is the resting logo and the rest sweep a glint across it,
// so a scene (or the loading screen) can shimmer the title by switching frames.

import { Bitmap, mix } from '../../art/bitmap';
import { hex, type RGB } from '../../art/pixel';

const GLYPH_H = 13;

// '#' is letter. 2px stems and bars, rounded corners, no serifs: airy and friendly.
const GLYPHS: Record<string, string[]> = {
  H: [
    '##......##',
    '##......##',
    '##......##',
    '##......##',
    '##......##',
    '##########',
    '##########',
    '##......##',
    '##......##',
    '##......##',
    '##......##',
    '##......##',
    '##......##',
  ],
  E: [
    '.########',
    '#########',
    '##.......',
    '##.......',
    '##.......',
    '#######..',
    '#######..',
    '##.......',
    '##.......',
    '##.......',
    '##.......',
    '#########',
    '.########',
  ],
  A: [
    '..######..',
    '.########.',
    '###....###',
    '##......##',
    '##......##',
    '##......##',
    '##########',
    '##########',
    '##......##',
    '##......##',
    '##......##',
    '##......##',
    '##......##',
  ],
  V: [
    '##......##',
    '##......##',
    '##......##',
    '##......##',
    '###....###',
    '.##....##.',
    '.##....##.',
    '.###..###.',
    '..##..##..',
    '..##..##..',
    '..######..',
    '...####...',
    '....##....',
  ],
  N: [
    '###.....##',
    '####....##',
    '####....##',
    '##.##...##',
    '##.##...##',
    '##..##..##',
    '##..##..##',
    '##...##.##',
    '##...##.##',
    '##....####',
    '##....####',
    '##.....###',
    '##......##',
  ],
  L: [
    '##.......',
    '##.......',
    '##.......',
    '##.......',
    '##.......',
    '##.......',
    '##.......',
    '##.......',
    '##.......',
    '##.......',
    '##.......',
    '#########',
    '.########',
  ],
  D: [
    '#######...',
    '########..',
    '##....###.',
    '##.....###',
    '##......##',
    '##......##',
    '##......##',
    '##......##',
    '##......##',
    '##.....###',
    '##....###.',
    '########..',
    '#######...',
  ],
  S: [
    '..#######',
    '.########',
    '###......',
    '##.......',
    '###......',
    '.######..',
    '..######.',
    '......###',
    '.......##',
    '.......##',
    '......###',
    '########.',
    '#######..',
  ],
};

// The winged sun between the lines. Wings are drawn for the right side and
// mirrored: 'w' white, 'c' cream, 'l' lilac under the feathers, 'm' its shade.
const WING = [
  '............ww',
  '.........wwwcc',
  '......wwwccccl',
  '..wwwwcccccllm',
  'wwccccccllll.m',
  '.cccclllm.m...',
  '..llm.m.......',
];
const SUN = ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'];
// A small cloud puff where each rule ends, 9x4.
const PUFF = ['...www...', '.wwccccw.', 'wccccccll', '.lllllmm.'];
const BAND_H = 7;

/** Space between letters: a touch wider than Myths' for an airy line. */
const GAP = 2;
/** Rows of the rosy base under the letters. */
const DEPTH = 3;
/** Room around the art for the soft shadow. */
const PAD = 4;
/** Rows between a line of capitals (plus its base) and the sun's band. */
const BAND_GAP = 2;
/** Frames in the strip: the resting logo, then the glint's sweep. */
export const LOGO_FRAMES = 14;

// Cream fill by row: white at the crown warming to peach at the foot, with a
// slightly lighter band low down where the dawn catches it.
const RAMP = ['#ffffff', '#fffdf8', '#fff9ec', '#fff4e0', '#ffefd4', '#ffe9ca', '#fde2c0', '#fff0d8', '#ffeace', '#fde4c4', '#fbdcba', '#f9d4b0', '#f6cca8'].map(hex);
/** The gold ring round every letter: lighter on top, deeper underneath. */
const GOLD = [hex('#fcd77a'), hex('#eaa947'), hex('#c47c36')];
/** The base under the letters: rose into lilac into dusk violet. */
const BASE = [hex('#f0a6b4'), hex('#c98bc0'), hex('#9a70b0')];
const INK = hex('#4a2850');
const SHADOW = hex('#6e4a86');
const WHITE: RGB = [255, 255, 255];
/** The glint's light: a touch warm, so it shows even over the white crowns. */
const GLINT = hex('#fffbe6');
const SUN_RAMP = ['#fffbe0', '#fff0a8', '#ffe07a', '#ffd060', '#fbbd4c', '#f2a640', '#e48f3a'].map(hex);
const PAL: Record<string, RGB> = { w: hex('#ffffff'), c: hex('#fff1dc'), l: hex('#e3b4d8'), m: hex('#b98ec8') };

export interface Logo {
  /** LOGO_FRAMES frames of frameW x frameH, stacked top to bottom. */
  sheet: Bitmap;
  frameW: number;
  frameH: number;
  /** Where twinkles look good, in frame px. */
  sparkles: { x: number; y: number }[];
}

const lineW = (text: string) => [...text].reduce((w, c) => w + GLYPHS[c][0].length + GAP, -GAP);

export function heavenLogo(): Logo {
  const top = 'HEAVEN';
  const bottom = 'LANDS';
  const textW = Math.max(lineW(top), lineW(bottom));
  // One px each side for the gold ring and one for the outline.
  const W = textW + 4 + PAD * 2;
  const tx = PAD + 2;
  const ty = PAD + 2;
  const bandY = ty + GLYPH_H + 1 + DEPTH + BAND_GAP;
  const ty2 = bandY + BAND_H + BAND_GAP + 1;
  const H = ty2 + GLYPH_H + 1 + DEPTH + PAD + 1;
  const idx = (x: number, y: number) => y * W + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

  // Letter mask, and each lit pixel's row within its glyph (for the cream ramp).
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

  // Letters: the cream ramp, the very top edge pure white, a faint warm
  // shade down the right edge so the strokes feel round.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!on(fill, x, y)) continue;
      let c = RAMP[rowOf[idx(x, y)]];
      if (!on(fill, x, y - 1)) c = WHITE;
      else if (!on(fill, x + 1, y)) c = mix(c, GOLD[1], 0.22);
      put(x, y, c, true);
    }
  }
  // The gold ring: every pixel touching a letter (corners too, so it reads
  // as a smooth band), shaded by where it sits.
  const ring = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (on(fill, x, y)) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (on(fill, x + dx, y + dy)) near = true;
      if (!near) continue;
      ring[idx(x, y)] = 1;
      const below = on(fill, x, y - 1) || on(fill, x - 1, y - 1) || on(fill, x + 1, y - 1);
      const above = on(fill, x, y + 1);
      put(x, y, above ? GOLD[0] : below ? GOLD[2] : GOLD[1], true);
    }
  }
  // The rosy base under letters and ring, like a lit cloud bank.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (on(fill, x, y) || on(ring, x, y)) continue;
      for (let d = 1; d <= DEPTH; d++) {
        if (on(fill, x, y - d) || on(ring, x, y - d)) {
          put(x, y, BASE[d - 1], true);
          break;
        }
      }
    }
  }

  // The band: a winged sun in the middle, a rule out to a cloud puff each side.
  const cx = Math.floor(W / 2);
  const sunX = cx - 3;
  SUN.forEach((row, y) =>
    [...row].forEach((p, x) => {
      if (p !== '#') return;
      // Lit from the top left: white crown fading to a warm orange foot.
      const k = Math.min(SUN_RAMP.length - 1, Math.max(0, Math.round(y + (x - 3) * 0.35)));
      put(sunX + x, bandY + y, x + y <= 3 ? WHITE : SUN_RAMP[k], true);
    }),
  );
  const wingW = WING[0].length;
  for (const s of [-1, 1]) {
    const base = s > 0 ? sunX + SUN[0].length + 1 : sunX - 2;
    WING.forEach((row, y) =>
      [...row].forEach((p, x) => {
        if (p === '.') return;
        put(base + s * x, bandY + y - 1, PAL[p], true);
      }),
    );
    // The rule: a light top line over a gold one, thinning to dots near the puff.
    const start = base + s * (wingW + 1);
    const end = cx + s * Math.round(textW * 0.36);
    const ruleY = bandY + 4;
    for (let x = start; s < 0 ? x >= end : x <= end; x += s) {
      const k = Math.abs(x - start) / Math.max(1, Math.abs(end - start));
      if (k > 0.7 && Math.abs(x - start) % 2 === 1) continue;
      put(x, ruleY - 1, GOLD[0], k < 0.6);
      put(x, ruleY, GOLD[k < 0.5 ? 1 : 2]);
    }
    const px = s > 0 ? end + 2 : end - 2 - (PUFF[0].length - 1);
    PUFF.forEach((row, y) =>
      [...row].forEach((p, x) => {
        if (p === '.') return;
        // Mirror the puff on the left so its shaded side faces out.
        const xx = s > 0 ? x : PUFF[0].length - 1 - x;
        put(px + xx, ruleY - 2 + y, PAL[p], true);
      }),
    );
  }

  // Outline everything in plum, then a soft lilac shadow fading out round it.
  const solid = col.map((c) => (c ? 1 : 0));
  const isSolid = (x: number, y: number) => inside(x, y) && solid[idx(x, y)] === 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isSolid(x, y) && (isSolid(x - 1, y) || isSolid(x + 1, y) || isSolid(x, y - 1) || isSolid(x, y + 1))) put(x, y, INK);
    }
  }
  const shadow = new Uint8Array(W * H);
  const SHADOW_A = [0, 96, 50, 20];
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

  // Paint the frames. The glint is a slanted band that crosses the logo from
  // left to right over frames 1..LOGO_FRAMES-1. Cream is already pale, so the
  // glint pulls it to white and lifts the gold towards it too.
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
          if (shadow[i]) sheet.set(x, oy + y, SHADOW, shadow[i]);
          continue;
        }
        const u = x + (H - y) * 0.6;
        const k = shiny[i] ? Math.max(0, 1 - Math.abs(u - c) / 4) : 0;
        sheet.set(x, oy + y, k > 0 ? mix(p, GLINT, 0.85 * k) : p);
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
      { x: tx + Math.floor((textW - lineW(bottom)) / 2) + 1, y: ty2 + 1 },
      { x: cx, y: bandY - 1 },
      { x: cx - Math.round(textW * 0.36) - 5, y: bandY + 1 },
      { x: cx + Math.round(textW * 0.36) + 5, y: bandY + 1 },
    ],
  };
}

/**
 * One frame of the logo as a plain RGBA bitmap ({ w, h, data }), for a scene
 * that wants it as a still texture: `scene.textures.addCanvas(key, heavenLogoBitmap().toCanvas())`.
 * The whole glint strip is `heavenLogo().sheet`, cut into frames like Myths' home screen does.
 */
export function heavenLogoBitmap(frame = 0): Bitmap {
  const l = heavenLogo();
  const out = new Bitmap(l.frameW, l.frameH);
  const f = Math.max(0, Math.min(LOGO_FRAMES - 1, frame));
  out.data.set(l.sheet.data.subarray(f * l.frameW * l.frameH * 4, (f + 1) * l.frameW * l.frameH * 4));
  return out;
}

/** A small four-pointed twinkle, 7x7: white core, pale gold arms, a rosy tip. */
export function sparkleBitmap(): Bitmap {
  const b = new Bitmap(7, 7);
  const core = hex('#ffffff');
  const arm = hex('#fff2c4');
  const tip = hex('#f5b4c0');
  b.set(3, 3, core);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    b.set(3 + dx, 3 + dy, arm);
    b.set(3 + 2 * dx, 3 + 2 * dy, tip, 200);
    b.set(3 + 3 * dx, 3 + 3 * dy, tip, 90);
  }
  return b;
}
