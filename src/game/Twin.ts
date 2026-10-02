import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { TWIN_CHEST_Y, TWIN_FACING_DEG, TWIN_H, TWIN_HIT_FRAME, TWIN_ORIGIN_X, TWIN_ORIGIN_Y, TWIN_W } from '../art/twin';
import { jediMeta } from '../art/heroLoader';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { HitSpark, SlashArc, type Effect, type Scheme } from './Slash';
import { PixelLayer } from './Beam';
import { pal, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Twin Blade: the Jedi class's Jar'Kai duelist, a saber in each hand, on
// a rig of his own (art/twin.ts).
//  - The attack is the Twin flurry: four quick crossing cuts, one hand after
//    the other (the long blade, the shoto, the long blade again), and then
//    the X-cut, both blades brought down together through whatever stands
//    before him, hitting harder and staggering it.
//  - The ability is the Riposte: he crosses both blades before him for a
//    moment. A blow that lands while he holds it glances off the crossing
//    (no harm done) and is answered at once by a shearing counter-cut through
//    everything in front of him. With nothing to parry it comes back sooner.
//  - His Special, Thousand Cuts, is in ultimate/twin.ts.

const stats = HERO_STATS['jedi.twin'];

/** A cut chains into the next if it starts within this long of the previous one. */
const COMBO_WINDOW = 1100;
/** The three quick cuts: a narrow arc each, light. Spreads are half-angles. */
const CUT = { reach: 23, spread: (62 * Math.PI) / 180, damage: 6, knock: 40 };
/** The X-cut: wider, harder, and it staggers. */
const XCUT = { reach: 27, spread: (78 * Math.PI) / 180, damage: 14, knock: 150, reel: 0.45, reelMs: 450 };

// The Riposte.
const RIPOSTE = {
  /** How long the crossed guard is held. */
  stance: 700,
  /** The counter-cut: reach, half-angle, its blow. */
  reach: 30,
  spread: (100 * Math.PI) / 180,
  damage: 22,
  knock: 170,
  /** Foes this near when a blow is turned: he wheels to face the nearest before he answers. */
  turn: 46,
  /** Back after a parry, and sooner after a stance that caught nothing. */
  cooldown: 6000,
  whiff: 3000,
};

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'cut' | 'xcut' | 'guard' | 'counter';
const CHAIN = ['cut1', 'cut2', 'cut3', 'xcut'] as const;
type Swing = (typeof CHAIN)[number];

/** How a Twin Blade look plays: its texture key and the colours of its two blades. */
export interface TwinKit {
  key: string;
  /** The long blade, in his right hand. */
  main: Scheme;
  /** The shoto, in his left. */
  shoto: Scheme;
  /** The blades' light on their surroundings. */
  light: number;
}

export const TWIN_KIT: TwinKit = {
  key: 'jedi_twin',
  main: { core: 0xf6ffff, hot: 0x7aeeff, mid: 0x22d0ec, deep: 0x0a86b0 },
  shoto: { core: 0xfff6fb, hot: 0xff7ac8, mid: 0xea2e9c, deep: 0x9a1064 },
  light: 0x5ae8ff,
};

/** The Peacock: an emerald blade and a sapphire shoto, lighting the ground in jewel green. */
export const PEACOCK_KIT: TwinKit = {
  key: 'jedi_peacock',
  main: { core: 0xf6fff8, hot: 0x86f4ae, mid: 0x22d070, deep: 0x0a8040 },
  shoto: { core: 0xf6f8ff, hot: 0x94b4ff, mid: 0x3a68ff, deep: 0x1430b0 },
  light: 0x40e090,
};

/** A Special's palette from a blade's scheme. */
export const schemeToPal = (s: Scheme): Pal => pal(s.core, s.hot, s.mid, s.deep, s.hot);

export class Twin implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals = new Vitals(stats.hp);
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  /** Gone in a blink (Thousand Cuts): unseen, untouchable, standing still. */
  vanished = false;
  readonly kit: TwinKit;
  private dir: Dir = 'down';
  private world: WorldScene;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  /** The blades' light on the ground around him, following them. */
  private bladeLight: Phaser.GameObjects.Light;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  /** Towards the mouse on a computer (see Hero). */
  private aim: Aim | null = null;
  private clock = 0;
  private cooldown = 0;
  private specialCd = 0;

  private swing: Swing = 'cut1';
  private step = 0;
  private lastSwingAt = -Infinity;
  private struck = false;
  private buffered = false;
  private prevAttack = false;
  private dash = { vx: 0, vy: 0, t: 0 };

  /** The Riposte: time left in the stance, and whether a blow was turned this time. */
  private stanceT = 0;
  private parried = false;
  private flash = 0;
  /** The whole of the cooldown now running, for the button's ring. */
  private cdFull = RIPOSTE.cooldown;

  private fx: Effect[] = [];

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: TwinKit = TWIN_KIT) {
    this.world = world;
    this.kit = kit;
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = TWIN_ORIGIN_X / TWIN_W;
    const oy = TWIN_ORIGIN_Y / TWIN_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.bladeLight = world.lights.addLight(x, y, 52, kit.light, 0);
    this.body.play(`${key}_idle_down`);
    sound.ignite();

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      const k = anim.key;
      if (this.state === 'cut' && /_cut\d_/.test(k)) this.settle(20);
      else if (this.state === 'xcut' && k.startsWith(`${key}_xcut_`)) this.settle(150);
      else if (this.state === 'counter' && k.startsWith(`${key}_counter_`)) this.settle(60);
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    // The HUD's shared state: don't leave it lit, or with four pips, for the next hero.
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
      comboHud.max = 3;
    });
  }

  private settle(cooldown: number): void {
    this.state = 'free';
    this.cooldown = cooldown;
    this.body.play(`${this.kit.key}_idle_${this.dir}`);
  }

  /** A blow is about to land (see Hero): in the stance it glances off the crossed blades and is answered; blinking, nothing touches him. */
  dodge(): boolean {
    if (this.vanished) return true;
    if (this.state === 'counter') return true;
    if (this.state !== 'guard') return false;
    this.riposte();
    return true;
  }

  /** Vanish for Thousand Cuts (ultimate/twin.ts), or step back out of nowhere with both blades flung wide. */
  vanish(on: boolean): void {
    this.vanished = on;
    this.state = 'free';
    this.step = 0;
    this.dash.t = 0;
    if (!on) {
      // The last crossing flash: he lands in the shears' follow-through.
      this.state = 'counter';
      this.body.play(`${this.kit.key}_counter_${this.dir}`);
      this.body.anims.setProgress(0.3);
    }
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);
    this.flash = Math.max(0, this.flash - dt);
    if (this.vanished) {
      // Away blinking from foe to foe: he stands nowhere and does nothing.
      attack = special = false;
      mx = my = 0;
    }
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);

    // A tap during a cut queues the next one, so quick taps chain cleanly.
    const pressed = attack && !this.prevAttack;
    this.prevAttack = attack;
    if (pressed && (this.state === 'cut' || this.state === 'xcut')) this.buffered = true;

    if (this.state === 'guard') {
      this.stanceT -= dt;
      if (this.stanceT <= 0) {
        // Nothing came: the guard drops, and the ability is back sooner.
        this.specialCd = this.cdFull = RIPOSTE.whiff;
        this.settle(40);
      }
    }

    if (this.state === 'free' && this.cooldown === 0 && !this.vanished) {
      if (special && this.specialCd === 0) this.startGuard();
      else if (attack || this.buffered) this.startSwing();
    }

    const pace = { free: Math.min(1, len), cut: 0.4, xcut: 0.2, guard: 0.2, counter: 0.1 }[this.state];
    let vx = moving ? (mx / len) * stats.speed * pace : 0;
    let vy = moving ? (my / len) * stats.speed * pace : 0;
    if (this.dash.t > 0) {
      vx += this.dash.vx;
      vy += this.dash.vy;
      this.dash.t -= dt;
    }
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      // Fighting faces the aim, even walking backwards; otherwise the way of the walk.
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_walk_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else if (!this.struck) {
      const f = this.body.anims.currentFrame;
      const at = f ? f.index - 1 : 0;
      if ((this.state === 'cut' || this.state === 'xcut') && at >= TWIN_HIT_FRAME[this.swing]) {
        this.struck = true;
        if (this.state === 'xcut') this.crossCut();
        else this.cut();
      } else if (this.state === 'counter' && at >= TWIN_HIT_FRAME.counter && !this.vanished) {
        this.struck = true;
        this.shear();
      }
    }

    this.sync();
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.updateHud();
  }

  private startSwing(): void {
    const chain = this.step > 0 && this.step < CHAIN.length && this.clock - this.lastSwingAt <= COMBO_WINDOW;
    this.step = chain ? this.step + 1 : 1;
    this.lastSwingAt = this.clock;
    this.buffered = false;
    this.struck = false;
    this.swing = CHAIN[this.step - 1];
    this.dir = this.aimDir();
    this.state = this.swing === 'xcut' ? 'xcut' : 'cut';
    this.body.play(`${this.kit.key}_${this.swing}_${this.dir}`);
    // The X-cut sings like a twirl; the quick cuts each a little lighter.
    sound.saberSwing(this.swing === 'xcut' ? 3 : this.step === 2 ? 2 : 1, this.world.pan(this.x));
    const u = this.towards();
    const lunge = this.swing === 'xcut' ? 70 : 50;
    this.dash = { vx: u.x * lunge, vy: u.y * lunge, t: this.swing === 'xcut' ? 160 : 100 };
  }

  /** One of the quick cuts lands: a narrow arc before him, in the colour of the blade that made it. */
  private cut(): void {
    const cx = snap(this.x);
    const cy = snap(this.y) - TWIN_CHEST_Y;
    const depth = snap(this.y);
    const deg = TWIN_FACING_DEG[this.dir];
    const shoto = this.swing === 'cut2';
    // Mirrored frames swap his hands, so the cuts sweep the other way facing right.
    const hand = this.dir === 'right' ? -1 : 1;
    const way = (this.swing === 'cut1' ? 1 : -1) * hand;
    const scheme = shoto ? this.kit.shoto : this.kit.main;
    this.fx.push(new SlashArc(this.world, cx, cy, deg + way * 80, deg - way * 80, shoto ? 15 : 19, scheme, depth, 170));
    const rad = (deg * Math.PI) / 180;
    const hits = this.world.melee({ kind: 'arc', x: cx, y: cy, radius: CUT.reach, angle: rad, spread: CUT.spread }, { damage: CUT.damage, knock: CUT.knock });
    for (const h of hits) {
      this.fx.push(new HitSpark(this.world, h.x, h.y, scheme, h.y + 13, false));
      sound.saberHit(this.world.pan(h.x), false);
    }
    if (hits.length) this.world.cameras.main.shake(50, 0.00025);
  }

  /** The X-cut lands: two arcs crossing before him, one of each blade, and the foes it catches reel. */
  private crossCut(): void {
    const cx = snap(this.x);
    const cy = snap(this.y) - TWIN_CHEST_Y;
    const depth = snap(this.y);
    const deg = TWIN_FACING_DEG[this.dir];
    const { main, shoto } = this.kit;
    this.fx.push(new SlashArc(this.world, cx, cy, deg - 100, deg + 70, 22, main, depth, 230));
    this.fx.push(new SlashArc(this.world, cx, cy, deg + 100, deg - 70, 18, shoto, depth + 0.05, 230));
    this.fx.push(new CrossFlash(this.world, cx + Math.round(Math.cos((deg * Math.PI) / 180) * 14), cy + Math.round(Math.sin((deg * Math.PI) / 180) * 9), main, shoto, depth + 1, 12));
    const rad = (deg * Math.PI) / 180;
    const area = { kind: 'arc' as const, x: cx, y: cy, radius: XCUT.reach, angle: rad, spread: XCUT.spread };
    // Who it catches reels a moment (the stagger), besides the heavy blow.
    const caught = this.world.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - cx, h.y - h.bodyY - cy) <= XCUT.reach + h.radius);
    const hits = this.world.melee(area, { damage: XCUT.damage, heavy: true, knock: XCUT.knock });
    if (hits.length) for (const h of caught) if (h.alive) h.slow?.(XCUT.reel, XCUT.reelMs);
    for (const h of hits) {
      this.fx.push(new HitSpark(this.world, h.x, h.y, main, h.y + 13, true));
      this.fx.push(new HitSpark(this.world, h.x + 1, h.y - 1, shoto, h.y + 13.1, false));
      sound.saberHit(this.world.pan(h.x), true);
    }
    if (hits.length) this.world.cameras.main.shake(110, 0.0007);
  }

  private startGuard(): void {
    this.state = 'guard';
    this.step = 0;
    this.parried = false;
    this.stanceT = RIPOSTE.stance;
    this.dir = this.aimDir();
    this.dash.t = 0;
    this.body.play(`${this.kit.key}_guard_${this.dir}`);
    // The cooldown runs from the end of the stance (see update); the button shows it spent meanwhile.
    this.specialCd = this.cdFull = RIPOSTE.cooldown;
    sound.saberSwing(2, this.world.pan(this.x));
  }

  /** A blow glances off the crossed blades: a clang, a flash at the crossing, and he answers. */
  private riposte(): void {
    this.parried = true;
    this.specialCd = this.cdFull = RIPOSTE.cooldown;
    // Wheel to face whoever is nearest, if anyone is close: that's who struck.
    const cx = this.x;
    const cy = this.y - TWIN_CHEST_Y;
    const near = this.world
      .hurtboxesWhere((h) => h.alive && Math.hypot(h.x - cx, h.y - h.bodyY - cy) <= RIPOSTE.turn + h.radius)
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
    if (near) this.dir = dirOf(near.x - cx, near.y - near.bodyY - cy);
    const u = this.towards();
    const px = snap(this.x) + Math.round(u.x * 5);
    const py = snap(this.y) - TWIN_CHEST_Y - 2 + Math.round(u.y * 3);
    this.fx.push(new CrossFlash(this.world, px, py, this.kit.main, this.kit.shoto, snap(this.y) + 2, 16, true));
    this.fx.push(new HitSpark(this.world, px, py, this.kit.main, snap(this.y) + 2.1, true));
    this.world.debris([0xffffff, this.kit.main.hot, this.kit.shoto.hot], px, py, 8, snap(this.y) + 6, 'burst');
    this.world.cameras.main.shake(90, 0.0008);
    this.flash = 260;
    sound.saberParry(this.world.pan(this.x));
    this.state = 'counter';
    this.struck = false;
    this.body.play(`${this.kit.key}_counter_${this.dir}`);
  }

  /** The counter-cut: both blades shear outward through everything in front of him, hard. */
  private shear(): void {
    if (!this.parried) return;
    const cx = snap(this.x);
    const cy = snap(this.y) - TWIN_CHEST_Y;
    const depth = snap(this.y);
    const deg = TWIN_FACING_DEG[this.dir];
    const { main, shoto } = this.kit;
    this.fx.push(new SlashArc(this.world, cx, cy, deg - 15, deg - 110, 25, main, depth, 220));
    this.fx.push(new SlashArc(this.world, cx, cy, deg + 15, deg + 110, 23, shoto, depth + 0.05, 220));
    const rad = (deg * Math.PI) / 180;
    const hits = this.world.melee({ kind: 'arc', x: cx, y: cy, radius: RIPOSTE.reach, angle: rad, spread: RIPOSTE.spread }, { damage: RIPOSTE.damage, heavy: true, knock: RIPOSTE.knock });
    for (const h of hits) {
      this.fx.push(new HitSpark(this.world, h.x, h.y, main, h.y + 13, true));
      this.fx.push(new HitSpark(this.world, h.x - 1, h.y + 1, shoto, h.y + 13.1, true));
      sound.saberHit(this.world.pan(h.x), true);
    }
    this.world.cameras.main.shake(130, hits.length ? 0.0012 : 0.0005);
    this.parried = false;
  }

  /** Which way an ability goes: at the mouse on a computer, else the way he last walked. */
  private aimDir(): Dir {
    const a = this.aim ?? this.lastMove;
    return dirOf(a.x, a.y);
  }

  private towards(): { x: number; y: number } {
    if (this.aim && this.state !== 'counter') {
      const l = Math.hypot(this.aim.x, this.aim.y) || 1;
      return { x: this.aim.x / l, y: this.aim.y / l };
    }
    const a = (TWIN_FACING_DEG[this.dir] * Math.PI) / 180;
    return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
  }

  private updateHud(): void {
    // The special button's ring refills over the cooldown and glows when ready; it's lit while the guard is up.
    const full = this.cdFull;
    beamHud.charge = this.state === 'guard' ? 0 : 1 - this.specialCd / full;
    beamHud.over = 0;
    beamHud.firing = this.state === 'guard';
    comboHud.max = CHAIN.length;
    const since = this.clock - this.lastSwingAt;
    comboHud.hits = this.step;
    comboHud.window = this.step === 0 ? 0 : this.step < CHAIN.length ? Math.max(0, 1 - since / COMBO_WINDOW) : Math.max(0, 1 - since / 600);
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
    // The two blades light the ground between their tips, brightest at night and flaring at a parry.
    const m = jediMeta.get(`${this.kit.key}:${frame}`);
    const bx = m ? (m.tipX + m.palmX) / 2 - TWIN_ORIGIN_X : 0;
    const by = m ? (m.tipY + m.palmY) / 2 - TWIN_ORIGIN_Y : -14;
    this.bladeLight.setPosition(rx + bx, ry + by);
    this.bladeLight.intensity = this.vanished ? 0 : 0.4 + 0.8 * (1 - this.daylight) + (this.flash / 260) * 2;
  }
}

/**
 * Two blades of light crossing in an X where they meet, a ring of light
 * ringing out from the crossing like a struck bell, and four glints flying
 * off it: the parry's clang, and the X-cut's mark.
 */
export class CrossFlash implements Effect {
  dead = false;
  private layer: PixelLayer;
  private glow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private age = 0;
  private readonly half: number;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    private a: Scheme,
    private b: Scheme,
    depth: number,
    private size: number,
    private bell = false,
    private duration = 280,
  ) {
    this.half = size + 6;
    this.layer = new PixelLayer(scene, this.half * 2, this.half * 2);
    this.layer.image.setPosition(x - this.half, y - this.half).setDepth(depth);
    this.glow = scene.add.image(x + 0.5, y + 0.5, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffffff).setScale(bell ? 1.1 : 0.8).setDepth(depth - 0.05);
    this.light = scene.lights.addLight(x, y, 60, a.hot, bell ? 3 : 1.8);
    this.draw();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    if (this.age >= this.duration) {
      this.destroy();
      return;
    }
    this.draw();
  }

  private draw(): void {
    const k = this.age / this.duration;
    const H = this.half;
    const L = this.layer;
    L.clear();
    const put = (dx: number, dy: number, c: number, al = 1) => L.put(Math.round(dx) + H, Math.round(dy) + H, c, al);
    const fade = 1 - k;
    // The X: two strokes drawn out from the middle, then thinning away from their ends inward.
    const reach = this.size * Math.min(1, k * 5);
    const eat = this.size * Math.max(0, (k - 0.35) / 0.65);
    const stroke = (sx: number, sy: number, s: Scheme) => {
      for (let i = -reach; i <= reach; i += 0.5) {
        if (Math.abs(i) < eat * 0.6) continue;
        const w = 1 - Math.abs(i) / (this.size + 1);
        const x = i * sx;
        const y = i * sy;
        put(x, y, w > 0.55 ? s.core : s.hot, fade);
        if (w > 0.3) {
          put(x + sy, y - sx, s.mid, fade * 0.8);
          put(x - sy, y + sx, s.mid, fade * 0.8);
        }
      }
    };
    stroke(0.75, -0.66, this.a);
    stroke(0.75, 0.66, this.b);
    if (this.bell) {
      // The ring of the clang, spreading and breaking up as it goes.
      const r = 3 + k * (this.size + 2);
      const n = Math.ceil(r * 6);
      for (let i = 0; i < n; i++) {
        if ((i * 7) % 5 === 0 && k > 0.4) continue;
        const t = (i / n) * Math.PI * 2;
        put(Math.cos(t) * r, Math.sin(t) * r * 0.8, i % 2 ? this.a.hot : this.b.hot, fade * 0.9);
      }
      // Glints thrown off the crossing.
      for (let g = 0; g < 4; g++) {
        const t = g * (Math.PI / 2) + Math.PI / 4 + 0.3;
        const d = 2 + k * (this.size + 4);
        put(Math.cos(t) * d, Math.sin(t) * d - k * 4, 0xffffff, fade);
      }
    }
    put(0, 0, 0xffffff, fade);
    L.flush();
    this.glow.setAlpha(0.9 * fade).setScale((this.bell ? 1.1 : 0.8) * (1 + k * 0.6));
    this.light.intensity = (this.bell ? 3 : 1.8) * fade;
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.layer.destroy();
    this.glow.destroy();
    this.scene.lights.removeLight(this.light);
  }
}

/** Is this hero a Twin Blade (for Thousand Cuts, which vanishes him)? */
export const isTwin = (h: Hero): h is Twin => h instanceof Twin;

/** Foes nearest-first from (x, y): the order Thousand Cuts takes them in. */
export function nearestFoes(world: WorldScene, x: number, y: number, reach: number): Hurtbox[] {
  return world.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - x, h.y - y) <= reach).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
}
