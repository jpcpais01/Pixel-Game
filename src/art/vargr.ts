// Vargr, the Winterfang: the Aurora Colosseum's first Legend, a frost wolf
// the size of a cart. White winter fur, blue in its folds, a storm-grey
// saddle down its back; a mane of ice crystals bristling from the back of its
// skull to its shoulders, their hearts lit by the aurora; eyes of the same
// green fire; black claws and ivory fangs, frost on its muzzle and icicles
// hanging from the long fur of its belly.
//
// Drawn side-on facing right (the world mirrors it) on one rig: a rump, a
// barrel tucked at the waist and a deep chest; legs solved from hip and
// shoulder to paw (the stifle bends forward, the hock and elbow back); a
// thick neck under the mane; a head that can lower, lift to howl and gape.
// Its trot, its crouch, the stretch of its pounce, the howl, the frost breath
// and the swipe all come from the same rig.
//
// And its spells' pictures: the wedge its breath will sweep (vg_cone), the
// billows of the breath itself (vg_breath) and the rake of its claws
// (vg_claw).

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, hex, sphere, type Material, type RGB } from './pixel';
import { bayer, clamp01 } from './bitmap';
import { hash2 } from './env';
import { C_AURORA, C_ICE, C_TEAL, C_WHITE, FUR_GREY, FUR_WHITE, GLOW_AURORA, GLOW_ICE, HOLLOW, HORN, ICE, ICE_DARK, IVORY, RIME, crystal, ramp, type FxRegistrar } from './frostKit';

const F = MONSTER_FRAME.vargr;
/** The near paws' bottom row; far paws stand a little higher and further on (the ground seen at a slant). */
const GROUND = F.oy;
const FAR_UP = 2;
const FAR_ON = 3;

/** The mane's crystals: clear ice with a stronger inner glow than common ice. */
const MANE: Material = { ...ICE, emissive: 0.32 };
const MANE_DARK: Material = { ...ICE_DARK, emissive: 0.22 };
/** The inner ear and the gums: a cold dark violet-grey. */
const FLESH: Material = { ramp: ramp('#1a1426', '#2e2440', '#4a3a5c'), outline: hex('#05060c'), noAO: true };
const TONGUE: Material = { ramp: ramp('#3a2240', '#5c3a5e', '#86607e'), outline: hex('#05060c'), noAO: true };
/** The throat lit by the breath gathering in it. */
const MAW_GLOW: Material = { ...GLOW_ICE, ramp: ramp('#3ab0ff', '#9ae8ff', '#e8fbff') };

/** Debris tints: snow, ice and a little aurora. */
export const VARGR_TINTS = [0xffffff, 0xc8f0ff, 0x9ae8ff, 0x5affb0];

/** Where the mouth is in the frame (facing right) in most poses: the breath leaves from here. */
export const VARGR_MOUTH = { x: 100, y: 44 };

interface Pose {
  /** Breathing / gait phase 0..1 (fur glints and the tail's sway). */
  t: number;
  /** Body drop (positive is down) and the chest raised above the rump. */
  bob: number;
  pitch: number;
  /** The body stretched longer (a pounce) or bunched shorter (a crouch). */
  stretch: number;
  /** Paws (x, bottom row): near hind, near fore, far hind, far fore. */
  nh: [number, number];
  nf: [number, number];
  fh: [number, number];
  ff: [number, number];
  /** The skull moved from its rest, and turned (negative lifts the muzzle). */
  hx: number;
  hy: number;
  ha: number;
  /** 0 shut .. 1 gaping. */
  jaw: number;
  /** -1 tail low, 0 level, 1 raised high. */
  tail: number;
  /** 0..1 the mane bristling and blazing. */
  mane: number;
  /** 0 ears up, 1 pinned back. */
  ear: number;
  /** 0..1 steam on its breath, and frost light in its maw. */
  steam: number;
  frost: number;
  /** A near fore paw lifted (a swipe): it is drawn at nf with no weight. */
  paw?: boolean;
  blink?: boolean;
}

const REST: Pose = {
  t: 0,
  bob: 0,
  pitch: 0,
  stretch: 0,
  nh: [34, GROUND],
  nf: [72, GROUND],
  fh: [30, GROUND],
  ff: [68, GROUND],
  hx: 0,
  hy: 0,
  ha: 0.12,
  jaw: 0,
  tail: -0.4,
  mane: 0.2,
  ear: 0,
  steam: 0,
  frost: 0,
};

const P = (o: Partial<Pose>): Pose => ({ ...REST, ...o });

/** A point turned by `a` round (0, 0), then placed at (x, y). */
/** The head drawn a little larger than the rig's measures: a wolf this size is all jaws. */
const HEAD = 1.12;

const turn = (x: number, y: number, a: number, u: number, v: number): [number, number] => [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)];

/** Where the middle joint goes between an upper joint and the end, for limbs `l1` and `l2`; `bend` +1 bends it one way, -1 the other. */
function joint(ax: number, ay: number, fx: number, fy: number, l1: number, l2: number, bend: number): [number, number, number, number] {
  let dx = fx - ax;
  let dy = fy - ay;
  let d = Math.hypot(dx, dy) || 0.01;
  const max = l1 + l2 - 0.05;
  if (d > max) {
    fx = ax + (dx / d) * max;
    fy = ay + (dy / d) * max;
    dx = fx - ax;
    dy = fy - ay;
    d = max;
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const px = ax + (dx / d) * a;
  const py = ay + (dy / d) * a;
  return [px - bend * (dy / d) * h, py + bend * (dx / d) * h, fx, fy];
}

/** Repaint the pixels already drawn in `from` inside a test with `to`, keeping their shading. */
function recolor(c: PixelCanvas, from: Material, to: Material, test: (x: number, y: number) => boolean, bias = 0): void {
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      if (c.materialAt(x, y) !== from || !test(x, y)) continue;
      const i = y * c.w + x;
      c.px(x, y, to, { x: c.nx[i], y: c.ny[i], z: c.nz[i] }, { bias: c.bias[i] + bias });
    }
  }
}

/** Fur: short strokes of shadow (and a few of light) combed down and back along the coat, so it reads as hair, not felt. */
function comb(c: PixelCanvas, m: Material, x0: number, x1: number, y0: number, y1: number, seed: number): void {
  for (let y = y0; y <= y1; y += 3) {
    for (let x = x0 + ((y / 3) % 2) * 2; x <= x1; x += 4) {
      const jx = x + Math.floor(hash2(x, y, seed) * 3);
      const jy = y + Math.floor(hash2(x, y, seed + 1) * 2);
      if (c.materialAt(jx, jy) !== m || hash2(x, y, seed + 2) < 0.35) continue;
      const lit = hash2(x, y, seed + 3) < 0.22;
      const len = 2 + Math.floor(hash2(x, y, seed + 4) * 2);
      for (let k = 0; k < len; k++) {
        const sx = jx - Math.floor(k * 0.6);
        const sy = jy + k;
        if (c.materialAt(sx, sy) === m) c.shade(sx, sy, lit ? 1 : -1);
      }
    }
  }
}

/** A paw: a pad of fur, black claws at its toes. `far` ones are darker. */
function paw(c: PixelCanvas, x: number, y: number, far: boolean, lifted = false): void {
  const o = { bias: far ? -2 : 0 };
  c.part();
  c.ellipse(x + 0.5, y - 2, 4.4, 2.6, FUR_WHITE, { ...o, flatten: 0.8 });
  c.part();
  const by = lifted ? y - 1 : y;
  for (const dx of [2.5, 4.2]) c.px(x + dx, by, HORN, sphere(0.4, 0.3), o);
  c.px(x + 5, by - 1, HORN, sphere(0.6, 0.2), o);
}

/** A hind leg: a heavy thigh, the stifle forward, a long hock back, the paw. */
function hindLeg(c: PixelCanvas, hipX: number, hipY: number, foot: [number, number], far: boolean): void {
  const o = { bias: far ? -2 : 0 };
  const [fx, fy] = foot;
  const hockX = fx - 4;
  const hockY = fy - 12;
  const [kx, ky] = joint(hipX, hipY, hockX, hockY, 14, 13, 1);
  c.part();
  c.capsule(hipX, hipY, kx, ky, 8.5, 5, FUR_WHITE, o);
  c.capsule(kx, ky, hockX, hockY, 4.6, 3, FUR_WHITE, o);
  c.capsule(hockX, hockY, fx, fy - 2, 3, 2.6, FUR_WHITE, o);
  // A feathering of long fur off the back of the thigh.
  for (let k = 0; k < 3; k++) {
    const u = 0.35 + k * 0.2;
    const tx = hipX + (kx - hipX) * u - 6 - k;
    const ty = hipY + (ky - hipY) * u + 2;
    c.capsule(tx + 3, ty - 2, tx, ty + 2, 1.6, 0.5, FUR_WHITE, o);
  }
  paw(c, fx, fy, far);
}

/** A fore leg: the shoulder, the elbow back, a straight forearm, a short pastern, the paw. */
function foreLeg(c: PixelCanvas, shX: number, shY: number, foot: [number, number], far: boolean, lifted: boolean): void {
  const o = { bias: far ? -2 : 0 };
  const [fx, fy] = foot;
  const wx = fx - 0.5;
  const wy = fy - 6;
  const [ex, ey] = joint(shX, shY, wx, wy, 13, 14, -1);
  c.part();
  c.capsule(shX, shY, ex, ey, 7.5, 4.6, FUR_WHITE, o);
  c.capsule(ex, ey, wx, wy, 4.4, 3, FUR_WHITE, o);
  c.capsule(wx, wy, fx, fy - 2, 3, 2.8, FUR_WHITE, o);
  // The long fur behind the forearm.
  c.capsule(ex - 2, ey + 1, ex - 4, ey + 7, 1.8, 0.6, FUR_WHITE, o);
  paw(c, fx, fy, far, lifted);
}

/** The tail: a great brush of fur from the rump, dark at its tip, a few crystals caught in it. */
function tail(c: PixelCanvas, x: number, y: number, p: Pose): void {
  const sway = Math.sin(p.t * Math.PI * 2) * 0.12;
  // Its angle from pointing straight back: down when low, up when raised.
  const base = Math.PI - 0.85 + p.tail * 0.8 + sway;
  const pts: [number, number, number][] = [];
  let px = x;
  let py = y;
  let a = base;
  for (let i = 0; i < 7; i++) {
    pts.push([px, py, 5.4 - i * 0.3 + (i === 2 || i === 3 ? 1 : 0)]);
    // It curls up a little toward its tip.
    a += (p.tail > 0.3 ? 0.14 : 0.07) + sway * 0.3;
    px += Math.cos(a) * 3.8;
    py += Math.sin(a) * 3.8;
  }
  c.part();
  for (let i = 0; i < pts.length; i++) {
    const [tx, ty, r] = pts[i];
    c.ellipse(tx, ty, r, r * 0.9, i >= 5 ? FUR_GREY : FUR_WHITE, { bias: i >= 5 ? 1 : 0 });
  }
  // Tufts along its underside.
  for (let i = 1; i < pts.length - 1; i += 2) {
    const [tx, ty, r] = pts[i];
    c.capsule(tx, ty + r * 0.4, tx - 2, ty + r + 2, 1.3, 0.4, FUR_WHITE, { bias: -1 });
  }
  comb(c, FUR_WHITE, x - 30, x, y - 30, y + 30, 7);
  c.part();
  const [cx, cy] = pts[3];
  crystal(c, cx, cy - 3, cx - 3, cy - 9, 1.5, MANE, C_ICE);
}

/** The mane: crystals of ice bristling up and back along the neck and shoulders, their hearts aflame with aurora. */
function mane(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, p: Pose): void {
  const n = 13;
  const flare = 1 + p.mane * 0.35;
  // From the shoulders (back) to behind the skull (front), so the nearer, taller ones lie over the rest.
  const list: { bx: number; by: number; len: number; k: number }[] = [];
  for (let k = 0; k < n; k++) {
    const u = k / (n - 1);
    const bx = x1 + (x0 - x1) * u;
    const by = y1 + (y0 - y1) * u + Math.sin(u * Math.PI) * -2;
    // Tallest over the withers, shorter toward the back and the skull.
    const len = (5 + Math.sin(Math.min(1, u * 1.25) * Math.PI) * 12 + hash2(k, 1, 3) * 4) * flare;
    list.push({ bx, by, len, k });
  }
  for (const pass of [0, 1]) {
    for (const { bx, by, len, k } of list) {
      if ((k % 2) !== pass) continue;
      const lean = -0.35 - hash2(k, 2, 3) * 0.55 - (1 - k / n) * 0.35;
      const ux = Math.sin(lean);
      const uy = -Math.cos(lean);
      c.part();
      crystal(c, bx, by, bx + ux * len, by + uy * len, pass ? 2.6 : 2.2, pass ? MANE : MANE_DARK, pass ? C_WHITE : null);
      // Their hearts: a seam of aurora up the bigger ones.
      if (len > 9) {
        c.part();
        const glow = k % 3 === 0 ? GLOW_ICE : GLOW_AURORA;
        for (let s = 0.2; s < 0.7; s += 0.12) c.px(bx + ux * len * s, by + uy * len * s, glow, { x: 0, y: 0, z: 1 }, { glow: 0.5 + p.mane * 0.5 });
      }
    }
  }
  // Aurora light caught round the mane as it blazes.
  if (p.mane > 0.4) {
    for (let k = 0; k < 10; k++) {
      const u = hash2(k, Math.floor(p.t * 6), 21);
      const bx = x1 + (x0 - x1) * u;
      const by = y1 + (y0 - y1) * u - 6 - hash2(k, 3, 21) * 14 * p.mane;
      c.spark(bx - 3, by, k % 2 ? C_AURORA : C_TEAL, 0.3 + p.mane * 0.4);
    }
  }
}

/** The head side-on: skull at (x, y), turned by `a`. */
function head(c: PixelCanvas, x: number, y: number, p: Pose): void {
  const a = p.ha;
  const Q = (u: number, v: number) => turn(x, y, a, u * HEAD, v * HEAD);
  // The far ear, behind.
  c.part();
  {
    const [bx, by] = Q(-3, -6);
    const [tx, ty] = Q(-6 - p.ear * 4, -15 + p.ear * 6);
    c.capsule(bx, by, tx, ty, 2.8, 0.6, FUR_GREY, { bias: -1 });
  }
  // Skull and cheeks.
  c.part();
  c.ellipse(...Q(0, 0), 10, 9, FUR_WHITE);
  // A ruff of fur at the back of the cheek, in jagged tufts.
  c.part();
  for (let k = 0; k < 4; k++) {
    const [bx, by] = Q(-5 + k * 0.5, 1 + k * 2.2);
    const [tx, ty] = Q(-11 - k * 0.6, 4 + k * 3.2);
    c.capsule(bx, by, tx, ty, 2.6, 0.5, FUR_WHITE, { bias: k % 2 ? -1 : 0 });
  }
  // The lower jaw, hinged under the cheek, opening downward.
  const ja = p.jaw * 0.55;
  const hinge = Q(2, 4);
  const jawAt = (u: number, v: number): [number, number] => turn(hinge[0], hinge[1], a + ja, u * HEAD, v * HEAD);
  c.part();
  if (p.jaw > 0.05) {
    // The maw between the jaws: dark, or lit by the breath.
    const [ux, uy] = Q(14, 4.5);
    const [lx, ly] = jawAt(11, 1.5);
    const [hx, hy] = Q(3, 4);
    const m = p.frost > 0.3 ? MAW_GLOW : HOLLOW;
    for (let s = 0; s <= 1.0001; s += 0.08) {
      const ax = ux + (lx - ux) * s;
      const ay = uy + (ly - uy) * s;
      c.line(hx, hy, ax, ay, m);
    }
    if (p.frost <= 0.3) {
      const [tx, ty] = jawAt(7, 0.2);
      c.capsule(hx + 1, hy + 1, tx, ty, 1.4, 1, TONGUE);
    }
  }
  c.part();
  c.capsule(...jawAt(0, 0), ...jawAt(11, 1.5), 3.6, 2.1, FUR_WHITE, { bias: -1 });
  // Lower fangs, pointing up out of the jaw.
  if (p.jaw > 0.2) {
    c.part();
    const [f1x, f1y] = jawAt(9.5, -0.4);
    c.px(f1x, f1y, IVORY, sphere(-0.3, 0.4));
    c.px(f1x, f1y - 1, IVORY, sphere(-0.3, 0.6));
  }
  // The muzzle: long, tapering, grey along its bridge.
  c.part();
  c.capsule(...Q(3, 1), ...Q(14.5, 2.6), 5.6, 3.2, FUR_WHITE);
  c.part();
  c.capsule(...Q(4, -2.4), ...Q(13, 0.2), 2.2, 1.2, FUR_GREY, { bias: 1 });
  // Upper fangs hanging over the lip.
  c.part();
  for (const [u, l] of [[11.5, 2.6], [8, 1.6]] as const) {
    const [fx, fy] = Q(u, 5);
    c.px(fx, fy, IVORY, sphere(-0.3, 0.3));
    if (l > 2 || p.jaw > 0.2) c.px(fx, fy + 1, IVORY, sphere(-0.3, -0.2));
  }
  // The nose, black and wet.
  c.part();
  const [nx, ny] = Q(16.2, 1.6);
  c.ellipse(nx, ny, 2, 1.7, HORN);
  c.spark(nx - 0.5, ny - 0.8, C_WHITE, 0.35);
  // Frost on the brow and the whiskers.
  c.part();
  for (const [u, v] of [[1, -6.5], [3, -6], [9, -1], [11, 0]] as const) c.px(...Q(u, v), RIME, sphere(-0.2, 0.6));
  // The eye: a slit of aurora under a heavy brow.
  c.part();
  const [ex, ey] = Q(4.5, -2.4);
  if (p.blink) {
    c.px(ex - 1, ey + 1, FUR_GREY, sphere(0, 0.4));
    c.px(ex, ey + 1, FUR_GREY, sphere(0, 0.4));
  } else {
    c.px(ex - 1, ey, GLOW_AURORA);
    c.px(ex, ey, GLOW_AURORA);
    c.px(ex + 1, ey - 1, GLOW_AURORA);
    c.spark(ex, ey, C_AURORA, 0.9);
    c.spark(ex + 2, ey - 1, C_TEAL, 0.35);
  }
  for (let u = -1; u <= 3; u++) c.shade(...Q(3 + u, -4.2), -1);
  // The near ear: tall, pointed, laid back when it means harm.
  c.part();
  {
    const [bx, by] = Q(-1, -6.5);
    const [tx, ty] = Q(-4 - p.ear * 5, -17 + p.ear * 7);
    c.capsule(bx, by, tx, ty, 3.2, 0.7, FUR_WHITE);
    c.part();
    const [ix, iy] = Q(-1.2, -8);
    const [jx, jy] = Q(-3.2 - p.ear * 4, -14 + p.ear * 6);
    c.capsule(ix, iy, jx, jy, 1.2, 0.4, FLESH);
  }
  comb(c, FUR_WHITE, Math.floor(x - 14), Math.ceil(x + 18), Math.floor(y - 18), Math.ceil(y + 14), 3);
}

function vargr(p: Pose): PixelCanvas {
  const c = new PixelCanvas(F.w, F.h);
  const tau = p.t * Math.PI * 2;
  const breathe = Math.sin(tau) * 0.6;
  // The body's three masses.
  const rx = 30 - p.stretch * 0.4;
  const ry = 39 + p.bob + p.pitch * 0.3;
  const cx = 64 + p.stretch * 0.6;
  const cy = 37 + p.bob - p.pitch + breathe * 0.4;
  const far = (f: [number, number]): [number, number] => [f[0] + FAR_ON, f[1] - FAR_UP];

  // The far legs, behind everything.
  hindLeg(c, rx + 2 + FAR_ON, ry + 4 - FAR_UP, far(p.fh), true);
  foreLeg(c, cx + 2 + FAR_ON, cy + 6 - FAR_UP, far(p.ff), true, false);

  // The body: rump, a waist tucked up under the loin, a deep chest.
  c.part();
  c.ellipse(rx, ry, 14, 12.5, FUR_WHITE);
  c.capsule(rx + 4, ry - 2, cx - 4, cy - 1, 11.5, 13.5, FUR_WHITE);
  c.ellipse(cx, cy + 1.5 - breathe * 0.3, 14.5 + breathe * 0.3, 16 + breathe * 0.3, FUR_WHITE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy, 1.05) });
  // Long fur hanging from the belly and chest in a ragged fringe.
  for (let k = 0; k < 4; k++) {
    const u = 0.35 + k * 0.2;
    const bx = rx + 8 + (cx + 8 - rx - 8) * u;
    const belly = ry + 8 + (cy + 14 - ry - 8) * Math.pow(u, 1.5);
    const len = 1.5 + u * 2.5 + hash2(k, 4, 9);
    c.capsule(bx + 1, belly - 2, bx - 1, belly + len, 2.2, 0.8, FUR_WHITE, { bias: -1 });
  }
  // The storm-grey saddle down the back, ragged at its lower edge.
  const back = (x: number) => {
    const u = clamp01((x - (rx - 10)) / (cx + 6 - (rx - 10)));
    return ry - 12 + (cy - 14 - (ry - 12)) * u + 8 + Math.sin(x * 0.9) * 1.2 + hash2(x, 0, 5) * 1.5;
  };
  recolor(c, FUR_WHITE, FUR_GREY, (x, y) => x > rx - 14 && x < cx + 4 && y < back(x), 0);
  comb(c, FUR_WHITE, 0, F.w - 1, 10, GROUND, 1);
  comb(c, FUR_GREY, 0, F.w - 1, 10, GROUND, 2);
  // Icicles hanging from the fur of its belly.
  c.part();
  for (const k of [2, 4, 6]) {
    const u = k / 8;
    const bx = Math.round(rx + 8 + (cx + 8 - rx - 8) * u - 1);
    const by = Math.round(ry + 8 + (cy + 14 - ry - 8) * Math.pow(u, 1.5) + 1 + u * 2);
    const len = 2 + (k % 3);
    for (let s = 0; s < len; s++) c.px(bx, by + s, ICE, { x: -0.3, y: 0.2, z: 0.9 });
    c.spark(bx, by + len - 1, C_WHITE, 0.5);
  }

  // The tail, over the rump's back edge, and the near legs.
  tail(c, rx - 10, ry - 6, p);
  hindLeg(c, rx + 2, ry + 4, p.nh, false);
  foreLeg(c, cx + 2, cy + 6, p.nf, false, !!p.paw);

  // The neck: thick, rising from the chest to the skull, a ruff at the throat.
  const hx = 84 + p.hx;
  const hy = 27 + p.bob * 0.6 - p.pitch * 1.2 + p.hy + breathe * 0.5;
  c.part();
  c.capsule(cx - 2, cy - 4, hx - 3, hy + 2, 12, 8.5, FUR_WHITE);
  c.part();
  for (let k = 0; k < 5; k++) {
    const u = k / 4;
    const bx = cx + 6 + (hx - cx - 6) * u * 0.8;
    const by = cy + 6 + (hy + 8 - cy - 6) * u;
    c.capsule(bx - 1, by - 2, bx + 3.5, by + 3.5, 2.6, 0.6, FUR_WHITE, { bias: k % 2 ? 0 : -1 });
  }
  comb(c, FUR_WHITE, Math.floor(cx - 14), Math.ceil(hx + 4), Math.floor(hy - 12), Math.ceil(cy + 18), 4);
  recolor(c, FUR_WHITE, FUR_GREY, (x, y) => x > cx - 16 && x < hx - 6 && y < cy - 12 + (x - cx) * -0.25 + Math.sin(x * 1.3) * 1.3 && y > hy - 16, 1);

  // The mane of ice, from the withers up to behind the skull.
  mane(c, hx - 7, hy - 6, rx + 18, ry - 13, p);

  head(c, hx, hy, p);

  // Breath steaming off the muzzle in the cold.
  if (p.steam > 0) {
    const [mx, my] = turn(hx, hy, p.ha, 18, 3);
    for (let k = 0; k < 10 * p.steam; k++) {
      const d = 1 + hash2(k, Math.floor(p.t * 12), 31) * 9;
      const up = hash2(k, 7, Math.floor(p.t * 12)) * 5;
      c.spark(mx + d, my - up + Math.sin(d) * 1.5, k % 3 ? C_WHITE : C_ICE, (0.18 + p.steam * 0.25) * (1 - d / 11));
    }
  }
  if (p.frost > 0) {
    const [mx, my] = turn(hx, hy, p.ha, 15, 5);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      c.spark(mx + Math.cos(a) * 3 * p.frost, my + Math.sin(a) * 2.4 * p.frost, k % 2 ? C_ICE : C_WHITE, 0.5 * p.frost);
    }
  }
  return c;
}

// ---------------------------------------------------------------- Gaits and poses

/** A trot: diagonal pairs (near hind with far fore) striking the snow together. */
function trot(t: number): Pose {
  const leg = (base: number, off: number, stride: number, lift: number): [number, number] => {
    const ph = (((t + off) % 1) + 1) % 1;
    if (ph < 0.55) return [base + stride * (0.5 - ph / 0.55), GROUND];
    const s = (ph - 0.55) / 0.45;
    const e = s * s * (3 - 2 * s);
    return [base + stride * (-0.5 + e), GROUND - Math.sin(s * Math.PI) * lift];
  };
  const tau = t * Math.PI * 2;
  return P({
    t,
    bob: -Math.abs(Math.sin(tau)) * 1.6 + 0.8,
    pitch: Math.sin(tau * 2) * 0.4,
    nh: leg(34, 0, 14, 6),
    ff: leg(68, 0, 14, 7),
    nf: leg(72, 0.5, 14, 7),
    fh: leg(30, 0.5, 14, 6),
    hy: Math.sin(tau * 2 + 0.6) * 0.8,
    ha: 0.18,
    tail: -0.2 + Math.sin(tau) * 0.15,
    ear: 0.2,
    steam: t > 0.4 && t < 0.7 ? 0.5 : 0,
  });
}

function poses(): Record<string, () => PixelCanvas> {
  const out: Record<string, () => PixelCanvas> = {};
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    out[`idle${i}`] = () => vargr(P({ t, tail: -0.45 + Math.sin(t * Math.PI * 2) * 0.1, steam: i === 2 || i === 3 ? 0.7 : 0, blink: i === 4, hy: Math.sin(t * Math.PI * 2) * 0.5 }));
  }
  for (let i = 0; i < 8; i++) out[`walk${i}`] = () => vargr(trot(i / 8));
  // The crouch before a pounce: haunches gathered, chest to the snow, ears back.
  out.crouch0 = () => vargr(P({ t: 0.1, bob: 5, pitch: -3, stretch: -3, nh: [40, GROUND], fh: [36, GROUND], nf: [76, GROUND], ff: [72, GROUND], hx: 2, hy: 7, ha: 0.25, jaw: 0.25, tail: 0.1, mane: 0.6, ear: 1, steam: 0.4 }));
  out.crouch1 = () => vargr(P({ t: 0.6, bob: 6, pitch: -3.5, stretch: -4, nh: [41, GROUND], fh: [37, GROUND], nf: [76, GROUND], ff: [72, GROUND], hx: 2, hy: 8, ha: 0.25, jaw: 0.35, tail: 0.2, mane: 0.7, ear: 1, steam: 0.6 }));
  // The pounce: launching, then flying at full stretch, fore paws reaching.
  out.leap0 = () => vargr(P({ t: 0.2, bob: -2, pitch: 5, stretch: 4, nh: [18, GROUND - 2], fh: [14, GROUND - 3], nf: [86, GROUND - 14], ff: [82, GROUND - 12], hx: 3, hy: -2, ha: 0.05, jaw: 0.5, tail: 0.3, mane: 0.8, ear: 1 }));
  out.leap1 = () => vargr(P({ t: 0.5, bob: -1, pitch: -1, stretch: 6, nh: [12, GROUND - 8], fh: [8, GROUND - 9], nf: [94, GROUND - 6], ff: [90, GROUND - 4], hx: 3, hy: 3, ha: 0.25, jaw: 0.8, tail: 0.2, mane: 0.9, ear: 1 }));
  // The landing: fore paws driven into the snow, the body thrown down onto them.
  out.land0 = () => vargr(P({ t: 0.3, bob: 6, pitch: -5, stretch: 2, nh: [36, GROUND], fh: [32, GROUND], nf: [84, GROUND], ff: [80, GROUND], hx: 4, hy: 10, ha: 0.35, jaw: 0.7, tail: 0.4, mane: 1, ear: 1, steam: 0.8 }));
  out.land1 = () => vargr(P({ t: 0.7, bob: 3, pitch: -2, stretch: 1, nh: [36, GROUND], fh: [32, GROUND], nf: [80, GROUND], ff: [76, GROUND], hx: 2, hy: 5, ha: 0.25, jaw: 0.3, tail: 0.2, mane: 0.7, ear: 0.6, steam: 1 }));
  // The howl: the head thrown back, the mane flaring.
  out.howl0 = () => vargr(P({ t: 0.1, bob: 1, pitch: 3, hx: -2, hy: -6, ha: -0.4, jaw: 0.3, tail: 0, mane: 0.6, ear: 0.4, steam: 0.3 }));
  out.howl1 = () => vargr(P({ t: 0.4, bob: 2, pitch: 6, nh: [36, GROUND], fh: [32, GROUND], hx: -4, hy: -6, ha: -0.75, jaw: 0.75, tail: 0.3, mane: 1, ear: 0.6, steam: 0.8 }));
  out.howl2 = () => vargr(P({ t: 0.8, bob: 2, pitch: 6.5, nh: [36, GROUND], fh: [32, GROUND], hx: -4, hy: -7, ha: -0.8, jaw: 0.9, tail: 0.35, mane: 1, ear: 0.6, steam: 1 }));
  // The frost breath: drawing in (chest swelling, frost in the throat), then a gaping blast.
  out.breath0 = () => vargr(P({ t: 0.2, bob: 0, pitch: 3, hx: -3, hy: -5, ha: -0.2, jaw: 0.15, tail: -0.1, mane: 0.7, ear: 0.5, frost: 0.6 }));
  out.breath1 = () => vargr(P({ t: 0.5, bob: 3, pitch: -2, stretch: 1, nf: [76, GROUND], ff: [72, GROUND], hx: 4, hy: 7, ha: 0.25, jaw: 0.95, tail: 0.1, mane: 0.9, ear: 0.9, frost: 1 }));
  out.breath2 = () => vargr(P({ t: 0.75, bob: 3, pitch: -2, stretch: 1, nf: [76, GROUND], ff: [72, GROUND], hx: 4, hy: 8, ha: 0.27, jaw: 1, tail: 0.15, mane: 1, ear: 0.9, frost: 1 }));
  // The swipe: rearing onto the haunches, the near fore paw raised, then raked down.
  out.swipe0 = () => vargr(P({ t: 0.2, bob: 0, pitch: 7, stretch: -2, nh: [38, GROUND], fh: [34, GROUND], nf: [90, GROUND - 22], ff: [72, GROUND], hx: -1, hy: -7, ha: 0.05, jaw: 0.6, tail: 0.3, mane: 0.8, ear: 1, paw: true }));
  out.swipe1 = () => vargr(P({ t: 0.6, bob: 4, pitch: -3, stretch: 2, nh: [36, GROUND], fh: [32, GROUND], nf: [92, GROUND], ff: [74, GROUND], hx: 5, hy: 7, ha: 0.3, jaw: 0.5, tail: 0.3, mane: 0.9, ear: 1 }));
  // Spent: head hung low, flanks heaving, steam pouring off it. The moment to strike.
  out.pant0 = () => vargr(P({ t: 0.25, bob: 2, pitch: -1, hx: 2, hy: 8, ha: 0.35, jaw: 0.4, tail: -0.7, mane: 0.1, ear: 0.3, steam: 1 }));
  out.pant1 = () => vargr(P({ t: 0.75, bob: 3, pitch: -1.5, hx: 2, hy: 9, ha: 0.37, jaw: 0.25, tail: -0.75, mane: 0.1, ear: 0.3, steam: 0.6 }));
  return out;
}

export function buildVargrSheet(): MonsterSheet {
  return sheet(F, poses(), [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3', 'idle4', 'idle5'], fps: 5, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'walk6', 'walk7'], fps: 11, loop: true },
    { name: 'crouch', frames: ['crouch0', 'crouch1'], fps: 7, loop: true },
    { name: 'leap', frames: ['leap0', 'leap1'], fps: 6, loop: false },
    { name: 'land', frames: ['land0', 'land1'], fps: 6, loop: false },
    { name: 'howl', frames: ['howl0', 'howl1', 'howl2', 'howl1', 'howl2'], fps: 5, loop: false },
    { name: 'inhale', frames: ['breath0'], fps: 1, loop: false },
    { name: 'breathe', frames: ['breath1', 'breath2'], fps: 10, loop: true },
    { name: 'raise', frames: ['swipe0'], fps: 1, loop: false },
    { name: 'swipe', frames: ['swipe1'], fps: 1, loop: false },
    { name: 'pant', frames: ['pant0', 'pant1'], fps: 3, loop: true },
  ]);
}

// ---------------------------------------------------------------- Spells (pure light)

type Px = Uint8ClampedArray;
const put = (px: Px, w: number, x: number, y: number, c: RGB, a = 255): void => {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= w || (y * w + x) * 4 >= px.length) return;
  const i = (y * w + x) * 4;
  if (px[i + 3] && px[i] + px[i + 1] + px[i + 2] > c[0] + c[1] + c[2]) return;
  px.set([c[0], c[1], c[2], a], i);
};

/** The breath's wedge on the ground: its apex at the left middle, pointing right, `VG_CONE_HALF` radians either side. */
export const VG_CONE_W = 64;
export const VG_CONE_H = 48;
export const VG_CONE_HALF = 0.34;

function coneArt(): Px {
  const w = VG_CONE_W;
  const h = VG_CONE_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5;
      const dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy) / (w - 1);
      const a = Math.abs(Math.atan2(dy, dx)) / VG_CONE_HALF;
      if (r > 1 || a > 1) continue;
      // Bright frosted edges and rim, a faint dithered wash within, stronger toward its far end.
      const edge = a > 0.86 || r > 0.94;
      const v = edge ? 0.9 : 0.12 + r * 0.3;
      if (!edge && bayer(x, y) > 0.35 + r * 0.5) continue;
      const k = Math.round(255 * v);
      put(px, w, x, y, [k, k, k]);
    }
  }
  return px;
}

/** A billow of frost breath, frame `f` of four: a swirl of mist pricked with ice crystals. */
export const VG_BREATH_W = 26;
export const VG_BREATH_H = 18;

function breathArt(f: number): Px {
  const w = VG_BREATH_W;
  const h = VG_BREATH_H;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - w / 2) / (w / 2);
      const v = (y + 0.5 - h / 2) / (h / 2);
      const r = Math.hypot(u, v);
      const a = Math.atan2(v, u);
      // Curls of mist turning round the middle.
      const curl = Math.sin(a * 3 + r * 7 - f * 1.4) * 0.5 + 0.5;
      const k = clamp01(1 - r) * (0.55 + curl * 0.6);
      if (k <= 0.05 || bayer(x + f, y) > k * 1.5) continue;
      const c: RGB = k > 0.6 ? [255, 255, 255] : k > 0.35 ? [200, 240, 255] : [90, 170, 230];
      put(px, w, x, y, c);
    }
  }
  // Crystals glittering in it.
  for (let k = 0; k < 6; k++) {
    const x = 3 + hash2(k, f, 41) * (w - 6);
    const y = 3 + hash2(k, f, 43) * (h - 6);
    put(px, w, x, y, [255, 255, 255]);
    put(px, w, x - 1, y, [154, 232, 255]);
    put(px, w, x + 1, y, [154, 232, 255]);
    put(px, w, x, y - 1, [154, 232, 255]);
    put(px, w, x, y + 1, [154, 232, 255]);
  }
  return px;
}

/** Three claw rakes, frame `f` of three (drawn, full, fading), slashing down and forward (to the right). */
export const VG_CLAW_W = 44;
export const VG_CLAW_H = 30;

function clawArt(f: number): Px {
  const w = VG_CLAW_W;
  const h = VG_CLAW_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const reach = f === 0 ? 0.55 : 1;
  const fade = f === 2 ? 0.55 : 1;
  for (let k = 0; k < 3; k++) {
    // Arcs from top-left curving down to the right.
    const ox = 6 + k * 6;
    const oy = 3 + k * 2;
    for (let s = 0; s <= reach; s += 0.01) {
      const x = ox + s * 28;
      const y = oy + Math.sin(s * Math.PI * 0.8) * 20 + s * 4;
      const thick = Math.sin(s * Math.PI) * 2.2 * (f === 2 ? 0.6 : 1);
      for (let d = -thick; d <= thick; d += 0.5) {
        const edge = Math.abs(d) > thick - 0.8;
        const c: RGB = edge ? [74, 176, 255] : [234, 251, 255];
        const a = Math.round(255 * fade * (f === 2 && bayer(Math.round(x), Math.round(y + d)) > 0.5 ? 0 : 1));
        if (a) put(px, w, x - d * 0.4, y + d, c, a);
      }
    }
    // Sparks flicking off each rake's end.
    if (f > 0) for (let q = 0; q < 3; q++) put(px, w, ox + 28 + q * 2, oy + 24 - k + q, [154, 232, 255], Math.round(255 * fade));
  }
  return px;
}

export function vargrFx(r: FxRegistrar): void {
  r.image('vg_cone', VG_CONE_W, VG_CONE_H, coneArt());
  r.strip('vg_breath', VG_BREATH_W, VG_BREATH_H, [0, 1, 2, 3].map(breathArt), 'b');
  r.anim('vg_breath_roll', 'vg_breath', ['b0', 'b1', 'b2', 'b3'], 12, true);
  r.strip('vg_claw', VG_CLAW_W, VG_CLAW_H, [0, 1, 2].map(clawArt), 'c');
  r.anim('vg_claw_rake', 'vg_claw', ['c0', 'c1', 'c2'], 18, false);
}

