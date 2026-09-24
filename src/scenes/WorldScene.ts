import Phaser from 'phaser';
import { controls } from '../game/controls';
import { Wizard, sunShadow, SUN_SHADOW_ALPHA } from '../game/Wizard';
import { EnergyBall } from '../game/EnergyBall';
import { daynight } from '../game/daynight';
import { sky } from '../game/LitPipeline';

type V3 = [number, number, number];

/** Lighting for each end of the day/night blend. */
const NIGHT = {
  sunDir: [0.5, 0.45, 0.74] as V3, // moon, from the upper right
  sun: [0.1, 0.13, 0.26] as V3,
  sky: [0.2, 0.24, 0.38] as V3,
  bounce: [0.13, 0.13, 0.24] as V3,
};
const DAY = {
  sunDir: [-0.45, 0.5, 0.74] as V3, // sun, from the upper left
  sun: [0.78, 0.66, 0.5] as V3,
  sky: [0.5, 0.58, 0.72] as V3,
  bounce: [0.4, 0.36, 0.32] as V3,
};
const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const WORLD_W = 640;
export const WORLD_H = 448;

interface Flicker {
  light: Phaser.GameObjects.Light;
  halo: Phaser.GameObjects.Image;
  base: number;
  radius: number;
  seed: number;
  /** How much of the light survives in daylight. */
  day: number;
  haloBase: number;
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
  private groundDay!: Phaser.GameObjects.Image;
  private runes!: Phaser.GameObjects.Image;
  private clouds!: Phaser.GameObjects.TileSprite;
  private shafts!: Phaser.GameObjects.TileSprite;
  private shadows: Phaser.GameObjects.Image[] = [];
  private pollen!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireflies!: Phaser.GameObjects.Particles.ParticleEmitter;
  private vignette!: Phaser.FX.Vignette;

  constructor() {
    super('world');
  }

  create(): void {
    const cx = WORLD_W / 2;
    const cy = WORLD_H / 2;

    // Ambient comes from the Lit pipeline's sky and sun, driven by daynight.
    this.lights.enable().setAmbientColor(0x000000);

    this.add.image(0, 0, 'ground').setOrigin(0).setPipeline('Lit').setDepth(-10);
    this.groundDay = this.add.image(0, 0, 'ground_day').setOrigin(0).setPipeline('Lit').setDepth(-10);
    this.runes = this.add.image(0, 0, 'ground_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(-9);

    // Sky layers above everything in the world: drifting cloud shadows and
    // faint shafts of sunlight.
    this.clouds = this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'clouds').setOrigin(0).setDepth(10000);
    this.shafts = this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'shafts').setOrigin(0).setDepth(10001).setBlendMode(Phaser.BlendModes.ADD);

    const world = new Phaser.Geom.Rectangle(0, 0, WORLD_W, WORLD_H);
    this.pollen = this.add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: world } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: 5000,
      speedX: { min: 2, max: 9 },
      speedY: { min: -4, max: 3 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.75 },
      tint: [0xfff4c8, 0xffffff, 0xffe28a],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 90,
    }).setDepth(9999);
    this.fireflies = this.add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: world } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 2500, max: 4500 },
      speed: { min: 2, max: 7 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.max(0, Math.sin(t * Math.PI * 3)) },
      tint: [0xd8ff7a, 0xf6ffb0, 0x9dffb0],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 160,
    }).setDepth(9999);

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
      this.add.image(Math.round(x), Math.round(y), 'rock', `r${i % 3}`).setOrigin(0.5, 0.85).setPipeline('Lit').setDepth(y);
      this.shadows.push(sunShadow(this.add.image(Math.round(x), Math.round(y), 'rock_s', `r${i % 3}`).setOrigin(0.5, 0.85)));
    }

    this.dummy(cx + 64, cy - 8);
    this.dummy(cx - 70, cy + 34);

    this.wizard = new Wizard(this, cx, cy + 20, (x, y, dx, dy) => {
      this.balls.push(new EnergyBall(this, x, y, dx, dy));
    });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.followTarget, true, 0.12, 0.12);
    this.vignette = cam.postFX.addVignette(0.5, 0.5, 0.92, 0.32);
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.fitCamera());

    const kb = this.input.keyboard!;
    kb.on('keydown-N', () => daynight.toggle());
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,N') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  private followTarget = { x: WORLD_W / 2, y: WORLD_H / 2 } as unknown as Phaser.GameObjects.GameObject;

  /** Integer zoom so pixels stay square; aims for ~185+ world px on the short side. */
  private fitCamera(): void {
    const { width, height } = this.scale;
    const zoom = Math.max(2, Math.floor(Math.min(width, height) / 185));
    this.cameras.main.setZoom(zoom);
  }

  private brazier(x: number, y: number): void {
    x = Math.round(x);
    y = Math.round(y);
    this.add.image(x, y, 'shadow_big').setDepth(1).setAlpha(0.8);
    this.add.sprite(x, y, 'brazier', 'f0').setOrigin(0.5, 25 / 26).setPipeline('Lit').setDepth(y);
    this.shadows.push(sunShadow(this.add.image(x, y, 'brazier_s', 'f0').setOrigin(0.5, 25 / 26)));
    this.add.sprite(x, y, 'brazier_e', 'f0').setOrigin(0.5, 25 / 26).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).play({ key: 'brazier_burn', startFrame: Math.floor(Math.random() * 4) });
    const halo = this.add.image(x, y - 17, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff8a2a).setScale(2.2).setDepth(y + 0.2).setAlpha(0.55);
    const light = this.lights.addLight(x, y - 16, 140, 0xff9444, 2.0);
    this.flickers.push({ light, halo, base: 2.0, radius: 140, seed: Math.random() * 100, day: 0.3, haloBase: 0.55 });
  }

  private crystals(x: number, y: number, frame: string): void {
    x = Math.round(x);
    y = Math.round(y);
    this.add.image(x, y, 'crystals', frame).setOrigin(0.5, 20 / 22).setPipeline('Lit').setDepth(y);
    this.shadows.push(sunShadow(this.add.image(x, y, 'crystals_s', frame).setOrigin(0.5, 20 / 22)));
    this.add.image(x, y, 'crystals_e', frame).setOrigin(0.5, 20 / 22).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1);
    const halo = this.add.image(x, y - 9, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8a55f0).setScale(1.6).setDepth(y + 0.2).setAlpha(0.45);
    const light = this.lights.addLight(x, y - 10, 100, 0x9a6cff, 1.6);
    this.flickers.push({ light, halo, base: 1.6, radius: 100, seed: -1, day: 0.45, haloBase: 0.45 });
  }

  private dummy(x: number, y: number): void {
    x = Math.round(x);
    y = Math.round(y);
    this.add.image(x, y, 'shadow').setDepth(1);
    const sprite = this.add.sprite(x, y, 'dummy', 'd0').setOrigin(0.5, 26 / 28).setPipeline('Lit').setDepth(y);
    this.shadows.push(sunShadow(this.add.image(x, y, 'dummy_s', 'd0').setOrigin(0.5, 26 / 28)));
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

  /** Ease toward the chosen time of day and push it into every layer. */
  private updateDaylight(time: number, dt: number): number {
    const step = dt / 1400;
    daynight.daylight += Phaser.Math.Clamp(daynight.target - daynight.daylight, -step, step);
    const d = Phaser.Math.Easing.Sine.InOut(daynight.daylight);

    sky.sunDir = mix3(NIGHT.sunDir, DAY.sunDir, d);
    sky.sunColor = mix3(NIGHT.sun, DAY.sun, d);
    sky.sky = mix3(NIGHT.sky, DAY.sky, d);
    sky.bounce = mix3(NIGHT.bounce, DAY.bounce, d);

    this.groundDay.setAlpha(d);
    this.runes.setAlpha(0.9 - d * 0.6);
    this.clouds.setAlpha(d).setTilePosition(time * 0.004, time * 0.0022);
    this.shafts.setAlpha(d * (0.1 + Math.sin(time * 0.0007) * 0.03));
    for (const s of this.shadows) s.setAlpha(SUN_SHADOW_ALPHA * d);
    this.vignette.strength = 0.32 - d * 0.14;
    this.pollen.emitting = d > 0.5;
    this.fireflies.emitting = d < 0.5;
    return d;
  }

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
    this.wizard.daylight = daynight.daylight;
    this.wizard.update(dt, mx, my, attack, this.bounds);
    (this.followTarget as unknown as { x: number; y: number }).x = this.wizard.x;
    (this.followTarget as unknown as { x: number; y: number }).y = this.wizard.y - 12;

    for (const b of this.balls) b.update(dt, this.hitTest, this.bounds);
    this.balls = this.balls.filter((b) => !b.dead);

    const d = this.updateDaylight(time, dt);
    for (const f of this.flickers) {
      const k = 1 + (f.day - 1) * d;
      if (f.seed < 0) {
        // Crystals breathe slowly.
        const s = 0.85 + Math.sin(time * 0.002) * 0.15;
        f.light.intensity = f.base * s * k;
        f.halo.setAlpha((f.haloBase * 0.8 + s * 0.12) * k);
      } else {
        const n = Math.sin(time * 0.011 + f.seed) * 0.5 + Math.sin(time * 0.027 + f.seed * 3) * 0.3 + Math.sin(time * 0.061 + f.seed * 7) * 0.2;
        f.light.intensity = f.base * (0.85 + n * 0.15) * k;
        f.light.radius = f.radius * (0.96 + n * 0.04);
        f.halo.setAlpha((f.haloBase * 0.8 + n * 0.1) * k);
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
