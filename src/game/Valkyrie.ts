import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { CHEST_Y, FACING_DEG, HIT_FRAME, WARRIOR_H, WARRIOR_ORIGIN_X, WARRIOR_ORIGIN_Y, WARRIOR_W } from '../art/warrior';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { HitSpark, Shockwave, SlashArc, ThrustStreak, type Effect, type Scheme } from './Slash';
import { bloom, bolt, clamp01, dither, easeOut, flare, Fx, GROUND, pal, ring, segDist, shade, type Ink, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Valkyrie: the warrior's rig in looks of its own (art/warrior.ts, the
// `valkyrie` flag), with swan wings, a winged helm and a spear. The attack is
// a three-blow spear chain that reaches further than a sword: a jab, a wide
// sweep and a lunging thrust. The ability button is her own:
//  - The Spearmaiden draws back and hurls a spear of light that pierces
//    everything along its path, then flies back to her hand, striking again.
//  - The Stormwing leaps into the air and dives on the spot she aims at,
//    landing with a stroke of lightning; and her blows arc lightning on to
//    the foes standing near whatever they strike.

/** A three-blow chain: the animations it plays, in order. */
const CHAIN = ['thrust', 'slash2', 'thrust'] as const;
/** A blow chains into the next if it starts within this long of the last. */
const COMBO_WINDOW = 2000;

const JAB = { reach: 32, radius: 6, damage: 10 };
const SWEEP = { reach: 27, spread: (120 * Math.PI) / 180, damage: 11 };
const LUNGE = { reach: 42, radius: 7, damage: 18, knock: 170 };

// The Stormwing's chain lightning off her blows.
const ARC_RANGE = 46;
const ARC_TARGETS = 2;
const ARC_DAMAGE = 5;

// The spear of light.
const THROW_SPEED = 300;
const THROW_RANGE = 125;
const RETURN_SPEED = 340;
const THROW_DAMAGE = 16;
const RETURN_DAMAGE = 9;

// The dive.
const DIVE_TIME = 380;
const DIVE_HEIGHT = 30;
const DIVE_MIN = 24;
const DIVE_MAX = 95;
const DIVE_TOUCH = 64;
const DIVE_RADIUS = 30;
const DIVE_DAMAGE = 20;
const DIVE_ARCS = 3;
const DIVE_ARC_RANGE = 70;
const DIVE_ARC_DAMAGE = 8;

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'swing' | 'rise' | 'throw' | 'dive' | 'settle';

/** How a Valkyrie look plays and what colour its light is. */
export interface ValkyrieKit {
  /** Texture and animation key. */
  key: string;
  maxHp: number;
  /** Walking speed, world px / second. */
  speed: number;
  /** The jab and the sweep. */
  swing: Scheme;
  /** The lunge and the ability. */
  heavy: Scheme;
  /** The ability's light, drawn in pixels (the spear, the lightning). */
  pal: Pal;
  /** The faint light around her at night. */
  aura: number;
  /** The Stormwing: lightning off her blows, and the dive instead of the throw. */
  storm: boolean;
  specialCooldown: number;
  /** White feathers drift down where her blows land and in the thrown spear's wake (the Swan Maiden). */
  feathers?: boolean;
  /** The feathers' own colours instead of the light's, one picked for each (the Amazon's macaw feathers). */
  featherTints?: FeatherTint[];
  /** Curtains of the aurora ripple up where her blows and her dive land (the Northlight). */
  aurora?: boolean;
}

/** A drifting feather's colours: its lit vane, its shaded vane, its tip. */
export type FeatherTint = [number, number, number];

// The Swan Maiden's drifting feathers.
const FEATHER_LIFE = 1300;
const FEATHERS_PER_HIT = 2;
const FEATHERS_PER_HEAVY = 4;
/** One feather in the thrown spear's wake every this many ms. */
const FEATHER_TRAIL_MS = 110;

// The Northlight's curtains of aurora: how long one lasts, and how wide and tall
// it stands where a blow lands and where her dive comes down.
const VEIL_LIFE = 950;
const VEIL_HIT = { w: 14, h: 20 };
const VEIL_DIVE = { w: 46, h: 44 };

export const SPEAR_KIT: ValkyrieKit = {
  key: 'valkyrie',
  maxHp: HERO_STATS['valkyrie.spear'].hp,
  speed: HERO_STATS['valkyrie.spear'].speed,
  swing: { core: 0xffffff, hot: 0xfff4d8, mid: 0xf4d890, deep: 0xb88a3a },
  heavy: { core: 0xfffdf2, hot: 0xffe6a0, mid: 0xf4c050, deep: 0xa06a1e, light: 0xffe08a },
  pal: pal(0xfffdf2, 0xffe6a0, 0xf4c050, 0xa06a1e, 0xffe08a),
  aura: 0xffe8c0,
  storm: false,
  specialCooldown: 4200,
};

export const STORM_KIT: ValkyrieKit = {
  key: 'valkyrie_storm',
  maxHp: HERO_STATS['valkyrie.storm'].hp,
  speed: HERO_STATS['valkyrie.storm'].speed,
  swing: { core: 0xffffff, hot: 0xe6f6ff, mid: 0x9fd4f7, deep: 0x4a72c8 },
  heavy: { core: 0xf2fbff, hot: 0xa8e4ff, mid: 0x5ec8ff, deep: 0x3a6ad8, light: 0x8ad8ff },
  pal: pal(0xf2fbff, 0xa8e4ff, 0x5ec8ff, 0x3a6ad8, 0x8ad8ff),
  aura: 0xc8e8ff,
  storm: true,
  specialCooldown: 4800,
};

/** The Spearmaiden's Sunshield skin: gold and ember light. */
export const SUN_KIT: ValkyrieKit = {
  ...SPEAR_KIT,
  key: 'valkyrie_sun',
  swing: { core: 0xffffff, hot: 0xfff0d0, mid: 0xffc070, deep: 0xc0602a },
  heavy: { core: 0xfffbf0, hot: 0xffd890, mid: 0xff8a4a, deep: 0xa82a1a, light: 0xffb060 },
  pal: pal(0xfffbf0, 0xffd890, 0xff8a4a, 0xa82a1a, 0xffb060),
  aura: 0xffd8a8,
};

/** The Stormwing's Raven Queen skin: violet lightning. */
export const RAVEN_KIT: ValkyrieKit = {
  ...STORM_KIT,
  key: 'valkyrie_raven',
  swing: { core: 0xffffff, hot: 0xf0e0ff, mid: 0xc8a0f7, deep: 0x6a3ac8 },
  heavy: { core: 0xf8f0ff, hot: 0xd8b0ff, mid: 0xa060ff, deep: 0x4a1a8a, light: 0xb880ff },
  pal: pal(0xf8f0ff, 0xd8b0ff, 0xa060ff, 0x4a1a8a, 0xb880ff),
  aura: 0xd8c0ff,
};

/** The Spearmaiden's Swan Maiden skin: pearl and moonlit blue, and white feathers drifting down. */
export const SWAN_KIT: ValkyrieKit = {
  ...SPEAR_KIT,
  key: 'valkyrie_swan',
  swing: { core: 0xffffff, hot: 0xf2f6ff, mid: 0xc4d8f4, deep: 0x5a82c0 },
  heavy: { core: 0xffffff, hot: 0xdfeaff, mid: 0x8cb8e8, deep: 0x2e5a9a, light: 0xb8d4ff },
  pal: pal(0xffffff, 0xdfeaff, 0x8cb8e8, 0x2e5a9a, 0xb8d4ff),
  aura: 0xd8e6ff,
  feathers: true,
};

/** The Spearmaiden's Amazon skin: bronze-gold light with jungle-green depths, and scarlet, blue and gold macaw feathers. */
export const AMAZON_KIT: ValkyrieKit = {
  ...SPEAR_KIT,
  key: 'valkyrie_amazon',
  swing: { core: 0xffffff, hot: 0xfff0c0, mid: 0xe8b450, deep: 0x2a8a48 },
  heavy: { core: 0xfffbe8, hot: 0xffe08a, mid: 0xd8a040, deep: 0x1e7a3e, light: 0xffd070 },
  pal: pal(0xfffbe8, 0xffe08a, 0xd8a040, 0x1e7a3e, 0xffd070),
  aura: 0xffe0a0,
  feathers: true,
  featherTints: [
    [0xff7a4a, 0xe83a22, 0x2e7ce4],
    [0x6ab0ff, 0x2e7ce4, 0x0e5070],
    [0xfff094, 0xf4c834, 0x2a9a4a],
  ],
};

/** The Stormwing's Northlight skin: lightning of the aurora, green running to violet, and curtains of it where she strikes. */
export const NORTH_KIT: ValkyrieKit = {
  ...STORM_KIT,
  key: 'valkyrie_north',
  swing: { core: 0xffffff, hot: 0xd8fff0, mid: 0x7af0c8, deep: 0x6a48d0 },
  heavy: { core: 0xf0fff8, hot: 0x9cffc8, mid: 0x40e0b0, deep: 0x7a3ad8, light: 0x8af0d0 },
  pal: pal(0xf0fff8, 0x9cffc8, 0x40e0b0, 0x7a3ad8, 0x8af0d0),
  aura: 0xb0ffe0,
  aurora: true,
};

export class Valkyrie implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals: Vitals;
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: ValkyrieKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private aura: Phaser.GameObjects.Light;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private clock = 0;
  private cooldown = 0;
  private specialCd = 0;

  // The chain of blows.
  private step = 0;
  private lastSwingAt = -Infinity;
  private struck = false;
  private buffered = false;
  private prevAttack = false;
  private dash = { vx: 0, vy: 0, t: 0 };

  // The ability: where it was aimed, and the dive in flight.
  private abilityAim = { x: 0, y: 1, dist: undefined as number | undefined };
  private dive = { t: 0, x0: 0, y0: 0, x1: 0, y1: 0 };
  /** Height off the ground, drawn but not walked (the dive). */
  private lift = 0;

  private fx: Effect[] = [];

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: ValkyrieKit = SPEAR_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    const key = kit.key;
    this.x = x;
    this.y = y;
    const ox = WARRIOR_ORIGIN_X / WARRIOR_W;
    const oy = WARRIOR_ORIGIN_Y / WARRIOR_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 56, kit.aura, 0);
    this.body.play(`${key}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      const k = anim.key;
      if (this.state === 'swing' && CHAIN.some((s) => k.startsWith(`${key}_${s}_`))) {
        this.state = 'free';
        this.cooldown = this.step === 3 ? 170 : 40;
        this.idle();
      } else if (this.state === 'rise' && k.startsWith(`${key}_rise_`)) {
        if (this.kit.storm) this.startDive();
        else this.startThrow();
      } else if (this.state === 'throw' && k.startsWith(`${key}_thrust_`)) {
        this.settle();
      } else if (this.state === 'settle' && k.startsWith(`${key}_settle_`)) {
        this.state = 'free';
        this.idle();
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);

    // A tap during a blow queues the next, so quick taps chain cleanly.
    const pressed = attack && !this.prevAttack;
    this.prevAttack = attack;
    if (pressed && this.state === 'swing') this.buffered = true;

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.startRise();
      else if (attack || this.buffered) this.startSwing();
    }

    const pace = this.kit.speed;
    const speed = { free: pace * Math.min(1, len), swing: pace * 0.3, rise: pace * 0.15, throw: pace * 0.15, dive: 0, settle: pace * 0.2 }[this.state];
    let vx = moving ? (mx / len) * speed : 0;
    let vy = moving ? (my / len) * speed : 0;
    if (this.dash.t > 0) {
      vx += this.dash.vx;
      vy += this.dash.vy;
      this.dash.t -= dt;
    }
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_walk_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else if (this.state === 'swing' || this.state === 'throw') {
      const f = this.body.anims.currentFrame;
      const hitAt = HIT_FRAME[this.state === 'throw' ? 'thrust' : CHAIN[this.step - 1]];
      if (!this.struck && f && f.index - 1 >= hitAt) {
        this.struck = true;
        if (this.state === 'throw') this.loose();
        else this.land();
      }
    } else if (this.state === 'dive') {
      this.updateDive(dt);
    }

    this.sync();
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.updateHud();
  }

  private idle(): void {
    this.body.play(`${this.kit.key}_idle_${this.dir}`);
  }

  // -------------------------------------------------------------------------
  // The chain of blows

  private startSwing(): void {
    const chain = this.step > 0 && this.step < 3 && this.clock - this.lastSwingAt <= COMBO_WINDOW;
    this.step = chain ? this.step + 1 : 1;
    this.lastSwingAt = this.clock;
    this.buffered = false;
    this.struck = false;
    this.state = 'swing';
    this.dir = this.aimDir();
    this.body.play(`${this.kit.key}_${CHAIN[this.step - 1]}_${this.dir}`);
    sound.swing(this.step, this.world.pan(this.x));
    if (this.step === 2) {
      const u = this.facing();
      this.dash = { vx: u.x * 40, vy: u.y * 40, t: 110 };
    }
  }

  /** The blow lands: draw it and strike whatever the spear reaches. */
  private land(): void {
    const cx = snap(this.x);
    const cy = snap(this.y) - CHEST_Y;
    const depth = snap(this.y);
    const u = this.facing();
    const w = this.world;
    if (this.step === 2) {
      // The sweep: the spear's head swung wide across the front.
      const deg = FACING_DEG[this.dir];
      const hand = this.dir === 'right' ? 1 : -1;
      this.fx.push(new SlashArc(w, cx, cy, deg + hand * 110, deg - hand * 110, 22, this.kit.swing, depth));
      const hits = w.melee({ kind: 'arc', x: cx, y: cy, radius: SWEEP.reach, angle: (deg * Math.PI) / 180, spread: SWEEP.spread / 2 }, { damage: SWEEP.damage });
      this.impact(hits, this.kit.swing, false);
      return;
    }
    const lunge = this.step === 3;
    const b = lunge ? LUNGE : JAB;
    this.fx.push(new ThrustStreak(w, cx, cy, u.x, u.y, b.reach - 4, lunge ? this.kit.heavy : this.kit.swing, depth));
    if (lunge) this.dash = { vx: u.x * 130, vy: u.y * 130, t: 110 };
    const hits = w.melee(
      { kind: 'line', x0: cx, y0: cy, x1: cx + u.x * b.reach, y1: cy + u.y * b.reach, radius: b.radius },
      lunge ? { damage: LUNGE.damage, heavy: true, knock: LUNGE.knock } : { damage: JAB.damage, knock: 70 },
    );
    this.impact(hits, lunge ? this.kit.heavy : this.kit.swing, lunge);
  }

  private impact(hits: { x: number; y: number }[], scheme: Scheme, heavy: boolean): void {
    for (const h of hits) {
      this.fx.push(new HitSpark(this.world, h.x, h.y, scheme, h.y + 13, heavy));
      sound.clash(this.world.pan(h.x), heavy);
    }
    if (hits.length) this.world.cameras.main.shake(heavy ? 110 : 70, heavy ? 0.0005 : 0.0003);
    if (this.kit.feathers && hits.length) this.world.addEffect(new DriftFeathers(this.world, hits[0].x, hits[0].y - 12, heavy ? FEATHERS_PER_HEAVY : FEATHERS_PER_HIT, this.kit.pal, this.kit.featherTints));
    if (this.kit.aurora && hits.length) this.world.addEffect(new AuroraVeil(this.world, hits[0].x, hits[0].y + 2, VEIL_HIT.w * (heavy ? 1.4 : 1), VEIL_HIT.h * (heavy ? 1.3 : 1), this.kit.pal));
    if (this.kit.storm && hits.length) arcFrom(this.world, hits[0].x, hits[0].y, ARC_RANGE, ARC_TARGETS, ARC_DAMAGE, this.kit.pal);
  }

  // -------------------------------------------------------------------------
  // The ability

  private startRise(): void {
    this.state = 'rise';
    this.step = 0;
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    this.abilityAim = { x: a.x / l, y: a.y / l, dist: this.aim?.dist };
    this.dir = dirOf(a.x, a.y);
    this.body.play(`${this.kit.key}_rise_${this.dir}`);
    sound.rise();
  }

  /** The Spearmaiden draws back and hurls: the thrust carries the spear of light away. */
  private startThrow(): void {
    this.state = 'throw';
    this.struck = false;
    this.body.play(`${this.kit.key}_thrust_${this.dir}`);
  }

  private loose(): void {
    const a = this.abilityAim;
    const x = this.x + a.x * 6;
    const y = this.y - CHEST_Y + a.y * 4;
    this.world.addEffect(new ThrownSpear(this.world, this, x, y, a.x, a.y, this.kit.pal, this.kit.heavy, !!this.kit.feathers, this.kit.featherTints));
    sound.windDash(this.world.pan(x));
    this.specialCd = this.kit.specialCooldown;
  }

  /** The Stormwing springs into the air toward where she aims. */
  private startDive(): void {
    this.state = 'dive';
    this.body.anims.stop();
    const a = this.abilityAim;
    const want = a.dist === undefined ? DIVE_TOUCH : Phaser.Math.Clamp(a.dist, DIVE_MIN, DIVE_MAX);
    // The mouse is aimed from the chest; the spot is on the ground under it.
    const tx = this.x + a.x * want;
    const ty = this.y + a.y * want - (a.dist === undefined ? 0 : CHEST_Y);
    // Only as far as there is ground to land on.
    let end = { x: this.x, y: this.y };
    const len = Math.hypot(tx - this.x, ty - this.y);
    const steps = Math.ceil(len / 4);
    for (let i = 1; i <= steps; i++) {
      const x = this.x + ((tx - this.x) * i) / steps;
      const y = this.y + ((ty - this.y) * i) / steps;
      if (!this.world.walkable(x, y)) break;
      end = { x, y };
    }
    this.dive = { t: 0, x0: this.x, y0: this.y, x1: end.x, y1: end.y };
    this.world.evade(DIVE_TIME + 120);
    this.world.debris(this.kit.pal.tints, this.x, this.y - 4, 10, this.y + 20, 'burst');
    sound.windDash(this.world.pan(this.x));
  }

  private updateDive(dt: number): void {
    const d = this.dive;
    d.t += dt;
    const k = clamp01(d.t / DIVE_TIME);
    // Up quickly, then a steep plunge onto the spot.
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    this.x = d.x0 + (d.x1 - d.x0) * e;
    this.y = d.y0 + (d.y1 - d.y0) * e;
    this.lift = DIVE_HEIGHT * Math.sin(Math.min(1, k * 1.3) * Math.PI * 0.9) * (1 - Math.max(0, k - 0.75) * 4);
    if (Math.floor(d.t / 30) !== Math.floor((d.t - dt) / 30)) this.world.debris([this.kit.pal.hot, this.kit.pal.mid], this.x, this.y - this.lift - 10, 1, this.y + 20, 'trail');
    if (k >= 1) this.landDive();
  }

  /** She comes down with the storm: lightning strikes where she lands and leaps to the foes around. */
  private landDive(): void {
    this.lift = 0;
    const w = this.world;
    const x = snap(this.x);
    const y = snap(this.y);
    w.addEffect(new Thunderbolt(w, x, y, this.kit.pal, DIVE_RADIUS));
    if (this.kit.aurora) w.addEffect(new AuroraVeil(w, x, y + 4, VEIL_DIVE.w, VEIL_DIVE.h, this.kit.pal));
    this.fx.push(new Shockwave(w, x, y - 1, DIVE_RADIUS + 6, this.kit.heavy));
    const hits = w.melee({ kind: 'circle', x, y: y - 6, radius: DIVE_RADIUS }, { damage: DIVE_DAMAGE, heavy: true, knock: 160, fromX: x, fromY: y });
    for (const h of hits) this.fx.push(new HitSpark(w, h.x, h.y, this.kit.heavy, h.y + 13, true));
    arcFrom(w, x, y - 8, DIVE_ARC_RANGE, DIVE_ARCS, DIVE_ARC_DAMAGE, this.kit.pal, DIVE_RADIUS);
    w.cameras.main.shake(200, 0.0012);
    sound.slam(w.pan(x));
    sound.arrowHit(w.pan(x), true);
    this.specialCd = this.kit.specialCooldown;
    this.settle();
  }

  private settle(): void {
    this.state = 'settle';
    this.body.play(`${this.kit.key}_settle_${this.dir}`);
  }

  /** Which way an ability goes: at the mouse on a computer, else the way she last walked. */
  private aimDir(): Dir {
    const a = this.aim ?? this.lastMove;
    return dirOf(a.x, a.y);
  }

  private facing(): { x: number; y: number } {
    const a = (FACING_DEG[this.dir] * Math.PI) / 180;
    return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.specialCd / this.kit.specialCooldown;
    beamHud.over = 0;
    beamHud.firing = this.state === 'dive';
    const since = this.clock - this.lastSwingAt;
    comboHud.hits = this.step;
    comboHud.window = this.step === 0 ? 0 : this.step < 3 ? Math.max(0, 1 - since / COMBO_WINDOW) : Math.max(0, 1 - since / 700);
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const up = snap(this.lift);
    const frame = this.body.frame.name;
    this.body.setPosition(rx, ry - up).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry - up).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    // The shadow stays on the ground, shrinking as she rises.
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha).setScale(1 - up / 70);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha * (1 - up / 40));
    this.aura.setPosition(rx, ry - 14 - up);
    this.aura.intensity = 0.55 * (1 - this.daylight) + (this.state === 'dive' ? 0.8 : 0);
  }
}

/**
 * Lightning leaps from (x, y) to up to `n` of the nearest foes within `range`
 * (skipping any within `skip` px, already struck), each taking `damage`.
 */
function arcFrom(world: WorldScene, x: number, y: number, range: number, n: number, damage: number, p: Pal, skip = 8): void {
  const near = world
    .hurtboxesWhere((h) => {
      if (!h.alive) return false;
      const d = Math.hypot(h.x - x, h.y - h.bodyY - y);
      return d > skip && d <= range;
    })
    .sort((a, b) => Math.hypot(a.x - x, a.y - a.bodyY - y) - Math.hypot(b.x - x, b.y - b.bodyY - y))
    .slice(0, n);
  for (const h of near) {
    h.hurt({ damage, heavy: false, knock: 30, fromX: x, fromY: y });
    h.slow?.(0.7, 400, p.hot);
    world.addEffect(new ChainBolt(world, x, y, h, p));
  }
  if (near.length) sound.arrowHit(world.pan(x), true);
}

/** A crackling arc of lightning from a point to a foe, flickering out. */
class ChainBolt extends Fx {
  private g: Ink;
  private tx: number;
  private ty: number;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    h: Hurtbox,
    private p: Pal,
  ) {
    super(world, 220);
    this.tx = h.x;
    this.ty = h.y - h.bodyY;
    const w = Math.ceil(Math.abs(this.tx - x) + 16);
    const hh = Math.ceil(Math.abs(this.ty - y) + 16);
    this.g = this.ink(w, hh);
    world.debris(p.tints, this.tx, this.ty, 4, h.y + 20, 'spores');
  }

  protected step(): void {
    const { x, y, tx, ty, p, t } = this;
    const a = 1 - clamp01((t - 90) / 130);
    const g = this.g.begin((x + tx) / 2, (y + ty) / 2, Math.max(y, ty) + 20);
    bolt(g, x, y, tx, ty, p, Math.floor(t / 45), a, 0.6);
    g.end();
  }
}

/** A stroke of lightning out of the sky onto (x, y), and a ring of it along the ground. */
export class Thunderbolt extends Fx {
  private sky: Ink;
  private ground: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
    private r: number,
  ) {
    super(world, 420);
    this.sky = this.ink(30, 150);
    this.ground = this.ink(Math.ceil(r * 2 + 16), Math.ceil(r * 2 * GROUND + 16));
    flare(world, x, y - 30, 200, p.light, 4, 450);
    bloom(world, x, y - 20, p.hot, 2.4, 300, y + 30);
    world.debris(p.tints, x, y - 4, 20, y + 20, 'burst');
  }

  protected step(): void {
    const { x, y, p, t } = this;
    const a = t < 180 ? 1 : 1 - (t - 180) / 240;
    const s = this.sky.begin(x, y, y + 30, 0.5, 1);
    if (t < 260) {
      bolt(s, x + 3, y - 140, x, y, p, Math.floor(t / 40), a, 0.55);
      if (t < 120) bolt(s, x - 4, y - 120, x + 1, y - 40, p, Math.floor(t / 40) + 7, a * 0.6, 0.7);
    }
    s.end();
    const g = this.ground.begin(x, y, 2.6);
    const k = t / this.life;
    ring(g, x, y, 3 + this.r * easeOut(k * 1.4), 2 * (1 - k) + 0.6, p, 1 - k);
    // Forks of lightning running out along the ground.
    if (t < 220) {
      for (let i = 0; i < 5; i++) {
        const q = (i / 5) * Math.PI * 2 + 0.4;
        bolt(g, x, y, x + Math.cos(q) * this.r * 0.9, y + Math.sin(q) * this.r * 0.9 * GROUND, p, i * 13 + Math.floor(t / 50), a * 0.8, 0.8);
      }
    }
    g.end();
  }
}

/**
 * The Spearmaiden's spear of light: flies straight out along the aim,
 * piercing everything in its path, hangs a breath at the end of its flight,
 * then turns and flies back to her, striking again on the way.
 */
class ThrownSpear extends Fx {
  private g: Ink;
  private lamp: Phaser.GameObjects.Light;
  private glow: Phaser.GameObjects.Image;
  private out = new Set<Hurtbox>();
  private back = new Set<Hurtbox>();
  private phase: 'out' | 'hang' | 'back' = 'out';
  private travelled = 0;
  private hang = 0;
  /** The way the spear points (and flies, going out). */
  private ux: number;
  private uy: number;
  private trail: { x: number; y: number }[] = [];

  constructor(
    world: WorldScene,
    private owner: { x: number; y: number },
    private x: number,
    private y: number,
    dx: number,
    dy: number,
    private p: Pal,
    private scheme: Scheme,
    private feathers = false,
    private tints?: FeatherTint[],
  ) {
    super(world, 4000);
    this.ux = dx;
    this.uy = dy;
    this.g = this.ink(64, 64);
    this.lamp = this.light(x, y, 70, p.light, 1.6);
    this.glow = this.halo(p.hot, 0.5, y + 20);
  }

  protected step(dt: number): void {
    const s = dt / 1000;
    const px = this.x;
    const py = this.y;
    if (this.phase === 'out') {
      const d = Math.min(THROW_SPEED * s, THROW_RANGE - this.travelled);
      this.x += this.ux * d;
      this.y += this.uy * d;
      this.travelled += d;
      this.pierce(px, py, this.out, THROW_DAMAGE, true);
      if (this.travelled >= THROW_RANGE || !this.inBounds()) {
        this.phase = 'hang';
        this.world.debris(this.p.tints, this.x, this.y, 6, this.y + 30, 'spores');
      }
    } else if (this.phase === 'hang') {
      this.hang += dt;
      if (this.hang >= 90) this.phase = 'back';
    } else {
      // Home to her chest, turning to point the way it flies.
      const hx = this.owner.x;
      const hy = this.owner.y - CHEST_Y;
      const dx = hx - this.x;
      const dy = hy - this.y;
      const l = Math.hypot(dx, dy);
      const step = RETURN_SPEED * s;
      if (l <= step + 4) {
        this.world.debris(this.p.tints, hx, hy, 8, this.owner.y + 20, 'gather');
        sound.clash(this.world.pan(hx), false);
        this.destroy();
        return;
      }
      const tx = dx / l;
      const ty = dy / l;
      const turn = 1 - Math.exp(-dt / 50);
      this.ux += (tx - this.ux) * turn;
      this.uy += (ty - this.uy) * turn;
      const ul = Math.hypot(this.ux, this.uy) || 1;
      this.ux /= ul;
      this.uy /= ul;
      this.x += tx * step;
      this.y += ty * step;
      this.pierce(px, py, this.back, RETURN_DAMAGE, false);
    }
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.shift();
    if (Math.floor(this.t / 35) !== Math.floor((this.t - dt) / 35)) this.world.debris([this.p.hot, this.p.mid], this.x - this.ux * 10, this.y - this.uy * 10, 1, this.y + 30, 'trail');
    if (this.feathers && this.phase !== 'hang' && Math.floor(this.t / FEATHER_TRAIL_MS) !== Math.floor((this.t - dt) / FEATHER_TRAIL_MS)) {
      this.world.addEffect(new DriftFeathers(this.world, this.x - this.ux * 12, this.y - this.uy * 12, 1, this.p, this.tints));
    }
    this.draw();
  }

  private inBounds(): boolean {
    return this.world.walkable(this.x, this.y + CHEST_Y) || this.travelled < 20;
  }

  /** Strike every foe the spear passed through since (px, py), once each way. */
  private pierce(px: number, py: number, struck: Set<Hurtbox>, damage: number, heavy: boolean): void {
    const w = this.world;
    for (const h of w.hurtboxesWhere((b) => b.alive && !struck.has(b) && segDist(b.x, b.y - b.bodyY, px, py, this.x, this.y) <= b.radius + 4)) {
      struck.add(h);
      h.hurt({ damage, heavy, knock: heavy ? 110 : 60, fromX: this.x - this.ux * 8, fromY: this.y - this.uy * 8 });
      w.addEffect(new HitSpark(w, h.x, h.y - h.bodyY, this.scheme, h.y + 13, heavy));
      sound.clash(w.pan(h.x), heavy);
    }
  }

  private draw(): void {
    const { x, y, ux, uy, p } = this;
    const g = this.g.begin(x, y, y + CHEST_Y + 1);
    // Fading afterimages of the head along its trail.
    this.trail.forEach((q, i) => {
      if (i === this.trail.length - 1) return;
      g.put(q.x, q.y, i > 3 ? p.mid : p.deep, 0.3 + i * 0.1);
    });
    // The shaft, 18 px behind the head.
    const px = -uy;
    const py = ux;
    for (let i = -18; i <= 0; i += 0.5) {
      const c = i > -3 ? p.hot : i > -12 ? p.mid : p.deep;
      g.put(x + ux * i, y + uy * i, c);
    }
    // The leaf-shaped head.
    for (let i = 0; i <= 6; i += 0.4) {
      const u = i / 6;
      const hw = u < 0.35 ? 0.5 + (u / 0.35) * 1.1 : (1.6 * (1 - u)) / 0.65;
      for (let sd = -hw; sd <= hw; sd += 0.5) g.put(x + ux * i + px * sd, y + uy * i + py * sd, shade(p, Math.abs(sd) / (hw + 0.5) * 0.7));
    }
    g.end();
    this.lamp.setPosition(x, y);
    this.glow.setPosition(Math.round(x + ux * 2), Math.round(y + uy * 2)).setDepth(y + CHEST_Y + 2);
  }
}

/**
 * A few small white feathers loosed at (x, y): each puffs out, then drifts
 * down rocking side to side, tipping one way and the other as it swings,
 * and fades before it reaches the ground.
 */
export class DriftFeathers extends Fx {
  private g: Ink;
  private bits: { x: number; y: number; vx: number; phase: number; rate: number; tint: FeatherTint }[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    n: number,
    p: Pal,
    /** Each feather's own colours, one picked at random for each (else the light's). */
    tints?: FeatherTint[],
  ) {
    super(world, FEATHER_LIFE);
    this.g = this.ink(48, 48);
    // Taken in turn from a random start, so a puff of three shows every colour.
    const first = Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const tint: FeatherTint = tints?.length ? tints[(first + i) % tints.length] : [p.core, p.hot, p.mid];
      this.bits.push({ x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 30, phase: Math.random() * Math.PI * 2, rate: 0.006 + Math.random() * 0.003, tint });
    }
  }

  protected step(dt: number): void {
    const { t } = this;
    const s = dt / 1000;
    const a = 1 - clamp01((t - FEATHER_LIFE * 0.6) / (FEATHER_LIFE * 0.4));
    const g = this.g.begin(this.x, this.y + 8, this.y + 26);
    for (const b of this.bits) {
      // The first puff slows quickly; then a slow fall with a swing.
      b.vx *= Math.exp(-dt / 180);
      b.x += b.vx * s;
      b.y += (t < 120 ? -10 : 13) * s;
      const swing = Math.sin(t * b.rate + b.phase);
      const fx = this.x + b.x + swing * 3;
      const fy = this.y + b.y + Math.abs(swing) * 1.2;
      // Four pixels on a slant that follows the swing: the vane lit then shaded, the tip.
      const k = swing > 0 ? 1 : -1;
      const [lit, shaded, tip] = b.tint;
      g.put(fx - k, fy - 1, lit, a);
      g.put(fx, fy, lit, a);
      g.put(fx + k, fy + 1, shaded, a);
      g.put(fx + k * 2, fy + 1, tip, a * 0.9);
      g.put(fx, fy - 1, shaded, a * 0.6);
    }
    g.end();
  }
}

/**
 * A curtain of the aurora rippling up from the ground at (x, y): a bright
 * green hem low down, going teal and then violet as it climbs, its folds
 * swaying side to side as it rises, then fading away from the top down.
 */
export class AuroraVeil extends Fx {
  private g: Ink;
  private lamp: Phaser.GameObjects.Light;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private w: number,
    private h: number,
    private p: Pal,
  ) {
    super(world, VEIL_LIFE);
    this.g = this.ink(Math.ceil(w + 12), Math.ceil(h + 8));
    this.lamp = this.light(x, y - h * 0.4, w + 30, p.light, 0.9);
  }

  protected step(): void {
    const { x, y, w, h, p, t } = this;
    const rise = easeOut(t / 260);
    // It fades from the top down: the hem lingers longest.
    const fade = clamp01((t - VEIL_LIFE * 0.4) / (VEIL_LIFE * 0.6));
    this.lamp.intensity = 0.9 * rise * (1 - fade);
    const g = this.g.begin(x, y, y + 2, 0.5, 1);
    const half = w / 2;
    for (let i = -half; i <= half; i++) {
      const edge = Math.pow(1 - Math.abs(i) / (half + 1), 0.7);
      // Each fold's height and hem rise and fall along the curtain, and travel.
      const tall = h * rise * (0.62 + 0.38 * Math.sin(i * 0.23 + t * 0.004)) * edge;
      const hem = y - 1 + Math.sin(i * 0.45 + t * 0.006) * 1.5;
      for (let v = 0; v < tall; v++) {
        const u = v / Math.max(1, tall);
        if (u > 1 - fade) break;
        const sway = Math.sin(t * 0.005 + v * 0.14 + i * 0.05) * (1 + u * 2);
        const c = v < 1 ? p.core : u < 0.3 ? p.hot : u < 0.6 ? p.mid : p.deep;
        const a = (v < 1 ? 0.9 : 0.62 * Math.pow(1 - u, 0.6)) * edge;
        // Thin it in vertical streaks, as the light hangs in rays.
        const ray = 0.55 + 0.45 * Math.sin(i * 1.7 + t * 0.002);
        if (v > 0 && dither(Math.round(x + i), Math.round(hem - v)) > ray + 0.3) continue;
        g.put(x + i + sway, hem - v, c, a);
      }
    }
    g.end();
  }
}
