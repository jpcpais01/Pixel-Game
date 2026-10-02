// The Force Sage's effects on the board: stones torn from the ground and
// hurled, the Force barrier's dome and burst, and Levitation, every foe round
// her lifted off its shadow and slammed down. The Starseer's stones are dark
// meteorites veined with her starlight.

import { CHEST, clamp01, dither, disc, easeIn, easeOut, FLAT, hash, impact, OVER, ring, rune, type Kit, type Move, type Pal, type Pt, type Px, type Stage } from '../paint';
import { flight } from './common';

const ROCK = [0xbcb4a0, 0x958c7c, 0x6e665a, 0x4a443a];
const METEOR = [0x5a5070, 0x423a52, 0x2c2638, 0x1a1622];
const GRIT = [0x8a7a64, 0x6a5a48, 0x4a3a2a];

/** Her stones are meteorites when her Force is starlight (the Starseer's palette). */
const meteor = (p: Pal): boolean => ((p.mid >> 16) & 255) > ((p.mid >> 8) & 255);

/** A lumpy stone `r` px across turned to `th`: lit on its upper left, a rim of the Force round it. */
function stone(px: Px, x: number, y: number, r: number, th: number, p: Pal, a = 1): void {
  const tones = meteor(p) ? METEOR : ROCK;
  const R = Math.ceil(r + 1);
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const ang = Math.atan2(dy, dx) - th;
      const rr = r * (1 + 0.16 * Math.sin(ang * 3 + 1.3));
      const d = Math.hypot(dx, dy);
      const X = Math.round(x + dx);
      const Y = Math.round(y + dy);
      if (a < 1 && dither(X, Y) >= a) continue;
      if (d <= rr) {
        const lit = -(dx + dy) / (r * 1.4);
        const c = meteor(p) && Math.abs(Math.sin(dx * 1.4 + dy * 0.8 + th)) < 0.2 ? p.core : tones[lit > 0.4 ? 0 : lit > 0 ? 1 : lit > -0.4 ? 2 : 3];
        px.put(X, Y, c, 1);
      } else if (d <= rr + 1) px.put(X, Y, p.mid, 0.9);
    }
}

/** A stone thrown: it tumbles on a low arc, a thread of the Force behind it, and bursts into grit on the foe. */
function stoneShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 7);
  const turn = (Math.random() < 0.5 ? -1 : 1) * 12;
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    for (let i = 5; i >= 1; i--) {
      const r = pos(Math.max(0, k - i * 0.05));
      if (dither(r.x, r.y) < 0.85 - i / 7) L.air.put(Math.round(r.x), Math.round(r.y), i < 3 ? p.hot : p.mid, 1);
    }
    disc(L.ground, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 2.4, 1.2, 0x0b0818, 0.5, 0.5);
    stone(L.air, q.x, q.y, 2.4, t * turn, p);
    L.light(q.x, q.y, 14, p.light, 0.45);
  }, 0, () => {
    impact(s, b, p, 0.6);
    s.sparks(b.x, b.y, 7, meteor(p) ? [p.core, ...METEOR.slice(0, 2)] : [...ROCK.slice(0, 2), ...GRIT], { speed: 26, up: 28, g: 140, life: 0.45, z: CHEST });
  });
}

/** The barrier: a dome of light springs up round her as she flings her hands apart, then bursts, throwing foes back. */
const barrier: Move = {
  cast(s, c) {
    const p = c.pal;
    const { x, y } = c.from;
    s.add(c.lead, (L, k) => dome(L.ground, L.air, x, y, 13 * easeOut(k * 1.5), 18 * easeOut(k * 1.5), p, 0.6 + 0.4 * k, k * 6));
  },
  hit(s, c) {
    const p = c.pal;
    const { x, y } = c.from;
    s.add(0.9, (L, k, t) => {
      dome(L.ground, L.air, x, y, 13, 18, p, k < 0.75 ? 0.9 : (1 - k) * 3.6, t * 6);
      L.light(x, y - 10, 34, p.light, 0.5 * (1 - k));
    });
    s.add(0.35, (L, k) => ring(L.ground, x, y, Math.max(14, c.r) * easeOut(k), 2.2 * (1 - k) + 0.6, p, 1 - k), 0.75);
    s.sparks(x, y - 8, 12, p.tints, { speed: 34, up: 20, life: 0.5, z: 8, spread: 6 });
    for (const h of c.hits) impact(s, h, p, 0.7);
  },
};

/** The dome: its outline over her, bands circling it, its rim on the ground. */
function dome(ground: Px, air: Px, x: number, y: number, r: number, h: number, p: Pal, a: number, t: number): void {
  if (r < 1 || a <= 0) return;
  for (let i = 0; i <= 40; i++) {
    const th = (i / 40) * Math.PI;
    const X = Math.round(x + Math.cos(th) * r);
    const Y = Math.round(y - Math.sin(th) * h);
    if (a < 1 && dither(X, Y) >= a) continue;
    air.put(X, Y, i % 6 === 0 ? p.core : p.hot, 1);
  }
  for (let b = 0; b < 2; b++) {
    const u = ((b + t * 0.2) % 2) / 2;
    const rr = r * Math.sqrt(1 - u * u);
    for (let i = 0; i < 32; i++) {
      if (i % 3 === 0) continue;
      const th = (i / 32) * Math.PI * 2;
      if (Math.sin(th) < 0) continue;
      const X = Math.round(x + Math.cos(th) * rr);
      const Y = Math.round(y - h * u + Math.sin(th) * rr * FLAT);
      if (dither(X, Y) >= a * 0.7) continue;
      air.put(X, Y, p.mid, 1);
    }
  }
  ring(ground, x, y, r, 0.8, p, a);
}

/**
 * Levitation: a ring of light rolls out from her and pebbles rise off the
 * ground all round; every foe in it is held up (dizzied, the sim's stun), a
 * band of light round each over the shadow it left; then they're slammed
 * down, dust bursting from each.
 */
const levitation: Move = {
  cast(s, c) {
    const p = c.pal;
    const { x, y } = c.from;
    const R = Math.max(30, c.r);
    s.add(c.lead, (L, k, t) => {
      ring(L.ground, x, y, R * easeOut(k * 1.6), 1.2, p, 0.9);
      rune(L.ground, x, y, 12 * easeOut(k * 2), t * 2, p, 0.9);
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2 + 0.3;
        const rr = R * (0.35 + 0.6 * hash(i, 3));
        const px = x + Math.cos(ang) * rr;
        const py = y + Math.sin(ang) * rr * FLAT;
        const z = 18 * easeOut(clamp01(k * 1.4 - hash(i, 5) * 0.3));
        disc(L.ground, px, py, 1.6, 0.9, 0x0b0818, 0.6, 0.5);
        stone(L.air, px, py - z, 1.2, t * 3 + i, p);
      }
      L.light(x, y - 12, R * 2, p.light, 0.5 * k);
    });
  },
  hit(s, c) {
    const p = c.pal;
    const { x, y } = c.from;
    const R = Math.max(30, c.r);
    const hold = Math.max(0.6, c.stun);
    // Held up: a band round each one held and motes rising from its shadow, then the slam.
    s.add(hold, (L, k, t) => {
      ring(L.ground, x, y, R, 1, p, 0.8 * (1 - k * 0.5));
      for (const h of c.hits) {
        disc(L.ground, h.x, h.y, 5, 2.4, 0x0b0818, 0.6, 0.6);
        ring(L.ground, h.x, h.y, 6, 0.8, p, 0.8);
        ring(L.air, h.x, h.y - OVER * 0.55, 7 + Math.sin(t * 9) * 0.6, 0.7, p, 0.85, 0.4);
        for (let i = 0; i < 3; i++) {
          const u = (t * 1.2 + i / 3) % 1;
          L.air.put(Math.round(h.x - 4 + i * 4), Math.round(h.y - 16 * u), p.hot, 1);
        }
      }
      L.light(x, y - 12, R * 2, p.light, 0.4);
    });
    s.add(0.45, (L, k) => {
      for (const h of c.hits) {
        ring(L.ground, h.x, h.y, 4 + 12 * easeOut(k), 2 * (1 - k) + 0.5, p, 1 - k);
        for (let i = 0; i < 8; i++) {
          const ang = Math.PI + (i / 7) * Math.PI;
          const r = 3 + 9 * easeIn(k) + hash(i, 2) * 3;
          L.air.put(Math.round(h.x + Math.cos(ang) * r), Math.round(h.y + Math.sin(ang) * r * 0.6), i % 3 ? GRIT[0] : p.mid, 1);
        }
      }
    }, hold, () => {
      s.shake(220, 0.005, c.from);
      for (const h of c.hits) s.sparks(h.x, h.y, 8, [...GRIT, p.hot], { speed: 30, up: 30, g: 140, life: 0.45, z: 2 });
    });
  },
};

export const SAGE_KITS: Record<string, Kit> = {
  'jedi.sage': { shot: stoneShot, skill: barrier, ult: levitation },
};
