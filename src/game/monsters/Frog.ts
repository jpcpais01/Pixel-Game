import Phaser from 'phaser';
import { snap } from '../display';
import { sound } from '../../audio';
import type { Effect } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';
import { Monster, type Target } from './Monster';

const VENOM_TINTS = [0xf4fff0, 0xb6ffa0, 0x4fe08a, 0xdff8ff];
const HOP_TIME = 360;
const HOP_HEIGHT = 5;
const WINDUP = 620;
const SPIT_RECOVER = 520;
/** It likes to keep this far from its target: close enough to spit, too far to be hit. */
const NEAR = 42;
const FAR = 88;

/**
 * The glimmer frog: a small blue frog that hops around its target at a
 * distance and spits globs of sparkly venom. Its throat swells and glows
 * before each spit, so a watchful player can step aside.
 */
export class Frog extends Monster {
  /** Hop in progress: time left and its direction. */
  private hopT = 0;
  private hopX = 0;
  private hopY = 0;
  private rest = 0;
  private strafe = Math.random() < 0.5 ? 1 : -1;
  private halo: Phaser.GameObjects.Image | null = null;
  private aimX = 0;
  private aimY = 0;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'frog',
      hp: 34,
      radius: 6,
      bodyY: 6,
      speed: 62,
      sight: 118,
      leash: 230,
      mass: 0.8,
      barY: 19,
      debris: [0x7cc8ff, 0x3a8ae6, 0xdff8ff, 0xb6ffa0],
    });
    this.cooldown = 600;
  }

  get pinned(): boolean {
    return this.hopT > 0;
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.hopT > 0 || this.rest > 0) {
      this.stand(dt);
      return;
    }
    const dx = (target.x - this.x) / (dist || 1);
    const dy = (target.y - this.y) / (dist || 1);
    if (dist > FAR) this.move(dt, dx, dy, this.stats.speed);
    else if (dist < NEAR) this.move(dt, -dx * 0.8 + -dy * 0.6 * this.strafe, -dy * 0.8 + dx * 0.6 * this.strafe, this.stats.speed);
    else if (this.cooldown === 0) this.startWindup(target);
    else if (Math.random() < dt / 900) {
      // Shuffle sideways between spits, so it isn't a sitting target.
      this.strafe = -this.strafe;
      this.move(dt, -dy * this.strafe, dx * this.strafe, this.stats.speed);
    } else this.stand(dt);
  }

  private startWindup(target: Target): void {
    this.enter('windup', WINDUP);
    this.face(target.x - this.x);
    this.play('windup', true);
    this.halo = this.world.add.image(this.x, this.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7dff9a).setAlpha(0);
    sound.gulp(this.world.pan(this.x));
  }

  protected act(dt: number, target: Target | null): void {
    if (this.state === 'windup') {
      // Aim tracks the target until the moment it spits.
      if (target) {
        this.face(target.x - this.x);
        this.aimX = target.x;
        this.aimY = target.y - 10;
      }
      const t = 1 - this.timer / WINDUP;
      const m = this.mouth();
      this.halo?.setPosition(m.x, m.y + 2).setDepth(snap(this.y) + 0.3).setScale(0.35 + t * 0.4).setAlpha(0.2 + t * 0.6);
      if (Math.random() < dt / 70) this.world.debris(VENOM_TINTS, m.x + (Math.random() - 0.5) * 10, m.y + (Math.random() - 0.5) * 8, 1, this.y + 1, 'gather');
      if (this.timer <= 0) this.spit();
    } else if (this.timer <= 0) {
      this.enter('chase', 0);
      this.rest = 200;
    }
  }

  private spit(): void {
    this.onInterrupted();
    const m = this.mouth();
    const dx = this.aimX - m.x;
    const dy = this.aimY - m.y;
    const l = Math.hypot(dx, dy) || 1;
    this.world.addEffect(new Venom(this.world, m.x, m.y, dx / l, dy / l));
    this.play('spit', true);
    this.enter('recover', SPIT_RECOVER);
    this.cooldown = 1600 + Math.random() * 900;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    sound.spit(this.world.pan(m.x));
  }

  protected onInterrupted(): void {
    this.halo?.destroy();
    this.halo = null;
  }

  /** The mouth, in world pixels. */
  private mouth(): { x: number; y: number } {
    return { x: snap(this.x) + (this.facing === 'r' ? 7 : -7), y: snap(this.y) - 6 - this.hover };
  }

  /** Frogs hop: a crouch, a leap in a fixed direction, and a short rest. */
  protected move(dt: number, ux: number, uy: number, speed: number): void {
    if (this.hopT <= 0 && this.rest <= 0) {
      const l = Math.hypot(ux, uy) || 1;
      this.hopX = ux / l;
      this.hopY = uy / l;
      this.hopT = HOP_TIME;
      this.face(ux);
      if (Math.random() < 0.3) sound.hop(this.world.pan(this.x));
    }
    this.hopStep(dt, speed);
  }

  protected stand(dt: number): void {
    if (this.hopT > 0) this.hopStep(dt, this.stats.speed);
    else {
      this.rest = Math.max(0, this.rest - dt);
      if (this.rest > 120) this.pose('crouch');
      else this.play('idle');
    }
  }

  private hopStep(dt: number, speed: number): void {
    if (this.hopT > 0) {
      const s = (speed * 1.9 * Math.min(dt, this.hopT)) / 1000;
      this.x += this.hopX * s;
      this.y += this.hopY * s;
      this.hopT -= dt;
      const p = 1 - Math.max(0, this.hopT) / HOP_TIME;
      this.hover = Math.sin(p * Math.PI) * HOP_HEIGHT;
      this.pose(p < 0.12 || p > 0.88 ? 'crouch' : 'leap');
      if (this.hopT <= 0) {
        this.hover = 0;
        this.rest = 260 + Math.random() * 260;
        this.pose('crouch');
      }
    } else {
      this.rest = Math.max(0, this.rest - dt);
      if (this.rest > 120) this.pose('crouch');
      else this.play('idle');
    }
  }

  protected staggers(): boolean {
    return true;
  }
}

const VENOM_SPEED = 100;
const VENOM_RANGE = 150;
const VENOM_DAMAGE = 9;

/** A glob of sparkly venom: flies straight, bursts on the player or when it runs out. */
export class Venom implements Effect {
  dead = false;
  private sprite: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private travelled = 0;
  private trail = 0;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
  ) {
    this.sprite = world.add.image(x, y, 'venom').setBlendMode(Phaser.BlendModes.ADD);
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x4fe08a).setScale(0.55).setAlpha(0.7);
  }

  update(dt: number): void {
    if (this.dead) return;
    const s = (VENOM_SPEED * dt) / 1000;
    this.x += this.ux * s;
    this.y += this.uy * s;
    this.travelled += s;
    // A little wobble, so it reads as liquid rather than a bolt.
    const wob = Math.sin(this.travelled * 0.35) * 0.6;
    const depth = this.y + 12;
    this.sprite.setPosition(snap(this.x), snap(this.y + wob)).setDepth(depth).setAngle(this.travelled * 6);
    this.halo.setPosition(this.x, this.y + wob).setDepth(depth - 0.1);
    this.trail -= dt;
    if (this.trail <= 0) {
      this.trail = 45;
      this.world.debris(VENOM_TINTS, this.x, this.y, 1, depth - 0.2, 'trail');
    }
    const hit = this.world.hurtHeroAt(this.x, this.y, 5, { damage: VENOM_DAMAGE, fromX: this.x - this.ux * 8, fromY: this.y - this.uy * 8, knock: 70 });
    if (hit || this.travelled > VENOM_RANGE || !this.world.monsterBounds.contains(this.x, this.y)) this.splash();
  }

  private splash(): void {
    this.world.debris(VENOM_TINTS, this.x, this.y, 12, this.y + 12);
    sound.splash(this.world.pan(this.x));
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
    this.halo.destroy();
  }
}
