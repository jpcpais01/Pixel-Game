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
import { CLEARING_GROUND, CLEARING_SPAWN, CLEARING_W, PLAZA_CX, PLAZA_CY, PLAZA_Y, clearingScenery, clearingWalkable, plazaProps } from './clearing';
import { COSMOS_CX, COSMOS_CY, COSMOS_H, COSMOS_SPAWN, COSMOS_W, OBELISKS, cosmosWalkable } from './cosmosLayout';
import { PLATFORM_X, PLATFORM_Y } from '../art/cosmos';
import { warmCosmos, warmDeep, warmFrost, warmGlide, warmIsland, warmRift, warmSpirit, warmTemple, warmWorldMap } from '../art/arenaLoader';
import { BRAZIERS, FROST_CX, FROST_CY, FROST_H, FROST_SPAWN, FROST_W, STATUES, brazierAt, frostWalkable } from './frostLayout';
import { BRAZIER_H, BRAZIER_OY, STATUE_H, STATUE_OY } from '../art/frost';
import { MONSTER_FRAME } from '../art/monsters';
import { RIFT_CX, RIFT_CY, RIFT_H, RIFT_SPAWN, RIFT_W, SHARDS, TEARS, riftWalkable } from './riftLayout';
import { RIFT_PLATFORM_X, RIFT_PLATFORM_Y, SHARD_H, SHARD_OY } from '../art/rift';
import { GroundStreamer } from './GroundStreamer';
import { DEEP_H, DEEP_SPAWN, DEEP_SPAWNS, DEEP_W, WYRM_HOME, deepWalkable } from './deepLayout';
import { ELEMENTINHO_HOME, TEMPLE_H, TEMPLE_SPAWN, TEMPLE_SPAWNS, TEMPLE_W, templeWalkable } from './templeLayout';
import { QUEEN_HOME, SPIRIT_H, SPIRIT_SPAWN, SPIRIT_SPAWNS, SPIRIT_W, spiritWalkable } from './spiritLayout';
import { COLUMN_BASE, COLUMN_H, ISLAND_X, ISLAND_Y } from '../art/island';
import { COLUMNS, ISLE_H, ISLE_SPAWN, ISLE_W, RING_CX, RING_CY, islandScenery, islandWalkable } from './islandLayout';
import { HOME_ARENA } from './homeGround';
import { GARDEN_GROUND, GARDEN_SPAWN, GARDEN_SPAWNS, POOL, gardenLayout, gardenScenery, gardenWalkable } from './sunken';
import { FOREST_ARENA } from './forestArena';

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
  /** The whole world, when it reaches past the ground. */
  world?: { w: number; h: number };
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
  /** Played alone for now: no online rooms (the Endless Rift's waves aren't shared yet). */
  solo?: boolean;
  /**
   * Played in a scene of its own instead of the world (Sky Glide), with its
   * own HUD; online, a race rather than co-op.
   */
  mode?: { scene: string; ui: string; race?: boolean };
  /** The select card's window onto the arena: its centre, and what stands in view. */
  preview: { x: number; y: number; sprites(): PreviewSprite[] };
}

export const ARENAS: ArenaDef[] = [
  {
    id: 'clearing',
    name: 'Runestone Clearing',
    blurb: 'Home, and the Rune Temple',
    accent: 0xffb45a,
    ground: CLEARING_GROUND,
    spawn: CLEARING_SPAWN,
    // A home arena: no monsters, just the temple and the training dummies.
    monsters: [],
    scenery: clearingScenery,
    walkable: clearingWalkable,
    drift: {
      tints: [0x5f9a4b, 0x80b35a, 0x3b753c, 0xd49e34, 0xb8873a],
      frequency: 520,
      where: (view: Phaser.Geom.Rectangle) => view.top < PLAZA_Y + 120 && view.left < CLEARING_W,
    },
    dayNight: true,
    preview: {
      x: PLAZA_CX + 80,
      y: PLAZA_CY - 40,
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
  FOREST_ARENA,
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
    id: 'temple',
    name: 'Elementinho Temple',
    blurb: 'Four elements, and a drop of fire',
    accent: 0xff8a2a,
    ground: {
      painted: true,
      w: TEMPLE_W,
      h: TEMPLE_H,
      warm: warmTemple,
      layers: [
        { key: 'et_floor', x: 0, y: 0 },
        { key: 'et_floor_e', x: 0, y: 0, glow: true },
      ],
    },
    spawn: TEMPLE_SPAWN,
    // A hall for each element, their creatures tougher deeper in; Elementinho
    // burns in the Heart at the end (see templeLayout.ts).
    monsters: TEMPLE_SPAWNS,
    scenery: () => ({ trees: [], props: [], rays: [], colliders: [] }),
    walkable: templeWalkable,
    drift: { tints: [0xffffff], frequency: 100000, where: () => false },
    // Indoors: no day or night, the temple lights itself.
    daylight: 0,
    preview: {
      x: ELEMENTINHO_HOME.x,
      y: ELEMENTINHO_HOME.y - 44,
      sprites: () => [
        { texture: 'et_obelisk', frame: 'o0', glow: 'et_obelisk_e', x: 168, y: 116, originY: 54 / 58 },
        { texture: 'et_obelisk', frame: 'o2', glow: 'et_obelisk_e', x: 432, y: 116, originY: 54 / 58 },
        { texture: 'elementinho', frame: 'idle0_r', glow: 'elementinho_e', x: ELEMENTINHO_HOME.x, y: ELEMENTINHO_HOME.y - 6, originY: 96 / 100 },
        { texture: 'blob_water', frame: 'idle1_r', glow: 'blob_water_e', x: ELEMENTINHO_HOME.x - 62, y: ELEMENTINHO_HOME.y + 6, originY: 19 / 22 },
        { texture: 'blob_fire', frame: 'idle2_l', glow: 'blob_fire_e', x: ELEMENTINHO_HOME.x + 60, y: ELEMENTINHO_HOME.y + 2, originY: 19 / 22 },
      ],
    },
  },
  {
    id: 'deep',
    name: 'The Glimmerdeep',
    blurb: 'A cave lit by living light',
    accent: 0xb37aff,
    ground: {
      painted: true,
      w: DEEP_W,
      h: DEEP_H,
      warm: warmDeep,
      layers: [
        { key: 'gd_floor', x: 0, y: 0 },
        { key: 'gd_floor_e', x: 0, y: 0, glow: true },
      ],
    },
    spawn: DEEP_SPAWN,
    // Winding caverns, their creatures tougher the deeper they lie; the
    // Sporemother waits in her Hollow partway, and Amethrax, the Geode Wyrm,
    // lies coiled in the Geode Heart at the very end (see deepLayout.ts).
    monsters: DEEP_SPAWNS,
    scenery: () => ({ trees: [], props: [], rays: [], colliders: [] }),
    walkable: deepWalkable,
    drift: { tints: [0xffffff], frequency: 100000, where: () => false },
    // Deep underground: no day or night, the cave lights itself.
    daylight: 0,
    preview: {
      x: WYRM_HOME.x,
      y: WYRM_HOME.y - 56,
      sprites: () => [
        { texture: 'gd_spire', frame: 'p0', glow: 'gd_spire_e', x: WYRM_HOME.x - 118, y: WYRM_HOME.y - 20, originY: 68 / 72 },
        { texture: 'gd_spire', frame: 'p1', glow: 'gd_spire_e', x: WYRM_HOME.x + 124, y: WYRM_HOME.y - 12, originY: 68 / 72 },
        { texture: 'wyrm', frame: 'idle0_r', glow: 'wyrm_e', x: WYRM_HOME.x, y: WYRM_HOME.y, originY: 130 / 136 },
        { texture: 'shardling', frame: 'idle0_l', glow: 'shardling_e', x: WYRM_HOME.x + 74, y: WYRM_HOME.y + 18, originY: 18 / 20 },
        { texture: 'glimbat', frame: 'fly2_r', glow: 'glimbat_e', x: WYRM_HOME.x - 76, y: WYRM_HOME.y - 44, originY: 24 / 26 },
      ],
    },
  },
  {
    id: 'rift',
    name: 'The Endless Rift',
    blurb: 'Wave after wave: how far can you go?',
    accent: 0xff5ac0,
    ground: {
      painted: true,
      w: RIFT_W,
      h: RIFT_H,
      // Its waves call on the Rune Temple's and the Deep's monsters, whose sheets those arenas build.
      // All three are asked for at once, so the worker builds them back to back.
      warm: (scene, budget) => {
        const temple = warmTemple(scene, budget);
        const deep = warmDeep(scene, budget);
        return warmRift(scene, budget) && temple && deep;
      },
      layers: [
        { key: 'rift_void', x: 0, y: 0 },
        { key: 'rift_platform', x: RIFT_PLATFORM_X, y: RIFT_PLATFORM_Y },
        { key: 'rift_platform_e', x: RIFT_PLATFORM_X, y: RIFT_PLATFORM_Y, glow: true },
      ],
    },
    spawn: RIFT_SPAWN,
    // Its waves come from game/rift.ts, not a spawn table.
    monsters: [],
    scenery: () => ({ trees: [], props: [], rays: [], colliders: [] }),
    walkable: riftWalkable,
    drift: { tints: [0xffffff], frequency: 100000, where: () => false },
    // Adrift in the void: no day or night, the rift lights itself.
    daylight: 0,
    preview: {
      x: RIFT_CX,
      y: RIFT_CY - 34,
      sprites: () => [
        ...TEARS.filter((t) => t.y < RIFT_CY).map((t, i) => ({ texture: 'rift_tear', frame: `t${i % 4}`, x: t.x, y: t.y + 2 })),
        ...SHARDS.filter((s) => s.y < RIFT_CY).map((s) => ({ texture: 'rift_shard', frame: `s${s.v}`, glow: 'rift_shard_e', x: s.x, y: s.y, originY: SHARD_OY / SHARD_H })),
        { texture: 'golem', frame: 'idle0_r', glow: 'golem_e', x: RIFT_CX + 30, y: RIFT_CY - 16 },
        { texture: 'wisp', frame: 'idle1_l', glow: 'wisp_e', x: RIFT_CX - 44, y: RIFT_CY - 26, originY: 22 / 24 },
        { texture: 'blob_fire', frame: 'idle2_r', glow: 'blob_fire_e', x: RIFT_CX - 18, y: RIFT_CY - 8, originY: 19 / 22 },
      ],
    },
  },
  {
    id: 'frost',
    name: 'Aurora Colosseum',
    blurb: 'The Long Winter, wave after wave',
    accent: 0x5affb0,
    ground: {
      painted: true,
      w: FROST_W,
      h: FROST_H,
      warm: warmFrost,
      layers: [
        { key: 'fz_sky', x: 0, y: 0 },
        { key: 'fz_arena', x: 0, y: 0 },
        { key: 'fz_arena_e', x: 0, y: 0, glow: true },
      ],
    },
    spawn: FROST_SPAWN,
    // Its waves come from game/frost.ts (run by game/rift.ts), not a spawn table.
    monsters: [],
    scenery: () => ({ trees: [], props: [], rays: [], colliders: [] }),
    walkable: frostWalkable,
    drift: { tints: [0xffffff], frequency: 100000, where: () => false },
    // Always night on the roof of the world, under the northern lights.
    daylight: 0,
    preview: {
      x: FROST_CX,
      y: 262,
      sprites: () => {
        const f = (k: keyof typeof MONSTER_FRAME) => MONSTER_FRAME[k].oy / MONSTER_FRAME[k].h;
        return [
          ...BRAZIERS.slice(0, 4).map((deg) => {
            const b = brazierAt(deg);
            return { texture: 'fz_brazier', frame: 'f0', glow: 'fz_brazier_e', x: b.x, y: b.y, originY: BRAZIER_OY / BRAZIER_H };
          }),
          ...STATUES.filter((s) => s.y < FROST_CY).map((s) => ({ texture: 'fz_statue', frame: `s${s.v}`, glow: 'fz_statue_e', x: s.x, y: s.y, originY: STATUE_OY / STATUE_H })),
          { texture: 'vargr', frame: 'idle0_l', glow: 'vargr_e', x: FROST_CX + 8, y: 286, originY: f('vargr') },
          { texture: 'rimefang', frame: 'idle0_r', glow: 'rimefang_e', x: FROST_CX - 64, y: 300, originY: f('rimefang') },
          { texture: 'rimesprite', frame: 'fly0_l', glow: 'rimesprite_e', x: FROST_CX + 72, y: 276, originY: f('rimesprite') },
        ];
      },
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
  {
    id: 'glide',
    name: 'Sky Glide',
    blurb: 'Ride the wind down from the island',
    accent: 0x9ae8ff,
    // Its sky and islets; the course itself is built by scenes/GlideScene.ts.
    ground: {
      painted: true,
      w: 256,
      h: 256,
      warm: warmGlide,
      layers: [{ key: 'gl_sea', x: 0, y: 0 }],
    },
    spawn: { x: 128, y: 128 },
    monsters: [],
    mode: { scene: 'glide', ui: 'glideui', race: true },
    scenery: () => ({ trees: [], props: [], rays: [], colliders: [] }),
    walkable: () => false,
    drift: { tints: [0xffffff], frequency: 100000, where: () => false },
    daylight: 1,
    preview: {
      x: 128,
      y: 128,
      sprites: () => [
        { texture: 'isle_islet2', x: 196, y: 118 },
        { texture: 'gl_puff1', x: 70, y: 186 },
        { texture: 'gl_islet0', x: 84, y: 158 },
        { texture: 'gl_puff2', x: 196, y: 194 },
        { texture: 'gl_islet1', x: 176, y: 172 },
        { texture: 'gl_ring_big', frame: 'b2', x: 112, y: 116, originY: 0.5 },
        { texture: 'gl_ring', frame: 'g1', x: 134, y: 128, originY: 0.5 },
        { texture: 'gl_ring', frame: 'g5', x: 152, y: 140, originY: 0.5 },
      ],
    },
  },
];

/** Height of the window onto an arena on its select card, in world pixels. */
export const PREVIEW_H = 84;

/**
 * Build what an arena's select card shows (for a painted arena, everything
 * it has; for a streamed one, the strips in its window), at most `budget` ms
 * per call. True once it's all there.
 */
export function warmArena(scene: Phaser.Scene, arena: ArenaDef, budget: number): boolean {
  const { preview, ground } = arena;
  if (isPainted(ground)) return ground.warm(scene, budget);
  const top = Math.floor(preview.y - PREVIEW_H / 2);
  return GroundStreamer.warm(scene, ground, top, top + PREVIEW_H, budget);
}

/** How far above and below an arena's spawn its ground is warmed ahead (px): the first view and a little more. */
const SPAWN_REACH = 320;

/**
 * Warm the world map, then the ground round the spawn of the arena the
 * player chose last time, while they're on the menus, a few ms a frame, so
 * the arena select opens on a finished map and a run there starts at once.
 * Only a streamed arena's ground: a painted arena is built behind its own
 * loading screen when the player sets off for it (see ArenaLoadScene). The
 * work is shared: the arena select and the world carry on whatever this has
 * begun. True once it's ready.
 */
export function warmArenasAhead(scene: Phaser.Scene, budget: number): boolean {
  if (!warmWorldMap(scene, budget)) return false;
  const { ground, spawn } = arenaById(lastArena());
  return isPainted(ground) || GroundStreamer.warm(scene, ground, spawn.y - SPAWN_REACH, spawn.y + SPAWN_REACH, budget);
}

export function arenaById(id: string | undefined): ArenaDef {
  // The Home isn't on the select, but friends' invites and the Home button lead there.
  if (id === HOME_ARENA.id) return HOME_ARENA;
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
