import Phaser from 'phaser';
import { FZ_ICICLE_H, FZ_LANE_W, FZ_PATCH_FRAMES, FZ_RING_W, FZ_SPIKE_H, FZ_SPIKE_OY } from '../../art/frostFx';
import { ICE_TINTS, SNOW_TINTS, T_ICE } from '../../art/frostKit';
import { snap } from '../display';
import { sound } from '../../audio';
import type { Effect } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';
import { Lob, type LobSpec } from './Elementals';

// The spells the Aurora Colosseum's creatures share: ice bursting from the
// floor, darts of ice, rings of frost racing out, hoarfrost that lingers and
// chills, great icicles falling from above, and snowballs. Their pictures
// are in art/frostFx.ts.
//
// Chill: the colosseum's own harm. A chilled hero moves slower for a while
// (WorldScene.chillHero): `chill` on a spell is [speed kept 0..1, ms].

export type Chill = [number, number];

/** A light chill, the most a weak or normal foe gives. */
export const CHILL_LIGHT: Chill = [0.7, 1400];
/** A deep chill from the strong and the bosses. */
export const CHILL_DEEP: Chill = [0.5, 2000];

/** Chill the hero (`k` of their speed kept, for `ms`). */
export function chill(world: WorldScene, c: Chill | undefined): void {
  if (c) world.chillHero(c[0], c[1]);
}

/** A burst of ice (and a little snow) at (x, y), for a shatter. */
export function iceBurst(world: WorldScene, x: number, y: number, count: number, depth = y + 2): void {
  world.debris(ICE_TINTS, snap(x), snap(y), count, depth);
  world.debris(SNOW_TINTS, snap(x), snap(y), Math.ceil(count / 3), depth, 'spores');
}

/** The path a charge, a slide or a beam will take: lay it with origin (0, 0.5), then rotate and stretch it to `len` with `.setScale(len / FZ_LANE_W, width)`. */
export function frostLane(world: WorldScene, x: number, y: number, width: number, tint = T_ICE): Phaser.GameObjects.Image {
  return world.add.image(x, y, 'fz_lane').setOrigin(0, 0.5).setScale(10 / FZ_LANE_W, width).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(0).setDepth(2.2);
}

/** Place a lane from (x, y) along (ux, uy), `len` long and `width` wide, at `alpha`. */
export function layLane(lane: Phaser.GameObjects.Image, x: number, y: number, ux: number, uy: number, len: number, width: number, alpha: number): void {
  lane.setPosition(x, y).setRotation(Math.atan2(uy, ux)).setScale(len / FZ_LANE_W, width).setAlpha(alpha);
}

/** A marked spot on the floor: a ring that shows where something will strike. */
export function dangerMark(world: WorldScene, x: number, y: number, rx: number, ry: number, tint = T_ICE): Phaser.GameObjects.Image {
  return world.add.image(snap(x), snap(y), 'danger_ring').setTint(tint).setDepth(2).setScale(rx / 22, ry / 12).setAlpha(0.3);
}

// ---------------------------------------------------------------- Ice spike

export interface SpikeSpec {
  /** ms the mark shows before it erupts. */
  delay: number;
  damage: number;
  /** ms it stands before sinking back. */
  stand?: number;
  /** Drawn and reaching this many times its size. */
  size?: number;
  chill?: Chill;
  knock?: number;
  /** Quiet: no sound of its own (one of many going off at once). */
  quiet?: boolean;
}

/** Ice bursting up out of the floor on a marked spot: it strikes as it erupts, stands glittering, then sinks. */
export class IceSpike implements Effect {
  dead = false;
  private t = 0;
  private up = false;
  private ring: Phaser.GameObjects.Image;
  private fill: Phaser.GameObjects.Image;
  private body: Phaser.GameObjects.Image | null = null;
  private glow: Phaser.GameObjects.Image | null = null;
  private flash: Phaser.GameObjects.Image | null = null;
  private size: number;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private s: SpikeSpec,
  ) {
    this.size = s.size ?? 1;
    const k = this.size;
    this.ring = world.add.image(snap(x), snap(y), 'danger_ring').setTint(T_ICE).setDepth(2).setScale((11 * k) / 22, (7 * k) / 12).setAlpha(0);
    this.fill = world.add.image(snap(x), snap(y), 'danger_ring').setTint(0xe0f8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(2).setScale(0).setAlpha(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const k = this.size;
    const s = this.s;
    if (!this.up) {
      const p = Math.min(1, this.t / s.delay);
      this.ring.setAlpha(0.35 + p * 0.45 + Math.sin(this.t * 0.04) * 0.1);
      this.fill.setScale(((11 * k) / 22) * p, ((7 * k) / 12) * p).setAlpha(0.2 + p * 0.3);
      if (this.t >= s.delay) this.erupt();
      return;
    }
    const a = this.t - s.delay;
    const stand = s.stand ?? 1200;
    const pop = a < 80 ? a / 80 : a < 160 ? 1.14 - ((a - 80) / 80) * 0.14 : 1;
    const sink = Math.max(0, (a - stand) / 280);
    const h = Math.max(0, pop - sink);
    this.body?.setScale(k, k * h).setAlpha(Math.min(1, 1.4 - sink));
    this.glow?.setScale(k, k * h).setAlpha(Math.min(1, 1.2 - sink));
    this.flash?.setAlpha(Math.max(0, 0.9 - a / 220)).setScale((1 + a / 200) * k);
    if (sink >= 1) this.destroy();
  }

  private erupt(): void {
    this.up = true;
    const { world: w, x, y, size: k, s } = this;
    this.ring.setVisible(false);
    this.fill.setVisible(false);
    const v = `k${Math.floor(Math.random() * 3)}`;
    const oy = FZ_SPIKE_OY / FZ_SPIKE_H;
    const flip = Math.random() < 0.5;
    this.body = w.add.image(snap(x), snap(y) + 1, 'fz_spike', v).setOrigin(0.5, oy).setPipeline('Lit').setDepth(y).setFlipX(flip).setScale(k, 0);
    this.glow = w.add.image(snap(x), snap(y) + 1, 'fz_spike_e', v).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).setFlipX(flip).setScale(k, 0);
    this.flash = w.add.image(snap(x), snap(y) - 6, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xc8f4ff).setDepth(y + 0.2);
    if (w.hurtHeroInEllipse(x, y, 11 * k, 7 * k, { damage: s.damage, fromX: x, fromY: y + 2, knock: s.knock ?? 150 })) chill(w, s.chill);
    iceBurst(w, x, y - 4, 7);
    if (!s.quiet) sound.frost('crack', w.pan(x));
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.ring, this.fill, this.body, this.glow, this.flash]) o?.destroy();
  }
}

// ---------------------------------------------------------------- Ice shard

export interface ShardSpec {
  damage: number;
  /** px/s, and how far it flies. */
  speed?: number;
  range?: number;
  knock?: number;
  chill?: Chill;
  /** Drawn this many times its size (and reaching a little further). */
  size?: number;
  /** Its halo's colour. */
  tint?: number;
  /** Turns toward the hero this many radians a second (0 flies straight). */
  homing?: number;
}

/**
 * A dart of ice in flight, from (x, y) in the air (a body's height above the
 * floor) along (ux, uy): it shatters on the hero, or once it has flown its
 * range, or on leaving the arena.
 */
export class IceShard implements Effect {
  dead = false;
  private img: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private travelled = 0;
  private trail = 0;
  private speed: number;
  private range: number;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private s: ShardSpec,
  ) {
    this.speed = s.speed ?? 150;
    this.range = s.range ?? 200;
    const k = s.size ?? 1;
    this.img = world.add.image(x, y, 'fz_shard').setBlendMode(Phaser.BlendModes.ADD).setScale(k).setRotation(Math.atan2(uy, ux));
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(s.tint ?? T_ICE).setScale(0.38 * k).setAlpha(0.55);
  }

  update(dt: number): void {
    if (this.dead) return;
    const w = this.world;
    if (this.s.homing) {
      const h = w.heroPos;
      if (h) {
        const a = Math.atan2(this.uy, this.ux);
        const want = Math.atan2(h.y - this.y, h.x - this.x);
        const turn = Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - a), (-this.s.homing * dt) / 1000, (this.s.homing * dt) / 1000);
        this.ux = Math.cos(a + turn);
        this.uy = Math.sin(a + turn);
        this.img.setRotation(a + turn);
      }
    }
    const d = (this.speed * dt) / 1000;
    this.x += this.ux * d;
    this.y += this.uy * d;
    this.travelled += d;
    const depth = this.y + 16;
    this.img.setPosition(snap(this.x), snap(this.y)).setDepth(depth);
    this.halo.setPosition(this.x, this.y).setDepth(depth - 0.1);
    this.trail -= dt;
    if (this.trail <= 0) {
      this.trail = 40;
      w.debris(ICE_TINTS, this.x - this.ux * 6, this.y - this.uy * 6, 1, depth - 0.2, 'trail');
    }
    const k = this.s.size ?? 1;
    const hit = w.hurtHeroAt(this.x, this.y, 4 * k, { damage: this.s.damage, fromX: this.x - this.ux * 8, fromY: this.y - this.uy * 8, knock: this.s.knock ?? 90 });
    if (hit) chill(w, this.s.chill);
    if (hit || this.travelled > this.range || !w.monsterBounds.contains(this.x, this.y)) this.burst();
  }

  private burst(): void {
    iceBurst(this.world, this.x, this.y, 8, this.y + 16);
    sound.frost('chime', this.world.pan(this.x));
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
    this.halo.destroy();
  }
}

// ---------------------------------------------------------------- Frost ring

export interface RingSpec {
  /** Its radius (across) as it starts and as it fades, in px; it is 0.62 as deep. */
  from?: number;
  to: number;
  /** px/s it races out. */
  speed: number;
  damage: number;
  chill?: Chill;
  knock?: number;
  tint?: number;
}

/**
 * A ring of frost racing out along the floor from (x, y): it strikes the
 * hero once, as its crest passes under them. Step through it as it comes
 * (it's thin), or stay beyond its reach.
 */
export class FrostRing implements Effect {
  dead = false;
  private r: number;
  private struck = false;
  private img: Phaser.GameObjects.Sprite;
  private wash: Phaser.GameObjects.Image;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private s: RingSpec,
  ) {
    this.r = s.from ?? 6;
    this.img = world.add.sprite(snap(x), snap(y), 'fz_ring', 'r0').setBlendMode(Phaser.BlendModes.ADD).setDepth(2.4).setTint(s.tint ?? 0xffffff).play('fz_ring_spin');
    this.wash = world.add.image(snap(x), snap(y), 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(s.tint ?? T_ICE).setDepth(2.3).setAlpha(0.3);
    this.place();
  }

  private place(): void {
    const k = this.r / (FZ_RING_W / 2 - 2);
    const fade = 1 - Math.max(0, (this.r - this.s.to * 0.75) / (this.s.to * 0.25));
    this.img.setScale(k).setAlpha(Math.max(0, fade));
    this.wash.setScale(k * 2.2, k * 1.3).setAlpha(Math.max(0, fade) * 0.18);
  }

  update(dt: number): void {
    if (this.dead) return;
    const before = this.r;
    this.r += (this.s.speed * dt) / 1000;
    this.place();
    if (!this.struck) {
      const h = this.world.heroPos;
      if (h) {
        // The hero's distance in the ring's own measure (it's 0.62 as deep as it's wide).
        const d = Math.hypot(h.x - this.x, (h.y - this.y) / 0.62);
        if (d >= before - 5 && d <= this.r + 5) {
          this.struck = this.world.hurtHeroAt(h.x, h.y - 11, 8, { damage: this.s.damage, fromX: this.x, fromY: this.y, knock: this.s.knock ?? 120 });
          if (this.struck) chill(this.world, this.s.chill);
        }
      }
    }
    if (Math.random() < dt / 30) {
      const a = Math.random() * Math.PI * 2;
      this.world.debris(ICE_TINTS, this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r * 0.62 - 2, 1, 3, 'trail');
    }
    if (this.r >= this.s.to) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
    this.wash.destroy();
  }
}

// ---------------------------------------------------------------- Frost patch

export interface PatchSpec {
  /** Its reach across (it's half as deep), and how long it lies. */
  rx: number;
  life: number;
  chill: Chill;
  /** Damage a tick while stood in (0 for none). */
  damage?: number;
}

/** Hoarfrost spread over the floor: it chills whoever stands in it, and stings a little. */
export class FrostPatch implements Effect {
  dead = false;
  private t = 0;
  private tick = 0;
  private img: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Image;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private s: PatchSpec,
  ) {
    const k = s.rx / 27;
    this.img = world.add.sprite(snap(x), snap(y), 'fz_patch', 'p0').setDepth(1.8).setScale(k).setAlpha(0).setFlipX(Math.random() < 0.5).play({ key: 'fz_patch_glint', startFrame: Math.floor(Math.random() * FZ_PATCH_FRAMES) });
    this.glow = world.add.image(snap(x), snap(y), 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(T_ICE).setDepth(1.9).setScale(k * 1.8, k * 0.9).setAlpha(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const a = Math.min(1, this.t / 200) * Math.min(1, (this.s.life - this.t) / 500);
    this.img.setAlpha(a * 0.85);
    this.glow.setAlpha(a * 0.22);
    this.tick -= dt;
    if (this.tick <= 0 && a > 0.5) {
      this.tick = 300;
      const w = this.world;
      const h = w.heroPos;
      if (h) {
        const dx = (h.x - this.x) / this.s.rx;
        const dy = (h.y - this.y) / (this.s.rx * 0.5);
        if (dx * dx + dy * dy <= 1) {
          chill(w, this.s.chill);
          if (this.s.damage) w.hurtHeroAt(h.x, h.y - 11, 8, { damage: this.s.damage, fromX: h.x, fromY: h.y, knock: 0 });
        }
      }
    }
    if (this.t >= this.s.life) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
    this.glow.destroy();
  }
}

// ---------------------------------------------------------------- Icicle

export interface IcicleSpec {
  /** ms its mark shows before it lands (it falls in the last part of it). */
  delay: number;
  damage: number;
  size?: number;
  chill?: Chill;
  /** Leaves hoarfrost where it shatters, this many ms. */
  patch?: number;
  quiet?: boolean;
}

/** A great icicle falling from high above onto a marked spot: a shadow grows, it drops, it shatters. */
export class Icicle implements Effect {
  dead = false;
  private t = 0;
  private ring: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private body: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private size: number;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private s: IcicleSpec,
  ) {
    this.size = s.size ?? 1;
    const k = this.size;
    this.ring = world.add.image(snap(x), snap(y), 'danger_ring').setTint(T_ICE).setDepth(2).setScale((10 * k) / 22, (6 * k) / 12).setAlpha(0);
    this.shadow = world.add.image(snap(x), snap(y), 'shadow').setDepth(1.5).setAlpha(0).setScale(0.3 * k);
    this.body = world.add.image(x, y, 'fz_icicle', 'i').setOrigin(0.5, 1).setPipeline('Lit').setScale(k).setVisible(false);
    this.glow = world.add.image(x, y, 'fz_icicle_e', 'i').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setScale(k).setVisible(false);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const s = this.s;
    const p = Math.min(1, this.t / s.delay);
    this.ring.setAlpha(0.3 + p * 0.5 + Math.sin(this.t * 0.035) * 0.1);
    this.shadow.setAlpha(p * 0.7).setScale((0.3 + p * 0.7) * this.size, this.size);
    // It falls through the last 300 ms, from well above the view's top.
    const fall = Math.max(0, 1 - (s.delay - this.t) / 300);
    if (fall > 0) {
      const lift = (1 - fall * fall) * 220;
      const by = snap(this.y - lift) + 2;
      this.body.setVisible(true).setPosition(snap(this.x), by).setDepth(this.y + 0.5);
      this.glow.setVisible(true).setPosition(snap(this.x), by).setDepth(this.y + 0.6);
    }
    if (this.t >= s.delay) this.shatter();
  }

  private shatter(): void {
    const { world: w, x, y, size: k, s } = this;
    if (w.hurtHeroInEllipse(x, y, 13 * k, 8 * k, { damage: s.damage, fromX: x, fromY: y + 2, knock: 140 })) chill(w, s.chill);
    iceBurst(w, x, y - FZ_ICICLE_H * 0.2 * k, 14);
    if (s.patch) w.addEffect(new FrostPatch(w, x, y, { rx: 14 * k, life: s.patch, chill: [0.75, 900] }));
    if (!s.quiet) sound.shatter(w.pan(x), k > 1.2);
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.ring, this.shadow, this.body, this.glow]) o.destroy();
  }
}

// ---------------------------------------------------------------- Snowball

/** A snowball (or a boulder of packed snow, with `size`) hurled in an arc to a marked spot: it bursts in a puff of snow. */
export function snowball(world: WorldScene, s: Omit<LobSpec, 'texture' | 'frame' | 'lit' | 'tints' | 'ringTint'> & { size?: number; chill?: Chill }): Lob {
  const { chill: c, size, onLand, ...rest } = s;
  return new Lob(world, {
    ...rest,
    scale: size,
    texture: 'fz_snowball',
    frame: 's',
    lit: true,
    tints: SNOW_TINTS,
    ringTint: T_ICE,
    onLand: (x, y) => {
      iceBurst(world, x, y - 3, 8);
      if (c && world.heroPos && Math.hypot((world.heroPos.x - x) / s.rx, (world.heroPos.y - y) / s.ry) <= 1.1) chill(world, c);
      onLand?.(x, y);
    },
  });
}
