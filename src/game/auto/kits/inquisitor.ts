// The Inquisitor's effects on the board: his ring saber whirled across a
// foe close by or thrown out to it and back, Hunter's leap coming down in a
// ring of red shockwave, and Purge, the ring spiralling out round him and
// home again, a trail of afterimages wheeling behind it.

import {
  angle,
  arc,
  bump,
  CHEST,
  clamp01,
  dist,
  dither,
  dot,
  easeIn,
  easeOut,
  FLAT,
  hash,
  impact,
  line,
  ring,
  shock,
  star,
  stroke,
  type Kit,
  type Pal,
  type Pt,
  type Px,
  type Stage,
} from '../paint';

/** The ring's radius on the board and its blades' length. */
const RING_R = 2.6;
const BLADE = 6;
/** How flat the spinning ring looks. */
const TILT = 0.55;
/** Purge: how long it whirls (s), and its turns. */
const PURGE_LIFE = 1.3;
const PURGE_TURNS = 4;

const later = (s: Stage, wait: number, f: () => void): void => s.add(0.01, () => {}, Math.max(0, wait), f);

/** The ring saber at (x, y), blades turned to `ang`; a ghost is only its blades, dithered away by `a`. */
function ringAt(px: Px, x: number, y: number, ang: number, p: Pal, a = 1, ghost = false): void {
  for (const off of [0, Math.PI]) {
    const t = ang + off;
    const ex = x + Math.cos(t) * RING_R;
    const ey = y + Math.sin(t) * RING_R * TILT;
    const vx = -Math.sin(t) * BLADE;
    const vy = Math.cos(t) * BLADE * TILT;
    if (ghost) {
      for (let i = 0; i <= BLADE; i++) {
        const qx = ex + (vx * i) / BLADE;
        const qy = ey + (vy * i) / BLADE;
        if (dither(qx, qy) < a) dot(px, qx, qy, i > BLADE * 0.5 ? p.mid : p.deep, 0.9);
      }
      continue;
    }
    stroke(px, ex, ey, ex + vx, ey + vy, 0.9, p, a);
    line(px, ex, ey, ex + vx, ey + vy, p.core, a);
  }
  if (ghost) return;
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2;
    dot(px, x + Math.cos(t) * RING_R, y + Math.sin(t) * RING_R * TILT, Math.sin(t) < 0 ? 0xd2d7e6 : 0x5a5e70, a);
  }
}

/** The basic attack: up close the ring whirled across the foe; the combo's last throws it out to the foe and back. */
function strike(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const a = { x: from.x, y: from.y - CHEST };
  const b = { x: at.x, y: at.y - CHEST };
  if (heavy) {
    // Thrown: a blink out (it has just struck), then the long curve home.
    const side = hash(Math.round(at.x), Math.round(at.y)) < 0.5 ? 1 : -1;
    const d = dist(a, b);
    const nx = (-(b.y - a.y) / (d || 1)) * side;
    const ny = ((b.x - a.x) / (d || 1)) * side;
    s.add(0.36, (L, k, t) => {
      const out = k < 0.2;
      const u = out ? easeOut(k / 0.2) : 1 - easeIn((k - 0.2) / 0.8);
      const bow = Math.sin(u * Math.PI) * Math.min(10, d * 0.3);
      const x = a.x + (b.x - a.x) * u + nx * bow;
      const y = a.y + (b.y - a.y) * u + ny * bow;
      for (let i = 3; i >= 1; i--) {
        const uu = clamp01(out ? u - i * 0.08 : u + i * 0.06);
        const bw = Math.sin(uu * Math.PI) * Math.min(10, d * 0.3);
        ringAt(L.air, a.x + (b.x - a.x) * uu + nx * bw, a.y + (b.y - a.y) * uu + ny * bw, t * 40 - i * 0.6, p, 0.6 - i * 0.15, true);
      }
      ringAt(L.air, x, y, t * 40, p, 1);
      L.light(x, y, 22, p.light, 0.7);
    });
    impact(s, at, p, 0.8);
    s.sparks(at.x, at.y, 6, p.tints, { speed: 30, up: 18, z: CHEST, life: 0.3, dir: angle(from, at), cone: 0.9 });
    return;
  }
  // Whirled: a crescent across the foe with the spinning ring racing round at its head.
  const th = Math.atan2((b.y - a.y) / 0.75, b.x - a.x);
  const r = Math.min(26, Math.max(14, dist(from, at) + 4));
  const way = hash(Math.round(at.x), Math.round(at.y), 3) < 0.5 ? 1 : -1;
  const a0 = th - 1.2 * way;
  const a1 = th + 1.2 * way;
  s.add(0.24, (L, k, t) => {
    const head = a0 + (a1 - a0) * easeOut(Math.min(1, k / 0.55));
    const tailA = a0 + (a1 - a0) * easeIn(clamp01((k - 0.2) / 0.8));
    if (Math.abs(head - tailA) > 0.08) arc(L.air, a.x, a.y, r, 2.6, tailA, head, p, 1);
    if (k < 0.6) ringAt(L.air, a.x + Math.cos(head) * (r - 4), a.y + Math.sin(head) * (r - 4) * 0.75, t * 45, p, 1);
    L.light(a.x + Math.cos(th) * r * 0.6, a.y + Math.sin(th) * r * 0.45, 26, p.light, 0.7 * (1 - k));
  });
  later(s, 0.07, () => s.sparks(at.x, at.y, 5, p.tints, { speed: 30, up: 16, z: CHEST, life: 0.3, dir: angle(from, at), cone: 1 }));
}

/** Hunter's leap: a red arc of afterimages over to the quarry, then down in a ring of shockwave and cracks. */
const huntersLeap = {
  cast(s: Stage, c: { from: Pt; at: Pt; pal: Pal; lead: number }): void {
    const { from, at, pal: p } = c;
    s.sparks(from.x, from.y, 6, p.tints, { speed: 26, up: 10, life: 0.3, ground: true });
    s.add(Math.max(0.2, c.lead), (L, k) => {
      // The trail he leaves through the air, fading behind him.
      for (let i = 0; i < 6; i++) {
        const u = k - i * 0.06;
        if (u <= 0) continue;
        const x = from.x + (at.x - from.x) * u;
        const y = from.y + (at.y - from.y) * u - Math.sin(u * Math.PI) * 26 - CHEST;
        dot(L.air, x, y, i ? p.mid : p.core, 1 - i * 0.15, i < 2 ? 2 : 1);
      }
    });
  },
  hit(s: Stage, c: { at: Pt; hits: Pt[]; r: number; pal: Pal }): void {
    const { at, pal: p } = c;
    shock(s, at, Math.max(14, c.r), p, 0.42, 2.4);
    s.add(0.5, (L, k) => {
      // Cracks run out from where he came down, glowing and cooling.
      for (let i = 0; i < 7; i++) {
        const q = (i / 7) * Math.PI * 2 + 0.3;
        const len = (8 + hash(i, 5) * 8) * easeOut(k * 3);
        const x1 = at.x + Math.cos(q) * len;
        const y1 = at.y + Math.sin(q) * len * FLAT;
        line(L.ground, at.x, at.y, x1, y1, k < 0.4 ? p.hot : p.mid, 1 - k);
      }
      if (k < 0.3) star(L.air, at.x, at.y - 8, Math.round(5 * (1 - k * 3)), p, 1);
      L.light(at.x, at.y - 6, 50, p.light, 0.9 * (1 - k));
    });
    s.sparks(at.x, at.y, 14, p.tints, { speed: 46, up: 30, life: 0.45, z: 2 });
    for (const h of c.hits) impact(s, h, p, 0.7);
    s.shake(160, 2.2, at);
  },
};

/** Purge: the ring spun up overhead, then out round him in a widening spiral and home, carving all it passes. */
const purge = {
  cast(s: Stage, c: { from: Pt; pal: Pal; lead: number }): void {
    const { from, pal: p } = c;
    s.add(Math.max(0.2, c.lead), (L, k, t) => {
      ringAt(L.air, from.x - 3, from.y - 30, t * 30, p, 0.5 + 0.5 * k);
      L.light(from.x, from.y - 28, 20 + 16 * k, p.light, 0.5 + 0.4 * k);
    });
  },
  hit(s: Stage, c: { from: Pt; hits: Pt[]; r: number; pal: Pal }): void {
    const { from, pal: p } = c;
    const R = Math.max(18, c.r);
    const spot = (k: number) => {
      const r = 6 + (R - 6) * Math.pow(bump(k), 0.8);
      const th = k * PURGE_TURNS * Math.PI * 2;
      return { x: from.x + Math.cos(th) * r, y: from.y + Math.sin(th) * r * FLAT, r };
    };
    s.add(PURGE_LIFE, (L, k, t) => {
      const q = spot(k);
      ring(L.ground, from.x, from.y, q.r, 0.8, p, 0.35, 0.55, Math.floor(t * 12));
      for (let i = 5; i >= 1; i--) {
        const g = spot(Math.max(0, k - i * 0.018));
        ringAt(L.air, g.x, g.y - CHEST, t * 40 - i * 0.5, p, 0.7 - i * 0.11, true);
      }
      ringAt(L.air, q.x, q.y - CHEST, t * 40, p, 1);
      L.light(q.x, q.y - CHEST, 26, p.light, 0.8);
    });
    // Each foe is cut as the spiral sweeps past it.
    c.hits.forEach((h, i) => later(s, (0.15 + (i % 5) * 0.17) * PURGE_LIFE, () => impact(s, h, p, 0.6)));
    later(s, PURGE_LIFE, () => {
      shock(s, from, R * 0.7, p, 0.36, 2.2);
      s.sparks(from.x, from.y, 12, p.tints, { speed: 40, up: 26, z: CHEST, life: 0.4 });
      s.shake(140, 1.6, from);
    });
  },
};

export const INQUISITOR_KITS: Record<string, Kit> = {
  'jedi.inquisitor': { melee: strike, skill: huntersLeap, ult: purge },
};
