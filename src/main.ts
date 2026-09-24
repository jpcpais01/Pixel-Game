import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { LitPipeline } from './game/LitPipeline';
import { DPR, viewSize } from './game/display';
import { SoundScene } from './scenes/SoundScene';
import { HomeScene } from './scenes/HomeScene';
import { SelectScene } from './scenes/SelectScene';
import { FpsScene } from './scenes/FpsScene';
import { ShadeScene } from './scenes/ShadeScene';
import { PauseScene } from './scenes/PauseScene';
import { settings } from './game/settings';
import { sound } from './audio';
import { setupApp } from './pwa';

setupApp();
sound.init();
settings.watch((s) => sound.setVolumes(s.music, s.sfx));

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
  // Later scenes draw on top.
  scene: [BootScene, HomeScene, SelectScene, WorldScene, ShadeScene, UIScene, PauseScene, SoundScene, FpsScene],
});

window.addEventListener('resize', () => {
  const { width, height } = viewSize();
  game.scale.resize(width, height);
});

(window as unknown as { game: Phaser.Game }).game = game;
