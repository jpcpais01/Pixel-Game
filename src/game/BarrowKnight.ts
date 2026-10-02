import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { BARROW_H, BARROW_HIT_FRAME, BARROW_ORIGIN_X, BARROW_ORIGIN_Y, BARROW_W, LAMP_AT } from '../art/barrow';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { HitSpark, SlashArc, type Effect, type Scheme } from './Slash';
import { Risen, type RisenStats } from './Souls';
import { Clods, GRAVE_SOIL, GroundCrack, MOSS_SOIL, OpenGrave, type GraveHold, type Soil } from './Graves';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { turnMidMove } from './anims';
import { HERO_STATS } from './stats';
import { stand } from './rest';
import { heroTimers } from './timers';

// The Barrow Knight: the Necromancer's tank, a knight of the old kings risen
// from his barrow in rusted plate, swinging a maul whose head is a gravestone,
// a soul-lamp of corpse-light at his belt (art/barrow.ts).
//  - The attack is the grave maul: a swing, a dragging backhand that flings
//    earth, then an overhead slam that cracks the ground and throws foes back.
//  - The ability is Open grave: he drives the gravestone into the earth where
//    he aims and wrenches it; the ground splits, arms of bone burst up and
//    seize every foe on it, and a ghoul climbs out of the pit to fight for him.
//  - His Special, Graveyard, is in ultimate/barrow.ts.

const stats = HERO_STATS['necromancer.barrow'];

/** A swing chains into the next if it starts within this long of the previous one. */
const COMBO_WINDOW = 1400;
/** Rest after each blow of the chain before the next can start. */
const SETTLE = { swing1: 30, swing2: 30, slam: 180 };
/** The two swings: reach from his chest, half-angle of the arc, blow, knockback. */
const SWING = { reach: 23, spread: (70 * Math.PI) / 180, damage: 11, knock: 70 };
const BACKHAND = { reach: 22, spread: (60 * Math.PI) / 180, damage: 11, knock: 90 };
/** The slam: how far ahead the stone comes down, the ring it shakes, its blow. */
const SLAM = { ahead: 13, radius: 21, damage: 20, knock: 160 };
/** The swings strike from about his chest. */
const CHEST_Y = 10;
/** A small step into each blow (px/s for ms). */
const LUNGE = { speed: 40, ms: 110 };

/** Open grave: how often, and where (at the mouse within these; ahead on touch). */
const GRAVE_COOLDOWN = 9000;
const MIN_RANGE = 16;
const MAX_RANGE = 56;
const TOUCH_RANGE = 28;
const HOLD: GraveHold = { radius: 22, hold: 1800, burst: 8, tick: 450, tickDamage: 4, bossSlow: 0.45 };
/** The ghoul that climbs out of the grave. */
const GHOUL = { life: 8000, damage: 6, speed: 44, rest: 700, leash: 120 };
/** Where the ghoul keeps to round him while there's nothing to fight. */
const GHOUL_SLOT = { x: -16, y: 10 };

/** The soul-lamp's light: how far it reaches, and its gutter. */
const LAMP = { radius: 40, day: 0.25, night: 0.95, flicker: 0.12 };

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);
const DEG: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

type State = 'free' | 'swing' | 'dig';
type Blow = 'swing1' | 'swing2' | 'slam';

/** How a Barrow Knight look plays: its sheet, the colours of his blows and his corpse-light, his earth and his dead. */
export interface BarrowKit {
  key: string;
  /** The maul's arcs. */
  arc: Scheme;
  /** The corpse-light (his eyes, his lamp): the grave's glow, the cracks' seams, the ghoul's rising. */
  glow: Scheme;
  soil: Soil;
  /** The ghoul's sheet. */
  ghoul: string;
}

export const BARROW_KIT: BarrowKit = {
  key: 'necro_barrow',
  arc: { core: 0xf4ffe8, hot: 0xd8e8c0, mid: 0x9aa890, deep: 0x4a5a48, light: 0xb8f070 },
  glow: { core: 0xf4ffe0, hot: 0xd0ff8a, mid: 0x8ad84a, deep: 0x2e6a2a, light: 0xb8f070 },
  soil: GRAVE_SOIL,
  ghoul: 'ghoul',
};

/** Mossgrave: a mossy stone bound in roots, a wisp's light in his eyes and lamp, roots for arms. */
export const MOSSGRAVE_KIT: BarrowKit = {
  key: 'necro_mossgrave',
  arc: { core: 0xeafff8, hot: 0xc8e8d8, mid: 0x7aa898, deep: 0x3a5a52, light: 0x6af0e8 },
  glow: { core: 0xecfffc, hot: 0x9ff8ee, mid: 0x3ad0c8, deep: 0x0e5a68, light: 0x6af0e8 },
  soil: MOSS_SOIL,
  ghoul: 'ghoul_moss',
};

export class BarrowKnight implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals = new Vitals(stats.hp);
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: BarrowKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private lamp: Phaser.GameObjects.Light;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  /** Towards the mouse on a computer (see Hero). */
  private aim: Aim | null = null;
  private clock = 0;
  private cooldown = 0;
  private graveCd = 0;

  // The maul chain.
  private blow: Blow = 'swing1';
  private step = 0;
  private lastSwingAt = -Infinity;
  private struck = false;
  private buffered = false;
  private prevAttack = false;
  private dash = { vx: 0, vy: 0, t: 0 };

  // Open grave.
  private line: Aim = { x: 0, y: 1 };
  private range = TOUCH_RANGE;
  private ghoul: Risen | null = null;

  private fx: Effect[] = [];

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: BarrowKit = BARROW_KIT) {
    this.world = world;
    this.kit = kit;
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = BARROW_ORIGIN_X / BARROW_W;
    const oy = BARROW_ORIGIN_Y / BARROW_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(1.25, 1.1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.lamp = world.lights.addLight(x, y, LAMP.radius, kit.glow.light ?? kit.glow.hot, 0);
    this.body.play(`${key}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      const k = anim.key;
      if (this.state === 'swing' && k.startsWith(`${key}_${this.blow}_`)) this.settle(SETTLE[this.blow]);
      else if (this.state === 'dig' && k.startsWith(`${key}_dig_`)) this.settle(120);
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
      world.lights.removeLight(this.lamp);
    });
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
    this.graveCd = Math.max(0, this.graveCd - dt);
    if (this.ghoul && !this.ghoul.standing) this.ghoul = null;

    // A tap during a swing queues the next one, so quick taps chain cleanly.
    const pressed = attack && !this.prevAttack;
    this.prevAttack = attack;
    if (pressed && this.state === 'swing') this.buffered = true;

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.graveCd === 0) this.startDig();
      else if (attack || this.buffered) this.startSwing();
    }

    // He's slow and heavy: a blow roots him almost to the spot.
    const pace = { free: Math.min(1, len), swing: 0.3, dig: 0.1 }[this.state];
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
      if (this.state === 'swing' && !this.struck && at >= BARROW_HIT_FRAME[this.blow]) {
        this.struck = true;
        if (this.blow === 'slam') this.slam();
        else this.sweep();
      } else if (this.state === 'dig') {
        // Until the stone bites, the grave goes where the mouse is.
        if (!this.struck) this.takeAim();
        if (!this.struck && at >= BARROW_HIT_FRAME.dig) {
          this.struck = true;
          this.openGrave();
        }
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
    this.buffered = false;
    this.struck = false;
    this.state = 'swing';
    this.blow = this.step === 1 ? 'swing1' : this.step === 2 ? 'swing2' : 'slam';
    this.dir = this.aimDir();
    const u = this.facing();
    sound.maulSwing(this.world.pan(this.x), this.step === 2);
    this.body.play(`${this.kit.key}_${this.blow}_${this.dir}`);
    this.dash = { vx: u.x * LUNGE.speed, vy: u.y * LUNGE.speed, t: LUNGE.ms };
  }

  /** A swing lands: the stone cuts a wide arc before him; the backhand throws earth after it. */
  private sweep(): void {
    const cx = snap(this.x);
    const cy = snap(this.y) - CHEST_Y;
    const depth = snap(this.y);
    const deg = DEG[this.dir];
    const s = this.blow === 'swing1' ? SWING : BACKHAND;
    // Swing and backhand sweep opposite ways round him.
    const way = this.blow === 'swing1' ? 1 : -1;
    const sweep = (s.spread * 180) / Math.PI + 15;
    this.fx.push(new SlashArc(this.world, cx, cy, deg - way * sweep, deg + way * sweep, 19, this.kit.arc, depth, 170));
    const rad = (deg * Math.PI) / 180;
    const hits = this.world.melee({ kind: 'arc', x: cx, y: cy, radius: s.reach, angle: rad, spread: s.spread }, { damage: s.damage, knock: s.knock });
    if (this.blow === 'swing2') {
      // The backhand drags through the ground: grave dirt flung off the stone the way he faces.
      this.world.addEffect(new Clods(this.world, cx + Math.cos(rad) * 8, snap(this.y) + Math.sin(rad) * 5, 9, this.kit.soil, { dir: rad, spread: 0.9, speed: 70, up: 60 }));
    }
    this.impact(hits, false);
  }

  /** The slam: the gravestone comes down foot-first, the ground cracks and everything round it is thrown back. */
  private slam(): void {
    const u = this.facing();
    const x = snap(this.x + u.x * SLAM.ahead);
    const y = snap(this.y + u.y * SLAM.ahead * 0.6);
    const { glow, soil } = this.kit;
    sound.maulSlam(this.world.pan(x));
    this.world.cameras.main.shake(130, 0.0009);
    this.world.addEffect(new GroundCrack(this.world, x, y, SLAM.radius, glow, soil));
    this.world.addEffect(new Clods(this.world, x, y, 14, soil, { speed: 50, up: 85 }));
    this.world.debris([soil.dust, soil.earth[0], glow.mid], x, y - 2, 10, y + 6, 'burst');
    const hits = this.world.melee({ kind: 'circle', x, y: y - 4, radius: SLAM.radius }, { damage: SLAM.damage, heavy: true, knock: SLAM.knock, fromX: x, fromY: y });
    this.impact(hits, true);
  }

  private impact(hits: { x: number; y: number }[], heavy: boolean): void {
    for (const h of hits) this.fx.push(new HitSpark(this.world, h.x, h.y, this.kit.arc, h.y + 13, heavy));
    if (hits.length) {
      sound.boneHit(this.world.pan(hits[0].x));
      if (!heavy) this.world.cameras.main.shake(60, 0.0003);
    }
  }

  private startDig(): void {
    this.state = 'dig';
    this.step = 0;
    this.struck = false;
    this.takeAim();
    this.body.play(`${this.kit.key}_dig_${this.dir}`);
  }

  /** Which way, and how far: at the mouse on a computer, else ahead the way he last walked. */
  private takeAim(): void {
    const a = this.aim ?? this.lastMove;
    this.line = { x: a.x, y: a.y };
    this.range = this.aim?.dist !== undefined ? Phaser.Math.Clamp(this.aim.dist, MIN_RANGE, MAX_RANGE) : TOUCH_RANGE;
    const dir = dirOf(a.x, a.y);
    if (dir !== this.dir) {
      this.dir = dir;
      turnMidMove(this.body, `${this.kit.key}_dig_${dir}`);
    }
  }

  /** The stone bites and he wrenches it: the grave opens where he aimed, and a ghoul climbs out of it. */
  private openGrave(): void {
    this.graveCd = GRAVE_COOLDOWN;
    const area = this.world.area;
    let x = Phaser.Math.Clamp(this.x + this.line.x * this.range, area.left + 4, area.right - 4);
    let y = Phaser.Math.Clamp(this.y + this.line.y * this.range, area.top + 4, area.bottom - 4);
    // No grave opens in a wall or a tree: dig at his feet instead.
    if (!this.world.walkable(x, y)) {
      x = this.x + this.line.x * 12;
      y = this.y + this.line.y * 8;
    }
    x = snap(x);
    y = snap(y);
    const { glow, soil } = this.kit;
    this.world.addEffect(new OpenGrave(this.world, x, y, HOLD, glow, soil));

    // One ghoul at a time: the last one sinks back as the new one rises.
    this.ghoul?.crumble();
    const g: RisenStats = { ...GHOUL, fx: glow, sheet: this.kit.ghoul };
    const ghoul = new Risen(this.world, x, y + 1, this, GHOUL_SLOT, g);
    this.ghoul = ghoul;
    this.world.addEffect(ghoul);
    heroTimers.follow('ghoul', 'ability', '', glow.hot, () => (ghoul.standing ? { left: ghoul.lifeLeft, total: GHOUL.life } : null));
  }

  /** Which way a blow goes: at the mouse on a computer, else the way he last walked. */
  private aimDir(): Dir {
    const a = this.aim ?? this.lastMove;
    return dirOf(a.x, a.y);
  }

  private facing(): { x: number; y: number } {
    const a = (DEG[this.dir] * Math.PI) / 180;
    return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
  }

  private updateHud(): void {
    // The ability button's ring refills over the cooldown.
    beamHud.charge = 1 - this.graveCd / GRAVE_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'dig';
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
    // The soul-lamp at his belt lights the ground round him, brightest at night, guttering.
    const at = LAMP_AT[this.dir];
    this.lamp.setPosition(rx + at.x, ry + at.y);
    const flick = 1 + LAMP.flicker * (Math.sin(this.clock * 0.013) + Math.sin(this.clock * 0.031) * 0.5);
    this.lamp.intensity = (LAMP.day + (LAMP.night - LAMP.day) * (1 - this.daylight)) * flick * this.alpha;
  }
}
