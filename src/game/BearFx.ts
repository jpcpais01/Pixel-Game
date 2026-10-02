import type Phaser from 'phaser';
import type { Hurtbox } from './combat';
import type { WorldScene } from '../scenes/WorldScene';
import { bump, clamp01, dither, easeOut, Fx, GROUND, hash, ring, type Ink, type Pal } from './ultimate/ink';

// The Bear's effects (see Bear.ts): the wide arc of a swipe, the earth
// cracking under a smash or the Earthsplitter, the short shockwave a raging
// maul sends forward, the stars over a stunned foe, and the wrath's aura.

/** Earth thrown up and split: the crust, its shadowed side, the dark of the crack, pale dust. */
export const EARTH = { crust: 0x8a6440, side: 0x5a3e26, crack: 0x24160c, dust: 0xc8a878 };
/** Bamboo leaves, for the panda's quakes: light side, dark side. */
const LEAF = [0x94d466, 0x3a8030];

/**
 * A swipe's arc: a crescent of light sweeping across the aim from one side
 * to the other, three claw streaks inside it, fading as it goes.
 */
export class SwipeArc extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    /** The aim, screen radians. */
    private ang: number,
    private r: number,
    /** Which way it sweeps: 1 clockwise on screen, -1 back. */
    private turn: number,
    private p: Pal,
  ) {
    super(world, 230);
    this.g = this.ink(Math.ceil(r * 2 + 12), Math.ceil(r * 2 + 12));
  }

  protected step(): void {
    const { x, y, ang, r, turn, p } = this;
    const k = clamp01(this.t / 110);
    const fade = 1 - clamp01((this.t - 90) / 140);
    const g = this.g.begin(x, y, y + r + 20);
    const spread = (130 * Math.PI) / 180;
    const head = -spread / 2 + spread * easeOut(k);
    // Three streaks a few px apart, the middle one longest and brightest.
    for (let n = -1; n <= 1; n++) {
      const rr = r + n * 3;
      const steps = Math.ceil(rr * spread);
      for (let i = 0; i <= steps; i++) {
        const a = -spread / 2 + (spread * i) / steps;
        if (a > head) break;
        const behind = head - a;
        const lit = behind < 0.25 ? p.core : behind < 0.7 ? p.hot : behind < 1.3 ? p.mid : p.deep;
        const aa = ang + a * turn;
        const w = n === 0 ? 1 : 0.7;
        g.put(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr * 0.8, lit, fade * w * (1 - behind / (spread + 0.3)));
      }
    }
    g.end();
  }
}

/**
 * The earth cracking: jagged cracks running out from (x, y) and glowing
 * inside, a ring of upheaved crust rolling out to `r`, chunks of it tossed
 * up; the cracks linger and close. `leaves` sends bamboo leaves fluttering
 * out with the panda's.
 */
export class EarthCracks extends Fx {
  private g: Ink;
  private cracks: { x: number; y: number }[][] = [];
  private bits: { a: number; d: number; v: number; up: number; leaf: boolean; s: number }[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private r: number,
    private p: Pal,
    leaves: boolean,
    /** How long the cracks linger, ms. */
    private linger = 900,
  ) {
    super(world, linger + 300);
    this.g = this.ink(Math.ceil(r * 2 + 24), Math.ceil(r * 2 * GROUND + 60));
    const seed = Math.random() * 1000;
    const n = r > 30 ? 9 : 5;
    for (let i = 0; i < n; i++) {
      // Each crack wanders out, a step at a time, forking once.
      const a0 = (i / n) * Math.PI * 2 + hash(i, seed) * 0.5;
      const len = r * (0.55 + 0.4 * hash(i, seed, 1));
      const path = [{ x: 0, y: 0 }];
      let a = a0;
      for (let d = 3; d <= len; d += 3) {
        a += (hash(i, d, seed) - 0.5) * 0.9;
        path.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * GROUND });
      }
      this.cracks.push(path);
      if (path.length > 4 && hash(i, seed, 2) < 0.6) {
        const from = path[Math.floor(path.length / 2)];
        const fa = a0 + (hash(i, seed, 3) < 0.5 ? 0.7 : -0.7);
        const fork = [from];
        for (let d = 3; d <= len * 0.4; d += 3) fork.push({ x: from.x + Math.cos(fa) * d, y: from.y + Math.sin(fa) * d * GROUND });
        this.cracks.push(fork);
      }
    }
    const m = r > 30 ? 14 : 6;
    for (let i = 0; i < m; i++) {
      this.bits.push({ a: Math.random() * Math.PI * 2, d: r * (0.2 + Math.random() * 0.5), v: 0.4 + Math.random() * 0.6, up: 10 + Math.random() * 16, leaf: leaves && i % 2 === 0, s: Math.random() < 0.4 ? 2 : 1 });
    }
  }

  protected step(): void {
    const { x, y, r, p } = this;
    const g = this.g.begin(x, y, y - 1, 0.5, 0.75);
    const open = easeOut(this.t / 160);
    const close = 1 - clamp01((this.t - this.linger) / 300);
    // The cracks: dark, lit from within while fresh.
    const hot = 1 - clamp01(this.t / 600);
    for (const path of this.cracks) {
      const shown = Math.ceil(path.length * open);
      for (let i = 1; i < shown; i++) {
        const a = path[i - 1];
        const b = path[i];
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
        for (let s = 0; s <= n; s++) {
          const px = x + a.x + ((b.x - a.x) * s) / n;
          const py = y + a.y + ((b.y - a.y) * s) / n;
          if (close < 1 && dither(Math.round(px) & 3, Math.round(py) & 3) >= close) continue;
          const c = hot > 0.5 ? (i < 3 ? p.core : p.hot) : hot > 0.15 ? p.mid : EARTH.crack;
          g.put(px, py, c, 1);
          // The lip of the crack catching the light above it.
          g.put(px, py - 1, EARTH.crust, 0.8 * close);
        }
      }
    }
    // The ring of crust heaved up as the shock rolls out.
    const k = clamp01(this.t / 380);
    if (k < 1) {
      const rr = 4 + (r - 4) * easeOut(k);
      const a = 1 - k;
      ring(g, x, y, rr, 2, { core: EARTH.dust, hot: EARTH.crust, mid: EARTH.side, deep: EARTH.crack, light: EARTH.crust, tints: [] }, a);
      ring(g, x, y, rr - 3, 1, p, a * 0.8, GROUND, 0.35, 3);
    }
    // Chunks of earth (and leaves) thrown up and falling back.
    for (const b of this.bits) {
      const q = clamp01(this.t / (520 * b.v + 200));
      if (q >= 1 && !b.leaf) continue;
      const d = b.d + r * 0.35 * easeOut(q);
      const bx = x + Math.cos(b.a) * d;
      const by = y + Math.sin(b.a) * d * GROUND;
      if (b.leaf) {
        // A leaf drifts down slowly, rocking.
        const lq = clamp01(this.t / 1100);
        const z = b.up * 1.6 * bump(Math.min(1, lq * 1.6)) + (1 - lq) * 4;
        const sway = Math.sin(this.t * 0.012 + b.a * 5) * 2;
        const la = 1 - clamp01((this.t - 900) / 300);
        g.put(bx + sway, by - z, LEAF[0], la);
        g.put(bx + sway + (sway > 0 ? 1 : -1), by - z + 1, LEAF[1], la);
        continue;
      }
      const z = b.up * bump(q);
      g.put(bx, by - z, EARTH.crust, 1);
      if (b.s > 1) {
        g.put(bx + 1, by - z, EARTH.side, 1);
        g.put(bx, by - z + 1, EARTH.side, 1);
      }
    }
    g.end();
  }
}

/**
 * The short shockwave a raging maul sends forward: a crescent of heaved
 * earth and light rolling out along the aim, striking each foe it meets
 * once.
 */
export class RageWave extends Fx {
  private g: Ink;
  private struck = new Set<Hurtbox>();

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private dx: number,
    private dy: number,
    private reach: number,
    private damage: number,
    private p: Pal,
  ) {
    super(world, 300);
    this.g = this.ink(Math.ceil(reach * 2 + 30), Math.ceil(reach * 2 + 30));
  }

  protected step(): void {
    const { x, y, dx, dy, reach, p } = this;
    const k = clamp01(this.t / 260);
    const d = 8 + (reach - 8) * easeOut(k);
    const fx = x + dx * d;
    const fy = y + dy * d * 0.8;
    const w = this.world;
    for (const h of w.hurtboxesWhere((b) => b.alive && !this.struck.has(b) && Math.hypot(b.x - fx, (b.y - fy) / 0.8) <= 11 + b.radius)) {
      this.struck.add(h);
      h.hurt({ damage: this.damage, heavy: true, knock: 150, fromX: x, fromY: y });
      w.debris([EARTH.crust, EARTH.side, p.hot], h.x, h.y - h.bodyY, 5, h.y + 10, 'burst');
    }
    const g = this.g.begin(x, y, y - 1);
    const a = 1 - k;
    const ang = Math.atan2(dy, dx);
    // The crescent: an arc across the aim, bright at its heart.
    for (let i = -10; i <= 10; i++) {
      const t = i / 10;
      const aa = ang + t * 0.9;
      const rr = d - Math.abs(t) * 3;
      const px = x + Math.cos(aa) * rr;
      const py = y + Math.sin(aa) * rr * 0.8;
      const edge = Math.abs(t);
      g.put(px, py, edge < 0.3 ? p.core : edge < 0.65 ? p.hot : p.mid, a);
      g.put(px - Math.cos(aa), py - Math.sin(aa) * 0.8, EARTH.crust, a);
      g.put(px - Math.cos(aa) * 2, py - Math.sin(aa) * 1.6, EARTH.side, a * 0.8);
    }
    g.end();
    if (Math.random() < 0.5) w.debris([EARTH.crust, EARTH.dust], fx, fy, 1, fy + 4, 'trail');
  }
}

/** Little stars wheeling over a stunned foe's head, for as long as it's stunned. */
export class Dazed extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private h: Hurtbox,
    ms: number,
    private p: Pal,
  ) {
    super(world, ms);
    this.g = this.ink(24, 14);
  }

  protected step(): void {
    const { h, p } = this;
    if (!h.alive) {
      this.destroy();
      return;
    }
    const hx = h.x;
    const hy = h.y - h.bodyY * 2 - 6;
    const g = this.g.begin(hx, hy, h.y + 20);
    const a = 1 - clamp01((this.t - (this.life - 200)) / 200);
    for (let i = 0; i < 3; i++) {
      const th = this.t * 0.008 + (i * Math.PI * 2) / 3;
      const sx = hx + Math.cos(th) * 7;
      const sy = hy + Math.sin(th) * 2.5;
      const front = Math.sin(th) > 0;
      g.put(sx, sy, front ? p.core : p.mid, a);
      if (front) {
        g.put(sx + 1, sy, p.hot, a);
        g.put(sx - 1, sy, p.hot, a);
        g.put(sx, sy + 1, p.hot, a);
        g.put(sx, sy - 1, p.hot, a);
      }
    }
    g.end();
  }
}

/**
 * The wrath on him: embers (or jade motes) rising round his body, a ring of
 * light pulsing at his feet, and his own glow on the ground. Follows `at`.
 */
export class WrathAura extends Fx {
  private g: Ink;
  private lamp: Phaser.GameObjects.Light;
  private motes: { x: number; z: number; v: number; s: number }[] = [];

  constructor(
    world: WorldScene,
    private at: { x: number; y: number; size: number },
    ms: number,
    private p: Pal,
  ) {
    super(world, ms);
    this.g = this.ink(56, 64);
    this.lamp = this.light(at.x, at.y - 16, 80, p.light, 0);
  }

  protected step(dt: number): void {
    const { at, p } = this;
    const fadeIn = clamp01(this.t / 200);
    const fadeOut = 1 - clamp01((this.t - (this.life - 400)) / 400);
    const a = fadeIn * fadeOut;
    if (Math.random() < dt / 45) this.motes.push({ x: (Math.random() - 0.5) * 22 * at.size, z: 2 + Math.random() * 8, v: 18 + Math.random() * 22, s: Math.random() });
    for (const m of this.motes) m.z += (m.v * dt) / 1000;
    this.motes = this.motes.filter((m) => m.z < 40 * at.size);
    const g = this.g.begin(at.x, at.y, at.y + 0.5, 0.5, 0.85);
    // The pulsing ring at his feet.
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 0.012);
    ring(g, at.x, at.y, 12 * at.size + pulse * 2, 1, p, a * (0.45 + 0.35 * pulse), GROUND, 0.3, Math.floor(this.t / 120));
    for (const m of this.motes) {
      const life = m.z / (40 * at.size);
      const c = life < 0.3 ? p.core : life < 0.6 ? p.hot : p.mid;
      const px = at.x + m.x + Math.sin(m.z * 0.3 + m.s * 6) * 1.5;
      g.put(px, at.y - m.z, c, a * (1 - life));
    }
    g.end();
    this.lamp.setPosition(at.x, at.y - 16);
    this.lamp.intensity = (1.1 + 0.4 * pulse) * a;
  }
}
