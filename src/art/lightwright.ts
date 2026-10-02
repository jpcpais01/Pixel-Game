// The Lightwright, the Inventor's optician, drawn from a small rig like the
// engineer's and the scientist's (see inventor.ts), on a rig of his own.
//
// The lightwright: a lean young inventor of optics in a long mustard-brown
// coat with its sleeves pushed up over rolled shirt sleeves, a cream
// waistcoat with brass buttons and a watch chain, a wine-red cravat, chestnut
// hair neatly parted with mutton-chop sideburns, and over one eye a brass
// loupe headset: a band round the head and a hinged arm of lenses that flip
// down over the eye. At his hip he carries his lens cannon, a short brass
// telescope of a thing with a great lens at its mouth that focuses sunlight
// into a searing ray. A spare brass spyglass is slung across his back.
//
// Stargazer is a skin of his: an astronomer in a midnight-blue coat
// embroidered with silver constellations that glint in the dark, full
// sleeves with silver cuffs, a pale silver waistcoat, silver hair and a
// short pointed beard, and silver optics whose glass shines starlight-blue.
//
// The body keeps to the 24x32 box; frames are larger so the cannon and the
// raised arms fit. Hands are posed in the rig's own terms (forward, out to
// the side, height) and placed per view, and so is the way the cannon points.
//
// Also here: the prism he throws (a lit crystal turning in the air) and the
// button icons, registered through `lightwrightFx` (see textures.ts).

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { BEARD, BOOT, EYE, LEATHER, SILVER, SKIN } from './palette';
import { BRASS } from './inventor';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';
import type { FxRegistrar } from './frostKit';

export const LW_W = 48;
export const LW_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const LW_ORIGIN_X = BODY_X + 12;
export const LW_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet that the focus beam leaves the lens and the prism leaves the hand. */
export const LW_HAND_Y = 15;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#120e1f');

// ---------------------------------------------------------------------------
// Materials

const COAT: Material = { ramp: ramp('#2e1c08', '#5a3a10', '#8a5e1c', '#b8862e', '#dcae4c'), outline: hex('#160c02'), outlineLit: hex('#2a1806') };
const WAISTCOAT: Material = { ramp: ramp('#5e5440', '#968a6c', '#c8bc96', '#e8e0c0', '#fffbe8'), outline: hex('#221c10'), outlineLit: hex('#3a3220') };
const SHIRT: Material = { ramp: ramp('#727480', '#acaeba', '#d8dae2', '#f6f6fa'), outline: hex('#20222c') };
const TROUSERS: Material = { ramp: ramp('#140c08', '#24160e', '#382418', '#4e3424'), outline: INK };
const HAIR: Material = { ramp: ramp('#1e0e06', '#3c1e0c', '#5e3416', '#844e24'), outline: hex('#0c0602') };
const CRAVAT: Material = { ramp: ramp('#30060e', '#5e0e1c', '#92202e', '#c43c46'), outline: hex('#140204') };
/** The cannon's great lens: warm glass with the sun caught in it. */
const LENS_SUN: Material = { ramp: ramp('#6a4810', '#c08a2a', '#f4d27a', '#fff6d6'), outline: hex('#2a1a04'), emissive: 0.45, noAO: true, shine: true };
/** The loupe's little lenses. */
const LOUPE_SUN: Material = { ramp: ramp('#7a5a20', '#d8b060', '#fff0c0'), outline: hex('#2a1a04'), emissive: 0.6, noAO: true, shine: true };
const CLOTH: Material = { ramp: ramp('#7a7468', '#bcb4a2', '#e8e2d2', '#fbf8ee'), outline: hex('#24201a') };

// Stargazer.
const NIGHT_COAT: Material = { ramp: ramp('#05061a', '#0c1032', '#161e52', '#24347a', '#3a50a4'), outline: hex('#02030c'), outlineLit: hex('#0c1030') };
const STAR_VEST: Material = { ramp: ramp('#2e2c48', '#56547c', '#8886b2', '#b8b6dc', '#e8e8fc'), outline: hex('#100e22'), outlineLit: hex('#22203a') };
const STAR_CRAVAT: Material = { ramp: ramp('#160a30', '#2c1458', '#48248a', '#6a3cb8'), outline: hex('#08041a') };
const STAR_TROUSERS: Material = { ramp: ramp('#08081a', '#12122a', '#1e1e3e', '#2c2c54'), outline: INK };
const LENS_STAR: Material = { ramp: ramp('#1a3a7a', '#4a7cd0', '#a6ccff', '#f0f8ff'), outline: hex('#060e24'), emissive: 0.55, noAO: true, shine: true };
const LOUPE_STAR: Material = { ramp: ramp('#2a4a8a', '#8ab4f0', '#e8f4ff'), outline: hex('#060e24'), emissive: 0.7, noAO: true, shine: true };
/** The embroidered stars: silver thread with a glint of its own. */
const STAR_THREAD: Material = { ramp: ramp('#8a90b8', '#d4d8f0', '#ffffff'), outline: hex('#0e0d18'), emissive: 0.35, noAO: true, noOutline: true };

const PRISM_GLASS: Material = { ramp: ramp('#5a7aa4', '#8eb0d8', '#c8e2f8', '#f4fbff'), outline: hex('#1a2438'), emissive: 0.35, noAO: true, shine: true };
const PRISM_STAR: Material = { ramp: ramp('#4e4ea8', '#8282dc', '#bcbcff', '#f4f0ff'), outline: hex('#14143a'), emissive: 0.45, noAO: true, shine: true };

// ---------------------------------------------------------------------------
// Looks

export interface LightwrightLook {
  key: string;
  /** The Stargazer skin. */
  star: boolean;
  /** The light his lenses gather, brightest first. */
  light: [RGB, RGB, RGB, RGB];
  /** The spectrum the prism splits it into, from one edge of a beam to the other. */
  spectrum: RGB[];
}

export const LIGHTWRIGHT_LOOK: LightwrightLook = {
  key: 'lightwright',
  star: false,
  light: [hex('#fffdf0'), hex('#fff0b0'), hex('#ffc85a'), hex('#c07a20')],
  spectrum: [hex('#ff4a4a'), hex('#ff9a3a'), hex('#ffe85a'), hex('#5ae86a'), hex('#4aa8ff'), hex('#9a6aff')],
};
export const STARGAZER_LOOK: LightwrightLook = {
  key: 'lightwright_star',
  star: true,
  light: [hex('#f4fbff'), hex('#c8e4ff'), hex('#8ab8ff'), hex('#4a5ad0')],
  spectrum: [hex('#5ae0ff'), hex('#4aa0ff'), hex('#5a6aff'), hex('#8a5aff'), hex('#c45aff'), hex('#ff6ad8')],
};
export const LIGHTWRIGHT_LOOKS = [LIGHTWRIGHT_LOOK, STARGAZER_LOOK];

/** The look being drawn; set by buildLightwrightFrames. */
let S: LightwrightLook = LIGHTWRIGHT_LOOK;

const star = () => S.star;
const coat = (): Material => (star() ? NIGHT_COAT : COAT);
const vest = (): Material => (star() ? STAR_VEST : WAISTCOAT);
const metal = (): Material => (star() ? SILVER : BRASS);
const glass = (): Material => (star() ? LENS_STAR : LENS_SUN);
const loupeGlass = (): Material => (star() ? LOUPE_STAR : LOUPE_SUN);
const hair = (): Material => (star() ? BEARD : HAIR);
const trousers = (): Material => (star() ? STAR_TROUSERS : TROUSERS);
const cravat = (): Material => (star() ? STAR_CRAVAT : CRAVAT);

// ---------------------------------------------------------------------------
// The rig

/** A hand (or the way the cannon points), in the rig's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
export interface Hand {
  f: number;
  s: number;
  h: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

export interface Pose {
  /** Whole body raised. */
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The free hand and the cannon hand. */
  a: Hand;
  b: Hand;
  /** Which way the cannon points from its hand. */
  t: Hand;
  /** 0..1 the cannon's lens lit. */
  glow: number;
  /** 0..1 a prism held in the free hand (the throw). */
  prism: number;
  /** The coat's hem swinging, in pixels. */
  sway: number;
  tick: number;
  blink?: boolean;
  /** 0..1 how far the loupe's lenses are flipped down (0: one over the eye, 1: both). */
  loupe?: number;
  // The idle moment's extras (front view only).
  /** A polishing cloth in the free hand. */
  cloth?: boolean;
  /** 0..1 a breath fogging the lens. */
  fog?: number;
  /** 0..1 the lens glinting as it catches the sky. */
  glint?: number;
}

type View = 'down' | 'up' | 'side';

/** The chest row in body coordinates, the height hands are posed from. */
const CH = 18;

interface Placed {
  x: number;
  y: number;
  /** Drawn behind the body. */
  behind: boolean;
}

/** Where a hand lands on screen in each view. `hx` is the upper body's centre (side view). */
function place(view: View, arm: 'a' | 'b', q: Hand, U: number, hx: number): Placed {
  const side = arm === 'a' ? -1 : 1;
  if (view === 'down') return { x: 12 + side * q.s, y: CH + U - q.h + q.f * 0.7, behind: q.f < -1 };
  if (view === 'up') return { x: 12 - side * q.s, y: CH + U - q.h - q.f * 0.8, behind: q.f > 1 };
  // Facing left; `a` is the far arm, a touch higher and behind the body.
  const far = arm === 'a';
  return { x: hx - 1 - q.f * 1.05 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), behind: far && q.f < 1 };
}

/** The cannon's direction on screen, foreshortened when it points at or away from the viewer; also whether it dips behind the body. */
function toolDir(view: View, t: Hand): { x: number; y: number; k: number; away: boolean; toward: boolean } {
  const l = Math.hypot(t.f, t.s, t.h) || 1;
  const f = t.f / l;
  const s = t.s / l;
  const h = t.h / l;
  let x: number;
  let y: number;
  let away: boolean;
  let toward = false;
  if (view === 'down') {
    x = s;
    y = -h + f * 0.55;
    away = f < -0.35;
    toward = f > 0.55;
  } else if (view === 'up') {
    x = -s;
    y = -h - f * 0.55;
    away = f > 0.35;
  } else {
    x = -f;
    y = -h;
    away = false;
  }
  const k = Math.max(0.35, Math.hypot(x, y));
  const n = Math.hypot(x, y) || 1;
  return { x: x / n, y: y / n, k, away, toward };
}

/** Two bones from the shoulder to the hand, the elbow on the side `hint` points. */
function elbow(sx: number, sy: number, fx: number, fy: number, reach: number, hint: [number, number]): [number, number] {
  const dx = fx - sx;
  const dy = fy - sy;
  const d = Math.hypot(dx, dy) || 0.01;
  let ex = sx + dx / 2;
  let ey = sy + dy / 2;
  if (d < reach * 2) {
    const ang = Math.acos(Math.min(1, d / (reach * 2)));
    const base = Math.atan2(dy, dx);
    let best = -Infinity;
    for (const t of [base + ang, base - ang]) {
      const cx = sx + Math.cos(t) * reach;
      const cy = sy + Math.sin(t) * reach;
      const score = (cx - sx) * hint[0] + (cy - sy) * hint[1];
      if (score > best) {
        best = score;
        ex = cx;
        ey = cy;
      }
    }
  }
  return [ex, ey];
}

/**
 * An arm: the coat sleeve pushed up to the elbow over a rolled shirt cuff, a
 * bare forearm and hand; the Stargazer's full sleeve to a silver cuff.
 */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bias = 0): void {
  const [ex, ey] = elbow(sx, sy, p.x, p.y, reach, hint);
  const wx = ex + (p.x - ex) * 0.72;
  const wy = ey + (p.y - ey) * 0.72;
  c.part();
  c.capsule(sx, sy, ex, ey, 1.9, 1.6, coat(), { bias });
  if (star()) {
    c.part();
    c.capsule(ex, ey, wx, wy, 1.6, 1.5, NIGHT_COAT, { bias });
    c.part();
    c.ellipse(wx, wy, 1.3, 1.1, SILVER, { bias });
  } else {
    // The coat sleeve's pushed-up folds, the shirt's rolled cuff, then the forearm.
    c.part();
    c.ellipse(ex, ey, 1.7, 1.4, SHIRT, { bias: bias + 1 });
    c.part();
    c.capsule(ex, ey, wx, wy, 1.3, 1.15, SKIN, { bias });
  }
  c.part();
  c.ellipse(p.x, p.y, 1.2, 1.15, SKIN, { bias });
}

/** Boots: plain, laced, polished at the toe. */
function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  c.ellipse(x, y, side ? 2.2 : 1.7, 1.25, BOOT, { flatten: 0.8, bias });
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) c.px(x, y, SKIN, sphere(0, -0.3), { bias: -1 });
    else c.px(x, y, EYE);
  }
}

/** A small cross of light, the arms growing with `k`. */
function glowAt(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.light;
  c.spark(x, y, core, k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + dx, y + dy, hot, 0.6 * k);
  if (k > 0.6) for (const [dx, dy] of [[2, 0], [-2, 0], [0, -2], [0, 2]]) c.spark(x + dx, y + dy, mid, 0.45 * k);
  if (k > 0.9) for (const [dx, dy] of [[3, 0], [-3, 0], [0, -3], [0, 3]]) c.spark(x + dx, y + dy, mid, 0.25 * k);
}

// ---------------------------------------------------------------------------
// The lens cannon

/**
 * The cannon, pointing along (ux, uy) from the hand: a short tube, a band
 * round its middle and an eyepiece knob at the back, flaring to a hood round
 * the great lens at its mouth. Seen end on (pointing at us) the lens is a
 * round pane of glass in its rim; side on, an edge of glass between two rim
 * pixels. The hand is drawn again over the grip.
 */
function drawCannon(c: PixelCanvas, p: Placed, d: { x: number; y: number; k: number; away: boolean; toward: boolean }, glow: number, glint: number, bias = 0): void {
  const { x: ux, y: uy, k } = d;
  const vx = -uy;
  const vy = ux;
  const hx = p.x;
  const hy = p.y;
  const m = metal();
  const len = 6 * k;
  // The body of the tube: from the eyepiece behind the hand to the hood.
  c.part();
  c.capsule(hx - ux * 2.2, hy - uy * 2.2, hx + ux * (len - 1), hy + uy * (len - 1), 1.05, 1.3, m, { bias });
  // The eyepiece knob at the back, and a darker band round the middle.
  c.part();
  c.px(hx - ux * 2.6, hy - uy * 2.6, m, sphere(-ux * 0.6, -uy * 0.6), { bias: bias - 1 });
  const bx = hx + ux * len * 0.45;
  const by = hy + uy * len * 0.45;
  c.shade(bx + vx, by + vy, -1);
  c.shade(bx - vx, by - vy, -1);
  c.shade(bx, by, -1);
  const ex = hx + ux * (len + 0.4);
  const ey = hy + uy * (len + 0.4);
  const [core, hot] = S.light;
  if (d.toward || k < 0.6) {
    // End on: the round rim and the lens filling it.
    if (!d.away) {
      c.part();
      c.ellipse(ex, ey, 2.1, 1.9, m, { bias });
      c.part();
      c.ellipse(ex, ey, 1.2, 1.15, glass(), { bias, glow: 0.4 + glow * 0.6 });
      c.spark(ex - 0.5, ey - 0.5, core, 0.35 + glow * 0.65);
    } else {
      c.part();
      c.ellipse(ex, ey, 2.0, 1.8, m, { bias });
    }
  } else {
    // Side on: the hood's rim either side and a sliver of glass across the mouth.
    c.part();
    for (let s = -2; s <= 2; s++) {
      const px = ex + vx * s * 0.95;
      const py = ey + vy * s * 0.95;
      if (Math.abs(s) === 2) c.px(px, py, m, sphere(vx * s * 0.4, vy * s * 0.4), { bias });
      else c.px(px, py, glass(), sphere(ux * 0.6 + vx * s * 0.3, uy * 0.6 + vy * s * 0.3), { bias, glow: 0.4 + glow * 0.6 });
    }
    c.spark(ex + ux * 0.6, ey + uy * 0.6, hot, 0.25 + glow * 0.5);
  }
  if (glow > 0.45) glowAt(c, ex + ux * 1.2, ey + uy * 1.2, (glow - 0.45) * 1.8);
  if (glint > 0) {
    // The sky caught in the glass: a four-pointed glint.
    c.spark(ex, ey, core, glint);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(ex + dx, ey + dy, hot, glint * 0.8);
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, -2], [0, 2], [0, -3]]) c.spark(ex + dx, ey + dy, hot, glint * 0.5);
  }
  c.part();
  c.ellipse(hx, hy, 1.2, 1.15, star() ? SILVER : SKIN, { bias });
  if (star()) c.shade(hx, hy, -1);
}

/** The prism, held up in the free hand: a little wedge of glass with the spectrum glinting off its faces. */
function drawPrism(c: PixelCanvas, p: Placed, k: number, tick: number): void {
  if (k <= 0) return;
  const x = p.x;
  const y = p.y - 2.4;
  const g = star() ? PRISM_STAR : PRISM_GLASS;
  c.part();
  c.shape(Math.round(y - 2), Math.round(y + 1), (yy) => {
    const w = 0.5 + (yy - Math.round(y - 2)) * 0.75;
    return [x - w, x + w];
  }, g, (_x, yy, t) => sphere(t * 0.9, (yy - y) / 2 - 0.3, 1), { glow: 0.3 + 0.5 * k });
  const sp = S.spectrum;
  for (let i = 0; i < 3; i++) c.spark(x + 2 + i * 0.4, y - 1 + i, sp[(i * 2 + tick) % sp.length], 0.7 * k);
  c.spark(x, y - 1, S.light[0], k);
  c.part();
  c.ellipse(x, p.y + 0.3, 1.2, 1.1, SKIN);
}

/** The polishing cloth bunched in the free hand. */
function drawCloth(c: PixelCanvas, p: Placed): void {
  c.part();
  c.ellipse(p.x, p.y - 0.4, 1.8, 1.5, CLOTH);
  c.px(p.x + 1, p.y + 1, CLOTH, sphere(0.4, 0.6), { bias: -1 });
  c.part();
  c.ellipse(p.x - 0.4, p.y + 0.4, 1.0, 0.9, SKIN);
}

// ---------------------------------------------------------------------------
// Heads

/**
 * The loupe headset from the front: a band across the brow, a hinge at the
 * temple and the lens arm over the eye. `down` 0 has one lens over the eye;
 * 1 has the second flipped down over it too, a bigger rim.
 */
function loupeDown(c: PixelCanvas, cx: number, U: number, down: number): void {
  const m = metal();
  // The band arching over the crown from temple to temple, like a pair of headphones.
  c.part();
  for (const [x, y] of [[-4, 10], [-4, 9], [-3, 8], [2, 8], [3, 9], [3, 10]] as const) c.px(cx + x, y + U, m, sphere(x / 4, -0.6), { bias: -1 });
  // The hinge at his right temple (our left), the lens over the eye.
  c.part();
  c.px(cx - 4, 10 + U, m, sphere(-0.6, 0));
  c.px(cx - 4, 11 + U, m, sphere(-0.6, 0.3));
  const ex = cx - 2;
  const ey = 12 + U;
  c.part();
  c.ellipse(ex + 0.5, ey + 0.5, down > 0.5 ? 1.75 : 1.4, down > 0.5 ? 1.6 : 1.3, m);
  c.part();
  c.px(ex, ey, loupeGlass(), sphere(-0.2, 0.3), { glow: 0.5 + 0.4 * down });
  if (down > 0.5) c.px(ex - 1, ey, loupeGlass(), sphere(-0.5, 0.2), { glow: 0.6 });
  c.spark(ex, ey, S.light[1], 0.35 + 0.4 * down);
}

/** The lightwright from the front: neat hair parted on one side, mutton chops, the loupe over his eye. */
function headDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hm = hair();
  c.part();
  c.ellipse(cx, 10.8 + U, 3.7, 3.3, hm, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.4, 1) });
  c.part();
  c.ellipse(cx, 12.6 + U, 3.1, 2.9, SKIN);
  // The parting: a swept fringe falling to one side.
  c.part();
  for (const [x, y] of [[cx - 3, 10], [cx - 2, 9], [cx - 1, 9], [cx + 1, 9], [cx + 2, 10], [cx + 3, 10], [cx + 2, 9]] as const) c.px(x, y + U, hm, sphere((x - cx) / 4, -0.6));
  c.shade(cx, 8 + U, -1);
  c.shade(cx, 9 + U, -1);
  // Sideburns (the Stargazer's run down into his beard).
  c.part();
  for (const y of [11, 12, 13]) {
    c.px(cx - 4, y + U, hm, cyl(-0.8, 0));
    c.px(cx + 3, y + U, hm, cyl(0.8, 0));
  }
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
  c.part();
  c.px(cx - 1, 13 + U, SKIN, sphere(-0.2, -0.4), { bias: 1 });
  if (star()) {
    // A neat moustache and a short pointed beard.
    c.part();
    for (let x = cx - 2; x <= cx + 1; x++) c.px(x, 14 + U, BEARD, sphere((x + 0.5 - cx) / 3, -0.2));
    for (let x = cx - 2; x <= cx + 1; x++) c.px(x, 15 + U, BEARD, sphere((x + 0.5 - cx) / 3, 0.2));
    c.px(cx - 1, 16 + U, BEARD, sphere(-0.2, 0.6));
    c.px(cx, 16 + U, BEARD, sphere(0.2, 0.6), { bias: -1 });
  } else {
    c.shade(cx - 1, 14 + U, -1);
    c.shade(cx, 14 + U, -1);
  }
  loupeDown(c, cx, U, p.loupe ?? 0);
}

/** The back of his head: hair, the headset's band round it, the coat's collar up behind the neck. */
function headUp(c: PixelCanvas, cx: number, U: number): void {
  const hm = hair();
  c.part();
  c.ellipse(cx, 11.2 + U, 3.8, 3.7, hm, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 1) });
  c.part();
  for (const [x, y] of [[cx - 1, 7], [cx + 1, 7], [cx + 3, 8], [cx - 4, 9]] as const) c.px(x, y + U, hm, sphere((x - cx) / 4, -0.6));
  // A neat line where the hair is cut at the nape.
  for (let x = cx - 2; x <= cx + 1; x++) c.shade(x, 14 + U, -1);
  c.part();
  c.shape(Math.round(9.6 + U), Math.round(9.6 + U), () => [cx - 4, cx + 4], metal(), (_x, _y, t) => cyl(t, 0.2), { bias: -2 });
  // The hinge and its lens arm peeking out at his right side (our right from behind).
  c.part();
  c.px(cx + 4, 10 + U, metal(), sphere(0.6, 0));
  c.px(cx + 4, 11 + U, metal(), sphere(0.7, 0.3));
  c.part();
  c.shape(Math.round(14.6 + U), Math.round(15.6 + U), () => [cx - 3.4, cx + 3.4], coat(), (_x, _y, t) => cyl(t, -0.4));
}

/** In profile, facing left: hair swept back, sideburn, the loupe's arm jutting out before the eye. */
function headSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  const hm = hair();
  c.part();
  c.ellipse(hx + 0.5, 10.9 + U, 3.6, 3.3, hm, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.4, 1) });
  c.part();
  c.ellipse(hx - 0.8, 12.6 + U, 2.8, 2.8, SKIN);
  c.part();
  c.px(hx - 4, 13 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
  c.px(hx + 0.8, 12 + U, SKIN, cyl(0.6, 0), { bias: -1 });
  c.part();
  for (const [x, y] of [[hx - 3, 10], [hx - 2, 9], [hx - 1, 9], [hx + 2, 8], [hx, 8]] as const) c.px(x, y + U, hm, sphere(-0.3, -0.6));
  c.px(hx + 0.4, 12 + U, hm, cyl(0.4, 0));
  c.px(hx + 0.4, 13 + U, hm, cyl(0.4, 0));
  eyes(c, [[hx - 3, 12 + U]], p.blink);
  if (star()) {
    c.part();
    c.px(hx - 4, 14 + U, BEARD, sphere(-0.4, -0.2));
    c.px(hx - 3, 14 + U, BEARD, sphere(0, -0.2));
    c.px(hx - 3, 15 + U, BEARD, sphere(-0.3, 0.3));
    c.px(hx - 2, 15 + U, BEARD, sphere(0, 0.3));
    c.px(hx - 3, 16 + U, BEARD, sphere(-0.3, 0.6), { bias: -1 });
  } else c.shade(hx - 3, 14 + U, -1);
  // The headset: band over the crown, hinge at the temple, the arm out to a lens before the eye.
  const m = metal();
  c.part();
  c.shape(Math.round(9.6 + U), Math.round(9.6 + U), () => [hx - 2.4, hx + 3.6], m, (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
  c.part();
  c.px(hx - 1, 11 + U, m, sphere(0, 0));
  c.px(hx - 2, 11 + U, m, sphere(0, -0.2));
  const down = p.loupe ?? 0;
  c.part();
  for (const y of [11, 12, 13]) c.px(hx - 4, y + U, m, cyl(-0.7, 0));
  c.px(hx - 5, 12 + U, loupeGlass(), sphere(-0.7, 0.2), { glow: 0.5 + 0.4 * down });
  c.spark(hx - 5, 12 + U, S.light[1], 0.35 + 0.4 * down);
  if (down > 0.5) {
    for (const y of [11, 12, 13]) c.px(hx - 6, y + U, m, cyl(-0.8, 0));
  } else {
    c.px(hx - 4, 9 + U, m, sphere(-0.4, -0.5));
    c.px(hx - 5, 9 + U, loupeGlass(), sphere(-0.5, -0.4), { glow: 0.4 });
  }
}

// ---------------------------------------------------------------------------
// Bodies (front and back)

/** Where the coat is open down the front, as a half-width at row y. */
const gapAt = (y: number, top: number, waist: number): number => (y < top + 4 ? 2.0 - (y - top) * 0.3 : y <= waist ? 0.9 : 0.9 + (y - waist) * 0.25);

/** The silver constellations stitched over the Stargazer's coat: stars (and their glints) and the threads that join them. */
const CONSTELLATIONS: { stars: [number, number][]; bright: number[] }[] = [
  // Over his right breast (our left): a little dipper.
  { stars: [[-4, 1], [-3, 3], [-4, 5], [-3, 7]], bright: [1] },
  // Over his left hip: a crooked W.
  { stars: [[2, 9], [3, 11], [4, 9], [4, 12]], bright: [2] },
  // Down the left skirt.
  { stars: [[-4, 10], [-3, 12]], bright: [0] },
];

function embroider(c: PixelCanvas, cx: number, top: number, sway: number, waist: number, hem: number, back: boolean): void {
  c.part();
  const sw = (y: number) => (y > waist ? Math.round(((y - waist) / (hem - waist)) * sway) : 0);
  const sets = back ? [{ stars: [[-2, 2], [0, 4], [2, 3], [1, 7], [-1, 9]] as [number, number][], bright: [1, 3] }, { stars: [[-3, 11], [2, 12]] as [number, number][], bright: [0] }] : CONSTELLATIONS;
  for (const { stars, bright } of sets) {
    for (let i = 0; i < stars.length; i++) {
      const [dx, dy] = stars[i];
      const y = top + dy;
      if (y > hem) continue;
      const x = cx + dx + sw(y);
      c.px(x, y, STAR_THREAD, sphere(0, -0.2), { glow: bright.includes(i) ? 0.7 : 0.3 });
      if (bright.includes(i)) c.spark(x, y, hex('#e8f0ff'), 0.6);
      // A faint stitch to the next star.
      if (i + 1 < stars.length) {
        const [nx, ny] = stars[i + 1];
        const mx = Math.round((dx + nx) / 2);
        const my = Math.round((dy + ny) / 2);
        if (!(mx === dx && my === dy) && !(mx === nx && my === ny)) c.shade(cx + mx + sw(top + my), top + my, 2);
      }
    }
  }
}

/** The long coat from the front or back, open over the waistcoat, cravat and watch chain. */
function coatBody(c: PixelCanvas, cx: number, U: number, L: number, sway: number, back: boolean): void {
  const top = 15 + U;
  const waist = 21 + U;
  const hem = 28 + L;
  if (!back) {
    c.part();
    c.shape(top, waist + 1, () => [cx - 2.4, cx + 2.4], vest(), (_x, _y, t) => cyl(t, 0.2));
    c.shape(waist + 2, hem, () => [cx - 1.8, cx + 1.8], trousers(), (_x, _y, t) => cyl(t, 0.2));
  }
  c.part();
  c.shape(top, hem, (y) => {
    const hw = y <= waist ? 4.9 - 0.6 * ((y + 0.5 - top) / (waist - top)) ** 2 : 4.3 + (y - waist) * 0.22;
    const s = y > waist ? ((y - waist) / (hem - waist)) * sway : 0;
    return [cx - hw + s, cx + hw + s];
  }, coat(), (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  if (back) {
    // The back seam and its vent, a belt across the small of the back.
    for (let y = top + 2; y <= hem; y++) c.shade(cx - 1 + Math.round(y > waist ? ((y - waist) / (hem - waist)) * sway : 0), y, -1);
    for (let x = cx - 3; x <= cx + 2; x++) c.shade(x, waist, -1);
    c.px(cx - 3, waist, metal(), sphere(-0.3, 0));
    c.px(cx + 2, waist, metal(), sphere(0.3, 0));
    if (star()) embroider(c, cx, top, sway, waist, hem, true);
    return;
  }
  // The opening, from a V at the collar to the hem.
  for (let y = top; y <= hem; y++) {
    const s = y > waist ? ((y - waist) / (hem - waist)) * sway : 0;
    const w = gapAt(y, top, waist);
    for (let x = Math.round(cx - w + s); x < Math.round(cx + w + s); x++) c.erase(x, y);
  }
  c.part();
  c.shape(top, waist + 1, (y) => {
    const w = gapAt(y, top, waist);
    return [cx - w, cx + w];
  }, vest(), (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
  c.part();
  c.shape(waist + 2, hem, (y) => {
    const s = ((y - waist) / (hem - waist)) * sway;
    const w = gapAt(y, top, waist);
    return [cx - w + s, cx + w + s];
  }, trousers(), (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
  // Lapels: a darker fold either side of the V, then the waistcoat's points under the gap.
  for (let y = top; y < top + 5; y++) {
    const w = gapAt(y, top, waist);
    c.shade(Math.round(cx - w - 1), y, -1);
    c.shade(Math.round(cx + w), y, -1);
  }
  c.part();
  c.px(cx - 1, waist + 2, vest(), sphere(-0.3, 0.5), { bias: -1 });
  c.px(cx, waist + 2, vest(), sphere(0.3, 0.5), { bias: -1 });
  // The cravat at the throat, the shirt collar's points either side.
  c.part();
  c.px(cx - 1, top, SHIRT, sphere(-0.4, -0.4), { bias: 1 });
  c.px(cx, top, SHIRT, sphere(0.4, -0.4), { bias: 1 });
  c.px(cx - 1, top + 1, cravat(), sphere(-0.3, 0));
  c.px(cx, top + 1, cravat(), sphere(0.3, 0));
  c.px(cx - 1, top + 2, cravat(), sphere(0, 0.4), { bias: -1 });
  if (star()) {
    // A star pin in the cravat.
    c.px(cx, top + 2, STAR_THREAD, sphere(0, 0), { glow: 0.8 });
    c.spark(cx, top + 2, hex('#e8f0ff'), 0.7);
  }
  // Waistcoat buttons, and the watch chain looping from one to the pocket.
  c.part();
  c.px(cx - 1, top + 4, metal(), sphere(0, 0));
  c.px(cx - 1, top + 6, metal(), sphere(0, 0));
  c.px(cx, top + 5, metal(), sphere(0.3, 0.2), { bias: 1 });
  c.px(cx + 1, top + 5, metal(), sphere(0.5, 0.3), { bias: 1 });
  // A belt over the waistcoat, its buckle, and a lens pouch at the hip.
  c.part();
  c.shape(waist + 1, waist + 1, () => [cx - 2.4, cx + 2.4], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.px(cx - 1, waist + 1, metal(), sphere(0, 0));
  c.part();
  c.shape(waist + 1, waist + 3, () => [cx + 3.2, cx + 5.4], LEATHER, (_x, _y, t) => cyl(t, 0.2), { bias: 1 });
  c.px(cx + 4, waist + 2, glass(), sphere(0.2, 0), { glow: 0.3 });
  if (star()) embroider(c, cx, top, sway, waist, hem, false);
}

/** The spare spyglass slung across his back (seen from behind): a tube on a strap from shoulder to hip. */
function spyglass(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.line(cx - 4, 15 + U, cx + 3, 23 + U, LEATHER, () => sphere(0, -0.2));
  c.part();
  c.capsule(cx + 3.5, 14.5 + U, cx - 2.5, 22 + U, 1.2, 1.0, metal());
  c.shade(Math.round(cx + 1), Math.round(17.3 + U), -1);
  c.shade(Math.round(cx), Math.round(18.6 + U), -1);
  c.px(cx + 4, 14 + U, glass(), sphere(0.4, -0.4), { glow: 0.3 });
}

// ---------------------------------------------------------------------------
// Views

const REACH_FRONT = 4.5;
const REACH_SIDE = 5.2;

function legsFront(c: PixelCanvas, L: number, fa: number, fb: number, back: boolean): void {
  const m = trousers();
  const [l, r] = back ? [fb, fa] : [fa, fb];
  c.part();
  c.capsule(10.2, 24 + L, 9.9, 28.6 - l, 1.7, 1.4, m);
  c.capsule(13.8, 24 + L, 14.1, 28.6 - r, 1.7, 1.4, m);
  boot(c, 9.8, 30.3 - l);
  boot(c, 14.2, 30.3 - r);
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const td = toolDir('down', p.t);
  const armA = () => arm(c, 7.2, 16.4 + U, fa, REACH_FRONT, [-0.6, 1], fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.8, 16.4 + U, fb, REACH_FRONT, [0.6, 1], fb.behind ? -1 : 0);
  const tool = (bias = 0) => drawCannon(c, fb, td, p.glow, p.glint ?? 0, bias);

  // The spyglass's end peeks over his shoulder.
  c.part();
  c.px(cx + 4, 14 + U, metal(), sphere(0.5, -0.5), { bias: -1 });
  const toolBack = td.away || fb.behind;
  if (fa.behind) armA();
  if (fb.behind) armB();
  if (toolBack) tool(-1);

  legsFront(c, L, p.footA, p.footB, false);
  coatBody(c, cx, U, L, p.sway, false);
  headDown(c, cx, U, p);

  if (!fb.behind) armB();
  if (!toolBack) tool();
  if (!fa.behind) armA();
  if (p.cloth) drawCloth(c, fa);
  if (p.fog) {
    // A breath misting the lens.
    const len = 6 * td.k + 0.4;
    const lx = fb.x + td.x * len;
    const ly = fb.y + td.y * len;
    for (const [dx, dy, a] of [[0, 0, 1], [-1, 0, 0.7], [1, -1, 0.6], [0, -1, 0.8], [-1, 1, 0.4]] as const) c.spark(lx + dx, ly + dy, hex('#dce4ee'), p.fog * a * 0.6);
  }
  drawPrism(c, fa, p.prism, p.tick);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const td = toolDir('up', p.t);
  const armA = () => arm(c, 16.8, 16.4 + U, fa, REACH_FRONT, [0.6, 0.8], fa.behind ? -1 : 0);
  const armB = () => arm(c, 7.2, 16.4 + U, fb, REACH_FRONT, [-0.6, 0.8], fb.behind ? -1 : 0);
  const tool = (bias = 0) => drawCannon(c, fb, td, p.glow, 0, bias);

  const toolBack = td.away || fb.behind;
  if (fa.behind) armA();
  if (fb.behind) armB();
  if (toolBack) tool(-1);
  if (p.prism > 0 && fa.behind) drawPrism(c, fa, p.prism * 0.7, p.tick);

  legsFront(c, L, p.footA, p.footB, true);
  coatBody(c, cx, U, L, p.sway, true);
  headUp(c, cx, U);
  spyglass(c, cx, U);

  if (!fb.behind) armB();
  if (!toolBack) tool();
  if (!fa.behind) armA();
  if (p.prism > 0 && !fa.behind) drawPrism(c, fa, p.prism * 0.7, p.tick);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean;
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);
  const td = toolDir('side', p.t);
  const top = 15 + U;
  const waist = 21 + U;
  const hem = 28 + L;

  // The far arm behind everything, unless it reaches out in front.
  const armA = (bias: number) => arm(c, hx + 1.2, 16.4 + U, fa, REACH_SIDE, [0.3, 1], bias);
  if (fa.behind) {
    armA(-1);
    drawPrism(c, fa, p.prism, p.tick);
  }
  const toolBack = td.x > 0.55 && fb.x > hx - 1;
  if (toolBack) drawCannon(c, fb, td, p.glow, 0, -1);

  // Legs: the back one in shade first.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  const m = trousers();
  c.part();
  c.capsule(cx + 0.8, 24 + L, cx + 1 - p.footB, 29 - lift(p.footB), 1.6, 1.4, m, { bias: -1 });
  boot(c, cx + 0.4 - p.footB, 30.3 - lift(p.footB), true, -1);
  c.part();
  c.capsule(cx - 0.6, 24 + L, cx - 0.4 - p.footA, 29 - lift(p.footA), 1.6, 1.4, m);
  boot(c, cx - 1.2 - p.footA, 30.3 - lift(p.footA), true);

  // The spyglass on his back, under the coat's shoulder.
  c.part();
  c.capsule(hx + 3.2, 14.8 + U, hx + 4.2, 21.5 + U, 1.1, 0.95, metal(), { bias: -1 });
  // The coat in profile, trailing back as he moves.
  c.part();
  c.shape(top, hem, (y) => {
    const u = y <= waist ? 0 : (y - waist) / (hem - waist);
    const shift = y <= waist ? hx : hx + (cx - hx) * Math.min(1, u * 2);
    const hw = y <= waist ? 3.4 - 0.4 * ((y + 0.5 - top) / (waist - top)) ** 2 : 3.1 + (y - waist) * 0.24;
    return [shift - hw - 0.2, shift + hw + 0.2 + u * p.sway];
  }, coat(), (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  for (let y = waist + 2; y < hem; y++) c.shade(Math.round(hx + 1 + ((y - waist) / (hem - waist)) * p.sway), y, -1);
  if (star()) {
    c.part();
    for (const [dx, dy, b] of [[1, 2, 0], [0, 4, 1], [2, 6, 0], [1, 10, 1], [3, 12, 0]] as const) {
      const y = top + dy;
      const x = hx + dx + (y > waist ? ((y - waist) / (hem - waist)) * p.sway : 0);
      c.px(x, y, STAR_THREAD, sphere(0, -0.2), { glow: b ? 0.7 : 0.3 });
      if (b) c.spark(x, y, hex('#e8f0ff'), 0.6);
    }
  }
  // The waistcoat and cravat at the open front, the lapel.
  c.part();
  c.shape(top, waist + 1, () => [hx - 3.6, hx - 2.4], vest(), (_x, _y, t) => cyl(t, 0.2));
  c.part();
  c.px(hx - 4, top + 1, cravat(), sphere(-0.5, 0));
  c.px(hx - 3, top + 1, cravat(), sphere(0, 0), { bias: 1 });
  c.px(hx - 3, top + 4, metal(), sphere(-0.4, 0));
  c.px(hx - 3, top + 6, metal(), sphere(-0.4, 0));
  c.shade(hx - 2, top + 1, -1);
  c.shade(hx - 2, top + 2, -1);
  c.part();
  c.shape(waist + 1, waist + 1, () => [hx - 3.6, hx + 1], LEATHER, (_x, _y, t) => cyl(t, 0));
  headSide(c, hx, U, p);

  if (!fa.behind) {
    armA(0);
    drawPrism(c, fa, p.prism, p.tick);
  }
  // The near arm last, the cannon in its hand.
  arm(c, hx + 0.2, 16.7 + U, fb, REACH_SIDE, [0.4, 1], 0);
  if (!toolBack) drawCannon(c, fb, td, p.glow, p.glint ?? 0);
}

// ---------------------------------------------------------------------------
// Animations

/** The free hand easy at the side. */
const REST_A = H(0.8, 4.2, -3.2);
/** The cannon carried at the hip, its lens forward. */
const CANNON_B = H(1.6, 4.6, -1.8);
const CANNON_T = H(1, 0.15, -0.15);

/** Side-view hands: a little further forward, both at the body's line. */
const side = (h: Hand, arm: 'a' | 'b'): Hand => H(h.f + (arm === 'b' ? 0.6 : 0.4), 0, h.h);

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: view === 'side' ? side(REST_A, 'a') : { ...REST_A },
  b: view === 'side' ? side(CANNON_B, 'b') : { ...CANNON_B },
  t: { ...CANNON_T },
  glow: 0.15,
  prism: 0,
  sway: 0,
  tick: 0,
});

function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.sway = Math.sin(ph - 1) * 0.5;
    p.tick = f;
    p.blink = f === 4;
    // The lens breathes a little light, the cannon bobs at the hip.
    p.glow = 0.15 + 0.12 * Math.sin(ph);
    p.b.h += Math.sin(ph) * 0.4;
    frames.push(p);
  }
  return frames;
}

function walk(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0;
    p.tick = f;
    if (view === 'side') {
      p.footA = Math.round(s * 2.2);
      p.footB = -p.footA;
      p.lean = 1;
      p.sway = 1 + Math.abs(s) * 0.9;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.7;
    }
    p.a.f -= s * 1.3;
    p.b.h += p.lift * 0.4;
    frames.push(p);
  }
  return frames;
}

interface Key {
  a?: Hand;
  b?: Hand;
  t?: Hand;
  aSide?: Hand;
  bSide?: Hand;
  glow?: number;
  prism?: number;
  lean?: number;
  breath?: number;
  lift?: number;
  step?: number;
  loupe?: number;
}

/** An action as keyframes; anything left out stays at rest. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k, i) => {
      const p = base(view);
      if (k.a) p.a = view === 'side' ? { ...(k.aSide ?? side(k.a, 'a')) } : { ...k.a };
      if (k.b) p.b = view === 'side' ? { ...(k.bSide ?? side(k.b, 'b')) } : { ...k.b };
      if (k.t) p.t = { ...k.t };
      p.glow = k.glow ?? 0.15;
      p.prism = k.prism ?? 0;
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
      p.loupe = k.loupe ?? 0;
      p.tick = i;
      const step = k.step ?? 0;
      if (view === 'side') {
        p.lean = k.lean ?? 0;
        p.footA = 1 + step;
        p.footB = -1 - Math.round(step * 0.5);
        p.sway = Math.max(0, (k.lean ?? 0) * 0.6) + 0.4;
      } else {
        p.footA = step > 0 ? 1 : 0;
        p.sway = (k.lean ?? 0) * -0.4;
      }
      return p;
    });
}

/**
 * The focus beam: the cannon swung up level from the hip, the lens flaring
 * as the ray leaves it (frame 1), a kick back, and down again. The loupe
 * snaps down for the shot.
 */
const focus = action([
  { b: H(2.4, 3.8, 0.4), t: H(1, 0.1, 0.05), glow: 0.6, lean: -1, loupe: 1 },
  { b: H(4, 2.4, 1), t: H(1, 0, 0.05), glow: 1, lean: 1, step: 1, loupe: 1 },
  { b: H(3, 2.8, 1.4), t: H(1, 0, 0.3), glow: 0.55, lean: 0, loupe: 1 },
  { b: H(2.2, 3.8, 0), t: H(1, 0.1, 0), glow: 0.3, loupe: 1 },
]);

/** The prism: drawn from the coat, held up a moment glinting, then tossed underarm. */
const toss = action([
  { a: H(-1, 4.2, 0.6), aSide: H(-1.6, 0, 0.8), prism: 0.5, lean: -1 },
  { a: H(-1.2, 4, 2.6), aSide: H(-1.8, 0, 3), prism: 1, lean: -1 },
  { a: H(4.2, 2.2, 3.2), aSide: H(4.6, 0, 3), lean: 1, step: 1 },
  { a: H(3.6, 2.6, 2), aSide: H(4, 0, 1.8), lean: 1 },
  { a: REST_A },
]);

/**
 * Unveiled, the Special's pose: the cannon raised high at the sky, blazing,
 * the free hand flung out to the side, the loupe snapped down.
 */
const unveil = action([
  { b: H(1, 3.4, 2.6), t: H(0.4, 0.2, 1), a: H(1, 4.6, 0), glow: 0.4, breath: 1, loupe: 1 },
  { b: H(1, 2.8, 5), t: H(0.2, 0.1, 1), a: H(1.6, 5, 1.6), glow: 0.7, loupe: 1 },
  { b: H(1, 2.2, 7.2), t: H(0.1, 0, 1), a: H(2.4, 5.2, 3), glow: 1, lift: 1, loupe: 1 },
  { b: H(1, 2.2, 7.4), t: H(0.1, 0, 1), a: H(2.4, 5.4, 3.4), glow: 1, lift: 1, loupe: 1 },
  { b: H(1, 2.2, 7.2), t: H(0.1, 0, 1), a: H(2.4, 5.2, 3), glow: 0.9, lift: 1, loupe: 1 },
  { b: H(1, 2.4, 7), t: H(0.1, 0, 1), a: H(2.2, 5, 2.6), glow: 0.8, loupe: 1 },
]);

/**
 * The brace, while the Burning Mirror pours: the cannon levelled at the
 * chest and steadied from below by the free hand, sighting along the beam,
 * the lens trembling with light.
 */
function braced(view: View): Pose[] {
  const frames: Pose[] = [];
  for (let f = 0; f < 4; f++) {
    const p = base(view);
    const b = H(3.4, 2.2, 1.4);
    const a = H(3.2, 0.6, 0.4);
    p.b = view === 'side' ? side(b, 'b') : b;
    p.a = view === 'side' ? side(a, 'a') : a;
    p.t = H(1, 0, 0.05);
    p.glow = f % 2 ? 0.85 : 1;
    p.breath = f >= 2 ? 1 : 0;
    p.loupe = 1;
    p.tick = f;
    if (view === 'side') {
      p.lean = 1;
      p.footA = 2;
      p.footB = -2;
      p.sway = 1 + (f % 2) * 0.4;
    } else {
      p.footA = 1;
      p.sway = f % 2 ? 0.3 : -0.3;
    }
    frames.push(p);
  }
  return frames;
}

// ---------------------------------------------------------------------------
// The idle moment (`rest`), played facing us when he has stood still a while.
// It starts and ends on idle's first frame so it slips in and out unseen.

/** Idle's first frame, with changes. */
const still = (o: Partial<Pose> = {}): Pose => ({ ...idle('down')[0], ...o });

/** The cannon held up before his face, lens toward us, for a close look. */
const LOOK_B = H(2.6, 1.6, 1.6);
const LOOK_T = H(1, -0.2, 0.15);

/**
 * He lifts the cannon to inspect its lens, breathes on it, polishes it with
 * a cloth in little circles, flips both loupe lenses down to peer at his
 * work, holds it up to the sky where it catches the light in a glint, gives
 * a satisfied nod, and lets it back down to his hip.
 */
function polish(view: View): Pose[] {
  if (view !== 'down') return [];
  return [
    still(),
    // The cannon up before him, the cloth fished out.
    still({ sway: 0, b: H(2, 2.6, 0.6), t: LOOK_T, a: H(0.4, 4.4, -2.4), cloth: true, tick: 1 }),
    still({ sway: 0, b: LOOK_B, t: LOOK_T, a: H(1.4, 3.6, -0.6), cloth: true, tick: 2 }),
    // A huff of breath on the glass.
    still({ sway: 0, breath: 1, b: H(2.8, 1.2, 2.4), t: LOOK_T, a: H(1.4, 3.6, -0.6), cloth: true, fog: 1, tick: 3 }),
    // Rubbing it: the cloth round the lens one way, then the other.
    still({ sway: 0, b: LOOK_B, t: LOOK_T, a: H(3, 0.6, 2.4), cloth: true, fog: 0.6, tick: 4 }),
    still({ sway: 0, b: LOOK_B, t: LOOK_T, a: H(3, -0.8, 1.6), cloth: true, fog: 0.3, tick: 5 }),
    still({ sway: 0, breath: 1, b: LOOK_B, t: LOOK_T, a: H(3, 0.4, 0.8), cloth: true, tick: 6 }),
    // Both loupe lenses down: a close look.
    still({ sway: 0, b: LOOK_B, t: LOOK_T, a: H(1, 4, -2.4), cloth: true, loupe: 1, tick: 7 }),
    // Up to the sky: the lens catches the light.
    still({ sway: 0, b: H(1.6, 3, 5), t: H(0.3, 0.2, 1), a: H(1, 4, -2.6), cloth: true, loupe: 1, glow: 0.4, tick: 8 }),
    still({ sway: 0, b: H(1.6, 3, 5.4), t: H(0.3, 0.2, 1), a: H(1, 4, -2.6), cloth: true, loupe: 1, glow: 0.6, glint: 1, tick: 9 }),
    still({ sway: 0, b: H(1.6, 3, 5.2), t: H(0.3, 0.2, 1), a: H(1, 4, -2.6), cloth: true, loupe: 1, glow: 0.4, glint: 0.45, tick: 10 }),
    // A satisfied nod, the lenses flipped back up, the cloth away, the cannon back to the hip.
    still({ breath: 1, sway: 0, b: H(1.8, 4, 0.2), t: H(1, 0.1, 0), a: H(0.2, 4.4, -2.2), blink: true, tick: 11 }),
    still({ sway: -0.2, b: H(1.6, 4.4, -1.2), tick: 12 }),
  ];
}
const POLISH_ORDER = [0, 1, 2, 2, 3, 3, 4, 5, 6, 4, 5, 6, 7, 7, 7, 8, 9, 9, 10, 8, 11, 11, 12, 0];

// ---------------------------------------------------------------------------
// Frame generation

export type LightwrightAnim = 'idle' | 'walk' | 'focus' | 'toss' | 'unveil' | 'brace' | 'rest';

export interface LightwrightAnimDef {
  name: LightwrightAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Frames played in this order, some held or repeated. */
  order?: readonly number[];
}

export const LIGHTWRIGHT_ANIMS: LightwrightAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'focus', fps: 14, loop: false, poses: focus },
  { name: 'toss', fps: 13, loop: false, poses: toss },
  { name: 'unveil', fps: 10, loop: false, poses: unveil },
  { name: 'brace', fps: 8, loop: true, poses: braced },
  { name: 'rest', fps: 8, loop: false, poses: polish, order: POLISH_ORDER },
];

/** Frame index at which each action lands. */
export const LIGHTWRIGHT_RELEASE = { focus: 1, toss: 2 } as const;

export interface LightwrightFrame {
  key: string;
  anim: LightwrightAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(LW_W, LW_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildLightwrightFrames(look: LightwrightLook = LIGHTWRIGHT_LOOK): LightwrightFrame[] {
  S = look;
  const out: LightwrightFrame[] = [];
  for (const a of LIGHTWRIGHT_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawFrame(dir, pose) });
      });
    }
  }
  S = LIGHTWRIGHT_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// The prism, hovering and turning ('lw_prism_<look>', frames 'p0'..'p7')

export const PRISM_SIZE = 14;
export const PRISM_FRAMES = 8;

/**
 * One frame of the thrown prism turning about its upright axis: a wedge of
 * glass, apex up, seen as a triangle whose two visible faces trade places
 * as it turns (the lit one on the side facing the light), a metal foot
 * under it, and the spectrum glinting down the edge between the faces.
 */
export function prismFrame(f: number, look: LightwrightLook): PixelCanvas {
  const c = new PixelCanvas(PRISM_SIZE, PRISM_SIZE);
  const g = look.star ? PRISM_STAR : PRISM_GLASS;
  const m = look.star ? SILVER : BRASS;
  const cx = 7;
  const top = 1;
  const bot = 11;
  const half = 4.6;
  // Where the front edge stands across the face, -1..1, sweeping round as it turns.
  const a = (f / PRISM_FRAMES) * Math.PI * 2;
  const ridge = Math.sin(a) * 0.8;
  const row = (y: number) => ((y + 0.5 - top) / (bot + 1 - top)) * half;
  // The left face, then the right: each lit by which way it leans.
  c.part();
  c.shape(top, bot, (y) => {
    const w = row(y);
    return [cx - w, cx + ridge * w];
  }, g, (_x, y, t) => sphere(-0.55 + t * 0.2, ((y - top) / (bot - top)) * 0.5 - 0.15, 1), { glow: 0.35 });
  c.part();
  c.shape(top, bot, (y) => {
    const w = row(y);
    return [cx + ridge * w, cx + w];
  }, g, (_x, y, t) => sphere(0.45 + t * 0.2, ((y - top) / (bot - top)) * 0.5 - 0.15, 1), { glow: 0.3 });
  // The metal foot it stands in.
  c.part();
  c.shape(bot + 1, bot + 1, () => [cx - half - 0.4, cx + half + 0.4], m, (_x, _y, t) => cyl(t, 0.4));
  // The spectrum down the front edge, the white light at the apex.
  const sp = look.spectrum;
  for (let y = top + 2; y <= bot; y++) c.spark(cx + ridge * row(y), y, sp[(y + f) % sp.length], 0.8);
  c.spark(cx, top + 1, look.light[0], 0.9);
  c.spark(cx, top, look.light[1], 0.6);
  return c;
}

// ---------------------------------------------------------------------------
// Button icons

const SUN_TONES: Tones = [hex('#fffdf0'), hex('#fff0b0'), hex('#ffc85a'), hex('#a8661a')];
const STAR_TONES: Tones = [hex('#f4fbff'), hex('#c8e4ff'), hex('#8ab8ff'), hex('#3a46b0')];

/** The focus beam: the lens cannon on a diagonal, a ray of light leaving its lens to a burst. */
export function focusIcon(look: LightwrightLook): Uint8ClampedArray {
  const t = look.star ? STAR_TONES : SUN_TONES;
  const metalLit: RGB = look.star ? hex('#c4cadf') : hex('#dcae4a');
  const metalDk: RGB = look.star ? hex('#4b5068') : hex('#6a4418');
  return icon16((put) => {
    // The tube, its band and the lens's rim.
    seg(put, 1, 14, 5, 10, metalDk);
    seg(put, 1, 13, 5, 9, metalLit);
    seg(put, 2, 14, 6, 10, metalDk);
    for (const [x, y] of [[5, 8], [6, 8], [7, 9], [7, 10], [6, 11]] as const) put(x, y, metalLit);
    put(6, 9, t[0]);
    put(6, 10, t[1]);
    // The ray, widening to a burst where it strikes.
    seg(put, 7, 8, 12, 3, t[0]);
    seg(put, 8, 8, 12, 4, t[1]);
    seg(put, 7, 7, 11, 3, t[2]);
    for (const [x, y, k] of [[13, 2, 0], [14, 2, 1], [13, 1, 1], [12, 2, 1], [13, 3, 1], [15, 2, 2], [13, 0, 2], [11, 2, 2], [13, 4, 2], [15, 0, 3], [11, 0, 3], [15, 4, 3]] as const) put(x, y, t[k]);
  });
}

/** The prism: a wedge of glass with a white ray in one side and the spectrum fanning out of the other. */
export function prismIcon(look: LightwrightLook): Uint8ClampedArray {
  const t = look.star ? STAR_TONES : SUN_TONES;
  const glassLit: RGB = look.star ? hex('#c8c4ff') : hex('#d8ecff');
  const glassDk: RGB = look.star ? hex('#4a4aa8') : hex('#5a7aa0');
  return icon16((put) => {
    // The ray coming in.
    seg(put, 0, 9, 5, 8, t[0]);
    seg(put, 0, 10, 5, 9, t[2]);
    // The prism: a triangle, lit on its left face.
    for (let y = 3; y <= 13; y++) {
      const hw = (y - 3) * 0.48;
      for (let x = Math.round(7 - hw); x <= Math.round(7 + hw); x++) put(x, y, x < 7 ? glassLit : x === 7 ? t[0] : glassDk);
    }
    // The spectrum fanning out to the right.
    look.spectrum.forEach((c, i) => seg(put, 10, 8 + i * 0.3, 15, 4 + i * 1.6, c));
  });
}

// ---------------------------------------------------------------------------

/** The prisms and the buttons, through the registrar (see textures.ts). */
export function lightwrightFx(reg: FxRegistrar): void {
  for (const look of LIGHTWRIGHT_LOOKS) {
    const key = `lw_prism_${look.key}`;
    reg.frames(key, Array.from({ length: PRISM_FRAMES }, (_, i) => ({ name: `p${i}`, canvas: prismFrame(i, look) })), PRISM_SIZE, PRISM_SIZE);
    reg.image(`icon_focus_${look.key}`, 16, 16, focusIcon(look));
    reg.image(`icon_prism_${look.key}`, 16, 16, prismIcon(look));
  }
}
