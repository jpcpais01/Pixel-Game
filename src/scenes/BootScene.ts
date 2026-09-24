import Phaser from 'phaser';
import { buildAllTextures } from '../art/textures';
import { buildPixelFont } from '../art/font';
import { GroundStreamer } from '../world/GroundStreamer';
import { PLAZA_Y, WORLD_H } from '../world/layout';

/** Generates every texture from code, then opens the home screen. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    buildPixelFont(this);
    buildAllTextures(this);
    // The plaza's ground, where every game starts; the rest streams in as the hero walks.
    GroundStreamer.prebuild(this, PLAZA_Y - 64, WORLD_H);
    this.scene.start('home');
    this.scene.launch('sound');
    this.scene.launch('fps');
  }
}
