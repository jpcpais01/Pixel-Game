// Packs rendered frames into one atlas per layer, as plain pixel arrays: no
// canvas and no Phaser, so a worker can do it too (see heroSheets.ts); and
// registers an atlas as textures, on the main thread.

import type Phaser from 'phaser';
import type { RenderedFrame } from './pixel';
import { pixelCanvas } from './canvas';

export interface PixelAtlas {
  w: number;
  h: number;
  diffuse: Uint8ClampedArray<ArrayBuffer>;
  normal: Uint8ClampedArray<ArrayBuffer>;
  emissive: Uint8ClampedArray<ArrayBuffer>;
  /** Solid silhouette, used for sun shadows. */
  silhouette: Uint8ClampedArray<ArrayBuffer>;
  /** White silhouette, flashed over a sprite when it is struck; only made when asked for. */
  white: Uint8ClampedArray<ArrayBuffer> | null;
  rects: { name: string; x: number; y: number }[];
}

/** Pack equally sized frames into one atlas per layer. */
export function packAtlas(frames: { name: string; r: RenderedFrame }[], fw: number, fh: number, cols = 16, withWhite = false): PixelAtlas {
  const rows = Math.ceil(frames.length / cols);
  const W = Math.min(cols, frames.length) * fw;
  const H = rows * fh;
  const layers = { diffuse: new Uint8ClampedArray(W * H * 4), normal: new Uint8ClampedArray(W * H * 4), emissive: new Uint8ClampedArray(W * H * 4) };
  const rects: PixelAtlas['rects'] = [];
  frames.forEach((f, i) => {
    const ox = (i % cols) * fw;
    const oy = Math.floor(i / cols) * fh;
    rects.push({ name: f.name, x: ox, y: oy });
    for (const k of ['diffuse', 'normal', 'emissive'] as const) {
      const src = f.r[k];
      const dst = layers[k];
      for (let y = 0; y < fh; y++) {
        dst.set(src.subarray(y * fw * 4, (y + 1) * fw * 4), ((oy + y) * W + ox) * 4);
      }
    }
  });
  const sil = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    sil[i * 4] = 6;
    sil[i * 4 + 1] = 8;
    sil[i * 4 + 2] = 22;
    sil[i * 4 + 3] = layers.diffuse[i * 4 + 3];
  }
  const atlas: PixelAtlas = { w: W, h: H, ...layers, silhouette: sil, white: null, rects };
  if (withWhite) atlas.white = whiteOf(atlas);
  return atlas;
}

/** The white hit-flash layer of an atlas packed without one. */
export function whiteOf(a: PixelAtlas): Uint8ClampedArray<ArrayBuffer> {
  const n = a.w * a.h;
  const px = new Uint8ClampedArray(n * 4).fill(255);
  for (let i = 0; i < n; i++) px[i * 4 + 3] = a.diffuse[i * 4 + 3];
  return px;
}

/**
 * An atlas as `<key>` (lit, with its normal map), `<key>_e` (glow), `<key>_s`
 * (sun shadow) and, when it has one, `<key>_w` (hit flash), each with the
 * same frame names.
 */
export function registerAtlas(scene: Phaser.Scene, key: string, a: PixelAtlas, fw: number, fh: number, withEmissive = true): void {
  const tex = scene.textures.addCanvas(key, pixelCanvas(a.w, a.h, a.diffuse))!;
  tex.setDataSource(pixelCanvas(a.w, a.h, a.normal));
  const etex = withEmissive ? scene.textures.addCanvas(`${key}_e`, pixelCanvas(a.w, a.h, a.emissive))! : null;
  const stex = scene.textures.addCanvas(`${key}_s`, pixelCanvas(a.w, a.h, a.silhouette))!;
  const wtex = a.white ? scene.textures.addCanvas(`${key}_w`, pixelCanvas(a.w, a.h, a.white))! : null;
  for (const r of a.rects) {
    tex.add(r.name, 0, r.x, r.y, fw, fh);
    etex?.add(r.name, 0, r.x, r.y, fw, fh);
    stex.add(r.name, 0, r.x, r.y, fw, fh);
    wtex?.add(r.name, 0, r.x, r.y, fw, fh);
  }
}
