import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { SAGE_CHEST_Y, SAGE_H, SAGE_ORIGIN_X, SAGE_ORIGIN_Y, SAGE_RELEASE, SAGE_W, STONE_TURNS, stoneKey, type StoneKind } from '../art/sage';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { HitSpark } from './Slash';
import { bloom, clamp01, dither, easeOut, flare, Fx, GROUND, hash, pal, ring, type Ink, type Pal } from './ultimate/ink';
import { heroTimers } from './timers';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Force Sage: the Jedi class's scholar, on a rig of her own
// (art/sage.ts). She leaves her saber at her belt and fights with the mind.
//  - The attack is the Force throw: with a sweep of her hand a stone tears
//    out of the ground at her feet and rises; she draws it back and flings
//    it at the foe she aims at, and it tumbles through the air on a low arc
//    and shatters on them. Twice, one hand then the other; the third time
//    she heaves a whole slab up over her head with both hands and hurls it
//    down, bursting over everything round where it lands.
//  - The ability is the Force barrier: a shimmering dome of light springs up
//    round her for three seconds, soaking blows (her Vitals barrier) and
//    easing foes off its edge. When it breaks, or its time is up, it bursts
//    outward and throws them back.
//  - Her Special, Levitation, is in ultimate/sage.ts: she holds every foe
//    round her up in the air (she plays it through `channel`).
// The Starseer throws meteorites, dark and veined with starlight; she plays the same.

const stats = HERO_STATS['jedi.sage'];

/** A throw chains into the next if it starts within this long of the previous one. */
const COMBO_WINDOW = 1300;

/** The stones: how far she throws, how fast they fly (px/s), their blow, and the cone she looks for a foe in. */
const THROW = { range: 150, speed: 230, damage: 11, knock: 75, arc: 6, homing: 140 };
/** The slab: slower, on a high arc, bursting where it lands. */
const HEAVE = { range: 120, speed: 175, damage: 18, knock: 150, arc: 24, radius: 12, splash: 26, splashDamage: 9 };
const AIM_CONE = Math.cos((55 * Math.PI) / 180);
/** Where the stone hangs before it's thrown: in front of her at her hand's height, or the slab over her head. */
const HOLD = { ahead: 8, z: 15, slabZ: 30 };

// The barrier.
const BARRIER = {
  /** The dome's reach on the ground and its height. */
  radius: 18,
  height: 24,
  /** It lasts this long, and soaks this much before it breaks. */
  ms: 3000,
  soak: 30,
  /** Foes inside are eased out to its edge at this pace (px/s). */
  ease: 70,
  /** Its burst, when it breaks or ends: how far it reaches past the dome, its blow and how hard it throws them. */
  burst: 16,
  damage: 14,
  knock: 190,
  cooldown: 8000,
};

// Walk frames where she steps.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'throw' | 'heave' | 'barrier' | 'channel' | 'slam';

/** How a Sage look plays: its texture, its stones, and the colours of her Force and her Special. */
export interface SageKit {
  key: string;
  /** The stones are the Starseer's meteorites. */
  meteor: boolean;
  /** Her Force: the throw's trail, the dome, the bursts. */
  force: Pal;
  /** Levitation's colours. */
  lift: Pal;
  /** What flies off a stone when it breaks. */
  grit: number[];
}

export const SAGE_KIT: SageKit = {
  key: 'jedi_sage',
  meteor: false,
  force: pal(0xf0fffc, 0x9cf6e8, 0x3ad0c0, 0x14605a, 0x6ee8d8),
  lift: pal(0xf4fffd, 0xa8f8ea, 0x40d4c4, 0x166a62, 0x7aeedc),
  grit: [0xbcb4a0, 0x958c7c, 0x6e665a, 0x4a3020],
};

/** The Starseer: starlight-white and violet, and meteorites for stones. */
export const STARSEER_KIT: SageKit = {
  key: 'jedi_starseer',
  meteor: true,
  force: pal(0xffffff, 0xe6dcff, 0xa68cff, 0x3a2a7a, 0xc0a8ff),
  lift: pal(0xffffff, 0xe8e0ff, 0xae94ff, 0x3e2c86, 0xc8b4ff),
  grit: [0xffffff, 0xd4c8ff, 0x423a52, 0x1a1622],
};

export class Sage implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  // No barrier cap: only the dome sets her barrier, so healing never spills into one.
  readonly vitals = new Vitals(stats.hp);
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: SageKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  /** The Force's light round her hands. */
  private aura: Phaser.GameObjects.Light;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private clock = 0;
  private cooldown = 0;
  private barrierCd = 0;

  // The throws.
  private step = 0;
  private lastThrowAt = -Infinity;
  private buffered = false;
  private prevAttack = false;
  private prevSpecial = false;
  /** The stone rising for the throw under way, and the way it will go. */
  private held: Stone | null = null;
  private heading = { x: 0, y: 1 };

  private dome: Dome | null = null;
  /** The Special: how long she has left holding them up. */
  private channelT = 0;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: SageKit = SAGE_KIT) {
    this.world = world;
    this.kit = kit;
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = SAGE_ORIGIN_X / SAGE_W;
    const oy = SAGE_ORIGIN_Y / SAGE_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 56, kit.force.light, 0);
    this.body.play(`${key}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      const k = anim.key;
      if ((this.state === 'throw' && (k.startsWith(`${key}_throw1_`) || k.startsWith(`${key}_throw2_`))) || (this.state === 'heave' && k.startsWith(`${key}_heave_`))) {
        this.letGo();
        this.settle(this.state === 'heave' ? 120 : 30);
      } else if (this.state === 'barrier' && k.startsWith(`${key}_barrier_`)) this.settle(40);
      else if (this.state === 'slam' && k.startsWith(`${key}_slam_`)) this.settle(100);
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
      this.dome?.destroy();
      this.world.lights.removeLight(this.aura);
    });
  }

  /**
   * The Special has her hold them up for `ms` (ultimate/sage.ts): arms raised
   * and trembling, then brought down hard as they're slammed into the ground.
   */
  channel(ms: number): void {
    this.letGo();
    this.state = 'channel';
    this.channelT = ms;
    this.body.play(`${this.kit.key}_hold_${this.dir}`, true);
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
    this.barrierCd = Math.max(0, this.barrierCd - dt);

    const pressed = attack && !this.prevAttack;
    this.prevAttack = attack;
    if (pressed && (this.state === 'throw' || this.state === 'heave')) this.buffered = true;
    const cast = special && !this.prevSpecial;
    this.prevSpecial = special;

    if (this.state === 'free' && this.cooldown === 0) {
      if (cast && this.barrierCd === 0) this.raiseBarrier();
      else if (attack || this.buffered) this.startThrow();
    }
    if (this.state === 'channel') {
      this.channelT -= dt;
      if (this.channelT <= 0) {
        this.state = 'slam';
        this.body.play(`${this.kit.key}_slam_${this.dir}`, true);
      }
    }

    const pace = { free: Math.min(1, len), throw: 0.55, heave: 0.3, barrier: 0.4, channel: 0, slam: 0 }[this.state];
    if (moving && pace > 0) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * stats.speed * pace * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * stats.speed * pace * (dt / 1000), bounds.top, bounds.bottom);
    }

    if (this.state === 'free') {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_walk_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else if (this.state === 'throw' || this.state === 'heave') {
      const f = this.body.anims.currentFrame;
      const at = f ? f.index - 1 : 0;
      const name = this.body.anims.currentAnim?.key.slice(this.kit.key.length + 1).split('_')[0] as keyof typeof SAGE_RELEASE;
      if (this.held && at >= SAGE_RELEASE[name]) this.release();
      else this.held?.hold(this.holdPoint(this.state === 'heave'));
    }

    if (this.dome) {
      this.dome.follow(this.x, this.y);
      if (this.dome.dead) this.dome = null;
    }
    this.sync();
    this.updateHud();
  }

  // -------------------------------------------------------------------------
  // The Force throw

  private startThrow(): void {
    const chain = this.step > 0 && this.step < 3 && this.clock - this.lastThrowAt <= COMBO_WINDOW;
    this.step = chain ? this.step + 1 : 1;
    this.lastThrowAt = this.clock;
    this.buffered = false;
    const u = this.aimVec();
    this.heading = u;
    this.dir = dirOf(u.x, u.y);
    const big = this.step === 3;
    this.state = big ? 'heave' : 'throw';
    this.body.play(`${this.kit.key}_${big ? 'heave' : this.step === 1 ? 'throw1' : 'throw2'}_${this.dir}`);
    // The stone tears up out of the ground before her (the slab right at her feet).
    const gx = this.x + u.x * (big ? 4 : HOLD.ahead + 3);
    const gy = this.y + u.y * (big ? 3 : 6) + 2;
    this.held = new Stone(this.world, this.kit, big ? 'slab' : 'rock', gx, gy);
    this.world.addEffect(this.held);
    this.world.debris(this.kit.grit.slice(1), gx, gy, big ? 12 : 6, gy + 2, 'burst');
    sound.forceStone(this.world.pan(gx), 'rip');
    if (big) this.world.cameras.main.shake(90, 0.0005);
  }

  /** Where the stone hangs before it's thrown: its spot on the ground and how high over it. */
  private holdPoint(big: boolean): { x: number; y: number; z: number } {
    const u = this.heading;
    if (big) return { x: this.x, y: this.y + 1, z: HOLD.slabZ };
    const side = this.dir === 'left' || this.dir === 'right' ? 0 : this.step === 1 ? 6 : -6;
    return { x: this.x + u.x * HOLD.ahead + side, y: this.y + u.y * 5 + 1, z: HOLD.z };
  }

  /** It leaves her hand: at the best foe the way she aims, or just that way. */
  private release(): void {
    const s = this.held!;
    this.held = null;
    const big = this.state === 'heave';
    const range = big ? HEAVE.range : THROW.range;
    const foe = this.pick(this.heading, range);
    s.launch(foe, { x: this.x + this.heading.x * range, y: this.y + this.heading.y * range * 0.8 });
    sound.toss(this.world.pan(this.x), big);
    if (big) sound.forcePush(this.world.pan(this.x));
  }

  /** A stone still held when the throw is cut short falls and breaks. */
  private letGo(): void {
    this.held?.drop();
    this.held = null;
  }

  private pick(u: { x: number; y: number }, range: number): Hurtbox | null {
    const cx = this.x;
    const cy = this.y - SAGE_CHEST_Y;
    let best: Hurtbox | null = null;
    let bestD = Infinity;
    for (const h of this.world.hurtboxesWhere((b) => b.alive)) {
      const dx = h.x - cx;
      const dy = h.y - h.bodyY - cy;
      const d = Math.hypot(dx, dy);
      if (d > range || d === 0 || (dx * u.x + dy * u.y) / d < AIM_CONE) continue;
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // The Force barrier

  private raiseBarrier(): void {
    this.state = 'barrier';
    this.step = 0;
    this.dir = dirOf(this.aimVec().x, this.aimVec().y);
    this.body.play(`${this.kit.key}_barrier_${this.dir}`);
    this.barrierCd = BARRIER.cooldown;
    // The dome springs up as her hands fly apart.
    this.world.time.delayedCall((SAGE_RELEASE.barrier / 12) * 1000, () => {
      if (!this.vitals.alive) return;
      this.dome?.end(false);
      this.dome = new Dome(this.world, this, this.kit.force);
      this.world.addEffect(this.dome);
      const dome = this.dome;
      heroTimers.follow(dome, 'ability', '', this.kit.force.hot, () => dome.timeLeft());
    });
    sound.forceGather();
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.barrierCd / BARRIER.cooldown;
    beamHud.over = 0;
    beamHud.firing = this.dome !== null;
    const since = this.clock - this.lastThrowAt;
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
    const busy = this.state !== 'free' ? 0.7 : 0;
    this.aura.setPosition(rx, ry - 16);
    this.aura.intensity = 0.25 + 0.55 * (1 - this.daylight) + busy;
  }
}

/**
 * A stone torn out of the ground: it rises to hang before her (or over her
 * head, the slab), spinning slowly in the Force, until she throws it. Then it
 * tumbles at its mark on an arc, its shadow sliding along the ground under
 * it, bending after a foe that moves, and shatters on the first body it
 * meets. The slab bursts where it lands.
 */
class Stone extends Fx {
  private img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private shade: Phaser.GameObjects.Image;
  private key: string;
  /** Its spot on the ground, and how high over it. */
  private x: number;
  private y: number;
  private z = 0;
  private flying = false;
  private foe: Hurtbox | null = null;
  private goal = { x: 0, y: 0 };
  private z0 = 0;
  private travelled = 0;
  private spin: number;
  private turn = 0;
  private trailT = 0;

  constructor(
    world: WorldScene,
    private kit: SageKit,
    private kind: StoneKind,
    x: number,
    y: number,
  ) {
    super(world, 4000);
    this.x = x;
    this.y = y;
    this.key = stoneKey(kit.meteor);
    this.shade = this.own(world.add.image(snap(x), snap(y), 'shadow').setDepth(1.5).setAlpha(0.5).setScale(kind === 'slab' ? 0.9 : 0.55));
    this.img = this.own(world.add.image(snap(x), snap(y), this.key, `${kind}_0`).setPipeline('Lit'));
    this.glow = this.own(world.add.image(snap(x), snap(y), `${this.key}_e`, `${kind}_0`).setBlendMode(Phaser.BlendModes.ADD));
    this.spin = (Math.random() < 0.5 ? -1 : 1) * (kind === 'slab' ? 5 : 9);
    this.draw();
  }

  /** Held: drifting up to (and bobbing at) where she holds it. */
  hold(at: { x: number; y: number; z: number }): void {
    if (this.flying) return;
    const k = 1 - Math.exp(-this.world.game.loop.delta / 90);
    this.x += (at.x - this.x) * k;
    this.y += (at.y - this.y) * k;
    this.z += (at.z + Math.sin(this.t * 0.012) * 1.2 - this.z) * k;
  }

  launch(foe: Hurtbox | null, far: { x: number; y: number }): void {
    this.flying = true;
    this.foe = foe;
    this.goal = foe ? { x: foe.x, y: foe.y } : far;
    this.z0 = this.z;
    this.spin *= 2.2;
    this.world.debris([this.kit.force.core, this.kit.force.hot], this.x, this.y - this.z, 4, this.y + 4, 'spores');
  }

  /** Let go before it was thrown: it falls and breaks where it is. */
  drop(): void {
    if (this.flying) return;
    this.flying = true;
    this.goal = { x: this.x, y: this.y + 1 };
    this.z0 = this.z;
  }

  protected step(dt: number): void {
    this.turn += (this.spin * dt) / 1000;
    if (this.flying && this.fly(dt)) return;
    this.draw();
  }

  /** One frame of flight; true once it has broken. */
  private fly(dt: number): boolean {
    const big = this.kind === 'slab';
    const speed = big ? HEAVE.speed : THROW.speed;
    if (this.foe?.alive) {
      // Bend after a foe that moves.
      const k = 1 - Math.exp(-dt / THROW.homing);
      this.goal.x += (this.foe.x - this.goal.x) * k;
      this.goal.y += (this.foe.y - this.goal.y) * k;
    }
    const steps = Math.max(1, Math.ceil((speed * dt) / 1000 / 3));
    for (let i = 0; i < steps; i++) {
      const dx = this.goal.x - this.x;
      const dy = this.goal.y - this.y;
      const left = Math.hypot(dx, dy);
      const move = Math.min(left, (speed * dt) / 1000 / steps);
      if (left > 0.01) {
        this.x += (dx / left) * move;
        this.y += (dy / left) * move;
      }
      this.travelled += move;
      // A low arc (a high one for the slab), coming down onto the foe's body or the ground.
      const u = clamp01(this.travelled / (this.travelled + Math.max(0, left - move) || 1));
      const end = this.foe?.alive && !big ? this.foe.bodyY : 0;
      this.z = this.z0 + (end - this.z0) * u + (big ? HEAVE.arc : THROW.arc) * 4 * u * (1 - u);
      if (!big && this.world.strikeAt(this.x, this.y - this.z, { damage: THROW.damage, knock: THROW.knock, fromX: this.x - (dx / (left || 1)) * 6, fromY: this.y - this.z - (dy / (left || 1)) * 6 })) {
        this.shatter(true);
        return true;
      }
      if (left - move <= 0.5 || this.travelled > (big ? HEAVE.range : THROW.range) + 30) {
        this.shatter(false);
        return true;
      }
    }
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 40;
      this.world.debris([this.kit.force.hot, this.kit.force.mid], this.x, this.y - this.z, 1, this.y + 4, 'trail');
    }
    return false;
  }

  private shatter(onFoe: boolean): void {
    const w = this.world;
    const big = this.kind === 'slab';
    const p = this.kit.force;
    const ax = this.x;
    const ay = this.y - this.z;
    w.debris(this.kit.grit, ax, ay, big ? 26 : 12, this.y + 6, 'burst');
    w.debris([p.core, p.hot], ax, ay, big ? 8 : 4, this.y + 7, 'burst');
    if (big) {
      // The slab bursts on the ground: a heavy blow at its heart and the shards over everything round.
      const struck = new Set<Hurtbox>();
      for (const h of w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - this.x, (b.y - this.y) / GROUND) <= HEAVE.splash + b.radius)) {
        const near = Math.hypot(h.x - this.x, (h.y - this.y) / GROUND) <= HEAVE.radius + h.radius;
        h.hurt({ damage: near ? HEAVE.damage : HEAVE.splashDamage, heavy: near, knock: near ? HEAVE.knock : 90, fromX: this.x, fromY: this.y - 2 });
        struck.add(h);
        w.addEffect(new HitSpark(w, h.x, h.y - h.bodyY, p, h.y + 13, near));
      }
      w.addEffect(new Crater(w, this.x, this.y, p, this.kit.meteor));
      bloom(w, this.x, this.y - 4, p.hot, 1.8, 300, this.y + 20);
      flare(w, this.x, this.y - 6, 90, p.light, 1.8, 380);
      w.cameras.main.shake(150, struck.size ? 0.0016 : 0.001);
      sound.forceStone(w.pan(this.x), 'big');
    } else {
      if (onFoe) {
        w.addEffect(new HitSpark(w, ax, ay, p, this.y + 13, false));
        w.cameras.main.shake(60, 0.00035);
      }
      sound.forceStone(w.pan(this.x), onFoe ? 'hit' : 'big');
    }
    this.destroy();
  }

  private draw(): void {
    const n = STONE_TURNS;
    const f = `${this.kind}_${((Math.floor((this.turn / (Math.PI * 2)) * n) % n) + n) % n}`;
    const rx = snap(this.x);
    const ry = snap(this.y - this.z);
    // In front of whatever stands behind its spot on the ground.
    const depth = this.y + 2;
    this.img.setFrame(f).setPosition(rx, ry).setDepth(depth);
    this.glow.setFrame(f).setPosition(rx, ry).setDepth(depth + 0.1);
    // The shadow shrinks and fades as it rises.
    const k = clamp01(1 - this.z / 50);
    this.shade.setPosition(rx, snap(this.y)).setAlpha(0.25 + 0.3 * k).setScale((this.kind === 'slab' ? 0.9 : 0.55) * (0.6 + 0.4 * k));
  }
}

/** Where the slab burst: a ring of dust and Force rolling out, and cracks that fade. */
class Crater extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
    private meteor: boolean,
  ) {
    super(world, 650);
    this.g = this.ink(HEAVE.splash * 2 + 20, Math.ceil(HEAVE.splash * 2 * GROUND) + 20);
  }

  protected step(): void {
    const k = this.t / this.life;
    const g = this.g.begin(this.x, this.y, 2.4);
    ring(g, this.x, this.y, HEAVE.splash * easeOut(Math.min(1, k * 2.2)), 2.2 * (1 - k) + 0.6, this.p, 1 - k);
    const dirt = this.meteor ? 0x2c2638 : 0x4a3a2a;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      for (let s = 2; s < 10; s++) {
        const x = this.x + Math.cos(a + Math.sin(s + i) * 0.15) * s;
        const y = this.y + Math.sin(a + Math.sin(s + i) * 0.15) * s * GROUND;
        if (dither(Math.round(x), Math.round(y)) > 1 - k) g.put(x, y, s < 4 && !this.meteor ? dirt : s < 4 ? this.p.hot : dirt, 0.85);
      }
    }
    g.end();
  }
}

/**
 * The Force barrier: a shimmering dome of light round her, its back half
 * drawn behind her and its front before her. Lattice bands of light circle
 * it, sparks crawl over it, and it flashes and ripples when it turns a blow.
 * It holds her barrier (Vitals.barrier) and eases foes off its edge; when
 * the barrier is spent, or its time is up, it bursts outward.
 */
class Dome extends Fx {
  private back: Ink;
  private front: Ink;
  private lamp: Phaser.GameObjects.Light;
  private x: number;
  private y: number;
  private flash = 0;
  private last: number;
  private ended = false;

  constructor(
    world: WorldScene,
    private hero: Sage,
    private p: Pal,
  ) {
    super(world, BARRIER.ms);
    this.x = hero.x;
    this.y = hero.y;
    const w = BARRIER.radius * 2 + 12;
    const h = BARRIER.height + Math.ceil(BARRIER.radius * GROUND) + 12;
    this.back = this.ink(w, h);
    this.front = this.ink(w, h);
    this.lamp = this.light(this.x, this.y - 10, 70, p.light, 0);
    hero.vitals.barrier = BARRIER.soak;
    this.last = BARRIER.soak;
    world.debris(p.tints, this.x, this.y - 10, 14, this.y + 12, 'burst');
    bloom(world, this.x, this.y - 10, p.hot, 1.6, 300, this.y + 14);
    sound.forceBarrier(world.pan(this.x), 'up');
  }

  follow(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  protected step(dt: number): void {
    const v = this.hero.vitals;
    // A blow it turned.
    if (v.barrier < this.last - 0.01) {
      this.flash = 1;
      sound.forceBarrier(this.world.pan(this.x), 'hit');
      this.world.debris([this.p.core, this.p.hot], this.x + (Math.random() - 0.5) * BARRIER.radius * 1.6, this.y - 6 - Math.random() * BARRIER.height * 0.7, 4, this.y + 12, 'burst');
    }
    this.last = v.barrier;
    this.flash = Math.max(0, this.flash - dt / 220);
    if (v.barrier <= 0 || !v.alive) {
      this.end(true);
      return;
    }
    // Foes inside are eased out to its edge.
    const R = BARRIER.radius;
    for (const h of this.world.hurtboxesWhere((b) => b.alive)) {
      const dx = h.x - this.x;
      const dy = (h.y - this.y) / GROUND;
      const d = Math.hypot(dx, dy);
      if (d > R + h.radius || d < 0.01) continue;
      const m = h as Hurtbox & { shove?(dx: number, dy: number): void };
      const s = Math.min(R + h.radius - d, (BARRIER.ease * dt) / 1000);
      m.shove?.((dx / d) * s, (dy / d) * s * GROUND);
    }
    this.draw();
    if (this.t + dt >= this.life) this.end(false);
  }

  /** It bursts outward, throwing foes back; `broken` when it gave way rather than ran out. */
  end(broken: boolean): void {
    if (this.ended) return;
    this.ended = true;
    const w = this.world;
    const p = this.p;
    const r = BARRIER.radius + BARRIER.burst;
    this.hero.vitals.barrier = 0;
    for (const h of w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - this.x, (b.y - this.y) / GROUND) <= r + b.radius)) {
      h.hurt({ damage: BARRIER.damage, heavy: true, knock: BARRIER.knock, fromX: this.x, fromY: this.y - 4 });
      w.addEffect(new HitSpark(w, h.x, h.y - h.bodyY, p, h.y + 13, true));
    }
    w.addEffect(new Burst(w, this.x, this.y, p));
    w.debris(p.tints, this.x, this.y - 10, broken ? 26 : 16, this.y + 14, 'burst');
    flare(w, this.x, this.y - 8, 110, p.light, broken ? 2.6 : 1.8, 420);
    w.cameras.main.shake(broken ? 160 : 110, broken ? 0.0014 : 0.0009);
    sound.forceBarrier(w.pan(this.x), 'break');
    sound.forcePush(w.pan(this.x));
    heroTimers.end(this);
    this.destroy();
  }

  private draw(): void {
    const { p, t } = this;
    const R = BARRIER.radius;
    const H = BARRIER.height;
    const cx = snap(this.x);
    const cy = snap(this.y);
    // It springs up fast, wavers when it's worn thin, and flashes when struck.
    const grow = easeOut(t / 180);
    const worn = this.hero.vitals.barrier / BARRIER.soak;
    const life = 1 - clamp01((t - (this.life - 400)) / 400) * 0.6;
    const a = Math.min(1, (0.55 + 0.35 * worn) * life + this.flash * 0.5);
    const r = R * (0.4 + 0.6 * grow);
    const h = H * grow;
    const b = this.back.begin(cx, cy - h / 2, cy - 0.5);
    const f = this.front.begin(cx, cy - h / 2, cy + 0.5);
    const put = (x: number, y: number, c: number, k: number, behind: boolean) => {
      const X = Math.round(x);
      const Y = Math.round(y);
      if (k < 1 && dither(X, Y) >= k) return;
      (behind ? b : f).put(X, Y, c, 1);
    };
    // The outline: a half-ellipse over her.
    for (let i = 0; i <= 60; i++) {
      const th = (i / 60) * Math.PI;
      put(cx + Math.cos(th) * r, cy - Math.sin(th) * h, i % 7 === 0 ? p.core : p.hot, a, false);
      put(cx + Math.cos(th) * (r - 1), cy - Math.sin(th) * (h - 1), p.mid, a * 0.6, false);
    }
    // Lattice bands circling it, rising slowly; the back half behind her, the front before her.
    for (let k = 0; k < 4; k++) {
      const u = ((k + t * 0.0007) % 4) / 4;
      const hy = h * u;
      const rr = r * Math.sqrt(1 - u * u);
      for (let i = 0; i < 48; i++) {
        const th = (i / 48) * Math.PI * 2;
        const x = cx + Math.cos(th) * rr;
        const y = cy - hy + Math.sin(th) * rr * GROUND;
        const near = Math.sin(th) > 0;
        if ((i + k) % 3 === 0) continue;
        put(x, y, near ? p.hot : p.mid, a * (near ? 0.75 : 0.45) * (1 - u * 0.5), !near);
      }
    }
    // Its rim on the ground.
    for (let i = 0; i < 64; i++) {
      const th = (i / 64) * Math.PI * 2;
      const near = Math.sin(th) > 0;
      put(cx + Math.cos(th) * r, cy + Math.sin(th) * r * GROUND, near ? p.core : p.hot, a, !near);
    }
    // A faint veil of light over the front, and sparks crawling over it.
    for (let y = Math.round(cy - h); y <= cy; y++) {
      const e = Math.sqrt(Math.max(0, 1 - ((cy - y) / (h || 1)) ** 2)) * r;
      for (let x = Math.round(cx - e) + 1; x < cx + e - 1; x++) if ((x + y) % 4 === 0) put(x, y, p.mid, a * (0.22 + this.flash * 0.35), false);
    }
    for (let i = 0; i < 6; i++) {
      const th = hash(i, Math.floor(t / 90), 3) * Math.PI;
      const up = hash(i, Math.floor(t / 90), 4);
      put(cx + Math.cos(th) * r * Math.sqrt(1 - up * up), cy - up * h, p.core, a, false);
    }
    b.end();
    f.end();
    this.lamp.setPosition(cx, cy - 10);
    this.lamp.intensity = 0.8 * a + this.flash * 1.4;
  }
}

/** The barrier's burst: a ring of the Force rolling out over the ground. */
class Burst extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
  ) {
    super(world, 380);
    const r = BARRIER.radius + BARRIER.burst + 6;
    this.g = this.ink(r * 2 + 8, Math.ceil(r * 2 * GROUND) + 8);
  }

  protected step(): void {
    const k = this.t / this.life;
    const g = this.g.begin(this.x, this.y, 2.4);
    ring(g, this.x, this.y, BARRIER.radius * 0.6 + (BARRIER.burst + BARRIER.radius * 0.4 + 4) * easeOut(k), 3 * (1 - k) + 0.7, this.p, 1 - k);
    g.end();
  }
}
