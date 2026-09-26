// Elementinho, the Elementinho Temple's Legend: a giant drop of water in
// shape, but made all of fire. Its skin runs deep crimson to orange, a
// hotter drop burns inside it, and at its heart a white-hot core; flames
// stream upward through it, and its tip is a living flame that never stops
// dancing. A drop's glint shines on its brow, as if it were still water.
// Fierce eyes with white-hot pupils, angry brows and a crooked grin. It has
// no feet: it floats (the game bobs it; the frames only sway and flicker).

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, hex, sphere, FLAT, type Material, type RGB } from './pixel';
import { rng } from './env';

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#1a0402');

const OUTER = (k: number): Material => ({ ramp: ramp('#4a0806', '#7a1208', '#b0240a', '#e0460e', '#ff7a1c', '#ffae3a'), outline: INK, outlineLit: hex('#5a0e06'), emissive: 0.55 + k * 0.2 });
const MID = (k: number): Material => ({ ramp: ramp('#c8420c', '#f06a14', '#ff9a26', '#ffc446', '#ffe07a'), outline: INK, emissive: 0.7 + k * 0.2, noAO: true, noOutline: true, bias: -1 });
const CORE = (k: number): Material => ({ ramp: ramp('#ffa838', '#ffc450', '#ffd870', '#ffe89a', '#fff4c8'), outline: INK, emissive: 0.85 + k * 0.1, noAO: true, noOutline: true, bias: -1 });
const TONGUE = (k: number): Material => ({ ramp: ramp('#8a1408', '#d0380c', '#ff6a18', '#ffa032', '#ffd060'), outline: INK, emissive: 0.8 + k * 0.2, noAO: true, noOutline: true });
const TIP = (_k: number): Material => ({ ramp: ramp('#ff6a18', '#ffa030', '#ffd060', '#fff0a8', '#ffffff'), outline: INK, emissive: 1, noAO: true, noOutline: true });
const HOLLOW: Material = { ramp: ramp('#1a0402', '#2a0804'), outline: INK, noAO: true, noOutline: true };
const GLINT: Material = { ramp: ramp('#fff4d0', '#ffffff'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const THROAT: Material = { ramp: ramp('#ff6a14', '#ffb040', '#ffe890'), outline: INK, emissive: 1, noAO: true, noOutline: true };

const EMBER = hex('#ffb040');
const HOT = hex('#fff0b0');
const RED = hex('#ff5a1a');

/** Particle tints for Elementinho's bursts: white-hot, gold, orange and red. */
export const ELEMENTINHO_TINTS = [0xfff4d0, 0xffc44a, 0xff8a1c, 0xff4a1a];

const CX = 40;
const BOTTOM = 89;

type Mood = 'idle' | 'cast' | 'squash' | 'surge' | 'spit';

interface DropPose {
  /** 0..1 phase of the flicker. */
  t: number;
  mood: Mood;
  /** 0..1 burning hotter. */
  flare?: number;
}

/** A drop's outline, bottom-centred at (cx, bottom): round below, curving in to a point on top. */
function dropEdges(cx: number, bottom: number, r: number, height: number, shear: (v: number) => number) {
  const cy = bottom - r;
  const tip = bottom - height;
  return (y: number): [number, number] | null => {
    const yy = y + 0.5;
    if (yy < tip || yy > bottom) return null;
    let hw: number;
    if (yy >= cy) {
      const d = (yy - cy) / r;
      hw = r * Math.sqrt(Math.max(0, 1 - d * d));
    } else {
      const v = (yy - tip) / (cy - tip);
      hw = r * Math.pow(Math.sin((v * Math.PI) / 2), 1.5);
    }
    const x = cx + shear((yy - tip) / height);
    return [x - hw, x + hw];
  };
}

function elementinho(p: DropPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.elementinho;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const flare = p.flare ?? 0;
  const R0 = rng(Math.round(p.t * 1000) + p.mood.length * 7919);

  // How the drop is pulled about: swollen to cast, squashed to spring, streaming back as it surges.
  const sx = p.mood === 'cast' ? 1.07 : p.mood === 'squash' ? 1.2 : p.mood === 'surge' ? 0.9 : p.mood === 'spit' ? 1.1 : 1;
  const sy = p.mood === 'cast' ? 1.05 : p.mood === 'squash' ? 0.8 : p.mood === 'surge' ? 0.92 : p.mood === 'spit' ? 0.94 : 1;
  const R = 21.5 * sx;
  const HGT = 71 * sy;
  const tip = BOTTOM - HGT;
  const cy = BOTTOM - R;
  const trail = p.mood === 'surge' ? -13 : p.mood === 'squash' ? -3 : 0;
  // The flame at its tip sways; the whole top leans with it.
  const sway = Math.sin(tau) * 1.6;
  const shear = (v: number) => (1 - v) * (sway + trail) * (1 - v * 0.4);

  // Tongues of flame streaming up behind it, off its shoulders.
  const tongues: [number, number, number, number][] = [
    [-16, 0.6, 15, -3],
    [15, 0.62, 13, -2],
    [-11, 0.4, 12, -4],
    [9, 0.38, 11, -3],
    [-19, 0.8, 10, -2],
    [19, 0.82, 9, -1],
  ];
  tongues.forEach(([ox, at, len, lean], i) => {
    c.part();
    const by = tip + HGT * at;
    const bx = CX + ox * sx + shear(at);
    const fl = len * (1 + flare * 0.3) + Math.sin(tau * 2 + i * 1.9) * 2.5 + (p.mood === 'cast' ? 4 : 0);
    const top = by - fl;
    const ln = lean + trail * 0.5 + Math.sin(tau + i) * 1.5;
    c.shape(Math.round(top), Math.round(by + 2), (y) => {
      const u = Math.max(0, (y - top) / (by + 2 - top));
      const hw = 0.3 + Math.sin(Math.min(1, u) * Math.PI * 0.6) * (3.2 - (i % 2) * 0.6);
      const x = bx + ln * (1 - u) * (1 - u) + Math.sin(u * 5 + tau * 2 + i) * 0.7 * (1 - u);
      return [x - hw, x + hw];
    }, TONGUE(flare), () => FLAT);
    c.spark(bx + ln - 0.5, top - 2 - (i % 3), i % 2 ? EMBER : HOT, 0.6);
  });

  // The flame at the very tip: a drop's point that has caught fire.
  c.part();
  const flameH = 14 + Math.sin(tau * 2) * 2.5 + flare * 4 + (p.mood === 'cast' ? 6 : 0);
  const ft = tip - flameH;
  c.shape(Math.round(ft), Math.round(tip + 8), (y) => {
    const u = Math.max(0, (y - ft) / (tip + 8 - ft));
    const hw = 0.2 + Math.sin(Math.min(1, u) * Math.PI * 0.5) * 4.2;
    const x = CX + shear(0) + (sway * 1.8 + trail * 0.6) * (1 - u) * (1 - u) + Math.sin(u * 6 + tau * 3) * 0.8 * (1 - u);
    return [x - hw, x + hw];
  }, TIP(flare), (_x, _y, t) => ({ x: t * 0.6, y: 0.2, z: 0.75 }), { bias: -1 });
  for (let k = 0; k < 4; k++) c.spark(CX + shear(0) + sway * 2 + (R0() - 0.5) * 8 + trail * 0.6, ft - 2 - R0() * 6, k % 2 ? EMBER : HOT, 0.4 + R0() * 0.4);

  // The drop itself.
  c.part();
  const outer = dropEdges(CX, BOTTOM, R, HGT, shear);
  c.shape(Math.floor(tip), BOTTOM, outer, OUTER(flare), (_x, y, t) => sphere(t * 0.92, Math.max(-0.8, Math.min(1, (y + 0.5 - cy) / (R * 1.3))) * 0.8));
  // Flames running up through its skin.
  for (let y = Math.floor(tip); y <= BOTTOM; y++) {
    const e = outer(y);
    if (!e) continue;
    for (let x = Math.round(e[0]); x < Math.round(e[1]); x++) {
      const f = Math.sin(x * 0.45 + Math.sin(y * 0.22 - tau * 2) * 2.2) * Math.cos(y * 0.3 + tau * 3 + x * 0.1);
      if (f > 0.55) c.shade(x, y, 1);
      else if (f < -0.6) c.shade(x, y, -1);
    }
  }

  // A hotter drop burning inside it.
  c.part();
  const midR = R * 0.72;
  const mid = dropEdges(CX + 1, BOTTOM - 4, midR, HGT * 0.66, (v) => shear(0.34 + v * 0.66) * 0.8);
  c.shape(Math.floor(BOTTOM - 4 - HGT * 0.66), BOTTOM - 4, mid, MID(flare), (_x, y, t) => sphere(t * 0.8, Math.max(-0.8, Math.min(1, (y + 0.5 - (BOTTOM - 4 - midR)) / (midR * 1.4))) * 0.7));
  for (let y = Math.floor(BOTTOM - 4 - HGT * 0.66); y <= BOTTOM - 4; y++) {
    const e = mid(y);
    if (!e) continue;
    for (let x = Math.round(e[0]); x < Math.round(e[1]); x++) {
      const f = Math.sin(x * 0.6 - Math.sin(y * 0.28 - tau * 3) * 2) * Math.cos(y * 0.4 + tau * 4);
      if (f > 0.6) c.shade(x, y, 1);
    }
  }
  // Its white-hot heart.
  c.part();
  const coreY = BOTTOM - R * 0.5;
  const coreS = 1 + Math.sin(tau * 2) * 0.06 + flare * 0.15;
  c.ellipse(CX + 1 + shear(0.9) * 0.5, coreY, R * 0.3 * coreS, R * 0.26 * coreS, CORE(flare));
  for (let k = 0; k < 5; k++) c.spark(CX + 1 + (R0() - 0.5) * R * 0.45, coreY + (R0() - 0.5) * R * 0.35, HOT, 0.4 + R0() * 0.4);

  // A drop's glint on its brow, as if it were still water.
  c.part();
  const gx = CX - R * 0.6 + shear(0.55);
  const gy = cy - R * 0.75;
  for (let k = 0; k <= 6; k++) {
    const a = Math.PI * (1.02 + k * 0.075);
    c.px(Math.round(gx + Math.cos(a) * 5.5 + 5), Math.round(gy + Math.sin(a) * 7 + 7), GLINT);
    if (k > 1 && k < 5) c.px(Math.round(gx + Math.cos(a) * 4.5 + 5.5), Math.round(gy + Math.sin(a) * 6 + 7), GLINT);
  }
  c.px(Math.round(gx + 4.5), Math.round(gy - 2), GLINT);
  c.px(Math.round(gx + 5.5), Math.round(gy - 2), GLINT);

  // The face: fierce eyes with white-hot pupils, angry brows and a crooked grin.
  c.part();
  const fy = cy - 5 + (p.mood === 'squash' ? 2 : 0);
  const fx = CX + 3 + shear(0.72) + (p.mood === 'surge' ? 3 : 0);
  const eyes = [fx - 5, fx + 7];
  eyes.forEach((ex, i) => {
    const ry = p.mood === 'squash' ? 2.6 : 3.6;
    c.ellipse(ex, fy, 2.7, ry, HOLLOW);
    // Pupils look ahead, blazing.
    c.px(ex + 1, fy - 1, GLINT);
    c.px(ex + 1, fy, GLINT);
    c.spark(ex + 1, fy - 1, HOT, 0.7 + flare * 0.3);
    if (p.mood !== 'idle') c.px(ex, fy - 1, GLINT);
    // Brows slanting down toward the middle.
    const inner = i === 0 ? 1 : -1;
    for (let k = -3; k <= 3; k++) {
      const by = fy - ry - 1.5 - (k * inner + 3) * -0.45 - (p.mood === 'cast' ? 1 : 0);
      c.px(Math.round(ex + k), Math.round(by), HOLLOW);
      c.px(Math.round(ex + k), Math.round(by) - 1, HOLLOW);
    }
  });
  const my = fy + 9;
  const mx = fx + 1;
  if (p.mood === 'cast' || p.mood === 'spit') {
    // Mouth wide open on the furnace inside.
    const o = p.mood === 'spit' ? 1.2 : 1;
    c.ellipse(mx, my, 3.4 * o, 4 * o, HOLLOW);
    c.ellipse(mx, my + 1, 2 * o, 2.4 * o, THROAT);
    c.spark(mx, my + 1, HOT, 1);
  } else if (p.mood === 'squash' || p.mood === 'surge') {
    // Teeth gritted.
    for (let x = -5; x <= 5; x++) {
      c.px(mx + x, my, HOLLOW);
      c.px(mx + x, my + 2, HOLLOW);
      if (x % 2 === 0) c.px(mx + x, my + 1, HOLLOW);
      else c.px(mx + x, my + 1, THROAT);
    }
  } else {
    // A crooked grin, curling up at one end, with a fang.
    for (let x = -5; x <= 5; x++) {
      const y = my - Math.round((x * x) * 0.06 + (x > 0 ? x * 0.12 : 0));
      c.px(mx + x, y, HOLLOW);
      if (Math.abs(x) < 4) c.px(mx + x, y + 1, HOLLOW);
    }
    c.px(mx + 2, my, GLINT);
    c.spark(mx - 1, my + 1, RED, 0.8);
  }

  // Embers flying off it.
  for (let k = 0; k < 9; k++) {
    const a = R0() * Math.PI * 2;
    const d = R * (1.05 + R0() * 0.35);
    c.spark(CX + Math.cos(a) * d, cy - 8 + Math.sin(a) * d * 1.2, k % 3 ? EMBER : HOT, 0.35 + R0() * 0.45);
  }
  if (p.mood === 'surge') {
    // Streaming back: a wake of fire behind it.
    for (let k = 0; k < 16; k++) c.spark(CX - R - 2 - R0() * 12, cy - 10 + (R0() - 0.5) * R * 1.6, k % 2 ? EMBER : RED, 0.3 + R0() * 0.5);
  }
  return c;
}

export function buildElementinhoSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3, 4, 5].forEach((i) => (poses[`idle${i}`] = () => elementinho({ t: i / 6, mood: 'idle' })));
  poses.cast0 = () => elementinho({ t: 0.1, mood: 'cast', flare: 0.6 });
  poses.cast1 = () => elementinho({ t: 0.45, mood: 'cast', flare: 1 });
  poses.cast2 = () => elementinho({ t: 0.8, mood: 'cast', flare: 0.8 });
  poses.spit = () => elementinho({ t: 0.3, mood: 'spit', flare: 1 });
  poses.squash0 = () => elementinho({ t: 0.2, mood: 'squash', flare: 0.5 });
  poses.squash1 = () => elementinho({ t: 0.7, mood: 'squash', flare: 1 });
  poses.surge0 = () => elementinho({ t: 0.25, mood: 'surge', flare: 1 });
  poses.surge1 = () => elementinho({ t: 0.75, mood: 'surge', flare: 1 });
  return sheet(MONSTER_FRAME.elementinho, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3', 'idle4', 'idle5'], fps: 9, loop: true },
    { name: 'cast', frames: ['cast0', 'cast1', 'cast2', 'cast1'], fps: 10, loop: true },
    { name: 'squash', frames: ['squash0', 'squash1'], fps: 12, loop: true },
    { name: 'surge', frames: ['surge0', 'surge1'], fps: 14, loop: true },
  ]);
}

// ---------------------------------------------------------------- Spells

export const EMBER_W = 9;
export const EMBER_H = 13;

/** A burning droplet Elementinho flings up to rain down: a little drop of fire. Pure light. */
export function emberDrop(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(EMBER_W * EMBER_H * 4);
  const edges = dropEdges(4.5, 12.5, 4, 12, () => 0);
  const cols: RGB[] = [hex('#fffbe8'), hex('#ffe07a'), hex('#ffa032'), hex('#ff6a18'), hex('#c02a0a')];
  for (let y = 0; y < EMBER_H; y++) {
    const e = edges(y);
    if (!e) continue;
    for (let x = 0; x < EMBER_W; x++) {
      const cx = x + 0.5;
      if (cx < e[0] || cx > e[1]) continue;
      const d = Math.hypot((cx - 4.8) / 4, (y + 0.5 - 8.8) / 5);
      const c = cols[Math.min(4, Math.floor(d * 3.4))];
      const i = (y * EMBER_W + x) * 4;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    }
  }
  return px;
}

export const BLAZE_W = 22;
export const BLAZE_H = 16;
export const BLAZE_FRAMES = 4;

/** Flames left burning on the floor: a few tongues licking up from a glowing bed. Pure light. */
export function blazeFrame(f: number): Uint8ClampedArray {
  const W = BLAZE_W;
  const H = BLAZE_H;
  const px = new Uint8ClampedArray(W * H * 4);
  const tau = (f / BLAZE_FRAMES) * Math.PI * 2;
  const cols: RGB[] = [hex('#fff4c8'), hex('#ffd060'), hex('#ff9a26'), hex('#e0460e'), hex('#801808')];
  const put = (x: number, y: number, k: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const c = cols[Math.max(0, Math.min(4, k))];
    const i = (y * W + x) * 4;
    if (px[i + 3] && px[i] + px[i + 1] > c[0] + c[1]) return;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  // The glowing bed.
  for (let y = 11; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x + 0.5 - W / 2) / (W / 2), (y + 0.5 - 13) / 3);
      if (d < 1) put(x, y, Math.floor(1.5 + d * 3 + (Math.sin(x * 1.3 + tau) > 0.6 ? -1 : 0)));
    }
  }
  // Tongues.
  [[5, 7], [10, 11], [15, 8], [8, 5], [13, 6]].forEach(([bx, hh], i) => {
    const fh = hh + Math.sin(tau + i * 1.7) * 2;
    for (let y = 0; y < fh; y++) {
      const u = y / fh;
      const hw = (1 - u) * 1.8 + 0.3;
      const x0 = bx + Math.sin(tau * 1 + i + u * 4) * 1.2 * u;
      for (let x = Math.floor(x0 - hw); x <= Math.ceil(x0 + hw); x++) {
        if (Math.abs(x + 0.5 - x0) > hw) continue;
        put(x, 12 - y, Math.floor(u * 3.5 + Math.abs(x + 0.5 - x0) / hw));
      }
    }
  });
  return px;
}
