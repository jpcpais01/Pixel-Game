// The Gunslinger's effects on the board: a round from each six-shooter in
// turn (a muzzle flash out to one side, a tracer, a brass casing kicked
// out), Quickdraw (a slide in a puff of dust, then two rounds that land the
// instant they leave), and High Noon (a sun burning over it, dead-eye
// brackets snapping onto each foe in turn, then every round at once in one
// crack). Dust and brass keep their own colours; the fire takes the palette,
// so the Desperado's burns orange where the Duster's runs white-blue.

import { CHEST, OVER, angle, dist, dot, easeOut, impact, lerp, line, orb, ring, star, type Cast, type Kit, type Pal, type Pt, type Px, type Stage } from '../paint';

const BRASS = [0xfff0a0, 0xe8b440, 0xa8761e];
const DUST = [0xb8a888, 0x8a7a60, 0x6a5e4a];
/** Its guns ride a little under the chest on the board. */
const GUN = CHEST - 1;

/** A muzzle flash at (x, y) pointing along `th`: a white core, a tongue of fire, two petals. */
function flash(px: Px, x: number, y: number, th: number, p: Pal, size = 1): void {
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  for (let i = 0; i <= 2 + size; i++) dot(px, x + ux * i, y + uy * i, i < 2 ? 0xffffff : p.hot);
  dot(px, x + ux - uy * 1.5, y + uy + ux * 1.5, p.hot);
  dot(px, x + ux + uy * 1.5, y + uy - ux * 1.5, p.hot);
  orb(px, x, y, 1 + size * 0.6, p, 1);
}

/** Where a gun's muzzle is: out to one side of the body, toward the foe. */
function muzzle(from: Pt, to: Pt, side: number): Pt {
  const th = angle(from, to);
  return { x: from.x + Math.cos(th) * 7 - Math.sin(th) * side * 3, y: from.y - GUN + Math.sin(th) * 4 + Math.cos(th) * side * 2 };
}

/** A round in flight from a to b (points in the air): a short white-hot streak; `done` as it lands. */
function round(s: Stage, a: Pt, b: Pt, dur: number, p: Pal, done?: () => void): void {
  const th = Math.atan2(b.y - a.y, b.x - a.x);
  s.add(
    dur,
    (L, k) => {
      const x = lerp(a.x, b.x, k);
      const y = lerp(a.y, b.y, k);
      const len = Math.min(7, dist(a, b) * k);
      line(L.air, x - Math.cos(th) * len, y - Math.sin(th) * len, x, y, p.mid);
      line(L.air, x - Math.cos(th) * len * 0.5, y - Math.sin(th) * len * 0.5, x, y, p.core);
      L.light(x, y, 10, p.light, 0.5);
    },
    0,
    done,
  );
}

/** A round striking: a glint, chips flying. */
function strike(s: Stage, at: Pt, p: Pal, big = false): void {
  s.add(big ? 0.22 : 0.14, (L, k) => {
    star(L.air, at.x, at.y - CHEST, big ? (k < 0.4 ? 4 : 2) : k < 0.5 ? 2 : 1, p, 1);
    L.light(at.x, at.y - CHEST, big ? 24 : 14, p.light, 0.8 * (1 - k));
  });
  s.sparks(at.x, at.y, big ? 8 : 4, [p.core, p.hot, 0xffffff], { speed: big ? 34 : 24, up: 20, life: 0.28, z: CHEST });
}

/** A brass casing kicked out of the breech, tumbling to the board. */
function casing(s: Stage, at: Pt, side: number): void {
  s.sparks(at.x, at.y, 1, BRASS, { speed: 24, up: 30, g: 170, life: 0.45, z: GUN + 2, dir: side > 0 ? 0 : Math.PI, cone: 0.6 });
}

/** A shot from one gun or the other (whichever side the foe is on): flash, tracer, casing. */
function shot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const side = b.x >= a.x ? 1 : -1;
  const m = muzzle(a, b, side);
  const th = Math.atan2(b.y - CHEST - m.y, b.x - m.x);
  s.add(0.07, (L) => {
    flash(L.air, m.x, m.y, th, p, 1);
    L.light(m.x, m.y, 18, p.light, 0.9);
  });
  casing(s, a, -side);
  round(s, m, { x: b.x, y: b.y - CHEST }, dur, p, () => strike(s, b, p));
}

/** Quickdraw: it slides aside in a puff of dust, then both guns speak and the rounds are there before the sound. */
const quickdraw = {
  cast(s: Stage, c: Cast): void {
    const th = angle(c.from, c.at);
    s.add(c.lead, (L, k) => {
      // Dust kicked up along the slide, and a streak of its eye.
      for (let i = 0; i < 4; i++) dot(L.ground, c.from.x - Math.cos(th + Math.PI / 2) * (i * 3) * k, c.from.y + 1 - i * 0.5, DUST[i % 3], 1 - k * 0.6);
      L.light(c.from.x, c.from.y - CHEST - 6, 10, c.pal.light, 0.6 * k);
    });
    s.sparks(c.from.x, c.from.y, 6, DUST, { speed: 26, up: 12, life: 0.4, ground: true });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const targets = c.path.length ? c.path : c.hits.length ? c.hits : [c.at];
    [0, 1].forEach((i) => {
      const to = targets[i % targets.length];
      const side = i ? 1 : -1;
      const m = muzzle(c.from, to, side);
      const end = { x: to.x, y: to.y - CHEST };
      s.add(0.16, (L, k) => {
        const from = lerp(0, 0.8, k);
        line(L.air, lerp(m.x, end.x, from), lerp(m.y, end.y, from), end.x, end.y, k < 0.4 ? p.core : p.hot, 1 - k);
        if (k < 0.3) flash(L.air, m.x, m.y, Math.atan2(end.y - m.y, end.x - m.x), p, 1.4);
        L.light(m.x, m.y, 20, p.light, 1 - k);
      });
      strike(s, to, p, true);
      casing(s, c.from, -side);
    });
    s.shake(70, 0.002, c.at);
  },
};

/** A dead-eye bracket closing onto a foe as `k` runs 0..1, and a pip for each mark it carries. */
function bracket(px: Px, x: number, y: number, k: number, p: Pal, n: number): void {
  const r = Math.round(9 - 4 * easeOut(k));
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    dot(px, x + sx * r, y + sy * r, p.core);
    dot(px, x + sx * (r - 1), y + sy * r, p.hot);
    dot(px, x + sx * r, y + sy * (r - 1), p.hot);
  }
  dot(px, x, y, p.core);
  for (let i = 0; i < n; i++) dot(px, x - (n - 1) + i * 2, y + r + 3, p.hot);
}

/** High Noon: a sun burns over it and its marks snap on one by one; then every round at once, in one crack. */
const highNoon = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const sun = { x: c.from.x, y: c.from.y - OVER - 16 };
    const marks = c.path.length ? c.path : [c.at];
    s.add(c.lead, (L, k, t) => {
      const e = easeOut(Math.min(1, k * 3));
      orb(L.air, sun.x, sun.y, 2 + 3 * e + Math.sin(t * 12) * 0.4, p, e);
      L.light(sun.x, sun.y, 40 + 30 * e, p.light, 0.9 * e);
      L.light(c.from.x, c.from.y, 60, p.light, 0.4 * e);
      ring(L.ground, c.from.x, c.from.y, 30, 0.6, p, 0.5 * e, 0.4, 3);
      // Each mark snaps on in its turn, a tick of the clock apart.
      marks.forEach((m, i) => {
        const at = (i + 1) / (marks.length + 1);
        if (k < at) return;
        const n = marks.slice(0, i + 1).filter((q) => q.x === m.x && q.y === m.y).length;
        bracket(L.air, m.x, m.y - CHEST, Math.min(1, (k - at) * 6), p, n);
      });
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const marks = c.path.length ? c.path : c.hits.length ? c.hits : [c.at];
    s.add(0.22, (L, k) => {
      marks.forEach((m, i) => {
        const side = i % 2 ? 1 : -1;
        const g = muzzle(c.from, m, side);
        line(L.air, g.x, g.y, m.x, m.y - CHEST, k < 0.4 ? p.core : p.hot, 1 - k);
        if (k < 0.35) flash(L.air, g.x, g.y, Math.atan2(m.y - CHEST - g.y, m.x - g.x), p, 1.6);
      });
      L.light(c.from.x, c.from.y - CHEST, 50, p.light, 1 - k);
    });
    for (const m of marks) impact(s, m, p, 0.9);
    s.sparks(c.from.x, c.from.y, 10, BRASS, { speed: 30, up: 34, g: 170, life: 0.5, z: GUN + 2 });
    s.shake(200, 0.005, c.from);
  },
};

export const GUNSLINGER_AUTO: Record<string, Kit> = {
  'automaton.gunslinger': { shot, skill: quickdraw, ult: highNoon },
};
