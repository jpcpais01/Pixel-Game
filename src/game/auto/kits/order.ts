// The Order heroes' effects on the board: the Arbalest's steel bolts, net bolt
// and Black Powder; the Knight's sword cuts, fire whirlwind and Skybreaker;
// the King's greatsword, Royal Decree and Crown of Kings; the Paladin's
// smite, consecrated ground and Heaven's Light; the Crusader's hammer,
// Sunfire and Wrath of the Sun; the Jedi's saber, Force push and Saber
// Cyclone; the Spearmaiden's spear, spear of light and Spear of Odin; and the
// Stormwing's lightning spear, Thunder dive and Thunder of Asgard.

import {
  angle,
  arc,
  bolt,
  bump,
  CHEST,
  circle,
  clamp01,
  column,
  dark,
  disc,
  dist,
  dither,
  dot,
  easeIn,
  easeOut,
  FLAT,
  hash,
  HEAD,
  impact,
  lerp,
  line,
  mix,
  orb,
  pool,
  ring,
  rune,
  shadowOf,
  shock,
  sprite,
  star,
  stroke,
  tail,
  type Cast,
  type Kit,
  type Layers,
  type Pal,
  type Pt,
  type Px,
  type Stage,
} from '../paint';
import { barrier, castRune, flight, gather, HAND, motes, plus, scorch, smoke, trail } from './common';

// --- Shared by the Order ------------------------------------------------------------

/** Steel and wood for the bolts, hilts and kegs: materials, not light, so skins leave them be. */
const STEEL = [0xf2f6fc, 0xc4ccd8, 0x8a94a6, 0x4a5262];
const WOOD = [0xc89058, 0x9a6438, 0x6a4022];
const FLETCH = 0xe8664a;
const ROPE = [0xd8c49a, 0xa88c62, 0x6a5438];
const ROCK = [0xb8a890, 0x7a6a58, 0x4a4038];
const SOOT = 0x241c20;

/** The same light burning as fire: the heart stays the hero's, the edges run to orange and red (the Knight's whirlwind, the Crusader's sun). */
function fireOf(p: Pal): Pal {
  const mid = mix(p.mid, 0xff8a2a, 0.55);
  const deep = mix(p.deep, 0xc8401e, 0.55);
  return { core: p.core, hot: p.hot, mid, deep, light: mix(p.light, 0xff9a40, 0.45), tints: [p.core, p.hot, mid, deep] };
}

/** Each melee hero alternates forehand and backhand, so a flurry reads as one. */
let swing = 0;

/**
 * A blade's cut on the foe at `at`, struck from `from`: a crescent swept
 * round the striker's chest through the foe, the leading edge flashing as it
 * goes, then dithering away. `w` is how thick the blade's light is, `span`
 * how wide the swing (radians), `flip` the backhand.
 */
function slash(s: Stage, from: Pt, at: Pt, p: Pal, o: { w?: number; span?: number; flip?: boolean; dur?: number; reach?: number; lift?: number } = {}): void {
  const sq = 0.7;
  const cx = from.x;
  const cy = from.y - CHEST - (o.lift ?? 0);
  const tx = at.x - cx;
  const ty = at.y - CHEST - cy;
  const th = Math.atan2(ty / sq, tx);
  const r = Math.max(13, Math.hypot(tx, ty / sq) + (o.reach ?? 4));
  const span = o.span ?? 1.9;
  const dirn = o.flip ? -1 : 1;
  const a0 = th - (span / 2) * dirn;
  const a1 = th + (span / 2) * dirn;
  const w = o.w ?? 3;
  s.add(o.dur ?? 0.24, (L, k) => {
    const sweep = easeOut(Math.min(1, k / 0.4));
    const fade = k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55;
    const head = a0 + (a1 - a0) * sweep;
    // The light of the blade lags its edge: the cut is drawn from a little behind the head.
    const back = a0 + (a1 - a0) * Math.max(0, sweep - 0.85) * (k > 0.45 ? (k - 0.45) / 0.55 : 0);
    if (head !== back) arc(L.air, cx, cy, r, w, back, head, p, fade, sq);
    if (k < 0.4) star(L.air, cx + Math.cos(head) * r, cy + Math.sin(head) * r * sq, 2, p, 1);
    L.light(at.x, at.y - CHEST, 18 + w * 3, p.light, 0.6 * (1 - k));
  });
}

/**
 * A straight lunge: a streak of light from near the striker through the foe
 * and `over` px past it, its point leading and its back drawn after it.
 */
function thrust(s: Stage, from: Pt, at: Pt, p: Pal, w = 2, over = 7, dur = 0.24): void {
  const th = angle(from, at);
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  const x0 = from.x + ux * 6;
  const y0 = from.y - CHEST + uy * 4;
  const x1 = at.x + ux * over;
  const y1 = at.y - CHEST + uy * over * FLAT;
  s.add(dur, (L, k) => {
    const out = easeOut(Math.min(1, k / 0.3));
    const back = easeIn(clamp01((k - 0.25) / 0.75));
    const tx = lerp(x0, x1, out);
    const ty = lerp(y0, y1, out);
    const bx = lerp(x0, x1, back);
    const by = lerp(y0, y1, back);
    if (Math.hypot(tx - bx, ty - by) > 1) stroke(L.air, bx, by, tx, ty, w * (1 - back * 0.5), p, 1, 0.85);
    if (k < 0.45) star(L.air, tx, ty, 3, p, 1);
    L.light(tx, ty, 20, p.light, 0.7 * (1 - k));
  });
  s.sparks(at.x, at.y, 6, p.tints, { speed: 34, up: 16, life: 0.3, z: CHEST, dir: th, cone: 0.5 });
}

/** A flame tongue standing on (x, y): `h` tall, flickering with `t`. */
function tongue(px: Px, x: number, y: number, h: number, p: Pal, t: number, seed: number): void {
  const hh = h * (0.7 + 0.3 * Math.sin(t * 24 + seed * 3.1));
  for (let z = 0; z < hh; z++) {
    const f = z / hh;
    const wob = Math.round(Math.sin(t * 18 + seed + z * 0.7) * f * 1.2);
    px.put(Math.round(x + wob), Math.round(y - z), f < 0.25 ? p.core : f < 0.5 ? p.hot : f < 0.8 ? p.mid : p.deep, 1);
    if (f < 0.4) px.put(Math.round(x + wob + 1), Math.round(y - z), p.mid, 1);
  }
}

/**
 * A crescent of light whirling round a hero at chest height: the part on the
 * far side drawn under the heroes (behind), the near side over them.
 */
function orbit(L: Layers, cx: number, cy: number, r: number, w: number, a0: number, a1: number, p: Pal, a = 1): void {
  const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) * r * 1.3));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const th = a0 + (a1 - a0) * f;
    const near = Math.sin(th) > 0;
    const px = near ? L.air : L.ground;
    const ww = w * Math.sin(f * Math.PI);
    const steps = Math.max(1, Math.ceil(ww));
    for (let j = 0; j <= steps; j++) {
      const rr = r - (j / steps) * ww;
      const x = Math.round(cx + Math.cos(th) * rr);
      const y = Math.round(cy + Math.sin(th) * rr * FLAT);
      if (a < 1 && dither(x, y) >= a) continue;
      // The leading end burns brightest.
      px.put(x, y, shade4(p, (j / steps) * 0.7 + (1 - f) * 0.3), 1);
    }
  }
}

const shade4 = (p: Pal, u: number): number => (u < 0.28 ? p.core : u < 0.55 ? p.hot : u < 0.8 ? p.mid : p.deep);

/** Cracks of light running out from a blow into the ground, cooling as `cool` falls. */
function cracks(px: Px, x: number, y: number, n: number, len: number, seed: number, grow: number, cool: number, p: Pal): void {
  if (cool <= 0) return;
  for (let c = 0; c < n; c++) {
    const a = (c / n) * Math.PI * 2 + hash(c, seed) * 0.6;
    const l = len * (0.6 + 0.4 * hash(c, seed, 1));
    let qx0 = x;
    let qy0 = y;
    for (let i = 1; i <= 5; i++) {
      const f = i / 5;
      const wob = (hash(c, seed, i + 2) - 0.5) * 0.8;
      const qx = x + Math.cos(a + wob) * l * f * grow;
      const qy = y + Math.sin(a + wob) * l * f * grow * FLAT;
      line(px, qx0, qy0 + 1, qx, qy + 1, SOOT, cool);
      line(px, qx0, qy0, qx, qy, f < 0.5 ? p.hot : p.mid, cool);
      qx0 = qx;
      qy0 = qy;
    }
  }
}

/** A stroke of lightning out of the sky onto `at`, a crackling ring along the ground round it. */
function skyBolt(s: Stage, at: Pt, p: Pal, R: number): void {
  const lean = (Math.random() - 0.5) * 22;
  s.add(0.3, (L, k, t) => {
    const seed = Math.floor(t * 30);
    if (k < 0.55 && (k < 0.15 || hash(seed, 9) > 0.2)) {
      bolt(L.air, at.x + lean, at.y - 92, at.x, at.y - 2, p, seed, 1, 0.6);
      // A fork off the upper half, crackling the other way.
      const f = 0.35 + hash(seed, 2) * 0.2;
      const mx = lerp(at.x + lean, at.x, f);
      const my = lerp(at.y - 92, at.y, f);
      bolt(L.air, mx, my, mx - Math.sign(lean || 1) * (8 + hash(seed, 3) * 8), my + 12 + hash(seed, 4) * 8, p, seed + 5, 1);
      L.light(at.x, at.y - 40, 40, p.light, 0.8);
    }
    ring(L.ground, at.x, at.y, Math.max(3, R * easeOut(k)), 1.2, p, 1 - k, 0.45, seed);
    if (k < 0.35) {
      star(L.air, at.x, at.y - 3, Math.round(6 * (1 - k / 0.35)) + 1, p, 1);
      disc(L.ground, at.x, at.y, 6, 3.5, p.core, 1 - k / 0.35);
    }
    L.light(at.x, at.y - 6, R * 2 + 30, p.light, 1 - k);
  });
  s.sparks(at.x, at.y, 10, [p.core, p.hot, p.mid, 0xffffff], { speed: 36, up: 30, life: 0.4, z: 3 });
}

// --- The Arbalest --------------------------------------------------------------------

/** A crossbow bolt along (ux, uy): steel head, wooden shaft, red vanes. */
function drawBolt(px: Px, x: number, y: number, ux: number, uy: number, p: Pal): void {
  const nx = -uy;
  const ny = ux;
  for (let i = -8; i <= 0; i++) px.put(Math.round(x + ux * i), Math.round(y + uy * i), i < -4 ? WOOD[1] : WOOD[0], 1);
  for (const sd of [-1, 1]) for (let i = 7; i <= 8; i++) px.put(Math.round(x - ux * i + nx * sd * (i - 6)), Math.round(y - uy * i + ny * sd * (i - 6)), FLETCH, 1);
  // The broad head: a wedge of steel, its point lit in the hero's own colour.
  for (let i = 1; i <= 3; i++) {
    const hw = (3 - i) * 0.6;
    for (let o = -hw; o <= hw + 0.01; o += 0.5) px.put(Math.round(x + ux * i + nx * o), Math.round(y + uy * i + ny * o), o < 0 ? STEEL[0] : STEEL[2], 1);
  }
  px.put(Math.round(x + ux * 4), Math.round(y + uy * 4), p.core, 1);
}

/** The heavy bolt: flat and fast, with streaks of speed behind it, punching in with a spray of steel sparks. */
function arbalestShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 1);
  const th = angle({ x: a.x, y: a.y - CHEST }, { x: b.x, y: b.y - CHEST });
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  s.add(dur, (L, k) => {
    const q = pos(k);
    trail(L, pos, k, 6, 0.03, [p.hot, p.mid, p.deep]);
    drawBolt(L.air, q.x, q.y, ux, uy, p);
    L.light(q.x, q.y, 12, p.light, 0.4);
  }, 0, () => {
    impact(s, b, p, 0.7);
    s.sparks(b.x, b.y, 6, [STEEL[0], STEEL[1], p.hot], { speed: 30, up: 18, life: 0.3, z: CHEST, dir: th + Math.PI, cone: 0.9 });
    // The bolt left standing in the foe a breath.
    s.add(0.22, (L) => drawBolt(L.air, b.x - ux * 3, b.y - CHEST - uy * 3, ux, uy, p));
  });
}

/** The net: a mesh of rope over an ellipse with lead weights round its rim, `h` px off the ground as it drops. */
function drawNet(px: Px, x: number, y: number, R: number, h: number, a: number, wave: number): void {
  const ry = Math.ceil(R * FLAT);
  const rx = Math.ceil(R);
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const d = Math.hypot(dx, dy / FLAT) / R;
      if (d > 1) continue;
      const u = dx + dy * 2;
      const v = dx - dy * 2;
      const on = ((u % 6) + 6) % 6 === 0 || ((v % 6) + 6) % 6 === 0;
      if (!on && d < 0.95) continue;
      const X = Math.round(x + dx);
      const Y = Math.round(y + dy - h + Math.sin(dx * 0.4 + wave) * (h > 0 ? 1.2 : 0));
      if (a < 1 && dither(X, Y) >= a) continue;
      px.put(X, Y, d >= 0.95 ? ROPE[1] : dy > 0 ? ROPE[1] : ROPE[0], 1);
    }
  }
  for (let i = 0; i < 8; i++) {
    const th = (i / 8) * Math.PI * 2 + 0.2;
    const wx = Math.round(x + Math.cos(th) * R);
    const wy = Math.round(y + Math.sin(th) * R * FLAT - h);
    if (a < 1 && dither(wx, wy) >= a) continue;
    px.put(wx, wy, STEEL[2], 1);
    px.put(wx + 1, wy, STEEL[3], 1);
    px.put(wx, wy - 1, STEEL[1], 1);
    px.put(wx + 1, wy - 1, STEEL[2], 1);
  }
}

/** The net bolt: a canister-headed bolt lobbed over the crowd bursts above it, and a weighted net drops over everything below. */
const netBolt = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const pos = flight({ x: c.from.x, y: c.from.y }, c.at, 16, HAND);
    s.add(c.lead, (L, k) => {
      const q = pos(k);
      const q2 = pos(Math.min(1, k + 0.05));
      const th = Math.atan2(q2.y - q.y, q2.x - q.x);
      const ux = Math.cos(th);
      const uy = Math.sin(th);
      drawBolt(L.air, q.x - ux * 2, q.y - uy * 2, ux, uy, p);
      // The canister on its head.
      disc(L.air, q.x + ux * 3, q.y + uy * 3, 2, 2, WOOD[1], 1);
      dot(L.air, q.x + ux * 3 - 1, q.y + uy * 3 - 1, ROPE[0], 1);
      shadowOf(L.ground, lerp(c.from.x, c.at.x, k), lerp(c.from.y, c.at.y, k), 3, k);
      circle(L.ground, c.at.x, c.at.y, Math.max(12, c.r) * (0.5 + 0.5 * k), p.mid, 0.5 + 0.5 * k, FLAT, k * 4, k * 4 + Math.PI * 1.5);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(12, c.r);
    const { x, y } = c.at;
    // The canister bursts: a pop of light and a puff of rope dust.
    s.add(0.2, (L, k) => {
      if (k < 0.5) star(L.air, x, y - 18, Math.round(4 * (1 - k * 2)) + 1, p, 1);
      L.light(x, y - 16, 34, p.light, 1 - k);
    });
    smoke(s, { x, y: y - 14 }, 3, 0x9a8a70, 2.5, 0.5, 0);
    s.sparks(x, y, 8, [ROPE[0], ROPE[1], p.hot], { speed: 26, up: 10, life: 0.4, z: 18 });
    // It flies open and drops, then lies over them until it rots away.
    s.add(1.5, (L, k, t) => {
      const drop = Math.min(1, k / 0.12);
      const h = 16 * (1 - easeIn(drop));
      const r = R * (0.45 + 0.55 * easeOut(drop));
      const a = tail(k, 0.7);
      drawNet(drop < 1 ? L.air : L.ground, x, y, r, h, a, t * 30);
      if (drop >= 1 && k < 0.2) ring(L.ground, x, y, R + 2, 1, p, 1 - k / 0.2);
    });
    // Tangled round each foe it caught.
    for (const h of c.hits)
      s.add(1.3, (L, k) => {
        const a = tail(k, 0.65);
        for (let j = 0; j < 14; j++)
          for (let i = -5; i <= 5; i++) {
            const u = i + j;
            const v = i - j;
            if (((u % 4) + 4) % 4 !== 0 && ((v % 4) + 4) % 4 !== 0) continue;
            const X = Math.round(h.x + i);
            const Y = Math.round(h.y - 3 - j);
            if (Math.abs(i) > 4 - (j < 3 ? 1 : 0) || (a < 1 && dither(X, Y) >= a)) continue;
            L.air.put(X, Y, j % 2 ? ROPE[1] : ROPE[0], 1);
          }
      }, 0.1);
  },
};

/** The great bolt with its keg of powder lashed behind the head, along (ux, uy); stuck, its head is in the ground. */
function drawKeg(px: Px, x: number, y: number, ux: number, uy: number, stuck: boolean, spark: boolean): void {
  const nx = -uy;
  const ny = ux;
  const P = (X: number, Y: number, c: number) => px.put(Math.round(X), Math.round(Y), c, 1);
  for (let i = -11; i <= 3; i++) P(x + ux * i, y + uy * i, i < -5 ? WOOD[1] : WOOD[0]);
  if (!stuck) {
    for (const sd of [-1, 1]) for (let i = 9; i <= 11; i++) P(x - ux * i + nx * sd * (1 + (i - 9) * 0.6), y - uy * i + ny * sd * (1 + (i - 9) * 0.6), FLETCH);
    for (let i = 4; i <= 6; i++) for (let o = -(6 - i) * 0.7; o <= (6 - i) * 0.7 + 0.01; o += 0.5) P(x + ux * i + nx * o, y + uy * i + ny * o, o < 0 ? STEEL[0] : STEEL[1]);
  }
  // The keg: staves lit from one side, two iron hoops.
  for (let j = -2; j <= 2; j++) {
    const hw = Math.abs(j) === 2 ? 1.5 : 2.5;
    for (let o = -hw; o <= hw + 0.01; o += 0.5) {
      const hoop = Math.abs(j) === 1;
      P(x + ux * j + nx * o, y + uy * j + ny * o, hoop ? (o < 0 ? STEEL[2] : STEEL[3]) : o < -1 ? WOOD[0] : o < 1.5 ? WOOD[1] : WOOD[2]);
    }
  }
  // The fuse, and its spitting spark.
  const fx = x - ux * 2 - nx * 3;
  const fy = y - uy * 2 - ny * 3;
  P(fx, fy, 0x3a2a1a);
  P(fx - nx * 0.8, fy - ny * 0.8 - 1, 0x3a2a1a);
  if (spark) {
    P(fx - nx * 1.6, fy - ny * 1.6 - 2, 0xffffff);
    P(fx - nx * 1.6 + 1, fy - ny * 1.6 - 2, 0xfff0a0);
  }
}

/** Black Powder: the keg-bolt is lobbed onto the crowd and sticks; its fuse spits faster and faster, then the whole thing goes up. */
const blackPowder = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(16, c.r);
    const fly = Math.min(0.4, c.lead * 0.45);
    const a = { x: c.from.x, y: c.from.y };
    const b = c.at;
    s.add(fly, (L, k) => {
      const gx = lerp(a.x, b.x, k);
      const gy = lerp(a.y, b.y, k);
      const h = HAND * (1 - k) + 6 * k + bump(k) * 26;
      // Nose up as it climbs, nose down as it drops.
      const dx = b.x - a.x;
      const dy = b.y - a.y + HAND - 6 - Math.cos(k * Math.PI) * 26 * Math.PI;
      const d = Math.hypot(dx, dy) || 1;
      drawKeg(L.air, gx, gy - h, dx / d, dy / d, false, k * 20 % 2 < 1);
      shadowOf(L.ground, gx, gy, 4, k);
      L.light(gx, gy - h, 16, 0xffa040, 0.6);
    }, 0, () => {
      s.sparks(b.x, b.y, 6, ROCK, { speed: 20, up: 20, life: 0.35, z: 1 });
    });
    // Stuck fast, the fuse burning down, a ring on the ground warning faster and faster.
    const fuse = Math.max(0.1, c.lead - fly);
    const lean = Math.sign(b.x - a.x || 1) * 0.35;
    s.add(fuse, (L, k, t) => {
      const pulse = 0.5 + 0.5 * Math.sin(t * (14 + t * 40));
      const r = R * easeOut(Math.min(1, k * 4));
      drawKeg(L.air, b.x, b.y - 6, lean, 0.94, true, true);
      circle(L.ground, b.x, b.y, r, pulse > 0.5 ? p.hot : p.mid, 1, FLAT);
      if (pulse > 0.5) circle(L.ground, b.x, b.y, r - 2, p.deep, 1, FLAT);
      L.light(b.x, b.y - 12, 16 + 10 * pulse, 0xffc060, 0.5 + 0.4 * pulse);
      if (Math.random() < 0.5) s.sparks(b.x - 2, b.y, 1, [0xffffff, 0xfff0a0, 0xffa040], { speed: 14, up: 26, life: 0.3, z: 14 });
    }, fly);
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(16, c.r);
    const { x, y } = c.at;
    const seed = Math.random() * 100;
    s.shake(180, 0.004);
    // The blast: a white flash, then a ball of fire boiling up and turning to smoke.
    s.add(0.75, (L, k) => {
      if (k < 0.14) orb(L.air, x, y - 8, 4 + 10 * easeOut(k / 0.14), p, 1);
      for (let i = 0; i < 7; i++) {
        const th = hash(i, seed) * Math.PI * 2;
        const d = (0.3 + hash(i, seed, 1) * 0.7) * R * 0.45 * easeOut(Math.min(1, k * 3));
        const bx = x + Math.cos(th) * d;
        const by = y - 8 + Math.sin(th) * d * 0.6 - k * (10 + 12 * hash(i, seed, 2));
        const r = (3 + 4 * hash(i, seed, 3)) * (0.6 + 0.6 * easeOut(Math.min(1, k * 2.5)));
        const age = k + hash(i, seed, 4) * 0.15;
        const col = age < 0.18 ? p.core : age < 0.32 ? p.hot : age < 0.48 ? p.mid : age < 0.62 ? p.deep : 0x4a4038;
        disc(L.air, bx, by, r, r * 0.85, col, age < 0.62 ? 1 : 1 - (age - 0.62) / 0.5);
        if (age < 0.5) dot(L.air, bx - r * 0.3, by - r * 0.3, age < 0.3 ? 0xffffff : p.hot, 1, 2);
      }
      ring(L.ground, x, y, R * easeOut(Math.min(1, k * 1.8)), 3 * (1 - k) + 0.6, p, 1 - k);
      if (k < 0.4) ring(L.ground, x, y, R * 0.55 * easeOut(k / 0.4), 1, p, 1 - k / 0.4, 0.4, 7);
      L.light(x, y - 10, R * 3 + 30, p.light, 1 - k);
    });
    scorch(s, c.at, R * 0.6, 1.6, p.hot);
    smoke(s, c.at, 5, 0x4a4038, 4, 1.2, 14);
    s.sparks(x, y, 22, [p.core, p.hot, p.mid, p.deep], { speed: 50, up: 46, g: 110, life: 0.65, z: 6, spread: 6 });
    s.sparks(x, y, 8, WOOD, { speed: 40, up: 50, g: 160, life: 0.7, z: 6 });
    s.sparks(x, y, 6, ROCK, { speed: 26, up: 30, g: 160, life: 0.5, z: 1, ground: true });
    for (const h of c.hits) impact(s, h, p, 1);
  },
};

// --- The Knight ----------------------------------------------------------------------

/** Sword cuts, forehand and backhand; the combo's last a lunging thrust. */
function knightMelee(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  if (heavy) {
    thrust(s, from, at, p, 2.4, 8);
    impact(s, at, p, 0.9);
    return;
  }
  slash(s, from, at, p, { flip: (swing++ & 1) === 1, w: 3 });
  s.sparks(at.x, at.y, 4, [p.core, p.hot, STEEL[1]], { speed: 26, up: 18, life: 0.28, z: CHEST });
}

/** The fire whirlwind: two crescents of fire whirl round him, flames licking up off a ring rolling out across the ground. */
const fireWhirl = {
  cast(s: Stage, c: Cast): void {
    const f = fireOf(c.pal);
    // The blade kindles as he winds up.
    s.add(c.lead, (L, k, t) => {
      const cx = c.from.x;
      const cy = c.from.y - CHEST;
      orbit(L, cx, cy, 9, 1.5, -t * 10, -t * 10 + 1.2 * k, f, 1);
      L.light(cx, cy, 20 + 14 * k, f.light, 0.5 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const f = fireOf(c.pal);
    const R = Math.max(18, c.r);
    const { x, y } = c.from;
    s.add(0.65, (L, k, t) => {
      const a = tail(k, 0.6);
      const r = 8 + (R * 0.7 - 8) * easeOut(Math.min(1, k * 2));
      const spin = t * 16;
      for (let i = 0; i < 2; i++) orbit(L, x, y - 8, r, 3.2, spin + i * Math.PI, spin + i * Math.PI + 2, f, a);
      // Flames standing up off the rolling ring.
      const rr = R * easeOut(k);
      ring(L.ground, x, y, rr, 1.6, f, 1 - k);
      for (let i = 0; i < 12; i++) {
        const th = (i / 12) * Math.PI * 2 + 0.3;
        const near = Math.sin(th) > 0;
        if (hash(i, Math.floor(t * 20)) > a) continue;
        tongue(near ? L.air : L.ground, x + Math.cos(th) * rr, y + Math.sin(th) * rr * FLAT, 6 * (1 - k) + 2, f, t, i);
      }
      L.light(x, y - 8, R * 2.4, f.light, 0.8 * a);
    });
    scorch(s, c.from, R * 0.45, 1.1, f.mid);
    s.sparks(x, y, 16, [f.core, f.hot, f.mid, f.deep], { speed: 40, up: 30, g: -10, life: 0.6, z: 8, spread: 8 });
    for (const h of c.hits) impact(s, h, f, 0.8);
  },
};

/** A great sword standing point-down with its tip at (x, tip): pixels below `floor` are sunk in the ground. */
function greatSword(px: Px, x: number, tip: number, p: Pal, a: number, floor = Infinity): void {
  const put = (X: number, Y: number, c: number) => {
    if (Y > floor) return;
    if (a < 1 && dither(X, Y) >= a) return;
    px.put(X, Y, c, 1);
  };
  x = Math.round(x);
  tip = Math.round(tip);
  // The blade: 26 long, widening from its point over the last 7, a fuller of white light down its middle.
  for (let i = 0; i < 26; i++) {
    const y = tip - i;
    const hw = i < 7 ? Math.floor((i / 7) * 2.5) : 2;
    for (let dx = -hw; dx <= hw; dx++) put(x + dx, y, dx === -hw || dx === hw ? p.deep : dx === 0 && i > 4 ? p.core : dx < 0 ? p.hot : p.mid);
  }
  const gy = tip - 26;
  for (let dx = -6; dx <= 6; dx++) {
    const end = Math.abs(dx) > 4;
    put(x + dx, gy, end ? p.hot : p.mid);
    put(x + dx, gy - 1, end ? p.core : p.hot);
  }
  put(x - 7, gy - 1, p.core);
  put(x + 7, gy - 1, p.core);
  for (let i = 2; i < 8; i++) {
    put(x - 1, gy - i, 0x3a2a24);
    put(x, gy - i, i % 2 ? 0x8a6a4a : 0x5a3e30);
    put(x + 1, gy - i, 0x2a1c18);
  }
  for (let dy = 0; dy < 3; dy++) for (let dx = -1; dx <= 1; dx++) put(x + dx, gy - 8 - dy, dx === 0 && dy === 1 ? p.core : p.hot);
}

/** Skybreaker: a giant blade of light shines high over the foe, plunges point-first and splits the ground. */
const skybreaker = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(14, c.r);
    const { x, y } = c.at;
    gather(s, c.from, p, Math.min(0.4, c.lead), 1);
    s.add(c.lead, (L, k) => {
      const appear = Math.min(1, k / 0.35);
      const fall = clamp01((k - 0.35) / 0.65);
      const tip = y - 104 * (1 - easeIn(fall));
      greatSword(L.air, x, tip, p, appear);
      // Streaks of speed above it as it drops.
      if (fall > 0) for (const dx of [-3, 0, 3]) line(L.air, x + dx, tip - 38, x + dx, tip - 38 - 16 * fall, p.mid, 1);
      shadowOf(L.ground, x, y, 7, fall);
      circle(L.ground, x, y, R * (1.2 - 0.2 * fall), p.mid, 1, FLAT);
      L.light(x, tip - 16, 30, p.light, 0.5 * appear);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(14, c.r);
    const { x, y } = c.at;
    const seed = Math.floor(Math.random() * 100);
    s.shake(170, 0.004);
    // Stuck fast, then breaking up into light from the hilt down.
    s.add(1.3, (L, k) => {
      const a = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
      greatSword(L.air, x, y + 5, p, a, y);
      if (k < 0.12) column(L.air, x, y, 70, 4 * (1 - k / 0.12) + 1, p, 1);
      if (k > 0.65 && hash(Math.floor(k * 40), seed) < 0.5) s.sparks(x + (Math.random() - 0.5) * 6, y, 1, [p.core, p.hot], { speed: 3, up: 10, g: -20, life: 0.5, z: 6 + Math.random() * 26 });
      L.light(x, y - 16, 34, p.light, 0.6 * a);
    });
    // The ground: a shock ring, a broken ring inside, and cracks of light that cool and close.
    s.add(1.3, (L, k) => {
      const q = Math.min(1, k / 0.35);
      if (q < 1) {
        ring(L.ground, x, y, 4 + R * 1.5 * easeOut(q), 3 * (1 - q) + 1, p, 1 - q);
        ring(L.ground, x, y, 2 + R * 0.9 * easeOut(q * 1.2), 1.5, p, 0.8 * (1 - q), 0.35, 3);
      }
      const cool = tail(k, 0.5);
      pool(L.ground, x, y, 9, 0x2a2024, 0x3a3034, cool, 0.8);
      cracks(L.ground, x, y, 8, R * 1.3, seed, Math.min(1, k / 0.08), cool, p);
      L.light(x, y - 6, R * 3 + 40, p.light, k < 0.2 ? 1 - k / 0.2 : 0);
    });
    s.sparks(x, y, 20, p.tints, { speed: 50, up: 40, life: 0.55, z: 6, spread: 4 });
    s.sparks(x, y, 10, ROCK, { speed: 34, up: 40, g: 150, life: 0.55, z: 2 });
    for (const h of c.hits) impact(s, h, p, 1);
  },
};

// --- The King ------------------------------------------------------------------------

/** A little crown: points with pearls of light, a band, a row of gems. */
const CROWN = [
  'a...a...a',
  'b..aba..b',
  'bb.bcb.bb',
  'bbbbbbbbb',
  'cdcdcdcdc',
  'bbbbbbbbb',
];

/** The seal of the decree under a kneeling foe: a ring with four marks, held as long as it kneels. */
function seal(s: Stage, at: Pt, p: Pal, sec: number): void {
  s.add(sec, (L, k, t) => {
    const a = tail(k, 0.75);
    circle(L.ground, at.x, at.y, 8, p.hot, a, FLAT);
    for (let i = 0; i < 4; i++) {
      const th = (i / 4) * Math.PI * 2 + t * 1.5;
      dot(L.ground, at.x + Math.cos(th) * 8, at.y + Math.sin(th) * 8 * FLAT, p.core, a, 2);
    }
    // Light pressing down on its shoulders.
    const yy = at.y - HEAD - 2 + (t * 20) % 6;
    if (a > 0.5) for (const sd of [-4, 4]) line(L.air, at.x + sd, yy, at.x + sd, yy + 2, p.hot, 1);
  });
}

/** The greatsword: broad, heavy cuts; the combo's last a great overhead chop bursting light on the ground before him. */
function kingMelee(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  if (!heavy) {
    slash(s, from, at, p, { flip: (swing++ & 1) === 1, w: 4, span: 2.2, reach: 6, dur: 0.3 });
    s.sparks(at.x, at.y, 5, [p.core, p.hot, p.deep], { speed: 28, up: 18, life: 0.3, z: CHEST });
    return;
  }
  // The chop: down from over his head onto the foe.
  const side = at.x >= from.x ? 1 : -1;
  const cx = from.x;
  const cy = from.y - CHEST;
  const th = Math.atan2((at.y - CHEST - cy) / 0.9, at.x - cx);
  const r = Math.max(14, Math.hypot(at.x - cx, (at.y - CHEST - cy) / 0.9) + 6);
  const a0 = -Math.PI / 2 - 0.4 * side;
  s.add(0.3, (L, k) => {
    const sweep = easeIn(Math.min(1, k / 0.35));
    const fade = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
    const head = a0 + (th + 0.3 * side - a0) * sweep;
    if (Math.abs(head - a0) > 0.05) arc(L.air, cx, cy, r, 4.5, a0, head, p, fade, 0.9);
  });
  s.add(0.4, (L, k, t) => {
    ring(L.ground, at.x, at.y, 3 + 14 * easeOut(k), 2 * (1 - k) + 0.6, p, 1 - k);
    if (k < 0.5) column(L.air, at.x, at.y, 22 * bump(k * 2), 3, p, 1 - k * 2, t);
    if (k < 0.3) star(L.air, at.x, at.y - CHEST, 5, p, 1);
    L.light(at.x, at.y - 8, 40, p.light, 1 - k);
  }, 0.1);
  s.sparks(at.x, at.y, 10, p.tints, { speed: 34, up: 30, life: 0.4, z: 3 });
}

/** The Royal Decree: he raises the greatsword to the sky; a ring of light rolls out, foes kneel, and a crown shines over his head. */
const decree = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.from;
    s.add(c.lead, (L, k) => {
      const h = 4 + 16 * easeOut(k);
      // The blade held high, its light climbing to the tip.
      for (let i = 0; i < h; i++) {
        const yy = y - HEAD - 2 - i;
        L.air.put(x, Math.round(yy), i > h - 3 ? p.core : p.hot, 1);
        L.air.put(x - 1, Math.round(yy), p.mid, 1);
        L.air.put(x + 1, Math.round(yy), p.deep, 1);
      }
      star(L.air, x, y - HEAD - 2 - h, Math.round(2 + 3 * k), p, 1);
      L.light(x, y - HEAD - h, 20 + 20 * k, p.light, 0.7 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(18, c.r);
    const { x, y } = c.from;
    s.add(0.55, (L, k) => {
      ring(L.ground, x, y, 4 + (R - 4) * easeOut(k), 2.4 * (1 - k) + 0.8, p, 1 - k * 0.6);
      ring(L.ground, x, y, (R - 8) * easeOut(k * 1.3), 0.8, p, 0.6 * (1 - k), 0.5, Math.floor(k * 9));
      L.light(x, y - 6, R * 2.5, p.light, 0.8 * (1 - k));
    });
    // The crown over his head, shining and fading.
    s.add(1.0, (L, k) => {
      const a = k < 0.15 ? k / 0.15 : tail(k, 0.6);
      const yy = y - HEAD - 4 - 3 * easeOut(Math.min(1, k * 3));
      sprite(L.air, x, yy, CROWN, { a: p.core, b: p.hot, c: p.mid, d: p.deep }, a);
      if (k < 0.3) star(L.air, x, yy - 7, 3, p, 1);
      L.light(x, yy - 3, 24, p.light, 0.6 * a);
    });
    barrier(s, c.from, p, 0.9);
    for (const h of c.hits) {
      impact(s, h, p, 0.7);
      seal(s, h, p, c.stun || 1);
    }
  },
};

/** The crown on the ground round (x, gy): its band and points; the far half under the heroes, the near half over them. */
function bigCrown(L: Layers, x: number, gy: number, R: number, spin: number, p: Pal, a: number): void {
  const BAND = 4;
  const POINT = 8;
  const steps = Math.ceil(R * 2 * Math.PI * 0.9);
  for (let i = 0; i < steps; i++) {
    const th = (i / steps) * Math.PI * 2;
    const sn = Math.sin(th);
    const near = sn > 0;
    const px = near ? L.air : L.ground;
    const bx = Math.round(x + Math.cos(th) * R);
    const by = Math.round(gy + sn * R * FLAT);
    for (let h = 0; h < BAND; h++) {
      if (a < 1 && dither(bx, by - h) >= a) continue;
      const rim = h === 0 || h === BAND - 1;
      px.put(bx, by - h, near ? (rim ? p.core : h === 1 ? p.hot : p.mid) : rim ? p.mid : p.deep, 1);
    }
  }
  for (let i = 0; i < 8; i++) {
    const th = spin + (i / 8) * Math.PI * 2;
    const sn = Math.sin(th);
    const near = sn > 0;
    const px = near ? L.air : L.ground;
    const bx = Math.round(x + Math.cos(th) * R);
    const by = Math.round(gy + sn * R * FLAT) - BAND;
    for (let h = 0; h < POINT; h++) {
      const hw = Math.round(2 * (1 - h / POINT));
      for (let dx = -hw; dx <= hw; dx++) {
        if (a < 1 && dither(bx + dx, by - h) >= a) continue;
        px.put(bx + dx, by - h, near ? (dx === -hw ? p.core : dx === hw ? p.mid : p.hot) : dx === -hw ? p.mid : p.deep, 1);
      }
    }
    // A pearl of light on each point, and a gem in the band beneath it.
    if (!(a < 1 && dither(bx, by - POINT) >= a)) {
      px.put(bx, by - POINT, p.core, 1);
      px.put(bx, by + 2, near ? p.deep : dark(p.deep, 0.3), 1);
    }
  }
}

/** Crown of Kings: a great crown of light comes down out of the sky round the crowd and lands with a blow; then a pillar of light bursts from each of its points. */
const crownOfKings = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(18, c.r * 0.7);
    const { x, y } = c.at;
    gather(s, c.from, p, Math.min(0.4, c.lead), 1.2);
    s.add(c.lead, (L, k, t) => {
      const appear = Math.min(1, k / 0.4);
      const fall = clamp01((k - 0.4) / 0.6);
      const gy = y - 70 * (1 - easeIn(fall));
      bigCrown(L, x, gy, R, t * 0.6, p, appear);
      // Its shadow gathering on the ground below.
      circle(L.ground, x, y, R, p.deep, appear, FLAT);
      if (fall > 0) circle(L.ground, x, y, R - 1, p.mid, fall, FLAT);
      L.light(x, gy - 6, R * 2, p.light, 0.5 * appear);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(18, c.r * 0.7);
    const Rp = Math.max(R + 8, c.r);
    const { x, y } = c.at;
    const spin = Math.random() * 6;
    const PILLARS = 0.32;
    s.shake(150, 0.004);
    s.add(1.5, (L, k, t) => {
      const a = tail(k, 0.72);
      bigCrown(L, x, y, R, spin + t * 0.6, p, a);
      const since = k * 1.5;
      // The blow of its landing.
      if (since < 0.4) ring(L.ground, x, y, R * (0.7 + 0.5 * easeOut(since / 0.4)), 3 * (1 - since / 0.4) + 0.8, p, 1 - since / 0.4);
      // The pillars, one from each point, and a second ring further out.
      const q = (since - PILLARS) / 0.6;
      if (q >= 0 && q < 1) {
        for (let i = 0; i < 8; i++) {
          const th = spin + t * 0.6 + (i / 8) * Math.PI * 2;
          const sn = Math.sin(th);
          const px = sn > 0 ? L.air : L.ground;
          const h = 34 * bump(Math.min(1, q * 1.6)) * (q < 0.3 ? 1 : 1 - (q - 0.3) * 0.5);
          column(px, x + Math.cos(th) * R, y + sn * R * FLAT - 4, h, 2.4 * (1 - q * 0.6), p, 1 - q * q, t);
        }
        ring(L.ground, x, y, R + (Rp - R) * easeOut(q), 2.4 * (1 - q) + 0.6, p, 1 - q);
        L.light(x, y - 16, Rp * 3, p.light, 1 - q);
      }
      if (since < 0.25) L.light(x, y - 10, R * 4, p.light, 1 - since / 0.25);
    });
    s.add(0.01, () => {}, PILLARS, () => s.shake(110, 0.003));
    s.sparks(x, y, 18, p.tints, { speed: 40, up: 34, life: 0.6, z: 4, spread: R });
    for (const h of c.hits) {
      impact(s, h, p, 1);
      s.add(0.01, () => {}, PILLARS, () => impact(s, h, p, 0.7));
      seal(s, h, p, c.stun || 1.5);
    }
  },
};

// --- The Paladin ---------------------------------------------------------------------

/** Where the mace lands: a ring racing out over the ground, a pillar of light rising from it. */
function smiteBurst(s: Stage, at: Pt, p: Pal, size = 1, wait = 0): void {
  s.add(0.4, (L, k, t) => {
    ring(L.ground, at.x, at.y, 3 + 11 * size * easeOut(k), 1.6 * (1 - k) + 0.6, p, 1 - k);
    if (k < 0.6) column(L.air, at.x, at.y, 20 * size * bump(Math.min(1, k * 1.7)), 2.5 * size, p, 1 - k / 0.6, t);
    if (k < 0.25) star(L.air, at.x, at.y - CHEST, Math.round(3 + 2 * size), p, 1);
    L.light(at.x, at.y - 10, 30 * size + 10, p.light, 0.9 * (1 - k));
  }, wait);
  s.sparks(at.x, at.y, Math.round(7 * size), p.tints, { speed: 26, up: 34, life: 0.45, z: 4 });
}

/** The overhead mace smite: a short downward crescent, then light bursting where it lands. */
function paladinMelee(s: Stage, at: Pt, from: Pt, p: Pal): void {
  slash(s, from, at, p, { flip: (swing++ & 1) === 1, w: 3, span: 1.4, lift: 6, dur: 0.2 });
  smiteBurst(s, at, p, 1, 0.06);
}

/** Consecrate: a circle of holy light opens on the ground round him, pulsing out, burning foes and mending him. */
const consecrate = {
  cast(s: Stage, c: Cast): void {
    castRune(s, c.from, c.pal, c.lead + 0.15, 12);
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(18, c.r);
    const { x, y } = c.from;
    s.add(1.4, (L, k, t) => {
      const open = easeOut(Math.min(1, k * 5));
      const a = tail(k, 0.7);
      pool(L.ground, x, y, R * open, p.hot, p.mid, 0.4 * a, 0.85);
      rune(L.ground, x, y, R * 0.92 * open, t * 1.6, p, a);
      for (let i = 0; i < 3; i++) {
        const q = (k * 1.4 - i * 0.3) / 0.45;
        if (q < 0 || q > 1) continue;
        ring(L.ground, x, y, 4 + (R - 4) * easeOut(q), 1.2, p, 1 - q);
      }
      L.light(x, y - 6, R * 2.2, p.light, 0.6 * a);
    });
    for (let i = 0; i < 3; i++) s.add(0.01, () => {}, i * 0.42, () => motes(s, c.from, [p.core, p.hot, p.mid], 5, R * 1.2));
    for (const h of c.hits) {
      impact(s, h, p, 0.7);
      s.sparks(h.x, h.y, 4, [p.core, p.hot], { speed: 4, up: 22, g: -16, life: 0.6, spread: 6, z: 2 });
    }
    plus(s, c.from, 0x9dff9a, 0.15);
  },
};

/** Heaven's Light: a pillar of light falls on him from the sky, healing and shielding all round, and rings of holy light roll out. */
const heavensLight = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.from;
    castRune(s, c.from, p, c.lead + 0.3, 14);
    // A thread of light reaching down from the sky ahead of the pillar.
    s.add(c.lead, (L, k) => {
      const bottom = y - 110 + 110 * easeIn(k);
      for (let yy = y - 110; yy < bottom; yy++) {
        if (dither(x, yy) < 0.7) L.ground.put(x, Math.round(yy), p.hot, 1);
        if (dither(x + 1, yy) < 0.35) L.ground.put(x + 1, Math.round(yy), p.mid, 1);
      }
      L.light(x, bottom, 20, p.light, 0.6 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(22, c.r);
    const { x, y } = c.from;
    s.add(1.5, (L, k, t) => {
      const drop = easeOut(Math.min(1, k / 0.12));
      const thin = 1 - clamp01((k - 0.65) / 0.35);
      const w = 6 * thin * (1 + 0.08 * Math.sin(t * 20));
      const top = 110;
      // The pillar stands behind him (under the heroes), only its edges and motes in front, so he can be seen inside it.
      if (w > 0.6) {
        column(L.ground, x, y, top * drop, w, p, 0.95, t);
        for (let i = 0; i < top * drop * 0.9; i++) {
          const yy = Math.round(y - i);
          for (const sd of [-1, 1]) {
            const xx = Math.round(x + sd * w);
            if (dither(xx, yy) < 0.55 * thin) L.air.put(xx, yy, p.hot, 1);
          }
        }
        for (let i = 0; i < 8; i++) {
          const sv = hash(i, 11);
          const yy = y - ((sv * 60 + t * 50 * (0.5 + sv)) % 60);
          dot(L.air, x + (hash(i, 12) - 0.5) * w * 2, yy, i % 3 ? p.hot : p.core, thin);
        }
      }
      const open = easeOut(Math.min(1, k * 4)) * thin;
      pool(L.ground, x, y, R * 0.6 * open, p.hot, p.mid, 0.5 * open, 0.85);
      for (const at of [0, 0.16, 0.32]) {
        const q = (k - at) / 0.4;
        if (q < 0 || q > 1) continue;
        ring(L.ground, x, y, 5 + R * easeOut(q), 2.5 * (1 - q) + 0.8, p, 1 - q);
      }
      L.light(x, y - 30, 70, p.light, drop * thin);
    });
    s.sparks(x, y, 14, [0xffffff, p.core, p.hot], { speed: 18, up: 30, g: -10, life: 0.8, z: 8, spread: 8 });
    for (const h of c.hits) {
      plus(s, h, 0x9dff9a, 0.1);
      motes(s, h, [p.core, p.hot, 0x9dff9a], 5, 8);
      barrier(s, h, p, 1.1);
    }
  },
};

// --- The Crusader --------------------------------------------------------------------

/** The warhammer: a slower, heavier smite, sunfire bursting from where it lands. */
function crusaderMelee(s: Stage, at: Pt, from: Pt, p: Pal): void {
  const f = fireOf(p);
  slash(s, from, at, f, { flip: (swing++ & 1) === 1, w: 4, span: 1.5, lift: 8, dur: 0.24 });
  smiteBurst(s, at, f, 1.1, 0.07);
  s.add(0.5, (L, k, t) => {
    if (k > 0.8) return;
    for (let i = 0; i < 4; i++) tongue(L.ground, at.x - 6 + i * 4, at.y + (i % 2), 4 * (1 - k), f, t, i);
  }, 0.07);
}

/** The sun's face: a white heart, a hot disc and a crown of turning rays. */
function sun(px: Px, x: number, y: number, r: number, t: number, p: Pal): void {
  if (r < 0.6) return;
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      px.put(Math.round(x + dx), Math.round(y + dy), d < r * 0.45 ? p.core : d < r * 0.75 ? p.hot : p.mid, 1);
    }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + t * 2;
    const len = (i % 2 ? 3 : 5.5) * (r / 6) * (0.85 + 0.15 * Math.sin(t * 20 + i));
    for (let k = 1; k <= len; k++) px.put(Math.round(x + Math.cos(a) * (r + k)), Math.round(y + Math.sin(a) * (r + k)), k < len * 0.5 ? p.hot : p.deep, 1);
  }
}

/** Sunfire: his hammer kindles, then a blast of sunfire bursts round him, flames running out along the ground, wrapping him in light. */
const sunfire = {
  cast(s: Stage, c: Cast): void {
    gather(s, c.from, fireOf(c.pal), c.lead, 1);
  },
  hit(s: Stage, c: Cast): void {
    const f = fireOf(c.pal);
    const R = Math.max(18, c.r);
    const { x, y } = c.from;
    s.add(0.6, (L, k, t) => {
      const rr = R * easeOut(k);
      ring(L.ground, x, y, rr, 3 * (1 - k) + 1, f, 1 - k);
      if (k < 0.3) sun(L.air, x, y - CHEST, 6 * (1 - k / 0.3) + 1, t, f);
      for (let i = 0; i < 14; i++) {
        const th = (i / 14) * Math.PI * 2;
        const near = Math.sin(th) > 0;
        if (k > 0.75) continue;
        tongue(near ? L.air : L.ground, x + Math.cos(th) * rr, y + Math.sin(th) * rr * FLAT, 7 * (1 - k) + 1, f, t, i);
      }
      L.light(x, y - 8, R * 3, f.light, 1 - k);
    });
    scorch(s, c.from, R * 0.5, 1.2, f.mid);
    barrier(s, c.from, f, 1);
    s.sparks(x, y, 16, f.tints, { speed: 44, up: 30, life: 0.5, z: 6, spread: 6 });
    for (const h of c.hits) {
      impact(s, h, f, 0.8);
      s.sparks(h.x, h.y, 4, [f.hot, f.mid], { speed: 34, up: 10, life: 0.35, z: 6, dir: angle(c.from, h), cone: 0.4 });
    }
  },
};

/** Where the sun hangs over him. */
const SUN_H = 46;

/** Wrath of the Sun: a small sun kindles over his head and hurls rays of fire at foe after foe. */
const wrathOfSun = {
  cast(s: Stage, c: Cast): void {
    const f = fireOf(c.pal);
    const { x, y } = c.from;
    gather(s, c.from, f, Math.min(0.35, c.lead), 1);
    s.add(c.lead, (L, k, t) => {
      sun(L.air, x, y - SUN_H, 6 * easeOut(k), t, f);
      // Motes of fire drawn up into it.
      for (let i = 0; i < 6; i++) {
        const life = (k * 2 + i / 6) % 1;
        const th = (i / 6) * Math.PI * 2;
        const d = (1 - life) * 18;
        dot(L.air, x + Math.cos(th) * d, y - SUN_H + Math.sin(th) * d * 0.7 + (1 - life) * 10, life > 0.6 ? f.core : f.mid, 1);
      }
      pool(L.ground, x, y, 12 * k, f.hot, f.mid, 0.35 * k, 0.8);
      L.light(x, y - SUN_H, 30 + 30 * k, f.light, 0.8 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const f = fireOf(c.pal);
    const { x, y } = c.from;
    const sx = x;
    const sy = y - SUN_H;
    const life = c.span + 0.5;
    s.shake(120, 0.003);
    s.add(life, (L, k, t) => {
      const size = k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
      sun(L.air, sx, sy, 6 * size + Math.sin(t * 30) * 0.4, t, f);
      pool(L.ground, x, y, 12 * size, f.hot, f.mid, 0.35 * size, 0.8);
      L.light(sx, sy, 60, f.light, 0.9 * size);
    });
    const n = Math.max(1, c.path.length);
    c.path.forEach((to, i) => {
      s.add(0.01, () => {}, (c.span * i) / n, () => {
        // The ray: a lance of sunfire from the sun to the foe, fading from the sun's end.
        s.add(0.22, (L, k) => {
          const b = easeIn(k);
          const ax = lerp(sx, to.x, b);
          const ay = lerp(sy + 4, to.y - 4, b);
          stroke(L.air, ax, ay, to.x, to.y - 4, 2.2 * (1 - k * 0.6), f, 1);
          L.light(to.x, to.y - 6, 30, f.light, 1 - k);
        });
        smiteBurst(s, to, f, 0.9);
        scorch(s, to, 6, 0.9, f.mid);
      });
    });
  },
};

// --- The Jedi ------------------------------------------------------------------------

/** A saber's palette: a white-hot core with the blade's glow round it. */
const saberOf = (p: Pal): Pal => ({ core: 0xffffff, hot: p.core, mid: p.hot, deep: p.mid, light: p.light, tints: [0xffffff, p.core, p.hot, p.mid] });

/** The saber flurry: thin glowing arcs, forehand and backhand; the second of each pair crosses the first in an X. */
function jediMelee(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const sp = saberOf(p);
  const flip = (swing++ & 1) === 1;
  slash(s, from, at, sp, { flip, w: 2.2, span: 2, dur: 0.2 });
  // The blade's afterglow just inside the cut.
  slash(s, from, at, { ...sp, core: p.hot, hot: p.mid, mid: p.mid, deep: p.deep }, { flip, w: 1, span: 1.7, dur: 0.26, reach: 0 });
  if (heavy) {
    s.add(0.01, () => {}, 0.07, () => slash(s, from, at, sp, { flip: !flip, w: 2.4, span: 2.2, dur: 0.22, lift: -3 }));
    impact(s, at, sp, 0.8);
  } else s.sparks(at.x, at.y, 4, sp.tints, { speed: 30, up: 16, life: 0.25, z: CHEST });
}

/** Force push: the air bends round his palm, then ripples of it roll out, kicking up dust and throwing foes back. */
const forcePush = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.from;
    s.add(c.lead, (L, k, t) => {
      // Air drawn in to the palm: broken rings closing in.
      for (let i = 0; i < 2; i++) {
        const q = (k * 2 + i * 0.5) % 1;
        circle(L.air, x, y - HAND, 12 * (1 - q) + 2, i ? p.hot : p.mid, 1, 0.8, t * 4 + i, t * 4 + i + 2.2);
      }
      L.light(x, y - HAND, 16 + 12 * k, p.light, 0.5 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(18, c.r) + 6;
    const { x, y } = c.from;
    const air = mix(p.hot, 0xffffff, 0.4);
    for (let i = 0; i < 3; i++)
      s.add(0.42, (L, k, t) => {
        const r = 4 + R * easeOut(k);
        const a = 1 - k;
        // Bent air: broken rings, a bright edge and a fainter one just inside, on the ground and at chest height.
        ring(L.ground, x, y, r, 1, p, a * 0.9, 0.35, i * 7 + Math.floor(t * 12));
        circle(L.air, x, y - 8, r * 0.95, air, 1, FLAT, i + t * 3, i + t * 3 + Math.PI * 0.7);
        circle(L.air, x, y - 8, r * 0.95, p.mid, 1, FLAT, i + t * 3 + Math.PI, i + t * 3 + Math.PI * 1.6);
        if (i === 0) L.light(x, y - 8, R * 2, p.light, 0.6 * a);
      }, i * 0.07);
    s.sparks(x, y, 12, [0x9a8a78, 0x7a6a5a, 0xb8a890], { speed: 46, up: 8, g: 60, life: 0.45, ground: true, spread: 10, z: 0 });
    for (const h of c.hits) {
      const th = angle(c.from, h);
      // Streaks of wind pushing past the foe.
      s.add(0.3, (L, k) => {
        for (let j = -1; j <= 1; j++) {
          const ox = h.x - Math.sin(th) * j * 4 + Math.cos(th) * (4 + 10 * k);
          const oy = h.y - CHEST + Math.cos(th) * j * 3 + Math.sin(th) * (3 + 6 * k);
          if (dither(ox, oy) > 1 - k) continue;
          line(L.air, ox, oy, ox + Math.cos(th) * 5, oy + Math.sin(th) * 3, j ? p.mid : air, 1);
        }
      });
      impact(s, h, p, 0.6);
    }
  },
};

/** The spinning saber: its blade, a smear of afterimages behind it, the hilt at its heart. */
function spinSaber(px: Px, x: number, y: number, spin: number, p: Pal, hover: boolean): void {
  for (let k = 4; k >= 0; k--) {
    const a = spin - k * 0.35;
    const ux = Math.cos(a);
    const uy = Math.sin(a) * 0.75;
    if (k === 0) {
      for (let r = 2; r <= 11; r++) {
        const bx = Math.round(x + ux * r);
        const by = Math.round(y + uy * r);
        px.put(bx, by, 0xffffff, 1);
        px.put(bx, by - 1, p.core, 1);
        px.put(bx, by + 1, p.hot, 1);
      }
      line(px, x - ux * 3, y - uy * 3, x + ux * 1, y + uy * 1, STEEL[2], 1);
      px.put(Math.round(x - ux * 3), Math.round(y - uy * 3), STEEL[3], 1);
      px.put(Math.round(x), Math.round(y), STEEL[0], 1);
    } else {
      const fade = (hover ? 0.75 : 0.6) - k * 0.12;
      for (let r = 4; r <= 11; r++) {
        const bx = Math.round(x + ux * r);
        const by = Math.round(y + uy * r);
        if (dither(bx, by) < fade) px.put(bx, by, r > 8 ? p.hot : p.mid, 1);
      }
    }
  }
}

/** Saber Cyclone: the saber is hurled spinning down the line, whirls there as a storm of blades, then flies home to his hand. */
const saberCyclone = {
  cast(s: Stage, c: Cast): void {
    const sp = saberOf(c.pal);
    const { x, y } = c.from;
    // The blade held back, its hum building.
    s.add(c.lead, (L, k, t) => {
      const th = -Math.PI / 2 - 0.6 + Math.sin(t * 30) * 0.03;
      stroke(L.air, x + 3, y - HAND, x + 3 + Math.cos(th) * 11, y - HAND + Math.sin(th) * 11, 1, sp, 1, 0.3);
      L.light(x + 3, y - HAND - 6, 18 + 12 * k, sp.light, 0.5 + 0.4 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const sp = saberOf(c.pal);
    const OUT = 0.3;
    const HOVER = 0.5;
    const BACK = 0.3;
    const a = { x: c.from.x, y: c.from.y };
    const b = c.at;
    const len = Math.max(1, dist(a, b));
    s.add(OUT + HOVER + BACK, (L, _k, t) => {
      let gx: number;
      let gy: number;
      const hover = t >= OUT && t < OUT + HOVER;
      if (t < OUT) {
        const e = easeOut(t / OUT);
        gx = lerp(a.x, b.x, e);
        gy = lerp(a.y, b.y, e);
      } else if (hover) {
        gx = b.x;
        gy = b.y;
      } else {
        const e = easeIn(clamp01((t - OUT - HOVER) / BACK));
        gx = lerp(b.x, a.x, e);
        gy = lerp(b.y, a.y, e);
      }
      const spin = t * (hover ? 34 : 24);
      const y = gy - CHEST;
      if (hover) {
        ring(L.ground, gx, gy, 13, 1.2, sp, 0.7, 0.6, Math.floor(t * 20));
        circle(L.air, gx, y, 13, sp.hot, 1, 0.75, spin * 0.5, spin * 0.5 + 1.4);
        circle(L.air, gx, y, 13, sp.mid, 1, 0.75, spin * 0.5 + Math.PI, spin * 0.5 + Math.PI + 1.4);
      }
      spinSaber(L.air, gx, y, spin, sp, hover);
      disc(L.ground, gx, gy, 5, 2.5, 0x0b0818, 0.5, 0.6);
      L.light(gx, y, hover ? 40 : 26, sp.light, 0.8);
    });
    // Each foe on the line is cut as the blade passes, and again while it whirls if it stands at the end.
    for (const h of c.hits) {
      const along = Math.min(1, dist(a, h) / len);
      s.add(0.01, () => {}, OUT * along * 0.8, () => impact(s, h, sp, 0.7));
      if (dist(h, b) < 18) for (let i = 1; i <= 3; i++) s.add(0.01, () => {}, OUT + i * 0.13, () => s.sparks(h.x, h.y, 4, sp.tints, { speed: 30, up: 18, z: CHEST, life: 0.25 }));
    }
    s.add(0.25, (L, k) => {
      star(L.air, a.x, a.y - HAND, Math.round(4 * (1 - k)) + 1, sp, 1);
      L.light(a.x, a.y - HAND, 24, sp.light, 1 - k);
    }, OUT + HOVER + BACK);
  },
};

// --- The Valkyries -------------------------------------------------------------------

/** A spear of light flying along (ux, uy), its point at (x, y): a leaf of a head, little wings at the socket, a golden shaft. */
function flyingSpear(px: Px, x: number, y: number, ux: number, uy: number, p: Pal, a = 1): void {
  const nx = -uy;
  const ny = ux;
  const P = (X: number, Y: number, c: number) => {
    const rx = Math.round(X);
    const ry = Math.round(Y);
    if (a < 1 && dither(rx, ry) >= a) return;
    px.put(rx, ry, c, 1);
  };
  // The head.
  for (let i = 0; i < 6; i++) {
    const hw = i < 3 ? i * 0.6 : 1.2 - (i - 3) * 0.3;
    for (let o = -hw; o <= hw + 0.01; o += 0.5) P(x - ux * i + nx * o, y - uy * i + ny * o, o === 0 ? p.core : o < 0 ? p.hot : p.mid);
  }
  P(x + ux, y + uy, p.core);
  // Wings swept back from the socket.
  for (const sd of [-1, 1])
    for (let i = 0; i <= 3; i++) P(x - ux * (6 + i) + nx * sd * (1 + i), y - uy * (6 + i) + ny * sd * (1 + i), i === 3 ? p.core : p.hot);
  // The shaft.
  for (let i = 6; i <= 18; i++) P(x - ux * i, y - uy * i, i % 6 === 0 ? p.core : p.mid);
  for (let i = 7; i <= 18; i += 2) P(x - ux * i + nx * 0.6, y - uy * i + ny * 0.6, p.deep);
}

/** The spear chain: a jab and a sweep, the last a long lunging thrust; the Stormwing's blows crackle on. */
function spearMelee(storm: boolean) {
  return (s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void => {
    if (heavy) {
      thrust(s, from, at, p, 2, 14, 0.28);
      impact(s, at, p, 0.9);
    } else if ((swing++ & 1) === 0) thrust(s, from, at, p, 1.4, 6, 0.2);
    else slash(s, from, at, p, { w: 2.5, span: 2.4, reach: 6, dur: 0.24 });
    if (!storm) return;
    // Lightning leaps off the foe it struck.
    const seed = Math.random() * 100;
    s.add(heavy ? 0.2 : 0.13, (L, _k, t) => {
      const sd = Math.floor(t * 40);
      const n = heavy ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const th = hash(i, seed) * Math.PI * 2;
        bolt(L.air, at.x, at.y - CHEST, at.x + Math.cos(th) * 12, at.y - CHEST + Math.sin(th) * 8, p, sd + i * 3, 1);
      }
      L.light(at.x, at.y - CHEST, 22, p.light, 0.7);
    }, 0.05);
  };
}

/** The spear of light: drawn back and kindled, then hurled down the line, piercing all in its path, and flying back to her hand. */
const spearOfLight = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const th = angle(c.from, c.at);
    const ux = Math.cos(th);
    const uy = Math.sin(th) * 0.8;
    const d = Math.hypot(ux, uy) || 1;
    s.add(c.lead, (L, k) => {
      const back = 4 * easeOut(k);
      const x = c.from.x + (ux / d) * (10 - back);
      const y = c.from.y - HAND - 2 + (uy / d) * (10 - back);
      flyingSpear(L.air, x, y, ux / d, uy / d, p, Math.min(1, k * 2));
      if (k > 0.5) star(L.air, x, y, 2, p, 1);
      L.light(x, y, 20, p.light, 0.6 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const OUT = 0.22;
    const HANG = 0.12;
    const BACK = 0.22;
    const a = { x: c.from.x, y: c.from.y - HAND };
    const b = { x: c.at.x, y: c.at.y - CHEST };
    const th = angle(a, b);
    const ux = Math.cos(th);
    const uy = Math.sin(th);
    s.add(OUT + HANG + BACK, (L, _k, t) => {
      let f: number;
      if (t < OUT) f = easeOut(t / OUT);
      else if (t < OUT + HANG) f = 1;
      else f = 1 - easeIn((t - OUT - HANG) / BACK);
      const x = lerp(a.x, b.x, f);
      const y = lerp(a.y, b.y, f);
      const out = t < OUT + HANG;
      // A streak of light along its way, there while it flies.
      const tl = 0.35;
      const f0 = out ? Math.max(0, f - tl) : Math.min(1, f + tl);
      for (let i = 0; i <= 12; i++) {
        const g = lerp(f0, f, i / 12);
        const X = lerp(a.x, b.x, g);
        const Y = lerp(a.y, b.y, g);
        if (dither(X, Y) < i / 12) L.air.put(Math.round(X), Math.round(Y), i > 8 ? p.hot : p.mid, 1);
      }
      flyingSpear(L.air, x, y, out ? ux : -ux, out ? uy : -uy, p);
      L.light(x, y, 22, p.light, 0.7);
    });
    const len = Math.max(1, dist(c.from, c.at));
    for (const h of c.hits) {
      const along = Math.min(1, dist(c.from, h) / len);
      s.add(0.01, () => {}, OUT * along * 0.7, () => impact(s, h, p, 0.8));
      s.add(0.01, () => {}, OUT + HANG + BACK * (1 - along), () => impact(s, h, p, 0.5));
    }
    s.add(0.2, (L, k) => star(L.air, a.x, a.y, Math.round(3 * (1 - k)) + 1, p, 1), OUT + HANG + BACK);
  },
};

/** A great winged spear standing point-down with its point at (x, tip); pixels below `floor` are in the ground. */
function greatSpear(px: Px, x: number, tip: number, p: Pal, a: number, floor = Infinity): void {
  const put = (X: number, Y: number, c: number) => {
    X = Math.round(X);
    Y = Math.round(Y);
    if (Y > floor) return;
    if (a < 1 && dither(X, Y) >= a) return;
    px.put(X, Y, c, 1);
  };
  x = Math.round(x);
  tip = Math.round(tip);
  // The head: a long leaf of light with a ridge down its middle.
  const head = 11;
  for (let i = 0; i < head; i++) {
    const u = i / head;
    const hw = Math.round(u < 0.55 ? (u / 0.55) * 2.5 : 2.5 - ((u - 0.55) / 0.45) * 1.5);
    for (let dx = -hw; dx <= hw; dx++) put(x + dx, tip - i, dx === -hw || dx === hw ? p.deep : dx === 0 ? p.core : dx < 0 ? p.hot : p.mid);
  }
  const socket = tip - head;
  // Wings spread from the socket, the valkyrie's mark.
  for (const k of [-1, 1])
    for (const [oy, len] of [[0, 6], [1, 5], [2, 3.5]] as const) {
      const n = Math.ceil(len);
      for (let i = 0; i <= n; i++) put(x + k * (1 + i), socket + oy - i * 0.7, i > n - 2 ? p.core : oy === 0 ? p.hot : p.mid);
    }
  // The shaft, lit on the left, bound in gold every so often.
  for (let i = 1; i < 34; i++) {
    const y = socket - i;
    const band = i % 11 === 0;
    put(x - 1, y, band ? p.core : p.hot);
    put(x, y, band ? p.core : p.mid);
    put(x + 1, y, band ? p.hot : p.deep);
  }
  for (let dx = -2; dx <= 2; dx++) put(x + dx, socket - 34, Math.abs(dx) === 2 ? p.deep : p.hot);
}

/** Spear of Odin: a great winged spear shines high over the crowd, falls, strikes into the ground; its runes burst a moment after. */
const spearOfOdin = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(16, c.r);
    const { x, y } = c.at;
    gather(s, c.from, p, Math.min(0.4, c.lead), 1.1);
    s.add(c.lead, (L, k) => {
      const appear = Math.min(1, k / 0.4);
      const fall = clamp01((k - 0.4) / 0.6);
      const tip = y - 110 * (1 - easeIn(fall));
      greatSpear(L.air, x, tip, p, appear);
      if (fall > 0) for (const dx of [-4, 0, 4]) line(L.air, x + dx, tip - 48, x + dx, tip - 48 - 18 * fall, p.mid, 1);
      shadowOf(L.ground, x, y, 6, fall);
      circle(L.ground, x, y, R * (1.15 - 0.15 * fall), p.mid, 1, FLAT);
      L.light(x, tip - 8, 26, p.light, 0.6 * appear);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(16, c.r);
    const Rr = R * 1.3;
    const { x, y } = c.at;
    const seed = Math.floor(Math.random() * 100);
    const BURST = 0.36;
    s.shake(170, 0.004);
    s.add(1.4, (L, k) => {
      const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      greatSpear(L.air, x, y + 5, p, a, y);
      L.light(x, y - 18, 30, p.light, 0.6 * a);
    });
    s.add(1.4, (L, k, t) => {
      const since = k * 1.4;
      const q = Math.min(1, since / 0.4);
      if (q < 1) ring(L.ground, x, y, 4 + R * easeOut(q), 3 * (1 - q) + 0.8, p, 1 - q);
      const fade = tail(k, 0.6);
      // The rune circle opens out to where it will burst, turning.
      rune(L.ground, x, y, (Rr - 3) * easeOut(Math.min(1, since / BURST)), t * 2.4, p, fade);
      const b = (since - BURST) / 0.4;
      if (b >= 0 && b < 1) {
        ring(L.ground, x, y, Rr * (0.8 + 0.2 * easeOut(b)), 3 * (1 - b) + 0.6, p, 1 - b);
        L.light(x, y - 8, Rr * 3, p.light, 1 - b);
      }
      cracks(L.ground, x, y, 6, R * 1.1, seed, Math.min(1, since / 0.1), fade, p);
      if (since < 0.2) L.light(x, y - 16, R * 4, p.light, 1 - since / 0.2);
    });
    s.add(0.01, () => {}, BURST, () => {
      s.shake(100, 0.0025);
      s.sparks(x, y, 14, p.tints, { speed: 44, up: 26, life: 0.5, z: 2, spread: Rr });
      for (const h of c.hits) impact(s, h, p, 0.6);
    });
    s.sparks(x, y, 18, p.tints, { speed: 46, up: 40, life: 0.55, z: 6 });
    s.sparks(x, y, 8, ROCK, { speed: 30, up: 36, g: 150, life: 0.5, z: 2 });
    // Feathers of light drifting down round it.
    s.sparks(x, y, 10, [0xffffff, p.core, p.hot], { speed: 14, up: 4, g: 14, life: 1.3, z: 40, spread: 30 });
    for (const h of c.hits) impact(s, h, p, 1);
  },
};

/** Thunder dive: lightning crackles round her as she gathers, then she dives on the crowd and lands with a stroke of lightning out of the sky. */
const thunderDive = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.from;
    gather(s, c.from, p, c.lead, 0.8);
    s.add(c.lead, (L, k, t) => {
      const sd = Math.floor(t * 30);
      if (hash(sd, 4) < 0.5 + k * 0.4) {
        const th = hash(sd, 5) * Math.PI * 2;
        bolt(L.air, x + Math.cos(th) * 12, y - 10 + Math.sin(th) * 8, x, y - HAND, p, sd, 1);
      }
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(14, c.r);
    const a = c.from;
    const b = c.at;
    // Her dive: a bright streak arcing from where she was to where she lands.
    s.add(0.3, (L, k) => {
      const head = easeIn(Math.min(1, k / 0.6));
      const tl = clamp01((k - 0.25) / 0.75);
      for (let i = 0; i <= 16; i++) {
        const f = lerp(tl, head, i / 16);
        const X = lerp(a.x, b.x, f);
        const Y = lerp(a.y, b.y, f) - 12 - Math.sin(f * Math.PI) * 18;
        const c2 = i > 12 ? p.core : i > 6 ? p.hot : p.mid;
        dot(L.air, X, Y, c2, 1, i > 10 ? 2 : 1);
      }
    });
    s.add(0.01, () => {}, 0.12, () => {
      skyBolt(s, b, p, R * 1.2);
      shock(s, b, R, p, 0.4, 2);
      s.shake(110, 0.003);
    });
    for (const h of c.hits) impact(s, h, p, 0.9);
  },
};

/** Thunder of Asgard: a crackling ring of storm opens round her, and lightning strikes her foes within it one after another. */
const asgardThunder = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(24, c.r);
    const { x, y } = c.from;
    gather(s, c.from, p, Math.min(0.4, c.lead), 1.2);
    s.add(c.lead, (L, k, t) => {
      const r = R * easeOut(k);
      ring(L.ground, x, y, r, 0.9, p, 0.9, 0.45, Math.floor(t * 11));
      L.light(x, y - 10, r * 2, p.light, 0.4 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(24, c.r);
    const { x, y } = c.from;
    const life = c.span + 0.5;
    s.shake(130, 0.003);
    s.add(life, (L, k, t) => {
      const fade = tail(k, 0.85);
      const sd = Math.floor(t * 11);
      ring(L.ground, x, y, R, 0.9, p, 0.85 * fade, 0.45, sd);
      ring(L.ground, x, y, R * 0.55, 0.6, p, 0.4 * fade, 0.6, sd + 5);
      // Arcs crackling round the ring.
      const s2 = Math.floor(t * 25);
      if (hash(s2, 1) < 0.6 * fade) {
        const th = hash(s2, 2) * Math.PI * 2;
        const th2 = th + 0.5 + hash(s2, 3) * 0.4;
        bolt(L.ground, x + Math.cos(th) * R, y + Math.sin(th) * R * FLAT, x + Math.cos(th2) * R, y + Math.sin(th2) * R * FLAT, p, s2, 1);
      }
      L.light(x, y - 30, R * 2.5, p.light, 0.4 * fade * (0.8 + 0.2 * Math.sin(t * 50)));
    });
    const n = Math.max(1, c.path.length);
    c.path.forEach((to, i) =>
      s.add(0.01, () => {}, (c.span * i) / n, () => {
        skyBolt(s, to, p, 12);
        impact(s, to, p, 0.7);
      }),
    );
  },
};

export const ORDER_KITS: Record<string, Kit> = {
  'archer.arbalest': { shot: arbalestShot, skill: netBolt, ult: blackPowder },
  'warrior.knight': { melee: knightMelee, skill: fireWhirl, ult: skybreaker },
  'warrior.king': { melee: kingMelee, skill: decree, ult: crownOfKings },
  'paladin.holy': { melee: paladinMelee, skill: consecrate, ult: heavensLight },
  'paladin.crusader': { melee: crusaderMelee, skill: sunfire, ult: wrathOfSun },
  'jedi.knight': { melee: jediMelee, skill: forcePush, ult: saberCyclone },
  'valkyrie.spear': { melee: spearMelee(false), skill: spearOfLight, ult: spearOfOdin },
  'valkyrie.storm': { melee: spearMelee(true), skill: thunderDive, ult: asgardThunder },
};
