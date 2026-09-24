import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { setupApp } from './pwa';

setupApp();

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'app',
  backgroundColor: '#07080d',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: { maxLights: 16 },
  input: { activePointers: 3 },
  scene: [BootScene, WorldScene, UIScene],
});

(window as unknown as { game: Phaser.Game }).game = game;
