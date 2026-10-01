// The Blademasters' effects on the board: the Brawler's punches, chi barrage
// and Dragon Rush; the Iron Monk's palm strikes, quake leap and Mountain's
// Wrath; the Bladewind's gusting cuts, wind dash and Sky Quake; the Ronin's
// katana, iaido draw and Hundred Cuts. Blades are drawn thin and very crisp
// (a white edge, the palette just inside it), fists as bursts with speed
// lines, chi in the hero's own colours, stone and steel in their own.

import {
  angle,
  bolt,
  bump,
  CHEST,
  circle as pCircle,
  column,
  disc,
  dist,
  dither,
  dot as pDot,
  easeIn,
  easeOut,
  FLAT,
  hash,
  impact,
  lerp,
  line as pLine,
  mix,
  orb,
  ring,
  sprite,
  star as pStar,
  tail,
  tri,
  type Cast,
  type Kit,
  type Layers,
  type Pal,
  type Pt,
  type Px,
  type Stage,
} from '../paint';
import { gather, HAND, scorch, smoke } from './common';

/** Stone for the monk's spikes and stoneskin: lit face, shaded face, cracks. */
const STONE_LIT = 0xb8ad9a;
const STONE_MID = 0x857a6a;
const STONE_DARK = 0x4e463e;
const CRACK = 0x231c18;
/** Steel of a bare katana: the flat and the shadow side. */
const STEEL = 0xe8eef6;
/** Storm cloud over the Sky Quake. */
const CLOUD_DARK = 0x262c40;
const CLOUD_MID = 0x3c4660;

// --- Shared strokes -----------------------------------------------------------------

/** Pixels put through this fade out in a dither checker rather than going see-through, so everything stays crisp. */
const fade = (px: Px, a: number): Px => (a >= 1 ? px : { put: (x, y, c) => void (a > 0 && dither(x, y) < a && px.put(x, y, c, 1)) });
const line = (px: Px, x0: number, y0: number, x1: number, y1: number, c: number, a = 1): void => pLine(fade(px, a), x0, y0, x1, y1, c);
const dot = (px: Px, x: number, y: number, c: number, a = 1, sz = 1): void => pDot(fade(px, a), x, y, c, 1, sz);
const circle = (px: Px, cx: number, cy: number, r: number, c: number, a = 1, sq = FLAT, from = 0, to = Math.PI * 2): void => pCircle(fade(px, a), cx, cy, r, c, 1, sq, from, to);
const star = (px: Px, x: number, y: number, sz: number, p: Pal, a = 1): void => pStar(fade(px, a), x, y, sz, p);

/**
 * A crisp blade crescent round (cx, cy), `r` out, its ellipse squashed by
 * `sq` and turned by `rot`. The edge runs from angle th0 towards th1; `head`
 * and `tl` (0..1 along it) say how much is drawn, so a sweep is drawn by
 * moving the head out fast and the tail after it. The outer pixel is white
 * (the edge), the palette just inside, thickest right behind the head.
 */
function cut(px: Px, cx: number, cy: number, r: number, th0: number, th1: number, head: number, tl: number, w: number, p: Pal, sq = 0.45, rot = 0, a = 1): void {
  if (head <= tl || a <= 0) return;
  const span = th1 - th0;
  const n = Math.max(6, Math.ceil(Math.abs(span) * r * 1.6 * (head - tl)));
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const g = i / n;
    const th = th0 + span * (tl + (head - tl) * g);
    const ww = w * Math.pow(g, 0.7) * Math.min(1, (1 - g) * 5 + 0.35);
    const steps = Math.ceil(ww);
    for (let j = 0; j <= steps; j++) {
      const rr = r - j;
      const ex = Math.cos(th) * rr;
      const ey = Math.sin(th) * rr * sq;
      const x = Math.round(cx + ex * cr - ey * sr);
      const y = Math.round(cy + ex * sr + ey * cr);
      if (a < 1 && dither(x, y) >= a) continue;
      px.put(x, y, j === 0 ? p.core : j <= ww * 0.55 ? p.hot : p.mid, 1);
    }
  }
}

/** One slash played over `dur`: the edge whips round, then its tail chases it away. */
function slash(s: Stage, x: number, y: number, r: number, th0: number, th1: number, w: number, p: Pal, dur = 0.2, sq = 0.45, rot = 0, wait = 0): void {
  s.add(
    dur,
    (L, k) => {
      cut(L.air, x, y, r, th0, th1, easeOut(Math.min(1, k * 2.6)), easeIn(k), w, p, sq, rot);
      L.light(x, y, r * 2.4, p.light, 0.5 * (1 - k));
    },
    wait,
  );
}

/** Short lines bursting outward from (x, y): the speed lines round a punch. `dir` biases them along an angle. */
function speedLines(px: Px, x: number, y: number, n: number, r0: number, r1: number, seed: number, c: number, a = 1, dir?: number, cone = Math.PI): void {
  for (let i = 0; i < n; i++) {
    const th = dir === undefined ? (i / n) * Math.PI * 2 + hash(i, seed) * 0.5 : dir + (hash(i, seed) - 0.5) * 2 * cone;
    const ca = Math.cos(th);
    const sa = Math.sin(th) * 0.8;
    const k0 = r0 * (0.8 + hash(i, seed, 1) * 0.4);
    const k1 = r1 * (0.8 + hash(i, seed, 2) * 0.4);
    line(px, x + ca * k0, y + sa * k0, x + ca * k1, y + sa * k1, c, a);
  }
}

/** A comic-book "pow": a jagged starburst, palette rim to a white heart. */
function pow(px: Px, x: number, y: number, R: number, seed: number, p: Pal, a = 1): void {
  if (R < 1) return;
  const pts = 10;
  for (const [sc, col] of [
    [1, p.mid],
    [0.68, p.hot],
    [0.36, p.core],
  ] as const) {
    for (let i = 0; i < pts; i++) {
      const t0 = (i / pts) * Math.PI * 2 + seed;
      const t1 = ((i + 0.5) / pts) * Math.PI * 2 + seed;
      const t2 = ((i + 1) / pts) * Math.PI * 2 + seed;
      const r0 = R * sc * 0.5;
      const r1 = R * sc * (0.85 + hash(i, Math.floor(seed * 10)) * 0.4);
      tri(px, x, y, x + Math.cos(t0) * r0, y + Math.sin(t0) * r0 * 0.85, x + Math.cos(t1) * r1, y + Math.sin(t1) * r1 * 0.85, col, a);
      tri(px, x, y, x + Math.cos(t1) * r1, y + Math.sin(t1) * r1 * 0.85, x + Math.cos(t2) * r0, y + Math.sin(t2) * r0 * 0.85, col, a);
    }
  }
}

/** A pale streak of wind, `len` long along `th`, curling up into a little hook at its head. */
function gust(px: Px, x: number, y: number, len: number, th: number, curl: number, c: number, a = 1): void {
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  const n = Math.ceil(len);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    // Straight for most of its length, then bending round at the head.
    const bend = f > 0.7 ? Math.pow((f - 0.7) / 0.3, 2) * curl : 0;
    const qx = x + ux * len * f - uy * bend;
    const qy = y + uy * len * f + ux * bend;
    if (a < 1 && dither(qx, qy) >= a * (0.4 + f * 0.6)) continue;
    px.put(Math.round(qx), Math.round(qy), f > 0.55 ? c : mix(c, 0x8090a0, 0.35), 1);
  }
}

// --- The Brawler ---------------------------------------------------------------------

/** A glowing fist seen knuckles-on: the print the chi barrage leaves in the air. */
const FIST = [
  '.hhhh.',
  'hcmcch',
  'hccccm',
  'mhhhmm',
  '.mmm..',
];

/** A punch landing: a pow on the foe, speed lines bursting off it; the uppercut throws its lines skyward. */
function punch(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const th = angle(from, at);
  const x = at.x - Math.cos(th) * 3;
  const y = at.y - CHEST - Math.sin(th) * 2;
  const seed = Math.random() * 6;
  const R = heavy ? 7 : 4.5;
  s.add(heavy ? 0.3 : 0.22, (L, k) => {
    if (k < 0.45) pow(L.air, x, y, R * (0.6 + 0.5 * easeOut(k / 0.2)) * (1 - k * 0.6), seed, p, 1 - k / 0.45);
    // Lines fly out past the burst; the heavy blow's go up with the uppercut.
    const r0 = R + 1 + 10 * easeOut(k);
    speedLines(L.air, x, y, heavy ? 8 : 6, r0, r0 + (heavy ? 6 : 4) * (1 - k), seed * 7, k < 0.4 ? p.hot : p.mid, 1 - k, heavy ? -Math.PI / 2 : th, heavy ? 0.9 : 1.1);
    if (heavy) ring(L.ground, at.x, at.y, 4 + 9 * easeOut(k), 1, p, 1 - k);
    L.light(x, y, heavy ? 30 : 20, p.light, 0.8 * (1 - k));
  });
  s.sparks(at.x, at.y, heavy ? 9 : 5, p.tints, { speed: heavy ? 34 : 26, up: heavy ? 46 : 20, z: CHEST, life: 0.35, dir: heavy ? undefined : th, cone: 0.9 });
}

/** Chi barrage: fists of chi drawn back and flickering, then a flurry of glowing fist prints hammered down the whole line. */
const chiBarrage = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    gather(s, c.from, p, c.lead, 1);
    const th = angle(c.from, c.at);
    // Fists jab in and out in front of him, faster and faster.
    s.add(c.lead, (L, k, t) => {
      for (let i = 0; i < 2; i++) {
        const ph = (t * (10 + k * 18) + i * 0.5) % 1;
        const d = 4 + bump(ph) * 6;
        const side = i ? 3 : -3;
        const x = c.from.x + Math.cos(th) * d - Math.sin(th) * side;
        const y = c.from.y - HAND + Math.sin(th) * d * 0.6;
        sprite(L.air, x, y, FIST, { c: p.core, h: p.hot, m: p.mid }, 0.4 + 0.6 * k, { ay: 2.5 });
      }
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    const len = dist(c.from, c.at);
    const n = Math.max(6, Math.round(len / 6));
    // Prints land in order out from him, each jolted off the line a little.
    for (let i = 0; i < n; i++) {
      const f = (i + 0.6) / n;
      const jx = (hash(i, 3) - 0.5) * 8;
      const jy = (hash(i, 5) - 0.5) * 6;
      const x = lerp(c.from.x, c.at.x, f) + jx;
      const y = lerp(c.from.y, c.at.y, f) - CHEST + jy;
      const last = i === n - 1;
      s.add(
        last ? 0.4 : 0.3,
        (L, k) => {
          const a = 1 - easeIn(k);
          sprite(L.air, x, y, FIST, { c: p.core, h: p.hot, m: p.mid }, a, { ay: 2.5, s: last ? 2 : 1 });
          // Speed lines streaming back towards him from each print.
          speedLines(L.air, x - Math.cos(th) * 3, y - Math.sin(th) * 2, 3, 3, 8 + 4 * k, i * 13, p.hot, a * 0.9, th + Math.PI, 0.25);
          if (k < 0.3) circle(L.air, x, y, 3 + 5 * (k / 0.3), p.core, 1 - k / 0.3, 1);
          L.light(x, y, last ? 30 : 16, p.light, 0.6 * a);
        },
        i * 0.045,
      );
    }
    // A scuffed track of chi on the ground under the flurry.
    s.add(0.6, (L, k) => {
      for (let i = 0; i < 18; i++) {
        const f = i / 18;
        if (f > Math.min(1, k * 3) || hash(i, 11) > 0.7 * (1 - k)) continue;
        dot(L.ground, lerp(c.from.x, c.at.x, f) + (hash(i, 12) - 0.5) * 6, lerp(c.from.y, c.at.y, f), p.deep);
      }
    });
    s.add(0.01, () => {}, (n - 1) * 0.045, () => {
      s.add(0.3, (L, k) => {
        pow(L.air, c.at.x, c.at.y - CHEST, 8 * (1 - k * 0.5), 1.3, p, 1 - k);
        ring(L.ground, c.at.x, c.at.y, 4 + 10 * easeOut(k), 1, p, 1 - k);
      });
      s.sparks(c.at.x, c.at.y, 10, p.tints, { speed: 34, up: 26, z: CHEST, dir: th, cone: 0.8 });
    });
    c.hits.forEach((h) => {
      const f = dist(c.from, h) / (len || 1);
      s.add(0.01, () => {}, Math.max(0, f * n - 0.5) * 0.045, () => impact(s, h, p, 0.8));
    });
  },
};

/** The dragon's path for the rush: along the dash to the foe, then curling up over it. */
function dragonPath(a: Pt, b: Pt): (u: number) => Pt {
  return (u) => {
    if (u <= 0.72) {
      const f = u / 0.72;
      return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) - CHEST - Math.sin(f * Math.PI) * 6 };
    }
    // The curl: rising past the foe and turning back over it.
    const f = (u - 0.72) / 0.28;
    const th = f * Math.PI * 1.1;
    return { x: b.x + Math.sin(th) * 8, y: b.y - CHEST - (1 - Math.cos(th)) * 12 - f * 6 };
  };
}

/** A fire dragon's head facing along (ux, uy): snout, open jaw, swept horns, a bright eye, whiskers streaming back. */
function dragonHead(L: Layers, x: number, y: number, ux: number, uy: number, p: Pal, t: number): void {
  const nx = -uy;
  const ny = ux;
  // Horns swept back.
  for (const sd of [-1, 1]) {
    line(L.air, x - ux * 1 + nx * sd * 2, y - uy * 1 + ny * sd * 2 - 1, x - ux * 6 + nx * sd * 4, y - uy * 6 + ny * sd * 4 - 3, p.hot);
    // Whiskers streaming back, waving.
    const w = Math.sin(t * 24 + sd) * 1.5;
    line(L.air, x + ux * 4 + nx * sd * 1.5, y + uy * 4 + ny * sd * 1.5, x - ux * 3 + nx * (sd * 5 + w), y - uy * 3 + ny * (sd * 5 + w), p.mid);
  }
  orb(L.air, x, y, 3.2, p);
  // Snout and the lower jaw hanging open.
  for (let i = 1; i <= 4; i++) dot(L.air, x + ux * i * 1.2 - nx * 0.6, y + uy * i * 1.2 - ny * 0.6, i > 2 ? p.hot : p.core, 1, 2);
  line(L.air, x + nx * 1.6, y + ny * 1.6, x + ux * 4.5 + nx * 2.6, y + uy * 4.5 + ny * 2.6, p.mid);
  dot(L.air, x + ux * 1 - nx * 1.8, y + uy * 1 - ny * 1.8 - 1, 0xffffff);
  dot(L.air, x + ux * 1.6 - nx * 1.8, y + uy * 1.6 - ny * 1.8 - 1, p.deep);
}

/** Dragon Rush: fire coils round him as he braces; then a fire dragon carries him through the foe, curls up over it and bursts. */
const dragonRush = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    gather(s, c.from, p, c.lead, 1.3);
    const seed = Math.random() * 100;
    s.add(c.lead, (L, k, t) => {
      // Tongues of flame licking up round his feet, growing.
      for (let i = 0; i < 10; i++) {
        const th = (i / 10) * Math.PI * 2 + t * 3;
        const life = (t * 3 + hash(i, seed)) % 1;
        const x = c.from.x + Math.cos(th) * 8;
        const y0 = c.from.y + Math.sin(th) * 8 * FLAT;
        const h = (3 + 8 * k) * (1 - life);
        for (let z = 0; z < h; z++) dot(L.air, x + Math.sin(t * 20 + i + z * 0.5) * 0.8, y0 - z - life * 6, z < h * 0.3 ? p.mid : z < h * 0.7 ? p.hot : p.core);
      }
      ring(L.ground, c.from.x, c.from.y, 9 + Math.sin(t * 30), 1, p, k);
      L.light(c.from.x, c.from.y - 8, 30 + 20 * k, p.light, 0.6 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const path = dragonPath(c.from, c.at);
    const SEGS = 22;
    const GAP = 0.024;
    s.add(0.75, (L, k, t) => {
      // The head runs the dash with him, then rises in the curl.
      const hu = easeOut(Math.min(1, k / 0.55)) * 1.0;
      const fade = tail(k, 0.75);
      // Body: fat glowing scales tapering to the tail, rippling side to side.
      for (let i = SEGS; i >= 1; i--) {
        const u = hu - i * GAP;
        if (u < 0) continue;
        const q = path(u);
        const q2 = path(Math.max(0, u - 0.01));
        const dx = q.x - q2.x;
        const dy = q.y - q2.y;
        const d = Math.hypot(dx, dy) || 1;
        const wob = Math.sin(t * 22 - i * 0.9) * 2.2 * (i / SEGS);
        const x = q.x + (-dy / d) * wob;
        const y = q.y + (dx / d) * wob;
        const r = 3 * (1 - i / (SEGS + 4));
        if (fade < 1 && dither(x, y) >= fade) continue;
        orb(L.air, x, y, Math.max(1, r), p, 1);
        // A dorsal fin every other scale.
        if (i % 2 === 0) dot(L.air, x, y - r - 1, p.core);
        if (i % 4 === 1) s.sparks(x, y + CHEST, 1, [p.hot, p.mid], { speed: 4, up: 8, g: -10, life: 0.3, z: CHEST });
      }
      const h = path(hu);
      const h2 = path(Math.max(0, hu - 0.02));
      const d = Math.hypot(h.x - h2.x, h.y - h2.y) || 1;
      if (fade >= 1 || k < 0.9) dragonHead(L, h.x, h.y, (h.x - h2.x) / d, (h.y - h2.y) / d, p, t);
      // Scorched track where it flew.
      for (let i = 0; i < 16; i++) {
        const f = i / 16;
        if (f > Math.min(1, hu / 0.72) || hash(i, 21) > 0.75 * fade) continue;
        dot(L.ground, lerp(c.from.x, c.at.x, f), lerp(c.from.y, c.at.y, f), i % 3 ? p.deep : p.mid);
      }
      L.light(h.x, h.y, 34, p.light, 0.8 * fade);
    });
    // The dragon bursts over the foe as its curl closes.
    s.add(0.01, () => {}, 0.42, () => {
      s.shake(150, 0.004);
      s.add(0.6, (L, k, t) => {
        ring(L.ground, c.at.x, c.at.y, 22 * easeOut(k), 2, p, 1 - k);
        const hh = 34 * bump(Math.min(1, k * 1.5));
        if (k < 0.7) column(L.air, c.at.x, c.at.y, hh, 5 * (1 - k * 0.5), p, 1 - k / 0.7, t);
        if (k < 0.25) pow(L.air, c.at.x, c.at.y - CHEST - 4, 11 * easeOut(k / 0.25), 0.4, p, 1);
        L.light(c.at.x, c.at.y - 12, 70, p.light, 1 - k);
      });
      scorch(s, c.at, 12, 1.4, p.mid);
      smoke(s, c.at, 4, 0x4a3a40, 3, 1, 12);
      s.sparks(c.at.x, c.at.y, 18, p.tints, { speed: 40, up: 50, g: 90, life: 0.6, z: 8, spread: 6 });
    });
    for (const h of c.hits) s.add(0.01, () => {}, 0.12 * (dist(c.from, h) / (dist(c.from, c.at) || 1)), () => impact(s, h, p, 0.9));
  },
};

// --- The Iron Monk -----------------------------------------------------------------------

/** A palm strike: an oval of chi bursting off the palm into the foe; the thrust drives a cone of force through and out the back. */
function palm(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const th = angle(from, at);
  const x = at.x - Math.cos(th) * 4;
  const y = at.y - CHEST - Math.sin(th) * 2;
  s.add(heavy ? 0.34 : 0.24, (L, k) => {
    const a = 1 - k;
    // Two upright rings of chi rolling off the palm.
    for (let i = 0; i < 2; i++) {
      const kk = k - i * 0.15;
      if (kk <= 0) continue;
      const r = 2 + (heavy ? 8 : 6) * easeOut(kk);
      circle(L.air, x + Math.cos(th) * r * 0.5, y + Math.sin(th) * r * 0.3, r * 0.55, i ? p.mid : p.hot, 1 - kk, 1.7);
    }
    if (k < 0.3) star(L.air, x, y, heavy ? 4 : 3, p, 1);
    if (heavy) {
      // The force goes on through and out behind the foe.
      for (let i = 0; i < 5; i++) {
        const sd = (i - 2) * 0.22;
        const d0 = 4 + 14 * easeOut(k);
        line(L.air, at.x + Math.cos(th + sd) * d0, at.y - CHEST + Math.sin(th + sd) * d0 * 0.6, at.x + Math.cos(th + sd) * (d0 + 5), at.y - CHEST + Math.sin(th + sd) * (d0 + 5) * 0.6, i === 2 ? p.core : p.hot, a);
      }
      ring(L.ground, at.x, at.y, 3 + 9 * easeOut(k), 1, p, a);
    }
    L.light(x, y, heavy ? 28 : 18, p.light, 0.7 * a);
  });
  s.sparks(at.x, at.y, heavy ? 7 : 4, [p.core, p.hot, p.mid], { speed: 26, up: 16, z: CHEST, dir: th, cone: 0.7, life: 0.3 });
  if (heavy) s.sparks(at.x, at.y, 5, [STONE_MID, STONE_LIT], { speed: 18, up: 12, g: 60, z: 1, ground: true, life: 0.4 });
}

/** A jag of stone thrust up from the ground, `h` tall, lit on its left, a seam of chi glowing up its edge. */
function spike(px: Px, x: number, y: number, h: number, w: number, lean: number, p: Pal, a = 1): void {
  if (h < 1) return;
  const tx = x + lean;
  const ty = y - h;
  tri(px, x - w, y, x, y + 1, tx, ty, STONE_LIT, a);
  tri(px, x, y + 1, x + w, y, tx, ty, STONE_MID, a);
  line(px, x + w, y, tx, ty, STONE_DARK, a);
  line(px, x, y, tx, ty + h * 0.35, p.hot, a);
  px.put(Math.round(tx), Math.round(ty), p.core, a);
}

/** Jagged cracks running out from a spot on the ground, glowing with chi along their seams. */
function cracks(px: Px, x: number, y: number, R: number, n: number, seed: number, p: Pal, a: number, grow: number): void {
  for (let i = 0; i < n; i++) {
    let th = (i / n) * Math.PI * 2 + hash(i, seed) * 0.6;
    let qx = x;
    let qy = y;
    const steps = 4;
    for (let j = 1; j <= steps; j++) {
      if (j / steps > grow) break;
      th += (hash(i, seed, j) - 0.5) * 0.9;
      const d = (R / steps) * (0.7 + hash(j, i, seed) * 0.5);
      const nx = qx + Math.cos(th) * d;
      const ny = qy + Math.sin(th) * d * FLAT;
      // Dark split in the ground, chi glowing in it near the heart and dying out along it.
      line(px, qx, qy, nx, ny, CRACK, a);
      if (j < 3) line(px, qx, qy - 1, nx, ny - 1, j < 2 ? p.hot : p.deep, a);
      qx = nx;
      qy = ny;
    }
  }
}

/** A ring of stone spikes bursting up `R` out, holding a moment, then crumbling back into the ground. */
function spikeRing(s: Stage, at: Pt, R: number, n: number, p: Pal, size: number, wait: number): void {
  const seed = Math.random() * 100;
  s.add(
    0.7,
    (L, k) => {
      const up = k < 0.15 ? easeOut(k / 0.15) : k > 0.7 ? 1 - easeIn((k - 0.7) / 0.3) : 1;
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2 + hash(i, seed) * 0.3;
        const x = at.x + Math.cos(th) * R;
        const y = at.y + Math.sin(th) * R * FLAT;
        const h = (5 + hash(i, seed, 1) * 4) * size * up;
        spike(L.ground, x, y, h, 2 + size, Math.cos(th) * 2, p, k > 0.85 ? (1 - k) / 0.15 : 1);
      }
      ring(L.ground, at.x, at.y, R * (0.6 + 0.4 * easeOut(Math.min(1, k * 4))), 1.5, p, 1 - k);
    },
    wait,
  );
  s.add(0.01, () => {}, wait, () => s.sparks(at.x, at.y, 12, [STONE_LIT, STONE_MID, STONE_DARK, p.hot], { speed: R * 1.6, up: 34, g: 120, life: 0.5, spread: 4, z: 2 }));
}

/** The leap: he crouches as dust kicks up, sails over in an arc of chi, and lands in a quake that cracks the ground and throws up stone. */
const quakeLeap = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    gather(s, c.from, p, c.lead, 0.8);
    s.add(c.lead, (L, k, t) => {
      ring(L.ground, c.from.x, c.from.y, 6 + 3 * Math.sin(t * 25) * k, 1, p, k);
    });
    s.sparks(c.from.x, c.from.y, 6, [STONE_MID, STONE_LIT], { speed: 16, up: 8, g: 40, life: 0.4, ground: true, z: 1 });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    // He lands beside the foe, on the side he came from.
    const th = angle(c.at, c.from);
    const land = { x: c.at.x + Math.cos(th) * 9, y: c.at.y + Math.sin(th) * 6 };
    const R = Math.max(14, c.r);
    const from = c.from;
    s.add(0.22, (L, k) => {
      // The arc he flies, a streak of chi behind him.
      const at = (f: number) => ({ x: lerp(from.x, land.x, f), y: lerp(from.y, land.y, f) - 14 - Math.sin(f * Math.PI) * 22 });
      const e = easeOut(k);
      for (let i = 0; i < 10; i++) {
        const f = e - i * 0.04;
        if (f < 0) break;
        const q = at(f);
        dot(L.air, q.x, q.y, i < 2 ? p.core : i < 5 ? p.hot : p.mid, 1, i < 3 ? 2 : 1);
      }
      const q = at(e);
      L.light(q.x, q.y, 22, p.light, 0.6);
    });
    s.add(0.01, () => {}, 0.18, () => {
      s.add(0.6, (L, k) => {
        const a = tail(k, 0.5);
        cracks(L.ground, land.x, land.y, R, 7, 3, p, a, easeOut(Math.min(1, k * 5)));
        ring(L.ground, land.x, land.y, R * easeOut(k), 2, p, 1 - k);
        if (k < 0.2) star(L.air, land.x, land.y - 6, 4, p, 1);
        L.light(land.x, land.y - 6, R * 3, p.light, 1 - k);
      });
      spikeRing(s, land, R * 0.7, 6, p, 0.7, 0);
      smoke(s, land, 4, 0x8a7e70, 3, 0.7, 2);
      for (const h of c.hits) impact(s, h, p, 0.8);
    });
  },
};

/** Stone plates closing over the monk's hide: a grey shell that glints, then flakes away. */
function stoneskin(s: Stage, at: Pt, p: Pal, dur: number): void {
  s.add(dur, (L, k, t) => {
    const a = k < 0.15 ? k / 0.15 : tail(k, 0.75);
    for (let i = 0; i < 9; i++) {
      const th = (i / 9) * Math.PI * 2 + 0.3;
      const z = 4 + (i % 3) * 6;
      const sx = Math.cos(th);
      // Only the plates turned towards us are seen.
      if (Math.sin(th) < -0.2) continue;
      const x = at.x + sx * 6;
      const y = at.y - z - Math.sin(th) * 1;
      disc(L.air, x, y, 2, 1.5, sx < 0 ? STONE_LIT : STONE_MID, a);
      dot(L.air, x + 1, y + 1, STONE_DARK, a);
    }
    // A glint running up the shell.
    const gz = ((t * 1.5) % 1) * 22;
    dot(L.air, at.x - 4, at.y - gz, p.core, a);
    circle(L.ground, at.x, at.y, 8, STONE_MID, a * 0.9, FLAT);
  });
}

/** Mountain's Wrath: stones lift round him as his fist rises; three quakes roll out, each raising a ring of stone spikes, and his skin turns to stone. */
const mountainsWrath = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    gather(s, c.from, p, c.lead, 1.2);
    const seed = Math.random() * 100;
    s.add(c.lead, (L, k, t) => {
      // Pebbles shaking loose and lifting off the ground round him.
      for (let i = 0; i < 8; i++) {
        const th = (i / 8) * Math.PI * 2 + hash(i, seed);
        const d = 10 + hash(i, seed, 1) * 8;
        const x = c.from.x + Math.cos(th) * d + Math.sin(t * 50 + i) * 0.6;
        const y = c.from.y + Math.sin(th) * d * FLAT;
        const z = easeOut(k) * (3 + hash(i, seed, 2) * 7);
        disc(L.ground, x, y + 1, 1.5, 1, CRACK, 0.6);
        dot(L.air, x, y - z, i % 2 ? STONE_LIT : STONE_MID, 1, 2);
      }
      cracks(L.ground, c.from.x, c.from.y, 12, 5, seed, p, k, k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(26, c.r);
    s.shake(220, 0.005);
    [0.45, 0.75, 1].forEach((f, i) => {
      spikeRing(s, c.from, R * f, 6 + i * 3, p, 0.75 + i * 0.2, i * 0.15);
      s.add(0.45, (L, k) => {
        ring(L.ground, c.from.x, c.from.y, R * f * easeOut(k), 2, p, 1 - k);
        L.light(c.from.x, c.from.y - 6, R * 2 * f + 20, p.light, 0.8 * (1 - k));
      }, i * 0.15);
    });
    s.add(0.8, (L, k) => cracks(L.ground, c.from.x, c.from.y, R * 0.9, 9, 7, p, tail(k, 0.5), easeOut(Math.min(1, k * 3))));
    smoke(s, c.from, 6, 0x8a7e70, 4, 0.9, 2);
    stoneskin(s, c.from, p, 1.4);
    c.hits.forEach((h) => s.add(0.01, () => {}, 0.15 * Math.min(2, Math.floor((dist(c.from, h) / R) * 3)), () => impact(s, h, p, 0.9)));
  },
};

// --- The Bladewind ------------------------------------------------------------------------

/** A pale cut: a crisp crescent with gusts of wind peeling off its edge; the heavy one wide, with a ring of wind on the ground. */
function windCut(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const th = angle(from, at);
  const x = at.x;
  const y = at.y - CHEST;
  const flip = Math.random() < 0.5 ? 1 : -1;
  const rot = flip * (0.35 + Math.random() * 0.3);
  const r = heavy ? 12 : 9;
  slash(s, x, y, r, flip > 0 ? -2.6 : -0.5, flip > 0 ? 0.5 : -3.6, heavy ? 2.4 : 1.6, p, heavy ? 0.26 : 0.2, 0.42, rot);
  const pale = mix(p.core, 0xffffff, 0.5);
  s.add(heavy ? 0.4 : 0.3, (L, k) => {
    const a = 1 - k;
    // Gusts streaming on past the foe the way the blow was going.
    for (let i = 0; i < (heavy ? 4 : 2); i++) {
      const sd = (i - (heavy ? 1.5 : 0.5)) * 4;
      const d = -6 + 18 * easeOut(k);
      gust(L.air, x + Math.cos(th) * d - Math.sin(th) * sd, y + Math.sin(th) * d * 0.6 + Math.cos(th) * sd * 0.5, 7 + i, th, (i % 2 ? 2 : -2) * flip, i % 2 ? pale : p.hot, a);
    }
    if (heavy) ring(L.ground, at.x, at.y, 4 + 12 * easeOut(k), 1, p, a, 0.4, 2);
  });
  s.sparks(at.x, at.y, heavy ? 6 : 3, [0xffffff, p.core, p.hot], { speed: 30, up: 14, z: CHEST, dir: th, cone: 0.6, life: 0.3 });
}

/** Wind dash: wind spirals in round his feet; he is gone along a hairline of light, gusts racing after, and the foe is cut in an X. */
const windDash = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const pale = mix(p.core, 0xffffff, 0.5);
    s.add(c.lead, (L, k, t) => {
      for (let i = 0; i < 4; i++) {
        const th = (i / 4) * Math.PI * 2 + t * 9;
        const d = 14 * (1 - easeIn(k)) + 4;
        circle(L.air, c.from.x, c.from.y - 6 - i * 3, d, i % 2 ? pale : p.hot, 0.5 + 0.5 * k, 0.4, th, th + 1.1);
      }
      ring(L.ground, c.from.x, c.from.y, 8, 1, p, k * 0.8, 0.5, 4);
      L.light(c.from.x, c.from.y - 8, 26, p.light, 0.5 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    const a = { x: c.from.x, y: c.from.y - CHEST };
    const b = { x: c.at.x, y: c.at.y - CHEST };
    const pale = mix(p.core, 0xffffff, 0.5);
    s.add(0.45, (L, k) => {
      const reach = easeOut(Math.min(1, k / 0.35));
      const e = { x: lerp(a.x, b.x, reach), y: lerp(a.y, b.y, reach) };
      const fa = 1 - easeIn(k);
      // The hairline: white heart, the palette either side, thinning away.
      line(L.air, a.x, a.y + 1, e.x, e.y + 1, p.mid, fa);
      line(L.air, a.x, a.y - 1, e.x, e.y - 1, p.hot, fa * 0.8);
      line(L.air, a.x, a.y, e.x, e.y, k < 0.5 ? 0xffffff : p.core, fa);
      // Gusts racing along it.
      for (let i = 0; i < 5; i++) {
        const f = (k * 1.6 + i / 5) % 1;
        if (f > reach) continue;
        const sd = (hash(i, 7) - 0.5) * 10;
        gust(L.air, lerp(a.x, b.x, f) - Math.sin(th) * sd, lerp(a.y, b.y, f) + Math.cos(th) * sd * 0.6, 8, th, i % 2 ? 2 : -2, i % 2 ? pale : p.hot, fa);
      }
      L.light(e.x, e.y, 22, p.light, 0.6 * fa);
    });
    // The X when he arrives.
    s.add(0.01, () => {}, 0.18, () => {
      slash(s, b.x, b.y, 9, -2.4, 0.6, 1.8, p, 0.22, 0.4, 0.6);
      slash(s, b.x, b.y, 9, -0.7, -3.7, 1.8, p, 0.22, 0.4, -0.6, 0.06);
      s.add(0.4, (L, k) => ring(L.ground, c.at.x, c.at.y, 4 + 12 * easeOut(k), 1, p, 1 - k, 0.4, 5));
      s.sparks(c.at.x, c.at.y, 8, [0xffffff, p.core, p.hot], { speed: 30, up: 20, z: CHEST, life: 0.35 });
    });
    for (const h of c.hits) s.add(0.01, () => {}, 0.12, () => impact(s, h, p, 0.7));
  },
};

/** A storm cloud hanging over (x, y): dark rolling lumps turning slowly, their bellies lit from within. */
function stormCloud(L: Layers, x: number, y: number, R: number, t: number, p: Pal, a: number, flash: number): void {
  for (let i = 0; i < 7; i++) {
    const th = (i / 7) * Math.PI * 2 + t * 0.8;
    const d = R * 0.45;
    const lx = x + Math.cos(th) * d;
    const ly = y + Math.sin(th) * d * 0.35;
    const r = R * (0.32 + 0.06 * Math.sin(i * 2.3));
    disc(L.air, lx, ly, r, r * 0.55, CLOUD_DARK, a);
    disc(L.air, lx - 1, ly - 1, r * 0.75, r * 0.4, flash > 0 ? mix(CLOUD_MID, p.mid, flash * 0.55) : CLOUD_MID, a);
  }
  disc(L.air, x, y + 1, R * 0.5, R * 0.18, flash > 0.5 ? mix(0x323a52, p.hot, 0.6) : 0x323a52, a);
}

/** Sky Quake: a storm rolls in over the foes, raining wind blades; lightning breaks it, every foe is cut again and again, and the sky slams down. */
const skyQuake = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(18, c.r);
    const pale = mix(p.core, 0xffffff, 0.5);
    gather(s, c.from, p, Math.min(0.4, c.lead), 1);
    const seed = Math.random() * 100;
    s.add(c.lead, (L, k, t) => {
      const cx = c.at.x;
      const cy = c.at.y - 48;
      const grow = easeOut(Math.min(1, k * 2));
      const flash = k > 0.6 && hash(Math.floor(t * 20), seed) > 0.7 ? 1 : 0;
      stormCloud(L, cx, cy, R * grow, t, p, Math.min(1, k * 3), flash * 0.6);
      // Wind blades slanting down out of it, faster as it builds.
      for (let i = 0; i < 10; i++) {
        const life = (t * (1.6 + k * 2) + hash(i, seed)) % 1;
        const x0 = cx + (hash(i, seed, 1) - 0.5) * R * 1.6;
        const y0 = cy + 2 + life * 44;
        if (k < hash(i, seed, 2) * 0.6) continue;
        line(L.air, x0 + life * 8, y0, x0 + life * 8 + 3, y0 - 5, i % 2 ? pale : p.hot, 1 - life * 0.6);
      }
      // The wind turning on the ground under it.
      for (let i = 0; i < 3; i++) circle(L.ground, c.at.x, c.at.y, R * (0.5 + i * 0.25) * grow, i ? p.mid : p.hot, 0.8, FLAT, -t * 5 + i * 2, -t * 5 + i * 2 + 1.6);
      L.light(cx, cy, R * 2.5, p.light, 0.3 + flash * 0.5);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(18, c.r);
    const cx = c.at.x;
    const cy = c.at.y - 48;
    const foes = c.hits.length ? c.hits : [c.at];
    s.shake(200, 0.005);
    s.add(0.8, (L, k, t) => {
      stormCloud(L, cx, cy, R * (1 + 0.2 * k), t, p, 1 - easeIn(k), k < 0.3 ? 1 - k / 0.3 : 0);
      // Lightning down onto every foe at once, crackling.
      if (k < 0.35)
        foes.forEach((h, i) => {
          bolt(L.air, cx + (hash(i, 3) - 0.5) * R, cy + 4, h.x, h.y - 8, p, Math.floor(t * 40) + i * 7, 1 - k / 0.35);
          L.light(h.x, h.y - 10, 30, p.light, 1 - k / 0.35);
        });
      ring(L.ground, c.at.x, c.at.y, R * easeOut(k), 2, p, 1 - k);
      L.light(c.at.x, c.at.y - 20, R * 3, p.light, 0.8 * (1 - k));
    });
    // A flurry of crisp cuts on each foe, then the slam.
    foes.forEach((h, i) => {
      for (let j = 0; j < 3; j++) {
        const rot = (hash(i, j, 9) - 0.5) * 2.2;
        slash(s, h.x, h.y - CHEST, 9, -2.6, 0.5, 1.6, p, 0.2, 0.4, rot, 0.06 + j * 0.1 + i * 0.02);
      }
      s.add(0.01, () => {}, 0.4, () => {
        s.add(0.35, (L, k) => ring(L.ground, h.x, h.y, 3 + 9 * easeOut(k), 1.5, p, 1 - k));
        s.sparks(h.x, h.y, 6, [0xffffff, p.core, p.hot, p.mid], { speed: 28, up: 20, z: 4, life: 0.4 });
      });
    });
    s.add(0.01, () => {}, 0.4, () => smoke(s, c.at, 4, 0x8a96a8, 4, 0.7, 2));
  },
};

// --- The Ronin -------------------------------------------------------------------------------

/** A katana cut: one thin bright crescent, a glint where the edge leaves the foe; the heavy one a second cut crossing it. */
function katana(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const x = at.x;
  const y = at.y - CHEST;
  const flip = from.x <= at.x ? 1 : -1;
  const rot = flip * (0.5 + Math.random() * 0.25);
  slash(s, x, y, 10, flip > 0 ? -2.7 : -0.45, flip > 0 ? 0.45 : -3.6, 1.4, p, 0.18, 0.38, rot);
  if (heavy) slash(s, x, y, 11, flip > 0 ? -0.4 : -2.8, flip > 0 ? -3.5 : 0.35, 1.8, p, 0.22, 0.38, -rot, 0.08);
  // The glint of steel where the edge comes off.
  s.add(0.16, (L, k) => star(L.air, x + flip * 8, y + 3, Math.round(3 * (1 - k)) + 1, p, 1), heavy ? 0.14 : 0.07);
  s.sparks(at.x, at.y, heavy ? 6 : 3, [0xffffff, STEEL, p.hot], { speed: 30, up: 14, z: CHEST, life: 0.28 });
}

/** Iaido: his hand on the hilt and a glint at his hip; then he is through, along one hair-thin line, and a beat later the foe is cut. */
const iaido = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    // Stillness: a ring tightening round his feet, and the blade's glint at the end.
    s.add(c.lead, (L, k) => {
      circle(L.ground, c.from.x, c.from.y, 14 * (1 - easeOut(k)) + 4, p.mid, 0.4 + 0.6 * k, FLAT);
      if (k > 0.7) star(L.air, c.from.x + 4, c.from.y - 9, Math.round(1 + 3 * (k - 0.7) / 0.3), p, 1);
      L.light(c.from.x + 4, c.from.y - 9, 14, p.light, 0.5 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const a = { x: c.from.x, y: c.from.y - CHEST };
    const b = { x: c.at.x, y: c.at.y - CHEST };
    const th = angle(a, b);
    const nx = -Math.sin(th);
    const ny = Math.cos(th);
    s.add(0.55, (L, k) => {
      const reach = easeOut(Math.min(1, k / 0.15));
      const e = { x: lerp(a.x, b.x, reach), y: lerp(a.y, b.y, reach) };
      // The line hangs, then splits in two drifting apart as it fades.
      const sp = k < 0.45 ? 0 : easeOut((k - 0.45) / 0.55) * 3;
      const fa = tail(k, 0.45);
      line(L.air, a.x + nx * sp, a.y + ny * sp, e.x + nx * sp, e.y + ny * sp, k < 0.3 ? 0xffffff : p.core, fa);
      if (sp > 0) line(L.air, a.x - nx * sp, a.y - ny * sp, e.x - nx * sp, e.y - ny * sp, p.hot, fa);
      else line(L.air, a.x, a.y + 1, e.x, e.y + 1, p.mid, fa * 0.7);
      L.light(lerp(a.x, b.x, 0.5), lerp(a.y, b.y, 0.5), 40, p.light, 0.5 * fa);
    });
    // The beat after: the cut opens on the foe.
    s.add(0.01, () => {}, 0.24, () => {
      const rot = 0.5 * (c.from.x <= c.at.x ? 1 : -1);
      slash(s, b.x, b.y, 11, -2.7, 0.45, 2, p, 0.22, 0.32, rot);
      s.add(0.25, (L, k) => {
        star(L.air, b.x, b.y, Math.round(5 * (1 - k)) + 1, p, 1);
        L.light(b.x, b.y, 34, p.light, 1 - k);
      });
      s.sparks(c.at.x, c.at.y, 10, [0xffffff, STEEL, p.core, p.hot], { speed: 36, up: 22, z: CHEST, life: 0.4 });
      for (const h of c.hits) impact(s, h, p, 0.8);
    });
  },
};

/** An X of light left on a struck foe until the sheathe. */
function mark(L: Layers, x: number, y: number, p: Pal, a: number): void {
  line(L.air, x - 3, y - 3, x + 3, y + 3, p.core, a);
  line(L.air, x + 3, y - 3, x - 3, y + 3, p.hot, a);
}

/** Hundred Cuts: glints of steel close round him and he is gone; a streak of light races foe to foe, marking each; he sheathes, and every mark bursts open. */
const hundredCuts = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    s.add(c.lead, (L, k, t) => {
      for (let i = 0; i < 6; i++) {
        const th = (i / 6) * Math.PI * 2 + t * 4;
        const d = 18 * (1 - easeIn(k)) + 2;
        star(L.air, c.from.x + Math.cos(th) * d, c.from.y - 10 + Math.sin(th) * d * 0.5, 1 + Math.round(k), p, 1);
      }
      circle(L.ground, c.from.x, c.from.y, 10, p.mid, k, FLAT);
      L.light(c.from.x, c.from.y - 10, 30 * k + 10, p.light, 0.6 * k);
    });
    // The flash as he vanishes.
    s.add(0.15, (L, k) => {
      if (k < 0.6) star(L.air, c.from.x, c.from.y - 12, 6, p, 1 - k);
      L.light(c.from.x, c.from.y - 12, 50, p.light, 1 - k);
    }, Math.max(0, c.lead - 0.08));
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const home = { x: c.from.x, y: c.from.y - CHEST };
    const foes = c.hits.length ? c.hits : [{ x: c.from.x + 14, y: c.from.y - 8 }, { x: c.from.x - 14, y: c.from.y - 8 }];
    const HOP = 0.07;
    const sheathe = foes.length * HOP + 0.35;
    // The route: out from him through every foe and back home.
    const route = [home, ...foes.map((h) => ({ x: h.x, y: h.y - CHEST })), home];
    route.slice(1).forEach((b, i) => {
      const a = route[i];
      s.add(
        0.32,
        (L, k) => {
          const reach = easeOut(Math.min(1, k / 0.22));
          const back = easeIn(Math.max(0, (k - 0.2) / 0.8));
          const fa = 1 - back;
          const x0 = lerp(a.x, b.x, back * 0.8);
          const y0 = lerp(a.y, b.y, back * 0.8);
          const x1 = lerp(a.x, b.x, reach);
          const y1 = lerp(a.y, b.y, reach);
          line(L.air, x0, y0 + 1, x1, y1 + 1, p.mid, fa);
          line(L.air, x0, y0, x1, y1, k < 0.3 ? 0xffffff : p.core, fa);
          if (k < 0.25) L.light(x1, y1, 24, p.light, 0.8);
        },
        i * HOP,
      );
    });
    foes.forEach((h, i) => {
      const x = h.x;
      const y = h.y - CHEST;
      // The mark waits, flickering, for the sheathe.
      s.add(sheathe - i * HOP, (L, _k, t) => mark(L, x, y, p, 0.6 + 0.4 * Math.abs(Math.sin(t * 20 + i))), i * HOP + 0.04);
      s.add(0.01, () => {}, i * HOP + 0.04, () => s.sparks(h.x, h.y, 3, [0xffffff, STEEL], { speed: 20, up: 10, z: CHEST, life: 0.2 }));
    });
    // Back home: the sheathe, a click of light at his hip.
    s.add(0.2, (L, k) => {
      star(L.air, c.from.x + 4, c.from.y - 9, Math.round(4 * (1 - k)) + 1, p, 1);
      L.light(c.from.x + 4, c.from.y - 9, 30, p.light, 1 - k);
    }, sheathe - 0.08);
    s.add(0.01, () => {}, sheathe, () => {
      s.shake(180, 0.004);
      foes.forEach((h, i) => {
        const x = h.x;
        const y = h.y - CHEST;
        slash(s, x, y, 11, -2.7, 0.45, 2, p, 0.24, 0.36, 0.6);
        slash(s, x, y, 11, -0.45, -3.6, 2, p, 0.24, 0.36, -0.6);
        s.add(0.3, (L, k) => {
          if (k < 0.4) star(L.air, x, y, 5, p, 1 - k / 0.4);
          ring(L.ground, h.x, h.y, 3 + 10 * easeOut(k), 1, p, 1 - k);
          L.light(x, y, 36, p.light, 1 - k);
        });
        s.sparks(h.x, h.y, 8, [0xffffff, STEEL, p.core, p.hot], { speed: 34, up: 24, z: CHEST, life: 0.4 });
        impact(s, h, p, 0.6 + 0.1 * (i % 2));
      });
      s.add(0.4, (L, k) => ring(L.ground, c.from.x, c.from.y, Math.max(20, c.r) * easeOut(k), 1, p, 1 - k, 0.3, 8));
    });
  },
};

export const BLADE_KITS: Record<string, Kit> = {
  'fighter.brawler': { melee: punch, skill: chiBarrage, ult: dragonRush },
  'fighter.monk': { melee: palm, skill: quakeLeap, ult: mountainsWrath },
  'samurai.bladewind': { melee: windCut, skill: windDash, ult: skyQuake },
  'samurai.ronin': { melee: katana, skill: iaido, ult: hundredCuts },
};
