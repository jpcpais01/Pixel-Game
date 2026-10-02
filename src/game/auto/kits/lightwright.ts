// The Lightwright's effects on the board: the focus beam seared from his
// lens, the prism hanging over the crowd sweeping spectrum beams round it,
// and the Burning Mirror's heat ray scorching a line through them. The
// spectrum keeps its own colours (a violet-blue one for the Stargazer);
// everything else takes the palette, so the skin recolours it.

import { bump, CHEST, clamp01, dither, dot, easeOut, FLAT, hash, impact, lerp, line, pool, ring, shadowOf, star, stroke, tail, type Cast, type Kit, type Pal, type Pt, type Stage } from '../paint';
import { gather, HAND, scorch } from './common';

const SUN_SPECTRUM = [0xff4a4a, 0xff9a3a, 0xffe85a, 0x5ae86a, 0x4aa8ff, 0x9a6aff];
const STAR_SPECTRUM = [0x5ae0ff, 0x4aa0ff, 0x5a6aff, 0x8a5aff, 0xc45aff, 0xff6ad8];
const spectrumOf = (look: string): number[] => (look === 'stargazer' ? STAR_SPECTRUM : SUN_SPECTRUM);
const BRASS = [0xfff0b0, 0xdcae4a, 0xa8742a, 0x6a4418];
const SILVER = [0xf4f6ff, 0xc4cadf, 0x858ca8, 0x4b5068];

/** The focus beam: a line of sunlight from the lens to the foe, there at once, thinning as it goes. */
function focusShot(s: Stage, a: Pt, b: Pt, _dur: number, p: Pal): void {
  const x0 = a.x + Math.sign(b.x - a.x) * 6;
  const y0 = a.y - HAND + 1;
  const x1 = b.x;
  const y1 = b.y - CHEST;
  s.add(0.16, (L, k) => {
    if (k < 0.45) stroke(L.air, x0, y0, x1, y1, 1, p, 1);
    else line(L.air, x0, y0, x1, y1, p.hot, 1 - k);
    star(L.air, x0, y0, k < 0.5 ? 2 : 1, p, 1 - k);
    star(L.air, x1, y1, 3, p, 1 - k);
    L.light(x1, y1, 22, p.light, 0.9 * (1 - k));
    L.light(x0, y0, 12, p.light, 0.6 * (1 - k));
  });
  s.sparks(b.x, b.y, 4, p.tints, { speed: 26, up: 18, z: CHEST, life: 0.3 });
}

/** The crystal itself, a little triangle of glass, its lit side white. */
function crystal(L: { air: { put(x: number, y: number, c: number, a?: number): void } }, x: number, y: number, t: number, p: Pal, sp: number[], a = 1): void {
  const ridge = Math.sin(t * 6) * 0.8;
  for (let j = 0; j < 7; j++) {
    const w = (j / 6) * 3;
    for (let i = -Math.ceil(w); i <= Math.ceil(w); i++) {
      const left = i < ridge * w;
      dot(L.air, x + i, y - 6 + j, Math.abs(i - ridge * w) < 0.5 ? sp[(j + Math.floor(t * 10)) % sp.length] : left ? p.core : 0x8eb0d8, a);
    }
  }
}

/** The prism: lobbed over the crowd, it hangs there and sweeps three spectrum beams round, then shatters. */
const prism = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const sp = spectrumOf(c.look);
    const a = c.from;
    const b = c.at;
    s.add(c.lead, (L, k, t) => {
      const f = easeOut(k);
      const x = lerp(a.x, b.x, f);
      const y = lerp(a.y, b.y, f) - HAND - Math.sin(f * Math.PI) * 20 + f * (HAND - 10);
      crystal(L, x, y + 3, t, p, sp);
      shadowOf(L.ground, lerp(a.x, b.x, f), lerp(a.y, b.y, f), 3, f);
      L.light(x, y, 16, p.light, 0.6);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const sp = spectrumOf(c.look);
    const R = Math.max(16, c.r);
    const { x, y } = c.at;
    const top = y - 10;
    const life = 1.2;
    s.add(life, (L, k, t) => {
      const open = clamp01(k / 0.15) * tail(k, 0.85);
      const rot = t * 3.2;
      for (let b = 0; b < 3; b++) {
        const th = rot + (b / 3) * Math.PI * 2;
        const ca = Math.cos(th);
        const sa = Math.sin(th);
        const len = R * open;
        for (let i = 2; i <= len; i++) {
          const f = i / R;
          const half = 0.5 + f * 2;
          sp.forEach((col, j) => {
            const off = ((j + 0.5) / sp.length - 0.5) * 2 * half;
            dot(L.air, x + ca * i - sa * off, top + sa * i * FLAT + ca * off * FLAT + f * 8, f < 0.15 ? p.core : col, f > 0.85 ? 0.6 : 1);
          });
        }
      }
      crystal(L, x, top + 3, t, p, sp);
      L.light(x, top, R * 2, sp[Math.floor(t * 6) % sp.length], 0.8 * open);
    });
    // It shatters: glints thrown out in a ring.
    s.add(0.4, (L, k) => {
      for (let i = 0; i < 14; i++) {
        const th = (i / 14) * Math.PI * 2 + hash(i, 3) * 0.3;
        const r = R * 0.8 * easeOut(k) * (0.7 + 0.3 * hash(i, 7));
        dot(L.air, x + Math.cos(th) * r, top + Math.sin(th) * r * FLAT + k * k * 8, i % 3 ? sp[i % sp.length] : p.core, 1 - k);
      }
      ring(L.ground, x, y, R * 0.8 * easeOut(k), 1, p, 1 - k);
      L.light(x, top, 50, p.light, 1 - k);
    }, life);
    for (const h of c.hits) impact(s, h, p, 0.6);
  },
};

/** The dish behind him: a bowl of metal facing the way the beam goes, its face bright with gathered sun. */
function dish(L: { air: { put(x: number, y: number, c: number, a?: number): void } }, x: number, y: number, dir: number, R: number, p: Pal, metal: number[], lit: number, a: number): void {
  const px = 0;
  const bx = -dir;
  for (let j = -R; j <= R; j++) {
    for (let i = -R; i <= R; i++) {
      const d2 = (i * i + j * j) / (R * R);
      if (d2 > 1) continue;
      const xx = x + (i / R) * R * 0.35 + px + (1 - d2) * 2 * bx;
      const yy = y + j;
      const rim = d2 > 0.75;
      const c = rim ? metal[2] : lit > 0 && d2 < 0.3 * lit ? p.core : d2 < 0.5 ? metal[0] : metal[1];
      dot(L.air, xx, yy, c, a);
    }
  }
}

/** The Burning Mirror: the dish unfolds behind him, the sun pours in, and a heat ray scorches a line through the foes. */
const burningMirror = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const metal = c.look === 'stargazer' ? SILVER : BRASS;
    const dir = Math.sign(c.at.x - c.from.x) || 1;
    gather(s, c.from, p, c.lead, 1.2);
    s.add(c.lead, (L, k) => {
      const R = Math.max(1, Math.round(8 * easeOut(k)));
      const mx = c.from.x - dir * 7;
      line(L.air, mx, c.from.y - 2, mx, c.from.y - 18, metal[3], 1);
      dish(L, mx, c.from.y - 22, dir, R, p, metal, 0, 1);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const metal = c.look === 'stargazer' ? SILVER : BRASS;
    const dir = Math.sign(c.at.x - c.from.x) || 1;
    const mx = c.from.x - dir * 7;
    const my = c.from.y - 22;
    const end = c.at;
    const life = 1.1;
    s.add(life, (L, k, t) => {
      const a = tail(k, 0.8);
      line(L.air, mx, c.from.y - 2, mx, c.from.y - 18, metal[3], a);
      dish(L, mx, my, dir, 8, p, metal, 1, a);
      // The shaft of sun into the dish.
      for (let i = 2; i < 26; i++) if (dither(mx, my - i) < (1 - i / 26) * a) dot(L.air, mx + (i % 3) - 1, my - 8 - i, i < 10 ? p.core : p.hot, 0.8);
      // The ray: wide at the dish, a point where it meets the ground, sweeping a little as it burns.
      const sweep = Math.sin(t * 5) * 4;
      const fx = end.x;
      const fy = end.y + sweep * 0.5;
      const len = Math.hypot(fx - mx, fy - my);
      const n = Math.ceil(len);
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const half = 3.5 * (1 - f) + 0.5;
        const cx = lerp(mx, fx, f);
        const cy = lerp(my, fy, f);
        for (let o = -half; o <= half; o += 0.6) dot(L.air, cx, cy + o, Math.abs(o) < half * 0.35 ? p.core : Math.abs(o) < half * 0.7 ? p.hot : p.mid, a);
      }
      pool(L.ground, fx, fy, 7 + bump(k) * 3, p.hot, p.mid, a * 0.7);
      star(L.air, fx, fy - 1, 3, p, a);
      L.light(fx, fy, 40, p.light, a);
      L.light(mx, my, 30, p.light, 0.7 * a);
    });
    // The ground it crossed, scorched.
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      scorch(s, { x: lerp(c.from.x, end.x, f), y: lerp(c.from.y, end.y, f) }, 4 + f * 2, 1.6, p.mid);
    }
    s.shake(140, 0.003, end);
    for (const h of c.hits) impact(s, h, p, 0.8);
  },
};

export const LIGHTWRIGHT_KITS: Record<string, Kit> = {
  'lightwright.lightwright': { shot: focusShot, skill: prism, ult: burningMirror },
};
