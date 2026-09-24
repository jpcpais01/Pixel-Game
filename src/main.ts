import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { LitPipeline } from './game/LitPipeline';
import { PixelPipeline } from './game/PixelPipeline';
import { DPR, setFastRender, viewSize } from './game/display';
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
setFastRender(settings.values.quality === 'fast');

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
  pipeline: { Lit: LitPipeline, Pixel: PixelPipeline } as unknown as Phaser.Types.Core.PipelineConfig,
  input: { activePointers: 3 },
  // Later scenes draw on top.
  scene: [BootScene, HomeScene, SelectScene, WorldScene, ShadeScene, UIScene, PauseScene, SoundScene, FpsScene],
});

const fitCanvas = () => {
  const { width, height } = viewSize();
  game.scale.setZoom(1 / DPR);
  game.scale.resize(width, height);
};
window.addEventListener('resize', fitCanvas);

let quality = settings.values.quality;
settings.watch((s) => {
  if (s.quality === quality) return;
  quality = s.quality;
  setFastRender(quality === 'fast');
  fitCanvas();
});

(window as unknown as { game: Phaser.Game }).game = game;
