import { heroTimers } from './timers';
import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { WRAITH_CHEST_Y, WRAITH_H, WRAITH_LANTERN_Y, WRAITH_ORIGIN_X, WRAITH_ORIGIN_Y, WRAITH_W } from '../art/wraith';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { Phase, PHASE_SPEED } from './phase';
import { bloom, Fx, pal, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Lantern Wraith (the Phantom's second type): a hooded wraith carrying an
// old iron lantern on a chain.
//  - Attack (held): it swings the lantern, which strikes what's in front and
//    leaves will-o'-wisps drifting in the air behind it; they float onto the
//    nearest foes and cling to them, burning.
//  - Ability: Possess. It dives into a foe and rides it: the foe stands
//    helpless, its face lit by the ghost inside, and the player steers it
//    into the others, lashing out at them with the attack. When the time's
//    up (or the ability is pressed again) the wraith bursts out, tearing it.
//    Bosses are too strong to take: it haunts them instead, hurting and
//    slowing them.
//  - Special: Dead of Night (see ultimate/phantom.ts).
// Like every Phantom it phases through the next blow (see phase.ts).
// The Calavera leaves marigold petals and gives the possessed a sugar-skull
// face; it plays the same.

const SWING_EVERY = 460;
/** The lantern strikes this long into the swing. */
const SWING_HIT = 130;
const SWING_REACH = 24;
const SWING_DAMAGE = 7;
const WISPS_PER_SWING = 2;
const WISPS_MAX = 10;
const WISP_RANGE = 110;
const WISP_SPEED = 130;
const WISP_BURN = 3;
const WISP_TICKS = 3;
const WISP_TICK = 350;
const WISP_LIFE = 4000;

const POSSESS_RANGE = 75;
const POSSESS_CONE = Math.cos((70 * Math.PI) / 180);
const POSSESS_MS = 3500;
/** How often the ridden foe's bind is renewed (it lasts 400 ms, so it never lapses). */
const BIND_EVERY = 250;
const POSSESS_DIVE = 220;
const POSSESS_COOLDOWN = 8000;
/** Steering the possessed foe, px/s. */
const RIDE_SPEED = 55;
const LASH_EVERY = 500;
const LASH_REACH = 28;
const LASH_DAMAGE = 12;
const BURST_DAMAGE = 20;
/** A boss can't be ridden: haunted instead. */
const HAUNT_DAMAGE = 16;
const HAUNT_SLOW = 0.5;
const HAUNT_MS = 1500;

type State = 'free' | 'swing' | 'dive' | 'inside';

export interface WraithKit {
  key: string;
  cala: boolean;
  maxHp: number;
  speed: number;
  /** The wisp texture (its animation is `<wisp>_flicker`), and the possession mark's frame. */
  wisp: string;
  mark: 'w' | 'c';
  pal: Pal;
}

export const WRAITH_KIT: WraithKit = {
  key: 'wraith',
  cala: false,
  maxHp: HERO_STATS['phantom.wraith'].hp,
  speed: HERO_STATS['phantom.wraith'].speed,
  wisp: 'soulwisp',
  mark: 'w',
  pal: pal(0xe0fff4, 0x7af0c0, 0x2ab888, 0x0e4a3a, 0x6af0b8),
};

export const CALA_KIT: WraithKit = {
  ...WRAITH_KIT,
  key: 'wraith_cala',
  cala: true,
  wisp: 'soulwisp_petal',
  mark: 'c',
  pal: pal(0xfffbd0, 0xffd860, 0xff9a2a, 0xa0400a, 0xffc060),
};

type Bindable = Hurtbox & { bind?(ms: number, lift: number): boolean; shove?(dx: number, dy: number): void };

/** Wisps alive in the world, so a long fight doesn't fill the air with them. */
let wispsAlive = 0;

export class Wraith implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: WraithKit;
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
  private swingT = 0;
  private hitT = -1;
  private possessCd = 0;
  private prevSpecial = false;
  // Possession.
  private host: Bindable | null = null;
  private diveT = 0;
  private dive = { x0: 0, y0: 0 };
  private insideT = 0;
  private lashT = 0;
  /** Until the host's bind is refreshed: kept fresh every so often, not every frame, so online it isn't relayed 60 times a second. */
  private bindT = 0;
  private mark: Phaser.GameObjects.Image;
  private hostGlow: Phaser.GameObjects.Image;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: WraithKit = WRAITH_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = WRAITH_ORIGIN_X / WRAITH_W;
    const oy = WRAITH_ORIGIN_Y / WRAITH_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 70, kit.pal.light, 0);
    this.phase = new Phase(world, this, kit.pal.hot);
    this.mark = world.add.image(0, 0, 'possess_mark', kit.mark).setVisible(false);
    this.hostGlow = world.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(kit.pal.mid).setVisible(false);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (this.state === 'swing' && anim.key.startsWith(`${key}_swing_`)) this.state = 'free';
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.phase.destroy();
      this.mark.destroy();
      this.hostGlow.destroy();
      wispsAlive = 0;
    });
  }

  dodge(): boolean {
    // Inside a foe, blows can't find it.
    if (this.state === 'inside' || this.state === 'dive') return true;
    return this.phase.dodge();
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.swingT = Math.max(0, this.swingT - dt);
    this.possessCd = Math.max(0, this.possessCd - dt);
    this.phase.update(dt);
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;

    if (this.state === 'dive') this.updateDive(dt);
    else if (this.state === 'inside') this.updateInside(dt, mx, my, len, attack, pressed);
    else {
      if (pressed && this.possessCd === 0) this.startPossess();
      else if (attack && this.swingT === 0 && this.state === 'free') this.swing();
      if (this.state === 'swing' && this.hitT >= 0) {
        this.hitT -= dt;
        if (this.hitT < 0) this.land();
      }
      const k = this.state === 'swing' ? 0.6 : 1;
      const speed = this.kit.speed * k * (this.phase.active ? PHASE_SPEED : 1) * Math.min(1, len);
      if (moving) {
        this.x = Phaser.Math.Clamp(this.x + (mx / len) * speed * (dt / 1000), bounds.left, bounds.right);
        this.y = Phaser.Math.Clamp(this.y + (my / len) * speed * (dt / 1000), bounds.top, bounds.bottom);
      }
      if (this.state === 'free') {
        if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
        else if (moving) this.dir = dirOf(mx, my);
        const key = moving ? `${this.kit.key}_move_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
        if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
      }
    }
    this.sync();
    this.updateHud();
  }

  // -------------------------------------------------------------------------
  // The lantern

  private swing(): void {
    const u = this.aimVec();
    this.swingT = SWING_EVERY;
    this.state = 'swing';
    this.hitT = SWING_HIT;
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_swing_${this.dir}`, true);
    sound.swing(1, this.world.pan(this.x));
  }

  /** The lantern comes round: it strikes in front, and leaves wisps in the air. */
  private land(): void {
    const w = this.world;
    const u = this.aimVec();
    const cx = this.x;
    const cy = this.y - WRAITH_CHEST_Y + 8;
    const hits = w.melee({ kind: 'arc', x: cx, y: cy, radius: SWING_REACH, angle: Math.atan2(u.y, u.x), spread: Math.PI / 3 }, { damage: SWING_DAMAGE, knock: 60 });
    for (const h of hits) w.debris(this.kit.pal.tints, h.x, h.y, 4, h.y + 12, 'burst');
    if (hits.length) sound.impact(w.pan(cx), true);
    const lx = this.x + (this.dir === 'left' ? -4.5 : this.dir === 'right' ? 4.5 : 5.5) + u.x * 4;
    const ly = this.y - WRAITH_LANTERN_Y + u.y * 4;
    for (let i = 0; i < WISPS_PER_SWING && wispsAlive < WISPS_MAX; i++) {
      w.addEffect(new Wisp(w, lx + (i ? 4 : -4), ly - i * 3, this.kit, this));
    }
  }

  // -------------------------------------------------------------------------
  // Possession

  private startPossess(): void {
    const u = this.aimVec();
    const target = this.pickHost(u);
    if (!target) {
      // Nothing to take: a wisp of disappointment.
      this.possessCd = 600;
      this.world.debris(this.kit.pal.tints, this.x + u.x * 10, this.y - WRAITH_CHEST_Y, 5, this.y + 10, 'spores');
      return;
    }
    this.host = target;
    this.state = 'dive';
    this.diveT = 0;
    this.dive = { x0: this.x, y0: this.y };
    this.dir = dirOf(target.x - this.x, target.y - this.y);
    this.body.play(`${this.kit.key}_possess_${this.dir}`, true);
    this.world.evade(POSSESS_DIVE + 200);
    sound.vanish(this.world.pan(this.x));
  }

  private pickHost(u: { x: number; y: number }): Bindable | null {
    const cands = this.world.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - this.x, h.y - this.y) <= POSSESS_RANGE);
    let best: Hurtbox | null = null;
    let bestScore = Infinity;
    for (const h of cands) {
      const dx = h.x - this.x;
      const dy = h.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const ahead = (dx * u.x + dy * u.y) / d >= POSSESS_CONE;
      const score = d * (ahead ? 1 : 3);
      if (score < bestScore) {
        bestScore = score;
        best = h;
      }
    }
    return best as Bindable | null;
  }

  private updateDive(dt: number): void {
    const h = this.host;
    this.diveT += dt;
    const k = Math.min(1, this.diveT / POSSESS_DIVE);
    if (!h || !h.alive) {
      this.state = 'free';
      this.host = null;
      return;
    }
    this.x = this.dive.x0 + (h.x - this.dive.x0) * k;
    this.y = this.dive.y0 + (h.y - this.dive.y0) * k;
    if (Math.floor(this.diveT / 30) !== Math.floor((this.diveT - dt) / 30)) this.world.debris(this.kit.pal.tints, this.x, this.y - WRAITH_CHEST_Y, 1, this.y + 10, 'trail');
    if (k < 1) return;
    const w = this.world;
    this.possessCd = POSSESS_COOLDOWN;
    // A boss won't be ridden: it's haunted as the wraith passes through.
    if (!h.bind?.(POSSESS_MS, 0)) {
      h.hurt({ damage: HAUNT_DAMAGE, heavy: true, knock: 80, fromX: this.dive.x0, fromY: this.dive.y0 });
      h.slow?.(HAUNT_SLOW, HAUNT_MS, this.kit.pal.mid);
      w.debris(this.kit.pal.tints, h.x, h.y - h.bodyY, 14, h.y + 10, 'burst');
      sound.wail(w.pan(h.x));
      this.host = null;
      this.state = 'free';
      this.world.evade(500);
      return;
    }
    this.state = 'inside';
    this.insideT = POSSESS_MS;
    heroTimers.follow('possess', 'ability', '', this.kit.pal.hot, () => (this.state === 'inside' ? { left: this.insideT, total: POSSESS_MS } : null));
    this.lashT = 0;
    this.bindT = 0;
    this.mark.setVisible(true);
    this.hostGlow.setVisible(true);
    w.debris(this.kit.pal.tints, h.x, h.y - h.bodyY, 16, h.y + 10, 'gather');
    bloom(w, h.x, h.y - h.bodyY, this.kit.pal.hot, 1.8, 300, h.y + 20);
    sound.wail(w.pan(h.x));
  }

  /** Riding a foe: steer it, lash at the others, and burst out when the time's up. */
  private updateInside(dt: number, mx: number, my: number, len: number, attack: boolean, pressed: boolean): void {
    const h = this.host;
    this.insideT -= dt;
    this.lashT = Math.max(0, this.lashT - dt);
    if (!h || !h.alive || this.insideT <= 0 || pressed) {
      this.burstOut();
      return;
    }
    // Held fast (the bind is kept fresh), and steered where the player pushes.
    this.bindT -= dt;
    if (this.bindT <= 0) {
      this.bindT = BIND_EVERY;
      h.bind?.(Math.min(400, this.insideT + 50), 0);
    }
    if (len > 0.18 && h.shove) {
      const step = (RIDE_SPEED * Math.min(1, len) * dt) / 1000;
      const nx = h.x + (mx / len) * step;
      const ny = h.y + (my / len) * step;
      if (this.world.walkable(nx, ny)) h.shove((mx / len) * step, (my / len) * step);
    }
    this.x = h.x;
    this.y = h.y;
    this.world.evade(150);
    if (attack && this.lashT === 0) this.lash(h);
  }

  /** The possessed foe lashes out at the others round it. */
  private lash(host: Hurtbox): void {
    const w = this.world;
    this.lashT = LASH_EVERY;
    const x = host.x;
    const y = host.y - host.bodyY;
    const near = w.hurtboxesWhere((b) => b !== host && b.alive && Math.hypot(b.x - host.x, b.y - host.y) <= LASH_REACH + b.radius);
    for (const b of near) {
      b.hurt({ damage: LASH_DAMAGE, heavy: true, knock: 120, fromX: x, fromY: y });
      w.debris(this.kit.pal.tints, b.x, b.y - b.bodyY, 5, b.y + 10, 'burst');
    }
    w.debris(this.kit.pal.tints, x, y, 8, host.y + 10, 'burst');
    bloom(w, x, y, this.kit.pal.mid, 1.2, 200, host.y + 20);
    sound.clash(w.pan(x), near.length > 0);
  }

  private burstOut(): void {
    const w = this.world;
    const h = this.host;
    this.host = null;
    this.state = 'free';
    this.mark.setVisible(false);
    this.hostGlow.setVisible(false);
    if (h) {
      // Out it tears, the foe torn with it.
      if (h.alive) h.hurt({ damage: BURST_DAMAGE, heavy: true, knock: 140, fromX: h.x - this.lastMove.x * 6, fromY: h.y - this.lastMove.y * 6 });
      w.debris(this.kit.pal.tints, h.x, h.y - h.bodyY, 18, h.y + 10, 'burst');
      bloom(w, h.x, h.y - h.bodyY, this.kit.pal.hot, 2, 300, h.y + 20);
      // It comes out beside the foe, on ground it can stand on.
      for (const [dx, dy] of [[-14, 6], [14, 6], [0, 12], [0, -10]]) {
        if (w.walkable(h.x + dx, h.y + dy)) {
          this.x = h.x + dx;
          this.y = h.y + dy;
          break;
        }
      }
    }
    w.evade(500);
    this.body.play(`${this.kit.key}_idle_${this.dir}`, true);
    sound.wail(w.pan(this.x));
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = this.state === 'inside' ? this.insideT / POSSESS_MS : 1 - this.possessCd / POSSESS_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'inside';
    comboHud.hits = 0;
    comboHud.window = 0;
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    // Inside a foe it can't be seen; diving, it fades into it.
    const hidden = this.state === 'inside' ? 0 : this.state === 'dive' ? 1 - Math.min(1, this.diveT / POSSESS_DIVE) : 1;
    const a = this.alpha * this.phase.opacity * hidden;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(a);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha * hidden);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha * 0.6 * hidden);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * a * 0.6);
    // The lantern's light (from the host's face while inside it).
    const h = this.host;
    if (this.state === 'inside' && h) {
      const hy = h.y - h.bodyY;
      this.aura.setPosition(h.x, hy);
      this.mark.setPosition(snap(h.x), snap(hy - 3)).setDepth(h.y + 0.5).setAlpha(0.8 + 0.2 * Math.sin(this.clock * 0.02));
      this.hostGlow.setPosition(snap(h.x), snap(hy)).setDepth(h.y - 0.5).setScale(1 + 0.1 * Math.sin(this.clock * 0.01)).setAlpha(0.55);
      this.aura.intensity = 1.2;
      if (Math.floor(this.clock / 120) !== Math.floor((this.clock - 16) / 120)) this.world.debris(this.kit.pal.tints, h.x + (Math.random() - 0.5) * 10, hy - 4, 1, h.y + 10, 'spores');
    } else {
      this.aura.setPosition(rx + (this.dir === 'left' ? -4.5 : 4.5), ry - WRAITH_LANTERN_Y);
      this.aura.intensity = 0.9 * (1 - this.daylight) + 0.3;
    }
  }
}

/**
 * A will-o'-wisp (or a marigold petal) left in the air by the lantern: it
 * drifts up a moment, then floats onto the nearest foe and clings, burning a
 * few times before it goes out. With no foe near it wanders by the wraith.
 */
class Wisp extends Fx {
  private sprite: Phaser.GameObjects.Sprite;
  private soft: Phaser.GameObjects.Image;
  private lamp: Phaser.GameObjects.Light;
  private target: Hurtbox | null = null;
  private clung = false;
  private ticks = 0;
  private tickT = 0;
  private vx = 0;
  private vy = -18;
  private seed = Math.random() * 10;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private kit: WraithKit,
    private owner: { x: number; y: number },
  ) {
    super(world, WISP_LIFE);
    wispsAlive++;
    this.sprite = this.own(world.add.sprite(snap(x), snap(y), kit.wisp, 'w0').setBlendMode(Phaser.BlendModes.ADD).play({ key: `${kit.wisp}_flicker`, startFrame: Math.floor(Math.random() * 4) }));
    this.soft = this.halo(kit.pal.mid, 0.35, y + 20);
    this.lamp = this.light(x, y, 30, kit.pal.light, 0.5);
  }

  protected step(dt: number): void {
    const w = this.world;
    const s = dt / 1000;
    if (this.clung && this.target) {
      const h = this.target;
      if (!h.alive) {
        this.destroy();
        return;
      }
      this.x = h.x + Math.sin(this.t * 0.01 + this.seed) * 4;
      this.y = h.y - h.bodyY - 2 + Math.cos(this.t * 0.012 + this.seed) * 3;
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT = WISP_TICK;
        h.hurt({ damage: WISP_BURN, heavy: false, knock: 0, fromX: this.x, fromY: this.y, poison: this.kit.pal.hot });
        w.debris(this.kit.pal.tints, this.x, this.y, 2, h.y + 10, 'spores');
        if (++this.ticks >= WISP_TICKS) {
          this.destroy();
          return;
        }
      }
    } else {
      if (this.t > 250) {
        if (!this.target || !this.target.alive) {
          this.target = w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - this.x, b.y - b.bodyY - this.y) <= WISP_RANGE).sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0] ?? null;
        }
        const tx = this.target ? this.target.x : this.owner.x + Math.cos(this.t * 0.002 + this.seed) * 22;
        const ty = this.target ? this.target.y - this.target.bodyY : this.owner.y - 26 + Math.sin(this.t * 0.003 + this.seed) * 8;
        const dx = tx - this.x;
        const dy = ty - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const speed = this.target ? WISP_SPEED : 40;
        const k = 1 - Math.exp(-dt / 180);
        this.vx += ((dx / d) * speed - this.vx) * k;
        this.vy += ((dy / d) * speed - this.vy) * k;
        if (this.target && d < this.target.radius + 3) {
          this.clung = true;
          this.tickT = 0;
        }
      } else this.vy *= 1 - Math.min(1, dt / 300);
      this.x += this.vx * s + Math.sin(this.t * 0.008 + this.seed) * 0.15;
      this.y += this.vy * s;
    }
    const depth = this.y + 26;
    const fade = this.t > WISP_LIFE - 400 ? (WISP_LIFE - this.t) / 400 : 1;
    this.sprite.setPosition(snap(this.x), snap(this.y)).setDepth(depth).setAlpha(fade);
    this.soft.setPosition(snap(this.x), snap(this.y)).setDepth(depth - 0.1).setAlpha(0.35 * fade);
    this.lamp.setPosition(this.x, this.y);
  }

  destroy(): void {
    if (!this.dead) wispsAlive = Math.max(0, wispsAlive - 1);
    super.destroy();
  }
}
