// The Elementinho Temple's creatures, drawn like the other monsters (lit,
// with a glow layer, facing right and mirrored):
//   - Blobs: small jelly elementals, one of each element. The water blob is
//     glassy with a bubble inside and a drop's point on its crown; the fire
//     blob is a hot ember jelly with a flame for a tuft; the earth blob is
//     mud studded with pebbles and a sprout; the air blob is a pale puff
//     with a wind curl inside it.
//   - The golem: a hulking stone guardian of the Stone Vault, mossy on top,
//     with shards of earth-crystal on its back and a green heart glowing
//     through the cracks of its chest.
//   - The undine: a water maiden rising out of her own swirling spout, with
//     hair of flowing water.
//   - The gale: a living whirlwind, bands of wind spinning round two bright
//     eyes, leaves and grit caught up in it.
//   - The salamander: a basalt lizard with lava in its belly, a crest of
//     flames down its back and fire on the tip of its tail.

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, cyl, hex, sphere, FLAT, type Material, type RGB } from './pixel';
import type { Element } from '../world/templeLayout';

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#0a0810');
const WHITE = hex('#ffffff');

/** Particle tints for each element's bursts. */
export const ELEMENT_TINTS: Record<Element, number[]> = {
  water: [0xd0f0ff, 0x7cc8ff, 0x3a98e6, 0xffffff],
  fire: [0xfff2b0, 0xffc44a, 0xff8a1c, 0xff4a1a],
  earth: [0xb08e56, 0x8e6a3a, 0x9ad84a, 0x6e6252],
  air: [0xf0fcff, 0xc0e4f0, 0x8cd8e4, 0xffffff],
};

/** Each element's light, for halos and lights. */
export const ELEMENT_LIGHT: Record<Element, number> = { water: 0x5ab4ff, fire: 0xff8a2a, earth: 0x9ad84a, air: 0xbff4ff };

export const GOLEM_TINTS = [0x9a8a72, 0x5e5244, 0x9ad84a, 0x46702a];
export const UNDINE_TINTS = ELEMENT_TINTS.water;
export const GALE_TINTS = ELEMENT_TINTS.air;
export const SALAMANDER_TINTS = [0xfff2b0, 0xffc44a, 0xff6a1a, 0x5a1a10];

const HOLLOW: Material = { ramp: ramp('#06040a', '#0c0812'), outline: INK, noAO: true, noOutline: true };
const flame = (k = 0): Material => ({ ramp: ramp('#b8300a', '#ff6a14', '#ffa832', '#ffe070', '#fffbe0'), outline: hex('#3a0a04'), emissive: 0.85 + k * 0.15, noAO: true, noOutline: true });
const EMBER = hex('#ffb040');
const EMBER_HOT = hex('#fff0b0');

// ---------------------------------------------------------------- Blobs

const BLOB: Record<Element, { body: Material; dark: Material; gloss: Material; glint: RGB }> = {
  water: {
    body: { ramp: ramp('#0c2e62', '#154c92', '#2170c4', '#3c9ae8', '#7ccaff', '#c8eeff'), outline: hex('#061430'), outlineLit: hex('#0e2c5a'), emissive: 0.22, shine: true },
    dark: { ramp: ramp('#0a2450', '#123e7a', '#1c5ea6'), outline: hex('#061430'), emissive: 0.15, noAO: true },
    gloss: { ramp: ramp('#bfeaff', '#ffffff'), outline: hex('#061430'), emissive: 0.6, noAO: true, noOutline: true },
    glint: hex('#dff6ff'),
  },
  fire: {
    body: { ramp: ramp('#6a1208', '#a82c0c', '#e0560e', '#ff8c1e', '#ffc24a', '#fff0a8'), outline: hex('#2a0604'), outlineLit: hex('#5a1408'), emissive: 0.62 },
    dark: { ramp: ramp('#5a0e06', '#8a200a', '#c0400c'), outline: hex('#2a0604'), emissive: 0.4, noAO: true },
    gloss: { ramp: ramp('#ffe890', '#fffbe8'), outline: hex('#2a0604'), emissive: 1, noAO: true, noOutline: true },
    glint: hex('#fff4c0'),
  },
  earth: {
    body: { ramp: ramp('#241408', '#40260f', '#5e3c1a', '#7c5628', '#9c743a', '#c09a58'), outline: hex('#120a04'), outlineLit: hex('#2c1a0c') },
    dark: { ramp: ramp('#2a2420', '#463e36', '#6a6054', '#948878', '#bcb2a0'), outline: hex('#120a04'), shine: true },
    gloss: { ramp: ramp('#46702a', '#68a03a', '#98d050'), outline: hex('#0e1a08') },
    glint: hex('#fff0c8'),
  },
  air: {
    body: { ramp: ramp('#2e5870', '#4c80a0', '#78acc8', '#a8d6e8', '#d8f4fa', '#ffffff'), outline: hex('#122a3a'), outlineLit: hex('#28506a'), emissive: 0.32, noAO: true },
    dark: { ramp: ramp('#3a6a86', '#5e94b2', '#8cc2d8'), outline: hex('#122a3a'), emissive: 0.25, noAO: true },
    gloss: { ramp: ramp('#e8fcff', '#ffffff'), outline: hex('#122a3a'), emissive: 0.8, noAO: true, noOutline: true },
    glint: hex('#ffffff'),
  },
};

interface BlobPose {
  /** 0..1 phase of the wobble. */
  t: number;
  /** + squashed wide and flat (crouching), - stretched tall (leaping). */
  squash?: number;
  mouth?: boolean;
}

function blob(el: Element, p: BlobPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.blob_water;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const s = (p.squash ?? 0) + Math.sin(tau) * 0.09;
  const rx = 6.8 * (1 + s * 0.3);
  const ry = 5.6 * (1 - s * 0.32);
  const base = 18.5;
  const cx = 10;
  const cy = base - ry;
  const top = cy - ry;
  const B = BLOB[el];

  // The fire blob's flame, licking up behind its crown.
  if (el === 'fire') {
    c.part();
    const lean = -1.5 - Math.sin(tau) * 1.2;
    const ft = top - 6 - Math.round((Math.sin(tau * 2) + 1) * 0.8) + s * 2;
    c.shape(Math.round(ft), Math.round(top + 2), (y) => {
      const u = (y - ft) / (top + 2 - ft);
      const hw = 0.4 + Math.sin(Math.min(1, u) * Math.PI * 0.5) * 3.2;
      const x0 = cx + lean * (1 - u);
      return [x0 - hw, x0 + hw];
    }, flame(0.2), () => FLAT);
    c.spark(cx + lean - 1, ft - 2, EMBER, 0.7);
    c.spark(cx + lean + 2, ft - 4 + Math.sin(tau) * 1.5, EMBER_HOT, 0.5);
  }
  // The water blob's crown comes to a drop's point.
  if (el === 'water') {
    c.part();
    const lean = Math.sin(tau) * 0.6;
    c.shape(Math.round(top - 3), Math.round(top + 1), (y) => {
      const u = (y - (top - 3)) / 4;
      const hw = 0.3 + u * u * 2.2;
      return [cx - 0.5 + lean * (1 - u) - hw, cx - 0.5 + lean * (1 - u) + hw];
    }, B.body, (_x, _y, t) => cyl(t, 0.4));
  }

  // The body: a dome, a little flattened where it sits.
  c.part();
  c.shape(Math.floor(top), Math.ceil(base) - 1, (y) => {
    const v = (y + 0.5 - cy) / ry;
    if (v < -1) return null;
    const hw = v < 0 ? rx * Math.sqrt(Math.max(0, 1 - v * v)) : rx * (1 - Math.pow(Math.min(1, v), 3) * 0.3);
    return [cx - hw, cx + hw];
  }, B.body, (_x, y, t) => sphere(t * 0.92, Math.max(-1, Math.min(1, (y + 0.5 - cy) / ry)) * 0.85));

  if (el === 'water') {
    // A bubble drifting inside, and a wet shine up top.
    c.part();
    const by = cy + 1.5 - ((p.t * 3) % 1) * 2;
    c.ellipse(cx - 2.5, by, 1.4, 1.4, B.dark);
    c.spark(cx - 3, by - 0.5, B.glint, 0.6);
    c.part();
    c.px(cx - 4, top + 2, B.gloss);
    c.px(cx - 5, top + 3, B.gloss);
    c.px(cx - 3, top + 1, B.gloss);
    c.px(cx - 5, top + 4, B.gloss);
    c.spark(cx + 4, base - 2, B.glint, 0.35);
  } else if (el === 'fire') {
    // A white-hot heart and embers rising off its skin.
    c.part();
    c.ellipse(cx - 0.5, cy + 1.5, rx * 0.45, ry * 0.42, B.gloss);
    c.spark(cx - 4, top + 2, EMBER_HOT, 0.6);
    c.spark(cx + 5, cy - 2 + Math.sin(tau) * 1, EMBER, 0.5);
    c.spark(cx - 6, cy - 3 - Math.cos(tau) * 1.5, EMBER, 0.45);
  } else if (el === 'earth') {
    // Pebbles pressed into the mud, a cap of moss and a sprout.
    for (const [px, py, r] of [[-4, 1.5, 1.4], [3.5, 2.5, 1.2], [-1, 3.8, 1], [5, -1, 0.9]] as const) {
      c.part();
      c.ellipse(cx + px * (rx / 6.8), cy + py * (ry / 5.6), r * 1.2, r, B.dark);
    }
    c.part();
    for (let x = -4; x <= 3; x++) {
      const y = Math.round(top + 1 + Math.abs(x) * 0.25 + (x === -2 || x === 2 ? 0 : 0.4));
      c.px(cx + x, y, B.gloss);
    }
    c.part();
    const sw = Math.sin(tau) * 0.6;
    c.line(cx - 1, Math.round(top), cx - 1 + Math.round(sw), Math.round(top - 3), B.gloss);
    c.px(cx - 2 + Math.round(sw), Math.round(top - 3), B.gloss, sphere(-0.5, 0.3));
    c.px(cx - 3 + Math.round(sw), Math.round(top - 4), B.gloss, sphere(-0.6, 0.4));
    c.px(cx + Math.round(sw), Math.round(top - 4), B.gloss, sphere(0.6, 0.4));
    c.px(cx + 1 + Math.round(sw), Math.round(top - 4), B.gloss, sphere(0.6, 0.4));
  } else {
    // A curl of wind inside, and one over its head.
    for (let i = 0; i < 9; i++) {
      const a = tau + i * 0.75;
      const r = 1 + i * 0.42;
      c.spark(cx - 0.5 + Math.cos(a) * r, cy + 1 + Math.sin(a) * r * 0.7, B.glint, 0.5 - i * 0.03);
    }
    c.part();
    const cl = Math.sin(tau) * 0.8;
    c.capsule(cx - 1, top + 1, cx - 3 + cl, top - 2, 1.4, 1, B.body);
    c.capsule(cx - 3 + cl, top - 2, cx - 1 + cl, top - 4, 1, 0.6, B.body);
    // Little gusts circling it.
    for (let k = 0; k < 3; k++) {
      const a = tau + (k * Math.PI * 2) / 3;
      c.spark(cx + Math.cos(a) * (rx + 2), cy + Math.sin(a) * (ry * 0.6) + 1, WHITE, Math.sin(a) > 0 ? 0.55 : 0.25);
    }
  }

  // Eyes, to the front, with a glint in each; a mouth when it gathers itself.
  c.part();
  const ey = Math.round(cy - ry * 0.25);
  for (const ex of [cx + 1, cx + 4]) {
    c.px(ex, ey, HOLLOW);
    c.px(ex, ey + 1, HOLLOW);
    c.spark(ex, ey, B.glint, el === 'fire' ? 0.9 : 0.75);
  }
  if (p.mouth) {
    c.px(cx + 2, ey + 3, HOLLOW);
    c.px(cx + 3, ey + 3, HOLLOW);
    c.px(cx + 2, ey + 4, HOLLOW);
  }
  return c;
}

export function buildBlobSheet(el: Element): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => blob(el, { t: i / 4 })));
  poses.crouch0 = () => blob(el, { t: 0.1, squash: 0.85, mouth: true });
  poses.crouch1 = () => blob(el, { t: 0.6, squash: 1, mouth: true });
  poses.leap = () => blob(el, { t: 0.3, squash: -0.75, mouth: true });
  return sheet(MONSTER_FRAME[`blob_${el}`], poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 6, loop: true },
    { name: 'walk', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 11, loop: true },
    { name: 'windup', frames: ['crouch0', 'crouch1'], fps: 12, loop: true },
  ]);
}

// ---------------------------------------------------------------- Golem

const ROCK: Material = { ramp: ramp('#1a1612', '#2c2620', '#40372e', '#584c3f', '#746552', '#948268'), outline: hex('#0a0806'), outlineLit: hex('#2a241e') };
const ROCK_DARK: Material = { ramp: ramp('#131110', '#201c18', '#302a24', '#433a31', '#574c40'), outline: hex('#080605') };
const MOSS: Material = { ramp: ramp('#1a2e12', '#2a4a1a', '#406a26', '#5e9034', '#86b848'), outline: hex('#0a1406') };
const earthCrystal = (k = 0): Material => ({ ramp: ramp('#1e5a1a', '#3c9a2a', '#7ad84a', '#c8ff90', '#f4ffe0'), outline: hex('#0a2006'), emissive: 0.55 + k * 0.4, shine: true, noAO: true });
const GOLEM_EYE: Material = { ramp: ramp('#c07a10', '#ffd040', '#fff8c0'), outline: INK, emissive: 1, noAO: true };
const GREEN = hex('#9ad84a');
const GREEN_HOT = hex('#e4ffb0');

type GolemArms = 'rest' | 'raise' | 'slam';

interface GolemPose {
  t: number;
  arms: GolemArms;
  /** Walking: 0..1 through the stride. */
  step?: number;
  flare?: number;
}

/** A heavy stone arm: shoulder boulder, upper arm, forearm and a great fist. */
function golemArm(c: PixelCanvas, sx: number, sy: number, ex: number, ey: number, fx: number, fy: number, back: boolean): void {
  const m = back ? ROCK_DARK : ROCK;
  c.part();
  c.capsule(sx, sy, ex, ey, 3.8, 3.4, m);
  c.part();
  c.capsule(ex, ey, fx, fy, 3.6, 3.8, m);
  c.part();
  c.ellipse(fx, fy, 5, 4.6, m);
  // Knuckles.
  for (let k = -1; k <= 1; k++) c.shade(Math.round(fx + 2 + k * 0.3), Math.round(fy - 1 + k * 1.6), -1);
  c.part();
  c.ellipse(sx, sy, 5.5, 5, m);
  if (!back) {
    // Moss on the shoulder.
    for (let x = -3; x <= 3; x++) c.px(Math.round(sx + x), Math.round(sy - 4.5 + Math.abs(x) * 0.35), MOSS);
  }
}

function golem(p: GolemPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.golem;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const flare = p.flare ?? 0;
  const CX = 22;
  const slam = p.arms === 'slam';
  const lean = slam ? 2 : 0;
  const drop = slam ? 2 : p.arms === 'raise' ? -1 : 0;
  const breathe = Math.sin(tau) * 0.5;
  const st = p.step === undefined ? 0 : Math.sin(p.step * Math.PI * 2) * 3;
  const bob = p.step === undefined ? 0 : Math.abs(Math.cos(p.step * Math.PI * 2)) * -0.8;
  const ty = 26 + drop + breathe * 0.4 + bob;

  // Back leg.
  c.part();
  c.capsule(CX - 5, 35, CX - 5 + st, 42, 4.4, 3.8, ROCK_DARK);
  c.ellipse(CX - 4 + st, 43.5, 4.8, 2.2, ROCK_DARK, { flatten: 0.6 });

  // Crystal shards jutting from its back.
  for (const [bx, by, tx, tyy, r] of [[-9, 18, -15, 6, 2.6], [-4, 15, -6, 3, 2.2], [-12, 24, -19, 17, 2]] as const) {
    c.part();
    c.capsule(CX + bx + lean, by + drop, CX + tx + lean, tyy + drop, r, 0.4, earthCrystal(flare));
  }

  // Back arm.
  if (p.arms === 'rest') golemArm(c, CX - 11, 20 + drop, CX - 15, 29, CX - 14, 37 - breathe, true);
  else if (p.arms === 'raise') golemArm(c, CX - 10, 18 + drop, CX - 12, 10, CX - 4, 5, true);
  else golemArm(c, CX - 7 + lean, 21 + drop, CX + 2, 32, CX + 9, 40, true);

  // The torso: a great boulder.
  c.part();
  c.ellipse(CX + lean, ty, 12.5, 11, ROCK);
  // Seams between its stones.
  for (let y = -7; y <= 8; y++) c.shade(CX + lean - 4 + Math.round(y * 0.2), Math.round(ty + y), -1);
  for (let x = -9; x <= -5; x++) c.shade(CX + lean + x, Math.round(ty + 3 + x * 0.1), -1);
  // Its heart: earth-crystal glowing through a crack in the chest.
  c.part();
  const hx = CX + lean + 3.5;
  const hy = ty + 0.5;
  c.ellipse(hx, hy, 2.8, 3.4, earthCrystal(0.4 + flare * 0.6));
  for (const [dx, dy] of [[1, -1], [1.2, -0.6], [-0.4, 1], [0.8, 1]] as const) {
    for (let k = 3; k < 8; k++) c.spark(hx + dx * k, hy + dy * k * 0.9 + Math.sin(k) * 0.4, k < 5 ? GREEN_HOT : GREEN, 0.6 - k * 0.05 + flare * 0.3);
  }
  // Moss over its shoulders and back.
  c.part();
  for (let x = -11; x <= 6; x++) {
    const y = ty - 10.5 + Math.abs(x + 2) * 0.12 + (x % 3 === 0 ? 1 : 0);
    c.px(Math.round(CX + lean + x), Math.round(y), MOSS, sphere(x / 12, 0.6));
    if (x % 4 === 1) c.px(Math.round(CX + lean + x), Math.round(y + 1.5), MOSS);
  }

  // The head, sunk low between the shoulders, with a heavy brow and burning eyes.
  c.part();
  const hdx = CX + lean + 4 + (slam ? 2 : 0);
  const hdy = 14 + drop + (slam ? 2 : 0);
  c.ellipse(hdx, hdy, 6.2, 5, ROCK);
  c.part();
  c.capsule(hdx - 3, hdy - 2.5, hdx + 5, hdy - 2, 1.6, 1.4, ROCK_DARK);
  c.part();
  for (const ex of [hdx + 1, hdx + 4]) {
    c.px(ex, hdy, GOLEM_EYE);
    c.px(ex + 1, hdy, GOLEM_EYE);
    c.spark(ex, hdy + 1, hex('#ffb020'), 0.3 + flare * 0.4);
  }
  // A jaw of stone.
  c.part();
  c.capsule(hdx - 1, hdy + 3.5, hdx + 5, hdy + 3.5 + (slam ? 1 : 0), 1.4, 1.2, ROCK_DARK);

  // Front leg.
  c.part();
  c.capsule(CX + 6, 35, CX + 6 - st, 42, 4.6, 4, ROCK);
  c.ellipse(CX + 7 - st, 43.5, 5, 2.3, ROCK, { flatten: 0.6 });

  // Front arm.
  if (p.arms === 'rest') golemArm(c, CX + 12 + lean, 20 + drop, CX + 16, 29, CX + 16, 37 + breathe, false);
  else if (p.arms === 'raise') golemArm(c, CX + 11, 18 + drop, CX + 14, 10, CX + 7, 5, false);
  else golemArm(c, CX + 13 + lean, 21 + drop, CX + 19, 31, CX + 18, 41, false);

  if (p.arms === 'raise' && flare > 0) {
    // Power welling between its fists.
    for (let k = 0; k < 6; k++) c.spark(CX + 1.5 + Math.cos(k + tau) * 3, 5 + Math.sin(k + tau) * 2, k % 2 ? GREEN : GREEN_HOT, 0.4 * flare);
  }
  if (slam) {
    // The ground splits where it lands.
    for (let k = 0; k < 10; k++) c.spark(CX + 12 + k * 1.3, 44 - (k % 3), k % 2 ? GREEN : hex('#c0a070'), 0.5 - k * 0.03);
  }
  return c;
}

export function buildGolemSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1].forEach((i) => (poses[`idle${i}`] = () => golem({ t: i / 2, arms: 'rest' })));
  [0, 1, 2, 3].forEach((i) => (poses[`walk${i}`] = () => golem({ t: i / 4, arms: 'rest', step: i / 4 })));
  poses.raise0 = () => golem({ t: 0.2, arms: 'raise', flare: 0.5 });
  poses.raise1 = () => golem({ t: 0.7, arms: 'raise', flare: 1 });
  poses.slam = () => golem({ t: 0, arms: 'slam', flare: 1 });
  return sheet(MONSTER_FRAME.golem, poses, [
    { name: 'idle', frames: ['idle0', 'idle1'], fps: 2, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 5, loop: true },
    { name: 'windup', frames: ['raise0', 'raise1'], fps: 6, loop: true },
  ]);
}

// ---------------------------------------------------------------- Undine

const WATER: Material = { ramp: ramp('#0a2a5a', '#124a8e', '#1e70c0', '#3a9ae6', '#7cc8ff', '#d0f0ff'), outline: hex('#061430'), outlineLit: hex('#0e2c5a'), emissive: 0.28, shine: true };
const FOAM: Material = { ramp: ramp('#7cc0e8', '#b4e4ff', '#e8faff', '#ffffff'), outline: hex('#0e2c5a'), emissive: 0.5, noAO: true };
const NAIAD: Material = { ramp: ramp('#1e5070', '#357a9a', '#5aa8c4', '#8cd4e4', '#c8f4fa'), outline: hex('#08202e'), outlineLit: hex('#1a4058'), emissive: 0.2 };
const waterHair = (k = 0): Material => ({ ramp: ramp('#0c3470', '#1656a4', '#2a84d4', '#5ab8f4', '#aee4ff'), outline: hex('#061430'), emissive: 0.35 + k * 0.2, noAO: true });
const orbMat = (k: number): Material => ({ ramp: ramp('#2a7ad8', '#6ab8ff', '#c4ecff', '#ffffff'), outline: hex('#0a2a5a'), emissive: 0.7 + k * 0.3, noAO: true });
const PEARL: Material = { ramp: ramp('#b8c8d8', '#f0f4ff', '#ffffff'), outline: INK, emissive: 0.6, shine: true };
const AQUA = hex('#9ae0ff');

interface UndinePose {
  t: number;
  /** 0..1 raising her hands, a water orb gathering between them. */
  cast?: number;
}

function undine(p: UndinePose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.undine;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const k = p.cast ?? 0;
  const CX = 14;

  // Her hair, water streaming back and down behind her.
  for (let i = 0; i < 3; i++) {
    c.part();
    const sw = Math.sin(tau + i * 1.2) * 1.4;
    const x0 = CX - 1 - i;
    const y0 = 5 + i;
    c.capsule(x0, y0, x0 - 5 - i, 13 + i * 2 + sw * 0.4, 3.4 - i * 0.6, 2.4 - i * 0.4, waterHair(k));
    c.capsule(x0 - 5 - i, 13 + i * 2 + sw * 0.4, x0 - 7 - i + sw, 22 + i * 3 + sw, 2.4 - i * 0.4, 0.8, waterHair(k));
    c.spark(x0 - 7 - i + sw, 23 + i * 3 + sw, AQUA, 0.5);
  }

  // The spout she rises out of, swirling down to a ring of foam.
  c.part();
  c.shape(23, 35, (y) => {
    const u = (y - 23) / 12;
    const hw = 3.6 + u * u * 4.4 + Math.sin(tau * 2 + y * 0.9) * 0.6;
    return [CX - hw + Math.sin(tau + y * 0.5) * 0.6, CX + hw + Math.sin(tau + y * 0.5) * 0.6];
  }, WATER, (_x, _y, t) => cyl(t, 0.1));
  for (let y = 24; y < 35; y += 3) {
    // Bands of current winding round the spout.
    const ph = tau * 2 + y;
    for (let x = -5; x <= 5; x++) if (Math.sin(ph + x * 0.7) > 0.55) c.shade(CX + x, y + Math.round(x * 0.15), 1);
  }
  c.part();
  c.ellipse(CX, 35.5, 8.5 + Math.sin(tau) * 0.5, 2.2, FOAM, { flatten: 0.5 });
  for (let i = 0; i < 5; i++) {
    const a = tau + i * 1.26;
    c.spark(CX + Math.cos(a) * 9, 35 + Math.sin(a) * 2 - 1, WHITE, 0.45);
  }

  // The torso, and her far arm.
  c.part();
  if (k > 0) c.capsule(CX - 1, 15, CX + 5 + k * 2, 12 - k * 3, 1.4, 1.1, NAIAD);
  else c.capsule(CX - 2, 15, CX - 5, 22 + Math.sin(tau) * 0.5, 1.4, 1.1, NAIAD);
  c.part();
  c.shape(13, 24, (y) => {
    const u = (y - 13) / 11;
    const hw = 3.4 - Math.sin(u * Math.PI) * 0.6 + u * 0.8;
    return [CX - hw + 0.5, CX + hw + 0.5];
  }, NAIAD, (_x, _y, t) => cyl(t, 0.15));
  // A shell at her breast.
  c.part();
  c.ellipse(CX + 1.5, 16.5, 1.4, 1.1, PEARL);

  // The head: pale and smooth, a pearl on her brow.
  c.part();
  c.ellipse(CX + 1, 8.5, 4.2, 4.6, NAIAD);
  c.part();
  c.capsule(CX - 2, 4.5, CX + 3, 4, 1.6, 1.2, waterHair(k));
  c.px(CX + 2, 5, PEARL);
  c.part();
  for (const ex of [CX + 2, CX + 4]) {
    c.px(ex, 8, HOLLOW);
    c.px(ex, 9, HOLLOW);
    c.spark(ex, 8, AQUA, 0.8 + k * 0.2);
  }
  c.spark(CX + 3, 11, hex('#5aa8c4'), 0.2);

  // The near arm, and the orb of water she gathers.
  c.part();
  if (k > 0) {
    c.capsule(CX + 3, 15, CX + 7 + k, 13 - k * 2, 1.5, 1.2, NAIAD);
    c.capsule(CX + 7 + k, 13 - k * 2, CX + 10 + k, 10 - k * 3, 1.2, 1, NAIAD);
    c.part();
    const r = 1.5 + k * 2;
    c.ellipse(CX + 11 + k, 8 - k * 3, r, r, orbMat(k));
    for (let i = 0; i < 4; i++) {
      const a = tau * 2 + i * 1.57;
      c.spark(CX + 11 + k + Math.cos(a) * (r + 1.5), 8 - k * 3 + Math.sin(a) * (r + 1.5), WHITE, 0.5 * k);
    }
  } else {
    c.capsule(CX + 3, 15, CX + 6, 21 - Math.sin(tau) * 0.5, 1.5, 1.2, NAIAD);
  }
  return c;
}

export function buildUndineSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => undine({ t: i / 4 })));
  poses.cast0 = () => undine({ t: 0.1, cast: 0.5 });
  poses.cast1 = () => undine({ t: 0.35, cast: 0.8 });
  poses.cast2 = () => undine({ t: 0.6, cast: 1 });
  return sheet(MONSTER_FRAME.undine, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 7, loop: true },
    { name: 'walk', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 10, loop: true },
    { name: 'windup', frames: ['cast0', 'cast1', 'cast2', 'cast1'], fps: 8, loop: true },
  ]);
}

// ---------------------------------------------------------------- Gale

const galeBand = (k: number): Material => ({
  ramp: k % 2 ? ramp('#2a4a60', '#3e6a84', '#5e90aa', '#8ab8cc', '#c4e4ee', '#f0fcff') : ramp('#264460', '#38627e', '#5486a2', '#7eaec4', '#b6dcea', '#e8f8ff'),
  outline: hex('#0c1e2c'),
  outlineLit: hex('#244a62'),
  emissive: 0.18,
});
const GALE_EYE: Material = { ramp: ramp('#7af0ff', '#ffffff'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const DUST: Material = { ramp: ramp('#4a4034', '#6e6250', '#968a74', '#bcb29a'), outline: hex('#1a160e'), noAO: true };
const LEAF = [hex('#6aa83a'), hex('#9ad04a'), hex('#c8a050')];

interface GalePose {
  t: number;
  /** Winding up: pulled tight, eyes blazing. */
  wind?: number;
  /** Rushing forward: leaning into it. */
  dash?: boolean;
}

function gale(p: GalePose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.gale;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const k = p.wind ?? 0;
  const CX = 14;
  const top = 3;
  const bot = 29;
  const BANDS = 7;
  const bandOf = (y: number) => Math.min(BANDS - 1, Math.floor((y - top) / 4));
  // Each band swings its own way round the funnel, so it twists as it spins.
  const centre = (y: number) => {
    const u = (y - top) / (bot - top);
    const b = bandOf(y);
    return CX + Math.sin(tau + b * 1.3) * (0.6 + u * 1.6) + (p.dash ? (1 - u) * 4 : 0);
  };
  const half = (y: number) => {
    const u = (y - top) / (bot - top);
    return (1 + 8.6 * Math.pow(1 - u, 1.25)) * (1 - k * 0.14);
  };

  // Dust kicked up where it touches the ground.
  c.part();
  c.ellipse(CX + Math.sin(tau) * 0.6, bot + 0.5, 4.5 + Math.sin(tau * 2) * 0.6, 1.4, DUST, { flatten: 0.4 });
  for (let i = 0; i < 4; i++) {
    const a = tau * 2 + i * 1.6;
    c.spark(CX + Math.cos(a) * 6, bot - 1 + Math.sin(a) * 1.2, hex('#c8bca0'), 0.25);
  }
  // Grit and leaves caught up behind it.
  for (let i = 0; i < 6; i++) {
    const a = tau + i * 1.05;
    if (Math.sin(a) > 0) continue;
    const y = 6 + i * 3.8;
    c.spark(centre(y) + Math.cos(a) * (half(y) + 2), y, LEAF[i % 3], 0.3);
  }

  // Bands of wind, the widest on top, each overlapping the one below it.
  for (let b = BANDS - 1; b >= 0; b--) {
    const y0 = top + b * 4;
    const y1 = Math.min(bot, y0 + 5);
    c.part();
    c.shape(y0, y1, (y) => {
      const x = centre(Math.min(y, y0 + 3));
      const hw = half(y);
      return [x - hw, x + hw];
    }, galeBand(b), (_x, y, t) => cyl(t, 0.45 - ((y - y0) / 5) * 0.7));
    // A streak of wind running round the band.
    const a = tau * 2 + b * 0.9;
    const ym = y0 + 2;
    for (let s = 0; s < 5; s++) {
      const aa = a + s * 0.25;
      const vis = Math.cos(aa);
      if (vis < 0.1) continue;
      c.spark(centre(ym) + Math.sin(aa) * half(ym) * 0.85, ym, WHITE, 0.15 + vis * 0.3 + k * 0.2);
    }
  }
  // Its eyes: two dark hollows deep in the upper funnel, a cold light in each.
  c.part();
  const ey = 7;
  const ex = Math.round(centre(ey)) - 1 + (p.dash ? 1 : 0);
  for (const x of [ex, ex + 4]) {
    c.px(x, ey, HOLLOW);
    c.px(x + 1, ey, HOLLOW);
    c.px(x, ey + 1, HOLLOW);
    c.px(x + 1, ey + 1, HOLLOW);
    c.px(x + 1, ey, GALE_EYE);
    c.spark(x + 1, ey, hex('#7af0ff'), 0.4 + k * 0.6);
  }
  // Leaves whirling in front.
  for (let i = 0; i < 5; i++) {
    const a = tau + i * 1.25 + 0.4;
    if (Math.sin(a) <= 0) continue;
    const y = 8 + i * 4.5;
    c.spark(centre(y) + Math.cos(a) * (half(y) + 1.5), y, LEAF[i % 3], 0.7);
  }
  return c;
}

export function buildGaleSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => gale({ t: i / 4 })));
  poses.wind0 = () => gale({ t: 0.1, wind: 0.6 });
  poses.wind1 = () => gale({ t: 0.6, wind: 1 });
  poses.dash = () => gale({ t: 0.25, wind: 1, dash: true });
  return sheet(MONSTER_FRAME.gale, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 12, loop: true },
    { name: 'walk', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 16, loop: true },
    { name: 'windup', frames: ['wind0', 'wind1'], fps: 16, loop: true },
  ]);
}

// ---------------------------------------------------------------- Salamander

const SCALE: Material = { ramp: ramp('#1a0a0a', '#2e1210', '#461c14', '#62281a', '#843822', '#a84e2c'), outline: hex('#0c0404'), outlineLit: hex('#2a100c'), shine: true };
const SCALE_DARK: Material = { ramp: ramp('#140808', '#240e0c', '#361612', '#4c2018'), outline: hex('#0c0404') };
const lava = (k = 0): Material => ({ ramp: ramp('#a8200a', '#e8520e', '#ff9a24', '#ffd860', '#fff6c0'), outline: hex('#2a0604'), emissive: 0.8 + k * 0.2, noAO: true });
const SAL_EYE: Material = { ramp: ramp('#e0a010', '#fff070', '#ffffff'), outline: INK, emissive: 1, noAO: true };

type SalPose = { t: number; step?: number; breath?: 'inhale' | 'blow' };

function salamander(p: SalPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.salamander;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const st = p.step === undefined ? 0 : Math.sin(p.step * Math.PI * 2) * 2;
  const inhale = p.breath === 'inhale';
  const blow = p.breath === 'blow';
  const heat = inhale ? 0.6 : blow ? 1 : 0;
  const sway = Math.sin(tau) * 1.2 + (p.step !== undefined ? Math.sin(p.step * Math.PI * 2) * 1 : 0);
  const hy = inhale ? -1 : blow ? 0.5 : 0;

  // Far legs.
  c.part();
  c.capsule(13, 17, 11 - st, 22, 1.6, 1.3, SCALE_DARK);
  c.capsule(26, 16, 28 + st, 22, 1.6, 1.3, SCALE_DARK);

  // The tail, curling up to a flame at its tip.
  c.part();
  c.capsule(12, 16, 6, 16 + sway * 0.3, 3.4, 2.4, SCALE);
  c.capsule(6, 16 + sway * 0.3, 2.5, 11 + sway, 2.4, 1.1, SCALE);
  c.part();
  const tx = 2.5;
  const ty = 11 + sway;
  c.shape(Math.round(ty - 6), Math.round(ty), (y) => {
    const u = (y - (ty - 6)) / 6;
    const hw = 0.3 + Math.sin(Math.min(1, u) * Math.PI * 0.55) * 2.1;
    const x = tx - (1 - u) * 1.5 + Math.sin(tau * 2 + y) * 0.4;
    return [x - hw, x + hw];
  }, flame(heat * 0.5), (_x, _y, t) => cyl(t, 0.3), { bias: -1 });
  c.spark(tx - 2, ty - 8, EMBER, 0.6);

  // The body, belly glowing with lava.
  c.part();
  c.capsule(12, 15.5, 25, 14.5, 4.8, 4.4, SCALE);
  c.part();
  c.capsule(13, 18.5, 24, 18, 1.4, 1.3, lava(heat * 0.5));
  // Cracks of fire across its back.
  for (const [x0, y0, x1, y1] of [[15, 12, 17, 15], [20, 11, 21, 14], [23, 12, 25, 14]] as const) {
    for (let k = 0; k <= 3; k++) c.spark(x0 + ((x1 - x0) * k) / 3, y0 + ((y1 - y0) * k) / 3, k % 2 ? EMBER : hex('#ff6a1a'), 0.55 + heat * 0.3);
  }

  // The crest of flames down its back, flickering.
  for (let i = 0; i < 6; i++) {
    c.part();
    const bx = 13 + i * 2.4;
    const by = 10.5 - Math.sin((i / 5) * Math.PI) * 0.8;
    const fh = 3 + ((i * 7) % 3) + Math.sin(tau * 2 + i * 1.7) * 1.2 + heat * 1.5;
    c.shape(Math.round(by - fh), Math.round(by), (y) => {
      const u = (y - (by - fh)) / fh;
      const hw = 0.3 + u * 1.2;
      const x = bx - (1 - u) * 1.2;
      return [x - hw, x + hw];
    }, flame(heat * 0.3), (_x, _y, t) => cyl(t, 0.3), { bias: -2 + Math.round(heat) });
    if (i % 2 === 0) c.spark(bx - 1.5, by - fh - 1.5, EMBER, 0.45);
  }

  // Near legs, clawed.
  c.part();
  c.capsule(16, 17, 15 + st, 22, 1.8, 1.4, SCALE);
  c.capsule(27, 16, 29 - st, 22, 1.8, 1.4, SCALE);
  for (const fx of [15 + st, 29 - st]) {
    c.px(Math.round(fx) + 1, 22, SCALE_DARK);
    c.px(Math.round(fx) + 2, 22, SCALE_DARK);
  }

  // The head: a blunt snout, a fiery eye, and jaws that open on the fire inside.
  c.part();
  c.ellipse(30, 12 + hy, 5, 3.8, SCALE);
  c.part();
  c.capsule(31, 12.5 + hy, 35.5, 13 + hy + (blow ? -0.5 : 0), 3, 2.1, SCALE);
  if (blow || inhale) {
    // A throat swelling with fire.
    c.part();
    c.ellipse(28.5, 15.5 + hy, 2.6, 1.8, lava(heat));
  }
  if (blow) {
    c.part();
    c.capsule(31, 16 + hy, 35, 17.5 + hy, 1.4, 1.1, SCALE_DARK);
    c.part();
    c.capsule(32, 15 + hy, 36, 15.5 + hy, 0.9, 0.9, lava(1));
    for (let k = 0; k < 4; k++) c.spark(36.5 + k * 0.4, 15 + hy + (k % 2 ? 0.5 : -0.5), k < 2 ? EMBER_HOT : EMBER, 0.9 - k * 0.15);
  }
  c.part();
  c.px(31, 10 + hy, SAL_EYE);
  c.px(32, 10 + hy, SAL_EYE);
  c.spark(31, 9 + hy, hex('#ffb020'), 0.4 + heat * 0.4);
  // Nostril.
  c.shade(35, 12 + hy, -2);
  return c;
}

export function buildSalamanderSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => salamander({ t: i / 4 })));
  [0, 1, 2, 3].forEach((i) => (poses[`walk${i}`] = () => salamander({ t: i / 4, step: i / 4 })));
  poses.inhale0 = () => salamander({ t: 0.1, breath: 'inhale' });
  poses.inhale1 = () => salamander({ t: 0.6, breath: 'inhale' });
  poses.blow = () => salamander({ t: 0.3, breath: 'blow' });
  return sheet(MONSTER_FRAME.salamander, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 7, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 10, loop: true },
    { name: 'windup', frames: ['inhale0', 'inhale1'], fps: 10, loop: true },
  ]);
}

// ---------------------------------------------------------------- Spells

export const TORB_PX = 11;

/** An undine's bolt: a ball of bright water, white at the heart. Pure light. */
export function waterOrb(): Uint8ClampedArray {
  const n = TORB_PX;
  const px = new Uint8ClampedArray(n * n * 4);
  const cols: RGB[] = [hex('#ffffff'), hex('#c4ecff'), hex('#6ab8ff'), hex('#2a7ad8')];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - n / 2 + 0.8, y + 0.5 - n / 2 + 0.8) / (n / 2);
      const e = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      if (e > 1) continue;
      const c = cols[Math.min(3, Math.floor(d * 3.2))];
      const a = e < 0.85 ? 1 : 0.45;
      const i = (y * n + x) * 4;
      px[i] = c[0] * a;
      px[i + 1] = c[1] * a;
      px[i + 2] = c[2] * a;
      px[i + 3] = 255;
    }
  }
  return px;
}

export const ROCK_PX = 14;

/** A boulder the golem hurls: rough stone with a vein of earth-crystal. */
export function thrownRock(): PixelCanvas {
  const c = new PixelCanvas(ROCK_PX, ROCK_PX);
  c.part();
  c.ellipse(7, 7, 5.6, 5, ROCK);
  c.ellipse(5, 6, 3.2, 3, ROCK);
  for (let k = 0; k < 4; k++) c.shade(8 + k, 5 + k * 0.6, -1);
  c.part();
  c.px(9, 8, earthCrystal(0.5));
  c.px(10, 8, earthCrystal(0.5));
  c.px(8, 9, earthCrystal(0.5));
  for (let x = 3; x <= 9; x++) c.px(x, Math.round(2.5 + Math.abs(x - 6) * 0.3), MOSS);
  return c;
}
