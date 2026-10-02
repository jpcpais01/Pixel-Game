import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { PYRO_H, PYRO_MOVES, PYRO_MUZZLE_H, PYRO_ORIGIN_X, PYRO_ORIGIN_Y, PYRO_W } from '../art/pyrotechnist';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { Firecrackers, Star, type CrackerLook } from './Fireworks';
import { pal, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { turnMidMove } from './anims';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Pyrotechnist (one of the Alchemist class's kits): a fireworks-maker
// in a lacquered vermilion coat, a Roman candle in one hand and a
// smouldering linstock in the other.
//  - Attack (held): Roman candle. Levels the candle and fires a star of
//    coloured fire, gold, rose, jade and azure in turn; it pops in a little
//    sparkly burst on the first foe it meets, singeing those beside it.
//  - Ability: Firecrackers. Tosses a lit string of firecrackers onto the
//    spot he aims at; its fuse burns along it and each cracker goes off in
//    turn, every bang staggering what's near for a moment.
//  - Special: Skyburst (see ultimate/fireworks.ts). He plants a battery of
//    rockets and lights it; one after another they arc up over the foes and
//    burst in great chrysanthemums, raining glitter that burns.

const STATS = HERO_STATS['pyrotechnist.pyrotechnist'];
const MAX_HP = STATS.hp;
const SPEED = STATS.speed;

/** The candle's shot, from its animation: its whole length and when the star leaves the mouth. */
const FIRE_MS = (PYRO_MOVES.fire.frames / PYRO_MOVES.fire.fps) * 1000;
const FIRE_AT = (PYRO_MOVES.fire.release / PYRO_MOVES.fire.fps) * 1000;
/** A breath between one star and the next, held down. */
const FIRE_REST = 50;
/** The toss, and when the string leaves the hand. */
const TOSS_MS = (PYRO_MOVES.toss.frames / PYRO_MOVES.toss.fps) * 1000;
const TOSS_AT = (PYRO_MOVES.toss.release / PYRO_MOVES.toss.fps) * 1000;
const CRACKER_COOLDOWN = 7000;
/** Where the firecrackers land: at the mouse, within these; ahead the way he last walked on touch. */
const TOSS_MIN = 28;
const TOSS_MAX = 110;
const TOSS_TOUCH = 70;
/** Moving while busy: firing slows him a little, the toss more. */
const PACE = { fire: 0.6, toss: 0.4 };

const FOOTFALLS = new Set([1, 4]);

/** One look of the Pyrotechnist: its sheet, the colours its stars burn in turn, its firecrackers, and its Special's colours. */
export interface PyroStyle {
  key: string;
  stars: Pal[];
  crackers: CrackerLook;
  pal: Pal;
}

/** Vermilion's stars: gold, rose, jade and azure. */
export const VERMILION_STARS: Pal[] = [
  pal(0xfffbe0, 0xffe070, 0xffb020, 0xc06a10, 0xffc050),
  pal(0xfff0f6, 0xffa0c8, 0xff4a8a, 0xa8185a, 0xff80b0),
  pal(0xf0fff4, 0xa0ffc0, 0x30d878, 0x108a48, 0x70f0a0),
  pal(0xf0f8ff, 0xa0d0ff, 0x4a98ff, 0x1a4ab0, 0x80b8ff),
];

/** Carnival's: purple, teal, gold and magenta. */
export const CARNIVAL_STARS: Pal[] = [
  pal(0xfbf0ff, 0xd8a0ff, 0xa050f0, 0x5a1ea0, 0xc080ff),
  pal(0xf0fffb, 0x90ffe8, 0x20d0b0, 0x0a7a6a, 0x60f0d0),
  pal(0xfffbe0, 0xffe070, 0xffb020, 0xc06a10, 0xffc050),
  pal(0xfff0fa, 0xff9ae0, 0xe83ab8, 0x8a1270, 0xff70d0),
];

export const VERMILION_STYLE: PyroStyle = {
  key: 'pyrotechnist',
  stars: VERMILION_STARS,
  crackers: { paper: [0xec6040, 0xc8301e, 0x8a1612], cap: 0xf8d870, confetti: [0xff5a3a, 0xd8201a, 0xf8d870, 0xffe0c8], bang: pal(0xffffff, 0xfff0a0, 0xff8a30, 0xc8301e, 0xffa040) },
  pal: pal(0xfffbe8, 0xffd860, 0xff5a3a, 0x9a1a2a, 0xffa050),
};

export const CARNIVAL_STYLE: PyroStyle = {
  key: 'pyrotechnist_carnival',
  stars: CARNIVAL_STARS,
  crackers: { paper: [0xa860e0, 0x7428a8, 0x481470], cap: 0xf8d870, confetti: [0xa860e0, 0x30d8b8, 0xf8d870, 0xff7ad0], bang: pal(0xffffff, 0xf0d0ff, 0xb070f0, 0x5a1ea0, 0xc080ff) },
  pal: pal(0xfbf0ff, 0xd8a0ff, 0x20d0b0, 0x5a1ea0, 0xc080ff),
};

/** The stars for a look id (the Special's rockets burn in them too). */
export const starsFor = (look: string): Pal[] => (look === 'carnival' ? CARNIVAL_STARS : VERMILION_STARS);

type Move = 'fire' | 'toss';

export class Pyrotechnist implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals = new Vitals(MAX_HP);
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private style: PyroStyle;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  /** The slow match's glow: a little warm light that follows him about at night. */
  private ember: Phaser.GameObjects.Light;
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private move: Move | null = null;
  private moveT = 0;
  private released = false;
  private rest = 0;
  private crackerCd = 0;
  /** Which colour the next star burns in. */
  private nextStar = 0;
  /** Where the move in hand is going: a direction, and for the toss how far. */
  private line: Aim = { x: 0, y: 1 };
  private range = TOSS_TOUCH;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, style: PyroStyle = VERMILION_STYLE) {
    this.world = world;
    this.style = style;
    this.x = x;
    this.y = y;
    const k = style.key;
    const ox = PYRO_ORIGIN_X / PYRO_W;
    const oy = PYRO_ORIGIN_Y / PYRO_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${k}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, k, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${k}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.ember = world.lights.addLight(x, y, 40, 0xffa050, 0);
    this.body.play(`${k}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${k}_walk_`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
      world.lights.removeLight(this.ember);
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.crackerCd = Math.max(0, this.crackerCd - dt);
    this.rest = Math.max(0, this.rest - dt);

    if (this.move) {
      this.moveT += dt;
      // Until it leaves the hand, the shot follows the aim.
      if (!this.released) this.takeAim();
      const at = this.move === 'fire' ? FIRE_AT : TOSS_AT;
      if (!this.released && this.moveT >= at) {
        this.released = true;
        if (this.move === 'fire') this.loose();
        else this.toss();
      }
      if (this.moveT >= (this.move === 'fire' ? FIRE_MS : TOSS_MS)) {
        this.move = null;
        this.rest = FIRE_REST;
      }
    }
    if (!this.move && this.rest === 0) {
      if (special && this.crackerCd === 0) this.start('toss');
      else if (attack) this.start('fire');
    }

    const speed = SPEED * (this.move ? PACE[this.move] : Math.min(1, len));
    if (moving) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * speed * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * speed * (dt / 1000), bounds.top, bounds.bottom);
    }
    if (!this.move) {
      // Fighting faces the aim, even walking backwards; otherwise the way of the walk.
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.style.key}_walk_${this.dir}` : stand(this.body, `${this.style.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    }
    this.sync();
    this.updateHud();
  }

  private start(kind: Move): void {
    this.move = kind;
    this.moveT = 0;
    this.released = false;
    if (kind === 'toss') this.crackerCd = CRACKER_COOLDOWN;
    this.takeAim();
    this.body.play(`${this.style.key}_${kind}_${this.dir}`);
  }

  /** Which way, and how far: at the mouse on a computer, else ahead the way he last walked. */
  private takeAim(): void {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    this.line = { x: a.x / l, y: a.y / l };
    this.range = this.aim?.dist !== undefined ? Phaser.Math.Clamp(this.aim.dist, TOSS_MIN, TOSS_MAX) : TOSS_TOUCH;
    const dir = dirOf(a.x, a.y);
    if (dir !== this.dir) {
      this.dir = dir;
      // Turn mid-move without starting it over.
      if (this.move) turnMidMove(this.body, `${this.style.key}_${this.move}_${dir}`);
    }
  }

  /** A star leaves the candle's mouth, in the next colour round. */
  private loose(): void {
    const u = this.line;
    const p = this.style.stars[this.nextStar++ % this.style.stars.length];
    // The mouth is a little ahead of him, at chest height.
    this.world.addEffect(new Star(this.world, this.x + u.x * 9, this.y + u.y * 4, u.x, u.y, p));
    sound.candle(this.world.pan(this.x));
    this.world.debris([p.core, p.hot, 0xc8c2cc], this.x + u.x * 9, this.y - PYRO_MUZZLE_H + u.y * 4, 3, this.y + 2, 'trail');
  }

  /** The lit string leaves his hand for the spot he aims at (not past where the ground ends). The mouse is aimed from the chest. */
  private toss(): void {
    const u = this.line;
    const fromChest = this.aim?.dist !== undefined;
    let tx = this.x;
    let ty = this.y;
    for (let r = this.range; r >= 0; r -= 4) {
      tx = this.x + u.x * r;
      ty = (fromChest ? this.y - PYRO_MUZZLE_H : this.y) + u.y * r;
      if (this.world.walkable(tx, ty)) break;
    }
    this.world.addEffect(new Firecrackers(this.world, this.x + u.x * 5, this.y + u.y * 3, tx, ty, this.style.crackers));
    sound.toss();
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.crackerCd / CRACKER_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.move === 'toss';
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
    // The match hangs at his off-hand side.
    const side = this.dir === 'left' ? 1 : -1;
    this.ember.setPosition(rx + side * 6, ry - 14);
    this.ember.intensity = 0.7 * (1 - this.daylight) * this.alpha;
  }
}
