// The Bard's effects on the board: the Minstrel's notes, quick song and
// Encore; the War Drummer's beats, great beat and Thunder of War. Notes and
// drums are little drawings (sprite rows). Drum skin and rope keep their own
// colours.

import {
  angle,
  bump,
  CHEST,
  circle as pCircle,
  dist,
  dither,
  dot as pDot,
  easeIn,
  easeOut,
  FLAT,
  HEAD,
  impact,
  lerp,
  line as pLine,
  ring,
  sprite,
  star as pStar,
  tail,
  type Cast,
  type Kit,
  type Layers,
  type Pal,
  type Pt,
  type Px,
  type Stage,
} from '../paint';
import { flight, gather, HAND, motes, plus, smoke } from './common';

/** The mallets' hafts. */
const WOOD = 0xb07a44;
/** The war drum: its stretched hide, lacquered shell, bronze rims. */
const HIDE = 0xf2e4c4;
const SHELL = 0xa8302a;
const SHELL_DARK = 0x5e1a18;
const BRONZE = 0xd8a048;

/** Pixels put through this fade out in a dither checker rather than going see-through, so everything stays crisp. */
const fade = (px: Px, a: number): Px => (a >= 1 ? px : { put: (x, y, c) => void (a > 0 && dither(x, y) < a && px.put(x, y, c, 1)) });
const line = (px: Px, x0: number, y0: number, x1: number, y1: number, c: number, a = 1): void => pLine(fade(px, a), x0, y0, x1, y1, c);
const dot = (px: Px, x: number, y: number, c: number, a = 1, sz = 1): void => pDot(fade(px, a), x, y, c, 1, sz);
const circle = (px: Px, cx: number, cy: number, r: number, c: number, a = 1, sq = FLAT, from = 0, to = Math.PI * 2): void => pCircle(fade(px, a), cx, cy, r, c, 1, sq, from, to);
const star = (px: Px, x: number, y: number, sz: number, p: Pal, a = 1): void => pStar(fade(px, a), x, y, sz, p);

// --- Notes ---------------------------------------------------------------------------------

/** An eighth note: a filled head, a stem, a flag curling off its top. */
const NOTE8 = [
  '..hh.',
  '..h.h',
  '..h.h',
  '..h..',
  'mmh..',
  'mmm..',
  '.d...',
];
/** Two eighths beamed together. */
const NOTE2 = [
  '.hhhhh',
  '.h...h',
  '.h...h',
  'mh..mh',
  'mm..mm',
  'd...d.',
];
/** A tiny note for chords and showers. */
const MINI = ['..h', '..h', 'mmh', 'mm.'];

const noteCols = (p: Pal) => ({ h: p.core, m: p.hot, d: p.mid });

/** A note at (x, y) (its middle), picked by `kind`, with a soft light. */
function note(L: Layers, x: number, y: number, kind: number, p: Pal, a = 1, s = 1): void {
  const rows = kind % 3 === 0 ? NOTE2 : kind % 3 === 1 ? NOTE8 : MINI;
  sprite(L.air, x, y, rows, noteCols(p), a, { ay: rows.length / 2, s });
}

/** A few tiny notes popping up off a spot and drifting apart, like a chord struck. */
function chord(s: Stage, at: Pt, p: Pal, n = 3, h = CHEST, wait = 0): void {
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * 5 + (Math.random() - 0.5) * 2;
    const up = 10 + Math.random() * 6;
    s.add(
      0.55,
      (L, k) => {
        const y = at.y - h - up * easeOut(k);
        note(L, at.x + dx * easeOut(k), y + Math.sin(k * 12 + i) * 0.8, 2, p, tail(k, 0.5));
      },
      wait + i * 0.04,
    );
  }
}

// --- The Minstrel --------------------------------------------------------------------------

/** A note flying to the foe on a gentle wave, a shimmer trailing behind; it lands as a chord. */
function noteShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const base = flight(a, b, 3);
  const th = angle(a, b);
  const nx = -Math.sin(th);
  const ny = Math.cos(th) * 0.6;
  const kind = Math.random() < 0.5 ? 0 : 1;
  const pos = (k: number): Pt => {
    const q = base(k);
    const w = Math.sin(k * Math.PI * 3) * 3;
    return { x: q.x + nx * w, y: q.y + ny * w };
  };
  s.add(
    dur,
    (L, k) => {
      // A ribbon of melody behind it, thinning out.
      for (let i = 1; i <= 7; i++) {
        const q = pos(Math.max(0, k - i * 0.03));
        dot(L.air, q.x, q.y, i < 3 ? p.hot : i < 5 ? p.mid : p.deep, 1 - i / 8);
      }
      const q = pos(k);
      note(L, q.x, q.y, kind, p);
      L.light(q.x, q.y, 16, p.light, 0.6);
    },
    0,
    () => {
      s.add(0.25, (L, k) => {
        circle(L.air, b.x, b.y - CHEST, 2 + 7 * easeOut(k), p.hot, 1 - k, 1);
        ring(L.ground, b.x, b.y, 3 + 7 * easeOut(k), 1, p, 1 - k);
        L.light(b.x, b.y - CHEST, 22, p.light, 0.8 * (1 - k));
      });
      chord(s, b, p, 2);
      s.sparks(b.x, b.y, 4, p.tints, { speed: 18, up: 16, z: CHEST, life: 0.3 });
    },
  );
}

/** A wavy stave of melody from (ax, ay) out to (bx, by): two lines wound round each other, drawn out to `reach`. */
function melody(L: Layers, ax: number, ay: number, bx: number, by: number, reach: number, t: number, p: Pal, a: number): void {
  const len = Math.hypot(bx - ax, by - ay);
  const n = Math.max(6, Math.ceil(len * reach));
  const nx = -(by - ay) / (len || 1);
  const ny = (bx - ax) / (len || 1);
  for (let i = 0; i <= n; i++) {
    const f = (i / n) * reach;
    // Swells in the middle, pinches at both ends.
    const amp = 3 * Math.sin(f * Math.PI);
    const w = Math.sin(f * 14 - t * 16) * amp;
    const x = lerp(ax, bx, f);
    const y = lerp(ay, by, f);
    dot(L.air, x + nx * w, y + ny * w, p.hot, a);
    dot(L.air, x - nx * w, y - ny * w + 1, p.mid, a);
  }
}

/** Quick song: rings of sound off the strings; then a melody winds out to every friend near, a note riding each, and they glow with the beat. */
const quickSong = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    gather(s, c.from, p, c.lead, 0.7);
    s.add(c.lead, (L, k, t) => {
      // Sound rolling off the lute in arcs to either side.
      for (let i = 0; i < 3; i++) {
        const f = (t * 3 + i / 3) % 1;
        for (const sd of [-1, 1]) {
          const th = sd < 0 ? Math.PI : 0;
          circle(L.air, c.from.x, c.from.y - HAND, 4 + f * 10, f < 0.4 ? p.hot : p.mid, (1 - f) * k + 0.2, 0.9, th - 0.7, th + 0.7);
        }
      }
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const ax = c.from.x;
    const ay = c.from.y - HAND;
    // Notes turning round him while he plays.
    s.add(0.8, (L, k, t) => {
      const a = tail(k, 0.6);
      for (let i = 0; i < 4; i++) {
        const th = t * 5 + (i / 4) * Math.PI * 2;
        note(L, c.from.x + Math.cos(th) * 11, c.from.y - 14 + Math.sin(th) * 4 - k * 4, i, p, a);
      }
      ring(L.ground, c.from.x, c.from.y, 4 + 14 * easeOut(k), 1, p, 1 - k, 0.3, 4);
      L.light(c.from.x, c.from.y - 12, 34, p.light, 0.6 * a);
    });
    c.hits.forEach((h, i) => {
      if (dist(h, c.from) < 3) return;
      const bx = h.x;
      const by = h.y - CHEST;
      s.add(0.7, (L, k, t) => {
        const reach = easeOut(Math.min(1, k / 0.4));
        melody(L, ax, ay, bx, by, reach, t, p, tail(k, 0.55));
        // A note riding out along it.
        const f = Math.min(1, k / 0.4);
        note(L, lerp(ax, bx, f), lerp(ay, by, f) - 3, i, p, tail(k, 0.6));
      }, i * 0.05);
      s.add(0.01, () => {}, i * 0.05 + 0.28, () => {
        s.add(0.5, (L, k) => {
          ring(L.ground, h.x, h.y, 4 + 8 * easeOut(k), 1, p, 1 - k);
          circle(L.air, h.x, h.y - 11, 9, p.hot, bump(k), 1.25, Math.PI + k * 4, Math.PI * 1.8 + k * 4);
          L.light(h.x, h.y - 10, 26, p.light, 0.7 * (1 - k));
        });
        chord(s, h, p, 2, HEAD);
        motes(s, h, [p.core, p.hot, 0xd8ffd0], 5, 8);
      });
    });
  },
};

/** Encore: notes rise into a ring turning round him; the ring swells, and the notes fly off to every friend, each bursting in a shower of light. */
const encore = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    gather(s, c.from, p, c.lead, 1.1);
    s.add(c.lead, (L, k, t) => {
      for (let i = 0; i < 8; i++) {
        const th = t * 3 + (i / 8) * Math.PI * 2;
        const rise = easeOut(Math.min(1, k * 2 - i * 0.08));
        if (rise <= 0) continue;
        note(L, c.from.x + Math.cos(th) * 14, c.from.y - 4 - 12 * rise + Math.sin(th) * 5, i, p, rise);
      }
      // A stave laid on the ground round him: five lines of a staff bent into a ring.
      for (let j = 0; j < 3; j++) circle(L.ground, c.from.x, c.from.y, 13 + j * 2, j === 1 ? p.hot : p.mid, k, FLAT, t, t + Math.PI * 1.6 * k);
      L.light(c.from.x, c.from.y - 12, 40 * k + 10, p.light, 0.6 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.from;
    const friends = c.hits.filter((h) => dist(h, c.from) >= 3);
    const R = Math.min(70, Math.max(30, c.r));
    // The ring swells out and fades as its notes fly.
    s.add(0.5, (L, k, t) => {
      const r = 14 + 8 * easeOut(k);
      for (let i = 0; i < 8; i++) {
        if (i < friends.length) continue;
        const th = t * 3 + (i / 8) * Math.PI * 2;
        note(L, x + Math.cos(th) * r, y - 16 + Math.sin(th) * r * 0.36 - k * 10, i, p, 1 - k);
      }
      ring(L.ground, x, y, R * easeOut(k), 2, p, 1 - k, 0.25, 6);
      L.light(x, y - 14, 60, p.light, 1 - k);
    });
    friends.forEach((h, i) => {
      const a = { x: x + Math.cos((i / 8) * Math.PI * 2) * 14, y: y - 16 };
      const b = { x: h.x, y: h.y - HEAD };
      const dur = 0.22 + dist(a, b) / 260;
      const wait = i * 0.06;
      s.add(
        dur,
        (L, k) => {
          const e = easeIn(k);
          const qx = lerp(a.x, b.x, e);
          const qy = lerp(a.y, b.y, e) - Math.sin(k * Math.PI) * 12;
          for (let j = 1; j <= 4; j++) {
            const ee = easeIn(Math.max(0, k - j * 0.06));
            dot(L.air, lerp(a.x, b.x, ee), lerp(a.y, b.y, ee) - Math.sin(Math.max(0, k - j * 0.06) * Math.PI) * 12, j < 2 ? p.hot : p.mid, 1 - j / 5);
          }
          note(L, qx, qy, i, p, 1, 1);
          L.light(qx, qy, 16, p.light, 0.6);
        },
        wait,
        () => {
          s.add(0.5, (L, k) => {
            if (k < 0.3) star(L.air, h.x, h.y - HEAD, 4, p, 1);
            ring(L.ground, h.x, h.y, 4 + 9 * easeOut(k), 1, p, 1 - k);
            L.light(h.x, h.y - 14, 34, p.light, 1 - k);
          });
          chord(s, h, p, 3, HEAD);
          motes(s, h, [p.core, p.hot, 0xd8ffd0], 6, 10);
          plus(s, h, 0x9aff9a);
        },
      );
    });
    // His own glow, last.
    motes(s, c.from, [p.core, p.hot], 6, 10);
  },
};

// --- The War Drummer ----------------------------------------------------------------------

/** The war drum seen a little from above: the hide on top, rope laced down the red shell, bronze rims. */
const DRUM = [
  '.bbbbbbb.',
  'bHHHHHHHb',
  'bhHHHHHhb',
  'bbbbbbbbb',
  'srSSSrSSs',
  'sSrSrSrSs',
  'sSSrSSSrs',
  'bbbbbbbbb',
];

function drum(L: Layers, x: number, y: number, p: Pal, flash: number, a = 1, s = 1): void {
  const lit = flash > 0.5;
  sprite(L.air, x, y, DRUM, { b: BRONZE, H: lit ? 0xffffff : HIDE, h: lit ? p.core : 0xc8b490, s: SHELL_DARK, S: SHELL, r: p.mid }, a, { ay: DRUM.length / 2, s });
}

/** A mallet, a padded head on a short haft, raised to `lift` (0 down on the drum, 1 high). */
function mallet(L: Layers, x: number, y: number, side: number, lift: number, p: Pal, a = 1): void {
  const th = -Math.PI / 2 - side * (0.2 + lift * 0.9);
  const hx = x + side * 3;
  const hy = y + 2;
  const tx = hx + Math.cos(th) * 7 * (0.4 + lift * 0.6);
  const ty = hy + Math.sin(th) * 7 * (0.4 + lift * 0.6);
  line(L.air, hx, hy, tx, ty, WOOD, a);
  dot(L.air, tx, ty, lift < 0.15 ? p.core : HIDE, a, 2);
}

/** Rings of sound rolling off a struck spot in the air, opening one way (`th`), or all round when `th` is undefined. */
function soundRings(L: Layers, x: number, y: number, k: number, n: number, R: number, p: Pal, th?: number): void {
  for (let i = 0; i < n; i++) {
    const kk = k - i * 0.12;
    if (kk <= 0) continue;
    const r = 3 + R * easeOut(kk);
    const a = 1 - kk;
    if (th === undefined) circle(L.air, x, y, r, i ? p.mid : p.hot, a, 0.7);
    else circle(L.air, x, y, r, i ? p.mid : p.hot, a, 0.9, th - 0.8, th + 0.8);
  }
}

/** A beat landing on a foe: a thump and rings of sound off it; the boom shakes the ground and kicks up dust. */
function beat(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const th = angle(from, at);
  const x = at.x;
  const y = at.y - CHEST;
  s.add(heavy ? 0.4 : 0.28, (L, k) => {
    soundRings(L, x - Math.cos(th) * 3, y, k, heavy ? 3 : 2, heavy ? 12 : 8, p, th);
    if (k < 0.25) star(L.air, x, y, heavy ? 4 : 3, p, 1);
    if (heavy) ring(L.ground, at.x, at.y, 4 + 12 * easeOut(k), 1.5, p, 1 - k);
    L.light(x, y, heavy ? 30 : 18, p.light, 0.8 * (1 - k));
  });
  s.sparks(at.x, at.y, heavy ? 6 : 3, p.tints, { speed: 26, up: 16, z: CHEST, dir: th, cone: 0.8, life: 0.3 });
  if (heavy) s.sparks(at.x, at.y, 6, [0x8a7a68, 0x6a5e50], { speed: 22, up: 14, g: 60, z: 1, ground: true, life: 0.45 });
}

/** A drum hung over his head, played: mallets raised in the wind-up, brought down on the hit with a flash of the hide. */
function drumOver(s: Stage, at: Pt, p: Pal, wind: number, after: number, size: number, beats: number[] = []): void {
  const x = at.x;
  const y = at.y - HEAD - 7 - (size - 1) * 8;
  s.add(wind + after, (L, _k, tt) => {
    const show = Math.min(1, tt / 0.12) * (tt > wind ? tail((tt - wind) / after, 0.4) : 1);
    // Mallets rise through the wind-up and come down at its end (and on each small beat).
    let lift = tt < wind ? easeOut(tt / wind) : Math.min(1, (tt - wind) / 0.25);
    let flash = tt >= wind && tt < wind + 0.1 ? 1 : 0;
    for (const b of beats) {
      const d = tt - b;
      if (d > -0.08 && d < 0.08) lift = Math.min(lift, Math.abs(d) / 0.08);
      if (d >= 0 && d < 0.06) flash = 1;
    }
    const bob = flash ? 1 : 0;
    drum(L, x, y + bob, p, flash, show, size);
    for (const sd of [-1, 1]) mallet(L, x + sd * 4 * size, y - 3 * size, sd, lift, p, show);
    if (flash) L.light(x, y - 3 * size, 30 * size, p.light, 0.9);
  });
}

/** Great beat: the drum swung up over his head, one great blow; rings of sound roll out across the ground and throw the foes back. */
const greatBeat = {
  cast(s: Stage, c: Cast): void {
    drumOver(s, c.from, c.pal, c.lead, 0.45, 1);
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(20, c.r);
    const top = { x: c.from.x, y: c.from.y - HEAD - 7 };
    s.add(0.5, (L, k) => {
      soundRings(L, top.x, top.y, k, 3, 14, p);
      for (let i = 0; i < 3; i++) {
        const kk = k - i * 0.1;
        if (kk > 0) ring(L.ground, c.from.x, c.from.y, R * easeOut(kk), 1.5, p, 1 - kk);
      }
      L.light(c.from.x, c.from.y - 10, R * 2.4, p.light, 0.8 * (1 - k));
    });
    s.sparks(c.from.x, c.from.y, 10, [0x8a7a68, 0x6a5e50, p.mid], { speed: 40, up: 14, g: 60, z: 1, ground: true, life: 0.5, spread: 6 });
    for (const h of c.hits) {
      impact(s, h, p, 0.8);
      s.sparks(h.x, h.y, 4, [p.hot, p.mid], { speed: 30, up: 10, z: 4, dir: angle(c.from, h), cone: 0.4, life: 0.3 });
    }
    // The rhythm stirs him: warm motes rising.
    motes(s, c.from, [p.hot, p.mid], 5, 8);
  },
};

/** Thunder of War: a great drum rises over him and two beats build; the third falls like thunder, a wall of sound across the ground, and two more roll after it. */
const thunderOfWar = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const lead = c.lead;
    const pre = [lead * 0.4, lead * 0.75];
    drumOver(s, c.from, p, lead, 1.0, 2, [...pre, lead + 0.3, lead + 0.6]);
    // The building beats: small rings off the ground.
    for (const b of pre) s.add(0.3, (L, k) => ring(L.ground, c.from.x, c.from.y, 6 + 14 * easeOut(k), 1, p, 1 - k), b);
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(34, c.r);
    const { x, y } = c.from;
    const top = { x, y: y - HEAD - 15 };
    s.shake(220, 0.006);
    // The great beat: a wall of sound, the ground rippling, dust thrown up all round.
    s.add(0.7, (L, k) => {
      soundRings(L, top.x, top.y, k, 4, 24, p);
      ring(L.ground, x, y, R * easeOut(k), 3, p, 1 - k);
      ring(L.ground, x, y, R * 0.7 * easeOut(k), 1, p, 1 - k);
      // Sound in the air: arcs sweeping out over the ground at waist height.
      for (let i = 0; i < 8; i++) {
        const th = (i / 8) * Math.PI * 2;
        const d = R * easeOut(k);
        circle(L.air, x + Math.cos(th) * d, y - 8 + Math.sin(th) * d * FLAT, 4, p.hot, 1 - k, 0.8, th - 1, th + 1);
      }
      L.light(x, y - 16, R * 3, p.light, 1 - k);
    });
    smoke(s, c.from, 6, 0x6a5e50, 4, 0.8, 2);
    s.sparks(x, y, 18, [0x8a7a68, 0x6a5e50, p.mid, p.hot], { speed: 60, up: 20, g: 60, z: 1, ground: true, life: 0.55, spread: 10 });
    // Two more beats rolling after, each fainter.
    [0.3, 0.6].forEach((w, i) =>
      s.add(
        0.5,
        (L, k) => {
          ring(L.ground, x, y, R * (0.85 - i * 0.15) * easeOut(k), 2, p, (1 - k) * (0.85 - i * 0.2));
          soundRings(L, top.x, top.y, k, 2, 16, p);
        },
        w,
      ),
    );
    for (const h of c.hits) {
      impact(s, h, p, 1);
      s.add(0.01, () => {}, 0.3, () => s.sparks(h.x, h.y, 3, [p.hot, p.mid], { speed: 16, up: 20, z: 8, life: 0.3 }));
    }
  },
};

export const SHOW_KITS: Record<string, Kit> = {
  'bard.minstrel': { shot: noteShot, skill: quickSong, ult: encore },
  'bard.drummer': { melee: beat, skill: greatBeat, ult: thunderOfWar },
};
