import Phaser from 'phaser';
import { GEODE_TINTS, GLIMBAT_TINTS, MYCONID_TINTS, SHARD_TINTS, SPIKE_H, SPIKE_OY, SPORELING_TINTS, SPORE_TINTS } from '../../art/deepMonsters';
import { LANE_W } from '../../art/spirit';
import { snap } from '../display';
import { sound } from '../../audio';
import type { Effect } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';
import { Lob } from './Elementals';
import { Monster, type Target } from './Monster';

/** The deep's two living lights, as tints. */
export const CYAN = 0x5ae4ff;
export const MAGENTA = 0xff6ad8;

// The Glimmerdeep's creatures. Sporelings waddle up and puff out a cloud of
// spores; glimbats wheel overhead and dive along a glowing line; myconids
// keep their distance and lob spore bombs; shardlings scuttle in and snip;
// the geodeback, a crystal-shelled beast, charges down a marked lane and
// sets the floor bristling with amethyst where it stops.

// ---------------------------------------------------------------- Shared spells

/**
 * Spores left hanging in the air for a while, a soft glowing haze that
 * stings whoever stands in it.
 */
export class SporeCloud implements Effect {
  dead = false;
  private t = 0;
  private tick = 300;
  private haze: Phaser.GameObjects.Image;
  private core: Phaser.GameObjects.Image;
  private phase = Math.random() * 1000;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private life: number,
    private rx: number,
    private damage: number,
    tint = MAGENTA,
  ) {
    const ry = rx * 0.6;
    this.haze = world.add.image(snap(x), snap(y) - 3, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(rx / 13, ry / 11).setDepth(y + 14).setAlpha(0);
    this.core = world.add.image(snap(x), snap(y) - 5, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd8f6).setScale(rx / 28, ry / 22).setDepth(y + 14.1).setAlpha(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    this.phase += dt;
    const a = Math.min(1, this.t / 220) * Math.min(1, (this.life - this.t) / 500);
    const breathe = 1 + Math.sin(this.phase * 0.004) * 0.08;
    const ry = this.rx * 0.6;
    this.haze.setAlpha(a * 0.42).setScale((this.rx / 13) * breathe, (ry / 11) * breathe);
    this.core.setAlpha(a * (0.28 + Math.sin(this.phase * 0.009) * 0.06));
    if (Math.random() < dt / 90) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      this.world.debris(SPORE_TINTS, this.x + Math.cos(ang) * this.rx * r, this.y + Math.sin(ang) * ry * r - 2, 1, this.y + 13, 'spores');
    }
    this.tick -= dt;
    if (this.tick <= 0 && a > 0.5) {
      this.tick = 500;
      this.world.hurtHeroInEllipse(this.x, this.y, this.rx, ry, { damage: this.damage, fromX: this.x, fromY: this.y, knock: 0 });
    }
    if (this.t >= this.life) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.haze.destroy();
    this.core.destroy();
  }
}

export interface PuffSpec {
  /** ms before it starts to grow, and ms it takes to swell fit to burst. */
  delay: number;
  grow: number;
  damage: number;
  /** How far its burst reaches. */
  rx: number;
  ry: number;
  /** Leaves a spore cloud this long (0 for none), stinging this much. */
  cloud: number;
  cloudDamage: number;
}

/**
 * A puffball swelling out of the floor on a marked spot. It glows brighter as
 * it fills, then bursts in a ring of spores.
 */
export class Puffball implements Effect {
  dead = false;
  private t = 0;
  private body: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private halo: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private s: PuffSpec,
  ) {
    const rx = snap(x);
    const ry = snap(y);
    this.ring = world.add.image(rx, ry, 'danger_ring').setTint(0xff6ad8).setDepth(2).setScale(s.rx / 22, s.ry / 12).setAlpha(0);
    this.body = world.add.sprite(rx, ry + 1, 'gd_puff', 'p0').setOrigin(0.5, 13 / 14).setPipeline('Lit').setDepth(y).setVisible(false);
    this.glow = world.add.sprite(rx, ry + 1, 'gd_puff_e', 'p0').setOrigin(0.5, 13 / 14).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).setVisible(false);
    this.halo = world.add.image(rx, ry - 4, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(MAGENTA).setDepth(y + 0.2).setScale(0.3).setAlpha(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const s = this.s;
    const shown = Math.min(1, Math.max(0, (this.t + 150) / (s.delay + s.grow * 0.5)));
    this.ring.setAlpha(shown * (0.45 + Math.sin(this.t * 0.03) * 0.12));
    const g = this.t - s.delay;
    if (g < 0) return;
    const k = Math.min(1, g / s.grow);
    const f = `p${Math.min(3, Math.floor(k * 4))}`;
    // It trembles as it nears bursting.
    const shake = k > 0.75 ? Math.round(Math.sin(this.t * 0.09)) : 0;
    this.body.setVisible(true).setFrame(f).setX(snap(this.x) + shake);
    this.glow.setVisible(true).setFrame(f).setX(snap(this.x) + shake).setAlpha(0.5 + k * 0.5);
    this.halo.setAlpha(0.15 + k * 0.4).setScale(0.25 + k * 0.35);
    if (k >= 1) this.burst();
  }

  private burst(): void {
    const { world: w, x, y, s } = this;
    w.hurtHeroInEllipse(x, y, s.rx, s.ry, { damage: s.damage, fromX: x, fromY: y + 3, knock: 110 });
    w.debris(SPORE_TINTS, snap(x), snap(y) - 5, 14, y + 12);
    w.debris(SPORE_TINTS, snap(x), snap(y) - 4, 6, y + 12, 'spores');
    if (s.cloud > 0) w.addEffect(new SporeCloud(w, x, y, s.cloud, s.rx * 0.9, s.cloudDamage));
    sound.puff(w.pan(x));
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.body, this.glow, this.halo, this.ring]) o.destroy();
  }
}

/**
 * Amethyst bursting up out of the floor on a marked spot: it strikes as it
 * erupts, stands glittering a moment, then sinks back and is gone.
 */
export class CrystalSpike implements Effect {
  dead = false;
  private t = 0;
  private up = false;
  private ring: Phaser.GameObjects.Image;
  private fill: Phaser.GameObjects.Image;
  private body: Phaser.GameObjects.Image | null = null;
  private glow: Phaser.GameObjects.Image | null = null;
  private flash: Phaser.GameObjects.Image | null = null;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    /** ms the mark shows before it erupts. */
    private delay: number,
    private damage: number,
    private stand = 1400,
    private size = 1,
  ) {
    const rx = snap(x);
    const ry = snap(y);
    this.ring = world.add.image(rx, ry, 'danger_ring').setTint(0xb37aff).setDepth(2).setScale((11 * size) / 22, (7 * size) / 12).setAlpha(0);
    this.fill = world.add.image(rx, ry, 'danger_ring').setTint(0xe0c8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(2).setScale(0).setAlpha(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const size = this.size;
    if (!this.up) {
      const k = Math.min(1, this.t / this.delay);
      this.ring.setAlpha(0.35 + k * 0.45 + Math.sin(this.t * 0.04) * 0.1);
      this.fill.setScale(((11 * size) / 22) * k, ((7 * size) / 12) * k).setAlpha(0.2 + k * 0.3);
      if (this.t >= this.delay) this.erupt();
      return;
    }
    const a = this.t - this.delay;
    // Shoots up past its height and settles; later sinks back into the floor.
    const pop = a < 90 ? a / 90 : a < 170 ? 1.12 - ((a - 90) / 80) * 0.12 : 1;
    const sink = Math.max(0, (a - this.stand) / 300);
    const h = Math.max(0, pop - sink);
    this.body?.setScale(size, size * h).setAlpha(Math.min(1, 1.4 - sink));
    this.glow?.setScale(size, size * h).setAlpha(Math.min(1, 1.2 - sink));
    this.flash?.setAlpha(Math.max(0, 0.9 - a / 240)).setScale((1.1 + a / 200) * size);
    if (sink >= 1) this.destroy();
  }

  private erupt(): void {
    this.up = true;
    const { world: w, x, y, size } = this;
    this.ring.setVisible(false);
    this.fill.setVisible(false);
    const v = `k${Math.floor(Math.random() * 3)}`;
    const oy = SPIKE_OY / SPIKE_H;
    const flip = Math.random() < 0.5;
    this.body = w.add.image(snap(x), snap(y) + 1, 'gd_spike', v).setOrigin(0.5, oy).setPipeline('Lit').setDepth(y).setFlipX(flip).setScale(size, 0);
    this.glow = w.add.image(snap(x), snap(y) + 1, 'gd_spike_e', v).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).setFlipX(flip).setScale(size, 0);
    this.flash = w.add.image(snap(x), snap(y) - 6, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xd8b8ff).setDepth(y + 0.2);
    w.hurtHeroInEllipse(x, y, 11 * size, 7 * size, { damage: this.damage, fromX: x, fromY: y + 2, knock: 150 });
    w.debris(SHARD_TINTS, snap(x), snap(y) - 4, 7, y + 2);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.ring, this.fill, this.body, this.glow, this.flash]) o?.destroy();
  }
}

/** A marked lane on the floor, the path a dive or a charge will take. */
export function laneMark(world: WorldScene, x: number, y: number, width: number, tint: number): Phaser.GameObjects.Image {
  return world.add.image(x, y, 'gd_lane').setOrigin(0, 0.5).setScale(10 / LANE_W, width).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(0).setDepth(2.2);
}

/** How far the floor runs clear from (x, y) along (ux, uy), up to `max`. */
export function clearRun(world: WorldScene, x: number, y: number, ux: number, uy: number, max: number): number {
  let len = 0;
  while (len < max && world.walkable(x + ux * (len + 5), y + uy * (len + 5))) len += 5;
  return len;
}

// ---------------------------------------------------------------- Sporeling

const PUFF_WINDUP = 650;
const PUFF_RX = 20;
const PUFF_RY = 12;

/**
 * A little blue puffball on legs. It waddles up to its prey, swells until it
 * is round as a ball (a ring on the floor shows how far), and puffs out a
 * burst of spores that hangs in the air a moment after.
 */
export class Sporeling extends Monster {
  private mark: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'sporeling',
      hp: 24,
      radius: 5,
      bodyY: 7,
      speed: 44,
      sight: 110,
      leash: 240,
      mass: 0.6,
      barY: 24,
      debris: SPORELING_TINTS,
    });
    this.cooldown = 500 + Math.random() * 700;
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.cooldown === 0 && dist < PUFF_RX - 2) {
      this.face(target.x - this.x);
      this.enter('windup', PUFF_WINDUP);
      this.play('windup', true);
      this.mark = this.world.add.image(snap(this.x), snap(this.y), 'danger_ring').setTint(0x5ae4ff).setDepth(2).setScale(PUFF_RX / 22, PUFF_RY / 12).setAlpha(0.3);
      sound.swell(this.world.pan(this.x));
      return;
    }
    this.move(dt, (target.x - this.x) / (dist || 1), (target.y - this.y) / (dist || 1), this.stats.speed);
  }

  protected act(dt: number): void {
    if (this.state === 'windup') {
      const t = 1 - this.timer / PUFF_WINDUP;
      this.mark?.setPosition(snap(this.x), snap(this.y)).setAlpha(0.3 + t * 0.55);
      if (this.timer <= 0) {
        const w = this.world;
        this.clear();
        this.pose('burst');
        this.enter('attack', 260);
        w.hurtHeroInEllipse(this.x, this.y, PUFF_RX, PUFF_RY, { damage: 9, fromX: this.x, fromY: this.y, knock: 120 });
        w.debris(SPORE_TINTS, snap(this.x), snap(this.y) - 6, 14, this.y + 2);
        w.addEffect(new SporeCloud(w, this.x, this.y, 1500, 16, 2, CYAN));
        sound.puff(w.pan(this.x));
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) {
        this.enter('recover', 800);
        this.play('idle', true);
        this.cooldown = 1800 + Math.random() * 900;
      }
      return;
    }
    this.stand(dt);
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private clear(): void {
    this.mark?.destroy();
    this.mark = null;
  }

  protected onInterrupted(): void {
    this.clear();
  }
}

// ---------------------------------------------------------------- Glimbat

const BAT_HOVER = 13;
const DIVE_WINDUP = 520;
const DIVE_SPEED = 240;

/**
 * A bat of the deep with glowing cyan wings. It wheels round its prey high
 * up, then hangs still a heartbeat (its dive shows as a line of light on the
 * floor) and swoops down along it.
 */
export class Glimbat extends Monster {
  private phase = Math.random() * 1000;
  private spin = Math.random() < 0.5 ? 1 : -1;
  private ux = 1;
  private uy = 0;
  private len = 0;
  private dive = 0;
  private struck = false;
  private lane: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'glimbat',
      hp: 22,
      radius: 5,
      bodyY: 10,
      speed: 62,
      sight: 130,
      leash: 260,
      mass: 0.4,
      barY: 38,
      debris: GLIMBAT_TINTS,
    });
    this.hover = BAT_HOVER;
    this.cooldown = 900 + Math.random() * 600;
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    const flying = BAT_HOVER + Math.sin(this.phase * 0.006) * 2;
    // Down it comes for the dive, and back up after.
    const goal = this.state === 'attack' ? 4 : flying;
    this.hover += (goal - this.hover) * Math.min(1, dt / (this.state === 'attack' ? 60 : 220));
    super.update(dt, target, daylight);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.cooldown === 0 && dist < 96) {
      this.face(target.x - this.x);
      this.enter('windup', DIVE_WINDUP);
      this.play('windup', true);
      this.lane = laneMark(this.world, this.x, this.y, 1.3, CYAN);
      sound.chitter(this.world.pan(this.x));
      return;
    }
    const rx = (target.x - this.x) / (dist || 1);
    const ry = (target.y - this.y) / (dist || 1);
    const pull = Phaser.Math.Clamp((dist - 60) / 26, -1, 1);
    const ux = rx * pull - ry * this.spin * 0.9;
    const uy = ry * pull + rx * this.spin * 0.9;
    const l = Math.hypot(ux, uy) || 1;
    this.move(dt, ux / l, uy / l, this.stats.speed);
    this.face(target.x - this.x);
    if (Math.random() < dt / 2600) this.spin = -this.spin;
  }

  protected act(dt: number, target: Target | null, dist: number): void {
    if (this.state === 'windup') {
      const t = 1 - this.timer / DIVE_WINDUP;
      if (target && t < 0.7) {
        this.face(target.x - this.x);
        const l = Math.hypot(target.x - this.x, target.y - this.y) || 1;
        this.ux = (target.x - this.x) / l;
        this.uy = (target.y - this.y) / l;
        this.len = Math.max(20, clearRun(this.world, this.x, this.y, this.ux, this.uy, Math.min(dist, 104) + 40));
      }
      this.lane?.setPosition(this.x, this.y).setRotation(Math.atan2(this.uy, this.ux)).setScale(this.len / LANE_W, 1.3).setAlpha(0.2 + t * 0.55);
      if (this.timer <= 0) {
        this.struck = false;
        this.dive = (this.len / DIVE_SPEED) * 1000;
        this.enter('attack', this.dive);
        this.pose('dive');
        sound.whirl(this.world.pan(this.x));
      }
      return;
    }
    if (this.state === 'attack') {
      const s = (DIVE_SPEED * dt) / 1000;
      this.x += this.ux * s;
      this.y += this.uy * s;
      this.lane?.setAlpha(Math.max(0, this.timer / this.dive) * 0.6);
      if (Math.random() < dt / 30) this.world.debris(GLIMBAT_TINTS, this.x, this.y - this.bodyY, 1, this.y - 1, 'trail');
      if (!this.struck) this.struck = this.world.hurtHeroAt(this.x, this.y - 8, this.radius + 3, { damage: 8, fromX: this.x - this.ux * 12, fromY: this.y - this.uy * 12, knock: 170 });
      if (this.timer <= 0) {
        this.clearLane();
        this.enter('recover', 600);
        this.play('idle', true);
        this.cooldown = 1700 + Math.random() * 900;
        this.spin = Math.random() < 0.5 ? 1 : -1;
      }
      return;
    }
    this.play('idle');
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private clearLane(): void {
    this.lane?.destroy();
    this.lane = null;
  }

  protected staggers(): boolean {
    return this.state !== 'attack';
  }

  protected onInterrupted(): void {
    this.clearLane();
  }
}

// ---------------------------------------------------------------- Myconid

const MYCO_WINDUP = 820;
const MYCO_NEAR = 64;
const MYCO_FAR = 124;

/**
 * A tall mushroom-folk with a pink glowing cap. It keeps its distance, lifts
 * a ripe spore bomb over its head and lobs it where its prey stands; the
 * bomb bursts into a lingering cloud.
 */
export class Myconid extends Monster {
  private strafe = Math.random() < 0.5 ? 1 : -1;
  private aim = { x: 0, y: 0 };
  private bomb: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'myconid',
      hp: 62,
      radius: 7,
      bodyY: 14,
      speed: 32,
      sight: 150,
      leash: 270,
      mass: 1.2,
      barY: 46,
      debris: MYCONID_TINTS,
    });
    this.cooldown = 900;
  }

  /** The bomb held up over its cap. */
  private get hand(): { x: number; y: number } {
    return { x: this.x + (this.facing === 'r' ? 5 : -5), y: this.y - 40 };
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    super.update(dt, target, daylight);
    if (this.dead || !this.bomb) return;
    const h = this.hand;
    this.bomb.setPosition(snap(h.x), snap(h.y)).setDepth(this.y + 0.5);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    const dx = (target.x - this.x) / (dist || 1);
    const dy = (target.y - this.y) / (dist || 1);
    if (dist > MYCO_FAR) this.move(dt, dx, dy, this.stats.speed);
    else if (dist < MYCO_NEAR) this.move(dt, -dx * 0.8 - dy * 0.6 * this.strafe, -dy * 0.8 + dx * 0.6 * this.strafe, this.stats.speed * 1.15);
    else if (this.cooldown === 0) {
      this.enter('windup', MYCO_WINDUP);
      this.play('windup', true);
      const h = this.hand;
      this.bomb = this.world.add.image(h.x, h.y, 'gd_puff', 'p3').setBlendMode(Phaser.BlendModes.ADD).setScale(0.3);
      sound.gulp(this.world.pan(this.x));
    } else {
      if (Math.random() < dt / 1800) this.strafe = -this.strafe;
      this.move(dt, -dy * this.strafe, dx * this.strafe, this.stats.speed * 0.55);
    }
    this.face(target.x - this.x);
  }

  protected act(dt: number, target: Target | null): void {
    if (this.state === 'windup') {
      const t = 1 - this.timer / MYCO_WINDUP;
      this.bomb?.setScale(0.3 + t * 0.7);
      if (target) {
        this.face(target.x - this.x);
        this.aim.x = target.x;
        this.aim.y = target.y;
      }
      if (Math.random() < dt / 70) {
        const h = this.hand;
        this.world.debris(MYCONID_TINTS, h.x + (Math.random() - 0.5) * 14, h.y + (Math.random() - 0.5) * 12, 1, this.y + 1, 'gather');
      }
      if (this.timer <= 0) this.lob();
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) {
        this.enter('recover', 700);
        this.play('idle', true);
      }
      return;
    }
    this.stand(dt);
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private lob(): void {
    const w = this.world;
    const h = this.hand;
    this.clear();
    this.pose('throw');
    this.enter('attack', 380);
    w.addEffect(
      new Lob(w, {
        sx: h.x,
        sy: this.y,
        lift: this.y - h.y,
        ex: this.aim.x,
        ey: this.aim.y,
        flight: 820,
        arc: 40,
        texture: 'gd_puff',
        frame: 'p3',
        rx: 15,
        ry: 9,
        damage: 11,
        knock: 100,
        tints: SPORE_TINTS,
        ringTint: 0xff6ad8,
        spin: 4,
        onLand: (x, y) => w.addEffect(new SporeCloud(w, x, y, 2300, 17, 3)),
      }),
    );
    sound.toss(w.pan(this.x));
    this.cooldown = 2600 + Math.random() * 900;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
  }

  private clear(): void {
    this.bomb?.destroy();
    this.bomb = null;
  }

  protected onInterrupted(): void {
    this.clear();
  }
}

// ---------------------------------------------------------------- Shardling

const SNIP_WINDUP = 380;
const SNIP_TIME = 160;
const SNIP_REACH = 34;

/**
 * A crab of the crystal galleries with an amethyst shell. It scuttles in
 * fast and low, raises its claws, and lunges with a snip.
 */
export class Shardling extends Monster {
  private ux = 1;
  private uy = 0;
  private struck = false;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'shardling',
      hp: 50,
      radius: 7,
      bodyY: 6,
      speed: 58,
      sight: 120,
      leash: 250,
      mass: 1.4,
      barY: 24,
      debris: SHARD_TINTS,
    });
    this.cooldown = 600 + Math.random() * 600;
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.cooldown === 0 && dist < SNIP_REACH) {
      this.face(target.x - this.x);
      const l = dist || 1;
      this.ux = (target.x - this.x) / l;
      this.uy = (target.y - this.y) / l;
      this.enter('windup', SNIP_WINDUP);
      this.play('windup', true);
      sound.clack(this.world.pan(this.x));
      return;
    }
    // Crabs come in sideways, in quick scuttles.
    const ux = (target.x - this.x) / (dist || 1);
    const uy = (target.y - this.y) / (dist || 1);
    this.move(dt, ux, uy, this.stats.speed * (0.75 + Math.abs(Math.sin(this.world.time.now * 0.012)) * 0.5));
  }

  protected act(dt: number, target: Target | null): void {
    if (this.state === 'windup') {
      if (target && this.timer > SNIP_WINDUP * 0.35) {
        const l = Math.hypot(target.x - this.x, target.y - this.y) || 1;
        this.ux = (target.x - this.x) / l;
        this.uy = (target.y - this.y) / l;
        this.face(this.ux);
      }
      if (this.timer <= 0) {
        this.struck = false;
        this.pose('snip');
        this.enter('attack', SNIP_TIME);
      }
      return;
    }
    if (this.state === 'attack') {
      const s = (170 * dt) / 1000;
      this.x += this.ux * s;
      this.y += this.uy * s;
      if (!this.struck) {
        const cx = this.x + this.ux * 9;
        const cy = this.y + this.uy * 5;
        this.struck = this.world.hurtHeroInEllipse(cx, cy, 10, 7, { damage: 11, fromX: this.x, fromY: this.y, knock: 150 });
        if (this.struck) this.world.debris(SHARD_TINTS, cx, cy - 4, 5, cy + 2);
      }
      if (this.timer <= 0) {
        sound.clack(this.world.pan(this.x), true);
        this.enter('recover', 560);
        this.play('idle', true);
        this.cooldown = 1300 + Math.random() * 800;
      }
      return;
    }
    this.stand(dt);
    if (this.timer <= 0) this.enter('chase', 0);
  }
}

// ---------------------------------------------------------------- Geodeback

const CHARGE_WINDUP = 950;
const CHARGE_SPEED = 215;
const QUAKE_WINDUP = 800;
const QUAKE_RX = 30;
const QUAKE_RY = 18;

/**
 * A great crystal-backed beast, slow and hard to kill, its shell an open
 * geode. From afar it lowers its head, pawing (its path glows on the floor),
 * and charges; wherever the charge stops, amethyst bursts from the floor
 * round it. Up close it rears and stamps, and the crystals come up at once.
 */
export class Geodeback extends Monster {
  private skill: 'charge' | 'quake' = 'charge';
  private ux = 1;
  private uy = 0;
  private len = 0;
  private gone = 0;
  private struck = false;
  private lane: Phaser.GameObjects.Image | null = null;
  private mark: Phaser.GameObjects.Image | null = null;
  private stepT = 0;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'geodeback',
      hp: 250,
      radius: 12,
      bodyY: 14,
      speed: 24,
      sight: 135,
      leash: 300,
      mass: 9,
      barY: 46,
      debris: GEODE_TINTS,
    });
    this.cooldown = 1000;
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  protected move(dt: number, ux: number, uy: number, speed: number): void {
    super.move(dt, ux, uy, speed);
    this.stepT += dt;
    if (this.stepT > 450) {
      this.stepT = 0;
      const cam = this.world.cameras.main.midPoint;
      if (Math.hypot(this.x - cam.x, this.y - cam.y) < 160) this.world.debris(GEODE_TINTS, this.x + (Math.random() - 0.5) * 16, this.y, 2, this.y + 1, 'spores');
    }
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.cooldown === 0 && dist < QUAKE_RX + 6) {
      this.skill = 'quake';
      this.enter('windup', QUAKE_WINDUP);
      this.play('windup', true);
      this.mark = this.world.add.image(snap(this.x), snap(this.y), 'danger_ring').setTint(0xb37aff).setDepth(2).setScale(QUAKE_RX / 22, QUAKE_RY / 12).setAlpha(0.3);
      sound.swell(this.world.pan(this.x));
      return;
    }
    if (this.cooldown === 0 && dist < 150) {
      this.skill = 'charge';
      this.enter('windup', CHARGE_WINDUP);
      this.play('windup', true);
      this.lane = laneMark(this.world, this.x, this.y, 2.6, 0xb37aff);
      sound.swell(this.world.pan(this.x));
      return;
    }
    this.move(dt, (target.x - this.x) / (dist || 1), (target.y - this.y) / (dist || 1), this.stats.speed);
  }

  protected act(dt: number, target: Target | null, dist: number): void {
    if (this.state === 'windup') {
      if (this.skill === 'quake') {
        const t = 1 - this.timer / QUAKE_WINDUP;
        this.mark?.setPosition(snap(this.x), snap(this.y)).setAlpha(0.3 + t * 0.55);
        if (this.timer <= 0) this.quake();
        return;
      }
      const t = 1 - this.timer / CHARGE_WINDUP;
      if (target && t < 0.7) {
        this.face(target.x - this.x);
        const l = Math.hypot(target.x - this.x, target.y - this.y) || 1;
        this.ux = (target.x - this.x) / l;
        this.uy = (target.y - this.y) / l;
        this.len = Math.max(24, clearRun(this.world, this.x, this.y, this.ux, this.uy, Math.min(dist, 150) + 36));
      }
      this.lane?.setPosition(this.x, this.y).setRotation(Math.atan2(this.uy, this.ux)).setScale(this.len / LANE_W, 2.6).setAlpha(0.2 + t * 0.55);
      if (Math.random() < dt / 90) this.world.debris(GEODE_TINTS, this.x - this.ux * 14, this.y, 1, this.y + 1, 'spores');
      if (this.timer <= 0) {
        this.gone = 0;
        this.struck = false;
        this.enter('attack', 99999);
        this.play('charge', true);
        sound.forcePush(this.world.pan(this.x));
      }
      return;
    }
    if (this.state === 'attack') {
      const s = Math.min((CHARGE_SPEED * dt) / 1000, this.len - this.gone);
      this.x += this.ux * s;
      this.y += this.uy * s;
      this.gone += s;
      this.lane?.setAlpha(0.6 * (1 - this.gone / this.len));
      if (!this.struck) this.struck = this.world.hurtHeroInEllipse(this.x + this.ux * 10, this.y, 14, 9, { damage: 20, fromX: this.x - this.ux * 20, fromY: this.y - this.uy * 20, knock: 260 });
      if (Math.random() < dt / 40) this.world.debris(GEODE_TINTS, this.x - this.ux * 12, this.y, 1, this.y + 1, 'spores');
      if (this.gone >= this.len - 0.5) {
        this.clear();
        this.spikeRing(0);
        this.world.cameras.main.shake(140, 0.002);
        sound.thud(this.world.pan(this.x), true);
        this.rest();
      }
      return;
    }
    this.stand(dt);
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private quake(): void {
    const w = this.world;
    this.clear();
    w.hurtHeroInEllipse(this.x, this.y, QUAKE_RX, QUAKE_RY, { damage: 16, fromX: this.x, fromY: this.y, knock: 200 });
    w.debris(GEODE_TINTS, snap(this.x), snap(this.y) - 2, 18, this.y + 2);
    this.spikeRing(0);
    w.cameras.main.shake(160, 0.0025);
    sound.slam(w.pan(this.x));
    this.rest();
  }

  /** Crystals burst from the floor in a ring round it, `delay` ms after their marks show. */
  private spikeRing(delay: number): void {
    const w = this.world;
    const n = 7;
    const a0 = Math.random() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * Math.PI * 2;
      const x = this.x + Math.cos(a) * 30;
      const y = this.y + Math.sin(a) * 19;
      if (w.walkable(x, y)) w.addEffect(new CrystalSpike(w, x, y, 380 + delay + k * 30, 10, 1100, 0.8));
    }
  }

  private rest(): void {
    this.enter('recover', 900);
    this.play('idle', true);
    this.cooldown = 1900 + Math.random() * 900;
  }

  private clear(): void {
    this.lane?.destroy();
    this.lane = null;
    this.mark?.destroy();
    this.mark = null;
  }

  protected staggers(): boolean {
    return false;
  }

  protected onInterrupted(): void {
    this.clear();
  }
}
