import Phaser from 'phaser';
import { BOLT_H } from '../art/chrono';
import { snap } from './display';
import { sound } from '../audio';
import { inFlight, type Hurtbox } from './combat';
import type { Effect } from './Slash';
import type { WorldScene } from '../scenes/WorldScene';
import { onGround } from './Toxins';
import { bloom, circle, clamp01, easeOut, flare, Fx, GROUND, type Ink, line, pal, ring, shade, strikeGround, type Pal } from './ultimate/ink';

// The chronomancer's magic made visible: the timekeeper's second hands,
// which slow what they strike, and his stasis clock set on the ground; the
// paradox's shards, and the echoes of himself that throw them again from a
// moment ago.

/** The timekeeper's brass light. */
export const KEEPER_PAL: Pal = pal(0xfffbe8, 0xffe6a0, 0xffc050, 0xb8701e, 0xffd070);
/** The moonclock's: silver-blue. */
export const MOON_PAL: Pal = pal(0xf4fbff, 0xc4e4ff, 0x7ab8ff, 0x2a5aa8, 0x9ccaff);
/** The paradox's: violet. */
export const RIFT_PAL: Pal = pal(0xf6eeff, 0xd4b0ff, 0x9a5cff, 0x4a2a9a, 0xb890ff);
/** The aeon's: sea-green. */
export const AEON_PAL: Pal = pal(0xeafff6, 0x9affd8, 0x2ee0a0, 0x127a6a, 0x6ff0c0);
/** The clockwork's: radium green. */
export const CLOCKWORK_PAL: Pal = pal(0xf6ffe8, 0xd8ffa0, 0x8ef040, 0x2e8a2a, 0xa8f060);
/** The anomaly's: error cyan. */
export const ANOMALY_PAL: Pal = pal(0xf0ffff, 0xa0faff, 0x20d8f0, 0x1a4aa0, 0x40e0ff);
/** Primavera's: cream and rose, running to spring mint. */
export const PRIMAVERA_PAL: Pal = pal(0xfffaf2, 0xffd0de, 0xf48cae, 0x4cb88c, 0xffb8cc);
/** The petals Primavera's magic sheds: rose, blush, cream and a fleck of mint leaf. */
const PETALS = [0xffa8c4, 0xffd0de, 0xfff4ea, 0x8ed8a8];
/** The blossoms a flower clock wears at its hours, in turn. */
const BLOOMS = [0xffa8c4, 0xfff6ee, 0xffc8a4];
/** The Sandglass's: dune gold over desert indigo. */
export const SANDGLASS_PAL: Pal = pal(0xfff8e0, 0xffe08a, 0xe8b04a, 0x3a48b0, 0xffd070);
/** The grains the Sandglass's magic sheds, palest to darkest gold. */
export const GRAINS = [0xfff4c0, 0xffd870, 0xe0a83a, 0xb87a2a];
/** The Rewind's: hot magenta and electric cyan over midnight purple. */
export const VHS_PAL: Pal = pal(0xfff0ff, 0xff6ae0, 0x30e8ff, 0x3a1a8a, 0xff5ad8);
/** The Rewind's two neon lights, laid down apart like a tape out of true. */
const NEON_PINK = [0xff5ad0, 0xffb4ee];
const NEON_CYAN = [0x30e8ff, 0xb4faff];

/** A stasis clock dressed for a skin: Primavera's flowers, or the Sandglass's sand. */
export type ClockDress = 'flowers' | 'sand';

/** How a bolt (or a shard) flies and what it does. */
export interface BoltKind {
  /** The look's texture key: its bolt is `<key>_bolt_e`. */
  key: string;
  /** A shard of the paradox's, rather than a second hand. */
  rift: boolean;
  pal: Pal;
  damage: number;
  speed: number;
  range: number;
  /** Each strike slows the foe's time to this share of what it was (1: not at all)... */
  slow: number;
  /** ...but never below this, and for this long. */
  slowFloor: number;
  slowMs: number;
  /** Casts a real light (kept off for echoes and the Special's many shards: lights are few). */
  lit: boolean;
  /** Primavera's: it trails drifting petals, and bursts into them. */
  petals?: boolean;
  /** The Sandglass's: it trails falling grains, and bursts into sand. */
  sand?: boolean;
  /** The Rewind's: it trails magenta and cyan a pixel apart, like a worn tape. */
  scan?: boolean;
}

/** Is a body standing at (x, y) close enough to the ground point (gx, gy) for a bolt passing over it to strike it? */
function inPath(h: Hurtbox, gx: number, gy: number): boolean {
  return inFlight(h, gx, gy, BOLT_H);
}

/**
 * A second hand (or a shard) in flight at chest height over its shadow. It
 * strikes the first foe in its path and, for the timekeeper, drags that
 * foe's time a little slower, deeper with each hand that lands.
 */
export class TimeBolt implements Effect {
  dead = false;
  private img: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light | null;
  private travelled = 0;
  private t = 0;
  private trailT = 0;
  private readonly inPathNow = (h: Hurtbox) => inPath(h, this.x, this.y);

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private kind: BoltKind,
    private scale = 1,
  ) {
    this.t = Math.random() * 400;
    this.img = world.add.image(x, y - BOLT_H, `${kind.key}_bolt_e`, 'b0').setBlendMode(Phaser.BlendModes.ADD).setScale(scale);
    this.halo = world.add.image(x, y - BOLT_H, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(kind.pal.mid).setAlpha(0.45).setScale(0.5 * scale);
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(0.3, 0.3).setAlpha(0.22);
    this.light = kind.lit ? world.lights.addLight(x, y - BOLT_H, 55, kind.pal.light, 1.2) : null;
    this.place();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    // Step a few pixels at a time so it never skips over a small body.
    let move = (this.kind.speed * dt) / 1000;
    const area = this.world.area;
    while (move > 0) {
      const d = Math.min(3, move);
      move -= d;
      this.x += this.ux * d;
      this.y += this.uy * d;
      this.travelled += d;
      if (!area.contains(this.x, this.y) || this.travelled >= this.kind.range) {
        this.pop(0.4);
        return;
      }
      const hit = this.world.firstHurtbox(this.inPathNow);
      if (hit) {
        this.strike(hit);
        return;
      }
    }
    this.place();
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 45;
      this.world.debris(this.kind.pal.tints, snap(this.x - this.ux * 4), snap(this.y - BOLT_H - this.uy * 4), 1, this.y - 0.2, 'trail');
      if (this.kind.petals && Math.random() < 0.4) this.world.debris(PETALS, snap(this.x - this.ux * 5), snap(this.y - BOLT_H - this.uy * 5), 1, this.y - 0.2, 'spores');
      if (this.kind.sand && Math.random() < 0.5) this.world.debris(GRAINS, snap(this.x - this.ux * 5), snap(this.y - BOLT_H - this.uy * 5) + 1, 1, this.y - 0.2, 'spores');
      if (this.kind.scan) {
        // The two colours a pixel either side of its path, as if the picture had slipped.
        const tx = snap(this.x - this.ux * 6);
        const ty = snap(this.y - BOLT_H - this.uy * 6);
        this.world.debris(NEON_PINK, tx - 1, ty, 1, this.y - 0.2, 'trail');
        this.world.debris(NEON_CYAN, tx + 1, ty, 1, this.y - 0.2, 'trail');
      }
    }
  }

  private strike(h: Hurtbox): void {
    const k = this.kind;
    h.hurt({ damage: k.damage, heavy: false, knock: k.rift ? 70 : 35, fromX: h.x - this.ux * 8, fromY: h.y - h.bodyY - this.uy * 8 });
    if (k.slow < 1 && h.slow) h.slow(Math.max(k.slowFloor, (h.tempo ?? 1) * k.slow), k.slowMs, k.pal.hot);
    const bits = k.petals ? PETALS : k.sand ? GRAINS : k.pal.tints;
    this.world.debris(bits, snap(h.x - this.ux * (h.radius - 1)), snap(h.y - h.bodyY), k.sand ? 9 : 6, h.y + 20, k.petals || k.sand ? 'spores' : 'burst');
    sound.chronoHit(this.world.pan(h.x), k.rift);
    this.pop(1);
  }

  private place(): void {
    const x = snap(this.x);
    const y = snap(this.y - BOLT_H);
    const depth = this.y + 1;
    this.img.setPosition(x, y).setDepth(depth).setFrame(`b${Math.floor(this.t / (this.kind.rift ? 50 : 70)) % 4}`);
    this.halo.setPosition(x, y).setDepth(depth - 0.1);
    this.shadow.setPosition(snap(this.x), snap(this.y));
    this.light?.setPosition(this.x, this.y - BOLT_H);
  }

  /** It ends in a soft flash of its colour. */
  private pop(size: number): void {
    bloom(this.world, this.x, this.y - BOLT_H, this.kind.pal.hot, (0.4 + size * 0.4) * this.scale, 240, this.y + 20, 0.7);
    this.world.debris(this.kind.pal.tints, snap(this.x), snap(this.y - BOLT_H), Math.round(2 + size * 4), this.y + 20);
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
    this.halo.destroy();
    this.shadow.destroy();
    if (this.light) this.world.lights.removeLight(this.light);
  }
}

/**
 * An echo of the chronomancer from another moment: his figure in light, in
 * the pose he had then, fading out (or in, then out) over its life.
 */
export class Ghost implements Effect {
  dead = false;
  readonly sprite: Phaser.GameObjects.Sprite;
  private age = 0;

  constructor(
    world: WorldScene,
    x: number,
    y: number,
    key: string,
    frame: string,
    originX: number,
    originY: number,
    tint: number,
    private life = 480,
    private peak = 0.7,
    /** The share of its life it takes to fade in. */
    private rise = 0,
  ) {
    this.sprite = world.add.sprite(snap(x), snap(y), key, frame).setOrigin(originX, originY).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDepth(y - 0.2);
    this.update(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    const t = this.age / this.life;
    if (t >= 1) {
      this.destroy();
      return;
    }
    const a = this.rise > 0 && t < this.rise ? t / this.rise : 1 - (t - this.rise) / (1 - this.rise);
    this.sprite.setAlpha(this.peak * clamp01(a));
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
  }
}

/** How long the stasis clock holds before its hour strikes. */
export const STASIS_TIME = 3600;
/** Its reach on the ground. */
export const STASIS_R = 36;

/**
 * The stasis clock: a clock face of light set on the ground. Its minute hand
 * ticks round once while everything standing on it all but stops; when the
 * hand comes back to twelve the hour strikes, hurting everything still on it.
 */
export class StasisClock extends Fx {
  private face: Ink;
  private holdT = 0;
  private struck = false;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
    private damage: number,
    /** Primavera's flower clock (blossoms opening at the hours) or the Sandglass's (a river of sand round the rim). */
    private dress?: ClockDress,
  ) {
    super(world, STASIS_TIME + 420);
    this.face = this.ink(STASIS_R * 2 + 14, Math.ceil(STASIS_R * 2 * GROUND) + 14);
    sound.stasis(world.pan(x));
    bloom(world, x, y - 2, p.hot, 1.4, 420, y + 30, 0.6);
    flare(world, x, y - 4, 70, p.light, 1.6, 600);
  }

  protected step(dt: number): void {
    const { x, y, p, t } = this;
    const g = this.face.begin(x, y, 2.5);
    if (t < STASIS_TIME) {
      const open = easeOut(t / 260);
      const fade = Math.min(1, (STASIS_TIME - t) / 120 + 0.6);
      const r = STASIS_R * open;
      clockFace(g, x, y, r, p, open * fade, Math.floor((t / STASIS_TIME) * 12) / 12, t / STASIS_TIME / 12, GROUND, this.dress);
      // Everything on it is held all but still, and the hold keeps being renewed.
      this.holdT -= dt;
      if (this.holdT <= 0) {
        this.holdT = 150;
        for (const h of this.world.hurtboxesWhere((h) => h.alive && onGround(h, x, y, STASIS_R))) h.slow?.(0.12, 400, p.hot);
      }
    } else {
      if (!this.struck) this.strike();
      // The strike: a bright ring rolling out off the face.
      const k = (t - STASIS_TIME) / 420;
      ring(g, x, y, STASIS_R * (0.9 + 0.35 * easeOut(k)), 2.4 * (1 - k) + 0.5, p, 1 - k);
      circle(g, x, y, STASIS_R * 0.6 * (1 - k), p.core, 1 - k);
    }
    g.end();
  }

  /** The hour strikes. */
  private strike(): void {
    this.struck = true;
    const { x, y, p } = this;
    const hit = strikeGround(this.world, x, y, STASIS_R, { damage: this.damage, heavy: true, knock: 120, fromX: x, fromY: y - 4 });
    for (const h of hit) this.world.debris(p.tints, snap(h.x), snap(h.y - h.bodyY), 6, h.y + 20);
    sound.hourStrike(this.world.pan(x));
    flare(this.world, x, y - 6, 110, p.light, 2.6, 500);
    bloom(this.world, x, y - 4, p.hot, 2.2, 380, y + 30, 0.8);
    const bits = this.dress === 'flowers' ? PETALS : this.dress === 'sand' ? GRAINS : p.tints;
    this.world.debris(bits, snap(x), snap(y) - 4, this.dress ? 24 : 16, y + 20, 'spores');
  }
}

/**
 * A clock face on the ground: a band round the rim, twelve hours (the four
 * quarters brighter), and two hands from the middle. `minute` and `hour` are
 * fractions of a turn from twelve.
 */
export function clockFace(g: Ink, x: number, y: number, r: number, p: Pal, a: number, minute: number, hour: number, sq = GROUND, dress?: ClockDress): void {
  if (r < 3 || a <= 0) return;
  ring(g, x, y, r, 1.4, p, a, sq);
  circle(g, x, y, r * 0.78, p.mid, a * 0.8, sq);
  circle(g, x, y, r * 0.2, p.deep, a * 0.8, sq);
  for (let h = 0; h < 12; h++) {
    const th = -Math.PI / 2 + (h / 12) * Math.PI * 2;
    const c = Math.cos(th);
    const s = Math.sin(th) * sq;
    const quarter = h % 3 === 0;
    line(g, x + c * r * (quarter ? 0.6 : 0.66), y + s * r * (quarter ? 0.6 : 0.66), x + c * r * 0.76, y + s * r * 0.76, quarter ? p.core : p.hot, a);
    if (quarter) g.put(x + c * r * 0.6 + (c > 0.5 ? -1 : c < -0.5 ? 1 : 0), y + s * r * 0.6, p.hot, a);
  }
  const hand = (turn: number, len: number, c0: number, c1: number) => {
    const th = -Math.PI / 2 + turn * Math.PI * 2;
    const ex = x + Math.cos(th) * r * len;
    const ey = y + Math.sin(th) * r * len * sq;
    line(g, x, y, ex, ey, c0, a);
    line(g, x + 1, y, ex + 1, ey, c1, a * 0.5);
  };
  if (dress === 'flowers') flowerHours(g, x, y, r, a, minute, sq);
  else if (dress === 'sand') sandHours(g, x, y, r, a, minute, sq);
  hand(hour, 0.4, p.hot, p.mid);
  hand(minute, 0.7, p.core, p.hot);
  g.put(x, y, p.core, a);
  // A faint wash of light over the face, thinning to the rim in a checker.
  for (let dy = -Math.ceil(r * sq); dy <= Math.ceil(r * sq); dy += 2) {
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx += 2) {
      const d = Math.hypot(dx, dy / sq) / r;
      if (d > 0.74 || ((dx + dy) & 2) === 0) continue;
      g.put(x + dx, y + dy, shade(p, 0.9), a * 0.35 * (1 - d));
    }
  }
}

/**
 * A flower clock's hours, like a horologium florae: a blossom at each hour on
 * the face, closed in bud until the minute hand has reached it, then open,
 * rose, cream and peach in turn, each with a leaf beside it.
 */
function flowerHours(g: Ink, x: number, y: number, r: number, a: number, minute: number, sq: number): void {
  for (let h = 0; h < 12; h++) {
    const th = -Math.PI / 2 + (h / 12) * Math.PI * 2;
    const fx = Math.round(x + Math.cos(th) * r * 0.9);
    const fy = Math.round(y + Math.sin(th) * r * 0.9 * sq);
    const col = BLOOMS[h % 3];
    const open = h / 12 <= minute + 0.001;
    g.put(fx + (Math.cos(th) > 0 ? 1 : -1), fy + 1, PETALS[3], a * 0.8);
    if (!open) {
      g.put(fx, fy, col, a * 0.8);
      continue;
    }
    // On a great clock (the Special's) the blossoms open twice as wide.
    const k = r > 60 ? 2 : 1;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) for (let i = 1; i <= k; i++) g.put(fx + dx * i, fy + dy * i, col, a);
    if (k > 1) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) g.put(fx + dx, fy + dy, col, a * 0.7);
    g.put(fx, fy, 0xfff4a8, a);
  }
}

/**
 * A sand clock's hours: a river of grains pouring round the rim behind the
 * minute hand, thickest where the hand is and thinning out behind it, and a
 * little dune heaped at each quarter.
 */
function sandHours(g: Ink, x: number, y: number, r: number, a: number, minute: number, sq: number): void {
  const n = Math.max(24, Math.round(r * 1.4));
  for (let i = 0; i < n; i++) {
    const th = -Math.PI / 2 + (minute - (i / n) * 0.35) * Math.PI * 2;
    // Each grain a little in or out of the river's line, the same every frame.
    const rr = r * (0.84 + ((i * 37) % 7) / 60);
    g.put(x + Math.cos(th) * rr, y + Math.sin(th) * rr * sq, GRAINS[i % 4], a * (1 - (i / n) * 0.85));
  }
  for (let h = 0; h < 12; h += 3) {
    const th = -Math.PI / 2 + (h / 12) * Math.PI * 2;
    const fx = Math.round(x + Math.cos(th) * r * 0.9);
    const fy = Math.round(y + Math.sin(th) * r * 0.9 * sq);
    for (const [dx, dy, c] of [[-1, 0, 2], [0, 0, 1], [1, 0, 2], [0, -1, 0]] as const) g.put(fx + dx, fy + dy, GRAINS[c], a);
  }
}
