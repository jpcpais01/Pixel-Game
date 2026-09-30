// Hazel the Naturalist and her field camp on the Runestone Clearing's east
// lawn, where she buys the player's spare critters. The world places them
// (world/Naturalist.ts); this file only draws them and registers them.
//
// The camp comes in two layers with Hazel standing between them, like Old
// Wick's stall: behind her, a canvas fly on birch poles with guy ropes, a
// shaded canvas back wall, a specimen cabinet of glowing jars, a board of
// pinned butterflies and beetles over a crate of books, bunches of drying
// herbs and a brass lantern swaying from the fly's hem, a moth or two
// circling it; in front of her, a trestle table under a green baize cloth
// embroidered with a gold butterfly, a brass microscope, an open field
// journal, jars of glowing critters and a potted fern on top, a butterfly
// net leaning on the left pole and a wicker creel at the right one's foot.
//
// Hazel: a cheerful field naturalist in a wide straw sun hat with a pheasant
// feather (a blue butterfly resting on its brim, opening and closing its
// wings), round brass spectacles, an olive field coat with pockets, a rust
// neckerchief and a leather satchel. She holds up a jar with a firefly in it
// and, every so often, brings her magnifying glass up to her eye, which
// swims up huge in the lens.

import type Phaser from 'phaser';
import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { hash2 } from './env';
import { packAtlas, registerAtlas } from './atlas';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------- Sizes

export const CAMP_W = 88;
export const CAMP_H = 72;
/** The camp's anchor: the middle of its front, where the table's legs and the poles meet the grass. */
export const CAMP_OX = 44;
export const CAMP_OY = 68;
export const CAMP_FRAMES = 6;
/** Where Hazel's feet go in the camp's frame: behind the table. */
export const CAMP_KEEPER_X = 44;
export const CAMP_KEEPER_Y = 56;
/** Where the lantern and the jars glow, in the camp's frame (for the world's lights). */
export const CAMP_LANTERN = { x: 70, y: 25 };
export const CAMP_JARS = { x: 59, y: 42 };
export const CAMP_CABINET = { x: 23, y: 34 };

export const HAZEL_W = 30;
export const HAZEL_H = 38;
/** Hazel's feet in her frame. */
export const HAZEL_OX = 15;
export const HAZEL_OY = 36;
export const HAZEL_FRAMES = 6;

// ---------------------------------------------------------------- Materials

const INK = hex('#0a0806');

const CANVAS: Material = { ramp: ramp('#2e281e', '#4a4232', '#6e644c', '#958866', '#b8aa84', '#d4c8a2', '#ebe2c2', '#f8f2de'), outline: hex('#16120c'), outlineLit: hex('#2c261c') };
const CANVAS_GREEN: Material = { ramp: ramp('#0e180c', '#172814', '#223a1c', '#2e4e24', '#3e642e', '#527a3a', '#6a904a'), outline: hex('#070c06'), outlineLit: hex('#12200e') };
const BIRCH: Material = { ramp: ramp('#2a2620', '#4a443a', '#716a5c', '#9c9484', '#c4bcaa', '#e0dacb', '#f4f0e6'), outline: hex('#14120e'), outlineLit: hex('#2a2620') };
const ROPE: Material = { ramp: ramp('#3a2e1a', '#5e4c2c', '#86703e', '#aa9254', '#c8b070'), outline: hex('#1a1408'), noOutline: true };
const WOOD_DK: Material = { ramp: ramp('#140c08', '#241610', '#382418', '#4e3322', '#66452e', '#7e583a'), outline: hex('#080404'), outlineLit: hex('#1c120c') };
const WOOD: Material = { ramp: ramp('#1e120c', '#321e12', '#4a2e1a', '#644024', '#80562e', '#9c6e3c', '#b88a52'), outline: hex('#0c0604'), outlineLit: hex('#24160c') };
const PAPER: Material = { ramp: ramp('#4a4232', '#6e654e', '#948a6e', '#b8ae8e', '#d6ccaa', '#ebe3c6', '#faf5e2'), outline: hex('#1e1a12'), outlineLit: hex('#322c20') };
const BAIZE: Material = { ramp: ramp('#08140c', '#0f2014', '#172e1e', '#203e28', '#2c5034', '#3a6442', '#4c7a52'), outline: hex('#040a06'), outlineLit: hex('#0c1a10') };
const THREAD: Material = { ramp: ramp('#4a3208', '#7a5614', '#b08424', '#dcb040', '#f6d870', '#fff0b0'), outline: hex('#1e1404'), shine: true, noOutline: true };
const BRASS: Material = { ramp: ramp('#3a2408', '#6a4414', '#9e6c22', '#d4a040', '#f4d070', '#fff4c0'), outline: hex('#1a0e04'), shine: true };
const IRON: Material = { ramp: ramp('#08080c', '#121218', '#1c1c24', '#282834', '#383846', '#50505e', '#7a7a8c'), outline: hex('#030306'), outlineLit: hex('#141418'), shine: true };
const GLASS: Material = { ramp: ramp('#18242e', '#263844', '#3a525e', '#5a7682', '#8aa8b2', '#c4dce2', '#f0fcff'), outline: hex('#0a1016'), outlineLit: hex('#1a2a32'), shine: true };
const CORK: Material = { ramp: ramp('#3a2410', '#5e3e1c', '#86602e', '#aa8246', '#c8a064'), outline: hex('#1a0e04') };
const CLAY: Material = { ramp: ramp('#2e140a', '#4e2212', '#76341c', '#9c4828', '#bc6238', '#d8834e', '#eca676'), outline: hex('#160804'), outlineLit: hex('#2e140a') };
const LEAF: Material = { ramp: ramp('#0a1c0c', '#123012', '#1c4818', '#2a6220', '#3e7e2a', '#5a9a38', '#80b850'), outline: hex('#050e06'), outlineLit: hex('#0c1c0c') };
const WICKER: Material = { ramp: ramp('#2a1a0a', '#4a3014', '#6e4a20', '#946a30', '#b88c44', '#d8ae64'), outline: hex('#140a04'), outlineLit: hex('#2a1a0a') };
const LEATHER: Material = { ramp: ramp('#1c0e06', '#301a0c', '#4a2c14', '#66401e', '#825a2c', '#9e763e'), outline: hex('#0c0602'), outlineLit: hex('#1e1008') };
const GAUZE: Material = { ramp: ramp('#5a6064', '#80888c', '#a6aeb0', '#c8d0d0', '#e4eaea', '#f8fcfc'), outline: hex('#2a2e30'), noAO: true, noOutline: true };
const BOOK_RED: Material = { ramp: ramp('#2a0806', '#4a100c', '#6e1c14', '#94301e', '#b44a2c'), outline: hex('#140402') };
const BOOK_BLUE: Material = { ramp: ramp('#080e24', '#101c3e', '#1a2c5a', '#2a4278', '#3e5a96'), outline: hex('#04060e') };
const BOOK_GREEN: Material = { ramp: ramp('#081608', '#102810', '#1a3e1a', '#285628', '#3a6e38'), outline: hex('#040a04') };
const LAVENDER: Material = { ramp: ramp('#1e1030', '#34204e', '#4e3474', '#6c4e9a', '#8e70bc', '#b49ad8'), outline: hex('#0e0818') };
const YARROW: Material = { ramp: ramp('#4a4436', '#76705a', '#a49e84', '#ccc6ac', '#ebe6d0', '#fbf8ec'), outline: hex('#1e1c14') };
const STALK: Material = { ramp: ramp('#1a220e', '#2c3818', '#425224', '#5a6c32', '#768a44'), outline: hex('#0c1006'), noOutline: true };
const FLAME: Material = { ramp: ramp('#c04a0a', '#ff8a24', '#ffc860', '#fff4c8'), outline: INK, emissive: 1, noAO: true, noOutline: true };

/** What glows in the jars: each a critter's own light. */
const glowOf = (a: string, b: string, c: string, d: string, e: string, halo: RGB): { m: Material; halo: RGB } => ({
  m: { ramp: ramp(a, b, c, d, e), outline: INK, emissive: 0.95, noAO: true, noOutline: true },
  halo,
});
const GLOWS = [
  glowOf('#1e4a08', '#4a9a14', '#9ae03a', '#d8ff5a', '#f4ffc0', [216, 255, 90]),
  glowOf('#0a3a4a', '#1a7a8a', '#40c0d8', '#8af0ff', '#dafcff', [138, 240, 255]),
  glowOf('#4a1a3a', '#8a3a6a', '#d06aa8', '#ff9ae0', '#ffd8f4', [255, 154, 224]),
  glowOf('#4a1e04', '#9a4a0a', '#e08a20', '#ffb850', '#ffe8b0', [255, 170, 70]),
  glowOf('#2a1a4a', '#4e3488', '#8a60d0', '#c09aff', '#ece0ff', [184, 140, 255]),
  glowOf('#0e3a2a', '#1e7a5a', '#40c090', '#a8f0d0', '#e8fff4', [168, 240, 208]),
];

/** Wing colours of the pinned specimens and the butterfly on Hazel's hat. */
const WING_BLUE: Material = { ramp: ramp('#10286a', '#1e48b0', '#2e6ae0', '#4a90ff', '#8ac4ff', '#d0ecff'), outline: hex('#040818'), shine: true };
const WING_ORANGE: Material = { ramp: ramp('#3a1004', '#76240a', '#b44a12', '#e8781e', '#ffa848', '#ffd49a'), outline: hex('#1a0602') };
const WING_GREEN: Material = { ramp: ramp('#0a2a1a', '#145034', '#1e7a4e', '#34a86a', '#6ad69a', '#b4f4d0'), outline: hex('#041408'), shine: true };
const WING_PALE: Material = { ramp: ramp('#4a4436', '#7a7260', '#aaa28a', '#d4ccb2', '#eee8d4', '#fcf8ee'), outline: hex('#1e1c14') };
const BEETLE: Material = { ramp: ramp('#0a0a1a', '#141a3a', '#1e3058', '#2a5070', '#3a7a7a', '#6ab8a0'), outline: hex('#04040c'), shine: true };

// Hazel's own.
const STRAW: Material = { ramp: ramp('#3a2a10', '#5e461c', '#8a6a2c', '#b48e40', '#d8b45e', '#f0d488', '#fcecb4'), outline: hex('#1a1206'), outlineLit: hex('#34260e') };
const BAND: Material = { ramp: ramp('#0e200c', '#183816', '#265420', '#36702c', '#4c8a3a', '#6aa64e'), outline: hex('#060e04') };
const FEATHER: Material = { ramp: ramp('#2a1206', '#4a220c', '#743812', '#a0561e', '#c47a34', '#e0a45a', '#f4d0a0'), outline: hex('#140802') };
const SKIN: Material = { ramp: ramp('#3a1e14', '#643622', '#925436', '#b87450', '#d6966e', '#eeb890', '#fad6b4'), outline: hex('#1e0e08'), outlineLit: hex('#361c10') };
const ROSE: Material = { ramp: ramp('#5a2018', '#8a3a2a', '#b85a44', '#d87a62', '#ee9c84'), outline: hex('#2a0e08'), noOutline: true };
const HAIR: Material = { ramp: ramp('#241812', '#3e2a20', '#5e4232', '#806050', '#a48676', '#c8b0a2', '#e4d8d0'), outline: hex('#120c08'), outlineLit: hex('#221610') };
const COAT: Material = { ramp: ramp('#12180a', '#1e2812', '#2e3a1a', '#404e24', '#56642e', '#6e7c3c', '#8a9850'), outline: hex('#080c04'), outlineLit: hex('#161e0c') };
const SHIRT: Material = { ramp: ramp('#4a4436', '#7a725e', '#a8a088', '#d0c8ae', '#ece6d0', '#faf8ee'), outline: hex('#1e1c14'), outlineLit: hex('#34302a') };
const SCARF: Material = { ramp: ramp('#3a0e06', '#64200e', '#903416', '#b84e22', '#d87236', '#f09a58'), outline: hex('#1a0602') };
const TROUSERS: Material = { ramp: ramp('#1e1a10', '#342c1c', '#4c422a', '#665a3a', '#80744c'), outline: hex('#0e0c06') };
const BOOT: Material = { ramp: ramp('#100a06', '#1e140c', '#301f12', '#44301c', '#5a4226'), outline: hex('#060402') };
const EYE: Material = { ramp: ramp('#0a0604', '#1e140e'), outline: INK, noAO: true, noOutline: true };
const LENS: Material = { ramp: ramp('#5a7682', '#8aa8b2', '#c4dce2', '#f0fcff'), outline: hex('#1a2a32'), noAO: true, noOutline: true };

// ---------------------------------------------------------------- Helpers

const FLAT_N: Vec3 = { x: 0, y: 0, z: 1 };
const front = (t: number): Vec3 => ({ x: t * 0.35, y: -0.4, z: 0.85 });
const top = (t = 0): Vec3 => ({ x: t * 0.2, y: 0.75, z: 0.65 });
/** A flicker for frame f, so no two lights beat together. */
const FLICKER = [1, 0.78, 0.92, 0.7, 0.96, 0.82];
const flick = (f: number, seed: number) => FLICKER[(f + seed) % FLICKER.length];

/** A birch pole from y0 down to y1, `r` wide either side of x, its bark ringed with dark lenticels. */
function birchPole(c: PixelCanvas, x: number, y0: number, y1: number, r: number, seed: number, bias = 0): void {
  c.part();
  c.shape(y0, y1, () => [x - r, x + r], BIRCH, (_x, _y, t) => cyl(t, 0.1), { bias });
  for (let y = y0; y <= y1; y++) {
    if (hash2(seed, y, 701) > 0.8) {
      c.shade(x - 1, y, -2);
      if (hash2(seed, y, 703) > 0.5) c.shade(x, y, -2);
    }
  }
}

/** A glass jar `w` wide and `h` tall standing on `base`, a critter's light glowing inside, its cork in. */
function glowJar(c: PixelCanvas, x: number, base: number, w: number, h: number, glow: number, f: number, seed: number): void {
  const x0 = Math.round(x - w / 2);
  const top0 = base - h + 1;
  const g = GLOWS[glow % GLOWS.length];
  const k = flick(f, seed);
  c.part();
  c.shape(top0 + 1, base, (y) => (y === base || y === top0 + 1 ? [x0 + 0.5, x0 + w - 0.5] : [x0, x0 + w]), GLASS, (_x, _y, t) => cyl(t, 0.1), { bias: -1 });
  // The critter's light: a bright heart low in the jar, fading up the glass.
  c.part();
  const cy = base - Math.max(1, Math.floor(h / 2) - 1);
  const cx = x0 + Math.floor(w / 2) - (w % 2 === 0 ? 1 : 0);
  c.px(cx, cy, g.m, FLAT_N, { glow: 0.6 + 0.4 * k, bias: 2 });
  if (w > 3) c.px(cx + 1, cy, g.m, FLAT_N, { glow: 0.45 + 0.35 * k, bias: 1 });
  c.px(cx, cy + 1, g.m, FLAT_N, { glow: 0.3 + 0.3 * k, bias: 0 });
  c.spark(cx + 0.5, cy - 1, g.halo, 0.35 * k);
  c.spark(cx, cy - 2, g.halo, 0.15 * k);
  // The lit edge of the glass.
  c.part();
  for (let y = top0 + 2; y < base; y++) c.px(x0, y, GLASS, cyl(-0.9, 0.2), { bias: 1 });
  c.px(x0 + w - 1, top0 + 2, GLASS, sphere(0.4, 0.4), { bias: 2 });
  c.part();
  c.shape(top0, top0, () => [x0 + 0.5, x0 + w - 0.5], CORK, (_x, _y, t) => cyl(t, 0.6));
  c.px(x0 + Math.floor(w / 2), top0 - 1, CORK, top(0), { bias: 1 });
}

/** A pinned butterfly seen flat: forewings up, hindwings down, a dark body; `open` 0 folds them shut. */
function butterfly(c: PixelCanvas, x: number, y: number, wing: Material, open = 1, lift = 0): void {
  c.part();
  if (open >= 0.66) {
    c.px(x - 2, y - 1, wing, sphere(-0.6, 0.6 + lift), { bias: 1 });
    c.px(x - 1, y - 1, wing, sphere(-0.3, 0.5 + lift));
    c.px(x + 1, y - 1, wing, sphere(0.3, 0.5 + lift));
    c.px(x + 2, y - 1, wing, sphere(0.6, 0.6 + lift), { bias: 1 });
    c.px(x - 2, y - 2, wing, sphere(-0.6, 0.8 + lift), { bias: -1 });
    c.px(x + 2, y - 2, wing, sphere(0.6, 0.8 + lift), { bias: -1 });
    c.px(x - 1, y, wing, sphere(-0.4, -0.3), { bias: -1 });
    c.px(x + 1, y, wing, sphere(0.4, -0.3), { bias: -1 });
  } else if (open >= 0.33) {
    c.px(x - 1, y - 1, wing, sphere(-0.5, 0.7 + lift));
    c.px(x + 1, y - 1, wing, sphere(0.5, 0.7 + lift));
    c.px(x - 1, y - 2, wing, sphere(-0.3, 0.9), { bias: -1 });
    c.px(x + 1, y - 2, wing, sphere(0.3, 0.9), { bias: -1 });
  } else {
    // Shut: the wings stand straight up over the back, their pale undersides out.
    c.px(x, y - 2, wing, sphere(0, 0.8), { bias: -1 });
    c.px(x, y - 3, wing, sphere(0, 0.9), { bias: -2 });
    c.px(x + 1, y - 2, wing, sphere(0.4, 0.8), { bias: -2 });
  }
  c.part();
  c.px(x, y - 1, EYE, FLAT_N);
  c.px(x, y, EYE, FLAT_N);
}

/** A bunch of herbs hung upside down from (x, y) on a twine, swinging `dx` at its heads. */
function herbBunch(c: PixelCanvas, x: number, y: number, dx: number, flower: Material): void {
  c.part();
  c.line(x, y, x, y + 2, ROPE, () => FLAT_N);
  c.part();
  // Stalks fanning out downward from the tie.
  for (const [ex, len] of [
    [-2, 5],
    [-1, 6],
    [0, 6],
    [1, 6],
    [2, 5],
  ]) {
    c.line(x, y + 3, x + ex + dx, y + 3 + len, STALK, () => sphere(ex * 0.3, 0.2));
  }
  c.part();
  c.px(x, y + 3, ROPE, sphere(0, 0.4), { bias: 1 });
  c.px(x - 1, y + 3, ROPE, sphere(-0.4, 0.4));
  c.px(x + 1, y + 3, ROPE, sphere(0.4, 0.4));
  // The flower heads at the bottom, the dried blossom crowding the stalk ends.
  c.part();
  for (let i = -2; i <= 2; i++) {
    const hx = x + i + dx;
    const hy = y + 8 + (Math.abs(i) === 2 ? -1 : 0);
    c.px(hx, hy, flower, sphere(i * 0.3, -0.2), { bias: hash2(i, 3, 711) > 0.5 ? 1 : 0 });
    c.px(hx, hy + 1, flower, sphere(i * 0.3, -0.6), { bias: -1 });
    if (Math.abs(i) < 2) c.px(hx, hy - 1, flower, sphere(i * 0.3, 0.3));
  }
}

// ---------------------------------------------------------------- The camp

const AWN_BACK = 4;
const AWN_FRONT = 14;
/** The fly's front hem, sagging a little between its poles. */
const hemAt = (x: number) => AWN_FRONT + Math.round(1.6 * (1 - ((x + 0.5 - CAMP_OX) / 38) ** 2));

/**
 * The camp behind Hazel, frame `f`: guy ropes, back poles and a shaded
 * canvas back wall, the specimen cabinet and the pinned board over a crate,
 * the canvas fly, herbs and a lantern hung from its hem.
 */
export function campBack(frame: number): PixelCanvas {
  const c = new PixelCanvas(CAMP_W, CAMP_H);
  const ph = (frame / CAMP_FRAMES) * Math.PI * 2;

  // Guy ropes from the front poles' tops out to pegs in the grass.
  for (const [x0, x1] of [
    [6, 1],
    [82, 86],
  ]) {
    c.part();
    c.line(x0, AWN_FRONT, x1, CAMP_OY - 3, ROPE, () => sphere(x1 < 44 ? -0.5 : 0.5, 0.4));
    c.part();
    c.shape(CAMP_OY - 4, CAMP_OY - 2, () => [x1 - 0.5, x1 + 1.5], WOOD, (_x, _y, t) => cyl(t, 0.3));
  }

  // The back wall: canvas in the fly's shade, seamed, a little grubby at the hem.
  c.part();
  c.shape(8, 52, () => [12, 77], CANVAS, (px) => ({ x: Math.sin((px - 12) * 0.55) * 0.18, y: -0.1, z: 0.9 }), { bias: -2 });
  for (let y = 8; y <= 52; y++) {
    for (let x = 12; x < 77; x++) {
      if (x === 28 || x === 44 || x === 61) c.shade(x, y, -1);
      if (y > 48 && hash2(x, y, 713) > 0.5) c.shade(x, y, -1);
      if (y < 13) c.shade(x, y, -1);
    }
  }
  // The back poles.
  birchPole(c, 12.5, 5, 52, 1.5, 1, -1);
  birchPole(c, 76.5, 5, 52, 1.5, 2, -1);

  // The specimen cabinet: dark wood, three rows of cubbies with glowing jars, two drawers below.
  const CX0 = 14;
  const CX1 = 32;
  c.part();
  c.shape(21, 52, () => [CX0, CX1], WOOD_DK, (_x, _y, t) => cyl(t * 0.5, 0.05));
  c.part();
  c.shape(19, 20, () => [CX0 - 1, CX1 + 1], WOOD, (px, py) => (py === 19 ? top((px - 23) / 12) : front((px - 23) / 12)));
  const rows = [23, 31, 39];
  rows.forEach((ry, r) => {
    c.part();
    c.shape(ry, ry + 6, () => [CX0 + 1.5, CX1 - 1.5], WOOD_DK, () => FLAT_N, { bias: -2 });
    c.part();
    c.shape(ry + 7, ry + 7, () => [CX0 + 1, CX1 - 1], WOOD, (px) => top((px - 23) / 12));
    // A divider down the middle of each row.
    c.part();
    c.shape(ry, ry + 6, () => [22.5, 23.5], WOOD_DK, () => front(0));
    glowJar(c, 19, ry + 6, 4, 5, r * 2, frame, r * 2 + 1);
    glowJar(c, 27.5, ry + 6, 5, r === 1 ? 6 : 5, r * 2 + 1, frame, r * 2 + 3);
  });
  for (const dy of [47, 50]) {
    c.part();
    c.shape(dy, dy + 1, () => [CX0 + 1.5, CX1 - 1.5], WOOD, (px) => front((px - 23) / 12));
    c.part();
    c.px(22, dy, BRASS, sphere(0, 0.4), { bias: 1 });
    c.px(23, dy, BRASS, sphere(0.3, 0.4));
  }
  // On top: two books lying flat and a little glass cloche over a seedling.
  c.part();
  c.shape(17, 17, () => [CX0 + 1, CX0 + 8], BOOK_RED, (_x, _y, t) => cyl(t, 0.6));
  c.shape(18, 18, () => [CX0 + 1, CX0 + 8], BOOK_RED, (_x, _y, t) => front(t), { bias: -1 });
  c.part();
  c.shape(16, 16, () => [CX0 + 2, CX0 + 7], BOOK_BLUE, (_x, _y, t) => cyl(t, 0.6));
  c.part();
  c.ellipse(27.5, 16, 3, 3, GLASS, { normal: (_x, _y, dx, dy) => sphere(dx, -dy, 1), bias: -1 });
  c.part();
  c.px(27, 17, LEAF, sphere(-0.3, 0.6), { bias: 1 });
  c.px(28, 16, LEAF, sphere(0.4, 0.7), { bias: 1 });
  c.px(27, 18, STALK, FLAT_N);
  c.part();
  c.px(26, 14, GLASS, sphere(-0.5, 0.6), { bias: 3 });
  c.shape(18, 18, () => [24.5, 30.5], WOOD, (_x, _y, t) => cyl(t, 0.4));

  // The pinned board: a framed card of butterflies, a moth, a beetle and a dragonfly, glass over them.
  const BX0 = 59;
  const BX1 = 77;
  const BY0 = 19;
  const BY1 = 35;
  const BM = (BX0 + BX1) / 2;
  const [s0, s1, s2] = [BX0 + 4, BX0 + 9, BX0 + 14];
  c.part();
  c.shape(BY0, BY1, () => [BX0, BX1], WOOD, (px, py) => (py === BY0 ? top((px - BM) / 10) : py === BY1 ? front((px - BM) / 10) : cyl(((px - BX0) / (BX1 - BX0)) * 2 - 1, 0.1)));
  c.part();
  c.shape(BY0 + 1, BY1 - 1, () => [BX0 + 1, BX1 - 1], PAPER, () => ({ x: 0, y: -0.1, z: 0.95 }), { bias: -1 });
  butterfly(c, s0, 24, WING_BLUE);
  butterfly(c, s1, 24, WING_ORANGE);
  butterfly(c, s2, 24, WING_GREEN);
  butterfly(c, s0, 31, WING_PALE);
  // The beetle: a glossy oval with a split down its back.
  c.part();
  c.ellipse(s1 + 0.5, 30.5, 1.6, 2, BEETLE);
  c.shade(s1, 30, -1);
  c.px(s1, 28, EYE, FLAT_N);
  // The dragonfly: a long body and two pairs of clear wings.
  c.part();
  for (let y = 28; y <= 33; y++) c.px(s2, y, WING_GREEN, cyl(0, 0.3), { bias: y === 28 ? 1 : 0 });
  c.part();
  for (const s of [-1, 1]) {
    c.px(s2 + s, 29, WING_PALE, sphere(s * 0.4, 0.4), { bias: 1 });
    c.px(s2 + s * 2, 29, WING_PALE, sphere(s * 0.6, 0.4));
    c.px(s2 + s, 30, WING_PALE, sphere(s * 0.4, 0.2));
  }
  // Tiny labels under each, and a streak of light across the glass.
  for (const [lx, ly] of [
    [s0, 26],
    [s1, 26],
    [s2, 26],
    [s0, 33],
    [s1, 33],
  ]) {
    c.shade(lx - 1, ly, -2);
    c.shade(lx, ly, -2);
  }
  for (let k = 0; k < 4; k++) c.shade(BX1 - 3 - k, BY0 + 2 + k, 1);

  // A crate under it, books and a rolled map on top.
  c.part();
  c.shape(40, 52, () => [BX0, BX1], WOOD, (px, py) => (py === 40 ? top((px - BM) / 10) : front(((px - BX0) / (BX1 - BX0)) * 2 - 1)));
  for (let y = 41; y <= 52; y++) {
    for (let x = BX0; x < BX1; x++) {
      if (y === 46 || x === BX0 || x === BX1 - 1) c.shade(x, y, -1);
      if (x - BX0 === y - 41 || BX1 - 1 - x === y - 41) c.shade(x, y, -1);
    }
  }
  c.part();
  c.shape(39, 39, () => [BX0 + 2, BX0 + 11], BOOK_GREEN, (_x, _y, t) => cyl(t, 0.6));
  c.part();
  c.shape(38, 38, () => [BX0 + 3, BX0 + 10], BOOK_BLUE, (_x, _y, t) => cyl(t, 0.6));
  c.part();
  c.shape(37, 37, () => [BX0 + 2, BX0 + 9], BOOK_RED, (_x, _y, t) => cyl(t, 0.6));
  c.part();
  c.capsule(BX0 + 14, 39, BX0 + 15.5, 34, 1.2, 1.1, PAPER);
  c.part();
  c.px(BX0 + 14, 37, SCARF, cyl(-0.3, 0.2));
  c.px(BX0 + 15, 37, SCARF, cyl(0.3, 0.2), { bias: -1 });

  // The fly: a canvas sheet on a ridge pole, green bands down its sides, rippling between its seams.
  c.part();
  c.shape(AWN_BACK - 1, AWN_BACK - 1, () => [9.5, 78.5], BIRCH, (_x, _y, t) => cyl(t, 0.6));
  c.part();
  for (let x = 5; x < 83; x++) {
    const hem = hemAt(x);
    for (let y = AWN_BACK; y <= hem; y++) {
      const u = (y - AWN_BACK) / (AWN_FRONT - AWN_BACK);
      const hw = 34 + u * 4;
      const s = (x + 0.5 - CAMP_OX) / hw;
      if (Math.abs(s) > 1) continue;
      const band = Math.abs(s) > 0.84 || (Math.abs(s) > 0.7 && Math.abs(s) < 0.76);
      const ripple = Math.sin((x - 5) * 0.8) * 0.14;
      c.px(x, y, band ? CANVAS_GREEN : CANVAS, { x: s * 0.2 + ripple, y: 0.62, z: 0.78 }, { bias: y === hem ? -1 : 0 });
    }
  }
  // The hem turned under, with a tie loop every so often.
  c.part();
  for (let x = 6; x < 82; x++) {
    const s = (x + 0.5 - CAMP_OX) / 38;
    const band = Math.abs(s) > 0.84 || (Math.abs(s) > 0.7 && Math.abs(s) < 0.76);
    c.px(x, hemAt(x) + 1, band ? CANVAS_GREEN : CANVAS, front(s), { bias: -1 });
    if ((x - 8) % 12 === 0) c.px(x, hemAt(x) + 2, ROPE, sphere(0, -0.3));
  }

  // Herbs drying from the hem either side of Hazel: lavender and yarrow.
  const sw = Math.round(Math.sin(ph) * 0.7);
  herbBunch(c, 29, hemAt(29) + 2, sw, LAVENDER);
  herbBunch(c, 56, hemAt(56) + 2, -sw, YARROW);

  // The lantern: hung on a short chain, swaying, its flame in a glass chimney.
  const lsw = Math.round(Math.sin(ph + 1.3) * 1);
  const lx = CAMP_LANTERN.x + lsw;
  const ltop = hemAt(CAMP_LANTERN.x) + 2;
  c.part();
  c.line(CAMP_LANTERN.x, ltop, lx, ltop + 3, IRON, () => FLAT_N);
  c.part();
  c.shape(ltop + 4, ltop + 5, (y) => (y === ltop + 4 ? [lx - 1, lx + 2] : [lx - 2, lx + 3]), BRASS, (_x, _y, t) => cyl(t, 0.6));
  c.part();
  c.shape(ltop + 6, ltop + 10, () => [lx - 2, lx + 3], GLASS, (_x, _y, t) => cyl(t, 0.1), { bias: -1 });
  const k = flick(frame, 2);
  c.part();
  c.px(lx, ltop + 8, FLAME, FLAT_N, { glow: 0.8 + 0.2 * k });
  c.px(lx, ltop + 9, FLAME, FLAT_N, { glow: 0.9, bias: 2 });
  if (k > 0.8) c.px(lx, ltop + 7, FLAME, FLAT_N, { glow: 0.6, bias: -1 });
  c.spark(lx + 0.5, ltop + 7, [255, 214, 120], 0.5 * k);
  c.part();
  c.px(lx - 2, ltop + 7, GLASS, cyl(-0.8, 0.2), { bias: 2 });
  c.shape(ltop + 11, ltop + 11, () => [lx - 2, lx + 3], BRASS, (_x, _y, t) => cyl(t, 0.3));
  c.part();
  c.px(lx, ltop + 12, BRASS, sphere(0, -0.4), { bias: -1 });
  // Two moths drawn to it, circling out of step.
  for (let m = 0; m < 2; m++) {
    const a = ph * (m ? -1 : 1) + m * 2.4;
    c.spark(lx + 0.5 + Math.cos(a) * (4 + m), ltop + 8 + Math.sin(a) * 2.5, [255, 240, 210], 0.55);
  }
  return c;
}

/**
 * The camp in front of Hazel, frame `f`: the front poles, the baize-covered
 * table with what's on it, the net leaning on the left pole and a creel at
 * the right one's foot.
 */
export function campFront(frame: number): PixelCanvas {
  const c = new PixelCanvas(CAMP_W, CAMP_H);
  const foot = CAMP_OY;
  const T = 46;
  const L = 9;
  const R = 80;

  // The front poles, lashed where the fly's corners meet them.
  for (const [x, seed] of [
    [6.5, 3],
    [82.5, 4],
  ]) {
    birchPole(c, x, AWN_FRONT - 1, foot, 1.6, seed);
    c.part();
    for (let y = AWN_FRONT + 1; y <= AWN_FRONT + 3; y++) c.shape(y, y, () => [x - 2, x + 2], ROPE, (_x, _y, t) => cyl(t, 0.2), { bias: y % 2 ? 0 : -1 });
  }

  // The table's legs under the cloth.
  for (const x of [13, 76]) {
    c.part();
    c.shape(59, foot, () => [x - 1, x + 1], WOOD_DK, (_x, _y, t) => cyl(t, 0.1));
  }

  // The cloth: green baize over the top and hanging down the front, a gold band, tasselled.
  c.part();
  c.shape(T, T + 1, () => [L, R], BAIZE, (px) => top((px - CAMP_OX) / 40));
  c.part();
  for (let x = L; x < R; x++) {
    // It hangs a little lower at the corners, where it falls free.
    const corner = x < L + 3 || x >= R - 3 ? 1 : 0;
    for (let y = T + 2; y <= 58 + corner; y++) {
      const fold = Math.sin((x - L) * 0.7) * 0.22;
      c.px(x, y, BAIZE, { x: fold + (x - CAMP_OX) * 0.006, y: -0.35, z: 0.9 }, { bias: y === T + 2 ? 1 : 0 });
    }
  }
  for (let x = L; x < R; x++) if (Math.sin((x - L) * 0.7) < -0.9) for (let y = T + 4; y <= 58; y++) c.shade(x, y, -1);
  c.part();
  for (let x = L + 1; x < R - 1; x++) {
    c.px(x, T + 3, THREAD, front((x - CAMP_OX) / 40), { bias: x % 2 ? 0 : -1 });
    c.px(x, 57, THREAD, front((x - CAMP_OX) / 40), { bias: x % 2 ? -1 : 0 });
  }
  // Tassels along the hem.
  c.part();
  for (let x = L + 1; x < R - 1; x += 3) {
    c.px(x, 59, THREAD, sphere(0, -0.3));
    c.px(x, 60, THREAD, sphere(0, -0.6), { bias: -1 });
  }
  // The emblem: a butterfly in gold thread in the middle of the drape.
  c.part();
  const ex = CAMP_OX;
  const ey = 53;
  c.ellipse(ex - 2.4, ey - 0.6, 2.1, 1.7, THREAD, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6 - 0.3, -dy * 0.5 - 0.1, 1) });
  c.ellipse(ex + 2.6, ey - 0.6, 2.1, 1.7, THREAD, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6 + 0.3, -dy * 0.5 - 0.1, 1) });
  c.ellipse(ex - 1.6, ey + 1.9, 1.4, 1.2, THREAD, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6 - 0.2, -dy * 0.5 - 0.3, 1), bias: -1 });
  c.ellipse(ex + 1.8, ey + 1.9, 1.4, 1.2, THREAD, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6 + 0.2, -dy * 0.5 - 0.3, 1), bias: -1 });
  c.part();
  for (let y = ey - 2; y <= ey + 2; y++) c.px(ex, y, BAIZE, FLAT_N, { bias: -2 });
  c.px(ex - 1, ey - 3, THREAD, FLAT_N, { bias: -1 });
  c.px(ex + 1, ey - 3, THREAD, FLAT_N, { bias: -1 });

  // The microscope: a brass foot and arm, an iron stage, its tube angled up at the fly.
  const mx = 20;
  c.part();
  c.ellipse(mx + 0.5, T - 0.3, 3, 1.1, BRASS, { normal: (_x, _y, dx) => top(dx) });
  c.part();
  c.capsule(mx + 2, T - 1, mx + 2.4, T - 7, 0.9, 0.8, BRASS);
  c.capsule(mx + 2.4, T - 7, mx + 1.2, T - 9.5, 0.8, 0.8, BRASS);
  c.part();
  c.shape(T - 4, T - 4, () => [mx - 2, mx + 2], IRON, (_x, _y, t) => top(t));
  c.part();
  c.capsule(mx + 0.5, T - 5, mx - 1.2, T - 10.5, 1.1, 1, BRASS);
  c.part();
  c.shape(Math.round(T - 12), Math.round(T - 11), () => [mx - 3, mx], IRON, (_x, _y, t) => cyl(t, 0.5));
  c.px(mx - 1, T - 3, IRON, sphere(0, -0.2), { bias: -1 });

  // The field journal lying open: a sketch on the left page, a painted butterfly on the right.
  const jx0 = 28;
  const jx1 = 41;
  c.part();
  c.shape(T - 1, T - 1, () => [jx0 - 0.5, jx1 + 0.5], LEATHER, (_x, _y, t) => front(t));
  c.part();
  c.shape(T - 4, T - 2, (y) => [jx0 + (y === T - 4 ? 0.5 : 0), jx1 - (y === T - 4 ? 0.5 : 0)], PAPER, (px) => top((px - (jx0 + jx1) / 2) / 10), { bias: 1 });
  for (let y = T - 4; y <= T - 2; y++) c.shade(34, y, -2);
  c.shade(35, T - 3, -1);
  // Pencil lines, a sketched leaf.
  c.shade(29, T - 3, -2);
  c.shade(30, T - 3, -2);
  c.shade(31, T - 4, -2);
  c.shade(32, T - 2, -1);
  c.shade(30, T - 2, -1);
  c.part();
  c.px(37, T - 3, WING_BLUE, FLAT_N, { bias: 1 });
  c.px(39, T - 3, WING_BLUE, FLAT_N, { bias: 1 });
  c.px(38, T - 3, EYE, FLAT_N);
  c.px(38, T - 4, EYE, FLAT_N);
  c.shade(37, T - 2, -1);
  c.shade(38, T - 2, -1);
  c.shade(39, T - 2, -1);

  // Three jars of glowing critters.
  glowJar(c, 54, T - 1, 4, 6, 0, frame, 4);
  glowJar(c, 59.5, T - 1, 5, 8, 1, frame, 1);
  glowJar(c, 65, T - 1, 3, 5, 2, frame, 3);

  // A potted fern at the table's end.
  const fx = 72.5;
  c.part();
  c.shape(T - 6, T - 1, (y) => {
    const u = (y - (T - 6)) / 5;
    return [fx - 3 + u * 0.8, fx + 3 - u * 0.8];
  }, CLAY, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.shape(T - 7, T - 7, () => [fx - 3.6, fx + 3.6], CLAY, (_x, _y, t) => cyl(t, 0.6));
  const fronds: [number, number, number][] = [
    [-7, -9, 0],
    [-3, -13, 1],
    [2, -14, 2],
    [6, -10, 3],
    [-6, -4, 4],
    [7, -5, 5],
  ];
  for (const [dx, dy, seed] of fronds) {
    c.part();
    const bx = fx + dx * 0.15;
    const by = T - 8;
    const n = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      // Each frond arches out and droops a little at its tip.
      const x = bx + dx * t;
      const y = by + dy * t + t * t * 2.5;
      c.px(x, y, LEAF, sphere(dx * 0.1, 0.5 - t * 0.4), { bias: seed % 2 ? 0 : 1 });
      if (i > 0 && i < n && i % 2 === 0) {
        const side = dx > 0 ? 1 : -1;
        c.px(x + side, y + 1, LEAF, sphere(side * 0.5, 0.2), { bias: -1 });
        c.px(x - side, y - (Math.abs(dy) > 6 ? 0 : 1), LEAF, sphere(-side * 0.5, 0.6));
      }
    }
  }

  // The butterfly net leaning on the left pole: an ash handle, a wire hoop, a gauze bag drooping.
  c.part();
  c.line(2, foot - 1, 10, 30, WOOD, () => cyl(0.3, 0.2));
  c.part();
  const hx = 11;
  const hy = 25;
  // The bag hangs from the hoop and droops, lighter where the light comes through.
  for (let y = hy; y <= hy + 11; y++) {
    const u = (y - hy) / 11;
    const hw = 4.2 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - u * 0.2);
    const sx = hx - 1 - u * 2.5;
    for (let x = Math.round(sx - hw); x < Math.round(sx + hw); x++) {
      const edge = x === Math.round(sx - hw) || x === Math.round(sx + hw) - 1;
      if (!edge && (x + y) % 2 === 1) continue;
      c.px(x, y, GAUZE, sphere((x + 0.5 - sx) / (hw + 0.5), 0.2 - u * 0.4), { bias: edge ? -1 : 0 });
    }
  }
  c.part();
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    c.px(hx + Math.cos(t) * 4.4, hy + Math.sin(t) * 2, IRON, sphere(Math.cos(t), -Math.sin(t) + 0.3), { bias: Math.sin(t) < 0 ? 1 : 0 });
  }

  // A wicker creel at the right pole's foot, its lid strapped down.
  const kx = 83.5;
  c.part();
  c.shape(foot - 8, foot, (y) => (y === foot ? [kx - 3.5, kx + 3.5] : [kx - 4, kx + 4]), WICKER, (px, py, t) => cyl(t + (((px + py * 2) & 3) === 0 ? -0.2 : 0.1), 0.1));
  for (let y = foot - 7; y <= foot; y++) for (let x = Math.round(kx - 4); x < kx + 4; x++) if (((x + y * 2) & 3) === 0) c.shade(x, y, -1);
  c.part();
  c.shape(foot - 9, foot - 9, () => [kx - 4.5, kx + 4.5], WICKER, (_x, _y, t) => top(t), { bias: 1 });
  c.part();
  for (let y = foot - 9; y <= foot - 5; y++) c.px(kx, y, LEATHER, cyl(0, 0.2), { bias: y === foot - 9 ? 1 : 0 });
  c.px(kx, foot - 5, BRASS, sphere(0, 0.2), { bias: 1 });
  return c;
}

// ---------------------------------------------------------------- Hazel

/** How far the magnifying glass has come up to her eye, frame by frame. */
const PEER = [0, 0, 0.5, 1, 1, 0.5];
/** The butterfly on her hat opening and closing its wings. */
const WINGS = [1, 1, 0.5, 0, 0.5, 1];

/**
 * Hazel the Naturalist, frame `f`: she breathes, holds up a jar with a
 * firefly glowing in it, and brings her magnifying glass up to peer at the
 * player, her eye swimming huge in the lens; a butterfly on her hat brim
 * opens and closes its wings.
 */
export function hazel(frame: number): PixelCanvas {
  const c = new PixelCanvas(HAZEL_W, HAZEL_H);
  const cx = HAZEL_OX;
  const ph = (frame / HAZEL_FRAMES) * Math.PI * 2;
  const U = Math.round(Math.sin(ph) * 0.5 * 2) / 2;
  const hdy = 16.5 + U;
  const by = 10.5 + U;
  const BRIM_RX = 9.6;
  const BRIM_RY = 2.5;

  // Her hair, chestnut going silver, a loose bun showing either side under the brim.
  c.part();
  for (const s of [-1, 1]) c.ellipse(cx + 0.5 + s * 3.6, 15.8 + U, 1.8, 2.6, HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.5, -dy * 0.5, 1), bias: 1 });

  // Boots and trousers, the coat's skirts over them.
  for (const s of [-1, 1]) {
    c.part();
    c.ellipse(cx + s * 2.2 + (s > 0 ? 0.5 : 0), 35, 2, 1.1, BOOT, { flatten: 0.8 });
    c.part();
    c.capsule(cx + s * 2 + 0.5, 30, cx + s * 2 + 0.5, 33.5, 1.4, 1.3, TROUSERS);
  }
  c.part();
  c.shape(26 + U, 31, (y) => {
    const u = (y - 26 - U) / (5 - U);
    const hw = 5 + u * 1.4;
    return [cx + 0.5 - hw, cx + 0.5 + hw];
  }, COAT, (_x, y, t) => sphere(t * 0.9, 0.1 - (y - 26) * 0.03, 1));
  // The coat's vent up the middle.
  for (let y = 28; y <= 31; y++) c.shade(cx, y, -2);

  // The coat's body, lapels open on a cream shirt, pocket flaps and brass buttons.
  c.part();
  c.shape(19.5 + U, 26 + U, (y) => {
    const hw = 5 - (y - 19.5 - U) * 0.05;
    return [cx + 0.5 - hw, cx + 0.5 + hw];
  }, COAT, (_x, y, t) => sphere(t * 0.9, (22 - y) / 8, 1));
  c.part();
  c.shape(Math.round(20 + U), Math.round(22 + U), (y) => {
    const hw = 1.8 - (y - 20 - U) * 0.6;
    return hw > 0.2 ? [cx + 0.5 - hw, cx + 0.5 + hw] : null;
  }, SHIRT, (_x, _y, t) => sphere(t * 0.5, 0.3, 1));
  for (const s of [-1, 1]) {
    c.shade(cx + s * 3 + (s > 0 ? 1 : 0), 25 + U, -2);
    c.shade(cx + s * 2 + (s > 0 ? 1 : 0), 25 + U, -2);
    c.shade(cx + s * 3 + (s > 0 ? 1 : 0), 24 + U, 1);
    c.shade(cx + s * 2 + (s > 0 ? 1 : 0), 24 + U, 1);
  }
  c.part();
  for (const y of [23, 25]) c.px(cx, y + U, BRASS, sphere(0, 0.3), { bias: 1 });
  // The rust neckerchief, its knot and a tail.
  c.part();
  c.shape(Math.round(20 + U), Math.round(20 + U), () => [cx - 2, cx + 3], SCARF, (_x, _y, t) => cyl(t, 0.4));
  c.px(cx + 1, 20 + U, SCARF, sphere(0.3, 0), { bias: 1 });
  c.px(cx + 2, 21 + U, SCARF, sphere(0.5, -0.3));
  c.px(cx + 2, 22 + U, SCARF, sphere(0.5, -0.5), { bias: -1 });
  // The satchel strap across her from the left shoulder, the bag at her right hip.
  c.part();
  c.line(cx - 4, 19.5 + U, cx + 4, 26.5 + U, LEATHER, () => cyl(0.1, 0.4));
  c.part();
  c.shape(Math.round(26 + U), Math.round(29 + U), () => [cx + 3, cx + 7], LEATHER, (_x, y, t) => (y === Math.round(26 + U) ? top(t) : front(t)));
  c.shade(cx + 3, 27 + U, -1);
  c.px(cx + 5, 27 + U, BRASS, sphere(0.2, 0.3), { bias: 1 });

  // Her left arm (our left) crooked up, holding a jar with a firefly glowing in it.
  const jx = cx - 5;
  const jy = 23 + U;
  c.part();
  c.capsule(cx - 4.6, 20.5 + U, cx - 6.4, 24 + U, 1.6, 1.4, COAT, { bias: -1 });
  c.part();
  c.capsule(cx - 6.4, 24 + U, jx - 0.5, jy + 3, 1.4, 1.2, COAT);
  const k = flick(frame, 1);
  c.part();
  c.shape(Math.round(jy - 2), Math.round(jy + 1), () => [jx - 1.5, jx + 1.5], GLASS, (_x, _y, t) => cyl(t, 0.1), { bias: -1 });
  c.part();
  c.px(jx - 1, jy, GLOWS[0].m, FLAT_N, { glow: 0.6 + 0.4 * k, bias: 2 });
  c.px(jx, jy, GLOWS[0].m, FLAT_N, { glow: 0.4 + 0.3 * k, bias: 1 });
  c.px(jx - 1, jy - 1, GLOWS[0].m, FLAT_N, { glow: 0.3 * k });
  c.spark(jx - 0.5, jy - 2, [216, 255, 90], 0.45 * k);
  c.part();
  c.shape(Math.round(jy - 3), Math.round(jy - 3), () => [jx - 1.5, jx + 1.5], CORK, (_x, _y, t) => cyl(t, 0.6));
  c.part();
  c.ellipse(jx - 0.5, jy + 2.3, 1.5, 1.2, SKIN);
  c.px(jx + 1, jy + 1.5, SKIN, sphere(0.5, 0.3), { bias: -1 });

  // Her head: warm and weathered, rosy-cheeked, a smile, round spectacles.
  c.part();
  // Soft, round shading: a friendly face rather than a sculpted one.
  c.ellipse(cx + 0.5, hdy, 3.5, 3.6, SKIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.5, dy * 0.5, 1), bias: 1 });
  c.part();
  c.px(cx - 2, hdy + 1, ROSE, FLAT_N, { bias: 1 });
  c.px(cx + 3, hdy + 1, ROSE, FLAT_N, { bias: 1 });
  // A smile, a pointed nose catching the light.
  c.shade(cx, hdy + 2, -2);
  c.shade(cx + 1, hdy + 2, -2);
  c.shade(cx - 1, hdy + 1.6, -1);
  c.shade(cx + 2, hdy + 1.6, -1);
  c.shade(cx + 1, hdy + 0.8, 1);
  // The spectacles: two glinting lenses on a brass bridge, rims above like brows.
  c.part();
  const glint = frame % 3 === 0;
  for (const ex of [cx - 1, cx + 2]) {
    c.px(ex, hdy - 0.5, LENS, FLAT_N, { bias: glint ? 3 : 1 });
    c.px(ex, hdy - 1.5, BRASS, sphere(0, 0.5), { bias: 1 });
  }
  c.px(cx, hdy - 0.5, BRASS, sphere(0, 0.3));
  c.px(cx + 1, hdy - 0.5, BRASS, sphere(0, 0.3), { bias: -1 });
  c.px(cx - 2, hdy - 0.5, BRASS, sphere(-0.6, 0.3), { bias: -1 });
  c.px(cx + 3, hdy - 0.5, BRASS, sphere(0.6, 0.3), { bias: -1 });
  if (glint) c.spark(cx - 0.5, hdy - 1, [255, 255, 240], 0.5);
  // Wisps of hair escaping over her ears.
  c.part();
  c.px(cx - 3, hdy - 2, HAIR, sphere(-0.6, 0.4));
  c.px(cx - 3, hdy - 1, HAIR, sphere(-0.7, 0.1), { bias: -1 });
  c.px(cx + 4, hdy - 2, HAIR, sphere(0.6, 0.4), { bias: -1 });
  c.px(cx + 4, hdy - 1, HAIR, sphere(0.7, 0.1), { bias: -2 });

  // The sun hat: a wide straw brim, a low round crown with a green band, a pheasant feather.
  const tiltAt = (x: number) => (x - cx) * -0.04;
  c.part();
  for (let y = Math.floor(by - BRIM_RY - 1); y <= by + BRIM_RY + 1; y++) {
    for (let x = cx - 11; x <= cx + 11; x++) {
      const dx = (x + 0.5 - cx - 0.5) / BRIM_RX;
      const dy = (y + 0.5 - by - tiltAt(x)) / BRIM_RY;
      const r = dx * dx + dy * dy;
      if (r > 1) continue;
      // The brim's weave: rings of plait round the crown, the rim rolled a little.
      const ring = Math.floor(Math.sqrt(r) * 4);
      const rim = r > 0.72 ? 0.35 : 0;
      c.px(x, y, STRAW, { x: dx * rim, y: 0.72 - dy * rim, z: 0.7 }, { bias: (ring + ((x + y) & 1)) % 2 === 0 ? 0 : -1 + (r > 0.72 && dy > 0.2 ? 1 : 0) });
    }
  }
  c.part();
  c.shape(Math.round(by - 5), Math.round(by - 0.5), (y) => {
    const u = (y - (by - 5)) / 4.5;
    const hw = 3.2 + Math.sqrt(Math.max(0, u)) * 1.6;
    return [cx + 0.5 - hw, cx + 0.5 + hw];
  }, STRAW, (_x, y, t) => sphere(t * 0.9, (by - 2.5 - y) / 3.2, 1));
  for (let y = Math.round(by - 5); y <= by - 3; y++) for (let x = cx - 4; x <= cx + 5; x++) if (((x + y) & 1) === 0) c.shade(x, y, -1);
  c.part();
  c.shape(Math.round(by - 1.5), Math.round(by - 0.5), () => [cx - 4.4, cx + 5.4], BAND, (_x, _y, t) => cyl(t, 0.2));
  // The feather, tucked in the band on our right and sweeping back and up.
  c.part();
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    const x = cx + 4.5 + t * 3.2;
    const y = by - 1.5 - t * 6 + t * t * 1.5;
    c.px(x, y, FEATHER, sphere(0.4, 0.5), { bias: i % 2 ? -1 : 1 });
    if (i > 1 && i < 7) c.px(x - 1, y, FEATHER, sphere(-0.2, 0.6), { bias: i % 2 ? 0 : -2 });
  }
  // A little blue butterfly resting on the brim, opening and closing its wings.
  butterfly(c, cx - 6, Math.round(by - 1 + tiltAt(cx - 6)), WING_BLUE, WINGS[frame % WINGS.length], 0.2);
  // It sits in the sun on top of everything: lift its wings a step so they read against the straw.
  for (let y = Math.floor(by) - 5; y <= by + 1; y++) for (let x = cx - 9; x <= cx - 3; x++) if (c.materialAt(x, y) === WING_BLUE) c.shade(x, y, 1);

  // Her right arm (our right) with the magnifying glass: held out at her side, then up to her eye.
  const p = PEER[frame % PEER.length];
  const lx = cx + 8.5 + (cx + 2 - (cx + 8.5)) * p;
  const ly = 19 + (hdy - 0.5 - 19) * p + U;
  const hx = lx + 1.5 - p * 0.5;
  const hy = ly + 4;
  c.part();
  c.capsule(cx + 5.2, 20.5 + U, cx + 7.4, 23.5 + U, 1.6, 1.4, COAT, { bias: -1 });
  c.part();
  c.capsule(cx + 7.4, 23.5 + U, hx + 0.5, hy + 1, 1.4, 1.2, COAT, { bias: p > 0.5 ? -1 : 0 });
  c.part();
  c.line(hx, hy, lx + 0.5, ly + 2.5, WOOD, () => cyl(0.2, 0.3));
  c.part();
  c.ellipse(hx + 0.5, hy + 1, 1.4, 1.3, SKIN);
  // The lens: a brass ring round glass; up at her eye, the eye behind it swims up huge.
  c.part();
  c.ellipse(lx + 0.5, ly, 2.6, 2.6, BRASS);
  c.part();
  c.ellipse(lx + 0.5, ly, 1.7, 1.7, GLASS, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, -dy * 0.6, 1), bias: 1 });
  if (p === 1) {
    c.part();
    c.px(lx, ly, EYE, FLAT_N);
    c.px(lx + 1, ly, EYE, FLAT_N);
    c.px(lx, ly - 1, EYE, FLAT_N);
    c.px(lx + 1, ly - 1, LENS, FLAT_N, { bias: 3 });
  } else {
    c.px(lx - 0.5, ly - 1, GLASS, sphere(-0.5, 0.6), { bias: 3 });
  }
  return c;
}

// ---------------------------------------------------------------- Registration

/**
 * Register the camp and Hazel once: 'nt_camp_back', 'nt_camp_front' and
 * 'nt_hazel', each with frames f<n> and animations <key>_loop and
 * <key>_e_loop for their glow.
 */
export function registerNaturalist(scene: Phaser.Scene): void {
  if (scene.textures.exists('nt_hazel')) return;
  const sheet = (key: string, n: number, w: number, h: number, draw: (f: number) => PixelCanvas, fps: number) => {
    const frames = Array.from({ length: n }, (_, f) => ({ name: `f${f}`, r: draw(f).render() }));
    registerAtlas(scene, key, packAtlas(frames, w, h, n), w, h);
    for (const [anim, tex] of [
      [`${key}_loop`, key],
      [`${key}_e_loop`, `${key}_e`],
    ]) {
      if (scene.anims.exists(anim)) continue;
      scene.anims.create({ key: anim, frames: scene.anims.generateFrameNames(tex, { prefix: 'f', start: 0, end: n - 1 }), frameRate: fps, repeat: -1 });
    }
  };
  sheet('nt_camp_back', CAMP_FRAMES, CAMP_W, CAMP_H, campBack, 5);
  sheet('nt_camp_front', CAMP_FRAMES, CAMP_W, CAMP_H, campFront, 5);
  sheet('nt_hazel', HAZEL_FRAMES, HAZEL_W, HAZEL_H, hazel, 3);
}
