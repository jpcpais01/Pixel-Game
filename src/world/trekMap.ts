// The Everwood's explorer's map as canvases: each walked chunk painted once
// (art/mapArt.ts), then laid under its fog as far as it's known, ready to be
// drawn into the minimap or the full map. Chunks near the hero are painted
// from the forest the world is walking (its fields are already made); chunks
// far away (a map remembered from an earlier visit) from a forest of the
// map's own, so the world's caches aren't churned.

import { blankTile, fogTile, trekTile, TREK_T } from '../art/mapArt';
import { trek } from '../game/trek';
import { EVERWOOD_SEED, ForestGen, type Poi } from './forestGen';

/** Most painted chunks (terrain and finished) kept, and blank paper squares. */
const KEEP_TERRAIN = 1500;
const KEEP_TILES = 600;
const KEEP_BLANK = 400;

const key = (cx: number, cy: number): number => cx * 4096 + cy;

/** A Map trimmed to its newest `max` entries. */
function trim<V>(m: Map<number, V>, max: number): void {
  if (m.size <= max) return;
  let n = m.size - max;
  for (const k of m.keys()) {
    m.delete(k);
    if (--n <= 0) break;
  }
}

function canvasOf(px: Uint8ClampedArray): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = TREK_T;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px), TREK_T, TREK_T), 0, 0);
  return c;
}

export class TrekMap {
  private terrain = new Map<number, Uint8ClampedArray>();
  private tiles = new Map<number, HTMLCanvasElement>();
  private blanks = new Map<number, { px: Uint8ClampedArray; canvas: HTMLCanvasElement }>();
  /** Walked chunks waiting to be painted, nearest the asker first. */
  private wanted = new Set<number>();
  private own: ForestGen | null = null;
  /** Raised when a tile changes, so whatever shows them draws again. */
  version = 0;

  constructor(private live: ForestGen) {}

  /** The map's own forest, for chunks the world's doesn't have to hand. */
  private gen(cx: number, cy: number): ForestGen {
    if (this.live.hasFields(cx, cy)) return this.live;
    this.own ??= new ForestGen(EVERWOOD_SEED);
    return this.own;
  }

  /** Squares the hero just walked: their tiles and their neighbours' (whose fog frays into them) are laid again. */
  sync(): void {
    if (!trek.fresh.size) return;
    for (const k of trek.fresh) {
      const cx = Math.floor(k / 4096);
      const cy = k % 4096;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) this.tiles.delete(key(cx + i, cy + j));
    }
    trek.fresh.clear();
    this.version++;
  }

  /** The finished tile for chunk (cx, cy): its map under the fog, blank paper if never walked, null while it waits to be painted. */
  tile(cx: number, cy: number): HTMLCanvasElement | null {
    const k = key(cx, cy);
    const done = this.tiles.get(k);
    if (done) return done;
    // A neighbour walked may fray into a chunk never walked: it needs its map too.
    let near = false;
    for (let j = -1; j <= 1 && !near; j++) for (let i = -1; i <= 1 && !near; i++) near = trek.seen(cx + i, cy + j);
    if (!near) return this.blank(cx, cy).canvas;
    const t = this.terrain.get(k);
    if (!t) {
      this.wanted.add(k);
      return null;
    }
    const c = canvasOf(fogTile(t, this.blank(cx, cy).px, cx, cy, (fx, fy) => trek.known(fx, fy)));
    this.tiles.set(k, c);
    trim(this.tiles, KEEP_TILES);
    return c;
  }

  /** Chunk (cx, cy)'s blank paper. */
  private blank(cx: number, cy: number): { px: Uint8ClampedArray; canvas: HTMLCanvasElement } {
    const k = key(cx, cy);
    let b = this.blanks.get(k);
    if (!b) {
      const px = blankTile(cx, cy);
      b = { px, canvas: canvasOf(px) };
      this.blanks.set(k, b);
      trim(this.blanks, KEEP_BLANK);
    }
    return b;
  }

  /**
   * Paint waiting chunks for up to `budget` ms (always one, if any wait).
   * Chunks the world's forest has fields for cost a few ms and go first;
   * the others, tens of ms each, only when `cold` allows them.
   */
  work(budget: number, cold: boolean): void {
    if (!this.wanted.size) return;
    const t0 = performance.now();
    let made = 0;
    for (const pass of [false, true]) {
      if (pass && !cold) break;
      for (const k of this.wanted) {
        const cx = Math.floor(k / 4096);
        const cy = k % 4096;
        if (made && performance.now() - t0 > budget) break;
        if (!pass && !this.live.hasFields(cx, cy)) continue;
        this.wanted.delete(k);
        this.terrain.set(k, trekTile(this.gen(cx, cy), cx, cy, (x, y) => this.live.isCleared(x, y)));
        trim(this.terrain, KEEP_TERRAIN);
        made++;
      }
    }
    // Asked for long ago and still waiting: they'll be asked for again when shown.
    if (this.wanted.size > 200) this.wanted.clear();
    if (made) this.version++;
  }

  /** The forest's places in a box (from the map's own forest when the box is wide, to spare the world's caches). */
  places(x0: number, y0: number, x1: number, y1: number): Poi[] {
    const wide = x1 - x0 > 2000 || y1 - y0 > 2000;
    if (wide) this.own ??= new ForestGen(EVERWOOD_SEED);
    return (wide ? this.own! : this.live).poisIn(x0, y0, x1, y1);
  }
}
