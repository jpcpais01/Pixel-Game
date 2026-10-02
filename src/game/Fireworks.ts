import Phaser from 'phaser';
import { inFlight, type Hurtbox } from './combat';
import { onGround } from './Toxins';
import { sound } from '../audio';
import type { WorldScene } from '../scenes/WorldScene';
import { bloom, clamp01, dither, easeOut, flare, Fx, GROUND, hash, star, type Ink, type Pal } from './ultimate/ink';

// The Pyrotechnist's own shots. The Roman candle's star: a ball of
// coloured fire flying at chest height, shedding glitter, that pops in a
// small sparkly burst on the first body it meets (singeing those beside
// it). The firecrackers: a string tossed onto a spot, where its fuse burns
// along it and each cracker goes off in turn with a bang and a puff of red
// paper, staggering everything near for a moment.

/** The star's flight, world px a second, how far it goes, and how high it flies. */
const STAR_SPEED = 270;
const STAR_RANGE = 150;
export const STAR_H = 14;
/** What the star deals to the body it strikes, and to those beside it in the burst. */
export const STAR_DAMAGE = 8;
const STAR_SPLASH = 4;
const STAR_SPLASH_R = 14;
const STAR_KNOCK = 50;
/** How long the burst's sparks hang in the air. */
const POP_LIFE = 460;
/** Ground marks lie under every standing thing. */
const GROUND_DEPTH = 3;

/**
 * A star from the Roman candle, loosed from the ground point (x, y) along
 * (ux, uy): it flies until it meets a body or runs out, then bursts.
 */
export class Star extends Fx {
  private pix: Ink;
  private glowImg: Phaser.GameObjects.Image;
  private shade: Phaser.GameObjects.Image;
  private gone = 0;
  /** The last few spots it flew through, for its trail. */
  private past: [number, number][] = [];
  private readonly seed = Math.floor(Math.random() * 1000);
  private readonly inPath = (h: Hurtbox) => inFlight(h, this.x, this.y, STAR_H, 2);

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private p: Pal,
  ) {
    super(world, 99999);
    this.pix = this.ink(48, 48);
    this.glowImg = this.halo(p.hot, 0.55, y + 1).setAlpha(0.7);
    this.shade = this.own(world.add.image(x, y, 'shadow').setDepth(1).setScale(0.3, 0.22).setAlpha(0.3));
  }

  protected step(dt: number): void {
    const { world } = this;
    let move = (STAR_SPEED * dt) / 1000;
    while (move > 0) {
      const d = Math.min(3, move);
      move -= d;
      this.x += this.ux * d;
      this.y += this.uy * d;
      this.gone += d;
      const h = world.firstHurtbox(this.inPath);
      if (h) {
        this.burst(h);
        return;
      }
      if (this.gone >= STAR_RANGE || (!world.walkable(this.x, this.y) && this.gone > 20)) {
        this.burst(null);
        return;
      }
    }
    this.past.unshift([this.x, this.y - STAR_H]);
    if (this.past.length > 7) this.past.pop();
    this.draw();
  }

  private draw(): void {
    const { p, t } = this;
    const x = this.x;
    const y = this.y - STAR_H;
    const g = this.pix.begin(x, y, this.y + 1);
    // The trail: a tail of glitter thinning back along the flight, winking as it goes.
    this.past.forEach(([px, py], i) => {
      const a = 1 - i / this.past.length;
      for (let k = 0; k < 2; k++) {
        const jx = px + (hash(i, k, this.seed + Math.floor(t / 50)) - 0.5) * (1 + i * 0.5);
        const jy = py + (hash(k, i, this.seed + Math.floor(t / 50)) - 0.5) * (1 + i * 0.5) + i * 0.2;
        if (dither(Math.round(jx), Math.round(jy)) < a) g.put(jx, jy, i < 2 ? p.hot : i < 4 ? p.mid : p.deep);
      }
    });
    // The star itself: a white heart in a ball of its colour.
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > 2.2) continue;
        g.put(x + dx, y + dy, d < 0.8 ? p.core : d < 1.6 ? p.hot : p.mid);
      }
    }
    // A glint that flickers round it.
    const k = Math.floor(t / 40) % 4;
    g.put(x + [3, 0, -3, 0][k], y + [0, 3, 0, -3][k], p.core);
    g.end();
    this.glowImg.setPosition(Math.round(x), Math.round(y));
    this.shade.setPosition(Math.round(this.x), Math.round(this.y));
  }

  /** It pops: the struck body takes the blow, those beside it a singe, and a little sparkly burst hangs in the air. */
  private burst(struck: Hurtbox | null): void {
    const { world, p } = this;
    const bx = this.x;
    const by = this.y;
    if (struck) {
      struck.hurt({ damage: STAR_DAMAGE, heavy: false, knock: STAR_KNOCK, fromX: bx - this.ux * 8, fromY: by - this.uy * 8 });
      for (const h of world.hurtboxesWhere((b) => b !== struck && b.alive && onGround(b, bx, by, STAR_SPLASH_R))) {
        h.hurt({ damage: STAR_SPLASH, heavy: false, knock: 30, fromX: bx, fromY: by });
      }
      sound.starPop(world.pan(bx));
    }
    world.addEffect(new StarPop(world, bx, by - STAR_H, by, p, struck ? 1 : 0.6));
    this.destroy();
  }
}

/** A star's burst: a flash, a ring of sparks flying out and drooping as they fade, glitter twinkling. */
export class StarPop extends Fx {
  private pix: Ink;
  private readonly seed = Math.floor(Math.random() * 1000);

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private foot: number,
    private p: Pal,
    private size: number,
  ) {
    super(world, POP_LIFE);
    this.pix = this.ink(40, 40);
    bloom(world, x, y, p.hot, 0.9 * size, 260, foot + 2);
    world.debris(p.tints, x, y, Math.round(6 * size), foot + 4, 'burst');
  }

  protected step(): void {
    const { p, t, x, y, size } = this;
    const k = t / POP_LIFE;
    const g = this.pix.begin(x, y, this.foot + 2);
    if (k < 0.25) star(g, x, y, Math.round(4 * size * (1 - k * 4)) + 1, p);
    const n = 10;
    const r = 11 * size * easeOut(k * 1.6);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2 + this.seed;
      const droop = k * k * 9;
      const sx = x + Math.cos(th) * r;
      const sy = y + Math.sin(th) * r * 0.85 + droop;
      // Each spark twinkles out on its own.
      if (hash(i, this.seed, Math.floor(t / 60)) > 1.1 - k) continue;
      g.put(sx, sy, k < 0.3 ? p.core : k < 0.6 ? p.hot : p.mid);
      if (k < 0.5) g.put(sx - Math.cos(th), sy - Math.sin(th) * 0.85, p.mid);
    }
    g.end();
  }
}

/** The firecrackers: their flight onto the spot, how long the string is, and the fuse's pace from one cracker to the next. */
const STRING_FLIGHT = 300;
const STRING_ARC = 18;
const STRING_LEN = 44;
const CRACKERS = 8;
const POP_EVERY = 95;
/** Each bang: its reach, its blow, and the stagger (foes stand frozen this long). */
export const BANG_R = 12;
export const BANG_DAMAGE = 4;
const BANG_KNOCK = 40;
const BANG_STUN = 220;
/** How long the burnt string lingers after the last bang. */
const STRING_AFTER = 600;

/** What a string of firecrackers looks like: its paper, the confetti of its bangs. */
export interface CrackerLook {
  /** The crackers' paper, lit to shadowed, and their gold caps. */
  paper: [number, number, number];
  cap: number;
  /** The paper blown about by each bang. */
  confetti: number[];
  /** The flash of a bang. */
  bang: Pal;
}

/**
 * A string of firecrackers tossed from the ground point (x, y) onto (tx, ty).
 * It lands lying along the throw, and the fuse burns from its near end to
 * its far end, each cracker going off in turn.
 */
export class Firecrackers extends Fx {
  private air: Ink;
  private ground: Ink;
  private shadow: Phaser.GameObjects.Image;
  private landed = false;
  private popped = 0;
  private next = 0;
  /** Where each cracker lies. */
  private spots: [number, number][] = [];
  private readonly ux: number;
  private readonly uy: number;
  private readonly seed = Math.floor(Math.random() * 1000);

  constructor(
    world: WorldScene,
    private x0: number,
    private y0: number,
    private tx: number,
    private ty: number,
    private look: CrackerLook,
  ) {
    super(world, STRING_FLIGHT + CRACKERS * POP_EVERY + STRING_AFTER);
    const d = Math.hypot(tx - x0, ty - y0) || 1;
    this.ux = (tx - x0) / d;
    this.uy = (ty - y0) / d;
    for (let i = 0; i < CRACKERS; i++) {
      const f = i / (CRACKERS - 1) - 0.5;
      // The string lies a little crooked.
      const wob = Math.sin(i * 1.7 + this.seed) * 2;
      this.spots.push([tx + this.ux * f * STRING_LEN - this.uy * wob, ty + (this.uy * f * STRING_LEN + this.ux * wob) * GROUND]);
    }
    this.air = this.ink(32, 32);
    this.ground = this.ink(STRING_LEN + 2 * BANG_R + 16, Math.ceil(STRING_LEN * GROUND) + 2 * BANG_R + 16);
    this.shadow = this.own(world.add.image(x0, y0, 'shadow').setDepth(1).setScale(0.4, 0.3).setAlpha(0.3));
  }

  protected step(dt: number): void {
    const { t, world } = this;
    if (t < STRING_FLIGHT) {
      this.fly(t / STRING_FLIGHT);
      return;
    }
    if (!this.landed) {
      this.landed = true;
      this.air.begin(0, 0, 0).end();
      this.shadow.setVisible(false);
      sound.arrowStick(world.pan(this.tx), 0.4);
      this.next = 0;
    }
    this.next -= dt;
    while (this.next <= 0 && this.popped < CRACKERS) {
      this.bang(this.spots[this.popped]);
      this.popped++;
      this.next += POP_EVERY;
    }
    this.drawGround();
  }

  /** In the air: the string tumbling over on its arc, its fuse spitting. */
  private fly(k: number): void {
    const gx = this.x0 + (this.tx - this.x0) * k;
    const gy = this.y0 + (this.ty - this.y0) * k;
    const h = 12 * (1 - k) + Math.sin(k * Math.PI) * STRING_ARC;
    const x = gx;
    const y = gy - h;
    const g = this.air.begin(x, y, gy + 2);
    const th = k * 7 + this.seed;
    const vx = Math.cos(th);
    const vy = Math.sin(th);
    const L = this.look;
    for (let i = -4; i <= 4; i++) {
      g.put(x + vx * i, y + vy * i, 0x3a2c20);
      if (i % 2 === 0) {
        g.put(x + vx * i - vy, y + vy * i + vx, L.paper[0]);
        g.put(x + vx * i + vy, y + vy * i - vx, L.paper[1]);
      }
    }
    g.put(x + vx * 5, y + vy * 5, Math.random() < 0.5 ? 0xffffff : 0xfff0a0);
    g.end();
    this.shadow.setPosition(Math.round(gx), Math.round(gy));
    if (Math.random() < 0.5) this.world.debris([0xffffff, 0xfff0a0, 0xffa040], x + vx * 5, y + vy * 5, 1, gy + 2, 'trail');
  }

  /** One cracker goes off: a bang, red paper blown everywhere, and everything near staggered for a moment. */
  private bang([x, y]: [number, number]): void {
    const { world, look } = this;
    for (const h of world.hurtboxesWhere((b) => b.alive && onGround(b, x, y, BANG_R))) {
      h.hurt({ damage: BANG_DAMAGE, heavy: true, knock: BANG_KNOCK, fromX: x, fromY: y });
      h.slow?.(0, BANG_STUN);
    }
    sound.firecracker(world.pan(x));
    bloom(world, x, y - 4, look.bang.hot, 0.8, 180, y + 6);
    world.debris(look.confetti, x, y - 4, 5, y + 6, 'spores');
    world.debris(look.bang.tints, x, y - 3, 4, y + 6, 'burst');
    if (this.popped % 3 === 0) flare(world, x, y - 6, 60, look.bang.light, 1.6, 160);
    if (this.popped === CRACKERS - 1) world.cameras.main.shake(90, 0.0008);
  }

  /** On the ground: the crackers still to go, the fuse burning between, scorches where they went off, and each bang's flash. */
  private drawGround(): void {
    const { look, t } = this;
    const g = this.ground.begin(this.tx, this.ty, GROUND_DEPTH);
    const after = this.popped >= CRACKERS ? clamp01((t - STRING_FLIGHT - CRACKERS * POP_EVERY) / STRING_AFTER) : 0;
    const since = POP_EVERY - this.next;
    this.spots.forEach(([x, y], i) => {
      if (i < this.popped) {
        // A scorch, and shreds of paper round it.
        if (dither(Math.round(x), Math.round(y)) < 1 - after) {
          g.put(x, y, 0x1a120c, 0.8);
          g.put(x + 1, y, 0x2a1a10, 0.7);
          if (hash(i, this.seed) < 0.6) g.put(x + Math.round(hash(i, 1, this.seed) * 6 - 3), y + Math.round(hash(i, 2, this.seed) * 4 - 2), look.paper[1]);
        }
        // The flash of the last one to go.
        if (i === this.popped - 1 && since < 70) {
          star(g, x, y - 3, since < 35 ? 4 : 2, look.bang);
        }
        return;
      }
      // Still to go: the fuse to the next, and a pair of crackers either side of it.
      const [nx, ny] = this.spots[Math.min(CRACKERS - 1, i + 1)];
      if (i < CRACKERS - 1) for (let s = 0; s <= 4; s++) g.put(x + ((nx - x) * s) / 4, y + ((ny - y) * s) / 4, 0x3a2c20);
      g.put(x - this.uy * 1.2, y + this.ux * 1.2 * GROUND - 1, look.paper[0]);
      g.put(x + this.uy * 1.2, y - this.ux * 1.2 * GROUND - 1, look.paper[1]);
      g.put(x - this.uy * 1.2, y + this.ux * 1.2 * GROUND, look.paper[2]);
      g.put(x + this.uy * 1.2, y - this.ux * 1.2 * GROUND, look.paper[2]);
      g.put(x, y - 1, look.cap);
      // The fuse's spark, burning toward this one.
      if (i === this.popped) {
        const k = clamp01(since / POP_EVERY);
        const [px, py] = i > 0 ? this.spots[i - 1] : [x - this.ux * 6, y - this.uy * 6 * GROUND];
        const sx = px + (x - px) * k;
        const sy = py + (y - py) * k;
        g.put(sx, sy - 1, 0xffffff);
        g.put(sx + (Math.random() < 0.5 ? 1 : -1), sy - 2, 0xfff0a0);
      }
    });
    g.end();
  }
}
