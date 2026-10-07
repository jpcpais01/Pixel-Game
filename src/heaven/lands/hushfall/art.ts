// Hushfall's props, drawn with the shared pixel engine (art/pixel.ts):
// snow-laden firs in tiers, snow-capped boulders, winterberry bushes, dry
// grass poking through, snowmen, stone lanterns (a tall one, and the wide
// snow-viewing kind sunk to its roof), a faded vermilion gate half buried in
// drifts, a little stone figure in a red bib, a log cabin with its window
// lit, its woodpile, a snow hare and a fox; and for the life layer the
// wanderer's footprints, snowflakes and puffs of steam. Lit from the warm
// top-left like everything else. Pure: the node script paints them too.

import { FLAT, PixelCanvas, cyl, sphere, type Material, type Vec3 } from '../../../art/pixel';
import { hash2, rng } from '../../../art/env';
import type { SheetDef } from '../types';
import { CABIN_CHIMNEY, CABIN_WINDOW, GATE_POST } from './gen';
import {
  BARK, BERRY, BIB, BUCKET, CARROT, CHIMNEY, COAL, EYE, FLAKE, FLAME, FUR_DARK, FUR_FOX, FUR_WHITE, GATE_BLACK, HARE, HARE_TIP, LANTERN_STONE, LOG, LOG_END, MOSSY_STONE, NEEDLES, NEEDLES_BLUE, PAPER, PLANK, PRINT, ROCK, SCARF_GOLD, SCARF_RED, SCARF_TEAL, SNOW, SNOWBALL, SNOW_SOFT, STALK, STEAM, TWIG, VERMILION, WINDOW,
} from './palette';

/** Normals: facing up to the sky, and a little toward the viewer. */
const UP: Vec3 = { x: 0, y: 0.6, z: 0.8 };
const SKY: Vec3 = { x: 0, y: 0.85, z: 0.53 };

/**
 * Lay snow over whatever is already drawn in `mats`: down from each column's
 * top-most such pixel, `thick(x)` rows deep, lumpy at its lower edge, lit
 * from above. The cap is its own part, so the engine shades the seam under it.
 */
function capSnow(c: PixelCanvas, mats: Material[], thick: (x: number) => number, x0 = 0, x1 = c.w - 1, soft = false): void {
  c.part();
  const tops: number[] = [];
  for (let x = x0; x <= x1; x++) {
    let top = -1;
    for (let y = 0; y < c.h; y++) {
      const m = c.materialAt(x, y);
      if (m && mats.includes(m)) {
        top = y;
        break;
      }
    }
    tops.push(top);
  }
  for (let x = x0; x <= x1; x++) {
    const top = tops[x - x0];
    if (top < 0) continue;
    const t = thick(x);
    if (t <= 0) continue;
    // Columns at the cap's ends round off.
    const l = tops[x - x0 - 1] ?? -1;
    const r = tops[x - x0 + 1] ?? -1;
    const end = l < 0 || r < 0;
    const n = Math.max(1, Math.round(end ? t * 0.6 : t));
    for (let k = -1; k < n; k++) {
      const y = top + k;
      if (k === -1 && (end || hash2(x, top, 7) < 0.55)) continue;
      const m = c.materialAt(x, y);
      if (k >= 0 && !(m && mats.includes(m))) break;
      const u = k / Math.max(1, n);
      const side = l < 0 ? -0.6 : r < 0 ? 0.6 : 0;
      c.px(x, y, soft ? SNOW_SOFT : SNOW, sphere(side, 0.75 - u * 0.9, 0.7), { bias: k === n - 1 ? -1 : k <= 0 ? 1 : 0 });
    }
  }
}

/** A mound of snow at something's foot, drawn in front of it. */
function mound(c: PixelCanvas, x: number, y: number, rx: number, ry: number, m: Material = SNOW_SOFT): void {
  c.part();
  for (let py = Math.floor(y - ry); py <= y + 1; py++) {
    for (let px = Math.floor(x - rx); px <= Math.ceil(x + rx); px++) {
      const dx = (px + 0.5 - x) / rx;
      const dy = (py + 0.5 - y) / ry;
      if (dx * dx + dy * dy > 1 || py > y) continue;
      c.px(px, py, m, sphere(dx * 0.8, -dy * 0.6 + 0.3, 0.8), { bias: dy > -0.2 ? -1 : 0 });
    }
  }
}

// ---------------------------------------------------------------- firs

export const FIR_W = 60;
export const FIR_H = 100;
export const FIR_FOOT_Y = 96;
/** The firs by size: height (px), half width at the foot, tiers, needles, seed. */
const FIRS = [
  { h: 28, w: 10, tiers: 3, blue: false, seed: 5 },
  { h: 42, w: 14, tiers: 4, blue: true, seed: 13 },
  { h: 58, w: 18, tiers: 5, blue: false, seed: 29 },
  { h: 74, w: 22, tiers: 6, blue: true, seed: 41 },
  { h: 90, w: 27, tiers: 7, blue: false, seed: 57 },
];

function firFrame(v: number): PixelCanvas {
  const F = FIRS[v];
  const c = new PixelCanvas(FIR_W, FIR_H);
  const R = rng(3100 + F.seed);
  const cx = FIR_W / 2;
  const foot = FIR_FOOT_Y;
  const needles = F.blue ? NEEDLES_BLUE : NEEDLES;
  // The trunk, seen under the lowest boughs.
  const trunkTop = foot - Math.round(F.h * 0.14) - 3;
  for (let y = trunkTop; y <= foot; y++) {
    const hw = 1.6 + F.w * 0.04;
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) c.px(x, y, BARK, cyl((x + 0.5 - cx) / hw, 0.1));
  }
  // Tiers from the bottom up: each later (higher) one overlaps the one below, as seen from above.
  const top = foot - F.h;
  const span = F.h * 0.86;
  for (let k = 0; k < F.tiers; k++) {
    const t0 = k / F.tiers;
    const yb = Math.round(foot - Math.round(F.h * 0.14) - t0 * span * 0.92);
    const wk = F.w * (1 - t0 * 0.82) + (R() - 0.5) * 1.5;
    const yt = Math.round(k === F.tiers - 1 ? top : yb - Math.max(7, wk * 1.15));
    const lean = (R() - 0.5) * 1.2;
    const jag: number[] = [];
    for (let x = 0; x < FIR_W; x++) jag.push(R());
    const edge = (u: number, x: number) => yb + (1 - u * u) * 2.2 + (Math.abs(u) > 0.75 ? 1.2 : 0) + (jag[x] < 0.35 ? -1 : 0);
    c.part();
    for (let y = yt; y <= yb + 3; y++) {
      const fy = (y - yt) / Math.max(1, yb - yt);
      const hw = wk * Math.min(1, Math.pow(Math.max(0, fy), 0.85)) + 0.6;
      for (let x = Math.floor(cx + lean * fy - hw); x <= Math.ceil(cx + lean * fy + hw); x++) {
        const u = (x + 0.5 - cx - lean * fy) / hw;
        if (Math.abs(u) > 1 || y > edge(u, x)) continue;
        // Boughs: darker in the creases toward their hanging edge, a needle-y sparkle on the lit side.
        const crease = y > edge(u, x) - 2 ? -1 : 0;
        const fleck = hash2(x, y, F.seed) > 0.8 ? 1 : hash2(x, y, F.seed + 1) > 0.85 ? -1 : 0;
        c.px(x, y, needles, sphere(u * 0.85, 0.35 - fy * 0.5, 0.8), { bias: crease + fleck });
      }
    }
    // Snow heaped on the boughs: everything of the tier that shows is white but a fringe of green at its hanging edge, wider toward the tips.
    c.part();
    const lumps: number[] = [];
    for (let x = 0; x < FIR_W; x++) lumps.push(Math.sin(x * 1.1 + k * 2.3) * 0.9 + (R() - 0.5) * 1.6);
    for (let y = yt; y <= yb + 3; y++) {
      const fy = (y - yt) / Math.max(1, yb - yt);
      const hw = wk * Math.min(1, Math.pow(Math.max(0, fy), 0.85)) + 0.6;
      for (let x = Math.floor(cx + lean * fy - hw); x <= Math.ceil(cx + lean * fy + hw); x++) {
        const u = (x + 0.5 - cx - lean * fy) / hw;
        if (Math.abs(u) > 0.9 || c.materialAt(x, y) !== needles) continue;
        const reach = edge(u, x) - (1.8 + Math.abs(u) * 2.6 + lumps[x]);
        if (y > reach) continue;
        const under = y > reach - 1;
        c.px(x, y, SNOW, sphere(u * 0.8, 0.75 - fy * 0.55, 0.75), { bias: under ? -1 : y - yt < 1 ? 1 : 0 });
      }
    }
  }
  // A snow mound round the foot, the trunk sunk in it.
  mound(c, cx, foot + 0.5, 3 + F.w * 0.2, 2.5);
  return c;
}

// ---------------------------------------------------------------- boulders

export const ROCK_W = 36;
export const ROCK_H = 26;
export const ROCK_FOOT_Y = 22;

function rockFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(ROCK_W, ROCK_H);
  const cx = ROCK_W / 2;
  const b = ROCK_FOOT_Y;
  const rock = (x: number, y: number, rx: number, ry: number, m: Material = ROCK) => {
    c.part();
    c.ellipse(x, y, rx, ry, m, { flatten: 0.7 });
  };
  if (v === 0) {
    rock(cx, b - 3, 5, 3.6);
  } else if (v === 1) {
    rock(cx - 1, b - 5, 9, 6);
    rock(cx + 7, b - 2, 4, 2.8, MOSSY_STONE);
  } else {
    rock(cx + 2, b - 8, 11, 8.5);
    rock(cx - 8, b - 4, 6.5, 4.6);
    rock(cx + 11, b - 2, 3.4, 2.4, MOSSY_STONE);
  }
  capSnow(c, [ROCK, MOSSY_STONE], (x) => 2.5 + Math.sin(x * 0.7) * 0.8 + (v === 2 ? 1.5 : v === 1 ? 0.8 : 0));
  mound(c, cx, b + 0.5, [6, 11, 15][v], 2.2);
  return c;
}

// ---------------------------------------------------------------- winterberry

export const BUSH_W = 28;
export const BUSH_H = 26;
export const BUSH_FOOT_Y = 23;

function bushFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(BUSH_W, BUSH_H);
  const R = rng(4300 + v * 31);
  const cx = BUSH_W / 2;
  const b = BUSH_FOOT_Y;
  // Bare twigs fanning up from the snow, forking as they go.
  const tips: [number, number][] = [];
  const twig = (x: number, y: number, a: number, len: number, depth: number) => {
    const x1 = x + Math.cos(a) * len;
    const y1 = y + Math.sin(a) * len;
    c.line(x, y, x1, y1, TWIG, () => cyl(Math.cos(a) * 0.5), { bias: depth > 1 ? 1 : 0 });
    if (depth < 2) {
      twig(x1, y1, a - 0.35 - R() * 0.3, len * 0.62, depth + 1);
      twig(x1, y1, a + 0.35 + R() * 0.3, len * 0.62, depth + 1);
    } else tips.push([x1, y1]);
  };
  c.part();
  const n = 4 + v;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + ((k / (n - 1)) * 2 - 1) * 0.9 + (R() - 0.5) * 0.2;
    twig(cx + (k - n / 2) * 0.8, b, a, 6 + R() * 3, 0);
  }
  // Clusters of red berries along the twigs, each with a little hat of snow.
  c.part();
  for (const [x, y] of tips) {
    if (R() < 0.25) continue;
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [-1, 1]]) if (R() < 0.8) c.px(x + ox, y + oy, BERRY, sphere(ox * 0.5 - 0.3, -oy * 0.4 + 0.4, 0.8));
  }
  c.part();
  for (const [x, y] of tips) if (R() < 0.6) c.px(x, y - 1, SNOW_SOFT, UP, { bias: 1 });
  mound(c, cx, b + 0.5, 8 + v * 2, 3);
  return c;
}

// ---------------------------------------------------------------- dry grass

export const REED_W = 16;
export const REED_H = 18;
export const REED_FOOT_Y = 16;

function reedFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(REED_W, REED_H);
  const R = rng(4700 + v * 17);
  const cx = REED_W / 2;
  const n = 4 + v * 2;
  for (let k = 0; k < n; k++) {
    c.part();
    const u = (k / (n - 1)) * 2 - 1;
    const len = Math.round(5 + (1 - Math.abs(u)) * 6 + R() * 3);
    const lean = u * (2.5 + R() * 2) + 1;
    for (let s = 0; s < len; s++) {
      const t = s / len;
      c.px(cx + u * 1.5 + lean * t * t, REED_FOOT_Y - s, STALK, sphere(Math.sign(lean) * 0.5, -0.2, 0.8), { bias: Math.round(-u + t * 3) - 1 });
    }
    // A seed head on the tallest.
    if (len > 10 && v > 0) c.px(cx + u * 1.5 + lean, REED_FOOT_Y - len, STALK, UP, { bias: 3 });
  }
  mound(c, cx, REED_FOOT_Y + 0.5, 5, 2);
  return c;
}

// ---------------------------------------------------------------- snowmen

export const MAN_W = 26;
export const MAN_H = 38;
export const MAN_FOOT_Y = 35;

function snowmanFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(MAN_W, MAN_H);
  const cx = MAN_W / 2;
  const b = MAN_FOOT_Y;
  const ball = (y: number, r: number) => {
    c.part();
    c.ellipse(cx, y, r, r * 0.92, SNOWBALL, { flatten: 0.85 });
  };
  const two = v === 2;
  const r0 = two ? 7 : 7.5;
  const r1 = two ? 5.2 : 5.6;
  const r2 = 4;
  const y0 = b - r0 + 1;
  const y1 = y0 - r0 - r1 + 2.5;
  const y2 = two ? y1 : y1 - r1 - r2 + 2;
  // Stick arms, behind the body.
  c.part();
  const armY = two ? y0 - 2 : y1;
  c.line(cx - 4, armY, cx - 10, armY - 5, TWIG, () => FLAT);
  c.line(cx - 9, armY - 4, cx - 11, armY - 4, TWIG, () => FLAT);
  c.line(cx + 4, armY, cx + 10, armY - (v === 1 ? 7 : 3), TWIG, () => FLAT);
  c.line(cx + 9, armY - (v === 1 ? 6 : 3), cx + 10, armY - (v === 1 ? 4 : 1), TWIG, () => FLAT);
  ball(y0, r0);
  if (!two) ball(y1, r1);
  ball(y2 + (two ? 0 : 0), two ? r1 : r2);
  const hy = y2;
  const hr = two ? r1 : r2;
  // Coal buttons down the front.
  c.part();
  if (!two) for (let k = 0; k < 3; k++) c.px(cx, y1 - 2 + k * 2, COAL, FLAT);
  else for (let k = 0; k < 2; k++) c.px(cx, y0 - 3 + k * 3, COAL, FLAT);
  // The face: coal eyes, a carrot nose.
  c.px(cx - 2, hy - 1, COAL, FLAT, { bias: 2 });
  c.px(cx + 1, hy - 1, COAL, FLAT, { bias: 2 });
  c.part();
  c.px(cx, hy + 1, CARROT, FLAT, { bias: 2 });
  c.px(cx + 1, hy + 1, CARROT, FLAT, { bias: 1 });
  c.px(cx + 2, hy + 1, CARROT, FLAT, { bias: 0 });
  if (!two) for (let k = -1; k <= 1; k++) c.px(cx + k * 1.5 - 0.5, hy + 2.5 + (k === 0 ? 0.5 : 0), COAL, FLAT);
  // A scarf round the neck, its end hanging.
  c.part();
  const scarf = [SCARF_RED, SCARF_TEAL, SCARF_GOLD][v];
  const ny = hy + hr - 1;
  for (let x = Math.floor(cx - hr); x <= Math.ceil(cx + hr) - 1; x++) {
    const u = (x + 0.5 - cx) / hr;
    for (let y = ny; y <= ny + 1; y++) c.px(x, y, scarf, cyl(u, 0.2), { bias: (x + y) % 3 === 0 ? -1 : 0 });
  }
  for (let y = ny + 2; y <= ny + 5; y++) c.px(cx + 2 + (y > ny + 3 ? 1 : 0), y, scarf, cyl(0.4), { bias: y === ny + 5 ? -1 : 0 });
  c.px(cx + 1, ny + 2, scarf, FLAT, { bias: -1 });
  // A hat: an old pail, or a few twigs for hair.
  c.part();
  if (v === 0) {
    for (let y = hy - hr - 4; y <= hy - hr + 1; y++) {
      const hw = 2.6 + (y - (hy - hr - 4)) * 0.35;
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw) - 1; x++) c.px(x, y, BUCKET, cyl((x + 0.5 - cx) / hw, 0.3), { bias: y === hy - hr + 1 ? -1 : 0 });
    }
    capSnow(c, [BUCKET], () => 1.4);
  } else if (v === 1) {
    c.line(cx, hy - hr, cx - 2, hy - hr - 4, TWIG, () => FLAT);
    c.line(cx + 1, hy - hr, cx + 3, hy - hr - 3, TWIG, () => FLAT);
  } else {
    // A sprig of berries tucked behind its ear.
    c.px(cx - 3, hy - hr + 1, BERRY, UP);
    c.px(cx - 4, hy - hr + 2, BERRY, UP);
    c.px(cx - 2, hy - hr, NEEDLES, UP, { bias: 2 });
  }
  mound(c, cx, b + 0.5, r0 + 3, 2.4);
  return c;
}

// ---------------------------------------------------------------- lanterns

export const LANTERN_W = 30;
export const LANTERN_H = 44;
export const LANTERN_FOOT_Y = 41;

/** A slab of stone across, `y0..y1`, half width `hw`. */
function slab(c: PixelCanvas, cx: number, y0: number, y1: number, hw: number, m: Material = LANTERN_STONE): void {
  c.part();
  for (let y = y0; y <= y1; y++) for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) c.px(x, y, m, y === y0 ? UP : cyl((x + 0.5 - cx) / hw, 0.15), { bias: y === y1 ? -1 : 0 });
}

/** A lantern's firebox: stone frame, warm paper windows, a flame. */
function firebox(c: PixelCanvas, cx: number, y0: number, y1: number, hw: number): void {
  c.part();
  for (let y = y0; y <= y1; y++) for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) c.px(x, y, LANTERN_STONE, cyl((x + 0.5 - cx) / hw, 0.1));
  c.part();
  for (let y = y0 + 1; y <= y1 - 1; y++) {
    for (let x = Math.floor(cx - hw) + 1; x < Math.ceil(cx + hw) - 1; x++) {
      // A round window in the middle, a square one each side.
      const u = x + 0.5 - cx;
      if (Math.abs(u) < 1 && y < y0 + 2) continue;
      c.px(x, y, PAPER, FLAT, { bias: y <= y0 + 1 ? 1 : 0 });
    }
  }
  c.part();
  c.px(cx - 1, y1 - 2, FLAME, FLAT);
  c.px(cx - 1, y1 - 3, FLAME, FLAT, { bias: 1 });
  c.px(cx, y1 - 2, FLAME, FLAT);
}

/** A stone lantern's roof: wide, its corners turned up, a jewel on top. */
function roof(c: PixelCanvas, cx: number, y: number, hw: number, h: number): void {
  c.part();
  for (let k = 0; k < h; k++) {
    const yy = y - k;
    const w = hw - k * (hw / (h + 1.2)) - (k === 0 ? 0 : 0.5);
    for (let x = Math.floor(cx - w); x < Math.ceil(cx + w); x++) c.px(x, yy, LANTERN_STONE, k === 0 ? cyl((x + 0.5 - cx) / w, -0.3) : SKY, { bias: k === 0 ? -1 : 0 });
  }
  // The turned-up corners.
  c.px(cx - hw - 1, y - 1, LANTERN_STONE, SKY);
  c.px(cx + hw, y - 1, LANTERN_STONE, SKY);
  c.part();
  c.ellipse(cx, y - h - 1, 1.6, 1.8, LANTERN_STONE, { flatten: 0.8 });
  c.px(cx - 0.5, y - h - 3.5, LANTERN_STONE, UP);
}

function lanternFrame(kind: 'tall' | 'small' | 'post'): PixelCanvas {
  const c = new PixelCanvas(LANTERN_W, LANTERN_H);
  const cx = LANTERN_W / 2;
  const b = LANTERN_FOOT_Y;
  if (kind === 'tall') {
    // Base, post, the platform the firebox stands on, firebox, roof, jewel; half its base under the snow.
    slab(c, cx, b - 4, b, 6);
    c.part();
    for (let y = b - 16; y < b - 4; y++) for (let x = cx - 2; x < cx + 2; x++) c.px(x, y, LANTERN_STONE, cyl((x + 0.5 - cx) / 2, 0.1), { bias: (y - b) % 4 === 0 ? -1 : 0 });
    slab(c, cx, b - 19, b - 16, 5.5);
    firebox(c, cx, b - 27, b - 20, 4);
    roof(c, cx, b - 28, 8.5, 4);
    capSnow(c, [LANTERN_STONE], (x) => (Math.abs(x + 0.5 - cx) < 9 ? 2.4 + Math.sin(x * 1.3) * 0.6 : 1.5));
    mound(c, cx - 1, b + 0.5, 9, 3.4);
  } else if (kind === 'small') {
    // The snow-viewing lantern: short curved legs, the firebox, and a broad umbrella of a roof that holds a deep cap of snow.
    c.part();
    for (const side of [-1, 1]) {
      for (let s = 0; s <= 6; s++) {
        const x = cx + side * (2.5 + s * s * 0.12);
        c.px(x, b - 6 + s, LANTERN_STONE, cyl(side * 0.6), { bias: s > 4 ? -1 : 0 });
        c.px(x + side, b - 6 + s, LANTERN_STONE, cyl(side * 0.9), { bias: -1 });
      }
    }
    firebox(c, cx, b - 13, b - 7, 4);
    c.part();
    for (let k = 0; k < 3; k++) {
      const w = 11 - k * 3.5;
      for (let x = Math.floor(cx - w); x < Math.ceil(cx + w); x++) c.px(x, b - 14 - k, LANTERN_STONE, k === 0 ? cyl((x + 0.5 - cx) / w, -0.3) : SKY, { bias: k === 0 ? -1 : 0 });
    }
    c.px(cx - 12, b - 15, LANTERN_STONE, SKY);
    c.px(cx + 11, b - 15, LANTERN_STONE, SKY);
    c.part();
    c.ellipse(cx, b - 18, 1.5, 1.6, LANTERN_STONE, { flatten: 0.8 });
    capSnow(c, [LANTERN_STONE], (x) => {
      const u = Math.abs(x + 0.5 - cx);
      return u < 10 ? 3.2 - u * 0.12 + Math.sin(x * 1.1) * 0.5 : 1.4;
    }, 0, LANTERN_W - 1);
    mound(c, cx, b + 0.5, 8, 3.8);
  } else {
    // A cedar post with a little iron-roofed lamp, by the cabin's path.
    c.part();
    for (let y = b - 18; y <= b; y++) for (let x = cx - 1.5; x < cx + 1.5; x++) c.px(x, y, LOG, cyl((x + 0.5 - cx) / 1.5, 0.1));
    firebox(c, cx, b - 25, b - 19, 3);
    c.part();
    for (let x = cx - 5; x < cx + 5; x++) c.px(x, b - 26, BUCKET, UP);
    for (let x = cx - 3; x < cx + 3; x++) c.px(x, b - 27, BUCKET, UP, { bias: 1 });
    capSnow(c, [BUCKET], () => 1.6);
    mound(c, cx, b + 0.5, 5, 2.2);
  }
  return c;
}

// ---------------------------------------------------------------- the gate

export const GATE_W = 80;
export const GATE_H = 66;
export const GATE_FOOT_Y = 62;

function gateFrame(): PixelCanvas {
  const c = new PixelCanvas(GATE_W, GATE_H);
  const cx = GATE_W / 2;
  const b = GATE_FOOT_Y;
  const lintel = b - 47;
  // The two posts, leaning in a touch, black-footed (mostly buried now).
  c.part();
  for (const side of [-1, 1]) {
    const px0 = cx + side * GATE_POST;
    for (let y = lintel; y <= b; y++) {
      const t = (b - y) / (b - lintel);
      const x = px0 - side * t * 1.2;
      const hw = 2.4 - t * 0.3;
      for (let q = Math.floor(x - hw); q < Math.ceil(x + hw); q++) c.px(q, y, y > b - 5 ? GATE_BLACK : VERMILION, cyl((q + 0.5 - x) / hw, 0.1), { bias: hash2(q, y, 3) > 0.9 ? -1 : 0 });
    }
  }
  // The tie beam through both posts.
  c.part();
  for (let y = lintel + 9; y <= lintel + 11; y++) for (let x = cx - GATE_POST - 6; x < cx + GATE_POST + 6; x++) c.px(x, y, VERMILION, y === lintel + 9 ? UP : FLAT, { bias: y === lintel + 11 ? -1 : 0 });
  // The strut between beam and lintel, with its plaque.
  c.part();
  for (let y = lintel + 2; y < lintel + 9; y++) for (let x = cx - 2; x < cx + 2; x++) c.px(x, y, GATE_BLACK, cyl((x + 0.5 - cx) / 2, 0.1), { bias: 1 });
  // The lintel: a vermilion beam under a black cap, both sweeping up at the ends.
  c.part();
  const sweep = (x: number) => {
    const u = Math.abs(x + 0.5 - cx) / (GATE_POST + 11);
    return Math.pow(u, 3) * 4;
  };
  for (let x = cx - GATE_POST - 11; x < cx + GATE_POST + 11; x++) {
    const lift = sweep(x);
    for (let k = 0; k < 3; k++) c.px(x, Math.round(lintel + 1 + k - lift), VERMILION, k === 0 ? UP : FLAT, { bias: k === 2 ? -1 : 0 });
  }
  c.part();
  for (let x = cx - GATE_POST - 13; x < cx + GATE_POST + 13; x++) {
    const lift = sweep(x) * 1.1;
    for (let k = 0; k < 2; k++) c.px(x, Math.round(lintel - 1 + k - lift), GATE_BLACK, k === 0 ? SKY : FLAT, { bias: k === 0 ? 1 : 0 });
  }
  // Snow lying along the lintel and the tie beam.
  capSnow(c, [GATE_BLACK], (x) => 2 + Math.sin(x * 0.8) * 0.7 + (hash2(x, 1, 9) > 0.8 ? 1 : 0), cx - GATE_POST - 12, cx + GATE_POST + 12);
  capSnow(c, [VERMILION], (x) => (Math.abs(x + 0.5 - cx) > GATE_POST + 3 && Math.abs(x + 0.5 - cx) < GATE_POST + 6 ? 1.6 : Math.abs(x + 0.5 - cx) < GATE_POST - 3 && Math.abs(x + 0.5 - cx) > 3 ? 1.4 : 0), cx - GATE_POST - 6, cx + GATE_POST + 5);
  // Drifts heaped against the posts, deeper on the windward west.
  mound(c, cx - GATE_POST - 1, b + 0.5, 9, 7);
  mound(c, cx + GATE_POST + 1, b + 0.5, 7, 5);
  return c;
}

// ---------------------------------------------------------------- the little stone figure

export const JIZO_W = 18;
export const JIZO_H = 24;
export const JIZO_FOOT_Y = 21;

function jizoFrame(): PixelCanvas {
  const c = new PixelCanvas(JIZO_W, JIZO_H);
  const cx = JIZO_W / 2;
  const b = JIZO_FOOT_Y;
  c.part();
  c.shape(b - 9, b, (y) => {
    const t = (y - (b - 9)) / 9;
    const hw = 3 + t * 1.6;
    return [cx - hw, cx + hw];
  }, MOSSY_STONE, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  c.ellipse(cx, b - 12, 3.2, 3.2, LANTERN_STONE, { flatten: 0.85 });
  // Closed eyes, a calm little face.
  c.part();
  c.px(cx - 2, b - 12, EYE, FLAT);
  c.px(cx + 1, b - 12, EYE, FLAT);
  // The red bib.
  c.part();
  for (let y = b - 9; y <= b - 5; y++) {
    const hw = 3.6 - (y - (b - 9)) * 0.55;
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) c.px(x, y, BIB, cyl((x + 0.5 - cx) / Math.max(1, hw), 0.2), { bias: y === b - 9 ? 1 : 0 });
  }
  // A cap of snow on the head and the shoulders.
  capSnow(c, [LANTERN_STONE], () => 2);
  capSnow(c, [MOSSY_STONE], (x) => (Math.abs(x + 0.5 - cx) > 2 ? 1 : 0));
  mound(c, cx, b + 0.5, 6, 2.6);
  return c;
}

// ---------------------------------------------------------------- the cabin

export const CABIN_W = 100;
export const CABIN_H = 92;
export const CABIN_FOOT_Y = 86;

function cabinFrame(): PixelCanvas {
  const c = new PixelCanvas(CABIN_W, CABIN_H);
  const R = rng(5100);
  const cx = CABIN_W / 2;
  const b = CABIN_FOOT_Y;
  const eave = b - 34;
  const ridge = eave - 28;
  const half = 34;
  // The front wall: logs one on another, their ends crossing at the corners.
  c.part();
  for (let y = eave + 1; y <= b; y++) {
    const ly = (b - y) % 4;
    for (let x = cx - half; x < cx + half; x++) {
      const knot = hash2(x >> 2, (b - y) >> 2, 11) > 0.93 && ly === 1;
      c.px(x, y, LOG, { x: 0, y: (ly - 1.5) * 0.45, z: 0.85 }, { bias: (ly === 0 ? -2 : ly === 3 ? 1 : 0) + (knot ? -1 : 0) + (hash2(x >> 3, y >> 2, 12) > 0.7 ? -1 : 0) });
    }
  }
  c.part();
  for (let y = b - 2; y > eave; y -= 4) {
    for (const side of [-1, 1]) c.ellipse(cx + side * (half + 1.5), y, 2.2, 2, LOG_END, { flatten: 0.6 });
  }
  // The window, lit, with its cross of mullions and a sill heaped with snow.
  const wx = cx + CABIN_WINDOW.x;
  const wy = b + CABIN_WINDOW.y;
  c.part();
  for (let y = wy - 6; y <= wy + 5; y++) for (let x = wx - 7; x <= wx + 6; x++) c.px(x, y, PLANK, FLAT, { bias: y === wy - 6 ? 1 : 0 });
  c.part();
  for (let y = wy - 5; y <= wy + 4; y++) {
    for (let x = wx - 6; x <= wx + 5; x++) {
      if (x === wx || y === wy) continue;
      c.px(x, y, WINDOW, FLAT, { bias: y < wy ? 1 : 0 });
    }
  }
  c.part();
  for (let x = wx - 8; x <= wx + 7; x++) c.px(x, wy + 6, PLANK, UP, { bias: 1 });
  capSnow(c, [PLANK], () => 2, wx - 8, wx + 7);
  // The door, planked, with a wreath.
  const dx = cx + 10;
  c.part();
  for (let y = b - 22; y <= b; y++) {
    for (let x = dx - 5; x <= dx + 5; x++) {
      const frame = x === dx - 5 || x === dx + 5 || y === b - 22;
      c.px(x, y, PLANK, frame ? UP : { x: 0, y: 0, z: 1 }, { bias: frame ? 1 : (x - dx + 5) % 3 === 0 ? -1 : 0 });
    }
  }
  c.part();
  for (let a = 0; a < 14; a++) {
    const t = (a / 14) * Math.PI * 2;
    c.px(dx + Math.cos(t) * 2.6, b - 15 + Math.sin(t) * 2.6, NEEDLES, sphere(Math.cos(t) * 0.6, -Math.sin(t) * 0.6, 0.8), { bias: 2 });
  }
  c.px(dx - 1, b - 12, BERRY, UP);
  c.px(dx + 1, b - 12, BERRY, UP);
  c.px(dx + 3, b - 10, LOG_END, FLAT);
  // The roof: its face under a deep blanket of snow, its gable ends showing their boards.
  c.part();
  for (let y = ridge; y <= eave + 1; y++) {
    const t = (y - ridge) / (eave + 1 - ridge);
    const hw = half + 4 + t * 3;
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
      const edge = x < cx - hw + 2 || x >= cx + hw - 2;
      // The blanket swells and dips in soft lumps; the wind has scalloped it.
      const lump = Math.sin(x * 0.21 + Math.sin(y * 0.4) * 1.5) * Math.sin(y * 0.35 + x * 0.05);
      c.px(x, y, edge ? PLANK : SNOW, edge ? FLAT : sphere(lump * 0.25, 0.55 + lump * 0.2 - t * 0.25, 0.8), { bias: edge ? 0 : (y === ridge ? 2 : y < ridge + 3 ? 1 : 0) + (hash2(x >> 1, y, 13) > 0.9 ? -1 : 0) });
    }
  }
  // The ridge's soft roll of snow.
  c.part();
  for (let x = cx - half - 4; x < cx + half + 4; x++) {
    const lump = Math.round(Math.sin(x * 0.4) * 0.7 + R() * 0.6);
    for (let k = 0; k < 2 + lump; k++) c.px(x, ridge - k, SNOW, SKY, { bias: k === 0 ? 0 : 1 });
  }
  // The chimney rising through the snow, its own cap of snow.
  const chx = cx + CABIN_CHIMNEY.x;
  c.part();
  for (let y = b + CABIN_CHIMNEY.y + 3; y <= ridge + 12; y++) {
    for (let x = chx - 3; x < chx + 3; x++) {
      const brick = ((y >> 1) + (x >> 1)) % 3 === 0;
      c.px(x, y, CHIMNEY, cyl((x + 0.5 - chx) / 3, 0.1), { bias: brick ? -1 : 0 });
    }
  }
  c.part();
  for (let x = chx - 4; x < chx + 4; x++) c.px(x, b + CABIN_CHIMNEY.y + 3, CHIMNEY, UP, { bias: 1 });
  capSnow(c, [CHIMNEY], () => 1.6, chx - 4, chx + 3);
  // The eave: a lip of snow overhanging the wall, and icicles hanging from it.
  c.part();
  for (let x = cx - half - 6; x < cx + half + 6; x++) {
    const droop = 2 + Math.round(Math.sin(x * 0.55) * 0.7 + R() * 0.8);
    for (let k = 0; k < droop; k++) c.px(x, eave + 1 + k, SNOW, sphere(0, 0.3 - k * 0.4, 0.7), { bias: k === droop - 1 ? -1 : 0 });
  }
  c.part();
  for (let x = cx - half - 3; x < cx + half + 3; x += 2 + Math.floor(R() * 3)) {
    const len = 1 + Math.floor(R() * 4);
    for (let k = 0; k < len; k++) c.px(x, eave + 3 + k, FLAKE, cyl(0), { bias: k === 0 ? 1 : 0 });
  }
  // Snow banked against the wall, parted at the door.
  c.part();
  for (let x = cx - half - 3; x < cx + half + 3; x++) {
    if (x > dx - 6 && x < dx + 6) continue;
    const hgt = 2 + Math.round(Math.sin(x * 0.3) * 1 + R() * 0.8) + (x < cx - half + 4 ? 2 : 0);
    for (let k = 0; k < hgt; k++) c.px(x, b - k, SNOW_SOFT, sphere(0, 0.6 - (k / hgt) * 0.2, 0.8), { bias: k === 0 ? -1 : 0 });
  }
  return c;
}

// ---------------------------------------------------------------- the woodpile

export const WOOD_W = 30;
export const WOOD_H = 22;
export const WOOD_FOOT_Y = 19;

function woodFrame(): PixelCanvas {
  const c = new PixelCanvas(WOOD_W, WOOD_H);
  const cx = WOOD_W / 2;
  const b = WOOD_FOOT_Y;
  // Split logs stacked end on, the pile narrowing to the top.
  const rows = [6, 5, 4];
  for (let r = 0; r < rows.length; r++) {
    c.part();
    const n = rows[r];
    for (let k = 0; k < n; k++) {
      const x = cx + (k - (n - 1) / 2) * 4;
      const y = b - 2 - r * 3.4;
      c.ellipse(x, y, 2.1, 1.8, LOG_END, { flatten: 0.5, bias: hash2(k, r, 5) > 0.5 ? 1 : 0 });
      c.px(x - 0.5, y - 0.5, LOG, FLAT, { bias: -1 });
    }
  }
  capSnow(c, [LOG_END, LOG], (x) => 2 + Math.sin(x) * 0.5);
  mound(c, cx, b + 0.5, 13, 2);
  return c;
}

// ---------------------------------------------------------------- the snow hare

export const HARE_W = 18;
export const HARE_H = 14;
export const HARE_FOOT_Y = 12;

/** Hop frames: body stretch, lift off the ground, ears back. */
const HOPS = [
  { stretch: 0, lift: 0, ears: 0 },
  { stretch: 2, lift: 1, ears: 1 },
  { stretch: 3, lift: 2, ears: 2 },
  { stretch: 1, lift: 0, ears: 1 },
];

function hareFrame(f: number, idle: number): PixelCanvas {
  const c = new PixelCanvas(HARE_W, HARE_H);
  const h = f >= 0 ? HOPS[f] : { stretch: 0, lift: 0, ears: 0 };
  const b = HARE_FOOT_Y - h.lift;
  const bx = 8;
  // Hind feet, then the round body, the head forward, long ears tipped black.
  c.part();
  c.ellipse(bx - 3 - h.stretch * 0.5, b - 0.5, 2.4, 1.2, HARE, { flatten: 0.6, bias: -1 });
  c.part();
  c.ellipse(bx - h.stretch * 0.3, b - 3.4, 4.4 + h.stretch * 0.4, 3.2 - h.stretch * 0.2, HARE, { flatten: 0.8 });
  c.part();
  c.ellipse(bx - 4.6 - h.stretch * 0.6, b - 4.6, 1.4, 1.3, HARE, { flatten: 0.8, bias: 1 });
  c.part();
  const hx = bx + 4 + h.stretch * 0.4;
  const hy = b - 5.5 + (h.stretch > 1 ? 1 : 0);
  c.ellipse(hx, hy, 2.4, 2.1, HARE, { flatten: 0.85 });
  if (f >= 0 && h.stretch > 1) c.px(hx + 1, b - 1, HARE, FLAT, { bias: -1 });
  else c.px(hx - 0.5, b - 0.5, HARE, FLAT, { bias: -1 });
  c.part();
  const back = h.ears;
  const twitch = idle === 1 ? 1 : 0;
  for (const [ox, k] of [[-1, 0], [0.5, 1]] as const) {
    for (let s = 0; s < 5; s++) {
      const x = hx + ox - s * (0.35 + back * 0.35) - (k === 1 ? twitch * s * 0.3 : 0);
      const y = hy - 2 - s * (1 - back * 0.25);
      c.px(x, y, s >= 4 ? HARE_TIP : HARE, cyl(-0.3), { bias: k === 0 ? -1 : 0 });
    }
  }
  c.part();
  c.px(hx + 1, hy - 0.5, EYE, FLAT);
  c.px(hx + 2.4, hy + 0.5, BERRY, FLAT, { bias: 2 });
  return c;
}

// ---------------------------------------------------------------- the fox

export const FOX_W = 28;
export const FOX_H = 20;
export const FOX_FOOT_Y = 18;

function foxFrame(f: number, idle: number): PixelCanvas {
  const c = new PixelCanvas(FOX_W, FOX_H);
  const b = FOX_FOOT_Y;
  const bx = 13;
  const by = b - 7;
  const bob = f >= 0 && f % 2 === 1 ? -1 : 0;
  // The tail, long and bushy, white at its tip, swishing when it stands.
  c.part();
  const sw = idle === 1 ? -2 : 0;
  for (let s = 0; s <= 9; s++) {
    const t = s / 9;
    const x = bx - 6 - s;
    const y = by + bob + 1 - Math.sin(t * Math.PI * 0.8) * (3 - sw) + t * 2;
    const r = 1.4 + Math.sin(t * Math.PI) * 1.4;
    c.ellipse(x, y, r, r * 0.9, t > 0.78 ? FUR_WHITE : FUR_FOX, { flatten: 0.8, bias: t > 0.5 ? 0 : -1 });
  }
  // Legs, dark-stockinged, in a trot.
  c.part();
  const legs = f >= 0 ? [[0, 2], [2, 0], [1, 1], [3, -1]][f] : [0, 0];
  for (const [lx, phase] of [[bx - 4, legs[0]], [bx - 2, legs[1]], [bx + 3, legs[1]], [bx + 5, legs[0]]] as const) {
    const swing = (phase - 1) * 0.8;
    for (let y = by + 2 + bob; y <= b; y++) {
      const t = (y - by - 2) / (b - by - 2);
      c.px(lx + swing * t, y, t > 0.45 ? FUR_DARK : FUR_FOX, cyl(0), { bias: lx === bx - 2 || lx === bx + 3 ? -1 : 0 });
    }
  }
  // The body, the white chest, the head with its tall dark-backed ears and long muzzle.
  c.part();
  c.capsule(bx - 5, by + bob, bx + 4, by + bob, 2.8, 2.6, FUR_FOX);
  c.part();
  c.ellipse(bx + 5, by + 1 + bob, 1.8, 2, FUR_WHITE, { flatten: 0.8 });
  c.part();
  const hx = bx + 7;
  const hy = by - 3 + bob + (f < 0 && idle === 1 ? 1 : 0);
  c.ellipse(hx, hy, 2.6, 2.3, FUR_FOX, { flatten: 0.85 });
  c.capsule(hx + 1, hy + 0.5, hx + 4.5, hy + 1.3, 1.3, 0.7, FUR_FOX);
  c.px(hx + 2, hy + 1.6, FUR_WHITE, FLAT);
  c.px(hx + 3, hy + 1.8, FUR_WHITE, FLAT);
  c.px(hx + 5, hy + 1, FUR_DARK, FLAT);
  c.part();
  for (const ox of [-1.4, 0.8]) {
    for (let s = 0; s < 3; s++) c.px(hx + ox - s * 0.3, hy - 2 - s, s === 2 ? FUR_DARK : FUR_FOX, cyl(-0.2), { bias: ox < 0 ? -1 : 0 });
  }
  c.part();
  c.px(hx + 1, hy - 0.5, EYE, FLAT);
  return c;
}

// ---------------------------------------------------------------- the life layer's bits

export const PRINT_W = 6;
export const PRINT_H = 6;

/** A footprint pressed into the snow: lit on the far wall, shaded on the near, as a dent is. */
function printFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(PRINT_W, PRINT_H);
  const rx = v === 0 ? 2 : 1.3;
  const ry = v === 0 ? 1.2 : 1.9;
  for (let y = 0; y < PRINT_H; y++) {
    for (let x = 0; x < PRINT_W; x++) {
      const dx = (x + 0.5 - 3) / rx;
      const dy = (y + 0.5 - 3) / ry;
      if (dx * dx + dy * dy > 1.15) continue;
      c.px(x, y, PRINT, sphere(-dx * 0.9, dy * 0.9, 0.5), { bias: -1 });
    }
  }
  return c;
}

export const FLAKE_W = 5;
export const FLAKE_H = 5;

function flakeFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(FLAKE_W, FLAKE_H);
  if (v === 0) c.px(2, 2, FLAKE, FLAT, { bias: 2 });
  else if (v === 1) {
    for (const [x, y] of [[2, 2], [3, 2], [2, 3], [3, 3]]) c.px(x, y, FLAKE, FLAT, { bias: x === 2 && y === 2 ? 2 : 0 });
  } else {
    c.px(2, 2, FLAKE, FLAT, { bias: 2 });
    for (const [x, y] of [[1, 2], [3, 2], [2, 1], [2, 3]]) c.px(x, y, FLAKE, FLAT, { bias: 0 });
  }
  return c;
}

export const STEAM_W = 20;
export const STEAM_H = 20;

/** A soft puff of steam: a disc that thins to a dither at its edge. */
function steamFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(STEAM_W, STEAM_H);
  const r = [4, 6.5, 9][v];
  const R = rng(6100 + v);
  const lumps: [number, number, number][] = [];
  for (let k = 0; k < 4; k++) lumps.push([10 + (R() - 0.5) * r, 10 + (R() - 0.5) * r * 0.7, r * (0.55 + R() * 0.25)]);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < STEAM_H; y++) {
    for (let x = 0; x < STEAM_W; x++) {
      let d = 9;
      for (const [lx, ly, lr] of lumps) d = Math.min(d, Math.hypot(x + 0.5 - lx, (y + 0.5 - ly) * 1.15) / lr);
      if (d > 1) continue;
      // Thinner toward the edge: fewer pixels kept.
      const keep = 1 - d * d;
      if (keep < (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16) continue;
      c.px(x, y, STEAM, sphere((x - 10) / r * 0.5, (10 - y) / r * 0.5, 0.9), { bias: d < 0.4 ? 1 : 0 });
    }
  }
  return c;
}

// ---------------------------------------------------------------- the sheets

export function hushSheets(): SheetDef[] {
  const sheet = (key: string, w: number, h: number, footY: number, frames: SheetDef['frames'], extra: Partial<SheetDef> = {}): SheetDef => ({ key, w, h, footX: w / 2, footY, frames, ...extra });
  return [
    sheet('hush_fir', FIR_W, FIR_H, FIR_FOOT_Y, FIRS.map((_, v) => ({ name: `f${v}`, draw: () => firFrame(v) }))),
    sheet('hush_rock', ROCK_W, ROCK_H, ROCK_FOOT_Y, [0, 1, 2].map((v) => ({ name: `r${v}`, draw: () => rockFrame(v) }))),
    sheet('hush_bush', BUSH_W, BUSH_H, BUSH_FOOT_Y, [0, 1].map((v) => ({ name: `b${v}`, draw: () => bushFrame(v) }))),
    sheet('hush_reed', REED_W, REED_H, REED_FOOT_Y, [0, 1, 2].map((v) => ({ name: `t${v}`, draw: () => reedFrame(v) }))),
    sheet('hush_snowman', MAN_W, MAN_H, MAN_FOOT_Y, [0, 1, 2].map((v) => ({ name: `s${v}`, draw: () => snowmanFrame(v) }))),
    sheet('hush_lantern', LANTERN_W, LANTERN_H, LANTERN_FOOT_Y, (['tall', 'small', 'post'] as const).map((k) => ({ name: k, draw: () => lanternFrame(k) })), { glows: true }),
    sheet('hush_gate', GATE_W, GATE_H, GATE_FOOT_Y, [{ name: 'gate', draw: gateFrame }]),
    sheet('hush_jizo', JIZO_W, JIZO_H, JIZO_FOOT_Y, [{ name: 'j0', draw: jizoFrame }]),
    sheet('hush_cabin', CABIN_W, CABIN_H, CABIN_FOOT_Y, [{ name: 'cabin', draw: cabinFrame }], { glows: true }),
    sheet('hush_wood', WOOD_W, WOOD_H, WOOD_FOOT_Y, [{ name: 'w0', draw: woodFrame }]),
    // An empty frame: the gate's posts stop feet through two of these.
    sheet('hush_blank', 2, 2, 1, [{ name: 'b', draw: () => new PixelCanvas(2, 2) }]),
    sheet('hush_hare', HARE_W, HARE_H, HARE_FOOT_Y, [...HOPS.map((_, f) => ({ name: `h${f}`, draw: () => hareFrame(f, 0) })), { name: 'i0', draw: () => hareFrame(-1, 0) }, { name: 'i1', draw: () => hareFrame(-1, 1) }], {
      anims: [
        { name: 'hop', frames: ['h0', 'h1', 'h2', 'h3'], fps: 10, loop: true },
        { name: 'idle', frames: ['i0', 'i0', 'i0', 'i1', 'i0', 'i0', 'i1', 'i0'], fps: 3, loop: true },
      ],
    }),
    sheet('hush_fox', FOX_W, FOX_H, FOX_FOOT_Y, [...[0, 1, 2, 3].map((f) => ({ name: `t${f}`, draw: () => foxFrame(f, 0) })), { name: 'i0', draw: () => foxFrame(-1, 0) }, { name: 'i1', draw: () => foxFrame(-1, 1) }], {
      anims: [
        { name: 'trot', frames: ['t0', 't1', 't2', 't3'], fps: 9, loop: true },
        { name: 'idle', frames: ['i0', 'i0', 'i1', 'i1', 'i0', 'i0', 'i0'], fps: 2, loop: true },
      ],
    }),
    sheet('hush_print', PRINT_W, PRINT_H, PRINT_H / 2, [0, 1].map((v) => ({ name: `p${v}`, draw: () => printFrame(v) }))),
    sheet('hush_flake', FLAKE_W, FLAKE_H, FLAKE_H / 2, [0, 1, 2].map((v) => ({ name: `f${v}`, draw: () => flakeFrame(v) }))),
    sheet('hush_steam', STEAM_W, STEAM_H, STEAM_H / 2, [0, 1, 2].map((v) => ({ name: `s${v}`, draw: () => steamFrame(v) }))),
  ];
}
