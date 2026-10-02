import type Phaser from 'phaser';
import { sound } from '../../audio';
import { bindFoe } from '../Strings';
import { onGround } from '../Toxins';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, dither, easeIn, easeOut, flare, Fx, GROUND, hash, ring, rune, type Ink } from './ink';
import type { Cast, IconPainter } from './types';

// The Force Sage's Special, Levitation: she raises her arms and every foe in
// a wide ring round her is lifted off the ground (drawn up in the air, their
// shadows left behind on it, each held in a band of light with grit and
// pebbles rising with it), drifting there for a breath; then she brings her
// arms down and they are all slammed into the ground together, dust bursting
// from each. Bosses are too heavy to lift: the Force holds them nearly still
// instead, and they're slammed all the same. The Dawnseer's is morning gold.

/** The ring she lifts: its reach on the ground. */
const R = 64;
/** Foes stepping into it are taken up until this long in. */
const SEIZE_UNTIL = 350;
/** How high they're held, and for how long before the slam. */
const LIFT = 15;
export const LEVITATE_HOLD = 1500;
/** The lift's small blow, and the slam's. */
const LIFT_DAMAGE = 6;
const SLAM_DAMAGE = 60;
/** Bosses can't be lifted: they're held to this share of their pace instead. */
const BOSS_HOLD = 0.15;
/** Held foes drift in slow circles this many px/s. */
const DRIFT = 7;
const LIFE = LEVITATE_HOLD + 900;

interface Held {
  lifted: boolean;
  since: number;
  /** Its own phase for drifting and the motes rising under it. */
  seed: number;
}

/** A hero that can be held in the Special's pose (the Sage). */
type Channeler = { channel?(ms: number): void };

export class Levitation extends Fx {
  private ground: Ink;
  private air: Ink;
  private seized = new Map<Hurtbox, Held>();
  private slammed = false;
  private lamp: Phaser.GameObjects.Light;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, LIFE);
    this.ground = this.ink(R * 2 + 40, Math.ceil(R * 2 * GROUND) + 40);
    this.air = this.ink(R * 2 + 60, Math.ceil(R * 2 * GROUND) + 120);
    this.lamp = this.light(c.tx, c.ty - 12, 150, c.pal.light, 0);
    (c.hero as Channeler).channel?.(LEVITATE_HOLD);
    sound.forceGrip(world.pan(c.tx));
    this.seize();
  }

  /** Take up every foe in the ring not already held. */
  private seize(): void {
    const { tx, ty, pal: p } = this.c;
    for (const h of this.world.hurtboxesWhere((b) => b.alive && !this.seized.has(b) && onGround(b, tx, ty, R))) {
      const lifted = bindFoe(h, LEVITATE_HOLD - this.t + 80, LIFT);
      if (!lifted) h.slow?.(BOSS_HOLD, LEVITATE_HOLD - this.t + 80, p.hot);
      h.hurt({ damage: LIFT_DAMAGE, heavy: false, knock: 0, fromX: h.x, fromY: h.y + 4 });
      this.seized.set(h, { lifted, since: this.t, seed: this.seized.size * 1.7 + Math.random() });
      // Grit and dust torn up from where it stood.
      this.world.debris([0x8a7a64, 0x6a5a48, p.mid], h.x, h.y, 6, h.y + 2, 'burst');
    }
  }

  protected step(dt: number): void {
    const { t } = this;
    if (!this.slammed) {
      if (t < SEIZE_UNTIL) this.seize();
      // Drifting a little, each its own slow way round.
      for (const [h, held] of this.seized) {
        if (!h.alive || !held.lifted) continue;
        const m = h as Hurtbox & { shove?(dx: number, dy: number): void };
        const a = t * 0.0025 + held.seed;
        const s = (DRIFT * dt) / 1000;
        m.shove?.(Math.cos(a) * s, Math.sin(a) * s * GROUND);
      }
      if (t >= LEVITATE_HOLD) this.slam();
    }
    this.draw();
    const glow = t < LEVITATE_HOLD ? 0.8 + 0.6 * clamp01(t / 300) + 0.2 * Math.sin(t * 0.02) : 2.8 * (1 - clamp01((t - LEVITATE_HOLD) / 500));
    this.lamp.intensity = glow;
  }

  /** Down they all come, at once. */
  private slam(): void {
    this.slammed = true;
    const { c, world } = this;
    const p = c.pal;
    for (const [h] of this.seized) {
      if (!h.alive) continue;
      // Dropped at once, and left a moment flat on the ground.
      bindFoe(h, 320, 0);
      h.hurt({ damage: SLAM_DAMAGE, heavy: true, knock: 40, fromX: h.x, fromY: h.y - 20 });
      world.debris([0x9a8a70, 0x7a6a54, 0x5a4a3a, p.hot], h.x, h.y, 12, h.y + 6, 'burst');
      bloom(world, h.x, h.y - 2, p.hot, 1.1, 260, h.y + 10);
    }
    sound.forceCrush(world.pan(c.tx));
    sound.forceStone(world.pan(c.tx), 'big');
    world.cameras.main.shake(300, this.seized.size ? 0.0045 : 0.002);
    flare(world, c.tx, c.ty - 6, 170, p.light, 3, 560);
    world.debris([p.core, p.hot, p.mid], c.tx, c.ty, 16, c.ty + 10, 'burst');
  }

  private draw(): void {
    const { c, t } = this;
    const { tx, ty } = c;
    const p = c.pal;
    const open = easeOut(t / 320);
    const fade = this.slammed ? 1 - clamp01((t - LEVITATE_HOLD - 150) / (LIFE - LEVITATE_HOLD - 150)) : 1;

    // On the ground: the ring of her reach turning, a rune at her feet, and a glow under each one held.
    const g = this.ground.begin(tx, ty, 2.5);
    ring(g, tx, ty, R * open, 1.1, p, 0.85 * fade, GROUND, 0.25, Math.floor(t / 120));
    rune(g, tx, ty, 18 * open, t * 0.004, p, 0.9 * fade);
    for (const [h, held] of this.seized) {
      if (!h.alive && !this.slammed) continue;
      const since = t - held.since;
      const k = easeOut(since / 260);
      if (!this.slammed) ring(g, h.x, h.y, (h.radius + 2) * k, 0.8, p, 0.8 * k);
      else {
        // The crater of the slam rolling out from each.
        const s = clamp01((t - LEVITATE_HOLD) / 420);
        if (s < 1) ring(g, h.x, h.y, (h.radius + 2) + 14 * easeOut(s), 2.4 * (1 - s) + 0.6, p, 1 - s);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + held.seed;
          for (let r = 3; r < h.radius + 9; r++) {
            const x = h.x + Math.cos(a + Math.sin(r * 0.7 + i) * 0.2) * r;
            const y = h.y + Math.sin(a + Math.sin(r * 0.7 + i) * 0.2) * r * GROUND;
            if (dither(Math.round(x), Math.round(y)) < fade * 0.9) g.put(x, y, r < 6 ? p.mid : 0x3a2e24, 0.85);
          }
        }
      }
    }
    // A wave of light rolling out from her as she casts.
    const w = clamp01(t / 380);
    if (w < 1) ring(g, tx, ty, R * easeOut(w), 2.2 * (1 - w) + 0.5, p, 1 - w);
    g.end();

    // In the air: each one held in a band of light, motes and pebbles rising from its shadow to it.
    const a = this.air.begin(tx, ty - 30, ty + R * GROUND + 8);
    if (!this.slammed) {
      for (const [h, held] of this.seized) {
        if (!h.alive) continue;
        const since = t - held.since;
        const k = easeOut(since / 260);
        const bx = h.x;
        const by = h.y - h.bodyY;
        const rr = h.radius + 3 + Math.sin(t * 0.012 + held.seed) * 0.7;
        ring(a, bx, by, rr, 0.8, p, 0.85 * k, 0.4, 0.3, Math.floor(t / 80) + Math.round(held.seed * 10));
        for (let i = 0; i < 5; i++) {
          // Rising from the ground to the body and starting again.
          const u = (t * 0.0012 + i / 5 + held.seed) % 1;
          const x = h.x + (hash(i, Math.round(held.seed * 7), 1) - 0.5) * h.radius * 2.2;
          const y = h.y - (h.bodyY + 4) * u;
          const pebble = i % 2 === 0;
          const q = k * (u < 0.15 ? u / 0.15 : u > 0.85 ? (1 - u) / 0.15 : 1);
          if (pebble) {
            a.put(x, y, 0x7a6e60, q);
            a.put(x + 1, y, 0x5a5044, q);
            a.put(x, y - 1, p.hot, q * 0.7);
          } else a.put(x, y, u > 0.5 ? p.core : p.hot, q);
        }
        if (!held.lifted) {
          // A boss: held fast where it stands, the Force pressing round it.
          for (let i = 0; i < 4; i++) {
            const ang = t * 0.004 + (i / 4) * Math.PI * 2;
            a.put(bx + Math.cos(ang) * (rr + 2), by + Math.sin(ang) * (rr + 2) * 0.5, p.core, 0.9);
          }
        }
      }
    } else {
      // A burst of dust where each one hit.
      const s = clamp01((t - LEVITATE_HOLD) / 300);
      if (s < 1) {
        for (const [h, held] of this.seized) {
          for (let i = 0; i < 10; i++) {
            const ang = Math.PI + (i / 9) * Math.PI;
            const r = (h.radius + 4) * (0.4 + easeIn(s) * 1.4) * (0.7 + hash(i, Math.round(held.seed * 5)) * 0.5);
            a.put(h.x + Math.cos(ang) * r, h.y + Math.sin(ang) * r * 0.6, i % 3 ? 0x9a8a70 : p.mid, 1 - s);
          }
        }
      }
    }
    a.end();
  }
}

/** Levitation: a foe raised over its shadow between two lifted hands, pebbles floating up round it. */
export const levitationIcon: IconPainter = (put, p) => {
  // Its shadow on the ground, and the ring of light round it.
  for (let x = 4; x <= 12; x++) put(x, 14, x === 4 || x === 12 ? p.mid : p.deep);
  for (let x = 6; x <= 10; x++) put(x, 13, p.deep);
  // The foe up in the air: a round body in a band of light.
  for (let y = 3; y <= 9; y++) for (let x = 5; x <= 11; x++) if ((x - 8) ** 2 + (y - 6) ** 2 * 1.2 <= 9) put(x, y, y < 5 ? p.mid : p.deep);
  for (let x = 3; x <= 13; x++) put(x, 7, x % 2 ? p.hot : p.core);
  // Pebbles and motes rising.
  for (const [x, y] of [[3, 11], [13, 10], [6, 11], [10, 12]] as const) put(x, y, p.hot);
  put(2, 4, p.core);
  put(14, 3, p.core);
};
