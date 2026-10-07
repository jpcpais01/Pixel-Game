// Heaven Lands' endless lands: the registry, and what the world asks of it.
// Wire it in (src/heaven/wire.ts):
//   cozy.arena = (id) => landArena(id);
//   cozy.land = (world, arena, ground, view) => buildLand(world, arena, ground, view);
// A new land: a folder of its own beside shore/ (gen.ts with its LandGen,
// art.ts with its sheets, index.ts with its LandDef), its gen and sheets in
// gens.ts, its LandDef in LANDS below.

import type Phaser from 'phaser';
import type { CozyLand } from '../../game/cozy';
import type { WorldScene } from '../../scenes/WorldScene';
import type { ArenaDef } from '../../world/arenas';
import { landArenaDef } from './arena';
import { LandRuntime } from './LandRuntime';
import { LandWorld } from './landWorld';
import { SHORE } from './shore';
import type { LandDef } from './types';

export const LANDS: LandDef[] = [SHORE];

/** Each land's gen with its layouts kept, shared by the arena's feet and the runtime. */
const worlds = new Map<string, LandWorld>();
const arenas = new Map<string, ArenaDef>();

function worldOf(def: LandDef): LandWorld {
  let w = worlds.get(def.id);
  if (!w) worlds.set(def.id, (w = new LandWorld(def.gen())));
  return w;
}

/** The arena of land `id`, or undefined if it isn't one of the lands. */
export function landArena(id: string): ArenaDef | undefined {
  const had = arenas.get(id);
  if (had) return had;
  const def = LANDS.find((l) => l.id === id);
  if (!def) return undefined;
  const a = landArenaDef(def, worldOf(def));
  arenas.set(id, a);
  return a;
}

/** Land `id`'s living parts, stood up in the world (null for any other arena). */
export function buildLand(world: WorldScene, id: string, ground: (img: Phaser.GameObjects.Image) => Phaser.GameObjects.Image, _view: Phaser.Geom.Rectangle): CozyLand | null {
  const def = LANDS.find((l) => l.id === id);
  if (!def) return null;
  return new LandRuntime(world, def, worldOf(def), ground);
}
