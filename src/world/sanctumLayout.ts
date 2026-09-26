// The Rune Temple in the Runestone Clearing: where it stands on the plaza's
// west side, and the room inside it. The room lies in the same world, off to
// the east past the clearing's edge, in the dark; the camera keeps to it while
// the hero is inside, so walking through the door is a step into the temple.
//
// Inside: the north wall with its rose window, a rune circle in the middle of
// the floor, and a dais on each side for the two keepers: Nyx the Unmaker on
// the west, who breaks gear down into dust, and Tharn the Runesmith on the
// east, who spends dust raising a piece's level. The way out is the doorway in
// the middle of the south wall.

/** The temple's front: the middle of its doorway, and the bottom edge of its lowest step (feet row). */
export const TEMPLE_X = 104;
export const TEMPLE_Y = 356;
/** Half the building's width, and how deep its body runs back from the steps. */
const BODY_HW = 60;
const BODY_D = 58;
/** The steps in front, and the walkable way up them to the door. */
const STEPS_D = 14;
const STAIR_HW = 15;
/** Walking into the doorway on the top step goes in. */
const DOOR_HW = 9;
const DOOR_Y = TEMPLE_Y - STEPS_D + 1;

/** The room, in world coordinates. */
export const ROOM_X = 720;
export const ROOM_Y = 112;
export const ROOM_W = 448;
export const ROOM_H = 304;

// The room's own plan, in its own coordinates (0,0 its top-left).
/** Inner edges of the side walls, the top of the north wall's face, where the floor starts, and the south wall. */
export const IN_L = 32;
export const IN_R = 416;
export const FACE_TOP = 34;
export const FLOOR_TOP = 102;
export const FLOOR_BOT = 272;
/** The doorway through the south wall, and where the way down ends. */
export const DOOR_L = 208;
export const DOOR_R = 240;
export const DOOR_BOT = 298;
/** The rune circle in the floor. */
export const CIRCLE = { x: 224, y: 196, rx: 66, ry: 46 };
/** The rose window high in the north wall. */
export const WINDOW = { x: 224, y: 64, r: 22 };
/** Each keeper's dais: where they stand, their station beside them, and the banner on the wall behind. */
export const DAIS = {
  disenchant: { x: 108, y: 174, rx: 46, ry: 30, keeper: { x: 112, y: 166 }, station: { x: 80, y: 182 }, banner: 104 },
  upgrade: { x: 340, y: 174, rx: 46, ry: 30, keeper: { x: 336, y: 166 }, station: { x: 370, y: 182 }, banner: 344 },
} as const;
export type KeeperId = keyof typeof DAIS;
/** The room's four pillars, and the two braziers flanking the window. */
export const PILLARS = [
  { x: 52, y: 122 },
  { x: 396, y: 122 },
  { x: 52, y: 262 },
  { x: 396, y: 262 },
];
export const ROOM_BRAZIERS = [
  { x: 176, y: 116 },
  { x: 272, y: 116 },
];

/** Where the hero appears on the way in (just inside the door) and on the way out (on the steps' foot). */
export const INSIDE_SPOT = { x: ROOM_X + (DOOR_L + DOOR_R) / 2, y: ROOM_Y + FLOOR_BOT - 8 };
export const OUTSIDE_SPOT = { x: TEMPLE_X, y: TEMPLE_Y + 10 };

/** World size once the room is added to the clearing. */
export const SANCTUM_WORLD_W = ROOM_X + ROOM_W + 16;

/** The room in world coordinates, for the camera to keep to. */
export const roomRect = { x: ROOM_X, y: ROOM_Y, w: ROOM_W, h: ROOM_H };

/** Is (x, y) outside, blocked by the temple's walls or the steps' sides? */
export function templeBlocks(x: number, y: number): boolean {
  const dx = Math.abs(x - TEMPLE_X);
  if (dx > BODY_HW) return false;
  const front = TEMPLE_Y - STEPS_D;
  // The steps: only their middle leads up.
  if (y > front && y <= TEMPLE_Y) return dx > STAIR_HW;
  // The walls, but for a little way into the doorway.
  return y > front - BODY_D && y <= front && !(dx < DOOR_HW && y > front - 5);
}

/** Does a hero at (x, y) walk in through the temple's door? */
export const atTempleDoor = (x: number, y: number): boolean => Math.abs(x - TEMPLE_X) < DOOR_HW && y < DOOR_Y && y > DOOR_Y - 12;

/** Is (x, y) inside the room at all? */
export const inRoom = (x: number, y: number): boolean => x >= ROOM_X && x < ROOM_X + ROOM_W && y >= ROOM_Y && y < ROOM_Y + ROOM_H;

/** Does a hero at (x, y) in the room leave through the doorway? */
export const atRoomExit = (x: number, y: number): boolean => inRoom(x, y) && y - ROOM_Y > DOOR_BOT - 12;

/** Round things standing in the room (pillars, braziers, stations, keepers), as centre and radius, room coordinates. */
const BLOCKERS: { x: number; y: number; r: number }[] = [
  ...PILLARS.map((p) => ({ x: p.x, y: p.y - 2, r: 9 })),
  ...ROOM_BRAZIERS.map((b) => ({ x: b.x, y: b.y - 1, r: 7 })),
  ...Object.values(DAIS).flatMap((d) => [
    { x: d.keeper.x, y: d.keeper.y - 1, r: 6 },
    { x: d.station.x, y: d.station.y - 2, r: 11 },
  ]),
];

/** Can feet stand at (x, y) in the room (world coordinates)? */
export function roomWalkable(x: number, y: number): boolean {
  const lx = x - ROOM_X;
  const ly = y - ROOM_Y;
  const floor = lx > IN_L + 6 && lx < IN_R - 6 && ly > FLOOR_TOP + 6 && ly < FLOOR_BOT - 2;
  const door = lx > DOOR_L + 5 && lx < DOOR_R - 5 && ly >= FLOOR_BOT - 2 && ly < DOOR_BOT;
  if (!floor && !door) return false;
  return !BLOCKERS.some((b) => Math.hypot(lx - b.x, (ly - b.y) * 1.4) < b.r);
}
