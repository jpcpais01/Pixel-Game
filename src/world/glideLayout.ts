// Sky Glide's course: a long fall of sky south of the Floating Island, from
// the launch lip at its front edge down to the goal islet far below. Pure
// data and geometry, shared by the art (art/glide.ts) and the game
// (scenes/GlideScene.ts, game/glide.ts).
//
// Coordinates are world pixels, seen the game's usual way: x across, y down
// the screen (the course runs south), and z the height above the goal islet's
// meadow. A thing at height z is drawn z pixels higher up the screen than the
// spot it stands over, so its shadow lies z pixels below it.

import { frontEdgeY, ISLE_CX, BROOKS } from './islandLayout';
import { ISLAND_X, ISLAND_Y } from '../art/island';
import { rng } from '../art/env';

/** The course's id, for best times and ghosts (one course for now). */
export const COURSE_ID = 'skyfall';
export const COURSE_NAME = 'The Long Fall';

export const COURSE_W = 560;
export const COURSE_CX = 280;
/** Crosswinds past these push a glider back in. */
export const WALL_L = 44;
export const WALL_R = COURSE_W - 44;
/** The world's top and bottom (the island reaches north of y = 0). */
export const WORLD_TOP = -470;
export const WORLD_BOTTOM = 6020;

/** How high the island's meadow stands, and where its front lip is, straight south of its middle. */
export const START_Z = 120;
export const LAUNCH_Y = 140;
/** Where racers wait before the countdown, this far back from the lip. */
export const RUN_UP = 60;

/** Where the island image goes: its middle column's lip lands at the launch spot, START_Z up. */
export const ISLE_DX = COURSE_CX - ISLE_CX;
export const ISLE_DY = LAUNCH_Y - START_Z - frontEdgeY(ISLE_CX);
export const ISLE_IMG_X = ISLAND_X + ISLE_DX;
export const ISLE_IMG_Y = ISLAND_Y + ISLE_DY;
/** The island's brooks spill over the lip here (screen positions). */
export const ISLE_FALLS = BROOKS.map((b) => ({ x: b.fall.x + ISLE_DX, y: b.fall.y + ISLE_DY }));

/** The lip under column x, as ground y (the island's front edge bows north toward its sides). */
export function lipY(x: number): number {
  const e = frontEdgeY(Math.round(x - ISLE_DX));
  return e < 0 ? LAUNCH_Y : e + ISLE_DY + START_Z;
}

/** Below this, over open sky, a glider has sunk into the cloud sea. */
export const FALL_Z = -14;
/** The cloud deck's tops, where shadows fall over open sky. */
export const DECK_Z = -12;

// ---------------------------------------------------------------- What's in the sky

/** A ring to fly through: a hoop standing across the course at height z. */
export interface GlideRing {
  x: number;
  y: number;
  z: number;
  /** A big blue boost ring. */
  big?: boolean;
}

/** A column of rising air: inside `r` (over the ground), a glider rises at up to `lift` px/s. */
export interface Updraft {
  x: number;
  y: number;
  r: number;
  lift: number;
}

/** A river of fast wind from (x1, y1) to (x2, y2), `w` either side: it carries a glider along and speeds it up. */
export interface WindLane {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  push: number;
}

export type IsletKind = 'grove' | 'rock' | 'ruin' | 'beacon' | 'goal';

/**
 * A floating islet: a grassy top at height `top` over an ellipse (rx, ry)
 * round (x, y), its rock hanging `thick` below. A glider above it passes over
 * (a low one hops off its grass), one below its rock passes under, and one
 * in between strikes it.
 */
export interface SkyIslet {
  x: number;
  y: number;
  rx: number;
  ry: number;
  top: number;
  thick: number;
  kind: IsletKind;
  seed: number;
}

export const RINGS: GlideRing[] = [
  // Off the lip: a straight line down to learn the feel.
  { x: 280, y: 260, z: 114 },
  { x: 280, y: 380, z: 108 },
  { x: 280, y: 500, z: 102 },
  // Up the first updraft.
  { x: 280, y: 725, z: 117 },
  // A slalom.
  { x: 210, y: 860, z: 110 },
  { x: 350, y: 1000, z: 103 },
  { x: 210, y: 1140, z: 96 },
  { x: 350, y: 1280, z: 89 },
  // Through the gap between two islets.
  { x: 292, y: 1370, z: 86 },
  { x: 294, y: 1470, z: 80 },
  // Up the second updraft, then along the first wind river.
  { x: 400, y: 1705, z: 98 },
  { x: 362, y: 1850, z: 93 },
  { x: 300, y: 1990, z: 89 },
  { x: 240, y: 2130, z: 85 },
  // Past the first beacon.
  { x: 280, y: 2560, z: 70 },
  // Either updraft of the pair.
  { x: 170, y: 2725, z: 88 },
  { x: 400, y: 2830, z: 96 },
  // Weaving the islet garden.
  { x: 298, y: 2995, z: 88 },
  { x: 150, y: 3130, z: 82 },
  { x: 250, y: 3285, z: 76 },
  { x: 322, y: 3385, z: 72 },
  // The big ring, then a dive down the line.
  { x: 280, y: 3500, z: 70, big: true },
  { x: 280, y: 3600, z: 50 },
  { x: 280, y: 3700, z: 32 },
  { x: 280, y: 3790, z: 18 },
  // Zoom back up the strong updraft.
  { x: 280, y: 3965, z: 44 },
  { x: 280, y: 4045, z: 64 },
  { x: 280, y: 4125, z: 82 },
  // The second wind river.
  { x: 290, y: 4280, z: 86 },
  { x: 350, y: 4420, z: 82 },
  { x: 405, y: 4560, z: 78 },
  // Past the second beacon, and the last stretch.
  { x: 300, y: 4890, z: 66 },
  { x: 200, y: 5065, z: 74 },
  { x: 222, y: 5205, z: 64 },
  { x: 290, y: 5345, z: 56 },
  { x: 280, y: 5480, z: 44, big: true },
];

export const UPDRAFTS: Updraft[] = [
  { x: 280, y: 660, r: 36, lift: 42 },
  { x: 400, y: 1640, r: 34, lift: 44 },
  { x: 170, y: 2660, r: 34, lift: 44 },
  { x: 400, y: 2765, r: 34, lift: 44 },
  { x: 280, y: 3900, r: 40, lift: 58 },
  { x: 200, y: 5000, r: 34, lift: 44 },
  // Just short of the goal, for a glider that has come in low.
  { x: 280, y: 5580, r: 46, lift: 40 },
];

export const LANES: WindLane[] = [
  { x1: 392, y1: 1770, x2: 190, y2: 2250, w: 40, push: 55 },
  { x1: 250, y1: 4190, x2: 424, y2: 4610, w: 40, push: 55 },
];

export const ISLETS: SkyIslet[] = [
  // The gap pair.
  { x: 196, y: 1440, rx: 46, ry: 27, top: 92, thick: 50, kind: 'grove', seed: 3 },
  { x: 390, y: 1470, rx: 38, ry: 23, top: 64, thick: 42, kind: 'rock', seed: 7 },
  // First beacon.
  { x: 280, y: 2420, rx: 64, ry: 36, top: 44, thick: 62, kind: 'beacon', seed: 11 },
  // The islet garden.
  { x: 186, y: 2982, rx: 42, ry: 25, top: 112, thick: 46, kind: 'ruin', seed: 13 },
  { x: 384, y: 3060, rx: 46, ry: 27, top: 70, thick: 52, kind: 'grove', seed: 17 },
  { x: 252, y: 3200, rx: 36, ry: 22, top: 104, thick: 74, kind: 'rock', seed: 19 },
  { x: 414, y: 3310, rx: 34, ry: 21, top: 56, thick: 40, kind: 'rock', seed: 23 },
  // Second beacon.
  { x: 340, y: 4760, rx: 60, ry: 34, top: 34, thick: 58, kind: 'beacon', seed: 29 },
  // The last stretch.
  { x: 334, y: 5180, rx: 42, ry: 25, top: 60, thick: 46, kind: 'grove', seed: 31 },
  { x: 166, y: 5322, rx: 40, ry: 24, top: 46, thick: 46, kind: 'ruin', seed: 37 },
];

/** The goal islet: land on its meadow to finish. */
export const GOAL: SkyIslet = { x: 280, y: 5760, rx: 132, ry: 78, top: 0, thick: 118, kind: 'goal', seed: 41 };
/** The finish arch stands at the meadow's north end. */
export const ARCH = { x: GOAL.x, y: GOAL.y - 50 };

/** Respawn spots, in order: the lip, then each beacon once flown past. */
export const CHECKPOINTS = [{ x: COURSE_CX, y: LAUNCH_Y + 24, z: START_Z - 2 }, ...ISLETS.filter((l) => l.kind === 'beacon').map((l) => ({ x: l.x, y: l.y + 10, z: l.top + 44 }))];

/** Where a beacon's lantern stands on its islet, from the islet's middle. */
export const BEACON_AT = { dx: 0.36, dy: -0.12 };

/** Distance from (x, y) to an islet's middle, in its radii: 1 on its edge. */
export const isletR = (l: SkyIslet, x: number, y: number): number => Math.hypot((x - l.x) / l.rx, (y - l.y) / l.ry);

/** Distance from (x, y) to a lane's middle line, and how far along it (0..1). */
export function laneAt(l: WindLane, x: number, y: number): { d: number; t: number } {
  const vx = l.x2 - l.x1;
  const vy = l.y2 - l.y1;
  const t = ((x - l.x1) * vx + (y - l.y1) * vy) / (vx * vx + vy * vy);
  const c = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(x - l.x1 - vx * c, y - l.y1 - vy * c), t };
}

// ---------------------------------------------------------------- Scenery (for show)

/** Cloud tops on the deck below, scattered down the course: which puff, where, flipped. */
export const DECK_PUFFS: { x: number; y: number; v: number; flip: boolean }[] = (() => {
  const R = rng(4411);
  const out: { x: number; y: number; v: number; flip: boolean }[] = [];
  for (let y = 180; y < WORLD_BOTTOM; y += 46 + R() * 50) {
    out.push({ x: Math.round(-70 + R() * (COURSE_W + 140)), y: Math.round(y), v: Math.floor(R() * 3), flip: R() < 0.5 });
    if (R() < 0.45) out.push({ x: Math.round(-70 + R() * (COURSE_W + 140)), y: Math.round(y + 20), v: Math.floor(R() * 3), flip: R() < 0.5 });
  }
  return out;
})();

/** Scroll factor of the far islands, deep below; they are placed in their own scroll's space. */
export const FAR_PARALLAX = 0.5;
export const FAR_ISLES: { x: number; y: number; k: number }[] = (() => {
  const R = rng(771);
  const out: { x: number; y: number; k: number }[] = [];
  for (let y = 60; y < WORLD_BOTTOM * FAR_PARALLAX + 200; y += 110 + R() * 120) out.push({ x: Math.round(R() < 0.5 ? 10 + R() * 120 : COURSE_W - 130 + R() * 120), y: Math.round(y), k: Math.floor(R() * 5) });
  return out;
})();

/** How far down the course (0 at the lip, 1 at the goal), for the progress bar. */
export const progressOf = (y: number): number => Math.max(0, Math.min(1, (y - LAUNCH_Y) / (GOAL.y - LAUNCH_Y)));
