// The first monsters, drawn procedurally like the heroes: a magical blue
// frog that spits sparkly venom, a golden rhinoceros beetle that charges, and
// the puffcap, a glowing mushroom that bursts into spores. Each is drawn
// facing right and mirrored for left, so every frame comes as `<pose>_r` and
// `<pose>_l`.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#0b0a1a');

// Frog: deep sea-blue skin with a pale belly, glowing gold eyes and star spots.
const FROG: Material = { ramp: ramp('#0e1648', '#18307e', '#2356b8', '#3a8ae6', '#7cc8ff'), outline: INK, outlineLit: hex('#16205a'), shine: true };
const FROG_DARK: Material = { ramp: ramp('#0b1238', '#142868', '#1e4498', '#2c6cc8'), outline: INK };
const FROG_BELLY: Material = { ramp: ramp('#23507a', '#4a90b8', '#94d8ec', '#e2fbff'), outline: INK };
const FROG_EYE: Material = { ramp: ramp('#a86a10', '#f0b030', '#ffe07a', '#fffbe0'), outline: INK, emissive: 0.55, shine: true, noAO: true };
const PUPIL: Material = { ramp: ramp('#06050e', '#06050e'), outline: INK, noAO: true };
const MOUTH: Material = { ramp: ramp('#1a0620', '#3a0e3a'), outline: INK, noAO: true };
/** The throat sac, glowing as venom gathers. */
const SAC: Material = { ramp: ramp('#2a8a4a', '#58d070', '#b6ffa0', '#f4fff0'), outline: hex('#0c2a1c'), noAO: true };

export const VENOM_CORE = hex('#f4fff0');
export const VENOM_HOT = hex('#b6ffa0');
export const VENOM_MID = hex('#4fe08a');
export const VENOM_DEEP = hex('#1f8a6a');
const STAR = hex('#dff8ff');
const STAR_BLUE = hex('#7cdcff');

// Beetle: polished gold elytra, a bronze collar, blue-black chitin, ember eyes.
const SHELL: Material = { ramp: ramp('#3a2008', '#7a4614', '#c0862a', '#f0c650', '#fff3b0'), outline: hex('#1c0e06'), outlineLit: hex('#3a220c'), shine: true };
const BRONZE: Material = { ramp: ramp('#2c1608', '#5a3212', '#8e5a22', '#c48a3a'), outline: hex('#1c0e06'), shine: true };
const CHITIN: Material = { ramp: ramp('#0a0a16', '#16162a', '#262a44', '#3e4466'), outline: INK, shine: true };
const BEETLE_EYE: Material = { ramp: ramp('#8a1a10', '#e04a1a', '#ffb050', '#fff0c0'), outline: INK, emissive: 0.8, noAO: true };
const WING = hex('#fff4d0');

// Puffcap: a violet cap with teal glowing spots over a stubby cream stem.
const CAP: Material = { ramp: ramp('#240c34', '#46185a', '#6e2882', '#9c42a4', '#cc6cc4'), outline: hex('#120616'), outlineLit: hex('#2c0e36') };
const GILL: Material = { ramp: ramp('#3a1a30', '#6a3450', '#9a5a70'), outline: hex('#120616') };
const STEM: Material = { ramp: ramp('#4a3a48', '#86707c', '#c4aea8', '#eee0d0'), outline: hex('#18101a'), outlineLit: hex('#2e2230') };
const SPOT: Material = { ramp: ramp('#1f8a86', '#4fd8c8', '#aefff0', '#f0fffc'), outline: hex('#120616'), emissive: 0.85, noAO: true };
const PUFF_EYE: Material = { ramp: ramp('#0a0610', '#0a0610'), outline: INK, noAO: true };
const SPORE_RGB = hex('#aefff0');
export const SPORE_COLS = [0xaefff0, 0x6ff0e0, 0xe6b8ff, 0xffffff];

/** Frame size and feet position of each monster's frames. */
export const MONSTER_FRAME = {
  frog: { w: 22, h: 18, ox: 11, oy: 16 },
  beetle: { w: 30, h: 22, ox: 14, oy: 20 },
  puffcap: { w: 20, h: 22, ox: 10, oy: 20 },
  barkling: { w: 28, h: 32, ox: 14, oy: 30 },
  glowmoth: { w: 26, h: 22, ox: 13, oy: 21 },
  warden: { w: 96, h: 116, ox: 48, oy: 113 },
  wisp: { w: 20, h: 24, ox: 10, oy: 22 },
  shade: { w: 30, h: 36, ox: 14, oy: 34 },
  banshee: { w: 28, h: 38, ox: 14, oy: 36 },
  queen: { w: 72, h: 84, ox: 36, oy: 81 },
};
export type FrameBox = (typeof MONSTER_FRAME)[keyof typeof MONSTER_FRAME];

export interface MonsterSheet {
  w: number;
  h: number;
  /** Feet in the frame. */
  originX: number;
  originY: number;
  frames: { name: string; canvas: PixelCanvas }[];
  anims: { name: string; frames: string[]; fps: number; loop: boolean }[];
}

/** Every pose, drawn facing right and mirrored. */
export function sheet({ w, h, ox: originX, oy: originY }: FrameBox, poses: Record<string, () => PixelCanvas>, anims: { name: string; frames: string[]; fps: number; loop: boolean }[]): MonsterSheet {
  const frames: MonsterSheet['frames'] = [];
  for (const [name, draw] of Object.entries(poses)) {
    const c = draw();
    frames.push({ name: `${name}_r`, canvas: c });
    frames.push({ name: `${name}_l`, canvas: c.mirrored() });
  }
  return { w, h, originX, originY, frames, anims };
}

// ---------------------------------------------------------------- Frog

interface FrogPose {
  /** Body raised (breathing, airborne). */
  lift?: number;
  /** Wider and flatter (crouching) or longer (leaping). */
  squash?: number;
  leap?: boolean;
  /** 0..1 throat sac swelling with venom. */
  throat?: number;
  mouth?: boolean;
  blink?: boolean;
}

function frog(p: FrogPose): PixelCanvas {
  const c = new PixelCanvas(22, 18);
  const lift = p.lift ?? 0;
  const sq = p.squash ?? 0;
  const by = 10.5 - lift;

  // Far legs, behind the body.
  c.part();
  if (p.leap) {
    c.capsule(6, by + 1, 1.5, by + 4, 1.4, 0.8, FROG_DARK);
    c.capsule(1.5, by + 4, 0.5, by + 5, 0.8, 0.7, FROG_DARK);
  } else {
    c.ellipse(6.5, 13 - lift * 0.5, 3.4, 2.6, FROG_DARK);
    c.capsule(4, 16, 8.5, 16, 0.9, 0.8, FROG_DARK);
  }

  // Body and head.
  c.part();
  c.ellipse(10, by, 6.2 + sq, 4.3 - sq * 0.5, FROG);
  c.part();
  c.ellipse(14.5, by - 1.5, 4.2 + sq * 0.4, 3.3 - sq * 0.3, FROG);
  // Pale belly and chin.
  c.part();
  c.ellipse(13, by + 2.3, 4.2, 1.9, FROG_BELLY, { flatten: 0.6 });

  // Near back thigh, folded against the body.
  c.part();
  if (!p.leap) {
    c.ellipse(7.5, 13.2 - lift * 0.5, 3, 2.3, FROG);
    c.capsule(6.5, 16, 11, 16, 1, 0.8, FROG_DARK);
  }
  // Front leg.
  c.part();
  if (p.leap) c.capsule(15, by + 2, 19, by + 3.5, 1.1, 0.8, FROG);
  else {
    c.capsule(15, by + 2, 15.5, 15.5, 1.1, 0.9, FROG);
    c.px(16, 16, FROG_DARK, sphere(0.5, 0.3));
    c.px(17, 16, FROG_DARK, sphere(0.8, 0.3));
  }

  // Throat sac, swelling and glowing as venom gathers.
  const t = p.throat ?? 0;
  if (t > 0) {
    c.part();
    c.ellipse(16.5, by + 1.8, 1.4 + t * 2, 1.1 + t * 1.5, SAC, { glow: 0.3 + t * 0.6 });
  }

  // Mouth: a thin line, or open and glowing green.
  c.part();
  if (p.mouth) {
    for (let x = 16; x <= 18; x++) c.px(x, by, MOUTH);
    c.px(18, by + 1, MOUTH);
    c.spark(18, by, VENOM_HOT, 0.9);
    c.spark(17, by, VENOM_MID, 0.6);
  } else {
    for (let x = 16; x <= 18; x++) c.shade(x, by - 0.5, -2);
  }

  // Bulging eyes on top of the head, gold and faintly glowing.
  c.part();
  const ey = by - 4.6;
  if (p.blink) {
    c.shape(Math.round(ey), Math.round(ey), () => [12, 15.5], FROG, (_x, _y, tt) => cyl(tt, 0.4));
    c.shape(Math.round(ey + 0.4), Math.round(ey + 0.4), () => [15.6, 18], FROG, (_x, _y, tt) => cyl(tt, 0.4));
  } else {
    c.ellipse(13.8, ey, 1.9, 1.8, FROG_EYE);
    c.ellipse(16.8, ey + 0.4, 1.5, 1.6, FROG_EYE);
    c.part();
    c.px(14, ey + 0.2, PUPIL);
    c.px(17, ey + 0.6, PUPIL);
  }

  // Star spots along the back: the frog's magic.
  for (const [x, y, k] of [
    [7, by - 3, 1],
    [10, by - 3.5, 0.8],
    [5, by - 1, 0.6],
    [9, by - 1.5, 0.45],
    [12.5, by - 3.2, 0.5],
  ] as const) {
    c.spark(x, y, k > 0.7 ? STAR : STAR_BLUE, k);
  }
  return c;
}

export function buildFrogSheet(): MonsterSheet {
  return sheet(
    MONSTER_FRAME.frog,
    {
      idle0: () => frog({}),
      idle1: () => frog({ lift: 0.5, throat: 0.15 }),
      blink: () => frog({ blink: true }),
      crouch: () => frog({ lift: -1, squash: 0.8 }),
      leap: () => frog({ lift: 1, squash: -0.4, leap: true }),
      spit0: () => frog({ throat: 0.45 }),
      spit1: () => frog({ throat: 1, lift: 0.5 }),
      spit2: () => frog({ mouth: true, lift: -0.5, squash: 0.4 }),
    },
    [
      { name: 'idle', frames: ['idle0', 'idle0', 'idle1', 'idle1', 'idle0', 'blink'], fps: 4, loop: true },
      { name: 'windup', frames: ['spit0', 'spit1'], fps: 3.5, loop: false },
      { name: 'spit', frames: ['spit2', 'spit2', 'idle0'], fps: 9, loop: false },
    ],
  );
}

// ---------------------------------------------------------------- Beetle

interface BeetlePose {
  /** Walk phase: which pair of legs is forward. */
  step?: number;
  /** Head lowered and horn glowing, ready to charge. */
  brace?: number;
  fly?: number;
  dazed?: boolean;
}

function beetle(p: BeetlePose): PixelCanvas {
  const c = new PixelCanvas(30, 22);
  const brace = p.brace ?? 0;
  const flying = p.fly !== undefined;
  const cy = 10.5;

  // Legs: three a side. Far legs first, dark, behind the body.
  const legs = (near: boolean) => {
    const base = near ? 15 : 13.5;
    const foot = near ? 19.5 : 17.5;
    const xs = [8, 13, 18];
    xs.forEach((x, i) => {
      if (flying) {
        c.capsule(x, base, x - 1, base + 1.5, 0.8, 0.6, CHITIN);
        return;
      }
      const swing = p.dazed ? (i - 1) * 2 : ((i + (near ? 0 : 1) + (p.step ?? 0)) % 2 === 0 ? 1.2 : -1.2) + brace * (i - 1) * 0.8;
      c.capsule(x, base, x + swing + (i - 1) * 1.5, foot, 0.9, 0.7, CHITIN);
    });
  };
  c.part();
  legs(false);

  // Wings: a blur of light fanned behind the lifted wing cases.
  if (flying) {
    const f = p.fly ?? 0;
    for (let i = 0; i < 16; i++) {
      const a = (-150 + i * (f ? 7 : 5) + (f ? 20 : 0)) * (Math.PI / 180);
      const len = 6 + (i % 3) * 1.5;
      for (let r = 2; r < len; r++) c.spark(9 + Math.cos(a) * r, 6 + Math.sin(a) * r * 0.6, WING, 0.18 + (r / len) * 0.12);
    }
  }

  // Wing cases: a big polished dome with a seam down the middle.
  c.part();
  const lift = flying ? 1.5 : 0;
  c.ellipse(12, cy - lift + brace * 0.5, 9, 6.2, SHELL);
  for (let x = 4; x <= 19; x++) {
    const u = (x - 12) / 9;
    c.shade(x, cy - 1.5 - lift + brace * 0.5 + u * u * 1.5, -2);
  }
  if (flying) {
    // The cases tilt open: their trailing edge lifts away from the body.
    c.part();
    c.ellipse(6, cy - 3.5, 4, 2.2, SHELL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy - 0.4) });
  }

  // Bronze collar and dark head, lowered when bracing to charge.
  c.part();
  c.ellipse(19.5, cy + 0.5 + brace * 0.5, 4.2, 4.4, BRONZE);
  c.part();
  const hx = 23.5;
  const hy = cy + 2 + brace;
  c.ellipse(hx, hy, 3.1, 2.6, CHITIN);
  // The horn curves up and forward; it glows hot when bracing.
  c.part();
  c.capsule(hx + 1.5, hy - 1.5, hx + 4.5 - brace * 0.5, hy - 6 + brace * 1.5, 1.4, 0.7, SHELL, { glow: brace * 0.7 });
  c.px(hx + 5 - brace * 0.5, hy - 6.5 + brace * 1.5, SHELL, sphere(0.5, -0.5), { glow: brace * 0.9 });
  // Mandibles and the ember eye.
  c.part();
  c.px(hx + 3, hy + 1.5, CHITIN, sphere(0.6, 0.4));
  c.px(hx + 4, hy + 1.5, CHITIN, sphere(0.8, 0.4));
  if (!p.dazed) c.px(hx + 1, hy - 0.5, BEETLE_EYE, sphere(0.2, -0.2), { glow: 0.7 + brace * 0.3 });
  else c.px(hx + 1, hy - 0.5, CHITIN);

  // Near legs, in front of the body.
  c.part();
  legs(true);
  return c;
}

export function buildBeetleSheet(): MonsterSheet {
  return sheet(
    MONSTER_FRAME.beetle,
    {
      walk0: () => beetle({ step: 0 }),
      walk1: () => beetle({ step: 1 }),
      brace0: () => beetle({ brace: 0.5, step: 0 }),
      brace1: () => beetle({ brace: 1, step: 1 }),
      fly0: () => beetle({ fly: 0 }),
      fly1: () => beetle({ fly: 1 }),
      dazed: () => beetle({ dazed: true }),
    },
    [
      { name: 'idle', frames: ['walk0'], fps: 1, loop: true },
      { name: 'walk', frames: ['walk0', 'walk1'], fps: 6, loop: true },
      { name: 'windup', frames: ['brace0', 'brace1', 'brace0', 'brace1'], fps: 10, loop: true },
      { name: 'fly', frames: ['fly0', 'fly1'], fps: 20, loop: true },
      { name: 'dazed', frames: ['dazed'], fps: 1, loop: true },
    ],
  );
}

// ---------------------------------------------------------------- Puffcap

interface PuffPose {
  bob?: number;
  /** Which foot is forward while waddling, or 0. */
  waddle?: number;
  /** 0..1 cap swelling with spores. */
  swell?: number;
  /** The cap squashed flat right after bursting. */
  burst?: boolean;
}

function puffcap(p: PuffPose): PixelCanvas {
  const c = new PixelCanvas(20, 22);
  const s = p.swell ?? 0;
  const bob = p.bob ?? 0;
  const w = p.waddle ?? 0;

  // Feet.
  c.part();
  c.ellipse(7.5 + w, 20, 2, 1.2, STEM);
  c.ellipse(12.5 - w, 20, 2, 1.2, STEM);

  // Stem body, a little wider at the base.
  c.part();
  const top = 12 + bob;
  c.shape(top, 19, (y) => {
    const u = (y - top) / (19 - top);
    const half = 3.3 + u * 0.8;
    return [10 - half + w * 0.3, 10 + half + w * 0.3];
  }, STEM, (_x, _y, t) => cyl(t, 0.1));
  // Sleepy little face.
  c.part();
  c.px(8 + w * 0.3, 15 + bob, PUFF_EYE);
  c.px(12 + w * 0.3, 15 + bob, PUFF_EYE);
  c.shade(10 + w * 0.3, 17 + bob, -1);

  // Gills under the cap.
  c.part();
  const flat = p.burst ? 1 : 0;
  const rx = 8.5 + s * 1.5 + flat * 1.5;
  const ry = 5.5 + s * 1.2 - flat * 2;
  const capY = 11 + bob + flat;
  c.ellipse(10, capY + 0.5, rx - 1, 1.6, GILL, { flatten: 0.5 });
  // The dome: the top of an ellipse.
  c.part();
  c.shape(Math.round(capY - ry), Math.round(capY), (y) => {
    const d = (y + 0.5 - capY) / ry;
    if (d * d > 1) return null;
    const half = rx * Math.sqrt(1 - d * d);
    return [10 - half, 10 + half];
  }, CAP, (x, y) => sphere((x + 0.5 - 10) / rx, (y + 0.5 - capY) / ry, 0.9));
  // Glowing spots, brighter as it swells.
  c.part();
  const glow = 0.6 + s * 0.4;
  for (const [x, y, r] of [
    [6.5, -3.2, 1.3],
    [11, -4.4, 1.5],
    [14.2, -2, 1.1],
    [9, -1.4, 0.9],
  ] as const) {
    c.ellipse(10 + (x - 10) * (rx / 8.5), capY + y * (ry / 5.5), r + s * 0.3, r * 0.85 + s * 0.2, SPOT, { glow });
  }
  if (s > 0.5 || p.burst) {
    for (let i = 0; i < 6; i++) c.spark(3 + ((i * 7) % 15), capY - ry - 1 + (i % 2), SPORE_RGB, 0.6);
  }
  return c;
}
export function buildPuffcapSheet(): MonsterSheet {
  return sheet(
    MONSTER_FRAME.puffcap,
    {
      idle0: () => puffcap({}),
      idle1: () => puffcap({ bob: 1 }),
      walk0: () => puffcap({ waddle: 1 }),
      walk1: () => puffcap({ waddle: -1, bob: 1 }),
      swell0: () => puffcap({ swell: 0.5 }),
      swell1: () => puffcap({ swell: 1 }),
      burst: () => puffcap({ burst: true }),
    },
    [
      { name: 'idle', frames: ['idle0', 'idle1'], fps: 2.5, loop: true },
      { name: 'walk', frames: ['walk0', 'idle1', 'walk1', 'idle1'], fps: 7, loop: true },
      { name: 'windup', frames: ['swell0', 'swell1', 'swell0', 'swell1'], fps: 7, loop: true },
      { name: 'burst', frames: ['burst', 'burst', 'idle0'], fps: 6, loop: false },
    ],
  );
}

// ---------------------------------------------------------------- Barkling

// A stump come to life: bark body, root legs, twig arms, a crown of leaves
// and amber eyes glowing in its knot-hole face.
const BARK: Material = { ramp: ramp('#1e130c', '#352216', '#503422', '#6c4a32', '#8a6648'), outline: hex('#0f0906'), outlineLit: hex('#26180f') };
const HEARTWOOD: Material = { ramp: ramp('#0c0706', '#1a0f0a'), outline: hex('#0f0906'), noAO: true };
const CROWN: Material = { ramp: ramp('#132d1b', '#1d4226', '#2a5a30', '#3b753b', '#539046', '#72aa55'), outline: hex('#08150d'), outlineLit: hex('#18301c') };
const BLOSSOM: Material = { ramp: ramp('#8a3a6a', '#d06a9a', '#f6a8c8', '#fff0f6'), outline: hex('#2a0e1e'), noOutline: true };
const AMBER: Material = { ramp: ramp('#7a3a08', '#e08a1a', '#ffc85a', '#fff0b0'), outline: hex('#0f0906'), emissive: 0.9, noAO: true };
export const BARK_TINTS = [0x8a6648, 0x539046, 0xffc85a, 0x3b753b];

interface BarkPose {
  bob?: number;
  /** Which leg is forward, -1..1. */
  step?: number;
  /** Arms: 0 hanging, 1 raised overhead, -1 slammed into the ground. */
  arms?: number;
  /** Eyes' brightness, 0..1. */
  glare?: number;
}

function barkling(p: BarkPose): PixelCanvas {
  const c = new PixelCanvas(28, 32);
  const bob = p.bob ?? 0;
  const st = p.step ?? 0;
  const arms = p.arms ?? 0;
  const slam = arms < 0 ? -arms : 0;
  const top = 11 + bob + slam * 2;
  const cx = 14;

  // Root legs.
  c.part();
  c.capsule(cx - 3, top + 12, cx - 4 - st * 2, 29, 2.2, 1.6, BARK);
  c.capsule(cx + 3, top + 12, cx + 4 + st * 2, 29, 2.2, 1.6, BARK);
  c.px(cx - 6 - st * 2, 29, BARK, sphere(-0.6, 0.3));
  c.px(cx + 6 + st * 2, 29, BARK, sphere(0.6, 0.3));

  // Far arm, behind the body.
  const arm = (side: number, far: boolean) => {
    const sx = cx + side * 5;
    const sy = top + 6;
    let ex: number;
    let ey: number;
    if (slam) {
      ex = cx + side * 8;
      ey = 28;
    } else {
      ex = cx + side * (8 - arms * 2);
      ey = sy + 8 - arms * 17;
    }
    c.part();
    c.capsule(sx, sy, ex, ey, 1.8, 1.2, far ? { ...BARK, bias: -1 } : BARK);
    // Twig fingers.
    const fy = slam ? 0 : arms > 0.5 ? -1 : 1;
    c.line(ex, ey, ex + side * 2, ey + fy * 2, BARK, () => sphere(side * 0.5, -0.3));
    c.line(ex, ey, ex - side, ey + fy * 3, BARK, () => sphere(0, -0.3));
  };
  arm(-1, true);

  // Trunk body: a short, stout cylinder with furrowed bark.
  c.part();
  c.shape(top, top + 14, (y) => {
    const u = (y - top) / 14;
    const hw = 5.2 + Math.sin(u * Math.PI) * 0.8 + u * 0.6;
    return [cx - hw, cx + hw];
  }, BARK, (_x, _y, t) => cyl(t, 0.12));
  for (const [x, y0, len] of [
    [cx - 3, top + 1, 5],
    [cx + 2, top + 3, 6],
    [cx - 1, top + 9, 4],
    [cx + 4, top + 8, 5],
  ]) {
    for (let j = 0; j < len; j++) c.shade(x, y0 + j, -1);
  }
  // Knot-hole face with glowing eyes.
  c.part();
  const g = 0.55 + (p.glare ?? 0) * 0.45;
  c.px(cx - 2, top + 5, AMBER, sphere(0, 0), { glow: g });
  c.px(cx + 2, top + 5, AMBER, sphere(0, 0), { glow: g });
  c.px(cx - 1, top + 9, HEARTWOOD);
  c.px(cx, top + 9, HEARTWOOD);
  c.px(cx + 1, top + 9, HEARTWOOD);
  if ((p.glare ?? 0) > 0.5) c.px(cx, top + 10, HEARTWOOD);

  arm(1, false);

  // Crown of leaves, with a blossom or two.
  for (const [x, y, r] of [
    [cx - 4, top - 1, 4.2],
    [cx + 3.5, top - 1.5, 4.4],
    [cx, top - 4, 4.6],
    [cx - 1, top + 0.5, 3.6],
  ] as const) {
    c.part();
    c.ellipse(x, y, r, r * 0.8, CROWN);
  }
  c.part();
  c.px(cx + 3, top - 4, BLOSSOM, sphere(-0.3, -0.5));
  c.px(cx - 4, top - 2, BLOSSOM, sphere(-0.3, -0.5));
  return c;
}

export function buildBarklingSheet(): MonsterSheet {
  return sheet(
    MONSTER_FRAME.barkling,
    {
      idle0: () => barkling({}),
      idle1: () => barkling({ bob: 1 }),
      walk0: () => barkling({ step: 1 }),
      walk1: () => barkling({ step: -1, bob: 1 }),
      raise0: () => barkling({ arms: 0.6, glare: 0.6 }),
      raise1: () => barkling({ arms: 1, glare: 1, bob: -1 }),
      slam: () => barkling({ arms: -1, glare: 1 }),
    },
    [
      { name: 'idle', frames: ['idle0', 'idle1'], fps: 2, loop: true },
      { name: 'walk', frames: ['walk0', 'idle0', 'walk1', 'idle1'], fps: 5, loop: true },
      { name: 'windup', frames: ['raise0', 'raise1'], fps: 3, loop: false },
      { name: 'slam', frames: ['slam', 'slam', 'raise0', 'idle0'], fps: 6, loop: false },
    ],
  );
}

// ---------------------------------------------------------------- Glowmoth

// A big soft moth with lilac wings and glowing eye-spots. It flutters above
// the ground, so its frames leave room for the body to ride high.
const MOTH_WING: Material = { ramp: ramp('#2e2350', '#4a3c80', '#7462b0', '#a494dc', '#d6ccf6', '#f4f0ff'), outline: hex('#140e28'), outlineLit: hex('#2a2048') };
const MOTH_FUR: Material = { ramp: ramp('#4a3a2c', '#7a644c', '#a88e6c', '#d6c09a', '#f4e8cc'), outline: hex('#1a120c') };
const MOTH_SPOT: Material = { ramp: ramp('#1a8a7a', '#48d8c0', '#a8fff0', '#f0fffc'), outline: hex('#140e28'), emissive: 0.8, noAO: true, noOutline: true };
const MOTH_EYE: Material = { ramp: ramp('#06050e', '#1a1a3a', '#6a6aa0'), outline: hex('#06050e'), shine: true, noAO: true };
export const MOTH_TINTS = [0xd6ccf6, 0xa8fff0, 0x7462b0, 0xffffff];
const MOTH_DUST = hex('#c8fff4');

interface MothPose {
  /** Wing beat: 1 raised, 0 spread, -1 lowered. */
  beat: number;
  /** Swept back for a dive. */
  dive?: boolean;
  /** 0..1 eye-spots flaring before a dive. */
  flare?: number;
}

function glowmoth(p: MothPose): PixelCanvas {
  const c = new PixelCanvas(26, 22);
  const cx = 13;
  const cy = 11;
  const b = p.beat;
  const glow = 0.55 + (p.flare ?? 0) * 0.45;
  const wing = (side: number, hind: boolean) => {
    c.part();
    if (p.dive) {
      // Folded back along the body.
      const x = cx + side * (hind ? 3 : 4);
      c.ellipse(x, cy + (hind ? 3 : 0), hind ? 2.6 : 3, hind ? 3.2 : 4.2, MOTH_WING, { bias: hind ? -1 : 0 });
      return;
    }
    const reach = hind ? 7 : 10 - Math.abs(b) * 1.5;
    const x = cx + side * (2 + reach * 0.55);
    const y = cy + (hind ? 3 : -1) - b * (hind ? 2 : 4);
    const rx = reach * 0.6;
    const ry = hind ? 3 : 4.5 - Math.abs(b) * 1.2;
    c.ellipse(x, y, rx, Math.max(1.5, ry), MOTH_WING, { bias: hind ? -1 : 0, flatten: 0.7 });
    if (!hind) {
      c.part();
      c.ellipse(x + side * 1.2, y - 0.3, 1.4, Math.max(0.8, ry * 0.35), MOTH_SPOT, { glow });
    }
  };
  wing(-1, true);
  wing(1, true);
  wing(-1, false);
  wing(1, false);
  // Fuzzy body and head.
  c.part();
  c.capsule(cx, cy - 1, cx, cy + 5, 1.8, 1.3, MOTH_FUR);
  c.part();
  c.ellipse(cx, cy - 2.5, 2.2, 1.9, MOTH_FUR);
  c.part();
  c.px(cx - 1, cy - 2, MOTH_EYE, sphere(-0.3, -0.3));
  c.px(cx + 1, cy - 2, MOTH_EYE, sphere(0.3, -0.3));
  // Feathery antennae.
  c.line(cx - 1, cy - 4, cx - 3, cy - 7, MOTH_FUR, () => sphere(-0.3, -0.6));
  c.line(cx + 1, cy - 4, cx + 3, cy - 7, MOTH_FUR, () => sphere(0.3, -0.6));
  // Glittering scales shed from the wings.
  if (!p.dive) {
    c.spark(cx - 8, cy + 3 - b * 3, MOTH_DUST, 0.5);
    c.spark(cx + 9, cy + 2 - b * 3, MOTH_DUST, 0.4);
  }
  return c;
}

export function buildGlowmothSheet(): MonsterSheet {
  return sheet(
    MONSTER_FRAME.glowmoth,
    {
      idle0: () => glowmoth({ beat: 1 }),
      idle1: () => glowmoth({ beat: 0 }),
      idle2: () => glowmoth({ beat: -1 }),
      flare0: () => glowmoth({ beat: 1, flare: 1 }),
      flare1: () => glowmoth({ beat: -1, flare: 1 }),
      dive: () => glowmoth({ beat: 0, dive: true, flare: 0.6 }),
    },
    [
      { name: 'idle', frames: ['idle0', 'idle1', 'idle2', 'idle1'], fps: 12, loop: true },
      { name: 'walk', frames: ['idle0', 'idle1', 'idle2', 'idle1'], fps: 16, loop: true },
      { name: 'windup', frames: ['flare0', 'idle1', 'flare1', 'idle1'], fps: 18, loop: true },
    ],
  );
}

/** Wooden thorns bursting out of the ground, 3 frames of 30x22 (lit). */
export const THORN_W = 30;
export const THORN_H = 22;
export function thornFrame(f: number): PixelCanvas {
  const c = new PixelCanvas(THORN_W, THORN_H);
  const grow = [0.45, 1, 0.7][f];
  const spikes = [
    { x: 15, h: 17, w: 2.6, lean: 0 },
    { x: 9, h: 12, w: 2.2, lean: -1.6 },
    { x: 21, h: 13, w: 2.2, lean: 1.4 },
    { x: 5, h: 7, w: 1.6, lean: -2 },
    { x: 25, h: 8, w: 1.6, lean: 2.2 },
    { x: 12, h: 8, w: 1.8, lean: -0.6 },
    { x: 18.5, h: 9, w: 1.8, lean: 0.8 },
  ];
  for (const s of spikes) {
    c.part();
    const h = s.h * grow;
    const base = 19 - (s.x % 3);
    const top = base - h;
    c.shape(Math.round(top), base, (y) => {
      const u = (y - top) / (h || 1);
      const hw = Math.max(0.5, u * s.w);
      const x = s.x + s.lean * (1 - u);
      return [x - hw, x + hw];
    }, BARK, (_x, _y, t) => cyl(t, 0.3));
    if (h > 6) c.px(s.x + s.lean * 0.3, base - h * 0.55, CROWN, sphere(-0.4, -0.5));
  }
  // Clods of earth thrown up.
  c.part();
  c.ellipse(15, 19.5, 11 * grow + 2, 2.2, { ...BARK, bias: -1 }, { flatten: 0.5 });
  return c;
}

// ---------------------------------------------------------------- Effects

/** The venom glob, 7x7 of pure light (drawn additively). */
export function venomGlob(): Uint8ClampedArray {
  const n = 7;
  const px = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - 3.5, y + 0.5 - 3.5);
      const c = d < 1.3 ? VENOM_CORE : d < 2.3 ? VENOM_HOT : d < 3.2 ? VENOM_MID : null;
      if (!c) continue;
      const i = (y * n + x) * 4;
      px.set([c[0], c[1], c[2], 255], i);
    }
  }
  return px;
}

/** A crisp ground ring of `rx` x `ry` pixels, for attack telegraphs (white; tinted in game). */
export function ringCanvas(rx: number, ry: number): { w: number; h: number; px: Uint8ClampedArray } {
  const w = rx * 2 + 2;
  const h = ry * 2 + 2;
  const px = new Uint8ClampedArray(w * h * 4);
  const inside = (x: number, y: number) => {
    const dx = (x + 0.5 - w / 2) / rx;
    const dy = (y + 0.5 - h / 2) / ry;
    return dx * dx + dy * dy <= 1;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const i = (y * w + x) * 4;
      px.set([255, 255, 255, edge ? 255 : 40], i);
    }
  }
  return { w, h, px };
}
