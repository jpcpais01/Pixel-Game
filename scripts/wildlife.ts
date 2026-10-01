// Dev tool: render the Everwood's wild things (deer, fox, songbirds, owl) and
// the bent undergrowth of a gust to a zoomed PNG, by day and by night.
// Usage: npx tsx scripts/wildlife.ts [out.png] [scale] [deer|fox|bird|owl|bend] [frame name regex]
import { writeFileSync } from 'node:fs';
import type { PixelCanvas } from '../src/art/pixel';
import { FPROP_BENDS, FPROP_FRAMES, FPROP_H, FPROP_W } from '../src/art/forest';
import { BIRD_H, BIRD_W, DEER_H, DEER_W, FOX_H, FOX_W, OWL_H, OWL_W, birdFrames, deerFrames, foxFrames, owlFrames } from '../src/art/wildlife';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'wildlife.png';
const S = Number(process.argv[3] ?? 5);
const what = process.argv[4] ?? 'deer';
/** Only the frames whose names match this, if given. */
const only = process.argv[5] ? new RegExp(process.argv[5]) : null;
const sets: Record<string, () => { items: { c: PixelCanvas }[]; w: number; h: number; cols: number }> = {
  deer: () => ({ items: deerFrames().filter((f) => !only || only.test(f.name)).map((f) => ({ c: f.canvas })), w: DEER_W, h: DEER_H, cols: 8 }),
  fox: () => ({ items: foxFrames().filter((f) => !only || only.test(f.name)).map((f) => ({ c: f.canvas })), w: FOX_W, h: FOX_H, cols: 8 }),
  bird: () => ({ items: birdFrames().filter((f) => !only || only.test(f.name)).map((f) => ({ c: f.canvas })), w: BIRD_W, h: BIRD_H, cols: 13 }),
  owl: () => ({ items: owlFrames().filter((f) => !only || only.test(f.name)).map((f) => ({ c: f.canvas })), w: OWL_W, h: OWL_H, cols: 8 }),
  bend: () => ({ items: FPROP_FRAMES.filter((f) => /^(tuft|flowers|reeds)/.test(f.name)).flatMap((f) => [FPROP_BENDS.find((b) => b.name === `${f.name}~-2`)!, FPROP_BENDS.find((b) => b.name === `${f.name}~-1`)!, f, FPROP_BENDS.find((b) => b.name === `${f.name}~1`)!, FPROP_BENDS.find((b) => b.name === `${f.name}~2`)!]).map((f) => ({ c: f.draw() })), w: FPROP_W, h: FPROP_H, cols: 10 }),
};
const { items, w: cw, h: ch, cols } = sets[what]();
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
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = (y * cw + x) * 4;
      const a = r.diffuse[i + 3] / 255;
      const dim = night ? 0.28 : 1;
      const e = [r.emissive[i], r.emissive[i + 1], r.emissive[i + 2]];
      if (!a && !(e[0] || e[1] || e[2])) continue;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const o = ((((row * 2 + (night ? 1 : 0)) * ch + y) * S + sy) * W + (col * cw + x) * S + sx) * 4;
        const c = [0, 1, 2].map((j) => img[o + j] * (1 - a) + r.diffuse[i + j] * a * dim);
        img.set([0, 1, 2].map((j) => Math.min(255, c[j] + (night ? e[j] : e[j] * 0.25))).concat(255), o);
      }
    }
  }
});
writeFileSync(out, encodePNG(W, H, img));
