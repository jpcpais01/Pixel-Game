import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { CONSECRATE_HIT, PALADIN_H, PALADIN_ORIGIN_X, PALADIN_ORIGIN_Y, PALADIN_W, SMITE_HIT } from '../art/paladin';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { HitSpark, type Effect } from './Slash';
import { Aegis, HealPop, HOLY_FX, Sanctuary, SmiteBurst } from './Holy';
import type { Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

const SPEED = 54; // world px / second: plate is heavy
export const MAX_HP = 120;
/** Healing past full health becomes a barrier, up to this much. */
const BARRIER_MAX = 60;
/** Barrier lost per second once he leaves the consecrated ground. */
const BARRIER_DECAY = 6;
const SMITE_HEAL = 4; // per foe struck
const SPECIAL_COOLDOWN = 9000;
const SANCTUARY_TIME = 5000;
const SANCTUARY_RADIUS = 30;
const PULSE_EVERY = 700;
const PULSE_HEAL = 9;

const HEAL_TINT = 0xa6f27c;
const BARRIER_TINT = 0xffd35c;

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

/** Where the mace lands, from the feet, for each facing. */
const REACH: Record<Dir, { x: number; y: number }> = {
  down: { x: -2, y: 7 },
  up: { x: 1, y: -9 },
  left: { x: -12, y: 1 },
  right: { x: 12, y: 1 },
};

type State = 'free' | 'smite' | 'consecrate';

/**
 * The paladin, a holy tank: an overhead mace smite that heals him a little
 * for each foe it strikes, and a special that consecrates the ground around
 * him, burning foes and healing whoever stands in it. Healing beyond full
 * health becomes a barrier of light.
 */
export class Paladin implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals = new Vitals(MAX_HP, BARRIER_MAX);
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  /** A faint holy light so he can be made out at night away from the fires. */
  private aura: Phaser.GameObjects.Light;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private aegis: Aegis;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private cooldown = 0;
  private specialCd = 0;
  private struck = false;
  private sanctuary: Sanctuary | null = null;
  private pulseIn = 0;
  private fx: Effect[] = [];

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number) {
    this.world = world;
    this.x = x;
    this.y = y;
    const ox = PALADIN_ORIGIN_X / PALADIN_W;
    const oy = PALADIN_ORIGIN_Y / PALADIN_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, 'paladin_s', 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, 'paladin', 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, 'paladin_e', 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 56, 0xfff0c8, 0);
    this.motes = world.add.particles(0, 0, 'spark', {
      lifespan: { min: 500, max: 900 },
      speedY: { min: -26, max: -10 },
      speedX: { min: -6, max: 6 },
      scale: 0.5,
      alpha: { start: 1, end: 0 },
      tint: [0xfffdf0, 0xc8ff9a, 0xffd35c],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.aegis = new Aegis(world);
    this.body.play('paladin_idle_down');

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if ((this.state === 'smite' && anim.key.startsWith('paladin_smite')) || (this.state === 'consecrate' && anim.key.startsWith('paladin_consecrate'))) {
        this.cooldown = this.state === 'smite' ? 110 : 0;
        this.state = 'free';
        this.body.play(`paladin_idle_${this.dir}`);
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith('paladin_walk') && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    // The special button's "firing" look is shared state; don't leave it lit.
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (beamHud.firing = false));
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle): void {
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.startConsecrate();
      else if (attack) this.startSmite();
    }

    const speed = { free: SPEED * Math.min(1, len), smite: SPEED * 0.25, consecrate: SPEED * 0.1 }[this.state];
    const vx = moving ? (mx / len) * speed : 0;
    const vy = moving ? (my / len) * speed : 0;
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      if (moving) this.dir = dirOf(mx, my);
      const key = `paladin_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      const f = this.body.anims.currentFrame;
      const hitAt = this.state === 'smite' ? SMITE_HIT : CONSECRATE_HIT;
      if (!this.struck && f && f.index - 1 >= hitAt) {
        this.struck = true;
        if (this.state === 'smite') this.land();
        else this.slam();
      }
    }

    this.updateSanctuary(dt);
    this.sync(dt);
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.updateHud();
  }

  /** Healing: first to health, the rest to the barrier. */
  heal(amount: number): void {
    if (!this.vitals.alive) return;
    const toHp = this.vitals.heal(amount);
    const x = snap(this.x) + Math.round((Math.random() - 0.5) * 8);
    this.fx.push(new HealPop(this.world, x, snap(this.y) - 35, `+${amount}`, toHp > 0 ? HEAL_TINT : BARRIER_TINT));
    this.motes.setDepth(snap(this.y) + 0.5).explode(5, snap(this.x), snap(this.y) - 6);
  }

  private startSmite(): void {
    this.state = 'smite';
    this.struck = false;
    this.dir = dirOf(this.lastMove.x, this.lastMove.y);
    this.body.play(`paladin_smite_${this.dir}`);
    sound.swing(3, this.world.pan(this.x));
  }

  /** The mace comes down: a burst of light where it lands, striking whatever is there. */
  private land(): void {
    const r = REACH[this.dir];
    const gx = snap(this.x) + r.x;
    const gy = snap(this.y) + r.y;
    this.fx.push(new SmiteBurst(this.world, gx, gy));
    const hits = this.world.melee({ kind: 'circle', x: gx, y: gy - 6, radius: 11 }, { damage: 15, heavy: true });
    for (const h of hits) this.fx.push(new HitSpark(this.world, h.x, h.y, HOLY_FX, h.y + 13, true));
    sound.smite(this.world.pan(gx), hits.length > 0);
    this.world.cameras.main.shake(hits.length ? 110 : 60, hits.length ? 0.0005 : 0.0002);
    if (hits.length) this.heal(SMITE_HEAL * hits.length);
  }

  private startConsecrate(): void {
    this.state = 'consecrate';
    this.struck = false;
    this.dir = dirOf(this.lastMove.x, this.lastMove.y);
    this.body.play(`paladin_consecrate_${this.dir}`);
    sound.hallow();
  }

  /** The blessed mace strikes the ground and consecrates it. */
  private slam(): void {
    const x = snap(this.x);
    const y = snap(this.y);
    const r = REACH[this.dir];
    this.sanctuary?.destroy();
    this.sanctuary = new Sanctuary(this.world, x, y, SANCTUARY_RADIUS, SANCTUARY_TIME);
    this.pulseIn = PULSE_EVERY * 0.6;
    this.fx.push(new SmiteBurst(this.world, x + r.x * 0.6, y + r.y * 0.6, true));
    const hits = this.world.melee({ kind: 'circle', x, y: y - 6, radius: SANCTUARY_RADIUS }, { damage: 12, heavy: true, knock: 150 });
    for (const h of hits) this.fx.push(new HitSpark(this.world, h.x, h.y, HOLY_FX, h.y + 13, true));
    sound.consecrate(this.world.pan(x));
    this.world.cameras.main.shake(200, 0.0006);
    this.specialCd = SPECIAL_COOLDOWN;
  }

  private updateSanctuary(dt: number): void {
    const s = this.sanctuary;
    if (s) {
      s.update(dt);
      this.pulseIn -= dt;
      if (!s.dead && this.pulseIn <= 0) {
        this.pulseIn += PULSE_EVERY;
        s.pulse();
        // Foes inside burn; the paladin (and, later, his allies) are healed.
        const hits = this.world.melee({ kind: 'circle', x: s.x, y: s.y - 6, radius: s.radius - 4 }, { damage: 4, knock: 0 });
        for (const h of hits) this.fx.push(new HitSpark(this.world, h.x, h.y, HOLY_FX, h.y + 13));
        if (s.contains(this.x, this.y)) {
          this.heal(PULSE_HEAL);
          sound.heal(this.world.pan(this.x));
        }
      }
      if (s.dead) this.sanctuary = null;
    } else {
      this.vitals.barrier = Math.max(0, this.vitals.barrier - (BARRIER_DECAY * dt) / 1000);
    }
  }

  private updateHud(): void {
    // The special button's ring refills over the cooldown and glows when ready.
    beamHud.charge = 1 - this.specialCd / SPECIAL_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.sanctuary !== null;
    comboHud.hits = 0;
    comboHud.window = 0;
  }

  private sync(dt: number): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
    this.aura.setPosition(rx, ry - 14);
    this.aura.intensity = 0.55 * (1 - this.daylight) + (this.state === 'consecrate' ? 0.8 : 0);
    this.aegis.update(dt, rx, ry, (this.vitals.barrier / BARRIER_MAX) * this.alpha);
  }
}
