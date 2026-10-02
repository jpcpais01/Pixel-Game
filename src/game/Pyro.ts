import Phaser from 'phaser';
import { PYRO_METEOR_H, PYRO_METEOR_HEAD } from '../art/effects';
import { snap } from './display';
import { sound } from '../audio';
import type { Hurtbox } from './combat';
import type { Effect } from './Slash';
import { onGround, Venom, type ToxStyle } from './Toxins';
import { HELL_STYLE, PYRO_STYLE, type SpellStyle } from './spells';
import type { WizardKit, WizardSkin } from './Wizard';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';

// The Pyromancer: the wizard's fire subtype. Fireballs fly slower and burst in
// a small blast that sets everything near on fire; the special gathers flame at
// the staff and calls a meteor down where it is aimed, scorching a wide circle.
// A little frailer and quicker on its feet than the arcane wizard.

export const PYRO_KIT: WizardKit = {
  maxHp: HERO_STATS['wizard.pyro'].hp,
  speed: HERO_STATS['wizard.pyro'].speed,
  castCooldown: 300,
  // Arms raised while the meteor is called down.
  fireTime: (p) => 380 + 180 * p,
};

export const PYRO_SKIN: WizardSkin = { key: 'wizard_pyro', style: PYRO_STYLE, kit: PYRO_KIT };
/** The Hellfire skin: the same pyromancer, burning with fel fire. */
export const HELL_SKIN: WizardSkin = { key: 'wizard_hell', style: HELL_STYLE, kit: PYRO_KIT };

/** The Pumpkin Witch's witchfire: candle-white through pumpkin orange, violet at its edges, ghost-green flecks. */
export const PUMPKIN_STYLE: SpellStyle = {
  core: 0xfff4d8,
  hot: 0xffc04a,
  mid: 0xff7a1a,
  deep: 0x7a2ad0,
  accent: 0x9affa0,
  sparks: [0xffc04a, 0xff7a1a, 0x7a2ad0, 0x9affa0],
  glow: 0xff7a24,
  light: 0xff9a40,
  flash: 0xffd890,
  unstable: 0x9a4aff,
  fizzle: 0x6a5a78,
  fizzleSparks: [0x6a5a78, 0xff7a1a, 0x7a2ad0],
  orb: { texture: 'orb_pumpkin_e', anim: 'orb_pumpkin_spin' },
  burst: { texture: 'burst_pumpkin_e', anim: 'burst_pumpkin_pop' },
};

/** The Pumpkin Witch skin (Hallow's Eve): the same pyromancer, casting jack-o'-lanterns. */
export const PUMPKIN_SKIN: WizardSkin = { key: 'wizard_pumpkin', style: PUMPKIN_STYLE, kit: PYRO_KIT };

/** The Firebird's flame: white-gold at the heart, burning down through gold to crimson, with rose flecks. */
export const FIREBIRD_STYLE: SpellStyle = {
  core: 0xfffdf0,
  hot: 0xffec90,
  mid: 0xffb83a,
  deep: 0xd8203e,
  accent: 0xff6a8a,
  sparks: [0xffec90, 0xffb83a, 0xd8203e, 0xfffdf0],
  glow: 0xffa030,
  light: 0xffb84a,
  flash: 0xffe8a0,
  unstable: 0xe0203a,
  fizzle: 0x8a5a50,
  fizzleSparks: [0x8a5a50, 0xffb83a, 0xd8203e],
  orb: { texture: 'orb_firebird_e', anim: 'orb_firebird_spin' },
  burst: { texture: 'burst_firebird_e', anim: 'burst_firebird_pop' },
};

/** The Firebird skin: the same pyromancer, hooded as the firebird. */
export const FIREBIRD_SKIN: WizardSkin = { key: 'wizard_firebird', style: FIREBIRD_STYLE, kit: PYRO_KIT };

/** Burning: stacks and ticks like poison, in fire colours. */
const BURN: ToxStyle = {
  core: 0xfff8e0,
  hot: 0xffd66b,
  mid: 0xff9a2e,
  deep: 0xd9432b,
  murk: 0x3a1410,
  tints: [0xfff0b0, 0xffb040, 0xff6a24],
  light: 0xff8a30,
  numbers: 0xffa040,
  suffix: '_pyro',
};

/** How a look's fire looks: its spells, its burning, its meteor and the marks it leaves. */
export interface PyroFire {
  spell: SpellStyle;
  burn: ToxStyle;
  /** The meteor's target ring and its fill. */
  mark: [number, number];
  /** Halo, light and landing flash of the meteor. */
  halo: number;
  light: number;
  flash: number;
  /** Rock chips and ash thrown up where it lands. */
  chips: number[];
  /** Texture keys: the falling meteor (frames m0..m2) and its scorch. */
  meteor: string;
  scorch: string;
}

export const EMBER_FIRE: PyroFire = {
  spell: PYRO_STYLE,
  burn: BURN,
  mark: [0xff8a2a, 0xffc060],
  halo: 0xff8a30,
  light: 0xff8a40,
  flash: 0xffb050,
  chips: [0xffd66b, 0xff6a24, 0x6a3a2a],
  meteor: 'pyro_meteor',
  scorch: 'scorch',
};

export const HELL_FIRE: PyroFire = {
  spell: HELL_STYLE,
  burn: {
    core: 0xf4ffe8,
    hot: 0xc8ff7a,
    mid: 0x5ee83a,
    deep: 0x1a8a3a,
    murk: 0x0e2a14,
    tints: [0xeaffb0, 0x8aff5a, 0x2ec83a],
    light: 0x6aff4a,
    numbers: 0x8aff5a,
    suffix: '_hell',
  },
  mark: [0x46d83a, 0xb8ff6a],
  halo: 0x46d83a,
  light: 0x6aff4a,
  flash: 0xb8ff7a,
  chips: [0xc8ff7a, 0x2ec83a, 0x26232c],
  meteor: 'pyro_meteor_hell',
  scorch: 'scorch_hell',
};

export const PUMPKIN_FIRE: PyroFire = {
  spell: PUMPKIN_STYLE,
  burn: {
    core: 0xfff4d8,
    hot: 0xffc04a,
    mid: 0xff7a1a,
    deep: 0x8a3ad8,
    murk: 0x220a2e,
    tints: [0xffe0a0, 0xff9a3a, 0xa86aff],
    light: 0xff8a30,
    numbers: 0xffa040,
    suffix: '_pumpkin',
  },
  mark: [0xff7a1a, 0xb87aff],
  halo: 0xff7a24,
  light: 0xff9a40,
  flash: 0xffd890,
  chips: [0xffa440, 0xe0661a, 0x7a2ad0],
  meteor: 'pyro_meteor_pumpkin',
  scorch: 'scorch_pumpkin',
};

export const FIREBIRD_FIRE: PyroFire = {
  spell: FIREBIRD_STYLE,
  burn: {
    core: 0xfffdf0,
    hot: 0xffec90,
    mid: 0xffb83a,
    deep: 0xd8203e,
    murk: 0x3a0812,
    tints: [0xfff4c0, 0xffc040, 0xe8304a],
    light: 0xffa840,
    numbers: 0xffc050,
    suffix: '_firebird',
  },
  mark: [0xffb030, 0xff5a6a],
  halo: 0xffa030,
  light: 0xffb84a,
  flash: 0xffe090,
  chips: [0xffec90, 0xff6a8a, 0xd8203e],
  meteor: 'pyro_meteor_firebird',
  scorch: 'scorch_firebird',
};

const BALL_SPEED = 140;
const BALL_LIFETIME = 1250;
/** The fireball's blast, on top of the ball's own hit. */
const BLAST_R = 13;
const BLAST_DAMAGE = 4;
const BLAST_BURN = 2500;

/** Meteor reach: to the mouse within these; on touch it lands further ahead the longer it charged. */
const MIN_RANGE = 24;
const MAX_RANGE = 130;
const touchRange = (level: number) => 44 + 66 * level;
const meteorRadius = (p: number) => 16 + 14 * p;
const FALL_TIME = 420;
/** How high above its spot the meteor appears, and how far to the left (it falls along a slant). */
const FALL_H = 180;
const SLANT = 0.25;

/** Where a meteor aimed from a hero at (hx, hy) lands. The mouse is aimed from the chest, so it is measured from there. */
function meteorSpot(hx: number, hy: number, dx: number, dy: number, level: number, dist?: number): { x: number; y: number } {
  if (dist === undefined) {
    const r = touchRange(level);
    return { x: hx + dx * r, y: hy + dy * r };
  }
  const r = Phaser.Math.Clamp(dist, MIN_RANGE, MAX_RANGE);
  return { x: hx + dx * r, y: hy - 14 + dy * r };
}

/**
 * Everything fire the pyromancer does in the world: the fireball's blast, the
 * burning it leaves, the meteor's mark while it charges and the meteor itself.
 * Lives in the world's effects so the burning keeps ticking.
 */
export class Pyromancy implements Effect {
  dead = false;
  private burn: Venom;
  private mark: Phaser.GameObjects.Image;
  private markFill: Phaser.GameObjects.Image;
  private t = 0;
  /** The pyromancer casting, for where the meteor is aimed from. */
  caster: { x: number; y: number } = { x: 0, y: 0 };

  constructor(
    private world: WorldScene,
    private fire: PyroFire = EMBER_FIRE,
  ) {
    this.burn = new Venom(world, fire.burn);
    this.mark = world.add.image(0, 0, 'danger_ring').setTint(fire.mark[0]).setDepth(2).setVisible(false);
    this.markFill = world.add.image(0, 0, 'danger_ring').setTint(fire.mark[1]).setBlendMode(Phaser.BlendModes.ADD).setDepth(2).setVisible(false);
  }

  /** Cast a fireball from the crystal. */
  fireball(x: number, y: number, dx: number, dy: number): void {
    this.world.castEnergyBall(x, y, dx, dy, this.fire.spell, { speed: BALL_SPEED, lifetime: BALL_LIFETIME, onBurst: (bx, by) => this.blast(bx, by) });
  }

  /** A fireball bursting: everything close takes a scorch and catches fire. The ball flies at chest height, so the ground is below it. */
  private blast(x: number, y: number): void {
    const gy = y + 10;
    for (const h of this.world.hurtboxesWhere((b) => b.alive && onGround(b, x, gy, BLAST_R))) {
      h.hurt({ damage: BLAST_DAMAGE, heavy: false, knock: 30, fromX: x, fromY: y });
      this.burn.dose(h, BLAST_BURN);
    }
    this.world.debris(this.fire.burn.tints, Math.round(x), Math.round(y), 8, y + 20, 'spores');
  }

  /** Show where the meteor will land while it charges. */
  target(dx: number, dy: number, level: number, dist?: number): void {
    const p = meteorSpot(this.caster.x, this.caster.y, dx, dy, level, dist);
    const r = meteorRadius(level);
    const pulse = 0.5 + Math.sin(this.t * 0.012) * 0.15;
    this.mark.setVisible(true).setPosition(snap(p.x), snap(p.y)).setScale(r / 22, (r * 0.58) / 12).setAlpha(0.7 + level * 0.3);
    this.markFill
      .setVisible(true)
      .setPosition(snap(p.x), snap(p.y))
      .setScale((r / 22) * level, ((r * 0.58) / 12) * level)
      .setAlpha(pulse);
  }

  untarget(): void {
    this.mark.setVisible(false);
    this.markFill.setVisible(false);
  }

  /** Call the meteor down at the spot aimed at. */
  meteor(dx: number, dy: number, power: number, dist?: number): void {
    const { x, y } = meteorSpot(this.caster.x, this.caster.y, dx, dy, power, dist);
    sound.starcall(this.world.pan(x));
    this.world.addEffect(new Meteor(this.world, x, y, power, this.fire, (inside) => this.strike(inside, x, y, power)));
  }

  private strike(inside: Hurtbox[], x: number, y: number, power: number): void {
    const damage = Math.round(8 + 16 * power);
    for (const h of inside) {
      h.hurt({ damage, heavy: true, knock: 90 + 60 * power, fromX: x, fromY: y - 4 });
      this.burn.dose(h, 3500, 2);
    }
  }

  update(dt: number): void {
    this.t += dt;
    this.burn.update(dt);
  }

  destroy(): void {
    this.dead = true;
    this.mark.destroy();
    this.markFill.destroy();
  }
}

/** The meteor: a mark that flares, the rock plunging along a slant, then the impact and a scorch that cools. */
class Meteor implements Effect {
  dead = false;
  private t = 0;
  private landed = false;
  private r: number;
  private rock: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private flash: Phaser.GameObjects.Image | null = null;
  private burst: Phaser.GameObjects.Sprite | null = null;
  private scorch: Phaser.GameObjects.Image | null = null;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private power: number,
    private fire: PyroFire,
    private onLand: (inside: Hurtbox[]) => void,
  ) {
    this.r = meteorRadius(power);
    const s = 0.8 + power * 0.45;
    this.rock = world.add
      .image(x, y - FALL_H, fire.meteor, 'm0')
      .setOrigin(0.5, (PYRO_METEOR_HEAD + 0.5) / PYRO_METEOR_H)
      .setAngle(-14)
      .setScale(s)
      .setDepth(9001);
    this.halo = world.add.image(x, y - FALL_H, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(fire.halo).setScale(1.2 * s).setDepth(9000);
    this.shadow = world.add.image(snap(x), snap(y), 'shadow_big').setDepth(1.5).setAlpha(0).setScale(0.3);
    this.light = world.lights.addLight(x, y - FALL_H, 90, fire.light, 1.5);
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    if (!this.landed) {
      const f = Math.min(1, t / FALL_TIME);
      const h = (1 - f * f) * FALL_H;
      const rx = snap(this.x - h * SLANT);
      const ry = snap(this.y - h);
      this.rock.setPosition(rx, ry).setFrame(`m${Math.floor(t / 70) % 3}`);
      this.halo.setPosition(rx, ry);
      this.light.setPosition(rx, ry);
      // The shadow darkens and grows as it nears the ground.
      this.shadow.setAlpha(f * 0.8).setScale(((0.4 + f * 0.9) * this.r) / 16, 0.4 + f * 0.9);
      if (Math.floor(t / 40) !== Math.floor((t - dt) / 40)) this.world.debris(this.fire.burn.tints, rx, ry, 2, ry + 200, 'trail');
      if (f >= 1) this.land();
      return;
    }
    const a = t - FALL_TIME;
    this.flash?.setAlpha(Math.max(0, 1 - a / 280)).setScale(((this.r / 16) * (1.2 + a / 200)));
    this.scorch?.setAlpha(Math.max(0, 0.9 * (1 - Math.max(0, a - 900) / 1600)));
    if (a > 2500) this.destroy();
  }

  private land(): void {
    this.landed = true;
    const { world, x, y, r } = this;
    this.rock.setVisible(false);
    this.halo.setVisible(false);
    this.shadow.setVisible(false);
    this.onLand(world.hurtboxesWhere((h) => h.alive && onGround(h, x, y, r)));

    const sx = snap(x);
    const sy = snap(y);
    this.scorch = world.add.image(sx, sy, this.fire.scorch).setDepth(1.6).setScale(r / 22, (r * 0.58) / 11);
    this.flash = world.add.image(sx, sy - 4, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(this.fire.flash).setDepth(y + 20);
    const burst = this.fire.spell.burst;
    this.burst = world.add.sprite(sx, sy - 3, burst.texture, 'b0').setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 21).setScale(0.9 + this.power * 0.8).play(burst.anim);
    this.burst.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.burst?.destroy();
      this.burst = null;
    });
    world.debris(this.fire.burn.tints, sx, sy - 3, 14 + Math.round(this.power * 12), y + 20, 'burst');
    world.debris(this.fire.chips, sx, sy - 2, 8, y + 20, 'spores');
    world.cameras.main.shake(120 + 80 * this.power, 0.0008 + 0.0008 * this.power);
    sound.starImpact(world.pan(x));
    const light = this.light;
    light.setPosition(x, y - 6);
    world.tweens.add({
      targets: light,
      intensity: 0,
      radius: 200,
      duration: 700,
      ease: 'Quad.easeOut',
      onStart: () => {
        light.intensity = 4;
      },
      onComplete: () => world.lights.removeLight(light),
    });
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.rock, this.halo, this.shadow, this.flash, this.burst, this.scorch]) o?.destroy();
    if (!this.landed) this.world.lights.removeLight(this.light);
  }
}
