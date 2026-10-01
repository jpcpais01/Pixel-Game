// The Everwood's wild things (see world/Wildlife.ts): deer that graze in the
// glades (a doe, a young buck, a spotted fawn), a red fox slipping between
// the trees, little songbirds pecking in the grass (a robin, a blue tit, a
// goldfinch) and, by night, an owl on a branch whose eyes catch the light.
// They are only life, not foes: nothing here is caught or fought.
//
// Each is drawn side-on facing right (the world mirrors them), on a small rig
// of its own: a body of rump, barrel and chest, legs solved from hip to hoof,
// a head that can look ahead, turn to the viewer, rise in alarm or bow to
// graze. Their gaits come from the same rigs. The owl is the one drawn face
// on, as owls are met: staring back.
//
// And the wind's own mark: a thin white streak that curls once and is gone,
// drawn along a gust as it crosses the forest (see world/ForestWind.ts).

import { FLAT, PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** Where the knee (or hock) goes between an upper joint and the foot, for limbs `l1` and `l2`; `bend` +1 bends it back, -1 forward. */
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

/** A point turned by `a` round (0, 0), then placed at (x, y). */
const turn = (x: number, y: number, a: number, u: number, v: number): [number, number] => [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)];

/** A foot's place in its stride at phase `ph` (0..1): planted and sliding back, then lifted and swung forward. */
function stride(rest: number, ground: number, ph: number, len: number, lift: number, stance: number): [number, number] {
  const t = ((ph % 1) + 1) % 1;
  if (t < stance) return [rest + len / 2 - (len * t) / stance, ground];
  const u = (t - stance) / (1 - stance);
  return [rest - len / 2 + len * u, ground - Math.sin(u * Math.PI) * lift];
}

/**
 * Draws through a scale about an anchor (a fawn is its mother's rig, smaller).
 * Radii shrink too, but never so thin a limb breaks up into dots.
 */
class Rig {
  constructor(
    readonly c: PixelCanvas,
    private k = 1,
    private ax = 0,
    private ay = 0,
  ) {}

  P(x: number, y: number): [number, number] {
    return [this.ax + (x - this.ax) * this.k, this.ay + (y - this.ay) * this.k];
  }

  private r(r: number, min = 0.55): number {
    return this.k === 1 ? r : Math.max(min, r * this.k);
  }

  part(): void {
    this.c.part();
  }

  px(x: number, y: number, m: Material, n: Vec3 = FLAT, o: { bias?: number; glow?: number } = {}): void {
    const [a, b] = this.P(x, y);
    this.c.px(a, b, m, n, o);
  }

  ellipse(x: number, y: number, rx: number, ry: number, m: Material, o: { bias?: number; glow?: number; normal?: (x: number, y: number, dx: number, dy: number) => Vec3 } = {}): void {
    const [a, b] = this.P(x, y);
    this.c.ellipse(a, b, this.r(rx, 0.8), this.r(ry, 0.8), m, o);
  }

  capsule(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, m: Material, o: { bias?: number; glow?: number } = {}): void {
    const [a, b] = this.P(x0, y0);
    const [c, d] = this.P(x1, y1);
    this.c.capsule(a, b, c, d, this.r(r0), this.r(r1), m, o);
  }

  line(x0: number, y0: number, x1: number, y1: number, m: Material, n: () => Vec3 = () => FLAT, o: { bias?: number; glow?: number } = {}): void {
    const [a, b] = this.P(x0, y0);
    const [c, d] = this.P(x1, y1);
    this.c.line(a, b, c, d, m, n, o);
  }

  spark(x: number, y: number, col: RGB, a = 1): void {
    const [p, q] = this.P(x, y);
    this.c.spark(p, q, col, a);
  }
}

// ================================================================ deer

export const DEER_W = 36;
export const DEER_H = 34;
/** Where a deer stands in its frame: between its hooves, on the ground. */
export const DEER_OX = 17;
export const DEER_OY = 32;
/** Everything is drawn this far down in the frame, to leave a buck's antlers room. */
const D_DROP = 2;
/** The near hooves' bottom row; the far ones stand a little higher and further on, as the ground is seen at a slant. */
const DG = 29;
const D_FAR_UP = 1;
const D_FAR_ON = 1;

export type DeerLook = 'doe' | 'buck' | 'fawn';
export const DEER_LOOKS: DeerLook[] = ['doe', 'buck', 'fawn'];

interface DeerMats {
  coat: Material;
  dark: Material;
  pale: Material;
  earIn: Material;
  /** A fawn's dapples, and its smaller frame (scale about its feet). */
  spots: boolean;
  k: number;
  antlers: boolean;
}

const D_PALE: Material = { ramp: ramp('#7a6c5c', '#a89a86', '#d2c8b6', '#eee8dc', '#fbf8f2'), outline: hex('#2e261e') };
const D_DARK: Material = { ramp: ramp('#0e0b0a', '#1e1816', '#342c28'), outline: hex('#060404'), noAO: true };
const D_EAR: Material = { ramp: ramp('#6e4a3e', '#946454', '#b4806c'), outline: hex('#2a1810'), noOutline: true, noAO: true };
const D_HOOF: Material = { ramp: ramp('#14100e', '#2a221e', '#463a32'), outline: hex('#080606'), shine: true };
const D_EYE: Material = { ramp: ramp('#07060a', '#141218'), outline: hex('#030304'), noAO: true };
const ANTLER: Material = { ramp: ramp('#4a3c2a', '#76644a', '#a2906c', '#c8b894', '#e6dcc0'), outline: hex('#1e180e'), outlineLit: hex('#3a3020') };

const DEER_MATS: Record<DeerLook, DeerMats> = {
  doe: {
    coat: { ramp: ramp('#2e1c10', '#4a2e1a', '#6a4426', '#8a5c32', '#a8743e', '#c48e50', '#d8a868'), outline: hex('#170d06'), outlineLit: hex('#2a180c') },
    dark: D_DARK,
    pale: D_PALE,
    earIn: D_EAR,
    spots: false,
    k: 1,
    antlers: false,
  },
  buck: {
    coat: { ramp: ramp('#2a1a0e', '#422a18', '#5e3e24', '#7c542e', '#98693a', '#b2824a', '#c89a5e'), outline: hex('#140c06'), outlineLit: hex('#26160a') },
    dark: D_DARK,
    pale: D_PALE,
    earIn: D_EAR,
    spots: false,
    k: 1.04,
    antlers: true,
  },
  fawn: {
    coat: { ramp: ramp('#3a1a0c', '#5c2c14', '#80401e', '#a2562a', '#c06e36', '#d88a48', '#eaa660'), outline: hex('#1c0c04'), outlineLit: hex('#30160a') },
    dark: D_DARK,
    pale: D_PALE,
    earIn: D_EAR,
    spots: true,
    k: 0.7,
    antlers: false,
  },
};

type DeerHead = 'up' | 'high' | 'graze' | 'look';

interface DeerPose {
  /** Body lift (negative is up), and how much higher the chest is than the rump. */
  bob: number;
  pitch: number;
  /** Hoof positions (x, bottom row): near hind, near fore, far hind, far fore. */
  nh: [number, number];
  nf: [number, number];
  fh: [number, number];
  ff: [number, number];
  head: DeerHead;
  /** The head's nod (px down). */
  nod: number;
  /** 0 ears up, 1 one flicked back. */
  ear: number;
  /** 0 tail down, 1 raised: the white flag of alarm. */
  tail: number;
  blink: boolean;
}

const D_REST: DeerPose = { bob: 0, pitch: 0, nh: [12, DG], nf: [21.5, DG], fh: [12, DG], ff: [21.5, DG], head: 'up', nod: 0, ear: 0, tail: 0, blink: false };

function deerLeg(g: Rig, m: DeerMats, ax: number, ay: number, foot: [number, number], hind: boolean, far: boolean): void {
  const [jx, jy, fx, fy] = joint(ax, ay, foot[0], foot[1] - 1, hind ? 4.3 : 4.1, hind ? 4.4 : 4.5, hind ? 1 : -1);
  const o = { bias: far ? -1 : 0 };
  g.part();
  g.capsule(ax, ay, jx, jy, hind ? 1.25 : 1.05, 0.7, m.coat, o);
  g.capsule(jx, jy, fx, fy, 0.62, 0.55, m.coat, o);
  // The dark hoof.
  g.part();
  g.px(fx, fy, D_HOOF, sphere(0.2, 0.2), o);
  g.px(fx, fy + 1, D_HOOF, sphere(0.2, -0.4), o);
}

/** The head side-on, its skull at (x, y), turned by `a` (0.4 looks ahead and a little down). */
function deerSideHead(g: Rig, m: DeerMats, x: number, y: number, a: number, p: DeerPose): void {
  const P = (u: number, v: number) => turn(x, y, a, u, v);
  // The far ear (and antler), behind the head.
  const [fex, fey] = P(-0.4, -1.8);
  const [fetx, fety] = P(-2.6 - p.ear * 0.5, -4.6 + p.ear * 1.3);
  g.part();
  g.capsule(fex + 0.7, fey - 0.2, fetx + 0.9, fety, 1.05, 0.5, m.coat, { bias: -1 });
  if (m.antlers) antler(g, ...P(0.6, -1.9), a, true);
  // Skull, a tapering muzzle, the jaw rounding under the cheek.
  g.part();
  g.ellipse(x, y, 2.5, 2.2, m.coat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.85 - 0.15, 1) });
  const [mx0, my0] = P(0.6, 0.4);
  const [mx1, my1] = P(4.6, 1.4);
  g.capsule(mx0, my0, mx1, my1, 1.85, 1.05, m.coat);
  g.part();
  const [jx, jy] = P(0.9, 1.3);
  g.ellipse(jx, jy, 1.7, 1.3, m.coat, { bias: -1, normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.2, 1) });
  // The pale band behind the nose, and the chin.
  g.part();
  g.px(...P(3.2, 0.2), m.pale, sphere(0, -0.5), { bias: -1 });
  g.px(...P(3.6, 2.1), m.pale, sphere(0, 0.3), { bias: -1 });
  g.px(...P(5.2, 1.1), m.dark, sphere(0.5, 0.2));
  // A big dark eye with a glint, set high and back.
  g.part();
  const [ex, ey] = P(0.9, -0.5);
  if (p.blink) g.px(ex, ey + 0.5, m.coat, { x: 0, y: -0.3, z: 0.95 }, { bias: -2 });
  else {
    g.px(ex, ey, D_EYE, FLAT);
    g.px(ex + 1, ey, D_EYE, FLAT);
    g.spark(ex, ey, hex('#e8eef8'), 0.55);
  }
  // The near ear: big, cupped, pale-lined.
  g.part();
  const [nex, ney] = P(-0.9, -1.6);
  const [netx, nety] = P(-3.0 - p.ear * 0.7, -4.9 + p.ear * 1.5);
  g.capsule(nex, ney, netx, nety, 1.2, 0.55, m.coat);
  g.part();
  g.px(...P(-1.9 - p.ear * 0.4, -3.2 + p.ear * 0.7), m.earIn, FLAT);
  if (m.antlers) antler(g, ...P(-0.2, -2.0), a, false);
}

/** A young buck's antler: a beam curving up and forward, with two short tines. */
function antler(g: Rig, x: number, y: number, a: number, far: boolean): void {
  const P = (u: number, v: number) => turn(x, y, a - 0.4, u, v);
  const o = { bias: far ? -1 : 0 };
  const beam: [number, number][] = [[0, 0], [-0.4, -1.8], [0, -3.6], [1.2, -5]];
  g.part();
  for (let i = 0; i + 1 < beam.length; i++) {
    const [x0, y0] = P(...beam[i]);
    const [x1, y1] = P(...beam[i + 1]);
    g.line(x0, y0, x1, y1, ANTLER, () => cyl(-0.3, 0.5), o);
  }
  if (far) return;
  for (const [u0, v0, u1, v1] of [[-0.3, -2.2, 1.2, -3], [0.1, -3.8, -0.8, -5.4]]) {
    const [x0, y0] = P(u0, v0);
    const [x1, y1] = P(u1, v1);
    g.line(x0, y0, x1, y1, ANTLER, () => cyl(0, 0.6), o);
  }
}

/** The head turned to look out at the viewer, its face at (x, y): both eyes, both great ears. */
function deerFrontHead(g: Rig, m: DeerMats, x: number, y: number, p: DeerPose): void {
  g.part();
  for (const side of [-1, 1]) {
    const flick = side === 1 ? p.ear : 0;
    g.capsule(x + side * 1.5, y - 1.6, x + side * 4.3, y - 3.1 - flick * 1.1 + (side < 0 ? 0 : 0.2), 1.15, 0.55, m.coat, { bias: side < 0 ? 0 : -1 });
  }
  g.part();
  for (const side of [-1, 1]) g.px(x + side * 3 - 0.5, y - 2.5 - (side === 1 ? p.ear * 0.6 : 0), m.earIn, FLAT);
  if (m.antlers) {
    g.part();
    for (const side of [-1, 1]) {
      g.line(x + side * 0.8, y - 2.2, x + side * 1.6, y - 5.4, ANTLER, () => cyl(side * -0.4, 0.5));
      g.line(x + side * 1.6, y - 5.4, x + side * 1, y - 7, ANTLER, () => cyl(0, 0.5));
      g.line(x + side * 1.2, y - 3.6, x + side * 2.6, y - 4.4, ANTLER, () => cyl(0, 0.6));
    }
  }
  g.part();
  g.ellipse(x, y, 2.1, 2.5, m.coat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.7 - 0.15, 1) });
  g.part();
  g.ellipse(x, y + 2.3, 1.4, 1.3, m.coat, { bias: 1, normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.3, 1) });
  g.part();
  g.px(x - 1, y + 1.6, m.pale, sphere(-0.3, -0.4), { bias: -1 });
  g.px(x, y + 1.6, m.pale, sphere(0.3, -0.4), { bias: -1 });
  g.px(x - 1, y + 2.8, m.dark, sphere(-0.3, 0.2));
  g.px(x, y + 2.8, m.dark, sphere(0.3, 0.2));
  if (p.blink) {
    g.px(x - 1.8, y - 0.3, m.coat, FLAT, { bias: -2 });
    g.px(x + 1, y - 0.3, m.coat, FLAT, { bias: -2 });
  } else {
    g.px(x - 1.8, y - 0.6, D_EYE, FLAT);
    g.px(x - 1.8, y + 0.4, D_EYE, FLAT);
    g.px(x + 1, y - 0.6, D_EYE, FLAT);
    g.px(x + 1, y + 0.4, D_EYE, FLAT);
    g.spark(x - 1.8, y - 0.6, hex('#e8eef8'), 0.5);
    g.spark(x + 1, y - 0.6, hex('#e8eef8'), 0.5);
  }
}

function deer(look: DeerLook, p: DeerPose): PixelCanvas {
  const m = DEER_MATS[look];
  const c = new PixelCanvas(DEER_W, DEER_H);
  c.offset(0, D_DROP);
  const g = new Rig(c, m.k, DEER_OX, DG + 0.5);
  const rumpY = 17 + p.bob + p.pitch / 2;
  const chestY = 17 + p.bob - p.pitch / 2;
  const far = (f: [number, number]): [number, number] => [f[0] + D_FAR_ON, f[1] - D_FAR_UP];

  // The far legs, half hidden behind the body.
  deerLeg(g, m, 12.8, rumpY + 3.8, far(p.fh), true, true);
  deerLeg(g, m, 21.6, chestY + 3.8, far(p.ff), false, true);

  // The tail: brown and tucked down, or flicked up to flash its white underside.
  g.part();
  const tx = 5.6 - p.tail * 1.2;
  const ty = rumpY + 0.6 - p.tail * 6.4;
  g.capsule(6.8, rumpY - 2.6, tx, ty, 1.05, p.tail > 0.5 ? 1.45 : 0.9, p.tail > 0.5 ? m.pale : m.coat);
  if (p.tail > 0.5) g.px(tx + 0.4, ty - 1, m.coat, sphere(0, -0.6), { bias: -1 });

  // Rump, barrel and deep chest, with a pale belly underneath.
  g.part();
  g.capsule(11, rumpY + 0.4, 21, chestY + 0.4, 3.9, 3.8, m.coat);
  g.part();
  g.ellipse(10.4, rumpY, 4.4, 4.2, m.coat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.1, 1) });
  g.part();
  g.ellipse(21.4, chestY + 0.6, 3.8, 4.5, m.coat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.1, 1) });
  g.part();
  g.capsule(13, rumpY + 3.7, 19.5, chestY + 3.9, 0.9, 0.8, m.pale, { bias: -2 });
  // A fawn's dapples, in rows along its back.
  if (m.spots) {
    g.part();
    const spots: [number, number][] = [[8, rumpY - 2], [10.5, rumpY - 3], [13.5, rumpY - 2.8], [16.5, rumpY - 3], [19.5, chestY - 2.8], [9.5, rumpY], [12, rumpY - 0.6], [15, rumpY - 0.8], [18, chestY - 0.6], [14, rumpY + 1.6], [17, chestY + 1.4]];
    for (const [sx, sy] of spots) g.px(sx, sy, m.pale, sphere(0, -0.3), { bias: 1 });
  }

  // The neck, and the head on it.
  const n0x = 22.4;
  const n0y = chestY - 2;
  if (p.head === 'look') {
    const hx = 26.6;
    const hy = chestY - 10 + p.nod;
    g.part();
    g.capsule(n0x, n0y, hx - 0.4, hy + 2.6, 2.9, 2.1, m.coat);
    g.part();
    g.capsule(n0x + 1.4, n0y + 0.6, hx, hy + 3.6, 1.0, 0.8, m.pale, { bias: -1 });
    deerFrontHead(g, m, hx, hy, p);
  } else {
    const [sx, sy, a] = p.head === 'graze' ? [28.6, DG - 4.2 + p.nod, 1.3] : p.head === 'high' ? [27.4 + p.pitch * 0.2, chestY - 10.4 + p.nod, 0.12] : [28.6, chestY - 8.2 + p.nod, 0.45];
    g.part();
    g.capsule(n0x, n0y, sx - 0.8, sy + 0.8, 3.0, 2.2, m.coat);
    // The pale throat patch.
    g.part();
    const thx = p.head === 'graze' ? sx - 2.6 : sx - 0.4;
    const thy = p.head === 'graze' ? sy - 1.2 : sy + 2.8;
    g.px(thx, thy, m.pale, sphere(0.3, 0.2), { bias: -1 });
    deerSideHead(g, m, sx, sy, a, p);
  }

  // The near haunch and shoulder, standing out over the body.
  g.part();
  g.ellipse(11.6, rumpY + 1.8, 3.1, 3.5, m.coat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9, 1) });
  g.part();
  g.ellipse(21, chestY + 1.8, 2.5, 3.2, m.coat, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9, 1) });

  // The near legs.
  deerLeg(g, m, 12.2, rumpY + 4, p.nh, true, false);
  deerLeg(g, m, 21.2, chestY + 4, p.nf, false, false);
  return c;
}

function deerWalk(f: number, n: number): DeerPose {
  const ph = f / n;
  return {
    ...D_REST,
    // One foot at a time: near hind, near fore, far hind, far fore.
    nh: stride(12, DG, ph, 4.6, 1.8, 0.6),
    nf: stride(21.5, DG, ph - 0.25, 4.6, 2, 0.6),
    fh: stride(12, DG, ph - 0.5, 4.6, 1.8, 0.6),
    ff: stride(21.5, DG, ph - 0.75, 4.6, 2, 0.6),
    bob: Math.cos(ph * Math.PI * 4) > 0.3 ? -0.5 : 0,
    nod: Math.sin(ph * Math.PI * 4) > 0 ? 0.5 : 0,
    tail: f === 3 ? 0.25 : 0,
  };
}

/** The bound, frame by frame: gathered, pushing off, flying with the white tail up, landing. */
const BOUND: Partial<DeerPose>[] = [
  { nh: [16.5, DG], fh: [16, DG], nf: [18.5, DG - 1], ff: [19, DG - 1.5], bob: -0.5, pitch: 0, nod: 0.5 },
  { nh: [9.5, DG], fh: [10, DG - 1], nf: [26, DG - 4], ff: [25.5, DG - 3], bob: -1.5, pitch: 1.5, nod: 0 },
  { nh: [7, DG - 3], fh: [7.5, DG - 2.5], nf: [28, DG - 2.5], ff: [27.5, DG - 2], bob: -3, pitch: 0, nod: 0 },
  { nh: [11, DG - 4], fh: [11.5, DG - 3], nf: [25, DG], ff: [24.5, DG - 1], bob: -1.5, pitch: -1, nod: 0.5 },
  { nh: [15, DG - 2.5], fh: [14.5, DG - 1.5], nf: [20, DG], ff: [20, DG], bob: -0.5, pitch: -1, nod: 1 },
  { nh: [17, DG], fh: [16.5, DG - 1], nf: [18, DG - 2], ff: [18.5, DG - 1.5], bob: 0, pitch: -0.5, nod: 0.5 },
];

/**
 * A deer's animations: idle (breathing, an ear flicking, a blink), look
 * (turned to watch the viewer), walk, bound (fleeing in great leaps, the white
 * tail up), graze (head down, nibbling) and alert (head high, a fore hoof
 * stamped, the tail half up).
 */
export const DEER_ANIMS: { name: string; frames: number; fps: number; pose: (f: number) => DeerPose }[] = [
  { name: 'idle', frames: 6, fps: 4, pose: (f) => ({ ...D_REST, bob: f === 2 || f === 3 ? -0.5 : 0, ear: f === 3 ? 1 : 0, blink: f === 4, tail: f === 5 ? 0.3 : 0 }) },
  { name: 'look', frames: 4, fps: 3, pose: (f) => ({ ...D_REST, head: 'look', bob: f === 1 ? -0.5 : 0, ear: f === 2 ? 1 : 0, blink: f === 3 }) },
  { name: 'walk', frames: 8, fps: 8, pose: (f) => deerWalk(f, 8) },
  { name: 'bound', frames: 6, fps: 12, pose: (f) => ({ ...D_REST, ...BOUND[f], head: 'high', ear: 1, tail: 1 }) },
  { name: 'graze', frames: 4, fps: 3, pose: (f) => ({ ...D_REST, head: 'graze', nf: [22.5, DG], ff: [23, DG], nod: f % 2 ? 0.6 : 0, ear: f === 2 ? 1 : 0, tail: f === 3 ? 0.3 : 0 }) },
  { name: 'alert', frames: 4, fps: 6, pose: (f) => ({ ...D_REST, head: 'high', bob: -0.5, nf: f === 1 ? [22.5, DG - 2.5] : [21.5, DG], tail: 0.6 }) },
];

/** Every frame of every deer, as `<look>_<anim><f>`. */
export function deerFrames(): { name: string; canvas: PixelCanvas }[] {
  const out: { name: string; canvas: PixelCanvas }[] = [];
  for (const look of DEER_LOOKS) for (const a of DEER_ANIMS) for (let f = 0; f < a.frames; f++) out.push({ name: `${look}_${a.name}${f}`, canvas: deer(look, a.pose(f)) });
  return out;
}

// ================================================================ fox

export const FOX_W = 36;
export const FOX_H = 22;
export const FOX_OX = 18;
export const FOX_OY = 20;
const FG = 19;
/** The whole fox is drawn this far right in its frame, to leave its brush room. */
const FOX_SHIFT = 2;

const FOX: Material = { ramp: ramp('#3e1606', '#64260a', '#8c3a10', '#b25018', '#d06a22', '#e88a34', '#f8aa54'), outline: hex('#1c0802'), outlineLit: hex('#34120a') };
const FOX_WHITE: Material = { ramp: ramp('#887a6e', '#b8ac9e', '#dcd4c8', '#f2ece2', '#ffffff'), outline: hex('#30261e') };
const FOX_BLACK: Material = { ramp: ramp('#0c0807', '#1e1410', '#30221c', '#46342a'), outline: hex('#050303') };
/** Amber eyes that catch the light at night. */
const FOX_EYE: Material = { ramp: ramp('#7a4a08', '#c88414', '#f0b830'), outline: hex('#1a0e02'), noAO: true, emissive: 0.35 };

type FoxHead = 'up' | 'sniff' | 'alert' | 'look';

interface FoxPose {
  bob: number;
  pitch: number;
  nh: [number, number];
  nf: [number, number];
  fh: [number, number];
  ff: [number, number];
  head: FoxHead;
  nod: number;
  ear: number;
  /** The brush: -1 low and swept down, 0 held level, 1 streaming straight out behind. */
  brush: number;
  /** Its tip curling a little this way (px). */
  flick: number;
  blink: boolean;
  /** Sitting: haunches down, the brush wrapped round its feet. */
  sit: boolean;
}

const F_REST: FoxPose = { bob: 0, pitch: 0, nh: [12, FG], nf: [20, FG], fh: [12, FG], ff: [20, FG], head: 'up', nod: 0, ear: 0, brush: 0, flick: 0, blink: false, sit: false };

function foxLeg(g: Rig, ax: number, ay: number, foot: [number, number], hind: boolean, far: boolean): void {
  const [jx, jy, fx, fy] = joint(ax, ay, foot[0], foot[1] - 0.5, hind ? 2.6 : 2.4, hind ? 2.8 : 2.8, hind ? 1 : -1);
  const o = { bias: far ? -1 : 0 };
  g.part();
  g.capsule(ax, ay, jx, jy, hind ? 1.1 : 0.9, 0.7, FOX, o);
  // Black stockings to the paws.
  g.part();
  g.capsule(jx, jy, fx, fy, 0.65, 0.6, FOX_BLACK, o);
}

/** The brush from its root at (x, y): thick, and white at the tip. */
function brush(g: Rig, x: number, y: number, lift: number, flick: number, wrap: boolean): void {
  g.part();
  if (wrap) {
    // Curled forward round the paws.
    g.capsule(x, y, x + 3, y + 3.2, 1.4, 2, FOX);
    g.capsule(x + 3, y + 3.2, x + 8.6, y + 3.6 + flick * 0.3, 2, 1.7, FOX);
    g.part();
    g.ellipse(x + 9.6, y + 3.4 + flick * 0.3, 1.6, 1.3, FOX_WHITE);
    return;
  }
  const mx = x - 4.2;
  const my = y + 1.6 - lift * 1.6;
  const tx = x - 8.2;
  const ty = y + 3.4 - lift * 3.6 + flick;
  g.capsule(x, y, mx, my, 1.3, 2.3, FOX);
  g.capsule(mx, my, tx + 0.8, ty, 2.3, 1.9, FOX);
  g.part();
  g.ellipse(tx, ty + 0.2, 1.7, 1.5, FOX_WHITE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.1, 1) });
}

/** The head side-on, its skull at (x, y), turned by `a`. */
function foxSideHead(g: Rig, x: number, y: number, a: number, p: FoxPose): void {
  const P = (u: number, v: number) => turn(x, y, a, u, v);
  // The far ear, then the skull, the long snout and white cheek, the near ear.
  g.part();
  g.capsule(...P(0.9, -1.4), ...P(1.3 - p.ear * 0.8, -4.6 + p.ear * 1.4), 1.1, 0.4, FOX, { bias: -1 });
  g.px(...P(1.3 - p.ear * 0.8, -4.6 + p.ear * 1.4), FOX_BLACK, FLAT, { bias: -1 });
  g.part();
  g.ellipse(x, y, 2.3, 2.0, FOX, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.85 - 0.1, 1) });
  g.capsule(...P(0.8, 0.4), ...P(4.6, 1.2), 1.35, 0.55, FOX);
  g.part();
  g.ellipse(...P(1.4, 1.4), 1.7, 0.95, FOX_WHITE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.7 - 0.3, 1) });
  g.capsule(...P(2.6, 1.6), ...P(4.2, 1.6), 0.6, 0.5, FOX_WHITE, { bias: -1 });
  g.px(...P(5, 1.0), FOX_BLACK, sphere(0.5, 0.2));
  g.part();
  const [ex, ey] = P(1.3, -0.4);
  if (p.blink) g.px(ex, ey, FOX, FLAT, { bias: -2 });
  else {
    g.px(ex, ey, FOX_EYE, FLAT);
    g.px(ex + 1, ey, FOX_BLACK, FLAT);
  }
  g.part();
  const [tx, ty] = P(-0.7 - p.ear * 1, -4.8 + p.ear * 1.6);
  g.capsule(...P(-0.4, -1.4), tx, ty, 1.25, 0.45, FOX);
  g.px(tx, ty, FOX_BLACK, sphere(0, -0.6));
  g.px(...P(-0.4, -2.6), FOX_WHITE, FLAT, { bias: -1 });
}

/** The face turned to the viewer: a sharp mask, white cheeks, both tall ears. */
function foxFrontHead(g: Rig, x: number, y: number, p: FoxPose): void {
  g.part();
  for (const side of [-1, 1]) {
    const flick = side === 1 ? p.ear : 0;
    g.capsule(x + side * 1.3, y - 1.4, x + side * (2.4 + flick * 0.8), y - 4.6 + flick, 1.2, 0.45, FOX, { bias: side < 0 ? 0 : -1 });
    g.px(x + side * (2.4 + flick * 0.8), y - 4.6 + flick, FOX_BLACK, FLAT);
    g.px(x + side * 1.6 - 0.5, y - 2.4, FOX_WHITE, FLAT, { bias: -1 });
  }
  g.part();
  g.ellipse(x, y, 2.5, 2.1, FOX, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.75 - 0.1, 1) });
  g.part();
  for (const side of [-1, 1]) g.ellipse(x + side * 1.5, y + 1.1, 1.2, 0.9, FOX_WHITE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6 - 0.3, 1) });
  g.part();
  g.ellipse(x, y + 1.8, 0.9, 1.4, FOX_WHITE, { bias: -1 });
  g.px(x - 0.5, y + 2.8, FOX_BLACK, sphere(0, 0.2));
  if (!p.blink) {
    g.px(x - 1.4, y - 0.3, FOX_EYE, FLAT);
    g.px(x + 0.9, y - 0.3, FOX_EYE, FLAT);
  } else {
    g.px(x - 1.4, y - 0.3, FOX, FLAT, { bias: -2 });
    g.px(x + 0.9, y - 0.3, FOX, FLAT, { bias: -2 });
  }
}

function fox(p: FoxPose): PixelCanvas {
  const c = new PixelCanvas(FOX_W, FOX_H);
  c.offset(FOX_SHIFT, 0);
  const g = new Rig(c);
  if (p.sit) return foxSitting(g, p);
  const rumpY = 12.4 + p.bob + p.pitch / 2;
  const chestY = 12.2 + p.bob - p.pitch / 2;
  const far = (f: [number, number]): [number, number] => [f[0] + 0.8, f[1] - 0.8];

  foxLeg(g, 12.4, rumpY + 2, far(p.fh), true, true);
  foxLeg(g, 20.4, chestY + 2.2, far(p.ff), false, true);
  brush(g, 8.6, rumpY - 1.2, p.brush, p.flick, false);

  // A long, low body; a white bib at the throat.
  g.part();
  g.capsule(10.6, rumpY + 0.3, 19.6, chestY + 0.3, 2.6, 2.7, FOX);
  g.part();
  g.ellipse(10.6, rumpY, 3, 2.9, FOX, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.1, 1) });
  g.part();
  g.ellipse(20, chestY + 0.5, 2.9, 3.1, FOX, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.1, 1) });
  g.part();
  g.ellipse(21.6, chestY + 1.4, 1.3, 2, FOX_WHITE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.8, 1) });

  const n0x = 21;
  const n0y = chestY - 1.2;
  if (p.head === 'look') {
    const hx = 24.4;
    const hy = chestY - 4.6 + p.nod;
    g.part();
    g.capsule(n0x, n0y, hx - 0.4, hy + 1.6, 2.2, 1.8, FOX);
    foxFrontHead(g, hx, hy, p);
  } else {
    const [sx, sy, a] = p.head === 'sniff' ? [25.4, FG - 3.3 + p.nod, 0.95] : p.head === 'alert' ? [24.4, chestY - 6 + p.nod, -0.05] : [24.6, chestY - 4 + p.nod, 0.18];
    g.part();
    g.capsule(n0x, n0y, sx - 0.6, sy + 0.4, 2.2, 1.8, FOX);
    foxSideHead(g, sx, sy, a, p);
  }

  g.part();
  g.ellipse(11.4, rumpY + 1.2, 2.3, 2.5, FOX, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9, 1) });
  g.part();
  g.ellipse(19.8, chestY + 1.3, 1.8, 2.3, FOX, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9, 1) });
  foxLeg(g, 11.8, rumpY + 2.4, p.nh, true, false);
  foxLeg(g, 19.8, chestY + 2.4, p.nf, false, false);
  return c;
}

/** Sat up on its haunches, forelegs straight, the brush curled round its paws. */
function foxSitting(g: Rig, p: FoxPose): PixelCanvas {
  const breathe = p.bob;
  // The far foreleg.
  g.part();
  g.capsule(19.8, 12 + breathe, 20.6, FG - 0.8, 0.9, 0.65, FOX, { bias: -1 });
  g.capsule(20.4, 15.6, 20.6, FG - 0.6, 0.6, 0.6, FOX_BLACK, { bias: -1 });
  // Haunch on the ground, back sloping up to the shoulders.
  g.part();
  g.capsule(12.6, FG - 3.2, 18.8, 10.6 + breathe, 3, 2.6, FOX);
  g.part();
  g.ellipse(12.6, FG - 3, 3.6, 3, FOX, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.1, 1) });
  g.part();
  g.ellipse(19.2, 11.6 + breathe, 2.6, 3, FOX, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.1, 1) });
  g.part();
  g.ellipse(20.6, 12.6 + breathe, 1.3, 2.2, FOX_WHITE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.8, 1) });
  // Its hind paw tucked forward under the haunch.
  g.part();
  g.capsule(13.6, FG - 1, 16, FG - 0.6, 0.8, 0.7, FOX_BLACK);
  brush(g, 9.4, FG - 3.8, 0, p.flick, true);
  const n0y = 9.8 + breathe;
  if (p.head === 'look') {
    g.part();
    g.capsule(20, n0y, 21.4, 7 + breathe, 2.2, 1.9, FOX);
    foxFrontHead(g, 21.6, 5.6 + breathe + p.nod, p);
  } else {
    g.part();
    g.capsule(20, n0y, 21.6, 6.6 + breathe, 2.2, 1.9, FOX);
    foxSideHead(g, 22.2, 6 + breathe + p.nod, 0.12, p);
  }
  // The near foreleg, straight.
  g.part();
  g.capsule(19.4, 12.4 + breathe, 19.8, FG - 0.6, 1, 0.7, FOX);
  g.capsule(19.6, 15.8, 19.8, FG - 0.4, 0.62, 0.6, FOX_BLACK);
  return g.c;
}

function foxTrot(f: number, n: number): FoxPose {
  const ph = f / n;
  return {
    ...F_REST,
    nh: stride(12, FG, ph, 5, 1.8, 0.45),
    ff: stride(20, FG, ph, 5, 1.8, 0.45),
    fh: stride(12, FG, ph - 0.5, 5, 1.8, 0.45),
    nf: stride(20, FG, ph - 0.5, 5, 1.8, 0.45),
    bob: [0, -0.5, -0.5, 0, -0.5, -0.5][f % 6],
    nod: [0.4, 0, 0, 0.4, 0, 0][f % 6],
    brush: 0.2,
    flick: [0, 0.4, 0.8, 0.4, 0, -0.4][f % 6],
  };
}

function foxWalk(f: number, n: number): FoxPose {
  const ph = f / n;
  return {
    ...F_REST,
    nh: stride(12, FG, ph, 3.6, 1.2, 0.6),
    nf: stride(20, FG, ph - 0.25, 3.6, 1.4, 0.6),
    fh: stride(12, FG, ph - 0.5, 3.6, 1.2, 0.6),
    ff: stride(20, FG, ph - 0.75, 3.6, 1.4, 0.6),
    bob: Math.cos(ph * Math.PI * 4) > 0.3 ? -0.5 : 0,
    head: 'up',
    nod: 0.6,
    brush: -0.3,
    flick: Math.sin(ph * Math.PI * 2) * 0.6,
  };
}

/** The dash: a low, stretched gallop, the brush streaming out behind. */
const DASH: Partial<FoxPose>[] = [
  { nh: [15.5, FG], fh: [15, FG], nf: [17, FG - 1], ff: [17.5, FG - 1.5], bob: 0, pitch: 0.5 },
  { nh: [9, FG], fh: [9.5, FG - 1], nf: [24.5, FG - 2.5], ff: [24, FG - 2], bob: -1, pitch: 1 },
  { nh: [7, FG - 2], fh: [7.5, FG - 1.5], nf: [26, FG - 1], ff: [25.5, FG - 1], bob: -1.5, pitch: 0 },
  { nh: [10, FG - 2.5], fh: [10.5, FG - 2], nf: [23, FG], ff: [22.5, FG - 0.5], bob: -1, pitch: -0.5 },
  { nh: [13.5, FG - 1.5], fh: [13, FG - 1], nf: [19, FG], ff: [19, FG], bob: -0.5, pitch: -0.8 },
  { nh: [16, FG], fh: [15.5, FG - 0.5], nf: [17.5, FG - 1.5], ff: [18, FG - 1], bob: 0, pitch: 0 },
];

/**
 * A fox's animations: trot (its everyday going, light and diagonal), walk
 * (stalking slow, head low), dash (fleeing flat out), sit (watching, an ear
 * twitching, its brush tip curling), sniff (nose down to a scent), alert
 * (frozen, ears pricked) and look (turned to stare at the viewer).
 */
export const FOX_ANIMS: { name: string; frames: number; fps: number; pose: (f: number) => FoxPose }[] = [
  { name: 'trot', frames: 6, fps: 11, pose: (f) => foxTrot(f, 6) },
  { name: 'walk', frames: 8, fps: 8, pose: (f) => foxWalk(f, 8) },
  { name: 'dash', frames: 6, fps: 15, pose: (f) => ({ ...F_REST, ...DASH[f], head: 'alert', ear: 1, brush: 1, flick: f % 2 ? -0.5 : 0.5 }) },
  { name: 'sit', frames: 6, fps: 3, pose: (f) => ({ ...F_REST, sit: true, bob: f === 2 || f === 3 ? -0.4 : 0, ear: f === 4 ? 1 : 0, blink: f === 1, flick: f === 5 ? 1 : 0 }) },
  { name: 'sitlook', frames: 4, fps: 3, pose: (f) => ({ ...F_REST, sit: true, head: 'look', bob: f === 2 ? -0.4 : 0, ear: f === 1 ? 1 : 0, blink: f === 3 }) },
  { name: 'sniff', frames: 4, fps: 5, pose: (f) => ({ ...F_REST, head: 'sniff', nf: [21, FG], ff: [21.5, FG], nod: f % 2 ? 0.6 : 0, brush: -0.2, flick: f === 2 ? 0.6 : 0, ear: f === 3 ? 0.5 : 0 }) },
  { name: 'alert', frames: 2, fps: 3, pose: (f) => ({ ...F_REST, head: 'alert', brush: 0.5, bob: -0.3, ear: 0, flick: f ? 0.4 : 0 }) },
  { name: 'look', frames: 4, fps: 3, pose: (f) => ({ ...F_REST, head: 'look', brush: 0.1, ear: f === 2 ? 1 : 0, blink: f === 3, flick: f === 1 ? 0.5 : 0 }) },
];

/** Every frame of the fox, as `<anim><f>`. */
export function foxFrames(): { name: string; canvas: PixelCanvas }[] {
  const out: { name: string; canvas: PixelCanvas }[] = [];
  for (const a of FOX_ANIMS) for (let f = 0; f < a.frames; f++) out.push({ name: `${a.name}${f}`, canvas: fox(a.pose(f)) });
  return out;
}

// ================================================================ songbirds

export const BIRD_W = 14;
export const BIRD_H = 12;
export const BIRD_OX = 7;
export const BIRD_OY = 11;
const BG = 11;

export type BirdLook = 'robin' | 'tit' | 'finch';
export const BIRD_LOOKS: BirdLook[] = ['robin', 'tit', 'finch'];

interface BirdMats {
  back: Material;
  wing: Material;
  breast: Material;
  /** The crown, and the face round the eye. */
  cap: Material;
  face: Material;
  /** A bright bar across the folded wing (the goldfinch's gold). */
  bar: Material | null;
}

const B_WHITE: Material = { ramp: ramp('#8a8a90', '#c4c4c8', '#ececee', '#ffffff'), outline: hex('#2a2a30') };
const B_BEAK: Material = { ramp: ramp('#1e1a16', '#3a322a', '#5e5244'), outline: hex('#0a0806'), noAO: true };
const B_EYE: Material = { ramp: ramp('#050508', '#121218'), outline: hex('#020203'), noAO: true };
const B_LEG: Material = { ramp: ramp('#2e2420', '#4a3c34', '#6a5a4c'), outline: hex('#120e0c'), noOutline: true, noAO: true };

const BIRD_MATS: Record<BirdLook, BirdMats> = {
  robin: {
    back: { ramp: ramp('#2c2216', '#463624', '#624c32', '#7e6444', '#9a7c58'), outline: hex('#140f0a') },
    wing: { ramp: ramp('#241a10', '#3a2c1c', '#544028', '#6e5638'), outline: hex('#100b06') },
    breast: { ramp: ramp('#6a1e06', '#a8380e', '#dc5a1c', '#f4823a', '#ffae6a'), outline: hex('#2a0a02') },
    cap: { ramp: ramp('#2c2216', '#463624', '#624c32', '#7e6444'), outline: hex('#140f0a') },
    face: { ramp: ramp('#6a1e06', '#a8380e', '#dc5a1c', '#f4823a'), outline: hex('#2a0a02') },
    bar: null,
  },
  tit: {
    back: { ramp: ramp('#26381a', '#3a5226', '#526e32', '#6c8a40', '#88a64e'), outline: hex('#101a0a') },
    wing: { ramp: ramp('#10264e', '#1a3c74', '#2a5aa0', '#4a80cc'), outline: hex('#060e20') },
    breast: { ramp: ramp('#6a5a08', '#a88e10', '#d8bc22', '#f4dc48', '#fff294'), outline: hex('#2a2204') },
    cap: { ramp: ramp('#0e2a5e', '#1a4692', '#2e6ac8', '#5a96ec'), outline: hex('#060e22') },
    face: B_WHITE,
    bar: B_WHITE,
  },
  finch: {
    back: { ramp: ramp('#3a2a18', '#5a4228', '#7c5e3c', '#9c7c54', '#b8986c'), outline: hex('#18100a') },
    wing: { ramp: ramp('#0c0a0a', '#1c1818', '#2e2a28', '#423c38'), outline: hex('#040303') },
    breast: { ramp: ramp('#6a5e50', '#9a8c7a', '#c4b8a6', '#e6dece', '#f8f4ea'), outline: hex('#2a241e') },
    cap: { ramp: ramp('#0c0a0a', '#1c1818', '#2e2a28'), outline: hex('#040303') },
    face: { ramp: ramp('#5a0808', '#981410', '#d02a1c', '#f4503a'), outline: hex('#220404') },
    bar: { ramp: ramp('#7a6206', '#c49a0c', '#f0c820', '#fff070'), outline: hex('#2a2004'), noOutline: true },
  },
};

interface BirdPose {
  /** Body lift (negative is up). */
  lift: number;
  /** 'peck' bows the head to the ground; 'tilt' cocks it to listen. */
  head: 'up' | 'tilt' | 'peck';
  /** Flying: the wings' beat, -1 high .. 1 low; null on the ground. */
  beat: number | null;
  /** Feet tucked up (a hop's top, or flying). */
  tuck: boolean;
  /** Tail flick (px up). */
  tail: number;
}

function bird(look: BirdLook, p: BirdPose): PixelCanvas {
  const m = BIRD_MATS[look];
  const c = new PixelCanvas(BIRD_W, BIRD_H);
  const g = new Rig(c);
  const flying = p.beat !== null;
  const by = 7.6 + p.lift;
  const bx = 6.4;
  // The far wing, beating behind the body.
  if (flying) wingBeat(g, m, bx + 0.6, by - 0.4, p.beat!, true);
  // The tail, cocked up behind.
  g.part();
  const tailUp = flying ? 0.4 : 1.2 + p.tail;
  g.capsule(bx - 2, by - 0.2, bx - 4.6, by - tailUp, 0.9, flying ? 1.1 : 0.7, m.wing, { bias: -1 });
  // Legs, under it.
  if (!flying) {
    g.part();
    const top = by + 1.6;
    const foot = p.tuck ? top + 0.8 : BG - 0.5;
    g.line(bx - 0.3, top, bx - 0.5, foot, B_LEG);
    g.line(bx + 0.8, top, bx + 0.9, foot, B_LEG);
  }
  // A round body, the breast puffed out in front.
  g.part();
  g.ellipse(bx, by, flying ? 3 : 2.7, flying ? 1.6 : 2.1, m.back, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.1, 1) });
  g.part();
  g.ellipse(bx + 1.1, by + 0.6, 1.9, 1.6, m.breast, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + 0.2, dy * 0.8, 1) });
  if (look === 'robin' || look === 'finch') {
    g.part();
    g.ellipse(bx - 0.2, by + 1.2, 1.4, 0.8, look === 'robin' ? B_WHITE : m.breast, { bias: -1 });
  }
  // The folded wing over the side.
  if (!flying) {
    g.part();
    g.ellipse(bx - 0.9, by - 0.2, 2, 1.25, m.wing, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.7 - 0.2, 1) });
    if (m.bar) {
      g.px(bx - 0.6, by, m.bar, FLAT, { bias: 1 });
      g.px(bx + 0.4, by - 0.2, m.bar, FLAT, { bias: 0 });
    }
  }
  // The head: up and alert, cocked, or bowed to peck.
  const [hx, hy] = p.head === 'peck' ? [bx + 3, BG - 2.2] : p.head === 'tilt' ? [bx + 2.2, by - 2.5] : [bx + 2.5, by - 2.4];
  g.part();
  g.ellipse(hx, hy, 1.7, 1.6, m.cap, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.85 - 0.1, 1) });
  g.part();
  g.ellipse(hx + 0.4, hy + 0.6, 1.1, 0.9, m.face, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.7, 1) });
  if (look === 'tit') g.px(hx + 0.2, hy - 0.3, B_EYE, FLAT, { bias: 1 });
  g.part();
  const eyeY = p.head === 'tilt' ? hy - 0.6 : hy - 0.3;
  g.px(hx + 0.6, eyeY, B_EYE, FLAT);
  g.spark(hx + 0.6, eyeY, hex('#ffffff'), 0.35);
  const beakX = hx + 1.8;
  const beakY = p.head === 'peck' ? hy + 1 : hy + 0.2;
  g.px(beakX, beakY, B_BEAK, sphere(0.4, 0.2));
  if (p.head === 'peck') g.px(beakX, beakY + 1, B_BEAK, sphere(0.4, -0.2));
  else g.px(beakX + 0.8, beakY + 0.4, B_BEAK, sphere(0.4, -0.2));
  // The near wing, beating.
  if (flying) wingBeat(g, m, bx - 0.2, by, p.beat!, false);
  return c;
}

/** A wing in flight from its shoulder at (x, y), `beat` -1 raised high .. 1 swept low; feathers fanned at the tip. */
function wingBeat(g: Rig, m: BirdMats, x: number, y: number, beat: number, far: boolean): void {
  const o = { bias: far ? -2 : 0 };
  const tx = x - 1.6 + Math.abs(beat) * 0.6;
  const ty = y + beat * 4.2;
  g.part();
  g.capsule(x, y, tx, ty, 1.3, 1.1, m.wing, o);
  if (m.bar && !far) g.px((x + tx) / 2, (y + ty) / 2, m.bar, FLAT, o);
  // Primaries fanned at the tip.
  g.line(tx, ty, tx - 1.6, ty + beat * 0.6 - 0.4, m.wing, () => FLAT, o);
}

/**
 * A songbird's animations: idle (perky, the head cocked to listen), peck
 * (bowing to the ground), hop, and fly (wings beating, legs tucked).
 */
export const BIRD_ANIMS: { name: string; frames: number; fps: number; pose: (f: number) => BirdPose }[] = [
  { name: 'idle', frames: 4, fps: 3, pose: (f) => ({ lift: 0, head: f === 1 || f === 2 ? 'tilt' : 'up', beat: null, tuck: false, tail: f === 3 ? 0.8 : 0 }) },
  { name: 'peck', frames: 3, fps: 7, pose: (f) => ({ lift: f === 1 ? 0.3 : 0, head: f === 1 ? 'peck' : 'up', beat: null, tuck: false, tail: f === 1 ? 0.6 : 0 }) },
  { name: 'hop', frames: 2, fps: 8, pose: (f) => ({ lift: f ? -2 : 0, head: 'up', beat: null, tuck: f === 1, tail: f ? 0.5 : 0 }) },
  { name: 'fly', frames: 4, fps: 16, pose: (f) => ({ lift: [-1.5, -1.2, -0.8, -1.2][f], head: 'up', beat: [-1, -0.2, 1, 0.3][f], tuck: true, tail: 0 }) },
];

export function birdFrames(): { name: string; canvas: PixelCanvas }[] {
  const out: { name: string; canvas: PixelCanvas }[] = [];
  for (const look of BIRD_LOOKS) for (const a of BIRD_ANIMS) for (let f = 0; f < a.frames; f++) out.push({ name: `${look}_${a.name}${f}`, canvas: bird(look, a.pose(f)) });
  return out;
}

// ================================================================ the owl

export const OWL_W = 22;
export const OWL_H = 22;
export const OWL_OX = 11;
/** Where it stands: on its branch (and, flying, the point it is lifted from). */
export const OWL_OY = 20;

const OWL: Material = { ramp: ramp('#22160c', '#3a2816', '#563c22', '#745230', '#926a40', '#ae8656', '#c8a270'), outline: hex('#100a04'), outlineLit: hex('#22160c') };
const OWL_DISC: Material = { ramp: ramp('#5a4632', '#86684a', '#ac8e68', '#ccb08a', '#e4ceaa'), outline: hex('#2a1e12') };
const OWL_RIM: Material = { ramp: ramp('#1a1008', '#2e1e10', '#44301c'), outline: hex('#0a0604'), noOutline: true };
const OWL_BREAST: Material = { ramp: ramp('#6a5038', '#927052', '#b8946e', '#d4b48c', '#ead2ac'), outline: hex('#2a1e12') };
/** Its eyes: deep orange, glowing faintly so they catch any light at night. */
const OWL_EYE: Material = { ramp: ramp('#a04a04', '#e08010', '#ffb428', '#ffe070'), outline: hex('#2a1202'), emissive: 0.9, noAO: true };
const OWL_PUPIL: Material = { ramp: ramp('#020202', '#0c0a08'), outline: hex('#000000'), noAO: true, emissive: 0.15 };
const OWL_BEAK: Material = { ramp: ramp('#4a4234', '#7a705a', '#a89c80'), outline: hex('#1a160e'), noAO: true };
const BRANCH: Material = { ramp: ramp('#1a120a', '#2e2014', '#46321e', '#5e4428', '#765834'), outline: hex('#0a0704'), outlineLit: hex('#1a120a') };
const LICHEN: Material = { ramp: ramp('#3e5a3a', '#5a7a4e', '#7e9a64'), outline: hex('#16200e'), noOutline: true };

interface OwlPose {
  /** The face turned: -1 to the left, 0 straight at the viewer, 1 to the right. */
  turn: number;
  blink: boolean;
  /** 0..1, the throat swelling white for a hoot; and the head bobbing with it. */
  puff: number;
  bob: number;
  /** Flying: the wings' beat, -1 high .. 1 low; null perched. */
  beat: number | null;
}

/** One great round eye at (x, y): a ring of orange round a black pupil; or shut. */
function owlEye(g: Rig, x: number, y: number, shut: boolean, look: number): void {
  if (shut) {
    g.line(x - 1, y, x + 1, y, OWL_RIM, () => FLAT);
    return;
  }
  g.ellipse(x, y, 1.45, 1.45, OWL_EYE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.5, dy * 0.5, 1) });
  g.px(x + look * 0.6 - 0.5, y - 0.5, OWL_PUPIL, FLAT);
  g.px(x + look * 0.6 - 0.5, y + 0.5, OWL_PUPIL, FLAT);
  g.spark(x - 1, y - 1, hex('#fff4d0'), 0.6);
}

function owl(p: OwlPose): PixelCanvas {
  const c = new PixelCanvas(OWL_W, OWL_H);
  const g = new Rig(c);
  const cx = 11;
  if (p.beat !== null) return owlFlying(g, p.beat);
  // Its branch, running out of the frame both ways, a twig and lichen on it.
  g.part();
  g.capsule(-1, 19.8, 23, 18.6, 1.5, 1.2, BRANCH);
  g.part();
  g.line(17, 18.4, 20, 15.6, BRANCH, () => cyl(0.2, 0.4));
  g.px(5, 18.4, LICHEN, FLAT, { bias: 1 });
  g.px(6, 18.3, LICHEN, FLAT);
  g.px(14, 18, LICHEN, FLAT, { bias: 1 });
  // The body: a soft barrel of feathers, folded wings at its sides, streaked breast.
  const b = p.bob;
  g.part();
  g.ellipse(cx, 13 + b * 0.5, 4.8, 5.4, OWL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.1, 1) });
  g.part();
  g.ellipse(cx, 14 + b * 0.5, 3.1, 3.9, OWL_BREAST, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8, 1) });
  // Dark streaks down the breast.
  for (const [sx, sy] of [[cx - 1.5, 12.4], [cx + 1, 12.8], [cx - 0.5, 14.6], [cx + 1.8, 15], [cx - 1.8, 15.8], [cx + 0.2, 16.6]] as const) g.px(sx, sy + b * 0.5, OWL, FLAT, { bias: -1 });
  // A white throat, puffing out for a hoot.
  if (p.puff > 0) {
    g.part();
    g.ellipse(cx, 10.4 + b, 1.6 + p.puff * 0.8, 0.9 + p.puff * 0.8, OWL_DISC, { bias: 1, normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.7, 1) });
  }
  g.part();
  for (const side of [-1, 1]) {
    g.ellipse(cx + side * 3.9, 13.4 + b * 0.5, 1.8, 4.3, OWL, { bias: -1, normal: (_x, _y, dx, dy) => sphere(dx * 0.6 + side * 0.4, dy * 0.8, 1) });
    // Pale spots on the wing coverts.
    g.px(cx + side * 3.9 - 0.5, 11.8 + b * 0.5, OWL_DISC, FLAT, { bias: 0 });
    g.px(cx + side * 3.6 - 0.5, 14.2 + b * 0.5, OWL_DISC, FLAT, { bias: -1 });
  }
  // Talons gripping the branch.
  g.part();
  for (const side of [-1, 1]) {
    g.px(cx + side * 1.6 - 0.5, 18, OWL_BEAK, FLAT, { bias: 1 });
    g.px(cx + side * 1.6 + (side > 0 ? 0.5 : -1.5), 18.2, OWL_BEAK, FLAT);
  }
  // The head: a broad round crown, the ear tufts, the facial disc turned to `turn`.
  const hx = cx + p.turn * 0.8;
  const hy = 6.6 + Math.round(b);
  g.part();
  g.ellipse(cx + p.turn * 0.3, hy, 4.6, 3.9, OWL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.15, 1) });
  g.part();
  for (const side of [-1, 1]) g.capsule(cx + side * 2.6 + p.turn * 0.4, hy - 2.6, cx + side * 3.6 + p.turn * 0.6, hy - 5.4, 1, 0.45, OWL, { bias: side * p.turn > 0 ? 0 : -1 });
  g.part();
  for (const side of [-1, 1]) {
    // Each half of the disc, the far one squeezed as the head turns.
    const squeeze = 1 - Math.max(0, -side * p.turn) * 0.45;
    g.ellipse(hx + side * 1.85 * squeeze, hy + 0.4, 2.2 * squeeze, 2.4, OWL_DISC, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6, 1) });
  }
  // The dark rim round the disc, and the brow between the eyes.
  g.part();
  g.line(hx - 0.5, hy - 2, hx - 0.5, hy + 1, OWL, () => FLAT, { bias: 1 });
  for (const side of [-1, 1]) {
    const squeeze = 1 - Math.max(0, -side * p.turn) * 0.45;
    if (squeeze > 0.7) owlEye(g, hx + side * 1.9 * squeeze - (side < 0 ? 0 : 0), hy + 0.1, p.blink, p.turn);
    else g.px(hx + side * 1.9 * squeeze, hy + 0.1, OWL_EYE, FLAT, { glow: p.blink ? 0 : 0.6 });
  }
  g.part();
  g.px(hx - 0.5, hy + 1.6, OWL_BEAK, sphere(0, 0.3));
  g.px(hx - 0.5, hy + 2.5, OWL_BEAK, sphere(0, -0.4), { bias: -1 });
  return c;
}

/** Off its branch: broad soft wings beating, seen from in front as it goes. */
function owlFlying(g: Rig, beat: number): PixelCanvas {
  const cx = 11;
  const cy = 11;
  g.part();
  for (const side of [-1, 1]) {
    const tipX = cx + side * (9.6 - Math.abs(beat) * 2.2);
    const tipY = cy + beat * 5;
    const midX = cx + side * 5;
    const midY = cy + beat * 2.2 - 0.6;
    g.capsule(cx + side * 1.5, cy - 0.6, midX, midY, 2.4, 2.2, OWL, { bias: -1 });
    g.capsule(midX, midY, tipX, tipY, 2.2, 1.3, OWL, { bias: -1 });
    // Barred flight feathers along the trailing edge.
    for (let k = 1; k <= 3; k++) {
      const t = k / 4;
      g.px(midX + (tipX - midX) * t, midY + (tipY - midY) * t + 1.6, OWL_DISC, FLAT, { bias: -1 });
    }
  }
  g.part();
  g.ellipse(cx, cy + 1, 3, 4, OWL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9, 1) });
  g.part();
  g.ellipse(cx, cy + 1.6, 2, 2.8, OWL_BREAST, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8, 1) });
  g.part();
  g.ellipse(cx, cy - 3.2, 3.2, 2.8, OWL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.15, 1) });
  for (const side of [-1, 1]) g.ellipse(cx + side * 1.3, cy - 3, 1.5, 1.7, OWL_DISC, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6, 1) });
  g.part();
  for (const side of [-1, 1]) {
    g.px(cx + side * 1.3 - 0.5, cy - 3.2, OWL_EYE, FLAT);
    g.px(cx + side * 1.3 - 0.5 + (side < 0 ? 1 : -1) * 0, cy - 2.4, OWL_PUPIL, FLAT);
  }
  g.px(cx - 0.5, cy - 1.8, OWL_BEAK, FLAT);
  // Talons tucked up under the tail.
  g.px(cx - 1.5, cy + 5, OWL_BEAK, FLAT);
  g.px(cx + 0.5, cy + 5, OWL_BEAK, FLAT);
  return g.c;
}

/**
 * The owl's animations: perch (breathing, a slow blink), turn (the head
 * swivelling to look one way, then the other), hoot (the white throat
 * swelling) and fly (soft broad wingbeats).
 */
export const OWL_ANIMS: { name: string; frames: number; fps: number; loop: boolean; pose: (f: number) => OwlPose }[] = [
  { name: 'perch', frames: 6, fps: 3, loop: true, pose: (f) => ({ turn: 0, blink: f === 4, puff: 0, bob: f === 2 || f === 3 ? -0.4 : 0, beat: null }) },
  { name: 'turn', frames: 8, fps: 4, loop: false, pose: (f) => ({ turn: [0, -0.6, -1, -1, -0.4, 0.5, 1, 0.5][f], blink: f === 3, puff: 0, bob: 0, beat: null }) },
  { name: 'hoot', frames: 4, fps: 4, loop: false, pose: (f) => ({ turn: 0, blink: false, puff: [0.3, 1, 0.5, 1][f], bob: [0, 0.6, 0, 0.6][f], beat: null }) },
  { name: 'fly', frames: 4, fps: 9, loop: true, pose: (f) => ({ turn: 0, blink: false, puff: 0, bob: 0, beat: [-1, -0.1, 1, 0.2][f] }) },
];

export function owlFrames(): { name: string; canvas: PixelCanvas }[] {
  const out: { name: string; canvas: PixelCanvas }[] = [];
  for (const a of OWL_ANIMS) for (let f = 0; f < a.frames; f++) out.push({ name: `${a.name}${f}`, canvas: owl(a.pose(f)) });
  return out;
}

// ================================================================ the wind

export const GUST_W = 56;
export const GUST_H = 16;
export const GUST_FRAMES = 12;

/**
 * A streak of wind (white, the world tints and fades it): a thin line that
 * runs out along a curve, loops once, and frays away from its tail. Frame
 * `f` of GUST_FRAMES shows the line as far as it has run, brightest at its head.
 */
export function gustFrame(f: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(GUST_W * GUST_H * 4);
  // A prolate cycloid: a drift to the right with one loop in the middle.
  const N = 220;
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = -Math.PI * 1.15 + (i / N) * Math.PI * 2.3;
    pts.push([3.4 * t - 5.6 * Math.sin(t), -4.2 * Math.cos(t)]);
  }
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const [x] of pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
  }
  const sx = (GUST_W - 4) / (x1 - x0);
  const head = (f + 1) / GUST_FRAMES;
  const len = 0.5;
  const tail = head - len;
  const plot = (x: number, y: number, a: number) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= GUST_W || iy >= GUST_H) return;
    const i = (iy * GUST_W + ix) * 4;
    px[i] = px[i + 1] = px[i + 2] = 255;
    px[i + 3] = Math.max(px[i + 3], Math.round(a * 255));
  };
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    // It runs out over the first frames and its tail frays away over the last.
    const along = Math.min(1, head * 1.6);
    if (u > along || u < tail * 1.6 - 0.15) continue;
    const k = (u - Math.max(0, tail * 1.6 - 0.15)) / Math.max(0.01, along - Math.max(0, tail * 1.6 - 0.15));
    // Every other pixel drops out toward the tail, so it frays rather than just fading.
    if (k < 0.35 && i % 3 === 0) continue;
    const [x, y] = pts[i];
    plot(2 + (x - x0) * sx, GUST_H / 2 + y, 0.25 + 0.75 * k);
  }
  return px;
}
