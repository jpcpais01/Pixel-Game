// The Snow Queen, Mistress of the Frozen Mirror: the Aurora Colosseum's
// second Legend. Tall and still as a figure carved in ice: a bell gown of
// snow pleated to the floor, its front a panel of mirror-ice, its hem a
// fringe of crystals; a bodice of silver; a great fan of ice crystals
// standing behind her head like a collar; a crown of crystal spikes on long
// silver hair; and behind her, sweeping the floor, a train of royal violet
// edged with rime. Her scepter is tipped with a snowflake of living light.
//
// Drawn three-quarters on, turned to the right (the world mirrors her). She
// never walks: she glides, her hem trailing behind her. Her poses: breathing
// at rest, gliding, the scepter raised (calling her reflections), the scepter
// levelled (the mirror beam), and arms flung wide in her blizzard.
//
// And her spells: the mirror shards that circle her (sq_mirror), the beam
// (sq_beam) and a glint of light (sq_glint).

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { FLAT, PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { bayer, clamp01 } from './bitmap';
import { hash2 } from './env';
import { C_ICE, C_VIOLET, C_WHITE, GLOW_ICE, ICE, ICE_DARK, ICE_GLOW, PALE, RIME, SILVER, SNOW, VELVET, crystal, poly, ramp, type FxRegistrar } from './frostKit';

const F = MONSTER_FRAME.snowqueen;
const CX = 38;
const FOOT = F.oy - 1;

/** Her hair: silver going lilac in its shadows. */
const HAIR: Material = { ramp: ramp('#3e3a5e', '#625e88', '#9290b8', '#c4c4e0', '#eceefa'), outline: hex('#141228'), outlineLit: hex('#2a2846') };
/** The gown's snow, a little brighter and cooler than the floor's. */
const GOWN: Material = { ...SNOW, ramp: ramp('#56648e', '#7888b4', '#a2b4d8', '#cad8f0', '#e8f2fc', '#ffffff') };
/** Her lips and the lining's shadow. */
const LIP: Material = { ramp: ramp('#3a2050', '#5a3478'), outline: hex('#140a20'), noAO: true };
const EYE: Material = { ...GLOW_ICE };
/** Her face: porcelain, palest of all. */
const FACE: Material = { ...PALE, ramp: ramp('#5a6684', '#8e9ab8', '#bcc8de', '#e0e8f6', '#f8fbff') };
/** The scepter's snowflake and the gem at her breast: cold fire. */
const STAR: Material = { ...ICE_GLOW, emissive: 1 };

/** Debris tints: mirror-white, ice and a violet glint. */
export const SNOWQUEEN_TINTS = [0xffffff, 0xe0f8ff, 0x9ae8ff, 0xcdb4ff];
/** The scepter's tip above her feet in her beam pose (facing right), for where the beam leaves. */
export const SQ_BEAM_TIP = { x: 31, y: 52 };
/** The gem on her breast above her feet. */
export const SQ_HEART_Y = 51;

type Mood = 'idle' | 'glide' | 'cast' | 'beam' | 'spin';

interface Pose {
  t: number;
  mood: Mood;
  /** 0..1 how brightly her ice burns. */
  flare?: number;
}

/** The scepter: a silver rod from (x0, y0) to its tip (x1, y1), and a six-pointed snowflake of light at the tip. */
function scepter(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, flare: number): void {
  c.part();
  c.line(x0, y0, x1, y1, SILVER, () => cyl(-0.3, 0.3));
  c.part();
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  // A little cradle of silver holding the star.
  c.px(x1 - ux * 2 + uy, y1 - uy * 2 - ux, SILVER, sphere(-0.4, 0.4));
  c.px(x1 - ux * 2 - uy, y1 - uy * 2 + ux, SILVER, sphere(0.4, 0.4));
  const r = 2.6 + flare * 1.2;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 2;
    c.line(x1, y1, x1 + Math.cos(a) * r, y1 + Math.sin(a) * r, STAR);
    c.spark(x1 + Math.cos(a) * (r + 1), y1 + Math.sin(a) * (r + 1), C_ICE, 0.4 + flare * 0.4);
  }
  c.px(x1, y1, STAR);
  c.spark(x1, y1, C_WHITE, 1);
}

/** The collar: a fan of crystals standing up behind her head. */
function collar(c: PixelCanvas, x: number, y: number, flare: number, wide: number): void {
  const n = 9;
  for (const pass of [0, 1]) {
    for (let k = 0; k < n; k++) {
      if (k % 2 !== pass) continue;
      const u = k / (n - 1);
      const a = -Math.PI / 2 + (u - 0.5) * (2.5 + wide * 0.4);
      const mid = 1 - Math.abs(u - 0.5) * 2;
      const len = 9 + mid * 9 + hash2(k, 5, 2) * 2 + flare * 2;
      const bx = x + Math.cos(a) * 3;
      const by = y + Math.sin(a) * 2;
      c.part();
      crystal(c, bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, pass ? 2.2 : 1.9, pass ? ICE : ICE_DARK, pass && mid > 0.5 ? C_WHITE : null);
      if (pass && len > 12) {
        c.part();
        for (let s = 0.25; s < 0.7; s += 0.15) c.px(bx + Math.cos(a) * len * s, by + Math.sin(a) * len * s, GLOW_ICE, FLAT, { glow: 0.45 + flare * 0.4 });
      }
    }
  }
}

function queen(p: Pose): PixelCanvas {
  const c = new PixelCanvas(F.w, F.h);
  const tau = p.t * Math.PI * 2;
  const flare = p.flare ?? 0;
  const breathe = Math.sin(tau) * 0.5;
  const glide = p.mood === 'glide';
  const spin = p.mood === 'spin';
  // How far her hem trails behind (to the left) and her lean forward.
  const trail = glide ? 5 + Math.sin(tau * 2) * 1 : spin ? -1 : Math.sin(tau) * 1;
  const lean = glide ? 1 : 0;
  const waistY = 47;
  const shoulderY = 33 + Math.round(breathe * 0.5);
  const headY = 23 + Math.round(breathe * 0.5);
  const hx = CX + 1 + lean;

  // The train: royal violet sweeping the floor behind her, rime along its edge.
  c.part();
  const capeBack = spin ? 33 : glide ? 32 : 33;
  poly(
    c,
    [
      [CX - 3 + lean, shoulderY - 1],
      [CX - 9 + lean, shoulderY + 4],
      [CX - 14 - trail * 0.5, waistY + 8],
      [CX - capeBack - trail, FOOT - 3 + Math.sin(tau) * 1],
      [CX - capeBack + 6 - trail, FOOT],
      [CX - 4, FOOT],
      [CX, waistY],
    ],
    VELVET,
    (x, y) => {
      const u = clamp01((y - shoulderY) / (FOOT - shoulderY));
      // Deep folds running down the train.
      const fold = Math.sin(x * 0.75 + y * 0.18 + tau) * 0.55;
      return { x: -0.35 + fold, y: 0.25 - u * 0.4, z: 0.75 };
    },
  );
  for (let y = waistY + 6; y < FOOT; y++) {
    const u = (y - waistY - 6) / (FOOT - waistY - 6);
    const x = Math.round(CX - 14 - trail * 0.5 + (-(capeBack - 14) - trail * 0.5) * u * 1.02);
    for (let k = 0; k < 2; k++) if (c.materialAt(x + k, y) === VELVET) c.px(x + k, y, RIME, sphere(-0.4, 0.2));
  }

  // Her hair falling down her back.
  c.part();
  const sway = Math.sin(tau + 0.6) * (glide ? 1.5 : 0.8) - (glide ? 2 : 0) - (spin ? 2 : 0);
  for (let y = headY - 4; y <= waistY + 5; y++) {
    const u = (y - headY + 4) / (waistY + 9 - headY);
    const hw = 4.5 - u * 1.5 + (spin ? 2 : 0) * u;
    const x = CX - 3 + sway * u - u * 3;
    c.shape(y, y, () => [x - hw, x + hw * 0.7], HAIR, (px, _y, t) => ({ x: t * 0.6 + Math.sin(px * 1.7 + y * 0.4) * 0.35, y: 0.2, z: 0.8 }));
  }

  // The collar of crystals, standing up behind her head.
  collar(c, hx - 1, shoulderY, flare, spin ? 1 : 0);

  // The gown: a bell of snow pleated to the floor, the hem trailing.
  c.part();
  const pleat = (x: number) => Math.sin((x - CX) * 0.9 + 0.5);
  const flareHem = spin ? 5 : 0;
  c.shape(waistY - 1, FOOT, (y) => {
    const u = (y - waistY) / (FOOT - waistY);
    const hw = 6 + Math.pow(Math.max(0, u), 1.25) * (19 + flareHem) + Math.sin(u * 5 + tau) * 0.4;
    const shift = -trail * Math.pow(Math.max(0, u), 1.6) + lean * (1 - u);
    return [CX + shift - hw, CX + shift + hw * 0.92];
  }, GOWN, (x, _y, t, u) => {
    const s = pleat(x + Math.round(u * 2));
    return { x: t * 0.55 + s * 0.4, y: 0.25 - u * 0.25, z: 0.8 };
  });
  // Its front a panel of mirror-ice, reflecting the sky.
  c.part();
  c.shape(waistY, FOOT - 2, (y) => {
    const u = (y - waistY) / (FOOT - waistY);
    const hw = 2 + u * 6;
    const x = CX + 3 + lean * (1 - u) - trail * Math.pow(u, 1.6) * 0.8 + u * 2;
    return [x - hw, x + hw];
  }, ICE, (_x, _y, t, u) => ({ x: t * 0.5, y: 0.45 - u * 0.3, z: 0.75 }));
  // A streak of reflected light across the mirror.
  for (let k = 0; k < 7; k++) c.spark(CX + 1 + k * 0.7 + (glide ? -1 : 0), waistY + 14 + k * 2, C_WHITE, 0.35 + flare * 0.3);
  // Embroidered snowflakes of light on the snow.
  for (let k = 0; k < 9; k++) {
    const u = 0.2 + hash2(k, 1, 7) * 0.75;
    const y = Math.round(waistY + u * (FOOT - waistY));
    const hw = 6 + Math.pow(u, 1.25) * 19;
    const x = Math.round(CX - trail * Math.pow(u, 1.6) - hw * 0.85 + hash2(k, 2, 7) * hw * 0.8);
    if (c.materialAt(x, y) !== GOWN) continue;
    c.spark(x, y, C_ICE, 0.35 + flare * 0.25);
    c.spark(x - 1, y, C_ICE, 0.15);
    c.spark(x + 1, y, C_ICE, 0.15);
    c.spark(x, y - 1, C_ICE, 0.15);
    c.spark(x, y + 1, C_ICE, 0.15);
  }
  // Its hem: a band of rime and a fringe of crystals pointing down and out.
  c.part();
  const hemHW = 25 + flareHem;
  const hemX = CX - trail;
  for (let x = Math.floor(hemX - hemHW); x <= Math.ceil(hemX + hemHW * 0.92); x++) {
    for (let y = FOOT - 3; y <= FOOT; y++) if (c.materialAt(x, y) === GOWN) c.px(x, y, RIME, sphere((x - hemX) / hemHW, -0.3));
  }
  // Scallops of rime along the hem, each with a glint.
  for (let x = Math.floor(hemX - hemHW) + 1; x <= Math.ceil(hemX + hemHW * 0.92) - 1; x++) {
    const k = (((x - Math.floor(hemX)) % 4) + 4) % 4;
    if (k === 0) continue;
    c.px(x, FOOT + 1, RIME, sphere((x - hemX) / hemHW, -0.5));
    if (k === 2) c.spark(x, FOOT, C_ICE, 0.35);
  }

  // The far arm, behind the bodice (flung out in the blizzard).
  c.part();
  if (spin) {
    c.capsule(CX - 4, shoulderY + 1, CX - 13, shoulderY - 3, 1.8, 1.4, PALE, { bias: -1 });
    c.capsule(CX - 13, shoulderY - 3, CX - 22, shoulderY - 9, 1.4, 1.1, PALE, { bias: -1 });
    c.capsule(CX - 10, shoulderY - 1, CX - 20, shoulderY - 6, 2.6, 3.4, ICE, { bias: -1 });
    c.spark(CX - 23, shoulderY - 10, C_WHITE, 0.8);
  } else if (p.mood === 'cast') {
    c.capsule(CX - 4, shoulderY + 1, CX - 8, shoulderY + 7, 1.8, 1.3, PALE, { bias: -1 });
    c.capsule(CX - 8, shoulderY + 7, CX - 4, waistY + 1, 1.3, 1.1, PALE, { bias: -1 });
  }

  // The bodice: silver, laced with ice, a gem of cold light at her breast.
  c.part();
  c.shape(shoulderY, waistY, (y) => {
    const u = (y - shoulderY) / (waistY - shoulderY);
    const hw = 7 - u * 2.2 + Math.sin(u * Math.PI) * 0.6;
    const x = CX + lean + u * 0;
    return [x - hw, x + hw];
  }, SILVER, (_x, _y, t, u) => cyl(t, 0.3 - u * 0.2));
  c.part();
  for (let y = shoulderY + 3; y < waistY; y++) {
    const u = (y - shoulderY) / (waistY - shoulderY);
    const hw = 3.2 - u * 1.8;
    for (let x = Math.round(CX + 1 + lean - hw); x <= Math.round(CX + 1 + lean + hw); x++) c.px(x, y, ICE, { x: (x - CX - 1) * 0.15, y: 0.3, z: 0.9 });
  }
  c.part();
  c.ellipse(CX + 1.5 + lean, shoulderY + 5, 1.7, 2.1, STAR);
  c.spark(CX + 1 + lean, shoulderY + 4, C_WHITE, 0.9);
  c.spark(CX + 1 + lean, shoulderY + 2, C_VIOLET, 0.4);
  // Crystal pauldrons at her shoulders.
  c.part();
  crystal(c, CX - 6 + lean, shoulderY + 2, CX - 9 + lean, shoulderY - 3, 2, ICE_DARK, null);
  crystal(c, CX + 7 + lean, shoulderY + 2, CX + 10 + lean, shoulderY - 3, 2.2, ICE, C_WHITE);

  // Her neck and face, turned to the right; silver hair framing it.
  c.part();
  c.capsule(hx, shoulderY - 1, hx + 0.5, headY + 3, 1.6, 1.8, PALE);
  c.part();
  c.ellipse(hx - 1, headY - 2, 6.2, 5.6, HAIR);
  c.part();
  c.ellipse(hx + 1.5, headY, 4.6, 5.3, FACE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6 - 0.1, dy * 0.8, 1) });
  // Bangs swept across the brow, and a lock falling before her ear.
  c.part();
  c.shape(headY - 6, headY - 4, (y) => [hx - 4 + (y - headY + 6) * 0.2, hx + 4.5 - (y - headY + 6) * 1.4], HAIR, (_x, _y, t) => ({ x: t * 0.4, y: 0.6, z: 0.7 }));
  c.capsule(hx - 2.6, headY - 3, hx - 3.2, headY + 6, 1.4, 0.9, HAIR);
  // Eyes of pale fire, a fine nose, dark lips.
  c.part();
  if (p.mood === 'idle' && p.t > 0.8) {
    c.px(hx, headY, LIP, FLAT);
    c.px(hx + 3, headY, LIP, FLAT);
  } else {
    c.px(hx, headY, EYE);
    c.px(hx + 3, headY, EYE);
    c.spark(hx, headY, C_ICE, 0.8 + flare * 0.2);
    c.spark(hx + 3, headY, C_ICE, 0.8 + flare * 0.2);
  }
  c.shade(hx + 4, headY + 1, -1);
  c.shade(hx + 4, headY + 2, -1);
  c.px(hx + 2, headY + 3, LIP, FLAT);
  c.px(hx + 3, headY + 3, LIP, FLAT);
  // The crown: a silver band, spikes of crystal, a star at its front.
  c.part();
  for (let x = hx - 4; x <= hx + 4; x++) c.px(x, headY - 5 + (x > hx + 2 ? 1 : 0), SILVER, sphere((x - hx) / 5, 0.4));
  const spikes: [number, number][] = [[-3, 5], [-1.5, 7], [0.5, 10 + flare * 2], [2.5, 7], [4, 5]];
  for (const [dx, len] of spikes) {
    c.part();
    crystal(c, hx + dx, headY - 5, hx + dx * 1.35, headY - 5 - len, 1.2, dx === 0.5 ? ICE : ICE, dx === 0.5 ? C_WHITE : C_ICE);
  }
  c.part();
  c.px(hx + 1, headY - 5, STAR);
  c.spark(hx + 1, headY - 6, C_WHITE, 0.9);

  // The near arm, and the scepter in her hand.
  const sx = CX + 7 + lean;
  const sy = shoulderY + 2;
  if (p.mood === 'cast') {
    // Raised high, the scepter held up to the sky.
    const hx2 = sx + 4;
    const hy2 = shoulderY - 15;
    c.part();
    c.capsule(sx, sy, sx + 3, sy - 8, 1.8, 1.4, PALE);
    c.capsule(sx + 3, sy - 8, hx2, hy2, 1.4, 1.2, PALE);
    c.capsule(sx + 1, sy - 4, sx + 4, sy - 10, 2.4, 3.2, ICE);
    scepter(c, hx2, hy2 + 8, hx2 + 1, hy2 - 9, flare + 0.5);
    c.part();
    c.ellipse(hx2, hy2, 1.6, 1.5, PALE);
  } else if (p.mood === 'beam') {
    // Levelled at the hero.
    const hx2 = sx + 10;
    const hy2 = sy + 2;
    c.part();
    c.capsule(sx, sy, sx + 5, sy + 3, 1.8, 1.4, PALE);
    c.capsule(sx + 5, sy + 3, hx2, hy2, 1.4, 1.2, PALE);
    c.capsule(sx + 3, sy + 2, sx + 7, sy + 3, 2.6, 3.4, ICE);
    scepter(c, hx2 - 6, hy2 + 1, F.ox + SQ_BEAM_TIP.x, F.oy - SQ_BEAM_TIP.y, flare + 0.8);
    c.part();
    c.ellipse(hx2, hy2, 1.6, 1.5, PALE);
  } else if (spin) {
    const hx2 = sx + 15;
    const hy2 = sy - 8;
    c.part();
    c.capsule(sx, sy, sx + 8, sy - 4, 1.8, 1.4, PALE);
    c.capsule(sx + 8, sy - 4, hx2, hy2, 1.4, 1.2, PALE);
    c.capsule(sx + 6, sy - 3, sx + 12, sy - 6, 2.6, 3.4, ICE);
    scepter(c, hx2 - 5, hy2 + 7, hx2 + 5, hy2 - 8, flare + 0.6);
    c.part();
    c.ellipse(hx2, hy2, 1.6, 1.5, PALE);
  } else {
    // At rest: the scepter planted at her side like a staff.
    const hx2 = sx + 4;
    const hy2 = waistY + 2 + Math.round(breathe * 0.4);
    c.part();
    c.capsule(sx, sy, sx + 3, sy + 7, 1.8, 1.4, PALE);
    c.capsule(sx + 3, sy + 7, hx2, hy2, 1.4, 1.2, PALE);
    // A bell sleeve of ice, flaring at the wrist.
    c.capsule(sx + 1, sy + 1, sx + 3.5, sy + 9, 2.4, 3.6, ICE);
    scepter(c, hx2, FOOT - 4, hx2 + 0.5, shoulderY - 9, flare);
    c.part();
    c.ellipse(hx2, hy2, 1.6, 1.5, PALE);
  }

  // Snow swirling about her.
  const n = spin ? 18 : p.mood === 'cast' ? 12 : 6;
  for (let k = 0; k < n; k++) {
    const a = hash2(k, Math.floor(p.t * 8), 17) * Math.PI * 2;
    const d = (spin ? 22 : 16) + hash2(k, 3, Math.floor(p.t * 8)) * 12;
    c.spark(CX + Math.cos(a) * d, 50 + Math.sin(a) * d * 0.9, k % 4 ? C_WHITE : C_VIOLET, 0.25 + hash2(k, 9, 3) * 0.4);
  }
  return c;
}

export function buildSnowQueenSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  for (let i = 0; i < 6; i++) poses[`idle${i}`] = () => queen({ t: i / 6, mood: 'idle' });
  for (let i = 0; i < 4; i++) poses[`glide${i}`] = () => queen({ t: i / 4, mood: 'glide' });
  poses.cast0 = () => queen({ t: 0.2, mood: 'cast', flare: 0.6 });
  poses.cast1 = () => queen({ t: 0.6, mood: 'cast', flare: 1 });
  poses.beam0 = () => queen({ t: 0.3, mood: 'beam', flare: 0.7 });
  poses.beam1 = () => queen({ t: 0.7, mood: 'beam', flare: 1 });
  for (let i = 0; i < 3; i++) poses[`spin${i}`] = () => queen({ t: i / 3, mood: 'spin', flare: 0.8 });
  return sheet(F, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3', 'idle4', 'idle5'], fps: 5, loop: true },
    { name: 'walk', frames: ['glide0', 'glide1', 'glide2', 'glide3'], fps: 6, loop: true },
    { name: 'cast', frames: ['cast0', 'cast1'], fps: 6, loop: true },
    { name: 'beam', frames: ['beam0', 'beam1'], fps: 9, loop: true },
    { name: 'spin', frames: ['spin0', 'spin1', 'spin2'], fps: 10, loop: true },
  ]);
}

// ---------------------------------------------------------------- Spells

export const SQ_MIRROR_W = 12;
export const SQ_MIRROR_H = 16;

/** A shard of the frozen mirror, frame `f` of three as it turns: a silvered kite of ice, a streak of reflected light across it. */
function mirrorShard(f: number): PixelCanvas {
  const c = new PixelCanvas(SQ_MIRROR_W, SQ_MIRROR_H);
  const cx = 6;
  // It turns: narrower edge-on in the middle frame.
  const k = [1, 0.55, 0.85][f];
  c.part();
  poly(
    c,
    [
      [cx, 1],
      [cx + 4.5 * k, 6],
      [cx + 1, 15],
      [cx - 4 * k, 7],
    ],
    SILVER,
    (x) => (x < cx ? { x: -0.6, y: 0.3, z: 0.7 } : { x: 0.5, y: 0.1, z: 0.8 }),
  );
  c.part();
  poly(
    c,
    [
      [cx, 2.5],
      [cx + 3.2 * k, 6.2],
      [cx + 0.8, 13],
      [cx - 2.8 * k, 7],
    ],
    ICE,
    (x, y) => ((x + y + f) % 5 === 0 ? { x: -0.7, y: 0.6, z: 0.5 } : { x: -0.2, y: 0.35, z: 0.9 }),
  );
  for (let s = 0; s < 4; s++) c.spark(cx - 2 * k + s * k, 5 + s * 1.5 + f, C_WHITE, 0.8 - s * 0.12);
  return c;
}

export const SQ_BEAM_W = 32;
export const SQ_BEAM_H = 11;

/** A length of the mirror beam, pointing right: a white core, cyan sheath, sparkles; frame `f` of two shimmers. */
function beamArt(f: number): Uint8ClampedArray {
  const w = SQ_BEAM_W;
  const h = SQ_BEAM_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.abs(y - cy) + Math.sin(x * 0.8 + f * 2) * 0.4;
      let c: RGB | null = null;
      if (d < 1.2) c = [255, 255, 255];
      else if (d < 2.4) c = [200, 246, 255];
      else if (d < 3.6) c = [90, 200, 255];
      else if (d < 5 && bayer(x + f * 2, y) < 0.45) c = [60, 120, 220];
      if (!c) continue;
      px.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    }
  }
  for (let k = 0; k < 5; k++) {
    const x = Math.floor(hash2(k, f, 5) * w);
    const y = Math.floor(hash2(k, f, 9) * h);
    px.set([255, 255, 255, 255], (y * w + x) * 4);
  }
  return px;
}

export const SQ_GLINT = 11;

/** A four-pointed glint of light. */
function glintArt(): Uint8ClampedArray {
  const s = SQ_GLINT;
  const px = new Uint8ClampedArray(s * s * 4);
  const c = (s - 1) / 2;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = Math.abs(x - c);
      const dy = Math.abs(y - c);
      const arm = (dx === 0 && dy <= c) || (dy === 0 && dx <= c) || (dx === dy && dx <= 1);
      if (!arm) continue;
      const k = 1 - Math.max(dx, dy) / (c + 1);
      const v = Math.round(120 + 135 * k);
      px.set([v, Math.min(255, v + 10), 255, 255], (y * s + x) * 4);
    }
  }
  return px;
}

export function snowQueenFx(r: FxRegistrar): void {
  r.frames('sq_mirror', [0, 1, 2].map((f) => ({ name: `m${f}`, canvas: mirrorShard(f) })), SQ_MIRROR_W, SQ_MIRROR_H);
  r.strip('sq_beam', SQ_BEAM_W, SQ_BEAM_H, [0, 1].map(beamArt), 'b');
  r.anim('sq_beam_flow', 'sq_beam', ['b0', 'b1'], 14, true);
  r.image('sq_glint', SQ_GLINT, SQ_GLINT, glintArt());
}
