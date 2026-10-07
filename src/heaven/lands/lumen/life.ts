// Lumen Meadow's own living parts (see ../types.ts LandExtra): fireflies
// drifting and blinking over the long grass and down by the streams by night,
// dandelion seeds rising off the clocks as little lights, glowing motes and
// glints on the streams, and butterflies flitting from flower to flower:
// bright ones by day, glowing ones and pale moths by night. All of it a few
// dozen small sprites round the view: no full-screen layers.

import Phaser from 'phaser';
import type { WorldScene } from '../../../scenes/WorldScene';
import type { LandExtra } from '../types';
import { K } from './palette';
import type { LumenGen } from './gen';
import type { FlyKind } from './art';

type Img = Phaser.GameObjects.Image;
type Sprite = Phaser.GameObjects.Sprite;

/** Fireflies at once, how far each wanders round its spot (px), and how long (ms) before it moves on. */
const FIREFLIES = 42;
const FIREFLY_ROAM = 22;
const FIREFLY_LIFE: [number, number] = [7000, 9000];
const FIREFLY_TINTS = [0xd8ff74, 0xfff08c, 0xb4ff9c];
/** Seeds rising at once, their climb and drift (px a second), and their life (ms). */
const SEEDS = 22;
const SEED_RISE: [number, number] = [5, 7];
const SEED_DRIFT = 7;
const SEED_LIFE: [number, number] = [5000, 3500];
const SEED_TINTS = [0xe8fff4, 0xd0f4ff, 0xffffff];
/** Motes in the streams by night, glints by day. */
const MOTES = 22;
const MOTE_TINTS = [0x5af0e0, 0x9afff0, 0x48d0ff];
const GLINT_TINTS = [0xffffff, 0xf2fff8, 0xfff6d8];
/** Butterflies at once; how fast they fly (px a second), how high, how near the wanderer they shy. */
const FLIES = 7;
const FLY_SPEED = 26;
const FLY_HEIGHT: [number, number] = [8, 22];
const FLY_FEAR = 26;
const DAY_FLIES: FlyKind[] = ['d', 'y', 'p', 'y'];
const NIGHT_FLIES: FlyKind[] = ['t', 'v', 'm', 't', 'v'];

/** The ground's glow by daylight, as the runtime has it (gone by day, full by night). */
const glowFor = (d: number): number => Math.max(0, Math.min(1, 1.15 - d * 1.5));
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const between = (r: [number, number]) => r[0] + Math.random() * r[1];

interface Firefly {
  dot: Img;
  halo: Img;
  hx: number;
  hy: number;
  t: number;
  life: number;
  ph: number;
  rate: number;
}

interface Seed {
  img: Img;
  x: number;
  y: number;
  t: number;
  life: number;
  ph: number;
}

interface Mote {
  img: Img;
  x: number;
  y: number;
  vx: number;
  t: number;
  life: number;
}

interface Fly {
  obj: Sprite;
  glow: Sprite;
  shadow: Img;
  kind: FlyKind;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  /** ms left resting on a flower, or 0 while flying. */
  rest: number;
  ph: number;
  alpha: number;
}

export class LumenLife implements LandExtra {
  private flies: Firefly[] = [];
  private seeds: Seed[] = [];
  private motes: Mote[] = [];
  private butterflies: Fly[] = [];
  private night = false;

  constructor(
    world: WorldScene,
    private gen: LumenGen,
  ) {
    const add = world.add;
    for (let k = 0; k < FIREFLIES; k++) {
      const tint = pick(FIREFLY_TINTS);
      const halo = add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.28).setVisible(false);
      const dot = add.image(0, 0, 'spark').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.5).setVisible(false);
      this.flies.push({ dot, halo, hx: 0, hy: 0, t: 0, life: 0, ph: Math.random() * 7, rate: 0.0016 + Math.random() * 0.0016 });
    }
    for (let k = 0; k < SEEDS; k++) this.seeds.push({ img: add.image(0, 0, 'spark').setTint(pick(SEED_TINTS)).setScale(0.5).setVisible(false), x: 0, y: 0, t: 0, life: 0, ph: Math.random() * 7 });
    for (let k = 0; k < MOTES; k++) this.motes.push({ img: add.image(0, 0, 'spark').setBlendMode(Phaser.BlendModes.ADD).setDepth(3.2).setScale(0.5).setVisible(false), x: 0, y: 0, vx: 0, t: 0, life: 0 });
    for (let k = 0; k < FLIES; k++) {
      const obj = add.sprite(0, 0, 'lumen_fly', 'd0').setPipeline('Lit').setVisible(false);
      const glow = add.sprite(0, 0, 'lumen_fly_e', 'd0').setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      const shadow = add.image(0, 0, 'shadow').setScale(0.35, 0.5).setDepth(3).setAlpha(0).setVisible(false);
      this.butterflies.push({ obj, glow, shadow, kind: 'd', x: NaN, y: NaN, z: 12, tx: 0, ty: 0, rest: 0, ph: Math.random() * 7, alpha: 0 });
    }
  }

  update(time: number, dt: number, d: number, hero: { x: number; y: number }, view: Phaser.Geom.Rectangle): void {
    const glow = glowFor(d);
    // Seeds are white fluff by day and little lights by night.
    const night = glow > 0.35;
    if (night !== this.night) {
      this.night = night;
      for (const s of this.seeds) s.img.setBlendMode(night ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    }
    this.updateFireflies(time, dt, glow, view);
    this.updateSeeds(time, dt, d, glow, view);
    this.updateMotes(dt, d, glow, view);
    this.updateButterflies(time, dt, d, hero, view);
  }

  destroy(): void {
    for (const f of this.flies) {
      f.dot.destroy();
      f.halo.destroy();
    }
    for (const s of this.seeds) s.img.destroy();
    for (const m of this.motes) m.img.destroy();
    for (const b of this.butterflies) {
      b.obj.destroy();
      b.glow.destroy();
      b.shadow.destroy();
    }
    this.flies = [];
    this.seeds = [];
    this.motes = [];
    this.butterflies = [];
  }

  /** A random spot in the view where `ok` holds (a few tries), or null. */
  private spot(view: Phaser.Geom.Rectangle, ok: (x: number, y: number) => boolean, pad = 0): { x: number; y: number } | null {
    for (let k = 0; k < 6; k++) {
      const x = Math.round(view.left - pad + Math.random() * (view.width + pad * 2));
      const y = Math.round(view.top - pad + Math.random() * (view.height + pad * 2));
      if (ok(x, y)) return { x, y };
    }
    return null;
  }

  // ---------------------------------------------------------------- fireflies

  private updateFireflies(time: number, dt: number, glow: number, view: Phaser.Geom.Rectangle): void {
    for (const f of this.flies) {
      f.t += dt;
      const off = f.hx < view.left - 60 || f.hx > view.right + 60 || f.hy < view.top - 60 || f.hy > view.bottom + 80;
      if (f.t >= f.life || off) {
        f.dot.setVisible(false);
        f.halo.setVisible(false);
        if (glow < 0.05) continue;
        // Most come out where the grass is long and over the water's edge.
        const at = this.spot(view, (x, y) => Math.random() < this.gen.fireflies(x, y), 30);
        if (!at) continue;
        f.hx = at.x;
        f.hy = at.y;
        f.t = 0;
        f.life = between(FIREFLY_LIFE);
      }
      // A slow loop round its spot, bobbing, glowing up and fading in its own time.
      const s = time * 0.00035 + f.ph;
      const x = f.hx + Math.sin(s * 1.3) * FIREFLY_ROAM + Math.sin(s * 3.1) * 4;
      const y = f.hy + Math.cos(s * 0.9) * FIREFLY_ROAM * 0.5;
      const z = 8 + Math.sin(s * 2.3) * 5;
      const pulse = Math.pow(Math.max(0, Math.sin(time * f.rate + f.ph)), 2);
      const fade = Math.min(1, f.t / 900, (f.life - f.t) / 900);
      const a = glow * fade * (0.25 + pulse * 0.75);
      const X = Math.round(x);
      const Y = Math.round(y - z);
      f.dot.setPosition(X, Y).setDepth(y + 30).setAlpha(a).setVisible(a > 0.02);
      f.halo.setPosition(X, Y).setDepth(y + 29).setAlpha(a * 0.45).setVisible(a > 0.02);
    }
  }

  // ---------------------------------------------------------------- seeds off the clocks

  private updateSeeds(time: number, dt: number, d: number, glow: number, view: Phaser.Geom.Rectangle): void {
    const s = dt / 1000;
    for (const p of this.seeds) {
      p.t += dt;
      if (p.t >= p.life) {
        p.img.setVisible(false);
        // From the drifts of dandelion clocks, and now and then from a stray one anywhere.
        const at = this.spot(view, (x, y) => {
          if (!this.gen.meadow(x, y)) return false;
          const dr = this.gen.drift(x, y);
          return (dr.kind === K.Clock && Math.random() < dr.d * 1.4) || Math.random() < 0.04;
        });
        if (!at) continue;
        p.x = at.x;
        p.y = at.y - 6;
        p.t = 0;
        p.life = between(SEED_LIFE);
        p.ph = Math.random() * 7;
      }
      // Up and away on the breeze, wobbling as they go.
      p.y -= between(SEED_RISE) * s;
      p.x += (SEED_DRIFT + Math.sin(time * 0.0015 + p.ph) * 6) * s;
      const fade = Math.min(1, p.t / 700, (p.life - p.t) / 1200);
      const a = fade * (0.55 + glow * 0.45) * (0.75 + 0.25 * Math.sin(time * 0.006 + p.ph)) * (d > 0.5 ? 0.85 : 1);
      p.img.setPosition(Math.round(p.x), Math.round(p.y)).setDepth(p.y + 40).setAlpha(a).setVisible(a > 0.02);
    }
  }

  // ---------------------------------------------------------------- the streams' motes and glints

  private updateMotes(dt: number, d: number, glow: number, view: Phaser.Geom.Rectangle): void {
    const s = dt / 1000;
    for (const m of this.motes) {
      m.t += dt;
      const glint = d > 0.5;
      if (m.t >= m.life) {
        m.img.setVisible(false);
        const at = this.spot(view, (x, y) => this.gen.water(x, y));
        if (!at) continue;
        m.x = at.x;
        m.y = at.y;
        m.vx = (Math.random() - 0.5) * 6;
        m.t = 0;
        m.life = glint ? 300 + Math.random() * 500 : 1400 + Math.random() * 1800;
        m.img.setTint(pick(glint ? GLINT_TINTS : MOTE_TINTS));
      }
      m.x += m.vx * s;
      const strength = glint ? (d - 0.4) * 1.2 : glow;
      m.img.setPosition(Math.round(m.x), Math.round(m.y)).setAlpha(Math.sin((m.t / Math.max(1, m.life)) * Math.PI) * strength).setVisible(strength > 0.03);
    }
  }

  // ---------------------------------------------------------------- butterflies and moths

  private updateButterflies(time: number, dt: number, d: number, hero: { x: number; y: number }, view: Phaser.Geom.Rectangle): void {
    const s = dt / 1000;
    const wantNight = d < 0.45;
    for (const b of this.butterflies) {
      const isNight = NIGHT_FLIES.includes(b.kind);
      const lost = !Number.isFinite(b.x) || Math.abs(b.x - view.centerX) > view.width || Math.abs(b.y - view.centerY) > view.height;
      // The day's kinds fade off at dusk and the night's come out (and back at dawn).
      const want = isNight === wantNight ? 1 : 0;
      b.alpha += Math.sign(want - b.alpha) * Math.min(Math.abs(want - b.alpha), s * 0.8);
      if (lost || (b.alpha <= 0 && !want)) {
        b.kind = pick(wantNight ? NIGHT_FLIES : DAY_FLIES);
        const at = this.spot(view, (x, y) => this.gen.meadow(x, y));
        if (!at) {
          this.hideFly(b);
          continue;
        }
        b.x = at.x;
        b.y = at.y;
        b.z = between(FLY_HEIGHT);
        b.alpha = 0;
        this.nextFlower(b, view);
      }
      const hx = b.x - hero.x;
      const hy = b.y - hero.y;
      if (Math.hypot(hx, hy) < FLY_FEAR) {
        // Startled up and away from the wanderer.
        b.rest = 0;
        b.tx = b.x + Math.sign(hx || 1) * 60;
        b.ty = b.y + Math.sign(hy || 1) * 30;
        b.z = Math.min(FLY_HEIGHT[1] + 8, b.z + s * 30);
      }
      let flap: number;
      if (b.rest > 0) {
        // Resting on a flower: wings slowly opening and closing.
        b.rest -= dt;
        b.z = Math.max(3, b.z - s * 20);
        flap = Math.sin(time * 0.004 + b.ph) > 0.2 ? 1 : 2;
        if (b.rest <= 0) this.nextFlower(b, view);
      } else {
        const dx = b.tx - b.x;
        const dy = b.ty - b.y;
        const dist = Math.hypot(dx, dy);
        // A fluttering, wandering line, never quite straight.
        const wob = Math.sin(time * 0.006 + b.ph) * 0.9;
        const vx = (dx / (dist || 1)) * FLY_SPEED + -dy / (dist || 1) * wob * FLY_SPEED * 0.6;
        const vy = (dy / (dist || 1)) * FLY_SPEED + dx / (dist || 1) * wob * FLY_SPEED * 0.6;
        b.x += vx * s;
        b.y += vy * s;
        b.z += (Math.sin(time * 0.009 + b.ph) * 14 + (12 - b.z) * 0.6) * s;
        flap = Math.floor((time * 0.016 + b.ph) % 4);
        flap = flap === 3 ? 1 : flap;
        if (dist < 4) {
          if (Math.random() < 0.6) b.rest = 1200 + Math.random() * 3200;
          else this.nextFlower(b, view);
        }
        b.obj.setFlipX(vx < 0);
        b.glow.setFlipX(vx < 0);
      }
      const frame = `${b.kind}${flap}`;
      const X = Math.round(b.x);
      const Y = Math.round(b.y - b.z);
      const glows = b.kind === 't' || b.kind === 'v';
      const a = Math.max(0, b.alpha);
      b.obj.setPosition(X, Y).setFrame(frame).setDepth(b.y + 24).setAlpha(a).setVisible(a > 0.02);
      b.glow.setPosition(X, Y).setFrame(frame).setDepth(b.y + 24.1).setAlpha(a * (glows ? 1 : 0.4)).setVisible(a > 0.02);
      b.shadow.setPosition(X + Math.round(b.z * 0.3), Math.round(b.y + b.z * 0.1)).setAlpha(0.2 * a * d).setVisible(a > 0.02 && d > 0.1);
    }
  }

  /** Off to another flower near where it is, within the view. */
  private nextFlower(b: Fly, view: Phaser.Geom.Rectangle): void {
    b.rest = 0;
    for (let k = 0; k < 6; k++) {
      const x = b.x + (Math.random() - 0.5) * 140;
      const y = b.y + (Math.random() - 0.5) * 90;
      if (x < view.left || x > view.right || y < view.top || y > view.bottom) continue;
      if (!this.gen.meadow(x, y)) continue;
      b.tx = x;
      b.ty = y;
      return;
    }
    b.tx = view.centerX + (Math.random() - 0.5) * view.width * 0.6;
    b.ty = view.centerY + (Math.random() - 0.5) * view.height * 0.6;
  }

  private hideFly(b: Fly): void {
    b.obj.setVisible(false);
    b.glow.setVisible(false);
    b.shadow.setVisible(false);
  }
}
