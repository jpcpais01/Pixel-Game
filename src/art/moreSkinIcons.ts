// Icons and brew colours for the fighter's, alchemist's, archer's and rogue's
// newer skins: the luchador, the stone guardian, the bone shaman, Cryotech and
// the wild hunt. (The corsair's and the kitsune's are in rogue.ts, with the
// rogue's other icons.)

import { hex } from './pixel';
import {
  barrageIcon,
  CHAMP_FIST,
  fistIcon,
  GUARDIAN_PALM,
  iconPainter,
  LUCHA_FIST,
  palmIcon,
  quakeIcon,
  type BrewColors,
  type FistColors,
  type PalmColors,
  type QuiverColors,
} from './effects';

/** The bone shaman's juju: teal spirit-fire. */
const SPIRIT_BREW_COLORS: BrewColors = {
  ramp: ['#b0ffe6', '#4af0c0', '#1ab090', '#0a5a4a'],
  surface: '#8affd8',
  glint: '#e0fff4',
  bone: ['#f2ecd8', '#b8ac92', '#0a1c16'],
  ink: '#06120e',
  fume: ['#c8fff0', '#70f0cc', '#2ab898', '#0e6a58'],
};

/** Cryotech's freezing chem. */
const CRYO_BREW_COLORS: BrewColors = {
  ramp: ['#e6faff', '#8ad4ff', '#3a88e8', '#1c4aa0'],
  surface: '#b8e8ff',
  glint: '#ffffff',
  bone: ['#f4f8ff', '#a8b8cc', '#0a1426'],
  ink: '#060c1a',
  fume: ['#f0fbff', '#b0e0ff', '#6aaaf0', '#2e5ab0'],
};

/** Brew colours by alchemist look, for the looks that aren't the plague doctor's, the witch's or Chemtech's. */
export const SKIN_BREWS: Record<string, BrewColors> = {
  alchemist_shaman: SPIRIT_BREW_COLORS,
  alchemist_cryo: CRYO_BREW_COLORS,
};

/** The wild hunt's bow of bone, raven fletching and moonlight. */
const HUNT_QUIVER: QuiverColors = {
  bow: ['#f0e6cc', '#ccba96', '#56483a'],
  string: '#e4dcff',
  fletch: ['#48547a', '#141828'],
  head: ['#f8f0ff', '#9a80f0'],
  light: ['#f8f0ff', '#d4c4ff', '#9a80f0'],
  ink: '#07060c',
};

/** The scarecrow's crooked branch and twine, crow fletching and ember heads trailing ghost-green. */
const SCARECROW_QUIVER: QuiverColors = {
  bow: ['#8a7250', '#5a4630', '#2a1e14'],
  string: '#a8946a',
  fletch: ['#3a4260', '#0e0f18'],
  head: ['#fff0a0', '#ff8a2a'],
  light: ['#fff4d0', '#9cff9a', '#ff8a2a'],
  ink: '#0a0604',
};

/** Quiver colours by archer look, for the looks that aren't the ranger's or the storm's. */
export const SKIN_QUIVERS: Record<string, QuiverColors> = {
  archer_hunt: HUNT_QUIVER,
  archer_scarecrow: SCARECROW_QUIVER,
};

/** 16x16 icon for the bone shaman's attack: a gourd with a glyph of juju glowing on it, a red feather in its stopper. */
export function gourdIcon(b: BrewColors): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  const tone = (dx: number, dy: number, r: number) => {
    const k = (dx + dy) / r;
    return k < -0.7 ? '#f0d08a' : k < 0 ? '#d8a852' : k < 0.7 ? '#b07a2e' : '#7e4c1a';
  };
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const bx = x + 0.5 - 7.5;
      const by = y + 0.5 - 10.4;
      const hx = x + 0.5 - 7.8;
      const hy = y + 0.5 - 4.4;
      if (Math.hypot(bx, by) <= 4.4) put(x, y, tone(bx, by, 4.4));
      else if (Math.hypot(hx, hy) <= 2.2) put(x, y, tone(hx, hy, 2.2));
    }
  }
  // The stopper, and the feather in it.
  put(7, 1, '#4a2a0e');
  put(8, 1, '#4a2a0e');
  outline('#1c0e04');
  put(9, 0, '#ee5a36');
  put(10, 0, '#c02a1a');
  // A zigzag glyph round the belly, glowing.
  for (const [x, y, c] of [[4, 10, 1], [5, 11, 0], [6, 10, 1], [7, 11, 0], [8, 10, 1], [9, 11, 0], [10, 10, 1]] as const) put(x, y, b.ramp[c]);
  put(7, 13, b.ramp[2]);
  // Spirit curling up off it.
  put(12, 3, b.surface);
  put(13, 1, b.ramp[1]);
  put(3, 2, b.ramp[1]);
  return px;
}

/** Writes a hex colour straight into a 16x16 icon's pixels, over whatever is there. */
function paint(px: Uint8ClampedArray, x: number, y: number, c: string): void {
  if (x < 0 || y < 0 || x >= 16 || y >= 16) return;
  const n = parseInt(c.slice(1), 16);
  const i = (y * 16 + x) * 4;
  px[i] = n >> 16;
  px[i + 1] = (n >> 8) & 255;
  px[i + 2] = n & 255;
  px[i + 3] = 255;
}

/** Tigerclaw's: a dark leather glove, a white-wrapped wrist, orange streaks. */
const TIGER_FIST: FistColors = { glove: ['#b07a4a', '#7e5230', '#54341e', '#2a180c'], shine: '#e0b488', wrist: ['#ffffff', '#e8e2ea', '#aea6b4'], lines: ['#ffd08a', '#ff7a1a'] };

/** Tigerclaw's attack: the clawed glove, three ivory claws hooked out over the knuckles. */
function tigerFistIcon(): Uint8ClampedArray {
  const px = fistIcon(TIGER_FIST);
  for (const [x, y, c] of [
    [8, 1, '#cabc98'], [9, 0, '#ffffff'], [10, 1, '#1a140c'], [11, 1, '#cabc98'], [12, 0, '#ffffff'], [13, 1, '#1a140c'], [13, 2, '#cabc98'], [14, 1, '#ffffff'],
    [8, 0, '#1a140c'], [10, 0, '#1a140c'], [11, 0, '#1a140c'], [13, 0, '#1a140c'], [15, 1, '#1a140c'], [14, 0, '#1a140c'],
  ] as const) paint(px, x, y, c);
  // A stripe across the back of the glove, in orange.
  for (const [x, y] of [[8, 6], [9, 7], [12, 7], [13, 8]] as const) paint(px, x, y, '#f48a26');
  return px;
}

/** Tigerclaw's barrage: the burning fists, three black-edged claw slashes torn across them. */
function tigerBarrageIcon(): Uint8ClampedArray {
  const px = barrageIcon([hex('#fff4e0'), hex('#ffb040'), hex('#ff6a10'), hex('#7a2a08')]);
  for (const i of [0, 1, 2]) {
    for (let k = 0; k < 6; k++) {
      const x = 3 + i * 4 + Math.round(k * 0.5);
      const y = 3 + k + (i === 1 ? 2 : 0);
      paint(px, x, y, k === 0 || k === 5 ? '#ffb040' : '#fff4e0');
      paint(px, x + 1, y, '#140806');
    }
  }
  return px;
}

/** The Monkey King's: a bare palm, a golden bracer, golden qi. */
const WUKONG_PALM: PalmColors = {
  skin: ['#fcd4b4', '#e8a682', '#b06a50'],
  bracer: ['#fffad0', '#ffd860', '#d8a428', '#90600e'],
  qi: ['#fffbe8', '#ffe070', '#ffb020'],
  outline: '#1a0a02',
};

/** A little golden auspicious cloud in an icon's corner: two billows, a curl, an amber rim. */
function cloudBadge(px: Uint8ClampedArray, ox: number, oy: number): void {
  const fill: [number, number][] = [
    [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
    [4, 0],
  ];
  for (const [x, y] of fill) paint(px, ox + x, oy + y, y === 0 ? '#ffffff' : y === 3 ? '#ffd060' : '#fff4cc');
  for (const [x, y] of [[2, 1], [2, 2], [1, 2]] as const) paint(px, ox + x, oy + y, '#ffb020');
  for (const [x, y] of [[0, 0], [3, 0], [5, 0], [-1, 1], [6, 1], [-1, 2], [7, 2], [0, 3], [6, 3], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4]] as const) {
    const i = ((oy + y) * 16 + ox + x) * 4;
    if (ox + x >= 0 && ox + x < 16 && oy + y >= 0 && oy + y < 16 && px[i + 3] === 0) paint(px, ox + x, oy + y, '#7a3a0a');
  }
}

/** The fighter's skins' ability icons, registered under their keys by `add`. */
export function registerMoreSkinIcons(add: (key: string, px: Uint8ClampedArray) => void): void {
  add('icon_fist_lucha', fistIcon(LUCHA_FIST));
  add('icon_barrage_lucha', barrageIcon([hex('#fff8e8'), hex('#ffd35c'), hex('#ff4fa0'), hex('#9a1c6a')]));
  add('icon_fist_champ', fistIcon(CHAMP_FIST));
  add('icon_barrage_champ', barrageIcon([hex('#f8ffe8'), hex('#9cff5a'), hex('#ff8a2a'), hex('#1c7a1a')]));
  add('icon_palm_guardian', palmIcon(GUARDIAN_PALM));
  add('icon_quake_guardian', quakeIcon(GUARDIAN_PALM));
  add('icon_fist_tiger', tigerFistIcon());
  add('icon_barrage_tiger', tigerBarrageIcon());
  add('icon_palm_wukong', palmIcon(WUKONG_PALM));
  const quake = quakeIcon(WUKONG_PALM);
  cloudBadge(quake, 9, 3);
  add('icon_quake_wukong', quake);
}
