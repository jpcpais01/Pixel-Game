// The Poltergeist: a round, mischievous sheet-ghost floating over the
// ground, big black eyes and a toothy grin, stubby sheet arms, its hem
// rippling and a little tail curling under it. Its Tea Party skin is a
// Victorian ghost girl on the same float: a porcelain face in a lavender
// bonnet tied with a pink bow, pale ringlets, a bodice with puffed sleeves,
// a lace-frilled skirt fading into mist and a parasol over her shoulder.
//
// Also here: the haunted things it throws (a chair, a book, a candlestick, a
// pot, a trunk for the big throw; for the tea party a cup, a saucer, a jug of
// milk and the teapot), and the icons.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const POLTER_W = 36;
export const POLTER_H = 42;
const CX = 18;
const GROUND = 40;
export const POLTER_ORIGIN_X = CX;
export const POLTER_ORIGIN_Y = GROUND;
/** The body's middle above the ground, where throws start. */
export const POLTER_CHEST_Y = 18;

// ---------------------------------------------------------------------------
// Materials

const SHEET: Material = { ramp: ramp('#4a7a86', '#86bcc2', '#c4ece6', '#eefff8', '#ffffff'), outline: hex('#12303a'), outlineLit: hex('#1e4450'), emissive: 0.3, noAO: true };
const MIST: Material = { ramp: ramp('#5a8a96', '#9ad0d4', '#d8fff4'), outline: hex('#2a5a66'), emissive: 0.6, noAO: true, noOutline: true };
const VOID: Material = { ramp: ramp('#05060a', '#0e1018', '#1c2030'), outline: hex('#020204'), shine: true, noAO: true };
const TOOTH: Material = { ramp: ramp('#b8c4c0', '#ffffff'), outline: hex('#05060a'), noAO: true };
const PATCH: Material = { ramp: ramp('#5a6070', '#8a92a4', '#b4bccc'), outline: hex('#20242e') };
const STITCH: Material = { ramp: ramp('#2a2e3a', '#3a3e4a'), outline: hex('#101218'), noOutline: true };
const BLUSH: Material = { ramp: ramp('#e07a9a', '#ffa8c0'), outline: hex('#401420'), noOutline: true, noAO: true };

// The tea party.
const PORCELAIN: Material = { ramp: ramp('#8a8aa0', '#c4c4d8', '#ececf8', '#ffffff'), outline: hex('#2a2a3e'), shine: true, emissive: 0.15 };
const LAVENDER: Material = { ramp: ramp('#3a2a5e', '#6a54a0', '#9c86d4', '#c8b8f0', '#ece4ff'), outline: hex('#140c28'), outlineLit: hex('#221640'), emissive: 0.25 };
const LACE: Material = { ramp: ramp('#b4aacc', '#e4dcf4', '#ffffff'), outline: hex('#3a2e5a'), emissive: 0.3, noAO: true };
const RIBBON: Material = { ramp: ramp('#8a2a5a', '#d05a8e', '#ff9ac4'), outline: hex('#2a0818'), shine: true };
const RINGLET: Material = { ramp: ramp('#8a8058', '#c8bc8a', '#f0e8c0', '#fffbe8'), outline: hex('#2a2616'), emissive: 0.15 };
const DRESS_MIST: Material = { ramp: ramp('#6a5aa0', '#a896dc', '#e4dcff'), outline: hex('#3a2e5a'), emissive: 0.55, noAO: true, noOutline: true };
const PARASOL: Material = { ramp: ramp('#a8889c', '#dcc4d4', '#fff0f8', '#ffffff'), outline: hex('#3a2434'), emissive: 0.2 };
const STICK: Material = { ramp: ramp('#3a2a1a', '#6a4a2a', '#9a7040'), outline: hex('#140c04') };

export interface PolterLook {
  key: string;
  tea: boolean;
}

export const POLTER_LOOK: PolterLook = { key: 'polter', tea: false };
export const TEA_LOOK: PolterLook = { key: 'polter_tea', tea: true };
export const POLTER_LOOKS = [POLTER_LOOK, TEA_LOOK];

let L: PolterLook = POLTER_LOOK;

type View = 'down' | 'up' | 'side';

interface Pt {
  x: number;
  y: number;
}

export interface PolterPose {
  /** Floated up (+) or sunk. */
  bob: number;
  /** The hem's ripple, and the tail's sway. */
  wave: number;
  sway: number;
  /** Hands, relative to where they rest. */
  handA: Pt;
  handB: Pt;
  /** Leaning into its drift (side view), in px. */
  lean: number;
  /** 0..1: eyes wide and blazing (the Special), or squeezed shut in a grin (the throw). */
  glare: number;
  squint: boolean;
  /** Shaking (the rattle): the whole figure jitters this many px. */
  shake: number;
}

const base = (): PolterPose => ({ bob: 0, wave: 0, sway: 0, handA: { x: 0, y: 0 }, handB: { x: 0, y: 0 }, lean: 0, glare: 0, squint: false, shake: 0 });

// ---------------------------------------------------------------------------
// The sheet-ghost

/** The sheet: a dome over a body that flares a little, the hem rippling. */
function sheet(c: PixelCanvas, cx: number, top: number, bottom: number, hw: number, wave: number, view: View): void {
  const r = hw;
  const hem = (x: number) => bottom + 1.5 + Math.sin((x - cx) * 0.95 + wave * 1.6) * 1.4;
  for (let y = Math.floor(top); y <= bottom + 4; y++) {
    const dy = top + r - (y + 0.5);
    const w = dy > 0 ? Math.sqrt(Math.max(0, r * r - dy * dy)) : r + (y - top - r) * 0.08;
    const lean = view === 'side' ? Math.max(0, y - top - r) * 0.15 : 0;
    for (let x = Math.floor(cx - w + lean); x < cx + w + lean; x++) {
      if (y > hem(x)) continue;
      const t = (x + 0.5 - cx - lean) / w;
      const u = (y - top) / (bottom - top);
      c.px(x, y, SHEET, dy > 0 ? sphere(t, dy / r, 1) : cyl(t, 0.1 - u * 0.2));
    }
  }
}

/** The tail curling under the hem, down to a point. */
function tail(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, m: Material = MIST): void {
  c.capsule(x0, y0, (x0 + x1) / 2 + 1, (y0 + y1) / 2, 2.4, 1.6, m);
  c.capsule((x0 + x1) / 2 + 1, (y0 + y1) / 2, x1, y1, 1.6, 0.5, m);
}

function face(c: PixelCanvas, cx: number, cy: number, p: PolterPose, side: boolean): void {
  c.part();
  const eyes = side ? [cx - 3] : [cx - 3, cx + 3];
  for (const ex of eyes) {
    if (p.squint) {
      // Squeezed shut with glee: two little arches.
      c.px(Math.round(ex - 1), Math.round(cy), VOID);
      c.px(Math.round(ex), Math.round(cy - 1), VOID);
      c.px(Math.round(ex + 1), Math.round(cy), VOID);
      continue;
    }
    const ry = 2.7 + p.glare * 0.6;
    c.ellipse(ex, cy, side ? 1.4 : 1.9, ry, VOID);
    c.px(Math.round(ex - 0.6), Math.round(cy - 1), TOOTH, { x: -0.3, y: 0.5, z: 0.8 });
    if (p.glare > 0) for (let d = -1; d <= 1; d++) c.spark(ex + d * 0.5, cy + 0.5, [160, 255, 220], p.glare * 0.8);
  }
  // The grin, a tooth poking down.
  const my = cy + 4;
  const mx0 = side ? cx - 5 : cx - 3;
  const mx1 = side ? cx - 1 : cx + 3;
  for (let x = Math.round(mx0); x <= mx1; x++) {
    const k = (x + 0.5 - (mx0 + mx1) / 2) / ((mx1 - mx0) / 2 + 0.5);
    c.px(x, Math.round(my - k * k * 1.2 + (side ? 0 : 0)), VOID, { x: 0, y: 0, z: 1 });
  }
  c.px(Math.round((mx0 + mx1) / 2 + 1), Math.round(my + 1), TOOTH);
  if (!side) {
    c.px(Math.round(cx - 5), Math.round(cy + 3), BLUSH);
    c.px(Math.round(cx + 5), Math.round(cy + 3), BLUSH);
  }
}

function sheetArm(c: PixelCanvas, sx: number, sy: number, hand: Pt): void {
  c.capsule(sx, sy, hand.x, hand.y, 2, 1.7, SHEET);
}

function drawSheetGhost(c: PixelCanvas, p: PolterPose, view: View): void {
  const top = 9 - p.bob;
  const bottom = 27 - p.bob;
  const cx = CX + (view === 'side' ? -p.lean : 0);
  // The tail, under or behind the hem.
  c.part();
  if (view === 'side') tail(c, cx + 4, bottom, cx + 11, bottom - 3 + p.sway);
  else tail(c, cx, bottom + 1, cx + 3 + p.sway, bottom + 9);
  // The far arm, in the side view.
  if (view === 'side') {
    c.part();
    sheetArm(c, cx + 1, top + 12, { x: cx + 4 + p.handB.x, y: top + 15 + p.handB.y });
  }
  c.part();
  sheet(c, cx, top, bottom, view === 'side' ? 7.5 : 8.5, p.wave, view);
  if (view === 'down') face(c, cx, top + 8, p, false);
  else if (view === 'side') face(c, cx, top + 8, p, true);
  else {
    // A patch sewn on the back.
    c.part();
    for (let y = Math.round(top + 10); y <= top + 14; y++) for (let x = CX - 3; x <= CX + 1; x++) c.px(x, y, PATCH, { x: 0, y: 0.1, z: 1 });
    for (const [x, y] of [[CX - 3, top + 10], [CX + 1, top + 10], [CX - 3, top + 14], [CX + 1, top + 14], [CX - 1, top + 12]]) c.px(Math.round(x), Math.round(y), STITCH);
  }
  c.part();
  if (view === 'side') sheetArm(c, cx - 2, top + 12, { x: cx - 5 + p.handA.x, y: top + 16 + p.handA.y });
  else {
    sheetArm(c, cx - 7, top + 11, { x: cx - 10 + p.handA.x, y: top + 15 + p.handA.y });
    sheetArm(c, cx + 7, top + 11, { x: cx + 10 + p.handB.x, y: top + 15 + p.handB.y });
  }
}

// ---------------------------------------------------------------------------
// The tea party girl

function parasol(c: PixelCanvas, hx: number, hy: number, tx: number, ty: number, view: View): void {
  c.part();
  c.line(hx, hy, tx, ty + 2, STICK);
  c.part();
  const rx = view === 'side' ? 7 : 8.5;
  const ry = 4.5;
  for (let y = Math.floor(ty - ry); y <= ty + 1.5; y++) {
    for (let x = Math.floor(tx - rx); x <= tx + rx; x++) {
      const dx = (x + 0.5 - tx) / rx;
      const dy = (y + 0.5 - ty) / ry;
      // The canopy's lower edge in scallops.
      const scallop = y + 0.5 - ty > 0 ? Math.abs(Math.sin((x - tx) * 0.8)) < 0.5 : true;
      if (dx * dx + dy * dy > 1 || !scallop) continue;
      const rib = Math.abs(((x + 0.5 - tx) / 2.2) % 1) < 0.18;
      c.px(x, y, PARASOL, sphere(dx, dy, 0.8), { bias: rib ? -1 : 0 });
    }
  }
  c.px(Math.round(tx), Math.round(ty - ry - 1), STICK);
}

function drawTeaGirl(c: PixelCanvas, p: PolterPose, view: View): void {
  const b = p.bob;
  const cx = CX + (view === 'side' ? -p.lean : 0);
  const headY = 12 - b;
  const waist = 24 - b;
  const hem = 33 - b;
  const side = view === 'side';

  // The parasol over her shoulder, behind her (held in the back hand).
  const phx = side ? cx + 3 + p.handB.x : cx + 7 + p.handB.x;
  const phy = waist - 2 + p.handB.y;
  if (view !== 'up') parasol(c, phx, phy, side ? cx + 7 : cx + 9, headY - 6, view);

  // Ringlets, behind the face.
  c.part();
  if (view !== 'side') for (const s of [-1, 1]) c.capsule(cx + s * 4.8, headY + 1, cx + s * 5.5, headY + 7, 1.3, 1.1, RINGLET);
  else c.capsule(cx + 3.5, headY + 1, cx + 4.5, headY + 7, 1.4, 1.1, RINGLET);

  // The skirt, flaring, its lace frills, fading to mist at the hem.
  c.part();
  c.shape(Math.round(waist), Math.round(hem), (y) => {
    const k = (y - waist) / (hem - waist);
    const hw = side ? 3.5 + k * 5 : 4.5 + k * 5.5;
    return [cx - hw + (side ? k * 1.5 : 0), cx + hw + (side ? k * 2 : 0)];
  }, LAVENDER, (_x, _y, t, u) => cyl(t, 0.25 - u * 0.4));
  c.part();
  for (const fy of [Math.round(waist + 4), Math.round(hem - 1)]) {
    const k = (fy - waist) / (hem - waist);
    const hw = side ? 3.5 + k * 5 : 4.5 + k * 5.5;
    for (let x = Math.round(cx - hw); x < cx + hw + (side ? 2 : 0); x++) {
      c.px(x, fy, LACE, { x: 0, y: 0.3, z: 0.9 });
      if (x % 2 === 0) c.px(x, fy + 1, LACE, { x: 0, y: -0.2, z: 0.9 });
    }
  }
  // Mist trailing from the hem, dithered away.
  for (let y = Math.round(hem + 1); y <= hem + 5; y++) {
    const k = (y - hem) / 5;
    const hw = (side ? 7 : 8.5) * (1 - k * 0.6);
    for (let x = Math.round(cx - hw); x < cx + hw; x++) {
      if ((x + y + Math.round(p.wave * 2)) % (k < 0.4 ? 2 : 3) !== 0) continue;
      c.px(x, y, DRESS_MIST, { x: 0, y: 0, z: 1 });
    }
  }

  // The bodice and puffed sleeves.
  c.part();
  c.shape(Math.round(waist - 6), Math.round(waist), (y) => {
    const k = (y - waist + 6) / 6;
    const hw = side ? 3 : 3.8 - k * 0.8;
    return [cx - hw, cx + hw];
  }, LAVENDER, (_x, _y, t) => cyl(t, 0.3));
  c.part();
  if (side) c.ellipse(cx, waist - 5, 2.4, 2, LAVENDER);
  else for (const s of [-1, 1]) c.ellipse(cx + s * 4.2, waist - 5, 2.2, 2, LAVENDER);
  // Lace at the collar.
  for (let x = Math.round(cx - 2); x <= cx + 2; x++) c.px(x, Math.round(waist - 6), LACE);

  // Arms: the front hand free (it throws), the back one on the parasol.
  c.part();
  if (side) c.capsule(cx - 1, waist - 4, cx - 3 + p.handA.x, waist - 1 + p.handA.y, 1, 0.9, PORCELAIN);
  else {
    c.capsule(cx - 4.5, waist - 4, cx - 6 + p.handA.x, waist - 1 + p.handA.y, 1, 0.9, PORCELAIN);
    c.capsule(cx + 4.5, waist - 4, phx, phy, 1, 0.9, PORCELAIN);
  }

  // The bonnet, and the face in it.
  c.part();
  c.ellipse(cx + (side ? 1 : 0), headY - 0.5, side ? 5.5 : 6.2, 5.6, LAVENDER);
  // The bonnet's lace brim.
  c.part();
  for (let i = 0; i < 16; i++) {
    const a = Math.PI + (i / 15) * Math.PI;
    if (side && Math.cos(a) > 0.3) continue;
    c.px(Math.round(cx + Math.cos(a) * 5.8), Math.round(headY - 0.5 + Math.sin(a) * 5.4), LACE);
  }
  if (view !== 'up') {
    c.part();
    c.ellipse(cx - (side ? 1.5 : 0), headY + 0.5, side ? 3 : 3.8, 3.8, PORCELAIN);
    c.part();
    const eyes = side ? [cx - 3] : [cx - 1.6, cx + 1.6];
    for (const ex of eyes) {
      if (p.squint) {
        c.px(Math.round(ex - 0.5), Math.round(headY + 0.5), VOID);
        c.px(Math.round(ex + 0.5), Math.round(headY + 0.5), VOID);
      } else {
        c.px(Math.round(ex), Math.round(headY), VOID);
        c.px(Math.round(ex), Math.round(headY + 1), VOID);
        if (p.glare > 0) c.spark(ex, headY + 0.5, [230, 200, 255], p.glare);
      }
    }
    if (!side) {
      c.px(Math.round(cx - 2.6), Math.round(headY + 2), BLUSH);
      c.px(Math.round(cx + 2.6), Math.round(headY + 2), BLUSH);
      c.px(Math.round(cx), Math.round(headY + 3), BLUSH);
    } else c.px(Math.round(cx - 3.5), Math.round(headY + 3), BLUSH);
    // The bow under her chin.
    c.part();
    const bx = side ? cx - 1 : cx;
    for (const s of side ? [1] : [-1, 1]) c.ellipse(bx + s * 1.6, headY + 5, 1.3, 0.9, RIBBON);
    c.px(Math.round(bx), Math.round(headY + 5), RIBBON);
  } else {
    // From behind: the bonnet's back and its bow's long tails.
    c.part();
    c.ellipse(cx, headY + 4.5, 1.5, 1, RIBBON);
    c.capsule(cx - 0.5, headY + 5, cx - 1.5, headY + 10, 0.7, 0.5, RIBBON);
    c.capsule(cx + 0.5, headY + 5, cx + 1.5, headY + 10, 0.7, 0.5, RIBBON);
    parasol(c, phx, phy, cx + 5, headY - 4, view);
  }
}

// ---------------------------------------------------------------------------
// Animations

export type PolterAnim = 'idle' | 'move' | 'throw' | 'rattle' | 'cast';

interface AnimDef {
  name: PolterAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => PolterPose[];
}

const idle = (): PolterPose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.bob = [0, 1, 1, 0][i];
    p.wave = i;
    p.sway = [0, 1, 0, -1][i];
    p.handA = { x: 0, y: [0, -1, -1, 0][i] };
    p.handB = { x: 0, y: [0, 0, -1, -1][i] };
    return p;
  });

/** Drifting: leaning into it, the tail streaming. */
const move = (view: View): PolterPose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.bob = [1, 2, 2, 1][i];
    p.wave = i + 0.5;
    p.sway = view === 'side' ? [2, 1, 2, 3][i] : [1, 2, 1, 0][i];
    p.lean = view === 'side' ? 1 : 0;
    p.handA = view === 'side' ? { x: 2, y: -1 } : { x: 0, y: 1 };
    p.handB = view === 'side' ? { x: 2, y: 0 } : { x: 0, y: 1 };
    return p;
  });

/** A throw: the arm drawn back, then flung forward, with a gleeful squint. */
const toss = (view: View): PolterPose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.bob = 1;
    p.squint = i >= 1 && i <= 2;
    const back = view === 'side' ? { x: 5, y: -6 } : view === 'down' ? { x: -2, y: -8 } : { x: -2, y: -4 };
    const fling = view === 'side' ? { x: -5, y: -3 } : view === 'down' ? { x: 1, y: 2 } : { x: 1, y: -9 };
    p.handA = i === 0 ? back : i === 3 ? { x: 0, y: 0 } : fling;
    p.lean = view === 'side' && i >= 1 && i <= 2 ? 1 : 0;
    p.wave = i;
    return p;
  });

/** The rattle: both arms thrown up and the whole ghost shaking. */
const rattle = (view: View): PolterPose[] =>
  [0, 1, 2, 3, 4].map((i) => {
    const p = base();
    const up = view === 'side' ? { x: -1, y: -9 } : { x: 0, y: -9 };
    p.handA = { ...up, x: up.x + (view === 'side' ? 0 : -1) };
    p.handB = { ...up, x: up.x + (view === 'side' ? 3 : 1) };
    p.shake = i % 2 ? 1 : -1;
    p.bob = i === 0 ? 0 : 3;
    p.glare = 0.5;
    p.wave = i * 1.5;
    return p;
  });

/** Its Special's pose: rising up, arms spread wide, eyes blazing. */
const cast = (view: View): PolterPose[] =>
  [0.3, 0.6, 1, 1, 1].map((k, i) => {
    const p = base();
    p.bob = Math.round(k * 4);
    p.glare = k;
    p.handA = view === 'side' ? { x: -2, y: -6 * k } : { x: -3 * k, y: -6 * k };
    p.handB = view === 'side' ? { x: 3, y: -6 * k } : { x: 3 * k, y: -6 * k };
    p.wave = i;
    p.sway = i % 2;
    return p;
  });

export const POLTER_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: idle },
  { name: 'move', fps: 8, loop: true, poses: move },
  { name: 'throw', fps: 16, loop: false, poses: toss },
  { name: 'rattle', fps: 16, loop: false, poses: rattle },
  { name: 'cast', fps: 10, loop: false, poses: cast },
];

export interface PolterFrame {
  key: string;
  anim: PolterAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: PolterPose): PixelCanvas {
  const c = new PixelCanvas(POLTER_W, POLTER_H).offset(p.shake, 0);
  const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
  if (L.tea) drawTeaGirl(c, p, view);
  else drawSheetGhost(c, p, view);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildPolterFrames(look: PolterLook = POLTER_LOOK): PolterFrame[] {
  L = look;
  const out: PolterFrame[] = [];
  for (const a of POLTER_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, pose) }));
    }
  }
  L = POLTER_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// The haunted things it throws

export const HAUNT_SIZE = 16;
export type HauntKind = 'chair' | 'book' | 'candle' | 'pot' | 'trunk' | 'cup' | 'saucer' | 'jug' | 'teapot';
export const HAUNT_KINDS: HauntKind[] = ['chair', 'book', 'candle', 'pot', 'trunk', 'cup', 'saucer', 'jug', 'teapot'];

const OAK: Material = { ramp: ramp('#2e1a0c', '#5a361a', '#8a5a2e', '#b88448'), outline: hex('#120a04') };
const CLOTH: Material = { ramp: ramp('#3a0e1a', '#6a1a2e', '#a02e46', '#d05a6e'), outline: hex('#160408') };
const PAGE: Material = { ramp: ramp('#a89878', '#e0d4b0', '#fffae8'), outline: hex('#2a2010') };
const BRASS: Material = { ramp: ramp('#5a3a0e', '#a8761e', '#e8b440', '#fff0a0'), outline: hex('#1e1204'), shine: true };
const IRON: Material = { ramp: ramp('#15161c', '#2a2c36', '#464a58', '#6a7082'), outline: hex('#060608'), shine: true };
const FLAME: Material = { ramp: ramp('#ff8a2a', '#ffd860', '#fffbe0'), outline: hex('#5a2006'), emissive: 1, noAO: true, noOutline: true };
const CHINA: Material = { ramp: ramp('#8a92b4', '#c4cce4', '#f0f4ff', '#ffffff'), outline: hex('#20243a'), shine: true };
const CHINA_BLUE: Material = { ramp: ramp('#1a2a7a', '#3a5ad0'), outline: hex('#0a1030'), noOutline: true };
const TEA: Material = { ramp: ramp('#3a1a06', '#7a3e12'), outline: hex('#1a0a02'), noOutline: true };

/**
 * A haunted thing, drawn upright in a HAUNT_SIZE square: a ghostly glow
 * clings round its edge (added in the world as its glow layer).
 */
export function hauntFrame(kind: HauntKind): PixelCanvas {
  const c = new PixelCanvas(HAUNT_SIZE, HAUNT_SIZE);
  const cx = 8;
  switch (kind) {
    case 'chair':
      c.capsule(4, 2, 4, 13, 0.8, 0.8, OAK);
      c.capsule(11, 7, 11, 13, 0.8, 0.8, OAK);
      c.capsule(6, 13, 6, 10, 0.7, 0.7, OAK);
      c.part();
      for (let y = 3; y <= 7; y += 2) c.line(4, y, 6, y, OAK);
      c.shape(8, 9, () => [4, 12.5], CLOTH, (_x, _y, t) => cyl(t, 0.6));
      break;
    case 'book':
      c.shape(4, 12, () => [3, 13], CLOTH, (_x, _y, t) => cyl(t * 0.3, 0.2));
      c.part();
      for (let y = 5; y <= 11; y++) c.px(12, y, PAGE, { x: 0.7, y: 0, z: 0.7 });
      c.line(4, 8, 11, 8, BRASS);
      c.px(7, 6, BRASS);
      c.px(8, 6, BRASS);
      break;
    case 'candle':
      c.ellipse(cx, 13, 3.5, 1.4, BRASS);
      c.capsule(cx, 13, cx, 7, 0.9, 0.9, BRASS);
      c.ellipse(cx, 7, 2.6, 1, BRASS);
      c.part();
      c.shape(3, 6, () => [cx - 0.8, cx + 1.2], PAGE, (_x, _y, t) => cyl(t, 0.2));
      c.part();
      c.ellipse(cx + 0.2, 1.5, 0.9, 1.4, FLAME);
      break;
    case 'pot':
      c.ellipse(cx, 9, 5, 4, IRON);
      c.part();
      c.ellipse(cx, 5.5, 4.2, 1.2, IRON, { flatten: 0.4 });
      c.capsule(2.5, 7, 1.5, 6, 0.6, 0.6, IRON);
      c.capsule(13.5, 7, 14.5, 6, 0.6, 0.6, IRON);
      break;
    case 'trunk':
      c.shape(5, 13, () => [1.5, 14.5], OAK, (_x, _y, t, u) => cyl(t * 0.6, 0.3 - u * 0.4));
      c.ellipse(cx, 5, 6.5, 2.5, OAK, { flatten: 0.6 });
      c.part();
      for (const x of [4, 12]) c.line(x, 4, x, 13, BRASS);
      c.px(cx, 8, BRASS);
      c.px(cx, 9, IRON);
      break;
    case 'cup':
      c.shape(6, 11, (y) => [cx - 3.5 + (y - 6) * 0.3, cx + 3.5 - (y - 6) * 0.3], CHINA, (_x, _y, t) => cyl(t, 0.2));
      c.ellipse(cx + 4.5, 8, 1.4, 1.8, CHINA);
      c.part();
      c.ellipse(cx, 6, 3.4, 0.9, TEA, { flatten: 0.3 });
      c.line(cx - 2, 9, cx + 2, 9, CHINA_BLUE);
      break;
    case 'saucer':
      c.ellipse(cx, 9, 6.5, 2.2, CHINA, { flatten: 0.5 });
      c.part();
      c.ellipse(cx, 8.5, 3, 0.9, CHINA);
      for (let x = 3; x <= 13; x += 2) c.px(x, 10, CHINA_BLUE);
      break;
    case 'jug':
      c.shape(4, 13, (y) => {
        const k = (y - 4) / 9;
        const hw = 2.4 + Math.sin(k * Math.PI) * 1.6;
        return [cx - hw, cx + hw];
      }, CHINA, (_x, _y, t) => cyl(t, 0.2));
      c.part();
      c.capsule(cx + 3, 6, cx + 5.5, 9, 0.7, 0.7, CHINA);
      c.px(cx - 3, 4, CHINA);
      c.line(cx - 2, 10, cx + 2, 10, CHINA_BLUE);
      break;
    case 'teapot':
      c.ellipse(cx, 9, 5, 4, CHINA);
      c.part();
      c.capsule(cx - 4.5, 9, cx - 7, 5.5, 1, 0.6, CHINA);
      c.ellipse(cx + 5.5, 8.5, 1.5, 2.2, CHINA);
      c.ellipse(cx, 5, 2.4, 1, CHINA);
      c.px(cx, 3.5, CHINA);
      c.part();
      for (let x = cx - 3; x <= cx + 3; x += 2) c.px(x, 9, CHINA_BLUE);
      c.px(cx - 1, 11, CHINA_BLUE);
      c.px(cx + 1, 11, CHINA_BLUE);
      break;
  }
  // The haunting: a faint glow hugging its outline.
  const tea = kind === 'cup' || kind === 'saucer' || kind === 'jug' || kind === 'teapot';
  const glow: RGB = tea ? [210, 190, 255] : [150, 255, 210];
  for (let y = 0; y < HAUNT_SIZE; y++) {
    for (let x = 0; x < HAUNT_SIZE; x++) {
      if (c.filled(x, y)) continue;
      if (c.filled(x - 1, y) || c.filled(x + 1, y) || c.filled(x, y - 1) || c.filled(x, y + 1)) c.spark(x, y, glow, 0.45);
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// Icons

const POLTER_TONES: Tones = [hex('#eefff8'), hex('#9ff0d4'), hex('#4ac8a0'), hex('#1a6a5a')];
const TEA_TONES: Tones = [hex('#fff4ff'), hex('#e0c8ff'), hex('#a888e0'), hex('#4a3a7a')];

/** The throw: a haunted chair (or a teacup) tumbling through the air, streaks of ghost-light behind. */
export function hurlIcon(tea = false): Uint8ClampedArray {
  const t = tea ? TEA_TONES : POLTER_TONES;
  const wood: RGB = tea ? hex('#f0f4ff') : hex('#b88448');
  const dark: RGB = tea ? hex('#3a5ad0') : hex('#5a361a');
  return icon16((put) => {
    for (const [y, x0, x1] of [[5, 0, 4], [8, 1, 5], [11, 0, 3]] as const) seg(put, x0, y, x1, y, t[2]);
    if (tea) {
      for (let y = 5; y <= 11; y++) for (let x = 7 + (y - 5) * 0.2; x <= 14 - (y - 5) * 0.2; x++) put(x, y, y === 5 ? t[1] : wood);
      for (let y = 6; y <= 9; y++) put(15, y, wood);
      seg(put, 8, 9, 13, 9, dark);
      put(9, 3, t[0]);
      put(11, 2, t[1]);
    } else {
      // A chair, tipped over mid-flight.
      seg(put, 7, 3, 13, 9, wood);
      seg(put, 8, 3, 14, 9, dark);
      seg(put, 10, 9, 14, 13, wood);
      seg(put, 13, 9, 9, 13, wood);
      seg(put, 6, 6, 9, 3, wood);
    }
    for (const [x, y] of [[6, 14], [15, 3], [5, 2]]) put(x, y, t[0]);
  });
}

/** The rattle: things bursting up out of the ground in a ring. */
export function rattleIcon(tea = false): Uint8ClampedArray {
  const t = tea ? TEA_TONES : POLTER_TONES;
  return icon16((put) => {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      put(8 + Math.cos(a) * 6.5, 11 + Math.sin(a) * 3, t[2]);
    }
    for (const [x, h] of [[3, 5], [8, 8], [13, 5], [5.5, 3], [10.5, 3]] as const) {
      seg(put, x, 11, x, 11 - h, t[1]);
      put(x, 10 - h, t[0]);
    }
  });
}
