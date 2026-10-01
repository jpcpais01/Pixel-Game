import Phaser from 'phaser';
import { MONSTER_FRAME } from '../../art/monsters';
import { SNOWQUEEN_TINTS, SQ_BEAM_TIP, SQ_BEAM_W, SQ_HEART_Y } from '../../art/snowQueen';
import { SNOW_TINTS, T_ICE, T_VIOLET } from '../../art/frostKit';
import { snap } from '../display';
import { sound } from '../../audio';
import { BossBar } from '../BossBar';
import type { Effect } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';
import { CHILL_LIGHT, FrostPatch, IceShard, chill, frostLane, iceBurst, layLane } from './frostFx';
import { Monster, type Target } from './Monster';
import { mobHit, mobHp } from '../tiers';

const FRAME = MONSTER_FRAME.snowqueen;
const OX = FRAME.ox / FRAME.w;
const OY = FRAME.oy / FRAME.h;
/** She floats a hair above the floor, swaying. */
const HOVER = 4;
/** Her crown above her feet, where her light shines from. */
const CROWN_Y = 66;

// Gliding: she keeps a queen's distance from the hero, drifting round them.
const KEEP = 112;
const SPEED = 36;
/** A hero who crowds her is left in a puff of snow: she blinks away. */
const CROWD = 44;
const BLINK_EVERY = 5200;
const BLINK_OUT = 220;
const BLINK_IN = 260;
const BLINK_TO = 130;

// The Mirror Court: she raises her scepter and glints mark spots round the
// hero; she vanishes, and reflections of her stand on all of them but one,
// where she herself stands. Each reflection, in turn, takes aim (a lane to
// the hero) and fires a fan of shards, then shatters. Walking into one
// breaks it harmlessly; striking the real Queen breaks them all and leaves
// her reeling.
const COURT_CALL = 950;
const COURT_R = 104;
const COURT_N = 3;
const RAGE_COURT_N = 4;
const COURT_EVERY = 15000;
const RAGE_COURT_EVERY = 11000;
const FORM = 320;
const HOLD = 1900;
const HOLD_STEP = 420;
const AIM = 700;
const TOUCH = 15;
const FAN = 3;
const FAN_SPREAD = 0.24;
const REEL = 1500;

// The Mirror Beam: she levels her scepter; a lane runs from her to the hero,
// following them, then fixing; then a beam of light runs down it.
const BEAM_AIM = 960;
const RAGE_BEAM_AIM = 800;
const BEAM_TRACK = 0.55;
const BEAM_TIME = 460;
const BEAM_LEN = 230;
const BEAM_W = 9;
const RAGE_BEAM_SPLIT = 0.42;

// The Blizzard Ring: she spins, her mirror shards whirling wide, and rings of
// ice shards burst out of her in waves, each turned to fill the last one's gaps.
const SPIN = 920;
const RAGE_SPIN = 760;
const WAVES = 2;
const RAGE_WAVES = 3;
const WAVE_GAP = 460;
const WAVE_N = 12;

const RECOVER = 1100;
const ORBIT = 4;
const RAGE_ORBIT = 6;

type Skill = 'court' | 'beam' | 'blizzard';

/**
 * A reflection of the Snow Queen standing in her Mirror Court: her own form
 * in pale, glassy light (no shadow, and no shards circling it: that's how
 * the real one is told apart). It forms, waits its turn, takes aim at the
 * hero and fires a fan of shards, and shatters. Walked into, it shatters
 * harmlessly.
 */
class Reflection implements Effect {
  dead = false;
  private t = 0;
  private body: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private glint: Phaser.GameObjects.Image;
  private lane: Phaser.GameObjects.Image;
  private aimX = 0;
  private aimY = 0;
  private aimed = false;
  private side: 'r' | 'l' = 'r';

  constructor(
    private world: WorldScene,
    readonly x: number,
    readonly y: number,
    private hold: number,
    private damage: number,
    private prey: () => Target | null,
  ) {
    const add = world.add;
    this.body = add.sprite(x, y, 'snowqueen', 'idle0_r').setOrigin(OX, OY).setPipeline('Lit').setTint(0xc4ecff).setAlpha(0);
    this.glow = add.sprite(x, y, 'snowqueen_e', 'idle0_r').setOrigin(OX, OY).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.glint = add.image(x, y - SQ_HEART_Y, 'sq_glint').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.lane = frostLane(world, x, y, 1, 0xc8f4ff);
    iceBurst(world, x, y - 30, 10);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const prey = this.prey();
    if (prey && !this.aimed) this.side = prey.x < this.x ? 'l' : 'r';
    const aiming = this.t >= this.hold;
    const f = aiming ? `beam${Math.floor(this.t / 110) % 2}_${this.side}` : `idle${Math.floor(this.t / 200) % 6}_${this.side}`;
    const bob = Math.sin(this.t * 0.004 + this.x) * 1.5;
    const by = snap(this.y - HOVER + bob);
    const form = Math.min(1, this.t / FORM);
    // A faint shimmer runs through the glass.
    const shimmer = 0.62 + Math.sin(this.t * 0.012 + this.y) * 0.08;
    this.body.setFrame(f).setPosition(snap(this.x), by).setDepth(this.y).setAlpha(form * shimmer);
    this.glow.setFrame(f).setPosition(snap(this.x), by).setDepth(this.y + 0.1).setAlpha(form * 0.9);
    this.glint.setPosition(snap(this.x) + (this.side === 'r' ? 2 : -2), by - SQ_HEART_Y + 4).setDepth(this.y + 0.2);

    // Walked into: the glass breaks, and nothing comes of it.
    const h = this.world.heroPos;
    if (h && form >= 1 && Math.hypot(h.x - this.x, (h.y - this.y) * 1.3) < TOUCH) {
      this.shatter(false);
      return;
    }
    if (!aiming) {
      this.glint.setAlpha(form * (0.25 + Math.sin(this.t * 0.01) * 0.1)).setScale(0.8);
      return;
    }
    // Its turn: it takes aim, the lane fixing on where the hero stands.
    const a = this.t - this.hold;
    if (!this.aimed && prey) {
      this.aimX = prey.x;
      this.aimY = prey.y;
    }
    if (a > AIM * 0.45) this.aimed = true;
    const dx = this.aimX - this.x;
    const dy = this.aimY - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, a / AIM);
    layLane(this.lane, this.x, this.y, dx / len, dy / len, Math.min(200, len + 30), 1, 0.15 + k * 0.45);
    this.lane.setTint(this.aimed ? 0xffffff : 0xc8f4ff);
    this.glint.setAlpha(0.5 + k * 0.5).setScale(0.8 + k * 1.2).setRotation(k * 1.5);
    if (a >= AIM) this.shatter(true);
  }

  /** It breaks, firing its shards if it had taken aim. */
  shatter(fire: boolean): void {
    if (this.dead) return;
    const w = this.world;
    if (fire) {
      const base = Math.atan2(this.aimY - this.y, this.aimX - this.x);
      for (let i = 0; i < FAN; i++) {
        const a = base + (i - (FAN - 1) / 2) * FAN_SPREAD;
        w.addEffect(new IceShard(w, this.x + Math.cos(a) * 8, this.y - 16 + Math.sin(a) * 6, Math.cos(a), Math.sin(a), { damage: this.damage, speed: 165, range: 240, knock: 90, tint: 0xc8f4ff }));
      }
      sound.frost('chime', w.pan(this.x), true);
    }
    iceBurst(w, this.x, this.y - 30, 18, this.y + 2);
    w.debris(SNOWQUEEN_TINTS, snap(this.x), snap(this.y) - 40, 12, this.y + 2, 'spores');
    sound.shatter(w.pan(this.x), false);
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.body, this.glow, this.glint, this.lane]) o.destroy();
  }
}

/**
 * The Snow Queen, Mistress of the Frozen Mirror: the Aurora Colosseum's
 * sorceress, tall and regal in a gown of snow, crowned in crystal, mirror
 * shards circling her. She glides at a distance and blinks away from a hero
 * who crowds her (leaving hoarfrost behind), and trades three spells with a
 * breather after each:
 *   - The Mirror Court: reflections of her round the hero, each firing a fan of shards in turn; find and strike the real one to break them all.
 *   - The Mirror Beam: a lane from her scepter that follows, fixes, then fires.
 *   - The Blizzard Ring: waves of ice shards whirling out of her, each turned to fill the last one's gaps.
 * Below half health the mirror cracks: more reflections, three beams at
 * once, a third wave, more shards about her. She can't be staggered or shoved.
 */
export class SnowQueen extends Monster {
  private skill: Skill = 'beam';
  private last: Skill = 'blizzard';
  private enraged = false;
  private bossBar: BossBar;
  private light: Phaser.GameObjects.Light;
  private heart: Phaser.GameObjects.Image;
  private phase = Math.random() * 1000;
  private power = 0;
  private circle = Math.random() < 0.5 ? 1 : -1;
  private prey: Target | null = null;
  private orbit: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }[] = [];
  private spinUp = 0;

  // Blinking.
  private blinkPhase: 'out' | 'in' | null = null;
  private blinkT = 0;
  private blinkX = 0;
  private blinkY = 0;
  private blinkThen: (() => void) | null = null;
  private blinkCd = 2500;

  // The Mirror Court.
  private courtCd = 6000;
  private spots: { x: number; y: number }[] = [];
  private glints: Phaser.GameObjects.Image[] = [];
  private court: Reflection[] = [];
  private holding = false;

  // The Mirror Beam.
  private lanes: Phaser.GameObjects.Image[] = [];
  private beams: Phaser.GameObjects.Sprite[] = [];
  private angles: number[] = [];
  private beamX = 0;
  private beamY = 0;

  // The Blizzard Ring.
  private wave = 0;
  private waveBase = 0;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'snowqueen',
      hp: mobHp('snowqueen'),
      radius: 14,
      bodyY: 34,
      speed: SPEED,
      sight: 230,
      leash: 100000,
      mass: 30,
      barY: 92,
      debris: SNOWQUEEN_TINTS,
      noBar: true,
      rank: 'legend',
    });
    this.hover = HOVER;
    this.cooldown = 1500;
    this.bossBar = new BossBar(world, 'The Snow Queen');
    this.light = world.lights.addLight(x, y - CROWN_Y, 130, 0xbfe8ff, 0.9);
    this.heart = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(T_ICE).setAlpha(0);
    this.growOrbit(ORBIT);
  }

  get pinned(): boolean {
    return true;
  }

  private get dir(): number {
    return this.facing === 'r' ? 1 : -1;
  }

  private growOrbit(n: number): void {
    while (this.orbit.length < n) {
      const img = this.world.add.image(this.x, this.y, 'sq_mirror', 'm0').setPipeline('Lit');
      const glow = this.world.add.image(this.x, this.y, 'sq_mirror_e', 'm0').setBlendMode(Phaser.BlendModes.ADD);
      this.orbit.push({ img, glow });
    }
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    this.prey = target;
    this.blinkCd = Math.max(0, this.blinkCd - dt);
    if (this.state !== 'spawn' && this.state !== 'idle' && this.state !== 'wander') this.courtCd = Math.max(0, this.courtCd - dt);
    this.hover = HOVER + Math.sin(this.phase * 0.0021) * 1.5;
    this.fade = this.stepBlink(dt);
    super.update(dt, target, daylight);
    if (this.dead) return;
    this.court = this.court.filter((r) => !r.dead);
    if (this.holding && !this.court.length) {
      // Every reflection has fired or been broken: the court is over.
      this.holding = false;
      if (this.state === 'attack') this.rest(RECOVER);
    }
    const goal = this.state === 'windup' || this.state === 'attack' ? 1 : 0;
    this.power += (goal - this.power) * Math.min(1, dt / 250);
    const spinning = this.skill === 'blizzard' && (this.state === 'windup' || this.state === 'attack');
    this.spinUp += ((spinning ? 1 : 0) - this.spinUp) * Math.min(1, dt / 200);
    this.dress();
    const fighting = this.state !== 'spawn' && this.state !== 'idle' && this.state !== 'wander' && this.state !== 'return';
    this.bossBar.update(dt, this.hp, this.maxHp, fighting && this.state !== 'dying', this.enraged);
  }

  /** Her blink: fading out, moving, fading in. Returns how solid she is. */
  private stepBlink(dt: number): number {
    if (!this.blinkPhase) return 1;
    this.blinkT += dt;
    if (this.blinkPhase === 'out') {
      if (this.blinkT < BLINK_OUT) return 1 - this.blinkT / BLINK_OUT;
      const w = this.world;
      w.debris(SNOW_TINTS, snap(this.x), snap(this.y) - 34, 16, this.y + 2, 'spores');
      this.x = this.blinkX;
      this.y = this.blinkY;
      this.blinkPhase = 'in';
      this.blinkT = 0;
      w.debris(SNOWQUEEN_TINTS, snap(this.x), snap(this.y) - 34, 16, this.y + 2, 'spores');
      sound.blink(w.pan(this.x));
      const then = this.blinkThen;
      this.blinkThen = null;
      then?.();
      return 0;
    }
    if (this.blinkT < BLINK_IN) return this.blinkT / BLINK_IN;
    this.blinkPhase = null;
    return 1;
  }

  /** Vanish in a puff of snow and appear at (x, y); `then` runs the moment she is gone. */
  private blink(x: number, y: number, then: (() => void) | null = null): void {
    const w = this.world;
    // Hoarfrost where she stood.
    w.addEffect(new FrostPatch(w, this.x, this.y, { rx: 22, life: 2600, chill: CHILL_LIGHT }));
    this.blinkPhase = 'out';
    this.blinkT = 0;
    this.blinkX = x;
    this.blinkY = y;
    this.blinkThen = then;
    this.blinkCd = BLINK_EVERY;
    sound.vanish(w.pan(this.x));
  }

  /** On the floor, clear of walls: may she stand at (x, y)? */
  private floor(x: number, y: number): boolean {
    const b = this.world.monsterBounds;
    return this.world.walkable(x, y) && x > b.left + 16 && x < b.right - 16 && y > b.top + 12 && y < b.bottom - 8;
  }

  /** A spot `r` from the hero, as far from where she is now as the floor allows. */
  private spotAway(target: Target, r: number): { x: number; y: number } {
    let best = { x: this.x, y: this.y };
    let bestD = -1;
    const a0 = Math.atan2(this.y - target.y, this.x - target.x);
    for (let i = 0; i < 10; i++) {
      const a = a0 + Math.PI + ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 5;
      const x = target.x + Math.cos(a) * r;
      const y = target.y + Math.sin(a) * r * 0.72;
      if (!this.floor(x, y)) continue;
      const d = Math.hypot(x - this.x, y - this.y);
      if (d > bestD) {
        bestD = d;
        best = { x, y };
      }
    }
    return best;
  }

  /** The crown's light, the gem's glow, and the shards circling her. */
  private dress(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const hy = this.y - this.hover;
    const fade = (this.state === 'dying' ? Math.max(0, this.timer / 380) : this.state === 'spawn' ? 1 - this.timer / 700 : 1) * this.fade;
    const pulse = 0.88 + Math.sin(this.phase * 0.005) * 0.12;
    this.light.setPosition(this.x, hy - CROWN_Y + 10);
    this.light.intensity = (0.85 + this.power * 0.7 + (this.enraged ? 0.3 : 0)) * pulse * fade;
    this.heart
      .setPosition(rx + this.dir * 2, snap(hy - SQ_HEART_Y + 4))
      .setDepth(ry + 0.3)
      .setScale((0.45 + this.power * 0.4) * pulse)
      .setAlpha((0.4 + this.power * 0.4) * fade);
    // The shards: round her waist, front ones before her and back ones behind; whirling wide when she spins.
    const n = this.orbit.length;
    const speed = 0.0016 + this.spinUp * 0.006;
    const r = 21 + this.spinUp * 12;
    this.orbit.forEach((o, i) => {
      const a = this.phase * speed + (i / n) * Math.PI * 2;
      const s = Math.sin(a);
      const x = rx + Math.cos(a) * r;
      const y = snap(hy - 40 + s * 7 + Math.sin(this.phase * 0.003 + i) * 2);
      const frame = `m${Math.floor(((a % Math.PI) + Math.PI) % Math.PI / (Math.PI / 3)) % 3}`;
      const depth = this.y + (s > 0 ? 0.6 : -0.6);
      o.img.setFrame(frame).setPosition(snap(x), y).setDepth(depth).setAlpha(fade);
      o.glow.setFrame(frame).setPosition(snap(x), y).setDepth(depth + 0.05).setAlpha(fade * (0.7 + this.spinUp * 0.3));
    });
  }

  protected get intangible(): boolean {
    return this.fade < 0.4;
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.blinkPhase) {
      this.play('idle');
      return;
    }
    // Crowded: away in a puff of snow.
    if (dist < CROWD && this.blinkCd === 0) {
      const s = this.spotAway(target, BLINK_TO);
      this.blink(s.x, s.y);
      return;
    }
    if (this.cooldown === 0) {
      this.choose(target, dist);
      return;
    }
    // Glide to a queen's distance, drifting round the hero.
    let a = Math.atan2(this.y - target.y, this.x - target.x) + this.circle * 0.4;
    let gx = target.x + Math.cos(a) * KEEP;
    let gy = target.y + Math.sin(a) * KEEP * 0.72;
    if (!this.floor(gx, gy)) {
      this.circle = -this.circle;
      a = Math.atan2(this.y - target.y, this.x - target.x) + this.circle * 0.4;
      gx = target.x + Math.cos(a) * KEEP * 0.75;
      gy = target.y + Math.sin(a) * KEEP * 0.54;
    }
    const dx = gx - this.x;
    const dy = gy - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 6) {
      this.move(dt, dx / d, dy / d, SPEED * (this.enraged ? 1.2 : 1));
      // She glides, but she never takes her eyes off the hero.
      this.face(target.x - this.x);
      this.play('walk');
    } else {
      this.face(target.x - this.x);
      this.play('idle');
    }
  }

  private choose(target: Target, dist: number): void {
    if (this.courtCd === 0 && this.last !== 'court') this.skill = 'court';
    else if (dist < 70) this.skill = this.last === 'blizzard' ? 'beam' : 'blizzard';
    else this.skill = this.last === 'beam' ? 'blizzard' : 'beam';
    this.last = this.skill;
    this.face(target.x - this.x);
    const w = this.world;
    if (this.skill === 'court') {
      this.enter('windup', COURT_CALL);
      this.play('cast', true);
      this.markCourt(target);
      sound.frost('chime', w.pan(this.x), true);
      this.courtCd = this.enraged ? RAGE_COURT_EVERY : COURT_EVERY;
    } else if (this.skill === 'beam') {
      this.enter('windup', this.enraged ? RAGE_BEAM_AIM : BEAM_AIM);
      this.play('beam', true);
      this.startBeam(target);
      sound.swell(w.pan(this.x));
    } else {
      this.enter('windup', this.enraged ? RAGE_SPIN : SPIN);
      this.play('spin', true);
      this.wave = 0;
      this.waveBase = Math.random() * Math.PI * 2;
      sound.frost('gust', w.pan(this.x), true);
    }
  }

  protected act(dt: number, target: Target | null): void {
    if (!target && !this.holding && !this.blinkPhase) {
      this.onInterrupted();
      this.enter('return', 0);
      return;
    }
    if (this.skill === 'court') this.actCourt(dt);
    else if (this.skill === 'beam') this.actBeam(dt, target);
    else this.actBlizzard(dt);
  }

  // ---------------------------------------------------------------- The Mirror Court

  /** Glints over the spots round the hero where she and her reflections will stand. */
  private markCourt(target: Target): void {
    const n = (this.enraged ? RAGE_COURT_N : COURT_N) + 1;
    const a0 = Math.random() * Math.PI * 2;
    this.spots = [];
    for (let i = 0; i < n; i++) {
      let r = COURT_R;
      let x = 0;
      let y = 0;
      for (let k = 0; k < 4; k++, r *= 0.82) {
        const a = a0 + (i / n) * Math.PI * 2;
        x = target.x + Math.cos(a) * r;
        y = target.y + Math.sin(a) * r * 0.72;
        if (this.floor(x, y)) break;
      }
      if (!this.floor(x, y)) continue;
      this.spots.push({ x, y });
      const g = this.world.add.image(snap(x), snap(y) - 30, 'sq_glint').setBlendMode(Phaser.BlendModes.ADD).setDepth(y).setAlpha(0);
      this.glints.push(g);
    }
  }

  private actCourt(dt: number): void {
    const w = this.world;
    if (this.state === 'windup') {
      const k = 1 - this.timer / COURT_CALL;
      this.glints.forEach((g, i) => g.setAlpha(Math.min(1, k * 1.6)).setScale(0.6 + k * 1.4 + Math.sin(this.phase * 0.02 + i) * 0.2).setRotation(k * 2));
      if (Math.random() < dt / 50) w.debris(SNOWQUEEN_TINTS, this.x + this.dir * 12 + (Math.random() - 0.5) * 10, this.y - 80 + Math.random() * 10, 1, this.y + 1, 'gather');
      if (this.timer <= 0) this.openCourt();
      return;
    }
    if (this.state === 'attack') return;
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** She vanishes, and appears on one of the marked spots among her reflections. */
  private openCourt(): void {
    this.clearGlints();
    if (this.spots.length < 2) {
      this.rest(600);
      return;
    }
    const mine = Math.floor(Math.random() * this.spots.length);
    const me = this.spots[mine];
    const others = this.spots.filter((_, i) => i !== mine);
    this.enter('attack', 99999);
    this.play('idle', true);
    this.blink(me.x, me.y, () => {
      this.holding = true;
      const dmg = mobHit('snowqueen', this.enraged ? 0.55 : 0.5);
      // Their turns go round the ring, one after another.
      others.forEach((s, i) => {
        const r = new Reflection(this.world, s.x, s.y, HOLD + i * HOLD_STEP, dmg, () => this.prey);
        this.court.push(r);
        this.world.addEffect(r);
      });
    });
    this.world.cameras.main.shake(160, 0.0016);
  }

  /** Struck in her court: the glass breaks all round, and she reels. */
  private breakCourt(): void {
    const w = this.world;
    for (const r of this.court) r.shatter(false);
    this.court = [];
    this.holding = false;
    w.popNumber(snap(this.x), snap(this.y) - 96, 'FOUND!', 0xe0f8ff);
    w.cameras.main.shake(200, 0.003);
    sound.shatter(w.pan(this.x), true);
    this.enter('recover', REEL);
    this.play('idle', true);
    this.cooldown = REEL + 400;
  }

  private clearGlints(): void {
    for (const g of this.glints) g.destroy();
    this.glints = [];
  }

  // ---------------------------------------------------------------- The Mirror Beam

  private startBeam(target: Target): void {
    const n = this.enraged ? 3 : 1;
    this.angles = [];
    for (let i = 0; i < n; i++) {
      this.lanes[i] ??= frostLane(this.world, this.x, this.y, 1.6, 0xc8f4ff);
      this.lanes[i].setVisible(true);
    }
    this.aimBeam(target);
  }

  private aimBeam(target: Target): void {
    this.face(target.x - this.x);
    this.beamX = this.x + this.dir * SQ_BEAM_TIP.x;
    this.beamY = this.y + 1;
    const base = Math.atan2(target.y - this.beamY, target.x - this.beamX);
    const n = this.enraged ? 3 : 1;
    for (let i = 0; i < n; i++) this.angles[i] = base + (i - (n - 1) / 2) * RAGE_BEAM_SPLIT;
  }

  private actBeam(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      const total = this.enraged ? RAGE_BEAM_AIM : BEAM_AIM;
      const k = 1 - this.timer / total;
      if (k < BEAM_TRACK && target) this.aimBeam(target);
      const locked = k >= BEAM_TRACK;
      this.angles.forEach((a, i) => {
        layLane(this.lanes[i], this.beamX, this.beamY, Math.cos(a), Math.sin(a), BEAM_LEN, 1.6, 0.15 + k * 0.5 + (locked ? Math.sin(this.phase * 0.04) * 0.1 : 0));
        this.lanes[i].setTint(locked ? 0xffffff : 0xc8f4ff);
      });
      if (Math.random() < dt / 40) w.debris(SNOWQUEEN_TINTS, this.x + this.dir * SQ_BEAM_TIP.x, this.y - this.hover - SQ_BEAM_TIP.y, 1, this.y + 1, 'gather');
      if (this.timer <= 0) this.fireBeam();
      return;
    }
    if (this.state === 'attack') {
      const k = 1 - this.timer / BEAM_TIME;
      for (const b of this.beams) b.setAlpha(Math.max(0, 1 - k * k)).setScale(b.scaleX, 1.2 * (1 - k * 0.6));
      if (this.timer <= 0) {
        for (const b of this.beams) b.setVisible(false);
        this.rest(RECOVER);
      }
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private fireBeam(): void {
    const w = this.world;
    for (const l of this.lanes) l.setVisible(false);
    this.enter('attack', BEAM_TIME);
    const tipX = this.x + this.dir * SQ_BEAM_TIP.x;
    const tipY = this.y - this.hover - SQ_BEAM_TIP.y;
    const h = w.heroPos;
    let struck = false;
    this.angles.forEach((a, i) => {
      const ex = this.beamX + Math.cos(a) * BEAM_LEN;
      const ey = this.beamY + Math.sin(a) * BEAM_LEN;
      const beam = (this.beams[i] ??= w.add.sprite(0, 0, 'sq_beam', 'b0').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).play('sq_beam_flow'));
      const len = Math.hypot(ex - tipX, ey - tipY);
      beam
        .setVisible(true)
        .setPosition(tipX, tipY)
        .setRotation(Math.atan2(ey - tipY, ex - tipX))
        .setScale(len / SQ_BEAM_W, 1.2)
        .setDepth(Math.max(this.y, ey) + 1)
        .setAlpha(1);
      // It strikes along the lane on the floor.
      if (h && !struck) {
        const vx = ex - this.beamX;
        const vy = ey - this.beamY;
        const t = Phaser.Math.Clamp(((h.x - this.beamX) * vx + (h.y - this.beamY) * vy) / (vx * vx + vy * vy), 0, 1);
        const d = Math.hypot(h.x - (this.beamX + vx * t), h.y - (this.beamY + vy * t));
        if (d < BEAM_W + 4) {
          w.hurtHero({ damage: mobHit('snowqueen', 0.95), fromX: this.beamX, fromY: this.beamY - 20, knock: 170 });
          chill(w, CHILL_LIGHT);
          struck = true;
        }
      }
      iceBurst(w, ex, ey - 4, 10);
      for (let k = 1; k < 5; k++) w.debris(SNOWQUEEN_TINTS, this.beamX + (ex - this.beamX) * (k / 5), this.beamY + (ey - this.beamY) * (k / 5) - 3, 2, ey, 'trail');
    });
    w.cameras.main.shake(180, 0.0025);
    sound.beamFire(w.pan(this.x), 1);
    sound.frost('chime', w.pan(this.x), true);
  }

  // ---------------------------------------------------------------- The Blizzard Ring

  private actBlizzard(dt: number): void {
    const w = this.world;
    const waves = this.enraged ? RAGE_WAVES : WAVES;
    if (this.state === 'windup') {
      if (Math.random() < dt / 30) {
        const a = Math.random() * Math.PI * 2;
        w.debris(SNOW_TINTS, this.x + Math.cos(a) * 34, this.y - 30 + Math.sin(a) * 20, 1, this.y + 1, 'gather');
      }
      if (this.timer <= 0) {
        this.burstWave();
        this.enter('attack', WAVE_GAP);
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) {
        if (this.wave < waves) {
          this.burstWave();
          this.enter('attack', WAVE_GAP);
        } else this.rest(RECOVER);
      }
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** One ring of shards bursting out of her, turned half a step from the last. */
  private burstWave(): void {
    const w = this.world;
    const dmg = mobHit('snowqueen', 0.5);
    for (let i = 0; i < WAVE_N; i++) {
      const a = this.waveBase + ((i + (this.wave % 2) * 0.5) / WAVE_N) * Math.PI * 2;
      const ux = Math.cos(a);
      const uy = Math.sin(a) * 0.72;
      const l = Math.hypot(ux, uy);
      w.addEffect(new IceShard(w, this.x + ux * 14, this.y - 16 + uy * 10, ux / l, uy / l, { damage: dmg, speed: 112, range: 250, knock: 100, chill: CHILL_LIGHT, size: 1.1, tint: this.wave % 2 ? T_VIOLET : T_ICE }));
    }
    this.wave++;
    w.debris(SNOWQUEEN_TINTS, snap(this.x), snap(this.y) - 30, 16, this.y + 2);
    w.cameras.main.shake(120, 0.0016);
    sound.frost('freeze', w.pan(this.x), this.wave === 1);
  }

  // ---------------------------------------------------------------- Rest, rage and the end

  /** The spell is spent: a breather, the moment to strike. */
  private rest(ms: number): void {
    this.enter('recover', ms);
    this.play('idle', true);
    this.cooldown = (this.enraged ? 700 : 1100) + Math.random() * 700;
  }

  protected afterHit(): void {
    if (this.holding && this.court.length && this.alive) this.breakCourt();
    if (!this.enraged && this.alive && this.hp < this.maxHp / 2) {
      this.enraged = true;
      this.growOrbit(RAGE_ORBIT);
      this.light.setColor(0xd8c8ff);
      this.heart.setTint(T_VIOLET);
      this.courtCd = Math.min(this.courtCd, 2500);
      this.world.popNumber(snap(this.x), snap(this.y) - 96, 'THE MIRROR CRACKS', 0xe0f8ff);
      this.world.debris(SNOWQUEEN_TINTS, snap(this.x), snap(this.y) - 50, 34, this.y + 40, 'spores');
      this.world.cameras.main.shake(220, 0.0025);
      sound.shatter(this.world.pan(this.x), true);
    }
  }

  /** Her blizzard, arms flung wide, the shards whirling. */
  protected flourish(): void {
    this.play('spin', true);
    this.spinUp = 1;
  }

  protected staggers(): boolean {
    return false;
  }

  protected onInterrupted(): void {
    this.clearGlints();
    for (const l of this.lanes) l.setVisible(false);
    for (const b of this.beams) b.setVisible(false);
    for (const r of this.court) r.shatter(false);
    this.court = [];
    this.holding = false;
  }

  protected onDeath(): void {
    const w = this.world;
    for (let i = 0; i < 5; i++) {
      w.time.delayedCall(i * 130, () => iceBurst(w, this.x + (Math.random() - 0.5) * 50, this.y - 10 - Math.random() * 70, 20, this.y + 40));
    }
    // Her shards fall from the air and shatter round her.
    for (const o of this.orbit) iceBurst(w, o.img.x, o.img.y, 8, this.y + 2);
    w.debris(SNOWQUEEN_TINTS, snap(this.x), snap(this.y) - 50, 40, this.y + 40, 'spores');
    w.cameras.main.flash(380, 220, 245, 255);
    w.cameras.main.shake(420, 0.004);
    w.popNumber(snap(this.x), snap(this.y) - 96, 'THE MIRROR SHATTERS', 0xe0f8ff);
    sound.shatter(w.pan(this.x), true);
    sound.nova();
  }

  destroy(): void {
    if (this.dead) return;
    super.destroy();
    this.bossBar.destroy();
    this.heart.destroy();
    for (const o of this.orbit) {
      o.img.destroy();
      o.glow.destroy();
    }
    this.orbit = [];
    for (const l of this.lanes) l.destroy();
    for (const b of this.beams) b.destroy();
    this.lanes = [];
    this.beams = [];
    this.world.lights.removeLight(this.light);
  }
}
