// The Omens' art (see game/omens.ts), drawn like everything else: lit, with
// a glow layer and a normal map, facing right and mirrored where it moves.
//   - The Treasure Imp: a scrawny green goblin in a floppy red cap, hauling a
//     sack of loot bigger than himself, coins and a gem spilling from its
//     neck. He scurries, cackles and dives into his portal.
//   - Portals: an upright oval of swirling light, gold and green for the imp,
//     violet for a Rift Tear, its rim crackling with arcs.
//   - Meteors: a lump of dark rock burning white-hot on its leading face, a
//     tail of fire streaming behind it.
//   - Star ore: a meteorite half-sunk in the ground, veined with glowing
//     violet and crowned with star crystals; it cracks as it is struck.
//   - The Wandering Merchant: a hunched, hooded trader in a patched teal
//     cloak, two amber eyes in the shadow of his hood, a long grey beard, a
//     lantern swaying on his staff and a pack piled with his wares; and the
//     rug he lays his one piece out on.
//   - The Shrine of Unity: an old stone pillar on two steps, four stone hands
//     holding up a golden orb, its runes lighting one by one as it fills.
//   - The icons of every omen, and flat bits: a drift of fog, a heap of dust
//     to pick up, a scorch mark, and the shrine's ring of runes.

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, cyl, hex, sphere, FLAT, type Material, type RGB, type RenderedFrame } from './pixel';
import { shard } from './deepMonsters';
import { poly } from './shapes';
import { rng } from './env';
import { Bitmap, bayer } from './bitmap';

const ramp = (...c: string[]): RGB[] => c.map(hex);
const INK = hex('#0b0a1a');
const WHITE: RGB = [255, 255, 255];

/** Particle tints for each omen's bursts. */
export const IMP_TINTS = [0xfff0a0, 0xf4cc4a, 0x9adf3a, 0xc79cff];
export const METEOR_TINTS = [0xfff4c0, 0xffd060, 0xff8a2a, 0xe04a1a];
export const ORE_TINTS = [0xfbf2ff, 0xc79cff, 0x7a4ad0, 0x5a6282];
export const RIFT_TINTS = [0xffe0ff, 0xff6ad8, 0xb060ff, 0x6a2ab0];
export const SHRINE_TINTS = [0xfffbe0, 0xffe68a, 0x8af6ff, 0xe0a830];

// ---------------------------------------------------------------- The Treasure Imp

const IMP_SKIN: Material = { ramp: ramp('#16220c', '#283c14', '#3e5a1c', '#587a26', '#7a9c36', '#a4c254'), outline: hex('#090f05'), outlineLit: hex('#1a2a0c') };
const IMP_EAR_IN: Material = { ramp: ramp('#4a2030', '#6e3442', '#96505a'), outline: hex('#090f05') };
const IMP_CAP: Material = { ramp: ramp('#28060e', '#480c18', '#701624', '#9a2430', '#c43c40', '#e86a58'), outline: hex('#130308'), outlineLit: hex('#380810') };
const IMP_VEST: Material = { ramp: ramp('#181030', '#281a46', '#3a2860', '#503a7e', '#684e9a'), outline: INK, outlineLit: hex('#221840') };
const SACK: Material = { ramp: ramp('#221206', '#3c240e', '#5a3a18', '#7a5426', '#9e783a', '#c29e58', '#dec27c'), outline: hex('#110904'), outlineLit: hex('#2c1a0a') };
const SACK_PATCH: Material = { ramp: ramp('#28182a', '#422848', '#604068', '#7c5a86'), outline: hex('#110904') };
const ROPE: Material = { ramp: ramp('#4a3010', '#7a5420', '#b08838', '#dcc070'), outline: hex('#1a1006') };
const GOLD_M: Material = { ramp: ramp('#553606', '#8e5c10', '#cc9820', '#f2ca48', '#fff0a0'), outline: hex('#281704'), shine: true, emissive: 0.3 };
const LEATHER: Material = { ramp: ramp('#180c06', '#2c180e', '#442618', '#5e3822'), outline: INK };
const IMP_EYE: Material = { ramp: ramp('#ffb020', '#fff4a0'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const MOUTH: Material = { ramp: ramp('#1a0408', '#3a0a12'), outline: INK, noAO: true, noOutline: true };
const TOOTH: Material = { ramp: ramp('#d8d2b0', '#f8f4e0'), outline: INK, noAO: true, noOutline: true };
const GEM_C: Material = { ramp: ramp('#1a6a8a', '#5ae4ff', '#e8ffff'), outline: hex('#06202c'), emissive: 0.9, noAO: true };
const GEM_M: Material = { ramp: ramp('#8a1a6a', '#ff6ad8', '#ffe0f8'), outline: hex('#2c061e'), emissive: 0.9, noAO: true };

interface ImpPose {
  /** 0..1 phase of the idle bob. */
  t?: number;
  /** Running: which of four steps. */
  step?: number;
  /** Cackling, head thrown back, a hand waggling. */
  taunt?: number;
  /** Leaping into his portal. */
  hop?: boolean;
}

function imp(p: ImpPose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.imp;
  const c = new PixelCanvas(w, h);
  const tau = (p.t ?? 0) * Math.PI * 2;
  const running = p.step !== undefined;
  const sp = running ? (p.step! / 4) * Math.PI * 2 : 0;
  const bob = running ? -Math.abs(Math.sin(sp)) * 1.3 : p.hop ? -3 : Math.sin(tau) * 0.5;
  // Leans into his run, and back as he laughs.
  const lean = running ? 1.5 : p.taunt !== undefined ? -1 : p.hop ? 2 : 0;
  const foot = 26;
  const cx = 14;
  const hipY = foot - 5 + bob;
  const sackBob = running ? Math.sin(sp + 0.9) * 1.1 : p.hop ? -1 : Math.sin(tau + 0.6) * 0.4;

  // His far arm, swinging (or waggling his fingers, laughing).
  const bx = cx + 0.8 + lean * 0.5;
  const by = hipY - 3;
  c.part();
  if (p.taunt !== undefined) {
    const wag = p.taunt ? 0.8 : -0.4;
    c.capsule(bx + 2, by - 2.5, bx + 5 + wag, by - 7, 0.9, 0.9, IMP_SKIN);
    c.part();
    c.ellipse(bx + 5.4 + wag, by - 7.6, 1.2, 1.1, IMP_SKIN);
  } else {
    const swing = running ? Math.sin(sp) * 2.4 : p.hop ? 2.5 : 0.4;
    c.capsule(bx + 1.5, by - 2, bx + 3.2 + swing, by + 1.2 - (p.hop ? 3 : 0), 0.9, 0.9, IMP_SKIN);
    c.part();
    c.ellipse(bx + 3.4 + swing, by + 1.6 - (p.hop ? 3 : 0), 1.1, 1.1, IMP_SKIN);
  }

  // The sack on his back, bigger than he is.
  const sx = cx - 5 + lean * 0.4;
  const sy = hipY - 5 + sackBob;
  c.part();
  c.ellipse(sx, sy, 7, 7.3, SACK);
  // Creases where it sags.
  for (const [x0, y0, x1, y1] of [
    [-4, -3, -2.5, 3],
    [1, -4.5, 2, 1.5],
    [-2, 4, 3, 5],
  ]) {
    for (let k = 0; k <= 5; k++) c.shade(sx + x0 + ((x1 - x0) * k) / 5, sy + y0 + ((y1 - y0) * k) / 5, -1);
  }
  // A purple patch sewn on with big stitches.
  c.part();
  poly(c, [[sx - 5, sy + 1], [sx - 1.5, sy], [sx - 1, sy + 4], [sx - 4.5, sy + 4.6]], SACK_PATCH, () => sphere(-0.3, 0.1));
  for (const [x, y] of [[sx - 5, sy + 2.5], [sx - 3, sy + 0.4], [sx - 1.2, sy + 2]]) c.px(x, y, ROPE, sphere(0, 0.3));
  // The gathered neck, tied off with gold cord.
  c.part();
  c.ellipse(sx + 3.2, sy - 6.4, 2.5, 1.9, SACK);
  c.part();
  c.line(sx + 1.2, sy - 5.2, sx + 5, sy - 5.6, ROPE, (i, n) => cyl((i / n) * 2 - 1, 0.3));
  // Treasure spilling out of the top: coins on edge, a cyan gem and a pink one.
  c.part();
  c.ellipse(sx + 2, sy - 8.6, 1.3, 0.9, GOLD_M);
  c.ellipse(sx + 4.4, sy - 8.9, 1.3, 0.9, GOLD_M);
  c.part();
  c.ellipse(sx + 3.1, sy - 9.8, 1.2, 0.9, GOLD_M);
  c.part();
  c.px(sx + 5.4, sy - 8, GEM_C, sphere(0.2, 0.5));
  c.px(sx + 1, sy - 9.4, GEM_M, sphere(-0.2, 0.5));
  // Glints off the gold, and dust leaking from a seam.
  const glint = running ? p.step! % 2 : Math.floor((p.t ?? 0) * 2) % 2;
  c.spark(sx + (glint ? 4 : 2), sy - 10 + glint, [255, 246, 200], 0.9);
  c.spark(sx - 6.5, sy + 2 + glint, [200, 150, 255], 0.55);
  c.spark(sx - 5.5, sy + 4 - glint, [240, 226, 255], 0.4);

  // Legs, skinny, in pointed shoes that curl up at the toe.
  for (const [s, ph] of [
    [-1, 0],
    [1, Math.PI],
  ] as const) {
    const swing = running ? Math.sin(sp + ph) * 2.6 : p.hop ? -1.5 + s : 0;
    const lift = running ? Math.max(0, -Math.cos(sp + ph)) * 1.7 : p.hop ? 2 : 0;
    const hx = bx - 0.3 + s * 1.3;
    c.part();
    c.capsule(hx, hipY, hx + swing, foot - 1.5 - lift, 1.1, 0.9, IMP_SKIN);
    c.part();
    const fx = hx + swing;
    const fy = foot - 0.9 - lift;
    c.ellipse(fx + 0.7, fy, 2.1, 1.2, LEATHER, { flatten: 0.8 });
    c.px(fx + 2.8, fy - 1, LEATHER, sphere(0.6, 0.4));
  }

  // A little pot-bellied body in a ragged violet vest.
  c.part();
  c.ellipse(bx, by, 3.6, 4, IMP_VEST);
  c.part();
  c.ellipse(bx + 1.5, by + 1.4, 2.1, 2.3, IMP_SKIN);
  c.part();
  for (let x = -3; x <= 2; x++) c.px(bx + x, by + 2.6, LEATHER, cyl(x / 3.5, 0));
  c.px(bx - 1, by + 2.6, GOLD_M, sphere(0, 0.3));

  // His big head, tipped back when he laughs.
  const hx = bx + 1.8 + lean * 0.4;
  const hy = by - 6.8 + (p.taunt !== undefined ? -0.4 : 0);
  // The far ear, pricked up behind his head.
  c.part();
  poly(c, [[hx - 0.5, hy - 1.5], [hx + 2, hy - 7.2], [hx + 2.8, hy - 1]], IMP_SKIN, () => sphere(0.3, 0.5));
  c.part();
  c.ellipse(hx, hy, 4.4, 3.9, IMP_SKIN);
  // A hooked nose.
  c.part();
  c.ellipse(hx + 4.2, hy + 0.7, 1.8, 1.3, IMP_SKIN);
  c.px(hx + 5.4, hy + 1.6, IMP_SKIN, sphere(0.6, -0.4));
  // Beady gold eyes under a heavy brow.
  c.part();
  c.px(hx + 1.2, hy - 0.8, IMP_EYE);
  c.px(hx + 2.2, hy - 0.8, IMP_EYE);
  c.px(hx + 3.4, hy - 1, IMP_EYE);
  for (let x = 0; x <= 4; x++) c.shade(hx + x, hy - 2, -1);
  // The grin: wide, with a row of crooked teeth (gaping when he cackles).
  c.part();
  const open = p.taunt !== undefined ? (p.taunt ? 2 : 1) : 0;
  for (let x = 0; x <= 3; x++) {
    const y = hy + 2 - (x === 3 ? 0.6 : 0);
    c.px(hx + x, y, x % 2 ? MOUTH : TOOTH);
    for (let k = 1; k <= open; k++) c.px(hx + x, y + k, k === open && x % 2 === 0 ? TOOTH : MOUTH);
  }
  // A floppy red cap flopping back behind him, a gold bell on its tip.
  c.part();
  c.ellipse(hx - 0.6, hy - 2.7, 4.2, 1.9, IMP_CAP);
  c.part();
  const flop = running ? Math.sin(sp + 1.6) * 1.2 : Math.sin(tau) * 0.5;
  c.capsule(hx - 1, hy - 3.6, hx - 5, hy - 5.8 + flop, 2, 1.1, IMP_CAP);
  c.part();
  c.capsule(hx - 5, hy - 5.8 + flop, hx - 7.2, hy - 3.6 + flop, 1.1, 0.7, IMP_CAP);
  c.part();
  c.ellipse(hx - 7.6, hy - 2.8 + flop, 1.1, 1.1, GOLD_M);
  // The near ear, long and pointed, sweeping back from under the cap.
  c.part();
  const earFlap = running ? Math.sin(sp) * 0.7 : 0;
  poly(c, [[hx - 1.8, hy - 1.2], [hx - 8.4, hy - 4 + earFlap], [hx - 2.4, hy + 1.4]], IMP_SKIN, (_x, _y, t, u) => sphere(t * 0.5, 0.4 - u * 0.6));
  c.part();
  c.line(hx - 3, hy - 0.2, hx - 6.6, hy - 2.8 + earFlap, IMP_EAR_IN);

  // The near arm, over the shoulder, clutching the sack's neck.
  c.part();
  c.capsule(bx + 0.5, by - 2.4, sx + 4.5, sy - 5.2, 1, 1, IMP_SKIN);
  c.part();
  c.ellipse(sx + 4.8, sy - 5, 1.3, 1.2, IMP_SKIN);
  return c;
}

export function buildImpSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  [0, 1].forEach((i) => (poses[`idle${i}`] = () => imp({ t: i / 2 })));
  [0, 1, 2, 3].forEach((i) => (poses[`run${i}`] = () => imp({ step: i })));
  [0, 1].forEach((i) => (poses[`taunt${i}`] = () => imp({ taunt: i })));
  poses.hop0 = () => imp({ hop: true });
  return sheet(MONSTER_FRAME.imp, poses, [
    { name: 'idle', frames: ['idle0', 'idle1'], fps: 4, loop: true },
    { name: 'walk', frames: ['run0', 'run1', 'run2', 'run3'], fps: 13, loop: true },
    { name: 'taunt', frames: ['taunt0', 'taunt1'], fps: 9, loop: true },
    { name: 'hop', frames: ['hop0'], fps: 1, loop: false },
  ]);
}

// ---------------------------------------------------------------- Portals

export const PORTAL_W = 34;
export const PORTAL_H = 46;
/** Where it meets the ground. */
export const PORTAL_OY = 43;
export const PORTAL_FRAMES = 6;
export type PortalKind = 'imp' | 'rift';

const PORTAL_PAL: Record<PortalKind, { void: Material; rim: Material; hot: RGB; mid: RGB; deep: RGB; arc: RGB }> = {
  imp: {
    void: { ramp: ramp('#040a04', '#08140a', '#0e2010'), outline: hex('#061006'), noAO: true },
    rim: { ramp: ramp('#3a6a10', '#7ab82a', '#c8e858', '#fff4a0', '#ffffff'), outline: hex('#0c1a04'), emissive: 0.95, noAO: true },
    hot: hex('#fff6b0'),
    mid: hex('#e8d040'),
    deep: hex('#58b02a'),
    arc: hex('#f4ffc0'),
  },
  rift: {
    void: { ramp: ramp('#06020e', '#0c0418', '#140824'), outline: hex('#0a0414'), noAO: true },
    rim: { ramp: ramp('#4a1480', '#8a34d0', '#d060f0', '#ffb0f4', '#ffffff'), outline: hex('#12041e'), emissive: 0.95, noAO: true },
    hot: hex('#ffe0ff'),
    mid: hex('#ff6ad8'),
    deep: hex('#8a3ae0'),
    arc: hex('#f4e0ff'),
  },
};

/** An upright oval of swirling light, frame `f` of its turning. */
export function portalFrame(kind: PortalKind, f: number): PixelCanvas {
  const pal = PORTAL_PAL[kind];
  const c = new PixelCanvas(PORTAL_W, PORTAL_H);
  const cx = 17;
  const cy = 23.5;
  const rx = 11.5;
  const ry = 19;
  const ph = (f / PORTAL_FRAMES) * Math.PI * 2;
  // The dark heart.
  c.part();
  c.ellipse(cx, cy, rx - 0.6, ry - 0.6, pal.void, { normal: () => FLAT });
  // Three arms of light winding in toward the middle, turning.
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const r = Math.hypot(dx, dy);
      if (r >= 0.88) continue;
      const a = Math.atan2(dy, dx);
      const s = 0.5 + 0.5 * Math.sin(a * 3 - r * 11 + ph);
      const k = s * s * s * (0.2 + r * 1.05) + (r < 0.16 ? (0.16 - r) * 3.5 : 0);
      // Dithered, so the arms stay crisp pixels.
      if (k < 0.18 + bayer(x, y) * 0.12) continue;
      const col = k > 0.75 ? pal.hot : k > 0.45 ? pal.mid : pal.deep;
      c.spark(x, y, col, Math.min(1, 0.45 + k * 0.6));
    }
  }
  // The rim: a band of crackling light, brightest where the swirl turns past it.
  c.part();
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const r = Math.hypot(dx, dy);
      const band = 0.12 + 0.04 * Math.sin(Math.atan2(dy, dx) * 5 + ph * 2);
      if (r < 1 - band || r > 1.04) continue;
      const a = Math.atan2(dy, dx);
      c.px(x, y, pal.rim, sphere(dx * 0.8, -dy * 0.8, 0.8), { glow: 0.65 + 0.35 * Math.sin(a * 4 - ph * 2) });
    }
  }
  // Arcs leaping off the rim, and motes being drawn in.
  const R = rng(f * 13 + (kind === 'imp' ? 3 : 7));
  for (let n = 0; n < 3; n++) {
    const a = R() * Math.PI * 2;
    let x = cx + Math.cos(a) * rx;
    let y = cy + Math.sin(a) * ry;
    for (let k = 0; k < 3 + Math.floor(R() * 3); k++) {
      x += Math.cos(a) * 1.1 + (R() - 0.5) * 1.6;
      y += Math.sin(a) * 1.1 + (R() - 0.5) * 1.6;
      c.spark(x, y, pal.arc, 0.9 - k * 0.15);
    }
  }
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2 + ph * 0.5;
    const r = 1.18 + ((n * 0.37 + f / PORTAL_FRAMES) % 1) * 0.35;
    c.spark(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r * 0.96, n % 2 ? pal.hot : pal.mid, 0.7);
  }
  return c;
}

// ---------------------------------------------------------------- Meteors

export const METEOR_SIZE = 22;
export const METEOR_FRAMES = 3;
/** The way it falls, as drawn: down and to the right. */
export const METEOR_DIR = { x: 0.55, y: 0.835 };

const METEOR_ROCK: Material = { ramp: ramp('#0e0a0a', '#1c1412', '#2c201a', '#3e2e24', '#54402e'), outline: hex('#070404') };
const MOLTEN: Material = { ramp: ramp('#b02a0a', '#f06a1a', '#ffb040', '#fff0b0', '#ffffff'), outline: hex('#300804'), emissive: 1, noAO: true };

/** A burning rock in the sky, frame `f` of its flicker. */
export function meteorFrame(f: number): PixelCanvas {
  const c = new PixelCanvas(METEOR_SIZE, METEOR_SIZE);
  const u = METEOR_DIR;
  const nx = -u.y;
  const ny = u.x;
  const rx = 14;
  const ry = 15;
  // The tail: fire streaming back up the way it came, widening and cooling.
  const R = rng(f * 7 + 2);
  for (let i = 0; i < 110; i++) {
    const t = R();
    const along = 3 + t * 14;
    const spread = (R() - 0.5) * (1.6 + t * 5);
    const x = rx - u.x * along + nx * spread;
    const y = ry - u.y * along + ny * spread;
    const col: RGB = t < 0.2 ? [255, 250, 225] : t < 0.45 ? [255, 214, 96] : t < 0.72 ? [255, 136, 40] : [200, 60, 28];
    c.spark(x, y, col, (1 - t) * 0.85);
  }
  // The rock: lumpy, dark, white-hot on the face it falls on.
  c.part();
  c.ellipse(rx, ry, 4.4, 4, METEOR_ROCK);
  c.part();
  c.ellipse(rx - 1.8, ry - 1.4, 2.4, 2, METEOR_ROCK);
  c.part();
  for (let y = ry - 5; y <= ry + 5; y++) {
    for (let x = rx - 5; x <= rx + 5; x++) {
      if (!c.filled(x, y)) continue;
      const dx = x + 0.5 - rx;
      const dy = y + 0.5 - ry;
      const lead = (dx * u.x + dy * u.y) / 4.2;
      if (lead > 0.3 + (f === 1 ? -0.1 : 0)) c.px(x, y, MOLTEN, sphere(dx / 4.4, -dy / 4, 1), { glow: Math.min(1, 0.5 + lead * 0.6) });
    }
  }
  // Cracks glowing through the stone.
  for (const [x, y] of [
    [rx - 2, ry - 1],
    [rx - 1, ry],
    [rx - 3, ry + 1],
    [rx, ry - 2],
  ]) c.px(x, y, MOLTEN, FLAT, { glow: 0.55 + f * 0.1 });
  c.spark(rx + 3, ry + 3, WHITE, 0.9);
  return c;
}

// ---------------------------------------------------------------- Star ore

export const ORE_W = 24;
export const ORE_H = 22;
/** Where it sits on the ground. */
export const ORE_OY = 18;
export const ORE_KINDS = 3;
/** Whole, cracked and nearly broken. */
export const ORE_STAGES = 3;

const ORE_ROCK: Material = { ramp: ramp('#08080f', '#12131f', '#1c1f30', '#282d44', '#363e5a', '#4a5474', '#62708e'), outline: hex('#05050a'), outlineLit: hex('#1a1c2c'), shine: true };
const ORE_CRYSTAL: Material = { ramp: ramp('#2a1450', '#4a2484', '#7a44c8', '#a878f0', '#d8b8ff', '#fbf2ff'), outline: hex('#12062a'), emissive: 0.7, shine: true, noAO: true };
const ORE_CRYSTAL_DK: Material = { ramp: ramp('#1c0c38', '#321660', '#52309a', '#7448c0'), outline: hex('#12062a'), emissive: 0.45, noAO: true };
const STAR_VEIN: Material = { ramp: ramp('#8a5ae8', '#c8a8ff', '#f4ecff'), outline: hex('#12062a'), emissive: 1, noAO: true, noOutline: true };

/** A meteorite of kind `v` half-sunk in the ground, at `stage` of breaking. */
export function oreFrame(v: number, stage: number): PixelCanvas {
  const c = new PixelCanvas(ORE_W, ORE_H);
  const R = rng(v * 31 + 5);
  const cx = 12;
  const gy = ORE_OY;
  // A lumpy mound of pitted stone.
  c.part();
  c.ellipse(cx, gy - 3, 8, 5, ORE_ROCK);
  c.part();
  const lx = cx - 3 + R() * 1.5;
  c.ellipse(lx, gy - 6.5, 4.6, 4.2, ORE_ROCK);
  c.part();
  const rx2 = cx + 3 - R() * 1.2;
  c.ellipse(rx2, gy - 5.6, 4, 3.6, ORE_ROCK);
  for (let k = 0; k < 10; k++) c.shade(cx - 7 + R() * 14, gy - 8 + R() * 7, -1);
  // Veins of starlight wandering over it.
  c.part();
  for (let n = 0; n < 2; n++) {
    let x = cx - 5 + R() * 4 + n * 4;
    let y = gy - 8 + R() * 2;
    for (let k = 0; k < 7; k++) {
      if (c.filled(Math.floor(x), Math.floor(y))) c.px(x, y, STAR_VEIN, FLAT, { glow: 0.5 + R() * 0.35 });
      x += 0.6 + R() * 0.8;
      y += R() * 1.4 - 0.2;
    }
  }
  // Star crystals thrusting up out of it.
  const spikes: [number, number, number, number, number][] = [
    [lx - 1, gy - 8, lx - 3 - R() * 2, gy - 16 - R() * 2, 1.9],
    [rx2, gy - 7, rx2 + 2 + R() * 2, gy - 13 - R() * 2, 1.5],
    [cx + 0.5, gy - 8, cx + 0.5, gy - 12, 1.1],
  ];
  spikes.slice(0, stage === 2 ? 2 : 3).forEach(([bx, by, tx, ty, r], k) => {
    c.part();
    shard(c, bx, by, tx, ty, r, k === 1 ? ORE_CRYSTAL_DK : ORE_CRYSTAL, k === 0);
  });
  // Cracks: light breaking out through them, wider the more it has been struck.
  if (stage >= 1) {
    c.part();
    const cracks = stage === 1 ? 1 : 3;
    for (let n = 0; n < cracks; n++) {
      let x = cx - 4 + n * 3.5 + R() * 2;
      let y = gy - 9 + R() * 2;
      for (let k = 0; k < 6; k++) {
        if (c.filled(Math.floor(x), Math.floor(y))) c.px(x, y, STAR_VEIN, FLAT, { glow: 0.9 });
        x += (R() - 0.5) * 2;
        y += 1;
      }
    }
  }
  if (stage === 2) {
    // A chunk knocked clean off the side.
    for (let y = gy - 8; y <= gy - 3; y++) for (let x = cx + 5; x <= cx + 9; x++) if ((x - cx - 5) + (gy - 3 - y) * 0.6 > 1.5) c.erase(x, y);
    c.spark(cx + 5, gy - 6, [240, 226, 255], 0.9);
  }
  // Glints on the crystals.
  c.spark(cx - 1, gy - 10, WHITE, 0.4 + stage * 0.2);
  return c;
}

// ---------------------------------------------------------------- The Wandering Merchant

export const MERCHANT_W = 38;
export const MERCHANT_H = 46;
export const MERCHANT_OY = 43;
export const MERCHANT_FRAMES = 6;

const CLOAK: Material = { ramp: ramp('#071412', '#0c221e', '#14342c', '#1e473c', '#2a5c4e', '#3a7462'), outline: INK, outlineLit: hex('#0a1c18') };
const CLOAK_DK: Material = { ramp: ramp('#040c0a', '#081612', '#0e221c', '#142e26'), outline: INK };
const CLOAK_PATCH: Material = { ramp: ramp('#280a10', '#44141e', '#621e2c', '#822c3c'), outline: INK };
const BEARD: Material = { ramp: ramp('#34343c', '#5a5a64', '#86868e', '#b4b4bc', '#dedee4'), outline: hex('#141418'), outlineLit: hex('#2a2a30') };
const HOOD_SHADOW: Material = { ramp: ramp('#050404', '#0e0a08', '#1a1410'), outline: INK, noAO: true };
const M_EYE: Material = { ramp: ramp('#ffa030', '#fff0b0'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const BRASS: Material = { ramp: ramp('#3a2408', '#6a4412', '#a06a1e', '#d49a34', '#f8d070'), outline: hex('#1a1004'), shine: true };
const FLAME: Material = { ramp: ramp('#ff8a20', '#ffc850', '#fff4c0'), outline: hex('#3a1604'), emissive: 1, noAO: true };
const PANE: Material = { ramp: ramp('#c86a1a', '#ffb040', '#ffe090'), outline: hex('#1a1004'), emissive: 0.8, noAO: true };
const PACK_WOOD: Material = { ramp: ramp('#1c120a', '#322216', '#4a3422', '#644830', '#7e5e3c'), outline: INK };
const RUG_RED: Material = { ramp: ramp('#3a0a0e', '#5e1216', '#861e20', '#aa3228', '#c8503a'), outline: INK };
const CLAY: Material = { ramp: ramp('#3a1a0e', '#5e2e18', '#86462a', '#aa6440', '#c8845a'), outline: INK, shine: true };
const PARCHMENT: Material = { ramp: ramp('#5e4e30', '#8e7a50', '#bca878', '#e4d8a8'), outline: INK };
const HAND: Material = { ramp: ramp('#2a1a14', '#4a3024', '#6e4a36', '#8e6448'), outline: INK };

/** The merchant, frame `f`: he breathes, and his lantern sways and flickers on its crook. */
export function merchantFrame(f: number): PixelCanvas {
  const c = new PixelCanvas(MERCHANT_W, MERCHANT_H);
  const cx = 20;
  const ph = (f / MERCHANT_FRAMES) * Math.PI * 2;
  const U = Math.sin(ph) * 0.5;
  const sway = Math.sin(ph) * 1.1;
  const flick = f % 3;
  const foot = MERCHANT_OY;

  // His pack: a wooden frame piled high behind him.
  c.part();
  for (const s of [-1, 1]) c.capsule(cx + s * 6.5, 5 + U, cx + s * 7, 26 + U, 0.8, 0.9, PACK_WOOD);
  c.part();
  c.capsule(cx - 7, 6 + U, cx + 7, 6 + U, 0.8, 0.8, PACK_WOOD);
  // A rolled rug lashed across the top, and a scroll case poking out.
  c.part();
  c.capsule(cx - 8.5, 3.6 + U, cx + 8, 3.6 + U, 2.2, 2.2, RUG_RED);
  for (let x = -7; x <= 6; x += 3) c.px(cx + x, 3.6 + U, BRASS, cyl(0, 0.4));
  c.part();
  c.capsule(cx + 4, 2 + U, cx + 9, -1.5 + U, 1.2, 1.2, PARCHMENT);
  // Bundles and a clay pot hung off the sides, a brass kettle on the other.
  c.part();
  c.ellipse(cx - 9.2, 12 + U, 2.8, 3.2, CLAY);
  c.px(cx - 9.2, 8.6 + U, CLAY, sphere(0, 0.8));
  c.part();
  c.ellipse(cx + 9.4, 10.5 + U, 2.6, 2.3, BRASS);
  c.capsule(cx + 11.5, 9.5 + U, cx + 13, 8.2 + U, 0.5, 0.4, BRASS);
  c.part();
  c.ellipse(cx + 9, 17.5 + U, 2.6, 3.4, CLOAK_PATCH);
  c.line(cx + 7, 16.5 + U, cx + 11, 16.5 + U, BRASS);

  // The cloak, hunched and heavy, flaring to a ragged hem.
  c.part();
  c.shape(Math.round(14 + U), foot - 1, (y) => {
    const u = (y - 14 - U) / (foot - 15 - U);
    const hw = 6.4 + u * 3.6 + Math.sin(u * Math.PI) * 0.8;
    return [cx - hw, cx + hw];
  }, CLOAK, (_x, y, t) => sphere(t * 0.9, (26 - y) / 22, 1));
  // Folds running down it.
  for (let y = Math.ceil(24 + U); y <= foot - 2; y++) {
    c.shade(cx - 4, y, -1);
    c.shade(cx + 3, y, -1);
    if (y > 32) c.shade(cx - 1, y, -1);
  }
  // A ragged hem.
  for (let x = cx - 9; x <= cx + 9; x += 2) c.erase(x, foot - 1);
  // A maroon patch sewn on the hip.
  c.part();
  poly(c, [[cx - 7, 30], [cx - 3.5, 29.4], [cx - 3.2, 33.6], [cx - 6.6, 34]], CLOAK_PATCH, () => sphere(-0.3, 0.1));
  for (const [x, y] of [[cx - 7, 31.5], [cx - 5, 29.4], [cx - 3.2, 31.8], [cx - 5.2, 34]]) c.px(x, y, PARCHMENT, sphere(0, 0.2));
  // His belt, pouches and a string of coins.
  c.part();
  c.shape(Math.round(25 + U), Math.round(25 + U), () => [cx - 7.4, cx + 7.4], PACK_WOOD, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.ellipse(cx + 4.5, 27.3 + U, 1.8, 2, PACK_WOOD);
  c.part();
  for (let k = 0; k < 4; k++) c.px(cx - 2 + k * 1.3, 26.6 + U + (k % 2) * 0.6, GOLD_M, sphere(0, 0.4));
  // A shawl over his shoulders.
  c.part();
  c.ellipse(cx, 16 + U, 7.2, 3, CLOAK_DK, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, -dy * 0.4 + 0.4, 1) });

  // His left hand, folded at his belly.
  c.part();
  c.capsule(cx + 5.8, 17.5 + U, cx + 2.5, 23.5 + U, 1.9, 2.2, CLOAK);
  c.part();
  c.ellipse(cx + 1.8, 24 + U, 1.5, 1.3, HAND);

  // The hood, drooping forward, a long grey beard spilling out of its shadow.
  c.part();
  poly(c, [[cx - 5.6, 11 + U], [cx + 1, 3 + U], [cx + 4, 4.4 + U], [cx + 5.8, 11 + U]], CLOAK, (_x, _y, t, u) => sphere(t * 0.8, 0.6 - u * 0.5, 1));
  c.part();
  c.ellipse(cx, 11.2 + U, 5.9, 5.1, CLOAK);
  c.part();
  c.ellipse(cx, 12.6 + U, 3.4, 3.1, HOOD_SHADOW, { normal: () => FLAT });
  c.part();
  c.px(cx - 1.5, 12 + U, M_EYE);
  c.px(cx + 1.2, 12 + U, M_EYE);
  c.part();
  c.shape(Math.round(14 + U), Math.round(22 + U), (y) => {
    const u = (y - 14 - U) / 8;
    const hw = 2.6 - u * 1.8;
    const drift = Math.sin(ph + u * 2) * 0.4 * u;
    return [cx - hw + drift, cx + hw + drift];
  }, BEARD, (_x, _y, t, u) => sphere(t * 0.8, 0.4 - u * 0.5, 1));
  for (let y = 15; y <= 20; y += 2) c.shade(cx, y + U, -1);

  // His right hand on a crooked staff, the lantern hanging from its crook.
  const sx = cx - 10;
  c.part();
  c.capsule(sx, 9 + U, sx + 0.6, foot, 0.8, 0.9, PACK_WOOD);
  c.part();
  c.capsule(sx, 9 + U, sx - 2.2, 7 + U, 0.8, 0.7, PACK_WOOD);
  c.capsule(sx - 2.2, 7 + U, sx - 3.6, 8.6 + U, 0.7, 0.6, PACK_WOOD);
  c.part();
  c.capsule(cx - 5.6, 17 + U, sx + 1.2, 20.5 + U, 1.9, 2.2, CLOAK);
  c.part();
  c.ellipse(sx + 0.6, 20.6 + U, 1.5, 1.4, HAND);
  // The lantern: a brass cage with a flame, on a short chain.
  const lx = sx - 3.6 + sway;
  const ly = 13 + U;
  c.part();
  c.line(sx - 3.6, 8.6 + U, lx, ly - 3, BRASS);
  c.part();
  c.shape(Math.round(ly - 2), Math.round(ly + 2), () => [lx - 1.6, lx + 1.6], PANE, (_x, _y, t) => cyl(t, 0.1), { glow: 0.75 + flick * 0.1 });
  c.part();
  for (let y = Math.round(ly - 3); y <= Math.round(ly + 3); y += 6) c.shape(y, y, () => [lx - 2.2, lx + 2.2], BRASS, (_x, _y, t) => cyl(t, 0.3));
  c.px(lx, ly - 4, BRASS, sphere(0, 0.6));
  c.part();
  c.px(lx, ly - (flick === 1 ? 1 : 0), FLAME, FLAT, { glow: 1 });
  c.spark(lx, ly - 1 - flick * 0.5, [255, 250, 220], 0.9);
  c.spark(lx + (flick - 1), ly - 5, [255, 190, 90], 0.35);
  return c;
}

export const RUG_W = 40;
export const RUG_H = 14;

/** His rug, laid on the ground: a red field, a gold border, a deep blue medallion, tasselled ends. */
export function rugArt(): PixelCanvas {
  const c = new PixelCanvas(RUG_W, RUG_H);
  const x0 = 4;
  const x1 = RUG_W - 5;
  const y0 = 2;
  const y1 = RUG_H - 3;
  const up = { x: 0, y: 0.72, z: 0.7 };
  const RUG_GOLD: Material = { ramp: ramp('#5a3a10', '#8e6220', '#c49434', '#e8c060'), outline: INK };
  const RUG_BLUE: Material = { ramp: ramp('#0a1030', '#141e50', '#1e2e74', '#2c4494'), outline: INK };
  c.part();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) c.px(x, y, RUG_RED, up);
  c.part();
  for (let x = x0; x <= x1; x++) {
    c.px(x, y0, RUG_GOLD, up);
    c.px(x, y1, RUG_GOLD, up);
    if (x % 2 === 0) {
      c.px(x, y0 + 2, RUG_GOLD, up);
      c.px(x, y1 - 2, RUG_GOLD, up);
    }
  }
  for (let y = y0; y <= y1; y++) {
    c.px(x0, y, RUG_GOLD, up);
    c.px(x1, y, RUG_GOLD, up);
  }
  // The medallion: a blue diamond with a gold heart.
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  c.part();
  for (let y = y0 + 1; y <= y1 - 1; y++) {
    const hw = 7 - Math.abs(y + 0.5 - my) * 2.2;
    for (let x = Math.round(mx - hw); x <= Math.round(mx + hw); x++) c.px(x, y, RUG_BLUE, up);
  }
  c.part();
  c.px(mx, my, RUG_GOLD, up);
  c.px(mx - 1, my, RUG_GOLD, up);
  c.px(mx + 1, my, RUG_GOLD, up);
  c.px(mx, my - 1, RUG_GOLD, up);
  // Tassels on the short ends.
  c.part();
  for (let y = y0; y <= y1; y += 2) {
    c.px(x0 - 1, y, RUG_GOLD, up);
    c.px(x0 - 2, y, RUG_GOLD, up);
    c.px(x1 + 1, y, RUG_GOLD, up);
    c.px(x1 + 2, y, RUG_GOLD, up);
  }
  return c;
}

// ---------------------------------------------------------------- The Shrine of Unity

export const SHRINE_W = 40;
export const SHRINE_H = 58;
export const SHRINE_OY = 54;
/** Dormant, then each of its four runes lit in turn. */
export const SHRINE_STAGES = 5;

const SHRINE_STONE: Material = { ramp: ramp('#12151d', '#1e232d', '#2b323f', '#3b4453', '#4e5969', '#657283', '#8290a2'), outline: INK, outlineLit: hex('#232835') };
const SHRINE_MOSS: Material = { ramp: ramp('#10200c', '#1c3414', '#2a4a1c', '#3c6226'), outline: INK };
const RUNE_DARK: Material = { ramp: ramp('#0c1018', '#161c28'), outline: INK, noAO: true, noOutline: true };
const RUNE_LIT: Material = { ramp: ramp('#e0a830', '#ffe68a', '#fffbe0'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const ORB: Material = { ramp: ramp('#6a4a10', '#b08a2a', '#f0cc5a', '#fff0a8', '#ffffff'), outline: hex('#2a1a04'), shine: true, noAO: true };

/** Four runes, carved down the pillar: 3x3 marks. */
const RUNES = [
  ['#.#', '.#.', '#.#'],
  ['###', '.#.', '.#.'],
  ['#..', '###', '..#'],
  ['.#.', '###', '.#.'],
];

/** The shrine at `stage` (0 dormant .. 4 every rune lit and the orb blazing). */
export function shrineFrame(stage: number): PixelCanvas {
  const c = new PixelCanvas(SHRINE_W, SHRINE_H);
  const cx = 20;
  const g = SHRINE_OY;
  const up = (t: number) => sphere(t * 0.8, 0.75, 1);
  // Two broad steps.
  c.part();
  c.shape(g - 6, g, (y) => [cx - 15 + (y === g - 6 ? 1 : 0), cx + 15 - (y === g - 6 ? 1 : 0)], SHRINE_STONE, (_x, y, t) => (y <= g - 5 ? up(t) : cyl(t, -0.1)));
  c.part();
  c.shape(g - 11, g - 6, (y) => [cx - 11 + (y === g - 11 ? 1 : 0), cx + 11 - (y === g - 11 ? 1 : 0)], SHRINE_STONE, (_x, y, t) => (y <= g - 10 ? up(t) : cyl(t, -0.1)));
  const R = rng(41);
  for (let k = 0; k < 9; k++) c.shade(cx - 13 + R() * 26, g - 10 + R() * 9, -1);
  // Moss creeping over the steps.
  c.part();
  for (const [x, y, w] of [[cx - 14, g - 1, 4], [cx + 9, g - 6, 3], [cx - 9, g - 7, 2], [cx + 12, g - 2, 3]] as const) {
    for (let k = 0; k < w; k++) c.px(x + k, y - (k % 2), SHRINE_MOSS, sphere(0, 0.6));
  }
  // The pillar, tapering to its crown.
  c.part();
  c.shape(17, g - 11, (y) => {
    const u = (y - 17) / (g - 28);
    const hw = 4.8 + u * 1.7;
    return [cx - hw, cx + hw];
  }, SHRINE_STONE, (_x, _y, t) => cyl(t, 0.1));
  // Its runes, lit one by one.
  RUNES.forEach((rows, i) => {
    const ry = 21 + i * 6;
    c.part();
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < 3; dx++) {
        if (row[dx] !== '#') continue;
        c.px(cx - 1 + dx, ry + dy, i < stage ? RUNE_LIT : RUNE_DARK, FLAT, { glow: i < stage ? 1 : 0 });
      }
    });
  });
  // A crack, and a chip out of an edge.
  for (let y = 36; y <= 41; y++) c.shade(cx + 3 + (y % 3 === 0 ? 1 : 0), y, -2);
  c.erase(cx - 6, 40);
  // Four stone hands rising from the crown, cupping the orb.
  for (const [bx, tx, ty, r] of [
    [-5.2, -4.2, 10.5, 1.5],
    [5.2, 4.2, 10.5, 1.5],
  ] as const) {
    c.part();
    c.capsule(cx + bx, 18, cx + tx, ty, 1.6, r, SHRINE_STONE);
    c.part();
    c.ellipse(cx + tx * 0.92, ty - 1, 1.5, 1.3, SHRINE_STONE);
  }
  // The orb, brighter with every rune.
  const glow = 0.3 + stage * 0.175;
  c.part();
  c.ellipse(cx, 9, 3.7, 3.7, ORB, { glow });
  for (const [bx, tx] of [
    [-2.2, -1.6],
    [2.2, 1.6],
  ] as const) {
    c.part();
    c.capsule(cx + bx, 17.5, cx + tx, 12.2, 1.4, 1.2, SHRINE_STONE);
  }
  c.spark(cx - 1, 7.5, WHITE, 0.4 + stage * 0.12);
  if (stage > 0) {
    for (let k = 0; k < stage * 2; k++) {
      const a = (k / (stage * 2)) * Math.PI * 2;
      c.spark(cx + Math.cos(a) * 6, 9 + Math.sin(a) * 5, [255, 230, 138], 0.35 + stage * 0.1);
    }
  }
  return c;
}

// ---------------------------------------------------------------- Flat bits

/** Finished pixels, lit by the art's own key light, with the glow layer added on top: for art drawn unlit (icons, the dust on the ground). */
function flatten(r: RenderedFrame): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(r.w * r.h * 4);
  for (let i = 0; i < r.w * r.h; i++) {
    const o = i * 4;
    const a = Math.max(r.diffuse[o + 3], r.emissive[o + 3]);
    if (!a) continue;
    const d = r.diffuse[o + 3] ? 1 : 0;
    out[o] = Math.min(255, r.diffuse[o] * d + r.emissive[o] * 0.8);
    out[o + 1] = Math.min(255, r.diffuse[o + 1] * d + r.emissive[o + 1] * 0.8);
    out[o + 2] = Math.min(255, r.diffuse[o + 2] * d + r.emissive[o + 2] * 0.8);
    out[o + 3] = a;
  }
  return out;
}

/** A soft drift of fog, dithered to pixels: drawn white, tinted in the world. */
export function fogPuff(v: number): Bitmap {
  const w = 56;
  const h = 26;
  const b = new Bitmap(w, h);
  const R = rng(v * 17 + 9);
  const lumps = Array.from({ length: 5 }, () => ({ x: 12 + R() * 32, y: 9 + R() * 8, rx: 9 + R() * 10, ry: 5 + R() * 4 }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let k = 0;
      for (const l of lumps) {
        const d = ((x + 0.5 - l.x) / l.rx) ** 2 + ((y + 0.5 - l.y) / l.ry) ** 2;
        k = Math.max(k, 1 - d);
      }
      if (k <= 0) continue;
      // Three steps of thickness, dithered between.
      const a = k * 1.4 + (bayer(x, y) - 0.5) * 0.45;
      const step = a > 1 ? 150 : a > 0.6 ? 100 : a > 0.25 ? 55 : 0;
      if (step) b.set(x, y, [255, 255, 255], step);
    }
  }
  return b;
}

/** Dust lying on the ground: a little violet heap with a glint over it. */
export function dustDrop(): Bitmap {
  const rows = ['......w......', '.....wbw..w..', '..w...w......', '....bbbbb....', '...bcdcccb...', '..bccccdccb..', '.bcdcccccdcb.', 'bcccccdccccb.'];
  const col: Record<string, RGB> = { w: hex('#fbf2ff'), b: hex('#c79cff'), c: hex('#7a4ad0'), d: hex('#a878f0') };
  const outline = hex('#1a0e30');
  const b = new Bitmap(rows[0].length + 2, rows.length + 2);
  const on = (x: number, y: number) => {
    const ch = rows[y - 1]?.[x - 1];
    return !!ch && ch !== '.';
  };
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const ch = rows[y - 1]?.[x - 1];
      if (ch && ch !== '.') b.set(x, y, col[ch]);
      else if (y > 3 && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) b.set(x, y, outline);
    }
  }
  return b;
}
export const DUST_DROP_H = 10;

/** A scorch in the ground where a meteor struck, for a multiply blend: dark in the middle, fading out. */
export function scorchMark(): Bitmap {
  const w = 34;
  const h = 16;
  const b = new Bitmap(w, h);
  const R = rng(77);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2)) + (R() - 0.5) * 0.12;
      if (d >= 1) continue;
      const k = 1 - d;
      const a = k * 1.3 + (bayer(x, y) - 0.5) * 0.3;
      const step = a > 0.9 ? 210 : a > 0.55 ? 150 : a > 0.2 ? 80 : 0;
      if (step) b.set(x, y, hex('#1a0e08'), step);
    }
  }
  return b;
}

/** The shrine's ring of runes on the ground, white (tinted in the world, and blended to glow). */
export function runeRing(): Bitmap {
  const w = 84;
  const h = 38;
  const b = new Bitmap(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const plot = (x: number, y: number, a: number) => b.set(Math.round(x), Math.round(y), WHITE, a);
  // Two rings, the inner one dotted.
  for (let i = 0; i < 360; i++) {
    const t = (i / 360) * Math.PI * 2;
    plot(cx + Math.cos(t) * 40, cy + Math.sin(t) * 17, 255);
    if (i % 4 < 2) plot(cx + Math.cos(t) * 34, cy + Math.sin(t) * 14.4, 170);
  }
  // Runes marching round between them.
  for (let k = 0; k < 12; k++) {
    const t = (k / 12) * Math.PI * 2;
    const x = cx + Math.cos(t) * 37;
    const y = cy + Math.sin(t) * 15.7;
    const rows = RUNES[k % 4];
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < 3; dx++) if (row[dx] === '#') plot(x - 1 + dx, y - 1 + dy, 220);
    });
  }
  return b;
}

// ---------------------------------------------------------------- Icons

export type OmenIcon = 'blood' | 'imp' | 'meteor' | 'golden' | 'fog' | 'rift' | 'merchant' | 'shrine' | 'unity';
export const OMEN_ICON = 16;

function iconCanvas(id: OmenIcon): PixelCanvas {
  const c = new PixelCanvas(OMEN_ICON, OMEN_ICON);
  switch (id) {
    case 'blood': {
      const MOON: Material = { ramp: ramp('#3a0408', '#6a0a10', '#a01818', '#d0342a', '#f0664a', '#ffa080'), outline: hex('#1a0204'), emissive: 0.45 };
      c.part();
      c.ellipse(8, 8, 6, 6, MOON);
      for (const [x, y] of [[6, 6], [9, 10], [10, 6], [5, 10]]) c.shade(x, y, -1);
      c.shade(7, 6, -1);
      // The dark of its crescent.
      for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) if (c.filled(x, y) && Math.hypot(x + 0.5 - 10.5, y + 0.5 - 6.5) < 4.2) c.shade(x, y, -3);
      c.spark(4, 5, [255, 200, 180], 0.5);
      break;
    }
    case 'imp': {
      c.part();
      c.ellipse(7, 10, 5.4, 4.6, SACK);
      c.part();
      c.ellipse(8.5, 5, 2.2, 1.6, SACK);
      c.part();
      c.line(6.6, 6.2, 10.4, 5.8, ROPE);
      c.part();
      c.ellipse(9, 3, 1.4, 1, GOLD_M);
      c.ellipse(11.4, 3.4, 1.3, 0.9, GOLD_M);
      c.part();
      c.px(12, 5, GEM_C, sphere(0, 0.5));
      c.px(3, 11, GEM_M, sphere(0, 0.5));
      c.spark(10, 1, WHITE, 0.9);
      c.spark(13, 7, [255, 240, 180], 0.6);
      break;
    }
    case 'meteor': {
      for (let i = 0; i < 26; i++) {
        const t = i / 26;
        const R = rng(i);
        c.spark(10 - t * 8 + (R() - 0.5) * 2 * t, 10 - t * 8 + (R() - 0.5) * 2 * t, t < 0.3 ? [255, 244, 200] : t < 0.6 ? [255, 180, 60] : [220, 70, 30], 1 - t * 0.7);
      }
      c.part();
      c.ellipse(11, 11, 3.4, 3.2, METEOR_ROCK);
      c.part();
      for (const [x, y] of [[12, 12], [13, 11], [12, 13], [13, 12], [11, 13]]) c.px(x, y, MOLTEN, FLAT, { glow: 1 });
      break;
    }
    case 'golden': {
      const SUN: Material = { ramp: ramp('#8a4a08', '#d08a18', '#f4c040', '#fff0a0', '#ffffff'), outline: hex('#3a1c04'), emissive: 0.7 };
      c.part();
      c.shape(5, 11, (y) => {
        const d = Math.sqrt(Math.max(0, 25 - (y + 0.5 - 11) ** 2));
        return [8 - d, 8 + d];
      }, SUN, (_x, y, t) => sphere(t * 0.8, (11 - y) / 6, 1));
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + (k / 6) * Math.PI;
        for (let r = 7; r <= 8.5; r += 0.8) c.spark(8 + Math.cos(a) * r, 11 + Math.sin(a) * r, [255, 220, 120], 0.8);
      }
      c.part();
      for (let x = 1; x <= 14; x++) c.px(x, 12, { ramp: ramp('#5a3a10', '#8a6020'), outline: hex('#2a1804') }, FLAT);
      for (let x = 3; x <= 12; x += 3) c.spark(x, 14, [255, 200, 90], 0.5);
      break;
    }
    case 'fog': {
      const MIST: Material = { ramp: ramp('#4a5468', '#6c7890', '#9aa6bc', '#c8d2e0'), outline: hex('#1a1e2a'), noAO: true };
      for (const [y, x0, x1] of [[4, 3, 12], [8, 1, 13], [12, 4, 14]] as const) {
        c.part();
        c.shape(y - 1, y + 1, (yy) => (yy === y ? [x0, x1] : [x0 + 1, x1 - 1]), MIST, (_x, yy, t) => sphere(t * 0.6, y - yy, 1));
      }
      c.part();
      c.px(6, 8, { ramp: ramp('#9ffff0', '#f0fffc'), outline: INK, emissive: 1, noOutline: true });
      c.px(9, 8, { ramp: ramp('#9ffff0', '#f0fffc'), outline: INK, emissive: 1, noOutline: true });
      break;
    }
    case 'rift': {
      const pal = PORTAL_PAL.rift;
      c.part();
      c.shape(1, 14, (y) => {
        const u = (y + 0.5 - 7.5) / 7;
        const hw = Math.max(0.5, 4.2 * Math.sqrt(Math.max(0, 1 - u * u)));
        return [8 - hw, 8 + hw];
      }, pal.rim, (_x, _y, t) => sphere(t, 0, 1));
      c.part();
      c.shape(3, 12, (y) => {
        const u = (y + 0.5 - 7.5) / 5;
        const hw = Math.max(0.3, 2.2 * Math.sqrt(Math.max(0, 1 - u * u)));
        return [8 - hw, 8 + hw];
      }, pal.void, () => FLAT);
      c.spark(8, 7, pal.hot, 1);
      c.spark(8, 8, pal.mid, 0.8);
      for (const [x, y] of [[2, 3], [14, 11], [13, 3], [3, 13]]) c.spark(x, y, pal.mid, 0.7);
      break;
    }
    case 'merchant': {
      c.part();
      c.line(8, 0, 8, 2, BRASS);
      c.part();
      c.shape(4, 12, (y) => (y === 4 || y === 12 ? [4, 12] : [5, 11]), PANE, (_x, _y, t) => cyl(t, 0.1), { glow: 0.9 });
      c.part();
      for (const y of [3, 13]) c.shape(y, y, () => [3, 13], BRASS, (_x, _y, t) => cyl(t, 0.3));
      c.part();
      for (let y = 4; y <= 12; y++) c.px(8, y, BRASS, cyl(0, 0));
      c.part();
      c.px(7, 8, FLAME, FLAT, { glow: 1 });
      c.px(7, 9, FLAME, FLAT, { glow: 1 });
      c.spark(7, 7, WHITE, 0.8);
      break;
    }
    case 'shrine': {
      c.part();
      c.shape(12, 15, (y) => [2 + (y === 12 ? 1 : 0), 14 - (y === 12 ? 1 : 0)], SHRINE_STONE, (_x, y, t) => (y === 12 ? sphere(t * 0.8, 0.8) : cyl(t, 0)));
      c.part();
      c.shape(6, 12, () => [5.5, 10.5], SHRINE_STONE, (_x, _y, t) => cyl(t, 0.1));
      c.part();
      c.px(8, 8, RUNE_LIT);
      c.px(8, 10, RUNE_LIT);
      c.px(7, 9, RUNE_LIT);
      c.px(9, 9, RUNE_LIT);
      c.part();
      c.ellipse(8, 3.5, 2.6, 2.6, ORB, { glow: 1 });
      c.spark(3, 3, [255, 230, 138], 0.6);
      c.spark(13, 4, [255, 230, 138], 0.6);
      break;
    }
    case 'unity': {
      c.part();
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const x = 8 + Math.cos(a) * 4.6;
        const y = 8 + Math.sin(a) * 4.6;
        const b = (k + 1) / 4;
        const a2 = ((k + 1) / 4) * Math.PI * 2 + Math.PI / 4;
        for (let s = 0; s <= 6; s++) c.spark(x + (8 + Math.cos(a2) * 4.6 - x) * (s / 6), y + (8 + Math.sin(a2) * 4.6 - y) * (s / 6), [255, 220, 120], 0.5 * b + 0.3);
        c.ellipse(x, y, 1.6, 1.6, ORB, { glow: 1 });
      }
      c.part();
      c.ellipse(8, 8, 1.8, 1.8, { ramp: ramp('#5ae4ff', '#e8ffff'), outline: hex('#06202c'), emissive: 1, noAO: true });
      break;
    }
  }
  return c;
}

/** An omen's icon, flat and finished, for the banner and the HUD. */
export function omenIcon(id: OmenIcon): Uint8ClampedArray<ArrayBuffer> {
  return flatten(iconCanvas(id).render());
}
