// Dev tool: render the mouse pointers (normal on the top row, hovered below) on two grounds.
// Usage: npx tsx scripts/pointers.ts [out.png] [scale]
import { writeFileSync } from 'node:fs';
import { POINTERS, POINTER_SIZE, pointerPixels } from '../src/art/pointers';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'pointers.png';
const S = Number(process.argv[3] ?? 8);
const N = POINTER_SIZE + 4;
const W = POINTERS.length * N * S;
const H = 4 * N * S;
const img = new Uint8ClampedArray(W * H * 4);
const grounds = [[46, 92, 52], [36, 30, 72]];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const row = Math.floor(y / S / N);
  const g = grounds[row >> 1];
  const i = (y * W + x) * 4;
  img.set([g[0], g[1], g[2], 255], i);
  const col = Math.floor(x / S / N);
  const px = Math.floor(x / S) - col * N - 2;
  const py = Math.floor(y / S) - row * N - 2;
  if (px < 0 || py < 0 || px >= POINTER_SIZE || py >= POINTER_SIZE) continue;
  const p = pointerPixels(POINTERS[col].id, row % 2 === 1);
  const j = (py * POINTER_SIZE + px) * 4;
  const a = p[j + 3] / 255;
  for (let k = 0; k < 3; k++) img[i + k] = Math.round(img[i + k] * (1 - a) + p[j + k] * a);
}
writeFileSync(out, encodePNG(W, H, img));
