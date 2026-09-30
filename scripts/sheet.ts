// Dev tool: render a character's frames to a zoomed PNG contact sheet.
// Usage: npx tsx scripts/sheet.ts [outDir] [scale] [wizard|void|pyro|pumpkin|tide|abyss|warrior|jade|headless|king|afonso|paladin|crusader|jedi|sith|warlord|master|fighter|monk|alchemist|witch|chem|archer|storm|scarecrow|rogue|dancer]
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildWizardFrames, FRAME_W as WIZ_W, FRAME_H as WIZ_H, ANIMS, DIRS, PYRO_LOOK, VOID_LOOK, TIDE_LOOK, ABYSS_LOOK, PUMPKIN_LOOK } from '../src/art/wizard';
import { AFONSO_LOOK, buildWarriorFrames, HEADLESS_LOOK, JADE_LOOK, KING_LOOK, WARRIOR_W, WARRIOR_H, warriorAnimsFor, KNIGHT_LOOK } from '../src/art/warrior';
import { buildPaladinFrames, CRUSADER_LOOK, PALADIN_W, PALADIN_H, PALADIN_ANIMS } from '../src/art/paladin';
import { buildJediFrames, JEDI_W, JEDI_H, jediAnimsFor, JEDI_LOOK, MASTER_LOOK, SITH_LOOK, WARLORD_LOOK } from '../src/art/jedi';
const jediLook = (a: string | undefined) => (a === 'sith' ? SITH_LOOK : a === 'warlord' ? WARLORD_LOOK : a === 'master' ? MASTER_LOOK : JEDI_LOOK);
import { buildFighterFrames, CHAMP_LOOK, FIGHTER_W, FIGHTER_H, FIGHTER_ANIMS, MONK_LOOK } from '../src/art/fighter';
import { buildAlchemistFrames, ALCH_W, ALCH_H, ALCHEMIST_ANIMS, WITCH_LOOK, CHEM_LOOK } from '../src/art/alchemist';
import { buildArcherFrames, ARCHER_W, ARCHER_H, ARCHER_ANIMS, STORM_LOOK, SCARECROW_LOOK } from '../src/art/archer';
import { buildRogueFrames, ROGUE_W, ROGUE_H, ROGUE_ANIMS, DANCER_LOOK } from '../src/art/rogue';
import { encodePNG } from './png';

const out = process.argv[2] ?? 'sheets';
const S = Number(process.argv[3] ?? 5);
const arg = process.argv[4];
const hero = arg === 'rogue' || arg === 'dancer' ? 'rogue' : arg === 'archer' || arg === 'storm' || arg === 'scarecrow' ? 'archer' : arg === 'alchemist' || arg === 'witch' || arg === 'chem' ? 'alchemist' : arg === 'fighter' || arg === 'monk' || arg === 'champ' ? 'fighter' : arg === 'warrior' || arg === 'jade' || arg === 'headless' || arg === 'king' || arg === 'afonso' ? 'warrior' : arg === 'paladin' || arg === 'crusader' ? 'paladin' : arg === 'jedi' || arg === 'sith' || arg === 'warlord' || arg === 'master' ? 'jedi' : 'wizard';
mkdirSync(out, { recursive: true });
const warriorLook = arg === 'jade' ? JADE_LOOK : arg === 'headless' ? HEADLESS_LOOK : arg === 'king' ? KING_LOOK : arg === 'afonso' ? AFONSO_LOOK : KNIGHT_LOOK;
const FRAME_W = hero === 'rogue' ? ROGUE_W : hero === 'archer' ? ARCHER_W : hero === 'alchemist' ? ALCH_W : hero === 'fighter' ? FIGHTER_W : hero === 'jedi' ? JEDI_W : hero === 'warrior' ? WARRIOR_W : hero === 'paladin' ? PALADIN_W : WIZ_W;
const FRAME_H = hero === 'rogue' ? ROGUE_H : hero === 'archer' ? ARCHER_H : hero === 'alchemist' ? ALCH_H : hero === 'fighter' ? FIGHTER_H : hero === 'jedi' ? JEDI_H : hero === 'warrior' ? WARRIOR_H : hero === 'paladin' ? PALADIN_H : WIZ_H;
const built: { anim: string; dir: string | null; canvas: { render(): ReturnType<ReturnType<typeof buildWizardFrames>[number]['canvas']['render']> } }[] =
  hero === 'rogue' ? buildRogueFrames(arg === 'dancer' ? DANCER_LOOK : undefined) : hero === 'archer' ? buildArcherFrames(arg === 'storm' ? STORM_LOOK : arg === 'scarecrow' ? SCARECROW_LOOK : undefined) : hero === 'alchemist' ? buildAlchemistFrames(arg === 'witch' ? WITCH_LOOK : arg === 'chem' ? CHEM_LOOK : undefined) : hero === 'fighter' ? buildFighterFrames(arg === 'monk' ? MONK_LOOK : arg === 'champ' ? CHAMP_LOOK : undefined) : hero === 'jedi' ? buildJediFrames(jediLook(arg)) : hero === 'warrior' ? buildWarriorFrames(warriorLook) : hero === 'paladin' ? buildPaladinFrames(arg === 'crusader' ? CRUSADER_LOOK : undefined) : buildWizardFrames(arg === 'void' ? VOID_LOOK : arg === 'pyro' ? PYRO_LOOK : arg === 'tide' ? TIDE_LOOK : arg === 'abyss' ? ABYSS_LOOK : arg === 'pumpkin' ? PUMPKIN_LOOK : undefined);
const frames = built.map((f) => ({ ...f, r: f.canvas.render() }));
const rows: { anim: string; dir: string | null }[] = [];
for (const a of hero === 'rogue' ? ROGUE_ANIMS : hero === 'archer' ? ARCHER_ANIMS : hero === 'alchemist' ? ALCHEMIST_ANIMS : hero === 'fighter' ? (arg === 'monk' ? MONK_LOOK.anims : FIGHTER_ANIMS) : hero === 'jedi' ? jediAnimsFor(jediLook(arg)) : hero === 'warrior' ? warriorAnimsFor(warriorLook) : hero === 'paladin' ? PALADIN_ANIMS : ANIMS) for (const d of DIRS) rows.push({ anim: a.name, dir: d });
if (hero === 'warrior' && !warriorLook.king) rows.push({ anim: 'spin', dir: null });
if (hero === 'jedi') rows.push({ anim: jediLook(arg).staff ? 'dervish' : 'twirl', dir: null });
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
  writeFileSync(`${out}/${arg === 'void' || arg === 'pyro' || arg === 'pumpkin' || arg === 'jade' || arg === 'headless' || arg === 'sith' || arg === 'warlord' || arg === 'master' || arg === 'witch' || arg === 'chem' || arg === 'storm' || arg === 'scarecrow' || arg === 'dancer' ? arg : hero}_${layer}.png`, encodePNG(W, H, img));
}
console.log('frames', frames.length, 'sheet', W, H);
