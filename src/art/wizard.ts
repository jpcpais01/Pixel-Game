// The wizard, drawn procedurally from a small rig.
//
// Every frame is a Pose (body lift, breathing, foot offsets, staff transform,
// magic trail...) fed to a per-direction draw function. Animations are just
// sequences of poses, so timing and motion stay easy to tweak.

import { PixelCanvas, cyl, sphere, type Vec3 } from './pixel';
import {
  BEARD,
  BOOT,
  CRYSTAL,
  EYE,
  GOLD,
  HAIR,
  LEATHER,
  MAGIC_CORE,
  MAGIC_DEEP,
  MAGIC_HOT,
  MAGIC_MID,
  ROBE,
  ROBE_INNER,
  SKIN,
  WOOD,
} from './palette';

export const FRAME_W = 24;
export const FRAME_H = 32;

export type Dir = 'down' | 'up' | 'left' | 'right';
export const DIRS: Dir[] = ['down', 'up', 'left', 'right'];

export interface Staff {
  /** Hand (grip) position in frame pixels. */
  hx: number;
  hy: number;
  /** Degrees; 0 = crystal straight up, positive turns clockwise. */
  angle: number;
  len: number;
  /** Where along the staff the hand holds it, 0 = bottom, 1 = top. */
  grip: number;
  /** Crystal hovers this far past the fork (0 = seated at the tip). */
  float: number;
}

export interface Pose {
  /** Whole body raised by this many pixels (walk passing frames). */
  lift: number;
  /** Upper body lowered by this many pixels (idle breathing). */
  breath: number;
  /** Hat tip sway, in pixels. */
  hat: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Robe hem sway in pixels. */
  hem: number;
  /** Free-arm swing in pixels. */
  arm: number;
  staff: Staff;
  /** Draw the staff behind the body. */
  staffBehind?: boolean;
  blink?: boolean;
  /** 0..1 crystal glow strength. */
  glow: number;
  /** Magic arc swept by the crystal: angles (deg) around the hand, newest last. */
  trail?: number[];
  /** Burst of light at the crystal (0..1). */
  flash?: number;
}

export interface FrameMeta {
  /** Crystal centre in frame pixels. */
  tipX: number;
  tipY: number;
  glow: number;
}

const RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// Shared parts

function staffGeom(s: Staff) {
  const a = s.angle * RAD;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const up = s.len * (1 - s.grip);
  const down = s.len * s.grip;
  const top = { x: s.hx + dx * up, y: s.hy + dy * up };
  const bottom = { x: s.hx - dx * down, y: s.hy - dy * down };
  const gem = { x: top.x + dx * (s.float + 1.6), y: top.y + dy * (s.float + 1.6) };
  return { dx, dy, top, bottom, gem };
}

function drawStaff(c: PixelCanvas, s: Staff, glow: number): { x: number; y: number } {
  const g = staffGeom(s);
  c.part();
  // Wood: lit from the left, with a couple of darker knots along the shaft.
  const woodN: Vec3 = { x: -0.45, y: 0.25, z: 0.86 };
  c.line(g.bottom.x, g.bottom.y, g.top.x, g.top.y, WOOD, () => woodN);
  const steps = Math.round(Math.max(Math.abs(g.top.x - g.bottom.x), Math.abs(g.top.y - g.bottom.y)));
  for (let i = 5; i < steps - 2; i += 7) {
    const t = i / steps;
    c.shade(Math.round(g.bottom.x + (g.top.x - g.bottom.x) * t), Math.round(g.bottom.y + (g.top.y - g.bottom.y) * t), -1);
  }
  // Fork cradling the crystal.
  if (s.float > 0) {
    const px = -g.dy;
    const py = g.dx;
    c.px(Math.round(g.top.x + px * 1.2 + g.dx * 0.8 - 0.5), Math.round(g.top.y + py * 1.2 + g.dy * 0.8 - 0.5), WOOD, { x: -0.6, y: 0.4, z: 0.7 });
    c.px(Math.round(g.top.x - px * 1.2 + g.dx * 0.8 - 0.5), Math.round(g.top.y - py * 1.2 + g.dy * 0.8 - 0.5), WOOD, { x: 0.6, y: 0.4, z: 0.7 });
  }
  // Crystal: a small faceted gem, brighter on its upper-left facet.
  c.part();
  const gx = g.gem.x;
  const gy = g.gem.y;
  const cg = 0.55 + glow * 0.45;
  c.ellipse(gx, gy, 1.55, 2.3, CRYSTAL, {
    glow: CRYSTAL.emissive! * cg,
    normal: (_x, _y, dx, dy) => {
      // Faceted: quantise the normal so the gem reads as cut, not round.
      const fx = dx < -0.2 ? -0.7 : dx > 0.2 ? 0.7 : 0;
      const fy = dy < -0.2 ? 0.6 : dy > 0.3 ? -0.6 : 0.1;
      return { x: fx, y: fy, z: 0.7 };
    },
  });
  return { x: gx, y: gy };
}

function drawTrail(c: PixelCanvas, s: Staff, angles: number[]): void {
  // A sweeping ribbon of light following the crystal around the hand.
  const r = s.len * (1 - s.grip) + s.float + 1.6;
  const n = angles.length;
  for (let k = 0; k < n - 1; k++) {
    const a0 = angles[k];
    const a1 = angles[k + 1];
    const seg = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 7));
    for (let j = 0; j <= seg; j++) {
      const a = (a0 + ((a1 - a0) * j) / seg) * RAD;
      const age = (k + j / seg) / (n - 1); // 0 = oldest, 1 = newest
      const x = s.hx + Math.sin(a) * r;
      const y = s.hy - Math.cos(a) * r;
      const col = age > 0.75 ? MAGIC_HOT : age > 0.4 ? MAGIC_MID : MAGIC_DEEP;
      c.spark(x, y, col, 0.35 + age * 0.65);
      // A thinner inner line gives the ribbon some width.
      if (age > 0.35) {
        const xi = s.hx + Math.sin(a) * (r - 1);
        const yi = s.hy - Math.cos(a) * (r - 1);
        c.spark(xi, yi, MAGIC_DEEP, age * 0.6);
      }
    }
  }
  // Loose sparkles flung off the arc.
  const last = angles[n - 1];
  for (let i = 0; i < 4; i++) {
    const a = (last - 25 - i * 28) * RAD;
    const rr = r + 1.5 + ((i * 7) % 3);
    c.spark(s.hx + Math.sin(a) * rr, s.hy - Math.cos(a) * rr, i % 2 ? MAGIC_HOT : MAGIC_MID, 0.8 - i * 0.15);
  }
}

function drawFlash(c: PixelCanvas, x: number, y: number, f: number): void {
  // Star-shaped burst: bright core, four rays, a faint ring.
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const ray = Math.round(2 + f * 3);
  for (let i = -ray; i <= ray; i++) {
    const a = 1 - Math.abs(i) / (ray + 1);
    c.spark(cx + i, cy, i === 0 ? MAGIC_CORE : MAGIC_HOT, a * f);
    if (i !== 0) c.spark(cx, cy + i, MAGIC_HOT, a * f);
  }
  const diag = Math.round(1 + f * 1.5);
  for (let i = 1; i <= diag; i++) {
    const a = (0.6 * f * (diag - i + 1)) / diag;
    c.spark(cx + i, cy + i, MAGIC_MID, a);
    c.spark(cx - i, cy + i, MAGIC_MID, a);
    c.spark(cx + i, cy - i, MAGIC_MID, a);
    c.spark(cx - i, cy - i, MAGIC_MID, a);
  }
  c.spark(cx, cy, MAGIC_CORE, 1);
}

function hand(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.ellipse(x, y, 1.2, 1.2, SKIN);
}

function sleeve(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number): void {
  // Wizard sleeves flare toward the cuff.
  c.part();
  const vx = hx - sx;
  const vy = hy - sy;
  const l = Math.hypot(vx, vy) || 1;
  const ex = hx - (vx / l) * 1.3;
  const ey = hy - (vy / l) * 1.3;
  c.capsule(sx, sy, ex, ey, 1.4, 2.0, ROBE);
}

/** Front/back robe body: rows top..hem, flaring toward the hem. */
function robeBody(c: PixelCanvas, cx: number, top: number, hem: number, sway: number): (y: number) => [number, number] {
  const edges = (y: number): [number, number] => {
    const u = (y + 0.5 - top) / (hem + 1 - top);
    const hw = 3.9 + 3.3 * Math.pow(Math.max(0, u), 1.35);
    const x = cx + sway * u * u;
    return [x - hw, x + hw];
  };
  c.part();
  c.shape(top, hem, edges, ROBE, (_x, _y, t, u) => cyl(t, 0.25 - u * 0.25));
  // Hem trim.
  const [l, r] = edges(hem);
  c.part();
  c.shape(hem, hem, () => [l, r], GOLD, (_x, _y, t) => cyl(t, -0.1));
  return edges;
}

function boot(c: PixelCanvas, x: number, y: number, side = false): void {
  c.part();
  if (side) {
    c.ellipse(x, y, 2.2, 1.25, BOOT, { flatten: 0.8 });
  } else {
    c.ellipse(x, y, 1.75, 1.3, BOOT, { flatten: 0.8 });
  }
}

/** Pointed hat. `bend` pushes the tip sideways; `cx` is the base centre. */
function hatCone(c: PixelCanvas, cx: number, tipY: number, baseY: number, baseHW: number, bend: number): void {
  c.part();
  c.shape(
    tipY,
    baseY,
    (y) => {
      const u = (y + 0.5 - tipY) / (baseY + 1 - tipY);
      const hw = 0.55 + (baseHW - 0.55) * Math.pow(u, 1.1);
      const x = cx + bend * Math.pow(1 - u, 2.0);
      return [x - hw, x + hw];
    },
    ROBE,
    (_x, _y, t, u) => cyl(t, 0.45 - u * 0.2),
  );
}

function hatBand(c: PixelCanvas, cx: number, y: number, hw: number): void {
  c.part();
  c.shape(y, y, () => [cx - hw, cx + hw], GOLD, (_x, _y, t) => cyl(t, 0.1));
}

function brim(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number): void {
  c.part();
  c.ellipse(cx, cy, rx, ry, ROBE, {
    normal: (_x, _y, dx, dy) => {
      // A slightly domed disc: mostly facing up, front lip facing us.
      const l = Math.hypot(dx * 0.55, 0.55 - dy * 0.35, 0.75);
      return { x: (dx * 0.55) / l, y: (0.55 - dy * 0.35) / l, z: 0.75 / l };
    },
  });
}

function star(c: PixelCanvas, x: number, y: number): void {
  c.part();
  const n: Vec3 = { x: -0.3, y: 0.4, z: 0.86 };
  c.px(x, y, GOLD, n, { bias: 1 });
  c.px(x - 1, y, GOLD, n);
  c.px(x + 1, y, GOLD, n);
  c.px(x, y - 1, GOLD, n);
  c.px(x, y + 1, GOLD, n);
}

// ---------------------------------------------------------------------------
// Directions

function drawDown(c: PixelCanvas, p: Pose): FrameMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;

  let tip = { x: 0, y: 0 };
  if (p.staffBehind) tip = drawStaff(c, p.staff, p.glow);

  boot(c, 9.5, 29.6 - p.footA);
  boot(c, 14.5, 29.6 - p.footB);

  const top = 16 + U;
  const hem = 28 + L;
  const edges = robeBody(c, cx, top, hem, p.hem);

  // Open robe front showing the darker inner layer.
  const belt = 21 + U;
  c.part();
  c.shape(belt + 1, hem - 1, (y) => {
    const u = (y - belt) / (hem - belt);
    const x = cx + p.hem * Math.pow((y + 0.5 - top) / (hem + 1 - top), 2);
    return [x - 0.5 - u * 0.6, x + 0.5 + u * 0.6];
  }, ROBE_INNER, (_x, _y, t) => cyl(t * 0.5, 0.1));

  // Belt with buckle.
  const [bl, br] = edges(belt);
  c.part();
  c.shape(belt, belt, () => [bl, br], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(11, belt, GOLD, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
  c.px(12, belt, GOLD, { x: 0.2, y: 0.3, z: 0.9 });

  // Free arm (character's left, screen right).
  sleeve(c, 15.8, 17.2 + U, 17.6, 21.6 + U + p.arm);
  hand(c, 17.9, 22.4 + U + p.arm);

  // Head: face, sideburns, beard, nose, eyes.
  c.part();
  c.ellipse(cx, 13.4 + U, 3.7, 2.7, SKIN);
  c.part();
  c.shape(12 + U, 14 + U, () => [7.6, 9.2], BEARD, (_x, _y, t) => cyl(t - 0.6, 0.2));
  c.shape(12 + U, 14 + U, () => [14.8, 16.4], BEARD, (_x, _y, t) => cyl(t + 0.6, 0.2));
  c.part();
  const bw = [4.3, 4.1, 3.7, 3.1, 2.4, 1.7, 1.0];
  c.shape(14 + U, 20 + U, (y) => {
    const hw = bw[y - 14 - U];
    return [cx - hw, cx + hw];
  }, BEARD, (_x, _y, t, u) => sphere(t * 0.85, (u - 0.25) * 1.1, 0.9));
  // Strands.
  c.shade(10, 17 + U, -1);
  c.shade(13, 18 + U, -1);
  c.shade(11, 19 + U, -1);
  c.part();
  c.px(11, 14 + U, SKIN, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, SKIN, sphere(0.35, -0.2));
  c.part();
  if (p.blink) {
    c.px(10, 13 + U, SKIN, FLAT_DOWN, { bias: -1 });
    c.px(13, 13 + U, SKIN, FLAT_DOWN, { bias: -1 });
  } else {
    c.px(10, 13 + U, EYE);
    c.px(13, 13 + U, EYE);
  }

  // Hat.
  brim(c, cx, 10.7 + U, 8.6, 1.45);
  hatCone(c, cx, 1 + U, 9 + U, 4.9, 3.4 + p.hat);
  hatBand(c, cx, 9 + U, 4.9);
  star(c, 11, 5 + U);

  // Staff hand.
  if (!p.staffBehind) tip = drawStaff(c, p.staff, p.glow);
  sleeve(c, 8.2, 17.2 + U, p.staff.hx + 0.4, p.staff.hy - 0.3);
  hand(c, p.staff.hx, p.staff.hy);

  finishMagic(c, p, tip);
  return { tipX: tip.x, tipY: tip.y, glow: p.glow };
}

function drawUp(c: PixelCanvas, p: Pose): FrameMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;

  let tip = { x: 0, y: 0 };
  if (p.staffBehind) tip = drawStaff(c, p.staff, p.glow);

  boot(c, 9.5, 29.6 - p.footB);
  boot(c, 14.5, 29.6 - p.footA);

  const top = 16 + U;
  const hem = 28 + L;
  const edges = robeBody(c, cx, top, hem, p.hem);
  // A soft back seam.
  for (let y = top + 2; y < hem; y++) c.shade(12, y, -1);

  const belt = 21 + U;
  const [bl, br] = edges(belt);
  c.part();
  c.shape(belt, belt, () => [bl, br], LEATHER, (_x, _y, t) => cyl(t, 0));

  // Free arm (character's left, now screen left).
  sleeve(c, 8.2, 17.2 + U, 6.4, 21.6 + U + p.arm);
  hand(c, 6.1, 22.4 + U + p.arm);

  // Back of the head: long hair and beard edges.
  c.part();
  c.ellipse(cx, 13.6 + U, 4.0, 3.0, HAIR, {
    normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9),
  });
  c.part();
  c.shape(15 + U, 17 + U, (y) => {
    const hw = [3.4, 2.8, 1.8][y - 15 - U];
    return [cx - hw, cx + hw];
  }, HAIR, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 0.9));
  // Strands of hair.
  c.shade(10, 13 + U, -1);
  c.shade(10, 14 + U, -1);
  c.shade(12, 14 + U, -1);
  c.shade(12, 15 + U, -1);
  c.shade(14, 13 + U, -1);
  c.shade(13, 16 + U, -1);

  brim(c, cx, 10.7 + U, 8.6, 1.45);
  hatCone(c, cx, 1 + U, 9 + U, 4.9, -3.4 - p.hat);
  hatBand(c, cx, 9 + U, 4.9);

  if (!p.staffBehind) tip = drawStaff(c, p.staff, p.glow);
  sleeve(c, 15.8, 17.2 + U, p.staff.hx - 0.4, p.staff.hy - 0.3);
  hand(c, p.staff.hx, p.staff.hy);

  finishMagic(c, p, tip);
  return { tipX: tip.x, tipY: tip.y, glow: p.glow };
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): FrameMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 13;

  let tip = { x: 0, y: 0 };
  if (p.staffBehind) tip = drawStaff(c, p.staff, p.glow);

  // Back foot first, then front foot.
  boot(c, 14.2 - p.footB, 29.6 - Math.max(0, p.footB) * 0.35, true);
  boot(c, 11.2 - p.footA, 29.6 - Math.max(0, p.footA) * 0.35, true);

  const top = 16 + U;
  const hem = 28 + L;
  // Robe in profile: chest in front, flaring more toward the back.
  const edges = (y: number): [number, number] => {
    const u = Math.max(0, (y + 0.5 - top) / (hem + 1 - top));
    const sw = p.hem * u * u;
    const l = cx - 3.6 - 2.2 * Math.pow(u, 1.4) + sw;
    const r = cx + 2.6 + 3.6 * Math.pow(u, 1.2) + sw;
    return [l, r];
  };
  c.part();
  c.shape(top, hem, edges, ROBE, (_x, _y, t, u) => cyl(t * 0.9 - 0.1, 0.25 - u * 0.25));
  const [hl, hr] = edges(hem);
  c.part();
  c.shape(hem, hem, () => [hl, hr], GOLD, (_x, _y, t) => cyl(t, -0.1));
  const belt = 21 + U;
  const [bl, br] = edges(belt);
  c.part();
  c.shape(belt, belt, () => [bl, br], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(bl), belt, GOLD, { x: -0.5, y: 0.3, z: 0.8 }, { bias: 1 });
  // Front edge of the robe opening.
  for (let y = belt + 1; y < hem; y++) {
    const [l] = edges(y);
    c.px(Math.round(l) + 1, y, ROBE_INNER, cyl(-0.4, 0));
  }

  // Near arm sits under the beard; the hand is redrawn over the staff later.
  sleeve(c, cx + 0.8, 17.4 + U, p.staff.hx + 0.6, p.staff.hy - 0.4);
  hand(c, p.staff.hx, p.staff.hy);

  // Head: hair at the back, profile face, nose, beard.
  c.part();
  c.ellipse(cx + 1.2, 13.4 + U, 3.3, 2.8, HAIR, {
    normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 0.9),
  });
  c.part();
  c.ellipse(cx - 1.3, 13.4 + U, 2.8, 2.5, SKIN);
  c.part();
  c.px(cx - 5, 13 + U, SKIN, sphere(-0.6, -0.2), { bias: 1 });
  c.px(cx - 5, 14 + U, SKIN, sphere(-0.5, 0.3));
  c.part();
  const bw = [
    [cx - 4.4, cx + 0.6],
    [cx - 4.6, cx + 0.4],
    [cx - 4.6, cx + 0.0],
    [cx - 4.4, cx - 0.6],
    [cx - 4.0, cx - 1.2],
    [cx - 3.6, cx - 1.8],
  ];
  c.shape(14 + U, 19 + U, (y) => bw[y - 14 - U] as [number, number], BEARD, (_x, _y, t, u) => sphere(t * 0.8 - 0.1, (u - 0.2) * 1.1, 0.9), { bias: 1 });
  c.shade(cx - 3, 17 + U, -1);
  c.shade(cx - 2, 15 + U, -1);
  c.part();
  if (p.blink) c.px(cx - 3, 13 + U, SKIN, FLAT_DOWN, { bias: -1 });
  else c.px(cx - 3, 13 + U, EYE);

  // Hat: brim, then cone leaning back with the tip flopping behind.
  brim(c, cx - 0.4, 10.7 + U, 8.4, 1.45);
  hatCone(c, cx + 0.6, 1 + U, 9 + U, 4.6, 5.2 + p.hat);
  hatBand(c, cx + 0.6, 9 + U, 4.6);
  star(c, cx, 6 + U);

  if (!p.staffBehind) tip = drawStaff(c, p.staff, p.glow);
  hand(c, p.staff.hx, p.staff.hy);

  finishMagic(c, p, tip);
  return { tipX: tip.x, tipY: tip.y, glow: p.glow };
}

const FLAT_DOWN: Vec3 = { x: 0, y: -0.3, z: 0.95 };

function finishMagic(c: PixelCanvas, p: Pose, tip: { x: number; y: number }): void {
  if (p.trail && p.trail.length > 1) drawTrail(c, p.staff, p.trail);
  if (p.flash) drawFlash(c, tip.x, tip.y, p.flash);
  // A single bright glint at the heart of the crystal.
  c.spark(tip.x - 0.4, tip.y - 0.6, MAGIC_CORE, 0.35 + p.glow * 0.5);
}

// ---------------------------------------------------------------------------
// Animations

const IDLE_STAFF: Record<'down' | 'up' | 'side', Staff> = {
  down: { hx: 4.6, hy: 21.6, angle: 0, len: 23, grip: 0.38, float: 1.2 },
  up: { hx: 19.4, hy: 21.6, angle: 0, len: 23, grip: 0.38, float: 1.2 },
  side: { hx: 7.6, hy: 21.4, angle: -4, len: 23, grip: 0.38, float: 1.2 },
};

const base = (view: 'down' | 'up' | 'side'): Pose => ({
  lift: 0,
  breath: 0,
  hat: 0,
  footA: 0,
  footB: 0,
  hem: 0,
  arm: 0,
  staff: { ...IDLE_STAFF[view] },
  glow: 0.6,
});

function idle(view: 'down' | 'up' | 'side'): Pose[] {
  const frames: Pose[] = [];
  const N = 16;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 4; // two breaths per loop
    const p = base(view);
    p.breath = Math.sin(ph - 0.6) > 0.1 ? 1 : 0;
    p.hat = Math.sin(ph - 1.6) > 0.3 ? (view === 'side' ? -1 : 1) : 0;
    p.staff.hy += p.breath * 0.5;
    p.staff.float = 1.2 + Math.round(Math.sin((f / N) * Math.PI * 2) * 1);
    p.glow = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin((f / N) * Math.PI * 2));
    p.blink = f === 11;
    frames.push(p);
  }
  return frames;
}

function walk(view: 'down' | 'up' | 'side'): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0; // passing frames rise
    if (view === 'side') {
      p.footA = Math.round(s * 2.4);
      p.footB = -p.footA;
      p.hem = -Math.round(s * 1);
      p.hat = p.lift ? 0 : 1;
      p.staff.angle = -4 - s * 9;
      p.staff.hx += -s * 1.2;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.hem = Math.round(s * 0.9);
      p.arm = Math.round(-s * 1);
      p.hat = p.lift ? 1 : 0;
      p.staff.hy += s > 0 ? -1 : 0;
    }
    p.staff.hy -= p.lift;
    p.glow = 0.7;
    frames.push(p);
  }
  return frames;
}

/** Index of the frame in the cast animation that releases the projectile. */
export const CAST_RELEASE = 6;

// Twirl centre and release pose per view (shared by the cast and the beam).
const CAST_CFG = {
  down: {
    wind: { hx: 6.4, hy: 19.2, angle: -18, len: 21, grip: 0.4, float: 1.2 },
    spin: { hx: 12, hy: 18, len: 15, grip: 0.5 },
    release: { hx: 12, hy: 19.5, angle: 180, len: 12, grip: 0.3, float: 0 },
    recover: { hx: 6.2, hy: 20.6, angle: -8, len: 22, grip: 0.38, float: 1.2 },
    behindRelease: false,
  },
  up: {
    wind: { hx: 17.6, hy: 19.2, angle: 18, len: 21, grip: 0.4, float: 1.2 },
    spin: { hx: 16, hy: 11, len: 12, grip: 0.5 },
    release: { hx: 14.8, hy: 12.5, angle: -8, len: 13, grip: 0.3, float: 0 },
    recover: { hx: 17.8, hy: 20.6, angle: 8, len: 22, grip: 0.38, float: 1.2 },
    behindRelease: true,
  },
  side: {
    wind: { hx: 14.6, hy: 18.6, angle: 24, len: 21, grip: 0.4, float: 1.2 },
    spin: { hx: 9, hy: 17, len: 14, grip: 0.5 },
    release: { hx: 10, hy: 18, angle: -75, len: 11, grip: 0.3, float: 0 },
    recover: { hx: 9, hy: 20.4, angle: -14, len: 22, grip: 0.38, float: 1.2 },
    behindRelease: false,
  },
};

function cast(view: 'down' | 'up' | 'side'): Pose[] {
  const frames: Pose[] = [];
  const twirl = [30, 100, 170, 240, 310];
  const cfg = CAST_CFG[view];

  // 0: wind-up, gathering light.
  const w = base(view);
  w.staff = { ...cfg.wind };
  w.breath = 1;
  w.glow = 0.9;
  w.hat = view === 'side' ? -1 : 1;
  frames.push(w);

  // 1-5: the staff twirls around the hand, crystal carving an arc.
  twirl.forEach((a, i) => {
    const p = base(view);
    p.staff = { ...cfg.spin, angle: a, float: 0 };
    p.glow = 1;
    p.trail = [a - 150, a - 100, a - 50, a];
    p.hat = i % 2 ? 1 : 0;
    p.hem = view === 'side' ? (i % 2 ? 1 : 0) : 0;
    frames.push(p);
  });

  // 6: release, a burst at the crystal.
  const r = base(view);
  r.staff = { ...cfg.release };
  r.staffBehind = cfg.behindRelease;
  r.glow = 1;
  r.flash = 1;
  r.lift = 0;
  r.hem = view === 'side' ? 1 : 0;
  frames.push(r);

  // 7: follow-through, the burst fading.
  const h = base(view);
  h.staff = { ...cfg.release };
  h.staffBehind = cfg.behindRelease;
  h.glow = 0.85;
  h.flash = 0.45;
  frames.push(h);

  // 8: settle back toward idle.
  const s = base(view);
  s.staff = { ...cfg.recover };
  s.glow = 0.7;
  s.breath = 1;
  frames.push(s);
  return frames;
}

/** Beam, part 1: the staff swings from a wind-up to level at the target. */
function aim(view: 'down' | 'up' | 'side'): Pose[] {
  const cfg = CAST_CFG[view];
  const w = base(view);
  w.staff = { ...cfg.wind };
  w.breath = 1;
  w.glow = 0.9;
  w.hat = view === 'side' ? -1 : 1;

  const l = base(view);
  l.staff = { ...cfg.release };
  l.staffBehind = cfg.behindRelease;
  l.glow = 1;
  l.flash = 0.3;
  return [w, l];
}

/** Beam, part 2: braced and gathering light, the crystal thrumming at the staff's end. */
function charge(view: 'down' | 'up' | 'side'): Pose[] {
  const cfg = CAST_CFG[view];
  const flash = [0.25, 0.4, 0.55, 0.4];
  return flash.map((f, i) => {
    const p = base(view);
    p.staff = { ...cfg.release, float: i === 1 || i === 2 ? 1 : 0 };
    p.staffBehind = cfg.behindRelease;
    p.glow = 1;
    p.flash = f;
    p.breath = i === 1 || i === 2 ? 1 : 0;
    // The gathering magic stirs the robe and hat.
    p.hem = view === 'side' ? (i < 2 ? 1 : 0) : [0, 1, 0, -1][i];
    p.hat = i % 2 ? (view === 'side' ? -1 : 1) : 0;
    return p;
  });
}

/** Beam, part 3: firing. The staff kicks back against the beam's push. */
function fire(view: 'down' | 'up' | 'side'): Pose[] {
  const cfg = CAST_CFG[view];
  return [1, 0.8].map((f, i) => {
    const p = base(view);
    p.staff = { ...cfg.release };
    p.staffBehind = cfg.behindRelease;
    p.glow = 1;
    p.flash = f;
    p.hem = view === 'side' ? 1 : i ? 1 : -1;
    p.hat = view === 'side' ? -1 : 1;
    return p;
  });
}

// ---------------------------------------------------------------------------
// Frame generation

export type AnimName = 'idle' | 'walk' | 'cast' | 'aim' | 'charge' | 'beam';

export interface AnimDef {
  name: AnimName;
  fps: number;
  loop: boolean;
  poses: (view: 'down' | 'up' | 'side') => Pose[];
}

export const ANIMS: AnimDef[] = [
  { name: 'idle', fps: 8, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'cast', fps: 15, loop: false, poses: cast },
  { name: 'aim', fps: 14, loop: false, poses: aim },
  { name: 'charge', fps: 10, loop: true, poses: charge },
  { name: 'beam', fps: 16, loop: true, poses: fire },
];

export interface WizardFrame {
  key: string; // e.g. "walk_left_3"
  anim: AnimName;
  dir: Dir;
  index: number;
  canvas: PixelCanvas;
  meta: FrameMeta;
}

export function drawWizardFrame(dir: Dir, pose: Pose): { canvas: PixelCanvas; meta: FrameMeta } {
  const c = new PixelCanvas(FRAME_W, FRAME_H);
  let meta: FrameMeta;
  if (dir === 'down') meta = drawDown(c, pose);
  else if (dir === 'up') meta = drawUp(c, pose);
  else {
    meta = drawSide(c, pose);
    if (dir === 'right') {
      return { canvas: c.mirrored(), meta: { ...meta, tipX: FRAME_W - meta.tipX } };
    }
  }
  return { canvas: c, meta };
}

export function buildWizardFrames(): WizardFrame[] {
  const out: WizardFrame[] = [];
  for (const a of ANIMS) {
    for (const dir of DIRS) {
      const view = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        const { canvas, meta } = drawWizardFrame(dir, pose);
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, index, canvas, meta });
      });
    }
  }
  return out;
}
