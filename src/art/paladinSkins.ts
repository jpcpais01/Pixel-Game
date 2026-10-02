// Materials and button icons for two paladin skins: the Templar's Lionheart
// and the Crusader's Inquisitor. The figures themselves are drawn by the
// paladin rig (paladin.ts), switched by the look's `lion` and `inquisitor` flags.
// They live in their own file so other skins' work in heroSkins.ts never meets them.

import { hex, type Material, type RGB } from './pixel';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------------------
// Lionheart (the Templar's skin): a lion knight in white-and-gold plate, a
// closed helm with a golden lion's face for a visor ringed by a tawny mane,
// a crimson tabard and shield bearing gold lions, and a lion-headed mace.

const LION_INK = hex('#1a120c');

/** Warm white plate, cream in the shade rather than the Templar's cold blue. */
export const LION_PLATE: Material = {
  ramp: ramp('#40342a', '#7a6a58', '#b8a88e', '#e8dfcc', '#fffcf2'),
  outline: LION_INK,
  outlineLit: hex('#3c3026'),
  shine: true,
};

export const LION_PLATE_DARK: Material = {
  ramp: ramp('#2e241c', '#5a4a3a', '#8c7a62', '#bcac90'),
  outline: LION_INK,
};

/** Royal crimson for the tabard, the cape and the shield's field. */
export const LION_RED: Material = {
  ramp: ramp('#2a0610', '#520c1c', '#861a28', '#b82c32', '#dc544a'),
  outline: hex('#14030a'),
  outlineLit: hex('#320812'),
};

/** The tawny mane round the helm and the mace's head. */
export const MANE: Material = {
  ramp: ramp('#2e1206', '#5c2a0e', '#8a461a', '#b4682a', '#d89048'),
  outline: hex('#1c0c04'),
  outlineLit: hex('#3a1e0c'),
};

/** Lit gold, the lion's face when it kindles and the shield's boss: it glows in the dark. */
export const LION_FIRE: Material = {
  ramp: ramp('#b4501a', '#e88a2a', '#ffc04a', '#fff0b0'),
  outline: hex('#3a1808'),
  emissive: 0.75,
  shine: true,
  noAO: true,
};

/** Sunlit gold with a roaring amber edge (light-only). */
export const LION_CORE = hex('#fffbe8');
export const LION_HOT = hex('#ffd870');
export const LION_MID = hex('#ff9a2a');
const LION_DEEP = hex('#c8401a');

// ---------------------------------------------------------------------------
// Inquisitor (the Crusader's skin): a grim witch-hunter in dark steel and
// black leather, a wide-brimmed hat over a steel half-mask, a long crimson
// sash, silver studs and buckles, a censer swinging at his belt, and a
// blackened hammer that burns with purging white fire.

const INQ_INK = hex('#050608');

/** Dark steel with a cold blue cast, polished to silver only at the edges. */
export const INQ_STEEL: Material = {
  ramp: ramp('#111317', '#252930', '#424854', '#727a88', '#c4cad6'),
  outline: INQ_INK,
  outlineLit: hex('#1a1c22'),
  shine: true,
};

/** Black leather: boots, gloves' cuffs, the faulds' straps. */
export const INQ_LEATHER: Material = {
  ramp: ramp('#0c0a0a', '#1a1616', '#2c2624', '#443a36'),
  outline: INQ_INK,
};

/** The long leather coat. */
export const INQ_COAT: Material = {
  ramp: ramp('#0c0a0a', '#1a1616', '#2c2626', '#443a38', '#5e5250'),
  outline: hex('#040303'),
  outlineLit: hex('#1a1414'),
};

/** The sash: a deep, dried-blood crimson. */
export const INQ_RED: Material = {
  ramp: ramp('#2a050c', '#520a16', '#821420', '#b0222a', '#d84440'),
  outline: hex('#120206'),
  outlineLit: hex('#2c0610'),
};

/** Silver: studs, buckles, the hat band, the shield rim and the hammer's bands. */
export const SILVER: Material = {
  ramp: ramp('#2c2e34', '#5a5e68', '#9aa0aa', '#d4d8e0', '#ffffff'),
  outline: hex('#0a0b0e'),
  shine: true,
};

/** Black felt for the hat. */
export const HAT: Material = {
  ramp: ramp('#090808', '#151313', '#23201f', '#35302e', '#4c4442'),
  outline: hex('#030202'),
  outlineLit: hex('#141010'),
};

/** Grizzled grey hair, swept back under the hat. */
export const INQ_HAIR: Material = {
  ramp: ramp('#26262a', '#46464c', '#727278', '#a0a0a8'),
  outline: hex('#0c0c0e'),
};

/** Purging fire: white-silver flame on the shield, the hammer kindled, the censer's coal. */
export const PURGE: Material = {
  ramp: ramp('#7a8698', '#bcc6d6', '#eaf0f8', '#ffffff'),
  outline: hex('#1a1e28'),
  emissive: 0.85,
  shine: true,
  noAO: true,
};

/** White-silver light with crimson embers (light-only). */
export const PURGE_CORE = hex('#ffffff');
export const PURGE_HOT = hex('#dfe6f2');
export const PURGE_EMBER = hex('#ff4a4a');
const PURGE_DEEP = hex('#a8142a');

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

/** The Lionheart's mace: a golden lion's face in a dark tawny mane on a white, gold-banded haft. */
export function lionMaceIcon(): Uint8ClampedArray {
  return solidIcon('#1a120c', (put) => {
    for (let i = 0; i < 8; i++) put(2 + i, 13 - i, i < 3 ? '#861a28' : i === 5 ? '#f4cf6a' : '#e8dfcc');
    put(1, 14, '#f4cf6a');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x + 0.5 - 10.5;
        const dy = y + 0.5 - 5.5;
        const d = Math.hypot(dx, dy);
        // The mane: tufts round the rim, lit on the upper left, dark in the notches.
        const tuft = Math.cos(Math.atan2(dy, dx) * 6);
        if (d > 2.4 && d <= 4.0 + tuft * 0.7) put(x, y, tuft < -0.3 ? '#5c2a0e' : dx + dy < -1.5 ? '#d89048' : '#8a461a');
        else if (d <= 2.4) put(x, y, dx + dy < -1.4 ? '#fff4bf' : dx + dy < 1.4 ? '#f4cf6a' : '#d69a3a');
      }
    }
    // The face: two eyes, the bridge of the nose and a snarling mouth.
    put(9, 4, '#2a140f');
    put(11, 4, '#2a140f');
    put(10, 4, '#fff4bf');
    put(10, 5, '#f4cf6a');
    put(10, 6, '#5b2f1d');
    put(9, 6, '#9a5a26');
    put(11, 6, '#9a5a26');
  });
}

/** The Lionheart's consecration: a ring of gold light under a lion's face of light, its mane flaring. */
export function lionGroundIcon(): Uint8ClampedArray {
  const cols: RGB[] = [LION_CORE, LION_HOT, LION_MID, LION_DEEP];
  const px = lightIcon((put) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const q = Math.hypot((x + 0.5 - 8) / 7, (y + 0.5 - 12.6) / 3.0);
        if (Math.abs(q - 0.9) < 0.11) put(x, y, y > 12 ? cols[1] : cols[2]);
        else if (Math.abs(q - 0.64) < 0.09 && hash(x, y, 5) > 0.45) put(x, y, cols[3]);
        // The face, and the mane round it in tufts of fire.
        const dx = x + 0.5 - 8;
        const dy = y + 0.5 - 5.5;
        const d = Math.hypot(dx, dy);
        const tuft = Math.cos(Math.atan2(dy, dx) * 7);
        if (d <= 2.4) put(x, y, d < 1.5 ? cols[0] : cols[1]);
        else if (d <= 3.8 + tuft * 0.9) put(x, y, tuft > 0.2 ? cols[2] : cols[3]);
      }
    }
    // Light rising from the face into the ring.
    for (let y = 9; y <= 12; y++) put(y % 2 ? 7 : 8, y, cols[2]);
    for (const [x, y] of [[2, 2], [13, 1], [1, 7], [14, 8]]) put(x, y, cols[3]);
  });
  // The face's eyes and mouth are cut out of the light, so it reads as a face.
  for (const [x, y] of [[6, 4], [9, 4], [7, 6], [8, 6]]) px.fill(0, (y * 16 + x) * 4, (y * 16 + x) * 4 + 4);
  return px;
}

/** The Inquisitor's hammer: a blackened head banded in silver, a spike burning white with a crimson ember. */
export function inquisitorHammerIcon(): Uint8ClampedArray {
  return solidIcon('#050608', (put) => {
    for (let i = 0; i < 9; i++) put(2 + i, 13 - i, i < 3 ? '#2c2626' : i % 3 === 0 ? '#d4d8e0' : '#1a1616');
    put(1, 14, '#9aa0aa');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const u = (x + 0.5 - 11) * 0.7071 + (y + 0.5 - 5) * 0.7071;
        const v = (x + 0.5 - 11) * 0.7071 - (y + 0.5 - 5) * 0.7071;
        if (Math.abs(u) > 4.2 || Math.abs(v) > 2.2) continue;
        const band = Math.abs(u) > 3.0 || Math.abs(u) < 0.5;
        const lit = v > 0.9 || u < -2.2;
        put(x, y, band ? (lit ? '#ffffff' : '#9aa0aa') : lit ? '#727a88' : v < -0.9 ? '#111317' : '#2a2e36');
      }
    }
    put(6, 7, '#424854');
    put(13, 2, '#ffffff');
    put(14, 1, '#eaf0f8');
    put(15, 0, '#ff4a4a');
  });
}

/** The Inquisitor's purge: a white flame falling into a blast ring, crimson embers flying. */
const PURGE_FLAME = ['...o...', '...oo..', '..ohoo.', '.ohhho.o', '.ohhhhoo', 'ohhcchho', 'ohccchho', '.ohccho.', '..ohho..', '...oo...'];
export function purgeFallIcon(): Uint8ClampedArray {
  const cols: RGB[] = [PURGE_CORE, PURGE_HOT, hex('#8e9ab0'), PURGE_EMBER, PURGE_DEEP];
  return lightIcon((put) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const q = Math.hypot((x + 0.5 - 8) / 7.2, (y + 0.5 - 12.6) / 3.0);
        if (Math.abs(q - 0.9) < 0.11) put(x, y, y > 12 ? cols[1] : cols[2]);
        else if (Math.abs(q - 0.62) < 0.09 && hash(x, y, 9) > 0.5) put(x, y, cols[4]);
      }
    }
    // The flame, licking up and to the right as it falls.
    PURGE_FLAME.forEach((row, r) => {
      for (let i = 0; i < row.length; i++) {
        const k = row[i];
        if (k !== '.') put(5 + i, r, k === 'c' ? cols[0] : k === 'h' ? cols[1] : cols[2]);
      }
    });
    for (let y = 10; y <= 12; y++) put(8, y, y > 11 ? cols[0] : cols[1]);
    for (const [x, y] of [[3, 3], [13, 1], [2, 8], [14, 7], [12, 10], [4, 10]]) put(x, y, cols[3]);
  });
}
