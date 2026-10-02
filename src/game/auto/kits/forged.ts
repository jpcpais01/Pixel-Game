// The Forged heroes' effects on the board: the Plague Doctor's tumbling
// flasks, great flask and Pestilence; the Chemtech's acid vials, chem fan and
// Chem Bomb; the Siege Mech's tracer rounds, homing missiles and Siege Mode;
// the Synth's drones, laser grid and Swarm Protocol; the Engineer's wrench,
// sentry turret and Mega Sentry. Glass, steel, brass and smoke keep their own
// colours; everything that glows takes the palette, so skins recolour it.

import {
  angle,
  bolt,
  bump,
  CHEST,
  circle,
  column,
  dark,
  disc,
  dist,
  dither,
  dot,
  easeIn,
  easeOut,
  fall,
  FLAT,
  hash,
  lerp,
  line,
  orb,
  pool,
  ring,
  shadowOf,
  sprite,
  star,
  tail,
  type Cast,
  type Kit,
  type Layers,
  type Pal,
  type Pt,
  type Px,
  type Stage,
} from '../paint';
import { flight, gather, HAND, scorch, smoke, splash, trail } from './common';
import { BREWMASTER_KIT } from './brewmaster';

// --- Materials -------------------------------------------------------------------

const GLASS = [0xeefcff, 0xbfe2ea, 0x7fa8b8];
const CORK = 0x8a5a32;
const STEEL_HI = 0xe2e8ee;
const STEEL = 0xa8b2be;
const STEEL_MID = 0x7a8494;
const STEEL_DK = 0x4a5260;
const STEEL_EDGE = 0x2a2e38;
const HAZARD_Y = 0xf4c838;
const HAZARD_K = 0x26242a;
const BRASS = [0xf0d070, 0xb8862a];
const SMOKE_LIGHT = 0xc8c2cc;
const SMOKE_MID = 0x8a8490;
const SMOKE_DK = 0x5a5462;
const STEAM = 0xdfe6ee;
const DRONE = [0xf2f6ff, 0xd2dae8, 0xa8b2c4, 0x8690a4];
const BEE = [0xf4c63e, 0x221f32, 0xc8901e, 0xfff4d0];

// --- Shared pieces ---------------------------------------------------------------

/** A little bitmap from letter rows, turned by `th` round its middle and scaled by `sc`: tumbling flasks, canisters. */
function spin(px: Px, x: number, y: number, rows: string[], cols: Record<string, number>, th: number, a = 1, sc = 1): void {
  const h = rows.length;
  const w = rows[0].length;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const R = Math.ceil((Math.hypot(w, h) / 2) * sc) + 1;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const X0 = Math.round(x);
  const Y0 = Math.round(y);
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const i = Math.round((dx * c + dy * s) / sc + cx);
      const j = Math.round((-dx * s + dy * c) / sc + cy);
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const col = cols[rows[j][i]];
      if (col === undefined) continue;
      if (a < 1 && dither(X0 + dx, Y0 + dy) >= a) continue;
      px.put(X0 + dx, Y0 + dy, col, 1);
    }
}

/** A soft round cloud: solid at heart, dithering away at its edge, lit from above. */
function puff(px: Px, x: number, y: number, r: number, top: number, body: number, rim: number, a: number): void {
  if (r <= 0 || a <= 0) return;
  for (let dy = -Math.ceil(r); dy <= r; dy++)
    for (let dx = -Math.ceil(r); dx <= r; dx++) {
      const d = Math.hypot(dx, dy * 1.2) / r;
      if (d > 1) continue;
      const X = Math.round(x + dx);
      const Y = Math.round(y + dy);
      if (dither(X, Y) >= a * (1 - d * d)) continue;
      px.put(X, Y, dy < -r * 0.35 && d < 0.75 ? top : d < 0.6 ? body : rim, 1);
    }
}

/** A ring of yellow and black hazard stripes on the ground, turning with `rot`. */
function hazardRing(px: Px, cx: number, cy: number, r: number, rot: number, a = 1): void {
  const n = Math.max(16, Math.ceil(r * 7));
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const c = Math.floor(((th + rot) * r) / 3.5) % 2 ? HAZARD_Y : HAZARD_K;
    for (const rr of [r, r - 1]) {
      const x = Math.round(cx + Math.cos(th) * rr);
      const y = Math.round(cy + Math.sin(th) * rr * FLAT);
      if (a < 1 && dither(x, y) >= a) continue;
      px.put(x, y, c, 1);
    }
  }
}

/** Glass breaking: shards glinting out and droplets of brew thrown up. */
function shatter(s: Stage, at: Pt, p: Pal, n: number, h: number): void {
  s.sparks(at.x, at.y, n, GLASS, { speed: 34, up: 34, g: 150, life: 0.5, z: h });
  s.sparks(at.x, at.y, Math.round(n * 0.8), [p.hot, p.mid, p.core], { speed: 22, up: 44, g: 170, life: 0.55, z: h });
}

/**
 * A puddle of brew soaking into the ground: it spreads fast, glints, and
 * bubbles (each bubble swells and pops) until it dries away in a checker.
 */
function puddle(s: Stage, at: Pt, r: number, p: Pal, dur: number, bubbles: number, wait = 0): void {
  const seed = Math.random() * 1000;
  const murk = dark(p.deep, 0.45);
  s.add(
    dur,
    (L, k, t) => {
      const a = tail(k, 0.55);
      const rr = r * easeOut(Math.min(1, k * 6));
      pool(L.ground, at.x, at.y, rr, p.deep, murk, a, 0.85);
      // A wet rim catching the light.
      if (a > 0.3) circle(L.ground, at.x, at.y, rr, p.mid, a, FLAT, t * 0.5, t * 0.5 + 2.2);
      for (let i = 0; i < bubbles; i++) {
        const life = (t * 1.6 + hash(i, seed)) % 1;
        const round = Math.floor(t * 1.6 + hash(i, seed));
        const th = hash(i, seed, round) * Math.PI * 2;
        const d = Math.sqrt(hash(i, seed, round + 7)) * rr * 0.75;
        const x = at.x + Math.cos(th) * d;
        const y = at.y + Math.sin(th) * d * FLAT;
        if (dither(x, y + i) >= a) continue;
        if (life < 0.75) {
          const br = life < 0.4 ? 0 : 1;
          if (br) circle(L.ground, x, y - 1, 1.2, p.hot, 1, 1);
          else dot(L.ground, x, y, p.mid);
          dot(L.ground, x - br, y - 1 - br, p.core);
        } else if (life < 0.85) {
          // The pop: four specks flung out.
          for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [1, -1]]) dot(L.ground, x + ox, y + oy - 1, p.hot);
        }
      }
      L.light(at.x, at.y - 3, rr * 2 + 8, p.light, 0.25 * a);
    },
    wait,
  );
}

/** A soft trail of smoke left behind something flying: each puff swells, rises a little and thins away. */
class SmokeTrail {
  private pts: { x: number; y: number; t: number; s: number }[] = [];
  constructor(
    private life = 0.55,
    private size = 1.8,
  ) {}
  push(x: number, y: number, t: number): void {
    const last = this.pts[this.pts.length - 1];
    if (last && Math.hypot(last.x - x, last.y - y) < 2.2) return;
    this.pts.push({ x, y, t, s: Math.random() });
  }
  draw(px: Px, t: number): void {
    for (const q of this.pts) {
      const age = (t - q.t) / this.life;
      if (age >= 1 || age < 0) continue;
      const r = 0.5 + this.size * easeOut(age);
      const c = age < 0.25 ? SMOKE_LIGHT : age < 0.6 ? SMOKE_MID : SMOKE_DK;
      disc(px, q.x + (q.s - 0.5) * 3 * age, q.y - age * 4, r, r, c, (1 - age) * 0.95);
    }
  }
}

/** A blast of fire and smoke where a rocket or missile lands. */
function boom(s: Stage, at: Pt, p: Pal, size: number, h = 6): void {
  const R = 6 + 8 * size;
  s.add(0.5, (L, k) => {
    ring(L.ground, at.x, at.y, R * easeOut(k), 1.5, p, 1 - k);
    // The fireball: a white flash swelling into the palette's flame, then gone.
    if (k < 0.4) {
      const f = k / 0.4;
      orb(L.air, at.x, at.y - h - f * 3, (3 + 4 * size) * easeOut(Math.min(1, f * 2)) * (1 - f * 0.4), p, 1 - f * 0.6);
    }
    if (k < 0.12) star(L.air, at.x, at.y - h, Math.round(3 + 3 * size), p, 1);
    L.light(at.x, at.y - h, 30 + 30 * size, p.light, 1 - k);
  });
  smoke(s, at, Math.round(2 + 2 * size), SMOKE_MID, 2.5 + size, 0.8, h + 2);
  scorch(s, at, 4 + 4 * size, 1.1);
  s.sparks(at.x, at.y, Math.round(8 + 8 * size), [p.core, p.hot, p.mid, p.deep], { speed: 34 + 10 * size, up: 40, g: 110, life: 0.5, z: h });
}

/** A missile, nose to tail along `th`: a coloured warhead, a steel body, fins and a flickering jet. */
function missile(px: Px, x: number, y: number, th: number, p: Pal, t: number, sc = 1): void {
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  const at = (i: number, j = 0, c: number) => px.put(Math.round(x - ux * i * sc - uy * j), Math.round(y - uy * i * sc + ux * j), c, 1);
  at(0, 0, p.hot);
  at(1, 0, p.deep);
  at(2, 0, STEEL_HI);
  at(3, 0, STEEL);
  at(2, 1, STEEL_MID);
  at(3, 1, STEEL_DK);
  at(4, 0, STEEL_MID);
  at(4, -1, STEEL_DK);
  at(4, 2, STEEL_DK);
  // The jet, flickering.
  const f = Math.floor(t * 40) % 2;
  at(5, 0, 0xffffff);
  at(6, 0, p.hot);
  if (f) at(7, 0, p.mid);
}

/** A muzzle's flash: a white burst and a star of the palette, at (x, y) pointing along `th`. */
function muzzle(L: Layers, x: number, y: number, th: number, p: Pal, size = 1): void {
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  for (let i = 0; i <= 2 + size; i++) dot(L.air, x + ux * i, y + uy * i, i < 2 ? 0xffffff : p.hot);
  dot(L.air, x + ux - uy * 1.5, y + uy + ux * 1.5, p.hot);
  dot(L.air, x + ux + uy * 1.5, y + uy - ux * 1.5, p.hot);
  orb(L.air, x, y, 1 + size, p, 1);
  L.light(x, y, 16 + 10 * size, p.light, 0.9);
}

/** A tracer round from a to b (points in the air) taking `dur`: a short white-hot streak; `done` as it lands. */
function tracer(s: Stage, a: Pt, b: Pt, dur: number, p: Pal, wait = 0, done?: () => void): void {
  s.add(
    dur,
    (L, k) => {
      const x = lerp(a.x, b.x, k);
      const y = lerp(a.y, b.y, k);
      const th = Math.atan2(b.y - a.y, b.x - a.x);
      const len = Math.min(6, dist(a, b) * k);
      line(L.air, x - Math.cos(th) * len, y - Math.sin(th) * len, x, y, p.hot);
      line(L.air, x - Math.cos(th) * len * 0.5, y - Math.sin(th) * len * 0.5, x, y, 0xffffff);
      L.light(x, y, 10, p.light, 0.5);
    },
    wait,
    done,
  );
}

/** Brass casings kicked out of a gun's side, tumbling to the ground. */
function casings(s: Stage, x: number, y: number, h: number, side: number, n = 1): void {
  s.sparks(x, y, n, BRASS, { speed: 26, up: 34, g: 170, life: 0.45, z: h, dir: side > 0 ? 0 : Math.PI, cone: 0.5 });
}

/** A small strike of a round on a foe: chips and a glint. */
function ping(s: Stage, at: Pt, p: Pal): void {
  s.add(0.14, (L, k) => {
    star(L.air, at.x, at.y - CHEST, k < 0.5 ? 2 : 1, p, 1);
    L.light(at.x, at.y - CHEST, 14, p.light, 0.7 * (1 - k));
  });
  s.sparks(at.x, at.y, 4, [p.core, p.hot, STEEL], { speed: 26, up: 20, life: 0.25, z: CHEST });
}

// --- The Plague Doctor -------------------------------------------------------------

/** A round-bottomed flask, corked, brew sloshing in it with a glint of light. */
const FLASK = ['..k..', '..g..', '.gag.', 'gwbbg', 'gbbbg', 'gcbcg', '.ggg.'];
const flaskCols = (p: Pal) => ({ k: CORK, g: GLASS[1], w: 0xffffff, a: p.hot, b: p.mid, c: p.deep });

/** A thrown flask tumbling end over end on a lob, breaking into a bubbling puddle. */
function flaskShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 7);
  const cols = flaskCols(p);
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    trail(L, pos, k, 4, 0.05, [p.hot, p.mid, p.deep]);
    spin(L.air, q.x, q.y, FLASK, cols, t * 16);
    shadowOf(L.ground, lerp(a.x, b.x, k), lerp(a.y, b.y, k), 3, 0.5);
    L.light(q.x, q.y, 12, p.light, 0.4);
  }, 0, () => {
    shatter(s, b, p, 6, 6);
    puddle(s, b, 6, p, 0.8, 3);
    s.add(0.22, (L, k) => {
      ring(L.ground, b.x, b.y, 3 + 6 * easeOut(k), 1, p, 1 - k);
      L.light(b.x, b.y - 6, 18, p.light, 0.7 * (1 - k));
    });
    s.add(0.6, (L, k) => puff(L.air, b.x, b.y - 6 - k * 6, 2.5 + 2 * k, p.hot, p.mid, p.deep, 0.8 * (1 - k)));
  });
}

/** The great flask, lobbed high: tumbling slowly over, a shadow swelling under it, then a crash of glass and a spreading, steaming pool. */
const greatFlask = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const cols = flaskCols(p);
    const a = { x: c.from.x, y: c.from.y - HAND - 4 };
    s.add(c.lead, (L, k, t) => {
      const x = lerp(a.x, c.at.x, k);
      const gy = lerp(c.from.y, c.at.y, k);
      // Up out of the hand on a high arc, down onto the spot as the hit lands.
      const y = lerp(a.y, c.at.y - 4, k) - Math.sin(k * Math.PI) * 34;
      shadowOf(L.ground, x, gy, 6, k);
      spin(L.air, x, y, FLASK, cols, t * 9 + 0.6, 1, 2);
      // A wisp of brew leaking from the neck as it turns.
      if (k > 0.1) dot(L.air, x + Math.sin(t * 9) * 5, y - Math.cos(t * 9) * 5, p.hot);
      L.light(x, y, 18, p.light, 0.5);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(12, c.r);
    s.shake(90, 0.002);
    shatter(s, c.at, p, 12, 4);
    splash(s, c.at, p, 8, 30, 4);
    puddle(s, c.at, R * 0.9, p, 1.8, 7);
    s.add(0.35, (L, k) => {
      ring(L.ground, c.at.x, c.at.y, R * easeOut(k), 2, p, 1 - k);
      if (k < 0.3) orb(L.air, c.at.x, c.at.y - 5, 5 * easeOut(k / 0.3), p, 1 - k / 0.3);
      L.light(c.at.x, c.at.y - 6, R * 3, p.light, 1 - k);
    });
    // Fumes boiling up off the pool and drifting away.
    for (let i = 0; i < 5; i++) {
      const th = (i / 5) * Math.PI * 2 + Math.random();
      const d = R * 0.45 * Math.random();
      const x = c.at.x + Math.cos(th) * d;
      const y = c.at.y + Math.sin(th) * d * FLAT;
      const drift = (Math.random() - 0.5) * 8;
      s.add(1.1, (L, k) => puff(L.air, x + drift * k, y - 4 - 14 * easeOut(k), 3 + 3 * k, p.hot, p.mid, p.deep, 0.85 * bump(Math.min(1, k * 1.6 + 0.2))), 0.05 + i * 0.12);
    }
    for (const h of c.hits) sick(s, h, p, 1.2);
  },
};

/** Poisoned: green bubbles rising off a foe and popping, for `sec`. */
function sick(s: Stage, at: Pt, p: Pal, sec: number): void {
  const seed = Math.random() * 100;
  s.add(sec, (L, k, t) => {
    const a = tail(k, 0.7);
    for (let i = 0; i < 3; i++) {
      const life = (t * 1.3 + i / 3) % 1;
      const x = at.x + (hash(i, seed, Math.floor(t * 1.3 + i / 3)) - 0.5) * 10;
      const y = at.y - 8 - life * 18;
      if (dither(x, y) >= a) continue;
      if (life < 0.8) circle(L.air, x, y, life < 0.4 ? 0.8 : 1.4, life < 0.4 ? p.mid : p.hot, 1, 1);
      else star(L.air, x, y, 1, p, 1);
    }
  });
}

/** A grinning skull, for the miasma's heart. */
const SKULL = ['.aaaaa.', 'aaaaaaa', 'a..a..a', 'aaaaaaa', '.aa.aa.', '.a.a.a.'];

/** Pestilence: he raises a bubbling flask while the miasma gathers on the spot; then it settles, a great churning cloud with a skull in its heart. */
const pestilence = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(18, c.r);
    const cols = flaskCols(p);
    const seed = Math.random() * 100;
    // The flask held up high, boiling over.
    s.add(c.lead, (L, k, t) => {
      const x = c.from.x + 3;
      const y = c.from.y - HAND - 10 - easeOut(Math.min(1, k * 3)) * 4;
      spin(L.air, x, y, FLASK, cols, Math.sin(t * 14) * 0.25, 1, 2);
      for (let i = 0; i < 4; i++) {
        const life = (t * 1.8 + i / 4) % 1;
        puff(L.air, x + Math.sin(t * 4 + i) * 2 * life, y - 8 - life * 12, 1 + life * 2, p.hot, p.mid, p.deep, (1 - life) * 0.9);
      }
      L.light(x, y, 22 + 14 * k, p.light, 0.6);
    });
    // The murk crawling in from all round the spot, wisps winding to its heart.
    s.add(c.lead, (L, k) => {
      const { x, y } = c.at;
      pool(L.ground, x, y, R * easeOut(k), dark(p.deep, 0.3), dark(p.deep, 0.6), 0.75 * k, 0.75);
      for (let i = 0; i < 12; i++) {
        const life = (k * 1.6 + hash(i, seed)) % 1;
        const th = hash(i, seed, 1) * Math.PI * 2 + life * 2.4;
        const d = (1 - easeIn(life)) * R * 1.2;
        const px = x + Math.cos(th) * d;
        const py = y - 3 + Math.sin(th) * d * FLAT;
        dot(L.air, px, py, p.mid);
        dot(L.air, px - Math.sin(th) * 2, py + Math.cos(th) * 1.2, p.deep);
      }
      L.light(x, y - 6, R * 2, p.deep, 0.4 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(18, c.r);
    const { x, y } = c.at;
    const murk = dark(p.deep, 0.5);
    s.shake(120, 0.003);
    puddle(s, c.at, R, p, 2.6, 8);
    s.add(0.4, (L, k) => {
      ring(L.ground, x, y, R * (0.4 + 0.7 * easeOut(k)), 2, p, 1 - k);
      L.light(x, y - 10, R * 3, p.light, 1 - k);
    });
    s.add(2.6, (L, k, t) => {
      const a = (k < 0.08 ? k / 0.08 : 1) * tail(k, 0.7);
      const swell = easeOut(Math.min(1, k * 4));
      // The miasma: puffs wheeling slowly round its heart, rising and falling.
      for (let i = 0; i < 9; i++) {
        const th = (i / 9) * Math.PI * 2 + t * 0.9;
        const d = R * 0.55 * swell;
        const px = x + Math.cos(th) * d;
        const py = y - 9 + Math.sin(th) * d * FLAT + Math.sin(t * 3 + i) * 1.5;
        puff(L.air, px, py, (5 + 2 * Math.sin(t * 2 + i * 1.7)) * (0.5 + 0.5 * swell), p.mid, p.deep, murk, a * 0.9);
      }
      puff(L.air, x, y - 14, 7 * swell, p.mid, p.deep, murk, a * 0.95);
      // The skull grinning out of the murk now and then.
      const show = 0.5 + 0.5 * Math.sin(t * 2.6);
      if (show > 0.3) sprite(L.air, x, y - 10, SKULL, { a: p.hot }, a * show, { ay: SKULL.length });
      // Spores drifting up off it.
      for (let i = 0; i < 5; i++) {
        const life = (t * 0.8 + i / 5) % 1;
        const sx = x + (hash(i, Math.floor(t * 0.8 + i / 5)) - 0.5) * R * 1.4;
        if (dither(sx, i) < a) dot(L.air, sx + Math.sin(t * 5 + i) * 1.5, y - 14 - life * 22, life < 0.5 ? p.hot : p.mid);
      }
      L.light(x, y - 10, R * 2.5, p.light, 0.45 * a);
    });
    for (const h of c.hits) sick(s, h, p, 2.2);
  },
};

// --- The Chemtech --------------------------------------------------------------------

/** A steel chem canister: capped ends, brew glowing in its window, a yellow and black hazard band. */
const CANISTER = ['.sss.', 'dLLLd', 'dLwLd', 'dLLLd', 'dykyd', 'dLLLd', 'dMMMd', '.sss.'];
const canCols = (p: Pal) => ({ s: STEEL_HI, d: STEEL_EDGE, L: p.mid, M: p.deep, w: p.core, y: HAZARD_Y, k: HAZARD_K });

/** Acid biting where a vial breaks: a splash, a hiss of steam and a small seething pool. */
function acidSplash(s: Stage, at: Pt, p: Pal, size: number): void {
  splash(s, at, p, Math.round(5 + 4 * size), 24 + 6 * size, 6);
  puddle(s, at, 5 + 5 * size, p, 0.7 + 0.5 * size, Math.round(2 + 3 * size));
  smoke(s, at, Math.round(1 + size), STEAM, 1.6 + size, 0.6, 4);
  s.add(0.24, (L, k) => {
    ring(L.ground, at.x, at.y, (4 + 8 * size) * easeOut(k), 1, p, 1 - k);
    if (k < 0.4) star(L.air, at.x, at.y - 6, Math.round(2 + 2 * size), p, 1);
    L.light(at.x, at.y - 6, 18 + 14 * size, p.light, 0.8 * (1 - k));
  });
}

/** A chem vial spinning on a low lob, dripping acid on the way. */
function vialShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const pos = flight(a, b, 5);
  const cols = canCols(p);
  s.add(dur, (L, k, t) => {
    const q = pos(k);
    trail(L, pos, k, 5, 0.04, [p.hot, p.mid, p.mid, p.deep]);
    spin(L.air, q.x, q.y, CANISTER, cols, t * 18);
    if (Math.random() < 0.35) s.sparks(q.x, q.y + CHEST, 1, [p.hot], { speed: 2, up: 0, g: 120, life: 0.3, z: CHEST });
    L.light(q.x, q.y, 12, p.light, 0.45);
  }, 0, () => acidSplash(s, b, p, 0.6));
}

/** The chem fan: three vials juggled in the hand, then flung in a fan, each bursting on its foe in turn. */
const chemFan = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const cols = canCols(p);
    s.add(c.lead, (L, k, t) => {
      for (let i = 0; i < 3; i++) {
        const th = t * 9 + (i / 3) * Math.PI * 2;
        const x = c.from.x + Math.cos(th) * 5;
        const y = c.from.y - HAND - 6 - Math.abs(Math.sin(th)) * 7 * easeOut(Math.min(1, k * 3));
        spin(L.air, x, y, CANISTER, cols, th * 1.3);
      }
      L.light(c.from.x, c.from.y - HAND - 8, 22, p.light, 0.5 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const pts = c.path.length ? c.path : [c.at];
    const cols = canCols(p);
    const a = { x: c.from.x, y: c.from.y };
    pts.forEach((to, i) => {
      const land = (c.span * i) / pts.length;
      // The first is already on its way out of the hand; the others leave in turn.
      const fl = i === 0 ? 0.16 : 0.3;
      const pos = flight(a, to, 5 + i * 4, HAND - (HAND - CHEST) * 0.5);
      s.add(
        fl,
        (L, k, t) => {
          const q = pos(k);
          trail(L, pos, k, 4, 0.05, [p.hot, p.mid, p.deep]);
          spin(L.air, q.x, q.y, CANISTER, cols, t * 20 + i);
          L.light(q.x, q.y, 12, p.light, 0.45);
        },
        Math.max(0, land - fl),
        () => acidSplash(s, to, p, 1),
      );
    });
  },
};

/** The Chem Bomb: a great canister heaved high, tumbling down onto a hazard ring; then a towering green blast and acid seething where it burst. */
const chemBomb = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(18, c.r);
    const cols = canCols(p);
    const a = { x: c.from.x, y: c.from.y - HAND - 4 };
    s.add(c.lead, (L, k, t) => {
      const x = lerp(a.x, c.at.x, k);
      const y = lerp(a.y, c.at.y - 6, k) - Math.sin(k * Math.PI) * 52;
      shadowOf(L.ground, x, lerp(c.from.y, c.at.y, k), 7, k);
      spin(L.air, x, y, CANISTER, cols, t * 7, 1, 2);
      // A blinking hazard ring on the spot it will hit.
      const blink = Math.floor(t * (6 + 10 * k)) % 2 === 0;
      hazardRing(L.ground, c.at.x, c.at.y, R * (1.1 - 0.15 * easeOut(k)), t * 2, blink ? 1 : 0.5);
      L.light(x, y, 20, p.light, 0.5);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const R = Math.max(18, c.r);
    const { x, y } = c.at;
    s.shake(220, 0.005);
    puddle(s, c.at, R * 1.05, p, 2.2, 9);
    s.add(0.55, (L, k) => {
      ring(L.ground, x, y, 6 + R * 1.3 * easeOut(k), 3 * (1 - k) + 1, p, 1 - k);
      ring(L.ground, x, y, 4 + R * 0.8 * easeOut(Math.min(1, k * 1.3)), 1, p, 0.8 * (1 - k), 0.4, 5);
      if (k < 0.25) orb(L.air, x, y - 8, 10 * easeOut(k / 0.25), p, 1);
      L.light(x, y - 16, R * 4, p.light, 1 - k);
    });
    // The blast's cloud: a stem of green fire, and a cap boiling up over it and thinning away.
    s.add(1.3, (L, k, t) => {
      const up = easeOut(Math.min(1, k * 2));
      const a = 1 - k;
      column(L.air, x, y, 44 * up, 3.5 * (1 - k) + 1.5, p, a, t);
      for (let i = 0; i < 8; i++) {
        const th = (i / 8) * Math.PI * 2 + t * 1.6;
        const cx = x + Math.cos(th) * 10 * up;
        const cy = y - 44 * up + Math.sin(th) * 4 * up - 2;
        puff(L.air, cx, cy, 4 + 3 * up, p.hot, p.mid, p.deep, a * 0.95);
      }
      puff(L.air, x, y - 46 * up - 3, 6 * up, p.core, p.hot, p.mid, a);
      L.light(x, y - 40 * up, 40, p.light, 0.6 * a);
    });
    shatter(s, c.at, p, 10, 8);
    s.sparks(x, y, 24, [p.core, p.hot, p.mid, p.deep], { speed: 44, up: 60, g: 100, life: 0.8, z: 6, spread: 8 });
    smoke(s, c.at, 4, STEAM, 3, 1.2, 4);
    for (const h of c.hits) sick(s, h, p, 1.6);
  },
};

// --- The Siege Mech ------------------------------------------------------------------

/** A tracer round from the mech's arm cannon: muzzle flash, a streak, a casing kicked out, chips on the foe. */
function bulletShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal): void {
  const side = b.x >= a.x ? 1 : -1;
  const m = { x: a.x + side * 7, y: a.y - CHEST - 1 };
  const th = Math.atan2(b.y - CHEST - m.y, b.x - m.x);
  const mx = m.x + Math.cos(th) * 3;
  const my = m.y + Math.sin(th) * 3;
  s.add(0.07, (L) => muzzle(L, mx, my, th, p, 1));
  casings(s, a.x + side * 4, a.y, CHEST + 2, -side, 1);
  const end = { x: b.x, y: b.y - CHEST };
  tracer(s, { x: mx, y: my }, end, dur, p, 0, () => ping(s, b, p));
  // A second round on its heels.
  tracer(s, { x: mx, y: my }, end, dur, p, 0.05, () => ping(s, b, p));
}

/** Missiles: hatches open on the shoulders and three rockets climb out; then each curls over and dives onto its foe, smoke trailing. */
const missiles = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const trails = [0, 1, 2].map(() => new SmokeTrail(0.6, 1.6));
    s.add(c.lead + 0.6, (L, k, t) => {
      trails.forEach((tr, i) => {
        if (t <= c.lead) {
          const q = climb(c.from, i, t / c.lead);
          tr.push(q.x, q.y + 3, t);
          missile(L.air, q.x, q.y, -Math.PI / 2 + (i - 1) * 0.25 * (1 - t / c.lead), p, t);
          L.light(q.x, q.y + 4, 12, p.light, 0.5);
        }
        tr.draw(L.air, t);
      });
      // The pods' lids open and their red lights wink.
      if (t < c.lead) {
        for (const side of [-1, 1]) {
          const hx = c.from.x + side * 5;
          const hy = c.from.y - 21;
          line(L.air, hx - 2, hy, hx + 2, hy - 2 * side * (k > 0 ? 1 : 0), STEEL);
          if (Math.floor(t * 20) % 2) dot(L.air, hx, hy + 1, 0xff4040);
        }
      }
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const pts = c.path.length ? c.path : [c.at];
    pts.forEach((to, i) => {
      const start = climb(c.from, i % 3, 1);
      const land = Math.max(0.22, (c.span * i) / pts.length);
      const end = { x: to.x, y: to.y - 5 };
      const ctrl = { x: lerp(start.x, end.x, 0.4) + (i % 3 - 1) * 14, y: Math.min(start.y, end.y) - 30 };
      const at = (u: number): Pt => ({
        x: (1 - u) * (1 - u) * start.x + 2 * u * (1 - u) * ctrl.x + u * u * end.x,
        y: (1 - u) * (1 - u) * start.y + 2 * u * (1 - u) * ctrl.y + u * u * end.y,
      });
      const tr = new SmokeTrail(0.6, 1.6);
      s.add(land + 0.6, (L, _k, t) => {
        if (t < land) {
          const u = easeIn(t / land) * 0.85 + (t / land) * 0.15;
          const q = at(u);
          const r = at(Math.max(0, u - 0.04));
          tr.push(q.x, q.y, t);
          missile(L.air, q.x, q.y, Math.atan2(q.y - r.y, q.x - r.x), p, t);
          L.light(q.x, q.y, 12, p.light, 0.5);
        }
        tr.draw(L.air, t);
      }, 0);
      s.add(0.01, () => {}, land, () => {
        boom(s, to, p, 0.8);
        if (i === pts.length - 1) s.shake(90, 0.002);
      });
    });
  },
};

/** Where missile `i` of three is on its climb out of the pods (u 0..1). */
function climb(from: Pt, i: number, u: number): Pt {
  const e = easeOut(u);
  const side = i - 1;
  return { x: from.x + side * 5 + side * 6 * e, y: from.y - 20 - e * (30 + (i % 2) * 6) };
}

/** Siege Mode: the mech sinks onto four stabilisers, armour plates lock round it with a ring of hazard stripes, and its guns spin up glowing hot. */
const siege = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.from;
    s.add(c.lead, (L, k, t) => {
      struts(L, x, y, easeIn(k) * 0.9);
      // Steam hissing out of its joints as it braces.
      for (const side of [-1, 1]) {
        const life = (t * 3 + (side > 0 ? 0.5 : 0)) % 1;
        puff(L.air, x + side * (6 + life * 6), y - 8 - life * 6, 1 + life * 2, STEAM, SMOKE_LIGHT, SMOKE_MID, 0.9 * (1 - life));
      }
      L.light(x, y - 12, 24, p.light, 0.4 * k);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const { x, y } = c.from;
    s.shake(130, 0.003);
    s.sparks(x, y, 14, [SMOKE_LIGHT, SMOKE_MID, 0x9a8a78], { speed: 30, up: 14, g: 40, life: 0.6, ground: true, spread: 14 });
    const hold = 2.6;
    s.add(hold, (L, k, t) => {
      const a = tail(k, 0.8);
      struts(L, x, y, 1, a);
      hazardRing(L.ground, x, y, 14, 0, a);
      // Armour plates: an octagon of steel locking in round its body, a glint racing round it.
      const lock = easeOut(Math.min(1, k * 6));
      const R = 15 - 3 * lock;
      if (k < 0.5) {
        const fa = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.15;
        for (let i = 0; i < 8; i++) {
          const t0 = (i / 8) * Math.PI * 2 + Math.PI / 8;
          const t1 = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8;
          const x0 = x + Math.cos(t0) * R;
          const y0 = y - 12 + Math.sin(t0) * R * 1.15;
          const x1 = x + Math.cos(t1) * R;
          const y1 = y - 12 + Math.sin(t1) * R * 1.15;
          const glint = Math.floor(k * 30) % 8 === i;
          line(L.air, x0, y0, x1, y1, glint ? p.core : i % 2 ? p.hot : p.mid, fa);
        }
      }
      // The guns, either side: barrels spinning, heat glowing up the palette, shimmer rising.
      const heat = Math.min(1, k * 3);
      for (const side of [-1, 1]) {
        const gx = x + side * 9;
        const gy = y - CHEST - 1;
        const sp = t * 40;
        for (let b = 0; b < 3; b++) {
          const th = sp + (b / 3) * Math.PI * 2;
          dot(L.air, gx + side * 2, gy + Math.sin(th) * 1.5, Math.cos(th) > 0 ? STEEL_HI : STEEL_DK);
        }
        dot(L.air, gx + side * 3, gy, heat > 0.6 ? p.core : heat > 0.3 ? p.hot : p.mid, a);
        dot(L.air, gx + side * 3, gy - 1, p.mid, a * heat);
        for (let i = 0; i < 3; i++) {
          const life = (t * 1.5 + i / 3) % 1;
          dot(L.air, gx + side * 3 + Math.sin(t * 12 + i * 2) * 1.2, gy - 2 - life * 9, life < 0.4 ? p.hot : p.deep, a * heat * (1 - life));
        }
        L.light(gx + side * 3, gy, 14, p.light, 0.6 * a * heat);
        if (Math.floor(t * 9 + (side > 0 ? 0.5 : 0)) !== Math.floor((t - 0.016) * 9 + (side > 0 ? 0.5 : 0)) && k < 0.75) casings(s, gx, y, CHEST, side, 1);
      }
      if (k < 0.1) L.light(x, y - 12, 60, p.light, 1 - k / 0.1);
    });
    s.add(0.5, (L, k) => {
      ring(L.ground, x, y, 22 * easeOut(k), 2, p, 1 - k);
    });
  },
};

/** Four stabiliser legs out from the mech's hips to pads on the ground, `out` 0..1 of the way down. */
function struts(L: Layers, x: number, y: number, out: number, a = 1): void {
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const hx = x + sx * 4;
    const hy = y - 7 + (sy > 0 ? 1 : 0);
    const fx = x + sx * (8 + 5 * out);
    const fy = y + sy * 3 * out;
    line(L.air, hx, hy, fx, fy - 1, STEEL_MID, a);
    line(L.air, hx, hy - 1, fx, fy - 2, STEEL_HI, a);
    // The pad.
    line(L.ground, fx - 2, fy, fx + 2, fy, STEEL_DK, a);
    line(L.ground, fx - 1, fy + 1, fx + 1, fy + 1, STEEL_EDGE, a);
  }
}

// --- The Synth -----------------------------------------------------------------------

/** One micro-drone: a white body with an eye lit the way it heads and a rotor flickering over it; for the Hive Queen, a striped bee. */
function drone(px: Px, x: number, y: number, vx: number, p: Pal, t: number, bee: boolean, a = 1): void {
  x = Math.round(x);
  y = Math.round(y);
  const beat = Math.floor(t * 22 + x * 0.3) % 2;
  if (a < 1 && dither(x, y) >= a) return;
  if (bee) {
    px.put(x - 1, y, BEE[0], 1);
    px.put(x, y, BEE[1], 1);
    px.put(x + 1, y, BEE[0], 1);
    px.put(x - 1, y + 1, BEE[2], 1);
    px.put(x, y + 1, BEE[1], 1);
    px.put(x + 1, y + 1, BEE[2], 1);
    px.put(x + (vx > 0 ? 2 : -2), y, p.hot, 1);
    px.put(x, y - 1 - beat, BEE[3], 1);
    px.put(x + 1, y - 1 - beat, BEE[3], 1);
    return;
  }
  px.put(x, y, DRONE[0], 1);
  px.put(x + 1, y, DRONE[1], 1);
  px.put(x, y + 1, DRONE[2], 1);
  px.put(x + 1, y + 1, DRONE[3], 1);
  px.put(x + (vx > 0 ? 2 : -1), y, p.hot, 1);
  px.put(x - 1 + beat * 3, y - 1, 0xc8d0dc, 1);
}

/** A drone sent out to a foe: it darts over, hovers, zaps it, and flits back. */
function droneShot(s: Stage, a: Pt, b: Pt, dur: number, p: Pal, bee: boolean): void {
  const start = { x: a.x + 6, y: a.y - 18 };
  const over = { x: b.x - 4, y: b.y - 20 };
  s.add(dur + 0.35, (L, k, t) => {
    let x: number;
    let y: number;
    if (t < dur) {
      const u = easeOut(t / dur);
      x = lerp(start.x, over.x, u);
      y = lerp(start.y, over.y, u) - Math.sin(u * Math.PI) * 6;
    } else {
      const u = easeIn((t - dur) / 0.35);
      x = lerp(over.x, start.x, u);
      y = lerp(over.y, start.y, u) - Math.sin(u * Math.PI) * 6;
    }
    drone(L.air, x, y + Math.sin(t * 30) * 0.5, t < dur ? b.x - a.x : a.x - b.x, p, t, bee, t < dur ? 1 : 1 - (t - dur) / 0.35 * 0.6);
    L.light(x, y, 10, p.light, 0.4 * (1 - k));
  });
  s.add(0.12, (L, k, t) => {
    if (bee) {
      line(L.air, over.x, over.y + 2, b.x, b.y - CHEST, BEE[0], 1 - k);
      star(L.air, b.x, b.y - CHEST, 2, p, 1);
    } else bolt(L.air, over.x, over.y + 2, b.x, b.y - CHEST, p, Math.floor(t * 60), 1, 0.7);
    L.light(b.x, b.y - CHEST, 18, p.light, 0.9 * (1 - k));
  }, dur, () => ping(s, b, p));
}

/** The four corners of the laser grid round `at`, `R` out, on the ground. */
const corners = (at: Pt, R: number): Pt[] => [
  { x: at.x - R, y: at.y - R * FLAT },
  { x: at.x + R, y: at.y - R * FLAT },
  { x: at.x + R, y: at.y + R * FLAT },
  { x: at.x - R, y: at.y + R * FLAT },
];

/** The laser grid: four drones fly out to the corners of a square over the foes, scan, and snap a burning grid of light between them. */
const laserGrid = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const bee = c.look === 'hive';
    const cs = corners(c.at, Math.max(14, c.r) * 0.8);
    const home = { x: c.from.x, y: c.from.y - 18 };
    s.add(c.lead, (L, k, t) => {
      cs.forEach((q, i) => {
        const u = easeOut(Math.min(1, k * 1.4 + i * 0.03));
        const x = lerp(home.x, q.x, u);
        const y = lerp(home.y, q.y - 16, u) - Math.sin(u * Math.PI) * 10;
        drone(L.air, x, y + Math.sin(t * 20 + i) * 0.6, q.x - home.x, p, t, bee);
        // Faint scanning beams once in place.
        if (u > 0.95) for (let j = 0; j < 14; j += 2) if (dither(x, y + j) < 0.6) dot(L.air, x, y + 2 + j, p.mid);
      });
      if (k > 0.6) {
        const f = (k - 0.6) / 0.4;
        for (let i = 0; i < 4; i++) {
          const a = cs[i];
          const b = cs[(i + 1) % 4];
          for (let j = 0; j <= 16; j++) if (j / 16 < f && j % 2 === 0) dot(L.ground, lerp(a.x, b.x, j / 16), lerp(a.y, b.y, j / 16), p.deep);
        }
      }
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const bee = c.look === 'hive';
    const R = Math.max(14, c.r) * 0.8;
    const cs = corners(c.at, R);
    const home = { x: c.from.x, y: c.from.y - 18 };
    const life = 1.1;
    s.add(life, (L, k, t) => {
      const on = tail(k, 0.65);
      const flick = Math.floor(t * 30) % 3 ? 1 : 0.7;
      // The grid on the ground: a bright frame, lines across both ways, and a sweep racing over it.
      for (let i = 0; i < 4; i++) {
        const a = cs[i];
        const b = cs[(i + 1) % 4];
        line(L.ground, a.x, a.y, b.x, b.y, p.core, on);
        line(L.ground, a.x, a.y + 1, b.x, b.y + 1, p.mid, on * flick);
      }
      for (let j = 1; j < 4; j++) {
        const f = j / 4;
        line(L.ground, lerp(cs[0].x, cs[1].x, f), cs[0].y, lerp(cs[3].x, cs[2].x, f), cs[3].y, p.hot, on * flick);
        line(L.ground, cs[0].x, lerp(cs[0].y, cs[3].y, f), cs[1].x, lerp(cs[1].y, cs[2].y, f), p.hot, on * flick);
      }
      const sweep = (t * 2.2) % 1;
      const sy = lerp(cs[0].y, cs[3].y, sweep);
      line(L.ground, cs[0].x, sy, cs[1].x, sy, p.core, on);
      // The beams down from each drone to its corner, and the drones flying home at the end.
      const back = k > 0.7 ? easeIn((k - 0.7) / 0.3) : 0;
      cs.forEach((q, i) => {
        const x = lerp(q.x, home.x, back);
        const y = lerp(q.y - 16, home.y, back) - Math.sin(back * Math.PI) * 10;
        if (back === 0) {
          line(L.air, q.x, q.y - 14, q.x, q.y, p.hot, flick);
          dot(L.air, q.x, q.y - 14, p.core);
        }
        drone(L.air, x, y + Math.sin(t * 20 + i) * 0.6, back ? home.x - q.x : 0, p, t, bee);
      });
      L.light(c.at.x, c.at.y - 4, R * 3, p.light, 0.6 * on);
    });
    s.add(0.3, (L, k) => L.light(c.at.x, c.at.y - 6, R * 4, p.light, 1 - k));
    for (const h of c.hits) {
      // Caught in the grid: a cross of red-hot light on each and a slowing scan line round it.
      s.add(0.9, (L, k, t) => {
        const a = tail(k, 0.6);
        circle(L.ground, h.x, h.y, 6, p.hot, a, FLAT);
        const yy = h.y - ((t * 30) % 20);
        line(L.air, h.x - 4, yy, h.x + 4, yy, p.core, a);
      });
      s.sparks(h.x, h.y, 5, [p.core, p.hot], { speed: 20, up: 20, life: 0.3, z: CHEST });
    }
  },
};

/** Where drone `j` of the swarm wheels round the Synth at time `T` since the cast began. */
function orbit(from: Pt, j: number, T: number): Pt {
  const th = hash(j, 11) * Math.PI * 2 + T * (2.4 + hash(j, 12) * 1.6);
  const d = 8 + 9 * hash(j, 13);
  return { x: from.x + Math.cos(th) * d, y: from.y - 20 + Math.sin(th) * d * 0.45 + Math.sin(T * 6 + j) * 2 };
}

/** Swarm Protocol: the Synth's chest opens and drones pour out round it; each hunts a foe, zaps it, harries it, and at the end they all stream home. */
const swarm = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const bee = c.look === 'hive';
    const chest = { x: c.from.x, y: c.from.y - 14 };
    s.add(c.lead, (L, k, t) => {
      // The hatch in its chest, opening and glowing.
      const w = Math.round(1 + 2 * easeOut(Math.min(1, k * 3)));
      for (let i = -w; i <= w; i++) {
        dot(L.air, chest.x + i, chest.y, p.core);
        dot(L.air, chest.x + i, chest.y + 1, p.hot);
      }
      L.light(chest.x, chest.y, 20 + 10 * k, p.light, 0.8);
      for (let j = 0; j < 16; j++) {
        const out = (t - (j / 16) * c.lead * 0.85) / 0.15;
        if (out <= 0) continue;
        const o = orbit(c.from, j, t);
        const u = easeOut(Math.min(1, out));
        drone(L.air, lerp(chest.x, o.x, u), lerp(chest.y, o.y, u), Math.cos(t * 3 + j), p, t, bee);
      }
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const bee = c.look === 'hive';
    const pts = c.path.length ? c.path : [c.at];
    const n = Math.max(16, pts.length);
    const life = c.span + 0.75;
    const chest = { x: c.from.x, y: c.from.y - 14 };
    const strikes = Array.from({ length: n }, (_, j) => {
      const to = pts[j % pts.length];
      const T = (c.span * (j % pts.length)) / pts.length;
      const go = Math.max(0, T - 0.22);
      return { to, go, arrive: go + 0.22, over: { x: to.x + (hash(j, 21) - 0.5) * 12, y: to.y - 18 - hash(j, 22) * 6 } };
    });
    s.add(life, (L, k, t) => {
      const T = t + c.lead;
      // The hatch stays lit while they are out.
      dot(L.air, chest.x, chest.y, p.hot);
      if (k > 0.85) L.light(chest.x, chest.y, 20, p.light, (k - 0.85) / 0.15);
      strikes.forEach((st, j) => {
        const o = orbit(c.from, j, T);
        let q: Pt;
        let vx = 1;
        const homeAt = life - 0.4 - hash(j, 23) * 0.15;
        if (t < st.go) q = o;
        else if (t < st.arrive) {
          const u = easeOut((t - st.go) / 0.22);
          q = { x: lerp(o.x, st.over.x, u), y: lerp(o.y, st.over.y, u) };
          vx = st.over.x - o.x;
        } else if (t < homeAt) {
          // Harrying its foe: little darting circles over it.
          const th = (t - st.arrive) * 9 + j;
          q = { x: st.over.x + Math.cos(th) * 4, y: st.over.y + Math.sin(th) * 2 };
          vx = -Math.sin(th);
        } else {
          const u = easeIn(Math.min(1, (t - homeAt) / 0.3));
          q = { x: lerp(st.over.x, chest.x, u), y: lerp(st.over.y, chest.y, u) - Math.sin(u * Math.PI) * 6 };
          vx = chest.x - st.over.x;
          if (u >= 1) return;
        }
        drone(L.air, q.x, q.y, vx, p, t, bee);
      });
    });
    strikes.forEach((st, j) => {
      if (j >= pts.length) return;
      s.add(0.1, (L, k, t) => {
        const fx = st.over;
        if (bee) {
          line(L.air, fx.x, fx.y + 1, st.to.x, st.to.y - CHEST, BEE[0], 1 - k);
          dot(L.air, st.to.x, st.to.y - CHEST, p.core);
        } else bolt(L.air, fx.x, fx.y + 1, st.to.x, st.to.y - CHEST, p, Math.floor(t * 60) + j, 1, 0.7);
        L.light(st.to.x, st.to.y - CHEST, 16, p.light, 0.8 * (1 - k));
      }, st.arrive, () => s.sparks(st.to.x, st.to.y, 3, [p.core, p.hot, bee ? BEE[0] : p.mid], { speed: 22, up: 18, life: 0.25, z: CHEST }));
    });
    s.add(0.4, (L, k) => {
      ring(L.ground, c.from.x, c.from.y, 24 * easeOut(k), 1.5, p, 1 - k);
      L.light(chest.x, chest.y, 50, p.light, 1 - k);
    });
  },
};

// --- The Engineer --------------------------------------------------------------------

/** A wrench from (x, y) along `th`, `len` long: a steel handle and an open jaw at its head. */
function wrench(px: Px, x: number, y: number, th: number, len: number): void {
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  const nx = -uy;
  const ny = ux;
  for (let i = 0; i <= len; i++) {
    px.put(Math.round(x + ux * i), Math.round(y + uy * i), i < 3 ? 0xc04a2a : STEEL_HI, 1);
    px.put(Math.round(x + ux * i + nx), Math.round(y + uy * i + ny), i < 3 ? 0x7a2a1a : STEEL_MID, 1);
  }
  const ex = x + ux * len;
  const ey = y + uy * len;
  for (let j = -2; j <= 3; j++) px.put(Math.round(ex + nx * j), Math.round(ey + ny * j), j < 0 ? STEEL_HI : STEEL, 1);
  for (const j of [-2, 3])
    for (let f = 1; f <= 2; f++) px.put(Math.round(ex + nx * j + ux * f), Math.round(ey + ny * j + uy * f), j < 0 ? STEEL : STEEL_DK, 1);
}

/** A swing of the wrench: a quick arc and a clang on the foe; the bonk (`heavy`) comes overhead and knocks nuts and bolts loose. */
function wrenchBlow(s: Stage, at: Pt, from: Pt, p: Pal, heavy: boolean): void {
  const side = at.x >= from.x ? 1 : -1;
  const P = { x: lerp(from.x, at.x, 0.3), y: lerp(from.y, at.y, 0.3) - HAND - 2 };
  const foe = { x: at.x, y: at.y - CHEST - (heavy ? 2 : 0) };
  const th = angle(P, foe);
  const len = Math.max(7, Math.min(11, dist(P, foe) - 1));
  const a0 = th - (heavy ? 2.3 : 1.5) * side;
  const a1 = th + 0.25 * side;
  const swing = heavy ? 0.12 : 0.09;
  s.add(swing + 0.12, (L, _k, t) => {
    const u = easeIn(Math.min(1, t / swing));
    const cur = lerp(a0, a1, u);
    // The smear left by the swing, fading.
    const fade = t < swing ? 1 : 1 - (t - swing) / 0.12;
    const lo = Math.min(a0, cur);
    const hi = Math.max(a0, cur);
    if (hi - lo > 0.2) arcSmear(L.air, P.x, P.y, len + 2, lo, hi, p, fade);
    if (t < swing + 0.06) wrench(L.air, P.x, P.y, cur, len);
  });
  s.add(0.01, () => {}, swing * 0.8, () => {
    s.add(heavy ? 0.3 : 0.2, (L, k) => {
      star(L.air, foe.x, foe.y, heavy ? (k < 0.4 ? 4 : 2) : k < 0.5 ? 3 : 1, p, 1);
      circle(L.air, foe.x, foe.y, 2 + (heavy ? 7 : 4) * easeOut(k), k < 0.5 ? 0xffffff : p.hot, 1 - k, 1);
      L.light(foe.x, foe.y, heavy ? 30 : 18, p.light, 0.9 * (1 - k));
    });
    s.sparks(at.x, at.y, heavy ? 8 : 4, [p.core, p.hot, 0xffffff], { speed: 30, up: 24, life: 0.3, z: CHEST });
    if (heavy) {
      // Nuts and bolts shaken loose, bouncing off.
      s.sparks(at.x, at.y, 5, [STEEL_HI, STEEL, STEEL_MID], { speed: 26, up: 46, g: 180, life: 0.6, z: CHEST + 2 });
      s.add(0.25, (L, k) => ring(L.ground, at.x, at.y, 3 + 8 * easeOut(k), 1, p, 1 - k));
    }
  });
}

/** A swing's trail: a thin crescent along the arc, dithering away. */
function arcSmear(px: Px, cx: number, cy: number, r: number, a0: number, a1: number, p: Pal, a: number): void {
  const n = Math.ceil((a1 - a0) * r * 1.4);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const th = a0 + (a1 - a0) * f;
    for (let w = 0; w < 2; w++) {
      const x = Math.round(cx + Math.cos(th) * (r - w));
      const y = Math.round(cy + Math.sin(th) * (r - w));
      if (dither(x, y) >= a * (0.3 + 0.7 * f)) continue;
      px.put(x, y, w ? p.mid : p.hot, 1);
    }
  }
}

/** The little sentry's head: a steel box with a stripe of the palette and a dark visor. */
const SENTRY = ['.sssss.', 'sSHHHSs', 'sSpppSs', 'sSSSSSs', '.ddddd.'];
/** The Mega Sentry's drum, twice the size and plated, with a hazard band and a glowing sensor. */
const MEGA = [
  '...dddddddd...',
  '..dHHHHHHHHd..',
  '.dHSSSSSSSSHd.',
  'dSSSSSeeSSSSSd',
  'dSSSSeEEeSSSSd',
  'dSSSSSeeSSSSSd',
  'dykykykykykykd',
  'dSSSSSSSSSSSSd',
  '.dMMMMMMMMMMd.',
  '..dddddddddd..',
];
/** The Mega Sentry's rocket pod on its back: three warheads in a steel box. */
const POD = ['ddddddd', 'drdrdrd', 'dSSSSSd', 'ddddddd'];

interface Gun {
  /** Where the head sits (its middle). */
  x: number;
  y: number;
  /** Where the barrel points, eased toward the next foe. */
  th: number;
  last: number;
}

/** Turns a gun toward `to` (an air point), a little each frame, and gives its barrel's angle. */
function aim(g: Gun, to: Pt, t: number): number {
  const want = Math.atan2(to.y - g.y, to.x - g.x);
  let d = want - g.th;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  g.th += d * Math.min(1, (t - g.last) * 18);
  g.last = t;
  return g.th;
}

/** The little sentry: tripod legs, the head, and a barrel along `th` that kicks back `recoil` px when it fires. */
function sentry(L: Layers, x: number, y: number, th: number, p: Pal, unfold: number, recoil: number, blink: boolean, a = 1): void {
  const hy = y - 4 - 6 * unfold;
  for (const [lx, ly] of [[-5, 0], [5, 0], [0, 2]]) line(L.air, x, hy + 1, x + lx * unfold, y + ly * unfold, STEEL_DK, a);
  disc(L.ground, x, y + 1, 5, 2, 0x0b0818, 0.5, 0.5);
  const bl = 5 * unfold - recoil;
  if (bl > 0) {
    const ux = Math.cos(th);
    const uy = Math.sin(th);
    line(L.air, x, hy, x + ux * (bl + 2), hy + uy * (bl + 2), STEEL_EDGE, a);
    line(L.air, x, hy - 1, x + ux * (bl + 2), hy - 1 + uy * (bl + 2), STEEL_MID, a);
  }
  sprite(L.air, x, hy + 2, SENTRY, { s: STEEL_EDGE, S: STEEL, H: STEEL_HI, p: p.mid, d: STEEL_DK }, a, { ay: SENTRY.length });
  // The antenna and its winking light.
  line(L.air, x + 2, hy - 3, x + 2, hy - 5, STEEL_DK, a);
  if (blink) dot(L.air, x + 2, hy - 6, p.hot, a);
}

/** The toolbox the Engineer throws: a red box with a steel catch. */
const KIT = ['.ddd.', 'rrrrr', 'rsSsr', 'rrrrr'];

/** Where the sentry stands: a step in front of the Engineer, toward the foes. */
function sentrySpot(c: Cast): Pt {
  const th = angle(c.from, c.at);
  return { x: c.from.x + Math.cos(th) * 14 + 8, y: c.from.y + Math.sin(th) * 14 * FLAT };
}

/** The Sentry: a toolbox tossed out unfolds into a little turret that swings round and fires its five rounds, foe after foe, then packs away. */
const sentryMove = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const at = sentrySpot(c);
    const toss = c.lead * 0.65;
    s.add(c.lead, (L, k, t) => {
      if (t < toss) {
        const u = t / toss;
        const x = lerp(c.from.x, at.x, u);
        const y = lerp(c.from.y - HAND, at.y - 3, u) - Math.sin(u * Math.PI) * 14;
        shadowOf(L.ground, lerp(c.from.x, at.x, u), lerp(c.from.y, at.y, u), 3, u);
        spin(L.air, x, y, KIT, { d: STEEL_DK, r: 0xc04a2a, s: STEEL, S: STEEL_HI }, t * 14);
      } else {
        const u = easeOut((t - toss) / (c.lead - toss));
        sentry(L, at.x, at.y, -Math.PI / 2 + 0.6, p, u, 0, false);
      }
      L.light(at.x, at.y - 8, 16, p.light, 0.3 * k);
    });
    s.add(0.01, () => {}, toss, () => {
      s.sparks(at.x, at.y, 5, [SMOKE_LIGHT, SMOKE_MID], { speed: 16, up: 10, life: 0.4, ground: true });
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const at = sentrySpot(c);
    const pts = c.path.length ? c.path : [c.at];
    const step = c.span / pts.length;
    const life = c.span + 0.7;
    const gun: Gun = { x: at.x, y: at.y - 10, th: -Math.PI / 2 + 0.6, last: 0 };
    const fired = pts.map((_, i) => i * step);
    s.add(life, (L, k, t) => {
      const i = Math.min(pts.length - 1, Math.max(0, Math.round(t / step)));
      const to = pts[i];
      const th = aim(gun, { x: to.x, y: to.y - CHEST }, t);
      const since = t - fired[Math.min(pts.length - 1, Math.floor(t / step + 0.001))];
      const recoil = since >= 0 && since < 0.06 ? 2 : 0;
      // Packing away at the end: it folds down and winks out.
      const fold = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
      sentry(L, at.x, at.y, th, p, fold, recoil, Math.floor(t * 6) % 2 === 0, fold < 1 ? fold : 1);
      if (recoil) muzzle(L, gun.x + Math.cos(th) * 8, gun.y + Math.sin(th) * 8, th, p, 0.6);
    });
    pts.forEach((to, i) => {
      const fire = fired[i];
      s.add(0.01, () => {}, fire, () => {
        const th = Math.atan2(to.y - CHEST - gun.y, to.x - gun.x);
        const m = { x: gun.x + Math.cos(th) * 8, y: gun.y + Math.sin(th) * 8 };
        tracer(s, m, { x: to.x, y: to.y - CHEST }, 0.07, p, 0, () => ping(s, to, p));
        casings(s, at.x, at.y, 9, to.x > at.x ? -1 : 1, 1);
      });
    });
    s.add(0.01, () => {}, life - 0.1, () => {
      smoke(s, at, 3, SMOKE_MID, 2.5, 0.6, 6);
      s.sparks(at.x, at.y, 6, [p.hot, STEEL_HI], { speed: 18, up: 20, life: 0.35, z: 6 });
    });
  },
};

/** The Mega Sentry: drawn on the ground at `x, y`, its twin barrels along `th`, `rise` 0..1 out of its crouch. */
function megaSentry(L: Layers, x: number, y: number, th: number, p: Pal, rise: number, kick: [number, number], a = 1): void {
  // The base plate: hazard stripes on the ground, and four heavy feet.
  hazardRing(L.ground, x, y, 12, 0, a);
  disc(L.ground, x, y, 11, 6, 0x0b0818, a, 0.5);
  const top = y - 10 - 8 * rise;
  for (const [fx, fy] of [[-10, -1], [10, -1], [-7, 4], [7, 4]]) {
    line(L.air, x + fx * 0.4, top + 16, x + fx, y + fy, STEEL_DK, a);
    line(L.air, x + fx * 0.4, top + 15, x + fx, y + fy - 1, STEEL, a);
    dot(L.air, x + fx, y + fy, STEEL_EDGE, a, 2);
  }
  // The twin barrels, each kicking back on its own.
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  const pivot = { x, y: top + 8 };
  for (const [side, b] of [[-1, 0], [1, 1]] as const) {
    const ox = -uy * side * 3;
    const oy = ux * side * 3 * 0.6;
    const len = (10 + 4 * rise) * rise - kick[b];
    if (len <= 0) continue;
    for (let w = -1; w <= 1; w++) {
      const c = w < 0 ? STEEL_HI : w > 0 ? STEEL_EDGE : STEEL_MID;
      line(L.air, pivot.x + ox - uy * w, pivot.y + oy + ux * w, pivot.x + ox + ux * len - uy * w, pivot.y + oy + uy * len + ux * w, c, a);
    }
    dot(L.air, pivot.x + ox + ux * len, pivot.y + oy + uy * len, STEEL_EDGE, a, 2);
  }
  sprite(L.air, x, top + 16, MEGA, { d: STEEL_EDGE, H: STEEL_HI, S: STEEL, M: STEEL_DK, e: p.hot, E: p.core, y: HAZARD_Y, k: HAZARD_K }, a, { ay: MEGA.length });
  sprite(L.air, x - 5, top + 6, POD, { d: STEEL_EDGE, r: p.deep, S: STEEL_MID }, a * rise, { ay: POD.length });
  L.light(x, top + 10, 20, p.light, 0.5 * a);
}

/** Mega Sentry: a giant turret drops out of the sky, slams down, rises out of its crouch and hoses the foes with both barrels and a rocket now and then. */
const megaSentryMove = {
  cast(s: Stage, c: Cast): void {
    const p = c.pal;
    const at = megaSpot(c);
    gather(s, c.from, p, c.lead, 1);
    fall(s, at, c.lead, 110, (L, x, y, k) => {
      shadowOf(L.ground, at.x, at.y, 12, k);
      hazardRing(L.ground, at.x, at.y, 14, k * 4, Math.floor(k * 12) % 2 ? 1 : 0.4);
      megaSentry(L, x, y, -Math.PI / 2, p, 0, [0, 0], 1);
      // Air streaming past it as it drops.
      for (const sx of [-8, 8]) line(L.air, x + sx, y - 32, x + sx, y - 44, SMOKE_LIGHT, 0.7);
    });
  },
  hit(s: Stage, c: Cast): void {
    const p = c.pal;
    const at = megaSpot(c);
    const pts = c.path.length ? c.path : [c.at];
    const step = c.span / pts.length;
    const life = c.span + 0.9;
    s.shake(200, 0.005);
    s.sparks(at.x, at.y, 18, [SMOKE_LIGHT, SMOKE_MID, 0x9a8a78], { speed: 44, up: 20, g: 60, life: 0.6, ground: true, spread: 16 });
    s.add(0.45, (L, k) => {
      ring(L.ground, at.x, at.y, 6 + 26 * easeOut(k), 2, p, 1 - k);
      L.light(at.x, at.y - 10, 70, p.light, 1 - k);
    });
    const gun: Gun = { x: at.x, y: at.y - 10, th: -Math.PI / 2, last: 0 };
    const kick: [number, number] = [0, 0];
    const shots = pts.map((to, i) => ({ to, at: i * step, rocket: i % 4 === 3, barrel: i % 2 }));
    s.add(life, (L, k, t) => {
      const rise = easeOut(Math.min(1, t / 0.2));
      const i = Math.min(pts.length - 1, Math.max(0, Math.round(t / step)));
      const to = pts[i];
      const th = aim(gun, { x: to.x, y: to.y - CHEST }, t);
      kick[0] = kick[1] = 0;
      for (const sh of shots) {
        const since = t - sh.at;
        if (!sh.rocket && since >= 0 && since < 0.05) kick[sh.barrel] = 2;
      }
      // Powering down at the end: barrels droop, it fades in a checker.
      const a = tail(k, 0.82);
      megaSentry(L, at.x, at.y, k > 0.82 ? lerp(th, Math.PI / 2 * 0.6 + th * 0.4, (k - 0.82) / 0.18) : th, p, rise, kick, a);
      for (const b of [0, 1]) {
        if (!kick[b]) continue;
        const side = b ? 1 : -1;
        const m = muzzlePt(gun, th, side);
        muzzle(L, m.x, m.y, th, p, 1);
      }
    });
    for (const sh of shots) {
      const side = sh.barrel ? 1 : -1;
      if (sh.rocket) {
        // A rocket off the pod, a smoke trail and a blast; launched early so it lands on its beat.
        const fl = 0.28;
        const go = Math.max(0, sh.at - fl);
        const start = { x: at.x - 5, y: at.y - 30 };
        const end = { x: sh.to.x, y: sh.to.y - 5 };
        const tr = new SmokeTrail(0.5, 1.5);
        s.add(fl + 0.5, (L, _k, t) => {
          if (t < fl) {
            const u = t / fl;
            const x = lerp(start.x, end.x, u);
            const y = lerp(start.y, end.y, u) - Math.sin(u * Math.PI) * 18;
            const u2 = Math.max(0, u - 0.05);
            const px = lerp(start.x, end.x, u2);
            const py = lerp(start.y, end.y, u2) - Math.sin(u2 * Math.PI) * 18;
            tr.push(x, y, t);
            missile(L.air, x, y, Math.atan2(y - py, x - px), p, t);
            L.light(x, y, 12, p.light, 0.5);
          }
          tr.draw(L.air, t);
        }, go);
        s.add(0.01, () => {}, go + fl, () => boom(s, sh.to, p, 0.9));
      } else
        s.add(0.01, () => {}, sh.at, () => {
          const m = muzzlePt(gun, gun.th, side);
          tracer(s, m, { x: sh.to.x, y: sh.to.y - CHEST }, 0.06, p, 0, () => ping(s, sh.to, p));
          casings(s, at.x + side * 6, at.y, 14, side, 1);
        });
    }
    s.add(0.01, () => {}, life - 0.2, () => smoke(s, { x: at.x, y: at.y }, 4, SMOKE_MID, 3, 0.8, 18));
  },
};

/** Where the Mega Sentry lands: partway from the Engineer toward the foes, off to his side. */
function megaSpot(c: Cast): Pt {
  // A little to the side, so the turret never stands over the Engineer himself.
  return { x: lerp(c.from.x, c.at.x, 0.45) + 15, y: lerp(c.from.y, c.at.y, 0.45) };
}

/** The muzzle of the Mega Sentry's left (-1) or right (1) barrel, aimed along `th`. */
function muzzlePt(g: Gun, th: number, side: number): Pt {
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  return { x: g.x - uy * side * 3 + ux * 15, y: g.y + ux * side * 3 * 0.6 + uy * 15 };
}

export const FORGED_KITS: Record<string, Kit> = {
  'alchemist.plague': { shot: flaskShot, skill: greatFlask, ult: pestilence },
  'alchemist.chem': { shot: vialShot, skill: chemFan, ult: chemBomb },
  'automaton.mech': { shot: bulletShot, skill: missiles, ult: siege },
  'automaton.synth': {
    // The Hive Queen's drones are bees; the shot can't see the look, so it sends a drone.
    shot: (s, a, b, dur, p) => droneShot(s, a, b, dur, p, false),
    skill: laserGrid,
    ult: swarm,
  },
  'inventor.engineer': { melee: wrenchBlow, skill: sentryMove, ult: megaSentryMove },
  'brewmaster.brewmaster': BREWMASTER_KIT,
};
