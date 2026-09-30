// The forest's standing things: oaks, birches and pines whose canopies
// overlap the heroes, undergrowth (bushes, ferns, stumps, a fallen log,
// mushrooms), shafts of sunlight and the leafy boughs that hang between the
// camera and the path. Trees and props are lit (diffuse + normal); the
// rays and boughs are flat art.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { hash2, rng } from './env';

const ramp = (...c: string[]): RGB[] => c.map(hex);

const BARK: Material = { ramp: ramp('#1c120c', '#322117', '#4a3324', '#654731', '#826147'), outline: hex('#100a07') };
const BIRCH_BARK: Material = { ramp: ramp('#6d685f', '#99948a', '#c6c1b3', '#e9e5d8'), outline: hex('#26221e') };
const LEAF_OAK: Material = {
  ramp: ramp('#10291a', '#173823', '#1f4a2b', '#2b5e33', '#3b753c', '#528d46', '#71a653', '#97c264'),
  outline: hex('#08160d'),
  outlineLit: hex('#16341e'),
};
const LEAF_BIRCH: Material = {
  ramp: ramp('#223c1b', '#314f22', '#43682a', '#588233', '#709c3d', '#8eb54c', '#b2cd62', '#d2e287'),
  outline: hex('#101c0c'),
  outlineLit: hex('#2a4418'),
};
const LEAF_PINE: Material = {
  ramp: ramp('#0a1e1c', '#0f2a26', '#153730', '#1c4639', '#255644', '#306850', '#407a5d', '#57906e'),
  outline: hex('#05100e'),
  outlineLit: hex('#12302a'),
};
const LEAF_BUSH: Material = {
  ramp: ramp('#132d1b', '#1b3d24', '#26512d', '#346836', '#48803f', '#63994b'),
  outline: hex('#08150d'),
};
const FERN: Material = { ramp: ramp('#18381c', '#245024', '#34692c', '#4b8436', '#68a043', '#8cbc55'), outline: hex('#0a180c'), noOutline: true };
const WOOD_END: Material = { ramp: ramp('#5a3f26', '#7a5836', '#9c7648', '#bf985e', '#d9b77a'), outline: hex('#1c120a') };
const MOSS: Material = { ramp: ramp('#1c3a1c', '#2a5226', '#3c6c2e', '#56883a'), outline: hex('#0c1a0c'), noOutline: true };
const BERRY: Material = { ramp: ramp('#5a0f1a', '#a01e2a', '#e0404a', '#ff8a8a'), outline: hex('#1a060a'), noOutline: true, shine: true };
const CAP_GLOW: Material = { ramp: ramp('#15635c', '#23918a', '#48c8bb', '#8ff0e0', '#dcfff6'), outline: hex('#08221f'), emissive: 0.55, noAO: true };
const CAP_RED: Material = { ramp: ramp('#4a0c10', '#7e1a1c', '#b82e2a', '#e0543e', '#f68a62'), outline: hex('#1a0608') };
const STEM: Material = { ramp: ramp('#6e6858', '#9c9580', '#c9c1a6', '#ece4cb'), outline: hex('#24201a') };
const DOTS: Material = { ramp: ramp('#d8d0c0', '#f4efe4', '#ffffff'), outline: hex('#24201a'), noOutline: true };

export const TREE_W = 96;
export const TREE_H = 128;
/** Where a tree's trunk meets the ground, in its frame. */
export const TREE_BASE_Y = 124;
export const TREE_VARIANTS = 3;

export const PROP_W = 48;
export const PROP_H = 26;
export const PROP_BASE_Y = 23;

/** A leafy dome made of clumps, each lit as a sphere; leaves ruffle its edges. */
export function canopy(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, count: number, leaf: Material, R: () => number, size = 1): void {
  const clumps: { x: number; y: number; r: number }[] = [];
  for (let k = 0; k < count; k++) {
    const a = R() * Math.PI * 2;
    const d = Math.sqrt(R()) * 0.72;
    const r = (8 + R() * 5) * size;
    clumps.push({ x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r });
  }
  // One big mass behind them holds the shape together.
  c.part();
  c.ellipse(cx, cy, rx * 0.86, ry * 0.86, leaf, { bias: -1, flatten: 0.9 });
  // Back clumps first, then the ones nearer the viewer (lower on screen).
  clumps.sort((a, b) => a.y - b.y);
  for (const k of clumps) {
    c.part();
    c.ellipse(k.x, k.y, k.r, k.r * 0.86, leaf, { flatten: 0.95 });
    // Ruffled edge: stray leaves poking out, mostly on top.
    for (let j = 0; j < 10; j++) {
      const a = -Math.PI * (0.05 + R() * 0.9) + (R() < 0.3 ? Math.PI : 0);
      const x = k.x + Math.cos(a) * (k.r + 0.6);
      const y = k.y + Math.sin(a) * (k.r * 0.86 + 0.6);
      c.px(x, y, leaf, sphere(Math.cos(a) * 0.8, Math.sin(a) * 0.8));
    }
  }
  // Leaf texture: little clusters a step lighter or darker.
  for (let y = Math.floor(cy - ry - 8); y < cy + ry + 8; y++) {
    for (let x = Math.floor(cx - rx - 8); x < cx + rx + 8; x++) {
      if (!c.filled(x, y)) continue;
      const h = hash2(x >> 1, y >> 1, 17) + (hash2(x, y, 19) - 0.5) * 0.3;
      if (h > 0.78) c.shade(x, y, 1);
      else if (h < 0.18) c.shade(x, y, -1);
    }
  }
}

export function trunk(c: PixelCanvas, bx: number, by: number, height: number, hw: number, bark: Material, lean: number): void {
  c.part();
  c.shape(by - height, by, (y) => {
    const u = (y - (by - height)) / height;
    // Flares out into roots at the base.
    const w = hw * (0.8 + u * 0.35) + (u > 0.82 ? (u - 0.82) * 12 : 0);
    const x = bx + lean * (1 - u) * (1 - u) * 4;
    return [x - w, x + w];
  }, bark, (_x, _y, t) => cyl(t, 0.1));
}

export function roots(c: PixelCanvas, bx: number, by: number, spread: number, bark: Material, R: () => number): void {
  c.part();
  for (const s of [-1, 1]) {
    c.capsule(bx + s * 2, by - 4, bx + s * (spread + R() * 3), by + 0.5, 2, 0.8, bark);
  }
  c.capsule(bx + 1, by - 3, bx + 2 + R() * 2, by + 1.5, 1.6, 0.8, bark);
}

// ---------------------------------------------------------------------------
// The trees. Each is drawn whole for every frame of a slow sway: the crown's
// clusters lean a pixel or so with the wind, more the higher they sit, and a
// few leaves along the top rustle, so a tree breathes without ever tearing.

/** Frames in a tree's sway, and how fast they play (see textures.ts, `treeSwayTextures`). */
export const TREE_SWAY_FRAMES = 6;
export const TREE_SWAY_FPS = 3;

/** How far the top of a crown leans on frame `f`, in px (0 on frame 0, so it matches the still tree). */
const swayAt = (f: number, amp: number): number => Math.sin((f / TREE_SWAY_FRAMES) * Math.PI * 2) * amp;

/** Which way a lean goes at height `y`: nothing at `base`, all of `lean` at `top` and above. */
const leaner = (lean: number, base: number, top: number) => (y: number): number => lean * Math.max(0, Math.min(1, (base - y) / (base - top))) ** 1.4;

interface CrownOpts {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** How big the leaf clusters are (1 = an oak's). */
  size: number;
  /** Spacing of the clusters against their size (about 1): more is airier, with gaps. */
  ring: number;
  /** How many of the low inner clusters are left out, showing the boughs (0..1). */
  gaps: number;
  leaf: Material;
  twig: Material;
  /** Where the boughs leave the trunk. */
  fork: { x: number; y: number };
  /** The sway: the lean at height y. */
  dx: (y: number) => number;
  frame: number;
  R: () => number;
}

/**
 * A leafy crown: dark depths behind, boughs reaching up through them, then
 * leaf clusters from the back to the front, each lit as a dome with a
 * texture of little leaves, sunlit tips on its crest and a shaded underside.
 * Gaps between the clusters show the boughs in the dark inside.
 */
function crown(c: PixelCanvas, o: CrownOpts): void {
  const { cx, cy, rx, ry, leaf, R, dx } = o;
  // Every random number is drawn first, so each frame of the sway gets the same tree.
  // Clusters on a jittered grid filling the crown's oval, overlapping well, so
  // the outline is a run of soft scallops rather than a bunch of balls.
  const base = 9 * o.size;
  const step = base * o.ring;
  const clusters: { x: number; y: number; r: number }[] = [];
  for (let gy = -ry; gy <= ry; gy += step * 0.8) {
    const row = Math.round(gy / (step * 0.8));
    for (let gx = -rx; gx <= rx; gx += step) {
      const x = gx + (row % 2 ? step / 2 : 0) + (R() - 0.5) * step * 0.5;
      const y = gy + (R() - 0.5) * step * 0.4;
      const r = base * (0.85 + R() * 0.35);
      const gap = R();
      const ex = x / Math.max(1, rx - r * 0.75);
      const ey = y / Math.max(1, ry - r * 0.7);
      const e = ex * ex + ey * ey;
      if (e > 1) continue;
      // A few left out low in the crown, where the boughs show through.
      if (gap < o.gaps && e < 0.7 && y > -ry * 0.1) continue;
      clusters.push({ x: cx + x, y: cy + y, r: r * (1 - e * 0.22) });
    }
  }
  const boughs = clusters.filter((_k, i) => i % 3 === 0).map((k) => ({ x: k.x, y: k.y + k.r * 0.3, w: 1.2 + R() * 0.9 }));
  const tufts = clusters.map(() => Array.from({ length: 6 }, () => ({ a: -Math.PI * (0.15 + R() * 0.7), long: R() < 0.25 })));
  const deep: Material = { ...leaf, bias: (leaf.bias ?? 0) - 2 };

  // The dark inside of the crown.
  c.part();
  c.ellipse(cx + dx(cy), cy + ry * 0.08, rx * 0.8, ry * 0.8, deep, { flatten: 0.8 });
  // Boughs from the fork out to the clusters, seen in the gaps.
  c.part();
  for (const b of boughs) c.capsule(o.fork.x, o.fork.y, b.x + dx(b.y), b.y, b.w * 1.4, b.w * 0.55, o.twig);

  clusters
    .map((k, i) => ({ ...k, i }))
    .sort((a, b) => a.y - b.y)
    .forEach((k) => {
      const x = k.x + dx(k.y);
      const y = k.y;
      const r = k.r;
      c.part();
      c.ellipse(x, y, r, r * 0.84, leaf, { flatten: 0.85 });
      // Its texture: a leaf every few pixels, catching the light on the upper left, lost in shade below.
      for (let py = Math.floor(y - r); py <= y + r; py++) {
        for (let px = Math.floor(x - r); px <= x + r; px++) {
          const u = (px + 0.5 - x) / r;
          const v = (py + 0.5 - y) / (r * 0.84);
          const d2 = u * u + v * v;
          if (d2 > 1) continue;
          // In the cluster's own frame, so the leaves move with it as it sways.
          const lx = px - Math.round(x) + 40;
          const ly = py - Math.round(y) + 40;
          const cell = hash2((lx / 3) | 0, (ly / 2) | 0, 211 + k.i);
          const spot = hash2(lx, ly, 223 + k.i);
          const lit = -u * 0.55 - v * 0.85;
          if (lit > 0.15 && spot > 0.62 && cell > 0.35) c.shade(px, py, 1);
          else if (lit < -0.25 && spot < 0.4) c.shade(px, py, -1);
          else if (d2 > 0.72 && lit < -0.1) c.shade(px, py, -1);
          if (lit > 0.55 && d2 > 0.55 && spot > 0.8) c.shade(px, py, 1);
        }
      }
      // Leaves standing proud along its crest; a few change each frame, as if rustling.
      tufts[k.i].forEach((t, j) => {
        if (y > cy - ry * 0.2) return;
        if (hash2(k.i * 17 + j, o.frame, 229) < 0.22) return;
        const ex = x + Math.cos(t.a) * (r + 0.4);
        const ey = y + Math.sin(t.a) * (r * 0.84 + 0.4);
        const n = sphere(Math.cos(t.a) * 0.8, Math.sin(t.a) * 0.8);
        c.px(ex, ey, leaf, n);
        if (t.long) c.px(ex + (Math.cos(t.a) > 0 ? 1 : -1), ey, leaf, n);
      });
    });

  // The crown as one form: the sun on its upper left, its underside in shade.
  // Sun on the crown's upper-left rim, a step brighter.
  for (let y = Math.floor(cy - ry - 3); y < cy + ry + 3; y++) {
    for (let x = Math.floor(cx - rx - 4); x < cx + rx + 4; x++) {
      if (c.materialAt(x, y) !== leaf) continue;
      const form = -((x - cx - dx(y)) / rx) * 0.45 - ((y - cy) / ry) * 0.9;
      if (form < -0.5 && hash2(x, y, 237) > (form < -0.75 ? 0.1 : 0.45)) c.shade(x, y, -1);
      else if (form > 0.55 && hash2(x >> 1, y, 239) > 0.55) c.shade(x, y, 1);
      if (!c.filled(x, y - 1) && hash2(x, y, 233) > 0.25) c.shade(x, y, 1);
      else if (!c.filled(x - 1, y) && hash2(x, y, 235) > 0.5) c.shade(x, y, 1);
    }
  }
}

/** The crown's shade on the trunk just under it. */
function shadeUnder(c: PixelCanvas, bark: Material, x0: number, x1: number, y0: number, depth: number): void {
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y < y0 + depth; y++) {
      if (c.materialAt(x, y) === bark) c.shade(x, y, y < y0 + depth / 2 ? -2 : -1);
    }
  }
}

/** Bark: furrows running up the trunk, knots, and moss on the shaded side. */
function bark(c: PixelCanvas, bx: number, by: number, height: number, hw: number, lean: number, R: () => number, mossy: boolean): void {
  const at = (y: number) => bx + lean * (1 - (y - (by - height)) / height) ** 2 * 4;
  for (let k = 0; k < height * 0.7; k++) {
    const y = by - height + 2 + Math.floor(R() * (height - 4));
    const x = Math.round(at(y) - hw + 1 + R() * (hw * 2 - 1));
    const len = 2 + Math.floor(R() * 5);
    for (let j = 0; j < len; j++) c.shade(x, y + j, -1);
    if (R() < 0.3) c.shade(x - 1, y, 1);
  }
  if (mossy) {
    c.part();
    for (let y = by - 12; y < by - 1; y++) {
      const x = at(y) + hw * 0.4;
      if (hash2(0, y, 241) > 0.3) c.px(x + hash2(1, y, 243) * hw * 0.6, y, MOSS, cyl(0.6, 0.1));
    }
  }
}

function oakFrame(v: number, f: number): PixelCanvas {
  const c = new PixelCanvas(TREE_W, TREE_H);
  const R = rng(300 + v * 17);
  const bx = 48;
  const by = TREE_BASE_Y;
  const lean = (R() - 0.5) * 1.5;
  const dx = leaner(swayAt(f, 1.3), by - 44, by - 100);
  const hw = 3.6 + v * 0.3;
  trunk(c, bx, by, 50, hw, BARK, lean);
  bark(c, bx, by, 50, hw, lean, R, true);
  roots(c, bx, by, 9, BARK, R);
  // Boughs splitting from the trunk into the crown.
  c.part();
  const top = by - 44;
  c.capsule(bx, top + 6, bx - 16 - R() * 4 + dx(by - 64), by - 64, 2.8, 1.3, BARK);
  c.capsule(bx + 1, top + 2, bx + 15 + R() * 4 + dx(by - 66), by - 66, 2.6, 1.2, BARK);
  c.capsule(bx, top, bx + lean + dx(by - 80), by - 80, 2.4, 1.2, BARK);
  crown(c, { cx: bx + lean, cy: by - 70, rx: 36 + v * 2, ry: 29, size: 1.05, ring: 0.95, gaps: 0.55, leaf: LEAF_OAK, twig: BARK, fork: { x: bx, y: top }, dx, frame: f, R });
  shadeUnder(c, BARK, bx - 8, bx + 8, by - 46, 8);
  return c;
}

function birchFrame(v: number, f: number): PixelCanvas {
  const c = new PixelCanvas(TREE_W, TREE_H);
  const R = rng(500 + v * 23);
  const bx = 48;
  const by = TREE_BASE_Y;
  const lean = (R() - 0.5) * 2.5;
  // Birches are lighter and move more.
  const dx = leaner(swayAt(f, 1.6), by - 40, by - 104);
  trunk(c, bx, by, 66, 2.3, BIRCH_BARK, lean);
  // Black lenticels across the white bark, and the dark cracked base.
  for (let k = 0; k < 22; k++) {
    const y = by - 62 + Math.floor(R() * 58);
    const x = bx - 2 + Math.floor(R() * 3) + Math.round(lean * (1 - (y - by + 66) / 66) ** 2 * 4);
    const len = 1 + Math.floor(R() * 3);
    for (let j = 0; j < len; j++) c.shade(x + j, y, -3);
  }
  for (let y = by - 8; y < by; y++) for (let x = bx - 4; x <= bx + 4; x++) if (c.materialAt(x, y) === BIRCH_BARK && hash2(x, y, 245) > 0.45) c.shade(x, y, -2);
  roots(c, bx, by, 5, BIRCH_BARK, R);
  const fork = { x: bx + lean * 1.5, y: by - 56 };
  c.part();
  c.capsule(fork.x, fork.y, bx - 11 + dx(by - 76), by - 76, 1.5, 0.7, BIRCH_BARK);
  c.capsule(fork.x, fork.y - 4, bx + 10 + dx(by - 84), by - 84, 1.4, 0.7, BIRCH_BARK);
  crown(c, { cx: bx + lean * 3, cy: by - 84, rx: 21 + v, ry: 31, size: 0.8, ring: 1.05, gaps: 0.5, leaf: LEAF_BIRCH, twig: BIRCH_BARK, fork, dx, frame: f, R });
  shadeUnder(c, BIRCH_BARK, bx - 6, bx + 6, by - 56, 7);
  return c;
}

function pineFrame(v: number, f: number): PixelCanvas {
  const c = new PixelCanvas(TREE_W, TREE_H);
  const R = rng(700 + v * 29);
  const bx = 48;
  const by = TREE_BASE_Y;
  const dx = leaner(swayAt(f, 1.1), by - 20, by - 110);
  trunk(c, bx, by, 34, 2.8, BARK, 0);
  bark(c, bx, by, 34, 2.8, 0, R, false);
  roots(c, bx, by, 6, BARK, R);
  // Tiers of drooping boughs, top down, each lower one in front of the one above.
  const top = by - 114 + v * 4;
  const tiers = 6;
  const tips = Array.from({ length: tiers }, (_t, k) => Array.from({ length: 3 + k }, () => R()));
  for (let k = 0; k < tiers; k++) {
    const t0 = top + k * 14;
    const t1 = t0 + 20 + k * 2;
    const w = 6 + k * 4.6 + v;
    const sx = dx((t0 + t1) / 2);
    c.part();
    c.shape(t0, t1, (y) => {
      const u = (y - t0) / (t1 - t0);
      // Boughs sag at the ends, so the hem curves up at the sides.
      const hw = 1 + u ** 0.85 * w;
      return [bx + sx - hw, bx + sx + hw];
    }, LEAF_PINE, (_x, _y, t, u) => cyl(t, 0.6 - u * 0.5));
    // Bough tips hanging from the hem.
    tips[k].forEach((r, j) => {
      const n = tips[k].length;
      const tx = bx + sx + ((j + 0.5) / n - 0.5) * 2 * w * (0.9 + r * 0.1);
      const out = tx < bx + sx ? -1 : 1;
      c.capsule(tx, t1 - 3, tx + out * (1 + r), t1 + 1 + r * 1.5, 1.8, 0.6, LEAF_PINE);
    });
    // Needles: short strokes slanting down and out, bright on the sunny side.
    for (let y = t0; y <= t1 + 3; y++) {
      for (let x = Math.floor(bx + sx - w - 2); x <= bx + sx + w + 2; x++) {
        if (c.materialAt(x, y) !== LEAF_PINE) continue;
        const side = x < bx + sx ? 1 : -1;
        const stroke = hash2((x + side * y) >> 1, k, 251 + v);
        if (stroke > 0.72) c.shade(x, y, side > 0 ? 1 : 0);
        else if (stroke < 0.18) c.shade(x, y, -1);
        if (!c.filled(x, y - 1) && side > 0) c.shade(x, y, 1);
      }
    }
  }
  shadeUnder(c, BARK, bx - 5, bx + 5, top + (tiers - 1) * 14 + 30, 6);
  return c;
}

export type TreeName = 'oak' | 'birch' | 'pine';
const TREE_DRAW: Record<TreeName, (v: number, f: number) => PixelCanvas> = { oak: oakFrame, birch: birchFrame, pine: pineFrame };

/** One frame of a tree's sway. */
export const treeFrame = (kind: TreeName, v: number, f: number): PixelCanvas => TREE_DRAW[kind](v, f);

/** The still trees (frame 0 of each sway), made at boot; the sway itself is made later, in the background. */
export const TREE_FRAMES: { name: string; draw: () => PixelCanvas }[] = [];
for (let v = 0; v < TREE_VARIANTS; v++) {
  for (const kind of ['oak', 'birch', 'pine'] as const) TREE_FRAMES.push({ name: `${kind}${v}`, draw: () => treeFrame(kind, v, 0) });
}

export { crown, leaner, swayAt };

// ---------------------------------------------------------------------------
// Undergrowth, each drawn standing on (24, PROP_BASE_Y) of a 48x26 frame.

function bush(v: number): PixelCanvas {
  const c = new PixelCanvas(PROP_W, PROP_H);
  const R = rng(900 + v * 11);
  const cx = 24;
  const by = PROP_BASE_Y;
  canopy(c, cx, by - 8, 11, 7, 5, LEAF_BUSH, R, 0.62);
  if (v === 1) {
    for (let k = 0; k < 7; k++) {
      c.part();
      c.px(cx - 9 + R() * 18, by - 13 + R() * 10, BERRY, sphere(-0.4, -0.4));
    }
  }
  return c;
}

function fern(v: number): PixelCanvas {
  const c = new PixelCanvas(PROP_W, PROP_H);
  const R = rng(1100 + v * 13);
  const cx = 24;
  const by = PROP_BASE_Y;
  const fronds = 7 + v * 2;
  for (let k = 0; k < fronds; k++) {
    c.part();
    const a = -Math.PI * (0.12 + (k / (fronds - 1)) * 0.76) + (R() - 0.5) * 0.2;
    const len = 9 + R() * 5;
    let px = cx;
    let py = by - 1;
    for (let s = 0; s < len; s++) {
      // Fronds arch outward and droop at the tips.
      const u = s / len;
      px += Math.cos(a) * (1 + u * 0.3);
      py += Math.sin(a) * (1 - u * 1.3) + u * 0.4;
      const side = Math.cos(a) < 0 ? -1 : 1;
      c.px(px, py, FERN, sphere(Math.cos(a) * 0.5, -0.4));
      if (s > 1 && s % 2 === 0) {
        const leaf = Math.max(1, Math.round((1 - u) * 3));
        for (let j = 1; j <= leaf; j++) {
          c.px(px - Math.sin(a) * j * side * 0.6, py - j * 0.8, FERN, sphere(0, -0.8), { bias: 1 });
          c.px(px + Math.sin(a) * j * side * 0.3, py + j * 0.5, FERN, sphere(0, 0.5), { bias: -1 });
        }
      }
    }
  }
  return c;
}

function stump(v: number): PixelCanvas {
  const c = new PixelCanvas(PROP_W, PROP_H);
  const R = rng(1300 + v * 7);
  const cx = 24;
  const by = PROP_BASE_Y;
  roots(c, cx, by, 8, BARK, R);
  c.part();
  c.shape(by - 9, by, (y) => {
    const u = (y - by + 9) / 9;
    const hw = 5.6 + u * 1.2;
    return [cx - hw, cx + hw];
  }, BARK, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.ellipse(cx, by - 9.5, 5.8, 2.4, WOOD_END, { normal: () => ({ x: 0, y: 0.55, z: 0.84 }) });
  // Growth rings.
  c.shade(cx - 2, by - 10, -1);
  c.shade(cx + 1, by - 10, -1);
  c.shade(cx + 3, by - 9, -1);
  c.shade(cx - 3, by - 9, -1);
  c.part();
  c.px(cx - 5, by - 7, MOSS, sphere(-0.5, -0.5));
  c.px(cx - 4, by - 7, MOSS, sphere(0, -0.6));
  c.px(cx - 5, by - 6, MOSS, sphere(-0.6, 0));
  return c;
}

function log(): PixelCanvas {
  const c = new PixelCanvas(PROP_W, PROP_H);
  const by = PROP_BASE_Y;
  c.part();
  c.capsule(7, by - 6, 38, by - 6, 5.2, 5.2, BARK);
  for (let x = 6; x < 38; x++) {
    if (hash2(x, 3, 43) > 0.5) c.shade(x, by - 6 + Math.floor(hash2(x, 4, 44) * 6) - 3, -1);
  }
  c.part();
  c.ellipse(40, by - 6, 3, 5, WOOD_END, { normal: () => ({ x: 0.8, y: 0.1, z: 0.6 }) });
  c.shade(40, by - 7, -1);
  c.shade(40, by - 5, -1);
  // Moss along its back.
  c.part();
  for (let x = 8; x < 36; x++) {
    if (hash2(x, 1, 45) > 0.3) c.px(x, by - 11 - (hash2(x, 2, 46) > 0.6 ? 1 : 0), MOSS, sphere(0, -0.7));
  }
  return c;
}

function shrooms(v: number): PixelCanvas {
  const c = new PixelCanvas(PROP_W, PROP_H);
  const R = rng(1500 + v * 3);
  const cap = v === 0 ? CAP_GLOW : CAP_RED;
  const list = [
    { x: 22, h: 7, r: 3.6 },
    { x: 27, h: 4, r: 2.6 },
    { x: 18, h: 3, r: 2 },
    { x: 30, h: 2, r: 1.6 },
  ];
  for (const m of list) {
    const by = PROP_BASE_Y - R() * 1.5;
    c.part();
    c.capsule(m.x, by, m.x, by - m.h, 1, 0.8, STEM);
    c.part();
    c.ellipse(m.x, by - m.h - 0.5, m.r, m.r * 0.62, cap);
    if (v === 1 && m.r > 2.5) {
      c.part();
      c.px(m.x - 1, by - m.h - 1, DOTS, sphere(0, -0.6));
      c.px(m.x + 1, by - m.h, DOTS, sphere(0.4, -0.2));
    }
  }
  return c;
}

export const PROP_FRAMES: { name: string; draw: () => PixelCanvas }[] = [
  { name: 'bush0', draw: () => bush(0) },
  { name: 'bush1', draw: () => bush(1) },
  { name: 'fern0', draw: () => fern(0) },
  { name: 'fern1', draw: () => fern(1) },
  { name: 'stump0', draw: () => stump(0) },
  { name: 'stump1', draw: () => stump(1) },
  { name: 'log0', draw: () => log() },
  { name: 'log1', draw: () => log() },
  { name: 'shrooms0', draw: () => shrooms(0) },
  { name: 'shrooms1', draw: () => shrooms(1) },
];

// ---------------------------------------------------------------------------
// Light and overhead leaves: flat art.

export const RAY_W = 72;
export const RAY_H = 200;
/** Where the ray meets the ground, in its frame. */
export const RAY_FOOT_X = 54;

/**
 * A shaft of sunlight slanting down from the upper left onto the ground at
 * the bottom of the frame. Premultiplied, for additive blending; the
 * brightness falls off in a few flat steps, so it reads as pixel art.
 */
export function rayCanvas(seed: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(RAY_W * RAY_H * 4);
  const R = rng(seed);
  const strands = [0, 1, 2].map(() => ({ at: (R() - 0.5) * 1.2, w: 0.25 + R() * 0.3, a: 0.35 + R() * 0.4 }));
  for (let y = 0; y < RAY_H; y++) {
    const u = y / RAY_H;
    const cx = RAY_FOOT_X - (RAY_H - y) * 0.22;
    const hw = 5 + u * 6;
    // Faint high up, full a little above the ground, softer at the landing.
    const along = Math.min(1, u / 0.45) * (u > 0.93 ? 1 - (u - 0.93) * 6 : 1);
    for (let x = 0; x < RAY_W; x++) {
      const t = (x + 0.5 - cx) / hw;
      if (Math.abs(t) > 1.6) continue;
      let a = Math.max(0, 1 - t * t / 2.56) ** 1.4 * 0.55;
      for (const s of strands) {
        const d = (t - s.at) / s.w;
        if (Math.abs(d) < 1) a += (1 - d * d) * s.a * 0.45;
      }
      a = Math.round(Math.min(1, a * along) * 7) / 7;
      const i = (y * RAY_W + x) * 4;
      px[i] = Math.round(255 * a * 0.62);
      px[i + 1] = Math.round(240 * a * 0.62);
      px[i + 2] = Math.round(196 * a * 0.62);
      px[i + 3] = 255;
    }
  }
  return px;
}

export const BOUGH_W = 150;
export const BOUGH_H = 104;

/**
 * A leafy bough seen from beneath, hanging in from the left edge. Drawn
 * dark (it is between the viewer and the light), with sun catching the
 * tips of its leaves.
 */
export function bough(v: number): PixelCanvas {
  const c = new PixelCanvas(BOUGH_W, BOUGH_H);
  const R = rng(1700 + v * 31);
  const leaf: Material = { ...LEAF_OAK, bias: -2 };
  const wood: Material = { ...BARK, bias: -1 };
  const y0 = 40 + R() * 20;
  const x1 = 90 + R() * 30;
  const y1 = 30 + R() * 40;
  c.part();
  c.capsule(-4, y0, x1, y1, 5, 1.5, wood);
  c.part();
  c.capsule(x1 * 0.45, (y0 + y1) / 2, x1 * 0.75, y1 + 26, 2.4, 1, wood);
  const n = 7 + v;
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    const x = t * x1 * 1.02 + (R() - 0.5) * 8;
    const y = y0 + (y1 - y0) * t + (R() - 0.5) * 26;
    canopy(c, x, y, 16 - t * 4, 13 - t * 3, 3, leaf, R, 0.9 - t * 0.2);
  }
  return c;
}

/** A single falling leaf, white so particles can tint it. */
export function leafBit(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(3 * 2 * 4);
  for (const [x, y] of [[0, 0], [1, 0], [1, 1], [2, 1]]) {
    const i = (y * 3 + x) * 4;
    px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 255;
  }
  return px;
}
