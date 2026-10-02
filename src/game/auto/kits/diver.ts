// The Deep Diver's effects on the Auto Battle board: the anchor whirled on its
// chain (an overhead slam on the combo's last blow, cracking the ground), the
// harpoon fired on a chain that bites and is reeled back, and Crushing
// Depths, a dome of deep water dropped over the crowd that clenches, then
// bursts in a great splash. Iron and water keep their own colours; the glow
// takes the palette, so the Barnacle's pink recolours it.

import {
  angle,
  CHEST,
  clamp01,
  dist,
  dither,
  dot,
  easeIn,
  easeOut,
  FLAT,
  hash,
  lerp,
  ring,
  shadowOf,
  star,
  type Cast,
  type Kit,
  type Pal,
  type Pt,
  type Px,
  type Stage,
} from '../paint';
import { HAND, splash } from './common';

// --- Materials -------------------------------------------------------------------

const IRON_HI = 0xa8b8cc;
const IRON = 0x6a7a90;
const IRON_DK = 0x2e3846;
const DEEP = 0x041824;
const DUST = [0xb8a888, 0x8a7a60, 0x6a5e4a];
const CRACK = 0x1a120c;

// --- Pieces ----------------------------------------------------------------------

/** A little anchor, crown at the bottom: ring, stock, shank, and two arms curving up to their flukes. */
const ANCHOR = ['..r..', '.r.r.', 'sssss', '..h..', '..h..', 'f.h.f', 'ah.ha', '.hhh.'];
const ANCHOR_COLS: Record<string, number> = { r: IRON, s: IRON_DK, h: IRON, f: IRON_HI, a: IRON_DK };

/** A bitmap from letter rows, turned by `th` round its middle (0: crown down). */
function turned(px: Px, x: number, y: number, rows: string[], cols: Record<string, number>, th: number, a = 1): void {
  const h = rows.length;
  const w = rows[0].length;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const R = Math.ceil(Math.hypot(w, h) / 2) + 1;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const X0 = Math.round(x);
  const Y0 = Math.round(y);
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const i = Math.round(dx * c + dy * s + cx);
      const j = Math.round(-dx * s + dy * c + cy);
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const col = cols[rows[j][i]];
      if (col === undefined) continue;
      if (a < 1 && dither(X0 + dx, Y0 + dy) >= a) continue;
      px.put(X0 + dx, Y0 + dy, col, 1);
    }
}

/** The anchor with its crown pointing along `th` (radians, 0 = right). */
function anchor(px: Px, x: number, y: number, th: number, a = 1): void {
  turned(px, x, y, ANCHOR, ANCHOR_COLS, th - Math.PI / 2, a);
}

/** A chain from one point to another, links light and dark by turns, sagging by `sag`. */
function chain(px: Px, x0: number, y0: number, x1: number, y1: number, sag = 0, a = 1): void {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag);
    if (a < 1 && dither(x, y) >= a) continue;
    px.put(x, y, Math.floor(i / 2) % 2 ? IRON_DK : IRON_HI, 1);
  }
}

/** Water drops flung off something. */
function drops(s: Stage, at: Pt, p: Pal, n: number, h = CHEST): void {
  s.sparks(at.x, at.y, n, [0xe6ffff, p.core, p.hot, p.mid], { speed: 28, up: 34, g: 170, life: 0.45, z: h });
}

/** Cracks splitting out through the ground from `at`, dark seams lit with the palette, fading. */
function cracks(s: Stage, at: Pt, p: Pal, R: number, dur = 0.9): void {
  const seed = Math.random() * 1000;
  s.add(dur, (L, k) => {
    const grow = clamp01(k * 8);
    const fade = 1 - clamp01((k - 0.4) / 0.6);
    for (let i = 0; i < 5; i++) {
      let a = (i / 5) * Math.PI * 2 + hash(i, seed) * 0.8;
      let x = at.x;
      let y = at.y;
      const len = R * (0.6 + 0.4 * hash(i, seed, 1)) * grow;
      for (let d = 0; d < len; d += 2) {
        a += (hash(i, seed, d) - 0.5) * 0.8;
        x += Math.cos(a) * 2;
        y += Math.sin(a) * 2 * FLAT;
        if (dither(x, y) >= fade) continue;
        L.ground.put(Math.round(x), Math.round(y), CRACK, 1);
        if (d < len * 0.5 && k < 0.5) L.ground.put(Math.round(x), Math.round(y) - 1, p.mid, 1);
      }
    }
  });
}

// --- The anchor's blows ----------------------------------------------------------

/**
 * A sweep of the anchor on its chain round onto the foe and past it, a smear
 * of churned water behind; the heavy one is heaved overhead and slammed down
 * on the foe, cracking the ground.
 */
function anchorBlow(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const hand = { x: lerp(from.x, at.x, 0.15), y: from.y - HAND + 2 };
  const foe = { x: at.x, y: at.y - CHEST + 2 };
  const th = angle(hand, foe);
  const reach = Math.max(10, dist(hand, foe) + 2);
  if (heavy) {
    const up = { x: from.x, y: from.y - HAND - 16 };
    const fly = 0.2;
    s.add(fly + 0.32, (L, _k, t) => {
      if (t < fly) {
        const u = easeIn(t / fly);
        const x = lerp(up.x, at.x, u);
        const y = lerp(up.y, at.y - 4, u) - Math.sin(u * Math.PI) * 6;
        chain(L.air, hand.x, hand.y, x, y - 3);
        anchor(L.air, x, y, -Math.PI / 2 + Math.PI * u * (at.x >= from.x ? 1 : -1));
        shadowOf(L.ground, at.x, at.y, 5, u);
      } else {
        const k = (t - fly) / 0.32;
        // Bitten into the ground a moment, then hauled back.
        const back = clamp01((k - 0.5) * 2);
        const x = lerp(at.x, hand.x, easeOut(back));
        const y = lerp(at.y - 4, hand.y, easeOut(back));
        chain(L.air, hand.x, hand.y, x, y - 3, back > 0 ? 0 : 3, 1 - back * 0.6);
        anchor(L.air, x, y, Math.PI / 2, 1 - back);
      }
    });
    s.add(0.01, () => {}, fly, () => {
      cracks(s, at, p, 14);
      s.add(0.35, (L, k) => {
        ring(L.ground, at.x, at.y, 3 + 13 * easeOut(k), 1.4, p, 1 - k);
        if (k < 0.4) star(L.air, at.x, at.y - 6, k < 0.2 ? 4 : 2, p, 1);
        L.light(at.x, at.y - 6, 40, p.light, 0.9 * (1 - k));
      });
      s.sparks(at.x, at.y, 8, DUST, { speed: 30, up: 26, g: 120, life: 0.5, ground: true, spread: 4 });
      drops(s, at, p, 8, 4);
      s.shake(140, 0.003, at);
    });
    return;
  }
  // Which way round it comes: alternating, by the foe's side.
  const side = Math.floor(Math.random() * 2) ? 1 : -1;
  const a0 = th + 1.4 * side;
  const a1 = th - 0.6 * side;
  const sweep = 0.16;
  const seed = Math.random() * 1000;
  s.add(sweep + 0.12, (L, _k, t) => {
    const u = clamp01(t / sweep);
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const a = t < sweep ? lerp(a0, a1, e) : a1;
    const r = t < sweep ? reach * Math.min(1, 0.4 + u * 1.6) : reach * (1 - easeOut((t - sweep) / 0.12)) + 4;
    const x = hand.x + Math.cos(a) * r;
    const y = hand.y + Math.sin(a) * r * 0.8;
    // The smear: a thin crescent along where it has just been, thinning to a dither.
    if (t < sweep + 0.06) {
      const lo = lerp(a0, a, 0.35);
      const n = Math.ceil(Math.abs(a - lo) * r * 1.3);
      for (let i = 0; i <= n; i++) {
        const f = i / Math.max(1, n);
        const q = lerp(lo, a, f);
        for (let w = 0; w < 2; w++) {
          const sx = Math.round(hand.x + Math.cos(q) * (r - w));
          const sy = Math.round(hand.y + Math.sin(q) * (r - w) * 0.8);
          if (dither(sx + Math.floor(seed), sy) >= f * 0.85) continue;
          L.air.put(sx, sy, w ? p.mid : p.hot, 1);
        }
      }
    }
    chain(L.air, hand.x, hand.y, x - Math.cos(a) * 3, y - Math.sin(a) * 3);
    anchor(L.air, x, y, a, t < sweep ? 1 : 1 - (t - sweep) / 0.12);
  });
  s.add(0.01, () => {}, sweep * 0.55, () => {
    s.add(0.2, (L, k) => {
      star(L.air, foe.x, foe.y, k < 0.5 ? 3 : 1, p, 1);
      L.light(foe.x, foe.y, 22, p.light, 0.8 * (1 - k));
    });
    s.sparks(at.x, at.y, 4, [0xffffff, IRON_HI, p.hot], { speed: 30, up: 22, life: 0.3, z: CHEST });
    drops(s, at, p, 4);
  });
}

// --- Harpoon ---------------------------------------------------------------------

/** The harpoon: a barbed head on a shaft, pointing along `th`. */
function harpoon(px: Px, x: number, y: number, th: number, p: Pal): void {
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  for (let i = -4; i <= 1; i++) px.put(Math.round(x + ux * i), Math.round(y + uy * i), i < -2 ? 0xbc8a2a : 0xecc456, 1);
  for (let i = 2; i <= 4; i++) px.put(Math.round(x + ux * i), Math.round(y + uy * i), i === 4 ? 0xffffff : IRON_HI, 1);
  for (const s of [-1, 1]) px.put(Math.round(x + ux * 1.5 - uy * s * 1.5), Math.round(y + uy * 1.5 + ux * s * 1.5), IRON, 1);
  px.put(Math.round(x + ux * 4), Math.round(y + uy * 4), p.core, 1);
}

/** Harpoon: fired on its chain through the line of foes, biting at the far end, then reeled back in, a splash on each foe it ran through. */
const harpoonMove = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    // The gun raised: a glint at its mouth.
    s.add(c.lead, (L, k) => {
      const hx = c.from.x + (c.at.x >= c.from.x ? 5 : -5);
      const hy = c.from.y - HAND;
      dot(L.air, hx, hy, k > 0.6 ? p.core : p.hot, 1);
      L.light(hx, hy, 10, p.light, 0.4 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const a = { x: c.from.x + (c.at.x >= c.from.x ? 6 : -6), y: c.from.y - HAND };
    const b = { x: c.at.x, y: c.at.y - CHEST };
    const th = angle(a, b);
    const out = 0.14;
    const bite = 0.08;
    const back = 0.26;
    s.add(out + bite + back, (L, _k, t) => {
      let u: number;
      if (t < out) u = easeOut(t / out);
      else if (t < out + bite) u = 1;
      else u = 1 - easeIn((t - out - bite) / back);
      const x = lerp(a.x, b.x, u);
      const y = lerp(a.y, b.y, u);
      chain(L.air, a.x, a.y, x - Math.cos(th) * 4, y - Math.sin(th) * 4, t < out ? 1.5 : 0);
      harpoon(L.air, x, y, th, p);
      L.light(x, y, 10, p.light, 0.5);
    });
    // Each foe it runs through: a burst of water and a glint, then a tug as the line goes taut.
    for (const h of c.hits.length ? c.hits : [c.at]) {
      const f = clamp01(dist(c.from, h) / Math.max(1, dist(c.from, c.at)));
      s.add(0.01, () => {}, out * f, () => {
        drops(s, h, p, 5);
        s.add(0.18, (L, k) => star(L.air, h.x, h.y - CHEST, k < 0.5 ? 3 : 1, p, 1));
      });
      s.add(0.01, () => {}, out + bite, () => {
        splash(s, h, p, 4, 20, CHEST);
        s.add(0.2, (L, k) => ring(L.ground, h.x, h.y, 2 + 6 * easeOut(k), 1, p, 1 - k));
      });
    }
  },
};

// --- Crushing Depths -------------------------------------------------------------

/** The dome of deep water over `at`, `R` across, its floor's light wavering, bubbles and a fish's shadow in it. */
function dome(L: { ground: Px; air: Px }, at: Pt, R: number, Hd: number, t: number, p: Pal, a: number, seed: number): void {
  const ry = R * FLAT;
  for (let dy = -Math.ceil(Hd); dy <= Math.ceil(ry); dy++)
    for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
      const floor = Math.hypot(dx / R, dy / ry);
      const up = dy <= 0 ? Math.hypot(dx / R, dy / Hd) : 9;
      const e = Math.min(floor, up);
      if (e > 1) continue;
      const x = Math.round(at.x + dx);
      const y = Math.round(at.y + dy);
      if (dither(x, y) >= a) continue;
      if (floor <= 1) {
        const net = Math.sin(x * 0.5 + t * 4 + Math.sin(y * 0.4 + t * 2) * 1.5) + Math.sin(y * 0.8 - t * 3 + Math.sin(x * 0.3) * 1.3);
        L.ground.put(x, y, net > 1.5 ? p.hot : floor > 0.85 ? p.deep : DEEP, net > 1.5 ? 1 : 0.7);
      }
      if (e > 0.88 && (dy <= 0 ? up > 0.88 : true)) L.air.put(x, y, dy < -Hd * 0.4 && dx < 0 ? p.core : dy > 0 ? p.mid : p.hot, 0.85);
      else if (dy < 0 && dither(x + 1, y + 2) < 0.18) L.air.put(x, y, p.deep, 0.5);
    }
  // Bubbles rising and a fish circling.
  for (let i = 0; i < 6; i++) {
    const life = (t * 0.9 + hash(i, seed)) % 1;
    const bx = at.x + (hash(i, seed, 1) * 2 - 1) * R * 0.7 + Math.sin(t * 6 + i) * 0.8;
    const by = at.y + (hash(i, seed, 2) * 2 - 1) * ry * 0.6 - life * Hd * 0.9;
    if (dither(bx, by) < a) L.air.put(Math.round(bx), Math.round(by), life > 0.6 ? p.core : p.hot, 1);
  }
  const fa = t * 1.6;
  const fx = at.x + Math.cos(fa) * R * 0.5;
  const fy = at.y + Math.sin(fa) * ry * 0.5 - Hd * 0.35;
  const s = -Math.sin(fa) >= 0 ? 1 : -1;
  for (let k = -2; k <= 1; k++) L.air.put(Math.round(fx + k * s), Math.round(fy), 0x021018, 0.8 * a);
  L.air.put(Math.round(fx - 3 * s), Math.round(fy - 1), 0x021018, 0.7 * a);
  L.air.put(Math.round(fx - 3 * s), Math.round(fy + 1), 0x021018, 0.7 * a);
}

/** Crushing Depths: a bell of deep water drops onto the crowd, clenches on them as it holds, then bursts. */
const depths = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(16, c.r);
    // Its shadow grows on the ground as it falls, and the shell comes down out of the sky.
    s.add(c.lead, (L, k) => {
      shadowOf(L.ground, c.at.x, c.at.y, R, k);
      const lift = 50 * (1 - easeIn(k));
      for (let i = 0; i <= 30; i++) {
        const a = Math.PI + (i / 30) * Math.PI;
        L.air.put(Math.round(c.at.x + Math.cos(a) * R * (0.8 + 0.2 * k)), Math.round(c.at.y - lift + Math.sin(a) * R * 0.8), i % 6 ? p.hot : p.core, k);
      }
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(16, c.r);
    const hold = 1.5;
    const seed = Math.random() * 1000;
    s.shake(150, 0.003, c.at);
    splash(s, c.at, p, 12, 34, 6);
    s.add(hold, (L, k, t) => {
      const clench = Math.max(0, 1 - ((t * 2.5) % 1) * 3);
      const Rr = R * (1 - clench * 0.06);
      const a = k < 0.1 ? k / 0.1 : 1;
      dome(L, c.at, Rr, Rr * 0.85, t, p, a, seed);
      if (clench > 0) ring(L.ground, c.at.x, c.at.y, Rr * (0.3 + 0.7 * clench), 1, p, clench * 0.6);
      L.light(c.at.x, c.at.y - 8, R * 2.4, p.light, 0.45);
    });
    // The pressure, again and again, on everyone inside.
    for (let i = 1; i <= 3; i++)
      s.add(0.01, () => {}, i * 0.4, () => {
        for (const h of c.hits) s.sparks(h.x, h.y, 2, [p.core, p.hot], { speed: 8, up: 20, g: -10, life: 0.5, z: CHEST });
      });
    // And it gives way.
    s.add(0.01, () => {}, hold, () => {
      s.shake(220, 0.005, c.at);
      s.add(0.5, (L, k) => {
        ring(L.ground, c.at.x, c.at.y, R * (0.6 + 1.1 * easeOut(k)), 2 * (1 - k) + 0.6, p, 1 - k);
        const h = 34 * easeOut(Math.min(1, k * 3)) * (1 - k * 0.5);
        for (let y = 0; y < h; y++) {
          const w = 3 * (1 - y / Math.max(1, h)) * (1 - k) + 1;
          for (let dx = -Math.ceil(w); dx <= w; dx++) {
            const x = Math.round(c.at.x + dx);
            const yy = Math.round(c.at.y - y);
            if (dither(x, yy) >= 1 - k) continue;
            L.air.put(x, yy, Math.abs(dx) < w * 0.4 ? p.core : p.hot, 1);
          }
        }
        L.light(c.at.x, c.at.y - 12, R * 3, p.light, 0.9 * (1 - k));
      });
      for (let i = 0; i < 8; i++) {
        const th = (i / 8) * Math.PI * 2;
        splash(s, { x: c.at.x + Math.cos(th) * R * 0.8, y: c.at.y + Math.sin(th) * R * FLAT * 0.8 }, p, 4, 30, 4);
      }
      for (const h of c.hits) drops(s, h, p, 5);
    });
  },
};

export const DIVER_AUTO: Record<string, Kit> = {
  'automaton.diver': { melee: anchorBlow, skill: harpoonMove, ult: depths },
};
