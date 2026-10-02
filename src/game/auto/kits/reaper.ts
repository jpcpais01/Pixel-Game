// The Reaper's effects on the board: his scythe's broad reaps tearing a soul
// loose that flies back into him, Death's step (a streak of shade through
// the foe, a skull mark over it), and the Harvest: a great ghost scythe
// sweeping round him twice, then rising to reap, the souls of all it cut
// streaming home. The Catrina's souls are marigold petals in rose flame.

import { arc, CHEST, clamp01, dist, dither, dot, easeIn, easeOut, FLAT, hash, impact, line, ring, rune, sprite, tail, type Kit, type Layers, type Move, type Pal, type Pt, type Stage } from '../paint';

/** Swings are flat circles round the chest. */
const SWEEP = 0.75;
/** The shade he comes apart into. */
const SHADE = 0x0a120e;
const CAT_SHADE = 0x1a0814;
/** The snath of the scythe. */
const SNATH = 0x3a2a1c;

const later = (s: Stage, wait: number, f: () => void): void => s.add(0.01, () => {}, Math.max(0, wait), f);
const aimOn = (cx: number, cy: number, tx: number, ty: number, sq: number): number => Math.atan2((ty - cy) / sq, tx - cx);
const petals = (look: string) => look === 'catrina';

/** A soul torn from `at` flying back into the reaper at `to` over `dur`, curving up off the foe first. */
function soul(s: Stage, at: Pt, to: Pt, p: Pal, petal: boolean, dur = 0.45, wait = 0): void {
  const seed = Math.random() * 100;
  const side = hash(1, seed) < 0.5 ? -1 : 1;
  const pos = (k: number): Pt => {
    const e = easeIn(k);
    const x = at.x + (to.x - at.x) * e + side * Math.sin(k * Math.PI) * 8;
    const y = at.y - CHEST + (to.y - CHEST - (at.y - CHEST)) * e - Math.sin(k * Math.PI) * 12;
    return { x, y };
  };
  s.add(
    dur,
    (L, k, t) => {
      for (let i = 4; i >= 0; i--) {
        const q = pos(clamp01(k - i * 0.05));
        const col = i === 0 ? p.core : i < 2 ? p.hot : i < 4 ? p.mid : p.deep;
        if (petal && i === 0) {
          const w = Math.floor(t * 14) % 2;
          dot(L.air, q.x, q.y, p.hot, 1, 2);
          dot(L.air, q.x + w, q.y, p.core, 1);
        } else dot(L.air, q.x, q.y, col, 1 - i * 0.12);
      }
      const q = pos(k);
      L.light(q.x, q.y, 14, p.light, 0.5);
    },
    wait,
    () => s.sparks(to.x, to.y - CHEST, 4, [p.core, p.hot], { speed: 14, up: 10, life: 0.35, z: CHEST }),
  );
}

/** The scythe drawn at angle `th` on a flat circle round (cx, cy): its snath out to `r`, the blade curling on round from there. */
function scythe(px: Layers['air'], cx: number, cy: number, r: number, th: number, way: number, p: Pal, a = 1, size = 1): void {
  line(px, cx + Math.cos(th) * 3, cy + Math.sin(th) * 3 * SWEEP, cx + Math.cos(th) * r, cy + Math.sin(th) * r * SWEEP, SNATH, a);
  const n = Math.round(8 * size);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const b = th + way * f * 0.55;
    const rr = r - f * f * 7 * size;
    dot(px, cx + Math.cos(b) * rr, cy + Math.sin(b) * rr * SWEEP, f < 0.25 ? p.core : f < 0.7 ? p.hot : p.mid, a, f < 0.5 && size > 1 ? 2 : 1);
  }
}

/** A reap: a broad crescent before him with the blade riding its head; a soul flies back from the foe. */
function reap(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const cx = from.x;
  const cy = from.y - CHEST;
  const th = aimOn(cx, cy, at.x, at.y - CHEST, SWEEP);
  const r = Math.min(30, Math.max(19, dist(from, at) + 6));
  const way = Math.random() < 0.5 ? 1 : -1;
  // The heavy one is the spin: a whole turn round him.
  const a0 = heavy ? th - way * Math.PI : th - way * 1.5;
  const a1 = heavy ? th + way * Math.PI : th + way * 1.2;
  const dur = heavy ? 0.4 : 0.3;
  s.add(dur, (L, k) => {
    const head = a0 + (a1 - a0) * easeOut(Math.min(1, k / 0.55));
    const back = a0 + (a1 - a0) * easeIn(clamp01((k - 0.2) / 0.8));
    if (Math.abs(head - back) > 0.08) arc(L.air, cx, cy, r, heavy ? 4.5 : 3.6, back, head, p, 1, SWEEP);
    if (k < 0.6) scythe(L.air, cx, cy, r, head, way, p);
    L.light(cx + Math.cos(head) * r * 0.6, cy + Math.sin(head) * r * 0.45, heavy ? 40 : 30, p.light, 0.6 * (1 - k));
  });
  later(s, dur * 0.35, () => {
    impact(s, at, p, heavy ? 1 : 0.75);
    soul(s, at, from, p, false, 0.5, 0.05);
  });
}

/** A little skull of soul-light hanging over a marked foe. */
const MARK = ['.hhh.', 'hcccm', 'c.c.m', 'hcchm', '.mdm.'];

/** Death's step: he comes apart into shade, streaks through the foe, and forms beyond it; a mark hangs over it. */
const deathStep: Move = {
  cast(s, c) {
    const p = c.pal;
    const shade = petals(c.look) ? CAT_SHADE : SHADE;
    s.sparks(c.from.x, c.from.y, 8, [shade, p.mid, p.deep], { speed: 16, up: 18, life: 0.5, z: 10, spread: 6 });
  },
  hit(s, c) {
    const p = c.pal;
    const shade = petals(c.look) ? CAT_SHADE : SHADE;
    const a = c.from;
    const b = c.at;
    const ux = b.x - a.x;
    const uy = b.y - a.y;
    const l = Math.hypot(ux, uy) || 1;
    // A little past the foe: where he forms again.
    const end = { x: b.x + (ux / l) * 8, y: b.y + (uy / l) * 6 };
    s.add(0.45, (L, k) => {
      const n = Math.ceil(dist(a, end));
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        if (f < k * 1.3 - 0.2) continue;
        const x = a.x + (end.x - a.x) * f;
        const y = a.y - CHEST + (end.y - a.y) * f;
        const w = (2 + 2 * f) * (1 - k * 0.5);
        for (let o = -w; o <= w; o++) {
          if (dither(Math.round(x), Math.round(y + o)) > 0.85 - k * 0.6) continue;
          dot(L.air, x, y + o, Math.abs(o) > w - 1 ? p.mid : shade, 1);
        }
        if (k < 0.4) dot(L.air, x, y, f > 0.5 ? p.core : p.hot, 1);
      }
      L.light(end.x, end.y - CHEST, 28, p.light, 0.6 * (1 - k));
    });
    for (const h of c.hits) {
      impact(s, h, p, 1);
      s.add(Math.max(1.2, c.stun + 1), (L, k, t) => {
        const al = tail(k, 0.75);
        const bob = Math.round(Math.sin(t * 6));
        sprite(L.air, h.x, h.y - 28 + bob, MARK, { c: p.core, h: p.hot, m: p.mid, d: p.deep }, al, { ax: 2, ay: 2 });
        L.light(h.x, h.y - 28, 12, p.light, 0.4 * al);
      });
    }
    s.sparks(end.x, end.y, 10, [shade, p.hot, p.mid], { speed: 22, up: 16, life: 0.5, z: 10 });
  },
};

/** The Harvest: a great ghost scythe sweeps round him twice, then rises and reaps; souls stream home from every foe. */
const harvest: Move = {
  cast(s, c) {
    const p = c.pal;
    s.add(c.lead, (L, k, t) => {
      rune(L.ground, c.from.x, c.from.y, 14 * easeOut(Math.min(1, k * 3)), t * 2.4, p, 1);
      L.light(c.from.x, c.from.y - CHEST, 30, p.light, 0.6 * k);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const { x, y } = c.from;
    const R = Math.max(30, c.r);
    const cy = y - CHEST + 2;
    const turns = 0.9;
    const th0 = Math.random() * Math.PI * 2;
    s.add(turns + 0.35, (L, k, t) => {
      const sweepK = clamp01(t / turns);
      const th = th0 + Math.PI * 4 * easeOut(sweepK);
      ring(L.ground, x, y, R, 1, p, 0.6 * tail(k, 0.7), FLAT, 0.3, 5);
      if (t < turns) {
        // Its wake: soul-light swept behind the blade.
        arc(L.air, x, cy, R - 4, 5, th - 1.4, th, p, 1, SWEEP);
        scythe(L.air, x, cy, R, th, 1, p, 1, 1.6);
      } else {
        const rise = clamp01((t - turns) / 0.2);
        const fall = clamp01((t - turns - 0.2) / 0.12);
        const lift = 18 * easeOut(rise) * (1 - fall);
        if (fall < 1) scythe(L.air, x, cy - lift, R * 0.8, -Math.PI / 2, 1, p, 1, 1.6);
      }
      L.light(x, cy, R * 1.6, p.light, 0.7 * tail(k, 0.6));
    });
    later(s, turns + 0.3, () => {
      s.shake(220, 0.005, { x, y });
      s.add(0.4, (L, k) => ring(L.ground, x, y, R * (0.4 + 0.8 * easeOut(k)), 3 * (1 - k) + 0.8, p, 1 - k));
      s.sparks(x, y, 18, [p.core, p.hot, p.mid], { speed: 40, up: 30, life: 0.6, z: 12, spread: R * 0.6 });
      c.hits.forEach((h, i) => {
        impact(s, h, p, 1.1);
        soul(s, h, c.from, p, petals(c.look), 0.55, 0.05 + i * 0.04);
      });
    });
  },
};

export const REAPER_KITS: Record<string, Kit> = {
  'necromancer.reaper': { melee: reap, skill: deathStep, ult: harvest },
};
