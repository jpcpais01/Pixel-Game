// The canvas renders at the device's real pixel density (capped at 3x) and is
// shown at CSS size, so every art pixel maps to a whole number of physical
// pixels. At CSS resolution the browser would stretch the canvas by the
// device pixel ratio (often 2.625 or 2.75 on phones), leaving art pixels
// uneven and blurry while things move.
export const DPR = Math.max(1, Math.min(3, Math.round((window.devicePixelRatio || 1) * 4) / 4));

export const viewSize = () => ({
  width: Math.round(window.innerWidth * DPR),
  height: Math.round(window.innerHeight * DPR),
});

/**
 * The world camera's zoom (device pixels per art pixel). Moving things snap
 * to device pixels rather than whole art pixels: sprites stay crisp because
 * every art pixel still covers whole device pixels, and motion stays smooth
 * because a step is a fraction of an art pixel.
 */
export const pixelGrid = { zoom: 1 };

export const snap = (v: number): number => Math.round(v * pixelGrid.zoom) / pixelGrid.zoom;
