// Dev tool: render Home parts (and a turning part's four views) to a zoomed PNG, on grass, for reviewing art.
// Usage: npx tsx scripts/home.ts [out.png] [scale] [id,id,...]   (no ids: every part from homeYard.ts and homeRoom.ts)
import { writeFileSync } from 'node:fs';
import { PROP_ART, PROP_TURNS, type PropArt } from '../src/art/homeProps';
import { YARD_ART, YARD_TURNS } from '../src/art/homeYard';
import { ROOM_ART, ROOM_TURNS } from '../src/art/homeRoom';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'home.png';
const S = Number(process.argv[3] ?? 4);
const ART: Record<string, PropArt> = { ...PROP_ART, ...YARD_ART, ...ROOM_ART };
const TURNS = { ...PROP_TURNS, ...YARD_TURNS, ...ROOM_TURNS };
const ids = process.argv[4] ? process.argv[4].split(',') : [...Object.keys(YARD_ART), ...Object.keys(ROOM_ART)];

// Each id: its front, then its right, back and left views when it turns.
const tiles: { c: ReturnType<PropArt['draw']> }[][] = ids.map((id) => {
  const a = ART[id];
  if (!a) throw new Error(`no art for ${id}`);
  const t = TURNS[id];
  const row = [{ c: a.draw(0) }];
  if (t) row.push({ c: t.side.draw(0) }, { c: t.back.draw(0) }, { c: t.side.draw(0).mirrored() });
  return row;
});
const GAP = 4;
const cols = 8;
const flat = tiles.flat();
const cw = Math.max(...flat.map((t) => t.c.w)) + GAP;
const ch = Math.max(...flat.map((t) => t.c.h)) + GAP;
const n = flat.length;
const W = Math.min(n, cols) * cw * S;
const H = Math.ceil(n / cols) * ch * S;
const img = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const g = ((x / S) >> 3) + ((y / S) >> 3);
  img.set([58 + (g % 2) * 4, 92 + (g % 2) * 5, 52, 255], (y * W + x) * 4);
}
flat.forEach((t, k) => {
  const r = t.c.render();
  const ox = (k % cols) * cw + (cw - t.c.w) / 2;
  const oy = Math.floor(k / cols) * ch + (ch - t.c.h);
  for (let y = 0; y < t.c.h; y++) for (let x = 0; x < t.c.w; x++) {
    const i = (y * t.c.w + x) * 4;
    const a = r.diffuse[i + 3] / 255;
    const e = [r.emissive[i], r.emissive[i + 1], r.emissive[i + 2]];
    if (!a && !(e[0] + e[1] + e[2])) continue;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const o = ((Math.round(oy + y) * S + sy) * W + Math.round(ox + x) * S + sx) * 4;
      for (let k2 = 0; k2 < 3; k2++) img[o + k2] = Math.min(255, img[o + k2] * (1 - a) + r.diffuse[i + k2] * a + e[k2] * 0.5);
    }
  }
});
writeFileSync(out, encodePNG(W, H, img));
