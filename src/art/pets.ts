// The companions: eight small creatures that follow the hero, drawn with the
// same lit pixel engine as everything else. Each has four frames that loop
// (breathing, blinking, a wing beat, a flicker of flame), facing right; the
// world mirrors them to face left. Frames are named `<id>_<f>` on one sheet.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
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

/** Each companion's frames, by id. */
export const PET_ART: Record<string, (f: number) => PixelCanvas> = { slime, bunny, pebble, owl, fox, wisp, wyrm, phoenix, ...HALLOWS_PET_ART };

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
