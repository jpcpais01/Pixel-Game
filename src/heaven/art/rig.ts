// The wanderer's body, face and clothes, and the poses of every animation.
// Everything is drawn in the body's own 24 x 32 box (the soles on row 31),
// offset into a bigger frame so wings, hats and balloons have room. Seen
// three ways: from the front ('down'), from behind ('up') and from the side
// facing left ('side'; facing right is the same frame mirrored).

import { cyl, sphere, FLAT, type Material, type PixelCanvas } from '../../art/pixel';
import { BOTTOMS, DRESSES, EYES, MOUTHS, TOPS, BROWS, BEARDS, SHOES } from '../look';
import { hsh, recolor, rows, type Geo, type Kit, type P, type Pose, type View } from './kit';

export const BX = 4;
export const BY = 9;

const id = (list: { id: string }[], i: number): string => list[i]?.id ?? list[0].id;

// ---------------------------------------------------------------- poses

export type AnimName = 'idle' | 'walk' | 'wave' | 'cheer' | 'dance' | 'sit' | 'heart';

export interface AnimDef {
  name: AnimName;
  frames: number;
  fps: number;
  loop: boolean;
  /** Emotes face the viewer; walking and standing are drawn every way. */
  views: View[];
}

export const ANIMS: AnimDef[] = [
  { name: 'idle', frames: 8, fps: 6, loop: true, views: ['down', 'up', 'side'] },
  { name: 'walk', frames: 6, fps: 10, loop: true, views: ['down', 'up', 'side'] },
  { name: 'wave', frames: 8, fps: 9, loop: false, views: ['down'] },
  { name: 'cheer', frames: 6, fps: 9, loop: false, views: ['down'] },
  { name: 'dance', frames: 8, fps: 8, loop: true, views: ['down'] },
  { name: 'sit', frames: 4, fps: 3, loop: true, views: ['down'] },
  { name: 'heart', frames: 6, fps: 6, loop: false, views: ['down'] },
];

const shY = (k: Kit, bob: number, hop = 0, sit = false) => 18 - k.tall + bob - hop + (sit ? 4 : 0);

function standing(k: Kit, view: View, bob = 0): Pose {
  const s = shY(k, bob);
  const side = view === 'side';
  return {
    view,
    bob,
    hop: 0,
    dx: 0,
    feet: side ? [{ x: 11.5, y: 31 }, { x: 13, y: 31 }] : [{ x: 10.2, y: 31 }, { x: 13.8, y: 31 }],
    hands: side ? [{ x: 12.6, y: s + 6.4 }, { x: 13.2, y: s + 6 }] : [{ x: 12 - k.sw - 0.85, y: s + 6.3 }, { x: 12 + k.sw + 0.85, y: s + 6.3 }],
    blink: false,
    sway: 0,
    sit: false,
    carry: true,
    hold: 1,
    flap: 0,
  };
}

export function pose(k: Kit, anim: AnimName, view: View, i: number): Pose {
  if (anim === 'idle') {
    const bob = [0, 0, 0, 1, 1, 1, 1, 0][i];
    const p = standing(k, view, bob);
    p.blink = i === 5;
    p.sway = [0, 0.15, 0.3, 0.3, 0.15, 0, -0.15, -0.1][i];
    p.flap = i / 8;
    return p;
  }
  if (anim === 'walk') {
    const bob = [0, -1, 0, 0, -1, 0][i];
    const p = standing(k, view, bob);
    const s = shY(k, bob);
    p.flap = i / 6;
    if (view === 'side') {
      const near = [-2.6, -1.2, 1.2, 2.6, 1.2, -1.2][i];
      const liftN = [0, 0, 0, 0, 1.6, 1.4][i];
      const liftF = [0, 1.6, 1.4, 0, 0, 0][i];
      p.feet = [
        { x: 12 + near, y: 31 - liftN },
        { x: 12.6 - near, y: 31 - liftF },
      ];
      p.hands = [
        { x: 12.6 - near * 0.8, y: s + 6.2 - Math.abs(near) * 0.15 },
        { x: 13.2 + near * 0.7, y: s + 5.9 },
      ];
      p.sway = near / 4;
    } else {
      const l = [1, 2, 1, 0, 0, 0][i];
      const r = [0, 0, 0, 1, 2, 1][i];
      p.feet = [
        { x: 10.2 + l * 0.15, y: 31 - l },
        { x: 13.8 - r * 0.15, y: 31 - r },
      ];
      const sw = [0.5, 1, 0.5, -0.5, -1, -0.5][i];
      p.hands = [
        { x: 12 - k.sw - 0.85 - Math.max(0, -sw) * 0.3, y: s + 6.3 + sw },
        { x: 12 + k.sw + 0.85 + Math.max(0, sw) * 0.3, y: s + 6.3 - sw },
      ];
      p.sway = sw * 0.4;
    }
    return p;
  }
  if (anim === 'wave') {
    const p = standing(k, 'down', [0, 0, 0, 1, 1, 0, 0, 0][i]);
    const s = shY(k, p.bob);
    p.hold = 0;
    const up = i === 0 || i === 7 ? { x: 12 + k.sw + 2.2, y: s + 1 } : { x: 12 + k.sw + 1.8 + (i % 2 ? 0 : 1.6), y: s - 3.6 };
    p.hands = [p.hands[0], up];
    p.face = i === 0 || i === 7 ? undefined : 'grin';
    p.sway = i % 2 ? 0.3 : -0.3;
    return p;
  }
  if (anim === 'cheer') {
    const hop = [0, 2, 4, 3, 1, 0][i];
    const bob = [1, 0, 0, 0, 0, 1][i];
    const p = standing(k, 'down', bob);
    p.hop = hop;
    const s = shY(k, bob, hop);
    const up = i > 0 && i < 5;
    p.feet = [
      { x: 10.2, y: 31 - hop },
      { x: 13.8, y: 31 - hop },
    ];
    p.hands = up
      ? [
          { x: 12 - k.sw - 1.8, y: s - 3.8 },
          { x: 12 + k.sw + 1.8, y: s - 3.8 },
        ]
      : [
          { x: 12 - k.sw + 0.2, y: s + 4 },
          { x: 12 + k.sw - 0.2, y: s + 4 },
        ];
    p.face = 'grin';
    p.sway = [0, -0.6, -0.9, -0.4, 0.4, 0.2][i];
    p.flap = i / 6;
    return p;
  }
  if (anim === 'dance') {
    const dx = [0, 1, 1, 0, 0, -1, -1, 0][i];
    const bob = [0, -1, 0, 1, 0, -1, 0, 1][i];
    const p = standing(k, 'down', bob);
    p.dx = dx;
    const s = shY(k, bob);
    const left = i >= 4;
    const l = [0, 1, 1, 0, 0, 0, 0, 0][i];
    const r = [0, 0, 0, 0, 0, 1, 1, 0][i];
    p.feet = [
      { x: 10.2 + dx * 0.5, y: 31 - l },
      { x: 13.8 + dx * 0.5, y: 31 - r },
    ];
    p.hands = left
      ? [
          { x: 12 + dx - k.sw - 1.6, y: s - 3.4 },
          { x: 12 + dx + k.sw + 0.6, y: s + 3.6 },
        ]
      : [
          { x: 12 + dx - k.sw - 0.6, y: s + 3.6 },
          { x: 12 + dx + k.sw + 1.6, y: s - 3.4 },
        ];
    p.hold = left ? 1 : 0;
    p.face = 'content';
    p.sway = dx * 0.7;
    p.flap = i / 8;
    return p;
  }
  if (anim === 'sit') {
    const bob = [0, 0, 1, 1][i];
    const p = standing(k, 'down', bob);
    p.sit = true;
    const s = shY(k, bob, 0, true);
    p.feet = [
      { x: 9.6, y: 31 },
      { x: 14.4, y: 31 },
    ];
    p.hands = [
      { x: 12 - k.sw + 0.4, y: s + 5.6 },
      { x: 12 + k.sw - 0.4, y: s + 5.6 },
    ];
    p.blink = i === 3;
    return p;
  }
  // heart: hands meeting at the chest, eyes closed happily.
  const bob = [0, 0, 1, 1, 0, 0][i];
  const p = standing(k, 'down', bob);
  const s = shY(k, bob);
  p.hands = [
    { x: 10.9, y: s + 3.4 },
    { x: 13.1, y: s + 3.4 },
  ];
  p.carry = false;
  p.face = 'content';
  return p;
}

// ---------------------------------------------------------------- what's worn

type Sleeve = 'none' | 'short' | 'long' | 'wide' | 'puff' | 'puffy';

const TOP_SLEEVE: Record<string, Sleeve> = {
  tee: 'short',
  stripes: 'short',
  longsleeve: 'long',
  hoodie: 'long',
  sweater: 'long',
  cardigan: 'long',
  overshirt: 'long',
  tank: 'none',
  blouse: 'puff',
  sailor: 'short',
  turtleneck: 'long',
  kimono: 'wide',
  tunic: 'long',
  puffer: 'puffy',
  vest: 'long',
};

const DRESS_SLEEVE: Record<string, Sleeve | 'top'> = {
  sundress: 'none',
  gown: 'puff',
  pinafore: 'top',
  robe: 'wide',
  yukata: 'wide',
  smock: 'short',
  apron: 'puff',
  knitdress: 'long',
  starrobe: 'wide',
};

/** How far down a dress's skirt reaches: its hem row (above the soles). */
const DRESS_HEM: Record<string, number> = { sundress: 27.5, gown: 30.4, pinafore: 27.5, robe: 30, yukata: 29.6, smock: 27, apron: 28, knitdress: 27.4, starrobe: 30.2 };
const DRESS_FLARE: Record<string, number> = { sundress: 2.2, gown: 3.2, pinafore: 1.8, robe: 1.6, yukata: 0.6, smock: 2.4, apron: 2, knitdress: 0.8, starrobe: 2.4 };

export interface Wear {
  top: string;
  bottom: string;
  dress: string;
  sleeve: Sleeve;
  sleeveMat: Material;
  torso: Material;
  /** How far the top hangs below the hips. */
  hang: number;
}

export function wearOf(k: Kit): Wear {
  const top = id(TOPS, k.a.top);
  const bottom = id(BOTTOMS, k.a.bottom);
  const dress = id(DRESSES, k.a.dress);
  if (dress !== 'none') {
    const ds = DRESS_SLEEVE[dress];
    return { top, bottom, dress, sleeve: ds === 'top' ? TOP_SLEEVE[top] : ds, sleeveMat: ds === 'top' ? (top === 'vest' ? k.trim : k.top) : k.dress, torso: k.dress, hang: 0 };
  }
  const hang = top === 'tunic' ? 3 : top === 'hoodie' || top === 'sweater' || top === 'puffer' ? 1.5 : top === 'cardigan' || top === 'kimono' ? 2 : 0.5;
  return { top, bottom, dress, sleeve: TOP_SLEEVE[top] ?? 'short', sleeveMat: top === 'vest' ? k.trim : k.top, torso: k.top, hang };
}

// ---------------------------------------------------------------- legs and shoes

/** Where along the leg the bottoms reach, 0 hip .. 1 ankle, and how puffy (radius). */
function legCover(w: Wear): { to: number; r: number } | null {
  if (w.dress !== 'none') return null;
  switch (w.bottom) {
    case 'trousers':
    case 'cargo':
    case 'overalls':
      return { to: 1, r: 1.6 };
    case 'rolled':
      return { to: 0.82, r: 1.6 };
    case 'leggings':
      return { to: 1, r: 1.45 };
    case 'shorts':
      return { to: 0.42, r: 1.75 };
    case 'bloomers':
      return { to: 0.92, r: 2 };
    default:
      return null;
  }
}

function legs(c: PixelCanvas, k: Kit, g: Geo, w: Wear): void {
  const side = g.view === 'side';
  const cover = legCover(w);
  const order = side ? [1, 0] : [0, 1];
  for (const i of order) {
    const f = g.feet[i];
    const hipX = side ? g.cx + 0.3 + (i ? 0.6 : -0.2) : g.cx + (i ? 1.65 : -1.65);
    const hipY = g.hip;
    const ax = f.x;
    const ay = f.y - 1.6;
    const far = side && i === 1 ? -1 : 0;
    c.part();
    c.capsule(hipX, hipY, ax, ay, 1.4, 1.25, k.skin, { bias: far });
    if (cover) {
      const ex = hipX + (ax - hipX) * cover.to;
      const ey = hipY + (ay - hipY) * cover.to;
      c.capsule(hipX, hipY - 0.5, ex, ey, cover.r, w.bottom === 'bloomers' ? cover.r - 0.4 : cover.r - 0.1, k.bottom, { bias: far });
      if (w.bottom === 'rolled' || w.bottom === 'shorts') {
        // A turned-up cuff, lighter where the cloth folds over.
        for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) <= cover.r) c.px(Math.round(ex + dx - 0.5), Math.round(ey), k.bottom, FLAT, { bias: 1 + far });
      }
      if (w.bottom === 'bloomers') for (let dx = -1; dx <= 1; dx++) c.px(Math.round(ex + dx - 0.5), Math.round(ey + 0.5), k.bottom, FLAT, { bias: -2 + far });
      if (w.bottom === 'cargo') {
        const px = Math.round(hipX + (ax - hipX) * 0.45 + (side ? 0 : i ? 0.6 : -1.4));
        const py = Math.round(hipY + (ay - hipY) * 0.45);
        for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) c.px(px + x, py + y, k.bottom, FLAT, { bias: (y === 0 ? 0 : -1) + far });
      }
    }
    shoe(c, k, f, side, far);
  }
}

function shoe(c: PixelCanvas, k: Kit, f: P, side: boolean, far: number): void {
  const kind = id(SHOES, k.a.shoes);
  const x = side ? f.x - 0.7 : f.x;
  const y = f.y - 0.75;
  const rx = side ? 2.2 : 1.75;
  c.part();
  if (kind === 'bare') {
    c.ellipse(x, y, rx - 0.3, 1.1, k.skin, { bias: far });
    return;
  }
  if (kind === 'sandals') {
    c.ellipse(x, y, rx - 0.2, 1.1, k.skin, { bias: far });
    c.ellipse(x, f.y - 0.1, rx, 0.6, k.leather, { bias: far - 1 });
    for (let dx = -1; dx <= 1; dx++) c.px(Math.round(x + dx - 0.5), Math.round(y - 0.5), k.shoes, FLAT, { bias: far });
    return;
  }
  const m = kind === 'slippers' ? k.shoes : k.shoes;
  if (kind === 'boots' || kind === 'rainboots') {
    const top = kind === 'rainboots' ? 3.6 : 2.6;
    c.capsule(f.x, f.y - top, f.x, f.y - 1, 1.55, 1.6, m, { bias: far });
    if (kind === 'boots') for (let dx = -1; dx <= 1; dx++) c.px(Math.round(f.x + dx - 0.5), Math.round(f.y - top), m, FLAT, { bias: 1 + far });
  }
  const r2 = kind === 'clogs' ? rx + 0.3 : kind === 'slippers' ? rx + 0.25 : rx;
  c.ellipse(x, y, r2, kind === 'clogs' ? 1.35 : 1.2, m, { bias: far + (kind === 'slippers' ? 1 : 0) });
  // Soles, laces and straps.
  if (kind === 'sneakers') for (let dx = -2; dx <= 1; dx++) c.px(Math.round(x + dx), Math.round(f.y - 0.2), k.linen, FLAT, { bias: far });
  else if (kind !== 'slippers') for (let dx = -2; dx <= 1; dx++) if (c.materialAt(Math.round(x + dx), Math.round(f.y - 0.2)) === m) c.px(Math.round(x + dx), Math.round(f.y - 0.2), k.sole, FLAT, { bias: far });
  if (kind === 'maryjanes') for (let dx = -1; dx <= 0; dx++) c.px(Math.round(x + dx), Math.round(y - 1), m, FLAT, { bias: -1 + far });
}

// ---------------------------------------------------------------- torso

function torsoEdges(k: Kit, g: Geo, extra = 0, flare = 0, bottomAt?: number): (y: number) => [number, number] | null {
  const top = g.sh;
  const bot = bottomAt ?? g.hip + 1;
  const side = g.view === 'side';
  return (y) => {
    if (y < top || y > bot) return null;
    const u = (y - top) / Math.max(1, g.hip + 1 - top);
    let half = u < 0.18 ? k.sw - 1.1 * (1 - u / 0.18) : u < 0.62 ? k.sw + (k.ww - k.sw) * ((u - 0.18) / 0.44) : k.ww + (k.hw - k.ww) * Math.min(1, (u - 0.62) / 0.38);
    if (y > g.hip + 1) half = k.hw + flare * ((y - g.hip - 1) / Math.max(1, bot - g.hip - 1));
    half += extra;
    if (side) {
      const d = (half / k.sw) * k.dep;
      return [g.cx - d + 0.2, g.cx + d + 0.6];
    }
    return [g.cx - half, g.cx + half];
  };
}

function torso(c: PixelCanvas, k: Kit, g: Geo, w: Wear): void {
  const puff = w.top === 'puffer' && w.dress === 'none' ? 0.6 : 0;
  const bottom = g.hip + 1 + w.hang;
  c.part();
  rows(c, g.sh, bottom, torsoEdges(k, g, puff, w.hang > 1.5 ? 0.6 : 0.2, bottom), w.torso, (_x, _y, t, u) => cyl(t, 0.25 - u * 0.3));
  if (w.dress === 'none') topDetails(c, k, g, w, bottom);
  else dressBodice(c, k, g, w);
}

const ox = BX;
const oy = BY;

function topDetails(c: PixelCanvas, k: Kit, g: Geo, w: Wear, bottom: number): void {
  const cx = Math.round(g.cx);
  const v = g.view;
  const T = k.top;
  const sh = Math.round(g.sh);
  const front = v === 'down';
  const side = v === 'side';
  const box: [number, number, number, number] = [cx - 7, sh - 1, cx + 7, Math.ceil(bottom) + 1];
  switch (w.top) {
    case 'stripes':
      recolor(c, ox, oy, ...box, T, k.trim, (_x, y) => (y - sh) % 2 === 1);
      break;
    case 'sweater': {
      // A fair-isle band across the chest, and a ribbed hem.
      const band = sh + 2;
      recolor(c, ox, oy, ...box, T, k.trim, (x, y) => y === band || (y === band + 1 && (x + y) % 2 === 0));
      for (let x = cx - 6; x <= cx + 6; x++) if (c.materialAt(x, Math.ceil(bottom)) === T) c.shade(x, Math.ceil(bottom), -1);
      break;
    }
    case 'hoodie':
      if (front) {
        // The pocket, and the strings hanging from the hood.
        for (let x = cx - 2; x <= cx + 1; x++) for (let y = Math.ceil(bottom) - 2; y <= Math.ceil(bottom) - 1; y++) c.shade(x, y, y === Math.ceil(bottom) - 2 ? -1 : 0);
        c.px(cx - 2, sh + 1, k.linen, FLAT);
        c.px(cx - 2, sh + 2, k.linen, FLAT);
        c.px(cx + 1, sh + 1, k.linen, FLAT);
        c.px(cx + 1, sh + 2, k.linen, FLAT);
      }
      break;
    case 'cardigan':
      if (front) {
        recolor(c, ox, oy, ...box, T, k.trim, (x, y) => (x === cx - 1 || x === cx) && y >= sh);
        for (let y = sh + 2; y <= bottom; y += 2) c.px(cx + 1, y, k.gold, FLAT);
      }
      break;
    case 'overshirt':
      if (front) {
        recolor(c, ox, oy, ...box, T, k.trim, (x, y) => y >= sh && x >= cx - 1 && x <= cx && y < bottom);
        c.px(cx - 2, sh, T, FLAT, { bias: 1 });
        c.px(cx + 1, sh, T, FLAT, { bias: 1 });
      }
      break;
    case 'vest':
      if (front) {
        recolor(c, ox, oy, ...box, T, k.trim, (x, y) => y >= sh && y < sh + 4 - Math.abs(x + 0.5 - g.cx) && Math.abs(x + 0.5 - g.cx) < 2);
        for (let y = sh + 3; y <= bottom - 1; y += 2) c.px(cx, y, k.gold, FLAT);
      } else if (side) recolor(c, ox, oy, ...box, T, k.trim, (x, y) => y < sh + 2 && x < g.cx);
      break;
    case 'tank': {
      // Bare shoulders: only the straps stay, a little in from the shoulder's edge.
      const strap = (x: number) => {
        const d = Math.abs(x + 0.5 - g.cx);
        return d > 1.6 && d < 3;
      };
      recolor(c, ox, oy, ...box, T, k.skin, (x, y) => y <= sh + 1 && (side ? x < g.cx - 0.2 || x > g.cx + 1.2 : !strap(x)));
      break;
    }
    case 'blouse':
      if (front) {
        c.px(cx - 2, sh, k.linen, FLAT);
        c.px(cx - 1, sh + 1, k.linen, FLAT);
        c.px(cx, sh + 1, k.linen, FLAT);
        c.px(cx + 1, sh, k.linen, FLAT);
      }
      break;
    case 'sailor':
      // The broad collar over the shoulders, and its knot.
      recolor(c, ox, oy, ...box, T, k.trim, (x, y) => (front || side ? y <= sh + 1 && Math.abs(x + 0.5 - g.cx) > 1 : y <= sh + 3));
      if (front) {
        c.px(cx - 1, sh + 2, k.trim, FLAT, { bias: 1 });
        c.px(cx, sh + 2, k.trim, FLAT, { bias: 1 });
        c.px(cx - 1, sh + 3, k.trim, FLAT, { bias: -1 });
        c.px(cx, sh + 3, k.trim, FLAT, { bias: -1 });
      }
      break;
    case 'turtleneck':
      for (let x = cx - 2; x <= cx + 1; x++) c.px(x, sh - 1, T, cyl((x + 0.5 - g.cx) / 2.2), { bias: 0 });
      break;
    case 'kimono':
      if (front) {
        // Crossed lapels in the trim colour, the right over the left.
        recolor(c, ox, oy, ...box, T, k.trim, (x, y) => y >= sh && y <= sh + 5 && Math.abs(x + 0.5 - (g.cx - 2 + (y - sh) * 0.45)) < 0.8);
        recolor(c, ox, oy, ...box, T, k.trim, (x, y) => y >= sh && y <= sh + 3 && Math.abs(x + 0.5 - (g.cx + 2 - (y - sh) * 0.5)) < 0.8);
      }
      break;
    case 'tunic': {
      const by = Math.round(g.hip);
      for (let x = cx - 6; x <= cx + 6; x++) if (c.materialAt(x, by) === T) c.px(x, by, k.leather, { x: 0, y: 0.2, z: 1 });
      if (front || side) c.px(side ? cx - 2 : cx, by, k.gold, FLAT);
      break;
    }
    case 'puffer':
      for (let y = sh + 2; y < bottom; y += 2) for (let x = cx - 7; x <= cx + 7; x++) if (c.materialAt(x, y) === T) c.shade(x, y, -1);
      if (front) for (let y = sh; y < bottom; y++) if (c.materialAt(cx, y) === T) c.px(cx, y, T, FLAT, { bias: -1 });
      break;
    case 'tee':
    case 'longsleeve':
    default:
      break;
  }
  // A neckline: a little skin at the throat, front on (not under a turtleneck or a hood).
  if (front && w.top !== 'turtleneck' && w.top !== 'hoodie' && w.top !== 'sailor') {
    c.px(cx - 1, sh, k.skin, FLAT, { bias: -1 });
    c.px(cx, sh, k.skin, FLAT, { bias: -1 });
  }
}

function dressBodice(c: PixelCanvas, k: Kit, g: Geo, w: Wear): void {
  const cx = Math.round(g.cx);
  const sh = Math.round(g.sh);
  const front = g.view === 'down';
  const D = k.dress;
  const box: [number, number, number, number] = [cx - 7, sh - 1, cx + 7, Math.round(g.hip) + 2];
  switch (w.dress) {
    case 'sundress':
      recolor(c, ox, oy, ...box, D, k.skin, (x, y) => y <= sh + 1 && !(Math.abs(x + 0.5 - g.cx) > 1.6 && Math.abs(x + 0.5 - g.cx) < 2.8));
      break;
    case 'pinafore':
      // The blouse under it shows at the shoulders.
      recolor(c, ox, oy, ...box, D, w.sleeveMat, (x, y) => y <= sh + 2 && Math.abs(x + 0.5 - g.cx) > 2.4);
      break;
    case 'apron':
      if (front) recolor(c, ox, oy, ...box, D, k.linen, (x, y) => y >= sh + 2 && Math.abs(x + 0.5 - g.cx) < 2.2);
      break;
    case 'yukata':
    case 'robe':
      if (front) recolor(c, ox, oy, ...box, D, k.trim, (x, y) => y >= sh && y <= sh + 4 && Math.abs(x + 0.5 - (g.cx - 1.6 + (y - sh) * 0.4)) < 0.8);
      break;
    case 'knitdress':
      for (let x = cx - 2; x <= cx + 1; x++) c.px(x, sh - 1, D, cyl((x + 0.5 - g.cx) / 2.2));
      break;
    case 'smock':
      if (front) {
        c.px(cx - 2, sh, k.linen, FLAT);
        c.px(cx - 1, sh + 1, k.linen, FLAT);
        c.px(cx, sh + 1, k.linen, FLAT);
        c.px(cx + 1, sh, k.linen, FLAT);
      }
      break;
    default:
      break;
  }
  if (front && w.dress !== 'knitdress' && w.dress !== 'sundress') {
    c.px(cx - 1, sh, k.skin, FLAT, { bias: -1 });
    c.px(cx, sh, k.skin, FLAT, { bias: -1 });
  }
}

/** A skirt (or a dress's skirt) from the waist down to `hem`, flaring by `flare`. */
function skirt(c: PixelCanvas, k: Kit, g: Geo, m: Material, hem: number, flare: number, kind: 'plain' | 'pleat' | 'tier' | 'stars' = 'plain'): void {
  const top = g.hip - 1.5;
  const side = g.view === 'side';
  const sway = g.pose.sway * 0.9;
  c.part();
  rows(
    c,
    top,
    hem,
    (y) => {
      const u = (y - top) / Math.max(1, hem - top);
      const half = k.hw + 0.3 + flare * Math.pow(u, 0.8);
      const s = sway * u;
      if (side) {
        const d = (half / k.sw) * k.dep;
        return [g.cx - d - flare * 0.4 * u + s, g.cx + d + 0.8 + flare * 0.5 * u + s];
      }
      return [g.cx - half + s, g.cx + half + s];
    },
    m,
    (_x, _y, t, u) => cyl(t, 0.35 - u * 0.5),
    (x, y, _t, u) => {
      if (y >= Math.floor(hem)) return -1;
      if (kind === 'pleat') return (x + Math.round(u * 2)) % 2 === 0 ? -1 : 0;
      if (kind === 'tier') return Math.abs(y - (top + (hem - top) * 0.55)) < 0.5 ? -1 : 0;
      return 0;
    },
  );
  if (kind === 'stars') starDust(c, g, top, hem);
}

function starDust(c: PixelCanvas, g: Geo, top: number, bottom: number): void {
  for (let y = Math.ceil(top); y < bottom; y++) {
    for (let x = Math.round(g.cx) - 8; x <= Math.round(g.cx) + 8; x++) {
      if (!c.filled(x, y) || hsh(x, y, 7) > 0.09) continue;
      c.spark(x, y, [255, 240, 190], 0.9);
    }
  }
}

function bottoms(c: PixelCanvas, k: Kit, g: Geo, w: Wear): void {
  if (w.dress !== 'none') {
    const hem = DRESS_HEM[w.dress] - (k.tall ? 0 : 0) + (g.pose.sit ? 0 : 0);
    const kind = w.dress === 'starrobe' ? 'stars' : w.dress === 'gown' ? 'tier' : 'plain';
    skirt(c, k, g, k.dress, g.pose.sit ? Math.min(31, g.hip + 4) : hem - g.pose.hop, DRESS_FLARE[w.dress], kind);
    const cx = Math.round(g.cx);
    if (w.dress === 'yukata' || w.dress === 'robe') {
      // The sash.
      const y = Math.round(g.hip) - 1;
      for (let x = cx - 6; x <= cx + 6; x++) for (let dy = 0; dy < (w.dress === 'yukata' ? 2 : 1); dy++) if (c.materialAt(x, y + dy) === k.dress) c.px(x, y + dy, k.trim, cyl((x + 0.5 - g.cx) / 5), { bias: dy });
    }
    if (w.dress === 'apron' && g.view === 'down') recolor(c, ox, oy, cx - 3, Math.round(g.hip) - 1, cx + 3, 31, k.dress, k.linen, (x) => Math.abs(x + 0.5 - g.cx) < 2.4);
    if (w.dress === 'pinafore') {
      const y = Math.round(g.hip) - 1;
      for (let x = cx - 6; x <= cx + 6; x++) if (c.materialAt(x, y) === k.dress) c.shade(x, y, -1);
    }
    return;
  }
  const hem = (to: number) => (g.pose.sit ? g.hip + 3 : to - g.pose.hop);
  switch (w.bottom) {
    case 'skirt':
      skirt(c, k, g, k.bottom, hem(27.2), 1.6);
      break;
    case 'longskirt':
      skirt(c, k, g, k.bottom, hem(30), 2.4, 'tier');
      break;
    case 'pleated':
      skirt(c, k, g, k.bottom, hem(27.4), 1.8, 'pleat');
      break;
    case 'overalls': {
      // The bib and its straps over the top.
      const cx = Math.round(g.cx);
      const sh = Math.round(g.sh);
      c.part();
      if (g.view === 'down' || g.view === 'up') {
        rows(c, sh + 2, g.hip + 1, (y) => [g.cx - (y < sh + 3 ? 2.2 : k.ww - 0.2), g.cx + (y < sh + 3 ? 2.2 : k.ww - 0.2)], k.bottom, (_x, _y, t) => cyl(t, 0.1));
        for (let y = sh; y < sh + 2; y++) {
          c.px(cx - 3, y, k.bottom, FLAT, { bias: -1 });
          c.px(cx + 2, y, k.bottom, FLAT, { bias: -1 });
        }
        if (g.view === 'down') {
          c.px(cx - 2, sh + 2, k.gold, FLAT);
          c.px(cx + 1, sh + 2, k.gold, FLAT);
        }
      } else {
        rows(c, sh + 2, g.hip + 1, () => [g.cx - k.dep + 0.2, g.cx + k.dep * 0.4], k.bottom, (_x, _y, t) => cyl(t));
        for (let y = sh; y < sh + 2; y++) c.px(cx, y, k.bottom, FLAT, { bias: -1 });
      }
      break;
    }
    default: {
      // Trousers and the like: a waistband just showing under the top.
      break;
    }
  }
}

// ---------------------------------------------------------------- arms

function arm(c: PixelCanvas, k: Kit, g: Geo, w: Wear, i: 0 | 1, far = false): void {
  const s = g.shoulders[i];
  const h = g.hands[i];
  const bias = far ? -1 : 0;
  const sm = w.sleeveMat;
  c.part();
  c.capsule(s.x, s.y, h.x, h.y, 1.3, 1.15, k.skin, { bias });
  const along = (t: number): P => ({ x: s.x + (h.x - s.x) * t, y: s.y + (h.y - s.y) * t });
  switch (w.sleeve) {
    case 'short': {
      const e = along(0.42);
      c.capsule(s.x, s.y - 0.3, e.x, e.y, 1.6, 1.55, sm, { bias });
      break;
    }
    case 'puff': {
      c.ellipse(s.x, s.y + 0.4, 1.9, 1.8, sm, { bias });
      break;
    }
    case 'long': {
      const e = along(0.86);
      c.capsule(s.x, s.y - 0.3, e.x, e.y, 1.55, 1.4, sm, { bias });
      c.px(Math.round(e.x - 0.5), Math.round(e.y), sm, FLAT, { bias: bias - 1 });
      break;
    }
    case 'puffy': {
      const e = along(0.88);
      c.capsule(s.x, s.y - 0.3, e.x, e.y, 2, 1.7, sm, { bias });
      const m = along(0.45);
      c.shade(Math.round(m.x - 0.5), Math.round(m.y), -1);
      break;
    }
    case 'wide': {
      const e = along(0.8);
      c.capsule(s.x, s.y - 0.3, e.x, e.y, 1.6, 1.6, sm, { bias });
      // The bell of the sleeve hangs below the arm, swinging with it.
      const hang = 2.2;
      const sx = g.view === 'side' ? 0.6 : i ? 0.4 : -0.4;
      rows(c, e.y - 1.5, e.y + hang, (y) => {
        const u = (y - (e.y - 1.5)) / (hang + 1.5);
        const half = 1.5 + u * 0.9;
        const x = e.x + sx * u * 2;
        return [x - half, x + half];
      }, sm, (_x, _y, t) => cyl(t, 0.1), (_x, y) => (y >= Math.floor(e.y + hang) ? -1 + bias : bias));
      break;
    }
    case 'none':
    default:
      break;
  }
  c.part();
  c.ellipse(h.x, h.y, 1.2, 1.15, k.skin, { bias });
}

// ---------------------------------------------------------------- head and face

function head(c: PixelCanvas, k: Kit, g: Geo): void {
  const side = g.view === 'side';
  const rx = side ? 5.05 : 5.5;
  c.part();
  // Ears first, so the head sits over them.
  if (side) c.ellipse(g.hx + 1.4, g.hy + 1.1, 1.1, 1.35, k.skin);
  else {
    c.ellipse(g.hx - 5.3, g.hy + 0.9, 1, 1.3, k.skin, { bias: -1 });
    c.ellipse(g.hx + 5.3, g.hy + 0.9, 1, 1.3, k.skin, { bias: -1 });
  }
  c.ellipse(g.hx, g.hy, rx, 5.2, k.skin, { flatten: 1.1 });
  if (side) {
    // The nose, and the chin's curve toward the front.
    c.px(Math.round(g.hx - rx - 0.4), Math.round(g.hy + 1.4), k.skin, sphere(-0.9, 0, 1));
  }
  if (g.view !== 'up') face(c, k, g);
}

type Pattern = string[];

/** The eyes' top row: a row above the head's middle, so the face sits clear of the chin. */
export const eyeRow = (g: Geo): number => Math.round(g.hy) - 1;

const EYE_PATTERNS: Record<string, Pattern> = {
  round: ['kw', 'kk'],
  bright: ['kw', 'id'],
  gentle: ['kk', 'id'],
  content: ['.k.', 'k.k'],
  wide: ['kk', 'wi'],
  cat: ['.k', 'ki'],
  dot: ['k', 'k'],
  starry: ['iw', 'wd'],
};

const MOUTH_PATTERNS: Record<string, Pattern> = {
  smile: ['m.m', '.m.'],
  grin: ['mmm', '.r.'],
  calm: ['mm'],
  open: ['m', 'r'],
  cat: ['m.m.m', '.m.m.'],
  smirk: ['..m', 'mm.'],
  blep: ['mm', '.r'],
};

function paint(c: PixelCanvas, k: Kit, pat: Pattern, x0: number, y0: number, mirror = false): void {
  pat.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const ch = mirror ? row[row.length - 1 - dx] : row[dx];
      const m = ch === 'k' ? k.lash : ch === 'i' ? k.iris : ch === 'd' ? k.irisDeep : ch === 'w' ? k.white : ch === 'm' ? k.mouth : ch === 'r' ? k.tongue : null;
      if (m) c.px(x0 + dx, y0 + dy, m, FLAT);
    }
  });
}

function face(c: PixelCanvas, k: Kit, g: Geo): void {
  const p = g.pose;
  const side = g.view === 'side';
  const hx = Math.round(g.hx);
  const ey = eyeRow(g);
  const style = p.face === 'content' ? 'content' : id(EYES, k.a.eyes);
  let pat = EYE_PATTERNS[style];
  if (p.blink && style !== 'content') pat = ['', pat[0].replace(/[^.]/g, 'k')];
  const mStyle = p.face === 'grin' ? 'grin' : p.face === 'open' ? 'open' : id(MOUTHS, k.a.mouth);
  const mouth = MOUTH_PATTERNS[mStyle];
  const cheeks = k.a.cheeks;
  if (side) {
    const ex = hx - 3;
    const one = pat.map((r) => (r.length === 3 ? r.slice(0, 2) : r));
    paint(c, k, one, ex - (one[0]?.length === 1 ? -1 : 0), ey);
    const mx = hx - 4;
    const my = ey + 3;
    c.px(mx, my, k.mouth, FLAT);
    if (mStyle === 'grin' || mStyle === 'blep' || mStyle === 'open') c.px(mx, my + 1, k.tongue, FLAT);
    if (cheeks === 1 || cheeks === 3) c.px(hx - 1, ey + 2, k.blush, FLAT);
    if (cheeks >= 2) {
      c.shade(hx - 2, ey + 3, -1);
      c.shade(hx, ey + 2, -1);
    }
    brows(c, k, g, [ex], true);
    beard(c, k, g);
    return;
  }
  // Eyes: two wide at 9-10 and 14-15 (for a head centred on 12); wider and narrower ones keep the same middle.
  const w = pat[0]?.length || pat[1]?.length || 2;
  const lx = w === 3 ? hx - 4 : w === 1 ? hx - 2 : hx - 3;
  const rx = w === 3 ? hx + 2 : w === 1 ? hx + 2 : hx + 2;
  paint(c, k, pat, lx, ey);
  paint(c, k, pat, rx, ey, style === 'cat');
  const mw = mouth[0].length;
  paint(c, k, mouth, hx - Math.floor(mw / 2), ey + 3);
  if (cheeks === 1 || cheeks === 3 || p.face === 'content') {
    c.px(hx - 4, ey + 2, k.blush, FLAT);
    c.px(hx + 3, ey + 2, k.blush, FLAT);
    if (p.face === 'content') {
      c.px(hx - 5, ey + 2, k.blush, FLAT);
      c.px(hx + 4, ey + 2, k.blush, FLAT);
    }
  }
  if (cheeks >= 2) {
    for (const [dx, dy] of [
      [-4, 3],
      [-3, 2],
      [3, 3],
      [2, 2],
    ])
      if (c.materialAt(hx + dx, ey + dy) === k.skin) c.shade(hx + dx, ey + dy, -1);
  }
  brows(c, k, g, [lx + (w === 3 ? 1 : w === 1 ? -1 : 0), rx + (w === 1 ? 0 : 0)], false);
  beard(c, k, g);
}

function brows(c: PixelCanvas, k: Kit, g: Geo, at: number[], side: boolean): void {
  const kind = id(BROWS, k.a.brows);
  if (kind === 'none') return;
  const y = eyeRow(g) - 2;
  at.forEach((x, i) => {
    const inner = side ? 0 : i === 0 ? 1 : 0;
    const outer = 1 - inner;
    const put = (dx: number, dy: number) => c.px(x + dx, y + dy, k.brow, FLAT);
    if (kind === 'soft') {
      put(0, 0);
      put(1, 0);
    } else if (kind === 'bold') {
      put(0, 0);
      put(1, 0);
      put(side ? -1 : i === 0 ? -1 : 2, 0);
    } else if (kind === 'arched') {
      put(outer, 0);
      put(inner, 0);
      put(outer === 0 ? -1 : 2, 1);
    } else if (kind === 'worried') {
      put(inner, -1);
      put(outer, 0);
    }
  });
}

function beard(c: PixelCanvas, k: Kit, g: Geo): void {
  const kind = id(BEARDS, k.a.beard);
  if (kind === 'none') return;
  const hx = Math.round(g.hx);
  const ey = eyeRow(g);
  const side = g.view === 'side';
  const H = k.hair;
  if (kind === 'stubble') {
    for (let y = ey + 2; y <= ey + 5; y++)
      for (let x = hx - 5; x <= hx + 5; x++) {
        if (c.materialAt(x, y) !== k.skin) continue;
        const dx = (x + 0.5 - g.hx) / 5.5;
        const dy = (y + 0.5 - g.hy) / 5.2;
        if (dx * dx + dy * dy > 0.55 && (x + y) % 2 === 0) c.px(x, y, H, FLAT, { bias: -1 });
      }
    return;
  }
  if (kind === 'moustache') {
    const y = ey + 2;
    if (side) {
      c.px(hx - 4, y + 0.5, H, FLAT);
      c.px(hx - 3, y + 0.5, H, FLAT);
    } else for (const dx of [-2, -1, 1, 2]) c.px(hx + dx, y + (Math.abs(dx) === 2 ? 1 : 0), H, FLAT, { bias: Math.abs(dx) === 2 ? -1 : 0 });
    c.px(hx, y, H, FLAT, { bias: 1 });
    return;
  }
  if (kind === 'goatee') {
    const y = ey + 4;
    if (side) {
      c.px(hx - 4, y, H, FLAT);
      c.px(hx - 3, y + 1, H, FLAT);
    } else {
      for (const dx of [-1, 0, 1]) c.px(hx + dx, y, H, sphere(dx / 2, 0.3));
      c.px(hx, y + 1, H, FLAT, { bias: -1 });
    }
    return;
  }
  // A full beard: the jaw from ear to ear, round the mouth.
  for (let y = ey + 1; y <= ey + 6; y++)
    for (let x = hx - 6; x <= hx + 6; x++) {
      const dx = (x + 0.5 - g.hx) / 5.7;
      const dy = (y + 0.5 - g.hy) / 5.6;
      const r = dx * dx + dy * dy;
      if (r > 1) continue;
      if (side ? x > hx + 1 : false) continue;
      const mouthHole = !side && y === ey + 3 && Math.abs(x - hx) <= 1;
      if (mouthHole) continue;
      if (y <= ey + 2 && Math.abs(dx) < 0.62 && !side) continue;
      c.px(x, y, H, sphere(dx, dy * 0.6 + 0.3, 1), { bias: hsh(x, y) < 0.25 ? -1 : 0 });
    }
}

// ---------------------------------------------------------------- the whole figure

export interface Layers {
  /** Things worn on the back and carried, drawn by gear.ts, at their moment in the order. */
  behind(c: PixelCanvas, k: Kit, g: Geo): void;
  backHair(c: PixelCanvas, k: Kit, g: Geo): void;
  neck(c: PixelCanvas, k: Kit, g: Geo): void;
  hairFront(c: PixelCanvas, k: Kit, g: Geo): void;
  hat(c: PixelCanvas, k: Kit, g: Geo): void;
  face(c: PixelCanvas, k: Kit, g: Geo): void;
  held(c: PixelCanvas, k: Kit, g: Geo): void;
  over(c: PixelCanvas, k: Kit, g: Geo): void;
}

export function drawFigure(c: PixelCanvas, k: Kit, g: Geo, L: Layers): void {
  const w = wearOf(k);
  c.offset(BX, BY);
  if (g.view === 'down') {
    L.behind(c, k, g);
    L.backHair(c, k, g);
    legs(c, k, g, w);
    torso(c, k, g, w);
    bottoms(c, k, g, w);
    arm(c, k, g, w, 0);
    arm(c, k, g, w, 1);
    L.neck(c, k, g);
    head(c, k, g);
    L.hairFront(c, k, g);
    L.hat(c, k, g);
    L.face(c, k, g);
    L.held(c, k, g);
    L.over(c, k, g);
  } else if (g.view === 'up') {
    L.held(c, k, g);
    legs(c, k, g, w);
    torso(c, k, g, w);
    bottoms(c, k, g, w);
    arm(c, k, g, w, 0);
    arm(c, k, g, w, 1);
    L.neck(c, k, g);
    head(c, k, g);
    L.backHair(c, k, g);
    L.hairFront(c, k, g);
    L.hat(c, k, g);
    L.behind(c, k, g);
    L.over(c, k, g);
  } else {
    L.behind(c, k, g);
    arm(c, k, g, w, 1, true);
    L.backHair(c, k, g);
    legs(c, k, g, w);
    torso(c, k, g, w);
    bottoms(c, k, g, w);
    L.neck(c, k, g);
    head(c, k, g);
    L.hairFront(c, k, g);
    L.hat(c, k, g);
    L.face(c, k, g);
    arm(c, k, g, w, 0);
    L.held(c, k, g);
    L.over(c, k, g);
  }
  c.offset(0, 0);
}
