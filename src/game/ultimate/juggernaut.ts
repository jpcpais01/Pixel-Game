import type Phaser from 'phaser';
import { sound } from '../../audio';
import { JUGG_CHEST_Y } from '../../art/juggernaut';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, dither, easeOut, flare, Fx, GROUND, hash, ring, strikeGround, type Ink, type Pal } from './ink';
import type { Cast, IconPainter } from './types';

// The Juggernaut's Special, Meltdown. The hero does it itself (see
// Juggernaut.meltdown): its furnace bursts open and for a while its heat is
// pinned in the red, so every blow lands hot and none of them vents. This
// file holds what goes with it:
//  - Meltdown: the scalding steam wreathed round it, burning everything close
//    every tick, and at the end the great vent: a blast of steam that hurls
//    everything round it away. The Tin Man's steam is shot with rosy hearts.
//  - HeatWave: the shockwave each punch throws out ahead of the fist while it
//    burns, a crescent of heat rushing on past its reach.

/** How long the furnace burns open. */
export const MELT_MS = 5000;
/** The great vent at the end: how long its blast takes to roll out. */
const BLAST_MS = 450;
const BURN_RADIUS = 30;
const BURN_EVERY = 400;
const BURN_DAMAGE = 4;
const BLAST_RADIUS = 52;
const BLAST_DAMAGE = 30;
const BLAST_KNOCK = 280;

/** A punch's shockwave: how far it rolls past the fist, how long it takes, how wide it spreads. */
const WAVE_REACH = 46;
const WAVE_MS = 240;
const WAVE_SPREAD = (50 * Math.PI) / 180;
export const WAVE_DAMAGE = 6;
export const WAVE_SLAM_DAMAGE = 11;

const INK_W = 140;
const INK_H = 110;
const STEAM_TONES = [0xffffff, 0xe6ecf2, 0xc0cad6, 0x8a96a6];

/** What the wreath follows: the hero. */
interface Host {
  x: number;
  y: number;
}

interface Wisp {
  /** Angle round the body, how far out, how high, its size and its own drift. */
  a: number;
  r: number;
  h: number;
  size: number;
  seed: number;
}

/** A small heart of light, 5 wide, its middle at (x, y). */
const HEART = ['.1.1.', '11111', '.111.', '..1..'];
function heart(g: Ink, x: number, y: number, p: Pal, a: number): void {
  HEART.forEach((row, r) => [...row].forEach((b, k) => b === '1' && g.put(x - 2 + k, y - 2 + r, r === 0 ? p.hot : k === 1 && r === 1 ? p.core : p.mid, a)));
}

/** A soft round puff: solid at heart, dithering away at its rim and as `a` drops. */
function puff(g: Ink, x: number, y: number, r: number, a: number, tint: number): void {
  if (r <= 0 || a <= 0) return;
  for (let dy = -Math.ceil(r); dy <= r; dy++)
    for (let dx = -Math.ceil(r); dx <= r; dx++) {
      const d = Math.hypot(dx, dy * 1.15) / r;
      if (d > 1) continue;
      const X = Math.round(x + dx);
      const Y = Math.round(y + dy);
      if (dither(X, Y) >= a * (1 - d * d)) continue;
      // Lit white on top, greyer below, the fire's colour showing at its underside.
      const c = dy < -r * 0.35 ? STEAM_TONES[0] : dy > r * 0.45 ? tint : d < 0.6 ? STEAM_TONES[1] : STEAM_TONES[2];
      g.put(X, Y, c, 0.9);
    }
}

export class Meltdown extends Fx {
  private back: Ink;
  private front: Ink;
  private lamp: Phaser.GameObjects.Light;
  private wisps: Wisp[] = [];
  private burnT = BURN_EVERY * 0.5;
  private emberT = 0;
  private blown = false;
  private blastAt = { x: 0, y: 0 };
  private tin: boolean;
  private p: Pal;

  constructor(
    world: WorldScene,
    c: Cast,
    private host: Host,
  ) {
    super(world, MELT_MS + BLAST_MS);
    this.p = c.pal;
    this.tin = c.look === 'tinman';
    this.back = this.ink(INK_W, INK_H);
    this.front = this.ink(INK_W, INK_H);
    this.lamp = this.light(host.x, host.y - JUGG_CHEST_Y, 90, c.pal.light, 1.6);
    for (let i = 0; i < 14; i++) this.wisps.push({ a: (i / 14) * Math.PI * 2, r: 13 + (i % 3) * 4, h: 4 + (i % 4) * 6, size: 2.2 + (i % 3) * 0.8, seed: i * 7.3 });
    // The furnace door blows open.
    const x = host.x;
    const y = host.y - JUGG_CHEST_Y;
    bloom(world, x, y, c.pal.hot, 2.4, 500, host.y + 40);
    flare(world, x, y, 140, c.pal.light, 3, 600);
    world.debris(c.pal.tints, x, y, 22, host.y + 20, 'burst');
    world.debris(STEAM_TONES, x, y - 6, 18, host.y + 20, 'spores');
    world.cameras.main.shake(160, 0.001);
    sound.blast(world.pan(x));
    sound.flame(world.pan(x));
  }

  /** Still burning open (the hero hits hot and never vents while it is). */
  get melting(): boolean {
    return !this.dead && !this.blown;
  }

  timeLeft(): { left: number; total: number } | null {
    return this.melting ? { left: MELT_MS - this.t, total: MELT_MS } : null;
  }

  protected step(dt: number): void {
    const w = this.world;
    // Struck down: the fire gutters out, no blast.
    if (!this.blown && w.heroDown) {
      this.destroy();
      return;
    }
    if (!this.blown && this.t >= MELT_MS) this.blast();
    if (this.blown) this.drawBlast();
    else this.burn(dt);
  }

  /** The wreath: steam boiling round the body, a glow on the ground, embers; everything close scalded each tick. */
  private burn(dt: number): void {
    const w = this.world;
    const p = this.p;
    const hx = this.host.x;
    const hy = this.host.y;
    const k = this.t / MELT_MS;
    // Swelling in, and pulsing harder toward the end as the pressure builds.
    const swell = easeOut(Math.min(1, this.t / 300));
    const pulse = 0.75 + 0.25 * Math.sin(this.t * (0.012 + k * 0.02));
    this.lamp.setPosition(hx, hy - JUGG_CHEST_Y);
    this.lamp.intensity = (1.2 + 0.8 * pulse) * swell;

    const b = this.back.begin(hx, hy - 20, hy - 1);
    const f = this.front.begin(hx, hy - 20, hy + 1);
    // Heat shimmering on the ground: a dithered glow and a broken ring of the scald's reach.
    for (let dy = -Math.ceil(BURN_RADIUS * GROUND); dy <= BURN_RADIUS * GROUND; dy++)
      for (let dx = -BURN_RADIUS; dx <= BURN_RADIUS; dx++) {
        const d = Math.hypot(dx, dy / GROUND) / BURN_RADIUS;
        if (d > 1) continue;
        const X = Math.round(hx + dx);
        const Y = Math.round(hy + dy);
        if (dither(X, Y) >= 0.35 * swell * (1 - d * d) * pulse) continue;
        b.put(X, Y, d < 0.5 ? p.mid : p.deep, 0.6);
      }
    ring(b, hx, hy, BURN_RADIUS * swell, 0.8, p, 0.55 * pulse, GROUND, 0.45, Math.floor(this.t / 120));
    // The wisps, circling and rising, behind the body on its far side and in front on its near side.
    for (const s of this.wisps) {
      const a = s.a + this.t * 0.0021 + Math.sin(this.t * 0.003 + s.seed) * 0.2;
      const rise = ((this.t * 0.012 + s.seed * 3) % 22) / 22;
      const x = hx + Math.cos(a) * s.r * swell;
      const y = hy - s.h - rise * 14 + Math.sin(a) * s.r * GROUND * swell;
      const g = Math.sin(a) < 0 ? b : f;
      puff(g, x, y, s.size * (1 + rise * 0.6), (1 - rise) * 0.9 * swell, p.deep);
      if (this.tin && rise > 0.4 && rise < 0.7 && hash(Math.floor(s.seed), Math.floor(this.t / 900)) > 0.55) heart(f, Math.round(x), Math.round(y - 4), p, 1 - rise);
    }
    this.back.end();
    this.front.end();

    this.emberT -= dt;
    if (this.emberT <= 0) {
      this.emberT = 70;
      w.debris(p.tints, hx + (Math.random() - 0.5) * 24, hy - 6 - Math.random() * 20, 1, hy + 20, 'spores');
    }
    this.burnT -= dt;
    if (this.burnT <= 0) {
      this.burnT += BURN_EVERY;
      const hit = strikeGround(w, hx, hy, BURN_RADIUS, { damage: BURN_DAMAGE, knock: 25, fromX: hx, fromY: hy });
      for (const h of hit.slice(0, 5)) w.debris([0xffffff, p.hot, p.mid], h.x, h.y - h.bodyY, 3, h.y + 12, 'spores');
      if (hit.length) sound.sizzle(w.pan(hx));
    }
  }

  /** The great vent: everything round it scalded and hurled away in a blast of steam. */
  private blast(): void {
    const w = this.world;
    const p = this.p;
    const x = this.host.x;
    const y = this.host.y;
    this.blown = true;
    this.blastAt = { x, y };
    const hits = strikeGround(w, x, y, BLAST_RADIUS, { damage: BLAST_DAMAGE, heavy: true, knock: BLAST_KNOCK, fromX: x, fromY: y });
    for (const h of hits.slice(0, 6)) w.debris([0xffffff, p.core, p.hot], h.x, h.y - h.bodyY, 6, h.y + 12, 'burst');
    w.debris(STEAM_TONES, x, y - JUGG_CHEST_Y, 46, y + 30, 'burst');
    w.debris(STEAM_TONES, x, y - 10, 26, y + 30, 'spores');
    w.debris(p.tints, x, y - JUGG_CHEST_Y, 24, y + 30, 'burst');
    bloom(w, x, y - JUGG_CHEST_Y, p.hot, 3.6, 600, y + 60);
    flare(w, x, y - 10, 200, p.light, 3.4, 700);
    w.cameras.main.shake(280, 0.0022);
    sound.blast(w.pan(x));
    sound.vent();
    this.lamp.intensity = 0;
  }

  private drawBlast(): void {
    const k = clamp01((this.t - MELT_MS) / BLAST_MS);
    const p = this.p;
    const { x, y } = this.blastAt;
    const g = this.front.begin(x, y - 20, y + 2);
    this.back.begin(x, y - 20, y - 1);
    this.back.end();
    const r = 6 + BLAST_RADIUS * easeOut(k);
    ring(g, x, y, r, 2.4 * (1 - k) + 0.6, p, 1 - k * k, GROUND, 0.15, 3);
    // Steam rolling out with the front, in a ring of puffs.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + hash(i, 9) * 0.3;
      const rr = r * (0.85 + hash(i, 3) * 0.2);
      puff(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr * GROUND - 3 - k * 6, 2.6 + k * 2.4, 1 - k, p.mid);
      if (this.tin && i % 4 === 0) heart(g, Math.round(x + Math.cos(a) * rr * 0.8), Math.round(y + Math.sin(a) * rr * GROUND * 0.8 - 10 - k * 10), p, 1 - k);
    }
    this.front.end();
  }
}

/**
 * The shockwave a punch throws out while it burns: a crescent of heat
 * rolling on from the fist past its reach, scalding each foe it passes once.
 */
export class HeatWave extends Fx {
  private g: Ink;
  private struck = new Set<Hurtbox>();

  constructor(
    world: WorldScene,
    /** Feet under the punch, and the way it was thrown. */
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private p: Pal,
    private damage: number,
    private big: boolean,
  ) {
    super(world, WAVE_MS);
    this.g = this.ink(WAVE_REACH * 2 + 24, WAVE_REACH * 2 + 24);
    bloom(world, x + ux * 14, y - JUGG_CHEST_Y + uy * 8, p.hot, big ? 1.4 : 0.9, 220, y + 30);
  }

  protected step(): void {
    const w = this.world;
    const k = this.t / this.life;
    const reach = WAVE_REACH * (this.big ? 1.2 : 1);
    const r = 8 + (reach - 8) * easeOut(k);
    const th = Math.atan2(this.uy, this.ux);
    // Everything the crescent has rolled over by now (on the ground, as feet go).
    for (const h of w.hurtboxesWhere((h) => {
      if (!h.alive || this.struck.has(h)) return false;
      const dx = h.x - this.x;
      const dy = (h.y - this.y) / GROUND;
      const d = Math.hypot(dx, dy);
      if (d > r + h.radius) return false;
      let off = Math.atan2(dy, dx) - th;
      off = Math.abs(Math.atan2(Math.sin(off), Math.cos(off)));
      return off <= WAVE_SPREAD || d < h.radius + 6;
    })) {
      this.struck.add(h);
      h.hurt({ damage: this.damage, heavy: this.big, knock: this.big ? 160 : 80, fromX: this.x, fromY: this.y });
      w.debris([0xffffff, this.p.hot, this.p.mid], h.x, h.y - h.bodyY, 4, h.y + 12, 'burst');
    }
    // The crescent: a band of heat on the ground, the palette from its leading edge back, thinning as it goes.
    const g = this.g.begin(this.x, this.y, this.y + 1);
    const a = 1 - k * k;
    const w2 = (this.big ? 3.2 : 2.4) * (1 - k * 0.5);
    const steps = Math.ceil(r * WAVE_SPREAD * 2.4);
    for (let i = 0; i <= steps; i++) {
      const t = -WAVE_SPREAD + (2 * WAVE_SPREAD * i) / steps;
      const edge = 1 - Math.abs(t) / WAVE_SPREAD;
      const ang = th + t;
      for (let j = 0; j <= Math.ceil(w2 * 2); j++) {
        const rr = r - j * 0.5;
        const X = Math.round(this.x + Math.cos(ang) * rr);
        const Y = Math.round(this.y + Math.sin(ang) * rr * GROUND);
        if (dither(X, Y) >= a * (0.35 + 0.65 * edge)) continue;
        const u = j / (w2 * 2);
        g.put(X, Y, u < 0.2 ? this.p.core : u < 0.45 ? this.p.hot : u < 0.75 ? this.p.mid : this.p.deep, 0.95);
      }
      // A shimmer of heat rising off the crest, now and then.
      if (i % 5 === 0 && hash(i, Math.floor(this.t / 40)) < 0.5) {
        const X = this.x + Math.cos(ang) * r;
        const Y = this.y + Math.sin(ang) * r * GROUND;
        for (let up = 1; up <= 3; up++) g.put(X, Y - up - k * 4, up === 1 ? this.p.hot : this.p.mid, a * (1 - up * 0.25));
      }
    }
    g.end();
  }
}

/** A puff of rosy hearts where the Tin Man's heaviest blows land. */
export class HeartPop extends Fx {
  private g: Ink;
  private hearts: { x: number; y: number; vx: number; vy: number }[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
    n = 4,
  ) {
    super(world, 650);
    this.g = this.ink(60, 60);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.7 + (Math.random() - 0.5) * 0.3;
      this.hearts.push({ x, y, vx: Math.cos(a) * 34, vy: Math.sin(a) * 34 });
    }
  }

  protected step(dt: number): void {
    const s = dt / 1000;
    const k = this.t / this.life;
    const g = this.g.begin(this.x, this.y - 10, this.y + 40);
    for (const h of this.hearts) {
      h.x += h.vx * s;
      h.y += h.vy * s;
      h.vx *= 0.92;
      h.vy = h.vy * 0.92 - 6 * s;
      if (k < 0.7 || dither(Math.round(h.x), Math.round(h.y)) < (1 - k) / 0.3) heart(g, Math.round(h.x), Math.round(h.y), this.p, 1);
    }
    g.end();
  }
}

/** Meltdown's button: a furnace with its door blown open, fire roaring out and steam billowing either side. */
export const meltdownIcon: IconPainter = (put, p) => {
  // Steam.
  for (const [x, y] of [[1, 5], [2, 4], [1, 7], [2, 6], [14, 5], [13, 4], [14, 7], [13, 6], [3, 3], [12, 3]]) put(x, y, 0xc0cad6);
  // The furnace body: an arch.
  for (let y = 6; y <= 14; y++) for (let x = 4; x <= 11; x++) if (!(y === 6 && (x === 4 || x === 11))) put(x, y, x === 4 || y === 6 ? 0x7a6450 : 0x4a3a2e);
  // The open mouth, roaring.
  for (let y = 8; y <= 13; y++) for (let x = 6; x <= 9; x++) put(x, y, y > 11 ? p.core : y > 9 ? p.hot : p.mid);
  // The door halves blown aside.
  for (let y = 8; y <= 12; y++) {
    put(3, y, 0x9a7a5a);
    put(12, y, 0x6a5444);
  }
  // Flames leaping out of the top.
  for (const [x, y, c] of [[7, 5, p.hot], [8, 4, p.core], [8, 5, p.hot], [6, 4, p.mid], [9, 3, p.mid], [7, 2, p.deep], [10, 5, p.mid], [5, 5, p.deep]] as const) put(x, y, c);
  put(8, 1, p.hot);
};
