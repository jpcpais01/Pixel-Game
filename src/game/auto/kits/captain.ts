// The Drowned Captain's effects on the board: cutlass strokes and the
// flintlock's ghostly ball for his attacks, the boarding hook flung at a far
// foe for his ability, and the Ghost Ship sailing down the line, its
// broadsides bursting on the foes it passes, for his Special. The Bone
// Admiral draws the same in his own colours.

import { angle, arc, CHEST, clamp01, dist, disc, dither, dot, easeIn, easeOut, FLAT, hash, impact, lerp, line, ring, star, tail, type Kit, type Layers, type Move, type Pal, type Pt, type Px, type Stage } from '../paint';
import { gather, smoke } from './common';

/** Run `f` after `wait` seconds. */
const later = (s: Stage, wait: number, f: () => void): void => s.add(0.01, () => {}, Math.max(0, wait), f);
const chest = (q: Pt): Pt => ({ x: q.x, y: q.y - CHEST });

/** Dark gunports and a dark Jolly Roger. */
const PORT = 0x031210;

/** A cutlass stroke round the foe: a crescent whose head races ahead of its tail. */
function stroke(s: Stage, at: Pt, from: Pt, p: Pal, way: number): void {
  const th = angle(from, at);
  const cx = from.x + Math.cos(th) * 6;
  const cy = from.y - CHEST + Math.sin(th) * 4;
  const a0 = th - way * 1.7;
  const a1 = th + way * 1.7;
  s.add(0.24, (L, k) => {
    const head = a0 + (a1 - a0) * easeOut(Math.min(1, k / 0.5));
    const back = a0 + (a1 - a0) * easeIn(clamp01((k - 0.2) / 0.8));
    if (Math.abs(head - back) > 0.08) arc(L.air, cx, cy, 12, 3, back, head, p, 1, 0.75);
    // The blade at the head of the stroke.
    if (k < 0.5) line(L.air, cx + Math.cos(head) * 4, cy + Math.sin(head) * 3, cx + Math.cos(head) * 13, cy + Math.sin(head) * 9.75, p.core, 1);
    L.light(cx, cy, 26, p.light, 0.5 * (1 - k));
  });
  later(s, 0.07, () => impact(s, at, p, 0.6));
}

/** The flintlock: a flash at his hand, a ghostly ball streaking to the foe, a burst and a puff of green smoke. */
function pistol(s: Stage, at: Pt, from: Pt, p: Pal): void {
  const th = angle(from, at);
  const m = { x: from.x + Math.cos(th) * 9, y: from.y - CHEST + Math.sin(th) * 5 };
  const b = chest(at);
  const fly = Math.max(0.06, dist(m, b) / 420);
  s.add(0.1, (L, k) => {
    star(L.air, m.x, m.y, Math.round(3 * (1 - k)) + 1, p, 1);
    L.light(m.x, m.y, 30, p.light, 0.9 * (1 - k));
  });
  s.add(fly, (L, k) => {
    for (let i = 6; i >= 0; i--) {
      const q = Math.max(0, k - i * 0.07);
      dot(L.air, lerp(m.x, b.x, q), lerp(m.y, b.y, q), i === 0 ? p.core : i < 3 ? p.hot : p.mid, 1 - i * 0.1);
    }
    L.light(lerp(m.x, b.x, k), lerp(m.y, b.y, k), 18, p.light, 0.6);
  });
  smoke(s, { x: m.x, y: m.y + 4 }, 3, p.deep, 2, 0.8, 4);
  later(s, fly, () => {
    impact(s, at, p, 0.9);
    smoke(s, { x: at.x, y: at.y }, 2, p.mid, 2, 0.6, CHEST);
  });
}

const melee = (s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void => {
  if (heavy) pistol(s, at, from, p);
  else stroke(s, at, from, p, Math.random() < 0.5 ? 1 : -1);
};

/** The grappling hook: a shank and three tines pointing along `th`. */
function hookHead(px: Px, x: number, y: number, th: number, p: Pal): void {
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  line(px, x - ux * 4, y - uy * 4, x, y, p.hot);
  for (const s of [-1, 1]) {
    dot(px, x - uy * s * 1.5, y + ux * s * 1.5, p.hot);
    dot(px, x - uy * s * 2.4 - ux, y + ux * s * 2.4 - uy, p.mid);
  }
  dot(px, x + ux, y + uy, p.core);
}

/** The boarding hook: flung out to the far foe on a ghostly rope; then he's hauled in and lands with a heavy cut. */
const boardingHook: Move = {
  cast(s, c) {
    const p = c.pal;
    const a = chest(c.from);
    const b = chest(c.at);
    const th = angle(a, b);
    s.add(c.lead, (L, k, t) => {
      const e = easeOut(Math.min(1, k * 1.3));
      const hx = lerp(a.x, b.x, e);
      const hy = lerp(a.y, b.y, e);
      const n = Math.ceil(dist(a, { x: hx, y: hy }));
      const sag = (1 - e) * 5;
      for (let i = 0; i <= n; i++) {
        const f = i / (n || 1);
        if ((i + Math.floor(t * 20)) % 4 === 0) continue;
        L.air.put(Math.round(lerp(a.x, hx, f)), Math.round(lerp(a.y, hy, f) + Math.sin(f * Math.PI) * sag), i % 3 ? p.mid : p.core, 1);
      }
      hookHead(L.air, hx, hy, th, p);
      L.light(hx, hy, 18, p.light, 0.5);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const R = Math.max(12, c.r);
    s.shake(110, 0.003);
    s.add(0.32, (L, k) => {
      ring(L.ground, c.at.x, c.at.y, R * easeOut(k), 2 * (1 - k) + 0.5, p, 1 - k);
      const head = -Math.PI * 0.9 + Math.PI * 1.8 * easeOut(Math.min(1, k / 0.5));
      const back = -Math.PI * 0.9 + Math.PI * 1.8 * easeIn(clamp01((k - 0.2) / 0.8));
      if (head - back > 0.08) arc(L.air, c.from.x, c.from.y - CHEST + 2, 15, 4, back, head, p, 1, 0.6);
      L.light(c.from.x, c.from.y - 8, 40, p.light, 0.8 * (1 - k));
    });
    s.sparks(c.from.x, c.from.y, 10, [0xffffff, p.core, p.hot, p.mid], { speed: 30, up: 34, g: 120, life: 0.5, z: 2 });
    for (const h of c.hits) impact(s, h, p, 1);
  },
};

/**
 * The galleon in profile at board size, facing `f` (1 right): hull with its
 * castles, a gunport row (flashing), three masts of torn sails bellied ahead,
 * and a pennant; `sink` 0..1 lowers it into the ground, `a` fades it.
 */
function ship(L: Layers, x: number, y: number, f: number, p: Pal, t: number, sink: number, a: number, fire: boolean): void {
  const drop = sink * 40;
  const put = (lx: number, ly: number, c: number, al = 1) => {
    const Y = Math.round(ly + drop);
    if (Y > y + 1) return;
    const X = Math.round(x + lx * f);
    if (dither(X, Y) >= a * al * (0.85 + 0.15 * Math.sin(Y * 0.9 + t * 12))) return;
    L.air.put(X, Y, c, 1);
  };
  const wl = y - 4 + Math.sin(t * 4) * 0.8;
  const deck = (lx: number) => wl - (lx < -11 ? 7 : lx > 12 ? 5 : 3);
  // Masts and sails.
  for (const [mx, h] of [[-12, 18], [0, 27], [11, 21]]) {
    const top = deck(mx) - h;
    for (let yy = top; yy <= deck(mx); yy++) put(mx, yy, p.mid);
    const sails: [number, number, number][] = h > 24 ? [[top + 2, top + 9, 4], [top + 11, deck(mx) - 3, 6]] : [[top + 2, top + 8, 4], [top + 10, deck(mx) - 3, 5]];
    sails.forEach(([s0, s1, hw], i) => {
      for (let yy = s0; yy <= s1; yy++) {
        const v = (yy - s0) / Math.max(1, s1 - s0);
        const belly = Math.round(Math.sin(v * Math.PI) * 2);
        for (let dx = -hw; dx <= hw; dx++) {
          if (yy === s1 && hash(dx, mx, i) < 0.45) continue;
          if (hash(Math.round(dx / 2), yy, mx + i) < 0.08) continue;
          const u = Math.abs(dx) / hw;
          put(mx + dx + belly * (1 - u), yy, Math.abs(dx) === hw || yy === s0 ? p.core : u < 0.4 ? p.hot : p.mid, 0.8);
        }
      }
    });
  }
  // The hull.
  for (let lx = -19; lx <= 19; lx++) {
    const top = deck(lx);
    const bot = wl + 2 - (lx > 11 ? ((lx - 11) / 8) ** 2 * 5 : 0);
    for (let yy = Math.round(top); yy <= bot; yy++) {
      const edge = yy === Math.round(top) || yy >= bot - 0.5 || Math.abs(lx) === 19;
      put(lx, yy, edge ? p.hot : (yy & 1) ? p.mid : p.deep, edge ? 1 : 0.85);
    }
  }
  for (let lx = -13; lx <= 9; lx += 6) put(lx, wl - 1, fire ? p.core : PORT);
  // Bowsprit and pennant.
  for (let i = 0; i <= 8; i++) put(18 + i, wl - 5 - i * 0.55, p.hot);
  for (let i = 0; i < 6; i++) put(-i - 1, deck(0) - 27 + Math.sin(t * 14 - i) * 0.8, i < 2 ? p.core : p.hot);
}

/** The Ghost Ship: it rises behind him, sails down the line firing broadsides into the foes it passes, and sinks in a whirlpool. */
const ghostShip: Move = {
  cast(s, c) {
    const p = c.pal;
    gather(s, c.from, p, Math.min(0.5, c.lead), 1.2);
    s.add(c.lead, (L, k, t) => {
      const R = 10 + 10 * easeOut(k);
      for (let arm = 0; arm < 3; arm++) {
        for (let i = 0; i <= 16; i++) {
          const f = i / 16;
          const q = arm * 2.1 + t * 7 + f * 3.4;
          const X = Math.round(c.from.x + Math.cos(q) * R * (1 - f));
          const Y = Math.round(c.from.y + Math.sin(q) * R * (1 - f) * FLAT);
          if (dither(X, Y) < k) L.ground.put(X, Y, f > 0.6 ? p.core : p.mid, 1);
        }
      }
      L.light(c.from.x, c.from.y - 6, 40, p.light, 0.6 * k);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const SAIL = 1.3;
    const SINK = 0.5;
    const th = angle(c.from, c.at);
    const ux = Math.cos(th);
    const uy = Math.sin(th);
    const start = { x: c.from.x - ux * 14, y: c.from.y - uy * 14 };
    const len = dist(start, c.at);
    const f = ux >= 0 ? 1 : -1;
    const pos = (k: number): Pt => ({ x: start.x + ux * len * k, y: start.y + uy * len * k });
    // Each foe takes its broadside as the ship comes alongside.
    const shots = (c.hits.length ? c.hits : []).map((h) => ({ h, k: clamp01(((h.x - start.x) * ux + (h.y - start.y) * uy) / (len || 1)) }));
    s.shake(150, 0.003);
    s.add(SAIL + SINK, (L, k, t) => {
      const sail = Math.min(1, k * ((SAIL + SINK) / SAIL));
      const sink = clamp01((k * (SAIL + SINK) - SAIL) / SINK);
      const at = pos(easeOut(sail * 0.4 + sail * 0.6 * sail));
      const rise = clamp01(t / 0.2);
      // The mist wake behind it.
      for (let i = 0; i < 8; i++) {
        const q = Math.max(0, sail - i * 0.06);
        const w = pos(easeOut(q * 0.4 + q * 0.6 * q));
        disc(L.ground, w.x, w.y, 7 - i * 0.4, (7 - i * 0.4) * FLAT, i < 3 ? p.mid : p.deep, (1 - i / 8) * 0.7, 0.6);
      }
      const fire = shots.some((o) => Math.abs(o.k - sail) < 0.06);
      ship(L, at.x, at.y, f, p, t, sink + (1 - rise), 1 - sink * 0.4, fire);
      if (sink > 0) {
        // The whirlpool it goes down in.
        const R = 20 * (0.5 + 0.5 * sink);
        for (let arm = 0; arm < 4; arm++) {
          for (let i = 0; i <= 18; i++) {
            const ff = i / 18;
            const q = arm * 1.57 + t * 9 + ff * 3.8;
            L.ground.put(Math.round(at.x + Math.cos(q) * R * (1 - ff)), Math.round(at.y + Math.sin(q) * R * (1 - ff) * FLAT), ff > 0.6 ? p.core : p.mid, tail(sink, 0.6));
          }
        }
      }
      L.light(at.x, at.y - 14, 50, p.light, 0.7 * (1 - sink));
    });
    for (const o of shots) {
      const wait = Math.max(0.05, o.k * SAIL);
      s.add(
        0.16,
        (L, k) => {
          const from = pos(easeOut(o.k * 0.4 + o.k * 0.6 * o.k));
          const x = lerp(from.x, o.h.x, k);
          const y = lerp(from.y - 6, o.h.y - CHEST, k) - Math.sin(k * Math.PI) * 6;
          dot(L.air, x, y, p.core, 1, 2);
          dot(L.air, x - (o.h.x - from.x) * 0.06, y + 1, p.hot);
        },
        wait,
        () => {
          impact(s, o.h, p, 1.1);
          smoke(s, o.h, 2, p.deep, 2.5, 0.7, 4);
          s.shake(60, 0.0015, o.h);
        },
      );
    }
    later(s, SAIL + SINK * 0.8, () => {
      s.sparks(c.at.x, c.at.y, 16, [0xffffff, p.core, p.hot, p.mid], { speed: 34, up: 44, g: 140, life: 0.6, z: 2, spread: 10 });
      s.shake(180, 0.004);
    });
  },
};

export const CAPTAIN_AUTO: Record<string, Kit> = {
  'phantom.captain': { melee, skill: boardingHook, ult: ghostShip },
};
