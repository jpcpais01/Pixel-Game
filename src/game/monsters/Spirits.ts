import Phaser from 'phaser';
import { BANSHEE_TINTS, SHADE_TINTS, WISP_TINTS } from '../../art/ghosts';
import { snap } from '../display';
import { sound } from '../../audio';
import type { Effect } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';
import { Monster, type Target } from './Monster';

// The Spirit Dungeon's restless dead. They float (bobbing on the air, a
// little see-through, their light flickering), and each fights its own way:
// the wisp darts in, the shade reaps up close and can slip through the dark
// to close the gap, and the banshee keeps its distance and wails bolts of
// cold light.

/** A spirit's slow bob and flicker, shared by all three. */
function drift(phase: number, base: number, amp: number): number {
  return base + Math.sin(phase * 0.004) * amp;
}

// ---------------------------------------------------------------- Wisp

const WISP_WINDUP = 520;
const WISP_SPEED = 215;
const WISP_RECOVER = 700;
const WISP_DAMAGE = 8;

/**
 * The lost wisp: a small soul-flame that circles its target, flares, then
 * streaks straight through where the hero stood. Fragile: any blow knocks
 * it out of its dart.
 */
export class Wisp extends Monster {
  private phase = Math.random() * 1000;
  private spin = Math.random() < 0.5 ? 1 : -1;
  private ux = 0;
  private uy = 0;
  private struck = false;
  private halo: Phaser.GameObjects.Image;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'wisp',
      hp: 26,
      radius: 5,
      bodyY: 8,
      speed: 56,
      sight: 118,
      leash: 240,
      mass: 0.5,
      barY: 30,
      debris: WISP_TINTS,
    });
    this.hover = 8;
    this.cooldown = 800;
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6af4dc).setScale(0.45).setAlpha(0);
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    if (this.state !== 'attack') this.hover += (drift(this.phase, 8, 2) - this.hover) * Math.min(1, dt / 200);
    this.fade = 0.8 + Math.sin(this.phase * 0.011) * 0.08;
    super.update(dt, target, daylight);
    if (this.dead) return;
    const flare = this.state === 'windup' ? 1 - this.timer / WISP_WINDUP : this.state === 'attack' ? 1 : 0;
    const a = this.state === 'dying' ? 0 : this.state === 'spawn' ? 0.3 : 0.35 + flare * 0.4;
    this.halo.setPosition(snap(this.x), snap(this.y) - this.bodyY - 2).setDepth(snap(this.y) - 0.1).setAlpha(a).setScale(0.4 + flare * 0.25);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.cooldown === 0 && dist < 80) {
      this.enter('windup', WISP_WINDUP);
      this.play('windup', true);
      this.face(target.x - this.x);
      sound.buzz(this.world.pan(this.x));
      return;
    }
    // Swirl round the target, drifting in toward about 46 px.
    const rx = (target.x - this.x) / (dist || 1);
    const ry = (target.y - this.y) / (dist || 1);
    const pull = Phaser.Math.Clamp((dist - 46) / 26, -1, 1);
    const ux = rx * pull - ry * this.spin * 0.8;
    const uy = ry * pull + rx * this.spin * 0.8;
    const l = Math.hypot(ux, uy) || 1;
    this.move(dt, ux / l, uy / l, this.stats.speed);
    this.face(target.x - this.x);
    if (Math.random() < dt / 3500) this.spin = -this.spin;
  }

  protected act(dt: number, target: Target | null, dist: number): void {
    if (this.state === 'windup') {
      if (target) {
        this.face(target.x - this.x);
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const l = Math.hypot(dx, dy) || 1;
        this.ux = dx / l;
        this.uy = dy / l;
      }
      if (Math.random() < dt / 70) this.world.debris(WISP_TINTS, this.x + (Math.random() - 0.5) * 12, this.y - this.bodyY + (Math.random() - 0.5) * 10, 1, this.y + 1, 'gather');
      if (this.timer <= 0) {
        this.struck = false;
        this.enter('attack', ((Math.min(dist, 110) + 24) / WISP_SPEED) * 1000);
        this.pose('dash');
      }
    } else if (this.state === 'attack') {
      const s = (WISP_SPEED * dt) / 1000;
      this.x += this.ux * s;
      this.y += this.uy * s;
      this.hover += (4 - this.hover) * Math.min(1, dt / 80);
      if (Math.random() < dt / 30) this.world.debris(WISP_TINTS, this.x, this.y - this.bodyY, 1, this.y - 1, 'trail');
      if (!this.struck) this.struck = this.world.hurtHeroAt(this.x, this.y - this.bodyY, this.radius + 1, { damage: WISP_DAMAGE, fromX: this.x - this.ux * 12, fromY: this.y - this.uy * 12, knock: 100 });
      if (this.timer <= 0) {
        this.enter('recover', WISP_RECOVER);
        this.cooldown = 1500 + Math.random() * 1000;
        this.play('idle', true);
      }
    } else {
      this.x -= (this.ux * 16 * dt) / 1000;
      this.y -= (this.uy * 16 * dt) / 1000;
      this.play('idle');
      if (this.timer <= 0) this.enter('chase', 0);
    }
  }

  protected staggers(): boolean {
    return true;
  }

  destroy(): void {
    if (this.dead) return;
    super.destroy();
    this.halo.destroy();
  }
}

// ---------------------------------------------------------------- Shade

const SHADE_WINDUP = 540;
const SHADE_SWING = 220;
const SHADE_RECOVER = 620;
const SHADE_REACH = 15;
const SHADE_DAMAGE = 14;
/** How long it takes to slip through the dark: gone, then back. */
const BLINK_OUT = 380;
const BLINK_IN = 380;

/**
 * The hollow shade: a hooded wraith that floats straight at its target,
 * raises its sickle and reaps. When its prey keeps away, it fades into the
 * dark and forms again close by.
 */
export class Shade extends Monster {
  private phase = Math.random() * 1000;
  private mark: Phaser.GameObjects.Image | null = null;
  private blinkT = 0;
  private blinkTo: { x: number; y: number } | null = null;
  private blinkCd = 2500 + Math.random() * 2000;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'shade',
      hp: 72,
      radius: 7,
      bodyY: 12,
      speed: 40,
      sight: 128,
      leash: 260,
      mass: 1.4,
      barY: 40,
      debris: SHADE_TINTS,
    });
    this.hover = 5;
    this.cooldown = 700;
  }

  get pinned(): boolean {
    return this.blinkT > 0;
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    this.hover = drift(this.phase, 5, 1.5);
    this.blinkCd = Math.max(0, this.blinkCd - dt);
    this.fade = 0.82 + Math.sin(this.phase * 0.006) * 0.06;
    if (this.blinkT > 0) {
      // Fading out, moving unseen, then forming again.
      this.blinkT -= dt;
      const t = this.blinkT;
      if (t > BLINK_IN) this.fade *= Math.max(0, (t - BLINK_IN) / BLINK_OUT);
      else {
        if (this.blinkTo) {
          this.x = this.blinkTo.x;
          this.y = this.blinkTo.y;
          this.blinkTo = null;
          this.world.debris(SHADE_TINTS, snap(this.x), snap(this.y) - 12, 10, this.y + 1, 'spores');
        }
        this.fade *= 1 - Math.max(0, t) / BLINK_IN;
      }
    }
    super.update(dt, target, daylight);
    if (this.dead) return;
    this.mark?.setPosition(snap(this.strikeX), snap(this.strikeY) + 2);
  }

  private get strikeX(): number {
    return this.x + (this.facing === 'r' ? 11 : -11);
  }

  private get strikeY(): number {
    return this.y - 2;
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.blinkT > 0) {
      this.stand(dt);
      return;
    }
    this.face(target.x - this.x);
    if (this.cooldown === 0 && dist < 26) {
      this.enter('windup', SHADE_WINDUP);
      this.play('windup', true);
      this.mark = this.world.add.image(this.strikeX, this.strikeY, 'danger_ring').setTint(0x6af4dc).setAlpha(0.5).setDepth(2).setScale(0.75, 0.8);
      sound.swell(this.world.pan(this.x));
      return;
    }
    // Slip through the dark toward prey that keeps its distance.
    if (dist > 70 && this.blinkCd === 0) {
      const a = Math.atan2(this.y - target.y, this.x - target.x) + (Math.random() - 0.5) * 1.4;
      const to = { x: target.x + Math.cos(a) * 26, y: target.y + Math.sin(a) * 18 };
      if (this.world.walkable(to.x, to.y)) {
        this.blinkTo = to;
        this.blinkT = BLINK_OUT + BLINK_IN;
        this.blinkCd = 4500 + Math.random() * 3000;
        this.world.debris(SHADE_TINTS, snap(this.x), snap(this.y) - 12, 10, this.y + 1, 'spores');
        sound.vanish(this.world.pan(this.x));
        return;
      }
    }
    const ux = (target.x - this.x) / (dist || 1);
    const uy = (target.y - this.y) / (dist || 1);
    this.move(dt, ux, uy, this.stats.speed);
  }

  protected act(dt: number, target: Target | null): void {
    if (this.state === 'windup') {
      const t = 1 - this.timer / SHADE_WINDUP;
      this.mark?.setAlpha(0.4 + t * 0.45).setScale(0.75 + t * 0.1, 0.8 + t * 0.1);
      // It drifts in a little as it raises the sickle.
      if (target) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d > 14) {
          this.x += (dx / d) * 14 * (dt / 1000);
          this.y += (dy / d) * 14 * (dt / 1000);
        }
      }
      if (this.timer <= 0) {
        this.pose('swing');
        this.enter('attack', SHADE_SWING);
        this.world.hurtHeroInEllipse(this.strikeX, this.strikeY, SHADE_REACH, SHADE_REACH * 0.7, { damage: SHADE_DAMAGE, fromX: this.x, fromY: this.y - 10, knock: 150 });
        this.world.debris([0xeafffa, 0x6af4dc], snap(this.strikeX), snap(this.strikeY) - 8, 10, this.y + 2, 'burst');
        sound.swing(2, this.world.pan(this.x));
        this.clearMark();
      }
    } else if (this.state === 'attack') {
      if (this.timer <= 0) {
        this.enter('recover', SHADE_RECOVER);
        this.cooldown = 1300 + Math.random() * 700;
      }
    } else {
      this.stand(dt);
      if (this.timer <= 0) this.enter('chase', 0);
    }
  }

  protected staggers(): boolean {
    return this.state !== 'attack' && this.blinkT <= 0;
  }

  private clearMark(): void {
    this.mark?.destroy();
    this.mark = null;
  }

  protected onInterrupted(): void {
    this.clearMark();
  }
}

// ---------------------------------------------------------------- Banshee

const WAIL_TIME = 820;
const WAIL_RECOVER = 700;
const NEAR = 64;
const FAR = 112;

/**
 * The wailing banshee: it hangs back at a distance, and when it wails,
 * three bolts of cold light fly out in a fan. Its keening rises before each
 * wail, so a watchful player can get out of the way.
 */
export class Banshee extends Monster {
  private phase = Math.random() * 1000;
  private strafe = Math.random() < 0.5 ? 1 : -1;
  private aim = { x: 0, y: 0 };
  private halo: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'banshee',
      hp: 52,
      radius: 6,
      bodyY: 12,
      speed: 36,
      sight: 150,
      leash: 270,
      mass: 0.9,
      barY: 42,
      debris: BANSHEE_TINTS,
    });
    this.hover = 7;
    this.cooldown = 1200;
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    this.hover = drift(this.phase, 7, 2);
    this.fade = 0.78 + Math.sin(this.phase * 0.0045) * 0.08;
    super.update(dt, target, daylight);
  }

  /** Her mouth, in the world. */
  private get mouth(): { x: number; y: number } {
    return { x: this.x + (this.facing === 'r' ? 3 : -3), y: this.y - this.hover - 25 };
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    const dx = (target.x - this.x) / (dist || 1);
    const dy = (target.y - this.y) / (dist || 1);
    if (dist > FAR) this.move(dt, dx, dy, this.stats.speed);
    else if (dist < NEAR) this.move(dt, -dx * 0.8 - dy * 0.6 * this.strafe, -dy * 0.8 + dx * 0.6 * this.strafe, this.stats.speed * 1.2);
    else if (this.cooldown === 0) {
      this.enter('windup', WAIL_TIME);
      this.play('windup', true);
      this.halo = this.world.add.image(this.x, this.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8ac8ff).setAlpha(0);
      sound.soulCast(this.world.pan(this.x), false);
    } else {
      if (Math.random() < dt / 1600) this.strafe = -this.strafe;
      this.move(dt, -dy * this.strafe, dx * this.strafe, this.stats.speed * 0.6);
      this.face(target.x - this.x);
    }
  }

  protected act(dt: number, target: Target | null): void {
    if (this.state === 'windup') {
      if (target) {
        this.face(target.x - this.x);
        this.aim.x = target.x;
        this.aim.y = target.y - 11;
      }
      const t = 1 - this.timer / WAIL_TIME;
      const m = this.mouth;
      this.halo?.setPosition(snap(m.x), snap(m.y)).setDepth(snap(this.y) + 0.3).setScale(0.3 + t * 0.4).setAlpha(0.2 + t * 0.6);
      if (Math.random() < dt / 60) this.world.debris(BANSHEE_TINTS, m.x + (Math.random() - 0.5) * 14, m.y + (Math.random() - 0.5) * 12, 1, this.y + 1, 'gather');
      if (this.timer <= 0) this.wail();
    } else if (this.timer <= 0) this.enter('chase', 0);
  }

  private wail(): void {
    this.onInterrupted();
    const m = this.mouth;
    const base = Math.atan2(this.aim.y - m.y, this.aim.x - m.x);
    for (const off of [-0.26, 0, 0.26]) this.world.addEffect(new SpiritBolt(this.world, m.x, m.y, Math.cos(base + off), Math.sin(base + off)));
    this.play('cast', true);
    this.enter('recover', WAIL_RECOVER);
    this.cooldown = 2300 + Math.random() * 1000;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    sound.soulHit(this.world.pan(m.x), false);
  }

  protected staggers(): boolean {
    return true;
  }

  protected onInterrupted(): void {
    this.halo?.destroy();
    this.halo = null;
  }
}

const BOLT_SPEED = 84;
const BOLT_RANGE = 170;
const BOLT_DAMAGE = 9;

/** A bolt of the banshee's wail: an orb of cold light that flies straight and bursts on the hero. */
export class SpiritBolt implements Effect {
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
    private damage = BOLT_DAMAGE,
    private speed = BOLT_SPEED,
  ) {
    this.orb = world.add.image(x, y, 'sd_orb').setBlendMode(Phaser.BlendModes.ADD);
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6af4dc).setScale(0.5).setAlpha(0.6);
  }

  update(dt: number): void {
    if (this.dead) return;
    const s = (this.speed * dt) / 1000;
    this.x += this.ux * s;
    this.y += this.uy * s;
    this.travelled += s;
    const wob = Math.sin(this.travelled * 0.25) * 1.2;
    const depth = this.y + 16;
    const pulse = 0.9 + Math.sin(this.travelled * 0.4) * 0.1;
    this.orb.setPosition(snap(this.x), snap(this.y + wob)).setDepth(depth).setScale(pulse);
    this.halo.setPosition(this.x, this.y + wob).setDepth(depth - 0.1);
    this.trail -= dt;
    if (this.trail <= 0) {
      this.trail = 40;
      this.world.debris(BANSHEE_TINTS, this.x, this.y, 1, depth - 0.2, 'trail');
    }
    // Low on the air: it strikes the hero's body, measured from their feet.
    const hit = this.world.hurtHeroAt(this.x, this.y, 5, { damage: this.damage, fromX: this.x - this.ux * 8, fromY: this.y - this.uy * 8, knock: 80 });
    if (hit || this.travelled > BOLT_RANGE || !this.world.monsterBounds.contains(this.x, this.y)) this.burst();
  }

  private burst(): void {
    this.world.debris(BANSHEE_TINTS, this.x, this.y, 12, this.y + 16);
    sound.soulHit(this.world.pan(this.x), false);
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.orb.destroy();
    this.halo.destroy();
  }
}
