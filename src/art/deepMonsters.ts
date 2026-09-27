// The Glimmerdeep's creatures, drawn like the other monsters (lit, with a
// glow layer, facing right and mirrored):
//   - The sporeling: a little walking mushroom, its cap pricked with glowing
//     spots, two beady eyes under the rim. It puffs up and bursts out spores.
//   - The glimbat: a cave bat with glowing ears and eyes, its wing membranes
//     veined with cyan light.
//   - The myconid: a fungal shaman, a stalk of a body under a broad magenta
//     cap, leaning on a gnarled staff crowned with a glowing puffball.
//   - The shardling: a crab of dark rock with amethyst growing on its back
//     and claws of crystal.
//   - The geodeback: a hulking beast whose back is a great geode, split open
//     on a bed of glowing amethyst; tusked, and heavy enough to shake the cave.

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, cyl, hex, sphere, FLAT, type Material, type RGB, type Vec3 } from './pixel';
import { rng } from './env';

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#07050c');
const WHITE = hex('#ffffff');
const CYAN = hex('#5ae4ff');
const MAGENTA = hex('#ff6ad8');
const AMETHYST = hex('#b37aff');
const AMETHYST_HOT = hex('#ead8ff');

/** Particle tints for each creature's bursts. */
export const SPORELING_TINTS = [0x5ae4ff, 0xc8f8ff, 0x9ad0ff, 0xffffff];
export const GLIMBAT_TINTS = [0x5ae4ff, 0x6a4a9a, 0xc8f8ff, 0x3a2a5a];
export const MYCONID_TINTS = [0xff6ad8, 0xffd0f4, 0xc048b0, 0xe8e0f0];
export const SHARD_TINTS = [0xb37aff, 0xead8ff, 0x7240bc, 0x4a4060];
export const GEODE_TINTS = [0xb37aff, 0xead8ff, 0x6a6284, 0x9c68e8];
/** Spores drifting off a burst puffball or a spore cloud. */
export const SPORE_TINTS = [0xff6ad8, 0xffb0ec, 0x5ae4ff, 0xe8fffa];

const HOLLOW: Material = { ramp: ramp('#040308', '#0a0812'), outline: INK, noAO: true, noOutline: true };
const STEM: Material = { ramp: ramp('#2a3040', '#3e4658', '#566076', '#728098', '#96a4bc', '#c0ccdc'), outline: INK, outlineLit: hex('#1a2030') };
const CAP_CYAN: Material = { ramp: ramp('#0a1a3a', '#10305a', '#16508a', '#1e74b8', '#34a0dc', '#6ad0f4'), outline: hex('#050c1c'), outlineLit: hex('#0e2448'), emissive: 0.3, shine: true };
const CAP_MAGENTA: Material = { ramp: ramp('#2a0a34', '#46105a', '#6a1a84', '#9028a8', '#c044c8', '#f07ae0'), outline: hex('#14041c'), outlineLit: hex('#360c44'), emissive: 0.3, shine: true };
const SPOT = (g: string): Material => ({ ramp: ramp(g, '#ffffff'), outline: INK, emissive: 1, noAO: true, noOutline: true });
const EYE_C: Material = { ramp: ramp('#5ae4ff', '#e8ffff'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const EYE_V: Material = { ramp: ramp('#b37aff', '#f4ecff'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const FUR: Material = { ramp: ramp('#0e0a16', '#1a1428', '#2a203e', '#3a2c54', '#4c3a6a'), outline: INK, outlineLit: hex('#1c1430') };
const WING: Material = { ramp: ramp('#140e22', '#22183a', '#342456', '#48326e'), outline: INK, emissive: 0.12 };
const BONE_M: Material = { ramp: ramp('#4e493f', '#7a7362', '#a8a08a', '#d2cab2', '#efe8d4'), outline: INK };
const WOOD: Material = { ramp: ramp('#1a120e', '#2a1e16', '#3e2c1e', '#564028', '#6e5434'), outline: INK };
const ROCK: Material = { ramp: ramp('#100e18', '#1a1726', '#262236', '#332e48', '#433c5a', '#554d6e', '#6a6284'), outline: INK, outlineLit: hex('#221e32') };
const HIDE: Material = { ramp: ramp('#15131c', '#221f2c', '#302c3c', '#403a4e', '#524a62', '#665d78'), outline: INK, outlineLit: hex('#26222e') };
const CRYSTAL: Material = { ramp: ramp('#2a1450', '#4a2484', '#7240bc', '#9c68e8', '#c8a0ff', '#f0e2ff'), outline: hex('#12062a'), emissive: 0.6, shine: true, noAO: true };
const CRYSTAL_DARK: Material = { ramp: ramp('#1c0c38', '#321660', '#4e2890', '#6a3cb4'), outline: hex('#12062a'), emissive: 0.4, noAO: true };

/** Fill a polygon (points in pixel coordinates). */
export function poly(c: PixelCanvas, pts: [number, number][], m: Material, normal: (x: number, y: number) => Vec3 = () => FLAT): void {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) c.px(x, y, m, normal(x, y));
    }
  }
}

/** A crystal shard from its base (bx, by) to its tip (tx, ty), `r` wide at the base, lit facets left and dark right. */
export function shard(c: PixelCanvas, bx: number, by: number, tx: number, ty: number, r: number, m: Material, glint = true): void {
  const len = Math.hypot(tx - bx, ty - by) || 1;
  const ux = (tx - bx) / len;
  const uy = (ty - by) / len;
  const nx = -uy;
  const ny = ux;
  const mid = 0.72;
  const pts: [number, number][] = [
    [bx + nx * r, by + ny * r],
    [bx + ux * len * mid + nx * r * 0.8, by + uy * len * mid + ny * r * 0.8],
    [tx, ty],
    [bx + ux * len * mid - nx * r * 0.8, by + uy * len * mid - ny * r * 0.8],
    [bx - nx * r, by - ny * r],
  ];
  poly(c, pts, m, (x, y) => {
    const s = (x + 0.5 - bx) * nx + (y + 0.5 - by) * ny;
    // The facet turned toward the light (up and to the left) is the lit one.
    return s * -(nx + ny) > 0 ? { x: -0.6, y: 0.3, z: 0.7 } : { x: 0.55, y: 0.1, z: 0.7 };
  });
  if (glint) c.spark(tx - ux, ty - uy, AMETHYST_HOT, 0.8);
}

// ---------------------------------------------------------------- Sporeling

interface SporelingPose {
  /** 0..1 phase of the bob. */
  t: number;
  /** Walking: which step. */
  step?: number;
  /** 0..1 puffed up to burst. */
  swell?: number;
  burst?: boolean;
}

function sporeling(p: SporelingPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.sporeling;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const sw = p.swell ?? 0;
  const bob = Math.round(Math.sin(tau) * 0.6 + (p.step !== undefined ? Math.abs(Math.sin(p.step * Math.PI * 0.5)) * -1 : 0));
  const cx = 10;
  const foot = 20;
  // Legs.
  c.part();
  const lift = p.step === undefined ? [0, 0] : p.step % 2 ? [1.5, 0] : [0, 1.5];
  c.capsule(cx - 2.5, foot - 3, cx - 2.5, foot - 0.8 - lift[0], 1.2, 1, STEM);
  c.capsule(cx + 2, foot - 3, cx + 2, foot - 0.8 - lift[1], 1.2, 1, STEM);
  // A plump pale body.
  c.part();
  const by = foot - 5 + sw * 1 + bob;
  c.ellipse(cx, by, 4.3 + sw * 0.8, 3.6 - sw * 0.8, STEM);
  // Eyes under the rim, looking ahead.
  c.part();
  const ey = by - 1.5;
  c.px(cx + 1, ey, HOLLOW);
  c.px(cx + 3, ey, HOLLOW);
  c.spark(cx + 1, ey, CYAN, 0.5);
  c.spark(cx + 3, ey, CYAN, 0.5);
  if (p.burst) {
    c.px(cx + 2, ey + 2, HOLLOW);
    c.px(cx + 3, ey + 2, HOLLOW);
  }
  // The cap: a dome, swelling as it gathers its spores.
  c.part();
  const top = by - 11 + (p.burst ? 3 : 0) - sw;
  const bot = by - 3;
  const hw = 7.2 + sw * 1.6 + (p.burst ? 1.4 : 0);
  c.shape(Math.round(top), Math.round(bot), (y) => {
    const u = (y - top) / (bot - top);
    const w0 = 1.2 + Math.sin(Math.min(1, u * 1.1) * Math.PI * 0.5) * hw;
    return [cx - w0, cx + w0];
  }, CAP_CYAN, (_x, y, t) => sphere(t * 0.95, ((y - top) / (bot - top)) * 1.4 - 0.9, 0.9));
  for (let x = -7; x <= 7; x++) c.shade(cx + x, bot, -1);
  // Glowing spots.
  c.part();
  const s = SPOT('#7ae8ff');
  for (const [dx, dy] of [[-3, 2], [2, 1.5], [-1, 4.5], [4, 4.5], [-5, 5.2]] as const) c.px(cx + dx * (1 + sw * 0.15), top + dy * (1 + sw * 0.1), s);
  if (sw > 0.4 || p.burst) {
    const R = rng(Math.round(sw * 10) + (p.burst ? 7 : 0));
    for (let k = 0; k < 8; k++) c.spark(cx + (R() - 0.5) * 18, top + R() * 10 - 2, k % 2 ? CYAN : MAGENTA, 0.4 + R() * 0.4);
  }
  return c;
}

export function buildSporelingSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => sporeling({ t: i / 4 })));
  [0, 1, 2, 3].forEach((i) => (poses[`walk${i}`] = () => sporeling({ t: 0, step: i })));
  poses.swell0 = () => sporeling({ t: 0, swell: 0.5 });
  poses.swell1 = () => sporeling({ t: 0.5, swell: 1 });
  poses.burst = () => sporeling({ t: 0, burst: true });
  return sheet(MONSTER_FRAME.sporeling, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 5, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 10, loop: true },
    { name: 'windup', frames: ['swell0', 'swell1'], fps: 5, loop: true },
  ]);
}

// ---------------------------------------------------------------- Glimbat

interface BatPose {
  /** Wing beat: -1 up .. 1 down. */
  beat: number;
  dive?: boolean;
}

function glimbat(p: BatPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.glimbat;
  const c = new PixelCanvas(w, h);
  const cx = 16;
  const by = 12;
  const beat = p.beat;
  // Wings: bones from the shoulder to each finger, membranes stretched between.
  const wing = (side: 1 | -1) => {
    c.part();
    const sx = cx + side * 2.5;
    const sy = by - 1;
    let fingers: [number, number][];
    if (p.dive) fingers = [[sx + side * 7, sy - 5], [sx + side * 9, sy - 1], [sx + side * 7, sy + 3]];
    else {
      const tipY = sy - 6 + (beat + 1) * 6.5;
      const reach = 13 - Math.abs(beat) * 2;
      fingers = [[sx + side * reach * 0.6, tipY - 3], [sx + side * reach, tipY], [sx + side * reach * 0.85, tipY + 5]];
    }
    const pts: [number, number][] = [[sx, sy - 1], ...fingers];
    // Scalloped trailing edge back toward the body.
    pts.push([sx + side * 3, sy + 4]);
    pts.push([sx, sy + 2]);
    poly(c, pts, WING, (x) => ({ x: side * 0.2 * (x - sx) / 10, y: -beat * 0.5, z: 0.85 }));
    // Glowing veins along the finger bones.
    for (const [fx, fy] of fingers) {
      const n = Math.ceil(Math.hypot(fx - sx, fy - sy));
      for (let k = 1; k < n; k++) c.spark(sx + ((fx - sx) * k) / n, sy - 1 + ((fy - sy + 1) * k) / n, CYAN, 0.28);
      c.spark(fx, fy, CYAN, 0.6);
    }
  };
  wing(-1);
  wing(1);
  // Body and head.
  c.part();
  c.ellipse(cx, by + 1.5, 3.4, 4.2, FUR);
  c.part();
  c.ellipse(cx + 1.5, by - 3.5, 3.3, 2.9, FUR);
  // Ears, glowing at the tips.
  c.part();
  poly(c, [[cx - 0.5, by - 5], [cx - 0.2, by - 10], [cx + 1.5, by - 6]], FUR);
  poly(c, [[cx + 2, by - 6], [cx + 3.8, by - 10], [cx + 4.2, by - 5]], FUR);
  c.spark(cx - 0.2, by - 9, CYAN, 0.8);
  c.spark(cx + 3.7, by - 9, CYAN, 0.8);
  // Eyes and fangs.
  c.part();
  c.px(cx + 2, by - 4, EYE_C);
  c.px(cx + 4, by - 4, EYE_C);
  c.px(cx + 3, by - 1.5, BONE_M);
  // Little feet tucked under.
  c.part();
  c.px(cx - 1, by + 6, FUR);
  c.px(cx + 1, by + 6, FUR);
  return c;
}

export function buildGlimbatSheet(): MonsterSheet {
  const beats = [-1, -0.3, 0.6, 1, 0.3, -0.6];
  const poses: Record<string, () => PixelCanvas> = {};
  beats.forEach((b, i) => (poses[`fly${i}`] = () => glimbat({ beat: b })));
  poses.dive = () => glimbat({ beat: 0, dive: true });
  return sheet(MONSTER_FRAME.glimbat, poses, [
    { name: 'idle', frames: ['fly0', 'fly1', 'fly2', 'fly3', 'fly4', 'fly5'], fps: 12, loop: true },
    { name: 'walk', frames: ['fly0', 'fly1', 'fly2', 'fly3', 'fly4', 'fly5'], fps: 16, loop: true },
    { name: 'windup', frames: ['fly0', 'fly1', 'fly2', 'fly3', 'fly4', 'fly5'], fps: 22, loop: true },
  ]);
}

// ---------------------------------------------------------------- Myconid

type ShamanArm = 'rest' | 'raise' | 'throw';

interface MyconidPose {
  t: number;
  step?: number;
  arm: ShamanArm;
}

function myconid(p: MyconidPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.myconid;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const cx = 15;
  const foot = 39;
  const bob = p.step !== undefined ? (p.step % 2 ? -1 : 0) : Math.round(Math.sin(tau) * 0.5);
  // Root feet.
  c.part();
  const stride = p.step === undefined ? 0 : [2, 0, -2, 0][p.step % 4];
  c.capsule(cx - 3, foot - 4, cx - 4 - stride * 0.5, foot - 0.5, 2, 1.3, STEM);
  c.capsule(cx + 3, foot - 4, cx + 4 + stride * 0.5, foot - 0.5, 2, 1.3, STEM);
  // The staff, behind the near arm.
  const staff = p.arm === 'raise' ? { x0: cx + 9, y0: foot - 6, x1: cx + 11, y1: 6 } : p.arm === 'throw' ? { x0: cx + 5, y0: foot - 10, x1: cx + 15, y1: 14 } : { x0: cx + 9, y0: foot, x1: cx + 9, y1: 12 + bob };
  c.part();
  c.capsule(staff.x0, staff.y0, staff.x1, staff.y1, 1, 0.9, WOOD);
  c.part();
  const glowing = p.arm !== 'rest';
  c.ellipse(staff.x1, staff.y1 - 2, 2.6 + (glowing ? 0.6 : 0), 2.6 + (glowing ? 0.6 : 0), { ramp: ramp('#6a1a84', '#c044c8', '#ff8ae8', '#ffd8f8'), outline: INK, emissive: glowing ? 0.95 : 0.6, noAO: true });
  c.spark(staff.x1 - 1, staff.y1 - 3, WHITE, 0.8);
  // Its stalk of a body, fibrous.
  c.part();
  const top = 17 + bob;
  c.shape(top, foot - 3, (y) => {
    const u = (y - top) / (foot - 3 - top);
    const hw = 4.4 + u * 2.2;
    return [cx - hw, cx + hw];
  }, STEM, (_x, _y, t) => cyl(t, 0.15));
  const R = rng(p.step ?? 9);
  for (let k = 0; k < 7; k++) {
    const x = cx - 4 + R() * 8;
    for (let y = top + 6 + R() * 6; y < foot - 5; y += 1) if (R() < 0.7) c.shade(x, y, -1);
  }
  // Glowing eyes on the stalk, under the cap's shadow.
  c.part();
  c.px(cx + 1, top + 3, EYE_C);
  c.px(cx + 4, top + 3, EYE_C);
  c.px(cx + 1, top + 4, HOLLOW);
  c.px(cx + 4, top + 4, HOLLOW);
  // The near arm, holding the staff.
  c.part();
  const handY = p.arm === 'raise' ? 14 : p.arm === 'throw' ? 22 : foot - 14 + bob;
  const handX = p.arm === 'raise' ? cx + 10 : p.arm === 'throw' ? cx + 10 : cx + 9;
  c.capsule(cx + 3, top + 7, handX, handY, 1.7, 1.4, STEM);
  // The far arm, raised in a spell or hanging.
  c.part();
  if (p.arm === 'raise') c.capsule(cx - 3, top + 7, cx - 7, top - 1, 1.6, 1.2, STEM);
  else c.capsule(cx - 3, top + 7, cx - 6, top + 14, 1.6, 1.2, STEM);
  // The cap: broad and flat, magenta, spotted; its gills alight under the rim.
  c.part();
  const capTop = 5 + bob;
  const capBot = top + 1;
  c.shape(capTop, capBot, (y) => {
    const u = (y - capTop) / (capBot - capTop);
    const hw = 3 + Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5) * 11;
    return [cx - 1 - hw, cx - 1 + hw];
  }, CAP_MAGENTA, (_x, y, t) => sphere(t * 0.95, ((y - capTop) / (capBot - capTop)) * 1.4 - 0.95, 0.9));
  for (let x = -12; x <= 10; x++) {
    c.shade(cx + x, capBot, -1);
    if (x % 2 === 0) c.spark(cx + x, capBot + 1, MAGENTA, 0.35);
  }
  c.part();
  const sp = SPOT('#ff9ae8');
  for (const [dx, dy] of [[-6, 3], [2, 2], [-2, 5], [6, 6], [-9, 7], [0, 8]] as const) c.px(cx + dx, capTop + dy, sp);
  if (p.arm !== 'rest') {
    const R2 = rng(p.arm.length * 13);
    for (let k = 0; k < 6; k++) c.spark(staff.x1 + (R2() - 0.5) * 10, staff.y1 - 2 + (R2() - 0.5) * 10, k % 2 ? MAGENTA : WHITE, 0.4 + R2() * 0.4);
  }
  return c;
}

export function buildMyconidSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1].forEach((i) => (poses[`idle${i}`] = () => myconid({ t: i / 2, arm: 'rest' })));
  [0, 1, 2, 3].forEach((i) => (poses[`walk${i}`] = () => myconid({ t: 0, step: i, arm: 'rest' })));
  poses.raise0 = () => myconid({ t: 0, arm: 'raise' });
  poses.raise1 = () => myconid({ t: 0.5, arm: 'raise' });
  poses.throw = () => myconid({ t: 0, arm: 'throw' });
  return sheet(MONSTER_FRAME.myconid, poses, [
    { name: 'idle', frames: ['idle0', 'idle1'], fps: 3, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 7, loop: true },
    { name: 'windup', frames: ['raise0', 'raise1'], fps: 6, loop: true },
  ]);
}

// ---------------------------------------------------------------- Shardling

type ClawPose = 'rest' | 'raise' | 'snip';

interface ShardPose {
  step?: number;
  claws: ClawPose;
  t: number;
}

function shardling(p: ShardPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.shardling;
  const c = new PixelCanvas(w, h);
  const cx = 12;
  const foot = 18;
  const by = 13 + (p.t > 0.5 ? 0 : 0) - (p.claws === 'raise' ? 1 : 0);
  // Six legs, three each side, scuttling.
  c.part();
  for (let k = 0; k < 3; k++) {
    for (const side of [-1, 1]) {
      const phase = ((p.step ?? 0) + k + (side > 0 ? 1 : 0)) % 2;
      const lx = cx + side * (3 + k * 1.8);
      const up = p.step !== undefined && phase ? 1.2 : 0;
      c.capsule(cx + side * (1 + k * 1.4), by + 1, lx + side * 1.5, foot - 0.5 - up, 0.9, 0.6, ROCK);
    }
  }
  // The shell, low and flat.
  c.part();
  c.ellipse(cx, by, 7.2, 4, ROCK);
  for (let x = -5; x <= 5; x += 2) c.shade(cx + x, by + 2, -1);
  // Amethyst growing on its back.
  c.part();
  shard(c, cx - 2, by - 1, cx - 4, by - 9, 1.8, CRYSTAL);
  c.part();
  shard(c, cx + 1, by - 1, cx + 2, by - 11, 2.2, CRYSTAL);
  c.part();
  shard(c, cx - 5, by + 0, cx - 8, by - 5, 1.3, CRYSTAL_DARK, false);
  c.part();
  shard(c, cx + 4, by, cx + 6, by - 6, 1.3, CRYSTAL_DARK, false);
  // Eyes on stalks.
  c.part();
  c.capsule(cx + 5, by - 2, cx + 6, by - 5, 0.6, 0.6, ROCK);
  c.px(cx + 6, by - 6, EYE_V);
  c.px(cx + 8, by - 5, EYE_V);
  // Claws of crystal.
  c.part();
  const clawX = p.claws === 'snip' ? cx + 13 : cx + 10;
  const clawY = p.claws === 'raise' ? by - 6 : p.claws === 'snip' ? by - 1 : by + 1;
  c.capsule(cx + 6, by + 1, clawX - 2, clawY, 1.2, 1, ROCK);
  c.part();
  const open = p.claws === 'raise' ? 2.2 : p.claws === 'snip' ? 0.3 : 1;
  shard(c, clawX - 2, clawY, clawX + 3, clawY - open - 1, 1.4, CRYSTAL);
  shard(c, clawX - 2, clawY + 0.5, clawX + 3, clawY + open, 1.1, CRYSTAL_DARK, false);
  return c;
}

export function buildShardlingSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1].forEach((i) => (poses[`idle${i}`] = () => shardling({ t: i / 2, claws: 'rest' })));
  [0, 1].forEach((i) => (poses[`walk${i}`] = () => shardling({ t: 0, step: i, claws: 'rest' })));
  poses.raise = () => shardling({ t: 0, claws: 'raise' });
  poses.snip = () => shardling({ t: 0, claws: 'snip' });
  return sheet(MONSTER_FRAME.shardling, poses, [
    { name: 'idle', frames: ['idle0', 'idle1'], fps: 3, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1'], fps: 12, loop: true },
    { name: 'windup', frames: ['raise'], fps: 1, loop: false },
  ]);
}

// ---------------------------------------------------------------- Geodeback

interface GeodePose {
  t: number;
  step?: number;
  /** Head lowered to charge. */
  lower?: boolean;
  charge?: boolean;
}

function geodeback(p: GeodePose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.geodeback;
  const c = new PixelCanvas(w, h);
  const foot = 39;
  const cx = 25;
  const breathe = p.step === undefined ? Math.round(Math.sin(p.t * Math.PI * 2) * 0.6) : p.step % 2 ? -1 : 0;
  const by = 27 + breathe + (p.lower ? 1 : 0);
  // Legs, heavy and short: the far pair first.
  const legs: [number, number][] = [[cx - 10, 0], [cx + 9, 1], [cx - 6, 1], [cx + 13, 0]];
  legs.forEach(([lx, near], k) => {
    c.part();
    const swing = p.charge ? (k % 2 ? 3 : -3) : p.step === undefined ? 0 : ((p.step + k) % 2 ? 1.5 : -1.5);
    c.capsule(lx, by + 4, lx + swing, foot - 1, 3.6, 3, near ? HIDE : { ...HIDE, bias: -1 });
    c.part();
    c.ellipse(lx + swing + 0.5, foot - 0.8, 3.4, 1.4, ROCK);
  });
  // A stub of a tail, clubbed with rock.
  c.part();
  c.capsule(cx - 15, by + 1, cx - 20, by + 4, 2.6, 2, HIDE);
  c.part();
  c.ellipse(cx - 21, by + 4.5, 3, 2.6, ROCK);
  // The body.
  c.part();
  c.ellipse(cx, by + 1, 16.5, 8.5, HIDE);
  for (let k = 0; k < 14; k++) {
    const R = rng(k * 7 + 1);
    c.shade(cx - 14 + R() * 28, by + 2 + R() * 6, -1);
  }
  // The geode on its back: a dome of rock split open on a bed of amethyst.
  c.part();
  c.ellipse(cx - 1, by - 6, 14, 8.5, ROCK);
  c.part();
  c.ellipse(cx - 1, by - 8.5, 9.5, 4.6, CRYSTAL_DARK, { normal: () => ({ x: 0, y: -0.3, z: 0.9 }) });
  const crystals: [number, number, number, number, number][] = [
    [-6, -8, -8, -15, 1.8],
    [-2, -8, -2, -18, 2.4],
    [2, -8, 4, -16, 2],
    [5, -8, 8, -13, 1.5],
    [-4, -7, -5, -12, 1.2],
    [1, -7, 1, -13, 1.4],
  ];
  for (const [bx, byy, tx, ty, r] of crystals) {
    c.part();
    shard(c, cx - 1 + bx, by + byy, cx - 1 + tx, by + ty, r, CRYSTAL);
  }
  // The rim of the split rock, jagged.
  c.part();
  for (let x = -10; x <= 8; x++) {
    const y = by - 4 - Math.round(Math.sqrt(Math.max(0, 1 - ((x + 1) / 10.5) ** 2)) * 2) + (x % 3 === 0 ? -1 : 0);
    c.px(cx + x, y, ROCK, { x: 0, y: 0.6, z: 0.8 });
  }
  // The head, heavy and low, with tusks and glowing eyes.
  c.part();
  const hx = cx + 17 + (p.charge ? 2 : 0);
  const hy = by + (p.lower ? 4 : 1);
  c.ellipse(hx, hy, 7, 5.6, HIDE);
  c.part();
  c.ellipse(hx + 5, hy + 2, 3.6, 2.8, HIDE);
  c.part();
  c.capsule(hx + 5, hy + 3.5, hx + 9, hy - 1.5, 1.1, 0.5, BONE_M);
  c.capsule(hx + 1, hy + 3.5, hx + 3, hy - 0.5, 0.9, 0.4, BONE_M);
  c.part();
  c.px(hx + 2, hy - 2, EYE_V);
  c.px(hx + 4, hy - 2, EYE_V);
  // Brow ridge of crystal.
  c.part();
  shard(c, hx - 2, hy - 4, hx - 5, hy - 9, 1.4, CRYSTAL);
  shard(c, hx + 1, hy - 4, hx + 1, hy - 8, 1.1, CRYSTAL_DARK, false);
  if (p.lower || p.charge) {
    // Snorting.
    c.spark(hx + 10, hy + 3, AMETHYST, 0.5);
    c.spark(hx + 11, hy + 1, AMETHYST_HOT, 0.4);
  }
  return c;
}

export function buildGeodebackSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1].forEach((i) => (poses[`idle${i}`] = () => geodeback({ t: i / 2 })));
  [0, 1, 2, 3].forEach((i) => (poses[`walk${i}`] = () => geodeback({ t: 0, step: i })));
  poses.lower0 = () => geodeback({ t: 0, lower: true });
  poses.lower1 = () => geodeback({ t: 0.5, lower: true, step: 1 });
  poses.charge0 = () => geodeback({ t: 0, charge: true, lower: true, step: 0 });
  poses.charge1 = () => geodeback({ t: 0, charge: true, lower: true, step: 1 });
  return sheet(MONSTER_FRAME.geodeback, poses, [
    { name: 'idle', frames: ['idle0', 'idle1'], fps: 2, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 5, loop: true },
    { name: 'windup', frames: ['lower0', 'lower1'], fps: 8, loop: true },
    { name: 'charge', frames: ['charge0', 'charge1'], fps: 12, loop: true },
  ]);
}

// ---------------------------------------------------------------- Spells

export const PUFF_W = 14;
export const PUFF_H = 14;
export const PUFF_FRAMES = 4;

/** A puffball swelling out of the floor (0 a bud .. 3 fit to burst). */
export function puffball(f: number): PixelCanvas {
  const c = new PixelCanvas(PUFF_W, PUFF_H);
  const r = 2.2 + f * 1.3;
  c.part();
  c.ellipse(7, 13 - r * 0.9, r, r * 0.9, { ramp: ramp('#46105a', '#9028a8', '#e060d0', '#ffb0f0', '#fff0fc'), outline: INK, emissive: 0.35 + f * 0.18, shine: true });
  c.part();
  for (const [dx, dy] of [[-1, -0.6], [0.6, 0.1], [-0.3, 0.5]] as const) c.px(7 + dx * r, 13 - r * 0.9 + dy * r, SPOT('#ffd0f4'));
  c.spark(6, 12 - r * 1.4, WHITE, 0.5);
  return c;
}

export const SPIKE_W = 16;
export const SPIKE_H = 24;
export const SPIKE_OY = 22;

/** Amethyst bursting up out of the floor. */
export function crystalSpike(v: number): PixelCanvas {
  const c = new PixelCanvas(SPIKE_W, SPIKE_H);
  c.part();
  c.ellipse(8, 21, 6.5, 2.2, ROCK, { flatten: 0.4 });
  const R = rng(v * 17 + 3);
  const set: [number, number, number, number, number][] = [
    [8, 22, 8 + (R() - 0.5) * 3, 2 + R() * 3, 2.4],
    [5, 22, 2 + R() * 1.5, 10 + R() * 3, 1.6],
    [11, 22, 13 + R() * 1.5, 9 + R() * 3, 1.7],
  ];
  set.forEach(([bx, by, tx, ty, r], k) => {
    c.part();
    shard(c, bx, by, tx, ty, r, k === 0 ? CRYSTAL : CRYSTAL_DARK, k === 0);
  });
  return c;
}
