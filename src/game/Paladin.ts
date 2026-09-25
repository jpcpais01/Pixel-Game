import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { CONSECRATE_HIT, CRUSADER_LOOK, HOLY_LOOK, PALADIN_H, PALADIN_ORIGIN_X, PALADIN_ORIGIN_Y, PALADIN_W, SMITE_HIT, type PaladinLook } from '../art/paladin';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { HitSpark, type Effect, type Scheme } from './Slash';
import { Aegis, HealPop, HOLY_FX, Sanctuary, SmiteBurst, SUNFIRE_FX } from './Holy';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

/**
 * A paladin subtype: its look and the numbers and special it fights with.
 * The Paladin holds the line and heals; the Crusader trades some of that for
 * heavier blows and a burst of sunfire.
 */
export interface PaladinKit {
  look: PaladinLook;
  /** World px / second: plate is heavy. */
  speed: number;
  maxHp: number;
  /** Healing past full health becomes a barrier, up to this much. */
  barrierMax: number;
  smite: { damage: number; radius: number; knock?: number; heal: number; recover: number };
  /** Consecration: healing ground. Sunfall: a blast of sunfire that shields him and kindles his hammer (Zeal). */
  special: 'consecrate' | 'sunfall';
  specialCooldown: number;
  fx: Scheme;
  /** Mote colours, the night aura's colour, and the barrier shell's shaded rim and facets. */
  motes: number[];
  aura: number;
  aegis: [number, number];
}

export const HOLY_KIT: PaladinKit = {
  look: HOLY_LOOK,
  speed: 54,
  maxHp: 120,
  barrierMax: 60,
  smite: { damage: 15, radius: 11, heal: 4, recover: 110 },
  special: 'consecrate',
  specialCooldown: 9000,
  fx: HOLY_FX,
  motes: [0xfffdf0, 0xc8ff9a, 0xffd35c],
  aura: 0xfff0c8,
  aegis: [0x8cc8ff, 0xbfe0ff],
};

export const CRUSADER_KIT: PaladinKit = {
  look: CRUSADER_LOOK,
  speed: 60,
  maxHp: 105,
  barrierMax: 45,
  smite: { damage: 20, radius: 13, knock: 190, heal: 2, recover: 200 },
  special: 'sunfall',
  specialCooldown: 8000,
  fx: SUNFIRE_FX,
  motes: [0xfff8e0, 0xffd66b, 0xff9a2e],
  aura: 0xffc890,
  aegis: [0xff9a2e, 0xffc890],
};

/** Barrier lost per second once he leaves the consecrated ground (or his Zeal ends). */
const BARRIER_DECAY = 6;
const SANCTUARY_TIME = 5000;
const SANCTUARY_RADIUS = 30;
const PULSE_EVERY = 700;
const PULSE_HEAL = 9;
/** Sunfall: the blast's reach and blow, the barrier it grants, and how long his Zeal lasts. */
const SUNFALL_RADIUS = 42;
const SUNFALL_DAMAGE = 24;
const SUNFALL_BARRIER = 12;
const SUNFALL_BARRIER_PER_FOE = 6;
const ZEAL_TIME = 4500;
/** While Zealous, each smite hits this much harder and wider, and heals more. */
const ZEAL_DAMAGE = 8;
const ZEAL_RADIUS = 3;
const ZEAL_HEAL = 2;

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
 *
 * The Crusader subtype swings a warhammer: slower, harder blows that heal
 * less, and Sunfall, a wide blast of sunfire that throws foes back, wraps him
 * in a barrier and kindles his hammer for a few seconds of Zeal.
 */
export class Paladin implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals: Vitals;
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
  /** Towards the mouse on a computer (see Hero). */
  private aim: Aim | null = null;
  private cooldown = 0;
  private specialCd = 0;
  private struck = false;
  private sanctuary: Sanctuary | null = null;
  private pulseIn = 0;
  /** ms of Zeal left (Crusader). */
  private zeal = 0;
  private emberIn = 0;
  private fx: Effect[] = [];
  private readonly kit: PaladinKit;
  private readonly key: string;

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: PaladinKit = HOLY_KIT) {
    this.world = world;
    this.kit = kit;
    const key = (this.key = kit.look.key);
    this.vitals = new Vitals(kit.maxHp, kit.barrierMax);
    this.x = x;
    this.y = y;
    const ox = PALADIN_ORIGIN_X / PALADIN_W;
    const oy = PALADIN_ORIGIN_Y / PALADIN_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 56, kit.aura, 0);
    this.motes = world.add.particles(0, 0, 'spark', {
      lifespan: { min: 500, max: 900 },
      speedY: { min: -26, max: -10 },
      speedX: { min: -6, max: 6 },
      scale: 0.5,
      alpha: { start: 1, end: 0 },
      tint: kit.motes,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.aegis = new Aegis(world, kit.fx, ...kit.aegis);
    this.body.play(`${key}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if ((this.state === 'smite' && anim.key.startsWith(`${key}_smite`)) || (this.state === 'consecrate' && anim.key.startsWith(`${key}_consecrate`))) {
        this.cooldown = this.state === 'smite' ? kit.smite.recover : 0;
        this.state = 'free';
        this.body.play(`${key}_idle_${this.dir}`);
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    // The special button's "firing" look is shared state; don't leave it lit.
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (beamHud.firing = false));
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.startConsecrate();
      else if (attack) this.startSmite();
    }

    const SPEED = this.kit.speed;
    const speed = { free: SPEED * Math.min(1, len), smite: SPEED * 0.25, consecrate: SPEED * 0.1 }[this.state];
    const vx = moving ? (mx / len) * speed : 0;
    const vy = moving ? (my / len) * speed : 0;
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      if (moving) this.dir = dirOf(mx, my);
      const key = `${this.key}_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      const f = this.body.anims.currentFrame;
      const hitAt = this.state === 'smite' ? SMITE_HIT : CONSECRATE_HIT;
      if (!this.struck && f && f.index - 1 >= hitAt) {
        this.struck = true;
        if (this.state === 'smite') this.land();
        else if (this.kit.special === 'sunfall') this.sunfall();
        else this.slam();
      }
    }

    this.updateSanctuary(dt);
    this.updateZeal(dt);
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
    this.dir = this.aimDir();
    this.body.play(`${this.key}_smite_${this.dir}`);
    sound.swing(3, this.world.pan(this.x));
  }

  /** The mace (or hammer) comes down: a burst of light where it lands, striking whatever is there. */
  private land(): void {
    const r = REACH[this.dir];
    const gx = snap(this.x) + r.x;
    const gy = snap(this.y) + r.y;
    const { smite, fx } = this.kit;
    const zeal = this.zeal > 0;
    this.fx.push(new SmiteBurst(this.world, gx, gy, zeal, fx));
    const hits = this.world.melee(
      { kind: 'circle', x: gx, y: gy - 6, radius: smite.radius + (zeal ? ZEAL_RADIUS : 0) },
      { damage: smite.damage + (zeal ? ZEAL_DAMAGE : 0), heavy: true, knock: smite.knock },
    );
    for (const h of hits) this.fx.push(new HitSpark(this.world, h.x, h.y, fx, h.y + 13, true));
    sound.smite(this.world.pan(gx), hits.length > 0);
    this.world.cameras.main.shake(hits.length ? 110 : 60, hits.length ? 0.0005 : 0.0002);
    if (hits.length) this.heal((smite.heal + (zeal ? ZEAL_HEAL : 0)) * hits.length);
  }

  private startConsecrate(): void {
    this.state = 'consecrate';
    this.struck = false;
    this.dir = this.aimDir();
    this.body.play(`${this.key}_consecrate_${this.dir}`);
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
    this.specialCd = this.kit.specialCooldown;
  }

  /**
   * The Crusader's hammer strikes the ground and sunfire falls on the spot:
   * a wide blast that throws foes back, a barrier for each one caught, and
   * Zeal, which kindles his next few seconds of smites.
   */
  private sunfall(): void {
    const x = snap(this.x);
    const y = snap(this.y);
    const r = REACH[this.dir];
    this.fx.push(new SmiteBurst(this.world, x, y, true, SUNFIRE_FX, SUNFALL_RADIUS));
    this.fx.push(new SmiteBurst(this.world, x + r.x * 0.6, y + r.y * 0.6, true, SUNFIRE_FX));
    const hits = this.world.melee({ kind: 'circle', x, y: y - 6, radius: SUNFALL_RADIUS }, { damage: SUNFALL_DAMAGE, heavy: true, knock: 240, fromX: x, fromY: y - 6 });
    for (const h of hits) this.fx.push(new HitSpark(this.world, h.x, h.y, SUNFIRE_FX, h.y + 13, true));
    const shield = SUNFALL_BARRIER + SUNFALL_BARRIER_PER_FOE * hits.length;
    this.vitals.barrier = Math.min(this.vitals.barrierMax, this.vitals.barrier + shield);
    this.fx.push(new HealPop(this.world, x, y - 35, `+${shield}`, BARRIER_TINT));
    this.motes.setDepth(y + 0.5).explode(10, x, y - 8);
    this.zeal = ZEAL_TIME;
    sound.consecrate(this.world.pan(x));
    this.world.cameras.main.shake(240, 0.0008);
    this.specialCd = this.kit.specialCooldown;
  }

  /** While Zealous, embers rise off him; when it ends his barrier starts to fade. */
  private updateZeal(dt: number): void {
    if (this.zeal <= 0) return;
    this.zeal = Math.max(0, this.zeal - dt);
    this.emberIn -= dt;
    if (this.emberIn <= 0 && this.alpha > 0.5) {
      this.emberIn = 110;
      this.motes.setDepth(snap(this.y) + 0.5).explode(1, snap(this.x) + Math.round((Math.random() - 0.5) * 12), snap(this.y) - 4 - Math.random() * 18);
    }
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
    } else if (this.zeal <= 0) {
      this.vitals.barrier = Math.max(0, this.vitals.barrier - (BARRIER_DECAY * dt) / 1000);
    }
  }

  /** Which way an ability goes: at the mouse on a computer, else the way he last walked. */
  private aimDir(): Dir {
    const a = this.aim ?? this.lastMove;
    return dirOf(a.x, a.y);
  }

  private updateHud(): void {
    // The special button's ring refills over the cooldown and glows when ready.
    beamHud.charge = 1 - this.specialCd / this.kit.specialCooldown;
    beamHud.over = 0;
    beamHud.firing = this.sanctuary !== null || this.zeal > 0;
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
    this.aura.intensity = 0.55 * (1 - this.daylight) + (this.state === 'consecrate' ? 0.8 : this.zeal > 0 ? 0.45 : 0);
    this.aegis.update(dt, rx, ry, (this.vitals.barrier / this.kit.barrierMax) * this.alpha);
  }
}
