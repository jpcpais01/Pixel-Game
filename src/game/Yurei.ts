import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { OFUDA_FRAMES, YUREI_CHEST_Y, YUREI_H, YUREI_ORIGIN_X, YUREI_ORIGIN_Y, YUREI_W } from '../art/yurei';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { Phase, PHASE_SPEED } from './phase';
import { bloom, clamp01, column, dither, easeOut, flare, Fx, GROUND, hash, Ink, pal, ring, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';
import { heroTimers } from './timers';

// The Yurei (the Phantom's third type): a Japanese ghost in a white burial
// kimono, her long black hair hanging over her face, spirit flames circling.
//  - Attack (held): Ofuda. She flicks paper talismans the way she aims; each
//    flies to the first foe it meets and sticks there, and after a beat bursts
//    into blue spirit-fire. A foe carrying three at once goes up in one bigger
//    flame that catches those beside it.
//  - Ability: Grasping hair. Her hair pours out along the ground to a spot
//    ahead and spreads into a pool there; every foe in it is wrapped and held
//    fast, the strands wringing it, until the hair slithers back.
//  - Special: Hundred Candles (see ultimate/yurei.ts).
// Like every Phantom she phases through the next blow (see phase.ts).
// Yuki-onna throws frost-paper, her fire burns ice-white with snow, and her
// silver hair rimes the ground; she plays the same.

const THROW_EVERY = 360;
/** The talisman leaves her fingers this long into the flick. */
const THROW_AT = 110;
const THROW_RANGE = 150;
const THROW_SPEED = 250;
const AIM_CONE = Math.cos((55 * Math.PI) / 180);
/** Sticking: a little sting, then after IGNITE_MS it burns. */
const STICK_DAMAGE = 3;
const IGNITE_MS = 900;
const IGNITE_DAMAGE = 7;
/** Three at once on one foe: all go up together. */
const BURST_COUNT = 3;
const BURST_DAMAGE = 27;
const BURST_R = 24;
const BURST_SPLASH = 10;

const HAIR_COOLDOWN = 6000;
/** How far ahead the hair pours: as far as she aims, within these. */
const HAIR_MIN = 28;
const HAIR_MAX = 80;
const HAIR_DEFAULT = 62;
/** The hair streams out along the ground, then spreads. */
const POUR_MS = 240;
const SPREAD_MS = 160;
const HOLD_MS = 1500;
const RETRACT_MS = 380;
const POOL_R = 28;
const GRAB_DAMAGE = 6;
const WRING_EVERY = 300;
const WRING_DAMAGE = 3;
/** A boss can't be held: it wades through, slowed. */
const BOSS_SLOW = 0.45;
/** She stays bowed this long into the pour. */
const HAIR_POSE_MS = 650;

/** The spirit flames circling her. */
const WISPS = 3;
const WISP_RX = 13;
const WISP_RY = 6;

type State = 'free' | 'throw' | 'hair';
type Bindable = Hurtbox & { bind?(ms: number, lift: number): boolean };

export interface YureiKit {
  key: string;
  yuki: boolean;
  maxHp: number;
  speed: number;
  /** Talisman sheet (frames f0..f3 turning, f4 stuck) and hitodama sheet (its animation is `<wisp>_flicker`). */
  ofuda: string;
  wisp: string;
  /** Her hair on the ground: its body, its strands, its sheen. */
  hair: [number, number, number];
  pal: Pal;
}

export const YUREI_KIT: YureiKit = {
  key: 'yurei',
  yuki: false,
  maxHp: HERO_STATS['phantom.yurei'].hp,
  speed: HERO_STATS['phantom.yurei'].speed,
  ofuda: 'yurei_ofuda',
  wisp: 'yurei_wisp',
  hair: [0x06070d, 0x161a28, 0x3a4462],
  pal: pal(0xf0f8ff, 0x8ac8ff, 0x3a7ae0, 0x14306a, 0x8ac8ff),
};

/** Yuki-onna: frost-paper, ice-white fire, silver hair. */
export const YUKI_KIT: YureiKit = {
  ...YUREI_KIT,
  key: 'yurei_yuki',
  yuki: true,
  ofuda: 'yurei_ofuda_yuki',
  wisp: 'yurei_wisp_yuki',
  hair: [0x26304e, 0x5e7298, 0xc0d2ee],
  pal: pal(0xffffff, 0xd8f4ff, 0x8ad0f4, 0x3a78b0, 0xc8ecff),
};

/** Talismans stuck on each foe right now, oldest first. */
const stuckOn = new WeakMap<Hurtbox, Ofuda[]>();

export class Yurei implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: YureiKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private aura: Phaser.GameObjects.Light;
  private phase: Phase;
  private state: State = 'free';
  private stateT = 0;
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private clock = 0;
  private throwT = 0;
  private pendingThrow = -1;
  private hairCd = 0;
  private prevSpecial = false;
  /** The foe last given a talisman, for the HUD's pips. */
  private marked: Hurtbox | null = null;
  private wisps: Phaser.GameObjects.Sprite[] = [];

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: YureiKit = YUREI_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = YUREI_ORIGIN_X / YUREI_W;
    const oy = YUREI_ORIGIN_Y / YUREI_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(0.75, 0.65);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 60, kit.pal.light, 0);
    this.phase = new Phase(world, this, kit.pal.hot);
    for (let i = 0; i < WISPS; i++) {
      this.wisps.push(world.add.sprite(x, y, kit.wisp, 'w0').setBlendMode(Phaser.BlendModes.ADD).play({ key: `${kit.wisp}_flicker`, startFrame: i * 2 }));
    }
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (this.state === 'throw' && anim.key.startsWith(`${key}_throw_`)) this.state = 'free';
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.phase.destroy();
      for (const o of this.wisps) o.destroy();
    });
  }

  dodge(): boolean {
    return this.phase.dodge();
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    this.stateT += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.throwT = Math.max(0, this.throwT - dt);
    this.hairCd = Math.max(0, this.hairCd - dt);
    this.phase.update(dt);
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;

    // The talisman leaves her fingers partway into the flick.
    if (this.pendingThrow >= 0) {
      this.pendingThrow -= dt;
      if (this.pendingThrow < 0) this.release();
    }
    if (this.state === 'hair' && this.stateT >= HAIR_POSE_MS) this.state = 'free';

    if (this.state !== 'hair') {
      if (pressed && this.hairCd === 0) this.grasp();
      else if (attack && this.throwT === 0) this.flick();
    }

    const k = this.state === 'hair' ? 0.2 : this.state === 'throw' ? 0.75 : 1;
    const speed = this.kit.speed * k * (this.phase.active ? PHASE_SPEED : 1) * Math.min(1, len);
    if (moving) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * speed * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * speed * (dt / 1000), bounds.top, bounds.bottom);
    }
    if (this.state === 'free') {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_move_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    }
    this.sync();
    this.updateHud();
  }

  // -------------------------------------------------------------------------

  /** Draw a talisman up between two fingers and snap it out the way she aims. */
  private flick(): void {
    const u = this.aimVec();
    this.throwT = THROW_EVERY;
    this.state = 'throw';
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_throw_${this.dir}`, true);
    this.pendingThrow = THROW_AT;
  }

  private release(): void {
    const u = this.aimVec();
    const foe = this.pick(u);
    const side = this.dir === 'left' ? -1 : this.dir === 'right' ? 1 : 0;
    const x = this.x + side * 7 + (this.dir === 'down' ? 3 : 0);
    const y = this.y - YUREI_CHEST_Y - (this.dir === 'up' ? 4 : 0);
    const goal = foe ?? { x: this.x + u.x * THROW_RANGE, y: this.y + u.y * THROW_RANGE, bodyY: YUREI_CHEST_Y };
    this.world.addEffect(new Ofuda(this.world, x, y, goal, this.kit, (h) => (this.marked = h)));
    sound.knife(this.world.pan(x), 1, false);
  }

  private pick(u: { x: number; y: number }): Hurtbox | null {
    const cx = this.x;
    const cy = this.y - YUREI_CHEST_Y;
    let best: Hurtbox | null = null;
    let bestD = Infinity;
    for (const h of this.world.hurtboxesWhere((b) => b.alive)) {
      const dx = h.x - cx;
      const dy = h.y - h.bodyY - cy;
      const d = Math.hypot(dx, dy);
      if (d > THROW_RANGE || d === 0 || (dx * u.x + dy * u.y) / d < AIM_CONE) continue;
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  /** She bows, and her hair pours out along the ground to a spot ahead. */
  private grasp(): void {
    const u = this.aimVec();
    const reach = Phaser.Math.Clamp(this.aim?.dist ?? HAIR_DEFAULT, HAIR_MIN, HAIR_MAX);
    // Stop short of where the ground runs out, so the pool lands where she can reach.
    let d = reach;
    while (d > HAIR_MIN && !this.world.walkable(this.x + u.x * d, this.y + u.y * d)) d -= 6;
    this.state = 'hair';
    this.stateT = 0;
    this.hairCd = HAIR_COOLDOWN;
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_hair_${this.dir}`, true);
    const fx = new HairPool(this.world, this.x, this.y, this.x + u.x * d, this.y + u.y * d, this.kit);
    this.world.addEffect(fx);
    heroTimers.follow(fx, 'ability', '', this.kit.pal.hot, () => fx.timeLeft());
    sound.bog(this.world.pan(this.x));
    sound.wail(this.world.pan(this.x));
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.hairCd / HAIR_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'hair';
    // The pips: talismans on the foe she last marked, and how long till the oldest burns.
    const on = this.marked && this.marked.alive ? stuckOn.get(this.marked) ?? [] : [];
    comboHud.max = BURST_COUNT;
    comboHud.hits = on.length;
    comboHud.window = on.length ? clamp01(1 - on[0].age / IGNITE_MS) : 0;
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    const a = this.alpha * this.phase.opacity;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(a);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    // She floats: a soft shadow, a little off the ground.
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha * 0.5);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * a * 0.6);
    this.aura.setPosition(rx, ry - 18);
    this.aura.intensity = 0.7 * (1 - this.daylight) + 0.2;
    // The hitodama wheel round her, each at its own height, passing behind and before her.
    this.wisps.forEach((o, i) => {
      const q = this.clock * 0.0014 + (i / WISPS) * Math.PI * 2;
      const ox = Math.cos(q) * WISP_RX;
      const oy = Math.sin(q) * WISP_RY;
      const lift = 20 + [0, 5, -3][i % 3] + Math.sin(this.clock * 0.003 + i * 2) * 2;
      o.setPosition(snap(this.x + ox), snap(this.y + oy - lift))
        .setDepth(this.y + (oy > 0 ? 0.3 : -0.3))
        .setAlpha(a * (oy > 0 ? 0.95 : 0.6));
    });
  }
}

// ---------------------------------------------------------------------------

/** A burst of spirit-fire standing on a spot: a licking column of flame, and for a big one a ring of it on the ground. */
export class SpiritFire extends Fx {
  private g: Ink;
  private h: number;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private ground: number,
    private kit: YureiKit,
    private big: boolean,
  ) {
    super(world, big ? 560 : 380);
    this.h = big ? 34 : 18;
    this.g = this.ink(big ? 64 : 24, this.h + 24);
    const p = kit.pal;
    world.debris([0xffffff, p.hot, p.mid], x, y, big ? 18 : 7, ground + 4, 'burst');
    if (kit.yuki) world.debris([0xffffff, 0xe8f6ff], x, y, big ? 14 : 5, ground + 4, 'spores');
    bloom(world, x, y, p.hot, big ? 2 : 0.9, big ? 420 : 260, ground + 6, big ? 0.9 : 0.7);
    if (big) flare(world, x, y, 110, p.light, 2.4, 420);
  }

  protected step(): void {
    const k = this.t / this.life;
    const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
    const g = this.g.begin(this.x, this.ground + 6, this.ground + 2, 0.5, 1);
    const tall = this.h * (0.55 + 0.45 * easeOut(k * 3)) * (1 - k * 0.35);
    // The fire rises from the body it caught on, licking up past it.
    column(g, this.x, this.y + 4, tall, this.big ? 5 : 3, this.kit.pal, a, this.t);
    if (this.big) ring(g, this.x, this.ground, BURST_R * easeOut(k * 1.6), 1.5 * (1 - k) + 0.5, this.kit.pal, a * 0.9);
    // Tongues of flame breaking off and drifting up.
    for (let i = 0; i < (this.big ? 7 : 3); i++) {
      const s = hash(i, 7) * Math.PI * 2;
      const up = (k * (30 + hash(i, 3) * 20) + hash(i, 5) * 6) % (this.h + 4);
      const fx = this.x + Math.cos(s) * (this.big ? 8 : 4) + Math.sin(this.t * 0.01 + i) * 1.5;
      const fy = this.y - up;
      g.put(fx, fy, this.kit.pal.core, a);
      g.put(fx, fy + 1, this.kit.pal.hot, a * 0.8);
    }
    g.end();
  }
}

/**
 * A talisman in flight: it flutters toward its mark (bending after a live
 * one) and sticks flat to the first body it meets, or drifts down and fades
 * at the end of its flight. Stuck, it smoulders a beat and then bursts into
 * spirit-fire; the third on one foe sets them all off at once.
 */
class Ofuda extends Fx {
  private img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private vx = 0;
  private vy = 0;
  private travelled = 0;
  private host: Hurtbox | null = null;
  private ox = 0;
  private oy = 0;
  /** Time since it stuck. */
  age = 0;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private goal: { x: number; y: number; bodyY: number; alive?: boolean },
    private kit: YureiKit,
    private onStick: (h: Hurtbox) => void,
  ) {
    super(world, 4000);
    this.img = this.own(world.add.image(snap(x), snap(y), kit.ofuda, 'f0').setPipeline('Lit'));
    this.glow = this.own(world.add.image(snap(x), snap(y), `${kit.ofuda}_e`, 'f0').setBlendMode(Phaser.BlendModes.ADD));
    const dx = goal.x - x;
    const dy = goal.y - goal.bodyY - y;
    const l = Math.hypot(dx, dy) || 1;
    this.vx = (dx / l) * THROW_SPEED;
    this.vy = (dy / l) * THROW_SPEED;
    world.debris([0xffffff, kit.pal.hot], x, y, 3, y + 20, 'spores');
  }

  protected step(dt: number): void {
    if (this.host) this.stuck(dt);
    else this.fly(dt);
  }

  private fly(dt: number): void {
    const w = this.world;
    const s = dt / 1000;
    if (this.goal.alive) {
      const dx = this.goal.x - this.x;
      const dy = this.goal.y - this.goal.bodyY - this.y;
      const l = Math.hypot(dx, dy) || 1;
      const k = 1 - Math.exp(-dt / 140);
      this.vx += ((dx / l) * THROW_SPEED - this.vx) * k;
      this.vy += ((dy / l) * THROW_SPEED - this.vy) * k;
    }
    const steps = Math.ceil((THROW_SPEED * s) / 4);
    for (let i = 0; i < steps; i++) {
      this.x += (this.vx * s) / steps;
      this.y += (this.vy * s) / steps;
      this.travelled += (THROW_SPEED * s) / steps;
      const h = w.firstHurtbox((b) => {
        const ex = (this.x - b.x) / (b.radius + 2);
        const ey = (this.y - (b.y - b.bodyY)) / (b.bodyY + 3);
        return ex * ex + ey * ey <= 1;
      });
      if (h) {
        this.stick(h);
        return;
      }
    }
    if (this.travelled >= THROW_RANGE + 10) {
      // Spent: it flutters to the ground and goes out.
      w.debris([this.kit.pal.mid, 0xffffff], this.x, this.y, 4, this.y + YUREI_CHEST_Y, 'spores');
      this.destroy();
      return;
    }
    // Fluttering, its long side along its flight.
    const f = `f${Math.floor(this.t / 45) % OFUDA_FRAMES}`;
    const r = Math.atan2(this.vy, this.vx) + Math.PI / 2;
    const depth = this.y + YUREI_CHEST_Y + 2;
    this.img.setFrame(f).setPosition(snap(this.x), snap(this.y)).setRotation(r).setDepth(depth);
    this.glow.setFrame(f).setPosition(snap(this.x), snap(this.y)).setRotation(r).setDepth(depth + 0.1);
    if (Math.floor(this.t / 40) !== Math.floor((this.t - dt) / 40)) w.debris([this.kit.pal.hot, this.kit.pal.mid], this.x, this.y, 1, depth, 'trail');
  }

  private stick(h: Hurtbox): void {
    const w = this.world;
    this.host = h;
    this.ox = Phaser.Math.Clamp(this.x - h.x, -h.radius * 0.6, h.radius * 0.6);
    this.oy = Phaser.Math.Clamp(this.y - (h.y - h.bodyY), -h.bodyY * 0.5, h.bodyY * 0.4);
    h.hurt({ damage: STICK_DAMAGE, heavy: false, knock: 25, fromX: this.x - this.vx * 0.03, fromY: this.y - this.vy * 0.03 });
    w.debris([0xffffff, this.kit.pal.hot], this.x, this.y, 4, h.y + 6, 'burst');
    sound.arrowStick(w.pan(this.x), 0.35);
    this.img.setRotation((Math.random() - 0.5) * 0.5);
    this.glow.setRotation(this.img.rotation);
    this.onStick(h);
    const on = stuckOn.get(h) ?? [];
    on.push(this);
    stuckOn.set(h, on);
    if (on.length >= BURST_COUNT) burst(w, h, on, this.kit);
  }

  private stuck(dt: number): void {
    const h = this.host!;
    if (!h.alive) {
      this.unstick();
      this.world.debris([this.kit.pal.mid, 0xffffff], this.x, this.y, 3, h.y + 6, 'spores');
      this.destroy();
      return;
    }
    this.age += dt;
    this.x = h.x + this.ox;
    this.y = h.y - h.bodyY + this.oy;
    const depth = h.y + 0.5;
    // Smouldering: its glow quickens as it nears igniting.
    const k = this.age / IGNITE_MS;
    const pulse = 0.55 + 0.45 * Math.sin(this.age * (0.01 + k * 0.03));
    const f = `f${OFUDA_FRAMES}`;
    this.img.setFrame(f).setPosition(snap(this.x), snap(this.y)).setDepth(depth);
    this.glow.setFrame(f).setPosition(snap(this.x), snap(this.y)).setDepth(depth + 0.1).setAlpha(0.4 + 0.6 * pulse * (0.4 + k * 0.6));
    if (k > 0.5 && Math.floor(this.age / 90) !== Math.floor((this.age - dt) / 90)) this.world.debris([this.kit.pal.hot, this.kit.pal.core], this.x, this.y - 2, 1, depth + 1, 'spores');
    if (this.age >= IGNITE_MS) this.ignite();
  }

  /** It goes up in spirit-fire on its own. */
  private ignite(): void {
    const w = this.world;
    const h = this.host!;
    this.unstick();
    h.hurt({ damage: IGNITE_DAMAGE, heavy: false, knock: 15, fromX: this.x, fromY: this.y - 4, poison: this.kit.pal.hot });
    w.addEffect(new SpiritFire(w, this.x, this.y, h.y, this.kit, false));
    sound.sizzle(w.pan(this.x));
    this.destroy();
  }

  /** Taken off the foe's count (burnt, or the foe gone). */
  unstick(): void {
    const h = this.host;
    if (!h) return;
    const on = stuckOn.get(h);
    if (on) {
      const i = on.indexOf(this);
      if (i >= 0) on.splice(i, 1);
    }
  }
}

/** Three talismans on one foe: they all go up together in one great flame that catches its neighbours. */
function burst(w: WorldScene, h: Hurtbox, on: Ofuda[], kit: YureiKit): void {
  for (const o of [...on]) {
    o.unstick();
    o.destroy();
  }
  const x = h.x;
  const y = h.y - h.bodyY;
  h.hurt({ damage: BURST_DAMAGE, heavy: true, knock: 110, fromX: x, fromY: h.y + 6, poison: kit.pal.hot });
  for (const b of w.hurtboxesWhere((b) => b.alive && b !== h && Math.hypot(b.x - h.x, (b.y - h.y) / GROUND) <= BURST_R + b.radius)) {
    b.hurt({ damage: BURST_SPLASH, heavy: false, knock: 70, fromX: h.x, fromY: h.y, poison: kit.pal.hot });
    w.debris(kit.pal.tints, b.x, b.y - b.bodyY, 4, b.y + 6, 'burst');
  }
  w.addEffect(new SpiritFire(w, x, y, h.y, kit, true));
  w.cameras.main.shake(110, 0.0008);
  sound.fireball(w.pan(x));
  sound.soulHit(w.pan(x));
}

// ---------------------------------------------------------------------------

/**
 * Grasping hair: a river of her hair streams along the ground from her feet to
 * the spot, then spreads there into a pool of strands. Every foe in it (and
 * any that wander in while it lasts) is wrapped where it stands, the strands
 * coiling up its body and wringing it; a boss only wades, slowed. Then the
 * hair slithers back and sinks away.
 */
class HairPool extends Fx {
  private ground: Ink;
  private wraps = new Map<Hurtbox, Ink>();
  private held = new Set<Hurtbox>();
  private spread = false;
  private wringT = 0;
  private readonly x: number;
  private readonly y: number;
  private readonly len: number;
  private readonly ux: number;
  private readonly uy: number;

  constructor(
    world: WorldScene,
    private fromX: number,
    private fromY: number,
    tx: number,
    ty: number,
    private kit: YureiKit,
  ) {
    super(world, POUR_MS + SPREAD_MS + HOLD_MS + RETRACT_MS);
    this.x = tx;
    this.y = ty;
    this.len = Math.hypot(tx - fromX, ty - fromY) || 1;
    this.ux = (tx - fromX) / this.len;
    this.uy = (ty - fromY) / this.len;
    const w = Math.ceil(Math.abs(tx - fromX) + POOL_R * 2 + 24);
    const h = Math.ceil(Math.abs(ty - fromY) + POOL_R * 2 * GROUND + 40);
    this.ground = this.ink(w, h);
  }

  protected step(dt: number): void {
    const w = this.world;
    const t = this.t;
    const holdEnd = POUR_MS + SPREAD_MS + HOLD_MS;
    const out = t < POUR_MS ? easeOut(t / POUR_MS) : t < holdEnd ? 1 : 1 - clamp01((t - holdEnd) / RETRACT_MS);
    const pool = t < POUR_MS ? 0 : t < POUR_MS + SPREAD_MS ? easeOut((t - POUR_MS) / SPREAD_MS) : t < holdEnd ? 1 : 1 - easeOut((t - holdEnd) / RETRACT_MS);
    // The river sinks into the ground once the pool has it; it surfaces again to draw the hair back.
    const river = t < POUR_MS + SPREAD_MS ? 1 : t < holdEnd - 200 ? 1 - clamp01((t - POUR_MS - SPREAD_MS) / 400) : clamp01((t - holdEnd + 200) / 200);

    if (pool > 0 && !this.spread) {
      this.spread = true;
      this.wringT = WRING_EVERY;
      w.debris([this.kit.hair[2], this.kit.pal.mid, this.kit.hair[1]], this.x, this.y, 16, this.y + 4, 'burst');
      bloom(w, this.x, this.y - 2, this.kit.pal.mid, 1.8, 380, this.y + 20, 0.6);
      w.cameras.main.shake(90, 0.0006);
      sound.bog(w.pan(this.x));
      this.grab(true);
    }
    if (this.spread && t < holdEnd) {
      this.wringT -= dt;
      if (this.wringT <= 0) {
        this.wringT = WRING_EVERY;
        this.grab(false);
      }
    }

    // Draw: the river and the pool on the ground.
    const g = this.ground.begin((this.fromX + this.x) / 2, (this.fromY + this.y) / 2, 3);
    if (river > 0) this.drawRiver(g, out, river);
    if (pool > 0) this.drawPool(g, pool);
    g.end();
    // The strands wrapped round each foe held.
    for (const [h, ink] of this.wraps) {
      if (!h.alive || pool <= 0) {
        ink.destroy();
        this.wraps.delete(h);
        continue;
      }
      this.drawWrap(ink, h, pool);
    }
  }

  /** Grip every foe in the pool: newcomers are bound for what's left of the hold; all held are wrung. */
  private grab(first: boolean): void {
    const w = this.world;
    const left = POUR_MS + SPREAD_MS + HOLD_MS - this.t;
    if (left <= 0) return;
    const inPool = w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - this.x, (b.y - this.y) / GROUND) <= POOL_R + b.radius * 0.5);
    for (const h of inPool) {
      const fresh = !this.held.has(h);
      if (fresh) {
        this.held.add(h);
        const bound = (h as Bindable).bind?.(left + 60, 0);
        if (!bound) h.slow?.(BOSS_SLOW, left + 60, this.kit.pal.mid);
        h.hurt({ damage: GRAB_DAMAGE, heavy: false, knock: 0, fromX: h.x, fromY: h.y + 4 });
        w.debris([this.kit.hair[2], this.kit.pal.hot], h.x, h.y - 2, 5, h.y + 4, 'burst');
        if (!this.wraps.has(h) && this.wraps.size < 8) this.wraps.set(h, new Ink(w, Math.ceil(h.radius * 2 + 8), Math.ceil(h.bodyY * 2 + 10)));
      } else if (!first) {
        h.hurt({ damage: WRING_DAMAGE, heavy: false, knock: 0, fromX: h.x, fromY: h.y + 4, poison: this.kit.pal.mid });
      }
    }
    if (!first && inPool.length) sound.creak(w.pan(this.x));
  }

  private drawRiver(g: Ink, out: number, a: number): void {
    const [body, strand, sheen] = this.kit.hair;
    const nx = -this.uy;
    const ny = this.ux;
    const reach = this.len * out;
    const n = Math.ceil(reach);
    for (let s = 0; s < 8; s++) {
      const off = (s - 3.5) * 0.9;
      for (let i = 0; i <= n; i++) {
        const k = i / this.len;
        // Strands bunch at her feet, fan a little as they run, and wriggle.
        const o = off * (0.6 + 0.6 * k) + Math.sin(i * 0.35 - this.t * 0.02 + s * 1.3) * 0.9;
        const x = this.fromX + this.ux * i + nx * o;
        const y = this.fromY + this.uy * i + ny * o * GROUND;
        if (a < 1 && dither(Math.round(x), Math.round(y)) >= a) continue;
        const lit = (i + s * 5 + Math.floor(this.t / 60)) % 11 === 0;
        g.put(x, y, lit ? sheen : s % 2 ? strand : body, 1);
      }
    }
    // The glint racing along the leading edge.
    const tipX = this.fromX + this.ux * reach;
    const tipY = this.fromY + this.uy * reach;
    if (out < 1) {
      g.put(tipX, tipY, this.kit.pal.core, 1);
      g.put(tipX - this.ux, tipY - this.uy, this.kit.pal.hot, 0.8);
    }
  }

  private drawPool(g: Ink, k: number): void {
    const [body, strand, sheen] = this.kit.hair;
    const p = this.kit.pal;
    const R = POOL_R * k;
    // A dim glow rimming the pool.
    ring(g, this.x, this.y, R + 1, 1, p, 0.35 * k);
    // Strands radiating from the middle, each its own length, curling at the tip.
    const n = 34;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2 + hash(i, 1) * 0.2;
      const r = R * (0.7 + hash(i, 2) * 0.3);
      for (let d = 0; d <= r; d++) {
        const wob = Math.sin(d * 0.4 + this.t * 0.012 + i) * 0.12;
        const x = this.x + Math.cos(th + wob) * d;
        const y = this.y + Math.sin(th + wob) * d * GROUND;
        const lit = (d + i * 3 + Math.floor(this.t / 70)) % 13 === 0;
        g.put(x, y, lit ? sheen : i % 2 ? strand : body, 1);
      }
    }
    // Filled in under the strands, thinning toward the rim.
    const ry = Math.ceil(R * GROUND);
    for (let dy = -ry; dy <= ry; dy++)
      for (let dx = -Math.ceil(R); dx <= R; dx++) {
        const d = Math.hypot(dx, dy / GROUND) / (R || 1);
        if (d > 0.85) continue;
        const xx = Math.round(this.x + dx);
        const yy = Math.round(this.y + dy);
        if (dither(xx, yy) < d * 0.9) continue;
        g.put(xx, yy, body, 0.92);
      }
    // Tendrils reaching up out of the pool, grasping at the air.
    for (let i = 0; i < 5; i++) {
      const th = hash(i, 9) * Math.PI * 2;
      const r = R * (0.25 + hash(i, 4) * 0.6);
      const bx = this.x + Math.cos(th) * r;
      const by = this.y + Math.sin(th) * r * GROUND;
      const tall = (5 + hash(i, 6) * 6) * k * (0.7 + 0.3 * Math.sin(this.t * 0.008 + i * 2));
      for (let z = 0; z <= tall; z++) {
        const x = bx + Math.sin(z * 0.6 + this.t * 0.01 + i) * (z / tall) * 1.6;
        g.put(x, by - z, z > tall - 1.5 ? sheen : strand, 1);
      }
    }
    if (this.kit.yuki) {
      // Rime glittering over Yuki-onna's hair.
      for (let i = 0; i < 10; i++) {
        if ((Math.floor(this.t / 120) + i) % 3) continue;
        const th = hash(i, 11) * Math.PI * 2;
        const r = R * hash(i, 12);
        g.put(this.x + Math.cos(th) * r, this.y + Math.sin(th) * r * GROUND, 0xffffff, 1);
      }
    }
  }

  destroy(): void {
    for (const ink of this.wraps.values()) ink.destroy();
    this.wraps.clear();
    super.destroy();
  }

  /** Strands coiling up a held foe's body, drawn just in front of it. */
  private drawWrap(ink: Ink, h: Hurtbox, k: number): void {
    const [, strand, sheen] = this.kit.hair;
    const top = (h.bodyY * 2 + 2) * Math.min(1, k * 1.4);
    const g = ink.begin(h.x, h.y + 2, h.y + 0.6, 0.5, 1);
    for (let s = 0; s < 3; s++) {
      for (let z = 0; z <= top; z += 0.5) {
        const q = z * 0.55 + s * 2.1 + this.t * 0.006;
        // Only the turns in front of the body are seen.
        if (Math.sin(q) < -0.2) continue;
        const x = h.x + Math.cos(q) * (h.radius + 1);
        const y = h.y - z;
        g.put(x, y, (Math.floor(z) + s) % 6 === 0 ? sheen : strand, 1);
      }
    }
    g.end();
  }
}
