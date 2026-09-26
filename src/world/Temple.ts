import Phaser from 'phaser';
import { BOULDER_H, BOULDER_OY, CRYSTAL_H, CRYSTAL_OY, ELEMENTS, FIREBOWL_H, FIREBOWL_OY, OBELISK_H, OBELISK_OY, TPILLAR_H, TPILLAR_OY } from '../art/temple';
import { ELEMENT_LIGHT } from '../art/elementals';
import { warmTemple } from '../art/textures';
import { hash2 } from '../art/env';
import { sky } from '../game/LitPipeline';
import { skyState } from '../game/SkyPipeline';
import { settings } from '../game/settings';
import { GALLERY, LAVA_PITS, TEMPLE_H, TEMPLE_PROPS, TEMPLE_W, TIDE_POOL, templeWalkable, type TempleProp } from './templeLayout';

type Img = Phaser.GameObjects.Image;
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** A flame or a glowing stone: its halo, and for the fire bowls and obelisks a real light. */
interface Glow {
  x: number;
  y: number;
  halo: Img;
  light: Phaser.GameObjects.Light | null;
  base: number;
  radius: number;
  seed: number;
  /** Flickers like fire, or breathes slowly like a gem. */
  fire: boolean;
}

/** A pool of something bright: its glow, light and what rises off it, paused out of view. */
interface Pool {
  x: number;
  y: number;
  glow: Img;
  light: Phaser.GameObjects.Light;
  base: number;
  motes: Emitter;
  seed: number;
}

/** Texture, frame height and feet row of each standing prop. */
const PROP_ART: Record<TempleProp['kind'], { key: string; oy: number; h: number }> = {
  pillar: { key: 'et_pillar', oy: TPILLAR_OY, h: TPILLAR_H },
  brazier: { key: 'et_bowl', oy: FIREBOWL_OY, h: FIREBOWL_H },
  boulder: { key: 'et_boulder', oy: BOULDER_OY, h: BOULDER_H },
  crystal: { key: 'et_crystal', oy: CRYSTAL_OY, h: CRYSTAL_H },
  obelisk: { key: 'et_obelisk', oy: OBELISK_OY, h: OBELISK_H },
};

/**
 * The Elementinho Temple around its fights: the floor plan (drawn by the
 * ground camera), fire bowls burning warm with real lights, pillars with
 * their elements' gems, boulders, crystal clusters, the Heart's four
 * obelisks, the sacred pool with bubbles rising and the lava pits spitting
 * embers, a breeze through the Gale Gallery, and motes of every element
 * drifting wherever the camera looks. No day or night: the temple lights
 * itself, and things out of view are left alone.
 */
export class TempleDungeon {
  private glows: Glow[] = [];
  private pools: Pool[] = [];
  private dust: Emitter;
  private breeze: Emitter;
  private offQuality: () => void;

  static readonly width = TEMPLE_W;
  static readonly height = TEMPLE_H;

  /** `ground` hands an image to the camera that draws the ground (and hides it from the others). */
  constructor(
    private scene: Phaser.Scene,
    ground: (img: Img) => Img,
    private view: Phaser.Geom.Rectangle,
  ) {
    warmTemple(scene);
    const add = scene.add;
    ground(add.image(0, 0, 'et_floor').setOrigin(0).setPipeline('Lit').setDepth(0));
    ground(add.image(0, 0, 'et_floor_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(2));

    TEMPLE_PROPS.forEach((p, i) => this.prop(p, i));

    // The sacred pool, bubbling; the lava pits, spitting embers.
    this.pools.push(this.pool(TIDE_POOL, 0x5ab4ff, 0.9, [0xe4f8ff, 0x8ad4f4, 0x5ab4ff], -14, 110));
    for (const p of LAVA_PITS) this.pools.push(this.pool(p, 0xff7a1a, 1.1, [0xfff8d0, 0xffc44a, 0xff6a14], -30, 70));

    // Motes of every element drifting up wherever the camera looks, embers most of all.
    this.dust = add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: view } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: 5000,
      speedX: { min: -4, max: 4 },
      speedY: { min: -10, max: -2 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.6 },
      tint: [0xffb040, 0xffd070, 0xff8a2a, 0x5ab4ff, 0x9ad84a, 0xbff4ff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 150,
    }).setDepth(9999);

    // A breeze blowing through the Gale Gallery.
    const hall = new Phaser.Geom.Rectangle(GALLERY.x0, GALLERY.y0 + 10, 40, GALLERY.y1 - GALLERY.y0 - 20);
    this.breeze = add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: hall } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 3000, max: 5200 },
      speedX: { min: 50, max: 90 },
      speedY: { min: -6, max: 6 },
      scaleX: { min: 1.6, max: 3 },
      scaleY: 0.4,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.35 },
      tint: [0xffffff, 0xbff4ff, 0xe0fcff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 110,
    }).setDepth(9998);

    this.offQuality = settings.watch((s) => {
      const k = s.quality !== 'full' ? 2 : 1;
      this.dust.frequency = 150 * k;
      this.breeze.frequency = 110 * k;
      this.pools.forEach((p, i) => (p.motes.frequency = (i === 0 ? 110 : 70) * k));
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** A glowing pool: a soft glow over it, its own light, and motes rising off it. */
  private pool(o: { cx: number; cy: number; rx: number; ry: number }, tint: number, base: number, motes: number[], rise: number, freq: number): Pool {
    const add = this.scene.add;
    const glow = add.image(o.cx, o.cy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale((o.rx * 2.4) / 32, (o.ry * 2.6) / 32).setDepth(2.6).setAlpha(0.3);
    const light = this.scene.lights.addLight(o.cx, o.cy - 10, o.rx * 2, tint, base);
    const zone = new Phaser.Geom.Ellipse(o.cx, o.cy, o.rx * 1.7, o.ry * 1.7);
    const em = add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: zone } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 900, max: 2000 },
      speedY: { min: rise, max: rise * 0.4 },
      speedX: { min: -4, max: 4 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.85 },
      tint: motes,
      blendMode: Phaser.BlendModes.ADD,
      frequency: freq,
    }).setDepth(o.cy + 40);
    return { x: o.cx, y: o.cy, glow, light, base, motes: em, seed: o.cx * 0.1 };
  }

  /** One standing prop: its lit sprite, its glow layer, a soft shadow, and for what burns or shines a halo (and some a light). */
  private prop(p: TempleProp, i: number): void {
    const art = PROP_ART[p.kind];
    const add = this.scene.add;
    const oy = art.oy / art.h;
    const el = ELEMENTS.indexOf(p.el);
    const frame = p.kind === 'pillar' ? `p${el}` : p.kind === 'crystal' ? `c${el}` : p.kind === 'obelisk' ? `o${el}` : p.kind === 'boulder' ? `b${i % 2}` : 'f0';
    const shadow = p.kind === 'boulder' ? [2.2, 1.6] : p.kind === 'crystal' ? [1, 0.8] : p.kind === 'obelisk' ? [1.6, 1.2] : [1.3, 1];
    add.image(p.x, p.y, 'shadow').setDepth(1).setScale(shadow[0], shadow[1]).setAlpha(0.8);
    add.image(p.x, p.y, art.key, frame).setOrigin(0.5, oy).setPipeline('Lit').setDepth(p.y).setFlipX(!!p.flip);
    const glow = add.sprite(p.x, p.y, `${art.key}_e`, frame).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y + 0.1).setFlipX(!!p.flip);
    const seed = hash2(i, 5, 11) * 100;
    const tint = ELEMENT_LIGHT[p.el];
    if (p.kind === 'brazier') {
      glow.play({ key: 'et_bowl_burn', startFrame: i % 4 });
      const halo = add.image(p.x, p.y - 28, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff9a3a).setScale(1).setDepth(p.y + 0.2).setAlpha(0.45);
      const light = this.scene.lights.addLight(p.x, p.y - 24, 110, 0xff9a4a, 1.15);
      this.glows.push({ x: p.x, y: p.y, halo, light, base: 1.15, radius: 110, seed, fire: true });
    } else if (p.kind === 'obelisk') {
      const halo = add.image(p.x, p.y - 26, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.8, 1.4).setDepth(p.y + 0.2).setAlpha(0.35);
      const light = this.scene.lights.addLight(p.x, p.y - 20, 80, tint, 0.8);
      this.glows.push({ x: p.x, y: p.y, halo, light, base: 0.8, radius: 80, seed, fire: false });
    } else if (p.kind === 'crystal' || p.kind === 'pillar') {
      const hy = p.kind === 'crystal' ? p.y - 9 : p.y - 30;
      const halo = add.image(p.x, hy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(p.kind === 'crystal' ? 0.6 : 0.35).setDepth(p.y + 0.2).setAlpha(0.35);
      this.glows.push({ x: p.x, y: p.y, halo, light: null, base: 0.35, radius: 0, seed, fire: false });
    }
  }

  walkable(x: number, y: number): boolean {
    return templeWalkable(x, y);
  }

  /** Warm, dim light from high windows; the fire bowls, the pool and the lava do the rest. */
  applyLighting(): void {
    sky.sunDir = [-0.2, 0.55, 0.81];
    sky.sunColor = [0.42, 0.32, 0.24];
    sky.sky = [0.46, 0.4, 0.36];
    sky.bounce = [0.22, 0.15, 0.1];
    skyState.clouds = 0;
    skyState.vignette = 0.4;
  }

  update(time: number): void {
    this.applyLighting();
    const v = this.view;
    const seen = (x: number, y: number, m: number) => x > v.left - m && x < v.right + m && y > v.top - m && y < v.bottom + m;

    for (const g of this.glows) {
      if (!seen(g.x, g.y, 70)) continue;
      const n = g.fire
        ? Math.sin(time * 0.009 + g.seed) * 0.5 + Math.sin(time * 0.023 + g.seed * 3) * 0.3 + Math.sin(time * 0.057 + g.seed * 7) * 0.2
        : Math.sin(time * 0.0018 + g.seed);
      g.halo.setAlpha(g.base * 0.35 + 0.12 + n * 0.06);
      if (g.light) {
        g.light.intensity = g.base * (0.88 + n * 0.12);
        g.light.radius = g.radius * (0.96 + n * 0.04);
      }
    }

    for (const p of this.pools) {
      const on = seen(p.x, p.y, 130);
      p.motes.emitting = on;
      if (!on) continue;
      const s = 0.85 + Math.sin(time * 0.0017 + p.seed) * 0.1 + Math.sin(time * 0.0061 + p.seed) * 0.05;
      p.glow.setAlpha(0.22 + s * 0.12);
      p.light.intensity = p.base * s;
    }
    this.breeze.emitting = seen((GALLERY.x0 + GALLERY.x1) / 2, (GALLERY.y0 + GALLERY.y1) / 2, 180);
  }

  destroy(): void {
    this.offQuality();
    for (const g of this.glows) if (g.light) this.scene.lights.removeLight(g.light);
    for (const p of this.pools) this.scene.lights.removeLight(p.light);
    this.glows = [];
    this.pools = [];
  }
}
