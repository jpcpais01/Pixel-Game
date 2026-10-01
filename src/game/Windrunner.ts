import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { ARCHER_H, ARCHER_ORIGIN_X, ARCHER_ORIGIN_Y, ARCHER_W, LOOSE_FRAME } from '../art/archer';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { Arrow, WIND_ARROW } from './Arrows';
import { GaleShot } from './Bolts';
import type { ArcherStyle } from './Archer';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { turnMidMove } from './anims';
import { HERO_STATS } from './stats';
import { stand } from './rest';
import { pal } from './ultimate/ink';

const STATS = HERO_STATS['archer.wind'];
export const MAX_HP = STATS.hp;
const SPEED = STATS.speed; // world px / second
/** A breath between fans once the string hand is back. */
const SHOT_REST = 50;
/** Three arrows a fan: the middle one straight down the aim and harder, one either side. */
const FAN_SPREAD = 0.2;
const FAN_RANGE = 125;
const FAN_SPEED = 380;
const MID_DAMAGE = 4;
const SIDE_DAMAGE = 2.5;
/** She keeps most of her pace loosing a fan: she fights on the move. */
const FAN_PACE = 0.8;
/** The vault: how far back she springs, over how long, and how long nothing can touch her. */
const VAULT_DIST = 58;
const VAULT_TIME = 250;
const VAULT_EVADE = 300;
const SPECIAL_COOLDOWN = 5500;

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'fan' | 'vault';

export const WIND_STYLE: ArcherStyle = { key: 'archer_wind', arrow: WIND_ARROW };

/**
 * The windrunner: a light elven skirmisher who never stands still. The attack
 * looses three arrows at once in a narrow fan, short-ranged, while she keeps
 * walking. The special springs her backwards out of reach in a flip, and at
 * the top of it she looses a gale shot that goes through everything in its
 * path and blows it all back.
 */
export class Windrunner implements Hero {
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
  /** Where the arrows on the string are going. */
  private line: Aim = { x: 0, y: 1 };
  /** The way the vault carries her (away from the aim), and how far into it she is. */
  private leap = { x: 0, y: -1 };
  private leapT = 0;
  private loosed = false;
  private cooldown = 0;
  private specialCd = 0;
  private style: ArcherStyle;

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, style: ArcherStyle = WIND_STYLE) {
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
      this.state = 'free';
      this.cooldown = SHOT_REST;
      this.body.play(`${k}_idle_${this.dir}`);
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

    // The vault may cut a fan short: dodging comes first.
    if ((this.state === 'free' || (this.state === 'fan' && this.loosed)) && special && this.specialCd === 0) this.startVault();
    else if (this.state === 'free' && this.cooldown === 0 && attack) this.startFan();

    let vx = 0;
    let vy = 0;
    if (this.state === 'vault') {
      // Springing back: fast off the ground, slowing as she comes down.
      if (this.leapT < VAULT_TIME) {
        const k0 = this.leapT / VAULT_TIME;
        this.leapT = Math.min(VAULT_TIME, this.leapT + dt);
        const k1 = this.leapT / VAULT_TIME;
        const d = VAULT_DIST * ((1 - (1 - k1) ** 2) - (1 - (1 - k0) ** 2));
        vx = (this.leap.x * d * 1000) / Math.max(1, dt);
        vy = (this.leap.y * d * 1000) / Math.max(1, dt);
      }
    } else if (moving) {
      const speed = SPEED * (this.state === 'fan' ? FAN_PACE : Math.min(1, len));
      vx = (mx / len) * speed;
      vy = (my / len) * speed;
    }
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      // Fighting faces the aim, even walking backwards; otherwise the way of the walk.
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.style.key}_walk_${this.dir}` : stand(this.body, `${this.style.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      // Until the arrow leaves the string, the aim follows the mouse.
      if (!this.loosed) this.takeAim();
      const f = this.body.anims.currentFrame;
      if (!this.loosed && f && f.index - 1 >= LOOSE_FRAME[this.state]) {
        this.loosed = true;
        if (this.state === 'vault') this.looseGale();
        else this.looseFan();
      }
    }

    this.sync();
    this.updateHud();
  }

  private startFan(): void {
    this.state = 'fan';
    this.loosed = false;
    this.takeAim();
    this.body.play(`${this.style.key}_fan_${this.dir}`);
  }

  /** She springs back, away from where she aims, and nothing can touch her while she's off the ground. */
  private startVault(): void {
    this.state = 'vault';
    this.loosed = false;
    this.takeAim();
    this.leap = { x: -this.line.x, y: -this.line.y };
    this.leapT = 0;
    this.specialCd = SPECIAL_COOLDOWN;
    this.world.evade(VAULT_EVADE);
    this.body.play(`${this.style.key}_vault_${this.dir}`);
    sound.windDash(this.world.pan(this.x));
    this.world.debris([0xffffff, 0xd8fff6, 0x6ef0dc], this.x, this.y - 2, 6, this.y + 1, 'trail');
  }

  /** Which way: at the mouse on a computer, else ahead the way she last walked. */
  private takeAim(): void {
    const a = this.aim ?? this.lastMove;
    this.line = { x: a.x, y: a.y };
    const dir = dirOf(a.x, a.y);
    if (dir !== this.dir) {
      this.dir = dir;
      // Turn mid-draw without starting over.
      if (this.state !== 'free') turnMidMove(this.body, `${this.style.key}_${this.state}_${dir}`);
    }
  }

  /** Three arrows leave the string at once, fanned a little either side of the aim. */
  private looseFan(): void {
    const u = this.line;
    sound.bowShot(this.world.pan(this.x), false);
    for (const a of [-FAN_SPREAD, 0, FAN_SPREAD]) {
      const ux = u.x * Math.cos(a) - u.y * Math.sin(a);
      const uy = u.x * Math.sin(a) + u.y * Math.cos(a);
      const damage = a === 0 ? MID_DAMAGE : SIDE_DAMAGE;
      this.world.addEffect(
        new Arrow(
          this.world,
          this.x + ux * 6,
          this.y + uy * 3,
          ux,
          uy,
          FAN_RANGE,
          this.world.area,
          (h, x, y) => {
            h.hurt({ damage, heavy: false, knock: 50, fromX: x - ux * 8, fromY: y - uy * 8 });
          },
          this.style.arrow,
          { speed: FAN_SPEED },
        ),
      );
    }
  }

  /** At the top of the vault: the gale shot, along the aim. */
  private looseGale(): void {
    const u = this.line;
    const s = this.style.arrow;
    sound.bowShot(this.world.pan(this.x), false);
    sound.gust(this.world.pan(this.x));
    this.world.addEffect(new GaleShot(this.world, this.x + u.x * 6, this.y + u.y * 3, u.x, u.y, pal(s.core, s.hot, s.mid, s.deep, s.light)));
  }

  private updateHud(): void {
    // The special button: a ring refilling over the cooldown.
    beamHud.charge = 1 - this.specialCd / SPECIAL_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'vault';
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
