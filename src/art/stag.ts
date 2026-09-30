// The White Stag of the Everwood (see world/WhiteStag.ts): a spirit deer in
// moonlit white, its antlers glowing like old gold, starlight caught in its
// coat. Drawn side-on facing right (the world mirrors it) on a shared rig: a
// body of rump, barrel and chest, legs solved from hip to hoof (the knee
// bends forward, the hock back), a neck and a head that can look ahead, turn
// to look at the viewer, rise in alarm or bow to graze. Its gaits come from
// the same rig: a lateral walk, a diagonal trot and a bounding gallop.
//
// The secret places it leads to are here too: a moonlit spring, a grove
// veiled by hanging moss with a gift on its altar, and the hollow of an
// ancient stump where the Moon Hare lives. And its hoofprints, and the badge
// of the blessing the spring gives.

import { FLAT, PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { hash2 } from './env';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const STAG_W = 48;
export const STAG_H = 54;
/** Where it stands in its frame: between its hooves, on the ground. */
export const STAG_OX = 23;
export const STAG_OY = 52;
/** Everything below is drawn this far down in the frame, to leave the antlers room. */
const DROP = 3;
/** The near hooves' bottom row; the far ones stand a little higher, as the ground is seen at a slant. */
const GROUND = 48;
const FAR_UP = 1.5;
const FAR_ON = 1.5;

const FUR: Material = { ramp: ramp('#434d6a', '#6e7a9c', '#a0acca', '#cfd8ee', '#f0f5ff'), outline: hex('#1e243a'), outlineLit: hex('#343c5a'), emissive: 0.42 };
const MANE: Material = { ramp: ramp('#98a4c2', '#dae2f4', '#ffffff'), outline: hex('#283048'), emissive: 0.5 };
const HOOF: Material = { ramp: ramp('#2a2e42', '#4a526e', '#78829e'), outline: hex('#101320'), shine: true };
const NOSE: Material = { ramp: ramp('#23273a', '#3c4258'), outline: hex('#0e1018'), noAO: true };
const EYE: Material = { ramp: ramp('#090b15', '#191d2f'), outline: hex('#05060b'), noAO: true };
const EAR_IN: Material = { ramp: ramp('#5e607e', '#8e8cac'), outline: hex('#1e243a'), noOutline: true, noAO: true };
const ANTLER: Material = { ramp: ramp('#86703c', '#c4b074', '#ecdeac', '#fffbe6'), outline: hex('#3a2e14'), outlineLit: hex('#52421c'), emissive: 0.85, noAO: true };
const GLINT = hex('#dcf4ff');
const TIP = hex('#fff0c0');

type Head = 'side' | 'front' | 'down' | 'high';

interface Pose {
  /** Body lift (negative is up), and how much higher the chest is than the rump. */
  bob: number;
  pitch: number;
  /** Hoof positions (x, bottom row): near hind, near fore, far hind, far fore. Far ones are shifted for depth here. */
  nh: [number, number];
  nf: [number, number];
  fh: [number, number];
  ff: [number, number];
  head: Head;
  /** The head's nod (px down), and a reach forward (a gallop stretches the neck). */
  nod: number;
  reach: number;
  /** 0 ears at rest, 1 flicked back. */
  ear: number;
  /** 0 tail down, 1 raised (its white flag when alarmed). */
  tail: number;
  blink: boolean;
  /** Which starlight glints in its coat this frame. */
  glint: number;
}

const REST: Pose = { bob: 0, pitch: 0, nh: [13, GROUND], nf: [30, GROUND], fh: [13, GROUND], ff: [30, GROUND], head: 'side', nod: 0, reach: 0, ear: 0, tail: 0, blink: false, glint: 0 };

/** Where the knee (or hock) goes between an upper joint and the hoof, for limbs `l1` and `l2`; `bend` +1 bends it back, -1 forward. */
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

/** One leg from its upper joint to its hoof: a strong upper limb, a slender cannon bone, a small dark hoof. */
function leg(c: PixelCanvas, ax: number, ay: number, foot: [number, number], hind: boolean, far: boolean): void {
  const [jx, jy, fx, fy] = joint(ax, ay, foot[0], foot[1] - 1, hind ? 6.4 : 6.2, hind ? 6.2 : 6.4, hind ? 1 : -1);
  const o = { bias: far ? -1 : 0 };
  c.part();
  c.capsule(ax, ay, jx, jy, hind ? 1.5 : 1.3, 0.9, FUR, o);
  c.capsule(jx, jy, fx, fy, 0.85, 0.65, FUR, o);
  c.part();
  const hx = Math.round(fx);
  const hy = Math.round(fy);
  c.px(hx - 1, hy, HOOF, sphere(-0.4, 0.2), o);
  c.px(hx, hy, HOOF, sphere(0.4, 0.2), o);
  c.px(hx - 1, hy + 1, HOOF, sphere(-0.4, -0.4), o);
  c.px(hx, hy + 1, HOOF, sphere(0.4, -0.4), o);
}

/** A point turned by `a` round (0, 0), then placed at (x, y). */
const turn = (x: number, y: number, a: number, u: number, v: number): [number, number] => [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)];

/**
 * One antler seen side-on, from its base at (x, y), turned by `a`: a main
 * beam sweeping up and back, then forward, with tines reaching ahead and a
 * forked crown. A `far` one is drawn dimmer, behind the head.
 */
function sideAntler(c: PixelCanvas, x: number, y: number, a: number, far: boolean): void {
  const P = (u: number, v: number) => turn(x, y, a, u, v);
  const o = { bias: far ? -1 : 0, glow: far ? 0.55 : 0.85 };
  const beam: [number, number][] = [[0, 0], [-1.5, -2], [-3, -4.5], [-3.9, -7.5], [-3.6, -10.4], [-2.2, -12.6]];
  const tines: [number, number, number, number][] = [
    [-1.1, -1.6, 1.6, -3.4],
    [-3.2, -5, -0.4, -7.6],
    [-3.8, -8.6, -1.2, -11],
    [-2.2, -12.6, -0.6, -14],
    [-2.2, -12.6, -4.2, -13.8],
  ];
  c.part();
  for (let i = 0; i + 1 < beam.length; i++) {
    const [x0, y0] = P(...beam[i]);
    const [x1, y1] = P(...beam[i + 1]);
    c.line(x0, y0, x1, y1, ANTLER, () => cyl(-0.3, 0.4), o);
    // The beam is thick near the skull.
    if (i < 2 && !far) c.line(x0 + 1, y0, x1 + 1, y1, ANTLER, () => cyl(0.5, 0.2), o);
  }
  for (const [u0, v0, u1, v1] of far ? tines.slice(1, 3) : tines) {
    const [x0, y0] = P(u0, v0);
    const [x1, y1] = P(u1, v1);
    c.line(x0, y0, x1, y1, ANTLER, () => cyl(0, 0.6), o);
    if (!far) c.spark(x1, y1, TIP, 0.55);
  }
}

/** One antler of the pair seen from the front, spreading out to `side` (-1 left, 1 right). */
function frontAntler(c: PixelCanvas, x: number, y: number, side: number): void {
  const o = { glow: 0.85 };
  const beam: [number, number][] = [[0, 0], [1.2, -2.2], [2.8, -4.6], [3.9, -7.2], [4.2, -9.8], [3.4, -12.2]];
  const tines: [number, number, number, number][] = [
    [0.8, -1.5, 0.2, -3.2],
    [2.6, -4.4, 1.6, -7],
    [3.9, -7.1, 2.7, -9.6],
    [4.1, -9.6, 6.1, -11.4],
    [3.4, -12.2, 2.4, -13.6],
  ];
  c.part();
  for (let i = 0; i + 1 < beam.length; i++) {
    const [u0, v0] = beam[i];
    const [u1, v1] = beam[i + 1];
    c.line(x + u0 * side, y + v0, x + u1 * side, y + v1, ANTLER, () => cyl(side * -0.3, 0.4), o);
  }
  for (const [u0, v0, u1, v1] of tines) {
    c.line(x + u0 * side, y + v0, x + u1 * side, y + v1, ANTLER, () => cyl(0, 0.6), o);
    c.spark(x + u1 * side, y + v1, TIP, 0.5);
  }
}

/** An eye with a glint of starlight in it, or shut. */
function eye(c: PixelCanvas, x: number, y: number, shut: boolean): void {
  c.part();
  if (shut) {
    c.px(x, y + 0.5, EYE, { x: 0, y: -0.3, z: 0.95 });
    c.px(x + 1, y + 0.5, EYE, { x: 0, y: -0.3, z: 0.95 });
    return;
  }
  c.px(x, y, EYE, FLAT);
  c.px(x, y + 1, EYE, FLAT);
  c.spark(x, y, GLINT, 0.9);
}

/** The head side-on, its skull at (x, y), turned by `a` (0.3 looks ahead and a little down). */
function sideHead(c: PixelCanvas, x: number, y: number, a: number, p: Pose): void {
  const P = (u: number, v: number) => turn(x, y, a, u, v);
  // The far ear and antler, behind the head.
  const [ex, ey] = P(-1.2, -2);
  const [etx, ety] = P(-3.8 - p.ear * 0.8, -3.6 + p.ear * 1.6);
  c.part();
  c.capsule(ex + 0.6, ey - 0.4, etx + 0.8, ety - 0.2, 1.1, 0.4, FUR, { bias: -1 });
  const [bx, by] = P(-0.4, -2.3);
  sideAntler(c, bx + 3.4, by + 0.6, a - 0.2, true);
  // Skull and tapering muzzle, the jaw under the cheek.
  c.part();
  const [mx, my] = P(5.2, 1.3);
  c.capsule(x, y, mx, my, 2.8, 1.5, FUR);
  c.part();
  const [jx, jy] = P(1, 1.2);
  c.ellipse(jx, jy, 2.6, 2.2, FUR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.2, 1) });
  // A pale chin and the dark nose.
  c.part();
  const [cx, cy] = P(3.6, 2.4);
  c.px(cx, cy, MANE, sphere(0, -0.5));
  const [nx, ny] = P(6.1, 1.2);
  c.px(nx, ny, NOSE, sphere(0.5, 0.2));
  c.px(nx - 0.8, ny + 0.9, NOSE, sphere(0.3, -0.3));
  const [ix, iy] = P(1.7, -0.6);
  eye(c, ix, iy, p.blink);
  // The near ear, cupped, and the near antler.
  c.part();
  c.capsule(ex, ey, etx, ety, 1.25, 0.45, FUR);
  const [inx, iny] = P(-2.4 - p.ear * 0.5, -2.8 + p.ear);
  c.part();
  c.px(inx, iny, EAR_IN, FLAT);
  sideAntler(c, bx, by, a - 0.3, false);
}

/** The head turned to look out at the viewer, its face at (x, y): both eyes, both ears, the whole rack spread. */
function frontHead(c: PixelCanvas, x: number, y: number, p: Pose): void {
  c.part();
  for (const side of [-1, 1]) {
    const flick = side === 1 ? p.ear : 0;
    c.capsule(x + side * 2, y - 2.4, x + side * 5.2, y - 3.2 - flick * 1.2, 1.3, 0.5, FUR, { bias: side < 0 ? 0 : -1 });
  }
  c.part();
  for (const side of [-1, 1]) {
    const flick = side === 1 ? p.ear : 0;
    c.px(x + side * 3.6 - 0.5, y - 2.9 - flick * 0.6, EAR_IN, FLAT);
  }
  c.part();
  c.ellipse(x, y, 2.8, 3.3, FUR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.7 - 0.15, 1) });
  c.part();
  c.ellipse(x, y + 3, 1.9, 1.7, FUR, { bias: 1, normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.3, 1) });
  c.part();
  c.px(x - 1, y + 3.6, NOSE, sphere(-0.3, 0.2));
  c.px(x, y + 3.6, NOSE, sphere(0.3, 0.2));
  c.px(x - 0.5, y + 4.6, MANE, sphere(0, -0.5));
  eye(c, x - 2.2, y - 0.8, p.blink);
  eye(c, x + 1.6, y - 0.8, p.blink);
  frontAntler(c, x - 1.2, y - 3, -1);
  frontAntler(c, x + 0.8, y - 3, 1);
}

/** The whole stag in one pose. */
function stag(p: Pose): PixelCanvas {
  const c = new PixelCanvas(STAG_W, STAG_H);
  c.offset(0, DROP);
  const rumpY = 30 + p.bob + p.pitch / 2;
  const chestY = 30 + p.bob - p.pitch / 2;
  const far = (f: [number, number]): [number, number] => [f[0] + FAR_ON, f[1] - FAR_UP];

  // The far legs, half hidden behind the body.
  leg(c, 17.5, rumpY + 7, far(p.fh), true, true);
  leg(c, 29.5, chestY + 6, far(p.ff), false, true);

  // The tail: a short white flag, raised in alarm.
  c.part();
  c.capsule(9, rumpY - 3, 7.3 - p.tail * 0.6, rumpY - 0.4 - p.tail * 3.4, 1.3, 1.1, MANE);

  // Rump, barrel and deep chest.
  c.part();
  c.capsule(14, rumpY + 0.4, 28.5, chestY + 0.4, 5.2, 5.1, FUR);
  c.part();
  c.ellipse(13.4, rumpY, 6, 5.7, FUR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.1, 1) });
  c.part();
  c.ellipse(29, chestY + 0.5, 5.4, 6.2, FUR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.1, 1) });

  // The neck, and the head on it.
  const n0x = 30.5;
  const n0y = chestY - 2.5;
  if (p.head === 'front') {
    const hx = 36 + p.reach;
    const hy = 18 + p.bob + p.nod;
    c.part();
    c.capsule(n0x, n0y, hx - 0.4, hy + 3, 4, 3, FUR);
    // A ruff of pale fur at the throat.
    c.part();
    c.capsule(n0x + 1.8, n0y + 1.5, hx + 0.8, hy + 5, 1.6, 1.1, MANE);
    frontHead(c, hx, hy, p);
  } else {
    const [sx, sy, a] =
      p.head === 'down' ? [38, 41 + p.nod, 1.35] : p.head === 'high' ? [37 + p.reach, 17 + p.bob + p.nod - p.pitch / 2, 0.15] : [38 + p.reach, 19.5 + p.bob + p.nod - p.pitch / 2, 0.35];
    c.part();
    c.capsule(n0x, n0y, sx - 0.8, sy + 0.8, 4, 2.8, FUR);
    c.part();
    const tx = p.head === 'down' ? sx - 3 : sx - 0.8;
    const ty = p.head === 'down' ? sy - 2 : sy + 3.8;
    c.capsule(n0x + 1.9, n0y + 1.7, tx, ty, 1.6, 1, MANE);
    sideHead(c, sx, sy, a, p);
  }

  // The near haunch and shoulder, standing out over the body.
  c.part();
  c.ellipse(15, rumpY + 2.6, 3.9, 4.4, FUR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9, 1) });
  c.part();
  c.ellipse(28.4, chestY + 2.2, 3.2, 4, FUR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9, 1) });

  // The near legs.
  leg(c, 16.4, rumpY + 5.6, p.nh, true, false);
  leg(c, 28.6, chestY + 5.2, p.nf, false, false);

  // Starlight caught in its coat, glinting in turn.
  const stars: [number, number][] = [[11, rumpY - 4], [17, rumpY - 4.5], [23, chestY - 4.5], [27, chestY - 5], [14, rumpY + 1], [20, rumpY + 2.5], [25, chestY + 1.5], [31, chestY - 1]];
  stars.forEach(([x, y], i) => {
    const k = (i * 3 + p.glint) % 5;
    if (k < 2) c.spark(x, y, GLINT, k === 0 ? 0.7 : 0.35);
  });
  return c;
}

// ---------------------------------------------------------------- the gaits

/** A foot's place in its stride at phase `ph` (0..1): planted and sliding back, then lifted and swung forward. */
function stride(rest: number, ph: number, len: number, lift: number, stance: number): [number, number] {
  const t = ((ph % 1) + 1) % 1;
  if (t < stance) return [rest + len / 2 - (len * t) / stance, GROUND];
  const u = (t - stance) / (1 - stance);
  return [rest - len / 2 + len * u, GROUND - Math.sin(u * Math.PI) * lift];
}

function walkPose(f: number, n: number): Pose {
  const ph = f / n;
  return {
    ...REST,
    // A deer walks one foot at a time: near hind, near fore, far hind, far fore.
    nh: stride(13, ph, 6, 2.4, 0.6),
    nf: stride(30, ph - 0.25, 6, 2.6, 0.6),
    fh: stride(13, ph - 0.5, 6, 2.4, 0.6),
    ff: stride(30, ph - 0.75, 6, 2.6, 0.6),
    bob: Math.cos(ph * Math.PI * 4) > 0.3 ? -0.5 : 0,
    nod: Math.sin(ph * Math.PI * 4) > 0 ? 0.6 : 0,
    tail: f === 3 ? 0.4 : 0,
    glint: f,
  };
}

function trotPose(f: number, n: number): Pose {
  const ph = f / n;
  return {
    ...REST,
    // The diagonal pairs together, with a moment aloft between them.
    nh: stride(13, ph, 9, 3.6, 0.45),
    ff: stride(30, ph, 9, 3.8, 0.45),
    fh: stride(13, ph - 0.5, 9, 3.6, 0.45),
    nf: stride(30, ph - 0.5, 9, 3.8, 0.45),
    bob: [0, -1, -1, 0, -1, -1][f],
    nod: [0.5, 0, 0, 0.5, 0, 0][f],
    head: 'high',
    ear: 0.4,
    tail: 0.7,
    glint: f,
  };
}

/** The gallop's bound, frame by frame: gathered, pushing off, flying, landing, gathered again. */
const GALLOP: Partial<Pose>[] = [
  { nh: [20, GROUND], fh: [19, GROUND], nf: [24, GROUND - 1], ff: [25, GROUND - 2], bob: -1, pitch: 0, nod: 1 },
  { nh: [9, GROUND], fh: [10, GROUND - 1], nf: [36, GROUND - 5], ff: [35, GROUND - 4], bob: -2, pitch: 2, nod: 0 },
  { nh: [5, GROUND - 4], fh: [6, GROUND - 3], nf: [39, GROUND - 3], ff: [38, GROUND - 2], bob: -3.5, pitch: 0, nod: 0 },
  { nh: [11, GROUND - 5], fh: [12, GROUND - 4], nf: [34, GROUND], ff: [33, GROUND - 1], bob: -1.5, pitch: -1, nod: 0.5 },
  { nh: [17, GROUND - 3], fh: [16, GROUND - 2], nf: [27, GROUND], ff: [26, GROUND], bob: -0.5, pitch: -1.5, nod: 1.5 },
  { nh: [21, GROUND], fh: [20, GROUND - 1], nf: [23, GROUND - 3], ff: [24, GROUND - 2], bob: 0, pitch: -0.5, nod: 1 },
];

function gallopPose(f: number): Pose {
  return { ...REST, ...GALLOP[f], reach: 1.5, ear: 1, tail: 1, glint: f * 2 };
}

/**
 * Every frame of the stag, named by animation: idle (breathing, an ear
 * flicking, a blink, the tail), look (turned to watch the viewer), walk,
 * trot, gallop, graze (head down, nibbling) and alert (head up, a hoof
 * stamped, the white tail raised).
 */
export const STAG_ANIMS: { name: string; frames: number; fps: number; loop: boolean; pose: (f: number) => Pose }[] = [
  { name: 'idle', frames: 6, fps: 4, loop: true, pose: (f) => ({ ...REST, bob: f === 2 || f === 3 ? -0.5 : 0, ear: f === 3 ? 1 : 0, blink: f === 4, tail: f === 5 ? 0.6 : 0, glint: f }) },
  { name: 'look', frames: 6, fps: 4, loop: true, pose: (f) => ({ ...REST, head: 'front', bob: f === 2 || f === 3 ? -0.5 : 0, ear: f === 1 ? 1 : 0, blink: f === 4, tail: f === 5 ? 0.5 : 0, glint: f }) },
  { name: 'walk', frames: 8, fps: 8, loop: true, pose: (f) => walkPose(f, 8) },
  { name: 'trot', frames: 6, fps: 10, loop: true, pose: (f) => trotPose(f, 6) },
  { name: 'gallop', frames: 6, fps: 12, loop: true, pose: gallopPose },
  {
    name: 'graze',
    frames: 4,
    fps: 3,
    loop: true,
    pose: (f) => ({ ...REST, head: 'down', nf: [31, GROUND], ff: [32, GROUND], nod: f % 2 ? 0.6 : 0, ear: f === 2 ? 1 : 0, tail: f === 3 ? 0.5 : 0, glint: f }),
  },
  {
    name: 'alert',
    frames: 4,
    fps: 6,
    loop: true,
    pose: (f) => ({ ...REST, head: 'high', bob: -0.5, nf: f === 1 ? [31, GROUND - 3] : [30, GROUND], ear: 0, tail: 1, glint: f }),
  },
];

/** Every frame, as `<anim><f>`. */
export function stagFrames(): { name: string; canvas: PixelCanvas }[] {
  const out: { name: string; canvas: PixelCanvas }[] = [];
  for (const a of STAG_ANIMS) for (let f = 0; f < a.frames; f++) out.push({ name: `${a.name}${f}`, canvas: stag(a.pose(f)) });
  return out;
}

// ---------------------------------------------------------------- hoofprints

/** A cloven hoofprint, 5 x 4, white (the world tints it and lets it fade). */
export const PRINT_W = 5;
export const PRINT_H = 4;

export function hoofprint(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(PRINT_W * PRINT_H * 4);
  const rows = ['.#.#.', '##.##', '##.##', '.#.#.'];
  rows.forEach((r, y) => {
    for (let x = 0; x < PRINT_W; x++) {
      if (r[x] !== '#') continue;
      const i = (y * PRINT_W + x) * 4;
      px.set([255, 255, 255, y === 0 || y === 3 ? 170 : 255], i);
    }
  });
  return px;
}

// ---------------------------------------------------------------- the places: shared stuff

const MOSS: Material = { ramp: ramp('#10281a', '#193a22', '#244e2a', '#336634', '#467e3e', '#5e9848', '#7cb456'), outline: hex('#08140c'), noOutline: true };
const MOSS_LIT: Material = { ramp: ramp('#2e5a3a', '#4a8050', '#74aa6a', '#a6d49a', '#d8f4cc'), outline: hex('#0e2414'), noOutline: true, emissive: 0.12 };
const STONE: Material = { ramp: ramp('#23262e', '#353944', '#4a505c', '#636a76', '#7e8692', '#9ca4ae', '#c0c6cc'), outline: hex('#0e1014'), outlineLit: hex('#1e2128') };
const STAR_PETAL: Material = { ramp: ramp('#9aa8c4', '#d8e2f4', '#ffffff'), outline: hex('#2a3044'), noOutline: true, emissive: 0.55, noAO: true };
const PETAL_HEART: Material = { ramp: ramp('#c8a040', '#ffe890'), outline: hex('#3a2a08'), noOutline: true, emissive: 0.7, noAO: true };
const SPIRIT_CAP: Material = { ramp: ramp('#2a6a7a', '#4aa6b4', '#86dce0', '#d0fff8'), outline: hex('#0e2a30'), outlineLit: hex('#1a4a54'), emissive: 0.6 };
const PALE_STALK: Material = { ramp: ramp('#6e6a78', '#a8a4b4', '#dcd8e6'), outline: hex('#1e1c24') };
const UP: Vec3 = { x: 0, y: 0.62, z: 0.78 };

/** A tiny five-petalled white star-flower, its heart gold, glowing faintly. */
function starFlower(c: PixelCanvas, x: number, y: number): void {
  c.part();
  for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] as const) c.px(x + dx, y + dy, STAR_PETAL, UP);
  c.part();
  c.px(x, y, PETAL_HEART, UP);
}

/** A little glowing toadstool, `h` tall. */
function spiritCap(c: PixelCanvas, x: number, y: number, h: number, r: number): void {
  c.part();
  c.line(x, y, x, y - h, PALE_STALK, () => cyl(0.2, 0.3));
  c.part();
  c.ellipse(x, y - h, r, Math.max(1, r * 0.6), SPIRIT_CAP, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.4, 1) });
}

// ---------------------------------------------------------------- the Moonwell

/** The spring: 72 x 44, a ground-level picture with its middle at (36, 22). */
export const SPRING_W = 72;
export const SPRING_H = 44;
export const SPRING_FRAMES = 4;
/** Its pool, round the middle: for walking round it. */
export const SPRING_POOL = { rx: 23, ry: 9.5 };

const WATER: Material = { ramp: ramp('#0a1a3a', '#12305a', '#1c4c7e', '#2e6ea4', '#4c94c8', '#7cbce4', '#b8e2f8', '#eefcff'), outline: hex('#061026'), noOutline: true, emissive: 0.5, noAO: true };
const PAD: Material = { ramp: ramp('#123a26', '#1e5634', '#2e7444', '#4a9458'), outline: hex('#08180e'), noOutline: true };
const LILY: Material = { ramp: ramp('#b8c4dc', '#e6eefa', '#ffffff'), outline: hex('#384058'), emissive: 0.7, noAO: true };

/**
 * A spring welling up in a ring of mossy stones: its water deep blue and
 * softly lit from within, the moon's face shining in it, rings spreading
 * out from the middle frame by frame, white lilies afloat and star-flowers
 * in the moss round it.
 */
export function springArt(f: number): PixelCanvas {
  const c = new PixelCanvas(SPRING_W, SPRING_H);
  const cx = 36;
  const cy = 22;
  // A soft carpet of moss, ragged at its edge.
  c.part();
  for (let y = 0; y < SPRING_H; y++) {
    for (let x = 0; x < SPRING_W; x++) {
      const dx = (x + 0.5 - cx) / 34;
      const dy = (y + 0.5 - cy) / 17;
      const d = dx * dx + dy * dy;
      if (d > 1 - hash2(x, y, 7) * 0.22) continue;
      c.px(x, y, MOSS, UP, { bias: Math.round((hash2(x >> 1, y >> 1, 9) - 0.5) * 3 + (1 - d) * 1.5) });
    }
  }
  // The water, its rings rolling out from the spring's heart.
  c.part();
  const rx = SPRING_POOL.rx + 1;
  const ry = SPRING_POOL.ry + 1;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      const ring = Math.sin(d * 13 - f * (Math.PI / 2));
      const n: Vec3 = { x: dx * ring * 0.35, y: -dy * ring * 0.35 + 0.1, z: 0.9 };
      // Deeper toward the middle, lighter at the shallows.
      c.px(x, y, WATER, n, { bias: Math.round(1 - d * 2.2 + (d > 0.86 ? 2 : 0)), glow: 0.35 + (1 - d) * 0.4 });
    }
  }
  // The moon's face in the water.
  for (const [x, y, a] of [[40, 19, 0.9], [41, 19, 0.9], [40, 20, 1], [41, 20, 0.8], [39, 20, 0.5], [42, 20, 0.4], [40, 21, 0.5], [41, 18, 0.4]] as const) c.spark(x, y + (f === 2 ? 1 : 0), hex('#eef8ff'), a);
  // A ring of stones, each capped with moss.
  const stones = 17;
  for (let k = 0; k < stones; k++) {
    const t = (k / stones) * Math.PI * 2 + 0.2;
    const sx = cx + Math.cos(t) * 26.5;
    const sy = cy + Math.sin(t) * 11.2;
    const r = 2.3 + hash2(k, 3, 11) * 1.4;
    c.part();
    c.ellipse(sx, sy, r, r * 0.72, STONE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 1) });
    if (hash2(k, 5, 13) < 0.7) {
      c.part();
      c.ellipse(sx - 0.4, sy - r * 0.45, r * 0.8, r * 0.35, MOSS, { bias: 2, normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6 - 0.5, 1) });
    }
  }
  // Lilies on their pads.
  for (const [lx, ly, big] of [[26, 18, 1], [47, 25, 0], [31, 27, 0], [44, 16, 0]] as const) {
    c.part();
    c.ellipse(lx, ly, 2.6 + big, 1.5 + big * 0.5, PAD, { normal: (_x, _y, dx, dy) => sphere(dx * 0.4, dy * 0.4 - 0.5, 1) });
    c.erase(lx + 1, ly);
    c.part();
    c.px(lx, ly - 1, LILY, sphere(-0.3, 0.5));
    c.px(lx - 1, ly - 1, LILY, sphere(-0.6, 0.3));
    c.px(lx + 1, ly - 1, LILY, sphere(0.5, 0.3));
    c.px(lx, ly - 2, LILY, sphere(0, 0.8));
    if (big) c.px(lx, ly, LILY, sphere(0, -0.2));
    c.spark(lx, ly - 1, hex('#fff6d0'), 0.5);
  }
  // Star-flowers and glowing caps in the moss.
  for (const [x, y] of [[8, 20], [12, 27], [60, 17], [64, 24], [20, 35], [52, 34], [15, 10], [57, 9], [36, 38]] as const) starFlower(c, x, y);
  spiritCap(c, 6, 25, 3, 1.8);
  spiritCap(c, 9, 26, 2, 1.3);
  spiritCap(c, 66, 20, 3, 1.6);
  return c;
}

// ---------------------------------------------------------------- the Veiled Grove

/** The arch: 84 x 88, standing on (42, GROVE_BASE). */
export const GROVE_W = 84;
export const GROVE_H = 88;
export const GROVE_BASE = 85;
/** Its trunks' feet either side of the middle. */
export const GROVE_FOOT = 25;
/** Frames: `v0`,`v1` veiled and swaying, `p0`..`p2` parting, `o0`,`o1` open and swaying. */
export const GROVE_FRAMES = ['v0', 'v1', 'p0', 'p1', 'p2', 'o0', 'o1'];

const BARK: Material = { ramp: ramp('#4a4e5e', '#747a8a', '#a4aab6', '#d0d4dc', '#eef0f4'), outline: hex('#1a1c24'), outlineLit: hex('#2c2f3a'), emissive: 0.12 };
const BARK_MARK: Material = { ramp: ramp('#1c1e26', '#30333e'), outline: hex('#0c0d12'), noOutline: true };
const SPIRIT_LEAF: Material = { ramp: ramp('#1e4a44', '#2e6a5e', '#4a8e78', '#74b496', '#a8d8b8', '#dcf6e2'), outline: hex('#0c201c'), outlineLit: hex('#1e4a44'), emissive: 0.22 };
const VEIL: Material = { ramp: ramp('#4a7a5a', '#72a47a', '#a2cc9e', '#d4f0c8'), outline: hex('#1a3020'), noOutline: true, emissive: 0.5, noAO: true };
const VEIL_BLOOM = hex('#e8fff0');

/** The arch's curve: where the bough is at x, y from the top. */
function archY(x: number): number {
  const u = (x - 42) / (GROVE_FOOT + 3);
  return 20 + u * u * 18;
}

/**
 * Two old ghost-birches leaning together into an arch, their crowns of pale
 * spirit-green leaves meeting overhead, and from the bough between them a
 * curtain of glowing moss hanging to the ground. `open` 0 is the veil
 * closed, 1 parted and gathered to either trunk; `sway` rocks the strands.
 */
function groveArt(open: number, sway: number): PixelCanvas {
  const c = new PixelCanvas(GROVE_W, GROVE_H);
  const base = GROVE_BASE;
  // The veil first, behind the trunks: strand by strand from the bough.
  const e = open * open * (3 - 2 * open);
  for (let x = 42 - GROVE_FOOT + 4; x <= 42 + GROVE_FOOT - 4; x += 2) {
    const side = x < 42 ? -1 : 1;
    const top = archY(x) + 3;
    const len = base - 4 - top - hash2(x, 1, 21) * 10;
    // Parting, each strand's foot is swept to its own trunk and gathered up.
    const to = 42 + side * (GROVE_FOOT - 2);
    c.part();
    const steps = Math.max(2, Math.round(len * (1 - e * 0.45)));
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const drift = Math.sin(u * 3 + x * 0.7 + sway * Math.PI) * u * 1.2;
      const px = x + (to - x) * e * u * u + drift * (1 - e);
      const py = top + u * len * (1 - e * 0.45);
      c.px(px, py, VEIL, { x: 0, y: 0.1, z: 1 }, { bias: Math.round(1 - u * 2 + (x % 4 === 0 ? 1 : 0)) });
    }
    if (hash2(x, 2, 23) < 0.4) c.spark(x + (to - x) * e * 0.5, top + len * (1 - e * 0.45) * 0.6, VEIL_BLOOM, 0.6);
  }
  // Two trunks rising from the ground, leaning in, meeting in a bough.
  for (const side of [-1, 1]) {
    const fx = 42 + side * GROVE_FOOT;
    const pts: [number, number][] = [];
    for (let k = 0; k <= 12; k++) {
      const u = k / 12;
      const x = fx - side * (GROVE_FOOT - 2) * u * u * 0.95;
      const y = base - u * (base - 18) - Math.sin(u * Math.PI) * 4;
      pts.push([x, y]);
    }
    c.part();
    for (let k = 0; k + 1 < pts.length; k++) {
      const r = 2.8 - k * 0.14;
      c.capsule(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], r, r - 0.14, BARK);
    }
    // Birch marks across the white bark.
    c.part();
    for (let k = 1; k < 9; k++) {
      if (hash2(k, side + 3, 25) < 0.45) continue;
      const [x, y] = pts[k];
      c.px(x - 1, y, BARK_MARK, FLAT);
      if (hash2(k, side, 27) < 0.5) c.px(x, y, BARK_MARK, FLAT);
    }
    // Roots gripping the ground.
    c.part();
    c.capsule(fx, base - 2, fx - side * 5, base, 1.6, 0.6, BARK, { bias: -1 });
    c.capsule(fx, base - 2, fx + side * 6, base - 0.5, 1.5, 0.5, BARK, { bias: -1 });
    // Moss at the foot.
    c.part();
    c.ellipse(fx, base - 1, 4.5, 1.8, MOSS, { bias: 1, normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.4 - 0.5, 1) });
  }
  // The crown: clusters of pale leaves along the bough, lit from the upper left.
  const clumps: [number, number, number][] = [];
  for (let k = 0; k < 15; k++) {
    const u = k / 14;
    const x = 42 + (u - 0.5) * (GROVE_FOOT * 2 + 4);
    clumps.push([x + (hash2(k, 5, 29) - 0.5) * 6, archY(x) - 7 + (hash2(k, 6, 31) - 0.5) * 6 - (1 - Math.abs(u - 0.5) * 2) * 4, 5 + hash2(k, 7, 33) * 3]);
  }
  for (const [x, y, r] of clumps) {
    c.part();
    for (let yy = Math.floor(y - r); yy <= y + r; yy++) {
      for (let xx = Math.floor(x - r * 1.2); xx <= x + r * 1.2; xx++) {
        const dx = (xx + 0.5 - x) / (r * 1.2);
        const dy = (yy + 0.5 - y) / r;
        const d = dx * dx + dy * dy;
        if (d > 1 || hash2(xx, yy, 35) < d * 0.5) continue;
        c.px(xx, yy, SPIRIT_LEAF, sphere(dx * 0.8, dy * 0.8, 1), { bias: hash2(xx >> 1, yy >> 1, 37) < 0.25 ? 1 : 0 });
      }
    }
  }
  // Blossoms glowing in the crown.
  for (let k = 0; k < 9; k++) {
    const [x, y] = clumps[(k * 5) % clumps.length];
    c.spark(x + (hash2(k, 8, 39) - 0.5) * 8, y + (hash2(k, 9, 41) - 0.5) * 6, VEIL_BLOOM, 0.7);
  }
  return c;
}

export function groveFrame(name: string): PixelCanvas {
  const i = GROVE_FRAMES.indexOf(name);
  const open = name[0] === 'v' ? 0 : name[0] === 'o' ? 1 : [0.3, 0.6, 0.85][i - 2];
  return groveArt(open, i % 2);
}

/** The altar behind the veil: 34 x 34, standing on (17, ALTAR_BASE). Frames `full` and `spent`. */
export const ALTAR_W = 34;
export const ALTAR_H = 34;
export const ALTAR_BASE = 31;

const ALTAR_STONE: Material = { ramp: ramp('#2a2c36', '#3e4250', '#565c6a', '#727a86', '#929aa4', '#b6bcc2'), outline: hex('#0e1016'), outlineLit: hex('#1e2028') };
const RUNE: Material = { ramp: ramp('#a08030', '#f0d070', '#fff8d0'), outline: hex('#3a2a08'), noOutline: true, emissive: 1, noAO: true };
const RUNE_DIM: Material = { ramp: ramp('#4a4436', '#6a624a'), outline: hex('#1a160e'), noOutline: true };
const GIFT: Material = { ramp: ramp('#8a5a10', '#d8a030', '#ffe070', '#fffae0'), outline: hex('#3a2406'), shine: true, emissive: 0.45 };

/**
 * A low round altar of old stone, moss over its rim, a stag's antlers cut
 * into its face and glowing gold; on it, while its gift waits, a heap of
 * gold and a gem catching the light.
 */
export function altarArt(spent: boolean): PixelCanvas {
  const c = new PixelCanvas(ALTAR_W, ALTAR_H);
  const cx = 17;
  const b = ALTAR_BASE;
  // The drum of the altar.
  c.part();
  c.shape(b - 12, b, (y) => {
    const u = (y - (b - 12)) / 12;
    const hw = 10 + u * 1.5;
    return [cx - hw, cx + hw];
  }, ALTAR_STONE, (_x, _y, t) => cyl(t, -0.1));
  // Its top, a flat disc.
  c.part();
  c.ellipse(cx, b - 12, 10.5, 3.6, ALTAR_STONE, { bias: 1, normal: () => UP });
  // Moss spilling over the rim.
  c.part();
  for (let x = cx - 11; x <= cx + 11; x++) {
    const h = Math.round(hash2(x, 1, 43) * 3);
    if (hash2(x, 2, 45) < 0.3) continue;
    for (let k = 0; k < h; k++) c.px(x, b - 11 + k + (Math.abs(x - cx) > 7 ? 1 : 0), MOSS, sphere((x - cx) / 12, 0.2), { bias: 2 - k });
  }
  c.part();
  c.ellipse(cx - 4, b - 13, 4, 1.6, MOSS, { bias: 2, normal: () => UP });
  // The antler rune on its face.
  c.part();
  const m = spent ? RUNE_DIM : RUNE;
  const rune: [number, number][] = [[0, 0], [0, -1], [-1, -2], [-2, -3], [-2, -4], [1, -2], [2, -3], [2, -4], [-3, -2], [3, -2], [0, 1], [-1, 2], [1, 2], [0, 3]];
  for (const [dx, dy] of rune) c.px(cx + dx, b - 4 + dy, m, FLAT);
  if (!spent) {
    // The gift: gold heaped on the altar, a gem on top.
    c.part();
    c.ellipse(cx + 1, b - 14, 4.5, 2.4, GIFT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.5, 1) });
    c.part();
    c.px(cx + 1, b - 17, { ramp: ramp('#1a5a8a', '#3aa0e0', '#9ae4ff', '#ffffff'), outline: hex('#08203a'), emissive: 0.8, shine: true }, sphere(-0.3, 0.5));
    c.px(cx + 1, b - 16, { ramp: ramp('#1a5a8a', '#3aa0e0', '#9ae4ff'), outline: hex('#08203a'), emissive: 0.6 }, sphere(0.2, -0.2));
    for (const [x, y] of [[cx - 2, b - 15], [cx + 4, b - 14], [cx + 1, b - 17]] as const) c.spark(x, y, hex('#fff4c0'), 0.8);
  }
  starFlower(c, cx - 13, b - 1);
  starFlower(c, cx + 13, b);
  return c;
}

// ---------------------------------------------------------------- the Moon Hare's hollow

/** The stump: 64 x 66, standing on (32, HOLLOW_BASE); frames `h0`..`h2`, the moonlight in it breathing. */
export const HOLLOW_W = 64;
export const HOLLOW_H = 66;
export const HOLLOW_BASE = 62;
export const HOLLOW_FRAMES = 3;
/** Where the hollow's mouth is, above its foot. */
export const HOLLOW_MOUTH = 6;

const OLDWOOD: Material = { ramp: ramp('#34323a', '#524e58', '#76727a', '#9c98a0', '#c4c0c6', '#e4e2e6'), outline: hex('#141218'), outlineLit: hex('#26242c'), emissive: 0.08 };
const DARK: Material = { ramp: ramp('#07080e', '#0e1220'), outline: hex('#04050a'), noOutline: true, noAO: true };
const MOONGLOW: Material = { ramp: ramp('#3a5a8a', '#6a9ad0', '#b0dcff', '#eaf8ff'), outline: hex('#101e30'), noOutline: true, emissive: 1, noAO: true };

/**
 * The stump of a great tree, ancient and silver, broken off in jagged
 * splinters, its roots spread wide over the ground and moss over its
 * shoulders; at its foot a round hollow full of soft moonlight, where the
 * Moon Hare sleeps. Star-flowers and glowing caps grow round it.
 */
export function hollowArt(f: number): PixelCanvas {
  const c = new PixelCanvas(HOLLOW_W, HOLLOW_H);
  const cx = 32;
  const b = HOLLOW_BASE;
  // Roots spreading over the ground (behind the trunk's foot).
  c.part();
  for (const [dx, len, lift] of [[-1, 17, 2], [1, 18, 1], [-1, 11, -2], [1, 12, -3]] as const) {
    c.capsule(cx + dx * 9, b - 5, cx + dx * (9 + len), b + lift * 0.3 - 1, 3.2, 0.8, OLDWOOD, { bias: lift < 0 ? -1 : 0 });
  }
  // The trunk: wide at its foot, grained, its top broken into splinters.
  c.part();
  const top = b - 31;
  c.shape(top - 6, b - 2, (y) => {
    const u = (y - top) / (b - 2 - top);
    const hw = 14 + Math.max(0, u - 0.65) * 18;
    // Splintered top: some columns stand taller than others.
    return [cx - hw, cx + hw];
  }, OLDWOOD, (x, _y, t) => {
    const grain = Math.sin(x * 1.7) * 0.18;
    return cyl(t + grain, 0.05);
  });
  // Knock the top into jagged splinters.
  for (let x = cx - 15; x <= cx + 15; x++) {
    const h = Math.floor(hash2(x, 3, 47) * 6 + (Math.abs(x - cx) < 4 ? 0 : 2) + Math.abs(Math.sin(x * 0.9)) * 3);
    for (let y = top - 7; y < top - 6 + h; y++) c.erase(x, y);
  }
  // A darker heart of old rings seen at the break.
  c.part();
  c.ellipse(cx + 1, top + 2, 9, 2.2, OLDWOOD, { bias: -2, normal: () => UP });
  // Moss over its shoulders and down one side.
  c.part();
  for (let y = top; y < b - 4; y++) {
    for (let x = cx - 18; x <= cx + 18; x++) {
      if (!c.filled(x, y)) continue;
      const u = (y - top) / (b - top);
      const m = hash2(x >> 1, y >> 1, 49) + (x < cx - 6 ? 0.25 : 0) - u * 0.7 + (y < top + 5 ? 0.35 : 0);
      if (m > 0.62) c.px(x, y, m > 0.8 ? MOSS_LIT : MOSS, sphere((x - cx) / 16, 0.3), { bias: 2 });
    }
  }
  // The hollow at its foot: dark, and full of moonlight breathing in and out.
  const mx = cx;
  const my = b - HOLLOW_MOUTH;
  c.part();
  c.shape(my - 7, my + 4, (y) => {
    const u = (y - (my - 7)) / 11;
    const hw = u < 0.5 ? Math.sin((u / 0.5) * Math.PI * 0.5) * 5.4 : 5.4;
    return [mx - hw, mx + hw];
  }, DARK, () => FLAT);
  const breath = [0.7, 1, 0.85][f];
  // Moonlight pooled in the bottom of the hollow, brightest low in the middle.
  c.part();
  for (let y = my - 4; y <= my + 4; y++) {
    for (let x = mx - 5; x <= mx + 5; x++) {
      const dx = (x + 0.5 - mx) / 5;
      const dy = (y + 0.5 - (my + 3)) / 5;
      const d = dx * dx + dy * dy;
      if (d > 1 || !c.filled(x, y)) continue;
      c.px(x, y, MOONGLOW, UP, { bias: Math.round(1.5 - d * 3), glow: (1 - d) * breath });
    }
  }
  for (let k = 0; k < 4; k++) c.spark(mx - 2 + k * 1.3, my - 2 - (k % 2) - f * 0.5, hex('#d0ecff'), 0.35 * breath);
  // A lip of bark over the mouth.
  c.part();
  for (let x = mx - 6; x <= mx + 6; x++) c.px(x, my - 7 - (Math.abs(x - mx) < 3 ? 1 : 0), OLDWOOD, sphere(0, 0.7), { bias: 1 });
  // Flowers and glowing caps among the roots.
  for (const [x, y] of [[cx - 22, b - 1], [cx - 15, b + 1], [cx + 17, b], [cx + 24, b - 2], [cx - 8, b + 2], [cx + 9, b + 2]] as const) starFlower(c, x, y);
  spiritCap(c, cx + 14, b - 3, 4, 2.2);
  spiritCap(c, cx + 17, b - 2, 2, 1.4);
  spiritCap(c, cx - 17, b - 4, 3, 1.8);
  // A few caps on the stump's shoulder.
  spiritCap(c, cx - 10, top + 12, 2, 1.5);
  spiritCap(c, cx - 12, top + 14, 1, 1.1);
  return c;
}

// ---------------------------------------------------------------- the blessing's badge

/** 16 x 16: a stag's antlers in gold over a pale moon, for the Stag's Grace badge. */
export function stagBuffIcon(): Uint8ClampedArray {
  const w = 16;
  const px = new Uint8ClampedArray(w * w * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= w || y >= w) return;
    const n = parseInt(c.slice(1), 16);
    px.set([n >> 16, (n >> 8) & 255, n & 255, 255], (y * w + x) * 4);
  };
  // The moon behind.
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 9);
      if (d < 6.2) put(x, y, d < 4.8 ? '#28345a' : '#1c2644');
    }
  }
  // The antlers: a curving beam each side with three tines reaching in and up.
  const beam: [number, number][] = [[6, 11], [5, 10], [4, 9], [4, 8], [3, 7], [3, 6], [3, 5], [3, 4], [2, 3], [2, 2], [1, 1]];
  const tines: [number, number][] = [[5, 7], [6, 6], [4, 4], [5, 3], [3, 2], [3, 1]];
  for (const side of [0, 1]) {
    const X = (x: number) => (side ? 15 - x : x);
    beam.forEach(([x, y], i) => put(X(x), y, i < 4 ? '#b89030' : i < 8 ? '#f0d070' : '#fff6d0'));
    for (const [x, y] of tines) put(X(x), y, '#f0d070');
  }
  // A little white head between them.
  for (const [x, y] of [[7, 11], [8, 11], [7, 12], [8, 12], [7, 13], [8, 13], [7, 14], [8, 14]]) put(x, y, y < 13 ? '#ffffff' : '#c8d2e6');
  put(6, 11, '#b4bed4');
  put(9, 11, '#b4bed4');
  // Outline everything drawn in the antlers and head.
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < w && px[(y * w + x) * 4 + 3] === 255;
  const out: [number, number][] = [];
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) out.push([x, y]);
  for (const [x, y] of out) put(x, y, '#0c1020');
  return px;
}
