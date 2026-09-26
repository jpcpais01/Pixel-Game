import Phaser from 'phaser';
import { ELEMENTINHO_TINTS } from '../../art/elementinho';
import { ELEMENT_LIGHT } from '../../art/elementals';
import { LANE_W } from '../../art/spirit';
import { snap } from '../display';
import { sound } from '../../audio';
import { BossBar } from '../BossBar';
import type { Hit } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { ELEMENTINHO_HOME, HEART, inHeart } from '../../world/templeLayout';
import { Blaze, Lob } from './Elementals';
import { Monster, type Target } from './Monster';

const HOVER = 6;
/** Its white-hot heart's height above its feet, in the frame (before hovering). */
const CORE_Y = 24;
/** The tip of its flame, above its feet. */
const TIP_Y = 84;

// Ember Rain: it swells, its tip flaring, and flings burning drops high
// into the air that rain down round the hero, each landing on a marked spot
// and leaving the floor there burning.
const RAIN_TIME = 950;
const DROP_FLIGHT = 880;
const DROP_GAP = 110;

// Blazing Surge: it squashes down, glaring along a burning lane toward the
// hero, and shoots along it like a comet, leaving a trail of fire.
const SQUASH_TIME = 820;
const SURGE_SPEED = 330;
const SURGE_RX = 18;
const SURGE_RY = 12;
const TRAIL_GAP = 26;
const RECOVER = 1300;

type Skill = 'rain' | 'surge';

/**
 * Elementinho, the Elementinho Temple's Legend: a drop of water twice a
 * hero's height, made all of fire, burning over the flame sigil in the
 * Heart of the Temple with an orb of each element circling it. It trades
 * two spells with a breather after each:
 *   - Ember Rain: burning drops rain down on marked spots round the hero, and the floor burns where they land.
 *   - Blazing Surge: it shoots along a marked lane like a comet, leaving a trail of fire.
 * Below half health it burns white-hot: more drops, a second surge, and quicker.
 * It can't be staggered or shoved.
 */
export class Elementinho extends Monster {
  private skill: Skill = 'rain';
  private last: Skill = 'surge';
  private phase = Math.random() * 1000;
  private enraged = false;
  private bossBar: BossBar;
  private halo: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private orbs: Phaser.GameObjects.Image[];
  private power = 0;
  // The surge: its lane, where it heads, how far it has gone, and how many more to go.
  private lane: Phaser.GameObjects.Image | null = null;
  private ux = 0;
  private uy = 0;
  private len = 0;
  private gone = 0;
  private trailAt = 0;
  private surges = 0;
  private struck = false;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'elementinho',
      hp: 1300,
      radius: 16,
      bodyY: 30,
      speed: 22,
      sight: 160,
      leash: 100000,
      mass: 30,
      barY: 100,
      debris: ELEMENTINHO_TINTS,
      noBar: true,
      rank: 'legend',
    });
    this.hover = HOVER;
    this.cooldown = 1400;
    this.bossBar = new BossBar(world, 'Elementinho');
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff8a2a).setAlpha(0.4);
    this.light = world.lights.addLight(x, y - CORE_Y, 150, 0xff8a2a, 1.2);
    // Embers always rising off it.
    this.motes = world.add.particles(0, 0, 'spark', {
      lifespan: { min: 700, max: 1400 },
      speedY: { min: -40, max: -16 },
      speedX: { min: -8, max: 8 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.9 },
      tint: ELEMENTINHO_TINTS,
      blendMode: Phaser.BlendModes.ADD,
      frequency: 70,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-18, -80, 36, 60) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    });
    // An orb of each element circling it.
    this.orbs = (['water', 'earth', 'air', 'fire'] as const).map((el) => world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(ELEMENT_LIGHT[el]).setScale(0.3));
  }

  get pinned(): boolean {
    return true;
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    const surging = this.skill === 'surge' && this.state === 'attack';
    this.hover = HOVER + (surging ? 0 : Math.sin(this.phase * 0.0021) * 2.5);
    super.update(dt, target, daylight);
    if (this.dead) return;
    const goal = this.state === 'windup' || this.state === 'attack' ? 1 : 0;
    this.power += (goal - this.power) * Math.min(1, dt / 250);
    this.dress();
    const fighting = this.state !== 'spawn' && this.state !== 'idle' && this.state !== 'wander' && this.state !== 'return';
    this.bossBar.update(dt, this.hp, this.stats.hp, fighting && this.state !== 'dying', this.enraged);
  }

  /** Its halo, light, embers and the orbs circling it. */
  private dress(): void {
    const ry = snap(this.y);
    const cx = snap(this.x);
    const cy = snap(this.y - this.hover - CORE_Y);
    const fade = this.state === 'dying' ? Math.max(0, this.timer / 380) : this.state === 'spawn' ? 1 - this.timer / 700 : 1;
    const flick = 0.88 + Math.sin(this.phase * 0.013) * 0.07 + Math.sin(this.phase * 0.031) * 0.05;
    this.halo.setPosition(cx, cy - 10).setDepth(ry - 0.2).setScale((1.5 + this.power * 0.6) * flick, (2 + this.power * 0.6) * flick).setAlpha((0.28 + this.power * 0.2) * fade);
    this.light.setPosition(this.x, this.y - this.hover - 30);
    this.light.intensity = (1.2 + this.power * 0.9 + (this.enraged ? 0.3 : 0)) * flick * fade;
    this.light.radius = 150 + this.power * 40;
    this.motes.setPosition(cx, snap(this.y - this.hover)).setDepth(ry + 0.4);
    this.motes.emitting = fade > 0.3;
    const spin = this.phase * (this.enraged ? 0.0034 : 0.0022);
    this.orbs.forEach((o, k) => {
      const a = spin + (k * Math.PI) / 2;
      const front = Math.sin(a) > 0;
      o.setPosition(snap(this.x + Math.cos(a) * 32), snap(this.y - this.hover - 38 + Math.sin(a) * 10))
        .setDepth(ry + (front ? 0.5 : -0.5))
        .setAlpha((front ? 0.9 : 0.5) * fade)
        .setScale((front ? 0.34 : 0.26) * (0.9 + Math.sin(this.phase * 0.01 + k) * 0.1));
    });
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.cooldown === 0) {
      // Alternate the two spells; a hero keeping far away brings on the rain.
      this.skill = this.last === 'rain' && dist < 170 ? 'surge' : 'rain';
      this.begin(target);
      return;
    }
    // Drift over the sigil, leaning toward the hero.
    const gx = ELEMENTINHO_HOME.x + Phaser.Math.Clamp((target.x - ELEMENTINHO_HOME.x) * 0.35, -HEART.rx * 0.3, HEART.rx * 0.3);
    const gy = ELEMENTINHO_HOME.y + Phaser.Math.Clamp((target.y - ELEMENTINHO_HOME.y) * 0.35, -HEART.ry * 0.3, HEART.ry * 0.3);
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
    if (this.skill === 'rain') {
      this.enter('windup', this.enraged ? 720 : RAIN_TIME);
      this.play('cast', true);
      sound.ignite();
      return;
    }
    this.surges = this.enraged ? 2 : 1;
    this.squash(target);
  }

  /** Crouch into the next surge, its lane burning on the floor. */
  private squash(target: Target): void {
    this.enter('windup', this.enraged ? 600 : SQUASH_TIME);
    this.play('squash', true);
    this.aim(target);
    this.lane?.destroy();
    this.lane = this.world.add.image(this.x, this.y, 'et_lane').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff6a1a).setAlpha(0).setDepth(2.2);
    this.placeLane(0);
    sound.swell(this.world.pan(this.x));
  }

  /** Point the surge at the hero, running on past them to the Heart's wall. */
  private aim(target: Target): void {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const l = Math.hypot(dx, dy) || 1;
    this.ux = dx / l;
    this.uy = dy / l;
    this.face(dx);
    const want = l + 70;
    let len = 0;
    while (len < want && inHeart(this.x + this.ux * (len + 6), this.y + this.uy * (len + 6), 20)) len += 6;
    this.len = Math.max(30, len);
  }

  private placeLane(a: number): void {
    this.lane?.setPosition(this.x, this.y).setRotation(Math.atan2(this.uy, this.ux)).setScale(this.len / LANE_W, 3.4).setAlpha(a);
  }

  protected act(dt: number, target: Target | null): void {
    if (!target && !(this.skill === 'surge' && this.state === 'attack')) {
      this.onInterrupted();
      this.enter('return', 0);
      return;
    }
    if (this.skill === 'rain') this.actRain(dt, target);
    else this.actSurge(dt, target);
  }

  private actRain(dt: number, target: Target | null): void {
    if (this.state === 'windup') {
      // Embers gather at its tip as it swells.
      if (Math.random() < dt / 40) this.world.debris(ELEMENTINHO_TINTS, this.x + (Math.random() - 0.5) * 20, this.y - this.hover - TIP_Y + Math.random() * 14, 1, this.y + 1, 'gather');
      if (this.timer <= 0 && target) {
        this.rain(target);
        this.pose('spit');
        this.enter('attack', 700);
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) this.rest();
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** Burning drops, the first right on the hero, the rest scattered round them. */
  private rain(target: Target): void {
    const w = this.world;
    const n = this.enraged ? 9 : 6;
    const damage = this.enraged ? 16 : 14;
    const sx = this.x;
    const sy = this.y;
    let placed = 0;
    for (let tries = 0; placed < n && tries < n * 4; tries++) {
      let ex = target.x;
      let ey = target.y;
      if (placed > 0) {
        const a = Math.random() * Math.PI * 2;
        const r = 24 + Math.random() * 52;
        ex += Math.cos(a) * r;
        ey += Math.sin(a) * r * 0.7;
        if (!w.walkable(ex, ey)) continue;
      }
      w.addEffect(
        new Lob(w, {
          sx,
          sy,
          lift: this.hover + TIP_Y,
          ex,
          ey,
          flight: DROP_FLIGHT,
          delay: placed * DROP_GAP,
          arc: 70,
          texture: 'et_ember',
          rx: 14,
          ry: 9,
          damage,
          knock: 120,
          tints: ELEMENTINHO_TINTS,
          ringTint: 0xff7a1a,
          onLand: (x, y) => w.addEffect(new Blaze(w, x, y, this.enraged ? 2600 : 2100, 4)),
        }),
      );
      placed++;
    }
    w.debris(ELEMENTINHO_TINTS, snap(this.x), snap(this.y - this.hover - TIP_Y), 24, this.y + 2, 'burst');
    w.cameras.main.shake(160, 0.0016);
    sound.spit(w.pan(this.x));
  }

  private actSurge(dt: number, target: Target | null): void {
    if (this.state === 'windup') {
      const total = this.enraged ? 600 : SQUASH_TIME;
      const t = 1 - this.timer / total;
      // It aims until it has nearly sprung, then commits.
      if (target && t < 0.65) this.aim(target);
      this.placeLane(0.2 + t * 0.55 + Math.sin(this.phase * 0.03) * 0.08);
      if (Math.random() < dt / 50) this.world.debris(ELEMENTINHO_TINTS, this.x + (Math.random() - 0.5) * 36, this.y - 2, 1, this.y + 1, 'spores');
      if (this.timer <= 0) {
        this.gone = 0;
        this.trailAt = 0;
        this.struck = false;
        this.enter('attack', 99999);
        this.play('surge', true);
        sound.forcePush(this.world.pan(this.x));
      }
      return;
    }
    if (this.state === 'attack') {
      const s = Math.min((SURGE_SPEED * dt) / 1000, this.len - this.gone);
      this.x += this.ux * s;
      this.y += this.uy * s;
      this.gone += s;
      this.lane?.setAlpha(0.7 * (1 - this.gone / this.len));
      const w = this.world;
      if (!this.struck) {
        this.struck = w.hurtHeroInEllipse(this.x, this.y, SURGE_RX, SURGE_RY, {
          damage: this.enraged ? 28 : 24,
          fromX: this.x - this.ux * 20,
          fromY: this.y - this.uy * 20,
          knock: 260,
        });
      }
      if (this.gone - this.trailAt >= TRAIL_GAP) {
        this.trailAt = this.gone;
        w.addEffect(new Blaze(w, this.x - this.ux * 8, this.y - this.uy * 8, this.enraged ? 2400 : 1800, 3, 0.9));
      }
      if (Math.random() < dt / 20) w.debris(ELEMENTINHO_TINTS, this.x - this.ux * 14 + (Math.random() - 0.5) * 20, this.y - 10 - Math.random() * 50, 2, this.y, 'trail');
      if (this.gone >= this.len - 0.5) {
        w.debris(ELEMENTINHO_TINTS, snap(this.x), snap(this.y) - 20, 22, this.y + 2);
        w.cameras.main.shake(140, 0.0022);
        sound.thud(w.pan(this.x), true);
        this.surges--;
        if (this.surges > 0 && target) {
          this.squash(target);
          this.timer = 380;
        } else {
          this.lane?.destroy();
          this.lane = null;
          this.rest();
        }
      }
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** The spell is spent: a breather, the one safe window to strike hard. */
  private rest(): void {
    this.enter('recover', this.enraged ? 900 : RECOVER);
    this.play('idle', true);
    this.cooldown = (this.enraged ? 800 : 1300) + Math.random() * 700;
  }

  hurt(hit: Hit): void {
    super.hurt(hit);
    if (!this.enraged && this.alive && this.hp < this.stats.hp / 2) {
      this.enraged = true;
      this.halo.setTint(0xffd070);
      this.light.setColor(0xffc060);
      this.motes.frequency = 40;
      this.world.popNumber(snap(this.x), snap(this.y) - 104, 'WHITE-HOT', 0xfff0b0);
      this.world.debris(ELEMENTINHO_TINTS, snap(this.x), snap(this.y - this.hover - CORE_Y), 30, this.y + 40, 'spores');
      this.world.cameras.main.shake(220, 0.0025);
      sound.ignite();
    }
  }

  protected staggers(): boolean {
    return false;
  }

  protected onDeath(): void {
    const w = this.world;
    for (let i = 0; i < 5; i++) {
      w.time.delayedCall(i * 140, () => w.debris(ELEMENTINHO_TINTS, snap(this.x + (Math.random() - 0.5) * 40), snap(this.y - 10 - Math.random() * 70), 26, this.y + 40, 'spores'));
    }
    // It goes out in a hiss of steam.
    w.time.delayedCall(300, () => w.debris([0xffffff, 0xe8e4e0, 0xc8c4c0], snap(this.x), snap(this.y - 40), 30, this.y + 40, 'spores'));
    w.cameras.main.flash(380, 255, 190, 110);
    w.cameras.main.shake(420, 0.004);
    w.popNumber(snap(this.x), snap(this.y) - 104, 'EXTINGUISHED', 0xffe0a0);
    sound.nova();
  }

  protected onInterrupted(): void {
    this.lane?.destroy();
    this.lane = null;
    this.surges = 0;
  }

  destroy(): void {
    if (this.dead) return;
    super.destroy();
    this.bossBar.destroy();
    this.halo.destroy();
    this.motes.destroy();
    for (const o of this.orbs) o.destroy();
    this.world.lights.removeLight(this.light);
  }
}
