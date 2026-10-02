// The Transmuter on the board: her quicksilver beads, the chalk circle that
// turns foes to lead, and the Magnum Opus's golden array. The bead is chrome
// warmed a little by the palette (red-gold for Rubedo); the chalk is white
// and glows in the palette; lead is lead whatever she wears.

import { bump, CHEST, circle, column, dot, easeIn, easeOut, FLAT, hash, line, mix, ring, star, type Cast, type Kit, type Layers, type Pal, type Pt, type Px, type Stage } from '../paint';
import { flight, gather, HAND, splash, trail } from './common';

const CHALK = 0xf4f6fa;
const LEAD = [0xd8dce4, 0xa8b0bc, 0x6a707a, 0x3e434c];

/** Quicksilver: chrome, its shine and shadow tinged by the palette. */
const chrome = (p: Pal): Pal => ({
  core: 0xffffff,
  hot: mix(0xdcecf4, p.hot, 0.25),
  mid: mix(0x92a8b8, p.mid, 0.25),
  deep: mix(0x46566a, p.deep, 0.3),
  light: mix(0xc8f4ff, p.light, 0.5),
  tints: [0xffffff, 0xdcecf4, 0x92a8b8],
});

/** A wobbling drop of mercury: bright crown, dark belly, a white glint. */
function drop(px: Px, x: number, y: number, q: Pal, t: number, big: boolean): void {
  const w = Math.sin(t * 40) * 0.3;
  const r = big ? 1.8 : 1.1;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.hypot(dx / (r * (1 + w)), dy / (r * (1 - w))) > 1.05) continue;
      dot(px, x + dx, y + dy, dy < 0 ? q.hot : dy > 0 ? q.deep : q.mid, 1);
    }
  }
  dot(px, x - (big ? 1 : 0), y - 1, q.core, 1);
}

/** The bead flicked at a foe; on the hit it bursts and two smaller beads skip off either side. */
function beadShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const q = chrome(p);
  const pos = flight(a, b, 3);
  s.add(dur, (L, k, t) => {
    const at = pos(k);
    trail(L, pos, k, 4, 0.05, [q.hot, q.mid, q.deep]);
    drop(L.air, at.x, at.y, q, t, true);
    L.light(at.x, at.y, 10, q.light, 0.35);
  }, 0, () => {
    splash(s, b, q, 6, 22, CHEST);
    // The split: two beads leap off to either side and fall.
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    for (const side of [1, -1]) {
      const th = ang + side * 1.1;
      const end = { x: b.x + Math.cos(th) * 12, y: b.y + Math.sin(th) * 12 * FLAT };
      const fly = flight(b, end, 6);
      s.add(0.28, (L, k, t) => {
        const at = fly(k);
        drop(L.air, at.x, at.y + CHEST * k, q, t, false);
      });
    }
  });
}

/** The chalk circle: ring, square, triangle and heart, drawn stroke by stroke round the spot. */
function chalkCircle(L: Layers, at: Pt, R: number, p: Pal, k: number, a: number, lit: number): void {
  const pt = (th: number, r: number): Pt => ({ x: at.x + Math.cos(th) * r, y: at.y + Math.sin(th) * r * FLAT });
  const top = -Math.PI / 2;
  const part = (f: number, t: number) => Math.min(1, Math.max(0, (k - f) / (t - f)));
  const c = (base: number) => (lit > 0.5 ? p.core : base);
  circle(L.ground, at.x, at.y, R, c(CHALK), a, FLAT, top, top + part(0, 0.4) * Math.PI * 2);
  circle(L.ground, at.x, at.y, R - 1.5, c(p.mid), a * 0.8, FLAT, top, top + part(0, 0.4) * Math.PI * 2);
  const sq = [0, 1, 2, 3].map((i) => pt(top + Math.PI / 4 + (i * Math.PI) / 2, R - 1.5));
  const sk = part(0.3, 0.62) * 4;
  for (let i = 0; i < 4; i++) {
    const f = Math.min(1, Math.max(0, sk - i));
    if (f > 0) line(L.ground, sq[i].x, sq[i].y, sq[i].x + (sq[(i + 1) % 4].x - sq[i].x) * f, sq[i].y + (sq[(i + 1) % 4].y - sq[i].y) * f, c(p.mid), a);
  }
  const tr = [0, 1, 2].map((i) => pt(top + (i * Math.PI * 2) / 3, R * 0.68));
  const tk = part(0.5, 0.8) * 3;
  for (let i = 0; i < 3; i++) {
    const f = Math.min(1, Math.max(0, tk - i));
    if (f > 0) line(L.ground, tr[i].x, tr[i].y, tr[i].x + (tr[(i + 1) % 3].x - tr[i].x) * f, tr[i].y + (tr[(i + 1) % 3].y - tr[i].y) * f, c(CHALK), a);
  }
  circle(L.ground, at.x, at.y, R * 0.3, c(CHALK), a, FLAT, top, top + part(0.7, 0.95) * Math.PI * 2);
}

/** Transmutation circle: chalked round the spot as she draws, then it flares and the foes in it turn to lead. */
const transmute = {
  cast(s: Stage, c: Cast): void {
    gather(s, c.from, c.pal, c.lead, 0.6);
    s.add(c.lead, (L, k) => {
      chalkCircle(L, c.at, c.r, c.pal, k, 1, 0);
      L.light(c.at.x, c.at.y, c.r * 1.4, c.pal.light, 0.25 + 0.3 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const hold = Math.max(0.6, c.stun);
    s.add(hold, (L, k) => {
      const lit = Math.max(0, 1 - k * 4);
      chalkCircle(L, c.at, c.r, c.pal, 1, 1 - easeIn(k), lit);
      L.light(c.at.x, c.at.y, c.r * 1.8, c.pal.light, 0.8 * lit + 0.2 * (1 - k));
    });
    // Each foe struck goes grey: a shell of lead over it, a slow sheen running down.
    for (const h of c.hits) {
      s.sparks(h.x, h.y, 6, LEAD, { speed: 18, up: 30, g: 140, life: 0.45, z: CHEST });
      s.add(hold, (L, k, t) => {
        const a = 1 - easeIn(k);
        for (let i = 0; i < 14; i++) {
          const y = h.y - 3 - hash(i, 7) * 18;
          const x = h.x + (hash(i, 9) - 0.5) * 10;
          dot(L.air, x, y, LEAD[1 + (i % 3)], 0.55 * a);
        }
        const sheen = h.y - 22 + ((t * 30) % 24);
        dot(L.air, h.x - 2, sheen, LEAD[0], a);
        dot(L.air, h.x - 1, sheen + 1, LEAD[0], a * 0.7);
      });
    }
  },
};

/** Magnum Opus: a golden array blooms over the spot and gilds the foes; it closes, and they shatter in gold. */
const opus = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    gather(s, c.from, p, c.lead, 1.2);
    s.add(c.lead, (L, k, t) => {
      const R = c.r * easeOut(k * 1.4);
      ring(L.ground, c.at.x, c.at.y, R, 1, p, 0.9);
      // The seven-pointed star.
      const pts: Pt[] = [];
      for (let i = 0; i < 7; i++) {
        const th = -Math.PI / 2 + t * 0.6 + (i * Math.PI * 2) / 7;
        pts.push({ x: c.at.x + Math.cos(th) * R * 0.85, y: c.at.y + Math.sin(th) * R * 0.85 * FLAT });
      }
      for (let i = 0; i < 7; i++) line(L.ground, pts[i].x, pts[i].y, pts[(i + 3) % 7].x, pts[(i + 3) % 7].y, p.hot, 0.85);
      circle(L.ground, c.at.x, c.at.y, R * 0.35, p.core, 0.9);
      for (const q of pts) column(L.air, q.x, q.y, 14 * bump(Math.min(1, k * 1.3)), 1, p, 0.7, t * 40);
      L.light(c.at.x, c.at.y - 4, c.r * 2, p.light, 0.3 + 0.5 * k);
    });
    // The foes on it gild as it blooms: gold glints on them.
    s.add(c.lead, (L, k, t) => {
      for (let i = 0; i < 4; i++) {
        const th = hash(i, Math.floor(t * 8)) * Math.PI * 2;
        const d = hash(i, Math.floor(t * 8), 3) * c.r * 0.8;
        if (k > 0.5) star(L.air, c.at.x + Math.cos(th) * d, c.at.y - 8 + Math.sin(th) * d * FLAT, 2, p, k);
      }
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    s.add(0.5, (L, k) => {
      ring(L.ground, c.at.x, c.at.y, c.r * (0.3 + 0.9 * easeOut(k)), 2 * (1 - k) + 0.5, p, 1 - k);
      L.light(c.at.x, c.at.y - 6, c.r * 3, p.light, 1.2 * (1 - k));
    });
    for (const h of c.hits) {
      // A gold statue bursting: flakes thrown up and tumbling down.
      s.sparks(h.x, h.y, 14, [p.core, p.hot, p.mid, p.hot], { speed: 34, up: 50, g: 150, life: 0.7, z: HAND });
      s.add(0.25, (L, k) => star(L.air, h.x, h.y - HAND, 3 + Math.round(3 * k), p, 1 - k));
    }
    s.shake(240, 0.004, c.at);
  },
};

export const TRANSMUTER_KITS: Record<string, Kit> = {
  'transmuter.transmuter': { shot: beadShot, skill: transmute, ult: opus },
};
