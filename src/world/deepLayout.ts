// The Glimmerdeep's shape: a great cave system lit only by what grows in it,
// laid out the way real caves wind rather than as rooms and corridors.
// Thirteen caverns of ragged, organic outline are joined by curving passages
// that swell and pinch, and one long route snakes through them all:
//
//   the Lantern Descent, where heroes arrive by an old explorers' stair
//   -> the Glowcap Forest of giant glowing mushrooms (the Rootdeep lies
//      below it, and a side grotto, the Moonwell, holds a luminous pool)
//   -> the Shimmering Crossing, where an underground river is bridged twice
//   -> the Sporemother's Hollow, where the Legend waits in a fairy ring
//      (the Starry Grotto, a pool under glowworms, opens off it)
//   -> the Amethyst Galleries (a geode nook off to the side)
//   -> the Abyssal Rim, a ledge round a bottomless chasm, and the explorers'
//      last camp beyond it
//   -> the Wyrm's Throat, a winding climb through a hall of shards
//   -> the Geode Heart, the Myth Amethrax's lair at the very end.
//
// Everything is a pure function of world coordinates: `deepDepth` says how
// far a point lies inside the cave (negative in the rock), which the art
// (art/deep.ts), the walkable test and the monsters all share.

import { fbm } from '../art/spirit';
import { valueNoise } from '../art/env';
import type { SpawnSpot } from '../game/monsters';

export const DEEP_W = 1500;
export const DEEP_H = 1640;
/** How tall the rock faces of the north walls stand, in pixels. */
export const DEEP_WALL_H = 30;

export type Zone = 'lantern' | 'forest' | 'well' | 'river' | 'hollow' | 'crystal' | 'abyss' | 'throat' | 'heart';
export const ZONES: Zone[] = ['lantern', 'forest', 'well', 'river', 'hollow', 'crystal', 'abyss', 'throat', 'heart'];

type Pt = [number, number];

export interface Cavern {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  zone: Zone;
  /** How ragged its outline is: 0 a clean oval, 0.3 deeply lobed. */
  wob: number;
}

interface Passage {
  a: Pt;
  c: Pt;
  b: Pt;
  /** Half-widths at each end; it swells and pinches in between. */
  w0: number;
  w1: number;
  from: Zone;
  to: Zone;
}

const cav = (cx: number, cy: number, rx: number, ry: number, zone: Zone, wob = 0.22): Cavern => ({ cx, cy, rx, ry, zone, wob });

export const LANTERN = cav(236, 1444, 182, 122, 'lantern', 0.18);
export const FOREST = cav(600, 1230, 248, 172, 'forest', 0.24);
export const MOONWELL = cav(395, 1030, 112, 80, 'well', 0.2);
export const CROSSING = cav(1080, 1330, 224, 138, 'river', 0.2);
export const HOLLOW = cav(1230, 1000, 198, 154, 'hollow', 0.1);
export const GALLERY = cav(800, 800, 246, 160, 'crystal', 0.24);
export const NOOK = cav(1000, 612, 92, 66, 'crystal', 0.2);
export const ABYSS = cav(330, 612, 222, 168, 'abyss', 0.18);
export const SHARDS = cav(620, 222, 150, 96, 'throat', 0.22);
export const HEART = cav(1130, 300, 250, 180, 'heart', 0.08);
export const GROTTO = cav(1372, 690, 118, 108, 'well', 0.2);
export const CAMP = cav(175, 262, 125, 98, 'lantern', 0.2);
export const ROOTS = cav(650, 1500, 160, 70, 'forest', 0.22);

export const CAVERNS: Cavern[] = [LANTERN, FOREST, MOONWELL, ROOTS, CROSSING, HOLLOW, GROTTO, GALLERY, NOOK, ABYSS, CAMP, SHARDS, HEART];

const pass = (a: Pt, c: Pt, b: Pt, w0: number, w1: number, from: Zone, to: Zone): Passage => ({ a, c, b, w0, w1, from, to });

const PASSAGES: Passage[] = [
  pass([330, 1402], [400, 1330], [480, 1290], 34, 38, 'lantern', 'forest'),
  pass([470, 1150], [436, 1106], [418, 1060], 27, 25, 'forest', 'well'),
  pass([790, 1252], [850, 1300], [912, 1302], 36, 36, 'forest', 'river'),
  pass([1180, 1256], [1236, 1196], [1222, 1116], 36, 40, 'river', 'hollow'),
  pass([1064, 984], [990, 904], [956, 832], 38, 34, 'hollow', 'crystal'),
  pass([930, 722], [982, 684], [990, 640], 25, 24, 'crystal', 'crystal'),
  pass([604, 800], [556, 760], [506, 692], 36, 34, 'crystal', 'abyss'),
  pass([330, 462], [336, 330], [500, 252], 32, 30, 'abyss', 'throat'),
  pass([740, 240], [822, 322], [912, 300], 34, 40, 'throat', 'heart'),
  pass([640, 1376], [650, 1420], [656, 1462], 30, 30, 'forest', 'forest'),
  pass([1300, 896], [1332, 850], [1352, 786], 28, 28, 'hollow', 'well'),
  pass([346, 362], [292, 332], [246, 302], 28, 26, 'throat', 'lantern'),
];

/**
 * Rock columns left standing inside the caverns: the cave goes round them.
 * Each is a rough disc of rock `r` across.
 */
const COLUMNS: { cx: number; cy: number; r: number }[] = [
  { cx: 560, cy: 1180, r: 26 },
  { cx: 720, cy: 1300, r: 22 },
  { cx: 820, cy: 760, r: 28 },
  { cx: 660, cy: 870, r: 20 },
  { cx: 1340, cy: 1330, r: 20 },
  { cx: 150, cy: 1400, r: 18 },
  { cx: 600, cy: 250, r: 20 },
];

/**
 * Openings in the cave's roof, where daylight falls in: over the way in, the
 * Glowcap Forest, the Moonwell's pool, the river crossing, the crystal
 * gallery and the old camp. Never over the bosses' chambers, which keep
 * their own light. `slant` tilts the shafts (radians, toward the east when
 * positive); `size` scales the pool and the shafts.
 */
export const SKYLIGHTS: { x: number; y: number; size: number; slant: number; look: number }[] = [
  { x: 250, y: 1440, size: 0.85, slant: 0.1, look: 0 },
  { x: 590, y: 1250, size: 1.1, slant: -0.12, look: 1 },
  { x: 400, y: 1026, size: 0.9, slant: 0.08, look: 0 },
  { x: 1060, y: 1300, size: 1, slant: -0.08, look: 1 },
  { x: 760, y: 830, size: 1.05, slant: 0.12, look: 0 },
  { x: 190, y: 270, size: 0.8, slant: -0.1, look: 1 },
];

/** Liquids nobody can walk on: the underground river, the Moonwell's pool, and the chasm. */
export type Liquid = 'water' | 'chasm';

/** The river's course, north-east to south, through the Shimmering Crossing. */
export const RIVER: Pt[] = [
  [1170, 1120],
  [1112, 1236],
  [1072, 1330],
  [1050, 1412],
  [1006, 1530],
];
export const RIVER_HW = 17;
/** The Moonwell's luminous pool. */
export const WELL_POOL = { cx: 392, cy: 1030, rx: 52, ry: 27 };
/** The Starry Grotto's pool, under its glowworms. */
export const GROTTO_POOL = { cx: 1380, cy: 704, rx: 56, ry: 30 };
/** The bottomless chasm the Abyssal Rim runs round. */
export const CHASM = { cx: 330, cy: 606, rx: 112, ry: 72 };

/** Natural stone bridges over the river: from, to, half-width. */
export const BRIDGES: { a: Pt; b: Pt; hw: number }[] = [
  { a: [1010, 1316], b: [1134, 1344], hw: 12 },
  { a: [986, 1400], b: [1110, 1428], hw: 11 },
];

/** Where heroes arrive: the foot of the explorers' stair in the Lantern Descent. */
export const DEEP_SPAWN = { x: 214, y: 1500 };

/** The Sporemother's place, in the middle of her fairy ring. */
export const SPOREMOTHER_HOME = { x: HOLLOW.cx, y: HOLLOW.cy + 6 };
/** Amethrax's place, over the great geode at the Heart. */
export const WYRM_HOME = { x: HEART.cx, y: HEART.cy + 14 };

// ---------------------------------------------------------------- Geometry

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Distance from (x, y) to the segment a-b, and how far along it the nearest point is. */
function toSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): { d: number; t: number } {
  const vx = bx - ax;
  const vy = by - ay;
  const t = clamp01(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1));
  return { d: Math.hypot(x - ax - vx * t, y - ay - vy * t), t };
}

function quad(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

/** Each passage, as a chain of short straight pieces with a half-width at each joint. */
const PIECES = PASSAGES.map((p, k) => {
  const n = 12;
  const pts: { x: number; y: number; w: number; t: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [x, y] = quad(p.a, p.c, p.b, t);
    // It swells and pinches along its length, like a real cave passage.
    const w = (p.w0 + (p.w1 - p.w0) * t) * (1 + 0.16 * Math.sin(t * Math.PI * 3 + k * 1.7) * Math.sin(t * Math.PI));
    pts.push({ x, y, w, t });
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of pts) {
    x0 = Math.min(x0, q.x - q.w);
    y0 = Math.min(y0, q.y - q.w);
    x1 = Math.max(x1, q.x + q.w);
    y1 = Math.max(y1, q.y + q.w);
  }
  return { p, pts, box: { x0: x0 - 30, y0: y0 - 30, x1: x1 + 30, y1: y1 + 30 } };
});

/** How far inside cavern `c` the point lies, in px (negative outside), before the shared edge noise. */
function cavernDepth(c: Cavern, x: number, y: number): number {
  const dx = x - c.cx;
  const dy = y - c.cy;
  if (Math.abs(dx) > c.rx * 1.4 + 30 || Math.abs(dy) > c.ry * 1.4 + 30) return -99;
  const u = dx / c.rx;
  const v = dy / c.ry;
  const r = Math.hypot(u, v);
  const lobes = 1 + c.wob * (valueNoise(x, y, 70, 911 + c.cx) - 0.5) * 2;
  if (r < 1e-3) return Math.min(c.rx, c.ry) * lobes;
  // Along the ray from the centre, the wall stands at |p| / r; lobes push it in and out.
  const p = Math.hypot(dx, dy);
  return (p / r) * lobes - p;
}

/** How far inside passage `i` the point lies, and how far along it (0..1). */
function passageDepth(i: number, x: number, y: number): { d: number; t: number } {
  const { pts, box } = PIECES[i];
  if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1) return { d: -99, t: 0 };
  let best = -99;
  let bt = 0;
  for (let j = 1; j < pts.length; j++) {
    const q0 = pts[j - 1];
    const q1 = pts[j];
    const s = toSegment(x, y, q0.x, q0.y, q1.x, q1.y);
    const pd = q0.w + (q1.w - q0.w) * s.t - s.d;
    if (pd > best) {
      best = pd;
      bt = q0.t + (q1.t - q0.t) * s.t;
    }
  }
  return { d: best, t: bt };
}

/** The deepest any cavern or passage reaches at (x, y), before the shared edge noise. */
function shapeDepth(x: number, y: number): number {
  let d = -99;
  for (const c of CAVERNS) d = Math.max(d, cavernDepth(c, x, y));
  for (let i = 0; i < PIECES.length; i++) d = Math.max(d, passageDepth(i, x, y).d);
  return d;
}

/** The ragged edge every wall shares: big bays and small bites. */
function edgeNoise(x: number, y: number): number {
  return (fbm(x, y, 30, 991, 2) - 0.5) * 26 + (valueNoise(x, y, 7, 997) - 0.5) * 6;
}

/**
 * How far inside the cave (x, y) lies, in px: positive on the cave floor
 * (and over its liquids), negative in the rock. Rock columns count as rock.
 */
export function deepDepth(x: number, y: number): number {
  let d = shapeDepth(x, y) + edgeNoise(x, y);
  for (const c of COLUMNS) {
    const dx = x - c.cx;
    const dy = (y - c.cy) * 1.25;
    if (Math.abs(dx) > c.r + 30 || Math.abs(dy) > c.r + 30) continue;
    const cd = Math.hypot(dx, dy) - c.r * (1 + (valueNoise(x, y, 11, 1013) - 0.5) * 0.4);
    d = Math.min(d, cd);
  }
  return d;
}

/**
 * Which part of the cave (x, y) belongs to, for its look: the deepest shape's,
 * where zones meet along a ragged seam rather than a straight line.
 */
export function deepZone(x: number, y: number): Zone {
  let zone: Zone = 'lantern';
  let score = -999;
  for (let i = 0; i < CAVERNS.length; i++) {
    const cd = cavernDepth(CAVERNS[i], x, y);
    if (cd < -14) continue;
    const s = cd + (valueNoise(x, y, 26, 931 + i) - 0.5) * 36;
    if (s > score) {
      score = s;
      zone = CAVERNS[i].zone;
    }
  }
  for (let i = 0; i < PIECES.length; i++) {
    const q = passageDepth(i, x, y);
    if (q.d < -14) continue;
    const s = q.d + (valueNoise(x, y, 26, 951 + i) - 0.5) * 36;
    if (s > score) {
      score = s;
      const p = PIECES[i].p;
      zone = q.t + (valueNoise(x, y, 18, 971 + i) - 0.5) * 0.5 < 0.5 ? p.from : p.to;
    }
  }
  return zone;
}

/** How far inside a liquid (x, y) lies (negative outside), and which liquid is nearest. */
export function deepWet(x: number, y: number): { d: number; kind: Liquid } {
  let d = -99;
  let kind: Liquid = 'water';
  // The river: a band along its course, wavering.
  if (x > 940 && x < 1230 && y > 1060 && y < DEEP_H) {
    let best = -99;
    for (let j = 1; j < RIVER.length; j++) {
      const s = toSegment(x, y, RIVER[j - 1][0], RIVER[j - 1][1], RIVER[j][0], RIVER[j][1]);
      best = Math.max(best, RIVER_HW - s.d);
    }
    d = best + (valueNoise(x, y, 16, 1021) - 0.5) * 8;
  }
  const pool = (o: { cx: number; cy: number; rx: number; ry: number }, wob: number, seed: number) => {
    const dx = x - o.cx;
    const dy = y - o.cy;
    if (Math.abs(dx) > o.rx + 30 || Math.abs(dy) > o.ry + 30) return -99;
    const u = dx / o.rx;
    const v = dy / o.ry;
    const r = Math.hypot(u, v);
    const lobes = 1 + wob * (valueNoise(x, y, 22, seed) - 0.5) * 2;
    if (r < 1e-3) return Math.min(o.rx, o.ry);
    const p = Math.hypot(dx, dy);
    return (p / r) * lobes - p;
  };
  const w = Math.max(pool(WELL_POOL, 0.12, 1031), pool(GROTTO_POOL, 0.14, 1035));
  if (w > d) d = w;
  const c = pool(CHASM, 0.2, 1033);
  if (c > d) {
    d = c;
    kind = 'chasm';
  }
  return { d, kind };
}

/** How far inside a bridge's deck (x, y) lies (negative off it). */
export function onBridge(x: number, y: number): number {
  let d = -99;
  for (const b of BRIDGES) {
    const s = toSegment(x, y, b.a[0], b.a[1], b.b[0], b.b[1]);
    d = Math.max(d, b.hw - s.d);
  }
  return d;
}

/** Floor to stand on (before props): in the cave, and out of the water and the chasm unless on a bridge. */
export function deepFloor(x: number, y: number, m = 0): boolean {
  if (deepDepth(x, y) <= m) return false;
  if (onBridge(x, y) > m) return true;
  return deepWet(x, y).d < -m;
}

// ---------------------------------------------------------------- Props

export type DeepPropKind = 'shroom' | 'stalag' | 'crystal' | 'spire' | 'lantern' | 'caps';

export interface DeepProp {
  kind: DeepPropKind;
  x: number;
  y: number;
  /** Which look: a mushroom's cap colour, a stalagmite's shape. */
  v: number;
  flip?: boolean;
}

/** Feet-blocking footprints (half-width, half-height) of the props that stand in the way. */
export const DEEP_FOOT: Partial<Record<DeepPropKind, [number, number]>> = { shroom: [6, 4], stalag: [7, 4], crystal: [8, 4], spire: [10, 5], lantern: [3, 2] };

const pr = (kind: DeepPropKind, x: number, y: number, v = 0, flip = false): DeepProp => ({ kind, x, y, v, flip });

/** Everything standing in the Glimmerdeep, cavern by cavern. */
export const DEEP_PROPS: DeepProp[] = [
  // The Lantern Descent: the explorers' lanterns light the way in.
  pr('lantern', 170, 1470),
  pr('lantern', 272, 1474),
  pr('lantern', 318, 1370),
  pr('lantern', 120, 1360),
  pr('stalag', 90, 1450, 0),
  pr('stalag', 360, 1500, 1, true),
  pr('stalag', 250, 1348, 1),
  pr('caps', 132, 1500, 0),
  pr('caps', 344, 1440, 1),
  pr('shroom', 390, 1380, 0),
  // The Glowcap Forest: giant mushrooms, cyan and magenta.
  pr('shroom', 450, 1200, 0),
  pr('shroom', 520, 1300, 1, true),
  pr('shroom', 640, 1150, 0, true),
  pr('shroom', 700, 1230, 1),
  pr('shroom', 470, 1110, 1),
  pr('shroom', 760, 1150, 0),
  pr('shroom', 610, 1360, 0),
  pr('shroom', 780, 1330, 1, true),
  pr('shroom', 420, 1290, 0, true),
  pr('caps', 540, 1240, 0),
  pr('caps', 660, 1280, 1),
  pr('caps', 590, 1110, 1),
  pr('caps', 650, 1240, 0),
  pr('caps', 500, 1350, 1),
  pr('stalag', 812, 1210, 1, true),
  // The Moonwell: a mushroom leaning over the pool.
  pr('shroom', 330, 990, 1),
  pr('shroom', 468, 1004, 0, true),
  pr('caps', 350, 1064, 0),
  pr('caps', 450, 1066, 1),
  pr('crystal', 400, 972, 0),
  // The Rootdeep, south of the forest: old roots and mushrooms in the dark.
  pr('shroom', 540, 1490, 1),
  pr('shroom', 760, 1500, 0, true),
  pr('stalag', 650, 1540, 0),
  pr('caps', 600, 1460, 0),
  pr('caps', 710, 1530, 1),
  // The Shimmering Crossing: stalagmites along the banks, a lantern at each bridge.
  pr('lantern', 994, 1296),
  pr('lantern', 1150, 1360),
  pr('stalag', 955, 1262, 0),
  pr('stalag', 940, 1420, 1),
  pr('stalag', 1230, 1300, 0, true),
  pr('stalag', 1190, 1420, 1),
  pr('caps', 960, 1350, 0),
  pr('caps', 1180, 1310, 1),
  pr('shroom', 1260, 1380, 0, true),
  // The Sporemother's Hollow: her giant mushrooms round the edge, a ring of caps.
  pr('shroom', 1100, 920, 1),
  pr('shroom', 1360, 920, 1, true),
  pr('shroom', 1120, 1070, 0),
  pr('shroom', 1370, 1080, 0, true),
  pr('shroom', 1232, 872, 1),
  // The Starry Grotto: a still pool under the glowworms.
  pr('stalag', 1300, 640, 1),
  pr('stalag', 1450, 730, 0, true),
  pr('crystal', 1420, 640, 0, true),
  pr('shroom', 1320, 760, 0),
  pr('caps', 1440, 770, 1),
  pr('caps', 1340, 620, 0),
  // The Amethyst Galleries: crystal clusters and stalagmites.
  pr('crystal', 660, 740, 0),
  pr('crystal', 900, 870, 1, true),
  pr('crystal', 740, 900, 1),
  pr('crystal', 960, 780, 0, true),
  pr('crystal', 620, 820, 1),
  pr('crystal', 870, 690, 0),
  pr('stalag', 720, 712, 1),
  pr('stalag', 980, 860, 0, true),
  pr('stalag', 760, 830, 0),
  // The geode nook.
  pr('crystal', 960, 600, 1),
  pr('crystal', 1040, 596, 0, true),
  pr('spire', 1000, 580, 0),
  // The Abyssal Rim: stalagmites and crystals on the lip.
  pr('stalag', 170, 580, 0),
  pr('stalag', 490, 600, 1, true),
  pr('stalag', 300, 480, 1),
  pr('crystal', 200, 700, 0),
  pr('crystal', 460, 700, 1, true),
  pr('crystal', 250, 500, 1),
  pr('caps', 400, 486, 0),
  pr('caps', 180, 650, 1),
  // The explorers' last camp, off the climb: their lanterns still burn.
  pr('lantern', 130, 230),
  pr('lantern', 230, 300),
  pr('stalag', 100, 300, 1),
  pr('crystal', 210, 200, 0),
  pr('caps', 150, 320, 0),
  // The Wyrm's Throat: crystals growing larger as it climbs.
  pr('crystal', 390, 300, 1),
  pr('crystal', 540, 180, 0),
  pr('crystal', 680, 262, 1, true),
  pr('spire', 680, 170, 1),
  pr('crystal', 540, 270, 1),
  pr('stalag', 760, 190, 0, true),
  pr('crystal', 840, 290, 0),
  // The Geode Heart: great spires of amethyst ring the geode.
  pr('spire', 950, 250, 0),
  pr('spire', 1310, 250, 1, true),
  pr('spire', 1010, 170, 1),
  pr('spire', 1250, 170, 0, true),
  pr('spire', 1130, 150, 0),
  pr('spire', 960, 390, 1),
  pr('spire', 1300, 390, 0, true),
  pr('crystal', 1060, 440, 0),
  pr('crystal', 1200, 440, 1, true),
];

/** Can feet stand here? On the floor, a little in from the walls, off the water and not in a prop. */
export function deepWalkable(x: number, y: number): boolean {
  // Feet may come right up to a north wall's face, but not into the other walls.
  if (!deepFloor(x, y + 1, 5) || !deepFloor(x, y - 2, 2)) return false;
  for (const q of DEEP_PROPS) {
    const f = DEEP_FOOT[q.kind];
    if (!f) continue;
    const dx = (x - q.x) / f[0];
    const dy = (y - q.y) / f[1];
    if (dx * dx + dy * dy < 1) return false;
  }
  return true;
}

// ---------------------------------------------------------------- Monsters

// Every cavern holds its own creatures, more and tougher deeper in. A fallen
// creature returns a second later, but each spot only has a few returns in
// it, so every cavern can be cleared for good.
const RETURN = 1000;
/** The Sporemother regrows long after she falls; Amethrax takes longer still. */
export const SPOREMOTHER_RESPAWN = 45000;
export const WYRM_RESPAWN = 60000;

const spot = (kind: SpawnSpot['kind'], x: number, y: number, lives: number): SpawnSpot => ({ kind, x, y, respawn: RETURN, lives, keepAway: 0 });

export const DEEP_SPAWNS: SpawnSpot[] = [
  // The Lantern Descent: a few sporelings and a bat, to warm up.
  spot('sporeling', 260, 1410, 1),
  spot('sporeling', 330, 1420, 1),
  spot('glimbat', 200, 1380, 1),
  // The Glowcap Forest: sporelings everywhere, myconid shamans among the mushrooms.
  spot('sporeling', 500, 1250, 2),
  spot('sporeling', 560, 1330, 2),
  spot('sporeling', 680, 1190, 2),
  spot('sporeling', 660, 1330, 1),
  spot('sporeling', 460, 1330, 1),
  spot('myconid', 600, 1220, 2),
  spot('myconid', 740, 1260, 1),
  spot('myconid', 520, 1160, 1),
  spot('glimbat', 640, 1320, 2),
  spot('glimbat', 560, 1100, 1),
  // The Moonwell.
  spot('myconid', 400, 1080, 1),
  spot('sporeling', 350, 1010, 1),
  spot('sporeling', 450, 1030, 1),
  // The Shimmering Crossing: bats over the water, shardlings on the banks.
  spot('glimbat', 1020, 1250, 2),
  spot('glimbat', 1120, 1450, 2),
  spot('shardling', 950, 1300, 2),
  spot('shardling', 1190, 1350, 2),
  spot('myconid', 1200, 1280, 1),
  spot('sporeling', 940, 1380, 1),
  // The Rootdeep.
  spot('myconid', 650, 1500, 1),
  spot('sporeling', 580, 1510, 2),
  spot('sporeling', 720, 1480, 2),
  // The way up to the Hollow.
  spot('myconid', 1224, 1170, 1),
  // The Sporemother's Hollow.
  { kind: 'sporemother', x: SPOREMOTHER_HOME.x, y: SPOREMOTHER_HOME.y, respawn: SPOREMOTHER_RESPAWN },
  // The Starry Grotto.
  spot('glimbat', 1300, 700, 2),
  spot('glimbat', 1420, 660, 1),
  spot('myconid', 1380, 770, 1),
  spot('shardling', 1320, 820, 1),
  // The Amethyst Galleries: shardlings and the great geodebacks.
  spot('shardling', 700, 780, 2),
  spot('shardling', 860, 820, 2),
  spot('shardling', 780, 900, 2),
  spot('shardling', 920, 740, 1),
  spot('geodeback', 760, 740, 2),
  spot('geodeback', 900, 800, 1),
  spot('glimbat', 700, 840, 2),
  spot('glimbat', 980, 900, 1),
  // The geode nook.
  spot('geodeback', 1000, 630, 1),
  spot('shardling', 960, 650, 1),
  // The Abyssal Rim: bats rising off the chasm, shardlings on the ledge.
  spot('glimbat', 190, 610, 2),
  spot('glimbat', 470, 620, 2),
  spot('glimbat', 330, 500, 2),
  spot('glimbat', 330, 730, 2),
  spot('shardling', 230, 720, 2),
  spot('shardling', 430, 730, 1),
  spot('shardling', 220, 510, 1),
  spot('geodeback', 420, 520, 1),
  // The explorers' camp.
  spot('geodeback', 175, 262, 1),
  spot('shardling', 140, 280, 1),
  spot('glimbat', 200, 230, 1),
  // The Wyrm's Throat and its hall of shards.
  spot('shardling', 340, 360, 2),
  spot('glimbat', 420, 280, 1),
  spot('geodeback', 600, 200, 1),
  spot('shardling', 560, 250, 2),
  spot('shardling', 680, 240, 2),
  spot('glimbat', 640, 180, 2),
  spot('geodeback', 830, 300, 1),
  // The Geode Heart.
  { kind: 'wyrm', x: WYRM_HOME.x, y: WYRM_HOME.y, respawn: WYRM_RESPAWN },
];
