import Phaser from 'phaser';
import { HARPOON_DIRS, HARPOON_H } from '../art/aquanaut';
import { inFlight, type Hurtbox } from './combat';
import { snap } from './display';
import { sound } from '../audio';
import type { Effect } from './Slash';
import type { WorldScene } from '../scenes/WorldScene';
import { dither, Fx, type Ink, type Pal } from './ultimate/ink';

// The Aquanaut's shots. The harpoon: a heavy barbed spear fired from his
// pneumatic gun, flying straight at the height of the muzzle, going through
// the first two bodies in its path and driving into the ground at the end of
// its run, trailing a few bubbles. The reel: a harpoon on a chain that hooks
// the first foe it reaches and is cranked home, dragging the foe right up to
// him; a boss won't be dragged, it is yanked off balance and the chain comes
// back alone.

/** How a look's shots look: its sheet's key (for the harpoon's frames), the sea's colours, the spray. */
export interface AquaStyle {
  key: string;
  pal: Pal;
  /** Bubbles and spray, lit to deep. */
  spray: number[];
}

/** The harpoon's frame for a heading. */
const headingOf = (ux: number, uy: number): string => {
  const i = Math.round((Math.atan2(uy, ux) / (Math.PI * 2)) * HARPOON_DIRS);
  return `r${((i % HARPOON_DIRS) + HARPOON_DIRS) % HARPOON_DIRS}`;
};

// The harpoon.
const HARPOON_SPEED = 360;
/** It goes through this many bodies, striking each, and flies on. */
const HARPOON_BITES = 2;
/** Spent, it stands in the ground this long (the last part fading). */
const STUCK_MS = 1400;

/**
 * A harpoon fired from the ground point (x, y) along (ux, uy): it flies
 * HARPOON_H px up, through the first HARPOON_BITES bodies in its path, and at
 * `range` it drives head first into the ground.
 */
export class Harpoon implements Effect {
  dead = false;
  private sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private gone = 0;
  private struck: Hurtbox[] = [];
  private stuck = -1;
  private trailT = 0;
  private readonly inPathNow = (h: Hurtbox) => h.alive && !this.struck.includes(h) && inFlight(h, this.x, this.y, HARPOON_H, 1.5);

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private range: number,
    private style: AquaStyle,
    private hit: (h: Hurtbox, x: number, y: number) => void,
  ) {
    const key = `harpoon_${style.key}`;
    this.sprite = world.add.sprite(x, y - HARPOON_H, key, headingOf(ux, uy)).setPipeline('Lit');
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(0.55, 0.35).setAlpha(0.35);
    this.place();
  }

  update(dt: number): void {
    if (this.dead) return;
    if (this.stuck >= 0) {
      this.stuck -= dt;
      const a = Math.min(1, this.stuck / 350);
      this.sprite.setAlpha(a);
      this.shadow.setAlpha(0.3 * a);
      if (this.stuck <= 0) this.destroy();
      return;
    }
    // A few pixels at a time, so it never skips over a small body.
    let move = (HARPOON_SPEED * dt) / 1000;
    while (move > 0) {
      const d = Math.min(3, move);
      move -= d;
      this.x += this.ux * d;
      this.y += this.uy * d;
      this.gone += d;
      if (!this.world.area.contains(this.x, this.y)) {
        this.destroy();
        return;
      }
      if (this.struck.length < HARPOON_BITES) {
        const h = this.world.firstHurtbox(this.inPathNow);
        if (h) this.strike(h);
      }
      if (this.gone >= this.range) {
        this.stick();
        return;
      }
    }
    this.place();
    // A thread of bubbles off its tail.
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 45;
      this.world.debris(this.style.spray, snap(this.x - this.ux * 8), snap(this.y - HARPOON_H - this.uy * 8), 1, this.y - 0.2, 'trail');
    }
  }

  private place(): void {
    const x = snap(this.x);
    const y = snap(this.y - HARPOON_H);
    this.sprite.setPosition(x, y).setDepth(this.y + 1);
    this.shadow.setPosition(snap(this.x), snap(this.y));
  }

  /** It bites: steel sparks and a spatter, the blow, and on it flies. */
  private strike(h: Hurtbox): void {
    this.struck.push(h);
    const bx = h.x - this.ux * (h.radius - 1);
    const by = h.y - h.bodyY;
    this.world.debris([0xffffff, 0xe8eef8, this.style.pal.hot], snap(bx), snap(by), 7, h.y + 20);
    this.world.debris(this.style.spray, snap(bx), snap(by), 4, h.y + 20, 'spores');
    sound.arrowHit(this.world.pan(bx), false);
    this.hit(h, this.x, this.y);
  }

  /** Spent: it drives into the ground head first, leaning back the way it came. */
  private stick(): void {
    this.stuck = STUCK_MS;
    const x = snap(this.x);
    const y = snap(this.y);
    const k = this.ux > 0.35 ? 0 : this.ux < -0.35 ? 2 : 1;
    this.sprite.setFrame(`k${k}`).setOrigin(0.5, 1).setPosition(x, y + 2).setDepth(y);
    this.shadow.setPosition(x, y).setScale(0.3, 0.3);
    this.world.debris([0xe8dcc0, 0xb8a888, 0x8a7a60], x, y - 1, 5, y + 1);
    sound.arrowStick(this.world.pan(x), 0.5);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
    this.shadow.destroy();
  }
}

// The reel.
const CHAIN_SPEED = 430;
const RETRACT_SPEED = 520;
/** A dragged foe comes at this pace, and stops this far in front of him. */
const DRAG_SPEED = 300;
const DRAG_STOP = 17;
/** The longest a drag may take (a foe caught on a wall is let go). */
const DRAG_MAX = 1100;
/** The bind holding a foe on the chain, kept fresh this often. */
const DRAG_HOLD = 260;
const HOOK_DAMAGE = 8;
/** Landing at his feet: the thump, and how long it stays dazed. */
const LAND_DAMAGE = 6;
const LAND_STUN = 900;
/** A boss: it is yanked (a heavy blow, nudged toward him) and slowed instead. */
const YANK_DAMAGE = 10;
const YANK_KNOCK = 70;
const YANK_SLOW = 0.5;
const YANK_SLOW_MS = 1400;

type Bindable = Hurtbox & { bind?(ms: number, lift: number): boolean; shove?(dx: number, dy: number): void };

/**
 * The chained harpoon, fired from the hero (`from` gives his feet each
 * frame) along (ux, uy), `range` far: out until it hooks a foe or runs out,
 * then home along its chain, with the foe in tow if it can be moved.
 */
export class ReelHook extends Fx {
  private head: Phaser.GameObjects.Sprite;
  private g: Ink;
  private gx: number;
  private gy: number;
  private gone = 0;
  private phase: 'out' | 'drag' | 'back' = 'out';
  private foe: Bindable | null = null;
  private dragT = 0;
  private holdT = 0;
  private rattleT = 0;

  constructor(
    world: WorldScene,
    private from: () => { x: number; y: number },
    private ux: number,
    private uy: number,
    private range: number,
    private style: AquaStyle,
  ) {
    super(world, 99999);
    const f = from();
    this.gx = f.x + ux * 8;
    this.gy = f.y + uy * 4;
    this.head = this.own(world.add.sprite(this.gx, this.gy - HARPOON_H, `harpoon_${style.key}`, headingOf(ux, uy)).setPipeline('Lit'));
    this.g = this.ink(range + 40, range + 40);
  }

  /** Not a lasting effect: no timer for it. */
  timeLeft(): null {
    return null;
  }

  /** Still out (the hero keeps cranking). */
  get busy(): boolean {
    return !this.dead;
  }

  protected step(dt: number): void {
    const w = this.world;
    const f = this.from();
    const mx = f.x + this.ux * 8;
    const my = f.y + this.uy * 4;
    if (this.phase === 'out') {
      let move = (CHAIN_SPEED * dt) / 1000;
      while (move > 0 && this.phase === 'out') {
        const d = Math.min(3, move);
        move -= d;
        this.gx += this.ux * d;
        this.gy += this.uy * d;
        this.gone += d;
        const h = w.firstHurtbox((b) => b.alive && inFlight(b, this.gx, this.gy, HARPOON_H, 1.5));
        if (h) this.hook(h as Bindable, f);
        else if (this.gone >= this.range || !w.area.contains(this.gx, this.gy)) this.phase = 'back';
      }
    } else if (this.phase === 'drag') this.drag(dt, f);
    else {
      // Home along the chain.
      const dx = mx - this.gx;
      const dy = my - this.gy;
      const d = Math.hypot(dx, dy);
      const s = (RETRACT_SPEED * dt) / 1000;
      if (d <= s + 2) {
        this.destroy();
        return;
      }
      this.gx += (dx / d) * s;
      this.gy += (dy / d) * s;
    }
    this.rattleT -= dt;
    if (this.phase !== 'out' && this.rattleT <= 0) {
      this.rattleT = 140;
      sound.chainReel(w.pan(this.gx));
    }
    this.draw(mx, my);
  }

  /** It bites into a foe: hooked and dragged, or (a boss) yanked off balance. */
  private hook(h: Bindable, f: { x: number; y: number }): void {
    const w = this.world;
    const p = this.style.pal;
    h.hurt({ damage: HOOK_DAMAGE, heavy: false, knock: 0, fromX: f.x, fromY: f.y });
    w.debris([0xffffff, 0xe8eef8, p.hot], h.x, h.y - h.bodyY, 8, h.y + 20);
    sound.arrowHit(w.pan(h.x), false);
    this.gx = h.x;
    this.gy = h.y;
    if (h.bind?.(DRAG_HOLD + 100, 0)) {
      this.foe = h;
      this.phase = 'drag';
      this.holdT = DRAG_HOLD;
      return;
    }
    // Too big to be moved: the chain snaps taut, it staggers, and the harpoon tears free.
    const away = Math.hypot(h.x - f.x, h.y - f.y) || 1;
    h.hurt({ damage: YANK_DAMAGE, heavy: true, knock: YANK_KNOCK, fromX: h.x + ((h.x - f.x) / away) * 20, fromY: h.y + ((h.y - f.y) / away) * 20 });
    h.slow?.(YANK_SLOW, YANK_SLOW_MS, p.mid);
    w.cameras.main.shake(90, 0.0006);
    this.phase = 'back';
  }

  /** Cranked in: the foe slides along toward him, held fast, and lands dazed at his feet. */
  private drag(dt: number, f: { x: number; y: number }): void {
    const w = this.world;
    const h = this.foe!;
    this.dragT += dt;
    if (!h.alive) {
      this.phase = 'back';
      return;
    }
    this.holdT -= dt;
    if (this.holdT <= 0) {
      this.holdT = DRAG_HOLD;
      h.bind?.(DRAG_HOLD + 100, 0);
    }
    const dx = f.x - h.x;
    const dy = f.y - h.y;
    const d = Math.hypot(dx, dy) || 1;
    const s = Math.min(d - DRAG_STOP, (DRAG_SPEED * dt) / 1000);
    let stuck = false;
    if (s > 0 && h.shove) {
      const nx = h.x + (dx / d) * s;
      const ny = h.y + (dy / d) * s;
      if (w.walkable(nx, ny)) h.shove((dx / d) * s, (dy / d) * s);
      else stuck = true;
    }
    this.gx = h.x;
    this.gy = h.y;
    // Spray kicked up as it is dragged.
    if (Math.random() < dt / 50) w.debris(this.style.spray, h.x, h.y - 2, 1, h.y + 2, 'trail');
    if (d <= DRAG_STOP + 1.5 || stuck || this.dragT >= DRAG_MAX || !h.shove) {
      h.bind?.(LAND_STUN, 0);
      h.hurt({ damage: LAND_DAMAGE, heavy: false, knock: 0, fromX: f.x, fromY: f.y });
      w.debris([0xe8dcc0, 0xb8a888, ...this.style.spray], h.x, h.y - 2, 10, h.y + 4, 'burst');
      w.cameras.main.shake(80, 0.0005);
      sound.wrench(w.pan(h.x), true);
      this.foe = null;
      this.phase = 'back';
    }
  }

  /** The chain from the muzzle to the head: links in two tones, slack and sagging while it flies, straight while it hauls. */
  private draw(mx: number, my: number): void {
    const hx = this.gx;
    const hy = this.gy - HARPOON_H;
    const sx = mx;
    const sy = my - HARPOON_H;
    const g = this.g.begin((sx + hx) / 2, (sy + hy) / 2, Math.max(my, this.gy) + 1);
    const len = Math.hypot(hx - sx, hy - sy);
    const n = Math.max(1, Math.ceil(len / 1.5));
    const sag = this.phase === 'drag' ? 0 : Math.min(5, len * 0.05);
    const p = this.style.pal;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = sx + (hx - sx) * t;
      const y = sy + (hy - sy) * t + Math.sin(t * Math.PI) * sag;
      // The chain's shadow on the ground, faint.
      if (i % 2 === 0) g.put(x, y + HARPOON_H - Math.sin(t * Math.PI) * sag, 0x101418, 0.25);
      g.put(x, y, i % 2 ? 0x6c7688 : 0xc8d2e2);
      // Taut, a glint runs along it.
      if (this.phase === 'drag' && dither(i, Math.floor(this.t / 40)) < 0.12) g.put(x, y, p.core, 0.9);
    }
    g.end();
    const ang = this.phase === 'out' ? headingOf(this.ux, this.uy) : headingOf(hx - sx || this.ux, hy - sy || this.uy);
    this.head.setFrame(ang).setPosition(snap(hx), snap(hy)).setDepth(this.gy + 1).setVisible(this.phase !== 'drag');
  }
}
