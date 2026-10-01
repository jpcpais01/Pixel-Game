import { thingFoot } from '../art/homeArt';
import { PLOT_X, PLOT_Y, type Thing } from './homeLayout';

// A grid things are built on, the Home's plot or the Everwood: what the
// parts shared by both (the critters let out, the farm, fishing) need to
// know of it. Cells are the grid's own (the Home's from its plot's corner,
// the Everwood's from the world's); `ox`, `oy` place cell (0, 0) in the world.

export interface BuildLand {
  readonly ox: number;
  readonly oy: number;
  readonly things: Thing[];
  floorAt(cx: number, cy: number): number;
  wallAt(cx: number, cy: number): number;
  /** Water at the cell: a pond laid, or (in the Everwood) its own streams and ponds. */
  isWater(cx: number, cy: number): boolean;
  thingsAt(cx: number, cy: number): Thing[];
  /** The house or tent over a cell (-1 for none). */
  houseAt(cx: number, cy: number): number;
  /** Can feet stand at world point (x, y)? */
  walkable(x: number, y: number): boolean;
  /** The cells of water a critter might keep to: the ponds laid. */
  waterCells(): Iterable<{ x: number; y: number }>;
}

/** Where a thing's foot stands in the world on this land (art/homeArt.ts works on the Home's plot). */
export function footOn(land: BuildLand, t: Thing): { x: number; y: number } {
  const f = thingFoot(t);
  return { x: f.x - PLOT_X + land.ox, y: f.y - PLOT_Y + land.oy };
}
