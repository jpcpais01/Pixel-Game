import Phaser from 'phaser';
import { snap } from '../display';
import { sound } from '../../audio';
import type { WorldScene } from '../../scenes/WorldScene';
import { Monster, type Target } from './Monster';

const GOLD_TINTS = [0xfff3b0, 0xf0c650, 0xc0862a, 0xffb050];
const WINDUP = 900;
const SHORT_WINDUP = 520;
/** The aim follows the target for this much of the windup, then locks. */
const AIM_LOCK = 0.7;
const CHARGE_SPEED = 210;
const CHARGE_DAMAGE = 16;
const DAZED = 950;
const DAZED_WALL = 1500;
const DOTS = 7;

/**
 * The gold beetle: a slow, heavily armoured rhinoceros beetle. It lumbers
 * toward the player, stamps and lowers its glowing horn while a trail of
 * embers marks its path on the ground, then takes flight and rams straight
 * along it. Afterwards it is left dazed for a moment: the time to hit it.
 */
export class Beetle extends Monster {
  private ux = 1;
  private uy = 0;
  private charge = 0;
  private struck = false;
  private dots: Phaser.GameObjects.Image[] = [];
  private windup = WINDUP;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'beetle',
      hp: 110,
      radius: 9,
      bodyY: 7,
      speed: 26,
      sight: 112,
      leash: 240,
      mass: 3.5,
      barY: 22,
      debris: GOLD_TINTS,
    });
    this.cooldown = 800;
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  protected chase(dt: number, target: Target, dist: number): void {
    const dx = (target.x - this.x) / (dist || 1);
    const dy = (target.y - this.y) / (dist || 1);
    if (this.cooldown === 0 && dist < 100) this.startWindup(target, dist);
    else if (dist > 14) this.move(dt, dx, dy, this.stats.speed);
    else this.stand(dt);
  }

  private startWindup(target: Target, dist: number): void {
    this.windup = dist < 34 ? SHORT_WINDUP : WINDUP;
    this.enter('windup', this.windup);
    this.aim(target);
    this.play('windup', true);
    for (let i = 0; i < DOTS; i++) this.dots.push(this.world.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff9a2e).setScale(0.16).setDepth(2).setAlpha(0));
    sound.chitter(this.world.pan(this.x));
  }

  private aim(target: Target): void {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const l = Math.hypot(dx, dy) || 1;
    this.ux = dx / l;
    this.uy = dy / l;
    // Overshoot the target a little, so it runs through where the player stood.
    this.charge = Phaser.Math.Clamp(l + 36, 50, 140);
    this.face(dx);
  }

  protected act(dt: number, target: Target | null): void {
    if (this.state === 'windup') {
      const t = 1 - this.timer / this.windup;
      if (target && t < AIM_LOCK) this.aim(target);
      this.drawTelegraph(t);
      if (this.timer <= 0) this.launch();
    } else if (this.state === 'attack') {
      this.fly(dt);
    } else if (this.timer <= 0) {
      this.enter('chase', 0);
      this.play('walk');
    }
  }

  /** A line of embers on the ground along the charge, pulsing toward its end. */
  private drawTelegraph(t: number): void {
    const locked = t >= AIM_LOCK;
    this.dots.forEach((d, i) => {
      const k = (i + 1) / DOTS;
      const x = this.x + this.ux * this.charge * k;
      const y = this.y + this.uy * this.charge * k;
      const wave = Math.max(0, Math.sin((t * 5 - k) * Math.PI));
      d.setPosition(snap(x), snap(y) - 1).setAlpha(Math.min(1, t * 3) * (locked ? 0.7 + wave * 0.3 : 0.25 + wave * 0.5));
      d.setScale(locked ? 0.2 : 0.15);
    });
  }

  private launch(): void {
    this.clearDots();
    this.enter('attack', (this.charge / CHARGE_SPEED) * 1000);
    this.struck = false;
    this.play('fly', true);
    sound.buzz(this.world.pan(this.x));
  }

  private fly(dt: number): void {
    const s = (CHARGE_SPEED * dt) / 1000;
    const b = this.world.monsterBounds;
    const nx = this.x + this.ux * s;
    const ny = this.y + this.uy * s;
    const wall = nx < b.left || nx > b.right || ny < b.top || ny > b.bottom || !this.world.walkable(nx, ny);
    this.x = nx;
    this.y = ny;
    const p = Phaser.Math.Clamp(1 - this.timer / Math.max(1, (this.charge / CHARGE_SPEED) * 1000), 0, 1);
    this.hover = 2 + Math.sin(p * Math.PI) * 4;
    if (!this.struck) {
      this.struck = this.world.hurtHeroAt(this.x, this.y - this.bodyY, this.radius, { damage: CHARGE_DAMAGE, fromX: this.x - this.ux * 20, fromY: this.y - this.uy * 20, knock: 190 });
      if (this.struck) this.world.cameras.main.shake(140, 0.0007);
    }
    if (wall || this.timer <= 0) this.land(wall);
  }

  private land(wall: boolean): void {
    this.hover = 0;
    this.enter('recover', wall ? DAZED_WALL : DAZED);
    this.cooldown = 2400 + Math.random() * 800;
    this.play('dazed');
    this.world.debris(GOLD_TINTS, snap(this.x), snap(this.y), wall ? 10 : 5, this.y + 1);
    sound.thud(this.world.pan(this.x), wall);
    if (wall) this.world.cameras.main.shake(120, 0.0004);
  }

  /** Armour: only a heavy blow while it stands dazed staggers it. */
  protected staggers(): boolean {
    return this.state === 'recover';
  }

  protected onInterrupted(): void {
    this.clearDots();
    this.hover = 0;
  }

  private clearDots(): void {
    for (const d of this.dots) d.destroy();
    this.dots = [];
  }
}
