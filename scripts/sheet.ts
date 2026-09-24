// Dev tool: render a character's frames to a zoomed PNG contact sheet.
// Usage: npx tsx scripts/sheet.ts [outDir] [scale] [wizard|void|warrior|jade|paladin]
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildWizardFrames, FRAME_W as WIZ_W, FRAME_H as WIZ_H, ANIMS, DIRS, VOID_LOOK } from '../src/art/wizard';
import { buildWarriorFrames, JADE_LOOK, WARRIOR_W, WARRIOR_H, WARRIOR_ANIMS } from '../src/art/warrior';
import { buildPaladinFrames, PALADIN_W, PALADIN_H, PALADIN_ANIMS } from '../src/art/paladin';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'sheets';
const S = Number(process.argv[3] ?? 5);
const hero = process.argv[4] === 'warrior' || process.argv[4] === 'jade' ? 'warrior' : process.argv[4] === 'paladin' ? 'paladin' : 'wizard';
mkdirSync(out, { recursive: true });
const FRAME_W = hero === 'warrior' ? WARRIOR_W : hero === 'paladin' ? PALADIN_W : WIZ_W;
const FRAME_H = hero === 'warrior' ? WARRIOR_H : hero === 'paladin' ? PALADIN_H : WIZ_H;
const built: { anim: string; dir: string | null; canvas: { render(): ReturnType<ReturnType<typeof buildWizardFrames>[number]['canvas']['render']> } }[] =
  hero === 'warrior' ? buildWarriorFrames(process.argv[4] === 'jade' ? JADE_LOOK : undefined) : hero === 'paladin' ? buildPaladinFrames() : buildWizardFrames(process.argv[4] === 'void' ? VOID_LOOK : undefined);
const frames = built.map((f) => ({ ...f, r: f.canvas.render() }));
const rows: { anim: string; dir: string | null }[] = [];
for (const a of hero === 'warrior' ? WARRIOR_ANIMS : hero === 'paladin' ? PALADIN_ANIMS : ANIMS) for (const d of DIRS) rows.push({ anim: a.name, dir: d });
if (hero === 'warrior') rows.push({ anim: 'spin', dir: null });
const cols = Math.max(...rows.map((r) => frames.filter((f) => f.anim === r.anim && f.dir === r.dir).length));
const pad = 2;
const W = cols * (FRAME_W + pad) * S;
const H = rows.length * (FRAME_H + pad) * S;

for (const layer of ['composite', 'diffuse', 'normal', 'emissive'] as const) {
  const img = new Uint8ClampedArray(W * H * 4);
  const bg = layer === 'normal' ? [128, 128, 255] : [34, 38, 52];
  for (let i = 0; i < W * H; i++) img.set([bg[0], bg[1], bg[2], 255], i * 4);
  rows.forEach((row, ri) => {
    frames.filter((f) => f.anim === row.anim && f.dir === row.dir).forEach((f, ci) => {
      const ox = ci * (FRAME_W + pad) * S;
      const oy = ri * (FRAME_H + pad) * S;
      for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
        const i = (y * FRAME_W + x) * 4;
        let c: number[] | null = null;
        const d = f.r.diffuse, n = f.r.normal, e = f.r.emissive;
        if (layer === 'normal') c = n[i + 3] ? [n[i], n[i + 1], n[i + 2]] : null;
        else if (layer === 'emissive') c = e[i + 3] ? [e[i], e[i + 1], e[i + 2]] : null;
        else if (layer === 'diffuse') c = d[i + 3] ? [d[i], d[i + 1], d[i + 2]] : null;
        else {
          const base = d[i + 3] ? [d[i], d[i + 1], d[i + 2]] : bg;
          c = e[i + 3] ? base.map((v, k) => Math.min(255, v + e[i + k] * 0.6)) : d[i + 3] ? base : null;
        }
        if (!c) continue;
        for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
          img.set([c[0], c[1], c[2], 255], ((oy + y * S + sy) * W + ox + x * S + sx) * 4);
        }
      }
    });
  });
  writeFileSync(`${out}/${process.argv[4] === 'void' || process.argv[4] === 'jade' ? process.argv[4] : hero}_${layer}.png`, encodePNG(W, H, img));
}
console.log('frames', frames.length, 'sheet', W, H);
