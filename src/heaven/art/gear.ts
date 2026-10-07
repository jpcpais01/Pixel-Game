// The wanderer's hair, hats and everything worn or carried: the layers the
// rig (rig.ts) calls at their moment in the drawing order. All of it is drawn
// in the body's own 24 x 32 box, round the head's centre and the hands the
// pose gives, so it moves with every frame of every animation.

import { cyl, sphere, FLAT, type Material, type PixelCanvas, type RGB } from '../../art/pixel';
import { BACKS, EARRINGS, GLASSES, HAIRS, HATS, HELD, NECKS } from '../look';
import { blob, hsh, rows, type Geo, type Kit, type P } from './kit';
import { flat, mat, shade } from './paint';
import { eyeRow, type Layers } from './rig';

const id = (list: { id: string }[], i: number): string => list[i]?.id ?? list[0].id;

// ---------------------------------------------------------------- hair

type Tex = 'straight' | 'wavy' | 'curly' | 'spiky' | 'soft' | 'buzz';

interface HairDef {
  /** How much the hair stands off the head, px. */
  vol: number;
  /** Front on, the fringe's lower edge at a column (dx from the head's middle), as rows from the head's centre. */
  fringe: (dx: number, x: number) => number;
  /** How far down the hair at the sides of the face reaches, rows from the head's centre. */
  locks: number;
  /** Seen from behind or the side: how far down the back of the head. */
  nape: number;
  /** Long hair hanging down the back, to this many rows below the head's centre. */
  slab?: number;
  tex: Tex;
  /** The outline is a ring of curls. */
  bumpy?: boolean;
  /** The ends curl under (a bob). */
  curlIn?: boolean;
}

/** The fringes above are drawn this much higher, clear of the brows (the face sits a row above the head's middle). */
const FRINGE_LIFT = 0.8;

const straightFringe = (r: number) => () => r;
const parted = (top: number, slope: number, at = 0) => (dx: number) => Math.min(-1.6, top + Math.abs(dx - at) * slope);
const bumps = (r: number) => (_dx: number, x: number) => r + (x % 2 === 0 ? 0.6 : -0.3);

const HAIR: Record<string, HairDef> = {
  crop: { vol: 0.5, fringe: (dx) => (dx < -1 ? -3.2 : -2.5 + (dx > 2 ? 0.4 : 0)), locks: -0.6, nape: 3.4, tex: 'soft' },
  tousled: { vol: 0.9, fringe: (_dx, x) => -2.3 + (hsh(x, 3, 1) < 0.5 ? 0.9 : -0.2), locks: 0.4, nape: 3.8, tex: 'spiky' },
  spiky: { vol: 0.9, fringe: (_dx, x) => -2.6 + (x % 3 === 0 ? 1 : -0.2), locks: -0.6, nape: 3, tex: 'spiky' },
  pixie: { vol: 0.6, fringe: (dx) => Math.max(-3.4, -1.4 - (dx + 4) * 0.28), locks: 1.6, nape: 3.6, tex: 'soft' },
  bob: { vol: 0.8, fringe: straightFringe(-1.9), locks: 4.3, nape: 4.5, tex: 'straight', curlIn: true },
  long: { vol: 0.7, fringe: parted(-4.4, 0.62), locks: 10.5, nape: 5, slab: 15.5, tex: 'straight' },
  wavy: { vol: 1, fringe: parted(-3.8, 0.5, 1.5), locks: 9.5, nape: 5, slab: 13.6, tex: 'wavy' },
  ponytail: { vol: 0.5, fringe: (dx) => (dx < 0 ? -2.2 : -3 + dx * 0.1), locks: 0.6, nape: 3.2, tex: 'soft' },
  highpony: { vol: 0.5, fringe: (dx) => (Math.abs(dx - 1) < 1.2 ? -3.6 : -2.2), locks: 1.4, nape: 2.6, tex: 'straight' },
  pigtails: { vol: 0.6, fringe: straightFringe(-2.1), locks: 1.6, nape: 3, tex: 'straight' },
  bun: { vol: 0.4, fringe: (dx) => -3.4 + Math.abs(dx) * 0.18, locks: 0.8, nape: 2.6, tex: 'soft' },
  spacebuns: { vol: 0.4, fringe: straightFringe(-2.2), locks: 1.2, nape: 2.6, tex: 'soft' },
  braid: { vol: 0.5, fringe: parted(-3.9, 0.5, -1), locks: 1.6, nape: 3, tex: 'straight' },
  curls: { vol: 1.6, fringe: bumps(-2.3), locks: 4, nape: 4.6, tex: 'curly', bumpy: true },
  afro: { vol: 2.8, fringe: bumps(-2.6), locks: 1.6, nape: 4, tex: 'curly', bumpy: true },
  hime: { vol: 0.8, fringe: straightFringe(-1.6), locks: 4.3, nape: 5, slab: 15, tex: 'straight' },
  swept: { vol: 0.9, fringe: () => -3.9, locks: -0.4, nape: 3.4, tex: 'soft' },
  shaved: { vol: 0.1, fringe: () => -3.3, locks: -1, nape: 2.4, tex: 'buzz' },
};

const hairOf = (k: Kit): HairDef & { id: string } => {
  const h = id(HAIRS, k.a.hair);
  return { id: h, ...(HAIR[h] ?? HAIR.crop) };
};

/** The top of the hair, a row: where hats sit. */
const crownOf = (k: Kit, g: Geo): number => g.hy - 5.3 - hairOf(k).vol * 0.85;

/** Strands, waves and curls: a shading nudge for a pixel of hair. */
function strand(tex: Tex, x: number, y: number, u: number): number {
  switch (tex) {
    case 'straight':
      return hsh(x, 0, 11) < 0.28 && u > 0.1 ? -1 : 0;
    case 'wavy':
      return (y + Math.floor(x / 2) + (hsh(x, 1, 5) < 0.3 ? 1 : 0)) % 4 === 0 ? -1 : 0;
    case 'curly': {
      const v = (x * 3 + y * 5) % 7;
      return v < 2 ? -1 : v === 5 ? 1 : 0;
    }
    case 'spiky':
      return hsh(x - y, 2, 9) < 0.3 ? -1 : 0;
    case 'buzz':
      return (x + y) % 2 === 0 ? -1 : 0;
    default:
      return hsh(x, y >> 1, 4) < 0.18 ? -1 : 0;
  }
}

/** The light catching the hair's top: a bright arc on the lit side. */
function sheen(dx: number, dy: number): number {
  const r = dx * dx + (dy + 0.35) * (dy + 0.35);
  return r > 0.32 && r < 0.5 && dx < 0.35 ? 1 : 0;
}

/** The hair over the head: the cap, with the face cut out of it as the view shows it. */
function cap(c: PixelCanvas, k: Kit, g: Geo, h: HairDef, below = Infinity): void {
  const side = g.view === 'side';
  const rx = (side ? 5.15 : 5.6) + h.vol * 0.75;
  const ry = 5.4 + h.vol * 0.7;
  const cy = g.hy - 0.3 - h.vol * 0.45;
  const top = Math.floor(cy - ry - 1);
  const deepest = g.view === 'up' ? h.nape : Math.max(h.locks, side ? h.nape : -9);
  const bottom = Math.min(below, Math.ceil(g.hy + deepest + 1));
  const H = k.hair;
  const face = 4.2;
  c.part();
  for (let y = top; y <= bottom; y++) {
    for (let x = Math.floor(g.hx - rx - 1); x <= Math.ceil(g.hx + rx + 1); x++) {
      const dx = (x + 0.5 - g.hx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const ang = Math.atan2(dy, dx);
      const edge = h.bumpy ? 1 + 0.075 * Math.sin(ang * 11 + 0.5) : 1;
      let inside: boolean;
      if (dy <= 0 || h.bumpy) inside = dx * dx + dy * dy <= edge * edge;
      else {
        // Below the middle the hair falls straight, curling in at a bob's ends.
        const end = g.hy + (g.view === 'up' ? h.nape : h.locks);
        const curl = h.curlIn && y >= end - 1 ? 0.12 : 0;
        inside = Math.abs(dx) <= 1 - curl;
      }
      if (!inside) continue;
      const fx = x + 0.5 - g.hx;
      const ry2 = y + 0.5 - g.hy;
      if (g.view === 'down') {
        if (Math.abs(fx) < face) {
          if (ry2 >= h.fringe(fx, x) - FRINGE_LIFT) continue;
        } else if (ry2 >= h.locks) continue;
      } else if (g.view === 'up') {
        if (ry2 >= h.nape) continue;
      } else {
        // Side on, facing left: the face to the left, the ear just behind the middle.
        const front = fx < -1.4;
        const mid = !front && fx < 2.6;
        const long = h.locks > 2;
        const lim = front ? h.fringe(-2.5, x) - FRINGE_LIFT : mid ? (long ? h.locks : -0.7) : long ? Math.max(h.locks, h.nape) : h.nape;
        if (ry2 >= lim) continue;
      }
      const u = Math.max(0, Math.min(1, (y - top) / Math.max(1, bottom - top)));
      const n = dy <= 0 || h.bumpy ? sphere(dx, Math.max(-1, Math.min(1, dy)), 1) : cyl(dx, 0.1);
      c.px(x, y, H, n, { bias: strand(h.tex, x, y, u) + (h.tex === 'buzz' ? 0 : sheen(dx, Math.min(dy, 0.9))) });
    }
  }
}

/** Long hair down the back, swinging with the pose. */
function slab(c: PixelCanvas, k: Kit, g: Geo, h: HairDef, over: boolean): void {
  if (!h.slab) return;
  const side = g.view === 'side';
  const top = g.hy - 1;
  const end = g.hy + h.slab - (g.pose.sit ? 2 : 0);
  const sway = g.pose.sway * 1.6;
  const rx = 5.6 + h.vol * 0.75;
  c.part();
  rows(
    c,
    top,
    end,
    (y) => {
      const u = (y - top) / Math.max(1, end - top);
      const s = sway * u * u;
      if (side) return [g.hx - 0.6 + u * 1.4 + s, g.hx + rx + 0.4 - u * 1.6 + s];
      const half = rx + 0.2 - u * 0.9;
      return [g.hx - half + s, g.hx + half + s];
    },
    k.hair,
    (_x, _y, t, u) => cyl(t, 0.2 - u * 0.3),
    (x, y, _t, u) => strand(h.tex, x, y, u) - (over ? 0 : 1),
  );
  // The ends come to points: some strands shorter than others.
  for (let y = Math.floor(end - 2); y <= Math.ceil(end); y++)
    for (let x = Math.floor(g.hx - rx - 3); x <= Math.ceil(g.hx + rx + 3); x++) {
      if (c.materialAt(x, y) !== k.hair) continue;
      if (y > end - 2 && hsh(x, 5, 3) < (y > end - 1 ? 0.6 : 0.3)) c.erase(x, y);
    }
}

/** A tail of hair: a chain of points, thinning, with a band at its root. */
function tail(c: PixelCanvas, k: Kit, pts: P[], r0: number, r1: number, tex: Tex, band = true): void {
  c.part();
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    c.capsule(a.x, a.y, b.x, b.y, r0 + (r1 - r0) * (i / n), r0 + (r1 - r0) * ((i + 1) / n), k.hair);
  }
  // Strands along it.
  const x0 = Math.floor(Math.min(...pts.map((p) => p.x)) - r0 - 1);
  const x1 = Math.ceil(Math.max(...pts.map((p) => p.x)) + r0 + 1);
  const y0 = Math.floor(Math.min(...pts.map((p) => p.y)) - r0 - 1);
  const y1 = Math.ceil(Math.max(...pts.map((p) => p.y)) + r0 + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (c.materialAt(x, y) === k.hair && strand(tex, x, y, 1) < 0) c.shade(x, y, -1);
  if (band) {
    const p = pts[0];
    c.part();
    c.ellipse(p.x, p.y, r0 * 0.9, 0.9, k.trim);
  }
}

function braid(c: PixelCanvas, k: Kit, from: P, to: P): void {
  const steps = Math.max(2, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 1.6));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const r = 1.7 - t * 0.5;
    c.part();
    c.ellipse(x + (i % 2 ? 0.3 : -0.3), y, r, 1.15, k.hair, { bias: i % 2 ? 0 : -1 });
  }
  c.part();
  c.ellipse(to.x, to.y + 1.2, 0.9, 0.7, k.trim);
  c.ellipse(to.x, to.y + 2.3, 1, 0.9, k.hair, { bias: -1 });
}

const bun = (c: PixelCanvas, k: Kit, x: number, y: number, r: number) => {
  c.part();
  blob(c, x, y, r, r * 0.92, k.hair, (px, py, dx, dy) => (Math.abs(Math.atan2(dy, dx) * 3 + Math.hypot(dx, dy) * 6) % 3 < 0.8 ? -1 : 0) + (px + py === 0 ? 0 : 0));
};

function hairBack(c: PixelCanvas, k: Kit, g: Geo): void {
  const h = hairOf(k);
  const v = g.view;
  const sway = g.pose.sway;
  const covered = hatCovers(k);
  if (v === 'down') {
    slab(c, k, g, h, false);
    if (h.id === 'highpony' && !covered) {
      // Over the crown and down behind the head, showing past its side.
      const cr = crownOf(k, g);
      tail(c, k, [{ x: g.hx + 1, y: cr + 0.5 }, { x: g.hx + 5.5, y: cr + 1 }, { x: g.hx + 6.8, y: g.hy + 2.5 }, { x: g.hx + 6.3 + sway * 1.6, y: g.hy + 7.5 }], 1.9, 1.1, 'straight', false);
    }
    if (h.id === 'ponytail') tail(c, k, [{ x: g.hx + 4.5, y: g.hy + 1.5 }, { x: g.hx + 6.2, y: g.hy + 4 }, { x: g.hx + 6 + sway, y: g.hy + 7.5 }], 1.6, 1, 'soft', false);
  } else if (v === 'up') {
    slab(c, k, g, h, true);
  } else {
    slab(c, k, g, h, false);
    if (h.id === 'braid') braid(c, k, { x: g.hx + 4.6, y: g.hy + 2.5 }, { x: g.hx + 5.4 + sway * 1.2, y: g.hy + 12 });
  }
}

function hairFront(c: PixelCanvas, k: Kit, g: Geo): void {
  const h = hairOf(k);
  const v = g.view;
  const sway = g.pose.sway;
  const covered = hatCovers(k);
  const hood = id(HATS, k.a.hat) === 'hood';
  cap(c, k, g, h, hood ? g.hy + 2 : Infinity);
  const cr = crownOf(k, g);
  // Extras: tails, buns, braids, spikes.
  switch (h.id) {
    case 'spiky':
      if (covered) break;
      c.part();
      for (let i = -2; i <= 2; i++) {
        const bx = g.hx + i * 2.1 + (v === 'side' ? 1 : 0);
        const tip = { x: bx + i * 0.7 + (v === 'side' ? 1.2 : 0), y: cr - 1.6 + Math.abs(i) * 0.7 };
        c.capsule(bx, cr + 1.4, tip.x, tip.y, 1.3, 0.35, k.hair, { bias: i < 0 ? 1 : 0 });
      }
      break;
    case 'tousled':
      if (covered) break;
      c.part();
      for (const [dx, r] of [
        [-2.5, 1.4],
        [0.5, 1.6],
        [3, 1.2],
      ])
        c.ellipse(g.hx + dx, cr + 0.6, r, 1.1, k.hair, { bias: dx < 0 ? 1 : 0 });
      break;
    case 'swept':
      if (covered) break;
      c.part();
      c.ellipse(g.hx + (v === 'side' ? -2.2 : -1.2), cr + 0.9, 2.8, 1.7, k.hair, { bias: 1 });
      break;
    case 'bun':
      if (covered) break;
      if (v === 'side') bun(c, k, g.hx + 2.4, cr + 0.2, 2.5);
      else bun(c, k, g.hx, cr - 0.7, 2.7);
      break;
    case 'spacebuns':
      if (covered) break;
      if (v === 'side') bun(c, k, g.hx + 1, cr + 0.4, 2.2);
      else {
        bun(c, k, g.hx - 3.9, cr + 0.6, 2.2);
        bun(c, k, g.hx + 3.9, cr + 0.6, 2.2);
      }
      break;
    case 'pigtails':
      if (v === 'side') tail(c, k, [{ x: g.hx + 2, y: g.hy - 0.5 }, { x: g.hx + 3.2, y: g.hy + 3.5 }, { x: g.hx + 3 + sway * 1.5, y: g.hy + 9 }], 1.7, 1, 'straight');
      else
        for (const s of [-1, 1]) tail(c, k, [{ x: g.hx + s * 5.6, y: g.hy - 0.4 }, { x: g.hx + s * 6.9, y: g.hy + 3 }, { x: g.hx + s * 6.4 + sway * 1.5, y: g.hy + 8.8 }], 1.75, 1, 'straight');
      break;
    case 'ponytail':
      if (v === 'up') tail(c, k, [{ x: g.hx, y: g.hy + 1 }, { x: g.hx + 0.4, y: g.hy + 4.5 }, { x: g.hx + sway * 1.6, y: g.hy + 9 }], 1.9, 1.1, 'soft');
      else if (v === 'side') tail(c, k, [{ x: g.hx + 4.6, y: g.hy - 1.2 }, { x: g.hx + 6.6, y: g.hy + 2 }, { x: g.hx + 6.2 + sway * 1.5, y: g.hy + 7.4 }], 1.8, 1, 'soft');
      break;
    case 'highpony':
      if (covered) break;
      if (v === 'up') tail(c, k, [{ x: g.hx, y: cr + 1.4 }, { x: g.hx + 0.5, y: g.hy + 2 }, { x: g.hx + sway * 1.6, y: g.hy + 8.5 }], 2, 1.1, 'straight');
      else if (v === 'side') tail(c, k, [{ x: g.hx + 2.6, y: cr + 0.8 }, { x: g.hx + 5.8, y: cr + 1.5 }, { x: g.hx + 7.2, y: g.hy + 3 }, { x: g.hx + 6.6 + sway * 1.5, y: g.hy + 7.5 }], 1.9, 1, 'straight');
      else {
        c.part();
        c.ellipse(g.hx + 0.6, cr + 0.6, 1.6, 0.9, k.trim);
      }
      break;
    case 'braid':
      if (v === 'down') braid(c, k, { x: g.hx - 4.4, y: g.hy + 2.6 }, { x: g.hx - 5 + sway, y: g.hy + 12.5 });
      else if (v === 'up') braid(c, k, { x: g.hx, y: g.hy + 3.6 }, { x: g.hx + sway * 1.4, y: g.hy + 13 });
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------- hats

/** Hats that hide what stands up from the crown (buns, spikes, a high tail). */
const COVERING = new Set(['beanie', 'sunhat', 'witch', 'cap', 'beret', 'tophat', 'frog', 'mushroom', 'hood', 'bucket', 'flatcap']);
const hatCovers = (k: Kit) => COVERING.has(id(HATS, k.a.hat));

/** A dome over the head from `top` down to `rim`, `half` wide at the rim. */
function dome(c: PixelCanvas, cx: number, top: number, rim: number, half: number, m: Material, bias?: (x: number, y: number, dx: number, dy: number) => number): void {
  c.part();
  const ry = rim - top;
  for (let y = Math.floor(top); y <= Math.ceil(rim); y++) {
    for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
      const dx = (x + 0.5 - cx) / half;
      const dy = (y + 0.5 - rim) / ry;
      if (dy > 0.05 || dx * dx + dy * dy > 1) continue;
      c.px(x, y, m, sphere(dx, Math.max(-1, dy), 1), bias ? { bias: bias(x, y, dx, dy) } : undefined);
    }
  }
}

/** A brim: a flat ellipse, darker underneath where it shades itself. */
function brim(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, m: Material, droop = 0): void {
  c.part();
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + droop + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const yy = y + 0.5 - cy - droop * dx * dx;
      const dy = yy / ry;
      if (dx * dx + dy * dy > 1) continue;
      c.px(x, y, m, { x: dx * 0.3, y: -0.75 + Math.max(0, dy) * 0.3, z: 0.6 }, { bias: dy > 0.35 ? -1 : 0 });
    }
  }
}

function flower(c: PixelCanvas, x: number, y: number, petal: Material, heart: Material): void {
  for (const [dx, dy] of [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
  ])
    c.px(x + dx, y + dy, petal, sphere(dx * 0.6, dy * 0.6));
  c.px(x, y, heart, FLAT, { bias: 1 });
}

const PETALS = ['#f6a8c0', '#fff4e0', '#ffd36a', '#b9a4f0', '#f58a7a'];

function hat(c: PixelCanvas, k: Kit, g: Geo): void {
  const kind = id(HATS, k.a.hat);
  if (kind === 'none') return;
  const v = g.view;
  const side = v === 'side';
  const front = v === 'down';
  const cr = crownOf(k, g);
  const hx = side ? g.hx + 0.6 : g.hx;
  const M = k.hat;
  const T = k.trim;
  const rim = g.hy - 3.4;
  switch (kind) {
    case 'beanie': {
      dome(c, hx, cr - 1.2, rim + 0.4, 6.1, M, (x, y) => ((x + (y >> 1)) % 2 === 0 ? -1 : 0) * (y > rim - 2 ? 0 : 1) + (y > rim - 2 ? (x % 2 ? -1 : 0) : 0));
      c.part();
      rows(c, rim - 1.6, rim + 0.4, () => [hx - 6.3, hx + 6.3], M, (_x, _y, t) => cyl(t, 0.1), (x) => (x % 2 ? -1 : 1));
      c.part();
      blob(c, hx + (side ? 1 : 0), cr - 2, 1.7, 1.6, T, (x, y) => ((x + y) % 2 ? 0 : -1));
      break;
    }
    case 'sunhat': {
      const cy = rim - 0.4;
      if (!front) brim(c, hx, cy, side ? 8.8 : 9.6, side ? 1.3 : 1.9, M, 0.6);
      dome(c, hx, cr - 1.6, cy, 4.8, M, (x, y) => ((x * 2 + y) % 3 === 0 ? -1 : 0));
      c.part();
      rows(c, cy - 1.4, cy - 0.4, () => [hx - 4.8, hx + 4.8], T, (_x, _y, t) => cyl(t, 0.1));
      if (front) brim(c, hx, cy + 0.2, 9.6, 1.8, M, 0.6);
      flower(c, Math.round(hx + (side ? 2.5 : 3.4)), Math.round(cy - 1.4), flat(PETALS[0]), k.gold);
      break;
    }
    case 'witch': {
      const cy = rim - 0.3;
      brim(c, hx, cy, side ? 8 : 8.6, side ? 1.2 : 1.6, M, 0.3);
      c.part();
      const tipY = cr - 8.5;
      rows(
        c,
        tipY,
        cy - 0.5,
        (y) => {
          const u = (y - tipY) / (cy - 0.5 - tipY);
          const bend = (1 - u) * (1 - u) * 3.2;
          const half = 0.5 + u * 4.4;
          return [hx - half + bend, hx + half + bend];
        },
        M,
        (_x, _y, t) => cyl(t, 0.2),
      );
      c.part();
      rows(c, cy - 2.2, cy - 0.8, (y) => [hx - 4.3 - (y - cy + 2.2) * 0.1, hx + 4.3 + (y - cy + 2.2) * 0.1], T, (_x, _y, t) => cyl(t, 0.1));
      {
        c.part();
        const bx = Math.round(hx - (side ? 3 : 0.5));
        const by = Math.round(cy - 2.2);
        c.px(bx, by, k.gold, FLAT, { bias: 1 });
        c.px(bx + 1, by, k.gold, FLAT);
        c.px(bx, by + 1, k.gold, FLAT);
        c.px(bx + 1, by + 1, k.gold, FLAT, { bias: -1 });
      }
      break;
    }
    case 'flowers': {
      // A crown of little flowers on leaves, round the head.
      c.part();
      const n = side ? 4 : front ? 6 : 5;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = side ? g.hx - 3.5 + t * 7 : g.hx - 5.2 + t * 10.4;
        const y = cr + 2 + (side ? t * 1.5 : Math.sin(t * Math.PI) * -1.1 + 0.6);
        c.px(Math.round(x) - 1, Math.round(y) + 1, k.leaf, FLAT);
        c.px(Math.round(x) + 1, Math.round(y) + 1, k.leaf, FLAT, { bias: -1 });
      }
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = side ? g.hx - 3.5 + t * 7 : g.hx - 5.2 + t * 10.4;
        const y = cr + 2 + (side ? t * 1.5 : Math.sin(t * Math.PI) * -1.1 + 0.6);
        const petal = i % 2 ? M : flat(PETALS[(i + k.a.hatColor) % PETALS.length]);
        flower(c, Math.round(x), Math.round(y), petal, k.gold);
      }
      break;
    }
    case 'cap': {
      dome(c, hx, cr - 0.8, rim + 0.2, 6, M, (_x, _y, dx) => (Math.abs(dx) < 0.08 ? -1 : 0));
      c.part();
      if (front) brim(c, hx, rim + 0.6, 4.8, 1.3, T);
      else if (side) {
        c.part();
        rows(c, rim - 0.6, rim + 0.6, (y) => [hx - 9.4 + (y - rim) * 0.6, hx - 3.5], T, () => ({ x: 0, y: -0.7, z: 0.7 }), (_x, y) => (y > rim ? -1 : 0));
      } else {
        c.part();
        c.ellipse(hx, rim - 0.5, 1.6, 0.8, k.skin, { bias: -1 });
      }
      c.part();
      c.px(Math.round(hx - 0.5), Math.round(cr - 0.8), T, FLAT, { bias: 1 });
      break;
    }
    case 'beret': {
      c.part();
      blob(c, hx + (side ? -0.5 : 1), cr + 0.6, 6.6, 2.5, M, (x, y) => ((x + y * 2) % 5 === 0 ? -1 : 0), undefined, 1.4);
      c.part();
      rows(c, cr + 2.4, cr + 3.2, () => [hx - 5.2, hx + 5.2], M, (_x, _y, t) => cyl(t, 0), () => -1);
      c.px(Math.round(hx + (side ? 0 : 1.5)), Math.round(cr - 2), M, FLAT, { bias: 1 });
      break;
    }
    case 'tophat': {
      const cy = rim - 0.6;
      brim(c, hx, cy, side ? 6.6 : 7, side ? 1 : 1.3, M);
      c.part();
      rows(c, cr - 6, cy - 0.6, () => [hx - 4.2, hx + 4.2], M, (_x, _y, t) => cyl(t, 0.1));
      c.part();
      c.ellipse(hx, cr - 6, 4.2, 1, M, { normal: () => ({ x: 0, y: -0.8, z: 0.6 }), bias: 1 });
      c.part();
      rows(c, cy - 2.4, cy - 1, () => [hx - 4.2, hx + 4.2], T, (_x, _y, t) => cyl(t, 0.1));
      break;
    }
    case 'catears':
    case 'bunny': {
      // A headband with ears on it.
      c.part();
      if (!side) for (let x = Math.round(hx - 5); x <= Math.round(hx + 4); x++) {
        const dx = (x + 0.5 - hx) / 5.6;
        c.px(x, Math.round(cr + 1.5 + dx * dx * 2.5), M, FLAT, { bias: dx < 0 ? 1 : 0 });
      }
      const inner = flat('#f6b0c0');
      const xs = side ? [hx + 0.5] : [hx - 3.6, hx + 3.6];
      xs.forEach((x, i) => {
        c.part();
        const tilt = side ? 1.4 : i ? 1 : -1;
        if (kind === 'catears') {
          rows(c, cr - 2.6, cr + 1.6, (y) => {
            const u = (y - (cr - 2.6)) / 4.2;
            const half = 0.4 + u * 1.9;
            const lean = (1 - u) * tilt * 0.8;
            return [x - half + lean, x + half + lean];
          }, M, (_x, _y, t) => cyl(t, 0.3));
          if (front) for (let y = 0; y < 2; y++) c.px(Math.round(x - 0.5 + tilt * 0.3), Math.round(cr - 0.4 + y), inner, FLAT);
        } else {
          const bend = !side && i === 1 ? 1 : 0;
          const tip = { x: x + tilt * 0.8 + bend * 2, y: cr - 7 + bend * 2.5 };
          c.capsule(x, cr + 1.2, tip.x, tip.y, 1.5, 1.2, M);
          if (front) c.capsule(x, cr + 0.6, tip.x, tip.y + 1, 0.5, 0.5, inner);
        }
      });
      break;
    }
    case 'bow': {
      c.part();
      const bx = hx + (side ? 1.5 : 3);
      const by = cr + 1;
      c.ellipse(bx - 2, by, 2, 1.5, M, { bias: 1 });
      c.ellipse(bx + 2, by, 2, 1.5, M);
      c.part();
      c.ellipse(bx, by, 0.9, 1, M, { bias: -1 });
      c.px(Math.round(bx - 1.5), Math.round(by + 1.8), M, FLAT, { bias: -1 });
      c.px(Math.round(bx + 1), Math.round(by + 1.8), M, FLAT, { bias: -1 });
      break;
    }
    case 'frog': {
      dome(c, hx, cr - 0.6, rim + 0.6, 6.2, M);
      const eye = side ? [hx - 1.5] : [hx - 3.1, hx + 3.1];
      for (const ex of eye) {
        c.part();
        c.ellipse(ex, cr - 0.9, 1.9, 1.7, M);
        c.part();
        c.ellipse(ex, cr - 1.1, 1.2, 1.1, k.white);
        c.px(Math.round(ex - 0.5), Math.round(cr - 1.2), k.lash, FLAT);
      }
      if (front) for (let x = -2; x <= 1; x++) c.px(Math.round(hx + x), Math.round(rim - 1.4 + (Math.abs(x + 0.5) > 1 ? -1 : 0)), flat(shade(k.hatC, -0.4)), FLAT);
      break;
    }
    case 'mushroom': {
      const cy = rim - 0.2;
      dome(c, hx, cr - 2.8, cy, 8.2, M);
      c.part();
      rows(c, cy - 0.6, cy + 0.6, () => [hx - 7.4, hx + 7.4], k.linen, (_x, _y, t) => cyl(t, -0.4), (x) => (x % 2 ? -1 : 0));
      for (const [dx, dy, r] of [
        [-4.2, -2.6, 1.3],
        [0.6, -4.4, 1.5],
        [4.6, -1.6, 1.1],
        [-1.6, -0.9, 0.9],
      ]) {
        c.part();
        c.ellipse(hx + dx * (side ? 0.8 : 1), cy + dy, r, r * 0.85, k.linen);
      }
      break;
    }
    case 'crown': {
      c.part();
      const base = cr + 1.4;
      rows(c, base - 1.2, base + 0.8, () => [hx - 4.6, hx + 4.6], k.gold, (_x, _y, t) => cyl(t, 0.1));
      const pts = side ? [-3, 0, 3] : [-4, -2, 0, 2, 4];
      for (const dx of pts) {
        const h = dx === 0 ? 3 : Math.abs(dx) === 2 ? 2 : 2.4;
        for (let y = 0; y < h; y++) c.px(Math.round(hx + dx - 0.5), Math.round(base - 1.2 - y - 1), k.gold, cyl(dx / 5), { bias: y === h - 1 ? 1 : 0 });
      }
      c.part();
      const gem = mat(k.hatC, { shine: true, emissive: 0.25 });
      for (const dx of side ? [0] : [-2.5, 0, 2.5]) c.px(Math.round(hx + dx - 0.5), Math.round(base - 0.4), gem, FLAT, { bias: 1 });
      break;
    }
    case 'halo': {
      // A ring of light floating over the head.
      const gl = flat('#fff2b0', 1);
      const cy = cr - 2.2;
      const rx = side ? 3 : 4.4;
      const ry = side ? 1 : 1.2;
      c.part();
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const x = Math.round(hx + Math.cos(a) * rx - 0.5);
        const y = Math.round(cy + Math.sin(a) * ry - 0.5);
        c.px(x, y, gl, FLAT, { glow: 1 });
        c.spark(x, y - 1, [255, 230, 150], 0.35);
      }
      break;
    }
    case 'headphones': {
      c.part();
      if (!side) {
        for (let x = Math.round(hx - 5.6); x <= Math.round(hx + 4.6); x++) {
          const dx = (x + 0.5 - hx) / 5.8;
          c.px(x, Math.round(cr + 0.2 + dx * dx * 4.2), M, FLAT, { bias: dx < 0 ? 1 : 0 });
        }
        for (const s of [-1, 1]) {
          c.part();
          c.ellipse(g.hx + s * 5.9, g.hy + 0.7, 1.6, 2.2, M);
          c.ellipse(g.hx + s * 6.5, g.hy + 0.7, 0.6, 1.2, T);
        }
      } else {
        for (let y = Math.round(cr + 0.4); y <= Math.round(g.hy); y++) c.px(Math.round(g.hx + 1.4), y, M, FLAT);
        c.part();
        c.ellipse(g.hx + 1.6, g.hy + 0.9, 2, 2.3, M);
        c.ellipse(g.hx + 1.4, g.hy + 0.9, 1, 1.3, T);
      }
      break;
    }
    case 'bucket': {
      dome(c, hx, cr - 0.4, rim - 0.4, 5.6, M, (x, y) => ((x + y) % 4 === 0 ? -1 : 0));
      if (front) {
        c.part();
        rows(c, rim - 0.6, rim + 1.2, (y) => {
          const u = (y - rim + 0.6) / 1.8;
          return [hx - 5.8 - u * 1.6, hx + 5.8 + u * 1.6];
        }, M, (_x, _y, t) => cyl(t, -0.2), (_x, y) => (y > rim + 0.6 ? -1 : 0));
      } else brim(c, hx, rim - 0.2, side ? 7 : 7.4, 1.3, M, 0.8);
      break;
    }
    case 'flatcap': {
      c.part();
      blob(c, hx + (side ? -1 : 0), cr + 1, 6.2, 2.6, M, (x, y) => ((x * 3 + y) % 4 === 0 ? -1 : 0), (_x, y) => y < rim + 0.2, 1.3);
      if (front) brim(c, hx, rim + 0.2, 4.6, 1, M);
      else if (side) {
        c.part();
        rows(c, rim - 0.6, rim + 0.4, () => [hx - 8, hx - 4], M, () => ({ x: 0, y: -0.6, z: 0.8 }), (_x, y) => (y > rim ? -1 : 0));
      }
      break;
    }
    case 'hood': {
      // A soft hood up: round the head, the face showing through the front.
      const cy = g.hy - 0.2 - hairOf(k).vol * 0.3;
      const rx = (side ? 6 : 6.7) + hairOf(k).vol * 0.4;
      const ry = 6.6 + hairOf(k).vol * 0.4;
      c.part();
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(hx - rx - 1); x <= Math.ceil(hx + rx + 1); x++) {
          const dx = (x + 0.5 - hx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy > 1) continue;
          if (front) {
            const fx = (x + 0.5 - g.hx) / 4.6;
            const fy = (y + 0.5 - g.hy - 1.2) / 4.9;
            if (fx * fx + fy * fy < 1) continue;
          } else if (side) {
            const fx = (x + 0.5 - (g.hx - 3.2)) / 3.4;
            const fy = (y + 0.5 - g.hy - 1) / 4.8;
            if (fx * fx + fy * fy < 1) continue;
          }
          const lip = front && (() => {
            const fx = (x + 0.5 - g.hx) / 5.6;
            const fy = (y + 0.5 - g.hy - 1.2) / 5.9;
            return fx * fx + fy * fy < 1;
          })();
          c.px(x, y, M, sphere(dx, dy, 1), { bias: lip ? 1 : (y > cy + ry * 0.6 ? -1 : 0) });
        }
      if (!front) {
        // The point of the hood falls down the back.
        c.part();
        c.capsule(hx + (side ? 3 : 0), cy + 3, hx + (side ? 5 : 0), cy + 8, 2.2, 0.8, M, { bias: -1 });
      }
      break;
    }
    case 'bandana': {
      c.part();
      rows(c, rim - 1.6, rim, () => [g.hx - 5.9, g.hx + 5.9], M, (_x, _y, t) => cyl(t, 0.2), (x, y) => ((x + y) % 3 === 0 ? 1 : 0));
      if (side || v === 'up') {
        c.part();
        const kx = side ? g.hx + 5.4 : g.hx + 2;
        c.capsule(kx, rim - 0.8, kx + 1.8, rim + 2.6, 1, 0.6, M, { bias: -1 });
        c.capsule(kx, rim - 0.8, kx + 0.4, rim + 3.4, 1, 0.6, M);
      }
      for (let x = Math.round(g.hx - 5); x <= Math.round(g.hx + 5); x += 3) if (c.materialAt(x, Math.round(rim - 1)) === M) c.px(x, Math.round(rim - 1), k.linen, FLAT);
      break;
    }
    case 'foxmask': {
      // A fox mask pushed up to the side of the head, the way it's worn at a festival.
      if (v === 'up') break;
      const mx = side ? g.hx + 0.8 : g.hx + 3.2;
      const my = cr + 1.6;
      c.part();
      c.ellipse(mx, my, 2.9, 2.5, k.linen);
      c.capsule(mx - 1.8, my - 1.6, mx - 2.6, my - 3.8, 1, 0.3, k.linen);
      c.capsule(mx + 1.8, my - 1.6, mx + 2.6, my - 3.8, 1, 0.3, k.linen);
      c.part();
      c.px(Math.round(mx - 2), Math.round(my - 0.5), M, FLAT);
      c.px(Math.round(mx + 1), Math.round(my - 0.5), M, FLAT);
      c.px(Math.round(mx - 0.5), Math.round(my + 1.3), M, FLAT, { bias: -1 });
      c.px(Math.round(mx - 2.6), Math.round(my - 3), M, FLAT);
      c.px(Math.round(mx + 2.1), Math.round(my - 3), M, FLAT);
      break;
    }
    case 'antlers': {
      c.part();
      const bone = mat('#d9c6a4');
      for (const s of side ? [1] : [-1, 1]) {
        const bx = (side ? g.hx + 0.5 : g.hx + s * 3) - 0.5;
        const by = cr + 1.2;
        const dir = side ? 0.5 : s;
        c.line(bx, by, bx + dir * 2, by - 4, bone, () => cyl(-0.3));
        c.line(bx + dir * 2, by - 4, bx + dir * 3.5, by - 6.5, bone, () => cyl(0));
        c.line(bx + dir * 1, by - 2, bx + dir * 3.5, by - 3, bone, () => cyl(0.2));
        c.line(bx + dir * 2.4, by - 4.8, bx + dir * 1.2, by - 7, bone, () => cyl(-0.2));
        if (!side) c.px(bx + dir * 3, by - 3.5, k.leaf, FLAT);
      }
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------- the face: glasses and earrings

function faceGear(c: PixelCanvas, k: Kit, g: Geo): void {
  const v = g.view;
  if (v === 'up') return;
  const hx = Math.round(g.hx);
  const ey = eyeRow(g);
  const side = v === 'side';
  const gl = id(GLASSES, k.a.glasses);
  const frame = flat('#3a2a2e');
  const gold = k.gold;
  const ring = (x0: number, m: Material) => {
    // A 4 x 4 rim with its corners rounded off.
    for (let d = 1; d <= 2; d++) {
      c.px(x0 + d, ey - 1, m, FLAT);
      c.px(x0 + d, ey + 2, m, FLAT);
      c.px(x0, ey - 1 + d, m, FLAT);
      c.px(x0 + 3, ey - 1 + d, m, FLAT);
    }
  };
  const fill = (x0: number, m: Material) => {
    for (let y = ey; y <= ey + 1; y++) for (let x = x0 + 1; x <= x0 + 2; x++) c.px(x, y, m, FLAT);
  };
  c.part();
  if (gl === 'round' || gl === 'square' || gl === 'shades') {
    const m = gl === 'round' ? gold : frame;
    if (side) {
      ring(hx - 5, m);
      if (gl === 'shades') fill(hx - 5, flat('#24202c'));
      for (let x = hx - 1; x <= hx + 1; x++) c.px(x, ey, m, FLAT);
    } else {
      for (const x0 of [hx - 4, hx + 1]) {
        if (gl === 'square') {
          for (let d = 0; d <= 3; d++) {
            c.px(x0 + d, ey - 1, m, FLAT);
            c.px(x0 + d, ey + 2, m, FLAT);
          }
          c.px(x0, ey, m, FLAT);
          c.px(x0, ey + 1, m, FLAT);
          c.px(x0 + 3, ey, m, FLAT);
          c.px(x0 + 3, ey + 1, m, FLAT);
        } else ring(x0, m);
        if (gl === 'shades') {
          fill(x0, flat('#24202c'));
          c.px(x0 + 1, ey, flat('#6a6480'), FLAT);
        }
      }
      c.px(hx, ey, m, FLAT);
      c.px(hx - 5, ey, m, FLAT);
      c.px(hx + 5, ey, m, FLAT);
    }
  } else if (gl === 'hearts') {
    const pink = flat('#ff6f9c');
    const hl = flat('#ffc2d6');
    const heart = (x0: number) => {
      c.px(x0, ey - 1, pink, FLAT);
      c.px(x0 + 2, ey - 1, pink, FLAT);
      for (let x = x0 - 0; x <= x0 + 2; x++) c.px(x, ey, pink, FLAT);
      c.px(x0 + 1, ey + 1, pink, FLAT);
      c.px(x0, ey - 1, hl, FLAT);
    };
    if (side) heart(hx - 5);
    else {
      heart(hx - 4);
      heart(hx + 2);
      c.px(hx - 1, ey, frame, FLAT);
      c.px(hx + 1, ey, frame, FLAT);
    }
  } else if (gl === 'monocle') {
    const x0 = side ? hx - 5 : hx + 1;
    ring(x0, gold);
    // The chain down to the collar.
    for (let i = 1; i <= 4; i++) c.px(x0 + 3 + (i > 2 ? 1 : 0), ey + 1 + i, gold, FLAT, { bias: i % 2 ? 0 : -1 });
  } else if (gl === 'patch') {
    const x0 = side ? hx - 4 : hx - 4;
    for (let y = ey - 1; y <= ey + 1; y++) for (let x = x0; x <= x0 + 2; x++) c.px(x, y, frame, sphere((x - x0 - 1) / 2, (y - ey) / 2));
    if (!side) for (let x = x0 + 3; x <= hx + 5; x++) c.px(x, ey - 2 - (x > hx + 2 ? 1 : 0), frame, FLAT);
  }
  const ear = id(EARRINGS, k.a.earrings);
  if (ear === 'none') return;
  const ears = side ? [{ x: Math.round(g.hx + 1.4), y: Math.round(g.hy + 2.2) }] : [{ x: hx - 6, y: Math.round(g.hy + 2.2) }, { x: hx + 5, y: Math.round(g.hy + 2.2) }];
  for (const e of ears) {
    if (ear === 'studs') c.px(e.x, e.y, gold, FLAT, { bias: 1 });
    else if (ear === 'hoops') {
      c.px(e.x, e.y, gold, FLAT);
      c.px(e.x - 1, e.y + 1, gold, FLAT, { bias: 1 });
      c.px(e.x + 1, e.y + 1, gold, FLAT, { bias: -1 });
      c.px(e.x, e.y + 2, gold, FLAT, { bias: -1 });
    } else {
      c.px(e.x, e.y, gold, FLAT);
      c.px(e.x, e.y + 1, mat('#fff6ec', { shine: true }), sphere(-0.4, -0.4), { bias: 1 });
    }
  }
}

// ---------------------------------------------------------------- round the neck

function neck(c: PixelCanvas, k: Kit, g: Geo): void {
  const kind = id(NECKS, k.a.neck);
  const back = id(BACKS, k.a.back);
  const v = g.view;
  const side = v === 'side';
  const front = v === 'down';
  const cx = g.cx;
  const sh = g.sh;
  // Straps of what's carried on the back, over the shoulders.
  if (front && (back === 'backpack' || back === 'satchel' || back === 'guitar')) {
    c.part();
    const strap = back === 'backpack' ? k.leather : back === 'guitar' ? k.leather : k.back;
    if (back === 'backpack') {
      for (const s of [-1, 1]) for (let y = Math.round(sh); y <= Math.round(sh + 5); y++) c.px(Math.round(cx + s * 2.6 - 0.5 + (y > sh + 3 ? s * 0.6 : 0)), y, strap, cyl(s * 0.3), { bias: y === Math.round(sh) ? 1 : 0 });
    } else {
      // A strap across the chest, shoulder to hip.
      const dir = back === 'guitar' ? 1 : -1;
      for (let i = 0; i <= 9; i++) {
        const x = cx + dir * (3.2 - i * 0.78);
        const y = sh + 0.3 + i * (g.hip - sh) / 9;
        c.px(Math.round(x - 0.5), Math.round(y), strap, FLAT, { bias: i === 0 ? 1 : 0 });
      }
    }
  }
  if (back === 'cape' && !side) {
    c.part();
    c.px(Math.round(cx - 3), Math.round(sh), k.gold, FLAT, { bias: 1 });
    c.px(Math.round(cx + 2), Math.round(sh), k.gold, FLAT, { bias: 1 });
  }
  if (kind === 'none') return;
  const N = k.neck;
  c.part();
  switch (kind) {
    case 'scarf': {
      // Wound twice round, a tail hanging in front (or behind, from the back).
      rows(c, sh - 1.4, sh + 1, (y) => {
        const half = (side ? 2.6 : 3.9) + (y > sh - 0.4 ? 0.4 : 0);
        return [cx - half + (side ? -0.2 : 0), cx + half + (side ? 0.8 : 0)];
      }, N, (_x, _y, t) => cyl(t, 0.2), (x, y) => ((x + y) % 2 ? 0 : -1) + (y === Math.round(sh) ? -1 : 0));
      c.part();
      const tx = side ? cx - 1.6 : v === 'up' ? cx + 1.6 : cx - 1.8;
      rows(c, sh + 0.6, sh + 6 + g.pose.sway * 0.5, (y) => [tx - 1.2 + (y - sh) * 0.06, tx + 1.2 + (y - sh) * 0.06], N, (_x, _y, t) => cyl(t, 0.1), (x, y) => ((x + y) % 2 ? 0 : -1));
      const fy = Math.round(sh + 6 + g.pose.sway * 0.5);
      for (let x = Math.round(tx - 1.2); x < Math.round(tx + 1.2); x++) c.px(x, fy + 1, N, FLAT, { bias: (x % 2) - 1 });
      break;
    }
    case 'bowtie': {
      if (!front && !side) break;
      const y = Math.round(sh);
      const x = Math.round(cx) - (side ? 2 : 0);
      if (side) {
        c.px(x, y, N, FLAT);
        c.px(x, y + 1, N, FLAT, { bias: -1 });
        break;
      }
      for (const [dx, dy, b] of [
        [-3, 0, 1],
        [-2, 0, 1],
        [-3, 1, 0],
        [-2, 1, 0],
        [1, 0, 0],
        [2, 0, 0],
        [1, 1, -1],
        [2, 1, -1],
        [-1, 0, 0],
        [0, 0, 0],
        [-1, 1, -1],
        [0, 1, -1],
      ])
        c.px(x + dx, y + dy, N, FLAT, { bias: b });
      c.px(x - 1, y, N, FLAT, { bias: 1 });
      break;
    }
    case 'bandana': {
      if (!front) {
        rows(c, sh - 0.6, sh + 0.6, () => [cx - (side ? 2.6 : 3.6), cx + (side ? 3.2 : 3.6)], N, (_x, _y, t) => cyl(t));
        break;
      }
      rows(c, sh - 0.6, sh + 3.6, (y) => {
        const u = (y - sh + 0.6) / 4.2;
        const half = 3.8 * (1 - u) + 0.3;
        return [cx - half, cx + half];
      }, N, (_x, _y, t, u) => cyl(t, 0.3 - u * 0.4), (x, y) => ((x * 2 + y) % 5 === 0 ? 1 : 0));
      break;
    }
    case 'pendant':
    case 'pearls':
    case 'lei': {
      if (v === 'up') {
        if (kind === 'lei') rows(c, sh - 0.6, sh + 0.8, () => [cx - 3.8, cx + 3.8], N, (_x, _y, t) => cyl(t));
        else for (let x = Math.round(cx - 2); x <= Math.round(cx + 1); x++) c.px(x, Math.round(sh - 0.5), kind === 'pearls' ? k.linen : k.gold, FLAT);
        break;
      }
      const deep = kind === 'pendant' ? 3.2 : kind === 'pearls' ? 2.2 : 2.6;
      const half = side ? 1.8 : 3.4;
      const n = side ? 4 : 9;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = (side ? cx - 2 : cx - half) + t * half * 2 - 0.5;
        const y = sh + Math.sin(t * Math.PI) * deep - 0.3;
        if (kind === 'lei') {
          const petal = flat(PETALS[(i + k.a.neckColor) % PETALS.length]);
          c.px(Math.round(x), Math.round(y), i % 3 === 0 ? N : petal, sphere(0, -0.3));
          c.px(Math.round(x), Math.round(y) + 1, i % 3 === 0 ? N : petal, sphere(0, 0.5), { bias: -1 });
        } else c.px(Math.round(x), Math.round(y), kind === 'pearls' ? mat('#fbf4ec', { shine: true }) : k.gold, sphere(0, -0.5), { bias: i % 2 ? 0 : 1 });
      }
      if (kind === 'pendant' && !side) {
        const gem = mat(k.neckC, { shine: true, emissive: 0.35 });
        const px = Math.round(cx - 0.5);
        const py = Math.round(sh + deep + 0.4);
        c.px(px, py, gem, sphere(-0.3, -0.3), { bias: 1 });
        c.px(px, py + 1, gem, sphere(0, 0.5));
      }
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------- on the back

/** A wing: a fan of feathers (or a membrane) from the shoulder out to `tip`. */
function wing(c: PixelCanvas, root: P, tip: P, low: P, m: Material, kind: 'feather' | 'butterfly' | 'fairy', accent: Material, s: number): void {
  c.part();
  if (kind === 'feather') {
    // Rows of feathers: long ones along the bottom edge, coverts up top.
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const ex = tip.x + (low.x - tip.x) * t;
      const ey = tip.y + (low.y - tip.y) * t;
      c.capsule(root.x, root.y, ex, ey, 1.5, 1.1 - t * 0.2, m, { bias: i % 2 ? -1 : 0 });
    }
    c.capsule(root.x, root.y, tip.x - s * 0.5, tip.y + 1, 2, 1.2, m, { bias: 1 });
    return;
  }
  // Two lobes, an upper and a lower, outlined and patterned.
  const up = { x: root.x + (tip.x - root.x), y: tip.y };
  const dn = { x: root.x + (low.x - root.x) * 0.8, y: low.y };
  c.ellipse((root.x + up.x) / 2, (root.y + up.y) / 2, Math.abs(up.x - root.x) / 2 + 1.2, Math.abs(up.y - root.y) / 2 + 1.4, m);
  c.ellipse((root.x + dn.x) / 2, (root.y + dn.y) / 2 + 0.5, Math.abs(dn.x - root.x) / 2 + 0.9, Math.abs(dn.y - root.y) / 2 + 0.9, m, { bias: -1 });
  c.part();
  c.ellipse((root.x + up.x * 2) / 3, (root.y + up.y * 2) / 3, 0.9, 0.9, accent);
  if (kind === 'fairy') {
    const x = Math.round((root.x + up.x) / 2);
    const y = Math.round((root.y + up.y) / 2);
    c.spark(x, y, [255, 255, 255], 0.5);
    c.spark(x + s, y + 3, [220, 240, 255], 0.4);
  }
}

function behind(c: PixelCanvas, k: Kit, g: Geo): void {
  const kind = id(BACKS, k.a.back);
  if (kind === 'none') return;
  const v = g.view;
  const side = v === 'side';
  const up = v === 'up';
  const cx = g.cx;
  const sh = g.sh;
  const B = k.back;
  const flap = Math.sin(g.pose.flap * Math.PI * 2);
  switch (kind) {
    case 'angel':
    case 'butterfly':
    case 'fairy': {
      const m = kind === 'angel' ? mat('#fbf7ef') : kind === 'fairy' ? mat(shade(k.backC, 0.25), { emissive: 0.45, noAO: true }) : B;
      const accent = kind === 'butterfly' ? flat(shade(k.backC, -0.45)) : kind === 'fairy' ? flat('#ffffff', 0.8) : m;
      const ws = kind === 'angel' ? 1 : 0.85;
      const lift = flap * 1.4;
      const sides = side ? [1] : [-1, 1];
      for (const s of sides) {
        const rx = side ? cx + 2.2 : cx + s * 1.4;
        const root = { x: rx, y: sh + 2 };
        const reach = side ? 6.5 : 9.5 * ws;
        const tip = { x: rx + s * reach, y: sh - 3.5 * ws - lift };
        const low = { x: rx + s * (reach - 3), y: sh + 7.5 * ws - lift * 0.4 };
        wing(c, root, tip, low, m, kind === 'angel' ? 'feather' : kind, accent, s);
      }
      break;
    }
    case 'cape': {
      c.part();
      const sway = g.pose.sway * 1.6;
      const end = g.pose.sit ? g.hip + 3 : 29.6;
      if (side) {
        rows(c, sh, end, (y) => {
          const u = (y - sh) / (end - sh);
          return [cx + 1 + u * 0.6 + sway * u, cx + k.dep + 1.4 + u * 2.6 + sway * u];
        }, B, (_x, _y, t) => cyl(t, 0.1), (_x, y, t) => (t > 0.5 ? -1 : 0) + (y > end - 1 ? -1 : 0));
      } else {
        rows(c, sh, end, (y) => {
          const u = (y - sh) / (end - sh);
          const half = k.sw + 0.6 + u * 2.4;
          return [cx - half + sway * u, cx + half + sway * u];
        }, B, (_x, _y, t) => cyl(t, 0.15), (x, y) => (up ? ((x + 1) % 3 === 0 ? -1 : 0) : -1) + (y > end - 1 ? -1 : 0));
        if (up) for (let x = Math.round(cx - 4); x <= Math.round(cx + 3); x++) c.px(x, Math.round(sh), k.trim, cyl((x + 0.5 - cx) / 4));
      }
      break;
    }
    case 'backpack': {
      if (v === 'down') break;
      c.part();
      if (up) {
        rows(c, sh + 1, sh + 8.5, () => [cx - 3.8, cx + 3.8], B, (_x, _y, t, u) => cyl(t, 0.4 - u * 0.5));
        c.part();
        rows(c, sh + 0.6, sh + 3.4, (y) => [cx - 3.9 + (y - sh) * 0.1, cx + 3.9 - (y - sh) * 0.1], k.trim, (_x, _y, t) => cyl(t, 0.5));
        c.px(Math.round(cx - 0.5), Math.round(sh + 3.6), k.gold, FLAT, { bias: 1 });
        c.part();
        rows(c, sh + 5, sh + 7.6, () => [cx - 2, cx + 2], B, (_x, _y, t) => cyl(t, 0.2), () => -1);
      } else {
        rows(c, sh + 1, sh + 8, () => [cx + k.dep - 0.2, cx + k.dep + 3.4], B, (_x, _y, t) => cyl(t, 0.3));
        c.part();
        rows(c, sh + 0.6, sh + 3.2, () => [cx + k.dep - 0.4, cx + k.dep + 3.6], k.trim, (_x, _y, t) => cyl(t, 0.5));
      }
      break;
    }
    case 'satchel': {
      // The bag rides on the hip, so most of it shows from the front.
      c.part();
      const bx = side ? cx + 1 : up ? cx - 4.6 : cx + 4.6;
      const by = g.hip - 1;
      rows(c, by, by + 3.6, () => [bx - 2.2, bx + 2.2], B, (_x, _y, t, u) => cyl(t, 0.3 - u * 0.4));
      c.part();
      rows(c, by - 0.2, by + 1.4, () => [bx - 2.3, bx + 2.3], k.leather, (_x, _y, t) => cyl(t, 0.5));
      c.px(Math.round(bx - 0.5), Math.round(by + 1.4), k.gold, FLAT, { bias: 1 });
      if (up) for (let i = 0; i <= 8; i++) c.px(Math.round(cx + 3 - i * 0.8 - 0.5), Math.round(sh + 0.3 + i * (by - sh) / 8), k.back, FLAT);
      break;
    }
    case 'guitar': {
      c.part();
      const wood = k.back;
      const along = (t: number): P => (up ? { x: cx - 4 + t * 7, y: sh - 4 + t * 13 } : side ? { x: cx + 3 + t * 1.6, y: sh - 4.5 + t * 12 } : { x: cx - 5.4 + t * 2.2, y: sh - 5 + t * 6 });
      if (v === 'down') {
        // Only the neck and head show over the shoulder.
        const a = along(0);
        const b = along(1);
        c.line(a.x, a.y, b.x, b.y, k.wood, () => cyl(-0.2));
        c.ellipse(a.x - 0.2, a.y - 0.6, 1, 1.1, k.leather);
        break;
      }
      const a = along(0);
      const b = along(1);
      c.line(a.x, a.y, a.x + (b.x - a.x) * 0.5, a.y + (b.y - a.y) * 0.5, k.wood, () => cyl(0));
      c.part();
      c.ellipse(a.x + (b.x - a.x) * 0.62, a.y + (b.y - a.y) * 0.62, 2.4, 2.2, wood);
      c.ellipse(a.x + (b.x - a.x) * 0.88, a.y + (b.y - a.y) * 0.88, 3, 2.8, wood);
      c.part();
      c.ellipse(a.x - 0.2, a.y - 0.6, 1, 1.1, k.leather);
      break;
    }
    case 'cattail':
    case 'foxtail': {
      const sway = g.pose.sway * 2 + Math.sin(g.pose.flap * Math.PI * 2) * 0.8;
      const root = side ? { x: cx + k.dep, y: g.hip } : { x: cx + (up ? 0 : 1.5), y: g.hip + 0.5 };
      const s = side ? 1 : up ? 1 : 1;
      const pts: P[] =
        kind === 'cattail'
          ? [root, { x: root.x + s * 4, y: root.y + 2 }, { x: root.x + s * 6.6 + sway, y: root.y - 1.5 }, { x: root.x + s * 6 + sway, y: root.y - 5 }]
          : [root, { x: root.x + s * 4.2, y: root.y + 1.2 }, { x: root.x + s * 6.6 + sway, y: root.y - 1.6 }];
      const fur = k.back;
      c.part();
      if (kind === 'cattail') for (let i = 0; i < pts.length - 1; i++) c.capsule(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 1, 0.9, fur);
      else {
        c.capsule(pts[0].x, pts[0].y, pts[1].x, pts[1].y, 1.2, 2.4, fur);
        c.capsule(pts[1].x, pts[1].y, pts[2].x, pts[2].y, 2.4, 1.6, fur);
        c.part();
        c.ellipse(pts[2].x, pts[2].y, 1.7, 1.6, k.linen);
      }
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------- in hand

function held(c: PixelCanvas, k: Kit, g: Geo): void {
  const kind = id(HELD, k.a.held);
  const p = g.pose;
  if (kind === 'none' || !p.carry) return;
  const v = g.view;
  const side = v === 'side';
  const h = g.hands[side ? 0 : p.hold];
  const s = side ? -1 : p.hold ? 1 : -1;
  const x = h.x;
  const y = h.y;
  const M = k.held;
  const warm: RGB = [255, 214, 140];
  c.part();
  switch (kind) {
    case 'lantern': {
      const ly = y + 1.4;
      c.line(x - 0.5, y + 0.2, x - 0.5, ly, k.gold);
      c.part();
      c.ellipse(x, ly + 0.4, 1.6, 0.6, M);
      rows(c, ly + 0.8, ly + 3.6, () => [x - 1.5, x + 1.5], flat('#ffd98a', 0.95), () => FLAT, (_x, yy) => (yy === Math.round(ly + 2) ? 1 : 0));
      c.ellipse(x, ly + 4, 1.7, 0.6, M, { bias: -1 });
      for (const dx of [-1.5, 0.5]) for (let yy = Math.round(ly + 1); yy <= Math.round(ly + 3.4); yy++) c.px(Math.round(x + dx - 0.5) + (dx > 0 ? 1 : 0), yy, M, FLAT, { bias: -1 });
      c.spark(Math.round(x - 0.5), Math.round(ly + 2), warm, 1);
      c.spark(Math.round(x - 0.5), Math.round(ly + 1), warm, 0.5);
      break;
    }
    case 'paperlantern': {
      const top = { x: x + s * 1.5, y: y - 5 };
      c.line(x - 0.5, y, top.x, top.y, k.wood);
      c.part();
      const glow = mat(shade(k.heldC, 0.25), { emissive: 0.85, noAO: true });
      c.ellipse(top.x + s * 0.5, top.y + 3, 2.2, 2.4, glow);
      for (let dx = -1; dx <= 1; dx++) c.px(Math.round(top.x + s * 0.5 + dx - 0.5), Math.round(top.y + 3), glow, FLAT, { bias: -1 });
      c.px(Math.round(top.x + s * 0.5 - 0.5), Math.round(top.y + 0.6), k.gold, FLAT);
      c.spark(Math.round(top.x + s * 0.5 - 0.5), Math.round(top.y + 3), warm, 0.8);
      break;
    }
    case 'bouquet': {
      c.capsule(x, y + 1.6, x + s * 0.4, y - 1, 1.2, 1.8, M);
      for (const [dx, dy, i] of [
        [-1.4, -2.6, 0],
        [1.2, -2.8, 1],
        [0, -3.8, 2],
        [-0.4, -1.8, 3],
        [1.6, -1.6, 4],
      ]) {
        c.part();
        c.ellipse(x + dx, y + dy, 1.1, 1, flat(PETALS[(i + k.a.heldColor) % PETALS.length]), { bias: 0 });
        c.px(Math.round(x + dx - 0.5), Math.round(y + dy - 0.5), k.gold, FLAT);
      }
      c.px(Math.round(x - 2.5), Math.round(y - 1.4), k.leaf, FLAT);
      c.px(Math.round(x + 2.5), Math.round(y - 2), k.leaf, FLAT);
      break;
    }
    case 'wateringcan': {
      const bx = x + s * 1.2;
      const by = y + 2.6;
      rows(c, by - 1.6, by + 1.6, () => [bx - 2, bx + 2], M, (_x, _y, t, u) => cyl(t, 0.4 - u * 0.6));
      c.line(bx + s * 2, by, bx + s * 4, by - 2.4, M, () => cyl(0.3));
      c.px(Math.round(bx + s * 4.4 - 0.5), Math.round(by - 2.8), M, FLAT, { bias: 1 });
      c.line(x - 0.5, y, bx - s * 1.5, by - 1.6, M);
      break;
    }
    case 'book': {
      rows(c, y - 1.6, y + 1.8, () => [x - 1.8, x + 1.8], M, () => ({ x: s * 0.3, y: -0.2, z: 0.9 }));
      for (let yy = Math.round(y - 1); yy <= Math.round(y + 1); yy++) c.px(Math.round(x + s * 1.8 - (s > 0 ? 1 : 0)), yy, k.linen, FLAT);
      c.px(Math.round(x - 0.5), Math.round(y - 0.6), k.gold, FLAT);
      break;
    }
    case 'teacup':
    case 'mug': {
      const cy = y - 1.2;
      if (kind === 'teacup') c.ellipse(x, cy + 1.6, 2.2, 0.6, k.linen, { bias: -1 });
      c.part();
      rows(c, cy - 1.2, cy + 1.2, () => [x - 1.5, x + 1.5], kind === 'mug' ? M : k.linen, (_x, _y, t) => cyl(t, 0.1));
      c.ellipse(x, cy - 1.2, 1.5, 0.5, flat('#8a5a3a'));
      c.px(Math.round(x + s * 2 - 0.5), Math.round(cy), kind === 'mug' ? M : k.linen, FLAT);
      if (kind === 'teacup') c.px(Math.round(x - 0.5), Math.round(cy + 0.3), M, FLAT);
      c.spark(Math.round(x - 1), Math.round(cy - 3), [255, 255, 255], 0.3);
      c.spark(Math.round(x), Math.round(cy - 4), [255, 255, 255], 0.22);
      break;
    }
    case 'balloon': {
      const bx = g.hx + s * 6.2;
      const by = g.hy - 8 + Math.sin(p.flap * Math.PI * 2) * 0.6;
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        c.px(Math.round(x + (bx - x) * t + Math.sin(t * 6) * 0.4 - 0.5), Math.round(y + (by + 3 - y) * t), k.linen, FLAT);
      }
      c.part();
      c.ellipse(bx, by, 2.8, 3.2, mat(k.heldC, { shine: true }));
      c.px(Math.round(bx - 0.5), Math.round(by + 3.2), M, FLAT, { bias: -1 });
      c.px(Math.round(bx - 1.5), Math.round(by - 1.5), flat('#ffffff'), FLAT);
      break;
    }
    case 'umbrella': {
      const top = g.hy - 9.6;
      const ux = g.hx + s * 1.2;
      c.line(x - 0.5, y, ux - 0.5, top, k.wood);
      c.part();
      rows(c, top - 3, top + 1, (yy) => {
        const u = (yy - top + 3) / 4;
        const half = 2 + Math.sqrt(Math.max(0, u)) * 7.4;
        return [ux - half, ux + half];
      }, M, (_x, _y, t, u) => sphere(t, -0.6 + u * 0.5), (xx, yy) => (Math.floor((xx - ux + 20) / 3) % 2 ? -1 : 0) + (yy >= Math.floor(top + 1) && (xx + 20) % 3 === 0 ? 9 : 0));
      for (let xx = Math.floor(ux - 9.5); xx <= ux + 9.5; xx++) if ((Math.round(xx - ux) + 30) % 3 === 0 && c.materialAt(xx, Math.round(top + 1)) === M) c.erase(xx, Math.round(top + 1));
      c.px(Math.round(ux - 0.5), Math.round(top - 3.6), k.gold, FLAT);
      break;
    }
    case 'sparkler': {
      const tip = { x: x + s * 2, y: y - 5 };
      c.line(x - 0.5, y, tip.x, tip.y, k.silver);
      const gold: RGB = [255, 236, 170];
      c.spark(Math.round(tip.x), Math.round(tip.y), gold, 1);
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4 + p.flap * 6;
        const r = 1.5 + hsh(i, Math.round(p.flap * 8)) * 2.4;
        c.spark(Math.round(tip.x + Math.cos(a) * r), Math.round(tip.y + Math.sin(a) * r), gold, 0.75);
      }
      break;
    }
    case 'plush':
    case 'kitten': {
      const bx = x + s * 0.4;
      const by = y - 0.4;
      const fur = kind === 'kitten' ? mat(k.heldC) : M;
      c.ellipse(bx, by + 1, 2.2, 2, fur);
      c.part();
      c.ellipse(bx, by - 1.8, 2.1, 1.9, fur);
      if (kind === 'plush') {
        c.ellipse(bx - 1.6, by - 3.4, 0.8, 0.8, fur);
        c.ellipse(bx + 1.6, by - 3.4, 0.8, 0.8, fur);
        c.px(Math.round(bx - 0.5), Math.round(by - 1.2), flat(shade(k.heldC, 0.3)), FLAT);
      } else {
        c.px(Math.round(bx - 2), Math.round(by - 3.8), fur, FLAT, { bias: 1 });
        c.px(Math.round(bx + 1), Math.round(by - 3.8), fur, FLAT);
        c.capsule(bx + s * 2, by + 2, bx + s * 3.4, by - 0.6, 0.6, 0.5, fur);
      }
      if (!side) {
        c.px(Math.round(bx - 1.5), Math.round(by - 2), k.lash, FLAT);
        c.px(Math.round(bx + 0.5), Math.round(by - 2), k.lash, FLAT);
      } else c.px(Math.round(bx - 1.5), Math.round(by - 2), k.lash, FLAT);
      break;
    }
    case 'plant': {
      const pot = mat('#c46a44');
      rows(c, y - 0.6, y + 2.4, (yy) => [x - 2 + (yy - y) * 0.2, x + 2 - (yy - y) * 0.2], pot, (_x, _y, t) => cyl(t, 0.1));
      c.part();
      rows(c, y - 1.2, y - 0.4, () => [x - 2.3, x + 2.3], pot, (_x, _y, t) => cyl(t, 0.4), () => 1);
      c.part();
      for (const [dx, dy] of [
        [-1.6, -2.6],
        [1.4, -3],
        [0, -4.2],
        [-0.4, -2],
      ])
        c.ellipse(x + dx, y + dy, 1.3, 1, k.leaf, { bias: dy < -3 ? 1 : dx < 0 ? 0 : -1 });
      break;
    }
    case 'icecream': {
      const cone = mat('#d9a05c');
      rows(c, y - 1, y + 2.6, (yy) => {
        const u = (yy - y + 1) / 3.6;
        return [x - 1.5 + u * 1.3, x + 1.5 - u * 1.3];
      }, cone, (_x, _y, t) => cyl(t), (xx, yy) => ((xx + yy) % 2 ? -1 : 0));
      c.part();
      c.ellipse(x, y - 2, 1.9, 1.7, M);
      c.part();
      c.px(Math.round(x - 0.5), Math.round(y - 4), flat('#e8344a'), FLAT, { bias: 1 });
      break;
    }
    case 'baguette': {
      const bread = mat('#d8a058');
      c.capsule(x - s * 1.5, y + 2.5, x + s * 2.5, y - 5, 1.1, 1, bread);
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        c.px(Math.round(x - s * 1.5 + s * 4 * t - 0.5), Math.round(y + 2.5 - 7.5 * t), bread, FLAT, { bias: 1 });
      }
      break;
    }
    case 'fan': {
      c.part();
      const fx = x + s * 0.5;
      const fy = y - 0.5;
      for (let yy = Math.floor(fy - 4); yy <= Math.ceil(fy); yy++)
        for (let xx = Math.floor(fx - 4); xx <= Math.ceil(fx + 4); xx++) {
          const dx = xx + 0.5 - fx;
          const dy = yy + 0.5 - fy;
          const r = Math.hypot(dx, dy);
          if (r > 4 || r < 0.8 || dy > 0) continue;
          const ang = Math.atan2(dy, dx);
          c.px(xx, yy, M, { x: Math.cos(ang) * 0.3, y: -0.3, z: 0.9 }, { bias: Math.floor(ang * 3) % 2 ? -1 : 0 });
        }
      c.px(Math.round(fx - 0.5), Math.round(fy), k.wood, FLAT);
      break;
    }
    case 'wand': {
      const tip = { x: x + s * 1.6, y: y - 4.6 };
      c.line(x - 0.5, y, tip.x, tip.y, k.wood);
      c.part();
      const star = mat('#ffe27a', { emissive: 0.8, noAO: true, shine: true });
      const tx = Math.round(tip.x);
      const ty = Math.round(tip.y - 1);
      for (const [dx, dy] of [
        [0, -1],
        [-1, 0],
        [0, 0],
        [1, 0],
        [0, 1],
        [-1, 1],
        [1, 1],
      ])
        c.px(tx + dx, ty + dy, star, sphere(dx * 0.5, dy * 0.5));
      c.spark(tx, ty, [255, 240, 180], 0.8);
      c.spark(tx + 2, ty - 2, [255, 255, 255], 0.5);
      break;
    }
    default:
      break;
  }
  // The fingers round whatever's carried.
  c.part();
  c.ellipse(x, y, 1.1, 1, k.skin);
}

export const GEAR: Layers = {
  behind,
  backHair: hairBack,
  neck,
  hairFront,
  hat,
  face: faceGear,
  held,
  over: () => {},
};

