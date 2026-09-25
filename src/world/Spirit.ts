import Phaser from 'phaser';
import { BRAZIER_H, BRAZIER_OY, CANDLE_H, CANDLE_OY, PILLAR_H, PILLAR_OY, STATUE_H, STATUE_OY, TOMB_H, TOMB_OY } from '../art/spirit';
import { warmSpirit } from '../art/textures';
import { hash2 } from '../art/env';
import { sky } from '../game/LitPipeline';
import { skyState } from '../game/SkyPipeline';
import { settings } from '../game/settings';
import { snap } from '../game/display';
import { CRYPT, HALL, OSSUARY, POOL, SANCTUM, SPIRIT_H, SPIRIT_PROPS, SPIRIT_W, spiritWalkable, type SpiritProp } from './spiritLayout';

type Img = Phaser.GameObjects.Image;

/** A flame on a pedestal: its sprite, a glow, and (for braziers) a real light. */
interface Flame {
  x: number;
  y: number;
  halo: Img;
  light: Phaser.GameObjects.Light | null;
  base: number;
  seed: number;
}

interface Mist {
  img: Img;
  x: number;
  y: number;
  /** The span of floor it drifts back and forth across. */
  x0: number;
  x1: number;
  speed: number;
  seed: number;
  alpha: number;
}

/** Frame height and feet row of each standing prop's texture. */
const PROP_ART: Partial<Record<SpiritProp['kind'], { key: string; oy: number; h: number }>> = {
  pillar: { key: 'sd_pillar', oy: PILLAR_OY, h: PILLAR_H },
  tomb: { key: 'sd_tomb', oy: TOMB_OY, h: TOMB_H },
  statue: { key: 'sd_statue', oy: STATUE_OY, h: STATUE_H },
  brazier: { key: 'sd_brazier', oy: BRAZIER_OY, h: BRAZIER_H },
  candles: { key: 'sd_candles', oy: CANDLE_OY, h: CANDLE_H },
};

/** Where the mist lies: a few banks in each chamber. */
const MIST_BANKS: { x: number; y: number; w: number }[] = [
  { x: HALL.x0, y: 1300, w: HALL.x1 - HALL.x0 },
  { x: HALL.x0, y: 1230, w: HALL.x1 - HALL.x0 },
  { x: CRYPT.x0, y: 960, w: CRYPT.x1 - CRYPT.x0 },
  { x: CRYPT.x0, y: 1050, w: CRYPT.x1 - CRYPT.x0 },
  { x: OSSUARY.x0, y: 600, w: OSSUARY.x1 - OSSUARY.x0 },
  { x: OSSUARY.x0, y: 690, w: OSSUARY.x1 - OSSUARY.x0 },
  { x: OSSUARY.x0, y: 755, w: OSSUARY.x1 - OSSUARY.x0 },
  { x: SANCTUM.cx - SANCTUM.rx * 0.8, y: 180, w: SANCTUM.rx * 1.6 },
  { x: SANCTUM.cx - SANCTUM.rx * 0.9, y: 300, w: SANCTUM.rx * 1.8 },
  { x: SANCTUM.cx - SANCTUM.rx * 0.6, y: 380, w: SANCTUM.rx * 1.2 },
];

/**
 * The Spirit Dungeon around its fights: the floor plan (drawn by the ground
 * camera), braziers of cold spirit-fire with real lights, pillars, tombs,
 * mourning statues and candles, the glowing spirit pool, banks of mist
 * drifting over the floor, and motes of soul-light rising wherever the
 * camera looks. There is no day or night down here: the dungeon sets its
 * own dim light, and things out of view are left alone.
 */
export class SpiritDungeon {
  private flames: Flame[] = [];
  private mists: Mist[] = [];
  private poolGlow: Img;
  private poolLight: Phaser.GameObjects.Light;
  private poolMotes: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private offQuality: () => void;

  static readonly width = SPIRIT_W;
  static readonly height = SPIRIT_H;

  /** `ground` hands an image to the camera that draws the ground (and hides it from the others). */
  constructor(
    private scene: Phaser.Scene,
    ground: (img: Img) => Img,
    private view: Phaser.Geom.Rectangle,
  ) {
    warmSpirit(scene);
    const add = scene.add;
    ground(add.image(0, 0, 'sd_floor').setOrigin(0).setPipeline('Lit').setDepth(0));
    ground(add.image(0, 0, 'sd_floor_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(2));

    SPIRIT_PROPS.forEach((p, i) => this.prop(p, i));

    // The spirit pool: a soft glow over the water, its own light, and motes rising off it.
    this.poolGlow = add.image(POOL.cx, POOL.cy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x4ae0c8).setScale((POOL.rx * 2.4) / 32, (POOL.ry * 2.6) / 32).setDepth(2.6).setAlpha(0.3);
    this.poolLight = scene.lights.addLight(POOL.cx, POOL.cy - 10, 120, 0x4ae0c8, 0.9);
    const poolZone = new Phaser.Geom.Ellipse(POOL.cx, POOL.cy, POOL.rx * 1.8, POOL.ry * 1.8);
    this.poolMotes = add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: poolZone } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 1400, max: 2600 },
      speedY: { min: -22, max: -8 },
      speedX: { min: -3, max: 3 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.8 },
      tint: [0xeafffa, 0x6af4dc, 0x8ac8ff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 90,
    }).setDepth(POOL.cy + 40);

    // Banks of mist, each a few puffs drifting back and forth over the floor.
    const R = new Phaser.Math.RandomDataGenerator(['spirit-mist']);
    for (const b of MIST_BANKS) {
      for (let k = 0; k < 2; k++) {
        const x = b.x + R.frac() * b.w;
        const alpha = 0.1 + R.frac() * 0.06;
        const img = add
          .image(x, b.y, `sd_mist${R.between(0, 2)}`)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(R.frac() < 0.5 ? 0x8ad8e0 : 0x9aa8e8)
          .setScale(1.2 + R.frac() * 0.8, 1 + R.frac() * 0.4)
          .setDepth(2.4)
          .setAlpha(alpha);
        this.mists.push({ img, x, y: b.y + (R.frac() - 0.5) * 16, x0: b.x, x1: b.x + b.w, speed: (3 + R.frac() * 4) * (R.frac() < 0.5 ? -1 : 1), seed: R.frac() * 100, alpha });
      }
    }

    // Soul-light drifting up wherever the camera looks.
    this.dust = add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: view } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: 5000,
      speedX: { min: -3, max: 3 },
      speedY: { min: -8, max: -2 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.6 },
      tint: [0x6af4dc, 0xeafffa, 0x8ac8ff, 0xb89cff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 150,
    }).setDepth(9999);

    this.offQuality = settings.watch((s) => {
      const k = s.quality !== 'full' ? 2 : 1;
      this.dust.frequency = 150 * k;
      this.poolMotes.frequency = 90 * k;
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** One standing prop: its lit sprite, its glow, a soft shadow, and for flames a halo (and light). */
  private prop(p: SpiritProp, i: number): void {
    const art = PROP_ART[p.kind];
    if (!art) return; // Bones are painted into the floor.
    const add = this.scene.add;
    const oy = art.oy / art.h;
    const frame = p.kind === 'pillar' ? (hash2(i, 3, 7) > 0.6 ? 'p1' : 'p0') : p.kind === 'tomb' ? 't0' : p.kind === 'statue' ? 's0' : 'f0';
    add.image(p.x, p.y, 'shadow').setDepth(1).setScale(p.kind === 'tomb' ? 2 : p.kind === 'candles' ? 0.8 : 1.3, p.kind === 'tomb' ? 1.4 : 1).setAlpha(0.8);
    add.image(p.x, p.y, art.key, frame).setOrigin(0.5, oy).setPipeline('Lit').setDepth(p.y).setFlipX(!!p.flip);
    const glow = add.sprite(p.x, p.y, `${art.key}_e`, frame).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y + 0.1).setFlipX(!!p.flip);
    const seed = hash2(i, 5, 11) * 100;
    if (p.kind === 'brazier') {
      glow.play({ key: 'sd_brazier_burn', startFrame: i % 4 });
      const halo = add.image(p.x, p.y - 26, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6af4dc).setScale(0.9).setDepth(p.y + 0.2).setAlpha(0.45);
      const light = this.scene.lights.addLight(p.x, p.y - 20, 96, 0x5ae8d4, 1.05);
      this.flames.push({ x: p.x, y: p.y, halo, light, base: 1.05, seed });
    } else if (p.kind === 'candles') {
      glow.play({ key: 'sd_candles_burn', startFrame: i % 3 });
      const halo = add.image(p.x, p.y - 10, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xc8fff0).setScale(0.55).setDepth(p.y + 0.2).setAlpha(0.35);
      this.flames.push({ x: p.x, y: p.y, halo, light: null, base: 0.35, seed });
    } else if (p.kind === 'statue') {
      // The lantern in its hands.
      const lx = p.x + (p.flip ? -5 : 5);
      const halo = add.image(lx, p.y - 18, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6af4dc).setScale(0.5).setDepth(p.y + 0.2).setAlpha(0.4);
      this.flames.push({ x: lx, y: p.y, halo, light: null, base: 0.4, seed });
    }
  }

  walkable(x: number, y: number): boolean {
    return spiritWalkable(x, y);
  }

  /** Cold, dim light from nowhere in particular; the braziers and the pool do the rest. */
  applyLighting(): void {
    sky.sunDir = [0.1, 0.55, 0.83];
    sky.sunColor = [0.22, 0.28, 0.4];
    sky.sky = [0.34, 0.4, 0.56];
    sky.bounce = [0.12, 0.15, 0.24];
    skyState.clouds = 0;
    skyState.vignette = 0.42;
  }

  update(time: number, dt: number): void {
    this.applyLighting();
    const v = this.view;
    const seen = (x: number, y: number, m: number) => x > v.left - m && x < v.right + m && y > v.top - m && y < v.bottom + m;

    for (const f of this.flames) {
      if (!seen(f.x, f.y, 60)) continue;
      const n = Math.sin(time * 0.009 + f.seed) * 0.5 + Math.sin(time * 0.023 + f.seed * 3) * 0.3 + Math.sin(time * 0.057 + f.seed * 7) * 0.2;
      f.halo.setAlpha(f.base * 0.4 + 0.12 + n * 0.06);
      if (f.light) {
        f.light.intensity = f.base * (0.88 + n * 0.12);
        f.light.radius = 96 * (0.96 + n * 0.04);
      }
    }

    const poolSeen = seen(POOL.cx, POOL.cy, 120);
    this.poolMotes.emitting = poolSeen;
    if (poolSeen) {
      const s = 0.85 + Math.sin(time * 0.0017) * 0.15;
      this.poolGlow.setAlpha(0.22 + s * 0.1);
      this.poolLight.intensity = 0.8 * s + 0.1;
    }

    for (const m of this.mists) {
      m.x += (m.speed * dt) / 1000;
      if (m.x < m.x0 || m.x > m.x1) {
        m.speed = -m.speed;
        m.x = Phaser.Math.Clamp(m.x, m.x0, m.x1);
      }
      if (!seen(m.x, m.y, 80)) {
        m.img.setVisible(false);
        continue;
      }
      m.img.setVisible(true).setPosition(snap(m.x), snap(m.y + Math.sin(time * 0.0006 + m.seed) * 3)).setAlpha(m.alpha * (0.75 + Math.sin(time * 0.0009 + m.seed) * 0.25));
    }
  }

  destroy(): void {
    this.offQuality();
    for (const f of this.flames) if (f.light) this.scene.lights.removeLight(f.light);
    this.scene.lights.removeLight(this.poolLight);
    this.flames = [];
  }
}
