// Dev tool: render the Aurora Colosseum's creatures (and their spell
// textures) to a zoomed PNG, every pose facing right, on packed snow: each
// creature's poses lit as by day (top row) and in the colosseum's night with
// their glow added (bottom row); spells last.
// Usage: npx tsx scripts/mobs.ts <kind|weak|normal|strong|vargr|snowqueen|winterking|colossus|aurelith|shared> [out.png] [scale]
import { writeFileSync } from 'node:fs';
import type { MonsterSheet } from '../src/art/monsters';
import type { PixelCanvas } from '../src/art/pixel';
import type { FxRegistrar } from '../src/art/frostKit';
import { buildFlurrykinSheet, buildIcebeakSheet, buildRimespriteSheet, buildRimeweaverSheet, buildSnowmiteSheet, frostWeakFx } from '../src/art/frostWeak';
import { buildChillstoneSheet, buildFrostboundSheet, buildGaleclawSheet, buildRimefangSheet, buildRimewitchSheet, buildSnowstalkerSheet, frostNormalFx } from '../src/art/frostNormal';
import { buildFrostTrollSheet, buildFrostdrakeSheet, buildRimeknightSheet, buildTuskmawSheet, buildYetiSheet, frostStrongFx } from '../src/art/frostStrong';
import { buildVargrSheet, vargrFx } from '../src/art/vargr';
import { buildSnowQueenSheet, snowQueenFx } from '../src/art/snowQueen';
import { buildWinterKingSheet, winterKingFx } from '../src/art/winterKing';
import { buildColossusSheet, colossusFx } from '../src/art/colossus';
import { buildAurelithSheet, aurelithFx } from '../src/art/aurelith';
import { FZ_FLAKE, FZ_ICICLE_H, FZ_ICICLE_W, FZ_LANE_H, FZ_LANE_W, FZ_MIST_H, FZ_MIST_W, FZ_PATCH_H, FZ_PATCH_W, FZ_RING_H, FZ_RING_W, FZ_SHARD_H, FZ_SHARD_W, FZ_SNOWBALL, FZ_SPIKE_H, FZ_SPIKE_W, frostFlake, frostIcicle, frostLaneArt, frostMist, frostPatch, frostRing, frostShard, frostSnowball, frostSpike } from '../src/art/frostFx';
import { encodePNG } from './png';

const SHEETS: Record<string, () => MonsterSheet> = {
  snowmite: buildSnowmiteSheet,
  rimesprite: buildRimespriteSheet,
  icebeak: buildIcebeakSheet,
  rimeweaver: buildRimeweaverSheet,
  flurrykin: buildFlurrykinSheet,
  rimefang: buildRimefangSheet,
  frostbound: buildFrostboundSheet,
  rimewitch: buildRimewitchSheet,
  galeclaw: buildGaleclawSheet,
  chillstone: buildChillstoneSheet,
  snowstalker: buildSnowstalkerSheet,
  frost_troll: buildFrostTrollSheet,
  tuskmaw: buildTuskmawSheet,
  frostdrake: buildFrostdrakeSheet,
  yeti: buildYetiSheet,
  rimeknight: buildRimeknightSheet,
  vargr: buildVargrSheet,
  snowqueen: buildSnowQueenSheet,
  winterking: buildWinterKingSheet,
  colossus: buildColossusSheet,
  aurelith: buildAurelithSheet,
};
const GROUPS: Record<string, { kinds: string[]; fx: ((r: FxRegistrar) => void) | null }> = {
  weak: { kinds: ['snowmite', 'rimesprite', 'icebeak', 'rimeweaver', 'flurrykin'], fx: frostWeakFx },
  normal: { kinds: ['rimefang', 'frostbound', 'rimewitch', 'galeclaw', 'chillstone', 'snowstalker'], fx: frostNormalFx },
  strong: { kinds: ['frost_troll', 'tuskmaw', 'frostdrake', 'yeti', 'rimeknight'], fx: frostStrongFx },
  vargr: { kinds: ['vargr'], fx: vargrFx },
  snowqueen: { kinds: ['snowqueen'], fx: snowQueenFx },
  winterking: { kinds: ['winterking'], fx: winterKingFx },
  colossus: { kinds: ['colossus'], fx: colossusFx },
  aurelith: { kinds: ['aurelith'], fx: aurelithFx },
  shared: { kinds: [], fx: null },
};

const what = process.argv[2] ?? 'weak';
const out = process.argv[3] ?? `${what}.png`;
const S = Number(process.argv[4] ?? 5);

/** One picture to lay out: a lit canvas (with a glow layer), or plain pixels. */
type Item = { w: number; h: number; lit?: PixelCanvas; px?: Uint8ClampedArray };
const rows: Item[][] = [];

const group = GROUPS[what] ?? { kinds: [what], fx: null };
for (const kind of group.kinds) {
  const sh = SHEETS[kind]();
  rows.push(sh.frames.filter((f) => f.name.endsWith('_r')).map((f) => ({ w: sh.w, h: sh.h, lit: f.canvas })));
}
const fx: Item[] = [];
const reg: FxRegistrar = {
  frames: (_k, list, w, h) => list.forEach((f) => fx.push({ w, h, lit: f.canvas })),
  image: (_k, w, h, px) => fx.push({ w, h, px }),
  strip: (_k, w, h, frames) => frames.forEach((px) => fx.push({ w, h, px })),
  anim: () => {},
};
if (what === 'shared') {
  [0, 1, 2].forEach((v) => fx.push({ w: FZ_SPIKE_W, h: FZ_SPIKE_H, lit: frostSpike(v) }));
  fx.push({ w: FZ_ICICLE_W, h: FZ_ICICLE_H, lit: frostIcicle() }, { w: FZ_SNOWBALL, h: FZ_SNOWBALL, lit: frostSnowball() });
  fx.push({ w: FZ_SHARD_W, h: FZ_SHARD_H, px: frostShard() }, { w: FZ_LANE_W, h: FZ_LANE_H, px: frostLaneArt() }, { w: FZ_FLAKE, h: FZ_FLAKE, px: frostFlake() }, { w: FZ_MIST_W, h: FZ_MIST_H, px: frostMist() });
  [0, 1].forEach((f) => fx.push({ w: FZ_RING_W, h: FZ_RING_H, px: frostRing(f) }));
  [0, 1].forEach((f) => fx.push({ w: FZ_PATCH_W, h: FZ_PATCH_H, px: frostPatch(f) }));
} else group.fx?.(reg);
// Spells in rows of up to eight.
for (let i = 0; i < fx.length; i += 8) rows.push(fx.slice(i, i + 8));

const pad = 4;
const rowH = rows.map((r) => Math.max(...r.map((i) => i.h)) + pad);
const W = Math.max(...rows.map((r) => r.reduce((a, i) => a + i.w + pad, pad))) * S;
// Each row twice: by day, then at night with the glow.
const H = rowH.reduce((a, h) => a + h * 2, pad) * S;
const img = new Uint8ClampedArray(W * H * 4);
let oy = pad;
const fill = (x0: number, y0: number, w: number, h: number, night: boolean) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const g = ((x >> 2) + (y >> 2)) & 1;
    const c = night ? [22 + g * 3, 30 + g * 3, 52 + g * 4] : [196 + g * 6, 208 + g * 6, 228 + g * 4];
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) img.set([c[0], c[1], c[2], 255], ((y * S + sy) * W + x * S + sx) * 4);
  }
};
fill(0, 0, W / S, H / S, false);
rows.forEach((row, ri) => {
  for (const night of [false, true]) {
    fill(0, oy - pad / 2, W / S, rowH[ri], night);
    let ox = pad;
    for (const it of row) {
      const r = it.lit?.render();
      for (let y = 0; y < it.h; y++) for (let x = 0; x < it.w; x++) {
        const i = (y * it.w + x) * 4;
        const o0 = ((oy + y) * S * W + (ox + x) * S) * 4;
        const base = [img[o0], img[o0 + 1], img[o0 + 2]];
        let c: number[] | null = null;
        if (r) {
          const a = r.diffuse[i + 3] / 255;
          const e = [r.emissive[i], r.emissive[i + 1], r.emissive[i + 2]];
          if (!a && !(e[0] || e[1] || e[2])) continue;
          const dim = night ? 0.42 : 1;
          c = [0, 1, 2].map((k) => Math.min(255, base[k] * (1 - a) + r.diffuse[i + k] * a * dim * (night ? [0.8, 0.9, 1.15][k] : 1) + e[k] * (night ? 0.9 : 0.25)));
        } else if (it.px) {
          const p = it.px;
          if (!p[i + 3]) continue;
          // Light drawn added on the night rows; drawn as is by day.
          c = night ? [0, 1, 2].map((k) => Math.min(255, base[k] + p[i + k])) : [0, 1, 2].map((k) => base[k] * (1 - p[i + 3] / 255) + p[i + k] * (p[i + 3] / 255));
        }
        if (!c) continue;
        for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) img.set([c[0], c[1], c[2], 255], ((oy + y) * S * W + sy * W + (ox + x) * S + sx) * 4);
      }
      ox += it.w + pad;
    }
    oy += rowH[ri];
  }
});
writeFileSync(out, encodePNG(W, H, img));
console.log(out, W, H);
