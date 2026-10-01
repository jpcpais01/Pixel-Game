import Phaser from 'phaser';
import { BEAK_TINTS, IMP_TINTS, MITE_TINTS, SPRITE_TINTS, WEAVER_TINTS, WEB_TINTS, FW_WEB_W } from '../../art/frostWeak';
import { SNOW_TINTS, T_AURORA, T_VIOLET } from '../../art/frostKit';
import { snap } from '../display';
import { sound } from '../../audio';
import type { Hit } from '../combat';
import type { Effect } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';
import { clearRun } from './Deep';
import { Lob } from './Elementals';
import { CHILL_LIGHT, FrostPatch, IceShard, dangerMark, frostLane, iceBurst, layLane, snowball } from './frostFx';
import { Monster, type Target } from './Monster';
import { mobHit, mobHp } from '../tiers';

// The Aurora Colosseum's weak creatures: they come in numbers, so each has
// one clear trick with a clear tell. The snowmite curls up and rolls down a
// lane, then sits dazed; the rimesprite keeps away and fans out ice darts;
// the icebeak belly-slides across the ice and has to get up again; the
// rimeweaver spits webs that chill the floor and bites when crowded; the
// flurrykin burrows through the snow, pops up and lobs snowballs. Their
// pictures are in art/frostWeak.ts.

/** Blows land this much harder on a creature caught helpless (dazed, flat on its belly). */
const HELPLESS_DAMAGE = 1.4;

/** Unit vector from (x, y) toward the target, or (fx, 0) when it stands right on top. */
function toward(x: number, y: number, t: Target, fx: number): [number, number] {
  const dx = t.x - x;
  const dy = t.y - y;
  const l = Math.hypot(dx, dy);
  return l < 0.5 ? [fx, 0] : [dx / l, dy / l];
}

// ---------------------------------------------------------------- Snowmite

const MITE_REACH = 112;
/** Curled up while its lane shows, ms; it stops turning to follow at the last 30%. */
const MITE_CURL = 640;
const MITE_ROLL_MIN = 56;
const MITE_ROLL_MAX = 132;
/** It starts its roll slow and gathers speed, px/s and px/s². */
const MITE_ROLL_V0 = 70;
const MITE_ROLL_V1 = 240;
const MITE_ROLL_ACCEL = 560;
const MITE_DIZZY = 1150;
const MITE_COOLDOWN = 1500;

/**
 * A round little snow-beetle with ice crystals on its back. It scuttles in,
 * curls into a spiked ball while a lane shows its path, then rolls along it
 * gathering speed; at the end it sits dazed, stars round its head, and blows
 * land harder.
 */
export class Snowmite extends Monster {
  private ux = 1;
  private uy = 0;
  private len = 0;
  private run = 0;
  private v = 0;
  private struck = false;
  private trail = 0;
  private lane: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'snowmite', hp: mobHp('snowmite'), radius: 6, bodyY: 7, speed: 46, sight: 130, leash: 260, mass: 0.8, barY: 21, debris: MITE_TINTS });
    this.cooldown = 600 + Math.random() * 600;
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  hurt(hit: Hit): void {
    super.hurt(this.state === 'recover' ? { ...hit, damage: hit.damage * HELPLESS_DAMAGE } : hit);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.cooldown === 0 && dist < MITE_REACH) {
      this.aim(target);
      this.enter('windup', MITE_CURL);
      this.play('windup', true);
      this.lane = frostLane(this.world, this.x, this.y - 1, 0.9);
      sound.chitter(this.world.pan(this.x));
      return;
    }
    // A swarm fans out: each comes in on its own slant.
    const [ux, uy] = toward(this.x, this.y, target, 1);
    const tilt = ((Math.abs(this.slot) % 3) - 1) * 0.35;
    this.move(dt, ux - uy * tilt, uy + ux * tilt, this.stats.speed);
    this.face(target.x - this.x);
  }

  private aim(target: Target): void {
    [this.ux, this.uy] = toward(this.x, this.y, target, this.facing === 'r' ? 1 : -1);
    const want = Phaser.Math.Clamp(Math.hypot(target.x - this.x, target.y - this.y) + 40, MITE_ROLL_MIN, MITE_ROLL_MAX);
    this.len = Math.max(16, clearRun(this.world, this.x, this.y, this.ux, this.uy, want));
    this.face(this.ux);
  }

  protected act(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (target && this.timer > MITE_CURL * 0.3) this.aim(target);
      const p = 1 - this.timer / MITE_CURL;
      if (this.lane) layLane(this.lane, this.x, this.y - 1, this.ux, this.uy, this.len, 0.9, 0.15 + p * 0.45 + Math.sin(w.time.now * 0.03) * 0.06);
      if (this.timer <= 0) {
        this.run = 0;
        this.v = MITE_ROLL_V0;
        this.struck = false;
        this.enter('attack', 4000);
        this.play('roll', true);
        sound.frost('crunch', w.pan(this.x));
      }
      return;
    }
    if (this.state === 'attack') {
      this.v = Math.min(MITE_ROLL_V1, this.v + (MITE_ROLL_ACCEL * dt) / 1000);
      const step = (this.v * dt) / 1000;
      this.x += this.ux * step;
      this.y += this.uy * step;
      this.run += step;
      this.lane?.setAlpha(Math.max(0, 0.5 * (1 - this.run / this.len)));
      this.trail -= dt;
      if (this.trail <= 0) {
        this.trail = 45;
        w.debris(SNOW_TINTS, snap(this.x - this.ux * 5), snap(this.y) - 1, 1, this.y, 'trail');
      }
      if (!this.struck) {
        this.struck = w.hurtHeroAt(this.x, this.y - 6, this.radius + 3, { damage: mobHit('snowmite'), fromX: this.x - this.ux * 10, fromY: this.y - this.uy * 10, knock: 110 + this.v * 0.4 });
        if (this.struck) w.cameras.main.shake(70, 0.002);
      }
      const blocked = !w.walkable(this.x + this.ux * 6, this.y + this.uy * 6);
      if (this.run >= this.len || blocked || this.timer <= 0) this.crash(blocked);
      return;
    }
    // Dazed: it sits seeing stars (the anim plays itself), then shakes it off.
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** The roll ends in a spray of snow (a thump against a wall), and stars. */
  private crash(hard: boolean): void {
    const w = this.world;
    this.removeLane();
    iceBurst(w, this.x + this.ux * 5, this.y - 4, hard ? 10 : 6);
    sound.thud(w.pan(this.x), hard);
    if (hard) w.cameras.main.shake(60, 0.0015);
    this.enter('recover', MITE_DIZZY);
    this.play('dizzy', true);
    this.cooldown = MITE_COOLDOWN + Math.random() * 800;
  }

  private removeLane(): void {
    this.lane?.destroy();
    this.lane = null;
  }

  protected staggers(): boolean {
    return this.state !== 'attack';
  }

  protected onInterrupted(): void {
    this.removeLane();
  }
}

// ---------------------------------------------------------------- Rimesprite

/** It flies this high, bobbing. */
const SPRITE_HOVER = 10;
/** The distance it likes to keep from the hero. */
const SPRITE_NEAR = 64;
const SPRITE_FAR = 108;
const SPRITE_CAST = 640;
const SPRITE_FAN = 0.3;
const SPRITE_SHARD_V = 140;
const SPRITE_SHARD_RANGE = 180;
const SPRITE_DART_V = 150;
const SPRITE_DART = 260;
/** Height of the hero's body and its own hands above the floor, where the darts fly. */
const SPRITE_AIM_Y = 11;

/**
 * A flitting frost pixie with wings of clear ice. It keeps its distance,
 * circling, darting aside now and then; it cups a mote of light in its hands
 * while three faint lines show where its darts will fly, then fans out three
 * ice darts (the middle one chills).
 */
export class Rimesprite extends Monster {
  private phase = Math.random() * 1000;
  private spin = Math.random() < 0.5 ? 1 : -1;
  private dartT = 0;
  private dartCd = 900 + Math.random() * 900;
  private dux = 0;
  private duy = 0;
  private aimA = 0;
  private lanes: Phaser.GameObjects.Image[] = [];
  private halo: Phaser.GameObjects.Image;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'rimesprite', hp: mobHp('rimesprite'), radius: 5, bodyY: 14, speed: 58, sight: 150, leash: 280, mass: 0.6, barY: 30, debris: SPRITE_TINTS });
    this.hover = SPRITE_HOVER;
    this.cooldown = 900 + Math.random() * 700;
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(T_AURORA).setAlpha(0);
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    this.hover = SPRITE_HOVER + Math.sin(this.phase * 0.005) * 1.5;
    super.update(dt, target, daylight);
    if (this.dead) return;
    const casting = this.state === 'windup' ? 1 - this.timer / SPRITE_CAST : 0;
    const fade = this.state === 'dying' ? 0 : this.state === 'spawn' ? 1 - this.timer / 700 : 1;
    this.halo
      .setPosition(snap(this.x), snap(this.y - this.hover - 12))
      .setDepth(this.y + 0.3)
      .setScale(0.3 + casting * 0.2)
      .setAlpha((0.13 + casting * 0.25) * fade);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    const w = this.world;
    if (this.cooldown === 0 && dist < SPRITE_FAR + 24 && this.dartT <= 0) {
      this.enter('windup', SPRITE_CAST);
      this.play('windup', true);
      this.face(target.x - this.x);
      for (let i = 0; i < 3; i++) this.lanes.push(frostLane(w, this.x, this.y, 0.22, T_AURORA));
      sound.cast(w.pan(this.x));
      return;
    }
    const [ux, uy] = toward(this.x, this.y, target, 1);
    // A quick dart aside, now and then, so it's hard to pin down.
    this.dartCd -= dt;
    if (this.dartT <= 0 && this.dartCd <= 0) {
      if (Math.random() < 0.35) this.spin = -this.spin;
      this.dartT = SPRITE_DART;
      this.dartCd = 1300 + Math.random() * 1100;
      this.dux = -uy * this.spin;
      this.duy = ux * this.spin;
      sound.wings(w.pan(this.x), 2, true);
    }
    if (this.dartT > 0) {
      this.dartT -= dt;
      this.x += (this.dux * SPRITE_DART_V * dt) / 1000;
      this.y += (this.duy * SPRITE_DART_V * dt) / 1000;
      this.play('dart');
      if (Math.random() < dt / 40) w.debris(SPRITE_TINTS, this.x, this.y - this.hover - 10, 1, this.y + 0.2, 'trail');
    } else {
      // Keep its distance: back off when crowded, close in when far, circle between.
      const radial = dist < SPRITE_NEAR ? -1 : dist > SPRITE_FAR ? 1 : 0;
      const mx = ux * radial - uy * this.spin * 0.75;
      const my = uy * radial + ux * this.spin * 0.75;
      const l = Math.hypot(mx, my) || 1;
      this.move(dt, mx / l, my / l, this.stats.speed * (radial < 0 ? 1.2 : 1));
    }
    this.face(target.x - this.x);
  }

  protected act(_dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      const sx = this.x + (this.facing === 'r' ? 6 : -6);
      const sy = this.y - SPRITE_AIM_Y;
      // It follows the hero with its aim until the last moment.
      if (target && this.timer > SPRITE_CAST * 0.2) {
        this.face(target.x - this.x);
        this.aimA = Math.atan2(target.y - SPRITE_AIM_Y - sy, target.x - sx);
      }
      const p = 1 - this.timer / SPRITE_CAST;
      this.lanes.forEach((lane, i) => {
        const a = this.aimA + (i - 1) * SPRITE_FAN;
        layLane(lane, sx, sy, Math.cos(a), Math.sin(a), 30 + p * 60, 0.22, 0.1 + p * 0.35);
      });
      if (Math.random() < 0.15) w.debris(SPRITE_TINTS, sx, this.y - this.hover - 11, 1, this.y + 0.3, 'gather');
      if (this.timer <= 0) {
        this.removeLanes();
        for (let i = 0; i < 3; i++) {
          const a = this.aimA + (i - 1) * SPRITE_FAN;
          w.addEffect(new IceShard(w, sx, sy, Math.cos(a), Math.sin(a), { damage: mobHit('rimesprite', 0.6), speed: SPRITE_SHARD_V, range: SPRITE_SHARD_RANGE, size: 0.8, tint: T_AURORA, knock: 70, chill: i === 1 ? CHILL_LIGHT : undefined }));
        }
        sound.frost('chime', w.pan(this.x));
        this.pose('throw');
        this.enter('attack', 280);
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) {
        this.enter('recover', 380);
        this.play('idle', true);
      }
      return;
    }
    if (this.timer <= 0) {
      this.cooldown = 1700 + Math.random() * 900;
      // Off it flits straight after a cast.
      this.dartCd = 0;
      this.enter('chase', 0);
    }
  }

  private removeLanes(): void {
    for (const l of this.lanes) l.destroy();
    this.lanes.length = 0;
  }

  protected onInterrupted(): void {
    this.removeLanes();
    this.dartT = 0;
  }

  destroy(): void {
    if (this.dead) return;
    super.destroy();
    this.halo.destroy();
  }
}

// ---------------------------------------------------------------- Icebeak

const BEAK_REACH = 125;
/** Crouched, flippers back, squawking, while its lane shows, ms. */
const BEAK_CROUCH = 720;
const BEAK_SLIDE_MIN = 72;
const BEAK_SLIDE_MAX = 160;
const BEAK_SLIDE_V = 215;
/** It coasts to a stop over its last stretch of slide, px. */
const BEAK_COAST = 34;
/** Flat on its belly, then up again (its getup anim runs this long). */
const BEAK_GETUP = 1000;
const BEAK_COOLDOWN = 1700;

/**
 * A stout frost penguin. It waddles in, crouches with a squawk while a lane
 * shows its path, then throws itself on its belly and toboggans along the
 * lane, skittling the hero; it slides on past and lies there a moment
 * (blows land harder) before it scrambles up.
 */
export class Icebeak extends Monster {
  private ux = 1;
  private uy = 0;
  private len = 0;
  private run = 0;
  private struck = false;
  private trail = 0;
  private lane: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'icebeak', hp: mobHp('icebeak'), radius: 6, bodyY: 9, speed: 34, sight: 130, leash: 260, mass: 1.1, barY: 27, debris: BEAK_TINTS });
    this.cooldown = 800 + Math.random() * 700;
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  hurt(hit: Hit): void {
    super.hurt(this.state === 'recover' && this.timer > BEAK_GETUP * 0.3 ? { ...hit, damage: hit.damage * HELPLESS_DAMAGE } : hit);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.cooldown === 0 && dist < BEAK_REACH) {
      this.aim(target);
      this.enter('windup', BEAK_CROUCH);
      this.play('windup', true);
      this.lane = frostLane(this.world, this.x, this.y - 1, 1.3);
      sound.chitter(this.world.pan(this.x));
      return;
    }
    const [ux, uy] = toward(this.x, this.y, target, 1);
    this.move(dt, ux, uy, this.stats.speed);
  }

  private aim(target: Target): void {
    [this.ux, this.uy] = toward(this.x, this.y, target, this.facing === 'r' ? 1 : -1);
    const want = Phaser.Math.Clamp(Math.hypot(target.x - this.x, target.y - this.y) + 50, BEAK_SLIDE_MIN, BEAK_SLIDE_MAX);
    this.len = Math.max(20, clearRun(this.world, this.x, this.y, this.ux, this.uy, want));
    this.face(this.ux);
  }

  protected act(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (target && this.timer > BEAK_CROUCH * 0.3) this.aim(target);
      const p = 1 - this.timer / BEAK_CROUCH;
      if (this.lane) layLane(this.lane, this.x, this.y - 1, this.ux, this.uy, this.len, 1.3, 0.15 + p * 0.45 + Math.sin(w.time.now * 0.03) * 0.06);
      if (this.timer <= 0) {
        this.run = 0;
        this.struck = false;
        this.enter('attack', 3000);
        this.play('slide', true);
        sound.frost('gust', w.pan(this.x));
        w.debris(SNOW_TINTS, snap(this.x), snap(this.y) - 2, 5, this.y + 1);
      }
      return;
    }
    if (this.state === 'attack') {
      const v = BEAK_SLIDE_V * Phaser.Math.Clamp((this.len - this.run) / BEAK_COAST, 0.3, 1);
      const step = (v * dt) / 1000;
      this.x += this.ux * step;
      this.y += this.uy * step;
      this.run += step;
      this.lane?.setAlpha(Math.max(0, 0.5 * (1 - this.run / this.len)));
      this.trail -= dt;
      if (this.trail <= 0) {
        this.trail = 40;
        w.debris(SNOW_TINTS, snap(this.x + this.ux * 8), snap(this.y) - 1, 1, this.y + 1, 'spores');
      }
      if (!this.struck && w.hurtHeroAt(this.x + this.ux * 4, this.y - 5, this.radius + 4, { damage: mobHit('icebeak'), fromX: this.x - this.ux * 10, fromY: this.y - this.uy * 10, knock: 200 })) {
        this.struck = true;
        w.chillHero(CHILL_LIGHT[0], CHILL_LIGHT[1]);
        w.cameras.main.shake(80, 0.0025);
        sound.thud(w.pan(this.x), true);
      }
      const blocked = !w.walkable(this.x + this.ux * 8, this.y + this.uy * 8);
      if (this.run >= this.len || blocked || this.timer <= 0) {
        this.removeLane();
        if (blocked) {
          iceBurst(w, this.x + this.ux * 8, this.y - 4, 8);
          sound.thud(w.pan(this.x), false);
        }
        this.enter('recover', BEAK_GETUP);
        this.play('getup', true);
        this.cooldown = BEAK_COOLDOWN + Math.random() * 900;
      }
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private removeLane(): void {
    this.lane?.destroy();
    this.lane = null;
  }

  protected staggers(): boolean {
    return this.state !== 'attack';
  }

  protected onInterrupted(): void {
    this.removeLane();
  }
}

// ---------------------------------------------------------------- Rimeweaver

/** It scuttles in bursts and pauses, ms each. */
const WEAVE_SKITTER = 340;
const WEAVE_PAUSE = 260;
/** The distance it likes to keep: close enough to spit, far enough not to be swatted. */
const WEAVE_KEEP = 80;
const WEAVE_SPIT_MIN = 36;
const WEAVE_SPIT_MAX = 150;
/** Reared up with the glob gathering at its fangs, ms. */
const WEAVE_SPIT = 640;
const WEAVE_FLIGHT = 620;
const WEAVE_WEB_RX = 24;
const WEAVE_WEB_LIFE = 3800;
const WEAVE_COOLDOWN = 2500;
/** Crowded this close, it bites instead: front legs up for this long, then a lunge. */
const WEAVE_BITE_RANGE = 26;
const WEAVE_BITE = 480;
const WEAVE_LUNGE = 150;
const WEAVE_BITE_COOLDOWN = 1400;

/** The frozen web left where a glob lands: it fades in over the hoarfrost and away with it. */
class WebMat implements Effect {
  dead = false;
  private t = 0;
  private img: Phaser.GameObjects.Image;

  constructor(
    world: WorldScene,
    x: number,
    y: number,
    rx: number,
    private life: number,
  ) {
    this.img = world.add.image(snap(x), snap(y), 'fw_web').setDepth(1.85).setScale(rx / (FW_WEB_W / 2 - 1)).setAlpha(0).setFlipX(Math.random() < 0.5);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    this.img.setAlpha(Math.min(1, this.t / 180) * Math.max(0, Math.min(1, (this.life - this.t) / 600)) * 0.8);
    if (this.t >= this.life) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
  }
}

/**
 * An ice spider with a violet rune glowing in its glassy abdomen. It
 * skitters in bursts, keeping a little way off; it rears up while a glob of
 * frozen silk gathers at its fangs and spits it in an arc: where it lands a
 * web of hoarfrost lies a while and chills whoever stands in it. Crowd it and
 * it flings up its front legs and bites.
 */
export class Rimeweaver extends Monster {
  private beat = Math.random() * WEAVE_SKITTER;
  private moving = true;
  private side = Math.random() < 0.5 ? 1 : -1;
  private biteCd = 0;
  private biting = false;
  private struck = false;
  private ux = 1;
  private mark: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'rimeweaver', hp: mobHp('rimeweaver'), radius: 7, bodyY: 7, speed: 74, sight: 140, leash: 270, mass: 0.9, barY: 22, debris: WEAVER_TINTS });
    this.cooldown = 700 + Math.random() * 700;
  }

  update(dt: number, target: Target | null, daylight: number): void {
    this.biteCd = Math.max(0, this.biteCd - dt);
    super.update(dt, target, daylight);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    const w = this.world;
    this.face(target.x - this.x);
    if (this.biteCd === 0 && dist < WEAVE_BITE_RANGE) {
      this.biting = true;
      this.ux = this.facing === 'r' ? 1 : -1;
      this.enter('windup', WEAVE_BITE);
      this.play('bite_wind', true);
      this.mark = dangerMark(w, this.x + this.ux * 12, this.y, 11, 7, T_VIOLET);
      sound.chitter(w.pan(this.x));
      return;
    }
    if (this.cooldown === 0 && dist > WEAVE_SPIT_MIN && dist < WEAVE_SPIT_MAX) {
      this.biting = false;
      this.enter('windup', WEAVE_SPIT);
      this.play('spit_wind', true);
      sound.swell(w.pan(this.x));
      return;
    }
    // Scuttle, stop, scuttle: closing in when far, backing off when near, sidling between.
    this.beat -= dt;
    if (this.beat <= 0) {
      this.moving = !this.moving;
      this.beat = this.moving ? WEAVE_SKITTER : WEAVE_PAUSE + Math.random() * 120;
      if (this.moving && Math.random() < 0.3) this.side = -this.side;
    }
    if (!this.moving) {
      this.stand(dt);
      return;
    }
    const [ux, uy] = toward(this.x, this.y, target, 1);
    const radial = dist > WEAVE_KEEP + 20 ? 1 : dist < WEAVE_KEEP - 25 ? -0.8 : 0;
    const mx = ux * radial - uy * this.side * 0.8;
    const my = uy * radial + ux * this.side * 0.8;
    const l = Math.hypot(mx, my) || 1;
    this.move(dt, mx / l, my / l, this.stats.speed);
    this.face(target.x - this.x);
  }

  protected act(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.biting) {
      if (this.state === 'windup') {
        this.mark?.setAlpha(0.3 + (1 - this.timer / WEAVE_BITE) * 0.5);
        if (this.timer <= 0) {
          this.removeMark();
          this.struck = false;
          this.enter('attack', WEAVE_LUNGE);
          this.pose('bite');
          sound.rake(w.pan(this.x));
        }
        return;
      }
      if (this.state === 'attack') {
        this.x += (this.ux * 60 * dt) / 1000;
        if (!this.struck) this.struck = w.hurtHeroAt(this.x + this.ux * 10, this.y - 5, 8, { damage: mobHit('rimeweaver', 0.8), fromX: this.x, fromY: this.y - 5, knock: 120 });
        if (this.timer <= 0) {
          this.enter('recover', 380);
          this.play('idle', true);
          this.biteCd = WEAVE_BITE_COOLDOWN + Math.random() * 600;
        }
        return;
      }
      if (this.timer <= 0) this.enter('chase', 0);
      return;
    }
    if (this.state === 'windup') {
      if (target) this.face(target.x - this.x);
      if (Math.random() < dt / 80) w.debris(WEB_TINTS, this.x + (this.facing === 'r' ? 9 : -9), this.y - 10, 1, this.y + 1, 'gather');
      if (this.timer <= 0) {
        if (target) this.spit(target);
        this.enter('attack', 300);
        this.pose('spit');
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) {
        this.enter('recover', 420);
        this.play('idle', true);
        this.cooldown = WEAVE_COOLDOWN + Math.random() * 900;
      }
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** A glob of frozen silk arcs to where the hero stands; a web of hoarfrost lies where it lands. */
  private spit(target: Target): void {
    const w = this.world;
    const f = this.facing === 'r' ? 1 : -1;
    const sx = this.x + f * 9;
    // Never further than it can reach.
    const dx = target.x - sx;
    const dy = target.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, WEAVE_SPIT_MAX / d);
    w.addEffect(
      new Lob(w, {
        sx,
        sy: this.y,
        lift: 10,
        ex: sx + dx * k,
        ey: this.y + dy * k,
        flight: WEAVE_FLIGHT,
        arc: 22,
        texture: 'fw_glob',
        frame: 'g',
        lit: true,
        rx: 14,
        ry: 8,
        damage: mobHit('rimeweaver', 0.7),
        knock: 60,
        tints: WEB_TINTS,
        ringTint: T_VIOLET,
        spin: 5,
        onLand: (x, y) => {
          w.addEffect(new FrostPatch(w, x, y, { rx: WEAVE_WEB_RX, life: WEAVE_WEB_LIFE, chill: CHILL_LIGHT }));
          w.addEffect(new WebMat(w, x, y, WEAVE_WEB_RX, WEAVE_WEB_LIFE));
        },
      }),
    );
    sound.spit(w.pan(this.x));
  }

  private removeMark(): void {
    this.mark?.destroy();
    this.mark = null;
  }

  protected staggers(): boolean {
    return this.state !== 'attack';
  }

  protected onInterrupted(): void {
    this.removeMark();
    this.biting = false;
  }
}

// ---------------------------------------------------------------- Flurrykin

/** Snowballs it throws each time it's up. */
const IMP_THROWS = 2;
/** Snowball held up behind its head, ms. */
const IMP_WIND = 540;
const IMP_THROW_GAP = 650;
/** Its taunt before it dives again, ms. */
const IMP_LINGER = 700;
const IMP_RANGE = 150;
const IMP_FLIGHT = 640;
/** Diving into the snow: untouchable from halfway through. */
const IMP_DIVE = 440;
/** Underground: how fast and how long at most, and how far from the hero it surfaces. */
const IMP_UNDER_V = 92;
const IMP_UNDER_MAX = 2600;
const IMP_POP_NEAR = 40;
const IMP_POP_FAR = 60;
const IMP_POP = 420;

type ImpPhase = 'up' | 'dive' | 'under' | 'pop';

/**
 * A mischievous snow imp. It lobs a couple of snowballs (a ring marks each
 * landing), grins, then dives into the snow: a drift with two ear tips
 * poking out burrows across the floor (nothing can touch it now), and it
 * bursts up again somewhere near the hero to throw some more. While it's up
 * it's soft: that's the moment to catch it.
 */
export class Flurrykin extends Monster {
  private phase: ImpPhase = 'up';
  private throwsLeft = IMP_THROWS;
  private offX = 0;
  private offY = 0;
  private digX = 0;
  private digY = 0;
  private trail = 0;
  private crunch = 0;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'flurrykin', hp: mobHp('flurrykin'), radius: 6, bodyY: 9, speed: 50, sight: 140, leash: 300, mass: 0.8, barY: 27, debris: IMP_TINTS });
    this.cooldown = 500 + Math.random() * 600;
  }

  get pinned(): boolean {
    return this.phase !== 'up';
  }

  protected get intangible(): boolean {
    return this.phase === 'under' || (this.phase === 'dive' && this.timer < IMP_DIVE * 0.5);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.cooldown > 0 && this.throwsLeft > 0) {
      // Waiting for its next throw: a little sidestep, hopping.
      this.move(dt, 0, ((Math.abs(this.slot) % 2) * 2 - 1) * 0.6, this.stats.speed * 0.5);
      this.face(target.x - this.x);
      return;
    }
    if (this.cooldown > 0) {
      this.stand(dt);
      return;
    }
    if (this.throwsLeft > 0 && dist < IMP_RANGE && dist > 20) {
      this.enter('windup', IMP_WIND);
      this.play('windup', true);
      return;
    }
    // Out of snowballs, too far or too close: down into the snow.
    this.dive();
  }

  private dive(): void {
    this.phase = 'dive';
    this.enter('attack', IMP_DIVE);
    this.play('dive', true);
    sound.hop(this.world.pan(this.x));
  }

  protected act(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (target) this.face(target.x - this.x);
      if (this.timer <= 0) {
        if (target) this.throwAt(target);
        this.pose('throw');
        this.enter('recover', 300);
      }
      return;
    }
    if (this.state === 'recover') {
      if (this.timer <= 0) {
        this.cooldown = this.throwsLeft > 0 ? IMP_THROW_GAP : IMP_LINGER;
        this.play('idle', true);
        this.enter('chase', 0);
      }
      return;
    }
    // Attack: diving, burrowing, bursting up.
    if (this.phase === 'dive') {
      if (this.timer < IMP_DIVE * 0.5 && Math.random() < dt / 50) w.debris(SNOW_TINTS, snap(this.x), snap(this.y) - 3, 1, this.y + 1, 'spores');
      if (this.timer <= 0) {
        this.phase = 'under';
        this.enter('attack', IMP_UNDER_MAX);
        this.play('mound', true);
        iceBurst(w, this.x, this.y - 3, 6);
        // It surfaces somewhere round the hero, a little way off.
        const a = Math.random() * Math.PI * 2;
        const r = IMP_POP_NEAR + Math.random() * (IMP_POP_FAR - IMP_POP_NEAR);
        this.offX = Math.cos(a) * r;
        this.offY = Math.sin(a) * r * 0.7;
        this.digX = this.x;
        this.digY = this.y;
      }
      return;
    }
    if (this.phase === 'under') {
      if (target) {
        this.digX = target.x + this.offX;
        this.digY = target.y + this.offY;
      }
      const dx = this.digX - this.x;
      const dy = this.digY - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 2) {
        const s = Math.min(d, (IMP_UNDER_V * dt) / 1000);
        this.x += (dx / d) * s;
        this.y += (dy / d) * s;
        this.face(dx);
        this.play('mound');
      }
      this.trail -= dt;
      if (this.trail <= 0) {
        this.trail = 70;
        w.debris(SNOW_TINTS, snap(this.x - (this.facing === 'r' ? 7 : -7)), snap(this.y) - 2, 1, this.y + 1, 'spores');
      }
      this.crunch -= dt;
      if (this.crunch <= 0) {
        this.crunch = 420;
        sound.frost('crunch', w.pan(this.x));
      }
      if (d <= 2 || this.timer <= 0) {
        this.phase = 'pop';
        this.enter('attack', IMP_POP);
        if (target) this.face(target.x - this.x);
        this.play('pop', true);
        iceBurst(w, this.x, this.y - 5, 10);
        w.debris(SNOW_TINTS, snap(this.x), snap(this.y) - 6, 10, this.y + 1, 'burst');
        sound.puff(w.pan(this.x));
      }
      return;
    }
    // Popped up: a beat, and it's ready to throw.
    if (this.timer <= 0) {
      this.phase = 'up';
      this.throwsLeft = IMP_THROWS;
      this.cooldown = 220;
      this.enter('chase', 0);
    }
  }

  private throwAt(target: Target): void {
    const w = this.world;
    const f = this.facing === 'r' ? 1 : -1;
    const sx = this.x + f * 4;
    const dx = target.x - sx;
    const dy = target.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, (IMP_RANGE + 20) / d);
    w.addEffect(snowball(w, { sx, sy: this.y, lift: 18, ex: sx + dx * k, ey: this.y + dy * k, flight: IMP_FLIGHT, arc: 26, rx: 12, ry: 7, damage: mobHit('flurrykin', 0.8), knock: 90, spin: 6 }));
    sound.toss(w.pan(this.x));
    this.throwsLeft--;
  }

  protected onInterrupted(): void {
    // Knocked out of a burrow (strings, a stagger): it's up and in the open.
    if (this.phase !== 'up') {
      this.phase = 'up';
      this.throwsLeft = IMP_THROWS;
    }
  }
}
