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
