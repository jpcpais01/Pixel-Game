// Plugs Heaven Lands into the old game's engine (see game/cozy.ts): the
// wanderer stands in for every hero, the HUD gets emote buttons, chests hold
// seeds, and the places keep their Heaven Lands names.

import { characterById, type CharacterDef } from '../game/characters';
import { cozy } from '../game/cozy';
import { CROPS } from '../game/farm';
import { sound } from '../audio';
import { snap } from '../game/display';
import { lookFields, lookFromFields } from './look';
import { profile } from './profile';
import { Wanderer } from './Wanderer';
import { EmoteButtons } from './ui/emoteButtons';
import { PLACES } from './places';
import { buildLand, landArena } from './lands';
import { landMap } from './lands/landMap';

/** Seed packets in a chest: how many, and the odds a packet is a magic seed rather than a wild one. */
const CHEST_SEEDS: [number, number] = [2, 3];
const MAGIC_ODDS = 0.25;

export function wireCozy(): void {
  // The wanderer borrows the first hero's bones (its kit and type keep the
  // engine's stats and lookups happy); everything it shows is its own.
  const base = characterById(undefined);
  const def = (kit?: string, look?: string): CharacterDef => {
    const theirs = kit !== undefined;
    return {
      ...base,
      name: theirs ? 'Wanderer' : profile.name,
      look: theirs ? (look ?? '') : lookFields(profile.look).look,
      accent: 0xffd8a8,
      spawn: (world, x, y) => new Wanderer(world, x, y, theirs ? lookFromFields(kit, look) : profile.look, !theirs),
    };
  };
  cozy.on = true;
  cozy.character = def;
  cozy.spawn = (world, x, y) => new Wanderer(world, x, y, profile.look, true);
  cozy.me = () => ({ name: profile.name, ...lookFields(profile.look) });
  cozy.hud = (scene) => new EmoteButtons(scene);
  cozy.arena = (id) => landArena(id);
  cozy.land = (world, arena, ground, view) => buildLand(world, arena, ground, view);
  cozy.map = (id) => landMap(id);
  cozy.placeName = (arena) => PLACES.find((p) => p.arena === arena)?.name ?? arena;
  cozy.treasure = (world, x, y) => {
    const wild = CROPS.filter((c) => c.kind === 'wild');
    const magic = CROPS.filter((c) => c.kind === 'magic');
    const n = CHEST_SEEDS[0] + Math.floor(Math.random() * (CHEST_SEEDS[1] - CHEST_SEEDS[0] + 1));
    for (let i = 0; i < n; i++) {
      const pool = Math.random() < MAGIC_ODDS && magic.length ? magic : wild;
      world.dropLoot({ kind: 'seed', id: pool[Math.floor(Math.random() * pool.length)].id }, x, y);
    }
    sound.lootFall(world.pan(x));
    world.debris([0xfff0a0, 0xffd060, 0xffffff], snap(x), snap(y), 24, y + 20, 'burst');
  };
}
