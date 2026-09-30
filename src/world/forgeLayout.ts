// The Forge on the west of the Runestone Clearing: a smithy that is part of
// the map itself (João's rule for lesser buildings). From outside it is a
// stone and timber smithy under a sooty tiled roof, a great chimney smoking
// over it; walk in through its wide door and the roof and front fade away,
// showing the forge inside with the hero in it.
//
// The hall, from the back: the north wall's face with the hearth's copper hood
// and chimney breast, the tool rack and the shelf of boss materials; on the
// floor, the hearth against the wall with its bellows, the coal heap, the
// anvil in the middle where Brenna works, and the quench trough; the south
// wall with the doorway in its middle.

/** The smithy's footprint in the world: its left edge, the top of its back wall, its width, and its height down to the front wall's foot. */
export const FG_X = 26;
export const FG_TOP = 232;
export const FG_W = 128;
export const FG_H = 148;
/** The middle of the doorway, and the front wall's foot (feet row). */
export const FG_CX = FG_X + FG_W / 2;
export const FG_FOOT = FG_TOP + FG_H;

// The hall's plan, in its own coordinates (0,0 its top-left).
/** Side walls' thickness, the back wall's top, where the floor starts, and where the front wall starts. */
export const F_SIDE = 6;
export const F_CAP = 6;
export const F_FLOOR = 50;
export const F_FRONT = 136;
/** Half the doorway's width. */
export const F_DOOR_HW = 12;

/** The hearth against the back wall: its middle and its front's foot. */
export const F_HEARTH = { x: 40, y: 70 };
/** The bellows beside it, blowing into its west side. */
export const F_BELLOWS = { x: 13, y: 67 };
/** The anvil on its stump (its foot), where Brenna stands hammering, just behind it. */
export const F_ANVIL = { x: 66, y: 102 };
/** The quench trough, east of the anvil. */
export const F_TROUGH = { x: 102, y: 88 };
/** The shelf of boss materials and the tool rack on the north wall. */
export const F_SHELF = { x: 80, y: 24, w: 38 };

/** Outside: the water barrel east of the door and the grindstone west of it, their feet in world coordinates. */
export const FG_BARREL = { x: FG_X + FG_W - 16, y: FG_FOOT + 9 };
export const FG_GRIND = { x: FG_X + 20, y: FG_FOOT + 11 };

/** The smithy from outside: its art is a little wider than the walls (the roof's eaves) and rises above its back wall (the chimney). */
export const FG_EXT_W = FG_W + 8;
export const FG_EXT_H = FG_H + 22;

/** Round things standing in the hall, in hall coordinates: the smith, the anvil. */
const ROUND = [
  { x: F_ANVIL.x, y: F_ANVIL.y - 2, r: 10 },
  { x: F_ANVIL.x - 5, y: F_ANVIL.y - 9, r: 7 },
];
/** Boxes standing in the hall (left, top, right, bottom): the hearth, the bellows, the trough. */
const BOXES = [
  [F_HEARTH.x - 20, F_FLOOR - 4, F_HEARTH.x + 20, F_HEARTH.y - 1],
  [F_BELLOWS.x - 7, F_BELLOWS.y - 10, F_BELLOWS.x + 7, F_BELLOWS.y - 1],
  [F_TROUGH.x - 13, F_TROUGH.y - 8, F_TROUGH.x + 13, F_TROUGH.y - 1],
];

/** Is the hero at (x, y) inside the smithy (the doorway counts)? */
export function inForge(x: number, y: number): boolean {
  const lx = x - FG_X;
  const ly = y - FG_TOP;
  return lx > F_SIDE && lx < FG_W - F_SIDE && ly > F_FLOOR && ly < FG_H - 1;
}

/** Is (x, y) blocked by the smithy: its walls, or what stands in its hall? */
export function forgeBlocks(x: number, y: number): boolean {
  const lx = x - FG_X;
  const ly = y - FG_TOP;
  if (lx < -2 || lx > FG_W + 2 || ly < -2 || ly > FG_H) return false;
  const door = Math.abs(x - FG_CX) < F_DOOR_HW - 4 && ly >= F_FRONT - 4;
  const floor = lx > F_SIDE + 5 && lx < FG_W - F_SIDE - 5 && ly > F_FLOOR + 5 && ly < F_FRONT - 2;
  if (!floor && !door) return true;
  if (BOXES.some(([l, t, r, b]) => lx > l - 3 && lx < r + 3 && ly > t && ly < b + 3)) return true;
  return ROUND.some((c) => Math.hypot(lx - c.x, (ly - c.y) * 1.4) < c.r);
}

/** Round things outside, in world coordinates, for the lawn's walkable test. */
export function forgeYardBlocks(x: number, y: number): boolean {
  return Math.hypot(x - FG_BARREL.x, (y - FG_BARREL.y) * 1.5) < 7 || Math.hypot(x - FG_GRIND.x, (y - FG_GRIND.y) * 1.5) < 9;
}
