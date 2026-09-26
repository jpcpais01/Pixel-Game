import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { HAND_AT, PUPPETEER_H, PUPPETEER_ORIGIN_X, PUPPETEER_ORIGIN_Y, PUPPETEER_RELEASE, PUPPETEER_W } from '../art/puppeteer';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { snap } from './display';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { FATE_STRINGS, GOLD_STRINGS, ICE_STRINGS, Marionette, Puppet, SILK_STRINGS, ThreadLash, type LashKind, type PuppetKit } from './Strings';
import type { Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type Act = 'pull' | 'twirl' | 'lash' | 'snag' | 'weave';
type State = 'free' | Act;

/** How a puppeteer type plays: its look, its body, its attack and its special. */
export interface PuppeteerKit {
  key: string;
  /** The stringweaver: threads and the marionette, rather than a puppet that fights for him. */
  weaver: boolean;
  maxHp: number;
  speed: number;
  /** A breath after each attack before the next. */
  rest: number;
  /** How long after an attack the next one still chains, in ms. */
  comboWindow: number;
  specialCooldown: number;
  strings: Pal;
  /** The marionettist's puppet. */
  puppet?: PuppetKit;
  /** The stringweaver's lash and snag, and the marionette's reach. */
  lash?: LashKind;
  snag?: LashKind;
  marionette?: { range: number; radius: number; hold: number; slam: number };
}

const GALLANT: PuppetKit = {
  key: 'puppet',
  strings: GOLD_STRINGS,
  reach: 66,
  strike: { damage: 11, radius: 18 },
  chop: { damage: 20, radius: 22, knock: 200 },
  spin: { damage: 6, radius: 20, every: 220, time: 1700 },
};

/**
 * The marionettist: he fights through his puppet, a wooden knight on three
 * strings. It lunges out and cuts, twice, then leaps into a heavy chop; on
 * the special it dashes out and pirouettes, blade out, among his foes.
 */
export const MARIONETTE_KIT: PuppeteerKit = {
  key: 'puppeteer',
  weaver: false,
  maxHp: 95,
  speed: 60,
  rest: 90,
  comboWindow: 900,
  specialCooldown: 10000,
  strings: GOLD_STRINGS,
  puppet: GALLANT,
};

export const PORCELAIN_KIT: PuppeteerKit = {
  ...MARIONETTE_KIT,
  key: 'puppeteer_porcelain',
  strings: ICE_STRINGS,
  puppet: { ...GALLANT, key: 'puppet_porcelain', strings: ICE_STRINGS },
};

/**
 * The stringweaver: quicker and frailer, she cracks razor threads like whips
 * that cut through everything along them, the third hooking a foe and reeling
 * it in; on the special she drops strings on a crowd, hoists them up helpless
 * and slams them down.
 */
export const WEAVER_KIT: PuppeteerKit = {
  key: 'weaver',
  weaver: true,
  maxHp: 80,
  speed: 66,
  rest: 80,
  comboWindow: 800,
  specialCooldown: 11000,
  strings: SILK_STRINGS,
  lash: { length: 78, damage: 7, snag: false, hold: 0, reel: 0 },
  snag: { length: 84, damage: 10, snag: true, hold: 650, reel: 190 },
  marionette: { range: 100, radius: 36, hold: 1500, slam: 16 },
};

export const CRIMSON_KIT: PuppeteerKit = { ...WEAVER_KIT, key: 'weaver_crimson', strings: FATE_STRINGS };

/**
 * The puppeteer: works on the attack button towards the aim (the mouse on a
 * computer) and on the special. The marionettist sends his puppet; the
 * stringweaver casts her threads herself.
 */
export class Puppeteer implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals: Vitals;
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  /** The marionettist's puppet (the Grand Finale takes it over). */
  readonly puppet: Puppet | null;
  readonly kit: PuppeteerKit;
  private dir: Dir = 'down';
  private world: WorldScene;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private line: Aim = { x: 0, y: 1 };
  private released = false;
  private cooldown = 0;
  private specialCd = 0;
  private combo = 0;
  private comboT = 0;
  /** A pull the puppet couldn't take yet (still busy): sent as soon as it's free. */
  private queued: { x: number; y: number; heavy: boolean } | null = null;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: PuppeteerKit = MARIONETTE_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    const k = kit.key;
    this.x = x;
    this.y = y;
    const ox = PUPPETEER_ORIGIN_X / PUPPETEER_W;
    const oy = PUPPETEER_ORIGIN_Y / PUPPETEER_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${k}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, k, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${k}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.body.play(`${k}_idle_down`);
    this.puppet = kit.puppet ? new Puppet(world, x, y, kit.puppet, this) : null;

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (this.state !== 'free' && anim.key.startsWith(`${k}_${this.state}_`)) {
        if (this.state === 'pull' || this.state === 'lash' || this.state === 'snag') this.comboT = this.kit.comboWindow;
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

  /** The working hand in the world: the cross's middle, or the fingers the threads leave from. */
  hand(): { x: number; y: number } {
    const at = HAND_AT.get(`${this.kit.key}:${this.body.frame.name}`);
    return at ? { x: snap(this.x) + at.x, y: snap(this.y) + at.y } : { x: this.x, y: this.y - 20 };
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);
    if (this.state === 'free') {
      this.comboT = Math.max(0, this.comboT - dt);
      if (this.comboT === 0) this.combo = 0;
    }

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.start(this.kit.weaver ? 'weave' : 'twirl');
      else if (attack && (!this.puppet || (!this.puppet.busy && !this.queued))) this.start(this.kit.weaver ? (this.combo === 2 ? 'snag' : 'lash') : 'pull');
    }

    const slow = { free: Math.min(1, len), pull: 0.6, twirl: 0.4, lash: 0.6, snag: 0.35, weave: 0.3 }[this.state];
    const speed = this.kit.speed * slow;
    const vx = moving ? (mx / len) * speed : 0;
    const vy = moving ? (my / len) * speed : 0;
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = `${this.kit.key}_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      if (!this.released) this.takeAim();
      const f = this.body.anims.currentFrame;
      if (!this.released && f && f.index - 1 >= PUPPETEER_RELEASE[this.state]) {
        this.released = true;
        this.land(this.state);
      }
    }

    this.sync();
    if (this.queued && this.puppet && this.puppet.strike(this.queued.x, this.queued.y, this.queued.heavy)) this.queued = null;
    this.puppet?.update(dt, this.aim?.look ? this.aim : null, moving ? this.lastMove : { x: 0, y: 0 });
    this.updateHud();
  }

  private start(act: Act): void {
    this.state = act;
    this.released = false;
    this.takeAim();
    this.body.play(`${this.kit.key}_${act}_${this.dir}`);
  }

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

  private land(act: Act): void {
    switch (act) {
      case 'pull': {
        const heavy = this.combo === 2;
        const s = this.strikeSpot();
        if (!this.puppet!.strike(s.x, s.y, heavy)) this.queued = { ...s, heavy };
        sound.twang(this.world.pan(this.x), false);
        this.combo = heavy ? 0 : this.combo + 1;
        if (heavy) this.comboT = 0;
        break;
      }
      case 'twirl': {
        this.specialCd = this.kit.specialCooldown;
        const s = this.spot(56, this.puppet!.kit.reach);
        this.puppet!.pirouette(s.x, s.y);
        sound.twang(this.world.pan(this.x), true);
        break;
      }
      case 'lash':
      case 'snag': {
        const snag = act === 'snag';
        const u = this.line;
        this.world.addEffect(new ThreadLash(this.world, () => this.hand(), u.x, u.y, snag ? this.kit.snag! : this.kit.lash!, this.kit.strings));
        sound.twang(this.world.pan(this.x), false);
        this.combo = snag ? 0 : this.combo + 1;
        if (snag) this.comboT = 0;
        break;
      }
      case 'weave': {
        this.specialCd = this.kit.specialCooldown;
        const m = this.kit.marionette!;
        const s = this.spot(64, m.range);
        this.world.addEffect(new Marionette(this.world, s.x, s.y, this.kit.strings, m.radius, m.hold, m.slam));
        break;
      }
    }
  }

  /**
   * Where the puppet lunges: at the foe nearest the aim within its reach,
   * standing just off its side; else the spot aimed at, or out ahead.
   */
  private strikeSpot(): { x: number; y: number } {
    const u = this.line;
    const reach = this.puppet!.kit.reach;
    let best = Infinity;
    let pick: Hurtbox | null = null;
    for (const h of this.world.hurtboxesWhere((h) => h.alive)) {
      const dx = h.x - this.x;
      const dy = h.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > reach + 12) continue;
      const along = d > 1 ? (dx * u.x + dy * u.y) / d : 1;
      if (along < 0.55 && d > 26) continue;
      const score = d * (1.6 - along);
      if (score < best) {
        best = score;
        pick = h;
      }
    }
    if (pick) {
      const side = pick.x >= this.puppet!.x ? -1 : 1;
      return { x: pick.x + side * (pick.radius + 7), y: pick.y + 1 };
    }
    return this.spot(40, reach);
  }

  /** A spot on the ground: at the mouse (within `range`), else `ahead` px along the aim. */
  private spot(ahead: number, range: number): { x: number; y: number } {
    const u = this.line;
    const d = u.dist !== undefined ? Phaser.Math.Clamp(u.dist, 20, range) : ahead;
    // A mouse is measured from the chest; the ground is lower.
    const lift = u.dist !== undefined ? -4 : 0;
    return { x: this.x + u.x * d, y: this.y + lift + u.y * d };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.specialCd / this.kit.specialCooldown;
    beamHud.over = 0;
    beamHud.firing = this.state === 'twirl' || this.state === 'weave' || !!this.puppet?.spinning;
    comboHud.max = 3;
    comboHud.hits = this.combo;
    comboHud.window = this.combo > 0 ? this.comboT / this.kit.comboWindow : 0;
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
