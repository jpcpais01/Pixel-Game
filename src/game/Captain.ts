import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { CAPTAIN_CHEST_Y, CAPTAIN_H, CAPTAIN_MUZZLE, CAPTAIN_ORIGIN_X, CAPTAIN_ORIGIN_Y, CAPTAIN_W } from '../art/captain';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { Phase, PHASE_SPEED } from './phase';
import { HitSpark, SlashArc, type Effect, type Scheme } from './Slash';
import { bloom, clamp01, dither, flare, Fx, Ink, pal, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Drowned Captain (the Phantom's third type): a pirate captain's ghost
// risen from the deep, a cutlass in one hand and a flintlock in the other.
//  - Attack (held): two cutlass strokes, forehand and backhand, then the
//    flintlock: a ghostly ball that flies far and strikes the first foe it
//    meets, leaving a puff of green smoke.
//  - Ability: Boarding hook. He hurls a grappling hook the way he aims; if it
//    bites into a foe the rope hauls him through the air to it (passing
//    through anything between) and he lands with a heavy cut. If it catches
//    nothing it's reeled back, and comes ready again sooner.
//  - Special: Ghost Ship (see ultimate/captain.ts).
// Like every Phantom he phases through the next blow (see phase.ts).
// The Bone Admiral plays the same, lit violet.

/** Each move's frames over its rate, so its timing matches its animation. */
const SLASH_MS = (4 / 14) * 1000;
/** The stroke lands on its second frame. */
const SLASH_HIT = (1 / 14) * 1000;
const SHOT_MS = (5 / 13) * 1000;
const SHOT_FIRE = (1 / 13) * 1000;
const COMBO_WINDOW = 520;
const SLASH_DAMAGE = 9;
const SLASH_REACH = 22;
const SLASH_SPREAD = (110 * Math.PI) / 180;
const SHOT_DAMAGE = 16;
const SHOT_RANGE = 180;
const SHOT_SPEED = 330;
/** The ball finds a foe within this much of the aim. */
const SHOT_CONE = Math.cos((22 * Math.PI) / 180);

const HOOK_MS = (5 / 14) * 1000;
/** The hook leaves his hand on the throw's fourth frame. */
const HOOK_RELEASE = (3 / 14) * 1000;
const HOOK_RANGE = 125;
const HOOK_SPEED = 380;
const HOOK_BACK = 460;
/** How close the hook must pass a body to bite. */
const HOOK_BITE = 5;
const HAUL_SPEED = 300;
/** How high he's swung at the middle of the haul. */
const HAUL_ARC = 12;
/** A haul gives up after this long (a foe that keeps running). */
const HAUL_MAX = 900;
const BOARD_DAMAGE = 26;
const BOARD_R = 22;
const HOOK_COOLDOWN = 6000;
const HOOK_MISS_COOLDOWN = 2500;

type State = 'free' | 'slash' | 'shoot' | 'hook' | 'haul' | 'land';

export interface CaptainKit {
  key: string;
  admiral: boolean;
  maxHp: number;
  speed: number;
  /** The ghost-light of his blows, the ball, the hook and the Special. */
  pal: Pal;
  /** The cutlass's sweep, and its heavy boarding cut. */
  steel: Scheme;
  cut: Scheme;
  /** The gun smoke. */
  smoke: number[];
}

export const CAPTAIN_KIT: CaptainKit = {
  key: 'captain',
  admiral: false,
  maxHp: HERO_STATS['phantom.captain'].hp,
  speed: HERO_STATS['phantom.captain'].speed,
  pal: pal(0xeafff6, 0x8af0d0, 0x3ac0a0, 0x0e4a40, 0x50e0b0),
  steel: { core: 0xffffff, hot: 0xd8fff2, mid: 0x7ae0c0, deep: 0x2a8a74, light: 0x60e8c0 },
  cut: { core: 0xf4fffa, hot: 0x9affd8, mid: 0x3ac8a0, deep: 0x126a56, light: 0x50e0b0 },
  smoke: [0x6abaa4, 0x3e8a76, 0x245e50],
};

export const ADMIRAL_KIT: CaptainKit = {
  ...CAPTAIN_KIT,
  key: 'captain_admiral',
  admiral: true,
  pal: pal(0xf6eeff, 0xd0b0ff, 0x9a6ae8, 0x3a1e6a, 0xb890ff),
  steel: { core: 0xffffff, hot: 0xf0e8ff, mid: 0xb8a0f0, deep: 0x5a3aa8, light: 0xc0a0ff },
  cut: { core: 0xfbf6ff, hot: 0xd8c0ff, mid: 0x9a6ae8, deep: 0x40207a, light: 0xb890ff },
  smoke: [0x8a74c0, 0x5c468e, 0x3a2a62],
};

const SWINGS = ['slash1', 'slash2', 'shoot'] as const;

export class Captain implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: CaptainKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private aura: Phaser.GameObjects.Light;
  private phase: Phase;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private clock = 0;
  private moveT = 0;
  private landed = false;
  private step = 0;
  private lastSwingAt = -99999;
  private hookCd = 0;
  private prevSpecial = false;
  private fx: Effect[] = [];
  /** The hook and its rope, while it's out. */
  private hook: { x: number; y: number; ux: number; uy: number; out: number; back: boolean; foe: Hurtbox | null } | null = null;
  private rope: Ink;
  /** The haul: where it started, how long so far, where he was put last frame (to tell when a wall stopped him). */
  private haulT = 0;
  private haulFrom = { x: 0, y: 0, d: 1 };
  private expect: { x: number; y: number } | null = null;
  private lift = 0;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: CaptainKit = CAPTAIN_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = CAPTAIN_ORIGIN_X / CAPTAIN_W;
    const oy = CAPTAIN_ORIGIN_Y / CAPTAIN_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(0.85, 0.75);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 60, kit.pal.light, 0);
    this.phase = new Phase(world, this, kit.pal.hot);
    this.rope = new Ink(world, HOOK_RANGE * 2 + 48, HOOK_RANGE * 2 + 48);
    this.body.play(`${key}_idle_down`);
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.phase.destroy();
      this.rope.destroy();
      for (const e of this.fx) e.destroy();
    });
  }

  dodge(): boolean {
    // Swung through the air on the rope, nothing can find him.
    if (this.state === 'haul') return true;
    return this.phase.dodge();
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.hookCd = Math.max(0, this.hookCd - dt);
    this.phase.update(dt);
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;

    if (this.state === 'haul') this.updateHaul(dt);
    else {
      if (this.state !== 'free') this.updateMove(dt);
      if (this.state === 'free' && !this.hook) {
        if (pressed && this.hookCd === 0) this.throwHook();
        else if (attack) this.startSwing();
      }
      const k = this.state === 'free' ? (this.hook ? 0.5 : 1) : this.state === 'hook' ? 0.3 : 0.55;
      const speed = this.kit.speed * k * (this.phase.active ? PHASE_SPEED : 1) * Math.min(1, len);
      if (moving && this.state !== 'land') {
        this.x = Phaser.Math.Clamp(this.x + (mx / len) * speed * (dt / 1000), bounds.left, bounds.right);
        this.y = Phaser.Math.Clamp(this.y + (my / len) * speed * (dt / 1000), bounds.top, bounds.bottom);
      }
      if (this.state === 'free') {
        if (this.hook) this.dir = dirOf(this.hook.x - this.x, this.hook.y + CAPTAIN_CHEST_Y - this.y);
        else if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
        else if (moving) this.dir = dirOf(mx, my);
        const key = moving ? `${this.kit.key}_move_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
        if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
      }
    }
    if (this.hook) this.updateHook(dt);
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.sync();
    this.drawRope();
    this.updateHud();
  }

  // -------------------------------------------------------------------------
  // Cutlass and pistol

  private startSwing(): void {
    const chain = this.step > 0 && this.step < 3 && this.clock - this.lastSwingAt <= COMBO_WINDOW + SLASH_MS;
    this.step = chain ? this.step + 1 : 1;
    this.lastSwingAt = this.clock;
    const s = SWINGS[this.step - 1];
    this.state = s === 'shoot' ? 'shoot' : 'slash';
    this.moveT = 0;
    this.landed = false;
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_${s}_${this.dir}`, true);
    if (s !== 'shoot') sound.swing(this.step, this.world.pan(this.x));
  }

  private updateMove(dt: number): void {
    this.moveT += dt;
    if (this.state === 'slash' || this.state === 'land') {
      if (!this.landed && this.moveT >= SLASH_HIT) {
        this.landed = true;
        if (this.state === 'slash') this.cut(this.step === 2 ? -1 : 1);
      }
      if (this.moveT >= SLASH_MS) this.state = 'free';
    } else if (this.state === 'shoot') {
      if (!this.landed && this.moveT >= SHOT_FIRE) {
        this.landed = true;
        this.fire();
      }
      if (this.moveT >= SHOT_MS) this.state = 'free';
    } else if (this.state === 'hook') {
      if (!this.landed && this.moveT >= HOOK_RELEASE) {
        this.landed = true;
        this.release();
      }
      if (this.moveT >= HOOK_MS) this.state = 'free';
    }
  }

  /** A cutlass stroke: a sweep of ghost-lit steel in front of him (`way` sets which way round). */
  private cut(way: number): void {
    const w = this.world;
    const u = this.aimVec();
    const cx = snap(this.x);
    const cy = snap(this.y) - 12;
    const deg = (Math.atan2(u.y, u.x) * 180) / Math.PI;
    const hand = this.dir === 'right' ? -1 : 1;
    const sweep = way * hand;
    this.fx.push(new SlashArc(w, cx, cy, deg + sweep * 100, deg - sweep * 100, 17, this.kit.steel, snap(this.y), 190));
    const hits = w.melee({ kind: 'arc', x: cx, y: cy, radius: SLASH_REACH, angle: Math.atan2(u.y, u.x), spread: SLASH_SPREAD }, { damage: SLASH_DAMAGE, knock: 70 });
    for (const h of hits) {
      this.fx.push(new HitSpark(w, h.x, h.y, this.kit.steel, h.y + 13, false));
      w.debris([this.kit.pal.core, this.kit.pal.hot, this.kit.pal.mid], h.x, h.y, 4, h.y + 12, 'burst');
    }
    if (hits.length) {
      sound.katanaHit(w.pan(cx), false);
      w.cameras.main.shake(60, 0.0003);
    }
  }

  /** The flintlock fires: a ghostly ball from the muzzle at the foe along the aim, smoke left hanging. */
  private fire(): void {
    const w = this.world;
    const u = this.aimVec();
    const side = this.dir === 'left' || this.dir === 'right';
    const m = CAPTAIN_MUZZLE[side ? 'side' : this.dir === 'up' ? 'up' : 'down'];
    const mx = this.x + (this.dir === 'right' ? -m.x : m.x);
    const my = this.y + m.y;
    // Straight along the aim, or at the chest of a foe close to it.
    const foe = this.pick(u, mx, my);
    let vx = u.x;
    let vy = u.y;
    if (foe) {
      const dx = foe.x - mx;
      const dy = foe.y - foe.bodyY - my;
      const d = Math.hypot(dx, dy) || 1;
      vx = dx / d;
      vy = dy / d;
    }
    w.addEffect(new PistolBall(w, mx, my, vx, vy, this.kit));
    w.addEffect(new GunSmoke(w, mx, my, vx, vy, this.kit, false));
    bloom(w, mx, my, this.kit.pal.hot, 0.9, 160, my + 30);
    flare(w, mx, my, 70, this.kit.pal.light, 1.6, 160);
    w.cameras.main.shake(50, 0.0003);
    sound.turretShot(w.pan(mx));
  }

  private pick(u: { x: number; y: number }, x: number, y: number): Hurtbox | null {
    let best: Hurtbox | null = null;
    let bestD = Infinity;
    for (const h of this.world.hurtboxesWhere((b) => b.alive)) {
      const dx = h.x - x;
      const dy = h.y - h.bodyY - y;
      const d = Math.hypot(dx, dy);
      if (d > SHOT_RANGE || d === 0 || (dx * u.x + dy * u.y) / d < SHOT_CONE) continue;
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // The boarding hook

  private throwHook(): void {
    this.state = 'hook';
    this.moveT = 0;
    this.landed = false;
    this.step = 0;
    this.hookCd = HOOK_COOLDOWN;
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_hook_${this.dir}`, true);
    sound.whirl(this.world.pan(this.x));
  }

  /** The hook leaves his hand, flying the way he aims. */
  private release(): void {
    const u = this.aimVec();
    const h = this.handAt();
    this.hook = { x: h.x, y: h.y, ux: u.x, uy: u.y, out: 0, back: false, foe: null };
    sound.toss(this.world.pan(h.x), true);
  }

  /** Where the rope leaves him: his throwing hand, about chest high. */
  private handAt(): { x: number; y: number } {
    const side = this.dir === 'left' ? -1 : this.dir === 'right' ? 1 : 0;
    return { x: this.x + side * 6 + (this.dir === 'down' ? 2 : this.dir === 'up' ? -2 : 0), y: this.y - CAPTAIN_CHEST_Y - this.lift };
  }

  private updateHook(dt: number): void {
    const k = this.hook!;
    const w = this.world;
    if (k.foe) {
      // Bitten in: it rides on the foe.
      k.x = k.foe.x;
      k.y = k.foe.y - k.foe.bodyY;
      return;
    }
    const hand = this.handAt();
    if (k.back) {
      const dx = hand.x - k.x;
      const dy = hand.y - k.y;
      const d = Math.hypot(dx, dy);
      const s = (HOOK_BACK * dt) / 1000;
      if (d <= s + 2) {
        this.hook = null;
        this.hookCd = Math.min(this.hookCd, HOOK_MISS_COOLDOWN);
        return;
      }
      k.x += (dx / d) * s;
      k.y += (dy / d) * s;
      return;
    }
    const s = (HOOK_SPEED * dt) / 1000;
    const steps = Math.ceil(s / 4);
    for (let i = 0; i < steps; i++) {
      k.x += (k.ux * s) / steps;
      k.y += (k.uy * s) / steps;
      k.out += s / steps;
      const foe = w.firstHurtbox((h) => h.alive && Math.hypot(h.x - k.x, h.y - h.bodyY - k.y) <= h.radius + HOOK_BITE);
      if (foe) {
        this.bite(foe);
        return;
      }
      if (k.out >= HOOK_RANGE) {
        k.back = true;
        w.debris(this.kit.pal.tints, k.x, k.y, 3, k.y + 20, 'spores');
        return;
      }
    }
    if (Math.floor(this.clock / 40) !== Math.floor((this.clock - dt) / 40)) w.debris([this.kit.pal.hot, this.kit.pal.mid], k.x, k.y, 1, k.y + 20, 'trail');
  }

  /** The hook bites into a foe: the rope goes taut and hauls him to it. */
  private bite(foe: Hurtbox): void {
    const w = this.world;
    const k = this.hook!;
    k.foe = foe;
    w.debris(this.kit.pal.tints, foe.x, foe.y - foe.bodyY, 6, foe.y + 10, 'burst');
    this.fx.push(new HitSpark(w, foe.x, foe.y - foe.bodyY, this.kit.steel, foe.y + 13, false));
    sound.knifeHit(w.pan(foe.x), true);
    this.state = 'haul';
    this.haulT = 0;
    const d = Math.hypot(foe.x - this.x, foe.y - this.y) || 1;
    this.haulFrom = { x: this.x, y: this.y, d };
    this.expect = null;
    this.dir = dirOf(foe.x - this.x, foe.y - this.y);
    this.body.play(`${this.kit.key}_leap_${this.dir}`, true);
    w.evade(HAUL_MAX + 300);
    sound.windDash(w.pan(this.x));
  }

  /** Hauled along the rope through the air, through anything between, to the foe. */
  private updateHaul(dt: number): void {
    const w = this.world;
    const foe = this.hook?.foe ?? null;
    this.haulT += dt;
    // The world pushed him back off something he can't pass: he lands where he is.
    const stopped = this.expect && Math.hypot(this.x - this.expect.x, this.y - this.expect.y) > 2;
    if (!foe || !foe.alive || stopped || this.haulT >= HAUL_MAX) {
      this.board(foe);
      return;
    }
    const dx = foe.x - this.x;
    const dy = foe.y - this.y;
    const d = Math.hypot(dx, dy);
    const reach = foe.radius + 9;
    if (d <= reach) {
      this.board(foe);
      return;
    }
    const s = Math.min(d - reach + 1, (HAUL_SPEED * dt) / 1000);
    this.x += (dx / d) * s;
    this.y += (dy / d) * s;
    this.expect = { x: this.x, y: this.y };
    const done = clamp01(1 - (d - s - reach) / Math.max(1, this.haulFrom.d - reach));
    this.lift = Math.sin(done * Math.PI) * HAUL_ARC;
    w.evade(200);
    if (Math.floor(this.haulT / 30) !== Math.floor((this.haulT - dt) / 30)) w.debris(this.kit.pal.tints, this.x, this.y - CAPTAIN_CHEST_Y - this.lift, 1, this.y + 10, 'trail');
  }

  /** He lands among them: a heavy cut through everything round the foe. */
  private board(foe: Hurtbox | null): void {
    const w = this.world;
    this.hook = null;
    this.lift = 0;
    this.expect = null;
    const tx = foe && foe.alive ? foe.x : this.x;
    const ty = foe && foe.alive ? foe.y : this.y;
    const u = { x: tx - this.x, y: ty - this.y };
    const l = Math.hypot(u.x, u.y);
    if (l > 1) this.lastMove.set(u.x / l, u.y / l);
    const cx = (this.x + tx) / 2;
    const cy = (this.y + ty) / 2 - 10;
    const hits = w.melee({ kind: 'circle', x: cx, y: cy, radius: BOARD_R }, { damage: BOARD_DAMAGE, heavy: true, knock: 160, fromX: this.x, fromY: this.y });
    const deg = l > 1 ? (Math.atan2(u.y, u.x) * 180) / Math.PI : 90;
    this.fx.push(new SlashArc(w, snap(cx), snap(cy), deg - 130, deg + 130, 22, this.kit.cut, snap(ty), 260));
    for (const h of hits) {
      this.fx.push(new HitSpark(w, h.x, h.y, this.kit.cut, h.y + 13, true));
      w.debris(this.kit.pal.tints, h.x, h.y, 6, h.y + 12, 'burst');
    }
    w.debris([0xffffff, ...this.kit.pal.tints], cx, this.y, 12, this.y + 4, 'burst');
    bloom(w, cx, cy, this.kit.pal.hot, 1.8, 300, this.y + 30);
    flare(w, cx, cy, 120, this.kit.pal.light, 2.2, 300);
    w.cameras.main.shake(150, 0.0011);
    sound.katanaHit(w.pan(cx), true);
    sound.splash(w.pan(cx));
    w.evade(250);
    this.state = 'land';
    this.moveT = 0;
    this.landed = true;
    this.dir = l > 1 ? dirOf(u.x, u.y) : this.dir;
    this.body.play(`${this.kit.key}_slash1_${this.dir}`, true);
  }

  /** The rope from his hand to the hook, and the hook itself, drawn in ghost-light. */
  private drawRope(): void {
    const k = this.hook;
    const g = this.rope;
    const hand = this.handAt();
    g.begin(this.x, this.y - CAPTAIN_CHEST_Y, this.y + (k && k.y > hand.y ? 30 : -2));
    if (!k) {
      g.end();
      return;
    }
    const p = this.kit.pal;
    const dx = k.x - hand.x;
    const dy = k.y - hand.y;
    const d = Math.hypot(dx, dy);
    const n = Math.max(2, Math.ceil(d));
    // Slack while it flies or comes back, taut once it bites.
    const sag = k.foe ? 0 : Math.min(8, d * 0.08) * (k.back ? 1.4 : 1);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = hand.x + dx * t;
      const y = hand.y + dy * t + Math.sin(t * Math.PI) * sag;
      if (dither(Math.round(x), Math.round(y)) > 0.9) continue;
      g.put(x, y, (i + Math.floor(this.clock / 60)) % 3 === 0 ? p.core : p.mid, 0.95);
    }
    // The hook: a shank, three tines, glowing.
    const ux = k.foe ? dx / (d || 1) : k.ux;
    const uy = k.foe ? dy / (d || 1) : k.uy;
    for (let i = 0; i <= 4; i++) g.put(k.x - ux * i, k.y - uy * i, i < 2 ? p.core : p.hot);
    g.put(k.x - ux * 5 - uy, k.y - uy * 5 + ux, p.mid);
    g.put(k.x - ux * 5 + uy, k.y - uy * 5 - ux, p.mid);
    for (const s of [-1, 1]) {
      g.put(k.x - uy * s * 1.5, k.y + ux * s * 1.5, p.hot);
      g.put(k.x - uy * s * 2.5 - ux, k.y + ux * s * 2.5 - uy, p.hot);
      g.put(k.x - uy * s * 2.8 - ux * 2, k.y + ux * s * 2.8 - uy * 2, p.mid);
    }
    g.put(k.x + ux, k.y + uy, p.core);
    g.end();
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.hookCd / HOOK_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'haul' || !!this.hook;
    const since = this.clock - this.lastSwingAt;
    comboHud.hits = this.step;
    comboHud.max = 3;
    comboHud.window = this.step === 0 ? 0 : this.step < 3 ? Math.max(0, 1 - since / (COMBO_WINDOW + SLASH_MS)) : Math.max(0, 1 - since / 700);
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const lift = snap(this.lift);
    const frame = this.body.frame.name;
    const a = this.alpha * this.phase.opacity;
    this.body.setPosition(rx, ry - lift).setDepth(ry).setAlpha(a);
    this.glowLayer.setPosition(rx, ry - lift).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    // He floats: a soft shadow, a little off the ground, shrinking as he's swung up.
    const s = 1 - this.lift / (HAUL_ARC * 3);
    this.shadow.setPosition(rx, ry - 1).setScale(0.85 * s, 0.75 * s).setAlpha(this.alpha * 0.55);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * a * 0.6);
    this.aura.setPosition(rx, ry - 16 - lift);
    this.aura.intensity = 0.6 * (1 - this.daylight) + 0.2;
  }
}

/**
 * The flintlock's ball: a ghostly shot flying straight and fast, a streak of
 * ghost-light behind it; it strikes the first body it meets with a burst and
 * a puff of smoke, or fizzles out at the end of its range.
 */
class PistolBall extends Fx {
  private g: Ink;
  private lamp: Phaser.GameObjects.Light;
  private travelled = 0;
  private trail: { x: number; y: number }[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private vx: number,
    private vy: number,
    private kit: CaptainKit,
  ) {
    super(world, 2000);
    this.g = this.ink(40, 40);
    this.lamp = this.light(x, y, 40, kit.pal.light, 0.9);
  }

  protected step(dt: number): void {
    const w = this.world;
    const s = (SHOT_SPEED * dt) / 1000;
    const steps = Math.ceil(s / 4);
    for (let i = 0; i < steps; i++) {
      this.x += (this.vx * s) / steps;
      this.y += (this.vy * s) / steps;
      this.travelled += s / steps;
      this.trail.push({ x: this.x, y: this.y });
      if (w.strikeAt(this.x, this.y, { damage: SHOT_DAMAGE, heavy: true, knock: 110, fromX: this.x - this.vx * 10, fromY: this.y - this.vy * 10 })) {
        this.burst(true);
        return;
      }
    }
    if (this.travelled >= SHOT_RANGE) {
      this.burst(false);
      return;
    }
    if (this.trail.length > 14) this.trail.splice(0, this.trail.length - 14);
    const p = this.kit.pal;
    const g = this.g.begin(this.x, this.y, this.y + CAPTAIN_CHEST_Y + 2);
    this.trail.forEach((q, i) => {
      const k = i / this.trail.length;
      if (dither(Math.round(q.x), Math.round(q.y)) > k * 1.1) return;
      g.put(q.x, q.y, k > 0.7 ? p.hot : k > 0.4 ? p.mid : p.deep, 0.9);
    });
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.put(this.x + dx - 0.5, this.y + dy - 0.5, p.core);
    for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [0, 2], [-1, 1], [2, 1], [1, -1], [1, 2]]) g.put(this.x + dx - 0.5, this.y + dy - 0.5, p.hot, 0.8);
    g.end();
    this.lamp.setPosition(this.x, this.y);
  }

  private burst(hit: boolean): void {
    const w = this.world;
    const p = this.kit.pal;
    w.debris([0xffffff, p.core, p.hot, p.mid], this.x, this.y, hit ? 10 : 5, this.y + CAPTAIN_CHEST_Y + 4, 'burst');
    w.addEffect(new GunSmoke(w, this.x, this.y, -this.vx, -this.vy, this.kit, true));
    if (hit) {
      bloom(w, this.x, this.y, p.hot, 1.2, 220, this.y + 40);
      sound.arrowHit(w.pan(this.x), true);
    }
    this.destroy();
  }
}

/** A puff of ghostly gun smoke: a few round clouds swelling, drifting up and thinning away. */
class GunSmoke extends Fx {
  private g: Ink;
  private puffs: { x: number; y: number; r: number; vx: number; vy: number; c: number }[] = [];

  constructor(world: WorldScene, x: number, y: number, dx: number, dy: number, kit: CaptainKit, small: boolean) {
    super(world, small ? 600 : 900);
    this.g = this.ink(48, 48);
    const n = small ? 3 : 5;
    for (let i = 0; i < n; i++) {
      this.puffs.push({
        x: x + dx * i * 2,
        y: y + dy * i * 2,
        r: (small ? 1.6 : 2) + Math.random() * 1.2,
        vx: dx * (10 + i * 6) + (Math.random() - 0.5) * 8,
        vy: dy * (10 + i * 6) - 10 - Math.random() * 8,
        c: kit.smoke[i % kit.smoke.length],
      });
    }
    this.x0 = x;
    this.y0 = y;
  }

  private x0: number;
  private y0: number;

  protected step(dt: number): void {
    const s = dt / 1000;
    const k = this.t / this.life;
    const g = this.g.begin(this.x0, this.y0 - 6, this.y0 + CAPTAIN_CHEST_Y + 6);
    for (const q of this.puffs) {
      q.x += q.vx * s;
      q.y += q.vy * s;
      q.vx *= 1 - Math.min(1, s * 3);
      q.vy *= 1 - Math.min(1, s * 2);
      q.vy -= 6 * s;
      const r = q.r * (1 + k * 1.6);
      for (let dy = -Math.ceil(r); dy <= r; dy++) {
        for (let dx = -Math.ceil(r); dx <= r; dx++) {
          const d = Math.hypot(dx, dy) / r;
          if (d > 1) continue;
          const X = Math.round(q.x + dx);
          const Y = Math.round(q.y + dy);
          if (dither(X, Y) > (1 - k) * (1.2 - d * 0.6)) continue;
          g.put(X, Y, q.c, 0.85);
        }
      }
    }
    g.end();
  }
}
