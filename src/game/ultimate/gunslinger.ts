import type Phaser from 'phaser';
import { sound } from '../../audio';
import { GUNSL_CHEST_Y } from '../../art/gunslinger';
import type { Hurtbox } from '../combat';
import { HitSpark } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, dither, easeOut, flare, Fx, line, ring, type Ink, type Pal } from './ink';
import type { Cast, IconPainter } from './types';

// The Gunslinger's Special, High Noon. The sun flares overhead and the beat
// slows: every foe in range drags as if through syrup. Its dead-eye then
// marks them one after another, a tick of the clock each, up to six marks
// (a lone foe takes them all); then both guns speak at once, a single crack
// of gunfire, every mark a heavy round. The hero stands and aims meanwhile
// (Gunslinger.highNoon); this file holds the sun, the marks and the volley.

/** The sun's flare before the first mark, the beat between marks, the held breath before the volley, and the smoke after. */
const SUN_MS = 320;
const MARK_EVERY = 230;
const MARKS = 6;
const HOLD_MS = 260;
const AFTER_MS = 420;
/** Everything marked from the start to the volley, at most. */
export const NOON_MS = SUN_MS + MARK_EVERY * MARKS + HOLD_MS + AFTER_MS;
export const NOON_RANGE = 170;
/** How slow the world round it runs while it takes aim. */
const SLOW = 0.3;
export const NOON_DAMAGE = 22;
const NOON_KNOCK = 150;

/** Who stands at the middle of it: the hero, which turns to its marks and fires the volley. */
export interface NoonHost {
  x: number;
  y: number;
  /** Turn to face (x, y) and take aim. */
  sight?(x: number, y: number): void;
  /** Both guns fire: where the rounds leave from, toward (x, y). */
  volley?(x: number, y: number): { x: number; y: number };
}

interface Mark {
  h: Hurtbox;
  /** How many marks it carries, and when the last landed (for its snap-in). */
  n: number;
  at: number;
  g: Ink;
}

export class HighNoon extends Fx {
  private p: Pal;
  private sun: Phaser.GameObjects.Image;
  private sunGlow: Phaser.GameObjects.Image;
  private lamp: Phaser.GameObjects.Light;
  private ground: Ink;
  private marks: Mark[] = [];
  private placed = 0;
  private fired = false;
  private firedAt = 0;
  private tracers: { x0: number; y0: number; x1: number; y1: number }[] = [];
  private shots: Ink;
  private slowed = new Set<Hurtbox>();

  constructor(
    world: WorldScene,
    c: Cast,
    private host: NoonHost,
  ) {
    super(world, NOON_MS);
    this.p = c.pal;
    // The noon sun, high over it: a hard white disc in a wide glow, and its light on the ground.
    const sx = host.x;
    const sy = host.y - 70;
    this.sunGlow = this.halo(c.pal.light, 0.2, host.y + 900).setAlpha(0.6).setPosition(sx, sy);
    this.sun = this.halo(c.pal.core, 0.1, host.y + 901).setPosition(sx, sy);
    this.lamp = this.light(host.x, host.y - 20, 160, c.pal.light, 0);
    this.ground = this.ink(NOON_RANGE * 2 + 8, Math.ceil(NOON_RANGE * 1.2) + 8);
    this.shots = this.ink(NOON_RANGE * 2 + 40, NOON_RANGE * 2 + 40);
    flare(world, sx, sy, 260, c.pal.light, 3.4, 700);
    bloom(world, sx, sy, c.pal.core, 3.2, 600, host.y + 902);
    world.cameras.main.shake(120, 0.0007);
    sound.chronoCast(world.pan(host.x));
    this.slowAll();
  }

  /** Time left until the volley's smoke clears, for the HUD. */
  timeLeft(): { left: number; total: number } | null {
    return this.dead ? null : { left: this.life - this.t, total: this.life };
  }

  /** Every foe in range drags while it aims (and any that wander in). */
  private slowAll(): void {
    const ms = Math.max(0, SUN_MS + MARK_EVERY * MARKS + HOLD_MS - this.t);
    if (ms <= 0) return;
    for (const h of this.inRange()) {
      if (this.slowed.has(h)) continue;
      this.slowed.add(h);
      h.slow?.(SLOW, ms, this.p.hot);
    }
  }

  private inRange(): Hurtbox[] {
    const { x, y } = this.host;
    return this.world.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - x, (h.y - y) * 1.2) <= NOON_RANGE);
  }

  /** The next mark: the nearest foe not yet marked, else the one with the fewest marks (a lone foe takes them all). */
  private nextMark(): void {
    const { x, y } = this.host;
    const foes = this.inRange().sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    if (!foes.length) return;
    const count = (h: Hurtbox) => this.marks.find((m) => m.h === h)?.n ?? 0;
    const pick = foes.reduce((best, h) => (count(h) < count(best) ? h : best), foes[0]);
    let m = this.marks.find((k) => k.h === pick);
    if (!m) {
      m = { h: pick, n: 0, at: 0, g: this.ink(24, 24) };
      this.marks.push(m);
    }
    m.n++;
    m.at = this.t;
    this.placed++;
    this.host.sight?.(pick.x, pick.y);
    sound.reelTick();
    sound.lockOn(this.placed);
  }

  protected step(): void {
    const t = this.t;
    const p = this.p;
    const markEnd = SUN_MS + MARK_EVERY * MARKS;
    // The sun swells in, burns through the aim, flares at the volley, then sets.
    const sunK = t < SUN_MS ? easeOut(t / SUN_MS) : this.fired ? Math.max(0, 1 - (t - this.firedAt) / AFTER_MS) : 1;
    const pulse = 1 + 0.06 * Math.sin(t * 0.02);
    this.sun.setScale(0.55 * sunK * pulse).setAlpha(sunK);
    this.sunGlow.setScale(2.6 * sunK * pulse).setAlpha(0.55 * sunK);
    this.lamp.intensity = 1.1 * sunK;
    this.lamp.setPosition(this.host.x, this.host.y - 20);

    if (!this.fired) {
      if (t >= SUN_MS && this.placed < MARKS && Math.floor((t - SUN_MS) / MARK_EVERY) >= this.placed) {
        this.slowAll();
        this.nextMark();
      }
      if (t >= markEnd + HOLD_MS || (t >= SUN_MS && this.placed > 0 && this.placed < MARKS && !this.inRange().length)) this.fire();
    }

    // The noon light pooled round its feet: a ring of the range, ticks round it counting the marks.
    const gx = this.host.x;
    const gy = this.host.y;
    const g = this.ground.begin(gx, gy, gy - 40);
    if (!this.fired) {
      const a = 0.45 * sunK;
      ringTicks(g, gx, gy, NOON_RANGE, this.placed, p, a);
    }
    g.end();

    // The marks, riding on their foes.
    for (const m of this.marks) {
      const hx = Math.round(m.h.x);
      const hy = Math.round(m.h.y - m.h.bodyY);
      const mg = m.g.begin(hx, hy, m.h.y + 60);
      if (!this.fired && m.h.alive) reticle(mg, hx, hy, m.n, clamp01((t - m.at) / 140), t, p);
      mg.end();
    }

    // The volley's tracers, fading.
    const sg = this.shots.begin(gx, gy - GUNSL_CHEST_Y, gy + 50);
    if (this.fired) {
      const k = (t - this.firedAt) / 180;
      if (k < 1) for (const tr of this.tracers) tracer(sg, tr.x0, tr.y0, tr.x1, tr.y1, p, 1 - k);
    }
    sg.end();
  }

  /** Both guns at once: every mark struck, a heavy round each, in one crack. */
  private fire(): void {
    if (this.fired) return;
    this.fired = true;
    this.firedAt = this.t;
    const w = this.world;
    const p = this.p;
    const live = this.marks.filter((m) => m.h.alive);
    // With nothing marked it fires its volley at the sky.
    if (!live.length) this.host.volley?.(this.host.x, this.host.y - 60);
    for (const m of live) {
      const h = m.h;
      const from = this.host.volley?.(h.x, h.y) ?? { x: this.host.x, y: this.host.y - GUNSL_CHEST_Y };
      const hx = h.x;
      const hy = h.y - h.bodyY;
      this.tracers.push({ x0: from.x, y0: from.y, x1: hx, y1: hy });
      h.hurt({ damage: NOON_DAMAGE * m.n, heavy: true, knock: NOON_KNOCK, fromX: this.host.x, fromY: this.host.y });
      w.addEffect(new HitSpark(w, hx, hy, { core: p.core, hot: p.hot, mid: p.mid, deep: p.deep, light: p.light }, h.y + 13, true));
      w.debris([0xffffff, p.core, p.hot, p.mid], hx, hy, 6 + m.n * 2, h.y + 14, 'burst');
      bloom(w, hx, hy, p.hot, 1 + m.n * 0.15, 260, h.y + 40);
      if (m.n > 1) w.popNumber(Math.round(hx), Math.round(hy) - 14, `x${m.n}`, p.hot);
    }
    for (const m of this.marks) m.g.begin(0, 0, 0).end();
    flare(w, this.host.x, this.host.y - 30, 200, p.light, 3, 420);
    bloom(w, this.host.x, this.host.y - GUNSL_CHEST_Y, p.core, 2.4, 300, this.host.y + 40);
    w.cameras.main.shake(240, 0.0022);
    sound.blast(w.pan(this.host.x));
    sound.firecracker(w.pan(this.host.x));
    sound.turretShot(w.pan(this.host.x), true);
  }

}

/** The ring of noon light round it, broken into six arcs, the marked ones lit. */
function ringTicks(g: Ink, cx: number, cy: number, r: number, lit: number, p: Pal, a: number): void {
  ring(g, cx, cy, r, 0.6, p, a * 0.6, undefined, 0.35, 3);
  for (let i = 0; i < MARKS; i++) {
    const th = -Math.PI / 2 + (i / MARKS) * Math.PI * 2;
    const on = i < lit;
    const x = cx + Math.cos(th) * r;
    const y = cy + Math.sin(th) * r * 0.58;
    for (let k = -2; k <= 2; k++) g.put(x + k, y, on ? p.core : p.deep, on ? a * 2 : a);
    g.put(x, y - 1, on ? p.hot : p.deep, on ? a * 2 : a);
    g.put(x, y + 1, on ? p.hot : p.deep, on ? a * 2 : a);
  }
}

/**
 * A dead-eye mark: four corner brackets snapping in from wide as it lands,
 * a cross at its heart, and a pip under it for each mark it carries.
 */
function reticle(g: Ink, x: number, y: number, n: number, k: number, t: number, p: Pal): void {
  const e = easeOut(k);
  const r = Math.round(9 - 4 * e);
  const blink = k < 1 || Math.floor(t / 90) % 4 !== 0;
  const col = k < 1 ? p.core : p.hot;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = x + sx * r;
    const cy = y + sy * r;
    g.put(cx, cy, col);
    g.put(cx - sx, cy, col, 0.9);
    g.put(cx - sx * 2, cy, p.mid, 0.8);
    g.put(cx, cy - sy, col, 0.9);
    g.put(cx, cy - sy * 2, p.mid, 0.8);
  }
  if (blink) {
    g.put(x, y, p.core);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.put(x + dx * 2, y + dy * 2, p.hot, 0.9);
  }
  for (let i = 0; i < n; i++) {
    const px = x - (n - 1) + i * 2;
    g.put(px, y + r + 3, p.core);
    g.put(px, y + r + 4, p.mid, 0.8);
  }
  if (k < 1) for (let i = 0; i < 8; i++) {
    const th = (i / 8) * Math.PI * 2;
    const rr = r + 3 + (1 - e) * 6;
    if (dither(i, Math.round(rr)) < 1 - k) g.put(x + Math.cos(th) * rr, y + Math.sin(th) * rr, p.mid, 1 - k);
  }
}

/** A round's tracer from the gun to its mark: a white-hot core in the palette's glow. */
function tracer(g: Ink, x0: number, y0: number, x1: number, y1: number, p: Pal, a: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  line(g, x0 + nx, y0 + ny, x1 + nx, y1 + ny, p.mid, a * 0.5);
  line(g, x0 - nx, y0 - ny, x1 - nx, y1 - ny, p.deep, a * 0.4);
  line(g, x0, y0, x1, y1, a > 0.5 ? p.core : p.hot, a);
}

/** High Noon: a blazing sun over the horizon, a dead-eye reticle bracketing it. */
export const noonIcon: IconPainter = (put, p) => {
  // The horizon.
  for (let x = 0; x < 16; x++) put(x, 13, x % 3 === 0 ? p.deep : p.mid);
  for (let x = 2; x < 14; x += 2) put(x, 14, p.deep);
  // The sun, and its rays.
  for (let y = 4; y <= 10; y++)
    for (let x = 5; x <= 10; x++) {
      const d = Math.hypot(x - 7.5, y - 7);
      if (d <= 2.9) put(x, y, d < 1.6 ? p.core : p.hot);
    }
  for (const [x, y] of [[7, 2], [8, 2], [7, 12], [8, 12], [2, 7], [13, 7], [4, 4], [11, 4], [4, 10], [11, 10]]) put(x, y, p.mid);
  // The reticle's corners.
  for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [15, 0, -1, 1], [0, 15, 1, -1], [15, 15, -1, -1]]) {
    put(cx, cy, p.core);
    put(cx + sx, cy, p.hot);
    put(cx + sx * 2, cy, p.mid);
    put(cx, cy + sy, p.hot);
    put(cx, cy + sy * 2, p.mid);
  }
};
