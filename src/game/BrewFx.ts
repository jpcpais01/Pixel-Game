import Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene';
import { clamp01, Fx, hash, type Ink, type Pal } from './ultimate/ink';

// The Brewmaster's effects: froth flung off his paddle, and the spray of
// fire he spits through a flame.

/** Foam drops: how fast they fly out, how hard they fall, and how long the puddle they leave lasts. */
const DROP_SPEED = 46;
const DROP_GRAVITY = 160;
const PUDDLE_MS = 700;

/** Froth's colours from lit to shadowed, and the drops' own glint. */
export interface Froth {
  light: number;
  mid: number;
  deep: number;
  glint: number;
}

/**
 * A splash of froth where the paddle lands: drops flung up and out (more,
 * and wider, for the slam), falling back to the ground where they leave a
 * ring of suds that fizzes away.
 */
export class FoamSplash extends Fx {
  private g: Ink;
  private drops: { vx: number; vy: number; vz: number; s: number }[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private c: Froth,
    private big = false,
    ux = 0,
    uy = 1,
  ) {
    super(world, PUDDLE_MS + 300);
    const n = big ? 22 : 10;
    for (let i = 0; i < n; i++) {
      // Thrown mostly the way the blow went, some spraying all round.
      const a = Math.atan2(uy, ux) + (hash(i, 3, x | 0) * 2 - 1) * (big ? Math.PI : 1.3);
      const sp = DROP_SPEED * (0.4 + hash(i, 5, y | 0) * (big ? 1.1 : 0.8));
      this.drops.push({ vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 30 + hash(i, 9) * (big ? 70 : 45), s: hash(i, 11) });
    }
    const span = big ? 70 : 44;
    this.g = this.ink(span, span);
  }

  protected step(): void {
    const { c, x, y } = this;
    const s = this.t / 1000;
    const g = this.g.begin(x, y, y + 6);
    // The suds on the ground, a ragged ring spreading and thinning.
    const k = clamp01(this.t / PUDDLE_MS);
    const r = (this.big ? 13 : 6) * (0.4 + k * 0.6);
    const fade = 1 - k;
    if (fade > 0) {
      for (let i = 0; i < (this.big ? 40 : 18); i++) {
        if (hash(i, 21, Math.floor(this.t / 90)) > fade + 0.15) continue;
        const a = (i / (this.big ? 40 : 18)) * Math.PI * 2 + hash(i, 2) * 0.3;
        const rr = r * (0.75 + hash(i, 4) * 0.4);
        g.put(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.55, i & 1 ? c.mid : c.light, 0.85 * fade);
      }
    }
    // The drops in flight: each a blob with a glint, falling to the ground and bursting there.
    for (const d of this.drops) {
      const z = d.vz * s - 0.5 * DROP_GRAVITY * s * s;
      if (z < -1) continue;
      const px = x + d.vx * s;
      const py = y + d.vy * s - Math.max(0, z);
      g.put(px, py, c.light);
      if (d.s > 0.45) g.put(px + 1, py, c.mid);
      if (d.s > 0.75) g.put(px, py + 1, c.deep);
      if (z > 4) g.put(px - 0.5, py - 1, c.glint, 0.8);
    }
    g.end();
  }
}

/**
 * The fire he spits: a mouthful of brew sprayed through the flame in his
 * fingers, a cone of licking tongues racing out and dropping burning spatter,
 * with a white-hot core at his lips. Aimed (and moved) every frame he pours
 * it; it dies back to his mouth once he stops.
 */
export class FireSpray extends Fx {
  private g: Ink;
  private lamp: Phaser.GameObjects.Light;
  private mx = 0;
  private my = 0;
  private ground = 0;
  private ux = 0;
  private uy = 1;
  private ending = -1;

  constructor(
    world: WorldScene,
    private p: Pal,
    private reach: number,
    private spread: number,
  ) {
    super(world, 10000);
    this.g = this.ink(reach * 2 + 24, reach * 2 + 24);
    this.lamp = this.light(0, 0, 80, p.light, 0);
  }

  aim(x: number, y: number, ground: number, ux: number, uy: number): void {
    this.mx = x;
    this.my = y;
    this.ground = ground;
    this.ux = ux;
    this.uy = uy;
  }

  /** The mouthful is spent: the fire dies back to his lips. */
  stop(): void {
    if (this.ending < 0) this.ending = 0;
  }

  protected step(dt: number): void {
    if (this.ending >= 0) {
      this.ending += dt;
      if (this.ending > 200) {
        this.destroy();
        return;
      }
    }
    const { p, mx, my, ux, uy, reach, spread } = this;
    const grow = clamp01(this.t / 120) * (this.ending >= 0 ? 1 - this.ending / 200 : 1);
    const far = reach * grow;
    const g = this.g.begin(mx, my, this.ground + reach * Math.max(0, uy) + 8);
    const a0 = Math.atan2(uy, ux);
    // Tongues: streaks at their own angles racing out, swelling and rising a little as they burn.
    const N = 22;
    for (let i = 0; i < N; i++) {
      const ang = a0 + (hash(i, 7) * 2 - 1) * spread * 0.95;
      const phase = ((this.t * 0.005 + hash(i, 3)) % 1) * far;
      const len = 6 + hash(i, Math.floor(this.t / 70)) * 9;
      for (let r = Math.max(0, phase - len); r <= phase; r += 0.9) {
        const f = r / reach;
        const wob = Math.sin(r * 0.45 + this.t * 0.022 + i) * (0.8 + f * 2.4);
        const px = mx + Math.cos(ang) * r - Math.sin(ang) * wob;
        const py = my + Math.sin(ang) * r * 0.8 + Math.cos(ang) * wob - f * f * 4;
        const c = f < 0.16 ? p.core : f < 0.42 ? p.hot : f < 0.72 ? p.mid : p.deep;
        g.put(px, py, c, f > 0.85 ? 0.55 : 1);
      }
    }
    // Spatter: burning drops of brew flung past the flames, falling to the ground.
    for (let i = 0; i < 8; i++) {
      const life = ((this.t * 0.0026 + hash(i, 13)) % 1);
      const ang = a0 + (hash(i, 17) * 2 - 1) * spread * 1.2;
      const r = far * (0.3 + life * 0.85);
      const drop = life * life * 14;
      g.put(mx + Math.cos(ang) * r, my + Math.sin(ang) * r * 0.8 + drop, life < 0.5 ? p.hot : p.mid, 1 - life * 0.6);
    }
    // The white-hot spray at his lips.
    for (let r = 0; r < Math.min(8, far); r += 1) for (let s = -1; s <= 1; s++) g.put(mx + ux * r - uy * s * (0.6 + r * 0.18), my + uy * r * 0.8 + ux * s * (0.6 + r * 0.18), r < 4 ? p.core : p.hot);
    g.end();
    this.lamp.setPosition(mx + ux * far * 0.5, my + uy * far * 0.5);
    this.lamp.intensity = 2 * grow * (0.85 + 0.15 * Math.sin(this.t * 0.05));
    if (Math.random() < dt / 45) this.world.debris(p.tints, mx + ux * far * 0.8, my + uy * far * 0.7, 1, this.ground + 20, 'spores');
  }
}
