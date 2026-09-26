import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { CHEST_Y, FACING_DEG, HIT_FRAME, SAMURAI_H, SAMURAI_ORIGIN_X, SAMURAI_ORIGIN_Y, SAMURAI_W } from '../art/samurai';
import { samuraiMeta } from '../art/textures';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { reachesBody, Vitals, type Hurtbox, type MeleeArea } from './combat';
import { HitSpark, SlashArc, ThrustStreak, type Effect, type Scheme } from './Slash';
import { CutBurst, Gust, schemePal, WindRing } from './Blades';
import { Ink, segDist, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

/** How a samurai type plays: its look, its body and the colours of its cuts. */
export interface SamuraiKit {
  key: string;
  /** The ronin: marking cuts and the crossing cut, rather than the Bladewind's wind. */
  ronin: boolean;
  maxHp: number;
  speed: number;
  /** The blade's own cuts. */
  steel: Scheme;
  /** The Bladewind's wind, or the ronin's delayed cuts. */
  wind: Scheme;
}

export const BLADEWIND_KIT: SamuraiKit = {
  key: 'samurai',
  ronin: false,
  maxHp: 90,
  speed: 66,
  steel: { core: 0xffffff, hot: 0xe6f4ff, mid: 0x9fc8f0, deep: 0x4a78b8 },
  wind: { core: 0xf4ffff, hot: 0xbff4ff, mid: 0x6fd4f0, deep: 0x2a86b8, light: 0x8ae0ff },
};

export const ONI_KIT: SamuraiKit = {
  ...BLADEWIND_KIT,
  key: 'samurai_oni',
  steel: { core: 0xfff6f2, hot: 0xffc0b8, mid: 0xff6a62, deep: 0xa01828 },
  wind: { core: 0xfff0ec, hot: 0xff9a8a, mid: 0xf0283a, deep: 0x7a0a1a, light: 0xff4a4a },
};

export const RONIN_KIT: SamuraiKit = {
  key: 'ronin',
  ronin: true,
  maxHp: 100,
  speed: 60,
  steel: { core: 0xffffff, hot: 0xf0f4ff, mid: 0xb8c4dc, deep: 0x6a7894 },
  wind: { core: 0xfffbe8, hot: 0xffe08a, mid: 0xf0b040, deep: 0xa0601e, light: 0xffc860 },
};

export const SAKURA_KIT: SamuraiKit = {
  ...RONIN_KIT,
  key: 'ronin_sakura',
  steel: { core: 0xffffff, hot: 0xfff0f4, mid: 0xf4b8cc, deep: 0xb0607e },
  wind: { core: 0xfff4f8, hot: 0xffc0d4, mid: 0xff7aa6, deep: 0xb03a6a, light: 0xff9ac0 },
};

// The Bladewind.
/** A stack lasts this long after the stab that earned it. */
const STACK_MS = 5000;
const STAB_REACH = 36;
const STAB_DAMAGE = 10;
const GUST_DAMAGE = 14;
const SPIN_RADIUS = 24;
const SPIN_DAMAGE = 12;
/** A basic this soon after a dash ends (or during it) spins instead of stabbing. */
const SPIN_WINDOW = 200;
/** A foe this close (edge to feet, about his height) can be dashed through. */
const DASH_RANGE = 34;
const DASH_LEN = 46;
const DASH_MS = 160;
const DASH_DAMAGE = 9;
const DASH_CD = 350;
/** The same foe can't be dashed through again for this long. */
const DASH_LOCK = 3000;

// The Ronin.
const SLASH_DAMAGE = 11;
const CHAIN_MS = 1100;
const MARK_MS = 6000;
const MAX_MARKS = 3;
const CROSS_LEN = 64;
const CROSS_MS = 150;
const CROSS_DAMAGE = 8;
const CROSS_CD = 6500;
/** He sheathes this long after the crossing cut, and the cuts open. */
const SEVER_DELAY = 450;
const SEVER_REACH = 110;
const SEVER_BASE = 10;
const SEVER_PER_MARK = 9;

type State = 'free' | 'stab' | 'gust' | 'spin' | 'dash' | 'slash' | 'cross';
type Move = 'stab' | 'gust' | 'slash';

/**
 * The samurai. The Bladewind stabs in a line, and two stabs that land charge
 * the blade so the third throws a small tornado that knocks foes into the
 * air; the special dashes through a foe within reach, and a basic during or
 * just after the dash spins a full circle instead (a charged spin throws a
 * whirlwind all round him). The Ronin slashes, leaving cuts on what he hits;
 * the special crosses a line in a flash, and when he sheathes a beat later
 * every foe he crossed and every marked foe near him bursts, harder for each
 * mark.
 */
export class Samurai implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals: Vitals;
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  /** Gone from sight (the Hundred Cuts), whatever the world fades him to. */
  vanished = false;
  readonly kit: SamuraiKit;
  /** The wind's (or the cuts') colours as a Special palette. */
  readonly pal: Pal;
  private dir: Dir = 'down';
  private world: WorldScene;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  /** The line of the current move. */
  private u = { x: 0, y: 1 };
  private clock = 0;
  private cooldown = 0;
  private specialCd = 0;
  private struck = false;
  private prevAttack = false;
  private buffered = false;
  private fx: Effect[] = [];
  private trailT = 0;
  private nagT = 0;

  private stacks = 0;
  private stackT = 0;
  private spinWindow = 0;
  private spinQueued = false;
  private dashT = 0;
  private dashTarget: Hurtbox | null = null;
  private dashHit = false;
  private locks = new Map<Hurtbox, number>();
  /** Wind curling round a charged blade. */
  private charge: Ink;
  private chargeShown = false;

  private step = 0;
  private lastSlashAt = -Infinity;
  private crossed = new Set<Hurtbox>();
  private severT = -1;
  private marks = new Map<Hurtbox, { n: number; t: number; img: Phaser.GameObjects.Image }>();

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: SamuraiKit = BLADEWIND_KIT) {
    this.world = world;
    this.kit = kit;
    this.pal = schemePal(kit.wind);
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = SAMURAI_ORIGIN_X / SAMURAI_W;
    const oy = SAMURAI_ORIGIN_Y / SAMURAI_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.charge = new Ink(world, 24, 24);
    this.body.play(`${key}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      const k = anim.key;
      if (!k.startsWith(`${key}_`)) return;
      if (this.state === 'spin' && k.includes('_spin_')) this.settle(110);
      else if ((this.state === 'stab' || this.state === 'gust' || this.state === 'slash') && !k.includes('_idle_') && !k.includes('_walk_')) {
        this.settle(this.state === 'stab' ? 30 : this.state === 'gust' ? 170 : this.step === 2 ? 170 : 40);
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
      comboHud.hits = 0;
      comboHud.window = 0;
      this.charge.destroy();
      for (const m of this.marks.values()) m.img.destroy();
      this.marks.clear();
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);
    this.nagT -= dt;
    const pressed = attack && !this.prevAttack;
    this.prevAttack = attack;
    if (pressed && this.state !== 'free') this.buffered = true;

    if (this.kit.ronin) this.ronin(dt, attack, special);
    else this.bladewind(dt, attack, special);

    // Walking, slowed while he cuts; a dash carries him along its line.
    const px = this.x;
    const py = this.y;
    const slow = { free: Math.min(1, len), stab: 0.55, gust: 0.35, spin: 0.5, dash: 0, slash: 0.4, cross: 0 }[this.state];
    const speed = this.kit.speed * slow;
    let vx = moving ? (mx / len) * speed : 0;
    let vy = moving ? (my / len) * speed : 0;
    if (this.state === 'dash' || this.state === 'cross') {
      const s = this.state === 'dash' ? (DASH_LEN / DASH_MS) * 1000 : (CROSS_LEN / CROSS_MS) * 1000;
      vx = this.u.x * s;
      vy = this.u.y * s;
    }
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);
    if (this.state === 'cross') this.crossThrough(px, py);
    if (this.state === 'dash' || this.state === 'cross') {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 35;
        this.afterimage();
      }
    }

    if (this.state === 'free') {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = `${this.kit.key}_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else if (this.state === 'stab' || this.state === 'gust' || this.state === 'slash') {
      const f = this.body.anims.currentFrame;
      const hitAt = HIT_FRAME[this.state === 'stab' ? 'stab' : 'slash1'];
      if (!this.struck && f && f.index - 1 >= hitAt) {
        this.struck = true;
        this.land(this.state);
      }
    }

    this.sync();
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.updateMarks(dt);
    this.drawCharge();
    this.updateHud();
  }

  // -------------------------------------------------------------------------
  // The Bladewind

  private bladewind(dt: number, attack: boolean, special: boolean): void {
    this.stackT = Math.max(0, this.stackT - dt);
    if (this.stackT === 0) this.stacks = 0;
    if (this.state === 'free') this.spinWindow = Math.max(0, this.spinWindow - dt);

    if (this.state === 'dash') {
      if (attack || this.buffered) this.spinQueued = true;
      this.dashT -= dt;
      // He cuts the foe as he passes through it.
      const t = this.dashTarget;
      if (!this.dashHit && t && this.dashT <= DASH_MS * 0.55) {
        this.dashHit = true;
        if (t.alive) {
          t.hurt({ damage: DASH_DAMAGE, heavy: false, knock: 30, fromX: this.x, fromY: this.y });
          this.fx.push(new HitSpark(this.world, t.x, t.y - t.bodyY, this.kit.wind, t.y + 13, false));
          sound.katanaHit(this.world.pan(t.x), false);
        }
      }
      if (this.dashT <= 0) {
        this.dashTarget = null;
        if (this.spinQueued) this.startSpin();
        else {
          this.settle(0);
          this.spinWindow = SPIN_WINDOW;
        }
      }
    }

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.tryDash();
      else if (attack || this.buffered) {
        this.buffered = false;
        if (this.spinWindow > 0) this.startSpin();
        else this.startMove(this.stacks >= 2 ? 'gust' : 'stab');
      }
    }
  }

  /** A stab that landed: the blade takes a charge (two make it ready to loose a gust). */
  private gainStack(): void {
    const was = this.stacks;
    this.stacks = Math.min(2, this.stacks + 1);
    this.stackT = STACK_MS;
    if (this.stacks === 2 && was < 2) sound.windCharge(this.world.pan(this.x));
  }

  private tryDash(): void {
    const a = this.aim ?? this.lastMove;
    const al = Math.hypot(a.x, a.y) || 1;
    const ax = a.x / al;
    const ay = a.y / al;
    let best = Infinity;
    let pick: Hurtbox | null = null;
    for (const h of this.world.hurtboxesWhere((b) => b.alive)) {
      if ((this.locks.get(h) ?? -Infinity) > this.clock) continue;
      const dx = h.x - this.x;
      const dy = h.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d - h.radius > DASH_RANGE) continue;
      const along = d > 1 ? (dx * ax + dy * ay) / d : 1;
      const score = d * (1.6 - along);
      if (score < best) {
        best = score;
        pick = h;
      }
    }
    if (!pick) {
      if (this.nagT <= 0) {
        this.nagT = 800;
        this.world.popNumber(snap(this.x), snap(this.y) - 40, 'TOO FAR', 0x9aa4c8);
      }
      return;
    }
    const dx = pick.x - this.x;
    const dy = pick.y - this.y;
    const d = Math.hypot(dx, dy);
    this.u = d > 1 ? { x: dx / d, y: dy / d } : { x: ax, y: ay };
    this.dir = dirOf(this.u.x, this.u.y);
    this.state = 'dash';
    this.dashT = DASH_MS;
    this.dashTarget = pick;
    this.dashHit = false;
    this.spinQueued = false;
    this.buffered = false;
    this.trailT = 0;
    this.specialCd = DASH_CD;
    this.locks.set(pick, this.clock + DASH_LOCK);
    if (this.locks.size > 24) for (const [h, until] of this.locks) if (until <= this.clock) this.locks.delete(h);
    this.body.play(`${this.kit.key}_dash_${this.dir}`);
    sound.windDash(this.world.pan(this.x));
  }

  /** A full turn, the blade straight out: it cuts all round him, and a charged blade throws a whirlwind. */
  private startSpin(): void {
    this.state = 'spin';
    this.spinWindow = 0;
    this.spinQueued = false;
    this.buffered = false;
    this.body.play(`${this.kit.key}_spin_${this.dir}`);
    const cx = snap(this.x);
    const cy = snap(this.y) - CHEST_Y;
    const deg = FACING_DEG[this.dir];
    this.fx.push(new SlashArc(this.world, cx, cy, deg, deg + 360, 20, this.stacks >= 2 ? this.kit.wind : this.kit.steel, snap(this.y), 280));
    const hits = this.strike({ kind: 'circle', x: cx, y: cy, radius: SPIN_RADIUS }, SPIN_DAMAGE, true, 50);
    this.sparks(hits, this.kit.steel, true);
    sound.katana(this.world.pan(this.x), true);
    if (this.stacks >= 2) {
      this.world.addEffect(new WindRing(this.world, this.x, this.y, this.pal, 6));
      this.stacks = 0;
      this.stackT = 0;
    } else if (hits.length) this.gainStack();
  }

  // -------------------------------------------------------------------------
  // The Ronin

  private ronin(dt: number, attack: boolean, special: boolean): void {
    if (this.state === 'cross') {
      this.dashT -= dt;
      if (this.dashT <= 0) {
        this.settle(120);
        this.severT = SEVER_DELAY;
      }
    }
    if (this.severT >= 0) {
      this.severT -= dt;
      if (this.severT < 0) this.sever();
    }
    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.startCross();
      else if (attack || this.buffered) {
        this.buffered = false;
        this.step = this.step === 1 && this.clock - this.lastSlashAt <= CHAIN_MS ? 2 : 1;
        this.lastSlashAt = this.clock;
        this.startMove('slash');
      }
    }
  }

  private startCross(): void {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    this.u = { x: a.x / l, y: a.y / l };
    this.dir = dirOf(this.u.x, this.u.y);
    this.state = 'cross';
    this.dashT = CROSS_MS;
    this.trailT = 0;
    this.buffered = false;
    this.crossed.clear();
    this.specialCd = CROSS_CD;
    this.body.play(`${this.kit.key}_dash_${this.dir}`);
    this.fx.push(new ThrustStreak(this.world, snap(this.x), snap(this.y) - CHEST_Y + 2, this.u.x, this.u.y, CROSS_LEN, this.kit.steel, snap(this.y)));
    sound.windDash(this.world.pan(this.x));
  }

  /** Every foe along the stretch just crossed takes a quick cut, and is marked to burst when he sheathes. */
  private crossThrough(px: number, py: number): void {
    for (const h of this.world.hurtboxesWhere((b) => b.alive && !this.crossed.has(b))) {
      if (segDist(h.x, h.y, px, py, this.x, this.y) > h.radius + 8) continue;
      this.crossed.add(h);
      h.hurt({ damage: CROSS_DAMAGE, heavy: false, knock: 0, fromX: px, fromY: py });
      this.fx.push(new HitSpark(this.world, h.x, h.y - h.bodyY, this.kit.steel, h.y + 13, false));
    }
  }

  /** He sheathes: the crossed and the marked near him burst open, harder for every mark. */
  private sever(): void {
    sound.sheathe(this.world.pan(this.x));
    const foes = new Set<Hurtbox>();
    for (const h of this.crossed) if (h.alive) foes.add(h);
    for (const h of this.marks.keys()) if (h.alive && Math.hypot(h.x - this.x, h.y - this.y) <= SEVER_REACH) foes.add(h);
    this.crossed.clear();
    this.cutOpen([...foes], SEVER_BASE, SEVER_PER_MARK);
  }

  /** Burst these foes' cuts open: `base` damage and `per` more for each mark, which is spent. */
  cutOpen(foes: Hurtbox[], base: number, per: number): void {
    for (const h of foes) {
      if (!h.alive) continue;
      const n = this.marks.get(h)?.n ?? 0;
      h.hurt({ damage: base + per * n, heavy: true, knock: 40, fromX: h.x, fromY: h.y - 4 });
      this.world.addEffect(new CutBurst(this.world, h.x, h.y - h.bodyY, this.pal, n >= 2));
      this.unmark(h);
    }
    if (foes.length) {
      sound.sever(this.world.pan(foes[0].x), foes.length);
      this.world.cameras.main.shake(110, 0.0006);
    }
  }

  /** Leave a cut on a foe (up to three), shown over its head until it bursts or heals. */
  mark(h: Hurtbox, n = 1): void {
    if (!h.alive) return;
    let m = this.marks.get(h);
    if (!m) {
      const img = this.world.add.image(0, 0, 'samurai_mark_e', 'm1').setBlendMode(Phaser.BlendModes.ADD).setTint(this.kit.wind.hot);
      m = { n: 0, t: 0, img };
      this.marks.set(h, m);
    }
    m.n = Math.min(MAX_MARKS, m.n + n);
    m.t = MARK_MS;
    m.img.setFrame(`m${m.n}`);
  }

  private unmark(h: Hurtbox): void {
    const m = this.marks.get(h);
    if (!m) return;
    m.img.destroy();
    this.marks.delete(h);
  }

  private updateMarks(dt: number): void {
    for (const [h, m] of this.marks) {
      m.t -= dt;
      if (m.t <= 0 || !h.alive) {
        this.unmark(h);
        continue;
      }
      const blink = m.t < 1200 && Math.floor(m.t / 120) % 2 === 0;
      m.img
        .setPosition(snap(h.x), snap(h.y - h.bodyY * 2) - 8)
        .setDepth(h.y + 60)
        .setAlpha(blink ? 0.35 : 0.95);
    }
  }

  // -------------------------------------------------------------------------
  // Shared

  private startMove(move: Move): void {
    this.state = move;
    this.struck = false;
    this.buffered = false;
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    this.u = { x: a.x / l, y: a.y / l };
    this.dir = dirOf(this.u.x, this.u.y);
    const anim = move === 'stab' ? 'stab' : move === 'gust' || this.step !== 2 ? 'slash1' : 'slash2';
    this.body.play(`${this.kit.key}_${anim}_${this.dir}`);
    sound.katana(this.world.pan(this.x), move === 'gust');
  }

  /** The blow lands on its frame. */
  private land(move: Move): void {
    const cx = snap(this.x);
    const cy = snap(this.y) - CHEST_Y;
    const depth = snap(this.y);
    const u = this.u;
    if (move === 'stab') {
      const area: MeleeArea = { kind: 'line', x0: cx + u.x * 3, y0: cy + u.y * 3, x1: cx + u.x * STAB_REACH, y1: cy + u.y * STAB_REACH, radius: 5 };
      this.fx.push(new ThrustStreak(this.world, cx + Math.round(u.x * 2), cy + Math.round(u.y * 2), u.x, u.y, STAB_REACH - 4, this.stacks >= 1 ? this.kit.wind : this.kit.steel, depth));
      const hits = this.strike(area, STAB_DAMAGE, false, 40);
      this.sparks(hits, this.kit.steel, false);
      if (hits.length) this.gainStack();
      return;
    }
    // A sweeping cut: forehand or backhand across the aim.
    const deg = (Math.atan2(u.y, u.x) * 180) / Math.PI;
    const hand = this.dir === 'right' ? -1 : 1;
    const sweep = move === 'slash' && this.step === 2 ? -hand : hand;
    this.fx.push(new SlashArc(this.world, cx, cy, deg + sweep * 100, deg - sweep * 100, 18, move === 'gust' ? this.kit.wind : this.kit.steel, depth, 180));
    if (move === 'gust') {
      this.world.addEffect(new Gust(this.world, this.x + u.x * 6, this.y + u.y * 6, u.x, u.y, this.pal, GUST_DAMAGE));
      this.stacks = 0;
      this.stackT = 0;
      return;
    }
    const hits = this.strike({ kind: 'arc', x: cx, y: cy, radius: 25, angle: Math.atan2(u.y, u.x), spread: (115 * Math.PI) / 180 }, SLASH_DAMAGE, this.step === 2, this.step === 2 ? 90 : 50);
    this.sparks(hits, this.kit.steel, this.step === 2);
    for (const h of hits) this.mark(h);
  }

  /** Strike every body the area reaches; returns them. */
  private strike(area: MeleeArea, damage: number, heavy: boolean, knock: number): Hurtbox[] {
    const ox = area.kind === 'line' ? area.x0 : area.x;
    const oy = area.kind === 'line' ? area.y0 : area.y;
    const hits = this.world.hurtboxesWhere((h) => h.alive && !!reachesBody(area, h));
    for (const h of hits) h.hurt({ damage, heavy, knock, fromX: ox, fromY: oy });
    return hits;
  }

  private sparks(hits: Hurtbox[], s: Scheme, heavy: boolean): void {
    for (const h of hits) {
      this.fx.push(new HitSpark(this.world, h.x, h.y - h.bodyY, s, h.y + 13, heavy));
      sound.katanaHit(this.world.pan(h.x), heavy);
    }
    if (hits.length) this.world.cameras.main.shake(heavy ? 90 : 50, heavy ? 0.0005 : 0.0003);
  }

  /** Back to his feet: free to move after `rest` ms. */
  private settle(rest: number): void {
    this.state = 'free';
    this.cooldown = rest;
    this.body.play(`${this.kit.key}_idle_${this.dir}`);
  }

  /** A fading copy of him left behind as he dashes. */
  private afterimage(): void {
    const b = this.body;
    const g = this.world.add
      .sprite(b.x, b.y, b.texture.key, b.frame.name)
      .setOrigin(b.originX, b.originY)
      .setTint(this.kit.wind.hot)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.4 * this.alpha * (this.vanished ? 0 : 1))
      .setDepth(b.depth - 0.2);
    this.world.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  /** Wind curling round the point of a charged blade. */
  private drawCharge(): void {
    const on = this.stacks >= 2 && !this.vanished && this.alpha > 0.05;
    if (!on) {
      if (this.chargeShown) {
        this.charge.begin(this.x, this.y, 0).end();
        this.chargeShown = false;
      }
      return;
    }
    this.chargeShown = true;
    const m = samuraiMeta.get(this.body.frame.name);
    const rx = snap(this.x) - SAMURAI_ORIGIN_X;
    const ry = snap(this.y) - SAMURAI_ORIGIN_Y;
    const tx = m ? rx + (m.tipX * 2 + m.handX) / 3 : this.x;
    const ty = m ? ry + (m.tipY * 2 + m.handY) / 3 : this.y - 14;
    const g = this.charge.begin(tx, ty, this.body.depth + 0.2);
    const p = this.kit.wind;
    const t = this.clock * 0.012;
    for (let k = 0; k < 10; k++) {
      const a = t + (k / 10) * Math.PI * 2;
      const r = 4 + Math.sin(t * 1.7 + k) * 1.5;
      const c = k % 3 === 0 ? p.core : k % 3 === 1 ? p.hot : p.mid;
      g.put(tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.75, c, 0.55 + 0.45 * Math.sin(a));
    }
    g.end();
  }

  private updateHud(): void {
    if (this.kit.ronin) {
      beamHud.charge = 1 - this.specialCd / CROSS_CD;
      beamHud.firing = this.state === 'cross' || this.severT >= 0;
      const since = this.clock - this.lastSlashAt;
      comboHud.max = 2;
      comboHud.hits = since <= CHAIN_MS ? this.step : 0;
      comboHud.window = since <= CHAIN_MS ? 1 - since / CHAIN_MS : 0;
    } else {
      beamHud.charge = 1 - this.specialCd / DASH_CD;
      beamHud.firing = this.state === 'dash' || this.state === 'spin';
      comboHud.max = 2;
      comboHud.hits = this.stacks;
      comboHud.window = this.stacks > 0 ? this.stackT / STACK_MS : 0;
    }
    beamHud.over = 0;
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    const a = this.vanished ? 0 : this.alpha;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(a);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(a);
    this.shadow.setPosition(rx, ry - 1).setAlpha(a);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * a);
  }
}
