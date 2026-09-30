// Dev tool: render the game mode menu's three windows (the glow added) to a zoomed PNG.
// Usage: npx tsx scripts/modes.ts [out.png] [scale]
import { writeFileSync } from 'node:fs';
import { paintArenas, paintAuto, paintHome } from '../src/art/modes';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'modes.png';
const S = Number(process.argv[3] ?? 3);
const arts = [paintArenas(), paintHome(), paintAuto()];
const W = Math.max(...arts.map((a) => a.base.w)) * S;
const H = arts.reduce((h, a) => h + a.base.h * S + 4, 0);
const img = new Uint8ClampedArray(W * H * 4);
let top = 0;
for (const a of arts) {
  const { w, h } = a.base;
  for (let y = 0; y < h * S; y++) {
    for (let x = 0; x < w * S; x++) {
      const i = (Math.floor(y / S) * w + Math.floor(x / S)) * 4;
      const o = ((top + y) * W + x) * 4;
      const g = a.glow.data[i + 3] ? 1 : 0;
      for (let c = 0; c < 3; c++) img[o + c] = Math.min(255, a.base.data[i + c] + g * a.glow.data[i + c]);
      img[o + 3] = 255;
    }
  }
  top += h * S + 4;
}
writeFileSync(out, encodePNG(W, H, img));
