import Phaser from 'phaser';
import { MOTH_TINTS } from '../../art/monsters';
import { snap } from '../display';
import { sound } from '../../audio';
import type { WorldScene } from '../../scenes/WorldScene';
import { Monster, type Target } from './Monster';

/** How high it flutters, and how high it climbs before a dive. */
const CRUISE = 11;
const CLIMB = 7;
const WINDUP = 640;
const DIVE_SPEED = 200;
const RECOVER = 820;
const DAMAGE = 10;
/** It circles its target at about this distance. */
const ORBIT = 54;

/**
 * The glowmoth: a big soft moth that flutters above the forest floor,
 * circling its target. Its wing-spots flare as it climbs, then it dives
 * straight at where the player stood and sweeps up again. Fragile: any
 * blow knocks it out of the air for a moment.
 */
export class Glowmoth extends Monster {
  private phase = Math.random() * 1000;
  private spin = Math.random() < 0.5 ? 1 : -1;
  private ux = 0;
  private uy = 0;
  private struck = false;
  private halo: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'glowmoth',
      hp: 32,
      radius: 6,
      bodyY: 7,
      speed: 50,
      sight: 128,
      leash: 260,
      mass: 0.6,
      barY: 33,
      debris: MOTH_TINTS,
    });
    this.hover = CRUISE;
    this.cooldown = 700;
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  update(dt: number, target: Target | null, daylight: number): void {
    this.phase += dt;
    // Bob on the air, except while climbing and diving, which set the height themselves.
    if (this.state !== 'windup' && this.state !== 'attack') {
      const goal = CRUISE + Math.sin(this.phase * 0.005) * 2;
      this.hover += (goal - this.hover) * Math.min(1, dt / 220);
    }
    super.update(dt, target, daylight);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.cooldown === 0 && dist < 104) {
      this.startWindup(target);
      return;
    }
    // Circle the target, drifting in or out toward the orbit.
    const rx = (target.x - this.x) / (dist || 1);
    const ry = (target.y - this.y) / (dist || 1);
    const pull = Phaser.Math.Clamp((dist - ORBIT) / 30, -1, 1);
    const wob = Math.sin(this.phase * 0.004) * 0.4;
    const ux = rx * pull - ry * this.spin * (0.8 + wob);
    const uy = ry * pull + rx * this.spin * (0.8 + wob);
    const l = Math.hypot(ux, uy) || 1;
    this.move(dt, ux / l, uy / l, this.stats.speed);
    this.face(target.x - this.x);
    if (Math.random() < dt / 4000) this.spin = -this.spin;
  }

  private startWindup(target: Target): void {
    this.enter('windup', WINDUP);
    this.play('windup', true);
    this.face(target.x - this.x);
    this.aim(target);
    this.halo = this.world.add.image(this.x, this.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7ff6e0).setAlpha(0);
    sound.buzz(this.world.pan(this.x));
  }

  private aim(target: Target): void {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const l = Math.hypot(dx, dy) || 1;
    this.ux = dx / l;
    this.uy = dy / l;
  }

  protected act(dt: number, target: Target | null, dist: number): void {
    if (this.state === 'windup') {
      const t = 1 - this.timer / WINDUP;
      if (target) {
        this.aim(target);
        this.face(target.x - this.x);
      }
      this.hover = CRUISE + CLIMB * Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.5);
      this.halo?.setPosition(snap(this.x), snap(this.y) - this.bodyY).setDepth(snap(this.y) + 0.3).setScale(0.4 + t * 0.5).setAlpha(t * 0.75);
      if (Math.random() < dt / 60) this.world.debris(MOTH_TINTS, this.x + (Math.random() - 0.5) * 16, this.y - this.bodyY + (Math.random() - 0.5) * 8, 1, this.y + 1, 'gather');
      if (this.timer <= 0) this.dive(target ? dist : 60);
    } else if (this.state === 'attack') {
      const s = (DIVE_SPEED * dt) / 1000;
      this.x += this.ux * s;
      this.y += this.uy * s;
      // Swoops low through the middle of the dive.
      this.hover += (3 - this.hover) * Math.min(1, dt / 70);
      if (!this.struck) {
        this.struck = this.world.hurtHeroAt(this.x, this.y - this.bodyY, this.radius + 1, { damage: DAMAGE, fromX: this.x - this.ux * 16, fromY: this.y - this.uy * 16, knock: 110 });
      }
      if (this.timer <= 0) this.pullUp();
    } else {
      // Recovering: flutter back up, drifting away from the dive.
      this.x -= (this.ux * 18 * dt) / 1000;
      this.y -= (this.uy * 18 * dt) / 1000;
      this.play('idle');
      if (this.timer <= 0) this.enter('chase', 0);
    }
  }

  private dive(dist: number): void {
    this.onInterrupted();
    this.struck = false;
    this.enter('attack', ((Math.min(dist, 120) + 26) / DIVE_SPEED) * 1000);
    this.pose('dive');
    this.world.debris(MOTH_TINTS, snap(this.x), snap(this.y) - this.bodyY, 8, this.y + 1, 'trail');
  }

  private pullUp(): void {
    this.enter('recover', RECOVER);
    this.cooldown = 1900 + Math.random() * 900;
    this.play('idle', true);
  }

  protected staggers(): boolean {
    return true;
  }

  protected onInterrupted(): void {
    this.halo?.destroy();
    this.halo = null;
  }
}
