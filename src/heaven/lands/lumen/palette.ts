// Lumen Meadow's colours: the ground's kinds (see ../types.ts KindStyle) and
// the materials its props are drawn in. By day a warm summer meadow, soft
// green going gold, drifts of lavender, buttercups and white moonpetals; by
// night the grass sinks to deep teal and blue, and everything that glows
// (bluebells, moonpetals, the dandelion clocks, the streams, the moss) lights
// it in blue, teal and violet.

import { hex, type Material, type RGB } from '../../../art/pixel';
import type { KindStyle } from '../types';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** The ground's kinds, by index into LUMEN_KINDS. */
export const K = {
  Grass: 0,
  Gold: 1,
  Lush: 2,
  Path: 3,
  Bank: 4,
  Water: 5,
  Stone: 6,
  Moss: 7,
  Rune: 8,
  Bluebell: 9,
  Moonpetal: 10,
  Lavender: 11,
  Buttercup: 12,
  Campion: 13,
  Clock: 14,
  Speck: 15,
} as const;

/** The light of the streams, the rune ring, and the moss. */
export const WATER_GLOW: RGB = hex('#3ee8d6');
export const RUNE_GLOW: RGB = hex('#a68cff');
export const MOSS_GLOW: RGB = hex('#4cffc4');

export const LUMEN_KINDS: KindStyle[] = [
  // Meadow grass, soft green with warm tips; by night deep teal.
  {
    day: ramp('#24402a', '#2d4f2f', '#386034', '#467238', '#56843c', '#6a9642', '#80a84a', '#9aba56', '#b6ca68', '#d2da84', '#e8e6a6'),
    night: ramp('#07101d', '#091422', '#0c1a29', '#0f2030', '#122737', '#162e3f', '#1a3647', '#1f3f50', '#25495a', '#2c5464', '#355f6e'),
    mid: 5,
    relief: 3.5,
    dither: 0.55,
  },
  // Sun-gold grass, where the meadow has gone to seed.
  {
    day: ramp('#5a4624', '#6e5629', '#86692f', '#9d7d37', '#b29142', '#c4a450', '#d3b662', '#e0c77a', '#ead696', '#f4e4b6'),
    night: ramp('#0c1122', '#101628', '#141c2e', '#182234', '#1d283b', '#222f43', '#28364b', '#2f3e53', '#37475c', '#405065'),
    mid: 5,
    relief: 3.5,
    dither: 0.55,
  },
  // Lush clover by the water, deeper and cooler.
  {
    day: ramp('#163024', '#1c3a28', '#23462e', '#2c5434', '#36623a', '#427242', '#50824a', '#609254', '#74a460'),
    night: ramp('#050c19', '#07101e', '#091524', '#0c1a2b', '#0f2032', '#12273a', '#162e42', '#1a364a', '#1f3f53'),
    mid: 4,
    relief: 3,
    dither: 0.5,
  },
  // A footpath worn into the grass, pale and soft.
  {
    day: ramp('#5e5238', '#706246', '#847454', '#988762', '#aa9a72', '#bcac84', '#ccbd98', '#dacdac'),
    night: ramp('#121828', '#161d2e', '#1b2335', '#212a3c', '#283244', '#2f3a4c', '#374355', '#404c5e'),
    mid: 4,
    relief: 3,
    dither: 0.5,
  },
  // Damp earth and moss along a stream's edge.
  {
    day: ramp('#1e2618', '#283020', '#323a26', '#3e462c', '#4a5234', '#585e3e'),
    night: ramp('#050914', '#070c19', '#0a101e', '#0d1424', '#11192a', '#151e30'),
    mid: 3,
    relief: 2.5,
    glow: WATER_GLOW,
  },
  // Stream water, deep to its pale edge: its tone is its depth.
  {
    day: ramp('#1c4658', '#205466', '#266474', '#2e7482', '#38868e', '#46989a', '#5aaaa4', '#74bcae', '#94ccba', '#bcdec8', '#e2f0dc'),
    night: ramp('#03122a', '#051831', '#071e39', '#0a2642', '#0d2f4c', '#113a56', '#164660', '#1d526a', '#265f74', '#326d7e', '#447e88'),
    mid: 0,
    relief: 0,
    glow: WATER_GLOW,
  },
  // Stones: stepping stones, flagstones, pebbles.
  {
    day: ramp('#34343c', '#45444c', '#57565e', '#6a6870', '#7e7b82', '#938f94', '#a8a4a6', '#bebab8', '#d4d0cc'),
    night: ramp('#0b0f1e', '#101526', '#161c2e', '#1c2337', '#232b40', '#2a3349', '#323c52', '#3b465c', '#455066'),
    mid: 4,
    relief: 5,
    glow: RUNE_GLOW,
  },
  // Short moss inside the stone circle, freckled with glowing specks by night.
  {
    day: ramp('#223a22', '#2a4828', '#33562e', '#3e6434', '#4a723a', '#588242', '#68924c'),
    night: ramp('#061016', '#08151c', '#0b1b22', '#0e2229', '#122a31', '#163239', '#1b3b42'),
    mid: 3,
    relief: 3,
    glow: MOSS_GLOW,
  },
  // The rune ring set in the ground: pale stone that glows violet.
  {
    day: ramp('#6a7484', '#808a9a', '#98a2b0', '#b2bac6', '#ccd2dc', '#e4e8ee'),
    night: ramp('#2a2a5a', '#34346c', '#40407e', '#4e4e92', '#5e5ea6', '#7070ba'),
    mid: 3,
    relief: 2,
    glow: RUNE_GLOW,
  },
  // Bluebells.
  {
    day: ramp('#28286a', '#363a88', '#474ea6', '#5c66c2', '#7a86da', '#a0aeee', '#c6d0fa'),
    night: ramp('#121a46', '#1a265c', '#243474', '#30448c', '#3e56a4', '#5068bc', '#667ed2'),
    mid: 3,
    relief: 2,
    glow: hex('#5c88ff'),
  },
  // Moonpetals: white stars, glowing pale cyan by night.
  {
    day: ramp('#8c8e9e', '#a8aab8', '#c4c6d2', '#dcdee6', '#f0f0f4', '#ffffff'),
    night: ramp('#2a3a54', '#344868', '#40587c', '#4e6a90', '#5e7ea4', '#7092b6'),
    mid: 3,
    relief: 2,
    glow: hex('#9ce8ff'),
  },
  // Lavender spikes.
  {
    day: ramp('#44286a', '#583482', '#6e449c', '#8658b4', '#a072ca', '#bc90dc', '#d6b2ec'),
    night: ramp('#1e123a', '#28184e', '#342062', '#422a76', '#52368a', '#64449e', '#7856b2'),
    mid: 3,
    relief: 2,
    glow: hex('#a866ff'),
  },
  // Buttercups: the day's gold, dark by night.
  {
    day: ramp('#8a6010', '#ae8018', '#d0a224', '#eac03a', '#f8da5c', '#fff096'),
    night: ramp('#22243a', '#2a2c44', '#33364e', '#3d4058', '#474b62', '#52566c'),
    mid: 3,
    relief: 2,
  },
  // Pink campion.
  {
    day: ramp('#742848', '#94385c', '#b45074', '#ce6c8e', '#e48caa', '#f4b0c6'),
    night: ramp('#26122e', '#32183a', '#3e2048', '#4a2856', '#583264', '#663c72'),
    mid: 3,
    relief: 2,
    glow: hex('#ff70b8'),
  },
  // Dandelion clocks: silver puffs that glow like frost by night.
  {
    day: ramp('#9ea2a0', '#b6bab6', '#cfd2cc', '#e6e8e0', '#f8f8f0', '#ffffff'),
    night: ramp('#34485c', '#40566c', '#4e667c', '#5e788e', '#708aa0', '#849eb2'),
    mid: 3,
    relief: 2,
    glow: hex('#a8f0e0'),
  },
  // Glowmoss specks hiding in the grass.
  {
    day: ramp('#2e4c2c', '#3a5c32', '#4a6e3a', '#5c8244'),
    night: ramp('#0c2a2e', '#11383a', '#184a46', '#205e54'),
    mid: 2,
    relief: 1,
    glow: MOSS_GLOW,
  },
];

// ---------------------------------------------------------------- props' materials

const m = (r: RGB[], outline: string, more: Partial<Material> = {}): Material => ({ ramp: r, outline: hex(outline), ...more });

export const GRASS_TALL = m(ramp('#1c3822', '#244628', '#2e562e', '#3a6834', '#4a7a38', '#5e8c3e', '#74a046', '#8eb452', '#aac664', '#c6d67c', '#e0e49c'), '#102214', { noOutline: true });
export const GRASS_GOLD = m(ramp('#4a4020', '#5e5226', '#74662c', '#8a7a34', '#a0903e', '#b6a64c', '#c8b85e', '#d8ca76', '#e8dc96'), '#262010', { noOutline: true });
export const SEED_HEAD = m(ramp('#857c58', '#a29870', '#beb488', '#d6cea2', '#eae4c0', '#f8f6e2'), '#3a3424', { noOutline: true });
export const STEM = m(ramp('#18301c', '#203e24', '#2a4e2c', '#365e34', '#446e3c'), '#0c1a0e', { noOutline: true });

export const BELL = m(ramp('#262874', '#33398e', '#434eaa', '#5866c4', '#7484dc', '#96a8ee', '#bccaf8'), '#141640', { noOutline: true, emissive: 0.55 });
export const PETAL_MOON = m(ramp('#8e92a6', '#aab0c2', '#c6ccda', '#dee4ee', '#f2f6fa', '#ffffff'), '#4a5266', { noOutline: true, emissive: 0.5 });
export const PETAL_CORE = m(ramp('#a8d8c8', '#c8f0dc', '#e8fff0', '#ffffff'), '#4a6a60', { noOutline: true, emissive: 1, noAO: true });
export const LAVENDER = m(ramp('#40246a', '#543082', '#6a409c', '#8254b4', '#9c6eca', '#b88cdc', '#d2aeec'), '#20123a', { noOutline: true, emissive: 0.45 });
export const LUPINE = m(ramp('#2e2462', '#3c2e7e', '#4c3c9a', '#604eb4', '#7866cc', '#9684e0', '#b8a8f0'), '#18123a', { noOutline: true, emissive: 0.45 });
export const PUFF = m(ramp('#98a6b0', '#b4c2ca', '#cedce2', '#e6f2f4', '#f6fcfc', '#ffffff'), '#4a5660', { noOutline: true, emissive: 0.75, noAO: true });
export const BUTTER = m(ramp('#8a6010', '#b08218', '#d4a626', '#ecc43e', '#f8dc62', '#fff09c'), '#3a2808', { noOutline: true });
export const CAMPION = m(ramp('#702644', '#903658', '#b04e70', '#cc6a8c', '#e28aa8', '#f2b0c6'), '#381222', { noOutline: true, emissive: 0.15 });
export const DAISY = m(ramp('#a8a49c', '#c4c0b8', '#dcd8d0', '#efece6', '#ffffff'), '#4a4840', { noOutline: true });
export const DAISY_EYE = m(ramp('#a07010', '#d0a024', '#f0c84a', '#ffe680'), '#3a2808', { noOutline: true });

export const REED = m(ramp('#1c3424', '#26442c', '#305436', '#3c6640', '#4a784a', '#5c8a56'), '#0e1a12', { noOutline: true });
export const REED_TIP = m(ramp('#1a6a6a', '#249090', '#38b4b0', '#5cd6cc', '#96eee2', '#d6fff6'), '#0c3434', { noOutline: true, emissive: 0.9, noAO: true });

export const CAP_VIOLET = m(ramp('#24183e', '#302052', '#3c2a66', '#4a367c', '#5a4492', '#6c56a6', '#8068b8', '#9880c8', '#b29cd8'), '#120a20', { outlineLit: hex('#24183e') });
export const CAP_TEAL = m(ramp('#0e2a34', '#123844', '#184854', '#1e5a64', '#266c74', '#328084', '#429494', '#58a8a4', '#74bcb4'), '#06141a', { outlineLit: hex('#0e2a34') });
export const CAP_ROSE = m(ramp('#3a1a34', '#4c2244', '#602c54', '#743866', '#884678', '#9c588a', '#b06e9c', '#c488b0'), '#1c0a1a', { outlineLit: hex('#3a1a34') });
export const SPOT = m(ramp('#3eaed0', '#5ccbe8', '#8ce2f6', '#c0f2ff'), '#1a4a5a', { noOutline: true, emissive: 1, noAO: true });
export const SPOT_PINK = m(ramp('#c0509e', '#dc74bc', '#f09ad6', '#ffc8ec'), '#5a1a4a', { noOutline: true, emissive: 1, noAO: true });
export const GILL = m(ramp('#12485a', '#1a6274', '#247e8e', '#329ca8', '#46b8c0', '#66d2d6', '#9aeae8'), '#082430', { noOutline: true, emissive: 0.75 });
export const STALK = m(ramp('#544c62', '#6a6278', '#827a90', '#9c94a8', '#b6b0c0', '#cecad6', '#e6e2ec', '#f6f4f8'), '#26202e', { outlineLit: hex('#544c62') });
export const MOSS = m(ramp('#1a3420', '#24442a', '#2e5432', '#3a663a', '#487842', '#588a4c', '#6c9e58', '#84b266'), '#0c1a10', { outlineLit: hex('#1a3420') });

export const BOULDER = m(ramp('#2a2832', '#373540', '#46444e', '#57545e', '#6a6670', '#7e7a82', '#949096', '#aba7aa', '#c2bebe'), '#141218', { outlineLit: hex('#2a2832') });
export const CRYSTAL_TEAL = m(ramp('#155a68', '#1e7a88', '#2c9ea8', '#46bec4', '#72dcdc', '#aaf2ee', '#e6fffc'), '#08303a', { emissive: 0.85, shine: true });
export const CRYSTAL_VIOLET = m(ramp('#3e2478', '#52309a', '#6a44b8', '#8660d2', '#a682e6', '#c8acf4', '#eee4ff'), '#1c0e3c', { emissive: 0.85, shine: true });
export const VEIN = m(ramp('#40d0d0', '#7aeee6', '#c4fff8'), '#103a3a', { noOutline: true, emissive: 1, noAO: true });
export const VEIN_VIOLET = m(ramp('#9a7cff', '#c0acff', '#ece4ff'), '#2a1a5a', { noOutline: true, emissive: 1, noAO: true });
export const LICHEN = m(ramp('#4a5634', '#5e6c40', '#76844e', '#909c60', '#aab476'), '#262c1a', { noOutline: true });

export const BARK = m(ramp('#241c22', '#32262c', '#423236', '#523f42', '#644e4e', '#785e5a', '#8c7068'), '#120c10', { outlineLit: hex('#241c22') });
export const WILLOW = m(ramp('#173328', '#1e4030', '#264e38', '#305e42', '#3c6e4c', '#4a7e56', '#5a8e62', '#6ea070', '#86b282', '#a2c49a', '#c0d8b4'), '#0a1a12', { noOutline: true });
export const LANTERN = m(ramp('#b8561a', '#d87a26', '#f0a036', '#ffc458', '#ffe08c', '#fff4cc'), '#4a2008', { emissive: 1, noAO: true });
export const THREAD = m(ramp('#2a3a2c', '#3a4c3a', '#4c5e48'), '#141c14', { noOutline: true });

export const MEGALITH = m(ramp('#282c38', '#353a48', '#444a58', '#545a6a', '#666c7c', '#7a808e', '#9096a2', '#a8aeb8', '#c0c4cc'), '#12141c', { outlineLit: hex('#282c38') });
export const RUNE = m(ramp('#6a4cf0', '#8c74ff', '#b4a2ff', '#e2daff'), '#22164a', { noOutline: true, emissive: 1, noAO: true });

export const WOOD = m(ramp('#34221a', '#452e22', '#583c2c', '#6c4c38', '#805e46', '#947056', '#a88468', '#bc987c'), '#1a100a', { outlineLit: hex('#34221a') });
export const WOOD_DARK = m(ramp('#1e140e', '#2a1c14', '#38261c', '#483226', '#583e30'), '#0e0906', { outlineLit: hex('#1e140e') });
export const SHINGLE = m(ramp('#1e3028', '#283c30', '#324a3a', '#3e5a44', '#4c6a50', '#5c7c5c', '#6e8e6a'), '#0e1812', { outlineLit: hex('#1e3028') });
export const SHRINE_STONE = m(ramp('#3a3a42', '#4a4a54', '#5c5c66', '#706e78', '#86828c', '#9c98a0', '#b4b0b4', '#cac6c6'), '#1a1a20', { outlineLit: hex('#3a3a42') });
export const ORB = m(ramp('#e8a040', '#ffc866', '#ffe29a', '#fff4d4', '#ffffff'), '#5a3410', { emissive: 1, noAO: true, noOutline: true });

export const FUR = m(ramp('#4a3c34', '#5e4e44', '#766456', '#8e7a6a', '#a8947e', '#c0ae98', '#d8cab6'), '#22180f', { outlineLit: hex('#4a3c34') });
export const FUR_WHITE = m(ramp('#a8a6a0', '#c4c2bc', '#dcdad4', '#f0eee8', '#ffffff'), '#4a4840', { noOutline: true });
export const EYE = m(ramp('#0a0a0e', '#1a1a22', '#f0f0f0'), '#050508', { noOutline: true });
export const NOSE = m(ramp('#a05a6a', '#d08494', '#f0b0bc'), '#3a1a20', { noOutline: true });

export const WING_SKY = m(ramp('#18306e', '#22449a', '#2e5cc4', '#4a80e4', '#7aaaf4', '#b4d2fc'), '#0a1430', { noOutline: true });
export const WING_SUN = m(ramp('#8a5a0e', '#b07a14', '#d8a020', '#f2c63c', '#fde272', '#fff4b4'), '#3a2406', { noOutline: true });
export const WING_ROSE = m(ramp('#6e2048', '#983266', '#c04c86', '#e070a6', '#f69ac4', '#ffc8e0'), '#300c20', { noOutline: true });
export const WING_TEAL = m(ramp('#147a7a', '#22a4a0', '#3ccac0', '#6ae6d8', '#a8f8ec', '#e4fffa'), '#063232', { noOutline: true, emissive: 1, noAO: true });
export const WING_VIOLET = m(ramp('#5a36b8', '#7652d6', '#9474ec', '#b49cf8', '#d4c4ff', '#f2ecff'), '#1e1250', { noOutline: true, emissive: 1, noAO: true });
export const WING_MOTH = m(ramp('#5e5852', '#7a746a', '#968e84', '#b2aa9e', '#ccc6ba', '#e6e2d6'), '#2a2622', { noOutline: true });
export const BODY = m(ramp('#14121a', '#221e28', '#322c38', '#443c48'), '#08060a', { noOutline: true });
