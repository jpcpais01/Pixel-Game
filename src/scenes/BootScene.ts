import Phaser from 'phaser';
import { buildAllTextures } from '../art/textures';
import { buildPixelFont } from '../art/font';
import { GroundStreamer } from '../world/GroundStreamer';
import { CLEARING_GROUND } from '../world/clearing';

/** Generates every texture from code, then opens the home screen. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    buildPixelFont(this);
    buildAllTextures(this);
    // The first arena's ground; the arena select warms up the others while the player picks.
    GroundStreamer.prebuild(this, CLEARING_GROUND, 0, CLEARING_GROUND.h);
    this.scene.start('home');
    this.scene.launch('sound');
    this.scene.launch('fps');
  }
}
