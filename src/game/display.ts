// The canvas renders at the device's exact pixel density and is shown at CSS
// size, so each canvas pixel is a whole number of physical pixels and so is
// every art pixel. Rounding the ratio (say 2.625 up to 2.75) would make the
// browser resample the whole canvas, which blurs it. The world's ground is
// drawn at art resolution and scaled up (see PixelPipeline); everything else
// draws at canvas resolution.
const DEVICE_DPR = Math.max(1, Math.min(4, window.devicePixelRatio || 1));

/**
 * Canvas pixels per CSS pixel. At full quality that is one canvas pixel per
 * device pixel. Fast quality makes each canvas pixel a whole square of
 * device pixels (2x2 on most phones), so the browser still scales the canvas
 * up evenly and the art stays crisp, with a quarter of the pixels to draw.
 */
export let DPR = DEVICE_DPR;

/** Pick the render resolution; call `viewSize` afterwards for the new canvas size. */
export function setFastRender(fast: boolean): void {
  DPR = fast ? DEVICE_DPR / Math.ceil(DEVICE_DPR / 1.5) : DEVICE_DPR;
}

/** The world camera's zoom (device pixels per art pixel), set with the canvas size. */
export const pixelGrid = { zoom: 2 };

/**
 * Canvas pixels per art pixel in the world, for a canvas of this size: about
 * 250 art pixels on the short side, the same framing on Fast and Full. It is
 * picked in device pixels, rounded to the nearest multiple of the device
 * pixels per canvas pixel, so the world zoom never depends on the graphics
 * setting. Rounding to the nearest (rather than down) keeps it steady when the
 * browser's bars come and go and the height changes a little.
 */
export const worldZoom = (width: number, height: number): number => {
  const k = Math.round(DEVICE_DPR / DPR);
  const device = (Math.min(width, height) * DEVICE_DPR) / DPR;
  return Math.max(1, Math.round(device / 250 / k), Math.ceil(2 / k));
};

/** The canvas size in canvas pixels. Also sets the world zoom for that size. */
export const viewSize = () => {
  const width = Math.round(window.innerWidth * DPR);
  const height = Math.round(window.innerHeight * DPR);
  pixelGrid.zoom = worldZoom(width, height);
  return { width, height };
};

/**
 * Moving things snap to device pixels rather than whole art pixels: sprites
 * stay crisp because every art pixel still covers whole device pixels, and
 * motion stays smooth because a step is a fraction of an art pixel.
 */
export const snap = (v: number): number => Math.round(v * pixelGrid.zoom) / pixelGrid.zoom;

/** Device pixels per art pixel on the menus: about 180 art pixels on the short side. */
export const menuZoom = (width: number, height: number): number => Math.max(2, Math.floor(Math.min(width, height) / 180));
