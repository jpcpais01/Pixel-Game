import Phaser from 'phaser';
import { isBaked } from '../art/canvas';

/**
 * The loading screen spent most of its time in one line of Phaser.
 *
 * `textures.addCanvas` makes a CanvasTexture, a texture meant to be drawn on
 * from code, and its constructor reads the whole canvas back with
 * `getImageData` to keep a copy of the pixels. On a phone a canvas lives on
 * the GPU, so every read is a stall that waits for the GPU and copies the
 * image back, and the copy then stays in memory for good. The game makes a
 * few hundred textures at boot and a few dozen per arena, and never draws on
 * any of them again.
 *
 * So a canvas that holds finished art becomes a plain texture instead, the
 * same upload to the GPU without the read back. Canvases Phaser makes for
 * itself (tile sprites, `createCanvas`) still get the CanvasTexture they need.
 */
export function bakeArtTextures(): void {
  type Manager = Phaser.Textures.TextureManager;
  const proto = Phaser.Textures.TextureManager.prototype as Manager;
  const addCanvas = proto.addCanvas;
  proto.addCanvas = function (this: Manager, key: string, source: HTMLCanvasElement, skipCache?: boolean) {
    if (skipCache || !isBaked(source)) return addCanvas.call(this, key, source, skipCache);
    return this.addImage(key, source as unknown as HTMLImageElement) as unknown as Phaser.Textures.CanvasTexture;
  };
}
