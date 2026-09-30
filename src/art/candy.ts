// Hallow's Eve's candy: wrapped sweets, candy corn and swirled lollipops,
// drawn with the lit engine and flattened into plain images (like the gems,
// what lies on the ground and sits in the menus is unlit). Drops come in
// three sizes by how much fell; icons in three sizes for counters and prices.

import type Phaser from 'phaser';
import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { pixelCanvas } from './canvas';

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#1c0a14');

const ORANGE: Material = { ramp: ramp('#8a2e06', '#c8520e', '#f07a1e', '#ffa84a', '#ffd89a'), outline: INK, shine: true };
const VIOLET: Material = { ramp: ramp('#3a1464', '#5a24a0', '#8446d8', '#b07aff', '#e0c8ff'), outline: INK, shine: true };
const LIME: Material = { ramp: ramp('#2a6010', '#4a9a1a', '#7ad030', '#b8f070', '#effcc8'), outline: INK, shine: true };
const CREAM: Material = { ramp: ramp('#a89070', '#e0d0b0', '#fff6e0', '#ffffff'), outline: INK, shine: true };
const CORN_Y: Material = { ramp: ramp('#b07a08', '#e8b020', '#ffd84a', '#fff0a0'), outline: INK };
const CORN_O: Material = { ramp: ramp('#a83a04', '#e0600e', '#ff8a2a', '#ffb860'), outline: INK };
const CORN_W: Material = { ramp: ramp('#b8b0a0', '#e8e2d4', '#ffffff'), outline: INK };
const STICK: Material = { ramp: ramp('#a8a098', '#e0dcd4', '#ffffff'), outline: INK, noAO: true };
/** Cellophane twists: pale and glinting. */
const WRAP: Material = { ramp: ramp('#8a7aa8', '#c8b8e8', '#f4ecff'), outline: hex('#2a1a3a'), noAO: true, emissive: 0.1 };

/** A wrapped sweet centred at (x, y): a round body in stripes, its wrapper twisted off either side. */
function sweet(c: PixelCanvas, x: number, y: number, body: Material, stripe: Material, big = 1): void {
  const rx = 3 * big;
  const ry = 2.2 * big;
  c.part();
  for (const k of [-1, 1]) {
    c.capsule(x + k * rx * 0.9, y, x + k * (rx + 2.2 * big), y - 1.3 * big, 0.55, 0.9 * big, WRAP);
    c.capsule(x + k * rx * 0.9, y, x + k * (rx + 2.2 * big), y + 1.3 * big, 0.55, 0.9 * big, WRAP);
  }
  c.part();
  for (let py = Math.floor(y - ry); py <= Math.ceil(y + ry); py++) {
    for (let px = Math.floor(x - rx); px <= Math.ceil(x + rx); px++) {
      const dx = (px + 0.5 - x) / rx;
      const dy = (py + 0.5 - y) / ry;
      if (dx * dx + dy * dy > 1) continue;
      // Diagonal stripes wrapping round it.
      const band = Math.floor((px - py * 0.9 + 64) / (2 * big)) % 2 === 0;
      c.px(px, py, band ? stripe : body, sphere(dx * 0.9, dy * 0.9 - 0.15, 1));
    }
  }
}

/** A candy corn, point up, its base at (x, y): yellow, orange, white. */
function corn(c: PixelCanvas, x: number, y: number, h = 5): void {
  c.part();
  for (let i = 0; i < h; i++) {
    const py = y - i;
    const hw = 0.6 + ((h - 1 - i) / (h - 1)) * (h * 0.36);
    const m = i < h * 0.38 ? CORN_Y : i < h * 0.78 ? CORN_O : CORN_W;
    c.shape(py, py, () => [x - hw, x + hw], m, (_x, _y, t) => cyl(t, 0.35));
  }
}

/** A swirled lollipop on its stick, the disc centred at (x, y). */
function lolly(c: PixelCanvas, x: number, y: number, r: number): void {
  c.part();
  c.line(x + 0.5, y + r, x + 1.5, y + r + 4, STICK, () => cyl(-0.3, 0.2));
  c.part();
  for (let py = Math.floor(y - r); py <= Math.ceil(y + r); py++) {
    for (let px = Math.floor(x - r); px <= Math.ceil(x + r); px++) {
      const dx = px + 0.5 - x;
      const dy = py + 0.5 - y;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      // A spiral: the angle and the distance out, together.
      const swirl = (Math.atan2(dy, dx) / (Math.PI * 2) + d / 2.6 + 4) % 1;
      c.px(px, py, swirl < 0.5 ? VIOLET : ORANGE, sphere((dx / r) * 0.7, (dy / r) * 0.7 - 0.1, 1));
    }
  }
}

/** Diffuse with the glow added over it: art for places that aren't lit. */
function flat(c: PixelCanvas): Uint8ClampedArray {
  const r = c.render();
  const out = new Uint8ClampedArray(r.diffuse);
  for (let i = 0; i < out.length; i += 4) {
    if (!r.emissive[i + 3]) continue;
    out[i] = Math.min(255, out[i] + r.emissive[i]);
    out[i + 1] = Math.min(255, out[i + 1] + r.emissive[i + 1]);
    out[i + 2] = Math.min(255, out[i + 2] + r.emissive[i + 2]);
    out[i + 3] = 255;
  }
  return out;
}

/** Drop sprites by how much candy fell, feet at the bottom. */
export const CANDY_DROPS = {
  one: { w: 13, h: 9 },
  few: { w: 17, h: 12 },
  heap: { w: 25, h: 19 },
} as const;
export type CandyDrop = keyof typeof CANDY_DROPS;

/** Which drop sprite `n` candy lie as. */
export const candyDropFor = (n: number): CandyDrop => (n >= 8 ? 'heap' : n >= 2 ? 'few' : 'one');

function candyDrop(kind: CandyDrop): PixelCanvas {
  const { w, h } = CANDY_DROPS[kind];
  const c = new PixelCanvas(w, h);
  if (kind === 'one') sweet(c, 6.5, 4.5, ORANGE, VIOLET);
  else if (kind === 'few') {
    corn(c, 4, 10, 6);
    sweet(c, 10, 8, VIOLET, LIME);
    corn(c, 13.5, 10.5, 5);
  } else {
    // A little heap: a lollipop stuck in it, sweets and corn tumbled round.
    lolly(c, 16, 5, 3.6);
    sweet(c, 7, 12.5, ORANGE, VIOLET);
    corn(c, 12, 17, 6);
    sweet(c, 17.5, 14.5, LIME, CREAM);
    corn(c, 3.5, 17, 5);
    sweet(c, 12.5, 11, VIOLET, ORANGE);
    corn(c, 21.5, 17.5, 5);
  }
  return c;
}

/** The candy counter's icon: a wrapped sweet, `size` 's' (inline), 'm' or 'l'. */
function candyIcon(size: 's' | 'm' | 'l'): PixelCanvas {
  if (size === 's') {
    const c = new PixelCanvas(9, 7);
    sweet(c, 4.5, 3.5, ORANGE, VIOLET, 0.75);
    return c;
  }
  const big = size === 'l' ? 1.5 : 1.15;
  const w = size === 'l' ? 19 : 15;
  const h = size === 'l' ? 11 : 9;
  const c = new PixelCanvas(w, h);
  sweet(c, w / 2, h / 2, ORANGE, VIOLET, big);
  return c;
}

/** Candy for the world's drops and the menus' counters: 'candy_drop_<size>' and 'candy_s/m/l'. Made once. */
export function registerCandyArt(scene: Phaser.Scene): void {
  if (scene.textures.exists('candy_m')) return;
  const add = (key: string, c: PixelCanvas) => scene.textures.addCanvas(key, pixelCanvas(c.w, c.h, flat(c)));
  for (const k of Object.keys(CANDY_DROPS) as CandyDrop[]) add(`candy_drop_${k}`, candyDrop(k));
  add('candy_s', candyIcon('s'));
  add('candy_m', candyIcon('m'));
  add('candy_l', candyIcon('l'));
}

/** The candy's colours, for sparks as it lands and is picked up. */
export const CANDY_SPARKS = [0xffffff, 0xffb050, 0xff7a1a, 0xb07aff, 0x9cff6a];
