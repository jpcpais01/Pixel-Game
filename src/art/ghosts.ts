// The Spirit Dungeon's restless dead, drawn like the other monsters (lit,
// with a glow layer, facing right and mirrored). Spirits are half light:
// their pale parts glow in the emissive layer, and the game draws them a
// little see-through.
//   - The wisp: a lost soul, a small cold flame with two dark eyes and a curling tail.
//   - The shade: a hooded wraith in tatters, no legs, a spectral sickle in its bony hand.
//   - The banshee: a gaunt spirit in a dissolving gown, long hair streaming, who wails.

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, cyl, hex, sphere, FLAT, type Material, type RGB } from './pixel';

const ramp = (...c: string[]): RGB[] => c.map(hex);

const TEAL = hex('#6af4dc');
const WHITE = hex('#eafffa');
const BLUE = hex('#8ac8ff');
const LILAC = hex('#c8b0ff');

const wispBody = (flare: number): Material => ({ ramp: ramp('#14606e', '#2aa0aa', '#62e2d6', '#c4fff2', '#ffffff'), outline: hex('#08242e'), emissive: 0.55 + flare * 0.35, noAO: true });
const WISP_TAIL: Material = { ramp: ramp('#0e3a48', '#1a6a76', '#34a6a6', '#7ae4d6'), outline: hex('#061a22'), emissive: 0.42, noAO: true };
const HOLLOW: Material = { ramp: ramp('#04060c', '#070a14'), outline: hex('#04060c'), noAO: true, noOutline: true };

const CLOAK: Material = { ramp: ramp('#070912', '#0e1322', '#172034', '#22304a', '#314660'), outline: hex('#030409'), outlineLit: hex('#16223a') };
const TATTER: Material = { ramp: ramp('#0a1220', '#12203a', '#1c3450', '#2a4c68'), outline: hex('#03050c'), emissive: 0.18, noAO: true };
const BONE: Material = { ramp: ramp('#3a4450', '#5e6a78', '#8a98a6', '#c0ccd6', '#e8f2f6'), outline: hex('#0a0e14') };
const EYE: Material = { ramp: ramp('#7af8e4', '#f0fffc'), outline: hex('#04060c'), emissive: 1, noAO: true };
const sickle = (k: number): Material => ({ ramp: ramp('#2a8a90', '#62d8d0', '#b4fff0', '#ffffff'), outline: hex('#08262a'), emissive: 0.6 + k * 0.4, shine: true, noAO: true });

const GOWN: Material = { ramp: ramp('#1e2a48', '#324a74', '#5078a4', '#84b0d6', '#c6e6fa'), outline: hex('#070c1a'), outlineLit: hex('#22345a'), emissive: 0.3, noAO: true };
const SKIN: Material = { ramp: ramp('#4a5a78', '#7890b0', '#a8c2dc', '#dcefff'), outline: hex('#0a1020'), emissive: 0.25 };
const hairMat = (k: number): Material => ({ ramp: ramp('#2c2e4c', '#4c5080', '#7c82b4', '#b4bce6', '#eaeeff'), outline: hex('#0a0a1c'), emissive: 0.28 + k * 0.3, noAO: true });

// ---------------------------------------------------------------- Wisp

interface WispPose {
  /** 0..1 phase of the flicker. */
  t: number;
  flare?: number;
  /** Streaking forward: the tail stretches straight out behind. */
  dash?: boolean;
}

function wisp(p: WispPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.wisp;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const flare = p.flare ?? 0;
  const sway = Math.sin(tau) * 1.5;
  const bx = 11;
  const by = 12;

  // The tail, curling away behind and below.
  c.part();
  if (p.dash) {
    c.capsule(bx - 2, by + 1, bx - 7, by + 1.5, 3.4, 2, WISP_TAIL);
    c.capsule(bx - 7, by + 1.5, 1, by + 2, 2, 0.6, WISP_TAIL);
  } else {
    c.capsule(bx - 1, by + 2, bx - 5, by + 5 + sway * 0.4, 3.2, 1.9, WISP_TAIL);
    c.capsule(bx - 5, by + 5 + sway * 0.4, bx - 8 + sway * 0.3, by + 9 + sway, 1.9, 0.6, WISP_TAIL);
  }
  for (let k = 0; k < 3; k++) c.spark(bx - 8 - k * 1.3 + sway * 0.3, by + 9 + sway - k, k % 2 ? WHITE : TEAL, 0.5 - k * 0.12);

  // The flame over its head, streaming back.
  c.part();
  const top = 2 + (p.t < 0.5 ? 0 : 1) - flare;
  const back = p.dash ? 4 : 2 + sway * 0.4;
  c.shape(Math.round(top), by, (y) => {
    const u = (y - top) / (by - top);
    const hw = 0.5 + Math.sin(Math.min(1, u) * Math.PI * 0.55) * (4.2 + flare * 0.6);
    const lean = -(1 - u) * back;
    return [bx - hw + lean, bx + hw + lean];
  }, wispBody(flare), () => FLAT);
  // The round body.
  c.part();
  c.ellipse(bx, by, 4.8 + flare * 0.5, 4.5 + flare * 0.4, wispBody(flare));
  // A white-hot core.
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) c.spark(bx - 1 + x, by + 1 + y, WHITE, x === 0 && y === 0 ? 0.8 : 0.35);
  // Eyes: two dark slits, and a mouth when it flares.
  c.part();
  c.px(bx + 1, by - 1, HOLLOW);
  c.px(bx + 1, by, HOLLOW);
  c.px(bx + 3, by - 1, HOLLOW);
  c.px(bx + 3, by, HOLLOW);
  if (flare > 0.5) {
    c.px(bx + 2, by + 2, HOLLOW);
    c.px(bx + 2, by + 3, HOLLOW);
  }
  // Sparks flying off the tip.
  c.spark(bx - back - 1, top - 1, WHITE, 0.5 + flare * 0.4);
  c.spark(bx - back + 1, top + 1, TEAL, 0.4);
  return c;
}

export function buildWispSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => wisp({ t: i / 4 })));
  poses.flare0 = () => wisp({ t: 0.1, flare: 1 });
  poses.flare1 = () => wisp({ t: 0.6, flare: 1 });
  poses.dash = () => wisp({ t: 0, flare: 0.8, dash: true });
  return sheet(MONSTER_FRAME.wisp, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 9, loop: true },
    { name: 'windup', frames: ['flare0', 'flare1'], fps: 14, loop: true },
  ]);
}

// ---------------------------------------------------------------- Shade

type ShadeArm = 'rest' | 'raise' | 'swing';

interface ShadePose {
  t: number;
  arm: ShadeArm;
  flare?: number;
}

/** A spectral sickle: a short haft from the hand and a crescent blade. */
function drawSickle(c: PixelCanvas, hx: number, hy: number, ang: number, k: number): void {
  const ex = hx + Math.cos(ang) * 5;
  const ey = hy + Math.sin(ang) * 5;
  c.part();
  c.line(Math.round(hx), Math.round(hy), Math.round(ex), Math.round(ey), BONE, () => cyl(0, 0.3));
  // The blade curls round from the haft's end, its point toward the front.
  c.part();
  const m = sickle(k);
  const px = -Math.sin(ang);
  const py = Math.cos(ang);
  const ccx = ex + px * 4;
  const ccy = ey + py * 4;
  for (let i = 0; i <= 12; i++) {
    const a = Math.atan2(ey - ccy, ex - ccx) + (i / 12) * Math.PI * 1.1 * -1;
    const r = 4.3;
    const x = ccx + Math.cos(a) * r;
    const y = ccy + Math.sin(a) * r;
    c.px(x, y, m, sphere(Math.cos(a) * 0.5, -Math.sin(a) * 0.5));
    if (i < 9) c.px(x - Math.cos(a) * 0.9, y - Math.sin(a) * 0.9, m, sphere(0, 0));
  }
}

function shade(p: ShadePose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.shade;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const flare = p.flare ?? 0;
  const cx = 14;

  // Tatters trailing where legs should be, fraying into motes.
  [-6, -2.5, 1, 4.5].forEach((ox, i) => {
    c.part();
    const sway = Math.sin(tau + i * 1.7) * 1.6;
    const len = 7 + (i % 2) * 2;
    const x0 = cx + ox;
    c.capsule(x0, 25, x0 + sway * 0.5 - 0.5, 25 + len * 0.6, 2.2, 1.4, TATTER);
    c.capsule(x0 + sway * 0.5 - 0.5, 25 + len * 0.6, x0 + sway - 1, 25 + len, 1.4, 0.5, TATTER);
    c.spark(x0 + sway - 1, 26 + len, TEAL, 0.35);
    c.spark(x0 + sway - 1.5, 28 + len, BLUE, 0.2);
  });

  // The cloak, widening to the hem.
  c.part();
  c.shape(11, 27, (y) => {
    const u = (y - 11) / 16;
    const hw = 4.8 + u * 4.2 + (y > 24 ? Math.sin(tau + y) * 0.4 : 0);
    return [cx - hw - 0.5, cx + hw];
  }, CLOAK, (_x, _y, t) => cyl(t, 0.1));
  for (let y = 15; y < 27; y++) {
    c.shade(cx - 2, y, -1);
    c.shade(cx + 3, y, -1);
  }
  // A cold rim of light down its edges.
  for (let y = 12; y < 27; y++) {
    const u = (y - 11) / 16;
    c.spark(cx - 5.3 - u * 4.2, y, TEAL, 0.16);
  }

  // Hood with a crooked point, and the void where a face should be.
  c.part();
  c.ellipse(cx + 0.5, 8.5, 5.6, 6, CLOAK);
  c.capsule(cx - 3, 4, cx - 6, 1.5 + Math.sin(tau) * 0.5, 1.8, 0.6, CLOAK);
  c.part();
  c.ellipse(cx + 2.2, 9.5, 3, 3.4, HOLLOW);
  c.part();
  c.px(cx + 1, 9, EYE);
  c.px(cx + 4, 9, EYE);
  c.spark(cx + 1, 10, TEAL, 0.3 + flare * 0.4);
  c.spark(cx + 4, 10, TEAL, 0.3 + flare * 0.4);
  if (flare > 0) {
    c.spark(cx, 9, TEAL, flare * 0.5);
    c.spark(cx + 5, 9, TEAL, flare * 0.5);
  }

  // The bony arm and its sickle.
  const sx = cx + 3;
  const sy = 14;
  const [ex, ey, hx, hy, ang] =
    p.arm === 'rest' ? [cx + 6, 18, cx + 8, 21, 1.1] : p.arm === 'raise' ? [cx - 1, 10, cx - 4, 5, -2.2] : [cx + 9, 16, cx + 13, 19, 0.35];
  c.part();
  c.capsule(sx, sy, ex, ey, 2.4, 1.8, CLOAK);
  c.part();
  c.capsule(ex, ey, hx, hy, 1.1, 0.9, BONE);
  c.ellipse(hx, hy, 1.4, 1.4, BONE);
  drawSickle(c, hx, hy, ang, flare);
  if (p.arm === 'swing') {
    // The smear of the swipe, sweeping down from overhead.
    for (let i = 0; i < 14; i++) {
      const a = -1.9 + i * 0.16;
      c.spark(cx + 3 + Math.cos(a) * 12, 14 + Math.sin(a) * 11, i % 3 ? TEAL : WHITE, 0.25 + (i / 14) * 0.5);
    }
  }
  return c;
}

export function buildShadeSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => shade({ t: i / 4, arm: 'rest' })));
  poses.raise0 = () => shade({ t: 0.2, arm: 'raise', flare: 0.6 });
  poses.raise1 = () => shade({ t: 0.7, arm: 'raise', flare: 1 });
  poses.swing = () => shade({ t: 0.4, arm: 'swing', flare: 1 });
  return sheet(MONSTER_FRAME.shade, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 6, loop: true },
    { name: 'walk', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 9, loop: true },
    { name: 'windup', frames: ['raise0', 'raise1'], fps: 8, loop: true },
  ]);
}

// ---------------------------------------------------------------- Banshee

interface BansheePose {
  t: number;
  /** 0..1 how far into the wail: mouth open, arms flung wide, hair streaming up. */
  wail?: number;
}

function banshee(p: BansheePose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.banshee;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const wl = p.wail ?? 0;
  const cx = 14;
  const hair = hairMat(wl);

  // Hair behind her, long and loose: it hangs down her back, and streams up when she wails.
  for (let i = 0; i < 4; i++) {
    c.part();
    const sway = Math.sin(tau + i * 1.1) * 1.4;
    const x0 = cx - 1 - i * 0.8;
    const y0 = 5 + i * 0.6;
    const mx = x0 - 4 - i * 0.6 - wl * 3;
    const my = y0 + 9 * (1 - wl) - wl * 3 + sway * 0.4;
    const x1 = x0 - 5 - i * 1.2 - wl * 5 + sway * (1 - wl);
    const y1 = y0 + (19 + i * 1.5) * (1 - wl) - wl * 4 + sway;
    c.capsule(x0, y0, mx, my, 2.2, 1.6, hair);
    c.capsule(mx, my, x1, y1, 1.6, 0.6, hair);
    c.spark(x1, y1 + (wl ? -1 : 1), LILAC, 0.35);
  }

  // The gown, dissolving into wisps below the knee.
  c.part();
  c.shape(12, 31, (y) => {
    const u = (y - 12) / 19;
    const hw = 3.2 + u * u * 5.5 + Math.sin(tau + y * 0.7) * 0.4 * u;
    return [cx - hw, cx + hw];
  }, GOWN, (_x, _y, t) => cyl(t, 0.15));
  for (let y = 19; y < 31; y++) c.shade(cx + 1, y, -1);
  for (let k = 0; k < 6; k++) {
    const x = cx - 7 + k * 2.6 + Math.sin(tau + k * 1.9) * 0.8;
    const len = 2 + ((k * 7) % 4);
    for (let j = 0; j < len; j++) c.spark(x, 31 + j, j % 2 ? BLUE : WHITE, 0.45 - j * 0.09);
  }

  // Arms: thin and pale, hanging, or flung out when she wails.
  for (const side of [-1, 1]) {
    c.part();
    const sx = cx + side * 3;
    const hx = cx + side * (5 + wl * 7);
    const hy = 23 - wl * 12;
    const ex = cx + side * (4.5 + wl * 3.5);
    const ey = 18 - wl * 5;
    c.capsule(sx, 14, ex, ey, 1.3, 1, SKIN);
    c.capsule(ex, ey, hx, hy, 1, 0.8, SKIN);
    c.spark(hx + side, hy, WHITE, 0.3 + wl * 0.4);
  }

  // The head: a gaunt pale face, hollow eyes, and a mouth that opens wide.
  c.part();
  c.ellipse(cx + 1, 8, 3.6, 4.3, SKIN);
  c.part();
  c.px(cx + 1, 7, HOLLOW);
  c.px(cx + 3, 7, HOLLOW);
  c.spark(cx + 1, 7, TEAL, 0.5 + wl * 0.5);
  c.spark(cx + 3, 7, TEAL, 0.5 + wl * 0.5);
  if (wl > 0.2) c.ellipse(cx + 2, 11, 1.1, 0.8 + wl * 1.2, HOLLOW);
  else c.px(cx + 2, 10, HOLLOW);
  // Hair over the crown and down the near side of her face.
  c.part();
  c.ellipse(cx + 0.5, 4.5, 4.2, 2.4, hair);
  c.capsule(cx + 4, 5, cx + 4.5 - wl, 12 - wl * 4, 1.2, 0.7, hair);
  if (wl > 0.5) {
    // The wail itself: rings of cold sound spreading from her mouth.
    for (let i = 0; i < 10; i++) {
      const a = -0.7 + i * 0.15;
      c.spark(cx + 3 + Math.cos(a) * 6, 11 + Math.sin(a) * 6, WHITE, 0.35);
      c.spark(cx + 3 + Math.cos(a) * 9, 11 + Math.sin(a) * 9, TEAL, 0.22);
    }
  }
  return c;
}

export function buildBansheeSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => banshee({ t: i / 4 })));
  poses.wail0 = () => banshee({ t: 0.2, wail: 0.5 });
  poses.wail1 = () => banshee({ t: 0.5, wail: 0.8 });
  poses.wail2 = () => banshee({ t: 0.8, wail: 1 });
  return sheet(MONSTER_FRAME.banshee, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 6, loop: true },
    { name: 'walk', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 8, loop: true },
    { name: 'windup', frames: ['wail0', 'wail1'], fps: 6, loop: true },
    { name: 'cast', frames: ['wail2', 'wail1', 'wail2'], fps: 10, loop: false },
  ]);
}

/** Particle tints for each spirit's burst when it is laid to rest. */
export const WISP_TINTS = [0xeafffa, 0x6af4dc, 0x62e2d6, 0xffffff];
export const SHADE_TINTS = [0x6af4dc, 0x8ac8ff, 0x2a4c68, 0xeafffa];
export const BANSHEE_TINTS = [0xeafffa, 0x8ac8ff, 0xc8b0ff, 0x84b0d6];
