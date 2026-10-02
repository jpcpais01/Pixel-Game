import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { LIGHTWRIGHT_RELEASE, LW_H, LW_HAND_Y, LW_ORIGIN_X, LW_ORIGIN_Y, LW_W } from '../art/lightwright';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { pal } from './ultimate/ink';
import { FocusRay, Prism, traceRay, type LightStyle } from './LightwrightFx';
import { turnMidMove } from './anims';
import { heroTimers } from './timers';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Lightwright (the Inventor's optician): a brass lens cannon that
// gathers sunlight.
//  - Attack (held): Focus beam. A short, bright ray from the lens sears the
//    first foe in its way, there and gone in a blink.
//  - Ability: Prism. A crystal tossed at a spot hangs there and splits the
//    light into spectrum beams that sweep round it for a few seconds,
//    burning each foe they cross, then it shatters.
//  - Special: Burning Mirror (see ultimate/lightwright.ts). A great concave
//    mirror unfolds behind him and focuses the sun into a heat ray he
//    steers for a few seconds, braced, scorching the ground.
// The Stargazer plays the same in starlight: pale blue-white rays, a
// violet-blue spectrum, a moon-silver mirror.

const STATS = HERO_STATS['lightwright.lightwright'];

/** One ray every this long, held down. */
const FOCUS_EVERY = 480;
const FOCUS_FPS = 14;
const FOCUS_LAND = (LIGHTWRIGHT_RELEASE.focus / FOCUS_FPS) * 1000;
const FOCUS_POSE = (4 / FOCUS_FPS) * 1000;
const FOCUS_DAMAGE = 11;
const FOCUS_RANGE = 135;
const FOCUS_KNOCK = 25;

const TOSS_FPS = 13;
const TOSS_LAND = (LIGHTWRIGHT_RELEASE.toss / TOSS_FPS) * 1000;
const TOSS_POSE = (5 / TOSS_FPS) * 1000;
const PRISM_COOLDOWN = 8000;
const PRISM_MIN = 30;
const PRISM_MAX = 100;
/** Where the prism lands on touch with nothing aimed: ahead the way he last walked. */
const PRISM_TOUCH = 64;

/** Busy with the cannon or a toss, he walks at this share of his pace. */
const BUSY_PACE = 0.55;

const FOOTFALLS = new Set([1, 4]);

export interface LightwrightKit {
  key: string;
  maxHp: number;
  speed: number;
  light: LightStyle;
}

export const LIGHTWRIGHT_KIT: LightwrightKit = {
  key: 'lightwright',
  maxHp: STATS.hp,
  speed: STATS.speed,
  light: {
    key: 'lightwright',
    pal: pal(0xfffdf0, 0xfff0b0, 0xffc85a, 0xc07a20, 0xffd88a),
    spectrum: [0xff4a4a, 0xff9a3a, 0xffe85a, 0x5ae86a, 0x4aa8ff, 0x9a6aff],
  },
};

/** The Stargazer: starlight in silver optics. */
export const STARGAZER_KIT: LightwrightKit = {
  ...LIGHTWRIGHT_KIT,
  key: 'lightwright_star',
  light: {
    key: 'lightwright_star',
    pal: pal(0xf4fbff, 0xc8e4ff, 0x8ab8ff, 0x4a5ad0, 0xa8ccff),
    spectrum: [0x5ae0ff, 0x4aa0ff, 0x5a6aff, 0x8a5aff, 0xc45aff, 0xff6ad8],
  },
};

type Move = 'focus' | 'toss';

export class Lightwright implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  readonly kit: LightwrightKit;
  private dir: Dir = 'down';
  private world: WorldScene;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private lens: Phaser.GameObjects.Light;
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private focusT = 0;
  private move: Move | null = null;
  private moveT = 0;
  private landed = false;
  private prismCd = 0;
  private prevSpecial = false;
  /** 0..1 the lens flaring after a shot. */
  private flash = 0;
  /** Time left braced behind the Burning Mirror, ms (0: free). */
  private mirrorT = 0;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: LightwrightKit = LIGHTWRIGHT_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = LW_ORIGIN_X / LW_W;
    const oy = LW_ORIGIN_Y / LW_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.lens = world.lights.addLight(x, y, 46, kit.light.pal.light, 0);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.focusT = Math.max(0, this.focusT - dt);
    this.prismCd = Math.max(0, this.prismCd - dt);
    this.flash = Math.max(0, this.flash - dt / 260);
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;

    // Braced behind the mirror: planted, turning only to follow the beam.
    if (this.mirrorT > 0) {
      this.mirrorT -= dt;
      if (this.world.heroDown) this.mirrorT = 0;
      const u = this.aimVec();
      const want = `${this.kit.key}_brace_${dirOf(u.x, u.y)}`;
      this.dir = dirOf(u.x, u.y);
      if (this.body.anims.currentAnim?.key !== want) turnMidMove(this.body, want);
      this.flash = Math.max(this.flash, 0.8);
      this.sync();
      this.updateHud();
      return;
    }

    if (this.move) {
      this.moveT += dt;
      if (!this.landed && this.moveT >= (this.move === 'focus' ? FOCUS_LAND : TOSS_LAND)) {
        this.landed = true;
        if (this.move === 'focus') this.fire();
        else this.throwPrism();
      }
      if (this.moveT >= (this.move === 'focus' ? FOCUS_POSE : TOSS_POSE)) this.move = null;
    }
    if (this.move !== 'toss') {
      if (pressed && this.prismCd === 0) this.start('toss');
      else if (attack && this.focusT === 0) this.start('focus');
    }

    const pace = this.kit.speed * (this.move ? BUSY_PACE : 1);
    if (moving) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * pace * Math.min(1, len) * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * pace * Math.min(1, len) * (dt / 1000), bounds.top, bounds.bottom);
    }
    if (!this.move) {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_walk_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      // Mid-shot, the cannon follows the aim round.
      const u = this.aimVec();
      const d = dirOf(u.x, u.y);
      if (d !== this.dir) {
        this.dir = d;
        turnMidMove(this.body, `${this.kit.key}_${this.move}_${d}`);
      }
    }
    this.sync();
    this.updateHud();
  }

  private start(move: Move): void {
    this.move = move;
    this.moveT = 0;
    this.landed = false;
    if (move === 'focus') this.focusT = FOCUS_EVERY;
    else this.prismCd = PRISM_COOLDOWN;
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_${move}_${this.dir}`);
  }

  // -------------------------------------------------------------------------
  // The Special's part (see ultimate/lightwright.ts)

  /** The Burning Mirror is up: he braces behind it for `ms`, steering it with his aim. */
  braceMirror(ms: number): void {
    this.mirrorT = ms;
    this.move = null;
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_brace_${this.dir}`);
  }

  /** The mirror's beam is spent (or he fell): free again. */
  releaseMirror(): void {
    if (this.mirrorT <= 0) return;
    this.mirrorT = 0;
    this.body.play(`${this.kit.key}_idle_${this.dir}`);
  }

  /** Still braced behind the mirror. */
  get bracing(): boolean {
    return this.mirrorT > 0;
  }

  /** Which way he aims now, and how far off the mouse is (undefined on touch with nothing aimed). */
  steer(): { x: number; y: number; dist?: number } {
    const u = this.aimVec();
    return { x: u.x, y: u.y, dist: this.aim?.dist };
  }

  // -------------------------------------------------------------------------
  // The focus beam

  /** The lens: at the mouth of the cannon, the way it aims, chest high. */
  muzzle(): { x: number; y: number; ground: number } {
    const u = this.aimVec();
    return { x: this.x + u.x * 9, y: this.y - LW_HAND_Y + u.y * 5, ground: this.y + u.y * 5 };
  }

  /** The ray: instant, to the first body in its way. */
  private fire(): void {
    const w = this.world;
    const u = this.aimVec();
    const m = this.muzzle();
    const { hit, dist } = traceRay(w, this.x + u.x * 9, m.ground, u.x, u.y, LW_HAND_Y, FOCUS_RANGE);
    const ex = m.x + u.x * dist;
    const ey = m.y + u.y * dist;
    let tx = ex;
    let ty = ey;
    if (hit) {
      // The ray ends in the body it sears, at its chest.
      tx = hit.x;
      ty = hit.y - hit.bodyY;
      hit.hurt({ damage: FOCUS_DAMAGE, heavy: false, knock: FOCUS_KNOCK, fromX: this.x, fromY: this.y });
      w.debris(this.kit.light.pal.tints, tx, ty, 4, hit.y + 10, 'burst');
    }
    w.addEffect(new FocusRay(w, m.x, m.y, tx, ty, this.kit.light.pal, Math.max(this.y, hit ? hit.y : this.y + u.y * dist) + 12, !!hit));
    this.flash = 1;
    sound.focusRay(w.pan(this.x), !!hit);
  }

  // -------------------------------------------------------------------------
  // The prism

  private throwPrism(): void {
    const u = this.aimVec();
    const want = this.aim?.dist === undefined ? PRISM_TOUCH : Phaser.Math.Clamp(this.aim.dist, PRISM_MIN, PRISM_MAX);
    let tx = this.x;
    let ty = this.y;
    for (let r = want; r >= 0; r -= 4) {
      tx = this.x + u.x * r;
      // A mouse is measured from the chest; its spot on the ground is lower.
      ty = this.y + u.y * r - (this.aim?.dist === undefined ? 0 : LW_HAND_Y * 0.5);
      if (this.world.walkable(tx, ty)) break;
    }
    const prism = new Prism(this.world, this.x - u.x * 3, this.y - LW_HAND_Y - 2, tx, ty, this.kit.light);
    this.world.addEffect(prism);
    heroTimers.follow(prism, 'ability', '', this.kit.light.pal.hot, () => prism.timeLeft());
    sound.toss();
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.prismCd / PRISM_COOLDOWN;
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
    const m = this.muzzle();
    this.lens.setPosition(m.x, m.y);
    // The lens holds a little light at night, and flares as it fires.
    this.lens.intensity = 0.35 * (1 - this.daylight) + 1.5 * this.flash;
  }
}
