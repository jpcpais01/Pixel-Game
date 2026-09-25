import Phaser from 'phaser';
import { PixelLayer } from './Beam';
import type { Effect, Scheme } from './Slash';

// The paladin's holy light: the smite's burst where the mace lands, the
// consecrated ground that heals, the barrier around him and the numbers that
// float up when he is healed. Built like the warrior's effects: small canvases
// of solid pixels, with soft ADD glows and a real light for the bloom.

/** White-gold light with an azure edge. */
export const HOLY_FX: Scheme = { core: 0xfffdf0, hot: 0xfff0a8, mid: 0xffd35c, deep: 0x5aa0ff };
/** The Crusader's sunfire: white-gold burning down to orange and red. */
export const SUNFIRE_FX: Scheme = { core: 0xfff8e0, hot: 0xffd66b, mid: 0xff9a2e, deep: 0xd9432b };
const HOLY_TINTS = [0xfffdf0, 0xfff0a8, 0xffd35c, 0x8cc8ff];

/** Rings on the ground seen at an angle: squash them vertically. */
const SQUASH = 0.78;

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const mod = (a: number, n: number) => ((a % n) + n) % n;
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Where the mace lands: a ring of light racing out over the ground and a pillar of light rising from it. */
export class SmiteBurst implements Effect {
  dead = false;
  private scene: Phaser.Scene;
  private layer: PixelLayer;
  private glow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private age = 0;
  private redrawIn = 0;
  private readonly duration: number;
  private readonly W: number;
  private readonly H: number;
  private readonly pillar: number;

  /**
   * (x, y) is the spot on the ground; `big` for the consecration's slam.
   * `ring` widens the ring to that radius, for the Crusader's Sunfall.
   */
  constructor(scene: Phaser.Scene, x: number, y: number, private big = false, private fx: Scheme = HOLY_FX, ring?: number) {
    this.scene = scene;
    x = Math.round(x);
    y = Math.round(y);
    this.duration = ring ? 640 : big ? 520 : 380;
    this.W = ring ? Math.round(ring) * 2 + 4 : big ? 44 : 32;
    this.pillar = ring ? 70 : big ? 52 : 34;
    this.H = this.W / 2 + this.pillar + 8;
    this.layer = new PixelLayer(scene, this.W, this.H);
    // The ring's centre sits `W / 2` above the layer's bottom edge.
    this.layer.image.setPosition(x - this.W / 2, y - (this.H - this.W / 2)).setDepth(y + 0.5);
    const glowScale = ring ? ring / 16 : big ? 1.8 : 1.1;
    this.glow = scene.add.image(x, y - 4, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(fx.mid).setScale(glowScale, glowScale * SQUASH).setDepth(y + 0.6);
    this.light = scene.lights.addLight(x, y - 6, ring ? ring * 3 : big ? 110 : 70, fx.light ?? (fx === HOLY_FX ? 0xffe6a0 : 0xffb070), big || ring ? 3 : 2);
    this.draw();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    if (this.age >= this.duration) {
      this.destroy();
      return;
    }
    // Redrawn at a steady pixel-art pace rather than every frame.
    this.redrawIn -= dt;
    if (this.redrawIn <= 0) {
      this.redrawIn = 33;
      this.draw();
    }
  }

  private draw(): void {
    const t = this.age / this.duration;
    const { W, H, big, fx } = this;
    const cx = W / 2;
    const cy = H - W / 2;
    const maxR = W / 2 - 2;
    const r = 3 + (maxR - 3) * easeOut(t * 1.3);
    const th = 0.7 + 1.6 * (1 - t);
    const frame = Math.floor(this.age / 40);
    const b = this.layer;
    b.clear();
    for (let py = Math.floor(cy - maxR); py < H; py++) {
      for (let px = 0; px < W; px++) {
        const ex = px + 0.5 - cx;
        const ey = (py + 0.5 - cy) / SQUASH;
        const d = r - Math.hypot(ex, ey);
        if (d < -0.6 || d > th) continue;
        if (hash(px, py, frame) < t * 0.7) continue; // breaks up as it spreads
        const col = t < 0.25 ? fx.core : d < th * 0.5 ? fx.hot : fx.mid;
        b.put(px, py, t > 0.6 && d > th * 0.5 ? fx.deep : col, 1 - t * 0.5);
      }
    }
    // The pillar: a column of light shooting up, thinning as it goes.
    const pt = t / 0.65;
    if (pt < 1) {
      const h = this.pillar * easeOut(pt * 2.5);
      const w = (this.pillar > 60 ? 4 : big ? 2.6 : 1.7) * (1 - pt);
      for (let dy = 0; dy < h; dy++) {
        const py = Math.round(cy) - dy;
        const k = dy / h;
        for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
          const a = Math.abs(dx + 0.5 - (cx - Math.floor(cx)));
          if (a > w + 0.3) continue;
          const col = a < w * 0.45 ? fx.core : a < w * 0.8 ? fx.hot : fx.mid;
          b.put(Math.floor(cx) + dx, py, col, (1 - k * 0.7) * (1 - pt * 0.4));
        }
      }
    }
    // A star at the point of impact.
    if (t < 0.35) {
      const ray = Math.round((this.pillar > 60 ? 10 : big ? 7 : 5) * Math.sin((t / 0.35) * Math.PI));
      for (let i = -ray; i <= ray; i++) {
        const col = Math.abs(i) < ray * 0.4 ? fx.core : fx.hot;
        b.put(Math.floor(cx) + i, Math.round(cy), col);
        b.put(Math.floor(cx), Math.round(cy) + Math.round(i * SQUASH), col);
      }
    }
    b.flush();
    const fade = 1 - t;
    this.glow.setAlpha(0.55 * fade);
    this.light.intensity = (big || this.pillar > 60 ? 3 : 2) * fade;
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
    this.glow.destroy();
    this.scene.lights.removeLight(this.light);
  }
}

/**
 * Consecrated ground: a circle of holy light on the ground that pulses while
 * it lasts. Whoever the paladin shelters inside is healed on each pulse, and
 * foes inside are burned.
 */
export class Sanctuary {
  dead = false;
  readonly x: number;
  readonly y: number;
  private scene: Phaser.Scene;
  private layer: PixelLayer;
  private glow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private age = 0;
  private pulseAge = Infinity;
  private redrawIn = 0;
  private readonly hw: number;
  private readonly hh: number;

  constructor(scene: Phaser.Scene, x: number, y: number, readonly radius: number, private duration: number) {
    this.scene = scene;
    this.x = x = Math.round(x);
    this.y = y = Math.round(y);
    this.hw = Math.ceil(radius) + 3;
    this.hh = Math.ceil(radius * SQUASH) + 3;
    this.layer = new PixelLayer(scene, this.hw * 2, this.hh * 2);
    // On the ground: under every standing thing, over the ground's shadows.
    this.layer.image.setPosition(x - this.hw, y - this.hh).setDepth(3);
    this.glow = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd35c).setScale(radius / 11, (radius * SQUASH) / 11).setDepth(4).setAlpha(0);
    this.light = scene.lights.addLight(x, y - 6, radius * 3.2, 0xffe2a0, 0);
    const zone = new Phaser.Geom.Ellipse(0, 0, radius * 1.8, radius * SQUASH * 1.8);
    this.motes = scene.add
      .particles(x, y, 'spark', {
        emitZone: { type: 'random', source: zone } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: { min: 800, max: 1500 },
        speedY: { min: -14, max: -6 },
        speedX: { min: -2, max: 2 },
        scale: 0.5,
        alpha: { start: 1, end: 0 },
        tint: HOLY_TINTS,
        blendMode: Phaser.BlendModes.ADD,
        frequency: 70,
      })
      .setDepth(y + radius * SQUASH);
    this.draw();
  }

  /** Whether a spot on the ground lies inside the circle. */
  contains(px: number, py: number): boolean {
    return Math.hypot((px - this.x) / this.radius, (py - this.y) / (this.radius * SQUASH)) <= 1;
  }

  /** A ripple of light rolls out from the centre. */
  pulse(): void {
    this.pulseAge = 0;
    this.redrawIn = 0;
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    this.pulseAge += dt;
    if (this.age >= this.duration) {
      this.destroy();
      return;
    }
    const grow = easeOut(this.age / 300);
    const fade = Math.min(1, (this.duration - this.age) / 500);
    const breathe = 0.9 + Math.sin(this.age * 0.006) * 0.1;
    const flash = this.pulseAge < 400 ? 1 - this.pulseAge / 400 : 0;
    this.glow.setAlpha((0.22 * breathe + 0.2 * flash) * grow * fade);
    this.light.intensity = (1.1 * breathe + 0.8 * flash) * grow * fade;
    // Redrawn at a steady pixel-art pace rather than every frame.
    this.redrawIn -= dt;
    if (this.redrawIn <= 0) {
      this.redrawIn = 60;
      this.draw();
    }
  }

  private draw(): void {
    const { age, hw, hh } = this;
    const R = this.radius * easeOut(age / 300);
    const a = Math.min(1, (this.duration - age) / 500);
    const frame = Math.floor(age / 120);
    const spin = age * 0.02; // degrees the rune ring has turned
    const pr = this.pulseAge < 520 ? R * easeOut(this.pulseAge / 520) : -99;
    const pa = 1 - this.pulseAge / 520;
    const b = this.layer;
    b.clear();
    for (let py = 0; py < hh * 2; py++) {
      for (let px = 0; px < hw * 2; px++) {
        const ex = px + 0.5 - hw;
        const ey = (py + 0.5 - hh) / SQUASH;
        const q = Math.hypot(ex, ey);
        if (q > R + 1.2) continue;
        const deg = (Math.atan2(ey, ex) * 180) / Math.PI;
        if (q > R + 0.4) {
          // A deep gold edge, so the ring still reads on sunlit stone.
          b.put(px, py, 0xc98a2a, 0.75 * a);
        } else if (Math.abs(q - R + 0.6) < 1.0) {
          // The bright outer ring, glinting where it faces the viewer.
          b.put(px, py, ey > 0 ? HOLY_FX.core : HOLY_FX.hot, 0.95 * a);
        } else if (Math.abs(q - (R - 3)) < 0.5) {
          // A dashed inner ring turning slowly.
          if (mod(deg + spin, 24) < 14) b.put(px, py, HOLY_FX.mid, 0.9 * a);
        } else if (Math.abs(q - (R - 1.6)) < 0.5 && hash(px, py, frame) > 0.75) {
          b.put(px, py, HOLY_FX.deep, 0.6 * a);
        } else if (q > 5 && q < R - 4.5) {
          // Spokes of light flowing outward, and a faint wash between them.
          const spoke = Math.abs(mod(deg - spin * 0.5 + 22.5, 45) - 22.5) * (Math.PI / 180) * q;
          if (spoke < 0.55 && mod(q - age * 0.012, 6) < 3.2) b.put(px, py, HOLY_FX.mid, 0.6 * a);
          else if (hash(px, py, frame) > 0.96) b.put(px, py, HOLY_FX.hot, 0.6 * a);
        }
        // A faint golden wash over the whole circle.
        b.put(px, py, HOLY_FX.mid, 0.14 * a);
        if (Math.abs(q - pr) < 0.9) b.put(px, py, HOLY_FX.core, 0.85 * pa * a);
      }
    }
    // Six small sun crosses riding the ring.
    for (let k = 0; k < 6; k++) {
      const ang = ((k * 60 - spin) * Math.PI) / 180;
      const mx = Math.floor(hw + Math.cos(ang) * (R - 3));
      const my = Math.floor(hh + Math.sin(ang) * (R - 3) * SQUASH);
      b.put(mx, my, HOLY_FX.core, a);
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.put(mx + ox, my + oy, HOLY_FX.hot, 0.95 * a);
    }
    b.flush();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
    this.glow.destroy();
    this.scene.lights.removeLight(this.light);
    this.motes.stop();
    this.scene.time.delayedCall(1600, () => this.motes.destroy());
  }
}

/** The barrier: a faint shell of light around the paladin, brighter the more it holds. */
export class Aegis {
  private layer: PixelLayer;
  private glow: Phaser.GameObjects.Image;
  private t = 0;
  static readonly W = 30;
  static readonly H = 38;

  /** `fx` colours the shell; its `deep` is ignored in favour of `edge`, the shaded rim. */
  constructor(scene: Phaser.Scene, fx: Scheme = HOLY_FX, edge = 0x8cc8ff, facet = 0xbfe0ff) {
    const { W, H } = Aegis;
    this.layer = new PixelLayer(scene, W, H);
    this.glow = scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(edge).setScale(1.1, 1.4);
    // Drawn once: an egg of light with a bright rim at the top left, facets inside.
    const cx = W / 2;
    const cy = H / 2;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x + 0.5 - cx) / (W / 2 - 1);
        const dy = (y + 0.5 - cy) / (H / 2 - 1);
        const q = Math.hypot(dx, dy);
        if (q > 1) continue;
        const lit = dx + dy < -0.5;
        if (q > 0.9) this.layer.put(x, y, lit ? fx.core : edge, lit ? 0.9 : 0.6);
        else if (q > 0.8 && lit) this.layer.put(x, y, fx.hot, 0.45);
        else if (q > 0.35 && (mod(x - y, 7) === 0 || mod(x + y, 7) === 0) && hash(x, y) > 0.5) this.layer.put(x, y, facet, 0.18);
      }
    }
    this.layer.flush();
    this.layer.image.setVisible(false);
    this.glow.setVisible(false);
  }

  /** (x, y) are the paladin's feet; `amount` 0..1 is how full the barrier is. */
  update(dt: number, x: number, y: number, amount: number): void {
    this.t += dt;
    const on = amount > 0.001;
    this.layer.image.setVisible(on);
    this.glow.setVisible(on);
    if (!on) return;
    const shimmer = 0.85 + Math.sin(this.t * 0.005) * 0.15;
    const a = (0.3 + 0.55 * Math.min(1, amount * 1.5)) * shimmer;
    this.layer.image.setPosition(x - Aegis.W / 2, y + 2 - Aegis.H).setDepth(y + 0.4).setAlpha(a);
    this.glow.setPosition(x, y - 15).setDepth(y + 0.35).setAlpha(0.18 * a);
  }
}

/** A number that floats up from a character and fades: "+10" when healed. */
export class HealPop implements Effect {
  dead = false;
  private text: Phaser.GameObjects.BitmapText;
  private age = 0;
  private readonly duration = 900;

  constructor(scene: Phaser.Scene, private x: number, private y: number, text: string, tint: number) {
    this.text = scene.add.bitmapText(x, y, 'pixel', text).setLetterSpacing(-1).setOrigin(0.5, 1).setTint(tint).setDepth(10002);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    const t = this.age / this.duration;
    if (t >= 1) {
      this.destroy();
      return;
    }
    // Whole art pixels, so the letters stay crisp.
    this.text.setPosition(Math.round(this.x), Math.round(this.y - 12 * easeOut(t * 1.6))).setAlpha(t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.text.destroy();
  }
}
