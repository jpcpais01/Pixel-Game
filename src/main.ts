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

// Fit the canvas to the window once per frame at most, and only when the
// size or resolution really changed: every resize makes each scene lay itself
// out again and the world recreate its ground render target. Resuming the
// app can report an interim size (bars still animating) and then settle
// without another window resize, so the page's own size is also watched.
let fitted = '';
let fitQueued = false;
const fitCanvas = () => {
  fitQueued = false;
  const { width, height } = viewSize();
  const key = `${width}x${height}@${DPR}`;
  if (key === fitted) return;
  fitted = key;
  game.scale.setZoom(1 / DPR);
  game.scale.resize(width, height);
};
const queueFit = () => {
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(fitCanvas);
};
window.addEventListener('resize', queueFit);
window.visualViewport?.addEventListener('resize', queueFit);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) queueFit();
});
new ResizeObserver(queueFit).observe(document.getElementById('app')!);
fitted = (() => {
  const { width, height } = viewSize();
  return `${width}x${height}@${DPR}`;
})();

let quality = settings.values.quality;
settings.watch((s) => {
  if (s.quality === quality) return;
  quality = s.quality;
  setFastRender(quality === 'fast');
  fitCanvas();
});

(window as unknown as { game: Phaser.Game }).game = game;
