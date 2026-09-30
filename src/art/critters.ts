// The critters: small creatures that live in the arenas, to be caught with a
// net and kept in jars. Each is drawn with the lit pixel engine in four
// looping frames facing right (the world mirrors them to face left): wings
// beat, throats puff, candles flicker, stars twinkle on a shell. Frames are
// `<id>_<f>` on one sheet. Every critter also comes in a glass jar
// (`<id>_<f>` on the jar sheet), glowing like a lantern when its critter
// glows, for the Inventory's Critters page and for shelves in a Home.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const CRITTER_W = 16;
export const CRITTER_H = 16;
/** Where it stands in the frame (a flyer's body sits higher; the world lifts it off the ground as well). */
export const CRITTER_OX = 8;
export const CRITTER_OY = 14;
export const CRITTER_FRAMES = 4;

const EYE: Material = { ramp: ramp('#07060c', '#16131f'), outline: hex('#030306'), noAO: true };
const GLINT: Material = { ramp: ramp('#d8dcef', '#ffffff'), outline: hex('#2a2a3a'), noAO: true, noOutline: true };
const FACE = { x: 0, y: 0, z: 1 };

/** A beady eye with a glint on top (or shut, as a line, on a blink). */
function eye(c: PixelCanvas, x: number, y: number, blink = false): void {
  c.part();
  if (blink) {
    c.px(x, y + 1, EYE, { x: 0, y: -0.2, z: 1 });
    return;
  }
  c.px(x, y, EYE, FACE);
  c.px(x, y + 1, EYE, FACE);
  c.px(x, y, GLINT, { x: 0, y: 0.3, z: 1 });
}

/** A beetle's six legs: three dark strokes a side, stepping in turn. */
function legs(c: PixelCanvas, xs: number[], top: number, foot: number, m: Material, f: number): void {
  xs.forEach((x, i) => {
    const swing = (i + f) % 2 === 0 ? 0.8 : -0.8;
    c.line(x, top, x + swing + (i - 1) * 0.6, foot, m, () => cyl(0, -0.3));
  });
}

/**
 * A flyer seen from above: the far pair of wings spread above its body, the
 * near pair below, `open` 1 fully spread and near 0 folded up edge-on. The
 * forewing is `fore` long (rx) and `span` tall at full spread; the hindwing
 * sits behind it. `after` draws on each wing once it is down (spots, eyes).
 */
function flutter(
  c: PixelCanvas,
  cx: number,
  cy: number,
  open: number,
  fore: number,
  span: number,
  m: Material,
  hind: Material,
  near: boolean,
  after?: (wx: number, wy: number, side: number) => void,
): void {
  const side = near ? 1 : -1;
  const b = near ? 0 : -1;
  const h = 0.6 + span * open;
  // Hindwing first, tucked behind and a little lower.
  c.part();
  c.ellipse(cx - fore * 0.7, cy + side * (0.4 + h * 0.45), fore * 0.62, Math.max(0.7, h * 0.62), hind, { bias: b - 1, normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6 + side * 0.25 * open, 1) });
  c.part();
  const wy = cy + side * (0.5 + h * 0.62);
  c.ellipse(cx + 0.3, wy, fore, Math.max(0.7, h * 0.75), m, { bias: b, normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6 + side * 0.25 * open, 1) });
  if (after) {
    c.part();
    after(cx + 0.3, wy, side);
  }
}

// ---------------------------------------------------------------- Firefly (the clearing, by night)

const FLY_BODY: Material = { ramp: ramp('#1a1210', '#33241a', '#56402a', '#7c5e3a'), outline: hex('#0a0604') };
const FLY_HOOD: Material = { ramp: ramp('#7a2a14', '#b8481e', '#e87a3a'), outline: hex('#2a0c04') };
const LUMEN: Material = { ramp: ramp('#8ac81a', '#d8ff5a', '#f8ffc0'), outline: hex('#3a5a08'), emissive: 1, noAO: true };
const GAUZE: Material = { ramp: ramp('#5a6a7a', '#9aaec0', '#d8e8f4'), outline: hex('#2a3440'), emissive: 0.08, shine: true };

function firefly(c: PixelCanvas, f: number): void {
  const bob = [0, -0.5, 0, 0.5][f];
  const cy = 8 + bob;
  const open = [1, 0.55, 0.15, 0.55][f];
  flutter(c, 8.5, cy, open, 2.2, 2.2, GAUZE, GAUZE, false);
  // The glowing tail, pulsing brighter and dimmer as it signals.
  const pulse = [1, 0.85, 0.6, 0.85][f];
  c.part();
  c.ellipse(4.5, cy, 2.8, 2.1, LUMEN, { glow: pulse, normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8, 1) });
  c.part();
  c.ellipse(8, cy, 2.1, 1.8, FLY_BODY);
  c.part();
  c.ellipse(10.6, cy - 0.3, 1.7, 1.6, FLY_HOOD);
  c.part();
  c.px(12, cy, FLY_BODY, sphere(0.6, 0));
  eye(c, 11, cy - 1);
  c.part();
  c.line(12, cy - 1.5, 13.5, cy - 3.5, FLY_BODY);
  c.line(12, cy - 1, 14, cy - 2, FLY_BODY);
  flutter(c, 8.5, cy, open, 2.2, 2.2, GAUZE, GAUZE, true);
  // A halo of light round the tail.
  for (const [dx, dy, a] of [[-3, 0, 0.5], [-2, -2, 0.35], [-2, 2, 0.35], [0, 2, 0.3], [-4, 1, 0.25], [-1, -3, 0.2]] as const) c.spark(4.5 + dx, cy + dy, hex('#d8ff5a'), a * pulse);
}

// ---------------------------------------------------------------- Sky Morpho (the clearing, by day)

const MORPHO: Material = { ramp: ramp('#123a8a', '#1e62c8', '#3a9af0', '#8ad8ff', '#e6fbff'), outline: hex('#061430'), outlineLit: hex('#0a1e48'), shine: true, emissive: 0.1 };
const MORPHO_EDGE: Material = { ramp: ramp('#0a0e1c', '#1a1e30'), outline: hex('#04060c') };
const DOT: Material = { ramp: ramp('#d8e4ff', '#ffffff'), outline: hex('#2a3448'), noOutline: true, noAO: true };
const SLENDER: Material = { ramp: ramp('#14121a', '#2e2a38', '#4a4458'), outline: hex('#08070c') };

function butterfly(c: PixelCanvas, f: number): void {
  // Wide open, closing, folded up edge-on, opening: a lazy flap.
  const open = [1, 0.6, 0.12, 0.6][f];
  const cy = 8 + [0.5, 0, -0.5, 0][f];
  // Black tips with white dots, the blue shimmering toward the body.
  const tips = (wx: number, wy: number, side: number) => {
    if (open < 0.3) return;
    const ty = wy + side * open * 2;
    c.px(wx + 2, ty, MORPHO_EDGE, FACE);
    c.px(wx + 1, ty + side, MORPHO_EDGE, FACE);
    c.px(wx + 2, ty - side, MORPHO_EDGE, FACE);
    c.px(wx + 2, ty, DOT, FACE);
  };
  flutter(c, 8, cy, open, 3.2, 4.2, MORPHO, MORPHO, false, tips);
  c.part();
  c.capsule(4.5, cy, 10, cy, 0.8, 1, SLENDER);
  c.part();
  c.ellipse(10.8, cy, 1.3, 1.2, SLENDER);
  c.px(11.5, cy - 0.5, GLINT, FACE);
  c.part();
  c.line(11.5, cy - 1, 13.5, cy - 3, SLENDER);
  c.line(11.5, cy + 1, 13.5, cy + 2, SLENDER);
  flutter(c, 8, cy, open, 3.2, 4.2, MORPHO, MORPHO, true, tips);
  // Scales catching the sun: a glint that travels along the wing.
  if (open > 0.3) c.spark(7 + f * 0.5, cy - open * 3, hex('#bff0ff'), 0.5);
}

// ---------------------------------------------------------------- Ladybird (the clearing, by day)

const LADY: Material = { ramp: ramp('#5a0a0a', '#a0161a', '#e0302a', '#ff7058', '#ffd0c0'), outline: hex('#200404'), outlineLit: hex('#3a0806'), shine: true };
const INK: Material = { ramp: ramp('#07060a', '#1a1822', '#2e2a3a'), outline: hex('#030305') };
const CHEEK: Material = { ramp: ramp('#c8c4c0', '#ffffff'), outline: hex('#2a2a2a'), noOutline: true };

function ladybug(c: PixelCanvas, f: number): void {
  const step = f % 2;
  const cy = 11;
  c.part();
  legs(c, [6, 8, 10], cy + 1.5, 14, INK, step);
  c.part();
  c.ellipse(7.5, cy, 4.2, 3.2, LADY, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 1) });
  // The seam down its back and its spots.
  c.part();
  for (let y = cy - 3; y <= cy + 2; y++) c.px(7.5 + (y - cy) * 0.35, y, INK, cyl(0, 0.4), { bias: 1 });
  c.px(5, cy - 1, INK, sphere(-0.4, 0.3));
  c.px(6, cy + 1, INK, sphere(-0.2, -0.2));
  c.px(9, cy - 2, INK, sphere(0.3, 0.5));
  c.px(10, cy, INK, sphere(0.5, 0));
  c.part();
  c.ellipse(11.8, cy + 0.5, 1.9, 1.7, INK);
  c.px(12, cy - 0.5, CHEEK, FACE);
  c.px(13, cy + 0.5, CHEEK, FACE);
  eye(c, 12.5, cy - 0.5, f === 3);
  c.part();
  c.line(13, cy - 1, 14, cy - 2.5 + step * 0.5, INK);
  c.spark(6, cy - 2, hex('#ffe0d0'), 0.35);
}

// ---------------------------------------------------------------- Luna Moth (the clearing, by night; rare)

const LUNA: Material = { ramp: ramp('#3a6a52', '#6aa888', '#a8e0c0', '#dcfff0', '#ffffff'), outline: hex('#12281c'), outlineLit: hex('#1e3c2c'), emissive: 0.35 };
const LUNA_EYE: Material = { ramp: ramp('#c87a18', '#ffd060', '#fff4c0'), outline: hex('#3a2408'), emissive: 0.9, noAO: true, noOutline: true };
const FUZZ: Material = { ramp: ramp('#8a8878', '#c8c6b4', '#f4f2e0'), outline: hex('#2e2c24') };
const FEATHER: Material = { ramp: ramp('#8a6a30', '#c8a050'), outline: hex('#2a1e08') };

function moonmoth(c: PixelCanvas, f: number): void {
  const open = [1, 0.6, 0.2, 0.6][f];
  const cy = 7.5 + [0.5, 0, -0.5, 0][f];
  const sway = [0, 0.5, 1, 0.5][f];
  // Each hindwing trails a long swallow tail that sways; a golden eye on each forewing.
  const wing = (near: boolean) => {
    const side = near ? 1 : -1;
    c.part();
    c.capsule(5, cy + side * (1 + open * 1.5), 1.5 - sway, cy + side * (1.5 + open * 2.5), 0.9, 0.5, LUNA, { bias: near ? -1 : -2 });
    flutter(c, 8.5, cy, open, 3, 3.6, LUNA, LUNA, near, (wx, wy) => {
      if (open > 0.4) c.px(wx + 0.5, wy, LUNA_EYE, FACE);
    });
  };
  wing(false);
  c.part();
  c.capsule(5.5, cy, 9.5, cy, 1.2, 1.4, FUZZ);
  c.part();
  c.ellipse(10.8, cy, 1.4, 1.3, FUZZ);
  eye(c, 11.5, cy - 1);
  // Feathery antennae.
  c.part();
  c.line(11.5, cy - 1.5, 13, cy - 4, FEATHER);
  c.line(11.5, cy + 1, 13.5, cy + 2.5, FEATHER);
  c.px(13, cy - 3, FEATHER);
  wing(true);
  for (const [x, y, a] of [[8, cy - 3, 0.3], [2, cy + 4, 0.25], [9, cy + 3, 0.2]] as const) c.spark(x, y, hex('#dcfff0'), a);
}

// ---------------------------------------------------------------- Glowfrog (the Sunken Garden)

const FROG: Material = { ramp: ramp('#0e3a3a', '#1a6a60', '#2ea88a', '#6ae0b8', '#c8ffe8'), outline: hex('#061a18'), outlineLit: hex('#0a2826'), shine: true };
const FROG_BELLY: Material = { ramp: ramp('#8ac8a8', '#c8f0d8'), outline: hex('#1a3a2a') };
const SAC: Material = { ramp: ramp('#3ab8e0', '#8af0ff', '#e8ffff'), outline: hex('#0a3040'), emissive: 0.9, noAO: true };
const FROG_EYE: Material = { ramp: ramp('#c8a018', '#ffe060'), outline: hex('#2a2008'), noAO: true };

function glowfrog(c: PixelCanvas, f: number): void {
  // It sits, and its glowing throat swells and falls: croak, croak.
  const puff = [0, 0.6, 1, 0.4][f];
  const cy = 11;
  c.part();
  // Far hind leg, then the body, then the near leg folded at its side.
  c.ellipse(5, cy + 2, 2.2, 1.5, FROG, { bias: -1 });
  c.part();
  c.ellipse(7.5, cy, 4.2, 3.2, FROG, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 1) });
  c.part();
  c.ellipse(8.5, cy + 1.5, 2.8, 1.5, FROG_BELLY);
  c.part();
  c.ellipse(11.5 + puff * 0.3, cy + 1.2, 1.2 + puff * 1.2, 1 + puff * 1.1, SAC, { glow: 0.5 + puff * 0.5, normal: (_x, _y, dx, dy) => sphere(dx, dy, 1) });
  c.part();
  c.ellipse(5.5, cy + 2, 2.4, 1.6, FROG);
  c.px(8, cy + 3, FROG, cyl(0.3, -0.3));
  c.px(12, cy + 3, FROG, cyl(0.3, -0.3));
  // Two big eyes perched on top of its head.
  c.part();
  c.ellipse(10, cy - 3, 1.5, 1.4, FROG, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 1) });
  c.px(10, cy - 3, FROG_EYE, FACE);
  c.px(11, cy - 3, EYE, FACE);
  c.px(10, cy - 4, GLINT, { x: 0, y: 0.3, z: 1 });
  // A few glowing freckles down its back.
  c.part();
  c.px(5, cy - 2, SAC, FACE, { glow: 0.6 });
  c.px(7, cy - 3, SAC, FACE, { glow: 0.5 });
  c.px(4, cy, SAC, FACE, { glow: 0.4 });
  c.spark(12, cy + 1, hex('#8af0ff'), 0.25 + puff * 0.4);
}

// ---------------------------------------------------------------- Jewelwing (the Sunken Garden)

const JEWEL: Material = { ramp: ramp('#0a3a2a', '#0e7a4a', '#1ec87a', '#8affc0'), outline: hex('#041a10'), outlineLit: hex('#082a1a'), shine: true, emissive: 0.1 };
const JEWEL_HEAD: Material = { ramp: ramp('#0a2a4a', '#1a5aa0', '#4aa0f0', '#bfe8ff'), outline: hex('#041020'), shine: true };
const GLASS_WING = hex('#bfeaff');
const WING_GLASS: Material = { ramp: ramp('#3a5a6a', '#6a98a8', '#a8d4e4', '#e8faff'), outline: hex('#24404c'), outlineLit: hex('#2e4e5c'), emissive: 0.1, shine: true, noAO: true };

function dragonfly(c: PixelCanvas, f: number): void {
  const cy = 8 + [0, -0.5, 0, 0.5][f];
  // Four long glassy wings held straight out from its back, the pairs beating out of step.
  const a = [5, 4.2, 3.4, 4.2][f];
  const b = [3.6, 4.2, 5, 4.2][f];
  const pair = (near: boolean) => {
    const s = near ? 1 : -1;
    const bias = near ? 0 : -1;
    c.part();
    c.capsule(8.5, cy, 7.2, cy + s * b, 1.1, 0.8, WING_GLASS, { bias });
    c.part();
    c.capsule(10, cy, 10.8, cy + s * a, 1.2, 0.8, WING_GLASS, { bias });
  };
  pair(false);
  pair(true);
  c.part();
  // A long jewelled tail, banded.
  c.capsule(1, cy, 8, cy, 0.6, 0.9, JEWEL);
  for (let x = 2; x < 8; x += 2) c.shade(x, cy, -1);
  c.part();
  c.ellipse(9.5, cy, 1.9, 1.4, JEWEL);
  c.part();
  c.ellipse(11.8, cy, 1.5, 1.5, JEWEL_HEAD, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 1) });
  c.px(12, cy - 1, GLINT, { x: 0, y: 0.3, z: 1 });
  for (let i = 0; i < 3; i++) c.spark(9 + i, cy + 2 + i * 0.5, GLASS_WING, 0.3);
}

// ---------------------------------------------------------------- Pearl Snail (the Sunken Garden; rare)

const PEARL: Material = { ramp: ramp('#6a5a7a', '#a898b8', '#e0d4ec', '#fff4ff'), outline: hex('#2a2032'), outlineLit: hex('#3a3044'), shine: true, emissive: 0.12 };
const SLUG: Material = { ramp: ramp('#5a7a8a', '#8ab0c0', '#c0e0ec', '#eafcff'), outline: hex('#1a2c34'), shine: true };
const NACRE = [hex('#ffc8f0'), hex('#c8f0ff'), hex('#fff0c0')];

function pearlsnail(c: PixelCanvas, f: number): void {
  // It inches along: the foot stretches, then the shell catches up.
  const stretch = [0, 0.5, 1, 0.5][f];
  const cy = 12;
  c.part();
  c.capsule(3, cy + 1.5, 11 + stretch, cy + 1.5, 1.2, 1.3, SLUG);
  c.part();
  // The head rises at the front, with two stalked eyes.
  c.ellipse(11.5 + stretch, cy, 1.4, 1.8, SLUG);
  c.part();
  c.line(11.5 + stretch, cy - 1.5, 12 + stretch, cy - 4, SLUG);
  c.line(12.5 + stretch, cy - 1, 13.5 + stretch, cy - 3.5, SLUG);
  c.px(12 + stretch, cy - 4.5, EYE, FACE);
  c.px(13.5 + stretch, cy - 4, EYE, FACE);
  // The pearly spiral shell.
  c.part();
  const sx = 6.5 + stretch * 0.3;
  c.ellipse(sx, cy - 2, 3.8, 3.6, PEARL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  c.part();
  for (let i = 0; i < 14; i++) {
    const a = i * 0.55;
    const r = 3 - i * 0.2;
    c.px(sx + Math.cos(a) * r, cy - 2 + Math.sin(a) * r * 0.9, PEARL, sphere(Math.cos(a) * 0.4, -Math.sin(a) * 0.4), { bias: -1 });
  }
  // Nacre shimmering over it, a different hue each frame.
  c.spark(sx - 1.5, cy - 4, NACRE[f % 3], 0.5);
  c.spark(sx + 1, cy - 3, NACRE[(f + 1) % 3], 0.35);
  c.spark(sx - 2, cy - 1, NACRE[(f + 2) % 3], 0.25);
}

// ---------------------------------------------------------------- Star Beetle (the Cosmos Arena)

const NIGHT_SHELL: Material = { ramp: ramp('#070a1e', '#101a40', '#1e2e6a', '#3a52a0', '#8aa0e0'), outline: hex('#02030a'), outlineLit: hex('#060a1a'), shine: true };
const STAR: Material = { ramp: ramp('#c8d8ff', '#ffffff'), outline: hex('#1a2040'), emissive: 1, noAO: true, noOutline: true };

function starbeetle(c: PixelCanvas, f: number): void {
  const step = f % 2;
  const cy = 11;
  c.part();
  legs(c, [6, 8, 10], cy + 1.5, 14, INK, step);
  c.part();
  c.ellipse(7.5, cy - 0.5, 4.5, 3.4, NIGHT_SHELL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 1) });
  c.part();
  c.ellipse(12, cy + 0.5, 1.8, 1.6, INK);
  eye(c, 12.5, cy, f === 2);
  c.part();
  c.line(13, cy - 0.5, 14.5, cy - 2, INK);
  // Its shell is a little sky: stars that twinkle in turn.
  const stars: [number, number][] = [[5, cy - 2], [7, cy - 3], [9, cy - 1], [6, cy], [10, cy - 2.5], [4, cy + 0.5]];
  c.part();
  stars.forEach(([x, y], i) => {
    const on = (i + f) % 3 !== 0;
    c.px(x, y, STAR, FACE, { glow: on ? 1 : 0.35 });
    if (on && i % 2 === f % 2) c.spark(x, y - 1, hex('#c8d8ff'), 0.4);
  });
}

// ---------------------------------------------------------------- Comet Moth (the Cosmos Arena; rare)

const COMET: Material = { ramp: ramp('#2a1a6a', '#5a3ab8', '#9a7af0', '#d8c8ff', '#ffffff'), outline: hex('#0e0628'), outlineLit: hex('#180c3a'), emissive: 0.5 };
const COMET_BODY: Material = { ramp: ramp('#c8b8ff', '#ffffff'), outline: hex('#3a2a6a'), emissive: 0.8 };
const TAIL = [hex('#ffffff'), hex('#c8b8ff'), hex('#8a70ff'), hex('#5a3ab8')];

function cometmoth(c: PixelCanvas, f: number): void {
  const open = [1, 0.55, 0.15, 0.55][f];
  const cy = 8 + [0.5, 0, -0.5, 0][f];
  // A trail of stardust streaming out behind it.
  for (let i = 0; i < 7; i++) {
    const x = 5 - i;
    const y = cy + Math.sin(i * 0.9 + f * 1.4) * 0.8;
    c.spark(x, y, TAIL[Math.min(3, i >> 1)], 0.85 - i * 0.1);
  }
  flutter(c, 8.5, cy, open, 2.8, 3.4, COMET, COMET, false);
  c.part();
  c.capsule(5.5, cy, 10, cy, 1, 1.3, COMET_BODY);
  c.part();
  c.ellipse(11, cy, 1.3, 1.2, COMET_BODY);
  eye(c, 11.5, cy - 1);
  c.part();
  c.line(11.5, cy - 1.5, 13, cy - 3.5, COMET);
  c.line(11.5, cy + 1, 13.5, cy + 2, COMET);
  flutter(c, 8.5, cy, open, 2.8, 3.4, COMET, COMET, true, (wx, wy) => c.spark(wx, wy, hex('#ffffff'), 0.5));
}

// ---------------------------------------------------------------- Ghost Moth (the Spirit Dungeon)

const GHOST: Material = { ramp: ramp('#2a5a6a', '#5aa0b0', '#a0e8f0', '#e8ffff'), outline: hex('#0a2430'), outlineLit: hex('#123440'), emissive: 0.55, noAO: true };
const GHOST_EYE: Material = { ramp: ramp('#0a2a3a', '#1a4a5a'), outline: hex('#041018'), noAO: true };

function ghostmoth(c: PixelCanvas, f: number): void {
  // A soft, slow beat; it seems to fade and return as it flies.
  const open = [0.9, 0.55, 0.2, 0.55][f];
  const fade = [0.55, 0.45, 0.35, 0.45][f];
  const cy = 8 + [0, -0.5, -1, -0.5][f];
  flutter(c, 8.5, cy, open, 2.8, 3.4, GHOST, GHOST, false);
  c.part();
  c.capsule(4.5, cy, 9.5, cy, 1, 1.4, GHOST, { glow: fade + 0.1 });
  c.part();
  c.ellipse(10.8, cy, 1.5, 1.4, GHOST, { glow: fade + 0.2 });
  c.px(11.5, cy - 1, GHOST_EYE, FACE);
  c.px(11.5, cy, GHOST_EYE, FACE);
  flutter(c, 8.5, cy, open, 2.8, 3.4, GHOST, GHOST, true);
  // Wisps trailing off its tail.
  for (let i = 0; i < 4; i++) c.spark(3.5 - i, cy + ((i + f) % 2) - 0.5, hex('#a0e8f0'), 0.4 - i * 0.08);
}

// ---------------------------------------------------------------- Candle Mouse (the Spirit Dungeon; rare)

const MOUSE: Material = { ramp: ramp('#3a3440', '#5e566a', '#8a8298', '#bab2c8', '#e8e2f0'), outline: hex('#141018'), outlineLit: hex('#201a26') };
const PINK: Material = { ramp: ramp('#b86a80', '#f0a0b8', '#ffd0dc'), outline: hex('#401420'), noAO: true };
const WAX: Material = { ramp: ramp('#b8a888', '#e8dcc0', '#fffaf0'), outline: hex('#3a3024'), shine: true };
const CANDLE_FLAME: Material = { ramp: ramp('#ff8a2a', '#ffd070', '#fff8e0'), outline: hex('#5a2a04'), emissive: 1, noAO: true, noOutline: true };

function candlemouse(c: PixelCanvas, f: number): void {
  const step = f % 2;
  const cy = 11.5;
  // A curling pink tail.
  c.part();
  c.line(4, cy + 1.5, 2, cy + 1, PINK);
  c.line(2, cy + 1, 1, cy - 1 + step * 0.5, PINK);
  c.part();
  c.px(5 + step, 14, PINK, cyl(0, -0.3), { bias: -1 });
  c.px(9 - step, 14, PINK, cyl(0, -0.3), { bias: -1 });
  c.part();
  c.ellipse(7, cy, 3.6, 2.6, MOUSE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 1) });
  c.part();
  // The head, with a round ear and a pink nose.
  c.ellipse(10.5, cy - 0.5, 2.2, 1.9, MOUSE);
  c.part();
  c.ellipse(9.5, cy - 2.5, 1.4, 1.4, MOUSE, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 1) });
  c.px(9.5, cy - 2.5, PINK, FACE);
  c.part();
  c.px(12.5, cy, PINK, sphere(0.5, 0));
  eye(c, 11, cy - 1, f === 3);
  // A stub of candle stuck on its back, its flame dancing.
  c.part();
  c.shape(Math.round(cy - 5), Math.round(cy - 2), () => [5.5, 7.5], WAX, (_x, _y, t) => cyl(t, 0.2));
  c.px(6.5, cy - 4, WAX, cyl(0.5, 0.2), { bias: -1 });
  c.part();
  const lean = [0, 0.5, 0, -0.5][f];
  c.px(6.5 + lean, cy - 6, CANDLE_FLAME, FACE);
  c.px(6.5, cy - 5.5, CANDLE_FLAME, FACE);
  if (f !== 2) c.px(6.5 + lean, cy - 7, CANDLE_FLAME, { x: 0, y: 0.4, z: 1 }, { glow: 0.7 });
  c.spark(6.5 + lean, cy - 6.5, hex('#ffd070'), 0.7);
  c.spark(6.5 + lean, cy - 8, hex('#ffb040'), 0.3);
}

// ---------------------------------------------------------------- Ember Beetle (the Elementinho Temple)

const CHAR: Material = { ramp: ramp('#0e0808', '#221414', '#3a2420', '#5a3a30'), outline: hex('#040202'), outlineLit: hex('#0a0404'), shine: true };
const MAGMA: Material = { ramp: ramp('#c83a0a', '#ff8a2a', '#ffe08a'), outline: hex('#3a0a02'), emissive: 1, noAO: true, noOutline: true };

function emberbeetle(c: PixelCanvas, f: number): void {
  const step = f % 2;
  const cy = 11;
  const heat = [1, 0.8, 0.6, 0.8][f];
  c.part();
  legs(c, [6, 8, 10], cy + 1.5, 14, CHAR, step);
  c.part();
  c.ellipse(7.5, cy - 0.5, 4.4, 3.3, CHAR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 1) });
  // Cracks of lava across its shell, breathing with heat.
  c.part();
  for (const [x, y] of [[5, cy - 2], [6, cy - 1], [6, cy], [8, cy - 3], [9, cy - 2], [9, cy - 1], [10, cy - 1], [4, cy], [7, cy + 1]] as const) c.px(x, y, MAGMA, FACE, { glow: heat });
  c.part();
  c.ellipse(12, cy + 0.5, 1.8, 1.6, CHAR);
  c.px(12.5, cy, MAGMA, FACE, { glow: 1 });
  c.part();
  c.line(13, cy + 1.5, 14.5, cy + 1, CHAR);
  // Heat shimmer and a rising ember.
  c.spark(8, cy - 4.5 - f * 0.5, hex('#ffb040'), 0.5 * heat);
  c.spark(6, cy - 1, hex('#ff8a2a'), 0.3 * heat);
}

// ---------------------------------------------------------------- Salamander (the Elementinho Temple; rare)

const SALA: Material = { ramp: ramp('#7a1a0a', '#c8421a', '#f07a2a', '#ffc070', '#fff0c8'), outline: hex('#2a0804'), outlineLit: hex('#3a0c06'), shine: true };
const SALA_SPOT: Material = { ramp: ramp('#1a0a0a', '#3a1a14'), outline: hex('#0a0404'), noOutline: true };
const FIRE = [hex('#fff4c0'), hex('#ffc040'), hex('#ff6a1a')];

function salamander(c: PixelCanvas, f: number): void {
  // It scuttles: legs in pairs, its body swaying the other way.
  const sway = [0, 0.5, 0, -0.5][f];
  const step = f % 2;
  const cy = 12;
  c.part();
  c.px(5 - step, cy + 2, SALA, cyl(0, -0.3), { bias: -1 });
  c.px(10 + step, cy + 2, SALA, cyl(0, -0.3), { bias: -1 });
  c.part();
  // Tail, body and head as one sinuous line.
  c.capsule(1, cy - 1 - sway, 5, cy + sway * 0.5, 0.5, 1.3, SALA);
  c.part();
  c.capsule(4.5, cy + sway * 0.5, 10, cy - sway * 0.5, 1.5, 1.6, SALA);
  c.part();
  c.ellipse(12, cy - 0.5 - sway * 0.5, 2.2, 1.6, SALA);
  c.part();
  c.px(7, cy - 1, SALA_SPOT);
  c.px(9, cy, SALA_SPOT);
  c.px(4, cy - 0.5, SALA_SPOT);
  eye(c, 12.5, cy - 1.5 - sway * 0.5, f === 3);
  c.part();
  c.px(6 + step, cy + 2, SALA, cyl(0, -0.3));
  c.px(11 - step, cy + 2, SALA, cyl(0, -0.3));
  // A little flame dancing on the tip of its tail.
  for (let i = 0; i < 3; i++) c.spark(1 + ((i + f) % 2) * 0.5, cy - 2 - sway - i, FIRE[i], 0.9 - i * 0.2);
}

// ---------------------------------------------------------------- Crystal Beetle (the Glimmerdeep)

const AMETHYST: Material = { ramp: ramp('#2a0e4a', '#5a2a90', '#9a5ae0', '#d8a8ff', '#ffffff'), outline: hex('#12041e'), outlineLit: hex('#1e0a30'), shine: true, emissive: 0.25 };
const DEEP_INK: Material = { ramp: ramp('#0e0a18', '#221a34', '#3a2e50'), outline: hex('#05030a') };

function crystalbeetle(c: PixelCanvas, f: number): void {
  const step = f % 2;
  const cy = 11;
  c.part();
  legs(c, [6, 8, 10], cy + 1.5, 14, DEEP_INK, step);
  c.part();
  // A faceted shell: flat planes catching the light at different angles.
  c.shape(Math.round(cy - 4), Math.round(cy + 2), (y) => {
    const u = (y - (cy - 4)) / 6;
    const hw = 2 + Math.sin(Math.min(1, u * 1.3) * Math.PI * 0.5) * 2.6;
    return [7.5 - hw, 7.5 + hw];
  }, AMETHYST, (x, y) => {
    const fx = x < 6 ? -0.6 : x < 9 ? 0 : 0.6;
    const fy = y < cy - 2 ? 0.6 : y < cy ? 0.1 : -0.4;
    return sphere(fx, fy, 1);
  });
  c.part();
  c.ellipse(12, cy + 0.5, 1.8, 1.6, DEEP_INK);
  eye(c, 12.5, cy, f === 1);
  c.part();
  c.line(13, cy - 0.5, 14, cy - 2.5, DEEP_INK);
  // A glint running across the facets.
  const gx = 4 + f * 2;
  c.spark(gx, cy - 3 + (f === 3 ? 1 : 0), hex('#ffffff'), 0.7);
  c.spark(gx + 1, cy - 2, hex('#e0c0ff'), 0.35);
}

// ---------------------------------------------------------------- Spore Puff (the Glimmerdeep)

const PUFF_FUR: Material = { ramp: ramp('#8a2a6a', '#c84a9a', '#f07ac8', '#ffc0ec', '#fff0fa'), outline: hex('#3a0a2a'), outlineLit: hex('#4a1236'), emissive: 0.2 };
const PUFF_SPOT: Material = { ramp: ramp('#3ad8e0', '#a0ffff'), outline: hex('#0a3a40'), emissive: 1, noAO: true, noOutline: true };
const PUFF_WING = hex('#ffd0f4');

function sporepuff(c: PixelCanvas, f: number): void {
  // A fuzzy ball bobbing along on two tiny whirring wings.
  const bob = [0, -0.5, -1, -0.5][f];
  const cy = 8 + bob;
  const beat = f % 2;
  for (const side of [-1, 1]) for (let i = 1; i <= 3; i++) c.spark(8 + side * (3.5 + i * 0.6), cy - 2 - i * (beat ? 0.3 : 0.8), PUFF_WING, 0.45 - i * 0.1);
  c.part();
  c.ellipse(8, cy, 3.6, 3.4, PUFF_FUR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  // Fuzz breaking up the edge.
  c.part();
  for (const [x, y] of [[4, cy - 2], [12, cy - 1], [5, cy + 3], [11, cy + 3], [8, cy - 4]] as const) c.px(x, y, PUFF_FUR, sphere(Math.sign(x - 8) * 0.6, (cy - y) * 0.2));
  c.part();
  c.px(6, cy - 1, PUFF_SPOT, FACE, { glow: 0.8 });
  c.px(9, cy + 1.5, PUFF_SPOT, FACE, { glow: 0.7 });
  c.px(5, cy + 1, PUFF_SPOT, FACE, { glow: 0.6 });
  eye(c, 10, cy - 1, f === 3);
  // Spores sifting down from it.
  c.spark(7 + beat, cy + 5 + beat, hex('#a0ffff'), 0.45);
  c.spark(9 - beat, cy + 6, hex('#ffc0ec'), 0.3);
}

// ---------------------------------------------------------------- Glowlotl (the Glimmerdeep; rare)

const AXO: Material = { ramp: ramp('#a04a6a', '#d87a98', '#f8a8c0', '#ffd8e4', '#fff4f8'), outline: hex('#3a1224'), outlineLit: hex('#4a1a30'), shine: true };
const GILL: Material = { ramp: ramp('#c83aa0', '#ff6ad8', '#ffc0f4'), outline: hex('#4a0a3a'), emissive: 0.9, noAO: true };
const AXO_EYE: Material = { ramp: ramp('#0a0610', '#1a1420'), outline: hex('#040208'), noAO: true };

function axolotl(c: PixelCanvas, f: number): void {
  const step = f % 2;
  const sway = [0, 0.5, 0, -0.5][f];
  const cy = 12;
  c.part();
  c.px(5 - step, cy + 2, AXO, cyl(0, -0.3), { bias: -1 });
  c.px(9 + step, cy + 2, AXO, cyl(0, -0.3), { bias: -1 });
  c.part();
  // A finned tail, then the soft body.
  c.capsule(1, cy - sway, 5, cy + 0.5, 0.8, 1.4, AXO);
  c.part();
  c.capsule(4.5, cy + 0.5, 9.5, cy, 1.8, 1.9, AXO);
  c.part();
  c.ellipse(11.5, cy - 0.5, 2.6, 2.2, AXO, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  // Frilly glowing gills fanned round its head, waving.
  c.part();
  const wave = [0, 0.5, 1, 0.5][f];
  c.line(10, cy - 2.5, 9 - wave * 0.5, cy - 5, GILL, () => FACE, { glow: 0.9 });
  c.line(11, cy - 2.5, 11 + wave * 0.3, cy - 5.5, GILL, () => FACE, { glow: 1 });
  c.line(9.5, cy - 1.5, 7.5, cy - 3 - wave * 0.5, GILL, () => FACE, { glow: 0.8 });
  c.part();
  c.px(12.5, cy - 1, AXO_EYE, FACE);
  c.px(12.5, cy - 1.5, GLINT, FACE);
  c.px(13.5, cy + 0.5, AXO, sphere(0.6, -0.2), { bias: -1 });
  c.part();
  c.px(6 + step, cy + 2, AXO, cyl(0, -0.3));
  c.px(10 - step, cy + 2, AXO, cyl(0, -0.3));
  c.spark(9 - wave * 0.5, cy - 5.5, hex('#ff9ae8'), 0.5);
  c.spark(11 + wave * 0.3, cy - 6, hex('#ffc0f4'), 0.4);
}

// ---------------------------------------------------------------- Blood Moth (under a Blood Moon)

const BLOOD: Material = { ramp: ramp('#3a0408', '#7a0a14', '#c81a28', '#ff5a5a', '#ffc0b8'), outline: hex('#140204'), outlineLit: hex('#200306'), emissive: 0.45, shine: true };
const BLOOD_EYE: Material = { ramp: ramp('#ffb040', '#fff0a0'), outline: hex('#3a1004'), emissive: 1, noAO: true, noOutline: true };

function bloodmoth(c: PixelCanvas, f: number): void {
  const open = [1, 0.55, 0.2, 0.55][f];
  const cy = 8 + [0.5, 0, -0.5, 0][f];
  // A burning eye-spot, ringed in black, on each forewing.
  const spot = (wx: number, wy: number) => {
    if (open < 0.4) return;
    c.px(wx, wy, EYE, FACE);
    c.px(wx + 1, wy, BLOOD_EYE, FACE);
  };
  flutter(c, 8.5, cy, open, 3.2, 3.8, BLOOD, BLOOD, false, spot);
  c.part();
  c.capsule(5, cy, 9.5, cy, 1.1, 1.3, INK);
  c.part();
  c.ellipse(10.8, cy, 1.3, 1.2, INK);
  c.px(11.5, cy - 0.5, BLOOD_EYE, FACE);
  c.part();
  c.line(11.5, cy - 1.5, 13, cy - 4, INK);
  c.line(11.5, cy + 1, 13.5, cy + 2.5, INK);
  flutter(c, 8.5, cy, open, 3.2, 3.8, BLOOD, BLOOD, true, spot);
  for (let i = 0; i < 3; i++) c.spark(4 - i, cy + ((i + f) % 2), hex('#ff5a5a'), 0.45 - i * 0.12);
}

// ---------------------------------------------------------------- Gold Scarab (in the Golden Hour)

const GOLD: Material = { ramp: ramp('#5a3a08', '#a0701a', '#e0b030', '#ffe890', '#ffffff'), outline: hex('#1e1204'), outlineLit: hex('#2e1c06'), shine: true, emissive: 0.2 };
const LAPIS: Material = { ramp: ramp('#0a1a5a', '#1e3aa0', '#4a7af0'), outline: hex('#040a24'), shine: true };

function goldscarab(c: PixelCanvas, f: number): void {
  const step = f % 2;
  const cy = 11;
  c.part();
  legs(c, [6, 8, 10], cy + 1.5, 14, GOLD, step);
  c.part();
  c.ellipse(7.5, cy - 0.5, 4.5, 3.4, GOLD, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 1) });
  c.part();
  for (let y = cy - 3; y <= cy + 2; y++) c.px(7.5, y, GOLD, cyl(0, 0.4), { bias: -2 });
  // A lapis inlay like a jewelled brooch.
  c.part();
  c.px(5, cy - 1, LAPIS, sphere(-0.4, 0.3));
  c.px(10, cy - 1, LAPIS, sphere(0.4, 0.3));
  c.part();
  c.ellipse(12, cy + 0.5, 1.9, 1.6, GOLD);
  // Its little rake of a head, like the sun's rays.
  c.px(13.5, cy - 0.5, GOLD, sphere(0.6, 0.4));
  c.px(14, cy + 0.5, GOLD, sphere(0.8, 0));
  eye(c, 12, cy, f === 2);
  const gx = 5 + f * 1.5;
  c.spark(gx, cy - 3, hex('#ffffff'), 0.8);
  c.spark(gx + 1, cy - 2, hex('#ffe890'), 0.4);
}

// ---------------------------------------------------------------- Moon Hare (where the White Stag leads)

const HARE: Material = { ramp: ramp('#5a6280', '#8a94b4', '#bcc6e0', '#e4ecf8', '#ffffff'), outline: hex('#1e2238'), outlineLit: hex('#30364e'), emissive: 0.35 };
const HARE_EAR: Material = { ramp: ramp('#7aa8d8', '#b8e0ff', '#f0faff'), outline: hex('#1e3048'), emissive: 0.9, noAO: true, noOutline: true };
const CRESCENT: Material = { ramp: ramp('#c8a040', '#ffe890', '#fffae0'), outline: hex('#3a2a08'), emissive: 1, noAO: true, noOutline: true };

function moonhare(c: PixelCanvas, f: number): void {
  // Sitting up, nose twitching, its long ears tipped with moonlight turning to listen.
  const twitch = f % 2;
  const tilt = [0, 0.5, 1, 0.5][f];
  const cy = 11;
  // The far ear, laid back a little.
  c.part();
  c.capsule(10, cy - 4, 8 - tilt * 0.5, cy - 9.5, 1, 0.7, HARE, { bias: -1 });
  // A round haunch and body, a white scut behind.
  c.part();
  c.ellipse(3.5, cy + 0.5, 1.3, 1.3, HARE, { bias: 1 });
  c.part();
  c.ellipse(6.5, cy + 0.5, 4, 3.3, HARE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.25, 1) });
  c.part();
  c.ellipse(5.5, cy + 2, 2.6, 1.6, HARE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.3, 1) });
  c.px(8.5, cy + 3, HARE, cyl(0.3, -0.3));
  c.px(9.5, cy + 3, HARE, cyl(0.3, -0.3));
  // The head, the near ear standing tall and glowing at its tip.
  c.part();
  c.ellipse(10.5, cy - 2, 2.4, 2.1, HARE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  c.part();
  c.capsule(10.5, cy - 3.5, 10.5 + tilt * 0.6, cy - 9.5, 1.1, 0.7, HARE);
  c.part();
  c.px(10.5 + tilt * 0.6, cy - 9, HARE_EAR, FACE, { glow: 0.9 });
  c.px(10.5 + tilt * 0.3, cy - 7.5, HARE_EAR, FACE, { glow: 0.6 });
  c.px(8 - tilt * 0.5, cy - 9, HARE_EAR, FACE, { glow: 0.5 });
  c.part();
  c.px(12.5, cy - 1.5 + twitch * 0.5, HARE_EAR, sphere(0.5, 0), { glow: 0.4 });
  eye(c, 11, cy - 2.5, f === 3);
  // A crescent moon in gold on its flank.
  c.part();
  for (const [x, y] of [[5, cy - 1], [4, cy], [4, cy + 1], [5, cy + 2]] as const) c.px(x, y, CRESCENT, FACE);
  c.spark(10.5 + tilt * 0.6, cy - 10, hex('#d8f0ff'), 0.6);
  c.spark(4.5, cy + 0.5, hex('#ffe890'), 0.3);
}

/** Each critter's drawing, by id: draws frame `f` into `c` (a CRITTER_W x CRITTER_H box). */
export const CRITTER_ART: Record<string, (c: PixelCanvas, f: number) => void> = {
  firefly,
  butterfly,
  ladybug,
  moonmoth,
  glowfrog,
  dragonfly,
  pearlsnail,
  starbeetle,
  cometmoth,
  ghostmoth,
  candlemouse,
  emberbeetle,
  salamander,
  crystalbeetle,
  sporepuff,
  axolotl,
  bloodmoth,
  goldscarab,
  moonhare,
};

export function critterFrame(id: string, f: number): PixelCanvas {
  const c = new PixelCanvas(CRITTER_W, CRITTER_H);
  CRITTER_ART[id](c, f);
  return c;
}

/** Every frame of every critter, for the sheet. */
export function critterFrames(): { name: string; canvas: PixelCanvas }[] {
  const out: { name: string; canvas: PixelCanvas }[] = [];
  for (const id of Object.keys(CRITTER_ART)) for (let f = 0; f < CRITTER_FRAMES; f++) out.push({ name: `${id}_${f}`, canvas: critterFrame(id, f) });
  return out;
}

// ---------------------------------------------------------------- The net

export const NET_SIZE = 32;
/** The grip (the hero's hand) in the net's frame. */
export const NET_GRIP_X = 16;
export const NET_GRIP_Y = 18;
/** The swing's frames, from raised behind the head to swept down on the ground in front. */
export const NET_ANGLES = [-150, -110, -60, -15, 25];

const HANDLE: Material = { ramp: ramp('#3a2414', '#6a4424', '#9a6a3a', '#c89a60'), outline: hex('#140a04'), outlineLit: hex('#22140a') };
const HOOP: Material = { ramp: ramp('#5a4a3a', '#8a7a62', '#c0ae8a', '#f0e0c0'), outline: hex('#1e160e'), shine: true };
const MESH: Material = { ramp: ramp('#8a8a7a', '#d8d8c8', '#ffffff'), outline: hex('#3a3a30'), noOutline: true, noAO: true };
const WRAP: Material = { ramp: ramp('#5a1a14', '#9a2a1e', '#d04a32'), outline: hex('#200806') };

/**
 * The butterfly net held at `deg` (0 points straight ahead to the right, -90
 * straight up): a wooden pole from the grip, a bent-wood hoop at its end seen
 * a little from above, and a pale mesh bag hanging from it.
 */
export function netFrame(deg: number): PixelCanvas {
  const c = new PixelCanvas(NET_SIZE, NET_SIZE);
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const gx = NET_GRIP_X;
  const gy = NET_GRIP_Y;
  const hx = gx + ux * 10;
  const hy = gy + uy * 10;
  // The hoop's centre sits past the pole's tip; the bag trails away from the swing.
  const cx = gx + ux * 13.5;
  const cy = gy + uy * 13.5;
  c.part();
  // The bag: a soft cone of mesh hanging down and back from the hoop.
  const bx = cx - uy * 2 + 1;
  const by = cy + Math.abs(ux) * 2.5 + 2;
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const px = cx + (bx - cx) * t;
    const py = cy + (by - cy) * t;
    const r = 2.8 * (1 - t * 0.7);
    for (let k = -r; k <= r; k += 1) if ((Math.round(px + k) + Math.round(py)) % 2 === 0) c.px(px + k * Math.abs(uy) + k * 0.3, py + k * Math.abs(ux) * 0.4, MESH, { x: k / (r + 0.1) * 0.5, y: 0.2, z: 0.85 });
  }
  c.part();
  // The pole, and a red cord wound round the grip.
  c.line(gx - ux * 2, gy - uy * 2, hx, hy, HANDLE, (i, n) => cyl((i / n - 0.5) * 0.2, 0.3));
  c.part();
  c.px(gx, gy, WRAP, cyl(0, 0.3));
  c.px(gx + ux, gy + uy, WRAP, cyl(0, 0.3));
  c.part();
  // The hoop: an ellipse flattened across the pole, drawn as a ring.
  const rA = 3.4;
  const rB = 2.2;
  for (let s = 0; s < 28; s++) {
    const t = (s / 28) * Math.PI * 2;
    const along = Math.cos(t) * rA;
    const across = Math.sin(t) * rB;
    const x = cx + ux * along - uy * across;
    const y = cy + uy * along + ux * across;
    c.px(x, y, HOOP, sphere(Math.cos(t) * 0.6, -Math.sin(t) * 0.6, 1));
  }
  return c;
}

/** A 16x16 icon of the net for the touch button and the collection. */
export function netIcon(): PixelCanvas {
  const c = new PixelCanvas(16, 16);
  c.offset(-13, -5);
  const n = netFrame(-45);
  // Copy the -45 frame into the icon's box, shifted so the hoop sits in the middle.
  for (let y = 0; y < NET_SIZE; y++) {
    for (let x = 0; x < NET_SIZE; x++) {
      const m = n.materialAt(x, y);
      if (!m) continue;
      const i = y * NET_SIZE + x;
      c.px(x, y, m, { x: n.nx[i], y: n.ny[i], z: n.nz[i] }, { bias: n.bias[i], glow: n.glow[i] });
    }
  }
  return c;
}

// ---------------------------------------------------------------- Jars

export const JAR_W = 18;
export const JAR_H = 24;
/** The jar's inside, where its critter lives: left, top, right, floor. */
const IN_L = 3;
const IN_T = 7;
const IN_R = 14;
const IN_B = 21;

const GLASS: Material = { ramp: ramp('#3a5a6a', '#6a9aaa', '#a8d8e4', '#e8fcff'), outline: hex('#142430'), outlineLit: hex('#1e3440'), shine: true, noAO: true };
const GLASS_IN: Material = { ramp: ramp('#0e1a24', '#15242e', '#1c2e38'), outline: hex('#08121a'), noOutline: true, noAO: true };
const CORK: Material = { ramp: ramp('#5a3a1a', '#8a5e30', '#b88a50', '#e0b878'), outline: hex('#20120a'), outlineLit: hex('#2e1c0e') };
const TWINE: Material = { ramp: ramp('#7a6a4a', '#b8a478', '#e8d8a8'), outline: hex('#2a2214') };
const SHINE: Material = { ramp: ramp('#c8eef8', '#ffffff'), outline: hex('#3a5a6a'), noOutline: true, noAO: true };

/** The jar's half-width at row y: a shoulder under the neck, straight sides, a rounded foot. */
function jarEdges(y: number): [number, number] | null {
  const cx = JAR_W / 2;
  if (y < 5 || y > 22) return null;
  if (y === 5) return [cx - 4, cx + 4];
  if (y === 6) return [cx - 6, cx + 6];
  if (y >= 21) return [cx - 6 + (y - 20), cx + 6 - (y - 20)];
  return [cx - 7, cx + 7];
}

/** Copy a critter frame into the jar, offset by (dx, dy), only where it falls inside the glass. */
function pour(jar: PixelCanvas, src: PixelCanvas, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < IN_L || tx > IN_R || ty < IN_T || ty > IN_B) continue;
      const i = y * src.w + x;
      const m = src.materialAt(x, y);
      if (m) jar.px(tx, ty, m, { x: src.nx[i], y: src.ny[i], z: src.nz[i] }, { bias: src.bias[i], glow: src.glow[i] });
      const l = i * 4;
      if (src.light[l + 3]) jar.spark(tx, ty, [src.light[l], src.light[l + 1], src.light[l + 2]], 1);
    }
  }
}

/**
 * A corked glass jar holding critter `id` on frame `f` (none: an empty jar).
 * `fly` lifts a flyer into the middle of the jar; `glow` is the colour of
 * the light it gives off, filling the glass like a lantern.
 */
export function jarFrame(id: string | null, f: number, fly = false, glow?: RGB): PixelCanvas {
  const c = new PixelCanvas(JAR_W, JAR_H);
  const cx = JAR_W / 2;
  // The back of the glass: dark tinted inside, a rim of glass round it.
  c.part();
  c.shape(5, 22, jarEdges, GLASS, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.shape(7, 20, (y) => {
    const e = jarEdges(y);
    return e && [e[0] + 1, e[1] - 1];
  }, GLASS_IN, (_x, _y, t) => cyl(-t * 0.6, 0.1));
  // A little moss and a pebble on the floor of the jar.
  c.part();
  c.px(5, 20, CORK, cyl(0, 0.6), { bias: -1 });
  c.px(6, 20, CORK, cyl(0, 0.6), { bias: -2 });
  c.px(12, 20, GLASS, sphere(0.2, 0.5));
  if (id) {
    c.part();
    const bob = fly ? [0, -1, -1, 0][f] : 0;
    pour(c, critterFrame(id, f), fly ? 1 : 1, (fly ? 5 : 7) + bob);
  }
  // Light filling the glass: brightest round the critter, fading to the walls.
  if (glow) {
    for (let y = IN_T; y <= IN_B; y++) {
      for (let x = IN_L; x <= IN_R; x++) {
        const d = Math.hypot((x + 0.5 - cx) / 6, (y + 0.5 - 14) / 8);
        if (d < 1) c.spark(x, y, glow, (1 - d) * 0.35);
      }
    }
  }
  // The front of the glass: a long shine down its left side, a short one on the right.
  c.part();
  for (let y = 8; y <= 18; y++) c.px(3, y, SHINE, { x: -0.3, y: 0.3, z: 0.9 });
  c.px(4, 8, SHINE, { x: -0.3, y: 0.5, z: 0.8 });
  for (let y = 15; y <= 17; y++) c.px(14, y, SHINE, { x: 0.3, y: 0.3, z: 0.9 }, { bias: -1 });
  // The neck, the cork and a loop of twine.
  c.part();
  c.shape(3, 4, () => [cx - 4, cx + 4], GLASS, (_x, _y, t) => cyl(t, 0.3));
  c.part();
  c.shape(0, 3, (y) => (y === 0 ? [cx - 2.5, cx + 2.5] : [cx - 3.5, cx + 3.5]), CORK, (_x, y, t) => cyl(t, y === 0 ? 0.8 : 0.2));
  c.part();
  c.line(cx - 4, 4, cx + 4, 4, TWINE, (i, n) => cyl((i / n) * 2 - 1, 0.2));
  c.px(cx + 4, 5, TWINE, cyl(0.8, 0));
  c.px(cx + 5, 6, TWINE, cyl(0.8, 0));
  return c;
}
