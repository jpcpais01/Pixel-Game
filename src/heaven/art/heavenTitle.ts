// The title's logo as a texture for the title screen.

import type Phaser from 'phaser';
import { heavenLogoBitmap } from './logo';

/** The "Heaven Lands" logo's texture key, made on first use. */
export function titleLogo(scene: Phaser.Scene): string {
  const key = 'hl_logo';
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, heavenLogoBitmap().toCanvas());
  return key;
}
