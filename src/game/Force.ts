import Phaser from 'phaser';
import { PixelLayer } from './Beam';
import type { Effect, Scheme } from './Slash';

// The Jedi's Force push: ripples of bent air rolling out in a cone from the
// open palm, kicking up dust. The dark side's version crackles with lightning.

const SQUASH = 0.78;
const SPREAD = (38 * Math.PI) / 180;

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

export class ForceWave implements Effect {
  dead = false;
  private scene: Phaser.Scene;
  private layer: PixelLayer;
  private half: number;
  private angle: number;
  private glow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private age = 0;
  private readonly duration = 420;

  /** (x, y) is the palm; (ux, uy) the unit direction pushed; `reach` how far the front rolls. */
  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private reach: number,
    private scheme: Scheme,
    depth: number,
    private lightning: boolean,
  ) {
    this.scene = scene;
    this.angle = Math.atan2(uy, ux);
    this.half = Math.ceil(reach) + 4;
    this.layer = new PixelLayer(scene, this.half * 2, this.half * 2);
    this.layer.image.setPosition(x - this.half, y - this.half).setDepth(uy < -0.5 ? depth - 0.5 : depth + 0.3);
    this.glow = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(scheme.mid).setScale(1.1).setDepth(depth + 0.25);
    this.light = scene.lights.addLight(x, y, 90, scheme.hot, 2.2);

    // Dust and motes swept along the ground ahead of the push.
    const a = Phaser.Math.RadToDeg(this.angle);
    const dust = scene.add
      .particles(0, 0, 'spark', {
        lifespan: { min: 280, max: 520 },
        speed: { min: 50, max: 130 },
        angle: { min: a - 30, max: a + 30 },
        scale: 0.5,
        alpha: { start: 0.9, end: 0 },
        tint: [scheme.hot, scheme.mid, scheme.deep],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(depth + 0.35);
    dust.explode(22, x + ux * 4, y + uy * 4);
    scene.time.delayedCall(600, () => dust.destroy());
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
    const { age, duration, reach, scheme: c, half: H } = this;
    const t = age / duration;
    const front = 4 + (reach - 4) * easeOut(age / (duration * 0.7));
    const frame = Math.floor(age / 40);
    const b = this.layer;
    b.clear();
    // Three ripples, one behind the other, thinning and fading as they roll out.
    const rings = [front, front - 7, front - 13];
    for (let py = 0; py < H * 2; py++) {
      for (let px = 0; px < H * 2; px++) {
        const ex = px + 0.5 - H;
        const ey = (py + 0.5 - H) / SQUASH;
        const q = Math.hypot(ex, ey);
        if (q > front + 1 || q < 3) continue;
        const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(ey, ex) - this.angle));
        if (off > SPREAD) continue;
        const side = off / SPREAD; // 0 on the axis .. 1 at the cone's edge
        for (let i = 0; i < rings.length; i++) {
          const R = rings[i];
          if (R < 4) continue;
          const th = (1.6 - i * 0.4) * (1 - t * 0.6) * (1 - side * 0.5);
          const d = R - q;
          if (d < -0.6 || d > th) continue;
          const n = hash(px, py, frame + i);
          if (n < t * 0.7 + side * 0.35) continue; // frays as it spreads
          const hot = i === 0 && d < th * 0.5 && side < 0.6;
          b.put(px, py, hot ? (t < 0.3 ? c.core : c.hot) : i === 0 ? c.mid : c.deep, (1 - t * 0.6) * (1 - i * 0.2));
          break;
        }
      }
    }
    if (this.lightning && t < 0.75) this.bolts(front, frame);
    b.flush();
    const fade = 1 - t;
    const fx = this.x + this.ux * front * 0.6;
    const fy = this.y + this.uy * front * 0.6 * SQUASH;
    this.glow.setPosition(this.x, this.y).setAlpha(0.6 * fade * fade);
    this.light.setPosition(fx, fy);
    this.light.intensity = 2.2 * fade;
  }

  /** Forked lightning from the palm to the wave's front, re-struck every frame. */
  private bolts(front: number, frame: number): void {
    const b = this.layer;
    const c = this.scheme;
    const H = this.half;
    for (let k = 0; k < 3; k++) {
      let a = this.angle + (hash(k, frame, 7) - 0.5) * SPREAD * 1.6;
      let x = H + this.ux * 3;
      let y = H + this.uy * 3;
      const len = front * (0.6 + hash(k, frame, 8) * 0.4);
      for (let s = 0; s < len; s += 1.5) {
        a += (hash(k, frame, s) - 0.5) * 1.1;
        x += Math.cos(a) * 1.5;
        y += Math.sin(a) * 1.5 * SQUASH;
        const px = Math.round(x);
        const py = Math.round(y);
        b.put(px, py, s < len * 0.5 ? c.core : c.hot);
        if (hash(k, s, frame) > 0.6) b.put(px, py + 1, c.mid, 0.8);
      }
    }
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
    this.glow.destroy();
    this.scene.lights.removeLight(this.light);
  }
}
