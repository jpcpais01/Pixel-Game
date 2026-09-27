// Materials and button icons for the Valkyrie. The figure itself is drawn by
// the warrior's rig (warrior.ts), switched by its `valkyrie` flag: swan wings
// at her back, a winged helm, long braids and a spear in place of the sword.

import { hex, type Material, type RGB } from './pixel';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------------------
// The Spearmaiden: bright steel and gold, a sky-blue tabard, white swan wings,
// golden braids, and a spear of ash with a leaf-shaped head.

export const SKY_CLOTH: Material = {
  ramp: ramp('#0e1a3a', '#1a2c5e', '#28448a', '#3a62b4', '#5a86d8'),
  outline: hex('#060b1a'),
  outlineLit: hex('#12203e'),
};

export const SWAN: Material = {
  ramp: ramp('#56657f', '#94a4c0', '#cfd9ec', '#f6f9ff'),
  outline: hex('#161c2c'),
  outlineLit: hex('#2a3246'),
};

export const BLONDE: Material = {
  ramp: ramp('#6a4418', '#ad7a2c', '#dcae4e', '#f8e49e'),
  outline: hex('#281606'),
  outlineLit: hex('#3a220c'),
};

/** Pale ash, for the spear's shaft. */
export const ASH: Material = {
  ramp: ramp('#3a2616', '#62442a', '#8e6c46', '#b89a6c'),
  outline: hex('#140c06'),
};

// ---------------------------------------------------------------------------
// The Stormwing: blackened steel and silver, a storm-grey tabard, slate wings
// that crackle along their edges, white braids, and a spear that calls lightning.

export const STORM_STEEL: Material = {
  ramp: ramp('#11131c', '#212636', '#363e56', '#535d7c', '#8894b6'),
  outline: hex('#05060c'),
  outlineLit: hex('#171b28'),
  shine: true,
};

export const STORM_CLOTH: Material = {
  ramp: ramp('#0e0e1c', '#1a1a34', '#2a2a52', '#3e3e78', '#58589e'),
  outline: hex('#05050c'),
  outlineLit: hex('#141428'),
};

export const SLATE_WING: Material = {
  ramp: ramp('#262e48', '#445274', '#7288b0', '#b2c6e6'),
  outline: hex('#080c16'),
  outlineLit: hex('#161c2e'),
};

export const WHITE_HAIR: Material = {
  ramp: ramp('#4a4c6a', '#8a8eae', '#c8ccea', '#f4f6ff'),
  outline: hex('#15162a'),
  outlineLit: hex('#26283e'),
};

/** Dark wood for the storm spear's shaft. */
export const STORM_ASH: Material = {
  ramp: ramp('#15121c', '#28222e', '#3e3544', '#58505e'),
  outline: hex('#060408'),
};

// ---------------------------------------------------------------------------
// The Spearmaiden's Sunshield skin: gilded plate, a crimson tabard, rose-gold
// wings, copper braids and a halo of the sun behind her head.

export const GILT: Material = {
  ramp: ramp('#4a2410', '#8a4e1c', '#c8862e', '#f0c052', '#fff0b0'),
  outline: hex('#1e0e06'),
  outlineLit: hex('#3a1c0a'),
  shine: true,
};

export const ROSE_WING: Material = {
  ramp: ramp('#7a4a4a', '#c08a78', '#f0c8a8', '#fff2e0'),
  outline: hex('#2a1614'),
  outlineLit: hex('#3e2220'),
};

export const COPPER: Material = {
  ramp: ramp('#4a1a0c', '#8a3a18', '#c8622a', '#f09a4a'),
  outline: hex('#1c0804'),
};

export const SUN_WOOD: Material = {
  ramp: ramp('#2a100c', '#4a1e16', '#6e3222', '#944a30'),
  outline: hex('#100604'),
};

// ---------------------------------------------------------------------------
// The Stormwing's Raven Queen skin: black steel with a violet sheen, raven
// wings, black hair, violet lightning.

export const RAVEN_STEEL: Material = {
  ramp: ramp('#0a0810', '#18142a', '#2a2244', '#443a66', '#6e62a0'),
  outline: hex('#040306'),
  outlineLit: hex('#120e1e'),
  shine: true,
};

export const RAVEN_CLOTH: Material = {
  ramp: ramp('#10061a', '#1e0c30', '#30144a', '#46206a'),
  outline: hex('#06020a'),
};

export const RAVEN_WING: Material = {
  ramp: ramp('#16142a', '#2a2848', '#48446e', '#7470a6'),
  outline: hex('#030306'),
  outlineLit: hex('#0e0e18'),
};

export const RAVEN_HAIR: Material = {
  ramp: ramp('#0a080e', '#16121e', '#262032', '#3a324c'),
  outline: hex('#030204'),
};

// ---------------------------------------------------------------------------
// Button icons (additive, see druid.ts icon16).

export const SPEAR_TONES: Tones = [hex('#fffdf2'), hex('#ffe6a0'), hex('#f4c050'), hex('#a06a1e')];
export const STORM_TONES: Tones = [hex('#f2fbff'), hex('#a8e4ff'), hex('#5ec8ff'), hex('#3a6ad8')];
export const SUN_TONES: Tones = [hex('#fffbf0'), hex('#ffd890'), hex('#ff8a4a'), hex('#a82a1a')];
export const RAVEN_TONES: Tones = [hex('#f8f0ff'), hex('#d8b0ff'), hex('#a060ff'), hex('#4a1a8a')];

/** Shaft and head colours for a spear drawn on an icon. */
export interface SpearInk {
  head: RGB;
  headLit: RGB;
  shaft: RGB;
  shaftLit: RGB;
  band: RGB;
}

export const SPEAR_INK: SpearInk = { head: hex('#aebcd8'), headLit: hex('#f4f8ff'), shaft: hex('#6a4c30'), shaftLit: hex('#a88a5e'), band: hex('#f4cf6a') };
export const STORM_INK: SpearInk = { head: hex('#8ea2c8'), headLit: hex('#e8f4ff'), shaft: hex('#3e3a4c'), shaftLit: hex('#646078'), band: hex('#c4cadf') };
export const SUN_INK: SpearInk = { head: hex('#f0c052'), headLit: hex('#fff4c8'), shaft: hex('#6e3222'), shaftLit: hex('#a0583a'), band: hex('#ffd890') };
export const RAVEN_INK: SpearInk = { head: hex('#8a7ab8'), headLit: hex('#e8dcff'), shaft: hex('#262032'), shaftLit: hex('#443a5c'), band: hex('#c4cadf') };

/** A spear from (x0, y0) (the butt) to its point at (x1, y1). */
function spear(put: (x: number, y: number, c: RGB) => void, x0: number, y0: number, x1: number, y1: number, k: SpearInk): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  const head = 5;
  // The shaft, a lit edge along its upper side.
  for (let t = 0; t <= len - head; t += 0.5) {
    put(x0 + ux * t, y0 + uy * t, k.shaft);
    put(x0 + ux * t + uy * 0.7, y0 + uy * t - ux * 0.7, k.shaftLit);
  }
  put(x0 + ux * (len - head), y0 + uy * (len - head), k.band);
  put(x0 + ux * (len - head) - uy, y0 + uy * (len - head) + ux, k.band);
  // The leaf-shaped head.
  for (let t = 0; t <= head; t += 0.35) {
    const u = t / head;
    const hw = u < 0.35 ? 0.5 + (u / 0.35) * 1.1 : 1.6 * (1 - u) / 0.65;
    for (let s = -hw; s <= hw; s += 0.4) {
      const x = x0 + ux * (len - head + t) - uy * s;
      const y = y0 + uy * (len - head + t) + ux * s;
      put(x, y, s < 0.2 ? k.headLit : k.head);
    }
  }
}

/** The Valkyrie's combo: a spear raised to strike, a glint at its point; the Stormwing's crackling with lightning. */
export function spearIcon(storm = false, k: SpearInk = storm ? STORM_INK : SPEAR_INK, t: Tones = storm ? STORM_TONES : SPEAR_TONES): Uint8ClampedArray {
  return icon16((put) => {
    spear(put, 1.5, 14.5, 13.5, 2.5, k);
    put(14, 2, t[0]);
    put(15, 1, t[1]);
    put(13, 1, t[2]);
    put(15, 3, t[2]);
    if (storm) {
      // Lightning crackling down the shaft.
      const pts: [number, number][] = [[12, 5], [9, 5], [10, 8], [6, 8], [7, 11], [3, 12]];
      for (let i = 0; i < pts.length - 1; i++) seg(put, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], i % 2 ? t[1] : t[0]);
    }
  });
}

/** The spear throw: a spear of light in flight, streaks behind it and a curve for its return. */
export function spearThrowIcon(k: Tones = SPEAR_TONES): Uint8ClampedArray {
  return icon16((put) => {
    // Streaks.
    for (const [y, x0, x1] of [[5, 0, 5], [8, 1, 6], [11, 0, 4]] as const) seg(put, x0, y, x1, y, k[3]);
    // The spear, pure light.
    for (let x = 4; x <= 11; x++) put(x, 8, x > 8 ? k[1] : k[2]);
    for (let x = 11; x <= 15; x++) {
      const hw = x < 13 ? x - 10 : 15 - x;
      for (let dy = -hw; dy <= hw; dy++) put(x, 8 + dy, dy === 0 ? k[0] : k[1]);
    }
    // The way back: an arc under it, ending in an arrowhead.
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      put(8 + Math.cos(a) * 6, 11 + Math.sin(a) * 3.5, k[2]);
    }
    put(2, 11, k[1]);
    put(1, 10, k[1]);
    put(3, 10, k[1]);
  });
}

/** The valkyrie's dive: a wing over a bolt of lightning striking the ground. */
export function diveIcon(k: Tones = STORM_TONES): Uint8ClampedArray {
  return icon16((put) => {
    // A ring where it strikes.
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot((x + 0.5 - 8) / 6.5, (y + 0.5 - 13.5) / 2.2);
        if (Math.abs(d - 1) < 0.2) put(x, y, k[2]);
      }
    }
    // The bolt.
    const pts: [number, number][] = [[9, 4], [6, 8], [9, 8], [7, 13]];
    for (let i = 0; i < pts.length - 1; i++) seg(put, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], k[0]);
    seg(put, 10, 4, 7, 8, k[1]);
    seg(put, 10, 8, 8, 13, k[1]);
    // A wing spread over it: a leading edge and four feathers.
    seg(put, 2, 5, 13, 1, k[1]);
    for (let i = 0; i < 4; i++) {
      const bx = 4 + i * 2.6;
      const by = 4.3 - i * 0.95;
      seg(put, bx, by, bx - 1.5, by + 3 - i * 0.3, k[2 + (i % 2)]);
    }
  });
}
