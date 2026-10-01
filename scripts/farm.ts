// Dev tool: render the farm's crops at every stage, the kitchen's stove and
// cooking pot, and every farm and kitchen icon to a zoomed PNG, by day and by night.
// Usage: npx tsx scripts/farm.ts [out.png] [scale]
import { writeFileSync } from 'node:fs';
import type { PixelCanvas } from '../src/art/pixel';
import { CROP_H, CROP_W, cropFrame, farmIcons } from '../src/art/farm';
import { PROP_ART } from '../src/art/homeProps';
import { CROPS, STAGES } from '../src/game/farm';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'farm.png';
const S = Number(process.argv[3] ?? 4);
type Item = { c: PixelCanvas; w: number; h: number };
const rows: Item[][] = [
  ...CROPS.map((d) => Array.from({ length: STAGES }, (_, s) => ({ c: cropFrame(d.id, s), w: CROP_W, h: CROP_H }))),
];
// Crops two to a row, so the sheet isn't too tall.
const crops: Item[][] = [];
for (let i = 0; i < rows.length; i += 2) crops.push([...rows[i], ...(rows[i + 1] ?? [])]);
const props = ['stove', 'cookpot'].flatMap((id) => [0, 1].map((f) => ({ c: PROP_ART[id].draw(f), w: PROP_ART[id].w, h: PROP_ART[id].h })));
const icons = farmIcons().map((i) => ({ c: i.c, w: 16, h: 16 }));
const iconRows: Item[][] = [];
for (let i = 0; i < icons.length; i += 12) iconRows.push(icons.slice(i, i + 12));
const all = [...crops, props, ...iconRows];
const pad = 2;
const W = Math.max(...all.map((r) => r.reduce((w, it) => w + it.w + pad, pad))) * S;
const rowH = all.map((r) => Math.max(...r.map((it) => it.h)) + pad);
const H = rowH.reduce((a, b) => a + b, pad) * 2 * S;
const img = new Uint8ClampedArray(W * H * 4);
const half = H / 2;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const night = y >= half;
  const g = ((x / S) >> 3) + ((y / S) >> 3);
  img.set(night ? [18 + (g % 2) * 2, 20 + (g % 2) * 2, 34, 255] : [86 + (g % 2) * 4, 62 + (g % 2) * 4, 40, 255], (y * W + x) * 4);
}
for (const night of [false, true]) {
  let oy = pad + (night ? half / S : 0);
  all.forEach((row, ri) => {
    let ox = pad;
    for (const it of row) {
      const r = it.c.render();
      for (let y = 0; y < it.h; y++) for (let x = 0; x < it.w; x++) {
        const i = (y * it.w + x) * 4;
        const a = r.diffuse[i + 3] / 255;
        const e = [r.emissive[i], r.emissive[i + 1], r.emissive[i + 2]];
        if (!a && !(e[0] || e[1] || e[2])) continue;
        for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
          const o = (((oy + y) * S + sy) * W + (ox + x) * S + sx) * 4;
          const dim = night ? 0.3 : 1;
          const c = [0, 1, 2].map((j) => img[o + j] * (1 - a) + r.diffuse[i + j] * a * dim);
          img.set([0, 1, 2].map((j) => Math.min(255, c[j] + (night ? e[j] : e[j] * 0.2))).concat(255), o);
        }
      }
      ox += it.w + pad;
    }
    oy += rowH[ri];
  });
}
writeFileSync(out, encodePNG(W, H, img));
console.log(`${out}: ${W}x${H}`);
