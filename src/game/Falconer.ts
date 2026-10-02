import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { FALC_H, FALC_LOOSE, FALC_ORIGIN_X, FALC_ORIGIN_Y, FALC_W } from '../art/falconer';
import { ARROW_H } from '../art/archer';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { Arrow, type ArrowStyle } from './Arrows';
import { FalconStrike, Feathers, HuntMarks, MARK_BONUS, type FalconStyle } from './Falcon';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { turnMidMove } from './anims';
import { HERO_STATS } from './stats';
import { stand } from './rest';

const STATS = HERO_STATS['archer.falconer'];
export const MAX_HP = STATS.hp;
const SPEED = STATS.speed; // world px / second
/** A breath between shots once the string hand is back. */
const SHOT_REST = 60;
/** Quick shots: short, light and fast off the string. */
const SHOT_RANGE = 115;
const SHOT_SPEED = 400;
const SHOT_DAMAGE = 5;
/** She keeps more of her pace shooting than the ranger does. */
const SHOT_PACE = 0.65;
/** Falcon strike: how far the falcon will go for its quarry, and how long till she can cast it again. */
const STRIKE_REACH = 150;
/** Near the mouse a foe is taken over a nearer one, within this of the aimed spot. */
const AIM_PICK = 60;
const STRIKE_COOLDOWN = 6500;
/** With no quarry in reach it flies this far out along the aim. */
const EMPTY_FLIGHT = 70;

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'shot' | 'send';

/** How a falconer look plays: its sheet, its arrows, its bird. */
export interface FalconerKit {
  key: string;
  arrow: ArrowStyle;
  falcon: FalconStyle;
}

/** Amber shots, a peregrine. */
export const FALCONER_KIT: FalconerKit = {
  key: 'archer_falconer',
  arrow: { core: 0xffffff, hot: 0xfff0c8, mid: 0xf0b050, deep: 0x9a5a22, light: 0xffc880, suffix: '_falconer', storm: false },
  falcon: { bird: 'bird_falcon', eagle: false, feathers: [0xefe6cc, 0x7a86a0, 0xd6c8a6, 0x3a4254], claw: [0xffffff, 0xffd890, 0xd88a30], light: 0xffc880 },
};

/** Berkut: gold-and-crimson shots, a golden eagle. */
export const BERKUT_KIT: FalconerKit = {
  key: 'archer_falconer_berkut',
  arrow: { core: 0xffffff, hot: 0xffe8a8, mid: 0xe8a030, deep: 0xa8281e, light: 0xffc060, suffix: '_falconer_berkut', storm: false },
  falcon: { bird: 'bird_eagle', eagle: true, feathers: [0xf0c058, 0x6a4428, 0xa0743e, 0x2a1a10], claw: [0xffffff, 0xffd060, 0xc8301e], light: 0xffc060 },
};

/**
 * The falconer: quick, light shots from a short recurve bow (at the mouse on
 * a computer), short-ranged. On the special she casts her falcon off her
 * fist at a foe (the one aimed at, else the nearest): it stoops onto it,
 * rakes it three times and marks it, and her arrows strike marked foes
 * harder. Then it flies back to her shoulder; until it does she has no bird
 * to send.
 */
export class Falconer implements Hero {
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
  private aim: Aim | null = null;
  private line: Aim = { x: 0, y: 1 };
  private loosed = false;
  private cooldown = 0;
  private strikeCd = 0;
  /** The falcon on her shoulder, or out hunting. */
  private falcon: FalconStrike | null = null;
  private readonly marks: HuntMarks;
  private kit: FalconerKit;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: FalconerKit = FALCONER_KIT) {
    this.world = world;
    this.kit = kit;
    const k = kit.key;
    this.x = x;
    this.y = y;
    const ox = FALC_ORIGIN_X / FALC_W;
    const oy = FALC_ORIGIN_Y / FALC_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${k}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, k, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${k}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.body.play(`${k}_idle_down`);
    this.marks = new HuntMarks(world, kit.falcon.claw);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      // (A shot begun without the bird ends as `bare_shot` even if it landed meanwhile.)
      if (this.state === 'free' || !anim.key.includes(`_${this.state}_`)) return;
      this.state = 'free';
      this.cooldown = SHOT_REST;
      this.body.play(`${k}_${this.prefix('idle')}_${this.dir}`);
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.includes('walk') && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
      this.falcon?.destroy();
    });
  }

  /** A move's name as played now: with the bird away she stands, walks and shoots without it. */
  private prefix(move: string): string {
    return this.falcon && move !== 'send' ? `bare_${move}` : move;
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.falcon) this.strikeCd = Math.max(0, this.strikeCd - dt);
    this.marks.update(dt);
    if (this.falcon?.dead) this.falcon = null;

    // Her whistle (the Special's pose) calls the falcon straight back to her shoulder.
    if (this.falcon && this.body.frame.name.startsWith('whistle')) this.falcon.recall();

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && !this.falcon && this.strikeCd === 0) this.startSend();
      else if (attack) this.startShot();
    }

    const pace = this.state === 'free' ? Math.min(1, len) : this.state === 'shot' ? SHOT_PACE : 0.3;
    const vx = moving ? (mx / len) * SPEED * pace : 0;
    const vy = moving ? (my / len) * SPEED * pace : 0;
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    const k = this.kit.key;
    if (this.state === 'free') {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const idle = `${k}_${this.prefix('idle')}_${this.dir}`;
      // The idle moment (feeding the falcon) only with the falcon on her shoulder.
      const key = moving ? `${k}_${this.prefix('walk')}_${this.dir}` : this.falcon ? idle : stand(this.body, idle);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      if (!this.loosed) this.takeAim();
      const f = this.body.anims.currentFrame;
      const at = this.state === 'send' ? FALC_LOOSE.send : FALC_LOOSE.shot;
      if (!this.loosed && f && f.index - 1 >= at) {
        this.loosed = true;
        if (this.state === 'send') this.castOff();
        else this.loose();
      }
    }

    this.sync();
    this.updateHud();
  }

  private startShot(): void {
    this.state = 'shot';
    this.loosed = false;
    this.takeAim();
    this.body.play(`${this.kit.key}_${this.prefix('shot')}_${this.dir}`);
  }

  private startSend(): void {
    this.state = 'send';
    this.loosed = false;
    this.takeAim();
    this.body.play(`${this.kit.key}_send_${this.dir}`);
  }

  private takeAim(): void {
    const a = this.aim ?? this.lastMove;
    this.line = { x: a.x, y: a.y };
    const dir = dirOf(a.x, a.y);
    if (dir !== this.dir) {
      this.dir = dir;
      if (this.state !== 'free') turnMidMove(this.body, `${this.kit.key}_${this.prefix(this.state)}_${dir}`);
    }
  }

  /** A quick arrow off the string; a marked foe takes it harder, with a burst of feathers. */
  private loose(): void {
    const u = this.line;
    const w = this.world;
    sound.bowShot(w.pan(this.x), false);
    w.addEffect(
      new Arrow(
        w,
        this.x + u.x * 6,
        this.y + u.y * 3,
        u.x,
        u.y,
        SHOT_RANGE,
        w.area,
        (h, x, y) => {
          const marked = this.marks.marked(h);
          h.hurt({ damage: marked ? SHOT_DAMAGE * MARK_BONUS : SHOT_DAMAGE, heavy: false, knock: marked ? 80 : 50, fromX: x - u.x * 8, fromY: y - u.y * 8 });
          if (marked) {
            const c = this.kit.falcon.claw;
            w.debris([0xffffff, c[0], c[1], c[2]], snap(h.x), snap(h.y - h.bodyY), 8, h.y + 20, 'burst');
          }
        },
        this.kit.arrow,
        { speed: SHOT_SPEED },
      ),
    );
  }

  /**
   * The falcon leaves her fist: at the foe nearest the mouse (within
   * AIM_PICK of where it points), else the nearest ahead of her, else the
   * nearest at all, within STRIKE_REACH; with none it flies out along the aim.
   */
  private castOff(): void {
    const w = this.world;
    const u = this.line;
    const reach = (h: Hurtbox) => h.alive && Math.hypot(h.x - this.x, h.y - this.y) <= STRIKE_REACH;
    const near = w.hurtboxesWhere(reach);
    const dist = (h: Hurtbox, x: number, y: number) => Math.hypot(h.x - x, h.y - y);
    let prey: Hurtbox | null = null;
    if (this.aim?.dist !== undefined) {
      const d = Math.min(this.aim.dist, STRIKE_REACH);
      const px = this.x + u.x * d;
      const py = this.y - ARROW_H + u.y * d;
      prey = near.filter((h) => dist(h, px, py) < AIM_PICK).sort((a, b) => dist(a, px, py) - dist(b, px, py))[0] ?? null;
    }
    if (!prey) {
      const ahead = near.filter((h) => (h.x - this.x) * u.x + (h.y - this.y) * u.y > 0);
      prey = (ahead.length ? ahead : near).sort((a, b) => dist(a, this.x, this.y) - dist(b, this.x, this.y))[0] ?? null;
    }
    const spot = { x: this.x + u.x * EMPTY_FLIGHT, y: this.y + u.y * EMPTY_FLIGHT };
    this.strikeCd = STRIKE_COOLDOWN;
    const hand = { x: this.x + u.x * 4 + (this.dir === 'left' ? -3 : 3), y: this.y + u.y * 2 };
    this.falcon = new FalconStrike(w, hand.x, hand.y, prey, spot, this.kit.falcon, this.marks, () => ({ x: this.x, y: this.y }), () => {
      this.falcon = null;
      // Back on her shoulder: a feather or two shaken loose as it settles.
      w.addEffect(new Feathers(w, this.x + 4, this.y, 20, 2, this.kit.falcon.feathers));
    });
    w.addEffect(this.falcon);
    w.debris(this.kit.falcon.feathers, hand.x, hand.y - 20, 4, this.y + 4, 'spores');
  }

  private updateHud(): void {
    // The special button: refilling once the falcon is back, held short of full while it's out.
    beamHud.charge = this.falcon ? 0 : 1 - this.strikeCd / STRIKE_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'send' || !!this.falcon;
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
