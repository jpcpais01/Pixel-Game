import Phaser from 'phaser';
import { MONSTER_FRAME } from '../../art/monsters';
import { snap } from '../display';
import { sunShadow, SUN_SHADOW_ALPHA } from '../Wizard';
import { HealthBar } from '../HealthBar';
import { sound } from '../../audio';
import type { Hit, Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';

/** Who a monster hunts: the hero, or later any player. Feet position. */
export interface Target {
  x: number;
  y: number;
}

/** A monster's numbers. Speeds in world px/s, times in ms. */
export interface MonsterStats {
  /** Texture and animation prefix; frames come from art/monsters.ts. */
  key: keyof typeof MONSTER_FRAME;
  hp: number;
  /** Body radius and the body centre's height above the feet. */
  radius: number;
  bodyY: number;
  /** Chase speed; wandering is slower. */
  speed: number;
  /** Notices a target this close. */
  sight: number;
  /** Gives up and walks home when the chase gets this far from home. */
  leash: number;
  /** Divides knockback: heavy monsters barely budge. */
  mass: number;
  /** Health bar height above the feet. */
  barY: number;
  /** Tints of the burst it leaves when it dies. */
  debris: number[];
  /** No bar over its head (a boss shows its health across the top of the screen). */
  noBar?: boolean;
}

export type MonsterState = 'spawn' | 'idle' | 'wander' | 'notice' | 'chase' | 'windup' | 'attack' | 'recover' | 'hurt' | 'return' | 'dying';

const SPAWN_TIME = 700;
const NOTICE_TIME = 380;
const STAGGER_TIME = 260;
const DEATH_TIME = 380;
const FLASH_TIME = 110;

/**
 * A monster's body and its simple mind. The shared states (spawning,
 * wandering near home, noticing the player, being staggered, walking home,
 * dying) live here; each species decides how it closes in and attacks by
 * overriding `chase` and `act`, which run the windup, attack and recover
 * states. `move` walks; the frog overrides it to hop.
 */
export abstract class Monster implements Hurtbox {
  x: number;
  y: number;
  hp: number;
  /** Set once it has died and cleaned up; the spawner then replaces it. */
  dead = false;
  state: MonsterState = 'spawn';
  facing: 'r' | 'l' = 'r';
  readonly homeX: number;
  readonly homeY: number;
  protected world: WorldScene;
  protected body: Phaser.GameObjects.Sprite;
  protected timer = SPAWN_TIME;
  /** Time until the next attack may start. */
  protected cooldown = 0;
  /** Height off the ground, for hops and flight: lifts the sprite, not the shadow. */
  protected hover = 0;
  private glowLayer: Phaser.GameObjects.Sprite;
  private flash: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private bar: HealthBar;
  private flashT = 0;
  private kvx = 0;
  private kvy = 0;
  private goalX = 0;
  private goalY = 0;
  private daylight = 0;

  constructor(
    world: WorldScene,
    x: number,
    y: number,
    readonly stats: MonsterStats,
  ) {
    this.world = world;
    this.x = this.homeX = x;
    this.y = this.homeY = y;
    this.hp = stats.hp;
    this.facing = Math.random() < 0.5 ? 'l' : 'r';
    const f = MONSTER_FRAME[stats.key];
    const ox = f.ox / f.w;
    const oy = f.oy / f.h;
    const k = stats.key;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(stats.radius / 7, 1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${k}_s`).setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, k).setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${k}_e`).setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.flash = world.add.sprite(x, y, `${k}_w`).setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.bar = new HealthBar(world);
    this.play('idle');
    this.sync(0);
  }

  get alive(): boolean {
    return this.state !== 'dying' && this.state !== 'spawn' && !this.dead;
  }

  get bodyY(): number {
    return this.stats.bodyY + this.hover;
  }

  get radius(): number {
    return this.stats.radius;
  }

  /** Is it airborne or charging, so it shouldn't be shoved around by its neighbours? */
  get pinned(): boolean {
    return false;
  }

  /** `target` is the player to hunt, or null when there is none (the hero is down). */
  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    const px = this.x;
    const py = this.y;
    this.daylight = daylight;
    this.timer -= dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flashT = Math.max(0, this.flashT - dt);

    // Knockback slides and dies away quickly.
    if (this.kvx || this.kvy) {
      this.x += (this.kvx * dt) / 1000;
      this.y += (this.kvy * dt) / 1000;
      const k = Math.exp(-dt / 90);
      this.kvx *= k;
      this.kvy *= k;
      if (Math.abs(this.kvx) + Math.abs(this.kvy) < 2) this.kvx = this.kvy = 0;
    }

    const dist = target ? Math.hypot(target.x - this.x, target.y - this.y) : Infinity;
    switch (this.state) {
      case 'spawn':
        if (this.timer <= 0) this.enter('idle', 600 + Math.random() * 1400);
        break;
      case 'idle':
        this.stand(dt);
        if (dist < this.stats.sight) this.notice(target!);
        else if (this.timer <= 0) {
          const a = Math.random() * Math.PI * 2;
          const r = 12 + Math.random() * 30;
          this.goalX = this.homeX + Math.cos(a) * r;
          this.goalY = this.homeY + Math.sin(a) * r * 0.7;
          this.enter('wander', 3000);
        }
        break;
      case 'wander':
        if (dist < this.stats.sight) this.notice(target!);
        else if (this.walkTo(dt, this.goalX, this.goalY, this.stats.speed * 0.45) || this.timer <= 0) this.enter('idle', 900 + Math.random() * 1800);
        break;
      case 'notice':
        this.stand(dt);
        if (target) this.face(target.x - this.x);
        if (this.timer <= 0) this.enter('chase', 0);
        break;
      case 'chase':
        if (!target || this.tooFar(target, dist)) this.enter('return', 0);
        else this.chase(dt, target, dist);
        break;
      case 'return':
        if (this.walkTo(dt, this.homeX, this.homeY, this.stats.speed * 0.8)) {
          this.hp = this.stats.hp;
          this.enter('idle', 800);
        }
        break;
      case 'hurt':
        this.stand(dt);
        if (this.timer <= 0) this.enter('chase', 0);
        break;
      case 'windup':
      case 'attack':
      case 'recover':
        this.act(dt, target, dist);
        break;
      case 'dying':
        if (this.timer <= 0) this.destroy();
        break;
    }
    if (!this.dead) {
      const b = this.world.monsterBounds;
      this.x = Phaser.Math.Clamp(this.x, b.left, b.right);
      this.y = Phaser.Math.Clamp(this.y, b.top, b.bottom);
      // Trees and the forest's edge stop them too; they slide along.
      if (!this.world.walkable(this.x, this.y) && this.world.walkable(px, py)) {
        if (this.world.walkable(this.x, py)) this.y = py;
        else if (this.world.walkable(px, this.y)) this.x = px;
        else {
          this.x = px;
          this.y = py;
        }
      }
      this.sync(dt);
    }
  }

  hurt(hit: Hit): void {
    if (!this.alive) return;
    this.hp -= hit.damage;
    this.flashT = FLASH_TIME;
    this.world.popNumber(snap(this.x), snap(this.y) - this.stats.barY - 3, `${Math.round(hit.damage)}`, hit.poison ?? (hit.heavy ? 0xffe28a : 0xffffff));
    const dx = this.x - hit.fromX;
    const dy = this.y - this.stats.bodyY - hit.fromY;
    const l = Math.hypot(dx, dy) || 1;
    const push = hit.knock / this.stats.mass;
    this.kvx += (dx / l) * push;
    this.kvy += (dy / l) * push * 0.8;
    if (this.hp <= 0) {
      this.die();
      return;
    }
    // Struck from afar: it comes for whoever hit it, without the wind-up.
    if (this.state === 'idle' || this.state === 'wander' || this.state === 'notice' || this.state === 'return') this.enter('chase', 0);
    if (hit.heavy && this.staggers()) {
      this.onInterrupted();
      this.enter('hurt', STAGGER_TIME);
      this.play('idle');
    }
  }

  /** Can a heavy blow interrupt it right now? */
  protected staggers(): boolean {
    return this.state !== 'attack';
  }

  /** Close in on the target and decide when to start an attack. */
  protected abstract chase(dt: number, target: Target, dist: number): void;

  /** Run the windup, attack and recover states. */
  protected abstract act(dt: number, target: Target | null, dist: number): void;

  /** Clean up any telegraph when an attack is cut short. */
  protected onInterrupted(): void {}

  /** It has just been slain (a boss makes more of it). */
  protected onDeath(): void {}

  protected enter(state: MonsterState, time: number): void {
    this.state = state;
    this.timer = time;
  }

  private notice(target: Target): void {
    this.face(target.x - this.x);
    this.enter('notice', NOTICE_TIME);
    this.world.popNumber(snap(this.x), snap(this.y) - this.stats.barY - 2, '!', 0xffd35c);
    sound.notice(this.world.pan(this.x));
  }

  private tooFar(target: Target, dist: number): boolean {
    return dist > this.stats.sight * 2 || Math.hypot(target.x - this.homeX, target.y - this.homeY) > this.stats.leash;
  }

  /** Step toward (x, y); true once there. */
  protected walkTo(dt: number, x: number, y: number, speed: number): boolean {
    const dx = x - this.x;
    const dy = y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 3) {
      this.stand(dt);
      return true;
    }
    this.move(dt, dx / d, dy / d, speed);
    return false;
  }

  /** Walk along the unit vector (ux, uy). */
  protected move(dt: number, ux: number, uy: number, speed: number): void {
    this.x += (ux * speed * dt) / 1000;
    this.y += (uy * speed * dt) / 1000;
    this.face(ux);
    this.play('walk');
  }

  /** Stand still. */
  protected stand(_dt: number): void {
    this.play('idle');
  }

  protected face(dx: number): void {
    if (Math.abs(dx) > 0.5) this.facing = dx < 0 ? 'l' : 'r';
  }

  /** Play `<key>_<anim>_<facing>`, carrying the frame over when only the facing changed. */
  protected play(anim: string, restart = false): void {
    const key = `${this.stats.key}_${anim}_${this.facing}`;
    const cur = this.body.anims.currentAnim?.key;
    if (cur === key && !restart && this.body.anims.isPlaying) return;
    if (!this.world.anims.exists(key)) {
      if (anim === 'walk') this.play('idle');
      return;
    }
    const sameAnim = !restart && cur && cur.slice(0, -2) === key.slice(0, -2);
    const startFrame = sameAnim ? (this.body.anims.currentFrame?.index ?? 1) - 1 : 0;
    this.body.play({ key, startFrame: Math.max(0, startFrame) });
  }

  /** Show a single pose, stopping the animation. */
  protected pose(frame: string): void {
    this.body.anims.stop();
    this.body.setFrame(`${frame}_${this.facing}`);
  }

  private die(): void {
    this.onInterrupted();
    this.hp = 0;
    this.enter('dying', DEATH_TIME);
    this.body.anims.stop();
    this.flashT = DEATH_TIME;
    this.world.debris(this.stats.debris, snap(this.x), snap(this.y) - this.stats.bodyY, 18, this.y + 1);
    sound.monsterDie(this.world.pan(this.x), this.stats.mass);
    this.world.monsterSlain(this.stats.key, this.x, this.y, this.stats.bodyY);
    this.onDeath();
  }

  /** Separation: nudge by (dx, dy) unless pinned in place. */
  shove(dx: number, dy: number): void {
    if (this.pinned || !this.alive) return;
    this.x += dx;
    this.y += dy;
  }

  private sync(dt: number): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const hy = snap(ry - this.hover);
    const frame = this.body.frame.name;
    let alpha = 1;
    let scale = 1;
    if (this.state === 'spawn') alpha = Phaser.Math.Clamp(1 - this.timer / SPAWN_TIME, 0, 1);
    if (this.state === 'dying') {
      const t = Phaser.Math.Clamp(this.timer / DEATH_TIME, 0, 1);
      alpha = t;
      scale = 0.6 + t * 0.4;
    }
    this.body.setPosition(rx, hy).setDepth(ry).setAlpha(alpha).setScale(scale);
    this.glowLayer.setPosition(rx, hy).setDepth(ry + 0.1).setFrame(frame).setAlpha(alpha).setScale(scale);
    const f = this.flashT > 0;
    this.flash.setVisible(f);
    if (f) this.flash.setPosition(rx, hy).setDepth(ry + 0.2).setFrame(frame).setScale(scale).setAlpha(this.state === 'dying' ? alpha : Math.min(1, this.flashT / FLASH_TIME) * 0.85);
    const lift = Math.min(1, this.hover / 10);
    this.shadow.setPosition(rx, ry - 1).setAlpha(alpha * (1 - lift * 0.4));
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * alpha);
    if (!this.stats.noBar) this.bar.update(dt, rx, ry - this.stats.barY, this.state === 'dying' ? 0 : this.hp, this.stats.hp, 0);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.onInterrupted();
    for (const o of [this.body, this.glowLayer, this.flash, this.shadow, this.castShadow]) o.destroy();
    this.bar.destroy();
  }
}
