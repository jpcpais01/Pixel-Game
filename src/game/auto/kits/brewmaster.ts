// The Brewmaster's effects on the board: the mash paddle thwacking froth off
// a foe (the slam bursting in a ring of suds), the swig spat through a flame
// as a short roaring cone, and Rolling Thunder's keg bowling down the line
// to burst in foam. Wood and froth keep their own colours; the fire is his
// own (blue-white for the Mead Jarl), and the blast glows in the palette.

import { angle, CHEST, circle, dark, disc, dist, dither, dot, easeOut, hash, lerp, pool, ring, shadowOf, star, tail, type Cast, type Kit, type Pal, type Pt, type Px, type Stage } from '../paint';
import { HAND, scorch, smoke } from './common';

/** The paddle's wood, lit to shadowed, and the froth's. */
const WOOD = [0xe0c088, 0xb28a4a, 0x7a5428, 0x4a3018];
const FROTH = [0xffffff, 0xfff4dc, 0xe8d4a0, 0xb89a62];
const HONEY_FROTH = [0xffffff, 0xfff0bc, 0xf4cc60, 0xb88420];
/** The keg's staves and hoops. */
const KEG_WOOD = [0xc4925a, 0x9c6a38, 0x764a24, 0x4e2e16];
const HONEY_WOOD = [0xd8a456, 0xb47c34, 0x8a5620, 0x5e3812];
const COPPER = [0xf4ae6a, 0xd47a34, 0x8a3a14];
const GOLDEN = [0xffe27a, 0xd0961e, 0x7a5410];
/** His fire: amber, or the Jarl's blue-white. */
const FIRE: Pal = { core: 0xfff8e0, hot: 0xffc848, mid: 0xff7a1a, deep: 0xc03a10, light: 0xff9a3a, tints: [0xfff8e0, 0xffc848, 0xff7a1a, 0xc03a10] };
const BLUE_FIRE: Pal = { core: 0xffffff, hot: 0xc8e8ff, mid: 0x5a9cff, deep: 0x2a5ad8, light: 0x8ac4ff, tints: [0xffffff, 0xc8e8ff, 0x5a9cff, 0x2a5ad8] };
/** His mouth over his feet, about. */
const MOUTH = 16;

const jarl = (look: string): boolean => look === 'jarl';
const pd = (px: Px, x: number, y: number, c: number, a = 1): void => dot(px, Math.round(x), Math.round(y), c, a);

/** A point `d` along the line from (x, y) at angle `th`, pushed `v` across it. */
function along(x: number, y: number, th: number, d: number, v: number): Pt {
  return { x: x + Math.cos(th) * d - Math.sin(th) * v, y: y + Math.sin(th) * d + Math.cos(th) * v };
}

/** The paddle from (x, y) at angle th: a handle, then a broad blade with its holes. */
function paddle(px: Px, x: number, y: number, th: number, len: number): void {
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  const nx = -uy;
  const ny = ux;
  const grip = len * 0.5;
  for (let f = -2; f <= grip; f += 0.7) pd(px, x + ux * f, y + uy * f, WOOD[2]);
  for (let f = grip; f <= len; f += 0.6) {
    const w = f < grip + 1.2 ? 1 : 2;
    for (let j = -w; j <= w; j++) {
      const hole = j === 0 && (Math.abs(f - (grip + len) / 2) < 0.6 || Math.abs(f - len + 1.5) < 0.6);
      pd(px, x + ux * f + nx * j, y + uy * f + ny * j, hole ? WOOD[3] : j < 0 ? WOOD[0] : WOOD[1]);
    }
  }
}

/** Froth flung from `at`: blobs that arc up and fall, and a ring of suds left on the ground. */
function froth(s: Stage, at: Pt, cols: number[], n: number, ring0: number, h = CHEST): void {
  s.sparks(at.x, at.y, n, [cols[0], cols[1], cols[1], cols[2]], { speed: 24, up: 40, g: 170, life: 0.55, z: h });
  if (ring0 > 0) {
    const seed = Math.random() * 100;
    s.add(0.7, (L, k) => {
      const r = ring0 * (0.5 + 0.5 * easeOut(k));
      for (let i = 0; i < 18; i++) {
        if (hash(i, seed, Math.floor(k * 8)) < k) continue;
        const th = (i / 18) * Math.PI * 2 + hash(i, seed) * 0.4;
        pd(L.ground, at.x + Math.cos(th) * r, at.y + Math.sin(th) * r * 0.62, i & 1 ? cols[1] : cols[0], 1 - k * 0.6);
      }
    });
  }
}

/** A swing of the paddle: a wide wooden arc and a wet thwack of froth on the foe; the slam (`heavy`) comes down overhead and bursts in suds. */
function paddleBlow(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const side = at.x >= from.x ? 1 : -1;
  const P = { x: lerp(from.x, at.x, 0.3), y: lerp(from.y, at.y, 0.3) - HAND - 1 };
  const foe = { x: at.x, y: at.y - CHEST - (heavy ? 3 : 0) };
  const th = angle(P, foe);
  const len = Math.max(8, Math.min(12, dist(P, foe)));
  const a0 = th - (heavy ? 2.4 : 1.6) * side;
  const a1 = th + 0.3 * side;
  const swing = heavy ? 0.14 : 0.1;
  s.add(swing + 0.12, (L, _k, t) => {
    const u = Math.min(1, t / swing) ** 2;
    const cur = lerp(a0, a1, u);
    const fade = t < swing ? 1 : 1 - (t - swing) / 0.12;
    // The smear the blade leaves, in froth.
    const lo = Math.min(a0, cur);
    const hi = Math.max(a0, cur);
    for (let i = 0, n = Math.ceil((hi - lo) * len * 1.4); i <= n && hi - lo > 0.2; i++) {
      const f = i / n;
      const a = lo + (hi - lo) * f;
      const x = Math.round(P.x + Math.cos(a) * (len + 1));
      const y = Math.round(P.y + Math.sin(a) * (len + 1));
      if (dither(x, y) < fade * (0.3 + 0.7 * (side > 0 ? f : 1 - f))) pd(L.air, x, y, FROTH[1]);
    }
    if (t < swing + 0.06) paddle(L.air, P.x, P.y, cur, len);
  });
  s.add(0.01, () => {}, swing * 0.85, () => {
    s.add(heavy ? 0.3 : 0.2, (L, k) => {
      star(L.air, foe.x, foe.y, heavy ? (k < 0.4 ? 4 : 2) : k < 0.5 ? 2 : 1, p, 1);
      circle(L.air, foe.x, foe.y, 2 + (heavy ? 7 : 4) * easeOut(k), k < 0.5 ? 0xffffff : FROTH[1], 1 - k, 1);
      L.light(foe.x, foe.y, heavy ? 28 : 16, p.light, 0.8 * (1 - k));
    });
    froth(s, at, FROTH, heavy ? 9 : 4, heavy ? 12 : 0);
    if (heavy) {
      s.add(0.3, (L, k) => ring(L.ground, at.x, at.y, 4 + 10 * easeOut(k), 1, p, 1 - k));
      s.shake(100, 0.002);
    }
  });
}

/** Firebreath: a swig from the jug (a few bubbles rising), then a short roaring cone of fire spat at the foe, setting it alight. */
const firebreath = {
  cast(s: Stage, c: Cast): void {
    const fire = jarl(c.look) ? BLUE_FIRE : FIRE;
    const cols = jarl(c.look) ? HONEY_FROTH : FROTH;
    const mx = c.from.x;
    const my = c.from.y - MOUTH;
    const seed = Math.random() * 100;
    s.add(c.lead, (L, k, t) => {
      // The swig: bubbles of brew rising off his beard, then a flint's flame in his fingers.
      if (k < 0.6) for (let i = 0; i < 4; i++) {
        const life = (t * 2 + hash(i, seed)) % 1;
        pd(L.air, mx + (hash(i, seed, 1) - 0.5) * 6, my - 2 - life * 8, cols[i & 1], 1 - life);
      } else {
        const fx = mx + (c.at.x >= c.from.x ? 4 : -4);
        star(L.air, fx, my + 3, 1, fire, 1);
        L.light(fx, my + 3, 14, fire.light, 0.8);
      }
    });
  },
  hit(s: Stage, c: Cast): void {
    const fire = jarl(c.look) ? BLUE_FIRE : FIRE;
    const a = { x: c.from.x, y: c.from.y - MOUTH };
    const b = { x: c.at.x, y: c.at.y - 8 };
    const th = Math.atan2(b.y - a.y, b.x - a.x);
    const reach = Math.max(16, Math.min(c.r + 6, dist(a, b) + 8));
    const N = 18;
    s.add(0.5, (L, k, t) => {
      const out = easeOut(Math.min(1, k * 5));
      const fade = tail(k, 0.6);
      for (let i = 0; i < N; i++) {
        const life = (t * 3.2 + i / N) % 1;
        if (life > out) continue;
        const v = Math.sin(t * 19 + i * 2.1) * life * 6;
        const q = along(a.x, a.y, th, reach * life, v);
        const r = 1.2 + life * 4.4;
        const col = life < 0.16 ? fire.core : life < 0.42 ? fire.hot : life < 0.72 ? fire.mid : fire.deep;
        disc(L.air, q.x, q.y - life * 3, r, r * 0.8, col, fade * (1 - life * 0.5));
      }
      // The spatter of burning brew falling ahead.
      for (let i = 0; i < 6; i++) {
        const life = (t * 2.2 + hash(i, 7)) % 1;
        const q = along(a.x, a.y, th + (hash(i, 3) - 0.5) * 0.7, reach * (0.4 + life * 0.7), 0);
        pd(L.air, q.x, q.y + life * life * 10, life < 0.5 ? fire.hot : fire.mid, fade);
      }
      L.light(lerp(a.x, b.x, 0.5), lerp(a.y, b.y, 0.5), 50, fire.light, 0.9 * fade);
    });
    for (const h of c.hits) {
      scorch(s, h, 5, 1.2, fire.mid);
      s.sparks(h.x, h.y, 5, [fire.hot, fire.mid, fire.deep], { speed: 14, up: 26, g: -10, life: 0.6, z: 8, spread: 4 });
    }
  },
};

/** The keg seen rolling: a barrel lying across the way it rolls, its staves turning past, hoops and a bung. */
function keg(px: Px, x: number, y: number, dirX: number, roll: number, look: string): void {
  const wood = jarl(look) ? HONEY_WOOD : KEG_WOOD;
  const hoop = jarl(look) ? GOLDEN : COPPER;
  const R = 6;
  const W = 7;
  // Drawn as its side: a rounded block, staves scrolling with the roll.
  for (let dy = -R; dy <= R; dy++) {
    const half = W - Math.round((dy * dy) / (R * R) * 1.5);
    const lit = dy < -R * 0.4 ? 0 : dy < R * 0.3 ? 1 : dy < R * 0.8 ? 2 : 3;
    // The stave seams run along it and slide down as it rolls.
    const seam = (((dy + roll * dirX * 12) % 4) + 4) % 4 < 0.9;
    for (let dx = -half; dx <= half; dx++) {
      const hoopAt = Math.abs(Math.abs(dx) - Math.round(half * 0.55)) < 0.6 || Math.abs(dx) === half;
      const c = hoopAt ? hoop[Math.min(2, Math.max(0, lit - 1))] : seam ? wood[Math.min(3, lit + 1)] : wood[lit];
      pd(px, x + dx, y - R + dy, c);
    }
  }
  // The bung, coming round.
  const b = Math.sin(roll * Math.PI * 2 * dirX);
  if (Math.cos(roll * Math.PI * 2) > 0) pd(px, x, y - R + Math.round(b * R * 0.8), hoop[0]);
}

/** Rolling Thunder: the keg hoisted overhead, then bowled down the line, foes knocked aside, bursting in a blast of foam at the end. */
const rollingThunder = {
  cast(s: Stage, c: Cast): void {
    // Hoisted over his head as he winds up.
    s.add(c.lead, (L, k) => {
      const lift = easeOut(Math.min(1, k * 1.5));
      keg(L.air, c.from.x, c.from.y - 10 - lift * 14, 1, 0, c.look);
    });
  },
  hit(s: Stage, c: Cast): void {
    const cols = jarl(c.look) ? HONEY_FROTH : FROTH;
    const p = c.pal;
    const a = c.from;
    // Bowled to the far end of the line.
    const th = Math.atan2(c.at.y - a.y, c.at.x - a.x);
    const end = { x: a.x + Math.cos(th) * c.r, y: a.y + Math.sin(th) * c.r };
    const dirX = Math.cos(th) >= 0 ? 1 : -1;
    const ROLL = 0.55;
    s.add(ROLL, (L, k) => {
      const e = k * k * 0.4 + k * 0.6;
      const x = lerp(a.x, end.x, e);
      const y = lerp(a.y, end.y, e);
      const hop = Math.abs(Math.sin(e * 9)) * 2;
      // A wake of froth and dust on the ground behind it.
      for (let i = 0; i < 14; i++) {
        const f = e - i * 0.025;
        if (f < 0) break;
        const q = { x: lerp(a.x, end.x, f), y: lerp(a.y, end.y, f) };
        if (dither(q.x + i, q.y) < 1 - i / 14) {
          pd(L.ground, q.x - Math.sin(th) * 5, q.y + Math.cos(th) * 3, cols[i & 1]);
          pd(L.ground, q.x + Math.sin(th) * 5, q.y - Math.cos(th) * 3, cols[(i + 1) & 1]);
        }
      }
      shadowOf(L.ground, x, y, 8, 1);
      keg(L.air, x, y - hop, dirX, e * c.r / 30, c.look);
    });
    // Foes bowled aside as it reaches them.
    for (const h of c.hits) {
      const f = Math.min(1, dist(a, h) / Math.max(1, c.r));
      s.add(0.01, () => {}, ROLL * Math.sqrt(f) * 0.9, () => {
        s.sparks(h.x, h.y, 5, [cols[0], cols[1], KEG_WOOD[1]], { speed: 30, up: 34, g: 160, life: 0.5, z: CHEST });
        s.add(0.2, (L, k) => star(L.air, h.x, h.y - CHEST, k < 0.5 ? 3 : 1, p, 1));
      });
    }
    // The burst at the end of its run.
    s.add(0.01, () => {}, ROLL, () => {
      const wood = jarl(c.look) ? HONEY_WOOD : KEG_WOOD;
      s.sparks(end.x, end.y, 12, wood, { speed: 40, up: 50, g: 170, life: 0.7, z: 8 });
      froth(s, end, cols, 18, 22, 8);
      smoke(s, end, 4, dark(cols[1], 0.1), 4, 0.8, 6);
      s.add(0.5, (L, k) => {
        ring(L.ground, end.x, end.y, 6 + 26 * easeOut(k), 2, p, 1 - k);
        if (k < 0.3) disc(L.air, end.x, end.y - 8, 10 * (1 - k * 2), 8 * (1 - k * 2), 0xffffff, 1, 0.9);
        L.light(end.x, end.y - 8, 70, p.light, 1.1 * (1 - k));
      });
      s.add(1.3, (L, k) => pool(L.ground, end.x, end.y, 18 * (0.6 + 0.4 * easeOut(k)), cols[1], cols[2], 1 - k, 0.7));
      s.shake(200, 0.005, end);
    });
  },
};

export const BREWMASTER_KIT: Kit = { melee: paddleBlow, skill: firebreath, ult: rollingThunder };
