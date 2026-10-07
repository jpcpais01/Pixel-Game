// Hushfall's colours: the ground's kinds (see ../types.ts KindStyle) and the
// materials its props are drawn in. By day the snow is white in the sun with
// lilac and pale blue in every hollow and on every lee; by night it is deep
// blue, the springs glow and the lanterns pool warm on the drifts.

import { hex, type Material, type RGB } from '../../../art/pixel';
import type { KindStyle } from '../types';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** The ground's kinds, by index into HUSH_KINDS. */
export const K = {
  Snow: 0,
  Trod: 1,
  Ice: 2,
  Spring: 3,
  Stone: 4,
  Earth: 5,
  Moss: 6,
  Grass: 7,
  Twig: 8,
} as const;

/** The hot springs' faint glow by night. */
export const SPRING_GLOW: RGB = hex('#4cbcaa');

export const HUSH_KINDS: KindStyle[] = [
  // Powder snow: lilac in the deepest shade, pale blue on the lee slopes, white in the sun.
  {
    day: ramp('#7a7aae', '#8686b8', '#9396c4', '#a2a8d0', '#b2badb', '#c3cce5', '#d3dcee', '#e2e9f5', '#eef3fa', '#f8fafd', '#ffffff'),
    night: ramp('#121836', '#161e42', '#1a244c', '#1f2b56', '#253360', '#2c3c6a', '#344674', '#3d507e', '#475b88', '#526792', '#5f749c'),
    mid: 8,
    relief: 9,
    dither: 0.4,
  },
  // Trodden snow along the old ways: packed, a little greyer, a little bluer.
  {
    day: ramp('#7c7ea8', '#898db4', '#979cc0', '#a6acca', '#b6bcd5', '#c5cbdf', '#d4d9e8', '#e1e5f0'),
    night: ramp('#121733', '#161c3c', '#1a2245', '#1f284e', '#252f58', '#2c3762', '#33406b', '#3b4974'),
    mid: 5,
    relief: 6,
    dither: 0.5,
  },
  // Pond ice: deep blue where it is thick and clear, frosted white at the edge.
  {
    day: ramp('#34507e', '#3e5c8c', '#4a6a9a', '#5879a8', '#6889b5', '#7b9bc2', '#90aecf', '#a6c1da', '#bdd3e5', '#d3e4ef', '#e6f1f8', '#f6fbfd'),
    night: ramp('#081230', '#0a1638', '#0d1b40', '#102148', '#142750', '#182e58', '#1d3560', '#233d68', '#2a4670', '#334f78', '#3d5980', '#486488'),
    mid: 0,
    relief: 1,
  },
  // The hot springs: milky turquoise, deep in the middle.
  {
    day: ramp('#1d5a6a', '#226b7a', '#2a7e8a', '#349199', '#43a3a6', '#58b4b2', '#72c4be', '#90d3ca', '#b2e1d8', '#d4efe8'),
    night: ramp('#06202e', '#082636', '#0b2e3e', '#0e3646', '#123f4e', '#174856', '#1d525e', '#245c66', '#2c676e', '#357276'),
    mid: 0,
    relief: 0,
    glow: SPRING_GLOW,
  },
  // Dark stones ringing the springs, wet and warm.
  {
    day: ramp('#1a1b24', '#23252f', '#2d303b', '#383c48', '#454a57', '#535967', '#636a78', '#757d8b', '#89919e'),
    night: ramp('#07080f', '#0a0c14', '#0e1019', '#12151f', '#171b26', '#1d212d', '#232835', '#2a303d', '#323846'),
    mid: 4,
    relief: 6,
  },
  // Thawed earth round the springs.
  {
    day: ramp('#241c18', '#30251e', '#3c2f25', '#4a3a2c', '#584634', '#67533d'),
    night: ramp('#08090f', '#0b0c14', '#0f1018', '#13141d', '#171922', '#1c1e28'),
    mid: 2,
    relief: 4,
  },
  // Moss, green in the springs' warmth.
  {
    day: ramp('#1e3424', '#27432b', '#325333', '#3e643a', '#4c7542', '#5c874c', '#709a58'),
    night: ramp('#07101a', '#09141e', '#0c1922', '#0f1e27', '#13232c', '#172931', '#1c2f36'),
    mid: 3,
    relief: 4,
  },
  // Dry grass poking up through the snow, gold.
  {
    day: ramp('#5a4628', '#725a32', '#8c703e', '#a6884c', '#bea05e', '#d4b874', '#e6cf92'),
    night: ramp('#13162a', '#181c32', '#1d223a', '#232942', '#29304a', '#303852', '#38405a'),
    mid: 3,
    relief: 2,
  },
  // Fallen twigs and needles under the firs.
  {
    day: ramp('#2a2026', '#3a2c2c', '#4c3a34', '#5e4a3e', '#6f5a4a'),
    night: ramp('#0b0d1c', '#0f1222', '#131728', '#181c2e', '#1d2234'),
    mid: 2,
    relief: 2,
  },
];

// ---------------------------------------------------------------- props' materials

/** Snow on things: a cooler, softer ramp than the ground's, so a cap reads against the drift behind it. */
export const SNOW: Material = { ramp: ramp('#7c7fb2', '#8c92c0', '#9da6cc', '#afbad8', '#c1cce3', '#d2dced', '#e1e9f5', '#edf2fa', '#f7f9fd', '#ffffff'), outline: hex('#5c5e94'), outlineLit: hex('#9da6cc') };
/** Snow with no outline, for caps that melt into what they sit on. */
export const SNOW_SOFT: Material = { ...SNOW, noOutline: true };
/** The snowmen's bodies: packed snow, a touch warmer. */
export const SNOWBALL: Material = { ramp: ramp('#8a88b6', '#9a9ac2', '#abaece', '#bcc2da', '#ccd4e5', '#dbe2ef', '#e8eef7', '#f4f7fc', '#ffffff'), outline: hex('#626294'), outlineLit: hex('#9a9ac2') };
export const NEEDLES: Material = { ramp: ramp('#0e1e22', '#12282a', '#173332', '#1d3f3a', '#244c42', '#2c5a4a', '#376a54', '#457b5e'), outline: hex('#08121a'), outlineLit: hex('#12282a') };
export const NEEDLES_BLUE: Material = { ramp: ramp('#101c2a', '#142434', '#192e3e', '#1f3948', '#264552', '#2f525e', '#3a606a', '#476f76'), outline: hex('#08101a'), outlineLit: hex('#142434') };
export const BARK: Material = { ramp: ramp('#22161a', '#2f1f20', '#3e2a28', '#4e3631', '#5f433a', '#715144'), outline: hex('#140c0e'), outlineLit: hex('#2f1f20') };
export const ROCK: Material = { ramp: ramp('#262634', '#323342', '#3f4152', '#4d5062', '#5c6072', '#6c7183', '#7e8394', '#9196a6'), outline: hex('#14141e'), outlineLit: hex('#323342') };
export const LANTERN_STONE: Material = { ramp: ramp('#3a3a46', '#4a4a56', '#5a5b67', '#6b6c78', '#7d7e89', '#90919b', '#a3a4ad', '#b6b7bf'), outline: hex('#1e1e28'), outlineLit: hex('#4a4a56') };
export const MOSSY_STONE: Material = { ramp: ramp('#2e3a36', '#3a4842', '#47564e', '#55655a', '#647466', '#758473'), outline: hex('#18201e'), noOutline: true };
export const PAPER: Material = { ramp: ramp('#c26a24', '#dc8a34', '#f0aa48', '#fcc86a', '#ffe09a', '#fff2cc'), outline: hex('#4a2410'), emissive: 0.95, noAO: true };
export const FLAME: Material = { ramp: ramp('#ffd27a', '#fff0c0', '#ffffff'), outline: hex('#3a1e08'), emissive: 1, noAO: true, noOutline: true };
export const WINDOW: Material = { ramp: ramp('#b45a1c', '#d47a2a', '#ec9c3c', '#fbbe58', '#ffd886', '#ffefc0'), outline: hex('#2a1408'), emissive: 0.9, noAO: true };
/** The gates: vermilion long faded by the snows. */
export const VERMILION: Material = { ramp: ramp('#4a1418', '#621c1e', '#7c2622', '#963228', '#ae4030', '#c4523a', '#d66a48', '#e4855c'), outline: hex('#260a0c'), outlineLit: hex('#621c1e') };
export const GATE_BLACK: Material = { ramp: ramp('#14141c', '#1c1c26', '#262632', '#30303e', '#3c3c4a'), outline: hex('#0a0a10'), outlineLit: hex('#1c1c26') };
export const LOG: Material = { ramp: ramp('#2a1a14', '#3a241a', '#4c3020', '#5e3e2a', '#714c34', '#855c40', '#986c4c', '#aa7e5a'), outline: hex('#160d0a'), outlineLit: hex('#3a241a') };
export const LOG_END: Material = { ramp: ramp('#6a4a30', '#86603e', '#a07a50', '#b89262', '#ccaa78'), outline: hex('#2e1e12'), outlineLit: hex('#6a4a30') };
export const PLANK: Material = { ramp: ramp('#2c1e18', '#3c2a20', '#4e382a', '#604634', '#72563e'), outline: hex('#160e0a'), outlineLit: hex('#3c2a20') };
export const CHIMNEY: Material = { ramp: ramp('#2c2a32', '#3a3740', '#4a4650', '#5a5660', '#6c6872', '#7e7a84'), outline: hex('#16141a'), outlineLit: hex('#3a3740') };
export const COAL: Material = { ramp: ramp('#0c0c12', '#16161e', '#22222c', '#3a3a48'), outline: hex('#060608'), noOutline: true, shine: true };
export const CARROT: Material = { ramp: ramp('#8a3010', '#b04818', '#d46620', '#ee8a34', '#f8aa52'), outline: hex('#401404'), noOutline: true };
export const TWIG: Material = { ramp: ramp('#24181a', '#34241f', '#463226', '#58402e'), outline: hex('#120c0c'), noOutline: true };
export const SCARF_RED: Material = { ramp: ramp('#5a1420', '#7a1c28', '#9c2832', '#bc3a3e', '#d4524e', '#e8705e'), outline: hex('#2c0810'), outlineLit: hex('#7a1c28') };
export const SCARF_TEAL: Material = { ramp: ramp('#123a44', '#1a4c56', '#22606a', '#2e767e', '#3e8c92', '#54a2a4'), outline: hex('#081e24'), outlineLit: hex('#1a4c56') };
export const SCARF_GOLD: Material = { ramp: ramp('#5a3a10', '#7a5216', '#9c6c1e', '#bc8a2c', '#d4a63e', '#e8c058'), outline: hex('#2c1c06'), outlineLit: hex('#7a5216') };
export const BUCKET: Material = { ramp: ramp('#1e2a3a', '#283648', '#344458', '#425468', '#526478', '#667888'), outline: hex('#0e141c'), shine: true };
export const BERRY: Material = { ramp: ramp('#4a0a14', '#740e1c', '#9e1624', '#c42630', '#e04440', '#f47060'), outline: hex('#24040a'), noOutline: true, shine: true };
export const STALK: Material = { ramp: ramp('#5a4628', '#725a32', '#8c703e', '#a6884c', '#bea05e', '#d4b874', '#e6cf92'), outline: hex('#2a2010'), noOutline: true };
export const BIB: Material = { ramp: ramp('#5a1018', '#7c1820', '#a0222a', '#c03236', '#d84a44'), outline: hex('#2a080c'), outlineLit: hex('#7c1820') };
// The animals.
export const HARE: Material = { ramp: ramp('#8a8cb4', '#9ea2c4', '#b4b9d4', '#c8cee2', '#dce1ee', '#ebeff7', '#f8fafd', '#ffffff'), outline: hex('#5a5c88'), outlineLit: hex('#9ea2c4') };
export const HARE_TIP: Material = { ramp: ramp('#1a1a22', '#262630', '#34343e'), outline: hex('#0c0c10'), noOutline: true };
export const FUR_FOX: Material = { ramp: ramp('#5a2010', '#782c14', '#98401a', '#b45622', '#cc6c2c', '#de843a', '#ec9e50'), outline: hex('#2a0e06'), outlineLit: hex('#782c14') };
export const FUR_WHITE: Material = { ramp: ramp('#9a96ac', '#b0aec0', '#c6c4d2', '#dad8e2', '#ebeaf0', '#f8f7fa'), outline: hex('#5a5668'), outlineLit: hex('#b0aec0') };
export const FUR_DARK: Material = { ramp: ramp('#16100e', '#221814', '#30221c', '#3e2c24'), outline: hex('#0a0606'), noOutline: true };
export const EYE: Material = { ramp: ramp('#0a0a0e', '#1a1a20', '#f0f0f0'), outline: hex('#050508'), noOutline: true };
// Things only the life layer uses.
export const PRINT: Material = { ramp: ramp('#6c70a6', '#7f86b6', '#949cc4', '#aab3d2', '#c0c9e0', '#d6deee', '#eef2fa'), outline: hex('#6c70a6'), noOutline: true, noAO: true };
export const FLAKE: Material = { ramp: ramp('#dfe6f4', '#eef3fa', '#ffffff'), outline: hex('#c8d2ea'), noOutline: true, noAO: true };
export const STEAM: Material = { ramp: ramp('#c8d2e2', '#dde4ef', '#eef2f8', '#ffffff'), outline: hex('#b0bcd0'), noOutline: true, noAO: true };
