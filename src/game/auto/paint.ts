// The drawing kit Auto Battle's effects are made from: solid pixels put on a
// canvas laid over the board (one under the heroes, one over them), soft
// lights for the bloom, and sparks. The same language as the main game's
// Specials (ultimate/ink.ts), sized for the board: a cell is 24 px across and
// 15 deep, a hero about 24 tall. It imports nothing at run time, so the
// render script (scripts/autofx.ts) can paint the effects without Phaser.

import type { Pal } from '../ultimate/ink';

export type { Pal };
export type Pt = { x: number; y: number };

/** Anything pixels can be put on. Where two pixels meet the more opaque one wins, then the brighter. */
export interface Px {
  put(x: number, y: number, c: number, a?: number): void;
}

/** What a live effect draws on each frame. */
export interface Layers {
  /** On the board, under the heroes: rings, pools, scorches, shadows. */
  ground: Px;
  /** Over the heroes: everything in the air. */
  air: Px;
  /** A soft additive light, `size` px across, for this frame only. */
  light(x: number, y: number, size: number, col: number, a: number): void;
}

/** `k` runs 0..1 over the effect's life, `t` is seconds since it began. */
export type DrawFn = (L: Layers, k: number, t: number) => void;

export interface SparkOpts {
  /** Speed outward, px/s. */
  speed?: number;
  /** Speed upward, px/s. */
  up?: number;
  /** Gravity (negative floats them up). */
  g?: number;
  life?: number;
  /** Scatter of the starting spot, px. */
  spread?: number;
  /** Start this high off the ground. */
  z?: number;
  /** Drawn under the heroes (dust, embers on the ground). */
  ground?: boolean;
  /** Outward only along this angle (radians) ± `cone`. */
  dir?: number;
  cone?: number;
}

/** Where effects live: the FxLayer in the game, a stand-in in the render script. */
export interface Stage {
  /** Draw `draw` every frame for `dur` s, starting after `wait` s; `done` when it ends. */
  add(dur: number, draw: DrawFn, wait?: number, done?: () => void): void;
  /** A spray of single-pixel sparks that arc and fall. */
  sparks(x: number, y: number, n: number, cols: number[], o?: SparkOpts): void;
  /** Shake the view (ms, strength); only the big moments. */
  shake(ms: number, amt: number): void;
}

/** Everything an ability's look needs, in board px (points are feet on the ground). */
export interface Cast {
  /** The caster's feet. */
  from: Pt;
  /** The spot it was aimed at (a foe's feet, the caster's own for self casts, a beam's far end on its hit). */
  at: Pt;
  /** Foes struck (or allies mended), on the hit. */
  hits: Pt[];
  /** A chain's hops, or a rain's targets in the order they are struck, on the hit. */
  path: Pt[];
  /** Radius (or a beam's length) in px across the board. */
  r: number;
  pal: Pal;
  /** The worn look's id (a skin may draw a touch differently). */
  look: string;
  /** Seconds from the cast to the hit (the wind-up the cast hook can fill). */
  lead: number;
  /** A rain's span: its strikes land over this many seconds after the hit. */
  span: number;
  /** Stun on the foes struck, in seconds (0 if none). */
  stun: number;
}

/** One move's look: `cast` fills the wind-up, `hit` plays as it lands (when the numbers show). */
export interface Move {
  cast?(s: Stage, c: Cast): void;
  hit(s: Stage, c: Cast): void;
}

/** A hero's whole look in a fight. Any part left out falls back to the generic one. */
export interface Kit {
  /** The basic attack's missile from `a` to `b` (feet), landing after `dur` s. */
  shot?(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void;
  /** A blow in reach landing on the foe at `at`, struck from `from`; `heavy` on the combo's last. */
  melee?(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void;
  skill?: Move;
  ult?: Move;
}

// --- Numbers ------------------------------------------------------------------

/** How flat a circle on the board looks (a cell is 24 by 15). */
export const FLAT = 0.62;
/** Px across the board for one cell of a spell's reach. */
export const CELL = 22;
/** Heights over the feet: chest (where missiles fly), head, a little over the head. */
export const CHEST = 11;
export const HEAD = 22;
export const OVER = 30;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
/** An ordered-dither threshold for a pixel: shapes fade in a clean checker, not in smears of alpha. */
export const dither = (x: number, y: number): number => BAYER[((Math.round(y) & 3) << 2) | (Math.round(x) & 3)];

export const hash = (a: number, b: number, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
export const easeOut = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
export const easeIn = (t: number): number => Math.pow(clamp01(t), 2.2);
/** 0 → 1 → 0 over t in 0..1. */
export const bump = (t: number): number => Math.sin(clamp01(t) * Math.PI);
/** 1 until `from`, then down to 0 at 1: a fade at the end of a life. */
export const tail = (k: number, from = 0.7): number => (k < from ? 1 : clamp01((1 - k) / (1 - from)));
/** Up from 0 to 1 over the first `to` of a life. */
export const rise = (k: number, to = 0.2): number => clamp01(k / to);

/** Pick a colour across a band: 0 is its heart, 1 its outer edge. */
export const shade = (p: Pal, u: number): number => (u < 0.28 ? p.core : u < 0.55 ? p.hot : u < 0.8 ? p.mid : p.deep);

/** Mix two colours. */
export function mix(a: number, b: number, k: number): number {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, k));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, k));
  const bl = Math.round(lerp(a & 255, b & 255, k));
  return (r << 16) | (g << 8) | bl;
}

/** A colour darkened towards black by `k`. */
export const dark = (c: number, k: number): number => mix(c, 0x000000, k);

export const angle = (a: Pt, b: Pt): number => Math.atan2(b.y - a.y, b.x - a.x);
export const dist = (a: Pt, b: Pt): number => Math.hypot(b.x - a.x, b.y - a.y);

// --- Shapes -------------------------------------------------------------------

/** A square of pixels `s` wide centred on (x, y). */
export function dot(px: Px, x: number, y: number, c: number, a = 1, s = 1): void {
  const x0 = Math.round(x - (s - 1) / 2);
  const y0 = Math.round(y - (s - 1) / 2);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) px.put(x0 + i, y0 + j, c, a);
}

/** A one-pixel line. */
export function line(px: Px, x0: number, y0: number, x1: number, y1: number, c: number, a = 1): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) px.put(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c, a);
}

/** A glowing stroke `w` px either side of the line: white heart, the palette out to the edge. `taper` narrows it to a point at the far end. */
export function stroke(px: Px, x0: number, y0: number, x1: number, y1: number, w: number, p: Pal, a = 1, taper = 0): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(len * 1.4));
  const ux = (x1 - x0) / (len || 1);
  const uy = (y1 - y0) / (len || 1);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const ww = w * (1 - taper * f);
    const cx = x0 + (x1 - x0) * f;
    const cy = y0 + (y1 - y0) * f;
    const steps = Math.max(1, Math.ceil(ww * 2));
    for (let j = -steps; j <= steps; j++) {
      const o = (j / steps) * ww;
      px.put(Math.round(cx - uy * o), Math.round(cy + ux * o), shade(p, Math.abs(o) / (ww || 1)), a);
    }
  }
}

/** A ring on the ground, `w` px thick either side of radius `r`, shaded from the palette. `gaps` 0..1 breaks it into arcs. */
export function ring(px: Px, cx: number, cy: number, r: number, w: number, p: Pal, a = 1, gaps = 0, seed = 0, sq = FLAT): void {
  if (r + w <= 0 || a <= 0) return;
  const R = r + w;
  const ry = Math.ceil(R * sq);
  const rx = Math.ceil(R);
  const r0 = Math.max(0, r - w);
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const d = Math.hypot(dx, dy / sq);
      if (d > R || d < r0) continue;
      if (gaps > 0 && hash(Math.floor(((Math.atan2(dy / sq, dx) + Math.PI) * R) / 6), seed) < gaps) continue;
      const u = Math.abs(d - r) / (w || 1);
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      if (a < 1 && dither(x, y) >= a) continue;
      px.put(x, y, shade(p, u), 1);
    }
  }
}

/** A thin outline of an ellipse (a circle on the ground), from angle `from` to `to`. */
export function circle(px: Px, cx: number, cy: number, r: number, c: number, a = 1, sq = FLAT, from = 0, to = Math.PI * 2): void {
  if (r <= 0) return;
  const steps = Math.max(12, Math.ceil(Math.abs(to - from) * r * 1.3));
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    px.put(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r * sq), c, a);
  }
}

/** A filled patch on the ground thinning to its rim in a dithered checker; `inner` at heart, `outer` round it. */
export function pool(px: Px, cx: number, cy: number, r: number, inner: number, outer: number, a = 1, alpha = 0.85, sq = FLAT): void {
  if (r <= 0 || a <= 0) return;
  const ry = Math.ceil(r * sq);
  const rx = Math.ceil(r);
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const d = Math.hypot(dx, dy / sq) / r;
      if (d > 1) continue;
      const k = a * (1 - d * d * d);
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      if (dither(x, y) >= k) continue;
      px.put(x, y, d < 0.55 ? inner : outer, alpha);
    }
  }
}

/** A solid ellipse `rx` by `ry`, one colour; `a` < 1 dithers it away. */
export function disc(px: Px, cx: number, cy: number, rx: number, ry: number, c: number, a = 1, alpha = 1): void {
  if (rx <= 0 || ry <= 0 || a <= 0) return;
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue;
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      if (a < 1 && dither(x, y) >= a) continue;
      px.put(x, y, c, alpha);
    }
  }
}

/** A glowing ball in the air: palette bands from a white heart out to a deep rim. */
export function orb(px: Px, cx: number, cy: number, r: number, p: Pal, a = 1): void {
  if (r <= 0) return;
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy) / r;
      if (d > 1) continue;
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      if (a < 1 && dither(x, y) >= a * (1.2 - d * 0.4)) continue;
      px.put(x, y, shade(p, d), 1);
    }
  }
}

/** A four-pointed glint: long arms up, down and across, short diagonals. */
export function star(px: Px, x: number, y: number, s: number, p: Pal, a = 1): void {
  x = Math.round(x);
  y = Math.round(y);
  px.put(x, y, p.core, a);
  for (let i = 1; i <= s; i++) {
    const c = shade(p, i / (s + 1));
    px.put(x + i, y, c, a);
    px.put(x - i, y, c, a);
    px.put(x, y + i, c, a);
    px.put(x, y - i, c, a);
  }
  for (let i = 1; i <= Math.floor(s / 2.5); i++) {
    const c = shade(p, 0.4 + i / (s + 1));
    px.put(x + i, y + i, c, a);
    px.put(x - i, y + i, c, a);
    px.put(x + i, y - i, c, a);
    px.put(x - i, y - i, c, a);
  }
}

/** A jagged bolt of lightning; a new `seed` each frame makes it crackle. */
export function bolt(px: Px, x0: number, y0: number, x1: number, y1: number, p: Pal, seed: number, a = 1, jag = 0.55): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, Math.round(len / 6));
  const nx = -(y1 - y0) / (len || 1);
  const ny = (x1 - x0) / (len || 1);
  let qx0 = x0;
  let qy0 = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const off = i === n ? 0 : (hash(i, seed, 3) - 0.5) * jag * (len / n) * 2;
    const qx = x0 + (x1 - x0) * t + nx * off;
    const qy = y0 + (y1 - y0) * t + ny * off;
    line(px, qx0 + 1, qy0, qx + 1, qy, p.mid, a);
    line(px, qx0 - 1, qy0, qx - 1, qy, p.deep, a);
    line(px, qx0, qy0, qx, qy, p.core, a);
    qx0 = qx;
    qy0 = qy;
  }
}

/** A column of light standing on (x, base), `h` tall, `w` either side, tapering and dithering away at the top. */
export function column(px: Px, x: number, base: number, h: number, w: number, p: Pal, a = 1, t = 0): void {
  for (let dy = 0; dy < h; dy++) {
    const up = dy / h;
    const fade = a * (1 - up * up);
    const ww = w * (0.55 + 0.45 * Math.sqrt(1 - up)) * (1 + 0.12 * Math.sin(t * 30 + dy * 0.35));
    const y = Math.round(base - dy);
    for (let dx = -Math.ceil(ww); dx <= Math.ceil(ww); dx++) {
      const u = Math.abs(dx) / (ww || 1);
      if (u > 1) continue;
      const xx = Math.round(x + dx);
      if (u > 0.6 && dither(xx, y) >= fade) continue;
      if (fade < 0.5 && dither(xx, y) >= fade * 2) continue;
      px.put(xx, y, shade(p, u), 1);
    }
  }
}

/** A magic circle on the ground: two rings, a turning band of ticks, a hexagram turning the other way. */
export function rune(px: Px, cx: number, cy: number, r: number, rot: number, p: Pal, a = 1, sq = FLAT): void {
  if (r < 3 || a <= 0) return;
  circle(px, cx, cy, r, p.hot, a, sq);
  circle(px, cx, cy, r * 0.8, p.mid, a, sq);
  const ticks = r > 14 ? 12 : 8;
  for (let i = 0; i < ticks; i++) {
    const th = rot + (i / ticks) * Math.PI * 2;
    const c = Math.cos(th);
    const s = Math.sin(th) * sq;
    if (i % 3 === 0) {
      const mx = Math.round(cx + c * r * 0.9);
      const my = Math.round(cy + s * r * 0.9);
      px.put(mx, my, p.core, a);
      px.put(mx + 1, my, p.hot, a);
      px.put(mx - 1, my, p.hot, a);
    } else line(px, cx + c * r * 0.84, cy + s * r * 0.84, cx + c * r * 0.96, cy + s * r * 0.96, p.mid, a);
  }
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const th = -rot * 1.3 + (i / 6) * Math.PI * 2;
    pts.push([cx + Math.cos(th) * r * 0.72, cy + Math.sin(th) * r * 0.72 * sq]);
  }
  for (let i = 0; i < 6; i++) line(px, pts[i][0], pts[i][1], pts[(i + 2) % 6][0], pts[(i + 2) % 6][1], p.deep, a);
}

/** A filled triangle. */
export function tri(px: Px, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: number, a = 1): void {
  const x0 = Math.floor(Math.min(ax, bx, cx));
  const x1 = Math.ceil(Math.max(ax, bx, cx));
  const y0 = Math.floor(Math.min(ay, by, cy));
  const y1 = Math.ceil(Math.max(ay, by, cy));
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 0.01) return;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px0 = x + 0.5;
      const py0 = y + 0.5;
      const w0 = ((bx - px0) * (cy - py0) - (by - py0) * (cx - px0)) / area;
      const w1 = ((cx - px0) * (ay - py0) - (cy - py0) * (ax - px0)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      if (a < 1 && dither(x, y) >= a) continue;
      px.put(x, y, c, 1);
    }
  }
}

/** A crescent sweep (a blade's arc): from angle `a0` to `a1` round (cx, cy), `r` out, `w` thick at its middle, tapering to points. */
export function arc(px: Px, cx: number, cy: number, r: number, w: number, a0: number, a1: number, p: Pal, a = 1, sq = 0.75): void {
  const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) * r * 1.6));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const th = a0 + (a1 - a0) * f;
    const ww = w * Math.sin(f * Math.PI);
    const steps = Math.max(1, Math.ceil(ww * 2));
    for (let j = 0; j <= steps; j++) {
      const rr = r - (j / steps) * ww;
      const x = Math.round(cx + Math.cos(th) * rr);
      const y = Math.round(cy + Math.sin(th) * rr * sq);
      if (a < 1 && dither(x, y) >= a) continue;
      // The outer edge is the bright edge of the blade.
      px.put(x, y, shade(p, (j / steps) * 0.9 + (1 - f) * 0.1), 1);
    }
  }
}

/**
 * A little drawing from rows of letters, each letter a colour from `cols`
 * ('.' or ' ' is empty), its anchor (ax, ay) placed at (x, y). `flip` mirrors
 * it, `s` scales it up by whole pixels.
 */
export function sprite(px: Px, x: number, y: number, rows: string[], cols: Record<string, number>, a = 1, o: { ax?: number; ay?: number; flip?: boolean; s?: number } = {}): void {
  const s = o.s ?? 1;
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const ox = Math.round(x - (o.ax ?? w / 2) * s);
  const oy = Math.round(y - (o.ay ?? h) * s);
  for (let j = 0; j < h; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.' || ch === ' ') continue;
      const c = cols[ch];
      if (c === undefined) continue;
      const ii = o.flip ? w - 1 - i : i;
      for (let sy = 0; sy < s; sy++)
        for (let sx = 0; sx < s; sx++) {
          const X = ox + ii * s + sx;
          const Y = oy + j * s + sy;
          if (a < 1 && dither(X, Y) >= a) continue;
          px.put(X, Y, c, 1);
        }
    }
  }
}

// --- Common moments -------------------------------------------------------------

/** A burst of light where something lands: a ring out on the ground, a flash, sparks. */
export function impact(s: Stage, at: Pt, p: Pal, size = 1, h = CHEST): void {
  const R = 4 + 6 * size;
  s.add(0.24, (L, k) => {
    ring(L.ground, at.x, at.y, R * easeOut(k), 1, p, 1 - k);
    if (k < 0.5) star(L.air, at.x, at.y - h, Math.round(2 + 3 * size * (1 - k * 2)), p, 1);
    L.light(at.x, at.y - h, 14 + 14 * size, p.light, 0.8 * (1 - k));
  });
  s.sparks(at.x, at.y, Math.round(4 + 5 * size), p.tints, { speed: 22 + 10 * size, up: 22, life: 0.35, z: h });
}

/** An expanding shock ring on the ground with a flash, `R` px out. */
export function shock(s: Stage, at: Pt, R: number, p: Pal, dur = 0.4, w = 2): void {
  s.add(dur, (L, k) => {
    const r = Math.max(3, R) * easeOut(k);
    ring(L.ground, at.x, at.y, r, w, p, 1 - k * k);
    L.light(at.x, at.y - 6, R * 2 + 16, p.light, 0.7 * (1 - k));
  });
}

/** Something falling from the sky onto `at`: `draw(L, x, y, k)` places it, landing at k = 1 after `dur`; then `land`. */
export function fall(s: Stage, at: Pt, dur: number, height: number, draw: (L: Layers, x: number, y: number, k: number) => void, land?: () => void, wait = 0, drift = 0): void {
  s.add(
    dur,
    (L, k) => {
      const e = easeIn(k);
      const y = at.y - height * (1 - e);
      const x = at.x + drift * (1 - e);
      draw(L, x, y, k);
    },
    wait,
    land,
  );
}

/** A shadow on the ground under something coming down, growing as it nears. */
export function shadowOf(px: Px, x: number, y: number, r: number, k: number): void {
  disc(px, x, y, r * (0.4 + 0.6 * k), r * (0.4 + 0.6 * k) * FLAT, 0x0b0818, 0.25 + 0.45 * k, 0.6);
}
