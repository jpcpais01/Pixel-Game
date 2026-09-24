import { hex, type Material, type RGB } from './pixel';

// Hand-tuned ramps: shadows lean cool and violet, highlights lean warm.
const ramp = (...c: string[]): RGB[] => c.map(hex);

const INK = hex('#120e1f');
const INK_LIT = hex('#2a2250');

export const ROBE: Material = {
  ramp: ramp('#171236', '#251f5c', '#342f8e', '#4747b8', '#6468d8'),
  outline: INK,
  outlineLit: INK_LIT,
};

export const ROBE_INNER: Material = {
  ramp: ramp('#150f33', '#211a52', '#2f2877', '#3d3895'),
  outline: INK,
};

export const GOLD: Material = {
  ramp: ramp('#5b2f1d', '#9a5a26', '#d69a3a', '#f4cf6a', '#fff4bf'),
  outline: hex('#2a140f'),
  shine: true,
};

export const LEATHER: Material = {
  ramp: ramp('#26140f', '#45261a', '#6a3d26', '#8f5a36'),
  outline: INK,
};

export const SKIN: Material = {
  ramp: ramp('#6b3a3a', '#a85f50', '#e09a78', '#f7c9a3'),
  outline: hex('#2a1418'),
  outlineLit: hex('#4a2530'),
};

export const BEARD: Material = {
  ramp: ramp('#5d6180', '#9197b4', '#cdd2e6', '#f4f6ff'),
  outline: hex('#1d1a33'),
  outlineLit: hex('#3a3858'),
};

export const HAIR: Material = {
  ramp: ramp('#4a4c6a', '#767b9c', '#a9aec8', '#d6daea'),
  outline: hex('#1d1a33'),
  outlineLit: hex('#3a3858'),
};

export const WOOD: Material = {
  ramp: ramp('#2c1a16', '#523023', '#7d4f33', '#a9774c'),
  outline: hex('#140c10'),
};

export const BOOT: Material = {
  ramp: ramp('#1a1216', '#33242a', '#4e3a3c', '#6b5452'),
  outline: INK,
};

export const EYE: Material = {
  ramp: ramp('#0c0816', '#0c0816'),
  outline: INK,
  noAO: true,
};

export const CRYSTAL: Material = {
  ramp: ramp('#1b6f9e', '#2fb4e0', '#7ceeff', '#e6ffff'),
  outline: hex('#0b2440'),
  outlineLit: hex('#12406a'),
  emissive: 0.85,
  shine: true,
  noAO: true,
};

// Magic colours (light-only pixels, drawn additively).
export const MAGIC_CORE = hex('#f2ffff');
export const MAGIC_HOT = hex('#9ff6ff');
export const MAGIC_MID = hex('#39c6f0');
export const MAGIC_DEEP = hex('#3a5ce0');
export const MAGIC_VIOLET = hex('#8a55f0');
