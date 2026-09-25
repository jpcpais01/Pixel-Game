import Phaser from 'phaser';
import { ARCANE_STYLE, type SpellStyle } from './spells';

// The wizard's second attack: hold to gather light at the staff, release to
// fire a beam that burns through everything along its line.

/** Time to reach full charge. */
export const CHARGE_TIME = 3000;
/** How long full charge can be held before it fizzles out. */
export const HOLD_TIME = 2000;

/** Beam size and lifetime for a charge level (0..1). */
export function beamSpec(power: number): { length: number; width: number; duration: number } {
  return { length: 70 + 150 * power, width: 4 + 9 * power, duration: 320 + 520 * power };
}

/** Everything a beam touches: the segment and its half-width, in world pixels. */
export type BeamHit = (x0: number, y0: number, x1: number, y1: number, radius: number) => void;

const HIT_EVERY = 140;
const CHARGE_SIZE = 48; // canvas for the charge orb, centred on the crystal // ms between damage ticks while the beam burns

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

let layerId = 0;

/** Textures of finished layers, by size, for the next layer of that size. */
const spare = new Map<string, { key: string; pixels: Uint8Array }[]>();
const SPARE_PER_SIZE = 8;

/**
 * A small canvas of solid light pixels. Drawn with normal blending, not
 * additive, so the beam keeps its crisp white core and deep-blue edge even
 * over sunlit stone; soft glows and real lights around it add the bloom.
 * Where shapes overlap, the more opaque (then brighter) pixel wins.
 *
 * The pixels go straight to the GPU from a byte array. Going through a 2D
 * canvas made the browser read the canvas back from the GPU on every upload,
 * which phones do slowly, and many effects redraw every frame. Textures are
 * reused by later layers of the same size instead of being made anew.
 */
export class PixelLayer {
  readonly image: Phaser.GameObjects.Image;
  readonly w: number;
  readonly h: number;
  private scene: Phaser.Scene;
  private key: string;
  private pixels: Uint8Array;
  /** Whether the pixels changed since the last upload. */
  private dirty = false;
  /** Whether any pixel may be lit (so a clear changes something). */
  private inked = false;

  constructor(scene: Phaser.Scene, w: number, h: number) {
    this.scene = scene;
    this.w = w;
    this.h = h;
    const reuse = spare.get(`${w}x${h}`)?.pop();
    if (reuse && scene.textures.exists(reuse.key)) {
      this.key = reuse.key;
      this.pixels = reuse.pixels;
      this.pixels.fill(0);
      this.dirty = true;
    } else {
      this.key = `pixel-layer-${layerId++}`;
      this.pixels = new Uint8Array(w * h * 4);
      scene.textures.addUint8Array(this.key, this.pixels, w, h);
    }
    this.image = scene.add.image(0, 0, this.key).setOrigin(0);
  }

  clear(): void {
    if (!this.inked) return;
    this.pixels.fill(0);
    this.inked = false;
    this.dirty = true;
  }

  put(x: number, y: number, color: number, alpha = 1): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || alpha <= 0) return;
    const d = this.pixels;
    const i = (y * this.w + x) * 4;
    const a = Math.round(Math.min(1, alpha) * 255);
    const r = (color >> 16) & 255;
    const g = (color >> 8) & 255;
    const b = color & 255;
    if (a < d[i + 3] || (a === d[i + 3] && r + g + b <= d[i] + d[i + 1] + d[i + 2])) return;
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = a;
    this.inked = this.dirty = true;
  }

  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const tex = this.scene.textures.get(this.key).source[0].glTexture;
    // Premultiplied on upload, like every other texture.
    tex?.update(this.pixels, this.w, this.h, false, tex.wrapS, tex.wrapT, tex.minFilter, tex.magFilter, tex.format);
  }

  destroy(): void {
    this.image.destroy();
    const size = `${this.w}x${this.h}`;
    const list = spare.get(size) ?? [];
    spare.set(size, list);
    if (list.length < SPARE_PER_SIZE) list.push({ key: this.key, pixels: this.pixels });
    else this.scene.textures.remove(this.key);
  }
}

/** Glowing ball of gathered light at the staff tip while the beam charges. */
export class BeamCharge {
  private scene: Phaser.Scene;
  private layer: PixelLayer;
  private halo: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private inflow: Phaser.GameObjects.Particles.ParticleEmitter;
  private t = 0;
  private wasFull = false;
  /** Age of the "fully charged" shock ring, or -1 when none is showing. */
  private readyAge = -1;
  private active = false;
  private k: SpellStyle;

  constructor(scene: Phaser.Scene, style: SpellStyle = ARCANE_STYLE) {
    this.scene = scene;
    this.k = style;
    const k = style;
    this.layer = new PixelLayer(scene, CHARGE_SIZE, CHARGE_SIZE);
    this.layer.image.setVisible(false);
    this.halo = scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(k.glow).setVisible(false);
    this.light = scene.lights.addLight(0, 0, 40, k.light, 0);
    // Motes of light drawn in from all around, converging on the crystal.
    this.inflow = scene.add.particles(0, 0, 'spark', {
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 17), quantity: 36 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      moveToX: 0,
      moveToY: 0,
      lifespan: 380,
      scale: { start: 0.5, end: 1 },
      alpha: { start: 0.2, end: 1 },
      tint: k.sparks,
      blendMode: Phaser.BlendModes.ADD,
      frequency: 60,
      emitting: false,
    });
  }

  /** (x, y) is the crystal's pixel, on the wizard's pixel grid. `level` is the charge (0..1); `over` how much of the hold time at full charge is used up. */
  update(dt: number, x: number, y: number, level: number, over: number, depth: number, daylight: number): void {
    const k = this.k;
    if (!this.active) {
      this.active = true;
      this.t = 0;
      this.wasFull = false;
      this.readyAge = -1;
      this.layer.image.setVisible(true);
      this.halo.setVisible(true);
      this.inflow.start();
    }
    this.t += dt;
    const t = this.t;
    const full = level >= 1;
    if (full && !this.wasFull) {
      this.readyAge = 0;
      this.flash(x, y, k.flash, 3.2, 130);
    }
    this.wasFull = full;
    if (this.readyAge >= 0) {
      this.readyAge += dt;
      if (this.readyAge > 320) this.readyAge = -1;
    }

    // Held too long, the gathered light turns unstable and starts to shake loose.
    const shaky = over > 0.25;
    const jx = shaky && hash(Math.floor(t / 50), 1) < over ? Math.round(hash(Math.floor(t / 50), 2) * 2 - 1) : 0;
    const jy = shaky && hash(Math.floor(t / 50), 3) < over ? Math.round(hash(Math.floor(t / 50), 4) * 2 - 1) : 0;
    // Drawn in pixels local to the crystal's grid point, so the orb sits on
    // the same pixel grid as the wizard however he is snapped.
    const cx = CHARGE_SIZE / 2 + jx;
    const cy = CHARGE_SIZE / 2 + jy;
    const wx = x + jx + 0.5;
    const wy = y + jy + 0.5;
    const b = this.layer;
    b.clear();
    const frame = Math.floor(t / 70);

    // Core orb: grows with charge, breathes once full.
    const r = 1.2 + level * 3.3 + (full ? Math.sin(t * 0.012) * 0.45 : 0);
    const R = Math.ceil(r + 1.5);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy) / r;
        const unstable = over > 0 && hash(dx, dy, frame) < over * 0.35;
        if (d <= 0.45) b.put(cx + dx, cy + dy, k.core);
        else if (d <= 0.8) b.put(cx + dx, cy + dy, unstable ? k.accent : k.hot);
        else if (d <= 1.05) b.put(cx + dx, cy + dy, unstable ? k.core : k.mid, 0.9);
        else if (d <= 1.35 && hash(dx, dy, frame) > 0.4) b.put(cx + dx, cy + dy, over > 0.5 ? k.accent : k.deep, 0.6);
      }
    }

    // Rings drawing inward, quicker as the charge builds.
    if (!full) {
      const period = 560 - 280 * level;
      const ph = (t % period) / period;
      const rr = 15 - (15 - (r + 1.5)) * ph * ph;
      this.ring(cx, cy, rr, k.mid, 0.25 + ph * 0.6, frame, 0.35);
    }
    // The moment it fills: a bright ring snaps outward.
    if (this.readyAge >= 0) {
      const q = this.readyAge / 320;
      this.ring(cx, cy, r + 2 + q * 16, q < 0.35 ? k.core : k.hot, 1 - q, frame, 0.15);
    }

    // Motes orbiting the orb; more of them as it fills.
    const motes = 2 + Math.floor(level * 3);
    for (let i = 0; i < motes; i++) {
      const a = t * 0.009 * (1 + level) + (i / motes) * Math.PI * 2;
      const or = r + 2.6;
      b.put(Math.round(cx + Math.cos(a) * or), Math.round(cy + Math.sin(a) * or * 0.8), over > 0.5 && i % 2 ? k.accent : k.hot);
    }

    // Unstable: jagged crackles of light arcing off the orb.
    if (over > 0) {
      const arcs = Math.floor(1 + over * 3);
      for (let m = 0; m < arcs; m++) {
        if (hash(frame, m, 7) > 0.35 + over * 0.5) continue;
        let a = hash(frame, m, 9) * Math.PI * 2;
        let px = cx + Math.cos(a) * (r + 1);
        let py = cy + Math.sin(a) * (r + 1);
        const len = 3 + Math.floor(hash(frame, m, 11) * 4);
        for (let s = 0; s < len; s++) {
          a += (hash(frame, m, s + 20) - 0.5) * 1.4;
          px += Math.cos(a);
          py += Math.sin(a);
          b.put(Math.round(px), Math.round(py), s === 0 ? k.core : k.accent, 1 - s / (len + 1));
        }
      }
    }

    b.flush();
    b.image.setPosition(x - CHARGE_SIZE / 2, y - CHARGE_SIZE / 2).setDepth(depth);

    const flicker = 0.9 + Math.random() * 0.1 - (shaky ? Math.random() * over * 0.4 : 0);
    this.halo
      .setPosition(wx, wy)
      .setDepth(depth - 0.1)
      .setScale(0.45 + level * 0.65)
      .setTint(over > 0.5 ? k.unstable : k.glow)
      .setAlpha((0.4 + level * 0.45) * flicker * (1 - daylight * 0.35));
    this.light.setPosition(wx, wy);
    this.light.radius = 40 + level * 50;
    this.light.intensity = (0.5 + level * 1.3) * flicker * (1 - daylight * 0.5);
    this.inflow.setPosition(wx, wy).setDepth(depth - 0.05);
    this.inflow.frequency = full ? 40 : 75 - 45 * level;
  }

  private ring(cx: number, cy: number, radius: number, color: number, alpha: number, frame: number, gaps: number): void {
    const R = Math.ceil(radius + 1);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (Math.abs(Math.hypot(dx, dy) - radius) < 0.55 && hash(dx, dy, frame + 3) > gaps) this.layer.put(cx + dx, cy + dy, color, alpha);
      }
    }
  }

  private flash(x: number, y: number, color: number, intensity: number, radius: number): void {
    const light = this.scene.lights.addLight(x, y, 50, color, intensity);
    this.scene.tweens.add({
      targets: light,
      intensity: 0,
      radius,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => this.scene.lights.removeLight(light),
    });
  }

  /** Put the charge away (it has been fired). */
  hide(): void {
    if (!this.active) return;
    this.active = false;
    this.layer.image.setVisible(false);
    this.halo.setVisible(false);
    this.light.intensity = 0;
    this.inflow.stop();
    this.inflow.killAll();
  }

  /** Held too long: the light sputters out in a puff of violet sparks. */
  fizzle(x: number, y: number): void {
    this.hide();
    const puff = this.scene.add
      .sprite(Math.round(x), Math.round(y), this.k.burst.texture, 'b2')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(this.k.fizzle)
      .setAlpha(0.7)
      .setDepth(this.layer.image.depth)
      .play({ key: this.k.burst.anim, startFrame: 2 });
    puff.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => puff.destroy());
    const sparks = this.scene.add
      .particles(0, 0, 'spark', {
        lifespan: { min: 250, max: 520 },
        speed: { min: 12, max: 38 },
        gravityY: 40,
        scale: { start: 0.5, end: 0.5 },
        alpha: { start: 1, end: 0 },
        tint: this.k.fizzleSparks,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(this.layer.image.depth);
    sparks.explode(16, x, y);
    this.scene.time.delayedCall(700, () => sparks.destroy());
    this.flash(x, y, this.k.fizzle, 2.2, 90);
  }
}

/** A fired beam: a rippling column of light with a flaring head, burning everything it crosses. */
export class Beam {
  dead = false;
  private scene: Phaser.Scene;
  private layer: PixelLayer;
  /** Local pixel of the layer's top-left corner. */
  private lx: number;
  private ly: number;
  private glows: Phaser.GameObjects.Image[] = [];
  private lights: Phaser.GameObjects.Light[] = [];
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  /** World position of the drawing's local origin (a pixel corner). */
  private ox: number;
  private oy: number;
  private x0: number;
  private y0: number;
  private ux: number;
  private uy: number;
  private power: number;
  private length: number;
  private width: number;
  private duration: number;
  private age = 0;
  private nextHit = 0;
  private hit: BeamHit;
  private k: SpellStyle;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    dx: number,
    dy: number,
    power: number,
    world: Phaser.Geom.Rectangle,
    depth: number,
    hit: BeamHit,
    style: SpellStyle = ARCANE_STYLE,
  ) {
    this.scene = scene;
    this.k = style;
    const k = style;
    // (x, y) is the crystal's pixel on the wizard's grid; the beam starts at its centre.
    this.ox = x;
    this.oy = y;
    this.x0 = x + 0.5;
    this.y0 = y + 0.5;
    const l = Math.hypot(dx, dy) || 1;
    this.ux = dx / l;
    this.uy = dy / l;
    this.power = power;
    this.hit = hit;
    const spec = beamSpec(power);
    this.width = spec.width;
    this.duration = spec.duration;

    // Stop at the edge of the world.
    let len = spec.length;
    if (this.ux > 0.001) len = Math.min(len, (world.right - 2 - this.x0) / this.ux);
    if (this.ux < -0.001) len = Math.min(len, (this.x0 - world.left - 2) / -this.ux);
    if (this.uy > 0.001) len = Math.min(len, (world.bottom - 2 - this.y0) / this.uy);
    if (this.uy < -0.001) len = Math.min(len, (this.y0 - world.top - 2) / -this.uy);
    this.length = Math.max(8, len);

    // Canvas covering the whole beam at its widest (the opening flare, ripples and flecks).
    const reach = Math.ceil(this.maxReach(this.width / 2 * 1.35)) + 1;
    const ex = 0.5 + this.ux * this.length;
    const ey = 0.5 + this.uy * this.length;
    this.lx = Math.floor(Math.min(0.5, ex) - reach);
    this.ly = Math.floor(Math.min(0.5, ey) - reach);
    const lw = Math.ceil(Math.max(0.5, ex) + reach) - this.lx + 1;
    const lh = Math.ceil(Math.max(0.5, ey) + reach) - this.ly + 1;
    this.layer = new PixelLayer(scene, lw, lh);
    this.layer.image.setPosition(x + this.lx, y + this.ly).setDepth(depth);

    // Soft bloom along the column, and real light spilling onto the ground.
    const glowCount = Math.max(2, Math.round(this.length / 16));
    for (let i = 0; i <= glowCount; i++) {
      this.glows.push(
        scene.add
          .image(0, 0, 'glow')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(k.glow)
          .setScale(0.5 + power * 0.5)
          .setDepth(depth - 0.1)
          .setVisible(false),
      );
    }
    for (let i = 0; i < 4; i++) this.lights.push(scene.lights.addLight(this.x0, this.y0, 50 + power * 30, k.light, 0));

    const x1 = this.x0 + this.ux * this.length;
    const y1 = this.y0 + this.uy * this.length;
    this.sparks = scene.add
      .particles(0, 0, 'spark', {
        emitZone: { type: 'random', source: new Phaser.Geom.Line(this.x0, this.y0, x1, y1) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: { min: 220, max: 520 },
        speed: { min: 6, max: 26 + power * 20 },
        scale: { start: 0.5, end: 0.5 },
        alpha: { start: 1, end: 0 },
        tint: k.sparks,
        blendMode: Phaser.BlendModes.ADD,
        frequency: 22 - power * 14,
        quantity: 1 + Math.round(power),
      })
      .setDepth(depth + 0.1);

    // The kick of release.
    const flash = scene.lights.addLight(this.x0, this.y0, 60, k.flash, 2 + power * 1.5);
    scene.tweens.add({
      targets: flash,
      intensity: 0,
      radius: 150 + power * 80,
      duration: 320,
      ease: 'Quad.easeOut',
      onComplete: () => scene.lights.removeLight(flash),
    });
    // A gentle rumble: enough to feel the release, not to blur the view.
    scene.cameras.main.shake(this.duration * 0.8, 0.00002 + power * 0.00005);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    const { age, duration, length, power, ux, uy, x0, y0 } = this;
    if (age >= duration) {
      this.destroy();
      return;
    }

    // Shoots out fast, flares wide at first, then thins to a thread and is gone.
    const grow = 1 - Math.pow(1 - Math.min(1, age / 90), 3);
    const fade = Math.min(1, (duration - age) / 200);
    const env = (age < 110 ? 1.35 - (0.35 * age) / 110 : 1) * fade * (0.95 + Math.random() * 0.05);
    const cur = length * grow;
    const hw = (this.width / 2) * env;

    // Damage ticks for as long as the beam is thick enough to burn.
    if (age >= this.nextHit && fade > 0.4) {
      this.nextHit = age + HIT_EVERY;
      this.hit(x0, y0, x0 + ux * cur, y0 + uy * cur, hw);
    }

    this.draw(cur, hw, age);

    for (let i = 0; i < this.glows.length; i++) {
      const s = (i / (this.glows.length - 1)) * cur;
      this.glows[i].setPosition(x0 + ux * s, y0 + uy * s).setVisible(true).setAlpha((0.2 + power * 0.15) * env);
    }
    this.lights.forEach((l, i) => {
      const s = (i / (this.lights.length - 1)) * cur;
      l.setPosition(x0 + ux * s, y0 + uy * s);
      l.intensity = (0.6 + power * 0.9) * env;
    });
    if (fade < 0.6) this.sparks.stop();
  }

  private draw(cur: number, hw: number, t: number): void {
    const k = this.k;
    // Local coordinates: whole numbers are pixel corners on the wizard's grid.
    const x0 = this.x0 - this.ox;
    const y0 = this.y0 - this.oy;
    const { ux, uy } = this;
    const b = this.layer;
    b.clear();
    const frame = Math.floor(t / 55);
    const headR = hw * 1.5 + 1.5;
    const muzzleR = hw * 1.05 + 1.5;
    const reach = this.maxReach(hw);
    const { lx, ly } = this;
    const x1 = x0 + ux * cur;
    const y1 = y0 + uy * cur;
    const minX = Math.floor(Math.min(x0, x1) - reach);
    const maxX = Math.ceil(Math.max(x0, x1) + reach);
    const minY = Math.floor(Math.min(y0, y1) - reach);
    const maxY = Math.ceil(Math.max(y0, y1) + reach);
    const headPulse = 1 + Math.sin(t * 0.05) * 0.12;

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const rx = px + 0.5 - x0;
        const ry = py + 0.5 - y0;
        const along = rx * ux + ry * uy;
        const side = rx * uy - ry * ux;
        const perp = Math.abs(side);
        if (along < -reach || along > cur + reach || perp > reach) continue;

        // Body: a column whose edges ripple, narrower where it leaves the staff.
        let d = Infinity;
        let flow = false;
        if (along >= 0 && along <= cur) {
          let w = hw * (1 + 0.16 * Math.sin(along * 0.42 - t * 0.028));
          if (along < 6) w *= 0.55 + (0.45 * along) / 6;
          d = perp / Math.max(0.6, w);
          // Packets of brighter light streaming outward.
          flow = (((along - t * 0.22) % 16) + 16) % 16 < 3;
        }
        d = Math.min(d, Math.hypot(along - cur, perp) / (headR * headPulse), Math.hypot(along, perp) / muzzleR);

        // Two violet strands spiralling around the column.
        if (along > 3 && along < cur && d > 0.55 && d <= 1.25) {
          const off = Math.sin(along * 0.23 - t * 0.021) * hw * 1.05;
          if (Math.abs(side - off) < 0.55 || Math.abs(side + off) < 0.55) {
            b.put(px - lx, py - ly, k.accent, 0.85);
            continue;
          }
        }

        const qx = px - lx;
        const qy = py - ly;
        if (d <= 0.3) b.put(qx, qy, k.core);
        else if (d <= 0.58) b.put(qx, qy, flow ? k.core : k.hot);
        else if (d <= 0.82) b.put(qx, qy, flow ? k.hot : k.mid);
        else if (d <= 1) {
          if (hash(px, py, frame) > 0.22) b.put(qx, qy, k.deep, 0.85);
        } else if (d <= 1.4 && hash(px, py, frame + 5) > 0.88) b.put(qx, qy, hash(px, py, 1) > 0.5 ? k.accent : k.deep, 0.6);

      }
    }
    b.flush();
  }

  /** How far from the beam's line any pixel can be drawn, for a half-width. */
  private maxReach(hw: number): number {
    return Math.max(hw * 1.5 + 1.5, hw * 1.2) * 1.4 + 2;
  }

  private destroy(): void {
    this.dead = true;
    this.layer.destroy();
    for (const g of this.glows) g.destroy();
    for (const l of this.lights) this.scene.lights.removeLight(l);
    this.sparks.stop();
    this.scene.time.delayedCall(600, () => this.sparks.destroy());
  }
}
