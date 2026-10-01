// Dev tool: paint looks plain and dressed in each boss set (art/dress.ts),
// a frame each, lit and glowing as in the world, to a PNG.
// Usage: npx tsx scripts/dress.ts [out.png] [scale] [look,look...] [frame]
import { writeFileSync } from 'node:fs';
import { buildHeroSheet, type HeroSheet } from '../src/art/heroSheets';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'dress.png';
const S = Number(process.argv[3] ?? 4);
const LOOKS = (process.argv[4] ?? 'warrior,wizard,paladin,archer,rogue,mech,eagle').split(',');
const FRAME = process.argv[5] ?? 'idle_down_0';
const SETS = ['', 'ember', 'wraith', 'spore', 'geode', 'astral'];

const sheets: HeroSheet[][] = LOOKS.map((l) => SETS.map((s) => buildHeroSheet(s ? `${l}.${s}` : l)));
const fw = Math.max(...sheets.flat().map((s) => s.fw));
const fh = Math.max(...sheets.flat().map((s) => s.fh));
const pad = 4;
const W = SETS.length * (fw + pad) + pad;
const H = LOOKS.length * (fh + pad) + pad;
const img = new Uint8ClampedArray(W * S * H * S * 4);
const put = (x: number, y: number, c: number[]) => {
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const k = ((y * S + j) * W * S + x * S + i) * 4;
      img[k] = c[0];
      img[k + 1] = c[1];
      img[k + 2] = c[2];
      img[k + 3] = 255;
    }
};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, [34, 40, 30]);
sheets.forEach((row, r) =>
  row.forEach((sh, c) => {
    const a = sh.atlas;
    const rect = a.rects.find((q) => q.name === FRAME) ?? a.rects[0];
    for (let y = 0; y < sh.fh; y++)
      for (let x = 0; x < sh.fw; x++) {
        const k = ((rect.y + y) * a.w + rect.x + x) * 4;
        const bx = pad + c * (fw + pad) + x;
        const by = pad + r * (fh + pad) + y;
        const al = a.diffuse[k + 3] / 255;
        const base = [34, 40, 30];
        const px = [0, 1, 2].map((i) => base[i] * (1 - al) + a.diffuse[k + i] * al * 0.85 + a.emissive[k + i]);
        put(bx, by, px.map((v) => Math.min(255, v)));
      }
  }),
);
writeFileSync(out, encodePNG(W * S, H * S, img));
console.log(`wrote ${out}`);
