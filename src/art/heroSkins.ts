// Materials and button icons for six skins: the wizard's Astral and Hellfire,
// the warrior's Spartan, the paladin's Seraph and Oathbreaker, and the Jedi's
// Temple guard. The figures themselves are drawn by each hero's own rig
// (wizard.ts, warrior.ts, paladin.ts, jedi.ts), switched by a look flag.

import { hex, type Material, type RGB } from './pixel';
import type { MeteorColors, SpellColors } from './effects';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------------------
// Astral (the Arcanist's skin): a star-reader in a midnight robe strewn with
// stars, a tall fan collar, long silver hair under a gold circlet, a crown of
// stars over the head, and a starwood staff ringed like an armillary sphere.

const NIGHT_INK = hex('#05060f');

export const STAR_ROBE: Material = {
  ramp: ramp('#0a0c22', '#131a3c', '#1d295c', '#2b3d80', '#3f56a6'),
  outline: NIGHT_INK,
  outlineLit: hex('#141a38'),
};

/** The collar's face and the robe's open front: a deep violet night. */
export const STAR_LINING: Material = {
  ramp: ramp('#110a26', '#1e1442', '#2d1f60', '#3f2c80'),
  outline: NIGHT_INK,
};

export const STAR_HAIR: Material = {
  ramp: ramp('#4a476e', '#8784ae', '#c4c2e2', '#f6f4ff'),
  outline: hex('#15132a'),
  outlineLit: hex('#2c2a4a'),
};

/** Pale silvered wood. */
export const STARWOOD: Material = {
  ramp: ramp('#34344e', '#62668c', '#a2a8c8', '#e0e4f6'),
  outline: hex('#0c0c1a'),
  shine: true,
};

export const STAR_CRYSTAL: Material = {
  ramp: ramp('#a8661a', '#f2c050', '#fff2a6', '#ffffff'),
  outline: hex('#2a1a08'),
  outlineLit: hex('#4a300c'),
  emissive: 0.95,
  shine: true,
  noAO: true,
};

// Starlight (light-only colours): white and pale gold, deepening to indigo.
export const STAR_CORE = hex('#fffdf2');
export const STAR_HOT = hex('#fff0a8');
export const STAR_MID = hex('#ffc860');
export const STAR_DEEP = hex('#6a5ae0');
export const STAR_ROSE = hex('#ff9ad8');

/** The Astral's orbs are stars; their motes rose. */
export const ASTRAL_SPELL: SpellColors = { core: STAR_CORE, hot: STAR_HOT, mid: STAR_MID, deep: STAR_DEEP, accent: STAR_ROSE, star: true };

// ---------------------------------------------------------------------------
// Hellfire (the Pyromancer's skin): a horned warlock with crimson skin, a
// black robe lined in blood red, fel-green runes, bone spikes at the
// shoulders and a black staff crowned with horns round a green flame.

const HELL_INK = hex('#040504');

export const HELL_ROBE: Material = {
  ramp: ramp('#0c0f0d', '#1a201b', '#29322b', '#3b483d', '#56685a'),
  outline: HELL_INK,
  outlineLit: hex('#151a16'),
};

export const HELL_LINING: Material = {
  ramp: ramp('#1a0707', '#2e0c0e', '#461416', '#621c1c'),
  outline: HELL_INK,
};

/** Fel runes and trim: a green that smoulders in the dark. */
export const FEL_TRIM: Material = {
  ramp: ramp('#0c3812', '#1c7426', '#46cc44', '#a4ff78', '#eaffc8'),
  outline: hex('#031006'),
  shine: true,
  emissive: 0.45,
};

export const DEMON_SKIN: Material = {
  ramp: ramp('#4a1216', '#7e2226', '#b43a30', '#e0684a'),
  outline: hex('#160406'),
  outlineLit: hex('#2e080c'),
};

export const HELL_HAIR: Material = {
  ramp: ramp('#050507', '#0e0e12', '#1a1a22', '#2a2a36'),
  outline: hex('#020203'),
};

/** Ram's horn and bone: ivory, darkening to the root. */
export const HORN: Material = {
  ramp: ramp('#2a2018', '#54443a', '#8e7c68', '#d2c4a8', '#f4ecd8'),
  outline: hex('#120c08'),
  outlineLit: hex('#2a2018'),
  shine: true,
};

export const FEL_EYE: Material = {
  ramp: ramp('#8aff5a', '#eaffc0'),
  outline: HELL_INK,
  emissive: 1,
  noAO: true,
};

export const FEL_CRYSTAL: Material = {
  ramp: ramp('#0e5a1a', '#2eb83a', '#9aff6a', '#f0ffd8'),
  outline: hex('#031a08'),
  outlineLit: hex('#08300e'),
  emissive: 0.95,
  shine: true,
  noAO: true,
};

// Fel fire (light-only colours).
export const FEL_CORE = hex('#f4ffe8');
export const FEL_HOT = hex('#c8ff7a');
export const FEL_MID = hex('#5ee83a');
export const FEL_DEEP = hex('#1a8a3a');

export const HELL_SPELL: SpellColors = { core: FEL_CORE, hot: FEL_HOT, mid: FEL_MID, deep: FEL_DEEP, accent: hex('#eaffb0'), flame: true };

/** A black rock burning with green fire. */
export const HELL_METEOR: MeteorColors = {
  flame: ['#f4ffe0', '#b8ff6a', '#46d83a', '#127a2e'],
  rock: ['#3e3a44', '#26232c', '#18161c', '#0e0c12', '#060508'],
  cracks: ['#c8ff7a', '#5ee83a'],
};

/** The scorch it leaves: green embers along the rim. */
export const FEL_EMBERS: [RGB, RGB, RGB] = [[184, 255, 106], [46, 184, 58], [30, 110, 40]];

// ---------------------------------------------------------------------------
// Spartan (the Knight's skin): a Corinthian helm with a tall crimson crest,
// a bronze muscle cuirass over bare arms, a skirt of leather strips, bronze
// greaves, a crimson cloak, a round bronze shield and a leaf-bladed sword.

export const BRONZE: Material = {
  ramp: ramp('#2e170c', '#5c3216', '#955a24', '#cc8c3e', '#f4d08a'),
  outline: hex('#140904'),
  outlineLit: hex('#2e170c'),
  shine: true,
};

/** Pteruges: a skirt of stiff leather strips. */
export const PTERUGES: Material = {
  ramp: ramp('#2a120c', '#4a2214', '#6e3a20', '#94562e'),
  outline: hex('#100604'),
};

export const SPARTAN_RED: Material = {
  ramp: ramp('#3a0808', '#680e10', '#9a1a18', '#c8302a', '#e86448'),
  outline: hex('#180304'),
  outlineLit: hex('#380808'),
};

/** Sun-browned skin for his bare arms and legs. */
export const TAN_SKIN: Material = {
  ramp: ramp('#5a2e22', '#8e4e36', '#c27a52', '#e8a878'),
  outline: hex('#200e0a'),
  outlineLit: hex('#3e1e16'),
};

// ---------------------------------------------------------------------------
// Seraph (the Templar's skin): pearl-white plate, a dawn-rose cape, golden
// hair under a floating halo, and great white wings.

const PEARL_INK = hex('#1a1420');

export const PEARL: Material = {
  ramp: ramp('#4a3e52', '#7e7088', '#b8aabb', '#e4dae0', '#fffaf6'),
  outline: PEARL_INK,
  outlineLit: hex('#3e3446'),
  shine: true,
};

export const PEARL_DARK: Material = {
  ramp: ramp('#3a3044', '#665a72', '#9a8ca4', '#c8bccc'),
  outline: PEARL_INK,
};

export const DAWN: Material = {
  ramp: ramp('#4a1a36', '#7a2e4e', '#b04e68', '#e07a82', '#ffae9e'),
  outline: hex('#1e0814'),
  outlineLit: hex('#3a1026'),
};

export const FEATHER: Material = {
  ramp: ramp('#6a6480', '#a8a4c0', '#dcdaee', '#fbfaff'),
  outline: hex('#1c1a2c'),
  outlineLit: hex('#3a3850'),
};

export const SERAPH_HAIR: Material = {
  ramp: ramp('#6a3a14', '#a8661e', '#e0a43a', '#ffe08a'),
  outline: hex('#2a1406'),
  outlineLit: hex('#4a2a0c'),
  shine: true,
};

/** The halo: a ring of gold light. */
export const HALO: Material = {
  ramp: ramp('#e0a040', '#ffd870', '#fff4c0', '#ffffff'),
  outline: hex('#5a3a10'),
  emissive: 0.9,
  noAO: true,
  noOutline: true,
};

/** Dawn light (light-only): white-gold warming to peach and rose. */
export const DAWN_CORE = hex('#fffaf4');
export const DAWN_HOT = hex('#fff0d0');
export const DAWN_MID = hex('#ffc890');
export const DAWN_DEEP = hex('#ff8ab8');

// ---------------------------------------------------------------------------
// Oathbreaker (the Crusader's skin): a fallen crusader in black-violet plate,
// a horned great helm, spiked pauldrons, a tattered violet cloak, tarnished
// trim, an eclipse on the shield and a hammer wreathed in violet flame.

const OATH_INK = hex('#07050c');

export const OATH_PLATE: Material = {
  ramp: ramp('#110e18', '#221c2e', '#3a3048', '#5e5070', '#a898b8'),
  outline: OATH_INK,
  outlineLit: hex('#1e1828'),
  shine: true,
};

export const OATH_PLATE_DARK: Material = {
  ramp: ramp('#0e0c14', '#1c1824', '#2e2838', '#463e52'),
  outline: OATH_INK,
};

export const OATH_CLOTH: Material = {
  ramp: ramp('#0e0814', '#1a1026', '#2a1a3c', '#3c2654', '#553670'),
  outline: OATH_INK,
  outlineLit: hex('#1c1028'),
};

/** Tarnished gold, gone dark and dull. */
export const TARNISH: Material = {
  ramp: ramp('#1c120e', '#36281a', '#5a442e', '#86684a', '#b4966a'),
  outline: hex('#0a0604'),
  shine: true,
};

/** Violet flame: the eclipse on the shield and the hammer when it kindles. */
export const VOIDFIRE: Material = {
  ramp: ramp('#4a1a8a', '#7a3ad8', '#b07aff', '#ecd8ff'),
  outline: hex('#14062a'),
  emissive: 0.8,
  shine: true,
  noAO: true,
};

export const ECLIPSE_CORE = hex('#f6eeff');
export const ECLIPSE_HOT = hex('#d8b0ff');
export const ECLIPSE_MID = hex('#a060ff');

// ---------------------------------------------------------------------------
// Temple guard (the Jedi's skin): a tall pointed hood over a white mask,
// cream robes trimmed in gold over a tawny tunic, dark gloves, and a
// long-hilted saber of gold light.

export const GUARD_ROBE: Material = {
  ramp: ramp('#4a4038', '#7e7264', '#b4a894', '#dcd2bc', '#f6f0e0'),
  outline: hex('#1a140e'),
  outlineLit: hex('#3a3024'),
};

export const GUARD_TUNIC: Material = {
  ramp: ramp('#2e1a0c', '#4e2e14', '#744620', '#9a6430'),
  outline: hex('#120a04'),
};

export const GUARD_GLOVE: Material = {
  ramp: ramp('#140c08', '#241610', '#382418', '#4e3422'),
  outline: hex('#080404'),
};

export const MASK: Material = {
  ramp: ramp('#6e6a70', '#aaa6ac', '#dcdade', '#fbfaff'),
  outline: hex('#18161c'),
  outlineLit: hex('#3a383e'),
  shine: true,
};

export const GUARD_GOLD: Material = {
  ramp: ramp('#5b2f1d', '#9a5a26', '#d69a3a', '#f4cf6a', '#fff4bf'),
  outline: hex('#2a140f'),
  shine: true,
};

const blade = (core: string[], edge: string[]): { core: Material; edge: Material } => ({
  core: { ramp: ramp(...core), outline: hex('#120e1f'), emissive: 1, noAO: true, noOutline: true },
  edge: { ramp: ramp(...edge), outline: hex('#120e1f'), emissive: 1, noAO: true, noOutline: true },
});

export const SABER_GOLD = blade(['#fff6d0', '#fffdf2'], ['#d89a10', '#f2c630', '#ffe680']);
export const SABER_GOLD_GLOW = hex('#ffc830');

// ---------------------------------------------------------------------------
// Button icons (16x16).

type Put = (x: number, y: number, c: string) => void;

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** A solid icon (normal blend) with a dark outline round whatever was painted. */
function solidIcon(ink: string, paint: (put: Put) => void): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put: Put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * S + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  paint(put);
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && px[(y * S + x) * 4 + 3] === 255;
  const out: [number, number][] = [];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (filled(x, y)) continue;
      if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) out.push([x, y]);
    }
  }
  for (const [x, y] of out) put(x, y, ink);
  return px;
}

/** An icon of pure light (drawn additively): where shapes overlap the brighter colour wins. */
function lightIcon(paint: (put: (x: number, y: number, c: RGB) => void) => void): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  paint((x, y, c) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    if (px[i] + px[i + 1] + px[i + 2] >= c[0] + c[1] + c[2]) return;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  });
  return px;
}

/** The Seraph's mace: a pearl head with golden wings for flanges, a white haft. */
export function seraphMaceIcon(): Uint8ClampedArray {
  return solidIcon('#1a1420', (put) => {
    for (let i = 0; i < 8; i++) put(2 + i, 13 - i, i < 3 ? '#7e7088' : i === 5 ? '#ffd870' : '#e4dae0');
    put(1, 14, '#ffd870');
    // Two little gold wings spread from the head.
    for (const [x, y] of [[6, 4], [5, 3], [4, 3], [6, 3], [7, 2], [5, 2]]) put(x, y, y === 2 ? '#fff4c0' : '#e0a43a');
    for (const [x, y] of [[12, 10], [13, 11], [13, 12], [12, 11], [11, 12], [14, 11]]) put(x, y, x === 14 ? '#fff4c0' : '#e0a43a');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x + 0.5 - 11;
        const dy = y + 0.5 - 5;
        const d = Math.hypot(dx, dy);
        if (d <= 2.9) put(x, y, dx + dy < -2.2 ? '#fffaf6' : dx + dy < 0.6 ? '#e4dae0' : d > 2.2 ? '#7e7088' : '#b8aabb');
      }
    }
    put(12, 1, '#fff4c0');
    put(13, 0, '#ffffff');
    put(11, 4, '#ffffff');
  });
}

/** The Seraph's sacred ground: a ring on the ground and a pair of wings of light rising from it. */
export function dawnGroundIcon(): Uint8ClampedArray {
  const cols: RGB[] = [DAWN_CORE, DAWN_HOT, DAWN_MID, DAWN_DEEP];
  return lightIcon((put) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const q = Math.hypot((x + 0.5 - 8) / 7, (y + 0.5 - 12) / 3.4);
        if (Math.abs(q - 0.9) < 0.1) put(x, y, y > 12 ? cols[1] : cols[2]);
        else if (Math.abs(q - 0.7) < 0.08 && hash(x, y, 5) > 0.45) put(x, y, cols[3]);
      }
    }
    // Wings of light: feathers fanning out and up from a bright heart.
    for (const k of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const len = 5 - i;
        for (let j = 1; j <= len; j++) put(8 + k * j, 8 - i - Math.round(j * 0.6), j === len ? cols[2] : i === 0 ? cols[1] : cols[2]);
      }
    }
    for (let y = 5; y <= 11; y++) put(8, y, y < 8 ? cols[0] : cols[1]);
    put(7, 8, cols[0]);
    put(9, 8, cols[0]);
    for (const [x, y] of [[3, 1], [13, 2], [2, 9], [14, 8]]) put(x, y, cols[3]);
  });
}

/** The Oathbreaker's hammer: a black iron head banded in tarnished gold, a violet-burning spike. */
export function oathHammerIcon(): Uint8ClampedArray {
  return solidIcon('#07050c', (put) => {
    for (let i = 0; i < 9; i++) put(2 + i, 13 - i, i < 3 ? '#3a2418' : '#2a1a3c');
    put(1, 14, '#86684a');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const u = (x + 0.5 - 11) * 0.7071 + (y + 0.5 - 5) * 0.7071;
        const v = (x + 0.5 - 11) * 0.7071 - (y + 0.5 - 5) * 0.7071;
        if (Math.abs(u) > 4.2 || Math.abs(v) > 2.2) continue;
        const band = Math.abs(u) > 3.0;
        const lit = v > 0.9 || u < -2.2;
        put(x, y, band ? (lit ? '#b4966a' : '#5a442e') : lit ? '#a898b8' : v < -0.9 ? '#221c2e' : '#5e5070');
      }
    }
    // Spikes off both faces and the top, the top one burning violet.
    put(6, 7, '#5e5070');
    put(15, 3, '#5e5070');
    put(13, 2, '#ecd8ff');
    put(14, 1, '#b07aff');
    put(15, 0, '#7a3ad8');
  });
}

/** The Oathbreaker's Eclipse fall: a black sun ringed in violet fire above a blast ring. */
export function eclipseFallIcon(): Uint8ClampedArray {
  const cols: RGB[] = [ECLIPSE_CORE, ECLIPSE_HOT, ECLIPSE_MID, hex('#4a1a8a')];
  return lightIcon((put) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 4);
        // The corona: a ring of fire round a dark heart.
        if (d >= 2.2 && d < 3.0) put(x, y, cols[0]);
        else if (d >= 3.0 && d < 3.8) put(x, y, cols[2]);
        else if (d >= 3.8 && d < 4.6 && hash(x, y, 7) > 0.5) put(x, y, cols[3]);
        const q = Math.hypot((x + 0.5 - 8) / 7.2, (y + 0.5 - 12.5) / 3.2);
        if (Math.abs(q - 0.9) < 0.11) put(x, y, y > 12 ? cols[1] : cols[2]);
        else if (Math.abs(q - 0.64) < 0.09 && hash(x, y, 9) > 0.5) put(x, y, cols[3]);
      }
    }
    for (let y = 8; y <= 12; y++) {
      put(8, y, y > 10 ? cols[0] : cols[1]);
      put(7, y, cols[2]);
    }
    for (const [x, y] of [[2, 3], [14, 4], [3, 8], [13, 9]]) put(x, y, cols[3]);
  });
}

/** The Temple guard's saber: a long gold-banded hilt and a blade of gold light (drawn additively). */
export function pikeSaberIcon(): Uint8ClampedArray {
  const cols: RGB[] = [hex('#fffdf2'), hex('#ffe680'), hex('#f2c630'), hex('#d89a10')];
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: RGB, a = 1) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    px[i] = Math.min(255, px[i] + c[0] * a);
    px[i + 1] = Math.min(255, px[i + 1] + c[1] * a);
    px[i + 2] = Math.min(255, px[i + 2] + c[2] * a);
    px[i + 3] = 255;
  };
  for (let i = 0; i < 9; i++) {
    const x = 6 + i;
    const y = 9 - i;
    put(x, y, cols[0]);
    put(x + 1, y, cols[1], 0.9);
    put(x, y - 1, cols[1], 0.9);
    put(x + 1, y + 1, cols[3], 0.35);
    put(x - 1, y - 1, cols[3], 0.35);
  }
  // The long hilt, banded in gold.
  for (const [x, y, gold] of [[5, 10, 0], [4, 11, 1], [3, 12, 0], [2, 13, 1], [1, 14, 0], [0, 15, 1]] as const) {
    put(x, y, gold ? [240, 190, 90] : [200, 208, 224], gold ? 0.8 : 0.55);
  }
  return px;
}
