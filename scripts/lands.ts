// Dev tool: paint a patch of a Heaven Lands land (src/heaven/lands/), its
// ground and all that stands on it, roughly lit, to a PNG, for judging the
// look without running the game.
// Usage: npx tsx scripts/lands.ts <landId> [out.png] [scale] [x y w h]
// (x, y): the patch's middle, from where a wanderer first stands. NIGHT=1
// paints it by night, glowing things and lanterns lit.
import { writeFileSync } from 'node:fs';
import type { RenderedFrame } from '../src/art/pixel';
import { landGen, landSheets } from '../src/heaven/lands/gens';
import { paintTile } from '../src/heaven/lands/paint';
import { CHUNK, TILE_H, TILE_W, type SheetDef } from '../src/heaven/lands/types';
import { encodePNG } from './png';

const id = process.argv[2] ?? 'shore';
const out = process.argv[3] ?? `${id}.png`;
const S = Math.max(1, Number(process.argv[4] ?? 2));
const gen = landGen(id);
if (!gen) throw new Error(`no land '${id}'`);
const night = process.env.NIGHT === '1';
const start = gen.spawn();
const W = Number(process.argv[7] ?? 480);
const H = Number(process.argv[8] ?? 320);
const x0 = Math.round(start.x + Number(process.argv[5] ?? 0) - W / 2);
const y0 = Math.round(start.y + Number(process.argv[6] ?? 0) - H / 2);
const img = new Float32Array(W * H * 3);
const glow = new Float32Array(W * H * 3);

// The ground, tile by tile, timed.
let tiles = 0;
let ms = 0;
for (let col = Math.floor(x0 / TILE_W); col <= Math.floor((x0 + W - 1) / TILE_W); col++) {
  for (let row = Math.floor(y0 / TILE_H); row <= Math.floor((y0 + H - 1) / TILE_H); row++) {
    const t0 = performance.now();
    const t = paintTile(gen.ground, col, row);
    ms += performance.now() - t0;
    tiles++;
    const src = night ? t.night : t.day;
    for (let y = 0; y < t.h; y++) {
      for (let x = 0; x < t.w; x++) {
        const X = col * TILE_W + x - x0;
        const Y = row * TILE_H + y - y0;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const i = (y * t.w + x) * 4;
        const o = (Y * W + X) * 3;
        for (let c = 0; c < 3; c++) {
          img[o + c] = src[i + c];
          if (night && t.glow) glow[o + c] += t.glow[i + c];
        }
      }
    }
  }
}
console.log(`${tiles} tiles, ${(ms / tiles).toFixed(1)} ms each`);

// What stands, sorted by its feet.
const sheets = new Map<string, SheetDef>(landSheets(id).map((s) => [s.key, s]));
const cache = new Map<string, RenderedFrame>();
const frame = (sheet: SheetDef, name: string): RenderedFrame => {
  const k = `${sheet.key}/${name}`;
  let f = cache.get(k);
  if (!f) {
    const def = sheet.frames.find((q) => q.name === name);
    if (!def) throw new Error(`no frame ${k}`);
    cache.set(k, (f = def.draw().render()));
  }
  return f;
};
const things: { y: number; draw: () => void }[] = [];
const lamps: { x: number; y: number; r: number; color: number }[] = [];
const put = (key: string, name: string, x: number, y: number, flip = false, sortY = 0) => {
  const sh = sheets.get(key);
  if (!sh) throw new Error(`no sheet ${key}`);
  things.push({
    y: y + sortY,
    draw: () => {
      const f = frame(sh, name);
      for (let j = 0; j < sh.h; j++) {
        for (let i = 0; i < sh.w; i++) {
          const si = (j * sh.w + (flip ? sh.w - 1 - i : i)) * 4;
          const a = f.diffuse[si + 3] / 255;
          const X = Math.round(x - sh.footX + i) - x0;
          const Y = Math.round(y - sh.footY + j) - y0;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const o = (Y * W + X) * 3;
          for (let c = 0; c < 3; c++) {
            if (a) img[o + c] = img[o + c] * (1 - a) + (night ? dim(f.diffuse[si + c], c) : f.diffuse[si + c]) * a;
            if (night && f.emissive[si + 3]) glow[o + c] += f.emissive[si + c];
          }
        }
      }
    },
  });
};
/** Props by night: moonlit, roughly as the world's light does it. */
const dim = (v: number, c: number) => v * [0.22, 0.28, 0.42][c] + [4, 6, 14][c];

for (let cy = Math.floor((y0 - 100) / CHUNK); cy <= Math.floor((y0 + H + 100) / CHUNK); cy++) {
  for (let cx = Math.floor((x0 - 60) / CHUNK); cx <= Math.floor((x0 + W + 60) / CHUNK); cx++) {
    const l = gen.layout(cx, cy);
    for (const p of l.props) put(p.sheet, p.frame, p.x, p.y, p.flip, p.sortY);
    for (const s of l.life) {
      const walker = s.kind === 'crab' ? 'shore_crab' : null;
      if (walker) put(walker, 'i0', s.x, s.y);
    }
    for (const L of l.lights) lamps.push({ x: L.x, y: L.y, r: L.radius, color: L.color });
  }
}
// A line of foam along the water, as the waves leave it (the shore's own).
if (sheets.has('shore_foam') && 'shore' in gen) {
  const shore = (gen as unknown as { shore(x: number): number }).shore.bind(gen);
  for (let x = Math.floor(x0 / 20) * 20; x < x0 + W + 20; x += 20) put('shore_foam', `f${(x / 20) % 2}`, x, Math.round(shore(x)) - 1, (x / 20) % 3 === 0, -1e6);
}
things.sort((a, b) => a.y - b.y);
for (const t of things) t.draw();

// By night the lanterns pool their light on the ground, and what glows glows.
if (night) {
  for (const L of lamps) {
    const cr = [(L.color >> 16) & 255, (L.color >> 8) & 255, L.color & 255];
    for (let y = Math.floor(L.y - L.r); y <= L.y + L.r; y++) {
      for (let x = Math.floor(L.x - L.r); x <= L.x + L.r; x++) {
        const X = x - x0;
        const Y = y - y0;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const d = Math.hypot(x - L.x, (y - L.y - 18) * 1.3) / L.r;
        if (d >= 1) continue;
        const k = (1 - d) * (1 - d) * 1.1;
        const o = (Y * W + X) * 3;
        for (let c = 0; c < 3; c++) img[o + c] += img[o + c] * (cr[c] / 255) * k * 2.2;
      }
    }
  }
}

const px = new Uint8ClampedArray(W * S * H * S * 4);
for (let y = 0; y < H * S; y++) {
  for (let x = 0; x < W * S; x++) {
    const i = (Math.floor(y / S) * W + Math.floor(x / S)) * 3;
    const o = (y * W * S + x) * 4;
    for (let c = 0; c < 3; c++) px[o + c] = img[i + c] + glow[i + c] * 0.8;
    px[o + 3] = 255;
  }
}
writeFileSync(out, encodePNG(W * S, H * S, px));
console.log(`wrote ${out} (${W}x${H} at ${S}x), start ${start.x}, ${start.y}`);
