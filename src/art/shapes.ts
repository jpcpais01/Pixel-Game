// Small drawing helpers on top of PixelCanvas, shared by the heroes' skins.

import { sphere, type DrawOpts, type Material, type NormalFn, type PixelCanvas } from './pixel';

/**
 * Fill a polygon (points in drawing coordinates, in order round its edge):
 * a pixel is filled when its centre lies inside. The normal callback gets
 * `t` and `u`, -1..1 across and 0..1 down the polygon's bounding box.
 */
export function poly(c: PixelCanvas, pts: [number, number][], m: Material, normal: NormalFn = (_x, _y, t, u) => sphere(t * 0.8, u - 0.5, 1), o: DrawOpts = {}): void {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs));
  const x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  const w = Math.max(0.001, x1 - x0);
  const h = Math.max(0.001, y1 - y0);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) c.px(x, y, m, normal(x, y, ((px - x0) / w) * 2 - 1, (py - y0) / h), o);
    }
  }
}

/**
 * Slide one row of the whole canvas sideways by `dx` pixels (canvas
 * coordinates, not the figure's), for a glitch that tears the image. What
 * slides off the edge is lost; what it leaves behind is empty.
 */
export function shiftRow(c: PixelCanvas, y: number, dx: number): void {
  if (dx === 0 || y < 0 || y >= c.h) return;
  const w = c.w;
  const row = y * w;
  const order = dx > 0 ? [...Array(w).keys()].reverse() : [...Array(w).keys()];
  for (const x of order) {
    const s = x - dx;
    const d = row + x;
    if (s < 0 || s >= w) {
      c.mat[d] = -1;
      for (let k = 0; k < 4; k++) c.light[d * 4 + k] = 0;
      continue;
    }
    const i = row + s;
    c.mat[d] = c.mat[i];
    c.layer[d] = c.layer[i];
    c.nx[d] = c.nx[i];
    c.ny[d] = c.ny[i];
    c.nz[d] = c.nz[i];
    c.bias[d] = c.bias[i];
    c.glow[d] = c.glow[i];
    for (let k = 0; k < 4; k++) c.light[d * 4 + k] = c.light[i * 4 + k];
  }
}
