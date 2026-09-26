import { sound } from '../../audio';
import { snap } from '../display';
import { bindFoe } from '../Strings';
import { airborne } from '../Blades';
import { HitSpark, ThrustStreak } from '../Slash';
import type { Samurai } from '../Samurai';
import type { Hero } from '../characters';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, bolt, clamp01, column, easeOut, flare, Fx, hash, line, ring, type Ink } from './ink';
import type { Cast } from './types';

// The Samurai's Specials: the Bladewind's Sky Quake, a sudden storm that
// pours down on every foe already thrown into the air and holds them there,
// then slams them down; and the Ronin's Hundred Cuts, a vanishing flurry
// through every foe near him that bursts open when he sheathes.

/** How far the Sky Quake reaches for foes in the air. */
const QUAKE_REACH = 170;
/** How long the storm holds them up before the slam. */
const QUAKE = 2000;
const QUAKE_LIFT = 18;
const CUTS_REACH = 120;
const CUTS_MAX = 8;
const CUT_GAP = 90;

const nearest = (world: WorldScene, x: number, y: number, reach: number, test: (h: Hurtbox) => boolean): Hurtbox[] =>
  world
    .hurtboxesWhere((h) => h.alive && test(h) && Math.hypot(h.x - x, h.y - y) <= reach)
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));

/**
 * The Sky Quake only answers when a foe is in the air: it holds every one in
 * reach up a little longer while the samurai gathers the storm.
 */
export function quakeGate(world: WorldScene, hero: Hero): string | null {
  const foes = nearest(world, hero.x, hero.y, QUAKE_REACH, airborne);
  if (!foes.length) return 'NONE AIRBORNE';
  for (const h of foes) bindFoe(h, 900, 16);
  return null;
}

/**
 * The Bladewind's Sky Quake: he flashes to the foe in the air nearest him,
 * and the sky over every airborne foe in reach breaks into a storm, a
 * pouring rain of wind blades and lightning that keeps them up for two
 * seconds, cutting all the while, then slams them all down at once.
 */
export class SkyQuake extends Fx {
  private foes: Hurtbox[];
  private pix: Ink[];
  private tick = 0;
  private slammed = false;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, QUAKE + 520);
    this.foes = nearest(world, c.x, c.y, QUAKE_REACH, airborne).slice(0, CUTS_MAX);
    for (const h of this.foes) bindFoe(h, QUAKE + 150, QUAKE_LIFT);
    this.pix = this.foes.map(() => this.ink(48, 112));
    const first = this.foes[0];
    if (first) {
      // A flash to the first foe's side, like a gust.
      const dx = first.x - c.hero.x;
      const dy = first.y - c.hero.y;
      const d = Math.hypot(dx, dy) || 1;
      const x = first.x - (dx / d) * (first.radius + 8);
      const y = first.y - (dy / d) * (first.radius + 8) + 1;
      if (d > first.radius + 10 && world.walkable(x, y)) {
        world.debris(c.pal.tints, snap(c.hero.x), snap(c.hero.y) - 12, 8, c.hero.y + 10, 'burst');
        c.hero.x = x;
        c.hero.y = y;
        sound.windDash(world.pan(x));
      }
      flare(world, first.x, first.y - 50, 170, c.pal.light, 2.2, 700);
      world.cameras.main.shake(260, 0.0012);
    } else this.life = 300;
    sound.skyQuake(world.pan(c.x));
  }

  protected step(dt: number): void {
    const { c, t, world } = this;
    const p = c.pal;
    if (!this.slammed) {
      this.tick -= dt;
      if (this.tick <= 0) {
        this.tick = 220;
        for (const h of this.foes) {
          if (!h.alive) continue;
          h.hurt({ damage: 4, heavy: false, knock: 0, fromX: h.x, fromY: h.y - 40 });
          world.debris([p.core, p.hot], snap(h.x), snap(h.y - h.bodyY) - QUAKE_LIFT, 3, h.y + 20, 'burst');
        }
      }
      if (t >= QUAKE && this.foes.length) {
        this.slammed = true;
        for (const h of this.foes) {
          if (!h.alive) continue;
          h.hurt({ damage: 30, heavy: true, knock: 60, fromX: h.x, fromY: h.y - 20 });
          world.debris([p.core, p.hot, p.mid, 0xcfc6b0], snap(h.x), snap(h.y), 12, h.y + 10, 'burst');
        }
        const f = this.foes[0];
        flare(world, f.x, f.y - 10, 150, p.light, 2.6, 500);
        world.cameras.main.shake(320, 0.0018);
        sound.quakeSlam(world.pan(f.x));
      }
    }

    this.foes.forEach((h, i) => {
      const g = this.pix[i];
      const hx = snap(h.x);
      const gy = snap(h.y);
      g.begin(hx, gy + 8, gy + 40, 0.5, 1);
      if (t < QUAKE) {
        const top = gy - 100;
        const by = gy - h.bodyY - QUAKE_LIFT * clamp01(t / 160);
        const open = easeOut(t / 180);
        // The storm cloud, churning.
        for (let k = 0; k < 70; k++) {
          const a = hash(k, i) * Math.PI * 2 + t * 0.002 * (k % 2 ? 1 : -1);
          const r = Math.sqrt(hash(k, i, 3)) * 15 * open;
          const x = hx + Math.cos(a) * r;
          const y = top + 6 + Math.sin(a) * r * 0.32;
          g.put(x, y, r > 10 ? p.deep : hash(k, Math.floor(t / 90)) > 0.8 ? p.hot : p.mid, 0.9);
        }
        // The downpour: blades of wind falling hard, drawn in towards the foe.
        for (let s = 0; s < 16; s++) {
          const fall = by - top - 10;
          const k = ((t * 0.28 + s * 23 + hash(s, i) * 40) % fall) / fall;
          const spread = (hash(s, i, 7) * 2 - 1) * 13 * (1 - k * 0.7);
          const x = hx + spread;
          const y = top + 10 + k * fall;
          line(g, x, y - 6, x, y, p.mid, 0.75);
          g.put(x, y, p.core);
          g.put(x, y - 1, p.hot);
        }
        // Lightning now and then.
        const flash = Math.floor((t + i * 130) / 320);
        if ((t + i * 130) % 320 < 70) bolt(g, hx + (hash(flash, i) * 2 - 1) * 8, top + 8, hx, by, p, flash + i * 17, 1, 0.6);
        // Spray where it strikes the body, and a ring on the ground under it.
        for (let k = 0; k < 6; k++) {
          const a = hash(k, Math.floor(t / 60), i) * Math.PI * 2;
          g.put(hx + Math.cos(a) * (3 + k), by + Math.sin(a) * 2 - 2, k % 2 ? p.core : p.hot, 0.9);
        }
        ring(g, hx, gy, 9 + Math.sin(t * 0.02) * 1.5, 0.8, p, 0.55, 0.6, 0.5, Math.floor(t / 60));
      } else {
        // The slam: a pillar of light fading and a shock ring racing out.
        const k = clamp01((t - QUAKE) / 500);
        column(g, hx, gy, Math.round(90 * (1 - k)), 3, p, 1 - k, t);
        ring(g, hx, gy, 6 + 22 * easeOut(k), 1.4 - k, p, 1 - k, 0.6, 0.3, Math.floor(t / 50));
      }
      g.end();
    });
  }
}

/**
 * The Ronin's Hundred Cuts: he vanishes, and one by one every foe near him is
 * cut by a streak of light racing from one to the next, each left marked; he
 * is back where he stood a moment later, sheathes, and every cut bursts open.
 */
export class HundredCuts extends Fx {
  private foes: Hurtbox[];
  private samurai: Samurai | null;
  private next = 120;
  private i = 0;
  private from: { x: number; y: number };
  private back = false;
  private severed = false;
  private readonly cutsEnd: number;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, 0);
    this.foes = nearest(world, c.x, c.y, CUTS_REACH, () => true).slice(0, CUTS_MAX);
    this.cutsEnd = 120 + this.foes.length * CUT_GAP;
    this.life = this.cutsEnd + 150 + 350 + 350;
    this.samurai = 'cutOpen' in c.hero ? (c.hero as Samurai) : null;
    this.from = { x: c.x, y: c.y - 11 };
    if (this.samurai) this.samurai.vanished = true;
    world.debris(c.pal.tints, snap(c.x), snap(c.y) - 12, 10, c.y + 10, 'burst');
    bloom(world, c.x, c.y - 12, c.pal.hot, 1.2, 300, c.y + 20);
    sound.hundredCuts(world.pan(c.x));
  }

  protected step(): void {
    const { c, t, world } = this;
    if (this.i < this.foes.length && t >= this.next) {
      const h = this.foes[this.i++];
      this.next += CUT_GAP;
      if (h.alive) {
        const to = { x: h.x, y: h.y - h.bodyY };
        const dx = to.x - this.from.x;
        const dy = to.y - this.from.y;
        const d = Math.hypot(dx, dy) || 1;
        const ux = dx / d;
        const uy = dy / d;
        // A streak through the foe; only its last stretch is drawn, to keep it cheap.
        const run = Math.min(d, 50);
        world.addEffect(new ThrustStreak(world, snap(to.x - ux * run), snap(to.y - uy * run), ux, uy, run + 12, c.pal, snap(h.y)));
        world.addEffect(new HitSpark(world, to.x, to.y, c.pal, h.y + 13, false));
        h.hurt({ damage: 6, heavy: false, knock: 0, fromX: this.from.x, fromY: this.from.y });
        this.samurai?.mark(h, 2);
        sound.katanaHit(world.pan(h.x), false);
        this.from = to;
      }
    }
    if (!this.back && t >= this.cutsEnd + 150) {
      this.back = true;
      if (this.samurai) this.samurai.vanished = false;
      bloom(world, c.hero.x, c.hero.y - 12, c.pal.hot, 1, 260, c.hero.y + 20);
    }
    if (!this.severed && t >= this.cutsEnd + 500) {
      this.severed = true;
      sound.sheathe(world.pan(c.hero.x));
      this.samurai?.cutOpen(this.foes.filter((h) => h.alive), 26, 8);
    }
  }

  destroy(): void {
    if (this.samurai) this.samurai.vanished = false;
    super.destroy();
  }
}
