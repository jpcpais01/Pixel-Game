import type Phaser from 'phaser';
import { sound } from '../audio';
import { inFlight, type Hurtbox } from './combat';
import { snap } from './display';
import type { Effect } from './Slash';
import { bloom, clamp01, dither, flare, Fx, hash, Ink, star } from './ultimate/ink';
import type { AviatorKit } from './Aviator';
import type { WorldScene } from '../scenes/WorldScene';

// The Aviator's effects: the flare rounds from her pistol, the smoke her
// jetpack leaves across the sky, and the scorch where she kicks off and lands.

const FLARE_SPEED = 300;
const FLARE_RANGE = 135;
/** The trail's length behind the head, in points kept (a point a few px). */
const TRAIL = 9;
/** Smoke puffs left behind it: how long each lives. */
const PUFF_MS = 420;

/**
 * A flare round: a white-hot head with a hot halo, streaking along the aim
 * at the pistol's height, a sputtering tail of fire behind it fading into a
 * thread of smoke, now and then spitting a spark. It bursts in a shower of
 * sparks on the first foe in its way (the star shell in a bigger, brighter
 * star), or fizzles out at the end of its flight.
 */
export class FlareRound implements Effect {
  dead = false;
  private g: Ink;
  private light: Phaser.GameObjects.Light;
  private travelled = 0;
  private t = 0;
  private pts: { x: number; y: number }[] = [];
  private puffs: { x: number; y: number; t: number }[] = [];
  private puffT = 0;
  private ended = -1;
  private readonly inPath = (h: Hurtbox) => inFlight(h, this.x, this.y, this.fly, 2);

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private fly: number,
    private ux: number,
    private uy: number,
    private kit: AviatorKit,
    private star: boolean,
    private onHit: (h: Hurtbox, x: number, y: number) => void,
  ) {
    this.g = new Ink(world, 64, 64);
    this.light = world.lights.addLight(x, y - fly, star ? 70 : 50, kit.pal.light, star ? 1.8 : 1.3);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    if (this.ended >= 0) {
      // Burst or spent: the smoke it left thins away, then it's gone.
      this.ended += dt;
      this.draw();
      if (this.ended > PUFF_MS) this.destroy();
      return;
    }
    let move = (FLARE_SPEED * dt) / 1000;
    while (move > 0) {
      const d = Math.min(3, move);
      move -= d;
      this.x += this.ux * d;
      this.y += this.uy * d;
      this.travelled += d;
      const h = this.world.firstHurtbox(this.inPath);
      if (h) {
        this.onHit(h, this.x, this.y);
        this.burst(true);
        return;
      }
      if (this.travelled >= FLARE_RANGE || (!this.world.walkable(this.x, this.y) && this.travelled > 20)) {
        this.burst(false);
        return;
      }
    }
    this.pts.unshift({ x: this.x, y: this.y - this.fly });
    if (this.pts.length > TRAIL) this.pts.pop();
    this.puffT -= dt;
    if (this.puffT <= 0) {
      this.puffT = 35;
      this.puffs.push({ x: this.x - this.ux * 6, y: this.y - this.fly - this.uy * 6, t: this.t });
    }
    // Sputtering: a spark spat off now and then.
    if (hash(Math.floor(this.t / 40), 3) < 0.25) {
      const p = this.kit.pal;
      this.world.debris([p.hot, p.mid], snap(this.x - this.ux * 3), snap(this.y - this.fly), 1, this.y + 4, 'trail');
    }
    this.light.setPosition(this.x, this.y - this.fly);
    this.light.intensity = (this.star ? 1.8 : 1.3) * (0.8 + 0.2 * hash(Math.floor(this.t / 30), 9));
    this.draw();
  }

  private draw(): void {
    const p = this.kit.pal;
    const s = this.kit.smoke;
    const head = this.pts[0] ?? { x: this.x, y: this.y - this.fly };
    const g = this.g.begin(head.x, head.y, this.y + 2);
    // The smoke, rising a little and thinning in a checker.
    for (const q of this.puffs) {
      const age = (this.t - q.t) / PUFF_MS;
      if (age >= 1) continue;
      const r = 0.6 + age * 1.6;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.hypot(dx, dy) > r) continue;
          const x = Math.round(q.x + dx);
          const y = Math.round(q.y + dy - age * 4);
          if (dither(x, y) >= (1 - age) * 0.8) continue;
          g.put(x, y, dy < 0 ? s[0] : s[1]);
        }
    }
    if (this.ended < 0) {
      // The tail: hot near the head, through the fire's colours, broken where it sputters.
      for (let i = this.pts.length - 1; i >= 1; i--) {
        const a = this.pts[i];
        const b = this.pts[i - 1];
        const f = i / TRAIL;
        if (i > 2 && hash(i, Math.floor(this.t / 50)) < 0.2) continue;
        const c = f < 0.25 ? p.hot : f < 0.6 ? p.mid : p.deep;
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
        for (let k = 0; k <= n; k++) g.put(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n, c);
      }
      // The head: white-hot, its halo flickering.
      g.put(head.x, head.y, p.core);
      const flick = Math.floor(this.t / 45) % 2;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.put(head.x + dx, head.y + dy, flick ? p.core : p.hot);
      if (this.star || flick) for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) g.put(head.x + dx, head.y + dy, p.mid, 0.8);
    }
    g.end();
  }

  /** It bursts: a star of sparks and a flash (on a foe), or a little pop as it gutters out. */
  private burst(struck: boolean): void {
    const w = this.world;
    const p = this.kit.pal;
    const bx = this.x;
    const by = this.y - this.fly;
    w.addEffect(new SparkBurst(w, bx, by, this.y, this.kit, struck ? (this.star ? 1.6 : 1) : 0.45));
    if (struck) {
      bloom(w, bx, by, p.hot, this.star ? 1.4 : 0.8, 260, this.y + 20);
      flare(w, bx, by, this.star ? 90 : 55, p.light, this.star ? 2.4 : 1.5, 260);
      sound.sizzle(w.pan(bx));
    }
    w.debris(p.tints, bx, by, struck ? (this.star ? 12 : 6) : 3, this.y + 12, 'burst');
    this.ended = 0;
    this.light.intensity = 0;
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.g.destroy();
    this.world.lights.removeLight(this.light);
  }
}

/** The burst of sparks a flare pops into: rays shooting out from a white flash, then sparks falling and fading. */
class SparkBurst extends Fx {
  private g: Ink;
  private rays: { a: number; v: number; c: number }[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private ground: number,
    private kit: AviatorKit,
    private size: number,
  ) {
    super(world, 320 + 120 * size);
    this.g = this.ink(48, 48);
    const p = kit.pal;
    const n = Math.round(6 + 6 * size);
    for (let i = 0; i < n; i++) this.rays.push({ a: (i / n) * Math.PI * 2 + hash(i, 5) * 0.5, v: (0.6 + hash(i, 6) * 0.6) * (10 + 10 * size), c: [p.core, p.hot, p.mid][i % 3] });
  }

  protected step(): void {
    const k = clamp01(this.t / this.life);
    const g = this.g.begin(this.x, this.y, this.ground + 14);
    if (k < 0.3) star(g, this.x, this.y, Math.round((2 + 3 * this.size) * (1 - k / 0.3)), this.kit.pal, 1);
    for (const r of this.rays) {
      const d = r.v * (1 - (1 - k) ** 2);
      const sx = this.x + Math.cos(r.a) * d;
      const sy = this.y + Math.sin(r.a) * d * 0.8 + k * k * 8;
      if (dither(Math.round(sx), Math.round(sy)) >= 1 - k * 0.8) continue;
      g.put(sx, sy, k < 0.5 ? r.c : this.kit.pal.deep);
      if (k < 0.4) g.put(sx - Math.cos(r.a), sy - Math.sin(r.a) * 0.8, this.kit.pal.mid, 0.7);
    }
    g.end();
  }
}

/**
 * The jetpack's smoke across the sky: puffs left where she flies, fire-lit
 * while fresh, swelling, drifting up and thinning away in a checker. Fed
 * by `puff` while the jets burn; `stop` lets the last of it clear.
 */
export class JetSmoke extends Fx {
  private g: Ink;
  private puffs: { x: number; y: number; ground: number; t: number; seed: number }[] = [];
  private stopped = -1;
  private gap = 0;

  constructor(
    world: WorldScene,
    private kit: AviatorKit,
  ) {
    super(world, 60000);
    this.g = this.ink(200, 160);
  }

  puff(x: number, y: number, ground: number): void {
    if (this.stopped >= 0 || this.t < this.gap) return;
    this.gap = this.t + 22;
    this.puffs.push({ x, y, ground, t: this.t, seed: this.puffs.length });
  }

  stop(): void {
    if (this.stopped < 0) this.stopped = this.t;
  }

  protected step(): void {
    const LIFE = 700;
    if (this.stopped >= 0 && this.t - this.stopped > LIFE) {
      this.destroy();
      return;
    }
    const live = this.puffs.filter((q) => this.t - q.t < LIFE);
    if (!live.length) return;
    const xs = live.map((q) => q.x);
    const ys = live.map((q) => q.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const g = this.g.begin(cx, cy, Math.max(...live.map((q) => q.ground)) + 1);
    const p = this.kit.pal;
    const [lit, body, dark] = this.kit.smoke;
    for (const q of live) {
      const age = (this.t - q.t) / LIFE;
      const r = 1.2 + age * 3.4 + hash(q.seed, 1);
      const ox = (hash(q.seed, 2) - 0.5) * 4 * age;
      const oy = -age * 6;
      for (let dy = -Math.ceil(r); dy <= r; dy++)
        for (let dx = -Math.ceil(r); dx <= r; dx++) {
          const d = Math.hypot(dx, dy) / r;
          if (d > 1) continue;
          const x = Math.round(q.x + ox + dx);
          const y = Math.round(q.y + oy + dy);
          if (dither(x, y) >= (1 - age) * (1 - d * d * 0.6)) continue;
          // Fresh smoke glows with the jet's fire; older smoke is grey, lit on top.
          const c = age < 0.12 ? (d < 0.5 ? p.hot : p.mid) : age < 0.22 && d < 0.4 ? p.deep : dy < -r * 0.3 ? lit : d > 0.7 ? dark : body;
          g.put(x, y, c);
        }
    }
    g.end();
  }
}

/** A scorch on the ground where the jets blew: a dark smudge with a glowing rim, cooling and fading. */
export class Scorch extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private kit: AviatorKit,
  ) {
    super(world, 1600);
    this.g = this.ink(28, 18);
  }

  protected step(): void {
    const k = clamp01(this.t / this.life);
    const g = this.g.begin(this.x, this.y, 1.5);
    const p = this.kit.pal;
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -10; dx <= 10; dx++) {
        const d = Math.hypot(dx / 9, dy / 5);
        if (d > 1) continue;
        const x = Math.round(this.x + dx);
        const y = Math.round(this.y + dy);
        if (dither(x, y) >= (1 - k) * (1 - d * d) * 1.2) continue;
        g.put(x, y, d > 0.75 && k < 0.35 ? p.deep : 0x2a2420, k < 0.35 && d > 0.75 ? 0.8 : 0.5);
      }
    g.end();
  }
}
