import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { AQUA_FPS, AQUA_FRAMES, AQUA_H, AQUA_ORIGIN_X, AQUA_ORIGIN_Y, AQUA_RELEASE, AQUA_W } from '../art/aquanaut';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { Harpoon, ReelHook, type AquaStyle } from './AquaFx';
import { pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { turnMidMove } from './anims';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Aquanaut (the Inventor's deep-sea diver), heavy and slow in his lead
// boots and brass helmet.
//  - Attack (held): Harpoon. He levels the pneumatic gun and fires a heavy
//    barbed harpoon that goes through the first two foes in its path and
//    drives into the ground at the end of its run; then he slides the next
//    one into the muzzle. Slow, and it hits hard.
//  - Ability: Reel in. A harpoon on a chain: it hooks the first foe it
//    reaches and he cranks it home, dragging the foe right up to him, where
//    it lands dazed. A boss won't be dragged: it is yanked off balance and
//    slowed instead.
//  - Special: Torpedo (see ultimate/aquanaut.ts). A steam torpedo runs
//    along the ground the way he aims, a frothing wake behind it, and bursts
//    on the first foe (or at the end of its run) in a great burst of sea
//    water that throws everything back and leaves it soaked and slow.

const STATS = HERO_STATS['aquanaut.aquanaut'];

const FIRE_MS = (AQUA_FRAMES.fire / AQUA_FPS.fire) * 1000;
const FIRE_AT = (AQUA_RELEASE.fire / AQUA_FPS.fire) * 1000;
/** A breath between harpoons, once the next is in the muzzle. */
const SHOT_REST = 280;
const HARPOON_RANGE = 175;
const HARPOON_DAMAGE = 20;
const HARPOON_KNOCK = 120;

const HOOK_MS = (AQUA_FRAMES.hook / AQUA_FPS.hook) * 1000;
const HOOK_AT = (AQUA_RELEASE.hook / AQUA_FPS.hook) * 1000;
const REEL_RANGE = 150;
const REEL_COOLDOWN = 7000;

/** Moving while busy: firing slows him to a shuffle, the chain roots him, cranking lets him back off a step at a time. */
const PACE = { fire: 0.35, hook: 0, crank: 0.2 };

// Walk frames where a lead boot lands.
const FOOTFALLS = new Set([1, 4]);
/** How often a stray bubble rattles up out of the valve while he walks (ms). */
const BUBBLE_EVERY = 1600;

type State = 'free' | 'fire' | 'hook' | 'crank';

export interface AquaKit {
  key: string;
  maxHp: number;
  speed: number;
  style: AquaStyle;
  /** The helmet lamp's light. */
  lamp: number;
}

export const AQUANAUT_KIT: AquaKit = {
  key: 'aquanaut',
  maxHp: STATS.hp,
  speed: STATS.speed,
  style: { key: 'aquanaut', pal: pal(0xf4ffff, 0xa8f0ff, 0x3cc0e8, 0x1a5aa8, 0x7ae0ff), spray: [0xffffff, 0xc8f6ff, 0x7ad8f4, 0x3ca8d8] },
  lamp: 0xffe6a0,
};

/** Barnacle: the wreck diver, his sea sea-green and foam-white. */
export const BARNACLE_KIT: AquaKit = {
  ...AQUANAUT_KIT,
  key: 'aquanaut_barnacle',
  style: { key: 'aquanaut_barnacle', pal: pal(0xf4fff8, 0xb8f4dc, 0x4ad0a0, 0x1a6a5a, 0x8af0c8), spray: [0xffffff, 0xd8fff0, 0x8ae8c4, 0x3cae88] },
  lamp: 0xb8f8dc,
};

export class Aquanaut implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: AquaKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private lamp: Phaser.GameObjects.Light;
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  /** Where the shot in hand is going. */
  private line = { x: 0, y: 1 };
  private state: State = 'free';
  private stateT = 0;
  private fired = false;
  private rest = 0;
  private reelCd = 0;
  private reel: ReelHook | null = null;
  private bubbleT = BUBBLE_EVERY;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: AquaKit = AQUANAUT_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = AQUA_ORIGIN_X / AQUA_W;
    const oy = AQUA_ORIGIN_Y / AQUA_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(1.15, 1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    // The helmet lamp lights the way at night.
    this.lamp = world.lights.addLight(x, y, 70, kit.lamp, 0);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.reel?.destroy();
      beamHud.firing = false;
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.reelCd = Math.max(0, this.reelCd - dt);
    this.rest = Math.max(0, this.rest - dt);

    if (this.state !== 'free') this.advance(dt);
    if (this.state === 'free' && this.rest === 0) {
      if (special && this.reelCd === 0) this.start('hook');
      else if (attack) this.start('fire');
    }

    const pace = this.kit.speed * (this.state === 'free' ? Math.min(1, len) : PACE[this.state]);
    if (moving && pace > 0) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * pace * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * pace * (dt / 1000), bounds.top, bounds.bottom);
    }
    if (this.state === 'free') {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_walk_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
      // Walking, now and then a bubble wobbles up out of the valve.
      this.bubbleT -= dt;
      if (moving && this.bubbleT <= 0) {
        this.bubbleT = BUBBLE_EVERY * (0.7 + Math.random() * 0.6);
        this.world.debris(this.kit.style.spray.slice(0, 2), this.x - 5, this.y - 27, 1, this.y + 1, 'spores');
      }
    }
    this.sync();
    this.updateHud();
  }

  /** The move under way runs on: the shot leaves the muzzle on its frame, then the gun is reloaded or the chain cranked home. */
  private advance(dt: number): void {
    this.stateT += dt;
    if (this.state === 'fire') {
      // Until the harpoon is away, the aim follows the mouse.
      if (!this.fired) this.takeAim();
      if (!this.fired && this.stateT >= FIRE_AT) {
        this.fired = true;
        this.shoot();
      }
      if (this.stateT >= FIRE_MS) this.free(SHOT_REST);
    } else if (this.state === 'hook') {
      if (!this.fired) this.takeAim();
      if (!this.fired && this.stateT >= HOOK_AT) {
        this.fired = true;
        this.castReel();
      }
      if (this.stateT >= HOOK_MS) {
        this.state = 'crank';
        this.body.play(`${this.kit.key}_crank_${this.dir}`);
      }
    } else if (this.state === 'crank') {
      if (!this.reel?.busy) {
        this.reel = null;
        this.free(120);
      }
    }
  }

  private start(kind: 'fire' | 'hook'): void {
    this.state = kind;
    this.stateT = 0;
    this.fired = false;
    this.takeAim();
    this.body.play(`${this.kit.key}_${kind}_${this.dir}`);
    if (kind === 'hook') this.reelCd = REEL_COOLDOWN;
  }

  private free(rest: number): void {
    this.state = 'free';
    this.rest = rest;
    this.body.play(`${this.kit.key}_idle_${this.dir}`);
  }

  /** Which way: at the mouse on a computer (or the dragged button), else the way he last walked. */
  private takeAim(): void {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    this.line = { x: a.x / l, y: a.y / l };
    const dir = dirOf(this.line.x, this.line.y);
    if (dir !== this.dir) {
      this.dir = dir;
      turnMidMove(this.body, `${this.kit.key}_${this.state}_${dir}`);
    }
  }

  /** The harpoon leaves the muzzle with a hiss of air and a kick. */
  private shoot(): void {
    const u = this.line;
    const w = this.world;
    sound.harpoon(w.pan(this.x));
    w.cameras.main.shake(60, 0.0004);
    w.debris(this.kit.style.spray, this.x + u.x * 12, this.y - 12 + u.y * 8, 4, this.y + 4, 'spores');
    w.addEffect(
      new Harpoon(w, this.x + u.x * 9, this.y + u.y * 4, u.x, u.y, HARPOON_RANGE, this.kit.style, (h, x, y) => {
        h.hurt({ damage: HARPOON_DAMAGE, heavy: true, knock: HARPOON_KNOCK, fromX: x - u.x * 8, fromY: y - u.y * 8 });
      }),
    );
  }

  /** The chained harpoon goes. */
  private castReel(): void {
    const u = this.line;
    sound.harpoon(this.world.pan(this.x));
    this.reel = new ReelHook(this.world, () => ({ x: this.x, y: this.y }), u.x, u.y, REEL_RANGE, this.kit.style);
    this.world.addEffect(this.reel);
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.reelCd / REEL_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'hook' || this.state === 'crank';
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
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    this.lamp.setPosition(rx + (a.x / l) * 18, ry - 10 + (a.y / l) * 12);
    this.lamp.intensity = 0.9 * (1 - this.daylight);
  }
}
