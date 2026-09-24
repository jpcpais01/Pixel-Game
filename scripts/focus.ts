// Dev tool: render chosen frames large. Usage: npx tsx scripts/focus.ts out.png scale key1 key2 ...
import { writeFileSync } from 'node:fs';
import { buildWizardFrames, FRAME_W, FRAME_H } from '../src/art/wizard';
import { encodePNG } from './png';
const [out, sArg, ...keys] = process.argv.slice(2);
const S = Number(sArg);
const all = buildWizardFrames();
const frames = keys.map((k) => all.find((f) => f.key === k)!).map((f) => f.canvas.render());
const pad = 2;
const W = frames.length * (FRAME_W + pad) * S, H = (FRAME_H + pad) * S;
const img = new Uint8ClampedArray(W * H * 4);
const bg = [34, 38, 52];
for (let i = 0; i < W * H; i++) img.set([...bg, 255], i * 4);
frames.forEach((r, ci) => {
  for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
    const i = (y * FRAME_W + x) * 4;
    const base = r.diffuse[i + 3] ? [r.diffuse[i], r.diffuse[i + 1], r.diffuse[i + 2]] : bg;
    const c = r.emissive[i + 3] ? base.map((v, k) => Math.min(255, v + r.emissive[i + k] * 0.6)) : base;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++)
      img.set([c[0], c[1], c[2], 255], ((pad * S / 2 + y * S + sy) * W + ci * (FRAME_W + pad) * S + x * S + sx) * 4);
  }
});
writeFileSync(out, encodePNG(W, H, img));
