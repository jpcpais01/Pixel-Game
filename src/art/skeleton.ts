// The necromancer's risen dead: small skeletons that claw their way up out of
// the ground, shamble after his foes with rusted blades, and fall back to a
// heap of bones when their time is up. Drawn facing right and mirrored, like
// the monsters, with soul fire in their sockets.

import { PixelCanvas, hex, sphere, type Material } from './pixel';
import { BONE, NECRO_INNER, SOUL_HOT, SOUL_MID } from './palette';
import { sheet, type MonsterSheet } from './monsters';

export const SKELETON_FRAME = { w: 22, h: 24, ox: 11, oy: 22 };
/** Where the risen hit, measured from their feet. */
export const SKELETON_BODY_Y = 9;

const EARTH: Material = { ramp: [hex('#2a1c16'), hex('#4a3224'), hex('#6a4a34'), hex('#8a6646')], outline: hex('#140c0a') };
const RUST: Material = { ramp: [hex('#3a2a26'), hex('#6a5a58'), hex('#9a9aa4'), hex('#c8ccd6')], outline: hex('#141418'), shine: true };

interface SkelPose {
  /** Walk phase 0..3. */
  step?: number;
  /** Sword arm: 0 raised back, 1 swung through. */
  swing?: number;
  /** How far out of the ground, 0..1 (below the ground line is cut away). */
  rise?: number;
  /** Falling apart, 0..1. */
  crumble?: number;
  /** Bob, in pixels. */
  bob?: number;
}

function skeleton(p: SkelPose): PixelCanvas {
  const c = new PixelCanvas(SKELETON_FRAME.w, SKELETON_FRAME.h);
  const g = SKELETON_FRAME.oy; // the ground row
  const rise = p.rise ?? 1;
  const sink = Math.round((1 - rise) * 17);
  const cr = p.crumble ?? 0;
  if (cr > 0) return heap(c, g, cr);
  const y0 = sink + (p.bob ?? 0);
  const step = p.step ?? 0;
  const swing = p.swing ?? 0.75;
  const leg = (hx: number, phase: number, far: boolean) => {
    const f = [1.2, 0, -1.2, 0][(step + phase) % 4];
    const lift = [0, 0.8, 0, 0.8][(step + phase) % 4];
    c.part();
    c.capsule(hx, 14.6 + y0, hx + f * 0.6 + 0.3, 17.8 + y0 - lift * 0.4, 0.6, 0.55, BONE, { bias: far ? -1 : 0 });
    c.capsule(hx + f * 0.6 + 0.3, 17.8 + y0 - lift * 0.4, hx + f, 21 + y0 - lift, 0.55, 0.5, BONE, { bias: far ? -1 : 0 });
    c.part();
    c.capsule(hx + f, 21.2 + y0 - lift, hx + f + 1.4, 21.2 + y0 - lift, 0.55, 0.5, BONE, { bias: far ? -1 : 0 });
  };
  // Far arm and leg, in shade.
  leg(10.2, 2, true);
  c.part();
  c.capsule(9.4, 10.4 + y0, 8.6 - swing, 13.2 + y0, 0.5, 0.45, BONE, { bias: -1 });
  c.capsule(8.6 - swing, 13.2 + y0, 9.4 - swing * 0.5, 15.4 + y0, 0.45, 0.45, BONE, { bias: -1 });
  // Pelvis, the hollow of the chest, the spine through it and two hoops of rib.
  c.part();
  c.ellipse(10.9, 14.6 + y0, 1.6, 0.8, BONE, { normal: (_x, _y, dx, dy) => sphere(dx, dy - 0.3, 1) });
  c.part();
  c.ellipse(11.4, 11.6 + y0, 2.0, 1.9, NECRO_INNER, { normal: () => sphere(0, 0.3, 1) });
  c.part();
  c.line(11, 9 + y0, 11, 14 + y0, BONE, (i, n) => sphere(-0.2, i / n - 0.5), { bias: -1 });
  for (const [y, w] of [[10, 2.2], [12, 1.8]] as const) {
    c.part();
    c.line(11.2 - w, y + y0, 11.6 + w, y + y0, BONE, (i, n) => sphere((i / n) * 1.6 - 0.8, -0.2));
  }
  leg(11.4, 0, false);
  // The skull, jaw hanging.
  c.part();
  c.ellipse(12.2, 6.3 + y0, 2.6, 2.4, BONE);
  c.part();
  c.shape(Math.round(8.4 + y0), Math.round(8.9 + y0), () => [11.2, 14.4], BONE, (_x, _y, t) => sphere(t * 0.7, 0.5, 1), { bias: -1 });
  for (const [x, y] of [[12, 6], [14, 6]] as const) {
    c.px(x, y + y0, NECRO_INNER);
    c.spark(x, y + y0, SOUL_HOT, 0.9);
  }
  c.spark(15, 6 + y0, SOUL_MID, 0.35);
  c.shade(13, 7 + y0, -2);
  c.shade(12, 9 + y0, -1);
  c.shade(14, 9 + y0, -1);
  // The near arm and its rusted blade.
  const sa = (-2.4 + swing * 3.0);
  const hx = 12.4 + Math.cos(sa) * 3.8;
  const hy = 10.6 + y0 + Math.sin(sa) * 3.8 + 1;
  c.part();
  c.capsule(11.6, 10.6 + y0, (11.6 + hx) / 2 - 0.4, (10.6 + y0 + hy) / 2 + 0.8, 0.55, 0.5, BONE);
  c.capsule((11.6 + hx) / 2 - 0.4, (10.6 + y0 + hy) / 2 + 0.8, hx, hy, 0.5, 0.5, BONE);
  const bx = Math.cos(sa + 0.35);
  const by = Math.sin(sa + 0.35);
  c.part();
  c.line(hx + bx * 1.2, hy + by * 1.2, hx + bx * 6.4, hy + by * 6.4, RUST, (i, n) => sphere(-0.3, i / n - 0.6));
  c.part();
  c.line(hx - by * 1.2, hy + bx * 1.2, hx + by * 1.2, hy - bx * 1.2, EARTH);
  c.ellipse(hx, hy, 0.8, 0.8, BONE);
  // Cut away whatever is still under the ground, and heap earth round the hole.
  if (sink > 0) {
    for (let y = g + 1; y < SKELETON_FRAME.h; y++) for (let x = 0; x < SKELETON_FRAME.w; x++) c.erase(x, y);
    mound(c, g, 1 - rise * 0.6);
  }
  return c;
}

/** Churned earth round a grave's mouth. */
function mound(c: PixelCanvas, g: number, size: number): void {
  c.part();
  c.shape(g - 1, g + 1, (y) => {
    const hw = (y === g - 1 ? 3.2 : 5.4) * (0.5 + size * 0.5);
    return [11 - hw, 11 + hw];
  }, EARTH, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.5, 1));
  for (const x of [6, 9, 13, 16]) c.shade(x, g, -1);
}

/** Fallen apart: bones slumped into a heap, the skull rolling off it, the light going out of it. */
function heap(c: PixelCanvas, g: number, cr: number): PixelCanvas {
  const drop = Math.min(1, cr * 1.4);
  c.part();
  c.capsule(8, g - 1 - (1 - drop) * 6, 13.5, g - 0.6, 0.55, 0.5, BONE, { bias: -1 });
  c.capsule(7.5, g - 0.4, 12, g - 2 - (1 - drop) * 4, 0.55, 0.55, BONE);
  c.part();
  c.ellipse(10.5, g - 1.2 - (1 - drop) * 5, 2.2, 1.1, BONE);
  c.part();
  c.capsule(12, g - 0.3, 16, g - 1.2, 0.5, 0.5, RUST);
  const sx = 13 + drop * 3;
  const sy = g - 2 - (1 - drop) * 8;
  c.part();
  c.ellipse(sx, sy, 2.1, 1.9, BONE);
  c.px(sx, sy, NECRO_INNER);
  if (cr < 0.6) c.spark(sx, sy, SOUL_MID, 0.7 * (1 - cr));
  if (cr < 0.3) c.spark(sx - 3, sy - 2, SOUL_HOT, 0.6);
  return c;
}

export function buildSkeletonSheet(): MonsterSheet {
  return sheet(
    SKELETON_FRAME,
    {
      rise0: () => skeleton({ rise: 0.15, swing: 0 }),
      rise1: () => skeleton({ rise: 0.4, swing: 0 }),
      rise2: () => skeleton({ rise: 0.65, swing: 0.1 }),
      rise3: () => skeleton({ rise: 0.88, swing: 0.2 }),
      idle0: () => skeleton({}),
      idle1: () => skeleton({ bob: 1, swing: 0.7 }),
      walk0: () => skeleton({ step: 0 }),
      walk1: () => skeleton({ step: 1, bob: -1 }),
      walk2: () => skeleton({ step: 2 }),
      walk3: () => skeleton({ step: 3, bob: -1 }),
      hit0: () => skeleton({ swing: 0.05 }),
      hit1: () => skeleton({ swing: 1.25, step: 2 }),
      hit2: () => skeleton({ swing: 1.05 }),
      fall0: () => skeleton({ crumble: 0.15 }),
      fall1: () => skeleton({ crumble: 0.45 }),
      fall2: () => skeleton({ crumble: 0.8 }),
      fall3: () => skeleton({ crumble: 1 }),
    },
    [
      { name: 'rise', frames: ['rise0', 'rise1', 'rise2', 'rise3', 'idle0'], fps: 10, loop: false },
      { name: 'idle', frames: ['idle0', 'idle0', 'idle1', 'idle1'], fps: 5, loop: true },
      { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 9, loop: true },
      { name: 'hit', frames: ['hit0', 'hit0', 'hit1', 'hit2', 'idle0'], fps: 12, loop: false },
      { name: 'fall', frames: ['fall0', 'fall1', 'fall2', 'fall3'], fps: 10, loop: false },
    ],
  );
}

/** Frame index in the 'hit' animation where the blade lands. */
export const SKELETON_STRIKE_FRAME = 2;
