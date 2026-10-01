// The Wild heroes' effects on the board: the Ranger's arrows, volley and
// Great Arrow; the Windrunner's fans of elven arrows, wind vault and Tempest;
// the Grovekeeper's thorns, bramble grove and Wrath of the Wild; the
// Shapeshifter's wolf claws, wolf leap and Primal Stampede; the Eagle's
// feathers, gust and Sky Sovereign; the Lion's claws, cowing strike and
// King's Roar; the Dragon's fire spit, flame breath and Wrath of the Wyrm.

import {
  angle,
  bolt,
  bump,
  CHEST,
  circle,
  clamp01,
  column,
  dark,
  disc,
  dist,
  dither,
  dot,
  easeIn,
  easeOut,
  FLAT,
  hash,
  HEAD,
  impact,
  lerp,
  line,
  mix,
  orb,
  pool,
  ring,
  shadowOf,
  shock,
  sprite,
  star,
  stroke,
  tail,
  type Cast,
  type Kit,
  type Layers,
  type Pal,
  type Pt,
  type Px,
  type Stage,
} from '../paint';
import { flight, gather, HAND, scorch, smoke } from './common';

// --- Materials and shared drawing ---------------------------------------------------

/** Arrow shafts, light side first. */
const WOOD = [0xc8945a, 0x8a5a32, 0x4a2e1a];
/** Steel arrowheads: the glint, the face, the shadowed barb. */
const STEEL = [0xffffff, 0xc8d0dc, 0x6a7284];
/** Bark and roots, darkest first. */
const BARK = [0x221710, 0x3a2818, 0x5a3e26, 0x7a5a38];
/** Earth thrown up by roots and paws. */
const DIRT = [0x7a5a38, 0x5a3e26, 0xa4703c];
/** A feather's quill. */
const QUILL = 0xf4ecd8;

/** A point `u` px along heading `th` and `v` px across it, from (x, y). */
function along(x: number, y: number, th: number, u: number, v: number): Pt {
  const c = Math.cos(th);
  const s = Math.sin(th);
  return { x: x + c * u - s * v, y: y + s * u + c * v };
}

/** A pixel that fades in a clean checker as `a` falls. */
function pd(px: Px, x: number, y: number, c: number, a = 1): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  if (a < 1 && dither(X, Y) >= a) return;
  px.put(X, Y, c, 1);
}

/** The heading of a flight at k, from just before to just after. */
function heading(pos: (k: number) => Pt, k: number): number {
  const a = pos(k - 0.02);
  const b = pos(k + 0.02);
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/**
 * A real arrow, its tip at (x, y) pointing along `th`: a barbed head, a
 * wooden shaft `len` long, and two fletching vanes swept back at the nock.
 * `bury` hides that many px of its front (stuck in a foe or the ground).
 */
function arrow(px: Px, x: number, y: number, th: number, len: number, head: number[], vane: number, edge: number, a = 1, bury = 0, shaft = WOOD): void {
  const P = (u: number, v: number, c: number) => {
    if (-u < bury) return;
    const q = along(x, y, th, u, v);
    pd(px, q.x, q.y, c, a);
  };
  // The head: a little leaf of steel with barbs flaring at its back.
  P(0, 0, head[0]);
  P(-0.7, 0, head[0]);
  for (const s of [-1, 1]) {
    P(-1.4, 0.7 * s, head[1]);
    P(-2.2, 1.1 * s, head[1]);
    P(-2.9, 1.5 * s, head[2]);
  }
  P(-1.6, 0, head[0]);
  P(-2.4, 0, head[1]);
  // The shaft.
  for (let u = -3; u >= -len; u -= 0.5) P(u, 0, u > -len * 0.5 ? shaft[1] : shaft[0]);
  // The fletching: two vanes, wider toward the nock.
  const f0 = -len + 3.5;
  for (let u = f0; u >= -len; u -= 0.5) {
    const w = 1 + ((f0 - u) / 3.5) * 1.1;
    for (const s of [-1, 1]) {
      for (let v = 0.8; v <= w; v += 0.6) P(u, v * s, v > w - 0.6 ? edge : vane);
    }
  }
  P(-len - 0.6, 0, shaft[2]);
}

/** A feather, its tip at (x, y) along `th`: a pale quill and a vane widest near the front, its edge in the deep colour. */
function feather(px: Px, x: number, y: number, th: number, len: number, p: Pal, a = 1): void {
  for (let u = 0; u >= -len; u -= 0.5) {
    const f = -u / len;
    const w = f < 0.85 ? Math.sin(Math.min(1, (f + 0.12) * 1.4) * Math.PI * 0.5 + 0.3) * 1.8 * (1 - f * 0.35) : 0;
    for (let v = -w; v <= w + 0.01; v += 0.5) {
      if (Math.abs(v) < 0.4) continue;
      const q = along(x, y, th, u, v);
      pd(px, q.x, q.y, Math.abs(v) > w - 0.6 ? p.deep : v < 0 ? p.hot : p.mid, a);
    }
    const q = along(x, y, th, u, 0);
    pd(px, q.x, q.y, f < 0.15 ? p.core : QUILL, a);
  }
}

/**
 * Three parallel claw streaks across (x, y), slanting along `th`, `len` long:
 * they rip across in the first part of `k`, white-hot at their front, then
 * thin and dither away.
 */
function rakes(px: Px, x: number, y: number, th: number, len: number, p: Pal, k: number, gap = 3.2): void {
  const reach = easeOut(Math.min(1, k / 0.35));
  const fade = tail(k, 0.45);
  for (let i = -1; i <= 1; i++) {
    const L = len * (i === 0 ? 1 : 0.82);
    const off = i * 1.5;
    for (let u = 0; u <= L * reach; u += 0.5) {
      const f = u / L;
      const w = bump(f);
      const q = along(x, y, th, u - L / 2 + off, i * gap);
      const front = reach < 1 && f > reach - 0.2;
      pd(px, q.x, q.y, front ? p.core : w > 0.55 ? p.hot : p.mid, fade);
      if (w > 0.45) {
        const r = along(x, y, th, u - L / 2 + off, i * gap + 1);
        pd(px, r.x, r.y, w > 0.8 ? p.mid : p.deep, fade * 0.9);
      }
    }
  }
}

/** A curling streak of wind, its head at (x, y) blowing along `th`, `len` long, its tail hooked `curl` px aside. */
function gustLine(px: Px, x: number, y: number, th: number, len: number, curl: number, p: Pal, a = 1): void {
  const n = Math.ceil(len * 1.5);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const q = along(x, y, th, -f * len, Math.sin(f * Math.PI * 0.9) * curl * f);
    pd(px, q.x, q.y, f < 0.2 ? p.core : f < 0.55 ? p.hot : p.mid, a * (1 - f * 0.55));
  }
}

/** A small leaf, 3 px along `th`. */
function leaf(px: Px, x: number, y: number, th: number, p: Pal, a = 1): void {
  const q = (u: number, v: number) => along(x, y, th, u, v);
  const pts: [number, number, number][] = [
    [1.2, 0, p.hot],
    [0, 0, p.mid],
    [-1.2, 0, p.deep],
    [0, 0.9, p.mid],
  ];
  for (const [u, v, c] of pts) {
    const r = q(u, v);
    pd(px, r.x, r.y, c, a);
  }
}

/** A flame licking up from (x, y): a little column that flickers. */
function lick(px: Px, x: number, y: number, h: number, w: number, p: Pal, t: number, a = 1): void {
  column(px, x + Math.sin(t * 23 + x) * 0.6, y, h * (0.8 + 0.2 * Math.sin(t * 31 + y)), w, p, a, t);
}

/** Flames clinging to a foe for `dur` s (a burn), shedding embers. */
function burning(s: Stage, at: Pt, p: Pal, dur = 1): void {
  const seed = Math.random() * 10;
  s.add(dur, (L, k, t) => {
    const a = tail(k, 0.6);
    for (let i = 0; i < 2; i++) {
      const ox = (i ? 3 : -3) + Math.sin(t * 4 + i + seed) * 1.5;
      lick(L.air, at.x + ox, at.y - 6 - i * 5, 6 + 2 * i, 1.4, p, t + i, a);
    }
    L.light(at.x, at.y - 10, 18, p.light, 0.4 * a);
  });
  s.sparks(at.x, at.y, 4, [p.hot, p.mid, p.deep], { speed: 6, up: 24, g: -10, life: 0.6, z: 10, spread: 6 });
}

/** Little stars wheeling over a dazed foe. */
function dazed(s: Stage, at: Pt, p: Pal, dur: number): void {
  s.add(dur, (L, k, t) => {
    const a = tail(k, 0.75);
    for (let i = 0; i < 3; i++) {
      const th = t * 7 + (i / 3) * Math.PI * 2;
      const x = at.x + Math.cos(th) * 6;
      const y = at.y - HEAD - 3 + Math.sin(th) * 2;
      pd(L.air, x, y, p.core, a);
      pd(L.air, x + 1, y, p.hot, a);
      pd(L.air, x - 1, y, p.hot, a);
      pd(L.air, x, y - 1, p.mid, a);
    }
  });
}

/** A hop of dust from the ground. */
function dust(s: Stage, at: Pt, n: number, speed = 18): void {
  s.sparks(at.x, at.y, n, DIRT, { speed, up: 18, g: 70, life: 0.45, z: 1, ground: true, spread: 4 });
}

/** Run `go` after `wait` s. */
function later(s: Stage, wait: number, go: () => void): void {
  s.add(0.001, () => {}, Math.max(0, wait), go);
}

/** How far along a line from `a` to `b` the point `h` stands, 0..1. */
function fractionAlong(a: Pt, b: Pt, h: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  return clamp01(((h.x - a.x) * dx + (h.y - a.y) * dy) / l2);
}

// --- The Ranger -------------------------------------------------------------------------

/** An arrow quivering where it struck, its head buried, then fading. */
function stuckArrow(s: Stage, at: Pt, th: number, p: Pal, low = false): void {
  const y = low ? at.y : at.y - CHEST;
  s.add(0.45, (L, k, t) => {
    const q = th + Math.sin(t * 70) * 0.12 * (1 - k);
    arrow(L.air, at.x, y, q, 9, STEEL, p.mid, p.deep, tail(k, 0.5), 3.5);
  });
}

/** A plain hunting arrow, green-fletched, with a whisper of air behind it. */
function rangerShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 2);
  let th = angle(a, b);
  s.add(dur, (L, k) => {
    const q = pos(k);
    th = heading(pos, k);
    for (let i = 1; i <= 4; i++) {
      const r = along(q.x, q.y, th, -9 - i * 2.2, 0);
      pd(L.air, r.x, r.y, p.mid, 0.7 - i * 0.15);
    }
    arrow(L.air, q.x, q.y, th, 9, STEEL, p.mid, p.deep);
    L.light(q.x, q.y, 10, p.light, 0.3);
  }, 0, () => {
    stuckArrow(s, b, th, p);
    s.add(0.14, (L, k) => star(L.air, b.x, b.y - CHEST, 2, p, 1 - k));
    s.sparks(b.x, b.y, 4, [WOOD[0], p.hot, p.mid, STEEL[1]], { speed: 24, up: 18, z: CHEST, life: 0.3 });
  });
}

/** One volley arrow falling from the sky at a slant onto `at`, landing after `dur`, then stuck in the ground. */
function fallingArrow(s: Stage, at: Pt, dir: number, p: Pal, dur: number, wait: number, seed: number): void {
  const jx = (hash(seed, 1) - 0.5) * 7;
  const jy = (hash(seed, 2) - 0.5) * 3;
  const end = { x: at.x + jx, y: at.y + jy };
  const back = 16;
  const start = { x: end.x - Math.cos(dir) * back, y: end.y - Math.sin(dir) * back * FLAT - 56 };
  const th = Math.atan2(end.y - start.y, end.x - start.x);
  s.add(dur, (L, k) => {
    const e = easeIn(k);
    const x = lerp(start.x, end.x, e);
    const y = lerp(start.y, end.y, e);
    shadowOf(L.ground, end.x, end.y, 3, k);
    arrow(L.air, x, y, th, 9, STEEL, p.mid, p.deep);
    // A streak of speed above it.
    for (let i = 1; i <= 3; i++) {
      const r = along(x, y, th, -9 - i * 3, 0);
      pd(L.air, r.x, r.y, p.hot, 0.6 - i * 0.15);
    }
  }, wait, () => {
    s.add(0.6, (L, k, t) => {
      const q = th + Math.sin(t * 60) * 0.1 * (1 - Math.min(1, k * 3));
      arrow(L.air, end.x, end.y, q, 9, STEEL, p.mid, p.deep, tail(k, 0.55), 3);
      if (k < 0.3) ring(L.ground, end.x, end.y, 2 + 5 * easeOut(k / 0.3), 1, p, 1 - k / 0.3);
    });
    dust(s, end, 3, 14);
    impact(s, at, p, 0.45);
  });
}

/** The Volley: three arrows loosed high into the sky, then a rain of arrows hammering the marked ground. */
const volley = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(14, c.r);
    // The marked ground: a broken ring tightening on the spot.
    s.add(c.lead + c.span + 0.2, (L, k, t) => {
      const a = Math.min(1, k * 5) * tail(k, 0.8);
      ring(L.ground, c.at.x, c.at.y, R * (1.15 - 0.15 * easeOut(Math.min(1, k * 3))), 1, p, a, 0.45, Math.floor(t * 6));
    });
    // Arrows loosed steeply up, out of sight.
    for (let i = 0; i < 3; i++) {
      const lean = (i - 1) * 0.18 + Math.sign(c.at.x - c.from.x) * 0.15;
      s.add(0.22, (L, k) => {
        const e = easeOut(k);
        const x = c.from.x + lean * 60 * e;
        const y = c.from.y - HAND - 70 * e;
        arrow(L.air, x, y, -Math.PI / 2 + lean, 9, STEEL, p.mid, p.deep, 1 - k * 0.6);
      }, i * 0.07);
    }
    s.add(0.3, (L, k) => L.light(c.from.x, c.from.y - HAND, 18, p.light, 0.5 * (1 - k)));
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const dir = angle(c.from, c.at);
    const n = Math.max(1, c.path.length);
    c.path.forEach((h, i) => {
      const land = Math.max(0.12, (c.span * i) / n);
      const dur = Math.min(0.16, land);
      fallingArrow(s, h, dir, p, dur, land - dur, i * 7 + 1);
    });
  },
};

/** A great spectral arrow: a glowing shaft in the palette, a broad head, deep vanes. */
function greatArrow(px: Px, x: number, y: number, th: number, p: Pal, a: number): void {
  const b = along(x, y, th, -22, 0);
  const f = along(x, y, th, -3, 0);
  stroke(px, b.x, b.y, f.x, f.y, 0.9, p, a);
  for (let u = 0; u >= -7; u -= 0.5) {
    const hw = (-u / 7) * 3.2;
    for (let v = -hw; v <= hw; v += 0.5) {
      const q = along(x, y, th, u, v);
      pd(px, q.x, q.y, Math.abs(v) < 0.8 ? p.core : Math.abs(v) < 2 ? p.hot : p.mid, a);
    }
  }
  for (const s of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const q0 = along(x, y, th, -18 - i * 2, 0);
      const q1 = along(x, y, th, -23 - i * 2, 4 * s);
      line(px, q0.x, q0.y, q1.x, q1.y, i === 0 ? p.mid : p.deep, a);
    }
}

/** The Great Arrow: the gale gathers into one huge arrow on the string, then it tears down the whole line and through every foe on it. */
const greatArrowMove = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    const seed = Math.random() * 100;
    s.add(c.lead, (L, k, t) => {
      // The arrow forming on the string, drawn back.
      const hand = along(c.from.x, c.from.y - HAND, th, 6 - 5 * easeOut(k), 0);
      greatArrow(L.air, hand.x, hand.y, th, p, Math.min(1, k * 1.6));
      // Wind pulled into it from all round.
      for (let i = 0; i < 8; i++) {
        const life = (k * 2 + hash(i, seed)) % 1;
        const a0 = hash(i, seed, 1) * Math.PI * 2 + t * 3;
        const d = (1 - easeOut(life)) * 22 + 3;
        const x = hand.x + Math.cos(a0) * d;
        const y = hand.y + Math.sin(a0) * d * 0.7;
        gustLine(L.air, x, y, a0 + Math.PI * 0.6, 5, 2, p, 1 - life * 0.5);
      }
      circle(L.ground, c.from.x, c.from.y, 9 + 2 * Math.sin(t * 12), p.mid, k, FLAT, t * 4, t * 4 + Math.PI * 1.2);
      L.light(hand.x, hand.y, 20 + 24 * k, p.light, 0.7 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const storm = c.look === 'storm';
    const a = { x: c.from.x, y: c.from.y - HAND };
    const b = { x: c.at.x, y: c.at.y - CHEST };
    const th = Math.atan2(b.y - a.y, b.x - a.x);
    const fly = 0.26;
    s.shake(110, 0.003);
    s.add(fly + 0.45, (L, k, t) => {
      const go = Math.min(1, (k * (fly + 0.45)) / fly);
      const x = lerp(a.x, b.x, go);
      const y = lerp(a.y, b.y, go);
      const fade = go < 1 ? 1 : 1 - (k * (fly + 0.45) - fly) / 0.45;
      // A scored line on the ground behind it.
      for (let i = 0; i < 24; i++) {
        const f = i / 24;
        if (f > go) break;
        const gx = lerp(c.from.x, c.at.x, f);
        const gy = lerp(c.from.y, c.at.y, f);
        pd(L.ground, gx, gy + 1, p.deep, fade * 0.8);
        if (i % 2) pd(L.ground, gx, gy - 1, p.mid, fade * 0.6);
      }
      // The gale: two strands of wind twisting round its wake.
      const wake = Math.min(46, dist(a, b) * go);
      for (const side of [-1, 1]) {
        for (let d = 6; d < wake; d += 1) {
          const v = Math.sin(d * 0.32 - t * 28 + side * Math.PI) * 4 * Math.min(1, d / 14);
          const q = along(x, y, th, -d, v);
          pd(L.air, q.x, q.y, d < 18 ? p.hot : p.mid, fade * (1 - d / 50));
        }
      }
      if (storm) {
        const seed = Math.floor(t * 22);
        const q0 = along(x, y, th, -30, 6);
        const q1 = along(x, y, th, -30, -6);
        bolt(L.air, q0.x, q0.y, x, y, p, seed, fade, 0.8);
        bolt(L.air, q1.x, q1.y, x, y, p, seed + 9, fade * 0.8, 0.8);
      }
      if (go < 1) greatArrow(L.air, x, y, th, p, 1);
      else {
        greatArrow(L.air, b.x, b.y, th, p, fade);
        star(L.air, b.x, b.y, Math.round(4 * fade), p, 1);
      }
      L.light(x, y, 40, p.light, 0.9 * fade);
    });
    for (const h of c.hits) {
      const f = fractionAlong(c.from, c.at, h);
      later(s, fly * f, () => {
        impact(s, h, p, 1.1);
        s.sparks(h.x, h.y, 6, [p.core, p.hot, WOOD[0]], { speed: 40, up: 16, z: CHEST, dir: th, cone: 0.5, life: 0.4 });
      });
    }
  },
};

// --- The Windrunner -----------------------------------------------------------------------

/** Elven arrows: white-fletched, a gale-bright head. */
const elfHead = (p: Pal): number[] => [p.core, p.hot, p.mid];

/** A fan of three elven arrows: the middle one strikes, the two beside it veer wide and blow away. */
function fanShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 1);
  const base = angle(a, b);
  const span = dist(a, b);
  let th = base;
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    th = heading(pos, k);
    for (const side of [-1, 1]) {
      if (k > 0.75) continue;
      const sp = base + side * 0.3;
      const d = span * k;
      const x = a.x + Math.cos(sp) * d;
      const y = a.y - CHEST + Math.sin(sp) * d;
      arrow(L.air, x, y, sp, 8, elfHead(p), 0xf4f8ff, p.mid, k < 0.45 ? 1 : 1 - (k - 0.45) / 0.3, 0, [WOOD[0], WOOD[0], WOOD[1]]);
    }
    // A thread of wind spun round the middle arrow.
    for (let i = 2; i <= 9; i++) {
      const r = along(q.x, q.y, th, -8 - i * 1.4, Math.sin(i * 0.9 - t * 30) * 1.5);
      pd(L.air, r.x, r.y, i < 5 ? p.hot : p.mid, 1 - i / 10);
    }
    arrow(L.air, q.x, q.y, th, 8, elfHead(p), 0xf4f8ff, p.mid, 1, 0, [WOOD[0], WOOD[0], WOOD[1]]);
    L.light(q.x, q.y, 12, p.light, 0.4);
  }, 0, () => {
    impact(s, b, p, 0.6);
    s.add(0.25, (L, k) => gustLine(L.air, b.x + Math.cos(th) * (4 + 8 * k), b.y - CHEST + Math.sin(th) * (4 + 8 * k), th, 7, 2, p, 1 - k));
  });
}

/** A whirl of wind round a spot on the ground: arcs turning, a few leaves riding them. */
function windWhirl(L: Layers, x: number, y: number, r: number, t: number, p: Pal, a: number): void {
  for (let i = 0; i < 3; i++) {
    const th0 = t * 9 + (i / 3) * Math.PI * 2;
    circle(L.ground, x, y, r - i * 1.5, i === 0 ? p.hot : p.mid, a, FLAT, th0, th0 + 1.6);
  }
  for (let i = 0; i < 2; i++) {
    const th = -t * 7 + i * Math.PI;
    leaf(L.air, x + Math.cos(th) * r * 0.8, y - 3 - i * 4 + Math.sin(th) * r * 0.4, th + Math.PI / 2, p, a);
  }
}

/** The Wind vault: wind coils at his feet, he springs back in a burst of air, and a gale shot blasts down the line. */
const windVault = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    s.add(c.lead, (L, k, t) => {
      windWhirl(L, c.from.x, c.from.y, 6 + 6 * easeOut(k), t, p, Math.min(1, k * 3));
      L.light(c.from.x, c.from.y - 6, 20, p.light, 0.4 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    // The spring: a ring of air under him and dust thrown out.
    shock(s, c.from, 16, p, 0.35, 1);
    dust(s, c.from, 5, 22);
    const a = { x: c.from.x, y: c.from.y - HAND };
    const b = { x: c.at.x, y: c.at.y - CHEST };
    const len = dist(a, b);
    const fly = 0.2;
    const seed = Math.random() * 50;
    s.add(fly + 0.3, (L, k) => {
      const T = k * (fly + 0.3);
      const go = Math.min(1, T / fly);
      const fade = go < 1 ? 1 : 1 - (T - fly) / 0.3;
      const x = lerp(a.x, b.x, go);
      const y = lerp(a.y, b.y, go);
      // A cone of wind streaks rushing behind the shot.
      for (let i = 0; i < 9; i++) {
        const f = (hash(i, seed) * 0.8 + go * 0.9) % 1;
        if (f > go) continue;
        const v = (hash(i, seed, 2) - 0.5) * 14 * f;
        const q = along(a.x, a.y, th, len * f, v);
        gustLine(L.air, q.x, q.y, th, 6 + 4 * f, (i % 2 ? 1.5 : -1.5), p, fade);
      }
      if (go < 1) arrow(L.air, x, y, th, 8, elfHead(p), 0xf4f8ff, p.mid);
      orb(L.air, x, y, 2 + (go < 1 ? 0 : 3 * (1 - fade)), p, fade);
      L.light(x, y, 26, p.light, 0.7 * fade);
    });
    for (const h of c.hits) {
      later(s, fly * fractionAlong(c.from, c.at, h), () => {
        impact(s, h, p, 0.8);
        // Thrown back: streaks blowing past it.
        s.add(0.3, (L, k) => {
          for (let i = -1; i <= 1; i++) {
            const q = along(h.x, h.y - CHEST + i * 4, th, 4 + 10 * easeOut(k), 0);
            gustLine(L.air, q.x, q.y, th, 6, i, p, 1 - k);
          }
        });
      });
    }
  },
};

/** A cyclone standing on (x, y): bands of wind wound round a funnel widening upward, debris riding it. */
function cyclone(L: Layers, x: number, y: number, h: number, w: number, t: number, p: Pal, a: number): void {
  if (a <= 0) return;
  for (let z = 0; z < h; z += 1) {
    const f = z / h;
    const r = w * (0.22 + 0.78 * Math.pow(f, 0.85));
    const cx = x + Math.sin(t * 9 + f * 3) * 2 * f;
    const cy = y - z;
    // The top frays away in a checker.
    const fa = a * (f > 0.8 ? 1 - (f - 0.8) * 3 : 1);
    const n = Math.max(8, Math.ceil(r * 3.6));
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      // Bands of wind wound slantwise round it, racing round.
      const band = Math.sin(th * 2 - t * 30 + f * 10);
      const front = Math.sin(th) > 0;
      const edge = Math.abs(Math.cos(th)) > 0.92;
      let col: number;
      if (front) col = band > 0.7 ? p.core : band > 0.1 || edge ? p.hot : p.mid;
      else {
        if (band < 0.2) continue;
        col = band > 0.75 ? p.mid : p.deep;
      }
      pd(front ? L.air : L.ground, cx + Math.cos(th) * r, cy + Math.sin(th) * r * 0.28, col, fa);
    }
  }
  // Leaves and grit whirled round it.
  for (let i = 0; i < 6; i++) {
    const f = (i + 0.5) / 6;
    const th = t * (12 - i) + i * 2.3;
    const r = w * (0.4 + 0.7 * f);
    const px = x + Math.cos(th) * r;
    const py = y - h * f + Math.sin(th) * r * 0.3;
    if (i % 2) leaf(Math.sin(th) > 0 ? L.air : L.ground, px, py, th, p, a);
    else pd(L.air, px, py, DIRT[i % 3], a);
  }
  pool(L.ground, x, y, w * 0.9, p.deep, dark(p.deep, 0.3), a * 0.7, 0.5);
}

/** Tempest: three arrows nocked as a wind spirals up round him, loosed as one cyclone that tears down the line, lifting all it touches. */
const tempest = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    s.add(c.lead, (L, k, t) => {
      // A spiral of wind rising round him.
      for (let i = 0; i < 18; i++) {
        const f = ((i / 18) + t * 1.8) % 1;
        const a0 = f * Math.PI * 4 + t * 8;
        const r = 9 - f * 3;
        const x = c.from.x + Math.cos(a0) * r;
        const y = c.from.y - f * 30 + Math.sin(a0) * r * 0.35;
        pd(Math.sin(a0) > 0 ? L.air : L.ground, x, y, f < 0.4 ? p.hot : p.mid, Math.min(1, k * 3) * (1 - f * 0.6));
      }
      // Three arrows fanned on the string.
      for (let i = -1; i <= 1; i++) {
        const q = along(c.from.x, c.from.y - HAND, th + i * 0.28, 9, 0);
        arrow(L.air, q.x, q.y, th + i * 0.28, 8, elfHead(p), 0xf4f8ff, p.mid, Math.min(1, k * 2.5), 0, [WOOD[0], WOOD[0], WOOD[1]]);
      }
      L.light(c.from.x, c.from.y - 14, 24 + 16 * k, p.light, 0.6 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const run = 0.5;
    const life = run + 0.4;
    s.shake(130, 0.003);
    s.add(life, (L, k, t) => {
      const T = k * life;
      const go = easeOut(Math.min(1, T / run));
      const x = lerp(c.from.x, c.at.x, go);
      const y = lerp(c.from.y, c.at.y, go);
      const grow = Math.min(1, T / 0.12);
      const fade = T < run ? 1 : 1 - (T - run) / 0.4;
      cyclone(L, x, y, 32 * grow, 10 * grow, t, p, fade);
      // A track of flattened grass behind it.
      for (let i = 0; i < 16; i++) {
        const f = (i / 16) * go;
        pd(L.ground, lerp(c.from.x, c.at.x, f) + Math.sin(i * 1.7) * 3, lerp(c.from.y, c.at.y, f), p.deep, 0.7 * (1 - k));
      }
      L.light(x, y - 14, 50, p.light, 0.8 * fade);
    });
    // It blows itself out at the end of its run.
    later(s, run, () => {
      shock(s, c.at, 24, p, 0.4, 2);
      s.sparks(c.at.x, c.at.y, 10, [p.core, p.hot, p.mid, DIRT[0]], { speed: 40, up: 30, z: 10, life: 0.5 });
    });
    for (const h of c.hits) {
      later(s, run * Math.min(0.9, fractionAlong(c.from, c.at, h)), () => {
        impact(s, h, p, 0.9);
        // Held aloft in a small whirl while stunned.
        s.add(Math.max(0.4, c.stun), (L, k, t) => {
          const a = tail(k, 0.7);
          for (let i = 0; i < 2; i++) {
            const th = t * 14 + i * Math.PI;
            circle(Math.sin(th) > 0 ? L.air : L.ground, h.x, h.y - 2 - i * 8, 7 - i, i ? p.hot : p.mid, a, 0.35, th, th + 2.2);
          }
        });
      });
    }
  },
};

// --- The Grovekeeper ------------------------------------------------------------------------

/** A thorn flung from the staff: a dark barbed spike with two leaves fluttering after it. */
function thornShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 3);
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    const th = heading(pos, k);
    for (let u = 0; u >= -7; u -= 0.5) {
      const hw = (-u / 7) * 1.4;
      for (let v = -hw; v <= hw + 0.01; v += 0.5) {
        const r = along(q.x, q.y, th, u, v);
        pd(L.air, r.x, r.y, u > -1.5 ? p.core : v < -0.4 ? p.hot : v > 0.4 ? BARK[1] : p.mid, 1);
      }
    }
    // Little barbs along it.
    for (const [u, v] of [[-3, 1.6], [-5, -2]] as const) {
      const r = along(q.x, q.y, th, u, v);
      pd(L.air, r.x, r.y, BARK[2]);
    }
    for (let i = 0; i < 2; i++) {
      const r = pos(k - 0.12 - i * 0.1);
      leaf(L.air, r.x + Math.sin(t * 20 + i) * 2, r.y + Math.cos(t * 16 + i) * 1.5, t * 12 + i * 2, p, 1 - i * 0.3);
    }
    L.light(q.x, q.y, 12, p.light, 0.35);
  }, 0, () => {
    impact(s, b, p, 0.6);
    s.sparks(b.x, b.y, 4, [p.hot, p.mid, p.deep], { speed: 14, up: 20, g: 50, life: 0.6, z: CHEST });
  });
}

/**
 * Brambles coiled round a foe: three thorned vines winding up it, `grow`
 * 0..1, the half behind it drawn under the heroes so the foe stands inside
 * them. `wither` 0..1 browns them as they die back.
 */
function bramble(L: Layers, x: number, y: number, h: number, grow: number, p: Pal, a: number, wither: number, seed: number): void {
  const top = h * grow;
  for (let j = 0; j < 3; j++) {
    for (let z = 0; z <= top; z += 0.6) {
      const th = z * 0.45 + j * 2.1 + seed;
      const r = 6 - (z / h) * 1.5;
      const front = Math.sin(th) > 0;
      const px = x + Math.cos(th) * r;
      const py = y - z + Math.sin(th) * 2;
      let c = front ? (Math.cos(th) < 0 ? p.hot : p.mid) : p.deep;
      if (wither > 0) c = mix(c, BARK[2], wither);
      pd(front ? L.air : L.ground, px, py, c, a);
      // Thorns jutting out on the near side.
      if (front && Math.abs((z % 4) - 2) < 0.31) pd(L.air, px + Math.sign(Math.cos(th)) * 1.4, py - 0.5, BARK[1], a);
    }
    const th = top * 0.45 + j * 2.1 + seed;
    if (grow > 0.2) pd(L.air, x + Math.cos(th) * 4.5, y - top + Math.sin(th) * 2, wither > 0.5 ? BARK[3] : p.core, a);
  }
  if (grow > 0.6) leaf(L.air, x + 5, y - h * 0.55, -0.6, p, a * (1 - wither));
}

/** A foe held in brambles for `hold` s: they wind up it, hold, then brown and fall away. */
function bound(s: Stage, at: Pt, p: Pal, hold: number, h = 16): void {
  const seed = Math.random() * 6;
  s.add(hold, (L, k) => {
    const T = k * hold;
    const grow = easeOut(Math.min(1, T / 0.18));
    const wither = clamp01((k - 0.7) / 0.3);
    bramble(L, at.x, at.y, h, grow, p, 1 - wither * wither, wither, seed);
  });
}

/** Grove: the ground stirs with shoots on the marked spot, then brambles burst up and bind every foe there. */
const grove = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(14, c.r);
    gather(s, c.from, p, Math.min(0.3, c.lead), 0.8);
    const seed = Math.random() * 100;
    s.add(c.lead, (L, k, t) => {
      pool(L.ground, c.at.x, c.at.y, R * easeOut(Math.min(1, k * 2)), p.deep, dark(p.deep, 0.35), Math.min(1, k * 2) * 0.8, 0.6);
      circle(L.ground, c.at.x, c.at.y, R, p.mid, Math.min(1, k * 3), FLAT, t * 2, t * 2 + Math.PI * 2);
      // Shoots pushing up round the ring.
      for (let i = 0; i < 9; i++) {
        if (hash(i, seed) > k * 1.3) continue;
        const th = (i / 9) * Math.PI * 2 + hash(i, seed, 1) * 0.5;
        const d = R * (0.45 + 0.5 * hash(i, seed, 2));
        const x = c.at.x + Math.cos(th) * d;
        const y = c.at.y + Math.sin(th) * d * FLAT;
        const hh = 1 + Math.round(3 * k * hash(i, seed, 3));
        line(L.air, x, y, x + Math.sin(t * 6 + i) * 0.6, y - hh, p.mid, 1);
        pd(L.air, x, y - hh - 1, p.hot);
      }
      L.light(c.at.x, c.at.y - 4, R * 2, p.light, 0.3 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(14, c.r);
    const hold = Math.max(0.8, c.stun || 1);
    // The bramble patch itself, with stems where no foe stands.
    const seed = Math.random() * 100;
    s.add(hold, (L, k) => {
      const a = tail(k, 0.75);
      pool(L.ground, c.at.x, c.at.y, R, p.deep, dark(p.deep, 0.35), a * 0.8, 0.6);
      for (let i = 0; i < 6; i++) {
        const th = (i / 6) * Math.PI * 2 + hash(i, seed);
        const x = c.at.x + Math.cos(th) * R * 0.75;
        const y = c.at.y + Math.sin(th) * R * 0.75 * FLAT;
        const grow = easeOut(Math.min(1, k * 8));
        root(L, x, y, 7 * grow, Math.cos(th) * 0.6, i, p, a, 0.5, false);
      }
      L.light(c.at.x, c.at.y - 6, R * 2.4, p.light, 0.5 * a * (1 - k));
    });
    shock(s, c.at, R, p, 0.35, 1);
    s.sparks(c.at.x, c.at.y, 10, [p.hot, p.mid, DIRT[0], DIRT[1]], { speed: 26, up: 30, g: 80, life: 0.5, z: 2, spread: R * 0.6 });
    for (const h of c.hits) bound(s, h, p, hold);
  },
};

/**
 * A root `h` px tall standing on (x, y): thick and barked at its foot,
 * twisting as it rises, thorns along it, curling over toward `lean` at the
 * top with a glowing tip. `glow` tints its upper part with the palette.
 */
function root(L: Layers, x: number, y: number, h: number, lean: number, phase: number, p: Pal, a: number, glow: number, mound = true): void {
  if (h < 1 || a <= 0) return;
  if (mound) disc(L.ground, x, y + 0.5, 4, 1.8, BARK[0], a);
  let tx = x;
  for (let z = 0; z <= h; z++) {
    const f = z / h;
    const w = 2.4 * Math.pow(1 - f, 0.8) + 0.35;
    const cx = x + Math.sin(z * 0.24 + phase) * 1.6 * f + lean * f * f * 7;
    tx = cx;
    for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
      if (Math.abs(dx) > w + 0.3) continue;
      const u = (dx + w) / (2 * w + 0.01);
      let c = u < 0.3 ? BARK[3] : u < 0.65 ? BARK[2] : BARK[1];
      if (f > 0.55 && glow > 0) c = mix(c, u < 0.4 ? p.hot : p.mid, glow * (f - 0.55) * 2);
      pd(L.air, cx + dx, y - z, c, a);
    }
    // Thorns, one side and then the other.
    if (z % 4 === 2 && f > 0.1 && f < 0.9) {
      const side = (z / 4) % 2 < 1 ? 1 : -1;
      pd(L.air, cx + side * (w + 1), y - z - 1, BARK[0], a);
      pd(L.air, cx + side * (w + 2), y - z - 2, BARK[1], a);
    }
  }
  // The curling tip, glowing.
  const sx = Math.sign(lean) || 1;
  pd(L.air, tx + sx, y - h - 1, p.hot, a);
  pd(L.air, tx + sx * 2, y - h - 0.5, p.core, a);
  if (glow > 0) L.light(tx, y - h, 10, p.light, 0.35 * a * glow);
}

/** Cracks in the ground running out from (x, y): jagged, dark, with green light in them. */
function cracks(L: Layers, x: number, y: number, R: number, grow: number, p: Pal, seed: number, a: number, t: number): void {
  for (let i = 0; i < 7; i++) {
    const th = (i / 7) * Math.PI * 2 + hash(i, seed) * 0.5;
    let px = x;
    let py = y;
    const n = 6;
    for (let j = 1; j <= n; j++) {
      const f = j / n;
      if (f > grow) break;
      const tw = th + (hash(i, j, seed) - 0.5) * 0.9;
      const d = R * f;
      const qx = x + Math.cos(tw) * d;
      const qy = y + Math.sin(tw) * d * FLAT;
      line(L.ground, px, py, qx, qy, 0x140c08, a);
      if (j < n - 1 && 0.5 + 0.5 * Math.sin(t * 10 + i + j) > 0.4) pd(L.ground, (px + qx) / 2, (py + qy) / 2, p.mid, a);
      px = qx;
      py = qy;
    }
  }
}

/** The Wrath of the Wild: the earth splits, then great thorned roots burst up in a spiral, seize everything inside, and crush it. */
const wrath = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(26, c.r);
    gather(s, c.from, p, Math.min(0.4, c.lead), 1.2);
    const seed = Math.random() * 100;
    s.add(c.lead, (L, k, t) => {
      pool(L.ground, c.at.x, c.at.y, R * 0.9 * easeOut(k), dark(p.deep, 0.45), dark(p.deep, 0.2), 0.8, 0.7);
      cracks(L, c.at.x, c.at.y, R, easeOut(k), p, seed, 1, t);
      // The spiral of places the roots will come through, lighting in turn.
      for (let i = 0; i < 11; i++) {
        if (i / 11 > k * 1.2) continue;
        const sp = spiral(c.at, R, i, 11);
        pd(L.ground, sp.x, sp.y, i / 11 > k ? p.mid : p.hot);
        pd(L.ground, sp.x + 1, sp.y, p.deep);
      }
      if (k > 0.5 && Math.random() < 0.25) s.sparks(c.at.x + (Math.random() - 0.5) * R, c.at.y, 1, DIRT, { speed: 6, up: 20, g: 80, life: 0.3, z: 0 });
      L.light(c.at.x, c.at.y - 4, R * 2, p.light, 0.4 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(26, c.r);
    const hold = Math.max(1.1, c.stun || 1.5);
    const crush = hold * 0.62;
    const n = 11;
    const seed = Math.random() * 100;
    s.shake(180, 0.004);
    s.add(hold + 0.35, (L, k, t) => {
      const T = k * (hold + 0.35);
      const fade = T < hold ? 1 : 1 - (T - hold) / 0.35;
      pool(L.ground, c.at.x, c.at.y, R * 0.9, dark(p.deep, 0.45), dark(p.deep, 0.2), fade, 0.7);
      cracks(L, c.at.x, c.at.y, R, 1, p, seed, fade, t);
      for (let i = 0; i < n; i++) {
        const sp = spiral(c.at, R, i, n);
        const born = i * 0.03;
        if (T < born) continue;
        const outer = Math.hypot(sp.x - c.at.x, (sp.y - c.at.y) / FLAT) / R;
        const full = 26 - outer * 10;
        const grow = easeOut(Math.min(1, (T - born) / 0.16));
        // At the crush the roots wrench inward; at the end they sink.
        const squeeze = T > crush ? bump(clamp01((T - crush) / 0.25)) : 0;
        const sink = T > hold ? easeIn((T - hold) / 0.35) : 0;
        const lean = ((sp.x - c.at.x) / R) * (1 - squeeze * 2.2);
        root(L, sp.x, sp.y, full * grow * (1 - sink * 0.8), lean, i * 1.3, p, fade, 1);
      }
      L.light(c.at.x, c.at.y - 12, R * 3, p.light, 0.7 * fade * (T < 0.3 ? 1.4 : 1));
    });
    for (let i = 0; i < n; i++) {
      const sp = spiral(c.at, R, i, n);
      later(s, i * 0.03, () => s.sparks(sp.x, sp.y, 2, [DIRT[0], DIRT[1], p.mid], { speed: 18, up: 34, g: 90, life: 0.5, z: 1 }));
    }
    // The crush.
    later(s, crush, () => {
      shock(s, c.at, R, p, 0.4, 2);
      s.sparks(c.at.x, c.at.y, 14, [p.core, p.hot, p.mid, BARK[3]], { speed: 34, up: 36, g: 70, life: 0.6, z: 8, spread: R * 0.6 });
      for (const h of c.hits) impact(s, h, p, 0.9);
      s.shake(120, 0.003);
    });
    for (const h of c.hits) bound(s, h, p, hold, 18);
  },
};

/** The i-th of n spots on a sunflower spiral filling a circle of R round `at`. */
function spiral(at: Pt, R: number, i: number, n: number): Pt {
  const d = R * 0.92 * Math.sqrt((i + 0.4) / n);
  const th = i * 2.39996;
  return { x: at.x + Math.cos(th) * d, y: at.y + Math.sin(th) * d * FLAT };
}

// --- The Shapeshifter -------------------------------------------------------------------

/** A spirit wolf running to the right, two frames of its gallop. */
const WOLF = [
  [
    '..........h.h..',
    '.........hbbb..',
    'b.......bbbebcc',
    '.hh.hhhhhhhhh..',
    '..bbbbbbbbbb...',
    '...aabbbbbaa...',
    '...a..a..a.a...',
    '..a...a...a..a.',
  ],
  [
    '..........h.h..',
    '.........hbbb..',
    '........bbbebcc',
    'hhh.hhhhhhhhh..',
    '..bbbbbbbbbb...',
    '...aabbbbbaa...',
    '....a.a.a.a....',
    '....a..aa..a...',
  ],
];

/** A spirit stag running to the right, crowned with antlers of light. */
const STAG = [
  [
    '.........c..c.c',
    '..........c.cc.',
    '...........cc..',
    '...........hb..',
    '..........hbbec',
    '..........bb...',
    '..hhhhhhhbb....',
    '.hbbbbbbbbb....',
    '..bbbbbbbbb....',
    '..abbbbbbba....',
    '..a.a...a.a....',
    '..a.a...a.a....',
    '.a..a...a..a...',
  ],
  [
    '.........c..c.c',
    '..........c.cc.',
    '...........cc..',
    '...........hb..',
    '..........hbbec',
    '..........bb...',
    '..hhhhhhhbb....',
    '.hbbbbbbbbb....',
    '..bbbbbbbbb....',
    '..abbbbbbba....',
    '...aa...aa.....',
    '..a..a.a..a....',
    '...............',
  ],
];

const beastCols = (p: Pal): Record<string, number> => ({ a: p.deep, b: p.mid, h: p.hot, c: p.core, e: 0xffffff });

/** A spirit animal on its feet at (x, y), facing along `th`, at frame `f`. */
function spiritBeast(L: Layers, rows: string[][], x: number, y: number, th: number, f: number, p: Pal, a: number, s = 1): void {
  sprite(L.air, x, y, rows[f % rows.length], beastCols(p), a, { flip: Math.cos(th) < -0.05, s });
}

/** A wolf's bite: two jaws of light snapping shut over the foe, fangs flashing. */
function bite(s: Stage, at: Pt, p: Pal): void {
  s.add(0.26, (L, k) => {
    const shut = easeIn(Math.min(1, k / 0.4));
    const a = tail(k, 0.5);
    const cx = at.x;
    const cy = at.y - CHEST;
    const gap = 7 * (1 - shut) + 1;
    for (const s2 of [-1, 1]) {
      const y0 = cy + s2 * gap;
      circle(L.air, cx, y0 - s2 * 2, 8, s2 < 0 ? p.hot : p.mid, a, 0.45, s2 < 0 ? Math.PI * 0.05 : Math.PI * 1.05, s2 < 0 ? Math.PI * 0.95 : Math.PI * 1.95);
      for (const fx of [-4, -1.5, 1.5, 4]) {
        const fy = y0 + s2 * 0.5;
        pd(L.air, cx + fx, fy, p.core, a);
        pd(L.air, cx + fx, fy - s2, 0xffffff, a);
      }
    }
    if (k > 0.35 && k < 0.6) star(L.air, cx, cy, 3, p, 1);
  });
  s.add(0.1, () => {}, 0.1, () => s.sparks(at.x, at.y, 6, p.tints, { speed: 26, up: 22, z: CHEST, life: 0.35 }));
}

/** The wolf's claws: three streaks raked across the foe; the last blow of a combo is a snapping bite. */
function wolfClaw(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  if (heavy) {
    bite(s, at, p);
    return;
  }
  const th = angle(from, at) + Math.PI / 2 + (Math.random() < 0.5 ? 0.7 : -0.7);
  s.add(0.24, (L, k) => rakes(L.air, at.x, at.y - CHEST, th, 13, p, k, 2.6));
  s.sparks(at.x, at.y, 4, p.tints, { speed: 22, up: 16, z: CHEST, life: 0.3 });
  s.add(0.1, (L, k) => L.light(at.x, at.y - CHEST, 18, p.light, 0.6 * (1 - k)));
}

/** The Wolf leap: a spirit wolf crouches over her, springs in an arc onto the foe and lands raking. */
const wolfLeap = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    s.add(c.lead, (L, k, t) => {
      const a = Math.min(1, k * 2.5) * 0.75;
      const crouch = easeOut(k) * 2;
      spiritBeast(L, WOLF, c.from.x, c.from.y - 2 + crouch, th, 0, p, a, 2);
      // Eyes flaring.
      if (k > 0.5) L.light(c.from.x + (Math.cos(th) < 0 ? -4 : 4), c.from.y - 12, 10, p.light, 0.6);
      circle(L.ground, c.from.x, c.from.y, 8, p.mid, a, FLAT, t * 5, t * 5 + Math.PI);
    });
    dust(s, c.from, 3, 10);
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    const jump = 0.18;
    const land = { x: c.at.x - Math.cos(th) * 10, y: c.at.y - Math.sin(th) * 6 };
    s.add(jump, (L, k, t) => {
      for (let g = 2; g >= 0; g--) {
        const kk = Math.max(0, k - g * 0.12);
        const x = lerp(c.from.x, land.x, kk);
        const y = lerp(c.from.y, land.y, kk) - Math.sin(kk * Math.PI) * 18;
        spiritBeast(L, WOLF, x, y - 2, th, Math.floor(t * 20), p, g ? 0.3 / g : 0.9, 2);
      }
      const gx = lerp(c.from.x, land.x, k);
      const gy = lerp(c.from.y, land.y, k);
      shadowOf(L.ground, gx, gy, 6, 1 - bump(k) * 0.6);
    }, 0, () => {
      shock(s, land, Math.max(16, c.r), p, 0.4, 2);
      dust(s, land, 7, 26);
      s.add(0.3, (L, k) => {
        spiritBeast(L, WOLF, land.x, land.y, th, 1, p, 0.8 * (1 - k), 2);
        L.light(land.x, land.y - 8, 40, p.light, 0.8 * (1 - k));
      });
      for (const h of c.hits) {
        const r = angle(c.from, h) + Math.PI / 2 + 0.7;
        s.add(0.26, (L, k) => rakes(L.air, h.x, h.y - CHEST, r, 14, p, k, 2.8));
        impact(s, h, p, 0.7);
      }
    });
  },
};

/** Primal Stampede: she howls the herd into being, and spirit wolves and stags pour past her down the line, trampling all in their way. */
const stampede = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    const seed = Math.random() * 100;
    s.add(c.lead, (L, k, t) => {
      // Spirit wisps rising round her as she calls.
      for (let i = 0; i < 10; i++) {
        const f = (hash(i, seed) + t * 1.4) % 1;
        const a0 = hash(i, seed, 1) * Math.PI * 2 + f * 3;
        pd(L.air, c.from.x + Math.cos(a0) * (5 + 6 * f), c.from.y - 4 - f * 30, f < 0.5 ? p.hot : p.mid, Math.min(1, k * 3) * (1 - f));
      }
      ring(L.ground, c.from.x, c.from.y, 6 + 8 * easeOut(k), 1, p, Math.min(1, k * 3));
      // The herd shimmering into being behind her.
      for (let i = 0; i < 3; i++) {
        const v = (i - 1) * 12;
        const q = along(c.from.x, c.from.y, th, -14 - (i % 2) * 6, v);
        spiritBeast(L, i === 1 ? STAG : WOLF, q.x, q.y, th, 0, p, k * 0.45);
      }
      L.light(c.from.x, c.from.y - 12, 30 + 20 * k, p.light, 0.6 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    const run = 0.55;
    const lanes = [-22, -12, 0, 12, 22];
    const wait = [0.09, 0.03, 0, 0.05, 0.12];
    const life = run + 0.25;
    s.shake(160, 0.003);
    lanes.forEach((v, i) => {
      const a = along(c.from.x, c.from.y, th, -16, v * 0.8);
      const b = along(c.at.x, c.at.y, th, 16, v * 0.8);
      const kind = i % 2 === 0 ? (i === 2 ? STAG : WOLF) : STAG;
      s.add(life, (L, k, t) => {
        const T = k * life;
        const go = Math.min(1, T / run);
        const fade = T < run ? Math.min(1, T * 10) : 1 - (T - run) / 0.25;
        const bob = Math.abs(Math.sin(t * 26 + i)) * 2.5;
        for (let g = 2; g >= 0; g--) {
          const kk = Math.max(0, go - g * 0.06);
          const x = lerp(a.x, b.x, kk);
          const y = lerp(a.y, b.y, kk);
          spiritBeast(L, kind, x, y - bob, th, Math.floor(t * 14 + i), p, (g ? 0.3 / g : 0.9) * fade, i === 2 ? 2 : 1);
        }
        const x = lerp(a.x, b.x, go);
        const y = lerp(a.y, b.y, go);
        disc(L.ground, x, y + 1, 6, 2, 0x0b0818, fade * 0.5, 0.5);
        // Prints left behind, glowing and fading.
        for (let j = 1; j <= 5; j++) {
          const kk = go - j * 0.07;
          if (kk < 0) break;
          const q = { x: lerp(a.x, b.x, kk), y: lerp(a.y, b.y, kk) };
          pd(L.ground, q.x + (j % 2 ? 2 : -2), q.y + 1, p.mid, fade * (1 - j / 6));
        }
        L.light(x, y - 6, 22, p.light, 0.5 * fade);
      }, wait[i]);
      later(s, wait[i] + run * 0.3, () => dust(s, along(c.from.x, c.from.y, th, 30, v), 2, 16));
    });
    for (const h of c.hits) {
      later(s, run * fractionAlong(c.from, c.at, h) + 0.03, () => {
        impact(s, h, p, 1);
        dust(s, h, 4, 24);
      });
    }
  },
};

// --- The Eagle -------------------------------------------------------------------------------

/** A fan of three feathers flung together, spreading apart and closing again on the foe. */
function featherShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 2);
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    const th = heading(pos, k);
    for (let i = -1; i <= 1; i++) {
      const v = i * Math.sin(k * Math.PI) * 4.5;
      const r = along(q.x, q.y, th, -Math.abs(i) * 2, v);
      feather(L.air, r.x, r.y, th + Math.sin(t * 30 + i * 2) * 0.18, 7, p, 1);
    }
    L.light(q.x, q.y, 14, p.light, 0.4);
  }, 0, () => {
    impact(s, b, p, 0.6);
    // A little down drifting off.
    s.sparks(b.x, b.y, 4, [0xffffff, p.core, p.hot], { speed: 10, up: 12, g: -6, life: 0.7, z: CHEST, spread: 4 });
  });
}

/** Spirit wings spread from his shoulders: five long feathers to a side, `open` 0..1 lifting them, `beat` sweeping them down. */
function wings(L: Layers, x: number, y: number, open: number, beat: number, p: Pal, a: number): void {
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      // Each feather's angle out from straight up: fanning open, then swept down by the beat.
      const phi = (0.25 + i * 0.32) * (0.35 + 0.65 * open) + beat * 1.3;
      const len = 9 + i * 1.5 - Math.abs(i - 2) * 0.8;
      const sx = x + side * 3;
      const dx = side * Math.sin(phi);
      const dy = -Math.cos(phi);
      feather(L.air, sx + dx * len, y + dy * len, Math.atan2(dy, dx), len, p, a);
    }
  }
}

/** Gust: spirit wings rise over him, then beat down once, and a ring of wind throws everything near away. */
const gust = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    s.add(c.lead, (L, k) => {
      wings(L, c.from.x, c.from.y - 15, easeOut(k), 0, p, Math.min(1, k * 3) * 0.95);
      L.light(c.from.x, c.from.y - 18, 20 + 16 * k, p.light, 0.5 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(18, c.r);
    const { x, y } = c.from;
    s.add(0.22, (L, k) => wings(L, x, y - 15, 1, easeOut(k), p, 1 - k));
    s.add(0.45, (L, k) => {
      ring(L.ground, x, y, R * easeOut(k), 2, p, 1 - k);
      // Streaks of wind blowing out all round.
      for (let i = 0; i < 10; i++) {
        const th = (i / 10) * Math.PI * 2 + 0.3;
        const d = 5 + R * easeOut(k);
        gustLine(L.air, x + Math.cos(th) * d, y - 6 + Math.sin(th) * d * FLAT, th + (i % 2 ? 0.3 : -0.3), 7, i % 2 ? 2 : -2, p, 1 - k);
      }
      L.light(x, y - 8, R * 2.4, p.light, 0.7 * (1 - k));
    });
    dust(s, c.from, 8, 40);
    s.sparks(x, y, 6, [0xffffff, p.core, p.hot], { speed: 30, up: 20, g: -4, life: 0.8, z: 12 });
    for (const h of c.hits) {
      const th = angle(c.from, h);
      later(s, 0.12, () => {
        impact(s, h, p, 0.6);
        s.add(0.3, (L, k) => {
          const q = along(h.x, h.y - CHEST, th, 6 + 8 * k, 0);
          gustLine(L.air, q.x, q.y, th, 7, 1.5, p, 1 - k);
        });
      });
    }
  },
};

/** Half the spirit eagle's wingspan on the board, px. */
const SPAN = 13;

/**
 * The spirit eagle seen from above, heading `a`: head and hooked beak, a
 * body, a fanned tail, and wings whose span beats with `open`, the
 * primaries parting at the tips. Pale at the heart, deep at the edges.
 */
function eagle(px: Px, x: number, y: number, a: number, open: number, p: Pal, alpha: number, ghost = false): void {
  if (alpha <= 0) return;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const span = SPAN * open + 3;
  const R = SPAN + 10;
  for (let py = -R; py <= R; py++) {
    for (let qx = -R; qx <= R; qx++) {
      const u = (qx * ca + (py / 0.8) * sa) * 1.1;
      const v = (-qx * sa + (py / 0.8) * ca) * 1.1;
      const av = Math.abs(v);
      let heart = -1;
      if ((u * u) / 81 + (v * v) / 7 <= 1) heart = 1 - Math.abs(u) / 9;
      else if ((u - 9.5) ** 2 + v * v <= 6.5) heart = 0.96;
      else if (u > 11 && u < 14 && av <= 1.3 - (u - 11) * 0.4) heart = 1.1;
      else if (u < -7 && u > -15 && av <= 1.4 + (-7 - u) * 0.6) heart = 0.2;
      else if (av > 2 && av <= span * 1.1) {
        const q = av / (span * 1.1);
        const lead = 3.4 - q * 3.2;
        let trail = -3.2 - q * 3.4;
        if (q > 0.62) trail += Math.floor(av) % 3 === 0 ? 2.4 : 0;
        const cut = q > 0.9 ? (q - 0.9) * 40 : 0;
        if (u <= lead - cut * 0.2 && u >= trail + cut) heart = 0.75 - q * 0.75;
      }
      if (heart < 0) continue;
      const c = ghost ? p.mid : heart > 1.05 ? 0xffc840 : heart > 0.93 ? p.core : heart > 0.55 ? p.hot : heart > 0.2 ? p.mid : p.deep;
      pd(px, x + qx, y + py, c, alpha);
    }
  }
}

/** Talon marks: three short rakes torn across a foe. */
function talons(s: Stage, at: Pt, th: number, p: Pal): void {
  s.add(0.28, (L, k) => rakes(L.air, at.x, at.y - CHEST, th + 0.5, 12, p, k, 2.4));
  impact(s, at, p, 1);
}

/** Sky Sovereign: a spirit eagle stoops out of the sky behind him, sweeps low down the whole line raking all it passes, and climbs away. */
const skySovereign = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    const back = along(c.from.x, c.from.y, th, -8, 0);
    s.add(c.lead, (L, k, t) => {
      const e = easeOut(k);
      const z = 70 * (1 - e) + 16;
      const x = back.x - Math.cos(th) * 20 * (1 - e);
      const y = back.y - Math.sin(th) * 20 * (1 - e);
      shadowOf(L.ground, x, y, 9, e);
      eagle(L.air, x, y - z, th, 0.55 + 0.45 * Math.abs(Math.sin(t * 16)), p, Math.min(1, k * 2.5));
      if (k < 0.4) star(L.air, x, y - z, 3, p, 1);
      L.light(x, y - z, 40, p.light, 0.8 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    const start = along(c.from.x, c.from.y, th, -8, 0);
    const end = along(c.at.x, c.at.y, th, 10, 0);
    const pass = 0.36;
    const climb = 0.3;
    const life = pass + climb;
    s.add(life, (L, k, t) => {
      const T = k * life;
      const where = (T: number) => {
        if (T < pass) {
          const f = T / pass;
          return { x: lerp(start.x, end.x, f), y: lerp(start.y, end.y, f), z: 16 - Math.sin(f * Math.PI) * 4 };
        }
        const f = (T - pass) / climb;
        return { x: end.x + Math.cos(th) * 30 * f, y: end.y + Math.sin(th) * 30 * f, z: 12 + 50 * f * f };
      };
      const e = where(T);
      const fade = T < pass ? 1 : 1 - (T - pass) / climb;
      // Afterimages of its wingbeats.
      for (let g = 1; g <= 2; g++) {
        const q = where(Math.max(0, T - g * 0.06));
        eagle(L.air, q.x, q.y - q.z, th, 0.8, p, (0.35 / g) * fade, true);
      }
      shadowOf(L.ground, e.x, e.y, 10, fade * (1 - Math.min(1, (e.z - 12) / 50)));
      eagle(L.air, e.x, e.y - e.z, th, 0.55 + 0.45 * Math.abs(Math.sin(t * 18)), p, fade);
      // A wake of light on the ground under its pass.
      if (T < pass + 0.2)
        for (let i = 0; i < 18; i++) {
          const f = i / 18;
          if (f > Math.min(1, T / pass)) break;
          pd(L.ground, lerp(start.x, end.x, f), lerp(start.y, end.y, f) + (i % 2 ? 2 : -2), p.mid, 0.7 * fade);
        }
      L.light(e.x, e.y - e.z, 50, p.light, 0.9 * fade);
    });
    for (const h of c.hits) later(s, pass * fractionAlong(start, end, h), () => talons(s, h, th, p));
    later(s, pass * 0.3, () => s.shake(90, 0.002));
    later(s, 0.05, () => s.sparks(start.x, start.y, 5, [0xffffff, p.core, p.hot], { speed: 16, up: 10, g: -8, life: 0.8, z: 16, spread: 8 }));
  },
};

// --- The Lion ----------------------------------------------------------------------------------

/** The lion's claws: a raking swipe; the maul is both paws crashing down, cracking the ground. */
function lionClaw(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const base = angle(from, at);
  if (!heavy) {
    const th = base + Math.PI / 2 + (Math.random() < 0.5 ? 0.6 : -0.6);
    s.add(0.26, (L, k) => rakes(L.air, at.x, at.y - CHEST, th, 16, p, k, 3.2));
    s.sparks(at.x, at.y, 5, p.tints, { speed: 26, up: 18, z: CHEST, life: 0.32 });
    s.add(0.1, (L, k) => L.light(at.x, at.y - CHEST, 22, p.light, 0.7 * (1 - k)));
    return;
  }
  // Two paws raking straight down, side by side.
  for (const side of [-1, 1]) s.add(0.3, (L, k) => rakes(L.air, at.x + side * 5, at.y - CHEST, Math.PI / 2 + side * 0.15, 18, p, k, 2.4), 0.02 * (side + 1));
  s.add(0.35, (L, k) => {
    ring(L.ground, at.x, at.y, 4 + 10 * easeOut(k), 1, p, 1 - k);
    L.light(at.x, at.y - 6, 30, p.light, 0.8 * (1 - k));
  }, 0.08);
  later(s, 0.08, () => {
    dust(s, at, 6, 22);
    s.sparks(at.x, at.y, 6, p.tints, { speed: 30, up: 24, z: 6, life: 0.35 });
  });
}

/** A great paw: four toe pads over a lobed palm, claws at the tips. */
const PAW = [
  '...k...k...',
  '...ab.ba...',
  'k..bb.bb..k',
  'ab.bb.bb.ba',
  'bb.......bb',
  'bb.abbba.bb',
  '..abbcbba..',
  '.abbbcbbba.',
  '.abbbbbbba.',
  '..ab...ba..',
];

/** The Cowing strike: a great spirit paw rises over him and slams down; the ground cracks and every foe near cowers. */
const cowingStrike = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    s.add(c.lead, (L, k) => {
      const lift = easeOut(k);
      const y = c.from.y - 26 - 14 * lift;
      sprite(L.air, c.from.x, y, PAW, { a: p.mid, b: p.hot, c: p.core, k: 0xffffff }, Math.min(1, k * 3) * 0.9, { s: 2, ay: 5 });
      L.light(c.from.x, y, 30, p.light, 0.6 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(18, c.r);
    const { x, y } = c.from;
    // The slam.
    s.add(0.07, (L, k) => sprite(L.air, x, lerp(y - 40, y - 4, easeIn(k)), PAW, { a: p.mid, b: p.hot, c: p.core, k: 0xffffff }, 1, { s: 2, ay: 5 }), 0, () => {
      s.shake(110, 0.003);
      // The print it leaves, glowing and fading.
      s.add(0.8, (L, k) => {
        sprite(L.ground, x, y + 5, PAW, { a: p.deep, b: p.mid, c: p.hot, k: p.mid }, tail(k, 0.4), { s: 2 });
        L.light(x, y, 40, p.light, 0.7 * (1 - k));
      });
      s.add(0.45, (L, k) => {
        ring(L.ground, x, y, R * easeOut(k), 2, p, 1 - k);
        ring(L.ground, x, y, R * 0.6 * easeOut(k), 1, p, (1 - k) * 0.7);
      });
      dust(s, c.from, 10, 40);
      for (const h of c.hits) {
        impact(s, h, p, 0.7);
        cowed(s, h, p);
      }
    });
  },
};

/** A cowed foe: dark chevrons sinking over its head, slowed. */
function cowed(s: Stage, at: Pt, p: Pal, dur = 1.2): void {
  s.add(dur, (L, k, t) => {
    const a = tail(k, 0.7);
    for (let i = 0; i < 2; i++) {
      const y = at.y - HEAD - 6 + ((t * 10 + i * 4) % 8);
      for (let j = -2; j <= 2; j++) pd(L.air, at.x + j, y - Math.abs(j) * -1 - 2, i ? p.deep : p.mid, a);
    }
  });
}

/**
 * The spirit lion's head in light, centred on (x, y), `R` px across the
 * mane: ragged locks stirring round its rim, the face, glowing eyes, and
 * jaws `open` 0..1 with fangs at their corners.
 */
function lionHead(px: Px, x: number, y: number, R: number, open: number, t: number, p: Pal, a: number): void {
  if (a <= 0) return;
  const s = R / 16;
  const E = Math.ceil(R + 3);
  for (let py = -E; py <= E; py++) {
    for (let qx = -E; qx <= E; qx++) {
      const d = Math.hypot(qx, py * 1.05);
      const ang = Math.atan2(py, qx);
      const rim = R + 2 * Math.sin(ang * 9 + t * 10) + 1 * Math.sin(ang * 5 - t * 13);
      if (d > rim) continue;
      const fx = qx / s;
      const fy = py / s;
      const face = Math.hypot(fx / 8.5, (fy - 1) / 9) <= 1;
      let c: number;
      if (face) {
        const jaw = fy > 3 && fy < 3 + 6 * open && Math.abs(fx) < 3.6 - (fy - 3) * 0.2;
        if (jaw) c = Math.abs(fx) > 2.1 && fy < 5 ? 0xffffff : 0x1a0808;
        else {
          // Fierce slanted eyes, a broad dark nose, a pale muzzle, the brow and cheeks shaded.
          const ex = Math.abs(fx) - 3.6;
          const eye = Math.abs(ex) < 1.5 && Math.abs(fy + 2 + ex * 0.35) < 0.75;
          const nose = fy > 0.2 && fy < 2.6 && Math.abs(fx) < 2 - (fy - 0.2) * 0.5;
          const bridge = Math.abs(fx) < 0.8 && fy > -3 && fy <= 0.2;
          const muzzle = Math.hypot(fx / 4.2, (fy - 3) / 2.6) < 1;
          if (eye) c = ex < -0.6 ? 0x1a0808 : p.core;
          else if (nose) c = 0x3a1a10;
          else if (bridge) c = p.core;
          else if (muzzle) c = p.core;
          else c = Math.abs(fx) > 6 || fy < -5 ? p.mid : p.hot;
        }
      } else {
        const u = (d - 8 * s) / Math.max(1, rim - 8 * s);
        // Locks of mane: streaks running outward.
        const lock = Math.sin(ang * 14 + u * 2) > 0.3;
        c = u > 0.85 ? p.deep : lock ? p.mid : u < 0.4 ? p.hot : p.deep;
      }
      pd(px, x + qx, y + py, c, a);
    }
  }
  // The ears, pricked in the mane.
  for (const side of [-1, 1]) dot(px, x + side * 7 * s, y - 8.5 * s, p.hot, a, 2);
}

/** King's Roar: a great spirit lion's head rises over him and roars three times, each roar a ring of force rolling out, the last the greatest. */
const kingsRoar = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    s.add(c.lead, (L, k, t) => {
      const y = c.from.y - 36 + 6 * (1 - easeOut(k));
      lionHead(L.air, c.from.x, y, 11 + 3 * easeOut(k), 0.1, t, p, Math.min(1, k * 2.5));
      L.light(c.from.x, y, 36 + 16 * k, p.light, 0.4 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(30, c.r);
    const { x, y } = c.from;
    const roars = [0, 0.16, 0.34];
    const life = 0.95;
    s.add(life, (L, k, t) => {
      const T = k * life;
      const since = roars.reduce((m, r) => (T >= r ? T - r : m), 9);
      const pulse = 1 + 0.15 * Math.max(0, 1 - since / 0.14);
      const a = tail(k, 0.7);
      lionHead(L.air, x, y - 36, 14 * pulse, 0.5 + 0.5 * Math.max(0, 1 - since / 0.3), t, p, a);
      L.light(x, y - 36, 50 * pulse, p.light, 0.45 * a);
    });
    roars.forEach((at, n) => {
      const big = n === roars.length - 1;
      later(s, at, () => {
        s.shake(big ? 240 : 120, big ? 0.006 : 0.003);
        s.add(0.5, (L, k) => {
          const rr = 8 + ((big ? R : R * 0.75) - 8) * easeOut(k);
          ring(L.ground, x, y, rr, big ? 3 : 2, p, 1 - k, 0.25, n);
          ring(L.ground, x, y, rr * 0.7, 1, p, (1 - k) * 0.6, 0.5, n + 5);
          // Arcs of sound in the air, rolling out from the jaws.
          for (const side of [-1, 1]) circle(L.air, x, y - 30, 10 + rr * 0.5, p.hot, 1 - k, 0.7, side < 0 ? Math.PI * 0.75 : -Math.PI * 0.25, side < 0 ? Math.PI * 1.25 : Math.PI * 0.25);
        });
        dust(s, c.from, big ? 10 : 5, big ? 44 : 28);
      });
    });
    for (const h of c.hits) {
      later(s, 0.34, () => {
        impact(s, h, p, 1);
        dazed(s, h, p, Math.max(0.5, c.stun));
      });
    }
  },
};

// --- The Dragon --------------------------------------------------------------------------------

/** A gob of fire spat from the jaws: a bright bead, a ragged flame tongue behind it, a curl of smoke at its tail. */
function spitShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 4, CHEST + 3);
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    const th = heading(pos, k);
    // The tongue of flame, flickering.
    for (let i = 1; i <= 9; i++) {
      const f = i / 9;
      const v = Math.sin(t * 45 + i * 1.3) * f * 1.8;
      const r = along(q.x, q.y, th, -i * 1.2, v);
      dot(L.air, r.x, r.y - f * 1.2, f < 0.3 ? p.hot : f < 0.65 ? p.mid : p.deep, 1, f < 0.45 ? 2 : 1);
    }
    // Smoke at its tail.
    for (let i = 0; i < 3; i++) {
      const r = pos(k - 0.14 - i * 0.05);
      pd(L.air, r.x + Math.sin(t * 9 + i) * 1.5, r.y - 2 - i, 0x4a3a40, 0.7 - i * 0.2);
    }
    disc(L.air, q.x, q.y, 2.6, 2.1, p.mid, 1);
    disc(L.air, q.x, q.y, 1.6, 1.3, p.hot, 1);
    pd(L.air, q.x + Math.cos(th), q.y + Math.sin(th), p.core);
    if (Math.random() < 0.4) s.sparks(q.x, q.y + CHEST, 1, [p.hot, p.mid], { speed: 4, up: 8, g: -14, life: 0.3, z: CHEST });
    L.light(q.x, q.y, 20, p.light, 0.7);
  }, 0, () => {
    impact(s, b, p, 0.9);
    // It splashes, and little flames lick up where it broke.
    s.add(0.4, (L, k, t) => {
      for (let i = -1; i <= 1; i++) lick(L.air, b.x + i * 4, b.y - 2 + Math.abs(i), 6 - Math.abs(i) * 2, 1.3, p, t + i, tail(k, 0.3));
    });
    s.sparks(b.x, b.y, 6, [p.hot, p.mid, p.deep], { speed: 22, up: 26, g: 70, z: CHEST, life: 0.5 });
  });
}

/** Where the dragon's jaws are, about. */
const JAW = 17;

/** Flame breath: embers drawn into the jaws, then a roaring cone of fire down the line, licking the ground black and setting foes alight. */
const flameBreath = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const seed = Math.random() * 100;
    const hx = c.from.x;
    const hy = c.from.y - JAW;
    s.add(c.lead, (L, k, t) => {
      // The intake: embers spiralling into the jaws.
      for (let i = 0; i < 9; i++) {
        const life = (k * 2 + hash(i, seed)) % 1;
        const th = hash(i, seed, 1) * Math.PI * 2 + t * 4;
        const d = (1 - easeOut(life)) * 16;
        pd(L.air, hx + Math.cos(th) * d, hy + Math.sin(th) * d * 0.7, life > 0.6 ? p.hot : p.mid);
      }
      orb(L.air, hx, hy, 1 + 2 * easeOut(k), p);
      L.light(hx, hy, 18 + 18 * k, p.light, 0.7 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const a = { x: c.from.x, y: c.from.y - JAW };
    const b = { x: c.at.x, y: c.at.y - 6 };
    const th = Math.atan2(b.y - a.y, b.x - a.x);
    const N = 22;
    const dur = 0.55;
    const seed = Math.random() * 100;
    s.add(dur, (L, k, t) => {
      const reach = easeOut(Math.min(1, k * 5));
      const fade = tail(k, 0.6);
      // A black lick of scorched ground along the line.
      for (let i = 0; i < 16; i++) {
        const f = i / 16;
        if (f > reach) break;
        pd(L.ground, lerp(c.from.x, c.at.x, f) + (hash(i, seed) - 0.5) * 6 * f, lerp(c.from.y, c.at.y, f), 0x2a1a18, 0.8);
      }
      // Billows of fire rolling outward, swelling as they go.
      for (let i = 0; i < N; i++) {
        const life = (t * 2.8 + i / N) % 1;
        if (life > reach) continue;
        const v = Math.sin(t * 17 + i * 2.3) * life * 7;
        const q = along(a.x, a.y, th, dist(a, b) * life, v);
        const r = 1.4 + life * 5.6;
        const col = life < 0.18 ? p.core : life < 0.42 ? p.hot : life < 0.72 ? p.mid : p.deep;
        disc(L.air, q.x, q.y - life * 3, r, r * 0.8, col, fade * (1 - life * 0.55));
        if (life < 0.7) pd(L.air, q.x, q.y - life * 3, p.core, fade);
      }
      L.light(lerp(a.x, b.x, 0.5), lerp(a.y, b.y, 0.5), 60, p.light, 0.9 * fade);
      L.light(a.x, a.y, 20, p.light, fade);
    });
    s.sparks(b.x, c.at.y, 8, [p.hot, p.mid, p.deep], { speed: 20, up: 30, g: -6, life: 0.6, z: 8, spread: 8 });
    for (const h of c.hits) {
      later(s, 0.1 + 0.1 * fractionAlong(c.from, c.at, h), () => {
        impact(s, h, p, 0.7);
        burning(s, h, p, 1.1);
      });
    }
  },
};

/** The fire serpent's body: a chain of glowing segments shrinking to the tail, a dark spine-fin down its back, a horned head. */
function serpent(L: Layers, pts: Pt[], p: Pal, a: number, t: number): void {
  for (let i = pts.length - 1; i >= 0; i--) {
    const q = pts[i];
    const f = i / pts.length;
    const r = 3.6 * (1 - f * 0.75) + 0.6;
    orb(L.air, q.x, q.y, r, p, a);
    if (i > 0 && i % 2 === 0) pd(L.air, q.x, q.y - r - 0.5, p.deep, a);
    if (i > 0 && Math.sin(t * 30 + i) > 0.6) pd(L.air, q.x + Math.sin(i) * r, q.y + r * 0.5, p.hot, a);
  }
  const h = pts[0];
  const n = pts[1] ?? { x: h.x, y: h.y + 1 };
  const th = Math.atan2(h.y - n.y, h.x - n.x);
  // Snout, jaws, horns and eye.
  const sn = along(h.x, h.y, th, 4, 0);
  dot(L.air, sn.x, sn.y, p.hot, a, 2);
  for (const side of [-1, 1]) {
    const j0 = along(h.x, h.y, th, 3, side * 1.5);
    const j1 = along(h.x, h.y, th, 7, side * (2.5 + Math.sin(t * 20) * 0.8));
    line(L.air, j0.x, j0.y, j1.x, j1.y, p.mid, a);
    const h0 = along(h.x, h.y, th, -1, side * 2.5);
    const h1 = along(h.x, h.y, th, -5, side * 4);
    line(L.air, h0.x, h0.y, h1.x, h1.y, p.deep, a);
  }
  const e = along(h.x, h.y, th, 1, -1.5);
  pd(L.air, e.x, e.y, 0xffffff, a);
}

/** Wrath of the Wyrm: a serpent of fire leaps from his jaws, coils high over the foes, then dives into them and bursts. */
const wyrmWrath = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(24, c.r);
    const lead = c.lead;
    const mouth = { x: c.from.x, y: c.from.y - JAW };
    const C = { x: c.at.x, y: c.at.y - 44 };
    const rx = 16;
    const ry = 7;
    const T1 = lead * 0.3;
    const T2 = lead * 0.82;
    const coilStart = -Math.PI * 0.5;
    const turns = Math.PI * 2 * 1.25;
    const ctrl = { x: lerp(mouth.x, C.x, 0.3), y: Math.min(mouth.y, C.y) - 40 };
    /** Where the head is at time T. */
    const head = (T: number): Pt | null => {
      if (T < 0) return null;
      if (T < T1) {
        const f = easeOut(T / T1);
        const end = { x: C.x + Math.cos(coilStart) * rx, y: C.y + Math.sin(coilStart) * ry };
        const u = 1 - f;
        return { x: u * u * mouth.x + 2 * u * f * ctrl.x + f * f * end.x, y: u * u * mouth.y + 2 * u * f * ctrl.y + f * f * end.y };
      }
      const coilAng = (T: number) => coilStart - turns * ((T - T1) / (T2 - T1));
      if (T < T2) {
        const th = coilAng(T);
        return { x: C.x + Math.cos(th) * rx, y: C.y + Math.sin(th) * ry };
      }
      const th = coilAng(T2);
      const from = { x: C.x + Math.cos(th) * rx, y: C.y + Math.sin(th) * ry };
      const f = easeIn(Math.min(1, (T - T2) / (lead - T2)));
      return { x: lerp(from.x, c.at.x, f), y: lerp(from.y, c.at.y - 2, f) };
    };
    const SEG = 14;
    const LAG = 0.032;
    s.add(lead + SEG * LAG, (L, k, t) => {
      const T = k * (lead + SEG * LAG);
      const pts: Pt[] = [];
      for (let i = 0; i < SEG; i++) {
        const tt = T - i * LAG;
        // Once a segment reaches the ground it is gone into the blast.
        if (tt > lead) continue;
        const q = head(tt);
        if (q) pts.push(q);
      }
      if (pts.length > 1) serpent(L, pts, p, 1, t);
      // The marked ground and its shadow.
      const mark = clamp01(T / lead);
      ring(L.ground, c.at.x, c.at.y, R * (1 - 0.2 * mark), 1, p, mark * (T < lead ? 1 : 0), 0.4, Math.floor(t * 8));
      if (T < lead) shadowOf(L.ground, c.at.x, c.at.y, R * 0.5, mark);
      if (pts.length) L.light(pts[0].x, pts[0].y, 40, p.light, 0.9);
    });
    s.add(Math.min(0.3, lead * 0.3), (L, k) => L.light(mouth.x, mouth.y, 30, p.light, 1 - k));
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(24, c.r);
    const { x, y } = c.at;
    s.shake(220, 0.006);
    s.add(0.7, (L, k, t) => {
      ring(L.ground, x, y, R * easeOut(k), 3, p, 1 - k);
      ring(L.ground, x, y, R * 0.6 * easeOut(k), 1, p, (1 - k) * 0.7);
      const h = 44 * bump(Math.min(1, k * 1.4));
      if (k < 0.75) column(L.air, x, y, h, 7 * (1 - k * 0.5), p, 1 - k / 0.75, t);
      if (k < 0.3) orb(L.air, x, y - 8, 11 * easeOut(k / 0.3), p);
      L.light(x, y - 14, R * 3 + 40, p.light, 1 - k);
    });
    // Tongues of fire running out over the ground.
    s.add(0.6, (L, k, t) => {
      for (let i = 0; i < 8; i++) {
        const th = (i / 8) * Math.PI * 2 + 0.3;
        const d = R * 0.8 * easeOut(k);
        lick(L.air, x + Math.cos(th) * d, y + Math.sin(th) * d * FLAT, 8 * (1 - k), 1.6, p, t + i, 1 - k);
      }
    });
    scorch(s, c.at, R * 0.75, 1.8);
    smoke(s, c.at, 5, 0x4a3a40, 3.5, 1.1, 12);
    s.sparks(x, y, 24, [p.core, p.hot, p.mid, p.deep], { speed: 46, up: 56, g: 90, life: 0.8, z: 4, spread: R * 0.4 });
    for (const h of c.hits) burning(s, h, p, 1.2);
  },
};

export const WILD_KITS: Record<string, Kit> = {
  'archer.ranger': { shot: rangerShot, skill: volley, ult: greatArrowMove },
  'archer.wind': { shot: fanShot, skill: windVault, ult: tempest },
  'druid.grove': { shot: thornShot, skill: grove, ult: wrath },
  'druid.wild': { melee: wolfClaw, skill: wolfLeap, ult: stampede },
  'beast.eagle': { shot: featherShot, skill: gust, ult: skySovereign },
  'beast.lion': { melee: lionClaw, skill: cowingStrike, ult: kingsRoar },
  'beast.dragon': { shot: spitShot, skill: flameBreath, ult: wyrmWrath },
};
