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
import { buildLichFrames, LICH_ANIMS, LICH_H, LICH_LOOKS, LICH_W } from './lich';
import { BARD_H, BARD_LOOKS, BARD_W, bardAnims, buildBardFrames } from './bard';
import { CHRONO_H, CHRONO_LOOKS, CHRONO_W, buildChronoFrames, chronoAnims } from './chrono';
import { SAMURAI_ANIMS, SAMURAI_H, SAMURAI_LOOKS, SAMURAI_W, SPIN_FPS, SPIN_FRAMES, buildSamuraiFrames, spinStart } from './samurai';
import { MECH_ANIMS, MECH_H, MECH_LOOKS, MECH_W, buildMechFrames } from './mech';
import { SYNTH_ANIMS, SYNTH_H, SYNTH_LOOKS, SYNTH_W, buildSynthFrames } from './synth';
import { POLTER_ANIMS, POLTER_H, POLTER_LOOKS, POLTER_W, buildPolterFrames } from './poltergeist';
import { WRAITH_ANIMS, WRAITH_H, WRAITH_LOOKS, WRAITH_W, buildWraithFrames } from './wraith';
import { INV_H, INV_W, INVENTOR_LOOKS, buildInventorFrames, inventorAnims } from './inventor';
import { BEAST_H, BEAST_LOOKS, BEAST_W, beastAnims, buildBeastFrames } from './beast';
import { SAGE_ANIMS, SAGE_H, SAGE_LOOKS, SAGE_W, buildSageFrames } from './sage';
import { BARROW_ANIMS, BARROW_H, BARROW_LOOKS, BARROW_W, buildBarrowFrames } from './barrow';
import { FALC_H, FALC_W, FALCONER_ANIMS, FALCONER_LOOKS, buildFalconerFrames } from './falconer';
import { TWIN_ANIMS, TWIN_H, TWIN_LOOKS, TWIN_W, buildTwinFrames } from './twin';
import { INQ_ANIMS, INQ_H, INQ_W, INQUISITOR_LOOKS, buildInquisitorFrames } from './inquisitor';
import { REAPER_ANIMS, REAPER_H, REAPER_LOOKS, REAPER_W, buildReaperFrames, reaperSpins } from './reaper';
import { LIGHTWRIGHT_ANIMS, LIGHTWRIGHT_LOOKS, LW_H, LW_W, buildLightwrightFrames } from './lightwright';
import { TRANSMUTER_ANIMS, TRANSMUTER_LOOKS, TRANS_H, TRANS_W, buildTransmuterFrames } from './transmuter';
import { AQUA_H, AQUA_W, AQUANAUT_LOOKS, aquanautAnims, buildAquanautFrames } from './aquanaut';
import { BEAR_H, BEAR_LOOKS, BEAR_W, bearAnims, buildBearFrames } from './bear';
import { BREW_ANIMS, BREW_H, BREW_LOOKS, BREW_W, buildBrewFrames } from './brewmaster';
import { AVI_H, AVI_W, AVIATOR_ANIMS, AVIATOR_LOOKS, buildAviatorFrames } from './aviator';
import { PYRO_ANIMS, PYRO_H, PYRO_LOOKS, PYRO_W, buildPyroFrames } from './pyrotechnist';

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
rig(LICH_LOOKS, LICH_W, LICH_H, buildLichFrames, () => LICH_ANIMS);
rig(BARD_LOOKS, BARD_W, BARD_H, buildBardFrames, bardAnims);
rig(CHRONO_LOOKS, CHRONO_W, CHRONO_H, buildChronoFrames, chronoAnims);
rig(SAMURAI_LOOKS, SAMURAI_W, SAMURAI_H, buildSamuraiFrames, () => SAMURAI_ANIMS, { meta: 'samurai', extra: (look) => turn(look.key, 'spin', SPIN_FRAMES, SPIN_FPS, spinStart) });
rig(MECH_LOOKS, MECH_W, MECH_H, buildMechFrames, () => MECH_ANIMS);
rig(SYNTH_LOOKS, SYNTH_W, SYNTH_H, buildSynthFrames, () => SYNTH_ANIMS);
rig(POLTER_LOOKS, POLTER_W, POLTER_H, buildPolterFrames, () => POLTER_ANIMS);
rig(WRAITH_LOOKS, WRAITH_W, WRAITH_H, buildWraithFrames, () => WRAITH_ANIMS);
rig(INVENTOR_LOOKS, INV_W, INV_H, buildInventorFrames, inventorAnims);
rig(BEAST_LOOKS, BEAST_W, BEAST_H, buildBeastFrames, beastAnims);
// The Force Sage: a Jedi-class type on a rig of her own.
rig(SAGE_LOOKS, SAGE_W, SAGE_H, buildSageFrames, () => SAGE_ANIMS);
rig(BARROW_LOOKS, BARROW_W, BARROW_H, buildBarrowFrames, () => BARROW_ANIMS);
rig(FALCONER_LOOKS, FALC_W, FALC_H, buildFalconerFrames, () => FALCONER_ANIMS);
// The Twin Blade, the Jedi class's third type, on a rig of his own; his frames carry the Jedi's points (blade tips).
rig(TWIN_LOOKS, TWIN_W, TWIN_H, buildTwinFrames, () => TWIN_ANIMS, { meta: 'jedi' });
rig(INQUISITOR_LOOKS, INQ_W, INQ_H, buildInquisitorFrames, () => INQ_ANIMS);
// The Reaper's third reap is a spin drawn once for every facing.
rig(REAPER_LOOKS, REAPER_W, REAPER_H, buildReaperFrames, () => REAPER_ANIMS, { extra: (look) => reaperSpins(look.key) });
rig(LIGHTWRIGHT_LOOKS, LW_W, LW_H, buildLightwrightFrames, () => LIGHTWRIGHT_ANIMS);
rig(TRANSMUTER_LOOKS, TRANS_W, TRANS_H, buildTransmuterFrames, () => TRANSMUTER_ANIMS);
rig(AQUANAUT_LOOKS, AQUA_W, AQUA_H, buildAquanautFrames, aquanautAnims);
rig(BEAR_LOOKS, BEAR_W, BEAR_H, buildBearFrames, bearAnims);
rig(BREW_LOOKS, BREW_W, BREW_H, buildBrewFrames, () => BREW_ANIMS);
rig(AVIATOR_LOOKS, AVI_W, AVI_H, buildAviatorFrames, () => AVIATOR_ANIMS);
rig(PYRO_LOOKS, PYRO_W, PYRO_H, buildPyroFrames, () => PYRO_ANIMS);

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
