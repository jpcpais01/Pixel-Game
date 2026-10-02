import Phaser from 'phaser';
import { sound } from '../../audio';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, dither, drag, easeIn, easeOut, flare, Fx, GROUND, hash, type Ink, type Pal, ring, shade } from './ink';
import type { Cast, IconPainter } from './types';

// The Drowned Captain's Special: Ghost Ship. A spectral galleon rises out of
// the ground behind him in a gout of sea-mist and sails along his aim, its
// tattered sails glowing, a mist wake behind it. Anything its hull runs down
// is struck aside, and as it goes its broadsides fire from both sides at the
// foes it passes, the balls bursting where they land. At the end of its run
// it sinks back into the ground in a whirlpool that drags in what's near and
// closes with a crash of spray. Seen from the side when it sails across the
// view, bow-on or stern-on when it sails down or up it. The Bone Admiral's
// ship is the same in violet.

/** Rising out of the ground, sailing, and sinking, ms. */
const RISE_MS = 380;
const SAIL_MS = 2600;
const SINK_MS = 950;
/** Where it starts behind him, and how far it sails. */
const START_BACK = 34;
const SAIL_LEN = 240;
/** The hull: what it runs down, half its length and half its beam. */
const HULL_HALF = 28;
const HULL_BEAM = 14;
const RAM_DAMAGE = 24;
/** Broadsides: every so often, at up to this many foes a side, within reach of its beam and alongside it. */
const VOLLEY_EVERY = 380;
const PER_SIDE = 2;
const BROADSIDE_R = 95;
const BROADSIDE_SPAN = 52;
const BALL_MS = 230;
const CANNON_DAMAGE = 20;
const SPLASH_R = 14;
const SPLASH_DAMAGE = 7;
/** The whirlpool it sinks into. */
const WHIRL_R = 50;
const WHIRL_TICK = 240;
const WHIRL_DAMAGE = 5;
const WHIRL_PULL = 70;
const SINK_DAMAGE = 18;
/** How far its own canvas reaches round it (the masts are tall). */
const SHIP_W = 120;
const SHIP_H = 104;
/** The wake: a spot of mist laid every so often, and how long one lasts. */
const WAKE_EVERY = 70;
const WAKE_LIFE = 900;

interface Ball {
  x0: number;
  y0: number;
  foe: Hurtbox | null;
  x1: number;
  y1: number;
  t: number;
}

interface Blast {
  x: number;
  y: number;
  t: number;
}

type ShipView = 'side' | 'bow' | 'stern';

export class GhostShip extends Fx {
  private ship: Ink;
  private air: Ink;
  private ground: Ink;
  private lamp: Phaser.GameObjects.Light;
  private readonly x0: number;
  private readonly y0: number;
  private readonly ux: number;
  private readonly uy: number;
  private readonly view: ShipView;
  /** Facing right (1) or left (-1) in the side view. */
  private readonly face: number;
  private x: number;
  private y: number;
  private rammed = new Set<Hurtbox>();
  private balls: Ball[] = [];
  private blasts: Blast[] = [];
  private wake: { x: number; y: number; t: number }[] = [];
  private volleyT = 200;
  private wakeT = 0;
  private whirlT = 0;
  private sunk = false;
  /** Which side's guns flash this moment (port -1, starboard 1), and how long left. */
  private gunFlash = { side: 0, t: 0 };

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, RISE_MS + SAIL_MS + SINK_MS);
    const l = Math.hypot(c.dx, c.dy) || 1;
    this.ux = c.dx / l;
    this.uy = c.dy / l;
    this.view = Math.abs(this.ux) >= 0.45 ? 'side' : this.uy > 0 ? 'bow' : 'stern';
    this.face = this.ux >= 0 ? 1 : -1;
    this.x0 = c.x - this.ux * START_BACK;
    this.y0 = c.y - this.uy * START_BACK;
    this.x = this.x0;
    this.y = this.y0;
    this.ground = this.ink(SAIL_LEN + START_BACK + WHIRL_R * 2 + 60, SAIL_LEN + START_BACK + WHIRL_R * 2 + 60);
    this.ship = this.ink(SHIP_W, SHIP_H);
    this.air = this.ink(BROADSIDE_R * 2 + 90, BROADSIDE_R * 2 + 90);
    this.lamp = this.light(this.x, this.y - 30, 120, c.pal.light, 0);
    world.debris([0xffffff, ...c.pal.tints], this.x, this.y - 4, 26, this.y + 20, 'burst');
    bloom(world, this.x, this.y - 20, c.pal.mid, 3.2, 600, this.y + 40);
    world.cameras.main.shake(180, 0.0008);
    sound.creak(world.pan(this.x));
    sound.wail(world.pan(this.x));
    sound.splash(world.pan(this.x));
  }

  protected step(dt: number): void {
    const w = this.world;
    const p = this.c.pal;
    const sailing = this.t >= RISE_MS && this.t < RISE_MS + SAIL_MS;
    const sinkK = clamp01((this.t - RISE_MS - SAIL_MS) / SINK_MS);
    // Out of the ground, then along the aim, then down into it again.
    const riseK = clamp01(this.t / RISE_MS);
    const along = SAIL_LEN * easeInOut(clamp01((this.t - RISE_MS) / SAIL_MS));
    this.x = this.x0 + this.ux * along;
    this.y = this.y0 + this.uy * along;
    const down = this.t < RISE_MS ? 1 - easeOut(riseK) : easeIn(sinkK);

    if (sailing) {
      this.ram();
      this.volleyT -= dt;
      if (this.volleyT <= 0) {
        this.volleyT = VOLLEY_EVERY;
        this.volley();
      }
    }
    this.gunFlash.t = Math.max(0, this.gunFlash.t - dt);
    // The wake of mist it leaves.
    this.wakeT -= dt;
    if (this.wakeT <= 0 && sinkK === 0) {
      this.wakeT = WAKE_EVERY;
      this.wake.push({ x: this.x, y: this.y, t: this.t });
    }
    this.wake = this.wake.filter((q) => this.t - q.t < WAKE_LIFE);
    if (sinkK > 0) this.whirl(dt, sinkK);

    this.updateBalls(dt);
    this.drawGround(sinkK);
    this.drawShip(down);
    this.drawAir();
    this.lamp.setPosition(this.x, this.y - 30);
    this.lamp.intensity = 1.4 * (1 - down) + (this.gunFlash.t > 0 ? 1 : 0);
    if (Math.floor(this.t / 110) !== Math.floor((this.t - dt) / 110) && down < 0.9) {
      w.debris([p.core, p.hot, p.mid], this.x + (Math.random() - 0.5) * 50, this.y - 4, 1, this.y + 10, 'spores');
    }
  }

  // -------------------------------------------------------------------------
  // What it does

  /** Where a foe stands from the ship: along its course, and out to its side (starboard +). */
  private rel(h: Hurtbox): { along: number; out: number } {
    const dx = h.x - this.x;
    const dy = h.y - this.y;
    return { along: dx * this.ux + dy * this.uy, out: -dx * this.uy + dy * this.ux };
  }

  /** The hull runs down whatever it sails through, throwing it aside. */
  private ram(): void {
    const w = this.world;
    for (const h of w.hurtboxesWhere((b) => b.alive && !this.rammed.has(b))) {
      const r = this.rel(h);
      if (Math.abs(r.along) > HULL_HALF + h.radius || Math.abs(r.out) > HULL_BEAM + h.radius) continue;
      this.rammed.add(h);
      const side = r.out >= 0 ? 1 : -1;
      // Struck from the hull's side away from it, so it's flung clear.
      h.hurt({ damage: RAM_DAMAGE, heavy: true, knock: 170, fromX: h.x + this.uy * side * 12 - this.ux * 6, fromY: h.y - this.ux * side * 12 - this.uy * 6 });
      w.debris(this.c.pal.tints, h.x, h.y - h.bodyY, 8, h.y + 10, 'burst');
      sound.thud(w.pan(h.x), true);
    }
  }

  /** A broadside from each side at the foes alongside, or at the ground if there are none. */
  private volley(): void {
    const w = this.world;
    const foes = w.hurtboxesWhere((b) => b.alive);
    for (const side of [-1, 1]) {
      const near = foes
        .map((h) => ({ h, r: this.rel(h) }))
        .filter(({ r }) => Math.abs(r.along) <= BROADSIDE_SPAN && r.out * side > -2 && r.out * side <= BROADSIDE_R)
        .sort((a, b) => Math.abs(a.r.out) + Math.abs(a.r.along) - (Math.abs(b.r.out) + Math.abs(b.r.along)))
        .slice(0, PER_SIDE);
      const shots: { foe: Hurtbox | null; x: number; y: number }[] = near.map(({ h }) => ({ foe: h, x: h.x, y: h.y }));
      if (!shots.length) {
        // Nothing there: the guns fire anyway, raking the ground.
        const out = 45 + Math.random() * 35;
        const a = (Math.random() - 0.5) * 30;
        shots.push({ foe: null, x: this.x - this.uy * side * out + this.ux * a, y: this.y + this.ux * side * out + this.uy * a });
      }
      shots.forEach((s, i) => {
        const port = (i - (shots.length - 1) / 2) * 14 + (Math.random() - 0.5) * 6;
        const px = this.x + this.ux * port - this.uy * side * HULL_BEAM * 0.6;
        const py = this.y + this.uy * port + this.ux * side * HULL_BEAM * 0.6 - 8;
        this.balls.push({ x0: px, y0: py, foe: s.foe, x1: s.x, y1: s.y, t: -i * 50 });
        w.debris([0xffffff, this.c.pal.core, this.c.pal.hot], px, py, 4, py + 12, 'burst');
      });
    }
    this.gunFlash = { side: Math.random() < 0.5 ? -1 : 1, t: 120 };
    flare(w, this.x, this.y - 10, 110, this.c.pal.light, 1.8, 220);
    w.cameras.main.shake(70, 0.0005);
    sound.cannon(w.pan(this.x));
  }

  private updateBalls(dt: number): void {
    const w = this.world;
    for (const b of this.balls) {
      b.t += dt;
      if (b.foe?.alive) {
        b.x1 = b.foe.x;
        b.y1 = b.foe.y;
      }
      if (b.t < BALL_MS) continue;
      // It lands: on its foe, and a burst over anything else near.
      const hitFoe = b.foe && b.foe.alive ? b.foe : null;
      if (hitFoe) hitFoe.hurt({ damage: CANNON_DAMAGE, heavy: true, knock: 130, fromX: b.x0, fromY: b.y0 + 8 });
      for (const h of w.hurtboxesWhere((o) => o.alive && o !== hitFoe && Math.hypot(o.x - b.x1, (o.y - b.y1) / GROUND) <= SPLASH_R + o.radius)) {
        h.hurt({ damage: SPLASH_DAMAGE, heavy: false, knock: 70, fromX: b.x1, fromY: b.y1 });
      }
      w.debris([0xffffff, ...this.c.pal.tints], b.x1, b.y1 - 6, 10, b.y1 + 8, 'burst');
      bloom(w, b.x1, b.y1 - 6, this.c.pal.hot, 1.4, 260, b.y1 + 30);
      this.blasts.push({ x: b.x1, y: b.y1, t: 0 });
    }
    this.balls = this.balls.filter((b) => b.t < BALL_MS);
    for (const s of this.blasts) s.t += dt;
    this.blasts = this.blasts.filter((s) => s.t < 420);
  }

  /** Sinking: a whirlpool round where it goes down, dragging in what's near; it closes with a crash. */
  private whirl(dt: number, k: number): void {
    const w = this.world;
    const p = this.c.pal;
    this.whirlT -= dt;
    if (this.whirlT <= 0 && k < 0.95) {
      this.whirlT = WHIRL_TICK;
      for (const h of w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - this.x, (b.y - this.y) / GROUND) <= WHIRL_R + b.radius)) {
        h.hurt({ damage: WHIRL_DAMAGE, heavy: false, knock: 10, fromX: h.x + (h.x - this.x) * 0.2, fromY: h.y + (h.y - this.y) * 0.2 });
        drag(h, this.x, this.y, WHIRL_PULL, WHIRL_TICK);
      }
      sound.splash(w.pan(this.x));
    }
    if (k >= 0.95 && !this.sunk) {
      this.sunk = true;
      for (const h of w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - this.x, (b.y - this.y) / GROUND) <= WHIRL_R + b.radius)) {
        h.hurt({ damage: SINK_DAMAGE, heavy: true, knock: 150, fromX: this.x, fromY: this.y });
        w.debris(p.tints, h.x, h.y - h.bodyY, 6, h.y + 10, 'burst');
      }
      w.debris([0xffffff, ...p.tints], this.x, this.y - 6, 34, this.y + 20, 'burst');
      bloom(w, this.x, this.y - 10, p.hot, 3.4, 500, this.y + 40);
      flare(w, this.x, this.y - 10, 180, p.light, 3, 500);
      w.cameras.main.shake(240, 0.0013);
      sound.splash(w.pan(this.x));
      sound.quakeSlam(w.pan(this.x));
    }
  }

  // -------------------------------------------------------------------------
  // Drawing

  /** The mist wake behind it, and the whirlpool it sinks into. */
  private drawGround(sinkK: number): void {
    const p = this.c.pal;
    const g = this.ground.begin((this.x0 + this.x) / 2, (this.y0 + this.y) / 2, 3);
    for (const q of this.wake) {
      const age = (this.t - q.t) / WAKE_LIFE;
      const r = 10 + age * 10;
      const a = (1 - age) * 0.8;
      for (let dy = -Math.ceil(r * GROUND); dy <= r * GROUND; dy++) {
        for (let dx = -Math.ceil(r); dx <= r; dx++) {
          const d = Math.hypot(dx, dy / GROUND) / r;
          if (d > 1) continue;
          const X = Math.round(q.x + dx);
          const Y = Math.round(q.y + dy);
          if (dither(X, Y) > a * (1 - d * d)) continue;
          g.put(X, Y, d < 0.4 ? p.mid : p.deep, 0.7);
        }
      }
    }
    if (sinkK > 0) {
      // The whirlpool: arms spiralling in, turning faster as it closes.
      const open = sinkK < 0.15 ? sinkK / 0.15 : sinkK > 0.85 ? (1 - sinkK) / 0.15 : 1;
      const R = WHIRL_R * (0.5 + 0.5 * easeOut(Math.min(1, sinkK * 3)));
      const spin = this.t * 0.009;
      for (let arm = 0; arm < 4; arm++) {
        for (let s = 0; s <= 48; s++) {
          const f = s / 48;
          const r = R * (1 - f);
          const q = arm * (Math.PI / 2) + spin + f * 4.2;
          const X = this.x + Math.cos(q) * r;
          const Y = this.y + Math.sin(q) * r * GROUND;
          if (dither(Math.round(X), Math.round(Y)) > open) continue;
          g.put(X, Y, shade(p, 1 - f), 0.9);
          if (f < 0.7) g.put(X, Y + 1, p.deep, 0.6);
        }
      }
      ring(g, this.x, this.y, R, 1.2, p, open * 0.8, GROUND, 0.35, Math.floor(this.t / 90));
    }
    g.end();
  }

  /** The ship, sunk `down` (0..1) into the ground. */
  private drawShip(down: number): void {
    const p = this.c.pal;
    const g = this.ship.begin(this.x, this.y + 4, this.y + 4, 0.5, 1);
    const ground = this.y + 2;
    // Sunk: drawn lower, and nothing below the ground shows.
    const drop = down * 62;
    const flick = 0.82 + 0.18 * Math.sin(this.t * 0.02);
    const put = (x: number, y: number, c: number, a = 1) => {
      const Y = y + drop;
      if (Y > ground) return;
      // Ghost shimmer: rows fade in and out a little, in a crawling dither.
      const k = a * flick * (0.85 + 0.15 * Math.sin(Y * 0.9 + this.t * 0.012));
      if (k < 1 && dither(Math.round(x), Math.round(Y)) > k) return;
      g.put(x, Y, c, 0.92);
    };
    if (this.view === 'side') this.side(put, p);
    else this.front(put, p, this.view === 'stern');
    // Spray where it cuts the ground as it rises or sinks.
    if (down > 0.02 && down < 0.98) {
      for (let i = 0; i < 18; i++) {
        const sx = this.x + (hash(i, Math.floor(this.t / 60)) - 0.5) * (this.view === 'side' ? 70 : 34);
        const sy = ground - hash(i, 3, Math.floor(this.t / 60)) * 6;
        g.put(sx, sy, i % 3 ? p.hot : p.core, 0.9);
      }
    }
    g.end();
  }

  /**
   * The galleon in profile: a hull with a raised stern castle and forecastle,
   * a row of gunports, three masts of tattered square sails bellied out ahead,
   * a jib off the bowsprit, a Jolly Roger and a pennant streaming back.
   */
  private side(put: (x: number, y: number, c: number, a?: number) => void, p: Pal): void {
    const f = this.face;
    const X = (lx: number) => this.x + lx * f;
    const wl = this.y - 6 + Math.sin(this.t * 0.004) * 1.2;
    const deck = (lx: number) => wl - (lx < -17 ? 11 : lx > 19 ? 8 : 5);
    const keel = (lx: number) => wl + 3 - (lx > 16 ? ((lx - 16) / 14) ** 2 * 7 : 0) - (lx < -24 ? (-24 - lx) * 0.6 : 0);
    // Rigging behind it all.
    const masts = [{ x: -18, h: 30 }, { x: 1, h: 44 }, { x: 18, h: 34 }];
    for (const m of masts) {
      const top = deck(m.x) - m.h;
      lineP(put, X(m.x), top, X(34), wl - 14, p.deep, 0.6);
      lineP(put, X(m.x), top, X(-28), deck(-28) - 1, p.deep, 0.6);
    }
    // The hull.
    for (let lx = -30; lx <= 30; lx++) {
      const t = deck(lx);
      const b = keel(lx);
      for (let y = Math.round(t); y <= b; y++) {
        const edge = y === Math.round(t) || y >= b - 0.5 || lx === -30 || lx === 30;
        const plank = (y - Math.round(t)) % 2 === 0;
        put(X(lx), y, edge ? p.hot : plank ? p.mid : p.deep, edge ? 1 : 0.75);
      }
      // A rail along the deck's edge.
      if (lx % 3 === 0) put(X(lx), t - 1, p.mid);
    }
    put(X(-30), deck(-30) - 2, p.mid);
    // Gunports along the side, flashing when they fire.
    for (let lx = -21; lx <= 15; lx += 8) {
      const lit = this.gunFlash.t > 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(X(lx + dx), wl - 2 + dy, lit ? p.core : 0x031210, 1);
      if (lit) for (let k = 1; k <= 3; k++) put(X(lx) + 0.5, wl - 2 + 2 + k, k < 2 ? p.core : p.hot, 1 - k * 0.25);
    }
    // Stern lanterns.
    put(X(-31), deck(-31) - 3, p.core);
    put(X(-31), deck(-31) - 2, p.hot);
    // The bowsprit.
    lineP(put, X(28), wl - 7, X(42), wl - 15, p.hot, 1);
    // Masts, yards and sails.
    for (const m of masts) {
      const top = deck(m.x) - m.h;
      lineP(put, X(m.x), deck(m.x), X(m.x), top, p.mid, 1);
      const yards = m.h > 40 ? [[top + 3, 7], [top + 15, 10], [top + 29, 12]] : [[top + 3, 6], [top + 14, 9]];
      yards.forEach(([yy, hw], i) => {
        const bottom = i + 1 < yards.length ? yards[i + 1][0] - 2 : deck(m.x) - 4;
        this.sail(put, X(m.x), yy, bottom, hw, p, m.x * 7 + i);
        lineP(put, X(m.x) - hw, yy, X(m.x) + hw, yy, p.hot, 1);
      });
    }
    // The jib, from the bowsprit to the foremast.
    const jt = deck(18) - 30;
    for (let y = Math.round(jt); y <= wl - 9; y++) {
      const k = (y - jt) / (wl - 9 - jt);
      const x0 = 19;
      const x1 = 19 + k * 21;
      for (let lx = x0; lx <= x1; lx++) if (!(hash(lx, y, 11) < 0.1)) put(X(lx), y, lx > x1 - 1 ? p.core : p.mid, 0.6);
    }
    // The Jolly Roger at the main top, and a pennant at the fore streaming back.
    const mt = deck(1) - 44;
    for (let i = 0; i < 9; i++) {
      const wave = Math.sin(this.t * 0.012 - i * 0.7) * 1.2;
      for (let j = 0; j < 6; j++) {
        const skull = (i === 3 || i === 4) && (j === 1 || j === 2);
        const bones = (i === 2 || i === 5) && j === 4;
        put(X(1 - (i + 1)), mt - 6 + j + wave, skull || bones ? p.core : 0x05140f, 1);
      }
    }
    const ft = deck(18) - 34;
    for (let i = 0; i < 11; i++) {
      const wave = Math.sin(this.t * 0.015 - i * 0.8) * 1.4;
      put(X(18 - (i + 1)), ft - 1 + wave, i < 4 ? p.core : p.hot);
      if (i < 6) put(X(18 - (i + 1)), ft + wave, p.mid);
    }
  }

  /** A square sail hanging from (x, top) to `bottom`, bellied out ahead, torn and holed. */
  private sail(put: (x: number, y: number, c: number, a?: number) => void, x: number, top: number, bottom: number, hw: number, p: Pal, seed: number): void {
    const f = this.face;
    const h = bottom - top;
    for (let y = Math.round(top + 1); y <= bottom; y++) {
      const v = (y - top) / h;
      const belly = Math.sin(v * Math.PI) * 3 * f;
      for (let dx = -hw; dx <= hw; dx++) {
        // Torn along the foot, holed here and there.
        if (y > bottom - 3 && hash(dx, seed, 5) * 3 < y - (bottom - 3)) continue;
        if (hash(Math.round(dx / 2), Math.round(y / 2), seed) < 0.1) continue;
        const u = Math.abs(dx) / hw;
        const edge = Math.abs(dx) === hw || y === Math.round(top + 1);
        put(x + dx + belly * (1 - u * u), y, edge ? p.core : u < 0.35 ? p.hot : p.mid, edge ? 0.85 : 0.6 - v * 0.15);
      }
    }
  }

  /**
   * Bow-on (or stern-on): the hull a rounded U, the masts in one line, the
   * sails broad across it bellied towards the viewer (seen from behind they
   * hang darker), gunports at both sides, and on the stern its windows lit.
   */
  private front(put: (x: number, y: number, c: number, a?: number) => void, p: Pal, stern: boolean): void {
    const x = this.x;
    const wl = this.y - 6 + Math.sin(this.t * 0.004) * 1.2;
    const deckY = wl - 7;
    // Masts and sails, the main behind the fore.
    lineP(put, x, deckY, x, deckY - 50, p.mid, 1);
    const sails: [number, number, number][] = stern
      ? [[deckY - 47, deckY - 37, 9], [deckY - 35, deckY - 21, 14], [deckY - 19, deckY - 9, 12]]
      : [[deckY - 47, deckY - 37, 9], [deckY - 35, deckY - 21, 14], [deckY - 17, deckY - 6, 11]];
    sails.forEach(([t, b, hw], i) => {
      for (let y = Math.round(t); y <= b; y++) {
        const v = (y - t) / (b - t);
        const w = hw + Math.sin(v * Math.PI) * 2;
        for (let dx = -Math.ceil(w); dx <= w; dx++) {
          if (y > b - 2 && hash(dx, i, 7) * 2 < y - (b - 2)) continue;
          if (hash(Math.round(dx / 2), Math.round(y / 2), i + 3) < 0.1) continue;
          const u = Math.abs(dx) / w;
          const c = stern ? (u < 0.5 ? p.mid : p.deep) : u < 0.3 ? p.core : u < 0.65 ? p.hot : p.mid;
          put(x + dx, y, Math.abs(dx) >= Math.floor(w) ? p.hot : c, stern ? 0.6 : 0.7 - v * 0.15);
        }
      }
      lineP(put, x - hw - 2, t, x + hw + 2, t, p.hot, 1);
    });
    // The hull.
    for (let y = Math.round(deckY - (stern ? 7 : 0)); y <= wl + 3; y++) {
      const v = clamp01((y - deckY) / (wl + 3 - deckY));
      const hw = y < deckY ? 11 : 12 - v * v * 8;
      for (let dx = -Math.ceil(hw); dx <= hw; dx++) {
        const edge = Math.abs(dx) >= Math.floor(hw) || y === Math.round(deckY - (stern ? 7 : 0)) || y === Math.round(wl + 3);
        put(x + dx, y, edge ? p.hot : (y - deckY) % 2 === 0 ? p.mid : p.deep, edge ? 1 : 0.75);
      }
    }
    if (stern) {
      // The stern's gallery: three windows lit, lanterns at the corners.
      for (const wx of [-6, 0, 6]) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(x + wx + dx - 0.5, deckY - 4 + dy, p.core);
      put(x - 12, deckY - 9, p.core);
      put(x + 12, deckY - 9, p.core);
    } else {
      // The stem, and the bowsprit coming at the viewer.
      lineP(put, x, deckY, x, wl + 3, p.core, 1);
      lineP(put, x, deckY - 1, x, deckY + 5, p.hot, 1);
      put(x, deckY + 6, p.core);
    }
    // Gunports on both sides.
    const lit = this.gunFlash.t > 0;
    for (const s of [-1, 1]) {
      for (const py of [wl - 3, wl]) put(x + s * 10, py, lit ? p.core : 0x031210);
      if (lit) for (let k = 1; k <= 3; k++) put(x + s * (10 + k), wl - 3, p.hot, 1 - k * 0.25);
    }
    // A pennant at the top.
    for (let i = 0; i < 8; i++) put(x + i + 1, deckY - 50 + Math.sin(this.t * 0.015 - i * 0.8) * 1.2, i < 3 ? p.core : p.hot);
  }

  /** Cannonballs in flight (an arc, a streak of ghost-light behind) and their bursts. */
  private drawAir(): void {
    const p = this.c.pal;
    const g = this.air.begin(this.x, this.y - 10, this.y + 60);
    for (const b of this.balls) {
      if (b.t < 0) continue;
      const k = b.t / BALL_MS;
      const pos = (q: number) => ({ x: b.x0 + (b.x1 - b.x0) * q, y: b.y0 + (b.y1 - 8 - b.y0) * q - Math.sin(q * Math.PI) * 12 });
      for (let i = 6; i >= 0; i--) {
        const q = Math.max(0, k - i * 0.04);
        const s = pos(q);
        g.put(s.x, s.y, i === 0 ? p.core : i < 3 ? p.hot : p.mid, 1 - i * 0.12);
      }
      const s = pos(k);
      g.put(s.x + 1, s.y, p.hot);
      g.put(s.x, s.y + 1, p.hot);
      g.put(s.x - 1, s.y, p.mid);
      g.put(s.x, s.y - 1, p.mid);
    }
    for (const s of this.blasts) {
      const k = s.t / 420;
      const r = 3 + easeOut(k) * SPLASH_R;
      ring(g, s.x, s.y, r, 1.4 * (1 - k) + 0.5, p, 1 - k);
      if (k < 0.35) {
        const rr = 4 * (1 - k / 0.35);
        for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) if (Math.hypot(dx, dy) <= rr) g.put(s.x + dx, s.y - 7 + dy, Math.hypot(dx, dy) < rr * 0.5 ? p.core : p.hot);
      }
      // A column of spray thrown up.
      for (let i = 0; i < 6; i++) {
        const q = hash(i, Math.round(s.x), Math.round(s.y));
        const h = (8 + q * 10) * Math.sin(Math.min(1, k * 1.4) * Math.PI);
        g.put(s.x + (q - 0.5) * 10, s.y - h, i % 2 ? p.hot : p.mid, 1 - k);
      }
    }
    g.end();
  }
}

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** A one-pixel line through a put that may fade or clip. */
function lineP(put: (x: number, y: number, c: number, a?: number) => void, x0: number, y0: number, x1: number, y1: number, c: number, a: number): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, a);
}

/** Ghost Ship: a galleon under tattered sails on a swell, a pennant at its top. */
export const ghostShipIcon: IconPainter = (put, p) => {
  // Masts and their sails: a topsail and a broad course on each, bellied, a tear in one.
  for (const [mx, top, hw] of [[4, 4, 2], [8, 1, 3], [12, 3, 2]] as const) {
    for (let y = top; y <= 10; y++) put(mx, y, p.deep);
    for (let y = top + 1; y <= top + 2; y++) for (let dx = -hw + 1; dx <= hw - 1; dx++) put(mx + dx, y, dx === -hw + 1 ? p.mid : p.hot);
    for (let y = top + 4; y <= 9; y++) {
      for (let dx = -hw; dx <= hw; dx++) {
        if (mx === 8 && y === 7 && dx === 1) continue;
        put(mx + dx + (y > top + 5 ? 0 : 0), y, Math.abs(dx) === hw ? p.mid : y === top + 4 ? p.hot : p.core);
      }
    }
  }
  for (let i = 0; i < 3; i++) put(9 + i, 0 + (i & 1), i ? p.hot : p.core);
  // The hull, its castles and gunports, the bowsprit.
  for (let x = 1; x <= 13; x++) {
    const t = x <= 3 ? 9 : x >= 12 ? 10 : 11;
    const b = 13 - (x >= 11 ? x - 10 : 0) - (x <= 1 ? 1 : 0);
    for (let y = t; y <= b; y++) put(x, y, y === t ? p.hot : (y & 1) ? p.mid : p.deep);
  }
  for (const x of [5, 8]) put(x, 12, p.core);
  put(14, 9, p.hot);
  put(15, 8, p.hot);
  put(1, 8, p.core);
  // The swell.
  for (let x = 0; x < 16; x++) put(x, 14 + ((x >> 1) & 1), (x + 1) % 4 === 0 ? p.core : p.mid);
};
