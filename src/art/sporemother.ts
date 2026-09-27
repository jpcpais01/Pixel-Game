// The Sporemother, the Glimmerdeep's Legend: a mushroom as tall as two
// heroes, mother of every glowing thing in the cave. Her cap is a great bell
// of magenta honeycomb, its ridges pricked with light; under its rim two
// cold eyes shine out of the shadow. From below the cap hangs her veil, a
// skirt of glowing lace down to the floor, and through it her pale stem;
// two long root-tendrils hang at her sides, and her roots spread over the
// ground round her, knotted with glowing nodules. She never walks: she
// glides on her roots (the game moves her; the frames only breathe and sway).

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, cyl, hex, sphere, FLAT, type Material, type RGB } from './pixel';
import { rng } from './env';

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#0a0410');
const WHITE = hex('#ffffff');
const CYAN = hex('#5ae4ff');
const MAGENTA = hex('#ff6ad8');
const PINK = hex('#ffb0ec');

const CAP: Material = { ramp: ramp('#1e0626', '#340c40', '#50145e', '#721e80', '#9a2ea4', '#c84cc4', '#f07ae0'), outline: INK, outlineLit: hex('#2e0a38'), emissive: 0.22 };
const STEM: Material = { ramp: ramp('#2a2a40', '#3e3e5a', '#58587a', '#76769a', '#9898bc', '#c4c4e0'), outline: INK, outlineLit: hex('#1e1e30') };
const lace = (k: number): Material => ({ ramp: ramp('#5a9ab8', '#9ad8ec', '#d8f8ff', '#ffffff'), outline: INK, emissive: 0.5 + k * 0.3, noAO: true, noOutline: true });
const ROOT: Material = { ramp: ramp('#140a14', '#22121e', '#341c2c', '#48283a', '#5e364a'), outline: INK, outlineLit: hex('#26141e') };
const GILL: Material = { ramp: ramp('#3a0a3a', '#a0309a', '#ff7ae0'), outline: INK, emissive: 0.8, noAO: true };
const EYE: Material = { ramp: ramp('#8af0ff', '#f4ffff'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const SHADOW: Material = { ramp: ramp('#07040c', '#0e0816'), outline: INK, noAO: true, noOutline: true };
const NODULE: Material = { ramp: ramp('#a0309a', '#ff7ae0', '#ffd0f4'), outline: INK, emissive: 1, noAO: true };

/** Particle tints for her bursts: magenta, pink, cyan and white spores. */
export const SPOREMOTHER_TINTS = [0xff6ad8, 0xffb0ec, 0x5ae4ff, 0xf4ffff];

const CX = 42;
const FOOT = 93;

type Mood = 'idle' | 'cast' | 'plunge';

interface MotherPose {
  /** 0..1 phase of her breathing. */
  t: number;
  mood: Mood;
  /** 0..1 how brightly she burns. */
  flare?: number;
}

/** A root-tendril: a tapering chain of segments through the given points. */
function tendril(c: PixelCanvas, pts: [number, number][], r0: number, r1: number, glow: number): void {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    c.capsule(x0, y0, x1, y1, r0 + ((r1 - r0) * i) / n, r0 + ((r1 - r0) * (i + 1)) / n, ROOT);
  }
  const [tx, ty] = pts[n];
  c.ellipse(tx, ty, 1.6, 1.6, NODULE);
  c.spark(tx, ty, WHITE, glow);
}

function sporemother(p: MotherPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.sporemother;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const flare = p.flare ?? 0;
  const R = rng(Math.round(p.t * 997) + p.mood.length * 31);
  const breathe = Math.sin(tau) * 1.2;
  const sway = Math.sin(tau + 0.8) * 1.4;
  const lift = p.mood === 'cast' ? -3 : p.mood === 'plunge' ? 3 : 0;

  // Her roots, spreading over the floor round her.
  c.part();
  c.ellipse(CX, FOOT - 3, 28, 4.2, ROOT, { flatten: 0.5 });
  const roots: [number, number, number][] = [[-1, 38, 2], [1, 37, 1], [-1, 26, 5], [1, 28, 5], [-1, 16, 7], [1, 18, 6]];
  for (const [side, reach, dy] of roots) {
    c.part();
    const ex = CX + side * reach;
    const ey = FOOT - 2 + (dy > 4 ? -2 : 0) + Math.sin(tau + reach) * 0.5;
    c.capsule(CX + side * 12, FOOT - 4, ex, ey, 2.4, 0.8, ROOT);
    c.spark(ex, ey, MAGENTA, 0.5);
  }
  for (let k = 0; k < 9; k++) {
    c.part();
    const x = CX - 24 + R() * 48;
    c.ellipse(x, FOOT - 3 + R() * 2, 1, 0.9, NODULE);
  }

  // The stem, pale, rising under the veil.
  c.part();
  const capRim = 46 + lift + Math.round(breathe * 0.5);
  c.shape(capRim - 2, FOOT - 4, (y) => {
    const u = (y - capRim) / (FOOT - 4 - capRim);
    const hw = 7.5 + Math.max(0, u) * u * 3.5;
    const x = CX + sway * (1 - Math.max(0, u)) * 0.5;
    return [x - hw, x + hw];
  }, STEM, (_x, _y, t) => cyl(t, 0.1));
  // The face, in the shadow under the cap.
  c.part();
  const fy = capRim + 5;
  const fx = CX + 2 + sway * 0.4;
  c.shape(capRim - 1, fy + 5, (y) => {
    const hw = 6.6 - (y - capRim) * 0.1;
    return [fx - 2 - hw, fx - 2 + hw];
  }, SHADOW, () => FLAT);
  const glare = p.mood !== 'idle';
  for (const ex of [fx - 5, fx + 1]) {
    c.px(ex, fy, EYE);
    c.px(ex + 1, fy, EYE);
    if (glare) {
      c.px(ex, fy + 1, EYE);
      c.px(ex + 1, fy + 1, EYE);
    } else c.px(ex + 1, fy + 1, EYE);
    c.spark(ex + 0.5, fy, CYAN, 0.8 + flare * 0.2);
  }
  if (glare) for (let x = -3; x <= 1; x++) c.px(fx + x, fy + 4, EYE);

  // Her veil: a bell of glowing lace hanging from under the cap to the floor.
  c.part();
  const veilTop = fy + 6;
  const veilBot = FOOT - 5;
  const shift = Math.floor(p.t * 6);
  const L = lace(flare);
  for (let y = veilTop; y <= veilBot; y++) {
    const u = (y - veilTop) / (veilBot - veilTop);
    const hw = 11 + u * 15 + Math.sin(u * 3 + tau) * 1.2;
    const x0 = CX + sway * (1 - u) * 0.6 - hw;
    const x1 = CX + sway * (1 - u) * 0.6 + hw;
    const hem = y > veilBot - 3;
    for (let x = Math.round(x0); x < Math.round(x1); x++) {
      // A net of diamonds, pulled wider toward the hem.
      const k = 5 + Math.round(u * 2);
      const a = (((x + y + shift) % k) + k) % k;
      const b = (((x - y - shift) % k) + k) % k;
      const edge = x === Math.round(x0) || x === Math.round(x1) - 1;
      if (a === 0 || b === 0 || edge || (hem && (x + y) % 3 !== 0)) {
        const lit = x < CX ? 1 : 0;
        c.px(x, y, L, { x: (x - CX) / (hw * 1.4), y: 0.2, z: 0.9 }, { bias: lit - (u > 0.8 ? 0 : 1) });
      }
    }
    // Scalloped hem with beads of light.
    if (hem && y === veilBot) for (let x = Math.round(x0); x < x1; x += 4) c.spark(x, y + 1, PINK, 0.6);
  }

  // Tendrils at her sides.
  c.part();
  for (const side of [-1, 1]) {
    const sx = CX + side * 20;
    const sy = capRim - 1;
    let pts: [number, number][];
    if (p.mood === 'cast') pts = [[sx, sy], [sx + side * 8, sy - 10], [sx + side * 10, sy - 24], [sx + side * 6, sy - 34 + Math.sin(tau) * 2]];
    else if (p.mood === 'plunge') pts = [[sx, sy], [sx + side * 9, sy + 12], [sx + side * 13, sy + 28], [sx + side * 14, FOOT - 1]];
    else pts = [[sx, sy], [sx + side * 5, sy + 12 + sway * side * 0.5], [sx + side * 6, sy + 26], [sx + side * 3 + Math.sin(tau + side) * 2, sy + 36]];
    tendril(c, pts, 2.8, 1.2, 0.6 + flare * 0.4);
  }

  // Gills glowing under the rim.
  c.part();
  const capTop = 5 + lift + Math.round(breathe * 0.3);
  const rimHW = 30 + (p.mood === 'cast' ? 3 : 0);
  c.shape(capRim - 3, capRim, (y) => {
    const u = (y - (capRim - 3)) / 3;
    const hw = rimHW - 2 - u * 10;
    return [CX + sway * 0.3 - hw, CX + sway * 0.3 + hw];
  }, GILL, (x) => ((x - CX) % 2 === 0 ? { x: 0, y: -0.3, z: 0.7 } : { x: 0, y: -0.7, z: 0.6 }));

  // The cap: a great bell of honeycomb.
  c.part();
  const top = capTop;
  const bot = capRim - 2;
  c.shape(top, bot, (y) => {
    const u = (y - top) / (bot - top);
    const hw = 5 + Math.pow(Math.sin(Math.min(1, u * 1.05) * Math.PI * 0.5), 0.8) * (rimHW - 5) + (u > 0.9 ? 1 : 0);
    const x = CX + sway * 0.3 * (1 - u) + sway * 0.3;
    return [x - hw, x + hw];
  }, CAP, (x, y, t) => {
    const u = (y - top) / (bot - top);
    // Honeycomb: pits sunk between ridges.
    const row = Math.floor(y / 6);
    const off = (row % 2) * 3.5;
    const lx = ((x + off) % 7) - 3.5;
    const ly = (y % 6) - 3;
    const pit = Math.hypot(lx, ly * 1.1) < 2.3;
    const base = sphere(t * 0.95, u * 1.6 - 1, 0.9);
    return pit ? { x: base.x - lx * 0.2, y: base.y + ly * 0.2, z: base.z * 0.8 } : base;
  });
  // Deepen the pits, and set light at the ridges' crossings.
  for (let y = top + 2; y <= bot; y++) {
    const row = Math.floor(y / 6);
    const off = (row % 2) * 3.5;
    for (let x = CX - rimHW; x <= CX + rimHW; x++) {
      if (!c.filled(x, y)) continue;
      const lx = ((x + off) % 7) - 3.5;
      const ly = (y % 6) - 3;
      if (Math.hypot(lx, ly * 1.1) < 2.3) c.shade(x, y, -2);
      else if (Math.abs(lx) > 3 && ly === -3 && ((x + y) % 3 === 0)) c.spark(x, y, (x + row) % 2 ? MAGENTA : CYAN, 0.45 + flare * 0.4);
    }
  }
  // The rim curls under, lit along its edge.
  for (let x = -rimHW; x <= rimHW; x++) c.shade(CX + x + sway * 0.3, bot, -1);
  c.spark(CX - 12, top + 6, WHITE, 0.5);

  // Spores drifting off her, a cloud of them when she casts.
  const n = p.mood === 'cast' ? 22 : 8;
  for (let k = 0; k < n; k++) {
    const a = R() * Math.PI * 2;
    const d = (p.mood === 'cast' ? 20 : 26) + R() * 14;
    c.spark(CX + Math.cos(a) * d, capRim - 14 + Math.sin(a) * d * 0.8, k % 3 ? MAGENTA : k % 2 ? CYAN : PINK, 0.3 + R() * 0.5);
  }
  return c;
}

export function buildSporemotherSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3, 4, 5].forEach((i) => (poses[`idle${i}`] = () => sporemother({ t: i / 6, mood: 'idle' })));
  poses.cast0 = () => sporemother({ t: 0.1, mood: 'cast', flare: 0.6 });
  poses.cast1 = () => sporemother({ t: 0.45, mood: 'cast', flare: 1 });
  poses.cast2 = () => sporemother({ t: 0.8, mood: 'cast', flare: 0.8 });
  poses.plunge0 = () => sporemother({ t: 0.2, mood: 'plunge', flare: 0.6 });
  poses.plunge1 = () => sporemother({ t: 0.7, mood: 'plunge', flare: 1 });
  return sheet(MONSTER_FRAME.sporemother, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3', 'idle4', 'idle5'], fps: 6, loop: true },
    { name: 'cast', frames: ['cast0', 'cast1', 'cast2', 'cast1'], fps: 8, loop: true },
    { name: 'plunge', frames: ['plunge0', 'plunge1'], fps: 6, loop: true },
  ]);
}
