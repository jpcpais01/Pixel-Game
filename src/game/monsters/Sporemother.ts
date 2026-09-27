import Phaser from 'phaser';
import { SPOREMOTHER_TINTS } from '../../art/sporemother';
import { SPORE_TINTS } from '../../art/deepMonsters';
import { snap } from '../display';
import { sound } from '../../audio';
import { BossBar } from '../BossBar';
import type { Effect } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';
import { HOLLOW, SPOREMOTHER_HOME } from '../../world/deepLayout';
import { MAGENTA, Puffball, SporeCloud } from './Deep';
import { Monster, type Target } from './Monster';

/** The glowing heart under her cap, above her feet. */
const HEART_Y = 58;

// Spore Bloom: she lifts her tendrils and puffballs swell out of the floor
// round the hero, one right under them, each bursting into a spore cloud.
const BLOOM_TIME = 950;
const BLOOM_GROW = 950;

// Creeping Roots: she sinks her roots into the floor and runners of glowing
// mycelium creep after the hero, each bursting up into a cluster of caps.
const ROOT_TIME = 800;
const RUNNER_SPEED = 92;
const RUNNER_LIFE = 1700;
const RUNNER_RX = 17;
const RUNNER_RY = 10;
const RECOVER = 1300;

type Skill = 'bloom' | 'roots';

/**
 * A runner of mycelium creeping under the floor after the hero: a glowing
 * seam with a ring over it, slowly turning to follow. When it has crept its
 * fill it stops, the ring brightens, and caps burst up out of the floor.
 */
class Runner implements Effect {
  dead = false;
  private t = 0;
  private ux: number;
  private uy: number;
  private seam: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;
  private caps: Phaser.GameObjects.Image | null = null;
  private capsGlow: Phaser.GameObjects.Image | null = null;
  private burstAt = 0;
  private trail = 0;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    angle: number,
    private damage: number,
    private life: number,
    /** Who it creeps after (the player the Sporemother is hunting). */
    private prey: () => Target | null,
  ) {
    this.ux = Math.cos(angle);
    this.uy = Math.sin(angle);
    this.seam = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(MAGENTA).setScale(0.45, 0.25).setDepth(2.3).setAlpha(0);
    this.ring = world.add.image(x, y, 'danger_ring').setTint(0xff6ad8).setScale(RUNNER_RX / 22, RUNNER_RY / 12).setDepth(2).setAlpha(0);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const w = this.world;
    if (this.burstAt === 0) {
      // Creep on, turning a little toward the hero each moment.
      const creep = this.t < this.life;
      if (creep) {
        const prey = this.prey();
        let a = Math.atan2(this.uy, this.ux);
        if (prey) {
          const turn = Phaser.Math.Angle.Wrap(Math.atan2(prey.y - this.y, prey.x - this.x) - a);
          a += Phaser.Math.Clamp(turn, -0.0022 * dt, 0.0022 * dt);
        }
        const s = (RUNNER_SPEED * dt) / 1000;
        const nx = this.x + Math.cos(a) * s;
        const ny = this.y + Math.sin(a) * s;
        if (w.walkable(nx, ny)) {
          this.x = nx;
          this.y = ny;
        }
        this.ux = Math.cos(a);
        this.uy = Math.sin(a);
        this.trail -= dt;
        if (this.trail <= 0) {
          this.trail = 45;
          w.debris(SPORE_TINTS, this.x + (Math.random() - 0.5) * 6, this.y - 1, 1, 2.4, 'spores');
        }
      }
      const k = Math.min(1, this.t / this.life);
      this.seam.setPosition(snap(this.x), snap(this.y)).setAlpha(0.5 + Math.sin(this.t * 0.03) * 0.15);
      this.ring.setPosition(snap(this.x), snap(this.y)).setAlpha(0.25 + k * 0.4 + (creep ? 0 : 0.2));
      // A last moment standing still, so it can be stepped away from.
      if (this.t >= this.life + 380) this.burst();
      return;
    }
    const a = this.t - this.burstAt;
    const pop = a < 100 ? a / 100 : 1;
    const sink = Math.max(0, (a - 900) / 300);
    const h = Math.max(0, pop - sink);
    this.caps?.setScale(1, h).setAlpha(1 - sink);
    this.capsGlow?.setScale(1, h).setAlpha(1 - sink);
    this.seam.setAlpha(Math.max(0, 0.9 - a / 300)).setScale(0.6 + a / 400, 0.4 + a / 700);
    if (sink >= 1) this.destroy();
  }

  private burst(): void {
    const w = this.world;
    this.burstAt = this.t;
    this.ring.setVisible(false);
    const flip = Math.random() < 0.5;
    const v = Math.random() < 0.5 ? 'c0' : 'c1';
    this.caps = w.add.image(snap(this.x), snap(this.y) + 1, 'gd_caps', v).setOrigin(0.5, 16 / 18).setPipeline('Lit').setDepth(this.y).setFlipX(flip).setScale(1, 0);
    this.capsGlow = w.add.image(snap(this.x), snap(this.y) + 1, 'gd_caps_e', v).setOrigin(0.5, 16 / 18).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.y + 0.1).setFlipX(flip).setScale(1, 0);
    w.hurtHeroInEllipse(this.x, this.y, RUNNER_RX, RUNNER_RY, { damage: this.damage, fromX: this.x, fromY: this.y + 3, knock: 170 });
    w.debris(SPORE_TINTS, snap(this.x), snap(this.y) - 4, 12, this.y + 2);
    sound.puff(w.pan(this.x));
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.seam, this.ring, this.caps, this.capsGlow]) o?.destroy();
  }
}

/**
 * The Sporemother, the Glimmerdeep's Legend: a veiled mushroom twice a
 * hero's height, her honeycomb cap glowing pink and cyan, her lace veil
 * trailing to the floor. She glides on her roots over the fairy ring of
 * the Mycelium Hollow and trades two spells with a breather after each:
 *   - Spore Bloom: puffballs swell out of the floor round the hero and burst, leaving spore clouds.
 *   - Creeping Roots: runners of mycelium creep after the hero and burst up into caps.
 * Below half health she is in full bloom: more puffballs, more runners, quicker.
 * She can't be staggered or shoved.
 */
export class Sporemother extends Monster {
  private skill: Skill = 'bloom';
  private last: Skill = 'roots';
  private phase = Math.random() * 1000;
  private enraged = false;
  private bossBar: BossBar;
  private halo: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private power = 0;
  private prey: Target | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'sporemother',
      hp: 1400,
      radius: 16,
      bodyY: 34,
      speed: 18,
      sight: 150,
      leash: 100000,
      mass: 30,
      barY: 100,
      debris: SPOREMOTHER_TINTS,
      noBar: true,
      rank: 'legend',
    });
    this.cooldown = 1400;
    this.bossBar = new BossBar(world, 'The Sporemother');
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(MAGENTA).setAlpha(0.3);
    this.light = world.lights.addLight(x, y - HEART_Y, 150, 0xff78e0, 1.1);
    // Spores forever drifting down off her cap.
    this.motes = world.add.particles(0, 0, 'spark', {
      lifespan: { min: 1400, max: 2600 },
      speedY: { min: 4, max: 14 },
      speedX: { min: -7, max: 7 },
      scale: 0.45,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.85 },
      tint: SPORE_TINTS,
      blendMode: Phaser.BlendModes.ADD,
      frequency: 110,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-34, -78, 68, 30) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    });
  }

  get pinned(): boolean {
    return true;
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    this.prey = target;
    super.update(dt, target, daylight);
    if (this.dead) return;
    const goal = this.state === 'windup' || this.state === 'attack' ? 1 : 0;
    this.power += (goal - this.power) * Math.min(1, dt / 250);
    this.dress();
    const fighting = this.state !== 'spawn' && this.state !== 'idle' && this.state !== 'wander' && this.state !== 'return';
    this.bossBar.update(dt, this.hp, this.stats.hp, fighting && this.state !== 'dying', this.enraged);
  }

  /** Her glow, light and falling spores. */
  private dress(): void {
    const ry = snap(this.y);
    const cx = snap(this.x);
    const fade = this.state === 'dying' ? Math.max(0, this.timer / 380) : this.state === 'spawn' ? 1 - this.timer / 700 : 1;
    const pulse = 0.9 + Math.sin(this.phase * 0.0032) * 0.1;
    this.halo.setPosition(cx, ry - HEART_Y).setDepth(ry - 0.2).setScale((2.2 + this.power * 0.6) * pulse, (1.6 + this.power * 0.4) * pulse).setAlpha((0.22 + this.power * 0.18) * fade);
    this.light.setPosition(this.x, this.y - HEART_Y + 10);
    this.light.intensity = (1.1 + this.power * 0.8 + (this.enraged ? 0.3 : 0)) * pulse * fade;
    this.light.radius = 150 + this.power * 40;
    this.motes.setPosition(cx, ry).setDepth(ry + 0.4);
    this.motes.emitting = fade > 0.3;
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.cooldown === 0) {
      // Alternate the two; a hero standing far off gets the runners.
      this.skill = this.last === 'bloom' || dist > 130 ? 'roots' : 'bloom';
      this.begin(target);
      return;
    }
    // Glide over the fairy ring, leaning toward the hero.
    const gx = SPOREMOTHER_HOME.x + Phaser.Math.Clamp((target.x - SPOREMOTHER_HOME.x) * 0.35, -HOLLOW.rx * 0.3, HOLLOW.rx * 0.3);
    const gy = SPOREMOTHER_HOME.y + Phaser.Math.Clamp((target.y - SPOREMOTHER_HOME.y) * 0.35, -HOLLOW.ry * 0.3, HOLLOW.ry * 0.3);
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
    this.last = this.skill;
    this.face(target.x - this.x);
    if (this.skill === 'bloom') {
      this.enter('windup', this.enraged ? 760 : BLOOM_TIME);
      this.play('cast', true);
    } else {
      this.enter('windup', this.enraged ? 620 : ROOT_TIME);
      this.play('plunge', true);
    }
    sound.swell(this.world.pan(this.x));
  }

  protected act(dt: number, target: Target | null): void {
    if (!target) {
      this.enter('return', 0);
      return;
    }
    if (this.state === 'windup') {
      // Spores gather under her cap, or the floor stirs round her roots.
      if (Math.random() < dt / 40) {
        if (this.skill === 'bloom') this.world.debris(SPORE_TINTS, this.x + (Math.random() - 0.5) * 60, this.y - HEART_Y + (Math.random() - 0.5) * 24, 1, this.y + 1, 'gather');
        else this.world.debris(SPORE_TINTS, this.x + (Math.random() - 0.5) * 50, this.y - 1, 1, this.y + 1, 'spores');
      }
      if (this.timer <= 0) {
        if (this.skill === 'bloom') this.bloom(target);
        else this.roots(target);
        this.enter('attack', 650);
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) this.rest();
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** Puffballs, the first right under the hero, the rest round them. */
  private bloom(target: Target): void {
    const w = this.world;
    const n = this.enraged ? 9 : 6;
    let placed = 0;
    for (let tries = 0; placed < n && tries < n * 4; tries++) {
      let x = target.x;
      let y = target.y;
      if (placed > 0) {
        const a = Math.random() * Math.PI * 2;
        const r = 26 + Math.random() * 54;
        x += Math.cos(a) * r;
        y += Math.sin(a) * r * 0.7;
        if (!w.walkable(x, y)) continue;
      }
      w.addEffect(
        new Puffball(w, x, y, {
          delay: placed * 90,
          grow: this.enraged ? 800 : BLOOM_GROW,
          damage: this.enraged ? 16 : 14,
          rx: 17,
          ry: 10,
          cloud: this.enraged ? 2800 : 2300,
          cloudDamage: 3,
        }),
      );
      placed++;
    }
    w.debris(SPOREMOTHER_TINTS, snap(this.x), snap(this.y - HEART_Y), 22, this.y + 2, 'burst');
    w.cameras.main.shake(140, 0.0014);
    sound.puff(w.pan(this.x));
  }

  /** Runners fan out from her roots toward the hero. */
  private roots(target: Target): void {
    const w = this.world;
    const n = this.enraged ? 5 : 3;
    const aim = Math.atan2(target.y - this.y, target.x - this.x);
    for (let k = 0; k < n; k++) {
      const a = aim + (k - (n - 1) / 2) * 0.55;
      const sx = this.x + Math.cos(a) * 20;
      const sy = this.y + Math.sin(a) * 12;
      w.addEffect(new Runner(w, sx, sy, a, this.enraged ? 19 : 16, RUNNER_LIFE + (k % 2) * 250, () => this.prey));
    }
    w.debris(SPORE_TINTS, snap(this.x), snap(this.y) - 2, 20, this.y + 2, 'spores');
    w.cameras.main.shake(160, 0.0018);
    sound.thud(w.pan(this.x), true);
  }

  /** The spell is spent: a breather, the one safe window to strike hard. */
  private rest(): void {
    this.enter('recover', this.enraged ? 900 : RECOVER);
    this.play('idle', true);
    this.cooldown = (this.enraged ? 700 : 1200) + Math.random() * 700;
  }

  protected afterHit(): void {
    if (!this.enraged && this.alive && this.hp < this.stats.hp / 2) {
      this.enraged = true;
      this.halo.setTint(0xffa8f0);
      this.light.setColor(0xff9aea);
      this.motes.frequency = 55;
      this.world.popNumber(snap(this.x), snap(this.y) - 104, 'IN FULL BLOOM', 0xffc8f4);
      this.world.debris(SPORE_TINTS, snap(this.x), snap(this.y - HEART_Y), 30, this.y + 40, 'spores');
      // Her anger blooms all round her.
      this.world.addEffect(new SporeCloud(this.world, this.x, this.y + 4, 3000, 40, 3));
      this.world.cameras.main.shake(220, 0.0025);
      sound.swell(this.world.pan(this.x));
    }
  }

  protected staggers(): boolean {
    return false;
  }

  protected onDeath(): void {
    const w = this.world;
    for (let i = 0; i < 5; i++) {
      w.time.delayedCall(i * 150, () => w.debris(SPOREMOTHER_TINTS, snap(this.x + (Math.random() - 0.5) * 50), snap(this.y - 10 - Math.random() * 70), 26, this.y + 40, 'spores'));
    }
    w.cameras.main.flash(380, 255, 150, 230);
    w.cameras.main.shake(400, 0.0035);
    w.popNumber(snap(this.x), snap(this.y) - 104, 'WILTED', 0xffc8f4);
    sound.nova();
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
