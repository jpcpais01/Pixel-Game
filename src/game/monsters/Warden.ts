import Phaser from 'phaser';
import { WARDEN_TINTS } from '../../art/warden';
import { METEOR_H } from '../../art/cosmos';
import { snap } from '../display';
import { sound } from '../../audio';
import { BossBar } from '../BossBar';
import type { Effect } from '../Slash';
import type { Hit } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { COSMOS_CX, COSMOS_CY, COSMOS_RX, COSMOS_RY, cosmosSpot } from '../../world/cosmosLayout';
import { Monster, type Target } from './Monster';

/** The heart's height above the feet, in the frame (before hovering). */
const HEART_Y = 56;
const HOVER = 10;

// Starfall: the Warden raises its hands and stars rain down in waves on
// marked spots, most of them around the hero.
const CALL_TIME = 1000;
const WAVE_GAP = 720;
const MARK_TIME = 1000;
const FALL_TIME = 260;
const STAR_RX = 20;
const STAR_RY = 11;

// Singularity Nova: a black hole forms at its heart and drags the hero in,
// then bursts. Anyone still inside the ring is thrown out, badly hurt.
const GATHER_TIME = 2600;
const NOVA_RX = 92;
const NOVA_RY = 62;
const NOVA_TIME = 650;
const RECOVER = 1100;

type Skill = 'starfall' | 'nova';

/** One falling star: a mark on the ground, a column of light, then the strike. */
class FallingStar implements Effect {
  dead = false;
  private t = 0;
  private landed = false;
  private mark: Phaser.GameObjects.Image;
  private fill: Phaser.GameObjects.Image;
  private column: Phaser.GameObjects.Image;
  private star: Phaser.GameObjects.Image;
  private flash: Phaser.GameObjects.Image | null = null;
  private scorch: Phaser.GameObjects.Image | null = null;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private markTime: number,
    private damage: number,
  ) {
    x = snap(x);
    y = snap(y);
    const add = world.add;
    this.mark = add.image(x, y, 'danger_ring').setTint(0xb89cff).setAlpha(0).setDepth(2).setScale(STAR_RX / 22, STAR_RY / 12);
    this.fill = add.image(x, y, 'danger_ring').setTint(0xd8c8ff).setAlpha(0).setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setScale(0);
    this.column = add.image(x, y, 'cosmos_ray', 'ray0').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xb8a8ff).setAlpha(0).setScale(0.3, 1).setDepth(9000);
    this.star = add.image(x, y, 'cosmos_meteor').setOrigin(0.5, (METEOR_H - 5.5) / METEOR_H).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(9001).setAngle(-14);
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    if (!this.landed) {
      const k = Math.min(1, t / this.markTime);
      this.mark.setAlpha(0.35 + k * 0.5 + Math.sin(t * 0.03) * 0.1);
      this.fill.setScale((STAR_RX / 22) * k, (STAR_RY / 12) * k).setAlpha(0.25 + k * 0.3);
      this.column.setAlpha(k * 0.45).setScale(0.15 + k * 0.2, 1);
      if (t > this.markTime) {
        // Falls from high up and a little to the left, along the column's slant.
        const f = Math.min(1, (t - this.markTime) / FALL_TIME);
        const h = (1 - f * f) * 190;
        this.star.setVisible(true).setPosition(snap(this.x - h * 0.25), snap(this.y - h));
        if (f >= 1) this.land();
      }
      return;
    }
    const a = t - this.markTime - FALL_TIME;
    this.flash?.setAlpha(Math.max(0, 1 - a / 260)).setScale(1.6 + a / 150);
    this.scorch?.setAlpha(Math.max(0, 0.7 * (1 - a / 900)));
    this.column.setAlpha(Math.max(0, 0.6 * (1 - a / 200)));
    if (a > 900) this.destroy();
  }

  private land(): void {
    this.landed = true;
    const { world, x, y } = this;
    this.mark.setVisible(false);
    this.fill.setVisible(false);
    this.star.setVisible(false);
    world.hurtHeroInEllipse(x, y, STAR_RX, STAR_RY, { damage: this.damage, fromX: x, fromY: y - 6, knock: 120 });
    this.flash = world.add.image(snap(x), snap(y) - 4, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xd8ccff).setDepth(y + 20);
    this.scorch = world.add.image(snap(x), snap(y), 'cosmos_pool').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8a5cff).setDepth(2).setScale(0.7);
    world.debris(WARDEN_TINTS, snap(x), snap(y) - 3, 16, y + 2);
    world.cameras.main.shake(90, 0.0012);
    sound.starImpact(world.pan(x));
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.mark, this.fill, this.column, this.star, this.flash, this.scorch]) o?.destroy();
  }
}

/**
 * The Astral Warden, the Cosmos Arena's boss. It floats over the heart of
 * the platform and never strikes with its hands; it only casts, trading
 * two great spells with a breather after each:
 *   - Starfall: waves of falling stars on marked spots, most around the hero.
 *   - Singularity Nova: a black hole at its heart drags the hero in, then
 *     bursts over a wide ring.
 * Below half health it is enraged: faster spells, more stars, a harder pull.
 * It can't be staggered or shoved.
 */
export class Warden extends Monster {
  private skill: Skill = 'starfall';
  private last: Skill = 'nova';
  private phase = Math.random() * 1000;
  private enraged = false;
  private waves = 0;
  private waveT = 0;
  private bossBar: BossBar;
  private heart: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private motes: Phaser.GameObjects.Image[] = [];
  private stars: FallingStar[] = [];
  private hole: Phaser.GameObjects.Image | null = null;
  private holeRing: Phaser.GameObjects.Image | null = null;
  private ring: Phaser.GameObjects.Image | null = null;
  private ringFill: Phaser.GameObjects.Image | null = null;
  private inflow: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private wave: Phaser.GameObjects.Image | null = null;
  private waveAge = 0;
  /** 0..1, how hard its powers are burning right now: brightens the heart and its light. */
  private power = 0;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'warden',
      hp: 1600,
      radius: 26,
      bodyY: 30,
      speed: 16,
      sight: 150,
      leash: 100000,
      mass: 40,
      barY: 72,
      debris: WARDEN_TINTS,
      noBar: true,
    });
    this.hover = HOVER;
    this.cooldown = 1400;
    this.bossBar = new BossBar(world, 'The Astral Warden');
    this.heart = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff7ad0).setAlpha(0.6);
    this.light = world.lights.addLight(x, y - HEART_Y, 150, 0xa070ff, 1.1);
    for (let i = 0; i < 3; i++) this.motes.push(world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint([0xc8e4ff, 0xffe6a0, 0xd8b8ff][i]).setScale(0.3));
  }

  get pinned(): boolean {
    return true;
  }

  private get heartX(): number {
    return this.x;
  }

  private get heartY(): number {
    return this.y - this.hover - HEART_Y;
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    this.hover = HOVER + Math.sin(this.phase * 0.0017) * 2.5;
    super.update(dt, target, daylight);
    if (this.dead) return;
    this.stars = this.stars.filter((s) => !s.dead);
    const goal = this.state === 'windup' || this.state === 'attack' ? 1 : 0;
    this.power += (goal - this.power) * Math.min(1, dt / 300);
    this.dress(dt);
    const fighting = this.state !== 'spawn' && this.state !== 'idle' && this.state !== 'wander' && this.state !== 'return';
    this.bossBar.update(dt, this.hp, this.stats.hp, fighting && this.state !== 'dying', this.enraged);
  }

  /** The heart's glow and light, the motes that orbit it, and the spells' own visuals. */
  private dress(dt: number): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const hx = snap(this.heartX);
    const hy = snap(this.heartY);
    const fade = this.state === 'dying' ? 0 : this.state === 'spawn' ? 1 - this.timer / 700 : 1;
    const pulse = 0.85 + Math.sin(this.phase * 0.004) * 0.15;
    this.heart.setPosition(hx, hy).setDepth(ry + 0.3).setScale((0.9 + this.power * 0.8) * pulse).setAlpha((0.45 + this.power * 0.4) * fade);
    this.light.setPosition(this.heartX, this.heartY + 30);
    this.light.intensity = (1.1 + this.power * 1.2) * pulse * fade;
    this.light.radius = 150 + this.power * 40;
    this.motes.forEach((m, i) => {
      const a = this.phase * 0.0016 * (i % 2 ? -1 : 1) + (i * Math.PI * 2) / 3;
      const s = Math.sin(a);
      m.setPosition(snap(this.x + Math.cos(a) * (32 + i * 4)), snap(this.heartY - 8 + s * 10 - i * 6))
        .setDepth(ry + (s > 0 ? 0.4 : -0.4))
        .setAlpha((0.55 + s * 0.25) * fade)
        .setScale(0.25 + (s + 1) * 0.06);
    });

    // The singularity grows at the heart while the Warden gathers.
    if (this.hole && this.holeRing) {
      const k = this.state === 'windup' ? 1 - this.timer / this.gatherTime : 1;
      const sc = 0.2 + k * 0.8;
      this.hole.setPosition(hx, hy).setDepth(ry + 0.35).setScale(sc);
      this.holeRing.setPosition(hx, hy).setDepth(ry + 0.36).setScale(sc * (1 + Math.sin(this.phase * 0.02) * 0.05)).setAngle(this.phase * 0.2);
      this.ring?.setPosition(rx, ry).setAlpha(0.45 + k * 0.4 + Math.sin(this.phase * 0.025) * 0.12);
      this.ringFill?.setPosition(rx, ry).setScale(k).setAlpha(0.2 + k * 0.35);
    }
    if (this.wave) {
      this.waveAge += dt;
      const t = this.waveAge / 600;
      this.wave.setPosition(rx, ry - 6).setScale(0.3 + t * 2.4, (0.3 + t * 2.4) * 0.68).setAlpha(Math.max(0, 1 - t));
      if (t >= 1) {
        this.wave.destroy();
        this.wave = null;
      }
    }
  }

  private get gatherTime(): number {
    return this.enraged ? 2200 : GATHER_TIME;
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.cooldown === 0) {
      // Alternate the two spells; a hero close in brings on the nova sooner.
      this.skill = this.last === 'starfall' || (dist < 90 && this.last !== 'nova') ? 'nova' : 'starfall';
      this.begin(target);
      return;
    }
    // Drift slowly, keeping to the middle of the platform and leaning toward the hero.
    const gx = COSMOS_CX + Phaser.Math.Clamp((target.x - COSMOS_CX) * 0.3, -COSMOS_RX * 0.28, COSMOS_RX * 0.28);
    const gy = COSMOS_CY + Phaser.Math.Clamp((target.y - COSMOS_CY) * 0.3, -COSMOS_RY * 0.28, COSMOS_RY * 0.28);
    const dx = gx - this.x;
    const dy = gy - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 6) {
      this.x += (dx / d) * this.stats.speed * (dt / 1000);
      this.y += (dy / d) * this.stats.speed * (dt / 1000);
    }
    this.play('idle');
  }

  private begin(target: Target): void {
    this.last = this.skill;
    this.face(target.x - this.x);
    if (this.skill === 'starfall') {
      this.enter('windup', CALL_TIME);
      this.play('raise', true);
      this.body.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (this.state === 'windup' && this.skill === 'starfall') this.play('call', true);
      });
      sound.starcall(this.world.pan(this.x));
      return;
    }
    this.enter('windup', this.gatherTime);
    this.play('clasp', true);
    const add = this.world.add;
    this.hole = add.image(this.x, this.y, 'cosmos_hole');
    this.holeRing = add.image(this.x, this.y, 'cosmos_hole_ring').setBlendMode(Phaser.BlendModes.ADD);
    this.ring = add.image(this.x, this.y, 'cosmos_nova_ring').setTint(0xff6ac8).setDepth(2).setAlpha(0);
    this.ringFill = add.image(this.x, this.y, 'cosmos_nova_ring').setTint(0xff9ad8).setBlendMode(Phaser.BlendModes.ADD).setDepth(2).setScale(0);
    // Motes of light streaming in from the ring's edge toward the heart.
    // It holds still while it gathers, so the emitter can work in world coordinates.
    const edge = new Phaser.Geom.Ellipse(this.x, this.y - HEART_Y * 0.4, NOVA_RX * 2, NOVA_RY * 2);
    this.inflow = add.particles(0, 0, 'spark', {
      emitZone: { type: 'edge', source: edge, quantity: 60 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      moveToX: this.heartX,
      moveToY: this.heartY,
      lifespan: 700,
      scale: { start: 0.5, end: 1 },
      alpha: { start: 0.2, end: 1 },
      tint: [0xffffff, 0xffb0e0, 0xb89cff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 30,
    }).setDepth(this.y + 0.5);
    sound.gravityWell(this.gatherTime / 1000);
  }

  protected act(dt: number, target: Target | null, _dist: number): void {
    if (!target) {
      this.onInterrupted();
      this.enter('return', 0);
      return;
    }
    if (this.skill === 'starfall') this.actStarfall(dt, target);
    else this.actNova(dt, target);
  }

  private actStarfall(dt: number, target: Target): void {
    if (this.state === 'windup') {
      // Light gathers in its raised hands.
      if (Math.random() < dt / 50) {
        const side = Math.random() < 0.5 ? -1 : 1;
        this.world.debris(WARDEN_TINTS, this.x + side * 30 + (Math.random() - 0.5) * 10, this.y - this.hover - 96 + (Math.random() - 0.5) * 10, 1, this.y + 1, 'gather');
      }
      if (this.timer <= 0) {
        this.waves = this.enraged ? 4 : 3;
        this.waveT = 0;
        this.enter('attack', this.waves * WAVE_GAP + MARK_TIME);
      }
      return;
    }
    if (this.state === 'attack') {
      this.waveT -= dt;
      if (this.waves > 0 && this.waveT <= 0) {
        this.waves--;
        this.waveT = WAVE_GAP;
        this.rain(target);
      }
      if (this.timer <= 0) this.rest();
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** One wave: a star on the hero, two close by, and the rest scattered over the platform. */
  private rain(target: Target): void {
    const n = this.enraged ? 7 : 5;
    const mark = this.enraged ? 850 : MARK_TIME;
    const dmg = this.enraged ? 20 : 16;
    for (let i = 0; i < n; i++) {
      let p: { x: number; y: number };
      if (i === 0) p = { x: target.x, y: target.y };
      else if (i < 3) {
        const a = Math.random() * Math.PI * 2;
        const r = 26 + Math.random() * 26;
        p = { x: target.x + Math.cos(a) * r, y: target.y + Math.sin(a) * r * 0.7 };
      } else p = cosmosSpot(0.9);
      const star = new FallingStar(this.world, p.x, p.y, mark + i * 40, dmg);
      this.stars.push(star);
      this.world.addEffect(star);
    }
  }

  private actNova(dt: number, target: Target): void {
    if (this.state === 'windup') {
      // Gravity: the hero is dragged toward the heart; walking away still wins, slowly.
      this.world.pullHero(this.x, this.y + 4, this.enraged ? 38 : 30, dt);
      if (this.timer <= 0) this.burst();
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) this.rest();
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
    void target;
  }

  private burst(): void {
    this.clearNova();
    this.enter('attack', NOVA_TIME);
    this.play('nova', true);
    const w = this.world;
    w.hurtHeroInEllipse(this.x, this.y, NOVA_RX, NOVA_RY, { damage: this.enraged ? 40 : 34, fromX: this.x, fromY: this.y - 20, knock: 280 });
    this.wave = w.add.image(snap(this.x), snap(this.y), 'cosmos_wave').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc8ec).setDepth(this.y + 30);
    this.waveAge = 0;
    w.debris(WARDEN_TINTS, snap(this.heartX), snap(this.heartY), 40, this.y + 40);
    w.debris([0xffffff, 0xff9ad8, 0xffe6a0], snap(this.x), snap(this.y) - 4, 30, this.y + 2, 'spores');
    w.cameras.main.flash(220, 255, 210, 250);
    w.cameras.main.shake(320, 0.004);
    sound.nova();
  }

  /** The spell is spent: a breather, the one safe window to strike hard. */
  private rest(): void {
    this.enter('recover', RECOVER);
    this.play('idle', true);
    this.cooldown = (this.enraged ? 900 : 1500) + Math.random() * 800;
  }

  hurt(hit: Hit): void {
    super.hurt(hit);
    if (!this.enraged && this.alive && this.hp < this.stats.hp / 2) {
      this.enraged = true;
      this.heart.setTint(0xff4aa8);
      this.light.setColor(0xff5ab8);
      this.world.popNumber(snap(this.x), snap(this.y) - 96, 'ENRAGED', 0xff9ad8);
      this.world.debris(WARDEN_TINTS, snap(this.heartX), snap(this.heartY), 30, this.y + 40, 'spores');
      this.world.cameras.main.shake(220, 0.0025);
    }
  }

  protected staggers(): boolean {
    return false;
  }

  protected onDeath(): void {
    const w = this.world;
    for (let i = 0; i < 3; i++) {
      w.time.delayedCall(i * 160, () => w.debris(WARDEN_TINTS, snap(this.x + (Math.random() - 0.5) * 40), snap(this.y - 20 - Math.random() * 70), 30, this.y + 40));
    }
    w.cameras.main.flash(420, 255, 240, 255);
    w.cameras.main.shake(500, 0.005);
    w.popNumber(snap(this.x), snap(this.y) - 104, 'VANQUISHED', 0xffe6a0);
    sound.nova();
  }

  private clearNova(): void {
    for (const o of [this.hole, this.holeRing, this.ring, this.ringFill]) o?.destroy();
    this.inflow?.stop();
    const f = this.inflow;
    if (f) this.world.time.delayedCall(800, () => f.destroy());
    this.hole = this.holeRing = this.ring = this.ringFill = null;
    this.inflow = null;
  }

  protected onInterrupted(): void {
    this.clearNova();
    for (const s of this.stars) s.destroy();
    this.stars = [];
  }

  destroy(): void {
    if (this.dead) return;
    super.destroy();
    this.bossBar.destroy();
    this.heart.destroy();
    this.world.lights.removeLight(this.light);
    for (const m of this.motes) m.destroy();
    this.wave?.destroy();
  }
}
