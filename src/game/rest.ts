import type Phaser from 'phaser';

// Idle moments: a hero left standing still turns to the viewer and does its
// own little thing (the Jedi meditates, the Bard strums a tune), drawn as a
// one-shot `<look>_rest_down` animation on its sheet. Each hero asks `stand`
// for its idle key while it stands free; anything else it does in between (a
// step, a swing, a cast) breaks the calm, and so does a blow (`rouse`).

/** How long the hero must stand still before its first idle moment, ms. */
const REST_AFTER = 4000;
/** And between one idle moment and the next, ms. */
const REST_AGAIN = 9000;

interface Calm {
  /** The idle this calm belongs to: turning to face another way starts over. */
  idle: string;
  /** The game frame `stand` was last asked on: a skipped frame means the hero was busy. */
  frame: number;
  /** When the next idle moment may start (scene time). */
  next: number;
}

const calm = new WeakMap<Phaser.GameObjects.Sprite, Calm>();

const restOf = (idle: string): string => idle.slice(0, idle.lastIndexOf('_idle_')) + '_rest_down';

/**
 * The animation a free, standing hero should play: `idle` (its
 * `<look>_idle_<dir>`), or after a while still its idle moment, kept until it
 * has played through.
 */
export function stand(sprite: Phaser.GameObjects.Sprite, idle: string): string {
  const scene = sprite.scene;
  if (!scene) return idle;
  const frame = scene.game.loop.frame;
  const now = scene.time.now;
  const rest = restOf(idle);
  const cur = sprite.anims.currentAnim?.key;
  const c = calm.get(sprite);
  if (!c || c.idle !== idle || frame - c.frame > 1 || (cur !== idle && cur !== rest)) {
    calm.set(sprite, { idle, frame, next: now + REST_AFTER });
    return idle;
  }
  c.frame = frame;
  if (cur === rest) {
    if (sprite.anims.isPlaying) return rest;
    c.next = now + REST_AGAIN;
    return idle;
  }
  if (now >= c.next && scene.anims.exists(rest)) return rest;
  return idle;
}

/** A blow (or anything else that should snap the hero out of it): the idle moment ends and the wait starts over. */
export function rouse(sprite: Phaser.GameObjects.Sprite): void {
  calm.delete(sprite);
}
