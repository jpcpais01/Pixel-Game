import Phaser from 'phaser';
import { MONSTER_FRAME } from '../../art/monsters';
import { VARGR_MOUTH, VARGR_TINTS, VG_CONE_HALF, VG_CONE_W } from '../../art/vargr';
import { SNOW_TINTS, T_AURORA, T_ICE } from '../../art/frostKit';
import { snap } from '../display';
import { sound } from '../../audio';
import { BossBar } from '../BossBar';
import type { WorldScene } from '../../scenes/WorldScene';
import { CHILL_DEEP, CHILL_LIGHT, FrostRing, chill, dangerMark, frostLane, iceBurst, layLane } from './frostFx';
import { Monster, type Target } from './Monster';
import { mobHit, mobHp } from '../tiers';

const FRAME = MONSTER_FRAME.vargr;
/** Its muzzle, from its feet (facing right). */
const MOUTH_DX = VARGR_MOUTH.x - FRAME.ox;
const MOUTH_DY = FRAME.oy - VARGR_MOUTH.y;
/** The middle of its mane above its feet, where its light burns. */
const MANE_Y = 48;

// Prowling: between moves it circles the hero at a wolf's distance, never
// quite still, the way a pack worries its prey.
const PROWL_R = 96;
const PROWL_TURN = 0.55;
const SPEED = 58;
const RAGE_SPEED = 1.25;
const REST_MIN = 900;
const REST_SPREAD = 600;

// Pounce: it crouches (its landing marked on the snow, following the hero,
// then fixed), leaps in a great arc and lands in a burst of frost; again,
// and again. Then it stands panting: the moment to strike.
const CROUCH = 720;
const RAGE_CROUCH = 540;
/** Share of the crouch the mark follows the hero before it settles. */
const TRACK = 0.6;
const FLIGHT = 470;
const LEAP_ARC = 30;
const LEAP_MIN = 40;
const LEAP_MAX = 170;
const LAND_RX = 30;
const LAND_RY = 18;
const LAND_PAUSE = 360;
const POUNCES = 2;
const RAGE_POUNCES = 3;
const PANT = 1500;
const RAGE_PANT = 1100;

// Frost breath: it draws breath (the wedge it will sweep shows on the snow),
// then sweeps a cone of freezing breath across it, side to side.
const INHALE = 980;
const RAGE_INHALE = 800;
const SWEEP = 1350;
/** Half the arc it sweeps, and the half-width of the breath at any moment. */
const SWEEP_HALF = 0.85;
const BREATH_HALF = 0.21;
const BREATH_RANGE = 132;
const BREATH_TICK = 320;
const BILLOWS = 14;
const BILLOW_SPEED = 210;

// Howl: it throws back its head and the pack answers through the gates;
// the howl itself shoves the hero back on a ring of frost.
const HOWL = 1350;
const HOWL_CALL = 0.55;
const HOWL_FIRST = 7000;
const HOWL_EVERY = 17000;
const RAGE_HOWL_EVERY = 12500;
const PACK = 2;
const RAGE_PACK = 3;

// Swipe: anything that crowds its chest is raked aside.
const SWIPE_REACH = 50;
const RAISE = 540;
const RAGE_RAISE = 440;
const SWIPE_RX = 30;
const SWIPE_RY = 18;
const SWIPE_RECOVER = 650;

type Move = 'pounce' | 'breath' | 'howl' | 'swipe';

/**
 * Vargr, the Winterfang: the Aurora Colosseum's wolf, a frost wolf twice a
 * hero's height with a mane of ice crystals lit by the aurora. It prowls
 * round the hero between four moves:
 *   - Pounce: chained leaps, each landing marked on the snow, each landing a burst of frost.
 *   - Frost Breath: a wedge of breath swept across the snow, chilling deep.
 *   - Howl: two rimefangs answer (never more than two at its side), and the howl shoves the hero back.
 *   - Swipe: a raking paw for a hero who crowds it.
 * After its pounces and its breath it stands panting, open to blows. Below
 * half health its mane blazes: it prowls faster, crouches shorter, pounces
 * three times and howls up a bigger pack. It can't be staggered or shoved.
 */
export class Vargr extends Monster {
  private move_: Move = 'pounce';
  private lastMove: Move = 'breath';
  private enraged = false;
  private bossBar: BossBar;
  private light: Phaser.GameObjects.Light;
  private halo: Phaser.GameObjects.Image;
  /** The mane blazing: its glow layer again, tinted aurora, once it is enraged. */
  private blaze: Phaser.GameObjects.Sprite;
  private phase = Math.random() * 1000;
  private power = 0;
  /** Which way it circles the hero, and where round them it is. */
  private circle = Math.random() < 0.5 ? 1 : -1;
  private steamT = 0;
  private stepT = 0;
  private howlT = HOWL_FIRST;
  private pack: Monster[] = [];

  // Pounce.
  private leaps = 0;
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private toY = 0;
  private mark: Phaser.GameObjects.Image | null = null;
  private lane: Phaser.GameObjects.Image | null = null;
  private flying = false;

  // Breath.
  private apexX = 0;
  private apexY = 0;
  private a0 = 0;
  private a1 = 0;
  private aim = 0;
  private cones: Phaser.GameObjects.Image[] = [];
  private billows: { img: Phaser.GameObjects.Sprite; d: number; a: number; live: boolean }[] = [];
  private billowT = 0;
  private breathTick = 0;

  // Howl and swipe.
  private called = false;
  private swipeMark: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'vargr',
      hp: mobHp('vargr'),
      radius: 22,
      bodyY: 30,
      speed: SPEED,
      sight: 230,
      leash: 100000,
      mass: 30,
      barY: 76,
      debris: VARGR_TINTS,
      noBar: true,
      rank: 'legend',
    });
    this.cooldown = 1600;
    this.bossBar = new BossBar(world, 'Vargr, the Winterfang');
    this.light = world.lights.addLight(x, y - MANE_Y, 140, 0x8ad8ff, 0.9);
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(T_ICE).setAlpha(0);
    this.blaze = world.add
      .sprite(x, y, 'vargr_e')
      .setOrigin(FRAME.ox / FRAME.w, FRAME.oy / FRAME.h)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x9affd8)
      .setVisible(false);
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
    if (this.state !== 'spawn' && this.state !== 'idle' && this.state !== 'wander') this.howlT -= dt;
    super.update(dt, target, daylight);
    if (this.dead) return;
    this.pack = this.pack.filter((m) => !m.dead && m.state !== 'dying');
    const goal = this.state === 'windup' || this.state === 'attack' ? 1 : 0;
    this.power += (goal - this.power) * Math.min(1, dt / 250);
    this.dress(dt);
    const fighting = this.state !== 'spawn' && this.state !== 'idle' && this.state !== 'wander' && this.state !== 'return';
    this.bossBar.update(dt, this.hp, this.maxHp, fighting && this.state !== 'dying', this.enraged);
  }

  /** Its light, the blaze of its mane, and the steam of its breath. */
  private dress(dt: number): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const fade = this.state === 'dying' ? Math.max(0, this.timer / 380) : this.state === 'spawn' ? 1 - this.timer / 700 : 1;
    const pulse = 0.88 + Math.sin(this.phase * 0.004) * 0.12;
    this.light.setPosition(this.x, this.y - MANE_Y - this.hover);
    this.light.intensity = (0.85 + this.power * 0.6 + (this.enraged ? 0.35 : 0)) * pulse * fade;
    this.halo
      .setPosition(rx - this.dir * 8, ry - MANE_Y - this.hover)
      .setDepth(ry - 0.3)
      .setScale(1.9 + this.power * 0.5, 1.2 + this.power * 0.3)
      .setAlpha((0.12 + this.power * 0.12 + (this.enraged ? 0.12 : 0)) * pulse * fade);
    const frame = this.body.frame.name;
    this.blaze.setVisible(this.enraged && fade > 0);
    if (this.enraged) {
      this.blaze
        .setFrame(frame)
        .setPosition(this.body.x, this.body.y)
        .setScale(this.body.scaleX, this.body.scaleY)
        .setDepth(ry + 0.15)
        .setAlpha((0.45 + Math.sin(this.phase * 0.011) * 0.2) * fade);
    }
    // Its breath smokes in the cold; footfalls kick up snow.
    this.steamT -= dt;
    if (this.steamT <= 0 && fade > 0.5 && this.move_ !== 'breath') {
      this.steamT = 520 + Math.random() * 300;
      this.world.debris(SNOW_TINTS, rx + this.dir * MOUTH_DX, ry - MOUTH_DY - this.hover + 6, 2, this.y + 1, 'spores');
    }
    if (this.state === 'chase' && this.body.anims.currentAnim?.key.startsWith('vargr_walk')) {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 190;
        this.world.debris(SNOW_TINTS, rx + (Math.random() - 0.5) * 40, ry - 1, 1, this.y + 1, 'trail');
      }
    }
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.cooldown === 0) {
      this.choose(target, dist);
      return;
    }
    // Circle the hero at a wolf's distance, turning back when the wall is in the way.
    const speed = SPEED * (this.enraged ? RAGE_SPEED : 1);
    let a = Math.atan2(this.y - target.y, this.x - target.x) + this.circle * PROWL_TURN;
    let gx = target.x + Math.cos(a) * PROWL_R;
    let gy = target.y + Math.sin(a) * PROWL_R * 0.7;
    if (!this.world.walkable(gx, gy) || !this.world.monsterBounds.contains(gx, gy)) {
      this.circle = -this.circle;
      a = Math.atan2(this.y - target.y, this.x - target.x) + this.circle * PROWL_TURN;
      gx = target.x + Math.cos(a) * PROWL_R * 0.8;
      gy = target.y + Math.sin(a) * PROWL_R * 0.56;
    }
    const dx = gx - this.x;
    const dy = gy - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 4) this.move(dt, dx / d, dy / d, speed);
    else this.play('idle');
    // It keeps its eyes on its prey while it circles close.
    if (dist < PROWL_R * 1.2) this.face(target.x - this.x);
  }

  private choose(target: Target, dist: number): void {
    const close = dist < SWIPE_REACH && Math.abs(target.y - this.y) < 26;
    const packCap = this.enraged ? RAGE_PACK : PACK;
    let m: Move;
    if (close && Math.random() < 0.75) m = 'swipe';
    else if (this.howlT <= 0 && this.pack.length < packCap) m = 'howl';
    else if (this.lastMove !== 'breath' && dist > 50 && dist < BREATH_RANGE * 0.95) m = 'breath';
    else m = 'pounce';
    this.begin(m, target);
  }

  private begin(m: Move, target: Target): void {
    this.move_ = m;
    if (m !== 'swipe') this.lastMove = m;
    this.face(target.x - this.x);
    const w = this.world;
    switch (m) {
      case 'pounce':
        this.leaps = this.enraged ? RAGE_POUNCES : POUNCES;
        this.crouch(target);
        break;
      case 'breath':
        this.inhale(target);
        break;
      case 'howl':
        this.called = false;
        this.enter('windup', HOWL);
        this.play('howl', true);
        this.howlT = this.enraged ? RAGE_HOWL_EVERY : HOWL_EVERY;
        sound.frost('howl', w.pan(this.x), true);
        w.cameras.main.shake(HOWL * 0.6, 0.0016);
        break;
      case 'swipe':
        this.enter('windup', this.enraged ? RAGE_RAISE : RAISE);
        this.play('raise', true);
        this.swipeMark = dangerMark(w, this.x + this.dir * 28, this.y + 2, SWIPE_RX, SWIPE_RY, T_ICE);
        sound.roar(w.pan(this.x));
        break;
    }
  }

  protected act(dt: number, target: Target | null): void {
    if (!target && !this.flying) {
      this.onInterrupted();
      this.enter('return', 0);
      return;
    }
    switch (this.move_) {
      case 'pounce':
        this.actPounce(dt, target);
        break;
      case 'breath':
        this.actBreath(dt);
        break;
      case 'howl':
        this.actHowl(target);
        break;
      case 'swipe':
        this.actSwipe(target);
        break;
    }
  }

  // ---------------------------------------------------------------- Pounce

  private crouch(target: Target): void {
    const w = this.world;
    this.enter('windup', this.enraged ? RAGE_CROUCH : CROUCH);
    this.play('crouch', true);
    this.aimLeap(target);
    this.mark ??= dangerMark(w, this.toX, this.toY, LAND_RX, LAND_RY, T_ICE);
    this.lane ??= frostLane(w, this.x, this.y, 1.4, T_ICE);
    this.mark.setVisible(true);
    this.lane.setVisible(true);
    sound.frost('crunch', w.pan(this.x));
  }

  /** Where the leap will land: on the hero, within its reach, on the floor. */
  private aimLeap(target: Target): void {
    let dx = target.x - this.x;
    let dy = target.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const reach = Phaser.Math.Clamp(d, LEAP_MIN, LEAP_MAX);
    dx /= d;
    dy /= d;
    let tx = this.x + dx * reach;
    let ty = this.y + dy * reach;
    // Short of a wall, on ground it can stand on.
    for (let k = 0; k < 8 && !(this.world.walkable(tx, ty) && this.world.monsterBounds.contains(tx, ty)); k++) {
      tx -= dx * reach * 0.12;
      ty -= dy * reach * 0.12;
    }
    this.toX = tx;
    this.toY = ty;
  }

  private actPounce(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      const total = this.enraged ? RAGE_CROUCH : CROUCH;
      const k = 1 - this.timer / total;
      // The mark follows the hero, then settles: the moment to step aside.
      if (k < TRACK && target) {
        this.aimLeap(target);
        this.face(target.x - this.x);
      }
      const locked = k >= TRACK;
      this.mark
        ?.setPosition(snap(this.toX), snap(this.toY))
        .setTint(locked ? 0xe8fbff : T_ICE)
        .setScale((LAND_RX / 22) * (0.75 + k * 0.25), (LAND_RY / 12) * (0.75 + k * 0.25))
        .setAlpha(0.35 + k * 0.5 + (locked ? Math.sin(this.phase * 0.04) * 0.1 : 0));
      if (this.lane) {
        const dx = this.toX - this.x;
        const dy = this.toY - this.y;
        const len = Math.hypot(dx, dy) || 1;
        layLane(this.lane, this.x, this.y, dx / len, dy / len, len, 1.4, 0.12 + k * 0.3);
      }
      if (Math.random() < dt / 60) w.debris(SNOW_TINTS, this.x - this.dir * 20 + (Math.random() - 0.5) * 16, this.y - 1, 1, this.y + 1, 'trail');
      if (this.timer <= 0) {
        this.fromX = this.x;
        this.fromY = this.y;
        this.flying = true;
        this.lane?.setVisible(false);
        this.face(this.toX - this.x);
        this.enter('attack', FLIGHT);
        this.play('leap', true);
        sound.windDash(w.pan(this.x));
        w.debris(SNOW_TINTS, snap(this.x), snap(this.y) - 2, 10, this.y + 1);
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.flying) {
        const k = 1 - this.timer / FLIGHT;
        const e = k * k * (3 - 2 * k);
        this.x = this.fromX + (this.toX - this.fromX) * e;
        this.y = this.fromY + (this.toY - this.fromY) * e;
        this.hover = Math.sin(Math.min(1, k) * Math.PI) * LEAP_ARC;
        if (this.timer <= 0) this.land();
        return;
      }
      // Gathering itself after a landing: then again, or done.
      if (this.timer <= 0) {
        if (this.leaps > 0 && target) this.crouch(target);
        else this.rest(this.enraged ? RAGE_PANT : PANT);
      }
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private land(): void {
    const w = this.world;
    this.flying = false;
    this.hover = 0;
    this.x = this.toX;
    this.y = this.toY;
    this.leaps--;
    this.mark?.setVisible(false);
    this.enter('attack', LAND_PAUSE);
    this.play('land', true);
    if (w.hurtHeroInEllipse(this.x + this.dir * 10, this.y, LAND_RX, LAND_RY, { damage: mobHit('vargr', 1), fromX: this.x, fromY: this.y - 10, knock: 230 })) chill(w, CHILL_LIGHT);
    w.addEffect(new FrostRing(w, this.x + this.dir * 10, this.y, { from: 12, to: this.enraged ? 84 : 70, speed: 190, damage: mobHit('vargr', 0.4), knock: 140 }));
    iceBurst(w, this.x + this.dir * 16, this.y - 4, 18);
    w.debris(SNOW_TINTS, snap(this.x), snap(this.y) - 3, 14, this.y + 2, 'spores');
    w.cameras.main.shake(200, 0.004);
    sound.thud(w.pan(this.x), true);
    sound.frost('crack', w.pan(this.x), true);
  }

  // ---------------------------------------------------------------- Breath

  private inhale(target: Target): void {
    const w = this.world;
    this.enter('windup', this.enraged ? RAGE_INHALE : INHALE);
    this.play('inhale', true);
    // The breath leaves from the snow under its muzzle, toward the hero but never behind it.
    this.apexX = this.x + this.dir * (MOUTH_DX - 10);
    this.apexY = this.y + 2;
    const base = this.dir > 0 ? 0 : Math.PI;
    const want = Math.atan2(target.y - this.apexY, target.x - this.apexX);
    this.aim = base + Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - base), -0.9, 0.9);
    const side = Math.random() < 0.5 ? 1 : -1;
    this.a0 = this.aim - side * SWEEP_HALF;
    this.a1 = this.aim + side * SWEEP_HALF;
    // Its wedge on the snow, laid out across the sweep.
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = this.a0 + ((this.a1 - this.a0) * (i + 0.5)) / n;
      const cone = this.cones[i] ?? w.add.image(0, 0, 'vg_cone').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(2.2);
      this.cones[i] = cone;
      cone
        .setVisible(true)
        .setPosition(snap(this.apexX), snap(this.apexY))
        .setRotation(a)
        .setScale(BREATH_RANGE / VG_CONE_W, ((SWEEP_HALF * 2) / n / (VG_CONE_HALF * 2)) * 1.15 * (BREATH_RANGE / VG_CONE_W))
        .setTint(T_ICE)
        .setAlpha(0);
    }
    sound.swell(w.pan(this.x));
  }

  private actBreath(dt: number): void {
    const w = this.world;
    if (this.state === 'windup') {
      const total = this.enraged ? RAGE_INHALE : INHALE;
      const k = 1 - this.timer / total;
      // The wedge brightens, its first slice first: the way the breath will go.
      this.cones.forEach((c, i) => c.setAlpha((0.15 + k * 0.35) * (1 - i * 0.1) + Math.sin(this.phase * 0.03 + i) * 0.05));
      if (Math.random() < dt / 45) {
        const a = Math.random() * Math.PI * 2;
        const mx = this.x + this.dir * MOUTH_DX;
        const my = this.y - MOUTH_DY;
        w.debris([0xffffff, 0x9ae8ff], mx + Math.cos(a) * 18, my + Math.sin(a) * 12, 1, this.y + 1, 'gather');
      }
      if (this.timer <= 0) {
        this.enter('attack', SWEEP);
        this.play('breathe', true);
        this.breathTick = 0;
        this.billowT = 0;
        for (const c of this.cones) c.setAlpha(0.08);
        sound.frost('gust', w.pan(this.x), true);
        sound.frost('freeze', w.pan(this.x), true);
        w.cameras.main.shake(SWEEP, 0.0012);
      }
      return;
    }
    if (this.state === 'attack') {
      const k = Phaser.Math.Clamp(1 - this.timer / SWEEP, 0, 1);
      const e = k * k * (3 - 2 * k);
      const a = this.a0 + (this.a1 - this.a0) * e;
      this.cones.forEach((c, i) => {
        const ca = this.a0 + ((this.a1 - this.a0) * (i + 0.5)) / this.cones.length;
        const near = Math.max(0, 1 - Math.abs(Phaser.Math.Angle.Wrap(ca - a)) / 0.5);
        c.setAlpha(0.06 + near * 0.35).setTint(near > 0.5 ? 0xe8fbff : T_ICE);
      });
      this.emitBillows(dt, a);
      // Anyone in the breath right now is struck and frozen, every so often.
      this.breathTick -= dt;
      const h = w.heroPos;
      if (h && this.breathTick <= 0) {
        const dx = h.x - this.apexX;
        const dy = h.y - this.apexY;
        const d = Math.hypot(dx, dy);
        if (d < BREATH_RANGE && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - a)) < BREATH_HALF + 10 / Math.max(20, d)) {
          this.breathTick = BREATH_TICK;
          w.hurtHero({ damage: mobHit('vargr', 0.3), fromX: this.apexX, fromY: this.apexY - 20, knock: 70 });
          chill(w, CHILL_DEEP);
        }
      }
      if (this.timer <= 0) {
        this.hideBreath();
        this.rest(this.enraged ? RAGE_PANT * 0.8 : PANT * 0.75);
      }
      return;
    }
    this.flowBillows(dt);
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** Billows of freezing breath rolling out of its jaws along the sweep. */
  private emitBillows(dt: number, a: number): void {
    this.billowT -= dt;
    if (this.billowT <= 0) {
      this.billowT = 55;
      let b = this.billows.find((x) => !x.live);
      if (!b && this.billows.length < BILLOWS) {
        b = { img: this.world.add.sprite(0, 0, 'vg_breath', 'b0').setBlendMode(Phaser.BlendModes.ADD).play('vg_breath_roll'), d: 0, a: 0, live: false };
        this.billows.push(b);
      }
      if (b) {
        b.live = true;
        b.d = 0;
        b.a = a + (Math.random() - 0.5) * BREATH_HALF;
        b.img.setVisible(true).setFlipY(Math.random() < 0.5);
      }
    }
    this.flowBillows(dt);
  }

  private flowBillows(dt: number): void {
    for (const b of this.billows) {
      if (!b.live) continue;
      b.d += (BILLOW_SPEED * dt) / 1000;
      const k = b.d / BREATH_RANGE;
      if (k >= 1) {
        b.live = false;
        b.img.setVisible(false);
        if (Math.random() < 0.35) this.world.debris(SNOW_TINTS, this.apexX + Math.cos(b.a) * BREATH_RANGE, this.apexY + Math.sin(b.a) * BREATH_RANGE - 3, 2, this.apexY + 2, 'spores');
        continue;
      }
      const gx = this.apexX + Math.cos(b.a) * b.d;
      const gy = this.apexY + Math.sin(b.a) * b.d;
      // Out of the jaws in the air, settling onto the snow as it rolls on.
      const lift = (MOUTH_DY - 4) * Math.max(0, 1 - k * 1.6) + 4;
      b.img
        .setPosition(gx, gy - lift)
        .setDepth(gy + 1)
        .setScale(0.6 + k * 1.5)
        .setAlpha(Math.min(1, (1 - k) * 1.6) * 0.85);
    }
  }

  private hideBreath(): void {
    for (const c of this.cones) c.setVisible(false);
  }

  // ---------------------------------------------------------------- Howl

  private actHowl(target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (!this.called && this.timer <= HOWL * (1 - HOWL_CALL)) {
        this.called = true;
        this.callPack(target);
        w.addEffect(new FrostRing(w, this.x, this.y, { from: 16, to: 120, speed: 230, damage: mobHit('vargr', 0.35), knock: 260, tint: T_AURORA }));
        w.debris(VARGR_TINTS, snap(this.x), snap(this.y) - MANE_Y, 24, this.y + 2, 'spores');
        w.cameras.main.shake(260, 0.003);
      }
      if (this.timer <= 0) this.rest(700);
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** The pack answers: rimefangs bound in at its flanks, never more than its pack's size. */
  private callPack(target: Target | null): void {
    const w = this.world;
    const cap = this.enraged ? RAGE_PACK : PACK;
    const want = Math.min(2, cap - this.pack.length);
    const ty = target?.y ?? this.y;
    for (let i = 0; i < want; i++) {
      const side = i === 0 ? -1 : 1;
      let sx = this.x + side * 46;
      let sy = this.y + (ty > this.y ? 18 : -18) * (i === 0 ? 1 : -1);
      if (!w.walkable(sx, sy)) {
        sx = this.x - side * 30;
        sy = this.y;
      }
      const m = w.summon('rimefang', sx, sy);
      if (m) {
        this.pack.push(m);
        iceBurst(w, sx, sy - 6, 12);
      }
    }
  }

  // ---------------------------------------------------------------- Swipe

  private actSwipe(target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      const total = this.enraged ? RAGE_RAISE : RAISE;
      const k = 1 - this.timer / total;
      this.swipeMark?.setAlpha(0.35 + k * 0.5).setScale((SWIPE_RX / 22) * (0.7 + k * 0.3), (SWIPE_RY / 12) * (0.7 + k * 0.3));
      if (this.timer <= 0) {
        this.swipeMark?.destroy();
        this.swipeMark = null;
        this.enter('attack', 160);
        this.play('swipe', true);
        const cx = this.x + this.dir * 28;
        w.hurtHeroInEllipse(cx, this.y + 2, SWIPE_RX, SWIPE_RY, { damage: mobHit('vargr', 0.85), fromX: this.x, fromY: this.y - 20, knock: 250 });
        const claw = w.add
          .sprite(snap(cx), snap(this.y) - 16, 'vg_claw', 'c0')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setFlipX(this.dir < 0)
          .setDepth(this.y + 2)
          .play('vg_claw_rake');
        claw.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => claw.destroy());
        iceBurst(w, cx, this.y - 2, 10);
        w.cameras.main.shake(140, 0.003);
        sound.rake(w.pan(this.x), true);
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.timer <= 0) {
        this.enter('recover', SWIPE_RECOVER);
        this.play('idle', true);
        this.cooldown = 500 + Math.random() * 400;
      }
      return;
    }
    if (target) this.face(target.x - this.x);
    if (this.timer <= 0) this.enter('chase', 0);
  }

  // ---------------------------------------------------------------- Rest, rage and the end

  /** Spent: it stands panting, steam pouring off it, open to the hero's blows. */
  private rest(ms: number): void {
    this.enter('recover', ms);
    this.play(ms > 900 ? 'pant' : 'idle', true);
    this.cooldown = (this.enraged ? 600 : REST_MIN) + Math.random() * REST_SPREAD;
  }

  protected afterHit(): void {
    if (!this.enraged && this.alive && this.hp < this.maxHp / 2) {
      this.enraged = true;
      // Its next move is a howl, and the pack it calls is bigger.
      this.howlT = 0;
      this.light.setColor(0x6affc0);
      this.halo.setTint(T_AURORA);
      this.world.popNumber(snap(this.x), snap(this.y) - 86, 'THE MANE BLAZES', 0x9affd8);
      this.world.debris(VARGR_TINTS, snap(this.x), snap(this.y) - MANE_Y, 34, this.y + 40, 'spores');
      this.world.cameras.main.shake(240, 0.003);
      sound.frost('howl', this.world.pan(this.x), true);
    }
  }

  /** Its howl, head thrown back, mane flaring. */
  protected flourish(): void {
    this.play('howl', true);
  }

  protected staggers(): boolean {
    return false;
  }

  protected onInterrupted(): void {
    this.mark?.setVisible(false);
    this.lane?.setVisible(false);
    this.swipeMark?.destroy();
    this.swipeMark = null;
    this.hideBreath();
    for (const b of this.billows) {
      b.live = false;
      b.img.setVisible(false);
    }
    if (this.flying) {
      this.flying = false;
      this.hover = 0;
    }
  }

  protected onDeath(): void {
    const w = this.world;
    for (let i = 0; i < 5; i++) {
      w.time.delayedCall(i * 140, () => iceBurst(w, this.x + (Math.random() - 0.5) * 70, this.y - 10 - Math.random() * 50, 18, this.y + 40));
    }
    w.debris(VARGR_TINTS, snap(this.x), snap(this.y) - MANE_Y, 40, this.y + 40, 'spores');
    w.cameras.main.flash(380, 200, 255, 230);
    w.cameras.main.shake(420, 0.004);
    w.popNumber(snap(this.x), snap(this.y) - 86, 'THE WINTERFANG FALLS', 0xe8fbff);
    sound.frost('howl', w.pan(this.x), false);
    sound.nova();
  }

  destroy(): void {
    if (this.dead) return;
    super.destroy();
    this.bossBar.destroy();
    this.halo.destroy();
    this.blaze.destroy();
    this.mark?.destroy();
    this.lane?.destroy();
    for (const c of this.cones) c.destroy();
    for (const b of this.billows) b.img.destroy();
    this.cones = [];
    this.billows = [];
    this.world.lights.removeLight(this.light);
  }
}
