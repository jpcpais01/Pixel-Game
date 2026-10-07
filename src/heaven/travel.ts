// Going places: from the menus into a place's world (behind its loading
// screen when it's painted), and the panel for going somewhere with friends.

import type Phaser from 'phaser';
import { arenaById } from '../world/arenas';
import { enterArena, needsLoading } from '../scenes/ArenaLoadScene';
import { openOnlineForm } from '../ui/onlineForm';
import { placeById } from './places';

/** The character id the world is started with: the wanderer stands in for every hero (see cozy.character). */
export const WANDERER = 'wanderer';

let leaving = false;

/** Fade out of `scene` and into the place. */
export function travel(scene: Phaser.Scene, id: string, fade = true): void {
  if (leaving) return;
  const arena = arenaById(placeById(id).arena).id;
  const go = () => {
    leaving = false;
    for (const k of ['home', 'atlas', 'creator']) if (k !== scene.scene.key && scene.scene.isActive(k)) scene.scene.stop(k);
    if (needsLoading(scene, arenaById(arena))) scene.scene.start('arenaload', { character: WANDERER, arena });
    else enterArena(scene, WANDERER, arena);
  };
  if (!fade) return go();
  leaving = true;
  scene.cameras.main.fadeOut(450, 12, 14, 26);
  scene.cameras.main.once('camerafadeoutcomplete', go);
}

/** Start a room in a place, or join a friend's (wherever they are). Calls `done` if the panel is closed. */
export function together(scene: Phaser.Scene, id: string, done: () => void = () => {}): void {
  const arena = arenaById(placeById(id).arena);
  openOnlineForm(arena, WANDERER, (room) => travel(scene, room.arena), done);
}
