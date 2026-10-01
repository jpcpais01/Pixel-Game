// Moments many heroes share, drawn with ../paint.ts: gathering power in the
// hand, a rune under the feet, scorches, smoke, splashes, a missile's trail.

import { bump, CHEST, circle, clamp01, dark, disc, dither, dot, easeOut, FLAT, hash, impact, line, orb, pool, ring, rune, star, type Layers, type Pal, type Pt, type Stage } from '../paint';

/** Where a hero's hands are, about: a little up its body. */
export const HAND = 14;

/** Power gathering at the caster's hand over `dur`: motes drawn in from round it and a swelling glow. */
export function gather(s: Stage, at: Pt, p: Pal, dur: number, size = 1): void {
  const seed = Math.random() * 1000;
  s.add(dur, (L, k, t) => {
    const hx = at.x;
    const hy = at.y - HAND;
    const n = Math.round(6 + 4 * size);
    for (let i = 0; i < n; i++) {
      const life = (k * 2.2 + hash(i, seed) ) % 1;
      const th = hash(i, seed, 1) * Math.PI * 2 + t * 2;
      const d = (1 - easeOut(life)) * (10 + 8 * size);
      const x = hx + Math.cos(th) * d;
      const y = hy + Math.sin(th) * d * 0.8;
      dot(L.air, x, y, life > 0.7 ? p.core : p.hot, 1);
      if (life < 0.6) dot(L.air, x + Math.cos(th) * 1.5, y + Math.sin(th) * 1.2, p.mid, 1);
    }
    const r = (1.2 + 2 * size) * easeOut(k);
    orb(L.air, hx, hy, r, p, 1);
    L.light(hx, hy, 16 + 20 * size * k, p.light, 0.55 * k);
  });
}

/** A turning rune under the caster's feet while it casts. */
export function castRune(s: Stage, at: Pt, p: Pal, dur: number, r = 10): void {
  s.add(dur, (L, k, t) => {
    const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    rune(L.ground, at.x, at.y, r * easeOut(Math.min(1, k * 4)), t * 2.2, p, a);
  });
}

/** A burnt patch left on the ground, fading over `dur`. */
export function scorch(s: Stage, at: Pt, r: number, dur = 1.4, ember = 0xff7a2a): void {
  const seed = Math.random() * 100;
  s.add(dur, (L, k) => {
    const a = 1 - k;
    pool(L.ground, at.x, at.y, r, 0x1a0e10, 0x2e1a18, a, 0.75);
    // A few embers still glowing in it.
    for (let i = 0; i < 5; i++) {
      if (hash(i, seed, Math.floor(k * 10)) > a) continue;
      const th = hash(i, seed) * Math.PI * 2;
      const d = hash(i, seed, 2) * r * 0.7;
      dot(L.ground, at.x + Math.cos(th) * d, at.y + Math.sin(th) * d * FLAT, ember, 1);
    }
  });
}

/** A puff of smoke rising and spreading from (x, y), a few small dithered clouds. */
export function smoke(s: Stage, at: Pt, n: number, col = 0x5a5068, size = 3, dur = 0.9, h = 4): void {
  for (let i = 0; i < n; i++) {
    const ox = (Math.random() - 0.5) * size * 4;
    const oy = (Math.random() - 0.5) * size * 1.5;
    const drift = (Math.random() - 0.5) * 8;
    const up = 10 + Math.random() * 12;
    const w = Math.random() * 0.15;
    s.add(dur * (0.7 + Math.random() * 0.5), (L, k) => {
      const r = size * (0.6 + easeOut(k) * 0.9);
      disc(L.air, at.x + ox + drift * k, at.y - h + oy - up * easeOut(k), r, r * 0.85, k < 0.5 ? col : dark(col, 0.15), (1 - k) * 0.9);
    }, w);
  }
}

/** A splash of droplets thrown up from (x, y). */
export function splash(s: Stage, at: Pt, p: Pal, n: number, speed = 26, h = 4): void {
  s.sparks(at.x, at.y, n, [p.core, p.hot, p.mid, p.hot], { speed, up: 40, g: 160, life: 0.55, z: h });
}

/** A short line of fading points behind a missile: `pos(k)` gives where it was at k. */
export function trail(L: Layers, pos: (k: number) => Pt, k: number, n: number, gap: number, cols: number[]): void {
  for (let i = n; i >= 1; i--) {
    const q = pos(Math.max(0, k - i * gap));
    const c = cols[Math.min(cols.length - 1, Math.floor(((i - 1) / n) * cols.length))];
    if (dither(q.x + i, q.y) < 1 - i / (n + 1)) dot(L.air, q.x, q.y, c, 1);
  }
}

/** A missile's place at k on its way from a to b, at chest height, with an arc `lob` px high. */
export function flight(a: Pt, b: Pt, lob = 2, h = CHEST): (k: number) => Pt {
  return (k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - h - Math.sin(clamp01(k) * Math.PI) * lob });
}

/** Strike sparks and a small flash on a foe: the generic landing of a blow or missile. */
export function hitFlash(s: Stage, at: Pt, p: Pal, size = 1): void {
  impact(s, at, p, size);
}

/** A soft rising column of motes over a spot (a heal, a blessing). */
export function motes(s: Stage, at: Pt, cols: number[], n = 6, spread = 10): void {
  s.sparks(at.x, at.y, n, cols, { speed: 6, up: 26, g: -12, life: 0.7, spread, z: 2 });
}

/** A ring of light on the ground that rolls out from `at` to `R`, `w` thick. */
export function wave(s: Stage, at: Pt, R: number, p: Pal, dur = 0.45, w = 2, wait = 0): void {
  s.add(
    dur,
    (L, k) => {
      ring(L.ground, at.x, at.y, Math.max(2, R * easeOut(k)), w, p, 1 - k * k);
      L.light(at.x, at.y - 4, R * 1.6, p.light, 0.5 * (1 - k));
    },
    wait,
  );
}

/** A plus sign of light (a heal) rising over a spot. */
export function plus(s: Stage, at: Pt, c: number, wait = 0): void {
  s.add(
    0.7,
    (L, k) => {
      const y = at.y - 26 - k * 8;
      const a = 1 - k * k;
      line(L.air, at.x, y - 2, at.x, y + 2, c, a);
      line(L.air, at.x - 2, y, at.x + 2, y, c, a);
      dot(L.air, at.x, y, 0xffffff, a);
    },
    wait,
  );
}

/** A circle of light round a hero's middle that pulses and fades (a barrier). */
export function barrier(s: Stage, at: Pt, p: Pal, dur = 0.8): void {
  s.add(dur, (L, k, t) => {
    const a = bump(k);
    circle(L.air, at.x, at.y - 11, 10, p.hot, a, 1.25, Math.PI * 0.95 + t, Math.PI * 2.05 + t);
    circle(L.ground, at.x, at.y, 9, p.mid, a, FLAT);
    if (k < 0.3) star(L.air, at.x + 7, at.y - 18, 2, p, 1);
  });
}
