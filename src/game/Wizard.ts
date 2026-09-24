import Phaser from 'phaser';
import { CAST_RELEASE, type Dir } from '../art/wizard';
import { wizardMeta } from '../art/textures';

const SPEED = 58; // world px / second
const CAST_COOLDOWN = 180; // ms after a cast ends before the next can start

// Sprite origin: frame centre horizontally, just under the boots vertically.
const ORIGIN_X = 12;
const ORIGIN_Y = 31;

export type CastHandler = (x: number, y: number, dx: number, dy: number) => void;

export class Wizard {
  x: number;
  y: number;
  dir: Dir = 'down';
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private staffLight: Phaser.GameObjects.Light;
  private castShadow: Phaser.GameObjects.Sprite;
  /** 0 = night, 1 = day: softens the staff light and shows the sun shadow. */
  daylight = 0;
  private casting = false;
  private released = false;
  private castDir = new Phaser.Math.Vector2(0, 1);
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private cooldown = 0;
  private onCast: CastHandler;

  constructor(scene: Phaser.Scene, x: number, y: number, onCast: CastHandler) {
    this.x = x;
    this.y = y;
    this.onCast = onCast;
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(scene.add.sprite(x, y, 'wizard_s', 'idle_down_0').setOrigin(ORIGIN_X / 24, ORIGIN_Y / 32));
    this.body = scene.add
      .sprite(x, y, 'wizard', 'idle_down_0')
      .setOrigin(ORIGIN_X / 24, ORIGIN_Y / 32)
      .setPipeline('Lit');
    this.glowLayer = scene.add
      .sprite(x, y, 'wizard_e', 'idle_down_0')
      .setOrigin(ORIGIN_X / 24, ORIGIN_Y / 32)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.halo = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x5fdcff).setScale(0.55);
    this.staffLight = scene.lights.addLight(x, y, 56, 0x6fe4ff, 1.1);
    this.body.play('wizard_idle_down');
    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (anim.key.startsWith('wizard_cast')) {
        this.casting = false;
        this.cooldown = CAST_COOLDOWN;
        this.body.play(`wizard_idle_${this.dir}`);
      }
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, bounds: Phaser.Geom.Rectangle): void {
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);

    if (attack && !this.casting && this.cooldown === 0) this.startCast();

    // Movement: full speed walking, a slow shuffle while casting.
    const speed = this.casting ? SPEED * 0.25 : SPEED * Math.min(1, len);
    if (moving) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * speed * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * speed * (dt / 1000), bounds.top, bounds.bottom);
    }

    if (!this.casting) {
      if (moving) this.dir = dirOf(mx, my);
      const key = `wizard_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else if (!this.released && this.body.anims.currentFrame && this.body.anims.currentFrame.index - 1 >= CAST_RELEASE) {
      this.released = true;
      const tip = this.tip();
      this.onCast(tip.x, tip.y, this.castDir.x, this.castDir.y);
    }

    this.sync();
  }

  private startCast(): void {
    this.casting = true;
    this.released = false;
    this.castDir.copy(this.lastMove);
    this.dir = dirOf(this.castDir.x, this.castDir.y);
    this.body.play(`wizard_cast_${this.dir}`);
  }

  /** Crystal position in world space for the current frame. */
  tip(): { x: number; y: number; glow: number } {
    const m = wizardMeta.get(this.body.frame.name as string);
    if (!m) return { x: this.x, y: this.y - 20, glow: 0.6 };
    return { x: Math.round(this.x) - ORIGIN_X + m.tipX, y: Math.round(this.y) - ORIGIN_Y + m.tipY, glow: m.glow };
  }

  private sync(): void {
    const rx = Math.round(this.x);
    const ry = Math.round(this.y);
    this.body.setPosition(rx, ry).setDepth(ry);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(this.body.frame.name);
    this.shadow.setPosition(rx, ry - 1);
    this.castShadow.setPosition(rx, ry - 1).setFrame(this.body.frame.name).setAlpha(SUN_SHADOW_ALPHA * this.daylight);
    const t = this.tip();
    const flicker = 0.92 + Math.random() * 0.08;
    this.staffLight.setPosition(t.x, t.y);
    this.staffLight.intensity = (0.55 + t.glow * 0.9) * flicker * (this.casting ? 1.35 : 1) * (1 - this.daylight * 0.45);
    this.staffLight.radius = this.casting ? 80 : 58;
    this.halo.setPosition(t.x, t.y).setDepth(ry + 0.2).setAlpha((0.35 + t.glow * 0.4) * (1 - this.daylight * 0.5)).setScale(this.casting ? 0.75 : 0.5);
  }
}

export function dirOf(x: number, y: number): Dir {
  if (Math.abs(x) >= Math.abs(y) * 0.9) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}

export const SUN_SHADOW_ALPHA = 0.42;

/**
 * Turn a silhouette (`<texture>_s`) into a sun shadow: a flattened silhouette laid on the
 * ground from its feet, falling away from the sun (top-left).
 */
export function sunShadow<T extends Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>(obj: T): T {
  obj.setScale(1, -0.46).setAngle(-32).setAlpha(0).setDepth(2);
  return obj;
}
