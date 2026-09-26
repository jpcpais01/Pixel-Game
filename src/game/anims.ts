import Phaser from 'phaser';

/**
 * Turn a hero mid-move: play `key` (a `<look>_<move>_<dir>` animation) from
 * the frame the sprite is on when it is already playing that move facing
 * another way, so an aim that swings round doesn't restart the draw or the
 * throw. Anything else (a walk or idle, another move) starts `key` from its
 * first frame. Phaser throws, freezing the game, if asked to start past an
 * animation's last frame, so the start is always kept within `key`'s frames.
 */
export function turnMidMove(sprite: Phaser.GameObjects.Sprite, key: string): void {
  const next = sprite.anims.animationManager.get(key);
  if (!next || next.frames.length === 0) return;
  const cur = sprite.anims.currentAnim;
  const frame = sprite.anims.currentFrame;
  const move = (k: string) => k.slice(0, k.lastIndexOf('_'));
  const same = !!cur && !!frame && move(cur.key) === move(key);
  const at = same ? Phaser.Math.Clamp(frame!.index - 1, 0, next.frames.length - 1) : 0;
  sprite.play({ key, startFrame: at });
}
