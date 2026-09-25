// Dev tool: render every gear icon and its ground sprite to a zoomed PNG sheet.
// Usage: npx tsx scripts/gear.ts [out.png] [scale]
import { writeFileSync } from 'node:fs';
import { GEAR_ART_IDS, GEAR_DROP, GEAR_ICON, gearArt } from '../src/art/gear';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'gear.png';
const S = Number(process.argv[3] ?? 4);
const cols = 5;
const cellW = GEAR_ICON + GEAR_DROP + 6;
const cellH = GEAR_ICON + 4;
const W = cols * cellW * S;
const H = Math.ceil(GEAR_ART_IDS.length / cols) * cellH * S;
const img = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([34, 38, 52, 255], i * 4);
const blit = (px: Uint8ClampedArray, w: number, ox: number, oy: number) => {
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const a = px[i + 3] / 255;
    if (!a) continue;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const o = (((oy + y) * S + sy) * W + (ox + x) * S + sx) * 4;
      for (let c = 0; c < 3; c++) img[o + c] = img[o + c] * (1 - a) + px[i + c] * a;
    }
  }
};
GEAR_ART_IDS.forEach((id, n) => {
  const { icon, drop } = gearArt(id);
  const ox = (n % cols) * cellW + 2;
  const oy = Math.floor(n / cols) * cellH + 2;
  blit(icon, GEAR_ICON, ox, oy);
  blit(drop, GEAR_DROP, ox + GEAR_ICON + 3, oy + 8);
});
writeFileSync(out, encodePNG(W, H, img));
console.log(`wrote ${out}`);
