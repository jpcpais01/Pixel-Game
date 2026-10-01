// What the player has built in the Everwood and cleared from it. The forest
// itself is a function of its seed (see forestGen.ts); this is the little the
// player has changed on top, with everything a Home can be built of: things
// from the Home's palette placed on a grid of 16 px cells over the whole
// forest (bridges among them, which join up into spans: see bridge.ts),
// floors laid cell by cell, walls of every kind with their doors, gates and
// windows joined up cell by cell, roofs and tents joined into houses (see
// houses.ts), and the trees and undergrowth taken away, each known by where
// its foot stands. It is saved
// as one short string (see `encode`), in the player's save and sent to the
// room online. Plain data: no Phaser.

import { Bridges, Deck } from './bridge';
import { CELL, DOOR_HW, doorAcross, wallBoxes, type Thing } from './homeLayout';
import { FLOORS, ROOFS, TENTS, WALLS, extent, partById, wallKind, wallMat, type PartDef } from './homeParts';
import { findHousesIn, houseKey, tentStops, type House } from './houses';

/** Most of each a forest keeps, so it always fits in the save and a few messages to the room. */
export const MAX_THINGS = 1500;
export const MAX_WALLS = 3000;
export const MAX_CLEARED = 8000;
export const MAX_FLOORS = 6000;
export const MAX_ROOFS = 4000;
export const MAX_TENTS = 2000;
/** How far feet keep from a wall's face, and how much of a laid pond's edge they can stand on (as in the Home). */
const WALL_PAD = 2;
const SHORE = 4;
/** Chunks are this many cells across (CHUNK / CELL). */
const CHUNK_CELLS = 16;

/** How far a ward reaches from the middle of its footprint, in world px: its `ward` cells past its own edge. */
export const wardReach = (p: PartDef, w: number, h: number): number => ((p.ward ?? 0) + Math.max(w, h) / 2) * CELL;

export { footKey } from './forestGen';
/** A cell's name. Cells run to 65536 each way. */
export const cellKey = (cx: number, cy: number): number => cx * 65536 + cy;

/** A wall value as packed (see homeParts.ts): a known material, and a window only in a house wall. */
const knownWall = (v: number): boolean => !!WALLS[wallMat(v)] && (v & 3) !== 3 && (wallKind(v) !== 'window' || WALLS[wallMat(v)].house);

export class ForestEdits {
  things: Thing[] = [];
  walls = new Map<number, number>();
  /** Floors laid, by cell: their index in FLOORS, from 1. */
  floors = new Map<number, number>();
  /** Roofs and tents laid, by cell: their index in ROOFS or TENTS, from 1. */
  roofs = new Map<number, number>();
  tents = new Map<number, number>();
  cleared = new Set<number>();
  /** The houses and tents the roofs and tents make, and which is over each cell; rebuilt by `index`. */
  houses: House[] = [];
  private houseIds = new Map<number, number>();
  /** The bridges the bridge cells make; rebuilt by `index`. */
  bridges = new Bridges([]);
  /** Things by the cells they cover, and by chunk (of their top-left cell); rebuilt by `index`. */
  private cover = new Map<number, Thing[]>();
  private chunkThings = new Map<number, Thing[]>();
  private chunkWalls = new Map<number, [number, number, number][]>();
  /** Raised on every change, so whatever shows the builds (the map's pins) looks again. */
  version = 0;
  /** The wards built: their middles and reach (world px); rebuilt by `index`. */
  wards: { x: number; y: number; r: number }[] = [];

  /** Rebuild the lookups after a change. */
  index(): void {
    this.version++;
    this.cover.clear();
    this.chunkThings.clear();
    this.chunkWalls.clear();
    this.wards = [];
    for (const t of this.things) {
      const p = partById(t.id);
      if (!p) continue;
      const e = extent(p, t.turn);
      if (p.ward) this.wards.push({ x: (t.x + e.w / 2) * CELL, y: (t.y + e.h / 2) * CELL, r: wardReach(p, e.w, e.h) });
      for (let y = t.y; y < t.y + e.h; y++) {
        for (let x = t.x; x < t.x + e.w; x++) {
          const k = cellKey(x, y);
          const list = this.cover.get(k);
          if (list) list.push(t);
          else this.cover.set(k, [t]);
        }
      }
      push(this.chunkThings, chunkOf(t.x, t.y), t);
    }
    for (const [k, v] of this.walls) {
      const cx = Math.floor(k / 65536);
      const cy = k % 65536;
      push(this.chunkWalls, chunkOf(cx, cy), [cx, cy, v]);
    }
    this.bridges = new Bridges(this.things.filter((t) => partById(t.id)?.bridge));
    const cells = (m: Map<number, number>) => [...m.keys()].map((k) => ({ x: Math.floor(k / 65536), y: k % 65536 }));
    const found = findHousesIn(cells(this.roofs), cells(this.tents));
    this.houses = found.houses;
    this.houseIds = found.at;
  }

  roofAt(cx: number, cy: number): number {
    return this.roofs.get(cellKey(cx, cy)) ?? 0;
  }

  tentAt(cx: number, cy: number): number {
    return this.tents.get(cellKey(cx, cy)) ?? 0;
  }

  /** The house or tent over cell (cx, cy), by its place in `houses`; -1 for none. */
  houseAt(cx: number, cy: number): number {
    return this.houseIds.get(houseKey(cx, cy)) ?? -1;
  }

  /**
   * Can a wall hanging or a door go at (cx, cy)? A door in a house's
   * doorway, one to a doorway; a hanging on a house wall whose face shows
   * (nothing joins it from the south), one to a wall. As in a Home.
   */
  fitsWall(part: PartDef, cx: number, cy: number, skip?: Thing): boolean {
    const v = this.wallAt(cx, cy);
    if (!v || !WALLS[wallMat(v)]?.house) return false;
    const mine = (t: Thing) => t !== skip && t.x === cx && t.y === cy;
    if (part.door) return wallKind(v) === 'door' && !this.thingsAt(cx, cy).some((t) => mine(t) && partById(t.id)?.door);
    return wallKind(v) === 'wall' && !this.wallAt(cx, cy + 1) && !this.thingsAt(cx, cy).some((t) => mine(t) && partById(t.id)?.wall);
  }

  /** How many critters are let out here. */
  critterCount(): number {
    return this.things.filter((t) => partById(t.id)?.critter).length;
  }

  floorAt(cx: number, cy: number): number {
    return this.floors.get(cellKey(cx, cy)) ?? 0;
  }

  /** Is cell (cx, cy) a laid pond? */
  isPond(cx: number, cy: number): boolean {
    const f = this.floorAt(cx, cy);
    return f > 0 && !!FLOORS[f - 1]?.water;
  }

  /** Is (x, y) inside a ward's reach, where no creature may rise? */
  warded(x: number, y: number): boolean {
    for (const w of this.wards) if ((x - w.x) ** 2 + (y - w.y) ** 2 < w.r * w.r) return true;
    return false;
  }

  thingsInChunk(ccx: number, ccy: number): Thing[] {
    return this.chunkThings.get(ccx * 4096 + ccy) ?? [];
  }

  wallsInChunk(ccx: number, ccy: number): [number, number, number][] {
    return this.chunkWalls.get(ccx * 4096 + ccy) ?? [];
  }

  /** Things covering cell (cx, cy): standing ones first, the last placed first. */
  thingsAt(cx: number, cy: number): Thing[] {
    const list = this.cover.get(cellKey(cx, cy));
    return list ? [...list].reverse().sort((a, b) => Number(!!partById(a.id)?.flat) - Number(!!partById(b.id)?.flat)) : [];
  }

  wallAt(cx: number, cy: number): number {
    return this.walls.get(cellKey(cx, cy)) ?? 0;
  }

  /** Which of a wall's neighbours are walls too: bits for north, east, south and west. */
  wallMask(cx: number, cy: number): number {
    return (this.wallAt(cx, cy - 1) ? 1 : 0) | (this.wallAt(cx + 1, cy) ? 2 : 0) | (this.wallAt(cx, cy + 1) ? 4 : 0) | (this.wallAt(cx - 1, cy) ? 8 : 0);
  }

  /** Is anything built across footprint (cx, cy, w, h) that `part` couldn't share it with? */
  occupied(part: PartDef, cx: number, cy: number, w: number, h: number): boolean {
    for (let y = cy; y < cy + h; y++) {
      for (let x = cx; x < cx + w; x++) {
        if (this.wallAt(x, y)) return true;
        // A rug can lie under a table, but not under another rug; nothing shares a bridge's cell.
        // Hangings, doors and critters keep to their own (see `fitsWall`, and a critter one to a cell).
        for (const t of this.cover.get(cellKey(x, y)) ?? []) {
          const p = partById(t.id);
          if (!p || p.wall || p.door) continue;
          if (p.critter || part.critter) {
            if (p.critter && part.critter) return true;
            continue;
          }
          if (p.bridge || part.bridge || !!p.flat === !!part.flat) return true;
        }
      }
    }
    return false;
  }

  /** Does something built here stop feet at world point (x, y)? As the Home's mask: walls but their gates, a laid pond but its edge, things' footprints or posts, and bridges' rails. */
  blocks(x: number, y: number): boolean {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    const deck = this.bridges.at(x, y);
    if (deck === Deck.Stop) return true;
    if (deck !== Deck.Walk && this.isPond(cx, cy)) {
      const px = x - cx * CELL;
      const py = y - cy * CELL;
      if ((px >= SHORE || this.isPond(cx - 1, cy)) && (px < CELL - SHORE || this.isPond(cx + 1, cy)) && (py >= SHORE || this.isPond(cx, cy - 1)) && (py < CELL - SHORE || this.isPond(cx, cy + 1))) return true;
    }
    for (let j = cy - 1; j <= cy + 1; j++) {
      for (let i = cx - 1; i <= cx + 1; i++) {
        const v = this.wallAt(i, j);
        if (!v) continue;
        const px = x - i * CELL;
        const py = y - j * CELL;
        const mask = this.wallMask(i, j);
        if (wallKind(v) === 'door') {
          const across = doorAcross(mask);
          if (across ? Math.abs(px - 8) < DOOR_HW && py >= 0 && py < CELL : Math.abs(py - 8) < DOOR_HW && px >= 0 && px < CELL) continue;
        }
        for (const b of wallBoxes(mask, WALLS[wallMat(v)].thick)) {
          if (px > b.x0 - WALL_PAD && px < b.x1 + WALL_PAD && py > b.y0 - WALL_PAD && py < b.y1 + WALL_PAD) return true;
        }
      }
    }
    // Tents' hems, all but their doorways.
    const h = this.houses[this.houseAt(cx, cy)];
    if (h?.tent && tentStops(h, x, y)) return true;
    for (const t of this.cover.get(cellKey(cx, cy)) ?? []) {
      const p = partById(t.id);
      if (!p || p.block === 'none' || p.wall) continue;
      const e = extent(p, t.turn);
      const px = x - t.x * CELL;
      const py = y - t.y * CELL;
      const w = e.w * CELL;
      const h = e.h * CELL;
      if (p.block === 'full' ? px > 1 && px < w - 1 && py > Math.min(4, h / 4) && py < h - 2 : px > w / 2 - 4 && px < w / 2 + 4 && py > h - 8 && py < h - 2) return true;
    }
    return false;
  }

  // ---- Saving

  /** The whole as `w1|things|walls|cleared|floors|roofs|tents`: a thing is `id.x.y` (and `.f` mirrored, `.r<n>` turned), a wall, floor, roof or tent `x.y.v`, a cleared spot its foot key; all base 36. */
  encode(): string {
    const things = this.things.map((t) => `${t.id}.${t.x.toString(36)}.${t.y.toString(36)}${t.flip ? '.f' : ''}${t.turn ? `.r${t.turn}` : ''}`).join(',');
    const cleared = [...this.cleared].map((k) => k.toString(36)).join(',');
    const cellsOf = (m: Map<number, number>) => [...m].map(([k, v]) => `${Math.floor(k / 65536).toString(36)}.${(k % 65536).toString(36)}.${v.toString(36)}`).join(',');
    return `w1|${things}|${cellsOf(this.walls)}|${cleared}|${cellsOf(this.floors)}|${cellsOf(this.roofs)}|${cellsOf(this.tents)}`;
  }

  /** Changes from `encode` (an empty set for anything that isn't one). Unknown parts and values are dropped. */
  static decode(s: string | null | undefined): ForestEdits {
    const e = new ForestEdits();
    if (!s || !s.startsWith('w1|')) return e;
    const [, things = '', walls = '', cleared = '', floors = '', roofs = '', tents = ''] = s.split('|');
    for (const item of things ? things.split(',') : []) {
      const [id, xs, ys, ...rest] = item.split('.');
      const p = partById(id);
      const x = parseInt(xs, 36);
      const y = parseInt(ys, 36);
      if (!p || !Number.isFinite(x) || !Number.isFinite(y) || e.things.length >= MAX_THINGS) continue;
      const r = rest.find((k) => k[0] === 'r');
      e.things.push({ id, x, y, flip: rest.includes('f') && !!p.flip, turn: p.turns && r ? parseInt(r.slice(1), 10) & 3 : 0 });
    }
    for (const item of walls ? walls.split(',') : []) {
      const [x, y, v] = item.split('.').map((n) => parseInt(n, 36));
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(v) || !knownWall(v) || e.walls.size >= MAX_WALLS) continue;
      e.walls.set(cellKey(x, y), v);
    }
    const layer = (list: string, into: Map<number, number>, kinds: number, max: number) => {
      for (const item of list ? list.split(',') : []) {
        const [x, y, v] = item.split('.').map((n) => parseInt(n, 36));
        if (!Number.isFinite(x) || !Number.isFinite(y) || !(v >= 1 && v <= kinds) || into.size >= max) continue;
        into.set(cellKey(x, y), v);
      }
    };
    layer(floors, e.floors, FLOORS.length, MAX_FLOORS);
    layer(roofs, e.roofs, ROOFS.length, MAX_ROOFS);
    layer(tents, e.tents, TENTS.length, MAX_TENTS);
    for (const k of cleared ? cleared.split(',') : []) {
      const n = parseInt(k, 36);
      if (Number.isFinite(n) && e.cleared.size < MAX_CLEARED) e.cleared.add(n);
    }
    e.index();
    return e;
  }
}

const chunkOf = (cx: number, cy: number): number => Math.floor(cx / CHUNK_CELLS) * 4096 + Math.floor(cy / CHUNK_CELLS);

function push<T>(m: Map<number, T[]>, k: number, v: T): void {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
}
