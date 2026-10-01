// Dev tool: paint Auto Battle's boon cards (face and back, a card per tier) and every boon's picture to a zoomed PNG.
// Usage: npx tsx scripts/boons.ts [out.png] [scale] [card width] [card height]
import { writeFileSync } from 'node:fs';
import { boonLayout, paintBoonBack, paintBoonCard, paintBoonIcon } from '../src/art/boonArt';
import { BOONS } from '../src/game/auto/boons';
import type { Bitmap } from '../src/art/bitmap';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'boons.png';
const S = Number(process.argv[3] ?? 3);
const cw = Number(process.argv[4] ?? 112);
const ch = Number(process.argv[5] ?? 160);
const ids = Object.keys(BOONS);
const W = Math.max(cw * 6 + 50, 34 * 12) + 8;
const H = ch + 8 + Math.ceil(ids.length / 12) * 52 + 8;
const img = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([24, 20, 40, 255], i * 4);
const blit = (b: Bitmap, ox: number, oy: number) => {
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const i = (y * b.w + x) * 4;
      if (!b.data[i + 3]) continue;
      img.set([b.data[i], b.data[i + 1], b.data[i + 2], 255], ((oy + y) * W + ox + x) * 4);
    }
};
const picks = ['titan', 'banner', 'star'];
for (const t of [0, 1, 2] as const) {
  const face = paintBoonCard(t, cw, ch, 1);
  blit(face, 4 + t * (cw * 2 + 16), 4);
  const L = boonLayout(cw, ch, 1);
  const icon = paintBoonIcon(picks[t], L.icon);
  blit(icon, 4 + t * (cw * 2 + 16) + L.cx - L.icon / 2, 4 + L.cy - L.icon / 2);
  blit(paintBoonBack(t, cw, ch), 4 + t * (cw * 2 + 16) + cw + 4, 4);
}
ids.forEach((id, i) => {
  blit(paintBoonIcon(id, 48), 4 + (i % 12) * 52, ch + 12 + Math.floor(i / 12) * 52);
});
const big = new Uint8ClampedArray(W * S * H * S * 4);
for (let y = 0; y < H * S; y++)
  for (let x = 0; x < W * S; x++) big.set(img.subarray(((Math.floor(y / S) * W) + Math.floor(x / S)) * 4, ((Math.floor(y / S) * W) + Math.floor(x / S)) * 4 + 4), (y * W * S + x) * 4);
writeFileSync(out, encodePNG(W * S, H * S, big));
