// A land's gen with its chunk layouts kept, and feet: the ground's own
// `open` plus whatever stands in the way. The arena asks `walkable` for
// every step, so layouts are cached (a few hundred chunks) rather than grown
// again. Pure: no Phaser.

import { CHUNK, type ChunkLayout, type LandGen, type LandProp } from './types';

/** Chunk layouts kept before the oldest are forgotten. */
const KEEP_LAYOUTS = 400;
/** The widest a block reaches from its feet (px): props this near a chunk's edge are checked from the next chunk too. */
const BLOCK_REACH = 32;

export class LandWorld {
  private layouts = new Map<number, ChunkLayout>();
  private blocks = new Map<number, LandProp[]>();

  constructor(readonly gen: LandGen) {}

  static key(cx: number, cy: number): number {
    return cx * 8192 + cy;
  }

  layout(cx: number, cy: number): ChunkLayout {
    const k = LandWorld.key(cx, cy);
    let l = this.layouts.get(k);
    if (l) {
      // Most recently used goes to the back, so the oldest is first to go.
      this.layouts.delete(k);
      this.layouts.set(k, l);
      return l;
    }
    l = this.gen.layout(cx, cy);
    this.layouts.set(k, l);
    this.blocks.set(k, l.props.filter((p) => p.block));
    if (this.layouts.size > KEEP_LAYOUTS) {
      const old = this.layouts.keys().next().value!;
      this.layouts.delete(old);
      this.blocks.delete(old);
    }
    return l;
  }

  walkable(x: number, y: number): boolean {
    if (!this.gen.open(x, y)) return false;
    const cx = Math.floor(x / CHUNK);
    const cy = Math.floor(y / CHUNK);
    const lx = x - cx * CHUNK;
    const ly = y - cy * CHUNK;
    const x0 = lx < BLOCK_REACH ? cx - 1 : cx;
    const x1 = lx > CHUNK - BLOCK_REACH ? cx + 1 : cx;
    const y0 = ly < BLOCK_REACH ? cy - 1 : cy;
    const y1 = ly > CHUNK - BLOCK_REACH ? cy + 1 : cy;
    for (let j = y0; j <= y1; j++) {
      for (let i = x0; i <= x1; i++) {
        const k = LandWorld.key(i, j);
        if (!this.layouts.has(k)) this.layout(i, j);
        for (const p of this.blocks.get(k)!) {
          const b = p.block!;
          const dx = (x - p.x - (p.flip ? -(b.ox ?? 0) : (b.ox ?? 0))) / b.rx;
          const dy = (y - p.y - (b.oy ?? 0)) / b.ry;
          if (dx * dx + dy * dy < 1) return false;
        }
      }
    }
    return true;
  }
}
