// Dev tool: render every tree (and the Home's cherry) to a zoomed PNG, on grass.
// Usage: npx tsx scripts/trees.ts [out.png] [scale] [frame]
import { writeFileSync } from 'node:fs';
import { TREE_H, TREE_VARIANTS, TREE_W, treeFrame } from '../src/art/trees';
import { blossomTree } from '../src/art/homeProps';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'trees.png';
const S = Number(process.argv[3] ?? 3);
const f = Number(process.argv[4] ?? 0);
const rows = [
  (v: number) => treeFrame('oak', v, f),
  (v: number) => treeFrame('birch', v, f),
  (v: number) => treeFrame('pine', v, f),
  (v: number) => blossomTree(v, f),
];
const W = TREE_VARIANTS * TREE_W * S;
const H = rows.length * TREE_H * S;
const img = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const g = ((x / S) >> 3) + ((y / S) >> 3);
  img.set([58 + (g % 2) * 4, 92 + (g % 2) * 5, 52, 255], (y * W + x) * 4);
}
rows.forEach((draw, ri) => {
  for (let v = 0; v < TREE_VARIANTS; v++) {
    const r = draw(v).render();
    for (let y = 0; y < TREE_H; y++) for (let x = 0; x < TREE_W; x++) {
      const i = (y * TREE_W + x) * 4;
      if (!r.diffuse[i + 3]) continue;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const o = (((ri * TREE_H + y) * S + sy) * W + (v * TREE_W + x) * S + sx) * 4;
        img.set([r.diffuse[i], r.diffuse[i + 1], r.diffuse[i + 2], 255], o);
      }
    }
  }
});
writeFileSync(out, encodePNG(W, H, img));
