import Phaser from 'phaser';
import { CANDY_TINTS, GOURD_TINTS, HEXBAT_TINTS, KING_FIRE_TINTS, KING_GHOST_TINTS, KING_HEAD_Y, LASH_W, SEED_TINTS, SPROUT_FRAMES, SPROUT_H } from '../../art/hallowsMonsters';
import { MONSTER_FRAME } from '../../art/monsters';
import { snap } from '../display';
import { sound } from '../../audio';
import { BossBar } from '../BossBar';
import type { Effect } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';
import { clearRun } from './Deep';
import { Monster, type Target } from './Monster';
import { Spawner } from './index';
import { mobHit, mobHp } from '../tiers';

// Hallow's Eve's monsters, who join the arenas through October. Gourdlings
// scuttle up and pounce; hexbats wheel round their prey and dive; the
// Pumpkin King lashes, bombs and calls up gourdlings of his own.

const ORANGE = 0xff8a2a;
const GHOST_GREEN = 0x5aff9a;
const VIOLET = 0xb070ff;

// ---------------------------------------------------------------- Gourdling

const GOURD_SQUAT = 560;
const GOURD_REACH = 48;
const GOURD_LUNGE_SPEED = 210;
const GOURD_LUNGE_MAX = 64;
const GOURD_RECOVER = 650;

/**
 * A little living jack-o'-lantern on vine legs. It scuttles up to its prey,
 * squats while its face flares bright (the moment to step aside), then
 * pounces with a bite and takes a breath to recover.
 */
export class Gourdling extends Monster {
  private phase = Math.random() * 1000;
  private ux = 1;
  private uy = 0;
  private lunge = 0;
  private struck = false;
  private halo: Phaser.GameObjects.Image;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'gourdling',
      hp: mobHp('gourdling'),
      radius: 6,
      bodyY: 9,
      speed: 56,
      sight: 120,
      leash: 240,
      mass: 0.7,
      barY: 26,
      debris: GOURD_TINTS,
    });
    this.cooldown = 700 + Math.random() * 500;
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(ORANGE).setAlpha(0);
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    // A scuttle is a string of little hops; the pounce is one big one.
    if (this.state === 'attack') this.hover = Math.sin(Math.min(1, 1 - this.timer / (this.lunge || 1)) * Math.PI) * 7;
    else if (this.body.anims.currentAnim?.key.startsWith('gourdling_walk')) this.hover = Math.abs(Math.sin(this.phase * 0.018)) * 1.5;
    else this.hover = 0;
    super.update(dt, target, daylight);
    if (this.dead) return;
    // Its candle's glow on the ground round it, brighter as it flares.
    const flare = this.state === 'windup' ? 1 - this.timer / GOURD_SQUAT : this.state === 'attack' ? 1 : 0;
    const fade = this.state === 'dying' ? 0 : this.state === 'spawn' ? 1 - this.timer / 700 : 1;
    const flick = 0.85 + Math.sin(this.phase * 0.021) * 0.08 + Math.sin(this.phase * 0.057) * 0.07;
    this.halo
      .setPosition(snap(this.x + (this.facing === 'r' ? 2 : -2)), snap(this.y - this.hover - 9))
      .setDepth(this.y + 0.3)
      .setScale(0.32 + flare * 0.25)
      .setAlpha((0.14 + flare * 0.3) * flick * fade);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.cooldown === 0 && dist < GOURD_REACH) {
      this.enter('windup', GOURD_SQUAT);
      this.play('windup', true);
      sound.creak(this.world.pan(this.x));
      return;
    }
    const d = dist || 1;
    // It closes in on a slight slant, so a pack comes at the hero from all sides.
    const tilt = ((Math.abs(this.slot) % 3) - 1) * 0.3;
    const dx = (target.x - this.x) / d;
    const dy = (target.y - this.y) / d;
    this.move(dt, dx - dy * tilt, dy + dx * tilt, this.stats.speed);
    this.face(target.x - this.x);
  }

  protected act(dt: number, target: Target | null, dist: number): void {
    if (this.state === 'windup') {
      // Keeps its eye on the prey until the last moment.
      if (target && this.timer > GOURD_SQUAT * 0.25) {
        this.face(target.x - this.x);
        const l = Math.hypot(target.x - this.x, target.y - this.y) || 1;
        this.ux = (target.x - this.x) / l;
        this.uy = (target.y - this.y) / l;
      }
      if (Math.random() < dt / 70) this.world.debris(GOURD_TINTS, this.x + (this.facing === 'r' ? 3 : -3), this.y - 10, 1, this.y + 1, 'gather');
      if (this.timer <= 0) {
        const len = Math.max(16, clearRun(this.world, this.x, this.y, this.ux, this.uy, Math.min(dist + 14, GOURD_LUNGE_MAX)));
        this.lunge = (len / GOURD_LUNGE_SPEED) * 1000;
        this.struck = false;
        this.enter('attack', this.lunge);
        this.pose('pounce');
        sound.hop(this.world.pan(this.x));
      }
      return;
    }
    if (this.state === 'attack') {
      const s = (GOURD_LUNGE_SPEED * dt) / 1000;
      this.x += this.ux * s;
      this.y += this.uy * s;
      if (!this.struck) this.struck = this.world.hurtHeroAt(this.x, this.y - 7, this.radius + 3, { damage: mobHit('gourdling'), fromX: this.x - this.ux * 10, fromY: this.y - this.uy * 10, knock: 150 });
      if (this.timer <= 0) {
        this.world.debris(SEED_TINTS, snap(this.x), snap(this.y) - 2, 4, this.y + 1);
        this.enter('recover', GOURD_RECOVER);
        this.play('idle', true);
        this.cooldown = 1300 + Math.random() * 900;
      }
      return;
    }
    this.stand(dt);
    if (this.timer <= 0) this.enter('chase', 0);
  }

  protected staggers(): boolean {
    return this.state !== 'attack';
  }

  protected onDeath(): void {
    // It bursts: seeds and chunks of pumpkin everywhere.
    this.world.debris(SEED_TINTS, snap(this.x), snap(this.y) - 8, 12, this.y + 1);
    this.world.debris(GOURD_TINTS, snap(this.x), snap(this.y) - 6, 8, this.y + 1, 'spores');
    sound.puff(this.world.pan(this.x));
  }

  destroy(): void {
    if (this.dead) return;
    super.destroy();
    this.halo.destroy();
  }
}

// ---------------------------------------------------------------- Hexbat

const BAT_HOVER = 15;
const BAT_ORBIT = 70;
const BAT_SHRIEK = 600;
const BAT_DIVE_SPEED = 230;
const BAT_OVERSHOOT = 30;
const BAT_FLEE = 520;

/**
 * A violet-black bat with ember eyes. It circles its prey out of reach, then
 * hangs and shrieks, eyes blazing, while a ring marks where it will strike;
 * it dives through that spot and flutters back out to circle again.
 */
export class Hexbat extends Monster {
  private phase = Math.random() * 1000;
  private spin = Math.random() < 0.5 ? 1 : -1;
  private ux = 1;
  private uy = 0;
  private dive = 0;
  private struck = false;
  private mark: Phaser.GameObjects.Image | null = null;
  private eyes: Phaser.GameObjects.Image;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'hexbat',
      hp: mobHp('hexbat'),
      radius: 5,
      bodyY: 10,
      speed: 70,
      sight: 140,
      leash: 280,
      mass: 0.4,
      barY: 38,
      debris: HEXBAT_TINTS,
    });
    this.hover = BAT_HOVER;
    this.cooldown = 1000 + Math.random() * 800;
    this.eyes = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(ORANGE).setAlpha(0);
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    const flying = BAT_HOVER + Math.sin(this.phase * 0.0065) * 2.5;
    // Down it swoops for the dive, and back up after.
    const goal = this.state === 'attack' ? 4 : flying;
    this.hover += (goal - this.hover) * Math.min(1, dt / (this.state === 'attack' ? 70 : 240));
    super.update(dt, target, daylight);
    if (this.dead) return;
    const blaze = this.state === 'windup' ? 0.5 + Math.sin(this.phase * 0.05) * 0.2 : this.state === 'attack' ? 0.45 : 0;
    this.eyes
      .setPosition(snap(this.x + (this.facing === 'r' ? 3 : -3)), snap(this.y - this.hover - 16))
      .setDepth(this.y + 0.3)
      .setScale(0.18 + blaze * 0.2)
      .setAlpha(blaze);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.cooldown === 0 && dist < BAT_ORBIT + 40) {
      this.face(target.x - this.x);
      this.enter('windup', BAT_SHRIEK);
      this.play('windup', true);
      this.mark = this.world.add.image(snap(target.x), snap(target.y), 'danger_ring').setTint(VIOLET).setDepth(2).setScale(0.6, 0.7).setAlpha(0);
      sound.chitter(this.world.pan(this.x));
      return;
    }
    // Wheel round the prey at a distance: pulled onto a ring round it and carried along it.
    const d = dist || 1;
    const rx = (target.x - this.x) / d;
    const ry = (target.y - this.y) / d;
    const pull = Phaser.Math.Clamp((dist - BAT_ORBIT) / 24, -1, 1);
    const ux = rx * pull - ry * this.spin;
    const uy = ry * pull + rx * this.spin;
    const l = Math.hypot(ux, uy) || 1;
    this.move(dt, ux / l, uy / l, this.stats.speed);
    this.face(target.x - this.x);
    if (Math.random() < dt / 3200) this.spin = -this.spin;
  }

  protected act(dt: number, target: Target | null, dist: number): void {
    if (this.state === 'windup') {
      const t = 1 - this.timer / BAT_SHRIEK;
      // It fixes on the spot a little before it drops, so it can be dodged.
      if (target && t < 0.75) {
        this.face(target.x - this.x);
        const l = Math.hypot(target.x - this.x, target.y - this.y) || 1;
        this.ux = (target.x - this.x) / l;
        this.uy = (target.y - this.y) / l;
        this.mark?.setPosition(snap(target.x), snap(target.y));
      }
      this.mark?.setAlpha(0.25 + t * 0.6).setScale(0.45 + t * 0.2, 0.55 + t * 0.2);
      if (this.timer <= 0) {
        const len = Math.max(24, clearRun(this.world, this.x, this.y, this.ux, this.uy, Math.min(dist, 130) + BAT_OVERSHOOT));
        this.dive = (len / BAT_DIVE_SPEED) * 1000;
        this.struck = false;
        this.enter('attack', this.dive);
        this.pose('dive');
        sound.whirl(this.world.pan(this.x));
      }
      return;
    }
    if (this.state === 'attack') {
      const s = (BAT_DIVE_SPEED * dt) / 1000;
      this.x += this.ux * s;
      this.y += this.uy * s;
      this.mark?.setAlpha(Math.max(0, this.timer / this.dive) * 0.7);
      if (Math.random() < dt / 30) this.world.debris(HEXBAT_TINTS, this.x, this.y - this.bodyY, 1, this.y - 1, 'trail');
      if (!this.struck) this.struck = this.world.hurtHeroAt(this.x, this.y - 8, this.radius + 3, { damage: mobHit('hexbat'), fromX: this.x - this.ux * 12, fromY: this.y - this.uy * 12, knock: 160 });
      if (this.timer <= 0) {
        this.clearMark();
        this.enter('recover', BAT_FLEE);
        this.play('walk', true);
        this.cooldown = 1800 + Math.random() * 1000;
        this.spin = Math.random() < 0.5 ? 1 : -1;
      }
      return;
    }
    // Flutter back out, away from the prey, before wheeling round again.
    if (target && dist < BAT_ORBIT) {
      const d = dist || 1;
      this.move(dt, (this.x - target.x) / d, (this.y - target.y) / d, this.stats.speed * 1.1);
    } else this.play('idle');
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private clearMark(): void {
    this.mark?.destroy();
    this.mark = null;
  }

  protected staggers(): boolean {
    return this.state !== 'attack';
  }

  protected onInterrupted(): void {
    this.clearMark();
  }

  destroy(): void {
    if (this.dead) return;
    super.destroy();
    this.eyes.destroy();
  }
}

// ---------------------------------------------------------------- The Pumpkin King's spells

/** Where the burning ground stings, and how long it burns. */
const FLAME_RX = 13;
const FLAME_RY = 8;
const FLAME_LIFE = 1900;

/** A little fire left burning where a bomb burst: it stings whoever stands in it. */
class Flames implements Effect {
  dead = false;
  private t = 0;
  private tick = 250;
  private flames: Phaser.GameObjects.Image[] = [];
  private halo: Phaser.GameObjects.Image;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private damage: number,
    private ghost: boolean,
  ) {
    const spots = [[-6, -1], [5, 0], [0, 3], [-1, -3]];
    for (const [dx, dy] of spots) {
      this.flames.push(world.add.image(snap(x + dx), snap(y + dy) + 1, 'hw_flame_e', `${ghost ? 'g' : 'o'}0`).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + dy + 1).setAlpha(0));
    }
    this.halo = world.add.image(snap(x), snap(y) - 3, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(ghost ? GHOST_GREEN : ORANGE).setScale(0.8, 0.5).setDepth(y + 0.5).setAlpha(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const a = Math.min(1, this.t / 120) * Math.min(1, (FLAME_LIFE - this.t) / 400);
    this.flames.forEach((f, i) => f.setFrame(`${this.ghost ? 'g' : 'o'}${(Math.floor(this.t / 90) + i) % 4}`).setAlpha(a * (i === 3 ? 0.7 : 1)));
    this.halo.setAlpha(a * (0.35 + Math.sin(this.t * 0.03) * 0.08));
    this.tick -= dt;
    if (this.tick <= 0 && a > 0.5) {
      this.tick = 500;
      this.world.hurtHeroInEllipse(this.x, this.y, FLAME_RX, FLAME_RY, { damage: this.damage, fromX: this.x, fromY: this.y, knock: 0 });
    }
    if (this.t >= FLAME_LIFE) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const f of this.flames) f.destroy();
    this.halo.destroy();
  }
}

const BOMB_RX = 18;
const BOMB_RY = 11;

/**
 * A flaming pumpkin bomb, hurled from the King's sceptre in a high arc to a
 * marked ring; its shadow grows under it as it falls. It bursts in fire and
 * seeds and leaves the ground burning.
 */
class PumpkinBomb implements Effect {
  dead = false;
  private t = 0;
  private body: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private tints: number[];

  constructor(
    private world: WorldScene,
    private sx: number,
    private sy: number,
    private lift: number,
    private ex: number,
    private ey: number,
    private delay: number,
    private flight: number,
    private damage: number,
    private ghost: boolean,
  ) {
    const add = world.add;
    const f = `${ghost ? 'g' : 'o'}0`;
    this.tints = ghost ? KING_GHOST_TINTS : KING_FIRE_TINTS;
    this.body = add.image(sx, sy - lift, 'hw_bomb', f).setPipeline('Lit').setVisible(false);
    this.glow = add.image(sx, sy - lift, 'hw_bomb_e', f).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.halo = add.image(sx, sy - lift, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(ghost ? GHOST_GREEN : ORANGE).setScale(0.45).setVisible(false);
    this.ring = add.image(snap(ex), snap(ey), 'danger_ring').setTint(ghost ? GHOST_GREEN : ORANGE).setDepth(2).setScale(BOMB_RX / 22, BOMB_RY / 12).setAlpha(0);
    this.shadow = add.image(ex, ey, 'shadow').setDepth(1).setAlpha(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const t = this.t - this.delay;
    // The ring shows as soon as it is thrown, a little before when held back.
    const shown = Math.min(1, Math.max(0, (t + 250) / (this.flight * 0.6)));
    this.ring.setAlpha(shown * (0.45 + Math.sin(this.t * 0.03) * 0.12)).setScale((BOMB_RX / 22) * (0.7 + shown * 0.3), (BOMB_RY / 12) * (0.7 + shown * 0.3));
    if (t < 0) return;
    const k = Math.min(1, t / this.flight);
    const gx = this.sx + (this.ex - this.sx) * k;
    const gy = this.sy + (this.ey - this.sy) * k;
    const h = this.lift * (1 - k) + Math.sin(k * Math.PI) * 46;
    const f = `${this.ghost ? 'g' : 'o'}${Math.floor(this.t / 80) % 4}`;
    const bx = snap(gx);
    const by = snap(gy - h);
    this.body.setVisible(true).setFrame(f).setPosition(bx, by).setDepth(gy + 20);
    this.glow.setVisible(true).setFrame(f).setPosition(bx, by).setDepth(gy + 20.1);
    this.halo.setVisible(true).setPosition(bx, by).setDepth(gy + 19.9).setAlpha(0.35 + Math.sin(this.t * 0.04) * 0.1);
    this.shadow.setAlpha(k * 0.7).setScale(0.3 + k * 0.5);
    if (Math.random() < dt / 30) this.world.debris(this.tints, gx, gy - h - 4, 1, gy + 19, 'trail');
    if (k >= 1) this.land();
  }

  private land(): void {
    const w = this.world;
    const { ex, ey } = this;
    w.hurtHeroInEllipse(ex, ey, BOMB_RX, BOMB_RY, { damage: this.damage, fromX: ex, fromY: ey + 4, knock: 170 });
    w.debris(this.tints, snap(ex), snap(ey) - 5, 16, ey + 2);
    w.debris(SEED_TINTS, snap(ex), snap(ey) - 3, 8, ey + 2);
    w.debris(GOURD_TINTS, snap(ex), snap(ey) - 4, 5, ey + 2, 'spores');
    w.addEffect(new Flames(w, ex, ey, Math.max(2, Math.round(this.damage * 0.2)), this.ghost));
    w.cameras.main.shake(90, 0.0012);
    sound.sizzle(w.pan(ex));
    sound.thud(w.pan(ex));
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.body, this.glow, this.halo, this.ring, this.shadow]) o.destroy();
  }
}

/**
 * Vines bursting up out of the ground where one of the King's gourdlings is
 * about to come up: they grow over `grow` ms, then `arrive` brings it, and
 * the vines wither away.
 */
class Sprout implements Effect {
  dead = false;
  private t = 0;
  private done = false;
  private body: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private grow: number,
    private arrive: (x: number, y: number) => void,
  ) {
    const ox = 0.5;
    const oy = (SPROUT_H - 2) / SPROUT_H;
    this.body = world.add.image(snap(x), snap(y) + 1, 'hw_sprout', 's0').setOrigin(ox, oy).setPipeline('Lit').setDepth(y - 0.5).setAlpha(0);
    this.glow = world.add.image(snap(x), snap(y) + 1, 'hw_sprout_e', 's0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y - 0.4).setAlpha(0);
    this.ring = world.add.image(snap(x), snap(y), 'danger_ring').setTint(0x8aff6a).setDepth(2).setScale(0.6, 0.6).setAlpha(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const k = Math.min(1, this.t / this.grow);
    const f = `s${Math.min(SPROUT_FRAMES - 1, Math.floor(k * SPROUT_FRAMES))}`;
    const wither = this.done ? Math.min(1, (this.t - this.grow) / 600) : 0;
    this.body.setFrame(f).setAlpha(Math.min(1, this.t / 150) * (1 - wither));
    this.glow.setFrame(f).setAlpha(Math.min(1, this.t / 150) * (1 - wither));
    this.ring.setAlpha((0.3 + k * 0.4) * (1 - wither));
    if (Math.random() < dt / 90) this.world.debris(GOURD_TINTS, this.x + (Math.random() - 0.5) * 14, this.y - 2, 1, this.y + 1, 'spores');
    if (!this.done && k >= 1) {
      this.done = true;
      this.world.debris(SEED_TINTS, snap(this.x), snap(this.y) - 4, 8, this.y + 2);
      this.arrive(this.x, this.y);
    }
    if (wither >= 1) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.body.destroy();
    this.glow.destroy();
    this.ring.destroy();
  }
}

// ---------------------------------------------------------------- The Pumpkin King

/** His head's middle, above his feet. */
const HEAD_Y = MONSTER_FRAME.pumpkin_king.oy - KING_HEAD_Y;
/** He keeps about this far off when he has nothing to cast. */
const KING_NEAR = 54;

// Vine Lash: he rears back, claws high, and a ring in front of him shows
// the sweep; then his arm lashes round in front of him, whip and all.
const LASH_RANGE = 76;
const LASH_WIND = 760;
const LASH_HOLD = 380;
const LASH_AHEAD = 30;
const LASH_RX = 32;
const LASH_RY = 20;
const LASH_SWEEP = 280;

// Pumpkin Bombs: he raises his sceptre and its little pumpkin blazes; then he
// flings flaming pumpkins in high arcs to rings on the ground round the hero.
const THROW_WIND = 850;
const BOMB_FLIGHT = 950;
const BOMB_GAP = 140;

// Pumpkin Patch: he crouches and spreads his claws, and vines burst up out
// of the ground; a gourdling sprouts from each.
const SUMMON_WIND = 700;
const SPROUT_GROW = 900;
const SUMMON_COUNT = 2;
/** He won't call more while this many of his gourdlings still stand, nor again this soon. */
const SUMMON_MAX = 3;
const SUMMON_REST = 12000;

const RECOVER = 1200;
/** Enraged, his windups take this much of the time. */
const RAGE_PACE = 0.72;

type KingSkill = 'lash' | 'bombs' | 'summon';

/** His lit poses, each a single frame (the green ones get a 'g_' in front once he is enraged). */
type KingFrame = 'lash0' | 'lash1' | 'throw0' | 'throw1';

/**
 * The Pumpkin King, Hallow's Eve's Legend: a scarecrow king twice a hero's
 * height, a great carved pumpkin for a head, crowned in vines and golden
 * thorns, fire burning orange and green inside it. He stalks his prey and
 * trades three spells with a breather after each:
 *   - Vine Lash: a sweep of his thorny arm in front of him (marked by a ring).
 *   - Pumpkin Bombs: flaming pumpkins arcing to marked rings round the hero, leaving the ground burning.
 *   - Pumpkin Patch: vines burst from the ground and gourdlings sprout from them (playing alone).
 * Below half health he is enraged: his fire burns ghost-green, bats swirl
 * round his head, and he is quicker in everything. He can't be staggered or shoved.
 */
export class PumpkinKing extends Monster {
  private skill: KingSkill = 'bombs';
  private last: KingSkill = 'lash';
  private phase = Math.random() * 1000;
  private enraged = false;
  private bossBar: BossBar;
  private halo: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private power = 0;
  private aim = { x: 0, y: 0 };
  private ring: Phaser.GameObjects.Image | null = null;
  private lash: Phaser.GameObjects.Image | null = null;
  private orb: Phaser.GameObjects.Image | null = null;
  private struck = false;
  /** His gourdlings (each in a little spawner of its own, so the world updates them and heroes can strike them). */
  private patches: Spawner[] = [];
  private summonT = 4000;
  private bats: { s: Phaser.GameObjects.Sprite; a: number; r: number; h: number }[] = [];

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'pumpkin_king',
      hp: mobHp('pumpkin_king'),
      radius: 15,
      bodyY: 38,
      speed: 22,
      sight: 170,
      leash: 100000,
      mass: 30,
      barY: 104,
      debris: KING_FIRE_TINTS,
      noBar: true,
      rank: 'legend',
    });
    this.cooldown = 1400;
    this.bossBar = new BossBar(world, 'The Pumpkin King');
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(ORANGE).setAlpha(0.3);
    this.light = world.lights.addLight(x, y - HEAD_Y, 140, 0xff8a30, 1.1);
    // Embers forever drifting up out of his head.
    this.embers = world.add.particles(0, 0, 'spark', {
      lifespan: { min: 700, max: 1400 },
      speedY: { min: -30, max: -12 },
      speedX: { min: -8, max: 8 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.9 },
      tint: KING_FIRE_TINTS,
      blendMode: Phaser.BlendModes.ADD,
      frequency: 90,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-12, -HEAD_Y - 18, 24, 8) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    });
  }

  get pinned(): boolean {
    return true;
  }

  private get tints(): number[] {
    return this.enraged ? KING_GHOST_TINTS : KING_FIRE_TINTS;
  }

  /** His animations, green once he is enraged. */
  protected play(anim: string, restart = false): void {
    super.play(this.enraged ? `g_${anim}` : anim, restart);
  }

  private hold(frame: KingFrame): void {
    this.pose(this.enraged ? `g_${frame}` : frame);
  }

  private quick(ms: number): number {
    return this.enraged ? ms * RAGE_PACE : ms;
  }

  /** Where his sceptre's pumpkin is, in the world: raised (winding up a throw) or thrust forward. */
  private sceptre(raised: boolean): { x: number; y: number } {
    const f = this.facing === 'r' ? 1 : -1;
    return raised ? { x: this.x - f * 7, y: this.y - 95 } : { x: this.x + f * 24, y: this.y - 93 };
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    this.summonT = Math.max(0, this.summonT - dt);
    super.update(dt, target, daylight);
    this.prune();
    if (this.dead) return;
    const goal = this.state === 'windup' || this.state === 'attack' ? 1 : 0;
    this.power += (goal - this.power) * Math.min(1, dt / 250);
    this.dress(dt);
    const fighting = this.state !== 'spawn' && this.state !== 'idle' && this.state !== 'wander' && this.state !== 'return';
    this.bossBar.update(dt, this.hp, this.maxHp, fighting && this.state !== 'dying', this.enraged);
  }

  /** His head's glow and light, the embers, and (enraged) the bats round his head. */
  private dress(dt: number): void {
    const ry = snap(this.y);
    const cx = snap(this.x);
    const fade = this.state === 'dying' ? Math.max(0, this.timer / 380) : this.state === 'spawn' ? 1 - this.timer / 700 : 1;
    const flick = 0.9 + Math.sin(this.phase * 0.019) * 0.06 + Math.sin(this.phase * 0.047) * 0.05;
    this.halo.setPosition(cx, ry - HEAD_Y).setDepth(ry - 0.2).setScale(1.5 + this.power * 0.5, 1.3 + this.power * 0.4).setAlpha((0.22 + this.power * 0.16) * flick * fade);
    this.light.setPosition(this.x, this.y - HEAD_Y + 12);
    this.light.intensity = (1.1 + this.power * 0.8 + (this.enraged ? 0.3 : 0)) * flick * fade;
    this.light.radius = 140 + this.power * 40;
    this.embers.setPosition(cx, ry).setDepth(ry + 0.4);
    this.embers.emitting = fade > 0.3;
    if (this.orb) {
      const s = this.sceptre(true);
      this.orb.setPosition(snap(s.x), snap(s.y)).setDepth(ry + 0.5).setScale(0.35 + this.power * 0.25 + Math.sin(this.phase * 0.04) * 0.05);
    }
    for (const b of this.bats) {
      b.a += (dt / 1000) * 2.4;
      const bx = this.x + Math.cos(b.a) * b.r;
      const by = this.y + Math.sin(b.a) * b.r * 0.4;
      const hy = by - HEAD_Y - b.h + Math.sin(this.phase * 0.004 + b.a) * 4;
      const side = Math.sin(b.a) > 0 ? 'l' : 'r';
      const key = `hexbat_walk_${side}`;
      if (b.s.anims.currentAnim?.key !== key) b.s.play(key);
      b.s.setPosition(snap(bx), snap(hy)).setDepth(by + (Math.sin(b.a) > 0 ? 1 : -1)).setAlpha(0.9 * fade);
    }
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.cooldown === 0) {
      this.skill = this.choose(dist);
      this.begin(target);
      return;
    }
    // Stalk the hero, but don't crowd them.
    if (dist > KING_NEAR) {
      const d = dist || 1;
      this.move(dt, (target.x - this.x) / d, (target.y - this.y) / d, this.stats.speed * (this.enraged ? 1.4 : 1));
      this.face(target.x - this.x);
    } else this.play('idle');
  }

  /** Close in, he lashes; he calls his gourdlings now and then (alone); otherwise he bombs. */
  private choose(dist: number): KingSkill {
    if (dist < LASH_RANGE && (this.last !== 'lash' || Math.random() < 0.35)) return 'lash';
    const standing = this.patches.reduce((n, p) => n + p.monsters.filter((m) => !m.dead).length, 0);
    // Online, the host's spawner decides every monster, so he calls none there.
    if (!Monster.net && this.summonT === 0 && standing < SUMMON_MAX && this.last !== 'summon') return 'summon';
    return 'bombs';
  }

  private begin(target: Target): void {
    this.last = this.skill;
    this.face(target.x - this.x);
    const w = this.world;
    if (this.skill === 'lash') {
      this.enter('windup', this.quick(LASH_WIND));
      this.hold('lash0');
      const f = this.facing === 'r' ? 1 : -1;
      this.ring = w.add.image(snap(this.x + f * LASH_AHEAD), snap(this.y), 'danger_ring').setTint(this.enraged ? GHOST_GREEN : ORANGE).setDepth(2).setAlpha(0).setScale((LASH_RX / 22) * 0.7, (LASH_RY / 12) * 0.7);
      sound.swell(w.pan(this.x));
    } else if (this.skill === 'bombs') {
      this.enter('windup', this.quick(THROW_WIND));
      this.hold('throw0');
      this.orb = w.add.image(this.x, this.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(this.enraged ? GHOST_GREEN : ORANGE).setAlpha(0.8).setScale(0.3);
      sound.ignite();
    } else {
      this.enter('windup', this.quick(SUMMON_WIND));
      this.play('summon', true);
      sound.raiseDead(w.pan(this.x));
    }
  }

  protected act(dt: number, target: Target | null): void {
    if (!target && this.state === 'windup') {
      this.onInterrupted();
      this.enter('return', 0);
      return;
    }
    const w = this.world;
    const f = this.facing === 'r' ? 1 : -1;
    if (this.state === 'windup') {
      const k = 1 - this.timer / this.quick(this.skill === 'lash' ? LASH_WIND : this.skill === 'bombs' ? THROW_WIND : SUMMON_WIND);
      if (this.skill === 'lash') {
        this.ring?.setAlpha(0.3 + k * 0.55 + Math.sin(this.phase * 0.03) * 0.08).setScale((LASH_RX / 22) * (0.7 + k * 0.3), (LASH_RY / 12) * (0.7 + k * 0.3));
        if (Math.random() < dt / 40) w.debris(this.tints, this.x + f * 20 + (Math.random() - 0.5) * 10, this.y - 72 + (Math.random() - 0.5) * 14, 1, this.y + 1, 'gather');
      } else if (this.skill === 'bombs') {
        const s = this.sceptre(true);
        if (Math.random() < dt / 30) w.debris(this.tints, s.x + (Math.random() - 0.5) * 16, s.y + (Math.random() - 0.5) * 16, 1, this.y + 1, 'gather');
        if (target) this.aim = { x: target.x, y: target.y };
      } else if (Math.random() < dt / 40) w.debris(GOURD_TINTS, this.x + (Math.random() - 0.5) * 50, this.y - 2, 1, this.y + 1, 'spores');
      if (this.timer <= 0 && target) this.release(target);
      return;
    }
    if (this.state === 'attack') {
      if (this.skill === 'lash') {
        const t = this.quick(LASH_HOLD) - this.timer;
        const fr = Math.min(3, Math.floor((t / LASH_SWEEP) * 3));
        this.lash?.setFrame(`${this.enraged ? 'g' : 'o'}${fr}`).setAlpha(Math.max(0, 1 - Math.max(0, t - LASH_SWEEP) / 150));
        // The sweep lands as it crosses the front of him.
        if (!this.struck && t >= LASH_SWEEP * 0.4) {
          this.struck = true;
          const hx = this.x + f * LASH_AHEAD;
          const hit = w.hurtHeroInEllipse(hx, this.y, LASH_RX, LASH_RY, { damage: mobHit('pumpkin_king', this.enraged ? 1.1 : 1), fromX: this.x, fromY: this.y, knock: 230 });
          w.debris(this.tints, snap(hx), snap(this.y) - 6, 14, this.y + 2);
          w.debris(GOURD_TINTS, snap(hx + f * 8), snap(this.y) - 2, 6, this.y + 2, 'spores');
          w.cameras.main.shake(120, hit ? 0.003 : 0.0016);
          sound.thud(w.pan(hx), hit);
        }
      }
      if (this.timer <= 0) this.rest();
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** The windup is done: the spell goes off. */
  private release(target: Target): void {
    const w = this.world;
    const f = this.facing === 'r' ? 1 : -1;
    if (this.skill === 'lash') {
      this.clearRing();
      this.hold('lash1');
      this.struck = false;
      this.lash = w.add
        .image(snap(this.x), snap(this.y) - 4, 'hw_lash_e', `${this.enraged ? 'g' : 'o'}0`)
        .setOrigin(18 / LASH_W, 0.5)
        .setFlipX(f < 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(this.y + 2);
      this.enter('attack', this.quick(LASH_HOLD));
      sound.whirl(w.pan(this.x));
      return;
    }
    if (this.skill === 'bombs') {
      this.clearOrb();
      this.hold('throw1');
      const s = this.sceptre(false);
      const n = this.enraged ? 5 : 3;
      const dmg = mobHit('pumpkin_king', this.enraged ? 0.85 : 0.75);
      let placed = 0;
      for (let tries = 0; placed < n && tries < n * 5; tries++) {
        // The first right where the hero stood, the rest round them.
        let x = this.aim.x;
        let y = this.aim.y;
        if (placed > 0) {
          const a = Math.random() * Math.PI * 2;
          const r = 28 + Math.random() * 40;
          x += Math.cos(a) * r;
          y += Math.sin(a) * r * 0.7;
          if (!w.walkable(x, y)) continue;
        }
        w.addEffect(new PumpkinBomb(w, s.x, this.y, this.y - s.y, x, y, placed * BOMB_GAP, BOMB_FLIGHT + placed * 60, dmg, this.enraged));
        placed++;
      }
      w.debris(this.tints, snap(s.x), snap(s.y), 14, this.y + 2);
      this.enter('attack', 600);
      sound.toss(w.pan(this.x), true);
      return;
    }
    // Pumpkin Patch: sprouts between him and the hero, fanned apart.
    const aim = Math.atan2(target.y - this.y, target.x - this.x);
    const n = SUMMON_COUNT + (this.enraged ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const a = aim + (k - (n - 1) / 2) * 0.9;
      let x = this.x + Math.cos(a) * 34;
      let y = this.y + Math.sin(a) * 24;
      if (!w.walkable(x, y)) {
        x = this.x + Math.cos(a) * 16;
        y = this.y + Math.sin(a) * 12;
        if (!w.walkable(x, y)) continue;
      }
      w.addEffect(new Sprout(w, x, y, SPROUT_GROW + k * 120, (sx, sy) => this.sprout(sx, sy)));
    }
    this.summonT = SUMMON_REST;
    w.cameras.main.shake(160, 0.0016);
    sound.thud(w.pan(this.x), true);
    this.enter('attack', 700);
  }

  /** A gourdling comes up where the vines grew, and goes straight for the heroes. */
  private sprout(x: number, y: number): void {
    if (this.dead || this.state === 'dying') return;
    const patch = new Spawner(this.world, [{ kind: 'gourdling', x, y, lives: 0 }]);
    for (const m of patch.monsters) {
      m.hunter = true;
      m.summoned = true;
    }
    this.world.spawnerList.push(patch);
    this.patches.push(patch);
  }

  /** Let go of his patches once their gourdlings have all fallen. */
  private prune(): void {
    if (!this.patches.length) return;
    this.patches = this.patches.filter((p) => {
      if (p.monsters.length) return true;
      const list = this.world.spawnerList;
      const i = list.indexOf(p);
      if (i >= 0) list.splice(i, 1);
      return false;
    });
  }

  /** The spell is spent: a breather, the one safe window to strike hard. */
  private rest(): void {
    this.clearLash();
    this.enter('recover', this.quick(RECOVER));
    this.play('idle', true);
    this.cooldown = (this.enraged ? 700 : 1100) + Math.random() * 700;
  }

  protected afterHit(): void {
    if (!this.enraged && this.alive && this.hp < this.maxHp / 2) {
      this.enraged = true;
      const w = this.world;
      this.halo.setTint(GHOST_GREEN);
      this.light.setColor(0x6aff9a);
      this.embers.setParticleTint(KING_GHOST_TINTS[0]);
      this.embers.frequency = 50;
      this.play('idle', true);
      // Bats come wheeling round his head.
      for (let k = 0; k < 5; k++) {
        const s = w.add.sprite(this.x, this.y, 'hexbat', 'fly0_r').setPipeline('Lit').setScale(0.6);
        this.bats.push({ s, a: (k / 5) * Math.PI * 2, r: 24 + (k % 2) * 8, h: 4 + (k % 3) * 5 });
      }
      w.popNumber(snap(this.x), snap(this.y) - 108, 'ENRAGED', 0x9affb0);
      w.debris(KING_GHOST_TINTS, snap(this.x), snap(this.y - HEAD_Y), 30, this.y + 40, 'spores');
      w.cameras.main.shake(240, 0.0028);
      sound.wail(w.pan(this.x));
    }
  }

  /** Raising his sceptre to call up his patch. */
  protected flourish(): void {
    this.play('summon', true);
  }

  protected staggers(): boolean {
    return false;
  }

  protected onDeath(): void {
    const w = this.world;
    const x = this.x;
    const y = this.y;
    // His head bursts: fire, seeds and a shower of candy-coloured sparks.
    for (let i = 0; i < 6; i++) {
      w.time.delayedCall(i * 140, () => {
        const px = snap(x + (Math.random() - 0.5) * 44);
        const py = snap(y - HEAD_Y + (Math.random() - 0.5) * 50);
        w.debris(i % 2 ? KING_GHOST_TINTS : KING_FIRE_TINTS, px, py, 24, y + 40);
        w.debris(CANDY_TINTS, px, py, 16, y + 40, 'spores');
        if (i % 2 === 0) w.debris(SEED_TINTS, px, py, 12, y + 40);
      });
    }
    w.cameras.main.flash(400, 255, 170, 80);
    w.cameras.main.shake(450, 0.004);
    w.popNumber(snap(x), snap(y) - 108, 'SNUFFED OUT', 0xffd060);
    sound.nova();
  }

  private clearRing(): void {
    this.ring?.destroy();
    this.ring = null;
  }

  private clearLash(): void {
    this.lash?.destroy();
    this.lash = null;
  }

  private clearOrb(): void {
    this.orb?.destroy();
    this.orb = null;
  }

  protected onInterrupted(): void {
    this.clearRing();
    this.clearLash();
    this.clearOrb();
  }

  destroy(): void {
    if (this.dead) return;
    super.destroy();
    this.bossBar.destroy();
    this.halo.destroy();
    this.embers.destroy();
    for (const b of this.bats) b.s.destroy();
    this.bats = [];
    this.world.lights.removeLight(this.light);
    // His gourdlings fight on; their patches go once they fall.
    this.prune();
  }
}
