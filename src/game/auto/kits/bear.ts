// The Bear's effects on the board: the maul's heavy swipes and two-paw
// smash, Earthsplitter's ring of cracking earth, and Ursine Wrath, a roar
// under a spirit bear's head that hardens him and quickens his claws. The
// Panda's burn jade and shed bamboo leaves.

import {
  angle,
  bump,
  CHEST,
  clamp01,
  disc,
  dither,
  easeIn,
  easeOut,
  hash,
  HEAD,
  impact,
  ring,
  tail,
  type Cast,
  type Kit,
  type Pal,
  type Pt,
  type Px,
  type Stage,
} from '../paint';

/** Earth thrown up by paws and cracks. */
const DIRT = [0x7a5a38, 0x5a3e26, 0xa4703c];
/** Bamboo leaves, light side first. */
const LEAF = [0xb8e070, 0x6aa83a, 0x3a7a2a];
/** The cracks run out this far, as a share of the spell's radius. */
const CRACK_REACH = 1.1;
const CRACKS = 7;
/** The spirit head's size over him, px. */
const HEAD_R = 12;

/** A pixel that fades in a clean checker as `a` falls. */
function pd(px: Px, x: number, y: number, c: number, a = 1): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  if (a < 1 && dither(X, Y) >= a) return;
  px.put(X, Y, c, 1);
}

function dust(s: Stage, at: Pt, n: number, speed = 18): void {
  s.sparks(at.x, at.y, n, DIRT, { speed, up: 18, g: 70, life: 0.45, z: 1, ground: true, spread: 4 });
}

function leaves(s: Stage, at: Pt, n: number, speed = 24): void {
  s.sparks(at.x, at.y, n, LEAF, { speed, up: 26, g: 40, life: 0.7, z: 6, spread: 6 });
}

/** Four thick claw streaks across (x, y) along `th`, ripping across early in `k`. */
function claws(px: Px, x: number, y: number, th: number, len: number, p: Pal, k: number): void {
  const reach = easeOut(Math.min(1, k / 0.3));
  const fade = tail(k, 0.4);
  const c = Math.cos(th);
  const sn = Math.sin(th);
  for (let i = 0; i < 4; i++) {
    const off = (i - 1.5) * 3;
    const L = len * (i === 0 || i === 3 ? 0.8 : 1);
    for (let u = 0; u <= L * reach; u += 0.5) {
      const f = u / L;
      const w = bump(f) * 1.2;
      const lead = u > L * reach - 2;
      for (let v = -w; v <= w + 0.01; v += 0.5) {
        const a = -L / 2 + u;
        const col = lead ? p.core : Math.abs(v) > w - 0.5 ? p.deep : p.hot;
        pd(px, x + c * a - sn * (off + v), y + sn * a + c * (off + v), col, fade);
      }
    }
  }
}

/** Jagged cracks running out from (x, y) to `R`, glowing in the seams, opening over `k`. */
function cracks(px: Px, x: number, y: number, R: number, p: Pal, k: number, seed: number): void {
  const open = easeOut(Math.min(1, k / 0.25));
  const glow = tail(k, 0.35);
  for (let n = 0; n < CRACKS; n++) {
    let th = (n / CRACKS) * Math.PI * 2 + hash(n, seed) * 0.6;
    let cx = x;
    let cy = y;
    const len = R * (0.7 + 0.3 * hash(n, seed, 1)) * open;
    for (let u = 0; u < len; u += 1) {
      th += (hash(n, seed, u) - 0.5) * 0.5;
      cx += Math.cos(th);
      cy += Math.sin(th) * 0.62;
      const hot = u < len * 0.6;
      pd(px, cx, cy, hot ? p.hot : p.mid, glow);
      if (u < len * 0.3) pd(px, cx, cy + 1, p.deep, glow * 0.8);
    }
  }
  // The crust round the slam, heaved up.
  ring(px, x, y, 5 + 4 * open, 2, p, glow * 0.8, 0.35, seed);
}

/** A stunned foe: little stars wheeling over its head. */
function dazed(s: Stage, at: Pt, p: Pal, dur: number): void {
  s.add(dur, (L, k, t) => {
    const a = tail(k, 0.75);
    for (let i = 0; i < 3; i++) {
      const th = t * 6 + (i * Math.PI * 2) / 3;
      const sx = at.x + Math.cos(th) * 5;
      const sy = at.y - HEAD - 4 + Math.sin(th) * 2;
      pd(L.air, sx, sy, p.core, a);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pd(L.air, sx + dx, sy + dy, p.hot, a * 0.8);
    }
  });
}

/** The maul: a heavy raking swipe, and on the combo's last both paws smash the ground in front. */
function maul(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const base = angle(from, at);
  if (!heavy) {
    const th = base + Math.PI / 2 + (Math.random() < 0.5 ? 0.5 : -0.5);
    s.add(0.3, (L, k) => claws(L.air, at.x, at.y - CHEST, th, 18, p, k));
    s.sparks(at.x, at.y, 5, p.tints, { speed: 28, up: 18, z: CHEST, life: 0.32 });
    s.add(0.1, (L, k) => L.light(at.x, at.y - CHEST, 24, p.light, 0.7 * (1 - k)));
    return;
  }
  const seed = Math.floor(Math.random() * 1000);
  s.add(0.08, (L, k) => disc(L.air, at.x, at.y - 16 + 14 * easeIn(k), 6, 4, p.hot, 1 - k * 0.5, 0.7), 0, () => {
    s.shake(90, 0.0025, at);
    s.add(0.6, (L, k) => {
      cracks(L.ground, at.x, at.y, 14, p, k, seed);
      L.light(at.x, at.y - 4, 32, p.light, 0.8 * (1 - k));
    });
    dust(s, at, 8, 26);
    impact(s, at, p, 0.8);
  });
}

/** Earthsplitter: he rears up, glowing, then slams; the earth cracks out in a ring and the foes struck reel. */
const earthsplitter = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    s.add(c.lead, (L, k) => {
      // The ground he'll strike, drawing in light.
      ring(L.ground, c.from.x, c.from.y, Math.max(18, c.r) * (1 - 0.3 * easeOut(k)), 1, p, 0.5 * k, 0.4, 3);
      L.light(c.from.x, c.from.y - CHEST, 26, p.light, 0.5 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(20, c.r) * CRACK_REACH;
    const { x, y } = c.from;
    const seed = Math.floor(Math.random() * 1000);
    s.shake(200, 0.005, c.from);
    s.add(1.1, (L, k) => {
      cracks(L.ground, x, y, R, p, k, seed);
      L.light(x, y, 50, p.light, 0.8 * tail(k, 0.3));
    });
    s.add(0.5, (L, k) => {
      ring(L.ground, x, y, 6 + R * easeOut(k), 3, p, 1 - k, 0.2, seed);
      ring(L.ground, x, y, R * 0.6 * easeOut(k), 1, p, (1 - k) * 0.6, 0.5, seed + 1);
    });
    dust(s, c.from, 14, 44);
    if (c.look.includes('panda')) leaves(s, c.from, 8, 34);
    for (const h of c.hits) {
      impact(s, h, p, 0.7);
      dazed(s, h, p, Math.max(0.6, c.stun));
    }
  },
};

/** A spirit bear's head in light: round, two round ears, a pale muzzle, blazing eyes and jaws `open` 0..1. */
function bearHead(px: Px, x: number, y: number, R: number, open: number, p: Pal, a: number): void {
  if (a <= 0) return;
  const E = Math.ceil(R * 1.5);
  for (let py = -E; py <= E; py++) {
    for (let qx = -E; qx <= E; qx++) {
      const fx = qx / R;
      const fy = py / R;
      const skull = Math.hypot(fx, fy * 1.08) <= 1;
      const earD = Math.hypot(Math.abs(fx) - 0.78, fy + 0.78);
      const ear = earD <= 0.32;
      if (!skull && !ear) continue;
      let col: number;
      if (!skull) col = earD < 0.16 ? p.deep : p.mid;
      else {
        const jaw = fy > 0.36 && fy < 0.36 + 0.42 * open && Math.abs(fx) < 0.3 - (fy - 0.36) * 0.2;
        const eye = Math.abs(Math.abs(fx) - 0.42) < 0.1 && Math.abs(fy + 0.12 - (Math.abs(fx) - 0.42) * 0.5) < 0.07;
        const nose = fy > 0.1 && fy < 0.3 && Math.abs(fx) < 0.18 - (fy - 0.1) * 0.4;
        const muzzle = Math.hypot(fx / 0.48, (fy - 0.32) / 0.4) <= 1;
        const rim = Math.hypot(fx, fy * 1.08) > 0.86;
        if (jaw) col = Math.abs(fx) > 0.18 && fy < 0.5 ? 0xffffff : 0x1a0808;
        else if (eye) col = 0xffffff;
        else if (nose) col = p.deep;
        else if (muzzle) col = p.core;
        else col = rim ? p.deep : fy < -0.4 ? p.mid : p.hot;
      }
      pd(px, x + qx, y + py, col, a);
    }
  }
}

/** Ursine Wrath: he roars under a spirit bear's head and the rage flares round him (the barrier and haste are the sim's). */
const ursineWrath = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    s.add(c.lead, (L, k) => {
      const y = c.from.y - 36 + 6 * (1 - easeOut(k));
      bearHead(L.air, c.from.x, y, HEAD_R * (0.7 + 0.2 * easeOut(k)), 0.1, p, Math.min(1, k * 2.5));
      L.light(c.from.x, y, 36, p.light, 0.4 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.from;
    s.shake(220, 0.005, c.from);
    s.add(0.9, (L, k) => {
      const pulse = 1 + 0.12 * Math.max(0, 1 - (k * 0.9) / 0.15);
      bearHead(L.air, x, y - 36, HEAD_R * pulse, 0.4 + 0.6 * bump(clamp01(k * 2)), p, tail(k, 0.65));
      L.light(x, y - 36, 50, p.light, 0.45 * tail(k, 0.65));
    });
    s.add(0.5, (L, k) => ring(L.ground, x, y, 8 + 26 * easeOut(k), 3, p, 1 - k, 0.25, 7));
    dust(s, c.from, 10, 40);
    if (c.look.includes('panda')) leaves(s, c.from, 10, 30);
    // The rage flaring round his feet as it takes him (short: he moves on).
    s.add(1.2, (L, k, t) => {
      const a = tail(k, 0.6) * (0.55 + 0.25 * Math.sin(t * 9));
      ring(L.ground, x, y, 11 + Math.sin(t * 6), 1, p, a, 0.3, Math.floor(t * 8));
      L.light(x, y - CHEST, 30, p.light, 0.35 * a);
    });
  },
};

export const BEAR_KITS: Record<string, Kit> = {
  'bear.bear': { melee: maul, skill: earthsplitter, ult: ursineWrath },
};
