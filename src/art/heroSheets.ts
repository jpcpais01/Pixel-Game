// Every hero look's sprite sheet, built on demand instead of at boot.
//
// A look is a few hundred frames, drawn and lit in code: the whole roster
// took most of the loading screen. The sheets are built here as plain pixel
// arrays with no canvas and no Phaser, so a worker can make them while the
// game runs (see heroLoader.ts); the main thread only turns them into
// textures. Nothing here may touch the DOM.

import type { PixelCanvas } from './pixel';
import { packAtlas, type PixelAtlas } from './atlas';
import { dresser, dressedKey, undress } from './dress';
import type { SetId } from '../game/gear';
import { buildWizardFrames, ANIMS, DIRS, FRAME_H, FRAME_W, WIZARD_LOOKS } from './wizard';
import { buildWarriorFrames, WARRIOR_H, WARRIOR_LOOKS, WARRIOR_W, warriorAnimsFor } from './warrior';
import { buildPaladinFrames, PALADIN_ANIMS, PALADIN_H, PALADIN_LOOKS, PALADIN_W } from './paladin';
import { buildJediFrames, DERVISH_FPS, DERVISH_FRAMES, JEDI_H, JEDI_LOOKS, JEDI_W, jediAnimsFor, TWIRL_FPS, TWIRL_FRAMES, twirlStart } from './jedi';
import { buildFighterFrames, FIGHTER_H, FIGHTER_LOOKS, FIGHTER_W } from './fighter';
import { ALCHEMIST_ANIMS, ALCHEMIST_LOOKS, ALCH_H, ALCH_W, buildAlchemistFrames } from './alchemist';
import { ARCHER_H, ARCHER_LOOKS, ARCHER_W, archerAnimsFor, buildArcherFrames } from './archer';
import { buildRogueFrames, ROGUE_ANIMS, ROGUE_H, ROGUE_LOOKS, ROGUE_W } from './rogue';
import { buildNecroFrames, NECRO_ANIMS, NECRO_H, NECRO_LOOKS, NECRO_W } from './necromancer';
import { BARD_H, BARD_LOOKS, BARD_W, bardAnims, buildBardFrames } from './bard';
import { CHRONO_H, CHRONO_LOOKS, CHRONO_W, buildChronoFrames, chronoAnims } from './chrono';
import { SAMURAI_ANIMS, SAMURAI_H, SAMURAI_LOOKS, SAMURAI_W, SPIN_FPS, SPIN_FRAMES, buildSamuraiFrames, spinStart } from './samurai';
import { MECH_ANIMS, MECH_H, MECH_LOOKS, MECH_W, buildMechFrames } from './mech';
import { SYNTH_ANIMS, SYNTH_H, SYNTH_LOOKS, SYNTH_W, buildSynthFrames } from './synth';
import { POLTER_ANIMS, POLTER_H, POLTER_LOOKS, POLTER_W, buildPolterFrames } from './poltergeist';
import { WRAITH_ANIMS, WRAITH_H, WRAITH_LOOKS, WRAITH_W, buildWraithFrames } from './wraith';
import { BANSHEE_ANIMS, BANSHEE_H, BANSHEE_LOOKS, BANSHEE_W, buildBansheeFrames } from './banshee';
import { YUREI_ANIMS, YUREI_H, YUREI_LOOKS, YUREI_W, buildYureiFrames } from './yurei';
import { CAPTAIN_ANIMS, CAPTAIN_H, CAPTAIN_LOOKS, CAPTAIN_W, buildCaptainFrames } from './captain';
import { BALLET_ANIMS, BALLET_H, BALLET_LOOKS, BALLET_W, buildBalletFrames } from './ballerina';
import { DIVER_ANIMS, DIVER_H, DIVER_LOOKS, DIVER_W, buildDiverFrames } from './deepdiver';
import { JUGG_ANIMS, JUGG_H, JUGG_LOOKS, JUGG_W, buildJuggFrames } from './juggernaut';
import { INV_H, INV_W, INVENTOR_LOOKS, buildInventorFrames, inventorAnims } from './inventor';
import { BEAST_H, BEAST_LOOKS, BEAST_W, beastAnims, buildBeastFrames } from './beast';

/** The rigs whose frames carry points the game reads (a crystal, a blade tip): the same for every look of the rig. */
export type MetaKind = 'wizard' | 'warrior' | 'paladin' | 'jedi' | 'samurai';

export interface SheetAnim {
  key: string;
  frames: string[];
  fps: number;
  loop: boolean;
}

/** A look's sheet, packed and ready to become textures. */
export interface HeroSheet {
  key: string;
  /** Frame size. */
  fw: number;
  fh: number;
  atlas: PixelAtlas;
  anims: SheetAnim[];
  meta: { kind: MetaKind; frames: [string, unknown][] } | null;
}

interface SheetDef {
  /** Also makes the white hit flash (`<key>_w`). */
  flash: boolean;
  /** With a set: the look dressed in it (see dress.ts), textures only, its animations are the look's own. */
  build(set?: SetId): HeroSheet;
}

interface RigFrame {
  key: string;
  canvas: PixelCanvas;
  anim: string;
  /** Null on frames no animation plays (the warrior's and samurai's spins, the jedi's twirl). */
  dir: string | null;
  meta?: unknown;
}

interface AnimSpec {
  name: string;
  fps: number;
  loop: boolean;
  /** Frame indices to play, in order, when some are held or repeated (the idle moment's `rest`). */
  order?: readonly number[];
}

const SHEETS = new Map<string, SheetDef>();

/**
 * One rig's looks: its frames packed, and an animation per anim and
 * direction (`<key>_<anim>_<dir>`), plus any a rig adds itself.
 */
function rig<L extends { key: string }>(
  looks: readonly L[],
  fw: number,
  fh: number,
  build: (look: L) => RigFrame[],
  anims: (look: L) => readonly AnimSpec[],
  o: { meta?: MetaKind; flash?: boolean; extra?: (look: L) => SheetAnim[] } = {},
): void {
  for (const look of looks) {
    SHEETS.set(look.key, {
      flash: !!o.flash,
      build: (set) => {
        const frames = build(look);
        if (set) {
          const dress = dresser(look, set);
          return {
            key: dressedKey(look.key, set),
            fw,
            fh,
            atlas: packAtlas(frames.map((f, i) => ({ name: f.key, r: dress(f.canvas, i) })), fw, fh, 16, !!o.flash),
            anims: [],
            meta: null,
          };
        }
        const list: SheetAnim[] = [];
        for (const a of anims(look)) {
          for (const d of DIRS) {
            const keys = frames.filter((f) => f.anim === a.name && f.dir === d).map((f) => f.key);
            // Some moves are drawn one way only (the idle moment, `rest`, faces the viewer).
            if (keys.length === 0) continue;
            list.push({
              key: `${look.key}_${a.name}_${d}`,
              frames: a.order ? a.order.map((i) => keys[Math.min(i, keys.length - 1)]) : keys,
              fps: a.fps,
              loop: a.loop,
            });
          }
        }
        if (o.extra) list.push(...o.extra(look));
        return {
          key: look.key,
          fw,
          fh,
          atlas: packAtlas(frames.map((f) => ({ name: f.key, r: f.canvas.render() })), fw, fh, 16, !!o.flash),
          anims: list,
          meta: o.meta ? { kind: o.meta, frames: frames.map((f) => [f.key, f.meta]) } : null,
        };
      },
    });
  }
}

/** A whole turn of spin frames, starting from the way the hero faces. */
const turn = (key: string, name: string, count: number, fps: number, start: (d: (typeof DIRS)[number]) => number): SheetAnim[] =>
  DIRS.map((d) => {
    const k0 = start(d);
    return { key: `${key}_${name}_${d}`, frames: Array.from({ length: count + 1 }, (_, i) => `${name}_${(k0 + i) % count}`), fps, loop: false };
  });

// The Druid and the Valkyrie are wizard and warrior looks, the King is a
// warrior look with his own swings, and the Sith a Jedi look with his own moves. Warrior spin frames have no animation:
// the whirlwind picks them by angle.
rig(WIZARD_LOOKS, FRAME_W, FRAME_H, buildWizardFrames, () => ANIMS, { meta: 'wizard' });
rig(WARRIOR_LOOKS, WARRIOR_W, WARRIOR_H, buildWarriorFrames, warriorAnimsFor, { meta: 'warrior' });
rig(PALADIN_LOOKS, PALADIN_W, PALADIN_H, buildPaladinFrames, () => PALADIN_ANIMS, { meta: 'paladin' });
rig(JEDI_LOOKS, JEDI_W, JEDI_H, buildJediFrames, jediAnimsFor, {
  meta: 'jedi',
  extra: (look) => (look.staff ? turn(look.key, 'dervish', DERVISH_FRAMES, DERVISH_FPS, twirlStart) : turn(look.key, 'twirl', TWIRL_FRAMES, TWIRL_FPS, twirlStart)),
});
rig(FIGHTER_LOOKS, FIGHTER_W, FIGHTER_H, buildFighterFrames, (look) => look.anims);
rig(ALCHEMIST_LOOKS, ALCH_W, ALCH_H, buildAlchemistFrames, (look) => ALCHEMIST_ANIMS.map((a) => ({ ...a, fps: look.fps?.[a.name] ?? a.fps })));
rig(ARCHER_LOOKS, ARCHER_W, ARCHER_H, buildArcherFrames, archerAnimsFor);
rig(ROGUE_LOOKS, ROGUE_W, ROGUE_H, buildRogueFrames, () => ROGUE_ANIMS, { flash: true });
rig(NECRO_LOOKS, NECRO_W, NECRO_H, buildNecroFrames, () => NECRO_ANIMS);
rig(BARD_LOOKS, BARD_W, BARD_H, buildBardFrames, bardAnims);
rig(CHRONO_LOOKS, CHRONO_W, CHRONO_H, buildChronoFrames, chronoAnims);
rig(SAMURAI_LOOKS, SAMURAI_W, SAMURAI_H, buildSamuraiFrames, () => SAMURAI_ANIMS, { meta: 'samurai', extra: (look) => turn(look.key, 'spin', SPIN_FRAMES, SPIN_FPS, spinStart) });
rig(MECH_LOOKS, MECH_W, MECH_H, buildMechFrames, () => MECH_ANIMS);
rig(SYNTH_LOOKS, SYNTH_W, SYNTH_H, buildSynthFrames, () => SYNTH_ANIMS);
rig(POLTER_LOOKS, POLTER_W, POLTER_H, buildPolterFrames, () => POLTER_ANIMS);
rig(WRAITH_LOOKS, WRAITH_W, WRAITH_H, buildWraithFrames, () => WRAITH_ANIMS);
rig(BANSHEE_LOOKS, BANSHEE_W, BANSHEE_H, buildBansheeFrames, () => BANSHEE_ANIMS);
rig(YUREI_LOOKS, YUREI_W, YUREI_H, buildYureiFrames, () => YUREI_ANIMS);
rig(CAPTAIN_LOOKS, CAPTAIN_W, CAPTAIN_H, buildCaptainFrames, () => CAPTAIN_ANIMS);
rig(BALLET_LOOKS, BALLET_W, BALLET_H, buildBalletFrames, () => BALLET_ANIMS);
rig(DIVER_LOOKS, DIVER_W, DIVER_H, buildDiverFrames, () => DIVER_ANIMS);
rig(JUGG_LOOKS, JUGG_W, JUGG_H, buildJuggFrames, () => JUGG_ANIMS);
rig(INVENTOR_LOOKS, INV_W, INV_H, buildInventorFrames, inventorAnims);
rig(BEAST_LOOKS, BEAST_W, BEAST_H, buildBeastFrames, beastAnims);

/** Every hero sheet's key, in roster order. */
export const HERO_SHEETS: readonly string[] = [...SHEETS.keys()];

export const sheetFlashes = (key: string): boolean => !!SHEETS.get(key)?.flash;

/** Builds a look's sheet, or a dressed look's (`<look>.<set>`, see dress.ts). */
export function buildHeroSheet(key: string): HeroSheet {
  const dressed = undress(key);
  const def = SHEETS.get(dressed ? dressed.look : key);
  if (!def) throw new Error(`No hero sheet '${key}'`);
  return def.build(dressed?.set);
}
