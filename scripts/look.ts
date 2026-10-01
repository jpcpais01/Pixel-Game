// Dev tool: render any hero look's sheet to a zoomed, roughly lit PNG, one
// row per animation (every frame of it once, in order), for any rig.
// Usage: npx tsx scripts/look.ts <lookKey> [out.png] [scale] [anim regex]
//   e.g. npx tsx scripts/look.ts jedi_sith sith.png 4 'sweep|lightning'
import { writeFileSync } from 'node:fs';
import { buildHeroSheet, HERO_SHEETS } from '../src/art/heroSheets';
import { encodePNG } from './png';

const key = process.argv[2];
if (!key || !HERO_SHEETS.includes(key)) {
  console.log(`Usage: npx tsx scripts/look.ts <lookKey> [out.png] [scale] [anim regex]\nLooks: ${HERO_SHEETS.join(' ')}`);
  process.exit(1);
}
const out = process.argv[3] ?? `${key}.png`;
const S = Number(process.argv[4] ?? 4);
const only = process.argv[5] ? new RegExp(process.argv[5]) : null;

const L = (() => {
  const v = [-0.45, -0.55, 0.7];
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map((k) => k / n);
})();

const sheet = buildHeroSheet(key);
const at = new Map(sheet.atlas.rects.map((r) => [r.name, r]));
const rows = sheet.anims
  .filter((a) => !only || only.test(a.key.slice(key.length + 1)))
  .map((a) => ({ name: a.key, cells: [...new Set(a.frames)].map((n) => at.get(n)!).filter(Boolean) }));
if (!rows.length) process.exit(0);

const pad = 3;
const { fw, fh } = sheet;
const W = Math.max(...rows.map((r) => r.cells.length)) * (fw + pad) * S + pad * S;
const H = rows.length * (fh + pad) * S + pad * S;
const img = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([40, 46, 40, 255], i * 4);
const a = sheet.atlas;
rows.forEach((r, ri) => {
  const oy = pad + ri * (fh + pad);
  r.cells.forEach((cell, ci) => {
    const ox = pad + ci * (fw + pad);
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++) {
        const i = ((cell.y + y) * a.w + cell.x + x) * 4;
        const on = a.diffuse[i + 3] > 0;
        const glow = a.emissive[i + 3] > 0;
        if (!on && !glow) continue;
        let c = [0, 0, 0];
        if (on) {
          const n = [a.normal[i] / 127.5 - 1, -(a.normal[i + 1] / 127.5 - 1), a.normal[i + 2] / 127.5 - 1];
          const lit = 0.5 + 0.75 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
          c = [a.diffuse[i] * lit, a.diffuse[i + 1] * lit, a.diffuse[i + 2] * lit];
        }
        if (glow) c = c.map((v, k) => v + a.emissive[i + k] * 0.8);
        c = c.map((v) => Math.min(255, v));
        for (let sy = 0; sy < S; sy++)
          for (let sx = 0; sx < S; sx++) img.set([c[0], c[1], c[2], 255], (((oy + y) * S + sy) * W + (ox + x) * S + sx) * 4);
      }
  });
});
writeFileSync(out, encodePNG(W, H, img));
console.log('wrote', out, `${rows.length} anims:`, rows.map((r) => r.name.slice(key.length + 1)).join(' '));
