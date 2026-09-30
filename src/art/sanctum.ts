// The Rune Temple's art: its palette and materials (shared with the walk-in
// temple's hall and outside in runeHall.ts, and with the Forge), the
// runestones by its steps, the light through its windows, the keepers'
// stations and the two keepers.
//
// Nyx the Unmaker, who breaks gear down into dust: tall and slender in a
// starry violet robe, long silver hair, glowing eyes, a crescent staff in one
// hand and a swirl of dust above the other palm. Her station is a crucible of
// dark stone on three legs, full of swirling violet dust.
// Tharn the Runesmith, who spends dust raising a piece's level: broad and
// short, bald with a glowing rune on his brow, a great braided ginger beard, a
// leather apron over a slate-blue shirt, and a rune hammer on his shoulder.
// His station is an anvil on a runed stone block, hot gold runes on its face.

import { hash2 } from './env';
import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { fbm } from './spirit';
import { BOOT, EYE, GOLD, LEATHER } from './palette';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------- Palette

export const WALL = ramp('#110e1a', '#1a1628', '#241e36', '#2f2846', '#3c3458', '#4b426c', '#5c5282', '#71669a');
export const CAPS = ramp('#0d0b15', '#15121f', '#1e1a2c', '#28223a', '#332c4a', '#3f375a');
export const TILE_A = ramp('#0b0a14', '#110f1f', '#17142a', '#1e1a36', '#262142', '#2f2950', '#39325f');
export const TILE_B = ramp('#0e0a16', '#150f22', '#1c142e', '#241a3a', '#2d2148', '#372856', '#433068');
export const PETAL_V = ramp('#140a26', '#20103a', '#2e1852', '#3e226c', '#523088', '#6a42a6', '#8458c4');
export const PETAL_R = ramp('#1a0c1c', '#28122a', '#3a1a3c', '#4e2450', '#643066', '#7c407e');
export const DAIS_ST = ramp('#14111e', '#1d1a2c', '#27233a', '#322d4a', '#3e385c', '#4b446e', '#5a5282');
export const GOLDS = ramp('#3a2008', '#6a3e12', '#9e6420', '#d69a3a', '#f4cf6a', '#fff4bf');
export const RUNNER = ramp('#16040b', '#2a0814', '#420e20', '#5c142c', '#781c3a', '#94284a');
export const MASS: RGB = hex('#06050b');
export const INK_R: RGB = hex('#050409');
export const VIOLET: RGB = [176, 120, 255];
export const GOLDEN: RGB = [255, 196, 96];
export const PALE: RGB = [236, 224, 255];
/** The rose window's glass, from the middle out: gold, then violet and rose petals, then blue and teal. */
export const GLASS: Record<string, RGB> = { gold: hex('#ffcc5a'), violet: hex('#9a5aff'), rose: hex('#ff6aa8'), blue: hex('#4a8aff'), teal: hex('#4ae0d4') };
/** Each keeper's colour: their dais ring and banner. */
export const KEEPER_TINT = { disenchant: 0xb078ff, upgrade: 0xffc060 } as const;
export const KEEPER_RGB: Record<'disenchant' | 'upgrade', RGB> = { disenchant: VIOLET, upgrade: GOLDEN };

export interface SanctumArt {
  diffuse: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  emissive: Uint8ClampedArray;
}

// ---------------------------------------------------------------- Materials

const INK = hex('#120e1f');
const GEM_V: Material = { ramp: ramp('#2a1060', '#5a2ab0', '#9a6af0', '#dcc8ff', '#ffffff'), outline: hex('#140828'), emissive: 0.7, shine: true, noAO: true };
const GEM_G: Material = { ramp: ramp('#5a2a08', '#a0580e', '#e09a28', '#ffd870', '#fff8d8'), outline: hex('#2a1004'), emissive: 0.8, shine: true, noAO: true };
const STONE_DK: Material = { ramp: ramp('#0e0c14', '#18141f', '#221d2c', '#2e273a', '#3a3248', '#474058'), outline: hex('#06050a'), outlineLit: hex('#1e1a28') };
export const IRON: Material = { ramp: ramp('#0c0c12', '#16161f', '#22222e', '#30303e', '#444454', '#5c5c70', '#8a8aa0'), outline: hex('#040408'), shine: true };
const DUST: Material = { ramp: ramp('#2a1060', '#4a22a0', '#7a48e0', '#b08cff', '#e8dcff'), outline: hex('#140828'), emissive: 0.85, noAO: true, noOutline: true };
const EMBERS: Material = { ramp: ramp('#5a1a04', '#a0400a', '#e08a20', '#ffc860', '#fff4c0'), outline: hex('#2a0a02'), emissive: 0.9, noAO: true, noOutline: true };

const front = (t: number): Vec3 => ({ x: t * 0.35, y: -0.4, z: 0.85 });
const top = (t = 0): Vec3 => ({ x: t * 0.2, y: 0.75, z: 0.65 });

// ---------------------------------------------------------------- Stone, slate and the lamplit doorway

export const FIELDSTONE: Material = { ramp: ramp('#2a262c', '#3a353c', '#4a444c', '#5c5560', '#726a72', '#8a8286', '#a49a96', '#bdb2a6'), outline: hex('#141018'), outlineLit: hex('#3a3238') };
export const ROOF_SLATE: Material = { ramp: ramp('#12151e', '#1a1f2c', '#232a3a', '#2d3648', '#384358', '#45526a', '#56657e'), outline: hex('#08090e'), outlineLit: hex('#1e2432') };
export const ROOF_MOSS: Material = { ramp: ramp('#15291a', '#1f3a20', '#2c4f26', '#3b652c', '#4f7e34', '#68993e', '#86b24c'), outline: hex('#0a160a') };
export const BUSH: Material = { ramp: ramp('#10240f', '#1a3616', '#264c1e', '#346428', '#467e32', '#5e9a3e'), outline: hex('#081206') };
export const OAK: Material = { ramp: ramp('#1c110b', '#2c1b11', '#402818', '#553722', '#6c472d'), outline: hex('#0c0604') };
export const HEARTH: Material = { ramp: ramp('#6a2a08', '#a8501a', '#e08a34', '#ffc466', '#fff0c4'), outline: hex('#2a0c02'), emissive: 0.85, noAO: true, noOutline: true };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** The dim hall seen through an open door. */
export const HALL_DARK: Material = { ramp: ramp('#07050a', '#0e0a0e', '#161012', '#201614', '#2c1e16', '#3a2818'), outline: hex('#050306'), noAO: true, noOutline: true };

/**
 * One pixel of the hall seen through an open doorway: dark deep inside, the
 * lamplight within falling warm on its floor and fading up into the dark,
 * dithered so it reads as depth rather than bands. `k` runs 0 at the arch's
 * top to 1 at the sill, `side` is the distance from the doorway's middle,
 * `fromSill` how many rows above the sill.
 */
export function doorway(c: PixelCanvas, x: number, y: number, side: number, k: number, fromSill: number): void {
  const n: Vec3 = { x: 0, y: 0, z: 1 };
  const warm = Math.max(0, (k - 0.5) / 0.5) ** 1.8 * (1 - side / 14);
  // Ordered dither, so the light fades in an even pattern rather than speckle.
  const d = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  // The hall's floor: a few rows of warm-lit flagstones running in.
  if (fromSill < 4) {
    const lit = d < 0.25 + warm * 0.6;
    c.px(x, y, lit ? HEARTH : HALL_DARK, n, lit ? { bias: -2 + (fromSill < 1 ? 1 : 0), glow: 0.25 + warm * 0.3 } : { bias: 5 });
    return;
  }
  if (d < warm * 0.55) c.px(x, y, HEARTH, n, { bias: -2, glow: 0.2 + warm * 0.2 });
  else c.px(x, y, HALL_DARK, n, { bias: Math.floor(k * 3.4 - side / 7 + d) });
}

export const RUNE_GLASS: Material = { ramp: ramp('#2a1060', '#4a2aa0', '#7a50e0', '#b096ff', '#eee4ff'), outline: hex('#140828'), emissive: 0.7, noAO: true };

export const GEM_FLOWER_PINK: Material = { ramp: ramp('#7a2a4a', '#c04a7a', '#f07aa8', '#ffc0d8'), outline: hex('#2a0a18') };
export const GEM_FLOWER_GOLD: Material = { ramp: ramp('#7a5a10', '#c09a20', '#f0d050', '#fff4b0'), outline: hex('#2a1a04') };

export const RUNESTONE_W = 16;
export const RUNESTONE_H = 44;
export const RUNESTONE_OY = 41;

/** A standing runestone: a tall rough stone, lichen and moss on it, violet runes glowing down its face. */
export function runestone(seed: number): PixelCanvas {
  const c = new PixelCanvas(RUNESTONE_W, RUNESTONE_H);
  const cx = 8;
  const topY = 4 + (seed % 2);
  c.part();
  c.shape(topY, 41, (y) => {
    const u = (y - topY) / (41 - topY);
    const hw = u < 0.12 ? 2.5 + (u / 0.12) * 2.5 : 5 + u * 1.4;
    const lean = (1 - u) * (seed % 2 ? 0.8 : -0.8);
    return [cx - hw + lean, cx + hw + lean];
  }, FIELDSTONE, (x, y, t) => {
    const n = cyl(t, 0.1);
    return { x: n.x, y: n.y + (fbm(x, y, 3, 431 + seed, 2) - 0.5) * 0.5, z: n.z };
  });
  for (let y = topY; y <= 41; y++) for (let x = 0; x < RUNESTONE_W; x++) if (fbm(x, y, 4, 433 + seed, 2) > 0.68) c.shade(x, y, 1);
  c.part();
  for (let y = topY + 5; y < 37; y++) {
    const k = y % 5;
    if (k === 4) continue;
    const g = hash2(Math.floor(y / 5), k, 435 + seed);
    if (g > 0.3) c.px(cx + (k === 1 ? (g > 0.6 ? 1 : -1) : 0), y, RUNE_GLASS, { x: 0, y: -0.2, z: 0.95 }, { glow: 0.75 });
  }
  c.part();
  c.ellipse(cx, 40, 7, 2.2, BUSH, { flatten: 0.7 });
  c.part();
  c.ellipse(cx + (seed % 2 ? -2 : 2), topY + 1.5, 2.6, 1.4, ROOF_MOSS, { bias: 1 });
  return c;
}

// ---------------------------------------------------------------- The floating crystal

export const CRYSTAL_W = 14;
export const CRYSTAL_H = 24;
export const CRYSTAL_FRAMES = 8;
const SHARD: Material = { ramp: ramp('#2a1060', '#46209a', '#6a3ad0', '#9a6af0', '#c8a8ff', '#f0e6ff'), outline: hex('#140828'), emissive: 0.5, shine: true, noAO: true };

/** A violet crystal turning slowly in the air: frame `f` of CRYSTAL_FRAMES. */
export function runeCrystal(f: number): PixelCanvas {
  const c = new PixelCanvas(CRYSTAL_W, CRYSTAL_H);
  const cx = 7;
  const a = (f / CRYSTAL_FRAMES) * Math.PI;
  const hw = 3.2 + Math.abs(Math.cos(a)) * 1.8;
  const ridge = Math.sin(a * 2) * hw * 0.5;
  const mid = 9;
  c.part();
  c.shape(1, 22, (y) => {
    const w = y < mid ? ((y + 0.5 - 1) / (mid - 1)) * hw : ((22.5 - y) / (22 - mid)) * hw;
    return w > 0.3 ? [cx - w, cx + w] : null;
  }, SHARD, (x, y, t) => {
    const side = x + 0.5 - cx < ridge ? -1 : 1;
    return { x: side * 0.7 + t * 0.1, y: y < mid ? 0.45 : -0.2, z: 0.6 };
  }, { glow: 0.5 });
  c.part();
  for (let y = 3; y < 20; y++) if (Math.abs(y - mid) < 6) c.spark(cx + ridge * 0.4, y, [220, 200, 255], 0.5 - Math.abs(y - mid) / 14);
  return c;
}

// ---------------------------------------------------------------- The keepers' stations

export const STATION_FRAMES = 6;
export const CRUCIBLE_W = 30;
export const CRUCIBLE_H = 32;
export const CRUCIBLE_OY = 29;

/** Nyx's crucible: dark stone on three clawed legs, gold-rimmed, full of swirling violet dust. */
export function dustCrucible(f: number): PixelCanvas {
  const c = new PixelCanvas(CRUCIBLE_W, CRUCIBLE_H);
  const cx = 15;
  const ph = (f / STATION_FRAMES) * Math.PI * 2;
  for (const [lx, back] of [
    [cx, true],
    [cx - 8, false],
    [cx + 8, false],
  ] as [number, boolean][]) {
    c.part();
    c.capsule(lx + (lx - cx) * 0.1, 21, lx + (lx - cx) * 0.2, 28, 1.6, 1.2, IRON, { bias: back ? -1 : 0 });
    c.part();
    c.ellipse(lx + (lx - cx) * 0.2, 28.5, 2.2, 1, IRON, { flatten: 0.7 });
  }
  c.part();
  c.shape(13, 24, (y) => {
    const u = (y - 13) / 11;
    const hw = 12 - u * u * 5;
    return [cx - hw, cx + hw];
  }, STONE_DK, (_x, y, t) => sphere(t * 0.9, (18 - y) / 12, 1));
  // Runes round the bowl's belly, pulsing.
  c.part();
  for (let x = cx - 9; x <= cx + 9; x += 3) {
    const k = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(ph + x * 0.7));
    c.px(x, 18, DUST, sphere((x - cx) / 12, 0), { glow: k });
    if (hash2(x, 1, 383) > 0.4) c.px(x + 1, 19, DUST, sphere((x - cx) / 12, 0), { glow: k * 0.8 });
  }
  // The gold rim, and the dust inside it wheeling round.
  c.part();
  c.ellipse(cx, 13, 12.5, 3, GOLD, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, -dy * 0.5 + 0.4, 1) });
  c.part();
  for (let y = 11; y <= 15; y++) {
    for (let x = cx - 11; x <= cx + 11; x++) {
      const dx = (x + 0.5 - cx) / 10.5;
      const dy = (y + 0.5 - 13) / 2.2;
      const r = Math.hypot(dx, dy);
      if (r > 1) continue;
      const a = Math.atan2(dy, dx);
      const s = Math.sin(a * 2 - ph + r * 5) * 0.5 + 0.5;
      c.px(x, y, DUST, { x: 0, y: 0.3, z: 0.95 }, { bias: Math.round(s * 2 - r), glow: 0.5 + s * 0.45 });
    }
  }
  // Motes of dust rising off it.
  for (let k = 0; k < 5; k++) {
    const t = (f / STATION_FRAMES + k / 5) % 1;
    const x = cx + Math.sin(k * 2.3 + t * 5) * (4 + k);
    const y = 11 - t * 10;
    c.spark(x, y, k % 2 ? [220, 190, 255] : [150, 100, 255], 1 - t);
  }
  return c;
}

export const ANVIL_W = 34;
export const ANVIL_H = 30;
export const ANVIL_OY = 27;

/** Tharn's anvil: dark iron on a runed stone block, a rune glowing hot on its face. */
export function runeAnvil(f: number): PixelCanvas {
  const c = new PixelCanvas(ANVIL_W, ANVIL_H);
  const cx = 17;
  const pulse = 0.5 + 0.5 * Math.sin((f / STATION_FRAMES) * Math.PI * 2);
  c.part();
  c.shape(16, 27, (y) => [cx - (y > 25 ? 11 : 10), cx + (y > 25 ? 11 : 10)], STONE_DK, (_x, y, t) => (y === 16 ? top(t) : front(t)), { bias: 1 });
  // Gold runes cut into the block's face.
  c.part();
  for (let x = cx - 8; x <= cx + 8; x++) {
    for (let y = 19; y <= 24; y++) {
      const k = x - (cx - 8);
      if (k % 4 === 3) continue;
      if (hash2(Math.floor(k / 4), y * 5 + (k % 4), 391) > 0.55) c.px(x, y, GEM_G, front(0), { glow: 0.35 + pulse * 0.45 });
    }
  }
  // The anvil: foot, waist, face and horn.
  c.part();
  c.shape(13, 16, (y) => [cx - (y > 14 ? 7 : 5), cx + (y > 14 ? 7 : 5)], IRON, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  c.shape(10, 13, () => [cx - 3.5, cx + 3.5], IRON, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.shape(6, 10, (y) => [cx - 9 - (y - 6) * 0.2, cx + 10], IRON, (_x, y, t) => (y < 8 ? top(t) : front(t)), { bias: 1 });
  c.part();
  c.shape(7, 9, (y) => [cx - 15 + (y - 7) * 1.5, cx - 8], IRON, (_x, y, t) => (y === 7 ? top(t) : cyl(t, 0.3)));
  // The hot rune on its face, and sparks when it flares.
  c.part();
  for (const [x, y] of [
    [cx - 1, 6],
    [cx, 7],
    [cx + 1, 6],
    [cx, 6],
    [cx + 2, 7],
    [cx - 2, 7],
  ]) c.px(x, y, EMBERS, top(0), { glow: 0.45 + pulse * 0.55 });
  if (pulse > 0.6) {
    for (let k = 0; k < 4; k++) c.spark(cx - 3 + k * 2 + (f % 2), 4 - ((k + f) % 3), [255, 210, 120], pulse - k * 0.12);
  }
  return c;
}

// ---------------------------------------------------------------- The keepers

export const KEEPER_W = 30;
export const KEEPER_H = 38;
/** Feet in the frame. */
export const KEEPER_OX = 15;
export const KEEPER_OY = 35;
export const KEEPER_FRAMES = 6;

const ROBE_V: Material = { ramp: ramp('#160c2a', '#24143e', '#341e58', '#482a78', '#5e3a9a', '#7a52c0'), outline: INK, outlineLit: hex('#2a1c4a') };
const ROBE_DK: Material = { ramp: ramp('#0e0818', '#180e28', '#22143a', '#2e1c4c'), outline: INK };
const SILVER: Material = { ramp: ramp('#3c3458', '#645a8a', '#9a90c0', '#d4ccf0', '#f4f0ff'), outline: hex('#1a1630'), outlineLit: hex('#3a3258') };
const PALE_SKIN: Material = { ramp: ramp('#5a4a68', '#9a82a6', '#d4bcd4', '#f4e6f0'), outline: hex('#24182e'), outlineLit: hex('#3e2e4c') };
const EYE_GLOW: Material = { ramp: ramp('#c8a8ff', '#f4ecff'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const STAFF: Material = { ramp: ramp('#1a1016', '#2c1c22', '#44302e', '#5e443a'), outline: hex('#0a0608') };

/** Nyx the Unmaker, frame `f`: she breathes, her staff's orb pulses and dust wheels over her palm. */
export function unmaker(f: number): PixelCanvas {
  const c = new PixelCanvas(KEEPER_W, KEEPER_H);
  const cx = 15;
  const ph = (f / KEEPER_FRAMES) * Math.PI * 2;
  const U = Math.sin(ph) * 0.5;
  const pulse = 0.5 + 0.5 * Math.sin(ph);

  // Long silver hair falling behind her, and a high collar.
  c.part();
  c.shape(9 + U, 23, (y) => {
    const u = (y - 9 - U) / 14;
    const hw = 4.2 + u * 0.8;
    return [cx - hw, cx + hw];
  }, SILVER, (_x, _y, t, u) => sphere(t * 0.9, 0.3 - u * 0.4, 1), { bias: -1 });
  c.part();
  c.shape(12 + U, 16 + U, (y) => {
    const hw = 5.6 - (y - 12 - U) * 0.2;
    return [cx - hw, cx + hw];
  }, ROBE_DK, (_x, _y, t) => cyl(t, 0.2));

  // The staff, behind her left hand: dark wood, a gold crescent, an orb of dust.
  const sx = cx - 8;
  c.part();
  c.capsule(sx, 7, sx, 34, 0.7, 0.8, STAFF);
  c.part();
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI * 0.15 + (k / 10) * Math.PI * 1.7;
    c.px(sx + Math.cos(a + Math.PI / 2) * 3, 5 + Math.sin(a + Math.PI / 2) * 3, GOLD, sphere(Math.cos(a + Math.PI / 2) * 0.8, -Math.sin(a + Math.PI / 2) * 0.8));
  }
  c.part();
  c.ellipse(sx, 4.5, 1.7, 1.7, DUST, { glow: 0.55 + pulse * 0.45 });
  c.spark(sx, 1 + (f % 3), [220, 200, 255], 0.5 + pulse * 0.4);

  // The robe, flaring to the floor, stars stitched in its hem.
  c.part();
  c.shape(15 + U, 34, (y) => {
    const hw = y < 22 + U ? 4.3 + (y - 15 - U) * 0.1 : 5 + (y - 22 - U) * 0.3;
    return [cx - hw, cx + hw];
  }, ROBE_V, (_x, y, t) => sphere(t * 0.9, y < 22 ? 0.1 : 0.25, 1));
  for (let y = Math.ceil(24 + U); y <= 33; y++) {
    c.shade(cx - 3, y, -1);
    c.shade(cx + 2, y, -1);
  }
  c.part();
  for (let x = cx - 8; x <= cx + 8; x++) c.px(x, 34, GOLD, sphere((x - cx) / 9, -0.2));
  for (const [x, y] of [
    [cx - 4, 30],
    [cx + 3, 28],
    [cx - 1, 32],
    [cx + 5, 32],
    [cx - 6, 33],
  ]) c.spark(x, y, [230, 214, 255], 0.35 + 0.35 * Math.sin(ph + x));
  // A gold sash with a violet gem.
  c.part();
  c.shape(Math.round(22 + U), Math.round(22 + U), () => [cx - 4.9, cx + 4.9], GOLD, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx, 22 + U, GEM_V, sphere(0, 0.2), { glow: 0.9 });
  // A mantle over the shoulders.
  c.part();
  c.ellipse(cx, 16.3 + U, 5.8, 2.3, ROBE_DK, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, -dy * 0.4 + 0.4, 1) });

  // Her arms: one down to the staff, one held out palm up.
  c.part();
  c.capsule(cx - 5, 17 + U, sx + 1.2, 22 + U, 1.7, 2.1, ROBE_V);
  c.part();
  c.ellipse(sx + 0.6, 22.5 + U, 1.4, 1.3, PALE_SKIN);
  c.part();
  c.capsule(cx + 5, 17 + U, cx + 8, 21 + U, 1.7, 2.2, ROBE_V);
  c.part();
  c.ellipse(cx + 8.6, 21.4 + U, 1.5, 1.1, PALE_SKIN);
  // Dust wheeling over her palm.
  for (let k = 0; k < 6; k++) {
    const a = ph + (k / 6) * Math.PI * 2;
    const x = cx + 8.6 + Math.cos(a) * 3.2;
    const y = 17.5 + U + Math.sin(a) * 1.3 - (k % 2) * 0.8;
    c.spark(x, y, k % 3 ? [180, 130, 255] : [240, 228, 255], Math.sin(a) > 0 ? 0.95 : 0.55);
  }

  // Her head: pale, silver hair in front, a gold circlet, eyes aglow.
  c.part();
  c.ellipse(cx, 11.6 + U, 3.1, 3.3, PALE_SKIN);
  c.part();
  c.shape(Math.round(8 + U), Math.round(9.6 + U), () => [cx - 3.5, cx + 3.5], SILVER, (_x, y, t) => sphere(t * 0.8, 0.5 - (y - 8) * 0.2, 1));
  c.capsule(cx - 3.4, 10 + U, cx - 3.8, 18 + U, 1.1, 1.3, SILVER);
  c.capsule(cx + 3.4, 10 + U, cx + 3.8, 18 + U, 1.1, 1.3, SILVER);
  c.part();
  for (let x = cx - 3; x <= cx + 3; x++) c.px(x, 9 + U, GOLD, sphere((x - cx) / 4, 0.3));
  c.part();
  c.px(cx, 8.6 + U, GEM_V, sphere(0, 0.4), { glow: 1 });
  c.part();
  c.px(cx - 1.5, 12 + U, EYE_GLOW);
  c.px(cx + 1.5, 12 + U, EYE_GLOW);
  c.shade(cx, 14 + U, -1);
  return c;
}

const SLATE: Material = { ramp: ramp('#10141f', '#1a2032', '#26304a', '#344362', '#46587e', '#5c729c'), outline: INK, outlineLit: hex('#222a40') };
const RUDDY: Material = { ramp: ramp('#5a2a26', '#944a3a', '#cc7a5a', '#eeaa82', '#fbd2b0'), outline: hex('#2a1210'), outlineLit: hex('#4a2420') };
const GINGER: Material = { ramp: ramp('#4a2412', '#7e3e1a', '#b4602a', '#dc8a44', '#f4ba78'), outline: hex('#200c06'), outlineLit: hex('#3a1a0c') };
const TROUSER: Material = { ramp: ramp('#140f0c', '#221a14', '#32261c', '#443426'), outline: INK };

/** Tharn the Runesmith, frame `f`: he breathes, lifts his hammer a touch, and its rune and his flare. */
export function runesmith(f: number): PixelCanvas {
  const c = new PixelCanvas(KEEPER_W, KEEPER_H);
  const cx = 14;
  const ph = (f / KEEPER_FRAMES) * Math.PI * 2;
  const U = Math.sin(ph) * 0.5;
  const pulse = 0.5 + 0.5 * Math.sin(ph);
  const lift = f === 2 || f === 3 ? -1 : 0;

  // Legs and boots.
  for (const s of [-1, 1]) {
    c.part();
    c.capsule(cx + s * 2.8, 28, cx + s * 3, 32, 2, 1.8, TROUSER);
    c.part();
    c.ellipse(cx + s * 3.2, 33.3, 2.6, 1.6, BOOT, { flatten: 0.8 });
  }
  // A broad body in a slate shirt, a leather apron over it.
  c.part();
  c.shape(17 + U, 29, (y) => {
    const u = (y - 17 - U) / (12 - U);
    const hw = 6.2 - u * 0.4 + Math.sin(u * Math.PI) * 0.6;
    return [cx - hw, cx + hw];
  }, SLATE, (_x, y, t) => sphere(t * 0.9, (21 - y) / 12, 1));
  c.part();
  c.shape(20 + U, 31, (y) => {
    const hw = 4.2 + (y - 20 - U) * 0.08;
    return [cx - hw, cx + hw];
  }, LEATHER, (_x, _y, t) => sphere(t * 0.8, 0.1, 1));
  for (const s of [-1, 1]) {
    c.part();
    c.capsule(cx + s * 3.6, 17.5 + U, cx + s * 3.4, 20.5 + U, 0.5, 0.5, LEATHER);
  }
  // The belt with its buckle, and the rune stitched on the apron.
  c.part();
  c.shape(Math.round(24 + U), Math.round(24 + U), () => [cx - 6.3, cx + 6.3], TROUSER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx, 24 + U, GOLD, sphere(0, 0.2));
  c.part();
  for (const [x, y] of [
    [cx - 1, 27],
    [cx, 26],
    [cx + 1, 27],
    [cx, 28],
    [cx, 29],
  ]) c.px(x, y + U, GEM_G, sphere(0, 0), { glow: 0.3 + pulse * 0.5 });

  // His left arm hangs at his side, sleeve rolled to a thick forearm.
  c.part();
  c.capsule(cx - 6.2, 18.5 + U, cx - 7.4, 22 + U, 2.1, 1.9, SLATE);
  c.part();
  c.capsule(cx - 7.4, 22 + U, cx - 7.2, 25.5 + U, 1.7, 1.6, RUDDY);
  c.part();
  c.ellipse(cx - 7.1, 26.4 + U, 1.8, 1.7, RUDDY);

  // The rune hammer over his right shoulder.
  const hx = cx + 9;
  const hy = 8 + lift;
  c.part();
  c.capsule(cx + 7.6, 24 + U, hx - 0.5, hy + 3, 0.8, 0.8, STAFF);
  c.part();
  c.shape(hy - 3, hy + 3, (y) => [hx - 3.6 + (y > hy + 1 ? 0.4 : 0), hx + 3.6 - (y > hy + 1 ? 0.4 : 0)], IRON, (_x, y, t) => (y === hy - 3 ? top(t) : cyl(t, 0.2)), { bias: 1 });
  c.part();
  for (let y = hy - 2; y <= hy + 2; y++) {
    c.px(hx - 3, y, GOLD, cyl(-0.8, 0.2));
    c.px(hx + 2.6, y, GOLD, cyl(0.8, 0.2));
  }
  c.part();
  c.px(hx, hy - 1, GEM_G, front(0), { glow: 0.5 + pulse * 0.5 });
  c.px(hx - 1, hy, GEM_G, front(0), { glow: 0.5 + pulse * 0.5 });
  c.px(hx + 1, hy, GEM_G, front(0), { glow: 0.5 + pulse * 0.5 });
  c.px(hx, hy + 1, GEM_G, front(0), { glow: 0.5 + pulse * 0.5 });
  // His right arm, holding it.
  c.part();
  c.capsule(cx + 6.2, 18.5 + U, cx + 7.8, 21 + U, 2.1, 1.9, SLATE);
  c.part();
  c.capsule(cx + 7.8, 21 + U, cx + 7.8, 23.5 + U, 1.7, 1.6, RUDDY);
  c.part();
  c.ellipse(cx + 7.8, 24 + U, 1.8, 1.7, RUDDY);

  // The head: bald and broad, a rune glowing on the brow, a great braided beard.
  c.part();
  c.ellipse(cx, 11.8 + U, 3.7, 3.5, RUDDY);
  c.part();
  c.px(cx, 9 + U, GEM_G, sphere(0, 0.6), { glow: 0.5 + pulse * 0.5 });
  c.px(cx - 1, 9.6 + U, GEM_G, sphere(0, 0.6), { glow: 0.3 + pulse * 0.4 });
  c.px(cx + 1, 9.6 + U, GEM_G, sphere(0, 0.6), { glow: 0.3 + pulse * 0.4 });
  c.part();
  c.shape(13 + U, 25 + U, (y) => {
    const u = (y - 13 - U) / 12;
    const hw = u < 0.25 ? 4 + u * 3 : 4.75 - (u - 0.25) * 4.4;
    return hw > 0.6 ? [cx - hw, cx + hw] : null;
  }, GINGER, (_x, y, t) => sphere(t * 0.9, (17 - y) / 10, 1));
  for (let y = Math.ceil(16 + U); y < 24 + U; y++) {
    c.shade(cx - 1, y, -1);
    c.shade(cx + 1, y, -1);
  }
  c.part();
  for (let x = cx - 2; x <= cx + 2; x++) c.px(x, 21 + U, GOLD, sphere((x - cx) / 3, 0.1));
  c.part();
  c.shape(Math.round(13.6 + U), Math.round(13.6 + U), () => [cx - 3.4, cx + 3.4], GINGER, (_x, _y, t) => sphere(t * 0.8, 0.4, 1), { bias: 1 });
  c.part();
  for (const s of [-1, 1]) {
    c.px(cx + s * 1.5, 10.4 + U, GINGER, sphere(0, 0.5), { bias: 1 });
    c.px(cx + s * 2.5, 10.4 + U, GINGER, sphere(0, 0.5), { bias: 1 });
    c.px(cx + s * 1.6, 11.6 + U, EYE);
  }
  c.shade(cx, 12.6 + U, -1);
  return c;
}

// ---------------------------------------------------------------- Light through the windows

export const GODRAY_W = 60;
export const GODRAY_H = 168;
/** Where a shaft meets the floor, in its frame. */
export const GODRAY_FOOT_X = 40;

/**
 * A shaft of light falling from a high window (top left of the frame) to
 * the floor (bottom), widening as it goes. White and premultiplied, for
 * additive blending and tinting: gold by day, pale blue by moonlight. The
 * brightness falls off in a few flat steps, so it reads as pixel art.
 */
export function godRay(seed: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(GODRAY_W * GODRAY_H * 4);
  const strands = [0, 1, 2, 3].map((k) => ({ at: (hash2(k, seed, 451) - 0.5) * 1.4, w: 0.18 + hash2(k, seed, 453) * 0.25, a: 0.3 + hash2(k, seed, 457) * 0.5 }));
  for (let y = 0; y < GODRAY_H; y++) {
    const u = y / GODRAY_H;
    const cx = 18 + (GODRAY_FOOT_X - 18) * u;
    const hw = 6 + u * 11;
    // Faint where it leaves the glass, full through the air, softer where it lands.
    const along = Math.min(1, 0.35 + u / 0.3) * (u > 0.84 ? 1 - ((u - 0.84) / 0.16) * 0.75 : 1);
    for (let x = 0; x < GODRAY_W; x++) {
      const t = (x + 0.5 - cx) / hw;
      if (Math.abs(t) > 1.5) continue;
      let a = Math.max(0, 1 - (t * t) / 2.25) ** 1.5 * 0.5;
      for (const s of strands) {
        const d = (t - s.at) / s.w;
        if (Math.abs(d) < 1) a += (1 - d * d) * s.a * 0.5;
      }
      a = Math.round(Math.min(1, a * along) * 8) / 8;
      const i = (y * GODRAY_W + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = Math.round(255 * a * 0.6);
      px[i + 3] = 255;
    }
  }
  return px;
}
