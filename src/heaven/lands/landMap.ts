// A land's map for the minimap and the big map (scenes/MapScene.ts): the
// land is endless, so rather than one picture of it, it is painted a chunk
// at a time round wherever the maps look, one map pixel for every MAP_CELL
// px of ground, straight from the land's pure gen (its ground kinds and
// their day ramps, a touch of its slopes, what stands as darker dots), and
// kept as small canvases until they're far behind. Like world/trekMap.ts
// for the Everwood, without the fog: a land is all there to see.

import { MAP_CELL } from '../../art/mapArt';
import type { CozyMap } from '../../game/cozy';
import { landGen } from './gens';
import { CHUNK, type GroundCell, type LandGen } from './types';

/** Map pixels across a tile (a chunk). */
const T = CHUNK / MAP_CELL;
/** Most painted tiles kept (each a 32 px square canvas, 4 KB): enough for the big map zoomed out on a wide screen. */
const KEEP_TILES = 1200;
/** Tiles asked for and not yet painted beyond this are forgotten: they'll be asked for again when shown. */
const MAX_WANTED = 300;
/** How much the ground's slopes, sampled MAP_CELL px apart, move a pixel along its ramp (a fraction of the kind's relief). */
const MAP_RELIEF = 0.12;
/** What stands and stops feet (trees, rocks, huts) is drawn this much darker than the ground under it. */
const PROP_SHADE = 0.6;

const key = (tx: number, ty: number): number => tx * 8192 + ty;

export class LandMap implements CozyMap {
  readonly size = T;
  private tiles = new Map<number, HTMLCanvasElement>();
  private wanted = new Set<number>();
  private c: GroundCell = { kind: 0, height: 0, tone: 0, glow: 0 };
  /** Heights of a tile's samples, a sample of margin all round (for the slopes). */
  private hs = new Float32Array((T + 2) * (T + 2));
  private ks = new Uint8Array((T + 2) * (T + 2));
  private ts = new Float32Array((T + 2) * (T + 2));
  version = 0;

  constructor(private gen: LandGen) {}

  /** The painted tile (tx, ty), or null while it waits its turn (it's asked for). */
  tile(tx: number, ty: number): HTMLCanvasElement | null {
    const k = key(tx, ty);
    const t = this.tiles.get(k);
    if (t) return t;
    this.wanted.add(k);
    return null;
  }

  /** Paint waiting tiles for up to `budget` ms (always one, if any wait). */
  work(budget: number): void {
    if (!this.wanted.size) return;
    const t0 = performance.now();
    let made = 0;
    for (const k of this.wanted) {
      if (made && performance.now() - t0 > budget) break;
      this.wanted.delete(k);
      const tx = Math.floor(k / 8192);
      this.tiles.set(k, this.paint(tx, k - tx * 8192));
      made++;
    }
    // Oldest first out: the tiles left behind as the hero walks on.
    let n = this.tiles.size - KEEP_TILES;
    for (const old of this.tiles.keys()) {
      if (n-- <= 0) break;
      this.tiles.delete(old);
    }
    if (this.wanted.size > MAX_WANTED) this.wanted.clear();
    if (made) this.version++;
  }

  /** One tile: a sample of the ground at the middle of each map pixel, coloured off its kind's day ramp. */
  private paint(tx: number, ty: number): HTMLCanvasElement {
    const g = this.gen.ground;
    const c = this.c;
    const P = T + 2;
    const x0 = tx * CHUNK;
    const y0 = ty * CHUNK;
    const half = MAP_CELL / 2;
    for (let j = 0; j < P; j++) {
      for (let i = 0; i < P; i++) {
        c.kind = 0;
        c.height = 0;
        c.tone = 0;
        c.glow = 0;
        g.cell(x0 + (i - 1) * MAP_CELL + half, y0 + (j - 1) * MAP_CELL + half, c);
        const n = j * P + i;
        this.ks[n] = c.kind;
        this.hs[n] = c.height;
        this.ts[n] = c.tone;
      }
    }
    const img = new ImageData(T, T);
    const d = img.data;
    for (let j = 0; j < T; j++) {
      for (let i = 0; i < T; i++) {
        const n = (j + 1) * P + i + 1;
        const style = g.kinds[this.ks[n]];
        // Lit from the top left, as the ground itself is: slopes facing it a step lighter, facing away a step darker.
        const slope = (this.hs[n - 1] - this.hs[n + 1] + this.hs[n - P] - this.hs[n + P]) / MAP_CELL;
        const ramp = style.day;
        let s = Math.round(style.mid + this.ts[n] + slope * style.relief * MAP_RELIEF);
        s = s < 0 ? 0 : s >= ramp.length ? ramp.length - 1 : s;
        const col = ramp[s];
        const o = (j * T + i) * 4;
        d[o] = col[0];
        d[o + 1] = col[1];
        d[o + 2] = col[2];
        d[o + 3] = 255;
      }
    }
    // What stands in the way, as darker dots at its feet.
    for (const p of this.gen.layout(tx, ty).props) {
      if (!p.block) continue;
      const i = Math.floor((p.x - x0) / MAP_CELL);
      const j = Math.floor((p.y - y0) / MAP_CELL);
      if (i < 0 || j < 0 || i >= T || j >= T) continue;
      const o = (j * T + i) * 4;
      d[o] *= PROP_SHADE;
      d[o + 1] *= PROP_SHADE;
      d[o + 2] *= PROP_SHADE;
    }
    const cv = document.createElement('canvas');
    cv.width = cv.height = T;
    cv.getContext('2d')!.putImageData(img, 0, 0);
    return cv;
  }
}

/** A fresh map of land `id` (null for any other arena): made each visit, so its tiles go with it. */
export function landMap(id: string): LandMap | null {
  const gen = landGen(id);
  return gen ? new LandMap(gen) : null;
}
