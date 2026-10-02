// The Falconer's effects on the board: her quick arrows, her falcon cast at
// a foe to rake it (a golden eagle for Berkut), and Skyhunt, a flight of
// hawks (eagles) wheeling over her and stooping one after another on the foes.

import {
  angle,
  CHEST,
  circle,
  dither,
  easeIn,
  easeOut,
  hash,
  impact,
  lerp,
  shadowOf,
  shock,
  sprite,
  star,
  tail,
  type Cast,
  type Kit,
  type Pal,
  type Pt,
  type Px,
  type Stage,
} from '../paint';
import { flight, HAND } from './common';

/** How long the falcon takes out to its quarry, rakes it, and flies home. */
const OUT = 0.24;
const RAKE = 0.3;
const HOME = 0.34;
/** How high the hawks wheel over her, and how wide. */
const WHEEL_UP = 34;
const WHEEL_R = 16;
const HAWKS = 6;

/** Her short bow's arrow: ash shaft, a steel head and fletching in her colour. */
const SHAFT = [0xd8b07a, 0x9a6a3c];
const STEEL = [0xffffff, 0xc8d0dc];

// A small bird in flight facing right, two wingbeats; then the stoop, wings folded.
// a: dark (wings, head), b: mid (back), c: light (breast), k: beak and talons.
const FALCON_UP = [
  '..a......',
  '..aa.....',
  '...aa..a.',
  'abbbccaak',
  '..bbcc...',
  '.........',
];
const FALCON_DOWN = [
  '.........',
  '.......a.',
  'abbbccaak',
  '..bacc...',
  '..aa.....',
  '.a.......',
];
const FALCON_STOOP = [
  'aa.....',
  '.abb...',
  '..bcca.',
  '...ccak',
  '.....k.',
];
// The golden eagle: bigger, broad wings fingered at the tips, a golden head (c) and a heavy beak.
const EAGLE_UP = [
  '.a.a........',
  '..aaa.......',
  '...aaaa.....',
  '....aaaa.cc.',
  'aabbbbbbbcck',
  '..aabbbb..k.',
  '............',
];
const EAGLE_DOWN = [
  '............',
  '.........cc.',
  'aabbbbbbbcck',
  '..abbaabb.k.',
  '...aaaa.....',
  '..aaa.......',
  '.a.a........',
];
const EAGLE_STOOP = [
  'aa.......',
  '.aabb....',
  '..abbbb..',
  '...abbcc.',
  '....bbcck',
  '.......kk',
];

const eagleish = (look: string): boolean => look === 'berkut';

function plumage(look: string, p: Pal): Record<string, number> {
  return eagleish(look)
    ? { a: 0x2a1a10, b: 0x6a4428, c: 0xf0c058, k: 0xf0c040 }
    : { a: 0x3a4254, b: 0x7a86a0, c: 0xefe6cc, k: p.hot };
}

/** The bird at (x, y) in the air, facing along `th`: flapping (f) or stooping. */
function bird(px: Px, x: number, y: number, th: number, f: number, look: string, p: Pal, a = 1, stoop = false): void {
  const eagle = eagleish(look);
  const rows = stoop ? (eagle ? EAGLE_STOOP : FALCON_STOOP) : f % 2 ? (eagle ? EAGLE_DOWN : FALCON_DOWN) : eagle ? EAGLE_UP : FALCON_UP;
  sprite(px, x, y, rows, plumage(look, p), a, { flip: Math.cos(th) < -0.05, ay: rows.length / 2 });
}

/** A pixel that fades in a clean checker as `a` falls. */
function pd(px: Px, x: number, y: number, c: number, a = 1): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  if (a < 1 && dither(X, Y) >= a) return;
  px.put(X, Y, c, 1);
}

/** Feathers shaken loose at (x, y): they drift down, rocking, and fade. */
function feathers(s: Stage, at: Pt, h: number, look: string, p: Pal, n = 4): void {
  const cols = plumage(look, p);
  const seed = Math.random() * 100;
  s.add(0.8, (L, k, t) => {
    for (let i = 0; i < n; i++) {
      const dx = (hash(i, seed) - 0.5) * 22 * easeOut(k) + Math.sin(t * 9 + i) * 2;
      const y = at.y - h - 6 * easeOut(k * 2) + 14 * k * k;
      const x = at.x + dx;
      const col = i % 2 ? cols.c : cols.b;
      pd(L.air, x, y, col, tail(k, 0.5));
      pd(L.air, x + (Math.sin(t * 9 + i) > 0 ? 1 : -1), y + 1, cols.a, tail(k, 0.5));
    }
  });
}

/** Three talon streaks ripping across a foe, white at their front. */
function rakeMarks(s: Stage, at: Pt, dir: number, p: Pal): void {
  s.add(0.22, (L, k) => {
    const go = easeOut(Math.min(1, k * 2));
    for (let i = -1; i <= 1; i++) {
      for (let u = 0; u <= 9 * go; u += 0.5) {
        const x = at.x - dir * 5 + dir * u;
        const y = at.y - CHEST - 5 + u * 0.8 + i * 3;
        pd(L.air, x, y, u > 9 * go - 2 ? p.core : p.hot, tail(k, 0.4));
      }
    }
  });
}

/** Her quick shot: a short, flat arrow with a faint streak behind it. */
function quickShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 1);
  const th = angle(a, b);
  s.add(dur, (L, k) => {
    const q = pos(k);
    const c = Math.cos(th);
    const sn = Math.sin(th);
    for (let u = 0; u <= 7; u += 0.5) pd(L.air, q.x - c * u, q.y - sn * u, u < 1.5 ? STEEL[u < 0.6 ? 0 : 1] : u > 5.5 ? p.mid : SHAFT[u > 3.5 ? 1 : 0]);
    for (let u = 8; u <= 13; u += 1) pd(L.air, q.x - c * u, q.y - sn * u, p.hot, 0.5 - (u - 8) * 0.08);
    L.light(q.x, q.y, 8, p.light, 0.25);
  }, 0, () => {
    s.add(0.12, (L, k) => star(L.air, b.x, b.y - CHEST, 2, p, 1 - k));
    s.sparks(b.x, b.y, 3, [SHAFT[0], p.hot, p.mid], { speed: 20, up: 14, z: CHEST, life: 0.25 });
  });
}

/** Falcon strike: off her glove, out to the foe, three rakes, a mark, and home. */
const falconStrike = {
  cast(s: Stage, c: Cast): void {
    // The falcon rousing on her shoulder, wings half open.
    const th = angle(c.from, c.at);
    s.add(c.lead, (L, k, t) => {
      bird(L.air, c.from.x + Math.cos(th) * 4, c.from.y - HAND - 6 - 3 * k, th, Math.floor(t * 14), c.look, c.pal, Math.min(1, k * 4));
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    const dir = Math.cos(th) < 0 ? -1 : 1;
    const start = { x: c.from.x, y: c.from.y - HAND - 9 };
    const over = { x: c.at.x - dir * 4, y: c.at.y - CHEST - 8 };
    const life = OUT + RAKE + HOME;
    s.add(life, (L, k, t) => {
      const T = k * life;
      let x: number;
      let y: number;
      let h: number;
      let stoop = false;
      let face = th;
      if (T < OUT) {
        // Out low and fast, rising a little, then dropping onto it.
        const u = T / OUT;
        x = lerp(start.x, over.x, u);
        y = lerp(start.y, over.y, u) - Math.sin(u * Math.PI) * 10;
        h = lerp(HAND + 9, CHEST + 8, u) + Math.sin(u * Math.PI) * 10;
        stoop = u > 0.6;
      } else if (T < OUT + RAKE) {
        // Hovering on it, beating hard, raking.
        const u = (T - OUT) / RAKE;
        x = over.x + Math.sin(u * Math.PI * 3) * 2;
        y = over.y - Math.abs(Math.sin(u * Math.PI * 3)) * 2;
        h = CHEST + 8;
      } else {
        // Home to her shoulder.
        const u = easeIn((T - OUT - RAKE) / HOME);
        x = lerp(over.x, start.x, u);
        y = lerp(over.y, start.y, u) - Math.sin(u * Math.PI) * 12;
        h = lerp(CHEST + 8, HAND + 9, u) + Math.sin(u * Math.PI) * 12;
        face = th + Math.PI;
      }
      shadowOf(L.ground, x, y + h, 3, 0.5);
      bird(L.air, x, y, face, Math.floor(t * 16), c.look, p, 1, stoop);
    });
    for (let i = 0; i < 3; i++) {
      s.add(0.01, () => undefined, OUT + i * (RAKE / 3), () => {
        for (const h of c.hits) {
          rakeMarks(s, h, i % 2 ? -dir : dir, p);
          if (i === 0) impact(s, h, p, 0.6);
        }
      });
    }
    s.add(0.01, () => undefined, OUT + RAKE * 0.5, () => {
      for (const h of c.hits) {
        feathers(s, h, CHEST + 4, c.look, p, 3);
        // The mark: a chevron of light over its head for a moment.
        s.add(1.2, (L, k) => {
          const a = tail(k, 0.6) * Math.min(1, k * 6);
          for (let d = 0; d <= 3; d++) {
            pd(L.air, h.x - d, h.y - 26 - 3 + d, p.hot, a);
            pd(L.air, h.x + d, h.y - 26 - 3 + d, p.hot, a);
          }
          pd(L.air, h.x, h.y - 29, p.core, a);
        });
      }
    });
  },
};

/** Skyhunt: she whistles, a flight wheels over her, then each stoops on a foe in turn. */
const skyhunt = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    s.add(c.lead, (L, k, t) => {
      // The whistle: arcs of sound from her lips.
      for (let i = 0; i < 3; i++) {
        const f = (k * 2 + i / 3) % 1;
        circle(L.air, c.from.x, c.from.y - HAND - 8, 3 + f * 9, p.hot, (1 - f) * 0.8, 0.6, -2.2, -0.9);
      }
      // The flight coming in from high up and settling into a ring over her.
      for (let i = 0; i < HAWKS; i++) {
        const a = (i / HAWKS) * Math.PI * 2 + t * 3;
        const come = 1 - easeOut(k);
        const r = WHEEL_R * (1 + come * 2);
        const x = c.from.x + Math.cos(a) * r;
        const y = c.from.y - WHEEL_UP - come * 30 + Math.sin(a) * r * 0.4;
        shadowOf(L.ground, c.from.x + Math.cos(a) * r, c.from.y + Math.sin(a) * r * 0.62, 2.5, 0.4 * k);
        bird(L.air, x, y, a + Math.PI / 2, Math.floor(t * 10 + i), c.look, p, Math.min(1, k * 3));
      }
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const marks = c.path.length ? c.path : c.hits.length ? c.hits : [c.at];
    const gap = c.span / Math.max(1, HAWKS);
    const stoop = 0.22;
    s.shake(90, 0.002);
    for (let i = 0; i < HAWKS; i++) {
      const at = marks[i % marks.length];
      const a = (i / HAWKS) * Math.PI * 2;
      const sx = c.from.x + Math.cos(a) * WHEEL_R;
      const sy = c.from.y - WHEEL_UP + Math.sin(a) * WHEEL_R * 0.4;
      const wait = i * gap;
      // Wheeling until its turn, then the stoop.
      s.add(wait + stoop, (L, k, t) => {
        const T = k * (wait + stoop);
        if (T < wait) {
          const aa = a + t * 3;
          bird(L.air, c.from.x + Math.cos(aa) * WHEEL_R, c.from.y - WHEEL_UP + Math.sin(aa) * WHEEL_R * 0.4, aa + Math.PI / 2, Math.floor(t * 10 + i), c.look, p);
          return;
        }
        const u = easeIn((T - wait) / stoop);
        const x = lerp(sx, at.x, u);
        const y = lerp(sy, at.y - CHEST, u);
        shadowOf(L.ground, at.x, at.y, 3, u);
        bird(L.air, x, y, angle({ x: sx, y: sy }, at), 0, c.look, p, 1, true);
        for (let j = 1; j <= 3; j++) pd(L.air, lerp(sx, at.x, u - j * 0.06), lerp(sy, at.y - CHEST, u - j * 0.06), p.mid, 0.6 - j * 0.15);
      }, 0, () => {
        const dir = at.x >= sx ? 1 : -1;
        impact(s, at, p, 0.9);
        rakeMarks(s, at, dir, p);
        feathers(s, at, CHEST, c.look, p, 4);
        shock(s, at, 10, p, 0.3, 1);
        s.sparks(at.x, at.y, 5, [p.core, p.hot, p.mid], { speed: 30, up: 22, z: CHEST, life: 0.35 });
        // Beating away up and out.
        s.add(0.45, (L, k, t) => {
          bird(L.air, at.x + dir * 20 * k, at.y - CHEST - 40 * easeIn(k), dir > 0 ? 0 : Math.PI, Math.floor(t * 18), c.look, p, 1 - k);
        });
      });
    }
  },
};

export const FALCONER_KITS: Record<string, Kit> = {
  'archer.falconer': { shot: quickShot, skill: falconStrike, ult: skyhunt },
};
