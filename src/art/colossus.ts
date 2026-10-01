// Ymir, the Glacier Colossus: the Aurora Colosseum's first Myth, four heroes
// tall. A mountain that learned to walk: a hunched mass of blue-grey stone
// sheathed in shards of old glacier ice, a ridge of great crystal peaks
// growing up its back like a range seen from far off, snow lying on its
// shoulders and its brow. Its arms hang to the floor, forearms cased in ice
// gauntlets carved with runes that burn cold blue; its head sits low and
// forward between the shoulders, two pale eyes under a brow of ice and a
// beard of icicles. In its chest, between two plates of ice, a blue core
// beats, and cracks of light run out from it through the stone.
// Poses: breathing, a heavy walk, raising both fists and slamming them down,
// drawing a fist back and driving it into the floor, roaring with its arms
// thrown wide, lifting a foot and stomping, and kneeling spent with its
// chest plates parted on the blazing core (the moment to strike).

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, hex, sphere, type Material, type Vec3 } from './pixel';
import { hash2, rng } from './env';
import { C_ICE, C_ICE_DEEP, C_WHITE, GLOW_ICE, HOLLOW, ICE, ICE_DARK, ICE_GLOW, INK, RIME, SNOW, STONE, crystal, icicles, poly, ramp, type FxRegistrar } from './frostKit';

/** Thick glacier ice: more opaque and turquoise than clear ice, with a cold sheen. */
const GLACIER: Material = { ramp: ramp('#07172a', '#0c2842', '#123e60', '#1a587e', '#26749c', '#3e92ba', '#70bad8'), outline: INK, outlineLit: hex('#123656'), emissive: 0.08, shine: true };
/** Its stone: the colosseum's, a shade warmer in the light so ice and rock part clearly. */
const ROCK: Material = { ...STONE, ramp: ramp('#0d111a', '#171d29', '#232a39', '#323b4d', '#444f63', '#5c677c', '#7d879b') };

/** Particle tints for Ymir's bursts: ice, white, deep blue and snow. */
export const COLOSSUS_TINTS = [0x9ae8ff, 0xffffff, 0x3ab0ff, 0xdce8ff];

/** Its core's height above its feet (standing), and ahead of them (facing right), for the game's glow and light. */
export const CO_CORE_Y = 67;
export const CO_CORE_X = 3;
/** The core's height while it kneels spent. */
export const CO_CORE_KNEEL_Y = 54;
/** Where its fists strike in the slam and the punch, ahead of its feet. */
export const CO_SLAM_X = 40;
export const CO_PUNCH_X = 54;

const CX = 64;
const GROUND = 138;
const TOP = 40;

type P = [number, number];

interface Arm {
  /** Elbow and fist, in frame px. */
  e: P;
  f: P;
}

interface Leg {
  /** Hip, knee and foot (the sole's middle). */
  h: P;
  k: P;
  f: P;
}

interface Pose {
  /** 0..1 phase: breath, glints, the frost on its breath. */
  t: number;
  /** Body lowered (+) or raised (-), and leaned forward (+). */
  bob: number;
  lean: number;
  /** Head nudged from its seat, and looking up 0..1 (roaring, mouth open). */
  hx: number;
  hy: number;
  roar: number;
  back: Arm;
  front: Arm;
  legB: Leg;
  legF: Leg;
  /** 0..1 how hard the core burns, and how far the chest plates have parted. */
  core: number;
  open: number;
  /** Ice thrown up round its fists (or its foot) where they struck. */
  impact?: number;
}

// ---------------------------------------------------------------- Drawing helpers

/** A limb segment, round in section. */
function limb(c: PixelCanvas, a: P, b: P, r0: number, r1: number, m: Material, bias = 0): void {
  c.capsule(a[0], a[1], b[0], b[1], r0, r1, m, { bias });
}

/** A jagged crack across stone: a walk of darkened pixels (only where something is drawn). */
function crack(c: PixelCanvas, x: number, y: number, len: number, dir: number, seed: number): void {
  const R = rng(seed);
  let px = x;
  let py = y;
  let a = dir;
  for (let i = 0; i < len; i++) {
    if (c.filled(Math.floor(px), Math.floor(py))) c.shade(px, py, -1);
    a += (R() - 0.5) * 0.9;
    px += Math.cos(a);
    py += Math.sin(a);
  }
}

/** Flecks and pits over stone drawn so far within a box: lighter grains and darker pocks. */
function grain(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, seed: number): void {
  for (let y = Math.floor(y0); y < y1; y++) {
    for (let x = Math.floor(x0); x < x1; x++) {
      if (c.materialAt(x, y) !== ROCK) continue;
      const n = hash2(x, y, seed);
      if (n > 0.955) c.shade(x, y, 1);
      else if (n < 0.04) c.shade(x, y, -1);
    }
  }
}

/** Runes of the north, 3x5: strokes and crossings rather than letters. */
const GLYPHS = [
  [0b101, 0b101, 0b010, 0b101, 0b101],
  [0b010, 0b111, 0b010, 0b010, 0b010],
  [0b010, 0b101, 0b010, 0b101, 0b101],
  [0b101, 0b010, 0b010, 0b010, 0b010],
  [0b111, 0b101, 0b010, 0b101, 0b111],
  [0b100, 0b110, 0b101, 0b110, 0b100],
];

function rune(c: PixelCanvas, x: number, y: number, g: number, bright: number): void {
  const rows = GLYPHS[g % GLYPHS.length];
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < 3; i++) {
      if (!(rows[j] & (4 >> i))) continue;
      const px = Math.round(x) + i - 1;
      const py = Math.round(y) + j - 2;
      if (!c.filled(px, py)) continue;
      c.px(px, py, GLOW_ICE, { x: 0, y: 0, z: 1 }, { glow: 0.45 + bright * 0.55 });
    }
  }
  c.spark(x, y, C_ICE_DEEP, 0.2 + bright * 0.35);
}

/** A slab of glacier ice: a polygon with a bevelled rim, its face looking out along `tilt`. */
function slab(c: PixelCanvas, pts: P[], m: Material, tilt: Vec3, bias = 0): void {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
  }
  const cx = sx / pts.length;
  const cy = sy / pts.length;
  poly(c, pts, m, (x, y) => {
    let edge = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [x0, y0] = pts[j];
      const [x1, y1] = pts[i];
      const vx = x1 - x0;
      const vy = y1 - y0;
      const l = Math.hypot(vx, vy) || 1;
      edge = Math.min(edge, Math.abs(((x + 0.5 - x0) * vy - (y + 0.5 - y0) * vx) / l));
    }
    if (edge < 1.5) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const l = Math.hypot(dx, dy) || 1;
      return { x: (dx / l) * 0.7, y: (-dy / l) * 0.7, z: 0.55 };
    }
    return tilt;
  });
  if (bias) for (let y = Math.floor(cy - 20); y < cy + 20; y++) for (let x = Math.floor(cx - 30); x < cx + 30; x++) if (c.materialAt(x, y) === m) c.shade(x, y, 0);
}

/** Streaks of white deep inside glacier ice: old fractures catching the light. */
function fractures(c: PixelCanvas, x: number, y: number, len: number, a: number, seed: number): void {
  const R = rng(seed);
  for (let i = 0; i < len; i++) {
    const px = x + Math.cos(a) * i;
    const py = y + Math.sin(a) * i;
    if (c.materialAt(px, py) === GLACIER && R() > 0.25) c.shade(px, py, 1);
  }
}

// ---------------------------------------------------------------- The colossus

function colossus(p: Pose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.colossus;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const bob = p.bob;
  const lean = p.lean;
  const top = TOP + bob;
  // The body leans: the shoulders further forward than the hips.
  const bx = CX - 2 + lean;
  const hipX = CX - 1 + lean * 0.35;
  const shB: P = [bx - 29, top + 9];
  const shF: P = [bx + 25, top + 13];
  const head: P = [bx + 7 + p.hx, top + 2 + p.hy];
  const core: P = [bx + 5, top + 31];

  // ---- The range of crystal peaks on its back, leaning back as if into a wind.
  const peaks: [number, number, number, number, number, typeof ICE][] = [
    [-14, 6, -26, -40, 8, ICE],
    [-30, 10, -50, -22, 6, ICE_DARK],
    [0, 6, -4, -30, 6, ICE_DARK],
    [-42, 16, -60, 0, 4.5, ICE],
    [12, 10, 20, -14, 4, ICE],
  ];
  peaks.forEach(([ox, oy, tx, ty, r, m], k) => {
    c.part();
    const x0 = bx + ox;
    const y0 = top + oy;
    crystal(c, x0, y0, bx + tx + Math.sin(tau + k) * 0.4, top + ty, r, m, k < 3 ? C_WHITE : C_ICE);
    // A seam of light up the great ones.
    if (r >= 6) {
      for (let s = 0.12; s < 0.75; s += 0.04) {
        const sx = x0 + (bx + tx - x0) * s;
        const sy = y0 + (top + ty - y0) * s;
        if ((Math.round(sy) + k) % 4 !== 0) c.px(sx - 0.5, sy, ICE_GLOW, { x: 0, y: 0, z: 1 }, { glow: 0.3 + p.core * 0.3 });
      }
    }
  });
  // Snow drifted in the saddle between the peaks.
  c.part();
  c.ellipse(bx - 12, top + 6, 17, 5, SNOW, { flatten: 0.5 });

  // ---- The far arm and leg, behind the body.
  drawArm(c, shB, p.back, -1, p, 2);
  drawLeg(c, p.legB, -1);

  // ---- The body: boulders heaped into a hunched back, a great chest, a belly and hips.
  c.part();
  c.ellipse(bx - 12, top + 16, 25, 19, ROCK, { bias: -1 });
  c.part();
  c.ellipse(hipX, 96 + bob * 0.6, 19, 10, ROCK);
  c.part();
  c.ellipse(bx - 1, top + 46, 23, 17, ROCK);
  c.part();
  c.ellipse(bx + 2, top + 26, 30, 22, ROCK, { normal: (_x, _y, dx, dy) => sphere(dx, dy + 0.15, 0.85) });
  grain(c, bx - 40, top - 4, bx + 34, 108, 7);
  crack(c, bx - 22, top + 12, 14, 1.1, 41);
  crack(c, bx - 14, top + 50, 12, 0.2, 43);
  crack(c, bx + 18, top + 44, 10, 2.4, 47);
  // A belt of rime round its hips, hung with icicles.
  c.part();
  const by = 88 + bob * 0.6;
  for (let x = Math.floor(hipX - 18); x < hipX + 18; x++) {
    const u = (x + 0.5 - hipX) / 18;
    const y = Math.round(by + u * u * 3 + Math.sin(x * 0.9) * 0.5);
    c.px(x, y, RIME, sphere(u * 0.8, 0.5));
    c.px(x, y + 1, RIME, sphere(u * 0.8, -0.2));
  }
  c.part();
  icicles(c, Math.floor(hipX - 15), Math.ceil(hipX + 15), Math.round(by + 3), 5, 23);

  // ---- The near leg.
  drawLeg(c, p.legF, 1);

  // ---- Its chest: two shards of glacier ice over the core, each cut in two facets.
  const gap = 2 + p.open * 5;
  const plate = (side: number, seed: number) => {
    const s = side;
    const o = p.open * 2.5 * s;
    const pts: P[] = [
      [core[0] + s * gap, core[1] - 15],
      [core[0] + s * 13 + o, core[1] - 19],
      [core[0] + s * 24 + o, core[1] - 12],
      [core[0] + s * 25 + o, core[1] - 1],
      [core[0] + s * 17 + o, core[1] + 11],
      [core[0] + s * (gap + 1), core[1] + 8],
    ];
    c.part();
    slab(c, pts, GLACIER, s < 0 ? { x: -0.35, y: 0.25, z: 0.88 } : { x: 0.3, y: 0.15, z: 0.92 });
    // The lower facet turns down and away from the light.
    for (let y = Math.floor(core[1] + 1); y < core[1] + 12; y++) {
      for (let x = Math.floor(core[0] - 30); x < core[0] + 30; x++) {
        if (c.materialAt(x, y) === GLACIER && y > core[1] + 1 + (x - core[0]) * 0.15 * s) c.shade(x, y, -1);
      }
    }
    fractures(c, core[0] + s * 8, core[1] - 12, 12, s < 0 ? 2.1 : 1.0, seed);
    fractures(c, core[0] + s * 18, core[1] - 8, 7, s < 0 ? 1.8 : 1.3, seed + 1);
    // Rime along its top edge.
    for (let k = 0; k <= 12; k++) {
      const x = core[0] + s * (gap + 1 + k);
      const y = core[1] - 15 - (k / 12) * 4 - (k > 6 ? -(k - 6) * 0.4 : 0);
      if (c.materialAt(x, y + 1) === GLACIER) c.px(x, y + 1, RIME, sphere(0, 0.6));
    }
    c.part();
    icicles(c, Math.floor(core[0] + Math.min(s * (gap + 2), s * 15)), Math.floor(core[0] + Math.max(s * (gap + 2), s * 15)), Math.round(core[1] + 10), 4, seed + 5);
  };
  plate(-1, 31);
  plate(1, 37);

  // ---- The core: a hollow in the stone and the cold fire in it.
  c.part();
  c.ellipse(core[0], core[1] - 2, 5 + p.open * 3, 9 + p.open * 1.5, HOLLOW);
  c.part();
  const cr = 3.4 + p.open * 2.4 + p.core * 0.6;
  c.ellipse(core[0], core[1] - 2, cr * 0.8, cr * 1.25, ICE_GLOW, { glow: 0.7 + p.core * 0.3, normal: (_x, _y, dx, dy) => sphere(dx, dy, 0.6) });
  c.spark(core[0] - 1, core[1] - 4, C_WHITE, 1);
  c.spark(core[0], core[1] - 3, C_WHITE, 0.8);
  c.spark(core[0] - 1, core[1] - 2, C_WHITE, 0.5);
  // Veins of light running out through the stone from it.
  for (let v = 0; v < 7; v++) {
    const R = rng(90 + v);
    let a = (v / 7) * Math.PI * 2 + 0.4;
    let x = core[0] + Math.cos(a) * (cr + 4);
    let y = core[1] - 2 + Math.sin(a) * (cr + 6);
    const len = 8 + R() * 8 + p.core * 5;
    for (let i = 0; i < len; i++) {
      const fade = 1 - i / len;
      if (c.materialAt(x, y) === ROCK) c.spark(x, y, i < 4 ? C_ICE : C_ICE_DEEP, (0.35 + p.core * 0.5) * fade);
      a += (R() - 0.5) * 0.8;
      x += Math.cos(a);
      y += Math.sin(a) * 0.9;
    }
  }
  // Rays when it burns hot.
  if (p.core > 0.5) {
    const ray = 4 + p.core * 8;
    for (let i = 1; i <= ray; i++) {
      const a = (1 - i / (ray + 1)) * (p.core - 0.3);
      c.spark(core[0] + cr + i, core[1] - 2, C_ICE, a);
      c.spark(core[0] - cr - i, core[1] - 2, C_ICE, a);
      c.spark(core[0], core[1] - 2 - cr * 1.3 - i, C_ICE, a);
      c.spark(core[0], core[1] - 2 + cr * 1.3 + i, C_ICE, a * 0.6);
    }
  }

  // ---- The shoulders: boulders capped in glacier ice and snow, and the head sunk low between them.
  drawShoulder(c, shB, -1, p, 61);
  drawShoulder(c, shF, 1, p, 67);
  drawHead(c, head, p);

  // ---- The near arm, over everything.
  drawArm(c, shF, p.front, 1, p, 3);

  // ---- Frost: the breath off its mouth, and motes of snow drifting round it.
  const R = rng(Math.round(p.t * 100) + 5);
  for (let k = 0; k < 8; k++) {
    const s = R();
    c.spark(head[0] + 11 + s * 11, head[1] + 8 - s * 7 + Math.sin(tau + k) * 1.5, C_WHITE, (1 - s) * (0.25 + p.roar * 0.5));
  }
  for (let k = 0; k < 7; k++) {
    const x = 10 + hash2(k, 3, 11) * 110;
    const y = 8 + ((hash2(k, 5, 13) * 120 + p.t * 30) % 120);
    if (!c.filled(Math.floor(x), Math.floor(y))) c.spark(x, y, C_ICE, 0.3);
  }
  // Ice flying up where it struck.
  if (p.impact) {
    const I = rng(77);
    for (let k = 0; k < 22; k++) {
      const base = k % 2 ? p.front.f : p.back.f;
      const a = -Math.PI * (0.08 + I() * 0.84);
      const d = 5 + I() * 16 * p.impact;
      c.spark(base[0] + Math.cos(a) * d * 1.3, base[1] + 7 + Math.sin(a) * d * 0.8, k % 3 ? C_ICE : C_WHITE, 0.5 + I() * 0.5);
    }
  }
  return c;
}

/** A shoulder: a boulder, a pauldron of glacier ice, a drift of snow and two crystals breaking out of it. */
function drawShoulder(c: PixelCanvas, s: P, side: number, p: Pose, seed: number): void {
  const bias = side < 0 ? -1 : 0;
  c.part();
  c.ellipse(s[0], s[1], 17, 14, ROCK, { bias });
  grain(c, s[0] - 17, s[1] - 14, s[0] + 17, s[1] + 14, seed);
  crack(c, s[0] - 9, s[1] + 4, 11, 0.3, seed);
  c.part();
  // The pauldron: a shell of ice over the upper half, its lower edge a jagged break.
  for (let y = Math.floor(s[1] - 15); y <= s[1] + 2; y++) {
    for (let x = Math.floor(s[0] - 17); x <= s[0] + 17; x++) {
      const dx = (x + 0.5 - s[0]) / 16;
      const dy = (y + 0.5 - (s[1] - 2)) / 12.5;
      if (dx * dx + dy * dy > 1) continue;
      if (y > s[1] - 3 + Math.round(hash2(x, 1, seed) * 4) - Math.abs(dx) * 4) continue;
      c.px(x, y, GLACIER, sphere(dx, dy, 0.9), { bias });
    }
  }
  fractures(c, s[0] - 10, s[1] - 9, 14, 0.25, seed + 3);
  rune(c, s[0] + side * 3, s[1] - 5, seed, p.core);
  // Snow drifted on top.
  c.part();
  c.ellipse(s[0] - side * 1, s[1] - 12, 13, 4.5, SNOW, { flatten: 0.6, bias });
  c.ellipse(s[0] - side * 7, s[1] - 10, 6, 3, SNOW, { flatten: 0.6, bias });
  // Two crystals breaking out of the ice, leaning back.
  c.part();
  crystal(c, s[0] + side * 4 - 2, s[1] - 9, s[0] + side * 6 - 12, s[1] - 28, 3.4, ICE, C_WHITE);
  c.part();
  crystal(c, s[0] + side * 11, s[1] - 6, s[0] + side * 19 - 4, s[1] - 16, 2.2, ICE_DARK, C_ICE);
}

/** The head: a block of stone sunk forward between the shoulders, a brow of ice, two cold eyes and a beard of icicles. */
function drawHead(c: PixelCanvas, hd: P, p: Pose): void {
  const [hx, hy] = hd;
  const up = p.roar;
  // The jaw, dropped when it roars.
  c.part();
  c.ellipse(hx + 2, hy + 8 + up * 3, 9.5, 5.5, ROCK, { bias: -1 });
  if (up > 0.3) {
    c.part();
    c.ellipse(hx + 5, hy + 6 + up * 1.5, 5.5, 1.5 + up * 2, HOLLOW);
    for (let x = hx + 1; x <= hx + 9; x++) c.spark(x, hy + 6 + up * 1.5, C_ICE, 0.6);
    c.spark(hx + 5, hy + 6, C_WHITE, 0.9);
  }
  // The skull: craggy, flat-topped.
  c.part();
  c.ellipse(hx, hy, 11, 9.5, ROCK, { normal: (_x, _y, dx, dy) => sphere(dx, dy - up * 0.2, 0.85) });
  c.part();
  c.ellipse(hx + 7, hy + 3, 5, 4.5, ROCK);
  grain(c, hx - 11, hy - 10, hx + 13, hy + 14, 83);
  crack(c, hx - 8, hy - 2, 8, 1.4, 81);
  // The brow: a heavy ridge of ice jutting over the eyes.
  c.part();
  c.capsule(hx - 8, hy - 3 - up, hx + 10, hy - 1 - up, 3.4, 2.8, GLACIER);
  fractures(c, hx - 6, hy - 5 - up, 12, 0.1, 87);
  // The eyes, deep under the brow, turned to the right.
  c.part();
  const ey = Math.round(hy + 2 - up * 1.5);
  for (const ex of [hx + 1, hx + 8]) {
    c.ellipse(ex + 0.5, ey, 2.6, 1.6, HOLLOW);
    c.px(ex - 1, ey, GLOW_ICE);
    c.px(ex, ey, GLOW_ICE);
    c.px(ex + 1, ey, GLOW_ICE);
    c.px(ex, ey - 1, GLOW_ICE);
    c.spark(ex, ey, C_WHITE, 1);
    c.spark(ex + 2, ey, C_ICE, 0.45 + p.core * 0.3);
    c.spark(ex - 1, ey, C_ICE, 0.25);
  }
  // Snow on the crown of its head, and a beard of icicles.
  c.part();
  c.ellipse(hx - 1, hy - 8, 9.5, 3.5, SNOW, { flatten: 0.6 });
  c.part();
  icicles(c, Math.floor(hx - 4), Math.ceil(hx + 9), Math.round(hy + 12 + up * 3), 6, 91);
}

/** An arm from the shoulder: stone above the elbow, a gauntlet of runed glacier ice below, a fist like a boulder. */
function drawArm(c: PixelCanvas, sh: P, a: Arm, side: number, p: Pose, seed: number): void {
  const bias = side < 0 ? -1 : 0;
  c.part();
  const root: P = [sh[0] + side * 5, sh[1] + 5];
  limb(c, root, a.e, 10, 9, ROCK, bias);
  grain(c, Math.min(root[0], a.e[0]) - 11, Math.min(root[1], a.e[1]) - 11, Math.max(root[0], a.e[0]) + 11, Math.max(root[1], a.e[1]) + 11, seed + 20);
  crack(c, (root[0] + a.e[0]) / 2 - 4, (root[1] + a.e[1]) / 2, 8, 1.5, seed + 21);
  // The elbow: a knot of stone.
  c.part();
  c.ellipse(a.e[0], a.e[1], 8, 7.5, ROCK, { bias });
  // The forearm cased in ice, thickening toward the fist.
  const dx = a.f[0] - a.e[0];
  const dy = a.f[1] - a.e[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const wrist: P = [a.f[0] - ux * 7, a.f[1] - uy * 7];
  c.part();
  limb(c, [a.e[0] + ux * 3, a.e[1] + uy * 3], wrist, 8.5, 11, GLACIER, bias);
  fractures(c, a.e[0] + ux * 4 - 4, a.e[1] + uy * 4, Math.max(6, l - 10), Math.atan2(uy, ux) + 0.1, seed + 30);
  // Crystals jutting out of the gauntlet, on its outer side, raked back toward the elbow.
  let nx = -uy;
  let ny = ux;
  if (nx * side < 0) {
    nx = -nx;
    ny = -ny;
  }
  for (let k = 0; k < 3; k++) {
    const m = 0.25 + k * 0.28;
    const px = a.e[0] + (wrist[0] - a.e[0]) * m;
    const py = a.e[1] + (wrist[1] - a.e[1]) * m;
    const len = 6 + (k === 1 ? 5 : 0);
    c.part();
    crystal(c, px + nx * 7, py + ny * 7, px + nx * (8 + len) - ux * 5, py + ny * (8 + len) - uy * 5 - 2, 2.3, k === 1 ? ICE : ICE_DARK, k === 1 ? C_WHITE : null);
  }
  // A rune burning in the gauntlet.
  rune(c, a.e[0] + (wrist[0] - a.e[0]) * 0.55, a.e[1] + (wrist[1] - a.e[1]) * 0.55, seed, p.core);
  // Icicles off its underside, where it lies across enough.
  if (Math.abs(ux) > 0.35) {
    c.part();
    const lo = Math.max(a.e[1], wrist[1]);
    icicles(c, Math.floor(Math.min(a.e[0], wrist[0]) + 2), Math.ceil(Math.max(a.e[0], wrist[0]) - 2), Math.round(lo + 9), 4, seed * 7);
  }
  // The fist: a boulder, its knuckles a ridge of ice.
  c.part();
  c.ellipse(a.f[0], a.f[1], 11.5, 10.5, ROCK, { bias });
  grain(c, a.f[0] - 12, a.f[1] - 11, a.f[0] + 12, a.f[1] + 11, seed + 40);
  crack(c, a.f[0] - 7, a.f[1] + 3, 9, 0.2, seed * 11);
  c.part();
  const kx = a.f[0] + ux * 6.5;
  const ky = a.f[1] + uy * 6.5;
  c.capsule(kx + uy * 6, ky - ux * 6, kx - uy * 6, ky + ux * 6, 3.6, 3.6, GLACIER, { bias });
  for (let k = -1; k <= 1; k++) c.shade(kx - uy * k * 3.5 + ux * 2, ky + ux * k * 3.5 + uy * 2, -1);
  c.spark(kx - 2, ky - 3, C_WHITE, 0.45);
  // Snow on the back of the hand.
  c.part();
  c.ellipse(a.f[0] - 2, a.f[1] - 8, 5.5, 2, SNOW, { flatten: 0.6, bias });
}

/** A leg like a pillar: stone thigh, a greave of glacier ice, a broad stone foot crusted with snow. */
function drawLeg(c: PixelCanvas, g: Leg, side: number): void {
  const bias = side < 0 ? -1 : 0;
  c.part();
  limb(c, g.h, g.k, 11.5, 9.5, ROCK, bias);
  grain(c, Math.min(g.h[0], g.k[0]) - 12, g.h[1] - 12, Math.max(g.h[0], g.k[0]) + 12, g.k[1] + 10, 120 + side);
  c.part();
  limb(c, g.k, [g.f[0], g.f[1] - 5], 9.5, 8.5, GLACIER, bias);
  fractures(c, g.k[0] - 3, g.k[1] + 2, 12, 1.4, 130 + side);
  c.part();
  c.ellipse(g.f[0] + 3, g.f[1] - 2.5, 12.5, 5, ROCK, { bias, flatten: 0.7 });
  c.part();
  c.ellipse(g.f[0], g.f[1] - 6, 8.5, 2.5, SNOW, { bias, flatten: 0.5 });
  // Toes of ice.
  for (let k = 0; k < 3; k++) {
    c.part();
    c.ellipse(g.f[0] + 10 + k * 0.5, g.f[1] - 4 + k * 1.5, 3, 2, GLACIER, { bias });
  }
}

// ---------------------------------------------------------------- Poses

const stand = (bob: number): { legB: Leg; legF: Leg } => ({
  legB: { h: [CX - 12, 96 + bob * 0.6], k: [CX - 14, 117 + bob * 0.3], f: [CX - 18, GROUND] },
  legF: { h: [CX + 11, 96 + bob * 0.6], k: [CX + 15, 117 + bob * 0.3], f: [CX + 14, GROUND] },
});

function idle(t: number): Pose {
  const b = Math.sin(t * Math.PI * 2);
  const bob = -b * 1.2;
  return {
    t,
    bob,
    lean: 2,
    hx: 0,
    hy: b * 0.4,
    roar: 0,
    back: { e: [CX - 40, 84 + bob * 0.5], f: [CX - 40, 118] },
    front: { e: [CX + 38, 88 + bob * 0.5], f: [CX + 42, 121] },
    ...stand(bob),
    core: 0.35 + Math.max(0, b) * 0.25,
    open: 0,
  };
}

function walk(i: number, n: number): Pose {
  const a = (i / n) * Math.PI * 2;
  const s = Math.sin(a);
  const co = Math.cos(a);
  // Lowest as the feet spread, highest as they pass; it rolls with each step.
  const bob = 2 * Math.abs(s);
  const liftF = Math.max(0, co) * 7;
  const liftB = Math.max(0, -co) * 7;
  const fF: P = [CX + 14 + s * 13, GROUND - liftF];
  const fB: P = [CX - 18 - s * 13, GROUND - liftB];
  const hF: P = [CX + 13, 96 + bob * 0.6];
  const hB: P = [CX - 10, 96 + bob * 0.6];
  const knee = (hp: P, fp: P, lift: number): P => [(hp[0] + fp[0]) / 2 + 3 + lift * 0.6, (hp[1] + fp[1]) / 2 - 1 - lift * 0.5];
  return {
    t: i / n,
    bob,
    lean: 4,
    hx: s,
    hy: Math.abs(s) * 0.5,
    roar: 0,
    // The arms swing against the legs, heavy and late.
    back: { e: [CX - 38 + s * 4, 84 + bob * 0.5], f: [CX - 38 + s * 12, 117 - Math.abs(s) * 3] },
    front: { e: [CX + 38 - s * 4, 88 + bob * 0.5], f: [CX + 42 - s * 12, 120 - Math.abs(s) * 3] },
    legB: { h: hB, k: knee(hB, fB, liftB), f: fB },
    legF: { h: hF, k: knee(hF, fF, liftF), f: fF },
    core: 0.4,
    open: 0,
  };
}

const POSES: Record<string, () => Pose> = {
  // Both fists rising, then high overhead, leaning back.
  raise0: () => ({ t: 0.1, bob: 3, lean: 0, hx: 0, hy: 0, roar: 0.2, back: { e: [CX - 46, 70], f: [CX - 40, 52] }, front: { e: [CX + 44, 72], f: [CX + 42, 52] }, ...stand(3), core: 0.6, open: 0 }),
  raise1: () => ({ t: 0.3, bob: -3, lean: -4, hx: -1, hy: -1, roar: 0.4, back: { e: [CX - 34, 32], f: [CX - 10, 14] }, front: { e: [CX + 34, 30], f: [CX + 12, 12] }, ...stand(-3), core: 0.8, open: 0 }),
  // The fists driven into the floor ahead, then sunk in, settling.
  slam0: () => ({ t: 0.5, bob: 9, lean: 12, hx: 4, hy: 3, roar: 0.6, back: { e: [CX + 4, 96], f: [CX + 28, 126] }, front: { e: [CX + 50, 96], f: [CX + 50, 126] }, ...stand(9), core: 1, open: 0, impact: 1 }),
  slam1: () => ({ t: 0.7, bob: 7, lean: 10, hx: 3, hy: 2, roar: 0.2, back: { e: [CX + 2, 96], f: [CX + 28, 127] }, front: { e: [CX + 48, 96], f: [CX + 50, 127] }, ...stand(7), core: 0.8, open: 0, impact: 0.4 }),
  // A fist drawn back high, then driven down into the floor far ahead.
  draw0: () => ({ t: 0.2, bob: 2, lean: -5, hx: -1, hy: 0, roar: 0.3, back: { e: [CX - 30, 90], f: [CX - 14, 112] }, front: { e: [CX + 42, 38], f: [CX + 20, 18] }, ...stand(2), core: 0.7, open: 0 }),
  punch0: () => ({ t: 0.6, bob: 9, lean: 12, hx: 5, hy: 3, roar: 0.5, back: { e: [CX - 46, 82], f: [CX - 56, 100] }, front: { e: [CX + 56, 96], f: [CX + 56, 127] }, ...stand(9), core: 0.9, open: 0, impact: 0.8 }),
  // The roar: arms thrown wide, head back, the core blazing.
  roar0: () => ({ t: 0.4, bob: -2, lean: -3, hx: -2, hy: -3, roar: 1, back: { e: [CX - 52, 48], f: [CX - 52, 22] }, front: { e: [CX + 50, 50], f: [CX + 54, 22] }, ...stand(-2), core: 1, open: 0.3 }),
  roar1: () => ({ t: 0.9, bob: -3, lean: -4, hx: -2, hy: -4, roar: 1, back: { e: [CX - 53, 46], f: [CX - 54, 20] }, front: { e: [CX + 51, 48], f: [CX + 56, 20] }, ...stand(-3), core: 1, open: 0.35 }),
  // A foot lifted high, arms out for balance; then brought down.
  lift: () => ({
    t: 0.2,
    bob: -2,
    lean: -3,
    hx: -1,
    hy: -1,
    roar: 0.3,
    back: { e: [CX - 48, 70], f: [CX - 58, 88] },
    front: { e: [CX + 46, 70], f: [CX + 56, 84] },
    legB: { h: [CX - 12, 95], k: [CX - 15, 117], f: [CX - 18, GROUND] },
    legF: { h: [CX + 11, 94], k: [CX + 28, 92], f: [CX + 30, 112] },
    core: 0.8,
    open: 0,
  }),
  stomp: () => ({
    t: 0.6,
    bob: 7,
    lean: 4,
    hx: 2,
    hy: 2,
    roar: 0.6,
    back: { e: [CX - 42, 94], f: [CX - 36, 122] },
    front: { e: [CX + 46, 96], f: [CX + 54, 122] },
    legB: { h: [CX - 12, 101], k: [CX - 20, 120], f: [CX - 26, GROUND] },
    legF: { h: [CX + 11, 101], k: [CX + 26, 116], f: [CX + 30, GROUND] },
    core: 1,
    open: 0,
    impact: 0.6,
  }),
};

/** Kneeling spent, its chest plates parted on the core: phase `t` heaves its breath. */
function kneel(t: number): Pose {
  const b = Math.sin(t * Math.PI * 2);
  const bob = 13 + b;
  return {
    t,
    bob,
    lean: 5,
    hx: 2,
    hy: 4,
    roar: 0,
    back: { e: [CX - 40, 100 + b], f: [CX - 36, 127] },
    front: { e: [CX + 46, 102], f: [CX + 46, 128] },
    legB: { h: [CX - 12, 106], k: [CX - 22, 130], f: [CX - 40, GROUND] },
    legF: { h: [CX + 11, 106], k: [CX + 28, 104], f: [CX + 30, GROUND] },
    core: 1,
    open: 1,
  };
}

export function buildColossusSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  for (let i = 0; i < 4; i++) poses[`idle${i}`] = () => colossus(idle(i / 4));
  for (let i = 0; i < 6; i++) poses[`walk${i}`] = () => colossus(walk(i, 6));
  for (const [name, pose] of Object.entries(POSES)) poses[name] = () => colossus(pose());
  poses.kneel0 = () => colossus(kneel(0.25));
  poses.kneel1 = () => colossus(kneel(0.75));
  return sheet(MONSTER_FRAME.colossus, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 3, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5'], fps: 5, loop: true },
    { name: 'raise', frames: ['raise0', 'raise1'], fps: 4, loop: false },
    { name: 'slam', frames: ['slam0', 'slam1'], fps: 6, loop: false },
    { name: 'punch', frames: ['punch0', 'slam1'], fps: 6, loop: false },
    { name: 'roar', frames: ['roar0', 'roar1'], fps: 5, loop: true },
    { name: 'stomp', frames: ['stomp', 'slam1'], fps: 5, loop: false },
    { name: 'kneel', frames: ['kneel0', 'kneel1'], fps: 2, loop: true },
  ]);
}

// ---------------------------------------------------------------- Spells

/** A chunk of its glacier, broken off and held circling by the core (its second phase). */
export const CO_CHUNK = 16;

function chunk(v: number): PixelCanvas {
  const c = new PixelCanvas(CO_CHUNK, CO_CHUNK);
  const R = rng(300 + v);
  const pts: P[] = [];
  const n = 6;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + R() * 0.5;
    const r = 4.5 + R() * 2.5;
    pts.push([8 + Math.cos(a) * r, 8 + Math.sin(a) * r * 0.9]);
  }
  c.part();
  slab(c, pts, v === 1 ? ROCK : GLACIER, { x: -0.4, y: 0.4, z: 0.8 });
  c.part();
  crystal(c, 7, 9, 4 + v, 2, 2, ICE, C_WHITE);
  c.part();
  for (let k = 0; k < 4; k++) c.px(8 + k * 0.6, 9 + k, GLOW_ICE);
  return c;
}

export const CO_CRACK_W = 64;
export const CO_CRACK_H = 9;

/** A crack of cold light racing through the floor: jagged, bright at its heart (white: tinted at runtime). */
function crackArt(): Uint8ClampedArray {
  const w = CO_CRACK_W;
  const h = CO_CRACK_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const put = (x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    const c = Math.max(px[i], Math.round(255 * v));
    px.set([c, c, c, 255], i);
  };
  let y = 4;
  for (let x = 0; x < w; x++) {
    const target = 4 + Math.round(Math.sin((x / w) * Math.PI * 4) * 1.5 + (hash2(x, 0, 41) - 0.5) * 1.6);
    y += Math.sign(target - y);
    put(x, y, 1);
    put(x, y - 1, 0.45);
    put(x, y + 1, 0.45);
    if (hash2(x, 1, 43) > 0.86) {
      // A short branch off the main crack.
      const d = hash2(x, 2, 47) > 0.5 ? 1 : -1;
      for (let k = 1; k <= 3; k++) put(x + k, y + d * k, 0.6 - k * 0.12);
    }
  }
  return px;
}

export function colossusFx(r: FxRegistrar): void {
  r.frames('co_chunk', [0, 1, 2].map((v) => ({ name: `c${v}`, canvas: chunk(v) })), CO_CHUNK, CO_CHUNK);
  r.image('co_crack', CO_CRACK_W, CO_CRACK_H, crackArt());
}
