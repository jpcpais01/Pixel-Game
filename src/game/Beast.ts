import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { BEAST_H, BEAST_ORIGIN_X, BEAST_ORIGIN_Y, BEAST_W, type BeastKind } from '../art/beast';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import type { Effect, Scheme } from './Slash';
import { clamp01, Fx, type Ink, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

// The Beastkin: beastfolk who fight with the gifts of their animal (see
// art/beast.ts). What the three share lives here: the body and its layers,
// walking, facing, one move at a time with a moment it lands, and the HUD.
// Each type (Eagle.ts, Lion.ts, Dragon.ts) says what its moves do.

const FOOTFALLS = new Set([1, 4]);

export interface BeastKit {
  /** The look's texture. */
  key: string;
  kind: BeastKind;
  maxHp: number;
  speed: number;
  /** The Special's colours and the abilities' light. */
  pal: Pal;
  /** Sparks and slashes. */
  fx: Scheme;
  /** A club skin (its feathers, fire and roars in the club's colours). */
  club: boolean;
}

export abstract class Beast implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  protected dir: Dir = 'down';
  protected world: WorldScene;
  protected kit: BeastKit;
  protected body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  /** The beast's own light: its eyes, its fire. */
  protected lamp: Phaser.GameObjects.Light;
  protected lastMove = new Phaser.Math.Vector2(0, 1);
  protected aim: Aim | null = null;
  protected clock = 0;
  /** The move under way (an anim name), when it lands, and how long it lasts. */
  protected move: string | null = null;
  protected moveT = 0;
  private landAt = 0;
  private moveMs = 0;
  private landed = false;
  protected fx: Effect[] = [];
  private prevSpecial = false;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: BeastKit) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = BEAST_ORIGIN_X / BEAST_W;
    const oy = BEAST_ORIGIN_Y / BEAST_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.lamp = world.lights.addLight(x, y, 60, kit.pal.light, 0);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const e of this.fx) e.destroy();
    });
  }

  /** Cooldowns and the like, every frame. */
  protected abstract tick(dt: number): void;
  /** The attack button is held and nothing is under way. */
  protected abstract attack(): void;
  /** The ability button was pressed and nothing is under way: starts it if it's ready. */
  protected abstract ability(): void;
  /** The move reaches its landing frame. */
  protected abstract land(move: string): void;
  /** Every frame of a move, after it has landed or not. */
  protected during(_move: string, _dt: number): void {}
  /** How fast the beast walks during a move, as a share of its pace. */
  protected paceIn(_move: string): number {
    return 0.45;
  }
  /** The ability's cooldown shown on its button, 0..1 ready. */
  protected abstract readiness(): number;
  /** The attack chain for the combo pips: hits so far, of how many, and the window left. */
  protected combo(): { hits: number; max: number; window: number } {
    return { hits: 0, max: 0, window: 0 };
  }
  /** How bright the beast's own light burns now, 0..1 (at night its glow lights the ground). */
  protected lampLevel(): number {
    return 0;
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;
    this.tick(dt);

    if (this.move) {
      this.moveT += dt;
      const m = this.move;
      if (!this.landed && this.moveT >= this.landAt) {
        this.landed = true;
        this.land(m);
      }
      if (this.move === m) this.during(m, dt);
      if (this.move === m && this.moveT >= this.moveMs) this.move = null;
    }
    if (!this.move) {
      if (pressed) this.ability();
      if (!this.move && attack) this.attack();
    }

    const pace = this.kit.speed * (this.move ? this.paceIn(this.move) : 1);
    if (moving && pace > 0) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * pace * Math.min(1, len) * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * pace * Math.min(1, len) * (dt / 1000), bounds.top, bounds.bottom);
    }
    if (!this.move) {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = `${this.kit.key}_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    }
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.sync();
    this.updateHud();
  }

  /** Start a move: its animation turned the way it's aimed, landing `land` ms in, over after `ms`. */
  protected begin(move: string, anim: string, ms: number, land: number): void {
    this.move = move;
    this.moveT = 0;
    this.moveMs = ms;
    this.landAt = land;
    this.landed = false;
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_${anim}_${this.dir}`);
  }

  protected aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  /** Step the beast along (dx, dy) by `d` px, if the ground there takes it (the world holds it to walkable ground). */
  protected shove(dx: number, dy: number, d: number): void {
    const nx = this.x + dx * d;
    const ny = this.y + dy * d;
    if (this.world.walkable(nx, ny)) {
      this.x = nx;
      this.y = ny;
    }
  }

  private updateHud(): void {
    beamHud.charge = this.readiness();
    beamHud.over = 0;
    beamHud.firing = false;
    const c = this.combo();
    comboHud.hits = c.hits;
    comboHud.max = c.max;
    comboHud.window = c.window;
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
    this.lamp.setPosition(rx, ry - 18);
    this.lamp.intensity = this.lampLevel() * (1.4 - this.daylight * 0.8);
  }
}

// ---------------------------------------------------------------------------
// Shared effects

/**
 * Three claw marks raked across a spot: bright streaks that open along the
 * swipe and fade, the middle one longest.
 */
export class ClawMarks extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    /** The way the rake runs, screen radians. */
    private ang: number,
    private size: number,
    private p: Pal,
    private depth: number,
  ) {
    super(world, 200);
    this.g = this.ink(Math.ceil(size * 2 + 8), Math.ceil(size * 2 + 8));
  }

  protected step(): void {
    const { x, y, ang, size, p } = this;
    const k = clamp01(this.t / 70);
    const fade = 1 - clamp01((this.t - 90) / 110);
    const g = this.g.begin(x, y, this.depth);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    for (let n = -1; n <= 1; n++) {
      const len = size * (n === 0 ? 1 : 0.8);
      const ox = -uy * n * 3.2;
      const oy = ux * n * 3.2;
      const steps = Math.ceil(len * 2);
      for (let i = 0; i <= steps * k; i++) {
        const f = i / steps;
        const bow = Math.sin(f * Math.PI) * 1.4;
        const px = x + ox + ux * (f - 0.5) * len * 2 - uy * bow;
        const py = y + oy + uy * (f - 0.5) * len * 2 + ux * bow;
        const head = f > k - 0.2;
        g.put(px, py, head ? p.core : f > 0.3 ? p.hot : p.mid, fade * (0.5 + 0.5 * Math.sin(f * Math.PI)));
      }
    }
    g.end();
  }
}
