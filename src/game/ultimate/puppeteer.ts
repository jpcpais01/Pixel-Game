import { sound } from '../../audio';
import { snap } from '../display';
import { bindFoe, strand } from '../Strings';
import type { Puppeteer } from '../Puppeteer';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, drag, easeIn, easeOut, flare, Fx, ring, rune, strikeGround, type Ink } from './ink';
import type { Cast } from './types';

// The Puppeteer's Specials: the marionettist's grand finale, his puppet
// hauled up into the sky and brought down on the spot as a giant, spinning;
// and the stringweaver's puppet master, every foe near her strung up and made
// to fight the others.

const RISE = 420;
const FALL = 260;
const SPIN = 1500;
const BOW = 450;

/**
 * The Marionettist's Grand Finale: the puppet is yanked up out of sight on
 * its strings, a ring marking where it will land, and comes down there twice
 * its size in a great slam; then it pirouettes, giant, through everything
 * around, and shrinks back to his side with a bow.
 */
export class GrandFinale extends Fx {
  private ground: Ink;
  private slammed = false;
  private tick = 0;
  private sx: number;
  private sy: number;
  private ex: number;
  private ey: number;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, RISE + FALL + SPIN + BOW);
    this.ground = this.ink(150, 100);
    const pup = (c.hero as Puppeteer).puppet;
    this.sx = pup?.x ?? c.x;
    this.sy = pup?.y ?? c.y;
    this.ex = c.tx;
    this.ey = c.ty;
    pup?.show();
    pup?.perform('chop', c.tx - this.sx);
    if (pup) pup.stringsUp = true;
    sound.twang(world.pan(c.x), true);
  }

  protected step(dt: number): void {
    const { c, t, world } = this;
    const p = c.pal;
    const pup = (c.hero as Puppeteer).puppet;
    if (!pup) {
      this.destroy();
      return;
    }
    const land = RISE + FALL;
    if (t < RISE) {
      // Hauled up into the sky, growing as it goes.
      const k = easeIn(t / RISE);
      pup.lift = 150 * k;
      pup.scale = 1 + k;
      pup.x = this.sx + (this.ex - this.sx) * k;
      pup.y = this.sy + (this.ey - this.sy) * k;
    } else if (t < land) {
      const k = easeIn((t - RISE) / FALL);
      pup.lift = 150 * (1 - k);
      pup.scale = 2;
      pup.x = this.ex;
      pup.y = this.ey;
    } else if (!this.slammed) {
      this.slammed = true;
      pup.lift = 0;
      pup.scale = 2;
      const hits = strikeGround(world, this.ex, this.ey, 46, { damage: 42, heavy: true, knock: 260, fromX: this.ex, fromY: this.ey - 6 });
      for (const h of hits) world.debris(p.tints, snap(h.x), snap(h.y - h.bodyY), 8, h.y + 20);
      world.cameras.main.shake(220, 0.004);
      flare(world, this.ex, this.ey - 10, 130, p.light, 4, 600);
      bloom(world, this.ex, this.ey - 8, p.hot, 2.6, 420, this.ey + 30);
      world.debris(p.tints, snap(this.ex), snap(this.ey) - 6, 26, this.ey + 20);
      sound.clack(world.pan(this.ex), true);
      sound.drumBeat(world.pan(this.ex), true);
      pup.perform('spin', 1);
      sound.whirr(world.pan(this.ex));
    } else if (t < land + SPIN) {
      // The giant pirouette, drifting after the nearest foe.
      const foe = this.nearest(pup.x, pup.y, 60);
      if (foe) {
        const dx = foe.x - pup.x;
        const dy = foe.y - pup.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > 8) {
          pup.x += (dx / d) * 40 * (dt / 1000);
          pup.y += (dy / d) * 40 * (dt / 1000);
        }
      }
      this.tick -= dt;
      if (this.tick <= 0) {
        this.tick += 200;
        const ch = pup.chest;
        const hits = world.melee({ kind: 'circle', x: ch.x, y: ch.y + 10, radius: 34 }, { damage: 11, knock: 110, fromX: pup.x, fromY: pup.y - 20 });
        for (const h of hits) world.debris(p.tints, snap(h.x), snap(h.y), 4, h.y + 20);
        sound.whirr(world.pan(pup.x));
      }
      if (Math.floor(t / 30) !== Math.floor((t - dt) / 30)) {
        const a = t * 0.03;
        world.debris(p.tints, snap(pup.x + Math.cos(a) * 22), snap(pup.y - 24 + Math.sin(a) * 8), 1, pup.y + 1, 'trail');
      }
    } else {
      // Shrinking back, with a bow, and home to his hand.
      const k = easeOut((t - land - SPIN) / BOW);
      if (pup.scale > 1.01 && k < 0.2) pup.perform('idle', c.hero.x - pup.x);
      pup.scale = 2 - k;
      pup.stringsUp = false;
    }
    const g = this.ground.begin(this.ex, this.ey, 2.5);
    if (t < land) {
      // Where it will fall: a ring closing in.
      const k = t / land;
      ring(g, this.ex, this.ey, 46 * (1.2 - 0.2 * k), 1.2, p, 0.4 + 0.5 * k);
      rune(g, this.ex, this.ey, 30 * easeOut(k), t * 0.004, p, 0.4 + 0.6 * k);
    } else {
      const k = (t - land) / 520;
      if (k < 1) ring(g, this.ex, this.ey, 8 + 46 * easeOut(k), 3.5 * (1 - k) + 1, p, 1 - k);
      if (t < land + SPIN) ring(g, pup.x, pup.y, 30, 1, p, 0.5, undefined, 0.5, Math.floor(t / 60));
    }
    g.end();
  }

  destroy(): void {
    if (!this.dead) (this.c.hero as Puppeteer).puppet?.release();
    super.destroy();
  }

  private nearest(x: number, y: number, range: number): Hurtbox | null {
    let best = range;
    let pick: Hurtbox | null = null;
    for (const h of this.world.hurtboxesWhere((h) => h.alive)) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < best) {
        best = d;
        pick = h;
      }
    }
    return pick;
  }
}

const MASTER_TIME = 4400;
const BOUT = 700;
const REACH = 118;
const MAX_FOES = 8;

/**
 * The Stringweaver's Puppet Master: a great cross of light turns over her
 * head, and a string from it seizes every foe near (up to eight). She holds
 * them up and dashes them against each other, bout after bout; a foe with
 * no partner (or a boss, too great to hold) is lashed by the strings
 * instead. At the end every string is cut at once.
 */
export class PuppetMaster extends Fx {
  private pix: Ink;
  private foes: Hurtbox[];
  private partner = new Map<Hurtbox, Hurtbox | null>();
  private bout = -1;
  private met = new Set<Hurtbox>();

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, MASTER_TIME);
    this.pix = this.ink(300, 220);
    const h = c.hero;
    this.foes = world
      .hurtboxesWhere((f) => f.alive && Math.hypot(f.x - h.x, f.y - h.y) < REACH)
      .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))
      .slice(0, MAX_FOES);
    for (const f of this.foes) bindFoe(f, MASTER_TIME - 100, 6);
    sound.strings(world.pan(h.x));
    flare(world, h.x, h.y - 60, 120, c.pal.light, 2.5, 900);
  }

  protected step(dt: number): void {
    const { c, t, world } = this;
    const p = c.pal;
    const h = c.hero;
    const live = this.foes.filter((f) => f.alive);
    const b = Math.floor((t - 200) / BOUT);
    const bt = (t - 200) - b * BOUT;
    if (t >= 200 && b !== this.bout && t < MASTER_TIME - 400) {
      // A new bout: each foe is set on its nearest neighbour.
      this.bout = b;
      this.met.clear();
      for (const f of live) this.partner.set(f, this.nearestOther(f, live));
    }
    if (t >= 200 && t < MASTER_TIME - 400) {
      for (const f of live) {
        const q = this.partner.get(f);
        if (bt < 260 && q?.alive) drag(f, q.x, q.y, 250, dt);
      }
      if (bt >= 260 && bt - dt < 260) this.clash(live);
    }
    if (t >= MASTER_TIME - 300 && t - dt < MASTER_TIME - 300) {
      // Every string cut at once.
      for (const f of live) {
        f.hurt({ damage: 20, heavy: true, knock: 60, fromX: f.x, fromY: f.y - 30 });
        world.debris(p.tints, snap(f.x), snap(f.y - f.bodyY), 10, f.y + 20);
      }
      sound.twang(world.pan(h.x), true);
      world.cameras.main.shake(120, 0.002);
    }

    // The cross of light turning over her head, and a string from it to each foe.
    const cx = h.x;
    const cy = h.y - 58;
    const fade = clamp01((MASTER_TIME - t) / 300) * easeOut(t / 250);
    const g = this.pix.begin(cx, cy + 50, cy + 200);
    const rot = t * 0.0016;
    for (const [a, len] of [[rot, 16], [rot + Math.PI / 2, 10]] as const) {
      const ux = Math.cos(a);
      const uy = Math.sin(a) * 0.45;
      for (let i = -len; i <= len; i++) {
        const k = Math.abs(i) / len;
        g.put(cx + ux * i, cy + uy * i, k < 0.3 ? p.core : k < 0.8 ? p.hot : p.mid, fade);
        g.put(cx + ux * i, cy + uy * i + 1, p.deep, fade * 0.6);
      }
    }
    const hand = (h as Puppeteer).hand?.() ?? { x: h.x, y: h.y - 20 };
    strand(g, hand.x, hand.y, cx, cy + 1, p, fade * 0.7, t);
    live.forEach((f, i) => {
      const end = Math.cos(rot + (i / Math.max(1, live.length)) * Math.PI * 2);
      const sx = cx + end * 14;
      const sy = cy + Math.sin(rot + i) * 3;
      strand(g, sx, sy, f.x + Math.sin(t * 0.02 + i) * 1.5, f.y - f.bodyY - 5, p, fade, t + i * 250, 2);
    });
    g.end();
    if (Math.floor(t / 90) !== Math.floor((t - dt) / 90)) world.debris(p.tints, snap(cx + (Math.random() - 0.5) * 30), snap(cy + 2), 1, cy + 200, 'spores');
  }

  /** The foes meet: those that reached their partner strike each other; the rest are lashed by the strings. */
  private clash(live: Hurtbox[]): void {
    const { world, c } = this;
    const p = c.pal;
    let bonks = 0;
    for (const f of live) {
      if (this.met.has(f)) continue;
      const q = this.partner.get(f);
      if (q && q.alive && Math.hypot(q.x - f.x, q.y - f.y) < f.radius + q.radius + 6) {
        this.met.add(f).add(q);
        const mx = (f.x + q.x) / 2;
        const my = (f.y + q.y) / 2;
        for (const o of [f, q]) o.hurt({ damage: 14, heavy: true, knock: 150, fromX: mx, fromY: my - o.bodyY });
        world.debris(p.tints, snap(mx), snap(my - f.bodyY), 10, my + 20);
        bloom(world, mx, my - f.bodyY, p.hot, 0.9, 240, my + 20, 0.7);
        bonks++;
      } else {
        this.met.add(f);
        f.hurt({ damage: 9, heavy: false, knock: 30, fromX: f.x, fromY: f.y - 30 });
        world.debris(p.tints, snap(f.x), snap(f.y - f.bodyY - 4), 4, f.y + 20);
      }
    }
    if (bonks) {
      sound.clack(world.pan(c.hero.x), true);
      world.cameras.main.shake(80, 0.0012);
    } else if (live.length) sound.twang(world.pan(c.hero.x), false);
  }

  private nearestOther(f: Hurtbox, live: Hurtbox[]): Hurtbox | null {
    let best = Infinity;
    let pick: Hurtbox | null = null;
    for (const o of live) {
      if (o === f) continue;
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      if (d < best) {
        best = d;
        pick = o;
      }
    }
    return pick;
  }
}
