// What every part of the wanderer's drawing shares: an appearance turned
// into materials (the kit), one frame's pose, and where that pose puts the
// body (the geometry). The rig (rig.ts) draws the body, face and clothes;
// gear.ts the hair, hats, things worn and things carried.

import type { Material, PixelCanvas, Vec3 } from '../../art/pixel';
import { cyl, hex, sphere } from '../../art/pixel';
import { CLOTH, EYE_COLORS, HAIR_COLORS, SKINS, type Appearance } from '../look';
import { flat, mat, rgbHex, shade, tone } from './paint';

export type View = 'down' | 'up' | 'side';

export interface P {
  x: number;
  y: number;
}

/** One frame's pose, in the body's own box (24 x 32, the soles on row 31). */
export interface Pose {
  view: View;
  /** The upper body's drop (breathing, the bob of a step), px. */
  bob: number;
  /** The whole figure lifted off the ground (a jump), px. */
  hop: number;
  /** The upper body's sway sideways (a dance), px. */
  dx: number;
  /** Soles: [viewer's left or the near one, the other]. */
  feet: [P, P];
  hands: [P, P];
  blink: boolean;
  /** -1..1: long hair, skirts, tails and wings swing with it. */
  sway: number;
  /** Sitting on the ground. */
  sit: boolean;
  /** The thing carried shows, and in which hand. */
  carry: boolean;
  hold: 0 | 1;
  /** A face for the moment, over the one chosen (an emote's). */
  face?: 'content' | 'open' | 'grin';
  /** Wings and tails beat: 0..1 through a flap. */
  flap: number;
}

export interface Kit {
  a: Appearance;
  tall: number;
  /** Shoulders, waist and hips (half widths), and the body's depth seen from the side. */
  sw: number;
  ww: number;
  hw: number;
  dep: number;
  skin: Material;
  skinC: string;
  lash: Material;
  iris: Material;
  irisDeep: Material;
  white: Material;
  mouth: Material;
  tongue: Material;
  blush: Material;
  hair: Material;
  hairC: string;
  brow: Material;
  top: Material;
  topC: string;
  trim: Material;
  trimC: string;
  bottom: Material;
  bottomC: string;
  dress: Material;
  dressC: string;
  shoes: Material;
  shoesC: string;
  hat: Material;
  hatC: string;
  neck: Material;
  neckC: string;
  back: Material;
  backC: string;
  held: Material;
  heldC: string;
  /** Shared bits of every look: gold, silver, wood, leather, glass, white, flowers, light. */
  gold: Material;
  silver: Material;
  wood: Material;
  leather: Material;
  glass: Material;
  linen: Material;
  sole: Material;
  leaf: Material;
}

export interface Geo {
  view: View;
  pose: Pose;
  cx: number;
  /** Shoulders' row, the hips' row, the waist's. */
  sh: number;
  hip: number;
  waist: number;
  /** The head's centre. */
  hx: number;
  hy: number;
  shoulders: [P, P];
  feet: [P, P];
  hands: [P, P];
}

const BUILD = [
  { sw: 3.7, ww: 3.1, hw: 3.4, dep: 2.5 },
  { sw: 4.1, ww: 4.2, hw: 4.5, dep: 3.1 },
  { sw: 4.9, ww: 4.1, hw: 4.2, dep: 3.1 },
];

export function makeKit(a: Appearance): Kit {
  const b = BUILD[a.build] ?? BUILD[1];
  const skinC = SKINS[a.skin]?.c ?? SKINS[2].c;
  const hairC = HAIR_COLORS[a.hairColor]?.c ?? HAIR_COLORS[2].c;
  const eyeC = EYE_COLORS[a.eyeColor]?.c ?? EYE_COLORS[0].c;
  const cloth = (i: number) => CLOTH[i]?.c ?? CLOTH[0].c;
  // Deep skin tones keep softer shadows and a lighter mouth, so the face still reads.
  const [r, gg, bb] = hex(skinC);
  const deep = (Math.max(r, gg, bb) + Math.min(r, gg, bb)) / 510 < 0.42;
  return {
    a,
    tall: a.height ? 1 : 0,
    ...b,
    // Shadows lean only a little rosy and stay shallow: deeper, redder steps read as a red chin on fair skin.
    skin: mat(skinC, { cool: 20, depth: 0.6, line: 14 }),
    skinC,
    lash: flat(deep ? '#140c10' : '#2a1d2c'),
    iris: flat(eyeC),
    irisDeep: flat(shade(eyeC, -0.22)),
    white: flat('#fffaf2'),
    mouth: flat(rgbHex(tone(hex(skinC), deep ? -0.2 : -0.32, 8))),
    tongue: flat('#e2607a'),
    blush: flat(shade('#f07a8a', 0.02)),
    hair: mat(hairC, { cool: 265 }),
    hairC,
    brow: flat(shade(hairC, -0.3)),
    top: mat(cloth(a.topColor)),
    topC: cloth(a.topColor),
    trim: mat(cloth(a.trim)),
    trimC: cloth(a.trim),
    bottom: mat(cloth(a.bottomColor)),
    bottomC: cloth(a.bottomColor),
    dress: mat(cloth(a.dressColor)),
    dressC: cloth(a.dressColor),
    shoes: mat(cloth(a.shoesColor), { shine: true }),
    shoesC: cloth(a.shoesColor),
    hat: mat(cloth(a.hatColor)),
    hatC: cloth(a.hatColor),
    neck: mat(cloth(a.neckColor)),
    neckC: cloth(a.neckColor),
    back: mat(cloth(a.backColor)),
    backC: cloth(a.backColor),
    held: mat(cloth(a.heldColor)),
    heldC: cloth(a.heldColor),
    gold: mat('#e8b84a', { shine: true }),
    silver: mat('#c8d0dc', { shine: true }),
    wood: mat('#9a6a40'),
    leather: mat('#7a4a2c'),
    glass: mat('#bfe8f4', { shine: true }),
    linen: mat('#f4efe4'),
    sole: mat('#5a4038'),
    leaf: mat('#5c9a48'),
  };
}

/** Where the pose puts the body. */
export function geometry(k: Kit, p: Pose): Geo {
  const t = k.tall;
  const lift = p.bob - p.hop;
  const cx = 12 + p.dx;
  const sit = p.sit ? 4 : 0;
  const sh = 18 - t + lift + sit;
  const hip = 25 - t + Math.round(lift * 0.5) + (p.sit ? 4 + t : 0) - p.hop * 0.5;
  const side = p.view === 'side';
  const hx = side ? cx - 0.5 : cx;
  const hy = 12.5 - t + lift + sit;
  const sx = side ? 0.4 : k.sw - 0.55;
  return {
    view: p.view,
    pose: p,
    cx,
    sh,
    hip,
    waist: Math.round((sh + hip) / 2 + 1),
    hx,
    hy,
    shoulders: side ? [{ x: cx + sx, y: sh + 1.4 }, { x: cx + sx + 0.5, y: sh + 1.4 }] : [{ x: cx - sx, y: sh + 1.4 }, { x: cx + sx, y: sh + 1.4 }],
    feet: p.feet,
    hands: p.hands,
  };
}

/** Fill rows y0..y1 between edges, with a normal and a per-pixel shading nudge. */
export function rows(
  c: PixelCanvas,
  y0: number,
  y1: number,
  edges: (y: number) => [number, number] | null,
  m: Material,
  normal: (x: number, y: number, t: number, u: number) => Vec3 = (_x, _y, t) => cyl(t),
  bias?: (x: number, y: number, t: number, u: number) => number,
): void {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const e = edges(y);
    if (!e) continue;
    const [l, r] = e;
    if (r - l < 0.3) continue;
    const u = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
    for (let x = Math.round(l); x <= Math.round(r) - 1; x++) {
      const t = ((x + 0.5 - l) / (r - l)) * 2 - 1;
      c.px(x, y, m, normal(x, y, t, u), bias ? { bias: bias(x, y, t, u) } : undefined);
    }
  }
}

/** An ellipse with a nudge per pixel (texture on hair, knit on a hat). */
export function blob(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, m: Material, bias?: (x: number, y: number, dx: number, dy: number) => number, keep?: (x: number, y: number) => boolean, flatten = 1): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      if (keep && !keep(x, y)) continue;
      c.px(x, y, m, sphere(dx, dy, flatten), bias ? { bias: bias(x, y, dx, dy) } : undefined);
    }
  }
}

/** A small stable hash for texture (strands, freckles, flowers). */
export const hsh = (a: number, b: number, s = 0): number => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Recolour pixels already drawn in `from` to `to`, keeping their shape and light, where `where` says (stripes, trims). */
export function recolor(c: PixelCanvas, ox: number, oy: number, x0: number, y0: number, x1: number, y1: number, from: Material, to: Material, where: (x: number, y: number) => boolean): void {
  for (let y = Math.floor(y0); y <= y1; y++) {
    for (let x = Math.floor(x0); x <= x1; x++) {
      if (c.materialAt(x, y) !== from || !where(x, y)) continue;
      const i = (y + oy) * c.w + x + ox;
      if (i < 0 || i >= c.w * c.h) continue;
      c.px(x, y, to, { x: c.nx[i], y: c.ny[i], z: c.nz[i] }, { bias: c.bias[i] });
    }
  }
}
