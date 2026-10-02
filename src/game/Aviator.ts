import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { AVI_H, AVI_HAND_Y, AVI_ORIGIN_X, AVI_ORIGIN_Y, AVI_W, AVIATOR_TIMING } from '../art/aviator';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { HitSpark, Shockwave, type Effect, type Scheme } from './Slash';
import { pal, type Pal } from './ultimate/ink';
import { FlareRound, JetSmoke, Scorch } from './AviatorFx';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { turnMidMove } from './anims';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Aviator (the Inventor class's flyer): a daring young pilot with a
// jetpack she built herself.
//  - Attack (held): Flare pistol. Quick shots of a bright flare round that
//    streaks and sputters, popping in a little burst of sparks on the first
//    foe it meets (singeing those beside it). Every third shot of a volley is
//    a star shell that bursts wider and brighter.
//  - Ability: Rocket hop. The jetpack roars and she leaps to the spot she
//    aims at (a set distance on a touch screen), arcing through the air on a
//    trail of smoke; she lands with a thump that blasts foes back. Nothing
//    touches her while she's up.
//  - Special: Bombing Run (see ultimate/aviator.ts). She fires a signal flare
//    and her little biplane roars across along the aim, dropping a line of
//    bombs that go off one after another.

const STATS = HERO_STATS['aviator.aviator'];

/** Between shots held down, and the pace she keeps while shooting. */
const SHOT_EVERY = 400;
const SHOT_PACE = 0.65;
const SHOT_LAND = AVIATOR_TIMING.shootLand;
const SHOT_MS = AVIATOR_TIMING.shootMs;
/** The flare: its damage, and the sparks it bursts into on a foe (the star shell's wider and harder). */
const FLARE_DAMAGE = 8;
const SPARK_DAMAGE = 2;
const SPARK_R = 13;
const STAR_SPARK_DAMAGE = 4;
const STAR_SPARK_R = 22;
/** Every this many shots in a volley is a star shell; a volley ends after this long without a shot. */
const STAR_EVERY = 3;
const VOLLEY_GAP = 1200;

/** The hop: how far (the mouse's spot, clamped; touch: a set distance), how high, and the landing's blast. */
const HOP_COOLDOWN = 6000;
const HOP_MIN = 24;
const HOP_MAX = 92;
const HOP_TOUCH = 72;
const HOP_HEIGHT = 20;
const HOP_LIFT = AVIATOR_TIMING.hopLift;
const HOP_LAND = AVIATOR_TIMING.hopLand;
const HOP_MS = AVIATOR_TIMING.hopMs;
const LAND_DAMAGE = 10;
const LAND_R = 26;
const LAND_KNOCK = 170;

const FOOTFALLS = new Set([1, 4]);

export interface AviatorKit {
  key: string;
  maxHp: number;
  speed: number;
  /** The flares, the jets and the Special's fire. */
  pal: Pal;
  fx: Scheme;
  /** Smoke: lit puff, body, shadow. */
  smoke: [number, number, number];
}

export const AVIATOR_KIT: AviatorKit = {
  key: 'aviator',
  maxHp: STATS.hp,
  speed: STATS.speed,
  pal: pal(0xfffbe8, 0xffd870, 0xff8a2a, 0xc03a1a, 0xffa848),
  fx: { core: 0xfffbe8, hot: 0xffd870, mid: 0xff8a2a, deep: 0xc03a1a, light: 0xffa848 },
  smoke: [0xd6d2da, 0x9a96a2, 0x5e5a66],
};

/** The Flying Ace: red-white fire, and her smoke a little paler. */
export const ACE_KIT: AviatorKit = {
  ...AVIATOR_KIT,
  key: 'aviator_ace',
  pal: pal(0xffffff, 0xffd6d0, 0xff4a42, 0xa01020, 0xff6a5a),
  fx: { core: 0xffffff, hot: 0xffd6d0, mid: 0xff4a42, deep: 0xa01020, light: 0xff6a5a },
  smoke: [0xeeeaf0, 0xb2aeb8, 0x6e6a76],
};

type Move = 'shoot' | 'hop';

export class Aviator implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: AviatorKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private jetLamp: Phaser.GameObjects.Light;
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private clock = 0;
  private move: Move | null = null;
  private moveT = 0;
  private landed = false;
  private shotT = 0;
  /** Shots in the volley so far, and when the last left the pistol. */
  private volley = 0;
  private lastShotAt = -99999;
  private flash = 0;
  private hopCd = 0;
  private hopFrom = { x: 0, y: 0 };
  private hopTo = { x: 0, y: 0 };
  /** Height off the ground mid-hop. */
  private z = 0;
  private trail: JetSmoke | null = null;
  private prevSpecial = false;
  private fx: Effect[] = [];

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: AviatorKit = AVIATOR_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = AVI_ORIGIN_X / AVI_W;
    const oy = AVI_ORIGIN_Y / AVI_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    // The jets and the muzzle light the ground round her when they fire.
    this.jetLamp = world.lights.addLight(x, y, 60, kit.pal.light, 0);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const e of this.fx) e.destroy();
      world.lights.removeLight(this.jetLamp);
      beamHud.firing = false;
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.shotT = Math.max(0, this.shotT - dt);
    this.hopCd = Math.max(0, this.hopCd - dt);
    this.flash = Math.max(0, this.flash - dt / 160);
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;
    if (this.clock - this.lastShotAt > VOLLEY_GAP) this.volley = 0;

    if (this.move === 'hop') this.updateHop(dt);
    else if (this.move === 'shoot') {
      this.moveT += dt;
      // Until the round leaves the pistol, she turns with the aim.
      if (!this.landed) this.face(true);
      if (!this.landed && this.moveT >= SHOT_LAND) {
        this.landed = true;
        this.fire();
      }
      if (this.moveT >= SHOT_MS) this.move = null;
    }
    // The hop may cut a shot short once it's fired: getting away comes first.
    if ((!this.move || (this.move === 'shoot' && this.landed)) && pressed && this.hopCd === 0) this.startHop(bounds);
    else if (!this.move && attack && this.shotT === 0) this.startShot();

    if (this.move !== 'hop' && moving) {
      const pace = this.kit.speed * (this.move === 'shoot' ? SHOT_PACE : 1) * Math.min(1, len);
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * pace * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * pace * (dt / 1000), bounds.top, bounds.bottom);
    }
    if (!this.move) {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_walk_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    }
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.sync();
    this.updateHud();
  }

  // -------------------------------------------------------------------------
  // The flare pistol

  private startShot(): void {
    this.move = 'shoot';
    this.moveT = 0;
    this.landed = false;
    this.shotT = SHOT_EVERY;
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_shoot_${this.dir}`);
  }

  /** Turn to the aim mid-move, keeping the frame. */
  private face(turn: boolean): void {
    const u = this.aimVec();
    const d = dirOf(u.x, u.y);
    if (d === this.dir) return;
    this.dir = d;
    if (turn && this.move) turnMidMove(this.body, `${this.kit.key}_${this.move}_${d}`);
  }

  /** Where the round leaves the pistol: the hand, reaching the way she aims. */
  private muzzle(): { x: number; y: number } {
    const u = this.aimVec();
    return { x: this.x + u.x * 9, y: this.y + u.y * 5 };
  }

  private fire(): void {
    const w = this.world;
    const u = this.aimVec();
    const m = this.muzzle();
    this.volley++;
    this.lastShotAt = this.clock;
    const star = this.volley % STAR_EVERY === 0;
    this.flash = 1;
    w.addEffect(
      new FlareRound(w, m.x, m.y, AVI_HAND_Y, u.x, u.y, this.kit, star, (h, x, y) => {
        h.hurt({ damage: FLARE_DAMAGE, heavy: star, knock: star ? 90 : 45, fromX: x - u.x * 8, fromY: y - u.y * 8 });
        w.addEffect(new HitSpark(w, h.x, h.y - h.bodyY, this.kit.fx, h.y + 13, star));
        // The burst of sparks singes those beside the one struck.
        const r = star ? STAR_SPARK_R : SPARK_R;
        const dmg = star ? STAR_SPARK_DAMAGE : SPARK_DAMAGE;
        for (const o of w.hurtboxesWhere((b) => b.alive && b !== h && Math.hypot(b.x - h.x, (b.y - h.y) / 0.7) <= r + b.radius)) {
          o.hurt({ damage: dmg, heavy: false, knock: 40, fromX: h.x, fromY: h.y });
        }
      }),
    );
    sound.flareShot(w.pan(this.x), star);
  }

  // -------------------------------------------------------------------------
  // The rocket hop

  /** Where she'll come down: the spot she aims at, else ahead, on the last open ground along the way. */
  private startHop(bounds: Phaser.Geom.Rectangle): void {
    const u = this.aimVec();
    const dist = this.aim?.dist === undefined ? HOP_TOUCH : Phaser.Math.Clamp(this.aim.dist, HOP_MIN, HOP_MAX);
    const want = {
      x: Phaser.Math.Clamp(this.x + u.x * dist, bounds.left, bounds.right),
      y: Phaser.Math.Clamp(this.y + u.y * dist, bounds.top, bounds.bottom),
    };
    this.hopFrom = { x: this.x, y: this.y };
    this.hopTo = { x: this.x, y: this.y };
    const steps = Math.ceil(Math.hypot(want.x - this.x, want.y - this.y) / 4);
    for (let i = 1; i <= steps; i++) {
      const x = this.x + ((want.x - this.x) * i) / steps;
      const y = this.y + ((want.y - this.y) * i) / steps;
      if (!this.world.walkable(x, y)) break;
      this.hopTo = { x, y };
    }
    this.move = 'hop';
    this.moveT = 0;
    this.landed = false;
    this.hopCd = HOP_COOLDOWN;
    this.volley = 0;
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_hop_${this.dir}`);
    this.world.evade(HOP_MS + 120);
    sound.jetHop(this.world.pan(this.x));
    // Scorched grass and a puff where she kicks off, then a trail of smoke behind her.
    this.fx.push(new Scorch(this.world, this.x, this.y, this.kit));
    this.world.debris(this.kit.smoke, this.x, this.y - 2, 8, this.y + 2, 'burst');
    this.trail = new JetSmoke(this.world, this.kit);
    this.fx.push(this.trail);
  }

  private updateHop(dt: number): void {
    this.moveT += dt;
    const t = Phaser.Math.Clamp((this.moveT - HOP_LIFT) / (HOP_LAND - HOP_LIFT), 0, 1);
    if (!this.landed) {
      // Off fast on the roar of the jets, easing as she comes down.
      const k = 1 - (1 - t) ** 1.6;
      this.x = this.hopFrom.x + (this.hopTo.x - this.hopFrom.x) * k;
      this.y = this.hopFrom.y + (this.hopTo.y - this.hopFrom.y) * k;
      this.z = Math.sin(t * Math.PI) * HOP_HEIGHT;
      if (this.moveT >= HOP_LIFT) this.trail?.puff(this.x, this.y - this.z - 6, this.y);
      if (this.moveT >= HOP_LAND) this.touchDown();
    }
    if (this.moveT >= HOP_MS) this.move = null;
  }

  /** She comes down with a thump: a ring of force, dust, and every foe near blasted back. */
  private touchDown(): void {
    const w = this.world;
    this.landed = true;
    this.x = this.hopTo.x;
    this.y = this.hopTo.y;
    this.z = 0;
    this.trail?.stop();
    this.trail = null;
    const x = snap(this.x);
    const y = snap(this.y);
    this.fx.push(new Shockwave(w, x, y - 1, LAND_R, this.kit.fx));
    this.fx.push(new Scorch(w, x, y, this.kit));
    const hits = w.melee({ kind: 'circle', x, y: y - 4, radius: LAND_R }, { damage: LAND_DAMAGE, heavy: true, knock: LAND_KNOCK, fromX: x, fromY: y - 4 });
    hits.slice(0, 4).forEach((h) => this.fx.push(new HitSpark(w, h.x, h.y, this.kit.fx, h.y + 13, true)));
    w.debris(this.kit.smoke, x, y - 2, 12, y + 4, 'burst');
    w.debris(this.kit.pal.tints, x, y - 3, 6, y + 4, 'burst');
    sound.slam(w.pan(x));
    if (hits.length) sound.blast(w.pan(x));
    w.cameras.main.shake(150, 0.001);
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.hopCd / HOP_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.move === 'hop';
    // The pips count toward the star shell.
    const since = this.clock - this.lastShotAt;
    comboHud.max = STAR_EVERY;
    comboHud.hits = this.volley % STAR_EVERY;
    comboHud.window = comboHud.hits === 0 ? 0 : Math.max(0, 1 - since / VOLLEY_GAP);
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    // Off the ground mid-hop: the body rises, the shadows stay on the ground and shrink.
    const lift = Math.round(this.z);
    const air = 1 - this.z / (HOP_HEIGHT * 2);
    this.body.setPosition(rx, ry - lift).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry - lift).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setScale(air).setAlpha(this.alpha * air);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha * air);
    const jets = this.move === 'hop' && !this.landed && this.moveT >= HOP_LIFT * 0.5;
    if (jets) this.jetLamp.setPosition(rx, ry - lift - 4);
    else {
      const m = this.muzzle();
      this.jetLamp.setPosition(m.x, m.y - AVI_HAND_Y);
    }
    this.jetLamp.intensity = jets ? 1.8 : 1.4 * this.flash;
  }
}
