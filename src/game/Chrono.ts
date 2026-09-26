import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { CHRONO_H, CHRONO_ORIGIN_X, CHRONO_ORIGIN_Y, CHRONO_RELEASE, CHRONO_W } from '../art/chrono';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { AEON_PAL, Ghost, KEEPER_PAL, MOON_PAL, RIFT_PAL, StasisClock, TimeBolt, type BoltKind } from './Chronos';
import { Shockwave } from './Songs';
import { bloom, flare, strikeGround, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type Act = 'cast' | 'field' | 'rewind';
type State = 'free' | Act;

/** How a chronomancer type plays: its look, its body, its bolts and its special. */
export interface ChronoKit {
  key: string;
  /** The paradox: shards echoed from a moment ago, and the rewind, rather than slowing bolts and the stasis clock. */
  rift: boolean;
  pal: Pal;
  maxHp: number;
  speed: number;
  /** A breath after each cast before the next. */
  rest: number;
  bolt: BoltKind;
  /** The stasis clock's strike when its hour comes; the paradox burst left where the rewind began. */
  specialDamage: number;
  specialCooldown: number;
}

const keeperBolt = (key: string, p: Pal): BoltKind => ({ key, rift: false, pal: p, damage: 8, speed: 165, range: 150, slow: 0.62, slowFloor: 0.3, slowMs: 2000, lit: true });
const riftShard = (key: string, p: Pal): BoltKind => ({ key, rift: true, pal: p, damage: 9, speed: 245, range: 135, slow: 1, slowFloor: 1, slowMs: 0, lit: true });

/**
 * The timekeeper: second hands of light that drag his foes' time slower with
 * each one that lands, and a stasis clock set on the ground that all but
 * stops everything on it until its hour strikes.
 */
export const KEEPER_KIT: ChronoKit = {
  key: 'chrono',
  rift: false,
  pal: KEEPER_PAL,
  maxHp: 82,
  speed: 60,
  rest: 150,
  bolt: keeperBolt('chrono', KEEPER_PAL),
  specialDamage: 20,
  specialCooldown: 11000,
};

export const MOON_KIT: ChronoKit = { ...KEEPER_KIT, key: 'chrono_moon', pal: MOON_PAL, bolt: keeperBolt('chrono_moon', MOON_PAL) };

/**
 * The paradox: quicker and tougher, throwing shards that his own echo, a
 * moment behind him, throws again; and a rewind that snaps him back to where
 * he stood a few breaths ago, with the wounds taken since undone.
 */
export const PARADOX_KIT: ChronoKit = {
  key: 'chrono_rift',
  rift: true,
  pal: RIFT_PAL,
  maxHp: 92,
  speed: 66,
  rest: 110,
  bolt: riftShard('chrono_rift', RIFT_PAL),
  specialDamage: 16,
  specialCooldown: 12000,
};

export const AEON_KIT: ChronoKit = { ...PARADOX_KIT, key: 'chrono_aeon', pal: AEON_PAL, bolt: riftShard('chrono_aeon', AEON_PAL) };

/** How far back his echo stands, and how long after his throw it throws. */
const ECHO_BACK = 800;
const ECHO_DELAY = 360;
/** Its shards strike for this share of his. */
const ECHO_SHARE = 0.6;
/** How far back the rewind takes him. */
const REWIND_BACK = 2500;
/** The most of his health a rewind gives back. */
const REWIND_HEAL = 0.35;
/** The stasis clock is set at the aim, this near and this far at most. */
const FIELD_MIN = 24;
const FIELD_MAX = 100;

/** A moment in his past: where he stood, how hurt he was, and how he looked. */
interface Moment {
  t: number;
  x: number;
  y: number;
  hp: number;
  frame: string;
}

/**
 * The chronomancer: casts on the attack button, toward the aim (the mouse on
 * a computer). The timekeeper's special sets a stasis clock where he aims;
 * the paradox's rewinds him to a moment ago.
 */
export class Chrono implements Hero {
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
  private line: Aim = { x: 0, y: 1 };
  private released = false;
  private cooldown = 0;
  private specialCd = 0;
  private kit: ChronoKit;
  /** His own clock, and the moments he has lived through lately (the paradox's). */
  private now = 0;
  private past: Moment[] = [];
  /** Echoes waiting to throw: when, and which way. */
  private echoes: { at: number; dx: number; dy: number }[] = [];

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: ChronoKit = KEEPER_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    const k = kit.key;
    this.x = x;
    this.y = y;
    const ox = CHRONO_ORIGIN_X / CHRONO_W;
    const oy = CHRONO_ORIGIN_Y / CHRONO_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${k}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, k, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${k}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.body.play(`${k}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (this.state !== 'free' && anim.key.startsWith(`${k}_${this.state}_`)) {
        this.state = 'free';
        this.cooldown = this.kit.rest;
        this.body.play(`${k}_idle_${this.dir}`);
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${k}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
      comboHud.hits = 0;
      comboHud.window = 0;
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.now += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.start(this.kit.rift ? 'rewind' : 'field');
      else if (attack) this.start('cast');
    }

    const slow = { free: Math.min(1, len), cast: 0.65, field: 0.3, rewind: 0.4 }[this.state];
    const speed = this.kit.speed * slow;
    const vx = moving ? (mx / len) * speed : 0;
    const vy = moving ? (my / len) * speed : 0;
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      // Fighting faces the aim, even walking backwards; otherwise the way of the walk.
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = `${this.kit.key}_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      // Until the spell leaves him, the aim follows the mouse.
      if (!this.released) this.takeAim();
      const f = this.body.anims.currentFrame;
      if (!this.released && f && f.index - 1 >= CHRONO_RELEASE[this.state]) {
        this.released = true;
        this.land(this.state);
      }
    }

    if (this.kit.rift) this.remember();
    this.sync();
    this.updateHud();
  }

  private start(act: Act): void {
    this.state = act;
    this.released = false;
    this.takeAim();
    this.body.play(`${this.kit.key}_${act}_${this.dir}`);
  }

  /** Which way: at the mouse on a computer, else the way he last walked. */
  private takeAim(): void {
    const a = this.aim ?? this.lastMove;
    this.line = { x: a.x, y: a.y, dist: this.aim?.dist };
    const dir = dirOf(a.x, a.y);
    if (dir !== this.dir) {
      this.dir = dir;
      const frame = this.body.anims.currentFrame;
      if (frame && this.state !== 'free') this.body.play({ key: `${this.kit.key}_${this.state}_${dir}`, startFrame: frame.index - 1 });
    }
  }

  /** The moment each action lands. */
  private land(act: Act): void {
    if (act === 'cast') this.loose();
    else if (act === 'field') this.setClock();
    else this.rewind();
  }

  /** A second hand (or a shard) leaves his palm; the paradox's echo will throw another a moment from now. */
  private loose(): void {
    const u = this.line;
    sound.chronoCast(this.world.pan(this.x), this.kit.rift);
    this.world.addEffect(new TimeBolt(this.world, this.x + u.x * 7, this.y + u.y * 3 + 1, u.x, u.y, this.kit.bolt));
    if (this.kit.rift) this.echoes.push({ at: this.now + ECHO_DELAY, dx: u.x, dy: u.y });
  }

  /** The stasis clock, set on the ground where he aims. */
  private setClock(): void {
    this.specialCd = this.kit.specialCooldown;
    const u = this.line;
    const want = u.dist !== undefined ? Phaser.Math.Clamp(u.dist, FIELD_MIN, FIELD_MAX) : 60;
    let tx = this.x;
    let ty = this.y;
    for (let d = want; d >= 0; d -= 4) {
      tx = this.x + u.x * d;
      ty = this.y + u.y * d;
      if (this.world.walkable(tx, ty)) break;
    }
    this.world.addEffect(new StasisClock(this.world, tx, ty, this.kit.pal, this.kit.specialDamage));
  }

  /** Keep a few seconds of his past, and let any echo whose moment has come throw its shard. */
  private remember(): void {
    const past = this.past;
    past.push({ t: this.now, x: this.x, y: this.y, hp: this.vitals.hp, frame: this.body.frame.name });
    while (past.length > 2 && past[1].t < this.now - REWIND_BACK - 200) past.shift();
    while (this.echoes.length && this.echoes[0].at <= this.now) {
      const e = this.echoes.shift()!;
      this.echoThrow(e.dx, e.dy);
    }
  }

  /** Where he was `ago` ms ago (the oldest he remembers, if not that far). */
  private momentAgo(ago: number): Moment {
    const want = this.now - ago;
    if (!this.past.length) return { t: this.now, x: this.x, y: this.y, hp: this.vitals.hp, frame: this.body.frame.name };
    for (const m of this.past) if (m.t >= want) return m;
    return this.past[this.past.length - 1];
  }

  /** His echo from a moment ago steps out of the air where he stood then and throws the same shard. */
  private echoThrow(dx: number, dy: number): void {
    const then = this.momentAgo(ECHO_BACK);
    let ex = then.x;
    let ey = then.y;
    // Standing still, his echo stands a step behind him instead of inside him.
    if (Math.hypot(ex - this.x, ey - this.y) < 8) {
      ex = this.x - dx * 10;
      ey = this.y - dy * 5;
    }
    const k = this.kit;
    const dir = dirOf(dx, dy);
    this.ghost(ex, ey, `cast_${dir}_2`, 460, 0.75);
    this.world.addEffect(new TimeBolt(this.world, ex + dx * 7, ey + dy * 3 + 1, dx, dy, { ...k.bolt, damage: Math.round(k.bolt.damage * ECHO_SHARE), lit: false }, 0.85));
    this.world.debris(k.pal.tints, snap(ex), snap(ey) - 14, 5, ey + 20, 'gather');
    sound.chronoCast(this.world.pan(ex), true);
  }

  /**
   * The rewind: he is snapped back along his own path to where he stood a
   * few breaths ago, the wounds taken since undone; a burst of paradox tears
   * open where he left.
   */
  private rewind(): void {
    this.specialCd = this.kit.specialCooldown;
    const k = this.kit;
    const then = this.momentAgo(REWIND_BACK);
    const x0 = this.x;
    const y0 = this.y;
    sound.rewind(this.world.pan(x0));
    // Where he left: the paradox tears.
    const hit = strikeGround(this.world, x0, y0, 30, { damage: k.specialDamage, heavy: true, knock: 180, fromX: x0, fromY: y0 - 4 });
    for (const h of hit) this.world.debris(k.pal.tints, snap(h.x), snap(h.y - h.bodyY), 5, h.y + 20);
    this.world.addEffect(new Shockwave(this.world, x0, y0 - 4, 0, Math.PI, 34, k.pal, 380));
    bloom(this.world, x0, y0 - 12, k.pal.hot, 1.8, 360, y0 + 30, 0.8);
    this.ghost(x0, y0, this.body.frame.name, 700, 0.8);
    // The way back: his past selves along the path, brightest nearest where he lands.
    const n = 5;
    for (let i = 1; i <= n; i++) {
      const m = this.momentAgo((REWIND_BACK * i) / (n + 1));
      if (Math.hypot(m.x - x0, m.y - y0) < 4 && Math.hypot(m.x - then.x, m.y - then.y) < 4) continue;
      this.ghost(m.x, m.y, m.frame, 360 + i * 90, 0.3 + (i / n) * 0.4);
    }
    // The wounds since then, closed.
    const back = Math.min(Math.round(this.vitals.max * REWIND_HEAL), Math.max(0, Math.round(then.hp - this.vitals.hp)));
    if (back > 0) {
      const got = this.vitals.heal(back);
      if (got > 0) this.world.popNumber(snap(then.x), snap(then.y) - 30, `+${got}`, 0x9dff9a);
    }
    this.x = then.x;
    this.y = then.y;
    this.past = [];
    this.echoes = [];
    this.world.evade(420);
    bloom(this.world, this.x, this.y - 12, k.pal.core, 1.4, 320, this.y + 30, 0.9);
    flare(this.world, this.x, this.y - 12, 80, k.pal.light, 2, 450);
    this.world.debris(k.pal.tints, snap(this.x), snap(this.y) - 14, 14, this.y + 20, 'burst');
  }

  /** An echo of himself in light, in one of his own frames. */
  private ghost(x: number, y: number, frame: string, life: number, peak: number): void {
    if (!this.body.texture.has(frame)) frame = this.body.frame.name;
    this.world.addEffect(new Ghost(this.world, x, y, this.kit.key, frame, CHRONO_ORIGIN_X / CHRONO_W, CHRONO_ORIGIN_Y / CHRONO_H, this.kit.pal.hot, life, peak));
  }

  private updateHud(): void {
    // The special button: a ring refilling over the cooldown.
    beamHud.charge = 1 - this.specialCd / this.kit.specialCooldown;
    beamHud.over = 0;
    beamHud.firing = this.state === 'field' || this.state === 'rewind';
    comboHud.hits = 0;
    comboHud.window = 0;
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
  }
}
