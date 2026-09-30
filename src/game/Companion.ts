import Phaser from 'phaser';
import { PET_H, PET_OX, PET_OY, PET_W } from '../art/pets';
import { snap } from './display';
import { sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import type { Hit, Hurtbox } from './combat';
import type { PetDef, PetPower } from './pets';
import { sound } from '../audio';
import { Arc } from './Scientist';
import { strikeGround } from './ultimate/ink';
import { FrostNova, ICE, MEND, MendBloom, STORM, TalonRake, TentacleLash, WARD, WardBubble } from './petPowers';
import type { WorldScene } from '../scenes/WorldScene';

// The companion in the world: it trots, hops or flutters after the hero,
// keeping to one side a little behind, turning to face where it goes. It
// cheers when gems are picked up. The wyrmling spits crystal shards at foes
// that come near the hero; the phoenix chick burns up once a run to lift the
// hero back to their feet instead of letting them fall. The rest with a
// power (PetDef.power) use it on a timer of their own, and only when there is
// something to use it on: see usePower.

/** Where it likes to be: this far to the side of the hero, and a touch behind. */
const SIDE = 16;
const BEHIND = 6;
/** It moves faster the further it has fallen behind: this share of the gap each second, up to a top speed. */
const CATCH_UP = 4.5;
const TOP_SPEED = 260;
/** Left this far behind (the hero rose at the spawn, or stepped through a door), it pops over. */
const LOST = 260;
/** Flyers hover this high, bobbing; hoppers hop this high every this many px of ground. */
const HOVER = 14;
const HOP_H = 5;
const HOP_EVERY = 22;

/** The wyrmling's shards: how often, how far it looks for a foe, their speed and bite. */
const SPIT_EVERY = 1600;
const SPIT_RANGE = 120;
const SHARD_SPEED = 230;
const SHARD_LIFE = 900;
const SHARD_DAMAGE = 6;
const AMETHYST = [0xffffff, 0xe0c0ff, 0xc890ff, 0x8a50e8];

/** Snowpaw's frost: how often (only with a foe this near the hero), how far it spreads, the slow and its bite. */
const CHILL_EVERY = 5000;
const CHILL_NEAR = 90;
const CHILL_R = 64;
const CHILL_SLOW = 0.5;
const CHILL_MS = 1800;
const CHILL_DAMAGE = 3;
const FROST_TINT = 0xbfe8ff;
/** Nimbus's lightning: how often, how far from the hero it looks, its bite, and the leap to a second foe. */
const ZAP_EVERY = 2600;
const ZAP_RANGE = 110;
const ZAP_DAMAGE = 4;
const ZAP_LEAP = 55;
const ZAP_LEAP_DAMAGE = 3;
/** Mossback's ward grows back this long after it turns a blow. */
const WARD_EVERY = 14000;
/** Pixie mends this share of the hero's health, this often (while they are hurt). */
const MEND_EVERY = 8000;
const MEND_SHARE = 0.05;
/** The gryphon's swoop: how often, how far from the hero, how fast, its blow, and when it gives up the chase. */
const DIVE_EVERY = 3400;
const DIVE_RANGE = 130;
const DIVE_SPEED = 330;
const DIVE_DAMAGE = 12;
const DIVE_REACH = 14;
const DIVE_GIVE_UP = 900;
const FEATHERS = [0xffffff, 0xfff0b0, 0xf0c060, 0xc88a30];
/** The krakling's lash: how often, how far from the hero, how many foes at once, its bite, and the ink's slow. */
const LASH_EVERY = 2600;
const LASH_RANGE = 90;
const LASH_MAX = 3;
const LASH_DAMAGE = 4;
const LASH_SLOW = 0.75;
const LASH_MS = 1000;
const INK_TINT = 0xb890e0;
const INK_DROPS = [0xf0e0ff, 0xb890e0, 0x7a4ab0, 0x4a2a7a];
/** The mimic coughs up a gem of its own this often when gems are picked up. */
const HOARD_CHANCE = 0.25;
const COINS = [0xffffff, 0xfff6c0, 0xffd060, 0xd89a28];

/** How long each timed power waits after it is used. */
const EVERY: Record<Exclude<PetPower, 'ward' | 'hoard'>, number> = { chill: CHILL_EVERY, zap: ZAP_EVERY, mend: MEND_EVERY, dive: DIVE_EVERY, lash: LASH_EVERY };
/** A timed power with nothing to use it on looks again this soon. */
const RETRY = 250;

/** The gryphon on its way down to a foe. */
interface Swoop {
  foe: Hurtbox;
  tx: number;
  ty: number;
  t: number;
}

interface Shard {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export class Companion {
  x: number;
  y: number;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private light: Phaser.GameObjects.Light;
  /** Which side of the hero it keeps to: it swaps when the hero walks across it. */
  private side = 1;
  private facing = 1;
  /** Ground covered, for the hopping gait; and a cheer's leap, easing off. */
  private stride = 0;
  private leap = 0;
  private spitT = SPIT_EVERY;
  private recoil = 0;
  private shards: Shard[] = [];
  /** The phoenix's rekindling, used up for this run. */
  private spent = false;
  private t = Math.random() * 1000;
  /** Counts down to the power's next use (for the turtle, to its ward growing back). */
  private powerT = 1500;
  private heroX: number;
  private heroY: number;
  private swoop: Swoop | null = null;
  /** How far down a swoop has brought it: 1 at its usual height, 0 on the foe. */
  private low = 1;
  private bubble: WardBubble | null = null;
  private gone = false;

  constructor(
    private world: WorldScene,
    readonly def: PetDef,
    x: number,
    y: number,
  ) {
    this.x = x + SIDE;
    this.y = y + BEHIND;
    this.heroX = x;
    this.heroY = y;
    // The turtle's ward is up from the start.
    if (def.power === 'ward') this.powerT = 0;
    const add = world.add;
    const ox = PET_OX / PET_W;
    const oy = PET_OY / PET_H;
    this.shadow = add.image(x, y, 'shadow').setDepth(1).setScale(0.8, 0.8);
    this.castShadow = sunShadow(add.sprite(x, y, 'pets_s', `${def.id}_0`).setOrigin(ox, oy));
    this.body = add.sprite(x, y, 'pets', `${def.id}_0`).setOrigin(ox, oy).setPipeline('Lit').play(`pet_${def.id}`);
    this.glowLayer = add.sprite(x, y, 'pets_e', `${def.id}_0`).setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.light = world.lights.addLight(x, y - 10, 46, def.tint, 0.45);
  }

  /** Each frame, with where the hero stands and whether they're down (it waits by them). */
  update(dt: number, heroX: number, heroY: number, heroDown: boolean, daylight: number): void {
    this.t += dt;
    this.heroX = heroX;
    this.heroY = heroY;
    if (heroDown) this.swoop = null;
    const swoop = this.swoop;
    let gx: number;
    let gy: number;
    if (swoop) {
      // Swooping: it makes for the foe, following it as it moves.
      swoop.t += dt;
      if (swoop.foe.alive) {
        swoop.tx = swoop.foe.x;
        swoop.ty = swoop.foe.y;
      }
      gx = swoop.tx;
      gy = swoop.ty;
    } else {
      // Keep to the side of the hero the companion is already on, unless the hero crosses over.
      const dxh = this.x - heroX;
      if (Math.abs(dxh) > SIDE * 0.5) this.side = Math.sign(dxh);
      gx = heroX + this.side * SIDE;
      gy = heroY + BEHIND;
    }
    const dx = gx - this.x;
    const dy = gy - this.y;
    const d = Math.hypot(dx, dy);
    if (swoop) {
      const step = Math.min(d, DIVE_SPEED * (dt / 1000));
      if (d > 0.5) {
        this.x += (dx / d) * step;
        this.y += (dy / d) * step;
        this.stride += step;
      }
      if (Math.abs(dx) > 1) this.facing = Math.sign(dx);
      this.low = Math.min(1, Math.max(0, (d - 4) / 50));
      if (d < 5 || swoop.t > DIVE_GIVE_UP) this.strike(swoop, d < 8);
    } else if (d > LOST) {
      this.x = gx;
      this.y = gy;
      this.world.debris([0xffffff, this.def.tint], snap(gx), snap(gy) - 8, 10, gy + 10, 'spores');
    } else if (d > 2) {
      const step = Math.min(d, Math.min(TOP_SPEED, d * CATCH_UP) * (dt / 1000));
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      this.stride += step;
      if (Math.abs(dx) > 3) this.facing = Math.sign(dx);
    } else if (!heroDown) {
      // Idle beside the hero: look the way the hero is from here.
      this.facing = this.side > 0 ? -1 : 1;
    }
    if (!this.swoop) this.low = Math.min(1, this.low + dt / 400);
    this.leap = Math.max(0, this.leap - dt / 500);
    this.recoil = Math.max(0, this.recoil - dt / 200);

    if (this.def.fights && !heroDown) this.fight(dt, heroX, heroY);
    if (!heroDown) this.usePower(dt, heroX, heroY);
    this.updateShards(dt);
    this.sync(daylight, d);
  }

  /** How high off the ground it is now, by its gait. */
  private height(moving: boolean): number {
    const cheer = Math.sin(this.leap * Math.PI) * 8;
    switch (this.def.gait) {
      case 'fly':
        return (HOVER + Math.sin(this.t * 0.004) * 2) * this.low + cheer;
      case 'hop':
        return (moving ? Math.abs(Math.sin((this.stride / HOP_EVERY) * Math.PI)) * HOP_H : 0) + cheer;
      default:
        return (moving ? Math.abs(Math.sin((this.stride / 10) * Math.PI)) : 0) + cheer;
    }
  }

  private sync(daylight: number, gap: number): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const up = this.height(gap > 4);
    const hy = snap(ry - up);
    const flip = this.facing < 0;
    // A hopper squashes as it lands and stretches in the air.
    const squash = this.def.gait === 'hop' && gap > 4 ? 1 + (up / HOP_H - 0.5) * 0.12 : 1;
    const back = this.recoil * -this.facing * 2;
    // Swooping, it pitches nose-down toward the foe.
    const tilt = this.swoop ? this.facing * 0.45 * (1 - this.low) : 0;
    this.body.setPosition(rx + back, hy).setDepth(ry).setFlipX(flip).setScale(1 / squash, squash).setRotation(tilt);
    this.glowLayer.setPosition(rx + back, hy).setDepth(ry + 0.1).setFrame(this.body.frame.name).setFlipX(flip).setScale(1 / squash, squash).setRotation(tilt);
    const lift = Math.min(1, up / 16);
    this.shadow.setPosition(rx, ry - 1).setAlpha(0.7 - lift * 0.35).setScale(0.8 - lift * 0.25, 0.8 - lift * 0.25);
    this.castShadow.setPosition(rx, ry - 1).setFrame(this.body.frame.name).setFlipX(flip).setAlpha(SUN_SHADOW_ALPHA * daylight * (1 - lift * 0.6));
    this.light.setPosition(rx, hy - 8);
    this.light.intensity = 0.45 + 0.1 * Math.sin(this.t * 0.005) + this.leap * 0.6;
  }

  /** Gems were picked up: it leaps for joy in a puff of its colour. */
  cheer(): void {
    this.leap = 1;
    this.world.debris([0xffffff, this.def.tint], snap(this.x), snap(this.y) - 10, 8, this.y + 10, 'spores');
    // The mimic, now and then, snaps its lid and coughs up a gem of its own.
    if (this.def.power === 'hoard' && Math.random() < HOARD_CHANCE) {
      this.world.time.delayedCall(420, () => {
        if (this.gone) return;
        this.leap = 1;
        const mx = this.x + this.facing * 6;
        this.world.debris(COINS, snap(mx), snap(this.y) - 8, 12, this.y + 10, 'burst');
        this.world.dropGems(1, mx, this.y - 6);
        sound.spit(this.world.pan(this.x));
      });
    }
  }

  /**
   * The turtle's ward: a blow is about to land on the hero. If the ward is
   * up, it bursts instead and the blow does nothing. Returns whether it did.
   */
  ward(): boolean {
    if (!this.bubble) return false;
    this.bubble.pop();
    this.bubble = null;
    this.powerT = WARD_EVERY;
    this.leap = 1;
    this.world.popNumber(snap(this.heroX), snap(this.heroY) - 42, 'WARDED', WARD.hot);
    sound.clack(this.world.pan(this.heroX), true);
    return true;
  }

  /** The power's clock: ready, and something to use it on, it acts; with nothing, it looks again soon. */
  private usePower(dt: number, heroX: number, heroY: number): void {
    const power = this.def.power;
    if (!power || power === 'hoard' || this.swoop) return;
    this.powerT -= dt;
    if (this.powerT > 0) return;
    if (power === 'ward') {
      if (!this.bubble) this.raiseWard();
      return;
    }
    const used =
      power === 'chill' ? this.chill(heroX, heroY) : power === 'zap' ? this.zap(heroX, heroY) : power === 'mend' ? this.mend() : power === 'dive' ? this.dive(heroX, heroY) : this.lash(heroX, heroY);
    this.powerT = used ? EVERY[power] : RETRY;
  }

  /** Every live foe within `r` of (x, y), nearest first. */
  private foesNear(x: number, y: number, r: number, test: (h: Hurtbox) => boolean = () => true): Hurtbox[] {
    return this.world
      .hurtboxesWhere((h) => h.alive && Math.hypot(h.x - x, h.y - y) < r && test(h))
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  }

  private hit(damage: number, knock: number, fromX: number, fromY: number): Hit {
    return { damage, heavy: false, knock, fromX, fromY, companion: true };
  }

  /** Snowpaw stamps: frost races out round it, slowing and nipping every foe it reaches. */
  private chill(heroX: number, heroY: number): boolean {
    if (!this.foesNear(heroX, heroY, CHILL_NEAR).length) return false;
    const x = this.x;
    const y = this.y;
    this.leap = 1;
    this.world.addEffect(new FrostNova(this.world, x, y, CHILL_R));
    for (const h of strikeGround(this.world, x, y, CHILL_R, { damage: CHILL_DAMAGE, knock: 30, companion: true })) {
      h.slow?.(CHILL_SLOW, CHILL_MS, FROST_TINT);
      this.world.debris(ICE.tints, snap(h.x), snap(h.y) - h.bodyY, 5, h.y + 10, 'burst');
    }
    this.world.debris(ICE.tints, snap(x), snap(y) - 4, 16, y + 10, 'spores');
    sound.stasis(this.world.pan(x));
    return true;
  }

  /** Nimbus crackles: a bolt from the cloud to the nearest foe, leaping on to one more beside it. */
  private zap(heroX: number, heroY: number): boolean {
    const foe = this.foesNear(heroX, heroY, ZAP_RANGE)[0];
    if (!foe) return false;
    const from = { x: this.x + this.facing * 2, y: this.y - HOVER - 6 };
    const pts = [from, { x: foe.x, y: foe.y - foe.bodyY }];
    foe.hurt(this.hit(ZAP_DAMAGE, 20, from.x, from.y));
    const next = this.foesNear(foe.x, foe.y, ZAP_LEAP, (h) => h !== foe)[0];
    if (next) {
      pts.push({ x: next.x, y: next.y - next.bodyY });
      next.hurt(this.hit(ZAP_LEAP_DAMAGE, 20, foe.x, foe.y));
    }
    for (const p of pts.slice(1)) this.world.debris(STORM.tints, snap(p.x), snap(p.y), 5, p.y + 20, 'burst');
    this.world.addEffect(new Arc(this.world, pts, STORM, Math.max(foe.y, this.y) + 20, true, 220));
    this.recoil = 1;
    sound.tesla(this.world.pan(foe.x), !!next);
    return true;
  }

  /** Mossback's ward rises round the hero again. */
  private raiseWard(): void {
    this.bubble = new WardBubble(this.world, () => ({ x: this.heroX, y: this.heroY }));
    this.world.addEffect(this.bubble);
    this.leap = 0.6;
    sound.hallow();
  }

  /** Pixie waves her wand: the hero, if hurt, is mended by a share of their health. */
  private mend(): boolean {
    const got = this.world.mendHero(MEND_SHARE);
    if (got <= 0) return false;
    this.leap = 1;
    this.world.addEffect(new MendBloom(this.world, () => ({ x: this.heroX, y: this.heroY })));
    this.world.debris(MEND.tints, snap(this.x), snap(this.y) - HOVER - 8, 8, this.y + 10, 'spores');
    this.world.popNumber(snap(this.heroX), snap(this.heroY) - 38, `+${got}`, MEND.mid);
    sound.heal(this.world.pan(this.heroX));
    return true;
  }

  /** The gryphon picks a foe near the hero and dives on it. */
  private dive(heroX: number, heroY: number): boolean {
    const foe = this.foesNear(heroX, heroY, DIVE_RANGE, (h) => !h.airborne)[0];
    if (!foe) return false;
    this.swoop = { foe, tx: foe.x, ty: foe.y, t: 0 };
    sound.windDash(this.world.pan(this.x));
    return true;
  }

  /** The swoop ends: on the foe, its talons rake everything there; either way it climbs back to the hero. */
  private strike(swoop: Swoop, landed: boolean): void {
    this.swoop = null;
    this.powerT = DIVE_EVERY;
    if (!landed) return;
    const { tx, ty } = swoop;
    const struck = strikeGround(this.world, tx, ty, DIVE_REACH, { damage: DIVE_DAMAGE, heavy: true, knock: 150, fromX: tx - this.facing * 10, fromY: ty, companion: true });
    const bodyY = struck[0]?.bodyY ?? 8;
    this.world.addEffect(new TalonRake(this.world, tx, ty - bodyY, this.facing));
    this.world.debris(FEATHERS, snap(tx), snap(ty) - bodyY, 14, ty + 20, 'burst');
    this.world.debris(FEATHERS, snap(tx), snap(ty) - 4, 6, ty + 20, 'spores');
    this.recoil = 1;
    this.leap = 0.5;
    sound.katanaHit(this.world.pan(tx), struck.length > 0);
  }

  /** The krakling lashes out: a tentacle to each of the foes nearest it, inking them slow. */
  private lash(heroX: number, heroY: number): boolean {
    const foes = this.foesNear(heroX, heroY, LASH_RANGE).sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y)).slice(0, LASH_MAX);
    if (!foes.length) return false;
    const ox = this.x + this.facing * 2;
    const oy = this.y - HOVER - 4;
    foes.forEach((foe, i) => {
      const bend = (i % 2 ? 1 : -1) * (foe.x >= ox ? 1 : -1);
      this.world.addEffect(
        new TentacleLash(this.world, ox, oy, foe, bend, i * 70, () => {
          if (!foe.alive) return;
          foe.hurt(this.hit(LASH_DAMAGE, 40, ox, oy));
          foe.slow?.(LASH_SLOW, LASH_MS, INK_TINT);
          this.world.debris(INK_DROPS, snap(foe.x), snap(foe.y) - foe.bodyY, 6, foe.y + 20, 'burst');
        }),
      );
    });
    this.facing = foes[0].x >= this.x ? 1 : -1;
    this.leap = 0.4;
    sound.splash(this.world.pan(this.x));
    return true;
  }

  /**
   * The phoenix chick's gift: the hero is about to fall. Once a run, it
   * bursts into flame and lifts them back up instead. Returns whether it did.
   */
  rekindle(heroX: number, heroY: number): boolean {
    if (!this.def.rebirth || this.spent) return false;
    this.spent = true;
    const fire = [0xffffff, 0xfff0a8, 0xffb850, 0xff6a2a];
    this.world.debris(fire, snap(heroX), snap(heroY) - 12, 40, heroY + 20, 'burst');
    this.world.debris(fire, snap(heroX), snap(heroY) - 8, 24, heroY + 20, 'spores');
    this.world.debris(fire, snap(this.x), snap(this.y) - 14, 16, this.y + 10, 'burst');
    this.world.popNumber(snap(heroX), snap(heroY) - 46, 'REKINDLED!', 0xffc860);
    this.leap = 1;
    // Spent, it burns low for the rest of the run: a dimmer, smaller glow.
    this.world.tweens.add({ targets: this.glowLayer, alpha: 0.45, duration: 1200, delay: 400 });
    sound.revive();
    return true;
  }

  /** The wyrmling: every so often, a shard of amethyst at a foe near the hero. */
  private fight(dt: number, heroX: number, heroY: number): void {
    this.spitT -= dt;
    if (this.spitT > 0) return;
    const mx = this.x;
    const my = this.y - HOVER - 6;
    const foe = this.world.firstHurtbox((h) => Math.hypot(h.x - heroX, h.y - heroY) < SPIT_RANGE && !h.airborne);
    if (!foe) {
      // Nothing in reach: look again soon.
      this.spitT = 200;
      return;
    }
    this.spitT = SPIT_EVERY;
    const tx = foe.x;
    const ty = foe.y - foe.bodyY;
    const l = Math.hypot(tx - mx, ty - my) || 1;
    this.facing = tx >= mx ? 1 : -1;
    this.recoil = 1;
    const img = this.world.add.image(mx, my, 'spark').setBlendMode(Phaser.BlendModes.ADD).setTint(0xd8b0ff).setScale(1.4);
    this.shards.push({ img, x: mx, y: my, vx: ((tx - mx) / l) * SHARD_SPEED, vy: ((ty - my) / l) * SHARD_SPEED, life: SHARD_LIFE });
    this.world.debris(AMETHYST, snap(mx + this.facing * 5), snap(my), 5, this.y + 10, 'burst');
    sound.cast();
  }

  private updateShards(dt: number): void {
    for (const s of this.shards) {
      s.life -= dt;
      s.x += (s.vx * dt) / 1000;
      s.y += (s.vy * dt) / 1000;
      s.img.setPosition(snap(s.x), snap(s.y)).setDepth(s.y + 20).setRotation(Math.atan2(s.vy, s.vx));
      if (Math.random() < 0.5) this.world.debris(AMETHYST, snap(s.x), snap(s.y), 1, s.y + 20, 'trail');
      if (this.world.strikeAt(s.x, s.y, { damage: SHARD_DAMAGE, companion: true, knock: 40, fromX: s.x - s.vx * 0.05, fromY: s.y - s.vy * 0.05 })) {
        this.world.debris(AMETHYST, snap(s.x), snap(s.y), 8, s.y + 20, 'burst');
        s.life = 0;
      }
      if (s.life <= 0) s.img.destroy();
    }
    this.shards = this.shards.filter((s) => s.life > 0);
  }

  destroy(): void {
    this.gone = true;
    this.bubble?.destroy();
    this.bubble = null;
    for (const s of this.shards) s.img.destroy();
    this.shards = [];
    for (const o of [this.body, this.glowLayer, this.shadow, this.castShadow]) o.destroy();
    this.world.lights.removeLight(this.light);
  }
}
