import Phaser from 'phaser';
import { BEAST_MOUTH_Y, BEAST_TIMING, FIREBOLT_FRAMES } from '../art/beast';
import { snap } from './display';
import { sound } from '../audio';
import { inFlight, type Hurtbox } from './combat';
import { HitSpark, type Effect } from './Slash';
import { bloom, clamp01, flare, Fx, hash, pal, strikeGround, type Ink, type Pal } from './ultimate/ink';
import { Beast, type BeastKit } from './Beast';
import { dirOf } from './Wizard';
import { turnMidMove } from './anims';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';

// The Dragon (the Beastkin's third type): scaled, slow and fiery.
//  - Attack (held): Dragonfire. He spits a bolt of fire that bursts on the
//    first foe it meets, scorching those next to it.
//  - Ability: Flame breath. He rears and pours out a long cone of fire the
//    way he aims (he can turn it as he goes), burning all in it.
//  - Special: Wrath of the Wyrm (see ultimate/beast.ts). A great serpent of
//    flame leaves his jaws, coils round the spot he aims at, and dives into
//    it in a blast.

const SPIT_MS = BEAST_TIMING.spit.ms;
const SPIT_LAND = BEAST_TIMING.spit.land;
const BOLT_SPEED = 200;
const BOLT_RANGE = 120;
const BOLT_DAMAGE = 9;
const BOLT_BURST = 14;
/** The bolt's flight height, about the jaws'. */
const BOLT_H = 15;

const BREATH_MS = 1200;
const BREATH_COOLDOWN = 7000;
const BREATH_REACH = 56;
const BREATH_SPREAD = (22 * Math.PI) / 180;
const BREATH_TICK = 150;
const BREATH_DAMAGE = 3;

const dragonStats = HERO_STATS['beast.dragon'];

export const DRAGON_KIT: BeastKit = {
  key: 'dragon',
  kind: 'dragon',
  maxHp: dragonStats.hp,
  speed: dragonStats.speed,
  pal: pal(0xfff8d0, 0xffd060, 0xff7a10, 0xb02a08, 0xff9030),
  fx: { core: 0xfff8d0, hot: 0xffd060, mid: 0xff7a10, deep: 0xb02a08, light: 0xff9030 },
  club: false,
};

/** Porto: the dragon in blue and white stripes, royal blue scales, and fire burning blue. */
export const PORTO_KIT: BeastKit = {
  ...DRAGON_KIT,
  key: 'dragon_porto',
  pal: pal(0xf4ffff, 0x9ee4ff, 0x2a8cff, 0x0a2a8a, 0x60b0ff),
  fx: { core: 0xf4ffff, hot: 0x9ee4ff, mid: 0x2a8cff, deep: 0x0a2a8a, light: 0x60b0ff },
  club: true,
};

/** The Jade Serpent: an Eastern dragon whose fire burns pale jade and gold, curling into wisps of cloud. */
export const JADE_KIT: BeastKit = {
  ...DRAGON_KIT,
  key: 'dragon_jade',
  pal: pal(0xfffff0, 0xf4e8a0, 0x5ad8a0, 0x147a5a, 0x9af0c0),
  fx: { core: 0xfffff0, hot: 0xf4e8a0, mid: 0x5ad8a0, deep: 0x147a5a, light: 0x9af0c0 },
  motes: [0xffffff, 0xdcf4ec, 0xb8e8d8],
};

export class Dragon extends Beast {
  private breathCd = 0;
  private tickT = 0;
  private roarT = 0;
  private flame: Breath | null = null;

  constructor(world: WorldScene, x: number, y: number, kit: BeastKit = DRAGON_KIT) {
    super(world, x, y, kit);
  }

  protected tick(dt: number): void {
    this.breathCd = Math.max(0, this.breathCd - dt);
  }

  protected attack(): void {
    this.begin('spit', 'spit', SPIT_MS, SPIT_LAND);
  }

  protected ability(): void {
    if (this.breathCd > 0) return;
    this.breathCd = BREATH_COOLDOWN;
    this.begin('breath', 'breath', BREATH_MS, 0);
    this.tickT = 0;
    this.roarT = 0;
  }

  protected paceIn(move: string): number {
    return move === 'breath' ? 0.3 : 0.45;
  }

  protected readiness(): number {
    return this.move === 'breath' ? 0 : 1 - this.breathCd / BREATH_COOLDOWN;
  }

  protected lampLevel(): number {
    return this.move === 'breath' ? 1.2 : this.move === 'spit' ? 0.7 : 0.15;
  }

  /** The jaws: where fire leaves him. */
  private mouth(u: { x: number; y: number }): { x: number; y: number; ground: number } {
    return { x: this.x + u.x * 7, y: this.y - BEAST_MOUTH_Y + u.y * 4, ground: this.y + u.y * 7 };
  }

  protected land(move: string): void {
    if (move === 'spit') {
      const u = this.aimVec();
      this.fx.push(new Firebolt(this.world, this.x + u.x * 7, this.y + u.y * 6, u.x, u.y, this.kit));
      sound.fireball(this.world.pan(this.x));
      return;
    }
    // The breath: the flame lives as long as he pours it out.
    const f = new Breath(this.world, this.kit.pal, this.kit.motes);
    this.flame = f;
    this.fx.push(f);
    sound.ignite();
  }

  protected during(move: string, dt: number): void {
    if (move !== 'breath') return;
    // He turns the fire as he goes: it follows his aim.
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    const want = `${this.kit.key}_breath_${this.dir}`;
    if (this.body.anims.currentAnim?.key !== want) turnMidMove(this.body, want);
    const m = this.mouth(u);
    this.flame?.aim(m.x, m.y, m.ground, u.x, u.y);
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = BREATH_TICK;
      const hits = this.world.melee(
        { kind: 'arc', x: m.x, y: m.ground - 8, radius: BREATH_REACH, angle: Math.atan2(u.y, u.x), spread: BREATH_SPREAD },
        { damage: BREATH_DAMAGE, knock: 40, fromX: this.x, fromY: this.y },
      );
      if (hits.length) sound.sizzle(this.world.pan(hits[0].x));
    }
    this.roarT -= dt;
    if (this.roarT <= 0) {
      this.roarT = 280;
      sound.flame(this.world.pan(this.x));
    }
    if (this.moveT + dt >= BREATH_MS) {
      this.flame?.stop();
      this.flame = null;
    }
  }
}

// ---------------------------------------------------------------------------

/**
 * A firebolt: a flickering ball of flame flying BOLT_H px up, shedding
 * embers; it bursts on the first body it meets (scorching those beside it),
 * or gutters out at the end of its flight.
 */
class Firebolt implements Effect {
  dead = false;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private shade: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private travelled = 0;
  private t = 0;
  private trailT = 0;
  private readonly inPath = (h: Hurtbox) => inFlight(h, this.x, this.y, BOLT_H, 2);

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private kit: BeastKit,
  ) {
    const key = `firebolt_${kit.key}`;
    this.sprite = world.add.sprite(x, y - BOLT_H, key, 'f0');
    this.glow = world.add.sprite(x, y - BOLT_H, `${key}_e`, 'f0').setBlendMode(Phaser.BlendModes.ADD);
    this.shade = world.add.image(x, y, 'shadow').setDepth(1).setScale(0.4, 0.3).setAlpha(0.3);
    this.light = world.lights.addLight(x, y - BOLT_H, 50, kit.pal.light, 1.4);
    this.place();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    let move = (BOLT_SPEED * dt) / 1000;
    while (move > 0) {
      const d = Math.min(3, move);
      move -= d;
      this.x += this.ux * d;
      this.y += this.uy * d;
      this.travelled += d;
      const h = this.world.firstHurtbox(this.inPath);
      if (h || this.travelled >= BOLT_RANGE || (!this.world.walkable(this.x, this.y) && this.travelled > 20)) {
        this.burst(!!h);
        return;
      }
    }
    this.place();
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 30;
      const p = this.kit.pal;
      this.world.debris([p.hot, p.mid, p.deep], snap(this.x - this.ux * 4), snap(this.y - BOLT_H - this.uy * 4), 1, this.y, 'trail');
      // The Jade Serpent's bolt trails little wisps of cloud.
      if (this.kit.motes && Math.random() < 0.35) this.world.debris(this.kit.motes, snap(this.x - this.ux * 6), snap(this.y - BOLT_H - this.uy * 6), 1, this.y, 'spores');
    }
  }

  private place(): void {
    const x = snap(this.x);
    const y = snap(this.y - BOLT_H);
    const frame = `f${Math.floor(this.t / 70) % FIREBOLT_FRAMES}`;
    this.sprite.setPosition(x, y).setDepth(this.y + 1).setFrame(frame);
    this.glow.setPosition(x, y).setDepth(this.y + 1.1).setFrame(frame);
    this.shade.setPosition(snap(this.x), snap(this.y));
    this.light.setPosition(this.x, this.y - BOLT_H);
  }

  /** It bursts: flame over a small circle, a flash, embers. */
  private burst(struck: boolean): void {
    const w = this.world;
    const p = this.kit.pal;
    const bx = this.x;
    const by = this.y;
    if (struck) {
      const hits = strikeGround(w, bx, by, BOLT_BURST, { damage: BOLT_DAMAGE, knock: 70, fromX: bx - this.ux * 8, fromY: by - this.uy * 8 });
      for (const h of hits) w.addEffect(new HitSpark(w, h.x, h.y - h.bodyY, this.kit.fx, h.y + 13, false));
    }
    bloom(w, bx, by - BOLT_H, p.hot, struck ? 1.1 : 0.6, 280, by + 20);
    flare(w, bx, by - BOLT_H, 60, p.light, 1.6, 260);
    w.debris(p.tints, bx, by - BOLT_H, struck ? 10 : 5, by + 12, 'burst');
    if (struck) sound.sizzle(w.pan(bx));
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
    this.glow.destroy();
    this.shade.destroy();
    this.world.lights.removeLight(this.light);
  }
}

/**
 * The breath of fire: a cone of flame pouring from the jaws, licking tongues
 * racing out along it, white at the jaws through the fire's colours to smoke
 * at its end, lighting the ground. Steered each frame by `aim`.
 */
class Breath extends Fx {
  private g: Ink;
  private lamp: Phaser.GameObjects.Light;
  private mx = 0;
  private my = 0;
  private ground = 0;
  private ux = 0;
  private uy = 1;
  private ending = -1;
  /** When it was last steered: a breath nobody pours out any more dies away. */
  private fed = 0;

  constructor(
    world: WorldScene,
    private p: Pal,
    /** What drifts off the flame's end instead of its sparks (the Jade Serpent's cloud wisps). */
    private motes?: number[],
  ) {
    super(world, 60000);
    this.g = this.ink(BREATH_REACH * 2 + 24, BREATH_REACH * 2 + 24);
    this.lamp = this.light(0, 0, 90, p.light, 0);
  }

  aim(x: number, y: number, ground: number, ux: number, uy: number): void {
    this.mx = x;
    this.my = y;
    this.ground = ground;
    this.ux = ux;
    this.uy = uy;
    this.fed = this.t;
  }

  /** The breath is spent: the flame dies back to the jaws. */
  stop(): void {
    if (this.ending < 0) this.ending = 0;
  }

  protected step(dt: number): void {
    if (this.t - this.fed > 150) this.stop();
    if (this.ending >= 0) {
      this.ending += dt;
      if (this.ending > 220) {
        this.destroy();
        return;
      }
    }
    const { p, mx, my, ux, uy } = this;
    const grow = clamp01(this.t / 160) * (this.ending >= 0 ? 1 - this.ending / 220 : 1);
    const reach = BREATH_REACH * grow;
    const g = this.g.begin(mx, my, this.ground + BREATH_REACH * Math.max(0, uy) + 8);
    const a0 = Math.atan2(uy, ux);
    // Tongues of flame: each a streak at its own angle, racing out and falling a little as it goes.
    const N = 26;
    for (let i = 0; i < N; i++) {
      const seed = hash(i, Math.floor(this.t / 60));
      const ang = a0 + (hash(i, 7) * 2 - 1) * BREATH_SPREAD * 0.95;
      const phase = ((this.t * 0.0045 + hash(i, 3)) % 1) * reach;
      const len = 8 + seed * 10;
      for (let r = Math.max(0, phase - len); r <= phase; r += 0.9) {
        const f = r / BREATH_REACH;
        const wob = Math.sin(r * 0.4 + this.t * 0.02 + i) * (1 + f * 2);
        const px = mx + Math.cos(ang) * r - Math.sin(ang) * wob;
        const py = my + Math.sin(ang) * r * 0.8 + Math.cos(ang) * wob + f * f * 6;
        const c = f < 0.18 ? p.core : f < 0.45 ? p.hot : f < 0.75 ? p.mid : p.deep;
        g.put(px, py, c, f > 0.85 ? 0.6 : 1);
      }
    }
    // A white-hot core at the jaws.
    for (let r = 0; r < Math.min(10, reach); r += 1) for (let s = -1; s <= 1; s++) g.put(mx + ux * r - uy * s * (1 + r * 0.15), my + uy * r * 0.8 + ux * s * (1 + r * 0.15), r < 5 ? p.core : p.hot);
    g.end();
    this.lamp.setPosition(mx + ux * reach * 0.5, my + uy * reach * 0.5);
    this.lamp.intensity = 2.2 * grow * (0.85 + 0.15 * Math.sin(this.t * 0.05));
    if (Math.random() < dt / 40) this.world.debris(this.motes ?? p.tints, mx + ux * reach * 0.8, my + uy * reach * 0.7, 1, this.ground + 20, 'spores');
  }
}
