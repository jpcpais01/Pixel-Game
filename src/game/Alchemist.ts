import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { ALCH_H, ALCH_ORIGIN_X, ALCH_ORIGIN_Y, ALCH_W, RELEASE_FRAME, RELEASE_H } from '../art/alchemist';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { Bog, CHEM_TOX, Flask, HEX_TOX, onGround, PLAGUE_TOX, Splash, Venom, type ToxStyle } from './Toxins';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

/** How an alchemist plays: his numbers, his throw and his special. */
export interface AlchemistKit {
  hp: number;
  /** World px / second. */
  speed: number;
  /** A breath between throws once the arm has come back. */
  throwRest: number;
  specialCooldown: number;
  /** How far a flask flies: to the mouse, within min..max; straight ahead on touch. */
  minRange: number;
  maxRange: number;
  touchRange: number;
  /** The splash of a thrown flask, and how long its poison lasts. */
  splashR: number;
  splashDamage: number;
  splashPoison: number;
  /** How many doses of poison stack up on one monster. */
  maxStacks: number;
  /**
   * The special: `count` great flasks hurled in a fan `spread` radians apart,
   * the outer ones a little shorter; each bursts and leaves a bog.
   */
  bog: { count: number; spread: number; r: number; splashDamage: number; time: number; tick: number; damage: number; fumeEvery: number };
}

/** The plague doctor and the hex witch: one great flask and a wide, lasting bog. */
export const PLAGUE_KIT: AlchemistKit = {
  hp: 95,
  speed: 60,
  throwRest: 70,
  specialCooldown: 10000,
  minRange: 18,
  maxRange: 104,
  touchRange: 70,
  splashR: 14,
  splashDamage: 6,
  splashPoison: 3000,
  maxStacks: 3,
  bog: { count: 1, spread: 0, r: 32, splashDamage: 10, time: 5500, tick: 450, damage: 3, fumeEvery: 130 },
};

/**
 * Chemtech: lighter on his feet and quicker to throw, but a shorter arm and a
 * little less health. His canisters hit softer and their chem wears off
 * sooner, but it is corrosive and builds up to four doses instead of three.
 * The special hurls three canisters in a fan, each leaving a small chem pool.
 */
export const CHEM_KIT: AlchemistKit = {
  hp: 88,
  speed: 66,
  throwRest: 40,
  specialCooldown: 11000,
  minRange: 16,
  maxRange: 90,
  touchRange: 62,
  splashR: 13,
  splashDamage: 5,
  splashPoison: 2300,
  maxStacks: 4,
  bog: { count: 3, spread: 0.42, r: 18, splashDamage: 7, time: 3800, tick: 450, damage: 2, fumeEvery: 300 },
};

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'throw' | 'brew';

/** One alchemist subtype: its texture key, the colours of its poison and how it plays. */
export interface AlchemistStyle {
  key: string;
  tox: ToxStyle;
  kit: AlchemistKit;
}

export const PLAGUE_STYLE: AlchemistStyle = { key: 'alchemist', tox: PLAGUE_TOX, kit: PLAGUE_KIT };
export const WITCH_STYLE: AlchemistStyle = { key: 'alchemist_witch', tox: HEX_TOX, kit: PLAGUE_KIT };
export const CHEM_STYLE: AlchemistStyle = { key: 'alchemist_chem', tox: CHEM_TOX, kit: CHEM_KIT };

/**
 * The alchemist: lobs flasks of poison on the attack button that burst where
 * they land (at the mouse on a computer), splashing everything near and
 * leaving it poisoned; the poison stacks and bites for a while after. On the
 * special he shakes his great flask to the boil and hurls it, leaving a bog of
 * seething poison that bites everything standing in it. Chemtech throws
 * canisters instead, faster and shorter, and fans three out on the special
 * (see CHEM_KIT).
 */
export class Alchemist implements Hero {
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
  /** Where the flask in hand is going: a direction and how far. */
  private line: Aim = { x: 0, y: 1 };
  private range: number;
  private released = false;
  private cooldown = 0;
  private specialCd = 0;
  private venom: Venom;
  private style: AlchemistStyle;
  private kit: AlchemistKit;

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, style: AlchemistStyle = PLAGUE_STYLE) {
    this.world = world;
    this.style = style;
    this.kit = style.kit;
    this.vitals = new Vitals(this.kit.hp);
    this.range = this.kit.touchRange;
    const k = style.key;
    this.x = x;
    this.y = y;
    this.venom = new Venom(world, style.tox, this.kit.maxStacks);
    const ox = ALCH_ORIGIN_X / ALCH_W;
    const oy = ALCH_ORIGIN_Y / ALCH_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${k}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, k, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${k}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.body.play(`${k}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if ((this.state === 'throw' && anim.key.startsWith(`${k}_throw_`)) || (this.state === 'brew' && anim.key.startsWith(`${k}_brew_`))) {
        this.state = 'free';
        this.cooldown = this.kit.throwRest;
        this.body.play(`${k}_idle_${this.dir}`);
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${k}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    // Shared HUD state: don't leave the special lit on the next hero's button.
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.startThrow('brew');
      else if (attack) this.startThrow('throw');
    }

    const sp = this.kit.speed;
    const speed = { free: sp * Math.min(1, len), throw: sp * 0.45, brew: sp * 0.25 }[this.state];
    const vx = moving ? (mx / len) * speed : 0;
    const vy = moving ? (my / len) * speed : 0;
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      // Fighting faces the aim, even walking backwards; otherwise the way of the walk.
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = `${this.style.key}_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      // Until it leaves the hand, the flask follows the mouse.
      if (!this.released) this.takeAim();
      const f = this.body.anims.currentFrame;
      if (!this.released && f && f.index - 1 >= RELEASE_FRAME[this.state]) {
        this.released = true;
        this.release(this.state === 'brew');
      }
    }

    this.venom.update(dt);
    this.sync();
    this.updateHud();
  }

  private startThrow(kind: 'throw' | 'brew'): void {
    this.state = kind;
    this.released = false;
    this.takeAim();
    this.body.play(`${this.style.key}_${kind}_${this.dir}`);
    if (kind === 'brew') sound.brew();
  }

  /** Which way, and how far: at the mouse on a computer, else ahead the way he last walked. */
  private takeAim(): void {
    const a = this.aim ?? this.lastMove;
    this.line = { x: a.x, y: a.y };
    const kit = this.kit;
    this.range = this.aim?.dist !== undefined ? Phaser.Math.Clamp(this.aim.dist, kit.minRange, kit.maxRange) : kit.touchRange;
    const dir = dirOf(a.x, a.y);
    if (dir !== this.dir) {
      this.dir = dir;
      // Turn mid-throw without restarting it.
      const cur = this.body.anims.currentAnim;
      const frame = this.body.anims.currentFrame;
      if (cur && frame && this.state !== 'free') this.body.play({ key: `${this.style.key}_${this.state}_${dir}`, startFrame: frame.index - 1 });
    }
  }

  /** The flask leaves his hand. The mouse is aimed from the chest, so the landing spot is measured from there. */
  private release(big: boolean): void {
    const u = this.line;
    const fromChest = this.aim?.dist !== undefined;
    // It leaves the hand a little ahead of him, to his throwing side.
    const hx = this.x + u.x * 5;
    const hy = this.y + u.y * 3;
    sound.toss(this.world.pan(this.x), big);
    if (big) this.specialCd = this.kit.specialCooldown;
    const { count, spread } = this.kit.bog;
    const n = big ? count : 1;
    for (let i = 0; i < n; i++) {
      // Fanned out round the aim; the outer ones fly a little shorter. Only the middle one lights the ground.
      const off = (i - (n - 1) / 2) * spread;
      const range = this.range * (off === 0 ? 1 : 0.86);
      const c = Math.cos(off);
      const s = Math.sin(off);
      const dx = u.x * c - u.y * s;
      const dy = u.x * s + u.y * c;
      const tx = this.x + dx * range;
      const ty = (fromChest ? this.y - 14 : this.y) + dy * range;
      const lit = off === 0;
      this.world.addEffect(new Flask(this.world, hx, hy, RELEASE_H, tx, ty, big, (x, y) => (big ? this.bog(x, y, lit) : this.splash(x, y)), this.style.tox));
    }
  }

  /** A flask bursting: everything in the splash takes a hit and a dose of poison. */
  private splash(x: number, y: number): void {
    const kit = this.kit;
    this.world.addEffect(new Splash(this.world, x, y, kit.splashR, this.style.tox));
    sound.shatter(this.world.pan(x), false);
    const hits = this.world.hurtboxesWhere((h) => h.alive && onGround(h, x, y, kit.splashR));
    for (const h of hits) {
      h.hurt({ damage: kit.splashDamage, heavy: false, knock: 35, fromX: x, fromY: y - 4 });
      this.venom.dose(h, kit.splashPoison);
    }
    if (hits.length) this.world.cameras.main.shake(50, 0.00025);
  }

  /** A great flask bursting: a heavy splash, then the bog. `lit` is false for the outer ones of a fan. */
  private bog(x: number, y: number, lit: boolean): void {
    const b = this.kit.bog;
    const single = b.count === 1;
    this.world.addEffect(new Splash(this.world, x, y, b.r * 0.8, this.style.tox, lit));
    sound.shatter(this.world.pan(x), single || lit);
    if (lit) {
      sound.bog(this.world.pan(x));
      this.world.cameras.main.shake(140, 0.0006);
    }
    for (const h of this.world.hurtboxesWhere((hb) => hb.alive && onGround(hb, x, y, b.r))) {
      h.hurt({ damage: b.splashDamage, heavy: true, knock: single ? 70 : 50, fromX: x, fromY: y - 4 });
      this.venom.dose(h, this.kit.splashPoison, single ? 2 : 1);
    }
    this.world.addEffect(
      new Bog(this.world, x, y, b.r, b.time, b.tick, (inside: Hurtbox[]) => {
        for (const h of inside) {
          h.hurt({ damage: b.damage, heavy: false, knock: 0, fromX: h.x, fromY: h.y, poison: this.style.tox.numbers });
          this.venom.dose(h, 2000);
        }
      }, this.style.tox, { fumeEvery: b.fumeEvery, lit }),
    );
  }

  private updateHud(): void {
    // The special button: a ring refilling over the cooldown.
    beamHud.charge = 1 - this.specialCd / this.kit.specialCooldown;
    beamHud.over = 0;
    beamHud.firing = this.state === 'brew';
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
