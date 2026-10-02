import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { INQ_CHEST_Y, INQ_H, INQ_ORIGIN_X, INQ_ORIGIN_Y, INQ_W, LEAP_FRAMES, THROW_RELEASE, WHIRL_HIT } from '../art/inquisitor';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { HitSpark, Shockwave, SlashArc, type Effect, type Scheme } from './Slash';
import { clamp01, dither, Ink, pal, type Pal } from './ultimate/ink';
import { flyingRing } from './ultimate/inquisitor';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Inquisitor: the Jedi class's hunter, on a rig of his own
// (art/inquisitor.ts), with a ring saber: a circular hilt with a blade out of
// each side.
//  - The attack throws it: it wheels out along the aim like a boomerang,
//    cutting everything on the way, and curves back to his hand cutting
//    again; while it's out he's empty-handed. With a foe right on top of
//    him he whirls it in his hand instead, a quick cut across his front.
//  - The ability is Hunter's leap: a Force leap onto the foe he aims at (or
//    the farthest one in a cone ahead), high over the ground, landing with
//    a ring of red shockwave that hurts and staggers everything round him.
//  - His Special, Purge, is in ultimate/inquisitor.ts.

const stats = HERO_STATS['jedi.inquisitor'];

// The thrown ring.
const THROW = {
  /** How far it flies out, and how long that takes (easing off at the end). */
  reach: 90,
  out: 260,
  /** It hangs at the far end, spinning, this long. */
  hover: 60,
  /** And comes home at this pace, px/s, turning to follow him. */
  back: 360,
  /** It cuts what comes within this of it, once on the way out and once on the way back. */
  radius: 11,
  outDamage: 9,
  backDamage: 7,
  /** Its height over the ground as it flies. */
  z: 11,
};
/** A foe this close (body to chest) gets the whirl instead of a throw. */
const CLOSE = 20;
const WHIRL = { reach: 24, spread: (100 * Math.PI) / 180, damage: 8 };

// Hunter's leap.
const LEAP = {
  /** The crouch before he springs, and the flight, ms. */
  crouch: 110,
  flight: 380,
  /** How high the arc rises. */
  height: 34,
  /** Its reach, the cone it looks for a foe in (half-angle), and where it lands with none. */
  reach: 96,
  cone: (40 * Math.PI) / 180,
  bare: 60,
  /** Lands this far short of the foe, not on top of it. */
  short: 9,
  /** The shockwave. */
  radius: 28,
  damage: 18,
  knock: 150,
  slow: 0.5,
  slowMs: 700,
  cooldown: 7000,
};

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'whirl' | 'throw' | 'catch' | 'crouch' | 'leap' | 'land';

/** How an Inquisitor look plays: its texture key and the colours of its blades and its Special. */
export interface InquisitorKit {
  key: string;
  blade: Scheme;
  /** The thrown ring, the leap's shockwave and Purge, in pixels. */
  pal: Pal;
  /** The blades' light on their surroundings. */
  light: number;
}

export const RINGBLADE_KIT: InquisitorKit = {
  key: 'jedi_inquisitor',
  blade: { core: 0xfff6f2, hot: 0xff6a62, mid: 0xf0283a, deep: 0xa00a22, light: 0xff4a3a },
  pal: pal(0xfff0ec, 0xff7a6a, 0xe8283a, 0x4a0610, 0xff4a4a),
  light: 0xff4a4a,
};

/** The Voidhunter: violet-white blades. */
export const VOIDHUNTER_KIT: InquisitorKit = {
  key: 'jedi_voidhunter',
  blade: { core: 0xfbf6ff, hot: 0xd0a8ff, mid: 0x9a5aff, deep: 0x4a1a9a, light: 0xb07aff },
  pal: pal(0xfbf6ff, 0xd0a8ff, 0x9a5aff, 0x2a0a4a, 0xb07aff),
  light: 0xa86aff,
};

/**
 * The ring saber thrown: out along the aim to its reach (or a wall), a beat
 * spinning there, then back to his hand wherever he's gone, cutting every
 * foe on the way out and again on the way back.
 */
class ThrownRing implements Effect {
  dead = false;
  private t = 0;
  private x: number;
  private y: number;
  private ex: number;
  private ey: number;
  /** Where it set out from. */
  private sx: number;
  private sy: number;
  private spin = 0;
  private back = false;
  private struck = new Set<Hurtbox>();
  private pix: Ink;
  private shadow: Phaser.GameObjects.Image;
  private lamp: Phaser.GameObjects.Light;
  /** Where it was the last few frames, for the smear of afterimages behind it. */
  private trail: { x: number; y: number; a: number }[] = [];

  constructor(
    private world: WorldScene,
    private owner: Inquisitor,
    x: number,
    y: number,
    dx: number,
    dy: number,
    private kit: InquisitorKit,
  ) {
    this.x = this.ex = x;
    this.y = this.ey = y;
    // Out to its reach, or as far as there is ground under it.
    for (let d = 4; d <= THROW.reach; d += 4) {
      const px = x + dx * d;
      const py = y + dy * d;
      if (!world.walkable(px, py)) break;
      this.ex = px;
      this.ey = py;
    }
    this.sx = x;
    this.sy = y;
    this.pix = new Ink(world, 64, 64);
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1.5).setAlpha(0.4).setScale(0.8, 0.5);
    this.lamp = world.lights.addLight(x, y - THROW.z, 50, kit.light, 1.2);
    sound.ringSaber(world.pan(x));
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const w = this.world;
    if (this.t < THROW.out) {
      const k = 1 - Math.pow(1 - this.t / THROW.out, 2);
      this.x = this.sx + (this.ex - this.sx) * k;
      this.y = this.sy + (this.ey - this.sy) * k;
    } else if (this.t >= THROW.out + THROW.hover) {
      if (!this.back) {
        // Turning for home: everything may be cut again.
        this.back = true;
        this.struck.clear();
      }
      const hx = this.owner.x;
      const hy = this.owner.y;
      const d = Math.hypot(hx - this.x, hy - this.y);
      const s = (THROW.back * dt) / 1000;
      if (d <= s + 5 || this.t > 2500) {
        this.owner.caught();
        this.destroy();
        return;
      }
      this.x += ((hx - this.x) / d) * s;
      this.y += ((hy - this.y) / d) * s;
    }
    this.spin += dt * 0.042;

    // Cut what it passes, each foe once a pass.
    const cy = this.y - THROW.z;
    for (const h of w.hurtboxesWhere((b) => b.alive && !this.struck.has(b) && Math.hypot(b.x - this.x, b.y - b.bodyY - cy) <= THROW.radius + b.radius)) {
      this.struck.add(h);
      h.hurt({ damage: this.back ? THROW.backDamage : THROW.outDamage, heavy: false, knock: 55, fromX: this.x, fromY: cy });
      w.addEffect(new HitSpark(w, h.x, h.y - h.bodyY, this.kit.blade, h.y + 13, false));
      sound.saberHit(w.pan(h.x));
    }

    this.trail.unshift({ x: this.x, y: cy, a: this.spin });
    if (this.trail.length > 5) this.trail.pop();
    const g = this.pix.begin(this.x, cy, this.y + 8);
    for (let i = this.trail.length - 1; i >= 1; i--) {
      const q = this.trail[i];
      flyingRing(g, q.x, q.y, q.a, this.kit.pal, 0.6 - i * 0.1, 0.55, true);
    }
    flyingRing(g, this.x, cy, this.spin, this.kit.pal, 1);
    // A spark now and then thrown off the spinning blades.
    if (dither(Math.round(this.t / 16), 3) < 0.3) w.debris([this.kit.pal.hot, this.kit.pal.mid], this.x, cy, 1, this.y + 8, 'trail');
    g.end();
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y));
    this.lamp.setPosition(this.x, cy);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.pix.destroy();
    this.shadow.destroy();
    this.world.lights.removeLight(this.lamp);
  }
}

export class Inquisitor implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals = new Vitals(stats.hp);
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: InquisitorKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  /** The blades' light round him, while the ring is in his hand. */
  private bladeLight: Phaser.GameObjects.Light;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  /** Towards the mouse on a computer (see Hero). */
  private aim: Aim | null = null;
  private clock = 0;
  private cooldown = 0;
  private specialCd = 0;
  private struck = false;
  /** Where the throw goes. */
  private throwDir = { x: 0, y: 1 };
  /** The ring in flight from a throw. */
  private thrown: ThrownRing | null = null;
  /** The Special has the ring. */
  private away = false;
  private dash = { vx: 0, vy: 0, t: 0 };
  // The leap in flight.
  private leap = { t: 0, x0: 0, y0: 0, x1: 0, y1: 0 };
  private lift = 0;

  private fx: Effect[] = [];

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: InquisitorKit = RINGBLADE_KIT) {
    this.world = world;
    this.kit = kit;
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = INQ_ORIGIN_X / INQ_W;
    const oy = INQ_ORIGIN_Y / INQ_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.bladeLight = world.lights.addLight(x, y, 44, kit.light, 0);
    this.body.play(`${key}_idle_down`);
    sound.ignite();

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      const k = anim.key;
      if (this.state === 'whirl' && k.startsWith(`${key}_whirl_`)) this.settle(40);
      else if (this.state === 'throw' && k.startsWith(`${key}_throw_`)) this.settle(0);
      else if (this.state === 'catch' && k.startsWith(`${key}_catch_`)) this.settle(30);
      else if (this.state === 'land' && k.startsWith(`${key}_land_`)) this.settle(60);
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
      this.thrown?.destroy();
    });
  }

  /** The ring is out of his hand (thrown, or whirling in Purge). */
  private get empty(): boolean {
    return this.away || !!this.thrown;
  }

  private settle(cooldown: number): void {
    this.state = 'free';
    this.cooldown = cooldown;
    this.body.play(`${this.kit.key}_${this.empty ? 'idle_bare' : 'idle'}_${this.dir}`);
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0 && !this.away) this.startLeap();
      else if (attack && !this.empty) this.startAttack();
    }

    if (this.state === 'crouch' || this.state === 'leap') this.updateLeap(dt);
    else {
      const pace = { free: Math.min(1, len), whirl: 0.35, throw: 0.4, catch: 0.7, crouch: 0, leap: 0, land: 0.1 }[this.state];
      let vx = moving ? (mx / len) * stats.speed * pace : 0;
      let vy = moving ? (my / len) * stats.speed * pace : 0;
      if (this.dash.t > 0) {
        vx += this.dash.vx;
        vy += this.dash.vy;
        this.dash.t -= dt;
      }
      this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);
    }

    if (this.state === 'free') {
      // Fighting faces the aim, even walking backwards; otherwise the way of the walk.
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const k = this.kit.key;
      const key = this.empty ? `${k}_${moving ? 'walk' : 'idle'}_bare_${this.dir}` : moving ? `${k}_walk_${this.dir}` : stand(this.body, `${k}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else if (this.state === 'whirl' || this.state === 'throw') {
      const f = this.body.anims.currentFrame;
      const at = f ? f.index - 1 : 0;
      if (!this.struck && at >= (this.state === 'whirl' ? WHIRL_HIT : THROW_RELEASE)) {
        this.struck = true;
        if (this.state === 'whirl') this.cut();
        else this.release();
      }
    }

    this.sync();
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.updateHud();
  }

  /** A foe right on top of him gets the whirl; otherwise the ring is thrown along the aim. */
  private startAttack(): void {
    const cx = this.x;
    const cy = this.y - INQ_CHEST_Y;
    const near = this.world
      .hurtboxesWhere((h) => h.alive && Math.hypot(h.x - cx, h.y - h.bodyY - cy) <= CLOSE + h.radius)
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
    this.struck = false;
    if (near) {
      this.state = 'whirl';
      this.dir = dirOf(near.x - cx, near.y - near.bodyY - cy);
      this.body.play(`${this.kit.key}_whirl_${this.dir}`);
      sound.saberSwing(3, this.world.pan(this.x));
      const u = this.facing();
      this.dash = { vx: u.x * 40, vy: u.y * 40, t: 100 };
      return;
    }
    this.state = 'throw';
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    this.throwDir = { x: a.x / l, y: a.y / l };
    this.dir = dirOf(a.x, a.y);
    this.body.play(`${this.kit.key}_throw_${this.dir}`);
    sound.saberSwing(1, this.world.pan(this.x));
  }

  /** The whirl lands: the spinning ring carves an arc across his front. */
  private cut(): void {
    const cx = snap(this.x);
    const cy = snap(this.y) - INQ_CHEST_Y;
    const deg = { right: 0, down: 90, left: 180, up: 270 }[this.dir];
    const way = this.dir === 'right' || this.dir === 'up' ? -1 : 1;
    this.fx.push(new SlashArc(this.world, cx, cy, deg - way * 100, deg + way * 100, 19, this.kit.blade, snap(this.y), 200));
    this.fx.push(new SlashArc(this.world, cx, cy, deg + 180 - way * 100, deg + 180 + way * 40, 13, { ...this.kit.blade, core: this.kit.blade.hot, hot: this.kit.blade.mid }, snap(this.y) - 0.1, 160));
    const hits = this.world.melee({ kind: 'arc', x: cx, y: cy, radius: WHIRL.reach, angle: (deg * Math.PI) / 180, spread: WHIRL.spread }, { damage: WHIRL.damage });
    for (const h of hits) {
      this.fx.push(new HitSpark(this.world, h.x, h.y, this.kit.blade, h.y + 13, false));
      sound.saberHit(this.world.pan(h.x));
    }
    if (hits.length) this.world.cameras.main.shake(60, 0.0003);
  }

  /** Let go: the ring flies from his hand along the aim. */
  private release(): void {
    const u = this.throwDir;
    const x = this.x + u.x * 6;
    const y = this.y + u.y * 4;
    this.thrown = new ThrownRing(this.world, this, x, y, u.x, u.y, this.kit);
    this.world.addEffect(this.thrown);
    this.dash = { vx: u.x * 30, vy: u.y * 30, t: 80 };
  }

  /** The thrown ring is back in his hand. */
  caught(): void {
    this.thrown = null;
    if (!this.body.scene) return;
    sound.ignite();
    this.world.debris([this.kit.pal.core, this.kit.pal.hot], this.x, this.y - INQ_CHEST_Y, 4, this.y + 10, 'burst');
    if (this.state === 'free' && !this.away) {
      this.state = 'catch';
      this.body.play(`${this.kit.key}_catch_${this.dir}`);
    }
  }

  /** Hunter's leap: pick his quarry, crouch, and spring. */
  private startLeap(): void {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    const ux = a.x / l;
    const uy = a.y / l;
    const ang = Math.atan2(uy, ux);
    const foes = this.world.hurtboxesWhere((h) => {
      if (!h.alive) return false;
      const d = Math.hypot(h.x - this.x, h.y - this.y);
      return d > 6 && d <= LEAP.reach && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(h.y - this.y, h.x - this.x) - ang)) <= LEAP.cone;
    });
    let tx: number;
    let ty: number;
    // The foe nearest where the mouse points, else the farthest in the cone.
    const spot = this.aim?.dist !== undefined ? { x: this.x + ux * this.aim.dist, y: this.y + uy * this.aim.dist - INQ_CHEST_Y } : null;
    const quarry = spot
      ? foes.sort((p, q) => Math.hypot(p.x - spot.x, p.y - spot.y) - Math.hypot(q.x - spot.x, q.y - spot.y))[0]
      : foes.sort((p, q) => Math.hypot(q.x - this.x, q.y - this.y) - Math.hypot(p.x - this.x, p.y - this.y))[0];
    if (quarry) {
      const d = Math.hypot(quarry.x - this.x, quarry.y - this.y) || 1;
      const s = Math.max(0, d - LEAP.short) / d;
      tx = this.x + (quarry.x - this.x) * s;
      ty = this.y + (quarry.y - this.y) * s;
    } else {
      const want = spot ? Phaser.Math.Clamp(this.aim!.dist!, 24, LEAP.reach) : LEAP.bare;
      tx = this.x + ux * want;
      ty = this.y + uy * want;
    }
    // Only as far as there is ground to land on.
    let end = { x: this.x, y: this.y };
    const steps = Math.ceil(Math.hypot(tx - this.x, ty - this.y) / 4);
    for (let i = 1; i <= steps; i++) {
      const x = this.x + ((tx - this.x) * i) / steps;
      const y = this.y + ((ty - this.y) * i) / steps;
      if (!this.world.walkable(x, y)) break;
      end = { x, y };
    }
    this.leap = { t: 0, x0: this.x, y0: this.y, x1: end.x, y1: end.y };
    this.dir = dirOf(end.x - this.x || ux, end.y - this.y || uy);
    this.state = 'crouch';
    this.specialCd = LEAP.cooldown;
    this.body.anims.stop();
    this.body.setFrame(`leap_${this.dir}_0`);
    this.world.evade(LEAP.crouch + LEAP.flight + 120);
    sound.forceGather();
  }

  private updateLeap(dt: number): void {
    const d = this.leap;
    d.t += dt;
    if (this.state === 'crouch') {
      if (d.t < LEAP.crouch) return;
      this.state = 'leap';
      d.t -= LEAP.crouch;
      this.world.debris(this.kit.pal.tints, this.x, this.y - 2, 8, this.y + 10, 'burst');
      sound.windDash(this.world.pan(this.x));
    }
    const k = clamp01(d.t / LEAP.flight);
    // Off the ground fast, hanging at the top, then dropping onto the quarry.
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    this.x = d.x0 + (d.x1 - d.x0) * e;
    this.y = d.y0 + (d.y1 - d.y0) * e;
    this.lift = LEAP.height * Math.sin(k * Math.PI);
    const f = k < 0.25 ? 1 : k < 0.6 ? 2 : LEAP_FRAMES - 1;
    this.body.setFrame(`leap_${this.dir}_${f}`);
    if (Math.floor(d.t / 35) !== Math.floor((d.t - dt) / 35)) this.world.debris([this.kit.pal.hot, this.kit.pal.mid], this.x, this.y - this.lift - 10, 1, this.y + 20, 'trail');
    if (k >= 1) this.landLeap();
  }

  /** He comes down: a ring of red shockwave round him, hurting and staggering every foe it reaches. */
  private landLeap(): void {
    this.lift = 0;
    const w = this.world;
    const x = snap(this.x);
    const y = snap(this.y);
    this.state = 'land';
    this.body.play(`${this.kit.key}_land_${this.dir}`);
    this.fx.push(new Shockwave(w, x, y - 1, LEAP.radius + 6, this.kit.blade));
    const hits = w.melee({ kind: 'circle', x, y: y - 6, radius: LEAP.radius }, { damage: LEAP.damage, heavy: true, knock: LEAP.knock, fromX: x, fromY: y });
    for (const h of hits) this.fx.push(new HitSpark(w, h.x, h.y, this.kit.blade, h.y + 13, true));
    for (const h of w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - x, b.y - b.bodyY - (y - 6)) <= LEAP.radius + b.radius)) h.slow?.(LEAP.slow, LEAP.slowMs, this.kit.pal.hot);
    w.debris(this.kit.pal.tints, x, y - 2, 14, y + 10, 'burst');
    w.cameras.main.shake(200, 0.0012);
    sound.slam(w.pan(x));
    sound.saberHit(w.pan(x), true);
  }

  private facing(): { x: number; y: number } {
    const a = ({ right: 0, down: 90, left: 180, up: 270 }[this.dir] * Math.PI) / 180;
    return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
  }

  private updateHud(): void {
    // The ability button's ring refills over the leap's cooldown and glows when ready.
    beamHud.charge = 1 - this.specialCd / LEAP.cooldown;
    beamHud.over = 0;
    beamHud.firing = this.state === 'crouch' || this.state === 'leap';
    comboHud.hits = 0;
    comboHud.window = 0;
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const up = snap(this.lift);
    const frame = this.body.frame.name;
    this.body.setPosition(rx, ry - up).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry - up).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    // The shadow stays on the ground, shrinking as he rises.
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha).setScale(1 - up / 80);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha * (1 - up / 45));
    // The blades light the ground at his side, brightest at night; with the ring away its own light shines.
    this.bladeLight.setPosition(rx + (this.dir === 'right' ? 6 : this.dir === 'left' ? -6 : this.dir === 'up' ? 7 : -7), ry - 8 - up);
    this.bladeLight.intensity = this.empty ? 0 : 0.35 + 0.75 * (1 - this.daylight);
  }

  holdSaber(away: boolean): void {
    this.away = away;
    if (away && this.thrown) {
      // Purge takes the ring wherever it is.
      this.thrown.destroy();
      this.thrown = null;
    }
    if (!away && this.body.scene) sound.ignite();
  }
}
