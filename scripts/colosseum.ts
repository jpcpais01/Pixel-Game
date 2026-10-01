// Dev tool: paint the Aurora Colosseum as the game shows it, roughly: its sky,
// the colosseum lit by a cold moon (its normal map) with its glow added, the
// champions, the braziers, the arches kindled and the aurora's ribbons.
// Usage: npx tsx scripts/colosseum.ts [out.png] [scale] [x y w h]
import { writeFileSync } from 'node:fs';
import { encodePNG } from './png';
import { BRAZIER_OY, BRAZIER_W, STATUE_OY, STATUE_W, AURORA_H, AURORA_W, archGlowArt, auroraRibbon, frostArenaArt, frostBrazier, frostSkyArt, frostStatue } from '../src/art/frost';
import { BRAZIERS, FROST_H, FROST_W, GATES, STATUES, brazierAt } from '../src/world/frostLayout';
import type { PixelCanvas } from '../src/art/pixel';

const out = process.argv[2] ?? 'colosseum.png';
const S = Number(process.argv[3] ?? 2);
const [cx, cy, cw, ch] = process.argv.length > 7 ? process.argv.slice(4, 8).map(Number) : [0, 0, FROST_W, FROST_H];

const run = <T>(g: Generator<void, T, void>): T => {
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
};
const W = FROST_W;
const H = FROST_H;
const img = new Float32Array(W * H * 3);
const sky = run(frostSkyArt());
for (let i = 0; i < W * H; i++) for (let k = 0; k < 3; k++) img[i * 3 + k] = sky[i * 4 + k];

// The moon's light, and the cold sky's, as the arena sets them.
const sun = [-0.3, 0.5, 0.8];
const sl = Math.hypot(...sun);
const sunC = [0.5, 0.62, 0.9];
const skyC = [0.42, 0.52, 0.78];
const lit = (d: number[], n: number[], k: number) => {
  const nd = (n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]) / sl;
  return d[k] * (skyC[k] * 0.55 + sunC[k] * Math.max(0, nd) * 0.75);
};

const addLight = (px: Uint8ClampedArray, w: number, h: number, x0: number, y0: number, k: number) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x0 + x;
    const Y = y0 + y;
    if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    for (let c = 0; c < 3; c++) img[(Y * W + X) * 3 + c] += px[(y * w + x) * 4 + c] * k;
  }
};
const glow = process.env.GLOW ? Number(process.env.GLOW) : 0;
for (let i = 0; i < 2; i++) for (let x = -AURORA_W; x < W; x += AURORA_W) addLight(auroraRibbon([0.7, 2.9][i]), AURORA_W, AURORA_H, x + i * 130, i * 20 - 10, 0.35);
const arena = run(frostArenaArt());
for (let i = 0; i < W * H; i++) {
  if (!arena.diffuse[i * 4 + 3]) continue;
  const d = [arena.diffuse[i * 4], arena.diffuse[i * 4 + 1], arena.diffuse[i * 4 + 2]];
  const n = [arena.normal[i * 4] / 127.5 - 1, arena.normal[i * 4 + 1] / 127.5 - 1, arena.normal[i * 4 + 2] / 127.5 - 1];
  for (let k = 0; k < 3; k++) img[i * 3 + k] = lit(d, n, k) + arena.emissive[i * 4 + k] * 0.9;
}

const stamp = (c: PixelCanvas, x0: number, y0: number) => {
  const r = c.render();
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const X = x0 + x;
    const Y = y0 + y;
    if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const i = (y * c.w + x) * 4;
    const o = (Y * W + X) * 3;
    const a = r.diffuse[i + 3] / 255;
    for (let k = 0; k < 3; k++) img[o + k] = img[o + k] * (1 - a) + r.diffuse[i + k] * a * 0.62 * [0.8, 0.9, 1.1][k] + r.emissive[i + k] * 0.9;
  }
};
for (const g of GATES) {
  if (g.kind !== 'arch') continue;
  const a = archGlowArt(g);
  addLight(a.px, a.w, a.h, a.x, a.y, glow);
}
const things: { y: number; draw: () => void }[] = [];
for (const s of STATUES) things.push({ y: s.y, draw: () => stamp(frostStatue(s.v), s.x - STATUE_W / 2, s.y - STATUE_OY) });
BRAZIERS.forEach((deg, i) => {
  const b = brazierAt(deg);
  things.push({ y: b.foot, draw: () => stamp(frostBrazier(i % 6), b.x - BRAZIER_W / 2, b.y - BRAZIER_OY) });
});
things.sort((a, b) => a.y - b.y).forEach((t) => t.draw());

const OW = cw * S;
const OH = ch * S;
const px = new Uint8ClampedArray(OW * OH * 4);
for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
  const i = ((cy + Math.floor(y / S)) * W + cx + Math.floor(x / S)) * 3;
  px.set([Math.min(255, img[i]), Math.min(255, img[i + 1]), Math.min(255, img[i + 2]), 255], (y * OW + x) * 4);
}
writeFileSync(out, encodePNG(OW, OH, px));
console.log(out, OW, OH);
