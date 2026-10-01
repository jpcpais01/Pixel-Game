// The Inventor, drawn procedurally from a small rig like the chronomancer's.
//
// The engineer: a stocky tradesman in a yellow hard hat with a lamp on its
// brow, a big friendly moustache, a rust work shirt with the sleeves rolled
// up, denim overalls with brass buttons, a leather tool belt hung with
// pouches, heavy boots and leather gloves. A red toolbox rides on his back
// and a great red pipe wrench rests on his shoulder.
//
// The scientist is the class's other type on the same rig: a young
// experimenter in a long white lab coat over a teal shirt and a red bow tie,
// pens in the breast pocket, orange rubber gloves, messy dark hair and brass
// goggles pushed up on the brow. In one hand, a Tesla gun: a brass barrel
// wound with copper coils and a glass bulb at its tip that crackles.
//
// Einstein is a skin of the scientist: the wild white hair, the bushy brows
// and great white moustache, a baggy brown cardigan over a white shirt, and a
// stick of chalk glowing at its tip where the Tesla gun was. When he makes
// his discovery he sticks out his tongue.
//
// The body keeps to the 24x32 box; frames are larger so the wrench and the
// raised arms fit. Hands are posed in the rig's own terms (forward, out to the
// side, height) and placed per view; so is the direction the tool points.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { BOOT, EYE, LEATHER, SKIN } from './palette';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

export const INV_W = 48;
export const INV_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const INV_ORIGIN_X = BODY_X + 12;
export const INV_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet that arcs leave the gadget and crates the hand. */
export const INV_HAND_Y = 15;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#120e1f');

// ---------------------------------------------------------------------------
// Materials

export const HARD_HAT: Material = { ramp: ramp('#5a3606', '#9e660c', '#dca218', '#f6cc3c', '#fff09c'), outline: hex('#241402'), outlineLit: hex('#3a2206'), shine: true };
export const DENIM: Material = { ramp: ramp('#0e1832', '#1a2c58', '#2a4684', '#4064aa', '#6488cc'), outline: INK, outlineLit: hex('#141c38') };
export const WORK_SHIRT: Material = { ramp: ramp('#3a1408', '#682410', '#9e3e1a', '#cc662e', '#ec9658'), outline: hex('#1a0804'), outlineLit: hex('#2a1008') };
const PIPE_RED: Material = { ramp: ramp('#360606', '#6a1212', '#a82222', '#dc4636', '#f8826a'), outline: hex('#180202'), shine: true };
export const STEEL: Material = { ramp: ramp('#22262f', '#444a5a', '#737d93', '#aab4c8', '#e8eef8'), outline: hex('#0c0e14'), shine: true };
export const BRASS: Material = { ramp: ramp('#3a2210', '#6a4418', '#a8742a', '#dcae4a', '#fff0b0'), outline: hex('#1e1006'), shine: true, noAO: true };
const COPPER: Material = { ramp: ramp('#2a1208', '#4e2210', '#7a3a1a', '#b0602c', '#e09050'), outline: hex('#140804'), shine: true };
export const MOUSTACHE: Material = { ramp: ramp('#2a1406', '#4c2810', '#784220', '#a0643a'), outline: hex('#140a04') };
const LAMP: Material = { ramp: ramp('#b88838', '#ffe6a0', '#fffbe8'), outline: hex('#4a3410'), emissive: 1, noAO: true };
const CRATE: Material = { ramp: ramp('#2e1a0c', '#523018', '#7a4c26', '#a4703c'), outline: hex('#140a04') };

const LAB_COAT: Material = { ramp: ramp('#4e505c', '#888c9a', '#bbbfcb', '#e0e4ee', '#fafcff'), outline: hex('#16181f'), outlineLit: hex('#2a2c36') };
const TEAL: Material = { ramp: ramp('#061c1a', '#0c3632', '#14524a', '#1e7064'), outline: INK };
const SLACKS: Material = { ramp: ramp('#15151c', '#25252f', '#383846', '#50505f'), outline: INK };
const GLOVE: Material = { ramp: ramp('#4a1804', '#883208', '#cc5c0e', '#f68c2a', '#ffc070'), outline: hex('#1e0a02'), shine: true };
const BOW_TIE: Material = { ramp: ramp('#38060c', '#6c0e18', '#aa1c28', '#dc3a44'), outline: hex('#160204') };
const DARK_HAIR: Material = { ramp: ramp('#100a08', '#221612', '#38261c', '#523e2c'), outline: hex('#060404') };
export const LENS: Material = { ramp: ramp('#0a4a66', '#1a90c0', '#50d4f8', '#b0f4ff'), outline: hex('#041c28'), emissive: 0.45, noAO: true, shine: true };
const BULB: Material = { ramp: ramp('#2a4a66', '#5a8eb4', '#a8e0ff', '#eaffff'), outline: hex('#0c1c2a'), emissive: 0.7, noAO: true, shine: true };

const WILD_HAIR: Material = { ramp: ramp('#686c7c', '#a0a4b2', '#d2d6e0', '#f6f8ff'), outline: hex('#26283a'), outlineLit: hex('#3c3e52') };
const CARDIGAN: Material = { ramp: ramp('#1e1914', '#3a3028', '#5a4c3e', '#7a6a56', '#9a8a72'), outline: hex('#0c0a08'), outlineLit: hex('#1a1612') };
const WHITE_SHIRT: Material = { ramp: ramp('#6c6e7a', '#acaeba', '#dadce4', '#f8f8fc'), outline: hex('#20222c') };
const OLD_TROUSER: Material = { ramp: ramp('#131317', '#23232b', '#35353e', '#494955'), outline: INK };
const CHALK: Material = { ramp: ramp('#8a8a92', '#cacad2', '#f4f4fa'), outline: hex('#2a2a32') };
const TONGUE: Material = { ramp: ramp('#6a1a2a', '#b83a50', '#e86a7a'), outline: hex('#2a0810') };

// ---------------------------------------------------------------------------
// Looks

export type InventorKind = 'engineer' | 'scientist';

export interface InventorLook {
  key: string;
  kind: InventorKind;
  /** The scientist's Einstein skin. */
  einstein?: boolean;
  /** Light of the gadget (the hat lamp's for the engineer), brightest first. */
  light: [RGB, RGB, RGB, RGB];
}

export const ENGINEER_LOOK: InventorLook = { key: 'engineer', kind: 'engineer', light: [hex('#fffbe8'), hex('#ffe6a0'), hex('#ffc050'), hex('#b8701e')] };
export const SCIENTIST_LOOK: InventorLook = { key: 'scientist', kind: 'scientist', light: [hex('#f0ffff'), hex('#a8f4ff'), hex('#40d0ff'), hex('#1a6ab0')] };
export const EINSTEIN_LOOK: InventorLook = { key: 'scientist_einstein', kind: 'scientist', einstein: true, light: [hex('#fffdf0'), hex('#fff0b0'), hex('#ffd060'), hex('#c08020')] };
export const INVENTOR_LOOKS = [ENGINEER_LOOK, SCIENTIST_LOOK, EINSTEIN_LOOK];

/** The look being drawn; set by buildInventorFrames. */
let S: InventorLook = ENGINEER_LOOK;

const eng = () => S.kind === 'engineer';
const ein = () => !!S.einstein;
const handMat = (): Material => (eng() ? LEATHER : ein() ? SKIN : GLOVE);
const trouser = (): Material => (eng() ? DENIM : ein() ? OLD_TROUSER : SLACKS);

// ---------------------------------------------------------------------------
// The rig

/** A hand (or the way a tool points), in the rig's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
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
  /** The free hand and the tool hand. */
  a: Hand;
  b: Hand;
  /** Which way the tool points from the tool hand. */
  t: Hand;
  /** 0..1 the gadget (or the hat lamp) lit. */
  glow: number;
  /** 0..1 a crackling orb held in the free hand (the scientist's throw). */
  orb: number;
  /** A crate held in the free hand (the engineer's build). */
  crate: boolean;
  /** The coat's hem swinging, in pixels. */
  sway: number;
  tick: number;
  blink?: boolean;
  /** Einstein's famous tongue. */
  tongue?: boolean;
  // The idle moment's extras (front view only).
  /** Pixels the body sinks as he goes down on one knee (0 standing, KNEEL_DROP down). */
  kneel?: number;
  /** A little brass gizmo in the free hand, its lamp lit 0..1; left out when not held. */
  gizmo?: number;
  /** 0..1 sparks flying off the wrench's head. */
  sparks?: number;
  /** 0..1 the hair standing on end with static, and 0..1 the static crackling in it. */
  poof?: number;
  crackle?: number;
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

/** The tool's direction on screen, foreshortened when it points at or away from the viewer; also whether it dips behind the body. */
function toolDir(view: View, t: Hand): { x: number; y: number; k: number; away: boolean } {
  const l = Math.hypot(t.f, t.s, t.h) || 1;
  const f = t.f / l;
  const s = t.s / l;
  const h = t.h / l;
  let x: number;
  let y: number;
  let away: boolean;
  if (view === 'down') {
    x = s;
    y = -h + f * 0.55;
    away = f < -0.35;
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
  return { x: x / n, y: y / n, k, away };
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
 * An arm: the engineer's rolled shirt sleeve over a bare forearm, the
 * scientist's coat sleeve with a rubber glove to the wrist, Einstein's baggy
 * cardigan sleeve; then the hand.
 */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bias = 0): void {
  const [ex, ey] = elbow(sx, sy, p.x, p.y, reach, hint);
  const wx = ex + (p.x - ex) * 0.7;
  const wy = ey + (p.y - ey) * 0.7;
  if (eng()) {
    c.part();
    c.capsule(sx, sy, ex, ey, 1.9, 1.6, WORK_SHIRT, { bias });
    c.part();
    // The rolled cuff, then the forearm.
    c.ellipse(ex, ey, 1.6, 1.3, WORK_SHIRT, { bias: bias + 1 });
    c.part();
    c.capsule(ex, ey, wx, wy, 1.35, 1.2, SKIN, { bias });
  } else {
    const sleeve = ein() ? CARDIGAN : LAB_COAT;
    c.part();
    c.capsule(sx, sy, ex, ey, 1.8, 1.6, sleeve, { bias });
    c.part();
    c.capsule(ex, ey, wx, wy, 1.6, ein() ? 1.7 : 1.5, sleeve, { bias });
    if (!ein()) {
      c.part();
      c.ellipse(wx, wy, 1.2, 1.0, GLOVE, { bias });
    }
  }
  c.part();
  c.ellipse(p.x, p.y, 1.2, 1.15, handMat(), { bias });
}

/** Boots: the engineer's heavy work boots with steel toes, or plain shoes. */
function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (eng()) {
    c.ellipse(x, y, side ? 2.4 : 1.9, 1.35, BOOT, { flatten: 0.8, bias });
    c.part();
    if (side) c.px(x - 2, y, STEEL, sphere(-0.5, 0.2), { bias });
    else c.px(x - 0.5, y + 0.6, STEEL, sphere(0, 0.4), { bias });
  } else c.ellipse(x, y, side ? 2.1 : 1.6, 1.2, BOOT, { flatten: 0.8, bias });
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
  if (k > 0.6) for (const [dx, dy] of [[2, 0], [-2, 0], [0, -2], [0, 2]]) c.spark(x + dx, y + dy, mid, 0.4 * k);
}

// ---------------------------------------------------------------------------
// Tools

/**
 * What the tool hand holds, pointing along (ux, uy) from the hand: the
 * engineer's pipe wrench (a red handle, a steel head with its hooked jaw),
 * the scientist's Tesla gun (a brass barrel, copper coils, a glass bulb that
 * crackles), or Einstein's glowing chalk. The hand is drawn again over the grip.
 */
function drawTool(c: PixelCanvas, p: Placed, d: { x: number; y: number; k: number }, glow: number, tick: number, bias = 0): void {
  const { x: ux, y: uy, k } = d;
  const vx = -uy;
  const vy = ux;
  const hx = p.x;
  const hy = p.y;
  if (eng()) {
    const len = 9.5 * k;
    c.part();
    c.capsule(hx - ux * 1.6, hy - uy * 1.6, hx + ux * (len - 2), hy + uy * (len - 2), 0.75, 0.7, PIPE_RED, { bias });
    const ex = hx + ux * (len - 1.2);
    const ey = hy + uy * (len - 1.2);
    // The head: a steel block across the handle, the fixed jaw hooking forward over the adjusting nut.
    c.part();
    c.capsule(ex - vx * 1.8, ey - vy * 1.8, ex + vx * 1.3, ey + vy * 1.3, 1.1, 1.0, STEEL, { bias });
    c.part();
    c.capsule(ex - vx * 1.8, ey - vy * 1.8, ex - vx * 1.5 + ux * 1.8, ey - vy * 1.5 + uy * 1.8, 0.75, 0.6, STEEL, { bias });
    c.px(ex + vx * 0.4 - ux * 0.6, ey + vy * 0.4 - uy * 0.6, BRASS, sphere(0, 0), { bias });
  } else if (ein()) {
    const len = 3.2 * k + 0.6;
    c.part();
    c.line(hx, hy, hx + ux * len, hy + uy * len, CHALK, () => sphere(vx * 0.5, vy * 0.5 - 0.2), { bias });
    const tx = hx + ux * (len + 0.6);
    const ty = hy + uy * (len + 0.6);
    const [core, hot] = S.light;
    c.spark(tx, ty, core, 0.5 + glow * 0.5);
    c.spark(tx + ux, ty + uy, hot, 0.3 + glow * 0.4);
    if (glow > 0.5) glowAt(c, tx, ty, (glow - 0.5) * 1.8);
  } else {
    const len = 5.2 * k;
    c.part();
    // The grip under the hand, then the barrel.
    c.capsule(hx - vx * 0.2 + ux * 0.2, hy - vy * 0.2 + uy * 0.2, hx + vx * 1.4 - ux * 0.4, hy + vy * 1.4 - uy * 0.4, 0.7, 0.6, COPPER, { bias });
    c.part();
    c.capsule(hx - ux * 1.2, hy - uy * 1.2, hx + ux * len, hy + uy * len, 1.0, 0.8, BRASS, { bias });
    // Copper coils wound round it.
    c.part();
    for (const q of [0.35, 0.6, 0.85]) {
      const cx = hx + ux * len * q;
      const cy = hy + uy * len * q;
      c.px(cx + vx * 0.9, cy + vy * 0.9, COPPER, sphere(vx * 0.6, vy * 0.6), { bias });
      c.px(cx - vx * 0.9, cy - vy * 0.9, COPPER, sphere(-vx * 0.6, -vy * 0.6), { bias: bias - 1 });
    }
    const bx = hx + ux * (len + 1.2);
    const by = hy + uy * (len + 1.2);
    c.part();
    c.ellipse(bx, by, 1.35, 1.3, BULB, { bias, glow: 0.5 + glow * 0.5 });
    const [core, hot, mid] = S.light;
    c.spark(bx, by, core, 0.4 + glow * 0.6);
    // Little arcs crackling round the bulb.
    if (glow > 0.2) {
      const a = (tick % 4) * (Math.PI / 2) + 0.4;
      c.spark(bx + Math.round(Math.cos(a) * 2), by + Math.round(Math.sin(a) * 2), hot, glow);
      c.spark(bx + Math.round(Math.cos(a + 2.4) * 2.4), by + Math.round(Math.sin(a + 2.4) * 2.4), mid, glow * 0.8);
      if (glow > 0.6) glowAt(c, bx, by, (glow - 0.6) * 2);
    }
  }
  c.part();
  c.ellipse(hx, hy, 1.2, 1.15, handMat(), { bias });
}

/** The crate the engineer tosses: a little wooden box banded in hazard yellow. */
function drawCrate(c: PixelCanvas, p: Placed): void {
  c.part();
  c.shape(Math.round(p.y - 3), Math.round(p.y + 1), () => [p.x - 2.6, p.x + 2.6], CRATE, (_x, y, t) => sphere(t * 0.8, (y - p.y + 1) / 3, 1));
  c.part();
  for (let x = Math.round(p.x - 2.6); x < p.x + 2.6; x++) c.px(x, Math.round(p.y - 1), HARD_HAT, cyl(0, 0));
  c.part();
  c.ellipse(p.x, p.y + 0.5, 1.2, 1.1, handMat());
}

/** The scientist's thrown orb, crackling in the free hand. */
function drawOrb(c: PixelCanvas, p: Placed, k: number, tick: number): void {
  if (k <= 0) return;
  const [core, hot, mid, deep] = S.light;
  const y = p.y - 2;
  c.spark(p.x, y, core, k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(p.x + dx, y + dy, hot, 0.8 * k);
  for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) c.spark(p.x + dx, y + dy, mid, 0.6 * k);
  const a = (tick % 6) * 1.05;
  c.spark(p.x + Math.round(Math.cos(a) * 2.5), y + Math.round(Math.sin(a) * 2), deep, 0.8 * k);
}

// ---------------------------------------------------------------------------
// Heads

/** The engineer from the front: hard hat with its lamp, sideburns, the big moustache. */
function engineerDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  c.part();
  c.ellipse(cx, 12.4 + U, 3.3, 3.0, SKIN);
  // Ears and sideburns under the brim.
  c.part();
  c.px(cx - 4, 12 + U, SKIN, cyl(-0.8, 0));
  c.px(cx + 3, 12 + U, SKIN, cyl(0.8, 0));
  c.px(cx - 4, 11 + U, MOUSTACHE, cyl(-0.8, 0));
  c.px(cx + 3, 11 + U, MOUSTACHE, cyl(0.8, 0));
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
  c.part();
  c.px(cx - 1, 13 + U, SKIN, sphere(-0.2, -0.4), { bias: 1 });
  c.px(cx, 13 + U, SKIN, sphere(0.3, -0.3));
  // The moustache: a broad brush, drooping at the ends.
  c.part();
  for (let x = cx - 3; x <= cx + 2; x++) c.px(x, 14 + U, MOUSTACHE, sphere((x + 0.5 - cx) / 3.5, -0.3));
  c.px(cx - 3, 15 + U, MOUSTACHE, sphere(-0.7, 0.3));
  c.px(cx + 2, 15 + U, MOUSTACHE, sphere(0.7, 0.3));
  hardHat(c, cx, U, p.glow, 'down');
}

/** The hard hat: a dome with a ridge down its crown, a brim all round, and a lamp on the brow. */
function hardHat(c: PixelCanvas, cx: number, U: number, glow: number, view: View, hx = cx): void {
  c.part();
  const x0 = view === 'side' ? hx - 0.4 : cx;
  const widths = [2.4, 3.4, 3.8, 4.0];
  c.shape(Math.round(6 + U), Math.round(9 + U), (y) => {
    const w = widths[Math.min(3, Math.max(0, y - Math.round(6 + U)))];
    return [x0 - w, x0 + w];
  }, HARD_HAT, (_x, y, t) => sphere(t * 0.9, (y - 6 - U) / 4 - 0.8, 1));
  // The ridge.
  if (view !== 'side') for (let y = 6; y <= 9; y++) c.shade(Math.round(x0 - 0.5), y + U, 1);
  // The brim: all round from the front and back, jutting forward as a peak in profile.
  c.part();
  if (view === 'side') c.shape(Math.round(10 + U), Math.round(10 + U), () => [hx - 5.6, hx + 4.2], HARD_HAT, (_x, _y, t) => cyl(t, 0.6), { bias: -1 });
  else c.shape(Math.round(10 + U), Math.round(10 + U), () => [cx - 4.7, cx + 4.7], HARD_HAT, (_x, _y, t) => cyl(t, 0.6), { bias: -1 });
  if (view === 'up') return;
  // The lamp.
  c.part();
  const lx = view === 'side' ? hx - 4.2 : cx - 1;
  c.px(lx, 8 + U, LAMP);
  if (view === 'down') c.px(lx + 1, 8 + U, LAMP);
  const [core, hot] = S.light;
  const k = 0.45 + glow * 0.55;
  c.spark(lx, 8 + U, core, k);
  if (view === 'down') c.spark(lx + 1, 8 + U, core, k);
  c.spark(lx + (view === 'side' ? -1 : 0), 7 + U, hot, 0.3 * k);
}

/** The scientist from the front: messy dark hair, brass goggles on the brow, a small smile. */
function scientistDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const k = p.poof ?? 0;
  c.part();
  // Hair behind the face, framing it; static makes it stand out in a ball.
  c.ellipse(cx - 0.3 * k, 10.6 + U - 1.3 * k, 3.9 + 1.5 * k, 3.4 + 1.7 * k, DARK_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.4, 1) });
  if (k > 0) staticSpikes(c, cx - 0.3, 10.2 + U - 1.3 * k, 4.6 + 1.5 * k, 3.9 + 1.7 * k, k, DARK_HAIR, p);
  c.part();
  c.ellipse(cx, 12.6 + U, 3.2, 2.9, SKIN);
  // A messy fringe, and tufts sticking up.
  c.part();
  for (const [x, y] of [[cx - 3, 10], [cx - 2, 10], [cx, 10], [cx + 2, 10], [cx - 1, 6], [cx + 1, 6], [cx + 3, 7], [cx - 4, 7]] as const) c.px(x, y + U, DARK_HAIR, sphere((x - cx) / 4, -0.6));
  goggles(c, cx, 9.6 + U);
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
  c.part();
  c.px(cx - 1, 13 + U, SKIN, sphere(-0.2, -0.4), { bias: 1 });
  c.shade(cx - 1, 14 + U, -1);
  c.shade(cx, 14 + U, -1);
}

/**
 * Hair standing on end: spikes all round the top of the head, a spark of
 * static at a few of their tips while it crackles.
 */
function staticSpikes(c: PixelCanvas, x: number, y: number, rx: number, ry: number, k: number, m: Material, p: Pose): void {
  c.part();
  const N = 11;
  for (let i = 0; i < N; i++) {
    const a = Math.PI * (0.95 + (1.1 * i) / (N - 1));
    const long = (i + p.tick) % 3 === 0 ? 1 : 0;
    const r0x = rx - 0.8;
    const r0y = ry - 0.8;
    const r1 = 0.8 + (1.1 + long * 0.7) * k;
    const tx = x + Math.cos(a) * (r0x + r1);
    const ty = y + Math.sin(a) * (r0y + r1);
    c.line(x + Math.cos(a) * r0x, y + Math.sin(a) * r0y, tx, ty, m, () => sphere(Math.cos(a) * 0.8, Math.sin(a) * 0.8 - 0.2), { bias: i % 2 });
    if ((p.crackle ?? 0) > 0 && (i + p.tick) % 4 === 1) c.spark(tx, ty - 0.5, S.light[1], p.crackle!);
  }
}

/** Brass goggles pushed up on the brow, their lenses catching the light. */
function goggles(c: PixelCanvas, cx: number, y: number): void {
  c.part();
  c.shape(Math.round(y), Math.round(y), () => [cx - 4, cx + 4], BRASS, (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
  c.part();
  for (const x of [cx - 2.5, cx + 1.5]) {
    c.ellipse(x, y, 1.4, 1.2, BRASS);
    c.px(x - 0.5, y - 0.5, LENS, sphere(-0.3, 0.4));
  }
}

/** Einstein from the front: the white hair in a wild cloud, bushy brows, the great moustache (and the tongue). */
function einsteinDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  wildHair(c, cx, U, p.tick, 'down', cx, p.poof ?? 0);
  if ((p.poof ?? 0) > 0) staticSpikes(c, cx, 9.4 + U - 1.2 * (p.poof ?? 0), 5.6 + 1.2 * (p.poof ?? 0), 3.8 + 1.4 * (p.poof ?? 0), p.poof ?? 0, WILD_HAIR, p);
  c.part();
  c.ellipse(cx, 12.5 + U, 3.2, 3.0, SKIN);
  // Bushy brows.
  c.part();
  for (const x of [cx - 3, cx - 2, cx + 1, cx + 2]) c.px(x, 11 + U, WILD_HAIR, sphere(0, -0.6));
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
  c.part();
  c.px(cx - 1, 13 + U, SKIN, sphere(-0.2, -0.4), { bias: 1 });
  c.px(cx, 13 + U, SKIN, sphere(0.3, -0.3));
  c.part();
  for (let x = cx - 3; x <= cx + 2; x++) c.px(x, 14 + U, WILD_HAIR, sphere((x + 0.5 - cx) / 3.5, -0.2));
  c.px(cx - 3, 15 + U, WILD_HAIR, sphere(-0.7, 0.3));
  c.px(cx + 2, 15 + U, WILD_HAIR, sphere(0.7, 0.3));
  if (p.tongue) {
    c.part();
    c.px(cx - 1, 15 + U, TONGUE, sphere(-0.3, 0));
    c.px(cx, 15 + U, TONGUE, sphere(0.3, 0));
    c.px(cx - 1, 16 + U, TONGUE, sphere(0, 0.6));
    c.px(cx, 16 + U, TONGUE, sphere(0.2, 0.6), { bias: -1 });
  }
}

/** Einstein's hair: great puffs over the ears and a thinner cloud on top, stray wisps springing out as he moves. */
function wildHair(c: PixelCanvas, cx: number, U: number, tick: number, view: View, hx = cx, poof = 0): void {
  const k = poof;
  c.part();
  const n = (_x: number, _y: number, dx: number, dy: number) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1);
  if (view === 'side') {
    c.ellipse(hx + 1.6, 11.2 + U, 3.2, 3.6, WILD_HAIR, { normal: n });
    c.ellipse(hx, 8.6 + U, 3.2, 2.1, WILD_HAIR, { normal: n });
  } else {
    c.ellipse(cx - 3.8 - 1.1 * k, 11 + U - 0.6 * k, 2.4 + 0.8 * k, 2.8 + 0.8 * k, WILD_HAIR, { normal: n });
    c.ellipse(cx + 3.8 + 1.1 * k, 11 + U - 0.6 * k, 2.4 + 0.8 * k, 2.8 + 0.8 * k, WILD_HAIR, { normal: n });
    c.ellipse(cx, 8.6 + U - 1.3 * k, 3.8 + 1.4 * k, 2.2 + 1.4 * k, WILD_HAIR, { normal: n });
    if (view === 'up') c.ellipse(cx, 11.6 + U, 3.6, 3.2, WILD_HAIR, { normal: n });
  }
  // Tufts and wisps: which ones spring up changes frame to frame.
  c.part();
  const x0 = view === 'side' ? hx + 1 : cx;
  const wisps: [number, number][] = [[-6, 9], [5, 8], [-3, 6], [2, 6], [-5, 13], [5, 12], [0, 5], [6, 10]];
  wisps.forEach(([dx, dy], i) => {
    if ((i + tick) % 3 === 0) return;
    c.px(x0 + dx * (1 + 0.3 * k), dy + U - k * (dy < 11 ? 2 : 0.8), WILD_HAIR, sphere(dx / 6, -0.5), { bias: i % 2 });
  });
  for (const s of [-1, 1]) c.shade(Math.round(x0 + s * 3), Math.round(11 + U), -1);
}

// ---------------------------------------------------------------------------
// Bodies (front and back)

/** The engineer's body from the front or back: work shirt, overalls with brass buttons, tool belt and pouches. */
function engineerBody(c: PixelCanvas, cx: number, U: number, L: number, back: boolean): void {
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist, (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 5.1 - 1.0 * u * u;
    return [cx - hw, cx + hw];
  }, WORK_SHIRT, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  // Hips and seat of the overalls.
  c.part();
  c.shape(waist, Math.round(24 + L), () => [cx - 4.3, cx + 4.3], DENIM, (_x, _y, t) => cyl(t, 0.1));
  if (back) {
    // The straps crossing between the shoulder blades.
    c.part();
    c.line(cx - 3.5, top, cx + 2.5, waist - 1, DENIM, () => sphere(0, -0.2));
    c.line(cx + 2.5, top, cx - 3.5, waist - 1, DENIM, () => sphere(0, -0.2));
  } else {
    // The bib, its straps over the shoulders, a brass button at each corner and a pocket.
    c.part();
    c.shape(Math.round(18 + U), waist, (y) => {
      const u = (y - 18 - U) / 4;
      const hw = 3.0 + u * 0.4;
      return [cx - hw, cx + hw];
    }, DENIM, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6 - 0.2, 1));
    c.part();
    for (const s of [-1, 1]) {
      const x = s < 0 ? cx - 3 : cx + 2;
      c.line(x - s * 0.6, top, x, 18 + U, DENIM, () => sphere(s * 0.3, -0.4));
    }
    c.part();
    c.px(cx - 3, 18 + U, BRASS, sphere(-0.3, 0));
    c.px(cx + 2, 18 + U, BRASS, sphere(0.3, 0));
    c.shade(cx - 1, 20 + U, -1);
    c.shade(cx, 20 + U, -1);
    c.shade(cx - 2, 20 + U, -1);
    c.shade(cx + 1, 20 + U, -1);
  }
  // The tool belt, a pouch at each hip, a hammer hanging from one.
  c.part();
  c.shape(waist + 1, waist + 1, () => [cx - 4.8, cx + 4.8], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  for (const px of [cx - 4.6, cx + 3.6]) c.shape(waist + 1, waist + 3, () => [px - 1, px + 1.6], LEATHER, (_x, _y, t) => cyl(t, 0.2), { bias: 1 });
  if (!back) {
    c.part();
    c.px(cx - 1, waist + 1, BRASS, sphere(0, 0));
    c.px(cx, waist + 1, BRASS, sphere(0.3, 0));
    c.line(cx + 4.4, waist + 2, cx + 4.8, waist + 5, CRATE, () => sphere(0.3, 0));
    c.px(cx + 4, waist + 2, STEEL, sphere(0.2, -0.3));
  }
}

/** The red toolbox strapped to the engineer's back (seen from behind). */
function toolbox(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.shape(Math.round(16 + U), Math.round(21 + U), () => [cx - 3.8, cx + 3.8], PIPE_RED, (_x, y, t) => sphere(t * 0.8, (y - 16 - U) / 5 - 0.5, 1));
  c.part();
  // The lid's seam, the latch, and the handle on top.
  for (let x = Math.round(cx - 3.8); x < cx + 3.8; x++) c.shade(x, Math.round(17 + U), -1);
  c.px(cx - 1, 18 + U, STEEL, sphere(0, 0));
  c.px(cx, 18 + U, STEEL, sphere(0.3, 0));
  c.line(cx - 2, 15 + U, cx + 1, 15 + U, STEEL, () => sphere(0, 0.6));
}

/** The scientist's long white lab coat from the front or back: open over a teal shirt, a bow tie, pens in the pocket. */
function labCoat(c: PixelCanvas, cx: number, U: number, L: number, sway: number, back: boolean): void {
  const top = 15 + U;
  const waist = 21 + U;
  const hem = 28 + L;
  if (!back) {
    c.part();
    c.shape(top, waist, () => [cx - 2.2, cx + 2.2], TEAL, (_x, _y, t) => cyl(t, 0.2));
    c.shape(waist, hem, () => [cx - 1.8, cx + 1.8], SLACKS, (_x, _y, t) => cyl(t, 0.2));
  }
  c.part();
  c.shape(top, hem, (y) => {
    const hw = y <= waist ? 4.8 - 0.5 * ((y + 0.5 - top) / (waist - top)) ** 2 : 4.3 + (y - waist) * 0.2;
    const s = y > waist ? ((y - waist) / (hem - waist)) * sway : 0;
    return [cx - hw + s, cx + hw + s];
  }, LAB_COAT, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
  if (back) {
    // The back seam and its vent.
    for (let y = top + 2; y <= hem; y++) c.shade(cx - 1 + Math.round(y > waist ? ((y - waist) / (hem - waist)) * sway : 0), y, -1);
    return;
  }
  // The opening, from a V at the collar to the hem.
  const gap = (y: number): number => (y < top + 4 ? 1.8 - (y - top) * 0.3 : y <= waist ? 0.7 : 0.7 + (y - waist) * 0.2);
  for (let y = top; y <= hem; y++) {
    const s = y > waist ? ((y - waist) / (hem - waist)) * sway : 0;
    const w = gap(y);
    for (let x = Math.round(cx - w + s); x < Math.round(cx + w + s); x++) c.erase(x, y);
  }
  c.part();
  c.shape(top, hem, (y) => {
    const s = y > waist ? ((y - waist) / (hem - waist)) * sway : 0;
    const w = gap(y);
    return [cx - w + s, cx + w + s];
  }, TEAL, (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
  c.part();
  c.shape(waist + 1, hem, (y) => {
    const s = ((y - waist) / (hem - waist)) * sway;
    const w = gap(y);
    return [cx - w + s, cx + w + s];
  }, SLACKS, (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
  // Lapels: a darker fold either side of the V.
  for (let y = top; y < top + 4; y++) {
    const w = gap(y);
    c.shade(Math.round(cx - w - 1), y, -1);
    c.shade(Math.round(cx + w), y, -1);
  }
  // The bow tie.
  c.part();
  for (const x of [cx - 2, cx + 1]) {
    c.px(x, top + 1, BOW_TIE, sphere(x < cx ? -0.4 : 0.4, -0.2));
    c.px(x, top + 2, BOW_TIE, sphere(x < cx ? -0.4 : 0.4, 0.3), { bias: -1 });
  }
  c.px(cx - 1, top + 1, BOW_TIE, sphere(0, 0), { bias: 1 });
  c.px(cx, top + 1, BOW_TIE, sphere(0, 0), { bias: 1 });
  // A breast pocket with two pens, and the coat's buttons.
  c.part();
  c.shade(cx + 2, top + 4, -1);
  c.shade(cx + 3, top + 4, -1);
  c.px(cx + 2, top + 3, BOW_TIE, sphere(0, -0.4));
  c.px(cx + 3, top + 3, LENS, sphere(0, -0.4), { glow: 0 });
  c.px(cx - 3, waist + 2, STEEL, sphere(-0.3, 0));
  c.px(cx - 3, waist - 1, STEEL, sphere(-0.3, 0));
}

/** Einstein's baggy cardigan from the front or back, over a white shirt, chalk dust on it. */
function cardigan(c: PixelCanvas, cx: number, U: number, L: number, sway: number, back: boolean): void {
  const top = 15 + U;
  const waist = 21 + U;
  const hem = 25 + L;
  c.part();
  c.shape(top, hem, (y) => {
    const hw = y <= waist ? 5.0 - 0.3 * ((y + 0.5 - top) / (waist - top)) ** 2 : 4.8 + (y - waist) * 0.15;
    const s = y > waist ? ((y - waist) / (hem - waist)) * sway * 0.5 : 0;
    return [cx - hw + s, cx + hw + s];
  }, CARDIGAN, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
  // The knit: a faint rib running down.
  for (let y = top + 1; y <= hem; y++) for (let x = cx - 4; x <= cx + 3; x += 2) if (((y + x) & 3) === 0) c.shade(x, y, -1);
  if (back) return;
  // The white shirt in a V at the neck, its collar points, buttons down the front.
  c.part();
  c.shape(top, top + 3, (y) => {
    const w = 2.2 - (y - top) * 0.55;
    return w < 0.4 ? null : [cx - w, cx + w];
  }, WHITE_SHIRT, (_x, _y, t) => cyl(t * 0.6, 0.3));
  c.part();
  c.px(cx - 2, top, WHITE_SHIRT, sphere(-0.5, -0.4), { bias: 1 });
  c.px(cx + 1, top, WHITE_SHIRT, sphere(0.5, -0.4), { bias: 1 });
  for (let y = top + 4; y <= hem - 1; y += 2) c.px(cx - 1, y, BOOT, sphere(0, 0));
  // Pockets, and chalk dust where he wiped his hands.
  c.shade(cx - 4, waist + 1, -1);
  c.shade(cx - 3, waist + 1, -1);
  c.shade(cx + 2, waist + 1, -1);
  c.shade(cx + 3, waist + 1, -1);
  c.shade(cx + 3, top + 4, 2);
  c.shade(cx - 3, waist + 2, 2);
}

// ---------------------------------------------------------------------------
// Views

const REACH_FRONT = 4.5;
const REACH_SIDE = 5.2;

function legsFront(c: PixelCanvas, L: number, fa: number, fb: number, back: boolean): void {
  const m = trouser();
  const [l, r] = back ? [fb, fa] : [fa, fb];
  c.part();
  c.capsule(10.2, 24 + L, 9.9, 28.6 - l, 1.75, 1.45, m);
  c.capsule(13.8, 24 + L, 14.1, 28.6 - r, 1.75, 1.45, m);
  boot(c, 9.8, 30.3 - l);
  boot(c, 14.2, 30.3 - r);
}

/** How far the engineer sinks when he kneels. */
const KNEEL_DROP = 4;

/**
 * The engineer's legs as he kneels, `k` 0..1 of the way down: the left knee
 * comes down to the ground (its boot tucked out of sight behind it), the
 * right foot stays planted with its knee jutting up toward us.
 */
function legsKneel(c: PixelCanvas, L: number, k: number): void {
  const m = trouser();
  const hip = 24 + L;
  if (k < 0.7) boot(c, 9.8, 30.3, false, -1);
  c.part();
  const kx = 9.9 - 0.5 * k;
  const ky = 28.6 + 0.8 * k;
  c.capsule(10.2, hip, kx, ky, 1.75, 1.6, m);
  // The kneeling knee, a round patch on the ground.
  c.part();
  c.ellipse(kx, ky + 0.2, 1.8, 1.3 * k + 0.2, m, { bias: 1 });
  // The standing leg: the thigh runs toward us, so the knee sits up by the hip, the shin drops to the boot.
  c.part();
  const nx = 14.2 + 0.7 * k;
  const ny = Math.min(hip + 1.4, 28);
  c.capsule(nx, ny, 14.3, 28.8, 1.7, 1.45, m);
  c.part();
  c.ellipse(nx, ny, 1.9, 1.5, m, { bias: 1 });
  boot(c, 14.3, 30.3);
}

/** The little brass gizmo he tinkers with: a cog with a lamp at its hub, held up in the free hand. */
function drawGizmo(c: PixelCanvas, p: Placed, lit: number): void {
  const x = p.x;
  const y = p.y - 2.2;
  c.part();
  c.ellipse(x, y, 2.0, 1.8, BRASS);
  // Teeth round its rim.
  c.part();
  for (const [dx, dy] of [[-2.6, -0.4], [2.2, -0.4], [-0.4, -2.4], [-1.9, -2.0], [1.4, -2.0]]) c.px(x + dx, y + dy, BRASS, sphere(dx / 2.6, dy / 2.6), { bias: 1 });
  c.part();
  c.px(x - 0.5, y - 0.5, lit > 0.2 ? LAMP : STEEL, sphere(0, -0.2), { glow: lit });
  if (lit > 0) glowAt(c, x - 0.5, y - 0.5, lit);
  c.part();
  c.ellipse(x, p.y + 0.3, 1.25, 1.1, handMat());
}

/** Sparks flying off the wrench's head, a different spray each frame. */
function wrenchSparks(c: PixelCanvas, x: number, y: number, k: number, tick: number): void {
  if (k <= 0) return;
  const [core, hot, mid] = S.light;
  const sprays: [number, number][][] = [
    [[-1, -2], [1, -3], [-3, -2], [2, -1], [-4, -4], [0, -5]],
    [[0, -3], [-2, -4], [2, -3], [-3, 0], [3, -5], [-5, -2]],
    [[-1, -1], [-2, -3], [1, -4], [3, -2], [-4, -5], [2, -6]],
  ];
  glowAt(c, x, y, k);
  sprays[tick % 3].forEach(([dx, dy], i) => c.spark(x + dx, y + dy, i < 2 ? core : i < 4 ? hot : mid, k * (i < 4 ? 1 : 0.8)));
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const kneel = p.kneel ?? 0;
  const L = -p.lift + kneel;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const td = toolDir('down', p.t);
  const armA = () => arm(c, 7.2, 16.4 + U, fa, REACH_FRONT, [-0.6, 1], fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.8, 16.4 + U, fb, REACH_FRONT, [0.6, 1], fb.behind ? -1 : 0);
  const tool = (bias = 0) => drawTool(c, fb, td, p.glow, p.tick, bias);

  // The toolbox's corners peek over his shoulders.
  if (eng()) {
    c.part();
    c.px(cx - 4, 15 + U, PIPE_RED, sphere(-0.5, -0.5), { bias: -1 });
    c.px(cx + 3, 15 + U, PIPE_RED, sphere(0.5, -0.5), { bias: -1 });
  }
  const toolBack = td.away || fb.behind;
  if (fa.behind) armA();
  if (fb.behind) armB();
  if (toolBack) tool(-1);

  if (kneel > 0.5) legsKneel(c, L, Math.min(1, kneel / KNEEL_DROP));
  else legsFront(c, L, p.footA, p.footB, false);
  if (eng()) engineerBody(c, cx, U, L, false);
  else if (ein()) cardigan(c, cx, U, L, p.sway, false);
  else labCoat(c, cx, U, L, p.sway, false);

  if (eng()) engineerDown(c, cx, U, p);
  else if (ein()) einsteinDown(c, cx, U, p);
  else scientistDown(c, cx, U, p);

  if (!fb.behind) armB();
  if (!toolBack) tool();
  if (!fa.behind) armA();
  if (p.crate) drawCrate(c, fa);
  if (p.gizmo !== undefined) drawGizmo(c, fa, p.gizmo);
  if (p.sparks && eng()) {
    const len = 9.5 * td.k - 1.2;
    wrenchSparks(c, fb.x + td.x * len, fb.y + td.y * len, p.sparks, p.tick);
  }
  drawOrb(c, fa, p.orb, p.tick);
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
  const tool = (bias = 0) => drawTool(c, fb, td, p.glow, p.tick, bias);

  const toolBack = td.away || fb.behind;
  if (fa.behind) armA();
  if (fb.behind) armB();
  if (toolBack) tool(-1);
  if (p.crate && fa.behind) drawCrate(c, fa);

  legsFront(c, L, p.footA, p.footB, true);
  if (eng()) {
    engineerBody(c, cx, U, L, true);
    // The back of his head under the hat, the toolbox over the straps.
    c.part();
    c.ellipse(cx, 12.4 + U, 3.3, 3.0, SKIN);
    c.part();
    c.ellipse(cx, 12.6 + U, 3.3, 2.2, MOUSTACHE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.6, 1) });
    c.px(cx - 4, 12 + U, SKIN, cyl(-0.8, 0));
    c.px(cx + 3, 12 + U, SKIN, cyl(0.8, 0));
    hardHat(c, cx, U, p.glow, 'up');
    toolbox(c, cx, U);
  } else if (ein()) {
    cardigan(c, cx, U, L, p.sway, true);
    c.part();
    c.px(cx - 2, 15 + U, WHITE_SHIRT, sphere(-0.4, -0.5));
    c.px(cx + 1, 15 + U, WHITE_SHIRT, sphere(0.4, -0.5));
    wildHair(c, cx, U, p.tick, 'up');
  } else {
    labCoat(c, cx, U, L, p.sway, true);
    c.part();
    c.ellipse(cx, 11.2 + U, 3.9, 3.8, DARK_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 1) });
    c.part();
    for (const [x, y] of [[cx - 1, 7], [cx + 1, 7], [cx + 3, 8], [cx - 4, 8]] as const) c.px(x, y + U, DARK_HAIR, sphere((x - cx) / 4, -0.6));
    // The goggles' strap round the back of the head.
    c.part();
    c.shape(Math.round(9.6 + U), Math.round(9.6 + U), () => [cx - 4, cx + 4], BRASS, (_x, _y, t) => cyl(t, 0.2), { bias: -2 });
    // The coat's collar standing up behind the neck.
    c.part();
    c.shape(Math.round(14.6 + U), Math.round(15.6 + U), () => [cx - 3.2, cx + 3.2], LAB_COAT, (_x, _y, t) => cyl(t, -0.4));
  }

  if (!fb.behind) armB();
  if (!toolBack) tool();
  if (!fa.behind) armA();
  if (p.crate && !fa.behind) drawCrate(c, fa);
  drawOrb(c, fa, p.orb * 0.7, p.tick);
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

  // The far arm behind everything, unless it reaches out in front.
  const armA = (bias: number) => arm(c, hx + 1.2, 16.4 + U, fa, REACH_SIDE, [0.3, 1], bias);
  if (fa.behind) {
    armA(-1);
    if (p.crate) drawCrate(c, fa);
  }
  // A tool swung back past the body goes behind it.
  const toolBack = td.x > 0.55 && fb.x > hx - 1;
  if (toolBack) drawTool(c, fb, td, p.glow, p.tick, -1);

  // Legs: the back one in shade first.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  const m = trouser();
  c.part();
  c.capsule(cx + 0.8, 24 + L, cx + 1 - p.footB, 29 - lift(p.footB), 1.6, 1.4, m, { bias: -1 });
  boot(c, cx + 0.4 - p.footB, 30.3 - lift(p.footB), true, -1);
  c.part();
  c.capsule(cx - 0.6, 24 + L, cx - 0.4 - p.footA, 29 - lift(p.footA), 1.6, 1.4, m);
  boot(c, cx - 1.2 - p.footA, 30.3 - lift(p.footA), true);

  if (eng()) {
    // The toolbox on his back.
    c.part();
    c.shape(Math.round(15.5 + U), Math.round(21 + U), () => [hx + 2.6, hx + 5.4], PIPE_RED, (_x, y, t) => sphere(t * 0.8, (y - 15.5 - U) / 5.5 - 0.5, 1));
    c.part();
    c.line(hx + 3, 15 + U, hx + 5, 15 + U, STEEL, () => sphere(0, 0.6));
    for (let y = Math.round(16.5 + U); y <= 21 + U; y += 4) c.shade(Math.round(hx + 4), y, -1);
    // Shirt, overalls in profile, the belt and its pouch.
    c.part();
    c.shape(top, Math.round(22 + U), (y) => {
      const u = (y + 0.5 - top) / 7;
      const hw = 3.6 - 0.5 * u * u;
      return [hx - hw - 0.3, hx + hw];
    }, WORK_SHIRT, (_x, y, t) => sphere(t * 0.9 - 0.1, ((y - top) / 7) * 0.8 - 0.35, 1));
    c.part();
    c.shape(Math.round(18 + U), Math.round(24 + L), (y) => {
      const k = Math.max(0, Math.min(1, (y - 22 - U) / 2));
      const x = hx + (cx - hx) * k;
      return [x - 3.6, x + (y < 22 + U ? 1.2 : 3.2)];
    }, DENIM, (_x, _y, t) => cyl(t, 0.1));
    c.part();
    c.line(hx - 1.6, top, hx - 2.4, 18 + U, DENIM, () => sphere(-0.3, -0.4));
    c.px(hx - 2.8, 18 + U, BRASS, sphere(-0.3, 0));
    c.part();
    c.shape(Math.round(23 + U), Math.round(23 + U), () => [hx - 3.8, hx + 3.4], LEATHER, (_x, _y, t) => cyl(t, 0));
    c.part();
    c.shape(Math.round(23 + U), Math.round(25 + U), () => [hx - 1.2, hx + 1.6], LEATHER, (_x, _y, t) => cyl(t, 0.2), { bias: 1 });
    // The head in profile: nose, moustache, sideburn, ear, the hat with its peak and lamp.
    c.part();
    c.ellipse(hx - 0.6, 12.3 + U, 3.0, 3.0, SKIN);
    c.part();
    c.px(hx - 4, 13 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
    c.part();
    c.px(hx + 0.8, 12 + U, SKIN, cyl(0.6, 0), { bias: -1 });
    c.px(hx + 1.4, 11 + U, MOUSTACHE, cyl(0.7, 0));
    c.px(hx + 1.4, 12 + U, MOUSTACHE, cyl(0.7, 0));
    eyes(c, [[hx - 3, 12 + U]], p.blink);
    c.part();
    for (const x of [hx - 4, hx - 3, hx - 2]) c.px(x, 14 + U, MOUSTACHE, sphere(-0.3, -0.2));
    c.px(hx - 4, 15 + U, MOUSTACHE, sphere(-0.6, 0.3));
    hardHat(c, cx, U, p.glow, 'side', hx);
  } else if (ein()) {
    c.part();
    c.shape(top, Math.round(25 + L), (y) => {
      const u = y <= waist ? 0 : (y - waist) / (25 + L - waist);
      const shift = y <= waist ? hx : hx + (cx - hx) * Math.min(1, u * 2);
      const hw = y <= waist ? 3.6 - 0.3 * ((y + 0.5 - top) / (waist - top)) ** 2 : 3.4 + (y - waist) * 0.12;
      return [shift - hw - 0.3, shift + hw + u * p.sway * 0.5];
    }, CARDIGAN, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
    for (let y = top + 1; y <= 25 + L; y += 2) c.shade(Math.round(hx - 2), y, -1);
    c.part();
    c.px(hx - 3, top, WHITE_SHIRT, sphere(-0.5, -0.4), { bias: 1 });
    c.px(hx - 3, top + 1, WHITE_SHIRT, sphere(-0.5, 0));
    c.shade(hx - 2, waist + 1, 2);
    wildHair(c, cx, U, p.tick, 'side', hx);
    c.part();
    c.ellipse(hx - 0.8, 12.4 + U, 2.9, 3.0, SKIN);
    c.part();
    c.px(hx - 4, 13 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
    c.px(hx + 0.8, 12 + U, SKIN, cyl(0.6, 0), { bias: -1 });
    c.part();
    c.px(hx - 3, 11 + U, WILD_HAIR, sphere(0, -0.6));
    c.px(hx - 2, 11 + U, WILD_HAIR, sphere(0, -0.6));
    eyes(c, [[hx - 3, 12 + U]], p.blink);
    c.part();
    for (const x of [hx - 4, hx - 3, hx - 2]) c.px(x, 14 + U, WILD_HAIR, sphere(-0.3, -0.2));
    c.px(hx - 4, 15 + U, WILD_HAIR, sphere(-0.6, 0.3));
    if (p.tongue) {
      c.part();
      c.px(hx - 4, 16 + U, TONGUE, sphere(-0.4, 0.4));
      c.px(hx - 3, 15 + U, TONGUE, sphere(0, 0));
    }
  } else {
    // The lab coat in profile, trailing back as he moves.
    const hem = 28 + L;
    c.part();
    c.shape(top, hem, (y) => {
      const u = y <= waist ? 0 : (y - waist) / (hem - waist);
      const shift = y <= waist ? hx : hx + (cx - hx) * Math.min(1, u * 2);
      const hw = y <= waist ? 3.4 - 0.4 * ((y + 0.5 - top) / (waist - top)) ** 2 : 3.1 + (y - waist) * 0.24;
      return [shift - hw - 0.2, shift + hw + 0.2 + u * p.sway];
    }, LAB_COAT, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.25, 1));
    for (let y = waist + 2; y < hem; y++) c.shade(Math.round(hx + 1 + ((y - waist) / (hem - waist)) * p.sway), y, -1);
    // The shirt and bow tie at the open front, the lapel.
    c.part();
    c.shape(top, waist, () => [hx - 3.6, hx - 2.6], TEAL, (_x, _y, t) => cyl(t, 0.2));
    c.part();
    c.px(hx - 4, top + 1, BOW_TIE, sphere(-0.5, 0));
    c.px(hx - 3, top + 1, BOW_TIE, sphere(0, 0), { bias: 1 });
    c.shade(hx - 2, top + 1, -1);
    c.shade(hx - 2, top + 2, -1);
    // The head: hair swept back over the crown, goggles on the brow.
    c.part();
    c.ellipse(hx + 0.4, 10.8 + U, 3.6, 3.4, DARK_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.4, 1) });
    c.part();
    c.ellipse(hx - 0.8, 12.6 + U, 2.8, 2.8, SKIN);
    c.part();
    c.px(hx - 4, 13 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
    c.px(hx + 0.8, 12 + U, SKIN, cyl(0.6, 0), { bias: -1 });
    c.part();
    for (const [x, y] of [[hx - 3, 10], [hx - 2, 9], [hx + 3, 8], [hx + 1, 7], [hx - 1, 7]] as const) c.px(x, y + U, DARK_HAIR, sphere(-0.3, -0.6));
    c.part();
    c.shape(Math.round(9.6 + U), Math.round(9.6 + U), () => [hx - 2.6, hx + 3.8], BRASS, (_x, _y, t) => cyl(t, 0.2), { bias: -1 });
    c.ellipse(hx - 2.8, 9.8 + U, 1.2, 1.1, BRASS);
    c.px(hx - 4, 9 + U, LENS, sphere(-0.5, 0.4));
    eyes(c, [[hx - 3, 12 + U]], p.blink);
    c.shade(hx - 3, 14 + U, -1);
  }

  if (!fa.behind) {
    armA(0);
    if (p.crate) drawCrate(c, fa);
  }
  // The near arm last, the tool in its hand.
  arm(c, hx + 0.2, 16.7 + U, fb, REACH_SIDE, [0.4, 1], 0);
  if (!toolBack) drawTool(c, fb, td, p.glow, p.tick);
  drawOrb(c, fa, p.orb, p.tick);
}

// ---------------------------------------------------------------------------
// Animations

/** The free hand easy at the side. */
const REST_A = H(0.8, 4.2, -3.2);
/** The engineer's wrench resting on his shoulder; the scientist's gadget held ready, pointing ahead. */
const WRENCH_B = H(0.6, 3.4, 1.4);
const WRENCH_T = H(-0.6, -0.3, 1);
const GADGET_B = H(1.6, 4.6, -1.6);
const GADGET_T = H(1, 0.25, -0.25);

/** Side-view hands: a little further forward, both at the body's line. */
const side = (h: Hand, arm: 'a' | 'b'): Hand => H(h.f + (arm === 'b' ? 0.6 : 0.4), 0, h.h);

const base = (view: View): Pose => {
  const b = eng() ? WRENCH_B : GADGET_B;
  return {
    lift: 0,
    breath: 0,
    footA: view === 'side' ? 1 : 0,
    footB: view === 'side' ? -1 : 0,
    lean: 0,
    a: view === 'side' ? side(REST_A, 'a') : { ...REST_A },
    b: view === 'side' ? side(b, 'b') : { ...b },
    t: { ...(eng() ? WRENCH_T : GADGET_T) },
    glow: 0.2,
    orb: 0,
    crate: false,
    sway: 0,
    tick: 0,
  };
};

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
    p.glow = 0.2 + 0.15 * Math.sin(ph);
    // The wrench taps on his shoulder; the gadget bobs.
    if (eng()) p.t = H(-0.6 + Math.sin(ph) * 0.15, -0.3, 1);
    else p.b.h += Math.sin(ph) * 0.4;
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
  orb?: number;
  crate?: boolean;
  lean?: number;
  breath?: number;
  lift?: number;
  step?: number;
  tongue?: boolean;
}

/** An action as keyframes; anything left out stays at rest. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k, i) => {
      const p = base(view);
      if (k.a) p.a = view === 'side' ? { ...(k.aSide ?? side(k.a, 'a')) } : { ...k.a };
      if (k.b) p.b = view === 'side' ? { ...(k.bSide ?? side(k.b, 'b')) } : { ...k.b };
      if (k.t) p.t = { ...k.t };
      p.glow = k.glow ?? 0.2;
      p.orb = k.orb ?? 0;
      p.crate = !!k.crate;
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
      p.tick = i;
      p.tongue = k.tongue && ein();
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

// The engineer's wrench: a forehand sweep, a backhand, and an overhead bonk.
const swing = action([
  { b: H(0.4, 5.4, 2.6), t: H(-0.6, 0.9, 0.6), lean: -1 },
  { b: H(3.6, 3.4, 1.2), t: H(1, 0.6, 0.1), lean: 1, step: 1 },
  { b: H(3.8, -0.6, 0.6), t: H(0.6, -1, -0.1), lean: 1, step: 1 },
  { b: H(1.6, 2.6, 0), t: H(0.3, 0.2, -1) },
]);

const swing2 = action([
  { b: H(2.6, -1, 1.6), t: H(0.3, -1, 0.4), lean: -1 },
  { b: H(4, 2, 1), t: H(1, 0.4, 0), lean: 1, step: 1 },
  { b: H(3, 5, 0.6), t: H(0.3, 1, -0.3), lean: 1 },
  { b: H(1.6, 4.2, 0.6), t: H(-0.2, 0.2, 1) },
]);

const bonk = action([
  { b: H(0, 3, 5), t: H(-0.7, 0.2, 0.7), lean: -1 },
  { b: H(1, 2.4, 7), t: H(-0.2, 0, 1), lean: -1, lift: 1 },
  { b: H(4.2, 1.6, 1), t: H(1, 0, -0.9), lean: 1, step: 1, breath: 1 },
  { b: H(4.2, 1.6, 0.4), t: H(1, 0, -1), lean: 1, step: 1, breath: 1 },
  { b: H(1.6, 3.6, 0), t: H(0.3, 0.3, -1) },
]);

/** The build: a crate swung up from the hip and tossed out ahead. */
const build = action([
  { a: H(-1, 4.6, 0.2), aSide: H(-1.6, 0, 0.4), crate: true, breath: 1, lean: -1 },
  { a: H(-0.4, 4.2, 3), aSide: H(-1.2, 0, 3.2), crate: true, lean: -1 },
  { a: H(4.2, 2.2, 3.4), aSide: H(4.6, 0, 3.2), lean: 1, step: 1 },
  { a: H(3.6, 2.6, 2.2), aSide: H(4, 0, 2), lean: 1, step: 1 },
  { a: REST_A },
]);

// The scientist: the gadget thrust out as it fires, and the orb tossed.
const zap = action([
  { b: H(1.2, 4.2, 0.2), t: H(1, 0.3, 0), glow: 0.6, lean: -1 },
  { b: H(4, 2.2, 1.2), t: H(1, 0, 0.1), glow: 1, lean: 1, step: 1 },
  { b: H(3.4, 2.8, 0.8), t: H(1, 0.1, 0.1), glow: 0.5, lean: 1 },
  { glow: 0.3 },
]);

const toss = action([
  { a: H(-1, 4.2, 1), aSide: H(-1.6, 0, 1.2), orb: 0.6, lean: -1 },
  { a: H(-1.4, 4, 3), aSide: H(-2, 0, 3.4), orb: 1, lean: -1 },
  { a: H(4.2, 2, 3.2), aSide: H(4.6, 0, 3), lean: 1, step: 1 },
  { a: H(3.6, 2.6, 2), aSide: H(4, 0, 1.8), lean: 1 },
  { a: REST_A },
]);

/**
 * Eureka, the Special's pose: the tool thrust high overhead, blazing (the
 * hat lamp for the engineer), the free hand flung out. Einstein pokes out
 * his tongue.
 */
const eureka = action([
  { b: H(1, 3.4, 3), t: H(0.2, 0.2, 1), a: H(1, 4.6, 0), glow: 0.4, breath: 1 },
  { b: H(1, 2.8, 5.4), t: H(0, 0.1, 1), a: H(1.6, 5, 1.6), glow: 0.7 },
  { b: H(1, 2.2, 7.4), t: H(0, 0, 1), a: H(2.4, 5.2, 3), glow: 1, lift: 1, tongue: true },
  { b: H(1, 2.2, 7.6), t: H(0, 0, 1), a: H(2.4, 5.4, 3.4), glow: 1, lift: 1, tongue: true },
  { b: H(1, 2.2, 7.4), t: H(0, 0, 1), a: H(2.4, 5.2, 3), glow: 0.9, lift: 1, tongue: true },
  { b: H(1, 2.4, 7.2), t: H(0, 0, 1), a: H(2.2, 5, 2.6), glow: 0.8, tongue: true },
]);

// ---------------------------------------------------------------------------
// The idle moment (`rest`), played facing us when he has stood still a while.
// It starts and ends on idle's first frame so it slips in and out unseen.

/** Idle's first frame, with changes. */
const still = (o: Partial<Pose> = {}): Pose => ({ ...idle('down')[0], ...o });

/** The engineer's gizmo held up in front of him, and the wrench laid across to it. */
const GIZMO_A = H(2, 3, -1.6);
const TINKER_B = H(2, 5, -1.4);

/**
 * The engineer: a fiddly job. He fishes a brass gizmo out of his pouch, sinks
 * onto one knee, works at it with the wrench till the sparks fly, gives it a
 * last tap that lights its lamp, admires it with a contented squint, and
 * tucks it away as he gets up and shoulders the wrench again.
 */
function tinker(view: View): Pose[] {
  if (view !== 'down') return [];
  return [
    still(),
    // Anticipation: a dip, the hand to the pouch, the wrench lifting off the shoulder.
    still({ breath: 1, sway: 0, a: H(0.2, 4.4, -4.6), b: H(0.8, 3.5, 1.8), t: H(-0.55, -0.2, 1), tick: 1 }),
    // Going down, the gizmo out, the wrench swinging round to the front.
    still({ kneel: 2, sway: 0, a: H(1.4, 3.8, -2.8), gizmo: 0, b: H(1.6, 5, 0.6), t: H(0.2, 0.5, 1), tick: 2 }),
    still({ kneel: KNEEL_DROP, sway: 0, a: GIZMO_A, gizmo: 0, b: TINKER_B, t: H(0, -1, 0.3), tick: 3 }),
    // Working the nut: the wrench rocks and the sparks spray.
    still({ kneel: KNEEL_DROP, sway: 0, a: GIZMO_A, gizmo: 0, b: H(2, 5, -1.1), t: H(0, -1, 0.45), sparks: 0.7, tick: 4 }),
    still({ kneel: KNEEL_DROP, sway: 0, breath: 1, a: GIZMO_A, gizmo: 0.15, b: H(2, 5, -1.6), t: H(0, -1, 0.12), sparks: 1, tick: 5 }),
    // The last tap: wound up, then down, and the lamp comes on.
    still({ kneel: KNEEL_DROP, sway: 0, a: GIZMO_A, gizmo: 0, b: H(1.8, 5.2, -0.6), t: H(0, -0.6, 0.85), tick: 6 }),
    still({ kneel: KNEEL_DROP, sway: 0, breath: 1, a: GIZMO_A, gizmo: 1, b: TINKER_B, t: H(0, -1, 0.3), sparks: 0.5, tick: 7 }),
    // Admiring it, held up, the wrench let down to rest on the ground.
    still({ kneel: KNEEL_DROP, sway: 0, a: H(2.4, 3.2, -0.4), gizmo: 0.8, b: H(1.6, 5, -2.2), t: H(1, 0.3, -0.5), blink: true, tick: 8 }),
    still({ kneel: KNEEL_DROP, sway: 0, a: H(2.4, 3.2, -0.2), gizmo: 0.55, b: H(1.6, 5, -2.2), t: H(1, 0.3, -0.5), blink: true, tick: 9 }),
    // Tucked away, and up he gets.
    still({ kneel: 3, sway: 0, a: H(0.2, 4.4, -4.4), b: H(1.4, 4.8, 0.6), t: H(0.2, 0.5, 1), tick: 10 }),
    still({ kneel: 1, sway: -0.2, a: H(0.6, 4.3, -3.8), b: H(0.8, 3.6, 1.6), t: H(-0.4, -0.3, 1), tick: 11 }),
    // The wrench lands on his shoulder with a little bounce.
    still({ breath: 1, b: H(0.6, 3.4, 1.2), t: H(-0.75, -0.3, 1), tick: 12 }),
  ];
}
const TINKER_ORDER = [0, 1, 2, 3, 3, 4, 5, 4, 5, 4, 5, 3, 6, 7, 7, 8, 9, 8, 9, 9, 10, 11, 12, 0];

/** The scientist's gadget raised to peer at, and the free hand fiddling with its coils. */
const PEER_B = H(2.4, 2.8, 0.8);
const PEER_T = H(0.2, -0.6, 0.8);

/**
 * The scientist: he lifts the gadget to peer at it, fiddles with its coils,
 * and it zaps him: a jolt, his hair stands on end crackling with static
 * (Einstein's, already wild, goes wilder), a dazed blink, and he pats it
 * down again, bit by bit.
 */
function frazzle(view: View): Pose[] {
  if (view !== 'down') return [];
  return [
    still(),
    still({ sway: 0, b: PEER_B, t: PEER_T, glow: 0.3, tick: 1 }),
    still({ sway: 0, b: PEER_B, t: PEER_T, a: H(2.6, 1.2, 0.4), glow: 0.5, tick: 2 }),
    still({ sway: 0, b: H(2.4, 2.8, 1), t: PEER_T, a: H(2.6, 1.4, 1.2), glow: 0.65, tick: 3 }),
    // Zap! A jolt up, arms flung, the hair shooting out.
    still({ lift: 1, sway: 0.4, b: H(1.6, 4.2, 1.8), t: H(0.4, 0.4, 0.6), a: H(1, 5.4, 1.4), glow: 1, poof: 1, crackle: 1, tick: 4 }),
    still({ lift: 1, sway: -0.3, b: H(1.6, 4.2, 1.6), t: H(0.4, 0.4, 0.6), a: H(1, 5.4, 1.2), glow: 0.8, poof: 1, crackle: 0.8, tick: 5 }),
    // Dazed, still smoking with it.
    still({ sway: 0, glow: 0.3, poof: 1, crackle: 0.35, blink: true, tick: 6 }),
    // The hand up to his head...
    still({ sway: 0, a: H(1.6, 2.4, 6.6), poof: 0.95, crackle: 0.2, tick: 7 }),
    // ...and pat, pat: the hair sinks a little with each.
    still({ sway: 0, a: H(1.2, 1.2, 9.4), poof: 0.9, tick: 8 }),
    still({ sway: 0, breath: 1, a: H(1.2, 1.2, 8.4), poof: 0.6, tick: 9 }),
    still({ sway: 0, a: H(1.2, 0.8, 9), poof: 0.55, tick: 10 }),
    still({ sway: 0, breath: 1, a: H(1.2, 0.8, 8), poof: 0.25, tick: 11 }),
    // A sheepish breath out, and back to it.
    still({ breath: 1, a: H(1, 4, -1.8), blink: true, tick: 12 }),
  ];
}
const FRAZZLE_ORDER = [0, 1, 1, 2, 3, 2, 3, 3, 4, 5, 4, 5, 6, 6, 6, 7, 8, 9, 10, 11, 11, 12, 12, 0];

// ---------------------------------------------------------------------------
// Frame generation

export type InventorAnim = 'idle' | 'walk' | 'swing' | 'swing2' | 'bonk' | 'build' | 'zap' | 'toss' | 'eureka' | 'rest';

export interface InventorAnimDef {
  name: InventorAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Only drawn for this type; for both when left out. */
  kind?: InventorKind;
  /** Frames played in this order, some held or repeated. */
  order?: readonly number[];
}

export const INVENTOR_ANIMS: InventorAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'swing', fps: 14, loop: false, poses: swing, kind: 'engineer' },
  { name: 'swing2', fps: 14, loop: false, poses: swing2, kind: 'engineer' },
  { name: 'bonk', fps: 13, loop: false, poses: bonk, kind: 'engineer' },
  { name: 'build', fps: 13, loop: false, poses: build, kind: 'engineer' },
  { name: 'zap', fps: 14, loop: false, poses: zap, kind: 'scientist' },
  { name: 'toss', fps: 13, loop: false, poses: toss, kind: 'scientist' },
  { name: 'eureka', fps: 10, loop: false, poses: eureka },
  { name: 'rest', fps: 8, loop: false, poses: tinker, kind: 'engineer', order: TINKER_ORDER },
  { name: 'rest', fps: 8, loop: false, poses: frazzle, kind: 'scientist', order: FRAZZLE_ORDER },
];

/** The anims a look has. */
export const inventorAnims = (look: InventorLook): InventorAnimDef[] => INVENTOR_ANIMS.filter((a) => a.kind === undefined || a.kind === look.kind);

/** Frame index at which each action lands. */
export const INVENTOR_RELEASE = { swing: 1, swing2: 1, bonk: 2, build: 2, zap: 1, toss: 2 } as const;

export interface InventorFrame {
  key: string;
  anim: InventorAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawInventorFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(INV_W, INV_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildInventorFrames(look: InventorLook = ENGINEER_LOOK): InventorFrame[] {
  S = look;
  const out: InventorFrame[] = [];
  for (const a of inventorAnims(look)) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawInventorFrame(dir, pose) });
      });
    }
  }
  S = ENGINEER_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// The turret

export const TURRET_SIZE = 20;
/** The turret's feet, from the top of its frame. */
export const TURRET_FOOT = 18;
/** The muzzle's height above the feet. */
export const TURRET_GUN_Y = 9;
export const TURRET_HEADINGS = 8;
export const TURRET_BUILD = 5;

const HAZARD: Material = { ...HARD_HAT, shine: true };
const EYE_RED: Material = { ramp: ramp('#6a0a0a', '#e0301e', '#ff9070'), outline: hex('#200202'), emissive: 1, noAO: true };

/**
 * One frame of the sentry: a steel tripod and drum, a yellow head with twin
 * barrels turned to `heading` (0 = right, clockwise in eighths) and a red
 * eye. `grow` 0..1 unfolds it from the crate it was tossed out as; `recoil`
 * pulls the barrels back as they fire (the muzzle flash is drawn by the game).
 */
export function turretFrame(heading: number, grow = 1, recoil = 0): PixelCanvas {
  const c = new PixelCanvas(TURRET_SIZE, TURRET_SIZE);
  const cx = 10;
  const foot = TURRET_FOOT;
  if (grow < 0.2) {
    // Still a crate.
    c.part();
    c.shape(foot - 5, foot, () => [cx - 4, cx + 4], CRATE, (_x, y, t) => sphere(t * 0.8, (y - foot + 5) / 5 - 0.4, 1));
    c.part();
    for (let x = cx - 4; x < cx + 4; x++) c.px(x, foot - 3, HAZARD, cyl((x + 0.5 - cx) / 4, 0));
    for (let y = foot - 5; y <= foot; y++) c.shade(cx - 1, y, -1);
    return c;
  }
  const k = Math.min(1, (grow - 0.2) / 0.8);
  // The tripod, its legs spreading as it unfolds.
  const hub = foot - 3 - 3 * k;
  c.part();
  const spread = 1.5 + 3.5 * k;
  c.line(cx, hub, cx - spread, foot, STEEL, () => sphere(-0.4, 0));
  c.line(cx - 0.5, hub, cx + spread, foot, STEEL, () => sphere(0.4, 0));
  c.line(cx, hub, cx + 0.5, foot + 0.5, STEEL, () => sphere(0, 0.3), { bias: -1 });
  c.part();
  c.ellipse(cx, hub, 2.6, 1.5, STEEL);
  if (k < 0.4) {
    // The crate's opened boards still lying round its feet.
    c.part();
    c.line(cx - 5, foot, cx - 2, foot, CRATE);
    c.line(cx + 2, foot, cx + 5, foot, CRATE);
    return c;
  }
  const a = (heading / TURRET_HEADINGS) * Math.PI * 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a) * 0.6;
  const hy = hub - 2.6 * Math.min(1, (k - 0.4) / 0.6);
  const px = -dy;
  const py = dx;
  const len = 5.2 - recoil * 1.6;
  const barrels = () => {
    c.part();
    for (const s of [-1, 1]) {
      const bx = cx + px * s * 1.1;
      const by = hy + py * s * 0.8;
      c.capsule(bx, by, bx + dx * len, by + dy * len, 0.7, 0.6, STEEL);
    }
  };
  if (dy < -0.1) barrels();
  c.part();
  c.ellipse(cx, hy, 3.6, 2.8, HAZARD, { normal: (_x, _y, ex, ey) => sphere(ex * 0.9, ey * 0.8 - 0.3, 1) });
  // A black band of hazard stripe round the head.
  c.part();
  for (let x = cx - 3; x <= cx + 2; x++) if ((x & 1) === 0) c.shade(x, Math.round(hy + 1), -2);
  if (dy >= -0.1) barrels();
  // The eye, on the side it faces.
  if (dy > -0.45) {
    c.part();
    c.px(cx + dx * 2 - 0.5 + (dx > 0 ? 0 : 0), hy - 0.5 + dy * 1.5, EYE_RED);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Button icons

const ENGINEER_TONES: Tones = [hex('#fffbe8'), hex('#ffe070'), hex('#e0a020'), hex('#6a4a10')];
const SCIENCE_TONES: Tones = [hex('#f0ffff'), hex('#a8f4ff'), hex('#40d0ff'), hex('#1a5ab0')];
const EINSTEIN_TONES: Tones = [hex('#fffdf0'), hex('#fff0b0'), hex('#ffd060'), hex('#a86a18')];

/** The wrench: a red pipe wrench swung on a diagonal, a spark where it lands. */
export function wrenchIcon(): Uint8ClampedArray {
  const red: RGB = hex('#dc4636');
  const dark: RGB = hex('#6a1212');
  const steel: RGB = hex('#c8d2e2');
  const t = ENGINEER_TONES;
  return icon16((put) => {
    seg(put, 2, 14, 10, 6, red);
    seg(put, 3, 14, 10, 7, dark);
    for (let y = 2; y <= 6; y++) for (let x = 9; x <= 12; x++) if (!(x === 12 && y > 4)) put(x, y, steel);
    put(13, 2, steel);
    put(14, 3, steel);
    put(13, 3, steel);
    put(10, 5, hex('#dcae4a'));
    put(14, 7, t[0]);
    put(15, 8, t[1]);
    put(13, 8, t[2]);
    put(15, 6, t[2]);
  });
}

/** The build: a little sentry on its tripod, its barrels flashing. */
export function turretIcon(): Uint8ClampedArray {
  const yel: RGB = hex('#f6cc3c');
  const steel: RGB = hex('#aab4c8');
  const t = ENGINEER_TONES;
  return icon16((put) => {
    seg(put, 7, 10, 3, 15, steel);
    seg(put, 8, 10, 12, 15, steel);
    seg(put, 7, 10, 7, 15, steel);
    for (let y = 4; y <= 9; y++) for (let x = 3; x <= 10; x++) if ((x - 6.5) ** 2 / 14 + (y - 6.5) ** 2 / 7 <= 1) put(x, y, yel);
    seg(put, 10, 5, 14, 5, steel);
    seg(put, 10, 7, 14, 7, steel);
    put(9, 6, hex('#ff5030'));
    put(15, 5, t[0]);
    put(15, 7, t[0]);
    put(15, 6, t[1]);
  });
}

/** The Tesla zap: a bolt forking from the gadget's bulb to two foes (Einstein's in gold). */
export function teslaIcon(einstein = false): Uint8ClampedArray {
  const t = einstein ? EINSTEIN_TONES : SCIENCE_TONES;
  return icon16((put) => {
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 4) put(3 + x, 12 + y, x * x + y * y <= 1 ? t[0] : t[1]);
    const a: [number, number][] = [[4, 10], [7, 9], [6, 7], [9, 6], [9, 4], [12, 3]];
    for (let i = 0; i < a.length - 1; i++) seg(put, a[i][0], a[i][1], a[i + 1][0], a[i + 1][1], i % 2 ? t[1] : t[0]);
    const b: [number, number][] = [[7, 9], [10, 10], [11, 12], [14, 12]];
    for (let i = 0; i < b.length - 1; i++) seg(put, b[i][0], b[i][1], b[i + 1][0], b[i + 1][1], t[2]);
    put(13, 2, t[0]);
    put(14, 13, t[1]);
  });
}

/** The polarity orb: a sphere of light with field lines curling into it (Einstein's gravity well, rings bending in). */
export function orbIcon(einstein = false): Uint8ClampedArray {
  const t = einstein ? EINSTEIN_TONES : SCIENCE_TONES;
  return icon16((put) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
        if (d <= 2.2) put(x, y, t[0]);
        else if (d <= 3.2) put(x, y, t[1]);
        else if (einstein ? Math.abs(d - 5.5) < 0.45 || Math.abs(d - 7.4) < 0.4 : false) put(x, y, (x + y) % 2 ? t[2] : t[3]);
      }
    }
    if (!einstein) {
      for (let arm = 0; arm < 4; arm++) {
        for (let k = 0; k < 10; k++) {
          const f = k / 10;
          const a = (arm * Math.PI) / 2 + f * 1.6;
          const r = 7.4 - f * 3.6;
          put(8 + Math.cos(a) * r - 0.5, 8 + Math.sin(a) * r - 0.5, f > 0.5 ? t[1] : t[2]);
        }
      }
    }
  });
}
