import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { CHEST_Y, FIGHTER_H, FIGHTER_ORIGIN_X, FIGHTER_ORIGIN_Y, FIGHTER_W, HIT_FRAME, LEAP_AIR } from '../art/fighter';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type MeleeArea } from './combat';
import { HitSpark, Shockwave, type Effect, type Scheme } from './Slash';
import { AIR_FX, CHI_FX, Fissure, Flurry, PALM_FX, PunchBlast, QI_FX } from './Fists';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

const BARRAGE_TIME = 5000;
/** How far the barrage's fists fly, well past his arms. */
const BARRAGE_REACH = 44;
/** A fist leaves every THROW_EVERY ms; whatever is in the line of fire is struck every HIT_EVERY ms. */
const THROW_EVERY = 45;
const HIT_EVERY = 110;

type Blow = 'jab' | 'cross' | 'hook' | 'upper' | 'smash' | 'palm' | 'palm2' | 'thrust';

interface BlowDef {
  /** How far the blow reaches from the chest. */
  reach: number;
  /** Half-width of the line it strikes along; 0 sweeps an arc instead (the hook). */
  radius: number;
  damage: number;
  heavy?: boolean;
  knock: number;
  /** Speed of the step he takes into it. */
  lunge: number;
  /** Where the fist meets the air, from the chest. */
  fist: number;
  /** Size of the shock it throws off. */
  size: number;
}

const BLOWS: Record<Blow, BlowDef> = {
  jab: { reach: 19, radius: 6, damage: 6, knock: 50, lunge: 30, fist: 12, size: 0.85 },
  cross: { reach: 21, radius: 6, damage: 8, knock: 70, lunge: 45, fist: 13, size: 1 },
  hook: { reach: 20, radius: 0, damage: 9, knock: 80, lunge: 35, fist: 11, size: 1 },
  upper: { reach: 17, radius: 8, damage: 11, heavy: true, knock: 90, lunge: 30, fist: 10, size: 1.1 },
  smash: { reach: 30, radius: 9, damage: 20, heavy: true, knock: 260, lunge: 110, fist: 15, size: 1.8 },
  // The monk hits less often and harder, and his palms push the air out further than a fist.
  palm: { reach: 22, radius: 7, damage: 10, knock: 90, lunge: 22, fist: 12, size: 1.05 },
  palm2: { reach: 23, radius: 7, damage: 12, knock: 110, lunge: 30, fist: 13, size: 1.15 },
  thrust: { reach: 36, radius: 10, damage: 18, heavy: true, knock: 230, lunge: 40, fist: 14, size: 1.6 },
};

/**
 * A fighting style: the brawler (five punches and the barrage) or the iron
 * monk (three heavy palms and the earthshaker leap). Each has its own sprite
 * sheet, toughness, pace and moves.
 */
export interface FighterStyle {
  /** Texture key and animation prefix. */
  key: string;
  maxHp: number;
  /** World px / second. */
  speed: number;
  combo: readonly Blow[];
  /** A blow chains into the next if it starts within this long of the previous one. */
  comboWindow: number;
  special: 'barrage' | 'quake';
  specialCooldown: number;
  /** Shock of ordinary blows, and of the finisher and the special. */
  air: Scheme;
  chi: Scheme;
}

export const BRAWLER_STYLE: FighterStyle = {
  key: 'fighter',
  maxHp: 110,
  speed: 62,
  combo: ['jab', 'cross', 'hook', 'upper', 'smash'],
  comboWindow: 1200,
  special: 'barrage',
  specialCooldown: 9000,
  air: AIR_FX,
  chi: CHI_FX,
};

export const MONK_STYLE: FighterStyle = {
  key: 'fighter_monk',
  maxHp: 140,
  speed: 53,
  combo: ['palm', 'palm2', 'thrust'],
  comboWindow: 1300,
  special: 'quake',
  specialCooldown: 7000,
  air: PALM_FX,
  chi: QI_FX,
};

/** The earthshaker: how far he can leap, how high he rises, and the ring he strikes when he lands. */
const LEAP_MAX = 64;
const LEAP_MIN = 12;
const LEAP_HEIGHT = 15;
const QUAKE_RADIUS = 40;
const QUAKE_DAMAGE = 24;
const QUAKE_KNOCK = 240;

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'punch' | 'barrage' | 'leap';

/**
 * The fighter. The brawler has a five-punch combo on the attack button (jab,
 * cross, hook, uppercut and a flying straight that launches whatever it hits),
 * and on the special a five-second barrage of chi fists hammering out along
 * the way he faces, far past his reach, closed out with the finisher.
 *
 * The iron monk is tougher and slower: three palm strikes, the last a double
 * palm that drives a wall of force well past his hands, and on the special
 * the earthshaker, a leap to where he aims that comes down palms-first in a
 * ring of cracking ground and hurls everything round him away.
 */
export class Fighter implements Hero {
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
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  /** Towards the mouse on a computer (see Hero). */
  private aim: Aim | null = null;
  /** Where the current blow or barrage goes. */
  private line: Aim = { x: 0, y: 1 };
  private clock = 0;
  private cooldown = 0;
  private specialCd = 0;

  private blow: Blow = 'jab';
  private step = 0;
  private lastPunchAt = -Infinity;
  private struck = false;
  private buffered = false;
  private prevAttack = false;
  private dash = { vx: 0, vy: 0, t: 0 };

  private flurry: Flurry | null = null;
  private barrageLeft = 0;
  private throwT = 0;
  private hitT = 0;
  private throws = 0;

  private fx: Effect[] = [];

  /** The earthshaker: where he left the ground, where he'll land, and how high he is now. */
  private leapFrom = { x: 0, y: 0 };
  private leapTo = { x: 0, y: 0 };
  private leapT = 0;
  private z = 0;

  private readonly style: FighterStyle;
  private readonly key: string;

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, style: FighterStyle = BRAWLER_STYLE) {
    this.world = world;
    this.style = style;
    this.key = style.key;
    this.vitals = new Vitals(style.maxHp);
    this.x = x;
    this.y = y;
    const ox = FIGHTER_ORIGIN_X / FIGHTER_W;
    const oy = FIGHTER_ORIGIN_Y / FIGHTER_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    const k = this.key;
    this.castShadow = sunShadow(world.add.sprite(x, y, `${k}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, k, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${k}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.body.play(`${k}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      const done = (this.state === 'punch' && anim.key.startsWith(`${k}_${this.blow}_`)) || (this.state === 'leap' && anim.key.startsWith(`${k}_leap_`));
      if (!done) return;
      const heavy = this.state === 'leap' || this.blow === this.finisher;
      this.state = 'free';
      this.z = 0;
      this.cooldown = heavy ? 160 : 20;
      this.body.play(`${k}_idle_${this.dir}`);
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${k}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    // Shared HUD state: don't leave the special lit or five pips on the next hero's button.
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
    if (this.state !== 'barrage') this.specialCd = Math.max(0, this.specialCd - dt);
    if (this.state === 'leap' && !this.vitals.alive) {
      // Struck down in the air: he simply drops.
      this.state = 'free';
      this.z = 0;
    }

    // A tap during a punch queues the next one, so quick taps chain cleanly.
    const pressed = attack && !this.prevAttack;
    this.prevAttack = attack;
    if (pressed && this.state === 'punch') this.buffered = true;

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) {
        if (this.style.special === 'quake') this.startLeap(bounds);
        else this.startBarrage();
      }
      else if (attack || this.buffered) this.startPunch();
    }

    const SPEED = this.style.speed;
    const speed = { free: SPEED * Math.min(1, len), punch: SPEED * 0.3, barrage: SPEED * 0.35, leap: 0 }[this.state];
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
      // Fighting faces the aim, even walking backwards; otherwise the way of the walk.
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = `${this.key}_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else if (this.state === 'punch') {
      const f = this.body.anims.currentFrame;
      if (!this.struck && f && f.index - 1 >= (HIT_FRAME[this.blow] ?? 1)) {
        this.struck = true;
        this.land();
      }
    } else if (this.state === 'leap') {
      this.updateLeap(dt);
    } else {
      this.updateBarrage(dt);
    }

    this.sync();
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.updateHud();
  }

  /** The last blow of the combo. */
  private get finisher(): Blow {
    const c = this.style.combo;
    return c[c.length - 1];
  }

  private startPunch(): void {
    const combo = this.style.combo;
    const chain = this.step > 0 && this.step < combo.length && this.clock - this.lastPunchAt <= this.style.comboWindow;
    this.step = chain ? this.step + 1 : 1;
    this.lastPunchAt = this.clock;
    this.throwBlow(combo[this.step - 1]);
  }

  private throwBlow(blow: Blow): void {
    this.blow = blow;
    this.buffered = false;
    this.struck = false;
    this.state = 'punch';
    this.line = this.aimLine();
    this.dir = dirOf(this.line.x, this.line.y);
    this.body.play(`${this.key}_${blow}_${this.dir}`);
    const n = this.style.combo.indexOf(blow) + 1;
    // The monk's three palms sound like the heavier end of the brawler's five.
    sound.punch(this.style.combo.length < 5 ? n + 2 : n, this.world.pan(this.x));
    // A step into every punch; the finisher saves its leap for the moment it lands.
    if (blow !== this.finisher) {
      const b = BLOWS[blow];
      this.dash = { vx: this.line.x * b.lunge, vy: this.line.y * b.lunge, t: 90 };
    }
  }

  /** The fist connects: the air cracks off the knuckles, and whatever it reaches is struck. */
  private land(): void {
    const b = BLOWS[this.blow];
    const u = this.line;
    const cx = snap(this.x);
    const cy = snap(this.y) - CHEST_Y;
    const heavy = this.blow === this.finisher;
    const scheme = heavy ? this.style.chi : this.style.air;
    const area: MeleeArea =
      b.radius === 0
        ? { kind: 'arc', x: cx, y: cy, radius: b.reach, angle: Math.atan2(u.y, u.x), spread: (70 * Math.PI) / 180 }
        : { kind: 'line', x0: cx, y0: cy, x1: cx + u.x * b.reach, y1: cy + u.y * b.reach, radius: b.radius };
    this.fx.push(new PunchBlast(this.world, Math.round(cx + u.x * b.fist), Math.round(cy + u.y * b.fist), u.x, u.y, scheme, snap(this.y), b.size));
    const hits = this.world.melee(area, { damage: b.damage, heavy: b.heavy, knock: b.knock, fromX: cx, fromY: cy });
    hits.forEach((h, i) => {
      this.fx.push(new HitSpark(this.world, h.x, h.y, scheme, h.y + 13, !!b.heavy));
      if (i < 2) sound.punchHit(this.world.pan(h.x), !!b.heavy);
    });
    if (heavy) {
      // He launches himself behind it.
      this.dash = { vx: u.x * b.lunge, vy: u.y * b.lunge, t: 130 };
      this.world.cameras.main.shake(180, 0.0008);
    } else if (hits.length) {
      this.world.cameras.main.shake(50, b.heavy ? 0.0004 : 0.00025);
    }
  }

  private startBarrage(): void {
    this.state = 'barrage';
    this.step = 0;
    this.buffered = false;
    this.line = this.aimLine();
    // Once the aim lets go (a touch button released), the stick steers on from here.
    this.lastMove.set(this.line.x, this.line.y);
    this.dir = dirOf(this.line.x, this.line.y);
    this.body.play(`${this.key}_barrage_${this.dir}`);
    this.flurry = new Flurry(this.world, BARRAGE_REACH);
    this.barrageLeft = BARRAGE_TIME;
    this.throwT = 0;
    this.hitT = HIT_EVERY * 0.5;
    this.throws = 0;
    sound.kiai();
  }

  /** Fists pour out along the way he faces, which follows the mouse (or the stick) as he fights. */
  private updateBarrage(dt: number): void {
    if (this.aim) this.line = { x: this.aim.x, y: this.aim.y };
    else if (Math.hypot(this.lastMove.x, this.lastMove.y) > 0) this.line = { x: this.lastMove.x, y: this.lastMove.y };
    const u = this.line;
    const dir = dirOf(u.x, u.y);
    if (dir !== this.dir) {
      this.dir = dir;
      this.body.play(`${this.key}_barrage_${dir}`, true);
    }
    const cx = snap(this.x);
    const cy = snap(this.y) - CHEST_Y;
    const pan = this.world.pan(this.x);

    this.throwT -= dt;
    while (this.throwT <= 0) {
      this.throwT += THROW_EVERY;
      this.flurry!.throw();
      if (++this.throws % 2 === 0) sound.flurry(pan);
    }
    this.hitT -= dt;
    if (this.hitT <= 0) {
      this.hitT += HIT_EVERY;
      const hits = this.world.melee(
        { kind: 'line', x0: cx + u.x * 4, y0: cy + u.y * 4, x1: cx + u.x * BARRAGE_REACH, y1: cy + u.y * BARRAGE_REACH, radius: 8 },
        { damage: 3, knock: 45, fromX: cx, fromY: cy },
      );
      hits.slice(0, 3).forEach((h) => this.fx.push(new HitSpark(this.world, h.x, h.y, CHI_FX, h.y + 13, false)));
      if (hits.length) {
        sound.punchHit(this.world.pan(hits[0].x), false);
        this.world.cameras.main.shake(40, 0.0002);
      }
    }
    this.flurry!.update(dt, cx, cy, u.x, u.y, snap(this.y), this.daylight);

    this.barrageLeft -= dt;
    if (!this.vitals.alive) {
      // Struck down mid-flurry: it simply stops.
      this.flurry!.destroy();
      this.flurry = null;
      this.specialCd = this.style.specialCooldown;
      this.state = 'free';
    } else if (this.barrageLeft <= 0) {
      // Out of breath: one last blow to close it out, then the long wait to recover.
      this.flurry!.destroy();
      this.flurry = null;
      this.specialCd = this.style.specialCooldown;
      this.throwBlow('smash');
    }
  }

  /** The earthshaker: a crouch, then up and over to where he aims (or ahead of him), landing palms-first. */
  private startLeap(bounds: Phaser.Geom.Rectangle): void {
    this.state = 'leap';
    this.step = 0;
    this.buffered = false;
    this.line = this.aimLine();
    this.dir = dirOf(this.line.x, this.line.y);
    const dist = Phaser.Math.Clamp(this.aim?.dist ?? LEAP_MAX * 0.75, LEAP_MIN, LEAP_MAX);
    this.leapFrom = { x: this.x, y: this.y };
    this.leapTo = {
      x: Phaser.Math.Clamp(this.x + this.line.x * dist, bounds.left, bounds.right),
      y: Phaser.Math.Clamp(this.y + this.line.y * dist, bounds.top, bounds.bottom),
    };
    this.leapT = 0;
    this.struck = false;
    this.specialCd = this.style.specialCooldown;
    this.body.play(`${this.key}_leap_${this.dir}`);
    sound.kiai();
  }

  private updateLeap(dt: number): void {
    this.leapT += dt;
    const t0 = (LEAP_AIR.from * 1000) / LEAP_AIR.fps;
    const t1 = (LEAP_AIR.to * 1000) / LEAP_AIR.fps;
    const t = Phaser.Math.Clamp((this.leapT - t0) / (t1 - t0), 0, 1);
    if (!this.struck) {
      // Up fast, hang, then down hard.
      const k = t < 0.5 ? 0.5 * Math.sin(t * Math.PI) : 1 - 0.5 * (1 - (t - 0.5) * 2) ** 2;
      this.x = this.leapFrom.x + (this.leapTo.x - this.leapFrom.x) * Math.min(1, k * 1.05);
      this.y = this.leapFrom.y + (this.leapTo.y - this.leapFrom.y) * Math.min(1, k * 1.05);
      this.z = Math.sin(t * Math.PI) * LEAP_HEIGHT;
    }
    const f = this.body.anims.currentFrame;
    if (!this.struck && f && f.index - 1 >= (HIT_FRAME.leap ?? LEAP_AIR.to)) {
      this.struck = true;
      this.x = this.leapTo.x;
      this.y = this.leapTo.y;
      this.z = 0;
      this.quake();
    }
  }

  /** He meets the ground: the earth cracks, a ring of force rolls out, and everything near is hurled away. */
  private quake(): void {
    const x = snap(this.x);
    const y = snap(this.y);
    const scheme = this.style.chi;
    this.fx.push(new Fissure(this.world, x, y, QUAKE_RADIUS * 0.8));
    this.fx.push(new Shockwave(this.world, x, y - 1, QUAKE_RADIUS, scheme));
    const hits = this.world.melee({ kind: 'circle', x, y: y - 4, radius: QUAKE_RADIUS }, { damage: QUAKE_DAMAGE, heavy: true, knock: QUAKE_KNOCK, fromX: x, fromY: y - 4 });
    hits.slice(0, 4).forEach((h) => this.fx.push(new HitSpark(this.world, h.x, h.y, scheme, h.y + 13, true)));
    sound.slam(this.world.pan(x));
    if (hits.length) sound.punchHit(this.world.pan(hits[0].x), true);
    this.world.cameras.main.shake(200, 0.0012);
  }

  /** Which way a blow goes: at the mouse on a computer, else the way he last walked. */
  private aimLine(): Aim {
    const a = this.aim ?? this.lastMove;
    return { x: a.x, y: a.y };
  }

  private updateHud(): void {
    // The special button: a ring draining through the barrage, then refilling over the cooldown.
    if (this.state === 'barrage') {
      beamHud.charge = 1;
      beamHud.over = 1 - this.barrageLeft / BARRAGE_TIME;
      beamHud.firing = true;
    } else {
      beamHud.charge = 1 - this.specialCd / this.style.specialCooldown;
      beamHud.over = 0;
      beamHud.firing = false;
    }
    const since = this.clock - this.lastPunchAt;
    const n = this.style.combo.length;
    comboHud.max = n;
    comboHud.hits = this.step;
    comboHud.window = this.step === 0 ? 0 : this.step < n ? Math.max(0, 1 - since / this.style.comboWindow) : Math.max(0, 1 - since / 600);
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    // Off the ground mid-leap: the body rises, the shadows stay on the ground and shrink.
    const lift = Math.round(this.z);
    const air = 1 - this.z / (LEAP_HEIGHT * 2);
    this.body.setPosition(rx, ry - lift).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry - lift).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setScale(air).setAlpha(this.alpha * air);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha * air);
  }
}
