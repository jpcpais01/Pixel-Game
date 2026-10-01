// Houses on a build grid, the Home's plot or the Everwood's: each joined
// patch of roof cells is one house (its roof hipped to fit, see
// art/homeWalls.ts), and each joined patch of tent cells one tent (see
// art/tentArt.ts). Both are walked into: whatever covers them fades round a
// hero inside (see RoofView.ts). This file finds them and works out a
// tent's shape: which way its ridge runs, how high its cloth stands over any
// point, where its door is, and where its hem stops feet. Plain data: no
// Phaser.

/** The build grid's cell, px (homeLayout's CELL: that file uses this one, so it isn't imported from there). */
const CELL = 16;

/** How steeply a tent's cloth rises from its hem, px up per px in, and the highest its ridge stands. */
export const TENT_LIFT = 1.3;
export const TENT_MAX = 38;
/** How far in from a tent's edge its cloth stops feet, px, and half its doorway's width. */
export const TENT_HEM = 3;
export const TENT_DOOR_HW = 5;

export interface House {
  /** Its place in the list (and the id `at` gives its cells). */
  id: number;
  /** A tent (its cloth is its walls), else a roof over walls. */
  tent: boolean;
  cells: { x: number; y: number }[];
  /** The box round its cells, inclusive. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Is cell (cx, cy) one of its cells? */
  has(cx: number, cy: number): boolean;
  /** A tent's ridge runs north-south (its door in the gable facing south), else east-west (its door in the south slope). */
  ns: boolean;
  /** A tent's doorway: the middle of its threshold on the south hem, grid px. */
  door: { x: number; y: number } | null;
}

/** A cell's name. Cells run to 65536 each way (the Everwood's grid). */
export const houseKey = (cx: number, cy: number): number => cx * 65536 + cy;

/**
 * The houses: each patch of `roofs` joined side by side is one, and each
 * patch of `tents` one tent. `at` names the house over each covered cell.
 */
export function findHousesIn(roofs: Iterable<{ x: number; y: number }>, tents: Iterable<{ x: number; y: number }>): { houses: House[]; at: Map<number, number> } {
  const at = new Map<number, number>();
  const houses: House[] = [];
  const group = (cells: Iterable<{ x: number; y: number }>, tent: boolean) => {
    const all = new Set<number>();
    for (const c of cells) all.add(houseKey(c.x, c.y));
    for (const start of all) {
      if (at.has(start)) continue;
      const own = new Set<number>();
      const h: House = { id: houses.length, tent, cells: [], x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, has: (cx, cy) => own.has(houseKey(cx, cy)), ns: false, door: null };
      const stack = [start];
      at.set(start, h.id);
      while (stack.length) {
        const k = stack.pop()!;
        own.add(k);
        const x = Math.floor(k / 65536);
        const y = k - x * 65536;
        h.cells.push({ x, y });
        h.x0 = Math.min(h.x0, x);
        h.y0 = Math.min(h.y0, y);
        h.x1 = Math.max(h.x1, x);
        h.y1 = Math.max(h.y1, y);
        for (const n of [houseKey(x + 1, y), houseKey(x - 1, y), houseKey(x, y + 1), houseKey(x, y - 1)]) {
          if (all.has(n) && !at.has(n)) {
            at.set(n, h.id);
            stack.push(n);
          }
        }
      }
      h.cells.sort((a, b) => a.y - b.y || a.x - b.x);
      if (tent) shapeTent(h);
      houses.push(h);
    }
  };
  group(roofs, false);
  group(tents, true);
  return { houses, at };
}

/** A tent's ridge and door. A square one stands gable-on, its door facing south; a long one lies the long way. */
function shapeTent(h: House): void {
  h.ns = h.y1 - h.y0 >= h.x1 - h.x0;
  // The door: the middle of the front, on the southmost cell of the middle column (or, for an odd shape, the southmost cell).
  const mx = ((h.x0 + h.x1 + 1) * CELL) / 2;
  const col = Math.floor((mx - 0.5) / CELL);
  // An even width puts the middle on a line between two columns: the door sits across it, so both must reach as far south.
  const pair = Number.isInteger(mx / CELL) ? [col, col + 1] : [col];
  let best = -Infinity;
  for (const c of h.cells) if (pair.includes(c.x)) best = Math.max(best, c.y);
  const deep = pair.every((x) => h.has(x, best));
  if (best === -Infinity || !deep) {
    const south = h.cells[h.cells.length - 1];
    h.door = { x: (south.x + 0.5) * CELL, y: (south.y + 1) * CELL };
    return;
  }
  h.door = { x: mx, y: (best + 1) * CELL };
}

/**
 * How high a tent's cloth stands over grid point (x, y), px: rising from the
 * hem across its ridge (along each row for a north-south ridge, each column
 * for an east-west one), easing round at the top. 0 off the tent.
 */
export function tentHeight(h: House, x: number, y: number): number {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  if (!h.has(cx, cy)) return 0;
  // The run of the tent's cells across the ridge through this cell.
  let a = 0;
  let b = 0;
  if (h.ns) {
    while (h.has(cx - a - 1, cy)) a++;
    while (h.has(cx + b + 1, cy)) b++;
  } else {
    while (h.has(cx, cy - a - 1)) a++;
    while (h.has(cx, cy + b + 1)) b++;
  }
  const u = h.ns ? x - (cx - a) * CELL : y - (cy - a) * CELL;
  const len = (a + b + 1) * CELL;
  const d = Math.min(u, len - u);
  const top = Math.min(TENT_MAX, (len / 2) * TENT_LIFT);
  // Straight cloth up the sides, rounding over the ridge pole.
  const raw = d * TENT_LIFT;
  const knee = top * 0.82;
  return raw <= knee ? raw : knee + (top - knee) * (1 - Math.exp(-(raw - knee) / Math.max(1, top - knee)));
}

/** Does a tent's cloth stop feet at grid point (x, y)? Its hem all round, but for its doorway. */
export function tentStops(h: House, x: number, y: number): boolean {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  if (!h.has(cx, cy)) return false;
  const px = x - cx * CELL;
  const py = y - cy * CELL;
  const edge = (px < TENT_HEM && !h.has(cx - 1, cy)) || (px >= CELL - TENT_HEM && !h.has(cx + 1, cy)) || (py < TENT_HEM && !h.has(cx, cy - 1)) || (py >= CELL - TENT_HEM && !h.has(cx, cy + 1));
  if (!edge) return false;
  const d = h.door;
  return !(d && Math.abs(x - d.x) < TENT_DOOR_HW && y >= d.y - CELL / 2 && y < d.y);
}
