import Phaser from 'phaser';
import { paintHall } from '../art/hall';
import {
  CLOUD_LAYERS,
  CLOUD_W,
  birdSheet,
  cloudStrip,
  paintIsland,
  paintIslet,
  paintSky,
  petalSheet,
  rainbow,
  waterfall,
} from '../art/skyArena';

type Particle = Phaser.GameObjects.Particles.Particle;

/** A home screen background, drawn into its own layer under the menu. */
export interface Backdrop {
  /** Fit a `vw` x `vh` view (art px) at zoom `z`. */
  layout(vw: number, vh: number, z: number): void;
  /** `t`: seconds since the scene started. */
  update(time: number, t: number): void;
}

/** Most launches open on the Sky Arena; about one in ten on the Hall of Legends. */
const HOME_BACKDROP: 'sky' | 'hall' = Math.random() < 0.1 ? 'hall' : 'sky';

export function makeBackdrop(scene: Phaser.Scene): Backdrop {
  return HOME_BACKDROP === 'hall' ? new HallBackdrop(scene) : new SkyBackdrop(scene);
}

/** Snap to the device pixel grid. */
const snap = (v: number, z: number) => Math.round(v * z) / z;

/**
 * The Hall of Legends at midday, with sunlight streaming through its windows
 * and dust drifting in the beams.
 */
class HallBackdrop implements Backdrop {
  private layer: Phaser.GameObjects.Layer;
  private key = '';
  private hall: Phaser.GameObjects.Image;
  private shaft: Phaser.GameObjects.Image;
  private glows: Phaser.GameObjects.Image[] = [];
  /** Light rays (x0, y0, x1, y1) that dust is scattered along. */
  private rays: Float32Array = new Float32Array(0);

  constructor(private scene: Phaser.Scene) {
    this.layer = scene.add.layer();
    this.hall = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.shaft = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    // Dust motes, only ever seen where they drift through the light.
    const dust: Phaser.Types.GameObjects.Particles.RandomZoneSource = {
      getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
        const n = this.rays.length / 4;
        if (!n) return p;
        const i = Math.floor(Math.random() * n) * 4;
        const t = 0.08 + Math.random() * 0.85;
        p.x = this.rays[i] + (this.rays[i + 2] - this.rays[i]) * t;
        p.y = this.rays[i + 1] + (this.rays[i + 3] - this.rays[i + 1]) * t;
        return p;
      },
    };
    const motes = scene.add.particles(0, 0, 'home_dot', {
      emitZone: { type: 'random', source: dust } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 3500, max: 8000 },
      speedX: { min: -2, max: 4 },
      speedY: { min: -3, max: 2.5 },
      alpha: { onUpdate: (_p: Particle, _k: string, t: number) => Math.sin(t * Math.PI) * (0.55 + 0.45 * Math.max(0, Math.sin(t * Math.PI * 4))) },
      tint: [0xfff2cc, 0xffe2a8, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 35,
    });
    this.layer.add([this.hall, this.shaft, motes]);
  }

  layout(vw: number, vh: number): void {
    const w = Math.ceil(vw);
    const h = Math.ceil(vh);
    const key = `hall_${w}x${h}`;
    if (key === this.key) return;
    const art = paintHall(w, h);
    const tex = this.scene.textures;
    // One image for the hall, its sunlight and a vignette, so the screen
    // draws a single full-size layer plus the shafts.
    const base = art.base;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = Math.hypot((x + 0.5) / w - 0.5, (y + 0.5) / h - 0.5) / 0.7071;
        const v = 1 - 0.4 * Phaser.Math.Clamp((r - 0.45) / 0.55, 0, 1) ** 2;
        for (let k = 0; k < 3; k++) base.data[i + k] = Math.min(255, base.data[i + k] + art.sun.data[i + k]) * v;
      }
    }
    [base, art.shafts[0]].forEach((b, i) => {
      const k = `${key}_${i}`;
      if (!tex.exists(k)) tex.addCanvas(k, b.toCanvas());
      [this.hall, this.shaft][i].setTexture(k);
      if (this.key) tex.remove(`${this.key}_${i}`);
    });
    this.key = key;
    this.rays = art.rays;
    for (const g of this.glows) g.destroy();
    this.glows = art.windows.map((r) =>
      this.scene.add
        .image(r.x + r.w / 2, r.y + r.h * 0.55, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffd9a0)
        .setScale((r.w * 2.6) / 32, (r.h * 1.5) / 32),
    );
    this.layer.add(this.glows);
  }

  update(time: number, t: number): void {
    // Clouds drift over the sun now and then, and the shafts shimmer.
    const cloud = 0.86 + 0.14 * (0.5 + 0.5 * (0.6 * Math.sin(t * 0.21) + 0.4 * Math.sin(t * 0.53 + 1.7)));
    this.shaft.setAlpha(cloud * (0.85 + 0.15 * Math.sin(time * 0.0006)));
    for (const g of this.glows) g.setAlpha(0.22 * cloud);
  }
}

interface Strip {
  sprite: Phaser.GameObjects.TileSprite;
  /** Art px per second. */
  speed: number;
  /** Where its cloud sea starts, as a fraction of the view height. */
  at: number;
  base: number;
}

interface Floater {
  img: Phaser.GameObjects.Image;
  fx: number;
  fy: number;
  phase: number;
}

interface Bird {
  img: Phaser.GameObjects.Image;
  y: number;
  speed: number;
  phase: number;
}

/**
 * The Sky Arena: a marble arena on a floating island above a sea of clouds
 * on a golden morning, with waterfalls spilling off its edge, blossom
 * drifting from its tree, small islets bobbing about and birds far off.
 */
class SkyBackdrop implements Backdrop {
  private layer: Phaser.GameObjects.Layer;
  private skyKey = '';
  private islandRx = 0;
  private z = 2;
  private vw = 0;
  private vh = 0;
  private sky: Phaser.GameObjects.Image;
  private rainbow: Phaser.GameObjects.Image;
  private mists: Phaser.GameObjects.Image[] = [];
  private strips: Strip[] = [];
  private islets: Floater[] = [];
  private birds: Bird[] = [];
  private island: Phaser.GameObjects.Image;
  private falls: Phaser.GameObjects.TileSprite[] = [];
  private fallSpots: { x: number; y: number }[] = [];
  private islandX = 0;
  private islandY = 0;
  private canopy = new Phaser.Geom.Rectangle(0, 0, 1, 1);
  private canopyLocal = { x: 0, y: 0, w: 1, h: 1 };

  constructor(private scene: Phaser.Scene) {
    SkyBackdrop.textures(scene);
    this.layer = scene.add.layer();
    const L = this.layer;
    this.sky = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    L.add(this.sky);
    this.birds = [0, 1, 2, 3].map((i) => {
      const img = scene.add.image(0, 0, 'sky_bird', 0);
      L.add(img);
      return { img, y: 0.12 + i * 0.07 + (i % 2) * 0.03, speed: 7 + i * 1.7, phase: i * 1.9 };
    });
    this.islets = [
      { fx: 0.1, fy: 0.5, s: 18, seed: 51 },
      { fx: 0.9, fy: 0.44, s: 14, seed: 52 },
      { fx: 0.8, fy: 0.62, s: 9, seed: 53 },
      { fx: 0.24, fy: 0.64, s: 8, seed: 54 },
    ].map((d, i) => {
      const key = `sky_islet${i}`;
      if (!scene.textures.exists(key)) scene.textures.addCanvas(key, paintIslet(d.s, d.seed).toCanvas());
      const img = scene.add.image(0, 0, key).setOrigin(0.5, 0);
      L.add(img);
      return { img, fx: d.fx, fy: d.fy, phase: i * 1.3 };
    });
    this.strips.push(this.strip('sky_cloud1', 4, 0.74, 1));
    this.island = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    L.add(this.island);
    const petals = scene.add.particles(0, 0, 'sky_petal', {
      frame: ['p0', 'p1'],
      emitZone: { type: 'random', source: this.canopy } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: 7000,
      speedX: { min: 4, max: 12 },
      speedY: { min: 3, max: 8 },
      scaleY: { onUpdate: (_p: Particle, _k: string, t: number) => (Math.sin(t * 70) > 0 ? 1 : -1) },
      alpha: { onUpdate: (_p: Particle, _k: string, t: number) => Math.min(1, t * 8, (1 - t) * 4) },
      frequency: 420,
    });
    L.add(petals);
    this.falls = [0, 1, 2].map(() => scene.add.tileSprite(0, 0, 8, 1, 'sky_fall').setOrigin(0));
    L.add(this.falls);
    // A rainbow in the falls' spray; mist glows where they meet the clouds.
    this.rainbow = scene.add.image(0, 0, 'sky_rainbow').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD);
    L.add(this.rainbow);
    this.strips.push(this.strip('sky_cloud2', 9, 1.06, 2));
    this.mists = this.falls.map(() => scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xf4f8ff).setScale(2.2, 1.2));
    L.add(this.mists);
  }

  private static textures(scene: Phaser.Scene): void {
    const tex = scene.textures;
    if (tex.exists('sky_cloud1')) return;
    // The far layer is baked into the sky.
    CLOUD_LAYERS.forEach((l, i) => i > 0 && tex.addCanvas(`sky_cloud${i}`, cloudStrip(l).toCanvas()));
    tex.addCanvas('sky_rainbow', rainbow(34).toCanvas());
    tex.addCanvas('sky_fall', waterfall().toCanvas());
    const bird = tex.addCanvas('sky_bird', birdSheet().toCanvas())!;
    bird.add(0, 0, 0, 0, 5, 3);
    bird.add(1, 0, 5, 0, 5, 3);
    const petal = tex.addCanvas('sky_petal', petalSheet().toCanvas())!;
    petal.add('p0', 0, 0, 0, 2, 2);
    petal.add('p1', 0, 2, 0, 2, 2);
  }

  private strip(key: string, speed: number, at: number, layer: number): Strip {
    const sprite = this.scene.add.tileSprite(0, 0, 1, CLOUD_LAYERS[layer].h, key).setOrigin(0);
    this.layer.add(sprite);
    return { sprite, speed, at, base: CLOUD_LAYERS[layer].base };
  }

  layout(vw: number, vh: number, z: number): void {
    this.z = z;
    this.vw = vw;
    this.vh = vh;
    const w = Math.ceil(vw);
    const h = Math.ceil(vh);
    const tex = this.scene.textures;
    const key = `sky_bg_${w}x${h}`;
    if (key !== this.skyKey) {
      if (!tex.exists(key)) tex.addCanvas(key, paintSky(w, h).toCanvas());
      this.sky.setTexture(key);
      if (this.skyKey) tex.remove(this.skyKey);
      this.skyKey = key;
    }
    for (const s of this.strips) s.sprite.setPosition(0, Math.round(vh * s.at) - s.base).setSize(w + 1, s.sprite.height);

    // The island: sized to the view, centred, floating in the clouds.
    const rx = Math.round(Math.min(vw * 0.25, vh * 0.5));
    if (rx !== this.islandRx) {
      const art = paintIsland(rx);
      const k = `sky_island_${rx}`;
      if (!tex.exists(k)) tex.addCanvas(k, art.bmp.toCanvas());
      this.island.setTexture(k);
      if (this.islandRx) tex.remove(`sky_island_${this.islandRx}`);
      this.islandRx = rx;
      this.fallSpots = art.falls;
      this.canopyLocal = art.canopy;
      this.islandX = -art.cx;
      this.islandY = -art.cy;
    }
    const ix = Math.round(vw / 2) + this.islandX;
    const iy = Math.round(vh * 0.67) + this.islandY;
    this.island.setData('home', { x: ix, y: iy });
    this.canopy.setTo(ix + this.canopyLocal.x, iy + this.canopyLocal.y, this.canopyLocal.w, this.canopyLocal.h);
    this.falls.forEach((f, i) => {
      const s = this.fallSpots[i];
      f.setSize(8, Math.max(8, Math.ceil(vh - (iy + s.y)) + 4));
      this.mists[i].setPosition(ix + s.x + 4, Math.round(vh * 0.97));
    });
    const rf = this.fallSpots[2];
    this.rainbow.setPosition(ix + rf.x + 14, Math.round(vh * 0.92));
  }

  update(time: number, t: number): void {
    const z = this.z;
    for (const s of this.strips) s.sprite.tilePositionX = snap((t * s.speed) % CLOUD_W, z);

    // The island rises and settles, slow as breathing.
    const home = this.island.getData('home') as { x: number; y: number } | undefined;
    if (home) {
      const bob = snap(Math.sin(t * 0.8) * 1.5, z);
      this.island.setPosition(home.x, home.y + bob);
      this.falls.forEach((f, i) => {
        const s = this.fallSpots[i];
        f.setPosition(home.x + s.x, home.y + bob + s.y);
        f.tilePositionY = -snap((t * 30 + i * 11) % 32, z);
      });
    }
    for (const f of this.islets) {
      f.img.setPosition(Math.round(this.vw * f.fx), Math.round(this.vh * f.fy) + snap(Math.sin(t * 0.6 + f.phase) * 2, z));
    }
    const span = this.vw + 20;
    for (const b of this.birds) {
      const x = ((t * b.speed + b.phase * 97) % span) - 10;
      const y = this.vh * b.y + Math.sin(t * 0.7 + b.phase) * 3;
      b.img.setPosition(snap(x, z), snap(y, z)).setFrame(Math.floor(time / 160 + b.phase * 3) % 2);
    }
    this.rainbow.setAlpha(0.75 + 0.25 * Math.sin(t * 0.4));
    for (const [i, m] of this.mists.entries()) m.setAlpha(0.3 + 0.08 * Math.sin(t * 1.3 + i));
  }
}
