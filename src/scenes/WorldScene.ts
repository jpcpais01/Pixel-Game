import Phaser from 'phaser';
import { controls } from '../game/controls';
import { sunShadow, SUN_SHADOW_ALPHA } from '../game/Wizard';
import { EnergyBall } from '../game/EnergyBall';
import { Beam } from '../game/Beam';
import type { SpellStyle } from '../game/spells';
import { daynight } from '../game/daynight';
import { settings } from '../game/settings';
import { sky } from '../game/LitPipeline';
import { pixelGrid, snap } from '../game/display';
import { PixelPipeline } from '../game/PixelPipeline';
import { skyState } from '../game/SkyPipeline';
import { characterById, type Hero } from '../game/characters';
import { areaOrigin, reaches, type Harm, type Hit, type Hurtbox, type MeleeArea, type Strike } from '../game/combat';
import { HealthBar } from '../game/HealthBar';
import { HealPop } from '../game/Holy';
import type { Effect } from '../game/Slash';
import { separate, Spawner, type Monster, type SpawnSpot } from '../game/monsters';
import { PLAZA_CX, PLAZA_CY, PLAZA_H, PLAZA_Y, WORLD_H, WORLD_W, freeBox, pathHalfW, pathX, walkable } from '../world/layout';
import { GroundStreamer } from '../world/GroundStreamer';
import { Forest } from '../world/Forest';
import { FOREST_SPAWNS, regionAt, type Region } from '../world/regions';

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
import { sound } from '../audio';

export { WORLD_W, WORLD_H } from '../world/layout';

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

export type { MeleeArea } from '../game/combat';

/** The starting plaza's monsters, around the edge of the clearing (plaza coordinates). */
const PLAZA_SPAWNS: SpawnSpot[] = [
  { kind: 'frog', x: 150, y: 118 },
  { kind: 'frog', x: 522, y: 334 },
  { kind: 'puffcap', x: 470, y: 104 },
  { kind: 'puffcap', x: 494, y: 122 },
  { kind: 'puffcap', x: 462, y: 130 },
  { kind: 'beetle', x: 148, y: 342 },
].map((s) => ({ ...s, kind: s.kind as SpawnSpot['kind'], y: s.y + PLAZA_Y }));

/** How long the hero lies fallen before rising again at the plaza. */
const DOWN_TIME = 3500;
/** Invulnerable this long after being struck, and after rising. */
const HURT_GRACE = 550;
const RISE_GRACE = 2200;
/** The hero's body, for monster hits: centre height above the feet, and radius. */
const HERO_BODY_Y = 11;
const HERO_RADIUS = 6;

/** A straw training dummy: struck like a monster, but never falls. */
class Dummy implements Hurtbox {
  readonly bodyY = 11;
  readonly radius = 6;
  readonly alive = true;
  wobble = 0;

  constructor(
    private world: WorldScene,
    readonly sprite: Phaser.GameObjects.Sprite,
    readonly x: number,
    readonly y: number,
  ) {}

  hurt(hit: Hit): void {
    this.wobble = hit.heavy ? 1.4 : 1;
    this.sprite.setFrame('d1');
    this.world.time.delayedCall(90, () => this.sprite.setFrame('d0'));
    this.world.popNumber(this.x, this.y - 30, `${Math.round(hit.damage)}`, hit.heavy ? 0xffe28a : 0xffffff);
  }
}

export class WorldScene extends Phaser.Scene {
  private hero!: Hero;
  private worldRect = new Phaser.Geom.Rectangle(0, 0, WORLD_W, WORLD_H);
  private balls: EnergyBall[] = [];
  private beams: Beam[] = [];
  private flickers: Flicker[] = [];
  private dummies: Dummy[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private struck = false;
  /** The world's outer edge; within it, `walkable` decides where feet may go. */
  private bounds = new Phaser.Geom.Rectangle(8, 10, WORLD_W - 16, WORLD_H - 34);
  /** How far the hero may step this frame before bumping into something. */
  private heroBox = new Phaser.Geom.Rectangle();
  /** Where monsters may roam: the world's edge, and `walkable` within it. */
  get monsterBounds(): Phaser.Geom.Rectangle {
    return this.bounds;
  }
  /** Can feet stand at (x, y)? Trees, the forest's edge and the plaza's walls say no. */
  walkable(x: number, y: number): boolean {
    return walkable(x, y);
  }
  private ground!: GroundStreamer;
  private forest!: Forest;
  /** The camera's view of the world, in world pixels. */
  private view = new Phaser.Geom.Rectangle();
  private region: Region | null = null;
  private banner: Phaser.GameObjects.BitmapText | null = null;
  private spawners: Spawner[] = [];
  private effects: Effect[] = [];
  private debrisEmitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private heroBar!: HealthBar;
  private spawnX = 0;
  private spawnY = 0;
  /** Time left lying fallen, or 0 while standing. */
  private downT = 0;
  private grace = 0;
  private rising = false;
  private hurtTint = 0;
  private pushX = 0;
  private pushY = 0;
  private fallen: Phaser.GameObjects.BitmapText | null = null;
  private shafts!: Phaser.GameObjects.TileSprite;
  private shadows: Phaser.GameObjects.Image[] = [];
  private pollen!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireflies!: Phaser.GameObjects.Particles.ParticleEmitter;
  private pixels!: PixelPipeline;
  /** Draws the ground at art resolution, under the main camera's sprites. */
  private groundCam!: Phaser.Cameras.Scene2D.Camera;
  /** Cloud shadows and the vignette, drawn in one pass (see SkyPipeline). */
  private skyLayer!: Phaser.GameObjects.Image;

  constructor() {
    super('world');
  }

  create(data: { character?: string }): void {
    // The scene object is reused when a new game starts from the home screen.
    this.balls = [];
    this.beams = [];
    this.flickers = [];
    this.dummies = [];
    this.shadows = [];
    this.spawners = [];
    this.effects = [];
    this.debrisEmitters = new Map();
    this.downT = this.grace = this.hurtTint = this.pushX = this.pushY = 0;
    this.fallen = null;
    this.region = null;
    this.banner = null;
    const cx = PLAZA_CX;
    const cy = PLAZA_CY;

    // Ambient comes from the Lit pipeline's sky and sun, driven by daynight.
    this.lights.enable().setAmbientColor(0x000000);

    // The full-screen ground layers are the costly part to light, so a second
    // camera draws only them, at art resolution, before the main camera draws
    // everything else over them at full resolution (see PixelPipeline).
    const cam = this.cameras.main;
    this.groundCam = this.cameras.add(0, 0, cam.width, cam.height, false, 'ground');
    const order = this.cameras.cameras;
    order.splice(order.indexOf(this.groundCam), 1);
    order.unshift(this.groundCam);
    this.groundCam.setPostPipeline('Pixel').setRoundPixels(false);
    this.pixels = this.groundCam.getPostPipeline('Pixel') as PixelPipeline;
    const groundCam = this.groundCam;
    const hideFromGround = (obj: Phaser.GameObjects.GameObject) => groundCam.ignore(obj);
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, hideFromGround);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, hideFromGround));
    const ground = (obj: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite) => {
      obj.cameraFilter &= ~groundCam.id;
      cam.ignore(obj);
      return obj;
    };

    // The ground streams in strips as the hero walks (see GroundStreamer).
    this.ground = new GroundStreamer(this, (img) => ground(img) as Phaser.GameObjects.Image);

    // Faint shafts of sunlight over the plaza's ground; the forest has its
    // own, falling through the leaves. Drifting cloud shadows are drawn over
    // everything, with the vignette (see below).
    this.shafts = ground(this.add.tileSprite(0, PLAZA_Y, WORLD_W, PLAZA_H, 'shafts').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(3)) as Phaser.GameObjects.TileSprite;

    // Motes drift wherever the camera looks.
    const view = this.view;
    this.pollen = this.add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: view } as Phaser.Types.GameObjects.Particles.EmitZoneData,
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
      emitZone: { type: 'random', source: view } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 2500, max: 4500 },
      speed: { min: 2, max: 7 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.max(0, Math.sin(t * Math.PI * 3)) },
      tint: [0xd8ff7a, 0xf6ffb0, 0x9dffb0],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 160,
    }).setDepth(9999);

    // Half the drifting motes on Fast graphics.
    const offQuality = settings.watch((s) => {
      const k = s.quality === 'fast' ? 2 : 1;
      this.pollen.frequency = 90 * k;
      this.fireflies.frequency = 160 * k;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offQuality);

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
    this.crystals(cx + 50, cy - r - 40, 'c1');

    const R = new Phaser.Math.RandomDataGenerator(['rocks']);
    for (let i = 0; i < 18; i++) {
      const a = R.frac() * Math.PI * 2;
      const d = r + 30 + R.frac() * 120;
      const x = cx + Math.cos(a) * d * 1.3;
      const y = cy + Math.sin(a) * d;
      // Keep the lawn's edge and the way north clear.
      if (x < 16 || y < PLAZA_Y + 44 || x > WORLD_W - 16 || y > WORLD_H - 8) continue;
      if (Math.abs(x - pathX(y)) < pathHalfW(y) + 12) continue;
      this.add.image(Math.round(x), Math.round(y), 'rock', `r${i % 3}`).setOrigin(0.5, 12 / 14).setPipeline('Lit').setDepth(y);
      this.shadows.push(sunShadow(this.add.image(Math.round(x), Math.round(y), 'rock_s', `r${i % 3}`).setOrigin(0.5, 12 / 14)));
    }

    this.dummy(cx + 64, cy - 8);
    this.dummy(cx - 70, cy + 34);

    this.spawnX = cx;
    this.spawnY = cy + 20;
    this.hero = characterById(data?.character).spawn(this, this.spawnX, this.spawnY);
    this.heroBar = new HealthBar(this);
    this.spawners.push(new Spawner(this, PLAZA_SPAWNS));
    this.spawners.push(new Spawner(this, FOREST_SPAWNS));
    this.forest = new Forest(this);

    // Screen-fixed; it covers the ground camera's image too, as it draws first.
    this.skyLayer = this.add.image(0, 0, 'clouds').setScrollFactor(0).setDepth(20000).setPipeline('Sky');
    this.setVignette(0.32 - Phaser.Math.Easing.Sine.InOut(daynight.daylight) * 0.14);
    cam.fadeIn(500, 7, 8, 13);
    this.fitCamera();
    this.followHero();
    this.ground.prime(this.view);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this));

    const kb = this.input.keyboard!;
    kb.on('keydown-N', () => daynight.toggle());
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,K,SHIFT,N') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  castEnergyBall(x: number, y: number, dx: number, dy: number, style?: SpellStyle): void {
    this.balls.push(new EnergyBall(this, x, y, dx, dy, style));
    sound.cast(this.pan(x));
  }

  /** A beam from (x, y) along (dx, dy); `depth` sorts it against the caster. */
  fireBeam(x: number, y: number, dx: number, dy: number, power: number, depth: number, style?: SpellStyle): void {
    const strike: Strike = { damage: Math.round(3 + 5 * power), knock: 40 + 40 * power, fromX: x, fromY: y };
    this.beams.push(new Beam(this, x, y, dx, dy, power, this.worldRect, depth, (x0, y0, x1, y1, r) => this.beamHit(x0, y0, x1, y1, r, strike), style));
    sound.beamFire(this.pan(x), power);
  }

  /** Everything the heroes can strike right now. */
  private hurtboxes(): Hurtbox[] {
    const out: Hurtbox[] = [...this.dummies];
    for (const sp of this.spawners) for (const m of sp.monsters) if (m.alive) out.push(m);
    return out;
  }

  /**
   * A blow over an area. Everything whose body falls inside `area` is struck;
   * returns where each blow landed (on the side facing the blow), for sparks
   * and sound. `strike` may be a bare `heavy` flag, which deals a default hit.
   */
  melee(area: MeleeArea, strike: Strike | boolean): { x: number; y: number }[] {
    const s: Strike = typeof strike === 'boolean' ? { damage: strike ? 16 : 10, heavy: strike } : strike;
    const o = areaOrigin(area);
    const hit = this.toHit(s, o.x, o.y);
    const hits: { x: number; y: number }[] = [];
    for (const h of this.hurtboxes()) {
      const bx = h.x;
      const by = h.y - h.bodyY;
      if (!reaches(area, bx, by, h.radius)) continue;
      h.hurt(hit);
      const l = Math.hypot(o.x - bx, o.y - by) || 1;
      hits.push({ x: bx + ((o.x - bx) / l) * (h.radius - 1), y: by + ((o.y - by) / l) * (h.radius - 2) });
    }
    return hits;
  }

  /** A projectile at (x, y): strikes the first body there. Returns whether it hit. */
  strikeAt(x: number, y: number, strike: Strike): boolean {
    for (const h of this.hurtboxes()) {
      const dx = (x - h.x) / (h.radius + 2);
      const dy = (y - (h.y - h.bodyY)) / (h.bodyY + 3);
      if (dx * dx + dy * dy > 1) continue;
      h.hurt(this.toHit(strike, x, y));
      return true;
    }
    return false;
  }

  private toHit(s: Strike, x: number, y: number): Hit {
    return { damage: s.damage, heavy: !!s.heavy, knock: s.knock ?? (s.heavy ? 130 : 60), fromX: s.fromX ?? x, fromY: s.fromY ?? y };
  }

  /** A monster's blow lands on the hero if its reach (a circle at (x, y)) touches the hero's body. */
  hurtHeroAt(x: number, y: number, radius: number, harm: Harm): boolean {
    if (this.downT > 0) return false;
    if (Math.hypot(this.hero.x - x, this.hero.y - HERO_BODY_Y - y) > radius + HERO_RADIUS) return false;
    this.hurtHero(harm);
    return true;
  }

  /** A burst over an ellipse on the ground centred at (x, y). */
  hurtHeroInEllipse(x: number, y: number, rx: number, ry: number, harm: Harm): boolean {
    if (this.downT > 0) return false;
    const dx = (this.hero.x - x) / (rx + HERO_RADIUS - 2);
    const dy = (this.hero.y - y) / (ry + 3);
    if (dx * dx + dy * dy > 1) return false;
    this.hurtHero(harm);
    return true;
  }

  /** Damage the hero, unless they are down or still in their grace window. */
  hurtHero(harm: Harm): void {
    const h = this.hero;
    if (this.downT > 0 || this.grace > 0) return;
    const lost = h.vitals.damage(harm.damage);
    this.grace = HURT_GRACE;
    this.rising = false;
    this.popNumber(snap(h.x), snap(h.y) - 38, `-${Math.round(harm.damage)}`, lost > 0 ? 0xff8a78 : 0xffd35c);
    h.sprite.setTint(0xff8070);
    this.hurtTint = 140;
    const dx = h.x - harm.fromX;
    const dy = h.y - HERO_BODY_Y - harm.fromY;
    const l = Math.hypot(dx, dy) || 1;
    const k = harm.knock ?? 60;
    this.pushX = (dx / l) * k;
    this.pushY = (dy / l) * k;
    this.cameras.main.shake(120, 0.0006);
    sound.hurt();
    if (!h.vitals.alive) this.fall();
  }

  private fall(): void {
    const h = this.hero;
    this.downT = DOWN_TIME;
    this.pushX = this.pushY = 0;
    this.debris([0xffffff, 0xdff8ff, 0xb0c8ff], snap(h.x), snap(h.y) - 12, 20, h.y + 20, 'spores');
    this.fallen = this.add.bitmapText(Math.round(h.x), Math.round(h.y) - 40, 'pixel', 'FALLEN').setLetterSpacing(-1).setOrigin(0.5, 1).setTint(0xffb0a0).setDepth(10002).setAlpha(0);
    sound.fall();
  }

  private rise(): void {
    const h = this.hero;
    h.x = this.spawnX;
    h.y = this.spawnY;
    h.vitals.reset();
    this.grace = RISE_GRACE;
    this.rising = true;
    this.fallen?.destroy();
    this.fallen = null;
    this.debris([0xfffdf0, 0xfff0a8, 0xffd35c], snap(h.x), snap(h.y) - 12, 24, h.y + 20, 'spores');
    sound.revive();
  }

  /** The hero's life: falling, rising, hit tint, knockback and the health bar. */
  private updateHeroLife(dt: number): void {
    const h = this.hero;
    this.grace = Math.max(0, this.grace - dt);
    if (this.hurtTint > 0) {
      this.hurtTint -= dt;
      if (this.hurtTint <= 0) h.sprite.clearTint();
    }
    if (this.downT > 0) {
      this.downT -= dt;
      const t = DOWN_TIME - this.downT;
      h.alpha = Math.max(0, 1 - t / 700);
      this.fallen?.setAlpha(Phaser.Math.Clamp((t - 300) / 400, 0, 1)).setPosition(Math.round(h.x), Math.round(h.y) - 40 - Math.min(6, t / 250));
      if (this.downT <= 0) {
        this.downT = 0;
        this.rise();
      }
    } else if (this.rising && this.grace > 0) {
      // Blinks while the grace after rising lasts.
      h.alpha = Math.sin(this.grace * 0.03) > -0.3 ? 1 : 0.35;
    } else {
      h.alpha = 1;
    }
    if (this.pushX || this.pushY) {
      // Knocked back, but never into a tree or through the forest's edge.
      const nx = h.x + (this.pushX * dt) / 1000;
      const ny = h.y + (this.pushY * dt) / 1000;
      if (walkable(nx, h.y)) h.x = nx;
      else this.pushX = 0;
      if (walkable(h.x, ny)) h.y = ny;
      else this.pushY = 0;
      const k = Math.exp(-dt / 80);
      this.pushX *= k;
      this.pushY *= k;
      if (Math.abs(this.pushX) + Math.abs(this.pushY) < 2) this.pushX = this.pushY = 0;
    }
    const v = h.vitals;
    this.heroBar.update(dt, snap(h.x), snap(h.y) - 34, this.downT > 0 ? 0 : v.hp, v.max, v.barrier);
  }

  /** A number (or word) that floats up and fades: damage dealt and taken. */
  popNumber(x: number, y: number, text: string, tint: number): void {
    this.effects.push(new HealPop(this, x + Math.round((Math.random() - 0.5) * 6), y, text, tint));
  }

  /** Let the world update an effect each frame until it is dead. */
  addEffect(e: Effect): void {
    this.effects.push(e);
  }

  /**
   * A burst of light specks, from one shared emitter per palette and style:
   * 'burst' flies apart, 'spores' drifts up slowly, 'trail' barely moves,
   * 'gather' fades in and out in place.
   */
  debris(tints: number[], x: number, y: number, count: number, depth: number, style: 'burst' | 'spores' | 'trail' | 'gather' = 'burst'): void {
    const key = `${style}:${tints.join()}`;
    let e = this.debrisEmitters.get(key);
    if (!e) {
      const base = { tint: tints, blendMode: Phaser.BlendModes.ADD, emitting: false };
      const cfg: Record<string, Phaser.Types.GameObjects.Particles.ParticleEmitterConfig> = {
        burst: { ...base, lifespan: { min: 250, max: 600 }, speed: { min: 20, max: 70 }, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 } },
        spores: { ...base, lifespan: { min: 700, max: 1300 }, speed: { min: 10, max: 42 }, gravityY: -18, scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 } },
        trail: { ...base, lifespan: { min: 200, max: 420 }, speed: { min: 2, max: 10 }, scale: { start: 1, end: 0 }, alpha: { start: 0.9, end: 0 } },
        gather: { ...base, lifespan: 260, speed: { min: 2, max: 8 }, scale: 0.5, alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) } },
      };
      e = this.add.particles(0, 0, 'spark', cfg[style]);
      this.debrisEmitters.set(key, e);
    }
    e.setDepth(depth).explode(count, x, y);
  }
  /**
   * Keep the camera locked on the hero, snapped to device pixels. The
   * hero snaps to the same grid, so they hold still on screen and stays
   * crisp, while the world scrolls in smooth sub-art-pixel steps.
   *
   * The ground camera can only scroll in whole art pixels, so it takes the
   * whole part and its image is shifted by the device pixels left over.
   */
  private followHero(): void {
    const cam = this.cameras.main;
    const z = cam.zoom;
    const halfW = cam.width / 2;
    const halfH = cam.height / 2;
    const viewW = cam.width / z;
    const viewH = cam.height / z;
    // Scroll is measured to the unzoomed viewport's top-left; zoom pivots on its centre.
    const minX = viewW / 2 - halfW;
    const maxX = WORLD_W - viewW / 2 - halfW;
    const minY = viewH / 2 - halfH;
    const maxY = WORLD_H - viewH / 2 - halfH;
    const tx = this.hero.x - halfW;
    const ty = this.hero.y - 12 - halfH;
    const sx = maxX < minX ? (minX + maxX) / 2 : Phaser.Math.Clamp(tx, minX, maxX);
    const sy = maxY < minY ? (minY + maxY) / 2 : Phaser.Math.Clamp(ty, minY, maxY);
    // Screen x = (worldX - scroll) * z + half * (1 - z). Choose scroll so the
    // constant part lands on a whole device pixel: scroll = (k + c) / z.
    const cx = halfW * (1 - z);
    const cy = halfH * (1 - z);
    // A shake moves the whole view, ground and props alike, by whole device
    // pixels. Phaser would only shift the main camera's image, by fractions.
    const shake = cam.shakeEffect as unknown as { isRunning: boolean; _offsetX: number; _offsetY: number };
    let dx = 0;
    let dy = 0;
    if (shake.isRunning) {
      dx = Math.round(shake._offsetX * z);
      dy = Math.round(shake._offsetY * z);
      shake._offsetX = 0;
      shake._offsetY = 0;
    }
    const kx = Math.round(sx * z - cx) - dx;
    const ky = Math.round(sy * z - cy) - dy;
    cam.scrollX = (kx + cx) / z;
    cam.scrollY = (ky + cy) / z;
    const ax = Math.floor(kx / z);
    const ay = Math.floor(ky / z);
    this.groundCam.scrollX = ax + cx / z;
    this.groundCam.scrollY = ay + cy / z;
    this.pixels.offsetX = kx - ax * z;
    this.pixels.offsetY = ky - ay * z;
    // Scroll is to the unzoomed viewport's top-left, and the zoom pivots on its centre.
    this.view.setTo(cam.scrollX + halfW - viewW / 2, cam.scrollY + halfH - viewH / 2, viewW, viewH);
  }

  /**
   * Layers the profiler's GPU test turns off one at a time: each entry hides
   * its layer and returns the function that brings it back.
   */
  benchLayers(): [string, () => () => void][] {
    const hide = (o: { visible: boolean; setVisible(v: boolean): unknown }) => () => {
      const was = o.visible;
      o.setVisible(false);
      return () => o.setVisible(was);
    };
    const unlit = () => {
      type Piped = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Pipeline;
      const lit = this.children.list.filter((o): o is Piped => (o as Partial<Piped>).pipeline?.name === 'Lit');
      for (const o of lit) o.resetPipeline();
      return () => {
        for (const o of lit) if (o.active) o.setPipeline('Lit');
      };
    };
    const ui = () => {
      this.scene.setVisible(false, 'ui');
      return () => this.scene.setVisible(true, 'ui');
    };
    return [
      ['SKY', hide(this.skyLayer)],
      ['LIGHTING', unlit],
      ['GROUND', hide(this.groundCam)],
      ['SPRITES', hide(this.cameras.main)],
      ['HUD', ui],
    ];
  }

  private fitCamera(): void {
    const { width, height } = this.scale;
    // Set with the canvas size: whole device pixels per art pixel.
    const zoom = pixelGrid.zoom;
    this.pixels.zoom = zoom;
    // We snap to device pixels ourselves; Phaser's rounding would snap the
    // camera to whole art pixels, which makes scrolling steppy.
    this.cameras.main.setZoom(zoom).setRoundPixels(false);
    this.groundCam.setSize(width, height).setZoom(zoom);
    this.fitSky();
  }

  /** Cover the screen. The zoom pivots on the camera's centre, which is where a scroll-fixed object sits. */
  private fitSky(): void {
    const { width, height } = this.scale;
    const zoom = pixelGrid.zoom;
    this.skyLayer.setPosition(width / 2, height / 2).setDisplaySize(width / zoom, height / zoom);
  }

  /** Vignette strength, as Phaser's vignette effect; drawn by SkyPipeline. */
  private setVignette(strength: number): void {
    skyState.vignette = strength;
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
    this.dummies.push(new Dummy(this, sprite, x, y));
  }

  /** The energy ball's hit test. */
  private hitTest = (x: number, y: number): boolean => {
    if (!this.strikeAt(x, y, { damage: 12, knock: 80 })) return false;
    this.cameras.main.shake(70, 0.00035);
    this.struck = true;
    return true;
  };

  /** Everything within `radius` of the beam's line takes a hit and throws off a burst of light. */
  private beamHit(x0: number, y0: number, x1: number, y1: number, radius: number, strike: Strike): void {
    for (const p of this.melee({ kind: 'line', x0, y0, x1, y1, radius }, strike)) {
      const burst = this.add
        .sprite(Math.round(p.x), Math.round(p.y), 'burst_e', 'b0')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(p.y + 12)
        .play('burst_pop');
      burst.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => burst.destroy());
    }
  }

  /** Ease toward the chosen time of day and push it into every layer. */
  private updateDaylight(time: number, dt: number): number {
    const step = dt / 1400;
    daynight.daylight += Phaser.Math.Clamp(daynight.target - daynight.daylight, -step, step);
    const d = Phaser.Math.Easing.Sine.InOut(daynight.daylight);

    sky.sunDir = mix3(NIGHT.sunDir, DAY.sunDir, d);
    sky.sunColor = mix3(NIGHT.sun, DAY.sun, d);
    sky.sky = mix3(NIGHT.sky, DAY.sky, d);
    sky.bounce = mix3(NIGHT.bounce, DAY.bounce, d);

    // Under the trees the light is softer and greener, the edges darker.
    const f = this.forest.depth;
    if (f > 0) {
      sky.sunColor = mix3(sky.sunColor, [sky.sunColor[0] * 0.78, sky.sunColor[1] * 0.84, sky.sunColor[2] * 0.74], f);
      sky.sky = mix3(sky.sky, [sky.sky[0] * 0.8, sky.sky[1] * 0.94, sky.sky[2] * 0.84], f);
    }

    this.ground.setLight(d, 0.9 - d * 0.6);
    skyState.clouds = d * (1 - f * 0.4);
    skyState.tileX = time * 0.004;
    skyState.tileY = time * 0.0022;
    this.shafts.setAlpha(d * (0.1 + Math.sin(time * 0.0007) * 0.03));
    for (const s of this.shadows) s.setAlpha(SUN_SHADOW_ALPHA * d);
    this.setVignette(0.32 - d * 0.14 + f * 0.07);
    this.pollen.emitting = d > 0.5;
    this.fireflies.emitting = d < 0.5;
    sound.setDaylight(d);
    return d;
  }

  /** Name the region as the hero walks into it, like a signpost. */
  private updateRegion(): void {
    const r = regionAt(this.hero.y, this.region);
    if (r !== this.region) {
      this.region = r;
      this.showBanner(r.name);
    }
    this.banner?.setPosition(Math.round(this.view.centerX), Math.round(this.view.y + this.view.height * 0.2));
  }

  private showBanner(name: string): void {
    this.banner?.destroy();
    const text = this.add.bitmapText(0, 0, 'pixel', name.toUpperCase()).setLetterSpacing(-1).setScale(2).setOrigin(0.5).setTint(0xfff0c8).setDepth(10003).setAlpha(0);
    this.banner = text;
    this.tweens.chain({
      targets: text,
      tweens: [
        { alpha: 1, duration: 700, ease: 'Sine.Out' },
        { alpha: 1, duration: 1800 },
        { alpha: 0, duration: 900, ease: 'Sine.In' },
      ],
      onComplete: () => {
        text.destroy();
        if (this.banner === text) this.banner = null;
      },
    });
  }

  /** Stereo position of a world x on screen, -1..1. */
  pan(x: number): number {
    const cam = this.cameras.main;
    return Phaser.Math.Clamp((x - cam.midPoint.x) / (cam.worldView.width / 2), -1, 1);
  }

  /** How loud the braziers' crackle should be where the hero stands. */
  private fireNearby(): number {
    let near = Infinity;
    for (const f of this.flickers) {
      if (f.seed >= 0) near = Math.min(near, Phaser.Math.Distance.Between(f.light.x, f.light.y, this.hero.x, this.hero.y));
    }
    const k = Phaser.Math.Clamp(1 - (near - 16) / 150, 0, 1);
    return 0.12 + 0.88 * k * k;
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
    let attack = controls.attack || k.SPACE.isDown || k.J.isDown;
    let special = controls.beam || k.K.isDown || k.SHIFT.isDown;
    if (this.downT > 0) {
      mx = my = 0;
      attack = special = false;
    }
    this.hero.daylight = daynight.daylight;
    // The heroes clamp their step to a box; make it the room around them, so
    // they slide along trees and the forest's edge.
    const hb = this.heroBox;
    freeBox(this.hero.x, this.hero.y, 14, hb);
    this.hero.update(dt, mx, my, attack, special, hb);
    this.updateHeroLife(dt);

    const target = this.downT > 0 ? null : this.hero;
    const monsters: Monster[] = [];
    for (const sp of this.spawners) {
      sp.update(dt, target, daynight.daylight);
      monsters.push(...sp.monsters);
    }
    separate(monsters, target, HERO_RADIUS);
    for (const e of this.effects) e.update(dt);
    this.effects = this.effects.filter((e) => !e.dead);
    this.followHero();

    for (const b of this.balls) {
      this.struck = false;
      b.update(dt, this.hitTest, this.bounds);
      if (b.dead) sound.impact(this.pan(b.x), this.struck);
    }
    sound.setFire(this.fireNearby());
    this.balls = this.balls.filter((b) => !b.dead);
    for (const b of this.beams) b.update(dt);
    this.beams = this.beams.filter((b) => !b.dead);

    const d = this.updateDaylight(time, dt);
    this.ground.update(this.view, settings.values.quality === 'fast' ? 2.5 : 4);
    this.forest.update(time, dt, d, this.hero, this.view);
    this.updateRegion();
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
