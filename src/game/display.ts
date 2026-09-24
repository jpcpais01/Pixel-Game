// The canvas renders at the device's exact pixel density and is shown at CSS
// size, so each canvas pixel is a whole number of physical pixels and so is
// every art pixel. Rounding the ratio (say 2.625 up to 2.75) would make the
// browser resample the whole canvas, which blurs it. The world's ground is
// drawn at art resolution and scaled up (see PixelPipeline); everything else
// draws at canvas resolution.
// The device's pixel ratio is read afresh with every size: a phone's web
// view can report a different one once the page has settled.
const deviceDpr = () => Math.max(1, Math.min(4, window.devicePixelRatio || 1));
let fastRender = false;

/**
 * Canvas pixels per CSS pixel. At full quality that is one canvas pixel per
 * device pixel. Fast quality makes each canvas pixel a whole square of
 * device pixels (2x2 on most phones), so the browser still scales the canvas
 * up evenly and the art stays crisp, with a quarter of the pixels to draw.
 */
export let DPR = deviceDpr();
/** Device pixels per canvas pixel: 1 at full quality, usually 2 on Fast. */
let devicePerCanvas = 1;

function updateDpr(): void {
  const d = deviceDpr();
  devicePerCanvas = fastRender ? Math.ceil(d / 1.5) : 1;
  DPR = d / devicePerCanvas;
}

/** Pick the render resolution; call `viewSize` afterwards for the new canvas size. */
export function setFastRender(fast: boolean): void {
  fastRender = fast;
  updateDpr();
}

/** The world camera's zoom (device pixels per art pixel), set with the canvas size. */
export const pixelGrid = { zoom: 2 };

/**
 * Canvas pixels per art pixel for a canvas of this size, in the world and on
 * every menu alike: about 250 art pixels on the short side, the same framing
 * on Fast and Full. It is picked in device pixels, rounded to the nearest
 * multiple of the device pixels per canvas pixel, so it never depends on the
 * graphics setting. Rounding to the nearest (rather than down) keeps it steady
 * when the browser's bars come and go and the height changes a little.
 */
export const artZoom = (width: number, height: number): number => {
  const k = devicePerCanvas;
  const device = Math.min(width, height) * k;
  return Math.max(Math.round(device / 250 / k), Math.ceil(2 / k));
};

/**
 * The canvas size in canvas pixels: the game element's own size, which is
 * what the canvas fills (the page may be inset by safe areas). Also updates
 * the pixel ratio and sets the world zoom for that size.
 */
export const viewSize = () => {
  updateDpr();
  const app = document.getElementById('app');
  const rect = app?.getBoundingClientRect();
  const cssW = rect && rect.width > 0 ? rect.width : window.innerWidth;
  const cssH = rect && rect.height > 0 ? rect.height : window.innerHeight;
  const width = Math.round(cssW * DPR);
  const height = Math.round(cssH * DPR);
  pixelGrid.zoom = artZoom(width, height);
  return { width, height };
};

/**
 * Moving things snap to device pixels rather than whole art pixels: sprites
 * stay crisp because every art pixel still covers whole device pixels, and
 * motion stays smooth because a step is a fraction of an art pixel.
 */
export const snap = (v: number): number => Math.round(v * pixelGrid.zoom) / pixelGrid.zoom;

/** Canvas pixels per art pixel on the menus: the same as the world's. */
export const menuZoom = artZoom;
