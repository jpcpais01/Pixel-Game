// The Aquanaut, the Inventor's deep-sea diver, drawn procedurally on his own
// rig (built like the Inventor's, see inventor.ts).
//
// A hard-hat diver: a great round brass helmet with three glass portholes
// (his face just visible through the front one) and a little lamp on its
// brow, bolted to a brass corselet over his shoulders; an air hose looping
// from the back of the helmet to a copper tank on his back; a rubberised
// canvas suit with rubber cuffs, a belt hung with lead weights, and heavy
// lead boots with brass toe caps. In his hand, a pneumatic harpoon gun: a
// walnut stock, a fat brass air chamber, a reel drum for the chain under it
// and a barbed harpoon in its muzzle. Now and then a bubble wobbles up out of
// the exhaust valve on the side of his helmet.
//
// Barnacle is his old wreck diver: the copper gone verdigris green, crusted
// with barnacles, a starfish clinging to the helmet, kelp trailing from his
// shoulders and belt, a sea-green suit, and a sea-green lamp.
//
// The body keeps to the 24x32 box; frames are larger so the raised harpoon
// gun and the bubbles over the helmet fit. Hands are posed in the rig's own
// terms (forward, out to the side, height) and placed per view; so is the
// way the gun points.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { EYE, LEATHER, WOOD } from './palette';
import { DIRS, type Dir } from './wizard';
import { iconPainter } from './effects';

export const AQUA_W = 48;
export const AQUA_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const AQUA_ORIGIN_X = BODY_X + 12;
export const AQUA_ORIGIN_Y = BODY_Y + 31;
/** Height above the feet that the harpoon flies (the gun's muzzle, held at the hip). */
export const HARPOON_H = 12;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#0e0c14');

// ---------------------------------------------------------------------------
// Materials

const BRASS_HELM: Material = { ramp: ramp('#3a2210', '#6a4418', '#a8742a', '#dcae4a', '#fff0b0'), outline: hex('#1e1006'), outlineLit: hex('#3a2410'), shine: true };
const BRASS_TRIM: Material = { ramp: ramp('#2a180a', '#5a3a16', '#8e6226', '#c89a44', '#f4d890'), outline: hex('#160c04'), shine: true, noAO: true };
const GUN_BRASS: Material = { ramp: ramp('#3a2210', '#6a4418', '#a8742a', '#dcae4a', '#fff0b0'), outline: hex('#1e1006'), shine: true };
const PORT_GLASS: Material = { ramp: ramp('#05141a', '#0a2630', '#14424e', '#246470', '#4a98a4'), outline: hex('#03090c'), shine: true, noAO: true };
const CANVAS: Material = { ramp: ramp('#2a2016', '#4e3e2a', '#766244', '#9c8660', '#bea880'), outline: hex('#120e08'), outlineLit: hex('#221a10') };
const RUBBER: Material = { ramp: ramp('#0c0c10', '#1a1a20', '#2a2a32', '#3e3e48'), outline: INK };
const GLOVE: Material = { ramp: ramp('#170f0c', '#2e2018', '#463224', '#5e4632'), outline: INK };
const LEAD: Material = { ramp: ramp('#12141a', '#262a34', '#3e4452', '#5a6272', '#7c8494'), outline: hex('#07080c'), outlineLit: hex('#14161e') };
const COPPER_TANK: Material = { ramp: ramp('#2a1208', '#4e2210', '#7a3a1a', '#b0602c', '#e8a060'), outline: hex('#140804'), shine: true };
const FACE: Material = { ramp: ramp('#2e1a1c', '#56302e', '#7e4c40', '#a06850'), outline: hex('#1a0e10'), noAO: true };
const GUN_STEEL: Material = { ramp: ramp('#22262f', '#444a5a', '#737d93', '#aab4c8', '#e8eef8'), outline: hex('#0c0e14'), shine: true };
const LAMP: Material = { ramp: ramp('#b88838', '#ffe6a0', '#fffbe8'), outline: hex('#4a3410'), emissive: 1, noAO: true };
const BUBBLE: Material = { ramp: ramp('#2a6a80', '#6ab8d0', '#b8ecff', '#f0ffff'), outline: hex('#0c2a38'), emissive: 0.25, noAO: true, shine: true, noOutline: true };
const WATER: Material = { ramp: ramp('#123a6a', '#1e64a0', '#3a9ad0', '#8ad4f4'), outline: hex('#08203a'), emissive: 0.15, noAO: true, shine: true, noOutline: true };

// Barnacle's.
const VERDIGRIS: Material = { ramp: ramp('#0a201c', '#18443a', '#2a7060', '#4ea08a', '#9ad8c0'), outline: hex('#051210'), outlineLit: hex('#0c2420'), shine: true };
const VERDI_TRIM: Material = { ramp: ramp('#0e1e16', '#24402e', '#3c6a48', '#6a9a6c', '#b0d4a8'), outline: hex('#060e0a'), shine: true, noAO: true };
const OLD_COPPER: Material = { ramp: ramp('#1e0e08', '#42200e', '#6c3a1a', '#9a5a2c', '#c8865a'), outline: hex('#0e0604'), shine: true };
const SEA_GLASS: Material = { ramp: ramp('#04120e', '#08241c', '#10402e', '#1e6248', '#3e9070'), outline: hex('#020906'), shine: true, noAO: true };
const SEA_SUIT: Material = { ramp: ramp('#0a1814', '#142c26', '#1f4438', '#2e5e4c', '#447c64'), outline: hex('#06120c'), outlineLit: hex('#0e1e16') };
const BARNACLE: Material = { ramp: ramp('#5c5648', '#9a9282', '#cec6b2', '#f2ecdc'), outline: hex('#24201a') };
const STARFISH: Material = { ramp: ramp('#5a160a', '#a83a18', '#e2703a', '#ffaa6a'), outline: hex('#260804') };
const KELP: Material = { ramp: ramp('#0a200e', '#16401c', '#286428', '#44903a'), outline: hex('#040e06') };

// ---------------------------------------------------------------------------
// Looks

/** A look's materials, by names the gear sets' dressing understands (see dress.ts). */
interface AquaMats {
  helm: Material;
  trim: Material;
  brass: Material;
  glass: Material;
  suit: Material;
  iron: Material;
  metal: Material;
  glove: Material;
  rubber: Material;
  face: Material;
}

export interface AquaLook {
  key: string;
  /** The wreck diver: barnacles, a starfish, kelp. */
  barnacle?: boolean;
  /** The lamp's light (and the bubbles' glint), brightest first. */
  light: [RGB, RGB, RGB, RGB];
  mats: AquaMats;
}

export const AQUANAUT_LOOK: AquaLook = {
  key: 'aquanaut',
  light: [hex('#fffbe8'), hex('#ffe6a0'), hex('#ffc050'), hex('#b8701e')],
  mats: { helm: BRASS_HELM, trim: BRASS_TRIM, brass: GUN_BRASS, glass: PORT_GLASS, suit: CANVAS, iron: LEAD, metal: COPPER_TANK, glove: GLOVE, rubber: RUBBER, face: FACE },
};

export const BARNACLE_LOOK: AquaLook = {
  key: 'aquanaut_barnacle',
  barnacle: true,
  light: [hex('#f4fff8'), hex('#b8f8dc'), hex('#4ee0a8'), hex('#1a7a5a')],
  mats: { helm: VERDIGRIS, trim: VERDI_TRIM, brass: VERDIGRIS, glass: SEA_GLASS, suit: SEA_SUIT, iron: LEAD, metal: OLD_COPPER, glove: GLOVE, rubber: RUBBER, face: FACE },
};

export const AQUANAUT_LOOKS = [AQUANAUT_LOOK, BARNACLE_LOOK];

/** The look being drawn; set by buildAquanautFrames. */
let S: AquaLook = AQUANAUT_LOOK;
const M = (): AquaMats => S.mats;

// ---------------------------------------------------------------------------
// The rig

/** A hand (or the way the gun points), in the rig's terms: `f` forward, `s` out to its own side, `h` up from the chest. */
interface Hand {
  f: number;
  s: number;
  h: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

interface Pose {
  lift: number;
  /** Upper body lowered. */
  breath: number;
  /** Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** The free hand and the gun hand. */
  a: Hand;
  b: Hand;
  /** Which way the gun points from the gun hand. */
  t: Hand;
  /** 0..1 the helmet lamp lit. */
  glow: number;
  /** A harpoon sits in the muzzle. */
  loaded: boolean;
  /** The chain runs out of the muzzle (the reel's harpoon is out). */
  chain: boolean;
  /** 0..1 the gun kicked back, and the puff at its muzzle. */
  recoil: number;
  muzzle: number;
  /** Bubbles out of the helmet's exhaust valve: how far the stream has risen (-1: none), and how many. */
  bub: number;
  bubs: number;
  tick: number;
  blink?: boolean;
  // The idle moment's extras (front view only).
  /** 0..1 the front porthole swung open on its hinge. */
  port?: number;
  /** 0..1 the sea water pouring out of it. */
  spill?: number;
}

type View = 'down' | 'up' | 'side';

/** The chest row in body coordinates, the height hands are posed from. */
const CH = 18;
/** The helmet's middle, in body rows. */
const HELM_Y = 9.4;

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

/** The gun's direction on screen, foreshortened when it points at or away from the viewer; also whether it dips behind the body. */
function gunDir(view: View, t: Hand): { x: number; y: number; k: number; away: boolean } {
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
  const k = Math.max(0.4, Math.hypot(x, y));
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

/** An arm: a thick canvas sleeve, a rubber cuff at the wrist, a heavy glove. */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], bias = 0): void {
  const m = M();
  const [ex, ey] = elbow(sx, sy, p.x, p.y, reach, hint);
  const wx = ex + (p.x - ex) * 0.72;
  const wy = ey + (p.y - ey) * 0.72;
  c.part();
  c.capsule(sx, sy, ex, ey, 2.1, 1.8, m.suit, { bias });
  c.part();
  c.capsule(ex, ey, wx, wy, 1.8, 1.6, m.suit, { bias });
  c.part();
  c.ellipse(wx, wy, 1.4, 1.2, m.rubber, { bias });
  glove(c, p.x, p.y, bias);
}

function glove(c: PixelCanvas, x: number, y: number, bias = 0): void {
  c.part();
  c.ellipse(x, y, 1.45, 1.35, M().glove, { bias });
}

/** A heavy lead boot: a round toe, a brass cap on it, a leather strap over the instep. */
function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  const m = M();
  c.part();
  c.ellipse(x, y, side ? 2.9 : 2.4, 1.6, m.iron, { flatten: 0.8, bias });
  c.part();
  if (side) {
    c.px(x - 2.4, y, m.trim, sphere(-0.6, 0.1), { bias });
    c.px(x - 2.4, y - 1, m.trim, sphere(-0.6, -0.3), { bias });
    c.line(x - 0.6, y - 1.2, x + 1.4, y - 1.2, LEATHER, () => sphere(0, -0.5), { bias });
  } else {
    c.px(x - 0.5, y + 0.6, m.trim, sphere(-0.2, 0.4), { bias });
    c.px(x + 0.5, y + 0.6, m.trim, sphere(0.2, 0.4), { bias });
    c.line(x - 1.6, y - 1, x + 1.4, y - 1, LEATHER, () => sphere(0, -0.5), { bias });
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

/** One bubble: a little ring of water light (a single glint when small). */
function bubble(c: PixelCanvas, x: number, y: number, big: boolean): void {
  c.part();
  if (big) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.px(x + dx, y + dy, BUBBLE, sphere(dx * 0.8, -dy * 0.8));
    c.spark(x - 1, y - 1, S.light[0], 0.55);
  } else {
    c.px(x, y, BUBBLE, sphere(-0.3, 0.4));
    c.spark(x, y, S.light[1], 0.3);
  }
}

/**
 * The stream out of the exhaust valve at (x, y): `bub` is how far the
 * newest bubble has risen, each older one a step above it, wobbling as they go.
 */
function bubbles(c: PixelCanvas, x: number, y: number, bub: number, n: number): void {
  if (bub < 0) return;
  for (let i = 0; i < n; i++) {
    const rise = bub - i * 4.5;
    if (rise < 0) continue;
    const by = y - rise;
    const bx = x + Math.round(Math.sin(rise * 0.7 + i * 2) * 1.1) - (rise > 6 ? 1 : 0);
    // Small out of the valve, big once clear of it, small again as it thins.
    bubble(c, bx, by, rise >= 2 && rise < 11);
  }
}

// ---------------------------------------------------------------------------
// The harpoon gun

interface GunState {
  loaded: boolean;
  chain: boolean;
  recoil: number;
  muzzle: number;
  tick: number;
}

/** The harpoon's barbed head pointing along (ux, uy) from (x, y), the tip `len` on. */
function harpoonHead(c: PixelCanvas, x: number, y: number, ux: number, uy: number, bias: number): void {
  const vx = -uy;
  const vy = ux;
  c.part();
  // The shank, then the broad leaf of the head and its tip, and a barb swept back either side.
  c.line(x, y, x + ux * 2.2, y + uy * 2.2, GUN_STEEL, () => sphere(vx * 0.4, -0.3), { bias });
  c.px(x + ux * 2.4 + vx * 0.8, y + uy * 2.4 + vy * 0.8, GUN_STEEL, sphere(vx * 0.7, vy * 0.7 - 0.2), { bias });
  c.px(x + ux * 2.4 - vx * 0.8, y + uy * 2.4 - vy * 0.8, GUN_STEEL, sphere(-vx * 0.7, -vy * 0.7 - 0.2), { bias });
  c.px(x + ux * 3.4, y + uy * 3.4, GUN_STEEL, sphere(ux * 0.4, -0.6), { bias });
  c.px(x + ux * 1.2 + vx * 1.6, y + uy * 1.2 + vy * 1.6, GUN_STEEL, sphere(vx, vy), { bias });
  c.px(x + ux * 1.2 - vx * 1.6, y + uy * 1.2 - vy * 1.6, GUN_STEEL, sphere(-vx, -vy), { bias });
}

/**
 * The gun in the hand at `p`, pointing along `d`: the walnut stock behind the
 * grip, the fat brass air chamber, the steel barrel, the reel drum hanging
 * under it, and (loaded) the harpoon's shaft and barbed head out of the
 * muzzle. The hand is drawn again over the grip.
 */
function drawGun(c: PixelCanvas, p: Placed, d: { x: number; y: number; k: number }, g: GunState, bias = 0): void {
  const m = M();
  const { x: ux, y: uy, k } = d;
  const vx = -uy;
  const vy = ux;
  // The drum hangs on the gun's underside: whichever side of it is lower on screen.
  const dn = vy >= 0 ? 1 : -1;
  const back = g.recoil * 1.4;
  const hx = p.x - ux * back;
  const hy = p.y - uy * back;
  const L = 7.4 * k;
  c.part();
  c.capsule(hx - ux * 3.4 * k + vx * dn * 0.6, hy - uy * 3.4 * k + vy * dn * 0.6, hx, hy, 1.05, 0.85, WOOD, { bias });
  c.part();
  c.capsule(hx - ux * 0.8, hy - uy * 0.8, hx + ux * L * 0.62, hy + uy * L * 0.62, 1.4, 1.25, m.brass, { bias });
  // A band round the chamber.
  c.part();
  const bx = hx + ux * L * 0.3;
  const by = hy + uy * L * 0.3;
  c.line(bx - vx * 1.2, by - vy * 1.2, bx + vx * 1.2, by + vy * 1.2, m.trim, () => sphere(ux * 0.3, -0.3), { bias });
  c.part();
  c.capsule(hx + ux * L * 0.5, hy + uy * L * 0.5, hx + ux * L, hy + uy * L, 0.85, 0.75, GUN_STEEL, { bias });
  // The reel drum, the chain wound on it.
  c.part();
  const rx = hx + ux * L * 0.32 + vx * dn * 1.7;
  const ry = hy + uy * L * 0.32 + vy * dn * 1.7;
  c.ellipse(rx, ry, 1.15, 1.1, GUN_STEEL, { bias });
  c.shade(rx, ry, -2);
  const mx = hx + ux * (L + 0.6);
  const my = hy + uy * (L + 0.6);
  if (g.loaded) {
    c.part();
    c.line(hx + ux * (L - 1), hy + uy * (L - 1), mx + ux * 1.4, my + uy * 1.4, GUN_STEEL, () => sphere(vx * 0.3, -0.4), { bias });
    harpoonHead(c, mx + ux * 1.4, my + uy * 1.4, ux, uy, bias);
  }
  if (g.chain) {
    // The chain paying out of the muzzle, links alternating light and dark.
    c.part();
    for (let i = 1; i <= 4; i++) c.px(mx + ux * i, my + uy * i, GUN_STEEL, sphere(vx * 0.4, -0.3), { bias: bias + (i % 2 ? 1 : -1) });
  }
  if (g.muzzle > 0) {
    // A puff of compressed air and bubbles at the muzzle.
    const [core, hot, mid] = S.light;
    c.spark(mx + ux, my + uy, core, g.muzzle);
    for (const [a, b] of [[1.5, 1.5], [2.2, -1.4], [3.2, 0.6], [1, -2.2]] as const) c.spark(mx + ux * a + vx * b, my + uy * a + vy * b, (g.tick + a) % 2 < 1 ? hot : mid, g.muzzle * 0.8);
  }
  glove(c, hx, hy, bias);
}

// ---------------------------------------------------------------------------
// The helmet

/** Barnacles on the copper: little cones, each with a dark mouth. */
function barnacles(c: PixelCanvas, spots: [number, number][]): void {
  if (!S.barnacle) return;
  c.part();
  spots.forEach(([x, y], i) => {
    c.px(x, y, BARNACLE, sphere(i % 2 ? 0.3 : -0.3, 0.5));
    if (i % 3 === 0) {
      c.px(x + 1, y, BARNACLE, sphere(0.5, 0.2));
      c.shade(x, y, -2);
    }
  });
}

/** The starfish clinging to the helmet: five arms round a middle. */
function starfish(c: PixelCanvas, x: number, y: number, small = false): void {
  if (!S.barnacle) return;
  c.part();
  const rows = small ? ['.#.', '###', '#.#'] : ['..#..', '.###.', '#####', '.#.#.', '#...#'];
  const h = rows.length;
  rows.forEach((row, ry) => [...row].forEach((ch, rx) => {
    if (ch !== '#') return;
    const dx = (rx - (h - 1) / 2) / h;
    const dy = (ry - (h - 1) / 2) / h;
    c.px(x + rx, y + ry, STARFISH, sphere(dx * 1.2, -dy * 1.2));
  }));
  c.shade(x + (h - 1) / 2, y + (h - 1) / 2, 1);
}

/** Kelp hanging from a point and swaying, `len` long. */
function kelp(c: PixelCanvas, x: number, y: number, len: number, tick: number, seed: number, bias = 0): void {
  if (!S.barnacle) return;
  c.part();
  for (let i = 0; i < len; i++) {
    const sway = Math.round(Math.sin(i * 0.9 + tick * 1.1 + seed) * (i / len) * 1.4);
    c.px(x + sway, y + i, KELP, sphere(sway * 0.4, 0.2), { bias });
    // A frond off the strand now and then.
    if (i > 1 && (i + seed) % 3 === 0) c.px(x + sway + (seed % 2 ? 1 : -1), y + i, KELP, sphere(seed % 2 ? 0.6 : -0.6, 0), { bias: bias - 1 });
  }
}

/** The face through the glass: dim, an eye or two catching the light. */
function face(c: PixelCanvas, x: number, y: number, rx: number, ry: number, eyes: [number, number][], blink: boolean | undefined, bright = false): void {
  c.part();
  c.ellipse(x, y, rx, ry, M().face, { bias: bright ? 1 : 0 });
  c.part();
  for (const [ex, ey] of eyes) {
    if (blink) c.shade(ex, ey, -1);
    else c.px(ex, ey, EYE);
  }
}

/** A porthole: a raised rim round a disc of glass. */
function porthole(c: PixelCanvas, x: number, y: number, rx: number, ry: number, rim = 0.8): void {
  const m = M();
  c.part();
  c.ellipse(x, y, rx + rim, ry + rim, m.trim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9, 0.7) });
  c.part();
  c.ellipse(x, y, rx, ry, m.glass, { normal: (_x, _y, dx, dy) => sphere(dx * 0.5, dy * 0.5, 1.2) });
}

/** The glint of the lamp light on a pane. */
function glint(c: PixelCanvas, x: number, y: number, k = 1): void {
  c.shade(x, y, 3);
  c.spark(x, y, S.light[0], 0.45 * k);
}

/** The lamp on the helmet's brow. */
function lamp(c: PixelCanvas, x: number, y: number, glow: number, wide: boolean): void {
  c.part();
  c.px(x, y + 1, M().trim, sphere(0, 0.5));
  if (wide) c.px(x + 1, y + 1, M().trim, sphere(0.3, 0.5));
  c.part();
  c.px(x, y, LAMP);
  if (wide) c.px(x + 1, y, LAMP);
  const [core, hot] = S.light;
  const k = 0.45 + glow * 0.55;
  c.spark(x, y, core, k);
  if (wide) c.spark(x + 1, y, core, k);
  if (glow > 0.5) glowAt(c, x + (wide ? 0.5 : 0), y - 1, (glow - 0.5) * 1.6);
  else c.spark(x, y - 1, hot, 0.25 * k);
}

/** The air hose, a rubber tube through these points. */
function hose(c: PixelCanvas, pts: [number, number][], bias = 0): void {
  const m = M();
  c.part();
  for (let i = 0; i < pts.length - 1; i++) c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0.9, 0.9, m.rubber, { bias });
  // Its wire binding catches the light here and there.
  for (let i = 1; i < pts.length - 1; i++) c.shade(pts[i][0], pts[i][1] - 0.5, 1);
}

/** From the front: the dome, the front porthole with his face behind it, the side ports, the lamp, the valve. */
function helmetDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const m = M();
  const hy = HELM_Y + U;
  // The hose, from the fitting on the back, loops over his left shoulder (our right) and down behind it.
  hose(c, [[cx + 4.2, hy - 2.4], [cx + 7.0, hy - 0.6], [cx + 7.6, hy + 2.6], [cx + 6.6, hy + 5.6]], -1);
  c.part();
  c.ellipse(cx, hy, 5.5, 5.2, m.helm, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.95 - 0.08) });
  // The breastplate's neck ring under the dome.
  c.part();
  c.shape(Math.round(hy + 4.4), Math.round(hy + 4.4), () => [cx - 4.4, cx + 4.4], m.trim, (_x, _y, t) => cyl(t, 0.5));
  // Side ports at either edge, seen almost edge on.
  for (const s of [-1, 1]) {
    c.part();
    c.ellipse(cx + s * 4.7, hy + 0.4, 0.95, 1.6, m.trim, { normal: (_x, _y, dx, dy) => sphere(s * 0.7 + dx * 0.3, dy * 0.8) });
    c.part();
    c.px(cx + s * 4.7 - (s < 0 ? 0 : 1), hy + 0.4, m.glass, sphere(s * 0.6, 0));
  }
  frontPort(c, cx - 0.5, hy + 0.9, p);
  // Bolts round the front port's rim.
  for (const [dx, dy] of [[-3.6, -2.2], [2.6, -2.2], [-3.6, 3.6], [2.6, 3.6]] as const) c.shade(cx + dx, hy + dy, -2);
  // The exhaust valve, high on his right side (our left).
  c.part();
  c.px(cx - 4.4, hy - 3.6, m.trim, sphere(-0.6, 0.5));
  c.px(cx - 5.2, hy - 4.2, m.trim, sphere(-0.7, 0.6));
  lamp(c, cx - 1, hy - 5.1, p.glow, true);
  barnacles(c, [[cx + 3, hy - 2], [cx - 4, hy + 2.6], [cx + 4, hy + 3], [cx - 2, hy - 4], [cx + 1, hy + 4]]);
  starfish(c, cx + 1, hy - 4);
}

/** The front porthole, its face, and (in the idle moment) swung open, the water pouring out. */
function frontPort(c: PixelCanvas, x: number, y: number, p: Pose): void {
  const m = M();
  const open = p.port ?? 0;
  if (open <= 0.05) {
    porthole(c, x, y, 2.3, 2.2);
    face(c, x, y + 0.4, 1.7, 1.5, [[x - 1.2, y - 0.2], [x + 0.6, y - 0.2]], p.blink);
    glint(c, x - 1.5, y - 1.4);
    return;
  }
  // The hole, rimmed, his face in it plain to see now.
  c.part();
  c.ellipse(x, y, 3.1, 3.0, m.trim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9, 0.7) });
  c.part();
  c.ellipse(x, y, 2.3, 2.2, RUBBER, { normal: (_x, _y, dx, dy) => sphere(-dx * 0.5, -dy * 0.5) });
  face(c, x, y + 0.3, 1.9, 1.8, [[x - 1.2, y - 0.3], [x + 0.6, y - 0.3]], p.blink, true);
  c.part();
  c.px(x - 0.5, y + 1.2, M().face, sphere(0, 0.5), { bias: -1 });
  // The glass swung out on its hinge at our left, edge on as it opens.
  const gx = x - 3.2 - open * 1.4;
  const w = Math.max(0.6, 2.3 * (1 - open * 0.8));
  c.part();
  c.ellipse(gx, y, w + 0.6, 2.9, m.trim, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7 - 0.4, dy * 0.8) });
  c.part();
  c.ellipse(gx, y, Math.max(0.5, w - 0.2), 2.1, m.glass, { normal: (_x, _y, dx, dy) => sphere(dx * 0.4 - 0.3, dy * 0.5) });
  glint(c, gx - 0.4, y - 1.2, 0.8);
  const k = p.spill ?? 0;
  if (k > 0) waterfall(c, x - 0.5, y + 2.4, k, p.tick);
}

/** Sea water pouring out of the open port, down his front to a splash at his feet. */
function waterfall(c: PixelCanvas, x: number, y: number, k: number, tick: number): void {
  const floor = 31;
  c.part();
  const end = y + (floor - y) * Math.min(1, k * 1.6);
  for (let yy = Math.round(y); yy <= end; yy++) {
    const wob = Math.round(Math.sin(yy * 0.8 + tick * 1.7) * 0.6);
    const wide = k > 0.55 ? 1 : 0;
    for (let dx = -wide; dx <= wide; dx++) {
      if (dx !== 0 && ((yy + tick) & 1)) continue;
      c.px(x + wob + dx, yy, WATER, sphere(dx * 0.6, 0.1));
    }
    if ((yy + tick) % 4 === 0) c.spark(x + wob, yy, S.light[1], 0.25);
  }
  if (end >= floor - 0.5) {
    // The splash and a spreading puddle at his feet.
    c.part();
    const w = 1.5 + k * 3.5;
    c.shape(floor, floor, () => [x - w, x + w], WATER, (_x, _y, t) => sphere(t * 0.5, -0.6, 1));
    for (const [dx, dy] of [[-2, -2], [2, -1], [-3, -1], [3, -3]] as const) if ((dx + tick) & 1) c.px(x + dx, floor + dy, WATER, sphere(dx * 0.3, 0.4));
  }
}

/** From behind: the back of the dome, the hose's fitting, the exhaust valve. */
function helmetUp(c: PixelCanvas, cx: number, U: number, _p: Pose): void {
  const m = M();
  const hy = HELM_Y + U;
  c.part();
  c.ellipse(cx, hy, 5.5, 5.2, m.helm, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.95 - 0.08) });
  c.part();
  c.shape(Math.round(hy + 4.4), Math.round(hy + 4.4), () => [cx - 4.4, cx + 4.4], m.trim, (_x, _y, t) => cyl(t, 0.5));
  // A seam down the back of the dome, and the side ports at its edges.
  for (let y = Math.round(hy - 4); y <= hy + 3; y++) c.shade(cx - 0.5, y, -1);
  for (const s of [-1, 1]) {
    c.part();
    c.ellipse(cx + s * 4.8, hy + 0.4, 0.8, 1.5, m.trim, { normal: (_x, _y, _dx, dy) => sphere(s * 0.8, dy * 0.8) });
  }
  // The air fitting at the back, and the hose from it down to the tank's valve.
  c.part();
  c.ellipse(cx + 1.6, hy - 1.6, 1.3, 1.2, m.trim);
  hose(c, [[cx + 1.8, hy - 1.4], [cx + 5.2, hy - 0.4], [cx + 6.2, hy + 2.8], [cx + 3.2, hy + 5.4]]);
  c.part();
  c.px(cx + 4.4, hy - 3.6, m.trim, sphere(0.6, 0.5));
  c.px(cx + 5.2, hy - 4.2, m.trim, sphere(0.7, 0.6));
  barnacles(c, [[cx - 3, hy - 2], [cx + 3, hy + 2.6], [cx - 4, hy + 3], [cx + 2, hy - 4], [cx - 1, hy + 2]]);
  starfish(c, cx - 5, hy - 3, true);
}

/** In profile, facing left: the dome, the front port jutting at the face, the side port with his cheek in it. */
function helmetSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  const m = M();
  const hy = HELM_Y + U;
  // The hose from the back fitting, out and down to the tank.
  hose(c, [[hx + 4.2, hy - 1.8], [hx + 6.6, hy - 0.2], [hx + 7.0, hy + 3.2], [hx + 5.6, hy + 5.6]], -1);
  c.part();
  c.ellipse(hx, hy, 5.1, 5.2, m.helm, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.95 - 0.08) });
  c.part();
  c.shape(Math.round(hy + 4.4), Math.round(hy + 4.4), () => [hx - 4.0, hx + 4.0], m.trim, (_x, _y, t) => cyl(t, 0.5));
  // The front port, standing proud of the dome at the face.
  c.part();
  c.ellipse(hx - 4.9, hy + 0.9, 1.4, 2.8, m.trim, { normal: (_x, _y, dx, dy) => sphere(-0.6 + dx * 0.4, dy * 0.8) });
  c.part();
  c.px(hx - 6, hy, m.glass, sphere(-0.8, 0.3));
  c.px(hx - 6, hy + 1, m.glass, sphere(-0.8, 0));
  c.px(hx - 6, hy + 2, m.glass, sphere(-0.8, -0.3));
  c.spark(hx - 6, hy, S.light[0], 0.4);
  // The side port facing us, his cheek and an eye behind it.
  porthole(c, hx - 0.4, hy + 0.6, 2.0, 2.0);
  face(c, hx - 1.4, hy + 1, 1.2, 1.4, [[hx - 2.2, hy + 0.2]], p.blink);
  glint(c, hx - 1.6, hy - 0.6);
  // The exhaust valve on top at the back, the lamp at the brow.
  c.part();
  c.px(hx + 2.6, hy - 4.6, m.trim, sphere(0.4, 0.6));
  c.px(hx + 3.2, hy - 5.4, m.trim, sphere(0.6, 0.7));
  c.part();
  c.ellipse(hx + 4.2, hy - 1.8, 1.0, 1.1, m.trim);
  lamp(c, hx - 3.6, hy - 4.6, p.glow, false);
  barnacles(c, [[hx + 2, hy - 2], [hx + 3, hy + 2.6], [hx - 3, hy - 3], [hx + 1, hy + 4], [hx + 4, hy + 1]]);
  starfish(c, hx - 1, hy - 5.4, true);
}

// ---------------------------------------------------------------------------
// The body (front and back)

/** The brass corselet over his shoulders, its wing nuts, the rubber gasket under its edge. */
function corselet(c: PixelCanvas, cx: number, U: number, back: boolean): void {
  const m = M();
  const top = Math.round(13.8 + U);
  c.part();
  const widths = [4.8, 5.9, 6.4, 6.3, 5.6];
  c.shape(top, top + 4, (y) => {
    const w = widths[Math.min(4, y - top)];
    return [cx - w, cx + w];
  }, m.helm, (_x, y, t) => sphere(t * 0.95, (y - top) / 4 - 0.55, 0.9));
  c.part();
  c.shape(top + 5, top + 5, () => [cx - 5.4, cx + 5.4], m.rubber, (_x, _y, t) => cyl(t, 0.3));
  // Wing nuts clamping it to the suit.
  c.part();
  for (const dx of back ? [-4.5, -1, 2.5] : [-4.6, 3.6]) {
    c.px(cx + dx, top + 3, m.trim, sphere(dx / 6, 0.2));
    c.shade(cx + dx, top + 3, 1);
  }
  if (!back) {
    // A little brass maker's plate on the front.
    c.part();
    c.shape(top + 3, top + 4, () => [cx - 1.6, cx + 1.6], m.trim, (_x, _y, t) => cyl(t * 0.5, 0.4));
    c.shade(cx - 1, top + 3, -1);
    c.shade(cx + 0.5, top + 3, -1);
  }
  barnacles(c, back ? [[cx - 5, top + 2], [cx + 4, top + 3]] : [[cx + 5, top + 2], [cx - 5, top + 3], [cx + 2, top + 1]]);
}

/** The canvas suit's body, the belt and its lead weights. */
function suitBody(c: PixelCanvas, cx: number, U: number, L: number, back: boolean, tick: number): void {
  const m = M();
  const top = Math.round(18 + U);
  const waist = Math.round(23 + U);
  c.part();
  c.shape(top, Math.round(25 + L), (y) => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = y <= waist ? 5.7 - 0.7 * u * u : 5.0;
    return [cx - hw, cx + hw];
  }, m.suit, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.7 - 0.25, 1));
  // Seams and folds in the heavy canvas.
  for (let y = top + 1; y < waist; y++) c.shade(cx - 0.5, y, -1);
  c.shade(cx - 3, top + 2, -1);
  c.shade(cx + 2, top + 3, -1);
  // The belt, and a lead weight on each hip and at the back.
  c.part();
  c.shape(waist, waist, () => [cx - 5.6, cx + 5.6], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  for (const [x0, x1] of back ? [[cx - 2, cx + 2]] : [[cx - 5.4, cx - 3.0], [cx + 3.0, cx + 5.4]]) {
    c.shape(waist - 1, waist + 1, () => [x0, x1], m.iron, (_x, y, t) => sphere(t * 0.7, (y - waist) * 0.5, 1));
  }
  if (!back) {
    c.part();
    c.px(cx - 1, waist, m.trim, sphere(-0.2, 0));
    c.px(cx, waist, m.trim, sphere(0.3, 0));
  }
  kelp(c, cx - 4, waist + 2, 4, tick, 1);
  kelp(c, cx + 3, waist + 2, 3, tick, 4);
}

/** The copper air tank on his back, strapped on, its valve wheel on top. */
function tank(c: PixelCanvas, cx: number, U: number): void {
  const m = M();
  const top = Math.round(14.4 + U);
  const bot = Math.round(23 + U);
  c.part();
  c.shape(top, bot, (y) => {
    const e = y - top < 1 || bot - y < 1 ? 2.4 : 3.6;
    return [cx - e, cx + e];
  }, m.metal, (_x, y, t) => sphere(t * 0.9, (y - top) / (bot - top) - 0.55, 1));
  // Straps over it.
  c.part();
  for (const y of [top + 2, bot - 2]) c.shape(y, y, () => [cx - 4, cx + 4], LEATHER, (_x, _y, t) => cyl(t, 0));
  // The valve and its wheel.
  c.part();
  c.px(cx - 0.5, top - 1, m.trim, sphere(0, 0.3));
  c.line(cx - 2, top - 2, cx + 1, top - 2, m.trim, () => sphere(0, 0.7));
  barnacles(c, [[cx - 2, top + 4], [cx + 2, bot - 4], [cx + 1, top + 5]]);
}

// ---------------------------------------------------------------------------
// Views

const REACH_FRONT = 4.6;
const REACH_SIDE = 5.3;

function legsFront(c: PixelCanvas, L: number, fa: number, fb: number, back: boolean): void {
  const m = M();
  const [l, r] = back ? [fb, fa] : [fa, fb];
  c.part();
  c.capsule(9.8, 24 + L, 9.5, 28.4 - l, 2.1, 1.85, m.suit);
  c.capsule(14.2, 24 + L, 14.5, 28.4 - r, 2.1, 1.85, m.suit);
  // Knee patches, darker.
  c.shade(9.5, 27 - l, -1);
  c.shade(14.5, 27 - r, -1);
  boot(c, 9.3, 30.2 - l);
  boot(c, 14.7, 30.2 - r);
}

const gunOf = (p: Pose): GunState => ({ loaded: p.loaded, chain: p.chain, recoil: p.recoil, muzzle: p.muzzle, tick: p.tick });

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const td = gunDir('down', p.t);
  const armA = () => arm(c, 6.4, 17.4 + U, fa, REACH_FRONT, [-0.6, 1], fa.behind ? -1 : 0);
  const armB = () => arm(c, 17.6, 17.4 + U, fb, REACH_FRONT, [0.6, 1], fb.behind ? -1 : 0);
  const gun = (bias = 0) => drawGun(c, fb, td, gunOf(p), bias);

  // The tank's shoulders peek out either side of the corselet.
  c.part();
  c.px(cx - 4, 14 + U, M().metal, sphere(-0.5, -0.6), { bias: -1 });
  c.px(cx + 3, 14 + U, M().metal, sphere(0.5, -0.6), { bias: -1 });
  const gunBack = td.away || fb.behind;
  if (fa.behind) armA();
  if (fb.behind) armB();
  if (gunBack) gun(-1);

  legsFront(c, L, p.footA, p.footB, false);
  suitBody(c, cx, U, L, false, p.tick);
  corselet(c, cx, U, false);
  kelp(c, cx - 5, 18 + U, 5, p.tick, 2);
  kelp(c, cx + 5, 18 + U, 4, p.tick, 5);
  helmetDown(c, cx, U, p);

  if (!fb.behind) armB();
  if (!gunBack) gun();
  if (!fa.behind) armA();
  bubbles(c, cx - 5.4, HELM_Y + U - 5.6, p.bub, p.bubs);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const td = gunDir('up', p.t);
  const armA = () => arm(c, 17.6, 17.4 + U, fa, REACH_FRONT, [0.6, 0.8], fa.behind ? -1 : 0);
  const armB = () => arm(c, 6.4, 17.4 + U, fb, REACH_FRONT, [-0.6, 0.8], fb.behind ? -1 : 0);
  const gun = (bias = 0) => drawGun(c, fb, td, gunOf(p), bias);

  const gunBack = td.away || fb.behind;
  if (fa.behind) armA();
  if (fb.behind) armB();
  if (gunBack) gun(-1);

  legsFront(c, L, p.footA, p.footB, true);
  suitBody(c, cx, U, L, true, p.tick);
  corselet(c, cx, U, true);
  tank(c, cx, U);
  kelp(c, cx - 5, 18 + U, 5, p.tick, 3);
  helmetUp(c, cx, U, p);

  if (!fb.behind) armB();
  if (!gunBack) gun();
  if (!fa.behind) armA();
  bubbles(c, cx + 5.4, HELM_Y + U - 5.6, p.bub, p.bubs);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const m = M();
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean;
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);
  const td = gunDir('side', p.t);
  const top = Math.round(18 + U);
  const waist = Math.round(23 + U);

  // The far arm behind everything, unless it reaches out in front.
  const armA = (bias: number) => arm(c, hx + 1.4, 17.2 + U, fa, REACH_SIDE, [0.3, 1], bias);
  if (fa.behind) armA(-1);
  // The gun swung back past the body goes behind it.
  const gunBack = td.x > 0.55 && fb.x > hx - 1;
  if (gunBack) drawGun(c, fb, td, gunOf(p), -1);

  // Legs: the far one in shade first, then the near.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  c.part();
  c.capsule(cx + 0.9, 24 + L, cx + 1 - p.footB, 28.6 - lift(p.footB), 1.9, 1.7, m.suit, { bias: -1 });
  boot(c, cx + 0.4 - p.footB, 30.2 - lift(p.footB), true, -1);
  c.part();
  c.capsule(cx - 0.7, 24 + L, cx - 0.5 - p.footA, 28.6 - lift(p.footA), 1.9, 1.7, m.suit);
  boot(c, cx - 1.2 - p.footA, 30.2 - lift(p.footA), true);

  // The tank on his back.
  c.part();
  c.shape(Math.round(14.4 + U), Math.round(23 + U), (y) => {
    const e = y - 14.4 - U < 1 || 23 + U - y < 1 ? 0.6 : 0;
    return [hx + 3.2 + e, hx + 6.6 - e];
  }, m.metal, (_x, y, t) => sphere(t * 0.9, (y - 14.4 - U) / 8.6 - 0.55, 1));
  c.part();
  for (const y of [Math.round(16.4 + U), Math.round(21 + U)]) c.shape(y, y, () => [hx + 2.6, hx + 6.8], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(hx + 4.5, 13.4 + U, m.trim, sphere(0, 0.4));
  c.line(hx + 3.5, 12.6 + U, hx + 5.5, 12.6 + U, m.trim, () => sphere(0, 0.7));
  barnacles(c, [[hx + 5, 18 + U], [hx + 4, 21 + U]]);

  // The suit in profile, the belt and its weight, the corselet over the shoulders.
  c.part();
  c.shape(top, Math.round(25 + L), (y) => {
    const k = Math.max(0, Math.min(1, (y - waist) / 2));
    const x = hx + (cx - hx) * k;
    return [x - 4.2, x + 3.6];
  }, m.suit, (_x, y, t) => sphere(t * 0.9 - 0.1, ((y - top) / 7) * 0.7 - 0.25, 1));
  c.shade(hx - 1, top + 2, -1);
  c.part();
  c.shape(waist, waist, () => [hx - 4.4, hx + 3.8], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.shape(waist - 1, waist + 1, () => [hx - 3.4, hx - 1.0], m.iron, (_x, y, t) => sphere(t * 0.7, (y - waist) * 0.5, 1));
  c.part();
  const ct = Math.round(13.8 + U);
  const cw = [3.6, 4.4, 4.8, 4.7, 4.2];
  c.shape(ct, ct + 4, (y) => {
    const w = cw[Math.min(4, y - ct)];
    return [hx - w - 0.3, hx + w - 0.6];
  }, m.helm, (_x, y, t) => sphere(t * 0.95, (y - ct) / 4 - 0.55, 0.9));
  c.part();
  c.shape(ct + 5, ct + 5, () => [hx - 4.4, hx + 3.6], m.rubber, (_x, _y, t) => cyl(t, 0.3));
  c.part();
  c.px(hx - 3.4, ct + 3, m.trim, sphere(-0.5, 0.2));
  c.px(hx + 2.4, ct + 3, m.trim, sphere(0.4, 0.2));
  kelp(c, hx + 3, ct + 4, 5, p.tick, 6);
  kelp(c, hx - 2, waist + 2, 4, p.tick, 1);

  helmetSide(c, hx, U, p);

  if (!fa.behind) armA(0);
  // The near arm last, the gun in its hand.
  arm(c, hx + 0.2, 17.6 + U, fb, REACH_SIDE, [0.4, 1], 0);
  if (!gunBack) drawGun(c, fb, td, gunOf(p));
  bubbles(c, hx + 3.6, HELM_Y + U - 6.4, p.bub, p.bubs);
}

// ---------------------------------------------------------------------------
// Animations

/** The free hand easy at the side. */
const REST_A = H(0.8, 4.6, -3.4);
/** The gun held at the hip, pointing ahead and a little down. */
const GUN_B = H(1.8, 4.8, -1.6);
const GUN_T = H(1, 0.2, -0.3);
/** Seen from the front or back, the gun is held across the body so it reads, not end on. */
const GUN_T_FRONT = H(0.7, 0.9, -0.45);
/** Both hands on the gun, levelled at the hip to fire. */
const AIM_B = H(2.6, 3.0, 0.2);
const AIM_A = H(4.4, -1.4, -0.2);
const AIM_T = H(1, 0, 0);

/** Side-view hands: a little further forward, both at the body's line. */
const side = (h: Hand, arm: 'a' | 'b'): Hand => H(h.f + (arm === 'b' ? 0.6 : 0.4), 0, h.h);

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: view === 'side' ? side(REST_A, 'a') : { ...REST_A },
  b: view === 'side' ? side(GUN_B, 'b') : { ...GUN_B },
  t: { ...(view === 'side' ? GUN_T : GUN_T_FRONT) },
  glow: 0.25,
  loaded: true,
  chain: false,
  recoil: 0,
  muzzle: 0,
  bub: -1,
  bubs: 3,
  tick: 0,
});

/** Breathing in the suit, the lamp flickering, and one bubble wobbling up out of the valve each time round. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  const RISE = [-1, -1, 0, 3, 7, 11];
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.tick = f;
    p.blink = f === 4;
    p.glow = 0.25 + 0.15 * Math.sin(ph);
    p.b.h += Math.sin(ph) * 0.4;
    p.bub = RISE[f];
    p.bubs = 1;
    frames.push(p);
  }
  return frames;
}

/** A heavy, rolling stomp in the lead boots. */
function walk(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    // He sinks into each step rather than bobbing up off it.
    p.breath = Math.abs(s) > 0.8 ? 1 : 0;
    p.tick = f;
    if (view === 'side') {
      p.footA = Math.round(s * 2);
      p.footB = -p.footA;
      p.lean = 1;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
    }
    p.a.f -= s * 1.1;
    p.b.h += p.breath * 0.4;
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
  lean?: number;
  breath?: number;
  lift?: number;
  step?: number;
  loaded?: boolean;
  chain?: boolean;
  recoil?: number;
  muzzle?: number;
  bub?: number;
  bubs?: number;
}

/** An action as keyframes; anything left out stays at rest. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k, i) => {
      const p = base(view);
      if (k.a) p.a = view === 'side' ? { ...(k.aSide ?? side(k.a, 'a')) } : { ...k.a };
      if (k.b) p.b = view === 'side' ? { ...(k.bSide ?? side(k.b, 'b')) } : { ...k.b };
      if (k.t) p.t = { ...k.t };
      p.glow = k.glow ?? 0.25;
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
      p.loaded = k.loaded ?? true;
      p.chain = !!k.chain;
      p.recoil = k.recoil ?? 0;
      p.muzzle = k.muzzle ?? 0;
      p.bub = k.bub ?? -1;
      p.bubs = k.bubs ?? 3;
      p.tick = i;
      const step = k.step ?? 0;
      if (view === 'side') {
        p.lean = k.lean ?? 0;
        p.footA = 1 + step;
        p.footB = -1 - Math.round(step * 0.5);
      } else p.footA = step > 0 ? 1 : 0;
      return p;
    });
}

/** The supporting hand under the barrel, in profile. */
const AIM_A_SIDE = H(4.6, 0, 0.1);

/**
 * The harpoon: the gun swung up and levelled in both hands, the shot (it
 * kicks back hard, a puff at the muzzle), and the free hand slides the next
 * harpoon into the muzzle before he lowers it.
 */
const fire = action([
  { b: AIM_B, a: AIM_A, aSide: AIM_A_SIDE, t: AIM_T, lean: 0, breath: 1 },
  { b: AIM_B, a: AIM_A, aSide: AIM_A_SIDE, t: AIM_T, loaded: false, recoil: 1, muzzle: 1, lean: -1 },
  { b: AIM_B, a: AIM_A, aSide: AIM_A_SIDE, t: H(1, 0, 0.12), loaded: false, recoil: 0.5, muzzle: 0.45, lean: -1 },
  { b: H(2.2, 3.4, 0), a: H(5.2, -1, 0.6), aSide: H(6.2, 0, 0.6), t: AIM_T, loaded: false },
  { b: H(2.2, 3.4, 0), a: H(5.6, -0.6, 0.4), aSide: H(6.6, 0, 0.4), t: AIM_T },
  { b: H(2, 4.2, -0.8), a: H(2, 3, -2), t: H(1, 0.1, -0.15) },
]);

/** The reel: braced low, the chained harpoon fired. */
const hook = action([
  { b: AIM_B, a: AIM_A, aSide: AIM_A_SIDE, t: AIM_T, breath: 1, step: 1 },
  { b: AIM_B, a: AIM_A, aSide: AIM_A_SIDE, t: AIM_T, loaded: false, chain: true, recoil: 1, muzzle: 0.8, breath: 1, step: 1, lean: -1 },
  { b: AIM_B, a: AIM_A, aSide: AIM_A_SIDE, t: AIM_T, loaded: false, chain: true, recoil: 0.4, muzzle: 0.3, breath: 1, step: 1 },
]);

/** Then cranking the reel round, the gun braced at the hip, leaning back against the pull. */
function crank(view: View): Pose[] {
  const keys: Key[] = [];
  for (let i = 0; i < 4; i++) {
    const th = (i / 4) * Math.PI * 2;
    const c = Math.cos(th);
    const s = Math.sin(th);
    keys.push({
      b: H(2.4, 3.2, 0),
      t: AIM_T,
      a: H(3.4 + c * 0.6, 1.4, -1 + s * 1.1),
      aSide: H(2.8 + c * 0.9, 0, -1.2 + s * 1.1),
      loaded: false,
      chain: true,
      breath: i % 2,
      step: 1,
      lean: -1,
    });
  }
  return action(keys)(view);
}

/**
 * Torpedo, the Special's pose: he reaches back and wrenches open the tank's
 * valve, bubbles boiling out of the helmet and the lamp blazing, then
 * thrusts the gun down at the ground ahead to send the torpedo off.
 */
const surge = action([
  { a: H(-1.2, 3.6, 3.2), aSide: H(-1.8, 0, 3.4), glow: 0.4, breath: 1 },
  { a: H(-1.8, 3, 4), aSide: H(-2.2, 0, 4), glow: 0.7, bub: 2, bubs: 2 },
  { a: H(-1.8, 3.2, 3.6), aSide: H(-2.2, 0, 3.6), glow: 0.9, bub: 6, bubs: 3, lift: 1 },
  { b: H(3, 3, -1), a: H(4.4, -1.2, -1.6), aSide: H(4.6, 0, -1.4), t: H(1, 0, -0.45), glow: 1, bub: 10, bubs: 3, lean: 1, step: 1, recoil: 1, muzzle: 1, loaded: false },
  { b: H(3, 3, -1), a: H(4.4, -1.2, -1.6), aSide: H(4.6, 0, -1.4), t: H(1, 0, -0.45), glow: 1, bub: 14, bubs: 4, lean: 1, step: 1, recoil: 0.5, muzzle: 0.6, loaded: false },
  { b: H(2.6, 3.4, -0.8), a: H(3, 2, -1.8), t: H(1, 0, -0.3), glow: 0.8, bub: 18, bubs: 4, lean: 1, step: 1, loaded: false },
]);

// ---------------------------------------------------------------------------
// The idle moment (`rest`), played facing us when he has stood still a while.
// It starts and ends on idle's first frame so it slips in and out unseen.

/** Idle's first frame, with changes. */
const still = (o: Partial<Pose> = {}): Pose => ({ ...idle('down')[0], ...o });

/** The gun let down at his side while he sees to the helmet. */
const DOWN_B = H(0.4, 5, -3.8);
const DOWN_T = H(0.3, 0.3, -1);
/** The free hand at the front port's catch, and holding it swung open. */
const PORT_A = H(2.6, 1.6, 7.6);
const OPEN_A = H(2.4, 4.2, 7.6);

/**
 * He has a leak: he lowers the gun, unlatches the front porthole and swings
 * it open, and the sea that got in pours out down his front in a gush that
 * dwindles to a trickle, his face plain to see, blinking. He swings it shut,
 * gives the dome two knocks for luck, and the helmet burps out a stream of
 * bubbles.
 */
function leak(view: View): Pose[] {
  if (view !== 'down') return [];
  const g = { b: DOWN_B, t: DOWN_T };
  return [
    still(),
    still({ ...g, a: H(1.8, 3.4, 4), tick: 1 }),
    still({ ...g, a: PORT_A, tick: 2 }),
    // The catch gives: a first gush.
    still({ ...g, a: H(2.4, 2.8, 7.6), port: 0.45, spill: 0.35, breath: 1, tick: 3 }),
    still({ ...g, a: OPEN_A, port: 1, spill: 0.75, tick: 4 }),
    still({ ...g, a: OPEN_A, port: 1, spill: 1, tick: 5 }),
    still({ ...g, a: OPEN_A, port: 1, spill: 0.6, tick: 6 }),
    // A trickle, and a blink.
    still({ ...g, a: OPEN_A, port: 1, spill: 0.25, blink: true, tick: 7 }),
    // Shut again.
    still({ ...g, a: H(2.4, 2.6, 7.6), port: 0.4, tick: 8 }),
    still({ ...g, a: PORT_A, tick: 9 }),
    // Two knocks on the dome.
    still({ ...g, a: H(1.2, 3.2, 11.4), tick: 10 }),
    still({ ...g, a: H(1.2, 2.8, 10.6), breath: 1, tick: 11 }),
    // The helmet burps out its bubbles.
    still({ ...g, a: H(1, 4.2, -2.4), bub: 3, bubs: 4, tick: 12 }),
    still({ ...g, a: REST_A, bub: 8, bubs: 4, tick: 13 }),
    still({ a: REST_A, bub: 13, bubs: 4, tick: 14 }),
  ];
}
const LEAK_ORDER = [0, 1, 2, 2, 3, 4, 5, 4, 5, 6, 6, 7, 7, 7, 8, 9, 10, 11, 10, 11, 12, 13, 14, 0];

// ---------------------------------------------------------------------------
// Frame generation

export type AquaAnim = 'idle' | 'walk' | 'fire' | 'hook' | 'crank' | 'surge' | 'rest';

interface AquaAnimDef {
  name: AquaAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Frames played in this order, some held or repeated. */
  order?: readonly number[];
}

/** Frame rates the hero's timings are built on (see game/Aquanaut.ts). */
export const AQUA_FPS = { fire: 11, hook: 12, crank: 12 } as const;

export const AQUANAUT_ANIMS: AquaAnimDef[] = [
  { name: 'idle', fps: 6, loop: true, poses: idle },
  { name: 'walk', fps: 8, loop: true, poses: walk },
  { name: 'fire', fps: AQUA_FPS.fire, loop: false, poses: fire },
  { name: 'hook', fps: AQUA_FPS.hook, loop: false, poses: hook },
  { name: 'crank', fps: AQUA_FPS.crank, loop: true, poses: crank },
  { name: 'surge', fps: 10, loop: false, poses: surge },
  { name: 'rest', fps: 8, loop: false, poses: leak, order: LEAK_ORDER },
];

export const aquanautAnims = (): AquaAnimDef[] => AQUANAUT_ANIMS;

/** Frame counts and the frame each shot leaves the muzzle on. */
export const AQUA_FRAMES = { fire: 6, hook: 3 } as const;
export const AQUA_RELEASE = { fire: 1, hook: 1 } as const;

export interface AquaFrame {
  key: string;
  anim: AquaAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawAquaFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(AQUA_W, AQUA_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildAquanautFrames(look: AquaLook = AQUANAUT_LOOK): AquaFrame[] {
  S = look;
  const out: AquaFrame[] = [];
  for (const a of AQUANAUT_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawAquaFrame(dir, pose) });
      });
    }
  }
  S = AQUANAUT_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// The harpoon in flight and stuck in the ground, and the torpedo

export const HARPOON_DIRS = 16;
export const HARPOON_SIZE = 22;
export const TORPEDO_DIRS = 16;
export const TORPEDO_SIZE = 24;
/** The torpedo's propeller frames per heading. */
export const TORPEDO_SPIN = 2;

/**
 * A harpoon flying along heading `i` (sixteenths of a turn from the right,
 * clockwise): a steel shaft, a brass collar and the eye the chain or line is
 * made fast to at its tail, the barbed head at its front.
 */
export function harpoonFrame(i: number, look: AquaLook = AQUANAUT_LOOK): PixelCanvas {
  const c = new PixelCanvas(HARPOON_SIZE, HARPOON_SIZE);
  const a = (i / HARPOON_DIRS) * Math.PI * 2;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const vx = -uy;
  const vy = ux;
  const cx = HARPOON_SIZE / 2;
  const cy = HARPOON_SIZE / 2;
  c.part();
  c.line(cx - ux * 7, cy - uy * 7, cx + ux * 4, cy + uy * 4, GUN_STEEL, () => sphere(vx * 0.3, -0.5));
  c.part();
  c.ellipse(cx - ux * 7.6, cy - uy * 7.6, 1.0, 1.0, look.mats.trim);
  c.erase(Math.floor(cx - ux * 7.6), Math.floor(cy - uy * 7.6));
  c.part();
  c.px(cx - ux * 4.5, cy - uy * 4.5, look.mats.brass, sphere(vx * 0.5, -0.4));
  c.px(cx - ux * 4.5 + vx * 0.7, cy - uy * 4.5 + vy * 0.7, look.mats.brass, sphere(vx * 0.8, vy * 0.8));
  harpoonHead(c, cx + ux * 4, cy + uy * 4, ux, uy, 1);
  return c;
}

/** The harpoon spent: driven into the ground head first, leaning back the way it came (k: 0 leans left, 1 upright, 2 right). */
export function stuckHarpoonFrame(k: number, look: AquaLook = AQUANAUT_LOOK): PixelCanvas {
  const c = new PixelCanvas(HARPOON_SIZE, HARPOON_SIZE);
  const foot = HARPOON_SIZE - 2;
  const cx = HARPOON_SIZE / 2;
  const lean = (k - 1) * 4.5;
  const tx = cx + lean;
  const ty = foot - 11 + Math.abs(lean) * 0.4;
  c.part();
  c.line(cx, foot, tx, ty, GUN_STEEL, (n, N) => sphere(-0.4, n / N - 0.5));
  c.part();
  c.ellipse(tx, ty - 0.8, 1.0, 1.0, look.mats.trim);
  c.erase(Math.floor(tx), Math.floor(ty - 0.8));
  c.part();
  const bx = cx + lean * 0.35;
  const by = foot - 3.6;
  c.px(bx, by, look.mats.brass, sphere(-0.3, -0.2));
  // A tuft of turned earth round the foot, and the barbs just showing.
  c.part();
  c.px(cx - 1, foot, GUN_STEEL, sphere(-0.7, 0.2));
  c.px(cx + 1, foot, GUN_STEEL, sphere(0.7, 0.2));
  c.part();
  for (const dx of [-2, -1, 1, 2]) c.px(cx + dx, foot + 1, WOOD, sphere(dx * 0.3, 0.6), { bias: -1 });
  return c;
}

/**
 * The steam torpedo running along heading `i`: a brass hull banded in trim,
 * a steel nose, fins and a propeller at its tail (blades across or along, by
 * `spin`), a running light lit on its back.
 */
export function torpedoFrame(i: number, spin: number, look: AquaLook = AQUANAUT_LOOK): PixelCanvas {
  const c = new PixelCanvas(TORPEDO_SIZE, TORPEDO_SIZE);
  const a = (i / TORPEDO_DIRS) * Math.PI * 2;
  const ux = Math.cos(a);
  const uy = Math.sin(a) * 0.75;
  const vx = -Math.sin(a);
  const vy = Math.cos(a) * 0.75;
  const cx = TORPEDO_SIZE / 2;
  const cy = TORPEDO_SIZE / 2 + 1;
  const m = look.mats;
  const fins = () => {
    c.part();
    for (const s of [-1, 1]) {
      c.line(cx - ux * 4.4 + vx * s * 1.6, cy - uy * 4.4 + vy * s * 1.6, cx - ux * 5.8 + vx * s * 3, cy - uy * 5.8 + vy * s * 3, m.trim, () => sphere(vx * s * 0.6, vy * s * 0.6 - 0.2));
    }
    // The top fin, standing up.
    c.line(cx - ux * 4.4, cy - uy * 4.4 - 1.4, cx - ux * 5.6, cy - uy * 5.6 - 3, m.trim, () => sphere(0, 0.8));
  };
  const prop = () => {
    c.part();
    const px = cx - ux * 6.8;
    const py = cy - uy * 6.8;
    c.px(px, py, GUN_STEEL, sphere(0, 0));
    if (spin % 2 === 0) {
      c.px(px, py - 1.5, GUN_STEEL, sphere(0, 0.8));
      c.px(px, py + 1.5, GUN_STEEL, sphere(0, -0.6));
    } else {
      c.px(px + vx * 1.6, py + vy * 1.6, GUN_STEEL, sphere(vx, 0));
      c.px(px - vx * 1.6, py - vy * 1.6, GUN_STEEL, sphere(-vx, 0));
    }
  };
  // Facing away from us, its tail is in front: draw tail parts last.
  const away = uy < -0.1;
  if (!away) {
    prop();
    fins();
  }
  c.part();
  c.capsule(cx - ux * 4.6, cy - uy * 4.6, cx + ux * 3.4, cy + uy * 3.4, 2.4, 2.4, m.helm);
  // Bands round the hull.
  c.part();
  for (const at of [-2.2, 1.2]) {
    for (let o = -2; o <= 2; o++) {
      const x = cx + ux * at + vx * o * 0.9;
      const y = cy + uy * at + vy * o * 0.9 + (Math.abs(o) === 2 ? 0 : -0.3);
      if (c.filled(Math.floor(x), Math.floor(y))) c.px(x, y, m.trim, sphere(vx * o * 0.4, -0.3 + Math.abs(o) * 0.15));
    }
  }
  // The steel nose cone.
  c.part();
  c.capsule(cx + ux * 3.6, cy + uy * 3.6, cx + ux * 5.6, cy + uy * 5.6, 1.9, 0.9, GUN_STEEL);
  // The running light on its back.
  c.part();
  c.px(cx - ux * 0.6, cy - uy * 0.6 - 2.2, LAMP);
  c.spark(cx - ux * 0.6, cy - uy * 0.6 - 2.2, look.light[0], 0.9);
  if (away) {
    fins();
    prop();
  }
  barnacleOn(c, look, cx, cy, ux, uy);
  return c;
}

/** Barnacle's torpedo is as crusted as he is. */
function barnacleOn(c: PixelCanvas, look: AquaLook, cx: number, cy: number, ux: number, uy: number): void {
  if (!look.barnacle) return;
  c.part();
  c.px(cx - ux * 3, cy - uy * 3 - 1, BARNACLE, sphere(0, 0.5));
  c.px(cx + ux * 0.5, cy + uy * 0.5 + 1, BARNACLE, sphere(0.3, 0.3));
  c.px(cx + ux * 2, cy + uy * 2 - 1.5, STARFISH, sphere(0, 0.6));
}

// ---------------------------------------------------------------------------
// Button icons (16x16, outlined, lit from the top left like the other ability icons)

interface IconTones {
  brass: [string, string, string];
  steel: [string, string, string];
  wood: string;
  spray: [string, string];
  chain: [string, string];
}

const ICON_TONES: IconTones = {
  brass: ['#fff0b0', '#dcae4a', '#8e6226'],
  steel: ['#e8eef8', '#aab4c8', '#5c6880'],
  wood: '#7d4f33',
  spray: ['#e8fbff', '#6ad8f4'],
  chain: ['#c8d2e2', '#6c7688'],
};

const BARNACLE_TONES: IconTones = {
  brass: ['#b0e4c8', '#4ea08a', '#1c4a40'],
  steel: ['#e8eef8', '#aab4c8', '#5c6880'],
  wood: '#5a3a24',
  spray: ['#f4fff8', '#4ee0a8'],
  chain: ['#c8d8d0', '#5e7a6e'],
};

const tonesOf = (look: AquaLook): IconTones => (look.barnacle ? BARNACLE_TONES : ICON_TONES);

/** The harpoon: the gun seen from the side, aimed up and right, a barbed harpoon just leaving its muzzle in a puff of bubbles. */
export function harpoonIcon(look: AquaLook = AQUANAUT_LOOK): Uint8ClampedArray {
  const k = tonesOf(look);
  const { px, put, outline } = iconPainter();
  // The stock at the lower left, the fat chamber, the barrel.
  for (const [x, y] of [[1, 14], [2, 13], [2, 14], [3, 13]] as const) put(x, y, k.wood);
  for (let i = 0; i < 5; i++) {
    put(3 + i, 12 - i, k.brass[i < 2 ? 1 : 0]);
    put(4 + i, 12 - i, k.brass[1]);
    put(4 + i, 13 - i, k.brass[2]);
  }
  put(8, 7, k.steel[1]);
  put(9, 6, k.steel[0]);
  put(9, 7, k.steel[2]);
  // The reel drum under it.
  put(5, 13, k.steel[1]);
  put(6, 13, k.steel[2]);
  outline('#0c0806');
  // The harpoon flying out: shaft and barbed head.
  for (let i = 0; i < 3; i++) put(10 + i, 5 - i, k.steel[1]);
  for (const [x, y, c] of [[13, 2, 0], [14, 1, 0], [15, 0, 0], [12, 1, 1], [14, 3, 1]] as const) put(x, y, k.steel[c]);
  // Bubbles off the muzzle.
  put(10, 8, k.spray[0]);
  put(12, 7, k.spray[1]);
  put(8, 4, k.spray[1]);
  put(11, 10, k.spray[1]);
  return px;
}

/** The reel: a barbed hook on a chain, the chain curling back in a loop to a drum. */
export function reelIcon(look: AquaLook = AQUANAUT_LOOK): Uint8ClampedArray {
  const k = tonesOf(look);
  const { px, put, outline } = iconPainter();
  // The drum, lower left.
  for (let y = 10; y <= 14; y++) for (let x = 1; x <= 5; x++) if ((x - 3) ** 2 + (y - 12) ** 2 <= 5) put(x, y, (x + y) < 14 ? k.brass[0] : k.brass[1]);
  put(3, 12, k.brass[2]);
  // The harpoon head, upper right, pointing back at the drum (it's coming home).
  for (const [x, y, c] of [[12, 3, 0], [13, 2, 0], [14, 1, 0], [11, 2, 1], [13, 4, 1], [15, 0, 1]] as const) put(x, y, k.steel[c]);
  outline('#0c0806');
  // The chain between them in a curve, links alternating.
  const pts: [number, number][] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const x = 5 + (11 - 5) * t + Math.sin(t * Math.PI) * 2.6;
    const y = 10 + (3 - 10) * t + Math.sin(t * Math.PI) * 2.2;
    pts.push([Math.round(x), Math.round(y)]);
  }
  pts.forEach(([x, y], i) => put(x, y, i % 2 ? k.chain[0] : k.chain[1]));
  // A curl of motion past the hook.
  put(9, 1, k.spray[1]);
  put(10, 0, k.spray[0]);
  return px;
}
