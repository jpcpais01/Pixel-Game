// Art for Auto Battle's boons: the big cards offered every third round (a
// carved frame in the tier's metal, silver, gold or a shifting prism, a gem
// at the crown, a starry window with a halo where the boon's picture floats,
// a ribbon for its name and a slate for its words), the back they're dealt
// face down on, the pictures themselves, and the small badges of boons kept.
//
// The pictures are drawn from shapes laid out on a unit square, so one
// drawing gives every size: each shape shades itself (spheres by a light from
// the upper left, flat parts with a bevel where they meet another), then the
// whole gets a dark outline, the way the heroes' icons are drawn.

import type Phaser from 'phaser';
import { Bitmap, bayer, clamp01, mix } from './bitmap';
import { hex, type RGB } from './pixel';
import { boonDef, type BoonTier } from '../game/auto/boons';
import { TRAITS, type TraitId } from '../game/auto/units';
import { TRAIT_MARKS } from './autoArt';

/** The card's frame width, and the halo's room round the picture. */
const BORDER = 6;
const HALO = 5;
/** A text line on the card (the pixel font is 7 px tall). */
export const BOON_LINE = 8;

const INK: RGB = hex('#0b0818');
const NIGHT: RGB = hex('#05040e');

/** Each tier's metal, its light, the gem at the crown, and the tint of the night inside. */
const TIERS: { metal: RGB[]; accent: RGB; gem: RGB[]; night: RGB }[] = [
  {
    metal: ['#141626', '#2c3048', '#4c5470', '#7c86a4', '#b4bed6', '#eef2ff'].map(hex),
    accent: hex('#9ad8ff'),
    gem: ['#0c2a5a', '#1e5aa8', '#4aa6ff', '#a8e0ff', '#ffffff'].map(hex),
    night: hex('#13203e'),
  },
  {
    metal: ['#1e1004', '#4a2a0a', '#7e4e14', '#b8802a', '#ecc050', '#fff2b8'].map(hex),
    accent: hex('#ffd35c'),
    gem: ['#4a0812', '#8e1a26', '#e0404a', '#ff9a9a', '#ffffff'].map(hex),
    night: hex('#2a160c'),
  },
  {
    metal: ['#160c22', '#34204e', '#5a3c7e', '#8a68b0', '#c0a4e0', '#f6ecff'].map(hex),
    accent: hex('#ff9af0'),
    gem: ['#3a1a5a', '#7a4ab8', '#c89aff', '#f0e0ff', '#ffffff'].map(hex),
    night: hex('#1e0e34'),
  },
];

export const tierAccent = (t: BoonTier): number => {
  const c = TIERS[t].accent;
  return (c[0] << 16) | (c[1] << 8) | c[2];
};

const hash = (x: number, y: number, s = 0): number => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Pick between colours in steps with an ordered dither. */
function ramp(cols: RGB[], t: number, x: number, y: number): RGB {
  const f = clamp01(t) * (cols.length - 1);
  const i = Math.floor(f);
  if (i >= cols.length - 1) return cols[cols.length - 1];
  return f - i > bayer(x, y) ? cols[i + 1] : cols[i];
}

/** A colour from hue (0..1), saturation and lightness. */
function hsl(h: number, s: number, l: number): RGB {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/**
 * The tier's metal at shade `v` (0..1) at (x, y): silver and gold from their
 * ramps; prism runs through the rainbow along the frame, slowly, so each side
 * of the card wears a different light.
 */
function metal(tier: BoonTier, v: number, x: number, y: number, w: number, h: number): RGB {
  if (tier !== 2) return ramp(TIERS[tier].metal, v, x, y);
  const hue = ((x * 0.8 + y * 0.55) / (w + h) + 0.62) % 1;
  // Steps of light like the other metals, so it dithers rather than blends.
  const step = Math.round(clamp01(v) * 5 + bayer(x, y) - 0.5) / 5;
  return hsl(hue, 0.55 + step * 0.25, 0.1 + step * 0.78);
}

function add(scene: Phaser.Scene, key: string, b: Bitmap): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** Where things go on a card `w` x `h` with `nameLines` lines of name (shared by the painter and the scene). */
export function boonLayout(w: number, h: number, nameLines: number) {
  const icon = w >= 96 ? 48 : 32;
  const cx = Math.floor(w / 2);
  const cy = BORDER + 7 + icon / 2;
  const ribbonY = cy + icon / 2 + HALO + 3;
  const ribbonH = 4 + nameLines * BOON_LINE;
  const textY = ribbonY + ribbonH + 4;
  return { icon, cx, cy, halo: icon / 2 + HALO, ribbonY, ribbonH, textY, inner: w - BORDER * 2 - 4, border: BORDER, tierY: h - BORDER - 10 };
}

/** The frame, shared by the face and the back: outline, cut corners, a bevelled band, corner gems and the crown gem. */
function paintFrame(b: Bitmap, tier: BoonTier): void {
  const { w, h } = b;
  const T = TIERS[tier];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const cxp = Math.min(x, w - 1 - x);
      const cyp = Math.min(y, h - 1 - y);
      if (cxp + cyp < 2) continue; // the cut corners
      const e = Math.min(cxp, cyp, cxp + cyp - 2 + 1);
      if (e >= BORDER) continue;
      if (e === 0 || cxp + cyp === 2) {
        b.set(x, y, INK);
        continue;
      }
      // A rounded band, lit along the top and left, an engraved line down its middle, and a shadow inside.
      const t = (e - 1) / (BORDER - 2);
      let v = 0.32 + 0.46 * Math.sin(Math.PI * t);
      const side = cyp <= cxp ? (y < h / 2 ? 1 : -1) : x < w / 2 ? 1 : -1;
      v += side * 0.14;
      v += (hash(x >> 1, y >> 1, 3) - 0.5) * 0.12;
      if (e === 3) v -= 0.26;
      if (e === BORDER - 1) v = 0.12;
      let c = metal(tier, v, x, y, w, h);
      // Gilt runs along the engraved line near the crown, fading out to the sides.
      if (e === 3 && y < h / 2) {
        const k = 1 - Math.abs(x - w / 2) / (w * 0.42);
        if (k > bayer(x, y)) c = mix(T.accent, hex('#ffffff'), 0.2);
      }
      b.set(x, y, c);
      // A glint now and then on the metal.
      if (e === 2 && side > 0 && hash(x, y, 9) > 0.965) b.set(x, y, hex('#ffffff'));
    }
  const gem = (gx: number, gy: number, r: number) => {
    for (let dy = -r - 1; dy <= r + 1; dy++)
      for (let dx = -r - 1; dx <= r + 1; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d === r + 1) b.set(gx + dx, gy + dy, INK);
        else if (d <= r) {
          // Facets: the upper left lit, the lower right deep, a spark in the corner.
          const lit = -dx - dy;
          const v = 0.5 + (lit / (r * 2)) * 0.45 + (d === r ? -0.12 : 0.08);
          b.set(gx + dx, gy + dy, ramp(T.gem, v, gx + dx, gy + dy));
        }
      }
    b.set(gx - Math.max(1, r >> 1), gy - Math.max(1, r >> 1), hex('#ffffff'));
  };
  const c = BORDER >> 1;
  gem(c, c, 1);
  gem(w - 1 - c, c, 1);
  gem(c, h - 1 - c, 1);
  gem(w - 1 - c, h - 1 - c, 1);
  // The crown: a bigger gem in a gold-set mount at the top's middle.
  const mx = Math.floor(w / 2);
  for (let dx = -7; dx <= 7; dx++)
    for (let dy = 0; dy < BORDER + 1; dy++) {
      const d = Math.abs(dx) + dy * 0.6;
      if (d > 7.5) continue;
      b.set(mx + dx, dy, d > 6.6 ? INK : metal(tier, 0.75 - dy * 0.08 - Math.abs(dx) * 0.03, mx + dx, dy, w, h));
    }
  gem(mx, 3, 3);
}

/** The night inside a card, glowing round the picture's spot (cx, cy). */
function paintNight(b: Bitmap, tier: BoonTier, x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, glowR: number, rays: boolean): void {
  const T = TIERS[tier];
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      const down = (y - y0) / Math.max(1, y1 - y0);
      let c = mix(T.night, NIGHT, 0.25 + down * 0.5);
      // A soft cloud in the dark.
      if (hash(x >> 2, y >> 2, 21) > 0.6 && hash(x >> 1, y >> 1, 22) > 0.45) c = mix(c, T.night, 0.5);
      const g = Math.max(0, 1 - d / (glowR * 2.4));
      if (g * g * 0.7 > bayer(x, y) * 0.9) c = mix(c, T.accent, 0.12 + g * 0.22);
      // Rays fanning out from the picture.
      if (rays && d > glowR * 0.8 && d < glowR * 2.6) {
        const a = Math.atan2(dy, dx);
        if (Math.cos(a * 8) > 0.86 && (1 - d / (glowR * 2.6)) > bayer(x, y) * 0.8) c = mix(c, T.accent, 0.16);
      }
      // Stars.
      const s = hash(x, y, 27);
      if (s > 0.986) c = mix(c, hex('#ffffff'), 0.35 + (s - 0.986) * 30);
      b.set(x, y, c);
    }
}

/**
 * A boon card's face, `w` x `h`, of `tier`, with room for `nameLines` lines
 * of name on its ribbon. The picture, name, words and tier go on top in the
 * scene.
 */
export function boonCard(scene: Phaser.Scene, tier: BoonTier, w: number, h: number, nameLines: number): string {
  const key = `boon_card_${tier}_${w}x${h}_${nameLines}`;
  return scene.textures.exists(key) ? key : add(scene, key, paintBoonCard(tier, w, h, nameLines));
}

export function paintBoonCard(tier: BoonTier, w: number, h: number, nameLines: number): Bitmap {
  const T = TIERS[tier];
  const L = boonLayout(w, h, nameLines);
  const b = new Bitmap(w, h);
  paintNight(b, tier, BORDER, BORDER, w - BORDER, h - BORDER, L.cx, L.cy, L.halo, true);
  // The halo: a ring of the tier's light round a darker window.
  for (let y = L.cy - L.halo - 2; y <= L.cy + L.halo + 2; y++)
    for (let x = L.cx - L.halo - 2; x <= L.cx + L.halo + 2; x++) {
      const d = Math.hypot(x - L.cx + 0.5, y - L.cy + 0.5);
      if (d < L.halo - 0.6) {
        const k = d / L.halo;
        b.set(x, y, mix(mix(T.night, NIGHT, 0.55), T.accent, 0.06 + k * k * 0.16));
      } else if (d < L.halo + 0.6) b.set(x, y, mix(T.accent, hex('#ffffff'), y < L.cy ? 0.35 : 0));
      else if (d < L.halo + 1.5) b.set(x, y, mix(T.accent, INK, 0.6));
    }
  // Four sparks round the halo, at the compass points.
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]) {
    const sx = L.cx + dx * (L.halo + 3);
    const sy = L.cy + dy * (L.halo + 3);
    b.set(sx, sy, hex('#ffffff'));
    b.set(sx + dy, sy + dx, mix(T.accent, hex('#ffffff'), 0.4));
    b.set(sx - dy, sy - dx, mix(T.accent, hex('#ffffff'), 0.4));
  }
  // The slate for the words: darker, under a thin line of light.
  for (let y = L.textY - 2; y < h - BORDER; y++)
    for (let x = BORDER; x < w - BORDER; x++) {
      const i = (y * w + x) * 4;
      const c: RGB = [b.data[i], b.data[i + 1], b.data[i + 2]];
      b.set(x, y, y === L.textY - 2 ? mix(T.accent, INK, 0.55) : mix(c, NIGHT, 0.5));
    }
  // The ribbon: folded ends tucked behind the frame, then the band across, rounded top to bottom.
  const r0 = L.ribbonY;
  const rh = L.ribbonH;
  for (const end of [0, 1]) {
    for (let y = r0 + 2; y < r0 + rh + 2; y++)
      for (let i = 0; i < 4; i++) {
        const x = end ? w - BORDER + i : BORDER - 1 - i;
        // A notch cut into the tail's end.
        const mid = r0 + 2 + (rh - 1) / 2;
        if (i >= 2 && Math.abs(y - mid) < i - 1.5) continue;
        b.set(x, y, i === 3 || y === r0 + rh + 1 ? INK : metal(tier, 0.22, x, y, w, h));
      }
  }
  for (let y = r0; y < r0 + rh; y++)
    for (let x = BORDER - 1; x <= w - BORDER; x++) {
      const t = (y - r0) / Math.max(1, rh - 1);
      // A silk band: a bright fold along the top, deepening down, with a stitched seam inside each edge.
      let v = 0.5 + 0.22 * Math.cos(t * Math.PI * 0.9) - t * 0.2 + Math.sin((x / w) * Math.PI) * 0.06;
      if (y === r0) v = 0.95;
      if (y === r0 + rh - 1) v = 0.12;
      let c = mix(metal(tier, v, x, y, w, h), T.night, 0.22);
      if ((y === r0 + 2 || y === r0 + rh - 3) && x % 3 !== 0 && x > BORDER + 1 && x < w - BORDER - 2) c = mix(T.accent, hex('#ffffff'), 0.25);
      b.set(x, y, c);
    }
  paintFrame(b, tier);
  return b;
}

/** A card's back: the frame round a deep field of the tier's light, a lattice, and a great rune ring at its heart. */
export function boonBack(scene: Phaser.Scene, tier: BoonTier, w: number, h: number): string {
  const key = `boon_back_${tier}_${w}x${h}`;
  return scene.textures.exists(key) ? key : add(scene, key, paintBoonBack(tier, w, h));
}

export function paintBoonBack(tier: BoonTier, w: number, h: number): Bitmap {
  const T = TIERS[tier];
  const b = new Bitmap(w, h);
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const R = Math.min(w, h) * 0.32;
  paintNight(b, tier, BORDER, BORDER, w - BORDER, h - BORDER, cx, cy, R, false);
  for (let y = BORDER; y < h - BORDER; y++)
    for (let x = BORDER; x < w - BORDER; x++) {
      const i = (y * w + x) * 4;
      let c: RGB = [b.data[i], b.data[i + 1], b.data[i + 2]];
      // A lattice of diamonds.
      if ((x - cx + y - cy + 999) % 10 === 0 || (x - cx - (y - cy) + 999) % 10 === 0) c = mix(c, T.accent, 0.1);
      const d = Math.hypot(x - cx + 0.5, y - cy + 0.5);
      const a = Math.atan2(y - cy, x - cx);
      // Two rings with runes between them, and a star of eight points inside.
      if (Math.abs(d - R) < 0.7 || Math.abs(d - R * 0.78) < 0.6) c = mix(T.accent, hex('#ffffff'), 0.15);
      else if (d > R * 0.8 && d < R * 0.97 && Math.cos(a * 12) > 0.7 && hash(Math.round(a * 30), Math.round(d), 5) > 0.35) c = mix(c, T.accent, 0.5);
      const star = R * 0.6 * (0.55 + 0.45 * Math.pow(Math.abs(Math.cos(a * 4)), 6));
      if (Math.abs(d - star) < 0.7) c = mix(c, T.accent, 0.75);
      if (d < 2.2) c = mix(T.accent, hex('#ffffff'), 0.5);
      b.set(x, y, c);
    }
  paintFrame(b, tier);
  return b;
}

// ------------------------------------------------------------- the pictures

type Mat = 'gold' | 'steel' | 'red' | 'blue' | 'ice' | 'green' | 'purple' | 'wood' | 'leather' | 'paper' | 'bone' | 'flame' | 'dark' | 'white' | 'teal';

const MATS: Record<Mat, RGB[]> = {
  gold: ['#4a2808', '#8e5a14', '#d09a2c', '#ffd35c', '#fff4c0'].map(hex),
  steel: ['#2a2c40', '#545a78', '#8c94b4', '#c8d0e8', '#ffffff'].map(hex),
  red: ['#3a0610', '#7a121e', '#c8283a', '#ff6a6a', '#ffc8c0'].map(hex),
  blue: ['#0a1a4a', '#1a3e8e', '#3a7ae0', '#7ab8ff', '#d8f0ff'].map(hex),
  ice: ['#1a3a5a', '#3a7aa8', '#7ac8e8', '#c8f0ff', '#ffffff'].map(hex),
  green: ['#0a2a10', '#1a5a20', '#3a9a38', '#7ad85a', '#d0ffb0'].map(hex),
  purple: ['#1e0a3a', '#4a1e7a', '#7a3ec0', '#b882ff', '#ecd8ff'].map(hex),
  wood: ['#1e0e06', '#4a2810', '#7a4a20', '#a87038', '#d8a060'].map(hex),
  leather: ['#2a1206', '#5a2e12', '#8e5224', '#c07c40', '#e8b070'].map(hex),
  paper: ['#5a4a38', '#a08c6e', '#d8c8a0', '#f4ead0', '#ffffff'].map(hex),
  bone: ['#4a4038', '#8a7e6e', '#c8bca8', '#ece4d4', '#ffffff'].map(hex),
  flame: ['#5a1004', '#c03a08', '#ff7a1a', '#ffc84a', '#fff8c0'].map(hex),
  dark: ['#06040c', '#140e22', '#241a3a', '#3a2c58', '#5a4a80'].map(hex),
  white: ['#6a6488', '#a8a4c8', '#dcdcf0', '#f8f8ff', '#ffffff'].map(hex),
  teal: ['#06282a', '#0e5a58', '#20a09a', '#5ae0d0', '#c8fff4'].map(hex),
};

/** How a shape shades: a sphere lit from the upper left, a flat face, or a cylinder lit from the left. */
type Shade = 'ball' | 'flat' | 'cyl' | number;

interface Shape {
  mat: Mat;
  shade: Shade;
  /** Is (x, y) (unit square, y down) inside; and for balls, the centre and radius. */
  inside: (x: number, y: number) => boolean;
  ball?: { cx: number; cy: number; rx: number; ry: number };
  /** Bevel where it meets other shapes (true for most). */
  bevel?: boolean;
  glow?: boolean;
}

const disc = (cx: number, cy: number, r: number, mat: Mat, shade: Shade = 'ball', ry = r): Shape => ({
  mat,
  shade,
  inside: (x, y) => ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 <= 1,
  ball: { cx, cy, rx: r, ry },
});
const ring = (cx: number, cy: number, r0: number, r1: number, mat: Mat, shade: Shade = 'flat'): Shape => ({
  mat,
  shade,
  bevel: true,
  inside: (x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    return d >= r0 && d <= r1;
  },
});
const rect = (x0: number, y0: number, x1: number, y1: number, mat: Mat, shade: Shade = 'flat'): Shape => ({
  mat,
  shade,
  bevel: true,
  inside: (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1,
  ball: { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2 },
});
const poly = (pts: number[], mat: Mat, shade: Shade = 'flat'): Shape => ({
  mat,
  shade,
  bevel: true,
  inside: (x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
      const [xi, yi, xj, yj] = [pts[i], pts[i + 1], pts[j], pts[j + 1]];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  },
});
const line = (x0: number, y0: number, x1: number, y1: number, wd: number, mat: Mat, shade: Shade = 'flat'): Shape => ({
  mat,
  shade,
  bevel: true,
  inside: (x, y) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - x0 - dx * t, y - y0 - dy * t) <= wd / 2;
  },
});
const star = (cx: number, cy: number, ro: number, ri: number, mat: Mat, n = 5, turn = -Math.PI / 2): Shape => {
  const pts: number[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = turn + (i * Math.PI) / n;
    const r = i % 2 ? ri : ro;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return { ...poly(pts, mat, 'flat'), ball: { cx, cy, rx: ro, ry: ro } };
};
const heart = (cx: number, cy: number, s: number, mat: Mat): Shape => ({
  mat,
  shade: 'ball',
  inside: (x, y) => {
    const u = (x - cx) / s;
    const v = -(y - cy) / s + 0.25;
    return (u * u + v * v - 0.5) ** 3 - u * u * v * v * v * 0.9 <= 0;
  },
  ball: { cx, cy: cy - s * 0.1, rx: s * 0.95, ry: s * 0.9 },
});
const glow = (s: Shape): Shape => ({ ...s, glow: true });

/** Every boon's picture, as shapes painted in order (later over earlier). */
const PICTURES: Record<string, (trait?: TraitId) => Shape[]> = {
  purse: () => [
    disc(0.48, 0.64, 0.3, 'leather', 'ball', 0.27),
    poly([0.34, 0.4, 0.62, 0.4, 0.56, 0.3, 0.4, 0.3], 'leather'),
    poly([0.3, 0.3, 0.38, 0.18, 0.5, 0.26, 0.62, 0.18, 0.68, 0.3], 'leather', 0.75),
    rect(0.36, 0.38, 0.62, 0.43, 'gold'),
    disc(0.76, 0.8, 0.12, 'gold', 'ball', 0.06),
    disc(0.8, 0.72, 0.12, 'gold', 'ball', 0.06),
    disc(0.22, 0.86, 0.1, 'gold', 'ball', 0.05),
    star(0.5, 0.66, 0.1, 0.045, 'gold'),
  ],
  tome: () => [
    poly([0.18, 0.22, 0.74, 0.14, 0.82, 0.8, 0.26, 0.88], 'purple'),
    poly([0.26, 0.88, 0.82, 0.8, 0.84, 0.86, 0.28, 0.94], 'paper', 0.8),
    poly([0.18, 0.22, 0.26, 0.88, 0.28, 0.94, 0.2, 0.3], 'dark'),
    star(0.5, 0.5, 0.18, 0.08, 'gold', 4, 0),
    disc(0.5, 0.5, 0.05, 'ice'),
    rect(0.74, 0.44, 0.86, 0.54, 'gold'),
  ],
  dice: () => [
    poly([0.12, 0.42, 0.42, 0.3, 0.6, 0.54, 0.3, 0.68], 'white'),
    poly([0.3, 0.68, 0.6, 0.54, 0.6, 0.76, 0.32, 0.9], 'bone', 0.35),
    poly([0.12, 0.42, 0.3, 0.68, 0.32, 0.9, 0.14, 0.64], 'bone', 0.55),
    disc(0.36, 0.49, 0.045, 'red', 'flat'),
    poly([0.48, 0.18, 0.78, 0.1, 0.9, 0.36, 0.6, 0.44], 'white'),
    poly([0.6, 0.44, 0.9, 0.36, 0.9, 0.56, 0.62, 0.64], 'bone', 0.35),
    disc(0.6, 0.22, 0.035, 'dark', 'flat'),
    disc(0.69, 0.27, 0.035, 'dark', 'flat'),
    disc(0.78, 0.32, 0.035, 'dark', 'flat'),
    glow(star(0.86, 0.78, 0.08, 0.03, 'gold', 4, 0)),
  ],
  titan: () => [
    disc(0.5, 0.66, 0.27, 'ice', 'ball'),
    disc(0.5, 0.7, 0.22, 'red', 'ball', 0.19),
    rect(0.42, 0.18, 0.58, 0.42, 'ice', 'cyl'),
    rect(0.4, 0.1, 0.6, 0.2, 'wood', 'cyl'),
    disc(0.42, 0.58, 0.05, 'white', 'flat'),
    glow(star(0.2, 0.3, 0.07, 0.025, 'red', 4, 0)),
  ],
  drums: () => [
    rect(0.2, 0.42, 0.8, 0.82, 'red', 'cyl'),
    disc(0.5, 0.82, 0.3, 'red', 'cyl', 0.08),
    line(0.2, 0.5, 0.8, 0.74, 0.03, 'gold'),
    line(0.2, 0.74, 0.8, 0.5, 0.03, 'gold'),
    disc(0.5, 0.42, 0.3, 'bone', 'flat', 0.1),
    ring(0.5, 0.42, 0.27, 0.3, 'gold'),
    line(0.14, 0.12, 0.44, 0.38, 0.06, 'wood'),
    line(0.86, 0.12, 0.56, 0.38, 0.06, 'wood'),
    disc(0.14, 0.12, 0.06, 'bone'),
    disc(0.86, 0.12, 0.06, 'bone'),
  ],
  spring: () => [
    disc(0.5, 0.82, 0.34, 'steel', 'ball', 0.1),
    disc(0.5, 0.8, 0.28, 'blue', 'flat', 0.07),
    poly([0.5, 0.12, 0.7, 0.46, 0.62, 0.64, 0.38, 0.64, 0.3, 0.46], 'blue', 'ball'),
    disc(0.5, 0.5, 0.2, 'blue'),
    disc(0.44, 0.44, 0.06, 'white', 'flat'),
    glow(disc(0.22, 0.3, 0.05, 'ice')),
    glow(disc(0.8, 0.24, 0.04, 'ice')),
  ],
  crest: () => [
    poly([0.16, 0.14, 0.84, 0.14, 0.84, 0.5, 0.5, 0.92, 0.16, 0.5], 'steel'),
    poly([0.22, 0.2, 0.78, 0.2, 0.78, 0.5, 0.5, 0.84, 0.22, 0.5], 'dark', 0.5),
  ],
  goose: () => [
    disc(0.5, 0.92, 0.36, 'dark', 'flat', 0.06),
    disc(0.5, 0.56, 0.3, 'gold', 'ball', 0.36),
    glow(star(0.8, 0.24, 0.09, 0.03, 'white', 4, 0)),
    glow(star(0.22, 0.36, 0.06, 0.02, 'white', 4, 0)),
  ],
  clover: () => [
    line(0.5, 0.52, 0.66, 0.92, 0.06, 'green'),
    disc(0.36, 0.36, 0.17, 'green'),
    disc(0.64, 0.36, 0.17, 'green'),
    disc(0.36, 0.64, 0.17, 'green'),
    disc(0.64, 0.64, 0.17, 'green'),
    disc(0.5, 0.5, 0.06, 'gold'),
  ],
  hoard: () => [
    disc(0.5, 0.82, 0.4, 'gold', 'ball', 0.14),
    disc(0.36, 0.7, 0.14, 'gold', 'ball', 0.07),
    disc(0.62, 0.66, 0.14, 'gold', 'ball', 0.07),
    disc(0.5, 0.56, 0.14, 'gold', 'ball', 0.07),
    disc(0.3, 0.84, 0.13, 'gold', 'ball', 0.06),
    disc(0.7, 0.84, 0.13, 'gold', 'ball', 0.06),
    poly([0.5, 0.18, 0.64, 0.32, 0.5, 0.5, 0.36, 0.32], 'red', 'ball'),
    poly([0.5, 0.18, 0.64, 0.32, 0.5, 0.3], 'red', 0.9),
  ],
  banner: () => [
    line(0.26, 0.08, 0.26, 0.94, 0.06, 'wood'),
    disc(0.26, 0.08, 0.06, 'gold'),
    poly([0.29, 0.14, 0.84, 0.18, 0.74, 0.4, 0.86, 0.62, 0.29, 0.58], 'red', 'cyl'),
    star(0.54, 0.38, 0.12, 0.05, 'gold'),
  ],
  aegis: () => [
    disc(0.5, 0.52, 0.38, 'blue'),
    ring(0.5, 0.52, 0.32, 0.38, 'steel'),
    line(0.5, 0.16, 0.5, 0.88, 0.05, 'steel'),
    line(0.14, 0.52, 0.86, 0.52, 0.05, 'steel'),
    disc(0.5, 0.52, 0.12, 'gold'),
  ],
  pact: () => [
    line(0.22, 0.82, 0.62, 0.32, 0.1, 'steel'),
    poly([0.56, 0.34, 0.86, 0.1, 0.66, 0.42], 'steel'),
    line(0.18, 0.58, 0.44, 0.84, 0.06, 'gold'),
    line(0.1, 0.92, 0.26, 0.74, 0.08, 'leather'),
    poly([0.74, 0.5, 0.86, 0.68, 0.74, 0.8, 0.62, 0.68], 'red', 'ball'),
    disc(0.74, 0.72, 0.1, 'red'),
  ],
  axe: () => [
    line(0.22, 0.9, 0.62, 0.14, 0.08, 'wood'),
    poly([0.44, 0.22, 0.86, 0.12, 0.92, 0.46, 0.58, 0.48], 'steel'),
    poly([0.86, 0.12, 0.92, 0.46, 0.84, 0.3], 'white', 0.9),
    disc(0.52, 0.34, 0.06, 'gold'),
  ],
  lifeline: () => [heart(0.5, 0.5, 0.36, 'red'), rect(0.44, 0.3, 0.56, 0.66, 'white'), rect(0.32, 0.42, 0.68, 0.54, 'white')],
  ascend: () => [
    poly([0.5, 0.1, 0.84, 0.46, 0.64, 0.46, 0.64, 0.9, 0.36, 0.9, 0.36, 0.46, 0.16, 0.46], 'gold', 'cyl'),
    glow(star(0.2, 0.2, 0.09, 0.035, 'white')),
    glow(star(0.82, 0.74, 0.09, 0.035, 'white')),
  ],
  host: () => [
    poly([0.24, 0.5, 0.26, 0.24, 0.5, 0.1, 0.74, 0.24, 0.76, 0.5, 0.76, 0.86, 0.24, 0.86], 'steel', 'cyl'),
    rect(0.3, 0.44, 0.7, 0.5, 'dark'),
    line(0.5, 0.52, 0.5, 0.82, 0.05, 'dark'),
    line(0.5, 0.1, 0.5, 0.0, 0.08, 'red'),
    disc(0.82, 0.78, 0.14, 'green'),
    rect(0.78, 0.7, 0.86, 0.86, 'white'),
    rect(0.74, 0.74, 0.9, 0.82, 'white'),
  ],
  star: () => [
    poly([0.14, 0.7, 0.86, 0.7, 0.7, 0.8, 0.7, 0.92, 0.3, 0.92, 0.3, 0.8], 'steel'),
    rect(0.1, 0.62, 0.9, 0.7, 'steel'),
    glow(star(0.5, 0.32, 0.26, 0.11, 'gold')),
    glow(disc(0.2, 0.18, 0.03, 'white')),
    glow(disc(0.84, 0.28, 0.03, 'white')),
  ],
  glass: () => [
    rect(0.22, 0.36, 0.86, 0.56, 'ice', 'cyl'),
    disc(0.86, 0.46, 0.06, 'dark', 'flat', 0.1),
    ring(0.36, 0.72, 0.1, 0.2, 'wood'),
    disc(0.36, 0.72, 0.05, 'gold'),
    line(0.4, 0.4, 0.52, 0.52, 0.02, 'white'),
    line(0.52, 0.52, 0.62, 0.42, 0.02, 'white'),
    glow(disc(0.94, 0.46, 0.06, 'flame')),
  ],
  ransom: () => [
    poly([0.14, 0.34, 0.32, 0.5, 0.5, 0.22, 0.68, 0.5, 0.86, 0.34, 0.8, 0.74, 0.2, 0.74], 'gold'),
    rect(0.2, 0.7, 0.8, 0.82, 'gold', 'cyl'),
    disc(0.5, 0.58, 0.07, 'red'),
    disc(0.3, 0.76, 0.04, 'blue', 'flat'),
    disc(0.7, 0.76, 0.04, 'green', 'flat'),
    disc(0.14, 0.32, 0.05, 'gold'),
    disc(0.5, 0.2, 0.05, 'gold'),
    disc(0.86, 0.32, 0.05, 'gold'),
  ],
  wish: () => [
    poly([0.1, 0.9, 0.5, 0.42, 0.58, 0.52], 'purple', 0.45),
    poly([0.2, 0.92, 0.54, 0.5, 0.58, 0.58], 'blue', 0.6),
    glow(star(0.62, 0.38, 0.28, 0.12, 'gold')),
    disc(0.62, 0.4, 0.07, 'white'),
    glow(disc(0.2, 0.2, 0.03, 'white')),
    glow(disc(0.88, 0.8, 0.03, 'white')),
  ],
};

/** Paint a picture of `s` x `s` from shapes. */
function paintShapes(shapes: Shape[], s: number): Bitmap {
  const b = new Bitmap(s, s);
  const id = new Int16Array(s * s).fill(-1);
  const val = new Float32Array(s * s);
  const L = { x: -0.55, y: -0.6, z: 0.58 };
  shapes.forEach((sh, n) => {
    for (let py = 0; py < s; py++)
      for (let px = 0; px < s; px++) {
        const x = (px + 0.5) / s;
        const y = (py + 0.5) / s;
        if (!sh.inside(x, y)) continue;
        let v = 0.55;
        if (typeof sh.shade === 'number') v = sh.shade;
        else if (sh.shade === 'ball' && sh.ball) {
          const nx = (x - sh.ball.cx) / sh.ball.rx;
          const ny = (y - sh.ball.cy) / sh.ball.ry;
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          v = 0.12 + 0.88 * Math.max(0, nx * L.x + ny * L.y + nz * L.z);
        } else if (sh.shade === 'cyl' && sh.ball) {
          const nx = Math.max(-1, Math.min(1, (x - sh.ball.cx) / sh.ball.rx));
          v = 0.2 + 0.7 * Math.max(0, -nx * 0.7 + Math.sqrt(1 - nx * nx) * 0.7);
        }
        id[py * s + px] = n;
        val[py * s + px] = v;
      }
  });
  // Bevels where a flat part meets air or another part: lit above and left, shaded below and right.
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= s || y >= s ? -1 : id[y * s + x]);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const n = id[y * s + x];
      if (n < 0) continue;
      const sh = shapes[n];
      let v = val[y * s + x];
      if (sh.bevel || sh.shade === 'flat' || typeof sh.shade === 'number') {
        if (at(x, y - 1) !== n || at(x - 1, y) !== n) v += 0.22;
        else if (at(x, y + 1) !== n || at(x + 1, y) !== n) v -= 0.2;
      }
      b.set(x, y, ramp(MATS[sh.mat], v, x, y));
    }
  // The outline: every empty pixel beside the picture, darkest of what it borders.
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      if (id[y * s + x] >= 0) continue;
      const near = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].filter((n) => n >= 0);
      if (!near.length) continue;
      const sh = shapes[near[0]];
      b.set(x, y, sh.glow ? mix(MATS[sh.mat][1], INK, 0.2) : mix(MATS[sh.mat][0], INK, 0.55));
    }
  return b;
}

/** A crest: the shield in the trait's colour, its mark (the trait badge's, scaled up) across it. */
function paintCrest(trait: TraitId, s: number): Bitmap {
  const b = paintShapes(PICTURES.crest(), s);
  const c = TRAITS[trait].color;
  const col: RGB = [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  const mark = TRAIT_MARKS[trait];
  const cell = Math.max(1, Math.floor((s * 0.5) / 7));
  const ox = Math.round(s / 2 - (cell * 7) / 2);
  const oy = Math.round(s * 0.24);
  mark.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== '#') return;
      for (let dy = 0; dy < cell; dy++)
        for (let dx = 0; dx < cell; dx++) {
          const lit = dx === 0 && dy === 0 && cell > 1;
          b.set(ox + x * cell + dx, oy + y * cell + dy, lit ? mix(col, hex('#ffffff'), 0.45) : dy === cell - 1 && cell > 2 ? mix(col, INK, 0.3) : col);
        }
    }),
  );
  // The shield's rim takes the trait's colour too.
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;
      if (!b.data[i + 3]) continue;
      const px: RGB = [b.data[i], b.data[i + 1], b.data[i + 2]];
      const grey = Math.abs(px[0] - px[2]) < 40 && px[0] > 60;
      if (grey) b.set(x, y, mix(px, col, 0.35));
    }
  return b;
}

/** A boon's picture, `s` px square (texture key). */
export function boonIcon(scene: Phaser.Scene, id: string, s: number): string {
  const key = `boon_icon_${id}_${s}`;
  return scene.textures.exists(key) ? key : add(scene, key, paintBoonIcon(id, s));
}

export function paintBoonIcon(id: string, s: number): Bitmap {
  const d = boonDef(id);
  return d?.trait ? paintCrest(d.trait, s) : paintShapes((PICTURES[d?.icon ?? 'purse'] ?? PICTURES.purse)(), s);
}

/** A kept boon's small badge, 14 px: its picture on a chip rimmed in its tier's metal. */
export function boonBadge(scene: Phaser.Scene, id: string): string {
  const key = `boon_badge_${id}`;
  if (scene.textures.exists(key)) return key;
  const d = boonDef(id);
  const tier = d?.tier ?? 0;
  const S = 14;
  const b = new Bitmap(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const e = Math.min(x, y, S - 1 - x, S - 1 - y);
      if ((x === 0 || x === S - 1) && (y === 0 || y === S - 1)) continue;
      if (e === 0) b.set(x, y, INK);
      else if (e === 1) b.set(x, y, metal(tier, y < S / 2 ? 0.8 : 0.4, x, y, S, S));
      else b.set(x, y, mix(TIERS[tier].night, NIGHT, 0.3 + y / S / 3));
    }
  const icon = d?.trait ? paintCrest(d.trait, 10) : paintShapes((PICTURES[d?.icon ?? 'purse'] ?? PICTURES.purse)(), 10);
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 10; x++) {
      const i = (y * 10 + x) * 4;
      if (icon.data[i + 3]) b.set(x + 2, y + 2, [icon.data[i], icon.data[i + 1], icon.data[i + 2]]);
    }
  return add(scene, key, b);
}
