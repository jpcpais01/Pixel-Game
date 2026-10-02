// What the Gravedigger calls up out of the ground: the ghoul that climbs out
// of his open grave and fights for him, and the headstones of his Special.
// Mossgrave's are a bog body grown over with moss and fungus, and old
// standing stones furred with moss, a spiral cut in each.
//
// Both are drawn facing right and mirrored, like the monsters (see
// monsters.ts `sheet`); the ghoul shares the risen skeleton's frame box and
// animation names, so the necromancer's Risen can play it as is.

import { PixelCanvas, hex, sphere, type Material, type RGB } from './pixel';
import { sheet, type MonsterSheet } from './monsters';
import { SKELETON_FRAME } from './skeleton';
import { LANTERN_HOT, LANTERN_MID, WISP_HOT, WISP_MID } from './digger';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** How a ghoul (or a bog body) and its headstones are coloured. */
export interface GraveLook {
  /** The texture keys: the ghoul's and the stones'. */
  ghoul: string;
  stones: string;
  flesh: Material;
  rags: Material;
  claw: Material;
  earth: Material;
  stone: Material;
  /** The lettering, the moss, the eyes' and runes' light. */
  carve: Material;
  moss?: Material;
  cap?: Material;
  hot: RGB;
  mid: RGB;
}

const EARTH: Material = { ramp: ramp('#22160e', '#3a281a', '#563c26', '#6e5034'), outline: hex('#0e0805') };

export const GRAVE_LOOK: GraveLook = {
  ghoul: 'ghoul',
  stones: 'headstones',
  flesh: { ramp: ramp('#2a2e26', '#454c3e', '#66705a', '#8a9478', '#acb496'), outline: hex('#0c0e0a'), outlineLit: hex('#181c14') },
  rags: { ramp: ramp('#26221c', '#3e382e', '#585042', '#726856'), outline: hex('#0c0a08') },
  claw: { ramp: ramp('#4a4436', '#8a826a', '#c8c0a0'), outline: hex('#141210') },
  earth: EARTH,
  stone: { ramp: ramp('#2a2a2e', '#44454a', '#62646a', '#84868a', '#a6a8aa'), outline: hex('#0c0c0e'), outlineLit: hex('#18181c') },
  carve: { ramp: ramp('#2e6a2a', '#7ad040', '#c8ff8a'), outline: hex('#0c160a'), emissive: 0.8, noAO: true },
  hot: LANTERN_HOT,
  mid: LANTERN_MID,
};

export const MOSS_GRAVE_LOOK: GraveLook = {
  ghoul: 'ghoul_moss',
  stones: 'headstones_moss',
  flesh: { ramp: ramp('#1e1a10', '#342c1a', '#4e4226', '#6a5a34', '#847044'), outline: hex('#0a0804'), outlineLit: hex('#14100a') },
  rags: { ramp: ramp('#1a2a10', '#2c4418', '#446422', '#5e842e'), outline: hex('#080e04') },
  claw: { ramp: ramp('#2e2012', '#48321c', '#624628'), outline: hex('#0a0603') },
  earth: { ramp: ramp('#141e0e', '#243418', '#365022', '#4a6a2c'), outline: hex('#060a04') },
  stone: { ramp: ramp('#22261e', '#383e32', '#525a4a', '#707a66', '#8e9884'), outline: hex('#0a0c08'), outlineLit: hex('#14160f') },
  carve: { ramp: ramp('#0e5a68', '#3ad0c8', '#9ff8ee'), outline: hex('#041a1c'), emissive: 0.85, noAO: true },
  moss: { ramp: ramp('#1a3010', '#2c4c18', '#447022', '#5e922e', '#80b440'), outline: hex('#08120a') },
  cap: { ramp: ramp('#4a1e10', '#7a3a1a', '#a85a2a', '#d08a44'), outline: hex('#1a0804'), shine: true },
  hot: WISP_HOT,
  mid: WISP_MID,
};

const EYE: Material = { ramp: ramp('#06080a', '#0c1012'), outline: hex('#06080a'), noAO: true };

// ---------------------------------------------------------------------------
// The ghoul

interface GhoulPose {
  /** Walk phase 0..3. */
  step?: number;
  /** The clawing arm: 0 raised back, 1 raked through. */
  rake?: number;
  /** Out of the ground, 0..1. */
  rise?: number;
  /** Sinking back into the earth, 0..1. */
  sink?: number;
  bob?: number;
}

/**
 * A ghoul, stooped low: a bald grey skull of a head thrust forward, eyes
 * burning in deep sockets, ribs under the skin, a shroud's rags round the
 * hips, long arms ending in yellowed claws. Mossgrave's is a bog body: peat
 * dark, moss on its back and head, a toadstool on its crown.
 */
function ghoul(G: GraveLook, p: GhoulPose): PixelCanvas {
  const F = SKELETON_FRAME;
  const c = new PixelCanvas(F.w, F.h);
  const g = F.oy;
  const rise = p.rise ?? 1;
  const sinkK = p.sink ?? 0;
  const under = Math.round((1 - rise) * 17 + sinkK * 18);
  const y0 = under + (p.bob ?? 0);
  const step = p.step ?? 0;
  const rake = p.rake ?? 0.6;
  const leg = (hx: number, phase: number, far: boolean) => {
    const f = [1.2, 0, -1.2, 0][(step + phase) % 4];
    const lift = [0, 0.8, 0, 0.8][(step + phase) % 4];
    c.part();
    c.capsule(hx, 14.5 + y0, hx + f * 0.5 + 0.8, 17.8 + y0 - lift * 0.4, 1.0, 0.8, G.flesh, { bias: far ? -1 : 0 });
    c.capsule(hx + f * 0.5 + 0.8, 17.8 + y0 - lift * 0.4, hx + f, 21 + y0 - lift, 0.8, 0.7, G.flesh, { bias: far ? -1 : 0 });
    c.part();
    c.capsule(hx + f, 21.3 + y0 - lift, hx + f + 1.6, 21.3 + y0 - lift, 0.6, 0.55, G.flesh, { bias: far ? -1 : 0 });
  };
  // The far arm, dangling.
  c.part();
  c.capsule(9.6, 10.5 + y0, 9.2 - rake * 0.6, 14.2 + y0, 0.9, 0.7, G.flesh, { bias: -1 });
  c.capsule(9.2 - rake * 0.6, 14.2 + y0, 10 - rake, 17.4 + y0, 0.7, 0.6, G.flesh, { bias: -1 });
  c.px(10 - rake, 18 + y0, G.claw, sphere(0, 0.5), { bias: -1 });
  leg(9.6, 2, true);
  // The hunched back and chest, the ribs in shade.
  c.part();
  c.ellipse(10.6, 11.4 + y0, 3.4, 3.2, G.flesh, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 - 0.2, dy * 0.8 - 0.2, 1) });
  for (const y of [11, 13]) for (const x of [11, 12, 13]) c.shade(x, y + y0, ((x + y) & 1) === 0 ? -1 : 0);
  // Rags of the shroud round the hips, hanging in tatters.
  c.part();
  c.shape(Math.round(13.6 + y0), Math.round(16.4 + y0), (y) => {
    const k = y - Math.round(13.6 + y0);
    return [8.6 - k * 0.3, 13.4 + k * 0.2];
  }, G.rags, (_x, _y, t, u) => sphere(t * 0.8, u * 0.5, 1));
  for (const x of [9, 11, 13]) c.px(x, 17 + y0, G.rags, sphere(0, 0.5), { bias: -1 });
  leg(11.6, 0, false);
  // The head, thrust low and forward, a jaw hanging.
  c.part();
  c.ellipse(14.2, 9.4 + y0, 2.5, 2.3, G.flesh, { normal: (_x, _y, dx, dy) => sphere(dx * 0.85, dy * 0.8 - 0.2, 1) });
  c.part();
  c.shape(Math.round(11.2 + y0), Math.round(11.6 + y0), () => [13.2, 16.6], G.flesh, (_x, _y, t) => sphere(t * 0.6, 0.6, 1), { bias: -1 });
  c.part();
  for (const x of [14, 16]) {
    c.px(x, 9 + y0, EYE);
    c.spark(x, 9 + y0, G.hot, 0.9);
  }
  c.spark(17, 9 + y0, G.mid, 0.3);
  c.shade(15, 11 + y0, -2);
  if (G.moss) {
    // Moss over the back and the crown, a toadstool sprouting from the head.
    c.part();
    for (const [x, y] of [[8, 10], [9, 9], [10, 8], [11, 8], [8, 12], [13, 7], [14, 7]] as const) c.px(x, y + y0, G.moss, sphere(-0.3, -0.6));
    if (G.cap) {
      c.px(15, 6 + y0, G.cap, sphere(-0.3, -0.7));
      c.px(16, 6 + y0, G.cap, sphere(0.4, -0.6));
      c.px(16, 7 + y0, G.claw, sphere(0, 0));
      c.spark(15, 6 + y0, G.mid, 0.25);
    }
  }
  // The near arm, clawing: back over the shoulder, then raked down through.
  const sa = -2.6 + rake * 2.9;
  const ex = 12.2 + Math.cos(sa) * 3.4;
  const ey = 10.8 + y0 + Math.sin(sa) * 3.4;
  const hx = ex + Math.cos(sa + 0.5) * 3.4;
  const hy = ey + Math.sin(sa + 0.5) * 3.4;
  c.part();
  c.capsule(11.6, 10.6 + y0, ex, ey, 1.0, 0.8, G.flesh);
  c.capsule(ex, ey, hx, hy, 0.8, 0.7, G.flesh);
  c.part();
  for (let i = -1; i <= 1; i++) {
    const a = sa + 0.5 + i * 0.45;
    c.px(hx + Math.cos(a) * 1.6, hy + Math.sin(a) * 1.6, G.claw, sphere(Math.cos(a) * 0.5, Math.sin(a) * 0.5));
  }
  // Cut away whatever is still under the ground, and heap the earth round the hole.
  if (under > 0) {
    for (let y = g + 1; y < F.h; y++) for (let x = 0; x < F.w; x++) c.erase(x, y);
    c.part();
    c.shape(g - 1, g + 1, (y) => {
      const hw = y === g - 1 ? 3.4 : 5.6;
      return [11 - hw, 11 + hw];
    }, G.earth, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.5, 1));
    for (const x of [6, 9, 13, 16]) c.shade(x, g, -1);
    if (G.moss) for (const x of [7, 14]) c.px(x, g - 1, G.moss, sphere(0, -0.7));
  }
  return c;
}

export function buildGhoulSheet(G: GraveLook): MonsterSheet {
  return sheet(
    SKELETON_FRAME,
    {
      rise0: () => ghoul(G, { rise: 0.15, rake: 0 }),
      rise1: () => ghoul(G, { rise: 0.4, rake: 0.1 }),
      rise2: () => ghoul(G, { rise: 0.65, rake: 0.3 }),
      rise3: () => ghoul(G, { rise: 0.88, rake: 0.4 }),
      idle0: () => ghoul(G, {}),
      idle1: () => ghoul(G, { bob: 1, rake: 0.55 }),
      walk0: () => ghoul(G, { step: 0 }),
      walk1: () => ghoul(G, { step: 1, bob: -1 }),
      walk2: () => ghoul(G, { step: 2 }),
      walk3: () => ghoul(G, { step: 3, bob: -1 }),
      hit0: () => ghoul(G, { rake: 0 }),
      hit1: () => ghoul(G, { rake: 1.2, step: 2 }),
      hit2: () => ghoul(G, { rake: 1 }),
      fall0: () => ghoul(G, { sink: 0.2, rake: 0.2 }),
      fall1: () => ghoul(G, { sink: 0.45, rake: 0 }),
      fall2: () => ghoul(G, { sink: 0.7, rake: 0 }),
      fall3: () => ghoul(G, { sink: 0.95, rake: 0 }),
    },
    [
      { name: 'rise', frames: ['rise0', 'rise1', 'rise2', 'rise3', 'idle0'], fps: 9, loop: false },
      { name: 'idle', frames: ['idle0', 'idle0', 'idle1', 'idle1'], fps: 5, loop: true },
      { name: 'walk', frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 8, loop: true },
      { name: 'hit', frames: ['hit0', 'hit0', 'hit1', 'hit2', 'idle0'], fps: 12, loop: false },
      { name: 'fall', frames: ['fall0', 'fall1', 'fall2', 'fall3'], fps: 9, loop: false },
    ],
  );
}

// ---------------------------------------------------------------------------
// The headstones

export const STONE_FRAME = { w: 18, h: 22, ox: 9, oy: 20 };
/** How many kinds of stone, and the frames each has: rising out of the ground, standing, cracking, falling apart. */
export const STONE_KINDS = 3;
export const STONE_RISE = 4;
export const STONE_CRUMBLE = 3;

/**
 * One headstone, kind `k`: a round-topped stone with a cross cut in it, a
 * Celtic cross, a leaning slab with a skull. Mossgrave's are standing
 * stones: a tall menhir, a squat one, a split pair, each with a spiral.
 * `rise` cuts what is still under the ground; `crack` 1..3 splits it and
 * it falls in pieces.
 */
function stone(G: GraveLook, k: number, rise: number, crack: number): PixelCanvas {
  const F = STONE_FRAME;
  const c = new PixelCanvas(F.w, F.h);
  const g = F.oy;
  const under = Math.round((1 - rise) * 16);
  const y0 = under + (crack >= 2 ? (crack - 1) * 2 : 0);
  const cx = 9;
  const N = (_x: number, _y: number, t: number, u: number) => sphere(t * 0.85, u * 0.4 - 0.35, 1);
  const glow = crack >= 2 ? 0 : 1;
  if (crack >= 3) {
    // Fallen to a heap of rubble.
    c.part();
    c.ellipse(cx - 2, g - 1, 2.4, 1.4, G.stone);
    c.ellipse(cx + 2.5, g - 0.6, 2, 1.1, G.stone, { bias: -1 });
    c.part();
    c.ellipse(cx, g - 2.2, 1.6, 1.2, G.stone);
    if (G.moss) c.px(cx - 2, g - 2, G.moss, sphere(0, -0.6));
    return c;
  }
  const top = 5 + y0;
  if (G.moss) {
    // Standing stones.
    const shapes = [
      (y: number): [number, number] => {
        const r = y - top;
        return [cx - 3 + (r < 2 ? 1.6 - r * 0.8 : r > 10 ? -0.5 : 0), cx + 3 - (r < 3 ? 2 - r * 0.66 : 0)];
      },
      (y: number): [number, number] => {
        const r = y - top - 3;
        return [cx - 4 + (r < 2 ? 2 - r : 0), cx + 4 - (r < 1 ? 1.5 : 0)];
      },
      (y: number): [number, number] => {
        const r = y - top - 1;
        return [cx - 3.2 + (r < 2 ? 1.8 - r * 0.9 : 0), cx + 2.4 + r * 0.06];
      },
    ];
    c.part();
    c.shape(top + (k === 1 ? 3 : k === 2 ? 1 : 0), g, shapes[k], G.stone, N);
    // The spiral cut in its face, faintly lit.
    const sy = top + (k === 1 ? 8 : 6);
    for (const [dx, dy] of [[0, 0], [1, 0], [1, 1], [0, 2], [-1, 2], [-2, 1], [-2, 0], [-1, -1], [0, -2], [1, -2], [2, -1]] as const) {
      c.px(cx + dx, sy + dy, G.carve, sphere(0, 0), { glow: 0.55 * glow });
    }
    // Moss furring its top and creeping down a side.
    c.part();
    for (const [dx, dy] of [[-1, 0], [0, 0], [1, 0], [-2, 1], [2, 1], [2, 2], [2, 4], [-3, 7], [-3, 8]] as const) {
      const y = top + (k === 1 ? 3 : k === 2 ? 1 : 0) + dy;
      if (c.filled(cx + dx, y)) c.px(cx + dx, y, G.moss!, sphere(dx * 0.2, -0.6));
    }
  } else if (k === 0) {
    // A round-topped headstone, a cross cut in it.
    c.part();
    c.shape(top, g, (y) => {
      const r = y - top;
      const hw = r < 3 ? 3.6 * Math.sqrt(Math.max(0, 1 - ((3 - r) / 3.4) ** 2)) + 0.2 : 3.8;
      return [cx - hw, cx + hw];
    }, G.stone, N);
    for (let y = top + 2; y <= top + 8; y++) c.px(cx, y, G.carve, sphere(0, 0), { glow: 0.6 * glow });
    for (let x = cx - 2; x <= cx + 2; x++) c.px(x, top + 4, G.carve, sphere(0, 0), { glow: 0.6 * glow });
    for (let x = cx - 2; x <= cx + 2; x += 2) c.shade(x, top + 11, -1);
  } else if (k === 1) {
    // A Celtic cross on a plinth.
    c.part();
    c.shape(g - 3, g, () => [cx - 3.4, cx + 3.4], G.stone, N);
    c.part();
    c.shape(top, g - 3, () => [cx - 1.2, cx + 1.2], G.stone, N);
    c.part();
    c.shape(top + 3, top + 4, () => [cx - 3.8, cx + 3.8], G.stone, N);
    // The ring round the crossing.
    for (const [dx, dy] of [[-2, 2], [2, 2], [-2, 5], [2, 5]] as const) c.px(cx + dx, top + dy, G.stone, sphere(dx * 0.3, dy < 3 ? -0.5 : 0.4));
    c.px(cx, top + 3, G.carve, sphere(0, 0), { glow: 0.7 * glow });
    c.px(cx, top + 4, G.carve, sphere(0, 0), { glow: 0.7 * glow });
  } else {
    // A leaning slab, a skull carved on it.
    c.part();
    c.shape(top + 1, g, (y) => {
      const r = y - top - 1;
      const lean = (g - y) * 0.12;
      const cap = r < 1 ? 0.8 : 0;
      return [cx - 3.4 + lean + cap, cx + 3.2 + lean - cap];
    }, G.stone, N);
    const sx = cx + 1;
    const sy = top + 5;
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [0, 1]] as const) c.px(sx + dx, sy + dy, G.carve, sphere(0, 0), { glow: 0.5 * glow });
    c.px(sx - 1, sy + 2, G.carve, sphere(0, 0), { glow: 0.4 * glow });
    c.px(sx + 1, sy + 2, G.carve, sphere(0, 0), { glow: 0.4 * glow });
  }
  if (crack >= 1) {
    // A crack running down from the top, splitting it.
    for (let i = 0; i < 9; i++) {
      const x = cx + (i % 3 === 1 ? 1 : 0) - (i > 5 ? 1 : 0);
      const y = top + 1 + i;
      if (c.filled(x, y)) c.erase(x, y);
    }
  }
  if (crack >= 2) {
    // Half of it has slumped away.
    for (let y = 0; y < g - 6 + 2; y++) for (let x = cx + 1; x < F.w; x++) c.erase(x, y);
  }
  if (under > 0) {
    for (let y = g + 1; y < F.h; y++) for (let x = 0; x < F.w; x++) c.erase(x, y);
  }
  // Earth heaped at its foot.
  c.part();
  c.shape(g - 1, g + 1, (y) => {
    const hw = y === g - 1 ? 3 + (under > 0 ? 1 : 0) : 5;
    return [cx - hw, cx + hw];
  }, G.earth, (_x, _y, t, u) => sphere(t * 0.9, u * 0.6 - 0.5, 1));
  if (G.moss) c.px(cx - 4, g, G.moss, sphere(0, -0.6));
  return c;
}

/** Every stone's frames: `s<k>_r<i>` rising, `s<k>_st` standing, `s<k>_c<i>` cracking and crumbling. */
export function buildStoneSheet(G: GraveLook): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  for (let k = 0; k < STONE_KINDS; k++) {
    for (let i = 0; i < STONE_RISE; i++) poses[`s${k}_r${i}`] = () => stone(G, k, (i + 1) / (STONE_RISE + 1), 0);
    poses[`s${k}_st`] = () => stone(G, k, 1, 0);
    for (let i = 0; i < STONE_CRUMBLE; i++) poses[`s${k}_c${i}`] = () => stone(G, k, 1, i + 1);
  }
  return sheet(STONE_FRAME, poses, []);
}
