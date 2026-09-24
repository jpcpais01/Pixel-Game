import Phaser from 'phaser';
import { PixelLayer } from './Beam';

// The warrior's blade effects: crescent slashes, the lunging thrust, the
// whirlwind's ring of fire and its closing shockwave, and hit sparks. Like the
// beam, each is a small canvas of solid pixels on the warrior's pixel grid,
// with soft glows and real lights added around it.

export interface Scheme {
  core: number;
  hot: number;
  mid: number;
  deep: number;
  /** Colour of the real light the whirlwind and shockwave cast (defaults to `hot`). */
  light?: number;
}

/** Cold steel for ordinary swings. */
export const STEEL_FX: Scheme = { core: 0xffffff, hot: 0xe6f2ff, mid: 0x9fc2f7, deep: 0x5a72c8 };
/** Gold and ember for the finisher and the whirlwind. */
export const GOLD_FX: Scheme = { core: 0xfff8e0, hot: 0xffd66b, mid: 0xff9a2e, deep: 0xd9432b, light: 0xffb050 };
/** The jade skin's swings: pale, green-tempered steel. */
export const JADE_STEEL_FX: Scheme = { core: 0xffffff, hot: 0xe2fff2, mid: 0x93ecc6, deep: 0x2f9c86 };
/** The jade skin's finisher and whirlwind: a gale of jade light. */
export const JADE_FX: Scheme = { core: 0xf6fff0, hot: 0xb6ffb0, mid: 0x3fd98a, deep: 0x16806a, light: 0x70f0b0 };

const tints = (c: Scheme) => [c.core, c.hot, c.mid, c.deep];

/** Swings are circles on the ground seen at an angle: squash them vertically. */
const SQUASH = 0.78;

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const mod = (a: number, n: number) => ((a % n) + n) % n;
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

export interface Effect {
  dead: boolean;
  update(dt: number): void;
  destroy(): void;
}

/**
 * Two layers the same size around a centre point: pixels above the centre
 * row go behind the warrior, the rest in front, so rings wrap around him.
 */
class SplitLayer {
  readonly half: number;
  private back: PixelLayer;
  private front: PixelLayer;

  constructor(scene: Phaser.Scene, half: number) {
    this.half = half;
    this.back = new PixelLayer(scene, half * 2, half * 2);
    this.front = new PixelLayer(scene, half * 2, half * 2);
  }

  /** (x, y) is the centre, a pixel corner on the warrior's grid; `depth` is his. */
  place(x: number, y: number, depth: number): void {
    this.back.image.setPosition(x - this.half, y - this.half).setDepth(depth - 0.5);
    this.front.image.setPosition(x - this.half, y - this.half).setDepth(depth + 0.3);
  }

  clear(): void {
    this.back.clear();
    this.front.clear();
  }

  /** Offset from the centre, in whole pixels. */
  put(dx: number, dy: number, color: number, alpha = 1): void {
    (dy < 0 ? this.back : this.front).put(dx + this.half, dy + this.half, color, alpha);
  }

  flush(): void {
    this.back.flush();
    this.front.flush();
  }

  destroy(): void {
    this.back.destroy();
    this.front.destroy();
  }
}

/** A crescent of light swept by the blade from `from` to `to` (screen degrees, 0 = right, 90 = down). */
export class SlashArc implements Effect {
  dead = false;
  private scene: Phaser.Scene;
  private layer: SplitLayer;
  private glow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private age = 0;

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    private from: number,
    private to: number,
    private radius: number,
    private scheme: Scheme,
    depth: number,
    private duration = 210,
  ) {
    this.scene = scene;
    this.layer = new SplitLayer(scene, Math.ceil(radius) + 4);
    this.layer.place(x, y, depth);
    this.glow = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(scheme.mid).setScale(0.8).setDepth(depth + 0.25);
    this.light = scene.lights.addLight(x, y, 70, scheme.hot, 1.4);
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
    const { age, duration, from, to, radius: R, scheme: c } = this;
    const span = to - from;
    const sgn = Math.sign(span) || 1;
    const mag = Math.abs(span);
    // The head races round the arc; the tail follows and eats it up.
    const head = easeOut(age / (duration * 0.45));
    const tail = Math.pow(Math.max(0, (age - duration * 0.2) / (duration * 0.8)), 1.3);
    const frame = Math.floor(age / 40);
    const b = this.layer;
    b.clear();
    const H = b.half;
    for (let dy = -H; dy < H; dy++) {
      for (let dx = -H; dx < H; dx++) {
        const ex = dx + 0.5;
        const ey = (dy + 0.5) / SQUASH;
        const q = Math.hypot(ex, ey);
        if (q > R + 0.6 || q < R - 5) continue;
        const a = (Math.atan2(ey, ex) * 180) / Math.PI;
        const s = mod((a - from) * sgn, 360) / mag;
        if (s > head || s < tail) continue;
        const k = (s - tail) / Math.max(0.001, head - tail); // 0 at the tail, 1 at the head
        const th = 1 + 3.6 * k;
        if (q < R - th) continue;
        const radial = (R + 0.6 - q) / (th + 0.6); // 0 outer edge .. 1 inner edge
        const n = hash(dx, dy, frame);
        if (k > 0.82 && radial < 0.65) b.put(dx, dy, c.core);
        else if (radial < 0.35) b.put(dx, dy, k > 0.3 ? c.hot : c.mid, k > 0.15 ? 1 : 0.8);
        else if (radial < 0.72) b.put(dx, dy, k > 0.4 ? c.mid : c.deep, 0.95);
        else if (n > 0.3) b.put(dx, dy, c.deep, 0.75);
      }
    }
    // A glint riding the head of the swing.
    const ha = ((from + span * head) * Math.PI) / 180;
    const hx = Math.round(Math.cos(ha) * (R - 1.5) - 0.5);
    const hy = Math.round(Math.sin(ha) * (R - 1.5) * SQUASH - 0.5);
    if (head < 1) {
      b.put(hx, hy, c.core);
      b.put(hx + 1, hy, c.hot);
      b.put(hx - 1, hy, c.hot);
      b.put(hx, hy + 1, c.hot);
      b.put(hx, hy - 1, c.hot);
    }
    b.flush();
    const fade = 1 - age / duration;
    this.glow.setPosition(this.x + hx, this.y + hy).setAlpha(0.45 * fade);
    this.light.setPosition(this.x + hx, this.y + hy);
    this.light.intensity = 1.4 * fade;
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
    this.glow.destroy();
    this.scene.lights.removeLight(this.light);
  }
}

/** The finisher's lunge: a streak of light driven straight out, flaring into a star at its point. */
export class ThrustStreak implements Effect {
  dead = false;
  private scene: Phaser.Scene;
  private layer: PixelLayer;
  private half: number;
  private glow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private age = 0;
  private readonly duration = 240;

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private reach: number,
    private scheme: Scheme,
    depth: number,
  ) {
    this.scene = scene;
    this.half = Math.ceil(reach) + 6;
    this.layer = new PixelLayer(scene, this.half * 2, this.half * 2);
    this.layer.image.setPosition(x - this.half, y - this.half).setDepth(uy < -0.5 ? depth - 0.5 : depth + 0.3);
    this.glow = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(scheme.mid).setScale(1).setDepth(depth + 0.25);
    this.light = scene.lights.addLight(x, y, 80, scheme.hot, 1.8);
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
    const { age, duration, reach, ux, uy, scheme: c, half: H } = this;
    const head = 5 + (reach - 5) * easeOut(age / 70);
    const tail = 5 + (head - 5) * Math.pow(Math.max(0, (age - 80) / (duration - 80)), 1.2);
    const star = age > 55 && age < 175 ? 1 - Math.abs(age - 95) / 80 : 0;
    const frame = Math.floor(age / 40);
    const b = this.layer;
    b.clear();
    for (let py = 0; py < H * 2; py++) {
      for (let px = 0; px < H * 2; px++) {
        const rx = px + 0.5 - H;
        const ry = py + 0.5 - H;
        const along = rx * ux + ry * uy;
        const side = rx * uy - ry * ux;
        const perp = Math.abs(side);
        if (along < tail - 1 || along > head + 4) continue;
        // Flared point.
        const tipD = Math.hypot(along - head, perp);
        if (tipD < 1.2 + star * 1.2) {
          b.put(px, py, c.core);
          continue;
        }
        if (along <= head) {
          const k = (along - tail) / Math.max(0.001, head - tail); // 0 tail .. 1 point
          const w = 0.6 + 1.1 * k;
          if (perp <= w * 0.5) b.put(px, py, k > 0.35 ? c.core : c.hot);
          else if (perp <= w) b.put(px, py, c.hot, 0.95);
          else if (perp <= w + 1) b.put(px, py, k > 0.5 ? c.mid : c.deep, 0.85);
          else if (perp <= w + 2 && k > 0.6 && hash(px, py, frame) > 0.5) b.put(px, py, c.deep, 0.7);
          // Speed lines either side.
          if (Math.abs(perp - 3.6) < 0.5 && k < 0.7 && mod(along + age * 0.12, 5) < 3) b.put(px, py, c.mid, 0.75);
        }
        // Star rays at the point.
        if (star > 0) {
          const ray = 2 + star * 4;
          const ax = Math.abs(rx - ux * head);
          const ay = Math.abs(ry - uy * head);
          if ((ax < 0.5 && ay < ray) || (ay < 0.5 && ax < ray)) b.put(px, py, Math.max(ax, ay) < ray * 0.5 ? c.core : c.hot, 0.9);
        }
      }
    }
    b.flush();
    const fade = 1 - age / duration;
    this.glow.setPosition(this.x + ux * head, this.y + uy * head).setAlpha(0.55 * fade);
    this.light.setPosition(this.x + ux * head, this.y + uy * head);
    this.light.intensity = 1.8 * fade;
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
    this.glow.destroy();
    this.scene.lights.removeLight(this.light);
  }
}

/** A star of light where a blow lands. */
export class HitSpark implements Effect {
  dead = false;
  private layer: PixelLayer;
  private glow: Phaser.GameObjects.Image;
  private age = 0;
  private readonly duration = 200;

  constructor(scene: Phaser.Scene, x: number, y: number, private scheme: Scheme, depth: number, private big = false) {
    x = Math.round(x);
    y = Math.round(y);
    this.layer = new PixelLayer(scene, 21, 21);
    this.layer.image.setPosition(x - 10, y - 10).setDepth(depth);
    this.glow = scene.add.image(x + 0.5, y + 0.5, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(scheme.hot).setScale(big ? 1 : 0.7).setDepth(depth - 0.05);
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
    const t = this.age / this.duration;
    const c = this.scheme;
    const b = this.layer;
    b.clear();
    const ray = (this.big ? 3 : 2) + Math.round((this.big ? 6 : 4) * Math.sin(Math.PI * Math.min(1, t * 1.4 + 0.15)));
    const diag = Math.max(0, Math.round(ray * 0.5) - (t > 0.6 ? 1 : 0));
    for (let i = -ray; i <= ray; i++) {
      const k = Math.abs(i) / (ray + 1);
      const col = k < 0.3 ? c.core : k < 0.65 ? c.hot : c.mid;
      b.put(10 + i, 10, col, 1 - t * 0.5);
      b.put(10, 10 + i, col, 1 - t * 0.5);
    }
    for (let i = 1; i <= diag; i++) {
      for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) b.put(10 + sx * i, 10 + sy * i, i === 1 ? c.hot : c.mid, 0.9 - t * 0.5);
    }
    // Chips flung outward.
    for (let k = 0; k < 6; k++) {
      const a = hash(k, 3) * Math.PI * 2;
      const d = 3 + t * (6 + hash(k, 4) * 4);
      if (t < 0.85) b.put(Math.round(10 + Math.cos(a) * d), Math.round(10 + Math.sin(a) * d), k % 2 ? c.hot : c.deep, 1 - t);
    }
    b.put(10, 10, c.core);
    b.flush();
    this.glow.setAlpha(0.6 * (1 - t));
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
    this.glow.destroy();
  }
}

/** The whirlwind: a ring of golden fire chasing the blade round the warrior. */
export class Tempest {
  private scene: Phaser.Scene;
  private layer: SplitLayer;
  private glow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private t = 0;
  readonly radius = 17;

  constructor(scene: Phaser.Scene, private scheme: Scheme = GOLD_FX) {
    this.scene = scene;
    this.layer = new SplitLayer(scene, this.radius + 6);
    this.glow = scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(scheme.mid).setScale(1.5);
    this.light = scene.lights.addLight(0, 0, 100, scheme.light ?? scheme.hot, 0);
    this.embers = scene.add.particles(0, 0, 'spark', {
      lifespan: { min: 300, max: 600 },
      speed: { min: 8, max: 30 },
      gravityY: -26,
      scale: 0.5,
      alpha: { start: 1, end: 0 },
      tint: tints(scheme),
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
  }

  /** (x, y) is the chest pixel; `phi` the blade's screen angle in degrees. */
  update(dt: number, x: number, y: number, phi: number, depth: number, daylight: number): void {
    this.t += dt;
    const R = this.radius;
    const C = this.scheme;
    const frame = Math.floor(this.t / 45);
    const ramp = Math.min(1, this.t / 150); // the ring grows in over the first swing
    const b = this.layer;
    b.place(x, y, depth);
    b.clear();
    const H = b.half;
    for (let dy = -H; dy < H; dy++) {
      for (let dx = -H; dx < H; dx++) {
        const ex = dx + 0.5;
        const ey = (dy + 0.5) / (SQUASH * 0.92);
        const q = Math.hypot(ex, ey);
        if (q > R + 3.5 || q < R * 0.5) continue;
        const a = (Math.atan2(ey, ex) * 180) / Math.PI;
        const behind = mod(phi - a, 360);
        const reachDeg = 40 + 270 * ramp;
        if (behind > reachDeg) continue;
        const k = 1 - behind / reachDeg; // 1 at the blade
        const n = hash(dx, dy, frame);
        const th = 1 + 3.8 * k;
        if (q <= R + 0.6 && q >= R - th) {
          const radial = (R + 0.6 - q) / (th + 0.6);
          if (k > 0.86) b.put(dx, dy, radial < 0.75 ? C.core : C.hot);
          else if (k > 0.58) b.put(dx, dy, radial < 0.4 ? C.hot : C.mid);
          else if (k > 0.3) {
            if (radial < 0.35) b.put(dx, dy, C.mid, 0.95);
            else if (n > 0.25) b.put(dx, dy, C.deep, 0.85);
          } else if (n > 0.5 + (0.3 - k)) b.put(dx, dy, C.deep, 0.7);
        } else if (Math.abs(q - R * 0.62) < 0.5 && k > 0.45 && n > 0.55) {
          b.put(dx, dy, C.deep, 0.55); // a fainter inner eddy
        } else if (q > R + 1 && k > 0.5 && n > 0.93) {
          b.put(dx, dy, C.hot, 0.9); // flecks thrown off the edge
        }
      }
    }
    b.flush();

    const pa = (phi * Math.PI) / 180;
    const tx = x + Math.cos(pa) * R;
    const ty = y + Math.sin(pa) * R * SQUASH;
    if (hash(frame, 1) > 0.3) this.embers.setDepth(depth + 0.35).emitParticleAt(tx, ty, 2);
    const flicker = 0.9 + Math.random() * 0.1;
    this.glow.setPosition(x, y).setDepth(depth - 0.6).setAlpha(0.45 * ramp * flicker * (1 - daylight * 0.3));
    this.light.setPosition(x, y);
    this.light.intensity = 1.9 * ramp * flicker * (1 - daylight * 0.4);
  }

  destroy(): void {
    this.layer.destroy();
    this.glow.destroy();
    this.scene.lights.removeLight(this.light);
    this.embers.stop();
    this.scene.time.delayedCall(700, () => this.embers.destroy());
  }
}

/** The whirlwind's last swing slams out as a ring of fire rolling across the ground. */
export class Shockwave implements Effect {
  dead = false;
  private layer: PixelLayer;
  private half: number;
  private age = 0;
  private readonly duration = 420;

  constructor(scene: Phaser.Scene, x: number, y: number, private maxR: number, private scheme: Scheme = GOLD_FX) {
    this.half = Math.ceil(maxR) + 4;
    this.layer = new PixelLayer(scene, this.half * 2, this.half * 2);
    // On the ground: under every standing thing, over the ground's shadows.
    this.layer.image.setPosition(x - this.half, y - this.half).setDepth(3);

    const flash = scene.lights.addLight(x, y, 60, scheme.light ?? scheme.hot, 3.2);
    scene.tweens.add({
      targets: flash,
      intensity: 0,
      radius: maxR * 4,
      duration: 450,
      ease: 'Quad.easeOut',
      onComplete: () => scene.lights.removeLight(flash),
    });
    const debris = scene.add
      .particles(0, 0, 'spark', {
        lifespan: { min: 300, max: 700 },
        speed: { min: 30, max: 90 },
        gravityY: 70,
        scale: 0.5,
        alpha: { start: 1, end: 0 },
        tint: tints(scheme),
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(y + 1);
    debris.explode(28, x, y);
    scene.time.delayedCall(800, () => debris.destroy());
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
    const t = this.age / this.duration;
    const C = this.scheme;
    const r = 6 + (this.maxR - 6) * easeOut(t * 1.1);
    const th = 1 + 3.5 * (1 - t);
    const col = t < 0.15 ? C.core : t < 0.4 ? C.hot : t < 0.7 ? C.mid : C.deep;
    const frame = Math.floor(this.age / 40);
    const H = this.half;
    const b = this.layer;
    b.clear();
    for (let py = 0; py < H * 2; py++) {
      for (let px = 0; px < H * 2; px++) {
        const ex = px + 0.5 - H;
        const ey = (py + 0.5 - H) / SQUASH;
        const q = Math.hypot(ex, ey);
        const d = r - q; // inside the front edge
        if (d < -0.6 || d > th) continue;
        const n = hash(px, py, frame);
        if (n < t * 0.6) continue; // breaks up as it spreads
        b.put(px, py, d < th * 0.4 ? col : C.deep, 1 - t * 0.5);
      }
    }
    // The blast's heart, briefly.
    if (t < 0.25) {
      for (let py = -4; py <= 4; py++) for (let px = -5; px <= 5; px++) if (Math.hypot(px, py / SQUASH) < 5 * (1 - t * 3)) b.put(H + px, H + py, C.core, 0.9);
    }
    b.flush();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
  }
}
