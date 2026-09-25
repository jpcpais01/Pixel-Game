import Phaser from 'phaser';
import { QUEEN_TINTS } from '../../art/queen';
import { LANE_W } from '../../art/spirit';
import { snap } from '../display';
import { sound } from '../../audio';
import { BossBar } from '../BossBar';
import type { Effect } from '../Slash';
import type { Hit } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { QUEEN_HOME, SANCTUM, spiritFloor } from '../../world/spiritLayout';
import { Monster, type Target } from './Monster';

/** The soul-locket's height above her feet, in the frame (before hovering). */
const LOCKET_Y = 53;
const HOVER = 9;

// Grasp of the Drowned: she calls, and hands of the drowned dead claw up
// out of the floor in lines racing toward the hero, each marked a moment
// before it breaks the surface.
const CALL_TIME = 900;
const HAND_GAP = 20;
const HAND_STEP = 80;
const HAND_MARK = 620;
const HAND_RX = 11;
const HAND_RY = 7;
const LINE_LEN = 11;

// Phantom Rush: she shrieks and fades from sight, and echoes of her form
// round the hero, each showing the lane it will take before it rushes
// through. She forms again when the last has passed.
const SHRIEK_TIME = 750;
const FADE_TIME = 420;
const ECHO_MARK = 760;
const ECHO_SPEED = 330;
const ECHO_GAP = 300;
const ECHO_RING = 88;
const RECOVER = 1300;

type Skill = 'grasp' | 'rush';

/** One line of hands clawing up out of the floor, one after another. */
class GraspLine implements Effect {
  dead = false;
  private t = 0;
  private marks: { x: number; y: number; at: number; ring: Phaser.GameObjects.Image | null; up: boolean }[] = [];

  constructor(
    private world: WorldScene,
    x: number,
    y: number,
    ux: number,
    uy: number,
    private damage: number,
    mark: number,
  ) {
    for (let i = 0; i < LINE_LEN; i++) {
      const d = 18 + i * HAND_GAP;
      const hx = x + ux * d;
      const hy = y + uy * d * 0.8;
      // The line stops at the walls.
      if (!spiritFloor(hx, hy, 6)) break;
      this.marks.push({ x: hx, y: hy, at: i * HAND_STEP + mark, ring: null, up: false });
    }
    if (!this.marks.length) this.dead = true;
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    let live = false;
    for (const m of this.marks) {
      const shown = m.at - HAND_MARK;
      if (!m.up && this.t >= shown) {
        live = true;
        if (!m.ring) m.ring = this.world.add.image(snap(m.x), snap(m.y), 'danger_ring').setTint(0x6af4dc).setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3, 0.35).setAlpha(0);
        const k = Math.min(1, (this.t - shown) / HAND_MARK);
        m.ring.setAlpha(0.3 + k * 0.6 + Math.sin(this.t * 0.03) * 0.1).setScale(((HAND_RX / 22) * (0.5 + k * 0.5)), (HAND_RY / 12) * (0.5 + k * 0.5));
        if (this.t >= m.at) this.erupt(m);
      } else if (!m.up) live = true;
    }
    if (!live) this.destroy();
  }

  private erupt(m: { x: number; y: number; ring: Phaser.GameObjects.Image | null; up: boolean }): void {
    m.up = true;
    m.ring?.destroy();
    m.ring = null;
    const w = this.world;
    const hand = w.add.sprite(snap(m.x), snap(m.y) + 2, 'sd_hand_e', 'h0').setOrigin(0.5, 22 / 24).setBlendMode(Phaser.BlendModes.ADD).setDepth(m.y + 1).play('sd_hand_grasp');
    hand.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => hand.destroy());
    w.hurtHeroInEllipse(m.x, m.y, HAND_RX, HAND_RY, { damage: this.damage, fromX: m.x, fromY: m.y + 6, knock: 110 });
    w.debris(QUEEN_TINTS, snap(m.x), snap(m.y) - 4, 8, m.y + 2);
    sound.boneCrumble(w.pan(m.x));
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const m of this.marks) m.ring?.destroy();
  }
}

/** An echo of the Queen: it forms, shows its lane, rushes through, and fades. */
class Echo implements Effect {
  dead = false;
  private t = 0;
  private body: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private lane: Phaser.GameObjects.Image;
  private struck = false;
  private x: number;
  private y: number;
  private readonly len: number;
  private readonly dashTime: number;
  private trail = 0;

  constructor(
    private world: WorldScene,
    private sx: number,
    private sy: number,
    private ex: number,
    private ey: number,
    private delay: number,
    private damage: number,
  ) {
    this.x = sx;
    this.y = sy;
    this.len = Math.hypot(ex - sx, ey - sy);
    this.dashTime = (this.len / ECHO_SPEED) * 1000;
    const side = ex >= sx ? 'r' : 'l';
    const add = world.add;
    this.body = add.sprite(sx, sy, 'queen', `scream0_${side}`).setOrigin(0.5, 81 / 84).setPipeline('Lit').setAlpha(0).setTint(0xa8fff0);
    this.glow = add.sprite(sx, sy, 'queen_e', `scream0_${side}`).setOrigin(0.5, 81 / 84).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.lane = add
      .image(sx, sy, 'sd_lane')
      .setOrigin(0, 0.5)
      .setRotation(Math.atan2(ey - sy, ex - sx))
      .setScale(this.len / LANE_W, 1.6)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x6af4dc)
      .setAlpha(0)
      .setDepth(2.2);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const t = this.t - this.delay;
    if (t < 0) return;
    const side = this.ex >= this.sx ? 'r' : 'l';
    if (t < ECHO_MARK) {
      // Forming, and showing the lane it will take.
      const k = t / ECHO_MARK;
      this.body.setAlpha(Math.min(1, k * 2) * 0.45);
      this.glow.setAlpha(Math.min(1, k * 2) * 0.8).setFrame(`scream${Math.floor(t / 90) % 2}_${side}`);
      this.body.setFrame(this.glow.frame.name);
      this.lane.setAlpha(0.25 + k * 0.45 + Math.sin(t * 0.03) * 0.08);
      this.place();
      return;
    }
    const d = t - ECHO_MARK;
    if (d < this.dashTime) {
      if (d - dt < 0) sound.blink(this.world.pan(this.x));
      const k = d / this.dashTime;
      this.x = this.sx + (this.ex - this.sx) * k;
      this.y = this.sy + (this.ey - this.sy) * k;
      this.body.setFrame(`summon1_${side}`).setAlpha(0.5);
      this.glow.setFrame(`summon1_${side}`).setAlpha(1);
      this.lane.setAlpha(0.7 * (1 - k));
      this.place();
      if (!this.struck) this.struck = this.world.hurtHeroInEllipse(this.x, this.y, 12, 9, { damage: this.damage, fromX: this.x - (this.ex - this.sx) * 0.1, fromY: this.y - (this.ey - this.sy) * 0.1, knock: 200 });
      this.trail -= dt;
      if (this.trail <= 0) {
        this.trail = 28;
        this.world.debris(QUEEN_TINTS, snap(this.x) + (Math.random() - 0.5) * 20, snap(this.y) - 10 - Math.random() * 40, 2, this.y, 'trail');
      }
      return;
    }
    // Fading away at the far end.
    const f = (d - this.dashTime) / 300;
    this.body.setAlpha(Math.max(0, 0.5 * (1 - f)));
    this.glow.setAlpha(Math.max(0, 1 - f));
    this.lane.setAlpha(0);
    if (f >= 1) this.destroy();
  }

  private place(): void {
    const bob = Math.sin(this.t * 0.006) * 2;
    const x = snap(this.x);
    const y = snap(this.y - HOVER + bob);
    this.body.setPosition(x, y).setDepth(this.y);
    this.glow.setPosition(x, y).setDepth(this.y + 0.1);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.body.destroy();
    this.glow.destroy();
    this.lane.destroy();
  }
}

/**
 * The Hollow Queen, the Spirit Dungeon's Legend: a spirit twice a hero's
 * height who floats over the ritual circle in the Sanctum. She trades two
 * spells with a breather after each:
 *   - Grasp of the Drowned: lines of hands claw up out of the floor toward the hero.
 *   - Phantom Rush: she fades away, and echoes of her rush through the hero along marked lanes.
 * Below half health her grief turns to rage: more lines, more echoes, and quicker.
 * She can't be staggered or shoved, and while she is faded she can't be struck.
 */
export class Queen extends Monster {
  private skill: Skill = 'grasp';
  private last: Skill = 'rush';
  private phase = Math.random() * 1000;
  private enraged = false;
  private bossBar: BossBar;
  private locket: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private lines: GraspLine[] = [];
  private echoes: Echo[] = [];
  /** Phantom Rush: 'out' fading, 'gone' while her echoes rush, 'in' forming again. */
  private rush: 'out' | 'gone' | 'in' | null = null;
  private rushT = 0;
  private power = 0;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'queen',
      hp: 1150,
      radius: 15,
      bodyY: 26,
      speed: 20,
      sight: 150,
      leash: 100000,
      mass: 30,
      barY: 90,
      debris: QUEEN_TINTS,
      noBar: true,
      rank: 'legend',
    });
    this.hover = HOVER;
    this.cooldown = 1400;
    this.bossBar = new BossBar(world, 'The Hollow Queen');
    this.locket = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6af4dc).setAlpha(0.5);
    this.light = world.lights.addLight(x, y - LOCKET_Y, 130, 0x5ae0d0, 1);
    // Motes of soul-light always drifting up off her.
    this.motes = world.add.particles(0, 0, 'spark', {
      lifespan: { min: 900, max: 1600 },
      speedY: { min: -26, max: -10 },
      speedX: { min: -6, max: 6 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.8 },
      tint: QUEEN_TINTS,
      blendMode: Phaser.BlendModes.ADD,
      frequency: 110,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-16, -58, 32, 50) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    });
  }

  get pinned(): boolean {
    return true;
  }

  get alive(): boolean {
    return super.alive && !this.vanished;
  }

  /** Faded from sight in her Phantom Rush: nothing can touch her. */
  private get vanished(): boolean {
    return this.rush === 'gone' || (this.rush === 'out' && this.rushT > FADE_TIME * 0.5);
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    this.hover = HOVER + Math.sin(this.phase * 0.0019) * 2.5;
    this.fade = this.rushFade(dt) * (0.9 + Math.sin(this.phase * 0.004) * 0.05);
    super.update(dt, target, daylight);
    if (this.dead) return;
    this.lines = this.lines.filter((l) => !l.dead);
    this.echoes = this.echoes.filter((e) => !e.dead);
    const goal = this.state === 'windup' || this.state === 'attack' ? 1 : 0;
    this.power += (goal - this.power) * Math.min(1, dt / 300);
    this.dress();
    const fighting = this.state !== 'spawn' && this.state !== 'idle' && this.state !== 'wander' && this.state !== 'return';
    this.bossBar.update(dt, this.hp, this.stats.hp, fighting && this.state !== 'dying', this.enraged);
  }

  /** How solid she is through the Phantom Rush. */
  private rushFade(dt: number): number {
    if (!this.rush) return 1;
    this.rushT += dt;
    if (this.rush === 'out') return Math.max(0, 1 - this.rushT / FADE_TIME);
    if (this.rush === 'gone') return 0;
    return Math.min(1, this.rushT / FADE_TIME);
  }

  /** The locket's glow and light, and the motes rising off her. */
  private dress(): void {
    const ry = snap(this.y);
    const lx = snap(this.x);
    const ly = snap(this.y - this.hover - LOCKET_Y);
    const fade = this.state === 'dying' ? 0 : this.state === 'spawn' ? 1 - this.timer / 700 : this.fade;
    const pulse = 0.85 + Math.sin(this.phase * 0.005) * 0.15;
    this.locket.setPosition(lx, ly).setDepth(ry + 0.3).setScale((0.55 + this.power * 0.5) * pulse).setAlpha((0.4 + this.power * 0.4) * fade);
    this.light.setPosition(this.x, this.y - this.hover - 30);
    this.light.intensity = (1 + this.power * 1.1) * pulse * fade;
    this.light.radius = 130 + this.power * 40;
    this.motes.setPosition(lx, snap(this.y - this.hover)).setDepth(ry + 0.4);
    this.motes.emitting = fade > 0.3;
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (this.cooldown === 0) {
      // Alternate the two spells; a hero keeping far away brings on the rush.
      this.skill = this.last === 'grasp' || (dist > 120 && this.last !== 'rush') ? 'rush' : 'grasp';
      this.begin(target);
      return;
    }
    // Drift over the circle, leaning toward the hero.
    const gx = QUEEN_HOME.x + Phaser.Math.Clamp((target.x - QUEEN_HOME.x) * 0.35, -SANCTUM.rx * 0.3, SANCTUM.rx * 0.3);
    const gy = QUEEN_HOME.y + Phaser.Math.Clamp((target.y - QUEEN_HOME.y) * 0.35, -SANCTUM.ry * 0.3, SANCTUM.ry * 0.3);
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
    if (this.skill === 'grasp') {
      this.enter('windup', this.enraged ? 700 : CALL_TIME);
      this.play('summon', true);
      sound.gravityWell(0.9);
      return;
    }
    this.enter('windup', this.enraged ? 600 : SHRIEK_TIME);
    this.play('scream', true);
    this.world.cameras.main.shake(SHRIEK_TIME, 0.0012);
    sound.soulCast(this.world.pan(this.x), true);
  }

  protected act(dt: number, target: Target | null): void {
    if (!target && this.rush !== 'gone' && this.rush !== 'in') {
      this.onInterrupted();
      this.enter('return', 0);
      return;
    }
    if (this.skill === 'grasp') this.actGrasp(dt, target);
    else this.actRush(dt, target);
  }

  private actGrasp(dt: number, target: Target | null): void {
    if (this.state === 'windup') {
      // Soul-light pools under her hands as the dead answer.
      if (Math.random() < dt / 45) {
        const side = Math.random() < 0.5 ? -1 : 1;
        this.world.debris(QUEEN_TINTS, this.x + side * 26 + (Math.random() - 0.5) * 8, this.y - this.hover - 40 + Math.random() * 6, 1, this.y + 1, 'gather');
      }
      if (this.timer <= 0 && target) {
        this.cast(target);
        this.enter('attack', 600);
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0 && !this.lines.length) this.rest();
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** Lines of hands: one straight at the hero, the others fanned either side. */
  private cast(target: Target): void {
    const n = this.enraged ? 3 : 2;
    const base = Math.atan2((target.y - this.y) / 0.8, target.x - this.x);
    const offs = n === 3 ? [0, -0.42, 0.42] : [0, (Math.random() < 0.5 ? -1 : 1) * 0.36];
    const dmg = this.enraged ? 18 : 15;
    offs.forEach((o, i) => {
      const line = new GraspLine(this.world, this.x, this.y, Math.cos(base + o), Math.sin(base + o), dmg, HAND_MARK + i * 120);
      this.lines.push(line);
      this.world.addEffect(line);
    });
    this.world.debris(QUEEN_TINTS, snap(this.x), snap(this.y) - 4, 20, this.y + 2, 'spores');
    this.world.cameras.main.shake(160, 0.0018);
  }

  private actRush(dt: number, target: Target | null): void {
    if (this.state === 'windup') {
      if (Math.random() < dt / 40) this.world.debris(QUEEN_TINTS, this.x + (Math.random() - 0.5) * 30, this.y - this.hover - 20 - Math.random() * 40, 1, this.y + 1, 'spores');
      if (this.timer <= 0) {
        this.rush = 'out';
        this.rushT = 0;
        this.enter('attack', 99999);
        sound.vanish(this.world.pan(this.x), true);
        this.world.debris(QUEEN_TINTS, snap(this.x), snap(this.y) - 40, 26, this.y + 2, 'spores');
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.rush === 'out' && this.rushT >= FADE_TIME) {
        this.rush = 'gone';
        this.rushT = 0;
        if (target) this.sendEchoes(target);
      } else if (this.rush === 'gone' && !this.echoes.length) {
        // Form again over the circle, on the side away from the hero.
        const tx = target?.x ?? QUEEN_HOME.x;
        const ty = target?.y ?? QUEEN_HOME.y;
        this.x = QUEEN_HOME.x + Phaser.Math.Clamp((QUEEN_HOME.x - tx) * 0.3, -40, 40);
        this.y = QUEEN_HOME.y + Phaser.Math.Clamp((QUEEN_HOME.y - ty) * 0.3, -30, 30);
        this.rush = 'in';
        this.rushT = 0;
        this.play('idle', true);
        this.world.debris(QUEEN_TINTS, snap(this.x), snap(this.y) - 40, 26, this.y + 2, 'spores');
        sound.blink(this.world.pan(this.x));
      } else if (this.rush === 'in' && this.rushT >= FADE_TIME) {
        this.rush = null;
        this.rest();
      }
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** Echoes round the hero, each rushing through where the hero stands, one after another. */
  private sendEchoes(target: Target): void {
    const n = this.enraged ? 4 : 3;
    const a0 = Math.random() * Math.PI * 2;
    const dmg = this.enraged ? 22 : 18;
    for (let i = 0; i < n; i++) {
      let a = a0 + (i * Math.PI * 2) / n;
      let sx = 0;
      let sy = 0;
      // Start on the floor; turn round the ring until a spot is.
      for (let k = 0; k < 8; k++, a += Math.PI / 4) {
        sx = target.x + Math.cos(a) * ECHO_RING;
        sy = target.y + Math.sin(a) * ECHO_RING * 0.7;
        if (spiritFloor(sx, sy, 8)) break;
      }
      const ex = target.x - Math.cos(a) * ECHO_RING;
      const ey = target.y - Math.sin(a) * ECHO_RING * 0.7;
      const echo = new Echo(this.world, sx, sy, ex, ey, i * (this.enraged ? ECHO_GAP * 0.75 : ECHO_GAP), dmg);
      this.echoes.push(echo);
      this.world.addEffect(echo);
    }
  }

  /** The spell is spent: a breather, the one safe window to strike hard. */
  private rest(): void {
    this.enter('recover', RECOVER);
    this.play('idle', true);
    this.cooldown = (this.enraged ? 800 : 1400) + Math.random() * 800;
  }

  hurt(hit: Hit): void {
    if (this.vanished) return;
    super.hurt(hit);
    if (!this.enraged && this.alive && this.hp < this.stats.hp / 2) {
      this.enraged = true;
      this.locket.setTint(0xb89cff);
      this.light.setColor(0x9a8aff);
      this.world.popNumber(snap(this.x), snap(this.y) - 88, 'ENRAGED', 0xb8fff0);
      this.world.debris(QUEEN_TINTS, snap(this.x), snap(this.y - LOCKET_Y), 30, this.y + 40, 'spores');
      this.world.cameras.main.shake(220, 0.0025);
    }
  }

  protected staggers(): boolean {
    return false;
  }

  protected onDeath(): void {
    const w = this.world;
    for (let i = 0; i < 4; i++) {
      w.time.delayedCall(i * 150, () => w.debris(QUEEN_TINTS, snap(this.x + (Math.random() - 0.5) * 36), snap(this.y - 10 - Math.random() * 60), 26, this.y + 40, 'spores'));
    }
    w.cameras.main.flash(380, 200, 255, 245);
    w.cameras.main.shake(420, 0.004);
    w.popNumber(snap(this.x), snap(this.y) - 92, 'LAID TO REST', 0xb8fff0);
    sound.nova();
  }

  protected onInterrupted(): void {
    for (const l of this.lines) l.destroy();
    for (const e of this.echoes) e.destroy();
    this.lines = [];
    this.echoes = [];
    if (this.rush) {
      this.rush = null;
      this.fade = 1;
    }
  }

  destroy(): void {
    if (this.dead) return;
    super.destroy();
    this.bossBar.destroy();
    this.locket.destroy();
    this.motes.destroy();
    this.world.lights.removeLight(this.light);
  }
}
