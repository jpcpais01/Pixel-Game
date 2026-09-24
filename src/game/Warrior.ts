import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { CHEST_Y, FACING_DEG, HIT_FRAME, SPIN_FRAMES, WARRIOR_H, WARRIOR_ORIGIN_X, WARRIOR_ORIGIN_Y, WARRIOR_W } from '../art/warrior';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { GOLD_FX, HitSpark, JADE_FX, JADE_STEEL_FX, STEEL_FX, Shockwave, SlashArc, Tempest, ThrustStreak, type Effect, type Scheme } from './Slash';
import type { Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

export const MAX_HP = 110;
const SPEED = 60; // world px / second
/** A swing chains into the next hit of the combo if it starts within this long of the previous one. */
const COMBO_WINDOW = 2000;
const SPECIAL_COOLDOWN = 5000;
const SPIN_TIME = 1400;
const SPIN_SPEED = 0.95; // degrees per ms, about 2.6 turns a second
const SPIN_HIT_EVERY = 160;

const SWINGS = ['slash1', 'slash2', 'thrust'] as const;
type Swing = (typeof SWINGS)[number];

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'swing' | 'rise' | 'spin' | 'settle';

/** A look for the warrior: its texture key and the colours of its blade's light. */
export interface WarriorSkin {
  key: string;
  /** Forehand and backhand slashes. */
  swing: Scheme;
  /** The thrust, the whirlwind and its shockwave. */
  heavy: Scheme;
  /** The faint light around him at night. */
  aura: number;
}

export const KNIGHT_SKIN: WarriorSkin = { key: 'warrior', swing: STEEL_FX, heavy: GOLD_FX, aura: 0xffd2a0 };
export const JADE_SKIN: WarriorSkin = { key: 'warrior_jade', swing: JADE_STEEL_FX, heavy: JADE_FX, aura: 0xc8ffe0 };

/**
 * The warrior: a three-hit sword combo on the attack button (slash, backhand,
 * lunging thrust) and a whirlwind of fire on the special button.
 */
export class Warrior implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals = new Vitals(MAX_HP);
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private skin: WarriorSkin;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  /** A faint warm light so he can be made out at night away from the fires. */
  private aura: Phaser.GameObjects.Light;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private clock = 0;
  private cooldown = 0;
  private specialCd = 0;

  // Combo.
  private swing: Swing = 'slash1';
  private step = 0;
  private lastSwingAt = -Infinity;
  private struck = false;
  private buffered = false;
  private prevAttack = false;
  private dash = { vx: 0, vy: 0, t: 0 };

  // Whirlwind.
  private tempest: Tempest | null = null;
  private spinT = 0;
  private phi = 0;
  private nextTurn = 0;
  private hitTimer = 0;

  private fx: Effect[] = [];

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, skin: WarriorSkin = KNIGHT_SKIN) {
    this.world = world;
    this.skin = skin;
    const key = skin.key;
    this.x = x;
    this.y = y;
    const ox = WARRIOR_ORIGIN_X / WARRIOR_W;
    const oy = WARRIOR_ORIGIN_Y / WARRIOR_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 56, skin.aura, 0);
    this.body.play(`${key}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      const k = anim.key;
      if (this.state === 'swing' && SWINGS.some((s) => k.startsWith(`${key}_${s}_`))) {
        this.state = 'free';
        this.cooldown = this.swing === 'thrust' ? 160 : 30;
        this.body.play(`${this.skin.key}_idle_${this.dir}`);
      } else if (this.state === 'rise' && k.startsWith(`${key}_rise_`)) {
        this.startSpin();
      } else if (this.state === 'settle' && k.startsWith(`${key}_settle_`)) {
        this.state = 'free';
        this.body.play(`${this.skin.key}_idle_${this.dir}`);
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle): void {
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);

    // A tap during a swing queues the next one, so quick taps chain cleanly.
    const pressed = attack && !this.prevAttack;
    this.prevAttack = attack;
    if (pressed && this.state === 'swing') this.buffered = true;

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.startRise();
      else if (attack || this.buffered) this.startSwing();
    }

    // Walking, a slow shuffle mid-swing, steering the whirlwind.
    const speed = { free: SPEED * Math.min(1, len), swing: SPEED * 0.3, rise: SPEED * 0.15, spin: SPEED * 0.7, settle: SPEED * 0.2 }[this.state];
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
      if (moving) this.dir = dirOf(mx, my);
      const key = `${this.skin.key}_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else if (this.state === 'swing') {
      const f = this.body.anims.currentFrame;
      if (!this.struck && f && f.index - 1 >= HIT_FRAME[this.swing]) {
        this.struck = true;
        this.land();
      }
    } else if (this.state === 'spin') {
      this.updateSpin(dt);
    }

    this.sync();
    if (this.tempest) this.tempest.update(dt, snap(this.x), snap(this.y) - CHEST_Y, this.phi, snap(this.y), this.daylight);
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.updateHud();
  }

  private startSwing(): void {
    const chain = this.step > 0 && this.step < 3 && this.clock - this.lastSwingAt <= COMBO_WINDOW;
    this.step = chain ? this.step + 1 : 1;
    this.lastSwingAt = this.clock;
    this.swing = SWINGS[this.step - 1];
    this.buffered = false;
    this.struck = false;
    this.state = 'swing';
    this.dir = dirOf(this.lastMove.x, this.lastMove.y);
    this.body.play(`${this.skin.key}_${this.swing}_${this.dir}`);
    sound.swing(this.step, this.world.pan(this.x));
    if (this.swing !== 'thrust') {
      const u = this.facing();
      this.dash = { vx: u.x * 40, vy: u.y * 40, t: 110 };
    }
  }

  /** The blow connects: draw the swing and strike whatever it reaches. */
  private land(): void {
    const cx = snap(this.x);
    const cy = snap(this.y) - CHEST_Y;
    const depth = snap(this.y);
    const u = this.facing();
    if (this.swing === 'thrust') {
      this.fx.push(new ThrustStreak(this.world, cx, cy, u.x, u.y, 30, this.skin.heavy, depth));
      this.dash = { vx: u.x * 120, vy: u.y * 120, t: 100 };
      const hits = this.world.melee({ kind: 'line', x0: cx, y0: cy, x1: cx + u.x * 34, y1: cy + u.y * 34, radius: 7 }, { damage: 18, heavy: true, knock: 160 });
      this.impact(hits, this.skin.heavy, true);
      return;
    }
    // Forehand and backhand sweep opposite ways; mirrored frames swap the sword hand.
    const deg = FACING_DEG[this.dir];
    const hand = this.dir === 'right' ? -1 : 1;
    const sweep = this.swing === 'slash1' ? hand : -hand;
    this.fx.push(new SlashArc(this.world, cx, cy, deg + sweep * 100, deg - sweep * 100, 17, this.skin.swing, depth));
    const hits = this.world.melee({ kind: 'arc', x: cx, y: cy, radius: 22, angle: (deg * Math.PI) / 180, spread: (115 * Math.PI) / 180 }, { damage: 11 });
    this.impact(hits, this.skin.swing, false);
  }

  private impact(hits: { x: number; y: number }[], scheme: Scheme, heavy: boolean): void {
    for (const h of hits) {
      this.fx.push(new HitSpark(this.world, h.x, h.y, scheme, h.y + 13, heavy));
      sound.clash(this.world.pan(h.x), heavy);
    }
    if (hits.length) this.world.cameras.main.shake(heavy ? 110 : 70, heavy ? 0.0005 : 0.0003);
  }

  private startRise(): void {
    this.state = 'rise';
    this.step = 0;
    this.dir = dirOf(this.lastMove.x, this.lastMove.y);
    this.body.play(`${this.skin.key}_rise_${this.dir}`);
    sound.rise();
  }

  private startSpin(): void {
    this.state = 'spin';
    this.spinT = 0;
    this.phi = FACING_DEG[this.dir];
    this.nextTurn = this.phi;
    this.hitTimer = 60;
    this.body.anims.stop();
    this.tempest = new Tempest(this.world, this.skin.heavy);
    beamHud.firing = true;
  }

  private updateSpin(dt: number): void {
    this.spinT += dt;
    this.phi += SPIN_SPEED * dt;
    if (this.phi >= this.nextTurn) {
      this.nextTurn += 360;
      sound.whirl(this.world.pan(this.x));
    }
    const k = Math.round((((this.phi % 360) + 360) % 360) / (360 / SPIN_FRAMES)) % SPIN_FRAMES;
    this.body.setFrame(`spin_${k}`);

    this.hitTimer -= dt;
    if (this.hitTimer <= 0) {
      this.hitTimer += SPIN_HIT_EVERY;
      const hits = this.world.melee({ kind: 'circle', x: snap(this.x), y: snap(this.y) - CHEST_Y, radius: 20 }, { damage: 5, knock: 40 });
      this.impact(hits, this.skin.heavy, false);
    }
    if (this.spinT >= SPIN_TIME) this.endSpin();
  }

  /** The last turn slams out as a shockwave. */
  private endSpin(): void {
    this.tempest?.destroy();
    this.tempest = null;
    beamHud.firing = false;
    const x = snap(this.x);
    const y = snap(this.y);
    this.fx.push(new Shockwave(this.world, x, y - 1, 40, this.skin.heavy));
    const hits = this.world.melee({ kind: 'circle', x, y: y - CHEST_Y, radius: 36 }, { damage: 16, heavy: true, knock: 170 });
    this.impact(hits, this.skin.heavy, true);
    sound.slam(this.world.pan(x));
    this.world.cameras.main.shake(220, 0.0006);
    const a = (this.phi * Math.PI) / 180;
    this.dir = dirOf(Math.cos(a), Math.sin(a));
    this.state = 'settle';
    this.specialCd = SPECIAL_COOLDOWN;
    this.body.play(`${this.skin.key}_settle_${this.dir}`);
  }

  private facing(): { x: number; y: number } {
    const a = (FACING_DEG[this.dir] * Math.PI) / 180;
    return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
  }

  private updateHud(): void {
    // The special button's ring refills over the cooldown and glows when ready.
    beamHud.charge = 1 - this.specialCd / SPECIAL_COOLDOWN;
    beamHud.over = 0;
    const since = this.clock - this.lastSwingAt;
    comboHud.hits = this.step;
    comboHud.window = this.step === 0 ? 0 : this.step < 3 ? Math.max(0, 1 - since / COMBO_WINDOW) : Math.max(0, 1 - since / 700);
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
    this.aura.setPosition(rx, ry - 14);
    this.aura.intensity = 0.55 * (1 - this.daylight);
  }
}
