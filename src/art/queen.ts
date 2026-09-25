// The Hollow Queen, the Spirit Dungeon's Legend: a spirit twice a hero's
// height. A crown of bone spires burning with cold flame, a veil streaming
// behind her like smoke under water, and under the hood only dark and two
// burning eyes. Her gown fades from deep night-blue to a pale spectral
// panel, its hem dissolving into tendrils; a soul-locket glows at her
// breast and broken chains hang from her wrists. She has no feet: she
// floats (the game bobs her; the frames only sway).

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, cyl, hex, sphere, FLAT, type Material, type RGB } from './pixel';

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#03040a');

const VEIL: Material = { ramp: ramp('#101628', '#1a2440', '#28385c', '#3c5480', '#5c7ea8'), outline: INK, emissive: 0.2, noAO: true };
const GOWN: Material = { ramp: ramp('#070a16', '#0e1426', '#172040', '#22305a', '#304478'), outline: INK, outlineLit: hex('#18223e') };
const PANEL: Material = { ramp: ramp('#2a4a66', '#447094', '#6aa0c0', '#a0d4e4', '#dcfaff'), outline: INK, emissive: 0.35, noAO: true };
const BONE: Material = { ramp: ramp('#3e4652', '#68727e', '#98a2ac', '#cad2d8', '#f0f6f8'), outline: hex('#0a0c12'), shine: true };
const TENDRIL: Material = { ramp: ramp('#0c1426', '#16244a', '#243a68', '#36568c'), outline: INK, emissive: 0.25, noAO: true };
const HOLLOW: Material = { ramp: ramp('#020308', '#05070e'), outline: INK, noAO: true, noOutline: true };
const EYE: Material = { ramp: ramp('#7af8e4', '#ffffff'), outline: INK, emissive: 1, noAO: true };
const CHAIN: Material = { ramp: ramp('#3a4656', '#6a7a8c', '#a4b4c4', '#dce8f0'), outline: INK, emissive: 0.15, shine: true };
const locket = (k: number): Material => ({ ramp: ramp('#2ab8a8', '#7af4e0', '#d4fff6', '#ffffff'), outline: hex('#062a2a'), emissive: 0.8 + k * 0.2, noAO: true });

const TEAL = hex('#6af4dc');
const WHITE = hex('#eafffa');
const BLUE = hex('#8ac8ff');
const LILAC = hex('#c8b0ff');

/** Particle tints for the Queen's bursts: ghost-white, teal, pale blue and lilac. */
export const QUEEN_TINTS = [0xeafffa, 0x6af4dc, 0x8ac8ff, 0xc8b0ff];

type Arms = 'rest' | 'summon' | 'scream';

interface QueenPose {
  /** 0..1 phase of the idle sway. */
  t: number;
  arms: Arms;
  /** 0..1 the crown's flames, eyes and locket burning brighter. */
  flare?: number;
}

const CX = 36;

/** Elbow and wrist for the arm on `side` (-1 left, 1 right). */
function arm(a: Arms, side: number, t: number): { ex: number; ey: number; wx: number; wy: number } {
  const sway = Math.sin(t * Math.PI * 2 + side) * 0.7;
  switch (a) {
    case 'rest':
      return { ex: CX + side * 10, ey: 34 + sway, wx: CX + side * 12, wy: 44 + sway };
    case 'summon':
      return { ex: CX + side * 16, ey: 31, wx: CX + side * 24, wy: 37 };
    case 'scream':
      return { ex: CX + side * 15, ey: 20, wx: CX + side * 23, wy: 9 };
  }
}

function queen(p: QueenPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.queen;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const flare = p.flare ?? 0;
  const lift = p.arms === 'scream' ? 1 : 0;

  // The veil, streaming back from her head.
  for (let k = 0; k < 3; k++) {
    c.part();
    const sway = Math.sin(tau + k * 0.9) * 2;
    const x0 = CX - 3 - k;
    const y0 = 11 + k * 2;
    const mx = CX - 13 - k * 3 - sway * 0.5;
    const my = 30 + k * 6 - lift * 12;
    const x1 = CX - 24 - k * 2 - sway;
    const y1 = 52 + k * 7 - lift * 26;
    c.capsule(x0, y0, mx, my, 5.5 - k, 4 - k * 0.6, VEIL);
    c.capsule(mx, my, x1, y1, 4 - k * 0.6, 1, VEIL);
    for (let j = 0; j < 3; j++) c.spark(x1 - j - sway * 0.3, y1 + (lift ? -j : j) + 1, j % 2 ? BLUE : WHITE, 0.4 - j * 0.1);
  }

  // Bone spires fanning up from her shoulders behind the head.
  for (const side of [-1, 1]) {
    c.part();
    c.capsule(CX + side * 7, 23, CX + side * 15, 7 - lift * 2, 1.6, 0.5, BONE);
    c.capsule(CX + side * 9, 24, CX + side * 20, 15 - lift * 2, 1.4, 0.5, BONE);
    c.spark(CX + side * 15, 6 - lift * 2, TEAL, 0.5 + flare * 0.5);
    c.spark(CX + side * 20, 14 - lift * 2, TEAL, 0.4 + flare * 0.4);
  }

  // Tendrils trailing from the hem.
  for (let i = 0; i < 6; i++) {
    c.part();
    const ox = -15 + i * 6;
    const sway = Math.sin(tau + i * 1.3) * 2.2;
    const len = 8 + (i % 2) * 3 + (i === 2 || i === 3 ? 2 : 0);
    const x0 = CX + ox;
    c.capsule(x0, 66, x0 + ox * 0.08 + sway * 0.5, 66 + len * 0.6, 3.4, 2.2, TENDRIL);
    c.capsule(x0 + ox * 0.08 + sway * 0.5, 66 + len * 0.6, x0 + ox * 0.14 + sway, 66 + len, 2.2, 0.6, TENDRIL);
    for (let k = 0; k < 3; k++) c.spark(x0 + ox * 0.14 + sway + Math.sin(tau * 1.5 + i + k) * k, 67 + len + k * 2, k % 2 ? BLUE : WHITE, 0.55 - k * 0.15);
  }

  // The gown, flaring from the waist.
  c.part();
  const hem = (y: number) => {
    const u = (y - 34) / 34;
    return 6 + Math.pow(Math.max(0, u), 1.3) * 17 + Math.sin(tau + y * 0.35) * 0.6 * u;
  };
  c.shape(34, 68, (y) => [CX - hem(y), CX + hem(y)], GOWN, (_x, _y, t) => cyl(t, 0.1));
  for (let y = 44; y <= 68; y++) for (const f of [-0.75, -0.45, 0.45, 0.75]) c.shade(CX + f * hem(y), y, -1);
  // The pale spectral panel down the front, and sigils glowing on it.
  c.part();
  c.shape(36, 68, (y) => {
    const u = (y - 36) / 32;
    const hw = 1.6 + u * 4.5;
    return [CX - hw, CX + hw];
  }, PANEL, (_x, _y, t) => cyl(t * 0.5, 0.1));
  for (const y of [42, 50, 58]) {
    c.spark(CX - 0.5, y, WHITE, 0.6 + flare * 0.3);
    c.spark(CX - 1.5, y + 1, TEAL, 0.4);
    c.spark(CX + 0.5, y + 1, TEAL, 0.4);
    c.spark(CX - 0.5, y + 2, TEAL, 0.3);
  }
  // The hem glows where it frays.
  for (let x = Math.round(CX - hem(68)); x < CX + hem(68); x++) c.spark(x, 68, (x & 1) ? TEAL : BLUE, 0.35);

  // The bodice.
  c.part();
  c.shape(21, 36, (y) => {
    const u = (y - 21) / 15;
    const hw = y < 24 ? 6 + (y - 21) * 0.6 : 7.8 - u * 2.6;
    return [CX - hw, CX + hw];
  }, GOWN, (_x, _y, t) => cyl(t, 0.2));
  for (let y = 25; y <= 35; y++) c.shade(CX, y, 1);
  // The soul-locket at her breast.
  c.part();
  c.ellipse(CX, 28.5, 2.3, 2.7, locket(flare));
  for (let i = 1; i <= 3 + flare * 3; i++) {
    const a = 1 - i / (5 + flare * 3);
    c.spark(CX - 0.5, 28.5 - 2.7 - i, WHITE, a * 0.6);
    c.spark(CX - 0.5, 28.5 + 2.7 + i, WHITE, a * 0.4);
    c.spark(CX - 2.3 - i, 28, TEAL, a * 0.4);
    c.spark(CX + 2.3 + i - 1, 28, TEAL, a * 0.4);
  }

  // Arms: tight sleeves to the elbow, then long bell sleeves, bony hands, broken chains.
  for (const side of [-1, 1]) {
    const { ex, ey, wx, wy } = arm(p.arms, side, p.t);
    const sx = CX + side * 7;
    const sy = 23;
    c.part();
    c.capsule(sx, sy, ex, ey, 3, 2.4, GOWN);
    c.part();
    c.capsule(ex, ey, wx, wy, 2.4, 4, VEIL);
    // The hand, reaching on from the sleeve.
    const dx = wx - ex;
    const dy = wy - ey;
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l;
    const uy = dy / l;
    const hx = wx + ux * 3;
    const hy = wy + uy * 3;
    c.part();
    c.ellipse(hx, hy, 1.8, 1.8, BONE);
    // Long fingers: pointing down when she calls the dead up, splayed when she screams.
    const spread = p.arms === 'scream' ? 0.7 : 0.4;
    const base = p.arms === 'summon' ? Math.PI / 2 : Math.atan2(uy, ux);
    for (const f of [-spread, 0, spread]) {
      const a = base + f;
      c.line(Math.round(hx + Math.cos(a) * 1.5), Math.round(hy + Math.sin(a) * 1.5), Math.round(hx + Math.cos(a) * 4.5), Math.round(hy + Math.sin(a) * 4.5), BONE, () => sphere(0, 0));
    }
    if (p.arms !== 'rest') {
      c.spark(hx, hy, WHITE, 0.5 + flare * 0.5);
      c.spark(hx + 1, hy, TEAL, 0.4);
      c.spark(hx - 1, hy, TEAL, 0.4);
      c.spark(hx, hy + 1, TEAL, 0.4);
    }
    // A broken chain hanging from the wrist, swinging.
    c.part();
    const swing = Math.sin(tau + side) * 1.5;
    for (let k = 0; k < 7; k++) {
      const cx = wx - side * 1 + (swing * k) / 7;
      const cy = wy + 2 + k * 1.3;
      c.px(cx, cy, CHAIN, k % 2 ? sphere(0.4, 0) : sphere(-0.4, 0.3));
    }
  }

  // The hooded head, only dark within, and two burning eyes.
  c.part();
  c.ellipse(CX, 16, 6.6, 7.6, VEIL);
  c.shape(8, 12, (y) => [CX - 5 + (12 - y) * 0.9, CX + 5 - (12 - y) * 0.9], VEIL, (_x, _y, t, u) => sphere(t * 0.8, 0.5 - u * 0.4));
  c.part();
  c.ellipse(CX + 1, 17.5, 4.2, 5.2, HOLLOW, { normal: () => FLAT });
  c.part();
  for (const ex of [CX - 1, CX + 3]) {
    c.px(ex, 16, EYE);
    c.spark(ex, 17, TEAL, 0.35 + flare * 0.3);
    c.spark(ex - 1, 16, TEAL, 0.2 + flare * 0.4);
    c.spark(ex + 1, 16, TEAL, 0.2 + flare * 0.4);
  }
  if (p.arms === 'scream') {
    // A cold light pouring from the dark where her mouth would be.
    c.spark(CX + 1, 20, WHITE, 0.7);
    c.spark(CX, 20, TEAL, 0.5);
    c.spark(CX + 2, 20, TEAL, 0.5);
    c.spark(CX + 1, 21, TEAL, 0.4);
  }

  // The crown: five spires of bone, each tipped with cold flame.
  for (const [ox, ht] of [
    [-5, 5],
    [-2.5, 7],
    [0, 9.5],
    [2.5, 7],
    [5, 5],
  ]) {
    c.part();
    const x = CX + ox;
    const bot = 10 - Math.abs(ox) * 0.3;
    const top = bot - ht;
    c.shape(Math.round(top), Math.round(bot), (y) => {
      const u = (y - top) / (bot - top);
      const hw = 0.35 + u * 1.3;
      return [x - hw, x + hw];
    }, BONE, (_x, _y, t) => cyl(t, 0.3));
    const fl = 0.5 + flare * 0.5;
    const flick = Math.sin(tau * 2 + ox) > 0 ? 1 : 0;
    c.spark(x - 0.5, top - 1, WHITE, fl);
    c.spark(x - 0.5, top - 2, TEAL, fl * 0.8);
    c.spark(x - 0.5 + flick, top - 3, TEAL, fl * 0.5);
    if (flare > 0.5) c.spark(x - 0.5, top - 4, LILAC, fl * 0.4);
  }
  return c;
}

export function buildQueenSheet(): MonsterSheet {
  const idle = [0, 1, 2, 3, 4, 5].map((i) => i / 6);
  const poses: Record<string, () => PixelCanvas> = {};
  idle.forEach((t, i) => (poses[`idle${i}`] = () => queen({ t, arms: 'rest' })));
  poses.summon0 = () => queen({ t: 0.2, arms: 'summon', flare: 0.6 });
  poses.summon1 = () => queen({ t: 0.7, arms: 'summon', flare: 1 });
  poses.scream0 = () => queen({ t: 0.3, arms: 'scream', flare: 1 });
  poses.scream1 = () => queen({ t: 0.8, arms: 'scream', flare: 0.8 });
  return sheet(MONSTER_FRAME.queen, poses, [
    { name: 'idle', frames: idle.map((_, i) => `idle${i}`), fps: 7, loop: true },
    { name: 'summon', frames: ['summon0', 'summon1'], fps: 6, loop: true },
    { name: 'scream', frames: ['scream0', 'scream1'], fps: 10, loop: true },
  ]);
}

// ---------------------------------------------------------------- Spells

const HAND: Material = { ramp: ramp('#1e7a80', '#3cc0b8', '#8af4e2', '#dcfff6', '#ffffff'), outline: hex('#062024'), emissive: 1, noAO: true };

export const HAND_W = 18;
export const HAND_H = 24;
export const HAND_FRAMES = 4;

/**
 * A drowned soul's hand clawing up out of the floor, pure light (its glow
 * layer is what's drawn). Frame 0 breaks the surface, 1 and 2 reach
 * highest, 3 sinks back.
 */
export function graspHand(f: number): PixelCanvas {
  const c = new PixelCanvas(HAND_W, HAND_H);
  const reach = [0.35, 1, 0.9, 0.5][f];
  const base = 22;
  const top = base - 18 * reach;
  const cx = 9 + (f === 2 ? 1 : 0);
  // Forearm.
  c.part();
  c.capsule(cx - 1, base, cx, top + 7, 2.6, 2, HAND);
  // Palm and clawed fingers, splayed.
  c.part();
  c.ellipse(cx, top + 5, 3, 2.8, HAND);
  const spread = f === 1 ? 0.5 : f === 2 ? 0.62 : 0.35;
  for (const k of [-2, -1, 0, 1]) {
    const a = -Math.PI / 2 + k * spread + 0.3;
    c.capsule(cx + Math.cos(a) * 2, top + 5 + Math.sin(a) * 2, cx + Math.cos(a) * 6, top + 5 + Math.sin(a) * 6.5, 0.9, 0.5, HAND);
  }
  c.capsule(cx - 2.5, top + 6, cx - 5.5, top + 3.5, 0.9, 0.5, HAND);
  // The broken floor round the wrist.
  for (let x = 2; x < 16; x++) if ((x * 7) % 5 < 3) c.spark(x, base + ((x * 3) % 2), TEAL, 0.5);
  return c;
}
