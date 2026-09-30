// The player's Home: a plot of lawn in a forest clearing, laid out on a grid
// of 16 px cells. Each cell may have a floor, a wall (or door, or window) and
// a roof; things (plants, furniture, lights, wall hangings) are placed on
// top. This file holds the layout itself, how it is saved and sent to friends
// as a short string, where feet may go, and which roofs join into houses.
// Everything here is plain data (no Phaser), so it can be checked anywhere.

import { valueNoise } from '../art/env';
import { FLOORS, WALLS, floorIndex, packWall, partById, wallKind, wallMat, type PartDef } from './homeParts';

/** A cell's size in pixels, and the plot's size in cells. */
export const CELL = 16;
export const COLS = 48;
export const ROWS = 36;
/** The plot's top-left corner in the world: forest all round it, deepest along the top. */
export const PLOT_X = 64;
export const PLOT_Y = 112;
export const PLOT_W = COLS * CELL;
export const PLOT_H = ROWS * CELL;
export const HOME_W = PLOT_X * 2 + PLOT_W;
export const HOME_H = PLOT_Y + PLOT_H + 72;
/** Most things one home may hold, so it always fits in a message to friends. */
export const MAX_THINGS = 420;

/** A thing placed on the grid: its part, the top-left cell of its footprint, and whether it is mirrored. */
export interface Thing {
  id: string;
  x: number;
  y: number;
  flip: boolean;
}

const N = COLS * ROWS;
export const inPlot = (cx: number, cy: number): boolean => cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS;
export const cellIndex = (cx: number, cy: number): number => cy * COLS + cx;

export class HomeLayout {
  floor = new Uint8Array(N);
  wall = new Uint8Array(N);
  roof = new Uint8Array(N);
  things: Thing[] = [];

  clone(): HomeLayout {
    const l = new HomeLayout();
    l.floor.set(this.floor);
    l.wall.set(this.wall);
    l.roof.set(this.roof);
    l.things = this.things.map((t) => ({ ...t }));
    return l;
  }

  floorAt(cx: number, cy: number): number {
    return inPlot(cx, cy) ? this.floor[cellIndex(cx, cy)] : 0;
  }

  wallAt(cx: number, cy: number): number {
    return inPlot(cx, cy) ? this.wall[cellIndex(cx, cy)] : 0;
  }

  roofAt(cx: number, cy: number): number {
    return inPlot(cx, cy) ? this.roof[cellIndex(cx, cy)] : 0;
  }

  isWater(cx: number, cy: number): boolean {
    const f = this.floorAt(cx, cy);
    return f > 0 && !!FLOORS[f - 1].water;
  }

  /** Which of a wall's neighbours are walls too: bits for north, east, south and west. */
  wallMask(cx: number, cy: number): number {
    return (this.wallAt(cx, cy - 1) ? 1 : 0) | (this.wallAt(cx + 1, cy) ? 2 : 0) | (this.wallAt(cx, cy + 1) ? 4 : 0) | (this.wallAt(cx - 1, cy) ? 8 : 0);
  }

  /** The things covering cell (cx, cy): standing ones first, then flat ones, top-most last placed. */
  thingsAt(cx: number, cy: number): Thing[] {
    const out: Thing[] = [];
    for (const t of this.things) {
      const p = partById(t.id);
      if (!p) continue;
      if (cx >= t.x && cx < t.x + p.w && cy >= t.y && cy < t.y + p.h) out.push(t);
    }
    return out.reverse().sort((a, b) => Number(!!partById(a.id)?.flat) - Number(!!partById(b.id)?.flat));
  }

  /**
   * Can `part` go with its footprint's top-left at (cx, cy)? It must lie on
   * the plot, off walls (or, for a wall hanging, on a wall's face), keep off
   * water unless it floats, and not share a cell with another thing of its
   * kind (a rug can lie under a table, but not under another rug).
   */
  canPlace(part: PartDef, cx: number, cy: number): boolean {
    if (this.things.length >= MAX_THINGS) return false;
    if (part.wall) {
      const v = this.wallAt(cx, cy);
      if (!v || wallKind(v) !== 'wall' || !WALLS[wallMat(v)]?.house) return false;
      // Its face must show: nothing joins the wall from the south.
      if (this.wallAt(cx, cy + 1)) return false;
      return !this.things.some((t) => t.x === cx && t.y === cy && partById(t.id)?.wall);
    }
    for (let y = cy; y < cy + part.h; y++) {
      for (let x = cx; x < cx + part.w; x++) {
        if (!inPlot(x, y) || this.wallAt(x, y)) return false;
        const water = this.isWater(x, y);
        if (part.water === 'only' ? !water : water && part.water !== 'too') return false;
      }
    }
    for (const t of this.things) {
      const p = partById(t.id);
      if (!p || p.wall || !!p.flat !== !!part.flat) continue;
      if (t.x < cx + part.w && t.x + p.w > cx && t.y < cy + part.h && t.y + p.h > cy) return false;
    }
    return true;
  }

  // ---- Saving

  /** The whole layout as a short string: `h1|floors|walls|roofs|things`, each grid run-length coded. */
  encode(): string {
    const things = this.things.map((t) => `${t.id}.${t.x.toString(36)}.${t.y.toString(36)}${t.flip ? '.f' : ''}`).join(',');
    return `h1|${runs(this.floor)}|${runs(this.wall)}|${runs(this.roof)}|${things}`;
  }

  /** A layout from `encode`, or null if the string isn't one. Unknown parts and values are dropped. */
  static decode(s: string | null | undefined): HomeLayout | null {
    if (!s || !s.startsWith('h1|')) return null;
    const parts = s.split('|');
    if (parts.length !== 5) return null;
    const l = new HomeLayout();
    if (!unruns(parts[1], l.floor, FLOORS.length) || !unruns(parts[2], l.wall, (WALLS.length + 1) * 4 - 1) || !unruns(parts[3], l.roof, 4)) return null;
    // Wall values from the packing: a known material and kind.
    for (let i = 0; i < N; i++) {
      const v = l.wall[i];
      if (v && (wallMat(v) < 0 || wallMat(v) >= WALLS.length || (v & 3) === 3)) l.wall[i] = 0;
    }
    for (const item of parts[4] ? parts[4].split(',') : []) {
      const [id, xs, ys, f] = item.split('.');
      const p = partById(id);
      const x = parseInt(xs, 36);
      const y = parseInt(ys, 36);
      if (!p || !Number.isFinite(x) || !Number.isFinite(y) || !inPlot(x, y) || !inPlot(x + p.w - 1, y + p.h - 1)) continue;
      if (l.things.length >= MAX_THINGS) break;
      l.things.push({ id, x, y, flip: f === 'f' && !!p.flip });
    }
    return l;
  }
}

/** A grid as runs: `value*count` (or a lone value), comma separated, in base 36. */
function runs(a: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < a.length; ) {
    const v = a[i];
    let n = 1;
    while (i + n < a.length && a[i + n] === v) n++;
    out.push(n > 1 ? `${v.toString(36)}*${n.toString(36)}` : v.toString(36));
    i += n;
  }
  return out.join(',');
}

function unruns(s: string, into: Uint8Array, max: number): boolean {
  let i = 0;
  for (const run of s.split(',')) {
    const [vs, ns] = run.split('*');
    const v = parseInt(vs, 36);
    const n = ns === undefined ? 1 : parseInt(ns, 36);
    if (!Number.isFinite(v) || !Number.isFinite(n) || n < 1) return false;
    into.fill(v >= 0 && v <= max ? v : 0, i, Math.min(into.length, i + n));
    i += n;
  }
  return i === into.length;
}

// ---------------------------------------------------------------- Walls' shapes

/** A wall's footprint within its cell: its core, and an arm out to each wall beside it. */
export function wallBoxes(mask: number, thick: number): { x0: number; y0: number; x1: number; y1: number }[] {
  const a = 8 - thick / 2;
  const b = 8 + thick / 2;
  const boxes = [{ x0: a, y0: a, x1: b, y1: b }];
  if (mask & 1) boxes.push({ x0: a, y0: 0, x1: b, y1: a });
  if (mask & 2) boxes.push({ x0: b, y0: a, x1: CELL, y1: b });
  if (mask & 4) boxes.push({ x0: a, y0: b, x1: b, y1: CELL });
  if (mask & 8) boxes.push({ x0: 0, y0: a, x1: a, y1: b });
  return boxes;
}

/** A door runs across its wall: east-west unless the wall runs only north-south. */
export const doorAcross = (mask: number): boolean => !!(mask & 10) || !(mask & 5);

/** The half-width of a doorway's opening. */
export const DOOR_HW = 5;

// ---------------------------------------------------------------- Where feet go

/** How far feet keep from a wall's face, and from the pond's edge. */
const WALL_PAD = 2;
const SHORE = 4;

/**
 * Which pixels of the plot feet can't stand on: walls (but not their
 * doorways), the pond, and the footprints of things that stand in the way.
 * One byte a pixel, rebuilt whenever the layout changes.
 */
export class HomeMask {
  readonly data = new Uint8Array(PLOT_W * PLOT_H);

  constructor(l: HomeLayout) {
    const d = this.data;
    const fill = (x0: number, y0: number, x1: number, y1: number) => {
      const xa = Math.max(0, Math.floor(x0));
      const xb = Math.min(PLOT_W, Math.ceil(x1));
      const ya = Math.max(0, Math.floor(y0));
      const yb = Math.min(PLOT_H, Math.ceil(y1));
      for (let y = ya; y < yb; y++) d.fill(1, y * PLOT_W + xa, y * PLOT_W + xb);
    };
    const clear = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = Math.max(0, y0); y < Math.min(PLOT_H, y1); y++) d.fill(0, y * PLOT_W + Math.max(0, x0), y * PLOT_W + Math.min(PLOT_W, x1));
    };
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const px = cx * CELL;
        const py = cy * CELL;
        if (l.isWater(cx, cy)) {
          // The pond's rounded shore can be stood on.
          const w = !l.isWater(cx - 1, cy) ? SHORE : 0;
          const e = !l.isWater(cx + 1, cy) ? SHORE : 0;
          const n = !l.isWater(cx, cy - 1) ? SHORE : 0;
          const s = !l.isWater(cx, cy + 1) ? SHORE : 0;
          fill(px + w, py + n, px + CELL - e, py + CELL - s);
        }
        const v = l.wallAt(cx, cy);
        if (!v) continue;
        const mask = l.wallMask(cx, cy);
        const def = WALLS[wallMat(v)];
        for (const b of wallBoxes(mask, def.thick)) fill(px + b.x0 - WALL_PAD, py + b.y0 - WALL_PAD, px + b.x1 + WALL_PAD, py + b.y1 + WALL_PAD);
        if (wallKind(v) === 'door') {
          if (doorAcross(mask)) clear(px + 8 - DOOR_HW, py, px + 8 + DOOR_HW, py + CELL);
          else clear(px, py + 8 - DOOR_HW, px + CELL, py + 8 + DOOR_HW);
        }
      }
    }
    for (const t of l.things) {
      const p = partById(t.id);
      if (!p || p.block === 'none' || p.wall) continue;
      const x = t.x * CELL;
      const y = t.y * CELL;
      const w = p.w * CELL;
      const h = p.h * CELL;
      if (p.block === 'full') fill(x + 1, y + Math.min(4, h / 4), x + w - 1, y + h - 2);
      else fill(x + w / 2 - 4, y + h - 8, x + w / 2 + 4, y + h - 2);
    }
  }

  blocked(px: number, py: number): boolean {
    if (px < 0 || py < 0 || px >= PLOT_W || py >= PLOT_H) return false;
    return this.data[Math.floor(py) * PLOT_W + Math.floor(px)] === 1;
  }
}

// ---------------------------------------------------------------- Houses

/**
 * The roofs, each patch of joined roof cells one house: its cells, and the
 * box round them. `at` gives the house over each cell (-1 for none).
 */
export interface House {
  id: number;
  cells: number[];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function findHouses(l: HomeLayout): { houses: House[]; at: Int16Array } {
  const at = new Int16Array(N).fill(-1);
  const houses: House[] = [];
  for (let i = 0; i < N; i++) {
    if (!l.roof[i] || at[i] >= 0) continue;
    const h: House = { id: houses.length, cells: [], x0: COLS, y0: ROWS, x1: -1, y1: -1 };
    const stack = [i];
    at[i] = h.id;
    while (stack.length) {
      const c = stack.pop()!;
      h.cells.push(c);
      const cx = c % COLS;
      const cy = (c - cx) / COLS;
      h.x0 = Math.min(h.x0, cx);
      h.x1 = Math.max(h.x1, cx);
      h.y0 = Math.min(h.y0, cy);
      h.y1 = Math.max(h.y1, cy);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!inPlot(nx, ny)) continue;
        const j = cellIndex(nx, ny);
        if (l.roof[j] && at[j] < 0) {
          at[j] = h.id;
          stack.push(j);
        }
      }
    }
    houses.push(h);
  }
  return { houses, at };
}

// ---------------------------------------------------------------- The clearing round the plot

/** Positive under the forest's roof round the plot, negative in the open (pixels from its edge, roughly). */
export function homeRoofDepth(x: number, y: number): number {
  // The open ground: the plot and a strip of meadow round it, its corners rounded.
  const m = 26;
  const r = 56;
  const hw = PLOT_W / 2 + m;
  const hh = PLOT_H / 2 + m;
  const qx = Math.abs(x - (PLOT_X + PLOT_W / 2)) - hw + r;
  const qy = Math.abs(y - (PLOT_Y + PLOT_H / 2)) - hh + r;
  const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  return sd + (valueNoise(x, y, 23, 71) - 0.5) * 16 + (valueNoise(x, y, 7, 73) - 0.5) * 7;
}

// ---------------------------------------------------------------- The home a new player starts with

/**
 * A cosy thatched cottage with a gravel path to its door, a pond with a
 * bench, a fenced vegetable patch, trees, flowers and lamps: something good
 * to look at from the first visit, and to rebuild from.
 */
export function starterHome(): HomeLayout {
  const l = new HomeLayout();
  const f = (id: string, x0: number, y0: number, x1: number, y1: number) => {
    const v = floorIndex(id);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inPlot(x, y)) l.floor[cellIndex(x, y)] = v;
  };
  const wallMatIndex = (id: string) => WALLS.findIndex((w) => w.id === id);
  const w = (id: string, kind: 'wall' | 'door' | 'window', x: number, y: number) => (l.wall[cellIndex(x, y)] = packWall(wallMatIndex(id), kind));
  const box = (id: string, x0: number, y0: number, x1: number, y1: number) => {
    for (let x = x0; x <= x1; x++) {
      w(id, 'wall', x, y0);
      w(id, 'wall', x, y1);
    }
    for (let y = y0; y <= y1; y++) {
      w(id, 'wall', x0, y);
      w(id, 'wall', x1, y);
    }
  };
  const put = (id: string, x: number, y: number, flip = false) => {
    const p = partById(id);
    if (p && l.canPlace(p, x, y)) l.things.push({ id, x, y, flip });
  };

  // The cottage: timber walls under thatch, oak boards inside.
  box('timber', 18, 8, 30, 16);
  w('timber', 'door', 24, 16);
  w('timber', 'window', 20, 16);
  w('timber', 'window', 28, 16);
  w('timber', 'window', 21, 8);
  w('timber', 'window', 27, 8);
  w('timber', 'window', 18, 12);
  w('timber', 'window', 30, 12);
  for (let y = 8; y <= 16; y++) for (let x = 18; x <= 30; x++) l.roof[cellIndex(x, y)] = 3;
  f('oak', 19, 9, 29, 15);

  // A gravel path from the door to the edge of the plot, flagstones at the step, flowers either side.
  f('flags', 23, 17, 25, 17);
  f('gravel', 23, 18, 25, 35);
  f('meadow', 19, 17, 21, 18);
  f('meadow', 27, 17, 29, 18);

  // The pond, west of the path, and a vegetable patch fenced in to the east.
  for (let y = 18; y <= 27; y++) {
    for (let x = 4; x <= 16; x++) {
      if (((x - 10) / 5.6) ** 2 + ((y - 22.5) / 4.2) ** 2 <= 1) f('pond', x, y, x, y);
    }
  }
  f('sand', 15, 25, 16, 26);
  box('fence', 34, 9, 43, 17);
  w('fence', 'door', 38, 17);
  f('soil', 35, 10, 42, 16);
  f('path', 38, 18, 38, 19);
  f('path', 37, 20, 39, 21);

  // A campfire in a ring of stones out east.
  f('flags', 37, 27, 39, 29);

  // Inside: the hearth on the north wall between two sconces, shelves and a bed, a table on a rug.
  put('fireplace', 23, 9);
  put('bookshelf', 19, 9);
  put('clock', 21, 9);
  put('dresser', 27, 9);
  put('bed', 29, 9);
  put('rug', 22, 11);
  put('roundtable', 20, 12);
  put('chair', 19, 12);
  put('chair', 21, 12, true);
  put('sofa', 22, 13);
  put('candelabra', 26, 12);
  put('chest', 29, 14);
  put('barrel', 29, 15);
  put('plant', 19, 15);
  put('desk', 26, 14);
  put('stool', 27, 13);
  put('sconce', 22, 8);
  put('sconce', 25, 8);
  put('painting', 26, 8);
  put('shield', 19, 8);
  put('wreath', 23, 16);

  // Out front.
  put('tulips', 19, 17);
  put('lavender', 20, 17);
  put('tulips', 21, 18, true);
  put('lavender', 27, 17, true);
  put('tulips', 28, 17);
  put('roses', 29, 18);
  put('roses', 17, 17);
  put('lamppost', 22, 21);
  put('lamppost', 26, 21);
  put('mailbox', 26, 33);
  put('signpost', 22, 33, true);

  // The vegetable patch.
  for (let x = 35; x <= 42; x++) {
    if (x === 38) continue;
    put('sunflowers', x, 10, x % 2 === 0);
    put('cabbages', x, 12, x % 2 === 1);
    put(x % 3 === 0 ? 'pumpkin' : 'cabbages', x, 14, x % 2 === 0);
    put('cabbages', x, 16);
  }
  put('scarecrow', 38, 13);
  put('haybale', 44, 16);
  put('haybale', 44, 17, true);

  // By the pond.
  put('lilypad', 8, 21);
  put('lilypad', 11, 23, true);
  put('lilypad', 13, 21);
  put('reeds', 5, 20);
  put('reeds', 4, 22, true);
  put('reeds', 14, 25);
  put('bench', 9, 28);
  put('lantern', 16, 20);
  put('stepping', 18, 22);
  put('stepping', 20, 22, true);
  put('birdbath', 3, 26);

  // The well and the campfire.
  put('well', 32, 21);
  put('campfire', 38, 28);
  put('stump', 36, 28);
  put('stump', 40, 28, true);
  put('stump', 38, 30);

  // Trees round the edges, and a few rocks.
  put('oak', 6, 11);
  put('oak', 12, 5);
  put('birch', 3, 16);
  put('blossom', 14, 13);
  put('blossom', 33, 27);
  put('pine', 44, 25);
  put('pine', 46, 29);
  put('oak', 44, 5);
  put('birch', 33, 5);
  put('oak', 4, 33);
  put('blossom', 43, 33);
  put('bush', 17, 7);
  put('bush', 31, 7, true);
  put('fern', 16, 10);
  put('fern', 32, 12, true);
  put('rock', 2, 30);
  put('rock', 45, 20, true);
  put('rock', 15, 33);
  put('planter', 31, 17);
  return l;
}
