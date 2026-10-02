// Materials, brew colours and button icons for the Brass Diver, Chemtech's
// deep-sea skin. The figure is drawn by the alchemist's rig (alchemist.ts) on
// the chem rig, switched by its `diver` flag: a round brass helmet with three
// riveted portholes and a glowing face behind the front glass, a copper
// corselet, a canvas suit under leather braces and a weight belt, lead-soled
// brass boots, an air hose looping back to a brass tank, and chem carried in
// little glass diving bells of bioluminescent teal.

import { hex, type Material, type RGB } from './pixel';
import { iconPainter, type BrewColors } from './effects';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** The helmet's brass, and the tank's. */
export const HELM_BRASS: Material = { ramp: ramp('#3a2408', '#6e4a14', '#a8782a', '#dcb04e', '#fff0a0'), outline: hex('#160c02'), outlineLit: hex('#2a1806'), shine: true };
/** Brighter brass: porthole rims, rivets, caps. */
export const RIM_BRASS: Material = { ramp: ramp('#4a3010', '#8a6420', '#c89a3a', '#f0d070', '#fffad0'), outline: hex('#1a1004'), shine: true };
/** The copper corselet over the shoulders. */
export const CORSELET: Material = { ramp: ramp('#3a1a0c', '#6e3418', '#a85a2c', '#d8864a', '#f6b880'), outline: hex('#180a04'), outlineLit: hex('#2a1408'), shine: true };
/** The canvas suit. */
export const CANVAS: Material = { ramp: ramp('#3a3226', '#625644', '#8c7e64', '#b4a688', '#d6caa8'), outline: hex('#16120c'), outlineLit: hex('#262018') };
/** Rubber: gloves, the air hose, the hood seen through the back. */
export const RUBBER: Material = { ramp: ramp('#141210', '#26221e', '#3a342e', '#544c42'), outline: hex('#060504') };
/** Lead: the boots' soles and the weights on the belt. */
export const LEAD: Material = { ramp: ramp('#22242a', '#3a3e46', '#5a5f6a', '#80868f'), outline: hex('#0a0b0e'), shine: true };
/** The front porthole: dark sea-green glass lit from inside. */
export const PORT_GLASS: Material = { ramp: ramp('#041e1c', '#08403a', '#0e6a5a', '#2aa888'), outline: hex('#020c0a'), emissive: 0.45, noAO: true };
/** The eyes glowing behind the glass. */
export const DIVER_EYE: Material = { ramp: ramp('#0a6a5a', '#2ae0b0', '#9affe0', '#f0fff8'), outline: hex('#02140f'), emissive: 1, noAO: true };
/** The chem: bioluminescent teal-green. */
export const BELL_BREW: Material = { ramp: ramp('#0a5a4a', '#18b08a', '#5af0c0', '#e0fff4'), outline: hex('#02140f'), emissive: 0.8, noAO: true };

/** The Brass Diver's chem on the icons and in the pool's fumes. */
export const DIVER_BREW_COLORS: BrewColors = {
  ramp: ['#e0fff4', '#5af0c0', '#18b08a', '#0a5a4a'],
  surface: '#8affd8',
  glint: '#f0fff8',
  bone: ['#e8fff6', '#9ad8c8', '#04201c'],
  ink: '#03100e',
  fume: ['#d8fff2', '#80f0d0', '#2ab898', '#0e6a5a'],
};

const BRASS_ICON = ['#fffad0', '#f0d070', '#c89a3a', '#8a6420'] as const;
const GLASS_ICON = ['#e8fffa', '#a8d8d0', '#6a9c98'] as const;

/**
 * Paints a glass diving bell into an icon, its crown at (cx, top) and `h` px
 * tall: a brass cap, glass flaring to a riveted brass rim, the chem filling
 * its lower part, lit from the top left.
 */
function paintBell(put: (x: number, y: number, c: string) => void, b: BrewColors, cx: number, top: number, h: number, w: number): void {
  for (let y = top; y < top + h; y++) {
    const u = (y - top) / (h - 1);
    // A rounded dome that straightens into flared sides.
    const hw = w * (u < 0.35 ? Math.sqrt(u / 0.35) * 0.8 : 0.8 + (u - 0.35) * 0.3);
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw) - 1; x++) {
      const t = (x + 0.5 - cx) / Math.max(0.5, hw);
      if (Math.abs(t) > 1) continue;
      if (y === top + h - 1) put(x, y, t < -0.3 ? BRASS_ICON[1] : t < 0.4 ? BRASS_ICON[2] : BRASS_ICON[3]);
      else if (u < 0.2) put(x, y, t < -0.2 ? BRASS_ICON[0] : t < 0.4 ? BRASS_ICON[1] : BRASS_ICON[2]);
      else if (u < 0.5) put(x, y, t < -0.5 ? GLASS_ICON[0] : t < 0.5 ? GLASS_ICON[1] : GLASS_ICON[2]);
      else put(x, y, t < -0.5 ? b.ramp[0] : t < 0.2 ? b.ramp[1] : t < 0.7 ? b.ramp[2] : b.ramp[3]);
    }
  }
}

/** A bubble on an icon: a ring of three or a single glint. */
function bubble(put: (x: number, y: number, c: string) => void, x: number, y: number, big: boolean, c: string): void {
  if (!big) {
    put(x, y, c);
    return;
  }
  put(x, y - 1, c);
  put(x - 1, y, c);
  put(x + 1, y, c);
  put(x, y + 1, c);
}

/** The Brass Diver's attack: a little glass diving bell of glowing chem, bubbles rising off it. */
export function bellIcon(b: BrewColors = DIVER_BREW_COLORS): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  paintBell(put, b, 7.5, 3, 12, 5.2);
  // The ring on the crown, and rivets round the rim.
  put(7, 2, BRASS_ICON[1]);
  put(8, 2, BRASS_ICON[2]);
  for (const x of [4, 7, 10]) put(x, 14, BRASS_ICON[0]);
  put(5, 8, '#ffffff');
  for (let x = 4; x <= 11; x++) put(x, 9, b.surface);
  outline(b.ink);
  bubble(put, 12, 3, true, b.surface);
  bubble(put, 14, 0, false, b.glint);
  bubble(put, 2, 4, false, b.ramp[1]);
  bubble(put, 13, 7, false, b.ramp[1]);
  return px;
}

/** The Brass Diver's special: three diving bells fanning over a splash of chem, bubbles boiling up. */
export function bellBarrageIcon(b: BrewColors = DIVER_BREW_COLORS): Uint8ClampedArray {
  const { px, put, outline } = iconPainter();
  for (let x = 1; x <= 14; x++) {
    const h = Math.round(1.6 - Math.abs(x - 7.5) * 0.2);
    for (let y = 15 - Math.max(0, h); y <= 15; y++) put(x, y, y === 15 - h ? b.surface : b.ramp[2]);
  }
  paintBell(put, b, 2.8, 6, 7, 2.3);
  paintBell(put, b, 13.2, 6, 7, 2.3);
  paintBell(put, b, 8, 3, 10, 3.0);
  outline(b.ink);
  bubble(put, 8, 0, false, b.glint);
  bubble(put, 2, 2, true, b.surface);
  bubble(put, 14, 2, false, b.ramp[1]);
  bubble(put, 12, 1, false, b.surface);
  return px;
}
