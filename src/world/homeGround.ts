// The Home arena: a meadow clearing in the forest with the player's building
// plot in the middle (see homeLayout.ts), under their own day and night. The
// ground here is only the lawn and the forest's edge; everything built on
// the plot is drawn by world/Home.ts over it.

import { hash2, valueNoise } from '../art/env';
import { K, smoothstep, type Cell, type GroundSpec, type Look } from '../art/ground';
import { ColliderGrid, TREE_SHAPE, edgeScenery, type SceneryLayout } from './common';
import { DAY_LOOK, NIGHT_LOOK } from './clearing';
import { HOME_H, HOME_W, PLOT_H, PLOT_W, PLOT_X, PLOT_Y, homeRoofDepth, type HomeMask } from './homeLayout';
import type { ArenaDef } from './arenas';

/** Where a visit begins: at the foot of the plot, in the middle. */
export const HOME_SPAWN = { x: PLOT_X + PLOT_W / 2 + 8, y: PLOT_Y + PLOT_H - 8 };

const inPlotPx = (x: number, y: number, pad = 0) => x >= PLOT_X - pad && y >= PLOT_Y - pad && x < PLOT_X + PLOT_W + pad && y < PLOT_Y + PLOT_H + pad;

let scenery: SceneryLayout | null = null;

export function homeScenery(): SceneryLayout {
  scenery ??= edgeScenery({ w: HOME_W, h: HOME_H, seed: 3141, roofDepth: homeRoofDepth, trees: true, keepClear: (x, y) => inPlotPx(x, y, 10) });
  return scenery;
}

/** What stands in the way on the plot, kept up to date by the Home as it's built (see Home.ts). */
let mask: HomeMask | null = null;
export function setHomeMask(m: HomeMask | null): void {
  mask = m;
}

let grid: ColliderGrid | null = null;

export function homeWalkable(x: number, y: number): boolean {
  if (x < 10 || y < 10 || x > HOME_W - 10 || y > HOME_H - 16) return false;
  if (inPlotPx(x, y)) return !mask?.blocked(x - PLOT_X, y - PLOT_Y);
  if (homeRoofDepth(x, y) > -9) return false;
  grid ??= new ColliderGrid(homeScenery().colliders);
  return !grid.hits(x, y);
}

/** Grass in the open, and the forest's moss and leaf litter creeping out from under the treeline. */
function floor(wx: number, wy: number, wall: number, c: Cell): void {
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

/** Only the forest's gloom under the treeline: the plot itself stays bright to the edges. */
function gloom(_x: number, _y: number, wall: number, look: Look): number {
  return smoothstep(-46, 0, wall) * look.wallDark;
}

export const HOME_GROUND: GroundSpec = {
  key: 'home',
  w: HOME_W,
  h: HOME_H,
  night: NIGHT_LOOK,
  day: DAY_LOOK,
  roofDepth: homeRoofDepth,
  floor,
  gloom,
  casters: () => homeScenery().trees.map((t) => ({ x: t.x, y: t.y, r: TREE_SHAPE[t.kind].canopyR })),
  pools: () => [],
};

/** The Home: not on the arena select, reached by the Home button (and friends' invites). */
export const HOME_ARENA: ArenaDef = {
  id: 'home',
  name: 'Home',
  blurb: 'Build your own place',
  accent: 0xffc47a,
  ground: HOME_GROUND,
  spawn: HOME_SPAWN,
  monsters: [],
  scenery: homeScenery,
  walkable: homeWalkable,
  drift: {
    tints: [0x5f9a4b, 0x80b35a, 0x3b753c, 0xd49e34, 0xf0a8c0],
    frequency: 700,
    where: (view) => view.top < PLOT_Y + 40 || view.left < PLOT_X || view.right > PLOT_X + PLOT_W,
  },
  dayNight: true,
  preview: { x: PLOT_X + PLOT_W / 2, y: PLOT_Y + PLOT_H / 2, sprites: () => [] },
};
