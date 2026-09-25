// The arenas a run can be played in. The arena select lists ARENAS in order,
// and the world builds whichever one was picked. A new arena is one entry
// here: its ground (a GroundSpec), what can be walked on, its monsters and
// the scenery along its edge. Anything more of its own (the clearing's
// braziers, the garden's flowers) the world builds by the arena's id.

import { FOUNTAIN_BASE, FOUNTAIN_H } from '../art/garden';
import type Phaser from 'phaser';
import type { GroundSpec } from '../art/ground';
import type { SpawnSpot } from '../game/monsters';
import type { SceneryLayout } from './common';
import type { Drift } from './Scenery';
import { CLEARING_GROUND, CLEARING_SPAWN, CLEARING_SPAWNS, PLAZA_CX, PLAZA_CY, PLAZA_Y, clearingScenery, clearingWalkable, plazaProps } from './clearing';
import { COSMOS_CX, COSMOS_CY, COSMOS_H, COSMOS_SPAWN, COSMOS_W, OBELISKS, cosmosWalkable } from './cosmosLayout';
import { PLATFORM_X, PLATFORM_Y } from '../art/cosmos';
import { warmCosmos, warmIsland, warmSpirit } from '../art/textures';
import { QUEEN_HOME, SPIRIT_H, SPIRIT_SPAWN, SPIRIT_SPAWNS, SPIRIT_W, spiritWalkable } from './spiritLayout';
import { COLUMN_BASE, COLUMN_H, ISLAND_X, ISLAND_Y } from '../art/island';
import { COLUMNS, ISLE_H, ISLE_SPAWN, ISLE_W, RING_CX, RING_CY, islandScenery, islandWalkable } from './islandLayout';
import { GARDEN_GROUND, GARDEN_SPAWN, GARDEN_SPAWNS, POOL, gardenLayout, gardenScenery, gardenWalkable } from './sunken';

/** A sprite shown in the arena's window on its select card (world coordinates). */
export interface PreviewSprite {
  texture: string;
  frame?: string;
  x: number;
  y: number;
  /** Feet as a fraction of the frame: (0.5, 1) by default. */
  originY?: number;
  /** Additive glow layer with the same frames, if any. */
  glow?: string;
}

/**
 * Ground painted in one piece instead of streamed in strips (the Cosmos
 * Arena: a backdrop and a platform). The arena builds its own images.
 */
export interface PaintedGround {
  painted: true;
  w: number;
  h: number;
  /** Build its textures, at most `budget` ms at a time; true once they are all there. */
  warm(scene: Phaser.Scene, budget: number): boolean;
  /** What the select card's window shows of it: textures at world positions, some glowing. */
  layers: { key: string; x: number; y: number; glow?: boolean }[];
}

export const isPainted = (g: GroundSpec | PaintedGround): g is PaintedGround => 'painted' in g;

export interface ArenaDef {
  id: string;
  name: string;
  /** A line under the name on the select card. */
  blurb: string;
  /** Card highlight colour. */
  accent: number;
  ground: GroundSpec | PaintedGround;
  /** Where the hero starts, and rises after falling. */
  spawn: { x: number; y: number };
  monsters: SpawnSpot[];
  scenery(): SceneryLayout;
  walkable(x: number, y: number): boolean;
  /** Leaves (or petals) drifting down. */
  drift: Drift;
  /**
   * Day and night: true when this arena follows the day/night toggle. Arenas
   * without it keep a fixed light, `daylight` (0 night .. 1 day).
   */
  dayNight?: boolean;
  daylight?: number;
  /**
   * A 1v1 duelling arena: no monsters. The duel itself needs the multiplayer
   * server; until then it can be walked and fought in alone.
   */
  duel?: boolean;
  /** ms before a slain monster is replaced (9 s by default). */
  respawn?: number;
  /** The select card's window onto the arena: its centre, and what stands in view. */
  preview: { x: number; y: number; sprites(): PreviewSprite[] };
}

export const ARENAS: ArenaDef[] = [
  {
    id: 'clearing',
    name: 'Runestone Clearing',
    blurb: 'A plaza lit by braziers',
    accent: 0xffb45a,
    ground: CLEARING_GROUND,
    spawn: CLEARING_SPAWN,
    monsters: CLEARING_SPAWNS,
    scenery: clearingScenery,
    walkable: clearingWalkable,
    drift: {
      tints: [0x5f9a4b, 0x80b35a, 0x3b753c, 0xd49e34, 0xb8873a],
      frequency: 520,
      where: (view: Phaser.Geom.Rectangle) => view.top < PLAZA_Y + 120,
    },
    dayNight: true,
    preview: {
      x: PLAZA_CX + 80,
      y: PLAZA_CY - 80,
      sprites: () => {
        const p = plazaProps();
        return [
          ...p.braziers.map((b) => ({ texture: 'brazier', frame: 'f0', glow: 'brazier_e', x: b.x, y: b.y, originY: 25 / 26 })),
          ...p.crystals.map((c) => ({ texture: 'crystals', frame: c.frame, glow: 'crystals_e', x: c.x, y: c.y, originY: 20 / 22 })),
          ...p.dummies.map((d) => ({ texture: 'dummy', frame: 'd0', x: d.x, y: d.y, originY: 26 / 28 })),
          ...p.rocks.map((r) => ({ texture: 'rock', frame: r.frame, x: r.x, y: r.y, originY: 12 / 14 })),
        ];
      },
    },
  },
  {
    id: 'garden',
    name: 'Sunken Garden',
    blurb: 'Ruins lost under giant flowers',
    accent: 0xff8ac0,
    ground: GARDEN_GROUND,
    spawn: GARDEN_SPAWN,
    monsters: GARDEN_SPAWNS,
    scenery: gardenScenery,
    walkable: gardenWalkable,
    drift: {
      tints: [0xffc4de, 0xff9ec8, 0xfff4fa, 0xe2b4ff, 0x80b35a],
      frequency: 380,
      where: () => true,
    },
    daylight: 0.85,
    preview: {
      x: POOL.x - 62,
      y: POOL.y - 30,
      sprites: () => {
        const g = gardenLayout();
        return [
          { texture: 'fountain', frame: 'f0', glow: 'fountain_e', x: g.fountain.x, y: g.fountain.y, originY: FOUNTAIN_BASE / FOUNTAIN_H },
          ...g.hwalls.map((w) => ({ texture: 'ruin_h', frame: `h${w.v}`, x: w.x, y: w.y, originY: 22 / 24 })),
          ...g.vwalls.map((w) => ({ texture: 'ruin_v', frame: `v${w.v}`, x: w.x, y: w.y, originY: 28 / 30 })),
          ...g.pillars.map((p) => ({ texture: 'pillar', frame: `p${p.v}`, x: p.x, y: p.y, originY: 52 / 54 })),
          ...g.thorns.map((t) => ({ texture: 'thornbloom', frame: 'bloom', glow: 'thornbloom_e', x: t.x, y: t.y, originY: 63 / 66 })),
          ...g.blooms.map((b) => ({ texture: 'bloom', frame: `${b.kind}_open`, glow: 'bloom_e', x: b.x, y: b.y, originY: 44 / 46 })),
          ...g.crystals.map((c) => ({ texture: 'crystals', frame: c.frame, glow: 'crystals_e', x: c.x, y: c.y, originY: 20 / 22 })),
        ];
      },
    },
  },
  {
    id: 'cosmos',
    name: 'Cosmos Arena',
    blurb: 'Adrift in the void',
    accent: 0xb89cff,
    ground: {
      painted: true,
      w: COSMOS_W,
      h: COSMOS_H,
      warm: warmCosmos,
      layers: [
        { key: 'cosmos_space', x: 0, y: 0 },
        { key: 'cosmos_platform', x: PLATFORM_X, y: PLATFORM_Y },
        { key: 'cosmos_platform_e', x: PLATFORM_X, y: PLATFORM_Y, glow: true },
      ],
    },
    spawn: COSMOS_SPAWN,
    // The Astral Warden alone, over the heart of the platform.
    monsters: [{ kind: 'warden', x: COSMOS_CX, y: COSMOS_CY }],
    respawn: 20000,
    scenery: () => ({ trees: [], props: [], rays: [], colliders: [] }),
    walkable: cosmosWalkable,
    drift: { tints: [0xffffff], frequency: 100000, where: () => false },
    // No day or night out here: a fixed, starlit dark (the arena sets its own light).
    daylight: 0,
    preview: {
      x: COSMOS_CX,
      y: COSMOS_CY - 54,
      sprites: () => [
        { texture: 'warden', frame: 'idle0_r', glow: 'warden_e', x: COSMOS_CX, y: COSMOS_CY - 2, originY: 113 / 116 },
        ...OBELISKS.map((o) => ({ texture: 'cosmos_obelisk', frame: 'o0', glow: 'cosmos_obelisk_e', x: o.x, y: o.y, originY: 47 / 50 })),
      ],
    },
  },
  {
    id: 'spirit',
    name: 'Spirit Dungeon',
    blurb: 'Where the restless dead wait',
    accent: 0x6af4dc,
    ground: {
      painted: true,
      w: SPIRIT_W,
      h: SPIRIT_H,
      warm: warmSpirit,
      layers: [
        { key: 'sd_floor', x: 0, y: 0 },
        { key: 'sd_floor_e', x: 0, y: 0, glow: true },
      ],
    },
    spawn: SPIRIT_SPAWN,
    // Deeper chambers hold more and darker spirits, and they return sooner;
    // the Hollow Queen waits at the end (see spiritLayout.ts).
    monsters: SPIRIT_SPAWNS,
    scenery: () => ({ trees: [], props: [], rays: [], colliders: [] }),
    walkable: spiritWalkable,
    drift: { tints: [0xffffff], frequency: 100000, where: () => false },
    // Underground: no day or night, the dungeon lights itself.
    daylight: 0,
    preview: {
      x: QUEEN_HOME.x,
      y: QUEEN_HOME.y - 40,
      sprites: () => [
        { texture: 'queen', frame: 'idle0_r', glow: 'queen_e', x: QUEEN_HOME.x, y: QUEEN_HOME.y - 1, originY: 81 / 84 },
        { texture: 'wisp', frame: 'idle1_r', glow: 'wisp_e', x: QUEEN_HOME.x - 52, y: QUEEN_HOME.y - 12, originY: 22 / 24 },
        { texture: 'wisp', frame: 'idle3_l', glow: 'wisp_e', x: QUEEN_HOME.x + 56, y: QUEEN_HOME.y - 24, originY: 22 / 24 },
      ],
    },
  },
  {
    id: 'island',
    name: 'Floating Island',
    blurb: 'A marble ring for 1v1 duels',
    accent: 0x8fd8ff,
    ground: {
      painted: true,
      w: ISLE_W,
      h: ISLE_H,
      warm: warmIsland,
      layers: [
        { key: 'isle_sky', x: 0, y: 0 },
        { key: 'isle_land', x: ISLAND_X, y: ISLAND_Y },
      ],
    },
    spawn: ISLE_SPAWN,
    monsters: [],
    duel: true,
    scenery: islandScenery,
    walkable: islandWalkable,
    drift: { tints: [0xffc4de, 0xfff4fa, 0xffe0ec, 0xffffff], frequency: 650, where: () => true },
    // Always a bright, clear day up here.
    daylight: 1,
    preview: {
      x: RING_CX,
      y: RING_CY + 28,
      sprites: () => COLUMNS.map((c) => ({ texture: 'isle_column', frame: `c${c.v}`, x: c.x, y: c.y, originY: COLUMN_BASE / COLUMN_H })),
    },
  },
];

export function arenaById(id: string | undefined): ArenaDef {
  return ARENAS.find((a) => a.id === id) ?? ARENAS[0];
}

const KEY = 'pixel-battle.arena';

/** The arena picked last time, remembered across visits. */
export function lastArena(): string {
  try {
    return localStorage.getItem(KEY) ?? ARENAS[0].id;
  } catch {
    return ARENAS[0].id;
  }
}

export function rememberArena(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Not persisted; the pick still applies for this visit.
  }
}
