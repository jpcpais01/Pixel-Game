import Phaser from 'phaser';
import { PixelLayer } from './Beam';
import type { Effect, Scheme } from './Slash';

// The fighter's effects: the shock of air a punch throws off the knuckles,
// and the barrage's storm of burning fists. Like the blade effects, each is a
// small canvas of solid pixels on the pixel grid, with a soft glow around it.

/** Plain punches: pale air with a little warmth in it. */
export const AIR_FX: Scheme = { core: 0xffffff, hot: 0xfff2dc, mid: 0xffc49a, deep: 0xc8704a };
/** The finisher and the barrage: fists of burning chi. */
export const CHI_FX: Scheme = { core: 0xfffbe8, hot: 0xffd66b, mid: 0xff8a36, deep: 0xd8402a, light: 0xffa050 };
/** The monk's palms: pale gold force with a little dust in it. */
export const PALM_FX: Scheme = { core: 0xfffbea, hot: 0xfff0c0, mid: 0xe8c47a, deep: 0x9a7448 };
/** The monk's double palm and earthshaker: golden qi. */
export const QI_FX: Scheme = { core: 0xfffbea, hot: 0xffe7a0, mid: 0xe0b050, deep: 0x8a5a2a, light: 0xffd080 };
/** The luchador's punches: pale air with a flash of pink showbiz in it. */
export const LUCHA_AIR_FX: Scheme = { core: 0xffffff, hot: 0xfff0f8, mid: 0xffa8d4, deep: 0xc04a8a };
/** The luchador's finisher and barrage: gold and hot pink, like the lights over the ring. */
export const LUCHA_FX: Scheme = { core: 0xfff8e8, hot: 0xffd35c, mid: 0xff4fa0, deep: 0x9a1c6a, light: 0xff80b8 };
/** The champ's punches: pale air with a flash of lime in it. */
export const CHAMP_AIR_FX: Scheme = { core: 0xffffff, hot: 0xf2ffe4, mid: 0xb4ff86, deep: 0x3aa02a };
/** The champ's finisher and barrage: lime green and orange, the colours of his merch. */
export const CHAMP_FX: Scheme = { core: 0xf8ffe8, hot: 0x9cff5a, mid: 0xff8a2a, deep: 0x1c7a1a, light: 0x8cf060 };
/** The stone guardian's palms: grit and stone dust. */
export const STONE_FX: Scheme = { core: 0xfff4e0, hot: 0xe8d8b8, mid: 0xb09878, deep: 0x5e4c3e };
/** The stone guardian's double palm and earthshaker: fire from the cracks in him. */
export const MAGMA_FX: Scheme = { core: 0xfff4d0, hot: 0xffc050, mid: 0xff6a1a, deep: 0xa02a10, light: 0xff8a30 };

/** Tigerclaw's punches: pale air going orange, a black edge to it like a stripe. */
export const TIGER_AIR_FX: Scheme = { core: 0xffffff, hot: 0xfff0dc, mid: 0xffa040, deep: 0x1c0e08 };
/** Tigerclaw's finisher and barrage: tiger orange burning to black. */
export const TIGER_FX: Scheme = { core: 0xfff4e0, hot: 0xffb040, mid: 0xff6a10, deep: 0x1c0c06, light: 0xff8a30 };
/** The Monkey King's palms: bright gold with a red edge. */
export const WUKONG_AIR_FX: Scheme = { core: 0xffffff, hot: 0xfff4c8, mid: 0xffd04a, deep: 0xc0301a };
/** The Monkey King's double palm and earthshaker: blazing gold and red. */
export const WUKONG_FX: Scheme = { core: 0xfffbe8, hot: 0xffe070, mid: 0xffb020, deep: 0xb8201a, light: 0xffc850 };
/** The somersault cloud's puffs: white-gold, rimmed in amber. */
export const CLOUD_FX: Scheme = { core: 0xffffff, hot: 0xfff4cc, mid: 0xffd060, deep: 0xb06818 };

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/**
 * A punch landing on the air at (x, y), thrown along (ux, uy): a flash at the
 * knuckles, crescents of pressure rolling on ahead and speed lines trailing
 * back. `size` scales it up for the finisher.
 */
export class PunchBlast implements Effect {
  dead = false;
  private scene: Phaser.Scene;
  private layer: PixelLayer;
  private half: number;
  private glow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light | null = null;
  private age = 0;
  private readonly duration: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private ux: number,
    private uy: number,
    private scheme: Scheme,
    depth: number,
    private size = 1,
  ) {
    this.scene = scene;
    this.duration = 170 + 150 * (size - 1);
    this.half = Math.ceil(12 * size) + 3;
    this.layer = new PixelLayer(scene, this.half * 2, this.half * 2);
    this.layer.image.setPosition(x - this.half, y - this.half).setDepth(uy < -0.5 ? depth - 0.5 : depth + 0.3);
    this.glow = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(scheme.mid).setScale(0.55 * size).setDepth(depth + 0.25);
    // Only the big blows light up their surroundings; lights are dear.
    if (size > 1.2) {
      this.light = scene.lights.addLight(x, y, 60 * size, scheme.light ?? scheme.hot, 2.2);
    }
    this.draw();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    if (this.age >= this.duration) {
      this.destroy();
      return;
    }
    this.draw();
  }

  private draw(): void {
    const { ux, uy, size: k, scheme: c, half: H } = this;
    const t = this.age / this.duration;
    const frame = Math.floor(this.age / 40);
    const b = this.layer;
    b.clear();
    // Three crescents, each setting off a moment after the last.
    const rings = [0, 1, 2].map((i) => {
      const s = (t - i * 0.12) / 0.88;
      return s <= 0 ? -1 : k * (2.2 + i * 1.8 + 7.5 * easeOut(s));
    });
    const ringCol = t < 0.25 ? c.core : t < 0.5 ? c.hot : t < 0.75 ? c.mid : c.deep;
    const flash = t < 0.35 ? (2.6 - t * 6) * k : 0;
    const trail = -2 - 9 * k * (1 - t);
    for (let py = 0; py < H * 2; py++) {
      for (let px = 0; px < H * 2; px++) {
        const rx = px + 0.5 - H;
        const ry = py + 0.5 - H;
        const along = rx * ux + ry * uy;
        const side = rx * uy - ry * ux;
        const q = Math.hypot(along + 2 * k, side);
        if (Math.hypot(along, side) < flash) {
          b.put(px, py, Math.hypot(along, side) < flash * 0.55 ? c.core : c.hot);
          continue;
        }
        // Crescents facing forward, thinning to nothing at their horns.
        if (along + 2 * k > 0) {
          const horn = Math.abs(side) / q;
          if (horn < 0.88) {
            for (let i = 0; i < 3; i++) {
              const r = rings[i];
              if (r < 0 || Math.abs(q - r) > 0.55 + (1 - horn) * 0.35) continue;
              if (horn > 0.6 && hash(px, py, frame) > 0.6) continue;
              b.put(px, py, i === 0 ? ringCol : i === 1 ? c.mid : c.deep, (1 - t) * (1 - horn * 0.5));
              break;
            }
          }
        }
        // Speed lines streaming back off the fist.
        if (along < -1.5 && along > trail) {
          for (const s0 of [-3.5, -1.5, 1.5, 3.5]) {
            if (Math.abs(side - s0 * k) < 0.5 && hash(Math.round(along), s0, frame) > 0.25) {
              b.put(px, py, Math.abs(s0) < 2 ? c.hot : c.mid, 0.8 * (1 - t));
              break;
            }
          }
        }
      }
    }
    b.flush();
    const fade = 1 - t;
    this.glow.setAlpha(0.5 * fade);
    if (this.light) this.light.intensity = 2.2 * fade;
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
    this.glow.destroy();
    if (this.light) this.scene.lights.removeLight(this.light);
  }
}

/** One fist of the barrage in flight. */
interface Ghost {
  /** Sideways offset from the line of fire, in pixels. */
  lat: number;
  reach: number;
  age: number;
  /** Time to reach full stretch, then it bursts and fades. */
  travel: number;
  life: number;
  r: number;
}

/**
 * The barrage: fists of burning chi hammering out along the line he faces,
 * far past his real reach, each one bursting at the end of its flight.
 */
export class Flurry {
  private scene: Phaser.Scene;
  private layer: PixelLayer;
  private half: number;
  private glow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private ghosts: Ghost[] = [];

  constructor(
    scene: Phaser.Scene,
    private reach: number,
    private scheme: Scheme = CHI_FX,
  ) {
    this.scene = scene;
    this.half = Math.ceil(reach) + 8;
    this.layer = new PixelLayer(scene, this.half * 2, this.half * 2);
    this.glow = scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(scheme.mid).setScale(1.3);
    this.light = scene.lights.addLight(0, 0, 90, scheme.light ?? scheme.hot, 0);
    this.embers = scene.add.particles(0, 0, 'spark', {
      lifespan: { min: 200, max: 450 },
      speed: { min: 10, max: 40 },
      gravityY: -30,
      scale: 0.5,
      alpha: { start: 1, end: 0 },
      tint: [scheme.core, scheme.hot, scheme.mid, scheme.deep],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
  }

  /** Throw one more fist down the line of fire. */
  throw(): void {
    const big = Math.random() < 0.25;
    this.ghosts.push({
      lat: (Math.random() * 2 - 1) * 6.5,
      reach: this.reach * (0.5 + Math.random() * 0.5),
      age: 0,
      travel: 70 + Math.random() * 40,
      life: 150 + Math.random() * 40,
      r: big ? 2.6 : 2.1,
    });
  }

  /** (x, y) is the chest pixel, (ux, uy) the unit line of fire, `depth` the fighter's. */
  update(dt: number, x: number, y: number, ux: number, uy: number, depth: number, daylight: number): void {
    const H = this.half;
    const c = this.scheme;
    const b = this.layer;
    b.image.setPosition(x - H, y - H).setDepth(uy < -0.5 ? depth - 0.5 : depth + 0.3);
    b.clear();
    // Perpendicular to the line of fire.
    const nx = -uy;
    const ny = ux;
    for (const g of this.ghosts) {
      g.age += dt;
      const k = easeOut(g.age / g.travel);
      const fade = g.age < g.travel ? 1 : Math.max(0, 1 - (g.age - g.travel) / (g.life - g.travel));
      const along = 4 + (g.reach - 4) * k;
      const gx = H + ux * along + nx * g.lat;
      const gy = H + uy * along + ny * g.lat;
      // The streak it leaves, widest just behind the fist.
      const len = g.age < g.travel ? 3 + 9 * k : 12 * fade;
      for (let s = 1; s <= len; s++) {
        const w = s / len;
        const sx = gx - ux * (s + g.r - 1);
        const sy = gy - uy * (s + g.r - 1);
        b.put(Math.round(sx - 0.5), Math.round(sy - 0.5), w < 0.4 ? c.hot : c.mid, (1 - w) * fade);
        if (w < 0.5) {
          b.put(Math.round(sx + nx - 0.5), Math.round(sy + ny - 0.5), c.deep, (0.8 - w) * fade);
          b.put(Math.round(sx - nx - 0.5), Math.round(sy - ny - 0.5), c.deep, (0.8 - w) * fade);
        }
      }
      if (g.age < g.travel) {
        // The fist itself: bright knuckles leading, a hot heart, a rim of flame.
        const R = g.r;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const px = Math.round(gx - 0.5) + dx;
            const py = Math.round(gy - 0.5) + dy;
            const ox = px + 0.5 - gx;
            const oy = py + 0.5 - gy;
            const d = Math.hypot(ox, oy);
            if (d > R) continue;
            const front = ox * ux + oy * uy;
            b.put(px, py, front > R * 0.3 ? c.core : d < R * 0.55 ? c.hot : c.mid);
          }
        }
      } else {
        // It bursts: a star opening at the end of its flight.
        const s = (g.age - g.travel) / (g.life - g.travel);
        const ray = 1 + Math.round(4 * Math.sin(Math.PI * Math.min(1, s * 1.3 + 0.2)));
        const cx = Math.round(gx - 0.5);
        const cy = Math.round(gy - 0.5);
        for (let i = -ray; i <= ray; i++) {
          const col = Math.abs(i) < ray * 0.4 ? c.core : c.hot;
          b.put(cx + i, cy, col, fade);
          b.put(cx, cy + i, col, fade);
        }
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) b.put(cx + sx * 2, cy + sy * 2, c.mid, fade * 0.8);
      }
    }
    this.ghosts = this.ghosts.filter((g) => g.age < g.life);
    b.flush();

    const flicker = 0.85 + Math.random() * 0.15;
    const mid = this.reach * 0.55;
    this.glow.setPosition(x + ux * mid, y + uy * mid).setDepth(depth + 0.25).setAlpha(0.4 * flicker);
    this.light.setPosition(x + ux * mid, y + uy * mid);
    this.light.intensity = 1.7 * flicker * (1 - daylight * 0.4);
    if (Math.random() < 0.5) {
      const d = this.reach * (0.3 + Math.random() * 0.7);
      this.embers.setDepth(depth + 0.35).emitParticleAt(x + ux * d + nx * (Math.random() - 0.5) * 12, y + uy * d + ny * (Math.random() - 0.5) * 12, 1);
    }
  }

  destroy(): void {
    this.layer.destroy();
    this.glow.destroy();
    this.scene.lights.removeLight(this.light);
    this.embers.stop();
    this.scene.time.delayedCall(500, () => this.embers.destroy());
  }
}

/** Claw slashes: how long they last, how long each is (half), how far apart, and their slant off the punch. */
const CLAW_MS = 280;
const CLAW_LEN = 6.5;
const CLAW_GAP = 3;
const CLAW_SLANT = (62 * Math.PI) / 180;

/**
 * Tigerclaw's mark: three parallel claw slashes raked across the line of a
 * punch, opening one after another, then fading. Each is a thin bowed
 * crescent with a bright edge and a black one, like a stripe torn in the air.
 */
export class ClawRake implements Effect {
  dead = false;
  private layer: PixelLayer;
  private glow: Phaser.GameObjects.Image;
  private half: number;
  private age = 0;
  private readonly duration: number;
  /** The slashes' own axis. */
  private ax: number;
  private ay: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    ux: number,
    uy: number,
    private scheme: Scheme,
    depth: number,
    private size = 1,
  ) {
    this.duration = CLAW_MS + 70 * (size - 1);
    // Raked across the punch at a slant, the way a paw comes down.
    const a = CLAW_SLANT;
    this.ax = ux * Math.cos(a) - uy * Math.sin(a);
    this.ay = ux * Math.sin(a) + uy * Math.cos(a);
    this.half = Math.ceil(CLAW_LEN * size + 4 * size) + 2;
    this.layer = new PixelLayer(scene, this.half * 2, this.half * 2);
    this.layer.image.setPosition(Math.round(x - this.half), Math.round(y - this.half)).setDepth(uy < -0.5 ? depth - 0.5 : depth + 0.32);
    this.glow = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(scheme.mid).setScale(0.45 * size).setDepth(depth + 0.25);
    this.draw();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    if (this.age >= this.duration) {
      this.destroy();
      return;
    }
    this.draw();
  }

  private draw(): void {
    const { ax, ay, size: k, scheme: c, half: H } = this;
    const t = this.age / this.duration;
    const fade = t < 0.45 ? 1 : 1 - (t - 0.45) / 0.55;
    const L = CLAW_LEN * k;
    const b = this.layer;
    b.clear();
    for (let py = 0; py < H * 2; py++) {
      for (let px = 0; px < H * 2; px++) {
        const rx = px + 0.5 - H;
        const ry = py + 0.5 - H;
        const ra = rx * ax + ry * ay;
        const rb = -rx * ay + ry * ax;
        for (let i = 0; i < 3; i++) {
          // Each claw a beat behind the last, and set a little further along.
          const reveal = Math.min(1, Math.max(0, (t - i * 0.06) / 0.28));
          if (reveal <= 0) continue;
          const s = (ra - (i - 1) * 1.2 * k) / L;
          if (Math.abs(s) > 1 || s > -1 + 2 * reveal) continue;
          const w = (1 - s * s) * 1.05 * k + 0.25;
          const d = rb - (i - 1) * CLAW_GAP * k - (1 - s * s) * 1.3 * k;
          const tip = reveal < 1 && s > -1 + 2 * reveal - 0.3;
          if (Math.abs(d) < w * 0.45) b.put(px, py, tip || t < 0.2 ? c.core : c.hot, fade);
          else if (Math.abs(d) < w) b.put(px, py, c.mid, fade);
          else if (d > 0 && d < w + 0.9) b.put(px, py, c.deep, fade * 0.9);
          else continue;
          break;
        }
      }
    }
    b.flush();
    this.glow.setAlpha(0.45 * fade);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
    this.glow.destroy();
  }
}

/** How long a puff of the somersault cloud lingers. */
const CLOUD_MS = 720;

/**
 * A puff of the Monkey King's somersault cloud: three round billows on a
 * flat foot with a curl in the biggest, the old auspicious-cloud shape,
 * blooming, drifting off along (vx, vy) as it slows, and breaking up.
 */
export class CloudCurl implements Effect {
  dead = false;
  private layer: PixelLayer;
  private half: number;
  private age = 0;
  private x: number;
  private y: number;
  /** Mirrored at random, so a ring of them doesn't look stamped. */
  private flip: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private vx: number,
    private vy: number,
    private scheme: Scheme,
    depth: number,
    private size = 1,
  ) {
    this.x = x;
    this.y = y;
    this.flip = Math.random() < 0.5 ? -1 : 1;
    this.half = Math.ceil(7.5 * size) + 2;
    this.layer = new PixelLayer(scene, this.half * 2, this.half * 2);
    this.layer.image.setDepth(depth);
    this.draw();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    if (this.age >= CLOUD_MS) {
      this.destroy();
      return;
    }
    // Drifting, and slowing as it goes.
    const slow = 1 - this.age / CLOUD_MS;
    this.x += (this.vx * slow * dt) / 1000;
    this.y += (this.vy * slow * dt) / 1000;
    this.draw();
  }

  private draw(): void {
    const t = this.age / CLOUD_MS;
    const g = this.size * (0.45 + 0.55 * easeOut(t / 0.22)) * (1 + 0.12 * t);
    const fade = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
    const c = this.scheme;
    const H = this.half;
    const b = this.layer;
    b.image.setPosition(Math.round(this.x - H), Math.round(this.y - H));
    b.clear();
    const f = this.flip;
    const bumps: [number, number, number][] = [
      [-3 * f, 0.6, 2.2],
      [0, -0.9, 3],
      [3.2 * f, 0.7, 2],
    ];
    const foot = 2 * g;
    const inside = (x: number, y: number) => y < foot && bumps.some(([bx, by, r]) => Math.hypot(x - bx * g, y - by * g) < r * g);
    const ox = bumps[1][0] * g;
    const oy = bumps[1][1] * g;
    for (let py = 0; py < H * 2; py++) {
      for (let px = 0; px < H * 2; px++) {
        const x = px + 0.5 - H;
        const y = py + 0.5 - H;
        if (!inside(x, y)) continue;
        // It breaks up from the edges in as it fades.
        if (hash(px, py, 7) > fade + 0.15) continue;
        const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        const dc = Math.hypot(x - ox, y - oy);
        const ang = Math.atan2(y - oy, (x - ox) * f);
        // The curl: a ring in the big billow, open at the bottom right, and its heart.
        const curl = (Math.abs(dc - 1.5 * g) < 0.5 && !(ang > 0.2 && ang < 1.9)) || dc < 0.5;
        const col = rim ? c.deep : curl ? c.mid : y < -1.2 * g ? c.core : y > foot - 1.2 ? c.mid : c.hot;
        b.put(px, py, col, rim ? 0.85 * fade : fade);
      }
    }
    b.flush();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
  }
}

/**
 * Cracked earth where the monk came down: jagged fissures running out from
 * the point of impact, glowing with qi at first, then fading. Drawn once, so
 * it costs nothing while it lingers.
 */
export class Fissure implements Effect {
  dead = false;
  private layer: PixelLayer;
  private age = 0;
  private readonly duration = 1600;

  /** `fire`: what glows up out of the cracks, when not golden qi (the guardian's magma). */
  constructor(scene: Phaser.Scene, x: number, y: number, radius: number, fire?: Scheme) {
    const glow = fire ? [fire.hot, fire.mid, fire.core] : [0xffe7a0, 0xc07a30, 0xfffbea];
    const W = Math.ceil(radius * 2) + 4;
    const H = Math.ceil(radius * 1.3) + 4;
    this.layer = new PixelLayer(scene, W, H);
    // On the ground, under the shockwave.
    this.layer.image.setPosition(Math.round(x - W / 2), Math.round(y - H / 2)).setDepth(2.5);
    const cx = W / 2;
    const cy = H / 2;
    const b = this.layer;
    const seed = Math.floor(x * 7 + y * 13);
    const cracks = 7;
    for (let i = 0; i < cracks; i++) {
      let a = (i / cracks) * Math.PI * 2 + hash(seed, i) * 0.6;
      let px = cx;
      let py = cy;
      const len = radius * (0.55 + hash(seed, i, 1) * 0.45);
      for (let s = 0; s < len; s++) {
        // Wander a little as it runs; squashed into the ground plane.
        a += (hash(seed, i, s + 2) - 0.5) * 0.7;
        px += Math.cos(a);
        py += Math.sin(a) * 0.62;
        const k = s / len;
        const ix = Math.floor(px);
        const iy = Math.floor(py);
        b.put(ix, iy, k < 0.35 ? glow[0] : k < 0.6 ? glow[1] : 0x2a1a10, k < 0.35 ? 1 : 0.9 - k * 0.4);
        // A lip of broken ground beside the crack near its root.
        if (k < 0.5) b.put(ix, iy + 1, 0x1a100a, 0.7);
        // Now and then it forks.
        if (s > 3 && hash(seed, i, s + 50) > 0.88) {
          const fa = a + (hash(seed, s) > 0.5 ? 0.9 : -0.9);
          for (let t = 1; t < 4; t++) b.put(Math.floor(px + Math.cos(fa) * t), Math.floor(py + Math.sin(fa) * t * 0.62), 0x2a1a10, 0.7);
        }
      }
    }
    // The crater's heart.
    for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.hypot(dx, dy * 1.5) < 3.2) b.put(Math.floor(cx + dx), Math.floor(cy + dy), Math.hypot(dx, dy * 1.5) < 1.6 ? glow[2] : 0x3a2414, 0.9);
    b.flush();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    if (this.age >= this.duration) {
      this.destroy();
      return;
    }
    const t = this.age / this.duration;
    this.layer.image.setAlpha(t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
  }
}
