// The canvas renders at the device's real pixel density (capped at 3x) and is
// shown at CSS size, so every art pixel maps to a whole number of physical
// pixels. At CSS resolution the browser would stretch the canvas by the
// device pixel ratio (often 2.625 or 2.75 on phones), leaving art pixels
// uneven and blurry while things move. The world itself is drawn at art
// resolution and scaled up (see PixelPipeline); the HUD and menus draw at
// full resolution.
export const DPR = Math.max(1, Math.min(3, Math.round((window.devicePixelRatio || 1) * 4) / 4));

/** The world camera's zoom (device pixels per art pixel), set with the canvas size. */
export const pixelGrid = { zoom: 2 };

/** Device pixels per art pixel in the world: about 190 art pixels on the short side. */
export const worldZoom = (width: number, height: number): number => Math.max(2, Math.floor(Math.min(width, height) / 190));

/**
 * The canvas size in device pixels, rounded up to whole art pixels. The world
 * renders at art resolution and is scaled up by exactly `pixelGrid.zoom` (see
 * PixelPipeline), which only stays even when the canvas divides evenly. The
 * few extra device pixels hang off the right and bottom edges.
 */
export const viewSize = () => {
  const w = Math.round(window.innerWidth * DPR);
  const h = Math.round(window.innerHeight * DPR);
  const z = worldZoom(w, h);
  pixelGrid.zoom = z;
  return { width: Math.ceil(w / z) * z, height: Math.ceil(h / z) * z };
};

/** Moving things snap to whole art pixels, the grid the world is rendered on. */
export const snap = (v: number): number => Math.round(v);

/** Device pixels per art pixel on the menus: about 180 art pixels on the short side. */
export const menuZoom = (width: number, height: number): number => Math.max(2, Math.floor(Math.min(width, height) / 180));
