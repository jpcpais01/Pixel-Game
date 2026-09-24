import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { LitPipeline } from './game/LitPipeline';
import { DPR, viewSize } from './game/display';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'app',
  backgroundColor: '#07080d',
  pixelArt: true,
  roundPixels: true,
  // Full device resolution, displayed at CSS size (see display.ts).
  scale: {
    mode: Phaser.Scale.NONE,
    ...viewSize(),
    zoom: 1 / DPR,
  },
  render: { maxLights: 16 },
  pipeline: { Lit: LitPipeline } as unknown as Phaser.Types.Core.PipelineConfig,
  input: { activePointers: 3 },
  scene: [BootScene, WorldScene, UIScene],
});

window.addEventListener('resize', () => {
  const { width, height } = viewSize();
  game.scale.resize(width, height);
});

(window as unknown as { game: Phaser.Game }).game = game;
