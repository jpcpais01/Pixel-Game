// Materials, spell colours and button icons for the Druid. The figure itself
// is drawn by the wizard's rig (wizard.ts), switched by its `head`: 'grove'
// for the Grovekeeper and 'wild' for the Shapeshifter.

import { hex, type Material, type RGB } from './pixel';
import type { SpellColors } from './effects';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------------------
// The Grovekeeper: a hood of moss with antlers growing through it, a mantle of
// leaves, a robe hemmed with leaves and fireflies, and a living staff whose
// twigs cradle a glowing seed.

export const MOSS: Material = {
  ramp: ramp('#131d0e', '#1f3217', '#2f4c24', '#456c33', '#628f46'),
  outline: hex('#070b05'),
  outlineLit: hex('#141f0e'),
};

/** The hood's lining, round the face: old bark. */
export const BARK: Material = {
  ramp: ramp('#1a120c', '#2c1e14', '#40301f', '#56432c'),
  outline: hex('#0a0604'),
};

/** Young leaves, gold-green: the hem, the mantle's edge and the staff's twigs. */
export const LEAF: Material = {
  ramp: ramp('#34520f', '#62861c', '#9fbe36', '#dbe775'),
  outline: hex('#121c05'),
  outlineLit: hex('#1f2d0a'),
};

export const ANTLER: Material = {
  ramp: ramp('#56432f', '#86694a', '#b89e76', '#e8dab6'),
  outline: hex('#1c1309'),
  outlineLit: hex('#2c1f10'),
  shine: true,
};

/** Wood that still grows: dark bark with a green cast. */
export const LIVEWOOD: Material = {
  ramp: ramp('#241a10', '#43301d', '#654a2c', '#8a6c44'),
  outline: hex('#0f0905'),
};

export const SEED: Material = {
  ramp: ramp('#2f7a24', '#7ed447', '#d4ff86', '#fbffe6'),
  outline: hex('#0c2408'),
  outlineLit: hex('#16380e'),
  emissive: 0.9,
  shine: true,
  noAO: true,
};

// Grove light (light-only colours): sunlit green, deepening to forest.
export const GROVE_CORE = hex('#f6ffe0');
export const GROVE_HOT = hex('#d8ff8a');
export const GROVE_MID = hex('#7ee05a');
export const GROVE_DEEP = hex('#2e8a4a');
export const GROVE_GOLD = hex('#ffd66b');

export const GROVE_SPELL: SpellColors = { core: GROVE_CORE, hot: GROVE_HOT, mid: GROVE_MID, deep: GROVE_DEEP, accent: GROVE_GOLD };

// ---------------------------------------------------------------------------
// The Shapeshifter: a wolf's pelt worn as a hood, its head over her brow and
// its eyes still burning amber; a mantle of grey fur, woad on the cheeks, a
// hide robe, and a staff hung with fangs round a lump of amber.

export const HIDE: Material = {
  ramp: ramp('#1c120e', '#2e1e16', '#44301f', '#5c4430', '#7a5c40'),
  outline: hex('#0a0604'),
  outlineLit: hex('#1c120e'),
};

/** The tunic under the hide. */
export const TUNIC: Material = {
  ramp: ramp('#10141c', '#1c2230', '#2a3246', '#3c465e'),
  outline: hex('#06080c'),
};

/** Fangs and claws on the staff and the belt. */
export const FANG: Material = {
  ramp: ramp('#5a5040', '#948a70', '#cfc6a8', '#f4f0e0'),
  outline: hex('#1a160e'),
  shine: true,
};

/** The wolf's grey pelt. */
export const PELT: Material = {
  ramp: ramp('#26262e', '#45454f', '#6f6f82', '#a2a2b4', '#d2d2de'),
  outline: hex('#0b0b10'),
  outlineLit: hex('#1b1b22'),
};

/** The wolf's pale muzzle and throat. */
export const MUZZLE: Material = {
  ramp: ramp('#5e5e6c', '#8e8e9e', '#c2c2d0', '#eeeef6'),
  outline: hex('#16161e'),
  outlineLit: hex('#24242e'),
};

/** Her own hair, dark auburn. */
export const AUBURN: Material = {
  ramp: ramp('#2a120c', '#4a2014', '#6e3420', '#94502e'),
  outline: hex('#12060a'),
};

export const WOAD: Material = {
  ramp: ramp('#1c3a86', '#2e5cc6', '#4a7ae0'),
  outline: hex('#0a1430'),
  noAO: true,
};

/** The pelt's eyes, still burning. */
export const WOLF_EYE: Material = {
  ramp: ramp('#ff9a20', '#ffd060', '#fff0b0'),
  outline: hex('#2a1004'),
  emissive: 1,
  noAO: true,
};

export const WOLF_NOSE: Material = {
  ramp: ramp('#08080c', '#16161c'),
  outline: hex('#040406'),
  noAO: true,
};

export const AMBER: Material = {
  ramp: ramp('#8a3a0a', '#e0801e', '#ffc860', '#fff4d0'),
  outline: hex('#2a1004'),
  outlineLit: hex('#40180a'),
  emissive: 0.9,
  shine: true,
  noAO: true,
};

// Spirit light (light-only colours): amber, burning down to russet.
export const WILD_CORE = hex('#fff6e0');
export const WILD_HOT = hex('#ffd27a');
export const WILD_MID = hex('#f09a3a');
export const WILD_DEEP = hex('#8a3a1e');

export const WILD_SPELL: SpellColors = { core: WILD_CORE, hot: WILD_HOT, mid: WILD_MID, deep: WILD_DEEP, accent: hex('#fff0c0') };

// ---------------------------------------------------------------------------
// Button icons: 16x16, drawn additively on the buttons, so black is empty and
// where shapes overlap the brighter colour stays.

export type Put = (x: number, y: number, c: RGB) => void;

/** A blank 16x16 icon and a pen for it that keeps the brighter colour. */
export function icon16(draw: (put: Put) => void): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put: Put = (x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    if (px[i + 3] && px[i] + px[i + 1] + px[i + 2] >= c[0] + c[1] + c[2]) return;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  draw(put);
  return px;
}

/** A one-pixel line. */
export function seg(put: Put, x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
}

/** Colours for an icon, brightest first. */
export type Tones = [RGB, RGB, RGB, RGB];

export const GROVE_TONES: Tones = [GROVE_CORE, GROVE_HOT, GROVE_MID, GROVE_DEEP];
export const WILD_TONES: Tones = [WILD_CORE, WILD_HOT, WILD_MID, WILD_DEEP];

/** The thorn seed: a glowing seed bristling with thorns, a leaf sprouting from its top. */
export function thornSeedIcon(k: Tones = GROVE_TONES): Uint8ClampedArray {
  return icon16((put) => {
    // Thorns first, so the seed sits over their roots.
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + 0.45 + (i / 7) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      seg(put, 8 + ca * 3.4, 9 + sa * 4, 8 + ca * 6.6, 9 + sa * 6.6, k[3]);
      put(8 + ca * 6.8, 9 + sa * 6.8, k[2]);
    }
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = (x + 0.5 - 8) / 3.3;
        const dy = (y + 0.5 - 9.2) / 4.1;
        const d = Math.hypot(dx, dy);
        if (d > 1) continue;
        put(x, y, d < 0.35 ? k[0] : dx + dy < -0.3 ? k[1] : d < 0.75 ? k[1] : k[2]);
      }
    }
    // The sprout: a stem and two little leaves.
    seg(put, 8, 5, 8, 2, k[2]);
    put(7, 2, k[1]);
    put(6, 1, k[1]);
    put(9, 3, k[1]);
    put(10, 2, k[1]);
    put(11, 2, k[2]);
  });
}

/** The wild grove: a ring of green on the ground with shoots springing up inside and fireflies over it. */
export function groveIcon(k: Tones = GROVE_TONES): Uint8ClampedArray {
  return icon16((put) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot((x + 0.5 - 8) / 7.2, (y + 0.5 - 12) / 3.1);
        if (d > 1) continue;
        put(x, y, d > 0.78 ? k[2] : (x + y) % 2 ? k[3] : [k[3][0] >> 1, k[3][1] >> 1, k[3][2] >> 1]);
      }
    }
    // Three shoots, the middle one tallest, each with a leaf.
    const shoot = (x: number, h: number, lean: number) => {
      for (let i = 0; i <= h; i++) put(x + Math.round(lean * (i / h) ** 2), 12 - i, i > h - 2 ? k[0] : k[1]);
      put(x + Math.round(lean) + (lean >= 0 ? 1 : -1), 12 - h + 1, k[1]);
      put(x - (lean >= 0 ? 1 : -1), 12 - Math.round(h / 2), k[2]);
    };
    shoot(8, 8, 0);
    shoot(5, 5, -1.5);
    shoot(11, 5, 1.5);
    for (const [x, y] of [[3, 4], [13, 3], [10, 1], [2, 8]]) put(x, y, k[0]);
  });
}

/** Spirit claws: three raking slashes, hot at their heads. */
export function clawsIcon(k: Tones = WILD_TONES): Uint8ClampedArray {
  return icon16((put) => {
    for (let n = 0; n < 3; n++) {
      const ox = n * 3.6 - 3.6;
      for (let i = 0; i <= 12; i++) {
        const f = i / 12;
        // A shallow curve from the upper right down to the lower left.
        const x = 12.5 + ox - f * 9 - Math.sin(f * Math.PI) * 1.6;
        const y = 1.5 + f * 12.5;
        const w = Math.sin(f * Math.PI);
        put(x, y, w > 0.75 ? k[0] : w > 0.45 ? k[1] : k[2]);
        if (w > 0.5) put(x + 1, y, k[2]);
        if (w > 0.8) put(x - 1, y, k[3]);
      }
    }
  });
}

/** Pounce: a leap's arc of spirit light coming down on a paw print. */
export function pounceIcon(k: Tones = WILD_TONES): Uint8ClampedArray {
  return icon16((put) => {
    for (let i = 0; i <= 16; i++) {
      const f = i / 16;
      const x = 1 + f * 10;
      const y = 10 - Math.sin(f * Math.PI) * 8.5 + f * 1.5;
      put(x, y, f > 0.7 ? k[1] : f > 0.35 ? k[2] : k[3]);
      if (f > 0.55) put(x, y + 1, k[3]);
    }
    // The paw: a pad and four toes.
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (Math.hypot((x + 0.5 - 12) / 2.1, (y + 0.5 - 13.3) / 1.6) <= 1) put(x, y, k[1]);
      }
    }
    for (const [x, y] of [[9, 11], [10, 9], [13, 9], [14, 11]]) {
      put(x, y, k[0]);
    }
    put(11, 13, k[0]);
  });
}
