// The Sunken Garden: a walled courtyard of old ruins sunk among flowering
// vines, a pool with a fountain at its heart. Giant thornblooms have grown
// into its doorways and block the way until they are cut down; glowing blooms
// hold buffs (see world/Garden.ts). Everything here is a pure function of
// world coordinates, like the clearing (see art/ground.ts).

import { hash2, valueNoise, type GroundPalette } from '../art/env';
import { K, clamp, nightify, ramp, runeCircle, smoothstep, type Cell, type GroundSpec, type Look, type StripFields } from '../art/ground';
import { RUIN_H_STEP, RUIN_V_STEP, type BloomKind } from '../art/garden';
import type { SpawnSpot } from '../game/monsters';
import { ColliderGrid, edgeScenery, type SceneryLayout } from './common';

export const GARDEN_W = 640;
export const GARDEN_H = 720;

/** The pool, and the paved courtyard round it. */
export const POOL = { x: 320, y: 404, rx: 74, ry: 58 };
const COURT = { rx: POOL.rx + 38, ry: POOL.ry + 46 };

/** The ruin walls: east-west runs at a y, and north-south runs at an x. Gaps are doorways. */
const NORTH_WALL_Y = 252;
const SIDE_WALL = { y0: 292, y1: 532 };
const WEST_WALL_X = 198;
const EAST_WALL_X = 442;

/** Doorways, and whether a thornbloom grows in each. */
const NORTH_DOORS = [
  { x0: 160, x1: 192, thorn: false },
  { x0: 304, x1: 336, thorn: true },
  { x0: 448, x1: 480, thorn: false },
];
const SIDE_DOOR = { y0: 392, y1: 424 };

export const GARDEN_SPAWN = { x: 320, y: 650 };

// ---------------------------------------------------------------------------
// The roof: flowering vines and treetops closing in on every side.

const wobble = (x: number, y: number) => (valueNoise(x, y, 7, 41) - 0.5) * 10 + (valueNoise(x, y, 19, 43) - 0.5) * 14;

export function roofDepth(x: number, y: number): number {
  const d = Math.max(40 - x, x - (GARDEN_W - 40), 68 - y, y - (GARDEN_H - 30));
  return d + (valueNoise(x, y, 64, 7) - 0.5) * 26 + wobble(x, y);
}

// ---------------------------------------------------------------------------
// What stands in the garden.

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface GardenLayout {
  /** Chunks of east-west wall: centre x and base y. */
  hwalls: { x: number; y: number; v: number }[];
  /** Chunks of north-south wall: x and the base (south end) of each. */
  vwalls: { x: number; y: number; v: number }[];
  pillars: { x: number; y: number; v: number }[];
  /** Thornblooms, each with the doorway it blocks. */
  thorns: { x: number; y: number; door: Rect }[];
  blooms: { x: number; y: number; kind: BloomKind }[];
  crystals: { x: number; y: number; frame: string }[];
  fountain: { x: number; y: number };
  /** Walls as solid rectangles. */
  walls: Rect[];
}

let layout: GardenLayout | null = null;

export function gardenLayout(): GardenLayout {
  if (layout) return layout;
  const hwalls: GardenLayout['hwalls'] = [];
  const vwalls: GardenLayout['vwalls'] = [];
  const walls: Rect[] = [];
  const thorns: GardenLayout['thorns'] = [];

  // A run of east-west wall from x0 to x1, its base (front) at y.
  const hrun = (x0: number, x1: number, y: number) => {
    const n = Math.max(1, Math.round((x1 - x0) / RUIN_H_STEP));
    const step = (x1 - x0) / n;
    for (let i = 0; i < n; i++) hwalls.push({ x: Math.round(x0 + step * (i + 0.5)), y, v: Math.floor(hash2(i, y, 5) * 3) });
    walls.push({ x0, x1, y0: y - 9, y1: y });
  };
  // A run of north-south wall at x from y0 to y1 (the south end).
  const vrun = (x: number, y0: number, y1: number) => {
    const n = Math.max(1, Math.round((y1 - y0) / RUIN_V_STEP));
    const step = (y1 - y0) / n;
    for (let i = 1; i <= n; i++) vwalls.push({ x, y: Math.round(y0 + step * i), v: Math.floor(hash2(x, i, 9) * 3) });
    walls.push({ x0: x - 5, x1: x + 5, y0: y0 - 2, y1 });
  };

  // The north wall, from roof to roof, with its three doorways.
  let x = 20;
  for (const d of NORTH_DOORS) {
    hrun(x, d.x0, NORTH_WALL_Y);
    if (d.thorn) thorns.push({ x: (d.x0 + d.x1) / 2, y: NORTH_WALL_Y + 1, door: { x0: d.x0 - 2, x1: d.x1 + 2, y0: NORTH_WALL_Y - 11, y1: NORTH_WALL_Y + 2 } });
    x = d.x1;
  }
  hrun(x, GARDEN_W - 20, NORTH_WALL_Y);

  // The courtyard's east and west walls, each with a doorway choked by a thornbloom.
  for (const wx of [WEST_WALL_X, EAST_WALL_X]) {
    vrun(wx, SIDE_WALL.y0, SIDE_DOOR.y0);
    vrun(wx, SIDE_DOOR.y1, SIDE_WALL.y1);
    thorns.push({ x: wx, y: SIDE_DOOR.y1 - 2, door: { x0: wx - 9, x1: wx + 9, y0: SIDE_DOOR.y0 - 2, y1: SIDE_DOOR.y1 + 1 } });
  }

  const pillars = [
    // Capping the courtyard walls' ends.
    { x: WEST_WALL_X, y: SIDE_WALL.y0 - 4, v: 0 },
    { x: EAST_WALL_X, y: SIDE_WALL.y0 - 4, v: 0 },
    { x: WEST_WALL_X, y: SIDE_WALL.y1 + 7, v: 1 },
    { x: EAST_WALL_X, y: SIDE_WALL.y1 + 7, v: 0 },
    // Flanking the north wall's middle door.
    { x: 294, y: NORTH_WALL_Y + 8, v: 0 },
    { x: 346, y: NORTH_WALL_Y + 8, v: 1 },
    // The shrine on the north terrace.
    { x: 268, y: 152, v: 0 },
    { x: 372, y: 152, v: 0 },
    // Broken columns scattered through the beds.
    { x: 98, y: 160, v: 1 },
    { x: 548, y: 150, v: 2 },
    { x: 96, y: 430, v: 2 },
    { x: 556, y: 410, v: 1 },
    { x: 118, y: 622, v: 0 },
    { x: 530, y: 606, v: 2 },
    { x: 238, y: 606, v: 2 },
    { x: 404, y: 616, v: 1 },
  ];

  const blooms: GardenLayout['blooms'] = [
    { x: 196, y: 190, kind: 'might' },
    { x: 446, y: 186, kind: 'ward' },
    { x: 120, y: 340, kind: 'swift' },
    { x: 130, y: 486, kind: 'renew' },
    { x: 520, y: 336, kind: 'renew' },
    { x: 516, y: 488, kind: 'might' },
    { x: 172, y: 640, kind: 'ward' },
    { x: 476, y: 650, kind: 'swift' },
  ];

  layout = {
    hwalls,
    vwalls,
    pillars,
    thorns,
    blooms,
    crystals: [
      { x: 320, y: 146, frame: 'c1' },
      { x: 76, y: 268, frame: 'c0' },
      { x: 566, y: 560, frame: 'c0' },
    ],
    fountain: { x: POOL.x, y: POOL.y + 10 },
    walls,
  };
  return layout;
}

/** The garden's monsters: a guardian on the terrace, moths and frogs by the water, puffcaps in the beds. */
const SPAWNS: [SpawnSpot['kind'], number, number][] = [
  ['barkling', 320, 206],
  ['glowmoth', 232, 112],
  ['glowmoth', 410, 108],
  ['puffcap', 150, 120],
  ['puffcap', 168, 138],
  ['puffcap', 92, 380],
  ['puffcap', 112, 398],
  ['puffcap', 84, 404],
  ['frog', 160, 520],
  ['glowmoth', 548, 372],
  ['glowmoth', 506, 420],
  ['barkling', 560, 500],
  ['frog', 244, 476],
  ['frog', 398, 322],
  ['beetle', 142, 596],
  ['puffcap', 508, 612],
  ['puffcap', 528, 628],
];

// ---------------------------------------------------------------------------
// Undergrowth along the roof's edge, and what can be walked on.

let scenery: SceneryLayout | null = null;

const nearAny = (x: number, y: number, list: { x: number; y: number }[], r: number) => list.some((o) => Math.hypot(o.x - x, (o.y - y) * 1.3) < r);

export function gardenScenery(): SceneryLayout {
  if (scenery) return scenery;
  const g = gardenLayout();
  scenery = edgeScenery({
    w: GARDEN_W,
    h: GARDEN_H,
    seed: 77,
    roofDepth,
    trees: false,
    keepClear: (x, y) => nearAny(x, y, g.blooms, 24) || nearAny(x, y, g.pillars, 18) || nearAny(x, y, g.crystals, 22) || inWall(x, y, 8),
  });
  // Shafts of sun fall through the vines onto the stones.
  scenery.rays = [
    { x: 150, y: 118, seed: 5 },
    { x: 468, y: 300, seed: 23 },
    { x: 268, y: 566, seed: 51 },
    { x: 560, y: 640, seed: 88 },
    { x: 92, y: 520, seed: 13 },
  ];
  return scenery;
}

function inWall(x: number, y: number, pad = 0): boolean {
  for (const w of gardenLayout().walls) if (x > w.x0 - pad && x < w.x1 + pad && y > w.y0 - pad && y < w.y1 + pad) return true;
  return false;
}

let grid: ColliderGrid | null = null;

/** Can feet stand at (x, y)? The roof, the pool, walls, columns and the scenery say no. Thornblooms and blooms are the Garden's to add. */
export function gardenWalkable(x: number, y: number): boolean {
  if (x < 8 || y < 10 || x > GARDEN_W - 8 || y > GARDEN_H - 12) return false;
  if (roofDepth(x, y) > -9) return false;
  const px = (x - POOL.x) / (POOL.rx + 3);
  const py = (y - POOL.y) / (POOL.ry + 3);
  if (px * px + py * py < 1) return false;
  if (inWall(x, y)) return false;
  if (!grid) {
    const g = gardenLayout();
    grid = new ColliderGrid([
      ...gardenScenery().colliders,
      ...g.pillars.map((p) => ({ x: p.x, y: p.y - 2, rx: 8, ry: 4 })),
      ...g.crystals.map((c) => ({ x: c.x, y: c.y - 1, rx: 7, ry: 3 })),
    ]);
  }
  return !grid.hits(x, y);
}

/** Spawn spots, nudged onto walkable ground. */
export const GARDEN_SPAWNS: SpawnSpot[] = SPAWNS.map(([kind, x, y]) => {
  for (let r = 0; r < 40; r += 2) {
    for (const [dx, dy] of [
      [0, r],
      [r, 0],
      [-r, 0],
      [0, -r],
    ]) {
      if (gardenWalkable(x + dx, y + dy)) return { kind, x: x + dx, y: y + dy };
    }
  }
  return { kind, x, y };
});

// ---------------------------------------------------------------------------
// The ground.

const GARDEN_DAY_GROUND: GroundPalette = {
  grass: ramp('#1a422e', '#235836', '#306e40', '#448648', '#62a054', '#88bc66'),
  stone: ramp('#433b38', '#5b5049', '#75685c', '#908270', '#ac9d86', '#c8b99e'),
  grout: ramp('#252624', '#2a3a28', '#35522e'),
  dirt: ramp('#453629', '#5b4734', '#735c42', '#8a7150'),
  flowers: ramp('#fff4f8', '#ffc4de', '#f68ab8', '#d8b4ff'),
  edgeDark: 1.2,
};

const GARDEN_NIGHT_GROUND: GroundPalette = {
  grass: GARDEN_DAY_GROUND.grass.map(nightify),
  stone: GARDEN_DAY_GROUND.stone.map(nightify),
  grout: GARDEN_DAY_GROUND.grout.map(nightify),
  dirt: GARDEN_DAY_GROUND.dirt.map(nightify),
  flowers: ramp('#6a6a90', '#7a5a86', '#5a4a78', '#6a5a90'),
  edgeDark: 2.2,
};

const DAY_LOOK: Look = {
  ground: GARDEN_DAY_GROUND,
  moss: ramp('#142e1e', '#1c4026', '#26522e', '#346836', '#487e40', '#62984c', '#84b25e'),
  litter: ramp('#3a2a20', '#5a3e28', '#7a5430', '#9a6c3a', '#bc8a4a', '#8c3a4a'),
  path: ramp('#3e2e22', '#55402d', '#6e553a', '#876c4a', '#a1865d', '#baa072', '#cfb788'),
  bark: ramp('#1f140e', '#352318', '#4f3524', '#6b4a32'),
  roof: [
    // Ivy, wisteria, blossom and jasmine.
    ramp('#0b2218', '#113020', '#194028', '#225230', '#2f6639', '#417d44', '#5a954f', '#7aae5c'),
    ramp('#1c1430', '#291e46', '#392a5e', '#4c3878', '#634894', '#7e5eae', '#9e7cc8', '#c2a2e0'),
    ramp('#2a1222', '#401a30', '#5a2442', '#763256', '#94446a', '#b45c82', '#d07c9a', '#eaa4bc'),
    ramp('#222c26', '#344238', '#4a584c', '#647264', '#828f80', '#a4b09c', '#c6d0ba', '#e8eedc'),
  ],
  bloom: ramp('#b89cff', '#fff4f8', '#ffc4de', '#f68ab8', '#9ad8ff'),
  shroom: [200, 255, 240],
  stem: [232, 226, 204],
  cast: [14, 16],
  shadow: 1.8,
  pool: 2.2,
  wallDark: 1.2,
  water: ramp('#0a1e2a', '#0e2c38', '#133a46', '#1a4c56', '#24626a', '#347c80', '#50a09c', '#86c8bc'),
  tile: ramp('#3e3632', '#534941', '#6c6053', '#867866', '#a0927c', '#bcad93', '#d6c9ae'),
  petal: ramp('#ffd0e4', '#ff9ec8', '#fff4fa', '#e2b4ff'),
  pad: ramp('#113220', '#19462a', '#235c34', '#317442', '#468e50', '#62a860'),
  lotus: ramp('#ff9ec8', '#fff0f6'),
};

const NIGHT_LOOK: Look = {
  ...DAY_LOOK,
  ground: GARDEN_NIGHT_GROUND,
  moss: DAY_LOOK.moss.map(nightify),
  litter: DAY_LOOK.litter.map(nightify),
  bark: DAY_LOOK.bark.map(nightify),
  roof: DAY_LOOK.roof.map((r) => r.map(nightify)),
  bloom: ramp('#5a4a94', '#8a8ab8', '#7a5a86', '#6a4a78', '#5a7aa0'),
  cast: [-12, 14],
  shadow: 0.9,
  pool: 0.9,
  wallDark: 1.7,
  water: DAY_LOOK.water!.map(nightify),
  tile: DAY_LOOK.tile!.map(nightify),
  petal: ramp('#8a6a90', '#7a5a86', '#9a9ab8', '#6a5a90'),
  pad: DAY_LOOK.pad!.map(nightify),
  lotus: ramp('#ff9ec8', '#fff0f6'),
};

/** Distance outside the pool's edge, roughly in pixels (negative in the water), and the normalised offset. */
function poolEdge(x: number, y: number): { d: number; q: number; qx: number; qy: number } {
  const qx = (x + 0.5 - POOL.x) / POOL.rx;
  const qy = (y + 0.5 - POOL.y) / POOL.ry;
  const q = Math.sqrt(qx * qx + qy * qy);
  return { d: (q - 1) * (POOL.rx + POOL.ry) * 0.5, q, qx, qy };
}

const TILE = 11;
const bloomsNear = (x: number, y: number, r: number) => gardenLayout().blooms.some((b) => Math.abs(b.x - x) < r && Math.abs(b.y - 4 - y) < r * 0.7);

function floor(x: number, y: number, wall: number, c: Cell): void {
  const { d, q, qx, qy } = poolEdge(x, y);
  if (d < 0) {
    // Water: dark in the middle, lighter over the shallows, ripples catching the light.
    c.kind = K.Water;
    let t = -0.3 - (1 - q) * 1.5;
    if (valueNoise(x * 0.5, y * 2.3, 5, 91) > 0.74) t += 1.3;
    if (hash2(x, y, 93) > 0.994) t += 2.4;
    if (q > 0.9 && qy < 0) t -= 1.3; // in the rim's shadow
    c.tone = t;
    // Lily pads, some with a lotus.
    const gx = Math.floor(x / 15);
    const gy = Math.floor(y / 15);
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const cx = gx + ox;
        const cy = gy + oy;
        if (hash2(cx, cy, 71) > 0.42) continue;
        const px = (cx + 0.2 + hash2(cx, cy, 72) * 0.6) * 15;
        const py = (cy + 0.2 + hash2(cx, cy, 73) * 0.6) * 15;
        const pe = poolEdge(px, py);
        if (pe.q > 0.8 || Math.hypot(px - POOL.x, (py - POOL.y) * 1.3) < 34) continue;
        const r = 3 + hash2(cx, cy, 74) * 2.2;
        const dx = x + 0.5 - px;
        const dy = (y + 0.5 - py) * 1.5;
        const dd = Math.hypot(dx, dy);
        if (dd > r) continue;
        // A notch cut into each pad.
        const a = Math.atan2(dy, dx) - hash2(cx, cy, 75) * Math.PI * 2;
        if (dd > 1 && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.35) continue;
        if (hash2(cx, cy, 76) < 0.34 && dd < 1.6) {
          c.kind = K.Lotus;
          c.sub = dy < 0 ? 1 : 0;
          c.height = 1.2;
          return;
        }
        c.kind = K.Pad;
        c.height = 0.5 + (1 - dd / r) * 0.3;
        c.tone = (hash2(cx, cy, 77) - 0.5) * 0.8 + (dd < r - 1 ? 0 : -0.8);
        return;
      }
    }
    return;
  }
  if (d < 5) {
    // The pool's rim: dressed coping stones round the water.
    const a = Math.atan2(qy, qx);
    const seg = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 38);
    const f = (((a + Math.PI) / (Math.PI * 2)) * 38) % 1;
    if (f < 0.06) {
      c.kind = K.Grout;
      c.tone = 1;
      return;
    }
    c.kind = K.Stone;
    c.height = 1 - Math.abs(d - 2.5) / 3.5;
    c.tone = (hash2(seg, 0, 81) - 0.5) * 0.8 + 0.6;
    return;
  }

  // Rubble along the foot of the walls.
  if (inWall(x, y, 3) && hash2(x, y, 85) > 0.55) {
    c.kind = K.Pebble;
    c.height = 0.8;
    c.tone = (hash2(x, y, 86) - 0.5) * 1.4;
    return;
  }

  // Paving: the courtyard round the pool, and avenues out to the walls.
  const cq = Math.hypot((x - POOL.x) / COURT.rx, (y - POOL.y) / COURT.ry) + (valueNoise(x, y, 10, 87) - 0.5) * 0.14;
  const avenue = Math.abs(x - POOL.x) < 20 + (valueNoise(x, y, 8, 88) - 0.5) * 6 && y > 150 && y < 700;
  const overgrown = valueNoise(x, y, 22, 89);
  const paved = cq < 1 || (avenue && overgrown < 0.7) || (valueNoise(x, y, 38, 90) > 0.72 && overgrown < 0.6);
  if (paved) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    const lx = x - tx * TILE;
    const ly = y - ty * TILE;
    const missing = hash2(tx, ty, 91) < 0.07 + (cq > 0.85 ? (cq - 0.85) * 1.2 : 0) + (cq < 1 ? 0 : overgrown * 0.3);
    if (!missing) {
      if (lx === 0 || ly === 0) {
        c.kind = K.Grout;
        c.tone = overgrown > 0.45 ? 2 : overgrown > 0.3 ? 1 : 0;
        return;
      }
      c.kind = K.Tile;
      // A ring of darker and lighter tiles round the rim, like an old mosaic.
      const ring = d > 8 && d < 20 ? ((tx + ty) & 1 ? 0.7 : -0.6) : 0;
      const crack = hash2(tx, ty, 92) < 0.12 && Math.abs(lx - ly + Math.floor(hash2(tx, ty, 94) * 4) - 2) < 0.6;
      c.tone = (hash2(tx, ty, 95) - 0.5) * 0.9 + ring + (crack ? -1.6 : 0) + (valueNoise(x, y, 5, 96) - 0.5) * 0.4;
      c.height = crack ? 0.3 : lx === 1 || ly === 1 ? 0.55 : 0.7;
      return;
    }
  }

  // Lawn, moss creeping in, and fallen petals, thickest under the blooms.
  if (hash2(x, y, 97) > (bloomsNear(x, y, 20) ? 0.9 : 0.996)) {
    c.kind = K.Petal;
    c.sub = Math.floor(hash2(x, y, 98) * 4);
    c.height = 0.7;
    return;
  }
  const mossy = smoothstep(-60, -16, wall) + (valueNoise(x, y, 14, 99) - 0.5) * 0.8;
  if (mossy > 0.5) {
    c.kind = K.Moss;
    c.height = valueNoise(x, y, 3, 17) * 0.3 + valueNoise(x, y, 9, 19) * 0.2;
    c.tone = (valueNoise(x, y, 16, 33) - 0.5) * 2;
    return;
  }
  c.kind = K.Grass;
  c.height = valueNoise(x, y, 4, 17) * 0.25 + valueNoise(x, y, 11, 19) * 0.25;
  c.tone = (valueNoise(x, y, 18, 31) - 0.5) * 2;
}

function gloom(x: number, y: number, wall: number, look: Look): number {
  const vd = Math.hypot((x - GARDEN_W / 2) / (GARDEN_W / 2), (y - GARDEN_H / 2) / (GARDEN_H / 2));
  return smoothstep(-44, 0, wall) * look.wallDark + Math.max(0, vd - 0.75) * look.ground.edgeDark * 0.6;
}

const RUNE: [number, number, number] = [90, 220, 255];
const LOTUS_GLOW: [number, number, number] = [255, 140, 196];

function decorate(s: StripFields): boolean {
  // A ring of runes inlaid in the courtyard round the pool.
  let glows = runeCircle(s, POOL.x, POOL.y, POOL.rx + 26, (POOL.rx + 26) / (POOL.ry + 22), RUNE, (k) => (k === K.Tile ? K.Grout : k));
  // Lotuses glow softly.
  const { y0, W, H, PW, kind, emissive } = s;
  if (y0 > POOL.y + POOL.ry || y0 + H < POOL.y - POOL.ry) return glows;
  for (let y = 0; y < H; y++) {
    for (let x = POOL.x - POOL.rx; x <= POOL.x + POOL.rx; x++) {
      if (kind[(y + 1) * PW + x + 1] !== K.Lotus) continue;
      const e = (y * W + x) * 4;
      const k = clamp(0.55 + hash2(x, y + y0, 3) * 0.3, 0, 1);
      emissive[e] = LOTUS_GLOW[0] * k;
      emissive[e + 1] = LOTUS_GLOW[1] * k;
      emissive[e + 2] = LOTUS_GLOW[2] * k;
      emissive[e + 3] = 255;
      glows = true;
    }
  }
  return glows;
}

export const GARDEN_GROUND: GroundSpec = {
  key: 'garden',
  w: GARDEN_W,
  h: GARDEN_H,
  night: NIGHT_LOOK,
  day: DAY_LOOK,
  roofDepth,
  floor,
  gloom,
  decorate,
  casters: () => [],
  pools: () => gardenScenery().rays,
};
