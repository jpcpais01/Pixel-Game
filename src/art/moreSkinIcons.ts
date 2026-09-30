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

/** The fighter's skins' ability icons, registered under their keys by `add`. */
export function registerMoreSkinIcons(add: (key: string, px: Uint8ClampedArray) => void): void {
  add('icon_fist_lucha', fistIcon(LUCHA_FIST));
  add('icon_barrage_lucha', barrageIcon([hex('#fff8e8'), hex('#ffd35c'), hex('#ff4fa0'), hex('#9a1c6a')]));
  add('icon_fist_champ', fistIcon(CHAMP_FIST));
  add('icon_barrage_champ', barrageIcon([hex('#f8ffe8'), hex('#9cff5a'), hex('#ff8a2a'), hex('#1c7a1a')]));
  add('icon_palm_guardian', palmIcon(GUARDIAN_PALM));
  add('icon_quake_guardian', quakeIcon(GUARDIAN_PALM));
}
