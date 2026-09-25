import Phaser from 'phaser';
import { PixelLayer } from './Beam';
import type { Effect } from './Slash';
import type { Hurtbox } from './combat';
import { FLASK_FRAMES } from '../art/alchemist';
import { sound } from '../audio';
import type { WorldScene } from '../scenes/WorldScene';

// The alchemist's poisons: the flask tumbling through the air, the splash
// where it bursts, the bog his great flask leaves, and the poison that keeps
// biting whatever it touched. Ground effects are small canvases of solid
// pixels like the other heroes' effects, redrawn at a steady pixel-art pace.

/** The colours of one alchemist's poison, and the textures that go with it. */
export interface ToxStyle {
  core: number;
  hot: number;
  mid: number;
  deep: number;
  murk: number;
  /** Debris tints, brightest first. */
  tints: number[];
  /** Its light on the ground. */
  light: number;
  /** Damage numbers it pops. */
  numbers: number;
  /** Texture key suffix: '' for the plague doctor, '_witch' for the hex witch. */
  suffix: string;
}

export const PLAGUE_TOX: ToxStyle = {
  core: 0xf2ffd2,
  hot: 0xb8ff5c,
  mid: 0x52d62e,
  deep: 0x1c7a3a,
  murk: 0x123f24,
  tints: [0xf2ffd2, 0xb8ff5c, 0x52d62e],
  light: 0x7cff4a,
  numbers: 0x9dff5a,
  suffix: '',
};

export const HEX_TOX: ToxStyle = {
  core: 0xfff0fe,
  hot: 0xff9cf2,
  mid: 0xd64ce0,
  deep: 0x6e2090,
  murk: 0x2e1040,
  tints: [0xfff0fe, 0xff9cf2, 0xd64ce0],
  light: 0xe060ff,
  numbers: 0xf890ff,
  suffix: '_witch',
};

export const CHEM_TOX: ToxStyle = {
  core: 0xfbffd6,
  hot: 0xe2ff4a,
  mid: 0xa6d80e,
  deep: 0x4a6e0a,
  murk: 0x222e0a,
  tints: [0xfbffd6, 0xe2ff4a, 0xa6d80e],
  light: 0xd0ff30,
  numbers: 0xe8ff50,
  suffix: '_chem',
};

/** Splashes are circles on the ground seen at an angle: squash them vertically. */
const SQUASH = 0.58;
/** Ground effects: under every standing thing, over the ground's shadows. */
const GROUND_DEPTH = 3;

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Is a body standing at (x, y) inside the ground ellipse of radius `r` round (cx, cy)? */
export function onGround(h: Hurtbox, cx: number, cy: number, r: number): boolean {
  const dx = (h.x - cx) / (r + h.radius);
  const dy = (h.y - cy) / (r * SQUASH + h.radius * 0.6);
  return dx * dx + dy * dy <= 1;
}

/**
 * A flask lobbed from the hand at (x0, y0), `h0` px off the ground, landing
 * at (x1, y1) on the ground. It tumbles as it flies, its shadow sliding along
 * the ground beneath; it bursts early on any body it drops onto.
 */
export class Flask implements Effect {
  dead = false;
  private sprite: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private halo: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private age = 0;
  private trailT = 0;
  private readonly flight: number;
  private readonly peak: number;
  private readonly spin: number;
  private gx: number;
  private gy: number;

  constructor(
    private world: WorldScene,
    private x0: number,
    private y0: number,
    private h0: number,
    private x1: number,
    private y1: number,
    private big: boolean,
    private onLand: (x: number, y: number) => void,
    private style: ToxStyle = PLAGUE_TOX,
  ) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    this.flight = Phaser.Math.Clamp(dist / 150, 0.26, 0.62) * 1000 + (big ? 160 : 0);
    this.peak = 8 + dist * 0.16 + (big ? 10 : 0);
    this.spin = (x1 >= x0 ? 1 : -1) * (big ? 0.022 : 0.034);
    this.gx = x0;
    this.gy = y0;
    const key = (big ? 'flask_big' : 'flask') + style.suffix;
    this.sprite = world.add.sprite(x0, y0 - h0, key, 'r0').setPipeline('Lit');
    this.glowLayer = world.add.sprite(x0, y0 - h0, `${key}_e`, 'r0').setBlendMode(Phaser.BlendModes.ADD);
    this.halo = world.add.image(x0, y0 - h0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(this.style.mid).setScale(big ? 0.8 : 0.5).setAlpha(0.6);
    this.shadow = world.add.image(x0, y0, 'shadow').setDepth(1).setAlpha(0.5);
    this.update(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    const t = Math.min(1, this.age / this.flight);
    this.gx = this.x0 + (this.x1 - this.x0) * t;
    this.gy = this.y0 + (this.y1 - this.y0) * t;
    const h = this.h0 * (1 - t) + this.peak * 4 * t * (1 - t);
    const x = Math.round(this.gx);
    const y = Math.round(this.gy - h);
    const frame = `r${((Math.floor(this.age * Math.abs(this.spin)) * Math.sign(this.spin)) % FLASK_FRAMES + FLASK_FRAMES) % FLASK_FRAMES}`;
    const depth = this.gy + 16;
    this.sprite.setPosition(x, y).setFrame(frame).setDepth(depth);
    this.glowLayer.setPosition(x, y).setFrame(frame).setDepth(depth + 0.1);
    this.halo.setPosition(x, y).setDepth(depth - 0.1);
    // The shadow firms up as the flask drops towards it.
    const k = 1 - Math.min(1, h / 40);
    this.shadow.setPosition(Math.round(this.gx), Math.round(this.gy)).setScale((this.big ? 0.55 : 0.4) + 0.25 * k).setAlpha(0.25 + 0.35 * k);

    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = this.big ? 30 : 45;
      this.world.debris(this.style.tints, x, y, 1, depth - 0.2, 'trail');
    }

    // Coming down, it bursts on the first body in its way.
    const falling = t > 0.5;
    const hit =
      falling &&
      h < 16 &&
      this.world.hurtboxesWhere((b) => Math.abs(b.y - this.gy) < 6 && Math.abs(b.x - this.gx) < b.radius + 2 && h < b.bodyY * 2 + 4).length > 0;
    if (t >= 1 || hit) this.land();
  }

  private land(): void {
    const x = Math.round(this.gx);
    const y = Math.round(this.gy);
    this.destroy();
    this.onLand(x, y);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
    this.glowLayer.destroy();
    this.halo.destroy();
    this.shadow.destroy();
  }
}

/**
 * A flask bursting on the ground: a flash, glass shards and droplets flung
 * out in arcs, a ring of spray rolling out and a puddle that seethes and
 * sinks away. `radius` is the reach of the splash.
 */
export class Splash implements Effect {
  dead = false;
  private ground: PixelLayer;
  private air: PixelLayer;
  private glow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light | null;
  private age = 0;
  private redrawIn = 0;
  private readonly duration: number;
  private readonly gw: number;
  private readonly gh: number;
  private readonly ah: number;
  private readonly seed = Math.floor(Math.random() * 1000);

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    private radius: number,
    private style: ToxStyle = PLAGUE_TOX,
    /** False for splashes that go off beside a lit one, to keep the lights few. */
    lit = true,
  ) {
    this.duration = 700 + radius * 20;
    this.gw = Math.ceil(radius) + 4;
    this.gh = Math.ceil(radius * SQUASH) + 4;
    this.ground = new PixelLayer(scene, this.gw * 2, this.gh * 2);
    this.ground.image.setPosition(x - this.gw, y - this.gh).setDepth(GROUND_DEPTH);
    // Droplets fly up out of the burst, so this layer reaches higher than it does low.
    this.ah = Math.ceil(radius * 0.9) + 8;
    this.air = new PixelLayer(scene, this.gw * 2, this.ah + this.gh);
    this.air.image.setPosition(x - this.gw, y - this.ah).setDepth(y + 14);
    this.glow = scene.add.image(x, y - 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(this.style.mid).setScale(radius / 10, (radius * SQUASH) / 10).setDepth(y + 13);
    this.light = lit ? scene.lights.addLight(x, y - 4, radius * 5, this.style.light, 2.6) : null;
    this.draw();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    if (this.age >= this.duration) {
      this.destroy();
      return;
    }
    const t = this.age / this.duration;
    this.glow.setAlpha(0.9 * Math.max(0, 1 - t * 2.5));
    if (this.light) this.light.intensity = 2.6 * Math.max(0, 1 - t * 2);
    this.redrawIn -= dt;
    if (this.redrawIn <= 0) {
      this.redrawIn = 33;
      this.draw();
    }
  }

  private draw(): void {
    const { radius: R, gw, gh, ah, seed } = this;
    const t = this.age / this.duration;
    const ms = this.age;
    const g = this.ground;
    const a = this.air;
    g.clear();
    a.clear();

    // The puddle: spreads fast, seethes, then sinks into the ground from the edge in.
    const pr = R * 0.72 * easeOut(ms / 160) * (t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1);
    if (pr > 0.5) {
      for (let y = -gh; y < gh; y++) {
        for (let x = -gw; x < gw; x++) {
          const wob = 1 + (hash(x, y, seed) - 0.5) * 0.25;
          const d = Math.hypot((x + 0.5) / (pr * wob), (y + 0.5) / (pr * SQUASH * wob));
          if (d > 1) continue;
          const edge = d > 0.78;
          const col = edge ? this.style.mid : hash(x, y, seed + Math.floor(ms / 120)) > 0.86 ? this.style.hot : d < 0.4 ? this.style.mid : this.style.deep;
          g.put(gw + x, gh + y, col, edge ? 0.8 : 0.7);
        }
      }
    }
    // The spray ring rolling out along the ground.
    const rt = ms / 260;
    if (rt < 1) {
      const rr = 2 + (R - 2) * easeOut(rt);
      const col = rt < 0.3 ? this.style.core : rt < 0.6 ? this.style.hot : this.style.mid;
      const n = Math.ceil(rr * 6);
      for (let i = 0; i < n; i++) {
        const an = (i / n) * Math.PI * 2;
        if (hash(i, 7, seed) < 0.18) continue;
        g.put(Math.round(gw + Math.cos(an) * rr), Math.round(gh + Math.sin(an) * rr * SQUASH), col, 1 - rt * 0.6);
      }
    }
    // The flash where the glass broke.
    if (ms < 90) {
      for (const [dx, dy, c] of [[0, 0, this.style.core], [1, 0, this.style.core], [-1, 0, this.style.hot], [0, -1, this.style.core], [0, 1, this.style.hot], [2, 0, this.style.hot], [-2, 0, this.style.mid], [0, -2, this.style.hot]] as const) {
        a.put(gw + dx, ah + dy - 2, c);
      }
    }
    // Droplets and shards thrown up and out, falling back in arcs.
    const flyT = ms / 420;
    if (flyT < 1) {
      const n = 10 + Math.round(R * 0.6);
      for (let i = 0; i < n; i++) {
        const an = hash(i, 1, seed) * Math.PI * 2;
        const reach = R * (0.45 + hash(i, 2, seed) * 0.6);
        const up = 5 + hash(i, 3, seed) * R * 0.55;
        const k = Math.min(1, flyT * (0.9 + hash(i, 4, seed) * 0.4));
        if (k >= 1) continue;
        const px = Math.cos(an) * reach * easeOut(k);
        const py = Math.sin(an) * reach * SQUASH * easeOut(k) - up * 4 * k * (1 - k);
        const shard = i % 4 === 0;
        const col = shard ? (k < 0.5 ? 0xeaffff : 0x8fc0c8) : k < 0.35 ? this.style.hot : this.style.mid;
        a.put(Math.round(gw + px), Math.round(ah + py - 2), col, 1 - k * 0.5);
      }
    }
    // Fumes curling up off the puddle.
    if (t > 0.1 && pr > 2) {
      for (let i = 0; i < 4; i++) {
        const life = ((ms / 700 + hash(i, 5, seed)) % 1);
        const px = (hash(i, 6, seed) - 0.5) * pr * 1.2 + Math.sin(life * 6 + i) * 1.2;
        const py = -life * 10;
        a.put(Math.round(gw + px), Math.round(ah + py - 1), life < 0.5 ? this.style.hot : this.style.mid, 0.8 * (1 - life));
      }
    }
    g.flush();
    a.flush();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.ground.destroy();
    this.air.destroy();
    this.glow.destroy();
    if (this.light) this.scene.lights.removeLight(this.light);
  }
}

interface Fume {
  img: Phaser.GameObjects.Image;
  age: number;
  life: number;
  vx: number;
  rise: number;
  y0: number;
  scale: number;
}

interface Bubble {
  x: number;
  y: number;
  /** ms until it pops, and how long it grows before that. */
  at: number;
  grow: number;
  size: number;
}

/**
 * The great flask's bog: a pool of seething poison on the ground, bubbles
 * swelling and popping in it, and a pall of green fumes rising off it. Every
 * `tick` ms it hands `bite` whatever stands in it.
 */
export interface BogOptions {
  /** ms between fume puffs at full strength. */
  fumeEvery?: number;
  /** False for bogs beside a lit one, to keep the lights few. */
  lit?: boolean;
}

export class Bog implements Effect {
  dead = false;
  private layer: PixelLayer;
  private glow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light | null;
  private readonly fumeEvery: number;
  private fumes: Fume[] = [];
  private bubbles: Bubble[] = [];
  private age = 0;
  private redrawIn = 0;
  private fumeIn = 0;
  private biteIn: number;
  private readonly hw: number;
  private readonly hh: number;
  private readonly seed = Math.floor(Math.random() * 1000);

  constructor(
    private world: WorldScene,
    readonly x: number,
    readonly y: number,
    readonly radius: number,
    private duration: number,
    private tick: number,
    private bite: (inside: Hurtbox[]) => void,
    private style: ToxStyle = PLAGUE_TOX,
    opts: BogOptions = {},
  ) {
    this.fumeEvery = opts.fumeEvery ?? 130;
    this.hw = Math.ceil(radius) + 3;
    this.hh = Math.ceil(radius * SQUASH) + 3;
    this.layer = new PixelLayer(world, this.hw * 2, this.hh * 2);
    this.layer.image.setPosition(x - this.hw, y - this.hh).setDepth(GROUND_DEPTH);
    this.glow = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(this.style.mid).setScale(radius / 10, (radius * SQUASH) / 10).setDepth(GROUND_DEPTH + 1).setAlpha(0);
    this.light = opts.lit === false ? null : world.lights.addLight(x, y - 8, radius * 3.4, this.style.light, 0);
    this.biteIn = tick * 0.4;
    for (let i = 0, n = Math.max(4, Math.round(radius * 0.28)); i < n; i++) this.bubbles.push(this.newBubble(i * 180));
    this.draw();
  }

  private newBubble(after: number): Bubble {
    const an = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * this.radius * 0.8;
    const grow = 300 + Math.random() * 500;
    return { x: Math.cos(an) * d, y: Math.sin(an) * d * SQUASH, at: after + grow, grow, size: Math.random() < 0.3 ? 2 : 1 };
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    if (this.age >= this.duration) {
      this.destroy();
      return;
    }
    const grow = easeOut(this.age / 350);
    const fade = Math.min(1, (this.duration - this.age) / 700);
    const breathe = 0.9 + Math.sin(this.age * 0.005) * 0.1;
    this.glow.setAlpha(0.3 * breathe * grow * fade);
    if (this.light) this.light.intensity = 1.5 * breathe * grow * fade;

    this.biteIn -= dt;
    if (this.biteIn <= 0 && fade > 0.3) {
      this.biteIn += this.tick;
      const inside = this.world.hurtboxesWhere((h) => h.alive && onGround(h, this.x, this.y, this.radius * grow));
      if (inside.length) this.bite(inside);
    }

    // Fumes: soft puffs drifting up off the pool, fewer as it dies away.
    this.fumeIn -= dt;
    if (this.fumeIn <= 0 && fade > 0.2) {
      this.fumeIn = this.fumeEvery / Math.max(0.3, fade);
      const an = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * this.radius * 0.8 * grow;
      const x = this.x + Math.cos(an) * d;
      const y = this.y + Math.sin(an) * d * SQUASH;
      const img = this.world.add.image(Math.round(x), Math.round(y), `fume${this.style.suffix}`, `f${Math.floor(Math.random() * 3)}`).setAlpha(0).setDepth(y + 18);
      this.fumes.push({ img, age: 0, life: 1300 + Math.random() * 700, vx: (Math.random() - 0.5) * 6, rise: 12 + Math.random() * 10, y0: y, scale: 0.6 + Math.random() * 0.35 });
    }
    for (const f of this.fumes) {
      f.age += dt;
      const k = f.age / f.life;
      const x = f.img.x + (f.vx * dt) / 1000;
      f.img
        .setPosition(x, Math.round(f.y0 - 4 - f.rise * k))
        .setScale(f.scale * (0.7 + k * 0.6))
        .setAlpha(0.7 * Math.sin(Math.min(1, k) * Math.PI));
      if (k >= 1) f.img.destroy();
    }
    this.fumes = this.fumes.filter((f) => f.age < f.life);

    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];
      if (this.age > b.at + 120) {
        if (Math.random() < 0.35) this.world.debris(this.style.tints, Math.round(this.x + b.x), Math.round(this.y + b.y) - 1, 2, this.y + 10, 'trail');
        this.bubbles[i] = this.newBubble(this.age + Math.random() * 200);
      }
    }

    // Redrawn at a steady pixel-art pace rather than every frame.
    this.redrawIn -= dt;
    if (this.redrawIn <= 0) {
      this.redrawIn = 80;
      this.draw();
    }
  }

  private draw(): void {
    const { hw, hh, seed } = this;
    const grow = easeOut(this.age / 350);
    const fade = Math.min(1, (this.duration - this.age) / 700);
    const R = this.radius * grow * (0.75 + 0.25 * fade);
    const b = this.layer;
    b.clear();
    const churn = Math.floor(this.age / 240);
    for (let y = -hh; y < hh; y++) {
      for (let x = -hw; x < hw; x++) {
        const wob = 1 + (hash(x >> 1, y, seed) - 0.5) * 0.18 + Math.sin(this.age * 0.004 + x * 0.3) * 0.03;
        const d = Math.hypot((x + 0.5) / (R * wob), (y + 0.5) / (R * SQUASH * wob));
        if (d > 1) continue;
        let col: number;
        let alpha = 0.72 * fade;
        if (d > 0.88) {
          // A bright scum at the rim.
          col = hash(x, y, seed + churn) > 0.3 ? this.style.mid : this.style.hot;
          alpha = 0.85 * fade;
        } else if (d > 0.7) {
          col = this.style.deep;
        } else {
          // Slow swirls in the murk.
          const sw = Math.sin((x + y * 1.7) * 0.5 + this.age * 0.003 + d * 6);
          col = sw > 0.75 ? this.style.mid : sw > 0.1 ? this.style.deep : this.style.murk;
        }
        b.put(hw + x, hh + y, col, alpha);
      }
    }
    // Bubbles swell into rings and pop in a flash.
    for (const bb of this.bubbles) {
      const t = 1 - (bb.at - this.age) / bb.grow;
      if (t < 0 || Math.hypot(bb.x / R, bb.y / (R * SQUASH)) > 0.85) continue;
      const cx = Math.round(hw + bb.x);
      const cy = Math.round(hh + bb.y);
      if (t < 1) {
        const r = t * bb.size;
        if (r < 0.7) b.put(cx, cy, this.style.hot, fade);
        else {
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) b.put(cx + dx * Math.round(r), cy + dy * Math.round(r), this.style.hot, fade);
          b.put(cx - 1, cy - 1, this.style.core, fade);
        }
      } else {
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) b.put(cx + dx, cy + dy, this.style.core, fade * 0.9);
      }
    }
    b.flush();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
    this.glow.destroy();
    if (this.light) this.world.lights.removeLight(this.light);
    for (const f of this.fumes) f.img.destroy();
    this.fumes = [];
  }
}

interface Dose {
  left: number;
  tickIn: number;
  stacks: number;
}

/**
 * Poison working in the monsters it touched: every TICK ms each one takes
 * DAMAGE per stack, a puff of green rising off it, until it wears off.
 * Fresh doses stack up to `maxStacks` and renew the time.
 */
export class Venom {
  static readonly TICK = 500;
  static readonly DAMAGE = 2;
  private doses = new Map<Hurtbox, Dose>();

  constructor(
    private world: WorldScene,
    private style: ToxStyle = PLAGUE_TOX,
    private maxStacks = 3,
  ) {}

  dose(h: Hurtbox, time: number, stacks = 1): void {
    const d = this.doses.get(h);
    if (d) {
      d.left = Math.max(d.left, time);
      d.stacks = Math.min(this.maxStacks, d.stacks + stacks);
    } else {
      this.doses.set(h, { left: time, tickIn: Venom.TICK, stacks: Math.min(this.maxStacks, stacks) });
    }
  }

  update(dt: number): void {
    let bitten = 0;
    let firstX = 0;
    for (const [h, d] of this.doses) {
      if (!h.alive) {
        this.doses.delete(h);
        continue;
      }
      d.tickIn -= dt;
      d.left -= dt;
      if (d.tickIn <= 0) {
        d.tickIn += Venom.TICK;
        const by = h.y - h.bodyY;
        h.hurt({ damage: Venom.DAMAGE * d.stacks, heavy: false, knock: 0, fromX: h.x, fromY: by, poison: this.style.numbers });
        this.world.debris(this.style.tints, Math.round(h.x), Math.round(by), 2 + Math.min(3, d.stacks), h.y + 12, 'spores');
        if (bitten++ === 0) firstX = h.x;
      }
      if (d.left <= 0) this.doses.delete(h);
    }
    if (bitten) sound.sizzle(this.world.pan(firstX));
  }
}
