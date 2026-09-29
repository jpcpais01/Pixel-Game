import Phaser from 'phaser';
import { sound } from '../audio';
import type { Hurtbox } from './combat';
import type { Effect } from './Slash';
import { onGround } from './Toxins';
import { clamp01, dither, easeOut, flare, Fx, GROUND, hash, pal, ring, type Ink, type Pal } from './ultimate/ink';
import { ABYSS_STYLE, TIDE_STYLE, type SpellStyle } from './spells';
import type { Wizard, WizardKit, WizardSkin } from './Wizard';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';

// The Tidecaller: the wizard's sea sorceress, on the wizard's rig (art/wizard.ts,
// head 'tide') and played through its cast and charged special (Wizard.ts).
// Her bolts of sea water burst in a splash that throws foes back. Her charged
// ability raises a tidal wave that rolls out the way she aims, wider and
// further the longer it gathered: it strikes everything in its path once and
// carries them along on its crest, then breaks in foam. She fights by pushing
// the fight away from her rather than by hitting hardest.

export const TIDE_KIT: WizardKit = {
  maxHp: HERO_STATS['wizard.tide'].hp,
  speed: HERO_STATS['wizard.tide'].speed,
  castCooldown: 240,
  // Arms raised while the wave rises and rolls away.
  fireTime: (p) => 340 + 160 * p,
};

export const TIDE_SKIN: WizardSkin = { key: 'wizard_tide', style: TIDE_STYLE, kit: TIDE_KIT };
/** The Abyssal skin: the same sorceress, from the lightless deep. */
export const ABYSS_SKIN: WizardSkin = { key: 'wizard_abyss', style: ABYSS_STYLE, kit: TIDE_KIT };

/** A Tidecaller look's water: its spells, the wave's colours (foam first, down to its depths) and the spray it throws. */
export interface TideMagic {
  style: SpellStyle;
  pal: Pal;
  spray: number[];
}

export const TIDE_MAGIC: TideMagic = {
  style: TIDE_STYLE,
  pal: pal(0xf0ffff, 0x9cf4ff, 0x2ec4e0, 0x1a5ab8, 0x6ae0ff),
  spray: [0xffffff, 0xc8faff, 0x6ae0ff, 0x2ec4e0],
};

/** The Abyssal: black water lit by living teal, violet in its depths. */
export const ABYSS_MAGIC: TideMagic = {
  style: ABYSS_STYLE,
  pal: pal(0xf0fffc, 0xa8fff0, 0x3ae0d0, 0x3a1a8a, 0x5af0e0),
  spray: [0xf0fffc, 0xa8fff0, 0x3ae0d0, 0x8a5af0],
};

// Water bolts.
const BOLT_SPEED = 155;
const BOLT_LIFETIME = 1100;
const SPLASH_R = 12;
const SPLASH_DAMAGE = 3;
/** The splash throws foes back hard: the Tidecaller keeps the fight at arm's length. */
const SPLASH_KNOCK = 95;

// The tidal wave.
const waveRange = (p: number) => 70 + 80 * p;
/** Half its width. */
const waveWidth = (p: number) => 16 + 20 * p;
const waveHeight = (p: number) => 9 + 7 * p;
const waveDamage = (p: number) => Math.round(6 + 12 * p);
const WAVE_SPEED = 175;
/** How far behind its crest the wave's back slopes away. */
const WAVE_BACK = 14;
/** The thin sheet of water it leaves behind the back slope. */
const WAVE_SHEET = 10;
const WAVE_BREAK = 420;
/** How far it can carry any one foe. */
const MAX_CARRY = 70;

type Shovable = Hurtbox & { shove?(dx: number, dy: number): void };

/** Everything the Tidecaller does in the world: her bolts and their splashes, and her waves. */
export class Tidecraft implements Effect {
  dead = false;
  /** The Tidecaller casting, for where the wave rises from. */
  caster: Wizard | null = null;

  constructor(
    private world: WorldScene,
    private m: TideMagic = TIDE_MAGIC,
  ) {}

  /** A bolt of sea water from the pearl. */
  bolt(x: number, y: number, dx: number, dy: number): void {
    this.world.castEnergyBall(x, y, dx, dy, this.m.style, { speed: BOLT_SPEED, lifetime: BOLT_LIFETIME, onBurst: (bx, by) => this.splash(bx, by) });
  }

  /** The bolt bursts: everything close is splashed and thrown back. It flies at chest height, so the ground is below it. */
  private splash(x: number, y: number): void {
    const gy = y + 10;
    for (const h of this.world.hurtboxesWhere((b) => b.alive && onGround(b, x, gy, SPLASH_R))) {
      h.hurt({ damage: SPLASH_DAMAGE, heavy: false, knock: SPLASH_KNOCK, fromX: x, fromY: gy });
    }
    this.world.addEffect(new Splash(this.world, x, gy, SPLASH_R, this.m.pal));
    this.world.debris(this.m.spray, Math.round(x), Math.round(y), 8, gy + 10, 'burst');
    sound.splash(this.world.pan(x));
  }

  /** Raise the wave at her feet and send it rolling the way she aims. */
  wave(dx: number, dy: number, power: number): void {
    const c = this.caster;
    if (!c) return;
    this.world.addEffect(new TidalWave(this.world, c.x + dx * 6, c.y + dy * 6, dx, dy, power, this.m));
    sound.gust(this.world.pan(c.x));
    sound.splash(this.world.pan(c.x));
  }

  update(): void {}

  destroy(): void {
    this.dead = true;
  }
}

/** A splash on the ground: a ring of water spreading out and thinning. */
class Splash extends Fx {
  private layer: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private r: number,
    private p: Pal,
  ) {
    super(world, 320);
    this.layer = this.ink(r * 2 + 12, Math.ceil(r * 2 * GROUND) + 12);
  }

  protected step(): void {
    const f = this.t / this.life;
    const g = this.layer.begin(this.x, this.y, 2.5);
    ring(g, this.x, this.y, 3 + this.r * easeOut(f * 1.3), 1.6 * (1 - f) + 0.5, this.p, 1 - f * f, GROUND, f * 0.6, 7);
    g.end();
  }
}

/**
 * The tidal wave: a wall of water rising at the Tidecaller's feet and rolling
 * out, its crest white with foam and its back sloping down to a wet sheet.
 * Everything it reaches is struck once and carried along before it, until it
 * breaks and sinks away.
 */
class TidalWave extends Fx {
  private layer: Ink;
  private range: number;
  private w: number;
  private H: number;
  /** How far the crest has rolled. */
  private s = 0;
  private broke = -1;
  private struck = new Set<Hurtbox>();
  private carried = new Map<Hurtbox, number>();
  private lamp: Phaser.GameObjects.Light;
  private sprayT = 0;
  private nx: number;
  private ny: number;
  private reach: number;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private dx: number,
    private dy: number,
    private power: number,
    private m: TideMagic,
  ) {
    const range = waveRange(power);
    super(world, (range / WAVE_SPEED) * 1000 + WAVE_BREAK);
    this.range = range;
    this.w = waveWidth(power);
    this.H = waveHeight(power);
    this.nx = -dy;
    this.ny = dx;
    // The canvas travels with the crest: wide enough for the wave turned any way, and tall enough for its height.
    this.reach = Math.ceil(Math.hypot(this.w, WAVE_BACK + WAVE_SHEET)) + 3;
    this.layer = this.ink(this.reach * 2, this.reach * 2 + Math.ceil(this.H) + 4);
    this.lamp = this.light(x, y, 90, m.pal.light, 0);
  }

  protected step(dt: number): void {
    const { t, dx, dy } = this;
    const before = this.s;
    this.s = Math.min(this.range, (t / 1000) * WAVE_SPEED);
    const rolled = this.s - before;
    if (this.broke < 0 && this.s >= this.range) this.breakUp();

    const cx = this.x + dx * this.s;
    const cy = this.y + dy * this.s;
    if (this.broke < 0) {
      this.strike();
      this.carry(rolled);
      this.sprayT -= dt;
      if (this.sprayT <= 0) {
        this.sprayT = 70;
        const o = (Math.random() * 2 - 1) * this.w;
        const sx = cx + this.nx * o;
        const sy = cy + this.ny * o;
        this.world.debris(this.m.spray, Math.round(sx), Math.round(sy - this.H), 2, sy + 6, 'spores');
      }
    }
    const rise = easeOut(t / 160);
    const sink = this.broke < 0 ? 0 : clamp01((t - this.broke) / WAVE_BREAK);
    this.lamp.setPosition(cx, cy - this.H * 0.6);
    this.lamp.intensity = 1.1 * rise * (1 - sink);
    this.draw(cx, cy, rise * (1 - sink * sink), sink);
  }

  /** Where a foe stands against the wave: along its way from where it rose, and across it. */
  private place(h: Hurtbox): { along: number; across: number } {
    const ox = h.x - this.x;
    const oy = h.y - this.y;
    return { along: ox * this.dx + oy * this.dy, across: ox * this.nx + oy * this.ny };
  }

  /** The crest reaches whatever it rolls into: struck once each, and caught up to be carried. */
  private strike(): void {
    const s = this.s;
    const hit = this.world.hurtboxesWhere((h) => {
      if (!h.alive || this.struck.has(h)) return false;
      const { along, across } = this.place(h);
      return along <= s + h.radius && along >= s - WAVE_BACK && Math.abs(across) <= this.w + h.radius;
    });
    const damage = waveDamage(this.power);
    for (const h of hit) {
      this.struck.add(h);
      this.carried.set(h, 0);
      h.hurt({ damage, heavy: this.power > 0.6, knock: 30, fromX: h.x - this.dx * 10, fromY: h.y - this.dy * 10 });
    }
  }

  /** Foes it caught ride just ahead of the crest, as far as it can take them. */
  private carry(rolled: number): void {
    if (rolled <= 0) return;
    for (const [h, got] of this.carried) {
      if (!h.alive || got >= MAX_CARRY) continue;
      const lead = this.s + 4 - this.place(h).along;
      if (lead <= 0) continue;
      const step = Math.min(lead, rolled * 1.15, MAX_CARRY - got);
      const tx = h.x + this.dx * step;
      const ty = h.y + this.dy * step;
      const m = h as Shovable;
      if (!m.shove || !this.world.walkable(tx, ty)) continue;
      m.shove(this.dx * step, this.dy * step);
      this.carried.set(h, got + step);
    }
  }

  /** At the end of its run the wave breaks: a last burst of foam and spray, and it sinks away. */
  private breakUp(): void {
    this.broke = this.t;
    const { world, m } = this;
    const cx = this.x + this.dx * this.s;
    const cy = this.y + this.dy * this.s;
    for (const o of [-0.7, 0, 0.7]) {
      const sx = cx + this.nx * o * this.w;
      const sy = cy + this.ny * o * this.w;
      world.debris(m.spray, Math.round(sx), Math.round(sy - this.H * 0.7), 6 + Math.round(this.power * 5), sy + 10, 'burst');
    }
    flare(world, cx, cy - 6, 110, m.pal.light, 1.6, 420);
    world.cameras.main.shake(90, 0.0006 + 0.0006 * this.power);
    sound.splash(world.pan(cx));
  }

  /**
   * The wave drawn as columns of water standing on the ground, tallest at the
   * crest and sloping away behind it, pale foam along the top. The layer keeps
   * the most opaque pixel, so the crest's face (drawn solid) stands in front of
   * the slope behind it whichever way the wave rolls.
   */
  private draw(cx: number, cy: number, k: number, sink: number): void {
    const { dx, dy, nx, ny, w } = this;
    const pl = this.m.pal;
    const g = this.layer.begin(cx, cy, cy + 4, 0.5, (this.reach + Math.ceil(this.H) + 4) / this.layer.h);
    const H = this.H * k;
    const seed = Math.floor(this.t / 90);
    for (let c = -w; c <= w; c += 0.7) {
      const edge = Math.abs(c) / w;
      const taper = 1 - edge * edge * edge;
      for (let a = -WAVE_BACK - WAVE_SHEET; a <= 0.01; a += 0.7) {
        const gx = cx + dx * a + nx * c;
        const gy = cy + dy * a + ny * c;
        if (a < -WAVE_BACK) {
          // The wet sheet it drags behind: thin, dithered away to nothing.
          const f = 1 - (-a - WAVE_BACK) / WAVE_SHEET;
          const fade = f * taper * (1 - sink) * 0.8;
          if (dither(Math.round(gx), Math.round(gy)) >= fade) continue;
          g.put(gx, gy, f > 0.5 ? pl.mid : pl.deep, 0.55);
          continue;
        }
        const slope = Math.pow(1 + a / WAVE_BACK, 1.6);
        const h = Math.round(H * taper * (0.35 + 0.65 * slope));
        const face = a > -2.5;
        const alpha = face ? 0.95 : 0.82;
        for (let j = 0; j <= h; j++) {
          const up = h ? j / h : 1;
          let col = up > 0.72 ? pl.hot : up > 0.38 ? pl.mid : pl.deep;
          // Foam: the top of the crest, and flecks the churn throws up the face.
          if (j === h && (face || slope > 0.6)) col = pl.core;
          else if (face && up > 0.5 && hash(Math.round(c * 1.4), j, seed) > 0.86) col = pl.core;
          g.put(gx, gy - j, col, alpha);
        }
      }
    }
    // Once it breaks, foam spreads out over where it fell.
    if (sink > 0) {
      for (let c = -w - 4 * sink; c <= w + 4 * sink; c += 0.8) {
        for (let a = -3; a <= 4 + 8 * sink; a += 0.8) {
          const gx = cx + dx * a + nx * c;
          const gy = cy + dy * a + ny * c;
          if (dither(Math.round(gx), Math.round(gy)) >= (1 - sink) * (0.8 - Math.abs(a) * 0.05)) continue;
          g.put(gx, gy, hash(Math.round(gx), Math.round(gy), 3) > 0.5 ? pl.core : pl.hot, 0.8);
        }
      }
    }
    g.end();
  }
}
