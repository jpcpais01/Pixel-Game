// Heaven Lands: the game. The same engine as Myths and Legends (its world,
// Home, Everwood, art and online play) with the fighting taken out, the
// wanderer as the one character, and its own title, Atlas and creator.

import Phaser from 'phaser';
import { wireCozy } from './wire';
import { HeavenBoot } from './scenes/HeavenBoot';
import { TitleScene } from './scenes/TitleScene';
import { AtlasScene } from './scenes/AtlasScene';
import { CreatorScene } from './scenes/CreatorScene';
import { WorldScene } from '../scenes/WorldScene';
import { UIScene } from '../scenes/UIScene';
import { MapScene } from '../scenes/MapScene';
import { ShadeScene } from '../scenes/ShadeScene';
import { PauseScene } from '../scenes/PauseScene';
import { FishScene } from '../scenes/FishScene';
import { ForestLoadScene } from '../scenes/ForestLoadScene';
import { ArenaLoadScene } from '../scenes/ArenaLoadScene';
import { SoundScene } from '../scenes/SoundScene';
import { FpsScene } from '../scenes/FpsScene';
import { LitPipeline } from '../game/LitPipeline';
import { PixelPipeline } from '../game/PixelPipeline';
import { SkyPipeline } from '../game/SkyPipeline';
import { DPR, setRenderQuality, setViewZoom, viewSize } from '../game/display';
import { settings } from '../game/settings';
import { sound } from '../audio';
import { setupApp } from '../pwa';
import { streamVertexBuffers } from '../game/streamBuffers';
import { bakeArtTextures } from '../game/bakedTextures';
import { cacheGraphics } from '../game/graphicsCache';
import { afterLoad } from '../loaded';
import { installPointer } from '../ui/pointer';

wireCozy();
setupApp();
streamVertexBuffers();
bakeArtTextures();
cacheGraphics();
sound.init();
settings.watch((s) => sound.setVolumes(s.music, s.sfx));
setRenderQuality(settings.values.quality);
setViewZoom(settings.values.zoom);

const initial = viewSize();

// The Screen shake setting stills every camera shake, as in Myths.
const cameraShake = Phaser.Cameras.Scene2D.Camera.prototype.shake;
Phaser.Cameras.Scene2D.Camera.prototype.shake = function (this: Phaser.Cameras.Scene2D.Camera, ...args: Parameters<typeof cameraShake>) {
  return settings.values.shake ? cameraShake.apply(this, args) : this;
};

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'app',
  backgroundColor: '#1a1626',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE, ...initial, zoom: 1 / DPR },
  render: { maxLights: 16, powerPreference: 'high-performance', batchSize: 512 },
  pipeline: { Lit: LitPipeline, Pixel: PixelPipeline, Sky: SkyPipeline } as unknown as Phaser.Types.Core.PipelineConfig,
  input: { activePointers: 3 },
  disableContextMenu: true,
  // Later scenes draw on top.
  scene: [HeavenBoot, TitleScene, AtlasScene, CreatorScene, WorldScene, ShadeScene, UIScene, MapScene, FishScene, ForestLoadScene, ArenaLoadScene, PauseScene, SoundScene, FpsScene],
});
installPointer(game);

// Fit the canvas to the window when its size or resolution really changes (see src/main.ts).
let fitted = `${initial.width}x${initial.height}@${DPR}z${settings.values.zoom}`;
let fitQueued = false;
const fitCanvas = () => {
  fitQueued = false;
  const { width, height } = viewSize();
  const key = `${width}x${height}@${DPR}z${settings.values.zoom}`;
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
afterLoad(queueFit);
for (const ms of [250, 1000, 2500]) setTimeout(queueFit, ms);
const watchRatio = () => {
  const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  mq.addEventListener('change', () => {
    queueFit();
    watchRatio();
  }, { once: true });
};
watchRatio();

let quality = settings.values.quality;
let zoom = settings.values.zoom;
settings.watch((s) => {
  if (s.quality === quality && s.zoom === zoom) return;
  quality = s.quality;
  zoom = s.zoom;
  setRenderQuality(quality);
  setViewZoom(zoom);
  fitCanvas();
});

// A device that can't keep up steps down a graphics level after five slow seconds in the world.
let slowFor = 0;
game.events.on(Phaser.Core.Events.POST_STEP, () => {
  if (settings.values.quality === 'low' || !game.scene.isActive('world') || document.hidden) {
    slowFor = 0;
    return;
  }
  const dt = game.loop.rawDelta;
  if (dt > 250) return;
  slowFor = dt > 1000 / 30 ? slowFor + dt : Math.max(0, slowFor - dt * 2);
  if (slowFor > 5000) {
    slowFor = 0;
    settings.set('quality', settings.values.quality === 'full' ? 'fast' : 'low');
  }
});

(window as unknown as { game: Phaser.Game }).game = game;
