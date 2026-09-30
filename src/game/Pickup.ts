import Phaser from 'phaser';
import { ITEMS, type ItemId } from './items';
import { GEAR_SETS, RARITY, type GearDef, type Rarity, type SetId } from './gear';
import { MAT_SIZE, MATERIALS, matIcon } from './forge';
import { DROP_H } from '../art/items';
import { GEAR_DROP } from '../art/gear';
import { GEM_DROPS, gemDropFor } from '../art/shop';
import { CANDY_DROPS, candyDropFor } from '../art/candy';
import { DUST_DROP_H } from '../art/omens';
import type { Effect } from './Slash';
import { petMods } from './pets';

/** What lies on the ground: a potion for the hotbar, a piece of gear, gems or dust (`n` of them, in one pile), a boss's materials for the Forge, or a season's candy. */
export type Loot = { kind: 'item'; id: ItemId } | { kind: 'gear'; def: GearDef } | { kind: 'gems'; n: number } | { kind: 'dust'; n: number } | { kind: 'mat'; set: SetId; n: number } | { kind: 'candy'; n: number };

/** Pulled towards the hero from this close, and picked up at this distance. */
const MAGNET = 30;
/** Gear pulls from further off, so walking past it is enough. */
const GEAR_MAGNET = 38;
const REACH = 7;
/** Lies on the ground this long, blinking for the last few seconds. */
const LIFE = 60000;
const BLINK = 5000;
const POP_TIME = 420;
/** A legendary doesn't hop out: light marks the spot, then it falls from the sky like a star. */
const OMEN = 380;
const FALL = 520;
const FALL_FROM = 130;
/**
 * How one gem of a shower leaves its monster: where it lands (from the spot
 * it burst out of), how long after the first it flies, and how high it arcs.
 */
export interface Burst {
  dx: number;
  dy: number;
  delay: number;
  height: number;
}
/** A gem of a shower settles with a little bounce this high, for this long. */
const BOUNCE = 3;
const BOUNCE_TIME = 170;
/** ...and lies still this long before it drifts to the hero, so the shower is seen to land. */
const SETTLE = 140;

/** Loot lights at once, over everything else lit in the scene (render.maxLights is 16). */
const MAX_LOOT_LIGHTS = 3;
/** Above the world, under the aim line and the sky. */
const ARROW_DEPTH = 14000;

/**
 * How a rarity announces itself on the ground. Rare finds get a short pillar
 * of light; epics a tall one over a rune circle, with a ring as they land,
 * twinkling stars and an arrow when off screen; legendaries fall from the
 * sky, strike the ground with a flash and two rings, and lie in a full
 * pillar with slowly turning god rays and their own light.
 */
interface Show {
  /** Height of the pillar, as a share of the texture. */
  beam: number;
  /** Its width. */
  width: number;
  rays: number;
  twinkles: number;
  motes: number;
  runes: boolean;
  rings: number;
  arrow: boolean;
  light: boolean;
  star: boolean;
  /** The pillar's outer colour and its hot core. */
  accent: number;
  core: number;
  /** A second colour for every other god ray (a gem hoard's prism). */
  prism?: number;
  /** How far the landing rings spread, times the usual. */
  spread?: number;
}

const SHOWS: Partial<Record<Rarity, Show>> = {
  rare: { beam: 0.3, width: 0.8, rays: 0, twinkles: 0, motes: 1, runes: false, rings: 1, arrow: false, light: false, star: false, accent: 0xffc93a, core: 0xfff4c0 },
  epic: { beam: 0.62, width: 1, rays: 0, twinkles: 2, motes: 2, runes: true, rings: 1, arrow: true, light: false, star: false, accent: 0xa860ff, core: 0xeedcff },
  legendary: { beam: 1, width: 1.25, rays: 8, twinkles: 3, motes: 3, runes: true, rings: 2, arrow: true, light: true, star: true, accent: 0xffcf6a, core: 0xfffbef },
};

/** Gems: cyan crystal light, grander the more of them fell, up to a hoard's prism of rays. */
const GEM_ACCENT = 0x5ae8ff;
const GEM_CORE = 0xeaffff;
const GEM_PRISM = 0xff7ae6;
function gemShow(n: number): Show {
  const base = { accent: GEM_ACCENT, core: GEM_CORE };
  if (n >= 10) return { ...base, beam: 1, width: 1.7, rays: 12, twinkles: 5, motes: 6, runes: true, rings: 3, arrow: true, light: true, star: true, prism: GEM_PRISM, spread: 1.5 };
  if (n >= 5) return { ...base, beam: 1, width: 1.3, rays: 8, twinkles: 3, motes: 4, runes: true, rings: 2, arrow: true, light: true, star: true, prism: GEM_PRISM };
  if (n >= 2) return { ...base, beam: 0.65, width: 1, rays: 0, twinkles: 2, motes: 2, runes: true, rings: 1, arrow: true, light: false, star: false };
  return { ...base, beam: 0.38, width: 0.8, rays: 0, twinkles: 1, motes: 1, runes: false, rings: 1, arrow: false, light: false, star: false };
}

/** Dust: a violet glimmer, a short pillar for a handful and an epic's for a sackful. */
const DUST_ACCENT = 0xb07aff;
const DUST_CORE = 0xf4ecff;
function dustShow(n: number): Show | null {
  const base = { accent: DUST_ACCENT, core: DUST_CORE };
  if (n >= 8) return { ...base, beam: 0.62, width: 1, rays: 0, twinkles: 2, motes: 2, runes: true, rings: 1, arrow: true, light: false, star: false };
  if (n >= 3) return { ...base, beam: 0.32, width: 0.8, rays: 0, twinkles: 1, motes: 1, runes: false, rings: 1, arrow: false, light: false, star: false };
  return null;
}

/**
 * Candy: pumpkin-orange light with a violet heart, a plain glint for a sweet
 * or two, a short pillar for a handful, and a boss's hoard falling like a star.
 */
const CANDY_ACCENT = 0xff8a2a;
const CANDY_CORE = 0xfff0c8;
const CANDY_PRISM = 0xb07aff;
function candyShow(n: number): Show | null {
  const base = { accent: CANDY_ACCENT, core: CANDY_CORE };
  if (n >= 8) return { ...base, beam: 1, width: 1.3, rays: 8, twinkles: 4, motes: 5, runes: true, rings: 2, arrow: true, light: true, star: true, prism: CANDY_PRISM, spread: 1.3 };
  if (n >= 3) return { ...base, beam: 0.4, width: 0.85, rays: 0, twinkles: 1, motes: 2, runes: false, rings: 1, arrow: false, light: false, star: false };
  return null;
}

/** How grand a find is: 0 for potions and common gear, up to 4 for a legendary (or a pile of five gems or more). */
export function grade(loot: Loot): number {
  if (loot.kind === 'item') return 0;
  if (loot.kind === 'candy') return loot.n >= 8 ? 4 : loot.n >= 3 ? 2 : 1;
  if (loot.kind === 'dust') return loot.n >= 8 ? 3 : loot.n >= 3 ? 2 : 1;
  if (loot.kind === 'gems') return loot.n >= 5 ? 4 : loot.n >= 2 ? 3 : 2;
  if (loot.kind === 'mat') return 3;
  return { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 }[loot.def.rarity];
}

/** Loot lights alive now, so a boss's pile of legendaries can't starve the rest of the scene. */
const lit = new Set<Pickup>();

interface Ring {
  img: Phaser.GameObjects.Image;
  t: number;
}

/**
 * An item lying on the ground: it hops out of a slain monster, bobs over a
 * soft glow and a shadow, drifts to the hero once they come near and is
 * picked up on touch (a potion only when the hotbar has room). Gear glows in
 * its rarity's colour, brighter the rarer it is, and rare, epic and
 * legendary gear make a show of it (see Show).
 */
export class Pickup {
  dead = false;
  /** When it has come to rest; `onLand` runs once, then. */
  onLand: ((p: Pickup) => void) | null = null;
  private sprite: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private age = 0;
  private fromX: number;
  private fromY: number;
  private seed = Math.random() * 10;
  private magnet: number;
  /** Gear lies twice as long as a potion. */
  private life: number;
  /** Glow size; rarer gear shines bigger. */
  private shine: number;
  /** Gear floats a little higher, being bigger. */
  private lift: number;
  private popTime: number;
  private landed = false;

  // The show, for rare gear and better.
  private show: Show | null = null;
  private beamOuter: Phaser.GameObjects.Image | null = null;
  private beamInner: Phaser.GameObjects.Image | null = null;
  private runes: Phaser.GameObjects.Image | null = null;
  private arrow: Phaser.GameObjects.Image | null = null;
  private trail: Phaser.GameObjects.Image | null = null;
  private flash: Phaser.GameObjects.Image | null = null;
  private rays: Phaser.GameObjects.Image[] = [];
  private twinkles: Phaser.GameObjects.Image[] = [];
  private motes: Phaser.GameObjects.Image[] = [];
  private rings: Ring[] = [];
  private light: Phaser.GameObjects.Light | null = null;
  private landT = 0;
  /** One gem of a shower: no pillar each, just a glint now and then. */
  private burst: Burst | null;
  private glint: Phaser.GameObjects.Image | null = null;

  constructor(
    private scene: Phaser.Scene,
    public x: number,
    public y: number,
    readonly loot: Loot,
    burst?: Burst,
  ) {
    this.burst = burst ?? null;
    const gear = loot.kind === 'gear' ? loot.def : null;
    const gems = loot.kind === 'gems' ? loot.n : 0;
    const dust = loot.kind === 'dust' ? loot.n : 0;
    const mat = loot.kind === 'mat' ? loot.set : null;
    const candy = loot.kind === 'candy' ? loot.n : 0;
    const pile = gemDropFor(gems);
    const bag = candyDropFor(candy);
    const look =
      loot.kind === 'gear'
        ? { tint: RARITY[loot.def.rarity].tint, texture: loot.def.drop }
        : loot.kind === 'gems'
          ? { tint: GEM_ACCENT, texture: `gem_drop_${pile}` }
          : loot.kind === 'dust'
            ? { tint: DUST_ACCENT, texture: 'dust_drop' }
            : loot.kind === 'mat'
              ? { tint: MATERIALS[loot.set].tint, texture: matIcon(loot.set) }
              : loot.kind === 'candy'
                ? { tint: CANDY_ACCENT, texture: `candy_drop_${bag}` }
                : { tint: ITEMS[loot.id].tint, texture: ITEMS[loot.id].drop };
    const big = !!(gear || gems || dust || mat || candy);
    const h = gear ? GEAR_DROP : gems ? GEM_DROPS[pile].h : dust ? DUST_DROP_H : mat ? MAT_SIZE : candy ? CANDY_DROPS[bag].h : DROP_H;
    // A worn scarab draws loot in from further off.
    this.magnet = (big ? GEAR_MAGNET : MAGNET) * petMods.reach;
    this.life = big ? LIFE * 2 : LIFE;
    this.shine = gear ? { common: 0.8, uncommon: 0.9, rare: 1, epic: 1.25, legendary: 1.5 }[gear.rarity] : gems ? { one: 0.9, few: 1.15, heap: 1.5, hoard: 1.9 }[pile] : dust ? Math.min(1.3, 0.8 + dust * 0.05) : mat ? 1.2 : candy ? { one: 0.8, few: 1, heap: 1.7 }[bag] : 0.75;
    this.fromX = x;
    this.fromY = y;
    if (burst) {
      // Flung out of the shower to its own spot, a moment after the one before.
      this.x += burst.dx;
      this.y += burst.dy;
      this.age = -burst.delay;
    } else {
      // Lands a short hop away from where it fell.
      const a = Math.random() * Math.PI * 2;
      this.x += Math.cos(a) * 10;
      this.y += Math.sin(a) * 6;
    }
    this.shadow = scene.add.image(x, y, 'shadow').setScale(gear ? 0.8 : 0.55, 0.8).setDepth(1).setAlpha(0.7);
    this.glow = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(look.tint).setScale(this.shine).setAlpha(0);
    this.sprite = scene.add.image(x, y, look.texture).setOrigin(0.5, (h - 1) / h);
    this.lift = big ? 3 : 0;
    this.popTime = POP_TIME;
    if (burst) {
      // Further gems take a little longer in the air; none shows before its turn.
      this.popTime = POP_TIME * (0.85 + Math.hypot(burst.dx, burst.dy) / 90);
      this.glint = scene.add.image(x, y, 'loot_twinkle').setBlendMode(Phaser.BlendModes.ADD).setTint(GEM_CORE).setAlpha(0);
      for (const o of [this.sprite, this.glow, this.shadow]) o.setVisible(false);
      return;
    }

    // Materials stand in an epic's pillar, in their set's colour.
    const base = gems ? gemShow(gems) : dust ? dustShow(dust) : mat ? SHOWS.epic : candy ? candyShow(candy) : gear && SHOWS[gear.rarity];
    if (!base) return;
    // A set piece shines in its set's colour.
    const show: Show = { ...base, accent: gear?.set ? GEAR_SETS[gear.set].tint : mat ? MATERIALS[mat].tint : base.accent };
    this.show = show;
    const add = (key: string, tint: number) => scene.add.image(this.x, this.y, key).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(0);
    this.beamOuter = add('loot_beam', show.accent).setOrigin(0.5, 1);
    this.beamInner = add('loot_beam', show.core).setOrigin(0.5, 1);
    if (show.runes) this.runes = add('loot_runes', show.accent).setDepth(1.2);
    for (let i = 0; i < show.rays; i++) this.rays.push(add('loot_ray', i % 2 ? (show.prism ?? show.core) : show.accent).setOrigin(0.5, 1));
    for (let i = 0; i < show.twinkles; i++) this.twinkles.push(add('loot_twinkle', show.core));
    for (let i = 0; i < show.motes; i++) this.motes.push(add('spark', i % 2 ? show.accent : show.core));
    if (show.arrow) this.arrow = scene.add.image(0, 0, 'loot_arrow').setTint(show.accent).setDepth(ARROW_DEPTH).setVisible(false);
    if (show.star) {
      // Falls straight down onto where it will lie, a comet's tail of light above it.
      this.popTime = OMEN + FALL;
      this.fromX = this.x;
      this.fromY = this.y;
      this.sprite.setVisible(false);
      this.trail = add('loot_beam', show.core).setOrigin(0.5, 1);
      this.flash = add('glow', show.core);
    }
  }

  /** How grand this find is (see grade). */
  get grade(): number {
    return grade(this.loot);
  }

  /** `hx, hy` are the hero's feet, or null when they can't pick things up. Returns true once touched. */
  update(dt: number, hx: number | null, hy: number | null, room: boolean, daylight: number): boolean {
    if (this.dead) return false;
    this.age += dt;
    if (this.age < 0) return false;
    if (this.burst && !this.sprite.visible) for (const o of [this.sprite, this.glow, this.shadow]) o.setVisible(true);
    let x: number;
    let y: number;
    let lift: number;
    if (this.age < this.popTime) {
      if (this.show?.star) {
        // The omen, then the fall: slow at first, striking fast.
        const t = Math.max(0, (this.age - OMEN) / FALL);
        x = this.x;
        y = this.y;
        lift = FALL_FROM * (1 - t * t) + 2 + this.lift;
      } else {
        // The hop out: an arc from the monster's body to the ground.
        const t = this.age / this.popTime;
        x = this.fromX + (this.x - this.fromX) * t;
        y = this.fromY + (this.y - this.fromY) * t;
        lift = Math.sin(t * Math.PI) * (this.burst?.height ?? 14) + (1 - t) * 6;
      }
    } else {
      if (!this.landed) this.land();
      const since = this.age - this.popTime;
      if (hx !== null && hy !== null && room && (!this.burst || since > SETTLE)) {
        const dx = hx - this.x;
        const dy = hy - this.y;
        const d = Math.hypot(dx, dy);
        if (d < REACH) return true;
        if (d < this.magnet) {
          const k = Math.min(1, (dt / 1000) * (60 + (this.magnet - d) * 6) / d);
          this.x += dx * k;
          this.y += dy * k;
        }
      }
      x = this.x;
      y = this.y;
      lift = 2 + this.lift + Math.sin(this.age * 0.004 + this.seed) * 1.5;
      if (this.burst && since < BOUNCE_TIME) lift += Math.sin((since / BOUNCE_TIME) * Math.PI) * BOUNCE;
    }
    const left = this.life - this.age;
    if (left <= 0) {
      this.destroy();
      return false;
    }
    const blink = left < BLINK && Math.sin(this.age * 0.02) < -0.2 ? 0.25 : 1;
    const rx = Math.round(x);
    const ry = Math.round(y);
    // Unlit art, so dim it a touch at night to sit with the lit world; the glow carries it.
    const shade = Math.round(255 * (0.72 + 0.28 * daylight));
    this.sprite.setPosition(rx, Math.round(ry - lift)).setDepth(ry).setAlpha(blink).setTint(Phaser.Display.Color.GetColor(shade, shade, Math.min(255, shade + 20)));
    this.glow.setPosition(rx, Math.round(ry - lift - 4 - this.lift * 1.5)).setDepth(ry - 0.1).setAlpha((0.35 + 0.15 * Math.sin(this.age * 0.006 + this.seed)) * (1.3 - daylight * 0.5) * blink);
    this.shadow.setPosition(rx, ry).setAlpha(0.6 * blink);
    if (this.show) this.updateShow(dt, rx, ry, lift, blink);
    if (this.glint) {
      // Every so often light catches a facet: a four-point star flares and fades.
      const u = ((this.age / 1000 + this.seed) % 1.7) / 0.22;
      const on = u < 1 ? Math.sin(u * Math.PI) : 0;
      this.glint
        .setPosition(rx + 2, Math.round(ry - lift - 7))
        .setDepth(ry + 0.1)
        .setScale(0.5 + 0.5 * on)
        .setAlpha(on * blink);
    }
    return false;
  }

  /** Come to rest: the rings go out, and the world gets to cheer (sound, sparks, a shake). */
  private land(): void {
    this.landed = true;
    const show = this.show;
    if (show) {
      for (let i = 0; i < show.rings; i++) {
        const img = this.scene.add.image(this.x, this.y, 'loot_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(i ? show.core : show.accent).setDepth(1.3).setAlpha(0);
        this.rings.push({ img, t: -i * 120 });
      }
      if (show.light && this.scene.lights?.active) {
        for (const p of lit) if (p.dead || p.scene !== this.scene) lit.delete(p);
        if (lit.size < MAX_LOOT_LIGHTS) {
          this.light = this.scene.lights.addLight(this.x, this.y - 8, 70, show.accent, 1.6);
          lit.add(this);
        }
      }
    }
    this.onLand?.(this);
  }

  private updateShow(dt: number, rx: number, ry: number, lift: number, blink: number): void {
    const show = this.show!;
    const cy = Math.round(ry - lift - 5);

    if (!this.landed) {
      // Rare and epic finds are still hopping out: their pillar rises as they land.
      // (Only a falling star has a trail and a flash; the hop outlasts OMEN.)
      if (!show.star) return;
      // Legendary only: a thin shaft marks the spot, then the star comes down it.
      const omen = Math.min(1, this.age / OMEN);
      this.beamInner!.setPosition(rx, ry + 1).setDepth(ry - 0.3).setScale(0.35, show.beam * (0.4 + 0.6 * omen)).setAlpha(0.5 * omen);
      this.runes?.setPosition(rx, ry).setAlpha(0.6 * omen);
      this.shadow.setScale(0.3 + 0.5 * omen, 0.8);
      if (this.age >= OMEN) {
        this.sprite.setVisible(true);
        const t = (this.age - OMEN) / FALL;
        this.trail!.setPosition(rx, cy + 4).setDepth(ry + 0.2).setScale(0.9, 0.25 + 0.35 * (1 - t)).setAlpha(0.9);
        this.flash!.setPosition(rx, cy).setDepth(ry + 0.1).setScale(1.2 + t * 0.6).setAlpha(0.9);
      }
      return;
    }

    this.landT += dt;
    // The pillar rises out of the ground as it lands, then breathes.
    const rise = Math.min(1, this.landT / 350);
    const riseE = 1 - Math.pow(1 - rise, 3);
    const breathe = Math.sin(this.age * 0.003 + this.seed);
    const tall = show.beam * riseE * (1 + 0.04 * breathe);
    this.beamOuter!.setPosition(rx, ry + 1).setDepth(ry - 0.3).setScale(show.width * 1.9, tall).setAlpha((0.42 + 0.1 * breathe) * blink);
    this.beamInner!.setPosition(rx, ry + 1).setDepth(ry - 0.25).setScale(show.width * 0.6, tall * 0.92).setAlpha((0.7 + 0.1 * breathe) * blink);
    this.runes?.setPosition(rx, ry).setAlpha((0.55 + 0.25 * Math.sin(this.age * 0.004)) * blink);

    // God rays, slowly turning, long and short in turn.
    const n = this.rays.length;
    for (let i = 0; i < n; i++) {
      const long = i % 2 ? 0.62 : 1;
      const pulse = 0.85 + 0.15 * Math.sin(this.age * 0.005 + i * 1.7);
      this.rays[i]
        .setPosition(rx, cy)
        .setDepth(ry - 0.28)
        .setRotation((i / n) * Math.PI * 2 + this.age * 0.00035)
        .setScale(1, long * pulse * riseE)
        .setAlpha((i % 2 ? 0.55 : 0.4) * blink);
    }

    // Stars circling it, passing behind and in front.
    const m = this.twinkles.length;
    for (let i = 0; i < m; i++) {
      const a = this.age * 0.0022 + (i / m) * Math.PI * 2;
      const s = Math.sin(this.age * 0.009 + i * 2.1);
      this.twinkles[i]
        .setPosition(Math.round(rx + Math.cos(a) * 10), Math.round(cy + Math.sin(a) * 4))
        .setDepth(ry + (Math.sin(a) > 0 ? 0.2 : -0.2))
        .setScale(s > 0.3 ? 1 : 0.6)
        .setAlpha((0.5 + 0.5 * Math.max(0, s)) * riseE * blink);
    }

    // Specks of light drifting up the pillar.
    const k = this.motes.length;
    const high = 120 * show.beam * 0.7;
    for (let i = 0; i < k; i++) {
      const u = ((this.age / 1700 + i / k + this.seed) % 1 + 1) % 1;
      this.motes[i]
        .setPosition(Math.round(rx + Math.sin(u * 9 + i * 2) * 1.5), Math.round(ry - 2 - u * high))
        .setDepth(ry - 0.2)
        .setAlpha(Math.sin(u * Math.PI) * riseE * blink);
    }

    for (const r of this.rings) {
      r.t += dt;
      if (r.t < 0) continue;
      const e = Math.min(1, r.t / 620);
      const grow = 1 - Math.pow(1 - e, 2);
      r.img.setPosition(rx, ry).setScale(0.2 + grow * (show.star ? 2.1 : 1.3) * (show.spread ?? 1)).setAlpha(e >= 1 ? 0 : 0.9 * (1 - e));
    }

    if (this.trail) {
      // The star has struck: its tail snaps away and a flash of light fades.
      const f = Math.min(1, this.landT / 380);
      this.trail.setAlpha(0);
      this.flash!.setPosition(rx, cy).setDepth(ry + 0.3).setScale(1.8 + f * 3.2).setAlpha(0.95 * (1 - f));
    }

    if (this.light) {
      this.light.setPosition(rx, ry - 8);
      this.light.intensity = (1.2 + 0.35 * breathe) * riseE * blink;
    }

    if (this.arrow) this.point(rx, cy);
  }

  /** Off screen, an arrow at the screen's edge points the way to it. */
  private point(x: number, y: number): void {
    const arrow = this.arrow!;
    const view = this.scene.cameras.main.worldView;
    const m = 7;
    if (view.width <= 0 || (x > view.x && x < view.right && y > view.y && y < view.bottom)) {
      arrow.setVisible(false);
      return;
    }
    const ax = Phaser.Math.Clamp(x, view.x + m, view.right - m);
    const ay = Phaser.Math.Clamp(y, view.y + m, view.bottom - m);
    // Nudged back and forth towards the find.
    const a = Math.atan2(y - view.centerY, x - view.centerX);
    const nudge = Math.sin(this.age * 0.008) * 1.5;
    arrow
      .setVisible(true)
      .setPosition(Math.round(ax + Math.cos(a) * nudge), Math.round(ay + Math.sin(a) * nudge))
      .setRotation(a)
      .setAlpha(0.75 + 0.25 * Math.sin(this.age * 0.008));
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    const all = [this.sprite, this.glow, this.shadow, this.glint, this.beamOuter, this.beamInner, this.runes, this.arrow, this.trail, this.flash, ...this.rays, ...this.twinkles, ...this.motes, ...this.rings.map((r) => r.img)];
    for (const o of all) o?.destroy();
    if (this.light) {
      this.scene.lights?.removeLight(this.light);
      this.light = null;
    }
    lit.delete(this);
  }
}

/**
 * Picking up an epic or a legendary: the pillar flashes up around the hero
 * and a ring of its light goes out. Lives a moment, then cleans itself up.
 */
export class LootFlare implements Effect {
  dead = false;
  private age = 0;
  private beam: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private big: boolean;

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    /** The piece picked up; null for gems, which pass their size and colours instead. */
    def: GearDef | null,
    big = false,
    accentTint = 0xffffff,
    coreTint = 0xffffff,
  ) {
    this.big = def ? def.rarity === 'legendary' : big;
    const show = def ? SHOWS[def.rarity] : undefined;
    const accent = def ? (def.set ? GEAR_SETS[def.set].tint : show?.accent ?? RARITY[def.rarity].tint) : accentTint;
    const core = def ? (show?.core ?? 0xffffff) : coreTint;
    const add = (key: string, tint: number) => scene.add.image(x, y, key).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(0);
    this.beam = add('loot_beam', core).setOrigin(0.5, 1).setDepth(y + 0.5);
    this.ring = add('loot_ring', accent).setDepth(1.3);
    this.glow = add('glow', accent).setDepth(y + 0.4);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    const t = Math.min(1, this.age / 600);
    const fade = 1 - t;
    this.beam.setPosition(this.x, this.y + 1).setScale((this.big ? 2.2 : 1.6) * (1 - t * 0.7), (this.big ? 0.9 : 0.6) * (0.6 + t * 0.4)).setAlpha(0.85 * fade);
    this.ring.setPosition(this.x, this.y).setScale(0.3 + (1 - fade * fade) * (this.big ? 2 : 1.4)).setAlpha(0.9 * fade);
    this.glow.setPosition(this.x, this.y - 12).setScale((this.big ? 3 : 2) * (0.6 + t)).setAlpha(0.8 * fade);
    if (t >= 1) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.beam, this.ring, this.glow]) o.destroy();
  }
}

/**
 * The count over the hero as a shower of gems is gathered: "+1 GEM", then
 * "+2 GEMS", "+3 GEMS"... each gem kicking it up with a little hop, following
 * the hero, and rising away once no more come for a moment.
 */
export class GemTally implements Effect {
  dead = false;
  n = 0;
  private text: Phaser.GameObjects.BitmapText;
  private quiet = 0;
  private bump = 0;
  private fade = 0;

  constructor(
    scene: Phaser.Scene,
    private at: () => { x: number; y: number },
  ) {
    this.text = scene.add.bitmapText(0, 0, 'pixel', '').setLetterSpacing(-1).setOrigin(0.5, 1).setTint(0x9ff6ff).setDepth(10002);
  }

  /** Still gathering: new gems add to this count; once it has begun to fade, a new one starts. */
  get open(): boolean {
    return !this.dead && this.fade === 0;
  }

  add(n: number): void {
    this.n += n;
    this.quiet = 0;
    this.bump = 1;
    this.text.setText(`+${this.n} ${this.n === 1 ? 'GEM' : 'GEMS'}`);
    // A big haul goes from cyan to the hoard's rose.
    this.text.setTint(this.n >= 10 ? 0xffb0ec : this.n >= 5 ? 0xd8fbff : 0x9ff6ff);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.quiet += dt;
    this.bump = Math.max(0, this.bump - dt / 160);
    if (this.quiet > 900) this.fade += dt;
    const f = Math.min(1, this.fade / 500);
    if (f >= 1) {
      this.destroy();
      return;
    }
    const p = this.at();
    // Each gem kicks the count up a couple of pixels (whole pixels, so the letters stay crisp).
    this.text.setPosition(Math.round(p.x), Math.round(p.y - 40 - 10 * f - 3 * this.bump * this.bump)).setAlpha(1 - f);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.text.destroy();
  }
}
