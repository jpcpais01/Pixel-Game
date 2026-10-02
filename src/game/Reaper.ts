import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { REAP_HIT, REAPER_CHEST_Y, REAPER_H, REAPER_ORIGIN_X, REAPER_ORIGIN_Y, REAPER_W, SPIN_CUTS, STEP_GONE } from '../art/reaper';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { reachesBody, Vitals, type Hurtbox, type MeleeArea } from './combat';
import { HitSpark, SlashArc, type Effect, type Scheme } from './Slash';
import { DeathMark, ReapSoul, ShadeStreak } from './Reaping';
import { pal, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { heroTimers } from './timers';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Reaper: a type of the Necromancer, Death's own harvester, on a rig of
// his own (art/reaper.ts).
//  - The attack is Reap: two broad sweeps of the scythe before him, then a
//    spinning reap all round. Each foe the blade cuts gives up a little soul
//    that flies back into him and heals him (only so many a swing).
//  - The ability is Death's step: he comes apart into shade and forms again
//    up to 70 px along the aim, cutting every foe he passed through and
//    marking it; marked foes take more from his reaps for a few seconds.
//  - His Special, Harvest, is in ultimate/reaper.ts.

const stats = HERO_STATS['necromancer.reaper'];

/** A swing chains into the next if it starts within this long of the previous one. */
const COMBO_WINDOW = 1500;
/** The sweeps: their reach from the chest and half-angle (wide: a scythe's arc), and their blow. */
const SWEEP = { reach: 27, spread: (80 * Math.PI) / 180, damage: 9, knock: 70 };
/** The spinning reap: how far round him it cuts, and its blow. */
const SPIN = { radius: 26, damage: 14, knock: 140 };
/** Each foe cut gives a soul worth this much health, no more than `max` a swing. */
const SOUL = { heal: 1, max: 2, spinMax: 3 };
/** Marked foes take this much more from his reaps. */
const MARK_BONUS = 1.5;

/** Death's step: how far, its cut (a band this wide along the path), the mark it leaves and the wait. */
const STEP = { range: 70, min: 24, width: 10, damage: 12, mark: 4000, cooldown: 6000, untouchable: 320 };

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

/** Screen degrees each facing looks along. */
const FACING_DEG: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

type State = 'free' | 'reap' | 'spin' | 'step';

/** How a Reaper look plays: its texture key and the colours of its cuts, souls, shade and Special. */
export interface ReaperKit {
  key: string;
  /** The scythe's cuts. */
  blade: Scheme;
  /** The souls, the marks and the Special. */
  pal: Pal;
  /** The shade he comes apart into. */
  shade: number;
  /** Souls fly as marigold petals (the Catrina). */
  petals: boolean;
}

export const REAPER_KIT: ReaperKit = {
  key: 'necro_reaper',
  blade: { core: 0xf6fff0, hot: 0xd4ffb0, mid: 0x8ee86a, deep: 0x2e7a3a, light: 0xb0f080 },
  pal: pal(0xf6fff0, 0xd4ffb0, 0x8ee86a, 0x2e7a3a, 0xb0f080),
  shade: 0x0a120e,
  petals: false,
};

/** The Catrina: cuts of marigold and rose, souls flying as petals in spirit flame. */
export const CATRINA_KIT: ReaperKit = {
  key: 'necro_catrina',
  blade: { core: 0xfff4e0, hot: 0xffc060, mid: 0xff6a9a, deep: 0x8a1a5a, light: 0xff9a40 },
  pal: pal(0xfff4e0, 0xffc060, 0xff6a9a, 0x8a1a5a, 0xff9a40),
  shade: 0x1a0814,
  petals: true,
};

export class Reaper implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals = new Vitals(stats.hp);
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: ReaperKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  /** The soul-light he carries, flaring when he cuts. */
  private lamp: Phaser.GameObjects.Light;
  private flare = 0;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  /** Towards the mouse on a computer (see Hero). */
  private aim: Aim | null = null;
  private clock = 0;
  private cooldown = 0;
  private specialCd = 0;

  // The reaping chain.
  private step = 0;
  private lastSwingAt = -Infinity;
  private struck = false;
  private buffered = false;
  private prevAttack = false;
  private drift = { vx: 0, vy: 0, t: 0 };
  /** Foes the spin has already cut, and when it next draws its whirl. */
  private carved = new Set<Hurtbox>();
  private whirlT = 0;
  private soulsLeft = 0;

  // Death's step.
  private stepDir: Aim = { x: 0, y: 1 };
  private stepRange = STEP.range;
  private crossed = false;
  private marks = new Map<Hurtbox, DeathMark>();

  private fx: Effect[] = [];

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: ReaperKit = REAPER_KIT) {
    this.world = world;
    this.kit = kit;
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = REAPER_ORIGIN_X / REAPER_W;
    const oy = REAPER_ORIGIN_Y / REAPER_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.lamp = world.lights.addLight(x, y, 46, kit.blade.light ?? kit.blade.hot, 0);
    this.body.play(`${key}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      const k = anim.key;
      if (this.state === 'reap' && (k.startsWith(`${key}_reap1_`) || k.startsWith(`${key}_reap2_`))) this.settle(40);
      else if (this.state === 'spin' && k.startsWith(`${key}_reap3_`)) this.settle(160);
      else if (this.state === 'step' && k.startsWith(`${key}_step_`)) this.settle(60);
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
      for (const m of this.marks.values()) m.destroy();
      this.world.lights.removeLight(this.lamp);
    });
  }

  private settle(cooldown: number): void {
    this.state = 'free';
    this.cooldown = cooldown;
    this.body.play(`${this.kit.key}_idle_${this.dir}`);
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);
    for (const [h, m] of this.marks) if (m.dead) this.marks.delete(h);

    // A tap during a swing queues the next one, so quick taps chain cleanly.
    const pressed = attack && !this.prevAttack;
    this.prevAttack = attack;
    if (pressed && (this.state === 'reap' || this.state === 'spin')) this.buffered = true;

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.startStep();
      else if (attack || this.buffered) this.startReap();
    }

    const pace = { free: Math.min(1, len), reap: 0.35, spin: 0.45, step: 0 }[this.state];
    let vx = moving ? (mx / len) * stats.speed * pace : 0;
    let vy = moving ? (my / len) * stats.speed * pace : 0;
    if (this.drift.t > 0) {
      vx += this.drift.vx;
      vy += this.drift.vy;
      this.drift.t -= dt;
    }
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      // Fighting faces the aim, even walking backwards; otherwise the way of the walk.
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_walk_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      const f = this.body.anims.currentFrame;
      const at = f ? f.index - 1 : 0;
      if (this.state === 'reap' && !this.struck && at >= REAP_HIT.reap1) {
        this.struck = true;
        this.sweep();
      } else if (this.state === 'spin' && at >= SPIN_CUTS.from && at <= SPIN_CUTS.to) this.carve(dt);
      else if (this.state === 'step' && !this.crossed && at >= STEP_GONE) {
        this.crossed = true;
        this.cross(bounds);
      }
    }

    this.sync(dt);
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.updateHud();
  }

  // ---------------------------------------------------------------- Reap

  private startReap(): void {
    const chain = this.step > 0 && this.step < 3 && this.clock - this.lastSwingAt <= COMBO_WINDOW;
    this.step = chain ? this.step + 1 : 1;
    this.lastSwingAt = this.clock;
    this.buffered = false;
    this.struck = false;
    this.dir = this.aimDir();
    const u = this.facing();
    sound.reap(this.world.pan(this.x), this.step === 3);
    if (this.step === 3) {
      // The spinning reap: the scythe flung out at full stretch, all the way round him.
      this.state = 'spin';
      this.carved.clear();
      this.whirlT = 0;
      this.soulsLeft = SOUL.spinMax;
      this.body.play(`${this.kit.key}_reap3_${this.dir}`);
      this.drift = { vx: u.x * 40, vy: u.y * 40, t: 300 };
      return;
    }
    this.state = 'reap';
    this.soulsLeft = SOUL.max;
    this.body.play(`${this.kit.key}_reap${this.step}_${this.dir}`);
    this.drift = { vx: u.x * 36, vy: u.y * 36, t: 120 };
  }

  /** A sweep lands: a broad crescent of blade-light before him, cutting all it reaches. */
  private sweep(): void {
    const cx = snap(this.x);
    const cy = snap(this.y) - REAPER_CHEST_Y;
    const deg = FACING_DEG[this.dir];
    // The first sweep turns clockwise on screen, the second back; mirrored frames turn the other way.
    const flip = this.dir === 'right' ? -1 : 1;
    const way = (this.step === 1 ? 1 : -1) * flip;
    this.fx.push(new SlashArc(this.world, cx, cy, deg - way * 115, deg + way * 85, 22, this.kit.blade, snap(this.y), 230));
    // The blade's tip runs a little further out, a fainter, thinner crescent.
    this.fx.push(new SlashArc(this.world, cx, cy, deg - way * 95, deg + way * 70, 26, { ...this.kit.blade, core: this.kit.blade.hot, hot: this.kit.blade.mid }, snap(this.y) - 0.1, 200));
    const rad = (deg * Math.PI) / 180;
    this.cut({ kind: 'arc', x: cx, y: cy, radius: SWEEP.reach, angle: rad, spread: SWEEP.spread }, SWEEP.damage, SWEEP.knock, false);
  }

  /** The spin: everything within reach is cut once as the blade comes round. */
  private carve(dt: number): void {
    const cx = snap(this.x);
    const cy = snap(this.y) - REAPER_CHEST_Y;
    this.whirlT -= dt;
    if (this.whirlT <= 0) {
      // A ring of blade-light round him, laid afresh as he turns.
      this.whirlT = 120;
      const deg = FACING_DEG[this.dir] + (this.clock * 0.8) % 360;
      this.fx.push(new SlashArc(this.world, cx, cy, deg, deg + 360, SPIN.radius - 2, this.kit.blade, snap(this.y), 220));
    }
    const fresh = this.world.hurtboxesWhere((h) => h.alive && !this.carved.has(h) && Math.hypot(h.x - cx, h.y - h.bodyY - cy) <= SPIN.radius + h.radius);
    for (const h of fresh) this.carved.add(h);
    this.strike(fresh, SPIN.damage, SPIN.knock, true, cx, cy);
  }

  /** Cut everything in `area`. */
  private cut(area: MeleeArea, damage: number, knock: number, heavy: boolean): void {
    const ax = area.kind === 'line' ? area.x0 : area.x;
    const ay = area.kind === 'line' ? area.y0 : area.y;
    this.strike(
      this.world.hurtboxesWhere((h) => h.alive && !!reachesBody(area, h)),
      damage,
      knock,
      heavy,
      ax,
      ay,
    );
  }

  /** The blow on each foe: deeper on the marked, a soul torn from each (while the swing has souls left). */
  private strike(foes: Hurtbox[], damage: number, knock: number, heavy: boolean, fromX: number, fromY: number): void {
    if (!foes.length) return;
    const k = this.kit;
    for (const h of foes) {
      const mark = this.marks.get(h);
      const marked = !!mark && !mark.dead;
      h.hurt({ damage: marked ? damage * MARK_BONUS : damage, heavy: heavy || marked, knock, fromX, fromY });
      const bx = h.x;
      const by = h.y - h.bodyY;
      this.fx.push(new HitSpark(this.world, bx, by, k.blade, h.y + 13, heavy || marked));
      if (marked) {
        mark!.pop();
        this.world.debris([k.pal.core, k.pal.hot, k.pal.mid], snap(bx), snap(by) - 4, 6, h.y + 20, 'burst');
      }
      if (this.soulsLeft > 0) {
        this.soulsLeft--;
        this.free(bx, by);
      }
    }
    sound.reapHit(this.world.pan(fromX), heavy);
    this.flare = 1;
    this.world.cameras.main.shake(heavy ? 110 : 60, heavy ? 0.0007 : 0.00035);
  }

  /** A soul torn loose at (x, y): it flies back into him and mends him a little. */
  private free(x: number, y: number): void {
    const k = this.kit;
    this.world.addEffect(
      new ReapSoul(this.world, x, y, this, k.pal, k.petals, () => {
        if (this.vitals.hp < this.vitals.max) this.vitals.heal(SOUL.heal);
      }),
    );
  }

  // ---------------------------------------------------------------- Death's step

  private startStep(): void {
    this.state = 'step';
    this.step = 0;
    this.crossed = false;
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    this.stepDir = { x: a.x / l, y: a.y / l };
    this.stepRange = this.aim?.dist !== undefined ? Phaser.Math.Clamp(this.aim.dist, STEP.min, STEP.range) : STEP.range;
    this.dir = dirOf(this.stepDir.x, this.stepDir.y);
    this.body.play(`${this.kit.key}_step_${this.dir}`);
    this.specialCd = STEP.cooldown;
    this.world.evade(STEP.untouchable + 200);
    sound.deathStep(this.world.pan(this.x));
    const k = this.kit;
    this.world.debris([k.shade, k.pal.mid, k.pal.deep], snap(this.x), snap(this.y) - 10, 8, this.y + 10, 'gather');
  }

  /** He crosses: gone from here, out at the end of the path, every foe on it cut and marked. */
  private cross(bounds: Phaser.Geom.Rectangle): void {
    const x0 = this.x;
    const y0 = this.y;
    const u = this.stepDir;
    // As far along as there is open ground: shade passes over foes, not through walls.
    let d = 0;
    for (let s = 3; s <= this.stepRange; s += 3) {
      const x = x0 + u.x * s;
      const y = y0 + u.y * s;
      if (!bounds.contains(x, y) || !this.world.walkable(x, y)) break;
      d = s;
    }
    const x1 = x0 + u.x * d;
    const y1 = y0 + u.y * d;
    this.x = x1;
    this.y = y1;
    this.world.evade(STEP.untouchable);
    const k = this.kit;
    this.world.addEffect(new ShadeStreak(this.world, x0, y0, x1, y1, k.pal, k.shade, k.petals));
    const area: MeleeArea = { kind: 'line', x0, y0: y0 - REAPER_CHEST_Y, x1, y1: y1 - REAPER_CHEST_Y, radius: STEP.width };
    const foes = this.world.hurtboxesWhere((h) => h.alive && !!reachesBody(area, h));
    for (const h of foes) {
      h.hurt({ damage: STEP.damage, heavy: true, knock: 50, fromX: x0, fromY: y0 - REAPER_CHEST_Y });
      const m = this.marks.get(h);
      if (m && !m.dead) m.renew(STEP.mark);
      else {
        const mark = new DeathMark(this.world, h, k.pal, k.petals, STEP.mark);
        this.marks.set(h, mark);
        this.world.addEffect(mark);
      }
      this.fx.push(new HitSpark(this.world, h.x, h.y - h.bodyY, k.blade, h.y + 13, true));
      this.world.debris([k.pal.hot, k.pal.mid, k.shade], snap(h.x), snap(h.y - h.bodyY), 5, h.y + 20, 'burst');
    }
    this.world.debris([k.shade, k.pal.mid], snap(x1), snap(y1) - 10, 8, y1 + 10, 'burst');
    if (foes.length) {
      sound.reapHit(this.world.pan(x1), true);
      this.world.cameras.main.shake(120, 0.0008);
      // The marks' time, for the HUD.
      const marks = [...this.marks.values()];
      heroTimers.follow('reaper-mark', 'ability', '', k.pal.hot, () => {
        const live = marks.filter((m) => !m.dead);
        return live.length ? { left: Math.max(...live.map((m) => m.left)), total: STEP.mark } : null;
      });
    }
    this.flare = 1;
  }

  // ---------------------------------------------------------------- Upkeep

  /** Which way an ability goes: at the mouse on a computer, else the way he last walked. */
  private aimDir(): Dir {
    const a = this.aim ?? this.lastMove;
    return dirOf(a.x, a.y);
  }

  private facing(): { x: number; y: number } {
    const a = (FACING_DEG[this.dir] * Math.PI) / 180;
    return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
  }

  private updateHud(): void {
    // The ability button's ring refills over Death's step's wait.
    beamHud.charge = 1 - this.specialCd / STEP.cooldown;
    beamHud.over = 0;
    beamHud.firing = this.state === 'step';
    const since = this.clock - this.lastSwingAt;
    comboHud.hits = this.step;
    comboHud.window = this.step === 0 ? 0 : this.step < 3 ? Math.max(0, 1 - since / COMBO_WINDOW) : Math.max(0, 1 - since / 600);
  }

  private sync(dt: number): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    // In shade he casts no shadow.
    const solid = this.state === 'step' && /_[123]$/.test(frame) ? 0.25 : 1;
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha * solid);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha * solid);
    // The soul-light in his eyes and on the blade, brightest at night, flaring as he cuts.
    this.flare = Math.max(0, this.flare - dt / 300);
    this.lamp.setPosition(rx, ry - REAPER_CHEST_Y);
    this.lamp.intensity = (0.25 + 0.5 * (1 - this.daylight)) + 1.2 * this.flare;
  }
}
