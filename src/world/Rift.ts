import Phaser from 'phaser';
import { RIFT_PLATFORM_X, RIFT_PLATFORM_Y, SHARD_H, SHARD_OY, TEAR_H } from '../art/rift';
import { warmDeep, warmRift, warmTemple } from '../art/textures';
import { sky } from '../game/LitPipeline';
import { skyState } from '../game/SkyPipeline';
import { settings } from '../game/settings';
import { snap } from '../game/display';
import { RIFT_CX, RIFT_CY, RIFT_RX, RIFT_RY, SHARDS, TEARS } from './riftLayout';

type Img = Phaser.GameObjects.Image;

const MAGENTA = 0xff4ab8;
const VIOLET = 0xa060ff;

interface Tear {
  sprite: Phaser.GameObjects.Sprite;
  halo: Img;
  light: Phaser.GameObjects.Light;
  x: number;
  y: number;
  /** How wide it stands open now, and how wide it's going. */
  open: number;
  goal: number;
  /** A flare as something steps out of it, fading. */
  flare: number;
  seed: number;
}

/**
 * The Endless Rift around its fight: the void and the platform (drawn by the
 * ground camera), six tears hanging in the air round the edge that gape open
 * while a wave pours through and flare as each monster steps out, obsidian
 * shards on the platform, rocks adrift in the void, motes rising from the
 * glowing cracks, and a violet light the arena sets itself (there is no day
 * or night here). The wave itself is run by game/rift.ts.
 */
export class RiftArena {
  private tears: Tear[] = [];
  private rocks: { img: Img; x: number; y: number; seed: number }[] = [];
  private heart: Phaser.GameObjects.Light;
  private glowLayer: Img;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private offQuality: () => void;
  /** 0 calm .. 1 a wave raging: the cracks and the heart burn brighter. */
  private fury = 0;
  private furyGoal = 0;

  /** `ground` hands an image to the camera that draws the ground (and hides it from the others). */
  constructor(
    private scene: Phaser.Scene,
    ground: (img: Img) => Img,
  ) {
    // The waves call on monsters from the Rune Temple and the Deep: their sheets are built with those arenas.
    warmTemple(scene);
    warmDeep(scene);
    warmRift(scene);
    const add = scene.add;
    ground(add.image(0, 0, 'rift_void').setOrigin(0).setDepth(-2));
    ground(add.image(RIFT_PLATFORM_X, RIFT_PLATFORM_Y, 'rift_platform').setOrigin(0).setPipeline('Lit').setDepth(0));
    this.glowLayer = ground(add.image(RIFT_PLATFORM_X, RIFT_PLATFORM_Y, 'rift_platform_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(2));

    // The tears, closed to a thin seam until a wave comes.
    TEARS.forEach((t, i) => {
      const sprite = add.sprite(t.x, t.y + 2, 'rift_tear', 't0').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(t.y + 0.5).play({ key: 'rift_tear_flicker', startFrame: i % 4 });
      const halo = add.image(t.x, t.y - TEAR_H / 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(MAGENTA).setDepth(t.y + 0.4).setAlpha(0.3);
      const light = scene.lights.addLight(t.x, t.y - 20, 70, MAGENTA, 0.4);
      this.tears.push({ sprite, halo, light, x: t.x, y: t.y, open: 0.25, goal: 0.25, flare: 0, seed: i * 1.9 });
    });

    // Obsidian shards, each with a faint glow at its vein.
    for (const s of SHARDS) {
      const oy = SHARD_OY / SHARD_H;
      add.image(s.x, s.y, 'shadow').setDepth(1).setAlpha(0.6).setScale(1.2, 1);
      add.image(s.x, s.y, 'rift_shard', `s${s.v}`).setOrigin(0.5, oy).setPipeline('Lit').setDepth(s.y);
      add.image(s.x, s.y, 'rift_shard_e', `s${s.v}`).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(s.y + 0.1);
    }

    // Rocks adrift in the void round the platform.
    const R = new Phaser.Math.RandomDataGenerator(['rift-rocks']);
    for (let i = 0; i < 8; i++) {
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 30; tries++) {
        const a = R.frac() * Math.PI * 2;
        const d = 1.25 + R.frac() * 0.45;
        x = RIFT_CX + Math.cos(a) * RIFT_RX * d;
        y = RIFT_CY + Math.sin(a) * RIFT_RY * d;
        const under = Math.abs(x - RIFT_CX) < RIFT_RX * 1.05 && y > RIFT_CY && y < RIFT_CY + RIFT_RY + 90;
        if (!under && !this.rocks.some((r) => Math.hypot(r.x - x, r.y - y) < 60)) break;
      }
      const img = add.image(Math.round(x), Math.round(y), 'rift_rock', `r${i % 3}`).setOrigin(0.5, 1).setPipeline('Lit').setDepth(0.5).setFlipX(R.frac() < 0.5);
      this.rocks.push({ img, x, y, seed: R.frac() * 100 });
    }

    this.heart = scene.lights.addLight(RIFT_CX, RIFT_CY - 10, 200, VIOLET, 0.8);

    // Motes of the rift's light rising off the platform.
    const zone = {
      getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * 0.92;
        p.x = RIFT_CX + Math.cos(a) * RIFT_RX * d;
        p.y = RIFT_CY + Math.sin(a) * RIFT_RY * d;
        return p;
      },
    };
    this.motes = add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: zone } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 1800, max: 3200 },
      speedY: { min: -14, max: -5 },
      speedX: { min: -2, max: 2 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.7 },
      tint: [MAGENTA, 0xffc0ec, VIOLET, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 90,
    }).setDepth(9999);

    this.offQuality = settings.watch((s) => {
      this.motes.frequency = s.quality !== 'full' ? 180 : 90;
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** A wave is coming (the tears gape open) or is done (they narrow to seams). */
  setWave(on: boolean): void {
    this.furyGoal = on ? 1 : 0;
    for (const t of this.tears) t.goal = on ? 1 : 0.25;
  }

  /** Something steps out of tear `i`: it flares. */
  flare(i: number): void {
    const t = this.tears[i];
    if (t) t.flare = 1;
  }

  /** No sun here: a dim violet dark, the rift's own light doing the rest. */
  applyLighting(): void {
    sky.sunDir = [-0.25, 0.55, 0.8];
    sky.sunColor = [0.4, 0.28, 0.52];
    sky.sky = [0.42, 0.34, 0.6];
    sky.bounce = [0.24, 0.1, 0.26];
    skyState.clouds = 0;
    skyState.vignette = 0.42;
  }

  update(time: number, dt: number): void {
    this.applyLighting();
    this.fury += (this.furyGoal - this.fury) * Math.min(1, dt / 900);
    const beat = 0.5 + 0.5 * Math.sin(time * (0.002 + this.fury * 0.004));
    this.glowLayer.setAlpha(0.7 + this.fury * 0.3 * beat);
    this.heart.intensity = 0.8 + this.fury * 0.6 * beat;
    this.heart.color.set(0.63 + this.fury * 0.37, 0.38 - this.fury * 0.09, 1 - this.fury * 0.28);

    for (const t of this.tears) {
      t.open += (t.goal - t.open) * Math.min(1, dt / 350);
      t.flare = Math.max(0, t.flare - dt / 450);
      const w = t.open * (0.92 + Math.sin(time * 0.006 + t.seed) * 0.08) + t.flare * 0.35;
      t.sprite.setScale(w, 0.55 + t.open * 0.45 + t.flare * 0.1).setAlpha(0.55 + t.open * 0.45);
      t.halo.setScale(0.5 + t.open * 0.7 + t.flare).setAlpha(0.15 + t.open * 0.25 + t.flare * 0.4);
      t.light.intensity = 0.3 + t.open * 0.9 + t.flare * 1.6;
    }
    for (const r of this.rocks) r.img.setPosition(snap(r.x), snap(r.y + Math.sin(time * 0.0008 + r.seed) * 3));
  }

  destroy(): void {
    this.offQuality();
    for (const t of this.tears) this.scene.lights.removeLight(t.light);
    this.scene.lights.removeLight(this.heart);
    this.tears = [];
  }
}
