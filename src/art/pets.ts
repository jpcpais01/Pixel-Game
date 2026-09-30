// The companions: twenty small creatures that follow the hero, drawn with the
// same lit pixel engine as everything else. Each has four frames that loop
// (breathing, blinking, a wing beat, a flicker of flame), facing right; the
// world mirrors them to face left. Frames are named `<id>_<f>` on one sheet.

import { FLAT, PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { HALLOWS_PET_ART } from './hallowsPets';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const PET_W = 24;
export const PET_H = 24;
/** Feet in the frame: where it stands (or the spot on the ground under a flyer). */
export const PET_OX = 12;
export const PET_OY = 22;
export const PET_FRAMES = 4;

const EYE: Material = { ramp: ramp('#07060c', '#141220'), outline: hex('#030306'), noAO: true };
const WHITE: Material = { ramp: ramp('#d8dcef', '#ffffff'), outline: hex('#2a2a3a'), noAO: true, noOutline: true };
const BLUSH: Material = { ramp: ramp('#e0708a', '#ff9ab0'), outline: hex('#401420'), noAO: true, noOutline: true };

/** Two shiny eyes (a dark pupil with a glint), `gap` apart around x, blinking on frame `blinkAt`. */
function eyes(c: PixelCanvas, pts: [number, number][], f: number, blinkAt = 2): void {
  c.part();
  for (const [x, y] of pts) {
    if (f === blinkAt) {
      c.px(x, y + 1, EYE, { x: 0, y: -0.2, z: 1 });
      continue;
    }
    c.px(x, y, EYE, { x: 0, y: 0, z: 1 });
    c.px(x, y + 1, EYE, { x: 0, y: 0, z: 1 });
    c.px(x, y, WHITE, { x: 0, y: 0.3, z: 1 });
  }
}

// ---------------------------------------------------------------- Jellybean, the slime

const GEL: Material = { ramp: ramp('#1a5a2a', '#2e8a3a', '#4ec85a', '#8ef08a', '#d8ffc8'), outline: hex('#0a2410'), outlineLit: hex('#12361a'), emissive: 0.12, shine: true };
const GEL_CORE: Material = { ramp: ramp('#58c84a', '#a8f070'), outline: hex('#1a4a1a'), emissive: 0.4, noOutline: true };

function slime(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const squash = [0, 0.6, 1, 0.4][f];
  const rx = 7 + squash;
  const ry = 5.6 - squash;
  const cy = PET_OY - ry;
  c.part();
  c.ellipse(PET_OX, cy, rx, ry, GEL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  // A seed of light floating inside it.
  c.part();
  c.ellipse(PET_OX - 2, cy + 1.5, 1.4, 1.2, GEL_CORE);
  // A glossy highlight on its crown.
  c.part();
  c.px(PET_OX - 4, cy - 3, WHITE, { x: -0.3, y: 0.6, z: 0.8 });
  c.px(PET_OX - 3, cy - 4, WHITE, { x: -0.3, y: 0.6, z: 0.8 });
  eyes(c, [[PET_OX + 1, cy - 1], [PET_OX + 4, cy - 1]], f);
  c.part();
  c.px(PET_OX + 3, cy + 1, BLUSH);
  return c;
}

// ---------------------------------------------------------------- The moss bunny

const FUR: Material = { ramp: ramp('#3a4232', '#5a6a4a', '#7e9068', '#a8b88e', '#d8e2c0'), outline: hex('#141a0e'), outlineLit: hex('#222a18') };
const EAR_PINK: Material = { ramp: ramp('#b86a78', '#e8a0b0'), outline: hex('#3a1820'), noAO: true };
const PUFF: Material = { ramp: ramp('#c8ccc0', '#ffffff'), outline: hex('#3a3e34') };
const SPROUT: Material = { ramp: ramp('#3a7a1e', '#6ab832', '#b8f06a'), outline: hex('#122a08') };

function bunny(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const breathe = f === 1 || f === 2 ? 0.3 : 0;
  const twitch = f === 3 ? 1 : 0;
  c.part();
  c.ellipse(6, 16, 2, 1.8, PUFF);
  c.part();
  c.ellipse(11, 17 - breathe, 5.4, 4.2 + breathe, FUR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.25, 1) });
  c.part();
  // The ears, the far one a shade behind; the near one twitching.
  c.capsule(14.5, 11, 14 - twitch, 3.5, 1.3, 0.9, FUR, { bias: -1 });
  c.capsule(16, 11, 17.5 + twitch * 0.5, 4, 1.4, 1, FUR);
  c.part();
  c.capsule(16.2, 10, 17.3 + twitch * 0.5, 5.5, 0.5, 0.35, EAR_PINK);
  c.part();
  c.ellipse(16, 12.5, 3.6, 3.2, FUR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  // A little sprout of moss on its head.
  c.part();
  c.px(15, 8.5, SPROUT, cyl(0, 0.3));
  c.px(14, 7.5, SPROUT, cyl(-0.5, 0.4), { bias: 1 });
  c.px(16, 7.5, SPROUT, cyl(0.5, 0.4), { bias: 1 });
  eyes(c, [[17, 11]], f, 2);
  c.part();
  c.px(19, 13, EAR_PINK, { x: 0.3, y: 0, z: 0.9 });
  c.px(8, 20, FUR, cyl(0, -0.2), { bias: -1 });
  c.px(14, 20, FUR, cyl(0, -0.2), { bias: -1 });
  return c;
}

// ---------------------------------------------------------------- Pebble, the little golem

const STONE: Material = { ramp: ramp('#26242c', '#3e3c48', '#5c5a68', '#86849a', '#b8b6cc'), outline: hex('#0c0b10'), outlineLit: hex('#1a1920') };
const RUNE: Material = { ramp: ramp('#2a8ab8', '#6fe4ff', '#e6ffff'), outline: hex('#08202e'), emissive: 1, noAO: true };
const MOSS_TOP: Material = { ramp: ramp('#2a4a1a', '#4a7a2a', '#7ab04a'), outline: hex('#0e1a08') };

function pebble(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const step = f % 2;
  c.part();
  c.capsule(8.5, 17, 8.5, 20.5 - step * 0.5, 1.6, 1.5, STONE, { bias: -1 });
  c.capsule(14.5, 17, 14.5, 20.5 - (1 - step) * 0.5, 1.6, 1.5, STONE);
  c.part();
  c.ellipse(11.5, 14.5, 6, 4.8, STONE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.shade(9, 13, -1);
  c.shade(14, 16, -1);
  c.part();
  c.capsule(5.5, 13, 5, 17.5, 1.5, 1.3, STONE, { bias: -1 });
  c.capsule(17.5, 13, 18.5, 17.5, 1.5, 1.3, STONE);
  c.part();
  c.ellipse(12.5, 8.5, 3.8, 3.2, STONE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 1) });
  c.part();
  c.shape(5, 6, (y) => (y === 5 ? [10.5, 14] : [9.5, 15.5]), MOSS_TOP, (_x, _y, t) => cyl(t, 0.5));
  // A single rune for an eye, breathing with light; a rune on its chest.
  c.part();
  c.px(14, 8, RUNE, { x: 0, y: 0, z: 1 }, { glow: 0.7 + [0, 0.15, 0.3, 0.15][f] });
  c.px(11, 14, RUNE, { x: 0, y: 0, z: 1 }, { glow: 0.6 });
  c.px(11, 15, RUNE, { x: 0, y: 0, z: 1 }, { glow: 0.4 });
  c.px(12, 14, RUNE, { x: 0, y: 0, z: 1 }, { glow: 0.4 });
  c.spark(14, 8, hex('#9ff6ff'), 0.6);
  return c;
}

// ---------------------------------------------------------------- The lantern owl

const OWL: Material = { ramp: ramp('#2a1a12', '#4a3020', '#6e4a30', '#9a7048', '#c8a070'), outline: hex('#120a06'), outlineLit: hex('#1e140c') };
const OWL_FACE: Material = { ramp: ramp('#8a7058', '#c8a888', '#eed8b8'), outline: hex('#2a1e14') };
const OWL_EYE: Material = { ramp: ramp('#c87a18', '#ffc040', '#fff0a0'), outline: hex('#2a1604'), emissive: 0.5, noAO: true };
const BEAK: Material = { ramp: ramp('#8a6a2a', '#d8b050'), outline: hex('#2a1e08') };
const LANTERN: Material = { ramp: ramp('#2a1e14', '#5a4028', '#8a6a3a'), outline: hex('#100a06') };
const FLAME: Material = { ramp: ramp('#ff8a2a', '#ffd070', '#fff4d0'), outline: hex('#4a1a04'), emissive: 1, noAO: true };

function owl(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  // A flyer: drawn up off the ground, its lantern hanging under it.
  const lift = [0, -1, 0, 1][f];
  const cy = 9 + lift;
  const flap = [0, 1, 2, 1][f];
  c.part();
  c.capsule(6, cy + 2, 2.5, cy - 1 + flap * 2, 1.8, 1, OWL, { bias: -1 });
  c.capsule(17, cy + 2, 20.5, cy - 1 + flap * 2, 1.8, 1, OWL);
  c.part();
  c.ellipse(11.5, cy + 2.5, 5, 5.4, OWL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.ellipse(11.5, cy + 0.5, 4, 3.2, OWL_FACE);
  // Tufts over the eyes.
  c.part();
  c.px(8, cy - 3, OWL, cyl(-0.5, 0.5), { bias: 1 });
  c.px(15, cy - 3, OWL, cyl(0.5, 0.5), { bias: 1 });
  c.part();
  if (f === 2) {
    c.shape(Math.round(cy), Math.round(cy), () => [9, 11], OWL_FACE, () => ({ x: 0, y: -0.4, z: 0.9 }), { bias: -1 });
    c.shape(Math.round(cy), Math.round(cy), () => [12, 14], OWL_FACE, () => ({ x: 0, y: -0.4, z: 0.9 }), { bias: -1 });
  } else {
    c.ellipse(10, cy, 1.4, 1.4, OWL_EYE, { normal: () => ({ x: 0, y: 0, z: 1 }) });
    c.ellipse(13, cy, 1.4, 1.4, OWL_EYE, { normal: () => ({ x: 0, y: 0, z: 1 }) });
    c.px(10, cy, EYE);
    c.px(13, cy, EYE);
  }
  c.part();
  c.px(11.5, cy + 2, BEAK, { x: 0, y: 0.2, z: 0.9 });
  // The lantern swinging from its feet.
  const sway = [0, 0.5, 0, -0.5][f];
  c.part();
  c.line(11.5, cy + 7, 11.5 + sway, cy + 9, LANTERN);
  c.ellipse(11.5 + sway, cy + 11, 1.8, 2, LANTERN, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 1) });
  c.part();
  c.px(11.5 + sway, cy + 11, FLAME, { x: 0, y: 0, z: 1 });
  c.px(11.5 + sway, cy + 10, FLAME, { x: 0, y: 0.3, z: 1 });
  c.spark(11.5 + sway, cy + 10.5, hex('#ffd070'), 0.8);
  return c;
}

// ---------------------------------------------------------------- The spirit fox

const FOX: Material = { ramp: ramp('#1a2a5a', '#2a4a90', '#4a7ad0', '#8ab8ff', '#dcecff'), outline: hex('#08102a'), outlineLit: hex('#101c40'), emissive: 0.3 };
const FOX_LIGHT: Material = { ramp: ramp('#8ab8ff', '#dcecff', '#ffffff'), outline: hex('#1a2a5a'), emissive: 0.6 };
const FOXFIRE = hex('#8ad8ff');

function fox(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const bob = [0, -0.5, -1, -0.5][f];
  // Its tail, a great wisp of foxfire, flicking.
  const flick = [0, 1, 2, 1][f];
  c.part();
  c.capsule(7, 15 + bob, 3, 11 - flick * 0.5 + bob, 2.4, 2.8, FOX, { bias: -1 });
  c.capsule(3, 11 - flick * 0.5 + bob, 4.5, 6 - flick + bob, 2.8, 1.2, FOX_LIGHT);
  for (let i = 0; i < 4; i++) c.spark(3 + ((i * 7 + f) % 4) - 1, 5 - flick + bob - i, FOXFIRE, 0.6 - i * 0.12);
  c.part();
  c.capsule(8, 16 + bob, 14, 15 + bob, 3, 2.7, FOX);
  c.part();
  c.capsule(8.5, 17.5 + bob, 8.5, 21, 1, 0.8, FOX, { bias: -1 });
  c.capsule(13.5, 17 + bob, 13.5, 21, 1, 0.8, FOX);
  c.part();
  c.ellipse(16, 11.5 + bob, 3.6, 3.1, FOX, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  c.part();
  c.capsule(18, 12.5 + bob, 20.5, 13 + bob, 1.3, 0.8, FOX_LIGHT);
  c.part();
  // Tall ears.
  c.capsule(14.5, 9 + bob, 13.5, 5 + bob, 1.2, 0.5, FOX, { bias: -1 });
  c.capsule(16.5, 9 + bob, 17, 4.5 + bob, 1.3, 0.5, FOX);
  eyes(c, [[17, 10.5 + bob]], f, 3);
  c.spark(16, 7 + bob, FOXFIRE, 0.4);
  return c;
}

// ---------------------------------------------------------------- Starwisp

const STARLIGHT: Material = { ramp: ramp('#c89030', '#ffd060', '#fff0a8', '#ffffff'), outline: hex('#4a300c'), emissive: 0.85, shine: true, noAO: true };
const STAR_GOLD = hex('#ffe08a');
const STAR_ROSE = hex('#ff9ad8');

function wisp(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const cy = 10 + [0, -1, 0, 1][f];
  // Four points of a star turning round it.
  const a0 = (f / PET_FRAMES) * (Math.PI / 2);
  for (let k = 0; k < 4; k++) {
    const a = a0 + (k * Math.PI) / 2;
    for (let r = 5; r <= 7; r++) c.spark(PET_OX + Math.cos(a) * r, cy + Math.sin(a) * r, r === 7 ? STAR_ROSE : STAR_GOLD, 0.9 - (r - 5) * 0.25);
  }
  c.part();
  c.ellipse(PET_OX, cy, 4.4, 4.4, STARLIGHT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.7 - 0.2, 1) });
  eyes(c, [[PET_OX - 1.5, cy - 1], [PET_OX + 1.5, cy - 1]], f, 1);
  c.part();
  c.px(PET_OX - 3, cy + 1, BLUSH);
  c.px(PET_OX + 2.5, cy + 1, BLUSH);
  // A trail of sparkles falling away beneath it.
  for (let i = 0; i < 4; i++) c.spark(PET_OX + ((i + f) % 3) - 1, cy + 6 + i * 2, i % 2 ? STAR_ROSE : STAR_GOLD, 0.7 - i * 0.14);
  return c;
}

// ---------------------------------------------------------------- The amethyst wyrmling

const WYRM: Material = { ramp: ramp('#1e1236', '#34205a', '#503486', '#7a56b8', '#b090e8'), outline: hex('#0a0616'), outlineLit: hex('#160e2a'), shine: true };
const WYRM_BELLY: Material = { ramp: ramp('#8a70b0', '#c8b0e8', '#f0e4ff'), outline: hex('#2a1a40') };
const MEMBRANE: Material = { ramp: ramp('#3a1a5a', '#6a3a9a', '#a070d8'), outline: hex('#140a22'), emissive: 0.15 };
const AMETHYST: Material = { ramp: ramp('#8a3ae0', '#c890ff', '#f4e4ff'), outline: hex('#20083a'), emissive: 0.8, shine: true, noAO: true };
const HORN_BONE: Material = { ramp: ramp('#8a8070', '#d8d0c0'), outline: hex('#2a261e') };

function wyrm(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const cy = 12 + [0, -1, -1, 0][f];
  const beat = [0, 1, 2, 1][f];
  // The far wing, then the body, the near wing over it.
  c.part();
  c.shape(Math.round(cy - 8 + beat * 2), Math.round(cy), (y) => {
    const u = (y - (cy - 8 + beat * 2)) / (8 - beat * 2 || 1);
    return [8 + u * 1, 11 - u * 0.5];
  }, MEMBRANE, (_x, _y, t) => cyl(t, 0.5), { bias: -1 });
  c.part();
  // Tail curling behind.
  c.capsule(8, cy + 3, 4, cy + 4, 1.8, 1.2, WYRM, { bias: -1 });
  c.capsule(4, cy + 4, 2.5, cy + 1.5, 1.2, 0.6, WYRM, { bias: -1 });
  c.part();
  c.ellipse(10.5, cy + 3, 4.6, 3.4, WYRM, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.ellipse(11, cy + 4.5, 3, 1.6, WYRM_BELLY);
  // Crystal spikes along its back.
  c.part();
  for (const [x, y, h] of [[8, cy, 2], [10.5, cy - 0.5, 2.5], [13, cy, 2]] as const) c.capsule(x, y, x - 0.5, y - h, 0.8, 0.3, AMETHYST);
  c.part();
  c.capsule(13.5, cy + 1.5, 16, cy - 2, 1.8, 1.5, WYRM);
  c.part();
  c.ellipse(17.5, cy - 3, 3, 2.5, WYRM, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  c.capsule(18.5, cy - 2.2, 21, cy - 1.8, 1.4, 0.9, WYRM);
  c.part();
  c.capsule(16.5, cy - 5, 15, cy - 8, 0.6, 0.3, HORN_BONE);
  c.capsule(18, cy - 5, 18, cy - 8.5, 0.6, 0.3, HORN_BONE);
  eyes(c, [[18.5, cy - 3.5]], f, 3);
  c.part();
  c.shape(Math.round(cy - 9 + beat * 2.5), Math.round(cy + 1), (y) => {
    const u = (y - (cy - 9 + beat * 2.5)) / (10 - beat * 2.5 || 1);
    return [10 + u * 2, 15.5 - u * 3];
  }, MEMBRANE, (_x, _y, t) => cyl(t * 0.8, 0.5));
  c.part();
  c.capsule(15, cy + 1, 11, cy - 9 + beat * 2.5, 0.7, 0.4, WYRM, { bias: 1 });
  c.part();
  c.capsule(9, cy + 6, 9, cy + 8, 0.9, 0.7, WYRM, { bias: -1 });
  c.capsule(12.5, cy + 6, 12.5, cy + 8, 0.9, 0.7, WYRM);
  return c;
}

// ---------------------------------------------------------------- The phoenix chick

const PLUME: Material = { ramp: ramp('#6a1208', '#b8301a', '#e8602a', '#ffa040', '#ffe0a0'), outline: hex('#2a0804'), outlineLit: hex('#4a1006'), emissive: 0.12 };
const PLUME_HOT: Material = { ramp: ramp('#ffa040', '#ffd890', '#fff4d8'), outline: hex('#6a2006'), emissive: 0.45, noAO: true };
const FIRE_CORE = hex('#fff4c8');
const FIRE_HOT = hex('#ffb850');
const FIRE_MID = hex('#ff6a2a');

function phoenix(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const cy = 11 + [0, -1, -1, 0][f];
  const flap = [0, 1, 2, 1][f];
  // Tail of flame streaming back.
  for (let i = 0; i < 6; i++) {
    const x = 6 - i * 0.9;
    const y = cy + 3 + Math.sin(i * 1.3 + f) * 0.8;
    c.spark(x, y, i < 2 ? FIRE_CORE : i < 4 ? FIRE_HOT : FIRE_MID, 0.9 - i * 0.12);
    c.spark(x, y - 1, FIRE_MID, 0.5 - i * 0.07);
  }
  c.part();
  c.capsule(8, cy + 2, 4.5, cy - 1 + flap * 1.5, 1.6, 0.8, PLUME, { bias: -1 });
  c.part();
  c.ellipse(11.5, cy + 2, 5.2, 4.8, PLUME, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.ellipse(12.5, cy + 4, 2.4, 1.8, PLUME_HOT);
  c.part();
  c.capsule(15, cy + 2, 18.5, cy - 1 + flap * 1.5, 1.6, 0.8, PLUME);
  // A crest of flame on its head, flickering.
  const lick = [0, 1, 0, -1][f];
  c.part();
  c.capsule(12, cy - 2.5, 11 + lick * 0.5, cy - 6, 0.9, 0.3, PLUME_HOT);
  c.capsule(13.5, cy - 2.5, 14.5 + lick * 0.3, cy - 5, 0.8, 0.3, PLUME_HOT);
  c.spark(11 + lick * 0.5, cy - 7, FIRE_CORE, 0.8);
  eyes(c, [[13, cy], [15.5, cy]], f, 2);
  c.part();
  c.px(16.5, cy + 1.5, BEAK, { x: 0.3, y: 0.2, z: 0.9 });
  c.part();
  c.px(10, cy + 7, BEAK, cyl(0, 0), { bias: -1 });
  c.px(13, cy + 7, BEAK, cyl(0, 0));
  return c;
}

// ---------------------------------------------------------------- Snapclaw, the coral crab

const CRAB: Material = { ramp: ramp('#3a0a10', '#7a1a1e', '#b8342a', '#e8643e', '#ffa878'), outline: hex('#180306'), outlineLit: hex('#2a080a'), shine: true };
const CRAB_PALE: Material = { ramp: ramp('#a86a5a', '#e0a888', '#fff0d8'), outline: hex('#3a1a12') };
const CLAW_TIP: Material = { ramp: ramp('#1e0808', '#4a1814'), outline: hex('#0a0202'), noAO: true };
const BARNACLE: Material = { ramp: ramp('#6a7078', '#b8bcc0', '#f4f6f0'), outline: hex('#20242a') };
const SEAFOAM = hex('#bff4ff');
const EYEBALL: Material = { ramp: ramp('#b8bcc8', '#ffffff'), outline: hex('#1e0406'), noAO: true };

/** A jointed leg: root, knee, foot, as two thin capsules. */
function leg(c: PixelCanvas, rx: number, ry: number, kx: number, ky: number, fx: number, fy: number, m: Material, bias = 0): void {
  c.capsule(rx, ry, kx, ky, 0.7, 0.6, m, { bias });
  c.capsule(kx, ky, fx, fy, 0.6, 0.45, m, { bias });
}

function crab(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const bob = [0, -0.5, 0, -0.5][f];
  // Legs scuttle in two sets, each lifting in turn.
  const lift = (i: number) => ((i + f) % 2 === 0 ? 1 : 0);
  c.part();
  for (let i = 0; i < 3; i++) leg(c, 8 + i * 1.5, 17 + bob, 4.5 - i * 0.2, 15 + i * 1.2 + bob - lift(i), 3 + i * 1.4, 21.2 - lift(i) * 0.8, CRAB, -1);
  // The far claw, held up behind.
  c.capsule(14.5, 16 + bob, 17.5, 13.5 + bob, 1, 0.8, CRAB, { bias: -1 });
  c.ellipse(18.6, 12.4 + bob, 1.8, 1.5, CRAB, { bias: -1 });
  c.capsule(19, 11.5 + bob, 20.8, 10.8 + bob, 0.7, 0.4, CRAB, { bias: -1 });
  c.part();
  // The eyes on their stalks, the far one first.
  c.capsule(12.5, 14 + bob, 12, 10.8 + bob, 0.55, 0.45, CRAB, { bias: -1 });
  c.capsule(14.5, 14 + bob, 15, 10.3 + bob, 0.55, 0.45, CRAB);
  c.part();
  c.ellipse(11.5, 16.5 + bob, 5.8, 3.6, CRAB, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.85 - 0.25, 1) });
  // The carapace's toothed front edge and a pale underside.
  c.px(17, 15 + bob, CRAB, { x: 0.6, y: 0.3, z: 0.75 });
  c.px(16.5, 14 + bob, CRAB, { x: 0.5, y: 0.5, z: 0.7 });
  c.part();
  c.ellipse(11.5, 19.2 + bob, 4.4, 1.2, CRAB_PALE, { normal: () => ({ x: 0, y: -0.6, z: 0.8 }) });
  // A cluster of barnacles on its back.
  c.part();
  c.ellipse(8.3, 13.9 + bob, 1.3, 1, BARNACLE);
  c.px(10, 13 + bob, BARNACLE, { x: 0, y: 0.6, z: 0.8 });
  c.px(7, 14.5 + bob, BARNACLE, { x: -0.4, y: 0.4, z: 0.8 });
  c.part();
  for (const [x, y] of [[12, 10.4], [15, 10]] as const) {
    if (f === 2) {
      c.px(x - 0.5, y + bob, CRAB, { x: 0, y: 0.3, z: 1 });
      c.px(x + 0.5, y + bob, CRAB, { x: 0, y: 0.3, z: 1 });
      continue;
    }
    c.ellipse(x, y + bob, 1.2, 1.2, EYEBALL, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 1) });
    c.px(x + 0.4, y + bob, EYE);
  }
  c.px(15.8, 15.8 + bob, BLUSH);
  // Near legs, then the big near claw, snapping.
  c.part();
  for (let i = 0; i < 2; i++) leg(c, 14 + i * 1.5, 18.5 + bob, 17.5 + i * 0.5, 17 + i + bob - lift(i + 1), 18 + i * 1.5, 21.2 - lift(i + 1) * 0.8, CRAB);
  const open = [1, 1.5, 0.2, 0.6][f];
  c.part();
  c.capsule(15, 17.5 + bob, 18.6, 16 + bob, 1.2, 1, CRAB);
  c.ellipse(20, 14.8 + bob, 2.3, 2, CRAB, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  c.part();
  c.capsule(20.5, 13.4 + bob, 22.6, 12.6 + bob - open, 1, 0.5, CRAB);
  c.capsule(21, 16 + bob, 22.8, 15 + bob, 0.8, 0.4, CRAB);
  c.px(22.6, 12.4 + bob - open, CLAW_TIP);
  c.px(22.8, 15.4 + bob, CLAW_TIP);
  // A bubble of sea foam drifting up.
  c.spark(18 + (f % 2), 9 - f * 1.5, SEAFOAM, 0.55);
  c.spark(9, 11 - ((f + 2) % 4), SEAFOAM, 0.35);
  return c;
}

// ---------------------------------------------------------------- Lilyhop, the lotus frog

const FROG: Material = { ramp: ramp('#0c2a1e', '#16503a', '#23804e', '#4cb862', '#a4ec8c'), outline: hex('#04120a'), outlineLit: hex('#0a2014'), shine: true };
const FROG_BELLY: Material = { ramp: ramp('#a09a5a', '#d8d090', '#fff6c8'), outline: hex('#2a2810') };
const FROG_SPOT: Material = { ramp: ramp('#0a3a24', '#145a34'), outline: hex('#04140a'), noOutline: true };
const FROG_IRIS: Material = { ramp: ramp('#8a4a08', '#e0a020', '#ffe070'), outline: hex('#2a1604'), emissive: 0.3, noAO: true };
const MOUTH: Material = { ramp: ramp('#04140a', '#0a2414'), outline: hex('#020804'), noAO: true, noOutline: true };
const LILY_PAD: Material = { ramp: ramp('#1a5a2a', '#3a9a3a', '#7ad05a'), outline: hex('#08200c') };
const LOTUS: Material = { ramp: ramp('#8a2a6a', '#d05aa0', '#f69ad0', '#ffe0f4'), outline: hex('#3a0a2a'), emissive: 0.25, shine: true };
const LOTUS_HEART = hex('#ffe070');

function frog(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const sac = [0, 0.6, 1.1, 0.4][f];
  c.part();
  // The folded back leg and its long foot.
  c.capsule(6.5, 20.8, 11, 21.3, 1, 0.8, FROG, { bias: -1 });
  c.ellipse(8, 18.5, 3.4, 2.8, FROG, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.ellipse(11, 16.5, 5.2, 4.2, FROG, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.85 - 0.25, 1) });
  c.part();
  for (const [x, y, r] of [[9, 14.5, 1], [7.5, 17, 0.8], [11.5, 13.8, 0.7], [6, 15.5, 0.6]] as const) c.ellipse(x, y, r, r * 0.8, FROG_SPOT, { normal: (_x, _y, dx, dy) => sphere(dx, dy - 0.4, 1) });
  c.part();
  c.ellipse(13.5, 18.2, 3, 2.4, FROG_BELLY, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8, 1) });
  c.part();
  c.ellipse(15, 12.8, 4, 2.9, FROG, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  // Its throat swelling and falling as it breathes.
  c.part();
  c.ellipse(16.2, 15.2, 1.6 + sac, 1.1 + sac * 0.7, FROG_BELLY, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 1) });
  c.part();
  c.ellipse(13.4, 10.1, 1.8, 1.6, FROG, { bias: -1 });
  c.ellipse(16.6, 10, 1.9, 1.7, FROG);
  c.part();
  for (const [x, y] of [[13.8, 9.8], [16.9, 9.7]] as const) {
    if (f === 3) {
      c.px(x - 0.5, y + 0.5, FROG, { x: 0, y: 0.5, z: 0.8 }, { bias: -1 });
      c.px(x + 0.5, y + 0.5, FROG, { x: 0, y: 0.5, z: 0.8 }, { bias: -1 });
      continue;
    }
    c.ellipse(x, y, 1.15, 1.1, FROG_IRIS, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 1) });
    c.px(x - 0.5, y, EYE);
    c.px(x + 0.5, y, EYE);
    c.px(x - 0.6, y - 1, WHITE, { x: 0, y: 0.4, z: 1 });
  }
  c.part();
  for (const [x, y] of [[15, 14], [16, 14.2], [17, 14], [18, 13.6], [19, 13.2]] as const) c.px(x, y, MOUTH);
  c.px(18.2, 12, MOUTH);
  // The front leg, toes spread on the ground.
  c.part();
  c.capsule(14.2, 18, 15, 21, 1, 0.8, FROG);
  c.px(16, 21, FROG, cyl(0.5, 0.3));
  c.px(13.5, 21.4, FROG, cyl(-0.5, 0.3));
  // A lily pad on its back with a lotus in bloom, glowing softly.
  const glow = 0.25 + [0, 0.1, 0.2, 0.1][f];
  c.part();
  c.ellipse(7.5, 13.2, 3, 1, LILY_PAD, { normal: (_x, _y, dx) => ({ x: dx * 0.3, y: 0.8, z: 0.6 }) });
  c.part();
  c.capsule(7.5, 12.6, 5.3, 10.4, 1.2, 0.5, LOTUS, { bias: -1, glow });
  c.capsule(7.5, 12.6, 9.7, 10.4, 1.2, 0.5, LOTUS, { glow });
  c.capsule(7.5, 12.6, 7.5, 9.2, 1.3, 0.5, LOTUS, { bias: 1, glow });
  c.spark(7.5, 11.1, LOTUS_HEART, 0.9);
  c.spark(7.5, 11.6, LOTUS_HEART, 0.5);
  // Pollen drifting up from the flower.
  for (let i = 0; i < 3; i++) c.spark(6.5 + ((i * 3 + f) % 4), 7.5 - i * 2 - (f % 2), i % 2 ? LOTUS_HEART : hex('#ffb0e0'), 0.55 - i * 0.12);
  return c;
}

// ---------------------------------------------------------------- Duskwing, the moon bat

const BAT_FUR: Material = { ramp: ramp('#1a1026', '#2e1c44', '#48306a', '#6c4c94', '#9c7cc4'), outline: hex('#0a0612'), outlineLit: hex('#140c20') };
const BAT_WING: Material = { ramp: ramp('#200c28', '#3c1646', '#62286e', '#90449a'), outline: hex('#0c040e'), emissive: 0.05 };
const BAT_BONE: Material = { ramp: ramp('#1a0c20', '#3a1e44'), outline: hex('#08040a'), noOutline: true };
const MOONMARK: Material = { ramp: ramp('#c890e0', '#ffe0ff', '#ffffff'), outline: hex('#3a1a4a'), emissive: 0.8, noAO: true };

/**
 * A bat's wing: skin stretched from the shoulder to the tip along an arched
 * arm, sagging below between three fingers (deepest at each finger's end),
 * with the arm and finger bones drawn over it.
 */
function batWing(c: PixelCanvas, sx: number, sy: number, tx: number, ty: number, droop: number, bias: number): void {
  const x0 = Math.floor(Math.min(sx, tx));
  const x1 = Math.ceil(Math.max(sx, tx));
  const dir = Math.sign(tx - sx);
  const top = (u: number) => sy + (ty - sy) * u - Math.sin(u * Math.PI) * 1.4;
  const bottom = (u: number) => top(u) + 0.6 + droop * Math.pow(1 - u, 0.6) * (0.55 + 0.45 * Math.abs(Math.cos(u * Math.PI * 3)));
  for (let x = x0; x <= x1; x++) {
    const u = Math.min(1, Math.max(0, (x + 0.5 - sx) / (tx - sx)));
    const y0 = top(u);
    const y1 = bottom(u);
    for (let y = Math.round(y0); y <= Math.round(y1); y++) {
      const v = (y - y0) / Math.max(1, y1 - y0);
      c.px(x, y, BAT_WING, { x: dir * 0.25 * u, y: 0.35 - v * 0.5, z: 0.85 }, { bias });
    }
  }
  // The arm along the leading edge, and the fingers down to the scallops.
  const wu = 0.45;
  const wx = sx + (tx - sx) * wu;
  const wy = top(wu);
  c.line(sx, sy, wx, wy, BAT_BONE, () => ({ x: 0, y: 0.6, z: 0.8 }), { bias });
  c.line(wx, wy, tx, ty, BAT_BONE, () => ({ x: 0, y: 0.6, z: 0.8 }), { bias });
  for (const u of [2 / 3, 1 / 3]) {
    const fx = sx + (tx - sx) * u;
    c.line(wx, wy, fx, bottom(u) - 0.5, BAT_BONE, () => ({ x: 0, y: 0.3, z: 0.9 }), { bias });
  }
}

function bat(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const cy = 10 + [0, -1, 0, 1][f];
  const tip = [-6, -2, 3, -1][f];
  c.part();
  batWing(c, 10, cy - 1, 1.5, cy + tip, 5, -1);
  c.part();
  batWing(c, 14.5, cy - 1, 22.5, cy + tip, 5, 0);
  // Little clawed feet tucked under.
  c.part();
  c.px(11, cy + 5, BAT_BONE, cyl(0, -0.2));
  c.px(13, cy + 5, BAT_BONE, cyl(0, -0.2));
  c.part();
  c.ellipse(12.2, cy + 1.6, 3.4, 3.7, BAT_FUR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.85 - 0.2, 1) });
  c.part();
  c.ellipse(12.8, cy + 2.4, 2, 2, BAT_FUR, { bias: 1, normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8, 1) });
  // A crescent moon on its chest, glowing.
  c.part();
  const moon = 0.7 + [0, 0.15, 0.3, 0.15][f];
  c.px(13, cy + 1, MOONMARK, FLAT, { glow: moon });
  c.px(12, cy + 2, MOONMARK, FLAT, { glow: moon });
  c.px(12, cy + 3, MOONMARK, FLAT, { glow: moon });
  c.px(13, cy + 4, MOONMARK, FLAT, { glow: moon });
  c.part();
  c.capsule(10.8, cy - 3.5, 9.6, cy - 8, 1.3, 0.4, BAT_FUR, { bias: -1 });
  c.capsule(14.6, cy - 3.5, 15.8, cy - 8.5, 1.4, 0.4, BAT_FUR);
  c.part();
  c.capsule(15, cy - 4.5, 15.6, cy - 7.4, 0.5, 0.3, EAR_PINK);
  c.part();
  c.ellipse(12.9, cy - 2.4, 3.3, 2.8, BAT_FUR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  eyes(c, [[12, cy - 3], [14.8, cy - 3]], f, 1);
  c.part();
  c.px(13.5, cy - 1.5, EAR_PINK, { x: 0.2, y: 0.2, z: 1 });
  c.px(14, cy - 0.5, WHITE, { x: 0, y: -0.3, z: 1 });
  c.px(11, cy - 1.5, BLUSH);
  // A few motes of moonlight trailing off its wings.
  c.spark(2 + (f % 2), cy + tip + 2, hex('#e0b0ff'), 0.5);
  c.spark(22 - (f % 2), cy + tip + 2, hex('#e0b0ff'), 0.5);
  return c;
}

// ---------------------------------------------------------------- Puffcap, the mushroom

const CAP: Material = { ramp: ramp('#4a0e1e', '#8a1e32', '#c83a4a', '#f06a6a', '#ffb0a0'), outline: hex('#1e040c'), outlineLit: hex('#2e0812'), shine: true };
const CAP_SPOT: Material = { ramp: ramp('#e8d8b8', '#fff8e0', '#ffffff'), outline: hex('#5a3a2a'), emissive: 0.35, noOutline: true };
const GILL: Material = { ramp: ramp('#5a3a30', '#8a6450', '#b08a6a'), outline: hex('#24140e') };
const STEM: Material = { ramp: ramp('#8a7a60', '#c8b898', '#eee0c0', '#fffaf0'), outline: hex('#3a3020'), outlineLit: hex('#4a3e2a') };
const SPORE_GOLD = hex('#fff0a0');
const SPORE_GREEN = hex('#b8ff9a');

function shroom(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const breathe = [0, 0.4, 0.7, 0.3][f];
  c.part();
  c.ellipse(9.5, 21.3, 1.5, 0.9, STEM, { bias: -1 });
  c.ellipse(14.5, 21.3, 1.5, 0.9, STEM);
  c.part();
  c.ellipse(12, 17.8, 4.4, 3.9, STEM, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.85 - 0.15, 1) });
  // Stubby arms.
  c.part();
  c.px(7.5, 18, STEM, cyl(-0.6, 0.2), { bias: -1 });
  c.px(16.5, 18.5, STEM, cyl(0.6, 0.2));
  eyes(c, [[12.8, 16.5], [15.3, 16.5]], f, 3);
  c.part();
  c.px(11.6, 18.4, BLUSH);
  c.px(16.2, 18.4, BLUSH);
  c.px(14, 18.6, MOUTH);
  // The gills under the cap's rim, then the spotted cap breathing over them.
  const rx = 7.4 + breathe * 0.5;
  const top = 5.5 + breathe * 0.4;
  const rim = 13;
  c.part();
  c.shape(rim, rim + 1, (y) => [12 - rx + 1.5 + (y - rim), 12 + rx - 1.5 - (y - rim)], GILL, (_x, _y, t) => ({ x: t * 0.4, y: -0.7, z: 0.6 }));
  c.part();
  c.shape(Math.floor(top), rim, (y) => {
    const v = (rim + 0.5 - y) / (rim + 0.5 - top);
    const hw = rx * Math.sqrt(Math.max(0, 1 - v * v));
    return hw > 0.3 ? [12 - hw, 12 + hw] : null;
  }, CAP, (_x, y, t) => sphere(t * 0.9, -((rim + 0.5 - y) / (rim + 0.5 - top)) * 0.9 + 0.1, 1));
  c.part();
  for (const [x, y, r] of [[9, 9.5, 1.3], [14, 8.2, 1.1], [16.8, 11, 1], [11.5, 11.6, 0.9], [6.4, 12, 0.8], [12, 6.8, 0.7]] as const) {
    c.ellipse(x, y + breathe * 0.3, r, r * 0.8, CAP_SPOT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6 - 0.3, 1) });
  }
  // Healing spores puffing up and drifting away.
  for (let i = 0; i < 4; i++) {
    const x = 5 + ((i * 5 + f * 2) % 14);
    const y = 5 - ((f + i) % 4) - (i % 2) * 1.5;
    c.spark(x, y, i % 2 ? SPORE_GREEN : SPORE_GOLD, 0.65 - ((f + i) % 4) * 0.12);
  }
  return c;
}

// ---------------------------------------------------------------- Scarab, the jewel beetle and its golden sun

const SCARAB: Material = { ramp: ramp('#082426', '#0e4a3e', '#1c7c50', '#52b85a', '#d8ec7a'), outline: hex('#020a0a'), outlineLit: hex('#06161a'), shine: true };
const BEETLE_LEG: Material = { ramp: ramp('#0c0e12', '#262c34', '#4a525c'), outline: hex('#020204') };
const GOLD: Material = { ramp: ramp('#5a3406', '#9a6414', '#d89a28', '#ffd060', '#fff6c0'), outline: hex('#2a1802'), outlineLit: hex('#3a2406'), shine: true, emissive: 0.15 };
const SUN_GLINT = hex('#fff0a0');

function scarab(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const step = (i: number) => ((i + f) % 2 === 0 ? 0.8 : -0.4);
  // Far legs behind the body.
  c.part();
  for (let i = 0; i < 3; i++) leg(c, 8 + i * 3, 17.5, 7.5 + i * 3 + step(i) * 0.5, 18.5, 7 + i * 3 + step(i), 20.6, BEETLE_LEG, -1);
  c.part();
  c.ellipse(10.2, 15.6, 5.4, 4.6, SCARAB, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 1) });
  // The seam down the wing cases, and an iridescent sheen along the top.
  for (let x = 5; x <= 14; x++) c.shade(x, Math.round(15.2 + (x - 10) * 0.12), -2);
  for (let x = 7; x <= 11; x++) c.shade(x, 12.2 + (x - 9) * (x - 9) * 0.1, 1);
  // Gold spots on the wing cases, like a jewel beetle's.
  c.part();
  for (const [x, y] of [[8, 17.5], [11, 18], [7, 14.3], [12.5, 16.5]] as const) c.px(x, y, GOLD, { x: 0, y: 0.3, z: 0.95 });
  c.part();
  c.ellipse(15.2, 15.4, 2.2, 2.6, SCARAB, { bias: -1, normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  c.part();
  c.ellipse(17.2, 17, 1.7, 1.4, BEETLE_LEG, { bias: 1 });
  // Its rake of a face, set against the ball.
  c.px(18.5, 16, SCARAB, { x: 0.6, y: 0.4, z: 0.7 });
  c.px(18.8, 17, SCARAB, { x: 0.7, y: 0, z: 0.7 });
  c.part();
  c.line(16.5, 14.5, 17.8, 12.2, BEETLE_LEG, () => ({ x: 0.3, y: 0.5, z: 0.8 }));
  c.ellipse(18.2, 11.8, 0.9, 0.8, GOLD);
  eyes(c, [[17, 15.8]], f, 2);
  // Near legs, stepping in turn.
  c.part();
  for (let i = 0; i < 3; i++) leg(c, 8.5 + i * 3, 19, 8 + i * 3 + step(i + 1), 19.8, 8.5 + i * 3 + step(i + 1) * 1.2, 21.3, BEETLE_LEG);
  // The golden sun it rolls, turning (its engraved dots wheel round).
  c.part();
  c.ellipse(20.2, 18.4, 3, 3, GOLD, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 1) });
  for (let k = 0; k < 3; k++) {
    const a = (f * Math.PI) / 4 + (k * Math.PI * 2) / 3;
    c.shade(20.2 + Math.cos(a) * 1.8, 18.4 + Math.sin(a) * 1.8, -2);
  }
  c.spark(19.2, 16.8, SUN_GLINT, 0.9);
  c.spark(19.2, 16.8 - 1, SUN_GLINT, 0.35);
  c.spark(21.5 + (f % 2), 14.5 - (f % 3), SUN_GLINT, 0.5);
  return c;
}

// ---------------------------------------------------------------- Snowpaw, the yeti cub

const YETI: Material = { ramp: ramp('#46587a', '#7688ae', '#a8badc', '#dae6f6', '#ffffff'), outline: hex('#161e30'), outlineLit: hex('#222c44') };
const YETI_FACE: Material = { ramp: ramp('#1e3a6a', '#3a64a0', '#6a98d0', '#a8ccf0'), outline: hex('#0a1630') };
const YETI_SOLE: Material = { ramp: ramp('#2a3450', '#46587a'), outline: hex('#0e1220') };
const ICE: Material = { ramp: ramp('#3a8ac8', '#8ad8ff', '#e0f8ff', '#ffffff'), outline: hex('#0a2a4a'), emissive: 0.45, shine: true, noAO: true };
const TUSK: Material = { ramp: ramp('#b8c0d0', '#ffffff'), outline: hex('#2a3040'), noAO: true };
const FROST = hex('#c8f0ff');

function yeti(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const bob = [0, -0.5, -1, -0.5][f];
  const step = f % 2;
  c.part();
  c.ellipse(9, 21.2 - step * 0.3, 1.9, 1, YETI_SOLE, { bias: -1 });
  c.capsule(8.5, 15 + bob, 6.4, 18.6 + bob, 1.6, 1.4, YETI, { bias: -1 });
  c.part();
  // A round shaggy body: a ball with tufts standing out round its edge.
  c.ellipse(11.5, 16 + bob * 0.6, 6, 5, YETI, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.85 - 0.2, 1) });
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + 0.3;
    if (Math.sin(a) < -0.6) continue;
    c.ellipse(11.5 + Math.cos(a) * 5.7, 16 + bob * 0.6 + Math.sin(a) * 4.6, 1.2, 1.1, YETI, { normal: (_x, _y, dx, dy) => sphere(Math.cos(a) * 0.6 + dx * 0.3, Math.sin(a) * 0.6 + dy * 0.3, 1) });
  }
  c.part();
  c.ellipse(12.5, 17.5 + bob * 0.6, 3.2, 2.8, YETI, { bias: 1, normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.7, 1) });
  c.part();
  c.ellipse(14.2, 21.2 - (1 - step) * 0.3, 1.9, 1, YETI_SOLE);
  // The head, the blue face, little tusks, and horns of ice.
  c.part();
  c.ellipse(13.5, 10.8 + bob, 4.2, 3.8, YETI, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  c.px(12, 6.8 + bob, YETI, cyl(-0.3, 0.6));
  c.px(13, 6.5 + bob, YETI, cyl(0.2, 0.7));
  c.part();
  c.ellipse(15.3, 11.8 + bob, 2.6, 2.3, YETI_FACE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7, dy * 0.7, 1) });
  eyes(c, [[14.4, 10.6 + bob], [16.6, 10.6 + bob]], f, 2);
  c.part();
  c.px(15.5, 13 + bob, MOUTH);
  c.px(14.8, 13.6 + bob, TUSK, { x: 0, y: 0.4, z: 0.9 });
  c.px(16.2, 13.6 + bob, TUSK, { x: 0, y: 0.4, z: 0.9 });
  c.px(13.2, 12.4 + bob, BLUSH);
  c.part();
  c.capsule(11.5, 8 + bob, 10, 4.8 + bob, 1, 0.3, ICE, { bias: -1 });
  c.capsule(15, 7.6 + bob, 16.2, 4.2 + bob, 1, 0.3, ICE);
  c.spark(16.2, 4 + bob, FROST, 0.8);
  // The near arm, a paw raised a little as it breathes.
  c.part();
  c.capsule(15.5, 15 + bob, 17.4, 17.6 + bob - (f === 2 ? 0.6 : 0), 1.6, 1.4, YETI);
  c.px(18, 18 + bob - (f === 2 ? 0.6 : 0), YETI_FACE, cyl(0.6, 0));
  // Frosty breath, and snowflakes drifting round it.
  if (f === 1 || f === 2) for (let i = 0; i < 3; i++) c.spark(18.5 + i + (f - 1), 12.5 + bob - (i % 2) + (f - 1) * 0.5, FROST, 0.7 - i * 0.18);
  c.spark(4 + (f % 2), 8 + f, FROST, 0.5);
  c.spark(20 - (f % 2), 6 + ((f + 2) % 4), FROST, 0.4);
  return c;
}

// ---------------------------------------------------------------- Nimbus, the little storm cloud

const CLOUD: Material = { ramp: ramp('#1e2244', '#343c6a', '#525e96', '#8292c6', '#c8d4f4'), outline: hex('#0a0c20'), outlineLit: hex('#141836') };
const BOLT: Material = { ramp: ramp('#ffc830', '#fff080', '#ffffff'), outline: hex('#4a3a08'), emissive: 1, noAO: true, noOutline: true };
const RAIN = hex('#8ab8ff');
const STATIC = hex('#fff080');

function cloud(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const cy = 9 + [0, -1, 0, 1][f];
  const puff = (x: number, y: number, rx: number, ry: number, bias = 0) =>
    c.ellipse(x, y, rx, ry, CLOUD, { bias, normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.85 - 0.25, 1) });
  // Rain falling from its underside.
  for (let i = 0; i < 5; i++) {
    const x = 7 + i * 2.5;
    const y = cy + 5 + ((f * 2 + i * 3) % 7);
    c.spark(x, y, RAIN, 0.5);
    c.spark(x, y + 1, RAIN, 0.3);
  }
  // A crack of lightning under it on every other frame, never in the same place twice running.
  if (f % 2 === 1) {
    const bx = f === 1 ? 10 : 15;
    const zig: [number, number][] = [[bx, cy + 4], [bx - 1.5, cy + 6.5], [bx, cy + 7], [bx - 2, cy + 10]];
    c.part();
    for (let i = 0; i < zig.length - 1; i++) c.line(zig[i][0], zig[i][1], zig[i + 1][0], zig[i + 1][1], BOLT);
    c.spark(zig[3][0], zig[3][1] + 1, STATIC, 0.7);
  }
  c.part();
  puff(6.8, cy + 1, 3.4, 2.9, -1);
  puff(17.4, cy + 1.2, 3.2, 2.8, -1);
  c.part();
  puff(12, cy, 5, 4.2);
  puff(8, cy + 2, 3.4, 2.8);
  puff(16.5, cy + 2, 3.6, 2.9);
  puff(10, cy - 2.6, 3, 2.6);
  puff(14.6, cy - 2, 2.6, 2.3);
  // Its underside, flat and dark with rain.
  for (let x = 4; x <= 20; x++) for (let y = Math.round(cy + 3.5); y <= cy + 6; y++) c.shade(x, y, -1);
  eyes(c, [[12.5, cy + 0.2], [15.5, cy + 0.2]], f, 2);
  c.part();
  c.px(11, cy + 2, BLUSH);
  c.px(17, cy + 2, BLUSH);
  c.px(14, cy + 2.4, MOUTH);
  // Static jumping about its crown.
  c.spark(9 + ((f * 3) % 7), cy - 5 - (f % 2), STATIC, 0.6);
  c.spark(16 - ((f * 2) % 5), cy - 4, STATIC, 0.35);
  return c;
}

// ---------------------------------------------------------------- Mossback, the old ward turtle

const SHELL_T: Material = { ramp: ramp('#1c2616', '#2e4022', '#4a5e32', '#6e8446', '#a2b06a'), outline: hex('#0a1006'), outlineLit: hex('#141c0c'), shine: true };
const SHELL_RIM: Material = { ramp: ramp('#5a5430', '#8a8450', '#c8c088'), outline: hex('#1e1c0c') };
const TSKIN: Material = { ramp: ramp('#1e3a30', '#2e5a48', '#4a8266', '#7ab496', '#b8e0c8'), outline: hex('#0a1a12'), outlineLit: hex('#12261c') };
const MOSS_LIT: Material = { ramp: ramp('#2a4a1a', '#4a7a2a', '#7ab04a', '#b0e070'), outline: hex('#0e1a08') };
const WARD_RUNE: Material = { ramp: ramp('#1a8a8a', '#5ae8d8', '#d8fff8'), outline: hex('#063030'), emissive: 1, noAO: true };
const BLOOM_WHITE: Material = { ramp: ramp('#d8d0e0', '#ffffff'), outline: hex('#3a3440'), noAO: true };
const BLOOM_HEART: Material = { ramp: ramp('#e0a020', '#ffe070'), outline: hex('#3a2404'), noAO: true, noOutline: true };

function turtle(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const step = f % 2;
  const hb = [0, -0.5, 0, 0.5][f];
  c.part();
  c.capsule(15, 18, 15.5 + step * 0.4, 21, 1.4, 1.2, TSKIN, { bias: -1 });
  c.capsule(7.5, 18, 7 - step * 0.4, 21, 1.4, 1.2, TSKIN, { bias: -1 });
  // Neck and a wise old head, nodding.
  c.part();
  c.capsule(15, 16, 18, 14 + hb, 1.6, 1.5, TSKIN);
  c.ellipse(19.3, 13.4 + hb, 2.6, 2.2, TSKIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  c.part();
  c.px(21.5, 14.2 + hb, TSKIN, { x: 0.7, y: 0, z: 0.7 }, { bias: -1 });
  c.px(21, 15 + hb, MOUTH);
  eyes(c, [[19.8, 12.4 + hb]], f, 2);
  // A heavy, sleepy lid over the eye.
  c.part();
  c.px(19.8, 11.6 + hb, TSKIN, { x: 0, y: 0.6, z: 0.8 }, { bias: -1 });
  c.px(20.8, 11.6 + hb, TSKIN, { x: 0, y: 0.6, z: 0.8 }, { bias: -1 });
  // The shell: a rim, a dome of plates, and moss on its crown.
  const cx = 11;
  const base = 18.5;
  const top = 9.5;
  const rx = 7.8;
  c.part();
  c.shape(Math.round(base) - 1, Math.round(base), (y) => [cx - rx + (y - base + 1) * 0.5, cx + rx - (y - base + 1) * 0.5], SHELL_RIM, (_x, _y, t) => cyl(t, -0.2));
  c.part();
  c.shape(Math.floor(top), Math.round(base) - 2, (y) => {
    const v = (base - 1.5 - y) / (base - 1.5 - top);
    const hw = rx * Math.sqrt(Math.max(0, 1 - v * v));
    return hw > 0.3 ? [cx - hw, cx + hw] : null;
  }, SHELL_T, (_x, y, t) => sphere(t * 0.9, -((base - 1.5 - y) / (base - 1.5 - top)) * 0.9 + 0.15, 1));
  // Seams between the plates, and each plate's worn, raised middle.
  for (let y = 12; y <= 16; y++) {
    c.shade(7.5, y, -2);
    c.shade(14.5, y, -2);
  }
  for (let x = 5; x <= 17; x++) c.shade(x, x > 7 && x < 15 ? 12 : 13, -2);
  c.shade(11, 10, 1);
  c.shade(5.5, 15, 1);
  c.shade(16.5, 15, 1);
  // The ward rune on the middle plate, pulsing.
  const pulse = 0.55 + [0, 0.2, 0.4, 0.2][f];
  c.part();
  for (const [x, y] of [[11, 13.5], [10, 14.5], [12, 14.5], [11, 15.5]] as const) c.px(x, y, WARD_RUNE, FLAT, { glow: pulse });
  c.spark(11, 14.5, hex('#9ffff0'), pulse * 0.6);
  c.part();
  c.shape(Math.floor(top), Math.floor(top) + 2, (y) => {
    const v = (base - 1.5 - y) / (base - 1.5 - top);
    const hw = rx * Math.sqrt(Math.max(0, 1 - v * v)) - 0.5;
    return hw > 0.3 ? [cx - hw, cx + hw] : null;
  }, MOSS_LIT, (_x, _y, t) => cyl(t, 0.7));
  for (const x of [6, 9, 13, 15]) c.px(x, Math.floor(top) + 3 - (x === 9 || x === 13 ? 0 : 1), MOSS_LIT, cyl((x - cx) / 6, 0.3));
  // A tiny white flower growing out of the moss.
  c.part();
  c.px(12.5, top, BLOOM_WHITE, { x: -0.2, y: 0.5, z: 0.8 });
  c.px(13.5, top - 1, BLOOM_WHITE, { x: 0, y: 0.7, z: 0.7 });
  c.px(14.5, top, BLOOM_WHITE, { x: 0.2, y: 0.5, z: 0.8 });
  c.px(13.5, top, BLOOM_HEART);
  // Near legs and a stub of a tail.
  c.part();
  c.capsule(16.2, 18.5, 17 - step * 0.4, 21.3, 1.5, 1.3, TSKIN);
  c.capsule(9, 18.5, 9.5 + step * 0.4, 21.3, 1.5, 1.3, TSKIN);
  c.px(3, 17.5, TSKIN, cyl(-0.5, 0.2));
  return c;
}

// ---------------------------------------------------------------- Pixie, the glade fairy

const PIXIE_HAIR: Material = { ramp: ramp('#1a5a3a', '#2e8a52', '#5ec47a', '#a8f0b0'), outline: hex('#0a2414'), outlineLit: hex('#12301c'), shine: true };
const PIXIE_SKIN: Material = { ramp: ramp('#b07a68', '#e8b898', '#ffe0cc'), outline: hex('#3a2018'), outlineLit: hex('#4a2a20') };
const PETAL: Material = { ramp: ramp('#8a2a5a', '#d05a90', '#ff9ac8', '#ffe0f0'), outline: hex('#3a0a24'), shine: true, emissive: 0.1 };
const WING_EDGE = hex('#c8fff4');
const WING_FILL = hex('#7ae0ff');
const WAND_STAR = hex('#fff0a0');

/** A gossamer wing: pure light, an ellipse turned by `rot`, bright at its rim with a vein down the middle. */
function glassWing(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, rot: number, a: number): void {
  const R = Math.ceil(Math.max(rx, ry)) + 1;
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const u = (x * cs + y * sn) / rx;
      const v = (-x * sn + y * cs) / Math.max(0.3, ry);
      const d = u * u + v * v;
      if (d > 1) continue;
      const rim = d > 0.55;
      const vein = Math.abs(v) < 0.18 && u > -0.6;
      c.spark(cx + x, cy + y, rim || vein ? WING_EDGE : WING_FILL, a * (rim ? 0.8 : vein ? 0.55 : 0.28));
    }
  }
}

function pixie(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const b = [0, -1, 0, 1][f];
  const open = [1, 0.55, 0.2, 0.55][f];
  // Four wings fluttering behind her: the far pair dimmer.
  glassWing(c, 9, 8 + b, 4, 2.4 * open, -0.6, 0.55);
  glassWing(c, 9.5, 12 + b, 2.8, 1.7 * open, 0.55, 0.5);
  glassWing(c, 7, 7.5 + b, 4.2, 2.5 * open, -0.45, 0.9);
  glassWing(c, 7.5, 12 + b, 3, 1.8 * open, 0.4, 0.8);
  c.part();
  c.capsule(9.8, 6 + b, 8, 9.5 + b, 1.2, 0.6, PIXIE_HAIR, { bias: -1 });
  c.part();
  c.capsule(11.8, 14 + b, 11.2, 17.2 + b, 0.6, 0.5, PIXIE_SKIN, { bias: -1 });
  c.capsule(13.2, 14 + b, 13.8, 16.8 + b, 0.6, 0.5, PIXIE_SKIN);
  c.px(11, 17.5 + b, PETAL);
  c.px(14, 17 + b, PETAL);
  c.part();
  c.capsule(11.4, 10.5 + b, 10, 13 + b, 0.6, 0.5, PIXIE_SKIN, { bias: -1 });
  // A dress of petals, pointed at the hem.
  c.part();
  c.shape(Math.round(10 + b), Math.round(14 + b), (y) => {
    const u = (y - (10 + b)) / 4;
    return [11.2 - u * 2, 14 + u * 1.8];
  }, PETAL, (_x, _y, t) => cyl(t, 0.1));
  c.px(9, 15 + b, PETAL, cyl(-0.6, -0.2));
  c.px(12.5, 15 + b, PETAL, cyl(0, -0.2));
  c.px(15.5, 14.8 + b, PETAL, cyl(0.6, -0.2));
  // The near arm holding out her wand, its star twinkling.
  c.part();
  c.capsule(13.6, 10.8 + b, 16.2, 11.2 + b, 0.6, 0.5, PIXIE_SKIN);
  c.line(16.5, 11 + b, 18, 8 + b, BEAK);
  const tw = [0.8, 1, 0.6, 1][f];
  c.spark(18, 7.5 + b, WAND_STAR, tw);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(18 + dx, 7.5 + b + dy, WAND_STAR, tw * (f % 2 ? 0.6 : 0.35));
  // Her head: hair over the back and top, her face to the front.
  c.part();
  c.ellipse(12, 6.4 + b, 3.2, 2.7, PIXIE_HAIR, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  c.part();
  c.ellipse(13.4, 7.8 + b, 2.2, 2, PIXIE_SKIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8, 1) });
  c.part();
  c.px(15, 5.5 + b, PIXIE_HAIR, cyl(0.5, 0.4));
  c.px(14, 5.5 + b, PIXIE_HAIR, cyl(0.2, 0.4));
  c.px(10.5, 7.5 + b, PIXIE_SKIN, cyl(-0.5, 0.3));
  c.px(9.8, 6.8 + b, PIXIE_SKIN, cyl(-0.6, 0.5));
  // A leaf crown.
  c.px(11, 3.8 + b, LILY_PAD, cyl(-0.4, 0.6));
  c.px(12.5, 3.6 + b, LILY_PAD, cyl(0.3, 0.6));
  eyes(c, [[13, 7 + b], [14.8, 7 + b]], f, 2);
  c.part();
  c.px(15.2, 8.8 + b, BLUSH);
  // Pollen falling from her like dust.
  for (let i = 0; i < 3; i++) c.spark(10 + ((i * 3 + f) % 6), 17 + b + i * 1.5 + (f % 2), i % 2 ? hex('#ffb0e0') : WAND_STAR, 0.6 - i * 0.15);
  return c;
}

// ---------------------------------------------------------------- Gryphon, the eagle-lion

const LION: Material = { ramp: ramp('#5a4028', '#8a6a44', '#b8966a', '#d8bc90', '#f0dcb8'), outline: hex('#1e140a'), outlineLit: hex('#2e2010') };
const EAGLE: Material = { ramp: ramp('#6a6a78', '#a8a8b8', '#e0e0ea', '#ffffff'), outline: hex('#24242e'), outlineLit: hex('#34343e') };
const FEATHER: Material = { ramp: ramp('#2a1404', '#5a300c', '#8e5418', '#c8862a', '#f8c858'), outline: hex('#140a02'), outlineLit: hex('#221004'), shine: true };
const TALON: Material = { ramp: ramp('#8a5a10', '#e0a020', '#ffe080'), outline: hex('#2a1804') };
const GRYPHON_EYE: Material = { ramp: ramp('#c87a08', '#ffd030', '#fff8b0'), outline: hex('#2a1604'), emissive: 0.8, noAO: true };
const GOLD_DUST = hex('#ffe08a');

/**
 * A feathered wing: an arm from shoulder to wrist, a row of coverts over it,
 * and flight feathers fanning back and down from it, longest at the tip.
 */
function featherWing(c: PixelCanvas, sx: number, sy: number, wx: number, wy: number, droop: number, bias: number): void {
  const ax = wx - sx;
  const ay = wy - sy;
  for (let k = 4; k >= 0; k--) {
    const t = k / 4;
    const bx = sx + ax * t;
    const by = sy + ay * t;
    const len = 3 + t * 3.5;
    const a = Math.PI * 0.62 + droop * 0.5 - t * 0.35;
    const ex = bx + Math.cos(a) * len;
    const ey = by + Math.sin(a) * len;
    c.capsule(bx, by, ex, ey, 1.2, 0.5, FEATHER, { bias: bias - (k % 2) });
    c.px(ex, ey, EAGLE, { x: 0, y: -0.2, z: 1 }, { bias });
  }
  c.capsule(sx, sy, wx, wy, 1.4, 1, FEATHER, { bias: bias + 1 });
}

function gryphon(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const cy = 11 + [0, -1, -1, 0][f];
  const beat = [0, 1, 2, 1][f];
  // The far wing, behind everything.
  c.part();
  featherWing(c, 11.5, cy - 0.5, 9 - beat * 0.3, cy - 9 + beat * 3.2, beat * 0.4, -1);
  // Tail with its tuft, flicking.
  const flick = [0, 0.5, 1, 0.5][f];
  c.part();
  c.capsule(5.5, cy + 2.5, 2.4, cy + 4.5 - flick, 0.8, 0.6, LION, { bias: -1 });
  c.ellipse(2, cy + 5 - flick, 1.3, 1.3, LION, { bias: -2 });
  // Far legs: a lion's hind paw and an eagle's talons.
  c.part();
  c.capsule(7, cy + 5, 6, cy + 8.5, 1.2, 0.9, LION, { bias: -1 });
  c.capsule(13, cy + 5, 14, cy + 8, 1, 0.7, TALON, { bias: -1 });
  c.part();
  c.capsule(6.5, cy + 3, 12.5, cy + 3, 3, 3.1, LION);
  c.part();
  c.capsule(8.5, cy + 5, 8.5, cy + 9.4, 1.3, 1, LION);
  c.px(9.5, cy + 9.6, LION, cyl(0.5, 0));
  c.capsule(14.5, cy + 5, 15.5, cy + 8.8, 1, 0.7, TALON);
  c.px(16.5, cy + 9, CLAW_TIP);
  c.px(14.5, cy + 9.4, CLAW_TIP);
  // A white-feathered chest and the eagle's head, crest swept back.
  c.part();
  c.ellipse(14, cy + 2, 2.8, 3, EAGLE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.85 - 0.1, 1) });
  c.part();
  c.capsule(14.6, cy - 3, 12.4, cy - 5.6, 0.8, 0.3, FEATHER, { bias: -1 });
  c.capsule(15.6, cy - 3.6, 14.2, cy - 6.6, 0.8, 0.3, FEATHER);
  c.part();
  c.ellipse(16.5, cy - 1.5, 2.8, 2.6, EAGLE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  c.part();
  c.capsule(18.5, cy - 1.4, 20.6, cy - 0.4, 1, 0.5, TALON);
  c.px(20.6, cy + 0.4, TALON, { x: 0.4, y: -0.4, z: 0.8 }, { bias: -1 });
  c.part();
  c.px(17, cy - 2.4, GRYPHON_EYE);
  c.px(17.6, cy - 2.4, EYE);
  c.px(16.6, cy - 3.3, EAGLE, { x: 0, y: 0.7, z: 0.7 }, { bias: -2 });
  c.px(17.6, cy - 3.3, EAGLE, { x: 0, y: 0.7, z: 0.7 }, { bias: -2 });
  // The near wing, over the body.
  c.part();
  featherWing(c, 11, cy + 0.5, 6 - beat * 0.3, cy - 8 + beat * 3.4, beat * 0.4, 0);
  // Gold dust shed from its feathers.
  for (let i = 0; i < 3; i++) c.spark(3 + ((i * 4 + f) % 6), cy + 7 + i * 1.5 + (f % 2), GOLD_DUST, 0.55 - i * 0.14);
  return c;
}

// ---------------------------------------------------------------- Krakling, the baby kraken

const KRAKEN: Material = { ramp: ramp('#1a0e2e', '#2e1a50', '#4a2a7a', '#7a4ab0', '#b890e0'), outline: hex('#08040e'), outlineLit: hex('#120a20'), shine: true };
const KRAKEN_PALE: Material = { ramp: ramp('#8a6aa8', '#c8a8e0', '#f0e0ff'), outline: hex('#2a1a3a') };
const SUCKER: Material = { ramp: ramp('#d8c0e8', '#fff0ff'), outline: hex('#3a2a4a'), noAO: true, noOutline: true };
const BIOLUM: Material = { ramp: ramp('#2a9ab8', '#5ae8ff', '#e0ffff'), outline: hex('#08303a'), emissive: 1, noAO: true, noOutline: true };
const BUBBLE = hex('#a8f0ff');

/** A tentacle hanging from (x0, y0), fanned out `spread` toward `dir`: it sways with `phase` and curls at its tip. */
function tentacle(c: PixelCanvas, x0: number, y0: number, len: number, phase: number, dir: number, r0: number, bias: number, spread = 0): void {
  // Each its own part, so an outline keeps it apart from its neighbours.
  c.part();
  let x = x0;
  let y = y0;
  for (let k = 1; k <= len; k++) {
    const u = k / len;
    const a = Math.PI / 2 - dir * (spread + Math.sin(phase + k * 0.55) * 0.25 + u * u * u * 1.5);
    const nx = x + Math.cos(a);
    const ny = y + Math.sin(a);
    c.capsule(x, y, nx, ny, r0 + (0.4 - r0) * (u - 1 / len), r0 + (0.4 - r0) * u, KRAKEN, { bias });
    if (k % 3 === 1 && k < len - 2) c.px(nx - dir * 0.9, ny, SUCKER, { x: -dir * 0.4, y: 0, z: 0.9 });
    x = nx;
    y = ny;
  }
}

function kraken(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const cy = 7.5 + [0, -1, -1, 0][f];
  const ph = (f * Math.PI) / 2;
  tentacle(c, 12, cy + 4, 9, ph + 1.5, -1, 0.8, -1, 0.05);
  tentacle(c, 14.5, cy + 4, 8, ph + 3, 1, 0.8, -1, 0.1);
  // The mantle leaning back, and a pale underside.
  c.part();
  c.ellipse(9, cy - 3.2, 3.6, 3.3, KRAKEN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.25, 1) });
  c.ellipse(12.4, cy, 5.6, 4.8, KRAKEN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.85 - 0.2, 1) });
  c.part();
  c.ellipse(13.2, cy + 2.6, 3.4, 1.6, KRAKEN_PALE, { normal: () => ({ x: 0, y: -0.4, z: 0.9 }) });
  // Glowing spots down its back, breathing in turn.
  c.part();
  for (const [i, x, y] of [[0, 7.5, cy - 4.5], [1, 9.8, cy - 5.6], [2, 7, cy - 1.5], [3, 9.5, cy - 1.8], [1, 11.5, cy - 3.8]] as const) {
    c.px(x, y, BIOLUM, FLAT, { glow: 0.5 + ((i + f) % 4) * 0.17 });
  }
  // Big dark eyes.
  c.part();
  for (const [x, r] of [[13.6, 1.5], [16.4, 1.3]] as const) {
    if (f === 3) {
      c.px(x - 0.5, cy + 0.5, EYE);
      c.px(x + 0.5, cy + 0.5, EYE);
      continue;
    }
    c.ellipse(x, cy + 0.3, r, r * 1.15, EYE, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 1) });
    c.px(x - 0.6, cy - 0.6, WHITE, { x: 0, y: 0.4, z: 1 });
    c.spark(x + 0.4, cy + 1, hex('#5ae8ff'), 0.4);
  }
  c.px(12, cy + 1.6, BLUSH);
  // The near tentacles, in front.
  tentacle(c, 8, cy + 3, 9, ph + 0.8, -1, 0.9, 0, 0.25);
  tentacle(c, 11.5, cy + 4.5, 10, ph + 2.2, -1, 1, 0, 0.12);
  tentacle(c, 15, cy + 4.5, 10, ph + 3.1, 1, 1, 0, 0.15);
  tentacle(c, 17.8, cy + 3, 8, ph + 4, 1, 0.9, 0, 0.3);
  // Bubbles rising.
  c.spark(19, cy - 2 - f, BUBBLE, 0.6);
  c.spark(19.5, cy - 3 - f, BUBBLE, 0.25);
  c.spark(5, cy + 3 - ((f * 3) % 7), BUBBLE, 0.5);
  return c;
}

// ---------------------------------------------------------------- Mimic, the hungry chest

const WOOD: Material = { ramp: ramp('#2a160c', '#4a2a14', '#6e4222', '#945e34', '#bc8450'), outline: hex('#120804'), outlineLit: hex('#1e1008') };
const IRON: Material = { ramp: ramp('#1a1c22', '#34383e', '#585e66', '#8a9098'), outline: hex('#08090c'), shine: true };
const MAW: Material = { ramp: ramp('#1a0408', '#3a0a14'), outline: hex('#0a0204'), noAO: true, noOutline: true };
const TONGUE: Material = { ramp: ramp('#8a1a3a', '#d04a6a', '#ff8aa0'), outline: hex('#3a0614'), shine: true };
const TEETH: Material = { ramp: ramp('#c8c0a8', '#fffaf0'), outline: hex('#3a3428'), noAO: true };
const MIMIC_EYE: Material = { ramp: ramp('#c86a08', '#ffc030', '#fff8a0'), outline: hex('#2a1604'), emissive: 1, noAO: true, noOutline: true };
const COIN = hex('#ffd060');

function mimic(f: number): PixelCanvas {
  const c = new PixelCanvas(PET_W, PET_H);
  const open = [1, 2.5, 4, 2][f];
  // Seen three-quarters on: the box's lit end on the left, running back
  // (so it rises a little), and its front, with the mouth, facing right.
  const front = 8;
  const right = 19.5;
  const lip = 15;
  c.part();
  c.px(9, 21.5, IRON, cyl(0, -0.3));
  c.px(18.5, 21.5, IRON, cyl(0, -0.3));
  c.px(4.5, 20.3, IRON, cyl(0, -0.3), { bias: -1 });
  c.part();
  for (let x = 4; x < front; x++) {
    const up = (front - x) * 0.4;
    for (let y = Math.round(lip - up); y <= Math.round(21 - up); y++) c.px(x, y, WOOD, { x: -0.75, y: 0.1, z: 0.65 });
  }
  c.part();
  c.shape(lip, 21, () => [front, right], WOOD, (_x, _y, t) => ({ x: 0.3 + t * 0.05, y: -0.05, z: 0.95 }));
  // Planks, iron bands and gold studs.
  for (let x = front; x < right; x++) {
    c.shade(x, 18, -1);
    if (x % 4 === 1) c.shade(x, 20, -1);
  }
  c.part();
  for (const x of [front, 13, right - 1]) for (let y = lip; y <= 21; y++) c.px(x, y, IRON, { x: x === front ? -0.3 : 0.3, y: 0, z: 0.95 });
  c.part();
  c.px(front, 20, GOLD, FLAT);
  c.px(right - 1, 20, GOLD, FLAT);
  // The maw: dark inside, a glint of treasure, two eyes burning in the gap.
  const lidLow = lip - open;
  if (open >= 1) {
    c.part();
    c.shape(Math.round(lidLow), lip - 1, () => [front + 0.5, right - 0.5], MAW, () => FLAT);
    const ey = Math.max(lidLow + 0.5, lip - open * 0.6);
    c.part();
    c.px(12, ey, MIMIC_EYE);
    c.px(16, ey, MIMIC_EYE);
    if (open >= 2.5) {
      c.px(12, ey + 1, MIMIC_EYE);
      c.px(16, ey + 1, MIMIC_EYE);
    }
    if (open >= 2) for (const x of [10, 14.5, 17.5]) c.spark(x, lip - 0.5, COIN, 0.6);
    // Teeth along both lips.
    c.part();
    for (let x = front + 1; x < right - 1; x += 2) c.px(x, lip - 1, TEETH, { x: 0, y: 0.4, z: 0.9 });
    if (open >= 2) for (let x = front + 2; x < right - 1; x += 2) c.px(x, lidLow, TEETH, { x: 0, y: -0.4, z: 0.9 });
  }
  // The lid, lifted: its rounded end on the left, its curved front with a gold trim.
  const lidTop = lip - 5 - open;
  c.part();
  c.ellipse(6, lidTop + 2 + open * 0.45, 2.3, 2.6, WOOD, { normal: (_x, _y, dx, dy) => sphere(-0.6 + dx * 0.3, dy * 0.8 - 0.2, 1) });
  c.part();
  c.shape(Math.round(lidTop), Math.round(lidLow) - 1, (y) => {
    const k = y - Math.round(lidTop);
    return k === 0 ? [front + 1, right - 1] : k === 1 ? [front + 0.3, right - 0.3] : [front, right];
  }, WOOD, (_x, y, t) => sphere(0.25 + t * 0.1, ((y - lidTop) / 4) * 1.5 - 0.9, 1));
  c.part();
  for (const x of [front, 13, right - 1]) for (let y = Math.round(lidTop) + 1; y <= Math.round(lidLow) - 1; y++) c.px(x, y, IRON, { x: 0.2, y: 0.5, z: 0.85 });
  c.shape(Math.round(lidLow) - 1, Math.round(lidLow) - 1, () => [front, right], GOLD, () => ({ x: 0.2, y: -0.2, z: 0.95 }));
  c.px(13.5, lidLow, GOLD, { x: 0.3, y: 0, z: 0.9 });
  // Its tongue lolling out over the front.
  if (open >= 2) {
    c.part();
    const wag = [0, 0.5, 1, 0.5][f];
    c.capsule(15.5, lip - 0.5, 17.5 + wag, lip + 3.5, 1.2, 1, TONGUE);
    c.shade(16.5 + wag * 0.5, lip + 1.5, -1);
  }
  return c;
}

/** Each companion's frames, by id. */
export const PET_ART: Record<string, (f: number) => PixelCanvas> = {
  slime,
  bunny,
  pebble,
  owl,
  fox,
  wisp,
  wyrm,
  phoenix,
  crab,
  frog,
  bat,
  shroom,
  scarab,
  yeti,
  cloud,
  turtle,
  pixie,
  gryphon,
  kraken,
  mimic,
  ...HALLOWS_PET_ART,
};

/** Every frame of every companion, for the sheet. */
export function petFrames(): { name: string; canvas: PixelCanvas }[] {
  const out: { name: string; canvas: PixelCanvas }[] = [];
  for (const [id, draw] of Object.entries(PET_ART)) for (let f = 0; f < PET_FRAMES; f++) out.push({ name: `${id}_${f}`, canvas: draw(f) });
  return out;
}

// ---------------------------------------------------------------- The wishing egg

export const EGG_W = 30;
export const EGG_H = 38;

const SHELL: Material = { ramp: ramp('#7a6a50', '#b8a480', '#e6d8b8', '#fff8e8'), outline: hex('#3a2e1e'), outlineLit: hex('#5a4a30'), shine: true };
const FILIGREE: Material = { ramp: ramp('#8a5a18', '#d8a040', '#ffe08a'), outline: hex('#3a2408'), shine: true };
const SPOT: Material = { ramp: ramp('#1a6a5a', '#2ea88a', '#7ae8c8'), outline: hex('#0a2a22'), emissive: 0.35 };

/** The half-width of the egg at row `y`: rounder below, narrowing to its crown. */
function eggHW(y: number): number {
  const cy = EGG_H / 2 + 1;
  const v = (y + 0.5 - cy) / (EGG_H / 2 - 1.5);
  if (Math.abs(v) > 1) return 0;
  const k = v < 0 ? 0.78 + 0.22 * (1 + v) : 1;
  return 12.5 * Math.sqrt(1 - v * v) * k;
}

/** The egg on the Wishing Nest: a pale shell wound with gold filigree and set with glowing teal spots. */
export function wishEgg(): PixelCanvas {
  const c = new PixelCanvas(EGG_W, EGG_H);
  const cx = EGG_W / 2;
  c.part();
  c.shape(1, EGG_H - 2, (y) => {
    const hw = eggHW(y);
    return hw > 0 ? [cx - hw, cx + hw] : null;
  }, SHELL, (_x, y, t) => sphere(t * 0.9, ((y - EGG_H / 2) / (EGG_H / 2)) * 0.9, 1));
  // A gold band spiralling round it.
  c.part();
  for (let y = 4; y < EGG_H - 3; y++) {
    const hw = eggHW(y);
    if (hw < 2) continue;
    const t = Math.sin(y * 0.42) * 0.8;
    const x = cx + t * hw;
    const facing = Math.cos(y * 0.42) > -0.2;
    if (!facing) continue;
    c.px(x, y, FILIGREE, { x: t * 0.6, y: 0.2, z: 0.8 });
    if (y % 5 === 0) c.px(x + 1, y, FILIGREE, { x: t * 0.6, y: 0.2, z: 0.8 }, { bias: 1 });
  }
  // Teal spots scattered over the shell.
  c.part();
  for (const [x, y, r] of [[10, 12, 1.4], [19, 18, 1.8], [12, 27, 1.6], [20, 30, 1.2], [15, 7, 1]] as const) {
    c.ellipse(x, y, r, r, SPOT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6, 1) });
  }
  return c;
}

/** Cracks of light across the egg, spreading with `level` (1..3); pure light, drawn over it. */
export function eggCracks(level: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(EGG_W * EGG_H * 4);
  const put = (x: number, y: number, c: RGB) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= EGG_W || y >= EGG_H || eggHW(y) <= Math.abs(x + 0.5 - EGG_W / 2)) return;
    px.set([c[0], c[1], c[2], 255], (y * EGG_W + x) * 4);
  };
  const line = (pts: [number, number][], c: RGB) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let k = 0; k <= n; k++) put(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, c);
    }
  };
  const hot = hex('#fff4c0');
  const warm = hex('#ffc860');
  line([[15, 3], [13, 8], [16, 12], [14, 17]], hot);
  if (level >= 2) {
    line([[14, 17], [18, 21], [15, 26]], hot);
    line([[16, 12], [21, 14], [24, 19]], warm);
  }
  if (level >= 3) {
    line([[15, 26], [11, 30], [13, 34]], hot);
    line([[13, 8], [8, 11], [6, 17]], warm);
    line([[18, 21], [23, 26]], warm);
  }
  return px;
}
