// Saltglass Flats' colours: the ground's kinds (see ../types.ts KindStyle)
// and the materials its props are drawn in. The water is a mirror, so its
// ramps are the sky's: by day pastel blue going lilac and cream where clouds
// pass over it, by night deep indigo holding the stars (its glow). The salt
// is warm white by day and the brightest thing under the moon.

import { hex, type Material, type RGB } from '../../../art/pixel';
import type { KindStyle } from '../types';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** The ground's kinds, by index into SALT_KINDS. */
export const K = {
  Mirror: 0,
  /** The mirror again, its stars warm instead of cool (a kind only for the glow's colour). */
  Warm: 1,
  Rose: 2,
  Film: 3,
  Salt: 4,
  Earth: 5,
  Rock: 6,
  Ichu: 7,
  Plank: 8,
  Beam: 9,
  Crystal: 10,
  Ojo: 11,
} as const;

/** The stars in the mirror, cool and warm, and the salt's glimmer under the moon. */
const STARLIGHT: RGB = hex('#cfe0ff');
const STAR_WARM: RGB = hex('#ffe0b4');
const GLIMMER: RGB = hex('#a8c0ff');

/** The sky the mirror holds, darkest first: clear blue, then the clouds' lavender shade, lilac, cream and their sunlit gold-white tops; by night the clouds are only a little lighter than the starry dark. */
const SKY_DAY = ramp('#7c9fc4', '#88a9cb', '#95b3d2', '#a2bdd9', '#b0c7df', '#bdcfe4', '#c9d4e8', '#d4d9eb', '#dfdeed', '#e9e3ec', '#f1e8e8', '#f7eee4', '#fbf4e6', '#fffaf0');
const SKY_NIGHT = ramp('#060a1c', '#09102a', '#0c1532', '#101a3a', '#121d3e', '#152142', '#182546', '#1c294a', '#202d4f', '#253253', '#2a3758', '#303c5d', '#364262', '#3d4868');

export const SALT_KINDS: KindStyle[] = [
  // The mirror: the sky's colours, softly dithered between steps.
  { day: SKY_DAY, night: SKY_NIGHT, mid: 0, relief: 0, glow: STARLIGHT, dither: 0.7 },
  { day: SKY_DAY, night: SKY_NIGHT, mid: 0, relief: 0, glow: STAR_WARM, dither: 0.7 },
  // The rose lagoons, where the water itself is pink and the flamingos wade.
  {
    day: ramp('#b98ea8', '#c197ae', '#c8a1b5', '#cfabbc', '#d6b5c3', '#dcbfc9', '#e2c8cf', '#e7d1d5', '#ecd9db', '#f0e1e1', '#f5e8e6', '#f8eeeb', '#fbf4f0', '#fffaf6'),
    night: ramp('#120a1c', '#160d22', '#1b1128', '#20152e', '#261a35', '#2c203c', '#332643', '#3a2d4a', '#423452', '#4a3c59', '#534561', '#5d4e69', '#675872', '#72627b'),
    mid: 0,
    relief: 0,
    glow: STARLIGHT,
    dither: 0.7,
  },
  // A film of water over the salt: the sky, paled by the white beneath.
  {
    day: ramp('#9fb8d0', '#acc2d7', '#b9cbdd', '#c6d4e3', '#d2dde8', '#dde5ec', '#e7ecef', '#f0f1f0'),
    night: ramp('#101830', '#141d36', '#18223c', '#1d2843', '#232f4a', '#2a3652', '#323e5a', '#3b4762'),
    mid: 0,
    relief: 1,
    glow: STARLIGHT,
    dither: 0.5,
  },
  // Salt crust, its polygon ridges catching the light.
  {
    day: ramp('#a99d8f', '#bdb2a4', '#cfc5b8', '#ddd5ca', '#e8e2d8', '#f1ece4', '#f8f5ef', '#fffdf9'),
    night: ramp('#2a3248', '#323b52', '#3b455c', '#455067', '#505b72', '#5c677d', '#697488', '#778294'),
    mid: 4,
    relief: 4,
    glow: GLIMMER,
    dither: 0.4,
  },
  // The islands' pale earth.
  {
    day: ramp('#7d6550', '#937a62', '#a78f75', '#b9a287', '#c9b499', '#d7c4ab', '#e3d3bd', '#eee2d0'),
    night: ramp('#1a1a26', '#21212e', '#292936', '#31323f', '#3a3b48', '#444652', '#4f515c', '#5a5d68'),
    mid: 4,
    relief: 6,
    dither: 0.5,
  },
  // Old coral stone, grey-brown and pitted.
  {
    day: ramp('#3e3634', '#504643', '#635754', '#776a65', '#8b7d77', '#9f918a', '#b3a59d', '#c6b9b0'),
    night: ramp('#0e1018', '#13151f', '#191c27', '#20232f', '#272b38', '#2f3441', '#383d4a', '#424754'),
    mid: 4,
    relief: 6,
  },
  // Ichu, the high plains' golden bunch grass.
  {
    day: ramp('#6b5a2c', '#857036', '#a08843', '#b9a052', '#cdb466', '#dfc77f', '#eedb9d'),
    night: ramp('#16171c', '#1c1d22', '#222429', '#292b30', '#303338', '#383b40', '#41444a'),
    mid: 3,
    relief: 2,
  },
  // Boardwalk planks, weathered silver-tan.
  {
    day: ramp('#5a4a3c', '#6e5b4a', '#83705c', '#978470', '#aa9884', '#bcab97', '#ccbcaa'),
    night: ramp('#14141c', '#191a22', '#1f2029', '#262731', '#2d2f39', '#353742', '#3e404b'),
    mid: 3,
    relief: 4,
  },
  // Beams, gaps, posts.
  {
    day: ramp('#2a2019', '#3a2d23', '#4b3b2e', '#5d4a3a', '#6f5a48'),
    night: ramp('#07080d', '#0b0c12', '#101219', '#151720', '#1b1e27'),
    mid: 2,
    relief: 3,
  },
  // Salt crystals heaped in little clusters, glimmering by night.
  {
    day: ramp('#c8c0b8', '#e0dbd4', '#f2efea', '#ffffff'),
    night: ramp('#4a5670', '#5e6a84', '#7480a0', '#8c98b8'),
    mid: 2,
    relief: 2,
    glow: GLIMMER,
  },
  // Ojos: round eyes of deep water in the crust.
  {
    day: ramp('#2f5f7a', '#3a7590', '#4a8aa3', '#5f9fb4', '#7ab3c4', '#9cc8d2'),
    night: ramp('#050c1c', '#081226', '#0c1a30', '#11233c', '#172c46', '#203852'),
    mid: 0,
    relief: 0,
    glow: STARLIGHT,
  },
];

// ---------------------------------------------------------------- props' materials

const m = (r: string[], outline: string, lit?: string, extra: Partial<Material> = {}): Material => ({ ramp: ramp(...r), outline: hex(outline), ...(lit ? { outlineLit: hex(lit) } : {}), ...extra });

// Wood: silvered posts and stilts, warmer boards, the tea house's frame.
export const WOOD_OLD = m(['#2c241e', '#3d332b', '#504439', '#645749', '#796b5b', '#8f816f', '#a59784'], '#16110d', '#2c241e');
export const WOOD_WARM = m(['#3a2618', '#4e3320', '#64432a', '#7b5536', '#926843', '#a97c52', '#bf9264'], '#1c1109', '#3a2618');
export const WOOD_DARK = m(['#1c1410', '#281d17', '#36281f', '#453428', '#544132'], '#0c0806', '#1c1410');
// Paper panels and lanterns.
export const PAPER = m(['#9c8c78', '#b5a58f', '#cbbca5', '#ddd0ba', '#ebe1cd', '#f6efdf', '#fffaf0'], '#4a3e30', '#7a6c5a');
export const PAPER_LIT = m(['#c8702a', '#e08e3a', '#f2ac50', '#fcc86c', '#ffe09a', '#fff2cc'], '#5a2e0c', undefined, { emissive: 0.75, noAO: true });
export const LANTERN = m(['#b04a2a', '#d0663a', '#ec8a4c', '#fbaa64', '#ffcc8a', '#ffe6b8'], '#4a1a0c', undefined, { emissive: 0.95, noAO: true });
export const FLAME = m(['#ffd27a', '#fff0c0', '#ffffff'], '#3a1e08', undefined, { emissive: 1, noAO: true, noOutline: true });
// The tea house's roof: old copper gone to soft verdigris.
export const ROOF = m(['#22403c', '#2c524c', '#38655c', '#46786b', '#578b7a', '#6c9e8b', '#86b09c', '#a4c3b0'], '#11221f', '#22403c');
export const ROOF_TRIM = m(['#5e3a24', '#7a4c2e', '#98603a', '#b27648', '#c98e5c'], '#2c180c', '#5e3a24');
// The train car: faded mint paint over rust, cream band, iron.
export const PAINT = m(['#3c5a54', '#4c6e66', '#5e8278', '#73968a', '#8aaa9c', '#a2bcae', '#bccfc2'], '#1c2a28', '#3c5a54');
export const CREAM = m(['#8e8270', '#a89b86', '#c0b39c', '#d4c8b1', '#e4dac5', '#f0e9d8'], '#3e362a', '#6a604e');
export const RUST = m(['#3e1e12', '#58291a', '#743622', '#8e462c', '#a85a38', '#c07048'], '#1e0d07', '#3e1e12');
export const IRON = m(['#14141a', '#1e1e26', '#2a2a34', '#383844', '#4a4a56', '#5e5e6a'], '#08080c', undefined, { shine: true });
export const WINDOW_LIT = m(['#b8641e', '#d8862c', '#f0a83e', '#ffc85a', '#ffe08a', '#fff2c0'], '#3a1e08', undefined, { emissive: 0.85, noAO: true });
export const WINDOW_DARK = m(['#1a2232', '#222c40', '#2c384e', '#3a4860', '#4c5c74'], '#0c1018', undefined, { shine: true });
// Stones: salt-pale, warm tan, blue-grey.
export const STONE_PALE = m(['#5a5248', '#70675b', '#877d6f', '#9e9484', '#b4ab9a', '#c9c1b0', '#dcd6c6', '#ece7da', '#f8f4ea'], '#2a251e', '#5a5248');
export const STONE_TAN = m(['#3e3128', '#524134', '#675342', '#7d6652', '#937a63', '#a98f76', '#bea48a', '#d1b9a0'], '#1e1712', '#3e3128');
export const STONE_BLUE = m(['#232a30', '#303942', '#3f4a54', '#505c66', '#636f78', '#78848c', '#8e99a0', '#a6b0b4'], '#11151a', '#232a30');
export const CORAL = m(['#2e2826', '#3e3633', '#504643', '#635754', '#776a65', '#8b7d77', '#9f918a', '#b3a59d'], '#161210', '#2e2826');
// Salt heaped in cones.
export const SALT = m(['#9a9488', '#b3ada2', '#cac5bb', '#dcd8d0', '#ebe8e2', '#f6f4f0', '#ffffff'], '#5e584e', '#8a8478');
// Chimes and their ribbons.
export const BRASS = m(['#4a3412', '#6a4c1c', '#8c6828', '#b08a3a', '#d0aa52', '#ead070', '#fff0a8'], '#24180a', undefined, { shine: true });
export const SILVER = m(['#3a4048', '#525a64', '#6c7580', '#88919c', '#a6aeb8', '#c4cad2', '#e4e8ee'], '#1a1e24', undefined, { shine: true });
export const RIBBON = m(['#8a3a5a', '#a84c6e', '#c46484', '#da809a', '#ec9eb2', '#f8c0ce'], '#401a2a', undefined, { noOutline: true });
export const RIBBON_BLUE = m(['#2a4a7a', '#365e94', '#4874ac', '#5e8cc2', '#7aa6d6', '#a0c2e6'], '#121e34', undefined, { noOutline: true });
export const STRING = m(['#5a4e40', '#7a6c5a'], '#2a2218', undefined, { noOutline: true, noAO: true });
// Plants of the high islands: tola shrubs, cardón cacti, ichu grass, the cactus's flower.
export const TOLA = m(['#34361a', '#454822', '#585c2a', '#6c7034', '#828440', '#9a9a4e', '#b2ae60', '#c8c278', '#dcd696'], '#1a1a0c', '#34361a');
export const TOLA_DRY = m(['#4a3e22', '#5e4e2c', '#766238', '#8e7846', '#a68e56'], '#221c0e', undefined, { noOutline: true });
export const CACTUS = m(['#262e26', '#323c30', '#3f4a3b', '#4d5947', '#5c6854', '#6d7862', '#808a72', '#959d86'], '#121610', '#262e26');
export const SPINE = m(['#c8b890', '#e4d8b4', '#fff6dc'], '#6a5e40', undefined, { noOutline: true, noAO: true });
export const BLOOM = m(['#a8305a', '#c84470', '#e0608a', '#f082a4', '#fbaac2'], '#4a1428', undefined, { noOutline: true });
export const ICHU = m(['#5a4c22', '#74622c', '#8e7a36', '#a89244', '#c0aa56', '#d6c06c', '#e8d68c', '#f6e8b0'], '#2a220e', undefined, { noOutline: true });
// Flamingos: rose plumage, coral wings with black flight feathers, pale beak with a black tip.
export const PLUME = m(['#b03a52', '#cc4e64', '#e2687a', '#f08890', '#f8a8a8', '#fdc8c0', '#ffe4da'], '#5a1626', '#8a2a3c');
export const WING_ROSE = m(['#a82438', '#c8344a', '#e04a5c', '#f0646e', '#fa8a88'], '#4e1018', '#7a1c2a');
export const QUILL = m(['#0e0c10', '#1a181e', '#28252c', '#38343c'], '#060508', undefined, { noOutline: true });
export const LEG = m(['#9a4a56', '#b85e6a', '#d47a84', '#e8969e'], '#4a1e26', undefined, { noOutline: true });
export const BEAK = m(['#b8a898', '#d6c8b8', '#efe4d6', '#fff8ee'], '#4a4036', undefined, { noOutline: true });
export const BEAK_TIP = m(['#0c0a0c', '#1c1a1e', '#2c2a30'], '#060506', undefined, { noOutline: true });
export const EYE = m(['#0a0a0e', '#1a1a20', '#f0e8c0'], '#050508', undefined, { noOutline: true });
// What moves on the mirror: ripples, the drifting clouds it holds, a falling star.
export const RIPPLE = m(['#9fb6cc', '#c4d4e2', '#e4ecf2', '#ffffff'], '#7f98b0', undefined, { noOutline: true, noAO: true });
export const CLOUD = m(['#b9c0dc', '#c9cce4', '#d8d6ea', '#e6e0ec', '#f2eae8', '#fbf4ea', '#fffbf2'], '#a8b0cc', undefined, { noOutline: true, noAO: true });
export const METEOR = m(['#6a8ad8', '#a8c4ff', '#e0ecff', '#ffffff'], '#3a4a80', undefined, { noOutline: true, noAO: true, emissive: 1 });
