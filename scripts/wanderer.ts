// Dev tool: render Heaven Lands wanderers to a zoomed, roughly lit PNG: one
// row per appearance (the default, then random ones), a column per pose.
// Usage: npx tsx scripts/wanderer.ts [out.png] [scale] [count] [seed]
import { writeFileSync } from 'node:fs';
import { DEFAULT_LOOK, randomLook } from '../src/heaven/look';
import { wandererFrame, WFH, WFW } from '../src/heaven/art/sheet';
import type { View } from '../src/heaven/art/kit';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'wanderer.png';
const S = Number(process.argv[3] ?? 4);
const count = Number(process.argv[4] ?? 8);
let seed = Number(process.argv[5] ?? 7);
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const looks = [DEFAULT_LOOK, ...Array.from({ length: count - 1 }, () => randomLook(rand))];
const POSES: [Parameters<typeof wandererFrame>[1], View, number][] = [
  ['idle', 'down', 0], ['idle', 'side', 0], ['idle', 'up', 0], ['walk', 'down', 1], ['walk', 'side', 0], ['walk', 'side', 3],
  ['wave', 'down', 2], ['cheer', 'down', 2], ['dance', 'down', 1], ['sit', 'down', 0], ['heart', 'down', 2],
];
const L = (() => { const v = [-0.45, -0.55, 0.7]; const n = Math.hypot(...v); return v.map((k) => k / n); })();
const pad = 2;
const W = (POSES.length * (WFW + pad) + pad) * S;
const H = (looks.length * (WFH + pad) + pad) * S;
const img = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([64, 84, 70, 255], i * 4);
looks.forEach((a, ri) => POSES.forEach(([anim, view, f], ci) => {
  const r = wandererFrame(a, anim, view, f).render();
  const ox = pad + ci * (WFW + pad);
  const oy = pad + ri * (WFH + pad);
  for (let y = 0; y < WFH; y++) for (let x = 0; x < WFW; x++) {
    const i = (y * WFW + x) * 4;
    const on = r.diffuse[i + 3] > 0;
    const glow = r.emissive[i + 3] > 0;
    if (!on && !glow) continue;
    let c = [0, 0, 0];
    if (on) {
      const n = [r.normal[i] / 127.5 - 1, -(r.normal[i + 1] / 127.5 - 1), r.normal[i + 2] / 127.5 - 1];
      const lit = 0.55 + 0.6 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
      c = [r.diffuse[i] * lit, r.diffuse[i + 1] * lit, r.diffuse[i + 2] * lit];
    }
    if (glow) c = c.map((v, k) => v + r.emissive[i + k] * 0.7);
    c = c.map((v) => Math.min(255, v));
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) img.set([c[0], c[1], c[2], 255], (((oy + y) * S + sy) * W + (ox + x) * S + sx) * 4);
  }
}));
writeFileSync(out, encodePNG(W, H, img));
console.log(`${out}: ${W}x${H}`);
