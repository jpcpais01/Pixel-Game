// The Deep Diver (the Automaton's third type): an old brass-and-copper
// standard diving dress walking about on dry land. A great round copper
// helmet with three glowing portholes (the face glass in front, one either
// side), a riveted breastplate with wing nuts, a canvas suit gone stiff with
// salt, leather gloves, lead weights on the belt and great lead boots with
// brass toes. An air pump on its back feeds the helmet through a ribbed hose
// (its gauge is the Automaton's heat); a harpoon gun is strapped along its
// left forearm; and it carries a ship's anchor over its shoulder like a
// pickaxe, its chain hanging from the ring.
//
// The Barnacle skin is the same diver after a century on the sea bed: the
// copper gone verdigris green, the canvas rotted dark, pink coral grown over
// the helmet's crown, barnacles crusting everything, a starfish clinging to
// its brow, kelp trailing from shoulders and belt, a glowing anemone on its
// shoulder, and an anchor gone to rust and shells.
//
// Also here: the anchor and the harpoon as they fly (sixteen headings each),
// and the button icons. Three views like every hero: down, up, and the side
// view drawn facing left and mirrored for right. Frames are DIVER_W x
// DIVER_H with the 24x32 body box at BODY_X/BODY_Y (the anchor and the big
// overhead swing need the room round it).

import { PixelCanvas, cyl, hex, sphere, type DrawOpts, type Material, type RGB, type Vec3 } from './pixel';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const DIVER_W = 60;
export const DIVER_H = 56;
/** The body box's top-left corner in the frame. */
const BODY_X = 18;
const BODY_Y = 20;
export const DIVER_ORIGIN_X = BODY_X + 12;
export const DIVER_ORIGIN_Y = BODY_Y + 31;
/** The hands' height above the feet, where the anchor's chain and the harpoon's line leave from. */
export const DIVER_HAND_Y = 12;
/** The helmet's middle above the feet (the portholes' light). */
export const DIVER_HELM_Y = 23;

// ---------------------------------------------------------------------------
// Materials

interface Kit {
  /** Helmet and breastplate. */
  helm: Material;
  /** Fittings: porthole rims, bolts, the gun, the pump. */
  trim: Material;
  suit: Material;
  glove: Material;
  lead: Material;
  glass: Material;
  hose: Material;
  iron: Material;
}

const BASE: Kit = {
  helm: { ramp: ramp('#3a1a0c', '#743618', '#b0602e', '#e09454', '#ffd6a6'), outline: hex('#170804'), outlineLit: hex('#2a1008'), shine: true },
  trim: { ramp: ramp('#3e2608', '#7a5016', '#bc8a2a', '#ecc456', '#fff4b0'), outline: hex('#190f02'), outlineLit: hex('#2a1a06'), shine: true },
  suit: { ramp: ramp('#2a2620', '#48422f', '#6e664c', '#968c6c', '#bcb290'), outline: hex('#12100a'), outlineLit: hex('#1c1a12') },
  glove: { ramp: ramp('#1c1009', '#3a2213', '#5c3a20', '#7c5432'), outline: hex('#0a0503') },
  lead: { ramp: ramp('#121419', '#232731', '#3a404e', '#5a6274', '#8890a4'), outline: hex('#05060a'), outlineLit: hex('#0e1016'), shine: true },
  glass: { ramp: ramp('#06343c', '#127482', '#2cb8c8', '#8af0f4', '#eaffff'), outline: hex('#031418'), emissive: 0.8, noAO: true },
  hose: { ramp: ramp('#100f0e', '#211f1c', '#36332e', '#504c44'), outline: hex('#050504') },
  iron: { ramp: ramp('#0e1216', '#1c242e', '#323e4c', '#536276', '#8a9aae'), outline: hex('#04060a'), outlineLit: hex('#0a0e14'), shine: true },
};

const SEA: Kit = {
  helm: { ramp: ramp('#0c2620', '#1c4a3e', '#357a64', '#62ac8e', '#a6dec0'), outline: hex('#04100c'), outlineLit: hex('#0a1c16'), shine: true },
  trim: { ramp: ramp('#22240e', '#46501e', '#6e7a36', '#9eaa5a', '#d0d890'), outline: hex('#0e1004'), outlineLit: hex('#181c08'), shine: true },
  suit: { ramp: ramp('#162022', '#283636', '#3e5050', '#5a6e6a', '#7e928a'), outline: hex('#080e0e'), outlineLit: hex('#101818') },
  glove: { ramp: ramp('#121614', '#222a24', '#36423a', '#4e5c50'), outline: hex('#050806') },
  lead: { ramp: ramp('#14181a', '#262e30', '#3c4a4a', '#5a6e6a', '#84988e'), outline: hex('#05080a'), shine: true },
  glass: { ramp: ramp('#06382c', '#127a5a', '#2ad0a0', '#98f8d4', '#f0fff8'), outline: hex('#03160f'), emissive: 0.8, noAO: true },
  hose: { ramp: ramp('#0e1410', '#1c261e', '#2e3e30', '#465a46'), outline: hex('#040604') },
  iron: { ramp: ramp('#1a1210', '#36241a', '#58402c', '#7c6248', '#a8906c'), outline: hex('#0a0604'), outlineLit: hex('#140c08'), shine: true },
};

// The sea's growth on the Barnacle.
const CORAL: Material = { ramp: ramp('#560e26', '#982848', '#de5478', '#ff8aa8', '#ffd2de'), outline: hex('#22040e'), outlineLit: hex('#360818'), shine: true };
const SHELL: Material = { ramp: ramp('#56564e', '#94928a', '#cecabc', '#f6f2e6'), outline: hex('#1e1e1a'), shine: true };
const STAR: Material = { ramp: ramp('#6a1a0a', '#bc4818', '#f08030', '#ffc070'), outline: hex('#280a02'), shine: true };
const KELP: Material = { ramp: ramp('#0c280c', '#1c4a16', '#367a24', '#64a83a', '#9ad45a'), outline: hex('#041004') };
const ANEMONE: Material = { ramp: ramp('#7a1a6a', '#c844a8', '#ff86dc', '#ffd6f6'), outline: hex('#280622'), emissive: 0.85, noAO: true };

// Shared bits.
const DARK: Material = { ramp: ramp('#05080a', '#0c1418', '#162228'), outline: hex('#020304') };
const GAUGE: Material = { ramp: ramp('#a8a084', '#d8d0b0', '#f6f0d8'), outline: hex('#1a1408'), noAO: true };
const NEEDLE: Material = { ramp: ramp('#8a1a10', '#e0402a'), outline: hex('#2a0604'), noOutline: true, noAO: true, emissive: 0.4 };
const FISH: Material = { ramp: ramp('#a8400a', '#f08a20', '#ffd060'), outline: hex('#3a1204'), emissive: 0.35, noAO: true };
const BUBBLE: Material = { ramp: ramp('#3a8a9a', '#8adce8', '#e6ffff'), outline: hex('#1a4a56'), emissive: 0.4, noAO: true, noOutline: true };
const WATER: Material = { ramp: ramp('#2a7a96', '#5ac0dc', '#b4f0ff'), outline: hex('#0e3446'), emissive: 0.3, noAO: true, noOutline: true };
const STEAM: Material = { ramp: ramp('#8a96a6', '#c0cad6', '#e6ecf2', '#ffffff'), outline: hex('#4a5462'), noAO: true, noOutline: true, emissive: 0.15 };

export interface DiverLook {
  /** Texture key; animations are `${key}_${anim}_${dir}`. */
  key: string;
  /** The Barnacle: drowned and overgrown. */
  barnacle: boolean;
}

export const DIVER_LOOK: DiverLook = { key: 'diver', barnacle: false };
export const BARNACLE_LOOK: DiverLook = { key: 'diver_barnacle', barnacle: true };
export const DIVER_LOOKS = [DIVER_LOOK, BARNACLE_LOOK];

/** The look being drawn; set by buildDiverFrames (and the projectile painters). */
let L: DiverLook = DIVER_LOOK;
const K = (): Kit => (L.barnacle ? SEA : BASE);

type View = 'down' | 'up' | 'side';

interface Pt {
  x: number;
  y: number;
}

/** Where the anchor is: over the shoulder like a pickaxe, raised overhead, or out of the frame (flying on its chain). */
type AnchorAt = 'shoulder' | 'lift' | 'over' | 'none';

export interface DiverPose {
  /** Sunk (+) or risen (-), px: the whole body but the boots. */
  bob: number;
  /** Boots lifted off the ground, and in the side view stepped forward (-) or back. */
  liftA: number;
  liftB: number;
  strideA: number;
  strideB: number;
  /** The upper body turned (front and back views) or leant (side), px. */
  twist: number;
  /** The anchor hand and the gun hand, in body-box coordinates (null: where they hang). */
  handA: Pt | null;
  handB: Pt | null;
  anchor: AnchorAt;
  /** 0..1: the gun arm raised to fire; the harpoon gone from the gun once fired. */
  aim: number;
  loaded: boolean;
  flash: boolean;
  /** The portholes' light: 1 as always, more blazing, less dimmed. */
  glow: number;
  /** The idle moment's: a fish across the face glass (0..1, -1 none), a knock on the helmet, water spilling out of its valve, bubbles rising (a stage), steam blowing (venting, 0..1). */
  fish: number;
  knock: boolean;
  spill: number;
  bubbles: number;
  steam: number;
}

const base = (): DiverPose => ({ bob: 0, liftA: 0, liftB: 0, strideA: 0, strideB: 0, twist: 0, handA: null, handB: null, anchor: 'shoulder', aim: 0, loaded: true, flash: false, glow: 1, fish: -1, knock: false, spill: 0, bubbles: 0, steam: 0 });

/** Where the hands hang by default, per view: the anchor hand (A) and the gun hand (B). */
const HANDS: Record<View, [Pt, Pt]> = {
  down: [{ x: 4, y: 21 }, { x: 20.5, y: 22.5 }],
  up: [{ x: 20, y: 21 }, { x: 3.5, y: 22.5 }],
  side: [{ x: 6.5, y: 21 }, { x: 14, y: 22 }],
};

// ---------------------------------------------------------------------------
// Drawing helpers

/** A glow-scaled version of a lit material's draw: brighter (and a step up the ramp) as the portholes blaze. */
const lit = (glow: number): DrawOpts => ({ glow: Math.min(1, 0.8 * glow), bias: glow > 1.3 ? 1 : glow < 0.6 ? -1 : 0 });

/** The anchor from its ring (where the chain is) to its crown, the arms curving back towards the ring, either side. */
export function anchorShape(c: PixelCanvas, rx: number, ry: number, cx: number, cy: number, o: { stock?: boolean; arms?: boolean; shank?: [number, number] } = {}): void {
  const iron = K().iron;
  const len = Math.hypot(cx - rx, cy - ry) || 1;
  const ux = (cx - rx) / len;
  const uy = (cy - ry) / len;
  const nx = -uy;
  const ny = ux;
  const [s0, s1] = o.shank ?? [0, 1];
  // The shank: thick and square, a little thicker towards the crown.
  c.part();
  c.capsule(rx + ux * len * s0, ry + uy * len * s0, rx + ux * len * s1, ry + uy * len * s1, 1.05 + s0 * 0.3, 1.05 + s1 * 0.35, iron);
  if (o.arms !== false && s1 >= 1) {
    // The arms: an arc out from the crown each side, back towards the ring, ending in a broad fluke and a point.
    const R = Math.max(3, len * 0.34);
    c.part();
    for (const s of [-1, 1]) {
      let px = cx;
      let py = cy;
      const n = 8;
      for (let i = 1; i <= n; i++) {
        const th = (i / n) * 1.75;
        const x = cx + nx * s * R * Math.sin(th) - ux * R * (1 - Math.cos(th));
        const y = cy + ny * s * R * Math.sin(th) - uy * R * (1 - Math.cos(th));
        const fl = i > n * 0.55 ? 1.45 : 1;
        c.capsule(px, py, x, y, fl, fl, iron);
        px = x;
        py = y;
      }
      // The point, past the fluke, along the arm's way.
      const th = 1.75;
      const tx = nx * s * Math.cos(th) - ux * Math.sin(th);
      const ty = ny * s * Math.cos(th) - uy * Math.sin(th);
      c.capsule(px, py, px + tx * 1.8, py + ty * 1.8, 0.9, 0.5, iron);
    }
    // The crown's knob.
    c.ellipse(cx + ux * 0.6, cy + uy * 0.6, 1.4, 1.4, iron);
  }
  if (o.stock !== false && s0 <= 0) {
    // The stock: a bar across, just below the ring; and the ring itself.
    const sx = rx + ux * 2.2;
    const sy = ry + uy * 2.2;
    const half = Math.max(2.5, len * 0.22);
    c.part();
    c.capsule(sx - nx * half, sy - ny * half, sx + nx * half, sy + ny * half, 0.7, 0.7, iron);
    c.part();
    ringAt(c, rx - ux * 0.6, ry - uy * 0.6, 1.4, iron);
  }
  if (L.barnacle) crust(c, rx, ry, cx, cy, len, nx, ny, s0, s1);
}

/** A little ring: a round of pixels with a hole. */
function ringAt(c: PixelCanvas, x: number, y: number, r: number, m: Material): void {
  for (let yy = Math.floor(y - r - 1); yy <= y + r + 1; yy++)
    for (let xx = Math.floor(x - r - 1); xx <= x + r + 1; xx++) {
      const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
      if (d <= r + 0.5 && d >= r - 0.7) c.px(xx, yy, m, sphere((xx + 0.5 - x) / (r + 1), (yy + 0.5 - y) / (r + 1), 0.9));
    }
}

/** Barnacles and a coral sprig grown over the drowned anchor. */
function crust(c: PixelCanvas, rx: number, ry: number, cx: number, cy: number, len: number, nx: number, ny: number, s0: number, s1: number): void {
  c.part();
  for (const [k, side] of [[0.35, 1], [0.6, -1], [0.82, 1]] as const) {
    if (k < s0 || k > s1) continue;
    const x = rx + (cx - rx) * k + nx * side * 1.2;
    const y = ry + (cy - ry) * k + ny * side * 1.2;
    c.px(x, y, SHELL, sphere(-0.3, 0.4, 1), { bias: 1 });
  }
  if (s1 >= 1 && len > 10) {
    const x = cx + nx * 1.5;
    const y = cy + ny * 1.5;
    c.px(x, y, CORAL, sphere(-0.2, 0.5, 1), { bias: 1 });
    c.px(x + nx, y + ny - 1, CORAL, sphere(0, 0.6, 1));
  }
}

/** A chain hanging from (x0, y0) to (x1, y1), sagging by `sag`: links seen flat and edge on by turns. */
function chain(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, sag: number): void {
  const iron = K().iron;
  c.part();
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 1.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
    c.px(x, y, iron, { x: -0.3, y: 0.4, z: 0.85 }, { bias: i % 2 ? -1 : 1 });
  }
}

/** A round porthole: a thick rim of `trim` round glowing glass, its glint at the top left. */
function porthole(c: PixelCanvas, x: number, y: number, rx: number, ry: number, glow: number, n: Vec3 | null = null): void {
  const k = K();
  c.part();
  c.ellipse(x, y, rx + 1, ry + 1, k.trim, n ? { normal: () => n } : {});
  c.part();
  c.ellipse(x, y, rx, ry, k.glass, { ...lit(glow), flatten: 0.6 });
  // The glass is darker low down (the inside of the helmet seen through it) and glints high.
  for (let yy = Math.ceil(y + ry * 0.2); yy <= y + ry; yy++) for (let xx = Math.floor(x - rx); xx <= x + rx; xx++) c.shade(xx, yy, -1);
  c.px(Math.round(x - rx * 0.45), Math.round(y - ry * 0.5), k.glass, sphere(-0.5, 0.5, 0.7), { glow: 1, bias: 3 });
}

/** A ribbed hose: a tube along the points, every other pixel step a rib catching the light. */
function hose(c: PixelCanvas, pts: Pt[], r = 1.2): void {
  const m = K().hose;
  c.part();
  for (let i = 1; i < pts.length; i++) c.capsule(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, r, r, m);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let j = 0; j < n; j += 2) c.shade(a.x + ((b.x - a.x) * j) / n, a.y + ((b.y - a.y) * j) / n, 1);
  }
}

/** A great lead boot, its brass toe cap facing the viewer (front), away (back), or out to the left (side). */
function boot(c: PixelCanvas, x: number, y: number, view: View, far = false): void {
  const k = K();
  c.part();
  if (view === 'side') {
    // Long, flat, the toe cap jutting forward.
    c.shape(Math.round(y - 4), Math.round(y - 1), (yy) => [x - 4.5 + (yy < y - 3 ? 2 : 0), x + 3], k.lead, (_x, _y, t, u) => sphere(t * 0.6, u - 0.5, 0.9));
    c.part();
    c.ellipse(x - 3.6, y - 2, 1.6, 1.4, k.trim);
    for (let xx = Math.round(x - 4); xx <= x + 2; xx++) c.px(xx, Math.round(y - 1), k.lead, { x: 0, y: -0.6, z: 0.8 }, { bias: -1 });
    if (far) for (let yy = Math.round(y - 4); yy <= y - 1; yy++) for (let xx = Math.round(x - 5); xx <= x + 3; xx++) c.shade(xx, yy, -1);
    return;
  }
  c.shape(Math.round(y - 4), Math.round(y - 1), (yy) => [x - 3 + (yy < y - 3 ? 0.5 : 0), x + 3 - (yy < y - 3 ? 0.5 : 0)], k.lead, (_x, _y, t, u) => sphere(t * 0.75, u * 0.9 - 0.45, 0.9));
  c.part();
  if (view === 'down') {
    // The brass toe cap, and the sole's dark edge.
    c.ellipse(x, y - 1.8, 2.2, 1.3, k.trim, { flatten: 0.8 });
  } else {
    // The heel's strap.
    for (let xx = Math.round(x - 2); xx <= x + 1; xx++) c.px(xx, Math.round(y - 3), k.glove, { x: 0, y: 0.3, z: 0.95 });
  }
  for (let xx = Math.round(x - 3); xx <= x + 2; xx++) c.px(xx, Math.round(y - 1), k.lead, { x: 0, y: -0.7, z: 0.7 }, { bias: -1 });
}

/** A puffy canvas arm from the shoulder to the hand, a brass cuff at the wrist and a leather glove. */
function arm(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number, far = false): void {
  const k = K();
  c.part();
  // The elbow bends out a touch, away from the body's middle.
  const mx = (sx + hx) / 2 + (sx < 12 ? -0.8 : 0.8);
  const my = (sy + hy) / 2;
  c.capsule(sx, sy, mx, my, 2.4, 2.1, k.suit);
  c.capsule(mx, my, hx, hy, 2.1, 1.7, k.suit);
  if (far) for (let y = Math.floor(Math.min(sy, hy) - 3); y <= Math.max(sy, hy) + 3; y++) for (let x = Math.floor(Math.min(sx, hx) - 3); x <= Math.max(sx, hx) + 3; x++) c.shade(x, y, -1);
  // The cuff, a hand's width short of the glove.
  const l = Math.hypot(hx - mx, hy - my) || 1;
  const cx = hx - ((hx - mx) / l) * 1.6;
  const cy = hy - ((hy - my) / l) * 1.6;
  c.part();
  c.ellipse(cx, cy, 1.9, 1.5, k.trim);
}

function glove(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.ellipse(x, y + 0.3, 1.8, 1.7, K().glove);
}

/** The harpoon gun along a forearm, from (x0, y0) out past the hand at (x1, y1); a barbed head in its mouth when loaded. */
function gun(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, loaded: boolean, flash: boolean): void {
  const k = K();
  const l = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / l;
  const uy = (y1 - y0) / l;
  const ex = x1 + ux * 3;
  const ey = y1 + uy * 3;
  c.part();
  c.capsule(x0, y0, ex, ey, 1.1, 1, k.trim);
  c.part();
  c.ellipse(ex, ey, 1.2, 1.2, DARK);
  if (loaded) {
    c.part();
    c.capsule(ex, ey, ex + ux * 2.5, ey + uy * 2.5, 0.8, 0.4, k.iron);
    for (const s of [-1, 1]) c.px(ex + ux * 1 - uy * s * 1.4, ey + uy * 1 + ux * s * 1.4, k.iron, { x: s * 0.4, y: 0.5, z: 0.7 });
  }
  if (flash) puffOut(c, ex + ux * 2, ey + uy * 2, ux, uy);
}

/** The gun seen end on, pointing at the viewer: a brass mouth and the harpoon's point in it. */
function gunMuzzle(c: PixelCanvas, x: number, y: number, loaded: boolean, flash: boolean): void {
  const k = K();
  c.part();
  c.ellipse(x, y, 2.2, 2, k.trim);
  c.part();
  c.ellipse(x, y, 1.1, 1, DARK);
  if (loaded) c.px(x - 0.5, y - 0.5, k.iron, sphere(-0.4, 0.4, 1), { bias: 2 });
  if (flash) for (const [dx, dy] of [[-3, -1], [3, -1], [-2, 2], [2, 2], [0, -3]]) puffOut(c, x + dx, y + dy, dx * 0.3, dy * 0.3);
}

/** A puff of compressed air out of the gun's mouth: a little white burst and bubbles. */
function puffOut(c: PixelCanvas, x: number, y: number, ux: number, uy: number): void {
  const white: RGB = [235, 250, 255];
  const sea: RGB = [140, 230, 240];
  for (let i = 0; i < 4; i++) {
    const w = 0.5 + i * 0.5;
    for (let s = -w; s <= w; s += 0.5) c.spark(x + ux * i - uy * s, y + uy * i + ux * s, i < 2 ? white : sea, 0.9 - i * 0.18);
  }
}

/** A bubble: a ring of light with a glint. */
function bubble(c: PixelCanvas, x: number, y: number, r: number): void {
  c.part();
  if (r < 1) {
    c.px(x, y, BUBBLE, sphere(-0.4, 0.4, 1), { bias: 2 });
    return;
  }
  for (let yy = Math.floor(y - r); yy <= y + r; yy++)
    for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
      const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / (r + 0.3);
      if (d > 1) continue;
      if (d > 0.55) c.px(xx, yy, BUBBLE, sphere((xx + 0.5 - x) / (r + 0.3), (yy + 0.5 - y) / (r + 0.3), 0.8));
    }
  c.px(x - r * 0.4, y - r * 0.5, BUBBLE, sphere(-0.5, 0.5, 0.8), { bias: 3 });
}

/** Bubbles rising from the helmet's valve, by stage: one forming, then a little column of them climbing. */
function bubbles(c: PixelCanvas, x: number, y: number, stage: number): void {
  const sets: [number, number, number][][] = [
    [],
    [[0, -1, 0.6]],
    [[0.5, -2, 1], [-0.5, -5, 0.6]],
    [[-0.5, -2.5, 1.3], [0.8, -6, 1], [-0.4, -9, 0.6]],
    [[0.6, -4, 1.4], [-0.6, -8, 1.2], [0.4, -12, 0.8]],
    [[-0.3, -7, 1.3], [0.5, -12, 1], [-0.2, -15, 0.6]],
  ];
  for (const [dx, dy, r] of sets[Math.min(stage, sets.length - 1)]) bubble(c, x + dx, y + dy, r);
}

/** Steam blowing off the valve while it vents: a cloud thickening with `k`. */
function steam(c: PixelCanvas, x: number, y: number, k: number): void {
  c.part();
  const pts: [number, number, number][] = [[0, -2, 1.4], [1.5, -5, 2], [-1, -7.5, 2.2], [2.5, -9, 1.8], [-2.5, -4, 1.4]];
  pts.forEach(([dx, dy, r], i) => {
    const rr = r * (0.6 + k * 0.6);
    const cy = y + dy * (0.7 + k * 0.4);
    for (let yy = Math.floor(cy - rr); yy <= cy + rr; yy++)
      for (let xx = Math.floor(x + dx - rr); xx <= x + dx + rr; xx++) {
        const nx = (xx + 0.5 - x - dx) / rr;
        const ny = (yy + 0.5 - cy) / rr;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        if (k < 0.75 && (xx + yy + i) & 1 && d2 > 0.4) continue;
        c.px(xx, yy, STEAM, sphere(nx, ny, 0.9), { bias: ny < -0.3 ? 1 : 0 });
      }
  });
}

/** The air pump on its back: a squat brass drum with a pressure gauge, hoops round it. */
function pump(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, gauge: Pt | null): void {
  const k = K();
  c.part();
  c.shape(Math.round(y0), Math.round(y1), (y) => {
    const cut = y === Math.round(y0) || y === Math.round(y1) ? 1 : 0;
    return [x0 + cut, x1 + 1 - cut];
  }, k.trim, (_x, _y, t) => cyl(t, 0.15));
  c.part();
  for (const y of [Math.round(y0 + 2), Math.round(y1 - 2)]) for (let x = Math.round(x0); x <= x1; x++) c.px(x, y, k.lead, cyl(((x + 0.5 - x0) / (x1 + 1 - x0)) * 2 - 1, 0.5));
  if (!gauge) return;
  c.part();
  c.ellipse(gauge.x, gauge.y, 2.2, 2.2, k.trim);
  c.part();
  c.ellipse(gauge.x, gauge.y, 1.4, 1.4, GAUGE, { flatten: 0.4 });
  c.px(gauge.x, gauge.y - 1, NEEDLE);
  c.px(gauge.x + 0.6, gauge.y - 0.4, NEEDLE);
}

// ---------------------------------------------------------------------------
// The sea's growth on the Barnacle

/** A branching sprig of coral from (x, y), its tips reaching up and out. */
function coral(c: PixelCanvas, x: number, y: number, s: number): void {
  c.part();
  c.capsule(x, y, x + s * 1, y - 3, 0.9, 0.7, CORAL);
  c.capsule(x + s * 1, y - 3, x + s * 3, y - 5, 0.7, 0.5, CORAL);
  c.capsule(x + s * 0.6, y - 2, x - s * 1.2, y - 5, 0.7, 0.5, CORAL);
  c.capsule(x + s * 2, y - 4, x + s * 2.4, y - 7, 0.6, 0.4, CORAL);
  for (const [dx, dy] of [[3, -5], [-1.2, -5], [2.4, -7]]) c.px(x + s * dx, y + dy, CORAL, sphere(-0.3, 0.6, 1), { bias: 1 });
}

/** A starfish clinging on, its five arms spread. */
function starfish(c: PixelCanvas, x: number, y: number, r: number, turn = 0): void {
  c.part();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + turn + (i / 5) * Math.PI * 2;
    c.capsule(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r, 0.9, 0.45, STAR);
  }
  c.px(x, y, STAR, sphere(-0.2, 0.3, 1), { bias: 1 });
}

/** A few barnacles: little shell cones, each with its dark mouth. */
function barnacles(c: PixelCanvas, pts: [number, number][]): void {
  c.part();
  for (const [x, y] of pts) {
    c.px(x, y, SHELL, sphere(-0.4, 0.5, 0.9), { bias: 1 });
    c.px(x + 1, y, SHELL, sphere(0.4, 0.3, 0.9));
    c.px(x, y + 1, SHELL, sphere(-0.2, -0.4, 0.9), { bias: -1 });
    c.px(x + 1, y + 1, DARK);
  }
}

/** A trailing strand of kelp from (x, y), waving by `w`. */
function kelp(c: PixelCanvas, x: number, y: number, len: number, w: number, s = 1): void {
  c.part();
  let px = x;
  let py = y;
  for (let i = 1; i <= len; i++) {
    const nx = x + s * i * 0.35 + Math.sin(i * 0.9 + w) * 0.9;
    const ny = y + i;
    c.capsule(px, py, nx, ny, 0.7, 0.6, KELP);
    px = nx;
    py = ny;
  }
}

/** The glowing anemone on its shoulder: a pink knob with tentacles waving up. */
function anemone(c: PixelCanvas, x: number, y: number, w: number, glow: number): void {
  c.part();
  c.ellipse(x, y, 1.6, 1.1, ANEMONE, { glow: 0.5 * glow });
  for (let i = -2; i <= 2; i++) {
    const tx = x + i * 0.8 + Math.sin(w + i) * 0.6;
    c.px(tx, y - 1.5 - (Math.abs(i) < 2 ? 1 : 0), ANEMONE, sphere(0, 0.6, 1), { glow: Math.min(1, 0.85 * glow), bias: 1 });
    if (Math.abs(i) < 2) c.px(tx + Math.sin(w * 1.3 + i) * 0.5, y - 3.2, ANEMONE, sphere(0, 0.6, 1), { glow: Math.min(1, glow), bias: 2 });
  }
}

// ---------------------------------------------------------------------------
// The front view (facing the viewer, 'down') and the back ('up')

function drawFront(c: PixelCanvas, p: DiverPose, back: boolean): void {
  const k = K();
  const view: View = back ? 'up' : 'down';
  const b = p.bob;
  const tw = p.twist;
  const [defA, defB] = HANDS[view];
  const hA = p.handA ?? { x: defA.x + tw * 0.5, y: defA.y + b };
  const hB = p.handB ?? { x: defB.x + tw * 0.5, y: defB.y + b };
  // The anchor's shoulder: the right (viewer's left in front, right from behind).
  const side = back ? 1 : -1;
  const shoulder = { x: 12 + side * 7 + tw, y: 15 + b };
  const crown = { x: 12 + side * 14 + tw, y: 1.5 + b };
  const ring = { x: hA.x - side * 0.5, y: hA.y + 2.5 };
  const hy = 8 + b;
  const hx = 12 + tw;

  // The anchor over the shoulder, all of it, behind everything (in front, only its shank shows over the body after).
  if (p.anchor === 'shoulder' && !back) {
    anchorShape(c, ring.x, ring.y, crown.x, crown.y);
    chain(c, ring.x + 0.5, ring.y + 1, 9, 24 + b, 2.5);
  }
  if (p.anchor === 'lift') anchorShape(c, ring.x, ring.y, hA.x + side * 2, hA.y - 15);
  // The pump on its back peeks over the shoulders from the front; the hose from it to the helmet.
  if (!back) {
    pump(c, 6 + tw, 18 + tw, 11 + b, 15 + b, null);
    hose(c, [{ x: 18.5 + tw, y: 12 + b }, { x: 21 + tw, y: 9 + b }, { x: 19.5 + tw, y: 6 + b }]);
  }

  // Legs and boots.
  c.part();
  for (const [s, lift] of [[-1, p.liftA], [1, p.liftB]] as const) {
    const lx = 12 + s * 3.5;
    c.capsule(lx, 23 + b, lx + s * 0.5, 28 - lift, 2.6, 2.3, k.suit);
  }
  boot(c, 8, 32 - p.liftA, view);
  boot(c, 16, 32 - p.liftB, view);

  // The torso: a stiff canvas barrel, the belt of lead weights round its middle.
  c.part();
  c.shape(Math.round(15 + b), Math.round(25 + b), (y) => {
    const u = (y - 15 - b) / 10;
    const hw = 6.2 + Math.sin(u * Math.PI) * 0.8;
    return [12 + tw * 0.5 - hw, 12 + tw * 0.5 + hw];
  }, k.suit, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  // Folds of canvas, a crease either side.
  for (const x of [8, 16]) for (let y = 19; y <= 21; y++) c.shade(x + tw * 0.5, y + b, -1);
  c.part();
  for (let x = Math.round(5.5 + tw * 0.5); x <= 18.5 + tw * 0.5; x++) c.px(x, Math.round(23 + b), k.glove, cyl(((x - 5.5 - tw * 0.5) / 13) * 2 - 1, 0.3));
  for (const x of back ? [7, 11, 15] : [6, 10, 14, 18]) {
    c.part();
    c.shape(Math.round(22 + b), Math.round(25 + b), () => [x + tw * 0.5, x + 2.6 + tw * 0.5], k.lead, (_x, _y, t, u) => sphere(t * 0.8, u - 0.5, 0.9));
  }
  if (back) pump(c, 7 + tw, 17 + tw, 12 + b, 22 + b, { x: 12 + tw, y: 17 + b });


  // The breastplate: a copper yoke over the shoulders, wing nuts along its edge.
  c.part();
  c.shape(Math.round(13 + b), Math.round(18 + b), (y) => {
    const u = (y - 13 - b) / 5;
    const hw = 8.4 - (u > 0.7 ? (u - 0.7) * 6 : 0);
    return [12 + tw - hw, 12 + tw + hw];
  }, k.helm, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.2, 0.85));
  c.part();
  for (const dx of [-6.5, -3, 2, 5.5]) {
    c.px(12 + tw + dx, 16 + b, k.trim, { x: -0.3, y: 0.4, z: 0.85 }, { bias: 1 });
    c.px(12 + tw + dx + 1, 16 + b, k.trim, { x: 0.3, y: 0.4, z: 0.85 });
  }
  // The brass neck ring the helmet screws into.
  c.ellipse(hx, 13.6 + b, 5.2, 1.4, k.trim, { flatten: 0.7 });
  if (L.barnacle) {
    barnacles(c, back ? [[6 + tw, 15 + b], [16 + tw, 14 + b]] : [[5 + tw, 15 + b], [17 + tw, 16 + b], [14 + tw, 15 + b]]);
    kelp(c, 4.5 + tw, 15 + b, 9, p.twist + p.bob, -1);
    kelp(c, 18 + tw, 23 + b, 6, p.bob * 1.3, 1);
  }

  // Arms: the gun arm and the anchor arm, out of the breastplate's edges.
  const sA = { x: 12 + side * 7 + tw, y: 16.5 + b };
  const sB = { x: 12 - side * 7 + tw, y: 16.5 + b };
  // Raised overhead, the arms come up in front of the helmet's sides instead (drawn after it).
  const raised = p.anchor === 'over';
  if (!raised) {
    arm(c, sB.x, sB.y, hB.x, hB.y);
    arm(c, sA.x, sA.y, hA.x, hA.y);
  }

  // The anchor's shank across the front, from the hand up to the shoulder.
  if (p.anchor === 'shoulder' && !back) anchorShape(c, ring.x, ring.y, crown.x, crown.y, { shank: [0, 0.42], arms: false });

  // Overhead: both hands on the shank, the crown high above the helmet (the helmet hides the ring).
  if (p.anchor === 'over') {
    const gx = (hA.x + hB.x) / 2;
    const gy = Math.min(hA.y, hB.y);
    anchorShape(c, gx, gy + 2, gx, gy - 14);
  }

  // The helmet.
  c.part();
  c.ellipse(hx, hy, 7, 6.8, k.helm, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 1.05) });
  c.part();
  if (!back) {
    // The face glass, its grille, and the two side portholes at the helmet's edges.
    porthole(c, hx + tw * 0.4, hy + 0.6, 3, 2.9, p.glow);
    c.part();
    for (const dx of [-1, 1]) for (let y = Math.round(hy - 1.5); y <= hy + 2.8; y++) c.px(hx + tw * 0.4 + dx, y, k.trim, cyl(0, 0.2));
    for (const s of [-1, 1]) {
      c.part();
      c.ellipse(hx + s * 6.3, hy, 1.1, 2.2, k.trim);
      c.px(hx + s * 6.6 - (s > 0 ? 1 : 0) + (s > 0 ? 0.5 : 0), hy - 0.5, k.glass, sphere(s * 0.8, 0.2, 0.6), lit(p.glow));
      c.px(hx + s * 6.6 - (s > 0 ? 1 : 0) + (s > 0 ? 0.5 : 0), hy + 0.5, k.glass, sphere(s * 0.8, -0.2, 0.6), { ...lit(p.glow), bias: -1 });
    }
    if (p.fish >= 0) fishIn(c, hx + tw * 0.4 + 2.2 - p.fish * 4.4, hy + 0.8, p.fish);
  } else {
    // From behind: the air inlet's gooseneck and the exhaust valve, the hose running down to the pump.
    c.ellipse(hx, hy - 1, 2.6, 1.8, k.trim);
    c.ellipse(hx - 3, hy + 2.5, 1.4, 1.2, k.trim);
    hose(c, [{ x: hx, y: hy + 1 }, { x: hx + 2, y: hy + 3.5 }, { x: hx + 1.5, y: 12 + b }]);
  }
  // The top: the valve knob (bubbles and steam come out of it).
  c.part();
  c.ellipse(hx + 3, hy - 6.3, 1.3, 1, k.trim);
  // Bolts round the helmet's skirt.
  c.part();
  for (const dx of [-5, 0, 5]) c.px(hx + dx, hy + 6, k.trim, { x: 0, y: -0.2, z: 1 }, { bias: 1 });
  if (L.barnacle) {
    coral(c, hx - 4, hy - 4.5, -1);
    coral(c, hx - 1.5, hy - 6, 1);
    if (!back) starfish(c, hx + 3.3, hy - 3.8, 2.4, 0.2);
    barnacles(c, back ? [[hx - 3, hy - 3], [hx + 3, hy + 1], [hx - 5, hy + 3]] : [[hx + 4, hy + 2], [hx - 6, hy + 3], [hx + 5, hy - 2]]);
    anemone(c, hx + side * -7.5, 13 + b, p.bob + p.twist * 0.7, p.glow);
  }

  if (raised) {
    arm(c, sB.x, sB.y, hB.x, hB.y);
    arm(c, sA.x, sA.y, hA.x, hA.y);
  }

  // The anchor from behind: over the right shoulder, nearer the viewer than the helmet.
  if (p.anchor === 'shoulder' && back) anchorShape(c, shoulder.x - 2, shoulder.y + 4, crown.x, crown.y, { stock: false });

  // The hands over everything they hold, and the gun on the left forearm.
  glove(c, hA.x, hA.y);
  if (p.aim > 0.5 && !back) gunMuzzle(c, hB.x, hB.y, p.loaded, p.flash);
  else if (p.aim > 0.5 && back) gun(c, hB.x, hB.y + 3, hB.x, hB.y - 1, p.loaded, p.flash);
  else gun(c, (sB.x + hB.x) / 2, (sB.y + hB.y) / 2 + 1, hB.x, hB.y, p.loaded, p.flash);
  glove(c, hB.x, hB.y);

  if (p.spill > 0) spill(c, hx + 3, hy - 6, p.spill);
  if (p.steam > 0) steam(c, hx + 3, hy - 7, p.steam);
  if (p.bubbles > 0) bubbles(c, hx + 3, hy - 7, p.bubbles);
  if (p.knock) knockFlash(c, hx + 7.5, hy - 1);
}

/** A little orange fish swimming past inside the face glass, `k` 0..1 of its way across. */
function fishIn(c: PixelCanvas, x: number, y: number, k: number): void {
  c.part();
  const flick = Math.round(k * 6) % 2;
  c.px(x, y, FISH, sphere(-0.4, 0.4, 1), { bias: 1 });
  c.px(x + 1, y, FISH, sphere(0.2, 0.2, 1));
  c.px(x + 1, y + 1, FISH, sphere(0.2, -0.4, 1), { bias: -1 });
  c.px(x + 2, y - flick, FISH, sphere(0.5, 0.2, 1));
  c.px(x + 2, y + 1 - flick, FISH, sphere(0.5, -0.2, 1));
  c.px(x - 0.2, y - 0.2, DARK);
}

/** Water spilling out of the valve as it's knocked: a jet arcing over, then drips. */
function spill(c: PixelCanvas, x: number, y: number, stage: number): void {
  c.part();
  if (stage === 1) {
    for (let i = 0; i < 6; i++) c.px(x + i * 0.9, y - 1.5 + i * i * 0.18, WATER, sphere(0, 0.5, 1), { bias: i < 2 ? 2 : 1 });
  } else {
    for (const [dx, dy] of [[3, 2], [4.5, 5], [5, 8.5]]) c.px(x + dx, y + dy, WATER, sphere(-0.3, 0.4, 1), { bias: 1 });
  }
}

/** A knock on the helmet's side: a little star of light where the glove hits. */
function knockFlash(c: PixelCanvas, x: number, y: number): void {
  const w: RGB = [255, 250, 220];
  c.spark(x, y, w, 0.9);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, -1], [1, -2]]) c.spark(x + dx, y + dy, w, 0.5);
}

// ---------------------------------------------------------------------------
// The side view, facing left

function drawSide(c: PixelCanvas, p: DiverPose): void {
  const k = K();
  const b = p.bob;
  const ln = p.twist;
  const [defA, defB] = HANDS.side;
  const hA = p.handA ?? { x: defA.x + ln, y: defA.y + b };
  const hB = p.handB ?? { x: defB.x + ln, y: defB.y + b };
  const hx = 11.5 + ln;
  const hy = 8 + b;
  const ring = { x: hA.x + 0.5, y: hA.y + 2.5 };
  const crown = { x: 22 + ln, y: 3 + b };

  // The anchor over the shoulder, behind the back; its shank over the body after.
  if (p.anchor === 'shoulder') {
    anchorShape(c, ring.x, ring.y, crown.x, crown.y);
    chain(c, ring.x + 0.5, ring.y + 1, 10, 25 + b, 2);
  }
  if (p.anchor === 'lift') anchorShape(c, ring.x, ring.y, hA.x + 6, hA.y - 14);

  // The far arm (the gun's), behind the body.
  const sB = { x: 13 + ln, y: 16 + b };
  if (p.aim < 0.5) {
    arm(c, sB.x, sB.y, hB.x, hB.y, true);
    gun(c, (sB.x + hB.x) / 2, (sB.y + hB.y) / 2 + 1, hB.x, hB.y, p.loaded, false);
  }

  // Legs: the far one, then the near.
  c.part();
  c.capsule(12, 23 + b, 12 + p.strideB, 28 - p.liftB, 2.4, 2.2, k.suit);
  for (let y = 22; y <= 29; y++) for (let x = 9; x <= 15; x++) if (Math.abs(x - 12 - p.strideB * ((y - 22) / 7)) < 3) c.shade(x, y + b * 0, -1);
  boot(c, 12.5 + p.strideB, 32 - p.liftB, 'side', true);

  // The pump on its back, and the hose from it over to the helmet's gooseneck.
  pump(c, 16 + ln, 21 + ln, 12 + b, 22 + b, { x: 20.5 + ln, y: 17 + b });
  hose(c, [{ x: 18.5 + ln, y: 12 + b }, { x: 20 + ln, y: 8 + b }, { x: 18 + ln, y: 6 + b }]);

  // The torso.
  c.part();
  c.shape(Math.round(15 + b), Math.round(25 + b), (y) => {
    const u = (y - 15 - b) / 10;
    const bulge = Math.sin(u * Math.PI) * 0.8;
    return [6.5 + ln * 0.6 - bulge, 17 + ln * 0.4 + bulge * 0.5];
  }, k.suit, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  for (let x = Math.round(6 + ln * 0.5); x <= 17 + ln * 0.5; x++) c.px(x, Math.round(23 + b), k.glove, cyl(((x - 6) / 11) * 2 - 1, 0.3));
  for (const x of [7, 11]) {
    c.part();
    c.shape(Math.round(22 + b), Math.round(25 + b), () => [x + ln * 0.5, x + 2.6 + ln * 0.5], k.lead, (_x, _y, t, u) => sphere(t * 0.8, u - 0.5, 0.9));
  }

  // The near leg and boot.
  c.part();
  c.capsule(11, 23 + b, 11 + p.strideA, 28 - p.liftA, 2.6, 2.3, k.suit);
  boot(c, 11.5 + p.strideA, 32 - p.liftA, 'side');

  // The breastplate, seen side on: a copper shoulder piece.
  c.part();
  c.shape(Math.round(13 + b), Math.round(18 + b), (y) => {
    const u = (y - 13 - b) / 5;
    return [5.5 + ln + u * 1.2, 18.5 + ln - u * 1.5];
  }, k.helm, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.2, 0.85));
  c.part();
  for (const dx of [-4, 1, 5]) c.px(hx + dx, 16 + b, k.trim, { x: -0.3, y: 0.4, z: 0.85 }, { bias: 1 });
  if (L.barnacle) {
    barnacles(c, [[8 + ln, 15 + b], [15 + ln, 16 + b]]);
    kelp(c, 16 + ln, 15 + b, 9, p.bob + ln, 1);
    kelp(c, 8 + ln * 0.5, 23 + b, 6, p.bob * 1.2 + 1, -1);
  }

  // The anchor's shank across the shoulder.
  if (p.anchor === 'shoulder') anchorShape(c, ring.x, ring.y, crown.x, crown.y, { shank: [0, 0.4], arms: false });

  // The helmet: the side porthole round, the face glass's rim jutting at the front, the gooseneck behind.
  c.part();
  c.ellipse(hx, hy, 6.8, 6.8, k.helm, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 1.05) });
  porthole(c, hx + 0.5, hy + 0.5, 2.3, 2.4, p.glow);
  c.part();
  c.shape(Math.round(hy - 3.5), Math.round(hy + 4.5), (y) => {
    const e = Math.abs(y + 0.5 - hy - 0.5) > 3.2 ? 0.6 : 0;
    return [hx - 7.8 + e, hx - 5.6];
  }, k.trim, (_x, _y, t) => cyl(t * 0.5 - 0.6, 0.1));
  c.part();
  for (let y = Math.round(hy - 2.5); y <= hy + 3.5; y++) c.px(hx - 7.6, y, k.glass, sphere(-0.9, (hy + 0.5 - y) / 4, 0.4), lit(p.glow));
  c.part();
  c.ellipse(hx + 6.2, hy - 1.5, 1.6, 1.4, k.trim);
  c.ellipse(hx + 3, hy - 6.3, 1.3, 1, k.trim);
  c.part();
  for (const dx of [-4, 1, 5]) c.px(hx + dx, hy + 6, k.trim, { x: 0, y: -0.2, z: 1 }, { bias: 1 });
  if (L.barnacle) {
    coral(c, hx + 1, hy - 5.5, 1);
    coral(c, hx - 2, hy - 6, -1);
    starfish(c, hx - 3.5, hy - 3.6, 2.2, 0.5);
    barnacles(c, [[hx + 3, hy + 2], [hx + 5, hy - 3]]);
    anemone(c, hx + 4.5, 13 + b, p.bob + ln, p.glow);
  }

  if (p.anchor === 'over') {
    const gx = (hA.x + hB.x) / 2;
    const gy = Math.min(hA.y, hB.y);
    anchorShape(c, gx + 1, gy + 2, gx - 2, gy - 14);
  }

  // The gun arm raised and aimed forward, in front of the body.
  if (p.aim >= 0.5) {
    arm(c, sB.x - 2, sB.y, hB.x, hB.y);
    gun(c, hB.x + 4, hB.y + 0.5, hB.x, hB.y, p.loaded, p.flash);
    glove(c, hB.x, hB.y);
  }

  // The near arm (the anchor's), over everything.
  arm(c, 10.5 + ln, 16 + b, hA.x, hA.y);
  glove(c, hA.x, hA.y);

  if (p.steam > 0) steam(c, hx + 3, hy - 7, p.steam);
  if (p.bubbles > 0) bubbles(c, hx + 3, hy - 7, p.bubbles);
}

// ---------------------------------------------------------------------------
// Animations

export type DiverAnim = 'idle' | 'walk' | 'swingA' | 'swingB' | 'slam' | 'harpoon' | 'reel' | 'cast' | 'vent' | 'rest';

interface AnimDef {
  name: DiverAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => DiverPose[];
  /** Frame indices to play in order, when some are held or repeated. */
  order?: readonly number[];
}

const at = (o: Partial<DiverPose>): DiverPose => ({ ...base(), ...o });

/** Breathing in the suit: the body sinks and rises, a bubble now and then from the valve. */
const idle = (): DiverPose[] => [at({}), at({}), at({ bob: 1, bubbles: 1 }), at({ bob: 1, bubbles: 2 })];

/** A slow, heavy tread in lead boots: each lifts, swings and thumps down, the body rolling over it. */
const walk = (view: View): DiverPose[] =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    const s = Math.sin(a);
    return at({
      bob: Math.abs(s) > 0.5 ? 0 : 1,
      liftA: Math.max(0, Math.round(s * 2)),
      liftB: Math.max(0, Math.round(-s * 2)),
      strideA: view === 'side' ? Math.round(-Math.cos(a) * 3) : 0,
      strideB: view === 'side' ? Math.round(Math.cos(a) * 3) : 0,
      twist: view === 'side' ? 0 : Math.round(s * 0.6),
    });
  });

/**
 * The anchor's sweep on its chain: both hands haul it round from one side to
 * the other, the body turning with it (the anchor itself flies in the world,
 * see Diver.ts). A: left to right seen from the front (up to down side on); B the other way.
 */
const swing = (which: 'A' | 'B') => (view: View): DiverPose[] => {
  const path: Record<View, [Pt, Pt, Pt, Pt]> = {
    down: [{ x: 1.5, y: 17 }, { x: 8, y: 21.5 }, { x: 19.5, y: 19 }, { x: 18, y: 21 }],
    up: [{ x: 22.5, y: 17 }, { x: 16, y: 19.5 }, { x: 4.5, y: 18.5 }, { x: 6, y: 20.5 }],
    side: [{ x: 13, y: 10 }, { x: 2.5, y: 17 }, { x: 4, y: 24 }, { x: 7, y: 23 }],
  };
  let pts = path[view];
  if (which === 'B') pts = view === 'side' ? [{ x: 5, y: 25 }, { x: 2, y: 19 }, { x: 10, y: 11 }, { x: 9, y: 15 }] : pts.map((q) => ({ x: 24 - q.x, y: q.y })) as [Pt, Pt, Pt, Pt];
  const turn = view === 'side' ? [1, -2, -1, 0] : [-1, 0, 1, 1];
  const sign = view === 'side' ? 1 : (which === 'A' ? 1 : -1) * (view === 'up' ? -1 : 1);
  return pts.map((q, i) =>
    at({
      anchor: 'none',
      handA: q,
      handB: { x: q.x + (view === 'side' ? 2 : q.x < 12 ? 2 : -2), y: q.y + 1 },
      twist: turn[i] * sign,
      bob: i === 1 || i === 2 ? 1 : 0,
    }),
  );
};

/** The overhead slam: the anchor heaved up high, then hurled down ahead (it flies in the world), and the follow-through. */
const slam = (view: View): DiverPose[] => {
  const side = view === 'side';
  const up = (dy: number, lean: number): DiverPose =>
    at({ anchor: 'over', handA: { x: side ? 11 + lean : view === 'up' ? 16.5 : 7.5, y: dy }, handB: { x: side ? 13 + lean : view === 'up' ? 7.5 : 16.5, y: dy + 0.5 }, twist: lean, glow: 1.1 });
  const down: Pt = side ? { x: 2, y: 23 } : view === 'down' ? { x: 11, y: 24 } : { x: 12, y: 15 };
  return [
    up(0, side ? 1 : 0),
    up(-2, side ? 2 : 0),
    at({ anchor: 'none', handA: down, handB: { x: down.x + 2.5, y: down.y + 0.5 }, bob: 2, twist: side ? -2 : 0, glow: 1.3 }),
    at({ anchor: 'none', handA: { x: down.x + (side ? 1 : 0), y: down.y - 1 }, handB: { x: down.x + 3, y: down.y - 0.5 }, bob: 1, twist: side ? -1 : 0 }),
  ];
};

/** The harpoon gun: raised, a puff of air as it fires, the empty gun held up. */
const harpoon = (view: View): DiverPose[] => {
  const aim: Pt = view === 'side' ? { x: 1, y: 18 } : view === 'down' ? { x: 16.5, y: 21 } : { x: 8, y: 15 };
  return [
    at({ handB: aim, aim: 1 }),
    at({ handB: { x: aim.x + (view === 'side' ? 1.5 : 0), y: aim.y - (view === 'side' ? 0 : 1) }, aim: 1, flash: true, loaded: false, twist: view === 'side' ? 1 : 0 }),
    at({ handB: aim, aim: 1, loaded: false, twist: view === 'side' ? 1 : 0 }),
  ];
};

/** Reeling the harpoon in: leaning back, the gun arm hauling, hand over hand on the winch. */
const reel = (view: View): DiverPose[] => {
  const side = view === 'side';
  const front = view === 'down';
  return [0, 1].map((i) =>
    at({
      anchor: 'shoulder',
      loaded: false,
      aim: 1,
      handB: side ? { x: 4 + i * 1.5, y: 18 + i } : front ? { x: 17 - i, y: 19 + i } : { x: 7 + i, y: 16 - i },
      twist: side ? 2 : 0,
      bob: i,
    }),
  );
};

/** The Special's pose (and the select screen's): the anchor heaved off the shoulder to high overhead, the portholes blazing, bubbles boiling up. */
const cast = (view: View): DiverPose[] => {
  const side = view === 'side';
  const hi = (dy: number, glow: number, bubbles: number, bob = 0): DiverPose =>
    at({ anchor: 'over', handA: { x: side ? 10 : view === 'up' ? 16.5 : 7.5, y: dy }, handB: { x: side ? 12 : view === 'up' ? 7.5 : 16.5, y: dy + 0.5 }, glow, bubbles, bob });
  return [
    at({ bob: 1 }),
    at({ anchor: 'lift', handA: side ? { x: 9, y: 14 } : { x: view === 'down' ? 6 : 18, y: 13 }, glow: 1.1, bob: 1 }),
    hi(1, 1.3, 1),
    hi(-2, 1.6, 2, -1),
    hi(-2, 2, 3, -1),
    hi(-2, 1.8, 4, -1),
  ];
};

/** Overheated: hunched, the valve blowing steam, the portholes stuttering. */
const vent = (): DiverPose[] => [0.6, 1, 0.8, 1].map((s, i) => at({ bob: 2, steam: s, glow: i % 2 ? 0.5 : 1.2, twist: 0 }));

/**
 * The idle moment, facing the viewer: a little fish swims across the inside
 * of its face glass. It notices, raps the side of its helmet twice, water
 * spills out of the valve, bubbles rise, and it wipes the glass clear with
 * its glove, satisfied.
 */
const rest = (view: View): DiverPose[] => {
  if (view !== 'down') return [];
  const knock: Pt = { x: 21.5, y: 9 };
  return [
    at({}),
    at({ fish: 0.1 }),
    at({ fish: 0.45, glow: 1.1 }),
    at({ fish: 0.85, glow: 1.1 }),
    at({ twist: -1, handB: { x: 21, y: 13 } }),
    at({ twist: -1, handB: knock, knock: true }),
    at({ twist: -1, handB: { x: 22.5, y: 11 }, spill: 1 }),
    at({ handB: { x: 21, y: 15 }, spill: 2, bubbles: 2 }),
    at({ handB: { x: 15, y: 9.5 }, bubbles: 3 }),
    at({ handB: { x: 11, y: 9.5 }, bubbles: 4 }),
    at({ bob: -1, bubbles: 5, glow: 1.3 }),
  ];
};

export const DIVER_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 4, loop: true, poses: idle },
  { name: 'walk', fps: 8, loop: true, poses: walk },
  { name: 'swingA', fps: 14, loop: false, poses: swing('A') },
  { name: 'swingB', fps: 14, loop: false, poses: swing('B') },
  { name: 'slam', fps: 9, loop: false, poses: slam, order: [0, 1, 1, 2, 3, 3] },
  { name: 'harpoon', fps: 14, loop: false, poses: harpoon, order: [0, 1, 2, 2] },
  { name: 'reel', fps: 8, loop: true, poses: reel },
  { name: 'cast', fps: 9, loop: false, poses: cast },
  { name: 'vent', fps: 8, loop: true, poses: vent },
  { name: 'rest', fps: 8, loop: false, poses: rest, order: [0, 0, 1, 1, 2, 2, 3, 3, 0, 0, 4, 5, 4, 5, 6, 6, 7, 7, 8, 9, 8, 9, 10, 10, 0] },
];

export interface DiverFrame {
  key: string;
  anim: DiverAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: DiverPose): PixelCanvas {
  const c = new PixelCanvas(DIVER_W, DIVER_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawFront(c, p, false);
  else if (dir === 'up') drawFront(c, p, true);
  else drawSide(c, p);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildDiverFrames(look: DiverLook = DIVER_LOOK): DiverFrame[] {
  L = look;
  const out: DiverFrame[] = [];
  for (const a of DIVER_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, pose) }));
    }
  }
  L = DIVER_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// What flies: the anchor on its chain and the harpoon, in sixteen headings
// (0 = right, turning clockwise), crown or point leading.

export const DIVER_PROJ_DIRS = 16;
export const ANCHOR_SIZE = 28;
export const HARPOON_SIZE = 20;

/** The anchor flying out on its chain at heading `i`: the ring at the middle's back, the crown leading. */
export function anchorFrame(look: DiverLook, i: number): PixelCanvas {
  L = look;
  const c = new PixelCanvas(ANCHOR_SIZE, ANCHOR_SIZE);
  const a = (i / DIVER_PROJ_DIRS) * Math.PI * 2;
  const m = ANCHOR_SIZE / 2;
  anchorShape(c, m - Math.cos(a) * 8, m - Math.sin(a) * 8, m + Math.cos(a) * 9, m + Math.sin(a) * 9);
  L = DIVER_LOOK;
  return c;
}

/** The harpoon at heading `i`: a brass-bound shaft, a barbed iron head, a ring at its tail for the line. */
export function harpoonFrame(look: DiverLook, i: number): PixelCanvas {
  L = look;
  const k = K();
  const c = new PixelCanvas(HARPOON_SIZE, HARPOON_SIZE);
  const a = (i / DIVER_PROJ_DIRS) * Math.PI * 2;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const m = HARPOON_SIZE / 2;
  const P = (t: number, s = 0): [number, number] => [m + ux * t - uy * s, m + uy * t + ux * s];
  c.part();
  c.capsule(...P(-7), ...P(3), 0.7, 0.7, k.trim);
  c.part();
  c.capsule(...P(2.5), ...P(7.5), 1.2, 0.3, k.iron);
  for (const s of [-1, 1]) c.capsule(...P(4), ...P(2, s * 2.2), 0.6, 0.5, k.iron);
  c.part();
  ringAt(c, ...P(-8), 1, k.iron);
  // A glint along the head, lit even in the deep.
  const [gx, gy] = P(6);
  c.spark(gx, gy, [220, 255, 255], 0.5);
  if (look.barnacle) {
    c.part();
    const [bx, by] = P(-3, 1);
    c.px(bx, by, SHELL, sphere(-0.3, 0.4, 1), { bias: 1 });
  }
  L = DIVER_LOOK;
  return c;
}

// ---------------------------------------------------------------------------
// Button icons

const TONES: Record<'base' | 'sea', { iron: Tones; glow: Tones; brass: Tones }> = {
  base: {
    iron: [hex('#c8d4e4'), hex('#8a9aae'), hex('#536276'), hex('#2a3440')],
    glow: [hex('#eaffff'), hex('#8af0f4'), hex('#2cb8c8'), hex('#127482')],
    brass: [hex('#fff4b0'), hex('#ecc456'), hex('#bc8a2a'), hex('#7a5016')],
  },
  sea: {
    iron: [hex('#e8d8c0'), hex('#a8906c'), hex('#7c6248'), hex('#4a3626')],
    glow: [hex('#ffe6f0'), hex('#ff8aa8'), hex('#de5478'), hex('#2ad0a0')],
    brass: [hex('#d0d890'), hex('#9eaa5a'), hex('#6e7a36'), hex('#46501e')],
  },
};

/** Anchor swing: an anchor sweeping round at the end of its chain, a heavy arc of motion behind it. */
export function anchorIcon(barnacle = false): Uint8ClampedArray {
  const t = TONES[barnacle ? 'sea' : 'base'];
  return icon16((put) => {
    // The sweep: two arcs of motion trailing round its left.
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * 0.55 + (i / 12) * Math.PI * 0.85;
      put(9 + Math.cos(a) * 7.6, 8 + Math.sin(a) * 7, i < 4 ? t.glow[3] : i < 8 ? t.glow[2] : t.glow[1]);
      if (i > 3 && i < 11) put(9 + Math.cos(a) * 5.8, 8 + Math.sin(a) * 5.4, t.glow[3]);
    }
    // The anchor, upright: ring, stock, shank, and the arms curving up to their flukes.
    for (const [x, y] of [[9, 0], [8, 1], [10, 1], [9, 2]] as const) put(x, y, t.iron[1]);
    seg(put, 6, 4, 12, 4, t.iron[1]);
    put(6, 4, t.iron[2]);
    put(12, 4, t.iron[2]);
    seg(put, 9, 3, 9, 13, t.iron[0]);
    seg(put, 10, 5, 10, 12, t.iron[2]);
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (0.15 + (i / 10) * 0.7);
      put(9.5 + Math.cos(a) * 4.6, 9.5 + Math.sin(a) * 4.4, i === 5 ? t.iron[0] : t.iron[1]);
    }
    for (const s of [-1, 1]) {
      put(9.5 + s * 5, 9, t.iron[0]);
      put(9.5 + s * 5, 8, t.iron[1]);
      put(9.5 + s * 4, 9, t.iron[2]);
    }
    // The chain trailing off its ring.
    for (let i = 1; i <= 4; i++) put(9 + i, 1 - (i % 2), i % 2 ? t.iron[2] : t.iron[3]);
    if (barnacle) {
      put(10, 9, hex('#f6f2e6'));
      put(7, 12, hex('#ff8aa8'));
      put(13, 12, hex('#f6f2e6'));
    }
  });
}

/** Harpoon: a barbed harpoon flying out on its line, a foe's mark of light where it bites. */
export function harpoonIcon(barnacle = false): Uint8ClampedArray {
  const t = TONES[barnacle ? 'sea' : 'base'];
  return icon16((put) => {
    // The line, wavering back to the gun at the lower left.
    for (let i = 0; i <= 8; i++) put(1 + i, 14 - i + (i % 3 === 1 ? 1 : 0), i % 2 ? t.iron[2] : t.iron[3]);
    // The shaft.
    seg(put, 5, 11, 11, 5, t.brass[1]);
    seg(put, 6, 11, 11, 6, t.brass[2]);
    // The head and its barbs.
    seg(put, 11, 5, 14, 2, t.iron[0]);
    put(15, 1, t.iron[0]);
    seg(put, 12, 4, 12, 7, t.iron[1]);
    seg(put, 12, 4, 9, 4, t.iron[1]);
    put(12, 8, t.iron[2]);
    put(8, 4, t.iron[2]);
    // Bubbles in its wake.
    for (const [x, y, c] of [[3, 7, 1], [2, 5, 2], [5, 4, 2], [7, 14, 1]] as const) put(x, y, t.glow[c]);
    put(14, 2, t.glow[0]);
  });
}
