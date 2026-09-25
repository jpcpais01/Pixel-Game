import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { ALCH_H, ALCH_ORIGIN_X, ALCH_ORIGIN_Y, ALCH_W, RELEASE_FRAME, RELEASE_H } from '../art/alchemist';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { Bog, Flask, onGround, Splash, Venom } from './Toxins';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

export const MAX_HP = 95;
const SPEED = 60; // world px / second
/** A breath between throws once the arm has come back. */
const THROW_REST = 70;
const SPECIAL_COOLDOWN = 10000;
/** How far a flask flies: to the mouse, within these; straight ahead on touch. */
const MIN_RANGE = 18;
const MAX_RANGE = 104;
const TOUCH_RANGE = 70;
/** The splash of a thrown flask. */
const SPLASH_R = 14;
const SPLASH_DAMAGE = 6;
const SPLASH_POISON = 3000;
/** The great flask and the bog it leaves. */
const BOG_R = 32;
const BOG_SPLASH_DAMAGE = 10;
const BOG_TIME = 5500;
const BOG_TICK = 450;
const BOG_DAMAGE = 3;

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'throw' | 'brew';

/**
 * The alchemist: lobs flasks of poison on the attack button that burst where
 * they land (at the mouse on a computer), splashing everything near and
 * leaving it poisoned; the poison stacks and bites for a while after. On the
 * special he shakes his great flask to the boil and hurls it, leaving a bog of
 * seething poison that bites everything standing in it.
 */
export class Alchemist implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals = new Vitals(MAX_HP);
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
  private range = TOUCH_RANGE;
  private released = false;
  private cooldown = 0;
  private specialCd = 0;
  private venom: Venom;

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number) {
    this.world = world;
    this.x = x;
    this.y = y;
    this.venom = new Venom(world);
    const ox = ALCH_ORIGIN_X / ALCH_W;
    const oy = ALCH_ORIGIN_Y / ALCH_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, 'alchemist_s', 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, 'alchemist', 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, 'alchemist_e', 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.body.play('alchemist_idle_down');

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if ((this.state === 'throw' && anim.key.startsWith('alchemist_throw_')) || (this.state === 'brew' && anim.key.startsWith('alchemist_brew_'))) {
        this.state = 'free';
        this.cooldown = THROW_REST;
        this.body.play(`alchemist_idle_${this.dir}`);
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith('alchemist_walk') && FOOTFALLS.has(frame.index - 1)) sound.step();
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

    const speed = { free: SPEED * Math.min(1, len), throw: SPEED * 0.45, brew: SPEED * 0.25 }[this.state];
    const vx = moving ? (mx / len) * speed : 0;
    const vy = moving ? (my / len) * speed : 0;
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      if (moving) this.dir = dirOf(mx, my);
      const key = `alchemist_${moving ? 'walk' : 'idle'}_${this.dir}`;
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
    this.body.play(`alchemist_${kind}_${this.dir}`);
    if (kind === 'brew') sound.brew();
  }

  /** Which way, and how far: at the mouse on a computer, else ahead the way he last walked. */
  private takeAim(): void {
    const a = this.aim ?? this.lastMove;
    this.line = { x: a.x, y: a.y };
    this.range = this.aim?.dist !== undefined ? Phaser.Math.Clamp(this.aim.dist, MIN_RANGE, MAX_RANGE) : TOUCH_RANGE;
    const dir = dirOf(a.x, a.y);
    if (dir !== this.dir) {
      this.dir = dir;
      // Turn mid-throw without restarting it.
      const cur = this.body.anims.currentAnim;
      const frame = this.body.anims.currentFrame;
      if (cur && frame && this.state !== 'free') this.body.play({ key: `alchemist_${this.state}_${dir}`, startFrame: frame.index - 1 });
    }
  }

  /** The flask leaves his hand. The mouse is aimed from the chest, so the landing spot is measured from there. */
  private release(big: boolean): void {
    const u = this.line;
    const fromChest = this.aim?.dist !== undefined;
    const tx = this.x + u.x * this.range;
    const ty = (fromChest ? this.y - 14 : this.y) + u.y * this.range;
    // It leaves the hand a little ahead of him, to his throwing side.
    const hx = this.x + u.x * 5;
    const hy = this.y + u.y * 3;
    sound.toss(this.world.pan(this.x), big);
    if (big) this.specialCd = SPECIAL_COOLDOWN;
    this.world.addEffect(new Flask(this.world, hx, hy, RELEASE_H, tx, ty, big, (x, y) => (big ? this.bog(x, y) : this.splash(x, y))));
  }

  /** A flask bursting: everything in the splash takes a hit and a dose of poison. */
  private splash(x: number, y: number): void {
    this.world.addEffect(new Splash(this.world, x, y, SPLASH_R));
    sound.shatter(this.world.pan(x), false);
    const hits = this.world.hurtboxesWhere((h) => h.alive && onGround(h, x, y, SPLASH_R));
    for (const h of hits) {
      h.hurt({ damage: SPLASH_DAMAGE, heavy: false, knock: 35, fromX: x, fromY: y - 4 });
      this.venom.dose(h, SPLASH_POISON);
    }
    if (hits.length) this.world.cameras.main.shake(50, 0.00025);
  }

  /** The great flask bursting: a heavy splash, then the bog. */
  private bog(x: number, y: number): void {
    this.world.addEffect(new Splash(this.world, x, y, BOG_R * 0.8));
    sound.shatter(this.world.pan(x), true);
    sound.bog(this.world.pan(x));
    this.world.cameras.main.shake(140, 0.0006);
    for (const h of this.world.hurtboxesWhere((b) => b.alive && onGround(b, x, y, BOG_R))) {
      h.hurt({ damage: BOG_SPLASH_DAMAGE, heavy: true, knock: 70, fromX: x, fromY: y - 4 });
      this.venom.dose(h, SPLASH_POISON, 2);
    }
    this.world.addEffect(
      new Bog(this.world, x, y, BOG_R, BOG_TIME, BOG_TICK, (inside: Hurtbox[]) => {
        for (const h of inside) {
          h.hurt({ damage: BOG_DAMAGE, heavy: false, knock: 0, fromX: h.x, fromY: h.y, poison: true });
          this.venom.dose(h, 2000);
        }
      }),
    );
  }

  private updateHud(): void {
    // The special button: a ring refilling over the cooldown.
    beamHud.charge = 1 - this.specialCd / SPECIAL_COOLDOWN;
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
