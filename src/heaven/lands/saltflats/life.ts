// Saltglass Flats' own living parts (see ../types.ts LandExtra): the mirror
// itself. Whatever stands or walks in the water is reflected upside down
// beneath its feet (the wanderers too, and friends', and the flamingos);
// rings spread where feet move through the water; a few clouds drift across
// the glass; by day the sun glints on it, by night its stars twinkle and now
// and then a falling star crosses it. All of it a few dozen small sprites
// round the view: no full-screen layers.

import Phaser from 'phaser';
import type { WorldScene } from '../../../scenes/WorldScene';
import type { LandExtra } from '../types';
import { RIPPLE_FRAMES } from './art';
import type { SaltGen } from './gen';

type Sprite = Phaser.GameObjects.Sprite;
type Img = Phaser.GameObjects.Image;

/** Reflections: how strong, the sky's tint over them, and where they lie (over the ground, under shadows and feet). */
const REFLECT_ALPHA = 0.42;
const REFLECT_TINT = 0xc8d8f0;
const REFLECT_DEPTH = 1.5;
/** The land's sheets that are reflected, and the glowing layers among them (lanterns, lit windows). */
const REFLECT_KEYS = new Set(['salt_teahouse', 'salt_train', 'salt_lamp', 'salt_cairn', 'salt_chime', 'salt_pile', 'salt_flamingo']);
const GLOW_KEYS = new Set(['salt_teahouse_e', 'salt_train_e', 'salt_lamp_e']);
/** Wanderers' sheets begin so (heaven/art/sheet.ts), their shadow and glow layers end so. */
const WANDERER = 'wd_';
/** How often (ms) the world's sprites are looked over for new things to reflect. */
const SCAN_EVERY = 400;
/** Ripples: one every this many px walked through the water, each spreading for this long (ms), at most this many at once. */
const RIPPLE_STEP = 13;
const RIPPLE_MS = 1500;
const MAX_RIPPLES = 28;
/** A feeding flamingo stirs the water about this often (ms). */
const FEED_RIPPLE_MS = 1800;
/** Drifting cloud reflections: how many, how fast (px a second), how strong by day and by night. */
const CLOUDS = 5;
const CLOUD_DRIFT = 4;
const CLOUD_DAY = 0.32;
const CLOUD_NIGHT = 0.08;
const CLOUD_DEPTH = 1.3;
/** Sparkles at once: stars twinkling in the mirror by night, sun glints by day. */
const STARS = 34;
const GLINTS = 14;
const STAR_TINTS = [0xdce8ff, 0xffffff, 0xffe6c0, 0xb8ccff];
const GLINT_TINTS = [0xfff6d8, 0xffe6a8, 0xffffff];
/** A falling star crosses the mirror every so often by night (ms), taking this long. */
const METEOR_EVERY: [number, number] = [9000, 20000];
const METEOR_MS = 750;

/** The ground's glow by daylight, as the runtime has it: gone by day, full by night. */
const glowFor = (d: number): number => Math.max(0, Math.min(1, 1.15 - d * 1.5));

interface Mirror {
  src: Sprite;
  ref: Sprite;
  glow: boolean;
  /** Stands still (a prop): whether it's in water is worked out once. */
  still: boolean;
  wet: boolean;
  lx: number;
  ly: number;
  walked: number;
  feedT: number;
}

interface Ripple {
  obj: Sprite;
  t: number;
}

interface Cloud {
  obj: Sprite;
  x: number;
  y: number;
  cover: number;
  checkT: number;
}

interface Spark {
  img: Img;
  t: number;
  life: number;
  glint: boolean;
}

export class SaltMirror implements LandExtra {
  private refs = new Map<Sprite, Mirror>();
  /** What this mirror made itself, never to be reflected again. */
  private mine = new WeakSet<Phaser.GameObjects.GameObject>();
  private ripples: Ripple[] = [];
  private clouds: Cloud[] = [];
  private sparks: Spark[] = [];
  private meteor: { obj: Sprite; t: number; vx: number; vy: number };
  private meteorT = METEOR_EVERY[0];
  private scanT = 0;

  constructor(
    private world: WorldScene,
    private gen: SaltGen,
  ) {
    for (let k = 0; k < MAX_RIPPLES; k++) {
      const obj = world.add.sprite(0, 0, 'salt_ripple', 'r0').setPipeline('Lit').setDepth(REFLECT_DEPTH + 0.05).setVisible(false);
      this.mine.add(obj);
      this.ripples.push({ obj, t: RIPPLE_MS });
    }
    for (let k = 0; k < CLOUDS; k++) {
      const obj = world.add.sprite(0, 0, 'salt_cloud', `c${k % 4}`).setPipeline('Lit').setDepth(CLOUD_DEPTH).setAlpha(0).setVisible(false);
      this.mine.add(obj);
      this.clouds.push({ obj, x: NaN, y: NaN, cover: 0, checkT: 0 });
    }
    // The tiny star the wanderer's emotes use; without it there are no sparkles.
    if (world.textures.exists('spark')) {
      for (let k = 0; k < STARS + GLINTS; k++) {
        const img = world.add.image(0, 0, 'spark').setBlendMode(Phaser.BlendModes.ADD).setDepth(2.2).setVisible(false);
        this.sparks.push({ img, t: 0, life: 0, glint: k >= STARS });
      }
    }
    const obj = world.add.sprite(0, 0, 'salt_ripple_e', 'm0').setBlendMode(Phaser.BlendModes.ADD).setDepth(2.3).setVisible(false);
    this.mine.add(obj);
    this.meteor = { obj, t: METEOR_MS, vx: 0, vy: 0 };
  }

  update(_time: number, dt: number, d: number, _hero: { x: number; y: number }, view: Phaser.Geom.Rectangle): void {
    const glow = glowFor(d);
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = SCAN_EVERY;
      this.scan();
    }
    this.updateReflections(dt, glow);
    this.updateRipples(dt);
    this.updateClouds(dt, d, view);
    this.updateSparks(dt, d, glow, view);
    this.updateMeteor(dt, glow, view);
  }

  destroy(): void {
    for (const e of this.refs.values()) e.ref.destroy();
    this.refs.clear();
    for (const r of this.ripples) r.obj.destroy();
    for (const c of this.clouds) c.obj.destroy();
    for (const s of this.sparks) s.img.destroy();
    this.meteor.obj.destroy();
    this.ripples = [];
    this.clouds = [];
    this.sparks = [];
  }

  // ---------------------------------------------------------------- reflections

  /** Find what's new in the world to reflect (props stood up, flamingos, wanderers arriving), and let go of what's gone. */
  private scan(): void {
    const live = new Set<Sprite>();
    for (const o of this.world.children.list) {
      if (!(o instanceof Phaser.GameObjects.Sprite) || this.mine.has(o)) continue;
      const key = o.texture.key;
      const glow = GLOW_KEYS.has(key);
      const wanderer = key.startsWith(WANDERER) && !key.endsWith('_s') && !key.endsWith('_e');
      if (!glow && !wanderer && !REFLECT_KEYS.has(key)) continue;
      live.add(o);
      if (!this.refs.has(o)) this.track(o, glow, wanderer || key === 'salt_flamingo');
    }
    for (const [src, e] of this.refs) {
      if (live.has(src) && src.active) continue;
      e.ref.destroy();
      this.refs.delete(src);
    }
  }

  private track(src: Sprite, glow: boolean, moves: boolean): void {
    const ref = this.world.add.sprite(src.x, src.y + 1, src.texture.key, src.frame.name).setOrigin(src.originX, src.originY).setScale(src.scaleX, -src.scaleY).setDepth(REFLECT_DEPTH);
    if (glow) ref.setBlendMode(Phaser.BlendModes.ADD);
    else ref.setPipeline('Lit').setTint(REFLECT_TINT);
    ref.setVisible(false);
    this.mine.add(ref);
    this.refs.set(src, { src, ref, glow, still: !moves, wet: this.gen.wet(src.x, src.y + 1), lx: src.x, ly: src.y, walked: 0, feedT: Math.random() * FEED_RIPPLE_MS });
  }

  private updateReflections(dt: number, glow: number): void {
    for (const e of this.refs.values()) {
      const src = e.src;
      if (!src.active) continue;
      if (!e.still) {
        const moved = Math.hypot(src.x - e.lx, src.y - e.ly);
        if (moved > 0.01) {
          e.wet = this.gen.wet(src.x, src.y + 1);
          // A long jump is a wanderer travelling, not a step.
          e.walked = moved > 40 ? 0 : e.walked + moved;
          e.lx = src.x;
          e.ly = src.y;
          if (e.walked > RIPPLE_STEP && e.wet && src.visible) {
            e.walked = 0;
            this.ripple(src.x, src.y, 0);
          }
        } else if (e.wet && src.visible && src.texture.key === 'salt_flamingo' && (src.frame.name === 'i2' || src.frame.name === 'i3')) {
          e.feedT -= dt;
          if (e.feedT <= 0) {
            e.feedT = FEED_RIPPLE_MS * (0.6 + Math.random() * 0.8);
            this.ripple(src.x + (src.flipX ? -9 : 9), src.y - 2, 1);
          }
        }
      }
      const on = src.visible && e.wet && src.alpha > 0.05;
      e.ref.setVisible(on);
      if (!on) continue;
      if (e.ref.frame.name !== src.frame.name) e.ref.setFrame(src.frame.name);
      const a = e.glow ? (0.35 + glow * 0.65) * 0.5 : REFLECT_ALPHA;
      e.ref.setPosition(src.x, src.y + 1).setFlipX(src.flipX).setAlpha(a * src.alpha);
    }
  }

  // ---------------------------------------------------------------- ripples

  /** A ring spreading on the water at (x, y), starting `skip` frames in (smaller stirrings start small). */
  private ripple(x: number, y: number, skip: number): void {
    let r = this.ripples[0];
    for (const q of this.ripples) if (q.t > r.t) r = q;
    r.t = (skip / RIPPLE_FRAMES) * RIPPLE_MS * (skip ? 1.2 : 0);
    r.obj.setPosition(Math.round(x), Math.round(y)).setFlipX(Math.random() < 0.5).setVisible(true);
  }

  private updateRipples(dt: number): void {
    for (const r of this.ripples) {
      if (r.t >= RIPPLE_MS) continue;
      r.t += dt;
      if (r.t >= RIPPLE_MS) {
        r.obj.setVisible(false);
        continue;
      }
      const k = r.t / RIPPLE_MS;
      r.obj.setFrame(`r${Math.min(RIPPLE_FRAMES - 1, Math.floor(k * RIPPLE_FRAMES))}`).setAlpha(0.9 * (1 - k * k));
    }
  }

  // ---------------------------------------------------------------- clouds drifting on the glass

  private updateClouds(dt: number, d: number, view: Phaser.Geom.Rectangle): void {
    const strength = CLOUD_NIGHT + (CLOUD_DAY - CLOUD_NIGHT) * d;
    for (const c of this.clouds) {
      const lost = !Number.isFinite(c.x) || Math.abs(c.x - view.centerX) > view.width * 1.5 || Math.abs(c.y - view.centerY) > view.height * 1.5;
      if (lost || c.x > view.right + 60) {
        // Back in on the upwind side, or anywhere in view when the view has jumped.
        c.x = lost ? view.left + Math.random() * view.width : view.left - 60;
        c.y = view.top + Math.random() * view.height;
        c.cover = 0;
        c.checkT = 0;
        c.obj.setAlpha(0).setFrame(`c${Math.floor(Math.random() * 4)}`).setFlipX(Math.random() < 0.5);
      }
      c.x += (CLOUD_DRIFT * dt) / 1000;
      c.checkT -= dt;
      if (c.checkT <= 0) {
        // Only over open water: how much of the cloud's patch is wet decides how much of it shows.
        c.checkT = 300;
        let wet = 0;
        for (const [ox, oy] of COVER) if (this.gen.wet(c.x + ox, c.y + oy)) wet++;
        c.cover = (wet / COVER.length) ** 2;
      }
      const target = c.cover * strength;
      const a = c.obj.alpha + (target - c.obj.alpha) * Math.min(1, dt / 700);
      c.obj.setPosition(Math.round(c.x), Math.round(c.y)).setAlpha(a).setVisible(a > 0.01);
    }
  }

  // ---------------------------------------------------------------- sparkles

  /** Sun glints on the open glass by day; by night the mirror's stars twinkle. */
  private updateSparks(dt: number, d: number, glow: number, view: Phaser.Geom.Rectangle): void {
    for (const s of this.sparks) {
      const strength = s.glint ? Math.max(0, d - 0.3) * 1.1 : glow;
      s.t += dt;
      if (s.t >= s.life) {
        s.img.setVisible(false);
        if (strength < 0.03) continue;
        const at = this.spot(view);
        if (!at) continue;
        s.t = 0;
        s.life = s.glint ? 300 + Math.random() * 450 : 1200 + Math.random() * 2400;
        const tints = s.glint ? GLINT_TINTS : STAR_TINTS;
        s.img
          .setPosition(at.x, at.y)
          .setTint(tints[Math.floor(Math.random() * tints.length)])
          .setScale(s.glint ? 0.45 + Math.random() * 0.5 : 0.3 + Math.random() * 0.35)
          .setVisible(true);
      }
      s.img.setAlpha(Math.sin((s.t / Math.max(1, s.life)) * Math.PI) * strength);
    }
  }

  private spot(view: Phaser.Geom.Rectangle): { x: number; y: number } | null {
    for (let k = 0; k < 5; k++) {
      const x = Math.round(view.left + Math.random() * view.width);
      const y = Math.round(view.top + Math.random() * view.height);
      if (this.gen.clearSky(x, y)) return { x, y };
    }
    return null;
  }

  /** Now and then by night, a falling star streaks across the mirror. */
  private updateMeteor(dt: number, glow: number, view: Phaser.Geom.Rectangle): void {
    const m = this.meteor;
    if (m.t < METEOR_MS) {
      m.t += dt;
      const k = Math.min(1, m.t / METEOR_MS);
      m.obj.setPosition(m.obj.x + (m.vx * dt) / 1000, m.obj.y + (m.vy * dt) / 1000).setAlpha(Math.sin(k * Math.PI) * glow);
      if (m.t >= METEOR_MS) m.obj.setVisible(false);
      return;
    }
    if (glow < 0.6) return;
    this.meteorT -= dt;
    if (this.meteorT > 0) return;
    this.meteorT = METEOR_EVERY[0] + Math.random() * (METEOR_EVERY[1] - METEOR_EVERY[0]);
    const at = this.spot(view);
    if (!at) return;
    const flip = Math.random() < 0.5;
    m.t = 0;
    m.vx = flip ? -150 : 150;
    m.vy = 52;
    m.obj.setPosition(at.x, at.y).setFlipX(flip).setAlpha(0).setVisible(true);
  }
}

/** Where a drifting cloud checks it's over water (px from its middle). */
const COVER: [number, number][] = [[0, 0], [-30, 0], [30, 0], [-16, -9], [16, 9], [0, 10], [0, -10]];
