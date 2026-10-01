import Phaser from 'phaser';
import type { WorldScene } from '../../scenes/WorldScene';
import { Monster, type Target } from './Monster';
import { mobHit, mobHp } from '../tiers';
import { snap } from '../display';
import { sound } from '../../audio';
import type { Effect } from '../Slash';
import { Lob } from './Elementals';
import { clearRun } from './Deep';
import { CHILL_DEEP, CHILL_LIGHT, FrostRing, IceShard, IceSpike, chill, dangerMark, frostLane, iceBurst, layLane } from './frostFx';
import { ICE_TINTS, SNOW_TINTS, T_ICE } from '../../art/frostKit';
import { DRAKE_TINTS, FS_CONE_W, KNIGHT_TINTS, MAMMOTH_TINTS, TROLL_TINTS, YETI_TINTS } from '../../art/frostStrong';

// The Aurora Colosseum's strong creatures, each with a way of fighting of
// its own:
//   - The Frost Troll brings its club down in a line of bursting ice, and,
//     left alone for a few seconds, crouches to knit its wounds shut with
//     frost (strike it to break the knitting).
//   - The Tuskmaw rears and stomps (a fan of ice bursts ahead), sweeps its
//     tusks, and now and then lowers its head and charges down a lane; a
//     charge that ends in a wall leaves it dazed.
//   - The Frostdrake flies low and keeps its distance, sweeping a cone of
//     frost breath across the floor, then swoops through to a new spot,
//     raking with its talons as it passes.
//   - The Yeti rips a boulder of packed snow out of the floor and heaves it
//     (it shatters into darts of ice), or leaps and comes down fists first in
//     a ring of frost.
//   - The Rimeknight dashes in three quick cuts, each along a lane, then
//     drives its greatsword into the floor to send a blade of frost rolling
//     out, and stands a moment pulling it free.
// Their pictures are in art/frostStrong.ts.

/** Which way it faces, as a sign. */
const sideOf = (m: { facing: 'r' | 'l' }) => (m.facing === 'r' ? 1 : -1);

/** A unit vector from (x, y) toward (tx, ty). */
const toward = (x: number, y: number, tx: number, ty: number): [number, number] => {
  const l = Math.hypot(tx - x, ty - y) || 1;
  return [(tx - x) / l, (ty - y) / l];
};

// ---------------------------------------------------------------- Shared effects

interface FlareSpec {
  /** A texture, its first frame, and an animation to play on it (optional). */
  key: string;
  frame?: string;
  anim?: string;
  life: number;
  rot?: number;
  scale?: [number, number];
  /** Drift in px/s. */
  vx?: number;
  vy?: number;
  tint?: number;
  alpha?: number;
  depth: number;
  flipY?: boolean;
}

/** A flash of light that drifts, grows and fades: a slash's crescent, a billow of breath. */
class Flare implements Effect {
  dead = false;
  private t = 0;
  private img: Phaser.GameObjects.Sprite;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private s: FlareSpec,
  ) {
    this.img = world.add
      .sprite(snap(x), snap(y), s.key, s.frame)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setRotation(s.rot ?? 0)
      .setTint(s.tint ?? 0xffffff)
      .setDepth(s.depth)
      .setFlipY(!!s.flipY);
    if (s.anim) this.img.play(s.anim);
    this.update(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const s = this.s;
    const p = Math.min(1, this.t / s.life);
    this.x += ((s.vx ?? 0) * dt) / 1000;
    this.y += ((s.vy ?? 0) * dt) / 1000;
    const [a, b] = s.scale ?? [1, 1];
    this.img
      .setPosition(snap(this.x), snap(this.y))
      .setScale(a + (b - a) * p)
      .setAlpha((s.alpha ?? 1) * (1 - p * p));
    if (p >= 1) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
  }
}

interface WaveSpec {
  speed: number;
  range: number;
  damage: number;
  chill?: [number, number];
}

/** The Rimeknight's blade of frost: a crescent of light rolling along the floor, striking once. */
class BladeWave implements Effect {
  dead = false;
  private img: Phaser.GameObjects.Sprite;
  private halo: Phaser.GameObjects.Image;
  private gone = 0;
  private trail = 0;
  private struck = false;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private s: WaveSpec,
  ) {
    this.img = world.add.sprite(x, y, 'fs_wave', 'w0').setBlendMode(Phaser.BlendModes.ADD).setRotation(Math.atan2(uy, ux)).setTint(0xd8f6ff).play('fs_wave_run');
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(T_ICE).setScale(0.9, 0.6).setAlpha(0.45);
    this.update(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    const d = (this.s.speed * dt) / 1000;
    this.x += this.ux * d;
    this.y += this.uy * d;
    this.gone += d;
    const fade = Math.min(1, (this.s.range - this.gone) / 30);
    // It stands a little off the floor, so it reads over the ground.
    this.img.setPosition(snap(this.x), snap(this.y - 6)).setDepth(this.y + 8).setAlpha(fade).setScale(0.8 + Math.min(1, this.gone / 40) * 0.25);
    this.halo.setPosition(this.x, this.y - 4).setDepth(this.y + 7.9).setAlpha(0.45 * fade);
    const w = this.world;
    this.trail -= dt;
    if (this.trail <= 0) {
      this.trail = 30;
      w.debris(ICE_TINTS, this.x - this.ux * 6, this.y - 2, 1, this.y + 1, 'trail');
    }
    if (!this.struck && w.hurtHeroAt(this.x, this.y - 9, 12, { damage: this.s.damage, fromX: this.x - this.ux * 10, fromY: this.y - this.uy * 10, knock: 200 })) {
      this.struck = true;
      chill(w, this.s.chill);
      iceBurst(w, this.x, this.y - 8, 8);
    }
    if (this.gone >= this.s.range || !w.monsterBounds.contains(this.x, this.y) || !w.walkable(this.x, this.y)) {
      iceBurst(w, this.x, this.y - 4, 6);
      this.destroy();
    }
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
    this.halo.destroy();
  }
}

// ---------------------------------------------------------------- Frost Troll

const TROLL_SLAM_RANGE = 50;
const TROLL_SLAM_WINDUP = 820;
const TROLL_SLAM_LEN = 112;
/** The crack's spikes: how many, how far apart, and when each goes off after the blow. */
const TROLL_SPIKES = 5;
const TROLL_SPIKE_GAP = 18;
const TROLL_SPIKE_DELAY = 200;
const TROLL_SPIKE_STEP = 90;
/** Not struck for this long and hurt, it crouches to knit its wounds. */
const TROLL_KNIT_DELAY = 3500;
const TROLL_KNIT_TIME = 2600;
/** Share of its full health mended a second while knitting. */
const TROLL_KNIT_RATE = 0.07;
const TROLL_KNIT_REST = 5000;

/**
 * A hulking blue troll with a club knotted with ice. It slams the club down
 * ahead and the floor cracks open in a line of bursting ice; and when no one
 * has struck it for a few seconds it crouches and frost knits its wounds
 * shut (glowing seams, ice gathering), healing fast until it's struck again.
 */
export class FrostTroll extends Monster {
  private skill: 'slam' | 'knit' | 'roar' = 'slam';
  private ux = 1;
  private uy = 0;
  private len = TROLL_SLAM_LEN;
  private lane: Phaser.GameObjects.Image | null = null;
  private mark: Phaser.GameObjects.Image | null = null;
  private aura: Phaser.GameObjects.Image | null = null;
  private knitFrom = 0;
  private knitAt = -Infinity;
  private mended = 0;
  private stepT = 0;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'frost_troll', hp: mobHp('frost_troll'), radius: 11, bodyY: 18, speed: 30, sight: 140, leash: 300, mass: 8, barY: 52, debris: TROLL_TINTS });
    this.cooldown = 900;
  }

  protected move(dt: number, ux: number, uy: number, speed: number): void {
    super.move(dt, ux, uy, speed);
    // Heavy feet: a puff of snow with each step.
    this.stepT += dt;
    if (this.stepT > 500) {
      this.stepT = 0;
      this.world.debris(SNOW_TINTS, this.x + (Math.random() - 0.5) * 10, this.y, 2, this.y + 1, 'spores');
    }
  }

  private get canKnit(): boolean {
    const now = this.world.time.now;
    return this.hp < this.maxHp * 0.9 && now - this.lastHitAt > TROLL_KNIT_DELAY && now - this.knitAt > TROLL_KNIT_REST;
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.cooldown === 0 && dist < TROLL_SLAM_RANGE * this.size) return this.startSlam(target);
    if (this.canKnit) return this.startKnit();
    this.move(dt, (target.x - this.x) / (dist || 1), (target.y - this.y) / (dist || 1), this.stats.speed);
  }

  private startSlam(target: Target): void {
    this.skill = 'slam';
    [this.ux, this.uy] = toward(this.x, this.y, target.x, target.y);
    this.enter('windup', TROLL_SLAM_WINDUP);
    this.play('windup', true);
    this.lane = frostLane(this.world, this.x, this.y, 1.5);
    this.mark = dangerMark(this.world, this.x, this.y, 16, 10);
    sound.roar(this.world.pan(this.x));
  }

  private startKnit(): void {
    this.skill = 'knit';
    this.knitFrom = this.world.time.now;
    this.mended = 0;
    this.enter('windup', TROLL_KNIT_TIME);
    this.play('knit', true);
    this.aura = this.world.add.image(this.x, this.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(T_ICE).setAlpha(0);
    sound.frost('freeze', this.world.pan(this.x));
  }

  protected act(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup' && this.skill === 'knit') {
      // Struck: the knitting breaks, and it roars.
      if (this.lastHitAt > this.knitFrom) {
        this.endKnit();
        this.skill = 'roar';
        this.enter('recover', 520);
        this.play('roar', true);
        iceBurst(w, this.x, this.y - 22, 8);
        sound.roar(w.pan(this.x), true);
        return;
      }
      const t = TROLL_KNIT_TIME - this.timer;
      const heal = Math.min(this.maxHp - this.hp, (this.maxHp * TROLL_KNIT_RATE * dt) / 1000);
      this.hp += heal;
      this.mended += heal;
      this.aura?.setPosition(this.x, this.y - 20).setDepth(this.y + 0.3).setScale(1.3 + Math.sin(t * 0.008) * 0.12, 1.5).setAlpha(Math.min(0.42, t / 600) * (0.8 + Math.sin(t * 0.012) * 0.2));
      if (Math.random() < dt / 70) w.debris(ICE_TINTS, this.x + (Math.random() - 0.5) * 34, this.y - 8 - Math.random() * 34, 1, this.y + 1, 'gather');
      // The mending shows in pale numbers now and then.
      if (this.mended >= this.maxHp * 0.05) {
        w.popNumber(snap(this.x), snap(this.y) - this.stats.barY - 3, `+${Math.round(this.mended)}`, 0x9ae8ff);
        this.mended = 0;
      }
      if (this.timer <= 0 || this.hp >= this.maxHp) {
        this.endKnit();
        this.enter('recover', 300);
        this.play('idle');
      }
      return;
    }
    if (this.state === 'windup') {
      const t = 1 - this.timer / TROLL_SLAM_WINDUP;
      if (target && t < 0.7) {
        this.face(target.x - this.x);
        [this.ux, this.uy] = toward(this.x, this.y, target.x, target.y);
        this.len = Math.max(30, clearRun(w, this.x, this.y, this.ux, this.uy, TROLL_SLAM_LEN * this.size));
      }
      if (this.lane) layLane(this.lane, this.x, this.y, this.ux, this.uy, this.len, 1.5, 0.18 + t * 0.5);
      const k = 22 * this.size;
      this.mark?.setPosition(snap(this.x + this.ux * k), snap(this.y + this.uy * k * 0.7)).setAlpha(0.3 + t * 0.5);
      if (this.timer <= 0) this.slam();
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) {
        this.enter('recover', 900);
        this.play('idle');
      }
      return;
    }
    this.stand(dt);
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** The club comes down: the blow where it lands, then the crack running on, bursting. */
  private slam(): void {
    const w = this.world;
    this.clearSlam();
    this.enter('attack', 420);
    this.play('attack', true);
    const k = 22 * this.size;
    const ix = this.x + this.ux * k;
    const iy = this.y + this.uy * k * 0.7;
    if (w.hurtHeroInEllipse(ix, iy, 17 * this.size, 10 * this.size, { damage: mobHit('frost_troll', 1.1), fromX: this.x, fromY: this.y - 10, knock: 230 })) chill(w, CHILL_LIGHT);
    iceBurst(w, ix, iy - 3, 14);
    w.debris(SNOW_TINTS, snap(ix), snap(iy) - 2, 10, iy + 2, 'spores');
    w.cameras.main.shake(170, 0.0026);
    sound.slam(w.pan(this.x));
    for (let i = 0; i < TROLL_SPIKES; i++) {
      const d = 32 * this.size + i * TROLL_SPIKE_GAP;
      if (d > this.len) break;
      w.addEffect(
        new IceSpike(w, this.x + this.ux * d, this.y + this.uy * d, {
          delay: TROLL_SPIKE_DELAY + i * TROLL_SPIKE_STEP,
          damage: mobHit('frost_troll', 0.65),
          size: 0.85 + i * 0.07,
          chill: CHILL_LIGHT,
          quiet: i % 2 === 1,
        }),
      );
    }
    this.cooldown = 2300 + Math.random() * 700;
  }

  private clearSlam(): void {
    this.lane?.destroy();
    this.mark?.destroy();
    this.lane = this.mark = null;
  }

  private endKnit(): void {
    this.knitAt = this.world.time.now;
    this.aura?.destroy();
    this.aura = null;
  }

  protected onInterrupted(): void {
    this.clearSlam();
    if (this.aura) this.endKnit();
  }
}

// ---------------------------------------------------------------- Tuskmaw

const TUSK_STOMP_RANGE = 62;
const TUSK_STOMP_WINDUP = 980;
const TUSK_SWEEP_WINDUP = 520;
/** The sweep's reach ahead of its feet, and its size. */
const TUSK_SWEEP_AHEAD = 26;
const TUSK_SWEEP_RX = 30;
const TUSK_SWEEP_RY = 17;
const TUSK_CHARGE_MIN = 80;
const TUSK_CHARGE_MAX = 200;
const TUSK_CHARGE_WINDUP = 1150;
const TUSK_CHARGE_SPEED = 235;
const TUSK_CHARGE_REST = 6500;
const TUSK_DAZE = 1700;

/**
 * A woolly mammoth. Close in, it rears and trumpets, comes down in a stomp
 * that bursts a fan of ice ahead of it, then swings its tusks in a sweep.
 * From further off, now and then, it lowers its head, paws, and charges down
 * a lane; if the lane ends in a wall it crashes and stands dazed.
 */
export class Tuskmaw extends Monster {
  private skill: 'stomp' | 'sweep' | 'charge' = 'stomp';
  private ux = 1;
  private uy = 0;
  private len = 0;
  private want = 0;
  private gone = 0;
  private struck = false;
  private chargeAt = -Infinity;
  private dazed = false;
  private raised = false;
  private lane: Phaser.GameObjects.Image | null = null;
  private mark: Phaser.GameObjects.Image | null = null;
  /** The stomp's spikes, still waiting on their marks while it rears. */
  private spikes: IceSpike[] = [];
  private stepT = 0;
  private trail = 0;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'tuskmaw', hp: mobHp('tuskmaw'), radius: 16, bodyY: 18, speed: 26, sight: 150, leash: 320, mass: 14, barY: 52, debris: MAMMOTH_TINTS });
    this.cooldown = 1200;
    this.chargeAt = -TUSK_CHARGE_REST * 0.6;
  }

  get pinned(): boolean {
    return this.state === 'attack' && this.skill === 'charge';
  }

  /** A charge can't be knocked aside; a rear can't be broken by a single heavy blow either. */
  protected staggers(): boolean {
    return this.state !== 'attack' && !(this.state === 'windup' && this.skill === 'stomp');
  }

  protected move(dt: number, ux: number, uy: number, speed: number): void {
    super.move(dt, ux, uy, speed);
    this.stepT += dt;
    if (this.stepT > 600) {
      this.stepT = 0;
      this.world.debris(SNOW_TINTS, this.x + (Math.random() - 0.5) * 22, this.y, 2, this.y + 1, 'spores');
    }
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    const now = this.world.time.now;
    if (this.cooldown === 0 && dist < TUSK_STOMP_RANGE * this.size) return this.startStomp(target);
    if (this.cooldown === 0 && dist > TUSK_CHARGE_MIN && dist < TUSK_CHARGE_MAX && now - this.chargeAt > TUSK_CHARGE_REST) return this.startCharge(target);
    this.move(dt, (target.x - this.x) / (dist || 1), (target.y - this.y) / (dist || 1), this.stats.speed);
  }

  private startStomp(target: Target): void {
    const w = this.world;
    this.skill = 'stomp';
    this.face(target.x - this.x);
    this.enter('windup', TUSK_STOMP_WINDUP);
    this.play('rear', true);
    sound.roar(w.pan(this.x), true);
    // A fan of ice ahead of it, marked now, bursting as its feet come down: a near row, then a far one.
    const [ux, uy] = toward(this.x, this.y, target.x, target.y);
    const a0 = Math.atan2(uy, ux);
    const rows: [number, number, number][] = [
      [30, 5, 0.55],
      [52, 4, 0.36],
    ];
    rows.forEach(([r, n, spread], row) => {
      for (let i = 0; i < n; i++) {
        const a = a0 + (n > 1 ? (i / (n - 1) - 0.5) * 2 * spread : 0);
        const x = this.x + Math.cos(a) * r * this.size;
        const y = this.y + Math.sin(a) * r * 0.7 * this.size;
        if (!w.walkable(x, y)) continue;
        const s = new IceSpike(w, x, y, { delay: TUSK_STOMP_WINDUP + 40 + row * 130, damage: mobHit('tuskmaw', 0.7), size: 0.9 + row * 0.15, chill: CHILL_DEEP, quiet: i > 0 });
        this.spikes.push(s);
        w.addEffect(s);
      }
    });
  }

  private startCharge(target: Target): void {
    this.skill = 'charge';
    this.chargeAt = this.world.time.now;
    [this.ux, this.uy] = toward(this.x, this.y, target.x, target.y);
    this.enter('windup', TUSK_CHARGE_WINDUP);
    this.play('lower', true);
    this.lane = frostLane(this.world, this.x, this.y, 2.8);
    sound.swell(this.world.pan(this.x));
  }

  protected act(dt: number, target: Target | null, dist: number): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (this.skill === 'stomp') {
        if (this.timer <= 0) this.stomp();
        return;
      }
      if (this.skill === 'sweep') {
        const t = 1 - this.timer / TUSK_SWEEP_WINDUP;
        this.mark?.setPosition(snap(this.x + sideOf(this) * TUSK_SWEEP_AHEAD * this.size), snap(this.y)).setAlpha(0.3 + t * 0.55);
        // After the stomp lands, the head swings up and back to sweep.
        if (t > 0.35 && !this.raised) {
          this.raised = true;
          this.pose('sweepA');
        }
        if (this.timer <= 0) this.sweep();
        return;
      }
      // The charge: it lowers its head and paws while the lane settles on the hero.
      const t = 1 - this.timer / TUSK_CHARGE_WINDUP;
      if (target && t < 0.75) {
        [this.ux, this.uy] = toward(this.x, this.y, target.x, target.y);
        this.face(this.ux);
        this.want = Math.min(dist, TUSK_CHARGE_MAX) + 50;
        this.len = Math.max(24, clearRun(w, this.x, this.y, this.ux, this.uy, this.want));
      }
      if (this.lane) layLane(this.lane, this.x, this.y, this.ux, this.uy, this.len, 2.8, 0.18 + t * 0.55);
      if (Math.random() < dt / 80) w.debris(SNOW_TINTS, this.x - this.ux * 16, this.y, 1, this.y + 1, 'spores');
      if (this.timer <= 0) {
        this.gone = 0;
        this.struck = false;
        this.enter('attack', 99999);
        this.play('charge', true);
        sound.roar(w.pan(this.x), true);
      }
      return;
    }
    if (this.state === 'attack' && this.skill === 'charge') {
      const s = Math.min((TUSK_CHARGE_SPEED * dt) / 1000, this.len - this.gone);
      this.x += this.ux * s;
      this.y += this.uy * s;
      this.gone += s;
      if (this.lane) layLane(this.lane, this.x, this.y, this.ux, this.uy, Math.max(0, this.len - this.gone), 2.8, 0.55);
      if (!this.struck) {
        this.struck = w.hurtHeroInEllipse(this.x + this.ux * 20 * this.size, this.y + this.uy * 8, 17 * this.size, 10 * this.size, { damage: mobHit('tuskmaw', 1.3), fromX: this.x - this.ux * 20, fromY: this.y - this.uy * 20, knock: 330 });
        if (this.struck) w.cameras.main.shake(120, 0.0016);
      }
      this.trail -= dt;
      if (this.trail <= 0) {
        this.trail = 45;
        w.debris(SNOW_TINTS, this.x - this.ux * 14, this.y, 2, this.y + 1, 'spores');
      }
      if (this.gone >= this.len - 0.5) this.endCharge();
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) this.enter('recover', 1100);
      return;
    }
    // Recovering: the sweep's follow-through, a skid, or a daze.
    if (this.dazed && Math.random() < dt / 160) w.debris(ICE_TINTS, this.x + (Math.random() - 0.5) * 16, this.y - 40, 1, this.y + 2, 'trail');
    if (this.timer <= 0) {
      this.dazed = false;
      this.enter('chase', 0);
    } else if (!this.dazed && this.timer < 800) this.stand(dt);
  }

  /** Down come the forefeet: the floor shakes, the fan of ice bursts, and the tusks come round. */
  private stomp(): void {
    const w = this.world;
    this.spikes = [];
    this.play('stomp', true);
    const fx = this.x + sideOf(this) * 20 * this.size;
    if (w.hurtHeroInEllipse(fx, this.y, 18 * this.size, 10 * this.size, { damage: mobHit('tuskmaw', 1), fromX: this.x, fromY: this.y - 10, knock: 220 })) chill(w, CHILL_LIGHT);
    w.debris(SNOW_TINTS, snap(fx), snap(this.y) - 2, 16, this.y + 2, 'spores');
    iceBurst(w, fx, this.y - 2, 8);
    w.cameras.main.shake(220, 0.003);
    sound.slam(w.pan(this.x));
    this.skill = 'sweep';
    this.raised = false;
    this.enter('windup', TUSK_SWEEP_WINDUP);
    this.mark = dangerMark(w, fx, this.y, TUSK_SWEEP_RX * this.size, TUSK_SWEEP_RY * this.size);
  }

  private sweep(): void {
    const w = this.world;
    const side = sideOf(this);
    const ax = this.x + side * TUSK_SWEEP_AHEAD * this.size;
    this.mark?.destroy();
    this.mark = null;
    this.play('sweep', true);
    w.hurtHeroInEllipse(ax, this.y, TUSK_SWEEP_RX * this.size, TUSK_SWEEP_RY * this.size, { damage: mobHit('tuskmaw', 0.9), fromX: this.x, fromY: this.y - 10, knock: 290 });
    w.addEffect(new Flare(w, ax - side * 4, this.y - 14, { key: 'fs_slash', frame: 's0', anim: 'fs_slash_fade', life: 200, rot: side > 0 ? 0.5 : Math.PI - 0.5, scale: [1, 1.15], tint: 0xe8f6ff, alpha: 0.9, depth: this.y + 20, flipY: side < 0 }));
    w.debris(SNOW_TINTS, snap(ax), snap(this.y) - 6, 8, this.y + 2, 'spores');
    sound.rake(w.pan(this.x), true);
    this.enter('attack', 260);
    this.cooldown = 2700 + Math.random() * 600;
  }

  private endCharge(): void {
    const w = this.world;
    this.lane?.destroy();
    this.lane = null;
    // Cut short by a wall: it crashes into it and stands dazed.
    if (this.len < this.want - 8) {
      this.dazed = true;
      this.enter('recover', TUSK_DAZE);
      this.play('daze', true);
      iceBurst(w, this.x + this.ux * 26, this.y - 14, 14);
      w.cameras.main.shake(260, 0.0035);
      sound.thud(w.pan(this.x), true);
    } else {
      this.enter('recover', 1000);
      this.play('idle');
      w.debris(SNOW_TINTS, snap(this.x + this.ux * 12), snap(this.y), 10, this.y + 2, 'spores');
      sound.thud(w.pan(this.x));
    }
    this.cooldown = 1400;
  }

  protected onInterrupted(): void {
    this.lane?.destroy();
    this.mark?.destroy();
    this.lane = this.mark = null;
    for (const s of this.spikes) s.destroy();
    this.spikes = [];
  }
}

// ---------------------------------------------------------------- Frostdrake

/** How high it flies, and how much it bobs. */
const DRAKE_HOVER = 13;
const DRAKE_BOB = 2.5;
/** The range it likes to keep, and how near it lets the hero come before it swoops away. */
const DRAKE_KEEP = 85;
const DRAKE_TOO_NEAR = 48;
const DRAKE_INHALE = 880;
const DRAKE_BREATH = 1350;
const DRAKE_BREATH_RANGE = 96;
/** The breath's own half-width, and how far it sweeps either side of its aim (radians). */
const DRAKE_BREATH_HALF = 0.26;
const DRAKE_BREATH_SWEEP = 0.46;
const DRAKE_BREATH_TICK = 220;
const DRAKE_SWOOP_WINDUP = 560;
const DRAKE_SWOOP_SPEED = 245;
const DRAKE_SWOOP_REST = 4200;

/**
 * A young ice wyvern, flying low. It keeps its distance, circling, and
 * breathes frost: it rears its head back, chest glowing, while a cone shows
 * where it will pour, then sweeps the breath across the floor. When the hero
 * crowds it, or after a breath, it swoops: a lane shows its path, and it
 * dives through, raking with its talons, to come up somewhere new.
 */
export class Frostdrake extends Monster {
  private skill: 'breath' | 'swoop' = 'breath';
  private aim = 0;
  private sweepDir = 1;
  private tick = 0;
  private puffT = 0;
  private soundT = 0;
  private orbit = Math.random() < 0.5 ? 1 : -1;
  private bobT = Math.random() * 6000;
  private dip = 0;
  private ux = 1;
  private uy = 0;
  private len = 0;
  private gone = 0;
  private struck = false;
  private swoopAt = -Infinity;
  private swoopNext = false;
  private cone: Phaser.GameObjects.Image | null = null;
  private lane: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'frostdrake', hp: mobHp('frostdrake'), radius: 10, bodyY: 14, speed: 50, sight: 175, leash: 340, mass: 4, barY: 62, debris: DRAKE_TINTS });
    this.cooldown = 1400;
    this.hover = DRAKE_HOVER;
  }

  get pinned(): boolean {
    return this.state === 'attack' && this.skill === 'swoop';
  }

  update(dt: number, target: Target | null, daylight: number): void {
    // Aloft: a slow bob, dipping low as it swoops.
    this.bobT += dt;
    this.hover = (DRAKE_HOVER + Math.sin(this.bobT * 0.004) * DRAKE_BOB) * this.size - this.dip;
    if (this.state === 'dying') this.hover *= 0.6;
    super.update(dt, target, daylight);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    const now = this.world.time.now;
    const [ux, uy] = toward(this.x, this.y, target.x, target.y);
    if ((this.swoopNext || dist < DRAKE_TOO_NEAR) && now - this.swoopAt > DRAKE_SWOOP_REST) return this.startSwoop(target);
    if (this.cooldown === 0 && dist < DRAKE_BREATH_RANGE + 20 && dist > 36) return this.startBreath(target);
    // Hold its range, drifting round the hero.
    if (Math.random() < dt / 4000) this.orbit = -this.orbit;
    const k = dist > DRAKE_KEEP + 15 ? 1 : dist < DRAKE_KEEP - 15 ? -0.8 : 0;
    let mx = ux * k - uy * this.orbit * 0.7;
    let my = uy * k + ux * this.orbit * 0.7;
    const l = Math.hypot(mx, my) || 1;
    mx /= l;
    my /= l;
    if (!this.world.walkable(this.x + mx * 12, this.y + my * 12)) this.orbit = -this.orbit;
    this.move(dt, mx, my, this.stats.speed * (k ? 1 : 0.6));
    this.face(target.x - this.x);
  }

  private startBreath(target: Target): void {
    this.skill = 'breath';
    this.aim = Math.atan2(target.y - this.y, target.x - this.x);
    this.sweepDir = Math.random() < 0.5 ? 1 : -1;
    this.enter('windup', DRAKE_INHALE);
    this.play('inhale', true);
    this.cone = this.world.add.image(this.x, this.y, 'fs_cone').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setTint(T_ICE).setDepth(2.2).setAlpha(0);
    sound.frost('freeze', this.world.pan(this.x));
  }

  /** Lay the cone from its feet along `a`, as wide as `half` either side. */
  private layCone(a: number, half: number, alpha: number): void {
    const r = DRAKE_BREATH_RANGE * this.size;
    this.cone?.setPosition(this.x, this.y).setRotation(a).setScale(r / FS_CONE_W, (r * Math.tan(half)) / (FS_CONE_W / 2)).setAlpha(alpha);
  }

  private startSwoop(target: Target): void {
    const w = this.world;
    this.skill = 'swoop';
    this.swoopNext = false;
    this.swoopAt = w.time.now;
    this.enter('windup', DRAKE_SWOOP_WINDUP);
    this.play('swoop', true);
    this.aimSwoop(target);
    this.lane = frostLane(w, this.x, this.y, 1.4);
    sound.wings(w.pan(this.x), 2);
  }

  /** Through the hero and out the far side, as far as the arena allows. */
  private aimSwoop(target: Target): void {
    [this.ux, this.uy] = toward(this.x, this.y, target.x, target.y);
    const d = Math.hypot(target.x - this.x, target.y - this.y);
    this.len = Math.max(30, clearRun(this.world, this.x, this.y, this.ux, this.uy, d + 70));
  }

  protected act(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup' && this.skill === 'breath') {
      const t = 1 - this.timer / DRAKE_INHALE;
      if (target && t < 0.7) {
        this.aim = Math.atan2(target.y - this.y, target.x - this.x);
        this.face(target.x - this.x);
      }
      this.layCone(this.aim, DRAKE_BREATH_SWEEP + DRAKE_BREATH_HALF, 0.12 + t * 0.4);
      if (Math.random() < dt / 90) w.debris(ICE_TINTS, this.x + sideOf(this) * 8, this.y - this.hover - 22, 1, this.y + 20, 'gather');
      if (this.timer <= 0) {
        this.enter('attack', DRAKE_BREATH);
        this.play('breath', true);
        this.tick = 0;
        this.puffT = 0;
        this.soundT = 0;
      }
      return;
    }
    if (this.state === 'attack' && this.skill === 'breath') {
      const p = 1 - this.timer / DRAKE_BREATH;
      const a = this.aim + this.sweepDir * DRAKE_BREATH_SWEEP * (p * 2 - 1);
      this.face(Math.cos(a));
      this.layCone(a, DRAKE_BREATH_HALF, 0.32);
      this.pour(dt, a);
      if (this.timer <= 0) {
        this.cone?.destroy();
        this.cone = null;
        this.enter('recover', 650);
        this.play('idle');
        this.cooldown = 3200 + Math.random() * 800;
        this.swoopNext = true;
      }
      return;
    }
    if (this.state === 'windup') {
      // The swoop: wings folding back while the lane settles.
      const t = 1 - this.timer / DRAKE_SWOOP_WINDUP;
      if (target && t < 0.7) {
        this.aimSwoop(target);
        this.face(this.ux);
      }
      if (this.lane) layLane(this.lane, this.x, this.y, this.ux, this.uy, this.len, 1.4, 0.18 + t * 0.5);
      if (this.timer <= 0) {
        this.gone = 0;
        this.struck = false;
        this.enter('attack', 99999);
        sound.wings(w.pan(this.x), 3);
      }
      return;
    }
    if (this.state === 'attack') {
      const s = Math.min((DRAKE_SWOOP_SPEED * dt) / 1000, this.len - this.gone);
      this.x += this.ux * s;
      this.y += this.uy * s;
      this.gone += s;
      this.dip = Math.sin((this.gone / this.len) * Math.PI) * (DRAKE_HOVER - 4);
      if (this.lane) layLane(this.lane, this.x, this.y, this.ux, this.uy, Math.max(0, this.len - this.gone), 1.4, 0.45);
      if (!this.struck && this.dip > 4 && w.hurtHeroAt(this.x + this.ux * 6, this.y - 8, 11, { damage: mobHit('frostdrake', 0.75), fromX: this.x - this.ux * 10, fromY: this.y - this.uy * 10, knock: 190 })) {
        this.struck = true;
        sound.rake(w.pan(this.x));
      }
      if (Math.random() < dt / 30) w.debris(ICE_TINTS, this.x - this.ux * 10, this.y - this.hover - 14, 1, this.y + 1, 'trail');
      if (this.gone >= this.len - 0.5) {
        this.dip = 0;
        this.lane?.destroy();
        this.lane = null;
        this.enter('recover', 480);
        this.play('idle');
        this.cooldown = Math.max(this.cooldown, 900);
      }
      return;
    }
    this.stand(dt);
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** Breath pouring from its jaws down onto the floor along `a`, chilling whatever stands in it. */
  private pour(dt: number, a: number): void {
    const w = this.world;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const range = DRAKE_BREATH_RANGE * this.size;
    // Its jaws, in the air before it.
    const mx = this.x + sideOf(this) * 20 * this.size;
    const my = this.y - this.hover - 20 * this.size;
    this.puffT -= dt;
    if (this.puffT <= 0) {
      this.puffT = 45;
      const sp = 170 + Math.random() * 40;
      const life = (range / sp) * 1000;
      const spread = (Math.random() - 0.5) * DRAKE_BREATH_HALF * 1.6;
      const vx = Math.cos(a + spread) * sp;
      const vy = Math.sin(a + spread) * sp + (this.y - my) / (life / 1000) * 0.8;
      w.addEffect(new Flare(w, mx, my, { key: 'fs_puff', frame: 'p0', anim: 'fs_puff_roll', life, vx, vy, scale: [0.6, 2], tint: 0xcfefff, alpha: 0.8, depth: this.y + 18 }));
    }
    this.soundT -= dt;
    if (this.soundT <= 0) {
      this.soundT = 420;
      sound.frost('gust', w.pan(this.x));
    }
    if (Math.random() < dt / 40) {
      const r = Math.random() * range;
      w.debris(ICE_TINTS, this.x + ca * r, this.y + sa * r, 1, this.y + sa * r + 1, 'spores');
    }
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = DRAKE_BREATH_TICK;
    const h = w.heroPos;
    if (!h) return;
    const dx = h.x - this.x;
    const dy = h.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d > range + 6 || Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - a)) > DRAKE_BREATH_HALF + 8 / Math.max(d, 8)) return;
    if (w.hurtHeroAt(h.x, h.y - 11, 8, { damage: mobHit('frostdrake', 0.32), fromX: this.x, fromY: this.y, knock: 50 })) chill(w, CHILL_DEEP);
  }

  protected onInterrupted(): void {
    this.cone?.destroy();
    this.lane?.destroy();
    this.cone = this.lane = null;
    this.dip = 0;
  }
}

// ---------------------------------------------------------------- Yeti

const YETI_DIG = 720;
const YETI_LIFT = 520;
const YETI_THROW_MIN = 50;
const YETI_THROW_MAX = 200;
const YETI_FLIGHT = 950;
/** Darts of ice the boulder breaks into, and how far they fly. */
const YETI_SHARDS = 6;
const YETI_SHARD_RANGE = 62;
const YETI_LEAP_RANGE = 105;
const YETI_CROUCH = 680;
const YETI_LEAP_TIME = 620;
const YETI_LEAP_HEIGHT = 34;
const YETI_LEAP_REST = 3600;

/**
 * A great white yeti. From range it digs its claws into the floor, rips up a
 * boulder of packed snow, holds it high and heaves it at the hero: it lands
 * on its mark and bursts into darts of ice. Closer in it crouches, leaps and
 * comes down fists first, a ring of frost racing out from where it lands,
 * and it stays down a moment after.
 */
export class Yeti extends Monster {
  private skill: 'dig' | 'lift' | 'throw' | 'leap' = 'dig';
  private tx = 0;
  private ty = 0;
  private sx = 0;
  private sy = 0;
  private leapAt = -Infinity;
  private mark: Phaser.GameObjects.Image | null = null;
  private stepT = 0;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'yeti', hp: mobHp('yeti'), radius: 11, bodyY: 18, speed: 34, sight: 160, leash: 320, mass: 8, barY: 52, debris: YETI_TINTS });
    this.cooldown = 1100;
  }

  get pinned(): boolean {
    return this.state === 'attack' && this.skill === 'leap';
  }

  protected staggers(): boolean {
    return this.state !== 'attack';
  }

  protected move(dt: number, ux: number, uy: number, speed: number): void {
    super.move(dt, ux, uy, speed);
    this.stepT += dt;
    if (this.stepT > 420) {
      this.stepT = 0;
      this.world.debris(SNOW_TINTS, this.x + (Math.random() - 0.5) * 12, this.y, 1, this.y + 1, 'spores');
    }
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    const now = this.world.time.now;
    if (this.cooldown === 0 && dist < YETI_LEAP_RANGE && now - this.leapAt > YETI_LEAP_REST) return this.startLeap(target);
    if (this.cooldown === 0 && dist > YETI_THROW_MIN && dist < YETI_THROW_MAX) return this.startDig();
    this.move(dt, (target.x - this.x) / (dist || 1), (target.y - this.y) / (dist || 1), this.stats.speed);
  }

  private startDig(): void {
    this.skill = 'dig';
    this.enter('windup', YETI_DIG);
    this.play('dig', true);
    sound.frost('crunch', this.world.pan(this.x));
  }

  private startLeap(target: Target): void {
    this.skill = 'leap';
    this.leapAt = this.world.time.now;
    this.enter('windup', YETI_CROUCH);
    this.play('crouch', true);
    this.aimLeap(target);
    this.mark = dangerMark(this.world, this.tx, this.ty, 24 * this.size, 14 * this.size);
    sound.roar(this.world.pan(this.x));
  }

  /** Where it will land: on the hero, or as near as the arena lets it. */
  private aimLeap(target: Target): void {
    const [ux, uy] = toward(this.x, this.y, target.x, target.y);
    const d = Math.min(YETI_LEAP_RANGE + 10, Math.hypot(target.x - this.x, target.y - this.y));
    const run = clearRun(this.world, this.x, this.y, ux, uy, d);
    this.tx = this.x + ux * run;
    this.ty = this.y + uy * run;
  }

  protected act(dt: number, target: Target | null): void {
    const w = this.world;
    const side = sideOf(this);
    if (this.state === 'windup') {
      if (this.skill === 'dig') {
        if (Math.random() < dt / 50) w.debris(SNOW_TINTS, this.x + side * 13, this.y - 2, 1, this.y + 2, 'spores');
        if (this.timer <= 0) {
          // The boulder comes up; the spot it's meant for is marked.
          this.skill = 'lift';
          this.enter('windup', YETI_LIFT);
          this.play('lift', true);
          iceBurst(w, this.x + side * 12, this.y - 4, 6);
          if (target) {
            this.tx = target.x;
            this.ty = target.y;
            this.face(target.x - this.x);
          }
          this.mark = dangerMark(w, this.tx, this.ty, 22, 13);
          sound.frost('crunch', w.pan(this.x), true);
        }
        return;
      }
      if (this.skill === 'lift') {
        const t = 1 - this.timer / YETI_LIFT;
        if (target && t < 0.6) {
          this.tx = target.x;
          this.ty = target.y;
          this.face(target.x - this.x);
        }
        this.mark?.setPosition(snap(this.tx), snap(this.ty)).setAlpha(0.3 + t * 0.4);
        if (this.timer <= 0) this.heave();
        return;
      }
      // The crouch before the leap.
      const t = 1 - this.timer / YETI_CROUCH;
      if (target && t < 0.7) {
        this.aimLeap(target);
        this.face(this.tx - this.x);
      }
      this.mark?.setPosition(snap(this.tx), snap(this.ty)).setAlpha(0.3 + t * 0.55);
      if (this.timer <= 0) {
        this.sx = this.x;
        this.sy = this.y;
        this.enter('attack', YETI_LEAP_TIME);
        this.play('leap', true);
        w.debris(SNOW_TINTS, snap(this.x), snap(this.y), 8, this.y + 1, 'spores');
        sound.toss(w.pan(this.x), true);
      }
      return;
    }
    if (this.state === 'attack' && this.skill === 'leap') {
      const p = Math.min(1, 1 - this.timer / YETI_LEAP_TIME);
      this.x = this.sx + (this.tx - this.sx) * p;
      this.y = this.sy + (this.ty - this.sy) * p;
      this.hover = Math.sin(p * Math.PI) * YETI_LEAP_HEIGHT * this.size;
      this.mark?.setAlpha(0.6 + p * 0.3);
      if (this.timer <= 0) this.land();
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) {
        this.enter('recover', 700);
        this.play('idle');
      }
      return;
    }
    if (this.timer < 350) this.stand(dt);
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** Over its head and away: a boulder that bursts into darts of ice where it lands. */
  private heave(): void {
    const w = this.world;
    const side = sideOf(this);
    this.mark?.destroy();
    this.mark = null;
    this.skill = 'throw';
    this.enter('attack', 380);
    this.play('throw', true);
    sound.toss(w.pan(this.x), true);
    const shards = mobHit('yeti', 0.35);
    w.addEffect(
      new Lob(w, {
        sx: this.x + side * 4,
        sy: this.y,
        lift: 42 * this.size,
        ex: this.tx,
        ey: this.ty,
        flight: YETI_FLIGHT,
        arc: 46,
        texture: 'fs_boulder',
        frame: 'b',
        lit: true,
        rx: 22,
        ry: 13,
        damage: mobHit('yeti', 1.1),
        knock: 240,
        tints: SNOW_TINTS,
        ringTint: T_ICE,
        spin: 4,
        onLand: (x, y) => {
          iceBurst(w, x, y - 6, 14);
          w.cameras.main.shake(150, 0.002);
          sound.shatter(w.pan(x), true);
          const a0 = Math.random() * Math.PI;
          for (let i = 0; i < YETI_SHARDS; i++) {
            const a = a0 + (i / YETI_SHARDS) * Math.PI * 2;
            w.addEffect(new IceShard(w, x + Math.cos(a) * 6, y - 6 + Math.sin(a) * 4, Math.cos(a), Math.sin(a), { damage: shards, speed: 125, range: YETI_SHARD_RANGE, size: 0.85, chill: CHILL_LIGHT }));
          }
        },
      }),
    );
    this.cooldown = 2600 + Math.random() * 700;
  }

  /** Down it comes, fists first: the blow where it lands and a ring of frost racing out. */
  private land(): void {
    const w = this.world;
    this.hover = 0;
    this.mark?.destroy();
    this.mark = null;
    this.play('slam', true);
    if (w.hurtHeroInEllipse(this.x, this.y, 22 * this.size, 13 * this.size, { damage: mobHit('yeti', 1.2), fromX: this.x, fromY: this.y - 6, knock: 260 })) chill(w, CHILL_LIGHT);
    w.addEffect(new FrostRing(w, this.x, this.y, { from: 10, to: 66 * this.size, speed: 120, damage: mobHit('yeti', 0.55), chill: CHILL_LIGHT }));
    iceBurst(w, this.x, this.y - 4, 12);
    w.debris(SNOW_TINTS, snap(this.x), snap(this.y), 14, this.y + 2, 'spores');
    w.cameras.main.shake(220, 0.003);
    sound.slam(w.pan(this.x));
    // It stays down a moment, fists in the snow.
    this.enter('recover', 1050);
    this.pose('slam');
    this.cooldown = 1500;
  }

  protected onInterrupted(): void {
    this.mark?.destroy();
    this.mark = null;
    this.hover = 0;
  }
}

// ---------------------------------------------------------------- Rimeknight

const KNIGHT_REACH = 130;
/** Each of the three cuts' wind-up, the dash's speed and length. */
const KNIGHT_CUT_WINDUPS = [580, 470, 470];
const KNIGHT_DASH_SPEED = 330;
const KNIGHT_DASH_LEN = 72;
const KNIGHT_CUT_PAUSE = 130;
const KNIGHT_FINISH_WINDUP = 820;
const KNIGHT_WAVE_SPEED = 190;
const KNIGHT_WAVE_LEN = 175;
/** How long it stands pulling its sword free: the moment to punish it. */
const KNIGHT_STUCK = 1250;

/**
 * An elegant knight in frost-iron with a glowing ice greatsword. It closes
 * in three quick dash-cuts, each along a lane that shows a beat before it
 * goes, then raises the blade (it blazes) and drives it into the floor: a
 * blade of frost rolls out along a long lane and a ring of rime bursts round
 * it. Then it stands a moment, pulling the sword free.
 */
export class Rimeknight extends Monster {
  private skill: 'cut' | 'finish' = 'cut';
  private cut = 0;
  private ux = 1;
  private uy = 0;
  private len = 0;
  private gone = 0;
  private struck = false;
  private lane: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'rimeknight', hp: mobHp('rimeknight'), radius: 7, bodyY: 15, speed: 46, sight: 170, leash: 320, mass: 4, barY: 44, debris: KNIGHT_TINTS });
    this.cooldown = 900;
  }

  get pinned(): boolean {
    return this.state === 'attack' && this.skill === 'cut';
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.cooldown === 0 && dist < KNIGHT_REACH) {
      this.cut = 0;
      return this.windCut(target);
    }
    // Between combos it walks in, unhurried, and holds its guard close by.
    if (dist > 34) this.move(dt, (target.x - this.x) / (dist || 1), (target.y - this.y) / (dist || 1), this.stats.speed * (this.cooldown > 0 ? 0.7 : 1));
    else this.stand(dt);
  }

  private aimAt(target: Target, max: number): void {
    [this.ux, this.uy] = toward(this.x, this.y, target.x, target.y);
    this.len = Math.max(16, clearRun(this.world, this.x, this.y, this.ux, this.uy, max));
  }

  private windCut(target: Target): void {
    this.skill = 'cut';
    this.aimAt(target, KNIGHT_DASH_LEN);
    this.face(this.ux);
    this.enter('windup', KNIGHT_CUT_WINDUPS[this.cut]);
    this.play('draw', true);
    this.lane ??= frostLane(this.world, this.x, this.y, 1.3);
    sound.frost('chime', this.world.pan(this.x));
  }

  protected act(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      const total = this.skill === 'cut' ? KNIGHT_CUT_WINDUPS[this.cut] : KNIGHT_FINISH_WINDUP;
      const t = 1 - this.timer / total;
      if (target && t < 0.7) {
        this.aimAt(target, this.skill === 'cut' ? KNIGHT_DASH_LEN : KNIGHT_WAVE_LEN);
        this.face(this.ux);
      }
      const width = this.skill === 'cut' ? 1.3 : 2;
      if (this.lane) layLane(this.lane, this.x, this.y, this.ux, this.uy, this.len, width, 0.18 + t * 0.55);
      if (this.skill === 'finish' && Math.random() < dt / 60) w.debris(ICE_TINTS, this.x - sideOf(this) * 10, this.y - 36, 1, this.y + 2, 'gather');
      if (this.timer > 0) return;
      if (this.skill === 'finish') return this.plunge();
      this.gone = 0;
      this.struck = false;
      this.enter('attack', 99999);
      this.play('cut', true);
      sound.saberSwing(this.cut, w.pan(this.x));
      return;
    }
    if (this.state === 'attack' && this.skill === 'cut') {
      const s = Math.min((KNIGHT_DASH_SPEED * dt) / 1000, this.len - this.gone);
      this.x += this.ux * s;
      this.y += this.uy * s;
      this.gone += s;
      if (this.lane) layLane(this.lane, this.x, this.y, this.ux, this.uy, Math.max(0, this.len - this.gone), 1.3, 0.5);
      if (!this.struck && w.hurtHeroAt(this.x + this.ux * 12, this.y - 12 + this.uy * 6, 12, { damage: mobHit('rimeknight', 0.7), fromX: this.x, fromY: this.y - 12, knock: 170 })) {
        this.struck = true;
        iceBurst(w, this.x + this.ux * 14, this.y - 12, 6);
      }
      if (Math.random() < dt / 25) w.debris(ICE_TINTS, this.x - this.ux * 6, this.y - 10, 1, this.y + 1, 'trail');
      if (this.gone >= this.len - 0.5) {
        // The cut's crescent hangs a beat where the blade went.
        w.addEffect(new Flare(w, this.x + this.ux * 10, this.y - 13 + this.uy * 4, { key: 'fs_slash', frame: 's0', anim: 'fs_slash_fade', life: 190, rot: Math.atan2(this.uy, this.ux), scale: [0.75, 0.9], tint: 0xd8f6ff, depth: this.y + 18, flipY: this.cut % 2 === 1 }));
        this.enter('recover', KNIGHT_CUT_PAUSE);
      }
      return;
    }
    if (this.state === 'attack') return;
    // Recover: between cuts a breath, after the finisher a long pull at the stuck blade.
    if (this.timer > 0) return;
    if (this.skill === 'cut' && target && this.cut < 2) {
      this.cut++;
      this.face(target.x - this.x);
      return this.windCut(target);
    }
    if (this.skill === 'cut' && target) {
      this.skill = 'finish';
      this.aimAt(target, KNIGHT_WAVE_LEN);
      this.face(this.ux);
      this.enter('windup', KNIGHT_FINISH_WINDUP);
      this.play('raise', true);
      this.lane ??= frostLane(w, this.x, this.y, 2);
      sound.frost('chime', w.pan(this.x), true);
      return;
    }
    this.clearLane();
    this.play('idle');
    this.enter('chase', 0);
  }

  /** The sword goes into the floor: a blade of frost rolls out, a ring of rime bursts round it. */
  private plunge(): void {
    const w = this.world;
    this.clearLane();
    this.play('plunge', true);
    const sx = this.x + this.ux * 12;
    const sy = this.y + this.uy * 8;
    w.addEffect(new BladeWave(w, sx, sy, this.ux, this.uy, { speed: KNIGHT_WAVE_SPEED, range: this.len, damage: mobHit('rimeknight', 1), chill: CHILL_DEEP }));
    w.addEffect(new FrostRing(w, this.x + sideOf(this) * 10, this.y, { from: 6, to: 36, speed: 95, damage: mobHit('rimeknight', 0.4), chill: CHILL_LIGHT }));
    iceBurst(w, this.x + sideOf(this) * 10, this.y - 3, 12);
    w.cameras.main.shake(160, 0.0022);
    sound.frost('crack', w.pan(this.x), true);
    this.enter('recover', KNIGHT_STUCK);
    this.cooldown = 2600 + Math.random() * 800;
  }

  private clearLane(): void {
    this.lane?.destroy();
    this.lane = null;
  }

  protected onInterrupted(): void {
    this.clearLane();
  }
}
