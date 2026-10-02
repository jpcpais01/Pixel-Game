// Materials, spell colours and the beam button for the Arcanist's Prism skin:
// a crystal mage. The figure is drawn by the wizard's rig (wizard.ts) with its
// `head` set to 'prism': a dark indigo bob under a crown of quartz shards that
// float over the head, quartz pauldrons, a robe of pale faceted quartz whose
// edges split the light into colours, a hem of crystal points, and a staff of
// white ash holding a clear prism that throws a little rainbow.

import { hex, type Material, type RGB } from './pixel';
import type { SpellColors } from './effects';
import { icon16, seg } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** The robe: milky quartz, cool lavender in its shadows, white where the light falls. */
export const QUARTZ_ROBE: Material = {
  ramp: ramp('#2e3054', '#565a8a', '#9298c6', '#cdd3f0', '#f4f6ff'),
  outline: hex('#101228'),
  outlineLit: hex('#222446'),
};

/** The lining and the belt: deep violet glass. */
export const QUARTZ_LINING: Material = {
  ramp: ramp('#1c1844', '#352e72', '#5850a2', '#8278d0'),
  outline: hex('#09071e'),
};

/** Polished silver: the hem band, the buckle and the staff's claw. */
export const PRISM_SILVER: Material = {
  ramp: ramp('#3a4060', '#747ea4', '#b8c2e0', '#eef4ff'),
  outline: hex('#111426'),
  outlineLit: hex('#1c2038'),
  shine: true,
};

/** A blunt bob of indigo-black hair with a cold blue sheen, dark against the pale robe. */
export const PRISM_HAIR: Material = {
  ramp: ramp('#0e0a22', '#1c163e', '#2e265c', '#44397e', '#6456a6'),
  outline: hex('#04030c'),
  outlineLit: hex('#0d0a1c'),
  shine: true,
};

/** Clear quartz for the floating crown, the pauldrons and the hem's points: lit a little from within. */
export const QUARTZ: Material = {
  ramp: ramp('#364678', '#6a84be', '#aac4f2', '#e2eeff', '#ffffff'),
  outline: hex('#131a38'),
  outlineLit: hex('#1e284e'),
  emissive: 0.3,
  shine: true,
  noAO: true,
};

/** White ash, for the staff. */
export const ASHWOOD: Material = {
  ramp: ramp('#38384e', '#62647e', '#9294ac', '#c4c6da'),
  outline: hex('#11111e'),
};

/** The prism at the staff's head: clear, cold and bright. */
export const PRISM_GEM: Material = {
  ramp: ramp('#5466a8', '#a2bcf2', '#eef4ff', '#ffffff'),
  outline: hex('#18203f'),
  outlineLit: hex('#26305a'),
  emissive: 0.95,
  shine: true,
  noAO: true,
};

// Prism light (light-only colours): white at the heart, ice and periwinkle, to a violet edge.
export const PRISM_CORE = hex('#ffffff');
export const PRISM_HOT = hex('#e4f2ff');
export const PRISM_MID = hex('#9ab8ff');
export const PRISM_DEEP = hex('#7a5ae8');

/** White light split: red, orange, yellow, green, blue, violet. */
export const SPECTRUM: RGB[] = [hex('#ff5a78'), hex('#ffa040'), hex('#ffe860'), hex('#60f090'), hex('#50c0ff'), hex('#a070ff')];

export const PRISM_SPELL: SpellColors = { core: PRISM_CORE, hot: PRISM_HOT, mid: PRISM_MID, deep: PRISM_DEEP, accent: hex('#ffb0e0'), spectrum: SPECTRUM };

/**
 * The beam button: a white ray striking a glass prism from the lower left and
 * fanning out of it to the upper right as a rainbow.
 */
export function prismBeamIcon(): Uint8ClampedArray {
  return icon16((put) => {
    // The rainbow, spreading from the prism's far face: red bent least, violet most.
    const ex = 8.6;
    const ey = 8.4;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x + 0.5 - ex;
        const dy = ey - (y + 0.5);
        const d = Math.hypot(dx, dy);
        if (d < 1.2 || d > 9.5 || dx <= 0) continue;
        const a = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (a < 8 || a > 62) continue;
        const band = Math.min(5, Math.floor(((a - 8) / 54) * 6));
        const c = SPECTRUM[band];
        // The fan pales toward the prism, where the colours have only begun to part.
        put(x, y, d < 3 ? c.map((v) => Math.round(v * 0.7 + 255 * 0.3)) as RGB : c);
      }
    }
    // The white ray coming in.
    seg(put, 0, 13, 5, 10, PRISM_HOT);
    seg(put, 0, 14, 5, 11, PRISM_MID);
    // The prism: a triangle of glass, its rims bright, its body dim blue.
    for (let y = 5; y <= 13; y++) {
      const hw = ((y - 5) / 8) * 4.2;
      for (let x = Math.round(6 - hw); x <= Math.round(6 + hw); x++) {
        const rim = y === 13 || Math.abs(x - 6) >= hw - 0.8;
        put(x, y, rim ? (x <= 6 ? PRISM_CORE : PRISM_HOT) : x < 6 ? hex('#5a72c0') : hex('#3c4c94'));
      }
    }
    put(6, 4, PRISM_CORE);
    // Where the light passes through the glass.
    seg(put, 4, 10, 7, 9, PRISM_CORE);
  });
}
