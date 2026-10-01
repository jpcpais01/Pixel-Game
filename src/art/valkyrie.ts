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
// The Spearmaiden's Swan Maiden skin: pearl-white and silver-blue fitted plate
// over a flowing lake-blue skirt, great swan wings, platinum braids under a
// silver diadem with a single swan feather, and a slim silver leaf of a spear.

/** Pearl plate: nearly white, cool in the shade, with a soft sheen. */
export const PEARL: Material = {
  ramp: ramp('#3a4668', '#64789e', '#98aed0', '#ccdaee', '#f6f9ff'),
  outline: hex('#161a2a'),
  outlineLit: hex('#2a3044'),
  shine: true,
};

/** Pale silver-blue, for her sleeves, boots and the plate's inlays. */
export const MOON_STEEL: Material = {
  ramp: ramp('#2e3c5c', '#4e6488', '#7c96bc', '#b0c8e4', '#dcebfa'),
  outline: hex('#0e1424'),
  outlineLit: hex('#1c2638'),
  shine: true,
};

/** The lake-blue silk of her skirt. */
export const LAKE_SILK: Material = {
  ramp: ramp('#0e2440', '#183c66', '#245c8e', '#3a82b4', '#64aad4'),
  outline: hex('#050d1a'),
  outlineLit: hex('#0e1c30'),
};

/** Swan feathers: white, cool grey-blue in the shade. */
export const SWAN_DOWN: Material = {
  ramp: ramp('#646f8c', '#a2aec8', '#d8e0ee', '#f6f8fd', '#ffffff'),
  outline: hex('#1a2032'),
  outlineLit: hex('#2c3448'),
};

/** The silver-blue at the tips of her flight feathers. */
export const SWAN_TIP: Material = {
  ramp: ramp('#2a3c64', '#4a6a9c', '#7698c8', '#a8c6e8'),
  outline: hex('#0c1426'),
  outlineLit: hex('#18223a'),
};

/** Long platinum hair, a warm white against the cool feathers. */
export const PLATINUM: Material = {
  ramp: ramp('#6a5a3e', '#a8936a', '#d4c296', '#eee2bc', '#fbf5e0'),
  outline: hex('#24201a'),
  outlineLit: hex('#383228'),
};

/** Birch-pale wood for the swan spear's shaft. */
export const BIRCH: Material = {
  ramp: ramp('#5a5448', '#8e8676', '#c0b8a6', '#e6e0d2'),
  outline: hex('#1a1810'),
};

/** Her lips. */
export const ROSE_LIP: Material = {
  ramp: ramp('#7a2e3e', '#a8485a', '#d06e7e', '#ec96a2'),
  outline: hex('#2a1418'),
  noAO: true,
};

/** A moonlit pearl (the diadem's, the brooch's): glows softly at night. */
export const MOON_PEARL: Material = {
  ramp: ramp('#8a96b4', '#c8d4ec', '#f2f6ff', '#ffffff'),
  outline: hex('#1a2032'),
  emissive: 0.75,
  noAO: true,
};

// ---------------------------------------------------------------------------
// Button icons (additive, see druid.ts icon16).

export const SPEAR_TONES: Tones = [hex('#fffdf2'), hex('#ffe6a0'), hex('#f4c050'), hex('#a06a1e')];
export const STORM_TONES: Tones = [hex('#f2fbff'), hex('#a8e4ff'), hex('#5ec8ff'), hex('#3a6ad8')];
export const SUN_TONES: Tones = [hex('#fffbf0'), hex('#ffd890'), hex('#ff8a4a'), hex('#a82a1a')];
export const RAVEN_TONES: Tones = [hex('#f8f0ff'), hex('#d8b0ff'), hex('#a060ff'), hex('#4a1a8a')];
export const SWAN_TONES: Tones = [hex('#ffffff'), hex('#e4ecfa'), hex('#9cc0e8'), hex('#3a6aa8')];

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
export const SWAN_INK: SpearInk = { head: hex('#9cb0d4'), headLit: hex('#ffffff'), shaft: hex('#a49c8c'), shaftLit: hex('#e6e0d2'), band: hex('#c8d8f0') };

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

/** A small white feather on an icon, its quill from (x0, y0) to (x1, y1), vanes either side, its tip tinted. */
function iconFeather(put: (x: number, y: number, c: RGB) => void, x0: number, y0: number, x1: number, y1: number, t: Tones): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  for (let s = 0; s <= len; s += 0.4) {
    const u = s / len;
    const hw = Math.sin(Math.min(1, 0.15 + u) * Math.PI) * 0.9;
    for (let w = -hw; w <= hw; w += 0.45) put(x0 + ux * s - uy * w, y0 + uy * s + ux * w, u > 0.7 ? t[2] : w < 0 ? t[0] : t[1]);
  }
}

/** The Swan Maiden's chain: a slim silver spear with a tassel of white feathers at its socket. */
export function swanSpearIcon(k: SpearInk = SWAN_INK, t: Tones = SWAN_TONES): Uint8ClampedArray {
  return icon16((put) => {
    spear(put, 1.5, 14.5, 13.5, 2.5, k);
    // The tassel, hanging from the socket.
    iconFeather(put, 8.8, 8.4, 7.6, 12, t);
    iconFeather(put, 9.6, 8.6, 10.6, 11.8, t);
    put(14, 2, t[0]);
    put(15, 1, t[1]);
    put(13, 1, t[2]);
    put(15, 3, t[2]);
  });
}

/** The Swan Maiden's throw: the spear of light in flight, white feathers drifting down in its wake. */
export function swanThrowIcon(t: Tones = SWAN_TONES): Uint8ClampedArray {
  return icon16((put) => {
    seg(put, 0, 3, 4, 3, t[3]);
    seg(put, 1, 7, 5, 7, t[3]);
    for (let x = 4; x <= 11; x++) put(x, 5, x > 8 ? t[1] : t[2]);
    for (let x = 11; x <= 15; x++) {
      const hw = x < 13 ? x - 10 : 15 - x;
      for (let dy = -hw; dy <= hw; dy++) put(x, 5 + dy, dy === 0 ? t[0] : t[1]);
    }
    // Feathers falling behind it.
    iconFeather(put, 1.5, 9.5, 5.5, 13.5, t);
    iconFeather(put, 7.5, 9, 11, 12, t);
  });
}
