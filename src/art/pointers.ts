// The mouse pointers a player can pick on a computer (More options in the
// pause menu). Each is a 16x16 sprite with its tip at (1, 1): the fill is
// drawn from a shape (a grid, or a rule along the diagonal for the blades and
// the arrow), then outlined, then given a soft drop shadow, or on hover a
// glowing rim in the pointer's own colour. Pure pixels, no page needed, so
// scripts/pointers.ts can render them too. The trails and bursts they leave
// are drawn by ui/pointer.ts.

import { hex, type RGB } from './pixel';

export type PointerId = 'classic' | 'blade' | 'ranger' | 'ember' | 'starfall' | 'wand' | 'quill' | 'frost' | 'sakura' | 'void';

/**
 * What a pointer leaves behind: a ring on click, a sword's swish, falling leaves, fire, a comet and its stars,
 * a burst of gold sparkles, a splash of ink, snow and shattering ice, drifting blossom, or light pulled into the dark.
 */
export type PointerFx = 'ripple' | 'slash' | 'leaves' | 'ember' | 'starfall' | 'sparkle' | 'ink' | 'frost' | 'petals' | 'void';

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
  { id: 'wand', name: 'Wand', fx: 'sparkle', heavy: false, accent: 0xffd970 },
  { id: 'quill', name: 'Quill', fx: 'ink', heavy: false, accent: 0x8ab4ff },
  { id: 'frost', name: 'Frost', fx: 'frost', heavy: true, accent: 0x9ef0ff },
  { id: 'sakura', name: 'Sakura', fx: 'petals', heavy: true, accent: 0xff9ec4 },
  { id: 'void', name: 'Void', fx: 'void', heavy: false, accent: 0xc070ff },
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

/** A dark wand of plum wood with gold bands, a four-pointed star at its tip. */
const wandFill = (x: number, y: number, hover: boolean): RGB | null => {
  const t = x + y;
  const s = x - y;
  // The star, centred three px down the diagonal: a bright core, rays along the axes and the diagonal.
  const dx = x - 3;
  const dy = y - 3;
  const ad = Math.abs(dx);
  const ay = Math.abs(dy);
  let star: RGB | null = null;
  if (ad + ay === 0) star = hex('#ffffff');
  else if (ad + ay === 1) star = hex('#fff6c8');
  else if ((ad === 0 && ay === 2) || (ay === 0 && ad === 2)) star = hex('#ffd970');
  else if (dx === dy && dx < 0) star = dx === -1 ? hex('#fff0a0') : dx === -2 ? hex('#ffd970') : hex('#e8a840');
  else if ((ad === 0 && ay === 3) || (ay === 0 && ad === 3)) star = hex('#c88430');
  if (star) return hover ? lift(star, 0.3) : star;
  if (t < 9 || t > 26) return null;
  if (s !== 0 && s !== 1) return null;
  // Gold bands near the star and at the butt, a gold cap at the very end.
  if (t === 9 || t === 10 || t === 21 || t >= 25) return s === 1 ? hex('#ffe08a') : hex('#c08030');
  return s === 1 ? hex('#8a5aa0') : hex('#5a3470');
};

/** A writing quill: a gold nib, a white feather swept back, a pale blue sheen to its vane. */
const quillFill = (x: number, y: number, hover: boolean): RGB | null => {
  const t = x + y;
  const s = x - y;
  const a = Math.abs(s);
  if (t <= 4) {
    // The nib, split down its middle.
    if (a > t >> 1) return null;
    return s === 0 && t >= 2 ? hex('#5a3a18') : s > 0 ? hex('#fff0b4') : hex('#d89a3c');
  }
  if (t > 26) return null;
  // The vane: broad above the shaft, narrow below, rounded at both ends, with a split or two in it.
  const up = t < 9 ? t - 5 : t < 22 ? 4 : 26 - t;
  const down = t < 10 ? 0 : t < 21 ? 2 : t < 24 ? 1 : 0;
  // The shaft: a grey quill showing between the barbs.
  if (s === 0) return t < 8 ? hex('#c8b090') : hex('#9aa4cc');
  if (s > 0) {
    if (s > up) return null;
    // A ragged edge where the barbs part, and two splits cut into the vane.
    if (s === up && up >= 3 && t % 3 === 0) return null;
    if ((t === 13 || t === 19) && s >= 2) return null;
    const c = s === up ? hex('#6a8ad8') : s === up - 1 ? hex('#a8c0ff') : t > 18 ? hex('#dce6ff') : hex('#ffffff');
    return hover ? lift(c, 0.2) : c;
  }
  if (a > down) return null;
  if (a === down && t % 3 === 1) return null;
  return a === down ? hex('#7a94d8') : hex('#d0dcff');
};

/** An ice crystal: a spike of ice with two pairs of side branches, like one arm of a snowflake. */
const frostFill = (x: number, y: number, hover: boolean): RGB | null => {
  const t = x + y;
  const s = x - y;
  const a = Math.abs(s);
  if (t > 24) return null;
  let on = false;
  if (t <= 2) on = a === 0 || (t === 2 && a <= 0);
  else if (a <= 1) on = true;
  // Branches across the spike, longer nearer the back.
  if ((t === 7 || t === 8) && a <= 4) on = true;
  if ((t === 14 || t === 15) && a <= 6) on = true;
  // Little barbs angling forward off the branch ends.
  if (t === 6 && a === 4) on = true;
  if (t === 13 && a === 6) on = true;
  if (t === 24 && a > 0) on = false;
  if (!on) return null;
  let c: RGB;
  if (a === 0) c = t < 10 ? hex('#ffffff') : hex('#e4fbff');
  else if (s > 0) c = a >= 3 ? hex('#7ad8f6') : hex('#c8f6ff');
  else c = a >= 3 ? hex('#3a8ad0') : hex('#8ec8f0');
  return hover ? lift(c, 0.25) : c;
};

/** A cherry twig: an open blossom at the tip, a bud and a leaf along the branch. */
const sakuraFill = (x: number, y: number, hover: boolean): RGB | null => {
  const t = x + y;
  const s = x - y;
  // The blossom: five round petals, one pointing at the tip, a gold heart.
  const cx = 2.4;
  const cy = 2.4;
  const dx = x + 0.5 - cx - 0.5;
  const dy = y + 0.5 - cy - 0.5;
  const d = Math.hypot(dx, dy);
  if (d <= 3.3) {
    const ang = Math.atan2(dy, dx) + (Math.PI * 3) / 4;
    const lobe = Math.cos(ang * 5);
    if (d < 1.1) return hex('#ffe070');
    if (d > 2.2 && lobe < -0.35) return null;
    const c = d < 1.9 ? hex('#ff7aa8') : lobe > 0.4 ? hex('#fff0f6') : hex('#ffb8d4');
    return hover ? lift(c, 0.2) : c;
  }
  // A bud on the upper side, a leaf on the lower.
  if (t >= 13 && t <= 15 && s >= 2 && s <= 4) return t === 13 ? hex('#ffd0e0') : hex('#e8609a');
  if (t >= 16 && t <= 19 && s <= -2 && s >= -4 && !(t === 19 && s === -4)) return s === -2 ? hex('#8ad068') : hex('#4a9a48');
  // The twig, dark bark with a lit edge, from behind the blossom down and right.
  if (t >= 7 && t <= 24 && (s === 0 || s === 1)) return s === 1 ? hex('#9a6a4a') : hex('#5a3828');
  return null;
};

/** The arrow cut from obsidian, a violet light burning in its cracks. */
const VOID: Record<string, RGB> = { w: hex('#7a6aa0'), a: hex('#463a64'), b: hex('#33284e'), c: hex('#261c3c'), d: hex('#1c142e'), e: hex('#140e22') };
const voidArrow = grid(ARROW, VOID);
const voidFill = (x: number, y: number, hover: boolean): RGB | null => {
  const c = voidArrow(x, y);
  if (!c) return null;
  // A forking crack of light down the middle of the head.
  const crack = (x === 1 && y === 3) || (x === 2 && (y === 4 || y === 5)) || (x === 3 && y === 6) || (x === 2 && y === 6) || (x === 4 && y === 7) || (x === 1 && y === 7);
  if (crack) return hover ? hex('#ffe0ff') : y < 5 ? hex('#f0c8ff') : hex('#c070ff');
  return hover ? lift(c, 0.12) : c;
};

const LOOKS: Record<PointerId, Look> = {
  classic: { fill: (x, y, h) => (h ? goldArrow : silverArrow)(x, y, h), ink: hex('#120e24'), hoverInk: hex('#3a1e08'), halo: hex('#ffd970') },
  blade: { fill: bladeFill, ink: hex('#0e0c20'), hoverInk: hex('#0a2a3a'), halo: hex('#7ae8ff') },
  ranger: { fill: rangerFill, ink: hex('#1a1008'), hoverInk: hex('#1c2a08'), halo: hex('#b8f070') },
  ember: { fill: emberFill, ink: hex('#2a0806'), hoverInk: hex('#5a1404'), halo: hex('#ff9a30') },
  wand: { fill: wandFill, ink: hex('#1a0e24'), hoverInk: hex('#3a2408'), halo: hex('#ffd970') },
  quill: { fill: quillFill, ink: hex('#0e1230'), hoverInk: hex('#1a2a60'), halo: hex('#8ab4ff') },
  frost: { fill: frostFill, ink: hex('#0a1a36'), hoverInk: hex('#0e3050'), halo: hex('#bff4ff') },
  sakura: { fill: sakuraFill, ink: hex('#2a0c1c'), hoverInk: hex('#4a1430'), halo: hex('#ffb0d0') },
  void: { fill: voidFill, ink: hex('#8a4ad8'), hoverInk: hex('#e0b0ff'), halo: hex('#a050f0') },
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
