import Phaser from 'phaser';
import { WINTERKING_TINTS, WK_HEART_REST, WK_RUNE_W } from '../../art/winterKing';
import { SNOW_TINTS, T_ICE, T_VIOLET } from '../../art/frostKit';
import { snap } from '../display';
import { sound } from '../../audio';
import { BossBar } from '../BossBar';
import type { Effect } from '../Slash';
import type { WorldScene } from '../../scenes/WorldScene';
import { CHILL_DEEP, CHILL_LIGHT, FrostRing, IceSpike, Icicle, chill, iceBurst } from './frostFx';
import { Monster, type Target } from './Monster';
import { mobHit, mobHp } from '../tiers';

/** His frozen heart above his feet, at the head of his staff (facing right). */
const HEART_X = WK_HEART_REST.x;
const HEART_Y = WK_HEART_REST.y;
/** His casting hand above his feet when thrust out. */
const HAND_X = 30;
const HAND_Y = 55;

// He walks slowly to a king's distance and lets his spells do the rest.
const SPEED = 21;
const KEEP_FAR = 96;
const KEEP_NEAR = 64;

// Nova: a hero who comes close is thrown back. He hoists his staff (a rune
// circle glows under him), then drives it down: frost bursts round him and
// a ring races out.
const NOVA_REACH = 54;
const NOVA_LIFT = 720;
const RAGE_NOVA_LIFT = 600;
const NOVA_RX = 46;
const NOVA_RY = 28;
const NOVA_EVERY = 4800;

// Pillar Prison: pillars of ice ring the hero, one gap left open, and then
// the heart of the ring erupts. Step out through the gap, or out before
// the ring rises.
const PRISON_CAST = 900;
const PRISON_RING = 1250;
const PRISON_HEART = 1750;
const PRISON_RX = 40;
const PRISON_RY = 27;
const PRISON_N = 10;

// Blizzard orbs: slow balls of whirling snow that drift after the hero and
// burst on them. Keep moving and they die out.
const ORB_CAST = 680;
const ORBS = 3;
const RAGE_ORBS = 4;
const ORB_SPEED = 50;
const RAGE_ORB_SPEED = 58;
const ORB_TURN = 1.5;
const ORB_LIFE = 5200;
const ORB_FLOAT = 15;

// Icicle Storm: he raises his staff and the sky above the colosseum lets
// fall its icicles, on the hero and all round them, for a long breath.
// It leaves him spent.
const STORM_CAST = 820;
const STORM = 2600;
const STORM_GAP = 155;
const RAGE_STORM_GAP = 115;
const STORM_SPREAD = 110;

// Raise the Fallen (below half health): frostbound rise at his sides.
const SUMMON_CAST = 1300;
const SUMMON_EVERY = 19000;
const GUARD = 2;

const RECOVER = 1000;
const SPENT = 1500;

type Skill = 'nova' | 'prison' | 'orbs' | 'storm' | 'summon';

/**
 * A blizzard orb: a ball of whirling snow round a violet core, floating a
 * little above the floor, its shadow beneath it, drifting after the hero and
 * turning slowly. It bursts on them, or whirls itself out.
 */
class BlizzardOrb implements Effect {
  dead = false;
  private t = 0;
  private img: Phaser.GameObjects.Sprite;
  private halo: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private trail = 0;
  private h: number;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    lift: number,
    private ux: number,
    private uy: number,
    private speed: number,
    private damage: number,
  ) {
    this.h = lift;
    this.img = world.add.sprite(x, y, 'wk_orb', 'o0').setBlendMode(Phaser.BlendModes.ADD).play('wk_orb_spin').setScale(0.3);
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(T_VIOLET).setAlpha(0.4).setScale(0.6);
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1.5).setAlpha(0.45).setScale(1.2, 0.8);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const w = this.world;
    const hero = w.heroPos;
    if (hero) {
      const a = Math.atan2(this.uy, this.ux);
      const want = Math.atan2(hero.y - this.y, hero.x - this.x);
      const turn = Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - a), (-ORB_TURN * dt) / 1000, (ORB_TURN * dt) / 1000);
      this.ux = Math.cos(a + turn);
      this.uy = Math.sin(a + turn);
    }
    const d = (this.speed * dt) / 1000;
    const nx = this.x + this.ux * d;
    const ny = this.y + this.uy * d * 0.8;
    if (w.monsterBounds.contains(nx, ny)) {
      this.x = nx;
      this.y = ny;
    }
    // Sinking from the hand to its float, bobbing as it goes.
    this.h += (ORB_FLOAT - this.h) * Math.min(1, dt / 300);
    const bob = Math.sin(this.t * 0.006) * 2;
    const grow = Math.min(1, this.t / 250);
    const fade = Math.min(1, (ORB_LIFE - this.t) / 400);
    const py = snap(this.y - this.h - bob);
    this.img.setPosition(snap(this.x), py).setDepth(this.y + 1).setScale(0.3 + grow * 0.7).setAlpha(fade);
    this.halo.setPosition(this.x, py).setDepth(this.y + 0.9).setScale(0.55 + Math.sin(this.t * 0.01) * 0.06).setAlpha(0.4 * fade);
    this.shadow.setPosition(snap(this.x), snap(this.y)).setAlpha(0.45 * fade);
    this.trail -= dt;
    if (this.trail <= 0) {
      this.trail = 60;
      w.debris(SNOW_TINTS, this.x + (Math.random() - 0.5) * 12, py + (Math.random() - 0.5) * 10, 1, this.y + 0.8, 'trail');
    }
    if (grow >= 1 && hero && Math.hypot(hero.x - this.x, (hero.y - this.y) * 1.2) < 13) {
      this.burst(true);
      return;
    }
    if (this.t >= ORB_LIFE) this.burst(false);
  }

  /** It bursts in a whirl of snow: on the hero, it strikes and freezes them. */
  private burst(onHero: boolean): void {
    const w = this.world;
    if (onHero && w.hurtHeroInEllipse(this.x, this.y, 16, 10, { damage: this.damage, fromX: this.x, fromY: this.y - this.h, knock: 150 })) chill(w, CHILL_DEEP);
    iceBurst(w, this.x, this.y - this.h, onHero ? 16 : 8, this.y + 2);
    w.debris(WINTERKING_TINTS, snap(this.x), snap(this.y - this.h), onHero ? 10 : 4, this.y + 2, 'spores');
    sound.frost(onHero ? 'freeze' : 'chime', w.pan(this.x));
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
    this.halo.destroy();
    this.shadow.destroy();
  }
}

/**
 * Kaldr, the Lich of the Long Winter: the Aurora Colosseum's undead king, a
 * crowned skull with a beard of icicles, a violet mantle torn to rags, and
 * his own frozen heart in the claws of his staff. He walks slowly and casts:
 *   - Pillar Prison: a ring of ice pillars round the hero, one gap open, then the ring's heart erupts.
 *   - Blizzard Orbs: slow balls of snow that drift after the hero and burst on them.
 *   - Icicle Storm: icicles fall on and round the hero for a long breath, leaving him spent.
 *   - Nova: a hero who comes close is blasted back by his staff driven into the floor.
 * Below half health the Long Winter comes: frostbound rise to guard him (two
 * at most), his orbs come four at a time and his storm thickens. He can't be
 * staggered or shoved.
 */
export class WinterKing extends Monster {
  private skill: Skill = 'orbs';
  private last: Skill = 'storm';
  private enraged = false;
  private bossBar: BossBar;
  private light: Phaser.GameObjects.Light;
  private heartGlow: Phaser.GameObjects.Image;
  private phase = Math.random() * 1000;
  private power = 0;
  private novaCd = 0;
  private summonT = 0;
  private guard: Monster[] = [];

  private rune: Phaser.GameObjects.Image | null = null;
  private runes: Phaser.GameObjects.Image[] = [];
  private spikes: IceSpike[] = [];
  private stormT = 0;
  private stormN = 0;
  private orbsLeft = 0;
  private orbT = 0;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'winterking',
      hp: mobHp('winterking'),
      radius: 16,
      bodyY: 40,
      speed: SPEED,
      sight: 230,
      leash: 100000,
      mass: 40,
      barY: 100,
      debris: WINTERKING_TINTS,
      noBar: true,
      rank: 'legend',
    });
    this.cooldown = 1500;
    this.bossBar = new BossBar(world, 'Kaldr, the Winter King');
    this.light = world.lights.addLight(x, y - HEART_Y, 140, 0xb48aff, 0.95);
    this.heartGlow = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(T_VIOLET).setAlpha(0);
  }

  get pinned(): boolean {
    return true;
  }

  private get dir(): number {
    return this.facing === 'r' ? 1 : -1;
  }

  update(dt: number, target: Target | null, daylight: number): void {
    if (this.dead) return;
    this.phase += dt;
    this.novaCd = Math.max(0, this.novaCd - dt);
    if (this.enraged) this.summonT = Math.max(0, this.summonT - dt);
    super.update(dt, target, daylight);
    if (this.dead) return;
    this.guard = this.guard.filter((m) => !m.dead && m.state !== 'dying');
    this.spikes = this.spikes.filter((s) => !s.dead);
    const goal = this.state === 'windup' || this.state === 'attack' ? 1 : 0;
    this.power += (goal - this.power) * Math.min(1, dt / 250);
    this.dress();
    const fighting = this.state !== 'spawn' && this.state !== 'idle' && this.state !== 'wander' && this.state !== 'return';
    this.bossBar.update(dt, this.hp, this.maxHp, fighting && this.state !== 'dying', this.enraged);
  }

  /** His heart's light, beating; it rides up with the staff when he raises it. */
  private dress(): void {
    const fade = this.state === 'dying' ? Math.max(0, this.timer / 380) : this.state === 'spawn' ? 1 - this.timer / 700 : 1;
    // Two beats and a rest, like a heart.
    const t = (this.phase % 1400) / 1400;
    const beat = Math.max(0, Math.sin(t * Math.PI * 4)) * (t < 0.5 ? 1 : 0);
    const raised = this.state === 'windup' && (this.skill === 'storm' || this.skill === 'prison' || this.skill === 'summon') ? 9 : 0;
    const hx = this.x + this.dir * HEART_X;
    const hy = this.y - HEART_Y - raised;
    this.light.setPosition(hx, hy + 6);
    this.light.intensity = (0.8 + beat * 0.35 + this.power * 0.6 + (this.enraged ? 0.3 : 0)) * fade;
    this.heartGlow
      .setPosition(snap(hx), snap(hy))
      .setDepth(this.y + 0.3)
      .setScale(0.5 + beat * 0.2 + this.power * 0.3)
      .setAlpha((0.35 + beat * 0.25 + this.power * 0.25) * fade);
    if (this.enraged && Math.random() < 0.05 && fade > 0.5) this.world.debris(WINTERKING_TINTS, this.x + (Math.random() - 0.5) * 40, this.y - Math.random() * 80, 1, this.y + 1, 'spores');
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    if (dist < NOVA_REACH && this.novaCd === 0) {
      this.begin('nova', target);
      return;
    }
    if (this.cooldown === 0) {
      this.choose(target, dist);
      return;
    }
    // A slow, heavy stride toward a king's distance; he holds his ground when the hero comes to him.
    if (dist > KEEP_FAR) {
      const ux = (target.x - this.x) / dist;
      const uy = (target.y - this.y) / dist;
      if (this.world.walkable(this.x + ux * 8, this.y + uy * 8)) {
        this.move(dt, ux, uy, SPEED * (this.enraged ? 1.2 : 1));
        return;
      }
    } else if (dist < KEEP_NEAR && dist > 20) {
      // A step back, never turning his back.
      const ux = (this.x - target.x) / dist;
      const uy = (this.y - target.y) / dist;
      if (this.world.walkable(this.x + ux * 10, this.y + uy * 10)) {
        this.x += (ux * SPEED * 0.6 * dt) / 1000;
        this.y += (uy * SPEED * 0.6 * dt) / 1000;
        this.play('walk');
        return;
      }
    }
    this.play('idle');
  }

  private choose(target: Target, dist: number): void {
    let s: Skill;
    if (this.enraged && this.summonT === 0 && this.guard.length < GUARD) s = 'summon';
    else if (this.last === 'orbs') s = dist < 170 ? 'prison' : 'storm';
    else if (this.last === 'prison') s = 'storm';
    else s = 'orbs';
    this.begin(s, target);
  }

  private begin(s: Skill, target: Target): void {
    this.skill = s;
    if (s !== 'nova') this.last = s;
    this.face(target.x - this.x);
    const w = this.world;
    switch (s) {
      case 'nova': {
        this.novaCd = NOVA_EVERY;
        this.enter('windup', this.enraged ? RAGE_NOVA_LIFT : NOVA_LIFT);
        this.play('lift', true);
        this.rune ??= w.add.image(0, 0, 'wk_rune').setBlendMode(Phaser.BlendModes.ADD).setDepth(2.1);
        this.rune.setVisible(true).setPosition(snap(this.x), snap(this.y)).setTint(T_ICE).setScale(0.3).setAlpha(0);
        sound.swell(w.pan(this.x));
        break;
      }
      case 'prison':
        this.enter('windup', PRISON_CAST);
        this.play('raise', true);
        this.raisePrison(target);
        sound.frost('crunch', w.pan(this.x), true);
        break;
      case 'orbs':
        this.enter('windup', ORB_CAST);
        this.play('thrust', true);
        this.orbsLeft = this.enraged ? RAGE_ORBS : ORBS;
        sound.soulCast(w.pan(this.x));
        break;
      case 'storm':
        this.enter('windup', STORM_CAST);
        this.play('raise', true);
        this.stormN = 0;
        sound.frost('gust', w.pan(this.x), true);
        w.cameras.main.shake(STORM_CAST, 0.0012);
        break;
      case 'summon':
        this.enter('windup', SUMMON_CAST);
        this.play('summon', true);
        this.summonT = SUMMON_EVERY;
        this.markGuard();
        sound.raiseDead(w.pan(this.x));
        break;
    }
  }

  protected act(dt: number, target: Target | null): void {
    if (!target) {
      this.onInterrupted();
      this.enter('return', 0);
      return;
    }
    switch (this.skill) {
      case 'nova':
        this.actNova();
        break;
      case 'prison':
        this.actCast(dt);
        break;
      case 'orbs':
        this.actOrbs(dt, target);
        break;
      case 'storm':
        this.actStorm(dt, target);
        break;
      case 'summon':
        this.actSummon(dt);
        break;
    }
  }

  // ---------------------------------------------------------------- Nova

  private actNova(): void {
    const w = this.world;
    if (this.state === 'windup') {
      const total = this.enraged ? RAGE_NOVA_LIFT : NOVA_LIFT;
      const k = 1 - this.timer / total;
      this.rune
        ?.setScale(((NOVA_RX * 2) / WK_RUNE_W) * (0.4 + k * 0.6))
        .setAlpha(0.3 + k * 0.6)
        .setRotation(k * 0.4);
      if (Math.random() < 0.3) w.debris(SNOW_TINTS, this.x + (Math.random() - 0.5) * NOVA_RX * 2, this.y + (Math.random() - 0.5) * NOVA_RY, 1, this.y + 1, 'gather');
      if (this.timer <= 0) {
        this.rune?.setVisible(false);
        this.enter('attack', 260);
        this.play('slam', true);
        if (w.hurtHeroInEllipse(this.x, this.y, NOVA_RX, NOVA_RY, { damage: mobHit('winterking', 1), fromX: this.x, fromY: this.y - 10, knock: 290 })) chill(w, CHILL_DEEP);
        w.addEffect(new FrostRing(w, this.x, this.y, { from: 20, to: this.enraged ? 120 : 100, speed: 200, damage: mobHit('winterking', 0.5), knock: 200, tint: T_VIOLET }));
        iceBurst(w, this.x + this.dir * 30, this.y - 2, 22);
        w.debris(WINTERKING_TINTS, snap(this.x), snap(this.y) - 4, 20, this.y + 2, 'spores');
        w.cameras.main.shake(240, 0.0045);
        sound.slam(w.pan(this.x));
        sound.frost('crack', w.pan(this.x), true);
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) this.rest(RECOVER);
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  // ---------------------------------------------------------------- Pillar Prison

  /** The ring of pillars round the hero, one gap left, and the eruption at its heart after. */
  private raisePrison(target: Target): void {
    const w = this.world;
    const gap = Math.floor(Math.random() * PRISON_N);
    const a0 = Math.random() * Math.PI * 2;
    const dmg = mobHit('winterking', 0.8);
    for (let i = 0; i < PRISON_N; i++) {
      // Two neighbours left out: the way out.
      if (i === gap || i === (gap + 1) % PRISON_N) continue;
      const a = a0 + (i / PRISON_N) * Math.PI * 2;
      const x = target.x + Math.cos(a) * PRISON_RX;
      const y = target.y + Math.sin(a) * PRISON_RY;
      if (!w.walkable(x, y)) continue;
      const s = new IceSpike(w, x, y, { delay: PRISON_RING + (i % 2) * 40, damage: dmg, stand: 2300, size: 1.1, quiet: i !== 0, chill: CHILL_LIGHT });
      this.spikes.push(s);
      w.addEffect(s);
    }
    const heart = new IceSpike(w, target.x, target.y, { delay: PRISON_HEART, damage: mobHit('winterking', 1.05), stand: 1400, size: 1.6, chill: CHILL_DEEP, knock: 220 });
    this.spikes.push(heart);
    w.addEffect(heart);
  }

  private actCast(dt: number): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (Math.random() < dt / 40) w.debris(WINTERKING_TINTS, this.x + this.dir * HEART_X + (Math.random() - 0.5) * 12, this.y - HEART_Y - 9 + (Math.random() - 0.5) * 12, 1, this.y + 1, 'gather');
      if (this.timer <= 0) {
        this.enter('attack', PRISON_HEART - PRISON_CAST + 200);
        w.cameras.main.shake(180, 0.002);
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) this.rest(RECOVER);
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  // ---------------------------------------------------------------- Blizzard orbs

  private actOrbs(dt: number, target: Target): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (Math.random() < dt / 35) w.debris(WINTERKING_TINTS, this.x + this.dir * HAND_X + (Math.random() - 0.5) * 14, this.y - HAND_Y + (Math.random() - 0.5) * 14, 1, this.y + 1, 'gather');
      if (this.timer <= 0) {
        this.enter('attack', 99999);
        this.orbT = 0;
      }
      return;
    }
    if (this.state === 'attack') {
      this.orbT -= dt;
      if (this.orbsLeft > 0 && this.orbT <= 0) {
        this.orbT = 200;
        const total = this.enraged ? RAGE_ORBS : ORBS;
        const i = total - this.orbsLeft;
        // Fanned out, so they come at the hero from different sides.
        const base = Math.atan2(target.y - this.y, target.x - this.x);
        const a = base + (i - (total - 1) / 2) * 0.7;
        const hx = this.x + this.dir * HAND_X;
        w.addEffect(new BlizzardOrb(w, hx, this.y + 2, HAND_Y, Math.cos(a), Math.sin(a), this.enraged ? RAGE_ORB_SPEED : ORB_SPEED, mobHit('winterking', 0.7)));
        w.debris(WINTERKING_TINTS, snap(hx), snap(this.y - HAND_Y), 8, this.y + 2);
        sound.frost('freeze', w.pan(this.x));
        this.orbsLeft--;
      }
      if (this.orbsLeft <= 0 && this.orbT <= 0) this.rest(RECOVER);
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  // ---------------------------------------------------------------- Icicle Storm

  private actStorm(dt: number, target: Target): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (Math.random() < dt / 30) w.debris(SNOW_TINTS, this.x + (Math.random() - 0.5) * 50, this.y - 100 - Math.random() * 20, 1, this.y + 1, 'spores');
      if (this.timer <= 0) {
        this.enter('attack', STORM);
        this.stormT = 0;
        sound.frost('howl', w.pan(this.x), true);
      }
      return;
    }
    if (this.state === 'attack') {
      this.stormT -= dt;
      if (this.stormT <= 0) {
        this.stormT = this.enraged ? RAGE_STORM_GAP : STORM_GAP;
        // Every third falls on the hero; the rest all round them.
        let x = target.x;
        let y = target.y;
        if (this.stormN % 3 !== 0) {
          const a = Math.random() * Math.PI * 2;
          const r = 20 + Math.random() * STORM_SPREAD;
          x += Math.cos(a) * r;
          y += Math.sin(a) * r * 0.7;
        }
        if (w.walkable(x, y)) w.addEffect(new Icicle(w, x, y, { delay: 950, damage: mobHit('winterking', 0.7), size: 1 + Math.random() * 0.3, chill: CHILL_LIGHT, patch: this.stormN % 4 === 0 ? 1500 : 0, quiet: this.stormN % 2 === 1 }));
        this.stormN++;
      }
      if (this.timer <= 0) this.rest(SPENT);
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  // ---------------------------------------------------------------- Raise the Fallen

  /** Rune circles on the floor at his sides, where the dead will rise. */
  private markGuard(): void {
    const w = this.world;
    this.clearRunes();
    for (const side of [-1, 1]) {
      let x = this.x + side * 44;
      let y = this.y + 10;
      if (!w.walkable(x, y)) {
        x = this.x + side * 24;
        y = this.y + 24;
      }
      this.runes.push(w.add.image(snap(x), snap(y), 'wk_rune').setBlendMode(Phaser.BlendModes.ADD).setDepth(2.1).setTint(T_VIOLET).setScale(0.2).setAlpha(0));
    }
  }

  private actSummon(dt: number): void {
    const w = this.world;
    if (this.state === 'windup') {
      const k = 1 - this.timer / SUMMON_CAST;
      for (const r of this.runes) {
        r.setScale(0.25 + k * 0.4).setAlpha(0.3 + k * 0.6).setRotation(k * 0.6);
        if (Math.random() < dt / 60) w.debris(WINTERKING_TINTS, r.x + (Math.random() - 0.5) * 30, r.y - Math.random() * 6, 1, r.y + 1, 'spores');
      }
      if (this.timer <= 0) {
        for (const r of this.runes) {
          if (this.guard.length >= GUARD) break;
          const m = w.summon('frostbound', r.x, r.y);
          if (m) this.guard.push(m);
          iceBurst(w, r.x, r.y - 8, 16);
        }
        this.clearRunes();
        w.cameras.main.shake(220, 0.003);
        sound.boneCrumble(w.pan(this.x));
        this.enter('attack', 400);
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) this.rest(800);
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private clearRunes(): void {
    for (const r of this.runes) r.destroy();
    this.runes = [];
  }

  // ---------------------------------------------------------------- Rest, rage and the end

  /** The spell is spent: his guard is down. */
  private rest(ms: number): void {
    this.enter('recover', ms);
    this.play('idle', true);
    this.cooldown = (this.enraged ? 600 : 1000) + Math.random() * 700;
  }

  protected afterHit(): void {
    if (!this.enraged && this.alive && this.hp < this.maxHp / 2) {
      this.enraged = true;
      // The dead answer at once.
      this.summonT = 0;
      this.cooldown = Math.min(this.cooldown, 400);
      this.light.setColor(0xd0b8ff);
      this.world.popNumber(snap(this.x), snap(this.y) - 104, 'THE LONG WINTER', 0xd8c8ff);
      this.world.debris(WINTERKING_TINTS, snap(this.x), snap(this.y) - 50, 34, this.y + 40, 'spores');
      iceBurst(this.world, this.x, this.y - 40, 24, this.y + 40);
      this.world.cameras.main.shake(240, 0.003);
      sound.frost('howl', this.world.pan(this.x), true);
    }
  }

  /** The staff raised to the sky, his heart blazing. */
  protected flourish(): void {
    this.play('raise', true);
  }

  protected staggers(): boolean {
    return false;
  }

  protected onInterrupted(): void {
    this.rune?.setVisible(false);
    this.clearRunes();
    // Pillars still waiting to rise go with him.
    for (const s of this.spikes) s.destroy();
    this.spikes = [];
    this.orbsLeft = 0;
  }

  protected onDeath(): void {
    const w = this.world;
    for (let i = 0; i < 5; i++) {
      w.time.delayedCall(i * 150, () => iceBurst(w, this.x + (Math.random() - 0.5) * 50, this.y - 10 - Math.random() * 80, 18, this.y + 40));
    }
    // His heart shatters last.
    w.time.delayedCall(700, () => {
      iceBurst(w, this.x + this.dir * HEART_X, this.y - HEART_Y, 26, this.y + 40);
      w.debris(WINTERKING_TINTS, snap(this.x + this.dir * HEART_X), snap(this.y - HEART_Y), 30, this.y + 40, 'spores');
      sound.shatter(w.pan(this.x), true);
    });
    w.cameras.main.flash(380, 220, 200, 255);
    w.cameras.main.shake(420, 0.004);
    w.popNumber(snap(this.x), snap(this.y) - 104, 'THE WINTER BREAKS', 0xd8c8ff);
    sound.nova();
  }

  destroy(): void {
    if (this.dead) return;
    super.destroy();
    this.bossBar.destroy();
    this.heartGlow.destroy();
    this.rune?.destroy();
    this.rune = null;
    this.world.lights.removeLight(this.light);
  }
}
