// App icon: the wizard's portrait against a dithered night sky, lit by the
// glow of his staff crystal. Drawn on a small logical grid and scaled up by an
// integer factor, so every icon size keeps crisp square pixels.

import { hex, type RGB } from './pixel';
import { MAGIC_CORE, MAGIC_DEEP, MAGIC_HOT, MAGIC_MID } from './palette';
import { ANIMS, drawWizardFrame, FRAME_W } from './wizard';

export interface IconSpec {
  /** Output file name. */
  name: string;
  /** Output size in real pixels. */
  size: number;
  /** Logical grid size; size must be a multiple of it. */
  grid: number;
  /** 'rounded' cuts pixel-stepped corners; 'full' bleeds to the edge (maskable, iOS). */
  shape: 'rounded' | 'full';
  purpose: 'any' | 'maskable';
}

export const ICONS: IconSpec[] = [
  { name: 'icon-512.png', size: 512, grid: 32, shape: 'rounded', purpose: 'any' },
  { name: 'icon-192.png', size: 192, grid: 32, shape: 'rounded', purpose: 'any' },
  // Maskable icons get a wider grid so the crystal survives a circular mask
  // (safe zone: the centre circle, 80% of the width).
  { name: 'maskable-480.png', size: 480, grid: 40, shape: 'full', purpose: 'maskable' },
  { name: 'maskable-200.png', size: 200, grid: 40, shape: 'full', purpose: 'maskable' },
  { name: 'apple-touch-icon.png', size: 180, grid: 36, shape: 'full', purpose: 'any' },
  { name: 'favicon-32.png', size: 32, grid: 32, shape: 'rounded', purpose: 'any' },
];

// Night sky, darkest to lightest. Cool and violet, like the robe's shadows.
const SKY = ['#0a0918', '#120f2a', '#1a1640', '#231d56', '#2d266c', '#3a3284'].map(hex);
const STAR = hex('#cfd8ff');
const RIM = hex('#6468d8');
const EDGE = hex('#07080d');

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const hash = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const add = (a: RGB, b: RGB, k: number): RGB => [
  Math.min(255, a[0] + b[0] * k),
  Math.min(255, a[1] + b[1] * k),
  Math.min(255, a[2] + b[2] * k),
];

/** Is (x, y) outside a pixel-stepped rounded square of size n? */
function cornerCut(x: number, y: number, n: number, r: number): boolean {
  const cx = x < r ? r - x - 0.5 : x >= n - r ? x - (n - r) + 0.5 : 0;
  const cy = y < r ? r - y - 0.5 : y >= n - r ? y - (n - r) + 0.5 : 0;
  return cx > 0 && cy > 0 && cx * cx + cy * cy > r * r;
}

/** Render one icon to RGBA at its full output size. */
export function renderIcon(spec: IconSpec): Uint8ClampedArray {
  const n = spec.grid;
  const k = spec.size / n;
  if (!Number.isInteger(k)) throw new Error(`${spec.name}: ${spec.size} is not a multiple of ${n}`);

  // The idle pose, facing the viewer, crystal held high.
  const idle = ANIMS.find((a) => a.name === 'idle')!.poses('down')[0];
  const wiz = drawWizardFrame('down', idle);
  const w = wiz.canvas.render();

  // Portrait framing: the face sits just above centre and the robe runs off
  // the bottom edge. Head, hat and crystal stay inside the maskable safe zone.
  const ox = Math.floor((n - FRAME_W) / 2);
  const oy = Math.round(n / 2 - 12);
  const tipX = ox + wiz.meta.tipX;
  const tipY = oy + wiz.meta.tipY;
  const r = Math.max(3, Math.round(n * 0.16));

  const px = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const o = (y * n + x) * 4;
      if (spec.shape === 'rounded' && cornerCut(x, y, n, r)) continue;

      // Sky: radial falloff from behind the wizard's head, ordered dither
      // between palette steps.
      const dx = (x + 0.5 - n * 0.5) / n;
      const dy = (y + 0.5 - n * 0.42) / n;
      const t = Math.max(0, 1 - Math.hypot(dx, dy * 1.1) * 1.55);
      const level = t * (SKY.length - 1) + (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.9;
      let c: RGB = [...SKY[Math.max(0, Math.min(SKY.length - 1, Math.round(level)))]];

      // Stars, sparse and dim, kept away from the centre.
      const far = Math.hypot(dx, dy) > 0.3;
      if (far && hash(x, y, 3) > 0.988) c = add(c, STAR, 0.22);

      // Crystal glow washing the sky in banded rings.
      const gd = Math.hypot(x + 0.5 - tipX, y + 0.5 - tipY) / n;
      if (gd < 0.1) c = add(c, MAGIC_MID, 0.22);
      else if (gd < 0.17) c = add(c, MAGIC_DEEP, 0.2);
      else if (gd < 0.26 && (x + y) % 2 === 0) c = add(c, MAGIC_DEEP, 0.12);

      // Wizard: diffuse, then emissive on top (crystal and sparkles).
      const fx = x - ox;
      const fy = y - oy;
      if (fx >= 0 && fx < FRAME_W && fy >= 0 && fy < 32) {
        const i = (fy * FRAME_W + fx) * 4;
        if (w.diffuse[i + 3]) c = [w.diffuse[i], w.diffuse[i + 1], w.diffuse[i + 2]];
        if (w.emissive[i + 3]) c = add(c, [w.emissive[i], w.emissive[i + 1], w.emissive[i + 2]], 0.7);
      }

      // Frame: a lit rim on the top-left, dark on the bottom-right.
      if (spec.shape === 'rounded') {
        const inside = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < n && yy < n && !cornerCut(xx, yy, n, r);
        const edgeTL = !inside(x - 1, y) || !inside(x, y - 1);
        const edgeBR = !inside(x + 1, y) || !inside(x, y + 1);
        if (edgeTL && !edgeBR && x + y < n) c = [...RIM];
        else if (edgeTL || edgeBR) c = [...EDGE];
      }

      px.set([c[0], c[1], c[2], 255], o);
    }
  }

  // A four-point twinkle beside the crystal.
  const tw = (x: number, y: number, col: RGB) => {
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const o = (y * n + x) * 4;
    if (!px[o + 3]) return;
    const c = add([px[o], px[o + 1], px[o + 2]], col, 0.8);
    px.set([c[0], c[1], c[2], 255], o);
  };
  const sx = Math.round(n / 2 + 9);
  const sy = Math.round(tipY + 1);
  tw(sx, sy, MAGIC_CORE);
  tw(sx - 1, sy, MAGIC_HOT);
  tw(sx + 1, sy, MAGIC_HOT);
  tw(sx, sy - 1, MAGIC_HOT);
  tw(sx, sy + 1, MAGIC_HOT);

  // Scale up.
  const S = spec.size;
  const out = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const o = (Math.floor(y / k) * n + Math.floor(x / k)) * 4;
      out.set(px.subarray(o, o + 4), (y * S + x) * 4);
    }
  }
  return out;
}
