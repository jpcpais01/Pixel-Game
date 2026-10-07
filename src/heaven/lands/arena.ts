// A land as the world's arena (see world/arenas.ts ArenaDef, and
// world/forestArena.ts for the Everwood, which does the same): a painted
// ground as big as the land's world, which the land's runtime streams itself,
// its feet from the generator and what stands, no monsters, no scenery of
// the old kind.

import type Phaser from 'phaser';
import type { ArenaDef } from '../../world/arenas';
import { warmSheets } from './LandRuntime';
import type { LandWorld } from './landWorld';
import { LAND_WORLD, type LandDef } from './types';

/**
 * The texture the minimap (scenes/MapScene.ts) waits for before it paints a
 * painted arena's map. It never exists: a land is endless, and drawing a map
 * the size of its world would take all the memory there is, so the minimap
 * waits on it quietly instead.
 */
const NO_MAP = '__land_no_map';

export function landArenaDef(def: LandDef, land: LandWorld): ArenaDef {
  const spawn = land.gen.spawn();
  return {
    id: def.id,
    name: def.name,
    blurb: def.blurb,
    accent: def.accent,
    ground: {
      painted: true,
      w: LAND_WORLD,
      h: LAND_WORLD,
      // Its props' sheets; the ground itself is painted as it's walked.
      warm: (scene: Phaser.Scene, budget: number) => warmSheets(scene, def.sheets(), budget),
      layers: [{ key: NO_MAP, x: 0, y: 0 }],
    },
    spawn,
    monsters: [],
    scenery: () => ({ trees: [], props: [], rays: [], colliders: [] }),
    walkable: (x, y) => land.walkable(x, y),
    drift: { ...def.drift, where: () => true },
    dayNight: def.dayNight,
    daylight: def.daylight,
    preview: { x: spawn.x, y: spawn.y, sprites: () => [] },
  };
}
