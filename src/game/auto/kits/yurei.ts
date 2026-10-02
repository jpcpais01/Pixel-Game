// The Yurei's effects on the board: her talismans fluttering to a foe, sticking
// and bursting into spirit-fire; Grasping hair, a river of hair poured along
// the ground into a pool that wraps whoever stands in it; and Hundred Candles,
// a ring of candles snuffed one by one, each sending a hitodama at a foe,
// until they all flare at once. Yuki-onna's paper is frost-blue, her hair
// silver, her candles ice.

import { CHEST, clamp01, column, dither, dot, easeOut, FLAT, hash, impact, lerp, ring, stroke, tail, type Kit, type Layers, type Move, type Pal, type Pt, type Px, type Stage } from '../paint';
import { flight, gather } from './common';

/** Paper and ink for the talismans, by look. */
const PAPER = { base: [0xf4ecd4, 0xc8b890, 0xc8302a, 0x22222a], yuki: [0xe4f4ff, 0xa8cae6, 0x8ad0fa, 0x1e4a8a] };
/** Hair on the ground: body, strand, sheen. */
const HAIR = { base: [0x07080f, 0x1c2030, 0x46507a], yuki: [0x26304e, 0x5e7298, 0xc0d2ee] };

const isYuki = (look: string): boolean => look === 'yuki';

/** A talisman slip `th` radians along its flight, its width turning as it flutters. */
function slip(px: Px, x: number, y: number, th: number, flutter: number, cols: number[], a = 1): void {
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  const w = Math.abs(Math.cos(flutter)) > 0.4 ? 1 : 0;
  for (let i = -2; i <= 2; i++) {
    const cx = x + ux * i;
    const cy = y + uy * i;
    const c = i === 2 ? cols[2] : i === 0 ? cols[3] : cols[0];
    dot(px, cx, cy, c, a);
    if (w) dot(px, cx - uy, cy + ux, i === 2 ? cols[2] : cols[1], a);
  }
}

/** Spirit-fire standing on a spot for `dur`: a licking column, its tongues breaking off. */
function spiritFire(s: Stage, at: Pt, p: Pal, size: number, dur = 0.45, wait = 0): void {
  s.add(
    dur,
    (L, k, t) => {
      const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      column(L.air, at.x, at.y - CHEST + 6, (10 + 12 * size) * (0.6 + 0.4 * easeOut(k * 3)), 2 + size, p, a, t * 60);
      if (size > 1) ring(L.ground, at.x, at.y, 14 * easeOut(k * 1.5), 1, p, a);
      L.light(at.x, at.y - CHEST, 18 + 14 * size, p.light, 0.8 * a);
    },
    wait,
  );
  s.sparks(at.x, at.y, Math.round(4 + 4 * size), [0xffffff, p.core, p.hot, p.mid], { speed: 14, up: 34, g: -10, life: 0.5, z: CHEST, spread: 3 });
}

/** Ofuda: a slip fluttering out to the foe, sticking a beat, then bursting into spirit-fire. */
function ofudaShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  // A shot isn't told the look: Yuki-onna's palette is the one with a pure white heart.
  const cols = p.core === 0xffffff ? PAPER.yuki : PAPER.base;
  const pos = flight(a, b, 3);
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    const r = pos(Math.max(0, k - 0.05));
    const th = Math.atan2(q.y - r.y, q.x - r.x);
    for (let i = 5; i >= 1; i--) {
      const z = pos(Math.max(0, k - i * 0.04));
      if (dither(z.x, z.y) < 0.8 - i / 7) dot(L.air, z.x, z.y, i < 3 ? p.hot : p.mid, 1);
    }
    slip(L.air, q.x, q.y, th, t * 18, cols);
    L.light(q.x, q.y, 12, p.light, 0.4);
  }, 0, () => {
    // Stuck to the foe, smouldering, then up it goes.
    s.add(0.3, (L, k, t) => {
      slip(L.air, b.x + 2, b.y - CHEST, -Math.PI / 2 + 0.2, 0, cols);
      L.light(b.x, b.y - CHEST, 10, p.light, 0.3 + 0.4 * Math.abs(Math.sin(t * (20 + k * 30))));
    }, 0, () => spiritFire(s, b, p, 0.8));
    s.sparks(b.x, b.y, 3, [0xffffff, p.hot], { speed: 14, up: 10, life: 0.25, z: CHEST });
  });
}

/** The river of hair from her feet out to the spot, `out` of it poured. */
function river(px: Px, from: Pt, to: Pt, out: number, t: number, cols: number[], a = 1): void {
  const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const ux = (to.x - from.x) / len;
  const uy = (to.y - from.y) / len;
  const n = Math.ceil(len * out);
  for (let s = 0; s < 5; s++) {
    for (let i = 0; i <= n; i++) {
      const o = (s - 2) * 0.9 * (0.6 + (0.6 * i) / len) + Math.sin(i * 0.4 - t * 14 + s) * 0.7;
      const x = from.x + ux * i - uy * o;
      const y = from.y + uy * i + ux * o * FLAT;
      if (a < 1 && dither(x, y) >= a) continue;
      dot(px, x, y, (i + s * 4) % 9 === 0 ? cols[2] : s % 2 ? cols[1] : cols[0], 1);
    }
  }
}

/** A pool of hair spread at `at`, strands radiating out, tendrils groping up. */
function hairPool(L: Layers, at: Pt, R: number, k: number, t: number, cols: number[], p: Pal): void {
  const r = R * k;
  ring(L.ground, at.x, at.y, r + 1, 1, p, 0.35 * k);
  for (let i = 0; i < 22; i++) {
    const th = (i / 22) * Math.PI * 2 + hash(i, 1) * 0.2;
    const len = r * (0.7 + hash(i, 2) * 0.3);
    for (let d = 0; d <= len; d++) {
      const wob = Math.sin(d * 0.4 + t * 8 + i) * 0.12;
      dot(L.ground, at.x + Math.cos(th + wob) * d, at.y + Math.sin(th + wob) * d * FLAT, (d + i * 3) % 11 === 0 ? cols[2] : i % 2 ? cols[1] : cols[0], 1);
    }
  }
  for (let i = 0; i < 4; i++) {
    const th = hash(i, 9) * Math.PI * 2;
    const rr = r * (0.3 + hash(i, 4) * 0.5);
    const bx = at.x + Math.cos(th) * rr;
    const by = at.y + Math.sin(th) * rr * FLAT;
    const tall = (4 + hash(i, 6) * 5) * k * (0.7 + 0.3 * Math.sin(t * 8 + i * 2));
    for (let z = 0; z <= tall; z++) dot(L.air, bx + Math.sin(z * 0.6 + t * 10 + i) * (z / tall) * 1.4, by - z, z > tall - 1.5 ? cols[2] : cols[1], 1);
  }
}

/** Strands coiled up a held foe. */
function wrap(px: Px, at: Pt, k: number, t: number, cols: number[]): void {
  const top = 18 * Math.min(1, k * 1.5);
  for (let s = 0; s < 3; s++)
    for (let z = 0; z <= top; z += 0.5) {
      const q = z * 0.6 + s * 2.1 + t * 5;
      if (Math.sin(q) < -0.2) continue;
      dot(px, at.x + Math.cos(q) * 6, at.y - z, (Math.floor(z) + s) % 6 === 0 ? cols[2] : cols[1], 1);
    }
}

/** Grasping hair: she pours her hair along the ground; it spreads into a pool and wraps everyone in it. */
const grasp: Move = {
  cast(s, c) {
    const cols = isYuki(c.look) ? HAIR.yuki : HAIR.base;
    s.add(Math.max(0.2, c.lead), (L, k, t) => {
      river(L.ground, c.from, c.at, easeOut(k), t, cols);
      const q = { x: lerp(c.from.x, c.at.x, easeOut(k)), y: lerp(c.from.y, c.at.y, easeOut(k)) };
      dot(L.ground, q.x, q.y, c.pal.core, 1);
    });
  },
  hit(s, c) {
    const cols = isYuki(c.look) ? HAIR.yuki : HAIR.base;
    const R = Math.max(14, c.r);
    const hold = Math.max(0.9, c.stun);
    s.add(0.4, (L, k, t) => river(L.ground, c.from, c.at, 1, t, cols, 1 - k));
    s.add(hold + 0.35, (L, k, t) => {
      const sec = k * (hold + 0.35);
      const grow = sec < 0.15 ? easeOut(sec / 0.15) : sec > hold ? 1 - easeOut((sec - hold) / 0.35) : 1;
      hairPool(L, c.at, R, grow, t, cols, c.pal);
      for (const h of c.hits) wrap(L.air, h, grow, t, cols);
      if (isYuki(c.look) && Math.floor(t * 8) % 2 === 0) dot(L.ground, c.at.x + (hash(Math.floor(t * 8), 1) - 0.5) * R * 1.4, c.at.y + (hash(Math.floor(t * 8), 2) - 0.5) * R * FLAT, 0xffffff, 1);
      L.light(c.at.x, c.at.y - 4, R * 2, c.pal.light, 0.35 * grow);
    });
    s.sparks(c.at.x, c.at.y, 10, [cols[2], c.pal.mid, cols[1]], { speed: 26, up: 18, g: 120, life: 0.4, z: 1, spread: 6 });
    for (const h of c.hits) impact(s, h, c.pal, 0.5, 4);
  },
};

const CANDLES = 12;

/** One candle on the board: a pale stub on its dish, its flame while lit, or a thread of smoke. */
function candle(L: Layers, x: number, y: number, lit: boolean, smoke: number, p: Pal, wax: number[], t: number, i: number): void {
  dot(L.ground, x - 1, y, 0x3a3442, 1);
  dot(L.ground, x, y, 0x4a4452, 1);
  dot(L.ground, x + 1, y, 0x3a3442, 1);
  for (let dy = 1; dy <= 3; dy++) dot(L.air, x, y - dy, dy === 3 ? wax[0] : wax[1], 1);
  if (lit) {
    const f = Math.floor(t * 14 + i) % 3;
    dot(L.air, x, y - 4, p.core, 1);
    dot(L.air, x + (f === 1 ? 1 : 0), y - 5, p.hot, 1);
    if (f !== 2) dot(L.air, x, y - 6, p.mid, 0.9);
    L.light(x, y - 5, 10, p.light, 0.35);
  } else if (smoke > 0 && smoke < 1) {
    for (let j = 0; j < 4; j++) if (j / 4 < 1 - smoke) dot(L.air, x + Math.sin(j + smoke * 6) * 0.8, y - 5 - j * 2 - smoke * 5, wax[2], 0.6);
  }
}

/** Hundred Candles: a ring of candles; snuffed one by one, each sending a spirit at a foe; then all flare. */
const candles: Move = {
  cast(s, c) {
    if (c.lead <= 0) return;
    gather(s, c.from, c.pal, c.lead, 1.2);
  },
  hit(s, c) {
    const p = c.pal;
    const R = Math.max(30, c.r);
    const { x, y } = c.from;
    const wax = isYuki(c.look) ? [0xe8f6ff, 0x9ccbec, 0xe0f0ff] : [0xfff8ec, 0xd4c8b4, 0x8a94a8];
    const LIGHT = 0.35;
    const EACH = 0.07;
    const FLARE = LIGHT + CANDLES * EACH + 0.12;
    const spots = Array.from({ length: CANDLES }, (_, i) => {
      const th = -Math.PI / 2 + (i / CANDLES) * Math.PI * 2;
      return { x: x + Math.cos(th) * R, y: y + Math.sin(th) * R * FLAT, lit: (Math.min(i, CANDLES - i) / (CANDLES / 2)) * LIGHT, out: LIGHT + i * EACH };
    });
    s.add(FLARE + 0.45, (L, k, t) => {
      const sec = k * (FLARE + 0.45);
      for (let i = 0; i < CANDLES; i++) {
        const cd = spots[i];
        if (sec < cd.lit) continue;
        if (sec < FLARE) candle(L, cd.x, cd.y, sec < cd.out, (sec - cd.out) / 0.5, p, wax, t, i);
        else {
          const f = (sec - FLARE) / 0.45;
          column(L.air, cd.x, cd.y, 18 * (1 - f * 0.5), 2, p, 1 - f, t * 60 + i);
        }
      }
      if (sec >= FLARE) {
        const f = (sec - FLARE) / 0.45;
        ring(L.ground, x, y, R, 2 * (1 - f) + 0.5, p, 1 - f);
        L.light(x, y - 6, R * 3, p.light, 1 - f);
      } else L.light(x, y - 6, R * 2, p.light, 0.4 * clamp01(sec / LIGHT));
    });
    // Each snuffed candle's spirit streaks at a foe in turn.
    spots.forEach((cd, i) => {
      const foe = c.hits.length ? c.hits[i % c.hits.length] : null;
      if (!foe) return;
      const from = { x: cd.x, y: cd.y - 5 };
      const to = { x: foe.x, y: foe.y - CHEST };
      s.add(0.22, (L, k) => {
        const e = easeOut(k);
        const qx = lerp(from.x, to.x, e);
        const qy = lerp(from.y, to.y, e) - Math.sin(k * Math.PI) * 6;
        const bx = lerp(from.x, to.x, Math.max(0, e - 0.25));
        const by = lerp(from.y, to.y, Math.max(0, e - 0.25)) - Math.sin(Math.max(0, k - 0.25) * Math.PI) * 6;
        stroke(L.air, bx, by, qx, qy, 1.2, p, tail(k, 0.8));
        dot(L.air, qx, qy, p.core, 1, 2);
        L.light(qx, qy, 12, p.light, 0.6);
      }, cd.out, () => s.sparks(to.x, to.y + CHEST, 4, [0xffffff, p.hot, p.mid], { speed: 18, up: 16, life: 0.3, z: CHEST }));
    });
    s.add(0.01, () => {}, FLARE, () => {
      s.shake(220, 0.004, c.from);
      s.sparks(x, y, 24, [0xffffff, ...p.tints], { speed: 40, up: 40, g: 60, life: 0.6, z: 10, spread: R * 0.6 });
      for (const h of c.hits) impact(s, h, p, 1);
    });
    if (isYuki(c.look)) s.sparks(x, y, 18, [0xffffff, 0xe8f6ff], { speed: 6, up: -4, g: 14, life: 1.6, z: 40, spread: R });
  },
};

export const YUREI_AUTO: Record<string, Kit> = {
  'phantom.yurei': { shot: ofudaShot, skill: grasp, ult: candles },
};
