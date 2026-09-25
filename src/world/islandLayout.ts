// The Floating Island's shape: a grassy island adrift in a sunny sky, seen
// from a little above, so its rocky underside hangs below its front edge. A
// white marble duelling ring sits in its middle, and brooks run from springs
// to the edge and spill off it as waterfalls. Pure functions of arena
// coordinates, shared by the art (art/island.ts) and the game (world/Island.ts).

import { rng } from '../art/env';
import { ColliderGrid, TREE_SHAPE, type Collider, type PropSpot, type SceneryLayout, type TreeKind, type TreeSpot } from './common';

export const ISLE_W = 800;
export const ISLE_H = 700;
/** The island's centre and its top surface's radii (before the edge's wobble). */
export const ISLE_CX = 400;
export const ISLE_CY = 300;
export const ISLE_RX = 250;
export const ISLE_RY = 190;
/** How far the rock under the island hangs below its front edge, at most. */
export const ISLE_UNDER = 160;

/** The marble ring: its centre and radii. */
export const RING_CX = 400;
export const RING_CY = 285;
export const RING_RX = 128;
export const RING_RY = 94;
/** The two duelling marks, west and east, as a fraction of the ring's radius. */
export const MARK_U = 0.62;
export const MARKS = [
  { x: RING_CX - Math.round(RING_RX * MARK_U), y: RING_CY },
  { x: RING_CX + Math.round(RING_RX * MARK_U), y: RING_CY },
];

/** Heroes arrive on the west mark (the east one is the opponent's). */
export const ISLE_SPAWN = { x: MARKS[0].x, y: MARKS[0].y + 2 };

/** How far the island's edge reaches at angle `a` (radians, in radii), a gentle wobble. */
export function edgeK(a: number): number {
  return 1 + Math.sin(a * 3 + 0.7) * 0.045 + Math.sin(a * 5 + 2.1) * 0.03 + Math.sin(a * 9 + 0.3) * 0.015;
}

/** Distance from the centre in edge radii: 1 on the island's top edge. */
export function isleR(x: number, y: number): number {
  const u = (x - ISLE_CX) / ISLE_RX;
  const v = (y - ISLE_CY) / ISLE_RY;
  return Math.hypot(u, v) / edgeK(Math.atan2(v, u));
}

/** The island's edge at angle `a` (0 east, going clockwise on screen). */
export function edgeAt(a: number): { x: number; y: number } {
  const k = edgeK(a);
  return { x: ISLE_CX + Math.cos(a) * ISLE_RX * k, y: ISLE_CY + Math.sin(a) * ISLE_RY * k };
}

/** The last row of the top surface in column `x` (its front edge), or -1 past the island. */
export function frontEdgeY(x: number): number {
  let last = -1;
  for (let y = ISLE_CY; y < ISLE_CY + ISLE_RY * 1.2; y++) {
    if (isleR(x + 0.5, y + 0.5) <= 1) last = y;
    else if (last >= 0) break;
  }
  return last;
}

/** Distance from the ring's centre in its radii: 1 on the kerb's outer edge. */
export function ringR(x: number, y: number): number {
  return Math.hypot((x - RING_CX) / RING_RX, (y - RING_CY) / RING_RY);
}

/** Eight columns stand on the kerb; the four ways in (north, south, east, west) are left open. */
export const COLUMNS: { x: number; y: number; v: number }[] = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
  const a = ((22.5 + k * 45) * Math.PI) / 180;
  return { x: Math.round(RING_CX + Math.cos(a) * RING_RX * 0.968), y: Math.round(RING_CY + Math.sin(a) * RING_RY * 0.968), v: k % 3 === 1 ? 1 : 0 };
});

// ---------------------------------------------------------------- Water

/** A brook from a spring to the island's edge, where it falls. */
export interface Brook {
  /** Points along it, source first; the last lies just past the edge. */
  pts: { x: number; y: number }[];
  /** Half its width, in pixels. */
  w: number;
  /** Where it spills over: the column and the top of the fall. */
  fall: { x: number; y: number };
}

/** A small pond in the north-east, where the eastern brook rises. */
export const POND = { x: 545, y: 196, rx: 25, ry: 15 };

function brook(sx: number, sy: number, cx: number, cy: number, angle: number, w: number): Brook {
  const e = edgeAt((angle * Math.PI) / 180);
  // Aim just past the edge, so the water reaches it.
  const ex = e.x + (e.x - ISLE_CX) * 0.03;
  const ey = e.y + (e.y - ISLE_CY) * 0.06;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    pts.push({ x: a * sx + b * cx + c * ex, y: a * sy + b * cy + c * ey });
  }
  const fx = Math.round(e.x);
  return { pts, w, fall: { x: fx, y: frontEdgeY(fx) } };
}

export const BROOKS: Brook[] = [
  // From a spring among rocks in the north-west, down the west side.
  brook(214, 214, 168, 300, 148, 3.2),
  // From the pond, round the east side.
  brook(566, 204, 640, 270, 28, 3.6),
  // A short one from a spring south-east of the ring, straight over the front.
  brook(512, 408, 506, 450, 74, 2.8),
];

/** The springs brooks rise from (the pond feeds the second). */
export const SPRINGS = [BROOKS[0].pts[0], BROOKS[2].pts[0]];

/** Distance from (x, y) to the nearest brook's middle, less its half width (negative in the water). */
export function brookDist(x: number, y: number): number {
  let best = Infinity;
  for (const b of BROOKS) {
    // A cheap reject: brooks are short.
    const p0 = b.pts[0];
    const p1 = b.pts[b.pts.length - 1];
    if (x < Math.min(p0.x, p1.x) - 90 || x > Math.max(p0.x, p1.x) + 90 || y < Math.min(p0.y, p1.y) - 90 || y > Math.max(p0.y, p1.y) + 90) continue;
    for (let i = 1; i < b.pts.length; i++) {
      const a = b.pts[i - 1];
      const c = b.pts[i];
      const vx = c.x - a.x;
      const vy = c.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy)));
      const d = Math.hypot(x - a.x - vx * t, y - a.y - vy * t) - b.w;
      if (d < best) best = d;
    }
  }
  return best;
}

export function pondR(x: number, y: number): number {
  return Math.hypot((x - POND.x) / POND.rx, (y - POND.y) / POND.ry);
}

// ---------------------------------------------------------------- Trees and walking

let layout: SceneryLayout | null = null;
let grid: ColliderGrid | null = null;

/**
 * Trees around the back and sides of the island (the front is left open,
 * over the falls), bushes and ferns among them, rocks at the springs and
 * round the pond.
 */
export function islandScenery(): SceneryLayout {
  if (layout) return layout;
  const R = rng(9107);
  const trees: TreeSpot[] = [];
  const props: PropSpot[] = [];
  const taken: { x: number; y: number; r: number }[] = [];
  const free = (x: number, y: number, r: number) => taken.every((t) => (t.x - x) ** 2 + ((t.y - y) * 1.3) ** 2 >= (t.r + r) ** 2);
  const clearOfWater = (x: number, y: number, m: number) => brookDist(x, y) > m && pondR(x, y) > 1 + m / 14;
  // Keep the ring and a margin round it open.
  const clearOfRing = (x: number, y: number) => ringR(x, y) > 1.2;

  for (let tries = 0; tries < 900 && trees.length < 15; tries++) {
    const a = -Math.PI * (0.02 + R() * 0.96) + (R() < 0.25 ? (R() < 0.5 ? -0.35 : 0.35) : 0);
    const d = 0.74 + R() * 0.16;
    const e = edgeAt(a);
    const x = Math.round(ISLE_CX + (e.x - ISLE_CX) * d);
    const y = Math.round(ISLE_CY + (e.y - ISLE_CY) * d);
    if (!clearOfRing(x, y) || !clearOfWater(x, y, 14) || !free(x, y, 17)) continue;
    const k = R();
    const kind: TreeKind = k < 0.55 ? 'oak' : k < 0.85 ? 'birch' : 'pine';
    trees.push({ x, y, kind, v: Math.floor(R() * 3), flip: R() < 0.5 });
    taken.push({ x, y, r: 17 });
  }
  // Undergrowth round the trees and along the brooks.
  for (let tries = 0; tries < 1400 && props.length < 34; tries++) {
    const a = R() * Math.PI * 2;
    const d = 0.3 + Math.sqrt(R()) * 0.62;
    const e = edgeAt(a);
    const x = Math.round(ISLE_CX + (e.x - ISLE_CX) * d);
    const y = Math.round(ISLE_CY + (e.y - ISLE_CY) * d);
    if (!clearOfRing(x, y) || !clearOfWater(x, y, 6)) continue;
    // Mostly near trees or water; the open meadow keeps a few.
    const nearTree = trees.some((t) => Math.hypot(t.x - x, t.y - y) < 40);
    const nearWater = brookDist(x, y) < 22;
    if (!nearTree && !nearWater && R() > 0.12) continue;
    // Not in front of the falls: the front edge stays open.
    if (a > 0.3 && a < Math.PI - 0.3 && d > 0.8) continue;
    const r = R();
    const kind = r < 0.45 ? 'fern' : r < 0.85 ? 'bush' : 'rock';
    const rad = kind === 'fern' ? 6 : 9;
    if (!free(x, y, rad)) continue;
    props.push({ x, y, kind, v: Math.floor(R() * 2), flip: R() < 0.5 });
    taken.push({ x, y, r: rad });
  }
  // Rocks where the springs rise, and round the pond's north shore.
  for (const s of SPRINGS) {
    props.push({ x: Math.round(s.x - 6), y: Math.round(s.y - 4), kind: 'rock', v: 1, flip: false });
    props.push({ x: Math.round(s.x + 7), y: Math.round(s.y - 3), kind: 'rock', v: 0, flip: true });
  }
  props.push({ x: POND.x - 20, y: POND.y - 12, kind: 'rock', v: 1, flip: true });
  props.push({ x: POND.x + 12, y: POND.y - 16, kind: 'fern', v: 0, flip: false });

  const colliders: Collider[] = [];
  for (const t of trees) colliders.push({ x: t.x, y: t.y - 1, rx: TREE_SHAPE[t.kind].trunk + 1, ry: 3 });
  for (const p of props) if (p.kind === 'rock') colliders.push({ x: p.x, y: p.y - 1, rx: 6, ry: 3 });
  for (const c of COLUMNS) colliders.push({ x: c.x, y: c.y - 1, rx: 6.5, ry: 3.5 });
  trees.sort((a, b) => a.y - b.y);
  layout = { trees, props, rays: [], colliders };
  return layout;
}

/** Can feet stand here? On the island, back from its edge, out of the pond and clear of trunks, rocks and columns. */
export function islandWalkable(x: number, y: number): boolean {
  const u = (x - ISLE_CX) / (ISLE_RX - 8);
  const v = (y - ISLE_CY) / (ISLE_RY - 6);
  if (Math.hypot(u, v) > edgeK(Math.atan2(v, u)) * 0.995) return false;
  if (pondR(x, y) < 1) return false;
  grid ??= new ColliderGrid(islandScenery().colliders);
  return !grid.hits(x, y);
}
