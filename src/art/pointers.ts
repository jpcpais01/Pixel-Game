// The mouse pointers a player can pick on a computer (More options in the
// pause menu). Each is a 16x16 sprite with its tip at (1, 1): the fill is
// drawn from a shape (a grid, or a rule along the diagonal for the blades and
// the arrow), then outlined, then given a soft drop shadow, or on hover a
// glowing rim in the pointer's own colour. Pure pixels, no page needed, so
// scripts/pointers.ts can render them too. The trails and bursts they leave
// are drawn by ui/pointer.ts.

import { hex, type RGB } from './pixel';

export type PointerId = 'classic' | 'blade' | 'ranger' | 'ember' | 'starfall';

/** What a pointer leaves behind: a ring on click, a sword's swish, falling leaves, fire, or a comet and its stars. */
export type PointerFx = 'ripple' | 'slash' | 'leaves' | 'ember' | 'starfall';

export interface PointerDef {
  id: PointerId;
  name: string;
  fx: PointerFx;
  /** Runs effects all the time (trails, idle flames or motes), not only on a click. */
  heavy: boolean;
  /** The card's glow and name in the picker. */
  accent: number;
}

export const POINTERS: PointerDef[] = [
  { id: 'classic', name: 'Silver', fx: 'ripple', heavy: false, accent: 0xc4c8e2 },
  { id: 'blade', name: 'Blade', fx: 'slash', heavy: false, accent: 0x9ef0ff },
  { id: 'ranger', name: 'Ranger', fx: 'leaves', heavy: false, accent: 0xb8e070 },
  { id: 'ember', name: 'Ember', fx: 'ember', heavy: true, accent: 0xff9a30 },
  { id: 'starfall', name: 'Starfall', fx: 'starfall', heavy: true, accent: 0xb48aff },
];

export const pointerDef = (id: string): PointerDef => POINTERS.find((p) => p.id === id) ?? POINTERS[0];

/** The sprite's side and where its tip (the hotspot) is, in art px. */
export const POINTER_SIZE = 16;
export const POINTER_HOT = 1;

interface Look {
  /** The fill at (x, y) from the tip, or null. */
  fill: (x: number, y: number, hover: boolean) => RGB | null;
  ink: RGB;
  hoverInk: RGB;
  /** The rim that glows round it on hover. */
  halo: RGB;
}

/** A shape from rows of letters, each a colour from `pal` ('.' is empty). */
const grid = (rows: string[], pal: Record<string, RGB>) => (x: number, y: number, _hover?: boolean): RGB | null => {
  const ch = rows[y]?.[x];
  return ch && ch !== '.' ? pal[ch] ?? null : null;
};

const lift = (c: RGB, t: number): RGB => [
  Math.round(c[0] + (255 - c[0]) * t),
  Math.round(c[1] + (255 - c[1]) * t),
  Math.round(c[2] + (255 - c[2]) * t),
];

// The classic arrow: a long left edge, a sloped foot and a tail stepping down and right.
const ARROW = [
  'w',
  'wa',
  'wab',
  'wabb',
  'wabbc',
  'wabbcc',
  'wabbccd',
  'wabbcdde',
  'wab.bc',
  'wa..bc',
  'w....bc',
  '.....bc',
];

const SILVER: Record<string, RGB> = { w: hex('#ffffff'), a: hex('#e8eaf6'), b: hex('#c9cce4'), c: hex('#a2a6cc'), d: hex('#7a80ae'), e: hex('#5c6290') };
const GOLD: Record<string, RGB> = { w: hex('#fffbe8'), a: hex('#fff0b4'), b: hex('#ffd970'), c: hex('#eeab42'), d: hex('#c27c2c'), e: hex('#8f521e') };
const silverArrow = grid(ARROW, SILVER);
const goldArrow = grid(ARROW, GOLD);

/** Fire from white at the tip to deep red at the tail. */
const FIRE = ['#fffbe0', '#fff0a0', '#ffd860', '#ffb03a', '#ff8a28', '#f2601e', '#d23a18', '#a82418'].map(hex);
const emberFill = (x: number, y: number, hover: boolean): RGB | null => {
  if (!silverArrow(x, y, false)) return null;
  // The left edge burns brightest; the rest cools with distance from the tip.
  const step = Math.min(FIRE.length - 1, Math.floor((x * 1.2 + y * 0.6) / 1.5) - (x === 0 ? 2 : 0) - (hover ? 1 : 0));
  return FIRE[Math.max(0, step)];
};

// Along the diagonal from the tip: t = x + y how far down it, s = x - y how far across (right of it is positive).
const STEEL_LIT = hex('#ffffff');
const STEEL = hex('#dfe5f4');
const STEEL_MID = hex('#b4bdd8');
const FULLER = hex('#7c88b4');
const STEEL_DARK = hex('#8790b8');
const STEEL_DEEP = hex('#5f6894');
const bladeFill = (x: number, y: number, hover: boolean): RGB | null => {
  const t = x + y;
  const s = x - y;
  const a = Math.abs(s);
  let c: RGB | null = null;
  if (t <= 16) {
    // The blade: a single point, widening to its full width a few pixels back.
    if (a > (t < 3 ? 0 : t < 5 ? 1 : 2)) return null;
    if (s >= 2) c = STEEL_LIT;
    else if (s === 1) c = STEEL;
    else if (s === 0) c = t >= 6 && t <= 14 ? FULLER : STEEL_MID;
    else if (s === -1) c = STEEL_DARK;
    else c = STEEL_DEEP;
  } else if (t <= 18) {
    // The guard, square across the blade, with gold caps.
    if (a > 5) return null;
    c = a >= 4 ? hex('#ffe9a0') : t === 17 ? hex('#ffd060') : hex('#c08030');
  } else if (t <= 22) {
    // The grip, bound in leather.
    if (a > 1) return null;
    c = t % 2 === 1 ? (s > 0 ? hex('#a86c40') : hex('#7a4a2a')) : s >= 0 ? hex('#5a321c') : hex('#40220f');
  } else if (t <= 25) {
    // A ruby in the pommel.
    if (a > (t === 24 ? 2 : 1)) return null;
    c = t === 23 ? (s > 0 ? hex('#ffb0b8') : hex('#ff5a6a')) : t === 24 ? (s > 0 ? hex('#ff4458') : s === 0 ? hex('#d82040') : hex('#a01430')) : hex('#6e0c22');
  }
  return c && hover && t <= 16 ? lift(c, 0.25) : c;
};

const rangerFill = (x: number, y: number, hover: boolean): RGB | null => {
  const t = x + y;
  const s = x - y;
  const a = Math.abs(s);
  if (t <= 6) {
    // A steel broadhead: a sharp point flaring to two barbs.
    if (a > (t >> 1)) return null;
    const c = t === 6 ? hex('#5e6684') : s > 0 ? hex('#f4f8ff') : s === 0 ? hex('#c4cce0') : hex('#7c86a8');
    return hover ? lift(c, 0.2) : c;
  }
  if (t <= 19) {
    // The shaft: two pixels wide on the diagonal, ash wood with a darker underside.
    if (s !== 0 && s !== 1) return null;
    if (t === 7 || t === 8) return hex('#6a4a8a'); // the binding behind the head
    return s === 1 ? hex('#e8c48a') : hex('#b08850');
  }
  if (t <= 26) {
    // Fletching: a red feather above the shaft and a cream one below, swept back, with the nock between.
    const reach = t <= 21 ? t - 18 : t <= 24 ? 3 : 2;
    if (a > reach) return null;
    if (s === 0 || s === 1) return t >= 25 ? hex('#3a2814') : hex('#d8b070');
    if (s > 1) return a === reach ? hex('#a82a24') : hex('#e8443a');
    return a === reach ? hex('#b8ae9a') : hex('#f4efe2');
  }
  return null;
};

/** A cut crystal, cyan on its lit side and violet in its shadow, white down its ridge. */
const starfallFill = (x: number, y: number, hover: boolean): RGB | null => {
  const t = x + y;
  const s = x - y;
  const a = Math.abs(s);
  if (t > 22) return null;
  const w = t < 15 ? Math.floor((t + 1) / 3.2) : Math.floor((22 - t) / 1.6);
  if (a > w) return null;
  let c: RGB;
  if (s === 0) c = t < 8 ? hex('#ffffff') : hex('#e6dcff');
  else if (s > 0) c = a === w ? hex('#3c9ad8') : a === 1 ? hex('#c8f8ff') : hex('#78d6f6');
  else c = a === w ? hex('#4e2c9e') : a === 1 ? hex('#c4a8ff') : hex('#8c62e6');
  // The far end of the crystal is darker, as if deeper.
  if (t >= 17 && s !== 0) c = [Math.round(c[0] * 0.8), Math.round(c[1] * 0.8), Math.round(c[2] * 0.85)];
  return hover ? lift(c, 0.18) : c;
};

const LOOKS: Record<PointerId, Look> = {
  classic: { fill: (x, y, h) => (h ? goldArrow : silverArrow)(x, y, h), ink: hex('#120e24'), hoverInk: hex('#3a1e08'), halo: hex('#ffd970') },
  blade: { fill: bladeFill, ink: hex('#0e0c20'), hoverInk: hex('#0a2a3a'), halo: hex('#7ae8ff') },
  ranger: { fill: rangerFill, ink: hex('#1a1008'), hoverInk: hex('#1c2a08'), halo: hex('#b8f070') },
  ember: { fill: emberFill, ink: hex('#2a0806'), hoverInk: hex('#5a1404'), halo: hex('#ff9a30') },
  starfall: { fill: starfallFill, ink: hex('#160a36'), hoverInk: hex('#2a1260'), halo: hex('#d8b8ff') },
};

/** The pointer's RGBA pixels, POINTER_SIZE square, at one byte-quad per art px. */
export function pointerPixels(id: PointerId, hover: boolean): Uint8ClampedArray<ArrayBuffer> {
  const N = POINTER_SIZE;
  const look = LOOKS[id];
  const px = new Uint8ClampedArray(N * N * 4);
  const kind = new Uint8Array(N * N); // 0 empty, 1 fill, 2 ink
  const put = (x: number, y: number, c: RGB, a: number, k: number) => {
    const i = y * N + x;
    px.set([c[0], c[1], c[2], a], i * 4);
    kind[i] = k;
  };
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : kind[y * N + x]);
  const o = POINTER_HOT;
  for (let y = 0; y + o < N; y++) {
    for (let x = 0; x + o < N; x++) {
      const c = look.fill(x, y, hover);
      if (c) put(x + o, y + o, c, 255, 1);
    }
  }
  // A one-pixel outline on the four sides, and the corner just past the tip so it comes to a point.
  const ink = hover ? look.hoverInk : look.ink;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (at(x, y)) continue;
      if (at(x - 1, y) === 1 || at(x + 1, y) === 1 || at(x, y - 1) === 1 || at(x, y + 1) === 1) put(x, y, ink, 255, 2);
    }
  }
  put(0, 0, ink, 255, 2);
  // Hover: a glowing rim round the outline. Otherwise a soft shadow down and right.
  const solid = kind.slice();
  const was = (x: number, y: number) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : solid[y * N + x]);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (was(x, y)) continue;
      if (hover) {
        const near = was(x - 1, y) || was(x + 1, y) || was(x, y - 1) || was(x, y + 1);
        const corner = was(x - 1, y - 1) || was(x + 1, y - 1) || was(x - 1, y + 1) || was(x + 1, y + 1);
        if (near) put(x, y, look.halo, 150, 3);
        else if (corner) put(x, y, look.halo, 70, 3);
      } else if (was(x - 1, y - 1)) {
        put(x, y, [8, 6, 20], 80, 3);
      }
    }
  }
  return px;
}
