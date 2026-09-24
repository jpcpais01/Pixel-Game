import Phaser from 'phaser';
import { SPORE_COLS } from '../../art/monsters';
import { snap } from '../display';
import { sound } from '../../audio';
import type { WorldScene } from '../../scenes/WorldScene';
import { Monster, type Target } from './Monster';

const WINDUP = 720;
const RECOVER = 650;
/** The burst's reach, an ellipse on the ground (matches the danger_ring texture). */
const REACH_X = 22;
const REACH_Y = 12;
const DAMAGE = 12;

/**
 * The puffcap: a little glowing mushroom that waddles up to the player and
 * swells until it bursts in a cloud of spores. A ring on the ground shows
 * how far the burst will reach while it swells. They come in small groups.
 */
export class Puffcap extends Monster {
  private ring: Phaser.GameObjects.Image | null = null;
  private halo: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'puffcap',
      hp: 40,
      radius: 6,
      bodyY: 8,
      speed: 36,
      sight: 104,
      leash: 210,
      mass: 1.2,
      barY: 23,
      debris: SPORE_COLS,
    });
    this.cooldown = 400;
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (dist < 17 && this.cooldown === 0) this.startWindup();
    else if (dist > 10) this.move(dt, (target.x - this.x) / dist, (target.y - this.y) / dist, this.stats.speed);
    else this.stand(dt);
  }

  private startWindup(): void {
    this.enter('windup', WINDUP);
    this.play('windup', true);
    this.ring = this.world.add.image(snap(this.x), snap(this.y), 'danger_ring').setTint(0xc86cff).setDepth(2).setAlpha(0);
    this.halo = this.world.add.image(snap(this.x), snap(this.y) - 12, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6ff0e0).setAlpha(0);
    sound.swell(this.world.pan(this.x));
  }

  protected act(_dt: number, _target: Target | null): void {
    if (this.state === 'windup') {
      const t = 1 - this.timer / WINDUP;
      // Blinks faster as the burst nears.
      const blink = 0.55 + 0.45 * Math.sin(t * t * 40);
      this.ring?.setPosition(snap(this.x), snap(this.y)).setAlpha((0.25 + t * 0.6) * blink);
      this.halo?.setPosition(snap(this.x), snap(this.y) - 12).setDepth(snap(this.y) + 0.3).setScale(0.5 + t * 0.6).setAlpha(t * 0.7);
      if (this.timer <= 0) this.burst();
    } else if (this.timer <= 0) {
      this.enter('chase', 0);
    }
  }

  private burst(): void {
    this.onInterrupted();
    const x = snap(this.x);
    const y = snap(this.y);
    this.world.debris(SPORE_COLS, x, y - 8, 26, y + 12, 'spores');
    this.world.hurtHeroInEllipse(x, y, REACH_X, REACH_Y, { damage: DAMAGE, fromX: x, fromY: y, knock: 110 });
    this.play('burst', true);
    this.enter('recover', RECOVER);
    this.cooldown = 1900 + Math.random() * 700;
    sound.puff(this.world.pan(x));
  }

  protected onInterrupted(): void {
    this.ring?.destroy();
    this.halo?.destroy();
    this.ring = this.halo = null;
  }
}
