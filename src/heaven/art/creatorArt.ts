// The character creator's art: a dawn sky, soft clouds, the cloud the
// wanderer stands on and its glow, cream-and-gold panels, little icons and
// two fonts that suit parchment (the game's own font has a near-black
// outline, too heavy on cream). Everything is painted here as plain pixels
// and registered once per scene; the scene removes what it made when it
// closes, so nothing piles up in GPU memory.

import type Phaser from 'phaser';
import { Bitmap, bayer, mix } from '../../art/bitmap';
import { hex, type RGB } from '../../art/pixel';
import { GLYPH_W } from '../../art/glyphs';

// ---------------------------------------------------------------- Palette

/** The creator's colours as numbers, for Graphics and tints. */
export const C = {
  ink: 0x6b4560,
  inkSoft: 0xa5809a,
  inkFaint: 0xc9adbd,
  plum: 0x7a4260,
  cream: 0xfffaf0,
  creamDeep: 0xf6e8cf,
  field: 0xf4e6cb,
  fieldEdge: 0xe2cda2,
  fieldDark: 0xd2b98a,
  gold: 0xe6b95c,
  goldLit: 0xfff0b4,
  goldDeep: 0xbf8c3c,
  rose: 0xef8fa8,
  roseLit: 0xffc6d3,
  roseDeep: 0xb8587a,
  blush: 0xffe4ea,
  lilac: 0xd9c9ef,
  lilacLit: 0xf7f1fd,
  lilacDeep: 0x9c84c2,
  white: 0xffffff,
} as const;

export const rgb = (n: number): RGB => [(n >> 16) & 255, (n >> 8) & 255, n & 255];

// ---------------------------------------------------------------- Text

/** Ink text on parchment (the fonts are made in creatorFont.ts), by its top-left corner. */
export function inkText(scene: Phaser.Scene, x: number, y: number, text: string, tint: number = C.ink): Phaser.GameObjects.BitmapText {
  return scene.add.bitmapText(Math.round(x), Math.round(y), 'hl_ink', text.toUpperCase()).setTint(tint).setOrigin(0);
}

/** White text with a soft outline, by its top-left corner. */
export function softText(scene: Phaser.Scene, x: number, y: number, text: string): Phaser.GameObjects.BitmapText {
  return scene.add.bitmapText(Math.round(x), Math.round(y), 'hl_soft', text.toUpperCase()).setLetterSpacing(-1).setOrigin(0);
}

/** How wide an ink string is, px (6 a letter, less the last gap). */
export const inkWidth = (s: string): number => Math.max(0, s.length * (GLYPH_W + 1) - 1);

// ---------------------------------------------------------------- Sky

const SKY_STOPS: [number, RGB][] = [
  [0, hex('#9cc0ec')],
  [0.38, hex('#c8d2f4')],
  [0.7, hex('#f2d2e4')],
  [1, hex('#ffe3c6')],
];
const SKY_BANDS = 16;

function skyAt(t: number): RGB {
  for (let i = 1; i < SKY_STOPS.length; i++) {
    const [t1, c1] = SKY_STOPS[i];
    const [t0, c0] = SKY_STOPS[i - 1];
    if (t <= t1) return mix(c0, c1, (t - t0) / (t1 - t0));
  }
  return SKY_STOPS[SKY_STOPS.length - 1][1];
}

/** A 4 px wide strip of the dawn sky, `h` tall, dithered between bands: tiled across the screen. */
export function skyTexture(scene: Phaser.Scene, h: number): string {
  const key = `hl_cr_sky_${h}`;
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(4, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < 4; x++) {
      const t = y / Math.max(1, h - 1);
      const q = Math.min(1, Math.floor(t * SKY_BANDS + bayer(x, y)) / SKY_BANDS);
      b.set(x, y, skyAt(q));
    }
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

// ---------------------------------------------------------------- Clouds

const CLOUD_TOP = hex('#ffffff');
const CLOUD_MID = hex('#fbf5fb');
const CLOUD_LOW = hex('#ebdff4');
const CLOUD_SHADE = hex('#d9c8ea');
const CLOUD_DEEP = hex('#c6b2df');

/** A seeded little random, so the clouds come out the same every time. */
function seeded(seed: number): () => number {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/**
 * Pixel clouds from a mask: a bright rim where the sky is above, lilac
 * shade toward the flat base, a deeper line along the very bottom.
 */
function shadeCloud(b: Bitmap, inside: (x: number, y: number) => boolean, alpha = 255): void {
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!inside(x, y)) continue;
      let c = CLOUD_MID;
      if (!inside(x, y - 1) || !inside(x, y - 2)) c = CLOUD_TOP;
      if (!inside(x, y + 3)) c = CLOUD_LOW;
      if (!inside(x, y + 2)) c = CLOUD_SHADE;
      if (!inside(x, y + 1)) c = CLOUD_DEEP;
      // Puffs overlap: a soft shade line under each puff's top rim.
      if (c === CLOUD_MID && !inside(x - 2, y) && inside(x, y - 1)) c = CLOUD_LOW;
      b.set(x, y, c, alpha);
    }
  }
}

function puffs(w: number, h: number, seed: number, wrap = false): (x: number, y: number) => boolean {
  const r = seeded(seed);
  const circles: [number, number, number][] = [];
  const n = Math.max(3, Math.round(w / 9));
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    const mid = wrap ? 0.75 : 1 - Math.abs(f - 0.5) * 1.6;
    const rad = Math.max(3, (h * 0.32 + r() * h * 0.28) * (0.55 + mid * 0.5));
    circles.push([f * w + (r() - 0.5) * 4, h - 2 - rad * 0.55, rad]);
  }
  return (x, y) => {
    if (y < 0 || y >= h) return false;
    if (!wrap && (x < 0 || x >= w)) return false;
    const base = h - 2;
    if (y > base) return false;
    for (const [cx, cy, rad] of circles) {
      for (const off of wrap ? [-w, 0, w] : [0]) {
        const dx = x + 0.5 - (cx + off);
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= rad * rad) return true;
        // A flat base between the outermost puffs.
        if (y >= cy && y <= base && Math.abs(dx) < rad * 0.9) return true;
      }
    }
    return false;
  };
}

/** The drifting clouds: three sizes. */
export const CLOUD_SIZES: [number, number][] = [
  [58, 18],
  [40, 14],
  [26, 10],
];

export function cloudTextures(scene: Phaser.Scene): string[] {
  return CLOUD_SIZES.map(([w, h], i) => {
    const key = `hl_cr_cloud${i}`;
    if (!scene.textures.exists(key)) {
      const b = new Bitmap(w, h);
      shadeCloud(b, puffs(w, h, 11 + i * 7));
      scene.textures.addCanvas(key, b.toCanvas());
    }
    return key;
  });
}

/** A bank of cloud tops that tiles sideways, for the bottom of the screen. */
export function cloudBankTexture(scene: Phaser.Scene): string {
  const key = 'hl_cr_bank';
  if (scene.textures.exists(key)) return key;
  const w = 96;
  const h = 30;
  const b = new Bitmap(w, h);
  const m = puffs(w, h + 6, 5, true);
  const inside = (x: number, y: number) => y >= h - 3 || m(((x % w) + w) % w, y);
  shadeCloud(b, (x, y) => y >= 0 && y < h && inside(x, y));
  // The bank has no base: it runs off the bottom, so fill the foot plainly.
  for (let y = h - 4; y < h; y++) for (let x = 0; x < w; x++) b.set(x, y, CLOUD_MID);
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** The cloud the wanderer stands on (in the figure's own pixels, drawn at its zoom), with a soft shadow where the feet are. */
export const PEDESTAL_W = 38;
export const PEDESTAL_H = 13;
/** The row of the pedestal the soles stand on. */
export const PEDESTAL_FEET = 3;

export function pedestalTexture(scene: Phaser.Scene): string {
  const key = 'hl_cr_pedestal';
  if (scene.textures.exists(key)) return key;
  const w = PEDESTAL_W;
  const h = PEDESTAL_H;
  const b = new Bitmap(w, h);
  const cx = w / 2;
  // An oval top seen from above, with puffs bulging round its lower half.
  const inside = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const dx = (x + 0.5 - cx) / (w / 2 - 1);
    const dy = (y + 0.5 - 4.5) / 4;
    if (dx * dx + dy * dy <= 1) return true;
    for (const [px, py, r] of [[7, 7.5, 4], [13, 9, 4.2], [19, 9.5, 4], [25, 9, 4.2], [31, 7.5, 4], [4, 5.5, 3], [34, 5.5, 3]] as const) {
      const ex = x + 0.5 - px;
      const ey = y + 0.5 - py;
      if (ex * ex + ey * ey <= r * r) return true;
    }
    return false;
  };
  shadeCloud(b, inside);
  // The shadow of the feet: an oval of lilac in the middle of the top.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - cx) / 7;
      const dy = (y + 0.5 - PEDESTAL_FEET - 0.5) / 1.7;
      const d = dx * dx + dy * dy;
      if (d <= 1 && b.alpha(x, y)) b.set(x, y, d < 0.45 ? CLOUD_DEEP : CLOUD_SHADE);
    }
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** The warm glow behind the wanderer, dithered in rings (figure pixels too). */
export const HALO_R = 24;

export function haloTexture(scene: Phaser.Scene): string {
  const key = 'hl_cr_halo';
  if (scene.textures.exists(key)) return key;
  const d = HALO_R * 2;
  const b = new Bitmap(d, d);
  const warm = hex('#fff4dc');
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const r = Math.hypot(x + 0.5 - HALO_R, (y + 0.5 - HALO_R) * 1.08) / HALO_R;
      if (r >= 1) continue;
      const level = Math.floor((1 - r) * 4 + bayer(x, y) * 0.999);
      if (level <= 0) continue;
      b.set(x, y, warm, [0, 34, 62, 96, 128][level]);
    }
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** One soft sparkle mote and a small plus-shaped twinkle. */
export function moteTexture(scene: Phaser.Scene): string {
  const key = 'hl_cr_mote';
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(8, 3);
  const w = hex('#fffbe8');
  const g = hex('#ffe7a8');
  b.set(0, 0, w);
  b.set(1, 0, g, 160);
  b.set(0, 1, g, 160);
  b.set(5, 0, g, 200);
  b.set(4, 1, g, 200);
  b.set(5, 1, w);
  b.set(6, 1, g, 200);
  b.set(5, 2, g, 200);
  const tex = scene.textures.addCanvas(key, b.toCanvas())!;
  tex.add('dot', 0, 0, 0, 2, 2);
  tex.add('plus', 0, 4, 0, 3, 3);
  return key;
}

// ---------------------------------------------------------------- Panels

export interface Card {
  top: number;
  bottom: number;
  border: number;
  lit: number;
  dark: number;
  outline: number;
  alpha?: number;
}

export const PARCHMENT: Card = { top: 0xfffaf0, bottom: 0xf7e8cd, border: C.gold, lit: C.goldLit, dark: C.goldDeep, outline: 0x8a5a5e };
export const CLOUD_CARD: Card = { top: 0xfaf6fe, bottom: 0xe6dbf5, border: 0xcdbbe8, lit: 0xffffff, dark: 0xa58ecd, outline: 0x7d6496 };
export const ROSE_CARD: Card = { top: 0xffb7c6, bottom: 0xec809a, border: C.gold, lit: C.goldLit, dark: C.goldDeep, outline: 0x8a3f5c };
export const ROSE_DOWN: Card = { top: 0xe0708c, bottom: 0xf59bb0, border: C.goldDeep, lit: C.gold, dark: C.goldLit, outline: 0x8a3f5c };
export const CREAM_CARD: Card = { top: 0xfffcf4, bottom: 0xf6e9d0, border: 0xe9d3a6, lit: 0xffffff, dark: 0xcfb07a, outline: 0x9a6e66 };
export const FIELD: Card = { top: 0xefdfc0, bottom: 0xf7ebd4, border: 0xe0c99c, lit: 0xd7bf90, dark: 0xfbf2e0, outline: 0xc9ad7c };
export const TILE_CARD: Card = { top: 0xfdf5e6, bottom: 0xf6e9d1, border: 0xeddcbc, lit: 0xfffbf2, dark: 0xdcc39a, outline: 0xcfb48a };
export const TILE_PICKED: Card = { top: 0xffeef1, bottom: 0xffd9e2, border: C.gold, lit: C.goldLit, dark: C.goldDeep, outline: 0x9a5a6e };

/**
 * A small card drawn with rectangles: rounded by a cut corner pixel, an
 * outline, a border lit on its top and left, and a fill in two bands.
 * Used for buttons, fields and tiles; the big panels use `panelTexture`.
 */
export function drawCard(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, st: Card, alpha = st.alpha ?? 1): void {
  x = Math.round(x);
  y = Math.round(y);
  g.fillStyle(st.outline, alpha);
  g.fillRect(x + 1, y, w - 2, 1).fillRect(x + 1, y + h - 1, w - 2, 1).fillRect(x, y + 1, 1, h - 2).fillRect(x + w - 1, y + 1, 1, h - 2);
  g.fillStyle(st.lit, alpha).fillRect(x + 1, y + 1, w - 2, 1).fillRect(x + 1, y + 1, 1, h - 2);
  g.fillStyle(st.dark, alpha).fillRect(x + 1, y + h - 2, w - 2, 1).fillRect(x + w - 2, y + 2, 1, h - 3);
  const ih = h - 3;
  const half = Math.ceil(ih / 2);
  g.fillStyle(st.top, alpha).fillRect(x + 2, y + 2, w - 4, half);
  g.fillStyle(st.bottom, alpha).fillRect(x + 2, y + 2 + half, w - 4, ih - half - 1);
  // The corners' inner pixels in the border's colour, so the round reads.
  g.fillStyle(st.border, alpha).fillRect(x + 1, y + 1, 1, 1).fillRect(x + w - 2, y + 1, 1, 1).fillRect(x + 1, y + h - 2, 1, 1).fillRect(x + w - 2, y + h - 2, 1, 1);
}

/**
 * A big panel as a texture: rounded corners, outline, two-tone border, a
 * dithered fill from top to bottom colour, a cream highlight under the top
 * edge and tiny gold studs in the corners.
 */
export function panelTexture(scene: Phaser.Scene, name: string, w: number, h: number, st: Card, studs = true): string {
  const key = `hl_cr_${name}_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(w, h);
  const top = rgb(st.top);
  const bottom = rgb(st.bottom);
  const R = 3;
  // Distance into the shape, with rounded corners.
  const depth = (x: number, y: number): number => {
    const ex = Math.min(x, w - 1 - x);
    const ey = Math.min(y, h - 1 - y);
    if (ex < R && ey < R) {
      const dx = R - ex - 0.5;
      const dy = R - ey - 0.5;
      return Math.floor(R - Math.hypot(dx, dy) + 0.35);
    }
    return Math.min(ex, ey);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = depth(x, y);
      if (d < 0) continue;
      if (d === 0) b.set(x, y, rgb(st.outline));
      else if (d === 1) {
        // Lit where the nearest edge is the top or the left.
        const near = Math.min(x, y, w - 1 - x, h - 1 - y);
        b.set(x, y, rgb(near === y || near === x ? st.lit : st.dark));
      } else if (d === 2) b.set(x, y, rgb(st.border));
      else {
        const t = (y - 3) / Math.max(1, h - 7);
        const q = Math.min(1, Math.floor(t * 5 + bayer(x, y)) / 5);
        let c = mix(top, bottom, q);
        if (d === 3) c = mix(c, [255, 255, 255], y < h / 2 ? 0.5 : 0.1);
        b.set(x, y, c, Math.round((st.alpha ?? 1) * 255));
      }
    }
  }
  if (studs && w > 24 && h > 24) {
    for (const [sx, sy] of [[5, 5], [w - 7, 5], [5, h - 7], [w - 7, h - 7]]) {
      b.set(sx, sy, rgb(C.goldLit));
      b.set(sx + 1, sy, rgb(C.gold));
      b.set(sx, sy + 1, rgb(C.gold));
      b.set(sx + 1, sy + 1, rgb(C.goldDeep));
    }
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

// ---------------------------------------------------------------- Icons

const ICON_OUTLINE = hex('#7a4260');
const ICON_PAL: Record<string, string> = {
  S: '#f4caa8',
  K: '#6b4560',
  P: '#f28a9c',
  H: '#8a5232',
  R: '#ef8fa8',
  r: '#c96484',
  W: '#ffffff',
  Y: '#f4c55a',
  y: '#c9903c',
  G: '#fff3c0',
  L: '#b9a0e6',
  l: '#8b6fc4',
  b: '#6b86c0',
  C: '#fff6e6',
};

/** The icons, each as rows of colours; an outline is added round each one. */
const ICONS: Record<string, string[]> = {
  body: ['...SSS...', '..SSSSS..', '..SSSSS..', '...SSS...', '..RRRRR..', '.RRRRRRR.', '.SRRRRRS.', '..bbbbb..', '..bb.bb..', '..bb.bb..'],
  face: ['..SSSSS..', '.SSSSSSS.', 'SSKSSSKSS', 'SSKSSSKSS', 'SPSSSSSPS', 'SSSSSSSSS', 'SSKSSSKSS', 'SSSKKKSSS', '.SSSSSSS.', '..SSSSS..'],
  hair: ['..HHHHH..', '.HHHHHHH.', 'HHHHHHHHH', 'HHSSSSHHH', 'HSSKSKSSH', 'HSSSSSSSH', 'HSPSSSPSH', 'HHSSSSSHH', 'HH.SSS.HH', 'H.......H'],
  clothes: ['..RRW.WRR..', '.RRRRWRRRR.', 'RRRRRRRRRRR', 'RRRRRRRRRRR', '.r.RRRRR.r.', '...RRRRR...', '...RRRRR...', '...rrrrr...'],
  accessories: ['RR.....RR', 'RWR...RRR', 'RRRR.RRRR', 'RRRRYRRRR', 'RRRR.RRRR', 'RRr...rRR', 'Rr.....rR'],
  carry: ['...yyy...', '..y...y..', '.yyyyyyy.', '.yGGGGGy.', '.yGYYYGy.', '.yGYWYGy.', '.yGGGGGy.', '.yyyyyyy.'],
  outfits: ['....yy...', '...y..y..', '......y..', '.....y...', '....y....', '...yyy...', '..y...y..', '.y.....y.', 'yyyyyyyyy'],
  dice: ['WWWWWWWWW', 'WKWWWWWKW', 'WWWWWWWWW', 'WWWWKWWWW', 'WWWWWWWWW', 'WKWWWWWKW', 'WWWWWWWWW', 'LLLLLLLLL'],
  wave: ['.S.S.S...', '.S.S.S...', '.SSSSS.S.', '.SSSSSSS.', '.SSSSSS..', '..SSSS...'],
  cheer: ['....Y....', '...YYY...', 'YYYYGYYYY', '.YYYYYYY.', '..YYYYY..', '.YYY.YYY.', '.YY...YY.'],
  dance: ['..LLLLL', '..LLLLL', '..L...L', '..L...L', 'LLL.LLL', 'LLL.LLL'],
  heart: ['.RR.RR.', 'RWRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'],
  check: ['.....W', '....WW', 'W..WW.', 'WWWW..', '.WW...'],
  pencil: ['.....RR', '....YRR', '...YYY.', '..YYY..', '.CYY...', '.CC....', 'K......'],
  plus: ['..W..', '..W..', 'WWWWW', '..W..', '..W..'],
  cross: ['W...W', '.W.W.', '..W..', '.W.W.', 'W...W'],
  left: ['...W', '..WW', '.WWW', 'WWWW', '.WWW', '..WW', '...W'],
  right: ['W...', 'WW..', 'WWW.', 'WWWW', 'WWW.', 'WW..', 'W...'],
  keep: ['..W..', '..W..', 'WWWWW', '.WWW.', '..W..', 'W...W', 'WWWWW'],
  star: ['..Y..', '.YGY.', 'YGGGY', '.YGY.', '..Y..'],
};

const ICON_CELL = 14;

/** Every icon on one sheet ('hl_cr_icons'), framed by name. */
export function iconTexture(scene: Phaser.Scene): string {
  const key = 'hl_cr_icons';
  if (scene.textures.exists(key)) return key;
  const names = Object.keys(ICONS);
  const per = 8;
  const b = new Bitmap(per * ICON_CELL, Math.ceil(names.length / per) * ICON_CELL);
  const frames: [string, number, number, number, number][] = [];
  names.forEach((name, i) => {
    const rows = ICONS[name];
    const w = Math.max(...rows.map((r) => r.length));
    const h = rows.length;
    const ox = (i % per) * ICON_CELL + 1;
    const oy = Math.floor(i / per) * ICON_CELL + 1;
    const at = (x: number, y: number) => (y >= 0 && y < h && x >= 0 && x < rows[y].length ? ICON_PAL[rows[y][x]] : undefined);
    for (let y = -1; y <= h; y++) {
      for (let x = -1; x <= w; x++) {
        const c = at(x, y);
        if (c) b.set(ox + x, oy + y, hex(c));
        else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) b.set(ox + x, oy + y, ICON_OUTLINE);
      }
    }
    frames.push([name, ox - 1, oy - 1, w + 2, h + 2]);
  });
  const tex = scene.textures.addCanvas(key, b.toCanvas())!;
  for (const [n, x, y, w, h] of frames) tex.add(n, 0, x, y, w, h);
  return key;
}

export type IconName = keyof typeof ICONS;

// ---------------------------------------------------------------- Lighting

/** The key light the creator's wanderer is lit by: from the top left, toward the viewer. */
const LIGHT = (() => {
  const v = [-0.45, -0.55, 0.7];
  const n = Math.hypot(...v);
  return v.map((k) => k / n);
})();
/** How much the normal map shapes the light, and a touch of warmth from the glow behind. */
const LIGHT_BASE = 0.8;
const LIGHT_SHAPE = 0.3;
const WARM: RGB = [1.03, 1.0, 0.96];
const GLOW = 0.75;

/**
 * An atlas's (or a frame's) layers baked into one picture: the diffuse lit by its normals
 * (the menus have no lights of their own) and its glow added on top. One
 * texture instead of four, which is all a preview needs.
 */
export function bakeLit(a: { w: number; h: number; diffuse: Uint8ClampedArray; normal: Uint8ClampedArray; emissive: Uint8ClampedArray }): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(a.w * a.h * 4);
  for (let i = 0; i < a.w * a.h * 4; i += 4) {
    const on = a.diffuse[i + 3] > 0;
    const glow = a.emissive[i + 3] > 0;
    if (!on && !glow) continue;
    let r = 0;
    let g = 0;
    let bl = 0;
    if (on) {
      const nx = a.normal[i] / 127.5 - 1;
      const ny = -(a.normal[i + 1] / 127.5 - 1);
      const nz = a.normal[i + 2] / 127.5 - 1;
      const lit = LIGHT_BASE + LIGHT_SHAPE * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      r = a.diffuse[i] * lit * WARM[0];
      g = a.diffuse[i + 1] * lit * WARM[1];
      bl = a.diffuse[i + 2] * lit * WARM[2];
    }
    if (glow) {
      r += a.emissive[i] * GLOW;
      g += a.emissive[i + 1] * GLOW;
      bl += a.emissive[i + 2] * GLOW;
    }
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = bl;
    out[i + 3] = on ? a.diffuse[i + 3] : Math.min(255, a.emissive[i + 3]);
  }
  return out;
}
