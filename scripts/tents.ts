// Dev tool: paint every tent cloth in a few shapes (gable-on, lying the long way,
// one cell), by day and by night, with a rough sun on their normals.
// Usage: npx tsx scripts/tents.ts [out.png]
import { writeFileSync } from 'node:fs';
import { paintTent } from '../src/art/tentArt';
import { findHousesIn } from '../src/world/houses';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'tents.png';
const S = 3;
const shapes: [number, number, number, number][] = [[0, 0, 2, 2], [0, 0, 3, 3], [0, 0, 2, 3], [0, 0, 4, 2], [0, 0, 1, 1], [0, 0, 5, 3]];
const CW = 120, CH = 130;
const W = CW * shapes.length, H = CH * 3 * 2;
const img = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const night = y >= H / 2;
  const n = ((x * 7 + y * 13) % 5) * 2;
  img.set(night ? [20, 34 + n / 2, 30, 255] : [70 + n, 112 + n, 52, 255], (y * W + x) * 4);
}
const sun = { x: -0.45, y: -0.5, z: 0.74 };
for (const night of [false, true]) for (let k = 1; k <= 3; k++) shapes.forEach(([x0, y0, w, h], si) => {
  const cells = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) cells.push({ x: x + 2, y: y + 2 });
  const house = findHousesIn([], cells).houses[0];
  const a = paintTent(() => k, house);
  const bx = si * CW + 10 - 32 + 4, by = ((k - 1) + (night ? 3 : 0)) * CH + CH - 20 - (house.y1 + 1) * 16 - 4;
  const blit = (px: Uint8ClampedArray, nm: Uint8ClampedArray, w: number, h: number, ox: number, oy: number) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!px[i + 3]) continue;
      const nx = nm[i] / 127.5 - 1, ny = nm[i + 1] / 127.5 - 1, nz = nm[i + 2] / 127.5 - 1;
      const l = 0.62 + 0.55 * Math.max(0, nx * sun.x + -ny * sun.y + nz * sun.z) ;
      const dim = night ? 0.28 : 1;
      const X = bx + ox + x, Y = by + oy + y;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      img.set([px[i] * l * dim, px[i + 1] * l * dim, px[i + 2] * l * dim, 255], (Y * W + X) * 4);
    }
  };
  blit(a.hem.diffuse, a.hem.normal, a.hem.w, a.hem.h, a.hem.x, a.hem.y);
  blit(a.diffuse, a.normal, a.w, a.h, a.x, a.y);
  if (night) for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const i = (y * a.w + x) * 4;
    if (!a.glow[i + 3]) continue;
    const o = ((by + a.y + y) * W + bx + a.x + x) * 4;
    for (let j = 0; j < 3; j++) img[o + j] = Math.min(255, img[o + j] + a.glow[i + j] * 0.8);
  }
});
const big = new Uint8ClampedArray(W * S * H * S * 4);
for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) big.set(img.subarray(((y / S | 0) * W + (x / S | 0)) * 4, ((y / S | 0) * W + (x / S | 0)) * 4 + 4), (y * W * S + x) * 4);
writeFileSync(out, encodePNG(W * S, H * S, big));
