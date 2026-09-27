import Phaser from 'phaser';
import { CAPS_H, CAPS_OY, CRYS_H, CRYS_OY, LANTERN_H, LANTERN_OY, SHROOM_H, SHROOM_OY, SPIRE_H, SPIRE_OY, STALAG_H, STALAG_OY } from '../art/deep';
import { warmDeep } from '../art/textures';
import { hash2 } from '../art/env';
import { sky } from '../game/LitPipeline';
import { skyState } from '../game/SkyPipeline';
import { settings } from '../game/settings';
import { CHASM, DEEP_H, DEEP_PROPS, DEEP_W, GROTTO_POOL, HEART, HOLLOW, RIVER, RIVER_HW, WELL_POOL, deepWalkable, type DeepProp } from './deepLayout';

type Img = Phaser.GameObjects.Image;
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** Something that glows: its halo, and for some a real light. */
interface Glow {
  x: number;
  y: number;
  halo: Img;
  light: Phaser.GameObjects.Light | null;
  base: number;
  radius: number;
  seed: number;
  /** Flickers like a flame, or breathes slowly like living light. */
  fire: boolean;
}

/** Something that sends up motes (a pool, the river, the chasm), paused out of view. */
interface Source {
  x: number;
  y: number;
  reach: number;
  motes: Emitter;
  freq: number;
  glow: Img | null;
  light: Phaser.GameObjects.Light | null;
  base: number;
  seed: number;
}

/** Texture, frame height and feet row of each standing prop. */
const PROP_ART: Record<DeepProp['kind'], { key: string; oy: number; h: number; frame: string }> = {
  shroom: { key: 'gd_shroom', oy: SHROOM_OY, h: SHROOM_H, frame: 's' },
  caps: { key: 'gd_caps', oy: CAPS_OY, h: CAPS_H, frame: 'c' },
  stalag: { key: 'gd_stalag', oy: STALAG_OY, h: STALAG_H, frame: 't' },
  crystal: { key: 'gd_crystal', oy: CRYS_OY, h: CRYS_H, frame: 'c' },
  spire: { key: 'gd_spire', oy: SPIRE_OY, h: SPIRE_H, frame: 'p' },
  lantern: { key: 'gd_lantern', oy: LANTERN_OY, h: LANTERN_H, frame: 'f' },
};

const CYAN = 0x5ae4ff;
const PINK = 0xff6ad8;
const VIOLET = 0xb37aff;

/**
 * The Glimmerdeep around its fights: the cave floor (drawn by the ground
 * camera) and everything standing in it. Giant mushrooms glow cyan and pink,
 * the explorers' lanterns flicker warm, amethyst spires and clusters shine
 * violet. The Moonwell and the Starry Grotto's pools breathe light, the
 * river glitters, pale motes rise out of the chasm, and spores drift
 * wherever the camera looks. No day or night: the cave lights itself, and
 * things out of view are left alone.
 */
export class GlimmerDeep {
  private glows: Glow[] = [];
  private sources: Source[] = [];
  private spores: Emitter;
  private offQuality: () => void;

  static readonly width = DEEP_W;
  static readonly height = DEEP_H;

  /** `ground` hands an image to the camera that draws the ground (and hides it from the others). */
  constructor(
    private scene: Phaser.Scene,
    ground: (img: Img) => Img,
    private view: Phaser.Geom.Rectangle,
  ) {
    warmDeep(scene);
    const add = scene.add;
    ground(add.image(0, 0, 'gd_floor').setOrigin(0).setPipeline('Lit').setDepth(0));
    ground(add.image(0, 0, 'gd_floor_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(2));

    DEEP_PROPS.forEach((p, i) => this.prop(p, i));

    // The two luminous pools, breathing light, motes rising off them.
    this.sources.push(this.pool(WELL_POOL, 0x6ae8ff, 1, [0xe8fffa, 0x9af0ff, 0x5ae4ff], -12, 120));
    this.sources.push(this.pool(GROTTO_POOL, 0x8ab8ff, 0.9, [0xffffff, 0xc8e0ff, 0x8ab8ff, 0xb37aff], -10, 130));

    // The river glitters along its whole course.
    for (let i = 0; i < RIVER.length - 1; i++) {
      const [ax, ay] = RIVER[i];
      const [bx, by] = RIVER[i + 1];
      const line = new Phaser.Geom.Line(ax, ay, bx, by);
      const em = add.particles(0, 0, 'spark', {
        emitZone: { type: 'random', source: line } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: { min: 700, max: 1400 },
        speedX: { min: -6, max: 6 },
        speedY: { min: -4, max: 6 },
        scale: 0.45,
        alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.max(0, Math.sin(t * Math.PI * 2)) * 0.8 },
        tint: [0xe8fffa, 0x9af0ff, 0x5ae4ff],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 150,
      }).setDepth(3);
      // Spread across the water, not only down its middle.
      em.addEmitZone({ type: 'random', source: new Phaser.Geom.Line(ax + RIVER_HW * 0.7, ay, bx + RIVER_HW * 0.7, by) } as Phaser.Types.GameObjects.Particles.EmitZoneData);
      this.sources.push({ x: (ax + bx) / 2, y: (ay + by) / 2, reach: Math.hypot(bx - ax, by - ay) / 2 + 60, motes: em, freq: 150, glow: null, light: null, base: 0, seed: i * 13 });
    }

    // Pale motes rising slowly out of the chasm.
    const deep = new Phaser.Geom.Ellipse(CHASM.cx, CHASM.cy, CHASM.rx * 1.3, CHASM.ry * 1.2);
    const rising = add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: deep } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 2400, max: 4200 },
      speedY: { min: -16, max: -6 },
      speedX: { min: -3, max: 3 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.6 },
      tint: [0xb37aff, 0xd8c8ff, 0x7a6aff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 120,
    }).setDepth(3);
    this.sources.push({ x: CHASM.cx, y: CHASM.cy, reach: CHASM.rx + 90, motes: rising, freq: 120, glow: null, light: null, base: 0, seed: 7 });

    // The fairy ring in the Hollow and the dais in the Heart give off light of their own.
    this.sources.push(this.aura(HOLLOW.cx, HOLLOW.cy + 6, 72, PINK, 0.75, [0xff6ad8, 0xffb0ec, 0x5ae4ff], 170));
    this.sources.push(this.aura(HEART.cx, HEART.cy + 14, 90, VIOLET, 0.8, [0xb37aff, 0xead8ff, 0xffffff], 170));

    // Spores drifting everywhere the camera looks.
    this.spores = add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: view } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: 6000,
      speedX: { min: -4, max: 4 },
      speedY: { min: -7, max: 2 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.55 },
      tint: [CYAN, 0x9af0ff, PINK, 0xffb0ec, VIOLET, 0xe8fffa],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 140,
    }).setDepth(9999);

    this.offQuality = settings.watch((s) => {
      const k = s.quality !== 'full' ? 2 : 1;
      this.spores.frequency = 140 * k;
      for (const src of this.sources) src.motes.frequency = src.freq * k;
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** A glowing pool: a soft glow over it, its own light, and motes rising off it. */
  private pool(o: { cx: number; cy: number; rx: number; ry: number }, tint: number, base: number, motes: number[], rise: number, freq: number): Source {
    const add = this.scene.add;
    const glow = add.image(o.cx, o.cy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale((o.rx * 2.4) / 32, (o.ry * 2.6) / 32).setDepth(2.6).setAlpha(0.3);
    const light = this.scene.lights.addLight(o.cx, o.cy - 10, o.rx * 2.2, tint, base);
    const zone = new Phaser.Geom.Ellipse(o.cx, o.cy, o.rx * 1.7, o.ry * 1.7);
    const em = add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: zone } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 1200, max: 2400 },
      speedY: { min: rise, max: rise * 0.4 },
      speedX: { min: -3, max: 3 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.8 },
      tint: motes,
      blendMode: Phaser.BlendModes.ADD,
      frequency: freq,
    }).setDepth(o.cy + 40);
    return { x: o.cx, y: o.cy, reach: o.rx + 110, motes: em, freq, glow, light, base, seed: o.cx * 0.1 };
  }

  /** A patch of floor that glows (a fairy ring, a dais): a light over it and motes rising. */
  private aura(x: number, y: number, r: number, tint: number, base: number, motes: number[], freq: number): Source {
    const light = this.scene.lights.addLight(x, y - 12, r * 2, tint, base);
    const em = this.scene.add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(x, y, r * 2, r * 1.2) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 1600, max: 3000 },
      speedY: { min: -14, max: -5 },
      speedX: { min: -3, max: 3 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.7 },
      tint: motes,
      blendMode: Phaser.BlendModes.ADD,
      frequency: freq,
    }).setDepth(y + 60);
    return { x, y, reach: r + 120, motes: em, freq, glow: null, light, base, seed: x * 0.07 };
  }

  /** One standing prop: its lit sprite, its glow layer, a soft shadow, and for what shines a halo (and some a light). */
  private prop(p: DeepProp, i: number): void {
    const art = PROP_ART[p.kind];
    const add = this.scene.add;
    const oy = art.oy / art.h;
    const frame = p.kind === 'lantern' ? 'f0' : `${art.frame}${p.v % 2}`;
    const shadow = p.kind === 'shroom' ? [1.6, 1.2] : p.kind === 'spire' ? [1.7, 1.2] : p.kind === 'caps' ? [1.1, 0.8] : p.kind === 'lantern' ? [0.7, 0.6] : [1.2, 0.9];
    add.image(p.x, p.y, 'shadow').setDepth(1).setScale(shadow[0], shadow[1]).setAlpha(0.8);
    add.image(p.x, p.y, art.key, frame).setOrigin(0.5, oy).setPipeline('Lit').setDepth(p.y).setFlipX(!!p.flip);
    const glow = add.sprite(p.x, p.y, `${art.key}_e`, frame).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y + 0.1).setFlipX(!!p.flip);
    const seed = hash2(i, 9, 21) * 100;
    const halo = (hy: number, tint: number, sx: number, sy: number, a: number) =>
      add.image(p.x, hy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(sx, sy).setDepth(p.y + 0.2).setAlpha(a);
    const light = (hy: number, radius: number, tint: number, base: number) => this.scene.lights.addLight(p.x, hy, radius, tint, base);
    if (p.kind === 'lantern') {
      glow.play({ key: 'gd_lantern_burn', startFrame: i % 4 });
      this.glows.push({ x: p.x, y: p.y, halo: halo(p.y - 30, 0xffb060, 0.8, 0.8, 0.45), light: light(p.y - 26, 100, 0xffb060, 1.05), base: 1.05, radius: 100, seed, fire: true });
    } else if (p.kind === 'shroom') {
      // Pink caps on the odd ones, cyan on the even; every third lights the floor round it.
      const tint = p.v % 2 ? PINK : CYAN;
      const lit = i % 3 === 0;
      this.glows.push({ x: p.x, y: p.y, halo: halo(p.y - 50, tint, 1.5, 1, 0.3), light: lit ? light(p.y - 40, 120, tint, 0.85) : null, base: 0.85, radius: 120, seed, fire: false });
    } else if (p.kind === 'spire') {
      this.glows.push({ x: p.x, y: p.y, halo: halo(p.y - 40, VIOLET, 0.8, 1.6, 0.3), light: light(p.y - 34, 100, VIOLET, 0.8), base: 0.8, radius: 100, seed, fire: false });
    } else if (p.kind === 'crystal') {
      this.glows.push({ x: p.x, y: p.y, halo: halo(p.y - 12, VIOLET, 0.6, 0.6, 0.3), light: null, base: 0.3, radius: 0, seed, fire: false });
    } else if (p.kind === 'caps') {
      this.glows.push({ x: p.x, y: p.y, halo: halo(p.y - 8, p.v % 2 ? PINK : CYAN, 0.55, 0.45, 0.28), light: null, base: 0.28, radius: 0, seed, fire: false });
    }
  }

  walkable(x: number, y: number): boolean {
    return deepWalkable(x, y);
  }

  /** Deep underground: only a faint cold light; everything that grows here does the rest. */
  applyLighting(): void {
    sky.sunDir = [-0.2, 0.5, 0.84];
    sky.sunColor = [0.2, 0.22, 0.34];
    sky.sky = [0.28, 0.28, 0.42];
    sky.bounce = [0.1, 0.07, 0.18];
    skyState.clouds = 0;
    skyState.vignette = 0.45;
  }

  update(time: number): void {
    this.applyLighting();
    const v = this.view;
    const seen = (x: number, y: number, m: number) => x > v.left - m && x < v.right + m && y > v.top - m && y < v.bottom + m;

    for (const g of this.glows) {
      if (!seen(g.x, g.y, 80)) continue;
      const n = g.fire
        ? Math.sin(time * 0.009 + g.seed) * 0.5 + Math.sin(time * 0.023 + g.seed * 3) * 0.3 + Math.sin(time * 0.057 + g.seed * 7) * 0.2
        : Math.sin(time * 0.0014 + g.seed);
      g.halo.setAlpha(g.base * 0.3 + 0.12 + n * 0.06);
      if (g.light) {
        g.light.intensity = g.base * (0.86 + n * 0.14);
        g.light.radius = g.radius * (0.95 + n * 0.05);
      }
    }

    for (const s of this.sources) {
      const on = seen(s.x, s.y, s.reach);
      s.motes.emitting = on;
      if (!on) continue;
      const k = 0.85 + Math.sin(time * 0.0015 + s.seed) * 0.1 + Math.sin(time * 0.0053 + s.seed) * 0.05;
      s.glow?.setAlpha(0.2 + k * 0.12);
      if (s.light) s.light.intensity = s.base * k;
    }
  }

  destroy(): void {
    this.offQuality();
    for (const g of this.glows) if (g.light) this.scene.lights.removeLight(g.light);
    for (const s of this.sources) if (s.light) this.scene.lights.removeLight(s.light);
    this.glows = [];
    this.sources = [];
  }
}
