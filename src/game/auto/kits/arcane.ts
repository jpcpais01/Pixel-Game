// The Arcane heroes' effects on the board: the Arcanist's crystal bolts,
// charged beam and Singularity; the Pyromancer's fireballs, meteor and
// Inferno; the Tidecaller's water bolts, tidal wave and Maelstrom; the
// Timekeeper's clock hands, stopped clock and Time Stop; the Paradox's rift
// shards, rewind and Legion of Echoes; the Scientist's tesla arcs, polarity
// orb and Chain Reaction.

import {
  angle,
  bolt,
  bump,
  CHEST,
  circle,
  column,
  disc,
  dist,
  dither,
  dot,
  easeIn,
  easeOut,
  fall,
  FLAT,
  hash,
  impact,
  lerp,
  line,
  mix,
  orb,
  ring,
  rune,
  shadowOf,
  sprite,
  star,
  stroke,
  tail,
  type Cast,
  type Kit,
  type Layers,
  type Pal,
  type Pt,
  type Stage,
} from '../paint';
import { castRune, flight, gather, HAND, motes, scorch, smoke, splash, trail } from './common';

// --- The Arcanist -----------------------------------------------------------------

/** A spinning shard of crystal light with a rune-dust tail. */
function crystalShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 2);
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    trail(L, pos, k, 6, 0.035, [p.hot, p.mid, p.mid, p.deep]);
    orb(L.air, q.x, q.y, 2.2, p);
    const spin = t * 18;
    for (let i = 0; i < 2; i++) {
      const th = spin + i * Math.PI;
      dot(L.air, q.x + Math.cos(th) * 3.5, q.y + Math.sin(th) * 2, p.core);
    }
    L.light(q.x, q.y, 16, p.light, 0.6);
  }, 0, () => impact(s, b, p, 0.8));
}

/** The charged beam: light gathers in the staff, then a beam lances out the whole length, pulsing, and thins away. */
const arcBeam = {
  cast(s: Stage, c: Cast): void {
    gather(s, c.from, c.pal, c.lead, 1.2);
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const a = { x: c.from.x, y: c.from.y - HAND };
    const b = { x: c.at.x, y: c.at.y - CHEST };
    const seed = Math.random() * 100;
    s.add(0.5, (L, k, t) => {
      const reach = easeOut(Math.min(1, k * 5));
      const e = { x: lerp(a.x, b.x, reach), y: lerp(a.y, b.y, reach) };
      const w = (k < 0.15 ? 3.5 : 3.5 * (1 - (k - 0.15) / 0.85)) * (1 + 0.15 * Math.sin(t * 60));
      if (w > 0.4) stroke(L.air, a.x, a.y, e.x, e.y, w, p, 1);
      // Runes ride the beam outward.
      for (let i = 0; i < 4; i++) {
        const f = (k * 2.5 + i / 4) % 1;
        if (f > reach) continue;
        const x = lerp(a.x, b.x, f);
        const y = lerp(a.y, b.y, f);
        star(L.air, x, y, 2, p, 1);
      }
      orb(L.air, a.x, a.y, 3 * (1 - k) + 1, p);
      if (reach >= 1 && k < 0.7) star(L.air, b.x, b.y, 4, p, 1);
      // Scorched line on the ground under it.
      for (let i = 0; i < 20; i++) {
        const f = i / 20;
        if (f > reach || hash(i, seed) > 0.6 * (1 - k)) continue;
        dot(L.ground, lerp(c.from.x, c.at.x, f), lerp(c.from.y, c.at.y, f), p.deep);
      }
      L.light(lerp(a.x, b.x, 0.5), lerp(a.y, b.y, 0.5), 50, p.light, 0.7 * (1 - k));
      L.light(e.x, e.y, 24, p.light, 0.8 * (1 - k));
    });
    for (const h of c.hits) impact(s, h, p, 1);
    s.sparks(b.x, c.at.y, 8, p.tints, { speed: 30, up: 20, z: CHEST });
  },
};

/** The Singularity: a rune opens on the spot, a black star swallows light and motes, then bursts in a nova. */
const singularity = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(14, c.r);
    gather(s, c.from, p, Math.min(0.4, c.lead), 1);
    const seed = Math.random() * 100;
    s.add(c.lead, (L, k, t) => {
      const x = c.at.x;
      const y = c.at.y;
      rune(L.ground, x, y, R * easeOut(Math.min(1, k * 3)), t * 1.5, p, 1);
      // Motes and streaks of light dragged in, round and round, into the star.
      const cy = y - 12;
      for (let i = 0; i < 14; i++) {
        const life = (k * 1.8 + hash(i, seed)) % 1;
        const th = hash(i, seed, 1) * Math.PI * 2 + life * 4;
        const d = (1 - easeIn(life)) * R * 1.1;
        const px = x + Math.cos(th) * d;
        const py = cy + Math.sin(th) * d * 0.7;
        const th2 = th - 0.4;
        const d2 = d + 4;
        line(L.air, px, py, x + Math.cos(th2) * d2, cy + Math.sin(th2) * d2 * 0.7, p.mid, 1);
        dot(L.air, px, py, p.core);
      }
      // The black star: a hole ringed in light, growing.
      const r = 2 + 4 * easeOut(k);
      circle(L.air, x, cy, r + 1.5, p.hot, 1, 1);
      circle(L.air, x, cy, r + 2.5, p.mid, 1, 1, t * 3, t * 3 + Math.PI * 1.3);
      disc(L.air, x, cy, r, r, 0x05030c, 1);
      L.light(x, cy, 30 + 20 * k, p.deep, 0.5);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(14, c.r);
    const x = c.at.x;
    const y = c.at.y;
    s.shake(160, 0.004);
    s.add(0.55, (L, k) => {
      ring(L.ground, x, y, R * easeOut(k), 3, p, 1 - k);
      ring(L.ground, x, y, R * 0.6 * easeOut(k), 1, p, (1 - k) * 0.8);
      // A sphere of light bursts out of the hole and dies away.
      const r = 9 * easeOut(Math.min(1, k * 3)) * (1 - k * 0.6);
      if (k < 0.6) orb(L.air, x, y - 12, r, p, 1 - k / 0.6);
      // Spokes of light.
      if (k < 0.35)
        for (let i = 0; i < 8; i++) {
          const th = (i / 8) * Math.PI * 2 + 0.2;
          const d0 = 4 + 30 * easeOut(k / 0.35);
          line(L.air, x + Math.cos(th) * d0 * 0.5, y - 12 + Math.sin(th) * d0 * 0.35, x + Math.cos(th) * d0, y - 12 + Math.sin(th) * d0 * 0.7, i % 2 ? p.hot : p.core, 1);
        }
      L.light(x, y - 12, R * 3 + 30, p.light, 1 - k);
    });
    s.sparks(x, y, 26, p.tints, { speed: 50, up: 30, z: 12, life: 0.6, spread: 6 });
    for (const h of c.hits) impact(s, h, p, 1.1);
  },
};

// --- The Pyromancer ---------------------------------------------------------------

/** A ball of fire, its flames licking back along the way it came, shedding embers. */
function fireShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 3);
  const th = angle(a, b);
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    // Tongues of flame behind it.
    for (let i = 1; i <= 7; i++) {
      const f = i / 7;
      const wob = Math.sin(t * 40 + i * 1.7) * f * 1.6;
      const x = q.x - Math.cos(th) * i * 1.4 - Math.sin(th) * wob;
      const y = q.y - Math.sin(th) * i * 1.4 + Math.cos(th) * wob - f * 1.5;
      dot(L.air, x, y, f < 0.3 ? p.hot : f < 0.65 ? p.mid : p.deep, 1, f < 0.5 ? 2 : 1);
    }
    orb(L.air, q.x, q.y, 2.4, p);
    if (Math.random() < 0.4) s.sparks(q.x, q.y + CHEST, 1, [p.hot, p.mid], { speed: 4, up: 10, g: -14, life: 0.35, z: CHEST });
    L.light(q.x, q.y, 18, p.light, 0.7);
  }, 0, () => {
    impact(s, b, p, 1);
    s.sparks(b.x, b.y, 6, [p.hot, p.mid, p.deep], { speed: 18, up: 24, g: 40, z: CHEST, life: 0.5 });
  });
}

/** A rock wreathed in fire, falling out of the sky at a slant. */
function meteorAt(s: Stage, at: Pt, R: number, p: Pal, dur: number, size: number, done?: () => void): void {
  const drift = 26 * size;
  fall(
    s,
    at,
    dur,
    90,
    (L, x, y, k) => {
      shadowOf(L.ground, at.x, at.y, R * 0.8, k);
      ring(L.ground, at.x, at.y, R * (1 - 0.15 * k), 1, p, 0.4 + 0.6 * k, 0.5, 3);
      // The burning tail, back up the way it came.
      for (let i = 1; i <= 16; i++) {
        const f = i / 16;
        const wob = Math.sin(k * 30 + i) * f * 1.4;
        dot(L.air, x + drift * 0.3 * f * 1.2 + wob, y - 12 - f * 22, f < 0.25 ? p.hot : f < 0.6 ? p.mid : p.deep, 1, f < 0.5 ? 3 : 2);
      }
      const r = 3.5 * size;
      orb(L.air, x, y - 12, r + 1, p);
      disc(L.air, x - 0.5, y - 12 + 0.5, r * 0.6, r * 0.6, 0x3a2420, 1);
      dot(L.air, x - 1, y - 13, p.hot, 1);
      L.light(x, y - 12, 26 * size, p.light, 0.8);
    },
    done,
    0,
    drift,
  );
}

/** Fire bursting from the ground: a flash, a rising plume, a ring and a scorch. */
function fireBurst(s: Stage, at: Pt, R: number, p: Pal, size: number): void {
  s.add(0.6, (L, k, t) => {
    ring(L.ground, at.x, at.y, R * easeOut(k), 2, p, 1 - k);
    const h = 30 * size * bump(Math.min(1, k * 1.5));
    if (k < 0.7) column(L.air, at.x, at.y, h, 5 * size * (1 - k * 0.6), p, 1 - k / 0.7, t);
    if (k < 0.3) orb(L.air, at.x, at.y - 6, 8 * size * easeOut(k / 0.3), p);
    L.light(at.x, at.y - 10, 50 * size, p.light, 1 - k);
  });
  scorch(s, at, R * 0.7, 1.6);
  smoke(s, at, Math.round(3 + 3 * size), 0x4a3a40, 3, 1, 10);
  s.sparks(at.x, at.y, Math.round(12 * size), [p.core, p.hot, p.mid, p.deep], { speed: 34, up: 50, g: 90, life: 0.7, z: 4, spread: R * 0.4 });
}

const meteor = {
  cast(s: Stage, c: Cast): void {
    gather(s, c.from, c.pal, Math.min(0.3, c.lead), 0.8);
    meteorAt(s, c.at, Math.max(12, c.r), c.pal, c.lead, 1);
  },
  hit(s: Stage, c: Cast): void {
    s.shake(110, 0.003);
    fireBurst(s, c.at, Math.max(12, c.r), c.pal, 1);
  },
};

/** The Inferno: pillars of fire bursting up one after another along the aim, the last the greatest. */
const inferno = {
  cast(s: Stage, c: Cast): void {
    gather(s, c.from, c.pal, c.lead, 1.4);
    castRune(s, c.from, c.pal, c.lead + 0.2, 10);
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const n = 5;
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      const at = { x: lerp(c.from.x, c.at.x, f), y: lerp(c.from.y, c.at.y, f) };
      const size = 0.7 + 0.5 * f;
      s.add(0.01, () => {}, (i - 1) * 0.07, () => {
        fireBurst(s, at, 10 * size, p, size);
        if (i === n) s.shake(150, 0.004);
      });
    }
  },
};

// --- The Tidecaller ----------------------------------------------------------------

/** A bolt of water: a clear bead wobbling as it flies, dripping, bursting in a splash. */
function waterShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 3);
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    trail(L, pos, k, 5, 0.04, [p.core, p.hot, p.mid]);
    const w = 2.4 + Math.sin(t * 30) * 0.6;
    disc(L.air, q.x, q.y, w, 4.6 - w, p.mid, 1);
    disc(L.air, q.x - 0.5, q.y - 0.5, w * 0.55, (4.6 - w) * 0.55, p.hot, 1);
    dot(L.air, q.x - 1, q.y - 1, p.core);
    if (Math.random() < 0.3) s.sparks(q.x, q.y + CHEST, 1, [p.hot], { speed: 2, up: 0, g: 120, life: 0.3, z: CHEST });
    L.light(q.x, q.y, 14, p.light, 0.5);
  }, 0, () => {
    splash(s, b, p, 9, 26, CHEST);
    s.add(0.3, (L, k) => ring(L.ground, b.x, b.y, 3 + 8 * easeOut(k), 1, p, 1 - k));
  });
}

/** The wave's face: a curl of water with foam on its crest, moving along `dir`. */
function waveFace(L: Layers, x: number, y: number, dir: number, w: number, h: number, p: Pal, t: number): void {
  const nx = -Math.sin(dir);
  const ny = Math.cos(dir) * FLAT;
  for (let j = -w; j <= w; j++) {
    const bx = x + nx * j;
    const by = y + ny * j;
    const hh = h * (1 - Math.pow(Math.abs(j) / (w + 1), 2)) * (0.85 + 0.15 * Math.sin(t * 20 + j));
    for (let z = 0; z < hh; z++) {
      const f = z / hh;
      const c = f > 0.86 ? p.core : f > 0.6 ? p.hot : f > 0.25 ? p.mid : p.deep;
      dot(L.air, bx + Math.cos(dir) * f * 3, by - z, c);
    }
    // The curl tipping forward.
    dot(L.air, bx + Math.cos(dir) * 4, by - hh, p.core);
    dot(L.air, bx + Math.cos(dir) * 5, by - hh + 1, p.hot);
  }
}

const tidalWave = {
  cast(s: Stage, c: Cast): void {
    gather(s, c.from, c.pal, c.lead, 1);
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const dir = angle(c.from, c.at);
    const len = dist(c.from, c.at);
    s.add(0.55, (L, k, t) => {
      const f = easeOut(k);
      const x = c.from.x + Math.cos(dir) * len * f;
      const y = c.from.y + Math.sin(dir) * len * f;
      // Wet ground behind it.
      for (let i = 0; i < 14; i++) {
        const g = (i / 14) * f;
        const wx = c.from.x + Math.cos(dir) * len * g;
        const wy = c.from.y + Math.sin(dir) * len * g;
        disc(L.ground, wx, wy, 6, 3, p.deep, (1 - k) * 0.8);
      }
      waveFace(L, x, y, dir, 7, 12 * (1 - k * 0.5), p, t);
      L.light(x, y - 6, 30, p.light, 0.6 * (1 - k));
      if (Math.random() < 0.6) splash(s, { x, y }, p, 2, 16, 8);
    });
    for (const h of c.hits) splash(s, h, p, 6, 22, 6);
  },
};

/** The Maelstrom: the sea opens into a whirlpool on the spot; then its eye bursts upward in a spout. */
const maelstrom = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(14, c.r);
    gather(s, c.from, p, Math.min(0.4, c.lead), 1);
    s.add(c.lead + 0.35, (L, k, t) => {
      const open = easeOut(Math.min(1, k * 2.5));
      const fade = k > 0.85 ? (1 - k) / 0.15 : 1;
      whirl(L, c.at.x, c.at.y, R * open, p, t, fade);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.at;
    s.shake(180, 0.004);
    s.add(0.7, (L, k, t) => {
      const e = k;
      const h = 56 * bump(Math.min(1, e * 1.6)) * (e < 0.3 ? 1 : 1 - (e - 0.3) * 0.6);
      column(L.air, x, y + 1, h, 5 + 2 * (1 - e), p, 1 - e * e, t);
      ring(L.ground, x, y, Math.max(14, c.r) * easeOut(k), 2, p, 1 - k);
      L.light(x, y - 20, 70, p.light, 1 - k);
    });
    for (let i = 0; i < 3; i++) splash(s, { x, y }, p, 10, 40, 30 + i * 8);
    for (const h of c.hits) splash(s, h, p, 6, 20, 10);
  },
};

/** A whirlpool: arms of foam spiralling into a dark eye. */
function whirl(L: Layers, x: number, y: number, r: number, p: Pal, t: number, fade: number): void {
  if (r < 2 || fade <= 0) return;
  const spin = t * 6;
  const ry = Math.ceil(r * FLAT);
  for (let oy = -ry; oy <= ry; oy++) {
    for (let ox = -Math.ceil(r); ox <= Math.ceil(r); ox++) {
      const d = Math.hypot(ox, oy / FLAT) / r;
      if (d > 1) continue;
      const px = Math.round(x + ox);
      const py = Math.round(y + oy);
      if (d > 0.78 && dither(px, py) >= ((1 - d) / 0.22) * fade) continue;
      if (d < 0.8 && fade < 1 && dither(px, py) >= fade) continue;
      const th = Math.atan2(oy / FLAT, ox);
      const v = 0.5 + 0.5 * Math.sin(th * 3 + d * 9 - spin);
      let col: number;
      if (d < 0.16) col = 0x040a14;
      else if (v > 0.9 && d > 0.2) col = p.core;
      else if (v > 0.68) col = p.hot;
      else if (v > 0.3 || d > 0.85) col = p.mid;
      else col = p.deep;
      L.ground.put(px, py, col, 1);
    }
  }
  L.light(x, y - 4, r * 2.4, p.light, 0.35 * fade);
}

// --- The Timekeeper --------------------------------------------------------------------

/** A clock hand, spinning end over end, with a gleam at its tip. */
function handShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 2);
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    const th = t * 22;
    const cx = Math.cos(th);
    const sy = Math.sin(th);
    line(L.air, q.x - cx * 2, q.y - sy * 2, q.x + cx * 4, q.y + sy * 4, p.mid);
    line(L.air, q.x, q.y, q.x + cx * 4, q.y + sy * 4, p.hot);
    dot(L.air, q.x + cx * 4.5, q.y + sy * 4.5, p.core);
    dot(L.air, q.x, q.y, p.deep, 1, 2);
    for (let i = 1; i <= 3; i++) circle(L.air, q.x, q.y, 3 + i, mix(p.mid, p.deep, i / 3), 1, 1, th - 0.4 - i * 0.5, th - i * 0.5);
    L.light(q.x, q.y, 14, p.light, 0.5);
  }, 0, () => impact(s, b, p, 0.7));
}

/** A clock face on the ground: rim, hour marks, numerals as dots, and two hands. */
function clockFace(L: Layers, x: number, y: number, r: number, p: Pal, hour: number, minute: number, a = 1): void {
  if (r < 3) return;
  ring(L.ground, x, y, r, 1.2, p, a);
  circle(L.ground, x, y, r * 0.78, p.deep, a > 0.5 ? 1 : a, FLAT);
  for (let i = 0; i < 12; i++) {
    const th = (i / 12) * Math.PI * 2;
    const x0 = x + Math.cos(th) * r * 0.82;
    const y0 = y + Math.sin(th) * r * 0.82 * FLAT;
    if (i % 3 === 0) {
      star(L.ground, x0, y0, 1, p, a);
    } else dot(L.ground, x0, y0, p.hot, a);
  }
  const hand = (th: number, len: number, c: number) => line(L.ground, x, y, x + Math.cos(th) * len, y + Math.sin(th) * len * FLAT, c, a);
  hand(hour - Math.PI / 2, r * 0.45, p.hot);
  hand(minute - Math.PI / 2, r * 0.7, p.core);
  dot(L.ground, x, y, p.core, a, 2);
}

/** A great bell's chime: rings of light rolling out from a spot, a flash of white. */
function chime(s: Stage, at: Pt, R: number, p: Pal): void {
  for (let i = 0; i < 3; i++)
    s.add(0.45, (L, k) => ring(L.ground, at.x, at.y, R * (0.4 + 0.8 * easeOut(k)), 1, p, 1 - k), i * 0.08);
  s.add(0.3, (L, k) => L.light(at.x, at.y - 8, R * 3, p.light, 1 - k));
}

/** A frozen foe: a ring of still sand-glass motes round it. */
function frozen(s: Stage, at: Pt, p: Pal, sec: number): void {
  s.add(sec, (L, k, t) => {
    const a = tail(k, 0.8);
    for (let i = 0; i < 6; i++) {
      const th = (i / 6) * Math.PI * 2 + t * 0.6;
      dot(L.air, at.x + Math.cos(th) * 7, at.y - 12 + Math.sin(th) * 3, i % 2 ? p.hot : p.mid, a);
    }
    circle(L.ground, at.x, at.y, 7, p.mid, a, FLAT);
  });
}

const stoppedClock = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(12, c.r);
    gather(s, c.from, p, c.lead, 0.8);
    s.add(c.lead, (L, k) => {
      const r = R * easeOut(Math.min(1, k * 2.5));
      // The minute hand sweeps a full turn up to the stroke.
      clockFace(L, c.at.x, c.at.y, r, p, k * Math.PI * 0.6, easeIn(k) * Math.PI * 2, 1);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(12, c.r);
    s.add(0.6, (L, k) => clockFace(L, c.at.x, c.at.y, R, p, Math.PI * 0.6, Math.PI * 2, 1 - k));
    chime(s, c.at, R, p);
    for (const h of c.hits) frozen(s, h, p, c.stun || 1);
  },
};

/** Time Stop: a great clock laid on the ground round him; everything under it stands still until the hour strikes. */
const timeStop = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(30, c.r);
    gather(s, c.from, p, c.lead, 1.4);
    s.add(c.lead, (L, k, t) => {
      const r = R * easeOut(k);
      clockFace(L, c.from.x, c.from.y, r, p, t * 2, t * 14, 1);
      rune(L.ground, c.from.x, c.from.y, r * 0.35, t * 3, p, 1);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(30, c.r);
    const hold = Math.max(0.8, c.stun);
    // The hands stand still at the hour, and the world under them goes grey-gold.
    s.add(hold, (L, k) => {
      const a = tail(k, 0.75);
      clockFace(L, c.from.x, c.from.y, R, p, 0, 0, a);
      rune(L.ground, c.from.x, c.from.y, R * 0.35, 0, p, a);
      if (k < 0.12) L.light(c.from.x, c.from.y - 10, R * 3, p.light, 1 - k / 0.12);
    });
    chime(s, c.from, R, p);
    s.shake(140, 0.003);
    for (const h of c.hits) frozen(s, h, p, hold);
  },
};

// --- The Paradox ------------------------------------------------------------------------

/** A shard of rift: a violet diamond spinning, a crack of light behind it. */
function riftShard(L: Layers, x: number, y: number, t: number, p: Pal, s = 1): void {
  const w = Math.abs(Math.cos(t * 14)) * 2 * s + 0.5;
  const h = 3.2 * s;
  for (let j = -Math.ceil(h); j <= Math.ceil(h); j++) {
    const ww = w * (1 - Math.abs(j) / (h + 0.5));
    for (let i = -Math.ceil(ww); i <= Math.ceil(ww); i++) dot(L.air, x + i, y + j, i < 0 ? p.mid : j < 0 ? p.hot : p.deep);
  }
  dot(L.air, x, y - 1, p.core);
}

function shardShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 2);
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    // A crack in the air left behind it, flickering.
    for (let i = 1; i <= 5; i++) {
      const r = pos(Math.max(0, k - i * 0.04));
      if (hash(i, Math.floor(t * 30)) < 0.7) dot(L.air, r.x + (hash(i, 7) - 0.5) * 2, r.y, i < 3 ? p.hot : p.deep);
    }
    riftShard(L, q.x, q.y, t, p);
    L.light(q.x, q.y, 14, p.light, 0.5);
  }, 0, () => impact(s, b, p, 0.8));
}

/** A ghost of the hero from another moment: a hooded figure of violet light, dithered. */
const ECHO = [
  '..aa..',
  '.abba.',
  '.bccb.',
  'abccba',
  '.bbbb.',
  'abbbba',
  'abbbba',
  '.bbbb.',
  '.b..b.',
  '.b..b.',
];

function echo(L: Layers, x: number, y: number, p: Pal, a: number): void {
  sprite(L.air, x, y, ECHO, { a: p.deep, b: p.mid, c: p.core }, a, { s: 2, ay: ECHO.length });
}

/** Rewind: time runs back round him, a turning spiral and echoes of himself sliding back into place. */
const rewind = {
  cast(s: Stage, c: Cast): void {
    castRune(s, c.from, c.pal, c.lead + 0.6, 12);
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.from;
    s.add(0.8, (L, k, t) => {
      // A spiral of light winding back inward (counter to a clock).
      for (let i = 0; i < 26; i++) {
        const f = i / 26;
        const th = -t * 8 - f * Math.PI * 3;
        const d = 3 + f * 14 * (1 - k * 0.5);
        dot(L.air, x + Math.cos(th) * d, y - 12 + Math.sin(th) * d * 0.6, f < 0.3 ? p.core : f < 0.6 ? p.hot : p.mid, tail(k, 0.6));
      }
      // Two echoes slide back into him.
      for (const side of [-1, 1]) echo(L, x + side * 14 * (1 - easeOut(k)), y, p, 0.6 * (1 - k));
      L.light(x, y - 12, 40, p.light, 0.6 * (1 - k));
    });
    motes(s, c.from, [p.core, p.hot, 0xd8ffd0], 10, 12);
    for (const h of c.hits) motes(s, h, [0xd8ffd0, p.hot], 4, 8);
  },
};

/** The Legion of Echoes: four of himself step out round him and throw rift shards at foe after foe, then fold back in. */
const legion = {
  cast(s: Stage, c: Cast): void {
    gather(s, c.from, c.pal, c.lead, 1.2);
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.from;
    const spots = [
      { x: x - 18, y: y - 4 },
      { x: x + 18, y: y - 4 },
      { x: x - 10, y: y + 6 },
      { x: x + 10, y: y + 6 },
    ];
    const life = c.span + 0.5;
    s.add(life, (L, k) => {
      const a = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
      spots.forEach((e, i) => {
        const back = k > 0.85 ? easeIn((k - 0.85) / 0.15) : 0;
        const ex = lerp(e.x, x, back);
        const ey = lerp(e.y, y, back);
        circle(L.ground, ex, ey, 5, p.mid, a, FLAT);
        echo(L, ex, ey + Math.sin(k * 20 + i) * 0.5, p, a * 0.85);
      });
    });
    c.path.forEach((to, i) => {
      const e = spots[i % spots.length];
      const wait = Math.max(0, (c.span * i) / Math.max(1, c.path.length) - 0.12);
      s.add(0.01, () => {}, wait, () => shardShot(s, { x: e.x, y: e.y - 6 }, to, 0.12, p));
    });
    s.add(0.4, (L, k) => {
      ring(L.ground, x, y, 26 * easeOut(k), 2, p, 1 - k);
      L.light(x, y - 12, 60, p.light, 1 - k);
    }, life - 0.15);
  },
};

// --- The Scientist ------------------------------------------------------------------------

/** A tesla arc from the coil to the foe: forked, crackling, there at once. */
function teslaShot(s: Stage, a: Pt, b: Pt, _dur: number, p: Pal): void {
  const x0 = a.x;
  const y0 = a.y - HAND - 2;
  const x1 = b.x;
  const y1 = b.y - CHEST;
  s.add(0.2, (L, k, t) => {
    const seed = Math.floor(t * 40);
    bolt(L.air, x0, y0, x1, y1, p, seed, 1);
    // A fork off the middle.
    const mx = lerp(x0, x1, 0.55);
    const my = lerp(y0, y1, 0.55);
    if (hash(seed, 3) > 0.4) bolt(L.air, mx, my, mx + (hash(seed, 4) - 0.5) * 14, my + 6 + hash(seed, 5) * 6, p, seed + 9, 1);
    star(L.air, x1, y1, 3, p, 1 - k);
    L.light(x1, y1, 22, p.light, 0.9 * (1 - k));
    L.light(x0, y0, 14, p.light, 0.6 * (1 - k));
  });
  s.sparks(b.x, b.y, 5, p.tints, { speed: 30, up: 18, z: CHEST, life: 0.3 });
}

/** A ball split into + and − halves, its field lines bending round it. */
function polarity(L: Layers, x: number, y: number, r: number, t: number, p: Pal): void {
  const red = 0xff5a5a;
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++)
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      const d = Math.hypot(dx, dy) / r;
      if (d > 1) continue;
      const th = Math.atan2(dy, dx) + t * 6;
      const side = Math.cos(th) > 0;
      const c = d < 0.35 ? 0xffffff : side ? (d < 0.7 ? p.hot : p.mid) : d < 0.7 ? 0xffb0a8 : red;
      dot(L.air, x + dx, y + dy, c);
    }
  for (let i = 0; i < 3; i++) circle(L.air, x, y, r + 2 + i * 2, i % 2 ? red : p.mid, 1, 0.55, t * 4 + i, t * 4 + i + 1.4);
}

const polarityOrb = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const a = { x: c.from.x, y: c.from.y };
    const b = c.at;
    const R = Math.max(12, c.r);
    s.add(c.lead, (L, k, t) => {
      const f = easeOut(k);
      const x = lerp(a.x, b.x, f);
      const y = lerp(a.y, b.y, f) - HAND - Math.sin(f * Math.PI) * 26 + f * (HAND - 6);
      polarity(L, x, y, 3, t, p);
      shadowOf(L.ground, lerp(a.x, b.x, f), lerp(a.y, b.y, f), 4, f);
      circle(L.ground, b.x, b.y, R * (0.6 + 0.4 * f), p.mid, 1, FLAT, t * 3, t * 3 + Math.PI);
      circle(L.ground, b.x, b.y, R * (0.6 + 0.4 * f), 0xff5a5a, 1, FLAT, t * 3 + Math.PI, t * 3 + Math.PI * 2);
      L.light(x, y, 18, p.light, 0.6);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(12, c.r);
    s.add(0.35, (L, k, t) => {
      const seed = Math.floor(t * 40);
      for (let i = 0; i < 7; i++) {
        const th = (i / 7) * Math.PI * 2 + hash(i, seed) * 0.6;
        bolt(L.air, c.at.x, c.at.y - 6, c.at.x + Math.cos(th) * R, c.at.y + Math.sin(th) * R * FLAT - 2, p, seed + i, 1 - k);
      }
      ring(L.ground, c.at.x, c.at.y, R * easeOut(k), 1, p, 1 - k);
      L.light(c.at.x, c.at.y - 6, R * 3, p.light, 1 - k);
    });
    s.sparks(c.at.x, c.at.y, 14, [p.core, p.hot, 0xff8a7a], { speed: 40, up: 30, z: 6 });
    for (const h of c.hits) impact(s, h, p, 0.7);
  },
};

/** Tiny chalk letters, three wide and five tall: E = m c 2. */
const CHALK: string[][] = [
  ['###', '#..', '##.', '#..', '###'],
  ['...', '###', '...', '###', '...'],
  ['...', '#.#', '###', '#.#', '#.#'],
  ['...', '.##', '#..', '#..', '.##'],
  ['##.', '..#', '.#.', '#..', '###'],
];

/** The Chain Reaction: an atom forms over the first foe, electrons whirling, arcs lash out along the chain, and it splits. */
const chainReaction = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    gather(s, c.from, p, c.lead, 1.3);
    s.add(c.lead, (L, k, t) => atom(L, c.at.x, c.at.y - 26, 4 + 6 * easeOut(k), t * (6 + 20 * k), p, 1));
    if (c.look === 'einstein') {
      // The equation chalked in the air over him.
      s.add(c.lead + 1, (L, k) => {
        const a = k < 0.2 ? k / 0.2 : tail(k, 0.7);
        let x = c.from.x - 13;
        const y = c.from.y - 42;
        CHALK.forEach((g, i) => {
          if (k * 6 < i) return;
          g.forEach((row, j) => [...row].forEach((ch, ii) => ch === '#' && dot(L.air, x + ii, y + j - (i === 4 ? 2 : 0), 0xf4f0e0, a)));
          x += i === 4 ? 4 : 5;
        });
      });
    }
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const top = { x: c.at.x, y: c.at.y - 26 };
    const pts = c.path.length ? c.path : c.hits;
    s.add(0.5, (L, k, t) => {
      if (k < 0.5) atom(L, top.x, top.y, 10 * (1 + k), t * 40, p, 1 - k * 2);
      const seed = Math.floor(t * 30);
      // Arcs lash from the atom to each foe, and on from one to the next.
      pts.forEach((h, i) => {
        if (k * 5 < i * 0.5) return;
        const from = i === 0 ? top : { x: pts[i - 1].x, y: pts[i - 1].y - CHEST };
        bolt(L.air, from.x, from.y, h.x, h.y - CHEST, p, seed + i * 7, tail(k, 0.6));
        if (i === 0) bolt(L.air, top.x, top.y, h.x, h.y - CHEST, p, seed + 50, tail(k, 0.6));
        L.light(h.x, h.y - CHEST, 20, p.light, 0.7 * (1 - k));
      });
      L.light(top.x, top.y, 40, p.light, 1 - k);
    });
    // The split: a blinding flash and a ring of force.
    s.add(0.45, (L, k) => {
      ring(L.ground, c.at.x, c.at.y, 30 * easeOut(k), 2, p, 1 - k);
      if (k < 0.3) orb(L.air, top.x, top.y, 10 * easeOut(k / 0.3), p);
      L.light(top.x, top.y, 90, p.light, 1 - k);
    }, 0.25);
    s.shake(160, 0.004);
    pts.forEach((h, i) => s.add(0.01, () => {}, i * 0.05, () => impact(s, h, p, 0.9)));
  },
};

/** An atom: a bright nucleus with three electrons on tilted orbits. */
function atom(L: Layers, x: number, y: number, r: number, spin: number, p: Pal, a: number): void {
  if (a <= 0) return;
  for (let o = 0; o < 3; o++) {
    const tilt = (o / 3) * Math.PI;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const n = Math.ceil(r * 7);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const ex = Math.cos(th) * r;
      const ey = Math.sin(th) * r * 0.35;
      if (dither(i, o) >= a) continue;
      dot(L.air, x + ex * ct - ey * st, y + ex * st + ey * ct, p.mid);
    }
    const th = spin * (1 + o * 0.3) + o * 2;
    const ex = Math.cos(th) * r;
    const ey = Math.sin(th) * r * 0.35;
    dot(L.air, x + ex * ct - ey * st, y + ex * st + ey * ct, p.core, a, 2);
  }
  orb(L.air, x, y, Math.max(1.5, r * 0.28), p, a);
  L.light(x, y, r * 4, p.light, 0.6 * a);
}

export const ARCANE_KITS: Record<string, Kit> = {
  'wizard.arcane': { shot: crystalShot, skill: arcBeam, ult: singularity },
  'wizard.pyro': { shot: fireShot, skill: meteor, ult: inferno },
  'wizard.tide': { shot: waterShot, skill: tidalWave, ult: maelstrom },
  'chronomancer.keeper': { shot: handShot, skill: stoppedClock, ult: timeStop },
  'chronomancer.paradox': { shot: shardShot, skill: rewind, ult: legion },
  'inventor.scientist': { shot: teslaShot, skill: polarityOrb, ult: chainReaction },
};
