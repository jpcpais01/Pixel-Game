// The Pyrotechnist's effects on the board: Roman candle stars that pop in a
// little sparkly burst, a string of firecrackers going off one after
// another, and Skyburst, a crate of rockets that climb over the foes and
// burst in chrysanthemums, raining glitter. Paper, wood and smoke keep their
// own colours; the fire takes the palette (and the rockets the look's star
// colours, as in the main game), so the Masquerade skin recolours it.

import { CHEST, circle, clamp01, dither, dot, easeOut, FLAT, hash, lerp, line, orb, pool, shade, star, type Cast, type Kit, type Layers, type Pal, type Pt, type Stage } from '../paint';
import { flight, HAND, scorch, smoke, trail } from './common';

/** A palette without importing the game's (this file stays free of Phaser for the render script). */
const P = (core: number, hot: number, mid: number, deep: number, light = hot): Pal => ({ core, hot, mid, deep, light, tints: [core, hot, mid, deep] });

/** The rockets' colours, the same as the hero's stars (game/Pyrotechnist.ts): Vermilion's gold, rose, jade and azure; Masquerade's purple, teal, gold and magenta. */
const STARS: Pal[] = [P(0xfffbe0, 0xffe070, 0xffb020, 0xc06a10, 0xffc050), P(0xfff0f6, 0xffa0c8, 0xff4a8a, 0xa8185a, 0xff80b0), P(0xf0fff4, 0xa0ffc0, 0x30d878, 0x108a48, 0x70f0a0), P(0xf0f8ff, 0xa0d0ff, 0x4a98ff, 0x1a4ab0, 0x80b8ff)];
const CARNIVAL_STARS: Pal[] = [P(0xfbf0ff, 0xd8a0ff, 0xa050f0, 0x5a1ea0, 0xc080ff), P(0xf0fffb, 0x90ffe8, 0x20d0b0, 0x0a7a6a, 0x60f0d0), P(0xfffbe0, 0xffe070, 0xffb020, 0xc06a10, 0xffc050), P(0xfff0fa, 0xff9ae0, 0xe83ab8, 0x8a1270, 0xff70d0)];

const SPARKS = [0xffffff, 0xfff0b0, 0xffb040, 0xc0602a];
const CRATE = [0xb07a48, 0x8a5a32, 0x5e3a1e, 0x3e2412];
const FUSE = 0x3a2a1a;
const SMOKE = 0xa8a098;
/** A rocket's climb from the crate, s. */
const FLY = 0.32;

/** The candle's star: a ball of coloured fire shedding glitter, popping in a small burst on its foe. */
function starShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 2);
  const seed = Math.random() * 1000;
  s.add(
    dur,
    (L, k, t) => {
      const q = pos(k);
      trail(L, pos, k, 6, 0.035, [p.hot, p.mid, p.mid, p.deep]);
      // Glitter shed behind it, winking.
      for (let i = 1; i <= 3; i++) {
        const w = pos(Math.max(0, k - i * 0.06));
        if (hash(i, seed, Math.floor(t * 20)) < 0.5) dot(L.air, w.x + (hash(i, seed) - 0.5) * 3, w.y + i, i === 1 ? 0xffffff : p.hot);
      }
      orb(L.air, q.x, q.y, 1.6, p, 1);
      const g = Math.floor(t * 25) % 4;
      dot(L.air, q.x + [3, 0, -3, 0][g], q.y + [0, 3, 0, -3][g], p.core);
      L.light(q.x, q.y, 14, p.light, 0.5);
    },
    0,
    () => pop(s, b, p, 0.7),
  );
}

/** A small sparkly burst at chest height on a foe: a flash, a ring of sparks drooping as they fade. */
function pop(s: Stage, at: Pt, p: Pal, size: number): void {
  const n = Math.round(8 + 6 * size);
  const seed = Math.random() * 1000;
  s.add(0.42, (L, k) => {
    const cx = at.x;
    const cy = at.y - CHEST;
    if (k < 0.18) star(L.air, cx, cy, Math.round(2 + 2 * size), p, 1);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2 + hash(i, seed) * 0.3;
      const r = (5 + 4 * size) * easeOut(k * 1.6);
      const x = cx + Math.cos(th) * r;
      const y = cy + Math.sin(th) * r * 0.85 + k * k * 5;
      if (dither(x, y) >= 1.15 - k) continue;
      dot(L.air, x, y, shade(p, clamp01(k * 1.2)));
    }
    L.light(cx, cy, 18 + 10 * size, p.light, 0.7 * (1 - k));
  });
}

/** Firecrackers: a lit string tossed in an arc onto the crowd, then each cracker bangs in turn along it. */
const firecrackers = {
  cast(s: Stage, c: Cast): void {
    const pos = flight(c.from, c.at, 12, HAND);
    s.add(c.lead, (L, k, t) => {
      const q = pos(k);
      // The string tumbling: a short zigzag of red paper and the fuse spitting at one end.
      const th = t * 14;
      for (let i = -2; i <= 2; i++) {
        const x = q.x + Math.cos(th) * i * 1.4;
        const y = q.y + Math.sin(th) * i * 1.4;
        dot(L.air, x, y, i % 2 ? c.pal.deep : c.pal.mid);
      }
      dot(L.air, q.x + Math.cos(th) * 4, q.y + Math.sin(th) * 4, SPARKS[Math.floor(t * 30) % 3]);
      L.light(q.x, q.y, 10, 0xffa040, 0.4);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const n = 6;
    const half = Math.max(8, c.r * 0.8);
    const gap = 0.09;
    const spot = (i: number): Pt => ({ x: c.at.x - half + (2 * half * i) / (n - 1), y: c.at.y + Math.sin(i * 1.7) * 2 });
    // The string lying on the ground, crackers vanishing as they go off, the fuse's spark running along it.
    s.add(n * gap + 0.1, (L, _k, t) => {
      const lit = t / gap;
      for (let i = 0; i < n; i++) {
        if (i < lit) continue;
        const q = spot(i);
        dot(L.ground, q.x, q.y, p.mid);
        dot(L.ground, q.x + 1, q.y, p.deep);
        dot(L.ground, q.x, q.y - 1, p.hot);
        if (i < n - 1) line(L.ground, q.x + 1, q.y, spot(i + 1).x, spot(i + 1).y, FUSE);
      }
      if (lit < n) {
        const q = spot(Math.min(n - 1, lit));
        dot(L.air, q.x, q.y - 2, SPARKS[Math.floor(t * 40) % 3]);
      }
    });
    for (let i = 0; i < n; i++) {
      const q = spot(i);
      s.add(
        0.22,
        (L, k) => {
          if (k < 0.35) star(L.air, q.x, q.y - 3, 3, p, 1);
          else orb(L.air, q.x, q.y - 3, 2.5 * (1 - k), p, 1 - k);
          if (k < 0.5) circle(L.ground, q.x, q.y, 3 + 5 * easeOut(k * 2), p.hot, 1 - k * 2);
          L.light(q.x, q.y - 3, 22, p.light, 0.9 * (1 - k));
        },
        i * gap,
      );
      // Confetti of torn paper and a puff of smoke from each.
      s.add(0.01, () => undefined, i * gap, () => {
        s.sparks(q.x, q.y, 6, [p.mid, p.deep, 0xf8d870, 0xffffff], { speed: 24, up: 34, g: 130, life: 0.6, z: 3 });
        smoke(s, q, 1, SMOKE, 2, 0.7, 3);
      });
    }
    scorch(s, c.at, half * 0.7, 1.1);
    s.shake(90, 0.002);
  },
};

/** Where the crate of rockets stands: a step ahead of the caster's feet, toward the foes. */
const crateAt = (c: Cast): Pt => ({ x: c.from.x + Math.sign(c.at.x - c.from.x || 1) * 7, y: c.from.y + 1 });

/** The crate: six tubes in two rows, `fired` of them empty, the next one's fuse spitting. */
function crate(L: Layers, at: Pt, stars: Pal[], fired: number, t: number, a = 1): void {
  const put = (x: number, y: number, col: number) => {
    if (a >= 1 || dither(x, y) < a) L.air.put(Math.round(x), Math.round(y), col, 1);
  };
  for (let i = 0; i < 6; i++) {
    const mx = at.x - 4 + (i % 3) * 4;
    const my = at.y - 10 + Math.floor(i / 3) * 2;
    const p = stars[i % stars.length];
    for (let y = my; y < at.y - 4; y++) {
      put(mx - 1, y, p.hot);
      put(mx, y, p.mid);
      put(mx + 1, y, p.deep);
    }
    if (i < fired) put(mx, my, 0x1a120c);
    else {
      put(mx, my, p.core);
      put(mx, my - 1, FUSE);
      if (i === fired) put(mx + (Math.floor(t * 20) % 2), my - 2, SPARKS[Math.floor(t * 28) % 3]);
    }
  }
  for (let y = at.y - 4; y <= at.y; y++)
    for (let x = at.x - 6; x <= at.x + 5; x++) put(x, y, x === at.x - 6 || x === at.x + 5 || y === at.y - 2 ? CRATE[3] : y === at.y - 4 ? CRATE[0] : CRATE[1]);
  put(at.x, at.y - 3, 0xf8d870);
}

/** A rocket climbing from the crate to its burst point, on a hissing trail of sparks. */
function rocket(L: Layers, from: Pt, to: Pt, k: number, p: Pal): void {
  const at = (u: number): Pt => {
    const e = u * u;
    return { x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, 1 - (1 - u) * (1 - u)) };
  };
  for (let i = 1; i <= 5; i++) {
    const q = at(Math.max(0, k - i * 0.05));
    if (dither(q.x + i, q.y) < 1 - i / 6) dot(L.air, q.x, q.y + i * 0.3, SPARKS[Math.min(3, i - 1)]);
  }
  const q = at(k);
  const b = at(Math.max(0, k - 0.05));
  const d = Math.hypot(q.x - b.x, q.y - b.y) || 1;
  const ux = (q.x - b.x) / d;
  const uy = (q.y - b.y) / d;
  for (let i = -2; i <= 1; i++) dot(L.air, q.x + ux * i, q.y + uy * i, i === 1 ? p.core : i === -2 ? 0xffffff : p.mid);
  L.light(q.x, q.y, 12, 0xffb050, 0.5);
}

/** A chrysanthemum bursting at (cx, cy) over a foe standing at `foot`: rays that spread, droop and twinkle out, an inner ring, glitter drifting down. */
function chrysanthemum(s: Stage, cx: number, cy: number, foot: Pt, p: Pal, inner: Pal, big: boolean): void {
  const R = big ? 18 : 14;
  const seed = Math.random() * 1000;
  s.add(0.95, (L, k, t) => {
    if (k < 0.1) orb(L.air, cx, cy, 3 * (1 - k * 6), p, 1);
    for (const [n, reach, pal, salt] of [[18, R, p, 0], [8, R * 0.45, inner, 5]] as [number, number, Pal, number][]) {
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2 + (hash(i, seed, salt) - 0.5) * 0.2;
        const v = reach * (0.85 + 0.3 * hash(i, seed, salt + 1));
        const life = 0.6 + 0.35 * hash(i, seed, salt + 2);
        if (k > life) continue;
        const age = k / life;
        if (age > 0.7 && hash(i, Math.floor(t * 16), seed + salt) < (age - 0.7) * 2.5) continue;
        for (let j = 0; j < 4; j++) {
          const kj = Math.max(0, k - j * 0.035);
          const r = v * easeOut(kj * 1.7);
          const x = cx + Math.cos(th) * r;
          const y = cy + Math.sin(th) * r * 0.85 + 10 * kj * kj;
          if (j > 0 && dither(x, y) >= 1 - j / 5 - age * 0.3) continue;
          dot(L.air, x, y, j === 0 && age < 0.2 ? 0xffffff : shade(pal, clamp01(j / 4 + age * 0.6)));
        }
      }
    }
    // Glitter drifting down to the ground under it.
    for (let i = 0; i < 12; i++) {
      const s0 = 0.25 + hash(i, seed, 9) * 0.35;
      const u = (k - s0) / 0.4;
      if (u < 0 || u > 1) continue;
      const th = hash(i, seed, 10) * Math.PI * 2;
      const d = Math.sqrt(hash(i, seed, 11));
      const x = lerp(cx + Math.cos(th) * R * 0.7 * d, foot.x + Math.cos(th) * R * 0.8 * d, u);
      const y = lerp(cy + Math.sin(th) * R * 0.5 * d, foot.y + Math.sin(th) * R * 0.8 * d * FLAT, u * u * (3 - 2 * u));
      if (hash(i, Math.floor(t * 14), seed) < 0.3) continue;
      dot(u > 0.95 ? L.ground : L.air, x, y, hash(i, seed, 12) < 0.4 ? 0xffffff : p.hot);
    }
    // Its light on the ground under it.
    if (k < 0.4) pool(L.ground, foot.x, foot.y, R * 0.9, p.hot, p.mid, 1 - k / 0.4, 0.35);
    L.light(cx, cy, (big ? 70 : 55) * (1 - k * 0.5), p.light, 1.1 * (1 - k));
  });
  s.sparks(cx, foot.y, big ? 10 : 6, [p.core, p.hot, p.mid], { speed: 30, up: 10, g: 60, life: 0.6, z: foot.y - cy });
}

/** Skyburst: the crate is planted and lit; rockets leap out one after another and burst over the foes. */
const skyburst = {
  cast(s: Stage, c: Cast): void {
    const stars = c.look === 'carnival' ? CARNIVAL_STARS : STARS;
    const at = crateAt(c);
    // The first rocket leaves at the end of the wind-up, so it bursts as the first strike lands.
    const over = { x: c.at.x + (hash(0, 31) - 0.5) * 6, y: c.at.y - 30 - hash(0, 32) * 6 };
    const go = Math.max(0, c.lead - FLY);
    s.add(c.lead, (L, k, t) => {
      crate(L, at, stars, t >= go ? 1 : 0, t, clamp01(k * 4));
      L.light(at.x, at.y - 10, 16, 0xffa040, 0.5 + 0.2 * Math.sin(t * 40));
      if (t >= go) rocket(L, { x: at.x - 4, y: at.y - 10 }, over, (t - go) / Math.max(0.01, c.lead - go), stars[0]);
    });
  },
  hit(s: Stage, c: Cast): void {
    const stars = c.look === 'carnival' ? CARNIVAL_STARS : STARS;
    const at = crateAt(c);
    const pts = c.path.length ? c.path : [c.at];
    const n = 6;
    const life = c.span + 1;
    // Each rocket bursts as its strike lands; the first was in the air during the wind-up.
    const shots = Array.from({ length: n }, (_, j) => {
      const to = pts[j % pts.length];
      const T = (c.span * j) / n;
      const big = j === n - 1;
      return { to, T, big, p: big ? c.pal : stars[j % stars.length], inner: stars[(j + 2) % stars.length], over: { x: to.x + (hash(j, 31) - 0.5) * 6, y: to.y - 30 - hash(j, 32) * 6 } };
    });
    s.add(life, (L, _k, t) => {
      const fired = Math.max(1, shots.filter((r) => t >= r.T - FLY).length);
      crate(L, at, stars, fired, t, clamp01((life - t) / 0.3));
      for (const [j, r] of shots.entries()) {
        const u = (t - (r.T - FLY)) / FLY;
        if (j === 0 || u < 0 || u >= 1) continue;
        const mouth = { x: at.x - 4 + (j % 3) * 4, y: at.y - 10 + Math.floor(j / 3) * 2 };
        rocket(L, mouth, r.over, u, r.p);
      }
    });
    for (const r of shots) {
      s.add(0.01, () => undefined, r.T, () => {
        chrysanthemum(s, r.over.x, r.over.y, r.to, r.p, r.inner, r.big);
        if (r.big) s.shake(160, 0.004, r.to);
      });
    }
    smoke(s, at, 3, SMOKE, 2.5, 1.2, 8);
  },
};

export const PYRO_KITS: Record<string, Kit> = {
  'pyrotechnist.pyrotechnist': { shot: starShot, skill: firecrackers, ult: skyburst },
};
