import Phaser from 'phaser';
import { snap } from './display';
import { ARCANE_STYLE, type SpellStyle } from './spells';

const SPEED = 175;
const LIFETIME = 1100;

/** How a ball flies, and what happens where it bursts (the pyromancer's fireball blasts). */
export interface BallKind {
  speed?: number;
  lifetime?: number;
  /** Called once where the ball bursts, whether it struck something or not. */
  onBurst?: (x: number, y: number) => void;
}

/** The wizard's first attack: a crackling ball of light with a sparkling trail. */
export class EnergyBall {
  x: number;
  y: number;
  dead = false;
  private scene: Phaser.Scene;
  private vx: number;
  private vy: number;
  private age = 0;
  private sprite: Phaser.GameObjects.Sprite;
  private halo: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private k: SpellStyle;
  private lifetime: number;
  readonly onBurst?: (x: number, y: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, dx: number, dy: number, style: SpellStyle = ARCANE_STYLE, kind: BallKind = {}) {
    this.scene = scene;
    this.k = style;
    this.x = x;
    this.y = y;
    const speed = kind.speed ?? SPEED;
    this.vx = dx * speed;
    this.vy = dy * speed;
    this.lifetime = kind.lifetime ?? LIFETIME;
    this.onBurst = kind.onBurst;
    this.sprite = scene.add.sprite(x, y, style.orb.texture, 'o0').setBlendMode(Phaser.BlendModes.ADD).play(style.orb.anim);
    this.halo = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(style.glow).setAlpha(0.8);
    this.light = scene.lights.addLight(x, y, 90, style.light, 2.2);
    this.trail = scene.add.particles(0, 0, 'spark', {
      lifespan: { min: 220, max: 460 },
      speed: { min: 3, max: 16 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: style.sparks,
      blendMode: Phaser.BlendModes.ADD,
      frequency: 16,
    });
    this.trail.startFollow(this.sprite);
    this.castFlash(x, y);
  }

  private castFlash(x: number, y: number): void {
    const flash = this.scene.lights.addLight(x, y, 60, this.k.flash, 3);
    this.scene.tweens.add({
      targets: flash,
      intensity: 0,
      radius: 110,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => this.scene.lights.removeLight(flash),
    });
  }

  update(dt: number, hitTest: (x: number, y: number) => boolean, bounds: Phaser.Geom.Rectangle): void {
    if (this.dead) return;
    this.age += dt;
    this.x += this.vx * (dt / 1000);
    this.y += this.vy * (dt / 1000);
    const depth = this.y + 20;
    this.sprite.setPosition(snap(this.x), snap(this.y)).setDepth(depth);
    const pulse = 1 + Math.sin(this.age * 0.03) * 0.08;
    this.halo.setPosition(this.x, this.y).setDepth(depth - 0.1).setScale(1.1 * pulse);
    this.light.setPosition(this.x, this.y);
    this.light.intensity = 2.0 + Math.sin(this.age * 0.05) * 0.3;
    this.trail.setDepth(depth - 0.2);

    if (hitTest(this.x, this.y) || this.age > this.lifetime || !bounds.contains(this.x, this.y)) this.explode();
  }

  explode(): void {
    if (this.dead) return;
    this.dead = true;
    const { scene } = this;
    const burst = scene.add
      .sprite(snap(this.x), snap(this.y), this.k.burst.texture, 'b0')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.y + 20)
      .play(this.k.burst.anim);
    burst.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => burst.destroy());
    const light = this.light;
    scene.tweens.add({
      targets: light,
      intensity: 0,
      radius: 150,
      duration: 380,
      ease: 'Quad.easeOut',
      onStart: () => {
        light.intensity = 4;
      },
      onComplete: () => scene.lights.removeLight(light),
    });
    this.sprite.destroy();
    this.halo.destroy();
    this.trail.stopFollow();
    this.trail.stop();
    this.trail.explode(14, this.x, this.y);
    scene.time.delayedCall(600, () => this.trail.destroy());
  }
}
