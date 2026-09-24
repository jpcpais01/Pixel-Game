// The canvas renders at the device's exact pixel density and is shown at CSS
// size, so each canvas pixel is one physical pixel and every art pixel maps
// to a whole number of them. Rounding the ratio (say 2.625 up to 2.75) would
// make the browser resample the whole canvas, which blurs it. At CSS resolution the browser would stretch the canvas by the
// device pixel ratio (often 2.625 or 2.75 on phones), leaving art pixels
// uneven and blurry while things move. The world's ground is drawn at art
// resolution and scaled up (see PixelPipeline); everything else draws at
// full resolution.
export const DPR = Math.max(1, Math.min(4, window.devicePixelRatio || 1));

/** The world camera's zoom (device pixels per art pixel), set with the canvas size. */
export const pixelGrid = { zoom: 2 };

/** Device pixels per art pixel in the world: about 190 art pixels on the short side. */
export const worldZoom = (width: number, height: number): number => Math.max(2, Math.floor(Math.min(width, height) / 190));

/** The canvas size in device pixels. Also sets the world zoom for that size. */
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
