import Phaser from 'phaser';
import { AURORA_H, AURORA_W, BRAZIER_H, BRAZIER_OY, STATUE_H, STATUE_OY, archGlowBox } from '../art/frost';
import { T_AURORA, T_ICE, T_TEAL, T_VIOLET, SNOW_TINTS } from '../art/frostKit';
import { warmFrost } from '../art/arenaLoader';
import { sky } from '../game/LitPipeline';
import { skyState } from '../game/SkyPipeline';
import { settings } from '../game/settings';
import { snap } from '../game/display';
import type { Monster } from '../game/monsters';
import type { WaveArena } from '../game/rift';
import type { WorldScene } from '../scenes/WorldScene';
import { BRAZIERS, FROST_CX, FROST_CY, FROST_RX, FROST_RY, FROST_W, GATES, STATUES, brazierAt } from './frostLayout';

type Img = Phaser.GameObjects.Image;

/** The braziers' cold fire, and how far their light reaches. */
const FIRE = 0x7ad8ff;
const FIRE_R = 84;
/** The lake's own light, under the sigil: soft by day-less night, brighter as a wave rages. */
const LAKE_R = 170;
/** Snow falling: flakes a second (full graphics), and in a boss's blizzard. */
const SNOW_EVERY = 60;
const BLIZZARD_EVERY = 16;
/** How long the aurora takes to turn through its colours, ms. */
const AURORA_CYCLE = 26000;

interface Arch {
  gate: number;
  img: Img;
  /** How kindled it is now, and where it's going; a flare as something steps out. */
  open: number;
  goal: number;
  flare: number;
}

interface Brazier {
  light: Phaser.GameObjects.Light;
  halo: Img;
  seed: number;
}

interface Aura {
  m: Monster;
  glow: Img;
  boss: boolean;
  t: number;
}

/**
 * The Aurora Colosseum round its fight: the sky and the colosseum (drawn by
 * the ground camera), the northern lights rippling over the sky, the arches
 * of the north wall kindling cold light as a wave comes and flaring as each
 * foe steps out, the stairs puffing snow as foes climb up them, the frozen
 * champions on their plinths, braziers of blue fire along the wall, snow
 * falling (a blizzard while a boss stands), mist blown across the floor,
 * and its light: a cold moon whose sky shifts with the aurora's colours.
 * The waves themselves are run by game/rift.ts on game/frost.ts's plan.
 */
export class FrostArena implements WaveArena {
  private arches: Arch[] = [];
  private braziers: Brazier[] = [];
  private ribbons: Phaser.GameObjects.TileSprite[] = [];
  private glowLayer: Img;
  private lake: Phaser.GameObjects.Light;
  private snow: Phaser.GameObjects.Particles.ParticleEmitter;
  private blizzard: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Where the flakes start: a strip along the top of the view, moved with it. */
  private snowZone = new Phaser.Geom.Rectangle(-40, -12, 1, 1);
  private mists: { img: Img; x: number; y: number; speed: number; seed: number }[] = [];
  private auras: Aura[] = [];
  private offQuality: () => void;
  /** 0 calm .. 1 a wave raging; and a boss on the floor. */
  private fury = 0;
  private furyGoal = 0;
  private storm = 0;

  /** `ground` hands an image to the camera that draws the ground (and hides it from the others). */
  constructor(
    private world: WorldScene,
    ground: (img: Img | Phaser.GameObjects.TileSprite) => Img | Phaser.GameObjects.TileSprite,
    private view: Phaser.Geom.Rectangle,
  ) {
    warmFrost(world);
    const add = world.add;
    ground(add.image(0, 0, 'fz_sky').setOrigin(0).setDepth(-3));
    // The northern lights, two curtains drifting each their own way behind the colosseum.
    [0, 1].forEach((i) => {
      const r = ground(add.tileSprite(0, i * 22 - 8, FROST_W, AURORA_H, `fz_aurora${i}`).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(-2.5).setAlpha(0.4)) as Phaser.GameObjects.TileSprite;
      this.ribbons.push(r);
    });
    ground(add.image(0, 0, 'fz_arena').setOrigin(0).setPipeline('Lit').setDepth(0));
    this.glowLayer = ground(add.image(0, 0, 'fz_arena_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(1)) as Img;

    // The arches' light, out until a wave comes.
    GATES.forEach((g, i) => {
      if (g.kind !== 'arch') return;
      const box = archGlowBox(g);
      const img = ground(add.image(box.x, box.y, `fz_arch${i}`).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(1.5).setAlpha(0)) as Img;
      this.arches.push({ gate: i, img, open: 0, goal: 0, flare: 0 });
    });

    // The frozen champions, each on its plinth.
    for (const s of STATUES) {
      const oy = STATUE_OY / STATUE_H;
      add.image(s.x, s.y + 1, 'shadow').setDepth(1).setAlpha(0.55).setScale(2.2, 1.4);
      add.image(s.x, s.y, 'fz_statue', `s${s.v}`).setOrigin(0.5, oy).setPipeline('Lit').setDepth(s.y);
      add.image(s.x, s.y, 'fz_statue_e', `s${s.v}`).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(s.y + 0.1);
    }

    // Braziers along the wall's top: cold fire, its light flickering.
    BRAZIERS.forEach((deg, i) => {
      const b = brazierAt(deg);
      const oy = BRAZIER_OY / BRAZIER_H;
      add.sprite(b.x, b.y, 'fz_brazier', 'f0').setOrigin(0.5, oy).setPipeline('Lit').setDepth(b.foot).play({ key: 'fz_brazier_burn', startFrame: i % 6 });
      add.sprite(b.x, b.y, 'fz_brazier_e', 'f0').setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(b.foot + 0.1).play({ key: 'fz_brazier_glow', startFrame: i % 6 });
      const halo = add.image(b.x, b.y - 24, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(FIRE).setDepth(b.foot + 0.2).setAlpha(0.3).setScale(0.9);
      const light = world.lights.addLight(b.x, b.y - 22, FIRE_R, FIRE, 0.75);
      this.braziers.push({ light, halo, seed: i * 2.3 });
    });

    this.lake = world.lights.addLight(FROST_CX, FROST_CY - 6, LAKE_R, T_TEAL, 0.35);

    // Snow drifting down across the view, blown a little from the east; a blizzard for the bosses.
    const flakes = (every: number, wind: number, fall: [number, number]) =>
      add.particles(0, 0, 'fz_flake', {
        emitZone: { type: 'random', source: this.snowZone } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: { min: 7000, max: 11000 },
        speedY: { min: fall[0], max: fall[1] },
        speedX: { min: wind - 6, max: wind + 4 },
        scale: { min: 0.5, max: 1 },
        alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.min(1, t * 6, (1 - t) * 4) * 0.85 },
        frequency: every,
      }).setDepth(9999);
    this.snow = flakes(SNOW_EVERY, -8, [12, 26]);
    this.blizzard = flakes(BLIZZARD_EVERY, -70, [34, 60]);
    this.blizzard.emitting = false;

    // Mist blown across the floor.
    for (let i = 0; i < 5; i++) {
      const x = FROST_CX - FROST_RX + ((i * 137) % (FROST_RX * 2));
      const y = FROST_CY - FROST_RY * 0.6 + i * FROST_RY * 0.3;
      const img = add.image(x, y, 'fz_mist').setDepth(3).setAlpha(0).setScale(3, 2.2);
      this.mists.push({ img, x, y, speed: 6 + (i % 3) * 3, seed: i * 1.7 });
    }

    this.offQuality = settings.watch((s) => {
      this.snow.frequency = s.quality !== 'full' ? SNOW_EVERY * 2 : SNOW_EVERY;
      this.blizzard.frequency = s.quality !== 'full' ? BLIZZARD_EVERY * 2 : BLIZZARD_EVERY;
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** A wave is coming (the arches kindle) or is done (their light sinks). */
  setWave(on: boolean): void {
    this.furyGoal = on ? 1 : 0;
    for (const a of this.arches) a.goal = on ? 1 : 0;
  }

  /** Something steps out of gate `i`: its arch flares, or snow bursts at the head of its stair. */
  flare(i: number): void {
    const g = GATES[i];
    if (!g) return;
    const a = this.arches.find((x) => x.gate === i);
    if (a) a.flare = 1;
    this.world.debris(SNOW_TINTS, snap(g.ox), snap(g.oy), 7, g.oy + 1, 'spores');
    const puff = this.world.add.image(snap(g.ox), snap(g.oy - 4), 'fz_mist').setDepth(g.oy + 2).setAlpha(0.55).setScale(1.2, 1);
    this.world.tweens.add({ targets: puff, alpha: 0, scaleX: 2.6, scaleY: 1.8, y: g.oy - 10, duration: 900, ease: 'Sine.easeOut', onComplete: () => puff.destroy() });
  }

  /** An elite stepped out (a cold glow about its feet), or a boss (the snow turns to a blizzard while it stands). */
  dress(m: Monster, as: 'champion' | 'boss' | 'elite'): void {
    const boss = as === 'boss';
    const glow = this.world.add.image(m.x, m.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(boss ? T_VIOLET : T_ICE).setAlpha(0).setDepth(2);
    this.auras.push({ m, glow, boss, t: 0 });
  }

  /** No sun here: the moon's cold light, its sky turning slowly through the aurora's colours. */
  applyLighting(time: number): void {
    const a = (time % AURORA_CYCLE) / AURORA_CYCLE;
    const g = 0.5 + 0.5 * Math.sin(a * Math.PI * 2);
    sky.sunDir = [-0.3, 0.5, 0.8];
    sky.sunColor = [0.46 - this.storm * 0.06, 0.56 - this.storm * 0.06, 0.82 - this.storm * 0.04];
    sky.sky = [0.34 + (1 - g) * 0.05, 0.44 + g * 0.06, 0.64 + (1 - g) * 0.04];
    sky.bounce = [0.08 + (1 - g) * 0.08, 0.18 + g * 0.08, 0.24];
    skyState.clouds = 0;
    skyState.vignette = 0.36 + this.storm * 0.08;
  }

  update(time: number, dt: number): void {
    this.applyLighting(time);
    this.fury += (this.furyGoal - this.fury) * Math.min(1, dt / 900);
    // A boss on the floor brings the blizzard; it eases off once the last falls.
    const bossUp = this.auras.some((a) => a.boss && a.m.alive);
    this.storm += ((bossUp ? 1 : 0) - this.storm) * Math.min(1, dt / 1600);
    this.blizzard.emitting = this.storm > 0.3;

    const beat = 0.5 + 0.5 * Math.sin(time * (0.0016 + this.fury * 0.003));
    this.glowLayer.setAlpha(0.78 + this.fury * 0.22 * beat);
    this.lake.intensity = 0.32 + this.fury * 0.4 * beat + this.storm * 0.2;
    const hue = (time % AURORA_CYCLE) / AURORA_CYCLE;
    this.lake.color.set(0.3 + this.storm * 0.4, 0.9 - this.storm * 0.3 - hue * 0.1, 0.85);

    // The aurora drifts and breathes; it blazes while a wave rages.
    this.ribbons.forEach((r, i) => {
      r.tilePositionX = (time * (i ? -0.004 : 0.006)) % AURORA_W;
      r.setAlpha(0.32 + 0.12 * Math.sin(time * 0.0007 + i * 2) + this.fury * 0.12 + this.storm * 0.12);
      r.setTint(this.storm > 0.5 ? (i ? T_VIOLET : T_TEAL) : i ? T_TEAL : T_AURORA);
    });

    for (const a of this.arches) {
      a.open += (a.goal - a.open) * Math.min(1, dt / 500);
      a.flare = Math.max(0, a.flare - dt / 500);
      a.img.setAlpha(Math.min(1, a.open * (0.55 + 0.15 * Math.sin(time * 0.005 + a.gate)) + a.flare * 0.6));
    }

    for (const b of this.braziers) {
      const f = 0.85 + 0.15 * Math.sin(time * 0.013 + b.seed) * Math.sin(time * 0.007 + b.seed * 2);
      b.light.intensity = (0.7 + this.fury * 0.15) * f;
      b.halo.setAlpha(0.24 * f + this.fury * 0.06);
    }

    // The snow falls from the top of the view, wherever the camera is.
    const v = this.view;
    for (const e of [this.snow, this.blizzard]) e.setPosition(v.x, v.y);
    this.snowZone.setTo(-40, -12, v.width + 120, 4);

    for (const m of this.mists) {
      m.x += m.speed * (1 + this.storm * 4) * dt / 1000 * -1;
      if (m.x < FROST_CX - FROST_RX - 40) m.x = FROST_CX + FROST_RX + 40;
      const edge = 1 - Math.abs(m.x - FROST_CX) / (FROST_RX + 40);
      m.img.setPosition(snap(m.x), snap(m.y + Math.sin(time * 0.0005 + m.seed) * 4)).setAlpha(Math.max(0, edge) * (0.16 + this.storm * 0.14));
    }

    this.auras = this.auras.filter((a) => {
      if (!a.m.alive) {
        a.glow.destroy();
        return false;
      }
      a.t += dt;
      const s = a.boss ? 2.4 : 0.9 * a.m.size;
      a.glow.setPosition(snap(a.m.x), snap(a.m.y - 2)).setScale(s, s * 0.45).setAlpha(Math.min(0.5, a.t / 600) * (0.75 + 0.25 * Math.sin(time * 0.006)));
      if (!a.boss && Math.random() < dt / 260) this.world.debris([T_ICE, 0xffffff], snap(a.m.x + (Math.random() - 0.5) * 14), snap(a.m.y - 6 - Math.random() * 14), 1, a.m.y + 1, 'spores');
      return true;
    });
  }

  destroy(): void {
    this.offQuality();
    for (const b of this.braziers) this.world.lights.removeLight(b.light);
    this.world.lights.removeLight(this.lake);
    this.braziers = [];
    for (const a of this.auras) a.glow.destroy();
    this.auras = [];
  }
}
