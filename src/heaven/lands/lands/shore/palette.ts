// Glowtide Shore's colours: the ground's kinds (see ../types.ts KindStyle)
// and the materials its props are drawn in. The day is the low gold sun of a
// long evening: warm sand, turquoise shallows; the night is deep blue, with
// the plankton's glow where water meets sand.

import { hex, type Material, type RGB } from '../../../art/pixel';
import type { KindStyle } from '../types';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** The ground's kinds, by index into SHORE_KINDS. */
export const S = {
  Sand: 0,
  Wet: 1,
  Sea: 2,
  Grass: 3,
  Scrub: 4,
  Rock: 5,
  Pool: 6,
  Plank: 7,
  Post: 8,
  Shell: 9,
  Star: 10,
  Kelp: 11,
} as const;

/** The plankton's light. */
export const PLANKTON: RGB = hex('#38d6ff');

export const SHORE_KINDS: KindStyle[] = [
  // Sand, warm in the low sun.
  {
    day: ramp('#8e6640', '#a7794c', '#bd8d5a', '#cfa068', '#ddb279', '#e8c38c', '#f1d4a2', '#f8e4bd'),
    night: ramp('#1c2236', '#232a40', '#2a334a', '#323c54', '#3a465e', '#445168', '#4f5d72', '#5c6a7e'),
    mid: 4,
    relief: 6,
    dither: 0.5,
  },
  // Wet sand.
  {
    day: ramp('#6a4a32', '#7c5839', '#8e6743', '#a0774f', '#b2895e', '#c6a07a'),
    night: ramp('#141a2c', '#192034', '#1e273c', '#242f46', '#2c3a52', '#3a4c66'),
    mid: 2,
    relief: 3,
    glow: PLANKTON,
  },
  // The sea, deep to shallow: its tone is its depth band.
  {
    day: ramp('#1b3f5f', '#1d4d6d', '#205d7a', '#246e86', '#2a8191', '#32949b', '#3fa8a4', '#56bcac', '#74cdb4', '#98dbbe', '#bfe8c8', '#e2f3d6', '#fff6dc', '#fffbea'),
    night: ramp('#050b1c', '#071026', '#09162e', '#0b1d37', '#0d2440', '#102c4a', '#133554', '#173f5e', '#1c4a68', '#235672', '#2c647c', '#387487', '#4a8592', '#5e979e'),
    mid: 0,
    relief: 0,
    glow: PLANKTON,
  },
  // Dune grass, olive going gold at the tips.
  {
    day: ramp('#4a5426', '#5f6a2c', '#767f33', '#8e933d', '#a8a74c', '#c2bb62', '#d8cd80'),
    night: ramp('#121a1e', '#162024', '#1b282a', '#203030', '#273836', '#2f413c', '#384a44'),
    mid: 3,
    relief: 2,
  },
  // The sea-grape thicket's leaves.
  {
    day: ramp('#13241a', '#1a3220', '#224228', '#2c552f', '#386a36', '#477f3d', '#5a9445', '#74aa4f', '#93c05e'),
    night: ramp('#060c14', '#08111a', '#0b1720', '#0f1d26', '#13242c', '#182b33', '#1e333a', '#263c42', '#2f464a'),
    mid: 4,
    relief: 6,
  },
  // Smooth stones, warm grey.
  {
    day: ramp('#3b342e', '#4e463e', '#635a50', '#7a7064', '#91877a', '#a89e8f', '#bfb6a6', '#d6cebe'),
    night: ramp('#0e121c', '#131824', '#191f2c', '#202734', '#28303e', '#313a48', '#3b4552', '#47515e'),
    mid: 4,
    relief: 6,
  },
  // Lagoon and tide-pool water, deep to the pale edge.
  {
    day: ramp('#1b5e70', '#227280', '#2a868f', '#36999b', '#4aaca5', '#66bfae', '#8ad0b8', '#b2e0c4'),
    night: ramp('#061226', '#08182f', '#0b2038', '#0f2942', '#14334c', '#1a3e56', '#224a60', '#2c566a'),
    mid: 0,
    relief: 0,
    glow: PLANKTON,
  },
  // Pier planks, sun-bleached.
  {
    day: ramp('#4e3424', '#62432e', '#775438', '#8c6644', '#a17a52', '#b58e63', '#c8a376'),
    night: ramp('#12121c', '#171822', '#1d1f2a', '#242632', '#2c2f3a', '#353844', '#3f434e'),
    mid: 3,
    relief: 4,
  },
  // Beams, gaps and posts.
  {
    day: ramp('#1e140e', '#2c1e15', '#3c2a1d', '#4e3826', '#614730'),
    night: ramp('#06070c', '#090b12', '#0d1018', '#12151e', '#171b25'),
    mid: 2,
    relief: 3,
  },
  // Shells, pearly pink.
  {
    day: ramp('#b48272', '#cc9c8a', '#e2b8a6', '#f2d2c2', '#fbe8dc', '#fff6ee'),
    night: ramp('#2a3044', '#343c52', '#3f4860', '#4b556c', '#586278', '#667086'),
    mid: 3,
    relief: 3,
  },
  // Starfish, coral.
  {
    day: ramp('#7c2a1e', '#a03c26', '#c45432', '#e0703e', '#f29254', '#fbb474'),
    night: ramp('#1e1a2a', '#272234', '#302a3e', '#3a3248', '#443b52', '#4e445c'),
    mid: 3,
    relief: 3,
  },
  // Wrack, the weed the tide left.
  {
    day: ramp('#2a2814', '#38361a', '#484520', '#5a5628', '#6e6832'),
    night: ramp('#0a0e14', '#0d1218', '#11161c', '#151b22', '#1a2028'),
    mid: 2,
    relief: 3,
  },
];

// ---------------------------------------------------------------- props' materials

export const TRUNK: Material = { ramp: ramp('#33241a', '#4a3524', '#62482f', '#7b5c3c', '#96744c', '#b08c5e', '#c8a574'), outline: hex('#1a110b'), outlineLit: hex('#33241a') };
export const TRUNK_RING: Material = { ramp: ramp('#241810', '#33241a', '#4a3524', '#62482f', '#7b5c3c'), outline: hex('#1a110b'), noOutline: true };
export const FROND: Material = { ramp: ramp('#11281a', '#183a20', '#214e27', '#2c632d', '#397934', '#4b8e3a', '#62a442', '#80ba4c', '#a3cf5c', '#c8e07a'), outline: hex('#0a1a10'), outlineLit: hex('#183a20') };
export const FROND_DRY: Material = { ramp: ramp('#3a2c16', '#54401e', '#6e5628', '#8a6e34', '#a88a44', '#c6a85a'), outline: hex('#1c140a'), noOutline: true };
export const COCONUT: Material = { ramp: ramp('#22180e', '#352516', '#4b3520', '#62472c', '#7c5d3a'), outline: hex('#140d07') };
export const LEAF: Material = { ramp: ramp('#122416', '#1a321c', '#234424', '#2e582c', '#3b6e34', '#4b843c', '#5f9a45', '#79b050', '#9ac462'), outline: hex('#0a160c'), outlineLit: hex('#1a321c') };
export const LEAF_RED: Material = { ramp: ramp('#3a1410', '#561e16', '#74301e', '#924428', '#ae5c34', '#c87a44'), outline: hex('#1e0a08'), outlineLit: hex('#3a1410') };
export const GRAPE: Material = { ramp: ramp('#2a1430', '#3e1e46', '#56305e', '#704878', '#8c6894', '#b090b4'), outline: hex('#140a18'), noOutline: true, shine: true };
export const BRANCH: Material = { ramp: ramp('#2a1c14', '#3c2a1e', '#523a28', '#6a4c34'), outline: hex('#140d09') };
export const DUNE_GRASS: Material = { ramp: ramp('#3e4820', '#525e26', '#68742c', '#808a34', '#9aa040', '#b4b452', '#ccc86a', '#e2da8c'), outline: hex('#1e240e'), noOutline: true };
export const STONE: Material = { ramp: ramp('#2e2924', '#3f3832', '#524a42', '#675d53', '#7d7366', '#948a7c', '#aba293', '#c3baaa', '#dad2c2'), outline: hex('#18140f'), outlineLit: hex('#2e2924') };
export const STONE_PALE: Material = { ramp: ramp('#4a4238', '#5f5649', '#766c5d', '#8d8372', '#a49a88', '#bab19e', '#d0c8b6', '#e4ddcc', '#f2ecdd'), outline: hex('#221d16'), outlineLit: hex('#4a4238') };
export const STONE_BLUE: Material = { ramp: ramp('#232a30', '#303942', '#3f4a54', '#505c66', '#636f78', '#78848c', '#8e99a0', '#a6b0b4'), outline: hex('#11151a'), outlineLit: hex('#232a30') };
export const DRIFT: Material = { ramp: ramp('#3c342e', '#514840', '#685e54', '#80766a', '#988e80', '#b0a696', '#c6bdac', '#dad3c2', '#ebe5d6'), outline: hex('#1e1915'), outlineLit: hex('#3c342e') };
export const POST: Material = { ramp: ramp('#24170f', '#352318', '#4a3322', '#60442e', '#775639', '#8e6a46'), outline: hex('#120b07'), outlineLit: hex('#24170f') };
export const IRON: Material = { ramp: ramp('#14141a', '#1e1e26', '#2a2a34', '#383844', '#4a4a56', '#5e5e6a'), outline: hex('#08080c'), shine: true };
export const GLASS: Material = { ramp: ramp('#b8641e', '#d8862c', '#f0a83e', '#ffc85a', '#ffe08a', '#fff2c0'), outline: hex('#3a1e08'), emissive: 0.95, noAO: true };
export const FLAME: Material = { ramp: ramp('#ffd27a', '#fff0c0', '#ffffff'), outline: hex('#3a1e08'), emissive: 1, noAO: true, noOutline: true };
export const HULL: Material = { ramp: ramp('#122a34', '#183846', '#204858', '#2a5a6a', '#376e7c', '#48828e', '#5e96a0', '#78aab2'), outline: hex('#08141a'), outlineLit: hex('#122a34') };
export const TRIM: Material = { ramp: ramp('#7a7058', '#958a70', '#b0a688', '#c9c0a2', '#ded6bc', '#efe9d4'), outline: hex('#2c281e'), outlineLit: hex('#5a5240') };
export const BOARDS: Material = { ramp: ramp('#3a2416', '#4c301e', '#603e26', '#764e30', '#8c603c', '#a2744a', '#b68858'), outline: hex('#1a0f08'), outlineLit: hex('#3a2416') };
export const ROPE: Material = { ramp: ramp('#5a4428', '#7a5e38', '#9a7a4a', '#b8985e', '#d2b478'), outline: hex('#2a1e10'), noOutline: true };
export const SHELL_CRAB: Material = { ramp: ramp('#4a120c', '#701c10', '#962a16', '#ba3e1e', '#d65a2a', '#ec7c3c', '#f8a25a'), outline: hex('#22080a'), outlineLit: hex('#4a120c') };
export const EYE: Material = { ramp: ramp('#0a0a0e', '#1a1a20', '#f0f0f0'), outline: hex('#050508'), noOutline: true };
export const FEATHER: Material = { ramp: ramp('#6a7078', '#8a9098', '#a8aeb6', '#c4c9ce', '#dcdfe2', '#eef0f2', '#ffffff'), outline: hex('#2a2e34'), outlineLit: hex('#6a7078') };
export const WING: Material = { ramp: ramp('#3e4650', '#525c66', '#68727c', '#7e8892', '#969fa8', '#b0b8c0'), outline: hex('#1c2128'), outlineLit: hex('#3e4650') };
export const WINGTIP: Material = { ramp: ramp('#101216', '#1a1d22', '#262a30', '#343840'), outline: hex('#08090c'), noOutline: true };
export const BEAK: Material = { ramp: ramp('#8a5a10', '#c08a1c', '#e8b42e', '#f8d454'), outline: hex('#3a2406'), noOutline: true };
export const FOAM: Material = { ramp: ramp('#a8d8d4', '#cfeee6', '#eefaf4', '#ffffff'), outline: hex('#7ab8b4'), noOutline: true, noAO: true };
export const FOAM_GLOW: Material = { ramp: ramp('#1878b0', '#2aa8e0', '#5cd8ff', '#b0f0ff'), outline: hex('#0a3050'), noOutline: true, noAO: true, emissive: 1 };
