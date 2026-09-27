import Phaser from 'phaser';
import { PET_H, PET_OX, PET_OY, PET_W } from '../art/pets';
import { snap } from './display';
import { sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import type { Hurtbox, Strike } from './combat';
import type { PetDef } from './pets';
import { sound } from '../audio';

// The companion in the world: it trots, hops or flutters after the hero,
// keeping to one side a little behind, turning to face where it goes. It
// cheers when gems are picked up. The wyrmling spits crystal shards at foes
// that come near the hero; the phoenix chick burns up once a run to lift the
// hero back to their feet instead of letting them fall.

/** Where it likes to be: this far to the side of the hero, and a touch behind. */
const SIDE = 16;
const BEHIND = 6;
/** It moves faster the further it has fallen behind: this share of the gap each second, up to a top speed. */
const CATCH_UP = 4.5;
const TOP_SPEED = 260;
/** Left this far behind (the hero rose at the spawn, or stepped through a door), it pops over. */
const LOST = 260;
/** Flyers hover this high, bobbing; hoppers hop this high every this many px of ground. */
const HOVER = 14;
const HOP_H = 5;
const HOP_EVERY = 22;

/** The wyrmling's shards: how often, how far it looks for a foe, their speed and bite. */
const SPIT_EVERY = 1600;
const SPIT_RANGE = 120;
const SHARD_SPEED = 230;
const SHARD_LIFE = 900;
const SHARD_DAMAGE = 6;
const AMETHYST = [0xffffff, 0xe0c0ff, 0xc890ff, 0x8a50e8];

/** What the companion needs of the world. */
export interface CompanionHost {
  add: Phaser.GameObjects.GameObjectFactory;
  lights: Phaser.GameObjects.LightsManager;
  tweens: Phaser.Tweens.TweenManager;
  firstHurtbox(test: (h: Hurtbox) => boolean): Hurtbox | null;
  strikeAt(x: number, y: number, strike: Strike): boolean;
  debris(tints: number[], x: number, y: number, count: number, depth: number, style?: 'burst' | 'spores' | 'trail' | 'gather'): void;
  popNumber(x: number, y: number, text: string, tint: number): void;
}

interface Shard {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export class Companion {
  x: number;
  y: number;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private light: Phaser.GameObjects.Light;
  /** Which side of the hero it keeps to: it swaps when the hero walks across it. */
  private side = 1;
  private facing = 1;
  /** Ground covered, for the hopping gait; and a cheer's leap, easing off. */
  private stride = 0;
  private leap = 0;
  private spitT = SPIT_EVERY;
  private recoil = 0;
  private shards: Shard[] = [];
  /** The phoenix's rekindling, used up for this run. */
  private spent = false;
  private t = Math.random() * 1000;

  constructor(
    private world: CompanionHost,
    readonly def: PetDef,
    x: number,
    y: number,
  ) {
    this.x = x + SIDE;
    this.y = y + BEHIND;
    const add = world.add;
    const ox = PET_OX / PET_W;
    const oy = PET_OY / PET_H;
    this.shadow = add.image(x, y, 'shadow').setDepth(1).setScale(0.8, 0.8);
    this.castShadow = sunShadow(add.sprite(x, y, 'pets_s', `${def.id}_0`).setOrigin(ox, oy));
    this.body = add.sprite(x, y, 'pets', `${def.id}_0`).setOrigin(ox, oy).setPipeline('Lit').play(`pet_${def.id}`);
    this.glowLayer = add.sprite(x, y, 'pets_e', `${def.id}_0`).setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.light = world.lights.addLight(x, y - 10, 46, def.tint, 0.45);
  }

  /** Each frame, with where the hero stands and whether they're down (it waits by them). */
  update(dt: number, heroX: number, heroY: number, heroDown: boolean, daylight: number): void {
    this.t += dt;
    // Keep to the side of the hero the companion is already on, unless the hero crosses over.
    const dxh = this.x - heroX;
    if (Math.abs(dxh) > SIDE * 0.5) this.side = Math.sign(dxh);
    const gx = heroX + this.side * SIDE;
    const gy = heroY + BEHIND;
    const dx = gx - this.x;
    const dy = gy - this.y;
    const d = Math.hypot(dx, dy);
    if (d > LOST) {
      this.x = gx;
      this.y = gy;
      this.world.debris([0xffffff, this.def.tint], snap(gx), snap(gy) - 8, 10, gy + 10, 'spores');
    } else if (d > 2) {
      const step = Math.min(d, Math.min(TOP_SPEED, d * CATCH_UP) * (dt / 1000));
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      this.stride += step;
      if (Math.abs(dx) > 3) this.facing = Math.sign(dx);
    } else if (!heroDown) {
      // Idle beside the hero: look the way the hero is from here.
      this.facing = this.side > 0 ? -1 : 1;
    }
    this.leap = Math.max(0, this.leap - dt / 500);
    this.recoil = Math.max(0, this.recoil - dt / 200);

    if (this.def.fights && !heroDown) this.fight(dt, heroX, heroY);
    this.updateShards(dt);
    this.sync(daylight, d);
  }

  /** How high off the ground it is now, by its gait. */
  private height(moving: boolean): number {
    const cheer = Math.sin(this.leap * Math.PI) * 8;
    switch (this.def.gait) {
      case 'fly':
        return HOVER + Math.sin(this.t * 0.004) * 2 + cheer;
      case 'hop':
        return (moving ? Math.abs(Math.sin((this.stride / HOP_EVERY) * Math.PI)) * HOP_H : 0) + cheer;
      default:
        return (moving ? Math.abs(Math.sin((this.stride / 10) * Math.PI)) : 0) + cheer;
    }
  }

  private sync(daylight: number, gap: number): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const up = this.height(gap > 4);
    const hy = snap(ry - up);
    const flip = this.facing < 0;
    // A hopper squashes as it lands and stretches in the air.
    const squash = this.def.gait === 'hop' && gap > 4 ? 1 + (up / HOP_H - 0.5) * 0.12 : 1;
    const back = this.recoil * -this.facing * 2;
    this.body.setPosition(rx + back, hy).setDepth(ry).setFlipX(flip).setScale(1 / squash, squash);
    this.glowLayer.setPosition(rx + back, hy).setDepth(ry + 0.1).setFrame(this.body.frame.name).setFlipX(flip).setScale(1 / squash, squash);
    const lift = Math.min(1, up / 16);
    this.shadow.setPosition(rx, ry - 1).setAlpha(0.7 - lift * 0.35).setScale(0.8 - lift * 0.25, 0.8 - lift * 0.25);
    this.castShadow.setPosition(rx, ry - 1).setFrame(this.body.frame.name).setFlipX(flip).setAlpha(SUN_SHADOW_ALPHA * daylight * (1 - lift * 0.6));
    this.light.setPosition(rx, hy - 8);
    this.light.intensity = 0.45 + 0.1 * Math.sin(this.t * 0.005) + this.leap * 0.6;
  }

  /** Gems were picked up: it leaps for joy in a puff of its colour. */
  cheer(): void {
    this.leap = 1;
    this.world.debris([0xffffff, this.def.tint], snap(this.x), snap(this.y) - 10, 8, this.y + 10, 'spores');
  }

  /**
   * The phoenix chick's gift: the hero is about to fall. Once a run, it
   * bursts into flame and lifts them back up instead. Returns whether it did.
   */
  rekindle(heroX: number, heroY: number): boolean {
    if (!this.def.rebirth || this.spent) return false;
    this.spent = true;
    const fire = [0xffffff, 0xfff0a8, 0xffb850, 0xff6a2a];
    this.world.debris(fire, snap(heroX), snap(heroY) - 12, 40, heroY + 20, 'burst');
    this.world.debris(fire, snap(heroX), snap(heroY) - 8, 24, heroY + 20, 'spores');
    this.world.debris(fire, snap(this.x), snap(this.y) - 14, 16, this.y + 10, 'burst');
    this.world.popNumber(snap(heroX), snap(heroY) - 46, 'REKINDLED!', 0xffc860);
    this.leap = 1;
    // Spent, it burns low for the rest of the run: a dimmer, smaller glow.
    this.world.tweens.add({ targets: this.glowLayer, alpha: 0.45, duration: 1200, delay: 400 });
    sound.revive();
    return true;
  }

  /** The wyrmling: every so often, a shard of amethyst at a foe near the hero. */
  private fight(dt: number, heroX: number, heroY: number): void {
    this.spitT -= dt;
    if (this.spitT > 0) return;
    const mx = this.x;
    const my = this.y - HOVER - 6;
    const foe = this.world.firstHurtbox((h) => Math.hypot(h.x - heroX, h.y - heroY) < SPIT_RANGE && !h.airborne);
    if (!foe) {
      // Nothing in reach: look again soon.
      this.spitT = 200;
      return;
    }
    this.spitT = SPIT_EVERY;
    const tx = foe.x;
    const ty = foe.y - foe.bodyY;
    const l = Math.hypot(tx - mx, ty - my) || 1;
    this.facing = tx >= mx ? 1 : -1;
    this.recoil = 1;
    const img = this.world.add.image(mx, my, 'spark').setBlendMode(Phaser.BlendModes.ADD).setTint(0xd8b0ff).setScale(1.4);
    this.shards.push({ img, x: mx, y: my, vx: ((tx - mx) / l) * SHARD_SPEED, vy: ((ty - my) / l) * SHARD_SPEED, life: SHARD_LIFE });
    this.world.debris(AMETHYST, snap(mx + this.facing * 5), snap(my), 5, this.y + 10, 'burst');
    sound.cast();
  }

  private updateShards(dt: number): void {
    for (const s of this.shards) {
      s.life -= dt;
      s.x += (s.vx * dt) / 1000;
      s.y += (s.vy * dt) / 1000;
      s.img.setPosition(snap(s.x), snap(s.y)).setDepth(s.y + 20).setRotation(Math.atan2(s.vy, s.vx));
      if (Math.random() < 0.5) this.world.debris(AMETHYST, snap(s.x), snap(s.y), 1, s.y + 20, 'trail');
      if (this.world.strikeAt(s.x, s.y, { damage: SHARD_DAMAGE, knock: 40, fromX: s.x - s.vx * 0.05, fromY: s.y - s.vy * 0.05 })) {
        this.world.debris(AMETHYST, snap(s.x), snap(s.y), 8, s.y + 20, 'burst');
        s.life = 0;
      }
      if (s.life <= 0) s.img.destroy();
    }
    this.shards = this.shards.filter((s) => s.life > 0);
  }

  destroy(): void {
    for (const s of this.shards) s.img.destroy();
    this.shards = [];
    for (const o of [this.body, this.glowLayer, this.shadow, this.castShadow]) o.destroy();
    this.world.lights.removeLight(this.light);
  }
}
