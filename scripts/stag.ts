// Dev tool: render the White Stag's frames (and its places) to a zoomed PNG,
// on forest ground by day (top rows) and by night (the glow added, bottom rows).
// Usage: npx tsx scripts/stag.ts [out.png] [scale] [stag|places]
import { writeFileSync } from 'node:fs';
import type { PixelCanvas } from '../src/art/pixel';
import { ALTAR_H, ALTAR_W, GROVE_FRAMES, GROVE_H, GROVE_W, HOLLOW_H, HOLLOW_W, SPRING_H, SPRING_W, STAG_H, STAG_W, altarArt, groveFrame, hollowArt, springArt, stagFrames } from '../src/art/stag';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'stag.png';
const S = Number(process.argv[3] ?? 4);
const what = process.argv[4] ?? 'stag';
const items: { c: PixelCanvas; w: number; h: number }[] =
  what === 'stag'
    ? stagFrames().map((f) => ({ c: f.canvas, w: STAG_W, h: STAG_H }))
    : [
        { c: springArt(0), w: SPRING_W, h: SPRING_H },
        ...GROVE_FRAMES.filter((_, i) => i % 2 === 0).map((n) => ({ c: groveFrame(n), w: GROVE_W, h: GROVE_H })),
        { c: altarArt(false), w: ALTAR_W, h: ALTAR_H },
        { c: altarArt(true), w: ALTAR_W, h: ALTAR_H },
        { c: hollowArt(1), w: HOLLOW_W, h: HOLLOW_H },
      ];
const cols = what === 'stag' ? 8 : items.length;
const cw = Math.max(...items.map((i) => i.w));
const ch = Math.max(...items.map((i) => i.h));
const rows = Math.ceil(items.length / cols);
const W = cols * cw * S;
const H = rows * 2 * ch * S;
const img = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const night = Math.floor(y / S / ch) % 2 === 1;
  const g = ((x / S) >> 3) + ((y / S) >> 3);
  img.set(night ? [14 + (g % 2) * 2, 22 + (g % 2) * 2, 30, 255] : [58 + (g % 2) * 4, 92 + (g % 2) * 5, 52, 255], (y * W + x) * 4);
}
items.forEach((it, k) => {
  const r = it.c.render();
  const col = k % cols;
  const row = Math.floor(k / cols);
  for (const night of [false, true]) {
    for (let y = 0; y < it.h; y++) for (let x = 0; x < it.w; x++) {
      const i = (y * it.w + x) * 4;
      const a = r.diffuse[i + 3] / 255;
      const dim = night ? 0.28 : 1;
      let c = [0, 0, 0];
      const e = [r.emissive[i], r.emissive[i + 1], r.emissive[i + 2]];
      if (!a && !(e[0] || e[1] || e[2])) continue;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const o = ((((row * 2 + (night ? 1 : 0)) * ch + y) * S + sy) * W + (col * cw + x) * S + sx) * 4;
        c = [0, 1, 2].map((j) => img[o + j] * (1 - a) + r.diffuse[i + j] * a * dim);
        img.set([0, 1, 2].map((j) => Math.min(255, c[j] + (night ? e[j] : e[j] * 0.25))).concat(255), o);
      }
    }
  }
});
writeFileSync(out, encodePNG(W, H, img));
