// Dev tool: paint a patch of the Everwood, ground and all that stands on it,
// by day, to a PNG, for judging the look without running the game.
// Usage: npx tsx scripts/forest.ts [out.png] [seed] [dx] [dy] [w] [h]
// (dx, dy): the patch's middle, from the forest's start.
import { writeFileSync } from 'node:fs';
import { STRIP_H, buildStrip } from '../src/art/ground';
import { CAMPFIRE, CAMPFIRE_FOOT, CHEST_BASE_Y, FPROP_BASE_Y, FPROP_FRAMES, FPROP_LOOKS, GREATCAP_BASE_Y, HUNT_BASE_Y, LOOKOUT_BASE_Y, MENHIR_BASE_Y, SHRINE_BASE_Y, chestArt, greatCapArt, leanToArt, lookoutArt, menhirArt, rackArt, shrineArt, type FPropKind } from '../src/art/forest';
import { PILLAR_BASE, RUIN_H_BASE, RUIN_V_BASE, pillar, ruinH, ruinV } from '../src/art/garden';
import { rock } from '../src/art/env';
import type { PixelCanvas, RenderedFrame } from '../src/art/pixel';
import { ELDER_BASE_Y, PROP_BASE_Y, PROP_FRAMES, TREE_BASE_Y, cherryTree, elderTree, mapleTree, treeFrame, willowTree } from '../src/art/trees';
import { CAMP_SEATS, CHUNK, ForestGen, LOOK_RAIL, ruinPieces, stonePieces, wildPieces } from '../src/world/forestGen';
import { forestTile } from '../src/world/forestGround';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'forest.png';
const seed = Number(process.argv[3] ?? 2718);
const gen = new ForestGen(seed);
const start = gen.spawn();
const cx = start.x + Number(process.argv[4] ?? 0);
const cy = start.y + Number(process.argv[5] ?? 0);
const W = Number(process.argv[6] ?? 640);
const H = Number(process.argv[7] ?? 400);
const x0 = Math.round(cx - W / 2);
const y0 = Math.round(cy - H / 2);
const img = new Uint8ClampedArray(W * H * 4);

// The ground, tile by tile, timed.
let tiles = 0;
let ms = 0;
for (let col = Math.floor(x0 / CHUNK); col <= Math.floor((x0 + W - 1) / CHUNK); col++) {
  for (let row = Math.floor(y0 / STRIP_H); row <= Math.floor((y0 + H - 1) / STRIP_H); row++) {
    const t0 = performance.now();
    const g = buildStrip(forestTile(gen, col, row), row);
    let r = g.next();
    while (!r.done) r = g.next();
    ms += performance.now() - t0;
    tiles++;
    const s = r.value;
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const X = col * CHUNK + x - x0;
        const Y = row * STRIP_H + y - y0;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const i = (y * s.w + x) * 4;
        const o = (Y * W + X) * 4;
        for (let c = 0; c < 3; c++) img[o + c] = Math.min(255, s.day.diffuse[i + c] + (s.emissive ? s.emissive[i + c] * 0.3 : 0));
        img[o + 3] = 255;
      }
    }
  }
}
console.log(`${tiles} tiles, ${(ms / tiles).toFixed(1)} ms each`);

const cache = new Map<string, RenderedFrame & { w: number; h: number }>();
const frame = (key: string, draw: () => PixelCanvas) => {
  let f = cache.get(key);
  if (!f) {
    const c = draw();
    f = Object.assign(c.render(), { w: c.w, h: c.h });
    cache.set(key, f);
  }
  return f;
};
const things: { y: number; draw: () => void }[] = [];
const put = (key: string, draw: () => PixelCanvas, x: number, y: number, footY: number, flip = false, footX?: number) =>
  things.push({
    y,
    draw: () => {
      const f = frame(key, draw);
      const fx = footX ?? f.w / 2;
      for (let j = 0; j < f.h; j++) {
        for (let i = 0; i < f.w; i++) {
          const si = ((j * f.w + (flip ? f.w - 1 - i : i)) * 4);
          const a = f.diffuse[si + 3] / 255;
          if (!a) continue;
          const X = Math.round(x - fx + i) - x0;
          const Y = Math.round(y - footY + j) - y0;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const o = (Y * W + X) * 4;
          for (let c = 0; c < 3; c++) img[o + c] = Math.min(255, img[o + c] * (1 - a) + f.diffuse[si + c] * a + f.emissive[si + c] * 0.4);
        }
      }
    },
  });

const drawTree: Record<string, (v: number) => PixelCanvas> = {
  oak: (v) => treeFrame('oak', v, 0),
  birch: (v) => treeFrame('birch', v, 0),
  pine: (v) => treeFrame('pine', v, 0),
  cherry: (v) => cherryTree(v),
  maple: (v) => mapleTree(v),
  willow: (v) => willowTree(v),
};
const flora = (name: string) => PROP_FRAMES.find((f) => f.name === name)!.draw;
for (let ccy = Math.floor(y0 / CHUNK); ccy <= Math.floor((y0 + H + 200) / CHUNK); ccy++) {
  for (let ccx = Math.floor((x0 - 60) / CHUNK); ccx <= Math.floor((x0 + W + 60) / CHUNK); ccx++) {
    const l = gen.layout(ccx, ccy);
    for (const t of l.trees) put(`${t.kind}${t.v}`, () => drawTree[t.kind](t.v), t.x, t.y, TREE_BASE_Y, t.flip);
    for (const p of l.props) {
      const map: Record<string, string> = { bush: 'bush0', berry: 'bush1', fern: `fern${p.v % 2}`, stump: `stump${p.v % 2}`, log: 'log0', glowcap: 'shrooms0', redcap: 'shrooms1' };
      if (p.kind === 'rock') put(`rock${p.v % 3}`, () => rock([1, 2, 5][p.v % 3]), p.x, p.y, 12);
      else if (map[p.kind]) put(map[p.kind], flora(map[p.kind]), p.x, p.y, PROP_BASE_Y, p.flip && p.kind !== 'log');
      else {
        const k = p.kind as FPropKind;
        const name = `${k}${p.v % FPROP_LOOKS[k]}`;
        put(name, FPROP_FRAMES.find((f) => f.name === name)!.draw, p.x, p.y, FPROP_BASE_Y, p.flip);
      }
    }
    for (const p of l.pois) {
      if (p.kind === 'campfire') {
        put('camp', () => CAMPFIRE.draw(0), p.x, p.y, CAMPFIRE_FOOT.y, false, CAMPFIRE_FOOT.x);
        for (const s of CAMP_SEATS) put(`stump${s.v}`, flora(`stump${s.v}`), p.x + s.x, p.y + s.y, PROP_BASE_Y);
      } else if (p.kind === 'shrine') put('shrine', () => shrineArt(0), p.x, p.y, SHRINE_BASE_Y);
      else if (p.kind === 'chest') put('chest', () => chestArt(false), p.x, p.y, CHEST_BASE_Y);
      else if (p.kind === 'elder') put('elder', () => elderTree(0), p.x, p.y, ELDER_BASE_Y);
      else if (p.kind === 'lookout') put('lookout', () => lookoutArt(), p.x, p.y + LOOK_RAIL, LOOKOUT_BASE_Y);
      else if (p.kind === 'stones') for (const s of stonePieces(p)) put(`m${s.v}`, () => menhirArt(s.v), s.x, s.y, MENHIR_BASE_Y);
      else if (p.kind === 'ruins') {
        for (const r of ruinPieces(p)) {
          if (gen.sample(r.x, r.y).trail <= 2) continue;
          if (r.kind === 'pillar') put(`p${r.v}`, () => pillar(r.v), r.x, r.y, PILLAR_BASE);
          else if (r.kind === 'wall_h') put(`h${r.v}`, () => ruinH(r.v), r.x, r.y, RUIN_H_BASE);
          else put(`v${r.v}`, () => ruinV(r.v), r.x, r.y, RUIN_V_BASE);
        }
      }
      else if (p.kind === 'glade' || p.kind === 'bog' || p.kind === 'glowcaps' || p.kind === 'brambles' || p.kind === 'camp') {
        const pc = wildPieces(p, gen);
        const fp = (k: string, x: number, y: number, flip = false) => put(k, FPROP_FRAMES.find((f) => f.name === k)!.draw, x, y, FPROP_BASE_Y, flip);
        if (p.kind === 'glade') for (const f of pc.small) fp(f.v < 5 ? `flowers${f.v % 4}` : `tuft${f.v % 3}`, f.x, f.y);
        if (p.kind === 'bog') for (const r of pc.small) fp(r.v < 2 ? `reeds${r.v}` : `tuft${(r.v - 2) % 3}`, r.x, r.y);
        if (p.kind === 'glowcaps') {
          put('greatcap', () => greatCapArt(false), p.x, p.y, GREATCAP_BASE_Y);
          for (const m of pc.main) fp(`bigshroom${m.v}`, m.x, m.y, (m.x + m.y) % 2 === 0);
          for (const m of pc.small) put('shrooms0', flora('shrooms0'), m.x, m.y, PROP_BASE_Y);
        }
        if (p.kind === 'brambles') for (const m of pc.main) put('bush1', flora('bush1'), m.x, m.y, PROP_BASE_Y, m.v % 2 === 0);
        if (p.kind === 'camp') {
          const [lean, rack, chest, seat] = pc.main;
          put('lean', leanToArt, lean.x, lean.y, HUNT_BASE_Y, lean.x > p.x);
          put('rack', rackArt, rack.x, rack.y, HUNT_BASE_Y, rack.v === 1);
          put('chest', () => chestArt(false), chest.x, chest.y, CHEST_BASE_Y);
          put(`stump${seat.v}`, flora(`stump${seat.v}`), seat.x, seat.y, PROP_BASE_Y);
          for (const f of pc.small) put('log0', flora('log0'), f.x, f.y, PROP_BASE_Y, lean.x > p.x);
        }
      }
      console.log(`place: ${p.kind} at ${p.x - start.x}, ${p.y - start.y}`);
    }
  }
}
things.sort((a, b) => a.y - b.y);
for (const t of things) t.draw();
const S = 2;
const big = new Uint8ClampedArray(W * S * H * S * 4);
for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) big.set(img.subarray(((y >> 1) * W + (x >> 1)) * 4, ((y >> 1) * W + (x >> 1)) * 4 + 4), (y * W * S + x) * 4);
writeFileSync(out, encodePNG(W * S, H * S, big));
