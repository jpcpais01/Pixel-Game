// Dev tool: render the arenas' loading-screen pictures (the glow added, on the screen's dark) to a zoomed PNG.
// Usage: npx tsx scripts/loading.ts [out.png] [scale]
import { writeFileSync } from 'node:fs';
import { LOAD_H, LOAD_W, paintCosmos, paintDeep, paintFrost, paintRift, paintSky, paintSpirit, paintTemple } from '../src/art/loadArt';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'loading.png';
const S = Number(process.argv[3] ?? 3);
const arts = [paintDeep(), paintSpirit(), paintTemple(), paintCosmos(), paintRift(), paintFrost(), paintSky(false), paintSky(true)];
const COLS = 2;
const W = COLS * LOAD_W * S;
const H = Math.ceil(arts.length / COLS) * LOAD_H * S;
const img = new Uint8ClampedArray(W * H * 4);
const bg = [7, 8, 13];
arts.forEach((a, n) => {
  const ox = (n % COLS) * LOAD_W * S;
  const oy = Math.floor(n / COLS) * LOAD_H * S;
  for (let y = 0; y < LOAD_H * S; y++) {
    for (let x = 0; x < LOAD_W * S; x++) {
      const i = (Math.floor(y / S) * LOAD_W + Math.floor(x / S)) * 4;
      const o = ((oy + y) * W + ox + x) * 4;
      const on = a.base.data[i + 3] ? 1 : 0;
      const g = a.glow.data[i + 3] ? 1 : 0;
      for (let c = 0; c < 3; c++) img[o + c] = Math.min(255, (on ? a.base.data[i + c] : bg[c]) + g * a.glow.data[i + c]);
      img[o + 3] = 255;
    }
  }
});
writeFileSync(out, encodePNG(W, H, img));
