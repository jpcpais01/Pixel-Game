import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { CHEST_Y, FACING_DEG, HIT_FRAME, WARRIOR_H, WARRIOR_ORIGIN_X, WARRIOR_ORIGIN_Y, WARRIOR_W } from '../art/warrior';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { HitSpark, Shockwave, SlashArc, type Effect, type Scheme } from './Slash';
import { bindFoe } from './Strings';
import { bloom, clamp01, easeOut, flare, Fx, GROUND, pal, ring, strikeGround, type Ink, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The King: the warrior's second type, on the warrior's rig in looks of his
// own (art/warrior.ts, the `king` flag): a crown, an ermine mantle and a
// broad greatsword he rests on point-down.
//  - The attack is a slower, heavier chain than the Knight's: a forehand, a
//    backhand, then a great overhead chop that strikes the ground before him
//    in a burst of light.
//  - The ability is the Royal Decree: he raises the greatsword to the sky and
//    a ring of light rolls out from him. Every foe it reaches is struck and
//    brought to its knees, held where it stands for a moment (bosses shrug
//    that off), and he is warded by a barrier for each foe that kneels.

/** The chain of blows: the animations it plays, in order. */
const CHAIN = ['slash1', 'slash2', 'smite'] as const;
/** A blow chains into the next if it starts within this long of the last. */
const COMBO_WINDOW = 2000;

const SLASH = { reach: 24, spread: (120 * Math.PI) / 180, damage: 12 };
/** The chop lands this far in front of his feet, striking all round that spot. */
const SMITE = { ahead: 19, radius: 18, damage: 22, knock: 160 };

// The Royal Decree.
const DECREE_RADIUS = 46;
const DECREE_DAMAGE = 12;
const KNEEL_MS = 1400;
/** Barrier for casting it, and more for each foe brought to its knees. */
const DECREE_WARD = 12;
const WARD_PER_FOE = 6;
const BARRIER_MAX = 40;
/** The Sun King's decree: how many rays turn round the crown, and from how far out to how far. */
const SUN_RAYS = 8;
const SUN_RAY_IN = 5;
const SUN_RAY_OUT = 9;

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'swing' | 'decree';

/** How a King look plays and what colour its light is. */
export interface KingKit {
  /** Texture and animation key. */
  key: string;
  maxHp: number;
  /** Walking speed, world px / second. */
  speed: number;
  /** The forehand and backhand. */
  swing: Scheme;
  /** The chop and the decree. */
  heavy: Scheme;
  /** The decree's light, drawn in pixels. */
  pal: Pal;
  /** The faint light around him at night. */
  aura: number;
  specialCooldown: number;
  /** The decree's crown blazes with a ring of sun rays turning round it. */
  rays?: boolean;
}

const kingStats = HERO_STATS['warrior.king'];

export const KING_KIT: KingKit = {
  key: 'warrior_king',
  maxHp: kingStats.hp,
  speed: kingStats.speed,
  swing: { core: 0xffffff, hot: 0xfff6dc, mid: 0xf4d890, deep: 0xb8862a },
  heavy: { core: 0xfffdf0, hot: 0xffe8a0, mid: 0xf4c040, deep: 0x7a2a9a, light: 0xffd870 },
  pal: pal(0xfffdf0, 0xffe8a0, 0xf4c040, 0x7a2a9a, 0xffd870),
  aura: 0xffe0b0,
  specialCooldown: 7000,
};

/** Afonso Henriques: silver and the blue of his cross. */
export const AFONSO_KIT: KingKit = {
  ...KING_KIT,
  key: 'warrior_afonso',
  swing: { core: 0xffffff, hot: 0xeef4ff, mid: 0xb0c8f0, deep: 0x4a6ab0 },
  heavy: { core: 0xffffff, hot: 0xd8e8ff, mid: 0x5a8aff, deep: 0x1a3a9a, light: 0x8ab0ff },
  pal: pal(0xffffff, 0xd8e8ff, 0x5a8aff, 0x1a3a9a, 0x8ab0ff),
  aura: 0xd0e0ff,
};

/** The Sun King: radiant gold cuts with a royal-blue depth, and a decree that shines like the sun. */
export const SUNKING_KIT: KingKit = {
  ...KING_KIT,
  key: 'warrior_sunking',
  swing: { core: 0xffffff, hot: 0xfff4c0, mid: 0xffd050, deep: 0x2a4ab8 },
  heavy: { core: 0xfffff0, hot: 0xffe680, mid: 0xffb820, deep: 0x1a3a9a, light: 0xffd870 },
  pal: pal(0xfffff0, 0xffe680, 0xffb820, 0x1a3a9a, 0xffd870),
  aura: 0xffe8a0,
  rays: true,
};

export class King implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals: Vitals;
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: KingKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private aura: Phaser.GameObjects.Light;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private clock = 0;
  private cooldown = 0;
  private specialCd = 0;

  // The chain of blows.
  private step = 0;
  private lastSwingAt = -Infinity;
  private struck = false;
  private buffered = false;
  private prevAttack = false;
  private dash = { vx: 0, vy: 0, t: 0 };

  private fx: Effect[] = [];

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: KingKit = KING_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp, BARRIER_MAX);
    const key = kit.key;
    this.x = x;
    this.y = y;
    const ox = WARRIOR_ORIGIN_X / WARRIOR_W;
    const oy = WARRIOR_ORIGIN_Y / WARRIOR_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 56, kit.aura, 0);
    this.body.play(`${key}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      const k = anim.key;
      if (this.state === 'swing' && CHAIN.some((s) => k.startsWith(`${key}_${s}_`))) {
        this.state = 'free';
        this.cooldown = this.step === 3 ? 180 : 30;
        this.idle();
      } else if (this.state === 'decree' && k.startsWith(`${key}_decree_`)) {
        this.state = 'free';
        this.cooldown = 120;
        this.idle();
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && FOOTFALLS.has(frame.index - 1)) sound.step();
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

    // A tap during a blow queues the next, so quick taps chain cleanly.
    const pressed = attack && !this.prevAttack;
    this.prevAttack = attack;
    if (pressed && this.state === 'swing') this.buffered = true;

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.startDecree();
      else if (attack || this.buffered) this.startSwing();
    }

    const pace = this.kit.speed;
    const speed = { free: pace * Math.min(1, len), swing: pace * 0.3, decree: pace * 0.15 }[this.state];
    let vx = moving ? (mx / len) * speed : 0;
    let vy = moving ? (my / len) * speed : 0;
    if (this.dash.t > 0) {
      vx += this.dash.vx;
      vy += this.dash.vy;
      this.dash.t -= dt;
    }
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_walk_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      const f = this.body.anims.currentFrame;
      const hitAt = HIT_FRAME[this.state === 'decree' ? 'decree' : CHAIN[this.step - 1]];
      if (!this.struck && f && f.index - 1 >= hitAt) {
        this.struck = true;
        if (this.state === 'decree') this.proclaim();
        else this.land();
      }
    }

    this.sync();
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.updateHud();
  }

  private idle(): void {
    this.body.play(`${this.kit.key}_idle_${this.dir}`);
  }

  // -------------------------------------------------------------------------
  // The chain of blows

  private startSwing(): void {
    const chain = this.step > 0 && this.step < 3 && this.clock - this.lastSwingAt <= COMBO_WINDOW;
    this.step = chain ? this.step + 1 : 1;
    this.lastSwingAt = this.clock;
    this.buffered = false;
    this.struck = false;
    this.state = 'swing';
    this.dir = this.aimDir();
    this.body.play(`${this.kit.key}_${CHAIN[this.step - 1]}_${this.dir}`);
    sound.swing(this.step, this.world.pan(this.x));
    if (this.step < 3) {
      const u = this.facing();
      this.dash = { vx: u.x * 36, vy: u.y * 36, t: 110 };
    }
  }

  /** The blow lands: draw it and strike whatever the greatsword reaches. */
  private land(): void {
    const cx = snap(this.x);
    const cy = snap(this.y) - CHEST_Y;
    const feet = snap(this.y);
    const u = this.facing();
    const w = this.world;
    if (this.step === 3) {
      // The chop: a burst of light where the blade strikes the ground.
      const gx = cx + u.x * SMITE.ahead;
      const gy = feet + u.y * SMITE.ahead * 0.8;
      this.fx.push(new Shockwave(w, gx, gy - 1, SMITE.radius + 4, this.kit.heavy));
      w.debris([this.kit.heavy.hot, this.kit.heavy.mid, 0x8a7a68], gx, gy - 2, 10, gy + 20, 'burst');
      bloom(w, gx, gy - 6, this.kit.heavy.hot, 1.4, 260, gy + 10);
      const hits = w.melee({ kind: 'circle', x: gx, y: gy - CHEST_Y * 0.6, radius: SMITE.radius }, { damage: SMITE.damage, heavy: true, knock: SMITE.knock, fromX: cx, fromY: feet });
      this.impact(hits, this.kit.heavy, true);
      sound.slam(w.pan(gx));
      w.cameras.main.shake(150, 0.0008);
      return;
    }
    // Forehand and backhand sweep opposite ways; mirrored frames swap the sword hand.
    const deg = FACING_DEG[this.dir];
    const hand = this.dir === 'right' ? -1 : 1;
    const sweep = this.step === 1 ? hand : -hand;
    this.fx.push(new SlashArc(w, cx, cy, deg + sweep * 105, deg - sweep * 105, 20, this.kit.swing, feet));
    const hits = w.melee({ kind: 'arc', x: cx, y: cy, radius: SLASH.reach, angle: (deg * Math.PI) / 180, spread: SLASH.spread / 2 }, { damage: SLASH.damage, knock: 80 });
    this.impact(hits, this.kit.swing, false);
  }

  private impact(hits: { x: number; y: number }[], scheme: Scheme, heavy: boolean): void {
    for (const h of hits) {
      this.fx.push(new HitSpark(this.world, h.x, h.y, scheme, h.y + 13, heavy));
      sound.clash(this.world.pan(h.x), heavy);
    }
    if (hits.length) this.world.cameras.main.shake(heavy ? 110 : 70, heavy ? 0.0005 : 0.0003);
  }

  // -------------------------------------------------------------------------
  // The Royal Decree

  private startDecree(): void {
    this.state = 'decree';
    this.step = 0;
    this.struck = false;
    this.dir = this.aimDir();
    this.body.play(`${this.kit.key}_decree_${this.dir}`);
    sound.rise();
  }

  /** The sword at its height: the ring rolls out, and all it reaches kneel. */
  private proclaim(): void {
    const w = this.world;
    const x = snap(this.x);
    const y = snap(this.y);
    const struck = strikeGround(w, x, y, DECREE_RADIUS, { damage: DECREE_DAMAGE, heavy: true, knock: 50, fromX: x, fromY: y });
    let knelt = 0;
    for (const h of struck) {
      w.addEffect(new HitSpark(w, h.x, h.y - h.bodyY, this.kit.heavy, h.y + 13, false));
      if (bindFoe(h, KNEEL_MS)) {
        knelt++;
        w.addEffect(new Kneel(w, h, this.kit.pal, KNEEL_MS));
      }
    }
    const v = this.vitals;
    v.barrier = Math.min(v.barrierMax, v.barrier + DECREE_WARD + knelt * WARD_PER_FOE);
    w.addEffect(new Decree(w, this, this.kit.pal, !!this.kit.rays));
    w.cameras.main.shake(160, 0.0009);
    sound.decree(w.pan(x));
    this.specialCd = this.kit.specialCooldown;
  }

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
    beamHud.charge = 1 - this.specialCd / this.kit.specialCooldown;
    beamHud.over = 0;
    beamHud.firing = false;
    const since = this.clock - this.lastSwingAt;
    comboHud.hits = this.step;
    comboHud.window = this.step === 0 ? 0 : this.step < 3 ? Math.max(0, 1 - since / COMBO_WINDOW) : Math.max(0, 1 - since / 700);
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
    this.aura.setPosition(rx, ry - 14);
    this.aura.intensity = 0.55 * (1 - this.daylight);
  }
}

/** A little crown of light, seven pixels wide, its band on row y centred on x. */
export function crownGlyph(g: Ink, x: number, y: number, p: Pal, a = 1): void {
  for (let dx = -3; dx <= 3; dx++) g.put(x + dx, y, dx === 0 ? p.core : p.hot, a);
  for (const [dx, h] of [[-3, 3], [-1, 2], [0, 3], [1, 2], [3, 3]] as const) {
    for (let i = 1; i <= h; i++) g.put(x + dx, y - i, i === h ? p.core : p.mid, a);
  }
}

/** The decree rolling out: a ring of light spreading along the ground from the King, and a crown shining over his head. */
class Decree extends Fx {
  private ground: Ink;
  private head: Ink;
  private lamp: Phaser.GameObjects.Light;

  constructor(
    world: WorldScene,
    private king: { x: number; y: number },
    private p: Pal,
    private rays = false,
  ) {
    super(world, 900);
    this.ground = this.ink(DECREE_RADIUS * 2 + 12, Math.ceil(DECREE_RADIUS * 2 * GROUND + 12));
    this.head = rays ? this.ink(SUN_RAY_OUT * 2 + 3, SUN_RAY_OUT * 2 + 3) : this.ink(11, 7);
    this.lamp = this.light(king.x, king.y - 30, 140, p.light, 1.6);
    flare(world, king.x, king.y - 20, 160, p.light, 3, 500);
    bloom(world, king.x, king.y - 34, p.hot, 1.6, 400, king.y + 30);
    world.debris(p.tints, king.x, king.y - 34, 14, king.y + 20, 'burst');
  }

  protected step(): void {
    const { king, p, t } = this;
    const k = t / 420;
    const fade = 1 - clamp01((t - 500) / 400);
    const x = Math.round(king.x);
    const y = Math.round(king.y);
    const g = this.ground.begin(x, y, 2.6);
    if (k < 1) {
      ring(g, x, y, 4 + (DECREE_RADIUS - 4) * easeOut(k), 2.4 * (1 - k) + 0.8, p, 1 - k * 0.6);
      ring(g, x, y, (DECREE_RADIUS - 10) * easeOut(k * 1.3), 0.7, p, 0.5 * (1 - k), GROUND, 0.5, Math.floor(t / 60));
    }
    g.end();
    // The crown over his head, rising a little as it fades.
    const rise = Math.round(easeOut(t / 900) * 4);
    const h = this.head.begin(x, y - 40 - rise, y + 40);
    if (this.rays) {
      // The Sun King's: rays of sunlight turning slowly round the crown, long and short by turns.
      const turn = t * 0.0015;
      for (let i = 0; i < SUN_RAYS; i++) {
        const a = turn + (i / SUN_RAYS) * Math.PI * 2;
        const out = i % 2 ? SUN_RAY_OUT - 2 : SUN_RAY_OUT;
        for (let r = SUN_RAY_IN; r <= out; r++) {
          h.put(x + Math.round(Math.cos(a) * r), y - 40 - rise + Math.round(Math.sin(a) * r), r === SUN_RAY_IN ? p.hot : p.mid, fade * (1 - (r - SUN_RAY_IN) / (out + 1 - SUN_RAY_IN)));
        }
      }
    }
    crownGlyph(h, x, y - 38 - rise, p, fade);
    h.end();
    this.lamp.setPosition(x, y - 30);
    this.lamp.intensity = 1.6 * fade;
  }
}

/** A foe brought to its knees: a little crown of light over its head until it rises. */
class Kneel extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private h: Hurtbox,
    private p: Pal,
    ms: number,
  ) {
    super(world, ms);
    this.g = this.ink(11, 7);
  }

  protected step(): void {
    const { h, p, t } = this;
    if (!h.alive) {
      this.destroy();
      return;
    }
    const a = Math.min(1, t / 120) * (1 - clamp01((t - (this.life - 250)) / 250));
    const x = Math.round(h.x);
    const y = Math.round(h.y - h.bodyY * 2 - 5 + Math.sin(t * 0.008));
    const g = this.g.begin(x, y - 2, h.y + 1);
    crownGlyph(g, x, y, p, a);
    g.end();
  }
}
