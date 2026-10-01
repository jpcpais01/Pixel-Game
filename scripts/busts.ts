// Dev tool: paint the class medallions' busts, each in its disc on a plate,
// beside the class's hero sprite at the same zoom for comparison.
// Usage: npx tsx scripts/busts.ts [out.png] [scale] [class,class...]
import { writeFileSync } from 'node:fs';
import { BUST, classBust } from '../src/art/busts';
import { buildHeroSheet } from '../src/art/heroSheets';
import { encodePNG } from './png';

/** Each class and its first character's sheet. */
const CLASSES: [string, string][] = [
  ['mage', 'wizard'], ['warrior', 'warrior'], ['jedi', 'jedi'], ['alchemist', 'alchemist'], ['archer', 'archer'],
  ['duelist', 'rogue'], ['necromancer', 'necro'], ['mystic', 'druid'], ['automaton', 'mech'], ['phantom', 'polter'],
  ['inventor', 'engineer'], ['beast', 'eagle'],
];

const out = process.argv[2] ?? 'busts.png';
const S = Number(process.argv[3] ?? 6);
const only = process.argv[4]?.split(',');
const list = CLASSES.filter(([id]) => !only || only.includes(id));
const CELL = 40;
const COLS = Math.min(list.length, 5) * 2;
const ROWS = Math.ceil(list.length / 5);
const W = COLS * CELL * S;
const H = ROWS * CELL * S;
const img = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([22, 18, 44, 255], i * 4);

const put = (cx: number, cy: number, x: number, y: number, c: number[], a = 1) => {
  for (let yy = 0; yy < S; yy++)
    for (let xx = 0; xx < S; xx++) {
      const i = (((cy * CELL + y) * S + yy) * W + (cx * CELL + x) * S + xx) * 4;
      for (let k = 0; k < 3; k++) img[i + k] = Math.round(img[i + k] * (1 - a) + c[k] * a);
    }
};

list.forEach(([id, sheet], n) => {
  const cx = (n % 5) * 2;
  const cy = Math.floor(n / 5);
  const o = (CELL - BUST) / 2;
  const r = BUST / 2;
  // The plate.
  for (let y = 0; y < BUST + 6; y++)
    for (let x = 0; x < BUST + 6; x++) {
      const d = Math.hypot(x + 0.5 - r - 3, y + 0.5 - r - 3);
      if (d <= r + 3) put(cx, cy, x + o - 3, y + o - 3, d > r + 1.8 ? [214, 170, 80] : [70, 60, 110]);
    }
  const b = classBust(id);
  if (b)
    for (let y = 0; y < BUST; y++)
      for (let x = 0; x < BUST; x++) {
        if (Math.hypot(x + 0.5 - r, y + 0.5 - r) > r) continue;
        const i = (y * BUST + x) * 4;
        const a = b.diffuse[i + 3] / 255;
        if (a > 0) put(cx, cy, x + o, y + o, [0, 1, 2].map((k) => Math.min(255, b.diffuse[i + k] + b.emissive[i + k] * 0.5)), a);
      }
  // The hero, first idle frame facing down, at the same zoom.
  const s = buildHeroSheet(sheet);
  const f = s.atlas.rects.find((q) => /idle/.test(q.name) && /down/.test(q.name)) ?? s.atlas.rects[0];
  for (let y = 0; y < s.fh; y++)
    for (let x = 0; x < s.fw; x++) {
      const i = ((f.y + y) * s.atlas.w + f.x + x) * 4;
      const a = s.atlas.diffuse[i + 3] / 255;
      if (a > 0) put(cx + 1, cy, x + Math.floor((CELL - s.fw) / 2), y + Math.floor((CELL - s.fh) / 2), [...s.atlas.diffuse.subarray(i, i + 3)], a);
    }
});
writeFileSync(out, encodePNG(W, H, img));
