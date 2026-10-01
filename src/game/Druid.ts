import Phaser from 'phaser';
import { snap } from './display';
import { sound } from '../audio';
import type { Hurtbox } from './combat';
import { HitSpark, Shockwave, type Effect, type Scheme } from './Slash';
import { onGround } from './Toxins';
import { bindFoe } from './Strings';
import { bloom, clamp01, dither, easeOut, Fx, GROUND, hash, pal, pool, ring, shade, type Ink, type Pal } from './ultimate/ink';
import { AUTUMN_STYLE, FROST_STYLE, GROVE_STYLE, WILD_STYLE, type SpellStyle } from './spells';
import { TITANIA_STYLE } from './spells';
import type { Wizard, WizardKit, WizardSkin } from './Wizard';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';

// The Druid: the wizard's rig in two looks of its own (art/wizard.ts, heads
// 'grove' and 'wild'), played through the wizard's cast and charged special
// (Wizard.ts) with magic of the wild.
//  - The Grovekeeper throws thorn seeds that burst into a ring of thorns,
//    slowing everything they prick. Her charged ability grows a wild grove
//    where it's aimed: roots seize the foes in it as it springs up, it wears
//    down foes who stay in it, and it heals her while she stands in it.
//  - The Shapeshifter rakes with spirit claws, every third rake a heavier
//    maul. Her charged ability is a pounce: she becomes a spirit wolf, leaps
//    to the spot and lands on everything there. Tougher and quicker on her
//    feet, but her claws only reach so far.

export const GROVE_KIT: WizardKit = {
  maxHp: HERO_STATS['druid.grove'].hp,
  speed: HERO_STATS['druid.grove'].speed,
  castCooldown: 240,
  // Arms raised while the grove springs up.
  fireTime: (p) => 380 + 160 * p,
};

const leapTime = (p: number) => 280 + 90 * p;

export const WILD_KIT: WizardKit = {
  maxHp: HERO_STATS['druid.wild'].hp,
  speed: HERO_STATS['druid.wild'].speed,
  castCooldown: 40,
  // Held for the whole leap (as the wolf), and a breath after landing.
  fireTime: (p) => leapTime(p) + 140,
};

export const GROVE_SKIN: WizardSkin = { key: 'druid', style: GROVE_STYLE, kit: GROVE_KIT };
export const WILD_SKIN: WizardSkin = { key: 'druid_wild', style: WILD_STYLE, kit: WILD_KIT };
/** The Grovekeeper's Autumn Warden skin, and the Shapeshifter's Frostfang. */
export const AUTUMN_SKIN: WizardSkin = { key: 'druid_autumn', style: AUTUMN_STYLE, kit: GROVE_KIT };
export const FROST_SKIN: WizardSkin = { key: 'druid_frost', style: FROST_STYLE, kit: WILD_KIT };
/** The Grovekeeper's Titania skin, the faerie queen. */
export const TITANIA_SKIN: WizardSkin = { key: 'druid_titania', style: TITANIA_STYLE, kit: GROVE_KIT };

/** A druid look's magic: its spells and light, the charge's mark, and (for the grove) its moss, flowers and the tint of what it slows. */
export interface DruidMagic {
  style: SpellStyle;
  pal: Pal;
  fx: Scheme;
  /** The target ring and its fill. */
  mark: [number, number];
  /** On a foe slowed by thorns or the grove, and the grove's numbers. */
  tint: number;
  /** The grove's floor, darker and lighter. */
  moss: [number, number];
  flowers: number[];
}

const magic = (style: SpellStyle, light: number, rest: Omit<DruidMagic, 'style' | 'pal' | 'fx'>): DruidMagic => ({
  style,
  pal: pal(style.core, style.hot, style.mid, style.deep, light),
  fx: { core: style.core, hot: style.hot, mid: style.mid, deep: style.deep, light },
  ...rest,
});

export const GROVE_MAGIC = magic(GROVE_STYLE, 0x9aff6a, { mark: [0x4ec83a, 0xb8ff6a], tint: 0xa8ff7a, moss: [0x2e6a2a, 0x3e8a34], flowers: [0xffd66b, 0xfff6e8, 0xffa8c8] });
/** Autumn: russet leaves on the ground, and ember-bright light. */
export const AUTUMN_MAGIC = magic(AUTUMN_STYLE, 0xffa050, { mark: [0xd86a1e, 0xffc060], tint: 0xffb060, moss: [0x5a2a14, 0x7a3a18], flowers: [0xffd66b, 0xff8a3a, 0xd83a2a] });
/** Titania: a faerie ring of clover and blossom, pink and gold, with fireflies rising from it. */
export const TITANIA_MAGIC = magic(TITANIA_STYLE, 0xffb8d0, { mark: [0xe0608e, 0xffd88a], tint: 0xffb0d0, moss: [0x3e5a34, 0x5a7a44], flowers: [0xffb8d0, 0xfff4e8, 0xffd66b, 0xff8ab0] });
export const WILD_MAGIC = magic(WILD_STYLE, 0xffb050, { mark: [0xd8801e, 0xffc860], tint: 0xffc070, moss: [0x3a2a1a, 0x4a3a24], flowers: [] });
/** Frostfang: the spirit wolf in ice. */
export const FROST_MAGIC = magic(FROST_STYLE, 0x8ad0ff, { mark: [0x3a8ad8, 0xa8e0ff], tint: 0xa8e0ff, moss: [0x2a3a5a, 0x3a4a6a], flowers: [] });

export const GROVE_PAL = GROVE_MAGIC.pal;
export const WILD_PAL = WILD_MAGIC.pal;
/** Bark, darkest first: the roots and the thorns' stems. */
const BARK = [0x2c1e14, 0x4a3220, 0x6e4c30];
const HEAL_TINT = 0x9dff9a;

// Thorn seeds.
const SEED_SPEED = 150;
const SEED_LIFETIME = 1150;
const THORN_R = 13;
const THORN_DAMAGE = 3;
const THORN_SLOW = 0.55;
const THORN_SLOW_MS = 1400;

// The wild grove: to the mouse within these; on touch it lands further ahead the longer it charged.
const GROVE_MIN = 24;
const GROVE_MAX = 120;
const groveTouch = (level: number) => 40 + 60 * level;
const groveRadius = (p: number) => 18 + 14 * p;
const groveLife = (p: number) => 3400 + 2200 * p;
const rootMs = (p: number) => 900 + 900 * p;
const rootDamage = (p: number) => Math.round(5 + 9 * p);
const GROVE_TICK = 450;
const GROVE_TICK_DAMAGE = 2;
const GROVE_HEAL = 2;

// Spirit claws.
const RAKE_REACH = 24;
const MAUL_REACH = 29;
const RAKE_SPREAD = (62 * Math.PI) / 180;
const RAKE_DAMAGE = 9;
const MAUL_DAMAGE = 16;
/** A rake within this long of the last carries the chain on to the maul. */
const RAKE_CHAIN = 1100;

// The pounce.
const POUNCE_MIN = 20;
const POUNCE_MAX = 100;
const pounceTouch = (level: number) => 34 + 56 * level;
const slamRadius = (p: number) => 18 + 10 * p;
const slamDamage = (p: number) => Math.round(10 + 14 * p);

/** Where something aimed from a hero at (hx, hy) lands. The mouse is aimed from the chest, so it is measured from there. */
function spotAt(hx: number, hy: number, dx: number, dy: number, level: number, dist: number | undefined, min: number, max: number, touch: (l: number) => number): { x: number; y: number } {
  if (dist === undefined) {
    const r = touch(level);
    return { x: hx + dx * r, y: hy + dy * r };
  }
  const r = Phaser.Math.Clamp(dist, min, max);
  return { x: hx + dx * r, y: hy - 14 + dy * r };
}

/** The ring on the ground showing where a charged ability will land, filling as it charges. */
class Mark {
  private ring: Phaser.GameObjects.Image;
  private fill: Phaser.GameObjects.Image;
  private t = 0;

  constructor(world: WorldScene, tints: [number, number]) {
    this.ring = world.add.image(0, 0, 'danger_ring').setTint(tints[0]).setDepth(2).setVisible(false);
    this.fill = world.add.image(0, 0, 'danger_ring').setTint(tints[1]).setBlendMode(Phaser.BlendModes.ADD).setDepth(2).setVisible(false);
  }

  show(x: number, y: number, r: number, level: number): void {
    const pulse = 0.5 + Math.sin(this.t * 0.012) * 0.15;
    this.ring.setVisible(true).setPosition(snap(x), snap(y)).setScale(r / 22, (r * GROUND) / 12).setAlpha(0.7 + level * 0.3);
    this.fill.setVisible(true).setPosition(snap(x), snap(y)).setScale((r / 22) * level, ((r * GROUND) / 12) * level).setAlpha(pulse);
  }

  hide(): void {
    this.ring.setVisible(false);
    this.fill.setVisible(false);
  }

  update(dt: number): void {
    this.t += dt;
  }

  destroy(): void {
    this.ring.destroy();
    this.fill.destroy();
  }
}

// ---------------------------------------------------------------------------
// The Grovekeeper

/** Everything the Grovekeeper does in the world: her thorn seeds, the grove's mark while it charges, and the grove. */
export class Grovecraft implements Effect {
  dead = false;
  /** The druid casting, for where the grove is aimed from and whom it heals. */
  caster: Wizard | null = null;
  private mark: Mark;

  constructor(
    private world: WorldScene,
    private m: DruidMagic = GROVE_MAGIC,
  ) {
    this.mark = new Mark(world, m.mark);
  }

  /** A thorn seed from the staff. */
  seed(x: number, y: number, dx: number, dy: number): void {
    this.world.castEnergyBall(x, y, dx, dy, this.m.style, { speed: SEED_SPEED, lifetime: SEED_LIFETIME, onBurst: (bx, by) => this.thorns(bx, by) });
  }

  /** The seed bursts: thorns spring up round it, pricking and slowing all close by. The seed flies at chest height, so the ground is below it. */
  private thorns(x: number, y: number): void {
    const gy = y + 10;
    for (const h of this.world.hurtboxesWhere((b) => b.alive && onGround(b, x, gy, THORN_R))) {
      h.hurt({ damage: THORN_DAMAGE, heavy: false, knock: 20, fromX: x, fromY: gy });
      h.slow?.(THORN_SLOW, THORN_SLOW_MS, this.m.tint);
    }
    this.world.addEffect(new ThornBurst(this.world, x, gy, THORN_R, this.m.pal));
    sound.puff(this.world.pan(x));
  }

  target(dx: number, dy: number, level: number, dist?: number): void {
    const c = this.caster;
    if (!c) return;
    const p = spotAt(c.x, c.y, dx, dy, level, dist, GROVE_MIN, GROVE_MAX, groveTouch);
    this.mark.show(p.x, p.y, groveRadius(level), level);
  }

  untarget(): void {
    this.mark.hide();
  }

  /** Grow the grove at the spot aimed at. */
  grove(dx: number, dy: number, power: number, dist?: number): void {
    const c = this.caster;
    if (!c) return;
    const p = spotAt(c.x, c.y, dx, dy, power, dist, GROVE_MIN, GROVE_MAX, groveTouch);
    this.world.addEffect(new Grove(this.world, p.x, p.y, power, c, this.m));
    sound.bog(this.world.pan(p.x));
    sound.swell(this.world.pan(p.x));
  }

  update(dt: number): void {
    this.mark.update(dt);
  }

  destroy(): void {
    this.dead = true;
    this.mark.destroy();
  }
}

/** Thorns springing up in a ring where a seed burst, then withering back into the ground. */
class ThornBurst extends Fx {
  private g: Ink;
  private spikes: { x: number; y: number; h: number; lean: number }[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private r: number,
    private p: Pal,
  ) {
    super(world, 650);
    this.g = this.ink(Math.ceil(r * 2 + 10), Math.ceil(r * GROUND * 2 + 20));
    const seed = Math.floor(Math.random() * 1000);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + hash(i, seed) * 0.6;
      const d = r * (0.35 + 0.6 * hash(i, seed, 1));
      this.spikes.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * GROUND, h: 4 + Math.round(hash(i, seed, 2) * 4), lean: Math.cos(a) * 1.5 });
    }
    this.spikes.sort((a, b) => a.y - b.y);
  }

  protected step(): void {
    const { x, y, r, p, t } = this;
    const grow = easeOut(t / 110);
    const sink = clamp01((t - 420) / 230);
    const g = this.g.begin(x, y, y + 1, 0.5, (this.g.h - r * GROUND - 3) / this.g.h);
    if (t < 260) ring(g, x, y, 2 + r * easeOut(t / 200), 1, p, 0.7 * (1 - t / 260));
    for (const s of this.spikes) {
      const hh = Math.round(s.h * grow * (1 - sink));
      for (let j = 0; j < hh; j++) {
        const f = j / Math.max(1, s.h);
        const c = j >= hh - 1 ? p.core : j >= hh - 2 ? p.hot : j < 2 ? BARK[1] : p.mid;
        g.put(s.x + s.lean * f, s.y - j, c);
        if (j < hh * 0.4) g.put(s.x + s.lean * f + (s.lean > 0 ? -1 : 1), s.y - j, BARK[0]);
      }
    }
    g.end();
  }
}

/**
 * The wild grove: a patch of moss and flowers ringed with leaves. As it
 * springs up, roots seize the foes standing in it; after that, every tick it
 * pricks and slows the foes in it and heals the druid if she stands in it.
 */
class Grove extends Fx {
  private g: Ink;
  private r: number;
  private tickT = 0;
  private healed = 0;
  private popT = 0;
  private lamp: Phaser.GameObjects.Light;
  private plants: { x: number; y: number; h: number; flower: number; seed: number; d: number }[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private power: number,
    private hero: Wizard,
    private m: DruidMagic,
  ) {
    super(world, groveLife(power));
    const r = (this.r = groveRadius(power));
    this.g = this.ink(Math.ceil(r * 2 + 12), Math.ceil(r * GROUND * 2 + 28));
    this.lamp = this.light(x, y - 6, r * 3, this.m.pal.light, 0);
    const seed = Math.floor(Math.random() * 1000);
    const n = Math.round(8 + r * 0.5);
    for (let i = 0; i < n; i++) {
      const a = hash(i, seed, 1) * Math.PI * 2;
      const d = Math.sqrt(hash(i, seed, 2)) * 0.86;
      this.plants.push({
        x: x + Math.cos(a) * d * r,
        y: y + Math.sin(a) * d * r * GROUND,
        h: 2 + Math.floor(hash(i, seed, 3) * 4),
        flower: hash(i, seed, 4) < 0.35 || !m.flowers.length ? -1 : m.flowers[i % m.flowers.length],
        seed: i,
        d,
      });
    }
    this.plants.sort((a, b) => a.y - b.y);
    this.seize();
  }

  /** Roots burst up under every foe in the grove and hold them fast. */
  private seize(): void {
    const { world, x, y, r, power } = this;
    const ms = rootMs(power);
    for (const h of world.hurtboxesWhere((b) => b.alive && onGround(b, x, y, r))) {
      h.hurt({ damage: rootDamage(power), heavy: false, knock: 0, fromX: x, fromY: y });
      world.addEffect(new HitSpark(world, h.x, h.y - h.bodyY, this.m.fx, h.y + 13, false));
      if (bindFoe(h, ms)) world.addEffect(new Roots(world, h, ms, this.m.pal));
    }
    world.debris(this.m.pal.tints, x, y - 2, 14 + Math.round(power * 10), y + 20, 'spores');
    bloom(world, x, y - 4, this.m.pal.hot, 1 + power, 360, y + 20, 0.6);
  }

  private tick(): void {
    const { world, x, y, r } = this;
    for (const h of world.hurtboxesWhere((b) => b.alive && onGround(b, x, y, r))) {
      h.hurt({ damage: GROVE_TICK_DAMAGE, heavy: false, knock: 0, fromX: x, fromY: y, poison: this.m.tint });
      h.slow?.(0.6, GROVE_TICK + 150, this.m.tint);
    }
    const hero = this.hero;
    if (hero.vitals.alive && Math.hypot((hero.x - x) / r, (hero.y - y) / (r * GROUND)) <= 1) {
      const got = hero.vitals.heal(GROVE_HEAL);
      if (got > 0) {
        this.healed += got;
        world.debris([this.m.pal.core, this.m.pal.hot, HEAL_TINT], hero.x, hero.y - 6, 2, hero.y + 20, 'gather');
      }
    }
  }

  protected step(dt: number): void {
    const { world, x, y, r, t, life } = this;
    const grow = easeOut(t / 380);
    const fade = 1 - clamp01((t - (life - 600)) / 600);
    const a = Math.min(grow, fade);
    this.lamp.intensity = 1.1 * a * (0.9 + 0.1 * Math.sin(t * 0.006));

    this.tickT += dt;
    while (this.tickT >= GROVE_TICK) {
      this.tickT -= GROVE_TICK;
      if (fade > 0.3) this.tick();
    }
    // The healing is counted up over the head about once a second.
    this.popT -= dt;
    if (this.popT <= 0 && this.healed > 0) {
      world.popNumber(snap(this.hero.x), snap(this.hero.y) - 30, `+${this.healed}`, HEAL_TINT);
      sound.heal(world.pan(this.hero.x));
      this.healed = 0;
      this.popT = 900;
    }
    // Fireflies rising from it.
    if (a > 0.5 && Math.floor(t / 170) !== Math.floor((t - dt) / 170)) {
      const q = Math.random() * Math.PI * 2;
      const d = Math.random() * r * 0.8;
      world.debris([this.m.pal.core, this.m.pal.hot, this.m.flowers[0] ?? this.m.pal.core], x + Math.cos(q) * d, y + Math.sin(q) * d * GROUND - 2, 1, y + 20, 'spores');
    }

    const R = r * grow;
    const g = this.g.begin(x, y, 2.4, 0.5, (this.g.h - r * GROUND - 5) / this.g.h);
    pool(g, x, y, R, this.m.moss[0], this.m.moss[1], a, GROUND, 0.6);
    // Leaves round the rim, stirring as it lives.
    const n = Math.max(12, Math.round(R * 1.3));
    for (let k = 0; k < n; k++) {
      const q = (k / n) * Math.PI * 2 + t * 0.0003;
      const lx = x + Math.cos(q) * R;
      const ly = y + Math.sin(q) * R * GROUND;
      if (dither(Math.round(lx), Math.round(ly)) >= a) continue;
      g.put(lx, ly, k % 3 === 0 ? this.m.pal.hot : this.m.pal.mid);
      if (k % 2 === 0) g.put(lx, ly - 1, k % 4 === 0 ? this.m.pal.core : this.m.pal.hot);
    }
    // Shoots springing up one after another, flowers opening on some.
    this.plants.forEach((pl, i) => {
      if (pl.d > grow) return;
      const up = clamp01((t - 80 - i * 22) / 300) * fade;
      const hh = Math.round(pl.h * up);
      if (hh <= 0) return;
      const sway = hh >= 3 ? Math.round(Math.sin(t * 0.004 + pl.seed) * 0.7) : 0;
      for (let j = 0; j < hh; j++) g.put(pl.x + (j === hh - 1 ? sway : 0), pl.y - j, j === hh - 1 ? this.m.pal.hot : this.m.pal.mid);
      if (hh >= 2) g.put(pl.x + (pl.seed % 2 ? 1 : -1), pl.y - 1, this.m.pal.mid);
      if (pl.flower >= 0 && up > 0.85) {
        const fx = pl.x + sway;
        const fy = pl.y - hh;
        g.put(fx, fy, pl.flower);
        g.put(fx - 1, fy + 1, pl.flower, 0.7);
        g.put(fx + 1, fy + 1, pl.flower, 0.7);
      }
    });
    g.end();
  }
}

/** Roots coiled round a seized foe, following it until they let go and sink away. */
class Roots extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private h: Hurtbox,
    ms: number,
    private p: Pal,
  ) {
    super(world, ms + 250);
    this.g = this.ink(28, 34);
  }

  protected step(): void {
    const { h, p, t, life } = this;
    const grow = easeOut(t / 180);
    const sink = clamp01((t - (life - 250)) / 250);
    const top = Math.min(h.bodyY * 1.4, 20) * grow * (1 - sink);
    const g = this.g.begin(h.x, h.y + 2, h.y + 0.5, 0.5, 1);
    if (h.alive && top > 0) {
      // Three roots winding up round the body; only their near sides show.
      for (let k = 0; k < 3; k++) {
        const phase = k * 2.1 + 0.4;
        for (let j = 0; j <= top; j++) {
          const f = j / Math.max(1, top);
          const q = phase + f * 5.2;
          const rr = (h.radius + 1.5) * (1 - f * 0.35);
          if (Math.sin(q) < -0.15) continue;
          const c = f > 0.85 ? p.hot : Math.cos(q) < -0.3 ? BARK[0] : j % 3 === 0 ? BARK[2] : BARK[1];
          g.put(h.x + Math.cos(q) * rr, h.y - j, c);
        }
        // A leaf budding where each root ends.
        const q = phase + 5.2;
        g.put(h.x + Math.cos(q) * (h.radius + 1) * 0.65, h.y - top - 1, p.mid);
      }
      // Churned earth round the feet.
      for (let dx = -h.radius - 2; dx <= h.radius + 2; dx++) if ((dx + Math.round(h.x)) % 2 === 0) g.put(h.x + dx, h.y + 1, BARK[1], 0.8);
    }
    g.end();
  }
}

// ---------------------------------------------------------------------------
// The Shapeshifter

/** Everything the Shapeshifter does: her spirit claws, the pounce's mark while it charges, and the pounce. */
export class Wildcraft implements Effect {
  dead = false;
  caster: Wizard | null = null;
  private mark: Mark;
  private clock = 0;
  private lastRake = -Infinity;
  private chain = 0;

  constructor(
    private world: WorldScene,
    private m: DruidMagic = WILD_MAGIC,
  ) {
    this.mark = new Mark(world, m.mark);
  }

  /** A rake of spirit claws the way she casts; every third in a quick chain is a heavier maul. */
  claws(dx: number, dy: number): void {
    const c = this.caster;
    if (!c) return;
    this.chain = this.clock - this.lastRake <= RAKE_CHAIN && this.chain < 3 ? this.chain + 1 : 1;
    this.lastRake = this.clock;
    const maul = this.chain === 3;
    const cx = c.x;
    const cy = c.y - 12;
    const angle = Math.atan2(dy, dx);
    const reach = maul ? MAUL_REACH : RAKE_REACH;
    const side = this.chain % 2 ? 1 : -1;
    const w = this.world;
    w.addEffect(new ClawRake(w, cx, cy, angle, reach, side, maul, this.m.pal, c.y + (dy < -0.5 ? -0.5 : 1)));
    sound.knife(w.pan(cx), this.chain, maul);
    const hits = w.melee({ kind: 'arc', x: cx, y: cy, radius: reach, angle, spread: RAKE_SPREAD }, { damage: maul ? MAUL_DAMAGE : RAKE_DAMAGE, heavy: maul, knock: maul ? 150 : 50 });
    for (const h of hits) {
      w.addEffect(new HitSpark(w, h.x, h.y, this.m.fx, h.y + 13, maul));
      sound.punchHit(w.pan(h.x), maul);
    }
    if (hits.length) w.cameras.main.shake(maul ? 110 : 60, maul ? 0.0005 : 0.0003);
  }

  target(dx: number, dy: number, level: number, dist?: number): void {
    const p = this.landing(dx, dy, level, dist);
    if (p) this.mark.show(p.x, p.y, slamRadius(level), level);
  }

  untarget(): void {
    this.mark.hide();
  }

  /** Become the spirit wolf and leap to the spot. */
  pounce(dx: number, dy: number, power: number, dist?: number): void {
    const c = this.caster;
    const p = this.landing(dx, dy, power, dist);
    if (!c || !p) return;
    this.world.evade(leapTime(power) + 80);
    this.world.addEffect(new Pounce(this.world, c, p.x, p.y, power, this.m));
    sound.windDash(this.world.pan(c.x));
  }

  /** Where a pounce lands: the spot aimed at, or as far toward it as there is ground to land on. */
  private landing(dx: number, dy: number, level: number, dist?: number): { x: number; y: number } | null {
    const c = this.caster;
    if (!c) return null;
    const want = spotAt(c.x, c.y, dx, dy, level, dist, POUNCE_MIN, POUNCE_MAX, pounceTouch);
    const len = Math.hypot(want.x - c.x, want.y - c.y);
    let ok = { x: c.x, y: c.y };
    const steps = Math.ceil(len / 4);
    for (let i = 1; i <= steps; i++) {
      const x = c.x + ((want.x - c.x) * i) / steps;
      const y = c.y + ((want.y - c.y) * i) / steps;
      if (!this.world.walkable(x, y)) break;
      ok = { x, y };
    }
    return ok;
  }

  update(dt: number): void {
    this.clock += dt;
    this.mark.update(dt);
  }

  destroy(): void {
    this.dead = true;
    this.mark.destroy();
  }
}

/** Three (a maul: four) claws of spirit light raking across in front of her. */
class ClawRake extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private angle: number,
    private reach: number,
    private side: number,
    private maul: boolean,
    private p: Pal,
    private depth: number,
  ) {
    super(world, maul ? 300 : 240);
    const s = Math.ceil(reach * 2 + 10);
    this.g = this.ink(s, s);
  }

  protected step(): void {
    const { x, y, angle, reach, side, p, t, life } = this;
    const k = t / life;
    const prog = easeOut(clamp01(t / (life * 0.55)));
    const g = this.g.begin(x, y, this.depth);
    const a0 = angle - side * RAKE_SPREAD;
    const a1 = angle + side * RAKE_SPREAD;
    const head = a0 + (a1 - a0) * prog;
    const tail = 1.1;
    const claws = this.maul ? 4 : 3;
    for (let n = 0; n < claws; n++) {
      const rr = reach - 1 - n * 3.4;
      const steps = Math.ceil(rr * tail * 1.4);
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const q = head - side * u * tail;
        // Only the part already swept.
        if (side > 0 ? q < a0 : q > a0) break;
        const fade = (1 - u) * (1 - k * k);
        if (fade <= 0.05) continue;
        const px = x + Math.cos(q) * rr;
        const py = y + Math.sin(q) * rr;
        g.put(px, py, shade(p, u * 0.9), Math.min(1, fade * 1.4));
        if (u < 0.35) g.put(px + Math.cos(q), py + Math.sin(q), p.hot, fade);
      }
    }
    g.end();
  }
}

/**
 * A spirit beast in glowing pixels, facing `dir` (1 right, -1 left), its body
 * centred on (x, y): a wolf, or a stag with a crown of antlers. `stride` 0..1
 * stretches its legs (reaching in a leap or a gallop). Bright at its heart,
 * deepening to its edge; `a` fades it away in a dithered checker.
 */
export function spiritBeast(g: Ink, x: number, y: number, dir: number, kind: 'wolf' | 'stag', stride: number, p: Pal, a = 1): void {
  type Cap = [number, number, number, number, number, number];
  const s = stride;
  const caps: Cap[] =
    kind === 'wolf'
      ? [
          [-5, 0, 4, -0.5, 2.4, 2.8],
          [4, -0.5, 7.5, -3, 2.2, 2.0],
          [7.5, -3, 10.5, -2.3, 1.2, 0.8],
          [6.8, -4.5, 6.4, -7, 0.9, 0.3],
          [-5, -0.5, -10, -2.5 + s * 2, 1.1, 0.5],
          [4, 1.5, 7 + 4 * s, 5 - s, 0.9, 0.6],
          [3, 1.5, 5 + 3 * s, 5.5, 0.8, 0.55],
          [-4, 1.5, -7 - 4 * s, 4.5 - s, 0.9, 0.6],
          [-3, 1.5, -5 - 3 * s, 5.5, 0.8, 0.55],
        ]
      : [
          [-5, 0, 4, 0, 2.8, 3.0],
          [4, -0.5, 6.5, -5, 1.8, 1.5],
          [6.5, -5, 9.5, -4, 1.5, 1.0],
          [6.5, -6.5, 5, -11, 0.55, 0.3],
          [5.8, -9, 8.5, -12, 0.5, 0.3],
          [5.4, -8, 3, -10.5, 0.5, 0.3],
          [-5, -1, -6.8, -2.8, 0.9, 0.5],
          [4, 2, 7.5 + 4 * s, 6.5 - s, 0.8, 0.55],
          [3, 2, 5 + 3 * s, 7, 0.75, 0.5],
          [-4, 2, -7.5 - 4 * s, 6 - s, 0.8, 0.55],
          [-3, 2, -5 - 3 * s, 7, 0.75, 0.5],
        ];
  const eye = kind === 'wolf' ? [8, -3.4] : [8, -5];
  for (let ly = -13; ly <= 8; ly++) {
    for (let lx = -12; lx <= 12; lx++) {
      const px = lx + 0.5;
      const py = ly + 0.5;
      let d = Infinity;
      for (const [x0, y0, x1, y1, r0, r1] of caps) {
        const vx = x1 - x0;
        const vy = y1 - y0;
        const f = clamp01(((px - x0) * vx + (py - y0) * vy) / (vx * vx + vy * vy || 1));
        const r = r0 + (r1 - r0) * f;
        d = Math.min(d, Math.hypot(px - (x0 + vx * f), py - (y0 + vy * f)) / r);
      }
      if (d > 1) continue;
      const wx = Math.round(x + dir * lx);
      const wy = Math.round(y + ly);
      if (a < 1 && dither(wx, wy) >= a) continue;
      g.put(wx, wy, d > 0.82 ? p.deep : shade(p, d * 0.85));
    }
  }
  g.put(Math.round(x + dir * eye[0]), Math.round(y + eye[1]), 0xffffff, a);
}

/**
 * The pounce: she becomes a spirit wolf, leaps along an arc to the spot and
 * comes down on everything there with a slam and the rake of its claws.
 */
class Pounce extends Fx {
  private g: Ink;
  private scratch: Ink;
  private shadow: Phaser.GameObjects.Image;
  private sx: number;
  private sy: number;
  private dir: number;
  private time: number;
  private landed = false;

  constructor(
    world: WorldScene,
    private hero: Wizard,
    private tx: number,
    private ty: number,
    private power: number,
    private m: DruidMagic,
  ) {
    const time = leapTime(power);
    super(world, time + 600);
    this.time = time;
    this.sx = hero.x;
    this.sy = hero.y;
    this.dir = tx >= hero.x ? 1 : -1;
    this.g = this.ink(34, 30);
    this.scratch = this.ink(Math.ceil(slamRadius(power) * 2 + 12), Math.ceil(slamRadius(power) * 2 * GROUND + 12));
    this.shadow = this.own(world.add.image(hero.x, hero.y, 'shadow').setDepth(1.5).setAlpha(0.7));
    hero.veil = 1;
    world.debris(this.m.pal.tints, hero.x, hero.y - 10, 12, hero.y + 20, 'burst');
    bloom(world, hero.x, hero.y - 10, this.m.pal.hot, 1.2, 260, hero.y + 20);
  }

  protected step(dt: number): void {
    const { world, hero, t } = this;
    if (!this.landed) {
      const k = clamp01(t / this.time);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      hero.x = this.sx + (this.tx - this.sx) * e;
      hero.y = this.sy + (this.ty - this.sy) * e;
      const lift = Math.sin(k * Math.PI) * (10 + 8 * this.power);
      const bx = snap(hero.x);
      const by = snap(hero.y) - 7 - lift;
      const g = this.g.begin(bx, by, snap(hero.y) + 0.5);
      // Crouched to spring, stretched in the air, gathering to land.
      spiritBeast(g, bx, by, this.dir, 'wolf', k < 0.15 ? 0.2 : k > 0.85 ? 0.4 : 1, this.m.pal);
      g.end();
      this.shadow.setPosition(snap(hero.x), snap(hero.y)).setScale(1 - lift / 60);
      if (Math.floor(t / 30) !== Math.floor((t - dt) / 30)) world.debris([this.m.pal.hot, this.m.pal.mid], bx - this.dir * 8, by, 1, snap(hero.y) + 20, 'trail');
      if (k >= 1) this.land();
      return;
    }
    // The claw marks it tore in the ground cool away.
    const a = 1 - clamp01((t - this.time - 200) / 400);
    const r = slamRadius(this.power);
    const g = this.scratch.begin(this.tx, this.ty, 2.5);
    for (let n = -1; n <= 1; n++) {
      for (let i = -r * 0.6; i <= r * 0.6; i++) {
        const u = Math.abs(i) / (r * 0.6);
        if (dither(Math.round(this.tx + i), Math.round(this.ty + n * 3)) >= a * (1 - u * u)) continue;
        g.put(this.tx + i, this.ty + n * 3 + i * 0.25, u < 0.4 ? this.m.pal.hot : this.m.pal.mid);
      }
    }
    g.end();
  }

  /** It comes down: the spirit breaks back into the druid, and everything there is struck. */
  private land(): void {
    this.landed = true;
    const { world, hero, tx, ty, power } = this;
    hero.x = tx;
    hero.y = ty;
    hero.veil = 0;
    this.g.begin(0, 0, 0).end();
    this.shadow.setVisible(false);
    const r = slamRadius(power);
    const hits = world.melee({ kind: 'circle', x: tx, y: ty - 6, radius: r }, { damage: slamDamage(power), heavy: true, knock: 150, fromX: tx, fromY: ty });
    for (const h of hits) world.addEffect(new HitSpark(world, h.x, h.y, this.m.fx, h.y + 13, true));
    world.addEffect(new Shockwave(world, tx, ty - 1, r + 8, this.m.fx));
    world.debris(this.m.pal.tints, tx, ty - 4, 16 + Math.round(power * 10), ty + 20, 'burst');
    world.debris([0x8a7a60, 0x5a4a38, this.m.pal.mid], tx, ty - 2, 10, ty + 20, 'spores');
    world.cameras.main.shake(140 + 60 * power, 0.0007 + 0.0005 * power);
    sound.slam(world.pan(tx));
    if (hits.length) sound.punchHit(world.pan(tx), true);
  }

  destroy(): void {
    this.hero.veil = 0;
    super.destroy();
  }
}
