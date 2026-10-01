import Phaser from 'phaser';
import { AURELITH_TINTS, AU_BEAM_H, AU_BODY_Y, AU_MOUTH_X, AU_MOUTH_Y } from '../../art/aurelith';
import { AURORA_TINTS, T_AURORA, T_TEAL, T_VIOLET } from '../../art/frostKit';
import { FROST_CX, FROST_CY, FROST_RX, FROST_RY, frostR } from '../../world/frostLayout';
import { snap } from '../display';
import { sound } from '../../audio';
import { BossBar } from '../BossBar';
import type { Hit } from '../combat';
import type { Effect } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';
import { CHILL_LIGHT, FrostRing, chill, dangerMark, frostLane, layLane } from './frostFx';
import { Monster, type MonsterState, type Target } from './Monster';
import { mobHit, mobHp } from '../tiers';

// Aurelith never touches the floor but to crash into it. It swims round the
// hero in wide circles and turns three powers, a breather after each; at
// two thirds and one third of its health it rises out of reach and circles
// high, raining aurora down, then dives back into the fight. Times in ms;
// in its last third it takes them at `LAST_QUICK` of the time.
const HOVER = 22;
const HIGH = 150;
const SPEED = 48;
const ORBIT = 115;
const LAST_QUICK = 0.82;

// Aurora Breath: it rears back while the fan its breath will sweep glows on
// the floor (brightest where it starts), then pours a ribbon of light down
// onto the floor and sweeps it across. Out of its reach, or behind it, is safe.
// In its last third it sweeps back again.
const BREATH_WIND = 1150;
const SWEEP = 1.5;
const SWEEP_TIME = 1350;
const BREATH_LEN = 240;
const BREATH_HALF = 8;
const FAN_LANES = 5;

// Prismatic Volley: it curls in a ring, its scales flaring, and looses fans
// of crystal shards at the hero, each fan offset from the last.
const VOLLEY_WIND = 800;
const VOLLEY_GAP = 430;
const SHARD_SPREAD = 0.17;
const SHARD_SPEED = 150;
const SHARD_RANGE = 300;

// Starfall Dive: it coils up high while a mark hunts the hero across the
// floor; the mark stops and brightens, and it plunges onto it head first,
// rings of light racing out. Then it lies crashed a moment, grounded:
// blows land harder.
const COIL_LIFT = 70;
const DIVE_TRACK = 1150;
const DIVE_LOCK = 500;
const PLUNGE_TIME = 330;
const DIVE_RX = 40;
const DIVE_RY = 24;
const CRASH_TIME = 1600;
const GROUNDED_K = 1.35;

// The sky between phases: it rises out of reach and circles the colosseum,
// raining motes of aurora on marked spots, many round the hero.
const RISE_TIME = 1100;
const SKY_TIME = 6500;
const MOTE_MARK = 1100;
const MOTE_RX = 14;
const MOTE_RY = 8;

const RECOVER = 1000;

type Skill = 'breath' | 'volley' | 'dive' | 'sky';
const ORDER: Skill[] = ['breath', 'volley', 'dive'];

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** A colour `k` of the way from one to the other. */
function mix(a: number, b: number, k: number): number {
  const ch = (s: number) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, k));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** A point somewhere on the arena floor, `k` of the way out at most. */
function floorSpot(k: number): { x: number; y: number } {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * k;
  return { x: FROST_CX + Math.cos(a) * FROST_RX * r, y: FROST_CY + Math.sin(a) * FROST_RY * r };
}

/**
 * A shard of prismatic crystal loosed from on high: it streams down from the
 * serpent's body and skims along the floor toward where the hero stood.
 */
class AuroraShard implements Effect {
  dead = false;
  private img: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private gone = 0;
  private h: number;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private h0: number,
    private damage: number,
    v: number,
  ) {
    this.h = h0;
    this.img = world.add.image(x, y, 'au_shard', `s${v}`).setBlendMode(Phaser.BlendModes.ADD).setRotation(Math.atan2(uy, ux));
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint([T_AURORA, T_TEAL, T_VIOLET][v]).setScale(0.36).setAlpha(0.55);
  }

  update(dt: number): void {
    if (this.dead) return;
    const s = (SHARD_SPEED * dt) / 1000;
    this.x += this.ux * s;
    this.y += this.uy * s;
    this.gone += s;
    // Down from its body over the first stretch, then skimming at a hero's height.
    this.h = 11 + (this.h0 - 11) * Math.max(0, 1 - this.gone / 80) ** 2;
    const depth = this.y + 16;
    this.img.setPosition(snap(this.x), snap(this.y - this.h)).setDepth(depth);
    this.halo.setPosition(this.x, this.y - this.h).setDepth(depth - 0.1);
    if (Math.random() < dt / 50) this.world.debris(AURORA_TINTS, this.x, this.y - this.h, 1, depth - 0.2, 'trail');
    const hit = this.h < 24 && this.world.hurtHeroAt(this.x, this.y - 11, 4.5, { damage: this.damage, fromX: this.x - this.ux * 8, fromY: this.y - 11 - this.uy * 8, knock: 100 });
    if (hit || this.gone > SHARD_RANGE || !this.world.monsterBounds.contains(this.x, this.y)) {
      this.world.debris(AURORA_TINTS, this.x, this.y - this.h, hit ? 10 : 5, depth);
      if (hit) sound.frost('chime', this.world.pan(this.x));
      this.destroy();
    }
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
    this.halo.destroy();
  }
}

/** A mote of aurora falling from the sky onto a marked spot: the mark fills, the mote drops, it bursts. */
class AuroraMote implements Effect {
  dead = false;
  private t = 0;
  private landed = false;
  private ring: Phaser.GameObjects.Image;
  private fill: Phaser.GameObjects.Image;
  private mote: Phaser.GameObjects.Image;
  private flash: Phaser.GameObjects.Image | null = null;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private delay: number,
    private damage: number,
    private tint: number,
    private quiet: boolean,
  ) {
    this.ring = world.add.image(snap(x), snap(y), 'danger_ring').setTint(tint).setDepth(2).setScale(MOTE_RX / 22, MOTE_RY / 12).setAlpha(0);
    this.fill = world.add.image(snap(x), snap(y), 'danger_ring').setTint(0xeafff4).setBlendMode(Phaser.BlendModes.ADD).setDepth(2).setScale(0);
    this.mote = world.add.image(x, y, 'au_mote').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setVisible(false).setDepth(9000);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    if (!this.landed) {
      const k = Math.min(1, this.t / this.delay);
      this.ring.setAlpha(0.35 + k * 0.5 + Math.sin(this.t * 0.03) * 0.1);
      this.fill.setScale((MOTE_RX / 22) * k, (MOTE_RY / 12) * k).setAlpha(0.2 + k * 0.35);
      // It falls through the last 300 ms, slanting a little.
      const f = Math.max(0, 1 - (this.delay - this.t) / 300);
      if (f > 0) {
        const lift = (1 - f * f) * 220;
        this.mote.setVisible(true).setPosition(snap(this.x - lift * 0.15), snap(this.y - lift - 4)).setScale(1 + (1 - f) * 0.5);
        if (Math.random() < dt / 25) this.world.debris(AURORA_TINTS, this.x - lift * 0.15, this.y - lift - 4, 1, 9000, 'trail');
      }
      if (this.t >= this.delay) this.land();
      return;
    }
    const a = this.t - this.delay;
    this.flash?.setAlpha(Math.max(0, 0.9 - a / 260)).setScale(0.8 + a / 200, (0.8 + a / 200) * 0.6);
    if (a > 300) this.destroy();
  }

  private land(): void {
    this.landed = true;
    const { world: w, x, y } = this;
    this.ring.setVisible(false);
    this.fill.setVisible(false);
    this.mote.setVisible(false);
    w.hurtHeroInEllipse(x, y, MOTE_RX, MOTE_RY, { damage: this.damage, fromX: x, fromY: y - 4, knock: 90 });
    this.flash = w.add.image(snap(x), snap(y) - 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(this.tint).setDepth(y + 10);
    w.debris(AURORA_TINTS, snap(x), snap(y) - 3, 10, y + 2);
    if (!this.quiet) sound.frost('chime', w.pan(x));
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.ring, this.fill, this.mote, this.flash]) o?.destroy();
  }
}

/**
 * Aurelith, Serpent of the Northern Lights: the Aurora Colosseum's second
 * Myth. It swims through the air round the hero and turns three powers:
 *   - Aurora Breath: a ribbon of light poured onto the floor and swept across a marked fan.
 *   - Prismatic Volley: fans of crystal shards, each offset from the last.
 *   - Starfall Dive: a mark hunts the hero, stops, and it plunges onto it; rings race out.
 *     It lies crashed after, grounded, and blows land harder.
 * At two thirds and one third of its health it rises out of reach and
 * circles high, raining aurora, then dives back down. Each third it grows
 * fiercer: more shards and rings, and in the last a breath that sweeps back.
 * It can't be staggered or shoved.
 */
export class Aurelith extends Monster {
  private skill: Skill = 'breath';
  private turn = 0;
  private phase = Math.random() * 1000;
  /** Which third of its health it is in (1 to 3), and whether it owes the sky a flight. */
  private stage = 1;
  private skyDue = false;
  private high = false;
  private grounded = false;
  /** The height it is easing toward, and how fast (ms to get most of the way). */
  private soar = HOVER;
  private liftPace = 300;
  private spin = Math.random() < 0.5 ? 1 : -1;
  private bossBar: BossBar;
  private halo: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private power = 0;
  // Breath.
  private lanes: Phaser.GameObjects.Image[] = [];
  private beam: Phaser.GameObjects.TileSprite | null = null;
  private fall: Phaser.GameObjects.TileSprite | null = null;
  private gx = 0;
  private gy = 0;
  private a0 = 0;
  private a1 = 0;
  private sweepHit = false;
  /** Sweeping back again (its last third). */
  private returning = false;
  private len = BREATH_LEN;
  // Volley.
  private bursts = 0;
  private burstT = 0;
  // Dive.
  private mark: Phaser.GameObjects.Image | null = null;
  private markFill: Phaser.GameObjects.Image | null = null;
  private mx = 0;
  private my = 0;
  private sx = 0;
  private sy = 0;
  private sh = 0;
  private track = DIVE_TRACK;
  private rings = 0;
  private ringT = 0;
  // Sky.
  private orbitA = 0;
  private moteT = 0;
  private motes: AuroraMote[] = [];

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'aurelith',
      hp: mobHp('aurelith'),
      radius: 30,
      bodyY: 46,
      speed: SPEED,
      sight: 420,
      leash: 100000,
      mass: 60,
      barY: 150,
      debris: AURELITH_TINTS,
      noBar: true,
      rank: 'myth',
    });
    this.hover = HOVER;
    this.cooldown = 1600;
    this.bossBar = new BossBar(world, 'Aurelith, Serpent of the Northern Lights');
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(T_AURORA).setAlpha(0.25);
    this.light = world.lights.addLight(x, y - AU_BODY_Y, 190, 0x5affb0, 1.1);
    // Motes of light shed as it swims, hanging in the air behind it.
    this.trail = world.add.particles(0, 0, 'spark', {
      lifespan: { min: 900, max: 1800 },
      speedY: { min: -14, max: -2 },
      speedX: { min: -6, max: 6 },
      scale: { start: 0.6, end: 0.2 },
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.85 },
      tint: AURELITH_TINTS,
      blendMode: Phaser.BlendModes.ADD,
      frequency: 70,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-70, -100, 140, 70) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    });
  }

  get pinned(): boolean {
    return true;
  }

  /** High in the sky it can't be struck or aimed at. */
  get alive(): boolean {
    return super.alive && !this.high;
  }

  protected get intangible(): boolean {
    return this.high;
  }

  private get quick(): number {
    return this.stage >= 3 ? LAST_QUICK : 1;
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    // Ease toward the height it wants; it bobs as it swims.
    const goal = this.soar + (this.soar === HOVER ? Math.sin(this.phase * 0.002) * 3 : 0);
    this.hover += (goal - this.hover) * Math.min(1, dt / this.liftPace);
    super.update(dt, target, daylight);
    if (this.dead) return;
    const p = this.state === 'windup' || this.state === 'attack' ? 1 : 0;
    this.power += (p - this.power) * Math.min(1, dt / 260);
    this.dress();
    const fighting = this.state !== 'spawn' && this.state !== 'idle' && this.state !== 'wander' && this.state !== 'return';
    this.bossBar.update(dt, this.hp, this.maxHp, fighting && this.state !== 'dying', this.stage >= 3);
  }

  still(dt: number): void {
    super.still(dt);
    if (!this.dead) this.dress();
  }

  /** Its glow and light, cycling through the aurora's colours, and the motes it sheds. */
  private dress(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const fade = this.state === 'dying' ? Math.max(0, this.timer / 380) : this.state === 'spawn' ? 1 - this.timer / 700 : 1;
    const cy = ry - this.hover - AU_BODY_Y;
    const k = (Math.sin(this.phase * 0.0009) + 1) / 2;
    const tint = k < 0.5 ? mix(T_AURORA, T_TEAL, k * 2) : mix(T_TEAL, T_VIOLET, (k - 0.5) * 2);
    this.halo.setPosition(rx, cy).setDepth(ry - 0.3).setTint(tint).setScale(3.2 + this.power * 0.8, 2.2 + this.power * 0.5).setAlpha((0.2 + this.power * 0.14) * fade);
    this.light.setPosition(this.x, cy + 30).setColor(tint);
    this.light.intensity = (1.1 + this.power * 0.8 + (this.stage >= 3 ? 0.3 : 0)) * Math.max(0.1, fade);
    this.light.radius = 190 + this.power * 40;
    this.trail.setPosition(rx, ry - this.hover).setDepth(ry - 0.2);
    this.trail.emitting = fade > 0.3;
  }

  // ---------------------------------------------------------------- Swimming

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.skyDue) {
      this.beginSky();
      return;
    }
    if (this.cooldown === 0 && this.hover > HOVER - 6) {
      const skill = ORDER[this.turn % ORDER.length];
      this.turn++;
      this.begin(skill, target);
      return;
    }
    // Circle the hero at a breath's length, drifting in and out; turn back toward the middle near the wall.
    const d = dist || 1;
    const rx = (this.x - target.x) / d;
    const ry = (this.y - target.y) / d;
    const out = Phaser.Math.Clamp((ORBIT - d) / 40, -1, 1);
    let vx = -ry * this.spin * 0.85 + rx * out;
    let vy = (rx * this.spin * 0.85 + ry * out) * 0.75;
    if (frostR(this.x, this.y) > 0.8) {
      vx += (FROST_CX - this.x) / FROST_RX;
      vy += (FROST_CY - this.y) / FROST_RY;
    }
    const l = Math.hypot(vx, vy) || 1;
    this.x += ((vx / l) * SPEED * dt) / 1000;
    this.y += ((vy / l) * SPEED * dt) / 1000;
    this.face(target.x - this.x);
    this.play('walk');
  }

  private begin(skill: Skill, target: Target): void {
    this.skill = skill;
    this.face(target.x - this.x);
    const w = this.world;
    if (skill === 'breath') {
      this.enter('windup', BREATH_WIND * this.quick);
      this.pose('rear');
      this.aimBreath(target);
      for (let i = 0; i < FAN_LANES; i++) this.lanes.push(frostLane(w, this.gx, this.gy, 1.4, i === 0 ? 0xeafff4 : T_AURORA));
      sound.swell(w.pan(this.x));
    } else if (skill === 'volley') {
      this.enter('windup', VOLLEY_WIND * this.quick);
      this.play('volley', true);
      sound.frost('chime', w.pan(this.x), true);
    } else if (skill === 'dive') {
      this.dive(target, DIVE_TRACK);
    }
  }

  private get dir(): number {
    return this.facing === 'r' ? 1 : -1;
  }

  /** Where its breath meets the floor (under its jaws), and the fan it will sweep. */
  private aimBreath(target: Target): void {
    this.gx = this.x + this.dir * (AU_MOUTH_X - 8);
    this.gy = this.y + 2;
    const face = this.dir > 0 ? 0 : Math.PI;
    const toward = Math.atan2(target.y - this.gy, target.x - this.gx);
    // It can only breathe to the side it faces.
    const aim = face + Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(toward - face), -1, 1);
    const s = Math.random() < 0.5 ? 1 : -1;
    this.a0 = aim - (s * SWEEP) / 2;
    this.a1 = aim + (s * SWEEP) / 2;
    this.sweepHit = false;
    // The ribbon stops at the wall.
    let len = 0;
    while (len < BREATH_LEN && this.world.walkable(this.gx + Math.cos(aim) * (len + 8), this.gy + Math.sin(aim) * (len + 8))) len += 8;
    this.len = Math.max(120, len);
  }

  protected act(dt: number, target: Target | null): void {
    if (!target && this.state !== 'attack' && this.skill !== 'sky') {
      this.onInterrupted();
      this.enter('return', 0);
      return;
    }
    if (this.skill === 'breath') this.actBreath(dt);
    else if (this.skill === 'volley') this.actVolley(dt, target);
    else if (this.skill === 'dive') this.actDive(dt, target);
    else this.actSky(dt, target);
  }

  // ---------------------------------------------------------------- Aurora Breath

  private actBreath(dt: number): void {
    const w = this.world;
    const sweeps = this.stage >= 3 ? 2 : 1;
    if (this.state === 'windup') {
      const k = 1 - this.timer / (BREATH_WIND * this.quick);
      this.lanes.forEach((lane, i) => {
        const a = lerp(this.a0, this.a1, i / (FAN_LANES - 1));
        // Brightest where the sweep begins; it pulses as the breath nears.
        const alpha = (i === 0 ? 0.35 + k * 0.5 : 0.12 + k * 0.22 * (1 - i / FAN_LANES)) + Math.sin(this.phase * 0.03) * 0.05;
        layLane(lane, this.gx, this.gy, Math.cos(a), Math.sin(a), this.len, 1.4, alpha);
      });
      if (Math.random() < dt / 35) w.debris(AURORA_TINTS, this.x + this.dir * AU_MOUTH_X + (Math.random() - 0.5) * 20, this.y - this.hover - AU_MOUTH_Y + (Math.random() - 0.5) * 20, 1, this.y + 1, 'gather');
      if (this.timer <= 0) {
        this.play('breath', true);
        this.enter('attack', SWEEP_TIME * sweeps * this.quick);
        this.beam = w.add.tileSprite(this.gx, this.gy, BREATH_LEN, AU_BEAM_H, 'au_beam').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(2.5);
        this.fall = w.add.tileSprite(this.gx, this.gy, 64, AU_BEAM_H, 'au_beam').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD);
        sound.forcePush(w.pan(this.x), false);
        sound.frost('gust', w.pan(this.x), true);
        w.cameras.main.shake(SWEEP_TIME * sweeps * this.quick, 0.0012);
      }
      return;
    }
    if (this.state === 'attack') {
      const total = SWEEP_TIME * sweeps * this.quick;
      let k = 1 - this.timer / total;
      // There and back in its last third: the hero may be struck once each way.
      if (sweeps === 2) {
        if (k > 0.5 && this.sweepHit === true && !this.returning) {
          this.returning = true;
          this.sweepHit = false;
        }
        k = k < 0.5 ? k * 2 : 2 - k * 2;
      }
      const ease = k * k * (3 - 2 * k);
      const a = lerp(this.a0, this.a1, Phaser.Math.Clamp(ease, 0, 1));
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const grow = Math.min(1, (total - this.timer) / 150) * Math.min(1, this.timer / 150);
      this.beam?.setPosition(this.gx, this.gy).setRotation(a).setScale(this.len / BREATH_LEN, 0.6 + grow * 0.6).setAlpha(grow);
      if (this.beam) this.beam.tilePositionX -= dt * 0.12;
      // The pour from its jaws down to the floor.
      const mx = this.x + this.dir * AU_MOUTH_X;
      const my = this.y - this.hover - AU_MOUTH_Y;
      const fl = Math.hypot(this.gx - mx, this.gy - my);
      this.fall?.setPosition(mx, my).setRotation(Math.atan2(this.gy - my, this.gx - mx)).setScale(fl / 64, 0.5 + grow * 0.5).setAlpha(grow).setDepth(this.y + 1);
      if (this.fall) this.fall.tilePositionX -= dt * 0.12;
      // Fade the fan's lanes as the ribbon passes over them.
      this.lanes.forEach((lane, i) => lane.setAlpha(Math.max(0, lane.alpha - dt / 400) * (Math.abs(i / (FAN_LANES - 1) - k) < 0.15 ? 0.5 : 1)));
      if (Math.random() < dt / 20) {
        const d = Math.random() * this.len;
        w.debris(AURORA_TINTS, this.gx + ux * d, this.gy + uy * d - 2, 1, this.gy + uy * d + 1, 'spores');
      }
      const h = w.heroPos;
      if (h && !this.sweepHit && grow > 0.5) {
        const dx = h.x - this.gx;
        const dy = h.y - this.gy;
        const along = dx * ux + dy * uy;
        const across = Math.abs(-dx * uy + dy * ux);
        if (along > -4 && along < this.len && across < BREATH_HALF + 4) {
          this.sweepHit = true;
          w.hurtHero({ damage: mobHit('aurelith', 1), fromX: h.x - uy * Math.sign(-dx * uy + dy * ux) * 10, fromY: h.y - 11 + ux * Math.sign(-dx * uy + dy * ux) * 10, knock: 170 });
          chill(w, CHILL_LIGHT);
        }
      }
      if (this.timer <= 0) {
        this.clearBreath();
        this.rest();
      }
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private clearBreath(): void {
    for (const l of this.lanes) l.destroy();
    this.lanes = [];
    this.beam?.destroy();
    this.fall?.destroy();
    this.beam = this.fall = null;
    this.returning = false;
  }

  // ---------------------------------------------------------------- Prismatic Volley

  private actVolley(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (Math.random() < dt / 30) w.debris(AURORA_TINTS, this.x + (Math.random() - 0.5) * 90, this.y - this.hover - 40 - Math.random() * 60, 1, this.y + 1, 'gather');
      if (this.timer <= 0) {
        this.bursts = this.stage >= 2 ? 4 : 3;
        this.burstT = 0;
        this.enter('attack', this.bursts * VOLLEY_GAP * this.quick + 200);
      }
      return;
    }
    if (this.state === 'attack') {
      this.burstT -= dt;
      if (this.bursts > 0 && this.burstT <= 0 && target) {
        this.bursts--;
        this.burstT = VOLLEY_GAP * this.quick;
        this.loose(target, this.bursts % 2 === 1);
      }
      if (this.timer <= 0) this.rest();
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** One fan of shards at the hero, from high on its body; `offset` turns it half a step. */
  private loose(target: Target, offset: boolean): void {
    const n = this.stage >= 2 ? 7 : 5;
    const sx = this.x;
    const sy = this.y + 2;
    const aim = Math.atan2(target.y - sy, target.x - sx) + (offset ? SHARD_SPREAD / 2 : 0);
    for (let i = 0; i < n; i++) {
      const a = aim + (i - (n - 1) / 2) * SHARD_SPREAD;
      this.world.addEffect(new AuroraShard(this.world, sx + Math.cos(a) * 20, sy + Math.sin(a) * 12, Math.cos(a), Math.sin(a), this.hover + AU_BODY_Y, mobHit('aurelith', 0.42), i % 3));
    }
    sound.frost('chime', this.world.pan(this.x));
    sound.feather(this.world.pan(this.x));
  }

  // ---------------------------------------------------------------- Starfall Dive

  /** Coil up, a mark hunting the hero for `track` ms, then locking. */
  private dive(target: Target, track: number): void {
    this.skill = 'dive';
    this.track = track * this.quick;
    this.enter('windup', this.track + DIVE_LOCK);
    this.pose('coil');
    if (!this.high) this.soar = COIL_LIFT;
    this.liftPace = 400;
    this.mx = target.x;
    this.my = target.y;
    this.clearMark();
    this.mark = dangerMark(this.world, this.mx, this.my, DIVE_RX, DIVE_RY, T_AURORA);
    this.markFill = dangerMark(this.world, this.mx, this.my, DIVE_RX, DIVE_RY, 0xeafff4).setBlendMode(Phaser.BlendModes.ADD).setScale(0);
    sound.wings(this.world.pan(this.x), 4, false);
  }

  private actDive(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      const locked = this.timer <= DIVE_LOCK;
      if (!locked && target) {
        // The mark hunts the hero, a little behind.
        const k = Math.min(1, dt / 220);
        this.mx += (target.x - this.mx) * k;
        this.my += (target.y - this.my) * k;
      }
      if (!w.walkable(this.mx, this.my)) {
        this.mx = lerp(this.mx, FROST_CX, 0.05);
        this.my = lerp(this.my, FROST_CY, 0.05);
      }
      const fill = locked ? 1 - this.timer / DIVE_LOCK : 0;
      this.mark?.setPosition(snap(this.mx), snap(this.my)).setAlpha(locked ? 0.85 : 0.4 + Math.sin(this.phase * 0.02) * 0.1);
      this.markFill?.setPosition(snap(this.mx), snap(this.my)).setScale((DIVE_RX / 22) * fill, (DIVE_RY / 12) * fill).setAlpha(0.25 + fill * 0.35);
      this.face(this.mx - this.x);
      if (this.timer <= 0) {
        // The plunge: from wherever it is, straight down onto the mark.
        this.high = false;
        this.pose('plunge');
        this.sx = this.x;
        this.sy = this.y;
        this.sh = this.hover;
        this.soar = 0;
        this.liftPace = 1;
        this.enter('attack', PLUNGE_TIME);
        sound.glideWhoosh(w.pan(this.x), 1);
      }
      return;
    }
    if (this.state === 'attack' && !this.grounded) {
      const k = 1 - Math.max(0, this.timer) / PLUNGE_TIME;
      const e = k * k;
      this.x = lerp(this.sx, this.mx, e);
      this.y = lerp(this.sy, this.my, e);
      this.hover = this.sh * (1 - e);
      if (Math.random() < dt / 15) w.debris(AURORA_TINTS, this.x + (Math.random() - 0.5) * 40, this.y - this.hover - 30 - Math.random() * 40, 1, this.y + 1, 'trail');
      if (this.timer <= 0) this.crash();
      return;
    }
    if (this.state === 'attack') {
      this.ringT -= dt;
      if (this.rings > 0 && this.ringT <= 0) {
        this.rings--;
        this.ringT = 420;
        w.addEffect(new FrostRing(w, this.x, this.y, { from: 20, to: 200, speed: 160, damage: mobHit('aurelith', 0.5), chill: CHILL_LIGHT, knock: 140, tint: this.rings % 2 ? T_VIOLET : T_AURORA }));
      }
      if (this.timer <= 0) {
        this.enter('recover', CRASH_TIME * this.quick);
        this.pose('crashed');
      }
      return;
    }
    // Crashed on the floor; then it lifts back into the air.
    if (this.timer <= 0) {
      this.grounded = false;
      this.soar = HOVER;
      this.liftPace = 450;
      this.cooldown = (this.stage >= 3 ? 700 : 1100) + Math.random() * 600;
      this.enter('chase', 0);
      sound.wings(w.pan(this.x), 3, true);
    }
  }

  private crash(): void {
    const w = this.world;
    this.clearMark();
    this.hover = 0;
    this.grounded = true;
    this.pose('crashed');
    w.hurtHeroInEllipse(this.mx, this.my, DIVE_RX, DIVE_RY, { damage: mobHit('aurelith', 1.3), fromX: this.mx, fromY: this.my - 8, knock: 300 });
    w.addEffect(new FrostRing(w, this.x, this.y, { from: 20, to: 200, speed: 160, damage: mobHit('aurelith', 0.5), chill: CHILL_LIGHT, knock: 140, tint: T_AURORA }));
    this.rings = this.stage >= 2 ? 1 : 0;
    this.ringT = 420;
    this.enter('attack', this.rings * 420 + 200);
    if (this.stage >= 3) {
      // In its last third, shards of light burst out all round.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
        w.addEffect(new AuroraShard(w, this.x, this.y, Math.cos(a), Math.sin(a) * 0.65, 14, mobHit('aurelith', 0.4), i % 3));
      }
    }
    w.debris(AURELITH_TINTS, snap(this.x), snap(this.y) - 8, 36, this.y + 2);
    w.debris(AURORA_TINTS, snap(this.x), snap(this.y) - 4, 20, this.y + 2, 'spores');
    w.cameras.main.shake(380, 0.008);
    w.cameras.main.flash(160, 140, 255, 200);
    sound.slam(w.pan(this.x));
    sound.starImpact(w.pan(this.x));
  }

  // ---------------------------------------------------------------- The sky

  private beginSky(): void {
    const w = this.world;
    this.skyDue = false;
    this.skill = 'sky';
    this.enter('windup', RISE_TIME);
    this.play('idle', true);
    this.soar = HIGH;
    this.liftPace = 500;
    this.orbitA = Math.atan2((this.y - FROST_CY) / FROST_RY, (this.x - FROST_CX) / FROST_RX);
    w.popNumber(snap(this.x), snap(this.y) - this.hover - 110, 'THE SKY BURNS', 0xb4ffd8);
    w.debris(AURELITH_TINTS, snap(this.x), snap(this.y - this.hover - AU_BODY_Y), 30, this.y + 40, 'spores');
    sound.bossRoar(w.pan(this.x), true);
    sound.wings(w.pan(this.x), 6, false);
  }

  private actSky(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (this.hover > 60) this.high = true;
      if (this.timer <= 0) {
        this.high = true;
        this.moteT = 400;
        this.enter('attack', SKY_TIME);
      }
      return;
    }
    // Circling high over the colosseum, raining aurora.
    const sweep = (Math.PI * 2 * 0.9) / SKY_TIME;
    this.orbitA += sweep * dt * this.spin;
    const gx = FROST_CX + Math.cos(this.orbitA) * FROST_RX * 0.72;
    const gy = FROST_CY + Math.sin(this.orbitA) * FROST_RY * 0.72;
    const dx = gx - this.x;
    const dy = gy - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      const s = Math.min(d, (170 * dt) / 1000);
      this.x += (dx / d) * s;
      this.y += (dy / d) * s;
      this.face(dx);
    }
    this.play('walk');
    this.moteT -= dt;
    if (this.moteT <= 0) {
      this.moteT = this.stage >= 3 ? 190 : 250;
      const h = target ?? w.heroPos;
      const near = h && Math.random() < 0.45;
      const p = near ? { x: h!.x + (Math.random() - 0.5) * 80, y: h!.y + (Math.random() - 0.5) * 50 } : floorSpot(0.92);
      if (w.walkable(p.x, p.y)) {
        const m = new AuroraMote(w, p.x, p.y, MOTE_MARK, mobHit('aurelith', 0.5), [T_AURORA, T_TEAL, T_VIOLET][Math.floor(Math.random() * 3)], Math.random() < 0.7);
        this.motes.push(m);
        w.addEffect(m);
      }
      if (this.motes.length > 30) this.motes = this.motes.filter((m) => !m.dead);
    }
    if (this.timer <= 0) {
      // Down it comes, onto the hero.
      const t = target ?? w.heroPos;
      if (t) this.dive(t, 900);
      else {
        this.high = false;
        this.soar = HOVER;
        this.rest();
      }
    }
  }

  // ---------------------------------------------------------------- Breathers, phases, the end

  private rest(): void {
    this.enter('recover', RECOVER * this.quick);
    this.play('idle', true);
    this.soar = HOVER;
    this.liftPace = 300;
    this.cooldown = (this.stage >= 3 ? 800 : 1300) + Math.random() * 700;
    if (Math.random() < 0.4) this.spin = -this.spin;
  }

  /** Crashed on the floor, it is grounded: blows land harder. */
  hurt(hit: Hit): void {
    super.hurt(this.grounded ? { ...hit, damage: hit.damage * GROUNDED_K } : hit);
  }

  protected afterHit(): void {
    if (!this.alive) return;
    const stage = this.hp < this.maxHp / 3 ? 3 : this.hp < (this.maxHp * 2) / 3 ? 2 : 1;
    if (stage > this.stage) {
      this.stage = stage;
      this.skyDue = true;
      if (stage === 3) this.world.popNumber(snap(this.x), snap(this.y) - this.hover - 120, 'BLAZING', 0xffb0e8);
    }
  }

  protected enter(state: MonsterState, time: number): void {
    // Leaving the crash (to anything but the crash's own stages) lifts it off the floor.
    if (state !== 'attack' && state !== 'recover' && this.grounded) {
      this.grounded = false;
      this.soar = HOVER;
    }
    super.enter(state, time);
  }

  /** Its entrance: rearing, then pouring its breath. */
  protected flourish(): void {
    this.play('breath', true);
    this.world.debris(AURELITH_TINTS, snap(this.x + this.dir * AU_MOUTH_X), snap(this.y - this.hover - AU_MOUTH_Y), 20, this.y + 40, 'spores');
  }

  protected staggers(): boolean {
    return false;
  }

  protected onDeath(): void {
    const w = this.world;
    this.high = false;
    for (let i = 0; i < 8; i++) {
      w.time.delayedCall(i * 140, () => w.debris(AURELITH_TINTS, snap(this.x + (Math.random() - 0.5) * 140), snap(this.y - this.hover - 20 - Math.random() * 90), 26, this.y + 40, i % 2 ? 'spores' : 'burst'));
    }
    w.cameras.main.flash(520, 170, 255, 220);
    w.cameras.main.shake(520, 0.005);
    w.popNumber(snap(this.x), snap(this.y) - this.hover - 120, 'THE LIGHTS FADE', 0xb4ffd8);
    sound.nova();
  }

  private clearMark(): void {
    this.mark?.destroy();
    this.markFill?.destroy();
    this.mark = this.markFill = null;
  }

  protected onInterrupted(): void {
    this.clearBreath();
    this.clearMark();
    for (const m of this.motes) m.destroy();
    this.motes = [];
    this.high = false;
    this.grounded = false;
    this.soar = HOVER;
    this.liftPace = 300;
  }

  destroy(): void {
    if (this.dead) return;
    super.destroy();
    this.bossBar.destroy();
    this.halo.destroy();
    this.trail.destroy();
    this.world.lights.removeLight(this.light);
  }
}
