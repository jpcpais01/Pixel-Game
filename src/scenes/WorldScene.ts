import Phaser from 'phaser';
import { controls } from '../game/controls';
import { Wizard } from '../game/Wizard';
import { EnergyBall } from '../game/EnergyBall';

export const WORLD_W = 640;
export const WORLD_H = 448;

interface Flicker {
  light: Phaser.GameObjects.Light;
  halo: Phaser.GameObjects.Image;
  base: number;
  radius: number;
  seed: number;
}

interface Dummy {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  wobble: number;
}

export class WorldScene extends Phaser.Scene {
  private wizard!: Wizard;
  private balls: EnergyBall[] = [];
  private flickers: Flicker[] = [];
  private dummies: Dummy[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private bounds = new Phaser.Geom.Rectangle(28, 40, WORLD_W - 56, WORLD_H - 64);

  constructor() {
    super('world');
  }

  create(): void {
    const cx = WORLD_W / 2;
    const cy = WORLD_H / 2;

    // Moonlit night: cool, dim ambient so the fire and magic carry the scene.
    this.lights.enable().setAmbientColor(0x3c4566);

    this.add.image(0, 0, 'ground').setOrigin(0).setPipeline('Light2D').setDepth(-10);
    this.add.image(0, 0, 'ground_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(-9).setAlpha(0.9);

    // Braziers around the plaza.
    const r = Math.min(WORLD_W, WORLD_H) * 0.3;
    for (const [ax, ay] of [
      [-0.78, -0.62],
      [0.78, -0.62],
      [-0.78, 0.62],
      [0.78, 0.62],
    ]) {
      this.brazier(cx + ax * r, cy + ay * r * 0.87);
    }
    this.crystals(cx - r - 40, cy - 30, 'c0');
    this.crystals(cx + r + 46, cy + 22, 'c1');
    this.crystals(cx + 30, cy - r - 44, 'c1');

    const R = new Phaser.Math.RandomDataGenerator(['rocks']);
    for (let i = 0; i < 18; i++) {
      const a = R.frac() * Math.PI * 2;
      const d = r + 30 + R.frac() * 120;
      const x = cx + Math.cos(a) * d * 1.3;
      const y = cy + Math.sin(a) * d;
      if (x < 16 || y < 16 || x > WORLD_W - 16 || y > WORLD_H - 8) continue;
      this.add.image(Math.round(x), Math.round(y), 'rock', `r${i % 3}`).setOrigin(0.5, 0.85).setPipeline('Light2D').setDepth(y);
    }

    this.dummy(cx + 64, cy - 8);
    this.dummy(cx - 70, cy + 34);

    this.wizard = new Wizard(this, cx, cy + 20, (x, y, dx, dy) => {
      this.balls.push(new EnergyBall(this, x, y, dx, dy));
    });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.followTarget, true, 0.12, 0.12);
    cam.postFX.addVignette(0.5, 0.5, 0.92, 0.32);
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.fitCamera());

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  private followTarget = { x: WORLD_W / 2, y: WORLD_H / 2 } as unknown as Phaser.GameObjects.GameObject;

  /** Integer zoom so pixels stay square; aims for ~140 world px on the short side. */
  private fitCamera(): void {
    const { width, height } = this.scale;
    const zoom = Math.max(2, Math.round(Math.min(width, height) / 140));
    this.cameras.main.setZoom(zoom);
  }

  private brazier(x: number, y: number): void {
    x = Math.round(x);
    y = Math.round(y);
    this.add.image(x, y, 'shadow_big').setDepth(1).setAlpha(0.8);
    this.add.sprite(x, y, 'brazier', 'f0').setOrigin(0.5, 25 / 26).setPipeline('Light2D').setDepth(y);
    this.add.sprite(x, y, 'brazier_e', 'f0').setOrigin(0.5, 25 / 26).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).play({ key: 'brazier_burn', startFrame: Math.floor(Math.random() * 4) });
    const halo = this.add.image(x, y - 17, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff8a2a).setScale(2.2).setDepth(y + 0.2).setAlpha(0.55);
    const light = this.lights.addLight(x, y - 16, 140, 0xff9444, 2.0);
    this.flickers.push({ light, halo, base: 2.0, radius: 140, seed: Math.random() * 100 });
  }

  private crystals(x: number, y: number, frame: string): void {
    x = Math.round(x);
    y = Math.round(y);
    this.add.image(x, y, 'crystals', frame).setOrigin(0.5, 20 / 22).setPipeline('Light2D').setDepth(y);
    this.add.image(x, y, 'crystals_e', frame).setOrigin(0.5, 20 / 22).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1);
    const halo = this.add.image(x, y - 9, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8a55f0).setScale(1.6).setDepth(y + 0.2).setAlpha(0.45);
    const light = this.lights.addLight(x, y - 10, 100, 0x9a6cff, 1.6);
    this.flickers.push({ light, halo, base: 1.6, radius: 100, seed: -1 });
  }

  private dummy(x: number, y: number): void {
    x = Math.round(x);
    y = Math.round(y);
    this.add.image(x, y, 'shadow').setDepth(1);
    const sprite = this.add.sprite(x, y, 'dummy', 'd0').setOrigin(0.5, 26 / 28).setPipeline('Light2D').setDepth(y);
    this.dummies.push({ sprite, x, y, wobble: 0 });
  }

  private hitTest = (x: number, y: number): boolean => {
    for (const d of this.dummies) {
      if (Math.abs(x - d.x) < 7 && y > d.y - 24 && y < d.y + 2) {
        d.wobble = 1;
        d.sprite.setFrame('d1');
        this.time.delayedCall(90, () => d.sprite.setFrame('d0'));
        this.cameras.main.shake(70, 0.0035);
        return true;
      }
    }
    return false;
  };

  update(time: number, dt: number): void {
    const k = this.keys;
    let mx = controls.moveX;
    let my = controls.moveY;
    const kx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const ky = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      mx = kx / l;
      my = ky / l;
    }
    const attack = controls.attack || k.SPACE.isDown || k.J.isDown;
    this.wizard.update(dt, mx, my, attack, this.bounds);
    (this.followTarget as unknown as { x: number; y: number }).x = this.wizard.x;
    (this.followTarget as unknown as { x: number; y: number }).y = this.wizard.y - 12;

    for (const b of this.balls) b.update(dt, this.hitTest, this.bounds);
    this.balls = this.balls.filter((b) => !b.dead);

    for (const f of this.flickers) {
      if (f.seed < 0) {
        // Crystals breathe slowly.
        const s = 0.85 + Math.sin(time * 0.002) * 0.15;
        f.light.intensity = f.base * s;
        f.halo.setAlpha(0.35 + s * 0.12);
      } else {
        const n = Math.sin(time * 0.011 + f.seed) * 0.5 + Math.sin(time * 0.027 + f.seed * 3) * 0.3 + Math.sin(time * 0.061 + f.seed * 7) * 0.2;
        f.light.intensity = f.base * (0.85 + n * 0.15);
        f.light.radius = f.radius * (0.96 + n * 0.04);
        f.halo.setAlpha(0.45 + n * 0.1);
      }
    }

    for (const d of this.dummies) {
      if (d.wobble > 0) {
        d.wobble = Math.max(0, d.wobble - dt / 500);
        d.sprite.setAngle(Math.sin(d.wobble * 20) * 12 * d.wobble);
      }
    }
  }
}
