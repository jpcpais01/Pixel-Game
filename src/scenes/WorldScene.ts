import Phaser from 'phaser';
import { controls } from '../game/controls';
import { sunShadow, SUN_SHADOW_ALPHA } from '../game/Wizard';
import { EnergyBall } from '../game/EnergyBall';
import { Beam } from '../game/Beam';
import { daynight } from '../game/daynight';
import { sky } from '../game/LitPipeline';
import { pixelGrid } from '../game/display';
import { PixelPipeline } from '../game/PixelPipeline';
import { characterById, type Hero } from '../game/characters';

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

/** Where a melee blow reaches, in world pixels. Angles in radians. */
export type MeleeArea =
  | { kind: 'arc'; x: number; y: number; radius: number; angle: number; spread: number }
  | { kind: 'circle'; x: number; y: number; radius: number }
  | { kind: 'line'; x0: number; y0: number; x1: number; y1: number; radius: number };

interface Dummy {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  wobble: number;
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
  private bounds = new Phaser.Geom.Rectangle(28, 40, WORLD_W - 56, WORLD_H - 64);
  private groundDay!: Phaser.GameObjects.Image;
  private runes!: Phaser.GameObjects.Image;
  private clouds!: Phaser.GameObjects.TileSprite;
  private shafts!: Phaser.GameObjects.TileSprite;
  private shadows: Phaser.GameObjects.Image[] = [];
  private pollen!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireflies!: Phaser.GameObjects.Particles.ParticleEmitter;
  private pixels!: PixelPipeline;
  /** Draws the ground at art resolution, under the main camera's sprites. */
  private groundCam!: Phaser.Cameras.Scene2D.Camera;
  private vignette!: Phaser.GameObjects.Image;
  private vignetteKey = '';

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
    const cx = WORLD_W / 2;
    const cy = WORLD_H / 2;

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

    ground(this.add.image(0, 0, 'ground').setOrigin(0).setPipeline('Lit'));
    this.groundDay = ground(this.add.image(0, 0, 'ground_day').setOrigin(0).setPipeline('Lit')) as Phaser.GameObjects.Image;
    this.runes = ground(this.add.image(0, 0, 'ground_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD)) as Phaser.GameObjects.Image;

    // Sky layers above everything in the world: drifting cloud shadows and
    // faint shafts of sunlight.
    this.clouds = this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'clouds').setOrigin(0).setDepth(10000);
    // The shafts are faint enough to light only the ground.
    this.shafts = ground(this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'shafts').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD)) as Phaser.GameObjects.TileSprite;

    const world = this.worldRect;
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
      this.add.image(Math.round(x), Math.round(y), 'rock', `r${i % 3}`).setOrigin(0.5, 12 / 14).setPipeline('Lit').setDepth(y);
      this.shadows.push(sunShadow(this.add.image(Math.round(x), Math.round(y), 'rock_s', `r${i % 3}`).setOrigin(0.5, 12 / 14)));
    }

    this.dummy(cx + 64, cy - 8);
    this.dummy(cx - 70, cy + 34);

    this.hero = characterById(data?.character).spawn(this, cx, cy + 20);

    // Screen-fixed; it covers the ground camera's image too, as it draws first.
    this.vignette = this.add.image(0, 0, '__WHITE').setScrollFactor(0).setDepth(20000);
    this.vignetteKey = '';
    this.setVignette(0.32 - Phaser.Math.Easing.Sine.InOut(daynight.daylight) * 0.14);
    cam.fadeIn(500, 7, 8, 13);
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this));

    const kb = this.input.keyboard!;
    kb.on('keydown-N', () => daynight.toggle());
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,K,SHIFT,N') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  castEnergyBall(x: number, y: number, dx: number, dy: number): void {
    this.balls.push(new EnergyBall(this, x, y, dx, dy));
    sound.cast(this.pan(x));
  }

  /** A beam from (x, y) along (dx, dy); `depth` sorts it against the caster. */
  fireBeam(x: number, y: number, dx: number, dy: number, power: number, depth: number): void {
    this.beams.push(new Beam(this, x, y, dx, dy, power, this.worldRect, depth, this.beamHit));
    sound.beamFire(this.pan(x), power);
  }

  /**
   * A melee blow. Everything whose body falls inside `area` is struck; returns
   * where each blow landed (on the side facing `from`), for sparks and sound.
   */
  melee(area: MeleeArea, heavy: boolean): { x: number; y: number }[] {
    const hits: { x: number; y: number }[] = [];
    for (const d of this.dummies) {
      const bx = d.x;
      const by = d.y - 11;
      let hit = false;
      if (area.kind === 'circle') {
        hit = Phaser.Math.Distance.Between(bx, by, area.x, area.y) <= area.radius + 6;
      } else if (area.kind === 'arc') {
        const dist = Phaser.Math.Distance.Between(bx, by, area.x, area.y);
        const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(by - area.y, bx - area.x) - area.angle));
        hit = dist <= area.radius + 6 && (off <= area.spread || dist < 10);
      } else {
        const vx = area.x1 - area.x0;
        const vy = area.y1 - area.y0;
        const t = Phaser.Math.Clamp(((bx - area.x0) * vx + (by - area.y0) * vy) / (vx * vx + vy * vy || 1), 0, 1);
        hit = Phaser.Math.Distance.Between(bx, by, area.x0 + vx * t, area.y0 + vy * t) <= area.radius + 6;
      }
      if (!hit) continue;
      this.hitDummy(d, heavy ? 1.4 : 1);
      const fx = area.kind === 'line' ? area.x0 : area.x;
      const fy = area.kind === 'line' ? area.y0 : area.y;
      const l = Math.hypot(fx - bx, fy - by) || 1;
      hits.push({ x: bx + ((fx - bx) / l) * 5, y: by + ((fy - by) / l) * 4 });
    }
    return hits;
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
    const kx = Math.round(sx * z - cx);
    const ky = Math.round(sy * z - cy);
    cam.scrollX = (kx + cx) / z;
    cam.scrollY = (ky + cy) / z;
    const ax = Math.floor(kx / z);
    const ay = Math.floor(ky / z);
    this.groundCam.scrollX = ax + cx / z;
    this.groundCam.scrollY = ay + cy / z;
    this.pixels.offsetX = kx - ax * z;
    this.pixels.offsetY = ky - ay * z;
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
    this.fitVignette();
  }

  /** Cover the screen. The zoom pivots on the camera's centre, which is where a scroll-fixed object sits. */
  private fitVignette(): void {
    const { width, height } = this.scale;
    const zoom = pixelGrid.zoom;
    this.vignette.setPosition(width / 2, height / 2).setDisplaySize(width / zoom, height / zoom);
  }

  /**
   * A vignette as a black overlay: the same falloff as Phaser's vignette
   * effect, without a second full-screen render pass. Painted once for each
   * strength it passes through (to two decimals) and cached.
   */
  private setVignette(strength: number): void {
    const s = Math.round(strength * 100);
    const key = `vignette_${s}`;
    if (key === this.vignetteKey) return;
    if (!this.textures.exists(key)) {
      const N = 128;
      const tex = this.textures.createCanvas(key, N, N)!;
      const img = tex.context.createImageData(N, N);
      const radius = 0.92;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const d = Math.hypot((x + 0.5) / N - 0.5, (y + 0.5) / N - 0.5);
          let a = 1;
          if (d <= radius) {
            const g = Math.sin((d / radius) * 3.14 * (s / 100));
            a = g * g * g;
          }
          img.data[(y * N + x) * 4 + 3] = Math.round(a * 255);
        }
      }
      tex.context.putImageData(img, 0, 0);
      tex.refresh();
      // A smooth gradient, not pixel art.
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    this.vignette.setTexture(key);
    this.vignetteKey = key;
    this.fitVignette();
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

  private hitDummy(d: Dummy, force = 1): void {
    d.wobble = force;
    d.sprite.setFrame('d1');
    this.time.delayedCall(90, () => d.sprite.setFrame('d0'));
  }

  private hitTest = (x: number, y: number): boolean => {
    for (const d of this.dummies) {
      if (Math.abs(x - d.x) < 7 && y > d.y - 24 && y < d.y + 2) {
        this.hitDummy(d);
        this.cameras.main.shake(70, 0.00035);
        this.struck = true;
        return true;
      }
    }
    return false;
  };

  /** Everything within `radius` of the beam's line takes a hit and throws off a burst of light. */
  private beamHit = (x0: number, y0: number, x1: number, y1: number, radius: number): void => {
    const line = new Phaser.Geom.Line(x0, y0, x1, y1);
    const p = new Phaser.Geom.Point();
    for (const d of this.dummies) {
      const body = new Phaser.Geom.Point(d.x, d.y - 11);
      Phaser.Geom.Line.GetNearestPoint(line, body, p);
      // Clamp the nearest point onto the segment.
      const len = Phaser.Geom.Line.Length(line);
      const t = len > 0 ? Phaser.Math.Clamp(((p.x - x0) * (x1 - x0) + (p.y - y0) * (y1 - y0)) / (len * len), 0, 1) : 0;
      const nx = x0 + (x1 - x0) * t;
      const ny = y0 + (y1 - y0) * t;
      if (Phaser.Math.Distance.Between(nx, ny, body.x, body.y) > radius + 6) continue;
      this.hitDummy(d);
      const burst = this.add
        .sprite(Math.round(nx), Math.round(ny), 'burst_e', 'b0')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(d.y + 1)
        .play('burst_pop');
      burst.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => burst.destroy());
    }
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
    this.setVignette(0.32 - d * 0.14);
    this.pollen.emitting = d > 0.5;
    this.fireflies.emitting = d < 0.5;
    sound.setDaylight(d);
    return d;
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
    const attack = controls.attack || k.SPACE.isDown || k.J.isDown;
    const special = controls.beam || k.K.isDown || k.SHIFT.isDown;
    this.hero.daylight = daynight.daylight;
    this.hero.update(dt, mx, my, attack, special, this.bounds);
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
