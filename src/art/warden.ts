// The Astral Warden, the Cosmos Arena's boss: a hooded titan of star-metal
// and night-blue cloth, four heroes tall. Its robe opens on a slice of the
// cosmos, a nebula with stars that twinkle from frame to frame, around a
// blazing star for a heart. A crown of crystals floats over the hood, a
// golden halo rings its head, and the hem frays into tendrils of stardust.
// It has no legs: it floats (the game bobs it, the frames only sway).

import { hash2 } from './env';
import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, cyl, hex, sphere, FLAT, type Material, type RGB } from './pixel';

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#05040f');

const ROBE: Material = { ramp: ramp('#0b0922', '#181444', '#28236a', '#3d3794', '#5f58c4'), outline: INK, outlineLit: hex('#1a1646') };
const HOOD: Material = { ...ROBE, outlineLit: hex('#221d58') };
const TENDRIL: Material = { ramp: ramp('#0a0820', '#15123c', '#221e5c', '#34308a'), outline: INK };
const VOID: Material = { ramp: ramp('#030210', '#060418', '#0a0724'), outline: INK, noAO: true };
const TRIM: Material = { ramp: ramp('#4a2c0c', '#8a5c18', '#c89430', '#f4d070', '#fff6d0'), outline: hex('#1c1006'), shine: true };
const METAL: Material = { ramp: ramp('#141c38', '#26375e', '#3c5a92', '#6a92cc', '#b8dcff'), outline: INK, outlineLit: hex('#1c2850'), shine: true };
const HALO: Material = { ramp: ramp('#8a5c18', '#e0a838', '#ffe28a', '#fffbe0'), outline: hex('#2a1806'), emissive: 0.75, noAO: true };
const EYE: Material = { ramp: ramp('#8af4ff', '#f0ffff'), outline: INK, emissive: 1, noAO: true };

/** The crown's crystals and the gem on its brow, brighter as it gathers power. */
const crystal = (flare: number): Material => ({
  ramp: ramp('#3a2080', '#6e48d0', '#a882ff', '#e2d2ff', '#ffffff'),
  outline: hex('#140a30'),
  emissive: 0.45 + flare * 0.5,
  shine: true,
  noAO: true,
});
/** The star in its chest. */
const heart = (power: number): Material => ({
  ramp: ramp('#ff4aa8', '#ff9ad8', '#ffe6fa', '#ffffff'),
  outline: hex('#3a0a2c'),
  emissive: 0.75 + power * 0.25,
  noAO: true,
});

export const STAR_WHITE = hex('#f4f8ff');
const STAR_BLUE = hex('#9cd8ff');
const STAR_GOLD = hex('#ffe6a0');
const NEB_PINK = hex('#e04aa8');
const NEB_TEAL = hex('#2ab8c8');
const NEB_VIOLET = hex('#7a4ae0');
const PALM = hex('#c8f4ff');
const DUST = hex('#d8e8ff');

/** Particle tints for the Warden's bursts: starlight, violet and rose. */
export const WARDEN_TINTS = [0xffffff, 0xc8e4ff, 0xa882ff, 0xff9ad8];

type Arms = 'rest' | 'raise' | 'high' | 'clasp' | 'wide';

interface WardenPose {
  /** 0..1 phase of the idle sway: tendrils, twinkling stars, the swirling nebula. */
  t: number;
  arms: Arms;
  /** 0..1 how bright the heart burns. */
  core?: number;
  /** 0..1 the crown and palms flaring. */
  flare?: number;
}

const CX = 48;

/** Elbow and hand for the arm on `side` (-1 left, 1 right). */
function arm(a: Arms, side: number, t: number): { ex: number; ey: number; hx: number; hy: number } {
  const sway = Math.sin(t * Math.PI * 2 + side) * 0.6;
  switch (a) {
    case 'rest':
      return { ex: CX + side * 29, ey: 61 + sway, hx: CX + side * 31, hy: 74 + sway };
    case 'raise':
      return { ex: CX + side * 33, ey: 43, hx: CX + side * 35, hy: 31 };
    case 'high':
      return { ex: CX + side * 31, ey: 35, hx: CX + side * 29, hy: 17 };
    case 'clasp':
      return { ex: CX + side * 27, ey: 64, hx: CX + side * 6, hy: 60 };
    case 'wide':
      return { ex: CX + side * 36, ey: 49, hx: CX + side * 45, hy: 43 };
  }
}

/** Half-width of the robe at row y. */
function robeHalf(y: number): number {
  if (y < 50) return 14 + ((y - 44) / 6) * 7;
  if (y < 70) return 21 - ((y - 50) / 20) * 5;
  const u = (y - 70) / 26;
  return 16 + u * u * 9 + u * 1.5;
}

/** Half-width of the robe's opening onto the cosmos at row y. */
const panelHalf = (y: number): number => 4 + ((y - 52) / 44) * 8;

function warden(p: WardenPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.warden;
  const c = new PixelCanvas(w, h);
  const core = p.core ?? 0;
  const flare = p.flare ?? 0;
  const tau = p.t * Math.PI * 2;

  // Halo: a thin golden ring behind the head, studded with star nodes.
  c.part();
  const hcx = CX;
  const hcy = 27;
  for (let y = hcy - 23; y <= hcy + 23; y++) {
    for (let x = hcx - 24; x <= hcx + 24; x++) {
      const d = Math.hypot((x + 0.5 - hcx) / 22, (y + 0.5 - hcy) / 21);
      if (d > 0.93 && d <= 1.02) c.px(x, y, HALO, sphere((x - hcx) / 26, (y - hcy) / 26, 0.8));
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + p.t * 0.8;
    const nx = hcx + Math.cos(a) * 22;
    const ny = hcy + Math.sin(a) * 21;
    c.spark(nx, ny, STAR_GOLD, 0.9);
    c.spark(nx + 1, ny, STAR_GOLD, 0.35);
    c.spark(nx - 1, ny, STAR_GOLD, 0.35);
    c.spark(nx, ny + 1, STAR_GOLD, 0.35);
    c.spark(nx, ny - 1, STAR_GOLD, 0.35);
  }
  // A fainter dotted ring beyond it, turning slowly.
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 - p.t * 0.6;
    if (i % 3 === 0) continue;
    c.spark(hcx + Math.cos(a) * 27, hcy + Math.sin(a) * 25.5, STAR_BLUE, 0.22 + flare * 0.25);
  }

  // Tendrils: the hem frays into five ribbons that sway and turn to dust.
  c.part();
  const tendrils = [-19, -9.5, 0, 9.5, 19];
  tendrils.forEach((ox, i) => {
    const len = 11 + (i % 2 ? 3 : 0) + (i === 2 ? 2 : 0);
    const sway = Math.sin(tau + i * 1.3) * 2.6;
    const x0 = CX + ox;
    const y0 = 90;
    const mx = x0 + ox * 0.08 + sway * 0.4;
    const my = y0 + len * 0.55;
    const x1 = x0 + ox * 0.14 + sway;
    const y1 = y0 + len;
    c.capsule(x0, y0, mx, my, 4.2, 2.6, TENDRIL);
    c.capsule(mx, my, x1, y1, 2.6, 0.8, TENDRIL);
    for (let k = 0; k < 4; k++) {
      const dy = 2 + k * 2.2;
      const dx = Math.sin(tau * 1.5 + i * 2 + k * 1.7) * (1 + k * 0.6);
      c.spark(x1 + dx, y1 + dy, k % 2 ? STAR_BLUE : DUST, 0.75 - k * 0.16);
    }
  });

  // Robe, from the shoulders to the hem.
  c.part();
  c.shape(44, 96, (y) => [CX - robeHalf(y), CX + robeHalf(y)], ROBE, (_x, y, t) => cyl(t, y < 52 ? 0.5 : 0.1));
  // Folds: soft vertical creases down the skirt.
  for (let y = 72; y <= 96; y++) {
    for (const f of [-13, -8, 8, 13]) {
      const x = CX + f * (robeHalf(y) / 18);
      c.shade(x, y, -1);
    }
  }

  // The opening: a slice of the cosmos, with a nebula swirling in it.
  c.part();
  c.shape(52, 96, (y) => [CX - panelHalf(y), CX + panelHalf(y)], VOID, () => FLAT);
  for (let y = 52; y <= 96; y++) {
    const hw = panelHalf(y);
    for (let x = Math.round(CX - hw); x < Math.round(CX + hw); x++) {
      const dx = x + 0.5 - CX;
      const dy = y - 74;
      // A slow spiral: the angle drifts with the phase and winds with distance.
      const r = Math.hypot(dx, dy * 0.6);
      const a = Math.atan2(dy, dx) + r * 0.12 - tau * 0.15;
      const arm = Math.pow(Math.max(0, Math.cos(a * 2)), 3);
      const k = arm * Math.max(0, 1 - r / 26);
      if (k > 0.05) c.spark(x, y, (y + x) % 3 === 0 ? NEB_TEAL : Math.sin(a * 1.7) > 0 ? NEB_PINK : NEB_VIOLET, Math.min(0.5, k * 0.5));
      const s = hash2(x, y, 71);
      if (s > 0.93) {
        const tw = 0.5 + 0.5 * Math.sin(tau + s * 90);
        c.spark(x, y, s > 0.975 ? STAR_GOLD : STAR_WHITE, 0.35 + tw * 0.6);
      }
    }
  }
  // Gold trim down both edges of the opening, and along the hem.
  c.part();
  for (let y = 52; y <= 96; y++) {
    const hw = panelHalf(y) + 0.5;
    c.px(CX - hw - 1, y, TRIM, cyl(-0.6, 0.2));
    c.px(CX + hw, y, TRIM, cyl(0.6, 0.2));
  }
  for (let x = Math.round(CX - robeHalf(96)); x < Math.round(CX + robeHalf(96)); x++) {
    if (Math.abs(x + 0.5 - CX) > panelHalf(96) + 1) c.px(x, 96, TRIM, cyl((x + 0.5 - CX) / robeHalf(96), -0.4));
  }

  // The heart: a star set in a golden ring on the chest, with four rays.
  c.part();
  c.ellipse(CX, 57, 7, 7, TRIM);
  c.part();
  c.ellipse(CX, 57, 5.2, 5.2, heart(core));
  const ray = 7 + core * 5;
  for (let i = 1; i <= ray; i++) {
    const a = 1 - i / (ray + 1);
    for (const [ux, uy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      c.spark(CX - 0.5 + ux * (5 + i), 57 + uy * (5 + i), STAR_WHITE, a * (0.5 + core * 0.5));
    }
  }
  c.spark(CX - 1, 56, STAR_WHITE, 1);

  // Hood: peaked, deep, draped onto the shoulders.
  c.part();
  c.shape(12, 46, (y) => {
    if (y < 20) {
      const u = (y - 12) / 8;
      return [CX - u * 10 - 0.6, CX + u * 10 + 0.6];
    }
    if (y < 36) return [CX - 12.5, CX + 12.5];
    const u = (y - 36) / 10;
    return [CX - 12.5 - u * 4, CX + 12.5 + u * 4];
  }, HOOD, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.4) * 1.3));
  // The face is a void with two cold eyes.
  c.part();
  c.ellipse(CX, 30, 7.2, 8.2, VOID, { normal: () => FLAT });
  // Shadow under the brow.
  for (let x = CX - 6; x < CX + 6; x++) c.shade(x, 22, -1);
  c.part();
  for (const ex of [CX - 4, CX + 2]) {
    c.px(ex, 29, EYE);
    c.px(ex + 1, 29, EYE);
    c.spark(ex, 29, STAR_BLUE, 0.4);
    c.spark(ex - 1, 29, STAR_BLUE, 0.25 + flare * 0.4);
    c.spark(ex + 2, 29, STAR_BLUE, 0.25 + flare * 0.4);
    c.spark(ex, 30, STAR_BLUE, 0.15);
    c.spark(ex + 1, 30, STAR_BLUE, 0.15);
  }
  // A few stars deep in the hood.
  c.spark(CX - 2, 34, STAR_WHITE, 0.35);
  c.spark(CX + 3, 32, STAR_BLUE, 0.3);
  c.spark(CX, 36, STAR_WHITE, 0.2);
  // A gem on the brow.
  c.part();
  c.px(CX, 19, crystal(flare), sphere(-0.3, -0.4));
  c.px(CX - 1, 19, crystal(flare), sphere(-0.6, -0.2));

  // Crown: five crystals floating above the hood.
  const lift = flare * 1.5;
  for (const [ox, ht, base] of [
    [-10, 5, 12],
    [-5, 8, 10],
    [0, 12, 8],
    [5, 8, 10],
    [10, 5, 12],
  ]) {
    c.part();
    const x = CX + ox;
    const top = base - ht - lift;
    const bot = base - lift;
    c.shape(Math.round(top), Math.round(bot), (y) => {
      const u = (y - top) / (bot - top);
      const hw = 0.4 + Math.sin(Math.min(1, u * 1.25) * Math.PI) * (ht > 9 ? 2 : 1.6);
      return [x - hw, x + hw];
    }, crystal(flare), (_x, _y, t, u) => sphere(t * 0.8, (u - 0.5) * 0.8));
    c.spark(x, top + 1, STAR_WHITE, 0.4 + flare * 0.5);
  }

  // Arms: sleeves, star-metal bracers and gauntleted hands.
  const bright = p.arms === 'rest' ? 0.25 : p.arms === 'clasp' ? 0.5 : 0.6 + flare * 0.4;
  for (const side of [-1, 1]) {
    const { ex, ey, hx, hy } = arm(p.arms, side, p.t);
    const sx = CX + side * 20;
    const sy = 48;
    const dx = hx - ex;
    const dy = hy - ey;
    const l = Math.hypot(dx, dy) || 1;
    const wx = hx - (dx / l) * 3.5;
    const wy = hy - (dy / l) * 3.5;
    c.part();
    c.capsule(sx, sy, ex, ey, 5, 3.8, ROBE);
    c.part();
    c.capsule(ex, ey, wx, wy, 3.4, 2.8, METAL);
    c.px(ex + (wx - ex) * 0.5, ey + (wy - ey) * 0.5, TRIM, sphere(-0.3, -0.3));
    c.part();
    c.ellipse(hx, hy, 3.7, 3.7, METAL);
    // Three long fingers, carrying on along the forearm.
    for (const f of [-0.55, 0, 0.55]) {
      const a = Math.atan2(dy, dx) + f;
      c.capsule(hx + Math.cos(a) * 2.5, hy + Math.sin(a) * 2.5, hx + Math.cos(a) * 5.5, hy + Math.sin(a) * 5.5, 1.1, 0.7, METAL);
    }
    c.spark(hx, hy, PALM, bright);
    c.spark(hx + 1, hy, PALM, bright * 0.6);
    c.spark(hx, hy + 1, PALM, bright * 0.6);
    c.spark(hx - 1, hy, PALM, bright * 0.4);
    c.spark(hx, hy - 1, PALM, bright * 0.4);
  }

  // Pauldrons over the sleeves' tops: domed star-metal, rimmed in gold.
  for (const side of [-1, 1]) {
    c.part();
    const px = CX + side * 20;
    c.ellipse(px, 46, 8, 6, METAL);
    c.part();
    for (let x = px - 7; x <= px + 7; x++) {
      const u = (x - px) / 8;
      c.px(x, 46 + Math.round(Math.sqrt(Math.max(0, 1 - u * u)) * 5), TRIM, cyl(u, -0.3));
    }
    c.px(px, 44, crystal(flare), sphere(-0.4, -0.4));
  }
  return c;
}

export function buildWardenSheet(): MonsterSheet {
  const idle = [0, 1, 2, 3, 4, 5].map((i) => i / 6);
  const poses: Record<string, () => PixelCanvas> = {};
  idle.forEach((t, i) => (poses[`idle${i}`] = () => warden({ t, arms: 'rest' })));
  poses.raise0 = () => warden({ t: 0.1, arms: 'raise', core: 0.3, flare: 0.4 });
  poses.high0 = () => warden({ t: 0.25, arms: 'high', core: 0.5, flare: 0.8 });
  poses.high1 = () => warden({ t: 0.6, arms: 'high', core: 0.6, flare: 1 });
  poses.clasp0 = () => warden({ t: 0.3, arms: 'clasp', core: 0.8, flare: 0.3 });
  poses.clasp1 = () => warden({ t: 0.8, arms: 'clasp', core: 1, flare: 0.5 });
  poses.wide0 = () => warden({ t: 0.5, arms: 'wide', core: 1, flare: 1 });
  poses.wide1 = () => warden({ t: 0.9, arms: 'wide', core: 0.7, flare: 0.8 });
  return sheet(MONSTER_FRAME.warden, poses, [
    { name: 'idle', frames: idle.map((_, i) => `idle${i}`), fps: 6, loop: true },
    { name: 'raise', frames: ['raise0', 'high0'], fps: 6, loop: false },
    { name: 'call', frames: ['high0', 'high1'], fps: 7, loop: true },
    { name: 'clasp', frames: ['clasp0', 'clasp1'], fps: 8, loop: true },
    { name: 'nova', frames: ['wide0', 'wide1', 'wide0', 'wide1'], fps: 10, loop: false },
  ]);
}
