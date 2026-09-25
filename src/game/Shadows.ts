import Phaser from 'phaser';
import type { Effect } from './Slash';
import type { Hurtbox } from './combat';
import type { WorldScene } from '../scenes/WorldScene';

// The rogue's effects: the bleeding his daggers leave, the puff of smoke he
// vanishes in, and the fading echoes of him left along a shadowstep. All of
// them are a handful of plain sprites on shared textures, so they cost next
// to nothing on a phone.

/** How a rogue's shadow looks: smoke texture, echo colour, and whether the echoes glow. */
export interface ShadowStyle {
  /** Smoke puff texture key. */
  smoke: string;
  /** Echo tint, and whether echoes are added as light (the dancer's) or laid down as shade. */
  echo: number;
  glow: boolean;
}

/**
 * Bleeding in the monsters the daggers opened: every TICK ms each one takes
 * DAMAGE per stack, crimson drops flicking off it, until it closes. Fresh
 * cuts stack up to `maxStacks` and renew the time; the finisher can tear the
 * whole wound open at once (take).
 */
export class Bleed {
  static readonly TICK = 450;
  static readonly DAMAGE = 1.5;
  static readonly TIME = 3200;
  private wounds = new Map<Hurtbox, { left: number; tickIn: number; stacks: number }>();

  constructor(
    private world: WorldScene,
    private maxStacks = 4,
  ) {}

  cut(h: Hurtbox, stacks = 1): void {
    const w = this.wounds.get(h);
    if (w) {
      w.left = Bleed.TIME;
      w.stacks = Math.min(this.maxStacks, w.stacks + stacks);
    } else {
      this.wounds.set(h, { left: Bleed.TIME, tickIn: Bleed.TICK, stacks: Math.min(this.maxStacks, stacks) });
    }
  }

  /** Close the wound and say how deep it was. */
  take(h: Hurtbox): number {
    const w = this.wounds.get(h);
    this.wounds.delete(h);
    return w?.stacks ?? 0;
  }

  update(dt: number): void {
    for (const [h, w] of this.wounds) {
      if (!h.alive) {
        this.wounds.delete(h);
        continue;
      }
      w.tickIn -= dt;
      w.left -= dt;
      if (w.tickIn <= 0) {
        w.tickIn += Bleed.TICK;
        const by = h.y - h.bodyY;
        h.hurt({ damage: Math.round(Bleed.DAMAGE * w.stacks), heavy: false, knock: 0, fromX: h.x, fromY: by, poison: 0xff6a62 });
        this.world.debris([0xffc0b0, 0xf04050, 0xa01830], Math.round(h.x), Math.round(by), 1 + Math.min(3, w.stacks), h.y + 12, 'burst');
      }
      if (w.left <= 0) this.wounds.delete(h);
    }
  }
}

/** A puff of smoke on the ground at (x, y): a few lumps swelling, drifting up and thinning out. */
export class SmokePuff implements Effect {
  dead = false;
  private lumps: { img: Phaser.GameObjects.Image; dx: number; dy: number; rise: number; s: number }[] = [];
  private age = 0;
  private readonly duration = 560;

  constructor(world: WorldScene, private x: number, private y: number, style: ShadowStyle, big = false) {
    const n = big ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const r = (big ? 7 : 5) * (0.5 + Math.random() * 0.5);
      const dx = Math.cos(a) * r;
      const dy = Math.sin(a) * r * 0.5 - 6;
      const img = world.add.image(x + dx, y + dy, style.smoke).setDepth(y + 8 + i * 0.01);
      if (style.glow) img.setBlendMode(Phaser.BlendModes.SCREEN);
      this.lumps.push({ img, dx, dy, rise: 4 + Math.random() * 5, s: 0.7 + Math.random() * 0.35 });
    }
    this.update(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    const t = this.age / this.duration;
    if (t >= 1) {
      this.destroy();
      return;
    }
    const grow = 1 - Math.pow(1 - t, 3);
    for (const l of this.lumps) {
      // Whole pixels only, and whole-step scales, so the puff stays crisp.
      const s = Math.round((l.s * (0.6 + grow * 0.7)) * 4) / 4;
      l.img
        .setPosition(Math.round(this.x + l.dx * (1 + grow * 0.6)), Math.round(this.y + l.dy - grow * l.rise))
        .setScale(s)
        .setAlpha(0.9 * (1 - t * t));
    }
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const l of this.lumps) l.img.destroy();
  }
}

/** A fading echo of the rogue where he just was: his frame as a flat silhouette. */
export class Afterimage implements Effect {
  dead = false;
  private img: Phaser.GameObjects.Image;
  private age = 0;

  constructor(world: WorldScene, x: number, y: number, key: string, frame: string, originX: number, originY: number, style: ShadowStyle, private readonly duration = 280) {
    this.img = world.add.image(x, y, `${key}_w`, frame).setOrigin(originX, originY).setTint(style.echo).setDepth(y - 0.2);
    if (style.glow) this.img.setBlendMode(Phaser.BlendModes.ADD);
    this.update(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    const t = this.age / this.duration;
    if (t >= 1) {
      this.destroy();
      return;
    }
    this.img.setAlpha(0.55 * (1 - t));
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
  }
}

