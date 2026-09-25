// Runestone Clearing, the first arena: a paved plaza with a rune circle in a
// meadow, braziers and crystals around it, and the forest's treetops closing
// it off to the north. Everything here is a pure function of world
// coordinates (see art/ground.ts for how the ground is built from it).

import { DAY_GROUND, NIGHT_GROUND, hash2, rng, valueNoise } from '../art/env';
import { K, flagstone, nightify, ramp, runeCircle, smoothstep, stone, type Cell, type GroundSpec, type Look, type StripFields } from '../art/ground';
import type { SpawnSpot } from '../game/monsters';
import { ColliderGrid, TREE_SHAPE, edgeScenery, type RaySpot, type SceneryLayout } from './common';

export const CLEARING_W = 640;
export const PLAZA_H = 448;
/** Top of the plaza: the treetops above it are all that is left of the forest. */
export const PLAZA_Y = 88;
export const CLEARING_H = PLAZA_Y + PLAZA_H;

export const PLAZA_CX = CLEARING_W / 2;
export const PLAZA_CY = PLAZA_Y + PLAZA_H / 2;
/** Radius of the plaza's flagstones (before the 1.15 vertical squash). */
export const PLAZA_R = Math.min(CLEARING_W, PLAZA_H) * 0.3;
/** Where the braziers and crystals stand around the plaza. */
const RING = 192;

/** Wobble of the roof's edge, so it reads as a mass of trees rather than a line. */
const edgeWobble = (x: number, y: number) => (valueNoise(x, y, 7, 41) - 0.5) * 10 + (valueNoise(x, y, 19, 43) - 0.5) * 16;

/** The treeline: close over the plaza in the middle, bowing down toward the corners. */
export function roofDepth(x: number, y: number): number {
  const u = (x - PLAZA_CX) / (CLEARING_W / 2);
  const edge = PLAZA_Y + 16 + u * u * 52 + (valueNoise(x, 0, 60, 47) - 0.5) * 18;
  return edge - y + edgeWobble(x, y);
}

// ---------------------------------------------------------------------------
// What stands on the plaza.

export interface PlazaProps {
  braziers: { x: number; y: number }[];
  crystals: { x: number; y: number; frame: string }[];
  rocks: { x: number; y: number; frame: string }[];
  dummies: { x: number; y: number }[];
}

let props: PlazaProps | null = null;

export function plazaProps(): PlazaProps {
  if (props) return props;
  const cx = PLAZA_CX;
  const cy = PLAZA_CY;
  const braziers = [
    [-0.78, -0.62],
    [0.78, -0.62],
    [-0.78, 0.62],
    [0.78, 0.62],
  ].map(([ax, ay]) => ({ x: Math.round(cx + ax * RING), y: Math.round(cy + ay * RING * 0.87) }));
  const crystals = [
    { x: cx - RING - 40, y: cy - 30, frame: 'c0' },
    { x: cx + RING + 46, y: cy + 22, frame: 'c1' },
    { x: cx + 50, y: PLAZA_Y + 46, frame: 'c1' },
  ];
  const rocks: PlazaProps['rocks'] = [];
  const R = rng(4242);
  for (let i = 0; i < 18; i++) {
    const a = R() * Math.PI * 2;
    const d = RING + 30 + R() * 120;
    const x = Math.round(cx + Math.cos(a) * d * 1.3);
    const y = Math.round(cy + Math.sin(a) * d);
    // Keep the lawn's edge and the treeline clear.
    if (x < 16 || x > CLEARING_W - 16 || y > CLEARING_H - 8 || roofDepth(x, y) > -24) continue;
    rocks.push({ x, y, frame: `r${i % 3}` });
  }
  const dummies = [
    { x: cx + 64, y: cy - 8 },
    { x: cx - 70, y: cy + 34 },
  ];
  props = { braziers, crystals, rocks, dummies };
  return props;
}

/** The plaza's monsters, around the edge of the clearing. */
export const CLEARING_SPAWNS: SpawnSpot[] = (
  [
    ['frog', 150, 118],
    ['frog', 522, 334],
    ['puffcap', 470, 104],
    ['puffcap', 494, 122],
    ['puffcap', 462, 130],
    ['beetle', 148, 342],
  ] as const
).map(([kind, x, y]) => ({ kind, x, y: y + PLAZA_Y }));

export const CLEARING_SPAWN = { x: PLAZA_CX, y: PLAZA_CY + 20 };

// ---------------------------------------------------------------------------
// Trees along the treeline, and what can be walked on.

let scenery: SceneryLayout | null = null;

export function clearingScenery(): SceneryLayout {
  if (scenery) return scenery;
  const p = plazaProps();
  const near = (x: number, y: number, list: { x: number; y: number }[], r: number) => list.some((o) => Math.hypot(o.x - x, (o.y - y) * 1.3) < r);
  scenery = edgeScenery({
    w: CLEARING_W,
    h: CLEARING_H,
    seed: 2024,
    roofDepth,
    trees: true,
    keepClear: (x, y) => near(x, y, p.crystals, 26) || near(x, y, p.braziers, 30),
  });
  // A few shafts of sunlight slant through the treeline onto the grass.
  const rays: RaySpot[] = [];
  for (const [x, seed] of [
    [150, 3],
    [372, 41],
    [520, 77],
  ]) {
    let y = PLAZA_Y;
    while (roofDepth(x, y) > -22) y++;
    rays.push({ x, y: y + 6, seed });
  }
  scenery.rays = rays;
  return scenery;
}

let grid: ColliderGrid | null = null;

/** Plaza walls: its lawn stops short of the world's edge on the east, west and south. */
const WALLS = { left: 28, right: CLEARING_W - 28, bottom: CLEARING_H - 24 };

/** Can feet stand at (x, y)? */
export function clearingWalkable(x: number, y: number): boolean {
  if (y < 10 || y > WALLS.bottom || x < WALLS.left || x > WALLS.right) return false;
  if (roofDepth(x, y) > -9) return false;
  grid ??= new ColliderGrid(clearingScenery().colliders);
  return !grid.hits(x, y);
}

// ---------------------------------------------------------------------------
// The ground.

const DAY_LOOK: Look = {
  ground: DAY_GROUND,
  moss: ramp('#17331f', '#1e4226', '#28542d', '#356a34', '#4a803b', '#679a46', '#8ab45a'),
  litter: ramp('#3a2718', '#58391f', '#7a5024', '#9c6c2c', '#bf8e3c', '#93402a'),
  path: ramp('#3e2e22', '#55402d', '#6e553a', '#876c4a', '#a1865d', '#baa072', '#cfb788'),
  bark: ramp('#1f140e', '#352318', '#4f3524', '#6b4a32'),
  roof: [
    ramp('#0d2419', '#133220', '#1b4328', '#255630', '#336b38', '#468241', '#5f9a4b', '#80b35a'),
    ramp('#1a3319', '#26461f', '#355d25', '#46742c', '#5c8c35', '#77a53f', '#96be4f', '#b8d466'),
    ramp('#0a1f1d', '#0f2b27', '#153830', '#1d4739', '#275743', '#33694d', '#437b58', '#568e64'),
    ramp('#2c2410', '#433716', '#5c4b1c', '#776021', '#937629', '#ad8d35', '#c6a647', '#dcc068'),
  ],
  bloom: ramp('#7d8cf0', '#eef3ff', '#f4e27c', '#f0a0cf', '#a6d8ff'),
  shroom: [200, 255, 240],
  stem: [232, 226, 204],
  cast: [14, 16],
  shadow: 1.9,
  pool: 2.4,
  wallDark: 1.1,
};

const NIGHT_LOOK: Look = {
  ground: NIGHT_GROUND,
  moss: DAY_LOOK.moss.map(nightify),
  litter: DAY_LOOK.litter.map(nightify),
  path: DAY_LOOK.path.map(nightify),
  bark: DAY_LOOK.bark.map(nightify),
  roof: DAY_LOOK.roof.map((r) => r.map(nightify)),
  bloom: ramp('#4a5694', '#8a93b8', '#7b7a6a', '#7a5a86', '#5a7aa0'),
  shroom: [159, 255, 240],
  stem: [106, 120, 136],
  cast: [-12, 14],
  shadow: 0.9,
  pool: 0.9,
  wallDark: 1.7,
};

const RUNE: [number, number, number] = [150, 110, 255];

/** The plaza, a meadow round it, and the forest floor creeping out from under the treeline. */
function floor(wx: number, wy: number, wall: number, c: Cell): void {
  const d = Math.hypot(wx - PLAZA_CX, (wy - PLAZA_CY) * 1.15);
  const edgeNoise = (valueNoise(wx, wy, 9, 3) - 0.5) * 22;
  if (d < PLAZA_R + edgeNoise) {
    // Flagstones, mossy toward the edge.
    const mossy = valueNoise(wx, wy, 14, 5);
    flagstone(wx, wy);
    if (stone.edge < 0.55) {
      c.kind = K.Grout;
      c.tone = mossy > 0.55 ? 2 : mossy > 0.4 ? 1 : 0;
    } else {
      c.kind = K.Stone;
      c.height = Math.min(1, stone.edge / 2.2) * 0.7 + valueNoise(wx, wy, 3, 11) * 0.08;
      c.tone = (stone.t - 0.5) * 0.9 + (valueNoise(wx, wy, 6, 13) - 0.5) * 0.6;
      if (mossy > 0.62 && d > PLAZA_R * 0.55 && hash2(wx, wy, 3) > 0.35) {
        c.kind = K.Grass;
        c.tone = 0;
      }
    }
    return;
  }
  if (valueNoise(wx, wy, 20, 21) > 0.8 && d < PLAZA_R + 40) {
    c.kind = K.Dirt;
    c.height = valueNoise(wx, wy, 2, 23) * 0.2;
    c.tone = (valueNoise(wx, wy, 4, 29) - 0.5) * 1.5;
    return;
  }
  // Grass in the clearing, the forest's moss and leaf litter under the treeline, mingling where they meet.
  const forest = smoothstep(-70, -18, wall) > 0.5 + (valueNoise(wx, wy, 9, 61) - 0.5) * 0.9;
  if (!forest) {
    c.kind = K.Grass;
    c.height = valueNoise(wx, wy, 4, 17) * 0.25 + valueNoise(wx, wy, 11, 19) * 0.25;
    c.tone = (valueNoise(wx, wy, 18, 31) - 0.5) * 2.2;
  } else if (valueNoise(wx, wy, 13, 51) > 0.56 && hash2(wx, wy, 53) > 0.32) {
    c.kind = K.Litter;
    c.height = 0.35 + hash2(wx, wy, 55) * 0.35;
    c.tone = 1 + Math.floor(hash2(wx >> 1, wy, 57) * 4) + (hash2(wx, wy, 58) > 0.96 ? 1 : 0);
  } else {
    c.kind = K.Moss;
    c.height = valueNoise(wx, wy, 3, 17) * 0.3 + valueNoise(wx, wy, 9, 19) * 0.2;
    c.tone = (valueNoise(wx, wy, 16, 33) - 0.5) * 2 + (valueNoise(wx, wy, 5, 35) - 0.5) * 0.8;
  }
}

/** The meadow darkens toward the world's edges; under the treeline, the forest's gloom. */
function gloom(x: number, wy: number, wall: number, look: Look): number {
  const ly = wy - PLAZA_Y;
  const vd = Math.hypot((x - PLAZA_CX) / (CLEARING_W / 2), (ly - PLAZA_H / 2) / (PLAZA_H / 2));
  const pd = Math.max(0, vd - 0.55) * look.ground.edgeDark;
  const fd = smoothstep(-46, 0, wall) * look.wallDark;
  const reg = smoothstep(-80, -24, wall);
  return pd * (1 - reg) + fd * reg;
}

export const CLEARING_GROUND: GroundSpec = {
  key: 'clearing',
  w: CLEARING_W,
  h: CLEARING_H,
  night: NIGHT_LOOK,
  day: DAY_LOOK,
  roofDepth,
  floor,
  gloom,
  decorate: (s: StripFields) => runeCircle(s, PLAZA_CX, PLAZA_CY, PLAZA_R * 0.42, 1.15, RUNE, (k) => (k === K.Grass || k === K.Flower ? K.Grass : K.Grout)),
  casters: () => clearingScenery().trees.map((t) => ({ x: t.x, y: t.y, r: TREE_SHAPE[t.kind].canopyR })),
  pools: () => clearingScenery().rays,
};
