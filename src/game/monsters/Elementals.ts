import Phaser from 'phaser';
import { ELEMENT_LIGHT, ELEMENT_TINTS, GALE_TINTS, GOLEM_TINTS, SALAMANDER_TINTS, UNDINE_TINTS } from '../../art/elementals';
import { LANE_W } from '../../art/spirit';
import { snap } from '../display';
import { sound } from '../../audio';
import type { Effect } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';
import type { Element } from '../../world/templeLayout';
import { Monster, type Target } from './Monster';

// The Elementinho Temple's creatures. Blobs of all four elements bounce
// about and pounce; the stone golem is slow and hard to kill, slamming the
// ground and hurling boulders; the undine keeps her distance and looses
// volleys of water; the gale whirls round its prey and blows straight
// through it; the salamander crawls up close and breathes fire.

// ---------------------------------------------------------------- Shared spells

/** Flames left burning on the floor for a while, scorching whoever stands in them. */
export class Blaze implements Effect {
  dead = false;
  private t = 0;
  private tick = 200;
  private sprite: Phaser.GameObjects.Sprite;
  private halo: Phaser.GameObjects.Image;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private life: number,
    private damage: number,
    private scale = 1,
  ) {
    this.sprite = world.add.sprite(snap(x), snap(y) + 2, 'et_blaze', 'b0').setOrigin(0.5, 14 / 16).setBlendMode(Phaser.BlendModes.ADD).setDepth(y).setScale(scale).setAlpha(0);
    this.sprite.play({ key: 'et_blaze_burn', startFrame: Math.floor(Math.random() * 4) });
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff7a1a).setScale(0.9 * scale, 0.55 * scale).setDepth(2.5).setAlpha(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const a = Math.min(1, this.t / 150) * Math.min(1, (this.life - this.t) / 350);
    this.sprite.setAlpha(a);
    this.halo.setAlpha(a * (0.35 + Math.sin(this.t * 0.02) * 0.08));
    this.tick -= dt;
    if (this.tick <= 0 && a > 0.5) {
      this.tick = 450;
      this.world.hurtHeroInEllipse(this.x, this.y, 9 * this.scale, 5 * this.scale, { damage: this.damage, fromX: this.x, fromY: this.y, knock: 30 });
    }
    if (Math.random() < dt / 260) this.world.debris(ELEMENT_TINTS.fire, this.x + (Math.random() - 0.5) * 14 * this.scale, this.y - 4, 1, this.y + 1, 'spores');
    if (this.t >= this.life) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
    this.halo.destroy();
  }
}

export interface LobSpec {
  /** Thrown from (sx, sy) on the ground, `lift` px up, to land at (ex, ey). */
  sx: number;
  sy: number;
  lift: number;
  ex: number;
  ey: number;
  /** ms in the air, and ms before it is thrown. */
  flight: number;
  delay?: number;
  /** Arc height at the top of its flight. */
  arc: number;
  texture: string;
  /** A lit texture (a boulder) rather than pure light (an ember). */
  lit?: boolean;
  /** What it strikes where it lands. */
  rx: number;
  ry: number;
  damage: number;
  knock: number;
  tints: number[];
  ringTint: number;
  /** Spins as it flies. */
  spin?: number;
  onLand?: (x: number, y: number) => void;
}

/**
 * Something hurled in an arc to land on a marked spot: a ring shows where,
 * and a shadow grows under it as it falls.
 */
export class Lob implements Effect {
  dead = false;
  private t = 0;
  private body: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image | null = null;
  private ring: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;

  constructor(
    private world: WorldScene,
    private s: LobSpec,
  ) {
    const add = world.add;
    this.body = add.image(s.sx, s.sy - s.lift, s.texture).setVisible(false);
    if (s.lit) this.body.setPipeline('Lit');
    else {
      this.body.setBlendMode(Phaser.BlendModes.ADD);
      this.halo = add.image(s.sx, s.sy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(s.ringTint).setScale(0.5).setVisible(false);
    }
    this.ring = add.image(snap(s.ex), snap(s.ey), 'danger_ring').setTint(s.ringTint).setDepth(2).setScale(s.rx / 22, s.ry / 12).setAlpha(0);
    this.shadow = add.image(s.ex, s.ey, 'shadow').setDepth(1).setAlpha(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const s = this.s;
    const t = this.t - (s.delay ?? 0);
    // The mark shows from the moment it is thrown (a little before, when held back).
    const shown = Math.min(1, Math.max(0, (t + 200) / (s.flight * 0.6)));
    this.ring.setAlpha(shown * (0.45 + Math.sin(this.t * 0.03) * 0.12)).setScale((s.rx / 22) * (0.7 + shown * 0.3), (s.ry / 12) * (0.7 + shown * 0.3));
    if (t < 0) return;
    const k = Math.min(1, t / s.flight);
    const gx = s.sx + (s.ex - s.sx) * k;
    const gy = s.sy + (s.ey - s.sy) * k;
    const h = s.lift * (1 - k) + Math.sin(k * Math.PI) * s.arc;
    this.body.setVisible(true).setPosition(snap(gx), snap(gy - h)).setDepth(gy + 20);
    if (s.spin) this.body.setRotation(this.t * s.spin * 0.001);
    this.halo?.setVisible(true).setPosition(gx, gy - h).setDepth(gy + 19.9);
    this.shadow.setAlpha(k * 0.7).setScale(0.4 + k * 0.6);
    if (!s.lit && Math.random() < dt / 35) this.world.debris(s.tints, gx, gy - h, 1, gy + 19, 'trail');
    if (k >= 1) this.land();
  }

  private land(): void {
    const s = this.s;
    const w = this.world;
    w.hurtHeroInEllipse(s.ex, s.ey, s.rx, s.ry, { damage: s.damage, fromX: s.ex, fromY: s.ey + 4, knock: s.knock });
    w.debris(s.tints, snap(s.ex), snap(s.ey) - 4, s.lit ? 16 : 12, s.ey + 2);
    if (s.lit) sound.thud(w.pan(s.ex), true);
    else sound.sizzle(w.pan(s.ex));
    s.onLand?.(s.ex, s.ey);
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.body.destroy();
    this.halo?.destroy();
    this.ring.destroy();
    this.shadow.destroy();
  }
}

/** A bolt of water: an orb that flies straight and bursts on the hero. */
export class TideBolt implements Effect {
  dead = false;
  private orb: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private travelled = 0;
  private trail = 0;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private damage = 8,
    private speed = 100,
    private range = 185,
  ) {
    this.orb = world.add.image(x, y, 'et_orb').setBlendMode(Phaser.BlendModes.ADD);
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(ELEMENT_LIGHT.water).setScale(0.5).setAlpha(0.6);
  }

  update(dt: number): void {
    if (this.dead) return;
    const s = (this.speed * dt) / 1000;
    this.x += this.ux * s;
    this.y += this.uy * s;
    this.travelled += s;
    const wob = Math.sin(this.travelled * 0.3) * 1;
    const depth = this.y + 16;
    this.orb.setPosition(snap(this.x), snap(this.y + wob)).setDepth(depth).setScale(0.9 + Math.sin(this.travelled * 0.5) * 0.1);
    this.halo.setPosition(this.x, this.y + wob).setDepth(depth - 0.1);
    this.trail -= dt;
    if (this.trail <= 0) {
      this.trail = 36;
      this.world.debris(UNDINE_TINTS, this.x, this.y, 1, depth - 0.2, 'trail');
    }
    const hit = this.world.hurtHeroAt(this.x, this.y, 5, { damage: this.damage, fromX: this.x - this.ux * 8, fromY: this.y - this.uy * 8, knock: 90 });
    if (hit || this.travelled > this.range || !this.world.monsterBounds.contains(this.x, this.y)) this.burst();
  }

  private burst(): void {
    this.world.debris(UNDINE_TINTS, this.x, this.y, 12, this.y + 16);
    sound.splash(this.world.pan(this.x));
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.orb.destroy();
    this.halo.destroy();
  }
}

/** A marked lane on the floor, the path a charge or a jet of fire will take. */
function laneMark(world: WorldScene, x: number, y: number, ux: number, uy: number, len: number, width: number, tint: number): Phaser.GameObjects.Image {
  return world.add
    .image(x, y, 'et_lane')
    .setOrigin(0, 0.5)
    .setRotation(Math.atan2(uy, ux))
    .setScale(len / LANE_W, width)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(tint)
    .setAlpha(0)
    .setDepth(2.2);
}

/** A slow bob on the air. */
const bob = (phase: number, base: number, amp: number, speed = 0.004) => base + Math.sin(phase * speed) * amp;

// ---------------------------------------------------------------- Blobs

const BLOB_WINDUP = 440;
const BLOB_RECOVER = 600;
const HOP = 520;

const BLOB_STATS: Record<Element, { hp: number; damage: number; speed: number; mass: number; reach: number }> = {
  water: { hp: 30, damage: 8, speed: 46, mass: 0.6, reach: 1 },
  fire: { hp: 26, damage: 7, speed: 48, mass: 0.6, reach: 1 },
  earth: { hp: 46, damage: 10, speed: 36, mass: 1.3, reach: 0.85 },
  air: { hp: 22, damage: 7, speed: 60, mass: 0.4, reach: 1.35 },
};

/**
 * A little jelly elemental. It bounces toward its prey, squashes down, and
 * pounces. Each lands its own way: the water blob splashes, the fire blob
 * leaves a patch of flame, the earth blob thumps the ground round it, and
 * the air blob sails right through and flings its prey away.
 */
export class Blob extends Monster {
  private hopT = Math.random() * HOP;
  private ux = 0;
  private uy = 0;
  private len = 0;
  private leapT = 0;
  private struck = false;
  private readonly k: (typeof BLOB_STATS)[Element];

  constructor(
    world: WorldScene,
    x: number,
    y: number,
    private el: Element,
  ) {
    const k = BLOB_STATS[el];
    super(world, x, y, {
      key: `blob_${el}`,
      hp: k.hp,
      radius: 5,
      bodyY: 5,
      speed: k.speed,
      sight: 112,
      leash: 240,
      mass: k.mass,
      barY: 22,
      debris: ELEMENT_TINTS[el],
    });
    this.k = k;
    this.cooldown = 600 + Math.random() * 600;
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  /** It gets about in bounces: a quick hop, a moment's rest. */
  protected move(dt: number, ux: number, uy: number, speed: number): void {
    this.hopT = (this.hopT + dt) % HOP;
    const k = this.hopT / HOP;
    if (k < 0.6) {
      super.move(dt, ux, uy, speed * 1.6);
      this.hover = Math.sin((k / 0.6) * Math.PI) * 3.5;
    } else {
      this.hover = 0;
      this.face(ux);
      this.play('idle');
    }
  }

  protected stand(dt: number): void {
    this.hover = Math.max(0, this.hover - dt * 0.03);
    super.stand(dt);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.cooldown === 0 && dist < 66 * this.k.reach && this.hover < 1) {
      this.face(target.x - this.x);
      this.enter('windup', BLOB_WINDUP);
      this.play('windup', true);
      sound.gulp(this.world.pan(this.x));
      return;
    }
    const ux = (target.x - this.x) / (dist || 1);
    const uy = (target.y - this.y) / (dist || 1);
    this.move(dt, ux, uy, this.stats.speed);
  }

  protected act(dt: number, target: Target | null, dist: number): void {
    if (this.state === 'windup') {
      this.hover = 0;
      if (target) {
        this.face(target.x - this.x);
        const l = Math.hypot(target.x - this.x, target.y - this.y) || 1;
        this.ux = (target.x - this.x) / l;
        this.uy = (target.y - this.y) / l;
        this.len = Math.min(dist + (this.el === 'air' ? 30 : 8), 88 * this.k.reach);
      }
      if (this.timer <= 0) {
        this.struck = false;
        this.leapT = Math.max(160, (this.len / (175 * this.k.reach)) * 1000);
        this.enter('attack', this.leapT);
        this.pose('leap');
        sound.hop(this.world.pan(this.x));
      }
      return;
    }
    if (this.state === 'attack') {
      const k = 1 - Math.max(0, this.timer) / this.leapT;
      const s = (this.len / this.leapT) * dt;
      this.x += this.ux * s;
      this.y += this.uy * s;
      this.hover = Math.sin(k * Math.PI) * 11;
      if (!this.struck) {
        this.struck = this.world.hurtHeroAt(this.x, this.y - this.bodyY, this.radius + 2, {
          damage: this.k.damage,
          fromX: this.x - this.ux * 10,
          fromY: this.y - this.uy * 10,
          knock: this.el === 'air' ? 200 : 110,
        });
      }
      if (this.timer <= 0) this.land();
      return;
    }
    this.stand(dt);
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private land(): void {
    this.hover = 0;
    const w = this.world;
    const x = this.x;
    const y = this.y;
    w.debris(ELEMENT_TINTS[this.el], snap(x), snap(y) - 3, 8, y + 1);
    if (this.el === 'fire') {
      w.addEffect(new Blaze(w, x, y, 1700, 3, 0.8));
      sound.sizzle(w.pan(x));
    } else if (this.el === 'earth') {
      if (!this.struck) w.hurtHeroInEllipse(x, y, 13, 8, { damage: 6, fromX: x, fromY: y, knock: 90 });
      sound.thud(w.pan(x), false);
    } else if (this.el === 'water') sound.splash(w.pan(x));
    else sound.puff(w.pan(x));
    this.enter('recover', BLOB_RECOVER);
    this.play('idle', true);
    this.cooldown = 1200 + Math.random() * 900;
  }

  protected staggers(): boolean {
    return this.state !== 'attack';
  }
}

// ---------------------------------------------------------------- Golem

const SLAM_WINDUP = 900;
const SLAM_RX = 34;
const SLAM_RY = 20;
const SLAM_DAMAGE = 22;
const HURL_WINDUP = 820;
const HURL_FLIGHT = 900;

/**
 * The Stone Vault's guardian: a slow, hulking golem that takes a beating.
 * Up close it raises both fists and slams the ground round it (the ring on
 * the floor shows how far); from afar it heaves a boulder over its head and
 * hurls it where its prey stands.
 */
export class Golem extends Monster {
  private skill: 'slam' | 'hurl' = 'slam';
  private hurlCd = 1500;
  private mark: Phaser.GameObjects.Image | null = null;
  private rock: Phaser.GameObjects.Image | null = null;
  private aim = { x: 0, y: 0 };
  private stepT = 0;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'golem',
      hp: 240,
      radius: 11,
      bodyY: 16,
      speed: 24,
      sight: 125,
      leash: 280,
      mass: 9,
      barY: 50,
      debris: GOLEM_TINTS,
    });
    this.cooldown = 900;
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.hurlCd = Math.max(0, this.hurlCd - dt);
    super.update(dt, target, daylight);
    if (this.dead) return;
    this.rock?.setPosition(snap(this.x) + (this.facing === 'r' ? 1 : -1), snap(this.y) - 46).setDepth(this.y + 0.5);
  }

  protected move(dt: number, ux: number, uy: number, speed: number): void {
    super.move(dt, ux, uy, speed);
    // Heavy footfalls.
    this.stepT += dt;
    if (this.stepT > 400) {
      this.stepT = 0;
      if (Math.hypot(this.x - this.world.cameras.main.midPoint.x, this.y - this.world.cameras.main.midPoint.y) < 160) this.world.debris(GOLEM_TINTS, this.x + (Math.random() - 0.5) * 12, this.y, 2, this.y + 1, 'spores');
    }
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.cooldown === 0 && dist < SLAM_RX + 4) {
      this.skill = 'slam';
      this.enter('windup', SLAM_WINDUP);
      this.play('windup', true);
      this.mark = this.world.add.image(snap(this.x), snap(this.y), 'danger_ring').setTint(0x9ad84a).setDepth(2).setScale(SLAM_RX / 22, SLAM_RY / 12).setAlpha(0.3);
      sound.swell(this.world.pan(this.x));
      return;
    }
    if (this.hurlCd === 0 && dist > 70 && dist < 165) {
      this.skill = 'hurl';
      this.enter('windup', HURL_WINDUP);
      this.play('windup', true);
      this.rock = this.world.add.image(this.x, this.y - 46, 'et_rock', 'r0').setPipeline('Lit');
      this.world.debris(GOLEM_TINTS, snap(this.x), snap(this.y) - 30, 10, this.y + 1, 'spores');
      return;
    }
    const ux = (target.x - this.x) / (dist || 1);
    const uy = (target.y - this.y) / (dist || 1);
    this.move(dt, ux, uy, this.stats.speed);
  }

  protected act(dt: number, target: Target | null): void {
    if (this.state === 'windup') {
      const t = 1 - this.timer / (this.skill === 'slam' ? SLAM_WINDUP : HURL_WINDUP);
      if (this.skill === 'slam') {
        this.mark?.setPosition(snap(this.x), snap(this.y)).setAlpha(0.3 + t * 0.55);
        if (this.timer <= 0) this.slam();
      } else {
        if (target) {
          this.face(target.x - this.x);
          this.aim.x = target.x;
          this.aim.y = target.y;
        }
        if (this.timer <= 0) this.hurl();
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) {
        this.enter('recover', 800);
        this.play('idle', true);
      }
      return;
    }
    this.stand(dt);
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private slam(): void {
    const w = this.world;
    this.clearMarks();
    this.pose('slam');
    this.enter('attack', 320);
    w.hurtHeroInEllipse(this.x, this.y, SLAM_RX, SLAM_RY, { damage: SLAM_DAMAGE, fromX: this.x, fromY: this.y, knock: 240 });
    w.debris(GOLEM_TINTS, snap(this.x), snap(this.y) - 2, 26, this.y + 2);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      w.debris(GOLEM_TINTS, this.x + Math.cos(a) * SLAM_RX * 0.8, this.y + Math.sin(a) * SLAM_RY * 0.8, 2, this.y + 1, 'spores');
    }
    w.cameras.main.shake(180, 0.003);
    sound.slam(w.pan(this.x));
    this.cooldown = 1700 + Math.random() * 600;
  }

  private hurl(): void {
    const w = this.world;
    this.clearMarks();
    this.pose('slam');
    this.enter('attack', 360);
    w.addEffect(
      new Lob(w, {
        sx: this.x + (this.facing === 'r' ? 6 : -6),
        sy: this.y,
        lift: 44,
        ex: this.aim.x,
        ey: this.aim.y,
        flight: HURL_FLIGHT,
        arc: 36,
        texture: 'et_rock',
        lit: true,
        rx: 14,
        ry: 9,
        damage: 16,
        knock: 160,
        tints: GOLEM_TINTS,
        ringTint: 0x9ad84a,
        spin: 6,
      }),
    );
    sound.whirl(w.pan(this.x));
    this.hurlCd = 3800 + Math.random() * 1500;
    this.cooldown = Math.max(this.cooldown, 900);
  }

  private clearMarks(): void {
    this.mark?.destroy();
    this.mark = null;
    this.rock?.destroy();
    this.rock = null;
  }

  protected staggers(): boolean {
    return false;
  }

  protected onInterrupted(): void {
    this.clearMarks();
  }
}

// ---------------------------------------------------------------- Undine

const UNDINE_WINDUP = 760;
const UNDINE_NEAR = 60;
const UNDINE_FAR = 112;

/**
 * The undine of the Hall of Tides: a water maiden who rises from her own
 * spout. She glides out of reach, gathers an orb of water in her hands, and
 * looses three bolts one after another at her prey.
 */
export class Undine extends Monster {
  private phase = Math.random() * 1000;
  private strafe = Math.random() < 0.5 ? 1 : -1;
  private shots = 0;
  private shotT = 0;
  private halo: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'undine',
      hp: 56,
      radius: 6,
      bodyY: 12,
      speed: 38,
      sight: 150,
      leash: 270,
      mass: 0.9,
      barY: 44,
      debris: UNDINE_TINTS,
    });
    this.hover = 4;
    this.cooldown = 1000;
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    this.hover = bob(this.phase, 4, 1.2);
    this.fade = 0.94;
    super.update(dt, target, daylight);
  }

  /** The orb between her hands, in the world. */
  private get hand(): { x: number; y: number } {
    return { x: this.x + (this.facing === 'r' ? 12 : -12), y: this.y - this.hover - 32 };
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    const dx = (target.x - this.x) / (dist || 1);
    const dy = (target.y - this.y) / (dist || 1);
    if (dist > UNDINE_FAR) this.move(dt, dx, dy, this.stats.speed);
    else if (dist < UNDINE_NEAR) this.move(dt, -dx * 0.8 - dy * 0.6 * this.strafe, -dy * 0.8 + dx * 0.6 * this.strafe, this.stats.speed * 1.2);
    else if (this.cooldown === 0) {
      this.enter('windup', UNDINE_WINDUP);
      this.play('windup', true);
      this.halo = this.world.add.image(this.x, this.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(ELEMENT_LIGHT.water).setAlpha(0);
      sound.gulp(this.world.pan(this.x));
    } else {
      if (Math.random() < dt / 1600) this.strafe = -this.strafe;
      this.move(dt, -dy * this.strafe, dx * this.strafe, this.stats.speed * 0.6);
      this.face(target.x - this.x);
    }
  }

  protected act(dt: number, target: Target | null): void {
    const m = this.hand;
    if (this.state === 'windup') {
      if (target) this.face(target.x - this.x);
      const t = 1 - this.timer / UNDINE_WINDUP;
      this.halo?.setPosition(snap(m.x), snap(m.y)).setDepth(snap(this.y) + 0.3).setScale(0.3 + t * 0.35).setAlpha(0.2 + t * 0.5);
      if (Math.random() < dt / 60) this.world.debris(UNDINE_TINTS, m.x + (Math.random() - 0.5) * 16, m.y + (Math.random() - 0.5) * 14, 1, this.y + 1, 'gather');
      if (this.timer <= 0) {
        this.shots = 3;
        this.shotT = 0;
        this.enter('attack', 99999);
      }
      return;
    }
    if (this.state === 'attack') {
      this.shotT -= dt;
      if (this.shotT <= 0 && this.shots > 0) {
        this.shotT = 170;
        this.shots--;
        const tx = target?.x ?? m.x + (this.facing === 'r' ? 50 : -50);
        const ty = (target?.y ?? this.y) - 11;
        if (target) this.face(target.x - this.x);
        const a = Math.atan2(ty - m.y, tx - m.x) + (this.shots - 1) * 0.12;
        this.world.addEffect(new TideBolt(this.world, m.x, m.y, Math.cos(a), Math.sin(a)));
        this.world.debris(UNDINE_TINTS, m.x, m.y, 4, this.y + 1);
        sound.spit(this.world.pan(m.x));
      }
      if (this.shots === 0 && this.shotT <= 0) {
        this.onInterrupted();
        this.enter('recover', 700);
        this.play('idle', true);
        this.cooldown = 2400 + Math.random() * 900;
        this.strafe = Math.random() < 0.5 ? 1 : -1;
      }
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  protected staggers(): boolean {
    return true;
  }

  protected onInterrupted(): void {
    this.halo?.destroy();
    this.halo = null;
    this.shots = 0;
  }
}

// ---------------------------------------------------------------- Gale

const GALE_WINDUP = 520;
const GALE_SPEED = 250;
const GALE_DAMAGE = 9;

/**
 * A living whirlwind of the Gale Gallery. It circles its prey, fast and
 * restless, then pulls itself tight (its path shows on the floor) and blows
 * straight through, flinging whoever stands there away.
 */
export class Gale extends Monster {
  private phase = Math.random() * 1000;
  private spin = Math.random() < 0.5 ? 1 : -1;
  private ux = 0;
  private uy = 0;
  private len = 0;
  private struck = false;
  private lane: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'gale',
      hp: 44,
      radius: 6,
      bodyY: 12,
      speed: 64,
      sight: 130,
      leash: 260,
      mass: 0.7,
      barY: 40,
      debris: GALE_TINTS,
    });
    this.hover = 2;
    this.cooldown = 900;
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    this.hover = bob(this.phase, 2.5, 1, 0.006);
    this.fade = 0.9;
    super.update(dt, target, daylight);
    if (this.dead) return;
    // Grit whirling round it.
    if (this.state !== 'spawn' && this.state !== 'dying' && Math.random() < dt / 240) {
      const a = Math.random() * Math.PI * 2;
      this.world.debris(GALE_TINTS, this.x + Math.cos(a) * 12, this.y - 4 - Math.random() * 18, 1, this.y + 1, 'trail');
    }
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.cooldown === 0 && dist < 92) {
      this.face(target.x - this.x);
      this.enter('windup', GALE_WINDUP);
      this.play('windup', true);
      this.lane = laneMark(this.world, this.x, this.y, 1, 0, 10, 1.4, ELEMENT_LIGHT.air);
      sound.whirl(this.world.pan(this.x));
      return;
    }
    // Circle round the target, drifting in toward about 52 px.
    const rx = (target.x - this.x) / (dist || 1);
    const ry = (target.y - this.y) / (dist || 1);
    const pull = Phaser.Math.Clamp((dist - 52) / 24, -1, 1);
    const ux = rx * pull - ry * this.spin * 0.85;
    const uy = ry * pull + rx * this.spin * 0.85;
    const l = Math.hypot(ux, uy) || 1;
    this.move(dt, ux / l, uy / l, this.stats.speed);
    this.face(target.x - this.x);
    if (Math.random() < dt / 3000) this.spin = -this.spin;
  }

  protected act(dt: number, target: Target | null, dist: number): void {
    if (this.state === 'windup') {
      const t = 1 - this.timer / GALE_WINDUP;
      // It aims until the last moment, then commits.
      if (target && t < 0.7) {
        this.face(target.x - this.x);
        const l = Math.hypot(target.x - this.x, target.y - this.y) || 1;
        this.ux = (target.x - this.x) / l;
        this.uy = (target.y - this.y) / l;
        this.len = Math.min(dist, 110) + 46;
      }
      this.lane?.setPosition(this.x, this.y).setRotation(Math.atan2(this.uy, this.ux)).setScale(this.len / LANE_W, 1.4).setAlpha(0.25 + t * 0.5);
      if (this.timer <= 0) {
        this.struck = false;
        this.enter('attack', (this.len / GALE_SPEED) * 1000);
        this.pose('dash');
      }
      return;
    }
    if (this.state === 'attack') {
      const s = (GALE_SPEED * dt) / 1000;
      this.x += this.ux * s;
      this.y += this.uy * s;
      this.lane?.setAlpha(Math.max(0, this.timer / ((this.len / GALE_SPEED) * 1000)) * 0.6);
      if (Math.random() < dt / 25) this.world.debris(GALE_TINTS, this.x, this.y - this.bodyY, 1, this.y - 1, 'trail');
      if (!this.struck) this.struck = this.world.hurtHeroAt(this.x, this.y - this.bodyY, this.radius + 3, { damage: GALE_DAMAGE, fromX: this.x - this.ux * 14, fromY: this.y - this.uy * 14, knock: 280 });
      if (this.timer <= 0) {
        this.clearLane();
        this.enter('recover', 650);
        this.play('idle', true);
        this.cooldown = 1800 + Math.random() * 900;
      }
      return;
    }
    this.stand(dt);
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

// ---------------------------------------------------------------- Salamander

const BREATH_WINDUP = 680;
const BREATH_TIME = 520;
const BREATH_LEN = 54;
const BREATH_DAMAGE = 13;

/**
 * A salamander of the Ember Forge: a basalt lizard with lava in its belly.
 * It crawls up close, draws a breath (the path of its fire shows on the
 * floor) and breathes a jet of flame, leaving the ground burning at the end.
 */
export class Salamander extends Monster {
  private ux = 1;
  private uy = 0;
  private lane: Phaser.GameObjects.Image | null = null;
  private jet: Phaser.GameObjects.Image | null = null;
  private struck = false;
  private puff = 0;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'salamander',
      hp: 78,
      radius: 7,
      bodyY: 7,
      speed: 40,
      sight: 125,
      leash: 260,
      mass: 1.6,
      barY: 28,
      debris: SALAMANDER_TINTS,
    });
    this.cooldown = 800;
  }

  /** Where its fire comes from: its jaws, on the ground. */
  private get mouth(): { x: number; y: number } {
    return { x: this.x + (this.facing === 'r' ? 15 : -15), y: this.y - 1 };
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.cooldown === 0 && dist < BREATH_LEN - 4) {
      const l = Math.hypot(target.x - this.x, target.y - this.y) || 1;
      this.ux = (target.x - this.x) / l;
      this.uy = (target.y - this.y) / l;
      // It can only breathe the way it faces.
      if ((this.facing === 'r') !== this.ux >= 0) this.ux = -this.ux;
      this.enter('windup', BREATH_WINDUP);
      this.play('windup', true);
      const m = this.mouth;
      this.lane = laneMark(this.world, m.x, m.y, this.ux, this.uy, BREATH_LEN, 2.2, 0xff7a1a);
      sound.swell(this.world.pan(this.x));
      return;
    }
    const ux = (target.x - this.x) / (dist || 1);
    const uy = (target.y - this.y) / (dist || 1);
    // Keep a little off to the side, so it can breathe along its prey.
    this.move(dt, ux, uy * 0.9, this.stats.speed);
  }

  protected act(dt: number): void {
    const m = this.mouth;
    if (this.state === 'windup') {
      const t = 1 - this.timer / BREATH_WINDUP;
      this.lane?.setPosition(m.x, m.y).setAlpha(0.2 + t * 0.55);
      if (Math.random() < dt / 70) this.world.debris(SALAMANDER_TINTS, m.x, m.y - 6, 1, this.y + 1, 'gather');
      if (this.timer <= 0) {
        this.pose('blow');
        this.struck = false;
        this.enter('attack', BREATH_TIME);
        this.jet = this.world.add
          .image(m.x, m.y - 5, 'et_lane')
          .setOrigin(0, 0.5)
          .setRotation(Math.atan2(this.uy, this.ux))
          .setScale(BREATH_LEN / LANE_W, 1.8)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xffa030)
          .setDepth(this.y + 12);
        sound.ignite();
      }
      return;
    }
    if (this.state === 'attack') {
      const k = 1 - this.timer / BREATH_TIME;
      this.lane?.setAlpha(0.6 * (1 - k));
      this.jet?.setAlpha(0.7 + Math.sin(k * 40) * 0.2).setScale((BREATH_LEN / LANE_W) * Math.min(1, k * 4), 1.8 + Math.sin(k * 30) * 0.3);
      this.puff -= dt;
      if (this.puff <= 0) {
        this.puff = 30;
        const d = 6 + Math.random() * BREATH_LEN * Math.min(1, k * 4);
        this.world.debris(SALAMANDER_TINTS, m.x + this.ux * d, m.y - 5 + this.uy * d + (Math.random() - 0.5) * 6, 2, m.y + this.uy * d + 12, 'burst');
      }
      if (!this.struck && k > 0.15) {
        for (const [d, rx, ry] of [[12, 7, 5], [28, 9, 6], [44, 11, 7]] as const) {
          if (this.world.hurtHeroInEllipse(m.x + this.ux * d, m.y + this.uy * d, rx, ry, { damage: BREATH_DAMAGE, fromX: m.x, fromY: m.y, knock: 140 })) {
            this.struck = true;
            break;
          }
        }
      }
      if (this.timer <= 0) {
        this.world.addEffect(new Blaze(this.world, m.x + this.ux * (BREATH_LEN - 12), m.y + this.uy * (BREATH_LEN - 12), 1500, 3, 0.9));
        this.clear();
        this.enter('recover', 700);
        this.play('idle', true);
        this.cooldown = 1900 + Math.random() * 900;
      }
      return;
    }
    this.stand(dt);
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private clear(): void {
    this.lane?.destroy();
    this.lane = null;
    this.jet?.destroy();
    this.jet = null;
  }

  protected staggers(): boolean {
    return this.state !== 'attack';
  }

  protected onInterrupted(): void {
    this.clear();
  }
}
