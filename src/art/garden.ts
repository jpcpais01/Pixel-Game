// Art for the Sunken Garden: crumbling ruin walls, broken columns, the
// fountain in the pool, the giant thornblooms that choke its doorways and
// the glowing blooms that hold buffs. Everything is lit (diffuse + normal),
// with emissive where it glows, like the rest of the world's props.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { hash2, rng } from './env';

const ramp = (...c: string[]): RGB[] => c.map(hex);

const INK = hex('#120e16');
const RUIN: Material = { ramp: ramp('#262129', '#362f39', '#4a414b', '#60555d', '#796b71', '#938487', '#ae9f9c', '#c9bcb1'), outline: INK };
const MOSS: Material = { ramp: ramp('#14301e', '#1e4428', '#2b5a32', '#3e723d', '#588c4a'), outline: hex('#0a1a10'), noOutline: true };
const IVY: Material = { ramp: ramp('#0c2618', '#133a24', '#1b5030', '#27683b', '#378247', '#4f9c55', '#72b866'), outline: hex('#07160d') };
const IVY_FLOWER: Material = { ramp: ramp('#8e3462', '#cc5a92', '#f79cc6', '#ffe2f0'), outline: hex('#2a0a1c'), noOutline: true, noAO: true };
const STEM: Material = { ramp: ramp('#0e2616', '#163c24', '#205230', '#2d6a3c', '#40844a', '#5c9e5a', '#80ba6e'), outline: hex('#07140c') };
const WILT: Material = { ramp: ramp('#1e1a10', '#2e2816', '#433a1c', '#5a4e24', '#72652e'), outline: hex('#0e0c08') };
const THORN: Material = { ramp: ramp('#3a0a14', '#6a1422', '#a02a30', '#e0645a'), outline: hex('#18060a'), noOutline: true };
const CRIMSON: Material = {
  ramp: ramp('#26051a', '#420a28', '#650f3a', '#8c1a4e', '#b42a62', '#d8467c', '#f47aa2', '#ffc0d6'),
  outline: hex('#170410'),
  outlineLit: hex('#3a0a22'),
  shine: true,
};
const VEIN: Material = { ramp: ramp('#8a5a10', '#d09a2a', '#ffd45c', '#fff2b0'), outline: INK, emissive: 0.55, noOutline: true, noAO: true };
const WATER: Material = { ramp: ramp('#0f3a4a', '#185868', '#267a86', '#46a0a4', '#86d0c8', '#d0fff4'), outline: hex('#06161c'), emissive: 0.3, noOutline: true, noAO: true };
const LUMEN: Material = { ramp: ramp('#1a6a70', '#34a8a8', '#6ee6d6', '#c8fff4', '#ffffff'), outline: hex('#08242a'), emissive: 0.9, noAO: true };

/** Normals of a wall's top (facing the sky) and front (facing the viewer). */
const TOP: Vec3 = { x: 0, y: 0.62, z: 0.78 };
const FRONT: Vec3 = { x: 0, y: -0.16, z: 0.99 };
const tilt = (x: number, y: number, z: number): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};

/** A leaf from (x, y) along angle `a`, `len` long and `w` wide at its middle. */
function leaf(c: PixelCanvas, x: number, y: number, a: number, len: number, w: number, m: Material, bias = 0): void {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const r = len + w + 1;
  for (let py = Math.floor(y - r); py <= y + r; py++) {
    for (let px = Math.floor(x - r); px <= x + r; px++) {
      const dx = px + 0.5 - x;
      const dy = py + 0.5 - y;
      const u = dx * ca + dy * sa;
      const v = -dx * sa + dy * ca;
      if (u < 0 || u > len) continue;
      const half = Math.sin((u / len) * Math.PI) ** 0.8 * w;
      if (Math.abs(v) > half) continue;
      // Folded along the midrib: each half faces a little away from it.
      const side = v < 0 ? -1 : 1;
      const n = tilt(-sa * side * 0.55 + ca * 0.1, -(ca * side * 0.55) * -1 * 0.6 + 0.35, 0.8);
      c.px(px, py, m, n, { bias: bias + (Math.abs(v) < 0.6 && u > 1 ? -1 : 0) });
    }
  }
}

/** A trailing strand of ivy from (x, y) hanging `len` pixels, with leaves and, now and then, a tiny flower. */
function ivy(c: PixelCanvas, x: number, y: number, len: number, R: () => number, flowers = 0.25): void {
  c.part();
  let px = x;
  for (let s = 0; s < len; s++) {
    px += (R() - 0.5) * 0.8;
    const py = y + s;
    c.px(px, py, IVY, sphere(-0.2, 0.1), { bias: -1 });
    if (R() < 0.55) {
      const side = R() < 0.5 ? -1 : 1;
      c.px(px + side, py, IVY, sphere(side * 0.5, 0.3), { bias: side < 0 ? 1 : 0 });
      if (R() < 0.4) c.px(px + side * 2, py - 1, IVY, sphere(side * 0.7, 0.4));
    }
    if (R() < flowers * 0.25) c.px(px + (R() < 0.5 ? -1 : 1), py, IVY_FLOWER, sphere(-0.3, 0.4));
  }
}

// ---------------------------------------------------------------------------
// Ruin walls. A wall is a row of chunks: each is a stretch of footprint with
// a top face (seen from above) and, below it, a front face of coursed blocks.

/** Wall height (front face), footprint depth (top face) in pixels. */
export const WALL_HEIGHT = 10;
const WALL_DEPTH = 8;

export const RUIN_H_W = 26;
export const RUIN_H_H = 24;
/** Bottom row of the front face in a horizontal chunk. */
export const RUIN_H_BASE = 22;
/** Footprint width of one horizontal chunk. */
export const RUIN_H_STEP = 24;

/** One chunk of an east-west wall, 24 pixels of footprint. */
export function ruinH(v: number): PixelCanvas {
  const c = new PixelCanvas(RUIN_H_W, RUIN_H_H);
  const R = rng(300 + v * 17);
  const B = RUIN_H_BASE;
  const hAt = (x: number) => {
    let h = WALL_HEIGHT;
    if (v === 1) {
      // Fallen in toward the middle.
      const u = (x - 12.5) / 8;
      if (Math.abs(u) < 1) h -= Math.round((1 - u * u) * 5);
    }
    if (x > 2 && x < 23 && hash2(x, v, 3) > 0.8) h -= 1; // chipped
    return h;
  };
  c.part();
  for (let x = 1; x <= 24; x++) {
    const h = hAt(x);
    // Front face: blocks in courses of four rows, joints staggered.
    for (let y = B - h + 1; y <= B; y++) {
      const k = B - y;
      const course = Math.floor(k / 4);
      const joint = k % 4 === 3 || (x + course * 5 + v * 3) % 8 === 0;
      const block = hash2(Math.floor((x + course * 5 + v * 3) / 8), course, 7 + v);
      const n = x === 1 ? tilt(-0.4, -0.1, 0.9) : x === 24 ? tilt(0.4, -0.1, 0.9) : FRONT;
      c.px(x, y, RUIN, n, { bias: joint ? -2 : block > 0.7 ? 1 : block < 0.25 ? -1 : 0 });
    }
    // Top face: flat stones, lit from above.
    for (let y = B - h - WALL_DEPTH + 1; y <= B - h; y++) {
      const edge = y === B - h;
      const joint = (x + (y < B - h - 3 ? 3 : 0)) % 7 === 0;
      c.px(x, y, RUIN, TOP, { bias: 1 + (joint ? -2 : 0) + (edge ? 1 : 0) });
    }
  }
  // Moss on the top.
  c.part();
  for (let x = 1; x <= 24; x++) {
    const h = hAt(x);
    for (let y = B - h - WALL_DEPTH + 1; y <= B - h; y++) {
      if (hash2(Math.floor(x / 3), Math.floor(y / 2), 31 + v) > 0.62 && hash2(x, y, 9) > 0.25) c.px(x, y, MOSS, TOP, { bias: 1 });
    }
  }
  // Ivy spills over the edge and hangs down the front.
  const strands = v === 2 ? 7 : 2 + Math.floor(R() * 2);
  for (let s = 0; s < strands; s++) {
    const x = 2 + R() * 21;
    const top = B - hAt(Math.round(x)) - 2;
    ivy(c, x, top, v === 2 ? 5 + R() * 7 : 3 + R() * 6, R, v === 2 ? 1 : 0.4);
  }
  if (v === 1) {
    // Fallen blocks at its foot.
    c.part();
    c.ellipse(9, B - 1, 3, 1.8, RUIN, { flatten: 0.7 });
    c.ellipse(16, B, 2.4, 1.4, RUIN, { flatten: 0.7 });
  }
  return c;
}

export const RUIN_V_W = 12;
export const RUIN_V_H = 30;
/** Bottom row of the south end's face in a vertical chunk. */
export const RUIN_V_BASE = 28;
/** Footprint length of one vertical chunk. */
export const RUIN_V_STEP = 16;

/** One chunk of a north-south wall: its long top, and the face of its south end. */
export function ruinV(v: number): PixelCanvas {
  const c = new PixelCanvas(RUIN_V_W, RUIN_V_H);
  const R = rng(500 + v * 23);
  const B = RUIN_V_BASE;
  const h = WALL_HEIGHT;
  const top = B - h - RUIN_V_STEP + 1;
  c.part();
  for (let x = 2; x <= 9; x++) {
    // The top, bevelled at its sides.
    for (let y = top; y <= B - h; y++) {
      const joint = (y - top + (x > 5 ? 2 : 0)) % 5 === 4 || (x === 6 && (y - top) % 10 < 5);
      const n = x === 2 ? tilt(-0.45, 0.5, 0.74) : x === 9 ? tilt(0.45, 0.5, 0.74) : TOP;
      c.px(x, y, RUIN, n, { bias: 1 + (joint ? -2 : 0) + (hash2(x >> 2, (y - top) / 5, 5 + v) > 0.7 ? 1 : 0) });
    }
    // The south end's face (hidden under the next chunk when there is one).
    for (let y = B - h + 1; y <= B; y++) {
      const k = B - y;
      const joint = k % 4 === 3 || (x + Math.floor(k / 4) * 3) % 5 === 0;
      c.px(x, y, RUIN, FRONT, { bias: joint ? -2 : 0 });
    }
  }
  c.part();
  for (let y = top; y <= B - h; y++) {
    for (let x = 2; x <= 9; x++) {
      if (hash2(Math.floor(x / 3), Math.floor(y / 3), 41 + v) > 0.6 && hash2(x, y, 3) > 0.3) c.px(x, y, MOSS, TOP, { bias: 1 });
    }
  }
  // Ivy running along one side, leaves spilling over the edge.
  c.part();
  const side = v === 1 ? 9 : 2;
  const out = v === 1 ? 1 : -1;
  for (let y = top; y <= B - 2; y++) {
    if (hash2(y, v, 13) < (v === 2 ? 0.8 : 0.45)) {
      c.px(side, y, IVY, sphere(out * 0.3, 0.3));
      if (R() < 0.5) c.px(side + out, y, IVY, sphere(out * 0.7, 0.3));
      if (R() < 0.12) c.px(side + out, y - 1, IVY_FLOWER, sphere(-0.3, 0.4));
      if (v === 2 && R() < 0.5) c.px(side - out, y, IVY, sphere(0, 0.5), { bias: 1 });
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// Columns.

export const PILLAR_W = 20;
export const PILLAR_H = 54;
export const PILLAR_BASE = 52;

/** A column on its plinth: 0 whole with its capital, 1 snapped halfway, 2 a stump drowned in ivy. */
export function pillar(v: number): PixelCanvas {
  const c = new PixelCanvas(PILLAR_W, PILLAR_H);
  const R = rng(700 + v * 31);
  const cx = 10;
  const B = PILLAR_BASE;
  // Plinth: a square block.
  c.part();
  for (let x = 3; x <= 16; x++) {
    for (let y = B - 4; y <= B; y++) c.px(x, y, RUIN, x === 3 ? tilt(-0.4, -0.1, 0.9) : x === 16 ? tilt(0.4, -0.1, 0.9) : FRONT, { bias: y === B - 4 ? 1 : 0 });
    for (let y = B - 9; y < B - 4; y++) c.px(x, y, RUIN, TOP, { bias: 1 });
  }
  // Shaft: fluted.
  const shaftTop = v === 0 ? 12 : v === 1 ? 24 : 36;
  c.part();
  for (let x = 5; x <= 14; x++) {
    const t = ((x + 0.5 - cx) / 5) * 0.98;
    const flute = Math.abs(((x - 5) % 3) - 1) === 1 && x > 5 && x < 14 && (x - 5) % 3 === 0;
    const broken = v === 0 ? 0 : Math.floor(hash2(x, v, 17) * 5);
    for (let y = shaftTop + broken; y <= B - 7; y++) {
      const edge = y === shaftTop + broken && v !== 0;
      c.px(x, y, RUIN, edge ? TOP : cyl(t, 0.1), { bias: (flute ? -1 : 0) + (edge ? 2 : 0) });
    }
  }
  if (v === 0) {
    // Capital: a rounded echinus under a square abacus.
    c.part();
    c.shape(9, 12, (y) => {
      const hw = 5.5 + (12 - y) * 0.5;
      return [cx - hw, cx + hw];
    }, RUIN, (_x, _y, t, u) => cyl(t, 0.5 - u * 0.4));
    c.part();
    for (let x = 2; x <= 17; x++) {
      for (let y = 6; y <= 8; y++) c.px(x, y, RUIN, FRONT, { bias: y === 6 ? 1 : 0 });
      for (let y = 2; y <= 5; y++) c.px(x, y, RUIN, TOP, { bias: 1 });
    }
  }
  // Moss on the plinth and broken top; ivy winding up the shaft.
  c.part();
  for (let x = 3; x <= 16; x++) if (hash2(x, v, 23) > 0.55) c.px(x, B - 9 + Math.floor(hash2(x, 1, 29) * 3), MOSS, TOP, { bias: 1 });
  c.part();
  const turns = v === 2 ? 3 : 1.6;
  for (let y = shaftTop + 2; y <= B - 6; y++) {
    const a = (y / (B - shaftTop)) * Math.PI * 2 * turns + v;
    const front = Math.cos(a);
    if (front < -0.2) continue;
    const x = cx + Math.sin(a) * 5.2;
    c.px(x, y, IVY, sphere(Math.sin(a) * 0.6, 0.2));
    if (R() < 0.6) c.px(x + (R() < 0.5 ? -1 : 1), y, IVY, sphere(Math.sin(a) * 0.8, 0.3), { bias: 1 });
    if (R() < (v === 2 ? 0.3 : 0.1)) c.px(x, y - 1, IVY_FLOWER, sphere(-0.2, 0.4));
  }
  if (v === 2) {
    // A mound of ivy over the stump.
    c.part();
    for (let k = 0; k < 9; k++) {
      const x = cx - 6 + R() * 12;
      const y = shaftTop - 1 + R() * 6;
      c.ellipse(x, y, 2.4, 1.8, IVY, { bias: R() < 0.4 ? 1 : 0 });
    }
    for (let k = 0; k < 6; k++) c.px(cx - 6 + R() * 12, shaftTop - 2 + R() * 6, IVY_FLOWER, sphere(-0.3, 0.4));
  }
  return c;
}

// ---------------------------------------------------------------------------
// The fountain in the pool: two basins, a stone bud with a glowing heart, and
// water spilling over (three frames, drawn as light).

export const FOUNTAIN_W = 56;
export const FOUNTAIN_H = 52;
export const FOUNTAIN_BASE = 50;
export const FOUNTAIN_FRAMES = 3;

export function fountain(f: number): PixelCanvas {
  const c = new PixelCanvas(FOUNTAIN_W, FOUNTAIN_H);
  const cx = 28;
  // A round basin: its front wall, rim and water. `top` is the rim's centre row, `h` the wall's height.
  const basin = (cy: number, rx: number, ry: number, h: number, rim: number) => {
    c.part();
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      if (Math.abs(dx) > 1) continue;
      const lower = cy + ry * Math.sqrt(1 - dx * dx);
      for (let y = Math.floor(lower); y <= lower + h; y++) c.px(x, y, RUIN, cyl(dx, 0.05), { bias: y > lower + h - 1 ? -1 : 0 });
    }
    c.part();
    c.ellipse(cx, cy, rx, ry, RUIN, { normal: () => TOP, bias: 1 });
    c.part();
    c.ellipse(cx, cy + 0.4, rx - rim, ry - rim * 0.75, WATER, {
      normal: (x) => tilt(Math.sin(x * 1.3 + f * 2) * 0.15, 0.4, 0.9),
      bias: 0,
    });
  };
  basin(40, 25, 8.5, 5, 3.2);
  // Pedestal.
  c.part();
  c.shape(22, 41, (y) => {
    const hw = y > 37 ? 4.5 : y < 25 ? 3.6 : 2.8;
    return [cx - hw, cx + hw];
  }, RUIN, (_x, _y, t) => cyl(t, 0.1));
  basin(22, 12.5, 4.2, 3, 2.2);
  // The stone bud on top, cupping a glowing heart.
  c.part();
  c.shape(9, 20, (y) => {
    const u = (y - 9) / 11;
    const hw = Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.7 * 4.6 + (u > 0.85 ? 1 : 0);
    return [cx - hw, cx + hw];
  }, RUIN, (_x, _y, t, u) => cyl(t, 0.35 - u * 0.5));
  for (let y = 11; y <= 19; y += 1) {
    c.shade(cx - 2, y, -1);
    c.shade(cx + 2, y, -1);
  }
  c.part();
  c.ellipse(cx, 8.5, 2.2, 2, LUMEN, { glow: 0.95 });
  c.spark(cx - 1, 7, [255, 255, 255], 0.9);
  // Water spilling from the upper bowl into the lower, in beads that move down the arc each frame.
  const falls: [number, number, number][] = [
    [-11, 36, -1],
    [11, 36, 1],
    [-6, 40, -1],
    [6, 40, 1],
  ];
  for (const [ox, land, dir] of falls) {
    for (let k = 0; k < 14; k++) {
      const s = (k + f * 0.33 * 3) % 14;
      const t = s / 13;
      const x = cx + ox + dir * t * 5 * (Math.abs(ox) > 8 ? 1.6 : 1);
      const y = 24 + t * (land - 24) + t * t * 2;
      const bright = (k + f) % 3 === 0 ? 1 : 0.55;
      c.spark(x, y, [170, 236, 255], bright);
    }
    // Splashes where it lands.
    c.spark(cx + ox + dir * 8 + ((f % 2) * 2 - 1), land + 1, [220, 250, 255], 0.8);
  }
  // Light rippling on the lower basin.
  for (let k = 0; k < 5; k++) {
    const a = k * 1.3 + f * 0.7;
    c.spark(cx + Math.cos(a) * 15, 41 + Math.sin(a) * 3.5, [150, 230, 240], 0.5);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Thornbloom: a giant closed bud on a knot of thorny stems, grown into a
// doorway. Its frames: 'bloom' standing, 'stump' cut down.

export const THORNBLOOM_W = 52;
export const THORNBLOOM_H = 66;
export const THORNBLOOM_BASE = 63;

/** Points along a quadratic curve from a to b bending through c. */
function curve(ax: number, ay: number, cx: number, cy: number, bx: number, by: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by]);
  }
  return out;
}

/** A thick stem along a curve, with thorns jutting out now and then. */
function thornyStem(c: PixelCanvas, pts: [number, number][], r0: number, r1: number, m: Material, R: () => number, thorns: boolean): void {
  c.part();
  for (let i = 1; i < pts.length; i++) {
    const t = i / (pts.length - 1);
    c.capsule(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], r0 + (r1 - r0) * (t - 0.1), r0 + (r1 - r0) * t, m);
  }
  if (!thorns) return;
  c.part();
  for (let i = 2; i < pts.length - 1; i += 2) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    const dx = nx - x;
    const dy = ny - y;
    const l = Math.hypot(dx, dy) || 1;
    const side = R() < 0.5 ? -1 : 1;
    const r = r0 + (r1 - r0) * (i / pts.length) + 0.6;
    c.px(x - (dy / l) * r * side, y + (dx / l) * r * side, THORN, sphere(-0.3, 0.4));
    c.px(x - (dy / l) * (r + 1) * side, y + (dx / l) * (r + 1) * side - 1, THORN, sphere(-0.3, 0.4), { bias: 1 });
  }
}

export function thornbloom(stump: boolean): PixelCanvas {
  const c = new PixelCanvas(THORNBLOOM_W, THORNBLOOM_H);
  const R = rng(stump ? 911 : 907);
  const cx = 26;
  const B = THORNBLOOM_BASE;

  // Broad leaves round the foot.
  const leafMat = stump ? WILT : STEM;
  const leaves: [number, number, number, number, number][] = [
    [cx - 3, B - 2, Math.PI * 1.08, 15, 4.4],
    [cx + 3, B - 2, -Math.PI * 0.08, 15, 4.4],
    [cx - 2, B - 4, Math.PI * 1.25, 12, 3.6],
    [cx + 2, B - 4, -Math.PI * 0.25, 12, 3.6],
    [cx - 1, B - 1, Math.PI * 0.86, 10, 3.2],
    [cx + 1, B - 1, Math.PI * 0.14, 10, 3.2],
  ];
  for (const [x, y, a, len, w] of leaves) {
    c.part();
    // A cut plant's leaves droop to the ground.
    leaf(c, x, y, stump ? a + (Math.cos(a) < 0 ? -0.35 : 0.35) : a, len * (stump ? 0.85 : 1), w, leafMat, stump ? -1 : 0);
  }

  if (stump) {
    // Cut stems, their pale hearts showing, and fallen petals.
    for (const [x, h] of [
      [cx - 5, 9],
      [cx, 12],
      [cx + 5, 8],
      [cx - 1, 6],
    ]) {
      thornyStem(c, curve(x, B - 1, x, B - h / 2, x + (x - cx) * 0.2, B - h, 4), 2.2, 2, STEM, R, true);
      c.part();
      c.ellipse(x + (x - cx) * 0.2, B - h, 1.8, 0.9, WILT, { normal: () => TOP, bias: 3 });
    }
    for (let k = 0; k < 7; k++) {
      c.part();
      const x = cx - 18 + R() * 36;
      const y = B - 3 + R() * 3;
      c.ellipse(x, y, 2.2 + R(), 1.1, CRIMSON, { flatten: 0.4, bias: -1 });
    }
    return c;
  }

  // A knot of thorny stems rising to the bud.
  const stems: [number, number, number, number][] = [
    [cx - 7, B - 1, cx - 9, B - 18],
    [cx + 7, B - 1, cx + 9, B - 18],
    [cx, B, cx - 2, B - 14],
    [cx - 3, B, cx + 4, B - 16],
  ];
  for (const [x0, y0, x1, y1] of stems) thornyStem(c, curve(x0, y0, (x0 + x1) / 2 + (x0 < cx ? -3 : 3), (y0 + y1) / 2, cx + (x1 - cx) * 0.4, 44, 8), 2.6, 1.8, STEM, R, true);

  // The bud: petals overlapping, back ones first, each a teardrop pointed at the top.
  const bud = (x: number, top: number, bottom: number, w: number, bias: number, lean: number) => {
    c.part();
    c.shape(top, bottom, (y) => {
      const u = (y - top) / (bottom - top);
      const hw = Math.sin(Math.min(1, u * 1.08) * Math.PI * 0.62 + 0.1) ** 0.9 * w * (u > 0.8 ? 1 - (u - 0.8) * 1.6 : 1);
      const off = lean * (1 - u) * 3;
      return [x + off - hw, x + off + hw];
    }, CRIMSON, (_x, _y, t, u) => cyl(t, 0.45 - u * 0.7), { bias });
  };
  bud(cx - 8, 14, 45, 6.4, -1, -0.8);
  bud(cx + 8, 14, 45, 6.4, -2, 0.8);
  bud(cx - 4, 9, 47, 7.4, 0, -0.4);
  bud(cx + 4, 10, 47, 7.4, -1, 0.4);
  bud(cx, 6, 48, 7.6, 1, 0);
  // Golden veins running up the front petals, glowing faintly.
  c.part();
  for (const [x, top, lean] of [
    [cx, 10, 0],
    [cx - 5, 14, -0.4],
    [cx + 5, 15, 0.4],
  ]) {
    for (let y = top; y <= 44; y++) {
      const u = (y - top) / (44 - top);
      if (hash2(x, y, 3) < 0.15) continue;
      c.px(x + lean * (1 - u) * 3, y, VEIN, FRONT);
    }
  }
  // Sepals clasping the bud's base.
  for (const [x, a] of [
    [cx - 8, -Math.PI * 0.62],
    [cx + 8, -Math.PI * 0.38],
    [cx - 1, -Math.PI * 0.52],
  ]) {
    c.part();
    leaf(c, x, 49, a, 13, 3.4, STEM, 1);
  }
  // Thorns bristling from the sepals.
  c.part();
  for (let k = 0; k < 6; k++) c.px(cx - 12 + R() * 24, 44 + R() * 6, THORN, sphere(-0.3, 0.4), { bias: 1 });
  return c;
}

// ---------------------------------------------------------------------------
// Blooms: waist-high flowers that glow, one colour per buff. Frames per kind:
// 'open', 'bud' (growing back) and 'cut'.

export type BloomKind = 'might' | 'swift' | 'ward' | 'renew';
export const BLOOM_KINDS: BloomKind[] = ['might', 'swift', 'ward', 'renew'];

export const BLOOM_W = 40;
export const BLOOM_H = 46;
export const BLOOM_BASE = 44;

/** Petal ramp (darkest first) and glowing heart per kind. */
const BLOOM_COLOURS: Record<BloomKind, { petal: string[]; heart: string[] }> = {
  might: { petal: ['#3e1a06', '#6a2e0a', '#a24c10', '#d8781c', '#f2a530', '#ffd05c', '#fff0aa'], heart: ['#c85a10', '#ff9a2a', '#ffd86a', '#fff6c8', '#ffffff'] },
  swift: { petal: ['#081e3a', '#0e3862', '#155a94', '#2088c4', '#40b8e8', '#86deff', '#d8f8ff'], heart: ['#1a78b0', '#36c2f2', '#9cecff', '#eaffff', '#ffffff'] },
  ward: { petal: ['#1a0e3a', '#2c1862', '#442890', '#6242c0', '#8a6ae6', '#b69cff', '#e4d8ff'], heart: ['#5a36c8', '#8a6aff', '#c4b0ff', '#f0eaff', '#ffffff'] },
  renew: { petal: ['#3a081e', '#620e34', '#962050', '#d23c78', '#f06a9c', '#ff9ec0', '#ffe0ec'], heart: ['#c02a60', '#ff6a9a', '#ffb0cc', '#fff0f4', '#ffffff'] },
};

function bloomMaterials(kind: BloomKind): { petal: Material; heart: Material } {
  const col = BLOOM_COLOURS[kind];
  const p = ramp(...col.petal);
  return {
    petal: { ramp: p, outline: [Math.round(p[0][0] * 0.5), Math.round(p[0][1] * 0.5), Math.round(p[0][2] * 0.5)], outlineLit: p[1], shine: true, emissive: 0.12 },
    heart: { ramp: ramp(...col.heart), outline: p[0], emissive: 0.9, noAO: true },
  };
}

export function bloom(kind: BloomKind, stage: 'open' | 'bud' | 'cut'): PixelCanvas {
  const c = new PixelCanvas(BLOOM_W, BLOOM_H);
  const R = rng(1300 + BLOOM_KINDS.indexOf(kind) * 7 + (stage === 'open' ? 0 : stage === 'bud' ? 1 : 2));
  const { petal, heart } = bloomMaterials(kind);
  const cx = 20;
  const B = BLOOM_BASE;
  const headY = stage === 'open' ? 16 : stage === 'bud' ? 25 : 38;

  // Leaves, then the stem, gently curved.
  c.part();
  leaf(c, cx, B - 6, Math.PI * 1.12, 11, 3.2, STEM);
  c.part();
  leaf(c, cx + 1, B - 11, -Math.PI * 0.14, 10, 2.9, STEM, 1);
  if (stage !== 'bud') {
    c.part();
    leaf(c, cx, B - 1, Math.PI * 0.9, 8, 2.6, STEM, -1);
  }
  c.part();
  const stem = curve(cx, B, cx - 3, (B + headY) / 2, cx, headY + 2, 8);
  for (let i = 1; i < stem.length; i++) c.capsule(stem[i - 1][0], stem[i - 1][1], stem[i][0], stem[i][1], 1.5, 1.3, STEM);

  if (stage === 'cut') {
    c.part();
    c.ellipse(cx, headY + 1.5, 1.6, 0.8, WILT, { normal: () => TOP, bias: 3 });
    // A few of its petals on the ground.
    for (let k = 0; k < 4; k++) {
      c.part();
      c.ellipse(cx - 10 + R() * 20, B - 1 + R() * 2, 1.8, 0.9, petal, { flatten: 0.4, bias: -1 });
    }
    return c;
  }

  if (stage === 'bud') {
    for (const [x, w, b] of [
      [cx - 2, 3.2, -1],
      [cx + 2, 3.2, -1],
      [cx, 3.6, 1],
    ] as const) {
      c.part();
      c.shape(headY - 9, headY + 1, (y) => {
        const u = (y - headY + 9) / 10;
        const hw = Math.sin(Math.min(1, u * 1.1) * Math.PI * 0.62 + 0.15) * w;
        return [x - hw, x + hw];
      }, petal, (_x, _y, t, u) => cyl(t, 0.4 - u * 0.7), { bias: b });
    }
    c.part();
    leaf(c, cx - 2, headY + 2, -Math.PI * 0.6, 6, 1.8, STEM, 1);
    leaf(c, cx + 2, headY + 2, -Math.PI * 0.4, 6, 1.8, STEM, 1);
    return c;
  }

  // Open: six petals round a glowing heart, the flower tipped toward the viewer.
  const SQUASH = 0.62;
  const petals = (back: boolean) => {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.26;
      const isBack = Math.sin(a) < 0;
      if (isBack !== back) continue;
      c.part();
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const len = 9.5;
      const wid = 4.4;
      for (let py = headY - 12; py <= headY + 12; py++) {
        for (let px = cx - 14; px <= cx + 14; px++) {
          // Into the flower's own plane, then along and across the petal.
          const fx = px + 0.5 - cx;
          const fy = (py + 0.5 - headY) / SQUASH;
          const u = fx * ca + fy * sa;
          const v = -fx * sa + fy * ca;
          if (u < 0.5 || u > len) continue;
          const t = u / len;
          const half = wid * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.72) * (t > 0.85 ? 1 - (t - 0.85) * 2.2 : 1);
          if (Math.abs(v) > half) continue;
          // Cupped: the tips curl up and out.
          const n = tilt(ca * t * 0.55 - sa * (v / wid) * 0.35, 0.55 - sa * t * 0.45 + ca * (v / wid) * 0.2, 0.82);
          c.px(px, py, petal, n, { bias: (back ? -1 : 0) + (Math.abs(v) < 0.7 && t > 0.2 && t < 0.8 ? -1 : 0) + (t > 0.7 ? 1 : 0) });
        }
      }
    }
  };
  petals(true);
  petals(false);
  c.part();
  c.ellipse(cx, headY, 3.4, 2.4, heart, { flatten: 0.8 });
  c.part();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    c.spark(cx + Math.cos(a) * 3.5, headY + Math.sin(a) * 2.2 - 1, hex(BLOOM_COLOURS[kind].heart[3]), 0.8);
  }
  c.spark(cx - 1, headY - 1, [255, 255, 255], 1);
  return c;
}

// ---------------------------------------------------------------------------
// The seed a bloom lets go: a glowing drop that holds the buff.

export const SEED_W = 10;
export const SEED_H = 12;

export function bloomSeed(kind: BloomKind): PixelCanvas {
  const c = new PixelCanvas(SEED_W, SEED_H);
  const { petal, heart } = bloomMaterials(kind);
  c.part();
  c.shape(2, 10, (y) => {
    const u = (y - 2) / 8;
    const hw = Math.sin(Math.min(1, u * 1.05) * Math.PI * 0.66 + 0.12) * 3.3;
    return [5 - hw, 5 + hw];
  }, { ...heart, emissive: 0.75 }, (_x, _y, t, u) => sphere(t * 0.8, 0.5 - u));
  c.part();
  c.px(4, 4, heart, sphere(-0.6, 0.6), { bias: 2 });
  c.px(5, 1, STEM, sphere(0, 0.5));
  c.px(6, 1, { ...petal, emissive: 0 }, sphere(0.5, 0.5));
  return c;
}

// ---------------------------------------------------------------------------
// HUD icons for the buffs the blooms give (16x16, like the item icons).

function painter(w: number, h: number) {
  const px = new Uint8ClampedArray(w * h * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * w + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && px[(y * w + x) * 4 + 3] === 255;
  const outline = (c: string) => {
    const out: [number, number][] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!filled(x, y) && (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1))) out.push([x, y]);
      }
    }
    for (const [x, y] of out) put(x, y, c);
  };
  return { px, put, outline };
}

/** Might: a golden sword, point up, with sparks either side. */
function mightIcon(): Uint8ClampedArray {
  const { px, put, outline } = painter(16, 16);
  const pal: Record<string, string> = { h: '#ffffff', m: '#c8d4e4', d: '#7a88a0', G: '#ffd45c', g: '#e89a2a', o: '#9a5a18', b: '#5a3218', B: '#7e4a24' };
  const rows = [
    '................',
    '.......h........',
    '.......hm.......',
    '.......hm.......',
    '.......hm.......',
    '.......hm.......',
    '.......hm.......',
    '.......hd.......',
    '.......hd.......',
    '....oGGGGGGo....',
    '.....ogGGgo.....',
    '.......bB.......',
    '.......bB.......',
    '......oGGo......',
    '.......oo.......',
    '................',
  ];
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && put(x, y, pal[ch])));
  outline('#140c10');
  for (const [x, y, c] of [
    [3, 3, '#fff0a0'],
    [2, 4, '#ffd45c'],
    [3, 5, '#ffd45c'],
    [12, 3, '#fff0a0'],
    [13, 4, '#ffd45c'],
    [12, 5, '#ffd45c'],
  ] as const) put(x, y, c);
  return px;
}

/** Ward: a violet shield with a pale rune. */
function wardIcon(): Uint8ClampedArray {
  const { px, put, outline } = painter(16, 16);
  for (let y = 2; y <= 14; y++) {
    const hw = y < 9 ? 5.6 : 5.6 * Math.pow(1 - (y - 8) / 6.6, 0.75);
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 8;
      if (Math.abs(dx) > hw) continue;
      const rim = Math.abs(dx) > hw - 1.1 || y === 2;
      const k = dx + (y - 7) * 0.4;
      put(x, y, rim ? (k < 0 ? '#c4b0ff' : '#5a36c8') : k < -2.5 ? '#b69cff' : k < 1 ? '#8a6ae6' : '#6242c0');
    }
  }
  for (let y = 5; y <= 11; y++) put(8, y, y < 7 ? '#ffffff' : '#f0eaff');
  for (let x = 6; x <= 10; x++) put(x, 7, x < 8 ? '#ffffff' : '#f0eaff');
  put(5, 4, '#ffffff');
  outline('#120a24');
  return px;
}

/** Renew: a rose heart with a green sprig. */
function renewIcon(): Uint8ClampedArray {
  const { px, put, outline } = painter(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const hx = (x + 0.5 - 8) / 5.6;
      const hy = -(y + 0.5 - 8.6) / 5.6;
      const q = hx * hx + hy * hy - 1;
      if (q * q * q - hx * hx * hy * hy * hy >= 0) continue;
      const k = hx + hy * -0.8;
      put(x, y, k < -0.9 ? '#ffb0cc' : k < -0.2 ? '#ff6a9a' : k < 0.6 ? '#d23c78' : '#962050');
    }
  }
  put(5, 6, '#ffffff');
  put(4, 7, '#fff0f4');
  put(6, 6, '#fff0f4');
  outline('#2a0614');
  // A sprig of leaves at the top, outside the outline.
  put(10, 2, '#5c9e5a');
  put(11, 1, '#80ba6e');
  put(12, 1, '#5c9e5a');
  put(9, 3, '#2d6a3c');
  return px;
}

export function buffIcon(kind: 'might' | 'ward' | 'renew'): Uint8ClampedArray {
  return kind === 'might' ? mightIcon() : kind === 'ward' ? wardIcon() : renewIcon();
}
