import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { BREATH_ORDER, BREW_FPS, BREW_FRAMES, BREW_H, BREW_MOUTH_Y, BREW_ORIGIN_X, BREW_ORIGIN_Y, BREW_RELEASE, BREW_W } from '../art/brewmaster';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { reachesBody, Vitals, type Hurtbox, type MeleeArea } from './combat';
import { HitSpark, Shockwave, SlashArc, type Effect, type Scheme } from './Slash';
import { pal, type Pal } from './ultimate/ink';
import { Venom, type ToxStyle } from './Toxins';
import { FireSpray, FoamSplash, type Froth } from './BrewFx';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Brewmaster (the Alchemist class's bruiser): a stout dwarf brewer with
// a copper still on his back, a jug at his belt and a great mash paddle.
//  - Attack (held): the paddle, in a chain of three: a forehand sweep, a
//    backhand, and a two-handed slam he throws his belly behind, which
//    staggers and throws foes back. Froth flies off every blow.
//  - Ability: Firebreath. A long swig from the jug, a flint struck in his
//    fingers, and the mouthful sprayed through it: a short cone of fire that
//    sets what it touches burning.
//  - Special: Rolling Thunder (see ultimate/brewmaster.ts). A huge keg bowled
//    along the aim, scattering foes aside, that bursts in a foamy blast.

const SWINGS = ['swing', 'swing2', 'slam'] as const;
type Swing = (typeof SWINGS)[number];
/** Each swing's length and when its blow lands, from its frames, so the timing matches the animation. */
const SWING_MS: Record<Swing, number> = { swing: (BREW_FRAMES.swing / BREW_FPS.swing) * 1000, swing2: (BREW_FRAMES.swing2 / BREW_FPS.swing2) * 1000, slam: (BREW_FRAMES.slam / BREW_FPS.slam) * 1000 };
const LAND_MS: Record<Swing, number> = { swing: (BREW_RELEASE.swing / BREW_FPS.swing) * 1000, swing2: (BREW_RELEASE.swing2 / BREW_FPS.swing2) * 1000, slam: (BREW_RELEASE.slam / BREW_FPS.slam) * 1000 };
const SWING_DAMAGE = 11;
const SLAM_DAMAGE = 20;
const SLAM_KNOCK = 170;
const SLAM_R = 17;
/** How far ahead of him the slam comes down. */
const SLAM_AHEAD = 13;
const REACH = 22;
const SWING_SPREAD = (110 * Math.PI) / 180;
const COMBO_WINDOW = 520;
/** His pace while swinging and while breathing fire: a heavy man plants his feet. */
const SWING_PACE = 0.45;
const BREATH_PACE = 0.35;

/** The firebreath, timed off its animation: the whole move, and when the fire starts and stops. */
const BREATH_MS = (BREATH_ORDER.length / BREW_FPS.breath) * 1000;
const SPIT_FROM = (BREW_RELEASE.breath / BREW_FPS.breath) * 1000;
const SPIT_TO = ((BREATH_ORDER.length - 1) / BREW_FPS.breath) * 1000;
/** When he takes the swig (the gulp is heard), into the move. */
const GULP_AT = (1.2 / BREW_FPS.breath) * 1000;
const BREATH_COOLDOWN = 7000;
const FIRE_REACH = 46;
const FIRE_SPREAD = (26 * Math.PI) / 180;
const FIRE_TICK = 110;
const FIRE_DAMAGE = 3;
/** The burn each breath leaves: how long, and one stack per breath up to two. */
const BURN_MS = 2500;
const BURN_STACKS = 2;

const FOOTFALLS = new Set([1, 4]);

export interface BrewKit {
  key: string;
  /** The look id worn ('brewmaster' or 'jarl'). */
  look: string;
  maxHp: number;
  speed: number;
  /** The paddle's swoosh and the froth's sparks. */
  foam: Scheme;
  froth: Froth;
  /** The breath of fire, and the burn it leaves. */
  fire: Pal;
  burn: ToxStyle;
  /** The Special's keg and its blast. */
  ult: Pal;
  /** The firebox's glow on his back at night (0 for none). */
  lamp: number;
}

const BASE_STATS = HERO_STATS['brewmaster.brewmaster'];

export const BREW_KIT: BrewKit = {
  key: 'brewmaster',
  look: 'brewmaster',
  maxHp: BASE_STATS.hp,
  speed: BASE_STATS.speed,
  foam: { core: 0xffffff, hot: 0xfff6dc, mid: 0xe8d4a0, deep: 0x9a7444 },
  froth: { light: 0xfffcf0, mid: 0xf0e2bc, deep: 0xc8a870, glint: 0xffffff },
  fire: pal(0xfff8e0, 0xffc848, 0xff7a1a, 0xc03a10, 0xff9a3a),
  burn: { core: 0xfff0b0, hot: 0xffb040, mid: 0xff6a1a, deep: 0xa83010, murk: 0x3a1a0c, tints: [0xfff0b0, 0xffb040, 0xff6a1a], light: 0xff8a2a, numbers: 0xff9a3a, suffix: '' },
  ult: pal(0xfffbe8, 0xffe08a, 0xf0a030, 0x9a5a1a, 0xffc060),
  lamp: 0xffa040,
};

/** The Mead Jarl: honey froth, and fire burning blue-white. */
export const JARL_KIT: BrewKit = {
  ...BREW_KIT,
  key: 'brewmaster_jarl',
  look: 'jarl',
  foam: { core: 0xffffff, hot: 0xfff4c8, mid: 0xf4cc60, deep: 0xa8701a },
  froth: { light: 0xfffbe6, mid: 0xffe69a, deep: 0xe0a830, glint: 0xffffff },
  fire: pal(0xffffff, 0xc8e8ff, 0x5a9cff, 0x2a5ad8, 0x8ac4ff),
  burn: { core: 0xffffff, hot: 0xc8e8ff, mid: 0x5a9cff, deep: 0x2a5ad8, murk: 0x0c1a3a, tints: [0xffffff, 0xc8e8ff, 0x5a9cff], light: 0x8ac4ff, numbers: 0x9ad0ff, suffix: '' },
  ult: pal(0xfffef4, 0xffeaa0, 0xf4b830, 0x9a5c0c, 0xd8ecff),
  lamp: 0,
};

export class Brewmaster implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: BrewKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private lamp: Phaser.GameObjects.Light;
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private clock = 0;
  /** The move under way: a swing, the firebreath, or nothing. */
  private move: Swing | 'breath' | null = null;
  private moveT = 0;
  private landed = false;
  private gulped = false;
  private step = 0;
  private lastSwingAt = -99999;
  private breathCd = 0;
  private spray: FireSpray | null = null;
  private tickT = 0;
  /** Foes this breath has already set burning (one stack each per breath). */
  private scorched = new Set<Hurtbox>();
  private venom: Venom;
  private fx: Effect[] = [];
  private prevSpecial = false;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: BrewKit = BREW_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.venom = new Venom(world, kit.burn, BURN_STACKS);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = BREW_ORIGIN_X / BREW_W;
    const oy = BREW_ORIGIN_Y / BREW_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(1.15, 1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    // The still's firebox glows warm on his back at night.
    this.lamp = world.lights.addLight(x, y, 55, kit.lamp || 0xffffff, 0);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const e of this.fx) e.destroy();
      this.spray?.destroy();
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.breathCd = Math.max(0, this.breathCd - dt);
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;

    if (this.move) {
      this.moveT += dt;
      if (this.move === 'breath') this.breathe(dt);
      else {
        if (!this.landed && this.moveT >= LAND_MS[this.move]) {
          this.landed = true;
          this.strike(this.move);
        }
        if (this.moveT >= SWING_MS[this.move]) this.move = null;
      }
    }
    if (!this.move) {
      if (pressed && this.breathCd === 0) this.startBreath();
      else if (attack) this.startSwing();
    }

    const pace = this.kit.speed * (this.move === 'breath' ? BREATH_PACE : this.move ? SWING_PACE : 1);
    if (moving) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * pace * Math.min(1, len) * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * pace * Math.min(1, len) * (dt / 1000), bounds.top, bounds.bottom);
    }
    if (!this.move) {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_walk_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    }
    this.venom.update(dt);
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.sync();
    this.updateHud();
  }

  // -------------------------------------------------------------------------
  // The paddle

  private startSwing(): void {
    const chain = this.step > 0 && this.step < 3 && this.clock - this.lastSwingAt <= COMBO_WINDOW + SWING_MS.swing;
    this.step = chain ? this.step + 1 : 1;
    this.lastSwingAt = this.clock;
    const s = SWINGS[this.step - 1];
    this.move = s;
    this.moveT = 0;
    this.landed = false;
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_${s}_${this.dir}`);
    sound.swing(this.step, this.world.pan(this.x));
  }

  /** The blow connects: a sweep of the paddle flinging froth, or the slam's thump and a ring of suds. */
  private strike(s: Swing): void {
    const w = this.world;
    const u = this.aimVec();
    const cx = snap(this.x);
    const cy = snap(this.y) - 12;
    const depth = snap(this.y);
    if (s === 'slam') {
      const bx = cx + u.x * SLAM_AHEAD;
      const by = cy + u.y * (SLAM_AHEAD - 3);
      const gy = snap(this.y + u.y * (SLAM_AHEAD - 3));
      this.fx.push(new Shockwave(w, snap(bx), gy, 18, this.kit.foam));
      this.fx.push(new FoamSplash(w, snap(bx), gy, this.kit.froth, true, u.x, u.y));
      const hits = w.melee({ kind: 'circle', x: bx, y: by, radius: SLAM_R }, { damage: SLAM_DAMAGE, heavy: true, knock: SLAM_KNOCK, fromX: this.x, fromY: this.y - 12 });
      for (const h of hits) this.fx.push(new HitSpark(w, h.x, h.y, this.kit.foam, h.y + 13, true));
      w.debris([this.kit.froth.light, this.kit.froth.mid, this.kit.froth.deep], bx, by + 8, 10, by + 20, 'burst');
      sound.paddle(w.pan(bx), true);
      w.cameras.main.shake(hits.length ? 140 : 80, hits.length ? 0.0007 : 0.0003);
      return;
    }
    const deg = (Math.atan2(u.y, u.x) * 180) / Math.PI;
    const hand = this.dir === 'right' ? -1 : 1;
    const sweep = s === 'swing' ? hand : -hand;
    this.fx.push(new SlashArc(w, cx, cy, deg + sweep * 95, deg - sweep * 95, 17, this.kit.foam, depth));
    const hits = w.melee({ kind: 'arc', x: cx, y: cy, radius: REACH, angle: Math.atan2(u.y, u.x), spread: SWING_SPREAD }, { damage: SWING_DAMAGE });
    for (const h of hits) this.fx.push(new HitSpark(w, h.x, h.y, this.kit.foam, h.y + 13, false));
    if (hits.length) {
      const h = hits[0];
      this.fx.push(new FoamSplash(w, snap(h.x), snap(h.y + 10), this.kit.froth, false, u.x, u.y));
      sound.paddle(w.pan(h.x), false);
      w.cameras.main.shake(70, 0.0003);
    }
  }

  // -------------------------------------------------------------------------
  // Firebreath

  private startBreath(): void {
    this.move = 'breath';
    this.moveT = 0;
    this.gulped = false;
    this.step = 0;
    this.breathCd = BREATH_COOLDOWN;
    this.scorched.clear();
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_breath_${this.dir}`);
  }

  /** The swig, then the fire: poured the way he faces (he can turn it as he goes), each tick scorching what it reaches. */
  private breathe(dt: number): void {
    const w = this.world;
    if (!this.gulped && this.moveT >= GULP_AT) {
      this.gulped = true;
      sound.gulp(w.pan(this.x));
    }
    const pouring = this.moveT >= SPIT_FROM && this.moveT < SPIT_TO;
    if (pouring) {
      // He turns the spray with the aim while he pours, his body following.
      const u = this.aimVec();
      const d = dirOf(u.x, u.y);
      if (d !== this.dir) {
        const frame = this.body.anims.currentFrame?.index ?? 0;
        this.dir = d;
        this.body.play({ key: `${this.kit.key}_breath_${d}`, startFrame: Math.max(0, frame - 1) });
      }
      const m = this.mouth(u);
      if (!this.spray) {
        this.spray = new FireSpray(w, this.kit.fire, FIRE_REACH, FIRE_SPREAD);
        w.addEffect(this.spray);
        this.tickT = 0;
        sound.ignite();
        sound.flame(w.pan(this.x));
      }
      this.spray.aim(m.x, m.y, m.ground, u.x, u.y);
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT += FIRE_TICK;
        this.scorch(m, u);
      }
    } else if (this.spray) {
      this.spray.stop();
      this.spray = null;
    }
    if (this.moveT >= BREATH_MS) {
      this.move = null;
      this.spray?.stop();
      this.spray = null;
    }
  }

  /** One tick of the fire: everything in the cone is struck, and set burning once per breath. */
  private scorch(m: { x: number; y: number; ground: number }, u: { x: number; y: number }): void {
    const w = this.world;
    const area: MeleeArea = { kind: 'arc', x: m.x, y: m.ground - 8, radius: FIRE_REACH, angle: Math.atan2(u.y, u.x), spread: FIRE_SPREAD };
    const hit = w.hurtboxesWhere((h) => h.alive && reachesBody(area, h) !== null);
    for (const h of hit) {
      h.hurt({ damage: FIRE_DAMAGE, heavy: false, knock: 30, fromX: this.x, fromY: this.y });
      if (!this.scorched.has(h)) {
        this.scorched.add(h);
        this.venom.dose(h, BURN_MS, 1);
      }
    }
    if (hit.length && Math.random() < 0.4) sound.sizzle(w.pan(hit[0].x));
  }

  /** Where the fire leaves him: his mouth, a little ahead of his face the way he faces. */
  private mouth(u: { x: number; y: number }): { x: number; y: number; ground: number } {
    const side = Math.abs(u.x) > Math.abs(u.y);
    return {
      x: this.x + u.x * (side ? 6 : 2),
      y: this.y - BREW_MOUTH_Y + u.y * (u.y > 0 ? 3 : 0),
      ground: this.y,
    };
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.breathCd / BREATH_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.spray !== null;
    const since = this.clock - this.lastSwingAt;
    comboHud.hits = this.step;
    comboHud.max = 3;
    comboHud.window = this.step === 0 ? 0 : this.step < 3 ? Math.max(0, 1 - since / (COMBO_WINDOW + SWING_MS.swing)) : Math.max(0, 1 - since / 700);
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
    // The firebox sits low on his back, so its glow falls behind him.
    const u = this.aimVec();
    this.lamp.setPosition(rx - u.x * 6, ry - 8 - u.y * 4);
    this.lamp.intensity = this.kit.lamp ? 0.7 * (1 - this.daylight) * (0.9 + 0.1 * Math.sin(this.clock * 0.013)) : 0;
  }
}
