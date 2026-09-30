// The forest's standing things: oaks, birches and pines whose canopies
// overlap the heroes, undergrowth (bushes, ferns, stumps, a fallen log,
// mushrooms), shafts of sunlight and the leafy boughs that hang between the
// camera and the path. Trees and props are lit (diffuse + normal); the
// rays and boughs are flat art.

import { FLAT, KEY_LIGHT, PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { hash2, rng } from './env';

const ramp = (...c: string[]): RGB[] => c.map(hex);

const BARK: Material = { ramp: ramp('#1c120c', '#322117', '#4a3324', '#654731', '#826147'), outline: hex('#100a07') };
const LEAF_OAK: Material = {
  ramp: ramp('#10291a', '#173823', '#1f4a2b', '#2b5e33', '#3b753c', '#528d46', '#71a653', '#97c264'),
  outline: hex('#08160d'),
  outlineLit: hex('#16341e'),
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
// The trees, drawn the way a pixel artist would build one up:
//   1. A skeleton grown from the ground: a trunk that tapers and bends, then
//      forks into limbs that fork again, thinner each time, out to twigs.
//   2. Foliage at the ends of the limbs: clumps, each made of many small
//      leaf clusters (so its edge is a run of little leafy bumps, not a
//      circle). Every pixel's shade is picked outright from three layers of
//      light: the crown as one form (sunny top left, the underside in its own
//      shadow), the clump (a lit crest, a shaded belly) and the leaf cluster
//      (a bright tip, a dark crease where it meets the next). The bands meet
//      in a light dither, never a smooth blend.
//   3. Gaps between the clumps, where the limbs and the dark inside show.
// Each is drawn whole for every frame of a slow sway: everything leans a
// pixel or so with the wind, more the higher it sits, and each clump moves
// as one piece (its texture goes with it), so nothing shimmers.

/** Frames in a tree's sway, and how fast they play (see textures.ts, `treeSwayTextures`). */
export const TREE_SWAY_FRAMES = 6;
export const TREE_SWAY_FPS = 3;

/** How far the top of a crown leans on frame `f`, in px (0 on frame 0, so it matches the still tree). */
const swayAt = (f: number, amp: number): number => Math.sin((f / TREE_SWAY_FRAMES) * Math.PI * 2) * amp;

/** Which way a lean goes at height `y`: nothing at `base`, all of `lean` at `top` and above. */
const leaner = (lean: number, base: number, top: number) => (y: number): number => lean * Math.max(0, Math.min(1, (base - y) / (base - top))) ** 1.4;

const LIGHT = (() => {
  const l = Math.hypot(KEY_LIGHT.x, KEY_LIGHT.y, KEY_LIGHT.z);
  return { x: KEY_LIGHT.x / l, y: KEY_LIGHT.y / l, z: KEY_LIGHT.z / l };
})();

/** A 4x4 ordered dither, -0.5..0.5, so bands meet in a checker rather than a smooth blend. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
const bayer = (x: number, y: number): number => BAYER[(y & 3) * 4 + (x & 3)];

/**
 * Set the ramp step (0 = darkest) a drawn pixel will show, whatever its
 * normal would give: the normal stays for the game's moving lights, the
 * shade is the artist's. Contact shadows still apply on top in `render`.
 */
function tone(c: PixelCanvas, x: number, y: number, step: number): void {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = y * c.w + x;
  const m = c.materialAt(x, y);
  if (!m) return;
  const d = c.nx[i] * LIGHT.x + c.ny[i] * LIGHT.y + c.nz[i] * LIGHT.z;
  const k = m.ramp.length;
  const t = Math.max(0, Math.min(0.999, (d + 0.25) / 1.45));
  const natural = Math.floor(t * k) + (m.bias ?? 0);
  c.bias[i] = Math.max(-k, Math.min(k, Math.round(step) - natural));
}

/** A light value (about -1 dark .. 1 bright) to a ramp step, dithered at (x, y). */
const toStep = (v: number, k: number, x: number, y: number, dither = 0.22): number =>
  Math.max(0, Math.min(k - 1, Math.floor((v * 0.5 + 0.5) * k + bayer(x, y) * dither * 2)));

// ------------------------------------------------------------- the skeleton

interface Knot {
  x: number;
  y: number;
  r: number;
}

interface Limb {
  pts: Knot[];
  /** 0 for the trunk, 1 for its first limbs, and so on. */
  depth: number;
}

/** A tree's limbs, and the tips where its foliage grows. */
interface Skeleton {
  limbs: Limb[];
  tips: Knot[];
}

interface Growth {
  /** How far a limb bows out of line, against its length. */
  bow: number;
  /** How much it kinks along the way, in px. */
  kink: number;
  /** How far toward its foliage each limb goes before it forks (0..1). */
  reach: number;
  /** A limb's girth at its end against its start. */
  taper: number;
  /** Girth of the finest twigs. */
  twig: number;
  /** Chance a fork splits three ways rather than two. */
  three: number;
}

/**
 * One limb from `a` to `b`: a gentle bow to one side and a few kinks, its
 * girth easing from r0 to r1.
 */
function limbPts(R: () => number, a: Knot, b: { x: number; y: number }, r1: number, g: Growth): Knot[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const steps = Math.max(2, Math.round(len / 3));
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  const bow = (R() - 0.5) * 2 * g.bow * len;
  const kinks = Array.from({ length: steps + 1 }, () => (R() - 0.5) * g.kink);
  return Array.from({ length: steps + 1 }, (_s, s) => {
    const t = s / steps;
    const off = s === 0 || s === steps ? 0 : Math.sin(t * Math.PI) * bow + kinks[s];
    return { x: a.x + (b.x - a.x) * t + nx * off, y: a.y + (b.y - a.y) * t + ny * off, r: a.r + (r1 - a.r) * t };
  });
}

/**
 * Branch from `from` toward a set of foliage clumps: a limb heads for their
 * middle, goes part of the way, then forks, each fork taking its share of
 * the clumps (split by direction) and a girth to match, until one twig
 * reaches each clump. So the limbs always lead somewhere, and thin as they go.
 */
function branchTo(sk: Skeleton, R: () => number, from: Knot, targets: { x: number; y: number }[], depth: number, g: Growth): void {
  if (targets.length === 1) {
    const t = targets[0];
    sk.limbs.push({ pts: limbPts(R, from, t, g.twig, g), depth });
    sk.tips.push({ x: t.x, y: t.y, r: g.twig });
    return;
  }
  const mx = targets.reduce((s, t) => s + t.x, 0) / targets.length;
  const my = targets.reduce((s, t) => s + t.y, 0) / targets.length;
  const f = g.reach * (0.8 + R() * 0.4);
  const end = { x: from.x + (mx - from.x) * f, y: from.y + (my - from.y) * f };
  const r1 = Math.max(g.twig, from.r * g.taper);
  const pts = limbPts(R, from, end, r1, g);
  sk.limbs.push({ pts, depth });
  const knot = pts[pts.length - 1];
  // Split by direction from the fork, so each branch has its own side.
  const sorted = [...targets].sort((p, q) => Math.atan2(p.y - knot.y, p.x - knot.x) - Math.atan2(q.y - knot.y, q.x - knot.x));
  const n = targets.length >= 4 && R() < g.three ? 3 : 2;
  const groups: { x: number; y: number }[][] = [];
  let at = 0;
  for (let k = 0; k < n; k++) {
    const size = Math.round((sorted.length - at) / (n - k));
    groups.push(sorted.slice(at, at + size));
    at += size;
  }
  for (const grp of groups) {
    if (!grp.length) continue;
    // Pipe model: a fork's girth goes with the share of foliage it carries.
    const r = Math.max(g.twig, knot.r * Math.sqrt(grp.length / targets.length) * 1.05);
    branchTo(sk, R, { ...knot, r }, grp, depth + 1, g);
  }
}

/** A trunk from its foot to where it forks, then limbs out to every clump. */
function skeleton(R: () => number, g: Growth, foot: Knot, fork: Knot, clumps: { x: number; y: number }[]): Skeleton {
  const sk: Skeleton = { limbs: [], tips: [] };
  const trunk = limbPts(R, foot, fork, fork.r, { ...g, bow: g.bow * 0.5 });
  sk.limbs.push({ pts: trunk, depth: 0 });
  branchTo(sk, R, trunk[trunk.length - 1], clumps, 1, g);
  return sk;
}

/**
 * Where a crown's clumps sit: spread over an oval, never too close to each
 * other, the first always at the top so the crown closes over its limbs.
 */
function scatter(R: () => number, cx: number, cy: number, rx: number, ry: number, n: number, gap: number, window = 0): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [{ x: cx + (R() - 0.5) * rx * 0.3, y: cy - ry * 0.62 }];
  for (let tries = 0; pts.length < n && tries < 400; tries++) {
    const a = R() * Math.PI * 2;
    const d = Math.sqrt(R());
    const x = cx + Math.cos(a) * d * rx;
    const y = cy + Math.sin(a) * d * ry;
    // A window low in the middle, if asked, where the limbs show under the crown.
    if (Math.abs(x - cx) < rx * window && y > cy + ry * 0.15) continue;
    if (pts.every((p) => Math.hypot((p.x - x) / rx, (p.y - y) / ry) > gap)) pts.push({ x, y });
  }
  return pts;
}

/** Roots gripping the ground either side of the trunk, tapering out of sight. */
function rootsOf(c: PixelCanvas, bx: number, by: number, r: number, spread: number, bark: Material, R: () => number): void {
  c.part();
  const roots = [
    { a: Math.PI - 0.35, l: spread },
    { a: 0.35, l: spread * (0.8 + R() * 0.3) },
    { a: Math.PI * 0.5 + (R() < 0.5 ? 0.9 : -0.9), l: spread * 0.55 },
  ];
  for (const root of roots) {
    let x = bx + Math.cos(root.a) * r * 0.4;
    let y = by - r * 0.9;
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const u = s / steps;
      // Out from the trunk, then down into the ground.
      const nx = x + Math.cos(root.a) * (root.l / steps);
      const ny = y + (r * 0.9) / steps + 0.2;
      c.capsule(x, y, nx, ny, r * (0.75 - u * 0.5), r * (0.75 - (u + 1 / steps) * 0.5), bark);
      x = nx;
      y = ny;
    }
  }
}

/**
 * Paint the limbs: each a chain of tapering round segments (thinnest drawn
 * last, so forks sit on their parents), then bark along them: furrows that
 * follow the grain, a sunlit edge on the upper left.
 */
function paintLimbs(c: PixelCanvas, sk: Skeleton, bark: Material, dx: (y: number) => number, minR = 0): void {
  const limbs = sk.limbs.filter((l) => l.pts[0].r >= minR);
  c.part();
  for (const l of limbs) {
    for (let s = 1; s < l.pts.length; s++) {
      const p = l.pts[s - 1];
      const q = l.pts[s];
      c.capsule(p.x + dx(p.y), p.y, q.x + dx(q.y), q.y, p.r, q.r, bark);
    }
  }
  // The grain: dashes along each thick limb, dark in the furrows, light on the sunny ridge.
  for (const l of limbs) {
    l.pts.forEach((p, s) => {
      if (s === 0 || p.r < 1.3) return;
      const q = l.pts[s - 1];
      const vx = p.x + dx(p.y) - (q.x + dx(q.y));
      const vy = p.y - q.y;
      const len = Math.hypot(vx, vy) || 1;
      const ux = -vy / len;
      const uy = vx / len;
      for (let t = 0; t < len; t += 1) {
        const ax = q.x + dx(q.y) + (vx * t) / len;
        const ay = q.y + (vy * t) / len;
        const r = q.r + ((p.r - q.r) * t) / len;
        for (let lane = -2; lane <= 2; lane++) {
          const off = lane * 0.34 * r;
          if (Math.abs(off) > r - 0.6) continue;
          const px = Math.floor(ax + ux * off);
          const py = Math.floor(ay + uy * off);
          const h = hash2(lane * 7 + l.depth * 31, Math.floor((ay + ax * 0.3 + lane * 2.5) / 6), 401);
          if (lane % 2 !== 0 && h > 0.35) c.shade(px, py, -1);
          else if (lane % 2 === 0 && h > 0.85) c.shade(px, py, -1);
        }
        // Sunlit ridge on the side facing the key light.
        const side = ux < 0 || (ux === 0 && uy < 0) ? 1 : -1;
        const px = Math.floor(ax + ux * side * r * 0.55);
        const py = Math.floor(ay + uy * side * r * 0.55);
        if (r > 1.8 && hash2(Math.floor(ay / 2), l.depth, 409) > 0.35) c.shade(px, py, 1);
      }
    });
  }
}

// -------------------------------------------------------------- the foliage

interface Clump {
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** Its leaf clusters, as offsets from the clump's centre. */
  leaves: { x: number; y: number; r: number; j: number }[];
  /** Tufts along its crest: an angle and a length, and whether it rustles. */
  tufts: { a: number; long: boolean; rustle: number }[];
}

interface Crown {
  /** The crown as one form, for its big light and shadow. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  leaf: Material;
  /** Leaf cluster size in px. */
  cluster: number;
  /** How far the cluster's own light carries against the clump's (0..1). */
  grain: number;
  /** Lifts or darkens the whole crown. */
  lift: number;
  clumps: Clump[];
}

/** Make a clump of leaf clusters on a jittered grid inside an oval: every random number drawn now. */
function makeClump(R: () => number, x: number, y: number, rx: number, ry: number, cluster: number): Clump {
  const leaves: Clump['leaves'] = [];
  const step = cluster * 1.25;
  for (let gy = -ry; gy <= ry + 0.1; gy += step * 0.8) {
    const row = Math.round((gy + ry) / (step * 0.8));
    for (let gx = -rx; gx <= rx + 0.1; gx += step) {
      const lx = gx + (row % 2 ? step / 2 : 0) + (R() - 0.5) * step * 0.6;
      const ly = gy + (R() - 0.5) * step * 0.5;
      const r = cluster * (0.85 + R() * 0.4);
      const e = (lx / Math.max(1, rx - r * 0.6)) ** 2 + (ly / Math.max(1, ry - r * 0.6)) ** 2;
      if (e > 1) continue;
      leaves.push({ x: lx, y: ly, r, j: R() - 0.5 });
    }
  }
  const tufts = Array.from({ length: Math.round((rx + ry) * 0.5) }, () => ({ a: -Math.PI * (0.1 + R() * 0.8), long: R() < 0.3, rustle: R() }));
  return { x, y, rx, ry, leaves, tufts };
}

const NONE: Clump['leaves'] = [];

/**
 * Paint a crown's clumps, back (higher) to front, each its own part so the
 * renderer's contact shadows mark where one sits over another.
 */
function paintCrown(c: PixelCanvas, cr: Crown, dx: (y: number) => number, frame: number): void {
  const k = cr.leaf.ramp.length;
  const order = cr.clumps.map((cl, i) => ({ cl, i })).sort((a, b) => a.cl.y + a.cl.ry * 0.5 - (b.cl.y + b.cl.ry * 0.5));
  for (const { cl, i } of order) {
    const sx = Math.round(dx(cl.y));
    const x0 = Math.round(cl.x) + sx;
    const y0 = Math.round(cl.y);
    const pad = cr.cluster + 1;
    // The clusters bucketed by cell, so each pixel only looks at those nearby.
    const cell = cr.cluster * 2;
    const buckets = new Map<number, Clump['leaves']>();
    const key = (bx: number, by: number) => (by + 64) * 256 + bx + 64;
    for (const l of cl.leaves) {
      const kk = key(Math.floor(l.x / cell), Math.floor(l.y / cell));
      const b = buckets.get(kk);
      if (b) b.push(l);
      else buckets.set(kk, [l]);
    }
    c.part();
    for (let py = Math.floor(-cl.ry - pad); py <= cl.ry + pad; py++) {
      for (let px = Math.floor(-cl.rx - pad); px <= cl.rx + pad; px++) {
        // The nearest two leaf clusters: inside the first, and how close to the crease with the second.
        let d1 = 1e9;
        let d2 = 1e9;
        let near = cl.leaves[0];
        const bx = Math.floor((px + 0.5) / cell);
        const by = Math.floor((py + 0.5) / cell);
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const l of buckets.get(key(bx + i, by + j)) ?? NONE) {
          const ddx = px + 0.5 - l.x;
          const ddy = py + 0.5 - l.y;
          const d = Math.hypot(ddx, ddy) / l.r;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            near = l;
          } else if (d < d2) d2 = d;
        }
        if (!near || d1 > 1) continue;
        const u = (px + 0.5) / cl.rx;
        const v = (py + 0.5) / cl.ry;
        const lu = (px + 0.5 - near.x) / near.r;
        const lv = (py + 0.5 - near.y) / near.r;
        const X = x0 + px;
        const Y = y0 + py;
        c.px(X, Y, cr.leaf, sphere(u * 0.65 + lu * 0.35, v * 0.65 + lv * 0.35, 0.9));
        // Each leaf cluster takes one shade, from where it sits in the clump
        // and in the crown (measured at rest, so it moves as one piece):
        // that is what makes the clusters read as crisp little shapes.
        const gu = (cl.x + near.x - cr.cx) / cr.rx;
        const gv = (cl.y + near.y - cr.cy) / cr.ry;
        const big = -gu * 0.3 - gv * 0.65 - Math.max(0, gu * gu + gv * gv - 0.55) * 0.3;
        const nu = near.x / cl.rx;
        const nv = near.y / cl.ry;
        const mid = -nu * 0.35 - nv * 0.75 - Math.max(0, nu * nu + nv * nv - 0.6) * 0.45;
        let step = toStep(big * 0.5 + mid * 0.85 + near.j * 0.2 + cr.lift, k, 0, 0, 0);
        const jump = k >= 8 ? 2 : 1;
        // Then its own light: a bright rim on its upper left, a dark crease below and where it meets the next.
        const rim = -lu * 0.5 - lv * 0.85;
        if (d2 - d1 < 0.18 || (d1 > 0.62 && rim < -0.45)) step -= jump;
        else if (d1 > 0.45 && rim > 0.35 * (2 - cr.grain)) step += 1;
        tone(c, X, Y, Math.max(0, Math.min(k - 1, step)));
      }
    }
    // Leaves standing proud of the crest; a few change each frame, as if rustling.
    cl.tufts.forEach((t, j) => {
      if (hash2(i * 13 + j, frame, 229) < 0.2 * t.rustle + 0.05) return;
      const ex = x0 + Math.cos(t.a) * (cl.rx + 0.3);
      const ey = y0 + Math.sin(t.a) * (cl.ry + 0.3);
      if (c.materialAt(ex, ey) === cr.leaf && c.layer[Math.floor(ey) * c.w + Math.floor(ex)] === c.layer[y0 * c.w + x0]) {
        const step = Math.min(k - 1, toStep(-Math.cos(t.a) * 0.2 - Math.sin(t.a) * 0.5 + cr.lift, k, 0, 0) + 1);
        const n = sphere(Math.cos(t.a) * 0.8, Math.sin(t.a) * 0.8);
        const tx = ex + Math.cos(t.a) * 1.2;
        const ty = ey + Math.sin(t.a) * 1.2;
        if (c.filled(Math.floor(tx), Math.floor(ty))) return;
        c.px(tx, ty, cr.leaf, n);
        tone(c, Math.floor(tx), Math.floor(ty), step);
        if (t.long) {
          const lx = tx + (Math.cos(t.a) > 0 ? 1 : -1);
          c.px(lx, ty - 1, cr.leaf, n);
          tone(c, Math.floor(lx), Math.floor(ty - 1), step);
        }
      }
    });
  }
}

/** The dark inside of a crown, behind the limbs: its deepest shade, seen through the gaps. */
function paintDepths(c: PixelCanvas, cr: Crown, dx: (y: number) => number, shrink: number): void {
  c.part();
  for (const cl of cr.clumps) {
    const x = cl.x + dx(cl.y);
    c.ellipse(x, cl.y + cl.ry * 0.15, cl.rx * shrink, cl.ry * shrink, cr.leaf, { flatten: 0.8 });
  }
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      if (c.materialAt(x, y) === cr.leaf) tone(c, x, y, hash2(x, y, 419) > 0.8 ? 1 : 0);
    }
  }
}

/** The crown's shade falling on the trunk and limbs just under it. */
function shadeUnder(c: PixelCanvas, bark: Material, x0: number, x1: number, y0: number, depth: number): void {
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y < y0 + depth; y++) {
      if (c.materialAt(x, y) === bark) c.shade(x, y, y < y0 + depth / 2 ? -2 : -1);
    }
  }
}

/** Where a crown's lowest clumps hang, to shade the trunk below them. */
const crownFloor = (cr: Crown): number => Math.max(...cr.clumps.filter((cl) => Math.abs(cl.x - cr.cx) < cr.rx * 0.4).map((cl) => cl.y + cl.ry * 0.6), cr.cy);

// ---------------------------------------------------------------- materials

const OAK_BARK: Material = { ramp: ramp('#1a100c', '#2c1c14', '#40291c', '#573826', '#6f4a31', '#8a5f40'), outline: hex('#0e0806') };
const OAK_LEAF: Material = {
  ramp: ramp('#0c1f1c', '#123024', '#1a412b', '#245431', '#326a36', '#46823b', '#629b42', '#86b64c', '#afcf5c'),
  outline: hex('#07130f'),
  outlineLit: hex('#123024'),
};
const BIRCH_WOOD: Material = { ramp: ramp('#4f4a45', '#7a756c', '#a8a397', '#cfcabb', '#ebe7da', '#f8f6ee'), outline: hex('#211d1a') };
const BIRCH_LEAF: Material = {
  ramp: ramp('#15291a', '#1f3b20', '#2d5025', '#3f662b', '#557f33', '#6f983b', '#8db244', '#b0cb54', '#d4e279'),
  outline: hex('#0b170c'),
  outlineLit: hex('#1f3b20'),
};
const PINE_WOOD: Material = { ramp: ramp('#170d0a', '#281711', '#3a2218', '#4f2f20', '#66402a'), outline: hex('#0c0604') };
const PINE_LEAF: Material = {
  ramp: ramp('#061514', '#0a201e', '#0f2d28', '#153b32', '#1d4b3c', '#275c46', '#346f4f', '#468759', '#62a064', '#88bb74'),
  outline: hex('#040c0b'),
  outlineLit: hex('#0f2d28'),
};
const CHERRY_WOOD: Material = { ramp: ramp('#0d0708', '#1b0f11', '#2b1719', '#3d2120', '#502c28', '#663a31'), outline: hex('#080405') };
/** Cherry blossom: mauve in the shade, through rose, to near white where the sun is. */
export const CHERRY_BLOSSOM: Material = {
  ramp: ramp('#3b1a33', '#56243f', '#74304c', '#94415d', '#b3566f', '#cc6f85', '#e08c9e', '#efabb9', '#f9cbd4', '#ffe8ec'),
  outline: hex('#26101f'),
  outlineLit: hex('#56243f'),
};
const PETAL_GROUND: Material = { ramp: CHERRY_BLOSSOM.ramp, outline: CHERRY_BLOSSOM.outline, noOutline: true, noAO: true };
// -------------------------------------------------------------------- oaks

const OAK: Growth = { bow: 0.12, kink: 1, reach: 0.5, taper: 0.8, twig: 0.8, three: 0.35 };

function oakFrame(v: number, f: number): PixelCanvas {
  const c = new PixelCanvas(TREE_W, TREE_H);
  const R = rng(300 + v * 17);
  const bx = 48;
  const by = TREE_BASE_Y;
  const dx = leaner(swayAt(f, 1.3), by - 44, by - 104);
  // A broad, round crown of big clumps, then limbs grown out to each one.
  const cx = bx + (R() - 0.5) * 4;
  const cy = by - 74;
  const spots = scatter(R, cx, cy, 28 + v * 2, 18, 9 + v, 0.52, 0.45);
  const clumps = spots.map((s) => {
    const r = 10.5 + R() * 4.5 - Math.abs(s.x - cx) * 0.04;
    return makeClump(R, s.x, s.y, r, r * 0.8, 3.1);
  });
  const trunkR = 4.6 + v * 0.3;
  const sk = skeleton(R, OAK, { x: bx, y: by, r: trunkR + 0.6 }, { x: bx + (R() - 0.5) * 4, y: by - 32, r: trunkR * 0.8 }, spots.map((s) => ({ x: s.x, y: s.y + 3 })));
  const cr: Crown = { cx, cy, rx: 40, ry: 30, leaf: OAK_LEAF, cluster: 3.1, grain: 0.9, lift: 0.08, clumps };
  paintDepths(c, cr, dx, 0.72);
  rootsOf(c, bx, by, trunkR, 10, OAK_BARK, R);
  paintLimbs(c, sk, OAK_BARK, dx);
  mossOn(c, bx, by, trunkR);
  paintCrown(c, cr, dx, f);
  shadeUnder(c, OAK_BARK, bx - 12, bx + 12, Math.round(crownFloor(cr)) - 2, 7);
  return c;
}

/** Moss on the shaded side of the trunk's foot. */
function mossOn(c: PixelCanvas, bx: number, by: number, r: number): void {
  c.part();
  for (let y = by - 13; y < by - 1; y++) {
    const n = hash2(0, y, 241);
    if (n < 0.3) continue;
    const w = 1 + Math.floor(hash2(1, y, 243) * 2);
    for (let j = 0; j < w; j++) {
      const x = bx + r * 0.35 + j + Math.floor(hash2(2, y, 245) * 2);
      if (c.filled(Math.floor(x), y)) c.px(x, y, MOSS, cyl(0.5, 0.1));
    }
  }
}

// ----------------------------------------------------------------- birches

const BIRCH: Growth = { bow: 0.06, kink: 0.6, reach: 0.55, taper: 0.75, twig: 0.6, three: 0.2 };

function birchFrame(v: number, f: number): PixelCanvas {
  const c = new PixelCanvas(TREE_W, TREE_H);
  const R = rng(500 + v * 23);
  const bx = 48;
  const by = TREE_BASE_Y;
  // Birches are lighter and move more.
  const dx = leaner(swayAt(f, 1.6), by - 40, by - 108);
  // A tall, airy crown of small clumps, the white trunk running up into it.
  const cx = bx + (R() - 0.5) * 6;
  const cy = by - 82;
  const spots = scatter(R, cx, cy, 15 + v, 24, 11 + v, 0.42, 0.3);
  const clumps = spots.map((s) => {
    const r = 7 + R() * 2.5;
    return makeClump(R, s.x, s.y, r, r * 1.05, 2.4);
  });
  const sk = skeleton(R, BIRCH, { x: bx, y: by, r: 2.9 }, { x: cx + (R() - 0.5) * 2, y: by - 58, r: 2.1 }, spots.map((s) => ({ x: s.x, y: s.y + 2 })));
  const cr: Crown = { cx, cy, rx: 24, ry: 32, leaf: BIRCH_LEAF, cluster: 2.4, grain: 1, lift: 0.05, clumps };
  paintDepths(c, cr, dx, 0.55);
  rootsOf(c, bx, by, 2.7, 6, BIRCH_WOOD, R);
  paintLimbs(c, sk, BIRCH_WOOD, dx);
  birchMarks(c, sk, dx);
  paintCrown(c, cr, dx, f);
  shadeUnder(c, BIRCH_WOOD, bx - 8, bx + 8, Math.round(crownFloor(cr)) - 1, 6);
  return c;
}

/** Birch bark: black lenticels across the white, the dark cracked foot, dark knots at the forks. */
function birchMarks(c: PixelCanvas, sk: Skeleton, dx: (y: number) => number): void {
  for (const l of sk.limbs) {
    l.pts.forEach((p, s) => {
      if (p.r < 1) return;
      const x = p.x + dx(p.y);
      const n = hash2(s, l.depth * 7 + Math.floor(p.x), 421);
      if (n > 0.45) {
        const len = 1 + Math.floor(hash2(s, 1, 423) * p.r * 1.1);
        const start = Math.floor(x - p.r + 0.6 + hash2(s, 2, 425) * p.r);
        for (let j = 0; j < len; j++) if (c.materialAt(start + j, Math.floor(p.y)) === BIRCH_WOOD) tone(c, start + j, Math.floor(p.y), 0);
      }
      // Knots where a limb leaves its parent.
      if (s === 0 && l.depth > 0) {
        tone(c, Math.floor(x), Math.floor(p.y), 0);
        tone(c, Math.floor(x), Math.floor(p.y) + 1, 1);
      }
    });
  }
  const trunk = sk.limbs[0].pts;
  for (let y = TREE_BASE_Y - 9; y < TREE_BASE_Y + 2; y++) {
    for (let x = 36; x < 60; x++) {
      if (c.materialAt(x, y) !== BIRCH_WOOD) continue;
      const u = (TREE_BASE_Y - y) / 9;
      if (hash2(x, y >> 1, 427) > 0.25 + u * 0.6) tone(c, x, y, hash2(x, y, 429) > 0.5 ? 1 : 0);
    }
  }
  void trunk;
}

// ------------------------------------------------------------------- pines

function pineFrame(v: number, f: number): PixelCanvas {
  const c = new PixelCanvas(TREE_W, TREE_H);
  const R = rng(700 + v * 29);
  const bx = 48;
  const by = TREE_BASE_Y;
  const dx = leaner(swayAt(f, 1.1), by - 20, by - 112);
  const top = by - 116 + v * 4;
  const tiers = 7;
  // Each tier: a skirt of drooping boughs round the trunk, the lower ones wider.
  const plan = Array.from({ length: tiers }, (_t, k) => {
    const u = k / (tiers - 1);
    const t0 = top + u ** 0.92 * 84;
    return {
      t0,
      h: 13 + u * 11,
      w: 5 + u * 27 + v + (R() - 0.5) * 3,
      tips: Array.from({ length: 5 + Math.round(u * 6) }, () => ({ at: R(), len: R(), bend: R() })),
      // Needle sprays on a jittered grid over the tier, each one shade with a bright top.
      sprays: (() => {
        const w = 5 + u * 27 + v + 3;
        const list: { x: number; y: number; j: number }[] = [];
        for (let y = 0; y <= 13 + u * 11 + 8; y += 2.6) for (let x = -w; x <= w; x += 3.4) list.push({ x: x + (R() - 0.5) * 2, y: y + (R() - 0.5) * 1.4, j: R() - 0.5 });
        return list;
      })(),
    };
  });
  // The trunk, a little of it showing under the lowest tier.
  const sk: Skeleton = { limbs: [{ pts: [{ x: bx, y: by, r: 3.6 }, { x: bx, y: by - 20, r: 2.8 }, { x: bx, y: by - 60, r: 1.6 }, { x: bx, y: top + 6, r: 0.6 }], depth: 0 }], tips: [] };
  rootsOf(c, bx, by, 3.6, 7, PINE_WOOD, R);
  paintLimbs(c, sk, PINE_WOOD, dx);
  const k = PINE_LEAF.ramp.length;
  // Lowest tier first, so each tier's hem hangs over the one below it.
  for (let t = tiers - 1; t >= 0; t--) {
    const p = plan[t];
    const cx = bx + dx(p.t0 + p.h * 0.5);
    const t1 = p.t0 + p.h;
    // The hem: bough tips hanging down, deeper toward the sides.
    const hem = (x: number): number => {
      const s = (x - cx) / p.w;
      let y = t1 - (1 - Math.abs(s)) * 2 + Math.abs(s) ** 2 * 3;
      for (const tip of p.tips) {
        const tx = (tip.at * 2 - 1) * 0.95;
        const d = Math.abs(s - tx) * p.w;
        if (d < 2.2) y += (2.2 - d) * (0.9 + tip.len * 1.4);
      }
      return y;
    };
    const edge = (y: number): number => {
      const u = (y - p.t0) / p.h;
      return u <= 0 ? 0.6 : 1 + (p.w - 1) * Math.min(1, u) ** 0.8;
    };
    c.part();
    for (let y = Math.floor(p.t0); y <= t1 + 6; y++) {
      const hw = edge(y);
      const row = p.sprays.filter((q) => Math.abs(y + 0.5 - p.t0 - q.y) < 4.8);
      for (let x = Math.floor(cx - hw - 1); x <= cx + hw + 1; x++) {
        const s = (x + 0.5 - cx) / hw;
        if (Math.abs(s) > 1 || y + 0.5 > hem(x + 0.5)) continue;
        // The nearest two needle sprays (stretched sideways, as boughs lie).
        const lx = x + 0.5 - cx;
        const ly = y + 0.5 - p.t0;
        let d1 = 1e9;
        let d2 = 1e9;
        let near = p.sprays[0];
        for (const q of row) {
          const ex = (lx - q.x) / 2.3;
          const ey = (ly - q.y) / 1.6;
          if (Math.abs(ex) > 3 || Math.abs(ey) > 3) continue;
          const d = Math.hypot(ex, ey);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            near = q;
          } else if (d < d2) d2 = d;
        }
        const u = (y - p.t0) / (hem(x + 0.5) - p.t0);
        c.px(x, y, PINE_LEAF, sphere(s * 0.8, u * 1.4 - 0.7, 0.9));
        // The spray's shade from where it sits on the tier: the sunny upper left bright, the far side and the underside dark.
        const ns = near.x / p.w;
        const nu = near.y / p.h;
        const whole = -((p.t0 + near.y - top) / 110 - 0.4) * 0.35;
        let step = toStep(-ns * 0.9 - (nu - 0.25) * 1.2 + whole + near.j * 0.3 + 0.32, k, 0, 0, 0);
        // Each spray hangs over the next: a bright upper edge, a dark lip under it.
        const rim = -((lx - near.x) / 2.3) * 0.35 * Math.sign(lx || 1) - ((ly - near.y) / 1.6) * 0.95;
        if (rim < -0.75 && d2 - d1 < 0.5) step -= 2;
        else if (rim > 0.55 && d1 > 0.4) step += 1;
        tone(c, x, y, Math.max(0, Math.min(k - 1, step)));
      }
    }
    // Sunlit needle tips along the tier's top edge on the lit side.
    for (let y = Math.floor(p.t0); y <= t1 + 6; y++) {
      for (let x = Math.floor(cx - p.w - 1); x <= cx + 1; x++) {
        if (c.materialAt(x, y) !== PINE_LEAF || c.filled(x - 1, y - 1) || c.layer[y * c.w + x] !== c.layer[Math.floor(p.t0 + 2) * c.w + Math.floor(cx)]) continue;
        if (hash2(x - Math.round(cx), y, 437) > 0.3) tone(c, x, y, k - 2 + (hash2(x, y, 439) > 0.7 ? 1 : 0));
      }
    }
  }
  // The shade each tier casts on the tier below, just under its hem.
  for (let y = top + 8; y < by; y++) {
    for (let x = 0; x < c.w; x++) {
      if (c.materialAt(x, y) !== PINE_LEAF) continue;
      const i = y * c.w + x;
      for (let up = 1; up <= 3; up++) {
        const j = (y - up) * c.w + x;
        if (y - up < 0 || c.mat[j] < 0) break;
        if (c.layer[j] > c.layer[i]) {
          c.shade(x, y, up === 1 ? -3 : -2);
          break;
        }
      }
    }
  }
  shadeUnder(c, PINE_WOOD, bx - 5, bx + 5, Math.round(plan[tiers - 1].t0 + plan[tiers - 1].h), 5);
  return c;
}

// ------------------------------------------------------------------ cherry

const CHERRY: Growth = { bow: 0.24, kink: 1.2, reach: 0.4, taper: 0.72, twig: 0.7, three: 0.3 };

/**
 * A cherry tree in bloom, on the forest trees' 96 x 128 frame: a gnarled dark
 * trunk twisting up into crooked limbs that reach out wide, carrying layered
 * clouds of blossom, rose in the shade and near white in the sun, with the
 * dark limbs showing between the layers; petals fallen round its roots.
 * Frame `f` of its sway.
 */
export function cherryTree(v: number, f = 0): PixelCanvas {
  const c = new PixelCanvas(TREE_W, TREE_H);
  const R = rng(4100 + v * 37);
  const bx = 48;
  const by = TREE_BASE_Y;
  const dx = leaner(swayAt(f, 1.3), by - 34, by - 96);
  // Fallen petals first, under everything: thicker near the trunk.
  const petals = Array.from({ length: 46 }, () => {
    const a = R() * Math.PI * 2;
    const d = 5 + R() ** 0.8 * 24;
    return { x: bx + Math.cos(a) * d * 1.4, y: by - 1 + Math.sin(a) * d * 0.38, s: 4 + Math.floor(R() * 5) };
  });
  // Clouds of blossom in layers, broad and flat, with room between the
  // layers for the dark limbs to show.
  const cx = bx + (R() - 0.5) * 4;
  const spots: { x: number; y: number; rx: number; ry: number }[] = [];
  const layers = [
    { y: by - 90, n: 2, w: 10, r: 11 },
    { y: by - 76, n: 2, w: 24, r: 10.5 },
    { y: by - 62, n: 2, w: 29, r: 10 },
    { y: by - 66, n: 1, w: 0, r: 8 },
  ];
  for (const l of layers) {
    for (let k = 0; k < l.n; k++) {
      const u = l.n === 1 ? 0 : (k / (l.n - 1)) * 2 - 1;
      const r = l.r + R() * 2.5;
      spots.push({ x: cx + u * l.w + (R() - 0.5) * 5, y: l.y + (R() - 0.5) * 4 + Math.abs(u) * 4, rx: r * 1.25, ry: r * 0.72 });
    }
  }
  const clumps = spots.map((s) => makeClump(R, s.x, s.y, s.rx, s.ry, 2.8));
  // A gnarled trunk, leaning and forking low.
  const lean = (v - 1) * 4 + (R() - 0.5) * 3;
  const sk = skeleton(R, CHERRY, { x: bx, y: by, r: 4.6 }, { x: bx + lean, y: by - 24, r: 3.8 }, spots.map((s) => ({ x: s.x, y: s.y + 2 })));
  const cr: Crown = { cx: bx, cy: by - 74, rx: 42, ry: 24, leaf: CHERRY_BLOSSOM, cluster: 2.8, grain: 1, lift: 0.12, clumps };

  c.part();
  for (const p of petals) c.px(p.x, p.y, PETAL_GROUND, FLAT);
  for (const p of petals) tone(c, Math.floor(p.x), Math.floor(p.y), p.s);
  paintDepths(c, cr, dx, 0.3);
  rootsOf(c, bx, by, 4.2, 9, CHERRY_WOOD, R);
  paintLimbs(c, sk, CHERRY_WOOD, dx);
  cherryBark(c, sk, dx);
  paintCrown(c, cr, dx, f);
  // Single open blossoms on the sunny crests: the brightest white.
  for (let y = by - 110; y < by - 36; y++) {
    for (let x = 2; x < TREE_W - 2; x++) {
      if (c.materialAt(x, y) !== CHERRY_BLOSSOM) continue;
      const h = hash2(x - Math.round(dx(y)), y, 441 + v);
      const lit = c.filled(x, y - 2) === false || c.filled(x - 2, y) === false;
      if (lit && h > 0.8) tone(c, x, y, CHERRY_BLOSSOM.ramp.length - 1);
    }
  }
  shadeUnder(c, CHERRY_WOOD, bx - 14, bx + 14, Math.round(crownFloor(cr)) - 2, 6);
  return c;
}

/** Cherry bark: dark, with pale bands of lenticels round it, as a cherry's has. */
function cherryBark(c: PixelCanvas, sk: Skeleton, dx: (y: number) => number): void {
  for (const l of sk.limbs) {
    if (l.depth > 1) continue;
    l.pts.forEach((p, s) => {
      if (p.r < 1.6 || hash2(s, l.depth, 445) < 0.55) return;
      const x = p.x + dx(p.y);
      const y = Math.floor(p.y);
      // A short pale band, across the lit half only.
      for (let j = Math.floor(x - p.r + 1); j < x; j++) {
        if (c.materialAt(j, y) === CHERRY_WOOD) c.shade(j, y, 1);
      }
    });
  }
}

// ------------------------------------------------------------------ maples

/** Autumn maples, a turn of the year each: flame orange, gold, and deep crimson. */
const MAPLE_LEAVES: Material[] = [
  ramp('#2a0c0a', '#451410', '#651d12', '#8a2c14', '#b04218', '#d05e1e', '#e8802a', '#f6a540', '#ffcb6a'),
  ramp('#2c1a08', '#48290b', '#6a3f0e', '#8e5812', '#b27518', '#d09320', '#e6b22e', '#f4cd4c', '#fde584'),
  ramp('#22060e', '#3b0a16', '#58101e', '#781826', '#98222e', '#b83038', '#d44a44', '#ec6c56', '#fa9876'),
].map((r) => ({ ramp: r, outline: hex('#140604'), outlineLit: r[1] }));
const MAPLE_BARK: Material = { ramp: ramp('#170f0c', '#261915', '#38251d', '#4c3226', '#624232', '#7a5540'), outline: hex('#0c0706') };
const MAPLE: Growth = { bow: 0.14, kink: 1, reach: 0.48, taper: 0.78, twig: 0.75, three: 0.3 };

/**
 * An autumn maple on the forest trees' 96 x 128 frame: a domed crown of
 * fiery clumps over a grey-brown trunk, and the leaves it has already let go
 * of lying in a ring round its roots. Variant `v` picks the colour.
 */
export function mapleTree(v: number, f = 0): PixelCanvas {
  const c = new PixelCanvas(TREE_W, TREE_H);
  const R = rng(5200 + v * 41);
  const bx = 48;
  const by = TREE_BASE_Y;
  const leaf = MAPLE_LEAVES[v % MAPLE_LEAVES.length];
  const litter: Material = { ramp: leaf.ramp, outline: leaf.outline, noOutline: true, noAO: true };
  const dx = leaner(swayAt(f, 1.25), by - 40, by - 104);
  // Fallen leaves, thick by the trunk and thinning out, a few blown further.
  const fallen = Array.from({ length: 64 }, () => {
    const a = R() * Math.PI * 2;
    const d = 4 + R() ** 0.9 * 26;
    return { x: bx + Math.cos(a) * d * 1.35, y: by - 1 + Math.sin(a) * d * 0.36, s: 2 + Math.floor(R() * 6), two: R() < 0.4 };
  });
  // A dome, taller than an oak's and a little narrower, of mid-sized clumps.
  const cx = bx + (R() - 0.5) * 4;
  const cy = by - 76;
  const spots = scatter(R, cx, cy, 25 + v * 2, 22, 11 + v, 0.46, 0.4);
  const clumps = spots.map((s) => {
    const r = 9 + R() * 3.5 - Math.abs(s.x - cx) * 0.035;
    return makeClump(R, s.x, s.y, r, r * 0.85, 2.8);
  });
  const trunkR = 4.2 + v * 0.2;
  const sk = skeleton(R, MAPLE, { x: bx, y: by, r: trunkR + 0.5 }, { x: bx + (R() - 0.5) * 3, y: by - 36, r: trunkR * 0.78 }, spots.map((s) => ({ x: s.x, y: s.y + 3 })));
  const cr: Crown = { cx, cy, rx: 36, ry: 32, leaf, cluster: 2.8, grain: 0.95, lift: 0.1, clumps };

  c.part();
  for (const p of fallen) {
    c.px(p.x, p.y, litter, FLAT);
    if (p.two) c.px(p.x + 1, p.y, litter, FLAT);
  }
  for (const p of fallen) {
    tone(c, Math.floor(p.x), Math.floor(p.y), p.s);
    if (p.two) tone(c, Math.floor(p.x) + 1, Math.floor(p.y), Math.max(0, p.s - 1));
  }
  paintDepths(c, cr, dx, 0.66);
  rootsOf(c, bx, by, trunkR, 9, MAPLE_BARK, R);
  paintLimbs(c, sk, MAPLE_BARK, dx);
  paintCrown(c, cr, dx, f);
  // Single leaves catching the sun on the crests: the palest gold.
  for (let y = by - 114; y < by - 36; y++) {
    for (let x = 2; x < TREE_W - 2; x++) {
      if (c.materialAt(x, y) !== leaf) continue;
      const open = c.filled(x, y - 2) === false || c.filled(x - 2, y) === false;
      if (open && hash2(x - Math.round(dx(y)), y, 461 + v) > 0.82) tone(c, x, y, leaf.ramp.length - 1);
    }
  }
  shadeUnder(c, MAPLE_BARK, bx - 12, bx + 12, Math.round(crownFloor(cr)) - 2, 7);
  return c;
}

// ----------------------------------------------------------------- willows

const WILLOW_LEAF: Material = {
  ramp: ramp('#0d1e14', '#142c19', '#1d3d1e', '#2a5123', '#3a6628', '#4f7d2e', '#689536', '#86ae40', '#a8c655', '#cadd78'),
  outline: hex('#08120b'),
  outlineLit: hex('#142c19'),
};
const WILLOW_BARK: Material = { ramp: ramp('#15110d', '#241d16', '#352a1f', '#483a2a', '#5d4c37', '#756247'), outline: hex('#0a0806') };
const WILLOW: Growth = { bow: 0.22, kink: 1.1, reach: 0.45, taper: 0.74, twig: 0.7, three: 0.35 };

/**
 * A weeping willow on the forest trees' 96 x 128 frame: a short, stout,
 * furrowed trunk that splits into arching limbs, and from their crown a
 * curtain of long hanging strands, almost to the ground. The strands swing
 * more the lower they hang. Willows grow by the water.
 */
export function willowTree(v: number, f = 0): PixelCanvas {
  const c = new PixelCanvas(TREE_W, TREE_H);
  const R = rng(6300 + v * 43);
  const bx = 48;
  const by = TREE_BASE_Y;
  const k = WILLOW_LEAF.ramp.length;
  const sw = swayAt(f, 1);
  const dx = leaner(sw * 0.7, by - 30, by - 100);
  // The crown: a low, wide dome where the limbs end.
  const cx = bx + (R() - 0.5) * 4;
  const cy = by - 78 + v * 2;
  const rx = 30 + v * 2;
  const ry = 14;
  const spots = scatter(R, cx, cy, rx * 0.8, ry, 8 + v, 0.5, 0);
  const clumps = spots.map((s) => makeClump(R, s.x, s.y, 8 + R() * 3, 6 + R() * 2, 2.4));
  const trunkR = 5 + v * 0.3;
  const sk = skeleton(R, WILLOW, { x: bx, y: by, r: trunkR + 0.6 }, { x: bx + (R() - 0.5) * 5, y: by - 28, r: trunkR * 0.8 }, spots.map((s) => ({ x: s.x, y: s.y + 2 })));
  const cr: Crown = { cx, cy, rx, ry: ry + 6, leaf: WILLOW_LEAF, cluster: 2.4, grain: 1, lift: 0.04, clumps };

  // The strands: from points over the dome, a little arch outward, then
  // hanging. `back` ones hang behind the trunk and are darker.
  interface Strand { x: number; y: number; out: number; len: number; back: boolean; j: number; }
  const strands: Strand[] = [];
  const count = 44 + v * 6;
  for (let s = 0; s < count; s++) {
    const u = (s + R() * 0.8) / count;
    const a = Math.PI + u * Math.PI;
    const x = cx + Math.cos(a) * rx * (0.95 + R() * 0.12);
    const y = cy + Math.sin(a) * ry * 0.7 + 2 + R() * 4;
    const edge = Math.abs(Math.cos(a));
    const len = 34 + R() * 26 + (1 - edge) * 12 - v * 2;
    strands.push({ x, y, out: Math.sign(Math.cos(a)) * edge * (3 + R() * 3), len: Math.min(len, by - 4 - y), back: R() < 0.4 && edge < 0.8, j: R() - 0.5 });
  }
  const hang = (st: Strand, t: number) => {
    // Out along the arch, then straight down, swinging more the lower it is.
    const drop = t * st.len;
    const arch = st.out * Math.min(1, t * 4);
    return { x: st.x + arch + dx(st.y) + sw * 1.6 * (drop / 50) ** 1.3, y: st.y + drop };
  };
  const drawStrand = (st: Strand, dark: number) => {
    c.part();
    const n = Math.ceil(st.len);
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      const p = hang(st, t);
      const side = st.out < 0 ? -1 : 1;
      c.px(p.x, p.y, WILLOW_LEAF, sphere(side * 0.5, 0.1, 0.8));
      // Its leaves: little nubs alternating either side, fewer at the tip.
      if (s % 2 === 0 && t < 0.92) c.px(p.x + (s % 4 === 0 ? -1 : 1), p.y + 0.5, WILLOW_LEAF, sphere((s % 4 === 0 ? -1 : 1) * 0.7, 0.2, 0.7));
      // Brighter up in the light and on the sun's side, darker down in the shade.
      const lit = 0.25 - t * 0.9 - (p.x - cx) / (rx * 3) + st.j * 0.4 - dark;
      const step = toStep(lit, k, Math.floor(p.x), Math.floor(p.y), 0.3);
      tone(c, Math.floor(p.x), Math.floor(p.y), step);
      tone(c, Math.floor(p.x) + (s % 4 === 0 ? -1 : 1), Math.floor(p.y + 0.5), Math.max(0, step - 1));
    }
  };
  for (const st of strands) if (st.back) drawStrand(st, 0.5);
  paintDepths(c, cr, dx, 0.55);
  rootsOf(c, bx, by, trunkR, 10, WILLOW_BARK, R);
  paintLimbs(c, sk, WILLOW_BARK, dx);
  mossOn(c, bx, by, trunkR);
  paintCrown(c, cr, dx, f);
  for (const st of strands) if (!st.back) drawStrand(st, 0);
  shadeUnder(c, WILLOW_BARK, bx - 12, bx + 12, Math.round(cy + 6), 6);
  return c;
}

// ------------------------------------------------------------------ elder

export const ELDER_W = 176;
export const ELDER_H = 184;
/** Where the elder's trunk meets the ground in its frame. */
export const ELDER_BASE_Y = 178;

const ELDER_BARK: Material = { ramp: ramp('#140d0a', '#221610', '#332218', '#462f21', '#5b3e2b', '#735037', '#8c6545'), outline: hex('#0a0605') };
const ELDER_LEAF: Material = {
  ramp: ramp('#0a1b1a', '#0f2822', '#15372a', '#1e4830', '#295c35', '#377238', '#4b893c', '#66a042', '#8aba50', '#b2d266'),
  outline: hex('#061110'),
  outlineLit: hex('#0f2822'),
};
/** Pale lichen and the old runes cut in its bark, glowing faintly. */
const ELDER_GLOW: Material = { ramp: ramp('#1d6a5e', '#34a08c', '#6fd6bd', '#bff5e4'), outline: hex('#0a2a24'), emissive: 0.7, noAO: true, noOutline: true };
const ELDER: Growth = { bow: 0.16, kink: 1.4, reach: 0.45, taper: 0.8, twig: 1, three: 0.4 };

/**
 * The elder of a wood: an oak older than the forest round it, twice the
 * height of the others, with a trunk like a tower of twisted roots, a crown
 * like a hill of leaves, hanging moss, and old runes in its bark that glow a
 * little. One stands in the middle of its own glade. Frame `f` of its sway.
 */
export function elderTree(f = 0): PixelCanvas {
  const c = new PixelCanvas(ELDER_W, ELDER_H);
  const R = rng(7700);
  const bx = ELDER_W / 2;
  const by = ELDER_BASE_Y;
  const dx = leaner(swayAt(f, 0.9), by - 70, by - 170);
  const cx = bx;
  const cy = by - 118;
  const spots = scatter(R, cx, cy, 64, 38, 17, 0.38, 0.4);
  const clumps = spots.map((s) => {
    const r = 15 + R() * 6 - Math.abs(s.x - cx) * 0.05;
    return makeClump(R, s.x, s.y, r, r * 0.8, 3.4);
  });
  const trunkR = 11;
  const sk = skeleton(R, ELDER, { x: bx, y: by, r: trunkR + 1 }, { x: bx + (R() - 0.5) * 6, y: by - 58, r: trunkR * 0.78 }, spots.map((s) => ({ x: s.x, y: s.y + 4 })));
  const cr: Crown = { cx, cy, rx: 82, ry: 50, leaf: ELDER_LEAF, cluster: 3.4, grain: 0.9, lift: 0.06, clumps };
  paintDepths(c, cr, dx, 0.75);
  // Great roots, two rings of them, clawing into the ground.
  rootsOf(c, bx, by, trunkR, 24, ELDER_BARK, R);
  rootsOf(c, bx + 2, by + 1, trunkR * 0.7, 16, ELDER_BARK, R);
  paintLimbs(c, sk, ELDER_BARK, dx);
  // The trunk's twist: dark seams spiralling up it.
  const trunk = sk.limbs[0].pts;
  for (let y = by - 56; y < by - 2; y++) {
    const p = trunk.reduce((a, b) => (Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a));
    for (let s = 0; s < 3; s++) {
      const x = Math.round(p.x + Math.sin((y + s * 17) * 0.11) * p.r * 0.8);
      if (c.materialAt(x, y) === ELDER_BARK) c.shade(x, y, -2);
    }
  }
  // Moss up the shaded side and the runes, glowing, on the lit side.
  mossOn(c, bx, by, trunkR);
  mossOn(c, bx + 3, by - 12, trunkR);
  c.part();
  const runes = [
    [0, 0], [1, 0], [2, 0], [1, 1], [1, 2], [0, 3], [2, 3],
    [0, 6], [0, 7], [0, 8], [1, 7], [2, 6], [2, 8],
    [1, 11], [0, 12], [2, 12], [1, 13], [1, 14],
  ];
  for (const [rx, ry] of runes) c.px(bx - 6 + rx, by - 44 + ry, ELDER_GLOW, FLAT, { bias: 1 });
  for (let k = 0; k < 16; k++) {
    const x = bx - trunkR + R() * trunkR * 2;
    const y = by - 6 - R() * 48;
    if (c.materialAt(x, y) === ELDER_BARK) c.px(x, y, ELDER_GLOW, FLAT, { bias: -1 });
  }
  paintCrown(c, cr, dx, f);
  // Moss hanging from the crown's underside in long threads.
  for (let s = 0; s < 26; s++) {
    const x0 = cx - 64 + R() * 128;
    let y0 = -1;
    for (let y = by - 40; y > by - 170; y--) {
      if (c.materialAt(Math.floor(x0 + dx(y)), y) === ELDER_LEAF) {
        y0 = y;
        break;
      }
    }
    if (y0 < 0) continue;
    c.part();
    const len = 6 + R() * 16;
    for (let t = 0; t < len; t++) {
      const x = x0 + dx(y0) + Math.sin(t * 0.5 + s) * 0.6 + swayAt(f, 0.6) * (t / 20);
      c.px(x, y0 + t, MOSS, sphere(0, 0.2));
    }
  }
  shadeUnder(c, ELDER_BARK, bx - 24, bx + 24, Math.round(crownFloor(cr)) - 3, 10);
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

export { leaner, swayAt };

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
