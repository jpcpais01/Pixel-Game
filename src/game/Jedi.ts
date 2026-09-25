import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { CHEST_Y, FACING_DEG, HIT_FRAME, JEDI_H, JEDI_ORIGIN_X, JEDI_ORIGIN_Y, JEDI_W } from '../art/jedi';
import { jediMeta } from '../art/textures';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { HitSpark, SlashArc, type Effect, type Scheme } from './Slash';
import { ForceWave } from './Force';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

export const MAX_HP = 95;
const SPEED = 64; // world px / second: light on his feet
/** A swing chains into the next if it starts within this long of the previous one. */
const COMBO_WINDOW = 1500;
const SPECIAL_COOLDOWN = 6000;
const PUSH_REACH = 46;
const PUSH_SPREAD = (40 * Math.PI) / 180;

const SWINGS = ['slash1', 'slash2', 'twirl'] as const;
type Swing = (typeof SWINGS)[number];

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

/** How a Jedi look plays: its texture key and the colours of its blade and Force. */
export interface JediStyle {
  key: string;
  saber: Scheme;
  force: Scheme;
  /** The saber's light on its surroundings. */
  light: number;
  /** The dark side: the push crackles with lightning. */
  dark: boolean;
}

export const JEDI_STYLE: JediStyle = {
  key: 'jedi',
  saber: { core: 0xf6feff, hot: 0x86d2ff, mid: 0x3f9cff, deep: 0x2a5ce0 },
  force: { core: 0xffffff, hot: 0xd8f0ff, mid: 0x8cc4ff, deep: 0x4a70c0 },
  light: 0x6fb8ff,
  dark: false,
};

export const SITH_STYLE: JediStyle = {
  key: 'jedi_sith',
  saber: { core: 0xfff6f2, hot: 0xff6a62, mid: 0xf0283a, deep: 0xa00a22 },
  force: { core: 0xfff0f4, hot: 0xff8a9a, mid: 0xd0304a, deep: 0x6a1030 },
  light: 0xff4a4a,
  dark: true,
};

type State = 'free' | 'swing' | 'push';

/**
 * The Jedi: a fast three-hit saber flurry on the attack button (forehand,
 * backhand and a spinning twirl that cuts all round him) and a Force push on
 * the special button that blasts a cone in front of him.
 */
export class Jedi implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals = new Vitals(MAX_HP);
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private style: JediStyle;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  /** The blade's light on the ground around him, following it. */
  private bladeLight: Phaser.GameObjects.Light;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  /** Towards the mouse on a computer (see Hero). */
  private aim: Aim | null = null;
  /** Where the Force push goes: straight at the mouse when aimed, else his facing. */
  private pushDir: Aim = { x: 0, y: 1 };
  private clock = 0;
  private cooldown = 0;
  private specialCd = 0;

  private swing: Swing = 'slash1';
  private step = 0;
  private lastSwingAt = -Infinity;
  private struck = false;
  private buffered = false;
  private prevAttack = false;
  private dash = { vx: 0, vy: 0, t: 0 };

  private fx: Effect[] = [];

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, style: JediStyle = JEDI_STYLE) {
    this.world = world;
    this.style = style;
    this.x = x;
    this.y = y;
    const key = style.key;
    const ox = JEDI_ORIGIN_X / JEDI_W;
    const oy = JEDI_ORIGIN_Y / JEDI_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.bladeLight = world.lights.addLight(x, y, 44, style.light, 0);
    this.body.play(`${key}_idle_down`);
    sound.ignite();

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      const k = anim.key;
      if (this.state === 'swing' && SWINGS.some((s) => k.startsWith(`${key}_${s}_`))) {
        this.state = 'free';
        this.cooldown = this.swing === 'twirl' ? 140 : 20;
        this.body.play(`${key}_idle_${this.dir}`);
      } else if (this.state === 'push' && k.startsWith(`${key}_push_`)) {
        this.state = 'free';
        this.cooldown = 80;
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
      if (special && this.specialCd === 0) this.startPush();
      else if (attack || this.buffered) this.startSwing();
    }

    const speed = { free: SPEED * Math.min(1, len), swing: SPEED * 0.35, push: SPEED * 0.1 }[this.state];
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
      const key = `${this.style.key}_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      const f = this.body.anims.currentFrame;
      const hitAt = this.state === 'push' ? HIT_FRAME.push : HIT_FRAME[this.swing];
      if (!this.struck && f && f.index - 1 >= hitAt) {
        this.struck = true;
        if (this.state === 'push') this.release();
        else this.land();
      }
    }

    this.sync();
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
    this.dir = this.aimDir();
    this.body.play(`${this.style.key}_${this.swing}_${this.dir}`);
    sound.saberSwing(this.step, this.world.pan(this.x));
    const u = this.facing();
    const lunge = this.swing === 'twirl' ? 70 : 45;
    this.dash = { vx: u.x * lunge, vy: u.y * lunge, t: 110 };
  }

  /** The blade connects: draw the cut and strike whatever it reaches. */
  private land(): void {
    const cx = snap(this.x);
    const cy = snap(this.y) - CHEST_Y;
    const depth = snap(this.y);
    const deg = FACING_DEG[this.dir];
    const saber = this.style.saber;
    if (this.swing === 'twirl') {
      // A full turn, starting and ending where he faces.
      this.fx.push(new SlashArc(this.world, cx, cy, deg, deg + 360, 19, saber, depth, 260));
      this.impact(this.world.melee({ kind: 'circle', x: cx, y: cy, radius: 22 }, { damage: 14, heavy: true }), true);
      return;
    }
    // Forehand and backhand sweep opposite ways; mirrored frames swap the saber hand.
    const hand = this.dir === 'right' ? -1 : 1;
    const sweep = this.swing === 'slash1' ? hand : -hand;
    this.fx.push(new SlashArc(this.world, cx, cy, deg + sweep * 100, deg - sweep * 100, 17, saber, depth, 170));
    this.impact(this.world.melee({ kind: 'arc', x: cx, y: cy, radius: 22, angle: (deg * Math.PI) / 180, spread: (115 * Math.PI) / 180 }, { damage: 9 }), false);
  }

  private impact(hits: { x: number; y: number }[], heavy: boolean): void {
    for (const h of hits) {
      this.fx.push(new HitSpark(this.world, h.x, h.y, this.style.saber, h.y + 13, heavy));
      sound.saberHit(this.world.pan(h.x), heavy);
    }
    if (hits.length) this.world.cameras.main.shake(heavy ? 100 : 60, heavy ? 0.0005 : 0.0003);
  }

  private startPush(): void {
    this.state = 'push';
    this.step = 0;
    this.struck = false;
    this.dir = this.aimDir();
    this.body.play(`${this.style.key}_push_${this.dir}`);
    this.pushDir = this.aim ? { x: this.aim.x, y: this.aim.y } : this.facing();
    this.specialCd = SPECIAL_COOLDOWN;
    sound.forceGather();
  }

  /** The palm drives forward: a wave of the Force rolls out and blasts whatever is in front. */
  private release(): void {
    const u = this.pushDir;
    const x = snap(this.x) + u.x * 6;
    const y = snap(this.y) - CHEST_Y + 1 + u.y * 4;
    this.fx.push(new ForceWave(this.world, x, y, u.x, u.y, PUSH_REACH, this.style.force, snap(this.y), this.style.dark));
    const hits = this.world.melee({ kind: 'arc', x, y, radius: PUSH_REACH, angle: Math.atan2(u.y, u.x), spread: PUSH_SPREAD }, { damage: 10, heavy: true, knock: 260, fromX: x, fromY: y });
    for (const h of hits) this.fx.push(new HitSpark(this.world, h.x, h.y, this.style.force, h.y + 13, true));
    sound.forcePush(this.world.pan(x), this.style.dark);
    this.world.cameras.main.shake(180, 0.0006);
    // Recoil: the push shoves him back a step.
    this.dash = { vx: -u.x * 50, vy: -u.y * 50, t: 90 };
  }

  /** Which way an ability goes: at the mouse on a computer, else the way he last walked. */
  private aimDir(): Dir {
    const a = this.aim ?? this.lastMove;
    return dirOf(a.x, a.y);
  }

  private facing(): { x: number; y: number } {
    const a = (FACING_DEG[this.dir] * Math.PI) / 180;
    return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
  }

  private updateHud(): void {
    // The special button's ring refills over the cooldown and glows when ready.
    beamHud.charge = 1 - this.specialCd / SPECIAL_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'push';
    const since = this.clock - this.lastSwingAt;
    comboHud.hits = this.step;
    comboHud.window = this.step === 0 ? 0 : this.step < 3 ? Math.max(0, 1 - since / COMBO_WINDOW) : Math.max(0, 1 - since / 600);
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
    // The blade lights the ground around its middle, brightest at night.
    const m = jediMeta.get(frame);
    const bx = m ? (m.tipX + m.handX) / 2 - JEDI_ORIGIN_X : 0;
    const by = m ? (m.tipY + m.handY) / 2 - JEDI_ORIGIN_Y : -14;
    this.bladeLight.setPosition(rx + bx, ry + by);
    this.bladeLight.intensity = 0.35 + 0.75 * (1 - this.daylight);
  }
}
