// The shape of the world: the starting plaza at the bottom and the forest
// north of it, one continuous map. Everything here is a pure function of
// world coordinates, so the ground can be generated in any strip, in any
// order, and still join up seamlessly (see art/ground.ts).
//
// The forest is a corridor around a winding path. Outside the corridor the
// treetops close into a solid roof, drawn into the ground at art resolution;
// trees along the corridor's edge are real sprites whose canopies cover the
// roof's edge and overlap the heroes.

import { hash2, rng, valueNoise } from '../art/env';

export const WORLD_W = 640;
export const PLAZA_H = 448;
export const FOREST_H = 1664;
/** Top of the plaza, in world y. */
export const PLAZA_Y = FOREST_H;
export const WORLD_H = FOREST_H + PLAZA_H;

export const PLAZA_CX = WORLD_W / 2;
export const PLAZA_CY = PLAZA_Y + PLAZA_H / 2;
/** Radius of the plaza's flagstones (before the 1.15 vertical squash). */
export const PLAZA_R = Math.min(WORLD_W, PLAZA_H) * 0.3;

const smooth = (a: number, b: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export { smooth as smoothstep };

/** Two glades open off the path: room to fight, flowers, a fallen log. */
export const GLADES = [
  { y: 1040, side: 1, r: 86 },
  { y: 470, side: -1, r: 74 },
];

/** The path's centre line. Straight out of the plaza, then winding north. */
export function pathX(y: number): number {
  const wander = smooth(PLAZA_Y + 10, PLAZA_Y - 240, y);
  const w = Math.sin(y * 0.0046 + 1.3) * 76 + Math.sin(y * 0.0117 + 0.4) * 22 + Math.sin(y * 0.029 + 2.1) * 4;
  const w0 = Math.sin(PLAZA_Y * 0.0046 + 1.3) * 76 + Math.sin(PLAZA_Y * 0.0117 + 0.4) * 22 + Math.sin(PLAZA_Y * 0.029 + 2.1) * 4;
  return PLAZA_CX + (w - w0 * (1 - wander)) * wander;
}

/** Half the path's width. It widens as it runs into the plaza. */
export function pathHalfW(y: number): number {
  return 12 + valueNoise(y, 0, 38, 71) * 4 + smooth(PLAZA_Y - 30, PLAZA_Y + 90, y) * 5;
}

/** How far the walkable corridor reaches from the path on one side (-1 left, 1 right). */
export function corridorW(y: number, side: -1 | 1): number {
  let w = 68 + (valueNoise(y, side, 84, side > 0 ? 73 : 79) - 0.5) * 38;
  // Wider as the forest meets the plaza.
  w += smooth(PLAZA_Y - 200, PLAZA_Y, y) * 34;
  for (const g of GLADES) {
    if (g.side !== side) continue;
    const t = (y - g.y) / (g.r * 1.25);
    if (Math.abs(t) < 1) w += (1 - t * t) * (1 - t * t) * g.r * 1.1;
  }
  return w;
}

/**
 * How far the plaza pushes the treetops back: none in the forest, then
 * rising fast over its top edge, so the roof curves out around the plaza.
 */
export function plazaOpen(y: number): number {
  const t = (y - (PLAZA_Y - 26)) / 52;
  return t <= 0 ? 0 : t * t * 400;
}

/** Everything the roof test needs that depends only on y, cached per row by the ground builder. */
export interface Row {
  px: number;
  wl: number;
  wr: number;
  open: number;
}

export function row(y: number): Row {
  return { px: pathX(y), wl: corridorW(y, -1), wr: corridorW(y, 1), open: plazaOpen(y) };
}

/** Wobble of the roof's edge, so it reads as a mass of trees rather than a line. */
const edgeWobble = (x: number, y: number) => (valueNoise(x, y, 7, 41) - 0.5) * 10 + (valueNoise(x, y, 19, 43) - 0.5) * 16;

/**
 * Positive inside the forest roof (treetops), negative in the open, roughly
 * in pixels from its edge.
 */
export function roofDepth(x: number, y: number, r: Row = row(y)): number {
  if (y > PLAZA_Y + 40) return -999;
  const dx = x - r.px;
  const edge = dx < 0 ? -dx - r.wl : dx - r.wr;
  return edge + edgeWobble(x, y) - r.open;
}

// ---------------------------------------------------------------------------
// Things that stand in the forest.

export type TreeKind = 'oak' | 'birch' | 'pine';

export interface TreeSpot {
  x: number;
  y: number;
  kind: TreeKind;
  /** Frame variant within the kind. */
  v: number;
  flip: boolean;
}

export type PropKind = 'bush' | 'fern' | 'rock' | 'stump' | 'log' | 'shrooms';

export interface PropSpot {
  x: number;
  y: number;
  kind: PropKind;
  v: number;
  flip: boolean;
}

/** A shaft of light falling through the canopy onto (x, y). */
export interface RaySpot {
  x: number;
  y: number;
  seed: number;
}

/** A leafy bough hanging between the camera and the path. */
export interface BoughSpot {
  x: number;
  y: number;
  v: number;
  flip: boolean;
}

export interface Collider {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface ForestLayout {
  trees: TreeSpot[];
  props: PropSpot[];
  rays: RaySpot[];
  boughs: BoughSpot[];
  colliders: Collider[];
}

/** Trunk footprint and canopy reach of each tree kind, in pixels from its base. */
export const TREE_SHAPE: Record<TreeKind, { trunk: number; canopyR: number; canopyY: number }> = {
  oak: { trunk: 5, canopyR: 34, canopyY: 68 },
  birch: { trunk: 3, canopyR: 22, canopyY: 70 },
  pine: { trunk: 4, canopyR: 24, canopyY: 56 },
};

export const PROP_COLLIDER: Partial<Record<PropKind, number>> = { rock: 6, stump: 6, log: 7 };

let cached: ForestLayout | null = null;

/** The forest's contents, the same on every load. */
export function forestLayout(): ForestLayout {
  if (cached) return cached;
  const R = rng(2024);
  const trees: TreeSpot[] = [];
  const props: PropSpot[] = [];
  const taken: { x: number; y: number; r: number }[] = [];
  const free = (x: number, y: number, r: number) => {
    for (const t of taken) if ((t.x - x) ** 2 + ((t.y - y) * 1.3) ** 2 < (t.r + r) ** 2) return false;
    return true;
  };
  const onPath = (x: number, y: number, pad: number) => Math.abs(x - pathX(y)) < pathHalfW(y) + pad;
  const inGlade = (x: number, y: number) =>
    GLADES.some((g) => {
      const gx = pathX(g.y) + g.side * (pathHalfW(g.y) + g.r * 0.75);
      return (x - gx) ** 2 + ((y - g.y) * 0.9) ** 2 < (g.r * 0.8) ** 2;
    });

  // Trees line the corridor's edges, trunks just inside it, so their
  // canopies hide where the roof begins.
  const step = 9;
  const cands: { x: number; y: number; k: number }[] = [];
  for (let y = 6; y < PLAZA_Y + 44; y += step) {
    for (let x = 4; x < WORLD_W - 4; x += step) cands.push({ x: x + R() * step, y: y + R() * step, k: R() });
  }
  cands.sort((a, b) => a.k - b.k);
  for (const c of cands) {
    const d = roofDepth(c.x, c.y);
    if (d > -5 || d < -20 || onPath(c.x, c.y, 10)) continue;
    // The plaza keeps its open lawn below the treeline.
    if (c.y > PLAZA_Y + 30) continue;
    if (!free(c.x, c.y, 13)) continue;
    const k = R();
    const kind: TreeKind = k < 0.62 ? 'oak' : k < 0.82 ? 'pine' : 'birch';
    trees.push({ x: Math.round(c.x), y: Math.round(c.y), kind, v: Math.floor(R() * 3), flip: R() < 0.5 });
    taken.push({ x: c.x, y: c.y, r: 13 });
  }
  // A few trees stand free inside the corridor.
  for (const c of cands) {
    if (c.k > 0.05) continue;
    const d = roofDepth(c.x, c.y);
    if (d > -34 || onPath(c.x, c.y, 22) || inGlade(c.x, c.y) || c.y > PLAZA_Y - 60) continue;
    if (!free(c.x, c.y, 26)) continue;
    const kind: TreeKind = R() < 0.5 ? 'oak' : 'birch';
    trees.push({ x: Math.round(c.x), y: Math.round(c.y), kind, v: Math.floor(R() * 3), flip: R() < 0.5 });
    taken.push({ x: c.x, y: c.y, r: 18 });
  }

  // Undergrowth: ferns and bushes crowd the edges, rocks and stumps between.
  for (const c of cands) {
    if (c.y > PLAZA_Y + 20) continue;
    const d = roofDepth(c.x, c.y);
    if (d > -3) continue;
    const r = hash2(Math.round(c.x), Math.round(c.y), 5);
    const nearEdge = d > -26;
    let kind: PropKind | null = null;
    if (nearEdge && r < 0.1) kind = r < 0.055 ? 'fern' : 'bush';
    else if (r < 0.012) kind = 'fern';
    else if (r < 0.016) kind = 'rock';
    else if (r < 0.019) kind = 'stump';
    else if (r > 0.994) kind = 'shrooms';
    if (!kind) continue;
    const pad = kind === 'fern' ? 4 : 9;
    if (onPath(c.x, c.y, pad)) continue;
    const rad = kind === 'fern' ? 6 : 9;
    if (!free(c.x, c.y, rad)) continue;
    props.push({ x: Math.round(c.x), y: Math.round(c.y), kind, v: Math.floor(R() * 2), flip: R() < 0.5 });
    taken.push({ x: c.x, y: c.y, r: rad });
  }
  // Each glade has a fallen log, and mushrooms glowing around it.
  for (const g of GLADES) {
    const gx = pathX(g.y) + g.side * (pathHalfW(g.y) + g.r * 0.75);
    props.push({ x: Math.round(gx + g.side * 14), y: g.y - 22, kind: 'log', v: 0, flip: g.side < 0 });
    props.push({ x: Math.round(gx + g.side * 40), y: g.y - 12, kind: 'shrooms', v: 1, flip: false });
    props.push({ x: Math.round(gx - g.side * 18), y: g.y + 30, kind: 'shrooms', v: 0, flip: true });
    props.push({ x: Math.round(gx + g.side * 34), y: g.y + 26, kind: 'stump', v: 0, flip: g.side < 0 });
  }

  // Shafts of light land on the path every so often, and in the glades.
  const rays: RaySpot[] = [];
  for (let y = 70; y < PLAZA_Y - 40; y += 118 + Math.floor(R() * 50)) {
    rays.push({ x: Math.round(pathX(y) + (R() - 0.5) * 30), y, seed: R() * 100 });
  }
  for (const g of GLADES) {
    const gx = pathX(g.y) + g.side * (pathHalfW(g.y) + g.r * 0.75);
    rays.push({ x: Math.round(gx), y: g.y + 6, seed: R() * 100 });
  }

  // Boughs overhang the corridor's edges, alternating sides.
  const boughs: BoughSpot[] = [];
  let side = 1;
  for (let y = 40; y < PLAZA_Y - 20; y += 70 + Math.floor(R() * 40)) {
    side = -side;
    const r = row(y);
    const x = side < 0 ? r.px - r.wl - 8 : r.px + r.wr + 8;
    boughs.push({ x: Math.round(x), y, v: Math.floor(R() * 3), flip: side > 0 });
  }

  const colliders: Collider[] = [];
  for (const t of trees) colliders.push({ x: t.x, y: t.y - 1, rx: TREE_SHAPE[t.kind].trunk + 1, ry: 3 });
  for (const p of props) {
    const r = PROP_COLLIDER[p.kind];
    if (!r) continue;
    if (p.kind === 'log') {
      colliders.push({ x: p.x - 10, y: p.y - 2, rx: r, ry: 4 }, { x: p.x + 10, y: p.y - 2, rx: r, ry: 4 });
    } else colliders.push({ x: p.x, y: p.y - 1, rx: r, ry: 3 });
  }
  trees.sort((a, b) => a.y - b.y);
  cached = { trees, props, rays, boughs, colliders };
  return cached;
}

/** Colliders bucketed by cell, for quick lookups around the hero. */
const CELL = 32;
let grid: Map<number, Collider[]> | null = null;

function colliderGrid(): Map<number, Collider[]> {
  if (grid) return grid;
  grid = new Map();
  for (const c of forestLayout().colliders) {
    for (let gy = Math.floor((c.y - c.ry) / CELL); gy <= Math.floor((c.y + c.ry) / CELL); gy++) {
      for (let gx = Math.floor((c.x - c.rx) / CELL); gx <= Math.floor((c.x + c.rx) / CELL); gx++) {
        const k = gy * 1000 + gx;
        let list = grid.get(k);
        if (!list) grid.set(k, (list = []));
        list.push(c);
      }
    }
  }
  return grid;
}

/** Plaza walls: its lawn stops short of the forest edge on every side but the north. */
const PLAZA_BOUNDS = { left: 28, right: WORLD_W - 28, bottom: WORLD_H - 24 };

/** Can a hero's feet stand at (x, y)? */
export function walkable(x: number, y: number): boolean {
  if (y < 10 || y > PLAZA_BOUNDS.bottom || x < 8 || x > WORLD_W - 8) return false;
  if (y > PLAZA_Y + 40) {
    if (x < PLAZA_BOUNDS.left || x > PLAZA_BOUNDS.right) return false;
  } else if (roofDepth(x, y) > -9) return false;
  const list = colliderGrid().get(Math.floor(y / CELL) * 1000 + Math.floor(x / CELL));
  if (list) {
    for (const c of list) {
      const dx = (x - c.x) / c.rx;
      const dy = (y - c.y) / c.ry;
      if (dx * dx + dy * dy < 1) return false;
    }
  }
  return true;
}

/**
 * A box around (x, y) the hero may move within this frame: as far as `reach`
 * along each axis before something blocks. The heroes clamp their movement to
 * a rectangle, so this gives them walls to slide along.
 */
export function freeBox(x: number, y: number, reach: number, out: { left: number; right: number; top: number; bottom: number }): void {
  // Somehow stuck inside something: let them walk out.
  const stuck = !walkable(x, y);
  const probe = (dx: number, dy: number) => {
    let d = 0;
    if (stuck) return reach;
    for (let s = 0.5; s <= reach; s += 0.5) {
      if (!walkable(x + dx * s, y + dy * s)) break;
      d = s;
    }
    return d;
  };
  out.left = x - probe(-1, 0);
  out.right = x + probe(1, 0);
  out.top = y - probe(0, -1);
  out.bottom = y + probe(0, 1);
}
