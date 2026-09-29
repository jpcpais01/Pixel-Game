/** Canvases that hold finished art: once they are textures, nothing draws on them again. */
const baked = new WeakSet<HTMLCanvasElement>();

/**
 * Finished pixels where there is no page to make a canvas on: in a worker
 * (see arenaWorker.ts), `pixelCanvas` hands these back instead, and the main
 * thread turns them into canvases.
 */
export interface PixelImage {
  width: number;
  height: number;
  /** Its own buffer, exactly width * height * 4 long, so it can be transferred. */
  pixels: Uint8ClampedArray<ArrayBuffer>;
}

/** Put finished RGBA pixels on a canvas, ready to become a texture. */
export function pixelCanvas(w: number, h: number, px: Uint8ClampedArray): HTMLCanvasElement {
  const whole = px.buffer instanceof ArrayBuffer && px.byteOffset === 0 && px.buffer.byteLength === w * h * 4;
  const data = whole ? (px as Uint8ClampedArray<ArrayBuffer>) : new Uint8ClampedArray(px.subarray(0, w * h * 4));
  if (typeof document === 'undefined') return { width: w, height: h, pixels: data } satisfies PixelImage as unknown as HTMLCanvasElement;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(new ImageData(data, w, h), 0, 0);
  baked.add(c);
  return c;
}

/** Mark a canvas drawn some other way as finished art (see `pixelCanvas`). */
export function bakedCanvas(c: HTMLCanvasElement): HTMLCanvasElement {
  baked.add(c);
  return c;
}

/** Whether a canvas holds finished art (see `bakeArtTextures` in game/bakedTextures.ts). */
export const isBaked = (c: HTMLCanvasElement): boolean => baked.has(c);
