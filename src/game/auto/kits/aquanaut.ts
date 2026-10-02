// The Aquanaut's effects on the board: the harpoon flying out on its line,
// the chain hook that reels a backliner in, and the steam torpedo running
// along the ground to burst in a column of sea water. Steel, brass and foam
// keep their own colours; the water takes the palette, so Barnacle's is sea-green.

import { CHEST, column, dither, dot, easeIn, easeOut, FLAT, hash, line, pool, ring, tail, type Cast, type Kit, type Layers, type Pal, type Pt, type Stage } from '../paint';
import { HAND, splash } from './common';

const STEEL_HI = 0xe2e8ee;
const STEEL = 0xa8b2be;
const STEEL_DK = 0x4a5260;
const BRASS = 0xd8a840;
const BRASS_DK = 0x8a6420;
const ROPE = 0xc8b48a;
const FOAM = 0xf4fbff;

/** How long the chain takes to come home after it bites (the sim's pull takes 0.3 s). */
const REEL_BACK = 0.3;
/** The torpedo's burst: how long it hangs about, and how tall the column stands. */
const BURST_DUR = 0.9;
const COLUMN_H = 30;

/** A harpoon shaft from (x, y) pointing along `th`: a steel rod, a barbed head, a brass ring at its butt. */
function harpoon(L: Layers, x: number, y: number, th: number): void {
  const c = Math.cos(th);
  const s = Math.sin(th);
  line(L.air, x - c * 7, y - s * 7, x + c * 3, y + s * 3, STEEL);
  dot(L.air, x + c * 4, y + s * 4, STEEL_HI);
  dot(L.air, x + c * 5, y + s * 5, STEEL_HI);
  // The barbs, swept back.
  for (const side of [-1, 1]) dot(L.air, x + c * 3 - s * side * 1.5, y + s * 3 + c * side * 1.5, STEEL_DK);
  dot(L.air, x - c * 7, y - s * 7, BRASS);
}

/** A chain from a to b, sagging `sag` px at its middle: links in two tones of steel. */
function chain(L: Layers, a: Pt, b: Pt, sag: number, a0 = 1): void {
  const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const x = a.x + (b.x - a.x) * f;
    const y = a.y + (b.y - a.y) * f + Math.sin(f * Math.PI) * sag;
    if (a0 < 1 && dither(x, y) >= a0) continue;
    dot(L.air, x, y, i % 2 ? STEEL : STEEL_DK);
  }
}

/** The hook on the chain's end: a steel crook. */
function hook(L: Layers, x: number, y: number, dir: number): void {
  dot(L.air, x, y, STEEL_HI);
  dot(L.air, x + dir, y + 1, STEEL);
  dot(L.air, x + dir, y + 2, STEEL);
  dot(L.air, x, y + 3, STEEL_DK);
  dot(L.air, x - dir, y + 2, STEEL_HI);
}

/** The basic attack: a harpoon flies out from the gun on its line, and bites with a spurt of water. */
function harpoonShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const side = b.x >= a.x ? 1 : -1;
  const m = { x: a.x + side * 7, y: a.y - HAND };
  const end = { x: b.x, y: b.y - CHEST };
  const th = Math.atan2(end.y - m.y, end.x - m.x);
  // A puff of compressed air at the muzzle.
  s.sparks(m.x, a.y, 4, [FOAM, p.core, p.hot], { speed: 14, up: 10, g: -10, life: 0.35, z: HAND, dir: th, cone: 0.6 });
  s.add(dur, (L, k) => {
    const x = m.x + (end.x - m.x) * k;
    const y = m.y + (end.y - m.y) * k;
    // The line paying out behind it.
    for (let i = 0; i < 6; i++) {
      const f = k * (i / 6);
      const lx = m.x + (end.x - m.x) * f;
      const ly = m.y + (end.y - m.y) * f + Math.sin((i / 6) * Math.PI) * 1.5;
      if (dither(lx, ly) < 0.7) dot(L.air, lx, ly, ROPE);
    }
    harpoon(L, x, y, th);
  }, 0, () => {
    splash(s, b, p, 6, 22, CHEST);
    s.add(0.15, (L, k) => L.light(end.x, end.y, 18, p.light, 0.6 * (1 - k)));
  });
}

/** Reel in: the hook flies out on its chain to the far foe; on the bite it hauls it in, water spraying off it. */
const reel = {
  cast(s: Stage, c: Cast): void {
    const side = c.at.x >= c.from.x ? 1 : -1;
    const m = { x: c.from.x + side * 7, y: c.from.y - HAND };
    const end = { x: c.at.x, y: c.at.y - CHEST };
    s.add(c.lead, (L, k) => {
      const q = { x: m.x + (end.x - m.x) * easeOut(k), y: m.y + (end.y - m.y) * easeOut(k) };
      chain(L, m, q, 2 * (1 - k));
      hook(L, q.x, q.y, side);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const side = c.at.x >= c.from.x ? 1 : -1;
    const m = { x: c.from.x + side * 7, y: c.from.y - HAND };
    const start = { x: c.at.x, y: c.at.y - CHEST };
    splash(s, c.at, p, 10, 26, CHEST);
    // The chain comes home with the foe on it, a trail of spray behind.
    s.add(REEL_BACK, (L, k) => {
      const e = easeIn(k);
      const q = { x: start.x + (m.x + side * 6 - start.x) * e, y: start.y + (m.y - start.y) * e };
      chain(L, m, q, 0);
      hook(L, q.x, q.y, -side);
      for (let i = 1; i <= 4; i++) {
        const f = Math.max(0, e - i * 0.08);
        const x = start.x + (m.x - start.x) * f;
        const y = start.y + (m.y - start.y) * f + i;
        if (dither(x, y) < 1 - i / 5) dot(L.air, x, y, i < 2 ? p.core : p.hot);
      }
      L.light(q.x, q.y, 14, p.light, 0.4);
    });
    // A ring of water where it lands at his feet.
    const land = { x: c.from.x + side * 14, y: c.from.y };
    s.add(0.5, (L, k) => ring(L.ground, land.x, land.y, 3 + 9 * easeOut(k), 1.5, p, 1 - k), REEL_BACK);
  },
};

/** The torpedo: a brass hull with a steel nose, its propeller blurring, as seen running at `th`. */
function torpedoBody(L: Layers, x: number, y: number, th: number, t: number): void {
  const c = Math.cos(th);
  const s = Math.sin(th) * FLAT;
  for (let i = -4; i <= 4; i++) {
    const hx = x + c * i;
    const hy = y + s * i;
    dot(L.air, hx, hy - 1, i >= 3 ? STEEL_HI : BRASS);
    dot(L.air, hx, hy, i >= 3 ? STEEL : i % 3 ? BRASS : BRASS_DK);
    dot(L.air, hx, hy + 1, BRASS_DK);
  }
  // The propeller at its tail.
  const px = x - c * 5;
  const py = y - s * 5;
  if (Math.floor(t * 24) % 2) {
    dot(L.air, px, py - 2, STEEL);
    dot(L.air, px, py + 2, STEEL);
  } else {
    dot(L.air, px - 1, py, STEEL);
    dot(L.air, px + 1, py, STEEL);
  }
}

/** Torpedo: it runs from his feet to the spot along the ground, a wake of foam behind, and bursts in a column of sea water. */
const torpedo = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const a = c.from;
    const b = c.at;
    const th = Math.atan2((b.y - a.y) / FLAT, b.x - a.x);
    const seed = Math.random() * 1000;
    s.add(c.lead, (L, k, t) => {
      const e = easeIn(k);
      const x = a.x + (b.x - a.x) * e;
      const y = a.y + (b.y - a.y) * e;
      // The wake: froth spreading behind it, older froth wider and thinner.
      const n = Math.ceil(e * 14);
      for (let i = 0; i < n; i++) {
        const f = (i / 14) * (k > 0 ? 1 : 0);
        const age = e - f;
        const wx = a.x + (b.x - a.x) * f;
        const wy = a.y + (b.y - a.y) * f;
        const spread = 1 + age * 6;
        for (const sd of [-1, 0, 1]) {
          const ox = -Math.sin(th) * sd * spread;
          const oy = Math.cos(th) * sd * spread * FLAT;
          if (dither(wx + ox, wy + oy) >= 1 - age * 0.8) continue;
          dot(L.ground, wx + ox, wy + oy, sd ? p.hot : FOAM);
        }
        if (hash(i, seed) < 0.3 && age < 0.5) dot(L.air, wx, wy - 2 - age * 6, p.core);
      }
      torpedoBody(L, x, y - 2, th, t);
      L.light(x, y - 3, 14, p.light, 0.4);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.at;
    s.shake(160, 0.003, c.at);
    splash(s, c.at, p, 22, 40, 6);
    s.sparks(x, y, 10, [FOAM, p.core], { speed: 20, up: 60, g: 140, life: 0.8, z: 10 });
    s.add(BURST_DUR, (L, k, t) => {
      pool(L.ground, x, y, c.r * 0.8 * easeOut(k * 3), p.mid, p.deep, tail(k, 0.5));
      ring(L.ground, x, y, c.r * easeOut(Math.min(1, k * 2)), 2, p, 1 - Math.min(1, k * 2));
      const up = k < 0.25 ? easeOut(k / 0.25) : 1 - (k - 0.25) / 0.75;
      if (up > 0) column(L.air, x, y, COLUMN_H * up, 5 * (0.6 + 0.4 * up), p, Math.min(1, up * 1.5), t);
      L.light(x, y - 10, c.r * 2, p.light, 0.8 * (1 - k));
    });
  },
};

export const AQUANAUT_KITS: Record<string, Kit> = {
  'aquanaut.aquanaut': { shot: harpoonShot, skill: reel, ult: torpedo },
};
