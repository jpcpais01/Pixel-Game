import { heroTimers } from './timers';
import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { INV_H, INV_HAND_Y, INV_ORIGIN_X, INV_ORIGIN_Y, INV_W, TURRET_BUILD, TURRET_FOOT, TURRET_GUN_Y, TURRET_HEADINGS, TURRET_SIZE } from '../art/inventor';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { HitSpark, Shockwave, SlashArc, type Effect, type Scheme } from './Slash';
import { bloom, clamp01, flare, Fx, line, pal, strikeGround, type Ink, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Engineer (the Inventor's base type): a tradesman with a pipe wrench
// and a crate of parts.
//  - Attack (held): the wrench, in a chain of three: a forehand sweep, a
//    backhand, and an overhead bonk that clangs down and staggers.
//  - Ability: Build Sentry. He tosses a crate at the spot he aims at; it
//    unfolds into a turret on a tripod that turns to the nearest foe and
//    shoots it, for a while. Two can stand at once; a third replaces the
//    oldest.
//  - Special: Mega Sentry (see ultimate/inventor.ts). A giant turret drops
//    from the sky, crushing what it lands on, then hoses everything near with
//    fire and rockets.
// Forgebeard plays the same: his sentries are dwarf-work of stone and brass
// with a rune for an eye, and everything he strikes or fires burns rune-orange.

const SWINGS = ['swing', 'swing2', 'bonk'] as const;
type Swing = (typeof SWINGS)[number];
/** Each swing's frames and rate, so its timing matches its animation. */
const SWING_MS: Record<Swing, number> = { swing: (4 / 11) * 1000, swing2: (4 / 11) * 1000, bonk: (5 / 11) * 1000 };
/** When the blow lands, into the swing (its release frame). */
const LAND_MS: Record<Swing, number> = { swing: (1 / 11) * 1000, swing2: (1 / 11) * 1000, bonk: (2 / 11) * 1000 };
const SWING_DAMAGE = 10;
const BONK_DAMAGE = 17;
const REACH = 22;
const COMBO_WINDOW = 520;

const BUILD_MS = (5 / 13) * 1000;
const BUILD_LAND = (2 / 13) * 1000;
const BUILD_COOLDOWN = 7000;
const BUILD_MIN = 30;
const BUILD_MAX = 95;
const BUILD_TOUCH = 60;
const MAX_TURRETS = 2;

const FOOTFALLS = new Set([1, 4]);

/** The wrench's steel and the bonk's sparks. */
const WRENCH_FX: Scheme = { core: 0xffffff, hot: 0xeef2fa, mid: 0xaab4c8, deep: 0x5a6478 };
const BONK_FX: Scheme = { core: 0xfffbe8, hot: 0xffe070, mid: 0xffa030, deep: 0xc0501a, light: 0xffc050 };

/** How a look's turrets are drawn: their sheet, and the bits they fall apart into. */
export interface TurretLook {
  texture: string;
  parts: number[];
}

export const SENTRY_LOOK: TurretLook = { texture: 'turret', parts: [0xf6cc3c, 0xaab4c8, 0x737d93, 0x7a4c26] };
export const RUNE_SENTRY_LOOK: TurretLook = { texture: 'turret_forge', parts: [0xdcae4a, 0x908c8a, 0x68666c, 0xff8030] };

export interface EngineerKit {
  key: string;
  maxHp: number;
  speed: number;
  /** The turret's tracers and the Special's blasts. */
  pal: Pal;
  /** The wrench's arc, and the bonk's ring and sparks. */
  wrench: Scheme;
  bonk: Scheme;
  /** The light he carries (the hat lamp; Forgebeard's helm rune). */
  lamp: number;
  turret: TurretLook;
}

export const ENGINEER_KIT: EngineerKit = {
  key: 'engineer',
  maxHp: HERO_STATS['inventor.engineer'].hp,
  speed: HERO_STATS['inventor.engineer'].speed,
  pal: pal(0xfffbe8, 0xffe070, 0xffa030, 0xc0501a, 0xffc050),
  wrench: WRENCH_FX,
  bonk: BONK_FX,
  lamp: 0xffe6a0,
  turret: SENTRY_LOOK,
};

/** Forgebeard: rune-orange light, a heavier iron arc, sentries of stone and brass. */
export const FORGEBEARD_KIT: EngineerKit = {
  ...ENGINEER_KIT,
  key: 'engineer_forgebeard',
  pal: pal(0xfff0d8, 0xffb050, 0xff6a1a, 0x8a2a0a, 0xff8030),
  wrench: { core: 0xfff4e8, hot: 0xd0d8e8, mid: 0x8a92a6, deep: 0x5a3018 },
  bonk: { core: 0xfff0d8, hot: 0xffb050, mid: 0xff6a1a, deep: 0x8a2a0a, light: 0xff8030 },
  lamp: 0xff9a50,
  turret: RUNE_SENTRY_LOOK,
};

export class Engineer implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: EngineerKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private lamp: Phaser.GameObjects.Light;
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private clock = 0;
  /** The move under way: a swing, the build, or nothing. */
  private move: Swing | 'build' | null = null;
  private moveT = 0;
  private landed = false;
  private step = 0;
  private lastSwingAt = -99999;
  private buildCd = 0;
  private turrets: Turret[] = [];
  private fx: Effect[] = [];
  private prevSpecial = false;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: EngineerKit = ENGINEER_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = INV_ORIGIN_X / INV_W;
    const oy = INV_ORIGIN_Y / INV_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    // The hard hat's lamp lights the way at night.
    this.lamp = world.lights.addLight(x, y, 70, kit.lamp, 0);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const t of this.turrets) t.destroy();
      for (const e of this.fx) e.destroy();
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.buildCd = Math.max(0, this.buildCd - dt);
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;

    if (this.move) {
      this.moveT += dt;
      const land = this.move === 'build' ? BUILD_LAND : LAND_MS[this.move];
      if (!this.landed && this.moveT >= land) {
        this.landed = true;
        if (this.move === 'build') this.toss();
        else this.strike(this.move);
      }
      const done = this.move === 'build' ? BUILD_MS : SWING_MS[this.move];
      if (this.moveT >= done) this.move = null;
    }
    if (!this.move) {
      if (pressed && this.buildCd === 0) this.startBuild();
      else if (attack) this.startSwing();
    }

    const pace = this.kit.speed * (this.move ? 0.45 : 1);
    if (moving) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * pace * Math.min(1, len) * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * pace * Math.min(1, len) * (dt / 1000), bounds.top, bounds.bottom);
    }
    if (!this.move) {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_walk_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    }
    this.turrets = this.turrets.filter((t) => !t.dead);
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.sync();
    this.updateHud();
  }

  // -------------------------------------------------------------------------
  // The wrench

  private startSwing(): void {
    const chain = this.step > 0 && this.step < 3 && this.clock - this.lastSwingAt <= COMBO_WINDOW + SWING_MS.swing;
    this.step = chain ? this.step + 1 : 1;
    this.lastSwingAt = this.clock;
    const s = SWINGS[this.step - 1];
    this.move = s;
    this.moveT = 0;
    this.landed = false;
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_${s}_${this.dir}`);
    sound.swing(this.step, this.world.pan(this.x));
  }

  /** The blow connects: a sweep of steel, or the bonk's clang and a ring of sparks. */
  private strike(s: Swing): void {
    const w = this.world;
    const u = this.aimVec();
    const cx = snap(this.x);
    const cy = snap(this.y) - 12;
    const depth = snap(this.y);
    if (s === 'bonk') {
      const bx = cx + u.x * 12;
      const by = cy + u.y * 10;
      this.fx.push(new Shockwave(w, snap(bx), snap(this.y + u.y * 10), 16, this.kit.bonk));
      const hits = w.melee({ kind: 'circle', x: bx, y: by, radius: 17 }, { damage: BONK_DAMAGE, heavy: true, knock: 150 });
      for (const h of hits) this.fx.push(new HitSpark(w, h.x, h.y, this.kit.bonk, h.y + 13, true));
      w.debris(this.kit.pal.tints, bx, by + 8, 8, by + 20, 'burst');
      sound.wrench(w.pan(bx), true);
      if (hits.length) w.cameras.main.shake(110, 0.0005);
      return;
    }
    const deg = (Math.atan2(u.y, u.x) * 180) / Math.PI;
    const hand = this.dir === 'right' ? -1 : 1;
    const sweep = s === 'swing' ? hand : -hand;
    this.fx.push(new SlashArc(w, cx, cy, deg + sweep * 95, deg - sweep * 95, 16, this.kit.wrench, depth));
    const hits = w.melee({ kind: 'arc', x: cx, y: cy, radius: REACH, angle: Math.atan2(u.y, u.x), spread: (110 * Math.PI) / 180 }, { damage: SWING_DAMAGE });
    for (const h of hits) {
      this.fx.push(new HitSpark(w, h.x, h.y, this.kit.wrench, h.y + 13, false));
      sound.wrench(w.pan(h.x), false);
    }
    if (hits.length) w.cameras.main.shake(70, 0.0003);
  }

  // -------------------------------------------------------------------------
  // The sentries

  private startBuild(): void {
    this.move = 'build';
    this.moveT = 0;
    this.landed = false;
    this.step = 0;
    this.buildCd = BUILD_COOLDOWN;
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_build_${this.dir}`);
  }

  /** The crate leaves his hand for the spot he aims at (not past where the ground ends). */
  private toss(): void {
    const u = this.aimVec();
    const want = this.aim?.dist === undefined ? BUILD_TOUCH : Phaser.Math.Clamp(this.aim.dist, BUILD_MIN, BUILD_MAX);
    let tx = this.x;
    let ty = this.y;
    for (let r = want; r >= 0; r -= 4) {
      tx = this.x + u.x * r;
      ty = this.y + u.y * r - (this.aim?.dist === undefined ? 0 : INV_HAND_Y * 0.5);
      if (this.world.walkable(tx, ty)) break;
    }
    if (this.turrets.length >= MAX_TURRETS) this.turrets.shift()?.expire();
    const t = new Turret(this.world, this.x + u.x * 4, this.y, tx, ty, SENTRY, this.kit.pal, this.kit.turret);
    this.turrets.push(t);
    this.world.addEffect(t);
    heroTimers.follow(t, 'ability', '', this.kit.pal.hot, () => t.timeLeft());
    sound.toss();
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.buildCd / BUILD_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = false;
    const since = this.clock - this.lastSwingAt;
    comboHud.hits = this.step;
    comboHud.max = 3;
    comboHud.window = this.step === 0 ? 0 : this.step < 3 ? Math.max(0, 1 - since / (COMBO_WINDOW + SWING_MS.swing)) : Math.max(0, 1 - since / 700);
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
    const u = this.aimVec();
    this.lamp.setPosition(rx + u.x * 16, ry - 8 + u.y * 12);
    this.lamp.intensity = 0.9 * (1 - this.daylight);
  }
}

// ---------------------------------------------------------------------------
// The turret

/** How a turret behaves: the Engineer's sentry, or the Special's giant. */
export interface TurretSpec {
  /** Drawn this many times its size. */
  scale: number;
  /** How long it stands, from when it lands. */
  life: number;
  range: number;
  /** Between shots, and each shot's damage. */
  fireMs: number;
  damage: number;
  /** The Special's also fires a rocket this often (0: none), bursting over this radius. */
  rocketMs: number;
  rocketDamage: number;
  rocketR: number;
  /** Tossed in an arc from the hand, or dropped out of the sky onto the spot (crushing what's under it). */
  drop: boolean;
  dropDamage: number;
}

export const SENTRY: TurretSpec = { scale: 1, life: 12000, range: 115, fireMs: 450, damage: 4, rocketMs: 0, rocketDamage: 0, rocketR: 0, drop: false, dropDamage: 0 };

const FLY_MS = 320;
const DROP_MS = 420;
const UNFOLD_MS = 380;
const FOLD_MS = 500;

/**
 * A sentry: flies in as a crate (or falls from the sky), unfolds on its
 * tripod, then turns to the nearest foe in reach and fires at it until its
 * time runs out, when it blinks and falls apart in a puff of parts.
 */
export class Turret implements Effect {
  dead = false;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private shade: Phaser.GameObjects.Image;
  private t = 0;
  private heading = 2;
  private fireT = 0;
  private rocketT = 0;
  private recoil = 0;
  private barrel = 0;
  private folding = -1;
  private target: Hurtbox | null = null;
  private fx: Effect[] = [];
  private readonly flyMs: number;

  constructor(
    private world: WorldScene,
    private fromX: number,
    private fromY: number,
    readonly x: number,
    readonly y: number,
    private spec: TurretSpec,
    private p: Pal,
    private look: TurretLook = SENTRY_LOOK,
  ) {
    const s = spec.scale;
    this.flyMs = spec.drop ? DROP_MS : FLY_MS;
    this.shade = world.add.image(x, y, 'shadow').setScale(0.7 * s, 0.6 * s).setAlpha(0).setDepth(1);
    this.sprite = world.add.sprite(fromX, fromY, look.texture, 'b0').setOrigin(0.5, TURRET_FOOT / TURRET_SIZE).setScale(s).setPipeline('Lit');
    this.glow = world.add.sprite(fromX, fromY, `${look.texture}_e`, 'b0').setOrigin(0.5, TURRET_FOOT / TURRET_SIZE).setScale(s).setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Time left until it folds away, for the HUD's timer. */
  timeLeft(): { left: number; total: number } | null {
    if (this.dead || this.folding >= 0) return null;
    const total = this.flyMs + UNFOLD_MS + this.spec.life;
    return { left: total - this.t, total };
  }

  /** Time's up early: fold away now. */
  expire(): void {
    if (this.folding < 0) this.folding = 0;
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const s = this.spec;
    let px = this.x;
    let py = this.y;
    let frame = 'b0';
    if (this.t < this.flyMs) {
      // In the air: an arc from the hand, or a fall from high above.
      const k = this.t / this.flyMs;
      if (s.drop) {
        py = this.y - 140 * (1 - k * k);
      } else {
        px = this.fromX + (this.x - this.fromX) * k;
        py = this.fromY + (this.y - this.fromY) * k - Math.sin(k * Math.PI) * 22;
      }
      this.shade.setAlpha(0.2 + 0.4 * k);
    } else {
      if (this.t - dt < this.flyMs) this.land();
      const since = this.t - this.flyMs;
      if (since < UNFOLD_MS) {
        frame = `b${Math.min(TURRET_BUILD - 1, Math.floor((since / UNFOLD_MS) * TURRET_BUILD))}`;
      } else {
        if (this.folding < 0 && since >= UNFOLD_MS + s.life) this.folding = 0;
        if (this.folding >= 0) {
          this.folding += dt;
          if (this.folding >= FOLD_MS) {
            this.fallApart();
            return;
          }
        } else this.fight(dt);
        this.recoil = Math.max(0, this.recoil - dt / 90);
        frame = `${this.recoil > 0.3 ? 'f' : 'h'}${this.heading}`;
      }
      this.shade.setAlpha(0.6);
    }
    const rx = snap(px);
    const ry = snap(py);
    // Folding up: it blinks out.
    const a = this.folding >= 0 ? (Math.floor(this.folding / 70) % 2 ? 0.35 : 1) : 1;
    this.sprite.setPosition(rx, ry).setDepth(snap(this.y)).setFrame(frame).setAlpha(a);
    this.glow.setPosition(rx, ry).setDepth(snap(this.y) + 0.1).setFrame(frame).setAlpha(a);
    this.shade.setPosition(snap(this.x), snap(this.y));
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
  }

  /** It hits the ground: a thud of dust, and the giant crushes what's under it. */
  private land(): void {
    const w = this.world;
    const s = this.spec;
    w.debris([0xa4703c, 0x7a4c26, 0xd8c8a0], this.x, this.y - 3, s.drop ? 18 : 6, this.y + 10, 'burst');
    if (s.drop) {
      this.fx.push(new Shockwave(w, snap(this.x), snap(this.y), 34, { core: this.p.core, hot: this.p.hot, mid: this.p.mid, deep: this.p.deep, light: this.p.light }));
      strikeGround(w, this.x, this.y, 30, { damage: s.dropDamage, heavy: true, knock: 180 });
      w.cameras.main.shake(220, 0.0008);
      sound.slam(w.pan(this.x));
    } else sound.clack(w.pan(this.x), false);
    sound.ratchet(w.pan(this.x));
  }

  /** Turn to the nearest foe in reach and fire at it. */
  private fight(dt: number): void {
    const w = this.world;
    const s = this.spec;
    const gunY = this.y - TURRET_GUN_Y * s.scale;
    if (!this.target || !this.target.alive || Math.hypot(this.target.x - this.x, this.target.y - this.y) > s.range) {
      this.target = null;
      let best = s.range;
      for (const h of w.hurtboxesWhere((b) => b.alive)) {
        const d = Math.hypot(h.x - this.x, h.y - this.y);
        if (d <= best) {
          best = d;
          this.target = h;
        }
      }
    }
    this.fireT -= dt;
    this.rocketT -= dt;
    const h = this.target;
    if (!h) return;
    const ang = Math.atan2(h.y - h.bodyY - gunY, h.x - this.x);
    this.heading = ((Math.round((ang / (Math.PI * 2)) * TURRET_HEADINGS) % TURRET_HEADINGS) + TURRET_HEADINGS) % TURRET_HEADINGS;
    const a = (this.heading / TURRET_HEADINGS) * Math.PI * 2;
    // The muzzles, turned the way it faces, firing in turn.
    this.barrel = 1 - this.barrel;
    const side = this.barrel ? 1 : -1;
    const mx = this.x + Math.cos(a) * 6 * s.scale - Math.sin(a) * 0.6 * side * s.scale;
    const my = gunY + Math.sin(a) * 0.6 * 6 * s.scale + Math.cos(a) * 0.8 * side * s.scale;
    if (this.fireT <= 0) {
      this.fireT = s.fireMs;
      this.recoil = 1;
      h.hurt({ damage: s.damage, heavy: false, knock: s.scale > 1 ? 30 : 45, fromX: this.x, fromY: this.y });
      this.fx.push(new Tracer(w, mx, my, h.x, h.y - h.bodyY, this.p, h.y));
      sound.turretShot(w.pan(this.x), s.scale > 1);
    }
    if (s.rocketMs > 0 && this.rocketT <= 0) {
      this.rocketT = s.rocketMs;
      this.fx.push(new Rocket(w, mx, my, h.x, h.y, s.rocketDamage, s.rocketR, this.p));
      sound.missile(w.pan(this.x), false);
    }
  }

  /** Its time is up: it falls apart into a puff of parts. */
  private fallApart(): void {
    const w = this.world;
    w.debris(this.look.parts, this.x, this.y - 6 * this.spec.scale, this.spec.scale > 1 ? 20 : 8, this.y + 10, 'burst');
    sound.clack(w.pan(this.x), true);
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.sprite, this.glow, this.shade]) o.destroy();
    for (const e of this.fx) e.destroy();
    this.fx = [];
  }
}

/** A shot: a streak of tracer light from the muzzle to the foe, a flash at the muzzle, sparks where it hits. */
class Tracer extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x0: number,
    private y0: number,
    private x1: number,
    private y1: number,
    private p: Pal,
    private ground: number,
  ) {
    super(world, 110);
    this.g = this.ink(Math.ceil(Math.abs(x1 - x0) + 10), Math.ceil(Math.abs(y1 - y0) + 10));
    world.debris([p.core, p.hot, p.mid], x1, y1, 3, ground + 12, 'burst');
  }

  protected step(): void {
    const { x0, y0, x1, y1, p, t } = this;
    const k = clamp01(t / 70);
    const g = this.g.begin((x0 + x1) / 2, (y0 + y1) / 2, Math.max(y0, this.ground) + 12);
    // The streak: a short bright dash running out along the line, its tail fading behind.
    const hx = x0 + (x1 - x0) * k;
    const hy = y0 + (y1 - y0) * k;
    const tx = x0 + (x1 - x0) * Math.max(0, k - 0.45);
    const ty = y0 + (y1 - y0) * Math.max(0, k - 0.45);
    line(g, tx, ty, hx, hy, p.hot, 1 - clamp01((t - 70) / 40));
    g.put(hx, hy, p.core);
    if (t < 50) {
      g.put(x0, y0, p.core);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.put(x0 + dx, y0 + dy, p.hot, 0.8);
    }
    g.end();
  }
}

/** The giant's rocket: a smoking arc to where the foe stood, and a burst there. */
class Rocket extends Fx {
  private g: Ink;
  private trail: { x: number; y: number; t: number }[] = [];
  private boomed = false;

  constructor(
    world: WorldScene,
    private x0: number,
    private y0: number,
    private x1: number,
    private y1: number,
    private damage: number,
    private r: number,
    private p: Pal,
  ) {
    super(world, 900);
    this.g = this.ink(Math.ceil(Math.abs(x1 - x0) + 80), Math.ceil(Math.abs(y1 - y0) + 90));
  }

  protected step(): void {
    const FLIGHT = 460;
    const { x0, y0, x1, y1, p } = this;
    const k = clamp01(this.t / FLIGHT);
    const x = x0 + (x1 - x0) * k;
    const y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 30;
    if (k < 1) this.trail.push({ x, y, t: this.t });
    const g = this.g.begin((x0 + x1) / 2, (y0 + y1) / 2 - 15, Math.max(y0, y1) + 14);
    for (const s of this.trail) {
      const age = this.t - s.t;
      if (age > 380) continue;
      const a = 1 - age / 380;
      g.put(s.x, s.y - age * 0.02, age < 60 ? p.hot : 0x8a8a92, a * (age < 60 ? 1 : 0.5));
    }
    if (k < 1) {
      g.put(x, y, 0xe8eef8);
      g.put(x - Math.sign(x1 - x0), y, p.core);
    } else if (!this.boomed) {
      this.boomed = true;
      const w = this.world;
      strikeGround(w, x1, y1, this.r, { damage: this.damage, heavy: true, knock: 120 });
      bloom(w, x1, y1 - 6, p.hot, 1.6, 380, y1 + 20);
      flare(w, x1, y1 - 6, 70, p.light, 2, 350);
      w.debris(p.tints, x1, y1 - 4, 12, y1 + 16, 'burst');
      sound.blast(w.pan(x1));
    }
    if (k >= 1) {
      // The burst: a ring of fire spreading on the ground.
      const b = clamp01((this.t - FLIGHT) / 260);
      const rr = this.r * (0.3 + 0.7 * b);
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        g.put(x1 + Math.cos(a) * rr, y1 + Math.sin(a) * rr * 0.58, b < 0.5 ? p.hot : p.mid, 1 - b);
      }
    }
    g.end();
  }
}
