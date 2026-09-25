import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { ARCHER_H, ARCHER_ORIGIN_X, ARCHER_ORIGIN_Y, ARCHER_W, ARROW_H, LOOSE_FRAME } from '../art/archer';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { Arrow, ArrowRain, RANGER_ARROW, STORM_ARROW, type ArrowStyle } from './Arrows';
import { onGround } from './Toxins';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

export const MAX_HP = 90;
const SPEED = 64; // world px / second
/** A breath between shots once the string hand is back. */
const SHOT_REST = 50;
const ARROW_RANGE = 170;
const ARROW_DAMAGE = 8;
const SPECIAL_COOLDOWN = 9000;
/** Where the rain comes down: at the mouse, within these; ahead the way he last walked on touch. */
const MIN_RANGE = 20;
const MAX_RANGE = 120;
const TOUCH_RANGE = 72;
const RAIN_R = 30;
/** The rain strikes everything in the ring every RAIN_TICK ms while it falls. */
const RAIN_TICK = 190;
const RAIN_DAMAGE = 5;

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'shoot' | 'volley';

/** How an archer look plays: its texture key and the colours of its shots. */
export interface ArcherStyle {
  key: string;
  arrow: ArrowStyle;
}

export const RANGER_STYLE: ArcherStyle = { key: 'archer', arrow: RANGER_ARROW };
export const STORM_STYLE: ArcherStyle = { key: 'archer_storm', arrow: STORM_ARROW };

/**
 * The archer: looses arrows on the attack button, fast and straight (at the
 * mouse on a computer), each striking the first body in its path; spent ones
 * stick in the ground. On the special he aims his bow at the sky and looses a
 * volley that comes down as a rain of arrows on a ring where he aimed,
 * striking everything in it again and again.
 */
export class Archer implements Hero {
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
  /** Where the arrow on the string is going: a direction and, for the volley, how far. */
  private line: Aim = { x: 0, y: 1 };
  private range = TOUCH_RANGE;
  private loosed = false;
  private cooldown = 0;
  private specialCd = 0;
  private style: ArcherStyle;

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, style: ArcherStyle = RANGER_STYLE) {
    this.world = world;
    this.style = style;
    const k = style.key;
    this.x = x;
    this.y = y;
    const ox = ARCHER_ORIGIN_X / ARCHER_W;
    const oy = ARCHER_ORIGIN_Y / ARCHER_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${k}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, k, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${k}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.body.play(`${k}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if ((this.state === 'shoot' && anim.key.startsWith(`${k}_shoot_`)) || (this.state === 'volley' && anim.key.startsWith(`${k}_volley_`))) {
        this.state = 'free';
        this.cooldown = SHOT_REST;
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
      if (special && this.specialCd === 0) this.startShot('volley');
      else if (attack) this.startShot('shoot');
    }

    const speed = { free: SPEED * Math.min(1, len), shoot: SPEED * 0.5, volley: SPEED * 0.2 }[this.state];
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
      // Until the arrow leaves the string, the aim follows the mouse.
      if (!this.loosed) this.takeAim();
      const f = this.body.anims.currentFrame;
      if (!this.loosed && f && f.index - 1 >= LOOSE_FRAME[this.state]) {
        this.loosed = true;
        if (this.state === 'volley') this.looseVolley();
        else this.loose();
      }
    }

    this.sync();
    this.updateHud();
  }

  private startShot(kind: 'shoot' | 'volley'): void {
    this.state = kind;
    this.loosed = false;
    this.takeAim();
    this.body.play(`${this.style.key}_${kind}_${this.dir}`);
    sound.bowDraw(kind === 'volley');
  }

  /** Which way, and how far: at the mouse on a computer, else ahead the way he last walked. */
  private takeAim(): void {
    const a = this.aim ?? this.lastMove;
    this.line = { x: a.x, y: a.y };
    this.range = this.aim?.dist !== undefined ? Phaser.Math.Clamp(this.aim.dist, MIN_RANGE, MAX_RANGE) : TOUCH_RANGE;
    const dir = dirOf(a.x, a.y);
    if (dir !== this.dir) {
      this.dir = dir;
      // Turn mid-draw without starting over.
      const frame = this.body.anims.currentFrame;
      if (frame && this.state !== 'free') this.body.play({ key: `${this.style.key}_${this.state}_${dir}`, startFrame: frame.index - 1 });
    }
  }

  /**
   * The arrow leaves the string. It flies over the whole world, not just the
   * room the hero's step is clamped to. It flies at chest height, the height the
   * mouse is aimed from, so its ground track runs from his feet along the aim.
   */
  private loose(): void {
    const u = this.line;
    sound.bowShot(this.world.pan(this.x), this.style.arrow.storm);
    this.world.addEffect(
      new Arrow(this.world, this.x + u.x * 6, this.y + u.y * 3, u.x, u.y, ARROW_RANGE, this.world.area, (h, x, y) => {
        h.hurt({ damage: ARROW_DAMAGE, heavy: false, knock: 70, fromX: x - u.x * 8, fromY: y - u.y * 8 });
      }, this.style.arrow),
    );
  }

  /** The volley goes up; the rain will come down on the spot he aimed at. The mouse is aimed from the chest. */
  private looseVolley(): void {
    const u = this.line;
    const fromChest = this.aim?.dist !== undefined;
    const area = this.world.area;
    const tx = Phaser.Math.Clamp(this.x + u.x * this.range, area.left, area.right);
    const ty = Phaser.Math.Clamp((fromChest ? this.y - ARROW_H : this.y) + u.y * this.range, area.top, area.bottom);
    this.specialCd = SPECIAL_COOLDOWN;
    sound.volley(this.world.pan(this.x), this.style.arrow.storm);
    this.world.cameras.main.shake(60, 0.0002);
    this.world.addEffect(
      new ArrowRain(this.world, snap(this.x), snap(this.y) - 30, tx, ty, RAIN_R, RAIN_TICK, (x, y, r) => {
        const hits = this.world.hurtboxesWhere((h) => h.alive && onGround(h, x, y, r));
        for (const h of hits) h.hurt({ damage: RAIN_DAMAGE, heavy: false, knock: 15, fromX: h.x, fromY: h.y - 6 });
        if (hits.length) this.world.cameras.main.shake(40, this.style.arrow.storm ? 0.0004 : 0.0002);
      }, this.style.arrow),
    );
  }

  private updateHud(): void {
    // The special button: a ring refilling over the cooldown.
    beamHud.charge = 1 - this.specialCd / SPECIAL_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'volley';
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
