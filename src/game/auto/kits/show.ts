// The Showfolk's effects on the board: the Minstrel's notes, quick song and
// Encore; the War Drummer's beats, great beat and Thunder of War; the
// Marionettist's string yank, pirouette and Grand Finale; the Stringweaver's
// lashing thread, snag and Puppet Master. Notes, drums and the puppet are
// little drawings (sprite rows); strings are single crisp lines that catch
// the light. Wood, drum skin and rope keep their own colours.

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
  hash,
  HEAD,
  impact,
  lerp,
  line as pLine,
  ring,
  shadowOf,
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

/** Wood of the puppet and the control bar, light to dark. */
const WOOD_LIT = 0xe2b47a;
const WOOD = 0xb07a44;
const WOOD_DARK = 0x6a4224;
/** The war drum: its stretched hide, lacquered shell, bronze rims. */
const HIDE = 0xf2e4c4;
const SHELL = 0xa8302a;
const SHELL_DARK = 0x5e1a18;
const BRONZE = 0xd8a048;
/** Thread of the strings when they are not lit. */
const THREAD = 0xd8cce4;

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

// --- Strings and puppets ------------------------------------------------------------------

/** The puppet: a wooden doll in a jester's motley of the palette, front on. */
const PUPPET = [
  '..www..',
  '.wffEw.',
  '.wfefw.',
  '..www..',
  'j.cCc.j',
  'jcCcCcj',
  '..cCc..',
  '..ddd..',
  '.ddddd.',
  '..w.w..',
  '..w.w..',
  '.jj.jj.',
];
/** Side on, half way round its turn. */
const PUPPET_SIDE = [
  '..ww..',
  '.wffw.',
  '.wfew.',
  '..ww..',
  '..cc..',
  '.jcCj.',
  '..cC..',
  '..dd..',
  '.ddd..',
  '..w...',
  '..w...',
  '.jj...',
];

const puppetCols = (p: Pal) => ({ w: WOOD, f: WOOD_LIT, e: WOOD_DARK, E: WOOD_LIT, j: WOOD_DARK, c: p.mid, C: p.hot, d: p.deep });

/** The puppet with its feet at (x, y); `turn` 0..1 is once round (front, side, back, side). */
function puppet(L: Layers, x: number, y: number, p: Pal, turn = 0, a = 1, s = 1): void {
  const q = Math.floor((((turn % 1) + 1) % 1) * 4);
  const rows = q === 1 || q === 3 ? PUPPET_SIDE : PUPPET;
  sprite(L.air, x, y, rows, puppetCols(p), a, { flip: q >= 2, s });
}

/** A string from (x0, y0) to (x1, y1), sagging `sag` px, with a glint running down it; `high` fades its top away (strings hanging out of the sky). */
function string(L: Layers, x0: number, y0: number, x1: number, y1: number, sag: number, p: Pal, a: number, glint = -1, high = false): void {
  const n = Math.max(4, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const x = lerp(x0, x1, f);
    const y = lerp(y0, y1, f) + Math.sin(f * Math.PI) * sag;
    const lit = glint >= 0 && Math.abs(f - glint) < 0.06;
    dot(L.air, x, y, lit ? p.core : i % 5 === 0 ? p.hot : THREAD, high ? a * Math.min(1, f * 2.2) : a);
  }
}

/** The control bar the puppeteer holds: a little wooden cross. */
function controlBar(L: Layers, x: number, y: number, a = 1, s = 1): void {
  line(L.air, x - 4 * s, y, x + 4 * s, y, WOOD, a);
  line(L.air, x, y - 2 * s, x, y + 3 * s, WOOD, a);
  dot(L.air, x - 4 * s, y, WOOD_LIT, a);
  dot(L.air, x + 4 * s, y, WOOD_LIT, a);
}

/** Bound in thread: loops of string round a foe's body, the near side of each showing, a glint running round. */
function bound(s: Stage, at: Pt, p: Pal, sec: number, wait = 0): void {
  s.add(
    Math.max(0.5, sec),
    (L, k, t) => {
      const a = tail(k, 0.8);
      const wrap = easeOut(Math.min(1, k * 6));
      for (let i = 0; i < 2; i++) {
        const z = 8 + i * 6;
        circle(L.air, at.x, at.y - z + i, 5, i ? p.mid : p.hot, a, 0.4, 0.2, 0.2 + (Math.PI - 0.4) * wrap);
      }
      const g = t * 6;
      dot(L.air, at.x + Math.cos(g) * 6, at.y - 11 + Math.abs(Math.sin(g)) * 2, p.core, a);
    },
    wait,
  );
}

// --- The Marionettist -----------------------------------------------------------------------

/** The pull: strings flick out from the bar in his hand to the foe and yank, a glint racing down them. */
function stringPull(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const th = angle(from, at);
  const bx = from.x + Math.cos(th) * 4;
  const by = from.y - HEAD - 4;
  const ends = [
    { x: at.x - 3, y: at.y - 18 },
    { x: at.x + 3, y: at.y - 18 },
    { x: at.x, y: at.y - 11 },
  ];
  s.add(heavy ? 0.4 : 0.32, (L, k) => {
    const reach = easeOut(Math.min(1, k / 0.35));
    const a = tail(k, 0.6);
    // A jerk back toward him once taut.
    const jerk = k > 0.35 ? bump(Math.min(1, (k - 0.35) / 0.25)) * 2 : 0;
    controlBar(L, bx, by - jerk, a);
    ends.forEach((e, i) => {
      const ex = lerp(bx, e.x, reach) - Math.cos(th) * jerk;
      const ey = lerp(by, e.y, reach) - Math.sin(th) * jerk;
      string(L, bx + (i - 1) * 4, by - jerk, ex, ey, k < 0.35 ? 3 * (1 - reach) : 0, p, a, k > 0.35 ? (k - 0.35) / 0.4 : -1);
    });
    if (k > 0.35 && k < 0.6) star(L.air, at.x, at.y - 15, heavy ? 4 : 3, p, 1);
    L.light(at.x, at.y - 14, 18, p.light, 0.6 * a);
  });
  s.add(0.01, () => {}, 0.12, () => s.sparks(at.x, at.y, heavy ? 6 : 3, p.tints, { speed: 22, up: 20, z: 15, dir: th + Math.PI, cone: 0.8, life: 0.3 }));
}

/** Sweeps of light round a spinning puppet: two crescents chasing round at radius r. */
function spinSweeps(L: Layers, x: number, y: number, r: number, t: number, p: Pal, a: number): void {
  for (let i = 0; i < 2; i++) {
    const th = t * 14 + i * Math.PI;
    for (let j = 0; j < 10; j++) {
      const tt = th - j * 0.12;
      const c = j < 2 ? p.core : j < 5 ? p.hot : p.mid;
      dot(L.air, x + Math.cos(tt) * r, y + Math.sin(tt) * r * 0.4, c, a * (1 - j / 12));
    }
  }
}

/** Pirouette: the puppet is let down on its strings onto the foe and spins there, sweeping everything round it. */
const pirouette = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.at;
    s.add(c.lead, (L, k) => {
      const e = easeOut(k);
      const py = y - 40 * (1 - e);
      shadowOf(L.ground, x, y, 6, e);
      for (const sd of [-2, 2]) string(L, x + sd * 2, py - 60, x + sd, py - 12, 0, p, 1, -1, true);
      puppet(L, x, py, p, 0, Math.min(1, k * 3));
      circle(L.ground, x, y, Math.max(8, c.r) * (1.2 - 0.2 * e), p.mid, e, FLAT);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.at;
    const R = Math.max(14, c.r);
    s.add(0.7, (L, k, t) => {
      const lift = k > 0.75 ? easeIn((k - 0.75) / 0.25) * 30 : 0;
      const a = tail(k, 0.75);
      for (const sd of [-2, 2]) string(L, x + sd * 2, y - 60 - lift, x + sd, y - 12 - lift, 0, p, a, -1, true);
      puppet(L, x, y - lift, p, t * 5, a);
      if (k < 0.75) {
        spinSweeps(L, x, y - 7, R * 0.7, t, p, 1);
        ring(L.ground, x, y, R * easeOut(k / 0.75), 1.5, p, 1 - k / 0.75);
      }
      L.light(x, y - 8, R * 2, p.light, 0.7 * a);
    });
    s.sparks(x, y, 8, [WOOD_LIT, WOOD, p.hot], { speed: 30, up: 18, z: 6, life: 0.4 });
    for (const h of c.hits) impact(s, h, p, 0.7);
  },
};

/** The Grand Finale: the puppet is hauled up out of sight; a ring marks where it falls, and it comes down twice its size, slams, and pirouettes through them all. */
const grandFinale = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(18, c.r);
    const up = c.lead * 0.45;
    const side = { x: c.from.x + 10, y: c.from.y };
    // Up and away on its strings.
    s.add(up, (L, k) => {
      const e = easeIn(k);
      const py = side.y - e * 90;
      for (const sd of [-2, 2]) string(L, side.x + sd * 2, py - 70, side.x + sd, py - 12, 0, p, 1, -1, true);
      puppet(L, side.x, py, p, k * 2);
    });
    // The landing marked: a ring tightening, a shadow growing; then the giant drops onto it.
    s.add(c.lead, (L, k, t) => {
      const e = easeOut(k);
      circle(L.ground, c.at.x, c.at.y, R * (1.5 - 0.5 * e), p.hot, Math.min(1, k * 3), FLAT, t * 3, t * 3 + Math.PI * 1.5);
      circle(L.ground, c.at.x, c.at.y, R * (1.2 - 0.3 * e), p.mid, Math.min(1, k * 3), FLAT, -t * 2, -t * 2 + Math.PI);
      shadowOf(L.ground, c.at.x, c.at.y, 12, e);
    });
    s.add(
      c.lead - up,
      (L, k) => {
        const e = easeIn(k);
        const py = c.at.y - 90 * (1 - e);
        for (const sd of [-3, 3]) string(L, c.at.x + sd * 2, py - 80, c.at.x + sd * 1.5, py - 24, 0, p, 1, -1, true);
        puppet(L, c.at.x, py, p, 0, 1, 2);
      },
      up,
    );
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.at;
    const R = Math.max(18, c.r);
    s.shake(200, 0.005);
    // The slam.
    s.add(0.45, (L, k) => {
      ring(L.ground, x, y, R * easeOut(k), 3, p, 1 - k);
      if (k < 0.3) star(L.air, x, y - 4, 6, p, 1);
      L.light(x, y - 12, R * 3, p.light, 1 - k);
    });
    smoke(s, c.at, 6, 0x7a6a5a, 4, 0.8, 2);
    s.sparks(x, y, 16, [WOOD_LIT, WOOD, p.hot, p.mid], { speed: 46, up: 30, z: 4, life: 0.5, spread: 6 });
    // The giant pirouettes, then shrinks back up with a bow (a dip before it goes).
    s.add(1.0, (L, k, t) => {
      const spin = k < 0.7 ? t * 6 : 0;
      const bow = k > 0.7 && k < 0.82 ? 2 : 0;
      const gone = k > 0.82 ? easeIn((k - 0.82) / 0.18) : 0;
      const a = 1 - gone;
      const py = y + bow - gone * 40;
      for (const sd of [-3, 3]) string(L, x + sd * 2, py - 80, x + sd * 1.5, py - 24, 0, p, a, -1, true);
      puppet(L, x, py, p, spin, a, 2);
      if (k < 0.7) {
        spinSweeps(L, x, y - 12, R * 0.9, t, p, 1);
        spinSweeps(L, x, y - 4, R * 0.75, t + 0.3, p, 1);
        ring(L.ground, x, y, R * (0.6 + 0.4 * Math.sin(t * 20) * 0.1), 1, p, 0.6, 0.5, Math.floor(t * 10));
      }
      L.light(x, y - 16, 40, p.light, 0.6 * a);
    });
    c.hits.forEach((h, i) => s.add(0.01, () => {}, 0.05 + i * 0.08, () => impact(s, h, p, 0.9)));
  },
};

// --- The Stringweaver ------------------------------------------------------------------------

/** A thread lashed out from her hand, a needle of light at its tip; it hangs taut a moment on the foe, then snaps. */
function threadShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const ax = a.x;
  const ay = a.y - HAND - 2;
  const pos = flight(a, b, 5);
  s.add(dur, (L, k) => {
    const q = pos(k);
    // The thread behind it, whipping as it unrolls.
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const r = pos(k * f);
      const w = Math.sin(f * Math.PI * 2 + k * 12) * 2 * (1 - k) * Math.sin(f * Math.PI);
      dot(L.air, r.x, r.y + w, i % 4 === 0 ? p.hot : THREAD);
    }
    dot(L.air, q.x, q.y, p.core, 1, 2);
    star(L.air, q.x, q.y, 2, p, 1);
    L.light(q.x, q.y, 14, p.light, 0.6);
  }, 0, () => {
    s.add(0.22, (L, k) => {
      if (k < 0.5) string(L, ax, ay, b.x, b.y - CHEST, 0, p, 1, k * 2);
      else {
        // Snapped: the two ends whip back and fade.
        const f = (k - 0.5) / 0.5;
        const mx = lerp(ax, b.x, 0.5);
        const my = lerp(ay, b.y - CHEST, 0.5);
        line(L.air, ax, ay, lerp(mx, ax, f), lerp(my, ay, f) + f * 4, THREAD, 1 - f);
        line(L.air, b.x, b.y - CHEST, lerp(mx, b.x, f), lerp(my, b.y - CHEST, f) + f * 4, THREAD, 1 - f);
      }
      L.light(b.x, b.y - CHEST, 18, p.light, 0.7 * (1 - k));
    });
    impact(s, b, p, 0.6);
  });
}

/** A web spun on the ground: spokes from the heart, a spiral wound round them, drawn out to `grow`. */
function web(px: Px, x: number, y: number, R: number, grow: number, p: Pal, a: number, rot = 0): void {
  if (R < 2 || a <= 0) return;
  const spokes = 8;
  for (let i = 0; i < spokes; i++) {
    const th = (i / spokes) * Math.PI * 2 + rot;
    line(px, x, y, x + Math.cos(th) * R * grow, y + Math.sin(th) * R * grow * FLAT, p.mid, a);
  }
  // The spiral, laid from the outside in as it grows.
  const turns = 3;
  const n = Math.ceil(spokes * turns * 4);
  for (let i = 0; i < n * grow; i++) {
    const f = i / n;
    const th = f * Math.PI * 2 * turns + rot;
    const r = R * (1 - f * 0.85);
    dot(px, x + Math.cos(th) * r, y + Math.sin(th) * r * FLAT, i % 6 === 0 ? p.core : p.hot, a);
  }
}

/** Snag: a web is spun on the ground under them; threads spring from it and wind round every foe on it. */
const snag = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(14, c.r);
    gather(s, c.from, p, Math.min(0.3, c.lead), 0.7);
    s.add(c.lead, (L, k, t) => web(L.ground, c.at.x, c.at.y, R, easeOut(k), p, 1, t * 0.5));
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(14, c.r);
    const hold = Math.max(0.6, c.stun || 1);
    s.add(0.6, (L, k, t) => {
      web(L.ground, c.at.x, c.at.y, R, 1, p, 1 - k, t * 0.5);
      // Threads spring up off the web and catch each foe.
      const reach = easeOut(Math.min(1, k / 0.25));
      c.hits.forEach((h, i) => {
        const th = hash(i, 3) * Math.PI * 2;
        const ox = c.at.x + Math.cos(th) * R * 0.6;
        const oy = c.at.y + Math.sin(th) * R * 0.6 * FLAT;
        string(L, ox, oy, lerp(ox, h.x, reach), lerp(oy, h.y - 10, reach), 0, p, tail(k, 0.4), k * 2);
      });
      L.light(c.at.x, c.at.y - 4, R * 2.2, p.light, 0.6 * (1 - k));
    });
    for (const h of c.hits) {
      bound(s, h, p, hold, 0.12);
      s.add(0.01, () => {}, 0.12, () => impact(s, h, p, 0.6));
    }
  },
};

/** The great control cross: two bars of light turning in the air, seen a little from above. */
function crossOver(L: Layers, x: number, y: number, len: number, rot: number, p: Pal, a: number): Pt[] {
  const ends: Pt[] = [];
  for (let i = 0; i < 4; i++) {
    const th = rot + (i / 4) * Math.PI * 2;
    ends.push({ x: x + Math.cos(th) * len, y: y + Math.sin(th) * len * 0.35 });
  }
  for (let i = 0; i < 2; i++) {
    const e0 = ends[i];
    const e1 = ends[i + 2];
    // A bar: a glowing heart line with a darker underside.
    line(L.air, e0.x, e0.y + 1, e1.x, e1.y + 1, p.deep, a);
    line(L.air, e0.x, e0.y, e1.x, e1.y, p.hot, a);
  }
  for (const e of ends) dot(L.air, e.x, e.y, p.core, a, 2);
  star(L.air, x, y, 3, p, a);
  L.light(x, y, len * 3, p.light, 0.6 * a);
  return ends;
}

/** Puppet Master: a great cross of light rises and turns over the foes; strings drop from it onto every one of them and haul them up; at the end every string is cut. */
const puppetMaster = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(24, c.r);
    gather(s, c.from, p, c.lead, 1.2);
    s.add(c.lead, (L, k, t) => {
      const e = easeOut(k);
      // Out of her hands and up over the field.
      const x = lerp(c.from.x, c.at.x, e);
      const y = lerp(c.from.y - HEAD, c.at.y - 52, e);
      crossOver(L, x, y, 6 + 12 * e, t * 2.5, p, Math.min(1, k * 4));
      web(L.ground, c.at.x, c.at.y, R * 0.6, e, p, 0.6 * k, -t * 0.4);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(24, c.r);
    const hold = Math.max(0.8, c.stun || 1);
    const cx = c.at.x;
    const cy = c.at.y - 52;
    s.shake(160, 0.004);
    s.add(hold + 0.25, (L, k, t) => {
      const cut = t > hold;
      const a = cut ? 1 - (t - hold) / 0.25 : 1;
      const ends = crossOver(L, cx, cy, 18, t * 1.2 + 0.5, p, a);
      const drop = easeOut(Math.min(1, t / 0.18));
      // A string from the nearest end of the cross to each foe, tugging them up.
      c.hits.forEach((h, i) => {
        let e = ends[0];
        for (const q of ends) if (Math.abs(q.x - h.x) < Math.abs(e.x - h.x)) e = q;
        const tug = Math.sin(t * 9 + i) * 1.5;
        const fx = h.x;
        const fy = h.y - 20 + tug;
        if (!cut) string(L, e.x, e.y, lerp(e.x, fx, drop), lerp(e.y, fy, drop), 0, p, 1, (t * 1.5 + i * 0.3) % 1);
        else {
          // Cut in the middle: both halves fall away.
          const f = (t - hold) / 0.25;
          const mx = lerp(e.x, fx, 0.5);
          const my = lerp(e.y, fy, 0.5);
          line(L.air, e.x, e.y, mx, my - f * 6, THREAD, 1 - f);
          line(L.air, fx, fy, mx, my + f * 8, THREAD, 1 - f);
        }
      });
      ring(L.ground, c.at.x, c.at.y, R, 1, p, 0.5 * a, 0.5, 9);
      if (k < 0.15) L.light(cx, cy, 80, p.light, 1 - k / 0.15);
    });
    c.hits.forEach((h, i) => {
      bound(s, h, p, hold, 0.15);
      s.add(0.01, () => {}, 0.15 + i * 0.03, () => impact(s, h, p, 0.8));
      // The snap of the string at the end.
      s.add(0.01, () => {}, hold, () => s.sparks(h.x, h.y, 4, [p.core, p.hot, THREAD], { speed: 20, up: 20, z: 24, life: 0.35 }));
    });
  },
};

export const SHOW_KITS: Record<string, Kit> = {
  'bard.minstrel': { shot: noteShot, skill: quickSong, ult: encore },
  'bard.drummer': { melee: beat, skill: greatBeat, ult: thunderOfWar },
  'puppeteer.marionette': { melee: stringPull, skill: pirouette, ult: grandFinale },
  'puppeteer.weaver': { shot: threadShot, skill: snag, ult: puppetMaster },
};
