import Phaser from 'phaser';
import { buildAllTextures } from '../art/textures';
import { WORLD_H, WORLD_W } from './WorldScene';

/** Generates every texture from code, then starts the game. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    buildAllTextures(this, WORLD_W, WORLD_H);
    this.scene.start('world');
    this.scene.launch('ui');
  }
}
