import Phaser from 'phaser';
import { OBELISK_H, OBELISK_OY, PLATFORM_X, PLATFORM_Y, twinkleSpots } from '../art/cosmos';
import { warmCosmos } from '../art/textures';
import { sky } from '../game/LitPipeline';
import { skyState } from '../game/SkyPipeline';
import { settings } from '../game/settings';
import { snap } from '../game/display';
import { COSMOS_CX, COSMOS_CY, COSMOS_H, COSMOS_RX, COSMOS_RY, COSMOS_W, OBELISKS, cosmosSpot, cosmosWalkable } from './cosmosLayout';

type Img = Phaser.GameObjects.Image;

/** Colours the starlight comes in: pale gold, moon-white, lilac and aqua. */
const RAY_TINTS = [0xfff0c4, 0xd8ecff, 0xe4ccff, 0xbaffee];

interface Ray {
  shaft: Img;
  pool: Img;
  light: Phaser.GameObjects.Light;
  x: number;
  y: number;
  tint: number;
  /** Age, and the length of each part of its life, in ms. */
  age: number;
  rise: number;
  hold: number;
  fall: number;
  width: number;
  seed: number;
}

interface Twinkle {
  img: Img;
  seed: number;
  base: number;
  speed: number;
}

interface Drift {
  img: Img;
  x: number;
  y: number;
  seed: number;
}

/**
 * The Cosmos Arena around its fight: the backdrop and the platform (drawn
 * by the ground camera), obelisks with floating crystals, rocks drifting in
 * the dark, stars that twinkle, the odd shooting star, drifting stardust,
 * and shafts of starlight that fall at random on the battlefield, each
 * with a pool of light (a real light, so it lights the heroes and the
 * Warden too) and motes sparkling down inside it. There is no day or
 * night here: the arena sets the lighting itself.
 */
export class CosmosArena {
  private rays: Ray[] = [];
  private twinkles: Twinkle[] = [];
  private rocks: Drift[] = [];
  private crystals: { sprite: Phaser.GameObjects.Sprite; glow: Phaser.GameObjects.Sprite; halo: Img; light: Phaser.GameObjects.Light; seed: number }[] = [];
  private streak: Img;
  private streakT = 3000;
  private streakV = { x: 0, y: 0, life: 0 };
  private nextRay = 600;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private offQuality: () => void;

  /** `ground` hands an image to the camera that draws the ground (and hides it from the others). */
  constructor(
    private scene: Phaser.Scene,
    ground: (img: Img) => Img,
    view: Phaser.Geom.Rectangle,
  ) {
    warmCosmos(scene);
    const add = scene.add;
    ground(add.image(0, 0, 'cosmos_space').setOrigin(0).setDepth(-2));
    ground(add.image(PLATFORM_X, PLATFORM_Y, 'cosmos_platform').setOrigin(0).setPipeline('Lit').setDepth(0));
    ground(add.image(PLATFORM_X, PLATFORM_Y, 'cosmos_platform_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(2));

    // Obelisks round the rim, each with a crystal bobbing over its tip and a cold light.
    OBELISKS.forEach((o, i) => {
      const oy = OBELISK_OY / OBELISK_H;
      add.image(o.x, o.y, 'shadow').setDepth(1).setAlpha(0.7);
      const sprite = add.sprite(o.x, o.y, 'cosmos_obelisk', 'o0').setOrigin(0.5, oy).setPipeline('Lit').setDepth(o.y);
      const glow = add.sprite(o.x, o.y, 'cosmos_obelisk_e', 'o0').setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(o.y + 0.1);
      const halo = add.image(o.x, o.y - 42, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6ac8ff).setScale(1.3).setDepth(o.y + 0.2).setAlpha(0.5);
      const light = scene.lights.addLight(o.x, o.y - 30, 90, 0x6ac8ff, 0.9);
      this.crystals.push({ sprite, glow, halo, light, seed: i * 1.7 });
    });

    // Rocks adrift beyond the edge.
    const R = new Phaser.Math.RandomDataGenerator(['cosmos-rocks']);
    for (let i = 0; i < 7; i++) {
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 30; tries++) {
        const a = R.frac() * Math.PI * 2;
        const d = 1.3 + R.frac() * 0.5;
        x = COSMOS_CX + Math.cos(a) * COSMOS_RX * d;
        y = COSMOS_CY + Math.sin(a) * COSMOS_RY * d;
        // Clear of the platform's hanging side, and of each other.
        const under = Math.abs(x - COSMOS_CX) < COSMOS_RX * 1.05 && y > COSMOS_CY && y < COSMOS_CY + COSMOS_RY + 80;
        if (!under && !this.rocks.some((r) => Math.hypot(r.x - x, r.y - y) < 60)) break;
      }
      const img = add.image(Math.round(x), Math.round(y), 'cosmos_rock', `r${i % 3}`).setOrigin(0.5, 1).setPipeline('Lit').setDepth(0.5).setFlipX(R.frac() < 0.5);
      this.rocks.push({ img, x, y, seed: R.frac() * 100 });
    }

    // Bright stars that twinkle over the backdrop.
    for (const s of twinkleSpots(34)) {
      const big = s.seed > 80;
      const img = add
        .image(s.x, s.y, big ? 'glow' : 'spark')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(big ? 0.22 : 0.5)
        .setTint([0xffffff, 0xcfe6ff, 0xffe8b0, 0xe8d0ff][Math.floor(s.seed) % 4])
        .setDepth(0.2);
      this.twinkles.push({ img, seed: s.seed, base: big ? 0.8 : 0.6, speed: 0.0012 + (s.seed % 7) * 0.0004 });
    }

    this.streak = add.image(0, 0, 'cosmos_streak').setBlendMode(Phaser.BlendModes.ADD).setDepth(0.3).setVisible(false);

    // Motes sparkling down inside the shafts of light.
    const rays = this.rays;
    const rayZone = {
      getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
        const shown = rays.filter((r) => r.age > r.rise * 0.5 && r.age < r.rise + r.hold);
        if (!shown.length) {
          p.x = -999;
          p.y = -999;
          return p;
        }
        const r = shown[Math.floor(Math.random() * shown.length)];
        const up = Math.random() * 110;
        p.x = r.x - up * 0.21 + (Math.random() - 0.5) * 14 * r.width;
        p.y = r.y - up;
        return p;
      },
    };
    this.motes = add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: rayZone } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 900, max: 1600 },
      speedY: { min: 10, max: 26 },
      speedX: { min: 1, max: 5 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * (0.6 + Math.sin(t * 30) * 0.4) },
      tint: [0xffffff, 0xfff0c4, 0xd8ecff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 45,
    }).setDepth(9002);

    // Stardust drifting up everywhere the camera looks.
    this.dust = add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: view } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: 6000,
      speedX: { min: -3, max: 3 },
      speedY: { min: -7, max: -2 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.55 },
      tint: [0xe4ccff, 0xffffff, 0x9cd8ff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 130,
    }).setDepth(9999);

    this.offQuality = settings.watch((s) => {
      const k = s.quality === 'fast' ? 2 : 1;
      this.motes.frequency = 45 * k;
      this.dust.frequency = 130 * k;
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  walkable(x: number, y: number): boolean {
    return cosmosWalkable(x, y);
  }

  static readonly width = COSMOS_W;
  static readonly height = COSMOS_H;

  /** No sun here: a dim violet sky, and the arena's own lights doing the rest. */
  applyLighting(): void {
    sky.sunDir = [-0.2, 0.5, 0.84];
    sky.sunColor = [0.34, 0.32, 0.54];
    sky.sky = [0.4, 0.4, 0.64];
    sky.bounce = [0.18, 0.15, 0.32];
    skyState.clouds = 0;
    skyState.vignette = 0.4;
  }

  update(time: number, dt: number): void {
    this.applyLighting();

    for (const c of this.crystals) {
      const b = Math.sin(time * 0.0021 + c.seed);
      const f = `o${b > 0.4 ? 0 : b > -0.4 ? 1 : 2}`;
      c.sprite.setFrame(f);
      c.glow.setFrame(f);
      const s = 0.85 + Math.sin(time * 0.0033 + c.seed * 2) * 0.15;
      c.light.intensity = 0.9 * s;
      c.halo.setAlpha(0.35 + s * 0.2).setY(c.sprite.y - 42 + (b > 0.4 ? 0 : b > -0.4 ? 1 : 2));
    }
    for (const r of this.rocks) r.img.setPosition(snap(r.x), snap(r.y + Math.sin(time * 0.0009 + r.seed) * 3));
    for (const t of this.twinkles) {
      const w = Math.sin(time * t.speed + t.seed) * 0.5 + 0.5;
      t.img.setAlpha(t.base * (0.25 + w * w * 0.75));
    }

    this.updateStreak(dt);
    this.updateRays(dt);
  }

  /** Now and then a star shoots across the dark. */
  private updateStreak(dt: number): void {
    const s = this.streakV;
    if (s.life > 0) {
      s.life -= dt;
      const k = Math.min(1, s.life / 300);
      this.streak.x += (s.x * dt) / 1000;
      this.streak.y += (s.y * dt) / 1000;
      this.streak.setAlpha(k);
      if (s.life <= 0) this.streak.setVisible(false);
      return;
    }
    this.streakT -= dt;
    if (this.streakT > 0) return;
    this.streakT = 3500 + Math.random() * 6000;
    const left = Math.random() < 0.5;
    const speed = 260 + Math.random() * 140;
    const a = ((left ? 18 : 162) + (Math.random() - 0.5) * 16) * (Math.PI / 180);
    // Start somewhere in the upper sky, away from the platform.
    const x = left ? Math.random() * COSMOS_W * 0.4 : COSMOS_W * (0.6 + Math.random() * 0.4);
    const y = Math.random() * (COSMOS_CY - COSMOS_RY);
    s.x = Math.cos(a) * speed;
    s.y = Math.sin(a) * speed;
    s.life = 700 + Math.random() * 500;
    this.streak.setPosition(x, y).setRotation(a).setVisible(true).setAlpha(1);
  }

  /** Shafts of starlight fall at random spots, glow a while, and fade. */
  private updateRays(dt: number): void {
    const max = settings.values.quality === 'fast' ? 3 : 4;
    this.nextRay -= dt;
    if (this.nextRay <= 0 && this.rays.length < max) {
      this.nextRay = 1100 + Math.random() * 1900;
      this.spawnRay();
    }
    for (const r of this.rays) {
      r.age += dt;
      const { age, rise, hold, fall } = r;
      let k: number;
      if (age < rise) k = Phaser.Math.Easing.Sine.InOut(age / rise);
      else if (age < rise + hold) k = 1;
      else k = 1 - Phaser.Math.Easing.Sine.InOut(Math.min(1, (age - rise - hold) / fall));
      const shimmer = 0.9 + Math.sin(age * 0.004 + r.seed) * 0.06 + Math.sin(age * 0.011 + r.seed * 3) * 0.04;
      r.shaft.setAlpha(k * 0.62 * shimmer);
      r.pool.setAlpha(k * 0.75 * shimmer);
      r.light.intensity = k * 1.7 * shimmer;
    }
    this.motes.emitting = this.rays.some((r) => r.age > r.rise * 0.5 && r.age < r.rise + r.hold);
    for (const r of this.rays) {
      if (r.age < r.rise + r.hold + r.fall) continue;
      r.shaft.destroy();
      r.pool.destroy();
      this.scene.lights.removeLight(r.light);
    }
    for (let i = this.rays.length - 1; i >= 0; i--) {
      const r = this.rays[i];
      if (r.age >= r.rise + r.hold + r.fall) this.rays.splice(i, 1);
    }
  }

  private spawnRay(): void {
    let p = cosmosSpot(0.85);
    for (let tries = 0; tries < 8 && this.rays.some((r) => Math.hypot(r.x - p.x, r.y - p.y) < 70); tries++) p = cosmosSpot(0.85);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const tint = RAY_TINTS[Math.floor(Math.random() * RAY_TINTS.length)];
    const width = 0.75 + Math.random() * 0.55;
    const add = this.scene.add;
    // Slanted a little, as if falling from a star high to the upper left.
    const shaft = add.image(x, y + 4, 'cosmos_ray', `ray${Math.floor(Math.random() * 3)}`).setOrigin(0.5, 1).setAngle(-12).setScale(width, 1).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(0).setDepth(9000);
    const pool = add.image(x, y, 'cosmos_pool').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(width, width).setAlpha(0).setDepth(2.5);
    const light = this.scene.lights.addLight(x, y - 6, 80 * width, tint, 0);
    this.rays.push({ shaft, pool, light, x, y, tint, width, age: 0, rise: 900 + Math.random() * 500, hold: 2400 + Math.random() * 2600, fall: 1300 + Math.random() * 600, seed: Math.random() * 100 });
  }

  destroy(): void {
    this.offQuality();
    for (const r of this.rays) this.scene.lights.removeLight(r.light);
    for (const c of this.crystals) this.scene.lights.removeLight(c.light);
    this.rays = [];
    this.crystals = [];
  }
}
