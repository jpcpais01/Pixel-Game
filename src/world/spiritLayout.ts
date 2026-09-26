// The Spirit Dungeon's shape: a crawl north through four chambers joined by
// corridors, from the Hall of Whispers where heroes arrive, through the
// crypt and the ossuary with its spirit pool, up the statue-lined approach
// to the Sanctum where the Hollow Queen waits. Pure functions of world
// coordinates, shared by the art (art/spirit.ts) and the game
// (world/Spirit.ts).

import type { SpawnSpot } from '../game/monsters';

export const SPIRIT_W = 560;
export const SPIRIT_H = 1400;
/** How tall the stone faces of the north walls stand, in pixels. */
export const WALL_H = 26;

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The chambers, deepest last, and the corridors between them. */
export const HALL: Rect = { x0: 170, y0: 1180, x1: 390, y1: 1352 };
export const CRYPT: Rect = { x0: 110, y0: 900, x1: 450, y1: 1080 };
export const OSSUARY: Rect = { x0: 80, y0: 560, x1: 480, y1: 780 };
/** The Sanctum is round: its centre and radii. */
export const SANCTUM = { cx: 280, cy: 262, rx: 196, ry: 168 };
// Each corridor reaches well into the chambers it joins, so the floor stays
// continuous once the walkable margin is taken off every rect.
const CORRIDORS: Rect[] = [
  { x0: 252, y0: 1064, x1: 308, y1: 1196 },
  { x0: 374, y0: 764, x1: 430, y1: 916 },
  { x0: 244, y0: 400, x1: 316, y1: 576 },
];

/** The spirit pool in the ossuary: glowing water no one can walk on. */
export const POOL = { cx: 280, cy: 672, rx: 58, ry: 30 };

/** Where heroes arrive: the south end of the Hall of Whispers. */
export const SPIRIT_SPAWN = { x: 280, y: 1318 };

/** The Hollow Queen's place, at the heart of the Sanctum's ritual circle. */
export const QUEEN_HOME = { x: SANCTUM.cx, y: SANCTUM.cy + 8 };

const inRect = (r: Rect, x: number, y: number, m: number) => x >= r.x0 + m && x < r.x1 - m && y >= r.y0 + m && y < r.y1 - m;

/**
 * Floor, before props: inside a chamber or a corridor, `m` pixels in from
 * its walls. The pool's water is not floor.
 */
export function spiritFloor(x: number, y: number, m = 0): boolean {
  const pu = (x - POOL.cx) / (POOL.rx + m);
  const pv = (y - POOL.cy) / (POOL.ry + m);
  if (pu * pu + pv * pv < 1) return false;
  if (inRect(HALL, x, y, m) || inRect(CRYPT, x, y, m) || inRect(OSSUARY, x, y, m)) return true;
  for (const c of CORRIDORS) if (inRect(c, x, y, m)) return true;
  const su = (x - SANCTUM.cx) / (SANCTUM.rx - m);
  const sv = (y - SANCTUM.cy) / (SANCTUM.ry - m);
  return su * su + sv * sv < 1;
}

export type PropKind = 'pillar' | 'tomb' | 'statue' | 'brazier' | 'candles' | 'bones';

export interface SpiritProp {
  kind: PropKind;
  x: number;
  y: number;
  /** Mirrored. */
  flip?: boolean;
}

/** Feet-blocking footprints (half-width, half-height) of the props that stand in the way. */
export const PROP_FOOT: Partial<Record<PropKind, [number, number]>> = { pillar: [8, 5], tomb: [13, 6], statue: [8, 5], brazier: [5, 3] };

/** Everything standing in the dungeon, by chamber. */
export const SPIRIT_PROPS: SpiritProp[] = [
  // Hall of Whispers: braziers either side of the way in, candles and old bones.
  { kind: 'brazier', x: 196, y: 1206 },
  { kind: 'brazier', x: 364, y: 1206 },
  { kind: 'candles', x: 186, y: 1330 },
  { kind: 'candles', x: 372, y: 1334, flip: true },
  { kind: 'bones', x: 214, y: 1288 },
  { kind: 'bones', x: 344, y: 1250, flip: true },
  // Crypt of the Forgotten: two rows of pillars, tombs between them.
  { kind: 'pillar', x: 170, y: 944 },
  { kind: 'pillar', x: 170, y: 1040 },
  { kind: 'pillar', x: 390, y: 944 },
  { kind: 'pillar', x: 390, y: 1040 },
  { kind: 'tomb', x: 216, y: 994 },
  { kind: 'tomb', x: 340, y: 994, flip: true },
  { kind: 'brazier', x: 132, y: 924 },
  { kind: 'brazier', x: 280, y: 924 },
  { kind: 'candles', x: 432, y: 1062, flip: true },
  { kind: 'bones', x: 140, y: 1060 },
  // The Ossuary: pillars round the pool, braziers on the walls.
  { kind: 'pillar', x: 150, y: 612 },
  { kind: 'pillar', x: 410, y: 612 },
  { kind: 'pillar', x: 150, y: 742 },
  { kind: 'pillar', x: 410, y: 742 },
  { kind: 'brazier', x: 212, y: 584 },
  { kind: 'brazier', x: 348, y: 584 },
  { kind: 'tomb', x: 108, y: 680 },
  { kind: 'tomb', x: 452, y: 680, flip: true },
  { kind: 'candles', x: 238, y: 716 },
  { kind: 'candles', x: 324, y: 628, flip: true },
  { kind: 'bones', x: 120, y: 760 },
  { kind: 'bones', x: 460, y: 588, flip: true },
  // The approach: mourning statues watch the way to the Sanctum.
  { kind: 'statue', x: 256, y: 470 },
  { kind: 'statue', x: 304, y: 470, flip: true },
  { kind: 'statue', x: 256, y: 530 },
  { kind: 'statue', x: 304, y: 530, flip: true },
  // The Sanctum: braziers ring the ritual circle.
  { kind: 'brazier', x: 144, y: 176 },
  { kind: 'brazier', x: 416, y: 176 },
  { kind: 'brazier', x: 118, y: 318 },
  { kind: 'brazier', x: 442, y: 318 },
  { kind: 'pillar', x: 196, y: 128 },
  { kind: 'pillar', x: 364, y: 128 },
  { kind: 'candles', x: 226, y: 392 },
  { kind: 'candles', x: 334, y: 392, flip: true },
  { kind: 'bones', x: 176, y: 380 },
  { kind: 'bones', x: 392, y: 226, flip: true },
];

/** Can feet stand here? On the floor, a little in from the walls, and not in a prop. */
export function spiritWalkable(x: number, y: number): boolean {
  // Feet may come right up to a north wall's face, but not into the side walls.
  if (!spiritFloor(x, y + 1, 5) || !spiritFloor(x, y - 2, 2)) return false;
  for (const p of SPIRIT_PROPS) {
    const f = PROP_FOOT[p.kind];
    if (!f) continue;
    const dx = (x - p.x) / f[0];
    const dy = (y - p.y) / f[1];
    if (dx * dx + dy * dy < 1) return false;
  }
  return true;
}

// Deeper chambers hold more spirits, of darker kinds. A fallen spirit rises
// again a second later, wherever the hero stands, but each spot only has a
// few returns in it, so every chamber can be cleared for good.
const RETURN = 1000;
const HALL_LIVES = 1;
const CRYPT_LIVES = 2;
const OSSUARY_LIVES = 2;
const APPROACH_LIVES = 1;
/** The Hollow Queen returns long after she falls, and never on top of the hero. */
export const QUEEN_RESPAWN = 45000;

const spot = (kind: SpawnSpot['kind'], x: number, y: number, lives: number): SpawnSpot => ({ kind, x, y, respawn: RETURN, lives, keepAway: 0 });

export const SPIRIT_SPAWNS: SpawnSpot[] = [
  // Hall of Whispers: a few lost wisps.
  spot('wisp', 230, 1236, HALL_LIVES),
  spot('wisp', 332, 1284, HALL_LIVES),
  spot('wisp', 280, 1212, HALL_LIVES),
  // Crypt: wisps and the first shades.
  spot('wisp', 150, 990, CRYPT_LIVES),
  spot('wisp', 410, 990, CRYPT_LIVES),
  spot('wisp', 280, 1054, CRYPT_LIVES),
  spot('shade', 280, 960, CRYPT_LIVES),
  spot('shade', 270, 1020, CRYPT_LIVES),
  // Ossuary: shades and wailing banshees round the pool.
  spot('shade', 180, 676, OSSUARY_LIVES),
  spot('shade', 380, 676, OSSUARY_LIVES),
  spot('shade', 280, 740, OSSUARY_LIVES),
  spot('banshee', 200, 600, OSSUARY_LIVES),
  spot('banshee', 360, 600, OSSUARY_LIVES),
  spot('wisp', 120, 620, OSSUARY_LIVES),
  spot('wisp', 440, 740, OSSUARY_LIVES),
  // The approach: banshees keep the stair, shades at their side.
  spot('banshee', 280, 452, APPROACH_LIVES),
  spot('shade', 280, 510, APPROACH_LIVES),
  // The Sanctum.
  { kind: 'queen', x: QUEEN_HOME.x, y: QUEEN_HOME.y, respawn: QUEEN_RESPAWN },
];
