import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { CHEST_Y, FACING_DEG, HIT_FRAME, JEDI_H, JEDI_ORIGIN_X, JEDI_ORIGIN_Y, JEDI_W, LIGHTNING_FRAMES } from '../art/jedi';
import { jediMeta } from '../art/heroLoader';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { HitSpark, SlashArc, type Effect, type Scheme } from './Slash';
import { ForceLightning, type Arc } from './Lightning';
import { pal, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Sith: the Jedi class's dark-side type, on the Jedi's rig with a
// saberstaff and moves of his own (art/jedi.ts, the `staff` flag).
//  - The attack is the saberstaff: a forehand and a backhand sweep, each
//    cutting a wide arc before him while the back blade cuts behind him too,
//    then the Dervish, a lunge with the staff whirling flat round him that
//    carves through everything on the way.
//  - The ability is Force lightning: he thrusts out a hand and lightning
//    pours from it for half a second into the nearest few foes in front of
//    him, jumping on from each to one more, jolting and slowing all it holds.
//  - His Special, Dark Dominion, is in ultimate/sith.ts.

const stats = HERO_STATS['jedi.sith'];

/** A swing chains into the next if it starts within this long of the previous one. */
const COMBO_WINDOW = 1500;
/** The sweeps: a wide arc in front, and the back blade's narrower one behind. Spreads are half-angles. */
const SWEEP = { reach: 24, spread: (80 * Math.PI) / 180, damage: 10 };
const BACKCUT = { reach: 19, spread: (50 * Math.PI) / 180, damage: 5 };
/** The Dervish: how far round him it cuts, its blow, and the lunge (px/s for ms). */
const DERVISH = { radius: 19, damage: 16, knock: 150, speed: 150, dash: 260 };

// Force lightning.
const LIGHTNING = {
  /** How far it reaches from the hand, and the half-angle of its cone. */
  reach: 72,
  spread: (32 * Math.PI) / 180,
  /** It strikes this often while it pours, each time for `damage`. */
  tick: 100,
  damage: 5,
  /** Foes it seizes from the hand at once, and how far it jumps on from each. */
  targets: 3,
  chain: 36,
  chainDamage: 3,
  slow: 0.5,
  slowMs: 700,
  cooldown: 7000,
};

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'swing' | 'dervish' | 'lightning';
type Swing = 'sweep1' | 'sweep2';

/** How a Sith look plays: its texture key and the colours of its blades, lightning and Special. */
export interface SithKit {
  key: string;
  staff: Scheme;
  /** Force lightning, drawn in pixels. */
  bolt: Pal;
  /** Dark Dominion's colours. */
  dominion: Pal;
  /** The blades' light on their surroundings. */
  light: number;
}

export const SITH_KIT: SithKit = {
  key: 'jedi_sith',
  staff: { core: 0xfff6f2, hot: 0xff6a62, mid: 0xf0283a, deep: 0xa00a22 },
  bolt: pal(0xfbf6ff, 0xd6b8ff, 0x9a6cff, 0x4a2a9a, 0xb89aff),
  dominion: pal(0xfff0f4, 0xff7a8c, 0xd0203a, 0x3a0616, 0xff4a5a),
  light: 0xff4a4a,
};

/** The Warlord: ember-red blades and blood-red lightning. */
export const WARLORD_KIT: SithKit = {
  key: 'jedi_warlord',
  staff: { core: 0xfff8f0, hot: 0xffa060, mid: 0xec3a10, deep: 0x9a1806 },
  bolt: pal(0xfff4ee, 0xffa08a, 0xff3a2a, 0x8a0a14, 0xff6a4a),
  dominion: pal(0xfff4e8, 0xffb070, 0xff4a1a, 0x4a0808, 0xff6a2a),
  light: 0xff5a2a,
};

export class Sith implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals = new Vitals(stats.hp);
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: SithKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  /** The blades' light on the ground around him, following them. */
  private bladeLight: Phaser.GameObjects.Light;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  /** Towards the mouse on a computer (see Hero). */
  private aim: Aim | null = null;
  private clock = 0;
  private cooldown = 0;
  private specialCd = 0;

  // The saberstaff chain.
  private swing: Swing = 'sweep1';
  private step = 0;
  private lastSwingAt = -Infinity;
  private struck = false;
  private buffered = false;
  private prevAttack = false;
  private dash = { vx: 0, vy: 0, t: 0 };
  /** Foes the Dervish has already cut this lunge, and when it next draws its whirl. */
  private carved = new Set<Hurtbox>();
  private whirlT = 0;

  // Force lightning.
  private zapDir: Aim = { x: 0, y: 1 };
  private zap: ForceLightning | null = null;
  private zapTick = 0;
  private strikes = 0;

  private fx: Effect[] = [];

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: SithKit = SITH_KIT) {
    this.world = world;
    this.kit = kit;
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = JEDI_ORIGIN_X / JEDI_W;
    const oy = JEDI_ORIGIN_Y / JEDI_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.bladeLight = world.lights.addLight(x, y, 48, kit.light, 0);
    this.body.play(`${key}_idle_down`);
    sound.ignite();

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      const k = anim.key;
      if (this.state === 'swing' && (k.startsWith(`${key}_sweep1_`) || k.startsWith(`${key}_sweep2_`))) this.settle(20);
      else if (this.state === 'dervish' && k.startsWith(`${key}_dervish_`)) this.settle(160);
      else if (this.state === 'lightning' && k.startsWith(`${key}_lightning_`)) {
        this.zap?.stop();
        this.zap = null;
        this.settle(80);
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    // The special button's "firing" look is shared state; don't leave it lit.
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (beamHud.firing = false));
  }

  private settle(cooldown: number): void {
    this.state = 'free';
    this.cooldown = cooldown;
    this.body.play(`${this.kit.key}_idle_${this.dir}`);
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
    if (pressed && (this.state === 'swing' || this.state === 'dervish')) this.buffered = true;

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.startLightning();
      else if (attack || this.buffered) this.startSwing();
    }

    const pace = { free: Math.min(1, len), swing: 0.35, dervish: 0.2, lightning: 0.12 }[this.state];
    let vx = moving ? (mx / len) * stats.speed * pace : 0;
    let vy = moving ? (my / len) * stats.speed * pace : 0;
    if (this.dash.t > 0) {
      vx += this.dash.vx;
      vy += this.dash.vy;
      this.dash.t -= dt;
    }
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      // Fighting faces the aim, even walking backwards; otherwise the way of the walk.
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_walk_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      const f = this.body.anims.currentFrame;
      const at = f ? f.index - 1 : 0;
      if (this.state === 'swing' && !this.struck && at >= HIT_FRAME[this.swing]) {
        this.struck = true;
        this.sweep();
      } else if (this.state === 'dervish' && at >= HIT_FRAME.dervish) this.carve(dt);
      else if (this.state === 'lightning') this.pour(dt, at);
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
    this.buffered = false;
    this.struck = false;
    this.dir = this.aimDir();
    const u = this.facing();
    sound.saberSwing(this.step, this.world.pan(this.x));
    if (this.step === 3) {
      // The Dervish: the staff whirls flat round him as he lunges.
      this.state = 'dervish';
      this.carved.clear();
      this.whirlT = 0;
      this.body.play(`${this.kit.key}_dervish_${this.dir}`);
      const a = this.aim ? Math.hypot(this.aim.x, this.aim.y) || 1 : 1;
      const d = this.aim ? { x: this.aim.x / a, y: this.aim.y / a } : u;
      this.dash = { vx: d.x * DERVISH.speed, vy: d.y * DERVISH.speed, t: DERVISH.dash };
      return;
    }
    this.state = 'swing';
    this.swing = this.step === 1 ? 'sweep1' : 'sweep2';
    this.body.play(`${this.kit.key}_${this.swing}_${this.dir}`);
    this.dash = { vx: u.x * 45, vy: u.y * 45, t: 110 };
  }

  /** A sweep lands: the front blade cuts a wide arc before him, the back blade a narrower one behind. */
  private sweep(): void {
    const cx = snap(this.x);
    const cy = snap(this.y) - CHEST_Y;
    const depth = snap(this.y);
    const deg = FACING_DEG[this.dir];
    const s = this.kit.staff;
    // Forehand and backhand sweep opposite ways; mirrored frames swap the staff hand.
    const hand = this.dir === 'right' ? -1 : 1;
    const way = this.swing === 'sweep1' ? hand : -hand;
    this.fx.push(new SlashArc(this.world, cx, cy, deg + way * 110, deg - way * 110, 18, s, depth, 180));
    // The back blade, round the other side, a shade fainter.
    this.fx.push(new SlashArc(this.world, cx, cy, deg + 180 + way * 60, deg + 180 - way * 60, 14, { ...s, core: s.hot, hot: s.mid }, depth - 0.1, 160));
    const rad = (deg * Math.PI) / 180;
    const front = this.world.melee({ kind: 'arc', x: cx, y: cy, radius: SWEEP.reach, angle: rad, spread: SWEEP.spread }, { damage: SWEEP.damage });
    const back = this.world.melee({ kind: 'arc', x: cx, y: cy, radius: BACKCUT.reach, angle: rad + Math.PI, spread: BACKCUT.spread }, { damage: BACKCUT.damage });
    this.impact([...front, ...back], false);
  }

  /** The Dervish's whirl: everything it passes within reach is cut once, heavily. */
  private carve(dt: number): void {
    const cx = snap(this.x);
    const cy = snap(this.y) - CHEST_Y;
    const depth = snap(this.y);
    this.whirlT -= dt;
    if (this.whirlT <= 0) {
      // A disc of blade-light round him, drawn afresh as he travels.
      this.whirlT = 110;
      const deg = FACING_DEG[this.dir];
      this.fx.push(new SlashArc(this.world, cx, cy, deg, deg + 360, DERVISH.radius, this.kit.staff, depth, 200));
    }
    const fresh = this.world.hurtboxesWhere((h) => h.alive && !this.carved.has(h) && Math.hypot(h.x - cx, h.y - h.bodyY - cy) <= DERVISH.radius + h.radius);
    const hits: { x: number; y: number }[] = [];
    for (const h of fresh) {
      this.carved.add(h);
      h.hurt({ damage: DERVISH.damage, heavy: true, knock: DERVISH.knock, fromX: cx, fromY: cy });
      hits.push({ x: h.x, y: h.y - h.bodyY });
    }
    this.impact(hits, true);
  }

  private impact(hits: { x: number; y: number }[], heavy: boolean): void {
    for (const h of hits) {
      this.fx.push(new HitSpark(this.world, h.x, h.y, this.kit.staff, h.y + 13, heavy));
      sound.saberHit(this.world.pan(h.x), heavy);
    }
    if (hits.length) this.world.cameras.main.shake(heavy ? 110 : 60, heavy ? 0.0006 : 0.0003);
  }

  private startLightning(): void {
    this.state = 'lightning';
    this.step = 0;
    this.dir = this.aimDir();
    this.body.play(`${this.kit.key}_lightning_${this.dir}`);
    const a = this.aim ?? this.facing();
    const l = Math.hypot(a.x, a.y) || 1;
    this.zapDir = { x: a.x / l, y: a.y / l };
    this.zapTick = 0;
    this.strikes = 0;
    this.specialCd = LIGHTNING.cooldown;
    sound.forceGather();
  }

  /** While the hand is out, lightning pours from it: a strike every tick, the bolts following the hand between. */
  private pour(dt: number, frame: number): void {
    if (frame < LIGHTNING_FRAMES.from || frame > LIGHTNING_FRAMES.to) {
      if (frame > LIGHTNING_FRAMES.to && this.zap) {
        this.zap.stop();
        this.zap = null;
      }
      return;
    }
    const hand = this.palm();
    const depth = this.zapDir.y < -0.5 ? snap(this.y) - 0.5 : snap(this.y) + 30;
    if (!this.zap) {
      this.zap = new ForceLightning(this.world, this.kit.bolt);
      this.fx.push(this.zap);
      // The frames it pours for, at the animation's pace.
      sound.forceLightning(this.world.pan(this.x), (LIGHTNING_FRAMES.to - LIGHTNING_FRAMES.from + 1) / 11);
    }
    this.zapTick -= dt;
    if (this.zapTick > 0) {
      this.zap.follow(hand.x, hand.y, depth);
      return;
    }
    this.zapTick = LIGHTNING.tick;
    this.strike(hand.x, hand.y, depth);
    this.strikes++;
  }

  /** One strike of the lightning: into the nearest few foes in the cone, and on from each to one more. */
  private strike(px: number, py: number, depth: number): void {
    const ang = Math.atan2(this.zapDir.y, this.zapDir.x);
    const body = (h: Hurtbox) => ({ x: h.x, y: h.y - h.bodyY });
    const held = this.world
      .hurtboxesWhere((h) => {
        if (!h.alive) return false;
        const b = body(h);
        const d = Math.hypot(b.x - px, b.y - py);
        if (d > LIGHTNING.reach + h.radius) return false;
        return d < h.radius + 6 || Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(b.y - py, b.x - px) - ang)) <= LIGHTNING.spread;
      })
      .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
      .slice(0, LIGHTNING.targets);
    const taken = new Set<Hurtbox>(held);
    const arcs: Arc[] = [];
    const bolt = this.kit.bolt;
    const jolt = (h: Hurtbox, damage: number) => {
      h.hurt({ damage, heavy: false, knock: 25, fromX: px, fromY: py });
      h.slow?.(LIGHTNING.slow, LIGHTNING.slowMs, bolt.hot);
    };
    for (const h of held) {
      const b = body(h);
      arcs.push({ x0: px, y0: py, x1: b.x, y1: b.y });
      jolt(h, LIGHTNING.damage);
      // It leaps on to the nearest foe not already held.
      const next = this.world
        .hurtboxesWhere((o) => o.alive && !taken.has(o) && Math.hypot(o.x - h.x, o.y - h.y) <= LIGHTNING.chain + o.radius)
        .sort((a, c) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(c.x - h.x, c.y - h.y))[0];
      if (next) {
        taken.add(next);
        const n = body(next);
        arcs.push({ x0: b.x, y0: b.y, x1: n.x, y1: n.y, chain: true });
        jolt(next, LIGHTNING.chainDamage);
      }
    }
    // With nothing to seize, it lashes at the air ahead.
    const strays = held.length
      ? []
      : [-0.55, 0, 0.55].map((o) => ({ x: px + Math.cos(ang + o * LIGHTNING.spread) * LIGHTNING.reach * 0.8, y: py + Math.sin(ang + o * LIGHTNING.spread) * LIGHTNING.reach * 0.8 }));
    this.zap!.set(px, py, arcs, strays, depth);
    if (held.length) {
      this.world.debris([bolt.core, bolt.hot, bolt.mid], arcs[0].x1, arcs[0].y1, 3, arcs[0].y1 + 14, 'burst');
      if (this.strikes % 2 === 0) sound.tesla(this.world.pan(px), true);
    }
  }

  /** Where the free hand is this frame, in the world. */
  private palm(): { x: number; y: number } {
    const m = jediMeta.get(`${this.kit.key}:${this.body.frame.name}`);
    const rx = snap(this.x);
    const ry = snap(this.y);
    if (!m) return { x: rx + this.zapDir.x * 8, y: ry - CHEST_Y + this.zapDir.y * 6 };
    return { x: rx + m.palmX - JEDI_ORIGIN_X, y: ry + m.palmY - JEDI_ORIGIN_Y };
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
    beamHud.charge = 1 - this.specialCd / LIGHTNING.cooldown;
    beamHud.over = 0;
    beamHud.firing = this.state === 'lightning';
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
    // The staff lights the ground round its middle, brightest at night.
    const m = jediMeta.get(`${this.kit.key}:${frame}`);
    const bx = m ? m.handX - JEDI_ORIGIN_X : 0;
    const by = m ? m.handY - JEDI_ORIGIN_Y : -14;
    this.bladeLight.setPosition(rx + bx, ry + by);
    this.bladeLight.intensity = 0.4 + 0.8 * (1 - this.daylight);
  }
}
