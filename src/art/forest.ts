// Art for the Everwood (see world/forestGen.ts): the undergrowth the older
// forests don't have (grass tufts, wildflowers, reeds, mossy boulders and
// giant glowing mushrooms), and the places a walker comes upon: a wayside
// shrine, a treasure chest, standing stones. Lit like the rest of the world
// (diffuse + normal), glowing where it glows. The new trees (cherry, maple,
// willow and the elder) are grown in art/trees.ts with the others.

import { FLAT, PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { hash2, rng } from './env';
import { PROP_ART, type PropArt } from './homeProps';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** Undergrowth frames: 48 x 40, standing on (24, FPROP_BASE_Y). */
export const FPROP_W = 48;
export const FPROP_H = 40;
export const FPROP_BASE_Y = 36;

const GRASS: Material = { ramp: ramp('#10271a', '#173820', '#214c26', '#2e622c', '#3f7a32', '#56923a', '#72aa44', '#94c254'), outline: hex('#08140c'), noOutline: true };
const DRY: Material = { ramp: ramp('#2e2410', '#4a3a18', '#6a5422', '#8c702e', '#b0903e', '#d0b058'), outline: hex('#140f06'), noOutline: true };
const REED: Material = { ramp: ramp('#1a2a12', '#26401a', '#365622', '#4a6e2a', '#628634', '#80a040'), outline: hex('#0a1208'), noOutline: true };
const CATTAIL: Material = { ramp: ramp('#1e0f08', '#34190c', '#4e2612', '#6a361a', '#8a4a24'), outline: hex('#0e0604') };
const STONE: Material = { ramp: ramp('#1b1c20', '#282a2e', '#383a3c', '#4a4c4a', '#5e605a', '#76776c', '#908f80', '#aaa796'), outline: hex('#0c0c0e'), outlineLit: hex('#1b1c20') };
const MOSS: Material = { ramp: ramp('#14301c', '#1d4424', '#29592c', '#387034', '#4b883c', '#64a046', '#84b852'), outline: hex('#0a1a10'), noOutline: true };
const LICHEN: Material = { ramp: ramp('#5a6a3a', '#7e8c4a', '#a6ae62', '#ccd08a'), outline: hex('#1a1e10'), noOutline: true, noAO: true };
const STALK: Material = { ramp: ramp('#5a5448', '#7e7666', '#a39a84', '#c6bda4', '#e2dac4', '#f4eedc'), outline: hex('#1e1a14') };
const GILLS: Material = { ramp: ramp('#2a2430', '#3e3446', '#54485c'), outline: hex('#120e16'), noOutline: true };

/** Wildflower heads, one per variant: bluebells, daisies, poppies, foxgloves. */
const PETALS: Material[] = [
  { ramp: ramp('#1c1c5a', '#2c3490', '#4056c0', '#6282e0', '#94b4f6', '#cadcff'), outline: hex('#0c0c26'), noOutline: true },
  { ramp: ramp('#8a8a9a', '#b4b4c2', '#dcdce4', '#f4f4f8', '#ffffff'), outline: hex('#2a2a30'), noOutline: true },
  { ramp: ramp('#4a0808', '#7e1010', '#b41c16', '#e0321e', '#f86a3a', '#ffa46a'), outline: hex('#1e0404'), noOutline: true },
  { ramp: ramp('#3a0c3a', '#5e1a5e', '#8a2c84', '#b448a8', '#d86ec8', '#f4a6e4'), outline: hex('#1a061a'), noOutline: true },
];
const HEART: Material = { ramp: ramp('#8a5a08', '#c89010', '#f4c428', '#fff08a'), outline: hex('#2a1a04'), noOutline: true, noAO: true };

/** The giant mushrooms' caps: sea-glass teal, and dusk violet. They glow. */
const BIG_CAPS: Material[] = [
  { ramp: ramp('#0e3c3e', '#155a5a', '#1f7e78', '#34a69a', '#5ecab8', '#9ce8d4', '#dcfff2'), outline: hex('#061a1c'), outlineLit: hex('#155a5a'), emissive: 0.4 },
  { ramp: ramp('#28123e', '#3e1c5e', '#5a2a84', '#7a40aa', '#9c62cc', '#c496e6', '#eed6ff'), outline: hex('#120820'), outlineLit: hex('#3e1c5e'), emissive: 0.4 },
];
const SPOTS: Material = { ramp: ramp('#b0e8dc', '#e4fff6', '#ffffff'), outline: hex('#0a1e1c'), noOutline: true, emissive: 0.8, noAO: true };

/** Normals of a surface facing up to the sky, and one facing the viewer. */
const UP: Vec3 = { x: 0, y: 0.62, z: 0.78 };
const FACE: Vec3 = { x: 0, y: -0.1, z: 0.99 };

/**
 * The wind bending everything drawn: px a blade's tip is pushed over per 8 px
 * of its length (see FPROP_BENDS). 0 for the still frames.
 */
let wind = 0;
/** How far the wind pushes the tip of a stem `len` px tall. */
const bent = (len: number): number => (wind * len) / 8;

/** One blade from (x, y), leaning `lean` px over `len` px, curling at the tip. */
function blade(c: PixelCanvas, x: number, y: number, len: number, lean: number, m: Material, lit: number): void {
  for (let s = 0; s < len; s++) {
    const u = s / len;
    const px = x + (lean + bent(len)) * u * u;
    const py = y - s;
    c.px(px, py, m, sphere(Math.sign(lean) * 0.5, -0.3, 0.8), { bias: Math.round(lit + u * 2) - 1 });
  }
}

/** A clump of grass: blades fanning out of one root, bright tips on the sunny side. */
function tuft(c: PixelCanvas, cx: number, by: number, R: () => number, n: number, h: number, m = GRASS): void {
  c.part();
  for (let k = 0; k < n; k++) {
    const u = n === 1 ? 0 : (k / (n - 1)) * 2 - 1;
    const len = Math.round(h * (0.55 + (1 - Math.abs(u)) * 0.5 + R() * 0.25));
    blade(c, cx + u * 3 + (R() - 0.5), by, len, u * (3 + R() * 3), m, -u + R() - 0.5);
  }
}

function grassFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(FPROP_W, FPROP_H);
  const R = rng(8100 + v * 7);
  const by = FPROP_BASE_Y;
  // A big clump with a smaller one or two beside it.
  tuft(c, 24, by, R, 9 + v * 2, 8 + v);
  tuft(c, 16 + R() * 3, by + 1, R, 5, 5);
  if (v !== 1) tuft(c, 31 + R() * 3, by, R, 5, 6);
  // Gone to seed: pale heads nodding on the tallest stems.
  if (v === 2) {
    c.part();
    for (let k = 0; k < 4; k++) {
      const x0 = 20 + R() * 9;
      const y = by - 13 - R() * 3;
      blade(c, x0, by - 7, 7, (R() - 0.5) * 2, DRY, 1);
      const x = x0 + bent(14);
      c.px(x, y - 1, DRY, sphere(0, -0.5), { bias: 2 });
      c.px(x, y, DRY, sphere(0, 0), { bias: 1 });
    }
  }
  return c;
}

/** Wildflowers: a tuft of leaves and a scatter of heads above it, four kinds. */
function flowerFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(FPROP_W, FPROP_H);
  const R = rng(8300 + v * 11);
  const by = FPROP_BASE_Y;
  const petal = PETALS[v % PETALS.length];
  tuft(c, 24, by, R, 7, 6);
  const heads = v === 3 ? 3 : 6 + Math.floor(R() * 3);
  for (let k = 0; k < heads; k++) {
    const x = 16 + R() * 16;
    const stem = v === 3 ? 12 + R() * 5 : 5 + R() * 6;
    c.part();
    blade(c, x, by - 1, stem, (R() - 0.5) * 2, GRASS, 0);
    const hx = Math.floor(x + (R() - 0.5) + bent(stem));
    const hy = Math.floor(by - stem - 1);
    c.part();
    if (v === 0) {
      // Bluebells: a nodding arch of little bells.
      for (let b = 0; b < 3; b++) {
        c.px(hx + b, hy + b, petal, sphere(-0.3, 0.3), { bias: 2 - b });
        c.px(hx + b, hy + b + 1, petal, sphere(0, 0.6), { bias: -b });
      }
    } else if (v === 1) {
      // Daisies: a white star round a yellow heart.
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.px(hx + dx, hy + dy, petal, sphere(dx * 0.6, dy * 0.6), { bias: dy < 0 || dx < 0 ? 1 : 0 });
      c.px(hx, hy, HEART, FLAT, { bias: 1 });
    } else if (v === 2) {
      // Poppies: a cup of red, dark at its heart.
      c.ellipse(hx + 0.5, hy + 0.5, 1.8, 1.4, petal);
      c.px(hx, hy - 1, petal, sphere(-0.4, -0.7), { bias: 2 });
      c.shade(hx, hy, -3);
    } else {
      // Foxgloves: a spire of drooping bells, smaller toward the top.
      for (let b = 0; b < 6; b++) {
        const y = hy + b * 2;
        const w = b < 2 ? 0 : 1;
        c.px(hx, y, petal, sphere(-0.3, -0.2), { bias: 1 });
        if (w) {
          c.px(hx - 1, y + 1, petal, sphere(-0.7, 0.3), { bias: 0 });
          c.px(hx + 1, y + 1, petal, sphere(0.7, 0.3), { bias: -1 });
        }
      }
    }
  }
  return c;
}

/** Reeds and cattails at the water's edge. */
function reedFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(FPROP_W, FPROP_H);
  const R = rng(8500 + v * 13);
  const by = FPROP_BASE_Y;
  const n = 6 + v * 2;
  for (let k = 0; k < n; k++) {
    const x = 17 + (k / (n - 1)) * 14 + (R() - 0.5) * 2;
    const len = 12 + R() * 12;
    const lean = (x - 24) * 0.25 + (R() - 0.5) * 2;
    c.part();
    blade(c, x, by, len, lean, REED, (24 - x) * 0.1 + 0.5);
    // Some carry a cattail's brown head.
    if (k % 2 === 0 && R() < 0.8) {
      const tx = x + (lean + bent(len)) * 0.8;
      const ty = by - len + 2;
      c.part();
      c.capsule(tx, ty, tx, ty + 3.5, 1.1, 1.1, CATTAIL);
      c.px(tx, ty - 2, REED, FLAT, { bias: 2 });
    }
  }
  // Long leaves arching out low down.
  for (let k = 0; k < 4; k++) {
    c.part();
    const s = k % 2 ? 1 : -1;
    const x0 = 24 + s * 2;
    for (let t = 0; t < 10; t++) c.px(x0 + s * t + bent(t * 0.8) * (t / 10), by - 1 - t * 0.9 + t * t * 0.06, REED, sphere(s * 0.3, -0.5), { bias: 1 - Math.floor(t / 4) });
  }
  return c;
}

/** A mossy boulder half sunk in the ground, grey-green with lichen. */
function boulderFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(FPROP_W, FPROP_H);
  const R = rng(8700 + v * 17);
  const by = FPROP_BASE_Y;
  const rx = 12 + v * 2;
  const ry = 10 + v;
  // Its body: a lumpy dome, faceted a little.
  const bumps = Array.from({ length: 7 }, () => ({ a: R() * Math.PI * 2, r: 0.1 + R() * 0.12 }));
  c.part();
  for (let y = by - ry * 1.6; y <= by; y++) {
    for (let x = 24 - rx - 2; x <= 24 + rx + 2; x++) {
      const dx = (x + 0.5 - 24) / rx;
      const dy = (y + 0.5 - (by - ry * 0.6)) / ry;
      const a = Math.atan2(dy, dx);
      let edge = 1;
      for (const b of bumps) edge += Math.cos(a * 2 - b.a) * b.r * 0.4;
      if (dx * dx + dy * dy > edge * edge || y > by) continue;
      c.px(x, y, STONE, sphere(dx * 0.9, dy * 0.9 - 0.15, 0.9));
      // Facets: flat planes of light.
      const lit = -dx * 0.5 - dy * 0.8 + hash2(Math.floor((x + 3) / 5), Math.floor((y + 1) / 4), 871 + v) * 0.35;
      if (lit > 0.75) c.shade(x, y, 1);
      else if (lit < -0.5) c.shade(x, y, -1);
    }
  }
  // Cracks.
  c.part();
  for (let s = 0; s < 2; s++) {
    let x = 24 + (R() - 0.5) * rx;
    let y = by - ry * (0.6 + R() * 0.8);
    for (let t = 0; t < 6; t++) {
      if (c.materialAt(x, y) === STONE) c.shade(x, y, -2);
      x += (R() - 0.5) * 2;
      y += 1;
    }
  }
  // Moss over its top and down its shaded side, lichen on the sunny side.
  c.part();
  for (let y = by - ry * 1.6; y <= by; y++) {
    for (let x = 24 - rx - 2; x <= 24 + rx + 2; x++) {
      if (c.materialAt(x, y) !== STONE || c.filled(x, y - 1)) continue;
      const n = hash2(x, y, 881 + v);
      const d = Math.floor(1 + n * 3);
      for (let j = 0; j < d; j++) if (c.materialAt(x, y + j) === STONE) c.px(x, y + j, MOSS, sphere(0, -0.6 + j * 0.3), { bias: 1 - j });
    }
  }
  for (let t = 0; t < 10 + v * 4; t++) {
    const x = 24 - rx * 0.7 + R() * rx;
    const y = by - ry * 0.4 - R() * ry;
    if (c.materialAt(x, y) === STONE) c.px(x, y, LICHEN, FLAT, { bias: Math.floor(R() * 3) });
  }
  // A few ferns and blades at its foot.
  tuft(c, 24 - rx + 1, by + 1, R, 4, 5);
  tuft(c, 24 + rx - 2, by + 1, R, 3, 4);
  return c;
}

/** A giant mushroom of the hollows: a pale stalk and a broad glowing cap, spotted. */
function bigShroomFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(FPROP_W, FPROP_H);
  const R = rng(8900 + v * 19);
  const by = FPROP_BASE_Y;
  const cap = BIG_CAPS[v % BIG_CAPS.length];
  // A smaller one beside the big one.
  for (const m of [
    { x: 30, h: 12, r: 6, lean: 1.5 },
    { x: 22, h: 24, r: 11, lean: -1 },
  ]) {
    c.part();
    c.shape(by - m.h, by, (y) => {
      const u = (y - (by - m.h)) / m.h;
      const hw = m.r * 0.22 + u * u * m.r * 0.14;
      const x = m.x + m.lean * (1 - u);
      return [x - hw, x + hw];
    }, STALK, (_x, _y, t) => cyl(t, 0.1));
    // A ring on the stalk.
    c.part();
    c.ellipse(m.x + m.lean * 0.4, by - m.h * 0.55, m.r * 0.32, 1, STALK, { bias: 1 });
    // Gills, then the cap over them.
    const top = by - m.h - 1;
    c.part();
    c.ellipse(m.x + m.lean, top + 1.5, m.r * 0.95, m.r * 0.25, GILLS);
    c.part();
    for (let y = Math.floor(top - m.r * 0.72); y <= top + 1; y++) {
      for (let x = Math.floor(m.x + m.lean - m.r - 1); x <= m.x + m.lean + m.r + 1; x++) {
        const dx = (x + 0.5 - m.x - m.lean) / m.r;
        const dy = (y + 0.5 - top - 1) / (m.r * 0.72);
        if (dy > 0 || dx * dx + dy * dy > 1) continue;
        c.px(x, y, cap, sphere(dx, dy * 0.9 + 0.1, 0.9));
      }
    }
    // Pale spots, brightest.
    c.part();
    for (let s = 0; s < Math.round(m.r * 0.9); s++) {
      const a = -Math.PI * (0.1 + R() * 0.8);
      const d = 0.3 + R() * 0.55;
      const x = m.x + m.lean + Math.cos(a) * d * m.r;
      const y = top + 1 + Math.sin(a) * d * m.r * 0.72;
      if (c.materialAt(x, y) === cap) c.px(x, y, SPOTS, FLAT, { bias: R() < 0.5 ? 1 : 0 });
    }
  }
  tuft(c, 18, by + 1, R, 4, 4);
  return c;
}

export type FPropKind = 'tuft' | 'flowers' | 'reeds' | 'boulder' | 'bigshroom';
/** How many looks each has: frames `<kind><v>`. */
export const FPROP_LOOKS: Record<FPropKind, number> = { tuft: 3, flowers: 4, reeds: 2, boulder: 2, bigshroom: 2 };
const FPROP_DRAW: Record<FPropKind, (v: number) => PixelCanvas> = { tuft: grassFrame, flowers: flowerFrame, reeds: reedFrame, boulder: boulderFrame, bigshroom: bigShroomFrame };

export const FPROP_FRAMES: { name: string; draw: () => PixelCanvas }[] = [];
for (const kind of Object.keys(FPROP_LOOKS) as FPropKind[]) {
  for (let v = 0; v < FPROP_LOOKS[kind]; v++) FPROP_FRAMES.push({ name: `${kind}${v}`, draw: () => FPROP_DRAW[kind](v) });
}

/** What bends in a gust, and how hard: frames `<kind><v>~<b>` (b of WIND_BENDS, + leaning right), on their own sheet (see world/ForestWind.ts). */
export const BENDS: FPropKind[] = ['tuft', 'flowers', 'reeds'];
export const WIND_BENDS = [-2, -1, 1, 2];
const BEND_PX = 1.7;
export const FPROP_BENDS: { name: string; draw: () => PixelCanvas }[] = [];
for (const kind of BENDS) {
  for (let v = 0; v < FPROP_LOOKS[kind]; v++) {
    for (const b of WIND_BENDS) {
      FPROP_BENDS.push({
        name: `${kind}${v}~${b}`,
        draw: () => {
          // The same blades from the same seed, only pushed over.
          wind = b * BEND_PX;
          try {
            return FPROP_DRAW[kind](v);
          } finally {
            wind = 0;
          }
        },
      });
    }
  }
}

// ---------------------------------------------------------------- the shrine

export const SHRINE_W = 34;
export const SHRINE_H = 50;
export const SHRINE_BASE_Y = 46;
/** Frames of its glow pulsing while its blessing waits, then one gone dark. */
export const SHRINE_FRAMES = 4;

const SHRINE_STONE: Material = { ramp: ramp('#191b1e', '#25282a', '#343734', '#454840', '#595b4e', '#707060', '#8a8874', '#a6a28a'), outline: hex('#0a0b0c'), outlineLit: hex('#191b1e') };
const ROOF_SLATE: Material = { ramp: ramp('#10161a', '#182228', '#223038', '#2e404a', '#3c525c', '#4e6670'), outline: hex('#06090b') };
const ORB: Material = { ramp: ramp('#2a8a9a', '#48b8c4', '#7ee0e4', '#c0fbfa', '#ffffff'), outline: hex('#0c2e34'), emissive: 1, noAO: true, shine: true };
const ORB_DARK: Material = { ramp: ramp('#1a2426', '#26363a', '#344a4e', '#46605e'), outline: hex('#0a1012'), shine: true };
const RUNE_LIT: Material = { ramp: ramp('#3ab0b0', '#7ae6dc', '#d0fff6'), outline: hex('#0c2e2c'), emissive: 0.9, noAO: true, noOutline: true };

/**
 * A wayside shrine, old and mossed over: a stepped plinth, two posts and a
 * little slate roof sheltering a glowing orb, runes cut in the plinth's face.
 * Frames 0..3 pulse while its blessing waits; `spent` is dark.
 */
export function shrineArt(f: number, spent = false): PixelCanvas {
  const c = new PixelCanvas(SHRINE_W, SHRINE_H);
  const cx = SHRINE_W / 2;
  const by = SHRINE_BASE_Y;
  // The plinth: two steps.
  for (const [w, y0, y1] of [[13, by - 5, by], [9, by - 12, by - 5]] as const) {
    c.part();
    for (let y = y0; y <= y1; y++) {
      for (let x = Math.round(cx - w); x < cx + w; x++) {
        const top = y < y0 + 2;
        c.px(x, y, SHRINE_STONE, top ? UP : x === Math.round(cx - w) ? sphere(-0.6, 0) : FACE, { bias: top ? 1 : 0 });
        if (!top && hash2(x, y, 911) > 0.86) c.shade(x, y, -1);
      }
    }
  }
  // Runes across the upper step's face.
  c.part();
  const runes = [[-6, 0], [-6, 1], [-5, 2], [-3, 0], [-3, 2], [-2, 1], [0, 0], [0, 1], [0, 2], [1, 1], [3, 0], [4, 1], [3, 2], [5, 0], [5, 2]];
  for (const [dx, dy] of runes) {
    if (spent) c.shade(cx + dx, by - 9 + dy, -2);
    else c.px(cx + dx, by - 9 + dy, RUNE_LIT, FLAT, { bias: (dx + f) % 3 === 0 ? 1 : 0 });
  }
  // The posts.
  for (const x of [cx - 6, cx + 5]) {
    c.part();
    for (let y = by - 30; y < by - 12; y++) for (let j = 0; j < 2; j++) c.px(x + j, y, SHRINE_STONE, j ? FACE : sphere(-0.6, 0), { bias: j ? -1 : 0 });
  }
  // The orb in its cradle.
  c.part();
  c.ellipse(cx, by - 14, 4, 1.4, SHRINE_STONE, { bias: 1 });
  c.part();
  c.ellipse(cx, by - 19, 3.6, 3.6, spent ? ORB_DARK : ORB, { bias: spent ? 0 : [0, 1, 1, 0][f % 4] });
  if (!spent) {
    c.px(cx - 1.5, by - 21, ORB, sphere(-0.6, -0.6), { bias: 3 });
    // Its light on the posts' inner faces.
    for (let y = by - 24; y < by - 14; y++) {
      c.shade(cx - 5, y, 2);
      c.shade(cx + 5, y, 1);
    }
    for (let k = 0; k < 3; k++) {
      const a = f * 0.9 + k * 2.1;
      c.spark(cx + Math.cos(a) * 7, by - 22 - ((f * 3 + k * 5) % 12), [140, 250, 240], 0.8);
    }
  }
  // The roof: slate, pitched, its eaves overhanging.
  c.part();
  for (let y = by - 38; y <= by - 30; y++) {
    const u = (y - (by - 38)) / 8;
    const hw = 3 + u * 9;
    for (let x = Math.round(cx - hw); x < cx + hw; x++) {
      const t = (x + 0.5 - cx) / hw;
      c.px(x, y, ROOF_SLATE, sphere(t * 0.7, -0.5, 0.9), { bias: (y - by) % 3 === 0 ? -1 : 0 });
    }
  }
  c.part();
  c.ellipse(cx, by - 38.5, 1.4, 1.2, SHRINE_STONE, { bias: 1 });
  // Moss on the roof ridge and the plinth's top step.
  c.part();
  for (let x = cx - 10; x < cx + 10; x++) {
    if (hash2(x, 1, 921) > 0.45 && c.filled(x, by - 31)) c.px(x, by - 31 - (hash2(x, 2, 923) > 0.6 ? 1 : 0), MOSS, sphere(0, -0.6), { bias: 1 });
    if (hash2(x, 3, 925) > 0.55) c.px(x, by - 5, MOSS, sphere(0, -0.6));
  }
  for (let x = cx - 12; x < cx + 12; x += 1) if (hash2(x, 5, 927) > 0.7) c.px(x, by, MOSS, sphere(0, -0.3));
  return c;
}

// ------------------------------------------------------------------ the chest

export const CHEST_W = 30;
export const CHEST_H = 28;
export const CHEST_BASE_Y = 24;

const CHEST_WOOD: Material = { ramp: ramp('#1e0f08', '#33190c', '#4c2612', '#66351a', '#824624', '#9e5a30', '#b8703e'), outline: hex('#0e0604'), outlineLit: hex('#1e0f08') };
const CHEST_IRON: Material = { ramp: ramp('#18161c', '#28252e', '#3a3642', '#524c5a', '#6e6878'), outline: hex('#0a090c'), shine: true };
const GOLD: Material = { ramp: ramp('#5a3408', '#8e5a10', '#c48a1c', '#eab832', '#fde46a', '#fff8c8'), outline: hex('#2a1404'), shine: true };
const GOLD_GLOW: Material = { ...GOLD, emissive: 0.8, noAO: true };

/** A treasure chest half sunk in moss, iron-banded, a gold lock; open, gold heaped and shining inside. */
export function chestArt(open: boolean): PixelCanvas {
  const c = new PixelCanvas(CHEST_W, CHEST_H);
  const x0 = 5;
  const x1 = 25;
  const by = CHEST_BASE_Y;
  const top = by - 9;
  // The box: its front and ends.
  c.part();
  for (let y = top; y <= by; y++) {
    for (let x = x0; x < x1; x++) {
      const plank = (y - top) % 4 === 3;
      c.px(x, y, CHEST_WOOD, x === x0 ? sphere(-0.7, 0) : FACE, { bias: plank ? -2 : x === x0 ? 0 : hash2(x >> 2, y >> 2, 931) > 0.6 ? 1 : 0 });
    }
  }
  if (open) {
    // The lid thrown back, its inside dark, and treasure heaped in the box.
    c.part();
    for (let y = top - 12; y < top - 1; y++) for (let x = x0 + 1; x < x1 - 1; x++) c.px(x, y, CHEST_WOOD, { x: 0, y: -0.3, z: 0.95 }, { bias: y < top - 10 ? 0 : -2 });
    for (const bx of [x0 + 3, x1 - 4]) for (let y = top - 12; y < top - 1; y++) c.px(bx, y, CHEST_IRON, FACE, { bias: 1 });
    c.part();
    for (let x = x0 + 1; x < x1 - 1; x++) c.px(x, top, CHEST_WOOD, UP, { bias: -3 });
    c.part();
    for (let x = x0 + 2; x < x1 - 2; x++) {
      const h = 2 + Math.round(Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 2 + hash2(x, 0, 933));
      for (let j = 0; j < h; j++) c.px(x, top - j + 1, GOLD_GLOW, sphere(0, -0.6), { bias: (x + j) % 3 === 0 ? 2 : 0 });
    }
    for (let k = 0; k < 4; k++) c.spark(x0 + 4 + k * 4, top - 4 - (k % 2) * 2, [255, 230, 140], 0.9);
  } else {
    // The rounded lid, turning from the sky to the viewer.
    c.part();
    for (let y = top - 7; y < top; y++) {
      const u = (y - (top - 7)) / 7;
      const inset = u < 0.2 ? 1 : 0;
      for (let x = x0 + inset; x < x1 - inset; x++) c.px(x, y, CHEST_WOOD, { x: 0, y: 0.9 - u * 1.2, z: 0.6 }, { bias: x === x0 ? 1 : 0 });
    }
  }
  // Iron bands and corners, the gold lock.
  c.part();
  for (const bx of [x0 + 3, x1 - 4]) for (let y = open ? top : top - 7; y <= by; y++) c.px(bx, y, CHEST_IRON, y < top ? UP : FACE, { bias: 1 });
  for (let x = x0; x < x1; x++) c.px(x, by, CHEST_IRON, FACE, { bias: -1 });
  c.part();
  const lx = (x0 + x1) / 2 - 1.5;
  for (let y = top - 1; y < top + 3; y++) for (let x = lx; x < lx + 3; x++) c.px(x, y, GOLD, FACE, { bias: y === top - 1 ? 2 : 0 });
  c.px(lx + 1, top + 1, CHEST_IRON, FACE, { bias: -3 });
  // Moss creeping up its foot.
  c.part();
  for (let x = x0 - 2; x < x1 + 2; x++) {
    const h = Math.floor(hash2(x, 7, 937) * 3);
    for (let j = 0; j < h; j++) c.px(x, by - j + 1, MOSS, sphere(0, -0.5), { bias: 1 - j });
  }
  return c;
}

// ------------------------------------------------------------ standing stones

export const MENHIR_W = 20;
export const MENHIR_H = 40;
export const MENHIR_BASE_Y = 37;
export const MENHIR_LOOKS = 3;

const RUNE_FAINT: Material = { ramp: ramp('#3a7a9a', '#62a8d0', '#a6dcff'), outline: hex('#0a1a24'), emissive: 0.7, noAO: true, noOutline: true };

/** A standing stone, tall and weathered, leaning a little, a rune cut down its face that glows at night. */
export function menhirArt(v: number): PixelCanvas {
  const c = new PixelCanvas(MENHIR_W, MENHIR_H);
  const R = rng(9500 + v * 23);
  const cx = MENHIR_W / 2;
  const by = MENHIR_BASE_Y;
  const h = 24 + v * 4 + Math.floor(R() * 4);
  const lean = (R() - 0.5) * 3;
  const w0 = 5 + R();
  const nicks = Array.from({ length: 6 }, () => (R() - 0.5) * 1.2);
  c.part();
  for (let y = by - h; y <= by; y++) {
    const u = (y - (by - h)) / h;
    // Rounded shoulders, a waist, a broad foot.
    const hw = w0 * (0.55 + Math.sqrt(Math.min(1, u * 5)) * 0.35 + u * 0.15) + nicks[Math.floor(u * 5.99)];
    const x = cx + lean * (1 - u);
    for (let px = Math.round(x - hw); px < x + hw; px++) {
      const t = (px + 0.5 - x) / hw;
      const topFace = y < by - h + 3;
      c.px(px, y, STONE, topFace ? sphere(t * 0.6, -0.7) : cyl(t, 0.05), { bias: hash2(px >> 1, y >> 2, 951 + v) > 0.8 ? -1 : 0 });
    }
  }
  // The rune down its face.
  c.part();
  const rx = Math.round(cx + lean * 0.4) - 1;
  const ry = by - h + 7;
  const shapes = [
    [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [0, 1], [2, 2], [0, 3], [2, 4]],
    [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4], [1, 5], [2, 0], [2, 4]],
    [[1, 0], [0, 1], [2, 1], [1, 2], [1, 3], [0, 4], [2, 4], [1, 5]],
  ][v % 3];
  for (const [dx, dy] of shapes) c.px(rx + dx, ry + dy, RUNE_FAINT, FLAT);
  // Lichen and moss.
  c.part();
  for (let k = 0; k < 10; k++) {
    const x = cx - w0 + R() * w0 * 2;
    const y = by - h * R();
    if (c.materialAt(x, y) === STONE) c.px(x, y, R() < 0.5 ? LICHEN : MOSS, FLAT, { bias: Math.floor(R() * 2) });
  }
  c.part();
  for (let x = Math.round(cx - w0 - 2); x < cx + w0 + 2; x++) {
    const d = Math.floor(hash2(x, 9, 957 + v) * 4);
    for (let j = 0; j < d; j++) c.px(x, by - j + 1, MOSS, sphere(0, -0.5), { bias: 1 - j });
  }
  return c;
}

// ------------------------------------------------------------------ the camp

/** The Home's campfire (see art/homeProps.ts), burning in the forest's camps: 4 frames. */
export const CAMPFIRE: PropArt = PROP_ART.campfire;
/** Where its fire sits on the ground, in its frame. */
export const CAMPFIRE_FOOT = { x: CAMPFIRE.w / 2, y: CAMPFIRE.h - 7 };

// ------------------------------------------------------------------ cliffs

/** A lookout's parapet: 48 x 34, standing on (24, LOOKOUT_BASE_Y), its foot along a cliff's lip. */
export const LOOKOUT_W = 48;
export const LOOKOUT_H = 34;
export const LOOKOUT_BASE_Y = 30;

const PARAPET: Material = { ramp: ramp('#18171a', '#252326', '#353230', '#47423b', '#5c5547', '#746a57', '#8e8469', '#aaa080'), outline: hex('#0a0a0c'), outlineLit: hex('#18171a') };
const BRASS: Material = { ramp: ramp('#2e1c06', '#4e320c', '#765016', '#a2742a', '#cc9c40', '#ecc66a', '#fff0b4'), outline: hex('#160c02'), shine: true };
const LEATHER: Material = { ramp: ramp('#1a0e08', '#2c1a10', '#422818', '#5a3a22'), outline: hex('#0c0604') };
const LENS: Material = { ramp: ramp('#1e3a48', '#3c6e86', '#7ab8d2', '#d4f4ff'), outline: hex('#0a1a20'), shine: true, emissive: 0.35, noAO: true };

/**
 * A lookout at a cliff's lip: a low dry-stone parapet bowed along the edge,
 * capstones mossed and uneven, a little cairn at one end and, on a post at
 * the other, a brass spyglass on a swivel, trained out over the treetops.
 */
export function lookoutArt(): PixelCanvas {
  const c = new PixelCanvas(LOOKOUT_W, LOOKOUT_H);
  const R = rng(9711);
  const x0 = 4;
  const x1 = 43;
  const mid = (x0 + x1) / 2;
  // The wall bows south in its middle, as the lip does.
  const foot = (x: number) => LOOKOUT_BASE_Y - Math.round(2.6 * ((x + 0.5 - mid) / ((x1 - x0) / 2)) ** 2);
  const H = 7;
  const tops: number[] = [];

  // The spyglass's post stands behind the wall: drawn first, the wall goes in front of its foot.
  c.part();
  const px0 = 33;
  const postTop = foot(px0) - H - 8;
  for (let y = postTop; y < foot(px0) - H + 1; y++) for (let x = px0; x < px0 + 3; x++) c.px(x, y, PARAPET, cyl((x - px0 - 1) / 1.5), { bias: y === postTop ? 1 : 0 });
  c.part();
  c.ellipse(px0 + 1.5, postTop - 0.5, 1.8, 1.4, BRASS);
  // The spyglass: eyepiece at the back (west), wide objective out east, tipped a little down toward the view.
  c.part();
  c.capsule(px0 - 5, postTop - 3, px0 + 7, postTop - 1, 1.1, 1.8, BRASS);
  c.part();
  for (let k = 0; k < 3; k++) c.px(px0 - 1 + k, postTop - 2 + (k > 1 ? 0 : -1) + 1, LEATHER, cyl(0, 0.6));
  c.part();
  c.px(px0 + 8, postTop - 2, LENS, sphere(0.6, -0.2));
  c.px(px0 + 8, postTop - 1, LENS, sphere(0.6, 0.3));
  c.px(px0 - 6, postTop - 3, LEATHER, FLAT);

  // The wall: capstones on top, coursed stones below with dark joints.
  c.part();
  for (let x = x0; x <= x1; x++) {
    const fy = foot(x);
    const end = x === x0 || x === x1 ? 1 : 0;
    const top = fy - H + end - (hash2(x >> 2, 1, 9713) > 0.68 ? 1 : 0);
    tops[x] = top;
    for (let y = top; y <= fy; y++) {
      const down = y - top;
      if (down < 2) {
        const stone = Math.floor((x + 1) / 4);
        c.px(x, y, PARAPET, down === 0 ? UP : sphere(0, -0.3), { bias: (down === 0 ? 2 : 0) + (hash2(stone, 3, 9715) > 0.6 ? 1 : 0) - ((x + 1) % 4 === 0 ? 1 : 0) });
        continue;
      }
      const row = Math.floor((down - 2) / 3);
      const bw = 4 + Math.floor(hash2(row, 0, 9717) * 3);
      const along = x + row * 2;
      const joint = along % bw === 0 || (down - 2) % 3 === 2;
      const t = end ? (x === x0 ? -0.8 : 0.8) : 0;
      c.px(x, y, PARAPET, end ? cyl(t, -0.1) : FACE, { bias: joint ? -2 : Math.round((hash2(Math.floor(along / bw), row, 9719) - 0.5) * 2) - (y > fy - 1 ? 1 : 0) });
    }
  }
  // Moss on the capstones and in the joints near the foot.
  c.part();
  for (let k = 0; k < 16; k++) {
    const x = x0 + 1 + Math.floor(R() * (x1 - x0 - 1));
    const y = tops[x] + (R() < 0.6 ? 0 : Math.floor(R() * (foot(x) - tops[x])));
    if (c.materialAt(x, y) === PARAPET) c.px(x, y, R() < 0.3 ? LICHEN : MOSS, FLAT, { bias: Math.floor(R() * 2) });
  }
  // A cairn of three stones on the west end.
  c.part();
  const kx = x0 + 5;
  const ky = tops[kx];
  c.ellipse(kx, ky - 1.5, 3.4, 2.1, STONE, { bias: 0 });
  c.part();
  c.ellipse(kx + 0.5, ky - 4.2, 2.5, 1.7, STONE, { bias: 1 });
  c.part();
  c.ellipse(kx, ky - 6.4, 1.7, 1.3, STONE, { bias: 1 });
  // Grass at the wall's foot.
  c.part();
  for (let x = x0; x <= x1; x += 3 + Math.floor(R() * 3)) tuft(c, x, foot(x) + 1, R, 2 + Math.floor(R() * 3), 3);
  return c;
}

// ------------------------------------------------------------ the wild places

/** The great glowcap at the heart of a glowcap grove: 56 x 64, standing on (28, GREATCAP_BASE_Y). */
export const GREATCAP_W = 56;
export const GREATCAP_H = 64;
export const GREATCAP_BASE_Y = 60;

const GREAT_CAP: Material = { ramp: ramp('#0a3034', '#11484a', '#196662', '#24887e', '#3aaa9a', '#62cab4', '#a0e6d2', '#e0fff4'), outline: hex('#041416'), outlineLit: hex('#11484a'), emissive: 0.45 };
const GREAT_CAP_DIM: Material = { ...GREAT_CAP, emissive: 0.12 };
const GILL_GLOW: Material = { ramp: ramp('#1a5a5a', '#2c8a84', '#58c4b4', '#a8f4e4'), outline: hex('#061a1a'), noOutline: true, emissive: 0.9, noAO: true };
const GILL_DIM: Material = { ...GILL_GLOW, emissive: 0.2 };
const SPOTS_DIM: Material = { ...SPOTS, emissive: 0.25 };
const ROOT: Material = { ramp: ramp('#3e3830', '#5a5244', '#7a705c', '#9c9078', '#bcb096'), outline: hex('#16120e') };

/**
 * The great glowcap: a giant of a mushroom, its stalk flaring into roots
 * that grip the moss, a ragged skirt halfway up, and a broad cap whose rim
 * droops, sea-glass teal with pale spots, its gills glowing beneath. Two
 * young ones crowd its foot. Once its spores are taken (`spent`) its glow
 * is low until the next visit.
 */
export function greatCapArt(spent: boolean): PixelCanvas {
  const c = new PixelCanvas(GREATCAP_W, GREATCAP_H);
  const R = rng(9901);
  const by = GREATCAP_BASE_Y;
  const cx = 28;
  const cap = spent ? GREAT_CAP_DIM : GREAT_CAP;
  const gill = spent ? GILL_DIM : GILL_GLOW;
  const spots = spent ? SPOTS_DIM : SPOTS;
  const stalkH = 30;
  // The stalk: thick, leaning a touch, flaring at the foot.
  const lean = (u: number) => cx + 1.5 * (1 - u) * (1 - u);
  c.part();
  c.shape(by - stalkH, by, (y) => {
    const u = (y - (by - stalkH)) / stalkH;
    const hw = 3.6 + u * 1.2 + Math.max(0, u - 0.78) ** 2 * 60;
    return [lean(u) - hw, lean(u) + hw];
  }, STALK, (_x, _y, t) => cyl(t, 0.08), {});
  // Roots splaying out over the ground.
  c.part();
  for (const [dx, len, up] of [[-1, 9, 2], [1, 8, 1], [-1, 5, 0], [1, 5, 0]] as const) {
    const x0 = cx + dx * 4;
    c.capsule(x0, by - 2 - up, x0 + dx * len, by + (up ? 0 : 1), 1.6, 0.6, ROOT);
  }
  // Fibres down the stalk.
  c.part();
  for (let k = 0; k < 7; k++) {
    const x = cx - 3 + R() * 6;
    const y0 = by - stalkH + 6 + R() * 8;
    for (let y = y0; y < y0 + 4 + R() * 8; y++) if (c.materialAt(x, y) === STALK) c.shade(Math.floor(x), Math.floor(y), -1);
  }
  // The skirt, ragged at its hem.
  c.part();
  const skY = by - stalkH + 8;
  c.shape(skY - 1, skY + 3, (y) => {
    const u = (y - skY + 1) / 4;
    const hw = 4.6 + u * 2.4;
    return [lean(0.25) - hw, lean(0.25) + hw];
  }, STALK, (_x, _y, t, u) => ({ x: t * 0.7, y: -0.3 + u * 0.4, z: 0.7 }), { bias: 1 });
  for (let x = Math.floor(lean(0.25) - 7); x <= lean(0.25) + 7; x++) if (hash2(x, 1, 9903) > 0.55) c.erase(x, skY + 3);
  // Gills under the cap: a dark ring with glowing lines fanning out.
  const top = by - stalkH - 1;
  const capR = 22;
  c.part();
  c.ellipse(cx + 1, top + 1, capR - 2, 4.2, GILLS, { normal: () => ({ x: 0, y: 0.8, z: 0.6 }) });
  c.part();
  for (let k = -9; k <= 9; k++) {
    const a = k / 9;
    for (let s = 0.25; s < 1; s += 0.08) {
      const x = cx + 1 + a * (capR - 3) * s;
      const y = top + 1 + Math.sqrt(Math.max(0, 1 - a * a)) * 3.6 * s;
      if (c.materialAt(x, y) === GILLS) c.px(Math.floor(x), Math.floor(y), gill, FLAT, { bias: s > 0.7 ? 1 : 0 });
    }
  }
  // The cap: a broad dome, its rim drooping lower at the sides.
  c.part();
  const capH = 17;
  for (let y = top - capH; y <= top + 3; y++) {
    for (let x = cx + 1 - capR - 1; x <= cx + 1 + capR + 1; x++) {
      const dx = (x + 0.5 - cx - 1) / capR;
      if (Math.abs(dx) > 1) continue;
      const rim = top + 1 + dx * dx * 2.6 - (1 - dx * dx) * 1.2;
      const dome = top - capH * Math.sqrt(1 - dx * dx) * (0.92 + 0.08 * Math.cos(dx * 3));
      if (y < dome || y > rim) continue;
      const n = sphere(dx * 0.95, Math.max(-1, Math.min(1, -0.75 + (y - dome) / (top + 2 - dome) * 1.4)), 0.85);
      c.px(x, y, cap, n, { bias: y > rim - 1 ? -1 : 0 });
    }
  }
  // Spots, larger toward the crown.
  c.part();
  for (let s = 0; s < 18; s++) {
    const a = -Math.PI * (0.08 + R() * 0.84);
    const d = 0.2 + R() * 0.7;
    const x = cx + 1 + Math.cos(a) * d * capR;
    const y = top - 1 + Math.sin(a) * d * capH;
    const big = d < 0.55 && R() < 0.6;
    for (const [ox, oy] of big ? [[0, 0], [1, 0], [0, -1], [1, -1]] : [[0, 0]]) {
      if (c.materialAt(x + ox, y + oy) === cap) c.px(Math.floor(x + ox), Math.floor(y + oy), spots, FLAT, { bias: oy ? 1 : 0 });
    }
  }
  // Two young ones at its foot, one dusk violet.
  for (const m of [
    { x: 12, h: 9, r: 5, cap: BIG_CAPS[1] },
    { x: 44, h: 6, r: 4, cap: BIG_CAPS[0] },
  ]) {
    c.part();
    c.shape(by - m.h, by, (y) => {
      const u = (y - (by - m.h)) / m.h;
      const hw = 1.1 + u * 0.6;
      return [m.x - hw, m.x + hw];
    }, STALK, (_x, _y, t) => cyl(t, 0.1));
    c.part();
    const t0 = by - m.h;
    for (let y = Math.floor(t0 - m.r * 0.8); y <= t0 + 1; y++) {
      for (let x = Math.floor(m.x - m.r - 1); x <= m.x + m.r + 1; x++) {
        const dx = (x + 0.5 - m.x) / m.r;
        const dy = (y + 0.5 - t0 - 1) / (m.r * 0.8);
        if (dy > 0 || dx * dx + dy * dy > 1) continue;
        c.px(x, y, spent ? { ...m.cap, emissive: 0.15 } : m.cap, sphere(dx, dy * 0.9 + 0.1, 0.9));
      }
    }
    c.part();
    c.px(m.x - 1, t0 - Math.round(m.r * 0.45), spots, FLAT);
  }
  // Moss and grass round the foot.
  c.part();
  for (let x = cx - 12; x < cx + 12; x++) {
    const h = Math.floor(hash2(x, 3, 9905) * 3);
    for (let j = 0; j < h; j++) c.px(x, by - j + 1, MOSS, sphere(0, -0.5), { bias: 1 - j });
  }
  tuft(c, 6, by + 1, R, 3, 4);
  tuft(c, 50, by + 1, R, 3, 4);
  // Spores hanging in the air under the cap's glow.
  if (!spent) for (let k = 0; k < 6; k++) c.spark(cx - 16 + R() * 34, top + 4 + R() * 14, [150, 255, 220], 0.7);
  return c;
}

/** The hunter's camp: the lean-to (frame 'lean') and the drying rack ('rack'), each 56 x 44 on (28, HUNT_BASE_Y). */
export const HUNT_W = 56;
export const HUNT_H = 44;
export const HUNT_BASE_Y = 40;

const POLE: Material = { ramp: ramp('#1e140c', '#2e2014', '#42301e', '#58422a', '#705636', '#8a6c44', '#a48656'), outline: hex('#0e0905'), outlineLit: hex('#1e140c') };
const BARK_SHEET: Material = { ramp: ramp('#1a120c', '#281c12', '#3a2a1c', '#4c3826', '#604832'), outline: hex('#0c0805') };
const BOUGH: Material = { ramp: ramp('#0c1e16', '#12301e', '#1a4428', '#245834', '#327042', '#468a50'), outline: hex('#06100a'), noOutline: true };
const HIDE: Material = { ramp: ramp('#3a2414', '#563620', '#74502e', '#946c40', '#b48a56', '#d0aa74'), outline: hex('#1a0e06') };
const FUR: Material = { ramp: ramp('#2a1e16', '#3e2e22', '#564232', '#6e5844', '#8a7258', '#a68e72'), outline: hex('#120c08'), noOutline: true };
const ROPE: Material = { ramp: ramp('#5a4a30', '#7e6a46', '#a28c60', '#c4ae80'), outline: hex('#241c10'), noOutline: true };
const LAMP_GLASS: Material = { ramp: ramp('#c86a1a', '#f0a030', '#ffd060', '#fff2b0'), outline: hex('#2a1404'), emissive: 1, noAO: true };
const IRON: Material = { ramp: ramp('#141418', '#222228', '#34343c', '#4a4a54'), outline: hex('#08080a'), shine: true };
const HERB: Material = { ramp: ramp('#2a3a16', '#3e5420', '#566e2c', '#70883a'), outline: hex('#121a08'), noOutline: true };
const FISH_SKIN: Material = { ramp: ramp('#3a4a52', '#5a6e78', '#8298a0', '#b0c4c8'), outline: hex('#141c20'), shine: true };

/**
 * A hunter's lean-to, left as if they'd only just gone, seen from its open
 * end: poles laid from the ground up onto a crossbar on forked posts,
 * thatched with bark and spruce boughs, their ends poking out past the bar;
 * in the dark under the slope a fur bedroll and a pack; a pelt hung on the
 * post, and a little lantern hanging from the bar that someone keeps lit.
 */
export function leanToArt(): PixelCanvas {
  const c = new PixelCanvas(HUNT_W, HUNT_H);
  const R = rng(9921);
  const by = HUNT_BASE_Y;
  // The roof runs from the ground at xa up to height Z at xb, and DEPTH px back (north), drawn 0.7 to the px.
  const xa = 5;
  const xb = 41;
  const Z = 25;
  const DEPTH = 15;
  const zAt = (x: number) => ((x - xa) / (xb - xa)) * Z;
  const edge = (x: number) => by - zAt(x);
  // Under the slope, seen through the open south end: the dark inside, darker toward the low end.
  c.part();
  for (let x = xa + 2; x < xb; x++) {
    for (let y = Math.ceil(edge(x)); y <= by; y++) {
      const deep = 1 - (x - xa) / (xb - xa);
      c.px(x, y, BARK_SHEET, { x: 0.3, y: 0.2, z: 0.9 }, { bias: -3 - Math.round(deep) + (y > by - 2 ? 1 : 0) });
    }
  }
  // The bedroll, a pack and a bow propped inside.
  c.part();
  c.shape(by - 6, by - 1, (y) => [19 + (by - 6 - y) * -0.4, 37 - (by - 6 - y) * -0.2], FUR, (_x, _y, t, u) => ({ x: t * 0.4, y: 0.6 - u * 0.9, z: 0.7 }), {});
  for (let k = 0; k < 12; k++) {
    const x = 20 + R() * 16;
    const y = by - 6 + R() * 5;
    if (c.materialAt(x, y) === FUR) c.shade(Math.floor(x), Math.floor(y), R() < 0.5 ? 1 : -1);
  }
  c.part();
  c.line(23, by - 4, 34, by - 4, HIDE, () => FLAT, { bias: -1 });
  c.part();
  c.ellipse(35, by - 12, 3.4, 4.2, HIDE, { bias: -1 });
  c.part();
  c.line(33, by - 14, 37, by - 14, ROPE);
  // The roof's top: poles laid along the slope, thatched with bark and boughs, ragged at its edges.
  c.part();
  for (let x = xa; x <= xb + 1; x++) {
    const z = zAt(Math.min(x, xb));
    for (let y = Math.floor(by - z - DEPTH * 0.7 - 2); y <= by - z + 1; y++) {
      const n = (by - z - y) / 0.7;
      const rag = (hash2(x, y, 9931) - 0.5) * 2.4;
      if (n < -0.6 + (rag > 0.8 ? -1 : 0) || n > DEPTH + rag) continue;
      const pole = Math.floor(n + 0.5) % 3 === 0;
      const sheet = hash2(x >> 2, Math.floor(n / 3), 9927) > 0.78;
      const m = sheet ? BARK_SHEET : pole && hash2(x >> 1, Math.floor(n), 9933) > 0.4 ? POLE : BOUGH;
      const lit = n > DEPTH - 3 ? 1 : n < 1.5 ? -1 : 0;
      c.px(x, y, m, { x: -0.55, y: 0.55, z: 0.63 }, { bias: lit + (m === BOUGH && hash2(x, y, 9929) > 0.68 ? 1 : 0) + (m === POLE ? 1 : 0) });
    }
  }
  // Needle tips standing up out of the thatch.
  c.part();
  for (let k = 0; k < 34; k++) {
    const x = xa + 2 + R() * (xb - xa - 2);
    const y = by - zAt(x) - DEPTH * 0.7 - R() * 2;
    if (!c.filled(Math.floor(x), Math.floor(y))) c.px(Math.floor(x), Math.floor(y), BOUGH, UP, { bias: 2 });
  }
  // The posts, front and back, and the crossbar resting in their forks; the poles' ends poke out past it.
  const top = by - Z;
  c.part();
  c.capsule(xb + 1, top - DEPTH * 0.7 - 2, xb + 1, by - DEPTH * 0.7, 1.3, 1.4, POLE, { bias: -1 });
  c.part();
  for (let k = 0; k < 4; k++) {
    const y = top - 2 - k * 2.6;
    c.capsule(xb - 1, y + 1.5, xb + 3 + (k % 2), y - 1, 0.8, 0.6, POLE, { bias: k % 2 });
  }
  c.part();
  c.capsule(xb + 1, top + 1, xb + 1, top - DEPTH * 0.7 - 1, 1.3, 1.3, POLE, { bias: 1 });
  c.part();
  c.capsule(xb + 1, by, xb + 1, top - 1, 1.6, 1.4, POLE);
  c.capsule(xb + 1, top + 1, xb - 1, top - 3, 0.8, 0.6, POLE);
  c.capsule(xb + 1, top + 1, xb + 3, top - 3, 0.8, 0.6, POLE);
  // A pelt hung on the front post.
  c.part();
  c.shape(top + 4, top + 15, (y) => {
    const u = (y - top - 4) / 11;
    const hw = 2.4 + Math.sin(u * Math.PI) * 1.4;
    return [xb + 1 - hw + 0.5, xb + 1 + hw + 0.5];
  }, HIDE, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.line(xb - 1, top + 4, xb + 3, top + 4, ROPE);
  // The lantern, on a cord from the crossbar's end.
  const lx = xb + 7;
  c.part();
  c.line(xb + 3, top - 2, lx, top - 1, ROPE);
  c.line(lx, top - 1, lx, top + 2, ROPE);
  c.part();
  for (const dx of [-1, 0, 1]) c.px(lx + dx, top + 3, IRON, UP);
  for (let y = top + 4; y < top + 8; y++) {
    c.px(lx - 1, y, IRON, cyl(-0.8));
    c.px(lx, y, LAMP_GLASS, FLAT, { bias: y === top + 5 ? 1 : 0 });
    c.px(lx + 1, y, IRON, cyl(0.8));
  }
  c.px(lx, top + 8, IRON, FLAT);
  c.spark(lx, top + 5, [255, 210, 120], 1);
  // Grass and a stone or two round the low end.
  c.part();
  tuft(c, xa - 1, by + 1, R, 3, 4);
  tuft(c, xa + 7, by + 1, R, 2, 3);
  tuft(c, xb + 4, by + 1, R, 2, 3);
  return c;
}

/**
 * A drying rack: two crossed trestles holding a pole, a hide stretched on a
 * frame of sticks at one end, and from the rest herbs and a couple of
 * fish hung to cure.
 */
export function rackArt(): PixelCanvas {
  const c = new PixelCanvas(HUNT_W, HUNT_H);
  const R = rng(9941);
  const by = HUNT_BASE_Y;
  const x0 = 12;
  const x1 = 44;
  const barY = by - 20;
  // The trestles: two legs crossed under each end of the pole.
  c.part();
  for (const px of [x0, x1]) {
    c.capsule(px - 4, by, px + 1, barY - 2, 1.1, 0.9, POLE);
    c.capsule(px + 4, by, px - 1, barY - 2, 1.1, 0.9, POLE, { bias: -1 });
  }
  // A hide on a frame of sticks, hung from the west end.
  c.part();
  const hx0 = x0 + 2;
  const hx1 = x0 + 13;
  for (let y = barY + 2; y < by - 6; y++) {
    const u = (y - barY - 2) / (by - 8 - barY);
    const inset = Math.sin(u * Math.PI) * 1.2;
    for (let x = Math.round(hx0 + inset); x < hx1 - inset; x++) {
      const t = ((x + 0.5 - hx0) / (hx1 - hx0)) * 2 - 1;
      c.px(x, y, HIDE, { x: t * 0.3, y: -0.1, z: 0.95 }, { bias: hash2(x >> 1, y >> 1, 9943) > 0.75 ? 1 : 0 });
    }
  }
  c.part();
  c.line(hx0 - 1, barY + 1, hx0 - 1, by - 6, POLE);
  c.line(hx1, barY + 1, hx1, by - 6, POLE);
  c.line(hx0 - 1, by - 6, hx1, by - 6, POLE);
  for (const [ax, ay] of [[hx0, barY + 2], [hx1 - 1, barY + 2], [hx0, by - 7], [hx1 - 1, by - 7]]) c.px(ax, ay, ROPE, FLAT, { bias: 1 });
  // The pole across.
  c.part();
  c.capsule(x0 - 2, barY - 1, x1 + 2, barY, 1.3, 1.2, POLE);
  // Bundles of herbs and two fish hung along it.
  for (const [hx, kind] of [[29, 'herb'], [33, 'fish'], [37, 'herb'], [41, 'fish']] as const) {
    c.part();
    c.line(hx, barY + 1, hx, barY + 3, ROPE);
    c.part();
    if (kind === 'herb') {
      for (let k = 0; k < 9; k++) c.line(hx, barY + 3, hx + Math.round((R() - 0.5) * 5), barY + 8 + Math.round(R() * 4), HERB, () => cyl(0, 0.3), { bias: Math.floor(R() * 3) });
      c.px(hx, barY + 3, ROPE, FLAT, { bias: 1 });
    } else {
      // Hung by the tail: the forked tail up top, the body swelling, the head down.
      c.shape(barY + 4, barY + 14, (y) => {
        const u = (y - barY - 4) / 10;
        const hw = u < 0.12 ? 1.9 : u < 0.25 ? 0.7 : 0.7 + Math.sin(((u - 0.25) / 0.75) * Math.PI * 0.85) * 1.5;
        return [hx - hw + 0.5, hx + hw + 0.5];
      }, FISH_SKIN, (_x, _y, t) => cyl(t, 0.1));
      c.erase(hx, barY + 4);
      c.px(hx, barY + 12, IRON, FLAT);
    }
  }
  // Grass at the legs' feet.
  c.part();
  for (const fx of [x0 - 4, x0 + 4, x1 - 4, x1 + 4]) tuft(c, fx, by + 1, R, 2, 3);
  return c;
}

// ------------------------------------------------------------ blessings' badges

/** A 16 x 16 badge drawn from rows of palette letters, outlined in the badges' dark. */
function badge(rows: string[], pal: Record<string, string>): Uint8ClampedArray {
  const w = 16;
  const px = new Uint8ClampedArray(w * w * 4);
  const put = (x: number, y: number, c: string) => {
    const n = parseInt(c.slice(1), 16);
    px.set([n >> 16, (n >> 8) & 255, n & 255, 255], (y * w + x) * 4);
  };
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && pal[ch] && put(x, y, pal[ch])));
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < w && px[(y * w + x) * 4 + 3] === 255;
  const out: [number, number][] = [];
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) out.push([x, y]);
  for (const [x, y] of out) put(x, y, '#0c1020');
  return px;
}

/** Sunlit: the glade's sun, rays round it, over a sprig of green. */
export const sunBuffIcon = (): Uint8ClampedArray =>
  badge(
    [
      '................',
      '.......y........',
      '..y....y....y...',
      '...y.......y....',
      '......ooo.......',
      '.....oYYYo......',
      'yy..oYwwYYo..yy.',
      '....oYwYYYo.....',
      '....oYYYYOo.....',
      '.....oYYOo......',
      '...y..ooo..y....',
      '..y.........y...',
      '.......g........',
      '......gGg.g.....',
      '....gg.G.gG.....',
      '........G.......',
    ],
    { y: '#ffe680', o: '#e8a020', Y: '#ffd040', O: '#d88a18', w: '#fffbe0', g: '#7cd860', G: '#3a8a3a' },
  );

/** Moonlit: the glade by night, a crescent and two stars. */
export const moonBuffIcon = (): Uint8ClampedArray =>
  badge(
    [
      '................',
      '..........s.....',
      '.....bbb..s.....',
      '...bbwbb.sws....',
      '..bwwb....s.....',
      '..bwb.....s.....',
      '.bwwb...........',
      '.bwwb...........',
      '.bwwb.......s...',
      '.bwwwb.....sws..',
      '..bwwwb.....s...',
      '..bBwwwbb..bb...',
      '...bBBwwwwwBb...',
      '....bbBBBBBb....',
      '......bbbbb.....',
      '................',
    ],
    { b: '#7aa6e8', B: '#4a6ab8', w: '#e6f0ff', s: '#d8e8ff' },
  );

/** Glowspore: a glowing cap breathing out spores. */
export const sporeBuffIcon = (): Uint8ClampedArray =>
  badge(
    [
      '...c......c.....',
      '.c....c.......c.',
      '......cc..c.....',
      '....tttttt......',
      '..ttTwwTTttt....',
      '.tTwwTTTTwTtt...',
      '.tTTTTwwTTTTt...',
      'tTTTTTTTTTTTTt..',
      'tggggggggggggt..',
      '.....sss........',
      '.....sSs....c...',
      '.....sSs........',
      '....ssSss.......',
      '..mmsSSSsmm.....',
      '.mmmmmmmmmmm....',
      '................',
    ],
    { c: '#a8fff0', t: '#24887e', T: '#3aaa9a', w: '#e0fff4', g: '#58c4b4', s: '#d8d0bc', S: '#a39a84', m: '#4b883c' },
  );
