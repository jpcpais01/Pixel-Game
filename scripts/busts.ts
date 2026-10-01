// Dev tool: paint every class bust in its medallion as the character select
// shows it (a 40 px plate, the bust at 2x cut to a 34 px disc), to a PNG.
// Usage: npx tsx scripts/busts.ts [out.png] [scale]
import { writeFileSync } from 'node:fs';
import { BUST, classBust } from '../src/art/busts';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'busts.png';
const S = Number(process.argv[3] ?? 4);
const IDS = ['mage', 'warrior', 'jedi', 'alchemist', 'archer', 'duelist', 'necromancer', 'mystic', 'automaton', 'phantom', 'inventor', 'beast'];
const Z = 2;
const D = 40;
const FACE = D - 6;
const pad = 6;
const W = IDS.length * (D + pad) + pad;
const H = D + pad * 2;
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
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, [20, 16, 40]);
IDS.forEach((id, n) => {
  const ox = pad + n * (D + pad);
  const oy = pad;
  const r = D / 2;
  // The plate: a dark disc with a pale rim, as on the select screen.
  for (let y = 0; y < D; y++)
    for (let x = 0; x < D; x++) {
      const d = Math.hypot(x + 0.5 - r, y + 0.5 - r);
      if (d > r) continue;
      put(ox + x, oy + y, d > r - 1.2 ? [11, 8, 24] : d > r - 2.2 ? [150, 130, 200] : [60 - (y * 20) / D, 50 - (y * 16) / D, 100 - (y * 30) / D]);
    }
  const b = classBust(id);
  if (!b) return;
  const f = (D - FACE) / 2;
  const o = Math.floor((FACE - BUST * Z) / 2);
  for (let y = 0; y < FACE; y++)
    for (let x = 0; x < FACE; x++) {
      if (Math.hypot(x + 0.5 - FACE / 2, y + 0.5 - FACE / 2) > FACE / 2) continue;
      const bx = Math.floor((x - o) / Z);
      const by = Math.floor((y - o) / Z);
      if (bx < 0 || by < 0 || bx >= BUST || by >= BUST) continue;
      const i = (by * BUST + bx) * 4;
      if (b.diffuse[i + 3] < 128) continue;
      put(ox + f + x, oy + f + y, [0, 1, 2].map((k) => Math.min(255, b.diffuse[i + k] + b.emissive[i + k] * 0.5)));
    }
});
writeFileSync(out, encodePNG(W * S, H * S, img));
console.log(`wrote ${out}`);
