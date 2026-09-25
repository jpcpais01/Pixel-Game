import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { ROGUE_CHEST_Y, ROGUE_H, ROGUE_ORIGIN_X, ROGUE_ORIGIN_Y, ROGUE_W, STRIKE_FRAME } from '../art/rogue';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { reaches, Vitals, type Hurtbox, type MeleeArea } from './combat';
import { HitSpark, SlashArc, ThrustStreak, type Effect, type Scheme } from './Slash';
import { Afterimage, Bleed, SmokePuff, type ShadowStyle } from './Shadows';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

/** How long a strike may follow the last one and still chain. */
const COMBO_WINDOW = 900;
/** Hidden in shadow after the special: the next strike is an ambush. */
const AMBUSH = 2;
/** The shadowstep: how far, and how quick. */
const STEP_MIN = 24;
const STEP_MAX = 76;
const STEP_TOUCH = 60;
const STEP_TIME = 150;
/** The eviscerate tears open the bleeding: this much more per stack. */
const EVISCERATE_PER_STACK = 5;
/** The dance: how far he looks for partners, how many, and how long each visit is. */
const DANCE_RANGE = 96;
const DANCE_HOPS = 5;
const HOP_TIME = 130;

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type Anim = 'stab1' | 'stab2' | 'cross';

/** One strike of the chain: the pose, the shape it cuts, and what it carries. */
interface Blow {
  anim: Anim;
  /** stab: a straight thrust; cut: a slash across the front; cross: an X; spin: a cut all round. */
  shape: 'stab' | 'cut' | 'cross' | 'spin';
  damage: number;
  reach: number;
  heavy?: boolean;
  /** Stacks of bleeding it opens. */
  bleed?: number;
  /** Tears the target's bleeding open for extra damage. */
  eviscerate?: boolean;
  /** A step in with the strike, px/s. */
  lunge: number;
}

/** How a rogue look plays: its numbers, its chain, its special and its colours. */
export interface RogueStyle {
  key: string;
  maxHp: number;
  /** World px / second. */
  speed: number;
  chain: Blow[];
  special: 'shadowstep' | 'dance';
  specialCooldown: number;
  /** How long he stays hidden after the special. */
  cloak: number;
  /** Damage of the special's cuts: along the shadowstep, or each partner of the dance. */
  specialDamage: number;
  /** Steel for the strikes, and the colour of the special. */
  steel: Scheme;
  shade: Scheme;
  shadow: ShadowStyle;
  /** Hits in the chain that open bleeding are counted here (the rogue's). */
  bleeds: boolean;
}

export const ROGUE_STYLE: RogueStyle = {
  key: 'rogue',
  maxHp: 80,
  speed: 70,
  chain: [
    { anim: 'stab1', shape: 'stab', damage: 6, reach: 17, bleed: 1, lunge: 60 },
    { anim: 'stab2', shape: 'stab', damage: 6, reach: 17, bleed: 1, lunge: 60 },
    { anim: 'cross', shape: 'cross', damage: 10, reach: 20, heavy: true, eviscerate: true, lunge: 80 },
  ],
  special: 'shadowstep',
  specialCooldown: 7000,
  cloak: 2500,
  specialDamage: 8,
  steel: { core: 0xffffff, hot: 0xeef2ff, mid: 0xa8b4d8, deep: 0x5a5a88 },
  shade: { core: 0xffe8e0, hot: 0xff8a7a, mid: 0xd83a44, deep: 0x7a1830, light: 0xff6a5a },
  shadow: { smoke: 'rogue_smoke', echo: 0x2a2436, glow: false },
  bleeds: true,
};

export const DANCER_STYLE: RogueStyle = {
  key: 'rogue_dancer',
  maxHp: 72,
  speed: 74,
  chain: [
    { anim: 'stab1', shape: 'cut', damage: 5, reach: 22, lunge: 50 },
    { anim: 'stab2', shape: 'cut', damage: 5, reach: 22, lunge: 50 },
    { anim: 'stab1', shape: 'cut', damage: 6, reach: 22, lunge: 50 },
    { anim: 'cross', shape: 'spin', damage: 11, reach: 23, heavy: true, lunge: 40 },
  ],
  special: 'dance',
  specialCooldown: 9000,
  cloak: 1500,
  specialDamage: 12,
  steel: { core: 0xffffff, hot: 0xe6d8ff, mid: 0xa47cff, deep: 0x5a30b0, light: 0xa070ff },
  shade: { core: 0xfaf4ff, hot: 0xd0b0ff, mid: 0x8a50f0, deep: 0x3a1a80, light: 0x9a60ff },
  shadow: { smoke: 'rogue_dancer_smoke', echo: 0x7040d0, glow: true },
  bleeds: false,
};

type State = 'free' | 'strike' | 'step' | 'dance';

/**
 * The rogue: quick dagger strikes on the attack button, chaining into a
 * finisher, and a shadow trick on the special. Each look plays its own kit:
 *
 * - The rogue stabs twice, each stab opening a bleeding wound, then tears both
 *   blades across in an X that rips the wound open for more. His special is
 *   the shadowstep: he vanishes in smoke and darts where he aims, untouchable,
 *   cutting everything he passes, and comes out of it hidden, his next strike
 *   an ambush for double damage.
 * - The shadow dancer cuts four times, wider and lighter, the last a spin all
 *   round her. Her special is the shadow dance: she blinks from foe to foe
 *   nearby, striking each, untouchable until she settles by the last.
 */
export class Rogue implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals: Vitals;
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private style: RogueStyle;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  /** Towards the mouse on a computer (see Hero). */
  private aim: Aim | null = null;
  private clock = 0;
  private cooldown = 0;
  private specialCd = 0;
  private bleed: Bleed;

  private step = 0;
  private blow: Blow;
  private lastStrikeAt = -Infinity;
  private struck = false;
  private buffered = false;
  private prevAttack = false;
  /** Which way the current strike goes. */
  private line = { x: 0, y: 1 };
  private lunge = { vx: 0, vy: 0, t: 0 };
  /** Time left hidden in shadow. */
  private hidden = 0;

  /** The shadowstep under way: its speed, time left, and where it started. */
  private dash = { vx: 0, vy: 0, t: 0, x0: 0, y0: 0, echo: 0 };
  /** The dance under way: partners left, and time to the next. */
  private partners: Hurtbox[] = [];
  private hopIn = 0;

  private fx: Effect[] = [];

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, style: RogueStyle = ROGUE_STYLE) {
    this.world = world;
    this.style = style;
    this.vitals = new Vitals(style.maxHp);
    this.bleed = new Bleed(world);
    this.blow = style.chain[0];
    this.x = x;
    this.y = y;
    const k = style.key;
    const ox = ROGUE_ORIGIN_X / ROGUE_W;
    const oy = ROGUE_ORIGIN_Y / ROGUE_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${k}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, k, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${k}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.body.play(`${k}_idle_down`);
    comboHud.max = style.chain.length;

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (this.state === 'strike' && anim.key.startsWith(`${k}_${this.blow.anim}_`)) {
        this.state = 'free';
        this.cooldown = this.blow.heavy ? 120 : 10;
        this.body.play(`${k}_idle_${this.dir}`);
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${k}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    // Shared HUD state: don't leave it set for the next hero.
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
      comboHud.max = 3;
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
    this.hidden = Math.max(0, this.hidden - dt);
    this.bleed.update(dt);

    // A tap during a strike queues the next one, so quick taps chain cleanly.
    const pressed = attack && !this.prevAttack;
    this.prevAttack = attack;
    if (pressed && this.state === 'strike') this.buffered = true;

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.startSpecial();
      else if (attack || this.buffered) this.startStrike();
    }

    const speed = this.style.speed;
    const pace = { free: speed * Math.min(1, len), strike: speed * 0.45, step: 0, dance: 0 }[this.state];
    let vx = moving ? (mx / len) * pace : 0;
    let vy = moving ? (my / len) * pace : 0;
    if (this.lunge.t > 0) {
      vx += this.lunge.vx;
      vy += this.lunge.vy;
      this.lunge.t -= dt;
    }
    if (this.state === 'step') {
      vx = this.dash.vx;
      vy = this.dash.vy;
    }
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      // Fighting faces the aim, even walking backwards; otherwise the way of the walk.
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = `${this.style.key}_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else if (this.state === 'strike') {
      const f = this.body.anims.currentFrame;
      if (!this.struck && f && f.index - 1 >= STRIKE_FRAME[this.blow.anim]) {
        this.struck = true;
        this.land();
      }
    } else if (this.state === 'step') {
      this.updateStep(dt);
    } else {
      // The dance moves him by blinks, after his step is clamped to the room he stood in.
      this.updateDance(dt);
    }

    this.sync();
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.updateHud();
  }

  // -------------------------------------------------------------------------
  // The chain

  private startStrike(): void {
    const chain = this.style.chain;
    const next = this.step > 0 && this.step < chain.length && this.clock - this.lastStrikeAt <= COMBO_WINDOW;
    this.step = next ? this.step + 1 : 1;
    this.lastStrikeAt = this.clock;
    this.blow = chain[this.step - 1];
    this.buffered = false;
    this.struck = false;
    this.state = 'strike';
    const u = this.aimLine();
    this.line = u;
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.style.key}_${this.blow.anim}_${this.dir}`);
    sound.knife(this.world.pan(this.x), this.step, this.step === chain.length);
    this.lunge = { vx: u.x * this.blow.lunge, vy: u.y * this.blow.lunge, t: 100 };
  }

  /** The blades connect: draw the strike and hurt whatever it reaches. */
  private land(): void {
    const b = this.blow;
    const u = this.line;
    const cx = snap(this.x);
    const cy = snap(this.y) - ROGUE_CHEST_Y;
    const depth = snap(this.y);
    const deg = Phaser.Math.RadToDeg(Math.atan2(u.y, u.x));
    const steel = this.style.steel;
    let area: MeleeArea;
    if (b.shape === 'stab') {
      area = { kind: 'line', x0: cx, y0: cy, x1: cx + u.x * b.reach, y1: cy + u.y * b.reach, radius: 5 };
      this.fx.push(new ThrustStreak(this.world, cx + u.x * 3, cy + u.y * 3, u.x, u.y, b.reach - 3, steel, depth));
    } else if (b.shape === 'spin') {
      area = { kind: 'circle', x: cx, y: cy, radius: b.reach };
      this.fx.push(new SlashArc(this.world, cx, cy, deg, deg + 360, b.reach - 3, this.style.shade, depth, 240));
    } else {
      const spread = b.shape === 'cross' ? 80 : 105;
      area = { kind: 'arc', x: cx, y: cy, radius: b.reach, angle: Math.atan2(u.y, u.x), spread: Phaser.Math.DegToRad(spread) };
      if (b.shape === 'cross') {
        // Two cuts crossing: an X torn across the front.
        this.fx.push(new SlashArc(this.world, cx, cy, deg - 75, deg + 75, b.reach - 4, this.style.shade, depth, 180));
        this.fx.push(new SlashArc(this.world, cx, cy, deg + 75, deg - 75, b.reach - 6, steel, depth, 200));
      } else {
        const sweep = this.step % 2 ? 1 : -1;
        this.fx.push(new SlashArc(this.world, cx, cy, deg + sweep * 95, deg - sweep * 95, b.reach - 4, steel, depth, 160));
      }
    }
    this.strike(area, b.damage, !!b.heavy, b.bleed ?? 0, !!b.eviscerate, cx, cy);
  }

  /**
   * Strike everything in `area`. Out of hiding it's an ambush: double damage,
   * a heavy blow. Returns how many were struck.
   */
  private strike(area: MeleeArea, damage: number, heavy: boolean, bleed: number, eviscerate: boolean, fromX: number, fromY: number): number {
    const ambush = this.hidden > 0;
    this.hidden = 0;
    const targets = this.world.hurtboxesWhere((h) => h.alive && reaches(area, h.x, h.y - h.bodyY, h.radius));
    for (const h of targets) {
      let d = damage;
      // The finisher rips the wound open.
      if (eviscerate) d += this.bleed.take(h) * EVISCERATE_PER_STACK;
      if (ambush) d *= AMBUSH;
      const bx = h.x;
      const by = h.y - h.bodyY;
      h.hurt({ damage: d, heavy: heavy || ambush, knock: heavy || ambush ? 120 : 45, fromX, fromY });
      if (bleed && this.style.bleeds && h.alive) this.bleed.cut(h, bleed);
      const l = Math.hypot(fromX - bx, fromY - by) || 1;
      const sx = bx + ((fromX - bx) / l) * (h.radius - 1);
      const sy = by + ((fromY - by) / l) * (h.radius - 2);
      this.fx.push(new HitSpark(this.world, sx, sy, eviscerate || ambush ? this.style.shade : this.style.steel, sy + 13, heavy || ambush));
      sound.knifeHit(this.world.pan(bx), heavy || ambush);
    }
    if (targets.length) {
      this.world.cameras.main.shake(heavy || ambush ? 90 : 50, heavy || ambush ? 0.0005 : 0.00025);
      if (ambush) this.world.popNumber(snap(this.x), snap(this.y) - 40, 'AMBUSH', this.style.shade.hot);
    }
    return targets.length;
  }

  // -------------------------------------------------------------------------
  // The special

  private startSpecial(): void {
    this.step = 0;
    this.specialCd = this.style.specialCooldown;
    const partners = this.style.special === 'dance' ? this.findPartners() : [];
    this.world.addEffect(new SmokePuff(this.world, snap(this.x), snap(this.y), this.style.shadow, true));
    sound.vanish(this.world.pan(this.x), this.style.special === 'dance');
    if (partners.length) {
      this.state = 'dance';
      this.partners = partners;
      this.hopIn = 60;
      this.world.evade(60 + partners.length * HOP_TIME + 250);
      this.body.play(`${this.style.key}_dash_${this.dir}`);
      return;
    }
    // No one to dance with, or the rogue's own trick: a dart through the shadows.
    const u = this.aimLine();
    const dist = this.aim?.dist !== undefined ? Phaser.Math.Clamp(this.aim.dist, STEP_MIN, STEP_MAX) : STEP_TOUCH;
    const v = dist / (STEP_TIME / 1000);
    this.dash = { vx: u.x * v, vy: u.y * v, t: STEP_TIME, x0: this.x, y0: this.y, echo: 0 };
    this.line = u;
    this.dir = dirOf(u.x, u.y);
    this.state = 'step';
    this.world.evade(STEP_TIME + 250);
    this.body.play(`${this.style.key}_dash_${this.dir}`);
  }

  private updateStep(dt: number): void {
    const d = this.dash;
    d.t -= dt;
    d.echo -= dt;
    if (d.echo <= 0) {
      d.echo = 35;
      this.echo();
    }
    if (d.t > 0) return;
    // Out of the shadows: everything he passed through is cut.
    const lift = ROGUE_CHEST_Y;
    this.strike({ kind: 'line', x0: d.x0, y0: d.y0 - lift, x1: this.x, y1: this.y - lift, radius: 7 }, this.style.specialDamage, false, 2, false, d.x0, d.y0 - lift);
    this.world.addEffect(new SmokePuff(this.world, snap(this.x), snap(this.y), this.style.shadow));
    this.hidden = this.style.cloak;
    this.state = 'free';
    this.cooldown = 60;
    this.body.play(`${this.style.key}_idle_${this.dir}`);
  }

  /** Foes near enough to dance with, nearest first. */
  private findPartners(): Hurtbox[] {
    const near = this.world.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - this.x, h.y - this.y) <= DANCE_RANGE);
    near.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));
    return near.slice(0, DANCE_HOPS);
  }

  private updateDance(dt: number): void {
    this.hopIn -= dt;
    if (this.hopIn > 0) return;
    const h = this.partners.shift();
    if (!h) {
      // The last partner struck: she settles, hidden for a moment.
      this.hidden = this.style.cloak;
      this.state = 'free';
      this.cooldown = 80;
      this.world.addEffect(new SmokePuff(this.world, snap(this.x), snap(this.y), this.style.shadow));
      this.body.play(`${this.style.key}_idle_${this.dir}`);
      return;
    }
    this.hopIn = HOP_TIME;
    if (!h.alive) {
      this.hopIn = 0;
      return;
    }
    this.echo();
    // Step out of the shadows beside it, on the side she came from.
    const side = Math.sign(this.x - h.x) || 1;
    let nx = h.x + side * (h.radius + 5);
    let ny = h.y + 1;
    if (!this.world.walkable(nx, ny)) {
      nx = h.x;
      ny = h.y + 2;
    }
    const u = { x: h.x - nx || -side, y: h.y - ny };
    const l = Math.hypot(u.x, u.y) || 1;
    this.line = { x: u.x / l, y: u.y / l };
    this.x = nx;
    this.y = ny;
    this.dir = dirOf(this.line.x, this.line.y);
    const anim: Anim = this.partners.length % 2 ? 'stab1' : 'stab2';
    this.body.play({ key: `${this.style.key}_${anim}_${this.dir}`, startFrame: STRIKE_FRAME[anim] });
    sound.blink(this.world.pan(nx));
    const cx = snap(nx);
    const cy = snap(ny) - ROGUE_CHEST_Y;
    const deg = Phaser.Math.RadToDeg(Math.atan2(this.line.y, this.line.x));
    this.fx.push(new SlashArc(this.world, cx, cy, deg - 90, deg + 90, 15, this.style.shade, snap(ny), 150));
    this.strike({ kind: 'circle', x: h.x, y: h.y - h.bodyY, radius: 2 }, this.style.specialDamage, true, 0, false, cx, cy);
  }

  /** Leave an echo of himself where he stands. */
  private echo(): void {
    this.world.addEffect(new Afterimage(this.world, snap(this.x), snap(this.y), this.style.key, this.body.frame.name, ROGUE_ORIGIN_X / ROGUE_W, ROGUE_ORIGIN_Y / ROGUE_H, this.style.shadow));
  }

  /** Which way a strike goes: at the mouse on a computer, else the way he last walked. */
  private aimLine(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    return { x: a.x, y: a.y };
  }

  private updateHud(): void {
    // The special button's ring refills over the cooldown and glows when ready.
    beamHud.charge = 1 - this.specialCd / this.style.specialCooldown;
    beamHud.over = 0;
    beamHud.firing = this.state === 'step' || this.state === 'dance';
    const n = this.style.chain.length;
    const since = this.clock - this.lastStrikeAt;
    comboHud.hits = this.step;
    comboHud.window = this.step === 0 ? 0 : this.step < n ? Math.max(0, 1 - since / COMBO_WINDOW) : Math.max(0, 1 - since / 500);
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    // In shadow he is barely there: a faint, breathing outline. Mid-dance, gone but for the blades.
    const veil = this.state === 'dance' ? 0.3 : this.state === 'step' ? 0.55 : this.hidden > 0 ? 0.38 + Math.sin(this.clock * 0.012) * 0.08 : 1;
    const a = this.alpha * veil;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(a);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha * (veil < 1 ? 0.5 : 1));
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * a);
  }
}
