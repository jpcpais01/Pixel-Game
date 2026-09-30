// Hallow's Eve's creatures, drawn like the other monsters (lit, with a glow
// layer, facing right and mirrored):
//   - The gourdling: a little jack-o'-lantern scuttling on vine tendrils, its
//     carved face lit from within. Before it pounces it squats and its face
//     flares.
//   - The hexbat: a violet-black bat with ember eyes and a pumpkin-orange glint
//     on its belly. It shrieks, eyes blazing, before it dives.
//   - The Pumpkin King, a Legend: a scarecrow king twice a hero's height, a
//     great carved pumpkin for a head under a crooked crown of vines and
//     golden thorns, fire burning orange and green inside it (all ghost-green
//     once he is enraged), a tattered purple cloak over a body of twisted vines
//     and straw, long vine arms with clawed hands and a sceptre crowned with a
//     little pumpkin.
// Every pumpkin is drawn by `pumpkin`: a ribbed ball whose lobes follow its
// curve, so it reads round, and whose carved face is cut in the ball's own
// longitude and latitude, so the far eye narrows as it turns away.
//
// Also here, the King's spells: his flaming pumpkin bomb, the vines his
// gourdlings sprout from, the glow of his lash and the flames bombs leave.

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, cyl, hex, sphere, FLAT, type Material, type RGB, type Vec3 } from './pixel';
import { poly } from './deepMonsters';
import { rng } from './env';

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#0a0508');

/** Particle tints: a gourdling's pumpkin chunks and seeds, a hexbat's, and the King's fire and candy sparks. */
export const GOURD_TINTS = [0xff9a22, 0xe0600c, 0xffe08a, 0x6e8436];
export const SEED_TINTS = [0xfff2c8, 0xf0d890, 0xff9a22, 0xffd050];
export const HEXBAT_TINTS = [0x7a3aa8, 0x2e1644, 0xff8a2a, 0xc890ff];
export const KING_FIRE_TINTS = [0xffd050, 0xff7a1a, 0xa8ff6a, 0xfff2b0];
export const KING_GHOST_TINTS = [0x9affb0, 0x3ae080, 0xe0fff0, 0x18904a];
/** Candy-coloured sparks for his fall. */
export const CANDY_TINTS = [0xff5ab4, 0xffd23a, 0x7af0ff, 0xb07aff, 0xff8a2a, 0x8aff7a];

// ---------------------------------------------------------------- Materials

const PUMPKIN: Material = { ramp: ramp('#3a1004', '#62200a', '#8e340c', '#bc5212', '#e2761e', '#f89c3a', '#ffc070'), outline: hex('#1a0602'), outlineLit: hex('#4a1806'), shine: true };
const STEM: Material = { ramp: ramp('#1a1a08', '#2e3410', '#48521c', '#66702a', '#86903c'), outline: hex('#0c0c04') };
const VINE: Material = { ramp: ramp('#0c1a08', '#16300e', '#244a16', '#346620', '#4a842c', '#64a03a'), outline: hex('#060c04'), outlineLit: hex('#12220a') };
const VINE_DARK: Material = { ramp: ramp('#08120a', '#10220e', '#1a3414', '#27481c', '#346026'), outline: hex('#060c04') };
const LEAF: Material = { ramp: ramp('#14300c', '#245214', '#3a7a1e', '#58a02e', '#80c448'), outline: hex('#08140a') };
const FUR: Material = { ramp: ramp('#0a0612', '#160c22', '#241434', '#341e4a', '#462a60'), outline: INK, outlineLit: hex('#1a0e28') };
const MEMBRANE: Material = { ramp: ramp('#0e0616', '#180a26', '#261238', '#361a4e', '#4a2668'), outline: INK, outlineLit: hex('#1e0e2e') };
const BONE_V: Material = { ramp: ramp('#1e1030', '#34204c', '#4e3470', '#6c4c94'), outline: INK };
const EAR_IN: Material = { ramp: ramp('#3a1438', '#5a2250', '#7a3468'), outline: INK };
const FANG: Material = { ramp: ramp('#8a8070', '#d8d0bc', '#fff8e8'), outline: INK, noAO: true };
const BAT_EYE: Material = { ramp: ramp('#a03a06', '#ff7a1a', '#ffa436', '#ffe08a'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const GLINT: Material = { ramp: ramp('#8e340c', '#e2761e', '#ffb050', '#ffe0a0'), outline: INK, emissive: 0.45, shine: true };
const CLOAK: Material = { ramp: ramp('#12061a', '#1e0a2c', '#2e1242', '#421a5c', '#5a2676', '#763490'), outline: INK, outlineLit: hex('#220c30') };
const LINING: Material = { ramp: ramp('#14040e', '#220818', '#340e24', '#4a1630', '#5e1e3a'), outline: INK };
const GOLD: Material = { ramp: ramp('#3a2004', '#6a4410', '#a8741c', '#dcaa30', '#f8d858', '#fff4b0'), outline: hex('#1c0e02'), shine: true };
const STRAW: Material = { ramp: ramp('#4a3408', '#7a5a16', '#a8862a', '#d4b448', '#f0da80'), outline: hex('#1e1404') };
const CLAW: Material = { ramp: ramp('#1c1612', '#3a3026', '#62564a', '#948876', '#c8bca4'), outline: INK, shine: true };
const WOOD: Material = { ramp: ramp('#140c08', '#24160e', '#382416', '#4e3420', '#664630'), outline: INK };
const INK_MAT: Material = { ramp: ramp('#0a0408', '#1a0810'), outline: INK, noAO: true };
const SOIL: Material = { ramp: ramp('#140c08', '#24180e', '#382618', '#4c3622', '#60462e'), outline: INK };

/** The fire inside a pumpkin: its core, the lit rind at the cut, and the colours of the light it throws. */
interface Fire {
  core: Material;
  rind: Material;
  hot: RGB;
  mid: RGB;
  /** The colour at the tips of its flames. */
  tip: RGB;
}

const glowing = (r: RGB[], emissive: number): Material => ({ ramp: r, outline: INK, emissive, noAO: true, noOutline: true });

/** Candle-orange fire, its flames licking green at the tips. */
export const EMBER_FIRE: Fire = {
  core: glowing(ramp('#8a2a04', '#e0600c', '#ff9a22', '#ffd050', '#fff2b0'), 1),
  rind: glowing(ramp('#9a4a0c', '#d8801e', '#ffb850', '#ffe08a'), 0.6),
  hot: hex('#ffd060'),
  mid: hex('#ff7a1a'),
  tip: hex('#a8ff6a'),
};

/** The King's fire when he is enraged: ghost-green through and through. */
export const GHOST_FIRE: Fire = {
  core: glowing(ramp('#0a4a2a', '#18904a', '#46e07a', '#8cffa0', '#d0ffd8'), 1),
  rind: glowing(ramp('#2a6a3a', '#58b060', '#8ee890', '#c8ffc0'), 0.6),
  hot: hex('#b0ffc0'),
  mid: hex('#3ae080'),
  tip: hex('#e0fff0'),
};

// ---------------------------------------------------------------- Pumpkins

type FaceStyle = 'small' | 'king' | 'bomb';

interface Carve {
  /** Longitude (radians, + to the right) the face is centred on. */
  lon: number;
  /** Half the face's width, in radians of longitude. */
  span: number;
  style: FaceStyle;
  /** 0..1 how wide the mouth gapes. */
  open: number;
  fire: Fire;
  /** 0..1 the fire burning up bright. */
  flare: number;
  /** This frame's flicker, 0.7..1. */
  flicker: number;
}

/** Inside a polygon, in face coordinates. */
function inPoly(u: number, v: number, pts: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Eyes (the right one; the left is its mirror), in face coordinates: u across
// the face -1..1, v down it. Slanted down toward the nose, so they glare.
const EYE_SMALL = [[0.8, -0.6], [0.16, -0.24], [0.3, 0.06], [0.74, -0.04]] as const;
const EYE_KING = [[0.8, -0.62], [0.14, -0.26], [0.22, 0.02], [0.52, 0.06], [0.74, -0.08]] as const;
const EYE_BOMB = [[0.9, -0.7], [0.05, -0.2], [0.3, 0.2], [0.85, 0.1]] as const;

/** Is (u, v) cut out of the face? */
function carved(style: FaceStyle, u: number, v: number, open: number): boolean {
  const au = Math.abs(u);
  const eye = style === 'king' ? EYE_KING : style === 'bomb' ? EYE_BOMB : EYE_SMALL;
  if (inPoly(au, v, eye)) return true;
  if (style === 'bomb') return false;
  if (style === 'king' && v > 0.04 && v < 0.24 && au < ((v - 0.04) / 0.2) * 0.13) return true;
  // A grin whose corners curl up, wider as it gapes.
  const reach = style === 'king' ? 0.92 : 0.9;
  if (au > reach) return false;
  const top = (style === 'king' ? 0.36 : 0.3) - 0.34 * u * u;
  const bot = (style === 'king' ? 0.58 : 0.5) + open * 0.36 - 0.22 * u * u - (style === 'king' ? 0.08 * Math.max(0, au - 0.7) * 6 : 0);
  if (v < top || v > bot) return false;
  // Teeth: square fangs hanging from the upper lip and rising from the lower.
  if (style === 'king') {
    if (au > 0.3 && au < 0.46 && v < top + 0.17) return false;
    if (au < 0.1 && v < top + 0.12) return false;
    if (((au > 0.12 && au < 0.26) || (au > 0.6 && au < 0.72)) && v > bot - 0.15 - open * 0.05) return false;
  } else if (au < 0.16 && v < top + 0.16) return false;
  return true;
}

/**
 * A pumpkin at (cx, cy), `rx` by `ry`, with `lobes` ribs across its front and
 * (optionally) a carved face lit from inside. Its stem is left to the caller.
 */
function pumpkin(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, lobes: number, carve: Carve | null, skin: Material = PUMPKIN): void {
  const x0 = Math.floor(cx - rx) - 1;
  const y0 = Math.floor(cy - ry) - 1;
  const w = Math.ceil(rx * 2) + 3;
  const h = Math.ceil(ry * 2) + 3;
  const hole = new Uint8Array(w * h);
  const lobeW = Math.PI / lobes;
  const deep = rx > 12;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = x0 + i;
      const y = y0 + j;
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      // Where on the ball this pixel is: its longitude picks the rib it lies on.
      const s = Math.sqrt(Math.max(0.0001, 1 - dy * dy));
      const lon = Math.asin(Math.max(-1, Math.min(1, dx / s)));
      const ph = (lon + Math.PI / 2) / lobeW + 0.5;
      const local = ph - Math.floor(ph) - 0.5;
      // Each rib bulges: its normal turns away from the rib's middle.
      const base = sphere(dx, dy, 1);
      const a = local * 1.15;
      const n: Vec3 = { x: base.x * Math.cos(a) + base.z * Math.sin(a), y: base.y, z: -base.x * Math.sin(a) + base.z * Math.cos(a) };
      let bias = 0;
      if (Math.abs(local) > (deep ? 0.4 : 0.36)) bias -= 1;
      if (deep && Math.abs(local) > 0.46) bias -= 1;
      // The dimple the stem grows from, and the underside in its own shade.
      if (dy < -0.72 && Math.abs(dx) < 0.3) bias -= 1;
      if (dy > 0.82) bias -= 1;
      c.px(x, y, skin, n, { bias });
      if (carve) {
        const u = (lon - carve.lon) / carve.span;
        const v = Math.asin(dy) / (Math.PI * 0.36);
        if (carved(carve.style, u, v, carve.open)) hole[j * w + i] = 1;
      }
    }
  }
  if (!carve) return;
  // The carving: the lip of rind at the bottom of each cut catches the
  // candle; through the holes, the fire burns brightest in the middle.
  c.part();
  const f = carve.fire;
  const at = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && hole[j * w + i] === 1;
  const lift = (carve.flare > 0.5 ? 1 : 0) - (carve.flicker < 0.8 ? 1 : 0);
  const glow = 0.75 + carve.flicker * 0.25;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (!at(i, j)) continue;
      const x = x0 + i;
      const y = y0 + j;
      // (Too small a face to show its rind: it would only blur the cut.)
      if (carve.style !== 'small' && !at(i, j + 1) && at(i, j - 1)) c.px(x, y, f.rind, FLAT, { bias: lift, glow: 0.6 * glow });
      else {
        const edge = !at(i - 1, j) || !at(i + 1, j) || !at(i, j - 1);
        c.px(x, y, f.core, FLAT, { bias: (edge ? -1 : 0) + lift, glow });
      }
    }
  }
  // Light spilling out over the rind round each cut.
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (at(i, j)) continue;
      const near = at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1);
      if (near && c.filled(x0 + i, y0 + j)) c.spark(x0 + i, y0 + j, f.mid, (0.16 + carve.flare * 0.2) * carve.flicker);
    }
  }
}

/** A curling tendril through the given points, tapering from r0 to r1. */
function tendril(c: PixelCanvas, pts: [number, number][], r0: number, r1: number, m: Material): void {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    c.capsule(ax, ay, bx, by, r0 + ((r1 - r0) * i) / n, r0 + ((r1 - r0) * (i + 1)) / n, m);
  }
}

/** A curl: a spiral of 1px vine ending in a hook, from (x, y). */
function curl(c: PixelCanvas, x: number, y: number, dir: number, size: number, m: Material): void {
  let px = x;
  let py = y;
  for (let k = 0; k <= 10; k++) {
    const a = -Math.PI / 2 + dir * k * 0.55;
    const r = size * (1 - k / 14);
    const nx = x + Math.cos(a) * r * dir + dir * size * 0.2;
    const ny = y + Math.sin(a) * r + size;
    c.line(px, py, nx, ny, m, () => ({ x: -0.3, y: 0.5, z: 0.8 }));
    px = nx;
    py = ny;
  }
}

/** A leaf from (x, y) pointing along (ux, uy), `len` long, veined down its middle. */
function leaf(c: PixelCanvas, x: number, y: number, ux: number, uy: number, len: number, wide: number): void {
  const nx = -uy;
  const ny = ux;
  const pts: [number, number][] = [
    [x, y],
    [x + ux * len * 0.35 + nx * wide, y + uy * len * 0.35 + ny * wide],
    [x + ux * len, y + uy * len],
    [x + ux * len * 0.4 - nx * wide * 0.8, y + uy * len * 0.4 - ny * wide * 0.8],
  ];
  poly(c, pts, LEAF, (px, py) => {
    const s = (px + 0.5 - x) * nx + (py + 0.5 - y) * ny;
    return s > 0 ? { x: -0.3, y: 0.5, z: 0.8 } : { x: 0.3, y: 0.1, z: 0.9 };
  });
  for (let k = 1; k < len - 1; k++) c.shade(x + ux * k, y + uy * k, -1);
}

// ---------------------------------------------------------------- Gourdling

interface GourdPose {
  /** 0..1 phase of its bob. */
  t: number;
  step?: number;
  /** 0..1 crouched to pounce. */
  squat?: number;
  pounce?: boolean;
  flare?: number;
  flicker: number;
}

function gourdling(p: GourdPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.gourdling;
  const c = new PixelCanvas(w, h);
  const cx = 11;
  const foot = 24;
  const sq = p.squat ?? 0;
  const bob = p.step !== undefined ? (p.step % 2 ? -1 : 0) : Math.round(Math.sin(p.t * Math.PI * 2) * 0.6);
  const up = p.pounce ? 3 : 0;
  const by = foot - 9.5 + sq * 2 - up + bob;
  const rx = 7.4 + sq * 0.9 + (p.pounce ? -0.3 : 0);
  const ry = 5.8 - sq * 1 + (p.pounce ? 0.3 : 0);
  const flare = p.flare ?? 0;

  // Vine legs: two behind the body, two in front, each a curling tendril.
  const leg = (ax: number, near: boolean, k: number) => {
    const sx = cx + ax;
    const sy = by + ry * 0.55;
    let fx: number;
    let fy = foot - 0.5;
    if (p.pounce) {
      // Front legs reach for the prey, back ones trail.
      fx = ax > 0 ? sx + 5 : sx - 5;
      fy = by + ry + (ax > 0 ? 0 : 1.5);
    } else if (sq > 0) fx = sx + Math.sign(ax || 1) * (2.5 + sq * 2.5);
    else {
      const lifted = p.step !== undefined && (k + p.step) % 2 === 0;
      fx = sx + Math.sign(ax || 1) * 2 + (p.step !== undefined ? (lifted ? 1.5 : -1) : 0);
      if (lifted) fy -= 1.5;
    }
    const mx = (sx + fx) / 2 + Math.sign(ax || 1) * 1.5;
    const my = Math.min(sy, fy) + (fy - sy) * 0.3;
    tendril(c, [[sx, sy], [mx, my], [fx, fy]], 1.15, 0.7, near ? VINE : VINE_DARK);
    // A curled toe.
    c.px(fx + Math.sign(fx - sx || 1), fy - 0.5, near ? VINE : VINE_DARK, { x: 0.2, y: 0.6, z: 0.8 });
  };
  c.part();
  leg(-3.5, false, 0);
  leg(2.5, false, 1);

  // The pumpkin body, with its grin.
  c.part();
  pumpkin(c, cx, by, rx, ry, 5, { lon: 0.38, span: 0.92, style: 'small', open: p.pounce ? 1 : sq * 0.35, fire: EMBER_FIRE, flare, flicker: p.flicker });

  // The stem and its leaf and curl.
  c.part();
  const top = by - ry + 0.8;
  tendril(c, [[cx - 0.5, top + 1], [cx - 0.3, top - 1.5], [cx + 0.8, top - 3]], 1.2, 0.8, STEM);
  c.part();
  leaf(c, cx - 1, top - 0.5, -0.85, -0.35, 5, 1.6);
  curl(c, cx + 1, top - 3, 1, 1.6, VINE);

  // Near legs, in front.
  c.part();
  leg(-1, true, 1);
  leg(4.5, true, 0);

  // The fire's glow, stronger as it flares.
  const fx = cx + 3;
  const fy = by;
  const R = rng(Math.round(p.t * 50) + (p.step ?? 0) * 7 + sq * 13);
  if (flare > 0) {
    for (let k = 0; k < 3 + flare * 5; k++) c.spark(fx + (R() - 0.5) * 12, fy + (R() - 0.5) * 9, k % 2 ? EMBER_FIRE.hot : EMBER_FIRE.mid, 0.25 + R() * 0.4 * flare);
  }
  if (p.pounce) for (let k = 0; k < 6; k++) c.spark(cx - 6 - R() * 5, by - 3 + R() * 6, EMBER_FIRE.mid, 0.2 + R() * 0.3);
  return c;
}

export function buildGourdlingSheet(): MonsterSheet {
  const flick = [1, 0.78, 0.94, 0.72];
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => gourdling({ t: i / 4, flicker: flick[i] })));
  [0, 1, 2, 3].forEach((i) => (poses[`walk${i}`] = () => gourdling({ t: 0, step: i, flicker: flick[(i + 1) % 4] })));
  poses.squat0 = () => gourdling({ t: 0, squat: 0.6, flare: 0.6, flicker: 0.9 });
  poses.squat1 = () => gourdling({ t: 0, squat: 1, flare: 1, flicker: 1 });
  poses.pounce = () => gourdling({ t: 0, pounce: true, flare: 1, flicker: 1 });
  return sheet(MONSTER_FRAME.gourdling, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 6, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 11, loop: true },
    { name: 'windup', frames: ['squat0', 'squat1'], fps: 9, loop: true },
  ]);
}

// ---------------------------------------------------------------- Hexbat

interface HexPose {
  /** Wing beat: -1 up .. 1 down. */
  beat: number;
  shriek?: boolean;
  dive?: boolean;
  flicker: number;
}

function hexbat(p: HexPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.hexbat;
  const c = new PixelCanvas(w, h);
  const cx = 18;
  const by = p.dive ? 13 : 12;
  const beat = p.beat;
  const glare = p.shriek ? 1 : p.dive ? 0.7 : 0;

  // Wings: an arm bone to the wrist, three fingers fanning from it, and the
  // membrane stretched between them, scalloped and torn along its edge.
  const wing = (side: 1 | -1) => {
    c.part();
    const sx = cx + side * 2.5;
    const sy = by - 1;
    let wrist: [number, number];
    let tips: [number, number][];
    if (p.dive) {
      // Swept back and up, tight to the body.
      wrist = [sx + side * 3 - 3, sy - 5];
      tips = [[sx - 9 + side * 2, sy - 8], [sx - 10 + side * 2, sy - 3], [sx - 7 + side * 2, sy + 2]];
    } else if (p.shriek) {
      // Flung wide and high: the whole span on show.
      wrist = [sx + side * 6, sy - 8];
      tips = [[sx + side * 10, sy - 12], [sx + side * 15, sy - 6], [sx + side * 13, sy + 1]];
    } else {
      const wy = sy - 3 + (beat + 1) * 2.5;
      const reach = 1 - Math.abs(beat) * 0.12;
      wrist = [sx + side * 6.5 * reach, wy - 2];
      const tipY = sy - 6 + (beat + 1) * 4.5;
      tips = [[sx + side * 9 * reach, tipY - 4], [sx + side * 15 * reach, tipY], [sx + side * 12 * reach, tipY + 5]];
    }
    const pts: [number, number][] = [[sx, sy - 1], wrist];
    // Between each fingertip the membrane sags back toward the wrist.
    for (let k = 0; k < tips.length; k++) {
      pts.push(tips[k]);
      const nxt = k + 1 < tips.length ? tips[k + 1] : [sx + side * 1, sy + 4];
      pts.push([(tips[k][0] + nxt[0]) / 2 + (wrist[0] - (tips[k][0] + nxt[0]) / 2) * 0.28, (tips[k][1] + nxt[1]) / 2 + (wrist[1] - (tips[k][1] + nxt[1]) / 2) * 0.28]);
    }
    pts.push([sx, sy + 3]);
    poly(c, pts, MEMBRANE, (x, y) => {
      // The membrane billows: lit toward the top-left, darker near the body.
      const d = Math.hypot(x - sx, y - sy) / 14;
      return { x: side * 0.3 * d - 0.1, y: -beat * 0.45 + 0.25, z: 0.85 };
    });
    // Fine creases toward the body.
    for (let k = 1; k < 3; k++) c.shade(sx + side * k, sy + k * 0.5, -1);
    // Bones: the arm, then each finger.
    c.part();
    c.capsule(sx, sy - 1, wrist[0], wrist[1], 0.9, 0.7, BONE_V);
    for (const [tx, ty] of tips) c.line(wrist[0], wrist[1], tx, ty, BONE_V, () => ({ x: -0.3, y: 0.5, z: 0.8 }));
    // A hooked thumb claw at the wrist.
    c.px(wrist[0] + side * 0.5, wrist[1] - 1, FANG);
    // Torchlight caught along the torn edge.
    for (const [tx, ty] of tips) c.spark(tx, ty, hex('#b070ff'), 0.25);
  };
  wing(-1);
  wing(1);

  // Body: a round of dark fur, the glint of orange on its belly.
  c.part();
  c.ellipse(cx, by + 1.5, 3.6, 4.4, FUR);
  c.part();
  c.ellipse(cx + 0.8, by + 3.2, 1.1, 1.3, GLINT);
  c.spark(cx + 0.8, by + 2.8, hex('#ffb050'), 0.3);
  // Head.
  c.part();
  const hx = cx + 1.5;
  const hy = by - 3.6 - (p.shriek ? 1 : 0);
  c.ellipse(hx, hy, 3.4, 3, FUR);
  // Tall ears, their insides flushed.
  c.part();
  poly(c, [[hx - 2.6, hy - 1.5], [hx - 2.4, hy - 7.5], [hx - 0.2, hy - 2.5]], FUR, () => ({ x: -0.4, y: 0.5, z: 0.75 }));
  poly(c, [[hx + 0.6, hy - 2.5], [hx + 2.6, hy - 7.8], [hx + 3.4, hy - 1.5]], FUR, () => ({ x: 0.2, y: 0.5, z: 0.8 }));
  c.part();
  c.line(hx - 2, hy - 3, hx - 2, hy - 5.5, EAR_IN);
  c.line(hx + 2.2, hy - 3, hx + 2.6, hy - 5.8, EAR_IN);
  // Ember eyes; they blaze when it shrieks.
  c.part();
  const ey = hy - 0.4;
  const eyes = [hx + 0.5, hx + 2.8];
  for (const ex of eyes) {
    c.px(ex, ey, BAT_EYE, FLAT, { bias: glare > 0 ? 1 : 0, glow: 0.8 + p.flicker * 0.2 });
    if (glare > 0.5) c.px(ex, ey - 1, BAT_EYE, FLAT, { glow: 1 });
    c.spark(ex, ey, EMBER_FIRE.mid, 0.35 + glare * 0.5);
    if (glare > 0.5) {
      c.spark(ex - 1, ey, EMBER_FIRE.mid, 0.3);
      c.spark(ex + 1, ey, EMBER_FIRE.mid, 0.3);
      c.spark(ex, ey - 2, EMBER_FIRE.hot, 0.25);
    }
  }
  // A snout, and fangs, bared wide in a shriek.
  c.part();
  if (p.shriek) {
    c.px(hx + 1, hy + 2, INK_MAT);
    c.px(hx + 2, hy + 2, INK_MAT);
    c.px(hx + 1, hy + 3, FANG);
    c.px(hx + 2.8, hy + 3, FANG);
    for (let k = 0; k < 4; k++) c.spark(hx + 5 + k * 1.5, hy + 1 - k * 1.2 + (k % 2), hex('#c890ff'), 0.4 - k * 0.07);
  } else {
    c.px(hx + 1.2, hy + 2, FANG);
    c.px(hx + 2.4, hy + 2, FANG);
  }
  // Little clawed feet tucked under it.
  c.part();
  c.px(cx - 1, by + 6, BONE_V);
  c.px(cx + 1, by + 6, BONE_V);
  return c;
}

export function buildHexbatSheet(): MonsterSheet {
  const beats = [-1, -0.35, 0.5, 1, 0.35, -0.5];
  const flick = [1, 0.85, 0.95, 0.8, 1, 0.9];
  const poses: Record<string, () => PixelCanvas> = {};
  beats.forEach((b, i) => (poses[`fly${i}`] = () => hexbat({ beat: b, flicker: flick[i] })));
  poses.shriek0 = () => hexbat({ beat: -1, shriek: true, flicker: 1 });
  poses.shriek1 = () => hexbat({ beat: -0.6, shriek: true, flicker: 0.85 });
  poses.dive = () => hexbat({ beat: 0, dive: true, flicker: 1 });
  return sheet(MONSTER_FRAME.hexbat, poses, [
    { name: 'idle', frames: ['fly0', 'fly1', 'fly2', 'fly3', 'fly4', 'fly5'], fps: 13, loop: true },
    { name: 'walk', frames: ['fly0', 'fly1', 'fly2', 'fly3', 'fly4', 'fly5'], fps: 16, loop: true },
    { name: 'windup', frames: ['shriek0', 'shriek1'], fps: 12, loop: true },
  ]);
}

// ---------------------------------------------------------------- The Pumpkin King

const KX = 46;
const KFOOT = 100;
/** The middle of his head, in the frame. */
export const KING_HEAD_Y = 33;
const HEAD_RX = 17.5;
const HEAD_RY = 14.5;

export type KingMood = 'idle' | 'walk' | 'lash0' | 'lash1' | 'throw0' | 'throw1' | 'summon';

interface KingPose {
  /** 0..1 phase of his sway. */
  t: number;
  mood: KingMood;
  step?: number;
  ghost: boolean;
  flicker: number;
  flare?: number;
}

/** A clawed hand at (x, y), its four hooked claws reaching along `a` (radians), spread `open`. */
function claws(c: PixelCanvas, x: number, y: number, a: number, open: number): void {
  c.ellipse(x, y, 2.3, 2, VINE_DARK);
  c.part();
  for (let k = 0; k < 4; k++) {
    const b = a + (k - 1.5) * (0.28 + open * 0.22);
    const kx = x + Math.cos(b) * 2;
    const ky = y + Math.sin(b) * 2;
    const len = k === 0 || k === 3 ? 3.6 : 4.6;
    const tx = kx + Math.cos(b) * len;
    const ty = ky + Math.sin(b) * len;
    // Each claw hooks at its tip.
    const hx = tx + Math.cos(b + 1.2) * 1.2;
    const hy = ty + Math.sin(b + 1.2) * 1.2;
    c.capsule(kx, ky, tx, ty, 0.85, 0.55, CLAW);
    c.px(hx, hy, CLAW, { x: -0.3, y: 0.5, z: 0.8 });
  }
}

/** A long twisted vine arm from shoulder through elbow to hand: two strands winding round each other. */
function vineArm(c: PixelCanvas, pts: [number, number][], r: number, near: boolean): void {
  tendril(c, pts, r, r * 0.75, near ? VINE : VINE_DARK);
  // The second strand, wound round the first.
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const nx = -(by - ay) / (len || 1);
    const ny = (bx - ax) / (len || 1);
    const n = Math.ceil(len / 1.5);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const wob = Math.sin((i * n + k) * 0.9) * r * 0.75;
      const x = ax + (bx - ax) * t + nx * wob;
      const y = ay + (by - ay) * t + ny * wob;
      if (Math.sin((i * n + k) * 0.9 + Math.PI / 2) > 0) c.px(x, y, near ? LEAF : VINE, { x: nx * 0.5 - 0.2, y: 0.5, z: 0.75 });
      else c.shade(x, y, -1);
    }
  }
}

/** Straw poking out in a tuft from (x, y), fanned round `a`. */
function straw(c: PixelCanvas, x: number, y: number, a: number, n: number, len: number, seed: number): void {
  const R = rng(seed);
  for (let k = 0; k < n; k++) {
    const b = a + (k / Math.max(1, n - 1) - 0.5) * 1.1 + (R() - 0.5) * 0.25;
    const l = len * (0.6 + R() * 0.5);
    c.line(x + (R() - 0.5) * 2, y, x + Math.cos(b) * l, y + Math.sin(b) * l, STRAW, (i, m) => ({ x: -0.3, y: 0.6 - i / (m || 1), z: 0.75 }));
  }
}

function king(p: KingPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.pumpkin_king;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const fire = p.ghost ? GHOST_FIRE : EMBER_FIRE;
  const flare = p.flare ?? 0;
  const walking = p.step !== undefined;
  const bob = walking ? (p.step! % 2 ? -1 : 0) : Math.round(Math.sin(tau) * 0.8);
  const sway = Math.sin(tau + 0.6) * 1.2 + (walking ? -1 : 0);
  const lean = p.mood === 'lash1' ? 2 : p.mood === 'lash0' ? -1 : p.mood === 'summon' ? 0 : 0;
  const crouch = p.mood === 'summon' ? 2 : p.mood === 'lash1' ? 1 : 0;
  const R = rng(Math.round(p.t * 97) + p.mood.length * 31 + (p.step ?? 0) * 7 + (p.ghost ? 500 : 0));
  const shoulderY = 52 + bob + crouch;
  const headX = KX + 1 + lean;
  const headY = KING_HEAD_Y + bob + crouch;

  // The cloak, hanging behind him to the floor. From the front we see its
  // lining; its outer cloth shows where it wraps round the sides, edged in gold.
  c.part();
  const cloakTop = shoulderY - 5;
  const hemY = KFOOT - 3;
  const cloakX = (u: number) => KX - 2 - lean * 0.5 + sway * u * 1.5 - u * 2;
  c.shape(cloakTop, hemY, (y) => {
    const u = (y - cloakTop) / (hemY - cloakTop);
    const hw = 14 + u * 17 + Math.sin(u * 4 + tau) * 1.2;
    const x = cloakX(u);
    return [x - hw, x + hw];
  }, CLOAK, (x, y, t) => {
    // Folds falling from the shoulders.
    const u = (y - cloakTop) / (hemY - cloakTop);
    const fold = Math.sin((x - KX) * 0.55 + u * 2 + tau * 0.5) * 0.45 * u;
    const n = cyl(t, 0.1);
    return { x: n.x + fold, y: n.y, z: n.z };
  });
  // Its tattered hem and rips; the lining in the middle; gold trim down the edges.
  for (let x = KX - 34; x <= KX + 34; x++) {
    const tear = 1 + Math.abs(Math.sin(x * 0.9 + 1.7)) * 3 + ((x * 7) % 11 < 3 ? 3 : 0);
    for (let y = hemY; y > hemY - tear; y--) c.erase(x, y);
  }
  for (let y = cloakTop + 3; y <= hemY; y++) {
    const u = (y - cloakTop) / (hemY - cloakTop);
    const hw = 14 + u * 17 + Math.sin(u * 4 + tau) * 1.2;
    const x = cloakX(u);
    const inner = hw - 3 - u * 2;
    for (let xx = Math.round(x - inner); xx < Math.round(x + inner); xx++) {
      if (!c.filled(xx, y)) continue;
      const m = c.materialAt(xx, y);
      if (m !== CLOAK) continue;
      c.px(xx, y, LINING, { x: Math.sin((xx - KX) * 0.5 + u * 2) * 0.4, y: 0.1, z: 0.9 }, { bias: u > 0.8 ? -1 : 0 });
    }
    // Gold trim just inside the outer edges.
    for (const side of [-1, 1]) {
      const tx = Math.round(x + side * (inner + 0.5)) - (side > 0 ? 1 : 0);
      if (c.filled(tx, y)) c.px(tx, y, GOLD, { x: side * 0.4, y: 0.3, z: 0.85 });
    }
  }
  for (let k = 0; k < 3; k++) {
    const rx = KX - 22 + k * 19 + R() * 4;
    const ry = hemY - 8 - R() * 6;
    c.erase(rx, ry);
    c.erase(rx, ry + 1);
    c.erase(rx + 1, ry + 1);
  }

  // Legs: twisted vines, rooted in clawing toes.
  const stride = walking ? [3, 0, -3, 0][p.step! % 4] : 0;
  const hipY = 74 + bob + crouch;
  for (const side of [-1, 1] as const) {
    c.part();
    const near = side === 1;
    const hx = KX + side * 5;
    const fx = KX + side * (8 + crouch) + (near ? stride : -stride);
    const lift = walking && ((near && p.step === 1) || (!near && p.step === 3)) ? 2 : 0;
    const fy = KFOOT - 2 - lift;
    vineArm(c, [[hx, hipY], [(hx + fx) / 2 + side * 1.5, (hipY + fy) / 2], [fx, fy]], 2.6, near);
    // Root toes spreading over the ground.
    c.part();
    for (const [dx, dy] of [[4, 0.5], [1.5, 1.5], [-2.5, 0.8]] as const) c.capsule(fx, fy - 0.5, fx + dx * (near ? 1 : 0.8), fy + dy, 1.3, 0.6, near ? VINE : VINE_DARK);
  }

  // The far arm and its sceptre.
  c.part();
  let farHand: [number, number];
  let sceptre: { x0: number; y0: number; x1: number; y1: number };
  if (p.mood === 'throw0') {
    farHand = [KX - 10, 20 + bob];
    sceptre = { x0: KX - 11, y0: 36, x1: KX - 7, y1: 9 };
  } else if (p.mood === 'throw1') {
    farHand = [KX + 2, 38 + bob];
    sceptre = { x0: KX - 6, y0: 46, x1: KX + 22, y1: 10 };
  } else if (p.mood === 'summon') {
    farHand = [KX - 26, 80 + crouch];
    sceptre = { x0: KX - 24, y0: 94, x1: KX - 30, y1: 58 };
  } else {
    farHand = [KX - 22, 72 + bob];
    sceptre = { x0: KX - 21, y0: KFOOT - 3, x1: KX - 23, y1: 40 + bob };
  }
  // Sceptre first, gripped by the hand drawn over it.
  c.capsule(sceptre.x0, sceptre.y0, sceptre.x1, sceptre.y1, 1.1, 1, WOOD);
  const sLen = Math.hypot(sceptre.x1 - sceptre.x0, sceptre.y1 - sceptre.y0);
  const sux = (sceptre.x1 - sceptre.x0) / sLen;
  const suy = (sceptre.y1 - sceptre.y0) / sLen;
  for (const k of [0.3, 0.62, 0.93]) {
    const bx = sceptre.x0 + sux * sLen * k;
    const by = sceptre.y0 + suy * sLen * k;
    c.capsule(bx - suy * 1.4, by + sux * 1.4, bx + suy * 1.4, by - sux * 1.4, 0.8, 0.8, GOLD);
  }
  // The little pumpkin crowning it, held in gold prongs, its fire up when he casts.
  c.part();
  const tipX = sceptre.x1 + sux * 3.5;
  const tipY = sceptre.y1 + suy * 3.5;
  const casting = p.mood === 'throw0' || p.mood === 'throw1';
  for (const s of [-1, 1]) c.line(sceptre.x1, sceptre.y1, tipX + s * 3.5, tipY + 1, GOLD, () => ({ x: -0.4, y: 0.5, z: 0.75 }));
  c.part();
  pumpkin(c, tipX, tipY - 1, 4.4, 3.6, 3, { lon: 0.35, span: 0.9, style: 'bomb', open: 0, fire, flare: casting ? 1 : 0.3, flicker: p.flicker });
  if (casting) for (let k = 0; k < 10; k++) c.spark(tipX + (R() - 0.5) * 10, tipY - 3 - R() * 8, k % 3 ? fire.mid : fire.tip, 0.3 + R() * 0.5);
  c.part();
  vineArm(c, [[KX - 12, shoulderY + 1], [(KX - 12 + farHand[0]) / 2 - 4, (shoulderY + farHand[1]) / 2 + 2], farHand], 2.2, false);
  c.part();
  claws(c, farHand[0], farHand[1], p.mood === 'summon' ? Math.PI * 0.6 : Math.PI * 0.1, p.mood === 'summon' ? 1 : 0.2);

  // His body: a tapering bundle of twisted vines laced with straw.
  c.part();
  const chestTop = shoulderY - 4;
  c.shape(chestTop, hipY + 2, (y) => {
    const u = (y - chestTop) / (hipY + 2 - chestTop);
    const hw = 12 - u * 5.5 + (u > 0.85 ? (u - 0.85) * 20 : 0);
    const x = KX + lean * (1 - u) * 0.6;
    return [x - hw, x + hw];
  }, VINE_DARK, (_x, _y, t) => cyl(t, 0.2));
  // Vines wound round and round him, crossing in a lattice.
  c.part();
  for (let k = 0; k < 6; k++) {
    const y0 = chestTop + 2 + k * 4.4;
    const dir = k % 2 ? 1 : -1;
    const hw = 11 - k * 0.9;
    c.capsule(KX - hw + lean * 0.5, y0 + dir * 2.5, KX + hw + lean * 0.5, y0 - dir * 2.5, 1.3, 1.3, VINE);
  }
  // Straw bursting out between the vines, and a skirt of it over his hips.
  c.part();
  for (let k = 0; k < 4; k++) straw(c, KX - 5 + k * 3.4 + lean * 0.4, chestTop + 8 + ((k * 5) % 9), -Math.PI / 2 + (k - 1.5) * 0.5, 3, 3.5, 11 + k);
  c.part();
  for (let x = KX - 10; x <= KX + 10; x++) {
    const len = 6 + Math.abs(Math.sin(x * 1.7)) * 5 + ((x * 3) % 5 === 0 ? 2 : 0);
    const sw = Math.sin(tau + x * 0.3) * 0.8 + (walking ? -stride * 0.3 : 0);
    const y0 = hipY - 3;
    c.line(x, y0, x + sw, y0 + len, STRAW, (i, n) => ({ x: (x - KX) * 0.05 - 0.2, y: 0.6 - (i / (n || 1)) * 0.9, z: 0.75 }));
  }
  // A belt of vine, clasped in gold.
  c.part();
  c.capsule(KX - 9, hipY - 3, KX + 9, hipY - 3.5, 1.4, 1.4, VINE);
  c.ellipse(KX + 1, hipY - 3.3, 2.2, 2, GOLD);

  // The mantle over his shoulders, gold-edged, clasped with a glowing gem, and a ruff of straw.
  c.part();
  straw(c, headX - 1, shoulderY - 5, -Math.PI / 2, 9, 7, 77);
  c.part();
  const mTop = shoulderY - 6;
  const mBot = shoulderY + 7;
  c.shape(mTop, mBot, (y) => {
    const u = (y - mTop) / (mBot - mTop);
    const hw = 9 + Math.sin(Math.min(1, u * 1.3) * Math.PI * 0.5) * 9;
    const x = KX + lean * 0.7;
    return [x - hw, x + hw];
  }, CLOAK, (_x, y, t) => sphere(t * 0.9, ((y - mTop) / (mBot - mTop)) * 1.3 - 0.6, 0.9));
  // Scalloped gold edge along its hem.
  for (let x = KX - 18; x <= KX + 18; x++) {
    const yy = mBot - (Math.abs(((x - KX) % 6)) < 3 ? 0 : 1);
    if (c.filled(x + Math.round(lean * 0.7), yy)) c.px(x + Math.round(lean * 0.7), yy, GOLD, { x: (x - KX) / 30, y: 0.2, z: 0.9 });
    if (!c.filled(x + Math.round(lean * 0.7), yy + 1) && Math.abs(((x - KX) % 6)) < 3 && Math.abs(x - KX) < 17) c.erase(x + Math.round(lean * 0.7), yy + 1);
  }
  c.part();
  c.ellipse(KX + 1 + lean * 0.7, shoulderY + 1, 2.4, 2.4, GOLD);
  c.part();
  c.px(KX + 1 + lean * 0.7, shoulderY + 1, fire.core, FLAT, { glow: 1 });
  c.spark(KX + 1 + lean * 0.7, shoulderY + 1, fire.hot, 0.6);

  // The crown's back half, behind his head.
  const crownY = headY - HEAD_RY + 4;
  const tilt = -0.14;
  const band = (x: number) => crownY + (x - headX) * tilt;
  c.part();
  for (let x = -13; x <= 13; x += 1) {
    const a = Math.acos(Math.max(-1, Math.min(1, x / 13.5)));
    c.px(headX + x, band(headX + x) - Math.sin(a) * 3, VINE_DARK, { x: x / 16, y: 0.5, z: 0.7 });
  }

  // His head: the great carved pumpkin, fire burning inside.
  c.part();
  const open = p.mood === 'lash0' || p.mood === 'throw0' || p.mood === 'summon' ? 0.7 : p.mood === 'lash1' || p.mood === 'throw1' ? 1 : 0.15 + Math.max(0, Math.sin(tau)) * 0.15;
  pumpkin(c, headX, headY, HEAD_RX, HEAD_RY, 7, { lon: 0.2, span: 0.84, style: 'king', open, fire, flare, flicker: p.flicker });
  // A thick twisted stem through the crown.
  c.part();
  tendril(c, [[headX - 2, headY - HEAD_RY + 3], [headX - 2.5, headY - HEAD_RY - 1], [headX - 0.5, headY - HEAD_RY - 4]], 2.4, 1.6, STEM);

  // The crown's front: a band of twisted vine, crooked, set with golden thorns.
  c.part();
  for (let x = -14; x <= 14; x++) {
    const a = Math.acos(Math.max(-1, Math.min(1, x / 14.5)));
    const y = band(headX + x) + Math.sin(a) * 2.5;
    c.capsule(headX + x, y, headX + x, y, 1.6, 1.6, VINE);
    if ((x + 20) % 4 === 0) c.shade(headX + x, y, -1);
  }
  c.part();
  const thorns: [number, number, number][] = [[-12, 6, -0.45], [-7, 9, -0.2], [-2, 7, 0.1], [3, 11, -0.05], [8, 8, 0.25], [12, 6, 0.5]];
  for (const [dx, len, lean2] of thorns) {
    const a = Math.acos(Math.max(-1, Math.min(1, dx / 14.5)));
    const bx = headX + dx;
    const by = band(bx) + Math.sin(a) * 2.5 - 1;
    const tx = bx + Math.sin(lean2) * len;
    const ty = by - Math.cos(lean2) * len;
    // A tapering golden thorn with a kink halfway, as if grown, not forged.
    const mx = (bx + tx) / 2 + (dx > 0 ? 1 : -1) * 0.8;
    const my = (by + ty) / 2;
    c.capsule(bx, by, mx, my, 1.4, 0.9, GOLD);
    c.capsule(mx, my, tx, ty, 0.9, 0.35, GOLD);
    c.spark(tx, ty + 1, hex('#fff4b0'), 0.5);
  }
  // A glowing gem at the crown's front.
  c.part();
  const gx = headX + 3;
  const gy = band(gx) + 2.4;
  c.ellipse(gx, gy, 1.6, 1.4, fire.core, { glow: 1 });
  c.spark(gx, gy, fire.hot, 0.8);

  // Flames licking up out of his head round the stem.
  const tongues = 6 + Math.round(flare * 4) + (p.ghost ? 3 : 0);
  for (let k = 0; k < tongues; k++) {
    const fx = headX - 9 + (18 * (k + 0.5)) / tongues + (R() - 0.5) * 2;
    const base = band(fx) - 1;
    const hgt = 3 + R() * 6 * p.flicker + flare * 4 + (p.ghost ? 3 : 0);
    const drift = Math.sin(tau * 2 + k) * 1.5;
    for (let j = 0; j < hgt; j++) {
      const u = j / hgt;
      const col = u < 0.35 ? fire.hot : u < 0.7 ? fire.mid : fire.tip;
      c.spark(fx + drift * u, base - j, col, (1 - u) * 0.75);
    }
  }
  for (let k = 0; k < 5; k++) c.spark(headX - 10 + R() * 20, crownY - 12 - R() * 10, R() < 0.5 ? fire.tip : fire.mid, 0.3 + R() * 0.4);
  // His firelight on the mantle under his jaw.
  for (let x = -10; x <= 10; x++) if (c.filled(headX + x, headY + HEAD_RY + 2)) c.spark(headX + x, headY + HEAD_RY + 2, fire.mid, 0.12 + flare * 0.1);

  // The near arm, the one he lashes with.
  c.part();
  let arm: [number, number][];
  let clawA: number;
  let spread = 0.3;
  if (p.mood === 'lash0') {
    arm = [[KX + 12, shoulderY], [KX + 22, shoulderY - 12], [KX + 20, shoulderY - 26]];
    clawA = -Math.PI * 0.6;
    spread = 1;
  } else if (p.mood === 'lash1') {
    arm = [[KX + 12, shoulderY], [KX + 26, shoulderY + 10], [KX + 38, shoulderY + 20]];
    clawA = Math.PI * 0.15;
    spread = 0.9;
  } else if (p.mood === 'throw0' || p.mood === 'throw1') {
    arm = [[KX + 12, shoulderY], [KX + 21, shoulderY + 9], [KX + 22, shoulderY + 20]];
    clawA = Math.PI * 0.45;
  } else if (p.mood === 'summon') {
    arm = [[KX + 12, shoulderY], [KX + 22, shoulderY + 14], [KX + 26, 80 + crouch]];
    clawA = Math.PI * 0.4;
    spread = 1;
  } else {
    const swing = walking ? -stride * 0.8 : Math.sin(tau) * 1;
    arm = [[KX + 12, shoulderY], [KX + 19 + swing * 0.5, shoulderY + 12], [KX + 21 + swing, shoulderY + 24]];
    clawA = Math.PI * 0.5;
  }
  vineArm(c, arm, 2.4, true);
  c.part();
  const [hx, hy] = arm[arm.length - 1];
  claws(c, hx, hy, clawA, spread);
  // The lash: a thorny whip of vine uncoiling from his claws, glowing at its thorns.
  if (p.mood === 'lash0') {
    c.part();
    const coil: [number, number][] = [];
    for (let k = 0; k <= 8; k++) {
      const a = k * 0.8;
      coil.push([hx - 2 + Math.cos(a) * (3 + k * 0.5), hy - 4 - k * 1.2 + Math.sin(a) * 2]);
    }
    tendril(c, coil, 1.2, 0.6, VINE);
    for (let k = 0; k < 6; k++) c.spark(hx + (R() - 0.5) * 12, hy - 4 - R() * 12, k % 2 ? fire.mid : fire.tip, 0.35 + R() * 0.4);
  } else if (p.mood === 'lash1') {
    c.part();
    const whip: [number, number][] = [[hx + 2, hy + 2], [hx + 5, hy + 8], [hx + 5, hy + 15], [hx + 1, KFOOT - 5]];
    tendril(c, whip, 1.4, 0.6, VINE);
    for (let k = 1; k < whip.length; k++) {
      const [x, y] = whip[k];
      c.px(x + 1, y - 1, GOLD);
      c.spark(x + 1, y - 1, fire.hot, 0.6);
    }
  }
  // Vines sprouting round his feet as he calls his gourdlings.
  if (p.mood === 'summon') {
    c.part();
    for (let k = 0; k < 5; k++) {
      const bx = KX - 24 + k * 12 + (R() - 0.5) * 3;
      const top = KFOOT - 6 - R() * 7;
      tendril(c, [[bx, KFOOT - 1], [bx + 1.5, (KFOOT + top) / 2], [bx - 0.5, top]], 1.1, 0.6, VINE);
      c.spark(bx - 0.5, top - 1, fire.tip, 0.7);
    }
  }
  return c;
}

export function buildPumpkinKingSheet(): MonsterSheet {
  const flick = [1, 0.8, 0.95, 0.75];
  const poses: Record<string, () => PixelCanvas> = {};
  for (const ghost of [false, true]) {
    const g = ghost ? 'g_' : '';
    [0, 1, 2, 3].forEach((i) => (poses[`${g}idle${i}`] = () => king({ t: i / 4, mood: 'idle', ghost, flicker: flick[i] })));
    [0, 1, 2, 3].forEach((i) => (poses[`${g}walk${i}`] = () => king({ t: i / 4, mood: 'walk', step: i, ghost, flicker: flick[(i + 2) % 4] })));
    poses[`${g}lash0`] = () => king({ t: 0.25, mood: 'lash0', ghost, flicker: 1, flare: 0.7 });
    poses[`${g}lash1`] = () => king({ t: 0.5, mood: 'lash1', ghost, flicker: 1, flare: 1 });
    poses[`${g}throw0`] = () => king({ t: 0.1, mood: 'throw0', ghost, flicker: 0.9, flare: 0.8 });
    poses[`${g}throw1`] = () => king({ t: 0.6, mood: 'throw1', ghost, flicker: 1, flare: 1 });
    poses[`${g}summon0`] = () => king({ t: 0.3, mood: 'summon', ghost, flicker: 1, flare: 0.8 });
    poses[`${g}summon1`] = () => king({ t: 0.8, mood: 'summon', ghost, flicker: 0.8, flare: 1 });
  }
  const anims: MonsterSheet['anims'] = [];
  for (const g of ['', 'g_']) {
    anims.push(
      { name: `${g}idle`, frames: [0, 1, 2, 3].map((i) => `${g}idle${i}`), fps: 6, loop: true },
      { name: `${g}walk`, frames: [0, 1, 2, 3].map((i) => `${g}walk${i}`), fps: 6, loop: true },
      { name: `${g}summon`, frames: [`${g}summon0`, `${g}summon1`], fps: 7, loop: true },
    );
  }
  return sheet(MONSTER_FRAME.pumpkin_king, poses, anims);
}

// ---------------------------------------------------------------- His spells

export const BOMB_SIZE = 16;
export const BOMB_FRAMES = 4;

/** A flaming pumpkin bomb: a little lantern with a burning fuse of vine, `f` its flicker frame. */
export function pumpkinBomb(f: number, ghost: boolean): PixelCanvas {
  const c = new PixelCanvas(BOMB_SIZE, BOMB_SIZE);
  const fire = ghost ? GHOST_FIRE : EMBER_FIRE;
  const flick = [1, 0.8, 0.95, 0.75][f % 4];
  c.part();
  pumpkin(c, 8, 10, 5.4, 4.6, 4, { lon: 0.2, span: 0.95, style: 'bomb', open: 0, fire, flare: 1, flicker: flick });
  c.part();
  c.capsule(8, 5.5, 8.5, 3.5, 1, 0.8, STEM);
  // The fuse's flame dances frame to frame.
  const R = rng(f * 17 + (ghost ? 3 : 0));
  for (let j = 0; j < 4; j++) c.spark(9 + (R() - 0.5) * 1.5, 3 - j, j < 1 ? fire.hot : j < 3 ? fire.mid : fire.tip, 1 - j * 0.2);
  c.spark(10, 1 + (f % 2), fire.tip, 0.5);
  return c;
}

export const SPROUT_W = 26;
export const SPROUT_H = 22;
export const SPROUT_FRAMES = 4;

/** Vines bursting up out of the earth where a gourdling is about to sprout, `f` 0..3 as they grow. */
export function sproutFrame(f: number): PixelCanvas {
  const c = new PixelCanvas(SPROUT_W, SPROUT_H);
  const cx = SPROUT_W / 2;
  const base = SPROUT_H - 3;
  const g = (f + 1) / SPROUT_FRAMES;
  // Upturned earth.
  c.part();
  c.ellipse(cx, base, 7 + f, 2.4, SOIL, { flatten: 0.5 });
  const R = rng(5);
  for (let k = 0; k < 5; k++) c.ellipse(cx - 8 + R() * 16, base - 0.5 + R(), 1.3, 1, SOIL);
  // Vines rising and curling.
  for (let k = 0; k < 4; k++) {
    c.part();
    const bx = cx - 6 + k * 4;
    const hgt = (5 + ((k * 5) % 7)) * g + 2;
    const s = k % 2 ? 1 : -1;
    tendril(c, [[bx, base], [bx + s * 2, base - hgt * 0.5], [bx + s * 0.5, base - hgt]], 1.2, 0.6, k % 2 ? VINE : VINE_DARK);
    if (f >= 2) c.spark(bx + s * 0.5, base - hgt - 1, EMBER_FIRE.tip, 0.6);
  }
  if (f >= 1) {
    c.part();
    leaf(c, cx - 2, base - 5 * g, -0.9, -0.4, 4 + f, 1.4);
    leaf(c, cx + 2, base - 6 * g, 0.9, -0.5, 4 + f, 1.4);
  }
  for (let k = 0; k < 3 + f * 2; k++) c.spark(cx + (R() - 0.5) * 16, base - R() * 12 * g, k % 2 ? EMBER_FIRE.mid : EMBER_FIRE.tip, 0.3 + R() * 0.3);
  return c;
}

export const LASH_W = 80;
export const LASH_H = 40;
export const LASH_FRAMES = 4;

/**
 * The glow of his lash sweeping round in front of him: a crescent of fire and
 * green light, a light layer only. Drawn for a lash to the right; `f` 0..3 as
 * it sweeps and fades.
 */
export function lashFrame(f: number, ghost: boolean): PixelCanvas {
  const c = new PixelCanvas(LASH_W, LASH_H);
  const fire = ghost ? GHOST_FIRE : EMBER_FIRE;
  const cx = 18;
  const cy = LASH_H / 2;
  const a0 = -1.25;
  const a1 = -1.25 + 2.5 * Math.min(1, (f + 1) / 2.4);
  const fade = f < 2 ? 1 : f === 2 ? 0.7 : 0.35;
  for (let a = a0; a <= a1; a += 0.012) {
    const k = (a - a0) / (a1 - a0 || 1);
    // The leading edge is thickest and hottest.
    const thick = 2 + k * 6;
    for (let r = 0; r < thick; r++) {
      const rr = 54 - r;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * 0.36;
      const col = r < 2 ? fire.hot : r < 4 ? fire.mid : fire.tip;
      c.spark(x, y, col, (0.3 + k * 0.7) * fade * (1 - r / (thick + 1)));
    }
  }
  const R = rng(f * 31 + (ghost ? 7 : 0));
  for (let k = 0; k < 12; k++) {
    const a = a0 + R() * (a1 - a0);
    const rr = 44 + R() * 14;
    c.spark(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.36, R() < 0.5 ? fire.tip : GOLD.ramp[5], 0.5 * fade);
  }
  return c;
}

export const FLAME_W = 14;
export const FLAME_H = 16;
export const FLAME_FRAMES = 4;

/** A little fire left burning on the ground where a bomb burst, a light layer only. */
export function flameFrame(f: number, ghost: boolean): PixelCanvas {
  const c = new PixelCanvas(FLAME_W, FLAME_H);
  const fire = ghost ? GHOST_FIRE : EMBER_FIRE;
  const R = rng(f * 13 + 3);
  const base = FLAME_H - 2;
  for (let k = 0; k < 4; k++) {
    const fx = 3 + k * 2.6 + (R() - 0.5);
    const hgt = 4 + R() * 7 + (k === 1 || k === 2 ? 3 : 0);
    const drift = (R() - 0.5) * 2;
    for (let j = 0; j < hgt; j++) {
      const u = j / hgt;
      const col = u < 0.3 ? fire.hot : u < 0.7 ? fire.mid : fire.tip;
      c.spark(fx + drift * u * u, base - j, col, (1 - u * 0.8) * 0.9);
      if (u < 0.5) c.spark(fx + 1 + drift * u * u, base - j, fire.mid, 0.5 * (1 - u));
    }
  }
  for (let x = 2; x < FLAME_W - 2; x++) c.spark(x, base + 1, fire.mid, 0.35);
  return c;
}
