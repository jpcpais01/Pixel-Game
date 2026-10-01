import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { ARCHER_H, ARCHER_ORIGIN_X, ARCHER_ORIGIN_Y, ARCHER_W, ARROW_H, LOOSE_FRAME } from '../art/archer';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { Arrow, ARBALEST_ARROW, BRIAR_ARROW } from './Arrows';
import { BRIAR_NET, NetBolt } from './Bolts';
import type { ArcherStyle } from './Archer';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { turnMidMove } from './anims';
import { HERO_STATS } from './stats';
import { stand } from './rest';

const STATS = HERO_STATS['archer.arbalest'];
export const MAX_HP = STATS.hp;
const SPEED = STATS.speed; // world px / second
/** A breath once the crossbow is spanned again. */
const SHOT_REST = 60;
const BOLT_RANGE = 200;
const BOLT_SPEED = 430;
const BOLT_DAMAGE = 20;
const BOLT_KNOCK = 150;
/** The bolt punches through this many bodies and stops in the next. */
const BOLT_PIERCE = 2;
const SPECIAL_COOLDOWN = 8000;
/** Where the net bolt bursts: at the mouse, within these; ahead the way he last walked on touch. */
const NET_MIN = 30;
const NET_MAX = 140;
const NET_TOUCH = 90;

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

/** Moving while busy: shouldering the crossbow slows him, winding it less, bracing for the net roots him. */
const PACE = { fire: 0.35, crank: 0.55, brace: 0 };

type State = 'free' | 'fire' | 'crank' | 'brace';

export const ARBALEST_STYLE: ArcherStyle = { key: 'archer_arbalest', arrow: ARBALEST_ARROW };
/** Briar Rose: thorned briar bolts shedding rose petals, and a net of briar. */
export const BRIAR_STYLE: ArcherStyle = { key: 'archer_briar', arrow: BRIAR_ARROW, net: BRIAR_NET };

/**
 * The arbalest: a slow, heavy crossbowman behind a great pavise. The attack
 * looses one steel-headed bolt that punches through the first bodies in its
 * path, and then he must wind the crossbow back with its crank, walking
 * slowly, before the next. The special drops to a knee and looses a net bolt
 * that bursts over a spot (or the first foe in its way) and pins everything
 * under it in a weighted net.
 */
export class Arbalest implements Hero {
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
  /** Where the bolt in the groove is going: a direction and, for the net, how far. */
  private line: Aim = { x: 0, y: 1 };
  private range = NET_TOUCH;
  private loosed = false;
  private cooldown = 0;
  private specialCd = 0;
  private style: ArcherStyle;

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, style: ArcherStyle = ARBALEST_STYLE) {
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
      if (this.state === 'free' || !anim.key.startsWith(`${k}_${this.state}_`)) return;
      if (this.state === 'crank') {
        this.state = 'free';
        this.cooldown = SHOT_REST;
        this.body.play(`${k}_idle_${this.dir}`);
        return;
      }
      // A bolt (or the net) has left the groove: wind the crossbow back before anything else.
      this.state = 'crank';
      this.body.play(`${k}_crank_${this.dir}`);
      sound.ratchet(this.world.pan(this.x));
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
      if (special && this.specialCd === 0) this.start('brace');
      else if (attack) this.start('fire');
    }

    const speed = this.state === 'free' ? SPEED * Math.min(1, len) : SPEED * PACE[this.state];
    const vx = moving ? (mx / len) * speed : 0;
    const vy = moving ? (my / len) * speed : 0;
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      // Fighting faces the aim, even walking backwards; otherwise the way of the walk.
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.style.key}_walk_${this.dir}` : stand(this.body, `${this.style.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else if (this.state === 'crank') {
      // Winding, he turns with the fight, or the way he walks.
      const face = this.aim?.look ? this.aim : moving ? { x: mx, y: my } : null;
      if (face) this.face(dirOf(face.x, face.y));
    } else {
      // Until the bolt leaves the groove, the aim follows the mouse.
      if (!this.loosed) this.takeAim();
      const f = this.body.anims.currentFrame;
      if (!this.loosed && f && f.index - 1 >= LOOSE_FRAME[this.state]) {
        this.loosed = true;
        if (this.state === 'brace') this.looseNet();
        else this.loose();
      }
    }

    this.sync();
    this.updateHud();
  }

  private start(kind: 'fire' | 'brace'): void {
    this.state = kind;
    this.loosed = false;
    this.takeAim();
    this.body.play(`${this.style.key}_${kind}_${this.dir}`);
    if (kind === 'brace') sound.bowDraw(true);
  }

  /** Which way, and how far: at the mouse on a computer, else ahead the way he last walked. */
  private takeAim(): void {
    const a = this.aim ?? this.lastMove;
    this.line = { x: a.x, y: a.y };
    this.range = this.aim?.dist !== undefined ? Phaser.Math.Clamp(this.aim.dist, NET_MIN, NET_MAX) : NET_TOUCH;
    this.face(dirOf(a.x, a.y));
  }

  /** Turn mid-move without starting it over. */
  private face(dir: Dir): void {
    if (dir === this.dir) return;
    this.dir = dir;
    if (this.state !== 'free') turnMidMove(this.body, `${this.style.key}_${this.state}_${dir}`);
  }

  /**
   * The bolt leaves the groove: faster and further than an arrow, flying over
   * the whole world at chest height, through the first bodies in its path.
   */
  private loose(): void {
    const u = this.line;
    sound.crossbow(this.world.pan(this.x));
    this.world.cameras.main.shake(50, 0.0004);
    this.world.addEffect(
      new Arrow(
        this.world,
        this.x + u.x * 7,
        this.y + u.y * 3,
        u.x,
        u.y,
        BOLT_RANGE,
        this.world.area,
        (h, x, y) => {
          h.hurt({ damage: BOLT_DAMAGE, heavy: true, knock: BOLT_KNOCK, fromX: x - u.x * 8, fromY: y - u.y * 8 });
        },
        this.style.arrow,
        { speed: BOLT_SPEED, pierce: BOLT_PIERCE },
      ),
    );
  }

  /** The net bolt goes; it bursts where he aimed (the mouse is aimed from the chest). */
  private looseNet(): void {
    const u = this.line;
    const fromChest = this.aim?.dist !== undefined;
    const area = this.world.area;
    const tx = Phaser.Math.Clamp(this.x + u.x * this.range, area.left, area.right);
    const ty = Phaser.Math.Clamp((fromChest ? this.y - ARROW_H : this.y) + u.y * this.range, area.top, area.bottom);
    this.specialCd = SPECIAL_COOLDOWN;
    sound.crossbow(this.world.pan(this.x));
    this.world.addEffect(new NetBolt(this.world, this.x + u.x * 7, this.y + u.y * 3, tx, ty, this.style.net));
  }

  private updateHud(): void {
    // The special button: a ring refilling over the cooldown.
    beamHud.charge = 1 - this.specialCd / SPECIAL_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'brace';
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
