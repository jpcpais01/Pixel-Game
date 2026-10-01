// The Shadow heroes' effects on the board: the Sith's red saber, force
// lightning and Dark Dominion; the Cutthroat's daggers, shadow dash and Fan
// of Knives; the Shadow dancer's quick cuts, blink strikes and Eclipse; the
// Bonecaller's soul skulls, rising dead and Soul Storm; the Blood mage's
// lances, blood nova and Blood Moon; the Poltergeist's flung junk, uprising
// and Haunted House; and the Lantern Wraith's scythe, possession and Dead of
// Night.

import {
  angle,
  arc,
  bolt,
  bump,
  CHEST,
  circle,
  clamp01,
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
  orb,
  OVER,
  pool,
  ring,
  rune,
  sprite,
  star,
  stroke,
  tail,
  tri,
  type Kit,
  type Layers,
  type Move,
  type Pal,
  type Pt,
  type Px,
  type Stage,
} from '../paint';
import { castRune, flight, gather, HAND, motes, smoke } from './common';

// --- Shared ---------------------------------------------------------------------------

/** The darkest shade of a pit or a shadow: near black with a touch of red. */
const PIT = 0x0a0206;
/** Steel for daggers: a white point down to a cold grey. */
const STEEL: Pal = { core: 0xffffff, hot: 0xe2eaf4, mid: 0xa4b0c2, deep: 0x5a6476, light: 0xdfe8ff, tints: [0xffffff, 0xe2eaf4, 0xa4b0c2] };
/** A dagger's leather grip. */
const GRIP = 0x3a2a2e;
/** Bone for the risen dead. */
const BONE = 0xe8e2c8;
const BONE_SH = 0x9a9278;
const BONE_DK = 0x3a3428;
/** How flat a blade's sweep is drawn round a body (rounder than the ground). */
const SWEEP = 0.75;

/** The palette pushed a step darker with black at the bottom: shadows and tendrils drawn in the hero's colours. */
const darkPal = (p: Pal): Pal => ({ core: p.hot, hot: p.mid, mid: p.deep, deep: PIT, light: p.light, tints: [p.mid, p.deep, PIT] });

/** A body's middle: where blows land and bands close. */
const chest = (q: Pt): Pt => ({ x: q.x, y: q.y - CHEST });

/** Run `f` after `wait` seconds. */
const later = (s: Stage, wait: number, f: () => void): void => s.add(0.01, () => {}, Math.max(0, wait), f);

/** An angle on a flattened circle round (cx, cy) pointing at (tx, ty), for arcs drawn `sq` flat. */
const aimOn = (cx: number, cy: number, tx: number, ty: number, sq: number): number => Math.atan2((ty - cy) / sq, tx - cx);

/**
 * A blade's sweep from `a0` to `a1` at `k` of its life: the head races round
 * first and the tail chases it, so the crescent grows, then shrinks to nothing.
 * Returns the head's angle, where the blade itself is.
 */
function sweepArc(px: Px, cx: number, cy: number, r: number, w: number, a0: number, a1: number, k: number, p: Pal, sq = SWEEP): number {
  const head = a0 + (a1 - a0) * easeOut(Math.min(1, k / 0.5));
  const back = a0 + (a1 - a0) * easeIn(clamp01((k - 0.22) / 0.78));
  if (Math.abs(head - back) > 0.08) arc(px, cx, cy, r, w, back, head, p, 1, sq);
  return head;
}

/** Two crossing cuts across a body, drawn in fast one after the other and thinning away. */
function crossCut(s: Stage, x: number, y: number, th: number, p: Pal, len = 8, wait = 0): void {
  const life = 0.34;
  s.add(
    life,
    (L, k) => {
      const t = k * life;
      for (let i = 0; i < 2; i++) {
        const tt = t - i * 0.05;
        const grow = clamp01(tt / 0.07);
        if (grow <= 0) continue;
        const fade = 1 - clamp01((tt - 0.1) / 0.18);
        if (fade <= 0) continue;
        const ux = Math.cos(th + i * Math.PI * 0.5);
        const uy = Math.sin(th + i * Math.PI * 0.5) * 0.8;
        const x0 = x - ux * len;
        const y0 = y - uy * len;
        const x1 = x0 + ux * 2 * len * grow;
        const y1 = y0 + uy * 2 * len * grow;
        if (fade > 0.35) stroke(L.air, x0, y0, x1, y1, 1.4 * fade, p, 1, 0);
        else line(L.air, x0, y0, x1, y1, p.mid, fade / 0.35);
        if (grow < 1) dot(L.air, x1, y1, p.core, 1, 2);
      }
      L.light(x, y, 20, p.light, 0.6 * (1 - k));
    },
    wait,
  );
}

/** A hooded figure of shadow, two eyes lit in it: the rogues' afterimages. */
const SHADE = [
  '..aaa..',
  '.abbba.',
  'abbbbba',
  'abcbcba',
  '.abbba.',
  'aabbbaa',
  'abbbbba',
  '.abbba.',
  '.abbba.',
  '..b.b..',
  '..b.b..',
];

function shade(px: Px, x: number, y: number, p: Pal, a: number, flip = false): void {
  sprite(px, x, y, SHADE, { a: p.deep, b: dark(p.deep, 0.55), c: p.core }, a, { s: 2, flip });
}

/** Petals of shadow drifting up out of the dark. */
function petals(s: Stage, at: Pt, p: Pal, n: number, spread = 10, z = 4): void {
  s.sparks(at.x, at.y, n, [p.hot, p.mid, p.deep, p.mid], { speed: 10, up: 20, g: -14, life: 0.8, spread, z });
}

/** Little dark threads streaming from one point to another along a curve: life drained back to the caster. */
function drainStream(s: Stage, from: Pt, to: Pt, p: Pal, dur = 0.8, wait = 0, n = 5): void {
  const bend = (Math.random() - 0.5) * 30;
  const seed = Math.random() * 100;
  s.add(
    dur,
    (L, k) => {
      for (let i = 0; i < n; i++) {
        const f = (k * 1.6 + hash(i, seed) * 0.6) - 0.3;
        if (f < 0 || f > 1) continue;
        const e = easeIn(f);
        const mx = (from.x + to.x) / 2 + bend;
        const my = Math.min(from.y, to.y) - 16;
        // A curve through a point above the middle.
        const x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * mx + e * e * to.x;
        const y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * my + e * e * to.y;
        dot(L.air, x, y, i % 2 ? p.hot : p.core, 1);
        dot(L.air, x - (to.x - from.x) * 0.02, y - (to.y - from.y) * 0.02 + 1, p.mid, 1);
      }
      if (k > 0.55) L.light(to.x, to.y, 16, p.light, 0.5 * bump((k - 0.55) / 0.45));
    },
    wait,
  );
}

// --- The Sith ---------------------------------------------------------------------------

/** A sweep of the red saber: a hot crescent with the blade at its head, white at the heart and crackling, scoring the foe. */
function saber(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const cx = from.x;
  const cy = from.y - CHEST;
  const th = aimOn(cx, cy, at.x, at.y - CHEST, SWEEP);
  const r = Math.min(30, Math.max(16, dist(from, at) + 5));
  const dir = Math.random() < 0.5 ? 1 : -1;
  const half = heavy ? 1.55 : 1.05;
  const a0 = th - half * dir;
  const a1 = th + half * dir;
  const dur = heavy ? 0.3 : 0.22;
  s.add(dur, (L, k, t) => {
    const head = sweepArc(L.air, cx, cy, r, heavy ? 3.6 : 2.6, a0, a1, k, p);
    if (heavy) sweepArc(L.air, cx, cy, r - 5, 1.6, a0, a1, Math.max(0, k - 0.08), p);
    if (k < 0.55) {
      const c = Math.cos(head);
      const sn = Math.sin(head) * SWEEP;
      const x0 = cx + c * 4;
      const y0 = cy + sn * 4;
      const x1 = cx + c * (r + 1);
      const y1 = cy + sn * (r + 1);
      stroke(L.air, x0, y0, x1, y1, 1.3, p, 1);
      line(L.air, x0, y0, x1, y1, p.core);
      dot(L.air, cx + c * 2, cy + sn * 2, 0x3a3640, 1, 2);
      // The unstable blade spits sparks off its edge.
      const seed = Math.floor(t * 40);
      if (hash(seed, 1) > 0.45) {
        const f = 0.4 + hash(seed, 2) * 0.6;
        dot(L.air, x0 + (x1 - x0) * f + (hash(seed, 3) - 0.5) * 4, y0 + (y1 - y0) * f - 1 - hash(seed, 4) * 2, p.hot);
      }
    }
    L.light(cx + Math.cos(th) * r * 0.6, cy + Math.sin(th) * r * 0.45, heavy ? 36 : 26, p.light, 0.7 * (1 - k));
  });
  later(s, dur * 0.3, () => {
    const b = chest(at);
    s.sparks(at.x, at.y, heavy ? 9 : 5, p.tints, { speed: 32, up: 18, z: CHEST, life: 0.3, dir: Math.atan2(at.y - from.y, at.x - from.x), cone: 0.9 });
    // A glowing score across the foe where the blade bit.
    const sc = Math.random() * Math.PI;
    s.add(heavy ? 0.3 : 0.2, (L, k) => {
      const ux = Math.cos(sc) * 5;
      const uy = Math.sin(sc) * 4;
      if (k < 0.5) stroke(L.air, b.x - ux, b.y - uy, b.x + ux, b.y + uy, heavy ? 1.2 : 0.9, p, 1);
      else line(L.air, b.x - ux, b.y - uy, b.x + ux, b.y + uy, p.mid, (1 - k) * 2);
      if (k < 0.4) star(L.air, b.x, b.y, heavy ? 4 : 3, p, 1);
    });
  });
}

/** Force lightning: it crackles round his raised hand, then pours out in two strands onto the first foe and leaps on to the next. */
const forceLightning: Move = {
  cast(s, c) {
    const p = c.pal;
    const side = c.at.x >= c.from.x ? 1 : -1;
    const hx = c.from.x + side * 5;
    const hy = c.from.y - HAND - 3;
    s.add(c.lead, (L, k, t) => {
      const seed = Math.floor(t * 30);
      const n = 1 + Math.floor(k * 3);
      for (let i = 0; i < n; i++) {
        const th = hash(i, seed) * Math.PI * 2;
        const d = 5 + hash(i, seed, 1) * 6 * (0.5 + k);
        bolt(L.air, hx, hy, hx + Math.cos(th) * d, hy + Math.sin(th) * d * 0.8, p, seed + i, 1, 0.9);
      }
      orb(L.air, hx, hy, 1 + 1.6 * k, p);
      L.light(hx, hy, 14 + 18 * k, p.light, 0.65 * k);
    });
    // Darkness pooling round his feet as he calls on it.
    s.add(c.lead + 0.35, (L, k) => pool(L.ground, c.from.x, c.from.y, 9 * easeOut(Math.min(1, k * 3)), PIT, p.deep, tail(k, 0.6), 0.85));
  },
  hit(s, c) {
    const p = c.pal;
    const side = c.at.x >= c.from.x ? 1 : -1;
    const hand = { x: c.from.x + side * 5, y: c.from.y - HAND - 3 };
    const pts = c.path.length ? c.path : c.hits.length ? c.hits : [c.at];
    const HOP = 0.06;
    s.add(0.5, (L, k, t) => {
      const seed = Math.floor(t * 35);
      const a = tail(k, 0.6);
      let prev = hand;
      for (let i = 0; i < pts.length; i++) {
        if (k * 0.5 < i * HOP) break;
        const to = chest(pts[i]);
        bolt(L.air, prev.x, prev.y, to.x, to.y, p, seed + i * 13, a, 0.7);
        if (i === 0) bolt(L.air, prev.x, prev.y - 2, to.x, to.y + 2, p, seed + 77, a, 0.9);
        // The bolts wrap round the body they hit.
        for (let j = 0; j < 2; j++) {
          const th = hash(j, seed, i) * Math.PI * 2;
          bolt(L.air, to.x, to.y, to.x + Math.cos(th) * 6, to.y + Math.sin(th) * 7, p, seed + j + i * 5, a, 1);
        }
        L.light(to.x, to.y, 22, p.light, 0.75 * (1 - k));
        prev = to;
      }
      orb(L.air, hand.x, hand.y, 2.5 * (1 - k) + 0.5, p, a);
      L.light(hand.x, hand.y, 24, p.light, 0.7 * (1 - k));
    });
    pts.forEach((h, i) => later(s, i * HOP, () => impact(s, h, p, 0.8)));
    // The slow: a last few sparks still crawling over them.
    for (const h of pts)
      s.add(0.8, (L, k, t) => {
        const seed = Math.floor(t * 20);
        if (hash(seed, Math.round(h.x)) > 0.55) return;
        const b = chest(h);
        const th = hash(seed, 2, Math.round(h.y)) * Math.PI * 2;
        bolt(L.air, b.x + Math.cos(th) * 3, b.y + Math.sin(th) * 4, b.x - Math.cos(th) * 4, b.y - Math.sin(th) * 5, p, seed, 1 - k, 1);
      }, 0.3);
  },
};

/** The pit of Dark Dominion: black ground with a deep rim, a sigil turning backwards, cracks with light running down them to its heart. */
function pit(px: Px, x: number, y: number, r: number, p: Pal, t: number, a: number, pulse: boolean): void {
  if (r < 2 || a <= 0) return;
  pool(px, x, y, r, PIT, p.deep, a, 0.9);
  rune(px, x, y, r * 0.84, -t * 1.6, p, 0.85 * a);
  for (let i = 0; i < 7; i++) {
    const a0 = (i / 7) * Math.PI * 2 + 0.3;
    let cx = x + Math.cos(a0) * r * 0.95;
    let cy = y + Math.sin(a0) * r * 0.95 * FLAT;
    const run = 1 - ((t * 1.6 + i * 0.137) % 1);
    for (let j = 0; j < 5; j++) {
      const u = j / 5;
      const nx = x + (cx - x) * 0.74 + (hash(i, j, 3) - 0.5) * 3;
      const ny = y + (cy - y) * 0.74 + (hash(i, j, 4) - 0.5) * 2;
      const hot = pulse && Math.abs(u - run) < 0.14;
      if (hot || dither(Math.round(nx), Math.round(ny)) < 0.75 * a) line(px, cx, cy, nx, ny, hot ? p.core : j < 2 ? p.mid : p.deep, 1);
      cx = nx;
      cy = ny;
    }
  }
}

/** A dark tendril rising from (x, y) to `h` px, swaying, its tip curling towards `lean`. */
function tendril(px: Px, x: number, y: number, h: number, lean: number, t: number, D: Pal, seed: number): void {
  const n = Math.max(2, Math.round(h / 2));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const wob = Math.sin(t * 9 + seed + f * 5) * 2 * f;
    const qx = x + lean * f * f + wob;
    const qy = y - h * f;
    const c = f > 0.85 ? D.core : f > 0.5 ? D.hot : D.mid;
    dot(px, qx, qy, c, 1);
    if (f < 0.5) dot(px, qx + 1, qy, D.deep, 1);
  }
}

/** Dark Dominion: a pit opens under them, tendrils rise, a band of dark light closes round them; then the fist clenches and they are crushed, held, drained. */
const darkDominion: Move = {
  cast(s, c) {
    const p = c.pal;
    const D = darkPal(p);
    const R = Math.max(16, c.r);
    const { x, y } = c.at;
    gather(s, c.from, p, c.lead, 1.1);
    s.add(c.lead, (L, k, t) => {
      const open = easeOut(Math.min(1, k * 2.5));
      pit(L.ground, x, y, R * open, p, t, 1, true);
      // Tendrils climb out of the rim, curling in as the grip closes.
      for (let i = 0; i < 7; i++) {
        const th = (i / 7) * Math.PI * 2 + 0.6;
        const rx = x + Math.cos(th) * R * 0.8 * open;
        const ry = y + Math.sin(th) * R * 0.8 * FLAT * open;
        tendril(L.air, rx, ry, 6 + 14 * easeOut(k), (x - rx) * 0.5 * k, t, D, i * 1.7);
      }
      // The grip: a band of dark light hanging over the spot, closing in.
      const br = R * (1.05 - 0.5 * easeIn(k));
      ring(L.air, x, y - CHEST, br, 1, D, open, 0.4, 7, 0.42);
      for (let i = 0; i < 4; i++) {
        const th = hash(Math.floor(t * 20), i) * Math.PI * 2;
        dot(L.air, x + Math.cos(th) * br, y - CHEST + Math.sin(th) * br * 0.42, i ? p.hot : p.core, open);
      }
      L.light(x, y - 6, R * 2.2, p.light, 0.35 * open);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const D = darkPal(p);
    const R = Math.max(16, c.r);
    const { x, y } = c.at;
    const hold = Math.max(0.9, c.stun);
    s.shake(160, 0.004);
    // The fist closes: a flash at the heart, a shock rolling out over the ground.
    s.add(0.45, (L, k) => {
      ring(L.ground, x, y, R * (0.25 + 0.9 * easeOut(k)), 3.2 * (1 - k) + 0.8, p, 1 - k);
      if (k < 0.35) {
        orb(L.air, x, y - CHEST, 7 * (1 - k / 0.35) + 1, p);
        for (let i = 0; i < 8; i++) {
          const th = (i / 8) * Math.PI * 2;
          const d = 6 + 22 * easeOut(k / 0.35);
          line(L.air, x + Math.cos(th) * d * 0.5, y - CHEST + Math.sin(th) * d * 0.3, x + Math.cos(th) * d, y - CHEST + Math.sin(th) * d * 0.6, i % 2 ? p.mid : p.hot, 1);
        }
      }
      L.light(x, y - 8, R * 3, p.light, 1 - k);
    });
    // The pit stays open while they are held, then closes over.
    s.add(hold, (L, k, t) => pit(L.ground, x, y, R * (1 - 0.25 * easeIn(clamp01((k - 0.6) / 0.4))), p, t + 2, tail(k, 0.6), false));
    s.sparks(x, y, 16, [p.hot, p.mid, PIT, p.deep], { speed: 40, up: 26, z: 4, life: 0.6, spread: R * 0.5 });
    const caster = chest(c.from);
    for (const h of c.hits) {
      const b = chest(h);
      impact(s, h, p, 1.1);
      // Pressed down: bars of dark force slam onto it from above.
      s.add(0.16, (L, k) => {
        const e = easeIn(k);
        for (const ox of [-5, 0, 5]) {
          const top = h.y - OVER - 6 + (OVER - 2) * e;
          stroke(L.air, h.x + ox, top - 8, h.x + ox * 0.6, top, 0.9, D, 1, 0);
        }
      });
      // Held in a throbbing band of dark light on a tendril from the pit.
      s.add(hold, (L, k, t) => {
        const a = tail(k, 0.7);
        const rr = 7 + Math.sin(t * 22 + h.x) * 0.6 - 1.5 * k;
        ring(L.air, b.x, b.y, rr, 0.9, D, a, 0.38, Math.round(h.x), 0.42);
        for (let i = 0; i < 3; i++) {
          const th = hash(Math.floor(t * 20), i, Math.round(h.x)) * Math.PI * 2;
          dot(L.air, b.x + Math.cos(th) * rr, b.y + Math.sin(th) * rr * 0.42, i ? p.hot : p.core, a);
        }
        if (a > 0.5) for (const side of [-1, 1]) tendril(L.air, h.x + side * 5, h.y + 1, CHEST - 1, -side * 3, t, D, h.x + side);
      });
      drainStream(s, b, caster, p, 0.9, 0.15);
    }
  },
};

// --- The Cutthroat ----------------------------------------------------------------------------

/** A dagger in flight or in the hand: a steel blade bright at the point, a guard in the hero's colour, a dark grip. */
function dagger(px: Px, x: number, y: number, ux: number, uy: number, p: Pal, streak = 0): void {
  for (let i = 0; i < 4; i++) px.put(Math.round(x - ux * i), Math.round(y - uy * i), i === 0 ? STEEL.core : i < 3 ? STEEL.hot : STEEL.mid, 1);
  px.put(Math.round(x - ux * 4 - uy), Math.round(y - uy * 4 + ux), p.mid, 1);
  px.put(Math.round(x - ux * 4 + uy), Math.round(y - uy * 4 - ux), p.mid, 1);
  px.put(Math.round(x - ux * 4), Math.round(y - uy * 4), p.deep, 1);
  px.put(Math.round(x - ux * 5), Math.round(y - uy * 5), GRIP, 1);
  for (let i = 7; i < 7 + streak; i++) {
    const qx = Math.round(x - ux * i);
    const qy = Math.round(y - uy * i);
    if (dither(qx, qy) < 0.6 * (1 - (i - 7) / streak)) px.put(qx, qy, p.mid, 1);
  }
}

/** A quick stab: a dagger darts in from one side and out again, a glint where it bites. Its third, the cross, cuts an X. */
function stab(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const b = chest(at);
  if (heavy) {
    crossCut(s, b.x, b.y, -Math.PI / 4 + (Math.random() - 0.5) * 0.4, p, 8);
    // Both daggers flash at the ends of the cuts.
    s.add(0.14, (L, k) => {
      for (const sd of [-1, 1]) dagger(L.air, b.x + sd * (6 + 4 * k), b.y - 4 + 6 * k, sd * 0.7, 0.7, p);
    });
    later(s, 0.06, () => s.sparks(at.x, at.y, 8, [STEEL.core, p.hot, p.mid], { speed: 34, up: 20, z: CHEST, life: 0.35 }));
    return;
  }
  const th = Math.atan2(b.y - (from.y - CHEST), b.x - from.x);
  const off = (Math.random() - 0.5) * 6;
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  const tx = b.x - uy * off + (Math.random() - 0.5) * 2;
  const ty = b.y + ux * off * 0.6 + (Math.random() - 0.5) * 4;
  s.add(0.18, (L, k) => {
    // In fast, a moment buried, out again.
    const d = k < 0.4 ? -12 + 15 * easeOut(k / 0.4) : 3 - 9 * easeIn((k - 0.4) / 0.6);
    dagger(L.air, tx + ux * d, ty + uy * d, ux, uy, p, k < 0.4 ? 6 : 0);
    if (k > 0.35 && k < 0.7) star(L.air, tx + ux * 2, ty + uy * 2, 2, p, 1);
  });
  later(s, 0.07, () => s.sparks(at.x, at.y, 4, [STEEL.core, p.hot, p.mid], { speed: 26, up: 14, z: CHEST, life: 0.28, dir: th, cone: 0.7 }));
}

/** Shadow dash: the rogue sinks into a pool of shade, then is a streak of it across the board, cutting the foe at its end. */
const shadowDash: Move = {
  cast(s, c) {
    const p = c.pal;
    const { x, y } = c.from;
    s.add(c.lead + 0.05, (L, k, t) => {
      const r = 10 * easeOut(Math.min(1, k * 3));
      pool(L.ground, x, y, r, PIT, p.deep, 1, 0.85);
      circle(L.ground, x, y, r, p.mid, 0.8, FLAT, t * 4, t * 4 + Math.PI);
      // Wisps of shade curling up round the rogue.
      for (let i = 0; i < 5; i++) {
        const f = (k * 2 + i / 5) % 1;
        const th = (i / 5) * Math.PI * 2 + t * 3;
        dot(L.air, x + Math.cos(th) * (7 - 3 * f), y - 2 - f * 18, f < 0.5 ? p.mid : p.deep, 1 - f);
      }
    });
  },
  hit(s, c) {
    const p = c.pal;
    const D = darkPal(p);
    const a = c.from;
    const b = c.at;
    const flip = b.x < a.x;
    smoke(s, a, 4, 0x2a1a2e, 3, 0.6, 6);
    s.add(0.45, (L, k) => {
      const head = easeOut(Math.min(1, k / 0.4));
      const back = easeIn(clamp01((k - 0.15) / 0.85));
      const hx = lerp(a.x, b.x, head);
      const hy = lerp(a.y, b.y, head) - CHEST;
      const tx = lerp(a.x, b.x, back);
      const ty = lerp(a.y, b.y, back) - CHEST;
      if (head - back > 0.02) stroke(L.air, tx, ty, hx, hy, 3 * (1 - back), D, 1, 0.6);
      // Afterimages left along the way, fading in turn.
      for (let i = 1; i <= 3; i++) {
        const f = i / 4;
        if (head < f) continue;
        const fade = 0.8 - (k - f * 0.4) * 1.6;
        if (fade > 0) shade(L.air, lerp(a.x, b.x, f), lerp(a.y, b.y, f) + 1, p, fade, flip);
      }
      // A shadow scar on the ground along the dash.
      for (let i = 0; i < 12; i++) {
        const f = i / 12;
        if (f > head || hash(i, 3) > 0.7 * (1 - k)) continue;
        dot(L.ground, lerp(a.x, b.x, f), lerp(a.y, b.y, f), p.deep, 1, 2);
      }
      L.light(hx, hy, 20, p.light, 0.5 * (1 - k));
    });
    later(s, 0.15, () => {
      const q = chest(b);
      crossCut(s, q.x, q.y, angle(a, b) + Math.PI / 4, p, 7);
      impact(s, b, p, 0.8);
      smoke(s, b, 3, 0x2a1a2e, 2.5, 0.5, 4);
    });
    // Hard to touch for a moment: wisps of shade still clinging to it where it lands.
    s.add(0.8, (L, k, t) => {
      for (let i = 0; i < 4; i++) {
        const f = (t * 1.5 + i / 4) % 1;
        dot(L.air, b.x + Math.sin(i * 2.1 + t * 4) * 7, b.y - 2 - f * 20, f < 0.5 ? p.mid : p.deep, tail(k, 0.6) * (1 - f));
      }
    }, 0.2);
  },
};

const KNIVES = 10;
const KNIFE_WAVES = 3;

/** The Fan of Knives: daggers wheel round the rogue as it spins, then three rings of them burst out, each foe cut and bleeding. */
const fanOfKnives: Move = {
  cast(s, c) {
    const p = c.pal;
    const { x, y } = c.from;
    s.add(c.lead, (L, k, t) => {
      // Knives fanned out in a turning wheel, closing in and spinning faster.
      const r = 12 - 5 * easeIn(k);
      const spin = t * (6 + 14 * k);
      for (let i = 0; i < 6; i++) {
        const th = spin + (i / 6) * Math.PI * 2;
        const ux = Math.cos(th);
        const uy = Math.sin(th) * FLAT;
        dagger(L.air, x + ux * r, y - CHEST + uy * r, -uy, ux * FLAT, p);
      }
      circle(L.ground, x, y, 10 * easeOut(k), p.mid, 1, FLAT, -spin, -spin + Math.PI * 1.2);
      L.light(x, y - CHEST, 20 + 10 * k, p.light, 0.5 * k);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const { x, y } = c.from;
    const R = Math.max(20, c.r) + 10;
    const cy = y - CHEST;
    const face = angle(c.from, c.at);
    for (let w = 0; w < KNIFE_WAVES; w++) {
      const off = face + ((w % 2) * Math.PI) / KNIVES;
      s.add(
        0.3,
        (L, k) => {
          const d = 6 + R * easeOut(k);
          for (let i = 0; i < KNIVES; i++) {
            const th = off + (i / KNIVES) * Math.PI * 2;
            const ux = Math.cos(th);
            const uy = Math.sin(th) * FLAT;
            const n = Math.hypot(ux, uy);
            if (k > 0.8 && dither(i, w) > (1 - k) * 5) continue;
            dagger(L.air, x + ux * d, cy + uy * d, ux / n, uy / n, p, 5);
          }
          ring(L.ground, x, y, 4 + R * 0.6 * easeOut(k), 1.5, p, 1 - k);
        },
        w * 0.1,
      );
    }
    // The spin: two blurred crescents whirling round the body.
    s.add(0.35, (L, k, t) => {
      const a0 = t * 24;
      for (let i = 0; i < 2; i++) arc(L.air, x, cy, 9, 2, a0 + i * Math.PI, a0 + i * Math.PI + 1.8, p, 1 - k, 0.5);
      L.light(x, cy, 40, p.light, 0.6 * (1 - k));
    });
    s.sparks(x, y, 10, [STEEL.core, STEEL.hot, p.hot, p.mid], { speed: 44, up: 16, z: CHEST, life: 0.4 });
    for (const h of c.hits) {
      impact(s, h, p, 0.9);
      bleed(s, h, p, 1.1);
    }
  },
};

/** Bleeding: drops falling from a cut body and a little stain spreading under it. */
function bleed(s: Stage, at: Pt, p: Pal, dur: number): void {
  const seed = Math.random() * 100;
  s.add(dur, (L, k, t) => {
    const a = tail(k, 0.6);
    pool(L.ground, at.x + 2, at.y + 1, 2 + 3 * easeOut(k), p.deep, dark(p.deep, 0.3), a, 0.9);
    for (let i = 0; i < 3; i++) {
      const f = (t * 2.4 + hash(i, seed)) % 1;
      const ox = (hash(i, seed, 1) - 0.5) * 8;
      dot(L.air, at.x + ox, at.y - CHEST + 2 + easeIn(f) * (CHEST - 2), i ? p.mid : p.hot, a);
    }
  });
}

// --- The Shadow dancer --------------------------------------------------------------------------

/** A dancer's cut: a quick slash of violet across the body, the other way each time; its last crosses two and sheds petals. */
function dancerCut(s: Stage, at: Pt, _from: Pt, p: Pal, heavy: boolean): void {
  const b = chest(at);
  if (heavy) {
    crossCut(s, b.x, b.y, -Math.PI / 4, p, 9);
    petals(s, at, p, 8, 8, CHEST);
    s.add(0.25, (L, k) => L.light(b.x, b.y, 34, p.light, 0.7 * (1 - k)));
    return;
  }
  const up = Math.random() < 0.5 ? 1 : -1;
  const th = up > 0 ? -0.6 : 0.6;
  const len = 9;
  s.add(0.2, (L, k) => {
    const ux = Math.cos(th) * up;
    const uy = Math.sin(th) * up;
    const grow = easeOut(Math.min(1, k / 0.35));
    const back = easeIn(clamp01((k - 0.3) / 0.7));
    const x0 = b.x - ux * len;
    const y0 = b.y - uy * len;
    const hx = x0 + ux * 2 * len * grow;
    const hy = y0 + uy * 2 * len * grow;
    const tx = x0 + ux * 2 * len * back;
    const ty = y0 + uy * 2 * len * back;
    stroke(L.air, tx, ty, hx, hy, 1.5 * (1 - back * 0.6), p, 1, 0.7);
    if (grow < 1) dot(L.air, hx, hy, p.core, 1, 2);
    L.light(b.x, b.y, 22, p.light, 0.5 * (1 - k));
  });
  later(s, 0.05, () => petals(s, at, p, 3, 4, CHEST));
}

/** Blink strike: she melts into shadow, then is beside foe after foe in turn, a cross cut on each and a ghost of her left behind. */
const blinkStrike: Move = {
  cast(s, c) {
    const p = c.pal;
    const { x, y } = c.from;
    s.add(c.lead, (L, k, t) => {
      pool(L.ground, x, y, 9 * easeOut(Math.min(1, k * 3)), PIT, p.deep, 1, 0.85);
      // A spiral of petals winding up round her.
      for (let i = 0; i < 8; i++) {
        const f = (k * 1.5 + i / 8) % 1;
        const th = t * 6 + i * 0.8;
        const r = 9 * (1 - f * 0.5);
        dot(L.air, x + Math.cos(th) * r, y - 2 - f * 22 + Math.sin(th) * r * 0.4, f < 0.4 ? p.hot : p.mid, 1 - f * 0.8);
      }
      L.light(x, y - CHEST, 24, p.light, 0.4 * k);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const pts = c.path.length ? c.path : c.hits.length ? c.hits : [c.at];
    const HOP = 0.12;
    petals(s, c.from, p, 8, 8, 10);
    let prev = c.from;
    pts.forEach((h, i) => {
      const from = prev;
      prev = h;
      const th = angle(from, h);
      // Beside the foe, on the far side from where she came.
      const gx = h.x + Math.cos(th) * 8;
      const gy = h.y + Math.sin(th) * 4;
      s.add(
        0.4,
        (L, k) => {
          // A thread of shadow from where she was, there and gone.
          if (k < 0.3) {
            const a = 1 - k / 0.3;
            for (let j = 0; j <= 14; j++) {
              const f = j / 14;
              const x = lerp(from.x, gx, f);
              const y = lerp(from.y, gy, f) - CHEST - Math.sin(f * Math.PI) * 6;
              if (dither(Math.round(x), Math.round(y)) < a) dot(L.air, x, y, j % 3 ? p.mid : p.hot, 1);
            }
          }
          shade(L.air, gx, gy + 1, p, 0.85 * (1 - easeIn(k)), gx > h.x);
          L.light(h.x, h.y - CHEST, 26, p.light, 0.6 * (1 - k));
        },
        i * HOP,
      );
      const b = chest(h);
      crossCut(s, b.x, b.y, hash(i, 5) * Math.PI, p, 8, i * HOP + 0.02);
      later(s, i * HOP + 0.04, () => {
        impact(s, h, p, 0.7);
        petals(s, { x: gx, y: gy }, p, 5, 6, 8);
      });
    });
  },
};

/** The eclipse in the air over her: a black sun ringed by a burning corona. */
function eclipseSun(L: Layers, x: number, y: number, r: number, p: Pal, t: number, a: number): void {
  if (r < 1 || a <= 0) return;
  for (let i = 0; i < 16; i++) {
    const th = (i / 16) * Math.PI * 2 + t * 0.8;
    const flare = r + 1.5 + (1 + Math.sin(t * 9 + i * 2.3)) * (i % 2 ? 1 : 2);
    line(L.air, x + Math.cos(th) * (r + 1), y + Math.sin(th) * (r + 1), x + Math.cos(th) * flare, y + Math.sin(th) * flare, i % 2 ? p.mid : p.hot, a);
  }
  circle(L.air, x, y, r + 1, p.core, a, 1);
  disc(L.air, x, y, r, r, 0x07040e, a);
  L.light(x, y, r * 6, p.light, 0.5 * a);
}

/** The Eclipse: darkness spills out round her under a black sun, and from it a storm of blades crosses every foe inside. */
const eclipse: Move = {
  cast(s, c) {
    const p = c.pal;
    const R = Math.max(16, c.r);
    const { x, y } = c.from;
    s.add(c.lead, (L, k, t) => {
      const open = easeOut(k);
      pool(L.ground, x, y, R * open, 0x0c0616, p.deep, open, 0.75);
      circle(L.ground, x, y, R * open, p.mid, open);
      eclipseSun(L, x, y - OVER - 8, 5 * easeOut(Math.min(1, k * 2)), p, t, 1);
    });
    later(s, c.lead * 0.4, () => petals(s, c.from, p, 6, R, 2));
  },
  hit(s, c) {
    const p = c.pal;
    const R = Math.max(16, c.r);
    const { x, y } = c.from;
    const life = 1.3;
    s.add(life, (L, k, t) => {
      const open = 1 - easeIn(clamp01((k - 0.7) / 0.3));
      pool(L.ground, x, y, R * open, 0x0c0616, p.deep, open, 0.75);
      circle(L.ground, x, y, R * open, p.mid, open * 0.9);
      circle(L.ground, x, y, R * open - 2, p.deep, open * 0.6, FLAT, t * 2, t * 2 + Math.PI);
      // The black sun flares at the stroke, then wanes.
      eclipseSun(L, x, y - OVER - 8, 5 + (k < 0.1 ? 2 * (1 - k / 0.1) : 0), p, t, tail(k, 0.6));
      if (k < 0.1) L.light(x, y - 10, R * 3, p.light, 1 - k / 0.1);
    });
    s.shake(130, 0.003);
    // The storm of cuts: each foe crossed again and again, and the dark between cut too.
    const CUTS = 10;
    for (let i = 0; i < CUTS; i++) {
      const wait = i * 0.06;
      const h = c.hits.length && i % 3 !== 2 ? c.hits[i % c.hits.length] : null;
      let px: number;
      let py: number;
      if (h) {
        px = h.x + (Math.random() - 0.5) * 4;
        py = h.y - CHEST + (Math.random() - 0.5) * 6;
      } else {
        const th = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * R * 0.85;
        px = x + Math.cos(th) * d;
        py = y + Math.sin(th) * d * FLAT - CHEST;
      }
      crossCut(s, px, py, Math.random() * Math.PI, p, h ? 8 : 6, wait);
      if (h) later(s, wait, () => s.sparks(h.x, h.y, 3, p.tints, { speed: 24, up: 18, z: CHEST, life: 0.3 }));
    }
    for (const h of c.hits) impact(s, h, p, 0.9);
    for (let i = 0; i < 4; i++) later(s, 0.15 + i * 0.2, () => petals(s, c.from, p, 4, R * 1.2, 2));
  },
};

// --- The Bonecaller --------------------------------------------------------------------------------

/** A soul: a pale little skull with hollow eyes and a ragged jaw. */
const SKULL = ['.hch.', 'hcccc', 'ceced', 'hcccm', '.m.m.'];

function skull(px: Px, x: number, y: number, p: Pal, a = 1, flip = false): void {
  for (let j = 0; j < SKULL.length; j++)
    for (let i = 0; i < 5; i++) {
      const ch = SKULL[j][flip ? 4 - i : i];
      if (ch === '.') continue;
      const X = Math.round(x + i - 2);
      const Y = Math.round(y + j - 3);
      if (a < 1 && dither(X, Y) >= a) continue;
      px.put(X, Y, ch === 'c' ? p.core : ch === 'h' ? p.hot : ch === 'm' ? p.mid : p.deep, 1);
    }
}

/** A wailing soul flown at the foe: a skull trailing a wavering wisp. */
function soulShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 4);
  const flip = b.x < a.x;
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    for (let i = 7; i >= 1; i--) {
      const r = pos(Math.max(0, k - i * 0.03));
      const wob = Math.sin(t * 30 - i * 0.9) * i * 0.3;
      const x = Math.round(r.x);
      const y = Math.round(r.y + wob);
      if (dither(x, y) < 1 - i / 8) dot(L.air, x, y, i < 3 ? p.hot : i < 5 ? p.mid : p.deep, 1);
    }
    skull(L.air, q.x, q.y, p, 1, flip);
    L.light(q.x, q.y, 16, p.light, 0.6);
  }, 0, () => {
    impact(s, b, p, 0.7);
    motes(s, b, [p.hot, p.mid], 4, 5);
  });
}

/** A risen skeleton, arms up and clawing, eyes lit. */
const SKELETON = [
  'b.......b',
  'w.......w',
  'w..www..w',
  'w.wwwww.w',
  'w.wgwgw.w',
  'w.wwwww.w',
  '.w.wdw.w.',
  '..wwwww..',
  '...wbw...',
  '..wwbww..',
  '...wbw...',
  '..wwbww..',
  '...wbw...',
];

/** Draws the rows of a figure standing in the ground at `feet`, risen `up` px out of it: what is still underground is not drawn. */
function riser(px: Px, x: number, feet: number, rows: string[], cols: Record<string, number>, up: number, a: number): void {
  const h = rows.length;
  const w = rows[0].length;
  const top = Math.round(feet - up);
  for (let j = 0; j < h; j++) {
    const Y = top + j;
    if (Y >= feet) break;
    for (let i = 0; i < w; i++) {
      const ch = rows[j][i];
      if (ch === '.') continue;
      const X = Math.round(x - w / 2 + i);
      if (a < 1 && dither(X, Y) >= a) continue;
      px.put(X, Y, cols[ch], 1);
    }
  }
}

/** Raise dead: a sickly sigil spreads on the ground, then under each foe in turn a grave splits and a skeleton claws up out of it. */
const raiseDead: Move = {
  cast(s, c) {
    const p = c.pal;
    castRune(s, c.from, p, c.lead + 0.3, 10);
    gather(s, c.from, p, c.lead, 0.9);
    const R = Math.max(14, c.r);
    s.add(c.lead + 0.4, (L, k, t) => {
      const a = tail(k, 0.75);
      pool(L.ground, c.at.x, c.at.y, R * easeOut(Math.min(1, k * 2)), dark(p.deep, 0.5), p.deep, a * 0.8, 0.7);
      rune(L.ground, c.at.x, c.at.y, R * 0.8 * easeOut(Math.min(1, k * 2)), t * 1.2, p, a);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const pts = c.path.length ? c.path : c.hits;
    const n = Math.max(1, pts.length);
    const cols = { w: BONE, b: BONE_SH, d: BONE_DK, g: p.core };
    pts.forEach((h, i) => {
      // The blow lands when its turn in the span comes; the grave opens just before.
      const strike = (c.span * i) / n;
      const RISE = 0.12;
      const wait = Math.max(0, strike - RISE);
      const gx = h.x + (i % 2 ? 6 : -6);
      const gy = h.y + 2;
      s.add(
        0.75,
        (L, k) => {
          const t = k * 0.75;
          const a = tail(k, 0.7);
          // The grave: a split in the ground, glowing at its lips.
          disc(L.ground, gx, gy, 6, 2.5, PIT, a);
          circle(L.ground, gx, gy, 6, p.mid, a, 0.42);
          // Up, a lunge at the foe, then back down.
          const up = t < RISE ? 13 * easeOut(t / RISE) : t < 0.45 ? 13 : 13 * (1 - easeIn((t - 0.45) / 0.3));
          const lean = t > RISE && t < 0.3 ? Math.sin(((t - RISE) / 0.18) * Math.PI) * 3 * Math.sign(h.x - gx) : 0;
          riser(L.air, gx + lean, gy, SKELETON, cols, up, 1);
          L.light(gx, gy - 6, 18, p.light, 0.5 * a);
        },
        wait,
      );
      later(s, strike, () => {
        impact(s, h, p, 0.8);
        s.sparks(gx, gy, 6, [0x5a4a3a, 0x7a6450, BONE_SH], { speed: 20, up: 36, g: 140, life: 0.5, z: 1 });
        const b = chest(h);
        const sd = Math.sign(h.x - gx) || 1;
        s.add(0.18, (L, k) => {
          for (let j = -1; j <= 1; j++) line(L.air, b.x - sd * 4 + j * 2, b.y - 5 + k * 6, b.x + sd * 2 + j * 2, b.y + 3 + k * 4, j ? p.mid : p.hot, 1 - k);
        });
      });
    });
  },
};

/** A small turning circle of runes under the necromancer's feet. */
function soulRune(px: Px, x: number, y: number, r: number, t: number, p: Pal, a: number): void {
  if (r < 2 || a <= 0) return;
  circle(px, x, y, r, p.mid, a);
  for (let i = 0; i < 6; i++) {
    const th = t * 2.5 + (i / 6) * Math.PI * 2;
    dot(px, x + Math.cos(th) * r, y + Math.sin(th) * r * FLAT, p.core, a);
    line(px, x + Math.cos(th) * r * 0.5, y + Math.sin(th) * r * 0.5 * FLAT, x + Math.cos(th) * r * 0.8, y + Math.sin(th) * r * 0.8 * FLAT, p.deep, a);
  }
}

const SOULS = 8;

/** One soul of the storm with its wisp tail along the orbit behind it. */
function orbitSoul(L: Layers, x: number, y: number, base: number, rr: number, i: number, t: number, p: Pal, a: number): void {
  const cy = y - 12;
  for (let j = 7; j >= 1; j--) {
    const b = base - j * 0.075;
    const tx = x + Math.cos(b) * rr;
    const ty = cy + Math.sin(b) * rr * 0.62 - Math.sin(t * 8 + i) * 2 + j * 0.4;
    const col = j < 3 ? p.hot : j < 5 ? p.mid : p.deep;
    if (dither(Math.round(tx), Math.round(ty)) < a * (1 - j / 9)) L.air.put(Math.round(tx), Math.round(ty), col, 1);
  }
  const sx = x + Math.cos(base) * rr;
  const sy = cy + Math.sin(base) * rr * 0.62 - Math.sin(t * 8 + i) * 2;
  skull(L.air, sx, sy, p, a, Math.sin(base) > 0);
}

/** The Soul Storm: souls well up round him as the runes turn, then whirl out in a ring, biting all they pass and feeding him their life. */
const soulStorm: Move = {
  cast(s, c) {
    const p = c.pal;
    const { x, y } = c.from;
    s.add(c.lead + 0.1, (L, k, t) => {
      soulRune(L.ground, x, y, 14 * easeOut(Math.min(1, k * 3)), t, p, 1);
      // Souls rising out of the ground round him, wheeling closer and faster.
      const n = Math.min(SOULS, 2 + Math.floor(k * SOULS));
      for (let i = 0; i < n; i++) orbitSoul(L, x, y + 6 * (1 - k), t * (2 + 4 * k) + (i / SOULS) * Math.PI * 2, 10, i, t, p, Math.min(1, k * 3));
      L.light(x, y - 12, 30, p.light, 0.5 * k);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const R = Math.max(20, c.r);
    const { x, y } = c.from;
    const life = 1.2;
    s.add(life, (L, k, t) => {
      const out = clamp01((k - 0.65) / 0.35);
      const rr = 10 + (R - 6) * easeOut(Math.min(1, k / 0.4)) + out * 18;
      const a = 1 - out;
      for (let i = 0; i < SOULS; i++) orbitSoul(L, x, y, t * 5 + (i / SOULS) * Math.PI * 2, rr, i, t, p, a);
      soulRune(L.ground, x, y, 14 * a, t, p, a);
      if (k < 0.4) ring(L.ground, x, y, rr, 1.2, p, 1 - k / 0.4);
      L.light(x, y - 12, rr * 1.6, p.light, 0.3 * a);
    });
    const me = chest(c.from);
    c.hits.forEach((h, i) => {
      later(s, 0.08 + i * 0.03, () => impact(s, h, p, 0.8));
      drainStream(s, chest(h), me, p, 0.8, 0.2);
    });
    later(s, 0.9, () => motes(s, c.from, [p.core, p.hot], 6, 8));
  },
};

// --- The Blood mage -----------------------------------------------------------------------------------

/** Blood thrown wide on landing: drops arcing out and a splash drying on the ground. */
function splatter(s: Stage, at: Pt, p: Pal, n: number, h = CHEST, r = 4): void {
  s.sparks(at.x, at.y, n, [p.hot, p.mid, p.deep, p.mid], { speed: 24, up: 30, g: 160, life: 0.5, z: h });
  const seed = Math.random() * 100;
  s.add(0.9, (L, k) => {
    const a = tail(k, 0.5);
    pool(L.ground, at.x, at.y + 1, r * (0.6 + 0.4 * easeOut(Math.min(1, k * 4))), p.mid, p.deep, a, 0.9);
    for (let i = 0; i < 5; i++) {
      const th = hash(i, seed) * Math.PI * 2;
      const d = r + 1 + hash(i, seed, 1) * r;
      dot(L.ground, at.x + Math.cos(th) * d, at.y + 1 + Math.sin(th) * d * FLAT, p.deep, a);
    }
  });
}

/** A lance of blood: a sharp crimson spike, its point first, shedding drops as it flies. */
function lanceShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 2);
  s.add(dur, (L, k) => {
    const q = pos(k);
    const r = pos(Math.max(0, k - 0.1));
    const len = Math.max(1, Math.hypot(q.x - r.x, q.y - r.y));
    const ux = (q.x - r.x) / len;
    const uy = (q.y - r.y) / len;
    stroke(L.air, q.x - ux * 9, q.y - uy * 9, q.x, q.y, 1.4, p, 1, 1);
    line(L.air, q.x - ux * 6, q.y - uy * 6, q.x, q.y, p.hot);
    dot(L.air, q.x, q.y, p.core);
    if (Math.random() < 0.35) s.sparks(q.x - ux * 6, q.y - uy * 6 + CHEST, 1, [p.mid, p.deep], { speed: 2, up: 0, g: 120, life: 0.3, z: CHEST });
    L.light(q.x, q.y, 14, p.light, 0.5);
  }, 0, () => {
    impact(s, b, p, 0.7);
    splatter(s, b, p, 6, CHEST, 3);
  });
}

/** Blood nova: drops are drawn up off the ground into a ball of blood at his chest; then a crimson ring bursts out and spikes of blood stab up where it runs. */
const bloodNova: Move = {
  cast(s, c) {
    const p = c.pal;
    const { x, y } = c.from;
    const seed = Math.random() * 100;
    s.add(c.lead, (L, k) => {
      const hy = y - HAND;
      for (let i = 0; i < 10; i++) {
        const f = (k * 1.8 + hash(i, seed)) % 1;
        const th = hash(i, seed, 1) * Math.PI * 2;
        const d = 18 * (1 - easeIn(f));
        const gx = x + Math.cos(th) * d;
        const gy = y + Math.sin(th) * d * FLAT;
        // Each drop leaves the ground and arcs up to the hand.
        const qx = lerp(gx, x, easeIn(f));
        const qy = lerp(gy, hy, easeOut(f));
        dot(L.air, qx, qy, f > 0.6 ? p.hot : p.mid, 1);
        dot(L.air, qx, qy + 1, p.deep, 1);
      }
      orb(L.air, x, hy, 1 + 2.4 * easeOut(k), p);
      circle(L.ground, x, y, 20 * (1 - 0.5 * easeIn(k)), p.mid, k, FLAT);
      L.light(x, hy, 18 + 20 * k, p.light, 0.6 * k);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const R = Math.max(16, c.r) + 4;
    const { x, y } = c.from;
    const SPIKES = 12;
    s.add(0.6, (L, k) => {
      const rr = R * easeOut(k);
      ring(L.ground, x, y, rr, 3 * (1 - k) + 1, p, 1 - k * k);
      if (k < 0.25) orb(L.air, x, y - HAND, 4 * (1 - k / 0.25) + 1, p);
      // Spikes of blood stab up as the ring passes, then sink.
      for (let i = 0; i < SPIKES; i++) {
        const th = (i / SPIKES) * Math.PI * 2 + 0.13;
        const d = R * (0.55 + 0.35 * (i % 2));
        const born = d / R / 1.2;
        const age = (easeOut(k) * 1 - born) / 0.4;
        if (age <= 0 || age >= 1) continue;
        const hgt = (i % 2 ? 7 : 10) * bump(age);
        const bx = x + Math.cos(th) * d;
        const by = y + Math.sin(th) * d * FLAT;
        tri(L.air, bx - 2, by, bx + 2, by, bx, by - hgt, p.mid, 1);
        line(L.air, bx - 0.5, by - 1, bx, by - hgt, p.hot, 1);
        dot(L.air, bx, by - hgt, p.core, 1);
      }
      L.light(x, y - 8, R * 2.4, p.light, 0.8 * (1 - k));
    });
    s.sparks(x, y, 14, [p.hot, p.mid, p.deep], { speed: 40, up: 30, g: 150, life: 0.5, z: HAND });
    const me = chest(c.from);
    for (const h of c.hits) {
      impact(s, h, p, 0.8);
      splatter(s, h, p, 4, CHEST, 3);
      drainStream(s, chest(h), me, p, 0.75, 0.2, 4);
    }
  },
};

/** The blood moon: a lit crescent edge, a shadowed body and dark seas. */
function moon(px: Px, mx: number, my: number, r: number, p: Pal, a: number): void {
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const X = Math.round(mx + dx);
      const Y = Math.round(my + dy);
      if (a < 1 && dither(X, Y) >= a) continue;
      const lit = Math.hypot(dx + r * 0.35, dy + r * 0.3) < r - 1;
      let col = d > r - 1 ? p.hot : lit ? p.mid : p.deep;
      if (hash(Math.floor((dx + 20) / 2), Math.floor((dy + 20) / 2), 5) > 0.74 && d < r - 1.5) col = dark(col, 0.35);
      if (dx < -r * 0.4 && dy < -r * 0.3 && d < r - 1) col = p.core;
      px.put(X, Y, col, 1);
    }
}

const MOON_H = 58;
const MOON_R = 7;

/** The Blood Moon: a crimson moon rises over the spot, rains lances of blood on foe after foe, then bursts. */
const bloodMoon: Move = {
  cast(s, c) {
    const p = c.pal;
    const { x, y } = c.at;
    gather(s, c.from, p, c.lead, 1.2);
    s.add(c.lead, (L, k) => {
      const rise = easeOut(k);
      const my = y - 26 - (MOON_H - 26) * rise;
      moon(L.air, x, my, MOON_R * (0.5 + 0.5 * rise), p, Math.min(1, k * 2));
      pool(L.ground, x, y, 26 * rise, dark(p.deep, 0.5), p.deep, rise * 0.8, 0.75);
      L.light(x, my, 40, p.light, 0.6 * rise);
      L.light(x, y - 6, 50, p.light, 0.25 * rise);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const { x, y } = c.at;
    const pts = c.path.length ? c.path : c.hits;
    const n = Math.max(1, pts.length);
    const my = y - MOON_H;
    const burst = c.span + 0.2;
    s.add(burst, (L, k, t) => {
      moon(L.air, x, my + Math.sin(t * 3) * 0.6, MOON_R + (k > 0.85 ? (k - 0.85) * 12 : 0), p, 1);
      // A bleeding halo round it.
      circle(L.air, x, my, MOON_R + 3 + Math.sin(t * 8), p.deep, 0.8, 1, t, t + Math.PI * 1.4);
      pool(L.ground, x, y, 26, dark(p.deep, 0.5), p.deep, 0.8, 0.75);
      circle(L.ground, x, y, 26, p.mid, 0.7);
      L.light(x, my, 44, p.light, 0.65);
      L.light(x, y - 6, 60, p.light, 0.3);
    });
    const FALL = 0.12;
    pts.forEach((h, i) => {
      const land = (c.span * i) / n;
      const sx = x + (hash(i, 9) - 0.5) * 10;
      const sy = my + 5;
      s.add(
        FALL,
        (L, k) => {
          const e = easeIn(k);
          const hx = lerp(sx, h.x, e);
          const hy = lerp(sy, h.y - 4, e);
          const ux = h.x - sx;
          const uy = h.y - 4 - sy;
          const len = Math.hypot(ux, uy) || 1;
          stroke(L.air, hx - (ux / len) * 12, hy - (uy / len) * 12, hx, hy, 1.4, p, 1, 1);
          dot(L.air, hx, hy, p.core, 1);
          L.light(hx, hy, 16, p.light, 0.6);
        },
        Math.max(0, land - FALL),
        () => {
          impact(s, h, p, 0.7);
          splatter(s, h, p, 5, 2, 4);
        },
      );
    });
    // The moon bursts: a flash, a ring of blood over the ground, a rain of drops.
    later(s, burst, () => {
      s.shake(150, 0.004);
      s.add(0.55, (L, k) => {
        if (k < 0.4) orb(L.air, x, my, MOON_R + 6 * easeOut(k / 0.4), p, 1 - k / 0.4);
        ring(L.ground, x, y, 4 + 40 * easeOut(k), 3 * (1 - k) + 1, p, 1 - k);
        L.light(x, my, 90, p.light, 1 - k);
        L.light(x, y, 70, p.light, 0.6 * (1 - k));
      });
      s.sparks(x, my + 30, 24, [p.core, p.hot, p.mid, p.deep], { speed: 46, up: 20, g: 120, life: 0.8, z: 30 });
      motes(s, c.from, [p.core, p.hot], 6, 8);
    });
  },
};

// --- The Poltergeist ------------------------------------------------------------------------------

/** Odds and ends the poltergeist flings about, drawn small in their own colours. */
interface Junk {
  rows: string[];
  cols: Record<string, number>;
}

const CHAIR: Junk = { rows: ['l....', 'w....', 'w....', 'lllll', 'wdddw', 'w...w', 'd...d'], cols: { l: 0xb07a48, w: 0x8a5a34, d: 0x5a3820 } };
const BOOK: Junk = { rows: ['RRRRR', 'Rpppp', 'Rpppp', 'RRRRR'], cols: { R: 0x9a2a3a, p: 0xf0e6c8 } };
const CANDLE: Junk = { rows: ['.f.', '.y.', 'ccc', 'ccc', 'ccc', 'bbb'], cols: { f: 0xffe080, y: 0xff9a30, c: 0xf4ecd8, b: 0xb08a3a } };
const VASE: Junk = { rows: ['.bbb.', '..b..', '.bbb.', 'bbbbb', 'blbbb', '.bbb.'], cols: { b: 0x6a7a8a, l: 0xc0ccd8 } };
const CUP: Junk = { rows: ['wwww.', 'pppph', 'wwwwh', '.ww..'], cols: { w: 0xf4f4ff, p: 0xf0a0c0, h: 0xd0d8f0 } };
const TEAPOT: Junk = { rows: ['..k...', '.wwww.', 'swwwwh', '.wppwh', '.wwww.'], cols: { k: 0xf0a0c0, w: 0xf4f4ff, p: 0xf0a0c0, s: 0xd0d8f0, h: 0xd0d8f0 } };

const HOUSE_JUNK = [CHAIR, BOOK, CANDLE, VASE];
const TEA_JUNK = [CUP, TEAPOT, CUP, CUP];

/** One piece of junk turned to `th`, with a ghostly rim of the palette round it. */
function spin(px: Px, x: number, y: number, j: Junk, th: number, rim: number, a = 1): void {
  const h = j.rows.length;
  const w = j.rows[0].length;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const R = Math.ceil(Math.hypot(w, h) / 2) + 1;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const at = (dx: number, dy: number): string => {
    const sx = Math.round(c * dx + s * dy + cx);
    const sy = Math.round(-s * dx + c * dy + cy);
    const row = j.rows[sy];
    return row ? row[sx] ?? '.' : '.';
  };
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const X = Math.round(x + dx);
      const Y = Math.round(y + dy);
      if (a < 1 && dither(X, Y) >= a) continue;
      const ch = at(dx, dy);
      if (ch !== '.') px.put(X, Y, j.cols[ch], 1);
      else if (at(dx + 1, dy) !== '.' || at(dx - 1, dy) !== '.' || at(dx, dy + 1) !== '.' || at(dx, dy - 1) !== '.') px.put(X, Y, rim, 0.9);
    }
}

/** Flung junk: a piece tumbling end over end on a lob, a ghostly wake behind it, breaking on the foe. */
function junkShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const j = HOUSE_JUNK[Math.floor(Math.random() * HOUSE_JUNK.length)];
  const pos = flight(a, b, 8);
  const turn = (Math.random() < 0.5 ? -1 : 1) * 14;
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    for (let i = 6; i >= 1; i--) {
      const r = pos(Math.max(0, k - i * 0.04));
      const x = Math.round(r.x + Math.sin(t * 20 + i) * 0.8);
      const y = Math.round(r.y);
      if (dither(x, y) < 0.8 - i / 8) dot(L.air, x, y, i < 3 ? p.hot : p.mid, 1);
    }
    spin(L.air, q.x, q.y, j, t * turn, p.mid);
    L.light(q.x, q.y, 16, p.light, 0.5);
  }, 0, () => {
    impact(s, b, p, 0.7);
    s.sparks(b.x, b.y, 5, Object.values(j.cols), { speed: 26, up: 30, g: 140, life: 0.45, z: CHEST });
  });
}

/** Little wisps circling over a stunned head. */
function dizzy(s: Stage, at: Pt, p: Pal, sec: number, wait = 0): void {
  s.add(
    sec,
    (L, k, t) => {
      const a = tail(k, 0.75);
      for (let i = 0; i < 3; i++) {
        const th = t * 7 + (i / 3) * Math.PI * 2;
        const x = at.x + Math.cos(th) * 6;
        const y = at.y - HEAD - 2 + Math.sin(th) * 2;
        dot(L.air, x, y, p.core, a);
        dot(L.air, x - Math.sin(th) * 1.5, y + 1, p.mid, a);
      }
    },
    wait,
  );
}

/** Uprising: the junk on the spot starts to rattle on the ground, then leaps up all at once and batters everything there. */
const uprising: Move = {
  cast(s, c) {
    const p = c.pal;
    const R = Math.max(14, c.r);
    const { x, y } = c.at;
    const items = Array.from({ length: 5 }, (_, i) => ({
      j: HOUSE_JUNK[i % HOUSE_JUNK.length],
      x: x + Math.cos(i * 1.3 + 0.4) * R * (0.3 + 0.12 * i),
      y: y + Math.sin(i * 1.3 + 0.4) * R * (0.3 + 0.12 * i) * FLAT,
      th: i * 1.1,
    }));
    s.add(c.lead, (L, k, t) => {
      const a = Math.min(1, k * 3);
      ring(L.ground, x, y, R, 1, p, a * 0.8, 0.35, 3);
      pool(L.ground, x, y, R * easeOut(k), dark(p.deep, 0.4), p.deep, a * 0.6, 0.6);
      // Rattling harder and harder.
      const shake = 0.5 + 2 * k;
      items.forEach((it, i) => {
        const jx = (hash(i, Math.floor(t * 30)) - 0.5) * shake;
        const jy = hash(i, Math.floor(t * 30), 1) * shake * 0.6;
        spin(L.air, it.x + jx, it.y - 3 - jy, it.j, it.th + jx * 0.2, p.mid, a);
      });
      L.light(x, y - 4, R * 2, p.light, 0.4 * k);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const R = Math.max(14, c.r);
    const { x, y } = c.at;
    const items = Array.from({ length: 5 }, (_, i) => ({
      j: HOUSE_JUNK[i % HOUSE_JUNK.length],
      x: x + Math.cos(i * 1.3 + 0.4) * R * (0.3 + 0.12 * i),
      y: y + Math.sin(i * 1.3 + 0.4) * R * (0.3 + 0.12 * i) * FLAT,
      th: i * 1.1,
      up: 16 + (i % 3) * 6,
      turn: (i % 2 ? 1 : -1) * (8 + i * 2),
    }));
    s.add(0.8, (L, k, t) => {
      items.forEach((it) => {
        // Up fast, a hang at the top, then down again with a bump.
        const z = k < 0.2 ? it.up * easeOut(k / 0.2) : k < 0.45 ? it.up : it.up * (1 - easeIn((k - 0.45) / 0.45));
        if (k > 0.9) return;
        spin(L.air, it.x, it.y - 3 - Math.max(0, z), it.j, it.th + t * it.turn, p.mid);
        disc(L.ground, it.x, it.y, 3, 1.5, PIT, 0.5, 0.6);
      });
      ring(L.ground, x, y, R * easeOut(Math.min(1, k * 2.5)), 2, p, 1 - Math.min(1, k * 2));
      L.light(x, y - 12, R * 2.6, p.light, 0.6 * (1 - k));
    });
    later(s, 0.72, () => items.forEach((it) => s.sparks(it.x, it.y, 3, [0x7a6450, 0x5a4a3a, p.mid], { speed: 14, up: 16, g: 100, life: 0.35, z: 1 })));
    s.sparks(x, y, 12, [p.core, p.hot, p.mid], { speed: 30, up: 40, g: 80, life: 0.5, z: 2, spread: R * 0.6 });
    for (const h of c.hits) {
      impact(s, h, p, 0.8);
      if (c.stun) dizzy(s, h, p, c.stun, 0.1);
    }
  },
};

/** A dotted line, its dashes crawling round: the house's spectral beams. */
function dotted(px: Px, x0: number, y0: number, x1: number, y1: number, c: number, t: number, a: number): void {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= n; i++) {
    if ((i + Math.floor(t * 12)) % 4 === 0) continue;
    const X = Math.round(x0 + ((x1 - x0) * i) / n);
    const Y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (a < 1 && dither(X, Y) >= a) continue;
    px.put(X, Y, c, 1);
  }
}

/** The spectral house: walls and a gabled roof, a chimney, a door banging, two windows flickering. `rise` 0..1 lifts it out of the ground. */
function house(px: Px, x: number, y: number, R: number, rise: number, t: number, p: Pal, a: number): void {
  const base = Math.round(y + R * FLAT * 0.35);
  const hw = Math.round(R * 0.75);
  const wall = 22 * rise;
  const top = base - wall;
  const peak = top - 13 * rise;
  dotted(px, x - hw, base, x - hw, top, p.hot, t, a);
  dotted(px, x + hw, base, x + hw, top, p.hot, t, a);
  dotted(px, x - hw, top, x + hw, top, p.mid, t, a);
  dotted(px, x - hw - 3, top + 1, x, peak, p.hot, t, a);
  dotted(px, x + hw + 3, top + 1, x, peak, p.hot, t, a);
  dotted(px, x + hw * 0.45, top - 5 * rise, x + hw * 0.45, top - 11 * rise, p.mid, t, a);
  if (rise < 0.6) return;
  // The door, swinging open and shut.
  const dw = 4;
  const dh = 9;
  const open = Math.abs(Math.sin(t * 7));
  line(px, x - dw, base, x - dw, base - dh, p.mid, a);
  line(px, x + dw, base, x + dw, base - dh, p.mid, a);
  line(px, x - dw, base - dh, x + dw, base - dh, p.mid, a);
  line(px, x - dw, base, x - dw + dw * 2 * (1 - open), base - dh + open * 2, p.core, a);
  // Two windows, lit and flickering.
  for (const sd of [-1, 1]) {
    const wx = Math.round(x + sd * hw * 0.55);
    const wy = Math.round(top + wall * 0.35);
    const lit = (Math.floor(t * 7) + (sd > 0 ? 1 : 0)) % 3 !== 0;
    for (let yy = -2; yy <= 2; yy++)
      for (let xx = -3; xx <= 3; xx++) {
        const edge = Math.abs(yy) === 2 || Math.abs(xx) === 3 || xx === 0;
        if (edge) px.put(wx + xx, wy + yy, p.mid, a);
        else if (lit && dither(wx + xx, wy + yy) < a) px.put(wx + xx, wy + yy, p.hot, 1);
      }
  }
}

/** The endless tea table: a ring of table round them, its cloth scalloped, cups set along it. */
function teaTable(px: Px, x: number, y: number, R: number, rise: number, t: number, p: Pal, a: number): void {
  const r = (R - 6) * rise;
  if (r < 3) return;
  ring(px, x, y - 6, r, 1.6, p, a);
  for (let i = 0; i < 18; i++) {
    const q = (i / 18) * Math.PI * 2 + t * 0.6;
    const cx = x + Math.cos(q) * (r + 2);
    const cy = y - 6 + Math.sin(q) * (r + 2) * FLAT;
    dot(px, cx, cy + 1, p.core, a);
    dot(px, cx, cy + 2, p.hot, a);
    if (i % 3 === 0) {
      const tx = x + Math.cos(q) * r;
      const ty = y - 6 + Math.sin(q) * r * FLAT;
      dot(px, tx, ty - 1, 0xffffff, a);
      dot(px, tx + 1, ty - 1, 0xf0f4ff, a);
      if ((Math.floor(t * 8) + i) % 2) dot(px, tx, ty - 3, p.core, a * 0.6);
    }
  }
}

/** Where piece `i` of `n` whirls inside the house at time `t`. */
function whirlAt(x: number, y: number, i: number, n: number, t: number, rise: number): { x: number; y: number } {
  const q = (i / n) * Math.PI * 2 + t * 3.5 * (i % 2 ? 1 : 1.25);
  const r = (8 + (i % 3) * 7) * rise;
  return { x: x + Math.cos(q) * r, y: y + Math.sin(q) * r * FLAT - (9 + (i % 3) * 5 + Math.sin(t * 5 + i) * 2) * rise };
}

const HAUNT_N = 6;

/** The Haunted House: a spectral house rises over the spot, its furniture whirling round inside, until it falls in and flings everything out. */
const hauntedHouse: Move = {
  cast(s, c) {
    const p = c.pal;
    const R = Math.max(18, c.r);
    const { x, y } = c.at;
    const tea = c.look === 'tea';
    const set = tea ? TEA_JUNK : HOUSE_JUNK;
    gather(s, c.from, p, Math.min(0.5, c.lead), 1);
    s.add(c.lead, (L, k, t) => {
      const rise = easeOut(Math.min(1, k * 1.8));
      const a = 0.75 + 0.25 * Math.sin(t * 20);
      ring(L.ground, x, y, R * rise, 1, p, 0.85);
      pool(L.ground, x, y, R * rise, dark(p.deep, 0.5), p.deep, 0.5 * rise, 0.6);
      if (tea) teaTable(L.air, x, y, R, rise, t, p, a);
      else house(L.air, x, y, R, rise, t, p, a);
      for (let i = 0; i < HAUNT_N; i++) {
        const q = whirlAt(x, y, i, HAUNT_N, t, rise);
        spin(L.air, q.x, q.y, set[i % set.length], t * (i % 2 ? 6 : -5) + i, p.mid, Math.min(1, k * 3));
      }
      L.light(x, y - 16, R * 2.4, p.light, 0.55 * rise);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const R = Math.max(18, c.r);
    const { x, y } = c.at;
    const tea = c.look === 'tea';
    const set = tea ? TEA_JUNK : HOUSE_JUNK;
    s.shake(160, 0.003);
    // It falls in on itself.
    s.add(0.35, (L, k, t) => {
      const a = 1 - k;
      if (tea) teaTable(L.air, x, y + 6 * k, R, 1 - 0.3 * k, t, p, a);
      else house(L.air, x, y + 4 * easeIn(k), R, 1 - easeIn(k), t, p, a);
      if (k < 0.3) orb(L.air, x, y - 14, 8 * (1 - k / 0.3) + 2, p);
      L.light(x, y - 14, R * 4, p.light, 1 - k);
    });
    // Everything inside is flung out and away, tumbling down.
    for (let i = 0; i < HAUNT_N; i++) {
      const start = whirlAt(x, y, i, HAUNT_N, 0, 1);
      const th = Math.atan2(start.y - y, start.x - x) + (Math.random() - 0.5) * 0.6;
      const far = 26 + Math.random() * 16;
      const ex = x + Math.cos(th) * far;
      const ey = y + Math.sin(th) * far * FLAT + 4;
      const j = set[i % set.length];
      s.add(0.55, (L, k, t) => {
        const e = easeOut(k);
        const qx = lerp(start.x, ex, e);
        const qy = lerp(start.y, ey, e) - Math.sin(k * Math.PI) * 12;
        spin(L.air, qx, qy, j, i + t * (i % 2 ? 16 : -14), p.mid, 1 - easeIn(clamp01((k - 0.7) / 0.3)));
      }, 0, () => s.sparks(ex, ey, 4, [...Object.values(j.cols), p.mid], { speed: 18, up: 20, g: 120, life: 0.4, z: 1 }));
    }
    s.add(0.5, (L, k) => ring(L.ground, x, y, R * (0.4 + 0.8 * easeOut(k)), 3 * (1 - k) + 1, p, 1 - k));
    s.sparks(x, y, 22, [0xffffff, ...p.tints], { speed: 44, up: 36, g: 90, life: 0.6, z: 14, spread: 10 });
    smoke(s, c.at, 5, dark(p.deep, 0.2), 4, 0.9, 6);
    for (const h of c.hits) impact(s, h, p, 1);
  },
};

// --- The Lantern Wraith -----------------------------------------------------------------------------

/** A sweep of the wraith's long blade: a wide pale crescent with a hooked tip, ghost-wisps shed off its edge. */
function scythe(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const cx = from.x;
  const cy = from.y - CHEST - 2;
  const th = aimOn(cx, cy, at.x, at.y - CHEST, SWEEP);
  const r = Math.min(32, Math.max(20, dist(from, at) + 8));
  const dir = Math.random() < 0.5 ? 1 : -1;
  const half = heavy ? 1.7 : 1.25;
  const a0 = th - half * dir;
  const a1 = th + half * dir;
  const dur = heavy ? 0.36 : 0.28;
  const seed = Math.random() * 100;
  s.add(dur, (L, k) => {
    const head = sweepArc(L.air, cx, cy, r, heavy ? 4.5 : 3.4, a0, a1, k, p);
    if (k < 0.55) {
      // The blade at the head: a curved hook bending back against the swing.
      const bx = cx + Math.cos(head) * r;
      const by = cy + Math.sin(head) * r * SWEEP;
      for (let i = 0; i <= 6; i++) {
        const f = i / 6;
        const b = head - dir * f * 0.5;
        const rr = r - f * 7;
        dot(L.air, cx + Math.cos(b) * rr, cy + Math.sin(b) * rr * SWEEP, f < 0.3 ? p.core : f < 0.7 ? p.hot : p.mid, 1, f < 0.5 ? 2 : 1);
      }
      line(L.air, cx + Math.cos(head) * 3, cy + Math.sin(head) * 3 * SWEEP, bx, by, 0x2a2e34, 1);
    }
    // Wisps peeling off the arc and rising.
    for (let i = 0; i < 6; i++) {
      const f = hash(i, seed);
      const b = a0 + (a1 - a0) * f;
      const age = k * 1.4 - f * 0.5;
      if (age < 0 || age > 1) continue;
      dot(L.air, cx + Math.cos(b) * (r + 2), cy + Math.sin(b) * r * SWEEP - age * 10, age < 0.5 ? p.hot : p.mid, 1 - age);
    }
    L.light(cx + Math.cos(th) * r * 0.6, cy + Math.sin(th) * r * 0.45, heavy ? 40 : 30, p.light, 0.6 * (1 - k));
  });
  later(s, dur * 0.3, () => {
    impact(s, at, p, heavy ? 1 : 0.7);
    if (heavy) ghostFire(s, at, p, 0.5);
  });
}

/** Ghost fire licking up round a body: little tongues of the palette's light, pale at the root, dark at the tips. */
function ghostFire(s: Stage, at: Pt, p: Pal, sec: number, wait = 0): void {
  const seed = Math.random() * 100;
  s.add(
    sec,
    (L, k, t) => {
      const a = tail(k, 0.6);
      for (let i = 0; i < 5; i++) {
        const ox = (i - 2) * 2.5 + Math.sin(t * 9 + i) * 0.8;
        const h = (4 + hash(i, seed) * 6) * (0.6 + 0.4 * Math.sin(t * 16 + i * 2.1)) * a;
        for (let z = 0; z < h; z++) {
          const f = z / h;
          dot(L.air, at.x + ox + Math.sin(t * 12 + z * 0.8 + i) * f, at.y - 2 - z - Math.abs(i - 2), f < 0.3 ? p.core : f < 0.65 ? p.hot : p.mid, 1);
        }
      }
      L.light(at.x, at.y - 6, 22, p.light, 0.5 * a);
    },
    wait,
  );
}

/** A wailing ghost face, mouth opening and shutting: one who has been possessed. */
const FACE = ['..ggg..', '.ggggg.', 'ggegegg', 'ggggggg', 'gggoggg', 'gggoggg', 'g.g.g.g'];

/** Possess: the wraith comes apart into a wisp that dives into the foe; it burns with ghost fire and its spirit wails over it. */
const possess: Move = {
  cast(s, c) {
    const p = c.pal;
    const { x, y } = c.from;
    s.add(c.lead, (L, k, t) => {
      circle(L.ground, x, y, 9 * easeOut(Math.min(1, k * 3)), p.mid, 1, FLAT, t * 5, t * 5 + Math.PI * 1.4);
      // The body unravels into wisps streaming upward.
      for (let i = 0; i < 7; i++) {
        const f = (k * 2 + i / 7) % 1;
        dot(L.air, x + Math.sin(i * 1.9 + t * 6) * (4 + 3 * f), y - 4 - f * 20, f < 0.4 ? p.hot : p.mid, (1 - f) * Math.min(1, k * 3));
      }
      L.light(x, y - CHEST, 26, p.light, 0.5 * k);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const a = chest(c.from);
    const b = chest(c.at);
    const FLY = 0.16;
    s.add(FLY, (L, k, t) => {
      const e = easeIn(k);
      const x = lerp(a.x, b.x, e);
      const y = lerp(a.y, b.y, e) - Math.sin(k * Math.PI) * 8;
      for (let i = 8; i >= 1; i--) {
        const f = Math.max(0, e - i * 0.05);
        const tx = lerp(a.x, b.x, f) + Math.sin(t * 40 + i) * 1.2;
        const ty = lerp(a.y, b.y, f) - Math.sin(f * Math.PI) * 8;
        if (dither(Math.round(tx), Math.round(ty)) < 1 - i / 9) dot(L.air, tx, ty, i < 3 ? p.hot : i < 6 ? p.mid : p.deep, 1, i < 4 ? 2 : 1);
      }
      orb(L.air, x, y, 3, p);
      dot(L.air, x - 1, y - 1, PIT);
      dot(L.air, x + 1, y - 1, PIT);
      L.light(x, y, 22, p.light, 0.7);
    });
    later(s, FLY, () => {
      impact(s, c.at, p, 1);
      s.sparks(c.at.x, c.at.y, 8, [p.core, p.hot, p.mid], { speed: 20, up: 30, g: -10, life: 0.5, z: CHEST });
    });
    const hold = Math.max(0.8, c.stun);
    for (const h of c.hits.length ? c.hits : [c.at]) {
      ghostFire(s, h, p, hold, FLY);
      s.add(
        hold,
        (L, k, t) => {
          const a2 = Math.min(1, k * 6) * tail(k, 0.7) * 0.85;
          const open = Math.floor(t * 6) % 2;
          const rows = open ? FACE : FACE.map((r, j) => (j === 5 ? 'ggggggg' : r));
          sprite(L.air, h.x + Math.sin(t * 5) * 1.5, h.y - HEAD - 3 + Math.sin(t * 4) * 1, rows, { g: p.hot, e: PIT, o: PIT }, a2);
        },
        FLY,
      );
    }
  },
};

/** An iron lantern with a flame in it. */
const LANTERN = ['..k..', '.kkk.', 'kgfgk', 'kfcfk', 'kgfgk', '.kkk.'];

function lantern(px: Px, x: number, y: number, p: Pal, t: number): void {
  const flick = Math.floor(t * 14) % 3;
  sprite(px, x, y, LANTERN, { k: 0x2a2e34, g: p.mid, f: flick ? p.hot : p.core, c: p.core }, 1);
  dot(px, x, y - 7, 0x2a2e34);
}

/**
 * Night over a round spot: a near-black checker thick on the ground, thin over
 * the heroes so they still show, falling away round a hole of light at (hx, hy).
 */
function night(L: Layers, x: number, y: number, R: number, hx: number, hy: number, hole: number, a: number, col: number): void {
  if (R < 2 || a <= 0) return;
  const ry = Math.ceil(R * FLAT);
  for (let dy = -ry; dy <= ry; dy++)
    for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
      const d = Math.hypot(dx, dy / FLAT) / R;
      if (d > 1) continue;
      const X = Math.round(x + dx);
      const Y = Math.round(y + dy);
      const th = dither(X, Y);
      const hd = Math.hypot(X - hx, (Y - hy) / FLAT) / hole;
      const edge = Math.min(1, (1 - d) * 5) * Math.min(1, Math.max(0, hd - 1) * 2);
      const k = a * edge;
      if (th < k * 0.62) L.ground.put(X, Y, col, 1);
      if (th < k * 0.22) L.air.put(X, Y - 8, col, 1);
    }
}

/** The Dead of Night: the dark falls round the wraith but for its raised lantern, eyes open in it; then the lantern flares and burns all in its light. */
const deadOfNight: Move = {
  cast(s, c) {
    const p = c.pal;
    const R = Math.max(24, c.r);
    const { x, y } = c.from;
    const cala = c.look === 'cala';
    const dusk = cala ? 0x2a0e18 : 0x04060a;
    const seed = Math.random() * 100;
    s.add(c.lead, (L, k, t) => {
      const fall = easeOut(Math.min(1, k * 2));
      const lx = x + 5;
      const ly = y - 26 - 3 * fall;
      night(L, x, y, R * fall, x, y, 14, fall, dusk);
      lantern(L.air, lx, ly + 3, p, t);
      // Eyes opening in the dark, blinking.
      for (let i = 0; i < 6; i++) {
        if (hash(i, seed, Math.floor(t * 5)) > 0.75 * fall) continue;
        const th = hash(i, seed) * Math.PI * 2;
        const d = R * (0.45 + 0.45 * hash(i, seed, 1));
        const ex = x + Math.cos(th) * d;
        const ey = y + Math.sin(th) * d * FLAT - 10;
        dot(L.air, ex - 1, ey, p.hot);
        dot(L.air, ex + 1, ey, p.hot);
      }
      if (cala) candles(L, x, y, R * 0.8, t, p, fall);
      L.light(lx, ly, 30 + 10 * k, p.light, 0.7);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const R = Math.max(24, c.r);
    const { x, y } = c.from;
    const cala = c.look === 'cala';
    const dusk = cala ? 0x2a0e18 : 0x04060a;
    const lx = x + 5;
    const ly = y - 29;
    s.shake(170, 0.004);
    s.add(0.7, (L, k, t) => {
      // The light drives the dark back from the lantern to the rim, and it lifts.
      const hole = 14 + (R + 10) * easeOut(Math.min(1, k * 2));
      night(L, x, y, R, x, y, hole, 1 - k, dusk);
      lantern(L.air, lx, ly + 3, p, t);
      if (k < 0.3) {
        orb(L.air, lx, ly, 3 + 6 * easeOut(k / 0.3), p, 1 - k / 0.3);
        for (let i = 0; i < 10; i++) {
          const th = (i / 10) * Math.PI * 2 + 0.15;
          const d0 = 6 + 26 * easeOut(k / 0.3);
          line(L.air, lx + Math.cos(th) * d0 * 0.4, ly + Math.sin(th) * d0 * 0.4, lx + Math.cos(th) * d0, ly + Math.sin(th) * d0 * 0.75, i % 2 ? p.hot : p.core, 1);
        }
      }
      ring(L.ground, x, y, R * easeOut(k), 3 * (1 - k) + 1, p, 1 - k);
      if (cala) candles(L, x, y, R * 0.8 + k * 10, t, p, 1 - k);
      L.light(lx, ly, R * 2.2, p.light, 0.8 * (1 - k));
    });
    s.sparks(lx, y, 16, [p.core, p.hot, p.mid], { speed: 40, up: 30, z: 26, life: 0.6 });
    if (cala) s.sparks(x, y, 14, [0xffb030, 0xf07a14, 0xffe070], { speed: 30, up: 34, g: 30, life: 1, z: 30, spread: R });
    const hold = Math.max(0.9, c.stun);
    c.hits.forEach((h, i) => {
      later(s, 0.04 + i * 0.03, () => impact(s, h, p, 0.9));
      ghostFire(s, h, p, Math.min(1.2, hold), 0.05);
      // Frozen with fear: shivering marks over the head.
      s.add(hold, (L, k, t) => {
        const a = tail(k, 0.75);
        const j = Math.sin(t * 60) > 0 ? 1 : 0;
        line(L.air, h.x - 4 + j, h.y - HEAD - 5, h.x - 3 + j, h.y - HEAD - 1, p.core, a);
        line(L.air, h.x + 3 + j, h.y - HEAD - 5, h.x + 4 + j, h.y - HEAD - 1, p.core, a);
        dot(L.air, h.x + j, h.y - HEAD - 6, p.hot, a);
      });
    });
  },
};

/** The Calavera's floating ring of candles. */
function candles(L: Layers, x: number, y: number, r: number, t: number, p: Pal, a: number): void {
  for (let i = 0; i < 8; i++) {
    const q = (i / 8) * Math.PI * 2 + t * 0.8;
    const cx = x + Math.cos(q) * r;
    const cy = y + Math.sin(q) * r * FLAT - 10 + Math.sin(t * 4 + i) * 1.5;
    for (let d = 0; d < 3; d++) dot(L.air, cx, cy + d, 0xfff4e0, a);
    dot(L.air, cx, cy - 1, (Math.floor(t * 11) + i) % 2 ? p.hot : p.core, a);
    dot(L.air, cx, cy - 2, p.mid, a * 0.6);
  }
}

export const SHADOW_KITS: Record<string, Kit> = {
  'jedi.sith': { melee: saber, skill: forceLightning, ult: darkDominion },
  'rogue.rogue': { melee: stab, skill: shadowDash, ult: fanOfKnives },
  'rogue.dancer': { melee: dancerCut, skill: blinkStrike, ult: eclipse },
  'necromancer.necro': { shot: soulShot, skill: raiseDead, ult: soulStorm },
  'necromancer.blood': { shot: lanceShot, skill: bloodNova, ult: bloodMoon },
  'phantom.poltergeist': { shot: junkShot, skill: uprising, ult: hauntedHouse },
  'phantom.wraith': { melee: scythe, skill: possess, ult: deadOfNight },
};
