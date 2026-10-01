// Materials, spell colours and button icons for the Tidecaller, the wizard's
// sea sorceress. The figure itself is drawn by the wizard's rig (wizard.ts)
// with its `head` set to 'tide': long sea-green hair under a crown of coral, a
// collar of scallop shells, a hem that breaks in waves of foam, bubbles rising
// round her, and a driftwood staff whose coral tines cradle a glowing pearl.
// The Abyssal skin (`lure`) trades the coral for an anglerfish's lure.

import { hex, type Material, type RGB } from './pixel';
import type { SpellColors } from './effects';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------------------
// The Tidecaller

/** The robe: the sea from its depths up to the shallows. */
export const TIDE_ROBE: Material = {
  ramp: ramp('#0a1a2e', '#10304a', '#17506a', '#1f7088', '#3094a6'),
  outline: hex('#040a14'),
  outlineLit: hex('#0a1a2e'),
};

/** Its lining and the belt: deeper water. */
export const TIDE_INNER: Material = {
  ramp: ramp('#081222', '#0e2036', '#16304c', '#20446a'),
  outline: hex('#03060e'),
};

/** Sea foam: the breaking hem, the shell collar's edge. */
export const FOAM: Material = {
  ramp: ramp('#3a7a8a', '#7cc0cc', '#c4eef0', '#f4ffff'),
  outline: hex('#0e2a34'),
  outlineLit: hex('#1a3e4a'),
  shine: true,
};

/** Red coral: the crown and the staff's tines. */
export const CORAL: Material = {
  ramp: ramp('#4a0e18', '#8a1e2a', '#c83a3a', '#f06a5a', '#ffa890'),
  outline: hex('#1e0408'),
  outlineLit: hex('#34080e'),
  shine: true,
};

/** Scallop shells, pale pink to cream. */
export const SHELL: Material = {
  ramp: ramp('#7a5a5e', '#b88e8a', '#e8c4b4', '#fff0e4'),
  outline: hex('#2a1a1c'),
  outlineLit: hex('#3a2426'),
  shine: true,
};

/** Hair the green of deep kelp, catching the light like wet weed. */
export const SEA_HAIR: Material = {
  ramp: ramp('#0c2a2c', '#154a48', '#1f6e66', '#2e9486', '#58bca8'),
  outline: hex('#041012'),
  outlineLit: hex('#0a1e20'),
  shine: true,
};

/** Driftwood, bleached and worn smooth. */
export const DRIFTWOOD: Material = {
  ramp: ramp('#2a2420', '#4a4038', '#6e6254', '#988a78'),
  outline: hex('#100c0a'),
};

/** The pearl at the staff's head, lit from within. */
export const PEARL: Material = {
  ramp: ramp('#2a7a9a', '#5ac8e0', '#b8f4ff', '#ffffff'),
  outline: hex('#0a2430'),
  outlineLit: hex('#123646'),
  emissive: 0.9,
  shine: true,
  noAO: true,
};

// Sea light (light-only colours): white foam, through clear aqua, to deep blue.
export const TIDE_CORE = hex('#f0ffff');
export const TIDE_HOT = hex('#9cf4ff');
export const TIDE_MID = hex('#2ec4e0');
export const TIDE_DEEP = hex('#1a5ab8');

export const TIDE_SPELL: SpellColors = { core: TIDE_CORE, hot: TIDE_HOT, mid: TIDE_MID, deep: TIDE_DEEP, accent: hex('#e8fff8') };

// ---------------------------------------------------------------------------
// The Abyssal skin: a witch of the lightless deep. A robe black as the trench,
// pale blue-grey skin, violet-black hair, fins of glowing teal for foam, spots
// of living light on the cloth, and an anglerfish's lure arching over her brow.

export const ABYSS_ROBE: Material = {
  ramp: ramp('#06060e', '#0c0c1c', '#141430', '#1e1e46', '#2a2a5c'),
  outline: hex('#020206'),
  outlineLit: hex('#08081a'),
};

export const ABYSS_INNER: Material = {
  ramp: ramp('#0c0418', '#180a2c', '#261244', '#361c5c'),
  outline: hex('#04020a'),
};

/** Fins and frills that glow like the deep's creatures. */
export const ABYSS_FIN: Material = {
  ramp: ramp('#0a3a44', '#12626a', '#1e9a9a', '#4ad8c8'),
  outline: hex('#021216'),
  outlineLit: hex('#06222a'),
  emissive: 0.45,
  shine: true,
};

export const ABYSS_SKIN: Material = {
  ramp: ramp('#3a4658', '#5a6a80', '#8294aa', '#aabcd0'),
  outline: hex('#10141c'),
  outlineLit: hex('#1a2030'),
};

export const ABYSS_HAIR: Material = {
  ramp: ramp('#0c0818', '#1a1230', '#2a1e4a', '#3e2c66', '#5a428a'),
  outline: hex('#040208'),
  outlineLit: hex('#0e0a1a'),
  shine: true,
};

/** Blackened bone for the staff. */
export const ABYSS_BONE: Material = {
  ramp: ramp('#141418', '#26262e', '#3c3c48', '#565666'),
  outline: hex('#060608'),
};

/** The lure's bulb and the staff's orb: cold living light. */
export const LURE: Material = {
  ramp: ramp('#0a6a6a', '#2ad0c0', '#a8fff0', '#ffffff'),
  outline: hex('#021e1e'),
  outlineLit: hex('#063030'),
  emissive: 1,
  shine: true,
  noAO: true,
};

export const ABYSS_CORE = hex('#f0fffc');
export const ABYSS_HOT = hex('#a8fff0');
export const ABYSS_MID = hex('#3ae0d0');
export const ABYSS_DEEP = hex('#5a2ab8');

export const ABYSS_SPELL: SpellColors = { core: ABYSS_CORE, hot: ABYSS_HOT, mid: ABYSS_MID, deep: ABYSS_DEEP, accent: hex('#c8a8ff') };

// ---------------------------------------------------------------------------
// The Lotus skin: a water-lily priestess. Blue-black hair in a high bun with a
// pink lotus in it, layered robes of jade over white silk crossed at the
// throat, lily pads for shoulders, a pink sash, and a staff of green bamboo
// whose head is an opening lotus cradling a glowing pearl.

export const JADE_ROBE: Material = {
  ramp: ramp('#0c2a24', '#145040', '#1e7458', '#2e9a72', '#52c094'),
  outline: hex('#04120e'),
  outlineLit: hex('#0c2a24'),
};

/** White silk: the underskirt, the crossed collar, the front panel. */
export const LOTUS_SILK: Material = {
  ramp: ramp('#5a6a68', '#98aaa6', '#d4e2dc', '#f6fffa'),
  outline: hex('#1a2422'),
  outlineLit: hex('#2a3634'),
  shine: true,
};

/** Lotus pink: the blossom in her hair, the staff's petals, the sash. */
export const LOTUS_PINK: Material = {
  ramp: ramp('#7a2a4a', '#c04a78', '#f080a8', '#ffbcd4', '#fff0f6'),
  outline: hex('#2a0a18'),
  outlineLit: hex('#3e1224'),
  shine: true,
};

export const LILY_PAD: Material = {
  ramp: ramp('#123a1a', '#1e5a26', '#2e7e32', '#4ea444', '#80c860'),
  outline: hex('#061408'),
  outlineLit: hex('#0e2410'),
};

/** Ink-black hair with a blue sheen. */
export const INK_HAIR: Material = {
  ramp: ramp('#0a0810', '#16121e', '#241e30', '#363044', '#4e4862'),
  outline: hex('#030206'),
  outlineLit: hex('#0c0a12'),
  shine: true,
};

/** Green bamboo, for the staff. */
export const BAMBOO: Material = {
  ramp: ramp('#1e3a22', '#2e5a30', '#4a7e44', '#78a862'),
  outline: hex('#0a160a'),
};

/** Pale gold: hairpins and the sash's clasp. */
export const LOTUS_GOLD: Material = {
  ramp: ramp('#6a5018', '#a88a34', '#e0c460', '#fff4b8'),
  outline: hex('#221a06'),
  shine: true,
};

/** The pearl in the lotus: white, with a blush of pink and a jade sheen. */
export const LOTUS_PEARL: Material = {
  ramp: ramp('#5a9a94', '#b8ecdc', '#fff4fa', '#ffffff'),
  outline: hex('#183a36'),
  outlineLit: hex('#244a46'),
  emissive: 0.9,
  shine: true,
  noAO: true,
};

// Lotus light (light-only colours): pearl white, clear jade, deepening to a still green pool; pink petals for the accent.
export const LOTUS_CORE = hex('#f4fffa');
export const LOTUS_HOT = hex('#a8f4dc');
export const LOTUS_MID = hex('#3ed0b0');
export const LOTUS_DEEP = hex('#1a7a78');
export const LOTUS_BLUSH = hex('#ffa0c8');

export const LOTUS_SPELL: SpellColors = { core: LOTUS_CORE, hot: LOTUS_HOT, mid: LOTUS_MID, deep: LOTUS_DEEP, accent: LOTUS_BLUSH, petals: true };

// ---------------------------------------------------------------------------
// Button icons

export const TIDE_TONES: Tones = [TIDE_CORE, TIDE_HOT, TIDE_MID, TIDE_DEEP];
export const ABYSS_TONES: Tones = [ABYSS_CORE, ABYSS_HOT, ABYSS_MID, ABYSS_DEEP];
export const LOTUS_TONES: Tones = [LOTUS_CORE, LOTUS_HOT, LOTUS_MID, LOTUS_DEEP];

/** The tidal wave: a curling wall of water, foam along its lip and spray flying off it. */
export function waveIcon(k: Tones = TIDE_TONES): Uint8ClampedArray {
  return icon16((put) => {
    // The body of the wave: rising from the right, curling over to the left.
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const fx = (x + 0.5) / 16;
        // The wave's top edge: low at the right, a tall crest at about a third across.
        const top = 13 - 10 * Math.exp(-Math.pow((fx - 0.4) / 0.3, 2)) + (fx > 0.4 ? 0 : (0.4 - fx) * 8);
        if (y + 0.5 < top || y > 14) continue;
        const depth = (y + 0.5 - top) / (15 - top);
        put(x, y, depth < 0.18 ? k[1] : depth < 0.5 ? k[2] : k[3]);
      }
    }
    // The curl: the lip hanging over the hollow, foam white along its edge.
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.95 + (i / 10) * Math.PI * 1.1;
      const x = 5.5 + Math.cos(a) * 3;
      const y = 5.5 + Math.sin(a) * 2.6;
      put(x, y, i > 3 ? k[0] : k[1]);
    }
    // The hollow under the lip.
    put(5, 7, k[3]);
    put(6, 7, k[3]);
    put(5, 6, [k[3][0] >> 1, k[3][1] >> 1, k[3][2] >> 1]);
    // Foam along the back of the wave, and spray.
    seg(put, 8, 3, 14, 11, k[1]);
    for (const [x, y] of [[9, 1], [12, 3], [2, 3], [14, 7]]) put(x, y, k[0]);
  });
}

/** Lotus's wave: the same curling wall of jade water, lily pads riding its back and pink petals in its spray. */
export function lilyWaveIcon(k: Tones = LOTUS_TONES): Uint8ClampedArray {
  const px = waveIcon(k);
  const set = (x: number, y: number, c: RGB) => {
    const i = (y * 16 + x) * 4;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  const pad = hex('#5ec850');
  const padDark = hex('#2e7e32');
  const rose = hex('#ff70a8');
  // Two lily pads riding down the back of the wave, a notch cut in each.
  for (const [x, y] of [[10, 7], [13, 10]]) {
    for (const [ox, oy] of [[-1, 0], [0, 0], [1, 0], [0, 1], [-1, 1]]) set(x + ox, y + oy, pad);
    set(x + 1, y + 1, padDark);
  }
  // A lotus open on the first pad.
  set(10, 6, LOTUS_BLUSH);
  set(9, 6, rose);
  set(11, 6, rose);
  // Petals flung off the crest among the spray.
  set(2, 3, LOTUS_BLUSH);
  set(9, 1, LOTUS_BLUSH);
  set(1, 6, rose);
  return px;
}
