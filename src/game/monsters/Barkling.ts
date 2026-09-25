import Phaser from 'phaser';
import { BARK_TINTS, THORN_H } from '../../art/monsters';
import { snap } from '../display';
import { sound } from '../../audio';
import type { Effect } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';
import { Monster, type Target } from './Monster';

const WINDUP = 1050;
/** The thorns' spot follows the target for this much of the windup, then stays put. */
const AIM_LOCK = 0.62;
const RECOVER = 760;
/** The thorns' reach: an ellipse on the ground (the danger ring, scaled). */
const REACH_X = 17;
const REACH_Y = 9;
const DAMAGE = 15;
/** Keeps about this far from its target, where its roots can reach. */
const RANGE = 96;
const NEAR = 38;

/**
 * The barkling: a stump come alive in the forest. It plods slowly and
 * can take a beating. It raises its arms while a ring of green light marks
 * the ground under its target, then slams them down and thorns burst up
 * there. The ring stops following a moment before the slam: time to step out.
 */
export class Barkling extends Monster {
  private ring: Phaser.GameObjects.Image | null = null;
  private aimX = 0;
  private aimY = 0;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'barkling',
      hp: 130,
      radius: 8,
      bodyY: 12,
      speed: 20,
      sight: 112,
      leash: 230,
      mass: 3,
      barY: 33,
      debris: BARK_TINTS,
    });
    this.cooldown = 900;
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.cooldown === 0 && dist < RANGE) this.startWindup(target);
    else if (dist > NEAR) this.move(dt, (target.x - this.x) / dist, (target.y - this.y) / dist, this.stats.speed);
    else this.stand(dt);
  }

  private startWindup(target: Target): void {
    this.enter('windup', WINDUP);
    this.play('windup', true);
    this.aimX = target.x;
    this.aimY = target.y;
    this.ring = this.world.add
      .image(snap(this.aimX), snap(this.aimY), 'danger_ring')
      .setTint(0x9ae05a)
      .setScale(REACH_X / 22, REACH_Y / 12)
      .setDepth(2)
      .setAlpha(0);
    sound.thud(this.world.pan(this.x));
  }

  protected act(_dt: number, target: Target | null): void {
    if (this.state === 'windup') {
      const t = 1 - this.timer / WINDUP;
      if (target && t < AIM_LOCK) {
        // Creeps after the target rather than snapping to it.
        this.aimX += (target.x - this.aimX) * 0.12;
        this.aimY += (target.y - this.aimY) * 0.12;
        this.face(target.x - this.x);
      }
      const locked = t >= AIM_LOCK;
      const blink = locked ? 0.6 + 0.4 * Math.sin(t * t * 60) : 0.8;
      this.ring?.setPosition(snap(this.aimX), snap(this.aimY)).setAlpha((0.2 + t * 0.65) * blink);
      if (this.timer <= 0) this.slam();
    } else if (this.timer <= 0) {
      this.enter('chase', 0);
    }
  }

  private slam(): void {
    this.onInterrupted();
    const x = snap(this.aimX);
    const y = snap(this.aimY);
    this.play('slam', true);
    this.world.addEffect(new Thorns(this.world, x, y));
    this.world.debris(BARK_TINTS, x, y - 4, 16, y + 2);
    this.world.hurtHeroInEllipse(x, y, REACH_X, REACH_Y, { damage: DAMAGE, fromX: x, fromY: y + 4, knock: 120 });
    this.world.cameras.main.shake(110, 0.0005);
    sound.thud(this.world.pan(x), true);
    this.enter('recover', RECOVER);
    this.cooldown = 2400 + Math.random() * 900;
  }

  protected onInterrupted(): void {
    this.ring?.destroy();
    this.ring = null;
  }
}

const THORN_LIFE = 720;

/** Wooden thorns bursting from the ground, then sinking back. */
class Thorns implements Effect {
  dead = false;
  private sprite: Phaser.GameObjects.Image;
  private t = 0;

  constructor(world: WorldScene, x: number, y: number) {
    this.sprite = world.add.image(x, y + 2, 'thorns', 't0').setOrigin(0.5, 20 / THORN_H).setPipeline('Lit').setDepth(y + 2);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const t = this.t;
    this.sprite.setFrame(t < 60 ? 't0' : t < 380 ? 't1' : 't2');
    if (t > 520) this.sprite.setAlpha(1 - (t - 520) / (THORN_LIFE - 520));
    if (t >= THORN_LIFE) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
  }
}
