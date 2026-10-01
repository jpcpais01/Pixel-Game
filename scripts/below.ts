// Dev tool: paint Auto Battle's backdrop (the world below the Floating Island) with a few clouds and their shadows.
// Usage: npx tsx scripts/below.ts [out.png] [scale] [w] [h]
import { writeFileSync } from 'node:fs';
import { paintBelow, paintCloud } from '../src/art/autoBelow';
import type { Bitmap } from '../src/art/bitmap';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'below.png';
const S = Number(process.argv[3] ?? 3);
const W = Number(process.argv[4] ?? 460);
const H = Number(process.argv[5] ?? 250);
const img = new Uint8ClampedArray(paintBelow(W, H).data);
const blit = (b: Bitmap, ox: number, oy: number, shadow: boolean) => {
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const a = b.data[(y * b.w + x) * 4 + 3] / 255;
      const tx = ox + x;
      const ty = oy + y;
      if (!a || tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const i = (ty * W + tx) * 4;
      for (let c = 0; c < 3; c++) img[i + c] = shadow ? img[i + c] * (1 - 0.2 * a) : img[i + c] + (b.data[(y * b.w + x) * 4 + c] - img[i + c]) * a * 0.9;
    }
};
[[40, 30], [300, 150], [180, 190], [360, 20]].forEach(([x, y], i) => {
  const w = 56 + ((i * 37) % 7) * 9;
  const c = paintCloud(w, Math.round(w * 0.5), i);
  blit(c, x - 20, y + 28, true);
  blit(c, x, y, false);
});
const big = new Uint8ClampedArray(W * S * H * S * 4);
for (let y = 0; y < H * S; y++)
  for (let x = 0; x < W * S; x++) {
    const j = (Math.floor(y / S) * W + Math.floor(x / S)) * 4;
    big.set(img.subarray(j, j + 4), (y * W * S + x) * 4);
  }
writeFileSync(out, encodePNG(W * S, H * S, big));
console.log(`wrote ${out}`);
