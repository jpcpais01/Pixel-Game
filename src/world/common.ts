// Pieces every arena's layout shares: the trees and undergrowth that line a
// roof's edge, colliders and the grid that finds them, and the free box the
// heroes slide along walls with.

import { hash2, rng } from '../art/env';

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

/** A shaft of light falling onto (x, y). */
export interface RaySpot {
  x: number;
  y: number;
  seed: number;
}

export interface Collider {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** Trees, undergrowth and shafts of light, drawn by Scenery. */
export interface SceneryLayout {
  trees: TreeSpot[];
  props: PropSpot[];
  rays: RaySpot[];
  colliders: Collider[];
}

/** Trunk footprint and canopy reach of each tree kind, in pixels from its base. */
export const TREE_SHAPE: Record<TreeKind, { trunk: number; canopyR: number; canopyY: number }> = {
  oak: { trunk: 5, canopyR: 34, canopyY: 68 },
  birch: { trunk: 3, canopyR: 22, canopyY: 70 },
  pine: { trunk: 4, canopyR: 24, canopyY: 56 },
};

export const PROP_COLLIDER: Partial<Record<PropKind, number>> = { rock: 6, stump: 6, log: 7 };

export interface EdgeOptions {
  w: number;
  h: number;
  seed: number;
  roofDepth(x: number, y: number): number;
  /** Place trees along the roof's edge (the clearing's treeline), or only undergrowth. */
  trees: boolean;
  /** Spots to keep clear (paths, props of the arena's own). */
  keepClear(x: number, y: number): boolean;
}

/**
 * Trees and undergrowth along the edge of a roof: trunks just in front of it,
 * so their canopies hide where it begins, and ferns and bushes crowding the
 * edge with a rock or stump here and there.
 */
export function edgeScenery(o: EdgeOptions): SceneryLayout {
  const R = rng(o.seed);
  const trees: TreeSpot[] = [];
  const props: PropSpot[] = [];
  const taken: { x: number; y: number; r: number }[] = [];
  const free = (x: number, y: number, r: number) => {
    for (const t of taken) if ((t.x - x) ** 2 + ((t.y - y) * 1.3) ** 2 < (t.r + r) ** 2) return false;
    return true;
  };

  const step = 9;
  const cands: { x: number; y: number; k: number }[] = [];
  for (let y = 6; y < o.h - 4; y += step) {
    for (let x = 4; x < o.w - 4; x += step) {
      const cx = x + R() * step;
      const cy = y + R() * step;
      const k = R();
      // Only the band along the roof's edge matters.
      const d = o.roofDepth(cx, cy);
      if (d > 0 || d < -40) continue;
      cands.push({ x: cx, y: cy, k });
    }
  }
  cands.sort((a, b) => a.k - b.k);
  if (o.trees) {
    for (const c of cands) {
      const d = o.roofDepth(c.x, c.y);
      if (d > -5 || d < -20 || o.keepClear(c.x, c.y)) continue;
      if (!free(c.x, c.y, 13)) continue;
      const k = R();
      const kind: TreeKind = k < 0.62 ? 'oak' : k < 0.82 ? 'pine' : 'birch';
      trees.push({ x: Math.round(c.x), y: Math.round(c.y), kind, v: Math.floor(R() * 3), flip: R() < 0.5 });
      taken.push({ x: c.x, y: c.y, r: 13 });
    }
  }
  for (const c of cands) {
    const d = o.roofDepth(c.x, c.y);
    if (d > -3) continue;
    const r = hash2(Math.round(c.x), Math.round(c.y), 5);
    let kind: PropKind | null = null;
    if (d > -26 && r < 0.1) kind = r < 0.055 ? 'fern' : 'bush';
    else if (r < 0.012) kind = 'fern';
    else if (r < 0.016) kind = 'rock';
    else if (r < 0.019) kind = 'stump';
    else if (r > 0.994) kind = 'shrooms';
    if (!kind || o.keepClear(c.x, c.y)) continue;
    const rad = kind === 'fern' ? 6 : 9;
    if (!free(c.x, c.y, rad)) continue;
    props.push({ x: Math.round(c.x), y: Math.round(c.y), kind, v: Math.floor(R() * 2), flip: R() < 0.5 });
    taken.push({ x: c.x, y: c.y, r: rad });
  }

  const colliders: Collider[] = [];
  for (const t of trees) colliders.push({ x: t.x, y: t.y - 1, rx: TREE_SHAPE[t.kind].trunk + 1, ry: 3 });
  for (const p of props) {
    const r = PROP_COLLIDER[p.kind];
    if (r) colliders.push({ x: p.x, y: p.y - 1, rx: r, ry: 3 });
  }
  trees.sort((a, b) => a.y - b.y);
  return { trees, props, rays: [], colliders };
}

/** Colliders bucketed by cell, for quick lookups around a point. */
export class ColliderGrid {
  private cells = new Map<number, Collider[]>();
  private static readonly CELL = 32;

  constructor(colliders: Collider[]) {
    const C = ColliderGrid.CELL;
    for (const c of colliders) {
      for (let gy = Math.floor((c.y - c.ry) / C); gy <= Math.floor((c.y + c.ry) / C); gy++) {
        for (let gx = Math.floor((c.x - c.rx) / C); gx <= Math.floor((c.x + c.rx) / C); gx++) {
          const k = gy * 1000 + gx;
          let list = this.cells.get(k);
          if (!list) this.cells.set(k, (list = []));
          list.push(c);
        }
      }
    }
  }

  /** Does any collider cover (x, y)? */
  hits(x: number, y: number): boolean {
    const C = ColliderGrid.CELL;
    const list = this.cells.get(Math.floor(y / C) * 1000 + Math.floor(x / C));
    if (!list) return false;
    for (const c of list) {
      const dx = (x - c.x) / c.rx;
      const dy = (y - c.y) / c.ry;
      if (dx * dx + dy * dy < 1) return true;
    }
    return false;
  }
}

export type Walk = (x: number, y: number) => boolean;

/**
 * A box around (x, y) the hero may move within this frame: as far as `reach`
 * along each axis before something blocks. The heroes clamp their movement to
 * a rectangle, so this gives them walls to slide along.
 */
export function freeBox(walkable: Walk, x: number, y: number, reach: number, out: { left: number; right: number; top: number; bottom: number }): void {
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
