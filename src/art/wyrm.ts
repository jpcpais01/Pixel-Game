// Amethrax, the Geode Wyrm: the Glimmerdeep's Myth, three heroes tall. A
// serpent of dark violet stone lying coiled on the floor of the Geode Heart,
// its neck rearing high above the coil. Amethyst grows out of it: a row of
// crystal spines down its back, a crown of great crystal horns sweeping back
// from its skull, and set in its chest its heart, a geode burning white and
// violet. Its belly is plated in pale scales; its eyes and throat blaze.
// Poses: breathing in the coil, rearing back to breathe, breathing a torrent
// of shards with its jaws wide, driving its head down into the floor, and
// diving under the floor (the game hides it while it burrows).

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, hex, sphere, type Material, type RGB } from './pixel';
import { rng } from './env';
import { shard } from './deepMonsters';

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#07040e');
const WHITE = hex('#ffffff');
const AMETHYST = hex('#b37aff');
const AMETHYST_HOT = hex('#ead8ff');

const HIDE: Material = { ramp: ramp('#0c0816', '#150f24', '#201836', '#2c2148', '#3a2b5c', '#4a3872', '#5e488a'), outline: INK, outlineLit: hex('#1e1430') };
const BELLY: Material = { ramp: ramp('#241c34', '#382e4c', '#504468', '#6a5c86', '#8a7aa6', '#a898c2'), outline: INK };
const CRYSTAL: Material = { ramp: ramp('#2a1450', '#4a2484', '#7240bc', '#9c68e8', '#c8a0ff', '#f0e2ff'), outline: hex('#12062a'), emissive: 0.65, shine: true, noAO: true };
const CRYSTAL_DARK: Material = { ramp: ramp('#1c0c38', '#321660', '#4e2890', '#6a3cb4'), outline: hex('#12062a'), emissive: 0.45, noAO: true };
const HEART: Material = { ramp: ramp('#9c68e8', '#c8a0ff', '#ead8ff', '#ffffff'), outline: hex('#12062a'), emissive: 1, noAO: true, shine: true };
const EYE: Material = { ramp: ramp('#d8b8ff', '#ffffff'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const MAW: Material = { ramp: ramp('#6a3cb4', '#b37aff', '#ead8ff', '#ffffff'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const TOOTH: Material = { ramp: ramp('#8a8098', '#c8c0d6', '#f0ecf8'), outline: INK };
const ROCK: Material = { ramp: ramp('#100e18', '#1a1726', '#262236', '#332e48', '#433c5a', '#554d6e'), outline: INK };

/** Particle tints for Amethrax's bursts: amethyst, lilac, white and deep violet. */
export const WYRM_TINTS = [0xb37aff, 0xead8ff, 0xffffff, 0x7240bc];

type Mood = 'idle' | 'rear' | 'breath' | 'slam' | 'dive';

interface WyrmPose {
  t: number;
  mood: Mood;
}

type P3 = [number, number, number];

/** Points along a Catmull-Rom spline through the control points (x, y, radius). */
function spline(ctrl: P3[], per: number): P3[] {
  const out: P3[] = [];
  const at = (i: number) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

/** A thick scaled body along the points, its belly plated on the side toward `belly` (+1 right, -1 left). */
function body(c: PixelCanvas, pts: P3[], belly: number, spines: boolean, seed: number): void {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0, r0] = pts[i - 1];
    const [x1, y1, r1] = pts[i];
    c.capsule(x0, y0, x1, y1, r0, r1, HIDE);
  }
  // Scales: a stagger of darker marks.
  const R = rng(seed);
  for (let i = 0; i < pts.length; i += 2) {
    const [x, y, r] = pts[i];
    for (let k = 0; k < 3; k++) c.shade(x + (R() - 0.5) * r * 1.4, y + (R() - 0.5) * r * 1.4, -1);
  }
  c.part();
  // The belly: pale plates down the near side.
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0, r0] = pts[i - 1];
    const [x1, y1, r1] = pts[i];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * belly;
    const ny = (dx / l) * belly;
    c.capsule(x0 + nx * r0 * 0.45, y0 + ny * r0 * 0.45, x1 + nx * r1 * 0.45, y1 + ny * r1 * 0.45, r0 * 0.55, r1 * 0.55, BELLY);
    if (i % 3 === 0) for (let k = -2; k <= 2; k++) c.shade(x1 + nx * r1 * 0.45 + (dx / l) * 0 + k * (-ny) * 0.8, y1 + ny * r1 * 0.45 + k * nx * 0.8, -1);
  }
  if (!spines) return;
  // Crystal spines down the far side.
  for (let i = 4; i < pts.length - 2; i += 5) {
    const [x, y, r] = pts[i];
    const [xa, ya] = pts[i - 1];
    const [xb, yb] = pts[i + 1];
    const dx = xb - xa;
    const dy = yb - ya;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (dy / l) * belly;
    const ny = (-dx / l) * belly;
    const len = r * (0.8 + R() * 0.5);
    c.part();
    shard(c, x + nx * r * 0.6, y + ny * r * 0.6, x + nx * (r + len) - (dx / l) * len * 0.35, y + ny * (r + len) - (dy / l) * len * 0.35, Math.max(1.4, r * 0.28), i % 2 ? CRYSTAL : CRYSTAL_DARK);
  }
}

function wyrm(p: WyrmPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.wyrm;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const sway = Math.sin(tau) * 2;
  const heave = Math.sin(tau + 1) * 1;
  const G = 130;
  const dive = p.mood === 'dive';

  // The coil on the floor: an oval ring, its far half first.
  const ring = { cx: 58, cy: G - 11 + (dive ? 3 : 0), rx: 36, ry: 11, r: 8.5 };
  const ringPt = (a: number, r = ring.r): P3 => [ring.cx + Math.cos(a) * ring.rx, ring.cy + Math.sin(a) * ring.ry, r];
  c.part();
  const back: P3[] = [];
  for (let a = Math.PI * 0.05; a >= -Math.PI * 1.05; a -= 0.12) back.push(ringPt(a));
  body(c, back, -1, true, 11);
  // The tail, trailing out of the coil and curling up.
  c.part();
  const tail = spline([ringPt(Math.PI * 0.95, 7.5), [12, G - 4, 5], [4, G - 12, 3], [8, G - 20 + Math.sin(tau) * 2, 1.5]], 5);
  body(c, tail, 1, false, 13);
  for (const [x, y] of [tail[6], tail[10]]) {
    c.part();
    shard(c, x, y - 2, x - 3, y - 9, 1.6, CRYSTAL);
  }

  // The neck, rearing up out of the coil to the head.
  let head: { x: number; y: number; jaw: number; tilt: number };
  let ctrl: P3[];
  if (p.mood === 'rear') {
    head = { x: 72, y: 24, jaw: 0, tilt: -0.2 };
    ctrl = [[88, G - 10, 13], [96, 106, 12.5], [98, 84, 11], [84, 62, 9.5], [68, 48, 8.5], [66, 34, 7.5], [head.x - 4, head.y + 6, 7]];
  } else if (p.mood === 'breath') {
    head = { x: 100, y: 40, jaw: 9, tilt: 0.3 };
    ctrl = [[88, G - 10, 13], [96, 106, 12.5], [92, 86, 11], [80, 68, 9.5], [80, 54, 8.5], [88, 44, 7.5], [head.x - 6, head.y + 2, 7]];
  } else if (p.mood === 'slam') {
    head = { x: 104, y: 112, jaw: 3, tilt: 1.1 };
    ctrl = [[88, G - 10, 13], [94, 104, 12.5], [96, 82, 11], [100, 74, 9.5], [106, 82, 8.5], [106, 96, 7.5], [head.x - 1, head.y - 8, 7]];
  } else if (dive) {
    head = { x: 106, y: 124, jaw: 0, tilt: 1.4 };
    ctrl = [[88, G - 8, 13], [92, 108, 12.5], [98, 96, 11], [106, 100, 9.5], [108, 112, 8.5], [head.x, head.y - 8, 7]];
  } else {
    head = { x: 88 + sway, y: 30 + heave, jaw: 0, tilt: 0 };
    ctrl = [[88, G - 10, 13], [96, 106, 12.5], [98, 86, 11], [86, 70 + heave * 0.5, 9.5], [74 + sway * 0.5, 54 + heave, 8.5], [76 + sway * 0.8, 40 + heave, 7.5], [head.x - 4, head.y + 6, 7]];
  }
  c.part();
  const neck = spline(ctrl, 6);
  body(c, neck, 1, true, 17);
  // Its heart: a geode set in its chest, burning.
  const hp = neck[Math.floor(neck.length * 0.3)];
  c.part();
  c.ellipse(hp[0] + 4, hp[1], 4.2, 5, ROCK);
  c.part();
  c.ellipse(hp[0] + 4.5, hp[1], 3, 3.6, HEART, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 0.7) });
  c.spark(hp[0] + 3.5, hp[1] - 1.5, WHITE, 1);

  // The near half of the coil, over the neck's root.
  c.part();
  const front: P3[] = [];
  for (let a = Math.PI * 0.95; a >= Math.PI * 0.02; a -= 0.12) front.push(ringPt(a));
  body(c, front, 1, false, 19);
  if (dive) {
    // Rubble thrown up where it breaks through the floor.
    const R = rng(29);
    for (let k = 0; k < 10; k++) {
      c.part();
      c.ellipse(head.x - 10 + R() * 22, G - 2 - R() * 5, 2 + R() * 2, 1.4 + R(), ROCK);
    }
  }

  // The head.
  drawHead(c, head.x, head.y, head.jaw, head.tilt, p.mood, tau);
  return c;
}

function drawHead(c: PixelCanvas, hx: number, hy: number, jaw: number, tilt: number, mood: Mood, tau: number): void {
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  // Head-local (forward, down) to frame coordinates.
  const at = (f: number, d: number): [number, number] => [hx + f * cos - d * sin, hy + f * sin + d * cos];
  // The crown: great crystal horns sweeping back from the skull.
  const horns: [number, number, number, number, number][] = [
    [-4, -6, -26, -22, 3.2],
    [-1, -7, -18, -28, 2.8],
    [-7, -3, -30, -10, 2.6],
    [2, -6, -8, -20, 2],
  ];
  horns.forEach(([bf, bd, tf, td, r], k) => {
    c.part();
    const [bx, by] = at(bf, bd);
    const [tx, ty] = at(tf + Math.sin(tau) * 0.6, td);
    shard(c, bx, by, tx, ty, r, k === 3 ? CRYSTAL_DARK : CRYSTAL);
  });
  // The lower jaw, dropped open to breathe.
  c.part();
  const [j0x, j0y] = at(-2, 5);
  const [j1x, j1y] = at(15, 6 + jaw);
  c.capsule(j0x, j0y, j1x, j1y, 4.2, 2.4, HIDE);
  if (jaw > 2) {
    // The glowing maw and its teeth.
    c.part();
    const [m0x, m0y] = at(2, 3 + jaw * 0.3);
    const [m1x, m1y] = at(13, 3 + jaw * 0.6);
    c.capsule(m0x, m0y, m1x, m1y, 2.6 + jaw * 0.15, 1.4 + jaw * 0.2, MAW);
    for (let k = 0; k < 4; k++) {
      const [tx, ty] = at(5 + k * 3, 1.5);
      c.px(tx, ty, TOOTH);
      const [bx, by] = at(5 + k * 3, 4 + jaw * 0.8);
      c.px(bx, by, TOOTH);
    }
  }
  // The skull and the snout.
  c.part();
  const [sx, sy] = at(0, 0);
  c.ellipse(sx, sy, 9.5, 7.5, HIDE);
  c.part();
  const [n0x, n0y] = at(4, 0.5);
  const [n1x, n1y] = at(18, 2.5);
  c.capsule(n0x, n0y, n1x, n1y, 5.8, 3.6, HIDE);
  // Brow ridge and a spine of crystal down the nose.
  c.part();
  const [b0x, b0y] = at(-1, -5);
  const [b1x, b1y] = at(8, -4.2);
  c.capsule(b0x, b0y, b1x, b1y, 2.2, 1.6, HIDE);
  for (let k = 0; k < 3; k++) {
    c.part();
    const [kx, ky] = at(10 + k * 3, -1.5 + k * 0.4);
    const [tx, ty] = at(9 + k * 3, -5 + k * 0.4);
    shard(c, kx, ky, tx, ty, 1, CRYSTAL_DARK, false);
  }
  // The eye: a blazing slit under the brow.
  c.part();
  const [ex, ey] = at(5, -2);
  const fierce = mood !== 'idle';
  c.px(ex, ey, EYE);
  c.px(ex + 1, ey, EYE);
  c.px(ex + 2, ey + (fierce ? 0 : 1), EYE);
  c.spark(ex + 1, ey, AMETHYST_HOT, 1);
  c.spark(ex + 2, ey - 1, AMETHYST, 0.6);
  // Nostrils smoking with light.
  const [nx, ny] = at(17, 0.5);
  c.spark(nx, ny, AMETHYST, 0.7);
  if (mood === 'rear' || mood === 'breath') {
    const R = rng(mood.length * 7);
    for (let k = 0; k < 8; k++) {
      const [px, py] = at(19 + R() * 10, -2 + R() * 8);
      c.spark(px, py, k % 2 ? AMETHYST : AMETHYST_HOT, 0.3 + R() * 0.5);
    }
  }
}

export function buildWyrmSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3, 4, 5].forEach((i) => (poses[`idle${i}`] = () => wyrm({ t: i / 6, mood: 'idle' })));
  poses.rear = () => wyrm({ t: 0.2, mood: 'rear' });
  poses.breath = () => wyrm({ t: 0.5, mood: 'breath' });
  poses.slam = () => wyrm({ t: 0, mood: 'slam' });
  poses.dive = () => wyrm({ t: 0, mood: 'dive' });
  return sheet(MONSTER_FRAME.wyrm, poses, [{ name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3', 'idle4', 'idle5'], fps: 6, loop: true }]);
}

// ---------------------------------------------------------------- Spells

export const BREATH_SHARD = 9;

/** One shard of the wyrm's breath: a small bright crystal dart. */
export function breathShard(): PixelCanvas {
  const c = new PixelCanvas(BREATH_SHARD, BREATH_SHARD);
  c.part();
  shard(c, 1, 4.5, 8, 4.5, 1.8, CRYSTAL);
  return c;
}
