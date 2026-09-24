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

const initial = viewSize();

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'app',
  backgroundColor: '#07080d',
  pixelArt: true,
  roundPixels: true,
  // Full device resolution, displayed at CSS size (see display.ts).
  scale: {
    mode: Phaser.Scale.NONE,
    ...initial,
    zoom: 1 / DPR,
  },
  render: { maxLights: 16, powerPreference: 'high-performance' },
  pipeline: { Lit: LitPipeline, Pixel: PixelPipeline } as unknown as Phaser.Types.Core.PipelineConfig,
  input: { activePointers: 3 },
  // Later scenes draw on top.
  scene: [BootScene, HomeScene, SelectScene, WorldScene, ShadeScene, UIScene, PauseScene, SoundScene, FpsScene],
});

// Fit the canvas to the window once per frame at most, and only when the
// size or resolution really changed: every resize makes each scene lay itself
// out again and the world recreate its ground render target. A phone can
// report an interim size at launch or on resume (bars still animating, the
// web view still settling) and then settle without another window resize, so
// the game element's own size, the pixel ratio and a few moments after launch
// are all checked too.
let fitted = `${initial.width}x${initial.height}@${DPR}`;
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
window.addEventListener('orientationchange', queueFit);
document.addEventListener('fullscreenchange', queueFit);
new ResizeObserver(queueFit).observe(document.getElementById('app')!);
window.addEventListener('load', queueFit);
for (const ms of [250, 1000, 2500]) setTimeout(queueFit, ms);
// The pixel ratio changes without a resize when the page is zoomed or moves
// to another screen; a media query on the current ratio notices.
const watchRatio = () => {
  const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  mq.addEventListener('change', () => {
    queueFit();
    watchRatio();
  }, { once: true });
};
watchRatio();

let quality = settings.values.quality;
settings.watch((s) => {
  if (s.quality === quality) return;
  quality = s.quality;
  setFastRender(quality === 'fast');
  fitCanvas();
});

(window as unknown as { game: Phaser.Game }).game = game;
