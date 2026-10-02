import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { DIVER_H, DIVER_HAND_Y, DIVER_HELM_Y, DIVER_ORIGIN_X, DIVER_ORIGIN_Y, DIVER_PROJ_DIRS, DIVER_W } from '../art/deepdiver';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { inFlight, Vitals, type Hurtbox } from './combat';
import { Heat } from './heat';
import { bloom, clamp01, dither, easeOut, flare, Fx, GROUND, hash, pal, ring, type Ink, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Deep Diver (the Automaton's third type): an old brass diving dress
// stomping about on land in lead boots, swinging a ship's anchor on its chain.
//  - Attack (held): Anchor swing. The anchor is whirled out on its chain in a
//    wide, heavy sweep (one way, then back the other), reaching far past any
//    sword; every third swing it is heaved overhead and slammed down ahead,
//    cracking the ground.
//  - Ability (pressed): Harpoon. The forearm gun fires a harpoon on a chain
//    the way it aims; it runs through every foe in a line, bites, and is
//    reeled back in, dragging everything it skewered back to the diver.
//  - Special: Crushing Depths (see ultimate/diver.ts).
// Its air pump is the Automaton's heat (see heat.ts): every blow works it
// harder; past the red line it hits harder, at the top it vents and stalls.
// The Barnacle swings a rusted, shell-crusted anchor; it plays the same.

/** One sweep, start to finish, and the wait from one swing to the next. */
const SWING_MS = 300;
const SWING_EVERY = 480;
/** The anchor's reach on its chain, from the hands; how far round either side of the aim it sweeps (radians). */
const SWING_REACH = 40;
const SWING_ARC = 1.35;
/** Who the sweep catches: everything within reach this far either side of the aim. */
const SWING_SPREAD = (72 * Math.PI) / 180;
const SWING_DAMAGE = 9;
const SWING_HEAT = 8;
/** The anchor reels back to the hands after a sweep, ms. */
const SWING_BACK = 140;

/** The third blow: heaved overhead, thrown this far ahead, landing in a circle. */
const SLAM_EVERY = 780;
const SLAM_THROW = 320;
const SLAM_FLIGHT = 170;
const SLAM_REACH = 32;
const SLAM_RADIUS = 20;
const SLAM_DAMAGE = 20;
const SLAM_HEAT = 13;
/** Let go of the attack this long and the combo starts over from the first sweep. */
const COMBO_RESET = 900;

const HARPOON_SPEED = 420;
const HARPOON_RANGE = 110;
const HARPOON_DAMAGE = 10;
/** The tug as the line goes taut and the reel starts, to everything on it. */
const YANK_DAMAGE = 6;
const REEL_SPEED = 240;
/** The harpoon's head stops this far in front of the diver, the catch with it. */
const REEL_STOP = 16;
const HARPOON_BITE = 110;
const HARPOON_COOLDOWN = 6000;
const HARPOON_HEAT = 12;
/** When the gun fires, into its anim. */
const HARPOON_FIRE_AT = 70;

/** Walk frames where a lead boot comes down. */
const WALK_STOMPS = new Set([0, 3]);

type State = 'free' | 'swing' | 'slam' | 'harpoon' | 'reel';

export interface DiverKit {
  key: string;
  barnacle: boolean;
  maxHp: number;
  speed: number;
  /** The sea's colours: the sweep's smear, the hits, the harpoon's glint. */
  pal: Pal;
  /** Water thrown off the anchor and out of the cracks. */
  water: number[];
  /** The portholes' light at night. */
  aura: number;
}

export const DIVER_KIT: DiverKit = {
  key: 'diver',
  barnacle: false,
  maxHp: HERO_STATS['automaton.diver'].hp,
  speed: HERO_STATS['automaton.diver'].speed,
  pal: pal(0xeaffff, 0x8af0f4, 0x3ac0d0, 0x14607a, 0x5ad8e8),
  water: [0xe6ffff, 0xa8eef8, 0x5ac0dc, 0x2a8aa8],
  aura: 0x7ae8f0,
};

/** The Barnacle: coral pink over a teal deep. */
export const BARNACLE_KIT: DiverKit = {
  ...DIVER_KIT,
  key: 'diver_barnacle',
  barnacle: true,
  pal: pal(0xfff0f6, 0xff9ac0, 0xe0567a, 0x1a8a7a, 0xff8ab0),
  water: [0xf0fff8, 0x9af8d8, 0x3ad0a0, 0xff8aa8],
  aura: 0x8af8d0,
};

/** The frame of a flying thing (`a` the anchor, `h` the harpoon) turned to heading (dx, dy). */
const headFrame = (kind: 'a' | 'h', dx: number, dy: number): string => {
  const i = Math.round((Math.atan2(dy, dx) / (Math.PI * 2)) * DIVER_PROJ_DIRS);
  return `${kind}${((i % DIVER_PROJ_DIRS) + DIVER_PROJ_DIRS) % DIVER_PROJ_DIRS}`;
};

/** Iron chain links, light and dark by turns. */
const LINKS = [0x8a9aae, 0x323e4c];
const RUST_LINKS = [0xa8906c, 0x4a3626];

/** Where the hands are and which way it faces, for the effects that hang off them. */
interface Holder {
  x: number;
  y: number;
}

export class Diver implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: DiverKit;
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
  /** Until the next swing may start, and until the current move lets go of the body. */
  private swingT = 0;
  private busyT = 0;
  /** Which blow of the three comes next, and how long since the last. */
  private combo = 0;
  private sinceBlow = 0;
  private harpoonCd = 0;
  private fireT = -1;
  private line: HarpoonLine | null = null;
  private bubbleT = 0;
  private prevSpecial = false;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: DiverKit = DIVER_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = DIVER_ORIGIN_X / DIVER_W;
    const oy = DIVER_ORIGIN_Y / DIVER_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(1.3, 1.1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 56, kit.aura, 0);
    this.heat = new Heat(world, this);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && WALK_STOMPS.has(frame.index - 1)) this.stomp();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.heat.destroy());
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.swingT = Math.max(0, this.swingT - dt);
    this.busyT = Math.max(0, this.busyT - dt);
    this.harpoonCd = Math.max(0, this.harpoonCd - dt);
    this.sinceBlow += dt;
    this.heat.update(dt);
    const stalled = this.heat.overheated;
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;
    if (this.sinceBlow > COMBO_RESET) this.combo = 0;

    // Struck down: whatever it was doing stops with it.
    if (this.world.heroDown && this.state !== 'free') {
      this.state = 'free';
      this.fireT = -1;
    }

    if (this.state === 'harpoon') {
      if (this.fireT >= 0) {
        this.fireT += dt;
        if (this.fireT >= HARPOON_FIRE_AT) {
          this.fireT = -1;
          this.loose();
        }
      } else if (this.busyT === 0) this.state = this.line && !this.line.dead ? 'reel' : 'free';
    } else if (this.state === 'reel') {
      if (!this.line || this.line.dead) {
        this.line = null;
        this.state = 'free';
      }
    } else if ((this.state === 'swing' || this.state === 'slam') && this.busyT === 0) this.state = 'free';

    if (this.state === 'free' && !stalled) {
      if (pressed && this.harpoonCd === 0) this.startHarpoon();
      else if (attack && this.swingT === 0) this.blow();
    }

    // Heavy in lead boots: slower still mid-swing, crawling while it reels, and stalled when it vents.
    const k = stalled ? 0.4 : this.state === 'reel' ? 0.3 : this.state === 'slam' ? 0.25 : this.state === 'swing' || this.state === 'harpoon' ? 0.5 : 1;
    const speed = this.kit.speed * k * Math.min(1, len);
    if (moving && speed > 0) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * speed * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * speed * (dt / 1000), bounds.top, bounds.bottom);
    }
    this.animate(moving, stalled);
    this.sync(dt);
    this.updateHud();
  }

  /** Which animation plays: its current move's, else walking or standing. */
  private animate(moving: boolean, stalled: boolean): void {
    const key = this.kit.key;
    if (this.state === 'swing' || this.state === 'slam' || this.state === 'harpoon') return;
    if (this.state === 'reel') {
      this.play(`${key}_reel_${this.dir}`);
      return;
    }
    if (stalled) {
      this.play(`${key}_vent_${this.dir}`);
      return;
    }
    if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
    else if (moving) this.dir = dirOf(this.lastMove.x, this.lastMove.y);
    this.play(moving ? `${key}_walk_${this.dir}` : stand(this.body, `${key}_idle_${this.dir}`));
  }

  private play(key: string): void {
    if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
  }

  /** A lead boot thumps down: a puff of dust. */
  private stomp(): void {
    sound.step();
    this.world.debris([0xb8a888, 0x8a7a60, 0x6a5e4a], snap(this.x), snap(this.y) - 1, 2, this.y + 2, 'burst');
  }

  /** Where its hands are, in the world (the chain and the line leave from here). */
  private hands(u: { x: number; y: number }): { x: number; y: number } {
    return { x: this.x + u.x * 4, y: this.y - DIVER_HAND_Y + u.y * 2 };
  }

  // -------------------------------------------------------------------------
  // The anchor

  private blow(): void {
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.sinceBlow = 0;
    const step = this.combo;
    this.combo = (this.combo + 1) % 3;
    if (step === 2) this.slam(u);
    else this.sweep(u, step === 0);
  }

  /**
   * A sweep: the anchor flies out on its chain round one side of the aim and
   * across to the other, catching everything in its reach as it passes the
   * middle. A goes one way, B back the other (mirrored when it faces right, so
   * the anchor follows the hands drawn).
   */
  private sweep(u: { x: number; y: number }, first: boolean): void {
    const key = this.kit.key;
    this.state = 'swing';
    this.busyT = SWING_MS;
    this.swingT = SWING_EVERY;
    this.body.play(`${key}_swing${first ? 'A' : 'B'}_${this.dir}`);
    const s = (first ? 1 : -1) * (this.dir === 'right' ? -1 : 1);
    const aim = Math.atan2(u.y, u.x);
    const w = this.world;
    const power = this.heat.power;
    w.addEffect(
      new AnchorSweep(w, this, aim + s * SWING_ARC, aim - s * SWING_ARC, this.kit, (ax, ay) => {
        const cx = this.x;
        const cy = this.y - DIVER_HAND_Y;
        const hits = w.melee({ kind: 'arc', x: cx, y: cy, radius: SWING_REACH, angle: aim, spread: SWING_SPREAD }, { damage: SWING_DAMAGE * power, knock: 95, fromX: cx, fromY: cy });
        for (const h of hits) {
          w.debris([0xffffff, this.kit.pal.hot, 0x8a9aae], h.x, h.y, 5, h.y + 14, 'burst');
          w.debris(this.kit.water, h.x, h.y, 3, h.y + 14, 'burst');
        }
        if (hits.length) {
          sound.clash(w.pan(ax), true);
          w.cameras.main.shake(70, 0.0007);
        }
        w.debris(this.kit.water, ax, ay, 2, ay + 14, 'burst');
      }),
    );
    sound.swing(first ? 0 : 1, w.pan(this.x));
    this.heat.add(SWING_HEAT);
  }

  /** The third blow: heaved overhead, thrown down ahead, cracking the ground where it lands. */
  private slam(u: { x: number; y: number }): void {
    const key = this.kit.key;
    this.state = 'slam';
    this.busyT = SLAM_THROW + SLAM_FLIGHT + 120;
    this.swingT = SLAM_EVERY;
    this.body.play(`${key}_slam_${this.dir}`);
    sound.servo(this.world.pan(this.x));
    const w = this.world;
    const power = this.heat.power;
    // Where it lands: ahead, but no further than open ground allows.
    let tx = this.x;
    let ty = this.y;
    for (let d = SLAM_REACH; d >= 8; d -= 4) {
      tx = this.x + u.x * d;
      ty = this.y + u.y * d;
      if (w.walkable(tx, ty)) break;
    }
    w.time.delayedCall(SLAM_THROW, () => {
      if (this.state !== 'slam') return;
      w.addEffect(
        new AnchorSlam(w, this, tx, ty, this.kit, () => {
          const hits = w.melee({ kind: 'circle', x: tx, y: ty - 6, radius: SLAM_RADIUS }, { damage: SLAM_DAMAGE * power, heavy: true, knock: 150, fromX: tx, fromY: ty });
          for (const h of hits) w.debris([0xffffff, this.kit.pal.hot, this.kit.pal.mid], h.x, h.y, 5, h.y + 14, 'burst');
          w.addEffect(new GroundCrack(w, tx, ty, this.kit));
          w.debris([0xb8a888, 0x8a7a60, 0x6a5e4a], tx, ty - 2, 14, ty + 20, 'burst');
          w.debris(this.kit.water, tx, ty - 4, 10, ty + 20, 'burst');
          bloom(w, tx, ty - 4, this.kit.pal.mid, 1.4, 280, ty + 30, 0.7);
          flare(w, tx, ty - 6, 70, this.kit.pal.light, 1.6, 300);
          w.cameras.main.shake(160, 0.0035);
          sound.quakeSlam(w.pan(tx));
        }),
      );
      sound.swing(2, w.pan(this.x));
    });
    this.heat.add(SLAM_HEAT);
  }

  // -------------------------------------------------------------------------
  // The harpoon

  private startHarpoon(): void {
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.state = 'harpoon';
    this.busyT = 280;
    this.fireT = 0;
    this.body.play(`${this.kit.key}_harpoon_${this.dir}`);
  }

  private loose(): void {
    const u = this.aimVec();
    const w = this.world;
    const from = this.hands(u);
    this.line = new HarpoonLine(w, this, u.x, u.y, this.kit, this.heat.power);
    w.addEffect(this.line);
    this.harpoonCd = HARPOON_COOLDOWN;
    this.heat.add(HARPOON_HEAT);
    w.debris([0xffffff, 0xd8f6ff, ...this.kit.water.slice(0, 2)], from.x + u.x * 6, from.y + u.y * 4, 6, this.y + 4, 'spores');
    sound.crossbow(w.pan(from.x));
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.harpoonCd / HARPOON_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'harpoon' || this.state === 'reel';
    comboHud.max = 3;
    comboHud.hits = this.sinceBlow < COMBO_RESET ? (this.combo === 0 ? 0 : this.combo) : 0;
    comboHud.window = this.combo === 0 ? 0 : clamp01(1 - this.sinceBlow / COMBO_RESET);
  }

  private sync(dt: number): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    // Working past the red line, the copper flushes with heat.
    const hot = this.heat.value / 100;
    const flush = hot > 0.7 && !this.heat.overheated ? 0.5 + 0.5 * Math.sin(this.clock * 0.02) : 0;
    const tint = Phaser.Display.Color.GetColor(255, Math.round(255 - flush * 70), Math.round(255 - flush * 90));
    if (!this.body.isTinted || this.body.tintTopLeft !== 0xff8070) this.body.setTint(tint);
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
    this.aura.setPosition(rx, ry - DIVER_HELM_Y);
    this.aura.intensity = 0.55 * (1 - this.daylight) * (0.9 + 0.1 * Math.sin(this.clock * 0.004));
    // Bubbles from the helmet's valve, a stream of them as the pump runs hot.
    this.bubbleT -= dt;
    if (this.bubbleT <= 0) {
      this.bubbleT = 900 - hot * 650;
      const side = this.dir === 'left' ? -3 : 3;
      this.world.debris(hot > 0.7 ? [0xffffff, 0xe6ecf4, 0xc8d0dc] : [0xe6ffff, 0xa8eef8, 0x7adce8], rx + side, ry - DIVER_HELM_Y - 7, 1, ry + 1, 'spores');
    }
  }
}

/** The chain between two points in the world, a pixel a link, dark and light by turns; `sag` droops it under its weight. */
function drawChain(g: Ink, x0: number, y0: number, x1: number, y1: number, links: number[], sag = 0, a = 1): void {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
    g.put(x, y, links[Math.floor(i / 2) % 2], a);
  }
}

/**
 * The anchor's sweep: out on its chain from the hands, round from `a0` to
 * `a1` past the aim, a smear of churned water behind it, then reeled back
 * in. `hit` is called once as it passes the middle, with where it is.
 */
class AnchorSweep extends Fx {
  private img: Phaser.GameObjects.Image;
  private g: Ink;
  private struck = false;
  private trail: { a: number; r: number }[] = [];

  constructor(
    world: WorldScene,
    private holder: Holder,
    private a0: number,
    private a1: number,
    private kit: DiverKit,
    private hit: (x: number, y: number) => void,
  ) {
    super(world, SWING_MS + SWING_BACK);
    this.img = this.own(world.add.image(holder.x, holder.y, `${kit.key}_anchor`, headFrame('a', Math.cos(a0), Math.sin(a0))).setPipeline('Lit'));
    this.g = this.ink(SWING_REACH * 2 + 40, SWING_REACH * 2 + 40);
  }

  protected step(): void {
    const h = this.holder;
    const cx = h.x;
    const cy = h.y - DIVER_HAND_Y;
    let a: number;
    let r: number;
    if (this.t < SWING_MS) {
      const k = this.t / SWING_MS;
      // Slow off the mark, fastest through the middle, carried on past it: a heavy thing on a chain.
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      a = this.a0 + (this.a1 - this.a0) * e;
      r = 14 + (SWING_REACH - 14) * Math.min(1, k * 3.2);
      if (!this.struck && e >= 0.5) {
        this.struck = true;
        this.hit(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
    } else {
      const k = (this.t - SWING_MS) / SWING_BACK;
      a = this.a1;
      r = SWING_REACH * (1 - easeOut(k)) + 8 * easeOut(k);
    }
    const ax = cx + Math.cos(a) * r;
    const ay = cy + Math.sin(a) * r;
    // In front of the diver when it swings below the hands, behind it above them.
    const depth = h.y + Math.sin(a) * r + 1;
    this.img.setFrame(headFrame('a', Math.cos(a), Math.sin(a))).setPosition(snap(ax), snap(ay)).setDepth(depth).setAlpha(this.t < SWING_MS ? 1 : 1 - clamp01((this.t - SWING_MS) / SWING_BACK));
    this.trail.push({ a, r });
    if (this.trail.length > 6) this.trail.shift();

    const g = this.g.begin(cx, cy, depth - 0.5);
    const p = this.kit.pal;
    // The smear: a crescent of churned light where the anchor has just been, thinning to a dither.
    if (this.t < SWING_MS) {
      const from = this.trail[0];
      const steps = Math.ceil(Math.abs(a - from.a) * r * 1.2);
      for (let i = 0; i <= steps; i++) {
        const f = i / Math.max(1, steps);
        const th = from.a + (a - from.a) * f;
        const rr = from.r + (r - from.r) * f;
        for (let w = -2; w <= 3; w++) {
          const x = Math.round(cx + Math.cos(th) * (rr + w));
          const y = Math.round(cy + Math.sin(th) * (rr + w));
          if (dither(x, y) >= f * 0.9 * (1 - Math.abs(w - 0.5) / 4)) continue;
          g.put(x, y, w === 0 || w === 1 ? p.hot : w > 1 ? p.mid : p.deep, 0.85);
        }
      }
    }
    // The chain from the hands to the ring (the ring sits 8 px behind the anchor's middle).
    const links = this.kit.barnacle ? RUST_LINKS : LINKS;
    drawChain(g, cx, cy, ax - Math.cos(a) * 8, ay - Math.sin(a) * 8, links);
    g.end();
  }
}

/**
 * The slam: the anchor thrown from overhead, arcing down onto (tx, ty); it
 * bites into the ground (`land`), lies there a moment, then is hauled back.
 */
class AnchorSlam extends Fx {
  private img: Phaser.GameObjects.Image;
  private g: Ink;
  private landed = false;

  constructor(
    world: WorldScene,
    private holder: Holder,
    private tx: number,
    private ty: number,
    private kit: DiverKit,
    private land: () => void,
  ) {
    super(world, SLAM_FLIGHT + 230 + 160);
    this.img = this.own(world.add.image(holder.x, holder.y - 34, `${kit.key}_anchor`, 'a12').setPipeline('Lit'));
    this.g = this.ink(140, 120);
  }

  protected step(): void {
    const h = this.holder;
    const hx = h.x;
    const hy = h.y - DIVER_HAND_Y;
    const sx = h.x;
    const sy = h.y - 34;
    // The anchor's middle when it lies bitten in: its crown in the ground, a little above the spot.
    const lx = this.tx;
    const ly = this.ty - 6;
    let x: number;
    let y: number;
    let frame: string;
    let alpha = 1;
    if (this.t < SLAM_FLIGHT) {
      const k = this.t / SLAM_FLIGHT;
      const e = k * k;
      x = sx + (lx - sx) * e;
      y = sy + (ly - sy) * e - Math.sin(k * Math.PI) * 10;
      // Crown first, turning over from pointing up to pointing down at the ground.
      const th = -Math.PI / 2 + Math.PI * e * (lx >= sx ? 1 : -1);
      frame = headFrame('a', Math.cos(th), Math.sin(th));
    } else {
      if (!this.landed) {
        this.landed = true;
        this.land();
      }
      const back = this.t - SLAM_FLIGHT - 230;
      const k = clamp01(back / 160);
      x = lx + (hx - lx) * easeOut(k);
      y = ly + (hy - ly) * easeOut(k);
      alpha = 1 - k;
      frame = 'a4';
    }
    const depth = this.landed ? this.ty + 1 : Math.max(h.y + 2, y + 6);
    this.img.setFrame(frame).setPosition(snap(x), snap(y)).setDepth(depth).setAlpha(alpha);
    const g = this.g.begin(hx, hy, depth - 0.5);
    const links = this.kit.barnacle ? RUST_LINKS : LINKS;
    // Slack while it lies there, taut as it flies or is hauled.
    const slack = this.landed && this.t < SLAM_FLIGHT + 230 ? 4 : 0;
    drawChain(g, hx, hy, x, y - 7, links, slack, alpha);
    g.end();
  }
}

/**
 * Cracks split out through the ground where the anchor came down: dark
 * jagged rays lit along their seams with the sea's light, a shock ring,
 * fading to a dither.
 */
class GroundCrack extends Fx {
  private g: Ink;
  private rays: { x: number; y: number }[][] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private kit: DiverKit,
  ) {
    super(world, 950);
    this.g = this.ink(84, 56);
    const seed = Math.floor(Math.random() * 1000);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const base = (i / n) * Math.PI * 2 + (hash(i, seed) - 0.5) * 0.6;
      const len = 13 + hash(i, seed, 2) * 13;
      const pts = [{ x: 0, y: 0 }];
      let a = base;
      let px = 0;
      let py = 0;
      for (let d = 3; d <= len; d += 3) {
        a += (hash(i, seed, d) - 0.5) * 0.9;
        px += Math.cos(a) * 3;
        py += Math.sin(a) * 3 * GROUND;
        pts.push({ x: px, y: py });
      }
      this.rays.push(pts);
    }
  }

  protected step(): void {
    const k = this.t / this.life;
    const p = this.kit.pal;
    const g = this.g.begin(this.x, this.y, this.y - 4);
    const grow = clamp01(this.t / 90);
    const fade = 1 - clamp01((k - 0.45) / 0.55);
    for (const pts of this.rays) {
      const upto = Math.max(1, Math.round((pts.length - 1) * grow));
      for (let i = 1; i <= upto; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const n = 3;
        for (let j = 0; j <= n; j++) {
          const x = Math.round(this.x + a.x + (b.x - a.x) * (j / n));
          const y = Math.round(this.y + a.y + (b.y - a.y) * (j / n));
          if (dither(x, y) >= fade) continue;
          g.put(x, y, 0x140e0a, 0.9);
          // The seam glows near the middle and early on.
          const glow = (1 - i / pts.length) * (1 - k);
          if (glow > 0.15) g.put(x, y - 1, glow > 0.5 ? p.hot : p.mid, Math.min(1, glow * 1.4));
        }
      }
    }
    if (k < 0.4) ring(g, this.x, this.y, 4 + SLAM_RADIUS * easeOut(k / 0.4), 1.2, p, 1 - k / 0.4);
    g.end();
  }
}

/**
 * The harpoon on its chain: it flies out at hand height, running through
 * every foe in its way (each struck once and slowed), until its reach runs
 * out or it hits a wall; it bites, yanks, and is reeled back to the diver,
 * hauling everything on it along.
 */
class HarpoonLine extends Fx {
  private img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private g: Ink;
  private gx: number;
  private gy: number;
  private travelled = 0;
  private phase: 'out' | 'bite' | 'reel' = 'out';
  private phaseT = 0;
  private caught: Hurtbox[] = [];
  private trailT = 0;

  constructor(
    world: WorldScene,
    private holder: Holder,
    private dx: number,
    private dy: number,
    private kit: DiverKit,
    private power: number,
  ) {
    super(world, 3200);
    this.gx = holder.x + dx * 6;
    this.gy = holder.y + dy * 3;
    const f = headFrame('h', dx, dy);
    this.img = this.own(world.add.image(this.gx, this.gy - DIVER_HAND_Y, `${kit.key}_harpoon`, f).setPipeline('Lit'));
    this.glow = this.own(world.add.image(this.gx, this.gy - DIVER_HAND_Y, `${kit.key}_harpoon_e`, f).setBlendMode(Phaser.BlendModes.ADD));
    this.g = this.ink(HARPOON_RANGE * 2 + 40, HARPOON_RANGE * 2 + 40);
  }

  protected step(dt: number): void {
    const w = this.world;
    const h = this.holder;
    const p = this.kit.pal;
    this.phaseT += dt;
    if (this.phase === 'out') {
      let move = (HARPOON_SPEED * dt) / 1000;
      // In small steps, so it can't skip over a body.
      while (move > 0 && this.phase === 'out') {
        const s = Math.min(4, move);
        move -= s;
        this.gx += this.dx * s;
        this.gy += this.dy * s;
        this.travelled += s;
        for (const foe of w.hurtboxesWhere((b) => b.alive && !this.caught.includes(b) && inFlight(b, this.gx, this.gy, DIVER_HAND_Y))) {
          this.caught.push(foe);
          foe.hurt({ damage: HARPOON_DAMAGE * this.power, heavy: false, knock: 0, fromX: this.gx - this.dx * 6, fromY: this.gy - this.dy * 6 });
          foe.slow?.(0.35, 900, p.mid);
          w.debris([0xffffff, p.hot, p.mid], foe.x, foe.y - foe.bodyY, 6, foe.y + 14, 'burst');
          sound.arrowHit(w.pan(foe.x));
        }
        if (this.travelled >= HARPOON_RANGE || !w.walkable(this.gx, this.gy)) {
          if (!w.walkable(this.gx, this.gy)) w.debris([0xffffff, 0xb8a888], this.gx, this.gy - DIVER_HAND_Y, 4, this.gy + 10, 'burst');
          this.phase = 'bite';
          this.phaseT = 0;
        }
      }
    } else if (this.phase === 'bite') {
      if (this.phaseT >= HARPOON_BITE) {
        // The line goes taut with a jerk: everything on it is yanked round.
        this.phase = 'reel';
        this.phaseT = 0;
        const on = this.caught.filter((b) => b.alive);
        for (const b of on) b.hurt({ damage: YANK_DAMAGE * this.power, heavy: true, knock: 0, fromX: h.x, fromY: h.y });
        if (on.length) {
          w.cameras.main.shake(90, 0.0012);
          bloom(w, this.gx, this.gy - DIVER_HAND_Y, p.hot, 0.8, 200, this.gy + 20, 0.7);
        }
        sound.ratchet(w.pan(this.gx));
      }
    } else {
      // Reeled in towards the diver's feet, the catch dragged along with the head.
      const tx = h.x + this.dx * REEL_STOP;
      const ty = h.y + this.dy * REEL_STOP * 0.6;
      const ddx = tx - this.gx;
      const ddy = ty - this.gy;
      const d = Math.hypot(ddx, ddy);
      const s = Math.min(d, (REEL_SPEED * dt) / 1000);
      if (d > 0.01) {
        this.gx += (ddx / d) * s;
        this.gy += (ddy / d) * s;
      }
      this.caught.forEach((b, i) => {
        if (!b.alive) return;
        // Bunched round the head, a little apart, not on top of one another.
        const off = (i - (this.caught.length - 1) / 2) * 7;
        const want = { x: this.gx - this.dy * off, y: this.gy + this.dx * off * 0.6 };
        const m = b as Hurtbox & { shove?(dx: number, dy: number): void };
        const bx = want.x - b.x;
        const by = want.y - b.y;
        const bd = Math.hypot(bx, by);
        if (!m.shove || bd < 1) return;
        const step = Math.min(bd, ((REEL_SPEED * 1.15) * dt) / 1000);
        const nx = b.x + (bx / bd) * step;
        const ny = b.y + (by / bd) * step;
        if (w.walkable(nx, ny)) m.shove(nx - b.x, ny - b.y);
      });
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 60;
        w.debris(this.kit.water, this.gx, this.gy, 1, this.gy + 2, 'trail');
      }
      if (d < 2 || this.phaseT > 1600) {
        sound.clash(w.pan(h.x), false);
        this.destroy();
        return;
      }
    }

    const hx = this.gx;
    const hy = this.gy - DIVER_HAND_Y;
    const f = headFrame('h', this.dx, this.dy);
    const depth = this.gy + 2;
    this.img.setFrame(f).setPosition(snap(hx), snap(hy)).setDepth(depth);
    this.glow.setFrame(f).setPosition(snap(hx), snap(hy)).setDepth(depth + 0.1);
    // The chain from the gun to the harpoon's tail ring, slack and wavering while it flies, taut once it bites.
    const from = { x: h.x + this.dx * 6, y: h.y - DIVER_HAND_Y + this.dy * 2 };
    const g = this.g.begin(from.x, from.y, Math.min(h.y, this.gy) + 1.5);
    const links = this.kit.barnacle ? RUST_LINKS : LINKS;
    const slack = this.phase === 'out' ? 2 + Math.sin(this.t * 0.04) * 1.5 : this.phase === 'bite' ? 1 : 0;
    drawChain(g, from.x, from.y, hx - this.dx * 8, hy - this.dy * 8, links, slack);
    if (this.phase === 'bite' && this.phaseT < 60) ring(g, hx, hy + DIVER_HAND_Y, 6, 1, p, 1 - this.phaseT / 60);
    g.end();
  }
}
