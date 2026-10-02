// The Aviator's effects on the board: her flare rounds, the rocket hop (jets
// lighting under her, a landing blast) and Bombing Run (a signal flare, then
// her biplane crossing the line of the aim, dropping bombs that go off one
// after another). Smoke and the plane's wood keep their own colours;
// everything that burns takes the palette, so the Flying Ace's is red.

import { angle, CHEST, dist, disc, dither, dot, easeIn, easeOut, FLAT, lerp, line, ring, shadowOf, sprite, star, tail, type Cast, type Kit, type Layers, type Pal, type Pt, type Stage } from '../paint';
import { flight, HAND, scorch, smoke, trail } from './common';

const SMOKE_LIGHT = 0xc8c2cc;
const SMOKE_MID = 0x8a8490;

/** A flare round: a white-hot head on a sputtering trail of fire, popping in a little star of sparks. */
function flareShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 1);
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    trail(L, pos, k, 6, 0.05, [p.hot, p.mid, p.deep, SMOKE_MID]);
    dot(L.air, q.x, q.y, p.core, 1);
    if (Math.floor(t * 30) % 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(L.air, q.x + dx, q.y + dy, p.hot, 1);
    L.light(q.x, q.y, 14, p.light, 0.6);
  });
  s.add(0.01, () => {}, dur, () => {
    s.add(0.22, (L, k) => {
      star(L.air, b.x, b.y - CHEST, k < 0.5 ? 3 : 1, p, 1);
      L.light(b.x, b.y - CHEST, 20, p.light, 0.8 * (1 - k));
    });
    s.sparks(b.x, b.y, 6, [p.core, p.hot, p.mid], { speed: 26, up: 20, g: 90, life: 0.4, z: CHEST });
  });
}

/** Jet fire down from a point: a flickering tongue of the palette. */
function jet(L: Layers, x: number, y: number, len: number, p: Pal, t: number): void {
  const n = Math.max(1, Math.round(len + (Math.floor(t * 30) % 2)));
  for (let i = 0; i < n; i++) dot(L.air, x + (i > 1 && (i + Math.floor(t * 30)) % 3 === 0 ? 1 : 0), y + i, i < 1 ? p.core : i < 3 ? p.hot : i < n - 1 ? p.mid : p.deep, 1);
}

/** Rocket hop: the jets light under her as she crouches; she lands in a blast that rolls foes back. */
const hopMove = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    s.add(c.lead, (L, k, t) => {
      for (const sx of [-3, 3]) jet(L, c.from.x + sx, c.from.y - 6, 1 + 3 * k, p, t);
      L.light(c.from.x, c.from.y - 3, 16, p.light, 0.6 * k);
    });
    smoke(s, c.from, 4, SMOKE_MID, 2.5, 0.7, 2);
    scorch(s, c.from, 6, 1, p.mid);
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const at = c.at;
    s.shake(140, 0.003, at);
    s.add(0.45, (L, k) => {
      ring(L.ground, at.x, at.y, 4 + (c.r || 22) * easeOut(k), 2, p, 1 - k);
      if (k < 0.3) star(L.air, at.x, at.y - 4, 3, p, 1);
      L.light(at.x, at.y - 6, 40, p.light, 0.9 * (1 - k));
    });
    scorch(s, at, 8, 1.2, p.mid);
    smoke(s, at, 5, SMOKE_LIGHT, 3, 0.8, 2);
    s.sparks(at.x, at.y, 12, [p.core, p.hot, p.mid], { speed: 34, up: 22, life: 0.45, ground: true, spread: 6 });
  },
};

/** The biplane from above, flying right (flipped to fly left): wings, fuselage, tailplane and a propeller blur. */
const PLANE = [
  '.....ww....',
  '.....ww....',
  't....ww....',
  'tbbbbBBbbcp',
  'tbbbbBBbbcp',
  't....ww....',
  '.....ww....',
  '.....ww....',
];

/** Bombing Run: a signal flare streaks up from her; her plane crosses along the line and the bombs go off along it. */
const bombingRun = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    s.add(c.lead, (L, k) => {
      const y = c.from.y - HAND - 30 * easeOut(k);
      line(L.air, c.from.x, c.from.y - HAND, c.from.x, y, p.mid, 0.6);
      dot(L.air, c.from.x, y, p.core, 1);
      L.light(c.from.x, y, 18, p.light, 0.8);
    });
    s.add(0.01, () => {}, c.lead, () => s.sparks(c.from.x, c.from.y, 8, [p.core, p.hot, p.mid], { speed: 20, up: 10, g: 40, life: 0.6, z: HAND + 30 }));
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    const len = Math.max(30, dist(c.from, c.at));
    const flip = Math.cos(th) < 0;
    const ux = Math.cos(th);
    const uy = Math.sin(th) * FLAT;
    // The plane from well behind her to well past the end, high over the board.
    const start = -60;
    const end = len + 60;
    const fly = 1.1;
    const ALT = 34;
    const cols = { w: 0xf0c840, b: 0x8a5a2e, B: 0x5a3418, t: 0xf0c840, c: 0xd8b060, p: 0xe8eef8 };
    const red = p.mid;
    if (c.look === 'ace') Object.assign(cols, { w: red, t: red, b: dark(red), B: 0xf4ead4, c: 0xaab4c8 });
    s.add(fly, (L, k) => {
      const d = lerp(start, end, k);
      const x = c.from.x + ux * d;
      const y = c.from.y + uy * d;
      shadowOf(L.ground, x + 6, y, 7, 0.6);
      sprite(L.air, x, y - ALT, PLANE, cols, tail(k, 0.85), { ay: PLANE.length / 2, flip });
      L.light(x, y - ALT, 12, p.light, 0.3);
    });
    // The bombs, one after another along the line, each falling then going off.
    const n = Math.max(3, Math.round(len / 18));
    for (let i = 0; i < n; i++) {
      const d = ((i + 0.5) / n) * len;
      const at = { x: c.from.x + ux * d, y: c.from.y + uy * d };
      const drop = ((d - start) / (end - start)) * fly - 0.2;
      const fall = 0.25;
      s.add(
        fall,
        (L, k) => {
          const y = at.y - ALT * (1 - easeIn(k));
          disc(L.air, at.x, y - 2, 1.2, 2, 0x3e4452, 1);
          dot(L.air, at.x, y - 4, red, 1);
          disc(L.ground, at.x, at.y, 1 + 2 * k, (1 + 2 * k) * FLAT, 0x0b0818, 0.4, 0.6);
        },
        Math.max(0, drop),
        () => {
          const last = i === n - 1;
          s.shake(last ? 200 : 80, last ? 0.004 : 0.002, at);
          s.add(0.5, (L, k) => {
            const r = (last ? 9 : 6) * (0.5 + 0.7 * easeOut(k * 2));
            for (let dy = -Math.ceil(r); dy <= r; dy++)
              for (let dx = -Math.ceil(r); dx <= r; dx++) {
                const q = Math.hypot(dx, dy) / r;
                if (q > 1) continue;
                const X = at.x + dx;
                const Y = at.y - r * 0.6 - k * 10 + dy;
                if (dither(X, Y) >= (1 - k) * 1.2 - q * 0.3) continue;
                const heat = k * 1.6 + q * 0.8;
                L.air.put(Math.round(X), Math.round(Y), heat < 0.4 ? p.core : heat < 0.75 ? p.hot : heat < 1.05 ? p.mid : heat < 1.3 ? p.deep : SMOKE_MID, 1);
              }
            ring(L.ground, at.x, at.y, (last ? 18 : 11) * easeOut(k), 1, p, 1 - k);
            L.light(at.x, at.y - 8, last ? 46 : 30, p.light, 1 - k);
          });
          scorch(s, at, last ? 9 : 6, 1.2, p.mid);
          s.sparks(at.x, at.y, last ? 12 : 6, [p.core, p.hot, p.mid], { speed: 30, up: 30, g: 120, life: 0.5, z: 4 });
        },
      );
    }
  },
};

/** A colour darkened a little (the Ace's red fuselage under its cream stripe). */
function dark(c: number): number {
  const r = ((c >> 16) & 255) * 0.7;
  const g = ((c >> 8) & 255) * 0.7;
  const b = (c & 255) * 0.7;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export const AVIATOR_KITS: Record<string, Kit> = {
  'aviator.aviator': { shot: flareShot, skill: hopMove, ult: bombingRun },
};
