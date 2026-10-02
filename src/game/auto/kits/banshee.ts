// The Banshee's effects on the board: her keen (ripples of sound rolling out
// of her mouth at a foe), the Shriek (rings bursting round her, the foes
// shivering in terror) and the Lament (great rings pealing out over a wide
// circle, ghost-lights rising, and the knell). The Ghost Bride's carry blue
// rose petals.

import { CELL, CHEST, circle, clamp01, dither, dot, easeOut, FLAT, hash, HEAD, impact, line, pool, ring, shade, shock, tail, type Kit, type Move, type Pal, type Pt, type Px, type Stage } from '../paint';

/** Her mouth over her feet on the board. */
const MOUTH = 17;
const PETALS = [0x6a86e0, 0x3c52b4, 0xa4bcff];

const later = (s: Stage, wait: number, f: () => void): void => s.add(0.01, () => {}, Math.max(0, wait), f);

/** A ripple of sound: a band bowed across a cone `spread` wide round `ang`, thinning to its ends. */
function ripple(px: Px, cx: number, cy: number, r: number, ang: number, spread: number, p: Pal, a: number, w = 1): void {
  const n = Math.max(6, Math.ceil(spread * 2 * r * 1.4));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const q = ang - spread + k * spread * 2;
    const end = Math.abs(k - 0.5) * 2;
    for (let o = -w; o <= w; o += 0.5) {
      const x = Math.round(cx + Math.cos(q) * (r + o));
      const y = Math.round(cy + Math.sin(q) * (r + o) * 0.75);
      if (dither(x, y) >= a * (1 - Math.max(0, end - 0.6) * 2)) continue;
      px.put(x, y, shade(p, Math.abs(o) / (w + 0.5) + end * 0.3), 1);
    }
  }
}

/** The keen: three ripples rolling from her mouth to the foe. */
function keen(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean, look: string): void {
  const mx = from.x;
  const my = from.y - MOUTH;
  const tx = at.x;
  const ty = at.y - CHEST;
  const ang = Math.atan2((ty - my) / 0.75, tx - mx);
  const R = Math.hypot(tx - mx, (ty - my) / 0.75) + 4;
  s.add(0.3, (L, k, t) => {
    const front = R * easeOut(k);
    for (let i = 0; i < 3; i++) {
      const r = front - i * 6;
      if (r < 4) continue;
      ripple(L.air, mx, my, r, ang, 0.45, p, tail(k, 0.6) * (1 - i * 0.25), i === 0 ? 1 : 0.5);
    }
    if (look === 'bride') for (let i = 0; i < 3; i++) dot(L.air, mx + Math.cos(ang + (i - 1) * 0.3) * (front - 4), my + Math.sin(ang + (i - 1) * 0.3) * (front - 4) * 0.75 + Math.sin(t * 20 + i), PETALS[i]);
    L.light(mx + Math.cos(ang) * front, my + Math.sin(ang) * front * 0.75, 18, p.light, 0.5 * (1 - k));
  }, 0, () => impact(s, at, p, heavy ? 0.8 : 0.5));
}

/** Shivering marks of terror over a head. */
function fright(s: Stage, h: Pt, p: Pal, sec: number): void {
  s.add(sec, (L, k, t) => {
    const a = tail(k, 0.75);
    const j = Math.sin(t * 60) > 0 ? 1 : 0;
    line(L.air, h.x - 4 + j, h.y - HEAD - 5, h.x - 5 + j, h.y - HEAD - 2, p.core, a);
    line(L.air, h.x + 4 + j, h.y - HEAD - 5, h.x + 5 + j, h.y - HEAD - 2, p.core, a);
    const wy = h.y - HEAD - 6 + Math.sin(t * 9) * 1.5;
    dot(L.air, h.x + j, wy, p.core, a);
    dot(L.air, h.x - 1 + j, wy + 1, p.hot, a);
    dot(L.air, h.x + 1 + j, wy + 1, p.hot, a);
  });
}

/** Shriek: she gathers it, then rings burst from her and the foes near shiver in terror. */
const shriek: Move = {
  cast(s, c) {
    const p = c.pal;
    const { x, y } = c.from;
    s.add(c.lead, (L, k) => {
      ring(L.ground, x, y, 8 * (1 - k) + 3, 1, p, k);
      L.light(x, y - MOUTH, 16 + 10 * k, p.light, 0.5 * k);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const R = Math.max(18, c.r);
    const { x, y } = c.from;
    s.shake(120, 0.003);
    for (let i = 0; i < 3; i++) later(s, i * 0.07, () => shock(s, c.from, R * (1 - i * 0.15), p, 0.4, 2 - i * 0.5));
    s.add(0.3, (L, k) => {
      for (let i = 0; i < 10; i++) {
        const q = (i / 10) * Math.PI * 2 + 0.3;
        const r0 = 6 + k * 20;
        let px = x + Math.cos(q) * r0;
        let py = y - MOUTH + Math.sin(q) * r0 * 0.75;
        for (let j = 0; j < 3; j++) {
          const nx = px + Math.cos(q + (j % 2 ? 0.6 : -0.6)) * 2.5;
          const ny = py + Math.sin(q + (j % 2 ? 0.6 : -0.6)) * 2;
          dot(L.air, nx, ny, j ? p.hot : p.core, 1 - k);
          px = nx;
          py = ny;
        }
      }
    });
    s.sparks(x, y, 12, c.look === 'bride' ? [...PETALS, p.core] : p.tints, { speed: 40, up: 30, z: MOUTH, life: 0.5 });
    c.hits.forEach((h, i) => {
      later(s, 0.05 + i * 0.03, () => impact(s, h, p, 0.7));
      fright(s, h, p, Math.max(1, c.stun));
    });
  },
};

/** Lament: she sings; rings peal out wider and louder, ghost-lights rise, and the knell strikes. */
const lament: Move = {
  cast(s, c) {
    const p = c.pal;
    const { x, y } = c.from;
    s.add(c.lead, (L, k, t) => {
      pool(L.ground, x, y, 10 + 8 * k, p.deep, p.deep, k * 0.7, 0.5);
      for (let i = 0; i < 6; i++) {
        const life = (t * 0.5 + hash(i, 3)) % 1;
        const q = hash(i, 7) * Math.PI * 2 + t;
        dot(L.air, x + Math.cos(q) * 12, y + Math.sin(q) * 12 * FLAT - 4 - life * 24, p.core, k * Math.sin(life * Math.PI));
      }
      L.light(x, y - MOUTH, 20 + 16 * k, p.light, 0.6 * k);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const R = Math.max(CELL * 1.6, c.r);
    const { x, y } = c.from;
    const bride = c.look === 'bride';
    s.add(1.4, (L, k, t) => {
      const on = tail(k, 0.85);
      for (let i = 0; i < 3; i++) {
        const kk = clamp01((k - i * 0.22) / 0.4);
        if (kk > 0 && kk < 1) ring(L.ground, x, y, R * easeOut(kk), 1 + i, p, 1 - kk);
      }
      for (let i = 0; i < 3; i++) circle(L.ground, x, y, 6 + ((t * 0.9 + i / 3) % 1) * R, p.deep, on * 0.6);
      for (let i = 0; i < 10; i++) {
        const life = (t * 0.6 + hash(i, 3)) % 1;
        const q = hash(i, 7) * Math.PI * 2 + t * 1.4;
        const r = 8 + hash(i, 11) * R * 0.6;
        dot(L.air, x + Math.cos(q) * r, y + Math.sin(q) * r * FLAT - 4 - life * 30, i % 2 ? p.core : p.hot, on * Math.sin(life * Math.PI));
        if (bride) dot(L.air, x + Math.cos(q + 1) * r * 1.1, y + Math.sin(q + 1) * r * FLAT - 30 + life * 30, PETALS[i % 3], on);
      }
      L.light(x, y - MOUTH, R * 2, p.light, 0.7 * on);
    });
    // The knell, at the end.
    later(s, 0.9, () => {
      s.shake(220, 0.005);
      shock(s, c.from, R * 1.1, p, 0.5, 3);
      s.sparks(x, y, 20, bride ? [...PETALS, p.core] : [p.core, p.hot, p.mid], { speed: 50, up: 30, z: MOUTH, life: 0.6 });
      c.hits.forEach((h, i) => later(s, i * 0.02, () => impact(s, h, p, 1)));
    });
    c.hits.forEach((h) => s.sparks(h.x, h.y, 3, p.tints, { speed: 18, up: 16, z: CHEST, life: 0.4 }));
  },
};

export const BANSHEE_AUTO: Record<string, Kit> = {
  // The board passes no look to a blow, so the keen is drawn plain; its colours are still the look's.
  'phantom.weeper': { melee: (s, at, from, p, heavy) => keen(s, at, from, p, heavy, ''), skill: shriek, ult: lament },
};
