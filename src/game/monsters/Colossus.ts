import Phaser from 'phaser';
import { COLOSSUS_TINTS, CO_CORE_KNEEL_Y, CO_CORE_X, CO_CORE_Y, CO_CRACK_W, CO_PUNCH_X, CO_SLAM_X } from '../../art/colossus';
import { ICE_TINTS, SNOW_TINTS, T_ICE } from '../../art/frostKit';
import { FROST_CX, FROST_CY, FROST_RX, FROST_RY } from '../../world/frostLayout';
import { snap } from '../display';
import { sound } from '../../audio';
import { BossBar } from '../BossBar';
import type { Hit } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { CHILL_DEEP, CHILL_LIGHT, FrostRing, IceShard, IceSpike, Icicle, chill, dangerMark, frostLane, iceBurst, layLane } from './frostFx';
import { Monster, type MonsterState, type Target } from './Monster';
import { mobHit, mobHp } from '../tiers';

// Ymir walks slowly and turns four great powers in turn, a breather after
// each. Times are in ms; its second phase (below half health) takes them at
// `P2_QUICK` of the time.
const SPEED = 14;
const SPEED_P2 = 20;
const P2_QUICK = 0.8;

// Glacier Fist: both fists rise overhead (the spot they will strike glows on
// the floor ahead), then come down: a heavy blow there and a ring of frost
// racing out. In its second phase it slams twice, the second at the hero's new place.
const RAISE_TIME = 1050;
const RAISE_AGAIN = 700;
const SLAM_RX = 34;
const SLAM_RY = 20;
const SLAM_RING = 150;
/** The hero this close (or closer) brings on the fist or the stomp. */
const MELEE_RANGE = 120;

// Fissure: a fist drawn back high, then driven into the floor; a crack of
// light races out along a marked path and ice bursts up along it, spike
// after spike. Three paths in a fan in its second phase.
const DRAW_TIME = 950;
const FISSURE_LEN = 270;
const FISSURE_STEP = 22;
const FISSURE_PACE = 65;
const FAN = 0.38;

// Glacier Stomp: a foot lifted high (the ground round it glows), brought
// down: a blow all round its feet, rings of frost one after another, and
// icicles shaken loose from the sky.
const LIFT_TIME = 1150;
const STOMP_RX = 66;
const STOMP_RY = 40;
const STOMP_RING = 250;
const RING_GAP = 520;

// Avalanche Roar: arms thrown wide, it roars, and icicles rain over the
// floor in waves on marked spots, one on the hero and some round them.
const ROAR_TIME = 1200;
const WAVE_GAP = 820;
const ICICLE_MARK = 1150;

// Spent: after the stomp and the roar it sinks to a knee, its chest plates
// parted on the blazing core. Blows land harder then.
const SPENT_TIME = 2300;
const EXPOSED_K = 1.5;
const RECOVER = 1100;

// Breaking: at half health it rears back, its core blazing, and its glacier
// bursts: shards fly out all round (with gaps to stand in), and chunks of
// ice keep circling it after.
const BREAK_TIME = 1300;
const BREAK_SHARDS = 16;
const CHUNKS = 4;

type Skill = 'slam' | 'fissure' | 'stomp' | 'storm' | 'break';
/** The order it turns its powers in; close in, the fissure gives way to a fist, and far off, the fist and stomp to a fissure. */
const ORDER: Skill[] = ['slam', 'fissure', 'stomp', 'fissure', 'storm'];

/** A point somewhere on the arena floor, `k` of the way out at most. */
function floorSpot(k: number): { x: number; y: number } {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * k;
  return { x: FROST_CX + Math.cos(a) * FROST_RX * r, y: FROST_CY + Math.sin(a) * FROST_RY * r };
}

/**
 * Ymir, the Glacier Colossus: the Aurora Colosseum's first Myth. Slow and
 * enormous, it turns four powers with a breather after each:
 *   - Glacier Fist: both fists slammed down on a marked spot, a ring of frost racing out.
 *   - Fissure: a fist driven into the floor; ice bursts up spike after spike along a marked path.
 *   - Glacier Stomp: a blow all round its feet, rings of frost one after another, icicles shaken loose.
 *   - Avalanche Roar: icicles rain over the floor in waves.
 * After the stomp and the roar it kneels spent, its core exposed: blows land
 * half again as hard. At half health its glacier breaks (shards burst out
 * all round), its core blazes, chunks of ice circle it, and it moves and
 * strikes faster. It can't be staggered or shoved.
 */
export class Colossus extends Monster {
  private skill: Skill = 'slam';
  private turn = 0;
  private phase = Math.random() * 1000;
  private broken = false;
  /** Its glacier is ready to break: it does at its next breather. */
  private breakDue = false;
  private exposed = false;
  private bossBar: BossBar;
  private halo: Phaser.GameObjects.Image;
  private blaze: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private chunks: Phaser.GameObjects.Image[] = [];
  /** 0..1 how hard its power burns right now: brightens the core and its light. */
  private power = 0;
  // The current power's telegraphs and aim.
  private mark: Phaser.GameObjects.Image | null = null;
  private markFill: Phaser.GameObjects.Image | null = null;
  private lanes: Phaser.GameObjects.Image[] = [];
  private cracks: { img: Phaser.GameObjects.Image; x: number; y: number; ux: number; uy: number; len: number; t: number }[] = [];
  private aimX = 0;
  private aimY = 0;
  private angle = 0;
  private slams = 0;
  private waves = 0;
  private waveT = 0;
  private rings = 0;
  private ringT = 0;
  private spikes: IceSpike[] = [];
  private icicles: Icicle[] = [];

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'colossus',
      hp: mobHp('colossus'),
      radius: 30,
      bodyY: 56,
      speed: SPEED,
      sight: 420,
      leash: 100000,
      mass: 60,
      barY: 140,
      debris: COLOSSUS_TINTS,
      noBar: true,
      rank: 'myth',
    });
    this.cooldown = 1500;
    this.bossBar = new BossBar(world, 'Ymir, the Glacier Colossus');
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(T_ICE).setAlpha(0.3);
    // A second, whiter glow over the core while it burns hot (exposed, breaking, broken).
    this.blaze = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xe8fbff).setAlpha(0);
    this.light = world.lights.addLight(x, y - CO_CORE_Y, 170, 0x7ad0ff, 1.1);
  }

  get pinned(): boolean {
    return true;
  }

  private get quick(): number {
    return this.broken ? P2_QUICK : 1;
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    super.update(dt, target, daylight);
    if (this.dead) return;
    const p = this.state === 'windup' || this.state === 'attack' || this.exposed ? 1 : 0;
    this.power += (p - this.power) * Math.min(1, dt / 260);
    this.runCracks(dt);
    if (this.spikes.length > 24) this.spikes = this.spikes.filter((s) => !s.dead);
    if (this.icicles.length > 24) this.icicles = this.icicles.filter((i) => !i.dead);
    this.dress();
    const fighting = this.state !== 'spawn' && this.state !== 'idle' && this.state !== 'wander' && this.state !== 'return';
    this.bossBar.update(dt, this.hp, this.maxHp, fighting && this.state !== 'dying', this.broken);
  }

  /** Held still for its entrance: its glow stays with it. */
  still(dt: number): void {
    super.still(dt);
    if (!this.dead) this.dress();
  }

  /** The core's glow and light, and in its second phase the chunks of glacier circling it. */
  private dress(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const fade = this.state === 'dying' ? Math.max(0, this.timer / 380) : this.state === 'spawn' ? 1 - this.timer / 700 : 1;
    const dir = this.facing === 'r' ? 1 : -1;
    const kneel = this.exposed;
    const cy = ry - (kneel ? CO_CORE_KNEEL_Y : CO_CORE_Y);
    const cx = rx + dir * CO_CORE_X;
    const beat = 0.88 + Math.max(0, Math.sin(this.phase * (this.broken ? 0.007 : 0.0045))) ** 5 * 0.3;
    const hot = this.exposed || this.skill === 'break' ? 1 : this.power;
    this.halo.setPosition(cx, cy).setDepth(ry + 0.3).setScale((1.1 + hot * 0.7 + (this.broken ? 0.4 : 0)) * beat).setAlpha((0.28 + hot * 0.25) * fade);
    this.blaze.setPosition(cx, cy).setDepth(ry + 0.31).setScale((0.45 + hot * 0.35) * beat).setAlpha(((this.broken ? 0.4 : 0) + (this.exposed ? 0.45 : 0)) * fade);
    this.light.setPosition(cx, cy + 20);
    this.light.intensity = (1.1 + hot * 0.9 + (this.broken ? 0.4 : 0)) * beat * Math.max(0.1, fade);
    this.light.radius = 170 + hot * 50;
    // The chunks circle at chest height, passing behind and in front of it.
    this.chunks.forEach((ch, i) => {
      const a = this.phase * 0.0011 + (i * Math.PI * 2) / this.chunks.length;
      const s = Math.sin(a);
      ch.setPosition(snap(this.x + Math.cos(a) * 52), snap(this.y - 64 + s * 14 + Math.sin(this.phase * 0.003 + i) * 4))
        .setDepth(ry + (s > 0 ? 0.5 : -0.5))
        .setRotation(this.phase * 0.0015 * (i % 2 ? 1 : -1))
        .setAlpha(fade);
    });
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.breakDue) {
      this.begin('break', target);
      return;
    }
    if (this.cooldown === 0) {
      let skill = ORDER[this.turn % ORDER.length];
      this.turn++;
      const close = dist < MELEE_RANGE;
      if ((skill === 'slam' || skill === 'stomp') && !close) skill = 'fissure';
      else if (skill === 'fissure' && dist < 60) skill = 'slam';
      this.begin(skill, target);
      return;
    }
    // Lumber toward the hero, stopping a fist's reach away.
    if (dist > 70) {
      this.move(dt, (target.x - this.x) / dist, (target.y - this.y) / dist, this.broken ? SPEED_P2 : SPEED);
    } else this.play('idle');
  }

  private begin(skill: Skill, target: Target): void {
    this.skill = skill;
    this.face(target.x - this.x);
    const w = this.world;
    const pan = w.pan(this.x);
    if (skill === 'slam') {
      this.slams = this.broken ? 2 : 1;
      this.raise(target, RAISE_TIME);
    } else if (skill === 'fissure') {
      this.enter('windup', DRAW_TIME * this.quick);
      this.pose('draw0');
      const n = this.broken ? 3 : 1;
      this.angle = this.aimAt(target);
      const o = this.fist(CO_PUNCH_X * 0.6);
      for (let i = 0; i < n; i++) this.lanes.push(frostLane(w, o.x, o.y, 1.4, T_ICE));
      sound.frost('freeze', pan, true);
    } else if (skill === 'stomp') {
      this.enter('windup', LIFT_TIME * this.quick);
      this.pose('lift');
      this.mark = dangerMark(w, this.x, this.y, STOMP_RX, STOMP_RY, T_ICE);
      this.markFill = dangerMark(w, this.x, this.y, STOMP_RX, STOMP_RY, 0xe0f8ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0);
      sound.thud(pan, true);
    } else if (skill === 'storm') {
      this.enter('windup', ROAR_TIME * this.quick);
      this.play('roar', true);
      sound.bossRoar(pan, true);
      w.cameras.main.shake(ROAR_TIME * this.quick, 0.0016);
    } else {
      // Breaking: it rears up, roaring, the core blazing white.
      this.breakDue = false;
      this.enter('windup', BREAK_TIME);
      this.play('roar', true);
      sound.bossRoar(pan, true);
      sound.frost('crack', pan, true);
      w.cameras.main.shake(BREAK_TIME, 0.002);
    }
  }

  /** Raise both fists over a marked spot in front, near the hero. */
  private raise(target: Target, time: number): void {
    this.face(target.x - this.x);
    this.enter('windup', time * this.quick);
    this.play('raise', true);
    const dir = this.facing === 'r' ? 1 : -1;
    // Its arms reach only so far: the spot is ahead of it, as near the hero as it can be.
    const reachX = Phaser.Math.Clamp(target.x - this.x, dir > 0 ? 22 : -CO_SLAM_X - 10, dir > 0 ? CO_SLAM_X + 10 : -22);
    this.aimX = this.x + reachX;
    this.aimY = this.y + Phaser.Math.Clamp(target.y - this.y, -22, 22);
    this.clearMark();
    this.mark = dangerMark(this.world, this.aimX, this.aimY, SLAM_RX, SLAM_RY, T_ICE);
    this.markFill = dangerMark(this.world, this.aimX, this.aimY, SLAM_RX, SLAM_RY, 0xe0f8ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0);
    sound.swell(this.world.pan(this.x));
  }

  /** Where its fist strikes the floor, `ahead` px in front of its feet. */
  private fist(ahead: number): { x: number; y: number } {
    return { x: this.x + (this.facing === 'r' ? ahead : -ahead), y: this.y + 3 };
  }

  /** The angle from its punching fist to the hero, kept to the side it faces. */
  private aimAt(target: Target): number {
    const o = this.fist(CO_PUNCH_X * 0.6);
    let dx = target.x - o.x;
    const dy = target.y - o.y;
    const dir = this.facing === 'r' ? 1 : -1;
    if (dx * dir < 8) dx = 8 * dir;
    return Math.atan2(dy, dx);
  }

  protected act(dt: number, target: Target | null): void {
    if (!target && this.state !== 'attack' && this.skill !== 'break') {
      this.onInterrupted();
      this.enter('return', 0);
      return;
    }
    switch (this.skill) {
      case 'slam':
        this.actSlam(dt, target);
        break;
      case 'fissure':
        this.actFissure(dt, target);
        break;
      case 'stomp':
        this.actStomp(dt);
        break;
      case 'storm':
        this.actStorm(dt, target);
        break;
      case 'break':
        this.actBreak(dt);
        break;
    }
  }

  /** The mark's fill grows as the strike nears; returns 0..1. */
  private fillMark(total: number, rx: number, ry: number): number {
    const k = Phaser.Math.Clamp(1 - this.timer / total, 0, 1);
    this.mark?.setAlpha(0.4 + k * 0.45 + Math.sin(this.phase * 0.03) * 0.08);
    this.markFill?.setScale((rx / 22) * k, (ry / 12) * k).setAlpha(0.2 + k * 0.35);
    return k;
  }

  private actSlam(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      const total = (this.slams === 2 || !this.broken ? RAISE_TIME : RAISE_AGAIN) * this.quick;
      this.fillMark(total, SLAM_RX, SLAM_RY);
      if (Math.random() < dt / 40) w.debris(ICE_TINTS, this.aimX + (Math.random() - 0.5) * SLAM_RX * 1.6, this.aimY + (Math.random() - 0.5) * SLAM_RY, 1, this.aimY + 1, 'gather');
      if (this.timer <= 0) {
        this.clearMark();
        this.play('slam', true);
        this.enter('attack', 520);
        this.slams--;
        if (w.hurtHeroInEllipse(this.aimX, this.aimY, SLAM_RX, SLAM_RY, { damage: mobHit('colossus', 1.2), fromX: this.aimX, fromY: this.aimY - 6, knock: 280 })) chill(w, CHILL_DEEP);
        w.addEffect(new FrostRing(w, this.aimX, this.aimY, { from: 18, to: SLAM_RING, speed: 165, damage: mobHit('colossus', 0.5), chill: CHILL_LIGHT, knock: 140 }));
        iceBurst(w, this.aimX, this.aimY - 4, 26);
        w.debris(SNOW_TINTS, snap(this.aimX), snap(this.aimY) - 2, 14, this.aimY + 2, 'spores');
        w.cameras.main.shake(260, 0.006);
        sound.slam(w.pan(this.aimX));
        sound.frost('crack', w.pan(this.aimX), true);
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) {
        if (this.slams > 0 && target) this.raise(target, RAISE_AGAIN);
        else this.rest(false);
      }
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private actFissure(_dt: number, target: Target | null): void {
    const w = this.world;
    const o = this.fist(CO_PUNCH_X);
    if (this.state === 'windup') {
      const total = DRAW_TIME * this.quick;
      const k = 1 - this.timer / total;
      // It tracks the hero while it draws back, then commits.
      if (target && k < 0.6) this.angle = this.aimAt(target);
      const start = this.fist(CO_PUNCH_X * 0.6);
      const n = this.lanes.length;
      this.lanes.forEach((lane, i) => {
        const a = this.angle + (n > 1 ? (i - (n - 1) / 2) * FAN : 0);
        layLane(lane, start.x, start.y, Math.cos(a), Math.sin(a), FISSURE_LEN, 1.4, 0.18 + k * 0.5 + Math.sin(this.phase * 0.03) * 0.06);
      });
      if (this.timer <= 0) {
        this.play('punch', true);
        this.enter('attack', 700);
        w.hurtHeroInEllipse(o.x, o.y, 24, 14, { damage: mobHit('colossus', 1), fromX: o.x, fromY: o.y - 6, knock: 240 });
        iceBurst(w, o.x, o.y - 3, 20);
        w.cameras.main.shake(220, 0.005);
        sound.slam(w.pan(o.x));
        // Ice bursts up along each path, spike after spike from the fist outward.
        this.lanes.forEach((lane, i) => {
          const a = this.angle + (n > 1 ? (i - (n - 1) / 2) * FAN : 0);
          const ux = Math.cos(a);
          const uy = Math.sin(a);
          let len = 0;
          for (let d = FISSURE_STEP; d <= FISSURE_LEN; d += FISSURE_STEP) {
            const x = start.x + ux * d;
            const y = start.y + uy * d;
            if (!w.walkable(x, y)) break;
            len = d;
            const s = new IceSpike(w, x, y, { delay: 140 + (d / FISSURE_STEP) * FISSURE_PACE, damage: mobHit('colossus', 0.75), size: 1.25, stand: 900, chill: CHILL_LIGHT, knock: 170, quiet: (d / FISSURE_STEP) % 3 !== 0 });
            this.spikes.push(s);
            w.addEffect(s);
          }
          lane.destroy();
          if (len > 0) {
            // The crack of light that races ahead of the spikes.
            const img = w.add.image(start.x, start.y, 'co_crack').setOrigin(0, 0.5).setRotation(a).setBlendMode(Phaser.BlendModes.ADD).setTint(T_ICE).setDepth(2.3).setScale(0, 1.2);
            this.cracks.push({ img, x: start.x, y: start.y, ux, uy, len, t: 0 });
          }
        });
        this.lanes = [];
        sound.frost('crack', w.pan(o.x), true);
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) this.rest(false);
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** The fissures' cracks of light race out along the floor, then fade. */
  private runCracks(dt: number): void {
    if (!this.cracks.length) return;
    const speed = (FISSURE_STEP / FISSURE_PACE) * 1000;
    this.cracks = this.cracks.filter((c) => {
      c.t += dt;
      const reach = Math.min(c.len, c.t * (speed / 1000));
      const fade = Math.max(0, 1 - Math.max(0, c.t - (c.len / speed) * 1000 - 400) / 700);
      c.img.setScale(reach / CO_CRACK_W, 1.2).setAlpha(0.9 * fade);
      if (fade <= 0) c.img.destroy();
      return fade > 0;
    });
  }

  private actStomp(dt: number): void {
    const w = this.world;
    if (this.state === 'windup') {
      this.fillMark(LIFT_TIME * this.quick, STOMP_RX, STOMP_RY);
      this.mark?.setPosition(snap(this.x), snap(this.y));
      this.markFill?.setPosition(snap(this.x), snap(this.y));
      if (Math.random() < dt / 30) {
        const a = Math.random() * Math.PI * 2;
        w.debris(SNOW_TINTS, this.x + Math.cos(a) * STOMP_RX, this.y + Math.sin(a) * STOMP_RY, 1, this.y + 1, 'gather');
      }
      if (this.timer <= 0) {
        this.clearMark();
        this.play('stomp', true);
        this.rings = this.broken ? 3 : 2;
        this.ringT = 0;
        this.enter('attack', RING_GAP * this.rings + 300);
        if (w.hurtHeroInEllipse(this.x, this.y, STOMP_RX, STOMP_RY, { damage: mobHit('colossus', 1.1), fromX: this.x, fromY: this.y - 10, knock: 320 })) chill(w, CHILL_DEEP);
        iceBurst(w, this.x + (this.facing === 'r' ? 30 : -30), this.y - 3, 30);
        w.debris(SNOW_TINTS, snap(this.x), snap(this.y) - 4, 30, this.y + 2, 'spores');
        w.cameras.main.shake(420, 0.009);
        sound.slam(w.pan(this.x));
        sound.thud(w.pan(this.x), true);
        // Icicles shaken loose from above, a few round the hero.
        const h = w.heroPos;
        for (let i = 0; i < (this.broken ? 6 : 4); i++) {
          const p = h && i < 2 ? { x: h.x + (Math.random() - 0.5) * 70, y: h.y + (Math.random() - 0.5) * 44 } : floorSpot(0.85);
          if (w.walkable(p.x, p.y)) this.drop(p.x, p.y, ICICLE_MARK + 250 + i * 120, 1.1, true);
        }
      }
      return;
    }
    if (this.state === 'attack') {
      this.ringT -= dt;
      if (this.rings > 0 && this.ringT <= 0) {
        this.rings--;
        this.ringT = RING_GAP * this.quick;
        w.addEffect(new FrostRing(w, this.x, this.y, { from: 24, to: STOMP_RING, speed: 150, damage: mobHit('colossus', 0.55), chill: CHILL_LIGHT, knock: 150 }));
        sound.frost('freeze', w.pan(this.x));
      }
      if (this.timer <= 0) this.rest(true);
      return;
    }
    this.recovering();
  }

  private actStorm(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (Math.random() < dt / 40) w.debris(SNOW_TINTS, this.x + (Math.random() - 0.5) * 120, this.y - 140 - Math.random() * 30, 1, this.y + 60, 'spores');
      if (this.timer <= 0) {
        this.waves = this.broken ? 4 : 3;
        this.waveT = 0;
        this.enter('attack', this.waves * WAVE_GAP + ICICLE_MARK);
      }
      return;
    }
    if (this.state === 'attack') {
      this.waveT -= dt;
      if (this.waves > 0 && this.waveT <= 0) {
        this.waves--;
        this.waveT = WAVE_GAP * this.quick;
        this.rain(target);
      }
      if (this.timer <= 0) this.rest(true);
      return;
    }
    this.recovering();
  }

  /** One wave of icicles: one on the hero, two near them, the rest over the floor. */
  private rain(target: Target | null): void {
    const n = this.broken ? 8 : 6;
    for (let i = 0; i < n; i++) {
      let p: { x: number; y: number };
      if (target && i === 0) p = { x: target.x, y: target.y };
      else if (target && i < 3) {
        const a = Math.random() * Math.PI * 2;
        const r = 30 + Math.random() * 30;
        p = { x: target.x + Math.cos(a) * r, y: target.y + Math.sin(a) * r * 0.65 };
      } else p = floorSpot(0.9);
      if (this.world.walkable(p.x, p.y)) this.drop(p.x, p.y, ICICLE_MARK + i * 45, 1.3, i > 0);
    }
    sound.frost('chime', this.world.pan(this.x));
  }

  private drop(x: number, y: number, delay: number, size: number, quiet: boolean): void {
    const ice = new Icicle(this.world, x, y, { delay, damage: mobHit('colossus', 0.7), size, chill: CHILL_LIGHT, patch: this.broken ? 2600 : 0, quiet });
    this.icicles.push(ice);
    this.world.addEffect(ice);
  }

  private actBreak(dt: number): void {
    const w = this.world;
    if (this.state === 'windup') {
      // Light gathers into the core; ice cracks off it in specks.
      if (Math.random() < dt / 25) {
        const a = Math.random() * Math.PI * 2;
        w.debris(ICE_TINTS, this.x + Math.cos(a) * 50, this.y - CO_CORE_Y + Math.sin(a) * 40, 1, this.y + 1, 'gather');
      }
      if (this.timer <= 0) this.shatter();
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) this.rest(true);
      return;
    }
    this.recovering();
  }

  /** Its glacier breaks: shards burst out all round, and chunks of it stay circling. */
  private shatter(): void {
    const w = this.world;
    this.broken = true;
    this.enter('attack', 600);
    this.pose('roar1');
    const a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < BREAK_SHARDS; i++) {
      const a = a0 + (i / BREAK_SHARDS) * Math.PI * 2;
      const ux = Math.cos(a);
      const uy = Math.sin(a) * 0.62;
      const l = Math.hypot(ux, uy);
      w.addEffect(new IceShard(w, this.x + ux * 30, this.y - 11 + uy * 30, ux / l, uy / l, { damage: mobHit('colossus', 0.6), speed: 135, range: 300, size: 1.4, chill: CHILL_LIGHT, knock: 120 }));
    }
    for (let i = 0; i < CHUNKS; i++) this.chunks.push(w.add.image(this.x, this.y, 'co_chunk', `c${i % 3}`).setPipeline('Lit').setScale(1 + (i % 2) * 0.3));
    this.halo.setTint(0xbff0ff);
    this.light.setColor(0xa8e4ff);
    iceBurst(w, this.x, this.y - 70, 46);
    w.debris(COLOSSUS_TINTS, snap(this.x), snap(this.y) - 90, 36, this.y + 40, 'spores');
    w.popNumber(snap(this.x), snap(this.y) - 150, 'THE GLACIER BREAKS', 0xc8f4ff);
    w.cameras.main.flash(260, 200, 240, 255);
    w.cameras.main.shake(420, 0.008);
    sound.shatter(w.pan(this.x), true);
    sound.nova();
  }

  /** The power is spent. After the great ones it kneels with its core open; after the others it only stands a moment. */
  private rest(spent: boolean): void {
    this.clearMark();
    if (spent) {
      this.exposed = true;
      this.enter('recover', SPENT_TIME * (this.broken ? 0.85 : 1));
      this.play('kneel', true);
      this.world.popNumber(snap(this.x), snap(this.y) - 100, 'CORE EXPOSED', 0x9ae8ff);
      sound.thud(this.world.pan(this.x));
    } else {
      this.enter('recover', RECOVER * this.quick);
      this.play('idle', true);
    }
    this.cooldown = (this.broken ? 700 : 1100) + Math.random() * 600;
  }

  private recovering(): void {
    if (this.timer > 0) return;
    this.exposed = false;
    this.enter('chase', 0);
  }

  /** While its core lies open, blows land harder. */
  hurt(hit: Hit): void {
    super.hurt(this.exposed && this.state === 'recover' ? { ...hit, damage: hit.damage * EXPOSED_K } : hit);
  }

  protected afterHit(): void {
    if (!this.broken && !this.breakDue && this.alive && this.hp < this.maxHp / 2) this.breakDue = true;
  }

  /** Leaving its knee (for any state but the kneel itself) closes the core again. */
  protected enter(state: MonsterState, time: number): void {
    if (state !== 'recover' && this.exposed && state !== 'dying') this.exposed = false;
    super.enter(state, time);
  }

  /** Its entrance: the Avalanche Roar, arms thrown wide. */
  protected flourish(): void {
    this.play('roar', true);
    this.world.debris(SNOW_TINTS, snap(this.x), snap(this.y) - 120, 24, this.y + 40, 'spores');
  }

  protected staggers(): boolean {
    return false;
  }

  protected onDeath(): void {
    const w = this.world;
    for (let i = 0; i < 8; i++) {
      w.time.delayedCall(i * 120, () => {
        iceBurst(w, this.x + (Math.random() - 0.5) * 100, this.y - 10 - Math.random() * 110, 20, this.y + 40);
        if (i % 3 === 0) sound.shatter(w.pan(this.x), true);
      });
    }
    w.debris(SNOW_TINTS, snap(this.x), snap(this.y) - 4, 40, this.y + 2, 'spores');
    w.cameras.main.flash(460, 210, 240, 255);
    w.cameras.main.shake(700, 0.008);
    w.popNumber(snap(this.x), snap(this.y) - 150, 'THE MOUNTAIN FALLS', 0xc8f4ff);
    sound.nova();
  }

  private clearMark(): void {
    this.mark?.destroy();
    this.markFill?.destroy();
    this.mark = this.markFill = null;
  }

  protected onInterrupted(): void {
    this.clearMark();
    for (const l of this.lanes) l.destroy();
    this.lanes = [];
    // Slain (or gone): its spikes and icicles go with it.
    for (const s of this.spikes) s.destroy();
    for (const i of this.icicles) i.destroy();
    this.spikes = [];
    this.icicles = [];
    this.exposed = false;
  }

  destroy(): void {
    if (this.dead) return;
    super.destroy();
    this.bossBar.destroy();
    this.halo.destroy();
    this.blaze.destroy();
    for (const c of this.chunks) c.destroy();
    for (const c of this.cracks) c.img.destroy();
    this.cracks = [];
    this.world.lights.removeLight(this.light);
  }
}
