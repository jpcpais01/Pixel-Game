// The Juggernaut's effects on the board: piston fists that crack the air
// (the slam with a blast of steam out of the housing and a ring on the
// ground), the Steam rush that barrels through to its foe trailing steam and
// tearing up the ground, and Meltdown: the furnace bursting open, a wreath
// of scalding steam boiling round it, then the great vent rolling out. Steam
// and dust keep their own colours; everything that glows takes the palette,
// so the Tin Man's burns rose, and he scatters little hearts.

import {
  angle,
  CHEST,
  circle,
  dist,
  dither,
  easeIn,
  easeOut,
  FLAT,
  hash,
  lerp,
  line,
  orb,
  pool,
  ring,
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
import { smoke } from './common';

const STEAM = [0xffffff, 0xe6ecf2, 0xc0cad6, 0x8a96a6];
const DUST = [0xb8a888, 0x8a7a60, 0x6a5e4a];
const HEART = ['.h.h.', 'hHhhh', '.hhh.', '..h..'];

const tinOf = (c: { look: string }): boolean => c.look === 'tinman';

/** A soft round puff of steam, lit on top, the fire's colour at its underside. */
function puff(px: Px, x: number, y: number, r: number, a: number, under: number): void {
  if (r <= 0 || a <= 0) return;
  for (let dy = -Math.ceil(r); dy <= r; dy++)
    for (let dx = -Math.ceil(r); dx <= r; dx++) {
      const d = Math.hypot(dx, dy * 1.15) / r;
      if (d > 1) continue;
      const X = Math.round(x + dx);
      const Y = Math.round(y + dy);
      if (dither(X, Y) >= a * (1 - d * d)) continue;
      px.put(X, Y, dy < -r * 0.35 ? STEAM[0] : dy > r * 0.45 ? under : d < 0.6 ? STEAM[1] : STEAM[2], 1);
    }
}

function heart(px: Px, x: number, y: number, p: Pal, a = 1): void {
  sprite(px, x, y, HEART, { h: p.mid, H: p.core }, a, { ax: 0.5, ay: 0.5 });
}

/** A fist landing: the air cracks off the knuckles; the slam (`heavy`) fires its piston with steam bursting out behind, and rings the ground. */
function pistonBlow(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const th = angle(from, at);
  const foe = { x: at.x, y: at.y - CHEST };
  const back = { x: lerp(from.x, at.x, 0.3), y: lerp(from.y, at.y, 0.3) - CHEST };
  const dur = heavy ? 0.32 : 0.2;
  s.add(dur, (L, k) => {
    // The crack: a short star and a crescent of air in front of the fist.
    star(L.air, foe.x, foe.y, heavy ? (k < 0.35 ? 4 : 2) : k < 0.4 ? 3 : 1, p, 1 - k * 0.5);
    const r = (heavy ? 4 : 3) + (heavy ? 7 : 4) * easeOut(k);
    for (let i = -4; i <= 4; i++) {
      const a = th + i * 0.18;
      L.air.put(Math.round(foe.x + Math.cos(a) * r), Math.round(foe.y + Math.sin(a) * r * 0.8), Math.abs(i) < 2 ? p.core : p.hot, 1 - k);
    }
    L.light(foe.x, foe.y, heavy ? 30 : 16, p.light, 0.9 * (1 - k));
    if (heavy) {
      ring(L.ground, at.x, at.y, 3 + 10 * easeOut(k), 1.2, p, 1 - k);
      // Steam blasting out of the piston's housing, either side of the arm.
      for (const side of [-1, 1]) {
        const nx = -Math.sin(th) * side;
        const ny = Math.cos(th) * side;
        puff(L.air, back.x + nx * (3 + 6 * k) - Math.cos(th) * 3 * k, back.y + ny * (2 + 4 * k) - 3 * k, 1.5 + 2 * k, 1 - k, p.deep);
      }
    }
  });
  s.sparks(at.x, at.y, heavy ? 8 : 4, [p.core, p.hot, 0xffffff], { speed: heavy ? 34 : 24, up: 22, life: 0.3, z: CHEST, dir: th, cone: 0.9 });
  if (heavy) {
    s.shake(90, 0.003, at);
    // A blow carries no look, so the Tin Man is known by his rose palette.
    if (p.mid === 0xff5a7a) s.add(0.6, (L, k) => heart(L.air, foe.x + 3, foe.y - 6 - k * 10, p, tail(k, 0.5)));
  }
}

/** Steam rush: the boilers open in a burst behind it, then it barrels through to its foe, steam streaming back, and lands a double shove. */
const rushMove = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    s.add(c.lead, (L, k) => {
      // Pressure building: steam hissing out of its back.
      for (let i = 0; i < 3; i++) puff(L.air, c.from.x - Math.cos(th) * (6 + i * 3 + k * 4), c.from.y - 12 - i * 2 - k * 3, 1.2 + i * 0.5, k * (1 - i * 0.25), p.deep);
      L.light(c.from.x, c.from.y - CHEST, 20, p.light, 0.5 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    const len = dist(c.from, c.at);
    const seed = Math.random() * 100;
    s.add(0.55, (L, k) => {
      // The steam it left behind it along the way, thinning out.
      const n = Math.max(3, Math.round(len / 6));
      for (let i = 0; i < n; i++) {
        const u = i / n;
        const x = lerp(c.from.x, c.at.x, u) + (hash(i, seed) - 0.5) * 4;
        const y = lerp(c.from.y, c.at.y, u);
        puff(L.air, x, y - 10 - k * 6 - hash(i, seed, 1) * 4, 1.6 + k * 2.2 + u, (1 - k) * (0.4 + u * 0.6), p.deep);
        if (i % 2 === 0) L.ground.put(Math.round(x), Math.round(y + 1), DUST[1], 1 - k);
      }
      // Ground torn up under its boots, and speed lines.
      for (const side of [-2, 2]) line(L.ground, c.from.x, c.from.y + side * FLAT, c.at.x - Math.cos(th) * 6, c.at.y + side * FLAT, DUST[2], (1 - k) * 0.8);
      if (k < 0.4) {
        star(L.air, c.at.x, c.at.y - CHEST, 3, p, 1);
        ring(L.ground, c.at.x, c.at.y, 4 + 12 * easeOut(k / 0.4), 1.5, p, 1 - k / 0.4);
      }
      L.light(c.at.x, c.at.y - CHEST, 34, p.light, 1 - k);
    });
    s.sparks(c.at.x, c.at.y, 10, [...DUST, 0xffffff], { speed: 34, up: 20, life: 0.45, ground: true, dir: th, cone: 0.8 });
    s.sparks(c.at.x, c.at.y, 8, [p.core, p.hot, p.mid], { speed: 40, up: 30, life: 0.4, z: CHEST, dir: th, cone: 0.6 });
    s.shake(110, 0.004, c.at);
    if (tinOf(c)) s.add(0.6, (L, k) => heart(L.air, c.at.x, c.at.y - CHEST - 6 - k * 10, p, tail(k, 0.5)));
  },
};

/** Meltdown: the furnace bursts open and it glows red, steam boiling round it; then the great vent rolls out, scalding all round. */
const meltdownMove = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const at = c.from;
    s.add(c.lead, (L, k, t) => {
      // The furnace roaring brighter in its chest, embers spitting, steam gathering round its feet.
      orb(L.air, at.x, at.y - CHEST, 1.5 + 2.5 * easeIn(k), p, 0.9);
      pool(L.ground, at.x, at.y, 10 + 6 * k, p.mid, p.deep, k * 0.6);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t * 2;
        puff(L.air, at.x + Math.cos(a) * 11, at.y - 4 + Math.sin(a) * 11 * FLAT - k * 3, 1.5 + k, k, p.deep);
      }
      L.light(at.x, at.y - CHEST, 30 + 30 * k, p.light, 0.5 + 0.5 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const at = c.from;
    const R = Math.max(c.r, 20);
    const tin = tinOf(c);
    s.add(0.7, (L, k) => {
      ring(L.ground, at.x, at.y, 6 + R * easeOut(k), 2.2 * (1 - k) + 0.6, p, 1 - k * k);
      circle(L.ground, at.x, at.y, R * 0.6 * easeOut(k), p.hot, (1 - k) * 0.7);
      // Steam rolling out with the front.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + hash(i, 4) * 0.4;
        const rr = (6 + R * easeOut(k)) * (0.85 + hash(i, 7) * 0.2);
        puff(L.air, at.x + Math.cos(a) * rr, at.y + Math.sin(a) * rr * FLAT - 4 - k * 6, 2 + k * 2.4, 1 - k, p.mid);
        if (tin && i % 3 === 0) heart(L.air, at.x + Math.cos(a) * rr * 0.7, at.y + Math.sin(a) * rr * FLAT * 0.7 - 12 - k * 10, p, 1 - k);
      }
      if (k < 0.25) orb(L.air, at.x, at.y - CHEST, 6 * (1 - k * 4) + 2, p, 1);
      L.light(at.x, at.y - CHEST, 50 + R, p.light, 1 - k);
    });
    smoke(s, at, 5, STEAM[2], 3.2, 1, 10);
    s.sparks(at.x, at.y, 18, [p.core, p.hot, p.mid, p.deep], { speed: 46, up: 40, g: 110, life: 0.6, z: CHEST });
    s.sparks(at.x, at.y, 12, STEAM, { speed: 30, up: 16, g: -10, life: 0.8, z: 6 });
    s.shake(220, 0.006, at);
  },
};

export const JUGG_AUTO: Record<string, Kit> = {
  'automaton.juggernaut': { melee: pistonBlow, skill: rushMove, ult: meltdownMove },
};
