// Inventory art: the square tile behind every item icon, coloured by rarity
// (blue common, green uncommon, yellow rare, purple epic with slow waves
// moving through it, white legendary with turning rays of light and
// twinkles), plus the selection ring, the equipped tick and a small glyph for
// each gear slot. The epic and legendary tiles are a few pre-drawn frames
// that the inventory steps through, so animating them costs a frame swap.

import type Phaser from 'phaser';
import { Bitmap, bayer, clamp01, mix } from './bitmap';
import { hex, type RGB } from './pixel';
import { RARITIES, RARITY, type Rarity } from '../game/gear';

/** Tile size, art pixels: a 32x32 icon with a two-pixel frame. */
export const TILE = 36;
/** Frames in the animated tiles, and how long one loop takes (ms). */
export const TILE_FRAMES: Record<Rarity, number> = { common: 1, uncommon: 1, rare: 1, epic: 8, legendary: 8 };
export const TILE_LOOP: Record<Rarity, number> = { common: 1, uncommon: 1, rare: 1, epic: 1400, legendary: 1800 };

const OUTLINE = hex('#0b0818');
const NIGHT = hex('#0b0818');
const WHITE: RGB = [255, 255, 255];

const toRGB = (n: number): RGB => [(n >> 16) & 255, (n >> 8) & 255, n & 255];

/** Distance in from the nearest edge, or -1 on a cut corner. */
function edge(x: number, y: number, s: number): number {
  const ex = Math.min(x, s - 1 - x);
  const ey = Math.min(y, s - 1 - y);
  if (ex + ey <= 1) return -1;
  return Math.min(ex, ey);
}

/** Pick between `a` and `b` by `t`, dithered to four steps so it reads as pixel art. */
function dither(a: RGB, b: RGB, t: number, x: number, y: number): RGB {
  return mix(a, b, Math.min(1, Math.floor(clamp01(t) * 4 + bayer(x, y)) / 4));
}

/** One frame of a rarity's tile, drawn into `b` at column `ox`. */
function paintTile(b: Bitmap, ox: number, rarity: Rarity, frame: number): void {
  const tint = toRGB(RARITY[rarity].tint);
  const phase = (frame / TILE_FRAMES[rarity]) * Math.PI * 2;
  const s = TILE;
  const c = (s - 1) / 2;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const e = edge(x, y, s);
      if (e < 0) continue;
      if (e === 0) {
        b.set(ox + x, y, OUTLINE);
        continue;
      }
      if (e === 1) {
        // A two-tone frame, lit along the top and left.
        const lit = y === 1 || x === 1;
        b.set(ox + x, y, rarity === 'legendary' ? mix(WHITE, hex('#ffd98a'), lit ? 0 : 0.55) : mix(tint, lit ? WHITE : NIGHT, lit ? 0.35 : 0.25));
        continue;
      }
      const r = Math.hypot(x - c, y - c) / (s / 2);
      const down = (y - 2) / (s - 5);
      let col: RGB;
      if (rarity === 'legendary') {
        // Bright white at the heart, warm cream at the edges, with rays turning slowly around.
        const a = Math.atan2(y - c, x - c);
        const ray = Math.pow(0.5 + 0.5 * Math.cos(a * 6 + phase), 3);
        const glow = clamp01(1.15 - r);
        col = dither(hex('#f2dca8'), hex('#fff8ea'), glow + ray * 0.35 * (1 - glow * 0.6), x, y);
        if (r < 0.34) col = dither(col, WHITE, 1 - r / 0.34, x, y);
      } else if (rarity === 'epic') {
        // Soft waves of lighter violet drifting through a deep purple.
        const dark = mix(tint, NIGHT, 0.72);
        const mid = mix(tint, NIGHT, 0.4);
        const w = 0.5 + 0.5 * Math.sin(y * 0.42 + Math.sin(x * 0.22 + phase) * 1.8 - phase);
        const base = dither(mid, dark, down * 0.9, x, y);
        col = dither(base, mix(tint, WHITE, 0.15), w * w * 0.55 * (1 - down * 0.5), x, y);
      } else {
        // A plain rarity colour, light from the top left fading down into shade.
        const light = mix(tint, NIGHT, 0.35);
        const dark = mix(tint, NIGHT, 0.75);
        col = dither(light, dark, down * 0.85 + r * 0.25, x, y);
      }
      b.set(ox + x, y, col);
    }
  }
  if (rarity === 'legendary') {
    // A few twinkles, each flaring for part of the loop.
    const stars: [number, number, number][] = [
      [7, 8, 0],
      [27, 6, 3],
      [29, 26, 5],
      [8, 28, 2],
      [18, 4, 6],
    ];
    const n = TILE_FRAMES.legendary;
    for (const [sx, sy, at] of stars) {
      const k = (frame - at + n) % n;
      if (k > 2) continue;
      const arm = k === 1 ? 2 : 1;
      b.set(ox + sx, sy, WHITE);
      for (let i = 1; i <= arm; i++) {
        const cc: RGB = i === arm ? hex('#ffe6a0') : WHITE;
        b.set(ox + sx + i, sy, cc);
        b.set(ox + sx - i, sy, cc);
        b.set(ox + sx, sy + i, cc);
        b.set(ox + sx, sy - i, cc);
      }
    }
  }
}

/** An empty slot: a dark, sunken square. */
function emptyTile(): Bitmap {
  const s = TILE;
  const b = new Bitmap(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const e = edge(x, y, s);
      if (e < 0) continue;
      if (e === 0) b.set(x, y, OUTLINE);
      else if (e === 1) b.set(x, y, y === s - 2 || x === s - 2 ? hex('#3a2f66') : hex('#1a1434'));
      else b.set(x, y, dither(hex('#0f0b22'), hex('#1c1640'), (y - 2) / (s - 5), x, y), 235);
    }
  }
  return b;
}

/** The ring around the chosen item: white outside, gold inside. */
function selectRing(): Bitmap {
  const s = TILE + 4;
  const b = new Bitmap(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const e = edge(x, y, s);
      if (e === 0) b.set(x, y, OUTLINE);
      else if (e === 1) b.set(x, y, WHITE);
      else if (e === 2) b.set(x, y, hex('#ffe08a'));
    }
  }
  return b;
}

/** A small green badge with a white tick: worn. */
function tick(): Bitmap {
  const pat = ['..#####..', '.#######.', '#######w#', '######ww#', '#w##www##', '#www.w###', '##ww#####', '.#######.', '..#####..'];
  return fromPattern(pat, { '#': hex('#2f9a4a'), w: WHITE, '.': null }, true);
}

/** Glyphs for the six slot types, "all" and potions: 9x9, drawn white with a dark outline so they can be tinted. */
const GLYPHS: Record<string, string[]> = {
  headwear: ['..#####..', '.#######.', '#########', '#########', '##.....##', '##.#.#.##', '##.....##', '.#.....#.', '.........'],
  chest: ['.##...##.', '####.####', '#########', '.#######.', '.#######.', '.#######.', '.#######.', '.#######.', '.........'],
  boots: ['..###....', '..###....', '..###....', '..###....', '..###....', '..######.', '..#######', '..#######', '.........'],
  weapon: ['.......##', '......###', '.....###.', '....###..', '#..###...', '.####....', '..##.....', '.#.##....', '#........'],
  defence: ['#########', '####.####', '####.####', '#########', '.#######.', '.#######.', '..#####..', '...###...', '....#....'],
  accessory: ['...###...', '...#.#...', '..#####..', '.##...##.', '.#.....#.', '.#.....#.', '.##...##.', '..#####..', '.........'],
  all: ['####.####', '####.####', '####.####', '####.####', '.........', '####.####', '####.####', '####.####', '####.####'],
  potion: ['...###...', '....#....', '...###...', '..#####..', '.#######.', '.#######.', '.#######.', '..#####..', '.........'],
};

function fromPattern(rows: string[], colors: Record<string, RGB | null>, noOutline = false): Bitmap {
  const pad = noOutline ? 0 : 1;
  const w = rows[0].length + pad * 2;
  const h = rows.length + pad * 2;
  const b = new Bitmap(w, h);
  const on = (x: number, y: number) => {
    const ch = rows[y - pad]?.[x - pad];
    return !!ch && !!colors[ch];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (on(x, y)) b.set(x, y, colors[rows[y - pad][x - pad]]!);
      else if (!noOutline && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) b.set(x, y, OUTLINE);
    }
  }
  return b;
}

/** Glyph texture key for a slot type, 'all' or 'potion'. */
export const glyphKey = (name: string): string => `glyph_${name}`;
/** Tile texture key for a rarity; animated ones have frames 0..n-1. */
export const tileKey = (r: Rarity): string => `rtile_${r}`;

export function registerInventoryArt(scene: Phaser.Scene): void {
  for (const r of RARITIES) {
    const n = TILE_FRAMES[r];
    const b = new Bitmap(TILE * n, TILE);
    for (let f = 0; f < n; f++) paintTile(b, f * TILE, r, f);
    const tex = scene.textures.addCanvas(tileKey(r), b.toCanvas());
    if (tex) for (let f = 0; f < n; f++) tex.add(f, 0, f * TILE, 0, TILE, TILE);
  }
  scene.textures.addCanvas('rtile_empty', emptyTile().toCanvas());
  scene.textures.addCanvas('inv_ring', selectRing().toCanvas());
  scene.textures.addCanvas('inv_tick', tick().toCanvas());
  for (const [k, rows] of Object.entries(GLYPHS)) scene.textures.addCanvas(glyphKey(k), fromPattern(rows, { '#': WHITE, '.': null }).toCanvas());
}
