// The BarrowKnight's effects on the board: the spade's swings and earth-
// cracking slam, the open grave whose arms hold what stands on it, and the
// Graveyard's ring of headstones loosing ghosts. Earth, iron and stone keep
// their own colours; the corpse-light takes the palette, so Mossgrave's look
// recolours it (and makes the arms roots, the stones mossy, the ghosts wisps).

import {
  angle,
  arc,
  CHEST,
  dist,
  dither,
  easeIn,
  easeOut,
  FLAT,
  hash,
  lerp,
  line,
  pool,
  ring,
  shock,
  sprite,
  star,
  type Cast,
  type Kit,
  type Pal,
  type Pt,
  type Px,
  type Stage,
} from '../paint';
import { HAND } from './common';

const IRON = [0xe2e6e8, 0x9aa0a6, 0x585c62];
const HAFT = 0x7a5a36;
const EARTH = [0x7a5a3a, 0x5a3e26, 0x2e1e12];
const MOSS_EARTH = [0x5a6a30, 0x3a4c1e, 0x1a2410];
const BONE = [0xf4eed4, 0xc8bf9c, 0x7a7260];
const ROOT = [0x8a6a42, 0x5e4426, 0x34240e];
const STONE = [0xa6a8aa, 0x84868a, 0x62646a, 0x2a2a2e];
const MOSS = 0x6a9a34;
/** Mossgrave's wisp-light: a blow (which isn't told the look) knows the skin by its palette. */
const MOSS_LIGHT = 0x6af0e8;

const mossy = (c: Cast | { look: string }): boolean => c.look === 'mossgrave';

/** The spade on its haft from (x, y), the blade out at angle `th`. */
function spade(px: Px, x: number, y: number, th: number, len: number): void {
  const ex = x + Math.cos(th) * len;
  const ey = y + Math.sin(th) * len;
  line(px, x, y, ex, ey, HAFT, 1);
  // The blade: a broad spoon of iron at the end, lit along one edge.
  const nx = -Math.sin(th);
  const ny = Math.cos(th);
  for (let i = 0; i < 4; i++)
    for (let j = -1; j <= 1; j++) px.put(ex + Math.cos(th) * i + nx * j, ey + Math.sin(th) * i + ny * j, IRON[j === -1 ? 0 : j === 0 ? 1 : 2], 1);
}

/** Clods thrown up off the ground at `at`, earth or moss. */
function clods(s: Stage, at: Pt, n: number, moss: boolean, dir?: number): void {
  const e = moss ? MOSS_EARTH : EARTH;
  s.sparks(at.x, at.y, n, e, { speed: 24, up: 46, g: 200, life: 0.6, z: 2, dir, cone: dir === undefined ? undefined : 0.8 });
}

/** Jagged cracks running out from `at`, their seams glowing a moment. */
function cracks(s: Stage, at: Pt, R: number, p: Pal, seed: number, dur = 0.9): void {
  s.add(dur, (L, k) => {
    const grow = easeOut(k / 0.15);
    const a = 1 - easeIn((k - 0.5) / 0.5);
    for (let i = 0; i < 6; i++) {
      const th = (i / 6) * Math.PI * 2 + hash(seed, i) * 0.8;
      let x = at.x;
      let y = at.y;
      const len = R * (0.6 + hash(seed, i, 1) * 0.4) * grow;
      for (let r = 1; r < len; r++) {
        const j = (hash(seed, i, Math.floor(r / 3)) - 0.5) * 0.6;
        x = at.x + Math.cos(th + j) * r;
        y = at.y + Math.sin(th + j) * r * FLAT;
        if (dither(x, y) >= a) continue;
        L.ground.put(x, y, k < 0.35 && r < len - 1 ? p.hot : EARTH[2], 1);
      }
    }
    L.light(at.x, at.y - 2, R * 2.2, p.light, 0.6 * (1 - k));
  });
}

/** A spade blow: the swing's smear, the clang, earth flung up; the slam cracks the ground. */
function spadeBlow(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const side = at.x >= from.x ? 1 : -1;
  const P = { x: lerp(from.x, at.x, 0.3), y: lerp(from.y, at.y, 0.3) - HAND - (heavy ? 4 : 1) };
  const foe = { x: at.x, y: at.y - (heavy ? 2 : CHEST) };
  const th = angle(P, foe);
  const len = Math.max(8, Math.min(12, dist(P, foe)));
  // The slam comes down from over his head; the swings cut across.
  const a0 = heavy ? -Math.PI / 2 - 0.4 * side : th - 1.6 * side;
  const a1 = th + 0.2 * side;
  const swing = heavy ? 0.14 : 0.1;
  const moss = p.light === MOSS_LIGHT;
  s.add(swing + 0.12, (L, _k, t) => {
    const u = easeIn(Math.min(1, t / swing));
    const cur = lerp(a0, a1, u);
    const fade = t < swing ? 1 : 1 - (t - swing) / 0.12;
    const lo = Math.min(a0, cur);
    const hi = Math.max(a0, cur);
    if (hi - lo > 0.2) arc(L.air, P.x, P.y, len + 2, 2, lo, hi, p, fade * 0.8);
    if (t < swing + 0.06) spade(L.air, P.x, P.y, cur, len);
  });
  s.add(0.01, () => {}, swing * 0.8, () => {
    s.add(0.2, (L, k) => {
      star(L.air, foe.x, foe.y, k < 0.5 ? 3 : 1, p, 1);
      L.light(foe.x, foe.y, heavy ? 30 : 16, p.light, 0.8 * (1 - k));
    });
    clods(s, at, heavy ? 10 : 4, moss, heavy ? undefined : angle(from, at));
    if (heavy) {
      cracks(s, at, 14, p, Math.floor(at.x * 7 + at.y));
      shock(s, at, 16, p, 0.35, 1);
      s.shake(110, 0.003, at);
    }
  });
}

/** One arm (or root) out of the ground at (x, y), `h` px up, its fingers hooked over. */
function limb(px: Px, x: number, y: number, h: number, lean: number, grip: boolean, moss: boolean): void {
  const [hi, mid, lo] = moss ? ROOT : BONE;
  let X = x;
  for (let i = 0; i < h; i++) {
    X = x + lean * (i / Math.max(1, h)) ** 2 * 3;
    px.put(X, y - i, moss && i % 3 === 0 ? MOSS : hi, 1);
    px.put(X + 1, y - i, mid, 1);
  }
  if (h < 2) return;
  const top = y - h;
  for (const dx of [-1, 0, 1, 2]) px.put(X + dx, top, dx === 0 || dx === 1 ? hi : mid, 1);
  for (const dx of [-1, 0, 2]) {
    px.put(X + dx, top - 1, hi, 1);
    px.put(X + dx + (grip ? Math.sign(dx - 0.5) : 0), top - 2, lo, 1);
  }
}

/** Open grave: the ground darkens and splits at the aim; arms burst up round every foe on it and hold. */
const graveMove = {
  cast(s: Stage, c: Cast): void {
    // The spade bites: dust lifts off the spot before it opens.
    const moss = mossy(c);
    s.add(c.lead, (L, k) => {
      pool(L.ground, c.at.x, c.at.y, 4 + c.r * 0.6 * easeOut(k), 0x0c0806, (moss ? MOSS_EARTH : EARTH)[2], 0.7 * k);
    });
    clods(s, c.from, 3, moss);
  },
  hit(s: Stage, c: Cast): void {
    const moss = mossy(c);
    const p = c.pal;
    const hold = Math.max(0.8, c.stun) + 0.3;
    const seed = Math.floor(c.at.x * 13 + c.at.y);
    s.shake(120, 0.003, c.at);
    clods(s, c.at, 12, moss);
    s.add(hold, (L, k, t) => {
      const open = Math.min(1, t / 0.12) * (1 - easeIn((k - 0.8) / 0.2));
      // The pit, lit from far below.
      pool(L.ground, c.at.x, c.at.y, c.r * 0.8 * open, p.mid, 0x0c0806, 1, 0.95);
      if (open > 0.5) pool(L.ground, c.at.x, c.at.y, c.r * 0.25, p.hot, p.mid, 1, 0.9);
      ring(L.ground, c.at.x, c.at.y, c.r * 0.8 * open, 1, { ...p, core: EARTH[0], hot: EARTH[1], mid: EARTH[1], deep: EARTH[2] }, 1);
      L.light(c.at.x, c.at.y - 4, c.r * 2.4, p.light, 0.6 * open);
      // Arms up round every foe it caught, clutching, sinking back at the end.
      const up = Math.min(1.1, t / 0.1) * (1 - easeIn((k - 0.75) / 0.25));
      c.hits.forEach((h, i) => {
        for (let j = 0; j < 3; j++) {
          const a = (j / 3) * Math.PI * 2 + hash(seed, i, j) * 1.2;
          const x = h.x + Math.cos(a) * 4;
          const y = h.y + Math.sin(a) * 2;
          limb(Math.sin(a) < 0 ? L.ground : L.air, x, y, Math.round(8 * up), -Math.cos(a), Math.sin(t * 20 + j) > 0, moss);
        }
      });
      if (!c.hits.length) limb(L.air, c.at.x, c.at.y, Math.round(10 * up), 0.5, Math.sin(t * 16) > 0, moss);
    });
    s.sparks(c.at.x, c.at.y, 8, [p.core, p.hot, p.mid], { speed: 16, up: 30, g: -20, life: 0.8, z: 2 });
  },
};

/** One headstone (or a mossy standing stone for Mossgrave), its foot at (x, y), up out of the ground by `u`. */
function headstone(px: Px, x: number, y: number, u: number, kind: number, moss: boolean, p: Pal, a: number): void {
  const rows = moss
    ? kind % 2
      ? ['.gg.', 'gsss', 'sssm', 'sscs', 'sssm', 'msss', 'ssmd']
      : ['.g..', 'gss.', 'ssss', 'scss', 'sssd', 'mssd']
    : kind % 2
      ? ['.ss.', 'ssss', 'sccs', 'scss', 'sscs', 'sssd', 'sssd']
      : ['.sss.', 'sssss', 'sscss', 'scccs', 'sscss', 'ssssd', 'ssssd'];
  const h = Math.round(rows.length * u);
  if (h <= 0) return;
  // Only what has come out of the ground shows: the top `h` rows.
  sprite(px, x, y, rows.slice(0, h), { s: STONE[1], d: STONE[3], c: p.hot, g: MOSS, m: moss ? MOSS : STONE[2] }, a);
}

/** Graveyard: stones burst up in a ring round him, then a ghost streaks from them into each foe struck. */
const graveyardMove = {
  cast(s: Stage, c: Cast): void {
    s.add(c.lead, (L, k) => {
      ring(L.ground, c.from.x, c.from.y, c.r * 0.7, 1, c.pal, k * 0.8, 0.5, 3);
      L.light(c.from.x, c.from.y - 6, c.r * 2, c.pal.light, 0.5 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const moss = mossy(c);
    const p = c.pal;
    const N = 6;
    const R = c.r * 0.7;
    const stones: Pt[] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.PI / 2;
      stones.push({ x: Math.round(c.from.x + Math.cos(a) * R), y: Math.round(c.from.y + Math.sin(a) * R * FLAT) });
    }
    s.shake(220, 0.005, c.from);
    shock(s, c.from, R + 6, p, 0.4, 2);
    const life = 1.8;
    stones.forEach((st, i) => {
      clods(s, st, 5, moss);
      s.add(life, (L, k, t) => {
        const u = Math.min(1, t / 0.12);
        const a = 1 - easeIn((k - 0.8) / 0.2);
        L.ground.put(st.x - 2, st.y + 1, 0x0b0818, 0.5);
        headstone(L.air, st.x, st.y, u, i, moss, p, a);
        L.light(st.x, st.y - 4, 10, p.light, 0.5 * a);
      }, i * 0.04);
    });
    // A ghost (a wisp) from the nearest stone to each foe struck.
    c.hits.forEach((h, i) => {
      const st = stones.reduce((b, q) => (dist(q, h) < dist(b, h) ? q : b), stones[0]);
      const a = { x: st.x, y: st.y - 6 };
      const b = { x: h.x, y: h.y - CHEST };
      s.add(0.4, (L, k) => {
        const e = easeOut(k);
        const x = lerp(a.x, b.x, e);
        const y = lerp(a.y, b.y, e) - Math.sin(k * Math.PI) * 6;
        for (let j = 1; j < 5; j++) {
          const kk = Math.max(0, e - j * 0.06);
          L.air.put(lerp(a.x, b.x, kk), lerp(a.y, b.y, kk) - Math.sin(kk * Math.PI) * 6, j < 2 ? p.hot : p.mid, 1 - j / 5);
        }
        if (moss) {
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) L.air.put(x + dx, y + dy, dx || dy ? p.hot : p.core, 1);
        } else sprite(L.air, x, y + 3, ['.hh.', 'hcch', 'cece', 'cccc', 'm.m.'], { c: p.core, h: p.hot, e: p.deep, m: p.mid }, 1, { flip: b.x < a.x });
        L.light(x, y, 12, p.light, 0.6);
      }, 0.2 + i * 0.05, () => s.sparks(h.x, h.y, 6, [p.core, p.hot, p.mid], { speed: 20, up: 20, life: 0.4, z: CHEST }));
    });
  },
};

export const BARROW_KITS: Record<string, Kit> = {
  'necromancer.barrow': { melee: spadeBlow, skill: graveMove, ult: graveyardMove },
};
