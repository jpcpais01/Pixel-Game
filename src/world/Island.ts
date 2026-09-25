import Phaser from 'phaser';
import { COLUMN_BASE, COLUMN_H, ISLAND_X, ISLAND_Y, ISLETS, WISP_W } from '../art/island';
import { warmIsland } from '../art/textures';
import { sunShadow } from '../game/Wizard';
import { settings } from '../game/settings';
import { snap } from '../game/display';
import { BROOKS, COLUMNS, ISLE_H, ISLE_W, POND } from './islandLayout';

type Img = Phaser.GameObjects.Image;

/** How far a fall runs down the rock at full strength, then fades into the sky. */
const FALL_SOLID = 44;
const FALL_FADE = 120;
/** Its speed, in pixels per ms. */
const FALL_SPEED = 0.085;

interface Fall {
  solid: Phaser.GameObjects.TileSprite;
  fade: Phaser.GameObjects.TileSprite;
  foam: Img;
  x: number;
  y: number;
  seed: number;
}

interface Bird {
  img: Phaser.GameObjects.Sprite;
  dx: number;
  dy: number;
  seed: number;
}

/**
 * The Floating Island around a duel: the sky and the island (drawn by the
 * ground camera), marble columns round the ring, waterfalls spilling off the
 * front edge into mist far below, islets bobbing in the sky, cloud wisps
 * drifting under the island, glints on the brooks, and now and then a flock
 * of birds. Daytime only: the world's usual daylight lights it.
 */
export class FloatingIsland {
  /** The columns' sun shadows, for the world to fade with the light. */
  readonly shadows: Img[] = [];
  private islets: { img: Img; x: number; y: number; seed: number }[] = [];
  private wisps: { img: Img; x: number; y: number; speed: number }[] = [];
  private falls: Fall[] = [];
  private birds: Bird[] = [];
  private flockT = 4000;
  private flapT = 0;
  private mist: Phaser.GameObjects.Particles.ParticleEmitter;
  private spray: Phaser.GameObjects.Particles.ParticleEmitter;
  private glints: Phaser.GameObjects.Particles.ParticleEmitter;
  private offQuality: () => void;

  /** `ground` hands an object to the camera that draws the ground (and hides it from the others). */
  constructor(
    private scene: Phaser.Scene,
    ground: (obj: Img | Phaser.GameObjects.TileSprite) => unknown,
    private view: Phaser.Geom.Rectangle,
  ) {
    warmIsland(scene);
    const add = scene.add;
    ground(add.image(0, 0, 'isle_sky').setOrigin(0).setDepth(-3));

    // Islets bobbing in the sky, and wisps of cloud drifting under the island.
    ISLETS.forEach((l, k) => {
      const img = add.image(l.x, l.y, `isle_islet${k}`).setDepth(-2.4);
      ground(img);
      this.islets.push({ img, x: l.x, y: l.y, seed: k * 2.3 });
    });
    const R = new Phaser.Math.RandomDataGenerator(['isle-wisps']);
    for (let k = 0; k < 6; k++) {
      const x = R.frac() * (ISLE_W + WISP_W) - WISP_W / 2;
      const y = 40 + R.frac() * (ISLE_H - 80);
      const img = add.image(Math.round(x), Math.round(y), `isle_wisp${k % 3}`).setDepth(k < 3 ? -2.6 : -2.2).setAlpha(k < 3 ? 0.55 : 0.8).setFlipX(R.frac() < 0.5);
      ground(img);
      this.wisps.push({ img, x, y, speed: 0.0025 + R.frac() * 0.004 });
    }

    ground(add.image(ISLAND_X, ISLAND_Y, 'isle_land').setOrigin(0).setPipeline('Lit').setDepth(0));
    ground(add.image(ISLAND_X, ISLAND_Y, 'isle_land_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(2));

    // Where each brook tips over the edge: a sheet of water down the rock,
    // fading as it falls on into the sky, and foam churning at the lip.
    BROOKS.forEach((b, k) => {
      const x = b.fall.x - 5;
      const y = b.fall.y - 1;
      const solid = add.tileSprite(x, y, 10, FALL_SOLID, 'isle_fall').setOrigin(0).setDepth(1).setAlpha(0.95);
      const fade = add.tileSprite(x, y + FALL_SOLID, 10, FALL_FADE, 'isle_fall').setOrigin(0).setDepth(1);
      fade.setAlpha(0.95, 0.95, 0, 0);
      const foamImg = add.image(b.fall.x, y, 'isle_foam').setDepth(1.5);
      ground(solid);
      ground(fade);
      ground(foamImg);
      this.falls.push({ solid, fade, foam: foamImg, x: b.fall.x, y, seed: k * 1.9 });
    });

    // Marble columns round the ring.
    for (const c of COLUMNS) {
      const oy = COLUMN_BASE / COLUMN_H;
      add.image(c.x, c.y, 'shadow').setDepth(1).setAlpha(0.7);
      add.image(c.x, c.y, 'isle_column', `c${c.v}`).setOrigin(0.5, oy).setPipeline('Lit').setDepth(c.y);
      this.shadows.push(sunShadow(add.image(c.x, c.y, 'isle_column_s', `c${c.v}`).setOrigin(0.5, oy)));
    }

    // Mist rising where the falls fade out, spray at their lips, glints on the water.
    const falls = this.falls;
    const pickFall = () => falls[Math.floor(Math.random() * falls.length)];
    this.mist = add.particles(0, 0, 'glow', {
      emitZone: {
        type: 'random',
        source: {
          getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
            const f = pickFall();
            p.x = f.x + (Math.random() - 0.5) * 12;
            p.y = f.y + FALL_SOLID + FALL_FADE * (0.35 + Math.random() * 0.4);
            return p;
          },
        },
      } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 1800, max: 2800 },
      speedX: { min: -6, max: 6 },
      speedY: { min: -5, max: 2 },
      scale: { start: 0.45, end: 1.3 },
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.22 },
      tint: [0xffffff, 0xd8f0ff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 110,
    }).setDepth(3);
    this.spray = add.particles(0, 0, 'spark', {
      emitZone: {
        type: 'random',
        source: {
          getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
            const f = pickFall();
            p.x = f.x + (Math.random() - 0.5) * 10;
            p.y = f.y + Math.random() * 3;
            return p;
          },
        },
      } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 400, max: 800 },
      speedX: { min: -10, max: 10 },
      speedY: { min: -8, max: 6 },
      gravityY: 60,
      scale: 0.5,
      alpha: { start: 0.9, end: 0 },
      tint: [0xffffff, 0xd8f4ff],
      frequency: 70,
    }).setDepth(3);
    const water = [...BROOKS.flatMap((b) => b.pts.slice(0, -2).map((p) => ({ x: p.x, y: p.y, w: b.w }))), { x: POND.x, y: POND.y, w: POND.rx * 0.7 }];
    this.glints = add.particles(0, 0, 'spark', {
      emitZone: {
        type: 'random',
        source: {
          getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
            const s = water[Math.floor(Math.random() * water.length)];
            p.x = s.x + (Math.random() - 0.5) * s.w * 1.6;
            p.y = s.y + (Math.random() - 0.5) * Math.min(s.w, 8);
            return p;
          },
        },
      } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 350, max: 700 },
      speed: 0,
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) },
      tint: [0xffffff, 0xe0f8ff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 120,
    }).setDepth(2.5);

    this.offQuality = settings.watch((s) => {
      const k = s.quality !== 'full' ? 2 : 1;
      this.mist.frequency = 110 * k;
      this.spray.frequency = 70 * k;
      this.glints.frequency = 120 * k;
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  update(time: number, dt: number): void {
    const v = this.view;
    for (const l of this.islets) l.img.setPosition(snap(l.x), snap(l.y + Math.sin(time * 0.0007 + l.seed) * 2.5));
    for (const w of this.wisps) {
      w.x += w.speed * dt;
      if (w.x > ISLE_W + WISP_W / 2) w.x -= ISLE_W + WISP_W;
      w.img.setPosition(Math.round(w.x), Math.round(w.y));
    }

    // Only the falls in view are worth moving.
    let lips = false;
    let tails = false;
    for (const f of this.falls) {
      if (f.x < v.left - 20 || f.x > v.right + 20 || f.y > v.bottom + 10 || f.y + FALL_SOLID + FALL_FADE < v.top) continue;
      const t = -time * FALL_SPEED;
      f.solid.tilePositionY = t;
      f.fade.tilePositionY = t - FALL_SOLID;
      const churn = Math.floor(time / 110 + f.seed * 7) % 3;
      f.foam.setPosition(f.x + (churn === 1 ? 1 : 0), f.y + (churn === 2 ? 1 : 0)).setAlpha(0.8 + Math.sin(time * 0.012 + f.seed) * 0.15);
      if (f.y > v.top && f.y < v.bottom) lips = true;
      if (f.y + FALL_SOLID + FALL_FADE * 0.35 < v.bottom) tails = true;
    }
    this.spray.emitting = lips;
    this.mist.emitting = tails;
    this.glints.emitting = v.bottom > ISLAND_Y && v.top < ISLAND_Y + 420;

    this.updateBirds(dt);
  }

  /** Now and then a little flock crosses the sky, flapping and gliding. */
  private updateBirds(dt: number): void {
    const v = this.view;
    this.flapT += dt;
    const flap = Math.floor(this.flapT / 160) % 2;
    for (const b of this.birds) {
      b.img.x += (b.dx * dt) / 1000;
      b.img.y += (b.dy * dt) / 1000;
      // Glide now and then with the wings up.
      const glide = Math.sin(this.flapT * 0.0015 + b.seed) > 0.3;
      b.img.setFrame(glide ? 'b0' : `b${flap}`);
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      if ((b.dx > 0 && b.img.x > v.right + 30) || (b.dx < 0 && b.img.x < v.left - 30)) {
        b.img.destroy();
        this.birds.splice(i, 1);
      }
    }
    if (this.birds.length) return;
    this.flockT -= dt;
    if (this.flockT > 0) return;
    this.flockT = 9000 + Math.random() * 12000;
    const right = Math.random() < 0.5;
    const n = 2 + Math.floor(Math.random() * 3);
    const y0 = v.top + v.height * (0.15 + Math.random() * 0.5);
    const speed = 26 + Math.random() * 10;
    for (let k = 0; k < n; k++) {
      // A loose V behind the leader.
      const back = k * (7 + Math.random() * 3);
      const x = right ? v.left - 10 - back : v.right + 10 + back;
      const y = y0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 5;
      const img = this.scene.add.sprite(x, y, 'isle_bird', 'b0').setDepth(9998).setAlpha(0.85);
      this.birds.push({ img, dx: right ? speed : -speed, dy: -1.5 + Math.random() * 3, seed: Math.random() * 10 });
    }
  }

  destroy(): void {
    this.offQuality();
    this.birds = [];
    this.falls = [];
  }
}
