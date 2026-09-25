import Phaser from 'phaser';
import { PixelLayer } from './Beam';
import type { Effect } from './Slash';
import type { Hurtbox } from './combat';
import { ARROW_DIRS, ARROW_H, stuckFrameFor } from '../art/archer';
import { snap } from './display';
import { sound } from '../audio';
import type { WorldScene } from '../scenes/WorldScene';

// The archer's arrows: a shaft flying at chest height with its shadow sliding
// along the ground under it, sticking into the ground where it falls short;
// and the rain of arrows the volley brings down on a marked ring. The storm
// archer's arrows crackle as they fly, burst in sparks and arcs where they
// strike, and the rain comes down with lightning.

/** The colours of one archer's shots, and the textures that go with them. */
export interface ArrowStyle {
  core: number;
  hot: number;
  mid: number;
  deep: number;
  /** The light its shots cast. */
  light: number;
  /** Texture key suffix: '' for the ranger, '_storm' for the storm archer. */
  suffix: string;
  /** Lightning: crackling trails, arcs on impact, bolts in the rain. */
  storm: boolean;
}

export const RANGER_ARROW: ArrowStyle = {
  core: 0xffffff,
  hot: 0xfff2d0,
  mid: 0xf0c070,
  deep: 0xb07a3a,
  light: 0xffd9a0,
  suffix: '',
  storm: false,
};

export const STORM_ARROW: ArrowStyle = {
  core: 0xffffff,
  hot: 0xbff0ff,
  mid: 0x4ab4ff,
  deep: 0x2a5ad8,
  light: 0x7cc8ff,
  suffix: '_storm',
  storm: true,
};

/** Rings on the ground seen at an angle: squash them vertically. */
const SQUASH = 0.58;
/** Ground marks: under every standing thing, over the ground's shadows. */
const GROUND_DEPTH = 3;
const ARROW_SPEED = 330; // world px / second

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** The arrow frame for a heading. */
export function headingFrame(ux: number, uy: number): string {
  const i = Math.round((Math.atan2(uy, ux) / (Math.PI * 2)) * ARROW_DIRS);
  return `r${((i % ARROW_DIRS) + ARROW_DIRS) % ARROW_DIRS}`;
}

/** Is a body standing at (x, y) close enough to the ground point (gx, gy) for an arrow passing over it to strike it? */
function inPath(h: Hurtbox, gx: number, gy: number): boolean {
  return Math.abs(h.x - gx) <= h.radius + 1.5 && Math.abs(h.y - gy) <= h.radius * 0.6 + 3;
}

/**
 * An arrow loosed from the ground point (x, y) along (ux, uy): it flies
 * ARROW_H px up, at `range` it drops and sticks in the ground. The first body
 * in its path takes `hit`.
 */
export class Arrow implements Effect {
  dead = false;
  private sprite: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light | null = null;
  private travelled = 0;
  private trailT = 0;
  /** Stuck in the ground: ms left before it fades. */
  private stuck = -1;
  private readonly key: string;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private range: number,
    private bounds: Phaser.Geom.Rectangle,
    private onHit: (h: Hurtbox, x: number, y: number) => void,
    private style: ArrowStyle = RANGER_ARROW,
  ) {
    this.key = `arrow${style.suffix}`;
    const frame = headingFrame(ux, uy);
    this.sprite = world.add.sprite(x, y - ARROW_H, this.key, frame).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y - ARROW_H, `${this.key}_e`, frame).setBlendMode(Phaser.BlendModes.ADD);
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(0.45, 0.35).setAlpha(0.35);
    if (style.storm) this.light = world.lights.addLight(x, y - ARROW_H, 46, style.light, 1.3);
    this.place();
  }

  update(dt: number): void {
    if (this.dead) return;
    if (this.stuck >= 0) {
      this.stuck -= dt;
      const a = Math.min(1, this.stuck / 300);
      this.sprite.setAlpha(a);
      this.glowLayer.setAlpha(a);
      this.shadow.setAlpha(0.3 * a);
      if (this.stuck <= 0) this.destroy();
      return;
    }
    // Step a few pixels at a time so it never skips over a small body.
    let move = (ARROW_SPEED * dt) / 1000;
    while (move > 0) {
      const d = Math.min(3, move);
      move -= d;
      this.x += this.ux * d;
      this.y += this.uy * d;
      this.travelled += d;
      if (!this.bounds.contains(this.x, this.y)) {
        this.destroy();
        return;
      }
      const hits = this.world.hurtboxesWhere((h) => h.alive && inPath(h, this.x, this.y));
      if (hits.length) {
        this.strike(hits[0]);
        return;
      }
      if (this.travelled >= this.range) {
        this.stick();
        return;
      }
    }
    this.place();
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = this.style.storm ? 22 : 40;
      const s = this.style;
      this.world.debris(s.storm ? [s.core, s.hot, s.mid] : [s.hot, s.mid], snap(this.x - this.ux * 5), snap(this.y - ARROW_H - this.uy * 5), 1, this.y - 0.2, 'trail');
    }
  }

  private place(): void {
    const x = snap(this.x);
    const y = snap(this.y - ARROW_H);
    const depth = this.y + 1;
    this.sprite.setPosition(x, y).setDepth(depth);
    this.glowLayer.setPosition(x, y).setDepth(depth + 0.1);
    this.shadow.setPosition(snap(this.x), snap(this.y));
    this.light?.setPosition(this.x, this.y - ARROW_H);
  }

  /** It strikes a body: sparks off it (arcs from the storm arrow) and the blow. */
  private strike(h: Hurtbox): void {
    const bx = h.x - this.ux * (h.radius - 1);
    const by = h.y - h.bodyY;
    const s = this.style;
    this.world.debris([s.core, s.hot, s.mid], snap(bx), snap(by), s.storm ? 12 : 7, h.y + 20);
    if (s.storm) this.world.addEffect(new Zap(this.world, bx, by, h.y + 20, s));
    sound.arrowHit(this.world.pan(bx), s.storm);
    this.onHit(h, this.x, this.y);
    this.destroy();
  }

  /** Spent, it drops and sticks in the ground, leaning back the way it came. */
  private stick(): void {
    this.stuck = 1100;
    const x = snap(this.x);
    const y = snap(this.y);
    // The stuck frames have the foot at their bottom centre.
    this.sprite.setFrame(`k${stuckFrameFor(this.ux)}`).setOrigin(0.5, 1).setPosition(x, y + 1).setDepth(y);
    this.glowLayer.setFrame(`k${stuckFrameFor(this.ux)}`).setOrigin(0.5, 1).setPosition(x, y + 1).setDepth(y + 0.1);
    this.shadow.setPosition(x, y).setScale(0.3, 0.3);
    this.world.debris([0xe8dcc0, 0xb8a888], x, y - 1, 3, y + 1);
    sound.arrowStick(this.world.pan(x), 0.35);
    if (this.light) {
      this.world.lights.removeLight(this.light);
      this.light = null;
    }
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
    this.glowLayer.destroy();
    this.shadow.destroy();
    if (this.light) this.world.lights.removeLight(this.light);
  }
}

/** A crackle of arcs round a point where a storm arrow struck, re-struck every few frames. */
export class Zap implements Effect {
  dead = false;
  private layer: PixelLayer;
  private light: Phaser.GameObjects.Light;
  private age = 0;
  private redrawIn = 0;
  private readonly seed = Math.floor(Math.random() * 1000);
  private static readonly HALF = 11;
  private static readonly LIFE = 220;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    depth: number,
    private style: ArrowStyle,
  ) {
    const H = Zap.HALF;
    this.layer = new PixelLayer(scene, H * 2, H * 2);
    this.layer.image.setPosition(Math.round(x) - H, Math.round(y) - H).setDepth(depth);
    this.light = scene.lights.addLight(x, y, 70, style.light, 2.6);
    this.draw();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    if (this.age >= Zap.LIFE) {
      this.destroy();
      return;
    }
    this.light.intensity = 2.6 * (1 - this.age / Zap.LIFE);
    this.redrawIn -= dt;
    if (this.redrawIn <= 0) {
      this.redrawIn = 45;
      this.draw();
    }
  }

  private draw(): void {
    const H = Zap.HALF;
    const t = this.age / Zap.LIFE;
    const f = Math.floor(this.age / 45);
    const b = this.layer;
    const c = this.style;
    b.clear();
    // Three jagged arcs leaping out from the strike, shorter as it dies.
    for (let k = 0; k < 3; k++) {
      let a = hash(k, f, this.seed) * Math.PI * 2;
      let x = H;
      let y = H;
      const len = (5 + hash(k, f, this.seed + 1) * 5) * (1 - t * 0.6);
      for (let s = 0; s < len; s += 1) {
        a += (hash(k, s, f + this.seed) - 0.5) * 1.3;
        x += Math.cos(a);
        y += Math.sin(a);
        b.put(Math.round(x), Math.round(y), s < len * 0.4 ? c.core : s < len * 0.75 ? c.hot : c.mid, 1 - t * 0.5);
      }
    }
    b.put(H, H, c.core);
    b.flush();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
    this.scene.lights.removeLight(this.light);
  }
}

interface Falling {
  /** Where it lands, and when (ms into the rain). */
  x: number;
  y: number;
  at: number;
  /** Frame index lean: -1, 0, 1. */
  lean: number;
  sprite: Phaser.GameObjects.Sprite | null;
  glow: Phaser.GameObjects.Sprite | null;
  landed: boolean;
}

/** From loosing the volley to the first arrow coming down. */
const RAIN_DELAY = 520;
/** How long the arrows keep falling. */
const RAIN_TIME = 1100;
/** How long an arrow takes to fall into view and land. */
const FALL_TIME = 150;
const FALL_H = 72;
/** How long the stuck arrows stay after the last has fallen. */
const LINGER = 700;

/**
 * The volley: an arrow shot straight up out of sight from (sx, sy) while a
 * ring marks the ground at (x, y); then arrows come plunging down all over the
 * ring and stick there. Every `tick` ms while they fall, `hit` is handed the
 * ring to strike everything inside. The storm archer's rain comes with bolts
 * of lightning.
 */
export class ArrowRain implements Effect {
  dead = false;
  private ground: PixelLayer;
  private air: PixelLayer;
  private light: Phaser.GameObjects.Light;
  private up: Phaser.GameObjects.Sprite;
  private upGlow: Phaser.GameObjects.Sprite;
  private arrows: Falling[] = [];
  private age = 0;
  private redrawIn = 0;
  private tickIn: number;
  private started = false;
  /** Bolts still showing: where, and ms left. */
  private bolts: { x: number; y: number; left: number; seed: number }[] = [];
  private readonly gw: number;
  private readonly gh: number;
  private readonly ah: number;
  private readonly key: string;
  private readonly seed = Math.floor(Math.random() * 1000);

  constructor(
    private world: WorldScene,
    sx: number,
    sy: number,
    private x: number,
    private y: number,
    private radius: number,
    private tick: number,
    private hit: (x: number, y: number, r: number) => void,
    private style: ArrowStyle = RANGER_ARROW,
  ) {
    this.key = `arrow${style.suffix}`;
    this.tickIn = RAIN_DELAY + 80;
    this.gw = Math.ceil(radius) + 3;
    this.gh = Math.ceil(radius * SQUASH) + 3;
    this.ground = new PixelLayer(world, this.gw * 2, this.gh * 2);
    this.ground.image.setPosition(Math.round(x) - this.gw, Math.round(y) - this.gh).setDepth(GROUND_DEPTH);
    // Falling arrows and bolts reach far above the ring.
    this.ah = FALL_H + 14;
    this.air = new PixelLayer(world, this.gw * 2, this.ah + this.gh);
    this.air.image.setPosition(Math.round(x) - this.gw, Math.round(y) - this.ah).setDepth(y + radius);
    this.light = world.lights.addLight(x, y - 6, radius * 4, style.light, 0);

    // The arrow shot skyward.
    this.up = world.add.sprite(sx, sy, this.key, headingFrame(0, -1)).setPipeline('Lit').setDepth(sy + 1);
    this.upGlow = world.add.sprite(sx, sy, `${this.key}_e`, headingFrame(0, -1)).setBlendMode(Phaser.BlendModes.ADD).setDepth(sy + 1.1);

    // Where and when each arrow comes down: spread evenly over the disc, at random times.
    const n = Math.round(12 + radius * 0.4);
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt((i + 0.5) / n) * radius * 0.92;
      const a = i * 2.39996 + hash(i, 1, this.seed) * 0.6;
      this.arrows.push({
        x: Math.round(x + Math.cos(a) * r),
        y: Math.round(y + Math.sin(a) * r * SQUASH),
        at: RAIN_DELAY + hash(i, 2, this.seed) * (RAIN_TIME - FALL_TIME),
        lean: hash(i, 3, this.seed) < 0.3 ? -1 : hash(i, 3, this.seed) > 0.7 ? 1 : 0,
        sprite: null,
        glow: null,
        landed: false,
      });
    }
    this.draw();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    const end = RAIN_DELAY + RAIN_TIME + LINGER;
    if (this.age >= end) {
      this.destroy();
      return;
    }
    // The skyward arrow, rising fast and fading out.
    if (this.up.visible) {
      const k = this.age / 260;
      if (k >= 1) {
        this.up.setVisible(false);
        this.upGlow.setVisible(false);
      } else {
        const dy = (dt / 1000) * 520;
        this.up.y -= dy;
        this.upGlow.y -= dy;
        this.up.setAlpha(1 - k * k);
        this.upGlow.setAlpha(1 - k * k);
        this.world.debris([this.style.hot, this.style.mid], snap(this.up.x), snap(this.up.y) + 6, 1, this.up.depth - 0.2, 'trail');
      }
    }
    if (!this.started && this.age >= RAIN_DELAY - 60) {
      this.started = true;
      sound.arrowRain(this.world.pan(this.x), this.style.storm);
    }

    for (const [i, a] of this.arrows.entries()) this.updateArrow(a, i);

    // The blows, while arrows are falling.
    this.tickIn -= dt;
    if (this.tickIn <= 0 && this.age <= RAIN_DELAY + RAIN_TIME) {
      this.tickIn += this.tick;
      this.hit(this.x, this.y, this.radius);
    }

    for (const b of this.bolts) b.left -= dt;
    this.bolts = this.bolts.filter((b) => b.left > 0);
    this.light.intensity = Math.max(this.light.intensity - dt * 0.012, this.markerLight());

    const t = this.age - (RAIN_DELAY + RAIN_TIME);
    if (t > 0) {
      const fade = Math.max(0, 1 - t / LINGER);
      for (const a of this.arrows) {
        a.sprite?.setAlpha(Math.min(1, fade * 2));
        a.glow?.setAlpha(Math.min(1, fade * 2));
      }
    }

    this.redrawIn -= dt;
    if (this.redrawIn <= 0) {
      this.redrawIn = 33;
      this.draw();
    }
  }

  /** The ring's own glow: up while it marks the ground, fading once the rain ends. */
  private markerLight(): number {
    const t = this.age;
    if (t < RAIN_DELAY) return 0.9 * (t / RAIN_DELAY);
    if (t < RAIN_DELAY + RAIN_TIME) return 0.9;
    return 0.9 * Math.max(0, 1 - (t - RAIN_DELAY - RAIN_TIME) / LINGER);
  }

  private updateArrow(a: Falling, i: number): void {
    if (this.age < a.at || a.landed) return;
    const k = (this.age - a.at) / FALL_TIME;
    if (!a.sprite) {
      const frame = headingFrame(a.lean * 0.25, 1);
      a.sprite = this.world.add.sprite(a.x, a.y, this.key, frame).setPipeline('Lit');
      a.glow = this.world.add.sprite(a.x, a.y, `${this.key}_e`, frame).setBlendMode(Phaser.BlendModes.ADD);
    }
    if (k < 1) {
      // Plunging, the tip leading: the sprite's centre is ~5 px behind the head.
      const h = FALL_H * (1 - k);
      const px = snap(a.x - a.lean * h * 0.25);
      const py = snap(a.y - h - 5);
      a.sprite.setPosition(px, py).setDepth(a.y + 0.5);
      a.glow!.setPosition(px, py).setDepth(a.y + 0.6);
      return;
    }
    a.landed = true;
    const frame = `k${a.lean + 1}`;
    a.sprite.setFrame(frame).setOrigin(0.5, 1).setPosition(a.x, a.y + 1).setDepth(a.y);
    a.glow!.setFrame(frame).setOrigin(0.5, 1).setPosition(a.x, a.y + 1).setDepth(a.y + 0.1);
    const s = this.style;
    this.world.debris(s.storm ? [s.core, s.hot, s.mid] : [0xe8dcc0, 0xb8a888, s.mid], a.x, a.y - 1, s.storm ? 5 : 3, a.y + 1);
    if (i % 3 === 0) sound.arrowStick(this.world.pan(a.x), 0.25);
    if (s.storm && i % 2 === 0) {
      this.bolts.push({ x: a.x, y: a.y, left: 90, seed: i });
      this.light.intensity = 3.2;
    } else {
      this.light.intensity = Math.max(this.light.intensity, 1.4);
    }
  }

  private draw(): void {
    const { gw, gh, ah, radius: R } = this;
    const c = this.style;
    const g = this.ground;
    const air = this.air;
    g.clear();
    air.clear();
    const ms = this.age;

    // The ring: dashes turning round it, closing in a little as the rain nears.
    const alpha = this.markerLight() / 0.9;
    if (alpha > 0.02) {
      const rr = R * (1.12 - 0.12 * Math.min(1, ms / RAIN_DELAY));
      const n = Math.ceil(rr * 6.5);
      const spin = ms / 900;
      for (let i = 0; i < n; i++) {
        const an = (i / n) * Math.PI * 2 + spin;
        const dash = Math.floor(((i / n) * 12 + spin * 2) % 2) === 0;
        const px = Math.round(gw + Math.cos(an) * rr - 0.5);
        const py = Math.round(gh + Math.sin(an) * rr * SQUASH - 0.5);
        g.put(px, py, dash ? c.hot : c.mid, alpha * (dash ? 0.95 : 0.5));
      }
      // Four ticks pointing in at the centre, like a sight.
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let k = 2; k <= 4; k++) g.put(Math.round(gw + dx * k - 0.5), Math.round(gh + dy * k * SQUASH - 0.5), c.hot, alpha * 0.6);
      }
    }

    // Streaks behind the falling arrows.
    for (const a of this.arrows) {
      if (this.age < a.at || a.landed) continue;
      const k = (ms - a.at) / FALL_TIME;
      const h = FALL_H * (1 - k);
      const hx = a.x - this.x + gw - a.lean * h * 0.25;
      const hy = a.y - this.y + ah - h - 10;
      for (let s = 0; s < 9; s++) {
        air.put(Math.round(hx - a.lean * s * 0.25 - 0.5), Math.round(hy - s), s < 3 ? c.hot : c.mid, 0.55 * (1 - s / 9));
      }
    }

    // Lightning striking down onto the arrows as they land.
    for (const b of this.bolts) {
      let x = b.x - this.x + gw;
      const y1 = b.y - this.y + ah;
      const f = Math.floor(ms / 40);
      for (let y = 0; y <= y1; y++) {
        x += (hash(y, b.seed, f) - 0.5) * 1.6;
        const px = Math.round(x);
        air.put(px, y, y > y1 - 6 || hash(y, b.seed, 3) > 0.7 ? c.core : c.hot);
        air.put(px + 1, y, c.mid, 0.6);
        if (hash(y, b.seed, f + 9) > 0.93) for (let k = 1; k < 4; k++) air.put(px - k, y + k, c.mid, 0.8 - k * 0.2);
      }
    }
    g.flush();
    air.flush();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.ground.destroy();
    this.air.destroy();
    this.up.destroy();
    this.upGlow.destroy();
    for (const a of this.arrows) {
      a.sprite?.destroy();
      a.glow?.destroy();
    }
    this.world.lights.removeLight(this.light);
  }
}
