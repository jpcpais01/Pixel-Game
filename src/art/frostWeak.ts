// The Aurora Colosseum's weak creatures, drawn like every monster (lit, with
// a glow layer, facing right and mirrored):
//   - The snowmite: a round little snow-beetle, its blue shell crusted with
//     snow and grown with ice crystals, ice-blue eyes and twitching feelers.
//     It curls into a spiked ball and rolls; afterwards it sees stars.
//   - The rimesprite: a frost pixie with crystal hair and wings of clear ice
//     veined with aurora light, a skirt of icicle petals and aurora eyes. It
//     cups a mote of light in its hands before it casts.
//   - The icebeak: a stout midnight-blue penguin with a white bib, a golden
//     beak and feet, white-ringed eyes and a crest of ice crystals swept back
//     like a rockhopper's. It belly-slides.
//   - The rimeweaver: an ice spider, its abdomen a glassy bulb of ice with a
//     violet snowflake rune glowing inside, a dark carapace, a cluster of
//     violet eyes, crystal fangs and long legs frosted at the knees.
//   - The flurrykin: a fluffy snow imp with long frost-tipped ears, an ice
//     horn, an ice-blue face with a crooked grin and green aurora eyes, and a
//     tail ending in a glowing snow puff. It burrows: a drift with two ear
//     tips poking out.
// Also their spells: the rimeweaver's glob of frozen silk and the web it
// leaves on the floor.

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, hex, sphere, type Material, type RGB } from './pixel';
import { bayer, clamp01 } from './bitmap';
import { hash2, rng } from './env';
import {
  C_AURORA,
  C_ICE,
  C_PINK,
  C_TEAL,
  C_VIOLET,
  C_WHITE,
  FEATHER,
  FUR_WHITE,
  GLOW_AURORA,
  GLOW_ICE,
  GLOW_VIOLET,
  HOLLOW,
  HORN,
  ICE,
  ICE_DARK,
  ICE_GLOW,
  INK,
  IVORY,
  RIME,
  SNOW,
  crystal,
  poly,
  ramp,
  type FxRegistrar,
} from './frostKit';

/** Burst tints when they die. */
export const MITE_TINTS = [0x5c94d0, 0xdcf2ff, 0x9ae8ff, 0xffffff];
export const SPRITE_TINTS = [0x8affc8, 0x9ae8ff, 0xe8fbff, 0x4ae8e0];
export const BEAK_TINTS = [0x1a2646, 0xfafdff, 0xd88a3a, 0x9ae8ff];
export const WEAVER_TINTS = [0xb48aff, 0x9ae8ff, 0xe8fbff, 0x22304e];
export const IMP_TINTS = [0xffffff, 0xdce8ff, 0x8affc8, 0xb0c4e8];
/** The web's frozen silk, as it splashes. */
export const WEB_TINTS = [0xf2f0ff, 0xc8c8f0, 0xb48aff, 0xffffff];

// ---------------------------------------------------------------- Materials

/** The snowmite's shell: blue chitin under its snow. */
const MITE_SHELL: Material = { ramp: ramp('#0e1834', '#182c58', '#24447e', '#3866a8', '#5c94d0', '#98c8f0', '#dcf2ff'), outline: INK, outlineLit: hex('#16264a'), shine: true };
/** Dark polished chitin: heads, legs, a spider's carapace. */
const CHITIN: Material = { ramp: ramp('#06080f', '#0e1424', '#18223a', '#263652', '#3a4e72', '#587298'), outline: INK, outlineLit: hex('#121a2e'), shine: true };
/** The snowmite's head: lighter chitin, so its face reads against its legs. */
const MITE_HEAD: Material = { ramp: ramp('#0c1426', '#18264a', '#283e6e', '#3e5c94', '#5e84b8', '#8aaed4'), outline: INK, outlineLit: hex('#16264a'), shine: true };
/** The rimeweaver's legs: frosted blue, so they read against their dark outline. */
const LEG: Material = { ramp: ramp('#14203a', '#24385e', '#3a5886', '#5a80b0', '#8cb0d8'), outline: INK, shine: true };
/** Its far legs: thin dark lines with no outline of their own. */
const LEG_FAR: Material = { ramp: ramp('#060a14', '#0c1426', '#16223a', '#22324e'), outline: INK, noOutline: true };
const CHITIN_FAR: Material = { ramp: ramp('#04060c', '#0a0f1c', '#121a2e', '#1c2840', '#283850'), outline: INK };
/** Wings of clear ice: pale, a little see-through looking, faintly lit. */
const WING: Material = { ramp: ramp('#2a5a8e', '#4a8cc4', '#82c4ec', '#c4ecff', '#f0fcff'), outline: hex('#0c2440'), outlineLit: hex('#2a5a8a'), emissive: 0.3, noAO: true };
const WING_FAR: Material = { ramp: ramp('#1a3a66', '#2c5c94', '#4a86bc', '#78b0dc'), outline: hex('#0a1c34'), emissive: 0.2, noAO: true };
/** The sprite's skin: frost-pale, bright. */
const SKIN: Material = { ramp: ramp('#4a5670', '#7a88a6', '#aab8d0', '#d4def0', '#f4f8ff'), outline: INK, outlineLit: hex('#2a3246') };
/** The sprite's hair: aurora teal. */
const HAIR: Material = { ramp: ramp('#0a2a38', '#124a5a', '#1e7280', '#36a0a6', '#68d0c8', '#b0f4e8'), outline: INK, outlineLit: hex('#0e3240'), emissive: 0.12 };
/** Its petal skirt and bodice: aurora violet. */
const PETAL: Material = { ramp: ramp('#1a1236', '#2e2058', '#46327e', '#6650a8', '#8c74cc', '#bca6ee'), outline: INK, outlineLit: hex('#1e1440') };
/** The penguin's golden beak and feet: the one warm colour in the north. */
const BEAK: Material = { ramp: ramp('#3a1c10', '#6e3a1c', '#a8602a', '#d88a3a', '#f4b860', '#ffe0a0'), outline: INK, shine: true };
const FEATHER_FAR: Material = { ramp: ramp('#05080f', '#0a1020', '#121c34', '#1a2846'), outline: INK };
/** The imp's face: cold blue skin. */
const IMP_FACE: Material = { ramp: ramp('#2a4878', '#4a72a8', '#76a0d0', '#a6caec', '#d4ecff'), outline: INK };
const EAR_IN: Material = { ramp: ramp('#2a2450', '#463c7a', '#6a5aa6', '#9484cc'), outline: INK };
const FUR_FAR: Material = { ...FUR_WHITE, bias: -1 };
/** Frozen silk: pale, violet in its folds. */
const SILK: Material = { ramp: ramp('#2a2a4e', '#4e4e86', '#8a8ac4', '#c8c8f0', '#f2f0ff'), outline: hex('#140c2a'), outlineLit: hex('#2a2450'), emissive: 0.15 };

// ---------------------------------------------------------------- Helpers

/**
 * An ellipse turned by `ang` (its own x axis along (cos, sin)), shaded as a
 * ball. `bias` can darken or lighten it by where a pixel lies on it.
 */
function oval(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, ang: number, m: Material, bias?: (lx: number, ly: number) => number): void {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const R = Math.max(rx, ry) + 1;
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const lx = (dx * ca + dy * sa) / rx;
      const ly = (-dx * sa + dy * ca) / ry;
      const d2 = lx * lx + ly * ly;
      if (d2 > 1) continue;
      const wx = lx * ca - ly * sa;
      const wy = lx * sa + ly * ca;
      const z = Math.sqrt(1 - Math.min(0.95, d2));
      const l = Math.hypot(wx, wy, z);
      c.px(x, y, m, { x: wx / l, y: -wy / l, z: z / l }, { bias: bias ? bias(lx, ly) : 0 });
    }
  }
}

/** A limb through points, tapering from r0 to r1. */
function limb(c: PixelCanvas, pts: [number, number][], r0: number, r1: number, m: Material): void {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    c.capsule(ax, ay, bx, by, r0 + ((r1 - r0) * i) / n, r0 + ((r1 - r0) * (i + 1)) / n, m);
  }
}

/** A leaf-shaped blade (an ear, a wing) from (x, y) to its tip, `wide` at its widest, lit on its upper facet. */
function blade(c: PixelCanvas, x: number, y: number, tx: number, ty: number, wide: number, m: Material, at = 0.4): void {
  const len = Math.hypot(tx - x, ty - y) || 1;
  const ux = (tx - x) / len;
  const uy = (ty - y) / len;
  const nx = -uy;
  const ny = ux;
  const pts: [number, number][] = [
    [x + nx * wide * 0.45, y + ny * wide * 0.45],
    [x + ux * len * at + nx * wide, y + uy * len * at + ny * wide],
    [tx, ty],
    [x + ux * len * (at + 0.1) - nx * wide * 0.75, y + uy * len * (at + 0.1) - ny * wide * 0.75],
    [x - nx * wide * 0.45, y - ny * wide * 0.45],
  ];
  // The facet facing up-left takes the light.
  const lit = nx * -0.6 + ny * -0.8 > 0 ? 1 : -1;
  poly(c, pts, m, (px, py) => {
    const s = (px + 0.5 - x) * nx + (py + 0.5 - y) * ny;
    return s * lit > 0 ? { x: -0.45, y: 0.5, z: 0.74 } : { x: 0.35, y: 0.05, z: 0.93 };
  });
}

/** A little four-pointed twinkle in the glow layer. */
function twinkle(c: PixelCanvas, x: number, y: number, col: RGB, a: number): void {
  c.spark(x, y, col, a);
  c.spark(x - 1, y, col, a * 0.45);
  c.spark(x + 1, y, col, a * 0.45);
  c.spark(x, y - 1, col, a * 0.45);
  c.spark(x, y + 1, col, a * 0.45);
}

// ---------------------------------------------------------------- Snowmite

interface MitePose {
  lift?: number;
  /** Walk step 0..3. */
  step?: number;
  /** 0..1 curled into a ball. */
  curl?: number;
  /** Rocked back on its heels, px (the moment before the roll). */
  back?: number;
  /** Dazed: its stars' turn 0..3. */
  dizzy?: number;
  blink?: boolean;
  /** Which crystal catches the light. */
  glint: number;
}

const MITE_FOOT = 18;

function snowmite(p: MitePose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.snowmite;
  const c = new PixelCanvas(w, h);
  const k = p.curl ?? 0;
  const back = p.back ?? 0;
  const daze = p.dizzy !== undefined;
  const bx = 10 - back;
  const by = 12.3 - (p.lift ?? 0) + k * 0.7 + (daze ? 0.4 : 0);
  const rx = 6.6 - k * 1.0;
  const ry = 4.6 + k * 1.0;

  // Six short legs, three a side: the far three first, darker.
  const legs = (far: boolean) => {
    [-1, 0, 1].forEach((i) => {
      const hx = bx + i * 3.6 + (far ? 1.4 : 0);
      const hy = by + ry * 0.55;
      const lifted = p.step !== undefined && (i + 1 + p.step + (far ? 1 : 0)) % 2 === 0;
      const swing = p.step !== undefined ? (lifted ? 1.2 : -0.5) : 0;
      const reach = i * 1.7 * (1 - k) + (daze ? i * 0.6 : 0);
      const fx = hx + reach + swing;
      const fy = MITE_FOOT - 0.5 - (lifted ? 1.3 : 0) - k * 2.6;
      const kx = hx + reach * 0.75 + swing * 0.5 + (i === 0 ? 0.6 : 0);
      const ky = hy + 0.4 - (lifted ? 0.8 : 0);
      limb(c, [[hx, hy], [kx, ky], [fx, fy]], 0.7, 0.45, far ? CHITIN_FAR : CHITIN);
    });
  };
  c.part();
  legs(true);

  // Its dark underside, a sliver below the shell.
  c.part();
  oval(c, bx + 0.8, by + 2.2, rx - 1.4, ry * 0.45, 0, CHITIN, () => -1);

  // The shell: plates whose seams catch shadow, its lower rim darker.
  c.part();
  oval(c, bx, by, rx, ry, 0, MITE_SHELL, (lx, ly) => (Math.abs(lx + 0.32) < 0.08 || Math.abs(lx - 0.3) < 0.08 ? -1 : 0) + (ly > 0.62 ? -1 : 0));

  // A lumpy cap of snow heaped on its back.
  c.part();
  oval(c, bx - 0.4, by - ry * 0.55, rx * 0.82, ry * 0.5 + k * 0.3, 0, SNOW, (_lx, ly) => (ly > 0.5 ? -1 : 0));
  c.part();
  for (const [dx, r] of [[-3.2, 1.6], [2.4, 1.5]] as const) c.ellipse(bx + dx, by - ry * 0.75, r, r * 0.8, SNOW);

  // Crystals of ice growing out of the crust, splaying out as it curls.
  const set: [number, number, number, number, number, Material][] = [
    [-3, -ry + 0.4, -5.4 - k * 2, -ry - 3 + k * 1.2, 1.1, ICE_DARK],
    [0.2, -ry - 0.2, 0.8, -ry - 4.8 + k * 0.6, 1.5, ICE],
    [3, -ry + 0.6, 5.2 + k * 2, -ry - 2.6 + k * 1.4, 1.1, ICE],
  ];
  set.forEach(([bxo, byo, txo, tyo, r, m], i) => {
    c.part();
    crystal(c, bx + bxo, by + byo, bx + txo, by + tyo, r, m, i === p.glint % 3 ? C_WHITE : null);
    c.px(bx + bxo, by + byo, ICE_GLOW);
  });
  if (k > 0) for (const [, , txo, tyo] of set) c.spark(bx + txo, by + tyo + 1, C_ICE, 0.35 * k);

  // The head, tucked in as it curls; mandibles and two eyes.
  c.part();
  const hx = bx + rx + 1.6 - k * 3.4;
  const hy = by + 1.1 + k * 1.6 + (daze ? 0.8 : 0);
  oval(c, hx, hy, 3.1 - k * 0.5, 2.7 - k * 0.3, -0.25, MITE_HEAD);
  c.part();
  if (k < 0.8) {
    c.px(hx + 2.6, hy + 1.1, IVORY, sphere(0.2, 0.4));
    c.px(hx + 3.2, hy + 1.6, IVORY, sphere(0.6, 0));
    c.px(hx + 2.2, hy + 1.9, IVORY, sphere(0.2, -0.2));
  }
  const eye = daze ? RIME : GLOW_ICE;
  if (!p.blink) {
    c.px(hx + 0.8, hy - 1, eye);
    c.px(hx + 0.8, hy, eye, { x: 0, y: 0, z: 1 }, { glow: daze ? 0 : 0.7 });
    c.px(hx + 2.2, hy - 0.6, eye);
  } else c.px(hx + 0.8, hy - 0.4, CHITIN);
  // Feelers, laid back as it curls.
  if (k < 0.7) {
    const droop = daze ? 2 : 0;
    const tw = p.glint % 2;
    c.line(hx + 0.4, hy - 2.1, hx + 1.6, hy - 4.2 + droop, CHITIN, () => ({ x: -0.3, y: 0.6, z: 0.75 }));
    c.line(hx + 1.6, hy - 4.2 + droop, hx + 3.8, hy - 5 + tw + droop * 1.5, CHITIN, () => ({ x: -0.3, y: 0.6, z: 0.75 }));
    c.spark(hx + 3.8, hy - 5 + tw + droop * 1.5, C_ICE, 0.7);
  }

  c.part();
  legs(false);

  // Seeing stars: three little ones wheeling over its head.
  if (daze) {
    for (let s = 0; s < 3; s++) {
      const a = (p.dizzy! / 4 + s / 3) * Math.PI * 2;
      const sx = bx + 4 + Math.cos(a) * 4;
      const sy = by - ry - 4.5 + Math.sin(a) * 1.3;
      twinkle(c, sx, sy, s === 1 ? C_AURORA : C_ICE, Math.sin(a) > 0 ? 0.95 : 0.55);
    }
  }
  return c;
}

/** Curled up and rolling: a spiked ball of shell and snow, turned `rot` (clockwise, rolling right). */
function miteBall(rot: number, f: number): PixelCanvas {
  const { w, h } = MONSTER_FRAME.snowmite;
  const c = new PixelCanvas(w, h);
  const cx = 11;
  const cy = 11.6;
  const R = 6.4;
  // Snow motes thrown up behind it.
  const rnd = rng(f * 31 + 7);
  for (let i = 0; i < 4; i++) c.spark(cx - R - 1.5 - i * 1.4, cy - 2 + rnd() * 6, C_WHITE, 0.4 - i * 0.07);
  c.part();
  for (const [dx, dy] of [[-R - 1, 5.6], [-R - 2.6, 5], [-R - 4, 5.8]] as const) c.px(cx + dx + (f % 2), cy + dy - (f % 2) * 0.5, SNOW, sphere(0, 0.6));

  c.part();
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const dx = (x + 0.5 - cx) / R;
      const dy = (y + 0.5 - cy) / R;
      const r = Math.hypot(dx, dy);
      if (r > 1) continue;
      const rel = Math.atan2(dy, dx) - rot + Math.PI / 2;
      // Five patches of snow where the crystals grow, shell between them, seams between plates.
      const band = Math.cos(5 * rel);
      const snow = band > 0.25 && r > 0.35;
      const bias = band < -0.82 && r > 0.3 ? -1 : 0;
      c.px(x, y, snow ? SNOW : MITE_SHELL, sphere(dx, dy, 1), { bias });
    }
  }
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * Math.PI * 2) / 5 - Math.PI / 2;
    c.part();
    crystal(c, cx + Math.cos(a) * (R - 1.4), cy + Math.sin(a) * (R - 1.4), cx + Math.cos(a) * (R + 2.2), cy + Math.sin(a) * (R + 2.2), 1.2, Math.sin(a) > 0.5 ? ICE_DARK : ICE, i === f % 5 ? C_WHITE : null);
  }
  // A spray of snow at its foot, thrown forward.
  c.part();
  c.px(cx + R - 0.5, MITE_FOOT - 0.5, SNOW, sphere(0.2, 0.6));
  c.px(cx + R + 1 + (f % 2), MITE_FOOT - 1.5, RIME, sphere(0.2, 0.6));
  return c;
}

export function buildSnowmiteSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  const breath = [0, 0.4, 0.7, 0.4];
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => snowmite({ lift: breath[i], glint: i, blink: i === 3 })));
  [0, 1, 2, 3].forEach((i) => (poses[`walk${i}`] = () => snowmite({ step: i, lift: i % 2 ? 0.6 : 0, glint: i })));
  poses.curl0 = () => snowmite({ curl: 0.45, glint: 0 });
  poses.curl1 = () => snowmite({ curl: 0.85, glint: 1 });
  poses.curl2 = () => snowmite({ curl: 0.9, back: 1, glint: 2 });
  [0, 1, 2, 3].forEach((i) => (poses[`roll${i}`] = () => miteBall((i * Math.PI * 2) / 20, i)));
  [0, 1, 2, 3].forEach((i) => (poses[`dizzy${i}`] = () => snowmite({ dizzy: i, lift: i % 2 ? 0.3 : 0, glint: i, back: i === 1 ? 0.5 : i === 3 ? -0.5 : 0 })));
  return sheet(MONSTER_FRAME.snowmite, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 5, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 14, loop: true },
    { name: 'windup', frames: ['curl0', 'curl1', 'curl2', 'curl1', 'curl2'], fps: 9, loop: false },
    { name: 'roll', frames: ['roll0', 'roll1', 'roll2', 'roll3'], fps: 18, loop: true },
    { name: 'dizzy', frames: ['dizzy0', 'dizzy1', 'dizzy2', 'dizzy3'], fps: 7, loop: true },
  ]);
}

// ---------------------------------------------------------------- Rimesprite

interface SpritePose {
  /** Wing beat: -1 up .. 1 down. */
  beat: number;
  bob: number;
  arms: 'rest' | 'cast' | 'throw';
  /** 0..1 the mote of light gathering in its hands. */
  orb?: number;
  /** Leaning into a dart. */
  lean?: number;
  blink?: boolean;
  seed: number;
}

function rimesprite(p: SpritePose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.rimesprite;
  const c = new PixelCanvas(w, h);
  const L = p.lean ?? 0;
  const b = p.bob;
  const X = 12 + L;

  // Wings: two pairs on its back, the far pair a little higher and darker.
  const wings = (far: boolean) => {
    const ax = X - 1.4 + (far ? 1.4 : 0);
    const ay = 12.8 + b - (far ? 1 : 0);
    const a1 = -2.05 - (p.beat + 1) * 0.5 - L * 0.35;
    const a2 = 2.85 - p.beat * 0.25 + L * 0.2;
    const l1 = far ? 8.6 : 10;
    const l2 = far ? 5.8 : 7;
    const m = far ? WING_FAR : WING;
    for (const [a, len, wd] of [[a1, l1, 2.9], [a2, l2, 2.1]] as const) {
      const tx = ax + Math.cos(a) * len;
      const ty = ay + Math.sin(a) * len;
      blade(c, ax, ay, tx, ty, wd, m, 0.55);
      // An aurora vein down the wing, brightest at the tip.
      if (!far) {
        for (let s = 0.25; s <= 0.95; s += 0.1) {
          const vx = ax + (tx - ax) * s;
          const vy = ay + (ty - ay) * s;
          c.shade(vx, vy, 1);
          c.spark(vx, vy, C_AURORA, 0.15 + s * 0.3);
        }
        c.spark(tx, ty, C_TEAL, 0.6);
      }
    }
  };
  c.part();
  wings(true);
  c.part();
  wings(false);

  // Dangling legs, trailing behind as it darts.
  c.part();
  const sway = Math.sin(p.seed * 1.7) * 0.5;
  limb(c, [[X + 1, 19 + b], [X + 0.6 - L * 1.5 + sway, 22 + b], [X + 0.2 - L * 2.8 + sway, 24.2 + b]], 0.85, 0.4, { ...SKIN, bias: -1 });
  limb(c, [[X - 0.4, 19 + b], [X - 1.1 - L * 1.5 - sway, 22.6 + b], [X - 1.6 - L * 3 - sway, 25.2 + b]], 0.9, 0.4, SKIN);

  // A skirt of violet petals, tipped with ice.
  c.part();
  c.shape(Math.round(14.6 + b), Math.round(20 + b), (y) => {
    const u = clamp01((y - 14.6 - b) / 5.4);
    const hw = 1.4 + u * 2.5;
    const s = -L * u * 1.5;
    return [X - hw + s, X + hw + s + 0.4];
  }, PETAL, (_x, _y, t, u) => ({ x: t * 0.8, y: 0.45 - u * 0.4, z: 0.75 }));
  for (const [dx, dl] of [[-3, 0.3], [-1, 1.2], [1.2, 0.9], [3.2, 0.2]] as const) {
    c.part();
    crystal(c, X + dx - L * 1.4, 19.2 + b, X + dx * 1.15 - L * 2.4, 22.2 + dl + b, 1.05, PETAL, null);
    c.px(X + dx * 1.15 - L * 2.4, 21.6 + dl + b, ICE, sphere(0, 0.4));
    if (dl > 1) c.spark(X + dx * 1.15 - L * 2.4, 22 + dl + b, C_ICE, 0.6);
  }
  c.part();
  for (let x = Math.round(X - 1.6); x <= Math.round(X + 1.8); x++) c.px(x, 14.6 + b, RIME, sphere(0, 0.5));

  // Torso in a petal bodice.
  c.part();
  c.capsule(X + 0.2, 14.6 + b, X + 0.4 + L * 0.5, 12.4 + b, 1.5, 1.6, PETAL);

  // Far arm.
  c.part();
  if (p.arms === 'cast') limb(c, [[X - 0.4 + L, 13 + b], [X + 1.8 + L, 11.4 + b], [X + 4.2 + L, 10.8 + b]], 0.75, 0.6, { ...SKIN, bias: -1 });

  // Teal hair behind the head, a lock streaming back.
  c.part();
  c.ellipse(X - 1.2 + L, 9.6 + b, 2.6, 3.6, HAIR);
  c.capsule(X - 2.2 + L, 11.4 + b, X - 5 - L * 1.5, 14.6 + b, 1.4, 0.7, HAIR);
  // The head, its face clear.
  c.part();
  c.ellipse(X + 1.2 + L, 9.6 + b, 3.4, 3.9, SKIN, { flatten: 2.4 });
  c.shade(X + 1.2 + L, 13 + b, -1);
  // Fringe, and a little crown of ice.
  c.part();
  c.ellipse(X - 0.6 + L, 6.6 + b, 3.3, 1.4, HAIR);
  c.px(X + 2.2 + L, 6.6 + b, HAIR, sphere(0.5, 0.2));
  c.px(X + 1.6 + L, 7.4 + b, HAIR, sphere(0.3, 0));
  c.part();
  crystal(c, X - 1.6 + L, 5.6 + b, X - 4 + L, 2.8 + b, 0.8, ICE_DARK, null);
  c.part();
  crystal(c, X + 0.2 + L, 5.4 + b, X - 0.6 + L, 1.8 + b, 1, ICE, C_WHITE);
  c.part();
  crystal(c, X + 1.6 + L, 5.8 + b, X + 3 + L, 3.2 + b, 0.8, ICE, C_ICE);
  // Face: big aurora eyes, a blush.
  c.part();
  if (!p.blink) {
    c.px(X + 2.2 + L, 9 + b, GLOW_AURORA);
    c.px(X + 2.2 + L, 10 + b, GLOW_AURORA);
    c.px(X + 4.2 + L, 9 + b, GLOW_AURORA);
    c.px(X + 4.2 + L, 10 + b, GLOW_AURORA);
  } else {
    c.px(X + 2.2 + L, 10 + b, HAIR);
    c.px(X + 4.2 + L, 10 + b, HAIR);
  }
  c.px(X + 3.2 + L, 11.4 + b, PETAL, sphere(0, 0));
  c.spark(X + 2 + L, 11 + b, C_PINK, 0.35);

  // Near arm.
  c.part();
  const sx = X + 0.8 + L * 0.6;
  const sy = 13.2 + b;
  if (p.arms === 'rest') limb(c, [[sx, sy], [sx + 1.2, sy + 1.6], [sx + 2.4, sy + 2.6]], 0.8, 0.6, SKIN);
  else if (p.arms === 'cast') limb(c, [[sx, sy], [sx + 2.4, sy - 0.6], [sx + 4.6, sy - 2.4]], 0.8, 0.6, SKIN);
  else limb(c, [[sx, sy], [sx + 3, sy - 0.4], [sx + 6.2, sy - 0.8]], 0.8, 0.6, SKIN);

  // The mote of light between its hands, swelling.
  if (p.arms === 'cast') {
    const o = p.orb ?? 0;
    const ox = X + 6.4 + L;
    const oy = 10 + b;
    c.part();
    c.ellipse(ox, oy, 0.9 + o * 1.1, 0.9 + o * 1.1, ICE_GLOW);
    const R = rng(p.seed * 13 + 5);
    for (let i = 0; i < 4 + o * 4; i++) {
      const a = R() * Math.PI * 2;
      const r = 2.2 + o * 1.6 + R();
      c.spark(ox + Math.cos(a) * r, oy + Math.sin(a) * r, i % 2 ? C_AURORA : C_TEAL, 0.35 + R() * 0.4);
    }
  }
  if (p.arms === 'throw') {
    for (let i = 0; i < 5; i++) c.spark(X + 8 + i * 1.2 + L, 12.4 + b - i * 0.3 + (i % 2), i % 2 ? C_AURORA : C_WHITE, 0.6 - i * 0.1);
  }

  // Frost dust drifting down from it.
  const R = rng(p.seed * 7 + 3);
  for (let i = 0; i < 4; i++) c.spark(X - 3 + R() * 6 - L * 3, 22 + R() * 5, i % 2 ? C_TEAL : C_ICE, 0.25 + R() * 0.35);
  return c;
}

export function buildRimespriteSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  const beat = [-1, 0, 1, 0];
  const bob = [0, 0.5, 1, 0.5];
  [0, 1, 2, 3].forEach((i) => (poses[`fly${i}`] = () => rimesprite({ beat: beat[i], bob: bob[i], arms: 'rest', seed: i, blink: i === 2 })));
  [0, 1, 2, 3].forEach((i) => (poses[`dart${i}`] = () => rimesprite({ beat: beat[i] * 0.5 + 0.3, bob: 0.5, arms: 'rest', lean: 1, seed: i + 10 })));
  poses.cast0 = () => rimesprite({ beat: -1, bob: 0, arms: 'cast', orb: 0.2, seed: 20 });
  poses.cast1 = () => rimesprite({ beat: 0, bob: 0.5, arms: 'cast', orb: 0.6, seed: 21 });
  poses.cast2 = () => rimesprite({ beat: -1, bob: 0, arms: 'cast', orb: 1, seed: 22 });
  poses.throw = () => rimesprite({ beat: 1, bob: 1, arms: 'throw', lean: 0.5, seed: 23 });
  return sheet(MONSTER_FRAME.rimesprite, poses, [
    { name: 'idle', frames: ['fly0', 'fly1', 'fly2', 'fly3'], fps: 10, loop: true },
    { name: 'walk', frames: ['fly0', 'fly1', 'fly2', 'fly3'], fps: 13, loop: true },
    { name: 'dart', frames: ['dart0', 'dart1', 'dart2', 'dart3'], fps: 18, loop: true },
    { name: 'windup', frames: ['cast0', 'cast1', 'cast2', 'cast1', 'cast2'], fps: 8, loop: false },
  ]);
}

// ---------------------------------------------------------------- Icebeak

interface BeakPose {
  /** How far the body leans over: 0 upright, PI/2 flat on its belly heading right. */
  tilt: number;
  /** Squashed flat (on its belly) 0..1. */
  flat?: number;
  /** 0..1 flippers raised back. */
  flip?: number;
  step?: number;
  open?: number;
  blink?: boolean;
  /** Squat, px. */
  squat?: number;
  /** Snow spray frame while sliding. */
  spray?: number;
  /** Leans its head back up (getting up), px. */
  headUp?: number;
}

const BEAK_FOOT = 24;

function icebeak(p: BeakPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.icebeak;
  const c = new PixelCanvas(w, h);
  const th = p.tilt;
  const flat = p.flat ?? 0;
  const sq = p.squat ?? 0;
  // Body axis (up the body) and its front (where the belly faces).
  const Ux = Math.sin(th);
  const Uy = -Math.cos(th);
  const Fx = Math.cos(th);
  const Fy = Math.sin(th);
  const rx = 6.2 * (1 - flat * 0.28) + sq * 0.3;
  const ry = 7.4 - sq * 0.7;
  // It pivots on its feet when upright; flat on its belly it lies along the floor.
  const lying = th > 1.1;
  const pivotX = lying ? 9.4 - Ux * 0 : 11.5;
  const bx = lying ? pivotX : pivotX + Ux * (ry + 0.4);
  const by = lying ? BEAK_FOOT - rx - 0.2 : BEAK_FOOT - 0.4 + Uy * (ry + 0.2) + sq * 0.2;

  // Feet: planted (or one lifted mid-waddle); trailing behind when it slides.
  c.part();
  const feet: [number, number][] = [[-1.4, 0], [2, 1]];
  for (const [fo, i] of feet) {
    const lifted = p.step !== undefined && (p.step + i) % 2 === 0 && p.step % 2 === 0;
    let fx = bx - Ux * (ry + 0.1) + Fx * (fo + 0.6);
    let fy = by - Uy * (ry + 0.1) + Fy * (fo + 0.6) - (lifted ? 1 : 0);
    if (!lying) fy = Math.min(fy, BEAK_FOOT - 0.5 - (lifted ? 1 : 0));
    if (lying) fx -= 0.5;
    if (lying) oval(c, fx - 0.4, fy + (i ? 0.8 : -0.4), 1.7, 0.9, i ? 0.25 : -0.25, BEAK);
    else oval(c, fx + 0.8, fy, 2.2, 1, 0, BEAK);
  }

  // The far flipper, peeking out behind its back.
  c.part();
  const fl = p.flip ?? 0;
  const shX = bx + Ux * 3.4 - Fx * 1.6;
  const shY = by + Uy * 3.4 - Fy * 1.6;
  const tipOf = (len: number, raise: number) => [shX - Ux * len * Math.cos(raise) - Fx * len * Math.sin(raise), shY - Uy * len * Math.cos(raise) - Fy * len * Math.sin(raise)] as [number, number];
  limb(c, [[shX - Fx * 1.5, shY - Fy * 1.5], tipOf(5.6, 0.35 + fl * 0.9).map((v, i) => v - (i ? Fy : Fx) * 1.5) as [number, number]], 1.5, 0.6, FEATHER_FAR);

  // Body: midnight feathers, a white bib in front, rime on its back.
  c.part();
  oval(c, bx, by, rx, ry, th, FEATHER);
  c.part();
  oval(c, bx + Fx * 1.8 - Ux * 0.6, by + Fy * 1.8 - Uy * 0.6, rx - 2, ry - 1.2, th, SNOW, (lx) => (lx < -0.75 ? -1 : 0));
  c.part();
  for (let s = -0.4; s <= 0.6; s += 0.2) {
    const ex = bx - Fx * (rx - 0.6) + Ux * ry * s;
    const ey = by - Fy * (rx - 0.6) + Uy * ry * s;
    if (hash2(Math.round(s * 10), 1, 4) > 0.35) c.px(ex, ey, RIME, sphere(-0.6, 0.5));
  }

  // The head, set on top (or out in front when it slides), its face always ahead.
  c.part();
  const hu = p.headUp ?? 0;
  const hx = bx + Ux * (ry - 0.6) + Fx * 1.1 + (lying ? -0.6 : 0);
  const hy = by + Uy * (ry - 0.6) + Fy * 1.1 - hu + (lying ? 0.4 : 0);
  oval(c, hx, hy, 4.3, 4, th * 0.25, FEATHER);
  // A white throat.
  c.part();
  oval(c, hx + 1.7, hy + 2.3, 2.2, 1.5, 0, SNOW);
  // The crest: plumes of ice flaring back from above its eye, past the back of its head.
  const crestLift = lying ? 1.5 : 0;
  c.part();
  crystal(c, hx + 1.6, hy - 1.8, hx - 5, hy - 4.6 + crestLift, 0.8, ICE_DARK, null);
  c.part();
  crystal(c, hx + 2.2, hy - 2.2, hx - 3.6, hy - 6.6 + crestLift * 1.4, 0.9, ICE, C_WHITE);
  c.part();
  crystal(c, hx + 1.8, hy - 1.2, hx - 5.6, hy - 2.4 + crestLift * 0.5, 0.75, ICE, C_ICE);
  c.spark(hx - 3.6, hy - 6.2 + crestLift * 1.4, C_ICE, 0.6);
  // The eye in its white ring.
  c.part();
  const ex = Math.round(hx + 1.8);
  const ey = Math.round(hy - 0.7);
  if (p.blink) {
    c.px(ex - 1, ey, SNOW);
    c.px(ex, ey, SNOW);
    c.px(ex + 1, ey, SNOW);
  } else {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) c.px(ex + dx, ey + dy, SNOW, sphere(dx * 0.4, -dy * 0.4));
    c.px(ex, ey, GLOW_ICE);
  }
  // The golden beak, gaping when it squawks.
  c.part();
  const o = p.open ?? 0;
  const bxx = hx + 3.4;
  const byy = hy + 0.2;
  poly(c, [[bxx, byy - 1], [bxx + 4, byy + 0.4], [bxx + 3.6, byy + 1], [bxx, byy + 1]], BEAK, () => ({ x: -0.2, y: 0.6, z: 0.75 }));
  poly(c, [[bxx, byy + 1 + o * 0.6], [bxx + 3.2, byy + 1.4 + o * 1.6], [bxx, byy + 2.2 + o * 0.8]], BEAK, () => ({ x: 0.2, y: -0.3, z: 0.9 }));
  if (o > 0) c.px(bxx + 0.6, byy + 1.3 + o * 0.5, HOLLOW);

  // The near flipper, rimed at its edge.
  c.part();
  const nShX = bx + Ux * 3.4 - Fx * 0.6;
  const nShY = by + Uy * 3.4 - Fy * 0.6;
  const raise = 0.15 + fl * 1.15;
  const len = 7;
  const tx = nShX - Ux * len * Math.cos(raise) - Fx * len * Math.sin(raise);
  const ty = nShY - Uy * len * Math.cos(raise) - Fy * len * Math.sin(raise);
  limb(c, [[nShX, nShY], [(nShX + tx) / 2 - Fx * 0.6, (nShY + ty) / 2 - Fy * 0.6], [tx, ty]], 1.7, 0.7, FEATHER);
  c.px(tx, ty, RIME, sphere(-0.4, 0.3));

  // A spray of snow off its belly as it slides.
  if (p.spray !== undefined) {
    const R = rng(p.spray * 17 + 3);
    for (let i = 0; i < 5; i++) c.spark(hx + 2 + R() * 4, BEAK_FOOT - 1 - R() * 4, C_WHITE, 0.35 + R() * 0.4);
    for (let i = 0; i < 4; i++) c.spark(1 + i * 2 + (p.spray % 2), BEAK_FOOT - 0.5 - (i % 2), C_ICE, 0.25);
    c.part();
    c.px(hx + 4 + (p.spray % 2), BEAK_FOOT - 1, SNOW, sphere(0, 0.6));
    c.px(hx + 5.5, BEAK_FOOT - 2 - (p.spray % 2), RIME, sphere(0, 0.6));
  }
  return c;
}

export function buildIcebeakSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  const breath = [0, 0.2, 0.35, 0.2];
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => icebeak({ tilt: 0, squat: -breath[i], blink: i === 2, flip: i === 1 ? 0.1 : 0 })));
  // A waddle: it rocks from foot to foot, flippers out for balance.
  const rock = [0.13, 0, -0.13, 0];
  [0, 1, 2, 3].forEach((i) => (poses[`walk${i}`] = () => icebeak({ tilt: rock[i], step: i, flip: 0.25 + (i % 2) * 0.1, squat: i % 2 ? 0 : 0.3 })));
  poses.crouch0 = () => icebeak({ tilt: 0.3, squat: 1.2, flip: 0.75 });
  poses.crouch1 = () => icebeak({ tilt: 0.42, squat: 1.6, flip: 1, open: 1 });
  poses.slide0 = () => icebeak({ tilt: Math.PI / 2, flat: 1, flip: 0.15, spray: 0 });
  poses.slide1 = () => icebeak({ tilt: Math.PI / 2, flat: 1, flip: 0.05, spray: 1 });
  poses.rest = () => icebeak({ tilt: Math.PI / 2, flat: 1, flip: 0.4, blink: true });
  poses.getup0 = () => icebeak({ tilt: Math.PI / 2, flat: 1, flip: 0.9, headUp: 1.5 });
  poses.getup1 = () => icebeak({ tilt: 0.55, squat: 1.6, flip: 0.6 });
  return sheet(MONSTER_FRAME.icebeak, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 4, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 8, loop: true },
    { name: 'windup', frames: ['crouch0', 'crouch1', 'crouch0', 'crouch1'], fps: 6, loop: false },
    { name: 'slide', frames: ['slide0', 'slide1'], fps: 12, loop: true },
    { name: 'getup', frames: ['rest', 'rest', 'getup0', 'getup0', 'getup1', 'crouch0'], fps: 6, loop: false },
  ]);
}

// ---------------------------------------------------------------- Rimeweaver

interface WeaverPose {
  bob?: number;
  /** Walk phase 0..3. */
  gait?: number;
  /** Abdomen swell and rune glow, 0..1. */
  pulse?: number;
  /** 0..1 reared up on its back legs. */
  rear?: number;
  lunge?: number;
  /** 0..1 a glob of silk gathering at its fangs. */
  glob?: number;
  /** Front legs flung up to bite, 0..1. */
  raise?: number;
  /** Fangs spread 0..1. */
  fangs?: number;
  /** Front legs stabbing down. */
  strike?: boolean;
}

const WEAVER_FOOT = 19;

function rimeweaver(p: WeaverPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.rimeweaver;
  const c = new PixelCanvas(w, h);
  const rear = p.rear ?? 0;
  const lu = p.lunge ?? 0;
  const bob = p.bob ?? 0;
  const pulse = p.pulse ?? 0.5;
  const raise = p.raise ?? 0;
  const cx = 17.4 + lu;
  const cy = 12.6 - rear * 2.6 + bob - raise * 1;
  const ax = 8.6 + lu * 0.5 - rear * 0.4;
  const ay = 10.4 + rear * 0.6 + bob * 0.6;
  const aAng = -0.32 + rear * 0.3;

  // Legs: back to front. Each a femur up to a frosted knee, a shin down to an ice-tipped foot.
  const NEAR = { hips: [[-2.4, 1.2], [-1, 1.8], [0.6, 1.8], [2, 1.2]], knees: [[9.6, 2.6], [13.6, 1.6], [21.2, 2.2], [25.4, 4.4]], feet: [1.4, 8.6, 23.4, 28.8] };
  const FAR = { hips: [[-1.8, 0.4], [-0.4, 0.8], [1, 0.8], [2.4, 0.4]], knees: [[11.4, 4], [15, 3.2], [19.6, 3.6], [23.4, 5.2]], feet: [5, 11.6, 20.4, 26.2] };
  const legs = (far: boolean) => {
    const L = far ? FAR : NEAR;
    for (let i = 0; i < 4; i++) {
      const hx = cx + L.hips[i][0];
      const hy = cy + L.hips[i][1];
      let [kx, ky] = L.knees[i];
      let fx = L.feet[i];
      let fy = WEAVER_FOOT - 0.5;
      kx += lu * (i >= 2 ? 1 : 0.5);
      fx += lu * (i >= 2 ? 1 : 0.2);
      ky += bob + (i >= 2 ? -rear * 2 : rear * 0.5);
      if (p.gait !== undefined) {
        const group = (i + (far ? 1 : 0)) % 2;
        const lifted = (p.gait === 0 && group === 0) || (p.gait === 2 && group === 1);
        const push = p.gait % 2 === 1 ? -0.6 : 0;
        if (lifted) {
          fy -= 2;
          fx += 1.6;
          ky -= 1;
          kx += 0.8;
        } else fx += push;
      }
      // Reared up: the front pair lift off the floor, reaching ahead.
      if (i >= 2 && rear > 0) {
        fx += rear * (i === 3 ? 2 : 1);
        fy -= rear * (i === 3 ? 7 : 3);
      }
      // Ready to bite: the front pair flung high and wide.
      if (i >= 2 && raise > 0) {
        kx += raise * (i === 3 ? 0.5 : -1);
        ky -= raise * (i === 3 ? 2.6 : 1.4);
        fx += raise * (i === 3 ? 0.6 : 1.4);
        fy -= raise * (i === 3 ? 10 : 6);
      }
      if (i >= 2 && p.strike) {
        fx = i === 3 ? 29 : 26;
        fy = WEAVER_FOOT - 0.5;
        kx = i === 3 ? 26.4 : 23;
        ky = 4.6;
      }
      // Thin, jointed and spread wide: a spider reads by its legs' arches.
      const mx = (kx + fx) / 2 + (fx > kx ? 0.6 : -0.6);
      const my = (ky + fy) / 2 - 1;
      if (far) {
        const n = () => ({ x: -0.3, y: 0.6, z: 0.75 });
        c.line(hx, hy, kx, ky, LEG_FAR, n);
        c.line(kx, ky, mx, my, LEG_FAR, n);
        c.line(mx, my, fx, fy, LEG_FAR, n);
      } else {
        c.line(hx, hy, kx, ky, LEG, () => ({ x: -0.4, y: 0.7, z: 0.6 }));
        c.line(hx, hy + 1, kx, ky + 1, LEG, () => ({ x: 0.2, y: -0.2, z: 0.95 }));
        c.line(kx, ky, mx, my, LEG, () => ({ x: -0.3, y: 0.6, z: 0.75 }));
        c.line(mx, my, fx, fy, LEG, () => ({ x: 0.2, y: 0.4, z: 0.85 }));
        c.px(kx, ky, RIME, sphere(-0.3, 0.7));
        c.px(mx, my, RIME, sphere(-0.3, 0.7));
      }
      c.px(fx, fy, far ? ICE_DARK : ICE, sphere(0.2, 0.5));
    }
  };
  c.part();
  legs(true);

  // The abdomen: a glassy bulb of ice with frost spines, a rune glowing inside.
  c.part();
  const arx = 6.3 + pulse * 0.3;
  const ary = 4.8 + pulse * 0.25;
  oval(c, ax, ay, arx, ary, aAng, ICE, (lx, ly) => (ly > 0.55 ? -1 : 0) + (Math.abs(ly + 0.1) < 0.09 && lx < 0.4 ? -1 : 0));
  // Spinnerets at its tail.
  c.part();
  const tailX = ax - Math.cos(aAng) * (arx - 0.4);
  const tailY = ay - Math.sin(aAng) * (arx - 0.4);
  c.ellipse(tailX - 0.4, tailY + 0.8, 1.2, 1, CHITIN);
  // Frost spines along its back.
  for (const s of [-0.5, -0.05, 0.4]) {
    const px = ax + Math.cos(aAng) * arx * s + Math.sin(aAng) * ary * 0.85;
    const py = ay + Math.sin(aAng) * arx * s - Math.cos(aAng) * ary * 0.85;
    c.part();
    crystal(c, px, py + 0.6, px - 1.4, py - 2.6, 0.8, ICE, s === -0.05 ? C_WHITE : null);
  }
  // The rune: a snowflake of violet light, beating.
  c.part();
  const rx0 = Math.round(ax + 0.6);
  const ry0 = Math.round(ay - 1.2);
  const runeGlow = 0.55 + pulse * 0.45;
  const rune: [number, number][] = [[0, 0], [2, 0], [-2, 0], [1, -1], [-1, 1], [1, 1], [-1, -1], [0, -2], [0, 2]];
  for (const [dx, dy] of rune) c.px(rx0 + dx, ry0 + dy, GLOW_VIOLET, { x: 0, y: 0, z: 1 }, { glow: Math.abs(dx) + Math.abs(dy) === 0 ? 1 : runeGlow, bias: -1 });
  c.spark(rx0, ry0, C_VIOLET, 0.3 + pulse * 0.4);

  // The waist, and the carapace.
  c.part();
  c.capsule(ax + 5.2, ay + 1, cx - 3, cy + 0.4, 1.2, 1.2, CHITIN);
  c.part();
  oval(c, cx, cy, 3.8, 2.8, -0.12 - rear * 0.3, CHITIN, (_lx, ly) => (ly > 0.6 ? -1 : 0));
  c.part();
  for (const dx of [-2, -1, 0]) c.px(cx + dx, cy - 3 + (dx === -2 ? 0.5 : 0), RIME, sphere(-0.3, 0.8));

  // Palps, fangs and the silk glob.
  c.part();
  const f = p.fangs ?? 0;
  limb(c, [[cx + 3, cy + 0.4], [cx + 5.2, cy + 0.6 - f], [cx + 5.8, cy + 2.6 - f * 1.5]], 0.7, 0.5, CHITIN);
  c.part();
  crystal(c, cx + 3, cy + 1.4, cx + 3.6 + f * 0.4, cy + 4.6 + f * 0.4, 0.9, ICE_DARK, null);
  c.part();
  crystal(c, cx + 3.8, cy + 1.2, cx + 5 + f * 1.4, cy + 4.4 - f * 0.4, 0.95, ICE, C_ICE);
  if (p.glob) {
    c.part();
    const gx = cx + 6 + p.glob * 0.6;
    const gy = cy + 1;
    c.ellipse(gx, gy, 0.8 + p.glob * 1.3, 0.8 + p.glob * 1.2, SILK);
    c.spark(gx, gy, C_VIOLET, 0.5 + p.glob * 0.4);
    if (p.glob > 0.5) c.spark(gx + 1.5, gy - 1.5, C_WHITE, 0.5);
  }
  // The eyes: a cluster of violet lights.
  c.part();
  c.px(cx + 2.4, cy - 1.6, GLOW_VIOLET);
  c.px(cx + 3.4, cy - 1.1, GLOW_VIOLET);
  c.px(cx + 1.4, cy - 2.1, GLOW_VIOLET, { x: 0, y: 0, z: 1 }, { glow: 0.7 });
  c.px(cx + 3.4, cy - 2.2, GLOW_VIOLET, { x: 0, y: 0, z: 1 }, { glow: 0.7 });
  if (raise > 0 || p.strike) c.spark(cx + 3, cy - 1.6, C_VIOLET, 0.8);

  c.part();
  legs(false);
  return c;
}

export function buildRimeweaverSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  const pulse = [0.2, 0.6, 1, 0.6];
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => rimeweaver({ pulse: pulse[i], bob: i === 2 ? 0.4 : 0 })));
  [0, 1, 2, 3].forEach((i) => (poses[`walk${i}`] = () => rimeweaver({ gait: i, pulse: 0.5, bob: i % 2 ? 0 : -0.5 })));
  poses.rear0 = () => rimeweaver({ rear: 0.5, glob: 0.3, pulse: 0.7 });
  poses.rear1 = () => rimeweaver({ rear: 1, glob: 0.7, pulse: 1 });
  poses.rear2 = () => rimeweaver({ rear: 1, glob: 1, pulse: 0.8, bob: -0.4 });
  poses.spit = () => rimeweaver({ rear: 0.2, lunge: 1.5, fangs: 1, pulse: 0.3 });
  poses.raise0 = () => rimeweaver({ raise: 0.6, fangs: 0.6, pulse: 0.8 });
  poses.raise1 = () => rimeweaver({ raise: 1, fangs: 1, pulse: 1, lunge: -0.6 });
  poses.bite = () => rimeweaver({ strike: true, lunge: 2, fangs: 0, pulse: 0.6 });
  return sheet(MONSTER_FRAME.rimeweaver, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 5, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 16, loop: true },
    { name: 'spit_wind', frames: ['rear0', 'rear1', 'rear2', 'rear1', 'rear2'], fps: 8, loop: false },
    { name: 'bite_wind', frames: ['raise0', 'raise1'], fps: 6, loop: false },
  ]);
}

// ---------------------------------------------------------------- Flurrykin

interface ImpPose {
  /** Lifted off the floor (a hop), px; negative crouches. */
  hop?: number;
  tail?: number;
  /** Ears swept back 0..1. */
  ears?: number;
  blink?: boolean;
  arm: 'rest' | 'wind' | 'throw' | 'up';
  lean?: number;
  /** Grin wide open. */
  grin?: boolean;
  /** Sunk this many px into a drift (its feet hidden). */
  sink?: number;
  seed: number;
}

const IMP_FOOT = 24;

function flurrykin(p: ImpPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.flurrykin;
  const c = new PixelCanvas(w, h);
  const hop = p.hop ?? 0;
  const L = p.lean ?? 0;
  const sink = p.sink ?? 0;
  const X = 11 + L * 0.5;
  const crouch = Math.max(0, -hop);
  const up = Math.max(0, hop) - sink;
  // Body and head heights.
  const bodyY = 18.6 - up + crouch * 0.6;
  const headY = 11.8 - up + crouch * 1.2;
  const ears = p.ears ?? 0;

  // The tail, curling up behind, its tip a glowing snow puff.
  const t = p.tail ?? 0;
  c.part();
  const tx = X - 7.6 + t;
  const ty = bodyY - 7.4 + Math.abs(t) * 0.4;
  limb(c, [[X - 3.4, bodyY + 1.4], [X - 6.6, bodyY + 0.4], [X - 8 + t * 0.5, bodyY - 3.6], [tx, ty]], 1, 0.6, FUR_WHITE);
  c.part();
  c.ellipse(tx - 0.2, ty - 1.2, 1.9, 1.8, SNOW);
  c.px(tx - 0.2, ty - 1.4, ICE_GLOW);
  twinkle(c, tx - 0.2, ty - 1.4, C_AURORA, 0.45);

  // The far ear and far arm, behind.
  c.part();
  blade(c, X + 1.6 + L, headY - 3.4, X - 1.6 + L - ears * 3.6, headY - 9.4 + ears * 3.4, 1.5, FUR_FAR);
  c.part();
  const shY = bodyY - 3;
  if (p.arm === 'up') limb(c, [[X - 1, shY], [X - 2.6, shY - 3], [X - 3.4, shY - 6.2]], 1, 0.8, FUR_FAR);
  else if (p.arm === 'wind') limb(c, [[X + 0.6, shY], [X + 3, shY + 0.6], [X + 4.6, shY - 1]], 1, 0.8, FUR_FAR);
  else limb(c, [[X + 0.6, shY], [X + 2.2, shY + 1.8], [X + 3.4, shY + 3]], 1, 0.8, FUR_FAR);

  // Big snowshoe feet.
  if (sink < 2) {
    c.part();
    const tuck = Math.max(0, hop) > 1.5 ? 1 : 0;
    oval(c, X - 1.6, IMP_FOOT - 0.6 - up * 0.6 - tuck, 2.6, 1.15, 0, FUR_FAR);
    c.part();
    oval(c, X + 2.6 + L * 0.3, IMP_FOOT - 0.5 - up * 0.5, 2.8, 1.2, 0, FUR_WHITE);
    c.px(X + 5, IMP_FOOT - 0.6 - up * 0.5, HORN);
  }

  // The fluffy body and its snowy belly, ruffled at the edges.
  c.part();
  oval(c, X - 0.4 + L * 0.4, bodyY, 4.8, 4.6 - crouch * 0.4, L * 0.15, FUR_WHITE);
  c.part();
  oval(c, X + 1.4 + L * 0.5, bodyY + 0.8, 2.8, 3.2, 0, SNOW);
  for (let a = 0; a < 12; a++) {
    const ang = Math.PI * 0.55 + (a / 12) * Math.PI * 1.1;
    if (hash2(a, 2, 9) < 0.45) continue;
    c.px(X - 0.4 + Math.cos(ang) * 5.2, bodyY + Math.sin(ang) * 4.9, FUR_WHITE, sphere(Math.cos(ang), -Math.sin(ang)));
  }

  // The head: round and furry, an ice-blue face.
  c.part();
  const HX = X + 1.2 + L;
  oval(c, HX, headY, 5.1, 4.3, 0, FUR_WHITE);
  // Cheek tufts sticking out.
  c.part();
  blade(c, HX - 3.4, headY + 1.6, HX - 6.4, headY + 3.6, 1.1, FUR_WHITE);
  c.part();
  oval(c, HX + 2.5, headY + 0.5, 3.1, 2.8, 0, IMP_FACE);
  // A little horn of ice on its brow.
  c.part();
  crystal(c, HX + 1.2, headY - 3.6, HX + 2.8, headY - 7, 0.9, ICE, C_WHITE);
  // Green aurora eyes, slanted mischief; a furry brow over them.
  c.part();
  if (!p.blink) {
    c.px(HX + 1.6, headY - 0.6, GLOW_AURORA);
    c.px(HX + 2.6, headY - 1.4, GLOW_AURORA, { x: 0, y: 0, z: 1 }, { glow: 0.7 });
    c.px(HX + 2.6, headY - 0.6, HOLLOW);
    c.px(HX + 4.3, headY - 1.3, GLOW_AURORA, { x: 0, y: 0, z: 1 }, { glow: 0.7 });
    c.px(HX + 4.3, headY - 0.5, HOLLOW);
  } else {
    c.px(HX + 1.8, headY - 0.4, HOLLOW);
    c.px(HX + 2.8, headY - 0.6, HOLLOW);
    c.px(HX + 4.5, headY - 0.6, HOLLOW);
  }
  c.px(HX + 1.4, headY - 1.6, FUR_WHITE, sphere(0, 0.8));
  c.px(HX + 2.4, headY - 2.2, FUR_WHITE, sphere(0, 0.8));
  // A crooked grin with one fang.
  const gy = headY + 1.6;
  c.px(HX + 2, gy, HOLLOW);
  c.px(HX + 3, gy + 0.6, HOLLOW);
  c.px(HX + 4, gy + 0.4, HOLLOW);
  c.px(HX + 4.8, gy - 0.2, HOLLOW);
  if (p.grin) {
    c.px(HX + 3, gy + 1.4, HOLLOW);
    c.px(HX + 4, gy + 1.2, HOLLOW);
    c.px(HX + 2.2, gy + 1, HOLLOW);
  }
  c.px(HX + 3.4, gy + 1.2 + (p.grin ? 0.8 : 0), IVORY, sphere(0, 0.5));
  // A nose.
  c.px(HX + 5.4, headY + 0.2, IMP_FACE, sphere(0.5, 0.6));

  // The near ear: long and pointed, violet inside, tipped with ice.
  c.part();
  const ex0 = HX - 1.2;
  const ey0 = headY - 2;
  const etx = HX - 7.6 - ears * 1 + t * 0.2;
  const ety = headY - 7.4 + ears * 4.4;
  blade(c, ex0, ey0, etx, ety, 2.1, FUR_WHITE);
  c.part();
  blade(c, ex0 + (etx - ex0) * 0.1, ey0 + (ety - ey0) * 0.1 + 0.4, ex0 + (etx - ex0) * 0.7, ey0 + (ety - ey0) * 0.7 + 0.4, 0.9, EAR_IN);
  c.part();
  crystal(c, ex0 + (etx - ex0) * 0.72, ey0 + (ety - ey0) * 0.72, etx - (etx - ex0) * 0.12, ety - (ety - ey0) * 0.12, 1, ICE, C_ICE);

  // Near arm.
  c.part();
  const ax = X + 0.4;
  const ay = shY - 0.2;
  let hand: [number, number];
  if (p.arm === 'rest') {
    limb(c, [[ax, ay], [ax + 1.6, ay + 2], [ax + 3, ay + 3.4]], 1.1, 0.9, FUR_WHITE);
    hand = [ax + 3, ay + 3.4];
  } else if (p.arm === 'wind') {
    limb(c, [[ax, ay], [ax - 2.2, ay - 3.2], [ax - 3.2, ay - 6.6]], 1.1, 0.9, FUR_WHITE);
    hand = [ax - 3.2, ay - 6.6];
  } else if (p.arm === 'throw') {
    limb(c, [[ax, ay], [ax + 3, ay - 1.4], [ax + 6, ay - 2.6]], 1.1, 0.9, FUR_WHITE);
    hand = [ax + 6, ay - 2.6];
  } else {
    limb(c, [[ax, ay], [ax + 1.6, ay - 3], [ax + 2.6, ay - 6.4]], 1.1, 0.9, FUR_WHITE);
    hand = [ax + 2.6, ay - 6.4];
  }
  c.px(hand[0] + 1, hand[1], HORN);
  // The snowball held up, ready.
  if (p.arm === 'wind') {
    c.part();
    c.ellipse(hand[0] - 0.6, hand[1] - 2.2, 2.4, 2.3, SNOW);
    c.spark(hand[0] - 1.4, hand[1] - 3, C_WHITE, 0.4);
  }
  if (p.arm === 'throw') {
    const R = rng(p.seed * 5 + 1);
    for (let i = 0; i < 4; i++) c.spark(hand[0] + 2 + R() * 3, hand[1] - 1 + R() * 3, C_WHITE, 0.4 + R() * 0.3);
  }
  return c;
}

/** A drift of snow heaped over it, churning as it moves: its ear tips poke out, now and then its eyes. */
function drift(f: number, size = 1, eyes = false): PixelCanvas {
  const { w, h } = MONSTER_FRAME.flurrykin;
  const c = new PixelCanvas(w, h);
  const cx = 12;
  const R = rng(f * 11 + 2);
  // Ear tips poking out of the top, twitching.
  c.part();
  const tw = f % 2;
  const top = IMP_FOOT - 5.6 * size;
  if (size > 0.7) {
    blade(c, cx + 2.2, top + 1.6, cx + 0.6 + tw * 0.4, top - 3 - tw * 0.4, 1.1, FUR_FAR);
    blade(c, cx, top + 2, cx - 3.4 - tw * 0.6, top - 3.8 + tw * 0.4, 1.4, FUR_WHITE);
    c.part();
    crystal(c, cx - 2.4, top - 1.6 + tw * 0.2, cx - 3.4 - tw * 0.6, top - 3.8 + tw * 0.4, 0.8, ICE, C_ICE);
  }
  // The heap: a broad drift with lumps that shift as it churns.
  c.part();
  oval(c, cx, IMP_FOOT - 1.6 * size, 8.4 * size, 3.4 * size, 0, SNOW, (_lx, ly) => (ly > 0.55 ? -1 : 0));
  c.part();
  oval(c, cx - 3 + tw * 0.6, IMP_FOOT - 3 * size, 3.4 * size, 2.3 * size, 0, SNOW);
  c.part();
  oval(c, cx + 2.6 - tw * 0.6, IMP_FOOT - 3.4 * size, 3.6 * size, 2.6 * size, 0, SNOW);
  // Crumbs of snow thrown off its front and sides.
  c.part();
  for (let i = 0; i < 4; i++) c.px(cx + 8 * size + R() * 3, IMP_FOOT - 1 - R() * 3, i % 2 ? RIME : SNOW, sphere(0, 0.6));
  for (let i = 0; i < 2; i++) c.px(cx - 8 * size - R() * 2, IMP_FOOT - 1 - R() * 2, SNOW, sphere(0, 0.6));
  // Eyes peeking out of the snow.
  if (eyes) {
    c.part();
    c.px(cx + 2, top + 1.8, HOLLOW);
    c.px(cx + 3, top + 1.8, HOLLOW);
    c.px(cx + 4.4, top + 1.8, HOLLOW);
    c.px(cx + 2.6, top + 1.4, GLOW_AURORA);
    c.px(cx + 4.4, top + 1.4, GLOW_AURORA);
  }
  for (let i = 0; i < 3; i++) c.spark(cx - 6 + R() * 12, IMP_FOOT - 5 * size - R() * 4, C_WHITE, 0.3 + R() * 0.3);
  return c;
}

/** Halfway into the snow, head first: its rear, feet and tail kicking up out of a little drift. */
function diving(f: number): PixelCanvas {
  const { w, h } = MONSTER_FRAME.flurrykin;
  const c = new PixelCanvas(w, h);
  const cx = 12;
  const deep = f;
  // The tail, waving up.
  c.part();
  limb(c, [[cx - 2, 16 + deep * 3], [cx - 4.5, 13 + deep * 3], [cx - 5, 9.4 + deep * 3]], 0.9, 0.6, FUR_WHITE);
  c.ellipse(cx - 5, 8.4 + deep * 3, 1.7, 1.6, SNOW);
  c.spark(cx - 5, 8.4 + deep * 3, C_AURORA, 0.5);
  // The rump, upside down, and its big feet kicking up.
  if (deep < 1) {
    c.part();
    oval(c, cx + 0.6, 17.4, 4.4, 3.8, 0.4, FUR_WHITE);
  }
  c.part();
  oval(c, cx - 0.6, 12.6 + deep * 4.4, 1.2, 2.5, 0.3, FUR_FAR);
  c.part();
  oval(c, cx + 2.6, 13 + deep * 4.6, 1.3, 2.6, -0.25, FUR_WHITE);
  // The drift it is diving into, and the snow it throws up.
  c.part();
  oval(c, cx + 1, IMP_FOOT - 1.6, 7 + deep * 1.2, 3 + deep * 0.4, 0, SNOW, (_lx, ly) => (ly > 0.55 ? -1 : 0));
  c.part();
  oval(c, cx + 3.6, IMP_FOOT - 3, 3.2, 2, 0, SNOW);
  const R = rng(f * 13 + 9);
  c.part();
  for (let i = 0; i < 6; i++) c.px(cx - 6 + R() * 14, IMP_FOOT - 5 - R() * 7, i % 3 ? SNOW : RIME, sphere(0, 0.5));
  for (let i = 0; i < 5; i++) c.spark(cx - 7 + R() * 14, 8 + R() * 10, C_WHITE, 0.3 + R() * 0.4);
  return c;
}

/** Bursting up out of the drift, snow flying. */
function popping(f: number): PixelCanvas {
  const c = f === 0 ? flurrykin({ arm: 'up', sink: 6, ears: 0.6, grin: true, seed: 40 }) : flurrykin({ arm: 'up', hop: 2, grin: true, seed: 41, tail: -1 });
  const cx = 12;
  // What's left of the drift, scattered flat.
  c.part();
  if (f === 0) {
    oval(c, cx, IMP_FOOT - 2.2, 9, 3.2, 0, SNOW, (_lx, ly) => (ly > 0.55 ? -1 : 0));
    c.part();
    oval(c, cx + 4, IMP_FOOT - 3.6, 3, 2, 0, SNOW);
    c.part();
    oval(c, cx - 4, IMP_FOOT - 3.4, 3, 2, 0, SNOW);
  } else {
    oval(c, cx - 4.6, IMP_FOOT - 0.6, 3, 1.2, 0, SNOW);
    c.part();
    oval(c, cx + 6.4, IMP_FOOT - 0.6, 2.6, 1.1, 0, SNOW);
  }
  const R = rng(f * 7 + 30);
  c.part();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.1 + R() * 0.8);
    const r = 6 + R() * 6 + f * 2;
    c.px(cx + Math.cos(a) * r, IMP_FOOT - 6 + Math.sin(a) * r * 0.9, i % 3 ? SNOW : RIME, sphere(0, 0.5));
  }
  for (let i = 0; i < 6; i++) c.spark(cx - 9 + R() * 18, 3 + R() * 14, C_WHITE, 0.35 + R() * 0.45);
  return c;
}

export function buildFlurrykinSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  const bounce = [0, 0.5, 0.8, 0.5];
  const tail = [0, 0.8, 1.2, 0.6];
  [0, 1, 2, 3].forEach((i) => (poses[`idle${i}`] = () => flurrykin({ arm: 'rest', hop: bounce[i] - 0.4, tail: tail[i], blink: i === 3, ears: i === 1 ? 0.25 : 0, seed: i })));
  // A skipping hop: crouch, spring, float, land.
  const hops = [-1, 1.6, 2.6, 0.6];
  [0, 1, 2, 3].forEach((i) => (poses[`walk${i}`] = () => flurrykin({ arm: 'rest', hop: hops[i], tail: -tail[i], ears: i === 2 ? 0.6 : 0.2, lean: 0.4, seed: i + 4 })));
  poses.wind0 = () => flurrykin({ arm: 'wind', lean: -0.8, hop: -0.6, tail: 1, grin: true, seed: 10 });
  poses.wind1 = () => flurrykin({ arm: 'wind', lean: -1.4, hop: -1, tail: 1.4, grin: true, ears: 0.3, seed: 11 });
  poses.throw = () => flurrykin({ arm: 'throw', lean: 1.4, hop: 0.4, tail: -1, ears: 0.5, seed: 12 });
  poses.dive0 = () => flurrykin({ arm: 'rest', hop: -1.6, lean: 1, ears: 1, seed: 13 });
  poses.dive1 = () => diving(0);
  poses.dive2 = () => diving(1);
  [0, 1, 2, 3].forEach((i) => (poses[`mound${i}`] = () => drift(i, 1, i === 2)));
  poses.pop0 = () => popping(0);
  poses.pop1 = () => popping(1);
  return sheet(MONSTER_FRAME.flurrykin, poses, [
    { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle3'], fps: 6, loop: true },
    { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 10, loop: true },
    { name: 'windup', frames: ['wind0', 'wind1'], fps: 5, loop: false },
    { name: 'dive', frames: ['dive0', 'dive0', 'dive1', 'dive2'], fps: 9, loop: false },
    { name: 'mound', frames: ['mound0', 'mound1', 'mound2', 'mound3'], fps: 8, loop: true },
    { name: 'pop', frames: ['pop0', 'pop1', 'pop1'], fps: 8, loop: false },
  ]);
}

// ---------------------------------------------------------------- Spells

/** The rimeweaver's glob of frozen silk (lit, frame 'g'). */
export const FW_GLOB = 12;
/** The web it leaves on the floor (plain colour, drawn a little see-through). */
export const FW_WEB_W = 48;
export const FW_WEB_H = 26;

function webGlob(): PixelCanvas {
  const c = new PixelCanvas(FW_GLOB, FW_GLOB);
  // Strands trailing off it, then the ball of silk, a violet heart.
  c.part();
  for (const [dx, dy] of [[-4.6, -1.6], [-4.4, 2], [4, 3.6], [-1, -4.6]] as const) c.line(6, 6, 6 + dx, 6 + dy, SILK, () => ({ x: -0.2, y: 0.5, z: 0.8 }));
  c.part();
  c.ellipse(6, 6, 3.6, 3.4, SILK);
  c.part();
  for (const [x, y] of [[5, 5], [7, 7], [4, 7]] as const) c.shade(x, y, -1);
  c.px(6, 6, GLOW_VIOLET);
  c.spark(6, 6, C_VIOLET, 0.6);
  c.spark(4, 4, C_WHITE, 0.6);
  return c;
}

/**
 * The web on the floor: eight spokes from the middle, threads strung
 * between them in rings, beads of frost on the crossings. Seen from above,
 * so half as deep as it is wide.
 */
function webFloor(): Uint8ClampedArray {
  const w = FW_WEB_W;
  const h = FW_WEB_H;
  const px = new Uint8ClampedArray(w * h * 4);
  // Off the pixel grid a touch, so the upright and level spokes come out one pixel wide.
  const cx = w / 2 + 0.3;
  const cy = h / 2 + 0.3;
  const RX = w / 2 - 1;
  const RY = h / 2 - 1;
  const set = (x: number, y: number, r: number, g: number, b: number, a: number) => {
    const i = (y * w + x) * 4;
    if (px[i + 3] >= a) return;
    px.set([r, g, b, a], i);
  };
  const N = 8;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - cx) / RX;
      const v = (y + 0.5 - cy) / RY;
      const r = Math.hypot(u, v);
      if (r > 1) continue;
      const a = Math.atan2(v, u);
      const s = (a / (Math.PI * 2)) * N;
      const off = s - Math.round(s);
      // Spokes: thin in screen pixels however far out.
      const spoke = Math.abs(off) * (Math.PI * 2 / N) * r * RX < 0.55 && r > 0.06;
      // Rings: straight threads between spokes, sagging a little.
      const rel = Math.abs(off) * (Math.PI * 2 / N);
      let ring = false;
      let bead = false;
      // How many screen pixels one unit of r spans here (wider at the sides than top and bottom).
      const scale = Math.hypot(u * RX, v * RY) / Math.max(0.001, r);
      for (const ri of [0.3, 0.58, 0.86]) {
        const rp = (ri / Math.cos(rel)) * (1 - 0.06 * Math.cos(rel * N * 0.5));
        const d = Math.abs(r - rp) * scale;
        if (d < 0.5) ring = true;
        if (d < 0.9 && Math.abs(off) * (Math.PI * 2 / N) * r * RX < 0.9) bead = true;
      }
      if (bead) set(x, y, 255, 255, 255, 255);
      else if (spoke || ring) set(x, y, 222, 228, 255, Math.round(210 - r * 70));
      else if (r < 0.95 && bayer(x, y) < 0.08 * (1 - r)) set(x, y, 180, 170, 240, 90);
    }
  }
  return px;
}

export function frostWeakFx(r: FxRegistrar): void {
  r.frames('fw_glob', [{ name: 'g', canvas: webGlob() }], FW_GLOB, FW_GLOB);
  r.image('fw_web', FW_WEB_W, FW_WEB_H, webFloor());
}
