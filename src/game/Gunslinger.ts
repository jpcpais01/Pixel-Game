import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { GUNSL_CHEST_Y, GUNSL_FAN_SHOTS, GUNSL_H, GUNSL_MUZZLE, GUNSL_ORIGIN_X, GUNSL_ORIGIN_Y, GUNSL_W } from '../art/gunslinger';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { Heat } from './heat';
import { HitSpark, type Effect, type Scheme } from './Slash';
import { bloom, dither, flare, Fx, line, pal, type Ink, type Pal } from './ultimate/ink';
import { HighNoon } from './ultimate/gunslinger';
import type { Cast } from './ultimate/types';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Gunslinger (the Automaton's gunner): a clockwork cowboy with a
// revolver's cylinder for a heart and a six-shooter on each hip.
//  - Attack (held): left gun, right gun, fast tracer rounds; every sixth
//    shot it spins the gun round its finger and fans the hammer, three
//    rounds in a quick spread.
//  - Ability: Quickdraw. A low slide aside (the way it moves, or aims),
//    untouchable for the moment, then both guns clear leather and two
//    rounds strike the nearest foes at once, no flight time at all.
//  - Special: High Noon (see ultimate/gunslinger.ts). The sun flares and the
//    beat slows; its dead-eye marks up to six times, one tick at a time, then
//    a single crack of gunfire lands every mark.
// Its heat is the Automaton's (heat.ts): every shot warms it, past the red
// line it hits harder, at the top it vents steam out of its coat and stalls.
// The Desperado plays the same in copper and a poncho, with fire for gunfire.

/** The guns: a shot every so often held, its round's speed, reach and bite, and the heat it costs. */
const FIRE_EVERY = 180;
const SHOT_SPEED = 430;
const SHOT_RANGE = 175;
const SHOT_DAMAGE = 6;
const SHOT_HEAT = 4.5;
/** A shot bends toward a foe within this much of its aim (a cosine). */
const SHOT_ASSIST = Math.cos((14 * Math.PI) / 180);
/** Every sixth shot is the fan: three rounds this far apart (radians), and the pause after it. */
const FAN_EVERY = 6;
const FAN_SPREAD = 0.12;
const FAN_DAMAGE = 6;
const FAN_HEAT = 9;
const FAN_REST = 140;
/** Stop shooting this long and the count of six starts over. */
const CYCLE_RESET = 1300;

/** Quickdraw: the slide (how far, how long), the two rounds (reach, bite), its heat and how long till the next. */
const SLIDE_DIST = 38;
const SLIDE_MS = 220;
const DRAW_RANGE = 165;
const DRAW_DAMAGE = 16;
const DRAW_HEAT = 10;
const DRAW_COOLDOWN = 5000;

const WALK_STEPS = new Set([1, 4]);

type State = 'free' | 'shoot' | 'fan' | 'slide' | 'draw' | 'noon';

export interface GunslKit {
  key: string;
  desperado: boolean;
  maxHp: number;
  speed: number;
  /** The rounds' tracer and the sparks where they strike. */
  shot: Pal;
  spark: Scheme;
  /** High Noon's colours. */
  pal: Pal;
  /** Gun smoke, and the steam it lets off. */
  smoke: number[];
  /** The light of its eye and chambers at night. */
  aura: number;
}

export const GUNSL_KIT: GunslKit = {
  key: 'gunsl',
  desperado: false,
  maxHp: HERO_STATS['automaton.gunslinger'].hp,
  speed: HERO_STATS['automaton.gunslinger'].speed,
  shot: pal(0xffffff, 0xc4e6ff, 0x6aaeff, 0x2a64e8, 0x9ad0ff),
  spark: { core: 0xffffff, hot: 0xd8eeff, mid: 0x8ac4ff, deep: 0x3a6ae0, light: 0x9ad0ff },
  pal: pal(0xffffff, 0xfff0b0, 0xffc860, 0xc87a2a, 0xffe8a0),
  smoke: [0xa8b0bc, 0x7c8492, 0xd0d6de],
  aura: 0x9ad0ff,
};

/** The Desperado: forge-orange muzzle fire and a redder sun. */
export const DESPERADO_KIT: GunslKit = {
  ...GUNSL_KIT,
  key: 'gunsl_desperado',
  desperado: true,
  shot: pal(0xfff6d8, 0xffd070, 0xff8a2a, 0xc83a0a, 0xffa040),
  spark: { core: 0xfff6d8, hot: 0xffd070, mid: 0xff8a2a, deep: 0xa82a0a, light: 0xffa040 },
  pal: pal(0xfff4d0, 0xffc050, 0xff7a2a, 0xa8280a, 0xffa040),
  smoke: [0xa09084, 0x74645a, 0xc8b8aa],
  aura: 0xffa050,
};

export class Gunslinger implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: GunslKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private aura: Phaser.GameObjects.Light;
  private heat: Heat;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private clock = 0;
  private fireT = 0;
  /** Which gun fires next (0 A, 1 B), and shots since the last fan. */
  private gun = 0;
  private count = 0;
  private lastShotAt = -Infinity;
  /** The fan's shots already gone off, and where it aims. */
  private fanned = 0;
  private line = { x: 0, y: 1 };
  private drawCd = 0;
  private slide = { vx: 0, vy: 0, t: 0 };
  private noon: HighNoon | null = null;
  private prevSpecial = false;
  private smokeT = 0;
  private fx: Effect[] = [];

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: GunslKit = GUNSL_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = GUNSL_ORIGIN_X / GUNSL_W;
    const oy = GUNSL_ORIGIN_Y / GUNSL_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(1.2, 1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 40, kit.aura, 0);
    this.heat = new Heat(world, this);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && WALK_STEPS.has(frame.index - 1)) this.spurs();
      if (this.state === 'fan' && anim.key.startsWith(`${key}_fan_`) && GUNSL_FAN_SHOTS.includes(frame.index - 1)) this.fanShot();
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (this.state === 'shoot' && /_shoot[AB]_/.test(anim.key)) this.state = 'free';
      else if (this.state === 'fan' && anim.key.includes('_fan_')) {
        this.state = 'free';
        this.fireT = Math.max(this.fireT, FAN_REST);
      } else if (this.state === 'draw' && anim.key.includes('_draw_')) this.state = 'free';
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.heat.destroy();
      comboHud.max = 3;
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.fireT = Math.max(0, this.fireT - dt);
    this.drawCd = Math.max(0, this.drawCd - dt);
    this.heat.update(dt);
    const stalled = this.heat.overheated;
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;
    if (this.clock - this.lastShotAt > CYCLE_RESET) this.count = 0;

    if (this.state === 'noon') {
      if (!this.noon || this.noon.dead || this.world.heroDown) this.endNoon();
    } else if (this.state === 'slide') this.updateSlide(dt, bounds);
    else if (this.state === 'free' && !stalled) {
      if (pressed && this.drawCd === 0) this.startSlide(moving);
      else if (attack && this.fireT === 0) this.fire();
    }

    // Light on its feet: a little slower while shooting, rooted in its dead-eye, slow while venting.
    if (this.state !== 'slide') {
      const k = this.state === 'noon' ? 0 : stalled ? 0.4 : this.state === 'fan' || this.state === 'draw' ? 0.3 : this.state === 'shoot' ? 0.65 : 1;
      const speed = this.kit.speed * k * Math.min(1, len);
      if (moving && speed > 0) {
        this.x = Phaser.Math.Clamp(this.x + (mx / len) * speed * (dt / 1000), bounds.left, bounds.right);
        this.y = Phaser.Math.Clamp(this.y + (my / len) * speed * (dt / 1000), bounds.top, bounds.bottom);
      }
    }
    this.animate(moving, stalled);
    this.sync(dt);
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.updateHud();
  }

  private animate(moving: boolean, stalled: boolean): void {
    if (this.state !== 'free') return;
    const key = this.kit.key;
    if (stalled) {
      this.play(`${key}_vent_${this.dir}`);
      return;
    }
    if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
    else if (moving) this.dir = dirOf(this.lastMove.x, this.lastMove.y);
    this.play(moving ? `${key}_walk_${this.dir}` : stand(this.body, `${key}_idle_${this.dir}`));
  }

  private play(key: string): void {
    if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
  }

  /** A boot coming down, its spur ringing faintly: a little puff of dust. */
  private spurs(): void {
    sound.step();
    this.world.debris([0xb8a888, 0x8a7a60], snap(this.x), snap(this.y) - 1, 2, this.y + 2, 'burst');
  }

  // -------------------------------------------------------------------------
  // The six-shooters

  private fire(): void {
    if (this.count >= FAN_EVERY - 1) {
      this.startFan();
      return;
    }
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    const which = this.gun;
    this.gun = 1 - this.gun;
    this.count++;
    this.lastShotAt = this.clock;
    this.state = 'shoot';
    this.body.play(`${this.kit.key}_shoot${which ? 'B' : 'A'}_${this.dir}`, true);
    this.fireT = FIRE_EVERY;
    const m = this.muzzle(which);
    const v = this.assist(u, m.x, m.y);
    this.shoot(m, v.x, v.y, SHOT_DAMAGE);
    this.heat.add(SHOT_HEAT);
  }

  /** Spin the gun round its finger, then fan the hammer: three rounds in a spread. */
  private startFan(): void {
    this.line = this.aimVec();
    this.dir = dirOf(this.line.x, this.line.y);
    this.state = 'fan';
    this.fanned = 0;
    this.count = 0;
    this.lastShotAt = this.clock;
    this.gun = 0;
    this.body.play(`${this.kit.key}_fan_${this.dir}`, true);
    sound.servo(this.world.pan(this.x));
  }

  private fanShot(): void {
    if (this.fanned >= 3) return;
    const i = this.fanned++;
    const m = this.muzzle(0);
    const base = Math.atan2(this.line.y, this.line.x);
    const a = base + (i - 1) * FAN_SPREAD;
    this.shoot(m, Math.cos(a), Math.sin(a), FAN_DAMAGE);
    this.heat.add(FAN_HEAT / 3);
    if (i === 2) this.world.cameras.main.shake(70, 0.0005);
  }

  /** A round out of a muzzle: its flash, a puff of smoke, a casing, and the tracer on its way. */
  private shoot(m: { x: number; y: number }, vx: number, vy: number, damage: number): void {
    const w = this.world;
    w.addEffect(new Round(w, m.x, m.y, vx, vy, damage * this.heat.power, this.kit, this.y));
    bloom(w, m.x, m.y, this.kit.shot.hot, 0.55, 110, this.y + 30, 0.8);
    w.debris(this.kit.smoke, snap(m.x), snap(m.y), 1, this.y + 3, 'spores');
    w.debris([0xfff0a0, 0xe8b440, 0xa8761e], snap(this.x + (Math.random() - 0.5) * 8), snap(this.y) - 12, 1, this.y + 3, 'burst');
    sound.turretShot(w.pan(m.x));
  }

  /** Where gun `which` fires from, the way it faces now. */
  private muzzle(which: number): { x: number; y: number } {
    const view = this.dir === 'left' || this.dir === 'right' ? 'side' : this.dir;
    const o = GUNSL_MUZZLE[view][which];
    return { x: this.x + (this.dir === 'right' ? -o.x : o.x), y: this.y + o.y };
  }

  /** Bend a shot onto the nearest foe close to its line, so a round meant for it finds it. */
  private assist(u: { x: number; y: number }, x: number, y: number): { x: number; y: number } {
    let best: Hurtbox | null = null;
    let bestD = Infinity;
    for (const h of this.world.hurtboxesWhere((b) => b.alive)) {
      const dx = h.x - x;
      const dy = h.y - h.bodyY - y;
      const d = Math.hypot(dx, dy);
      if (d > SHOT_RANGE || d === 0 || (dx * u.x + dy * u.y) / d < SHOT_ASSIST) continue;
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    if (!best) return u;
    const dx = best.x - x;
    const dy = best.y - best.bodyY - y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }

  // -------------------------------------------------------------------------
  // Quickdraw

  private startSlide(moving: boolean): void {
    const w = this.world;
    // Aside the way it's moving; standing still, the way it aims.
    const u = moving ? { x: this.lastMove.x, y: this.lastMove.y } : this.aimVec();
    this.state = 'slide';
    this.dir = dirOf(u.x, u.y);
    this.slide = { vx: (u.x * SLIDE_DIST * 1000) / SLIDE_MS, vy: (u.y * SLIDE_DIST * 1000) / SLIDE_MS, t: SLIDE_MS };
    this.drawCd = DRAW_COOLDOWN;
    this.body.play(`${this.kit.key}_roll_${this.dir}`, true);
    w.evade(SLIDE_MS + 60);
    w.debris([0xb8a888, 0x8a7a60, 0x6a5e4a], snap(this.x), snap(this.y), 6, this.y + 2, 'burst');
    sound.windDash(w.pan(this.x));
  }

  private updateSlide(dt: number, bounds: Phaser.Geom.Rectangle): void {
    const w = this.world;
    const s = Math.min(dt, this.slide.t) / 1000;
    const nx = Phaser.Math.Clamp(this.x + this.slide.vx * s, bounds.left, bounds.right);
    const ny = Phaser.Math.Clamp(this.y + this.slide.vy * s, bounds.top, bounds.bottom);
    if (w.walkable(nx, ny)) {
      this.x = nx;
      this.y = ny;
    }
    this.slide.t -= dt;
    if (Math.random() < 0.5) w.debris([0xb8a888, 0x8a7a60], snap(this.x), snap(this.y), 1, this.y + 2, 'trail');
    if (this.slide.t <= 0) this.quickdraw();
  }

  /** Both guns clear leather: a round each into the two nearest foes, at once (one foe takes both). */
  private quickdraw(): void {
    const w = this.world;
    const foes = w
      .hurtboxesWhere((h) => h.alive && Math.hypot(h.x - this.x, h.y - this.y) <= DRAW_RANGE)
      .sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));
    const targets = foes.length ? [foes[0], foes[1] ?? foes[0]] : [];
    const look = targets[0] ? { x: targets[0].x - this.x, y: targets[0].y - this.y } : this.aimVec();
    this.dir = dirOf(look.x, look.y);
    this.state = 'draw';
    this.body.play(`${this.kit.key}_draw_${this.dir}`, true);
    const u = this.aimVec();
    [0, 1].forEach((which) => {
      const m = this.muzzle(which);
      const h = targets[which];
      let end: { x: number; y: number };
      if (h) {
        end = { x: h.x, y: h.y - h.bodyY };
        h.hurt({ damage: DRAW_DAMAGE * this.heat.power, heavy: true, knock: 120, fromX: this.x, fromY: this.y });
        this.fx.push(new HitSpark(w, end.x, end.y, this.kit.spark, h.y + 13, true));
        w.debris([0xffffff, this.kit.shot.core, this.kit.shot.hot], end.x, end.y, 6, h.y + 14, 'burst');
        sound.punchHit(w.pan(end.x), true);
      } else {
        // Nothing near: two rounds down the aim, striking whatever's first along it.
        const a = Math.atan2(u.y, u.x) + (which ? 0.05 : -0.05);
        end = this.ray(m, Math.cos(a), Math.sin(a));
      }
      w.addEffect(new Tracer(w, m.x, m.y, end.x, end.y, this.kit.shot, this.y));
      bloom(w, m.x, m.y, this.kit.shot.hot, 0.9, 150, this.y + 30);
    });
    flare(w, this.x, this.y - GUNSL_CHEST_Y, 90, this.kit.shot.light, 1.8, 200);
    w.cameras.main.shake(90, 0.0008);
    sound.turretShot(w.pan(this.x), true);
    sound.firecracker(w.pan(this.x));
    this.heat.add(DRAW_HEAT);
  }

  /** A hitscan round along (ux, uy): strikes the first body in reach, and says where it stopped. */
  private ray(m: { x: number; y: number }, ux: number, uy: number): { x: number; y: number } {
    const w = this.world;
    for (let d = 4; d <= DRAW_RANGE; d += 4) {
      const x = m.x + ux * d;
      const y = m.y + uy * d;
      if (w.strikeAt(x, y, { damage: DRAW_DAMAGE * this.heat.power, heavy: true, knock: 120, fromX: this.x, fromY: this.y })) {
        this.fx.push(new HitSpark(w, x, y, this.kit.spark, y + 13, true));
        return { x, y };
      }
      if (!w.walkable(x, y + GUNSL_CHEST_Y)) return { x, y };
    }
    return { x: m.x + ux * DRAW_RANGE, y: m.y + uy * DRAW_RANGE };
  }

  // -------------------------------------------------------------------------
  // High Noon (the Special)

  /** The Special's doing: it plants its feet and takes aim while the sun burns and its marks are laid, then fires the volley. */
  highNoon(c: Cast): void {
    this.noon?.destroy();
    this.state = 'noon';
    this.body.play(`${this.kit.key}_aim_${this.dir}`, true);
    this.noon = new HighNoon(this.world, c, this);
    this.world.addEffect(this.noon);
  }

  /** Turn to the foe being marked. */
  sight(x: number, y: number): void {
    const d = dirOf(x - this.x, y - this.y);
    if (d === this.dir && this.body.anims.currentAnim?.key.includes('_aim_')) return;
    this.dir = d;
    this.body.play(`${this.kit.key}_aim_${d}`, true);
  }

  /** Both guns at once, toward (x, y): returns where the round leaves from. */
  volley(x: number, y: number): { x: number; y: number } {
    const d = dirOf(x - this.x, y - this.y);
    if (!this.body.anims.currentAnim?.key.includes('_draw_')) {
      this.dir = d;
      this.body.play(`${this.kit.key}_draw_${d}`, true);
    }
    return this.muzzle(Math.random() < 0.5 ? 0 : 1);
  }

  private endNoon(): void {
    this.noon = null;
    this.state = 'free';
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.drawCd / DRAW_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'slide' || this.state === 'draw';
    // The six chambers: lit one by one toward the fan.
    comboHud.max = FAN_EVERY;
    comboHud.hits = this.state === 'fan' ? FAN_EVERY : this.count;
    const since = this.clock - this.lastShotAt;
    comboHud.window = this.count === 0 && this.state !== 'fan' ? 0 : Math.max(0, 1 - since / CYCLE_RESET);
  }

  private sync(dt: number): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    // Running hot the plate flushes red.
    const hot = this.heat.value / 100;
    const flush = hot > 0.7 && !this.heat.overheated ? 0.5 + 0.5 * Math.sin(this.clock * 0.02) : 0;
    const tint = Phaser.Display.Color.GetColor(255, Math.round(255 - flush * 70), Math.round(255 - flush * 90));
    if (!this.body.isTinted || this.body.tintTopLeft !== 0xff8070) this.body.setTint(tint);
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
    this.aura.setPosition(rx, ry - GUNSL_CHEST_Y);
    this.aura.intensity = (0.45 + hot * 0.3) * (1 - this.daylight) + (this.state === 'noon' ? 0.4 : 0);
    // Steam from its pipes (the Desperado's from under the poncho), thicker the hotter it runs.
    this.smokeT -= dt;
    if (this.smokeT <= 0 && hot > 0.25) {
      this.smokeT = 520 - hot * 380;
      const side = this.dir === 'left' ? 3 : this.dir === 'right' ? -3 : Math.random() < 0.5 ? -4 : 4;
      this.world.debris([0xffffff, 0xe6ecf2, 0xc0cad6], rx + side, ry - 26, 1, ry + 1, 'spores');
    }
  }
}

/**
 * A round from a six-shooter: a streak of light flying straight and fast,
 * striking the first body it meets with a spark, or spent at its reach.
 */
class Round extends Fx {
  private g: Ink;
  private travelled = 0;
  private trail: { x: number; y: number }[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private vx: number,
    private vy: number,
    private damage: number,
    private kit: GunslKit,
    /** The ground under it when fired, for its depth. */
    private ground: number,
  ) {
    super(world, 2000);
    this.g = this.ink(32, 32);
  }

  protected step(dt: number): void {
    const w = this.world;
    const s = (SHOT_SPEED * dt) / 1000;
    const steps = Math.ceil(s / 4);
    for (let i = 0; i < steps; i++) {
      this.x += (this.vx * s) / steps;
      this.y += (this.vy * s) / steps;
      this.ground += (this.vy * s) / steps;
      this.travelled += s / steps;
      this.trail.push({ x: this.x, y: this.y });
      if (w.strikeAt(this.x, this.y, { damage: this.damage, knock: 45, fromX: this.x - this.vx * 8, fromY: this.y - this.vy * 8 })) {
        w.addEffect(new HitSpark(w, this.x, this.y, this.kit.spark, this.ground + 14, false));
        w.debris([0xffffff, this.kit.shot.hot, this.kit.shot.mid], this.x, this.y, 3, this.ground + 14, 'burst');
        sound.impact(w.pan(this.x), true);
        this.destroy();
        return;
      }
      if (this.travelled >= SHOT_RANGE || !w.walkable(this.x, this.y + GUNSL_CHEST_Y)) {
        w.debris([0xffffff, 0xb8a888], this.x, this.y, 2, this.ground + 4, 'burst');
        this.destroy();
        return;
      }
    }
    if (this.trail.length > 9) this.trail.splice(0, this.trail.length - 9);
    const p = this.kit.shot;
    const g = this.g.begin(this.x, this.y, this.ground + 4);
    this.trail.forEach((q, i) => {
      const k = i / this.trail.length;
      if (dither(Math.round(q.x), Math.round(q.y)) > k * 1.2) return;
      g.put(q.x, q.y, k > 0.6 ? p.hot : k > 0.3 ? p.mid : p.deep, 0.9);
    });
    g.put(this.x, this.y, p.core);
    g.put(this.x - this.vx, this.y - this.vy, p.core);
    g.put(this.x + this.vx, this.y + this.vy, p.hot, 0.8);
    g.end();
  }
}

/** A hitscan round's line: there and gone, a white-hot core in its glow. */
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
    super(world, 170);
    this.g = this.ink(Math.ceil(Math.abs(x1 - x0)) + 8, Math.ceil(Math.abs(y1 - y0)) + 8);
  }

  protected step(): void {
    const k = this.t / this.life;
    const { x0, y0, x1, y1, p } = this;
    const g = this.g.begin((x0 + x1) / 2, (y0 + y1) / 2, this.ground + 30);
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    // It thins from the gun outward as it fades.
    const from = k * 0.8;
    const sx = x0 + (x1 - x0) * from;
    const sy = y0 + (y1 - y0) * from;
    line(g, sx + nx, sy + ny, x1 + nx, y1 + ny, p.mid, 0.5 * (1 - k));
    line(g, sx, sy, x1, y1, k < 0.4 ? p.core : p.hot, 1 - k);
    g.end();
  }
}
