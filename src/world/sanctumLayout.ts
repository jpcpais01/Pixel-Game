// The Rune Temple at the head of the Runestone Clearing: a walk-in building,
// part of the map itself like the Forge. From outside it is an old temple of
// the plaza's fieldstone under a steep mossy slate roof, its gable to the
// plaza with a great rose of rune glass; walk in through its doors and the
// roof and front fade away, showing the hall with the hero in it.
//
// The hall, from the back: the north wall's face with its rose window, two
// lancets and the keepers' banners, two braziers before it; on the floor,
// Nyx the Unmaker's dais on the west, where she breaks gear down into dust,
// Tharn the Runesmith's on the east, where he spends dust raising a piece's
// level, and a rosette in the middle with a crimson runner to the door; the
// south wall with the doorway in its middle, and two broad steps down to the
// plaza outside it.

/** The temple's footprint in the world: its left edge, the top of its back wall, its width, and its height down to the front wall's foot. */
export const TP_W = 208;
export const TP_H = 196;
export const TP_X = 320 - TP_W / 2;
export const TP_TOP = 76;
/** The middle of the doorway, and the front wall's foot (feet row). */
export const TP_CX = TP_X + TP_W / 2;
export const TP_FOOT = TP_TOP + TP_H;

// The hall's plan, in its own coordinates (0,0 its top-left).
/** Side walls' thickness, the back wall's top, where the floor starts (the back wall's face is 60 px high), and where the front wall starts. */
export const T_SIDE = 8;
export const T_CAP = 8;
export const T_FLOOR = 68;
export const T_FRONT = 184;
/** Half the doorway's width. */
export const T_DOOR_HW = 14;
/** The steps down from the door, painted with the hall: their depth below the foot, and each step's half-width (upper, lower). */
export const T_STEPS = 16;
export const T_STEP_HW = [34, 40] as const;
/** The hall's painted texture: the footprint and the steps under it. */
export const TP_TEX_H = TP_H + T_STEPS;

/** The rose window, the two lancets and the banners on the north wall. */
export const T_WINDOW = { x: 104, y: 34, r: 17 };
export const T_LANCETS = [60, 148];
export const T_BANNERS = { disenchant: 32, upgrade: 176 } as const;
/** The rosette in the middle of the floor. */
export const T_CIRCLE = { x: 104, y: 138, rx: 40, ry: 26 };
/** Each keeper's dais: its middle and size, where the keeper stands and their station beside them. */
export const T_DAIS = {
  disenchant: { x: 48, y: 110, rx: 34, ry: 21, keeper: { x: 56, y: 106 }, station: { x: 30, y: 118 } },
  upgrade: { x: 160, y: 110, rx: 34, ry: 21, keeper: { x: 152, y: 106 }, station: { x: 180, y: 118 } },
} as const;
export type KeeperId = keyof typeof T_DAIS;
/** The two braziers before the north wall, either side of the rose window. */
export const T_BRAZIERS = [
  { x: 80, y: 82 },
  { x: 128, y: 82 },
];

/** The temple from outside: its art is a little wider than the walls (the eaves), bottom at the front wall's foot, and rises above its back wall (the roof's back gable). */
export const TP_EXT_W = TP_W + 12;
export const TP_EXT_RISE = 36;
export const TP_EXT_H = TP_H + TP_EXT_RISE;

/** The two runestones standing either side of the steps, in world coordinates. */
export const RUNESTONES = [
  { x: TP_CX - 52, y: TP_FOOT + 13 },
  { x: TP_CX + 52, y: TP_FOOT + 13 },
];

/** Round things standing in the hall (keepers, stations, braziers), in hall coordinates. */
const BLOCKERS = [
  ...Object.values(T_DAIS).flatMap((d) => [
    { x: d.keeper.x, y: d.keeper.y - 1, r: 6 },
    { x: d.station.x, y: d.station.y - 2, r: 12 },
  ]),
  ...T_BRAZIERS.map((b) => ({ x: b.x, y: b.y - 1, r: 7 })),
];

/** Is the hero at (x, y) inside the temple (the doorway counts)? */
export function inTemple(x: number, y: number): boolean {
  const lx = x - TP_X;
  const ly = y - TP_TOP;
  return lx > T_SIDE && lx < TP_W - T_SIDE && ly > T_FLOOR && ly < TP_H - 1;
}

/** Is (x, y) blocked by the temple: its walls and eaves, what stands in its hall, or a runestone? */
export function templeBlocks(x: number, y: number): boolean {
  if (RUNESTONES.some((r) => Math.hypot(x - r.x, (y - r.y) * 1.5) < 6)) return true;
  const lx = x - TP_X;
  const ly = y - TP_TOP;
  if (lx < -6 || lx > TP_W + 6 || ly < -2 || ly > TP_H) return false;
  const door = Math.abs(x - TP_CX) < T_DOOR_HW - 4 && ly >= T_FRONT - 4;
  const floor = lx > T_SIDE + 5 && lx < TP_W - T_SIDE - 5 && ly > T_FLOOR + 5 && ly < T_FRONT - 2;
  if (!floor && !door) return true;
  return BLOCKERS.some((b) => Math.hypot(lx - b.x, (ly - b.y) * 1.4) < b.r);
}
