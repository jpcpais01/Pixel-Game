import type Phaser from 'phaser';
import { treeSwayTextures } from '../art/textures';
import { TREE_SWAY_FRAMES, TREE_VARIANTS } from '../art/trees';

// The trees' sway is built in the background, a few ms a frame, by whichever
// world asks first (see art/textures.ts, `treeSwayTextures`). Until it's
// ready the trees stand still on their first frame, which the sway starts on.

/** ms a frame spent building the sway. */
const BUDGET = 3;

let job: Generator<void, void, void> | null = null;

/** Build a little more of the sway; true once every tree's animation exists. */
export function treeSwayReady(scene: Phaser.Scene): boolean {
  if (!job && scene.anims.exists(`tree_pine${TREE_VARIANTS - 1}`)) return true;
  job ??= treeSwayTextures(scene);
  const t0 = performance.now();
  while (performance.now() - t0 < BUDGET) {
    if (job.next().done) {
      job = null;
      return true;
    }
  }
  return false;
}

/** Start a tree swaying, at a random point of its sway and a slightly different pace from its neighbours. */
export function sway(sprite: Phaser.GameObjects.Sprite, anim: string): void {
  sprite.play({ key: anim, startFrame: Math.floor(Math.random() * TREE_SWAY_FRAMES) });
  sprite.anims.timeScale = 0.8 + Math.random() * 0.4;
}
