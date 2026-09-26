// The walk-in chapel on the east side of the Runestone Clearing: a second
// home for Nyx and Tharn that is part of the map itself. From outside it is a
// stone chapel under a mossy slate roof; walk in through its door and the
// roof and front fade away, showing the hall inside where the hero stands.
//
// The hall, from the back: the north wall's face with its rose window, two
// lancets and the keepers' banners; the floor, with Nyx's dais on the west,
// Tharn's on the east and a rosette in the middle; the south wall with the
// doorway in its middle.

/** The chapel's footprint in the world: its left edge, the top of its back wall's face, width, and height down to the front wall's foot. */
export const CH_X = 488;
export const CH_TOP = 166;
export const CH_W = 148;
export const CH_H = 256;
/** The middle of the doorway, and the front wall's foot (feet row). */
export const CH_CX = CH_X + CH_W / 2;
export const CH_FOOT = CH_TOP + CH_H;

// The hall's plan, in its own coordinates (0,0 its top-left).
/** Side walls' thickness, the back wall's top, where the floor starts, and where the front wall starts. */
export const C_SIDE = 8;
export const C_CAP = 8;
export const C_FLOOR = 48;
export const C_FRONT = 244;
/** Half the doorway's width. */
export const C_DOOR_HW = 12;
/** The rose window, the two lancets and the banners on the north wall. */
export const C_WINDOW = { x: 74, y: 27, r: 12 };
export const C_LANCETS = [46, 102];
export const C_BANNERS = { disenchant: 21, upgrade: 127 } as const;
/** The rosette in the middle of the floor. */
export const C_CIRCLE = { x: 74, y: 180, rx: 40, ry: 26 };
/** Each keeper's dais, where they stand and their station. */
export const C_DAIS = {
  disenchant: { x: 36, y: 110, rx: 28, ry: 17, keeper: { x: 44, y: 104 }, station: { x: 24, y: 122 } },
  upgrade: { x: 112, y: 110, rx: 28, ry: 17, keeper: { x: 104, y: 104 }, station: { x: 124, y: 122 } },
} as const;

/** The chapel from outside: its art is a little wider than the walls (the roof's eaves), bottom at the front wall's foot. */
export const CH_EXT_W = 156;
export const CH_EXT_H = 272;

/** Round things standing in the hall (keepers, stations), in hall coordinates. */
const BLOCKERS = Object.values(C_DAIS).flatMap((d) => [
  { x: d.keeper.x, y: d.keeper.y - 1, r: 6 },
  { x: d.station.x, y: d.station.y - 2, r: 11 },
]);

/** Is the hero at (x, y) inside the chapel (the doorway counts)? */
export function inChapel(x: number, y: number): boolean {
  const lx = x - CH_X;
  const ly = y - CH_TOP;
  return lx > C_SIDE && lx < CH_W - C_SIDE && ly > C_FLOOR && ly < CH_H - 1;
}

/** Is (x, y) blocked by the chapel: its walls, or what stands in its hall? */
export function chapelBlocks(x: number, y: number): boolean {
  const lx = x - CH_X;
  const ly = y - CH_TOP;
  if (lx < -2 || lx > CH_W + 2 || ly < C_FLOOR - 8 || ly > CH_H) return false;
  const door = Math.abs(x - CH_CX) < C_DOOR_HW - 4 && ly >= C_FRONT - 4;
  const floor = lx > C_SIDE + 5 && lx < CH_W - C_SIDE - 5 && ly > C_FLOOR + 5 && ly < C_FRONT - 2;
  if (!floor && !door) return true;
  return BLOCKERS.some((b) => Math.hypot(lx - b.x, (ly - b.y) * 1.4) < b.r);
}
