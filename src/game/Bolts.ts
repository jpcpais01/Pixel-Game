import Phaser from 'phaser';
import type { Hurtbox } from './combat';
import { ARROW_H } from '../art/archer';
import { onGround } from './Toxins';
import { sound } from '../audio';
import type { WorldScene } from '../scenes/WorldScene';
import { clamp01, dither, easeOut, Fx, GROUND, hash, line, segDist, type Ink, type Pal } from './ultimate/ink';

// The second and third archers' own shots. The arbalest's net bolt: a bolt
// with a canister for a head that bursts over the ground into a weighted net,
// and everything under it wades as if through tar until it rots away. The
// windrunner's gale shot: an arrow wrapped in a whirl of wind that goes
// through everything in its path and blows it all back. Briar Rose's net is
// woven of briar with rosebuds for weights; Wisteria's gale whirls petals.

/** The net bolt's flight, world px a second. */
const NET_SPEED = 300;
/** The net's radius once spread, world px. */
const NET_R = 30;
/** How long it takes to fly open. */
const NET_OPEN = 180;
/** How long it lies there, all told (the last NET_FADE of it fading). */
const NET_LIFE = 2600;
const NET_FADE = 400;
/** Foes under it move at this much of their pace. */
const NET_SLOW = 0.3;
/** It catches newcomers this often (and each catch lasts a little longer, so none slips out between). */
const NET_TICK = 350;
const NET_DAMAGE = 8;
/** Ground marks lie under every standing thing. */
const GROUND_DEPTH = 3;

/** What a net bolt and its net are made of: the cords, the weights round the rim, the bolt that carries it. */
export interface NetLook {
  /** The cords: the knot at the middle, the lit cords, the shadowed ones. */
  cord: { core: number; hot: number; mid: number };
  /** Each weight from its lit top to its shadowed side. */
  weight: [number, number, number];
  /** The canister head, lit to shadowed, the shaft, and its vanes. */
  head: [number, number, number];
  shaft: [number, number];
  vane: number;
  /** The tint on foes caught under it. */
  slow: number;
  /** Briar: thorns standing off the cords, a leaf under each weight (a rosebud). */
  thorns?: number;
  leaf?: number;
  /** Chain: cords drawn link by link, and sparks where it bursts (Ironbeard's). */
  chain?: boolean;
}

/** The arbalest's: hemp cord, lead weights, a steel canister on a walnut bolt. */
export const ROPE_NET: NetLook = {
  cord: { core: 0xf0dca0, hot: 0xd0b674, mid: 0xae904e },
  weight: [0x8a92a4, 0x5c6478, 0x343a48],
  head: [0xe6eef8, 0xa8b4c8, 0x5c6880],
  shaft: [0xb88050, 0x94603a],
  vane: 0xe8664a,
  slow: 0xd8c088,
};

/** Briar Rose's: a net of briar, thorns all along it, rosebuds for its weights. */
export const BRIAR_NET: NetLook = {
  cord: { core: 0xe8344a, hot: 0x76a048, mid: 0x3a5e24 },
  weight: [0xff8088, 0xb4162e, 0x7c0c22],
  head: [0x76a048, 0x3a5e24, 0x244018],
  shaft: [0x567e34, 0x3a5e24],
  vane: 0xe4344a,
  slow: 0x8ac060,
  thorns: 0x96402c,
  leaf: 0x2e6e24,
};

/** Ironbeard's: a net of iron chain, iron balls for its weights, on a forge-hot bolt with ember vanes. */
export const CHAIN_NET: NetLook = {
  cord: { core: 0xe6eef8, hot: 0xa8b4c8, mid: 0x5c6880 },
  weight: [0x8a94a2, 0x383e48, 0x1c1f26],
  head: [0xffd070, 0xff902a, 0xa83a10],
  shaft: [0xbc9258, 0x987040],
  vane: 0xf0882e,
  slow: 0x9aa2b2,
  chain: true,
};

/**
 * A bolt with a net packed in its head, loosed from the ground point (x, y)
 * at the ground spot (tx, ty). It bursts at the spot, or over the first foe
 * it would pass, and the net drops over everything round it.
 */
export class NetBolt extends Fx {
  private flyInk: Ink;
  private netInk: Ink;
  private shadow: Phaser.GameObjects.Image;
  private px: number;
  private py: number;
  private ux: number;
  private uy: number;
  private left: number;
  /** When it burst (ms into its life), or -1 while it flies. */
  private burst = -1;
  private tick = 0;
  private landed = false;
  private readonly seed = Math.floor(Math.random() * 1000);

  constructor(
    world: WorldScene,
    x: number,
    y: number,
    tx: number,
    ty: number,
    private look: NetLook = ROPE_NET,
  ) {
    super(world, 99999);
    this.px = x;
    this.py = y;
    const d = Math.hypot(tx - x, ty - y) || 1;
    this.ux = (tx - x) / d;
    this.uy = (ty - y) / d;
    this.left = d;
    this.flyInk = this.ink(24, 24);
    this.netInk = this.ink(NET_R * 2 + 12, Math.ceil(NET_R * GROUND * 2) + 14);
    this.shadow = this.own(world.add.image(x, y, 'shadow').setDepth(1).setScale(0.4, 0.3).setAlpha(0.35));
  }

  protected step(dt: number): void {
    if (this.burst < 0) this.fly(dt);
    else this.lie(dt);
  }

  private fly(dt: number): void {
    const { world } = this;
    const ox = this.px;
    const oy = this.py;
    const move = Math.min(this.left, (NET_SPEED * dt) / 1000);
    this.px += this.ux * move;
    this.py += this.uy * move;
    this.left -= move;
    // A foe in the way catches it early: the net opens over them.
    const over = world.firstHurtbox((h) => h.alive && segDist(h.x, h.y, ox, oy, this.px, this.py) < h.radius + 3);
    if (over) {
      this.px = over.x;
      this.py = over.y;
    }
    if (over || this.left <= 0 || !world.area.contains(this.px, this.py)) {
      this.open();
      return;
    }
    // In flight: a stubby bolt, its canister head catching the light.
    const x = this.px;
    const y = this.py - ARROW_H;
    const g = this.flyInk.begin(x, y, this.py + 1);
    const nx = -this.uy;
    const ny = this.ux;
    const k = this.look;
    for (let i = 3; i <= 10; i++) g.put(x - this.ux * i, y - this.uy * i, k.shaft[i < 6 ? 0 : 1]);
    for (const s of [-1, 1]) g.put(x - this.ux * 10 + nx * s, y - this.uy * 10 + ny * s, k.vane);
    if (k.thorns !== undefined) for (const i of [5, 8]) g.put(x - this.ux * i + nx * (i === 5 ? 1 : -1), y - this.uy * i + ny * (i === 5 ? 1 : -1), k.thorns);
    for (let i = -1; i <= 2; i++) {
      for (let o = -1.5; o <= 1.5; o += 0.5) g.put(x - this.ux * i + nx * o, y - this.uy * i + ny * o, o < -0.5 ? k.head[0] : o < 0.8 ? k.head[1] : k.head[2]);
    }
    g.put(x + this.ux * 3, y + this.uy * 3, k.head[0]);
    g.end();
    this.shadow.setPosition(Math.round(this.px), Math.round(this.py));
  }

  /** The canister bursts: the net flies open and drops, its weights thumping down; everything under it is caught. */
  private open(): void {
    const { world } = this;
    this.burst = this.t;
    this.life = this.t + NET_LIFE;
    this.flyInk.begin(0, 0, 0).end();
    this.shadow.setVisible(false);
    const k = this.look;
    world.debris([k.head[0], k.cord.hot, k.cord.mid], this.px, this.py - ARROW_H, 8, this.py + 2);
    // The briar net bursts in a flurry of rose petals.
    if (k.leaf !== undefined) world.debris([k.weight[0], k.weight[1], k.cord.core, k.leaf], this.px, this.py - ARROW_H, 14, this.py + 2, 'spores');
    // The chain net's hot canister bursts in a spray of forge sparks.
    if (k.chain) world.debris([0xfff4c8, k.head[0], k.head[1], k.head[2]], this.px, this.py - ARROW_H, 12, this.py + 2, 'burst');
    sound.netSwish(world.pan(this.px));
    for (const h of world.hurtboxesWhere((b) => b.alive && onGround(b, this.px, this.py, NET_R))) {
      h.hurt({ damage: NET_DAMAGE, heavy: false, knock: 0, fromX: this.px, fromY: this.py });
      h.slow?.(NET_SLOW, NET_LIFE - NET_FADE, k.slow);
    }
  }

  private lie(dt: number): void {
    const { world } = this;
    const age = this.t - this.burst;
    // Newcomers wading in are caught too.
    this.tick -= dt;
    if (this.tick <= 0 && age < NET_LIFE - NET_FADE) {
      this.tick = NET_TICK;
      for (const h of world.hurtboxesWhere((b) => b.alive && onGround(b, this.px, this.py, NET_R))) h.slow?.(NET_SLOW, NET_TICK + 150, this.look.slow);
    }
    if (age === 0 || age - dt < NET_OPEN + 60) this.draw(age);
    else if (age > NET_LIFE - NET_FADE) this.draw(age);
  }

  /** The net on the ground: eight cords from the middle, two rings, lead weights round the rim. */
  private draw(age: number): void {
    const k = easeOut(age / NET_OPEN);
    const R = NET_R * (0.25 + 0.75 * k);
    const fade = 1 - clamp01((age - (NET_LIFE - NET_FADE)) / NET_FADE);
    // Flying open, it is still off the ground: the rim lifts, then settles.
    const lift = (1 - k) * 8;
    const cx = this.px;
    const cy = this.py;
    const look = this.look;
    const g = this.netInk.begin(cx, cy, GROUND_DEPTH);
    if (fade <= 0) {
      g.end();
      return;
    }
    const at = (a: number, r: number): [number, number] => [cx + Math.cos(a) * r, cy + Math.sin(a) * r * GROUND - lift * (r / R)];
    // A soft shadow under the cords, so they read as lying on top of the ground.
    for (let a = 0; a < 8; a++) {
      const th = (a / 8) * Math.PI * 2 + hash(a, this.seed) * 0.2;
      const [x1, y1] = at(th, R);
      line(g, cx, cy + 1, x1, y1 + 1, 0x1a1208, 0.35 * fade);
      line(g, cx, cy, x1, y1, a % 2 ? look.cord.mid : look.cord.hot, fade);
      // Chain: every other link catches the light.
      if (look.chain) {
        const n = Math.ceil(Math.hypot(x1 - cx, y1 - cy));
        for (let j = 1; j < n; j += 2) g.put(cx + ((x1 - cx) * j) / n, cy + ((y1 - cy) * j) / n, j % 4 === 1 ? look.cord.core : look.cord.mid, fade);
      }
      // Briar cords bristle with thorns along their length.
      if (look.thorns !== undefined) {
        for (const f of [0.35, 0.7]) g.put(cx + (x1 - cx) * f + (a % 2 ? 1 : -1), cy + (y1 - cy) * f, look.thorns, fade);
      }
    }
    for (const [f, c] of [[0.42, look.cord.hot], [0.78, look.cord.mid]] as const) {
      const r = R * f;
      const n = Math.ceil(r * 7);
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2;
        // The rings sag between the cords.
        const sag = 1 - Math.abs(Math.sin(th * 4)) * 0.08;
        const [x, y] = at(th, r * sag);
        g.put(x, y + 1, 0x1a1208, 0.3 * fade);
        if (dither(Math.round(x), Math.round(y)) < 0.92) g.put(x, y, look.chain && i % 2 ? look.cord.core : c, fade);
      }
    }
    // The knot in the middle.
    g.put(cx, cy, look.cord.core, fade);
    g.put(cx + 1, cy, look.leaf ?? look.cord.hot, fade);
    g.put(cx, cy - 1, look.leaf ?? look.cord.hot, fade);
    // Lead weights round the rim, each lit from the top left.
    for (let a = 0; a < 8; a++) {
      const th = (a / 8) * Math.PI * 2 + hash(a, this.seed) * 0.2;
      const [x, y] = at(th, R);
      g.put(x, y + 1, 0x0c0a08, 0.45 * fade);
      if (look.leaf !== undefined) g.put(x - 1, y, look.leaf, fade);
      g.put(x, y, look.weight[1], fade);
      g.put(x + 1, y, look.weight[2], fade);
      g.put(x, y - 1, look.weight[0], fade);
    }
    g.end();
    if (age >= NET_OPEN && !this.landed) {
      this.landed = true;
      // The weights land.
      this.world.debris([0xe8dcc0, 0xb8a888], cx, cy, 5, cy + 1);
      sound.arrowStick(this.world.pan(cx), 0.5);
    }
  }
}

/** The gale shot's flight, world px a second, and how far it goes. */
const GALE_SPEED = 420;
const GALE_RANGE = 190;
const GALE_DAMAGE = 14;
const GALE_KNOCK = 240;

/**
 * An arrow wrapped in a whirl of wind, loosed from the ground point (x, y)
 * along (ux, uy) at chest height: it goes through every foe in its path,
 * striking each once and blowing it back, and unravels at the end of its run.
 */
export class GaleShot extends Fx {
  private pix: Ink;
  private lamp: Phaser.GameObjects.Light;
  private struck = new Set<Hurtbox>();
  private gone = 0;
  private px: number;
  private py: number;
  /** When it ran out (ms into its life), or -1 while it flies. */
  private spent = -1;

  constructor(
    world: WorldScene,
    x: number,
    y: number,
    private ux: number,
    private uy: number,
    private p: Pal,
    /** Petals whirled along in its wind (Wisteria's), lit to shadowed. */
    private petals?: number[],
  ) {
    super(world, 99999);
    this.px = x;
    this.py = y;
    this.pix = this.ink(48, 48);
    this.lamp = this.light(x, y - ARROW_H, 60, p.light, 1.4);
  }

  protected step(dt: number): void {
    const { world, p } = this;
    if (this.spent < 0) {
      const ox = this.px;
      const oy = this.py;
      const move = (GALE_SPEED * dt) / 1000;
      this.px += this.ux * move;
      this.py += this.uy * move;
      this.gone += move;
      for (const h of world.hurtboxesWhere((b) => b.alive && !this.struck.has(b) && segDist(b.x, b.y, ox, oy, this.px, this.py) < b.radius + 4)) {
        this.struck.add(h);
        h.hurt({ damage: GALE_DAMAGE, heavy: true, knock: GALE_KNOCK, fromX: h.x - this.ux * 12, fromY: h.y - this.uy * 12 });
        world.debris(p.tints, h.x, h.y - h.bodyY, 9, h.y + 10);
        sound.arrowHit(world.pan(h.x), false);
      }
      if (this.gone >= GALE_RANGE || !world.area.contains(this.px, this.py)) {
        this.spent = this.t;
        this.life = this.t + 220;
        sound.gust(world.pan(this.px));
      }
      // Wind peeling off its wake.
      if (Math.random() < dt / 30) world.debris([p.core, p.hot, p.mid], this.px - this.ux * 10, this.py - ARROW_H - this.uy * 10, 1, this.py + 2, 'trail');
      if (this.petals && Math.random() < dt / 45) world.debris(this.petals, this.px - this.ux * 14, this.py - ARROW_H - this.uy * 14, 1, this.py + 2, 'spores');
    }
    this.draw();
  }

  private draw(): void {
    const { p, t } = this;
    const x = this.px;
    const y = this.py - ARROW_H;
    const g = this.pix.begin(x, y, this.py + 2);
    const fade = this.spent < 0 ? 1 : 1 - clamp01((t - this.spent) / 220);
    const ux = this.ux;
    const uy = this.uy;
    const nx = -uy;
    const ny = ux;
    if (this.spent < 0) {
      // Shaft, white fletching, a bright leaf-shaped head.
      for (let i = 2; i <= 13; i++) g.put(x - ux * i, y - uy * i, i < 4 ? p.core : 0xa8b8c8);
      for (const s of [-1, 1]) {
        g.put(x - ux * 12 + nx * s, y - uy * 12 + ny * s, 0xf0f6fa);
        g.put(x - ux * 13 + nx * s * 1.5, y - uy * 13 + ny * s * 1.5, 0xd8e4ec);
      }
      for (let i = 0; i < 3; i++) for (let o = -1; o <= 1; o += 0.5) if (Math.abs(o) <= 1 - i * 0.3) g.put(x - ux * i + nx * o, y - uy * i + ny * o, Math.abs(o) < 0.5 ? p.core : p.hot);
    }
    // Two strands of wind spiralling round it, longer behind, thinning to dither.
    const unravel = this.spent < 0 ? 0 : (t - this.spent) / 220;
    for (const side of [0, Math.PI]) {
      for (let i = 0; i < 22; i++) {
        const w = Math.sin(t * 0.035 - i * 0.45 + side) * (2.5 + i * 0.12 + unravel * 6);
        const a = fade * (1 - i / 22);
        const sx = x - ux * (i + 1) + nx * w;
        const sy = y - uy * (i + 1) + ny * w;
        if (dither(Math.round(sx), Math.round(sy)) < a) g.put(sx, sy, i < 5 ? p.core : i < 12 ? p.hot : p.mid);
        // Petals caught in the whirl: every few steps along a strand, a two-pixel petal tumbling over.
        const pt = this.petals;
        if (pt && i % 5 === 3 && a > 0.2) {
          const k = Math.floor(t / 60 + i) % 2;
          g.put(sx, sy, pt[1]);
          g.put(sx + (k ? nx : ux), sy + (k ? ny : uy), pt[2]);
        }
      }
    }
    g.end();
    this.lamp.setPosition(x, y);
    this.lamp.intensity = 1.4 * fade;
  }
}
