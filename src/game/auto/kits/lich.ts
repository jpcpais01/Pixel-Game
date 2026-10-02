// The Lich's effects on the board: rime bolts of bone-ice, a line of bone
// spikes bursting up along the aim, and Eternal Winter, a blizzard whirling
// round him that locks his foes in ice and shatters them. The Drowned King
// draws the same in his own colours, the spikes in coral.

import { CHEST, circle, clamp01, dither, dot, easeOut, FLAT, hash, impact, line, orb, pool, ring, star, tail, type Kit, type Move, type Pal, type Pt, type Px, type Stage } from '../paint';
import { flight, gather, HAND } from './common';

const later = (s: Stage, wait: number, f: () => void): void => s.add(0.01, () => {}, Math.max(0, wait), f);

/** A long diamond of ice from `back` to `tip`, lit along one edge, its tail banded with bone. */
function shard(px: Px, bx: number, by: number, tx: number, ty: number, p: Pal, a = 1): void {
  const len = Math.max(1, Math.hypot(tx - bx, ty - by));
  const ux = (tx - bx) / len;
  const uy = (ty - by) / len;
  for (let s = 0; s <= len; s += 0.5) {
    const u = s / len;
    const w = u > 0.7 ? (1 - u) * 4 : 0.5 + u * 1.2;
    for (let o = -w; o <= w + 0.01; o += 0.5) {
      const col = o < -0.4 ? p.hot : o > 0.4 ? p.deep : u > 0.75 ? p.core : u < 0.4 ? 0xe8e2cc : p.mid;
      dot(px, bx + ux * s - uy * o, by + uy * s + ux * o, col, a);
    }
  }
}

/** The rime bolt: a shard of bone-ice spinning frost off its tail, bursting in a star of frost. */
function rimeShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 1);
  s.add(dur, (L, k) => {
    const q = pos(k);
    const r = pos(Math.max(0, k - 0.12));
    shard(L.air, r.x, r.y, q.x, q.y, p);
    if (Math.random() < 0.4) s.sparks(r.x, r.y + CHEST, 1, [p.hot, p.mid], { speed: 3, up: 0, g: 40, life: 0.3, z: CHEST });
    L.light(q.x, q.y, 14, p.light, 0.5);
  }, 0, () => {
    impact(s, b, p, 0.7);
    s.sparks(b.x, b.y, 6, [p.core, p.hot, 0xe8e2cc], { speed: 30, up: 20, g: 140, life: 0.4, z: CHEST });
    frostStar(s, b, p, 0.8);
  });
}

/** A star of frost flashing over a body. */
function frostStar(s: Stage, at: Pt, p: Pal, size = 1): void {
  s.add(0.25, (L, k) => {
    const r = (3 + 6 * easeOut(k)) * size;
    for (let i = 0; i < 8; i++) {
      const th = (i / 8) * Math.PI * 2 + 0.2;
      const len = i % 2 ? r * 0.55 : r;
      for (let d = 1; d <= len; d++) {
        const x = at.x + Math.cos(th) * d;
        const y = at.y - CHEST + Math.sin(th) * d * 0.85;
        if (dither(x, y) > (1 - k) * (1.2 - d / (len + 1))) continue;
        dot(L.air, x, y, d < len * 0.4 ? p.core : d < len * 0.75 ? p.hot : p.mid);
      }
    }
  });
}

/** One jagged spike of ice (coral) `h` tall standing at (x, y), banded with bone, sinking as `gone` runs to 1. */
function spike(px: Px, x: number, y: number, h: number, p: Pal, gone: number, coral: boolean): void {
  const drop = gone * 5;
  const a = 1 - gone * 0.7;
  for (let k = 0; k < h; k++) {
    const u = k / h;
    const w = (1 - u) * 2;
    for (let o = -w; o <= w + 0.01; o += 0.5) {
      let col = o < -w * 0.35 ? p.core : o > w * 0.35 ? p.deep : u > 0.8 ? p.core : p.mid;
      if (Math.abs(u - 0.3) < 0.08) col = o <= 0 ? (coral ? p.hot : 0xeee8d4) : coral ? p.mid : 0xa8a290;
      dot(px, x + o, y - k + drop, col, a);
    }
    if (coral && (k === Math.round(h * 0.55) || k === Math.round(h * 0.75))) {
      const sd = k === Math.round(h * 0.55) ? -1 : 1;
      for (let j = 1; j <= 2; j++) dot(px, x + sd * (w + j), y - k - j + drop, p.hot, a);
    }
  }
}

/** Bone spikes: frost gathers in his hand, then spikes burst up one after another along the line to the far end, and shatter. */
const boneSpikes: Move = {
  cast(s, c) {
    gather(s, c.from, c.pal, c.lead, 0.7);
  },
  hit(s, c) {
    const p = c.pal;
    const coral = c.look === 'drowned';
    const from = c.from;
    const to = c.at;
    const n = Math.max(3, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 11));
    for (let i = 0; i < n; i++) {
      const u = (i + 1) / n;
      const x = from.x + (to.x - from.x) * u + (hash(i, 3) - 0.5) * 3;
      const y = from.y + (to.y - from.y) * u + (hash(i, 4) - 0.5) * 2;
      const h = 9 + Math.min(1, i / 2) * 4 + hash(i, 5) * 2;
      const seed = hash(i, 9) * 10;
      s.add(0.85, (L, k) => {
        const grow = Math.min(1.1, easeOut(k / 0.1) * 1.1);
        const gone = clamp01((k - 0.75) / 0.25);
        // Cracked ground and a patch of frost.
        for (let j = 0; j < 5; j++) {
          const th = (j / 5) * Math.PI * 2 + seed;
          line(L.ground, x, y, x + Math.cos(th) * 5, y + Math.sin(th) * 5 * FLAT, p.deep, 1 - gone);
        }
        pool(L.ground, x, y, 6, p.hot, p.mid, 0.6 * (1 - gone), 0.7);
        spike(L.air, x - 3, y, h * 0.45 * grow, p, gone, coral);
        spike(L.air, x + 3, y, h * 0.4 * grow, p, gone, coral);
        spike(L.air, x, y, h * grow, p, gone, coral);
        if (k < 0.3) L.light(x, y - 6, 22, p.light, 0.7 * (1 - k / 0.3));
      }, i * 0.05, () => s.sparks(x, y, 6, [p.core, p.hot, p.mid], { speed: 20, up: 26, g: 160, life: 0.4, z: 6 }));
      later(s, i * 0.05, () => s.sparks(x, y, 4, [p.deep, p.mid], { speed: 18, up: 30, g: 180, life: 0.35, z: 1 }));
    }
    s.shake(90, 0.6, to);
    c.hits.forEach((h, i) => later(s, 0.05 + i * 0.04, () => frostStar(s, h, p, 0.9)));
  },
};

/** A foe locked in ice: crystals standing round it, glinting; then they burst. */
function iceLock(s: Stage, at: Pt, p: Pal, dur: number, wait: number): void {
  s.add(dur, (L, k) => {
    const grow = easeOut(k / 0.15);
    for (const [ox, h, lean] of [[-5, 12, -0.2], [-2, 16, -0.05], [2, 15, 0.08], [5, 11, 0.22]] as const) {
      const H = h * grow;
      for (let j = 0; j < H; j++) {
        const u = j / H;
        const w = u < 0.7 ? 0.7 + u * 0.6 : (1 - u) * 4;
        for (let o = -w; o <= w + 0.01; o += 0.5) dot(L.air, at.x + ox + lean * j + o, at.y - j, o < -0.3 ? p.core : o > 0.3 ? p.mid : p.hot, 0.85);
      }
    }
    if (Math.floor(k * 12) % 3 === 0) star(L.air, at.x - 2, at.y - 12, 2, p, 1);
  }, wait, () => {
    s.sparks(at.x, at.y, 14, p.tints, { speed: 34, up: 30, g: 150, life: 0.5, z: 8 });
    impact(s, at, p, 1);
  });
}

/** Eternal Winter: a blizzard whirling round him, frost spreading under it; his foes are locked in ice, then shattered. */
const eternalWinter: Move = {
  cast(s, c) {
    gather(s, c.from, c.pal, c.lead, 1.2);
    s.add(c.lead, (L, k) => orb(L.air, c.from.x, c.from.y - HAND - 14, 1 + 2 * k, c.pal));
  },
  hit(s, c) {
    const p = c.pal;
    const R = Math.max(30, c.r);
    const { x, y } = c.from;
    const life = 1.6;
    const seed = Math.random() * 100;
    s.add(life, (L, k, t) => {
      const a = tail(k, 0.8);
      const r = R * easeOut(Math.min(1, k * 3));
      pool(L.ground, x, y, r, p.hot, p.mid, 0.5 * a, 0.45);
      circle(L.ground, x, y, r, p.hot, a);
      for (let i = 0; i < 46; i++) {
        const rim = i % 5 < 3;
        const rr = r * (rim ? 0.8 + hash(i, seed) * 0.22 : 0.25 + hash(i, seed) * 0.55);
        const th = hash(i, seed, 1) * Math.PI * 2 + t * (rim ? 4 : 2.6);
        const z = 2 + hash(i, seed, 2) * 22;
        const fx = x + Math.cos(th) * rr;
        const fy = y + Math.sin(th) * rr * FLAT - z;
        dot(L.air, fx, fy, Math.sin(th) > 0 ? p.core : p.hot, a);
        for (let j = 1; j <= 2; j++) {
          const b = th - j * 0.12;
          dot(L.air, x + Math.cos(b) * rr, y + Math.sin(b) * rr * FLAT - z, j === 1 ? p.mid : p.deep, a * 0.8);
        }
      }
      L.light(x, y - 12, r * 2, p.light, 0.5 * a);
    });
    c.hits.forEach((h, i) => iceLock(s, h, p, 0.45, 0.9 + i * 0.02));
    later(s, 1.35, () => {
      s.shake(160, 1.2, c.from);
      s.add(0.4, (L, k) => ring(L.ground, x, y, R * (0.5 + 0.6 * easeOut(k)), 2, p, 1 - k));
    });
  },
};

export const LICH_KITS: Record<string, Kit> = {
  'necromancer.lich': { shot: rimeShot, skill: boneSpikes, ult: eternalWinter },
};
