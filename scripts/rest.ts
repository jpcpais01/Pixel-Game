// Dev tool: render heroes' idle moments (`rest`) to a zoomed, roughly lit PNG,
// one row per look: the stand pose first, then each rest frame once, in order.
// Usage: npx tsx scripts/rest.ts out.png [scale] [lookKey ...]   (no keys: every look with a rest)
import { writeFileSync } from 'node:fs';
import { buildHeroSheet, HERO_SHEETS } from '../src/art/heroSheets';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'rest.png';
const S = Number(process.argv[3] ?? 4);
const keys = process.argv.length > 4 ? process.argv.slice(4) : [...HERO_SHEETS];

const L = (() => {
  const v = [-0.45, -0.55, 0.7];
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map((k) => k / n);
})();

interface Row {
  fw: number;
  fh: number;
  cells: { x: number; y: number }[];
  sheet: ReturnType<typeof buildHeroSheet>;
}

const rows: Row[] = [];
for (const key of keys) {
  const sheet = buildHeroSheet(key);
  const rest = sheet.anims.find((a) => a.key === `${key}_rest_down`);
  if (!rest) {
    if (process.argv.length > 4) console.log(`${key}: no rest`);
    continue;
  }
  const idle = sheet.anims.find((a) => a.key === `${key}_idle_down`);
  const names = [...(idle ? [idle.frames[0]] : []), ...new Set(rest.frames)];
  const at = new Map(sheet.atlas.rects.map((r) => [r.name, r]));
  rows.push({ fw: sheet.fw, fh: sheet.fh, cells: names.map((n) => at.get(n)!), sheet });
  console.log(`${key}: ${rest.frames.length} steps, ${new Set(rest.frames).size} frames, ${(rest.frames.length / rest.fps).toFixed(1)} s`);
}
if (rows.length === 0) process.exit(0);

const pad = 3;
const W = Math.max(...rows.map((r) => r.cells.length * (r.fw + pad) + pad)) * S;
const H = rows.reduce((h, r) => h + r.fh + pad, pad) * S;
const img = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([40, 46, 40, 255], i * 4);
let oy = pad;
for (const r of rows) {
  const a = r.sheet.atlas;
  r.cells.forEach((cell, ci) => {
    const ox = pad + ci * (r.fw + pad);
    for (let y = 0; y < r.fh; y++)
      for (let x = 0; x < r.fw; x++) {
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
  oy += r.fh + pad;
}
writeFileSync(out, encodePNG(W, H, img));
console.log('wrote', out, W, H);
