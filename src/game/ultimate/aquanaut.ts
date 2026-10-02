import Phaser from 'phaser';
import { sound } from '../../audio';
import { TORPEDO_DIRS } from '../../art/aquanaut';
import { onGround } from '../Toxins';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, column, dither, easeOut, flare, Fx, GROUND, hash, pool, ring, strikeGround, type Ink } from './ink';
import type { Cast } from './types';

// The Aquanaut's Special, Torpedo: a brass steam torpedo set down at his
// feet runs off along the ground the way he aims, slow at first and then
// faster, its propeller churning a frothing wake of foam and bubbles behind
// it. It bursts on the first foe it reaches (or against a wall, or at the
// end of its run) in a great burst of sea water: a column thrown up and
// crashing down, a ring of foam rolling out, spray raining all round. Every
// foe in the burst is struck, thrown back and left soaked, wading slowly
// for a while. Barnacle's is crusted with barnacles and bursts sea-green.

const START_SPEED = 80;
const TOP_SPEED = 240;
/** How long it takes to come up to speed, ms. */
const SPIN_UP = 650;
const RANGE = 230;
/** It runs this high off the ground, bobbing on its own wake. */
const RIDE = 3;
/** A foe this close to its nose sets it off. */
const TRIGGER = 6;
const BURST_R = 46;
const BURST_DAMAGE = 60;
const BURST_KNOCK = 240;
/** Soaked: foes in the burst move at this much of their pace for a while. */
const SOAK = 0.55;
const SOAK_MS = 2600;
/** The wake: a bit of froth left every few px, gone after this long. */
const WAKE_GAP = 4;
const WAKE_MS = 1000;
/** The burst's own life after it goes off. */
const BURST_MS = 1500;
const DROPS = 26;

interface Froth {
  x: number;
  y: number;
  t: number;
  /** Which way the wake spreads from it (across the run). */
  nx: number;
  ny: number;
}

export class Torpedo extends Fx {
  private body: Phaser.GameObjects.Sprite;
  private shade: Phaser.GameObjects.Image;
  private lamp: Phaser.GameObjects.Light;
  private wake: Ink;
  private burstInk: Ink;
  private froth: Froth[] = [];
  private px: number;
  private py: number;
  private gone = 0;
  private lastFroth = 0;
  /** When it burst (ms into its life), or -1 while it runs. */
  private burstAt = -1;
  private readonly seed = Math.floor(Math.random() * 1000);
  private readonly frame: number;
  private readonly key: string;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, 99999);
    this.px = c.x + c.dx * 12;
    this.py = c.y + c.dy * 8;
    this.key = `torpedo_${c.look === 'barnacle' ? 'aquanaut_barnacle' : 'aquanaut'}`;
    const i = Math.round((Math.atan2(c.dy, c.dx) / (Math.PI * 2)) * TORPEDO_DIRS);
    this.frame = ((i % TORPEDO_DIRS) + TORPEDO_DIRS) % TORPEDO_DIRS;
    this.shade = this.own(world.add.image(this.px, this.py, 'shadow').setDepth(1).setScale(0.8, 0.5).setAlpha(0.4));
    this.body = this.own(world.add.sprite(this.px, this.py, this.key, `t${this.frame}_0`).setPipeline('Lit').setOrigin(0.5, 0.6));
    this.lamp = this.light(this.px, this.py - 6, 50, c.pal.light, 0.9);
    // The wake's canvas covers the whole run; the burst's, the blast round wherever it ends.
    this.wake = this.ink(Math.ceil(Math.abs(c.dx) * RANGE) + 70, Math.ceil(Math.abs(c.dy) * RANGE) + 50);
    this.burstInk = this.ink(BURST_R * 2 + 50, Math.ceil(BURST_R * GROUND * 2) + 90);
    world.debris(c.pal.tints, this.px, this.py - 4, 10, this.py + 4, 'burst');
    sound.torpedo(world.pan(this.px));
  }

  /** It runs for a moment, not a lasting Special: no timer. */
  timeLeft(): null {
    return null;
  }

  protected step(dt: number): void {
    if (this.burstAt < 0) this.run(dt);
    this.drawWake();
    if (this.burstAt >= 0) this.drawBurst(this.t - this.burstAt);
  }

  private run(dt: number): void {
    const w = this.world;
    const { dx, dy } = this.c;
    const speed = START_SPEED + (TOP_SPEED - START_SPEED) * easeOut(this.t / SPIN_UP);
    let move = (speed * dt) / 1000;
    while (move > 0) {
      const d = Math.min(3, move);
      move -= d;
      const nx = this.px + dx * d;
      const ny = this.py + dy * d;
      // A wall, the edge of the world, or the end of its run: it goes off where it is.
      if (!w.walkable(nx, ny) || !w.area.contains(nx, ny) || this.gone >= RANGE) {
        this.burst();
        return;
      }
      this.px = nx;
      this.py = ny;
      this.gone += d;
      if (this.gone - this.lastFroth >= WAKE_GAP) {
        this.lastFroth = this.gone;
        this.froth.push({ x: this.px - dx * 6, y: this.py - dy * 4, t: this.t, nx: -dy, ny: dx });
      }
      if (w.firstHurtbox((h) => h.alive && onGround(h, this.px + dx * 4, this.py + dy * 3, TRIGGER))) {
        this.burst();
        return;
      }
    }
    const bob = Math.round(Math.sin(this.t * 0.02) * 0.6);
    const spin = Math.floor(this.t / 55) % 2;
    this.body.setFrame(`t${this.frame}_${spin}`).setPosition(Math.round(this.px), Math.round(this.py) - RIDE + bob).setDepth(this.py);
    this.shade.setPosition(Math.round(this.px), Math.round(this.py));
    this.lamp.setPosition(this.px, this.py - 6);
    // Steam off its back, and spray thrown off its bow.
    if (Math.random() < dt / 70) w.debris([0xf0f4f8, 0xc8d0d8], this.px - dx * 3, this.py - 7, 1, this.py, 'spores');
    if (Math.random() < dt / 40) w.debris(this.c.pal.tints, this.px + dx * 6, this.py - 2, 1, this.py + 2, 'trail');
  }

  /** It bursts: the blow, everyone in reach thrown back and soaked, a flash of sea light. */
  private burst(): void {
    const w = this.world;
    const p = this.c.pal;
    this.burstAt = this.t;
    this.life = this.t + Math.max(BURST_MS, WAKE_MS);
    this.body.setVisible(false);
    this.shade.setVisible(false);
    const x = this.px;
    const y = this.py;
    strikeGround(w, x, y, BURST_R, { damage: BURST_DAMAGE, heavy: true, knock: BURST_KNOCK });
    for (const h of w.hurtboxesWhere((b) => b.alive && onGround(b, x, y, BURST_R))) h.slow?.(SOAK, SOAK_MS, p.mid);
    bloom(w, x, y - 12, p.hot, 3.4, 520, y + 40);
    flare(w, x, y - 10, 170, p.light, 3, 600);
    w.debris(p.tints, x, y - 10, 28, y + 30, 'burst');
    w.debris([0xffffff, p.core, p.hot], x, y - 20, 16, y + 30, 'spores');
    w.cameras.main.shake(260, 0.0013);
    sound.seaBurst(w.pan(x));
    this.lamp.setPosition(x, y - 14);
  }

  /** Froth left on the ground behind it: a wedge of foam and bubbles spreading and thinning away. */
  private drawWake(): void {
    const { c } = this;
    const p = c.pal;
    const cx = c.x + c.dx * (12 + RANGE / 2);
    const cy = c.y + c.dy * (8 + RANGE / 2);
    const g = this.wake.begin(cx, cy, 2.8);
    this.froth = this.froth.filter((f) => this.t - f.t < WAKE_MS);
    for (const [i, f] of this.froth.entries()) {
      const age = (this.t - f.t) / WAKE_MS;
      const spread = 1.5 + age * 5;
      const a = 1 - age;
      for (let k = -3; k <= 3; k++) {
        const o = (k / 3) * spread + (hash(i, k, this.seed) - 0.5) * 2;
        const x = f.x + f.nx * o;
        const y = f.y + f.ny * o * GROUND;
        if (dither(Math.round(x), Math.round(y)) >= a * (1 - Math.abs(k) * 0.12)) continue;
        g.put(x, y, Math.abs(k) <= 1 && age < 0.4 ? p.core : Math.abs(k) <= 2 ? p.hot : p.mid, 0.9);
      }
      // A bubble or two popping in it.
      if (hash(i, this.seed, 7) < 0.3 && age < 0.7) {
        const bx = f.x + f.nx * (hash(i, 3, this.seed) - 0.5) * spread * 2;
        const by = f.y - age * 3;
        g.put(bx, by, p.core);
        g.put(bx + 1, by, p.mid, 0.6);
      }
    }
    g.end();
  }

  /** The burst: a column of water up and crashing down, droplets raining out, a ring of foam rolling over the ground, a puddle left drying. */
  private drawBurst(ms: number): void {
    const p = this.c.pal;
    const x = this.px;
    const y = this.py;
    const g = this.burstInk.begin(x, y, y + 30, 0.5, 0.75);
    // The puddle, under all of it.
    const dry = 1 - clamp01((ms - 500) / (BURST_MS - 500));
    pool(g, x, y, BURST_R * 0.7 * easeOut(ms / 250), p.mid, p.deep, dry, GROUND, 0.55);
    // The ring of foam rolling out, then a second, smaller.
    const k = clamp01(ms / 480);
    ring(g, x, y, BURST_R * easeOut(k), 2.4 * (1 - k) + 0.6, p, 1 - k);
    if (ms > 120) {
      const k2 = clamp01((ms - 120) / 420);
      ring(g, x, y, BURST_R * 0.65 * easeOut(k2), 1.2, p, 0.8 * (1 - k2), GROUND, 0.35, this.seed);
    }
    // The column: up fast, hanging a moment, collapsing into the ring.
    const up = ms < 220 ? easeOut(ms / 220) : 1 - clamp01((ms - 260) / 380);
    if (up > 0) column(g, x, y, 54 * up, 8 * (0.6 + 0.4 * up), p, Math.min(1, up * 1.4), ms);
    // Droplets thrown out in arcs, falling back as dots.
    if (ms < 1000) {
      for (let i = 0; i < DROPS; i++) {
        const th = hash(i, this.seed) * Math.PI * 2;
        const v = 30 + hash(i, this.seed, 1) * 55;
        const vz = 60 + hash(i, this.seed, 2) * 80;
        const s = ms / 1000;
        const z = vz * s - 160 * s * s;
        if (z < -2) continue;
        const dx = Math.cos(th) * v * s;
        const dy = Math.sin(th) * v * s * GROUND;
        const a = 1 - clamp01((ms - 600) / 400);
        g.put(x + dx, y + dy - Math.max(0, z) - 6, i % 3 ? p.hot : p.core, a);
        if (z > 8) g.put(x + dx, y + dy - z - 5, p.mid, a * 0.6);
      }
    }
    g.end();
    this.lamp.intensity = 2.6 * Math.max(0, 1 - ms / 700);
  }
}

export function torpedo(c: Cast): void {
  c.world.addEffect(new Torpedo(c.world, c));
}
