// Paints the Everwood's ground off the main thread (see Forest.ts).
//
// A forest tile is a quarter of a second of work on a phone: far too much to
// slip into frames while the hero walks. So a worker grows the same forest
// from the same seed, paints each tile it is asked for, and sends back its
// pixels, along with the field chunks and layouts it made on the way, which
// the main thread would otherwise have to make again to stand up the trees.

import { buildStrip, type GroundStrip } from '../art/ground';
import { ForestGen, type FreshWork } from './forestGen';
import { forestTile } from './forestGround';

export interface TileAsk {
  seed: number;
  col: number;
  row: number;
  /** The tile's version: it is painted again when the player clears a tree near it. */
  ver: number;
}

/** The trees the player has cleared (by foot key), sent before any tile they change is asked for. */
export interface ClearedNote {
  cleared: number[];
}

export interface TileDone {
  seed: number;
  col: number;
  row: number;
  ver: number;
  strip: GroundStrip;
  fresh: FreshWork;
}

interface WorkerScope {
  onmessage: ((e: MessageEvent<TileAsk | ClearedNote>) => void) | null;
  postMessage(message: TileDone, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;
let gen: ForestGen | null = null;
let cleared: Set<number> | null = null;

scope.onmessage = (e) => {
  if ('cleared' in e.data) {
    cleared = new Set(e.data.cleared);
    if (gen) gen.cleared = cleared;
    return;
  }
  const { seed, col, row, ver } = e.data;
  if (!gen || gen.seed !== seed) {
    gen = new ForestGen(seed);
    gen.cleared = cleared;
    gen.noteFresh();
  }
  const b = buildStrip(forestTile(gen, col, row, ver), row);
  let r = b.next();
  while (!r.done) r = b.next();
  const strip = r.value;
  const fresh = gen.takeFresh();
  // The pixels are handed over outright; the fields are copied (this side keeps its own for the next tiles).
  const transfer: Transferable[] = [strip.night.diffuse.buffer, strip.night.normal.buffer, strip.day.diffuse.buffer, strip.day.normal.buffer];
  if (strip.emissive) transfer.push(strip.emissive.buffer);
  scope.postMessage({ seed, col, row, ver, strip, fresh }, transfer);
};
