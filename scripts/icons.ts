// Dev tool: write every app icon, plus a contact sheet, for reviewing the art.
// Usage: npx tsx scripts/icons.ts [outDir]
import { writeFileSync, mkdirSync } from 'node:fs';
import { ICONS, renderIcon } from '../src/art/icon';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'sheets/icons';
mkdirSync(out, { recursive: true });
const pad = 24;
const W = ICONS.reduce((s, i) => s + i.size + pad, pad);
const H = 512 + pad * 2;
const sheet = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) sheet.set([240, 240, 245, 255], i * 4);
let x0 = pad;
for (const spec of ICONS) {
  const px = renderIcon(spec);
  writeFileSync(`${out}/${spec.name}`, encodePNG(spec.size, spec.size, px));
  for (let y = 0; y < spec.size; y++) for (let x = 0; x < spec.size; x++) {
    const o = (y * spec.size + x) * 4;
    if (px[o + 3]) sheet.set(px.subarray(o, o + 4), ((pad + y) * W + x0 + x) * 4);
  }
  x0 += spec.size + pad;
}
writeFileSync(`${out}/_sheet.png`, encodePNG(W, H, sheet));
console.log('icons', ICONS.length, '->', out);
