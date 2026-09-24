import Phaser from 'phaser';
import { buildAllTextures } from '../art/textures';
import { buildPixelFont } from '../art/font';
import { WORLD_H, WORLD_W } from './WorldScene';

/** Generates every texture from code, then opens the home screen. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    buildPixelFont(this);
    buildAllTextures(this, WORLD_W, WORLD_H);
    this.scene.start('home');
    this.scene.launch('sound');
    this.scene.launch('fps');
  }
}
