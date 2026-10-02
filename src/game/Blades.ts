import Phaser from 'phaser';
import { sound } from '../audio';
import { reachesBody, type Hurtbox } from './combat';
import { bindFoe } from './Strings';
import { snap } from './display';
import { bloom, clamp01, easeOut, flare, Fx, hash, Ink, ring, type Pal } from './ultimate/ink';
import type { Scheme } from './Slash';
import type { WorldScene } from '../scenes/WorldScene';

// The samurai's wind and cuts: the Bladewind's gust (a small tornado that
// throws foes into the air), the whirl of wind round a charged spin, and the
// delayed cut that opens on a foe a beat after the blade has passed.

/** How long a knock-up throws a foe into the air, and how high. Legends and Myths stand firm. */
export const KNOCK_UP_MS = 500;
export const KNOCK_UP_LIFT = 12;

/** A scheme as a Special palette (the ink kit's colours). */
export const schemePal = (s: Scheme): Pal => ({ core: s.core, hot: s.hot, mid: s.mid, deep: s.deep, light: s.light ?? s.hot, tints: [s.core, s.hot, s.mid, s.deep] });

/** Is it up in the air right now (knocked up, or hoisted on strings), and so fair game for the Sky Quake? */
export const airborne = (h: Hurtbox): boolean => h.alive && !!h.airborne;

/**
 * The gust: a small tornado that leaves the blade and runs straight out along
 * the ground, cutting everything it passes through and throwing it into the
 * air. It stops at a wall.
 */
export class Gust extends Fx {
  private pix: Ink;
  private shadow: Phaser.GameObjects.Image;
  private lamp: Phaser.GameObjects.Light;
  private gx: number;
  private gy: number;
  private hit = new Set<Hurtbox>();
  private going = true;
  private spin = 0;
  private dust = 0;
  private static readonly SPEED = 230;
  private static readonly REACH = 112;

  constructor(
    world: WorldScene,
    x: number,
    y: number,
    private ux: number,
    private uy: number,
    private p: Pal,
    private damage: number,
  ) {
    super(world, 1000);
    this.gx = x;
    this.gy = y;
    this.pix = this.ink(30, 40);
    this.shadow = this.own(world.add.image(x, y, 'shadow').setDepth(1.5).setAlpha(0.35).setScale(1.2, 1));
    this.lamp = this.light(x, y - 12, 60, p.light, 1.1);
    sound.gust(world.pan(x));
  }

  protected step(dt: number): void {
    const { world, t } = this;
    const travel = (Gust.REACH / Gust.SPEED) * 1000;
    if (this.going) {
      const s = (Gust.SPEED * dt) / 1000;
      const nx = this.gx + this.ux * s;
      const ny = this.gy + this.uy * s;
      if (t >= travel || !world.walkable(nx, ny)) this.going = false;
      else {
        this.gx = nx;
        this.gy = ny;
      }
      // Whatever it passes through is cut and thrown up.
      const area = { kind: 'circle' as const, x: this.gx, y: this.gy - 9, radius: 10 };
      for (const h of world.hurtboxesWhere((b) => b.alive && !this.hit.has(b) && !!reachesBody(area, b))) {
        this.hit.add(h);
        h.hurt({ damage: this.damage, heavy: false, knock: 0, fromX: this.gx, fromY: this.gy });
        bindFoe(h, KNOCK_UP_MS, KNOCK_UP_LIFT);
        world.debris(this.p.tints, snap(h.x), snap(h.y - h.bodyY), 6, h.y + 20, 'burst');
      }
      this.dust -= dt;
      if (this.dust <= 0) {
        this.dust = 60;
        world.debris([this.p.mid, this.p.deep, 0xcfc6b0], snap(this.gx), snap(this.gy) - 1, 2, this.gy + 1, 'spores');
      }
    }
    const fade = this.going ? Math.min(1, t / 60) : Math.max(0, 1 - (t - Math.min(t, travel)) / 160);
    if (!this.going && fade <= 0) {
      this.destroy();
      return;
    }
    this.spin += dt * 0.024;
    const x = snap(this.gx);
    const y = snap(this.gy);
    this.shadow.setPosition(x, y).setAlpha(0.35 * fade);
    this.lamp.setPosition(x, y - 14);
    this.lamp.intensity = 1.1 * fade;
    // The funnel: rings of wind from a tight foot to a wide mouth, turning,
    // with the near side bright and the far side dim.
    const g = this.pix.begin(x, y + 2, y + 6, 0.5, 1);
    const H = 30;
    for (let k = 0; k <= H; k++) {
      const r = 1.5 + k * 0.33 + Math.sin(k * 0.5 + this.spin * 0.7) * 0.6;
      const lean = Math.sin(k * 0.18 - this.spin * 0.5) * (k / H) * 2;
      const n = Math.max(3, Math.round(r * 1.6));
      for (let i = 0; i < n; i++) {
        const a = this.spin * (1.4 - k / H * 0.5) + (i / n) * Math.PI * 2 + k * 0.4;
        const front = Math.sin(a);
        if (hash(k, i, Math.floor(t / 50)) > 0.55 + front * 0.2) continue;
        const px = x + lean + Math.cos(a) * r;
        const py = y - k + front * r * 0.3;
        const c = front > 0.5 ? this.p.core : front > 0 ? this.p.hot : front > -0.5 ? this.p.mid : this.p.deep;
        g.put(px, py, c, fade * (front > 0 ? 1 : 0.7));
      }
    }
    g.end();
  }
}

/** A charged spin's whirlwind: a ring of wind racing out round the samurai, throwing up all it catches. */
export class WindRing extends Fx {
  private pix: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
    damage: number,
    private reach = 34,
  ) {
    super(world, 320);
    this.pix = this.ink(reach * 2 + 12, Math.ceil(reach * 1.4) + 12);
    for (const h of world.hurtboxesWhere((b) => b.alive && Math.hypot((b.x - x) / (reach + b.radius), (b.y - y) / (reach * 0.7 + b.radius)) <= 1)) {
      h.hurt({ damage, heavy: false, knock: 0, fromX: x, fromY: y });
      bindFoe(h, KNOCK_UP_MS, KNOCK_UP_LIFT);
      world.debris(p.tints, snap(h.x), snap(h.y - h.bodyY), 6, h.y + 20, 'burst');
    }
    flare(world, x, y - 8, 90, p.light, 1.6, 300);
    sound.gust(world.pan(x));
  }

  protected step(): void {
    const k = this.t / this.life;
    const g = this.pix.begin(this.x, this.y, this.y - 1);
    const r = 6 + (this.reach - 6) * easeOut(k * 1.3);
    ring(g, this.x, this.y, r, 1.4 - k, this.p, 1 - k * k, 0.62, 0.45, Math.floor(this.t / 40));
    ring(g, this.x, this.y, r * 0.7, 0.8, this.p, (1 - k) * 0.6, 0.62, 0.6, Math.floor(this.t / 40) + 7);
    g.end();
  }
}

/**
 * A cut opening on a foe a beat after the blade has passed: two strokes of
 * light crossing its body, one after the other, flaring and fading.
 */
export class CutBurst extends Fx {
  private pix: Ink;
  private readonly a: number;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
    private big = false,
  ) {
    super(world, 300);
    this.pix = this.ink(34, 34);
    this.a = hash(Math.round(x), Math.round(y)) * Math.PI;
    bloom(world, x, y, p.hot, big ? 1.1 : 0.8, 260, y + 30, 0.7);
  }

  protected step(): void {
    const g = this.pix.begin(this.x, this.y, this.y + 40);
    const R = this.big ? 15 : 11;
    for (let s = 0; s < 2; s++) {
      const k = clamp01((this.t - s * 70) / 150);
      if (k <= 0) continue;
      const fade = 1 - clamp01((this.t - s * 70 - 120) / 160);
      const a = this.a + s * (Math.PI / 2 + 0.3);
      const ux = Math.cos(a);
      const uy = Math.sin(a) * 0.9;
      const head = -R + 2 * R * easeOut(k);
      for (let d = -R; d <= head; d += 0.5) {
        const w = 1 - Math.abs(d) / R;
        const c = w > 0.6 ? this.p.core : w > 0.3 ? this.p.hot : this.p.mid;
        g.put(this.x + ux * d, this.y + uy * d, c, fade);
        if (w > 0.45) g.put(this.x + ux * d - uy, this.y + uy * d + ux, this.p.mid, fade * 0.8);
      }
    }
    g.end();
  }
}

/** A skin's drifting motes: black feathers, snowflakes. `colors` run dark, mid, bright. */
export interface Motes {
  kind: 'feather' | 'snow';
  colors: [number, number, number];
}

/** How long a mote drifts, and how far the burst throws them before they settle into falling. */
const DRIFT_MS = 1100;
const DRIFT_SPREAD = 38;
const DRIFT_FALL = 14;

/**
 * A few motes thrown off a cut and drifting down: crow feathers that rock as
 * they fall, or snowflakes that twinkle. Only for show; they touch nothing.
 */
export class Drift extends Fx {
  private pix: Ink;
  private motes: { x: number; y: number; vx: number; vy: number; ph: number; life: number }[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private m: Motes,
    n: number,
    private depth: number,
  ) {
    super(world, DRIFT_MS);
    this.pix = this.ink(64, 64);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = DRIFT_SPREAD * (0.4 + Math.random() * 0.6);
      this.motes.push({ x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 12, ph: Math.random() * 6.28, life: DRIFT_MS * (0.65 + Math.random() * 0.35) });
    }
  }

  protected step(dt: number): void {
    const s = dt / 1000;
    const g = this.pix.begin(this.x, this.y, this.depth);
    const [dark, mid, bright] = this.m.colors;
    for (const p of this.motes) {
      // The burst slows quickly, then they fall gently, swaying side to side.
      const k = Math.exp(-5 * s);
      p.vx *= k;
      p.vy = p.vy * k + DRIFT_FALL * (1 - k);
      const sway = Math.sin(this.t * 0.006 + p.ph);
      p.x += (p.vx + sway * 9) * s;
      p.y += p.vy * s;
      const a = 1 - clamp01((this.t - p.life * 0.65) / (p.life * 0.35));
      if (a <= 0) continue;
      const x = this.x + p.x;
      const y = this.y + p.y;
      if (this.m.kind === 'feather') {
        // A slim feather rocking as it falls: dark vane, a brighter shaft, a glint at the quill.
        const r = sway * 0.9;
        const dx = Math.cos(r);
        const dy = Math.sin(r) * 0.8;
        g.put(x - dx, y - dy, dark, a);
        g.put(x, y, mid, a);
        g.put(x + dx, y + dy, dark, a);
        g.put(x - dx * 2, y - dy * 2, dark, a * 0.7);
        if (sway > 0.3) g.put(x + dx * 1.6, y + dy * 1.6 + 1, bright, a * 0.8);
      } else {
        // A snowflake: a bright point, opening into a little star as it catches the light.
        g.put(x, y, bright, a);
        if (Math.sin(this.t * 0.012 + p.ph * 3) > 0.4) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.put(x + ox, y + oy, mid, a * 0.7);
        else g.put(x + 1, y + 1, dark, a * 0.4);
      }
    }
    g.end();
  }
}
