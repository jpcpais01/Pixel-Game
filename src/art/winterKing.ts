// Kaldr, the Lich of the Long Winter: the Aurora Colosseum's third Legend,
// an undead king who has ruled the snow for a thousand years. A skull of
// bleached bone with pinpoint eyes of cold fire, a beard of icicles hanging
// from his jaw, a crown of ice spikes on a band of pale gold. A great collar
// of ermine on his shoulders; a breastplate of frost-iron carved with a
// glowing rune; a robe of midnight teal to the floor; and over it all a
// violet mantle, torn to rags at its hem and stiff with rime. In his bony
// hand a staff of black iron, and in the silver claws at its head his own
// frozen heart, beating violet.
//
// Drawn three-quarters on, turned to the right (the world mirrors him), on
// foot: a slow and heavy stride, the staff planted at every other step. His
// poses: at rest, walking, the staff raised to the sky (pillars and the
// icicle storm), the staff lifted and driven down (his nova), a hand thrust
// out (the blizzard orbs), and both arms raised to wake the dead.
//
// And his spells' pictures: the blizzard orb (wk_orb) and the rune circle
// that marks his nova and his summons (wk_rune).

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { FLAT, PixelCanvas, cyl, sphere, type Material } from './pixel';
import { bayer, clamp01 } from './bitmap';
import { hash2 } from './env';
import { BONE, C_ICE, C_VIOLET, C_WHITE, CLOTH, FUR_DARK, FUR_WHITE, GLOW_ICE, GLOW_VIOLET, GOLD, HOLLOW, ICE, ICE_DARK, ICE_GLOW, IRON, RIME, SILVER, VELVET, crystal, poly, ramp, type FxRegistrar } from './frostKit';

const F = MONSTER_FRAME.winterking;
const CX = 44;
const FOOT = F.oy - 1;

/** His frozen heart: ice lit from within by a violet fire. */
const HEART: Material = { ...ICE_GLOW, ramp: ramp('#3a1e96', '#6a46e0', '#9e80ff', '#d2c4ff', '#f4f0ff') };
/** The black iron of his staff. */
const STAFF: Material = { ...IRON, ramp: ramp('#05070e', '#0c1220', '#172034', '#26324c', '#3a4a6a') };
/** The mantle's tatters, a shade darker than the rest of it. */
const RAG: Material = { ...VELVET, bias: -1 };

/** Debris tints: bone, ice, violet. */
export const WINTERKING_TINTS = [0xe8eaf0, 0x9ae8ff, 0xb48aff, 0xffffff];
/** The heart at his staff's head above his feet (facing right), at rest and raised. */
export const WK_HEART_REST = { x: 22, y: 83 };
export const WK_HEART_RAISED = { x: 21, y: 92 };

type Mood = 'idle' | 'walk' | 'raise' | 'lift' | 'slam' | 'thrust' | 'summon';

interface Pose {
  t: number;
  mood: Mood;
  /** 0..1 how brightly his heart and runes burn. */
  flare?: number;
}

/** His staff from its foot (x0, y0) to its head (x1, y1): black iron, rimed, silver claws round the frozen heart. */
function staff(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, flare: number, beat: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  c.part();
  c.capsule(x0, y0, x1 - ux * 4, y1 - uy * 4, 1.1, 1.3, STAFF);
  // Rime caught on the iron.
  for (let s = 0.25; s < 0.9; s += 0.22) c.px(x0 + (x1 - x0) * s - 1, y0 + (y1 - y0) * s, RIME, sphere(-0.5, 0.3));
  // The silver claws: three curving up round the heart.
  const hx = x1;
  const hy = y1;
  c.part();
  const nx = -uy;
  const ny = ux;
  for (const side of [-1, 1]) {
    for (let s = 0; s <= 1.0001; s += 0.2) {
      const bulge = Math.sin(s * Math.PI) * 4.2;
      const px = hx - ux * 5 + ux * s * 9 + nx * side * bulge;
      const py = hy - uy * 5 + uy * s * 9 + ny * side * bulge;
      c.px(px, py, SILVER, sphere(side * -0.5, 0.4));
    }
  }
  c.px(hx - ux * 5, hy - uy * 5, SILVER, sphere(0, 0.5));
  // The heart: two lobes and a point, ice lit violet from within.
  c.part();
  const r = 2.4 + beat * 0.5;
  c.ellipse(hx - 1.4, hy - 0.8, r, r, HEART);
  c.ellipse(hx + 1.4, hy - 0.8, r, r, HEART);
  c.shape(Math.round(hy), Math.round(hy + 3.5 + beat * 0.5), (y) => {
    const k = (y - hy) / (3.5 + beat * 0.5);
    const hw = (r + 1.2) * (1 - k);
    return [hx - hw, hx + hw];
  }, HEART, () => FLAT);
  c.part();
  c.px(hx, hy - 0.5, GLOW_VIOLET);
  c.px(hx - 1, hy, GLOW_VIOLET);
  c.spark(hx - 1, hy - 2, C_WHITE, 0.8);
  // Its light pulsing out with each beat.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + flare;
    const d = 5 + beat * 2 + flare * 2;
    c.spark(hx + Math.cos(a) * d, hy + Math.sin(a) * d, k % 2 ? C_VIOLET : C_ICE, 0.18 + flare * 0.3 + beat * 0.15);
  }
}

/** A bony hand at (x, y): knuckles and long fingers reaching along (ux, uy). */
function hand(c: PixelCanvas, x: number, y: number, ux: number, uy: number, glow: number): void {
  c.part();
  c.ellipse(x, y, 1.8, 1.6, BONE);
  for (const s of [-1, 0, 1]) {
    const nx = -uy * s * 1.2;
    const ny = ux * s * 1.2;
    c.line(x + nx, y + ny, x + nx + ux * 3, y + ny + uy * 3, BONE, () => sphere(0, 0.4));
  }
  if (glow > 0) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      c.spark(x + ux * 3 + Math.cos(a) * 2.5, y + uy * 3 + Math.sin(a) * 2.5, k % 2 ? C_VIOLET : C_WHITE, glow * 0.6);
    }
    c.spark(x + ux * 2, y + uy * 2, C_WHITE, glow);
  }
}

/** A sleeve of the mantle from shoulder to wrist, wide and ragged at its cuff. */
function sleeve(c: PixelCanvas, sx: number, sy: number, ex: number, ey: number, wx: number, wy: number, far: boolean): void {
  const o = { bias: far ? -1 : 0 };
  c.part();
  c.capsule(sx, sy, ex, ey, 3.6, 3.2, VELVET, o);
  c.capsule(ex, ey, wx, wy, 3.2, 4.4, VELVET, o);
  // Tatters hanging off the cuff.
  for (let k = 0; k < 3; k++) {
    const tx = wx - 2 + k * 2;
    c.line(tx, wy + 2, tx - 0.5, wy + 5 + (k % 2) * 2, RAG, () => sphere(0, 0.2), o);
  }
  c.part();
  c.capsule(wx - (wx - ex) * 0.15, wy - (wy - ey) * 0.15, wx, wy, 3.4, 4.2, RIME, o);
}

function king(p: Pose): PixelCanvas {
  const c = new PixelCanvas(F.w, F.h);
  const tau = p.t * Math.PI * 2;
  const flare = p.flare ?? 0;
  const beat = Math.max(0, Math.sin(tau * 2)) * 0.8 + flare * 0.4;
  const walk = p.mood === 'walk';
  const bob = walk ? Math.abs(Math.sin(tau)) * -1.2 + 0.6 : Math.sin(tau) * 0.4;
  const lean = p.mood === 'slam' ? 2 : p.mood === 'summon' ? -1 : 0;
  const shY = Math.round(35 + bob);
  const headY = Math.round(22 + bob) - (p.mood === 'summon' ? 1 : 0);
  const hx = CX + 2 + lean;
  const flareOut = p.mood === 'slam' ? 4 : p.mood === 'summon' ? 2 : 0;
  const sway = Math.sin(tau + 0.7) * (walk ? 2 : 1);

  // The mantle behind him: violet, falling from his shoulders to the floor, torn at the hem.
  c.part();
  const mantleL = (y: number) => {
    const u = clamp01((y - shY) / (FOOT - shY));
    return CX - 15 + lean * (1 - u) - u * (11 + flareOut) - sway * u;
  };
  const mantleR = (y: number) => {
    const u = clamp01((y - shY) / (FOOT - shY));
    return CX + 15 + lean * (1 - u) + u * (7 + flareOut * 0.6) - sway * u * 0.5;
  };
  const tatter = (x: number) => Math.round(hash2(Math.floor(x / 2), 3, 11) * 6 + (x % 5 === 0 ? 3 : 0));
  for (let y = shY - 2; y <= FOOT; y++) {
    const l = mantleL(y);
    const r = mantleR(y);
    for (let x = Math.round(l); x < Math.round(r); x++) {
      if (y > FOOT - tatter(x)) continue;
      // A few holes worn through near the hem.
      if (y > FOOT - 14 && hash2(x, y, 5) > 0.93) continue;
      const t = ((x + 0.5 - l) / (r - l)) * 2 - 1;
      const fold = Math.sin(x * 0.7 + y * 0.12 + tau * (walk ? 1 : 0.5)) * 0.45;
      c.px(x, y, y > FOOT - 9 ? RAG : VELVET, { x: t * 0.6 + fold, y: 0.2, z: 0.8 });
    }
  }
  // Rime crusting the ragged hem.
  for (let x = Math.round(mantleL(FOOT)); x < Math.round(mantleR(FOOT)); x++) {
    const y = FOOT - tatter(x);
    if (c.materialAt(x, y) === RAG || c.materialAt(x, y) === VELVET) c.px(x, y, RIME, sphere(0, -0.4));
  }

  // The far arm, behind his body (when it isn't reaching out in front).
  const farSh: [number, number] = [CX - 12 + lean, shY + 2];
  if (p.mood === 'raise' || p.mood === 'summon') {
    const wx = CX - 20 + lean;
    const wy = p.mood === 'summon' ? shY - 20 : shY - 14;
    sleeve(c, farSh[0], farSh[1], CX - 19 + lean, shY - 4, wx, wy, true);
    hand(c, wx - 0.5, wy - 3, -0.2, -1, 0.6 + flare * 0.4);
  } else if (p.mood !== 'thrust') {
    sleeve(c, farSh[0], farSh[1], CX - 15 + lean, shY + 11, CX - 14 + lean + sway * 0.3, shY + 20, true);
    hand(c, CX - 14 + lean + sway * 0.3, shY + 25, 0, 1, 0);
  }

  // His robe of midnight teal to the floor, armoured boots under its hem.
  c.part();
  const waistY = shY + 22;
  c.shape(waistY - 2, FOOT - 1, (y) => {
    const u = (y - waistY) / (FOOT - waistY);
    const hw = 9 + Math.max(0, u) * 5;
    const x = CX + 1 + lean * (1 - Math.max(0, u)) - sway * Math.max(0, u) * 0.4;
    return [x - hw, x + hw];
  }, CLOTH, (x, _y, t, u) => ({ x: t * 0.6 + Math.sin(x * 0.9) * 0.3, y: 0.25 - u * 0.2, z: 0.8 }));
  // A silver seam down its front.
  for (let y = waistY + 1; y < FOOT - 1; y++) c.px(CX + 4 + lean * (1 - (y - waistY) / (FOOT - waistY)), y, SILVER, sphere(0.2, 0.2));
  // Boots.
  c.part();
  const step = walk ? Math.sin(tau) : 0;
  for (const [bx, lift] of [[CX - 4 + step * 3, Math.max(0, -step) * 1.5], [CX + 7 - step * 3, Math.max(0, step) * 1.5]] as const) {
    c.ellipse(bx, FOOT - 1 - lift, 3.8, 2, IRON, { flatten: 0.8 });
    c.px(bx + 3, FOOT - 1 - lift, IRON, sphere(0.6, 0.2));
  }

  // The breastplate of frost-iron, a rune glowing at its heart.
  c.part();
  c.shape(shY + 1, waistY, (y) => {
    const u = (y - shY) / (waistY - shY);
    const hw = 11 - u * 3.5;
    return [CX + 1 + lean - hw, CX + 1 + lean + hw];
  }, IRON, (_x, _y, t, u) => cyl(t, 0.35 - u * 0.4));
  // Ribs of the plate, lit along their tops.
  for (const ry of [shY + 8, shY + 13, shY + 18]) {
    const hw = 11 - ((ry - shY) / (waistY - shY)) * 3.5 - 1;
    for (let x = Math.round(CX + 1 + lean - hw); x <= Math.round(CX + 1 + lean + hw); x++) {
      c.shade(x, ry, -1);
      c.shade(x, ry - 1, 1);
    }
  }
  // Rime crusting the plate's upper edge.
  for (let x = CX - 9 + lean; x <= CX + 11 + lean; x++) if (hash2(x, 2, 7) > 0.35) c.px(x, shY + 2 + (hash2(x, 3, 7) > 0.7 ? 1 : 0), RIME, sphere(0, 0.6));
  // The rune: a diamond of light with a line through it.
  c.part();
  const rx = CX + 2 + lean;
  const ry = shY + 11;
  const rg = { glow: 0.6 + flare * 0.4 };
  for (const [dx, dy] of [[0, -3], [-1, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-1, 1], [1, 1], [0, 2], [0, -1], [0, 0], [0, 4]] as const) c.px(rx + dx, ry + dy, GLOW_ICE, FLAT, rg);
  c.spark(rx, ry - 1, C_ICE, 0.6 + flare * 0.4);
  // A belt of pale gold.
  c.part();
  for (let x = CX - 8 + lean; x <= CX + 10 + lean; x++) c.px(x, waistY, GOLD, sphere((x - CX) / 10, 0.4));
  c.ellipse(CX + 2 + lean, waistY, 1.6, 1.4, GOLD);

  // The mantle's front edges, falling open either side of the plate and robe, gold along their edge.
  for (const side of [-1, 1]) {
    c.part();
    const pts: [number, number][] = [];
    const inner = (y: number) => {
      const u = clamp01((y - shY) / (FOOT - shY));
      return CX + 1 + lean * (1 - u) + side * (9 + u * 6) - sway * u * 0.5;
    };
    const outer = side < 0 ? mantleL : mantleR;
    for (let y = shY; y <= FOOT - 3; y += 3) pts.push([inner(y), y]);
    for (let y = FOOT - 3; y >= shY; y -= 3) pts.push([outer(y) - side * 0.5, y]);
    poly(c, pts, VELVET, (x, y) => ({ x: side * 0.5 + Math.sin(x * 0.8 + y * 0.1) * 0.25, y: 0.25, z: 0.8 }));
    for (let y = shY + 4; y <= FOOT - 4; y++) {
      if (y > FOOT - 4 - tatter(Math.round(inner(y)))) continue;
      c.px(Math.round(inner(y)), y, GOLD, sphere(-side * 0.3, 0.3));
    }
  }

  // The ermine collar heaped on his shoulders.
  c.part();
  for (let k = 0; k < 7; k++) {
    const u = k / 6;
    const x = CX - 15 + lean + u * 31;
    const y = shY - 1 + Math.sin(u * Math.PI) * -2 + (k % 2) * 1.5;
    c.ellipse(x, y, 4.6, 4, FUR_WHITE);
  }
  // Its black ermine tails.
  c.part();
  for (const [dx, dy] of [[-12, 1], [-5, 3], [3, 3], [11, 2], [16, 0]] as const) {
    c.px(CX + dx + lean, shY + dy, FUR_DARK, sphere(0, 0.2));
    c.px(CX + dx + lean, shY + dy + 1, FUR_DARK, sphere(0, -0.2));
  }

  // The skull: bleached bone, hollow sockets with pinpoints of cold fire.
  c.part();
  c.ellipse(hx, headY - 1, 6.4, 6.2, BONE);
  c.capsule(hx + 1, headY + 1, hx + 2, headY + 5, 4.6, 3.4, BONE);
  c.part();
  for (const ex of [hx - 2, hx + 3]) {
    for (const [dx, dy] of [[0, -1], [1, -1], [0, 0], [1, 0], [0, 1], [1, 1]] as const) c.px(ex + dx, headY + dy, HOLLOW);
    c.px(ex + (ex > hx ? 0 : 1), headY, GLOW_ICE, FLAT, { glow: 1 });
    c.spark(ex + 0.5, headY + 0.5, C_ICE, 0.5);
  }
  c.px(hx + 2, headY + 3, HOLLOW);
  c.px(hx + 2, headY + 2, HOLLOW);
  // Cheekbones in shadow, and a lipless grin.
  c.shade(hx - 3, headY + 2, -1);
  c.shade(hx - 3, headY + 3, -1);
  for (let x = hx - 1; x <= hx + 5; x++) c.px(x, headY + 5, (x - hx) % 2 ? HOLLOW : BONE, sphere(0, 0.2));
  // His beard: icicles hanging from the jaw over the collar.
  c.part();
  const beard: [number, number][] = [[-2, 5], [0, 9], [1, 12], [3, 10], [5, 7], [6, 4]];
  for (const [dx, len] of beard) {
    const x = hx + dx;
    const y = headY + 6;
    crystal(c, x, y, x + (dx - 2) * 0.15, y + len + (p.mood === 'summon' ? -1 : 0), 1.3, dx % 2 ? ICE_DARK : ICE, len > 8 ? C_WHITE : null);
  }
  // The crown: a band of pale gold, spikes of ice, a violet stone.
  c.part();
  for (let x = hx - 6; x <= hx + 6; x++) {
    c.px(x, headY - 6, GOLD, sphere((x - hx) / 7, 0.5));
    c.px(x, headY - 5, GOLD, sphere((x - hx) / 7, -0.2));
  }
  const spikes: [number, number][] = [[-5, 5], [-2.5, 8], [0.5, 12 + flare * 2], [3.5, 8], [6, 5]];
  for (const [dx, len] of spikes) {
    c.part();
    crystal(c, hx + dx, headY - 6, hx + dx * 1.3, headY - 6 - len, 1.4, dx === 0.5 ? ICE : dx < 0 ? ICE_DARK : ICE, dx === 0.5 ? C_WHITE : C_ICE);
  }
  // Little icicles dripping from under the band.
  c.part();
  for (const dx of [-6, 6]) {
    for (let k = 1; k <= 2; k++) c.px(hx + dx, headY - 5 + k, ICE, { x: -0.3, y: 0.2, z: 0.9 });
  }
  c.part();
  c.ellipse(hx + 1, headY - 5.5, 1.3, 1.1, GLOW_VIOLET);
  c.spark(hx + 1, headY - 6, C_WHITE, 0.8);

  // The near arm and the staff.
  const sh: [number, number] = [CX + 13 + lean, shY + 2];
  switch (p.mood) {
    case 'raise': {
      const wx = CX + 20;
      const wy = shY - 14 - Math.round(Math.sin(tau) * 1);
      sleeve(c, sh[0], sh[1], CX + 19, shY - 5, wx, wy, false);
      staff(c, wx + 1, wy + 26, F.ox + WK_HEART_RAISED.x, F.oy - WK_HEART_RAISED.y, flare + 0.6, beat);
      hand(c, wx + 1, wy - 1, 0, -1, 0);
      break;
    }
    case 'summon': {
      const wx = CX + 25;
      const wy = shY - 15;
      sleeve(c, sh[0], sh[1], CX + 21, shY - 6, wx, wy, false);
      staff(c, wx - 1, wy + 26, wx + 2, wy - 13, flare + 0.6, beat);
      hand(c, wx, wy - 1, 0.1, -1, 0);
      break;
    }
    case 'lift': {
      // The staff hoisted high and back, gathering.
      const wx = CX + 17;
      const wy = shY - 10;
      sleeve(c, sh[0], sh[1], CX + 19, shY - 1, wx, wy, false);
      staff(c, wx + 6, wy + 28, wx - 6, wy - 22, flare + 0.7, beat);
      hand(c, wx, wy - 1, -0.2, -1, 0);
      break;
    }
    case 'slam': {
      // Driven down into the floor before him.
      const wx = CX + 25;
      const wy = shY + 18;
      sleeve(c, sh[0], sh[1], CX + 21, shY + 8, wx, wy, false);
      staff(c, CX + 33, FOOT, CX + 16, shY - 14, flare + 1, beat);
      hand(c, wx, wy, 0.4, 0.9, 0);
      break;
    }
    default: {
      // At rest or striding: planted at his side like a sceptre.
      const swing = walk ? Math.sin(tau) * 2.5 : 0;
      const wx = CX + 21 + swing * 0.5;
      const wy = shY + 15;
      sleeve(c, sh[0], sh[1], CX + 19, shY + 8, wx, wy, false);
      staff(c, wx + 1 + swing, FOOT - (walk ? Math.max(0, -Math.sin(tau)) * 3 : 0), F.ox + WK_HEART_REST.x + swing * 0.3, F.oy - WK_HEART_REST.y, flare, beat);
      hand(c, wx + 1, wy, 0, 1, 0);
      break;
    }
  }

  // The far hand thrust out before his chest, cold fire in its palm.
  if (p.mood === 'thrust') {
    const wx = CX + 27 + lean;
    const wy = shY + 6;
    sleeve(c, farSh[0] + 4, farSh[1], CX + 12, shY + 7, wx - 3, wy, false);
    hand(c, wx, wy, 1, -0.1, 0.8 + flare * 0.4);
  }

  // Snow and motes of violet light drifting off him.
  const n = p.mood === 'summon' || p.mood === 'raise' ? 16 : 6;
  for (let k = 0; k < n; k++) {
    const a = hash2(k, Math.floor(p.t * 6), 23) * Math.PI * 2;
    const d = 14 + hash2(k, 4, Math.floor(p.t * 6)) * 18;
    c.spark(CX + Math.cos(a) * d, 52 + Math.sin(a) * d * 1.2, k % 3 ? C_WHITE : C_VIOLET, 0.2 + hash2(k, 8, 1) * 0.35);
  }
  return c;
}

export function buildWinterKingSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  for (let i = 0; i < 6; i++) poses[`idle${i}`] = () => king({ t: i / 6, mood: 'idle' });
  for (let i = 0; i < 6; i++) poses[`walk${i}`] = () => king({ t: i / 6, mood: 'walk' });
  poses.raise0 = () => king({ t: 0.15, mood: 'raise', flare: 0.6 });
  poses.raise1 = () => king({ t: 0.6, mood: 'raise', flare: 1 });
  poses.lift0 = () => king({ t: 0.3, mood: 'lift', flare: 0.8 });
  poses.slam0 = () => king({ t: 0.5, mood: 'slam', flare: 1 });
  poses.thrust0 = () => king({ t: 0.2, mood: 'thrust', flare: 0.6 });
  poses.thrust1 = () => king({ t: 0.7, mood: 'thrust', flare: 1 });
  poses.summon0 = () => king({ t: 0.25, mood: 'summon', flare: 0.8 });
  poses.summon1 = () => king({ t: 0.75, mood: 'summon', flare: 1 });
  return sheet(F, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3', 'idle4', 'idle5'], fps: 4, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5'], fps: 6, loop: true },
    { name: 'raise', frames: ['raise0', 'raise1'], fps: 5, loop: true },
    { name: 'lift', frames: ['lift0'], fps: 1, loop: false },
    { name: 'slam', frames: ['slam0'], fps: 1, loop: false },
    { name: 'thrust', frames: ['thrust0', 'thrust1'], fps: 7, loop: true },
    { name: 'summon', frames: ['summon0', 'summon1'], fps: 4, loop: true },
  ]);
}

// ---------------------------------------------------------------- Spells (pure light)

type Px = Uint8ClampedArray;

export const WK_ORB = 22;

/** A blizzard orb, frame `f` of four: a ball of whirling snow round a violet core, arms of snow spiralling off it. */
function orbArt(f: number): Px {
  const s = WK_ORB;
  const px = new Uint8ClampedArray(s * s * 4);
  const c = (s - 1) / 2;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = x - c;
      const dy = y - c;
      const r = Math.hypot(dx, dy) / c;
      if (r > 1) continue;
      const a = Math.atan2(dy, dx);
      // Spiral arms turning with the frame.
      const arm = Math.sin(a * 3 - r * 6 + f * (Math.PI / 2)) * 0.5 + 0.5;
      let col: [number, number, number] | null = null;
      if (r < 0.25) col = r < 0.12 ? [255, 255, 255] : [220, 200, 255];
      else if (r < 0.45) col = arm > 0.4 ? [200, 240, 255] : [150, 120, 240];
      else if (arm > 0.55 + r * 0.25 && bayer(x + f, y) < 1.2 - r) col = r < 0.75 ? [154, 232, 255] : [74, 150, 230];
      if (!col) continue;
      px.set([col[0], col[1], col[2], 255], (y * s + x) * 4);
    }
  }
  // Flakes caught in it.
  for (let k = 0; k < 5; k++) {
    const a = hash2(k, f, 3) * Math.PI * 2;
    const d = 0.5 + hash2(k, f, 7) * 0.45;
    const x = Math.round(c + Math.cos(a) * d * c);
    const y = Math.round(c + Math.sin(a) * d * c);
    px.set([255, 255, 255, 255], (y * s + x) * 4);
  }
  return px;
}

export const WK_RUNE_W = 64;
export const WK_RUNE_H = 34;

/** A rune circle on the floor: two rings with a band of angular runes between them, white (tinted at runtime). */
function runeArt(): Px {
  const w = WK_RUNE_W;
  const h = WK_RUNE_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 1;
  const ry = h / 2 - 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      const r = Math.hypot(u, v);
      const a = Math.atan2(v, u);
      let k = 0;
      if (Math.abs(r - 0.97) < 0.04) k = 1;
      else if (Math.abs(r - 0.74) < 0.04) k = 0.85;
      else if (r > 0.78 && r < 0.93) {
        // Runes: short strokes in cells round the band.
        const cell = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 18);
        const local = (((a + Math.PI) / (Math.PI * 2)) * 18) % 1;
        const glyph = hash2(cell, 0, 77);
        const stroke = (local > 0.3 && local < 0.42) || (glyph > 0.5 && Math.abs(r - 0.855) < 0.025 && local > 0.2 && local < 0.8) || (glyph < 0.35 && Math.abs(local - (r - 0.78) * 4) < 0.1);
        if (stroke) k = 0.9;
      } else if (r < 0.7 && bayer(x, y) < 0.12 * (1 - r)) k = 0.35;
      if (!k) continue;
      const v8 = Math.round(255 * k);
      px.set([v8, v8, v8, 255], (y * w + x) * 4);
    }
  }
  return px;
}

export function winterKingFx(r: FxRegistrar): void {
  r.strip('wk_orb', WK_ORB, WK_ORB, [0, 1, 2, 3].map(orbArt), 'o');
  r.anim('wk_orb_spin', 'wk_orb', ['o0', 'o1', 'o2', 'o3'], 12, true);
  r.image('wk_rune', WK_RUNE_W, WK_RUNE_H, runeArt());
}
