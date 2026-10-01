// The Aurora Colosseum's strong creatures, drawn like the other monsters
// (lit, with a glow layer, facing right and mirrored):
//   - The Frost Troll: a hunched blue-hided brute, a shaggy grey mane down
//     its spine and a crust of ice growing from its shoulders, underbite
//     tusks and an icicle beard. It drags a log club knotted with ice; it
//     heaves it over its shoulder and brings it down. Left alone it knits
//     its wounds shut with frost: glowing seams crawl over its hide.
//   - The Tuskmaw: a woolly mammoth in a shag of dark umber fur, snow lying
//     on its back, icicles in its fringe, great ivory tusks rimed white at
//     the tips. It rears and trumpets before it stomps, swings its head to
//     sweep, and lowers it to charge.
//   - The Frostdrake: a young ice wyvern flying low, steel-blue scales, a
//     pale belly, a crest of ice down its neck and a crystal fin at its tail,
//     wings of thin blue membrane that let the light through. It coils its
//     neck back, its chest glowing, before it breathes.
//   - The Yeti: a great round heap of white fur, a blue face under a heavy
//     brow, short black horns. It rips a boulder of packed snow out of the
//     floor and heaves it, and it leaps and comes down fists first.
//   - The Rimeknight: tall and slender in blued frost-iron, a crown of ice
//     on its helm, a glowing visor slit, a tattered teal cape, and a
//     greatsword of glowing ice it holds upright before it.
//
// Also here, their spells' pictures (prefix fs_): the slash crescent, the
// knight's blade wave, the breath cone telegraph and its puffs of frost, and
// the yeti's boulder.

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { bayer, clamp01 } from './bitmap';
import { rng } from './env';
import {
  CLOTH,
  C_ICE,
  C_WHITE,
  FUR_GREY,
  FUR_WHITE,
  GLOW_ICE,
  HIDE,
  HOLLOW,
  HORN,
  ICE,
  ICE_DARK,
  ICE_GLOW,
  INK,
  IRON,
  IVORY,
  LEATHER,
  RIME,
  SILVER,
  SNOW,
  VELVET,
  crystal,
  icicles,
  poly,
  ramp,
  type FxRegistrar,
} from './frostKit';

// ---------------------------------------------------------------- Materials

/** The troll's belly and chest: its hide, a shade paler. */
const TROLL_BELLY: Material = { ramp: ramp('#263446', '#38495e', '#4e6278', '#687e96', '#8aa0b6', '#aec2d4'), outline: INK, outlineLit: hex('#1c2838') };
/** Old cold wood: the troll's club. */
const WOOD: Material = { ramp: ramp('#110c0e', '#1e1618', '#2e2426', '#423436', '#584846', '#706058'), outline: INK };
/** A mammoth's shag: umber on top, blue-black in its folds. */
const SHAG: Material = { ramp: ramp('#09080e', '#141219', '#221d24', '#33292c', '#463834', '#5e4a40', '#76604e'), outline: INK, outlineLit: hex('#1a1418') };
/** The soles of its feet: grey and cracked. */
const SOLE: Material = { ramp: ramp('#14141c', '#22222c', '#34343e', '#4a4a52'), outline: INK };
/** The drake's scales: steel-blue going to frost on the light side. */
const SCALE: Material = { ramp: ramp('#0a1426', '#11223e', '#1a3658', '#264e78', '#386c98', '#5492b8', '#86bcd8'), outline: INK, outlineLit: hex('#12223a'), shine: true };
/** Its belly plates: pale ice-white. */
const PLATE: Material = { ramp: ramp('#3a4a62', '#5e7290', '#8aa2bc', '#b8cee0', '#e2eef8'), outline: INK };
/** Its wings: a thin membrane the light shows through. */
const MEMBRANE: Material = { ramp: ramp('#122244', '#1c3864', '#2a5488', '#3e74aa', '#5a98c8', '#84bee0'), outline: hex('#050c1c'), outlineLit: hex('#14305a'), emissive: 0.18 };
/** The yeti's face, palms and soles: a cold blue skin. */
const YETI_SKIN: Material = { ramp: ramp('#101c38', '#182a50', '#22406e', '#305a90', '#4478ae', '#6a9ccc'), outline: INK, outlineLit: hex('#14204a') };
/** The knight's blade: ice lit from within. */
const BLADE: Material = { ...ICE, emissive: 0.4 };

/** The same material a shade darker: far limbs, the side turned from the light. */
const backs = new Map<Material, Material>();
const back = (m: Material): Material => {
  let v = backs.get(m);
  if (!v) backs.set(m, (v = { ...m, bias: (m.bias ?? 0) - 1 }));
  return v;
};

/** Debris tints for each creature's fall. */
export const TROLL_TINTS = [0x4e6278, 0x8aa0b6, 0x9ae8ff, 0xe8fbff];
export const MAMMOTH_TINTS = [0x463834, 0x76604e, 0xd2c8ac, 0xe4eefa];
export const DRAKE_TINTS = [0x386c98, 0x86bcd8, 0x9ae8ff, 0xe8fbff];
export const YETI_TINTS = [0xeef2fa, 0xc8d0e4, 0x4478ae, 0xffffff];
export const KNIGHT_TINTS = [0x4e6080, 0xaabcd6, 0x9ae8ff, 0x3c7ea2];

const UP: Vec3 = { x: -0.2, y: 0.6, z: 0.78 };

// ---------------------------------------------------------------- Helpers

/** A strand of hair hanging from (x, y), `len` px, leaning `lean` px by its end: lit at the root, dark at the tip. */
function strand(c: PixelCanvas, x: number, y: number, len: number, lean: number, m: Material): void {
  for (let k = 0; k < len; k++) {
    const u = len > 1 ? k / (len - 1) : 0;
    c.px(x + lean * u, y + k, m, { x: -0.1 + lean * 0.15, y: 0.45 - u * 0.9, z: 0.75 });
  }
}

/** A fringe of shaggy hair from x0 to x1, its roots at `top(x)`, each strand about `len(x)` long. */
function fringe(c: PixelCanvas, x0: number, x1: number, top: (x: number) => number, len: (x: number) => number, m: Material, seed: number, lean = 0): void {
  const R = rng(seed);
  for (let x = x0; x <= x1; x++) {
    if (R() < 0.15) continue;
    const l = Math.max(1, Math.round(len(x) * (0.6 + R() * 0.6)));
    strand(c, x, top(x) + Math.round(R() * 1.5), l, lean + (R() - 0.5) * 1.2, R() < 0.3 ? back(m) : m);
  }
}

/** Hair streaks over what's drawn in a box: short dark runs, and a few lit ones. */
function streaks(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, n: number, seed: number): void {
  const R = rng(seed);
  for (let k = 0; k < n; k++) {
    const x = Math.round(x0 + R() * (x1 - x0));
    const y = Math.round(y0 + R() * (y1 - y0));
    const d = R() < 0.75 ? -1 : 1;
    const l = 1 + Math.floor(R() * 3);
    for (let i = 0; i < l; i++) c.shade(x + (R() < 0.3 ? 1 : 0), y + i, d);
  }
}

/** An ellipse of fur with a shaggy edge: tufts stick out of its sides and hang off its bottom. */
function shag(c: PixelCanvas, x: number, y: number, rx: number, ry: number, m: Material, seed: number, tufts = 18, from = -0.4): void {
  c.ellipse(x, y, rx, ry, m);
  const R = rng(seed);
  for (let k = 0; k < tufts; k++) {
    // From the upper sides round under the bottom, where hair hangs.
    const a = Math.PI * (from + R() * (1 - 2 * from));
    const ex = x + Math.cos(a) * rx * 0.96;
    const ey = y + Math.sin(a) * ry * 0.96;
    let dx = Math.cos(a) * 0.6;
    let dy = Math.sin(a) * 0.6 + 0.6;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const len = 1 + Math.floor(R() * 2.6);
    const n = sphere(Math.cos(a) * 0.9, Math.sin(a) * 0.9);
    for (let i = 1; i <= len; i++) c.px(ex + dx * i, ey + dy * i, m, n);
  }
}

/** Rotate (x, y) about (px, py) by `a` radians. */
const turn = (x: number, y: number, px: number, py: number, a: number): [number, number] => {
  const s = Math.sin(a);
  const co = Math.cos(a);
  const dx = x - px;
  const dy = y - py;
  return [px + dx * co - dy * s, py + dx * s + dy * co];
};

/** A chain of capsules through `pts`, its radius going through `r`. */
function chain(c: PixelCanvas, pts: [number, number][], r: number[], m: Material): void {
  for (let i = 0; i < pts.length - 1; i++) c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r[i], r[i + 1], m);
}

// ---------------------------------------------------------------- Frost Troll

type ClubPose = 'rest' | 'raise' | 'high' | 'slam' | 'follow';

interface TrollPose {
  /** Breath, 0..1 round. */
  t?: number;
  /** Walk frame 0..3. */
  step?: number;
  club?: ClubPose;
  /** 0..1: frost knitting its wounds, the seams glowing. */
  knit?: number;
  roar?: boolean;
}

/** The troll's club: a knotted log, gripped at (gx, gy), its head at (tx, ty), ice grown through it. */
function club(c: PixelCanvas, gx: number, gy: number, tx: number, ty: number): void {
  const l = Math.hypot(tx - gx, ty - gy) || 1;
  const ux = (tx - gx) / l;
  const uy = (ty - gy) / l;
  const nx = -uy;
  const ny = ux;
  c.part();
  c.capsule(gx - ux * 3, gy - uy * 3, tx - ux * 2, ty - uy * 2, 1.5, 2.6, WOOD);
  // A band of iron where it begins to swell.
  c.part();
  const bx = gx + ux * l * 0.62;
  const by = gy + uy * l * 0.62;
  c.capsule(bx + nx * 2.4, by + ny * 2.4, bx - nx * 2.4, by - ny * 2.4, 0.8, 0.8, IRON);
  c.part();
  c.ellipse(tx, ty, 5, 4.6, WOOD);
  c.shade(tx - 1, ty + 1, -1);
  c.shade(tx + 1, ty - 1, -1);
  // Ice grown out of the knots: one along it, two to the sides.
  c.part();
  crystal(c, tx + ux * 2, ty + uy * 2, tx + ux * 7 + nx * 1.5, ty + uy * 7 + ny * 1.5, 1.6, ICE);
  c.part();
  crystal(c, tx + nx * 2.5, ty + ny * 2.5, tx + nx * 6.5 + ux * 1.5, ty + ny * 6.5 + uy * 1.5, 1.3, ICE, C_ICE);
  c.part();
  crystal(c, tx - nx * 2.5, ty - ny * 2.5, tx - nx * 5.5 + ux, ty - ny * 5.5 + uy, 1.2, ICE_DARK, null);
  c.part();
  for (let k = -2; k <= 2; k++) c.px(tx + k, ty - 4 + Math.abs(k) * 0.5, RIME, UP);
}

function troll(p: TrollPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.frost_troll;
  const c = new PixelCanvas(w, h);
  const cx = 24;
  const foot = 51;
  const pose = p.club ?? 'rest';
  const walking = p.step !== undefined;
  const st = p.step ?? 0;
  const breathe = walking ? 0 : Math.sin((p.t ?? 0) * Math.PI * 2);
  const bob = walking ? (st % 2 ? -1 : 0) : Math.round(breathe * 0.5);
  // Rearing back to lift the club, lunging forward and down to bring it home.
  const lean = { rest: 0, raise: -1, high: -2, slam: 2, follow: 1 }[pose];
  const drop = { rest: 0, raise: 0, high: -1, slam: 3, follow: 2 }[pose] + (p.knit ? 1 : 0);
  const bx = lean;
  const by = bob + drop;
  const hipY = 39 + by;

  // Legs: short, bowed, heavy. In stride the near leg leads, then the far.
  const stride = walking ? [2.5, 0, -2.5, 0][st] : pose === 'slam' || pose === 'follow' ? 3 : 0;
  const lifted = (near: boolean) => (walking && ((st === 1 && !near) || (st === 3 && near)) ? 2 : 0);
  const leg = (hx: number, sw: number, up: number, m: Material) => {
    const kx = hx + sw * 0.5 + 1.5;
    const ky = hipY + 6 - up;
    const ax = hx + sw;
    const ay = foot - 2 - up;
    c.part();
    c.capsule(hx, hipY, kx, ky, 4.2, 3.6, m);
    c.capsule(kx, ky, ax, ay, 3.6, 3, m);
    c.part();
    c.ellipse(ax + 1.5, ay + 0.8, 4.2, 1.9, m);
    c.part();
    c.px(ax + 5, ay + 1, HORN);
    c.px(ax + 4, ay + 2, HORN);
    c.px(ax + 2, ay + 2, HORN);
  };

  // The far arm, behind it all: swinging, or flung out for balance as the club goes up.
  const armSw = walking ? -stride * 0.6 : 0;
  const fs: [number, number] = [cx - 6 + bx, 22 + by];
  let fe: [number, number] = [cx - 9 + bx - armSw, 31 + by];
  let fh: [number, number] = [cx - 8 + bx - armSw * 1.4, 38 + by];
  if (pose === 'raise' || pose === 'high') {
    fe = [cx - 2 + bx, 29 + by];
    fh = [cx + 5 + bx, 31 + by];
  } else if (pose === 'slam' || pose === 'follow') {
    fe = [cx - 11 + bx, 28 + by];
    fh = [cx - 14 + bx, 33 + by];
  }
  c.part();
  c.capsule(fs[0], fs[1], fe[0], fe[1], 3.8, 3.3, back(HIDE));
  c.capsule(fe[0], fe[1], fh[0], fh[1], 3.3, 3, back(HIDE));
  c.part();
  c.ellipse(fh[0], fh[1], 3.1, 2.9, back(HIDE));

  leg(cx - 4 + bx * 0.5, -stride, lifted(false), back(HIDE));
  leg(cx + 3 + bx * 0.5, stride, lifted(true), HIDE);

  // The club, when it's slung back over the shoulder, goes behind the body.
  let hand: [number, number];
  let elbow: [number, number];
  let head: [number, number];
  switch (pose) {
    case 'raise':
      hand = [cx + 3 + bx, 11 + by];
      elbow = [cx + 7 + bx, 18 + by];
      head = [cx - 4 + bx, 4];
      break;
    case 'high':
      hand = [cx + 1 + bx, 10 + by];
      elbow = [cx + 6 + bx, 16 + by];
      head = [cx - 14 + bx, 9 + by];
      break;
    case 'slam':
      hand = [cx + 12 + bx, 36 + by];
      elbow = [cx + 9 + bx, 29 + by];
      head = [cx + 20, 46];
      break;
    case 'follow':
      hand = [cx + 12 + bx, 35 + by];
      elbow = [cx + 9 + bx, 29 + by];
      head = [cx + 19, 45];
      break;
    default:
      hand = [cx + 10 + bx - armSw * 0.4, 36 + by];
      elbow = [cx + 8 + bx, 30 + by];
      head = [cx + 19 + stride * 0.4, 47];
  }
  if (pose === 'high') club(c, hand[0], hand[1], head[0], head[1]);

  // The body: a hump of shoulder over a heavy pear of a gut.
  c.part();
  c.ellipse(cx - 1 + bx, 30 + by, 11.5, 9.5 + breathe * 0.3, HIDE);
  c.part();
  c.ellipse(cx - 3 + bx, 22 + by - breathe * 0.4, 10, 7, HIDE);
  streaks(c, cx - 12 + bx, 16 + by, cx + 8 + bx, 37 + by, 14, 11);
  c.part();
  c.ellipse(cx + 3 + bx, 32 + by, 7, 6.2 + breathe * 0.4, TROLL_BELLY);
  c.shade(cx + 2 + bx, 33 + by, -1);
  // A hide loincloth on a rope belt, its hem torn.
  c.part();
  poly(
    c,
    [
      [cx - 9 + bx, hipY - 3],
      [cx + 9 + bx, hipY - 3],
      [cx + 8 + bx, hipY + 3],
      [cx + 5 + bx, hipY + 5],
      [cx + 3 + bx, hipY + 3],
      [cx + 0 + bx, hipY + 6],
      [cx - 3 + bx, hipY + 3],
      [cx - 6 + bx, hipY + 5],
      [cx - 9 + bx, hipY + 2],
    ],
    FUR_GREY,
    (_x, y) => ({ x: 0, y: 0.4 - (y - hipY) * 0.1, z: 0.85 }),
  );
  c.part();
  c.line(cx - 9 + bx, hipY - 3, cx + 9 + bx, hipY - 3, LEATHER, () => UP);
  c.part();
  fringe(c, cx - 8 + bx, cx + 8 + bx, (x) => hipY + 3 + ((x * 7) % 3 === 0 ? 1 : 0), () => 3, FUR_GREY, 17);

  // A shaggy grey mane down its spine.
  c.part();
  fringe(c, cx - 14 + bx, cx - 2 + bx, (x) => 15 + by + Math.round((cx - 2 + bx - x) * 0.6), (x) => 4 + (cx - x) * 0.35, FUR_WHITE, 21, -1);
  // Ice crusted on its shoulders, crystals growing up off the hump.
  const ice: [number, number, number, number, number, Material][] = [
    [-10, 21, -14, 13, 1.8, ICE_DARK],
    [-7, 17, -9, 8, 2.1, ICE],
    [-3, 16, -2, 9, 1.6, ICE],
    [-5, 18, -7, 13, 1.2, ICE],
  ];
  for (const [x0, y0, x1, y1, r, m] of ice) {
    c.part();
    crystal(c, cx + x0 + bx, y0 + by, cx + x1 + bx, y1 + by, r, m, m === ICE ? C_WHITE : null);
  }
  c.part();
  for (const [x, y] of [[-8, 17], [-5, 16], [-1, 16], [-11, 20], [1, 17]]) c.px(cx + x + bx, y + by, RIME, UP);

  // The head: low and thrust forward, a heavy brow, a big nose, an underbite and tusks.
  const hx = cx + 11 + bx + (pose === 'slam' ? 1 : 0);
  const hy = 23 + by + (p.roar ? -1 : 0);
  c.part();
  c.capsule(hx - 4, hy - 2, hx - 7, hy - 6, 1.6, 0.6, back(HIDE));
  c.part();
  c.ellipse(hx, hy, 5.5, 5, HIDE);
  c.part();
  c.ellipse(hx + 2, hy + (p.roar ? 4.5 : 3), 5, 2.6, HIDE);
  if (p.roar) {
    c.part();
    c.ellipse(hx + 3, hy + 2.2, 3, 1.6, HOLLOW);
  } else {
    c.part();
    for (let x = hx + 1; x <= hx + 5; x++) c.px(x, hy + 2, HOLLOW);
  }
  c.part();
  c.ellipse(hx + 1.5, hy - 2.5, 4.6, 1.8, HIDE);
  c.part();
  c.ellipse(hx + 5, hy, 2.2, 2, HIDE);
  // Tusks, up from the lower jaw.
  c.part();
  const jy = p.roar ? 1.5 : 0;
  c.capsule(hx + 1, hy + 3.5 + jy, hx + 1.5, hy + 0.5 + jy, 0.9, 0.4, back(IVORY));
  c.part();
  c.capsule(hx + 5, hy + 3.5 + jy, hx + 6, hy - 0.5 + jy, 1.2, 0.45, IVORY);
  // Eyes of cold light under the brow.
  c.part();
  c.px(hx + 3, hy - 1, GLOW_ICE);
  c.px(hx, hy - 1, GLOW_ICE, undefined, { glow: 0.55 });
  // A white tuft on its crown, an icicle beard.
  c.part();
  c.capsule(hx - 1, hy - 4, hx - 4, hy - 8, 1.2, 0.5, FUR_WHITE);
  c.capsule(hx - 3, hy - 3, hx - 7, hy - 5, 1.1, 0.4, FUR_WHITE);
  c.part();
  icicles(c, hx, hx + 4, hy + 5 + jy, 3, 7);

  // The near arm and the club in its fist.
  if (pose !== 'high') club(c, hand[0], hand[1], head[0], head[1]);
  const sh: [number, number] = [cx + 3 + bx, 23 + by];
  c.part();
  c.capsule(sh[0], sh[1], elbow[0], elbow[1], 4.6, 3.8, HIDE);
  c.part();
  c.capsule(elbow[0], elbow[1], hand[0], hand[1], 3.9, 3.3, HIDE);
  // A great knot of shoulder over the arm.
  c.part();
  c.ellipse(sh[0], sh[1] - 1, 4.8, 4.2, HIDE);
  // A leather wrap round the wrist, rimed.
  c.part();
  const wx = elbow[0] + (hand[0] - elbow[0]) * 0.7;
  const wy = elbow[1] + (hand[1] - elbow[1]) * 0.7;
  c.ellipse(wx, wy, 2.6, 2.4, LEATHER);
  c.part();
  c.ellipse(hand[0], hand[1], 3.4, 3.2, HIDE);
  c.shade(hand[0] + 1, hand[1] + 1, -1);
  c.px(wx - 1, wy - 2, RIME, UP);
  c.px(sh[0] - 1, sh[1] - 4, RIME, UP);

  if (pose === 'slam') {
    // The blow lands: snow and splinters of ice fly off the club's head.
    const [tx, ty] = head;
    for (const [dx, dy, a] of [[-6, 2, 0.8], [6, 1, 0.9], [-3, -3, 0.6], [4, -4, 0.7], [0, -6, 0.5], [8, -2, 0.5], [-8, -1, 0.5]] as const) c.spark(tx + dx, ty + dy, C_ICE, a);
    for (const [dx, dy] of [[-5, -2], [5, -3], [2, -6], [-2, -5]]) c.px(tx + dx, ty + dy, SNOW, UP);
  }

  if (p.knit) {
    // Wounds sealing: seams of light crawling over its hide, fresh ice on them.
    const g = 0.45 + p.knit * 0.55;
    const seams: [number, number][][] = [
      [[-6, 20], [-4, 22], [-5, 24], [-3, 26]],
      [[1, 27], [3, 29], [2, 31], [4, 33]],
      [[-9, 29], [-8, 31], [-10, 33]],
      [[6, 31], [7, 33]],
    ];
    c.part();
    for (const s of seams) {
      for (let i = 0; i < s.length - 1; i++) c.line(cx + s[i][0] + bx, s[i][1] + by, cx + s[i + 1][0] + bx, s[i + 1][1] + by, ICE_GLOW, () => UP, { glow: g });
    }
    c.part();
    crystal(c, cx + bx, 17 + by, cx + 2 + bx, 12 + by - p.knit * 2, 1.1, ICE, C_WHITE);
    for (const [x, y] of [[-12, 18], [8, 24], [-2, 33], [10, 30], [-13, 30]]) c.spark(cx + x + bx, y + by - p.knit * 2, C_ICE, 0.4 + p.knit * 0.5);
  }
  return c;
}

export function buildFrostTrollSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => troll({ t: i / 4 })));
  [0, 1, 2, 3].forEach((i) => (poses[`walk${i}`] = () => troll({ step: i })));
  poses.raise = () => troll({ club: 'raise' });
  poses.high = () => troll({ club: 'high', roar: true });
  poses.slam = () => troll({ club: 'slam' });
  poses.follow = () => troll({ club: 'follow' });
  poses.knit0 = () => troll({ t: 0.25, knit: 0.4 });
  poses.knit1 = () => troll({ t: 0.75, knit: 1 });
  poses.roar = () => troll({ t: 0.25, roar: true });
  return sheet(MONSTER_FRAME.frost_troll, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 4, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 6, loop: true },
    { name: 'windup', frames: ['raise', 'high'], fps: 4, loop: false },
    { name: 'attack', frames: ['slam', 'follow'], fps: 6, loop: false },
    { name: 'knit', frames: ['knit0', 'knit1'], fps: 3, loop: true },
    { name: 'roar', frames: ['roar'], fps: 1, loop: false },
  ]);
}

// ---------------------------------------------------------------- Tuskmaw

interface MammothPose {
  t?: number;
  step?: number;
  /** Body tilt about the hind hips: negative rears up. */
  tilt?: number;
  /** Head turn about the neck: negative lifts the tusks, positive drops them. */
  headA?: number;
  trunk?: 'hang' | 'curl' | 'up' | 'swing';
  /** Front legs: standing, lifted in a rear, or slammed down wide. */
  front?: 'stand' | 'rear' | 'stomp';
  /** Gallop frame (0 reaching, 1 gathered). */
  gallop?: number;
  mouth?: boolean;
  daze?: boolean;
}

function mammoth(p: MammothPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.tuskmaw;
  const c = new PixelCanvas(w, h);
  const cx = 31;
  const foot = 50;
  const walking = p.step !== undefined;
  const st = p.step ?? 0;
  const breathe = walking || p.gallop !== undefined ? 0 : Math.sin((p.t ?? 0) * Math.PI * 2);
  const bob = walking ? (st % 2 ? -1 : 0) : p.gallop !== undefined ? (p.gallop ? -2 : 0) : Math.round(breathe * 0.5);
  const tilt = p.tilt ?? 0;
  const headA = p.headA ?? 0;
  const front = p.front ?? 'stand';
  // Body space to the frame: tilted about the hind hips, then bobbed.
  const pvx = cx - 12;
  const pvy = 38;
  const P = (x: number, y: number): [number, number] => {
    const [a, b] = turn(x, y, pvx, pvy, tilt);
    return [a, b + bob];
  };
  // The head's own space: turned about the neck first.
  const H = (x: number, y: number): [number, number] => {
    const [a, b] = turn(x, y, cx + 8, 26, headA);
    return P(a, b);
  };

  // Legs: pillars under a skirt of fur. Diagonal pairs swing together.
  const sw = walking ? [2.5, 0, -2.5, 0][st] : 0;
  const gal = p.gallop === undefined ? 0 : p.gallop ? -2 : 4;
  const pillar = (lx: number, ly: number, swing: number, up: number, m: Material, frontLeg: boolean) => {
    const [jx, jy] = P(lx, ly);
    let fx = jx + swing;
    let fy = foot - 1 - up;
    if (frontLeg && front === 'rear') {
      // Forelegs lifted and folded under the rearing chest.
      const [kx, ky] = P(lx + 3, ly + 6);
      c.part();
      c.capsule(jx, jy, kx, ky, 4.3, 3.9, m);
      fx = kx - 1;
      fy = ky + 5;
      c.capsule(kx, ky, fx, fy, 3.9, 3.6, m);
    } else {
      if (frontLeg && front === 'stomp') fx += 2;
      c.part();
      c.capsule(jx, jy, fx, fy - 1, 4.4, 4, m);
    }
    c.part();
    c.ellipse(fx, fy, 4.6, 1.8, m === SHAG ? SOLE : back(SOLE));
    c.part();
    for (const dx of [1, 3]) c.px(fx + dx, fy + 1, IVORY);
    c.px(fx + 4, fy, IVORY);
  };
  const lift = (pair: number) => (walking && ((st === 1 && pair === 0) || (st === 3 && pair === 1)) ? 1.5 : 0);
  const galUp = p.gallop === 1 ? 2 : 0;
  pillar(cx - 15, 36, -sw + (p.gallop !== undefined ? -gal : 0), lift(1) + galUp, back(SHAG), false);
  pillar(cx + 5, 35, sw + gal, lift(0) + galUp, back(SHAG), true);

  // A stub of a tail with a tuft.
  c.part();
  const [t0x, t0y] = P(cx - 22, 27);
  const [t1x, t1y] = P(cx - 25, 33);
  c.capsule(t0x, t0y, t1x, t1y, 1.5, 1, SHAG);
  fringe(c, Math.round(t1x) - 1, Math.round(t1x) + 1, () => Math.round(t1y), () => 3, SHAG, 3);

  // The body: haunch, the great hump of the shoulders, and the belly between.
  c.part();
  const [hx0, hy0] = P(cx - 11, 31);
  c.ellipse(hx0, hy0, 12, 11, SHAG);
  c.part();
  const [bx0, by0] = P(cx - 4, 34);
  c.ellipse(bx0, by0, 16, 7.5, SHAG);
  c.part();
  const [sx0, sy0] = P(cx + 2, 28 - breathe * 0.4);
  c.ellipse(sx0, sy0, 13, 13, SHAG);
  streaks(c, cx - 24, 14, cx + 16, 42, 60, 31);

  // Snow lying on its back, sparkling.
  for (const [x, y, rx, ry] of [[-11, 21, 6, 1.8], [-2, 16.5, 6.5, 2], [7, 17, 3.5, 1.5]] as const) {
    c.part();
    const [sx, sy] = P(cx + x, y);
    c.ellipse(sx, sy, rx, ry, SNOW, { flatten: 0.5 });
  }
  c.part();
  for (const [x, y] of [[-14, 21], [-5, 16], [1, 15], [-9, 20], [6, 16]]) {
    const [sx, sy] = P(cx + x, y);
    c.px(sx, sy - 1, RIME, UP);
  }

  // The near legs, in front of the body.
  pillar(cx - 9, 37, sw + (p.gallop !== undefined ? -gal : 0), lift(0) + galUp, SHAG, false);
  pillar(cx + 10, 36, -sw + gal, lift(1) + galUp, SHAG, true);

  // A long fringe of shag hanging from its flank, frozen at the tips.
  const lean = walking ? -sw * 0.3 : p.gallop !== undefined ? -1.2 : 0;
  c.part();
  fringe(
    c,
    cx - 21,
    cx + 13,
    (x) => {
      const [, y] = P(x, 38 + Math.abs(x - cx + 4) * -0.06);
      return Math.round(y) - 1;
    },
    (x) => (x > cx + 4 ? 7 : 8),
    SHAG,
    41,
    lean,
  );
  c.part();
  for (const x of [-13, 3]) {
    const [ix, iy] = P(cx + x, 46);
    c.px(ix, iy, ICE);
    c.spark(ix, iy, C_WHITE, 0.35);
  }

  // The far tusk, then the head.
  const tusk = (ox: number, oy: number, k: number, m: Material) => {
    const pts: [number, number][] = [
      [17, 31],
      [21, 37],
      [26, 39.5],
      [31, 38],
      [34, 33.5],
    ].map(([x, y]) => H(cx + ox + (x - 17) * k + 17, oy + (y - 31) * k + 31));
    c.part();
    chain(c, pts, [2.3, 2.2, 2, 1.5, 0.6], m);
    // Rime crusting the upper curve toward the point, a glint at its tip.
    c.part();
    for (let i = 2; i < 5; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      for (const u of [0.35, 0.7, 1]) c.px(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - (i === 4 ? 1 : 1.6), RIME, UP);
    }
    if (k > 0.95) c.spark(pts[4][0], pts[4][1] - 1, C_WHITE, 0.8);
    // An icicle under the curve.
    c.part();
    const [ux, uy] = pts[2];
    c.px(ux - 1, uy + 2, ICE);
    c.px(ux - 1, uy + 3, ICE);
  };
  tusk(-3, -1, 0.88, back(IVORY));

  // The ear, small and furred.
  c.part();
  const [ex, ey] = H(cx + 8, 25);
  c.ellipse(ex, ey, 3, 4.5, back(SHAG));
  // The dome of the head, with a crest of longer hair.
  c.part();
  const [dx, dy] = H(cx + 13, 22);
  c.ellipse(dx, dy, 8, 9, SHAG);
  c.part();
  const [fx, fy] = H(cx + 17, 27);
  c.ellipse(fx, fy, 4.5, 5, SHAG);
  streaks(c, dx - 7, dy - 7, dx + 6, dy + 8, 20, 51);
  c.part();
  for (const [x0, y0, x1, y1] of [[10, 14, 8, 10], [12, 13, 11, 10], [8, 16, 5, 13]] as const) {
    const [ax, ay] = H(cx + x0, y0);
    const [bx, by] = H(cx + x1, y1);
    c.capsule(ax, ay, bx, by, 1.2, 0.4, SHAG);
  }
  // The eye: small and dark, a cold glint in it (shut while dazed).
  c.part();
  const [yx, yy] = H(cx + 16, 22);
  if (p.daze) {
    c.px(yx - 1, yy, HOLLOW);
    c.px(yx, yy, HOLLOW);
  } else {
    c.px(yx, yy, HOLLOW);
    c.px(yx - 1, yy, HOLLOW);
    c.px(yx, yy - 1, GLOW_ICE, undefined, { glow: 0.7 });
  }
  if (p.mouth) {
    c.part();
    const [mx, my] = H(cx + 16, 31);
    c.ellipse(mx, my, 2, 1.5, HOLLOW);
  }

  // The trunk.
  const trunks: Record<NonNullable<MammothPose['trunk']>, { pts: [number, number][]; r: number[] }> = {
    hang: { pts: [[19, 27], [21, 35], [21, 42], [23, 46], [25, 45]], r: [3.3, 2.7, 2.1, 1.6, 1.3] },
    curl: { pts: [[19, 27], [21, 35], [23, 40], [26, 40], [26.5, 37]], r: [3.3, 2.7, 2.1, 1.6, 1.3] },
    up: { pts: [[19, 25], [23, 18], [24, 11], [22, 7], [20, 7]], r: [3.3, 2.7, 2.1, 1.7, 1.5] },
    swing: { pts: [[19, 27], [18, 35], [15, 41], [11, 43], [9, 41]], r: [3.3, 2.7, 2.1, 1.6, 1.3] },
  };
  const tr = trunks[p.trunk ?? 'hang'];
  const tp = tr.pts.map(([x, y]) => H(cx + x, y));
  c.part();
  chain(c, tp, tr.r, SHAG);
  // Ridges across it.
  for (let i = 0; i < tp.length - 1; i++) {
    const [ax, ay] = tp[i];
    const [bx, by] = tp[i + 1];
    c.shade((ax + bx) / 2, (ay + by) / 2, -1);
    c.shade((ax + bx) / 2 + 1, (ay + by) / 2, -1);
  }
  if (p.trunk === 'up') {
    // Trumpeting: breath steaming out of the raised trunk.
    const [qx, qy] = tp[tp.length - 1];
    for (const [ddx, ddy, a] of [[-1, -2, 0.7], [-3, -3, 0.5], [1, -4, 0.45], [-2, -5, 0.35]] as const) c.spark(qx + ddx, qy + ddy, C_WHITE, a);
  }
  // A beard of shag under the jaw.
  c.part();
  const [jx, jy] = H(cx + 13, 31);
  fringe(c, Math.round(jx) - 3, Math.round(jx) + 2, () => Math.round(jy), () => 6, SHAG, 61, lean);

  tusk(0, 0, 1, IVORY);

  if (p.daze) {
    const [qx, qy] = H(cx + 12, 10);
    for (const [ddx, ddy] of [[-4, 0], [0, -2], [4, 0]]) c.spark(qx + ddx, qy + ddy, C_ICE, 0.9);
  }
  return c;
}

export function buildTuskmawSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => mammoth({ t: i / 4, trunk: i === 2 ? 'curl' : 'hang' })));
  [0, 1, 2, 3].forEach((i) => (poses[`walk${i}`] = () => mammoth({ step: i, trunk: i % 2 ? 'curl' : 'hang' })));
  poses.rear0 = () => mammoth({ tilt: -0.18, front: 'rear', trunk: 'up', headA: -0.1 });
  poses.rear1 = () => mammoth({ tilt: -0.34, front: 'rear', trunk: 'up', headA: -0.15, mouth: true });
  poses.stomp = () => mammoth({ tilt: 0.04, front: 'stomp', trunk: 'hang', headA: 0.12 });
  poses.sweepA = () => mammoth({ headA: -0.32, trunk: 'curl', tilt: -0.04 });
  poses.sweepB = () => mammoth({ headA: 0.3, trunk: 'swing', tilt: 0.04 });
  poses.lower = () => mammoth({ headA: 0.22, tilt: 0.04, trunk: 'swing', t: 0.25 });
  poses.paw = () => mammoth({ headA: 0.22, tilt: 0.02, trunk: 'swing', step: 1 });
  poses.gallop0 = () => mammoth({ gallop: 0, headA: 0.24, tilt: 0.05, trunk: 'swing' });
  poses.gallop1 = () => mammoth({ gallop: 1, headA: 0.2, tilt: 0.02, trunk: 'swing' });
  poses.daze0 = () => mammoth({ headA: 0.16, daze: true, t: 0 });
  poses.daze1 = () => mammoth({ headA: 0.2, daze: true, t: 0.5, trunk: 'curl' });
  return sheet(MONSTER_FRAME.tuskmaw, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 3, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 5, loop: true },
    { name: 'rear', frames: ['rear0', 'rear1'], fps: 4, loop: false },
    { name: 'stomp', frames: ['stomp'], fps: 1, loop: false },
    { name: 'sweep', frames: ['sweepA', 'sweepB'], fps: 9, loop: false },
    { name: 'lower', frames: ['lower', 'paw'], fps: 4, loop: true },
    { name: 'charge', frames: ['gallop0', 'gallop1'], fps: 10, loop: true },
    { name: 'daze', frames: ['daze0', 'daze1'], fps: 2, loop: true },
  ]);
}

// ---------------------------------------------------------------- Frostdrake

interface DrakePose {
  /** Wingbeat: 0 up, 1 level, 2 down, 3 level rising. */
  flap: number;
  inhale?: boolean;
  /** Breathing frost, frame 0 or 1. */
  breath?: number;
  swoop?: boolean;
}

interface WingShape {
  elbow: [number, number];
  wrist: [number, number];
  tips: [number, number][];
}

const WINGS: WingShape[] = [
  { elbow: [-4, 16], wrist: [-1, 6], tips: [[-10, 2], [-18, 7], [-21, 15]] },
  { elbow: [-6, 21], wrist: [-8, 14], tips: [[-17, 9], [-23, 15], [-23, 22]] },
  { elbow: [-3, 31], wrist: [0, 37], tips: [[-7, 44], [-14, 43], [-18, 38]] },
  { elbow: [-6, 19], wrist: [-6, 11], tips: [[-14, 5], [-21, 11], [-22, 18]] },
];
const SWEPT: WingShape = { elbow: [-7, 22], wrist: [-12, 20], tips: [[-23, 21], [-26, 25], [-22, 28]] };

/** A wing from the shoulder (sx, sy): membrane between the fingers, the bones over it. */
function wing(c: PixelCanvas, sx: number, sy: number, s: WingShape, dx: number, dy: number, k: number, far: boolean): void {
  const at = ([x, y]: [number, number]): [number, number] => [sx + x * k + dx, sy + (y - 26) * k + dy];
  const E = at(s.elbow);
  const W = at(s.wrist);
  const T = s.tips.map(at);
  const root = at([-9, 29]);
  // Scalloped trailing edge: between tips the membrane sags toward the wrist.
  const sag = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2 + (W[0] - (a[0] + b[0]) / 2) * 0.28, (a[1] + b[1]) / 2 + (W[1] - (a[1] + b[1]) / 2) * 0.28];
  const pts: [number, number][] = [[sx + dx, sy + dy], E, W, T[0], sag(T[0], T[1]), T[1], sag(T[1], T[2]), T[2], sag(T[2], root), root];
  const down = s.wrist[1] > 26;
  c.part();
  poly(c, pts, far ? back(MEMBRANE) : MEMBRANE, (x, y) => {
    // Lit toward the leading edge, falling into shade toward the trailing one.
    const u = clamp01(Math.hypot(x - W[0], y - W[1]) / 16);
    return { x: -0.3 + u * 0.4, y: down ? -0.1 - u * 0.3 : 0.55 - u * 0.5, z: 0.78 };
  });
  // Frost along the trailing edge.
  c.part();
  for (const t of [T[0], T[1], T[2]]) c.spark(t[0], t[1], C_ICE, far ? 0.25 : 0.45);
  // Bones: the arm, then the fingers fanning from the wrist.
  c.part();
  const bone = far ? back(SCALE) : SCALE;
  c.capsule(sx + dx, sy + dy, E[0], E[1], 1.8, 1.4, bone);
  c.capsule(E[0], E[1], W[0], W[1], 1.4, 1.1, bone);
  for (const t of T) c.line(W[0], W[1], t[0], t[1], bone, () => UP);
  c.part();
  c.px(W[0] + 1, W[1] - 1, HORN);
}

function drake(p: DrakePose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.frostdrake;
  const c = new PixelCanvas(w, h);
  const cx = 29;
  const swoop = !!p.swoop;
  const breathing = p.breath !== undefined;
  // The body rides up on the downstroke and sinks on the up.
  const lift = swoop ? 2 : [1, 0, -1, 0][p.flap];
  const by = 30 + lift;
  const shape = swoop ? SWEPT : p.inhale ? WINGS[0] : breathing ? WINGS[1] : WINGS[p.flap];
  const sx = cx - 1;
  const sy = by - 4;

  // The far wing, behind everything, a little up and to the right.
  wing(c, sx + 2, sy - 1, shape, 3, -2, 0.85, true);

  // The tail, sweeping back with a crystal fin.
  const tail: [number, number][] = swoop
    ? [[cx - 9, by + 1], [cx - 16, by + 1], [cx - 22, by - 1], [cx - 27, by - 3]]
    : [[cx - 9, by + 1], [cx - 16, by + 4], [cx - 22, by + 3 - p.flap * 0.5], [cx - 26, by - 1 - (p.flap % 2)]];
  c.part();
  chain(c, tail, [3.6, 2.6, 1.6, 0.8], SCALE);
  c.part();
  const [ex, ey] = tail[3];
  crystal(c, ex + 1, ey, ex - 2, ey - 5, 1.5, ICE);
  c.part();
  crystal(c, ex, ey + 1, ex - 3, ey + 3, 1, ICE_DARK, null);
  // Spines down the tail.
  c.part();
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = tail[i];
    const [bx, bb] = tail[i + 1];
    c.px((ax + bx) / 2, (ay + bb) / 2 - 2.5 + i * 0.5, ICE, UP);
  }

  // The far leg, then the body.
  const legs = (ox: number, m: Material) => {
    c.part();
    if (swoop) {
      // Talons thrown forward to rake.
      c.capsule(cx - 2 + ox, by + 3, cx + 3 + ox, by + 7, 2.2, 1.6, m);
      c.capsule(cx + 3 + ox, by + 7, cx + 8 + ox, by + 8, 1.6, 1.1, m);
      c.part();
      for (const [dx, dy] of [[9, 7], [10, 9], [9, 10]]) c.px(cx + dx + ox, by + dy, HORN);
    } else {
      c.capsule(cx - 3 + ox, by + 3, cx - 2 + ox, by + 8, 2.2, 1.6, m);
      c.capsule(cx - 2 + ox, by + 8, cx + 1 + ox, by + 11, 1.6, 1.1, m);
      c.part();
      for (const [dx, dy] of [[2, 12], [1, 13], [3, 12]]) c.px(cx + dx + ox, by + dy, HORN);
    }
  };
  legs(-3, back(SCALE));

  c.part();
  c.ellipse(cx - 1, by, 9, 5.5, SCALE);
  c.part();
  c.ellipse(cx, by + 2.5, 7, 2.6, PLATE, { flatten: 0.7 });
  for (let x = -5; x <= 5; x += 2) c.shade(cx + x, by + 2, -1);
  // The neck, curving up to the head: drawn back in the inhale, thrust out in the breath.
  const neck: [number, number][] = p.inhale
    ? [[cx + 6, by - 2], [cx + 8, by - 7], [cx + 8, by - 11], [cx + 11, by - 14]]
    : breathing
      ? [[cx + 6, by - 2], [cx + 11, by - 3], [cx + 15, by - 4], [cx + 19, by - 4]]
      : swoop
        ? [[cx + 6, by - 1], [cx + 11, by - 1], [cx + 15, by], [cx + 18, by + 1]]
        : [[cx + 6, by - 2], [cx + 10, by - 5], [cx + 12, by - 9], [cx + 15, by - 11]];
  c.part();
  chain(c, neck, [3.6, 3, 2.6, 2.4], SCALE);
  c.part();
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = neck[i];
    const [bx, bb] = neck[i + 1];
    c.px((ax + bx) / 2 + 0.5, (ay + bb) / 2 + 2, PLATE);
  }
  if (p.inhale) {
    // Cold gathering in its chest and throat.
    c.part();
    c.ellipse(cx + 6, by - 1, 3, 2.6, ICE_GLOW);
    for (let i = 0; i < 3; i++) c.px(neck[i + 1][0] + 1, neck[i + 1][1] + 1, ICE_GLOW);
  }
  // A crest of ice along the neck and back.
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = i < 3 ? neck[3 - i] : [cx - 4, by - 5];
    c.part();
    crystal(c, ax - 0.5, ay - 1.5, ax - 2.5, ay - 4.5 - (i === 1 ? 1 : 0), 0.9, i % 2 ? ICE_DARK : ICE, null);
  }
  c.part();
  crystal(c, cx - 7, by - 4, cx - 10, by - 7, 0.9, ICE, null);

  // The head: a narrow skull, swept-back horns, a long snout.
  const [hx, hy] = neck[3];
  const open = breathing ? 2 : swoop ? 1 : 0;
  c.part();
  c.capsule(hx - 1, hy - 1, hx - 6, hy - 5, 1, 0.3, back(IVORY));
  c.part();
  c.ellipse(hx + 1, hy, 3.6, 2.8, SCALE);
  c.part();
  c.capsule(hx + 1, hy + 1 + open * 0.6, hx + 6, hy + 2 + open, 1.4, 0.9, back(SCALE));
  if (open) {
    c.part();
    c.capsule(hx + 2, hy + 1, hx + 5, hy + 1 + open * 0.6, 0.9, 0.6, breathing ? ICE_GLOW : HOLLOW);
  }
  c.part();
  c.capsule(hx + 1, hy, hx + 7, hy + 0.5, 2.1, 1.3, SCALE);
  c.part();
  c.capsule(hx - 1, hy - 2, hx - 5, hy - 5, 1.1, 0.35, IVORY);
  c.part();
  c.px(hx + 2, hy - 1, GLOW_ICE);
  c.px(hx + 6, hy - 1, SCALE);
  if (p.inhale) for (const [dx, dy, a] of [[8, 0, 0.7], [9, -2, 0.5], [10, 1, 0.4]] as const) c.spark(hx + dx, hy + dy, C_ICE, a);
  if (breathing) {
    const f = p.breath ?? 0;
    for (let k = 0; k < 6; k++) c.spark(hx + 8 + k, hy + 2 + ((k + f) % 3) - 1, k < 2 ? C_WHITE : C_ICE, 0.9 - k * 0.12);
  }

  legs(0, SCALE);
  // The near wing, over the body.
  wing(c, sx, sy, shape, 0, 0, 1, false);
  return c;
}

export function buildFrostdrakeSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3].forEach((i) => (poses[`fly${i}`] = () => drake({ flap: i })));
  poses.inhale = () => drake({ flap: 0, inhale: true });
  poses.breath0 = () => drake({ flap: 1, breath: 0 });
  poses.breath1 = () => drake({ flap: 1, breath: 1 });
  poses.swoop = () => drake({ flap: 1, swoop: true });
  return sheet(MONSTER_FRAME.frostdrake, poses, [
    { name: 'idle', frames: ['fly0', 'fly1', 'fly2', 'fly3'], fps: 7, loop: true },
    { name: 'walk', frames: ['fly0', 'fly1', 'fly2', 'fly3'], fps: 10, loop: true },
    { name: 'inhale', frames: ['inhale'], fps: 1, loop: false },
    { name: 'breath', frames: ['breath0', 'breath1'], fps: 10, loop: true },
    { name: 'swoop', frames: ['swoop'], fps: 1, loop: false },
  ]);
}

// ---------------------------------------------------------------- Yeti

type YetiArms = 'down' | 'dig' | 'heave' | 'hold' | 'throw' | 'crouch' | 'leap' | 'slam';

interface YetiPose {
  t?: number;
  step?: number;
  arms?: YetiArms;
  /** Dig frame, 0 or 1. */
  dig?: number;
  roar?: boolean;
}

/** A boulder of packed snow with chunks of ice in it, centred at (x, y). */
function boulder(c: PixelCanvas, x: number, y: number, r: number, seed: number): void {
  const R = rng(seed);
  c.part();
  c.ellipse(x, y, r, r * 0.92, SNOW);
  for (let k = 0; k < 5; k++) {
    const a = R() * Math.PI * 2;
    c.part();
    c.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.5, r * 0.45, r * 0.4, SNOW);
  }
  for (let k = 0; k < 3; k++) {
    const a = -2.4 + k * 1.3 + R() * 0.4;
    c.part();
    crystal(c, x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, x + Math.cos(a) * (r + 2.5), y + Math.sin(a) * (r + 2.5), 1.4 + R() * 0.5, k === 1 ? ICE : ICE_DARK, k === 1 ? C_WHITE : null);
  }
  // Cracks in the packing.
  for (let k = 0; k < 6; k++) c.shade(x - r * 0.4 + R() * r * 0.9, y + R() * r * 0.6, -1);
}

function yeti(p: YetiPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.yeti;
  const c = new PixelCanvas(w, h);
  const cx = 23;
  const foot = 51;
  const arms = p.arms ?? 'down';
  const walking = p.step !== undefined;
  const st = p.step ?? 0;
  const breathe = walking ? 0 : Math.sin((p.t ?? 0) * Math.PI * 2);
  const bob = walking ? (st % 2 ? -1 : 0) : Math.round(breathe * 0.5);
  const crouch = { down: 0, dig: 5, heave: 2, hold: 0, throw: 2, crouch: 5, leap: -2, slam: 6 }[arms];
  const lean = { down: 0, dig: 3, heave: 0, hold: -2, throw: 3, crouch: 1, leap: 0, slam: 3 }[arms];
  const by = bob + crouch;
  const bx = lean;
  const hipY = 40 + by;

  // Legs: short and furred, big blue soles. Tucked up when it leaps.
  const stride = walking ? [2.5, 0, -2.5, 0][st] : arms === 'slam' || arms === 'crouch' || arms === 'dig' ? 3 : 0;
  const leg = (hx: number, sw: number, near: boolean) => {
    const up = walking && ((st === 1 && !near) || (st === 3 && near)) ? 2 : 0;
    const m = near ? FUR_WHITE : back(FUR_WHITE);
    let fx = hx + sw;
    let fy = foot - 2 - up;
    if (arms === 'leap') {
      fx = hx + (near ? 3 : -2);
      fy = hipY + 7;
    }
    c.part();
    c.capsule(hx, hipY, fx, fy, 4.6, 3.8, m);
    c.part();
    c.ellipse(fx + 1.5, fy + 1, 4.4, 2, near ? YETI_SKIN : back(YETI_SKIN));
    c.part();
    for (const dx of [4, 5]) c.px(fx + dx, fy + 1 + (dx - 4), HORN);
    // Fur spilling over the ankle.
    fringe(c, Math.round(fx) - 3, Math.round(fx) + 3, () => Math.round(fy) - 3, () => 2.5, m, near ? 5 : 6);
  };

  // Arms, by pose: shoulder, elbow, hand.
  const fsh: [number, number] = [cx - 7 + bx, 25 + by];
  const nsh: [number, number] = [cx + 7 + bx, 25 + by];
  const swing = walking ? stride * 0.8 : Math.round(breathe * 0.5);
  let fe: [number, number];
  let fh: [number, number];
  let ne: [number, number];
  let nh: [number, number];
  switch (arms) {
    case 'dig':
      fe = [cx + 2 + bx, 35 + by];
      fh = [cx + 9 + bx, 46 - (p.dig ?? 0) * 2];
      ne = [cx + 12 + bx, 33 + by];
      nh = [cx + 14 + bx, 47 - (p.dig ?? 0) * 3];
      break;
    case 'heave':
      fe = [cx + 2 + bx, 33 + by];
      fh = [cx + 8 + bx, 31 + by];
      ne = [cx + 13 + bx, 32 + by];
      nh = [cx + 16 + bx, 29 + by];
      break;
    case 'hold':
      fe = [cx - 12 + bx, 17 + by];
      fh = [cx - 10 + bx, 9 + by];
      ne = [cx + 6 + bx, 15 + by];
      nh = [cx - 1 + bx, 8 + by];
      break;
    case 'throw':
      fe = [cx + 3 + bx, 23 + by];
      fh = [cx + 11 + bx, 25 + by];
      ne = [cx + 14 + bx, 22 + by];
      nh = [cx + 20 + bx, 24 + by];
      break;
    case 'crouch':
      fe = [cx - 12 + bx, 32 + by];
      fh = [cx - 15 + bx, 38 + by];
      ne = [cx + 2 + bx, 33 + by];
      nh = [cx - 4 + bx, 39 + by];
      break;
    case 'leap':
      fe = [cx - 6 + bx, 15 + by];
      fh = [cx + 2 + bx, 7 + by];
      ne = [cx + 10 + bx, 15 + by];
      nh = [cx + 5 + bx, 6 + by];
      break;
    case 'slam':
      fe = [cx + 4 + bx, 36 + by];
      fh = [cx + 10 + bx, 47];
      ne = [cx + 13 + bx, 35 + by];
      nh = [cx + 17 + bx, 47];
      break;
    default:
      fe = [cx - 11 + bx - swing * 0.5, 33 + by];
      fh = [cx - 11 + bx - swing, 41 + by];
      ne = [cx + 11 + bx + swing * 0.5, 33 + by];
      nh = [cx + 12 + bx + swing, 41 + by];
  }
  const arm = (s: [number, number], e: [number, number], hnd: [number, number], near: boolean) => {
    const m = near ? FUR_WHITE : back(FUR_WHITE);
    c.part();
    c.capsule(s[0], s[1], e[0], e[1], 4.4, 3.8, m);
    c.part();
    c.capsule(e[0], e[1], hnd[0], hnd[1], 3.8, 3.2, m);
    // A shag of fur hanging off the forearm.
    c.part();
    const lo = Math.round(Math.min(e[0], hnd[0]));
    const hi = Math.round(Math.max(e[0], hnd[0]));
    fringe(c, lo - 1, hi + 1, (x) => Math.round(e[1] + (hnd[1] - e[1]) * clamp01((x - e[0]) / (hnd[0] - e[0] || 1))) + 2, () => 2.5, m, near ? 71 : 72);
    // The hand: blue skin, black claws.
    c.part();
    c.ellipse(hnd[0], hnd[1], 3, 2.8, near ? YETI_SKIN : back(YETI_SKIN));
    c.part();
    const up = arms === 'hold' || arms === 'leap';
    for (const [dx, dy] of up ? [[-1, -3], [1, -3], [2, -2]] : [[2, 2], [3, 1], [0, 3]]) c.px(hnd[0] + dx, hnd[1] + dy, HORN);
  };

  arm(fsh, fe, fh, false);
  leg(cx - 4 + bx * 0.4, -stride, false);
  leg(cx + 4 + bx * 0.4, stride, true);

  // The body: a great round heap of fur.
  c.part();
  shag(c, cx + bx, 31 + by, 11.5, 11 + breathe * 0.3, FUR_WHITE, 81, 26, -0.15);
  c.part();
  shag(c, cx + bx - 1, 22 + by - breathe * 0.4, 10, 6.5, FUR_WHITE, 82, 10, 0.05);
  streaks(c, cx - 10 + bx, 16 + by, cx + 11 + bx, 41 + by, 34, 83);
  // The boulder held high behind its head, the near arm up behind it too.
  if (arms === 'hold') {
    boulder(c, cx - 3 + bx, 6, 6.8, 9);
    arm(nsh, ne, nh, true);
  }

  // The head: sunk into the shoulders, fur all round a blue face.
  const hx = cx + 4 + bx + (arms === 'throw' ? 2 : 0);
  const hy = 17 + by + (arms === 'hold' ? -1 : 0);
  c.part();
  shag(c, hx, hy, 7.5, 7, FUR_WHITE, 91, 12, -0.1);
  // A crest of fur swept back off its crown.
  c.part();
  for (const [x0, y0, x1, y1] of [[-1, -6, -5, -10], [-3, -5, -8, -8], [1, -6, -2, -11]] as const) c.capsule(hx + x0, hy + y0, hx + x1, hy + y1, 1.3, 0.4, FUR_WHITE);
  // The face, a broad blue mask.
  c.part();
  c.ellipse(hx + 3.5, hy + 1.5, 5, 4.6, YETI_SKIN);
  // The brow, a ledge of fur.
  c.part();
  c.ellipse(hx + 3, hy - 2, 5.6, 1.7, FUR_WHITE);
  c.part();
  c.px(hx + 2, hy, GLOW_ICE);
  c.px(hx + 6, hy, GLOW_ICE);
  c.px(hx + 4, hy + 2, back(YETI_SKIN));
  c.px(hx + 5, hy + 2, back(YETI_SKIN));
  // The mouth: a grim line with fangs, or wide open in a roar.
  c.part();
  if (p.roar || arms === 'throw' || arms === 'slam' || arms === 'leap') {
    c.ellipse(hx + 4, hy + 4, 3, 1.9, HOLLOW);
    c.px(hx + 2, hy + 3, IVORY);
    c.px(hx + 6, hy + 3, IVORY);
    c.px(hx + 3, hy + 5, IVORY);
  } else {
    for (let x = hx + 1; x <= hx + 7; x++) c.px(x, hy + 4, HOLLOW);
    c.px(hx + 2, hy + 3, IVORY);
    c.px(hx + 6, hy + 3, IVORY);
  }
  // Cheek fur framing the face.
  c.part();
  fringe(c, hx - 3, hx + 8, (x) => hy + 6 + (x > hx + 5 ? -1 : 0), () => 3, FUR_WHITE, 93);

  if (arms !== 'hold') arm(nsh, ne, nh, true);

  if (arms === 'heave') boulder(c, (nh[0] + fh[0]) / 2, (nh[1] + fh[1]) / 2 - 4, 7, 9);
  if (arms === 'dig') {
    // Clawing the snow loose: a chunk rises between its hands.
    const d = p.dig ?? 0;
    if (d) boulder(c, cx + 12 + bx, 46, 5.5, 9);
    for (const [dx, dy, a] of [[-6, -6, 0.7], [-3, -9, 0.6], [4, -8, 0.5], [7, -4, 0.6], [0, -11, 0.4]] as const) c.spark(cx + 12 + bx + dx, 48 + dy - d * 2, C_WHITE, a);
  }
  if (arms === 'slam') {
    for (const [dx, dy, a] of [[-8, 0, 0.8], [8, -1, 0.8], [-4, -4, 0.6], [5, -5, 0.6], [0, -7, 0.5], [12, -3, 0.5], [-11, -2, 0.5]] as const) c.spark(cx + 13 + bx + dx, 49 + dy, C_ICE, a);
  }
  return c;
}

export function buildYetiSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => yeti({ t: i / 4 })));
  [0, 1, 2, 3].forEach((i) => (poses[`walk${i}`] = () => yeti({ step: i })));
  poses.dig0 = () => yeti({ arms: 'dig', dig: 0 });
  poses.dig1 = () => yeti({ arms: 'dig', dig: 1 });
  poses.heave = () => yeti({ arms: 'heave' });
  poses.hold = () => yeti({ arms: 'hold', roar: true });
  poses.throw = () => yeti({ arms: 'throw' });
  poses.crouch = () => yeti({ arms: 'crouch', roar: true });
  poses.leap = () => yeti({ arms: 'leap' });
  poses.slam = () => yeti({ arms: 'slam' });
  poses.roar = () => yeti({ t: 0.25, roar: true });
  return sheet(MONSTER_FRAME.yeti, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 4, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 7, loop: true },
    { name: 'dig', frames: ['dig0', 'dig1'], fps: 7, loop: true },
    { name: 'lift', frames: ['heave', 'hold'], fps: 6, loop: false },
    { name: 'throw', frames: ['throw'], fps: 1, loop: false },
    { name: 'crouch', frames: ['crouch'], fps: 1, loop: false },
    { name: 'leap', frames: ['leap'], fps: 1, loop: false },
    { name: 'slam', frames: ['slam'], fps: 1, loop: false },
    { name: 'roar', frames: ['roar'], fps: 1, loop: false },
  ]);
}

// ---------------------------------------------------------------- Rimeknight

type KnightStance = 'guard' | 'draw' | 'cut' | 'follow' | 'raise' | 'plunge';

interface KnightPose {
  t?: number;
  step?: number;
  stance?: KnightStance;
}

/** The greatsword, its grip at (gx, gy), pointing along `ang`: a blade of ice with a light at its heart. */
function greatsword(c: PixelCanvas, gx: number, gy: number, ang: number, len: number, glow: number): void {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const nx = -uy;
  const ny = ux;
  c.part();
  c.capsule(gx - ux * 4, gy - uy * 4, gx + ux * 1.5, gy + uy * 1.5, 0.9, 0.9, LEATHER);
  c.part();
  c.ellipse(gx - ux * 4.8, gy - uy * 4.8, 1.3, 1.3, ICE_GLOW);
  const qx = gx + ux * 2.6;
  const qy = gy + uy * 2.6;
  c.part();
  const b0x = qx + ux;
  const b0y = qy + uy;
  crystal(c, b0x, b0y, b0x + ux * len, b0y + uy * len, 2.2, BLADE, C_WHITE);
  // The light running up its heart.
  c.part();
  c.line(b0x + ux, b0y + uy, b0x + ux * len * 0.78, b0y + uy * len * 0.78, ICE_GLOW, () => UP, { glow });
  for (let k = 0.2; k < 0.9; k += 0.22) c.spark(b0x + ux * len * k + nx * 1.2, b0y + uy * len * k + ny * 1.2, C_ICE, 0.35 * glow);
  // The crossguard: silver, its ends curling into points of ice.
  c.part();
  c.capsule(qx - nx * 4, qy - ny * 4, qx + nx * 4, qy + ny * 4, 1.1, 1.1, SILVER);
  c.part();
  c.px(qx - nx * 5 + ux, qy - ny * 5 + uy, ICE);
  c.px(qx + nx * 5 + ux, qy + ny * 5 + uy, ICE);
}

function knight(p: KnightPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.rimeknight;
  const c = new PixelCanvas(w, h);
  const cx = 28;
  const foot = 46;
  const stance = p.stance ?? 'guard';
  const walking = p.step !== undefined;
  const st = p.step ?? 0;
  const breathe = walking ? 0 : Math.sin((p.t ?? 0) * Math.PI * 2);
  const bob = walking ? (st % 2 ? -1 : 0) : 0;
  const lean = { guard: 0, draw: 1, cut: 3, follow: 3, raise: -1, plunge: 2 }[stance];
  const drop = { guard: 0, draw: 2, cut: 2, follow: 3, raise: 0, plunge: 3 }[stance];
  const bx = lean;
  const by = bob + drop;
  const hipY = 33 + by;
  const glow = stance === 'raise' ? 1 : stance === 'plunge' ? 0.9 : 0.6 + breathe * 0.15;

  // The cape: behind everything, tattered, streaming back when it lunges.
  const flow = stance === 'cut' || stance === 'follow' ? 1 : stance === 'draw' || stance === 'plunge' ? 0.5 : walking ? 0.25 + (st % 2) * 0.1 : 0.05 * (breathe + 1);
  const capeTop = 18 + by;
  const hemY = (x: number) => foot - 3 - flow * 9 + (x % 3 === 0 ? 1 : 0) + (x % 5 === 0 ? -2 : 0);
  const capeL = cx - 7 + bx - flow * 11;
  c.part();
  poly(
    c,
    [
      [cx - 2 + bx, capeTop],
      [cx + 2 + bx, capeTop + 1],
      [cx + 1 + bx - flow * 3, foot - 6 - flow * 7],
      [cx - 2 + bx - flow * 6, hemY(1) + 1],
      [cx - 4 + bx - flow * 8, hemY(2) - 2],
      [capeL + 2, hemY(3) + 1],
      [capeL, hemY(4) - 3],
      [cx - 6 + bx - flow * 4, capeTop + 4],
    ],
    CLOTH,
    (x) => ({ x: -0.3, y: 0.35 - (x - capeL) * 0.01, z: 0.85 }),
  );
  // Holes torn in it, and its lining showing at the edge.
  for (const [dx, dy] of [[-4, 30], [-2, 36], [-6, 38]]) {
    c.erase(cx + dx + bx - flow * 6, dy + by - flow * 5);
  }
  c.part();
  c.line(cx + 1 + bx, capeTop + 2, cx + 1 + bx - flow * 3, foot - 7 - flow * 7, VELVET, () => UP);
  for (let k = 0; k < 4; k++) c.px(capeL + 1 + k * 2, hemY(k) - 2 + (k % 2), RIME, UP);

  // Legs: slender greaves; a lunge throws the near one forward.
  const stride = walking ? [2, 0, -2, 0][st] : stance === 'cut' || stance === 'follow' || stance === 'plunge' ? 4 : stance === 'draw' ? 3 : 0;
  const leg = (hx: number, sw: number, near: boolean) => {
    const up = walking && ((st === 1 && !near) || (st === 3 && near)) ? 1.5 : 0;
    const m = near ? IRON : back(IRON);
    const fx = hx + sw;
    const fy = foot - 1.5 - up;
    const kx = hx + sw * 0.6 + 0.8;
    const ky = hipY + 6 - up;
    c.part();
    c.capsule(hx, hipY, kx, ky, 2.3, 2, m);
    c.capsule(kx, ky, fx, fy, 2, 1.7, m);
    c.part();
    c.px(kx + 1, ky, near ? SILVER : back(SILVER));
    c.part();
    c.capsule(fx - 1, fy, fx + 2.5, fy + 0.5, 1.4, 0.8, m);
  };
  leg(cx - 2 + bx * 0.5, -stride, false);

  // The far arm and the sword, which it grips in both hands.
  let grip: [number, number];
  let ang: number;
  let len = 21;
  switch (stance) {
    case 'draw':
      grip = [cx + 1 + bx, 22 + by];
      ang = -2.62;
      break;
    case 'cut':
      grip = [cx + 8 + bx, 26 + by];
      ang = 0.08;
      break;
    case 'follow':
      grip = [cx + 8 + bx, 29 + by];
      ang = 0.62;
      break;
    case 'raise':
      grip = [cx + 1 + bx, 13 + by];
      ang = -2.8;
      len = 22;
      break;
    case 'plunge':
      grip = [cx + 8 + bx, 31 + by];
      ang = 1.4;
      len = 15;
      break;
    default:
      grip = [cx + 5 + bx, 28 + by - Math.round(breathe * 0.4)];
      ang = -1.2 + (walking ? (st % 2) * 0.06 : 0);
  }
  const fsh: [number, number] = [cx - 3 + bx, 20 + by];
  c.part();
  const fel: [number, number] = [(fsh[0] + grip[0]) / 2 - 1, (fsh[1] + grip[1]) / 2 + 2];
  c.capsule(fsh[0], fsh[1], fel[0], fel[1], 1.9, 1.6, back(IRON));
  c.capsule(fel[0], fel[1], grip[0] - 1, grip[1], 1.6, 1.4, back(IRON));
  // Swung behind it, the sword is drawn before the body.
  const behind = stance === 'draw' || stance === 'raise';
  if (behind) greatsword(c, grip[0], grip[1], ang, len, glow);

  leg(cx + 3 + bx * 0.5, stride, true);

  // An armoured skirt over the hips, a tabard down the front.
  c.part();
  c.shape(hipY - 2, hipY + 4, (y) => {
    const u = (y - hipY + 2) / 6;
    return [cx - 5 + bx - u * 1.5, cx + 5 + bx + u * 1.5];
  }, IRON);
  for (let x = -5; x <= 5; x += 3) c.shade(cx + x + bx, hipY + 2, -1);
  c.part();
  poly(c, [[cx + 0.5 + bx, hipY - 3], [cx + 4.5 + bx, hipY - 3], [cx + 4 + bx, hipY + 7], [cx + 2.5 + bx, hipY + 6], [cx + 1 + bx, hipY + 7]], CLOTH, () => UP);
  c.part();
  c.line(cx + 0.5 + bx, hipY + 7, cx + 4 + bx, hipY + 7, SILVER);

  // The breastplate: narrow-waisted, a frost rune on it.
  c.part();
  c.shape(17 + by, hipY - 1, (y) => {
    const u = (y - 17 - by) / (hipY - 18 - by);
    const hw = 6 - u * 2 + Math.sin(u * Math.PI) * 0.6 + breathe * 0.2;
    return [cx + bx - hw + 0.5, cx + bx + hw + 0.5];
  }, IRON, (_x, _y, t, u) => sphere(t * 0.85, 0.5 - u * 0.9));
  c.part();
  c.line(cx - 3 + bx, hipY - 2, cx + 4 + bx, hipY - 2, SILVER);
  c.part();
  const rx = cx + 2 + bx;
  const ry = 24 + by;
  c.px(rx, ry, GLOW_ICE);
  for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0]]) c.px(rx + dx, ry + dy, GLOW_ICE, undefined, { glow: 0.6 });
  for (const [dx, dy] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) c.px(rx + dx, ry + dy, GLOW_ICE, undefined, { glow: 0.35 });

  // Pauldrons, frosted.
  c.part();
  c.ellipse(cx - 4 + bx, 19 + by, 3.6, 3, back(IRON));
  c.part();
  c.ellipse(cx + 4 + bx, 19.5 + by, 4.2, 3.4, IRON);
  c.part();
  c.line(cx + 1 + bx, 22 + by, cx + 7 + bx, 22 + by, SILVER);
  c.part();
  crystal(c, cx + 3 + bx, 17 + by, cx + 4 + bx, 13 + by, 1, ICE, C_ICE);
  crystal(c, cx + 6 + bx, 17.5 + by, cx + 8 + bx, 14.5 + by, 0.8, ICE, null);
  c.px(cx + 2 + bx, 16 + by, RIME, UP);

  // The helm: a tall great-helm, a slit of light, a crown of ice.
  const hx = cx + 1 + bx + (stance === 'cut' || stance === 'follow' ? 1 : 0);
  const hy = 12 + by;
  c.part();
  c.shape(hy - 5, hy + 4, (y) => {
    const u = (y - hy + 5) / 9;
    const hw = 3.2 + Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) * 0.9;
    return [hx - hw + 0.5, hx + hw + 0.5 + (u > 0.5 ? 0.6 : 0)];
  }, IRON, (_x, _y, t, u) => sphere(t * 0.85, 0.6 - u));
  c.part();
  for (let x = hx; x <= hx + 4; x++) c.px(x, hy, GLOW_ICE, undefined, { glow: x === hx ? 0.5 : 1 });
  c.part();
  c.line(hx + 2, hy + 1, hx + 2, hy + 3, back(IRON));
  c.part();
  c.line(hx - 3, hy - 3, hx + 4, hy - 3, SILVER, () => UP);
  for (const [x0, x1, y1, r, m] of [[-2, -5, -12, 1.1, ICE_DARK], [0, 0, -14, 1.3, ICE], [2, 4, -11, 1, ICE]] as const) {
    c.part();
    crystal(c, hx + x0, hy - 4, hx + x1, hy + y1, r, m, m === ICE ? C_WHITE : null);
  }

  // The near arm, over the body to the grip.
  const nsh: [number, number] = [cx + 4 + bx, 21 + by];
  const nel: [number, number] = [(nsh[0] + grip[0]) / 2 + 1, (nsh[1] + grip[1]) / 2 + 2];
  c.part();
  c.capsule(nsh[0], nsh[1], nel[0], nel[1], 2, 1.7, IRON);
  c.capsule(nel[0], nel[1], grip[0], grip[1], 1.7, 1.5, IRON);
  c.part();
  c.px(nel[0], nel[1] - 1, SILVER);
  if (!behind) greatsword(c, grip[0], grip[1], ang, len, glow);
  c.part();
  c.ellipse(grip[0], grip[1], 1.7, 1.6, IRON);

  if (stance === 'raise') for (const [dx, dy] of [[-12, -6], [-6, -9], [-16, -2], [-3, -4]]) c.spark(grip[0] + dx, grip[1] + dy, C_WHITE, 0.6);
  if (stance === 'plunge') {
    for (const [dx, dy, a] of [[-4, 0, 0.8], [4, 0, 0.8], [-7, -2, 0.5], [7, -2, 0.5], [0, -3, 0.6]] as const) c.spark(cx + 11 + bx + dx, foot - 1 + dy, C_ICE, a);
  }
  return c;
}

export function buildRimeknightSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => knight({ t: i / 4 })));
  [0, 1, 2, 3].forEach((i) => (poses[`walk${i}`] = () => knight({ step: i })));
  poses.draw = () => knight({ stance: 'draw' });
  poses.cut = () => knight({ stance: 'cut' });
  poses.follow = () => knight({ stance: 'follow' });
  poses.raise = () => knight({ stance: 'raise' });
  poses.plunge = () => knight({ stance: 'plunge' });
  return sheet(MONSTER_FRAME.rimeknight, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 4, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 7, loop: true },
    { name: 'draw', frames: ['draw'], fps: 1, loop: false },
    { name: 'cut', frames: ['cut', 'follow'], fps: 12, loop: false },
    { name: 'raise', frames: ['raise'], fps: 1, loop: false },
    { name: 'plunge', frames: ['plunge'], fps: 1, loop: false },
  ]);
}

// ---------------------------------------------------------------- Spells (pure light unless lit)

type Px = Uint8ClampedArray;

const put = (px: Px, w: number, x: number, y: number, c: RGB, a = 255) => {
  if (x < 0 || y < 0 || x >= w || (y * w + x) * 4 >= px.length) return;
  const i = (y * w + x) * 4;
  if (px[i + 3] && px[i] + px[i + 1] + px[i + 2] > c[0] + c[1] + c[2]) return;
  px.set([c[0], c[1], c[2], a], i);
};
const WHITE = hex('#ffffff');
const PALE_ICE = hex('#c8f4ff');
const MID_ICE = hex('#7ad4ff');
const DEEP_ICE = hex('#2a7ad0');

export const FS_SLASH_W = 40;
export const FS_SLASH_H = 32;

/** A crescent of a sword's or a claw's sweep, opening to the right; frame `f` 0..2 fades and thins. */
export function fsSlash(f: number): Px {
  const w = FS_SLASH_W;
  const h = FS_SLASH_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const cx = 8;
  const cy = h / 2;
  const R = 26;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) * 1.15;
      const a = Math.atan2(dy, dx);
      if (Math.abs(a) > 1.2) continue;
      // Thick at the middle of the sweep, a hair at its ends.
      const along = 1 - Math.abs(a) / 1.2;
      const th = (1.2 + along * 6) * (1 - f * 0.3);
      const d = R - Math.hypot(dx, dy);
      if (d < 0 || d > th) continue;
      const k = d / th;
      if (f === 2 && bayer(x, y) > along) continue;
      put(px, w, x, y, k < 0.25 ? WHITE : k < 0.55 ? PALE_ICE : k < 0.8 ? MID_ICE : DEEP_ICE, 255);
    }
  }
  return px;
}

export const FS_WAVE_W = 22;
export const FS_WAVE_H = 34;

/** The knight's blade wave: an upright crescent of ice light rushing right, a broken trail behind it. */
export function fsWave(f: number): Px {
  const w = FS_WAVE_W;
  const h = FS_WAVE_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const cx = 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5 - cy) / (h / 2);
    for (let x = 0; x < w; x++) {
      // A bow: its front edge bulges to the right at the middle.
      const front = cx + 15 * Math.sqrt(Math.max(0, 1 - v * v));
      const d = front - (x + 0.5);
      const th = 1.5 + (1 - Math.abs(v)) * 5.5;
      if (d < 0) continue;
      if (d < th) {
        const k = d / th;
        put(px, w, x, y, k < 0.3 ? WHITE : k < 0.65 ? PALE_ICE : MID_ICE);
      } else if (d < th + 7 && bayer(x + f * 2, y + f) < 0.45 - (d - th) / 16) put(px, w, x, y, DEEP_ICE, 200);
    }
  }
  // Glints off its crest.
  for (const [x, y] of f ? [[14, 9], [16, 20], [12, 26]] : [[15, 12], [13, 6], [15, 24]]) put(px, w, x, y, WHITE);
  return px;
}

export const FS_CONE_W = 64;
export const FS_CONE_H = 64;

/** A wedge on the floor opening to the right (half-height = x / 2): where breath will pour. White, tinted at runtime. */
export function fsCone(): Px {
  const w = FS_CONE_W;
  const h = FS_CONE_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const half = (x + 0.5) / 2;
      const d = Math.abs(y + 0.5 - cy);
      if (d > half) continue;
      const edge = half - d < 1.2 || x > w - 3;
      const fill = 0.16 + (x / w) * 0.14 + (bayer(x, y) > 0.82 ? 0.12 : 0);
      const c = Math.round(255 * (edge ? 0.85 : fill));
      px.set([c, c, c, 255], (y * w + x) * 4);
    }
  }
  return px;
}

export const FS_PUFF = 18;

/** A billow of freezing breath, frame `f` 0..3 swelling and thinning, with flecks of ice in it. */
export function fsPuff(f: number): Px {
  const s = FS_PUFF;
  const px = new Uint8ClampedArray(s * s * 4);
  const r = 4 + f * 1.4;
  const c0 = s / 2;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x + 0.5 - c0, (y + 0.5 - c0) * 1.1) / r;
      const lump = Math.sin(Math.atan2(y - c0, x - c0) * 5 + f) * 0.12;
      const k = clamp01(1 - d + lump) * (1 - f * 0.18);
      if (k <= 0 || bayer(x + f, y) > k * 1.8) continue;
      const v = Math.round(120 + k * 135);
      put(px, s, x, y, [Math.round(v * 0.8), Math.round(v * 0.95), v]);
    }
  }
  for (const [x, y] of [[c0 - 2 + f, c0 - 3], [c0 + 3, c0 + 1 - f], [c0 - 4, c0 + 3]]) put(px, s, Math.round(x), Math.round(y), WHITE);
  return px;
}

export const FS_BOULDER = 26;

/** The yeti's boulder, a lit picture for its flight. */
export function fsBoulder(): PixelCanvas {
  const c = new PixelCanvas(FS_BOULDER, FS_BOULDER);
  boulder(c, 13, 13.5, 9, 9);
  return c;
}

export function frostStrongFx(r: FxRegistrar): void {
  r.strip('fs_slash', FS_SLASH_W, FS_SLASH_H, [0, 1, 2].map(fsSlash), 's');
  r.anim('fs_slash_fade', 'fs_slash', ['s0', 's1', 's2'], 18, false);
  r.strip('fs_wave', FS_WAVE_W, FS_WAVE_H, [0, 1].map(fsWave), 'w');
  r.anim('fs_wave_run', 'fs_wave', ['w0', 'w1'], 14, true);
  r.image('fs_cone', FS_CONE_W, FS_CONE_H, fsCone());
  r.strip('fs_puff', FS_PUFF, FS_PUFF, [0, 1, 2, 3].map(fsPuff), 'p');
  r.anim('fs_puff_roll', 'fs_puff', ['p0', 'p1', 'p2', 'p3'], 8, false);
  r.frames('fs_boulder', [{ name: 'b', canvas: fsBoulder() }], FS_BOULDER, FS_BOULDER);
}
