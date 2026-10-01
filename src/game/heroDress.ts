// The hero wears their set: with four or more pieces of one boss set on,
// the hero's sprites (body, glow, sun shadow, hit flash) show the look's
// dressed sheet (art/dress.ts) instead of its own.
//
// The dressed sheet has the look's frames under the same names but no
// animations of its own, so the heroes go on playing their look's
// animations untouched; after the scene's update, before it's drawn, each
// sprite is moved onto the dressed texture at the frame it's on. No hero
// needs to know.

import Phaser from 'phaser';
import { dressedKey } from '../art/dress';
import { heroLayer, wantDressed } from '../art/heroLoader';
import type { SetId } from './gear';

export class HeroDress {
  /** The set worn, or null for the look's own sheet. */
  set: SetId | null = null;
  private readonly sprites: Phaser.GameObjects.Sprite[];

  /** `made`: what the hero's spawn added to the scene; its sprites on hero sheets are the ones dressed. */
  constructor(
    private readonly scene: Phaser.Scene,
    body: Phaser.GameObjects.Sprite,
    made: Phaser.GameObjects.GameObject[],
  ) {
    const own = made.filter((o): o is Phaser.GameObjects.Sprite => o instanceof Phaser.GameObjects.Sprite && !!heroLayer(o.texture.key));
    this.sprites = [...new Set([body, ...own])];
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.update, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private update(): void {
    for (const s of this.sprites) {
      if (!s.active || !s.frame) continue;
      const key = s.texture.key;
      const at = heroLayer(key);
      if (!at) continue;
      // A shapeshifter's other form is another look: it's dressed in its turn.
      const want = this.set ? dressedKey(at.look, this.set) + at.layer : at.look + at.layer;
      if (want === key || (this.set && !wantDressed(at.look, this.set))) continue;
      s.setTexture(want, s.frame.name);
    }
  }
}
