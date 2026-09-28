import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { BOLT_DIRS, MECH_GUN_X, MECH_GUN_Y, MECH_H, MECH_ORIGIN_X, MECH_ORIGIN_Y, MECH_W, type BoltKind } from '../art/mech';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { Heat } from './heat';
import { bloom, flare, Fx, pal, ring, type Ink, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

// The Siege Mech (the Automaton's first type): a walker that stomps about
// with a cannon on each arm.
//  - Attack (held): the cannons fire in turn, ka-chunk ka-chunk, shells
//    flying straight out; spent casings bounce off behind.
//  - Ability (held): Lock-on Salvo. The missile pods open and it sweeps the
//    way it aims, painting a reticle on each foe it finds there, one after
//    another; let go and a missile curves in on each (two straight ahead if
//    nothing was painted).
//  - Special: Siege Mode (see ultimate/robot.ts). It lets down its
//    stabilisers and becomes a turret, both guns hammering at whatever it
//    aims at, rooted to the spot.
// Everything it fires warms it (see heat.ts); overheated, it vents and stalls.
// The Scrap Titan fires nails and bottle rockets instead; it plays the same.

const FIRE_EVERY = 190;
const SHELL_SPEED = 330;
const SHELL_RANGE = 150;
const SHELL_DAMAGE = 6;
const SHELL_HEAT = 7;

const LOCK_EVERY = 210;
const LOCK_RANGE = 165;
/** Half the cone it paints in, as a cosine. */
const LOCK_CONE = Math.cos((55 * Math.PI) / 180);
const LOCK_MAX = 6;
/** Held this long, the salvo lets go by itself. */
const LOCK_HOLD_MAX = 3200;
const MISSILE_SPEED = 170;
const MISSILE_TOP = 290;
const MISSILE_DAMAGE = 14;
const MISSILE_RADIUS = 18;
const MISSILE_HEAT = 8;
const SALVO_COOLDOWN = 5200;
/** With nothing painted, two missiles fly this far ahead. */
const BLIND_RANGE = 90;

const SIEGE_EVERY = 75;
const SIEGE_DAMAGE = 7;

const WALK_STOMPS = new Set([1, 4]);

type State = 'free' | 'aim' | 'launch' | 'siege';

export interface MechKit {
  key: string;
  scrap: boolean;
  maxHp: number;
  speed: number;
  /** The shot and the missile in flight. */
  shot: BoltKind;
  missile: BoltKind;
  /** The explosion's colours; the muzzle and tracer glow. */
  boom: Pal;
  glow: number;
  /** The faint light around it at night (its headlamps). */
  aura: number;
}

export const MECH_KIT: MechKit = {
  key: 'mech',
  scrap: false,
  maxHp: 120,
  speed: 50,
  shot: 'shell',
  missile: 'missile',
  boom: pal(0xfffbe8, 0xffd860, 0xff8a2a, 0xc83a10, 0xffb040),
  glow: 0xffc060,
  aura: 0xffe6a0,
};

/** The Scrap Titan: nails and bottle rockets that burst like fireworks. */
export const SCRAP_KIT: MechKit = {
  ...MECH_KIT,
  key: 'mech_scrap',
  scrap: true,
  shot: 'nail',
  missile: 'rocket',
  boom: pal(0xffffff, 0xfff080, 0xff5a8a, 0x5a8aff, 0xff9ad0),
  glow: 0xfff0c0,
  aura: 0xffd8a0,
};

const boltFrame = (kind: BoltKind, dx: number, dy: number): string => {
  const i = Math.round((Math.atan2(dy, dx) / (Math.PI * 2)) * BOLT_DIRS);
  return `${kind}_${((i % BOLT_DIRS) + BOLT_DIRS) % BOLT_DIRS}`;
};

export class Mech implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: MechKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private aura: Phaser.GameObjects.Light;
  private heat: Heat;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private clock = 0;
  private fireT = 0;
  /** Which cannon fires next. */
  private gun = 0;
  /** A shot's anim is playing (the legs hold still under it). */
  private firingT = 0;
  private salvoCd = 0;
  private lockT = 0;
  private held = 0;
  private marks: { h: Hurtbox; img: Phaser.GameObjects.Image }[] = [];
  private launchAim = { x: 0, y: 1 };
  private siegeT = 0;
  private smokeT = 0;
  private prevSpecial = false;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: MechKit = MECH_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = MECH_ORIGIN_X / MECH_W;
    const oy = MECH_ORIGIN_Y / MECH_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(1.6, 1.2);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 60, kit.aura, 0);
    this.heat = new Heat(world, this);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && WALK_STOMPS.has(frame.index - 1)) this.stomp();
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (this.state === 'launch' && anim.key.startsWith(`${key}_launch_`)) this.state = 'free';
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.heat.destroy();
      this.clearMarks();
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.salvoCd = Math.max(0, this.salvoCd - dt);
    this.fireT = Math.max(0, this.fireT - dt);
    this.firingT = Math.max(0, this.firingT - dt);
    this.heat.update(dt);
    const stalled = this.heat.overheated;
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;

    if (this.state === 'siege') {
      this.updateSiege(dt);
    } else if (this.state === 'aim') {
      if (stalled) this.cancelAim();
      else {
        this.updateAim(dt);
        if (!special || this.held >= LOCK_HOLD_MAX) this.launch();
      }
    } else if (this.state === 'free' && !stalled) {
      if (pressed && this.salvoCd === 0) this.startAim();
      else if (attack && this.fireT === 0) this.fire();
    }

    // Heavy: slower while firing or painting, slowest venting; rooted in siege.
    const pace = this.kit.speed;
    const k = this.state === 'siege' ? 0 : stalled ? 0.4 : this.state === 'aim' ? 0.35 : this.firingT > 0 ? 0.55 : 1;
    const speed = pace * k * Math.min(1, len);
    if (moving && speed > 0) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * speed * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * speed * (dt / 1000), bounds.top, bounds.bottom);
    }
    this.animate(moving, stalled);
    this.sync(dt);
    this.updateHud();
  }

  /** Which animation plays: its current action's, else walking or standing. */
  private animate(moving: boolean, stalled: boolean): void {
    const key = this.kit.key;
    if (this.state === 'siege' || this.state === 'launch') return;
    if (this.state === 'aim') {
      this.dir = this.aimDir();
      this.play(`${key}_aim_${this.dir}`);
      return;
    }
    if (stalled) {
      this.play(`${key}_vent_${this.dir}`);
      return;
    }
    if (this.firingT > 0) return;
    if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
    else if (moving) this.dir = dirOf(this.lastMove.x, this.lastMove.y);
    this.play(`${key}_${moving ? 'walk' : 'idle'}_${this.dir}`);
  }

  private play(key: string): void {
    if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
  }

  private stomp(): void {
    sound.step();
    const w = this.world;
    w.debris([0xb8a888, 0x8a7a60, 0x6a5e4a], snap(this.x), snap(this.y) - 1, 3, this.y + 2, 'burst');
  }

  // -------------------------------------------------------------------------
  // The cannons

  private fire(): void {
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    const which = this.gun;
    this.gun = 1 - this.gun;
    this.body.play(`${this.kit.key}_fire${which ? 'B' : 'A'}_${this.dir}`);
    this.firingT = 170;
    this.fireT = FIRE_EVERY;
    const m = this.muzzle(which, u);
    this.world.addEffect(new Shot(this.world, m.x, m.y, u.x, u.y, SHELL_SPEED, SHELL_RANGE, SHELL_DAMAGE * this.heat.power, this.kit, this.y));
    this.casing(which, u);
    sound.cannon(this.world.pan(m.x), this.kit.scrap);
    this.heat.add(SHELL_HEAT);
  }

  /** Where cannon `which` fires from, facing `u`: out front at gun height, either side of the body. */
  private muzzle(which: number, u: { x: number; y: number }): { x: number; y: number } {
    const side = which ? 1 : -1;
    const along = this.dir === 'left' || this.dir === 'right' ? 15 : 6;
    const across = this.dir === 'left' || this.dir === 'right' ? (which ? 0 : -3) : MECH_GUN_X;
    const px = -u.y;
    const py = u.x;
    return { x: this.x + u.x * along + px * across * side, y: this.y - MECH_GUN_Y + u.y * along + py * across * side * 0.4 };
  }

  /** A spent casing (or a bent nail) kicked out of the breech, bouncing off behind. */
  private casing(which: number, u: { x: number; y: number }): void {
    const w = this.world;
    const back = { x: this.x - u.x * 4 + (which ? 6 : -6), y: this.y - MECH_GUN_Y + 4 };
    w.debris(this.kit.scrap ? [0xd4dce8, 0x8a94a6] : [0xfff0a0, 0xe8b440, 0xa8761e], snap(back.x), snap(back.y), 1, this.y + 3, 'burst');
  }

  // -------------------------------------------------------------------------
  // Lock-on salvo

  private startAim(): void {
    this.state = 'aim';
    this.held = 0;
    this.lockT = LOCK_EVERY * 0.5;
    this.clearMarks();
    sound.servo(this.world.pan(this.x));
  }

  /** Paint the next foe in the cone it aims, nearest first, a reticle on each. */
  private updateAim(dt: number): void {
    this.held += dt;
    this.lockT -= dt;
    this.marks = this.marks.filter((m) => {
      if (m.h.alive) return true;
      m.img.destroy();
      return false;
    });
    for (const m of this.marks) m.img.setPosition(snap(m.h.x), snap(m.h.y - m.h.bodyY)).setRotation(this.clock * 0.004);
    if (this.lockT > 0 || this.marks.length >= LOCK_MAX) return;
    this.lockT = LOCK_EVERY;
    const u = this.aimVec();
    const cx = this.x;
    const cy = this.y - MECH_GUN_Y;
    const taken = new Set(this.marks.map((m) => m.h));
    const next = this.world
      .hurtboxesWhere((h) => {
        if (!h.alive || taken.has(h)) return false;
        const dx = h.x - cx;
        const dy = h.y - h.bodyY - cy;
        const d = Math.hypot(dx, dy);
        return d <= LOCK_RANGE && d > 0 && (dx * u.x + dy * u.y) / d >= LOCK_CONE;
      })
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
    if (!next) return;
    const img = this.world.add.image(snap(next.x), snap(next.y - next.bodyY), 'mech_reticle').setDepth(10000).setBlendMode(Phaser.BlendModes.ADD).setScale(2).setAlpha(0.2);
    this.world.tweens.add({ targets: img, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' });
    this.marks.push({ h: next, img });
    sound.lockOn(this.marks.length);
  }

  private cancelAim(): void {
    this.clearMarks();
    this.state = 'free';
  }

  private clearMarks(): void {
    for (const m of this.marks) m.img.destroy();
    this.marks = [];
  }

  /** Let go: a missile for each painted foe, in quick succession (two ahead if none). */
  private launch(): void {
    const u = this.aimVec();
    this.launchAim = u;
    this.state = 'launch';
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_launch_${this.dir}`);
    const targets: (Hurtbox | { x: number; y: number })[] = this.marks.map((m) => m.h);
    if (!targets.length) {
      const px = -u.y;
      const py = u.x;
      for (const s of [-1, 1]) targets.push({ x: this.x + u.x * BLIND_RANGE + px * s * 12, y: this.y + u.y * BLIND_RANGE + py * s * 12 });
    }
    const marks = this.marks;
    this.marks = [];
    targets.forEach((t, i) => {
      this.world.time.delayedCall(i * 70, () => {
        const side = i % 2 ? 1 : -1;
        const x = this.x + side * 9;
        const y = this.y - MECH_GUN_Y - 8;
        this.world.addEffect(new Missile(this.world, x, y, side * 0.6 + this.launchAim.x * 0.4, -1, t, this.kit, MISSILE_DAMAGE * this.heat.power, marks[i]?.img ?? null));
        sound.missile(this.world.pan(x), this.kit.scrap);
        this.heat.add(MISSILE_HEAT);
      });
    });
    this.salvoCd = SALVO_COOLDOWN;
  }

  // -------------------------------------------------------------------------
  // Siege mode (the Special)

  /** The Special's doing: planted as a turret for `ms`, both guns firing at will. */
  siege(ms: number): void {
    this.cancelAim();
    this.state = 'siege';
    this.siegeT = ms;
    this.fireT = 0;
    sound.servo(this.world.pan(this.x));
    this.world.debris([0xb8a888, 0x8a7a60], snap(this.x), snap(this.y), 12, this.y + 2, 'burst');
  }

  private updateSiege(dt: number): void {
    this.siegeT -= dt;
    const u = this.siegeAim();
    const dir = dirOf(u.x, u.y);
    if (dir !== this.dir || !this.body.anims.currentAnim?.key.includes('_siege_')) {
      this.dir = dir;
      this.body.play(`${this.kit.key}_siege_${dir}`, true);
    }
    if (this.fireT === 0) {
      this.fireT = SIEGE_EVERY;
      const which = this.gun;
      this.gun = 1 - this.gun;
      const m = this.muzzle(which, u);
      // A little spread, so the stream fans out.
      const a = Math.atan2(u.y, u.x) + (Math.random() - 0.5) * 0.14;
      this.world.addEffect(new Shot(this.world, m.x, m.y, Math.cos(a), Math.sin(a), SHELL_SPEED * 1.15, SHELL_RANGE + 20, SIEGE_DAMAGE, this.kit, this.y));
      this.casing(which, u);
      sound.cannon(this.world.pan(m.x), this.kit.scrap);
    }
    if (this.siegeT <= 0) {
      this.state = 'free';
      sound.servo(this.world.pan(this.x));
    }
  }

  /** In siege it fires where it's aimed, or at the nearest foe, or the way it faces. */
  private siegeAim(): { x: number; y: number } {
    if (this.aim) return this.aimVec();
    const cx = this.x;
    const cy = this.y - MECH_GUN_Y;
    const near = this.world.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - cx, h.y - cy) < SHELL_RANGE).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
    if (near) {
      const dx = near.x - cx;
      const dy = near.y - near.bodyY - cy;
      const l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l };
    }
    return this.aimVec();
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private aimDir(): Dir {
    const a = this.aimVec();
    return dirOf(a.x, a.y);
  }

  private updateHud(): void {
    beamHud.charge = this.state === 'aim' ? this.marks.length / LOCK_MAX : 1 - this.salvoCd / SALVO_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'aim' || this.state === 'siege';
    comboHud.hits = 0;
    comboHud.window = 0;
  }

  private sync(dt: number): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    // Running hot, the plating flushes red.
    const hot = this.heat.value / 100;
    const flush = hot > 0.7 && !this.heat.overheated ? 0.5 + 0.5 * Math.sin(this.clock * 0.02) : 0;
    const tint = Phaser.Display.Color.GetColor(255, Math.round(255 - flush * 70), Math.round(255 - flush * 90));
    if (!this.body.isTinted || this.body.tintTopLeft !== 0xff8070) this.body.setTint(tint);
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
    this.aura.setPosition(rx, ry - 20);
    this.aura.intensity = 0.6 * (1 - this.daylight);
    // Smoke from the stack, thicker the hotter it runs.
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 420 - hot * 300;
      const back = this.dir === 'left' ? 6 : this.dir === 'right' ? -6 : 6;
      const top = this.kit.scrap ? 34 : 33;
      this.world.debris(hot > 0.7 ? [0x6a6a70, 0x4a4a50, 0x8a8a90] : [0x9a9aa0, 0x7a7a80, 0xb8b8c0], rx + back, ry - top, 1, ry + 1, 'spores');
    }
  }
}

/**
 * A shot from a cannon: a tracer (or a nail) flying straight out, turned to
 * its heading, striking the first body it meets.
 */
class Shot extends Fx {
  private img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private travelled = 0;
  private trailT = 0;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private dx: number,
    private dy: number,
    private speed: number,
    private range: number,
    private damage: number,
    private kit: MechKit,
    /** The ground under it when fired, for the flash's depth. */
    ground: number,
  ) {
    super(world, 2000);
    this.img = this.own(world.add.image(snap(x), snap(y), 'mech_bolt', boltFrame(kit.shot, dx, dy)).setPipeline('Lit'));
    this.glow = this.own(world.add.image(snap(x), snap(y), 'mech_bolt_e', boltFrame(kit.shot, dx, dy)).setBlendMode(Phaser.BlendModes.ADD));
    // The muzzle flash.
    bloom(world, x, y, kit.glow, 0.5, 120, ground + 30, 0.8);
  }

  protected step(dt: number): void {
    const w = this.world;
    let move = (this.speed * dt) / 1000;
    // In small steps, so it can't skip over a body.
    while (move > 0) {
      const s = Math.min(4, move);
      move -= s;
      this.x += this.dx * s;
      this.y += this.dy * s;
      this.travelled += s;
      if (w.strikeAt(this.x, this.y, { damage: this.damage, knock: 50, fromX: this.x - this.dx * 6, fromY: this.y - this.dy * 6 })) {
        w.debris(this.kit.scrap ? [0xffffff, 0xd4dce8, 0x8a94a6] : [0xffffff, 0xffd860, 0xff8a2a], this.x, this.y, 5, this.y + 20, 'burst');
        sound.impact(w.pan(this.x), true);
        this.destroy();
        return;
      }
      if (this.travelled >= this.range || !w.walkable(this.x, this.y + MECH_GUN_Y)) {
        w.debris([0xffffff, 0xb8a888], this.x, this.y, 2, this.y + 20, 'burst');
        this.destroy();
        return;
      }
    }
    const depth = this.y + MECH_GUN_Y + 1;
    this.img.setPosition(snap(this.x), snap(this.y)).setDepth(depth);
    this.glow.setPosition(snap(this.x), snap(this.y)).setDepth(depth + 0.1);
    this.trailT -= dt;
    if (this.trailT <= 0 && !this.kit.scrap) {
      this.trailT = 40;
      w.debris([0xffd860, 0xff8a2a], this.x - this.dx * 5, this.y - this.dy * 5, 1, depth, 'trail');
    }
  }
}

/**
 * A missile (or a bottle rocket): it leaves the pod climbing, then turns and
 * homes on its mark, speeding up, and bursts where it strikes, hurting all
 * around. Aimed at a spot rather than a foe, it bursts there.
 */
class Missile extends Fx {
  private img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private lamp: Phaser.GameObjects.Light;
  private vx: number;
  private vy: number;
  private speed = MISSILE_SPEED;
  private trailT = 0;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    dx: number,
    dy: number,
    private target: Hurtbox | { x: number; y: number },
    private kit: MechKit,
    private damage: number,
    private mark: Phaser.GameObjects.Image | null,
  ) {
    super(world, 3000);
    const l = Math.hypot(dx, dy) || 1;
    this.vx = dx / l;
    this.vy = dy / l;
    this.img = this.own(world.add.image(snap(x), snap(y), 'mech_bolt', boltFrame(kit.missile, this.vx, this.vy)).setPipeline('Lit'));
    this.glow = this.own(world.add.image(snap(x), snap(y), 'mech_bolt_e', boltFrame(kit.missile, this.vx, this.vy)).setBlendMode(Phaser.BlendModes.ADD));
    this.lamp = this.light(x, y, 40, kit.boom.light, 0.8);
    if (mark) this.own(mark);
    world.debris([0xffffff, 0xd8d8e0], x, y, 4, y + 30, 'spores');
  }

  /** Where it's going: the mark's body while it lives, else the spot it last had. */
  private goal(): { x: number; y: number } {
    const t = this.target;
    return 'bodyY' in t ? { x: t.x, y: t.y - t.bodyY } : t;
  }

  protected step(dt: number): void {
    const w = this.world;
    const s = dt / 1000;
    const g = this.goal();
    const dx = g.x - this.x;
    const dy = g.y - this.y;
    const d = Math.hypot(dx, dy);
    // Turning harder the longer it has flown, so it curls in rather than overshooting.
    const turn = 1 - Math.exp(-dt / Math.max(40, 220 - this.t * 0.6));
    if (this.t > 120 && d > 0) {
      this.vx += (dx / d - this.vx) * turn;
      this.vy += (dy / d - this.vy) * turn;
      const l = Math.hypot(this.vx, this.vy) || 1;
      this.vx /= l;
      this.vy /= l;
    }
    this.speed = Math.min(MISSILE_TOP, this.speed + 420 * s);
    this.x += this.vx * this.speed * s;
    this.y += this.vy * this.speed * s;
    const hitBody = w.firstHurtbox((h) => {
      const bx = (this.x - h.x) / (h.radius + 2);
      const by = (this.y - (h.y - h.bodyY)) / (h.bodyY + 3);
      return bx * bx + by * by <= 1;
    });
    if (hitBody || d < 6 || this.t > 2600) {
      this.burst();
      return;
    }
    const frame = boltFrame(this.kit.missile, this.vx, this.vy);
    const depth = this.y + 30;
    this.img.setFrame(frame).setPosition(snap(this.x), snap(this.y)).setDepth(depth);
    this.glow.setFrame(frame).setPosition(snap(this.x), snap(this.y)).setDepth(depth + 0.1);
    this.lamp.setPosition(this.x, this.y);
    this.mark?.setPosition(snap(g.x), snap(g.y)).setRotation(this.t * 0.01);
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 30;
      const tints = this.kit.scrap ? [0xfff8c0, 0xffd860, 0xffffff] : [0xe6ecf4, 0xc8d0dc, 0xffb040];
      w.debris(tints, this.x - this.vx * 5, this.y - this.vy * 5, 1, depth, this.kit.scrap ? 'spores' : 'trail');
    }
  }

  private burst(): void {
    const w = this.world;
    const x = this.x;
    const y = this.y;
    const p = this.kit.boom;
    // The ground under the burst, about a body's height below it.
    const gy = y + 8;
    w.melee({ kind: 'circle', x, y, radius: MISSILE_RADIUS }, { damage: this.damage, heavy: true, knock: 120, fromX: x, fromY: y });
    w.addEffect(new Burst(w, x, gy, p, this.kit.scrap));
    w.debris(p.tints, x, y, this.kit.scrap ? 26 : 16, gy + 20, 'burst');
    if (this.kit.scrap) w.debris([0xffffff, 0xfff080, 0x9affc0, 0x9ad0ff], x, y, 14, gy + 20, 'spores');
    bloom(w, x, y, p.hot, 1.4, 260, gy + 40);
    flare(w, x, y, 90, p.light, 2.2, 260);
    w.cameras.main.shake(90, 0.0006);
    sound.blast(w.pan(x));
    this.destroy();
  }
}

/** A ring of fire (or of confetti light) racing out along the ground where a missile burst. */
class Burst extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
    private scrap: boolean,
  ) {
    super(world, 320);
    this.g = this.ink(Math.ceil(MISSILE_RADIUS * 2 + 12), Math.ceil(MISSILE_RADIUS * 1.4 + 12));
  }

  protected step(): void {
    const k = this.t / this.life;
    const g = this.g.begin(this.x, this.y, this.y + 2);
    ring(g, this.x, this.y, 2 + MISSILE_RADIUS * Math.min(1, k * 1.5), 1.6 * (1 - k) + 0.4, this.p, 1 - k, undefined, this.scrap ? 0.5 : 0, 7);
    g.end();
  }
}
