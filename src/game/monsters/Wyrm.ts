import Phaser from 'phaser';
import { WYRM_TINTS } from '../../art/wyrm';
import { LANE_W } from '../../art/spirit';
import { snap } from '../display';
import { sound } from '../../audio';
import { BossBar } from '../BossBar';
import type { Effect } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';
import { HEART, WYRM_HOME } from '../../world/deepLayout';
import { CrystalSpike, clearRun, laneMark } from './Deep';
import { Monster, type Target } from './Monster';
import { mobHit, mobHp } from '../tiers';

/** Its geode heart, in its chest, above its feet. */
const HEART_Y = 58;
/** Its jaws while breathing: ahead of its feet and up. */
const MOUTH_X = 48;
const MOUTH_Y = 86;
/** Its head once driven into the floor. */
const SLAM_X = 44;

// Crystal Breath: it rears back (the torrent's path glows on the floor) and
// breathes a stream of amethyst shards along it; crystals burst up along
// the path after.
const REAR_TIME = 1000;
const BREATH_TIME = 1000;
const BREATH_LEN = 210;
const SHARD_SPEED = 230;

// Geode Eruption: it rears high and drives its head into the floor, and
// amethyst bursts up in spokes all round it, ring after ring outward. The
// gaps between the spokes are the way to live.
const QUAKE_TIME = 1100;
const SPOKE_STEP = 24;

// Burrow: it dives under the floor and is gone, a rumbling mark hunting the
// hero across the Heart; the mark stops, brightens, and it bursts up there.
const DIVE_TIME = 650;
const UNDER_TIME = 1900;
const RISE_TIME = 650;
const RISE_RX = 34;
const RISE_RY = 20;
const RECOVER = 1300;

type Skill = 'breath' | 'quake' | 'burrow';
const ORDER: Skill[] = ['breath', 'quake', 'burrow'];

/** One shard of its breath: it streams down from its jaws and skims along the floor. */
class BreathShard implements Effect {
  dead = false;
  private body: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private gone = 0;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private range: number,
    private damage: number,
  ) {
    this.body = world.add.image(x, y, 'gd_shard_e', 's0').setBlendMode(Phaser.BlendModes.ADD).setRotation(Math.atan2(uy, ux));
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xb37aff).setScale(0.3).setAlpha(0.5);
  }

  update(dt: number): void {
    if (this.dead) return;
    const s = (SHARD_SPEED * dt) / 1000;
    this.x += this.ux * s;
    this.y += this.uy * s;
    this.gone += s;
    // Down from its jaws, then skimming the floor.
    const h = 8 + Math.max(0, MOUTH_Y - 8) * Math.max(0, 1 - this.gone / 70) ** 2;
    const depth = this.y + 16;
    this.body.setPosition(snap(this.x), snap(this.y - h)).setDepth(depth);
    this.halo.setPosition(this.x, this.y - h).setDepth(depth - 0.1);
    if (Math.random() < dt / 60) this.world.debris(WYRM_TINTS, this.x, this.y - h, 1, depth - 0.2, 'trail');
    const hit = h < 20 && this.world.hurtHeroAt(this.x, this.y - 8, 6, { damage: this.damage, fromX: this.x - this.ux * 10, fromY: this.y - this.uy * 10, knock: 110 });
    if (hit || this.gone > this.range) {
      this.world.debris(WYRM_TINTS, this.x, this.y - h, hit ? 8 : 3, depth);
      this.destroy();
    }
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.body.destroy();
    this.halo.destroy();
  }
}

/** Is (x, y) well inside the Geode Heart, `m` px in from its edge? */
function inHeart(x: number, y: number, m = 0): boolean {
  const dx = (x - HEART.cx) / Math.max(1, HEART.rx - m);
  const dy = (y - HEART.cy) / Math.max(1, HEART.ry - m);
  return dx * dx + dy * dy < 1;
}

/**
 * Amethrax, the Geode Wyrm: the Glimmerdeep's Myth, lying coiled on the dais
 * of the Geode Heart at the bottom of the world. It turns three great powers
 * in order, with a breather after each:
 *   - Crystal Breath: a torrent of shards along a marked path, and crystals burst up along it after.
 *   - Geode Eruption: spokes of amethyst burst from the floor all round it, ring after ring.
 *   - Burrow: it dives under the floor, hunts the hero as a rumbling mark, and bursts up under them.
 * Below half health it is in a shattered fury: quicker, with more shards and
 * spokes, and it rises from its burrow in a ring of crystal.
 * It can't be staggered or shoved.
 */
export class Wyrm extends Monster {
  private skill: Skill = 'breath';
  private turn = 0;
  private phase = Math.random() * 1000;
  private enraged = false;
  private bossBar: BossBar;
  private halo: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private power = 0;
  private prey: Target | null = null;
  // Breath: its aim, its path on the floor, and the next shard.
  private ux = 1;
  private uy = 0;
  private len = BREATH_LEN;
  private lane: Phaser.GameObjects.Image | null = null;
  private shardT = 0;
  // Burrow: under the floor, then rising; the mark it hunts with.
  private under: 'no' | 'hunt' | 'rise' = 'no';
  private mark: Phaser.GameObjects.Image | null = null;
  private markFill: Phaser.GameObjects.Image | null = null;
  private underT = 0;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'wyrm',
      hp: mobHp('wyrm'),
      radius: 26,
      bodyY: 40,
      speed: 16,
      sight: 170,
      leash: 100000,
      mass: 40,
      barY: 136,
      debris: WYRM_TINTS,
      noBar: true,
      rank: 'myth',
    });
    this.cooldown = 1600;
    this.bossBar = new BossBar(world, 'Amethrax, the Geode Wyrm');
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xb37aff).setAlpha(0.3);
    this.light = world.lights.addLight(x, y - HEART_Y, 180, 0xb888ff, 1.2);
    // Glints rising off its crystal spines.
    this.motes = world.add.particles(0, 0, 'spark', {
      lifespan: { min: 900, max: 1700 },
      speedY: { min: -26, max: -10 },
      speedX: { min: -6, max: 6 },
      scale: 0.45,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.9 },
      tint: WYRM_TINTS,
      blendMode: Phaser.BlendModes.ADD,
      frequency: 120,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-46, -110, 92, 90) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    });
  }

  get pinned(): boolean {
    return true;
  }

  /** Under the floor it can't be struck or aimed at. */
  get alive(): boolean {
    return super.alive && this.under === 'no';
  }

  protected get intangible(): boolean {
    return this.under !== 'no';
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    this.prey = target;
    const goal = this.under !== 'no' ? 0 : 1;
    this.fade += (goal - this.fade) * Math.min(1, dt / 90);
    super.update(dt, target, daylight);
    if (this.dead) return;
    const p = this.state === 'windup' || this.state === 'attack' ? 1 : 0;
    this.power += (p - this.power) * Math.min(1, dt / 250);
    this.dress();
    const fighting = this.state !== 'spawn' && this.state !== 'idle' && this.state !== 'wander' && this.state !== 'return';
    this.bossBar.update(dt, this.hp, this.stats.hp, fighting && this.state !== 'dying', this.enraged);
  }

  /** Its heart's glow and light, and the glints off its spines. */
  private dress(): void {
    const ry = snap(this.y);
    const cx = snap(this.x);
    const fade = (this.state === 'dying' ? Math.max(0, this.timer / 380) : this.state === 'spawn' ? 1 - this.timer / 700 : 1) * this.fade;
    const beat = 0.9 + Math.max(0, Math.sin(this.phase * 0.005)) ** 6 * 0.25;
    const dir = this.facing === 'r' ? 1 : -1;
    this.halo.setPosition(cx + dir * 22, ry - HEART_Y).setDepth(ry - 0.2).setScale((2.6 + this.power * 0.6) * beat, (2.2 + this.power * 0.4) * beat).setAlpha((0.2 + this.power * 0.16) * fade);
    this.light.setPosition(this.x + dir * 22, this.y - HEART_Y + 8);
    this.light.intensity = (1.2 + this.power * 0.8 + (this.enraged ? 0.35 : 0)) * beat * Math.max(0.15, fade);
    this.light.radius = 180 + this.power * 40;
    this.motes.setPosition(cx, ry).setDepth(ry + 0.4);
    this.motes.emitting = fade > 0.3;
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.cooldown === 0) {
      this.skill = ORDER[this.turn % ORDER.length];
      // A hero keeping far off is breathed on or hunted, never quaked at.
      if (this.skill === 'quake' && dist > 150) this.skill = 'burrow';
      this.turn++;
      this.begin(target);
      return;
    }
    // Shift on its coil over the dais, leaning toward the hero.
    const gx = WYRM_HOME.x + Phaser.Math.Clamp((target.x - WYRM_HOME.x) * 0.3, -HEART.rx * 0.25, HEART.rx * 0.25);
    const gy = WYRM_HOME.y + Phaser.Math.Clamp((target.y - WYRM_HOME.y) * 0.3, -HEART.ry * 0.25, HEART.ry * 0.25);
    const dx = gx - this.x;
    const dy = gy - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 6) {
      this.x += (dx / d) * this.stats.speed * (dt / 1000);
      this.y += (dy / d) * this.stats.speed * (dt / 1000);
    }
    this.play('idle');
  }

  private begin(target: Target): void {
    this.face(target.x - this.x);
    const quick = this.enraged ? 0.76 : 1;
    if (this.skill === 'breath') {
      this.enter('windup', REAR_TIME * quick);
      this.pose('rear');
      this.aim(target);
      this.lane = laneMark(this.world, this.x, this.y, 5, 0xb37aff);
      sound.swell(this.world.pan(this.x));
    } else if (this.skill === 'quake') {
      this.enter('windup', QUAKE_TIME * quick);
      this.pose('rear');
      sound.swell(this.world.pan(this.x));
    } else {
      this.enter('windup', DIVE_TIME * quick);
      this.pose('dive');
      sound.thud(this.world.pan(this.x), true);
    }
  }

  /** Where its jaws are, on the floor below them. */
  private get mouth(): { x: number; y: number } {
    return { x: this.x + (this.facing === 'r' ? MOUTH_X : -MOUTH_X), y: this.y + 4 };
  }

  /** Point the breath at the hero; it can only breathe the way it faces. */
  private aim(target: Target): void {
    this.face(target.x - this.x);
    const m = this.mouth;
    let dx = target.x - m.x;
    const dy = target.y - m.y;
    if ((this.facing === 'r') !== dx >= 0) dx = 0;
    const l = Math.hypot(dx, dy) || 1;
    this.ux = dx / l;
    this.uy = dy / l;
    if (Math.abs(this.ux) < 0.35) {
      // Too steep for its neck: breathe as steeply as it can.
      this.ux = this.facing === 'r' ? 0.35 : -0.35;
      this.uy = Math.sign(this.uy || 1) * Math.sqrt(1 - 0.35 * 0.35);
    }
    this.len = Math.max(60, clearRun(this.world, m.x, m.y, this.ux, this.uy, BREATH_LEN));
  }

  protected act(dt: number, target: Target | null): void {
    if (!target && this.under === 'no' && this.state !== 'attack') {
      this.onInterrupted();
      this.enter('return', 0);
      return;
    }
    if (this.skill === 'breath') this.actBreath(dt, target);
    else if (this.skill === 'quake') this.actQuake(dt);
    else this.actBurrow(dt, target);
  }

  private actBreath(dt: number, target: Target | null): void {
    const m = this.mouth;
    if (this.state === 'windup') {
      const total = REAR_TIME * (this.enraged ? 0.76 : 1);
      const t = 1 - this.timer / total;
      if (target && t < 0.65) this.aim(target);
      this.lane?.setPosition(m.x, m.y).setRotation(Math.atan2(this.uy, this.ux)).setScale(this.len / LANE_W, 5).setAlpha(0.2 + t * 0.55 + Math.sin(this.phase * 0.03) * 0.06);
      if (Math.random() < dt / 45) this.world.debris(WYRM_TINTS, m.x + (Math.random() - 0.5) * 20, this.y - MOUTH_Y - 10 + Math.random() * 20, 1, this.y + 1, 'gather');
      if (this.timer <= 0) {
        this.pose('breath');
        this.shardT = 0;
        this.enter('attack', BREATH_TIME);
        sound.forcePush(this.world.pan(this.x), true);
        this.world.cameras.main.shake(BREATH_TIME, 0.0012);
      }
      return;
    }
    if (this.state === 'attack') {
      this.lane?.setAlpha(0.5 * Math.max(0, this.timer / BREATH_TIME));
      this.shardT -= dt;
      while (this.shardT <= 0 && this.timer > 0) {
        this.shardT += this.enraged ? 42 : 55;
        const spread = (Math.random() - 0.5) * 0.36;
        const a = Math.atan2(this.uy, this.ux) + spread;
        this.world.addEffect(new BreathShard(this.world, m.x, m.y, Math.cos(a), Math.sin(a), this.len, mobHit('wyrm', this.enraged ? 0.42 : 0.35)));
      }
      if (this.timer <= 0) {
        // Crystals burst up along the path it breathed.
        const n = Math.max(2, Math.floor(this.len / 46));
        for (let k = 1; k <= n; k++) {
          const d = (k / n) * this.len;
          const x = m.x + this.ux * d;
          const y = m.y + this.uy * d;
          if (this.world.walkable(x, y)) this.world.addEffect(new CrystalSpike(this.world, x, y, 420 + k * 80, 14, 1600, 1.1));
        }
        this.clear();
        this.rest();
      }
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private actQuake(dt: number): void {
    if (this.state === 'windup') {
      if (Math.random() < dt / 35) {
        const a = Math.random() * Math.PI * 2;
        this.world.debris(WYRM_TINTS, this.x + Math.cos(a) * 60, this.y + Math.sin(a) * 36, 1, this.y + 1, 'gather');
      }
      if (this.timer <= 0) {
        this.pose('slam');
        this.enter('attack', 700);
        this.quake();
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) this.rest();
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** Spokes of crystal, ring after ring outward from where its head struck. */
  private quake(): void {
    const w = this.world;
    const cx = this.x + (this.facing === 'r' ? SLAM_X : -SLAM_X) * 0.5;
    const cy = this.y + 6;
    w.hurtHeroInEllipse(cx, cy, 40, 24, { damage: mobHit('wyrm', 0.75), fromX: cx, fromY: cy, knock: 260 });
    w.debris(WYRM_TINTS, snap(cx), snap(cy) - 4, 30, cy + 2);
    w.cameras.main.shake(260, 0.004);
    sound.slam(w.pan(this.x));
    const spokes = this.enraged ? 11 : 8;
    const a0 = Math.random() * Math.PI * 2;
    for (let s = 0; s < spokes; s++) {
      const a = a0 + (s / spokes) * Math.PI * 2;
      for (let r = 1; r <= 6; r++) {
        const x = cx + Math.cos(a) * (28 + r * SPOKE_STEP);
        const y = cy + Math.sin(a) * (28 + r * SPOKE_STEP) * 0.62;
        if (!w.walkable(x, y)) break;
        w.addEffect(new CrystalSpike(w, x, y, 260 + r * 120, 18, 900, 1));
      }
    }
  }

  private actBurrow(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (Math.random() < dt / 30) w.debris(WYRM_TINTS, this.x + (Math.random() - 0.5) * 70, this.y, 1, this.y + 1, 'spores');
      if (this.timer <= 0) {
        // Under the floor it goes.
        this.under = 'hunt';
        this.underT = UNDER_TIME * (this.enraged ? 0.8 : 1);
        this.enter('attack', 99999);
        w.debris(WYRM_TINTS, snap(this.x), snap(this.y) - 4, 26, this.y + 2);
        w.cameras.main.shake(200, 0.003);
        sound.slam(w.pan(this.x));
        this.mark = w.add.image(this.x, this.y, 'danger_ring').setTint(0xb37aff).setDepth(2).setScale(RISE_RX / 22, RISE_RY / 12).setAlpha(0.3);
        this.markFill = w.add.image(this.x, this.y, 'danger_ring').setTint(0xe0c8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(2).setScale(0).setAlpha(0.3);
      }
      return;
    }
    if (this.state === 'attack' && this.under !== 'no') {
      this.underT -= dt;
      if (this.under === 'hunt') {
        const prey = target ?? this.prey;
        if (prey) {
          const dx = prey.x - this.x;
          const dy = prey.y - this.y;
          const d = Math.hypot(dx, dy);
          const s = Math.min(d, (135 * dt) / 1000);
          const nx = this.x + (dx / (d || 1)) * s;
          const ny = this.y + (dy / (d || 1)) * s;
          if (inHeart(nx, ny, 30)) {
            this.x = nx;
            this.y = ny;
          }
        }
        if (Math.random() < dt / 25) w.debris(WYRM_TINTS, this.x + (Math.random() - 0.5) * 40, this.y + (Math.random() - 0.5) * 16, 1, this.y + 1, 'spores');
        if (Math.random() < dt / 400) w.cameras.main.shake(120, 0.0015);
        if (this.underT <= 0) {
          this.under = 'rise';
          this.underT = RISE_TIME;
          sound.swell(w.pan(this.x));
        }
      } else {
        const k = 1 - this.underT / RISE_TIME;
        this.markFill?.setScale((RISE_RX / 22) * k, (RISE_RY / 12) * k).setAlpha(0.25 + k * 0.35);
        if (Math.random() < dt / 20) w.debris(WYRM_TINTS, this.x + (Math.random() - 0.5) * 60, this.y + (Math.random() - 0.5) * 24, 1, this.y + 1, 'spores');
        if (this.underT <= 0) this.rise();
      }
      this.mark?.setPosition(snap(this.x), snap(this.y)).setAlpha(this.under === 'rise' ? 0.85 : 0.35 + Math.sin(this.phase * 0.02) * 0.1);
      this.markFill?.setPosition(snap(this.x), snap(this.y));
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) this.rest();
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** It bursts up out of the floor where the mark stood. */
  private rise(): void {
    const w = this.world;
    this.under = 'no';
    this.fade = 1;
    this.clear();
    this.pose('slam');
    this.enter('attack', 600);
    w.hurtHeroInEllipse(this.x, this.y, RISE_RX, RISE_RY, { damage: mobHit('wyrm', this.enraged ? 1.15 : 1), fromX: this.x, fromY: this.y, knock: 300 });
    w.debris(WYRM_TINTS, snap(this.x), snap(this.y) - 10, 36, this.y + 2);
    w.cameras.main.shake(300, 0.005);
    sound.slam(w.pan(this.x));
    if (this.enraged) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const x = this.x + Math.cos(a) * 52;
        const y = this.y + Math.sin(a) * 32;
        if (w.walkable(x, y)) w.addEffect(new CrystalSpike(w, x, y, 450, 16, 1100, 1));
      }
    }
  }

  /** The power is spent: a breather, the one safe window to strike hard. */
  private rest(): void {
    this.enter('recover', this.enraged ? 950 : RECOVER);
    this.play('idle', true);
    this.cooldown = (this.enraged ? 800 : 1300) + Math.random() * 700;
  }

  private clear(): void {
    this.lane?.destroy();
    this.lane = null;
    this.mark?.destroy();
    this.mark = null;
    this.markFill?.destroy();
    this.markFill = null;
  }

  protected afterHit(): void {
    if (!this.enraged && this.alive && this.hp < this.stats.hp / 2) {
      this.enraged = true;
      this.halo.setTint(0xe0c0ff);
      this.light.setColor(0xd8b8ff);
      this.motes.frequency = 60;
      this.world.popNumber(snap(this.x), snap(this.y) - 140, 'SHATTERED FURY', 0xead8ff);
      this.world.debris(WYRM_TINTS, snap(this.x), snap(this.y - HEART_Y), 36, this.y + 40, 'spores');
      this.world.cameras.main.shake(260, 0.003);
      sound.shatter(this.world.pan(this.x), true);
    }
  }

  /** Reared up to its full height, crystal spines bristling. */
  protected flourish(): void {
    this.pose('rear');
  }

  protected staggers(): boolean {
    return false;
  }

  protected onDeath(): void {
    const w = this.world;
    for (let i = 0; i < 7; i++) {
      w.time.delayedCall(i * 130, () => w.debris(WYRM_TINTS, snap(this.x + (Math.random() - 0.5) * 90), snap(this.y - 10 - Math.random() * 100), 28, this.y + 40, i % 2 ? 'spores' : 'burst'));
    }
    w.time.delayedCall(350, () => sound.shatter(w.pan(this.x), true));
    w.cameras.main.flash(420, 220, 190, 255);
    w.cameras.main.shake(520, 0.005);
    w.popNumber(snap(this.x), snap(this.y) - 140, 'SHATTERED', 0xead8ff);
    sound.nova();
  }

  protected onInterrupted(): void {
    this.clear();
    if (this.under !== 'no') {
      this.under = 'no';
      this.fade = 1;
    }
  }

  destroy(): void {
    if (this.dead) return;
    super.destroy();
    this.bossBar.destroy();
    this.halo.destroy();
    this.motes.destroy();
    this.world.lights.removeLight(this.light);
  }
}
