import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { BALLET_CHEST_Y, BALLET_H, BALLET_ORIGIN_X, BALLET_ORIGIN_Y, BALLET_TIMING, BALLET_W, BALLET_WAIST_Y } from '../art/ballerina';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { Heat } from './heat';
import { HitSpark, Shockwave, type Scheme } from './Slash';
import { bloom, bump, clamp01, easeOut, flare, Fx, hash, pal, type Ink, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Ballerina (the Automaton's third type): a clockwork music-box dancer
// come to life, quick on her toes, her tutu a fan of steel blades.
//  - Attack (held): Pirouette. Two quick turns on one toe, her blades
//    cutting everything in a short ring round her (the first turning one
//    way, the second the other), then a sweeping kick that flings a blade
//    arc out the way she aims, through every foe in its path.
//  - Ability: Grand jeté. A soaring split leap the way she aims; she lands
//    on her toes in a ring of steel springing up from the ground, which
//    slashes all round her. She can't be struck in the air.
//  - Special: Music Box (see ultimate/ballerina.ts). A great music box opens
//    under her and plays; she spins as a vortex of blades that goes where
//    she goes, drawing foes in and slowing them, then curtsies, and the
//    blades burst out as steel petals.
// Her mainspring is the Automaton's heat (see heat.ts): every turn winds it
// tighter, wound past the red line she cuts harder, and at the top it
// lets go: a burst of steam and she stalls, unwinding.
// The Firebird is the same dance in flame: her blades are fire feathers.

const SPIN_MS = BALLET_TIMING.spin;
/** When in a turn the blades cut (the retiré, mid-turn). */
const SPIN_LAND = 110;
const SPIN_R = 22;
const SPIN_DAMAGE = 8;
const SPIN_HEAT = 7;
const KICK_MS = BALLET_TIMING.kick;
const KICK_LAND = 170;
const KICK_HEAT = 9;
/** The blade arc the kick throws: its bite, speed, reach and how wide it cuts. */
const ARC_DAMAGE = 14;
const ARC_SPEED = 250;
const ARC_RANGE = 95;
const ARC_R = 10;
/** Time after a blow ends to chain the next. */
const COMBO_WINDOW = 380;

const LEAP_MS = BALLET_TIMING.leap;
/** The plié before she springs, then the flight (landing as the leap's landing frame shows). */
const LEAP_PREP = 83;
const LEAP_FLIGHT = 334;
const LEAP_DIST = 80;
const LEAP_MIN = 30;
const LEAP_H = 20;
const LAND_R = 30;
const LAND_DAMAGE = 18;
const LEAP_HEAT = 16;
const LEAP_COOLDOWN = 6500;

/** The Special's spin: how fast she can move in it, and the curtsy after. */
const DANCE_PACE = 0.85;
const CURTSY_MS = BALLET_TIMING.curtsy;

const FOOTFALLS = new Set([1, 4]);

type Blow = 'spinA' | 'spinB' | 'kick';
const CHAIN: Blow[] = ['spinA', 'spinB', 'kick'];

export interface BalletKit {
  key: string;
  firebird: boolean;
  maxHp: number;
  speed: number;
  /** Her blades' light, and the Shockwave/HitSpark scheme made from it. */
  pal: Pal;
  fx: Scheme;
  aura: number;
}

const balletStats = HERO_STATS['automaton.ballerina'];

export const BALLET_KIT: BalletKit = {
  key: 'ballet',
  firebird: false,
  maxHp: balletStats.hp,
  speed: balletStats.speed,
  pal: pal(0xffffff, 0xeef4ff, 0xffa8d8, 0x9a4a8a, 0xffb8e0),
  fx: { core: 0xffffff, hot: 0xeef4ff, mid: 0xffa8d8, deep: 0x9a4a8a, light: 0xffb8e0 },
  aura: 0xffc8e8,
};

export const FIREBIRD_KIT: BalletKit = {
  ...BALLET_KIT,
  key: 'ballet_firebird',
  firebird: true,
  pal: pal(0xfff4c0, 0xffc840, 0xff6a1a, 0xb01808, 0xff8a30),
  fx: { core: 0xfff4c0, hot: 0xffc840, mid: 0xff6a1a, deep: 0xb01808, light: 0xff8a30 },
  aura: 0xffa050,
};

/** Fire's own sparks, for the Firebird's embers. */
const EMBERS = [0xfff4c0, 0xffc840, 0xff6a1a, 0xc02010];
/** Steel's, for the Ballerina's chips of light. */
const STEEL = [0xffffff, 0xe6ecf6, 0xffc8e4, 0xa8b2c4];

type State = 'free' | 'blow' | 'leap' | 'dance' | 'bow';

export class Ballerina implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: BalletKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private aura: Phaser.GameObjects.Light;
  private heat: Heat;
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private clock = 0;
  private state: State = 'free';
  private blow: Blow = 'spinA';
  private step = 0;
  private moveT = 0;
  private landed = false;
  private lastBlowEnd = -99999;
  private leapCd = 0;
  private leap = { x0: 0, y0: 0, x1: 0, y1: 0 };
  /** Height off the ground in a leap. */
  private lift = 0;
  private danceT = 0;
  private prevSpecial = false;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: BalletKit = BALLET_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = BALLET_ORIGIN_X / BALLET_W;
    const oy = BALLET_ORIGIN_Y / BALLET_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 52, kit.aura, 0);
    this.heat = new Heat(world, this);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.heat.destroy());
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.leapCd = Math.max(0, this.leapCd - dt);
    this.heat.update(dt);
    const stalled = this.heat.overheated;
    // The ability fires on the press (the Automaton's button presses at once on touch).
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;

    if (this.state === 'dance') this.updateDance(dt);
    else if (this.state === 'bow') {
      this.moveT += dt;
      if (this.moveT >= CURTSY_MS) this.state = 'free';
    } else if (this.state === 'leap') this.updateLeap(dt);
    else if (this.state === 'blow') this.updateBlow(dt);

    if ((this.state === 'free' || this.state === 'blow') && !stalled) {
      if (pressed && this.leapCd === 0) this.startLeap();
      else if (attack && this.state === 'free') this.startBlow();
    }

    if (this.state !== 'leap') {
      const pace = this.kit.speed * this.paceNow(stalled);
      if (moving && pace > 0) {
        this.x = Phaser.Math.Clamp(this.x + (mx / len) * pace * Math.min(1, len) * (dt / 1000), bounds.left, bounds.right);
        this.y = Phaser.Math.Clamp(this.y + (my / len) * pace * Math.min(1, len) * (dt / 1000), bounds.top, bounds.bottom);
      }
    }
    if (this.state === 'free') {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_walk_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else if (this.state === 'dance') {
      if (moving) this.dir = dirOf(mx, my);
      const key = `${this.kit.key}_vortex_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    }
    this.sync();
    this.updateHud();
  }

  private paceNow(stalled: boolean): number {
    if (this.state === 'dance') return DANCE_PACE;
    if (this.state === 'bow') return 0;
    if (stalled) return 0.45;
    // She drifts a little through her turns, but plants herself to kick.
    if (this.state === 'blow') return this.blow === 'kick' ? 0.15 : 0.55;
    return 1;
  }

  // -------------------------------------------------------------------------
  // Pirouettes and the kick

  private startBlow(): void {
    const chain = this.step > 0 && this.step < 3 && this.clock - this.lastBlowEnd <= COMBO_WINDOW;
    this.step = chain ? this.step + 1 : 1;
    this.blow = CHAIN[this.step - 1];
    this.state = 'blow';
    this.moveT = 0;
    this.landed = false;
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_${this.blow}_${this.dir}`, true);
    this.heat.add(this.blow === 'kick' ? KICK_HEAT : SPIN_HEAT);
  }

  private updateBlow(dt: number): void {
    this.moveT += dt;
    const kick = this.blow === 'kick';
    if (!this.landed && this.moveT >= (kick ? KICK_LAND : SPIN_LAND)) {
      this.landed = true;
      if (kick) this.kickArc();
      else this.cutRing();
    }
    if (this.moveT >= (kick ? KICK_MS : SPIN_MS)) {
      this.state = 'free';
      this.lastBlowEnd = this.clock;
      if (kick) this.step = 0;
    }
  }

  /** The turn's blades cut everything in a short ring round her. */
  private cutRing(): void {
    const w = this.world;
    const k = this.kit;
    const sense = this.blow === 'spinA' ? 1 : -1;
    const cy = this.y - BALLET_WAIST_Y;
    w.addEffect(new BladeRing(w, this.x, this.y, SPIN_R, k.pal, k.firebird, sense));
    const hits = w.melee({ kind: 'circle', x: this.x, y: cy, radius: SPIN_R }, { damage: SPIN_DAMAGE * this.heat.power, knock: 70, fromX: this.x, fromY: this.y });
    for (const h of hits) w.addEffect(new HitSpark(w, h.x, h.y, k.fx, h.y + 13, false));
    sound.knife(w.pan(this.x), this.step, false);
    if (hits.length) {
      sound.knifeHit(w.pan(this.x), false);
      w.cameras.main.shake(60, 0.00025);
    }
  }

  /** The kick flings a blade arc out the way she aims. */
  private kickArc(): void {
    const w = this.world;
    const u = this.aimVec();
    const k = this.kit;
    const x = this.x + u.x * 8;
    const y = this.y + u.y * 6;
    w.addEffect(new BladeArc(w, x, y, u.x, u.y, ARC_DAMAGE * this.heat.power, k.pal, k.fx, k.firebird));
    w.debris(k.firebird ? EMBERS : STEEL, x, y - BALLET_WAIST_Y, 6, this.y + 12, 'burst');
    sound.swing(3, w.pan(x));
    sound.knife(w.pan(x), 3, true);
  }

  // -------------------------------------------------------------------------
  // The grand jeté

  private startLeap(): void {
    const u = this.aimVec();
    const want = this.aim?.dist === undefined ? LEAP_DIST : Phaser.Math.Clamp(this.aim.dist, LEAP_MIN, LEAP_DIST);
    // The mouse is aimed from her chest; she lands on the ground under it, and only where there is ground.
    const tx = this.x + u.x * want;
    const ty = this.y + u.y * want - (this.aim?.dist === undefined ? 0 : BALLET_CHEST_Y * 0.5);
    let end = { x: this.x, y: this.y };
    const len = Math.hypot(tx - this.x, ty - this.y);
    const steps = Math.ceil(len / 4);
    for (let i = 1; i <= steps; i++) {
      const x = this.x + ((tx - this.x) * i) / steps;
      const y = this.y + ((ty - this.y) * i) / steps;
      if (!this.world.walkable(x, y)) break;
      end = { x, y };
    }
    this.leap = { x0: this.x, y0: this.y, x1: end.x, y1: end.y };
    this.state = 'leap';
    this.moveT = 0;
    this.landed = false;
    this.step = 0;
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_leap_${this.dir}`, true);
    this.world.evade(LEAP_PREP + LEAP_FLIGHT + 80);
    this.leapCd = LEAP_COOLDOWN;
    this.heat.add(LEAP_HEAT);
  }

  private updateLeap(dt: number): void {
    const before = this.moveT;
    this.moveT += dt;
    const l = this.leap;
    if (before < LEAP_PREP && this.moveT >= LEAP_PREP) {
      this.world.debris([0xd8c8a0, 0xa89878], this.x, this.y, 6, this.y + 4, 'burst');
      sound.windDash(this.world.pan(this.x));
    }
    if (this.moveT >= LEAP_PREP && !this.landed) {
      const k = clamp01((this.moveT - LEAP_PREP) / LEAP_FLIGHT);
      // Gliding across, a little quicker in the middle: a jeté hangs at its top.
      const e = k < 0.5 ? 0.5 * Math.pow(k * 2, 0.8) : 1 - 0.5 * Math.pow((1 - k) * 2, 0.8);
      this.x = l.x0 + (l.x1 - l.x0) * e;
      this.y = l.y0 + (l.y1 - l.y0) * e;
      this.lift = LEAP_H * Math.sin(k * Math.PI);
      if (Math.floor(this.moveT / 35) !== Math.floor(before / 35)) {
        const p = this.kit.pal;
        this.world.debris(this.kit.firebird ? [p.hot, p.mid, p.deep] : [p.hot, p.mid], this.x, this.y - this.lift - BALLET_WAIST_Y, 1, this.y + 20, 'trail');
      }
      if (k >= 1) this.land();
    }
    if (this.moveT >= LEAP_MS) this.state = 'free';
  }

  /** She comes down on her toes, and a ring of steel springs up round her. */
  private land(): void {
    this.landed = true;
    this.lift = 0;
    const w = this.world;
    const k = this.kit;
    const x = snap(this.x);
    const y = snap(this.y);
    w.addEffect(new SteelCrown(w, x, y, LAND_R, k.pal, k.firebird));
    w.addEffect(new Shockwave(w, x, y - 1, LAND_R + 4, k.fx));
    const hits = w.melee({ kind: 'circle', x, y: y - 6, radius: LAND_R }, { damage: LAND_DAMAGE * this.heat.power, heavy: true, knock: 150, fromX: x, fromY: y });
    for (const h of hits) w.addEffect(new HitSpark(w, h.x, h.y, k.fx, h.y + 13, true));
    w.debris(k.firebird ? EMBERS : STEEL, x, y - 4, 14, y + 20, 'burst');
    w.cameras.main.shake(170, 0.001);
    flare(w, x, y - 8, 90, k.pal.light, 2, 380);
    sound.slam(w.pan(x));
    sound.sever(w.pan(x), Math.max(1, Math.min(4, hits.length)));
  }

  // -------------------------------------------------------------------------
  // The Special (the Music Box itself is in ultimate/ballerina.ts)

  /** The Special's doing: she spins as the vortex for `ms`, then curtsies. */
  dance(ms: number): void {
    this.state = 'dance';
    this.danceT = ms;
    this.step = 0;
    this.lift = 0;
  }

  private updateDance(dt: number): void {
    // Struck down mid-dance: the music stops with her.
    if (this.world.heroDown) {
      this.danceT = 0;
      this.state = 'free';
      return;
    }
    this.danceT -= dt;
    if (this.danceT <= 0) {
      this.state = 'bow';
      this.moveT = 0;
      this.body.play(`${this.kit.key}_curtsy_${this.dir}`, true);
    }
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.leapCd / LEAP_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'leap';
    const since = this.clock - this.lastBlowEnd;
    comboHud.max = 3;
    comboHud.hits = this.step;
    comboHud.window = this.step === 0 ? 0 : this.state === 'blow' ? 1 : Math.max(0, 1 - since / COMBO_WINDOW);
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const up = snap(this.lift);
    const frame = this.body.frame.name;
    // Wound past the red line she flushes rosy-hot (pulsing), like the other automatons.
    const hot = this.heat.value / 100;
    const flush = hot > 0.7 && !this.heat.overheated ? 0.5 + 0.5 * Math.sin(this.clock * 0.02) : 0;
    if (!this.body.isTinted || this.body.tintTopLeft !== 0xff8070) this.body.setTint(Phaser.Display.Color.GetColor(255, Math.round(255 - flush * 70), Math.round(255 - flush * 60)));
    this.body.setPosition(rx, ry - up).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry - up).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha).setScale(1 - up / 60);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha * (1 - up / 40));
    this.aura.setPosition(rx, ry - 16 - up);
    this.aura.intensity = 0.5 * (1 - this.daylight) + (this.state === 'dance' ? 0.6 : 0);
  }
}

// ---------------------------------------------------------------------------
// Effects

/**
 * Two canvases round one centre: what lies above the centre row is drawn
 * behind her, the rest in front, so rings wrap round her body.
 */
export class Wrap {
  constructor(
    private back: Ink,
    private front: Ink,
    private cy: number,
  ) {}

  begin(cx: number, cy: number, depth: number): this {
    this.cy = cy;
    this.back.begin(cx, cy, depth - 0.5);
    this.front.begin(cx, cy, depth + 0.4);
    return this;
  }

  put(x: number, y: number, c: number, a = 1): void {
    (y < this.cy ? this.back : this.front).put(x, y, c, a);
  }

  end(): void {
    this.back.end();
    this.front.end();
  }
}

/** Squash of her rings, seen from above at a slant. */
const RING_SQ = 0.5;

/**
 * A pirouette's cut: crescents of blade light whipping once round her at
 * the height of her tutu, a glint of steel (or a flame feather) at the head
 * of each, the ring wrapping round her body.
 */
export class BladeRing extends Fx {
  private g: Wrap;
  private a0: number;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private r: number,
    private p: Pal,
    private fb: boolean,
    private sense: number,
  ) {
    super(world, 280);
    const w = Math.ceil(r * 2 + 10);
    const h = Math.ceil(r * RING_SQ * 2 + 12);
    this.g = new Wrap(this.ink(w, h), this.ink(w, h), y);
    this.a0 = hash(Math.round(x), Math.round(y)) * Math.PI * 2;
    bloom(world, x, y - BALLET_WAIST_Y, p.mid, 0.9, 240, y + 2, 0.5);
  }

  protected step(): void {
    const { x, r, p, sense } = this;
    const cy = this.y - BALLET_WAIST_Y;
    const k = this.t / this.life;
    const fade = 1 - clamp01((k - 0.55) / 0.45);
    const g = this.g.begin(x, cy, this.y);
    const head = this.a0 + sense * easeOut(k * 1.3) * Math.PI * 2.2;
    const blades = 4;
    for (let b = 0; b < blades; b++) {
      const h = head + (b / blades) * Math.PI * 2 * sense;
      const len = 1.15;
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const a = h - sense * f * len;
        // Thick at the head, thinning to a wisp behind.
        const thick = (1 - f) * 2.2;
        const rr = r * (0.82 + 0.1 * Math.sin(f * Math.PI));
        for (let d = 0; d <= thick; d += 0.5) {
          const c = f < 0.12 ? p.core : f < 0.35 ? p.hot : f < 0.7 ? p.mid : p.deep;
          g.put(x + Math.cos(a) * (rr - d), cy + Math.sin(a) * (rr - d) * RING_SQ, c, fade * (1 - f * 0.6));
        }
      }
      // The blade itself at the head: a sliver of steel, or a feather of fire.
      const hx = x + Math.cos(h) * r * 0.86;
      const hy = cy + Math.sin(h) * r * 0.86 * RING_SQ;
      const tx = -Math.sin(h) * sense;
      const ty = Math.cos(h) * sense * RING_SQ;
      for (let s = -2; s <= 2; s++) g.put(hx + tx * s * 0.8, hy + ty * s * 0.8 - (this.fb ? Math.abs(s) * 0.4 : 0), s === 0 ? 0xffffff : this.fb ? p.hot : p.core, fade);
    }
    g.end();
    if (this.fb && Math.floor(this.t / 50) !== Math.floor((this.t - 16) / 50)) this.world.debris(EMBERS, x + Math.cos(head) * r * 0.8, cy + Math.sin(head) * r * 0.4, 2, this.y + 14, 'spores');
  }
}

/**
 * The kick's blade arc: a crescent of steel light (a sweep of fire feathers
 * for the Firebird) flung out at the height of her waist, cutting through
 * every foe it passes, once each, until it has flown its reach.
 */
export class BladeArc extends Fx {
  private g: Ink;
  private gone = 0;
  private struck = new Set<unknown>();
  private readonly th: number;
  private lamp: Phaser.GameObjects.Light;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private damage: number,
    private p: Pal,
    private fx: Scheme,
    private fb: boolean,
  ) {
    super(world, (ARC_RANGE / ARC_SPEED) * 1000 + 160);
    this.g = this.ink(44, 44);
    this.th = Math.atan2(uy * 0.75, ux);
    this.lamp = this.light(x, y - BALLET_WAIST_Y, 50, p.light, 1.2);
  }

  protected step(dt: number): void {
    const flying = this.gone < ARC_RANGE;
    if (flying) {
      const s = Math.min(ARC_RANGE - this.gone, (ARC_SPEED * dt) / 1000);
      this.x += this.ux * s;
      this.y += this.uy * s;
      this.gone += s;
      this.lamp.x = this.x;
      this.lamp.y = this.y - BALLET_WAIST_Y;
      this.cut();
    }
    const fade = flying ? 1 : 1 - clamp01((this.t - (ARC_RANGE / ARC_SPEED) * 1000) / 160);
    // It grows as it leaves her foot and thins out as it ends.
    const grow = 0.6 + 0.4 * clamp01(this.gone / 30);
    const cy = this.y - BALLET_WAIST_Y;
    const g = this.g.begin(this.x, cy, this.y + 2);
    const R = 11 * grow;
    const spread = 1.25;
    const n = 30;
    // The crescent bows forward: its middle leads, its horns trail behind.
    const ox = this.x - Math.cos(this.th) * R * 0.7;
    const oy = cy - Math.sin(this.th) * R * 0.7;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const a = this.th - spread + f * spread * 2;
      const thick = Math.sin(f * Math.PI) * 3.2 * grow;
      for (let d = 0; d <= thick; d += 0.5) {
        const u = d / (thick || 1);
        const c = u < 0.25 ? this.p.core : u < 0.5 ? this.p.hot : u < 0.8 ? this.p.mid : this.p.deep;
        g.put(ox + Math.cos(a) * (R - d), oy + Math.sin(a) * (R - d) * 0.8, c, fade);
      }
      if (this.fb && i % 5 === 0) {
        // The feathers' barbs: little strokes fanning back off the crescent.
        for (let d = 1; d <= 3; d++) g.put(ox + Math.cos(a) * (R - thick - d), oy + Math.sin(a) * (R - thick - d) * 0.8 + d * 0.3, d < 2 ? this.p.mid : this.p.deep, fade * (1 - d / 4));
      }
    }
    // A streak behind it.
    for (let s = 1; s < 10; s++) g.put(this.x - this.ux * (R * 0.6 + s * 1.5), cy - this.uy * (R * 0.6 + s * 1.5) * 0.75, this.p.mid, fade * (1 - s / 10) * 0.6);
    g.end();
    if (flying && Math.floor(this.t / 40) !== Math.floor((this.t - dt) / 40)) this.world.debris(this.fb ? EMBERS : [this.p.hot, this.p.mid], this.x, cy, 1, this.y + 14, this.fb ? 'spores' : 'trail');
  }

  private cut(): void {
    const w = this.world;
    for (const h of w.hurtboxesWhere((b) => b.alive && !this.struck.has(b) && Math.hypot(b.x - this.x, (b.y - this.y) * 1.2) <= ARC_R + b.radius)) {
      this.struck.add(h);
      h.hurt({ damage: this.damage, heavy: true, knock: 110, fromX: this.x - this.ux * 10, fromY: this.y - this.uy * 10 });
      w.addEffect(new HitSpark(w, h.x, h.y - h.bodyY + 4, this.fx, h.y + 13, true));
      if (this.fb) w.debris(EMBERS, h.x, h.y - h.bodyY, 5, h.y + 12, 'burst');
      sound.knifeHit(w.pan(h.x), true);
      w.cameras.main.shake(70, 0.0004);
    }
  }
}

/**
 * Where the jeté lands: a crown of blades springing up from the ground in a
 * ring round her, flashing and sinking back (tongues of fire for the
 * Firebird), a slash of light running round the ring.
 */
export class SteelCrown extends Fx {
  private g: Wrap;
  private readonly n: number;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private r: number,
    private p: Pal,
    private fb: boolean,
  ) {
    super(world, 480);
    this.n = fb ? 18 : 14;
    const w = Math.ceil(r * 2 + 12);
    const h = Math.ceil(r * 1.2 + 34);
    this.g = new Wrap(this.ink(w, h), this.ink(w, h), y);
    bloom(world, x, y - 6, p.hot, 1.8, 380, y + 20, 0.7);
  }

  protected step(): void {
    const { x, y, r, p, n } = this;
    const sq = 0.58;
    const g = this.g.begin(x, y, y);
    const k = this.t / this.life;
    // The slash running round the ring first, quick.
    const run = easeOut(k / 0.4);
    if (k < 0.6) {
      const fade = 1 - clamp01((k - 0.3) / 0.3);
      const steps = Math.ceil(r * Math.PI * 2 * run * 1.4);
      for (let i = 0; i <= steps; i++) {
        const a = -Math.PI / 2 + (i / Math.max(1, steps)) * Math.PI * 2 * run;
        const c = i > steps - 6 ? p.core : p.mid;
        g.put(x + Math.cos(a) * r, y + Math.sin(a) * r * sq, c, fade);
        g.put(x + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1) * sq, p.deep, fade * 0.7);
      }
    }
    // The blades, springing up one after another round the ring.
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2;
      const delay = (i % 2) * 0.08 + ((i * 7) % n) / n * 0.12;
      const u = clamp01((k - delay) / 0.75);
      if (u <= 0 || u >= 1) continue;
      const h = (this.fb ? 11 : 9) * bump(Math.min(1, u * 1.6));
      const bx = x + Math.cos(a) * r;
      const by = y + Math.sin(a) * r * sq;
      const lean = Math.cos(a) * 1.5;
      for (let d = 0; d <= h; d++) {
        const f = d / Math.max(1, h);
        const wide = this.fb ? (1 - f) * 1.6 + Math.sin(this.t * 0.05 + i + d) * 0.4 : (1 - f) * 1.2;
        for (let s = -wide; s <= wide; s += 0.5) {
          const c = f > 0.8 ? p.core : s < 0 ? p.hot : this.fb ? p.mid : p.deep;
          g.put(bx + s + lean * f, by - d, c, 1 - clamp01((u - 0.7) / 0.3));
        }
      }
      if (u < 0.3 && h > 2) g.put(bx + lean, by - h - 1, 0xffffff, 1);
    }
    g.end();
  }
}
