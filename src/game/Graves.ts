import Phaser from 'phaser';
import type { Effect, Scheme } from './Slash';
import type { Hurtbox } from './combat';
import { Ink, dither, easeIn, easeOut, clamp01, flare, hash, GROUND } from './ultimate/ink';
import { bindFoe } from './Strings';
import { onGround } from './Toxins';
import { sound } from '../audio';
import type { WorldScene } from '../scenes/WorldScene';

// The Gravedigger's earthwork: clods of earth flung by his spade, the cracks
// and dust of his slam, and the open grave, a split in the ground out of which
// skeletal arms (roots, for Mossgrave) burst to seize and hold every foe on it.

/** Earth, light to dark, and what grows in it (Mossgrave's). */
export interface Soil {
  earth: [number, number, number];
  /** Dust that rises off it. */
  dust: number;
  /** What claws up out of the grave: bone, or root. */
  limb: [number, number, number];
  /** A little moss on what comes up, if any. */
  moss?: number;
}

export const GRAVE_SOIL: Soil = { earth: [0x7a5a3a, 0x5a3e26, 0x2e1e12], dust: 0x8a7458, limb: [0xf4eed4, 0xc8bf9c, 0x7a7260] };
export const MOSS_SOIL: Soil = { earth: [0x5a6a30, 0x3a4c1e, 0x1a2410], dust: 0x6a7448, limb: [0x8a6a42, 0x5e4426, 0x34240e], moss: 0x6a9a34 };

// Clods.
const GRAVITY = 260;

interface Clod {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  c: number;
  big: boolean;
  rest: number;
}

/**
 * Clods of earth thrown up from (x, y): they arc through the air over their
 * shadows, land, roll a little and lie a moment before fading out. `dir`
 * throws them mostly one way (a radian), else all round.
 */
export class Clods implements Effect {
  dead = false;
  private ink: Ink;
  private bits: Clod[] = [];
  private t = 0;
  private readonly ox: number;
  private readonly oy: number;

  constructor(
    world: WorldScene,
    x: number,
    y: number,
    n: number,
    soil: Soil,
    o: { dir?: number; spread?: number; speed?: number; up?: number } = {},
  ) {
    this.ox = x;
    this.oy = y;
    this.ink = new Ink(world, 140, 110);
    const speed = o.speed ?? 40;
    for (let i = 0; i < n; i++) {
      const a = o.dir !== undefined ? o.dir + (Math.random() - 0.5) * (o.spread ?? 1) : Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.bits.push({
        x,
        y,
        z: 2,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * GROUND,
        vz: (o.up ?? 70) * (0.6 + Math.random() * 0.6),
        c: soil.earth[Math.floor(Math.random() * 3)],
        big: Math.random() < 0.4,
        rest: 0,
      });
    }
    this.draw();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const s = dt / 1000;
    for (const b of this.bits) {
      if (b.z > 0 || b.vz > 0) {
        b.x += b.vx * s;
        b.y += b.vy * s;
        b.vz -= GRAVITY * s;
        b.z += b.vz * s;
        if (b.z <= 0) {
          // A small bounce, then it rolls to a stop.
          b.z = 0;
          b.vz = b.vz < -50 ? -b.vz * 0.25 : 0;
          b.vx *= 0.4;
          b.vy *= 0.4;
        }
      } else b.rest += dt;
    }
    if (this.t > 1500) this.destroy();
    else this.draw();
  }

  private draw(): void {
    const k = this.ink.begin(this.ox, this.oy, this.oy + 6);
    const fade = 1 - clamp01((this.t - 900) / 600);
    for (const b of this.bits) {
      const x = Math.round(b.x);
      const y = Math.round(b.y);
      if (fade < 1 && dither(x, y) > fade) continue;
      if (b.z > 1) k.put(x, y, 0x0a0806, 0.35);
      const top = y - Math.round(b.z);
      k.put(x, top, b.c, 1);
      if (b.big) {
        k.put(x + 1, top, b.c, 1);
        k.put(x, top - 1, b.c, 1);
      }
    }
    k.end();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.ink.destroy();
  }
}

/** Cracks: their count, how far they run, how long the dark lasts and the seams glow. */
const CRACKS = 7;
const CRACK_LIFE = 1700;
const SEAM_GLOW = 520;
const DUST_LIFE = 520;

/**
 * Where the spade comes down: the ground cracks in jagged lines running out
 * from the blow, the seams lit a moment from below by the lantern's colour,
 * and a ring of dust rolls out and settles.
 */
export class GroundCrack implements Effect {
  dead = false;
  private ground: Ink;
  private dust: Ink;
  private t = 0;
  private lines: { x: number; y: number }[][] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private R: number,
    private fx: Scheme,
    private soil: Soil,
  ) {
    const S = Math.ceil(R * 2 + 12);
    this.ground = new Ink(world, S, Math.ceil(S * GROUND) + 8);
    this.dust = new Ink(world, S + 16, Math.ceil(S * GROUND) + 24);
    const seed = Math.floor(Math.random() * 1000);
    for (let i = 0; i < CRACKS; i++) {
      const a = (i / CRACKS) * Math.PI * 2 + hash(seed, i) * 0.7;
      const len = R * (0.55 + hash(seed, i, 1) * 0.45);
      const pts = [{ x, y }];
      let px = x;
      let py = y;
      const steps = 5;
      for (let s = 1; s <= steps; s++) {
        const r = (len * s) / steps;
        const j = (hash(seed, i, s + 3) - 0.5) * 0.7;
        px = x + Math.cos(a + j) * r;
        py = y + Math.sin(a + j) * r * GROUND;
        pts.push({ x: px, y: py });
      }
      this.lines.push(pts);
    }
    flare(world, x, y - 4, R * 2.2, fx.light ?? fx.hot, 1.8, SEAM_GLOW);
    this.draw();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    if (this.t >= CRACK_LIFE) this.destroy();
    else this.draw();
  }

  private draw(): void {
    const { t, x, y, R, fx, soil } = this;
    const g = this.ground.begin(x, y, 3);
    const grow = easeOut(t / 110);
    const fade = 1 - clamp01((t - CRACK_LIFE * 0.55) / (CRACK_LIFE * 0.45));
    const seam = 1 - clamp01(t / SEAM_GLOW);
    for (const pts of this.lines) {
      const n = pts.length - 1;
      for (let s = 0; s < n; s++) {
        if (s / n > grow) break;
        const a = pts[s];
        const b = pts[s + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
        for (let k = 0; k <= steps; k++) {
          const px = Math.round(a.x + ((b.x - a.x) * k) / steps);
          const py = Math.round(a.y + ((b.y - a.y) * k) / steps);
          if (dither(px, py) > fade) continue;
          // The seam's heart glows while it's fresh, its lips are dark earth.
          const hot = seam > 0.05 && s < n - 1;
          g.put(px, py, hot ? (seam > 0.5 ? fx.hot : fx.mid) : soil.earth[2], 1);
          if (s < 2) g.put(px, py + 1, soil.earth[2], 0.8 * fade);
        }
      }
    }
    // A dark dent where the blade struck.
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        if ((dx * dx) / 16 + (dy * dy) / 4 > 1) continue;
        if (dither(x + dx, y + dy) > fade * 0.9) continue;
        g.put(x + dx, y + dy, Math.abs(dy) === 2 ? soil.earth[1] : soil.earth[2], 0.9);
      }
    g.end();

    // The dust ring rolling out, thinning as it goes.
    const d = this.dust.begin(x, y - 4, y + 8);
    const k = clamp01(t / DUST_LIFE);
    if (k < 1) {
      const r = R * (0.3 + 0.9 * easeOut(k));
      const a = 1 - easeIn(k);
      for (let i = 0; i < 40; i++) {
        const ang = (i / 40) * Math.PI * 2;
        const px = x + Math.cos(ang) * r;
        const py = y + Math.sin(ang) * r * GROUND - 1 - k * 4;
        for (const [ox, oy] of [[0, 0], [1, 0], [0, -1]] as const) {
          const X = Math.round(px + ox);
          const Y = Math.round(py + oy);
          if (dither(X, Y) > a * 0.8) continue;
          d.put(X, Y, soil.dust, 0.8);
        }
      }
    }
    d.end();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.ground.destroy();
    this.dust.destroy();
  }
}

// The open grave.
/** How long it holds what it catches, and the squeeze while it does. */
export interface GraveHold {
  radius: number;
  hold: number;
  burst: number;
  tick: number;
  tickDamage: number;
  /** How hard a boss (too strong to hold) is slowed instead. */
  bossSlow: number;
}

/** It cracks open over this long, then bursts. */
const SPLIT = 160;
/** The arms sink back over this long once the hold ends; the pit closes after. */
const LET_GO = 320;
const CLOSE = 700;
/** Arms clutching each foe held, and the most foes that get their own. */
const ARMS_EACH = 3;
const MAX_HELD_DRAWN = 8;

interface Held {
  h: Hurtbox;
  /** Its arms: where each rises from (offset from its feet), its lean, its seed. */
  arms: { dx: number; dy: number; lean: number; seed: number }[];
  back: Ink;
  front: Ink;
}

/**
 * The grave he heaves open: the ground splits in a jagged pit, lit from
 * below, and skeletal arms burst out of it, a few clawing at the air and
 * three seizing each foe standing on it by the legs. They hold it fast
 * (bosses only slowed), crushing it again and again, then let go and sink
 * back as the earth closes over.
 */
export class OpenGrave implements Effect {
  dead = false;
  private t = 0;
  private ground: Ink;
  private air: Ink;
  private held: Held[] = [];
  private caught = new Set<Hurtbox>();
  private burst = false;
  private tickT: number;
  private lamp: Phaser.GameObjects.Light;
  private readonly seed = Math.floor(Math.random() * 1000);
  private readonly life: number;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private g: GraveHold,
    private fx: Scheme,
    private soil: Soil,
  ) {
    const S = Math.ceil(g.radius * 2 + 14);
    this.ground = new Ink(world, S, Math.ceil(S * GROUND) + 10);
    this.air = new Ink(world, S, 40);
    this.tickT = g.tick;
    this.life = SPLIT + g.hold + LET_GO + CLOSE;
    this.lamp = world.lights.addLight(x, y - 6, g.radius * 2.6, fx.light ?? fx.hot, 0);
    this.draw();
  }

  /** Time left, for the HUD. */
  timeLeft(): { left: number; total: number } | null {
    return this.dead ? null : { left: this.life - this.t, total: this.life };
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    if (!this.burst && this.t >= SPLIT) this.open();
    const holding = this.burst && this.t < SPLIT + this.g.hold;
    if (holding) {
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT += this.g.tick;
        this.squeeze();
      }
    }
    if (this.t >= this.life) {
      this.destroy();
      return;
    }
    this.draw();
  }

  /** It bursts open: everything on it is struck and seized. */
  private open(): void {
    this.burst = true;
    const { world, x, y, g, fx, soil } = this;
    world.cameras.main.shake(140, 0.0012);
    sound.graveOpen(world.pan(x));
    world.addEffect(new Clods(world, x, y, 22, soil, { speed: 46, up: 95 }));
    world.debris([fx.core, fx.hot, fx.mid], x, y - 6, 14, y + 10, 'spores');
    for (const h of world.hurtboxesWhere((b) => b.alive && onGround(b, x, y, g.radius))) {
      this.caught.add(h);
      h.hurt({ damage: g.burst, heavy: true, knock: 0, fromX: x, fromY: y });
      if (!bindFoe(h, g.hold, 0)) h.slow?.(g.bossSlow, g.hold, fx.mid);
      if (this.held.length < MAX_HELD_DRAWN) {
        const arms = Array.from({ length: ARMS_EACH }, (_, i) => {
          const a = (i / ARMS_EACH) * Math.PI * 2 + hash(this.seed, this.held.length, i) * 1.4;
          return { dx: Math.cos(a) * (h.radius + 1), dy: Math.sin(a) * (h.radius * 0.5 + 1), lean: -Math.cos(a) * 0.8, seed: Math.floor(hash(i, this.seed) * 100) };
        });
        this.held.push({ h, arms, back: new Ink(world, 30, 30), front: new Ink(world, 30, 30) });
      }
    }
  }

  /** The arms crush what they hold. */
  private squeeze(): void {
    const { fx } = this;
    for (const h of this.caught) {
      if (!h.alive) continue;
      h.hurt({ damage: this.g.tickDamage, heavy: false, knock: 0, fromX: h.x, fromY: h.y });
      this.world.debris([this.soil.limb[0], this.soil.limb[1], fx.mid], h.x, h.y - 3, 3, h.y + 4, 'burst');
    }
    if (this.caught.size) sound.boneHit(this.world.pan(this.x));
  }

  private draw(): void {
    const { t, x, y, g, fx, soil } = this;
    const R = g.radius;
    const let0 = SPLIT + g.hold;
    // 0..1 open, held, then closing.
    const open = t < SPLIT ? easeOut(t / SPLIT) * 0.5 : t < let0 + LET_GO ? 0.5 + 0.5 * easeOut((t - SPLIT) / 120) : 1 - easeIn((t - let0 - LET_GO) / CLOSE);
    this.lamp.intensity = 1.6 * clamp01(open) * (t < let0 ? 1 + 0.25 * Math.sin(t * 0.02) : 1);
    const gr = this.ground.begin(x, y, 3);
    // The pit: a jagged lens of dark, its lips of turned earth, light welling from deep in it.
    const rx = R * open;
    if (rx > 1) {
      const ry = rx * GROUND;
      for (let dy = -Math.ceil(ry) - 2; dy <= Math.ceil(ry) + 2; dy++)
        for (let dx = -Math.ceil(rx) - 2; dx <= Math.ceil(rx) + 2; dx++) {
          const ang = Math.atan2(dy / GROUND, dx);
          const jag = 1 + (hash(this.seed, Math.floor((ang + Math.PI) * 5)) - 0.5) * 0.28;
          const d = Math.hypot(dx / rx, dy / ry) / jag;
          if (d > 1.12) continue;
          const X = x + dx;
          const Y = y + dy;
          let c: number;
          if (d > 0.92) c = d > 1.02 ? soil.earth[0] : soil.earth[1];
          else if (d < 0.35 && this.burst) c = d < 0.18 ? fx.hot : fx.mid;
          else c = d < 0.55 && this.burst && dither(X, Y) < 0.35 ? fx.deep : 0x0c0806;
          gr.put(X, Y, c, 1);
        }
      // Cracks running out from its rim.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + hash(this.seed, i) * 0.6;
        const len = R * 0.45 * open;
        for (let s = 0; s <= len; s++) {
          const r = rx + s;
          const X = Math.round(x + Math.cos(a + Math.sin(s * 0.8) * 0.08) * r);
          const Y = Math.round(y + Math.sin(a) * r * GROUND);
          gr.put(X, Y, soil.earth[2], 0.9);
        }
      }
    }
    gr.end();

    // Arms clawing at the air out of the pit itself, while it holds.
    const a = this.air.begin(x, y - 12, y - 0.5);
    if (this.burst) {
      const up = this.rise();
      for (let i = 0; i < 3; i++) {
        const ax = x + (i - 1) * R * 0.45;
        const ay = y + (i === 1 ? -2 : 1);
        this.limb(a, ax, ay, (i - 1) * 0.5, up * (8 + (i === 1 ? 3 : 0)), Math.sin(t * 0.012 + i * 2) * 0.5, i * 31);
      }
    }
    a.end();

    // The arms holding each foe, some behind its legs and some in front.
    for (const hd of this.held) {
      const h = hd.h;
      const b = hd.back.begin(h.x, h.y - 10, h.y - 0.5);
      const f = hd.front.begin(h.x, h.y - 10, h.y + 0.5);
      if (h.alive || t < let0) {
        const up = this.rise();
        for (const arm of hd.arms) {
          const ink = arm.dy < 0 ? b : f;
          const grip = Math.sin(t * 0.03 + arm.seed) * 0.3;
          this.limb(ink, h.x + arm.dx, h.y + arm.dy, arm.lean, up * 9, grip, arm.seed);
        }
      }
      b.end();
      f.end();
    }
  }

  /** How far the arms are up out of the ground: burst up, held, then sinking back. */
  private rise(): number {
    const t = this.t - SPLIT;
    const let0 = this.g.hold;
    if (t < 0) return 0;
    if (t < 110) return easeOut(t / 110) * 1.15;
    if (t < 200) return 1.15 - 0.15 * ((t - 110) / 90);
    if (t < let0) return 1;
    return 1 - easeIn((t - let0) / LET_GO);
  }

  /**
   * One arm (or root) out of the ground at (x0, y0), `h` px tall, leaning
   * over by `lean`: forearm, wrist, three crooked fingers clutching (`grip`
   * opens and closes them).
   */
  private limb(ink: Ink, x0: number, y0: number, lean: number, h: number, grip: number, seed: number): void {
    if (h < 1) return;
    const [hi, mid, lo] = this.soil.limb;
    const n = Math.round(h);
    let x = x0;
    for (let i = 0; i < n; i++) {
      const k = i / Math.max(1, n);
      x = x0 + lean * k * k * 4 + (this.soil.moss ? Math.sin(i * 1.3 + seed) * 0.6 : 0);
      const y = y0 - i;
      // Two bones side by side up the forearm, lit on the left.
      ink.put(x, y, i % 3 === 0 && this.soil.moss ? this.soil.moss : hi, 1);
      ink.put(x + 1, y, mid, 1);
      if (i === 0) ink.put(x - 1, y, lo, 1);
    }
    // The hand: a knuckle row and three fingers hooked over.
    const hx = Math.round(x);
    const hy = Math.round(y0 - n);
    ink.put(hx - 1, hy, mid, 1);
    ink.put(hx, hy, hi, 1);
    ink.put(hx + 1, hy, hi, 1);
    ink.put(hx + 2, hy, mid, 1);
    const curl = grip > 0 ? 1 : 0;
    for (const [fx, sx] of [[-1, -1], [0, 0], [2, 1]] as const) {
      ink.put(hx + fx, hy - 1, hi, 1);
      ink.put(hx + fx + sx * curl, hy - 2, mid, 1);
    }
    ink.put(hx + 3, hy + 1, lo, 1);
    if (this.soil.moss && seed % 2 === 0) ink.put(hx, hy - 1, this.soil.moss, 1);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.ground.destroy();
    this.air.destroy();
    for (const hd of this.held) {
      hd.back.destroy();
      hd.front.destroy();
    }
    this.world.lights.removeLight(this.lamp);
  }
}
