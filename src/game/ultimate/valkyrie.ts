import type Phaser from 'phaser';
import { sound } from '../../audio';
import type { Hurtbox } from '../combat';
import { onGround } from '../Toxins';
import { DriftFeathers, Thunderbolt, type FeatherTint } from '../Valkyrie';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, dither, easeIn, easeOut, flare, Fx, GROUND, hash, line, ring, rune, strikeGround, type Ink, type Pal } from './ink';
import type { Cast } from './types';

// The Valkyrie's Specials: the Spearmaiden's Spear of Odin, a great winged
// spear of gold hurled down from the sky onto the spot, its runes bursting
// out a moment after; and the Stormwing's Thunder of Asgard, a ring of storm
// round her from which lightning strikes her foes again and again.

const ODIN_APPEAR = 180;
const ODIN_FALL = 220;
const ODIN_R = 42;
const ODIN_DAMAGE = 80;
/** The runes round the spear burst this long after it lands, further out. */
const RUNE_AT = 480;
const RUNE_R = 62;
const RUNE_DAMAGE = 22;
const ODIN_LIFE = 2300;
/** How deep the spear sinks into the ground. */
const SUNK = 10;
/** Puffs of white feathers round the Swan Song's rune ring as it bursts. */
const SWAN_FEATHER_PUFFS = 8;

/** A great spear standing point-down with its point at (x, tip); pixels below `floor` are in the ground. */
function greatSpear(g: Ink, x: number, tip: number, p: Pal, a: number, floor = Infinity): void {
  const put = (px: number, py: number, c: number) => {
    if (py > floor) return;
    if (a < 1 && dither(Math.round(px), Math.round(py)) >= a) return;
    g.put(px, py, c);
  };
  // The head: a long leaf of light, a ridge down its middle.
  const head = 18;
  for (let i = 0; i < head; i++) {
    const u = i / head;
    const hw = Math.round(u < 0.55 ? (u / 0.55) * 4 : 4 - ((u - 0.55) / 0.45) * 2.5);
    for (let dx = -hw; dx <= hw; dx++) put(x + dx, tip - i, dx === -hw || dx === hw ? p.deep : dx === 0 ? p.core : dx < 0 ? p.hot : p.mid);
  }
  const socket = tip - head;
  // Wings spread from the socket, the valkyrie's mark.
  for (const k of [-1, 1]) {
    for (const [ox, oy, len] of [[2, 0, 8], [2, 1, 6.5], [2, 2, 5]] as const) {
      const ex = x + k * (ox + len);
      const ey = socket + oy - len * 0.7;
      const n = Math.ceil(len);
      for (let i = 0; i <= n; i++) put(x + k * ox + ((ex - x - k * ox) * i) / n, socket + oy + ((ey - socket - oy) * i) / n, i > n - 2 ? p.core : oy === 0 ? p.hot : p.mid);
    }
  }
  // The shaft: three pixels wide, lit on the left, bound in gold every so often.
  for (let i = 1; i < 62; i++) {
    const y = socket - i;
    const band = i % 18 === 0 || i % 18 === 1;
    put(x - 1, y, band ? p.core : p.hot);
    put(x, y, band ? p.core : p.mid);
    put(x + 1, y, band ? p.hot : p.deep);
  }
  for (let dx = -2; dx <= 2; dx++) put(x + dx, socket - 62, Math.abs(dx) === 2 ? p.deep : p.hot);
}

/** The Spearmaiden's Spear of Odin: a great winged spear falls from the sky onto the spot, and the runes round it burst a moment later. */
export class OdinSpear extends Fx {
  private spear: Ink;
  private ground: Ink;
  private glow: Phaser.GameObjects.Image;
  private landed = false;
  private burst = false;
  private cracks: { a: number; len: number; seed: number }[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
    /** The Swan Maiden's Swan Song: the runes burst into a ring of drifting white feathers. */
    private feathers = false,
    /** The feathers' own colours (the Amazon's macaw feathers). */
    private tints?: FeatherTint[],
  ) {
    super(world, ODIN_LIFE);
    this.spear = this.ink(28, 100);
    this.ground = this.ink(RUNE_R * 2 + 16, Math.ceil(RUNE_R * 2 * GROUND + 16));
    this.glow = this.halo(p.hot, 1.2, y + 3);
    for (let i = 0; i < 6; i++) this.cracks.push({ a: (i / 6) * Math.PI * 2 + hash(i, 3) * 0.6, len: 18 + hash(i, 4) * 18, seed: i });
    sound.starcall(world.pan(x));
  }

  protected step(): void {
    const { x, y, p, t } = this;
    const hit = ODIN_APPEAR + ODIN_FALL;
    const fall = clamp01((t - ODIN_APPEAR) / ODIN_FALL);
    const tip = t < hit ? y - 160 * (1 - easeIn(fall)) : y + SUNK;
    if (!this.landed && t >= hit) this.land();
    if (this.landed && !this.burst && t >= hit + RUNE_AT) this.runes();

    const a = t < ODIN_APPEAR ? t / ODIN_APPEAR : t > 1600 ? 1 - (t - 1600) / 600 : 1;
    const s = this.spear.begin(x, tip + 1, y + 3, 0.5, 1);
    if (a > 0) {
      greatSpear(s, x, tip, p, a, this.landed ? y : Infinity);
      if (fall > 0 && fall < 1) for (const dx of [-5, 0, 5]) line(s, x + dx, tip - 70, x + dx, tip - 70 - 22 * fall, p.mid, 0.5);
    }
    s.end();
    this.glow.setPosition(x, tip - 14).setAlpha(0.55 * Math.max(0, a));
    // Feathers of light drifting down round it while it stands.
    if (this.landed && t < 1700 && Math.floor(t / 90) !== Math.floor((t - 16) / 90)) {
      this.world.debris([0xffffff, p.core, p.hot], x + (Math.random() - 0.5) * 30, y - 40 - Math.random() * 20, 1, y + 5, 'spores');
    }

    const g = this.ground.begin(x, y, 2.5);
    if (this.landed) {
      const since = t - hit;
      const k = since / 450;
      if (k < 1) ring(g, x, y, 4 + ODIN_R * easeOut(k), 3 * (1 - k) + 0.8, p, 1 - k);
      // The rune circle opens out to where it will burst, turning.
      const open = easeOut(since / RUNE_AT);
      const fade = 1 - clamp01((t - 1500) / 600);
      rune(g, x, y, (RUNE_R - 4) * open, since * 0.004, p, fade * (this.burst ? 0.7 : 1));
      if (this.burst) {
        const b = (since - RUNE_AT) / 400;
        if (b < 1) ring(g, x, y, RUNE_R * (0.8 + 0.2 * easeOut(b)), 3 * (1 - b) + 0.6, p, 1 - b);
      }
      for (const c of this.cracks) {
        let px = x;
        let py = y;
        for (let i = 1; i <= 5; i++) {
          const f = i / 5;
          const wob = (hash(c.seed, i) - 0.5) * 0.7;
          const qx = x + Math.cos(c.a + wob) * c.len * f * Math.min(1, since / 110);
          const qy = y + Math.sin(c.a + wob) * c.len * f * GROUND * Math.min(1, since / 110);
          line(g, px, py, qx, qy, f < 0.5 ? p.hot : p.mid, fade);
          px = qx;
          py = qy;
        }
      }
    }
    g.end();
  }

  private land(): void {
    this.landed = true;
    const { world, x, y, p } = this;
    strikeGround(world, x, y, ODIN_R, { damage: ODIN_DAMAGE, heavy: true, knock: 190, fromX: x, fromY: y - 4 });
    world.cameras.main.shake(260, 0.0045);
    world.debris(p.tints, x, y - 4, 28, y + 20, 'burst');
    world.debris([0xb8a890, 0x7a6a58, p.mid], x, y - 2, 12, y + 20, 'spores');
    flare(world, x, y - 20, 220, p.light, 4.5, 700);
    bloom(world, x, y - 10, p.hot, 4, 420, y + 30);
    sound.slam(world.pan(x));
    sound.starImpact(world.pan(x));
  }

  /** The runes burst: a second blow further out, throwing foes clear. */
  private runes(): void {
    this.burst = true;
    const { world, x, y, p } = this;
    strikeGround(world, x, y, RUNE_R, { damage: RUNE_DAMAGE, heavy: true, knock: 160, fromX: x, fromY: y - 4 });
    world.cameras.main.shake(140, 0.0018);
    world.debris(p.tints, x, y - 2, 18, y + 20, 'burst');
    flare(world, x, y - 8, 180, p.light, 2.5, 450);
    sound.quakeSlam(world.pan(x));
    if (this.feathers) {
      for (let i = 0; i < SWAN_FEATHER_PUFFS; i++) {
        const q = (i / SWAN_FEATHER_PUFFS) * Math.PI * 2;
        world.addEffect(new DriftFeathers(world, x + Math.cos(q) * RUNE_R * 0.8, y + Math.sin(q) * RUNE_R * 0.8 * GROUND - 14, 2, p, this.tints));
      }
    }
  }
}

// ---------------------------------------------------------------------------

const STORM_LIFE = 2700;
const STORM_RANGE = 95;
const STRIKE_EVERY = 170;
const STRIKE_DAMAGE = 14;
/** A foe struck is passed over for this long while others are near. */
const STRIKE_REST = 480;

/** The Stormwing's Thunder of Asgard: a crackling ring of storm round her, and lightning striking the foes within it one after another. */
export class AsgardThunder extends Fx {
  private ringInk: Ink;
  private lamp: Phaser.GameObjects.Light;
  private strikeT = 0;
  private odd = false;
  private last = new Map<Hurtbox, number>();

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, STORM_LIFE);
    this.ringInk = this.ink(STORM_RANGE * 2 + 12, Math.ceil(STORM_RANGE * 2 * GROUND + 12));
    this.lamp = this.light(c.x, c.y - 20, 180, c.pal.light, 0);
    sound.arrowHit(world.pan(c.x), true);
  }

  protected step(dt: number): void {
    const { c, t } = this;
    const h = c.hero;
    const open = easeOut(t / 350);
    const fade = 1 - clamp01((t - (STORM_LIFE - 400)) / 400);
    this.lamp.setPosition(h.x, h.y - 30);
    this.lamp.intensity = 1.2 * open * fade * (0.8 + 0.2 * Math.sin(t * 0.05));

    const g = this.ringInk.begin(h.x, h.y, 2.6);
    ring(g, h.x, h.y, STORM_RANGE * open, 0.9, c.pal, 0.8 * fade, GROUND, 0.45, Math.floor(t / 90));
    ring(g, h.x, h.y, STORM_RANGE * 0.55 * open, 0.6, c.pal, 0.35 * fade, GROUND, 0.6, Math.floor(t / 70) + 5);
    g.end();

    this.strikeT -= dt;
    if (t > 250 && t < STORM_LIFE - 300 && this.strikeT <= 0) {
      this.strikeT += STRIKE_EVERY;
      this.strike();
    }
  }

  /** Lightning on the foe within the ring struck longest ago (the nearest, of those), or on the ground if none is there. */
  private strike(): void {
    const { world, c, t } = this;
    const h = c.hero;
    const foes = world.hurtboxesWhere((b) => b.alive && onGround(b, h.x, h.y, STORM_RANGE));
    const rested = (b: Hurtbox) => t - (this.last.get(b) ?? -Infinity);
    const pick = foes.sort((a, b) => {
      const ra = rested(a) >= STRIKE_REST ? 1 : 0;
      const rb = rested(b) >= STRIKE_REST ? 1 : 0;
      return rb - ra || Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y);
    })[0];
    if (pick) {
      this.last.set(pick, t);
      pick.hurt({ damage: STRIKE_DAMAGE, heavy: true, knock: 80, fromX: pick.x, fromY: pick.y - 20 });
      pick.slow?.(0.6, 350, c.pal.hot);
      world.addEffect(new Thunderbolt(world, pick.x, pick.y, c.pal, 12));
      world.cameras.main.shake(90, 0.0008);
      sound.arrowHit(world.pan(pick.x), true);
      return;
    }
    // Nothing in reach: the storm still strikes, now and then, somewhere in the ring.
    this.odd = !this.odd;
    if (!this.odd) return;
    const q = Math.random() * Math.PI * 2;
    const d = STORM_RANGE * (0.4 + Math.random() * 0.5);
    const x = h.x + Math.cos(q) * d;
    const y = h.y + Math.sin(q) * d * GROUND;
    if (world.walkable(x, y)) world.addEffect(new Thunderbolt(world, x, y, c.pal, 8));
  }
}
