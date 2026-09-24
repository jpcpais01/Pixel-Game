// Dev tool: dump each animation (all four directions side by side) as zoomed
// PNG frames, composited with the emissive layer, for making preview GIFs.
// Usage: npx tsx scripts/anim-frames.ts outDir scale
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildWizardFrames, FRAME_W, FRAME_H, ANIMS, DIRS } from '../src/art/wizard';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'frames';
const S = Number(process.argv[3] ?? 8);
mkdirSync(out, { recursive: true });
const all = buildWizardFrames();
const bg = [22, 24, 38];
const pad = 6;
for (const a of ANIMS) {
  const byDir = DIRS.map((d) => all.filter((f) => f.anim === a.name && f.dir === d).map((f) => f.canvas.render()));
  const n = byDir[0].length;
  const W = DIRS.length * (FRAME_W + pad) * S + pad * S;
  const H = (FRAME_H + pad * 2) * S;
  for (let fi = 0; fi < n; fi++) {
    const img = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) img.set([...bg, 255], i * 4);
    byDir.forEach((frames, di) => {
      const r = frames[fi];
      const ox = (pad + di * (FRAME_W + pad)) * S;
      const oy = pad * S;
      // Soft floor shadow.
      for (let y = 29; y < 33; y++) for (let x = 5; x < 19; x++) {
        const dx = (x + 0.5 - 12) / 7, dy = (y + 0.5 - 31) / 2;
        if (dx * dx + dy * dy > 1) continue;
        for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) img.set([14, 15, 26, 255], ((oy + y * S + sy) * W + ox + x * S + sx) * 4);
      }
      for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
        const i = (y * FRAME_W + x) * 4;
        const has = r.diffuse[i + 3] || r.emissive[i + 3];
        if (!has) continue;
        const idx = ((oy + y * S) * W + ox + x * S) * 4;
        const under = r.diffuse[i + 3] ? [r.diffuse[i], r.diffuse[i + 1], r.diffuse[i + 2]] : [img[idx], img[idx + 1], img[idx + 2]];
        const c = r.emissive[i + 3] ? under.map((v, k) => Math.min(255, v + r.emissive[i + k] * 0.7)) : under;
        for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) img.set([c[0], c[1], c[2], 255], ((oy + y * S + sy) * W + ox + x * S + sx) * 4);
      }
    });
    writeFileSync(`${out}/${a.name}_${String(fi).padStart(2, '0')}.png`, encodePNG(W, H, img));
  }
  writeFileSync(`${out}/${a.name}.fps`, String(a.fps));
}
