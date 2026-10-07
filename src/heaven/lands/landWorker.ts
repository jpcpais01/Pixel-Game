// Paints a land's ground off the main thread (see LandRuntime.ts). A tile
// is tens of milliseconds of work on a phone, too much to slip into frames
// while the wanderer walks, so a worker grows the same land from the same
// seed and sends back each tile's pixels, handed over outright.

import { landGen } from './gens';
import { paintTile } from './paint';
import type { LandTile } from './types';

export interface TileAsk {
  land: string;
  col: number;
  row: number;
}

export interface TileDone {
  land: string;
  tile: LandTile;
}

interface WorkerScope {
  onmessage: ((e: MessageEvent<TileAsk>) => void) | null;
  postMessage(message: TileDone, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (e) => {
  const { land, col, row } = e.data;
  const gen = landGen(land);
  if (!gen) return;
  const tile = paintTile(gen.ground, col, row);
  const transfer: Transferable[] = [tile.day.buffer, tile.night.buffer, tile.normal.buffer];
  if (tile.glow) transfer.push(tile.glow.buffer);
  scope.postMessage({ land, tile }, transfer);
};
