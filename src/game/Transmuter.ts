import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { TRANS_H, TRANS_HAND_Y, TRANS_ORIGIN_X, TRANS_ORIGIN_Y, TRANS_RELEASE, TRANS_W } from '../art/transmuter';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { pal, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';
import { heroTimers } from './timers';
import { QuicksilverBead, TransmutationCircle } from './TransmuterFx';

// The Transmuter (the Alchemist's third kit): a scholar of the Great Work
// with a brass gauntlet set with a philosopher's stone.
//  - Attack (held): Quicksilver. A bead of mercury flicked from the gauntlet;
//    it bursts on the first foe and splits into two smaller beads that curve
//    off after the next nearest foes.
//  - Ability: Transmutation circle. A circle chalked on the ground at a spot
//    (the mouse, or ahead on touch); drawn, it kindles, and the foes in it
//    turn to lead for a while: held fast, grey, and struck harder.
//  - Special: Magnum Opus (see ultimate/transmuter.ts). A golden array
//    blooms round her and gilds every foe in it; then it closes, and the
//    gold statues shatter.
// Rubedo plays the same in red and gold: her quicksilver runs molten.

/** The flick, by its frames: 6 at 16 fps, the bead leaving on the release frame. */
const FLICK_FPS = 16;
const FLICK_POSE = (6 / FLICK_FPS) * 1000;
const FLICK_LAND = (TRANS_RELEASE.flick / FLICK_FPS) * 1000;
/** A breath between flicks once the hand is back (so held, about 2.15 a second). */
const FLICK_REST = 90;

/** Chalking the circle, by its frames: 8 at 13 fps, the circle begun on the release frame. */
const DRAW_FPS = 13;
const DRAW_POSE = (8 / DRAW_FPS) * 1000;
const DRAW_LAND = (TRANS_RELEASE.inscribe / DRAW_FPS) * 1000;
const CIRCLE_COOLDOWN = 8000;
/** Where the circle goes: at the mouse within min..max; straight ahead on touch. */
const CIRCLE_MIN = 30;
const CIRCLE_MAX = 110;
const CIRCLE_TOUCH = 70;

/** She keeps moving while she works, a little slower. */
const WORK_PACE = 0.6;

const FOOTFALLS = new Set([1, 4]);

export interface TransmuterKit {
  key: string;
  maxHp: number;
  speed: number;
  /** The quicksilver's colours, brightest first. */
  bead: Pal;
  /** The chalk's colours, as the circle glows. */
  chalk: Pal;
  /** The tint of a foe turned to lead. */
  lead: number;
  /** The philosopher's stone's light. */
  stone: number;
}

export const QUICKSILVER_KIT: TransmuterKit = {
  key: 'transmuter',
  maxHp: HERO_STATS['transmuter.transmuter'].hp,
  speed: HERO_STATS['transmuter.transmuter'].speed,
  bead: pal(0xffffff, 0xdcecf4, 0x92a8b8, 0x46566a, 0xc8f4ff),
  chalk: pal(0xffffff, 0xd8fbff, 0x6ad0f0, 0x2a7a9a, 0x6ad0f0),
  lead: 0xa8b0bc,
  stone: 0x6ad0f0,
};

/** Rubedo, the reddening, the last stage of the Work: her quicksilver runs red-gold. */
export const RUBEDO_KIT: TransmuterKit = {
  ...QUICKSILVER_KIT,
  key: 'transmuter_rubedo',
  bead: pal(0xfff4dc, 0xffc878, 0xe8582a, 0x8a1a14, 0xff9a50),
  chalk: pal(0xfff4e8, 0xffc890, 0xff5a3a, 0x9a1420, 0xff7a40),
  lead: 0xb4a8a4,
  stone: 0xff4a3a,
};

export class Transmuter implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: TransmuterKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private stone: Phaser.GameObjects.Light;
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private move: 'flick' | 'inscribe' | null = null;
  private moveT = 0;
  private landed = false;
  private flickT = 0;
  private circleCd = 0;
  private prevSpecial = false;
  /** The stone flares as she works, and dims after. */
  private glow = 0;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: TransmuterKit = QUICKSILVER_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = TRANS_ORIGIN_X / TRANS_W;
    const oy = TRANS_ORIGIN_Y / TRANS_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.stone = world.lights.addLight(x, y, 40, kit.stone, 0);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.flickT = Math.max(0, this.flickT - dt);
    this.circleCd = Math.max(0, this.circleCd - dt);
    this.glow = Math.max(0, this.glow - dt / 400);
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;

    if (this.move) {
      this.moveT += dt;
      const flick = this.move === 'flick';
      if (!this.landed && this.moveT >= (flick ? FLICK_LAND : DRAW_LAND)) {
        this.landed = true;
        if (flick) this.flick();
        else this.inscribe();
      }
      if (this.moveT >= (flick ? FLICK_POSE : DRAW_POSE)) this.move = null;
    }
    // The circle can be drawn mid-flick; a flick waits for the chalk.
    if (this.move !== 'inscribe') {
      if (pressed && this.circleCd === 0) this.start('inscribe');
      else if (!this.move && attack && this.flickT === 0) this.start('flick');
    }

    const pace = this.kit.speed * (this.move ? WORK_PACE : 1);
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
    this.sync();
    this.updateHud();
  }

  private start(move: 'flick' | 'inscribe'): void {
    this.move = move;
    this.moveT = 0;
    this.landed = false;
    if (move === 'flick') this.flickT = FLICK_POSE + FLICK_REST;
    else this.circleCd = CIRCLE_COOLDOWN;
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_${move}_${this.dir}`);
  }

  /** Where the bead leaves: the gauntlet, reaching the way she aims. */
  private hand(): { x: number; y: number } {
    const u = this.aimVec();
    return { x: this.x + u.x * 7, y: this.y + u.y * 4 };
  }

  private flick(): void {
    const u = this.aimVec();
    const h = this.hand();
    this.world.addEffect(new QuicksilverBead(this.world, h.x, h.y, u.x, u.y, TRANS_HAND_Y, this.kit.bead));
    this.glow = Math.max(this.glow, 0.6);
    sound.quicksilver(this.world.pan(this.x));
  }

  /** The circle goes down at the mouse (within reach), or straight ahead; never in a wall. */
  private inscribe(): void {
    const u = this.aimVec();
    const mouse = this.aim?.dist !== undefined;
    const want = mouse ? Phaser.Math.Clamp(this.aim!.dist!, CIRCLE_MIN, CIRCLE_MAX) : CIRCLE_TOUCH;
    // The mouse's distance is measured from her chest; the circle lies on the ground.
    const lift = mouse ? TRANS_HAND_Y * 0.5 : 0;
    let tx = this.x;
    let ty = this.y;
    for (let r = want; r >= 0; r -= 4) {
      tx = this.x + u.x * r;
      ty = this.y + u.y * r - lift;
      if (this.world.walkable(tx, ty)) break;
    }
    const fx = new TransmutationCircle(this.world, tx, ty, this.kit.chalk, this.kit.lead);
    this.world.addEffect(fx);
    heroTimers.follow(fx, 'ability', '', this.kit.chalk.mid, () => fx.timeLeft());
    this.glow = 1;
  }

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.circleCd / CIRCLE_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = false;
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
    const h = this.hand();
    this.stone.setPosition(h.x, h.y - TRANS_HAND_Y);
    // The stone glows softly by night, and flares as she works.
    this.stone.intensity = 0.35 * (1 - this.daylight) + 1.4 * this.glow;
  }
}
