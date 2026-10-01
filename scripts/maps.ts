// Dev tool: paint the maps' art to PNGs for judging the look: the icon sheet,
// the Clearing's and the Sunken Garden's minimaps, and a patch of the
// Everwood's explorer's map round its start (half of it still unwalked).
// Usage: npx tsx scripts/maps.ts [outdir] [scale]
import { writeFileSync } from 'node:fs';
import { MAP_CELL, TREK_T, blankTile, fogTile, groundMapBase, mapIconSheet, reliefMap, stampCrowns, trekTile } from '../src/art/mapArt';
import { CLEARING_GROUND, clearingScenery, clearingWalkable } from '../src/world/clearing';
import { GARDEN_GROUND, gardenScenery, gardenWalkable } from '../src/world/sunken';
import { TREE_SHAPE } from '../src/world/common';
import { CHUNK, ForestGen } from '../src/world/forestGen';
import { encodePNG } from './png';

const dir = process.argv[2] ?? '.';
const S = Number(process.argv[3] ?? 4);

function save(name: string, w: number, h: number, px: Uint8ClampedArray, s = S): void {
  const out = new Uint8ClampedArray(w * s * h * s * 4);
  for (let y = 0; y < h * s; y++) for (let x = 0; x < w * s; x++) {
    const i = (Math.floor(y / s) * w + Math.floor(x / s)) * 4;
    const o = (y * w * s + x) * 4;
    out[o] = px[i]; out[o + 1] = px[i + 1]; out[o + 2] = px[i + 2]; out[o + 3] = px[i + 3] || 0;
  }
  writeFileSync(`${dir}/${name}`, encodePNG(w * s, h * s, out));
  console.log(`${dir}/${name}`);
}

const icons = mapIconSheet();
save('map-icons.png', icons.w, icons.h, icons.px, 8);

for (const [name, spec, scenery, walkable] of [['clearing', CLEARING_GROUND, clearingScenery, clearingWalkable], ['garden', GARDEN_GROUND, gardenScenery, gardenWalkable]] as const) {
  const t0 = performance.now();
  const g = groundMapBase(spec, spec.w, spec.h);
  let r = g.next();
  while (!r.done) r = g.next();
  const base = r.value;
  stampCrowns(base, scenery().trees.map((t) => ({ x: t.x, y: t.y, kind: t.kind, r: TREE_SHAPE[t.kind].canopyR })));
  const walk = new Uint8Array(base.w * base.h);
  for (let j = 0; j < base.h; j++) for (let i = 0; i < base.w; i++) walk[j * base.w + i] = walkable(i * MAP_CELL + 4, j * MAP_CELL + 4) ? 1 : 0;
  const px = reliefMap(base, walk);
  console.log(name, (performance.now() - t0).toFixed(0), 'ms');
  save(`map-${name}.png`, base.w, base.h, px);
}

const gen = new ForestGen(2718);
const st = gen.spawn();
const C0 = Math.floor(st.x / CHUNK) - 4;
const R0 = Math.floor(st.y / CHUNK) - 3;
const NC = 9, NR = 6;
const W = NC * TREK_T, H = NR * TREK_T;
const img = new Uint8ClampedArray(W * H * 4);
const t0 = performance.now();
for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
  const terrain = trekTile(gen, C0 + c, R0 + r, () => false);
  // Walked: a band through the middle and round the start.
  const tile = fogTile(terrain, blankTile(C0 + c, R0 + r), C0 + c, R0 + r, (fx, fy) => {
    const x = fx * 64 + 32, y = fy * 64 + 32;
    return Math.hypot(x - st.x, (y - st.y) * 1.4) < 700 || (Math.abs(y - st.y + 0.3 * (x - st.x)) < 160 && x > st.x);
  });
  for (let y = 0; y < TREK_T; y++) for (let x = 0; x < TREK_T; x++) {
    const i = (y * TREK_T + x) * 4, o = ((r * TREK_T + y) * W + c * TREK_T + x) * 4;
    img[o] = tile[i]; img[o + 1] = tile[i + 1]; img[o + 2] = tile[i + 2]; img[o + 3] = 255;
  }
}
console.log('trek', ((performance.now() - t0) / (NC * NR)).toFixed(1), 'ms a tile');
save('map-everwood.png', W, H, img, 3);

// The Home's map: its grounds in relief with the starter home's builds laid over them.
{
  const { HOME_GROUND, homeScenery, homeWalkable } = await import('../src/world/homeGround');
  const { COLS, ROWS, PLOT_X, PLOT_Y, PLOT_W, PLOT_H, starterHome } = await import('../src/world/homeLayout');
  const { BUILD_PX, paintBuilds } = await import('../src/art/mapBuilds');
  const g = groundMapBase(HOME_GROUND, HOME_GROUND.w, HOME_GROUND.h);
  let r = g.next();
  while (!r.done) r = g.next();
  const base = r.value;
  stampCrowns(base, homeScenery().trees.map((t) => ({ x: t.x, y: t.y, kind: t.kind, r: TREE_SHAPE[t.kind].canopyR })));
  const walk = new Uint8Array(base.w * base.h);
  for (let j = 0; j < base.h; j++) for (let i = 0; i < base.w; i++) {
    const x = i * MAP_CELL + 4, y = j * MAP_CELL + 4;
    walk[j * base.w + i] = (x >= PLOT_X && y >= PLOT_Y && x < PLOT_X + PLOT_W && y < PLOT_Y + PLOT_H) || homeWalkable(x, y) ? 1 : 0;
  }
  const px = reliefMap(base, walk);
  const over = paintBuilds(starterHome(), 0, 0, COLS, ROWS);
  const ow = COLS * BUILD_PX, ox = PLOT_X / MAP_CELL, oy = PLOT_Y / MAP_CELL;
  for (let j = 0; j < ROWS * BUILD_PX; j++) for (let i = 0; i < ow; i++) {
    const s = (j * ow + i) * 4, a = over[s + 3] / 255;
    if (!a) continue;
    const d = ((oy + j) * base.w + ox + i) * 4;
    for (let k = 0; k < 3; k++) px[d + k] = over[s + k] * a + px[d + k] * (1 - a);
  }
  save('map-home.png', base.w, base.h, px);
}
