import Phaser from 'phaser';
import { FN_GUST_W } from '../../art/frostNormal';
import { ICE_TINTS, SNOW_TINTS, T_ICE, T_TEAL } from '../../art/frostKit';
import { snap } from '../display';
import { sound } from '../../audio';
import type { Effect } from '../Slash';
import type { Hit } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { Monster, type Target } from './Monster';
import { clearRun } from './Deep';
import { CHILL_LIGHT, FrostRing, IceSpike, chill, dangerMark, frostLane, iceBurst, layLane } from './frostFx';
import { mobHit, mobHp } from '../tiers';

// The Aurora Colosseum's rank and file, each fought its own way:
//   - Rimefang wolves circle the hero spread round like a pack, and take
//     turns to pounce: a crouch and a glowing lane, then the leap and bite.
//   - The Frostbound walks behind a tower shield that turns blows from the
//     front; he is slow to turn, so get round him. His shield bash shoves
//     and chills, and leaves the shield hanging low a moment.
//   - The Rimewitch keeps her distance and blinks away in a puff of mist
//     when crowded; from her sigil a line of ice spikes erupts toward the
//     hero, one after another.
//   - Galeclaw hovers out of reach: up close she beats a gust that throws
//     the hero back, then flings a fan of ice feathers after them.
//   - The Chillstone only hops. Every few hops (or when the hero is near)
//     its runes blaze, it leaps high onto a marked spot and lands with a
//     ring of frost; then its runes go dark and it takes harder blows.
//   - The Snowstalker is all but invisible while it creeps up; it shows
//     itself with a snarl, then rakes twice, and stays seen a while after.
// Their pictures are in art/frostNormal.ts.

const FUR_TINTS = [0xeef2fa, 0xc8d0e4, 0x9ae8ff, 0xffffff];
const IRON_TINTS = [0x7488a8, 0xaabcd6, 0x9ae8ff, 0xffffff];
const CLOTH_TINTS = [0x2a6084, 0x3c7ea2, 0x9ae8ff, 0xffffff];
const FEATHER_TINTS = [0x263860, 0xeef2fa, 0x9ae8ff, 0xffffff];
const STONE_TINTS = [0x55627a, 0x98a4b8, 0x9ae8ff, 0xffffff];

/** A light that flares and fades where it stands (a spark, a puff, a claw streak). */
class Fleeting implements Effect {
  dead = false;
  private t = 0;
  private sx: number;
  private sy: number;

  constructor(
    private img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
    private life: number,
    private grow = 0,
    private a0 = 1,
  ) {
    this.sx = img.scaleX;
    this.sy = img.scaleY;
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const p = Math.min(1, this.t / this.life);
    this.img.setAlpha(this.a0 * (1 - p * p));
    if (this.grow) this.img.setScale(this.sx * (1 + this.grow * p), this.sy * (1 + this.grow * p));
    if (p >= 1) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
  }
}

/** A puff of freezing mist at (x, y) on the floor. */
function mistPuff(world: WorldScene, x: number, y: number): void {
  const img = world.add.image(snap(x), snap(y) - 8, 'fz_mist').setBlendMode(Phaser.BlendModes.ADD).setTint(0xc8f0ff).setDepth(y + 12).setScale(1.1, 1.3);
  world.addEffect(new Fleeting(img, 520, 0.8, 0.9));
  world.debris(SNOW_TINTS, snap(x), snap(y) - 10, 10, y + 12, 'spores');
  world.debris(ICE_TINTS, snap(x), snap(y) - 8, 6, y + 12);
}

/** Claw streaks raked through the air at (x, y), facing `dir`. */
function clawStreak(world: WorldScene, x: number, y: number, dir: number, flipY: boolean, depth: number): void {
  const s = world.add.sprite(snap(x), snap(y), 'fn_claw', 'c0').setBlendMode(Phaser.BlendModes.ADD).setFlipX(dir < 0).setFlipY(flipY).setDepth(depth).setTint(0xdff8ff);
  s.play('fn_claw_rake');
  world.addEffect(new Fleeting(s, 230, 0.15));
}

/** Is (x, y) a good place to stand: walkable and inside the arena? */
function standable(world: WorldScene, x: number, y: number): boolean {
  return world.walkable(x, y) && world.monsterBounds.contains(x, y);
}

// ---------------------------------------------------------------- Rimefang

const FANG_RING = 54;
const FANG_POUNCE_RANGE = 84;
const FANG_WINDUP = 560;
const FANG_SPEED = 240;
const FANG_LEAP_MAX = 76;
const FANG_LEAP_H = 10;
const FANG_RECOVER = 640;
/** No two wolves of a pack pounce closer together than this. */
const FANG_PACK_GAP = 800;
const FANG_HOWL = 760;

/**
 * A frost wolf. It circles the hero with the rest of its pack, each wolf
 * keeping its own side, and they take turns to pounce: the wolf crouches,
 * mane bristling, its lane glowing on the ice, then leaps and bites.
 */
export class Rimefang extends Monster {
  /** Every wolf alive, so a pack can spread round its prey and take turns. */
  private static pack: Rimefang[] = [];
  private static lastPounce = -Infinity;
  private static lastHowl = -Infinity;
  private skill: 'pounce' | 'howl' = 'pounce';
  private orbit = Math.random() * Math.PI * 2;
  private spin = Math.random() < 0.5 ? 1 : -1;
  private ux = 1;
  private uy = 0;
  private len = 0;
  private gone = 0;
  private struck = false;
  private hunted = false;
  private lane: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'rimefang', hp: mobHp('rimefang'), radius: 9, bodyY: 10, speed: 62, sight: 150, leash: 280, mass: 1.4, barY: 28, debris: FUR_TINTS });
    this.cooldown = 900 + Math.random() * 900;
    Rimefang.pack.push(this);
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  /** My place round the prey among the pack: wolves share the circle out evenly. */
  private place(): number {
    const pack = Rimefang.pack.filter((m) => m.world === this.world && m.alive && m.state === 'chase');
    const i = Math.max(0, pack.indexOf(this));
    return (i / Math.max(1, pack.length)) * Math.PI * 2;
  }

  protected chase(dt: number, target: Target, dist: number): void {
    const now = this.world.time.now;
    if (Rimefang.lastPounce > now) Rimefang.lastPounce = -Infinity;
    if (Rimefang.lastHowl > now) Rimefang.lastHowl = -Infinity;
    // The first wolf to take up the hunt may howl to the others.
    if (!this.hunted) {
      this.hunted = true;
      if (now - Rimefang.lastHowl > 6000 && Math.random() < 0.5) {
        Rimefang.lastHowl = now;
        this.skill = 'howl';
        this.face(target.x - this.x);
        this.enter('windup', FANG_HOWL);
        this.play('howl', true);
        sound.frost('howl', this.world.pan(this.x));
        return;
      }
    }
    if (this.cooldown === 0 && dist < FANG_POUNCE_RANGE && now - Rimefang.lastPounce > FANG_PACK_GAP) {
      Rimefang.lastPounce = now;
      this.skill = 'pounce';
      this.face(target.x - this.x);
      this.enter('windup', FANG_WINDUP);
      this.play('windup', true);
      this.lane = frostLane(this.world, this.x, this.y, 1.4, T_ICE);
      sound.roar(this.world.pan(this.x), false);
      return;
    }
    // Circle: drift round the prey to my own side of it, then hold there.
    this.orbit += (dt / 1000) * 0.35 * this.spin;
    const a = this.orbit * 0.25 + this.place();
    const gx = target.x + Math.cos(a) * FANG_RING;
    const gy = target.y + Math.sin(a) * FANG_RING * 0.7;
    const d = Math.hypot(gx - this.x, gy - this.y);
    if (d > 6) this.move(dt, (gx - this.x) / d, (gy - this.y) / d, this.stats.speed * (d > 40 ? 1 : 0.65));
    else this.stand(dt);
    this.face(target.x - this.x);
    if (Math.random() < dt / 5000) this.spin = -this.spin;
  }

  protected act(dt: number, target: Target | null, dist: number): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (this.skill === 'howl') {
        if (this.timer <= 0) {
          // The howl rouses the pack: they come at once.
          for (const m of Rimefang.pack) if (m.world === w && m !== this) m.cooldown = Math.min(m.cooldown, 400);
          this.enter('chase', 0);
          this.cooldown = 500;
        }
        return;
      }
      const t = 1 - this.timer / FANG_WINDUP;
      if (target && t < 0.75) {
        this.face(target.x - this.x);
        const l = Math.hypot(target.x - this.x, target.y - this.y) || 1;
        this.ux = (target.x - this.x) / l;
        this.uy = (target.y - this.y) / l;
        this.len = Math.max(26, clearRun(w, this.x, this.y, this.ux, this.uy, Math.min(dist + 14, FANG_LEAP_MAX)));
      }
      if (this.lane) layLane(this.lane, this.x, this.y, this.ux, this.uy, this.len + 8, 1.4, 0.15 + t * 0.5);
      if (Math.random() < dt / 120) w.debris(SNOW_TINTS, this.x - this.ux * 8, this.y, 1, this.y + 1, 'spores');
      if (this.timer <= 0) {
        this.gone = 0;
        this.struck = false;
        this.enter('attack', 99999);
        this.pose('leap');
        sound.windDash(w.pan(this.x));
        w.debris(SNOW_TINTS, snap(this.x), snap(this.y), 6, this.y + 1, 'spores');
      }
      return;
    }
    if (this.state === 'attack') {
      const s = Math.min((FANG_SPEED * dt) / 1000, this.len - this.gone);
      this.x += this.ux * s;
      this.y += this.uy * s;
      this.gone += s;
      const p = this.gone / this.len;
      this.hover = Math.sin(p * Math.PI) * FANG_LEAP_H;
      this.lane?.setAlpha(0.55 * (1 - p));
      if (!this.struck) this.struck = this.bite(12, 7);
      if (this.gone >= this.len - 0.5) {
        // The landing: jaws snap shut on whatever is there.
        this.hover = 0;
        if (!this.struck) this.struck = this.bite(13, 10);
        this.clear();
        this.pose('bite');
        w.debris(SNOW_TINTS, snap(this.x + this.ux * 6), snap(this.y), 8, this.y + 1, 'spores');
        sound.frost('crunch', w.pan(this.x));
        this.enter('recover', FANG_RECOVER);
        this.cooldown = 1700 + Math.random() * 1000;
        this.spin = Math.random() < 0.5 ? 1 : -1;
      }
      return;
    }
    if (this.timer < FANG_RECOVER - 220) this.play('idle');
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private bite(r: number, rr: number): boolean {
    const w = this.world;
    const bx = this.x + this.ux * r;
    const by = this.y + this.uy * r * 0.7;
    const hit = w.hurtHeroInEllipse(bx, by, rr, rr * 0.7, { damage: mobHit('rimefang'), fromX: this.x, fromY: this.y - 8, knock: 170 });
    if (hit) {
      sound.rake(w.pan(this.x));
      clawStreak(w, bx, by - 10, this.facing === 'r' ? 1 : -1, false, by + 12);
    }
    return hit;
  }

  private clear(): void {
    this.lane?.destroy();
    this.lane = null;
  }

  protected staggers(): boolean {
    return this.state !== 'attack';
  }

  protected onInterrupted(): void {
    this.clear();
    this.hover = 0;
  }

  destroy(): void {
    super.destroy();
    const i = Rimefang.pack.indexOf(this);
    if (i >= 0) Rimefang.pack.splice(i, 1);
  }
}

// ---------------------------------------------------------------- Frostbound

const BOUND_REACH = 36;
const BOUND_WINDUP = 720;
const BOUND_DIST = 24;
const BOUND_BASH = 180;
const BOUND_RECOVER = 950;
/** How long the hero must stay behind him before he turns. */
const BOUND_TURN = 700;
/** What of a blow on the shield gets through. */
const BOUND_BLOCK_KEEP = 0.15;
const BOUND_BLOCK_POSE = 170;

/**
 * A dead shieldbearer frozen into his rimed iron. His tower shield turns
 * blows from the front (they barely scratch him), but he is slow to turn:
 * get behind him, or bait the bash, which leaves the shield hanging low.
 */
export class Frostbound extends Monster {
  private turnAt = 0;
  private ux = 1;
  private uy = 0;
  private gone = 0;
  private struck = false;
  private blockT = 0;
  private lastClash = -Infinity;
  private lane: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'frostbound', hp: mobHp('frostbound'), radius: 8, bodyY: 14, speed: 22, sight: 130, leash: 260, mass: 5, barY: 40, debris: IRON_TINTS });
    this.cooldown = 800;
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  private get dir(): number {
    return this.facing === 'r' ? 1 : -1;
  }

  /** He turns only once the hero has stayed round his back a while. */
  protected face(dx: number): void {
    if (Math.abs(dx) <= 0.5) return;
    const want = dx < 0 ? 'l' : 'r';
    if (want === this.facing) {
      this.turnAt = 0;
      return;
    }
    const now = this.world.time.now;
    if (!this.turnAt || this.turnAt > now) this.turnAt = now;
    if (this.state === 'notice' || now - this.turnAt >= BOUND_TURN) {
      super.face(dx);
      this.turnAt = 0;
      sound.clack(this.world.pan(this.x), true);
    }
  }

  update(dt: number, target: Target | null, daylight: number): void {
    this.blockT = Math.max(0, this.blockT - dt);
    super.update(dt, target, daylight);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.blockT > 0) return;
    const dx = target.x - this.x;
    this.face(dx);
    const front = dx * this.dir > 0;
    if (!front) {
      // Caught with his back turned: he shuffles round behind his shield.
      this.stand(dt);
      return;
    }
    if (this.cooldown === 0 && dist < BOUND_REACH && Math.abs(target.y - this.y) < 20) {
      this.enter('windup', BOUND_WINDUP);
      this.play('windup', true);
      this.lane = frostLane(this.world, this.x, this.y, 2, T_ICE);
      sound.clash(this.world.pan(this.x));
      return;
    }
    if (dist > 18) this.move(dt, dx / (dist || 1), (target.y - this.y) / (dist || 1), this.stats.speed);
    else this.stand(dt);
  }

  protected act(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      const t = 1 - this.timer / BOUND_WINDUP;
      if (target && t < 0.7) {
        // Aim along his front, never out to the side.
        let ux = target.x - this.x;
        let uy = target.y - this.y;
        const l = Math.hypot(ux, uy) || 1;
        ux /= l;
        uy /= l;
        if (ux * this.dir < 0.75) {
          ux = 0.75 * this.dir;
          uy = Math.sign(uy) * Math.sqrt(1 - 0.75 * 0.75);
        }
        this.ux = ux;
        this.uy = uy;
      }
      if (this.lane) layLane(this.lane, this.x, this.y, this.ux, this.uy, BOUND_DIST + 16, 2, 0.15 + t * 0.5);
      if (this.timer <= 0) {
        this.gone = 0;
        this.struck = false;
        this.enter('attack', BOUND_BASH);
        this.pose('bash');
        sound.windDash(w.pan(this.x));
      }
      return;
    }
    if (this.state === 'attack') {
      const s = Math.min((BOUND_DIST * dt) / BOUND_BASH, BOUND_DIST - this.gone);
      this.x += this.ux * s;
      this.y += this.uy * s;
      this.gone += s;
      if (!this.struck) {
        const cx = this.x + this.ux * 12;
        const cy = this.y + this.uy * 6;
        this.struck = w.hurtHeroInEllipse(cx, cy, 12, 8, { damage: mobHit('frostbound', 1.1), fromX: this.x, fromY: this.y - 14, knock: 280 });
        if (this.struck) {
          chill(w, CHILL_LIGHT);
          iceBurst(w, cx, cy - 12, 10);
          w.cameras.main.shake(110, 0.0022);
          sound.clash(w.pan(this.x), true);
        }
      }
      if (this.timer <= 0) {
        this.clear();
        w.debris(SNOW_TINTS, snap(this.x + this.dir * 10), snap(this.y), 8, this.y + 1, 'spores');
        sound.thud(w.pan(this.x), true);
        // The shield hangs low: his opening.
        this.enter('recover', BOUND_RECOVER);
        this.play('recover', true);
        this.cooldown = 2200 + Math.random() * 900;
      }
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** Is this blow turned by the shield? Only from the front, and not while it hangs low. */
  private blocks(hit: Hit): boolean {
    if (this.state === 'recover' || !this.alive || hit.wild) return false;
    return (hit.fromX - this.x) * this.dir > 3;
  }

  private turnAside(): void {
    const w = this.world;
    const now = w.time.now;
    const sx = this.x + this.dir * 8;
    const sy = this.y - 16;
    const img = w.add.image(snap(sx), snap(sy), 'fn_spark').setBlendMode(Phaser.BlendModes.ADD).setDepth(this.y + 12).setRotation(Math.random() * 0.6);
    w.addEffect(new Fleeting(img, 200, 0.7));
    w.debris(ICE_TINTS, snap(sx), snap(sy), 4, this.y + 12);
    if (now - this.lastClash > 120) {
      this.lastClash = now;
      sound.clash(w.pan(this.x));
    }
    // A moment braced behind the shield (unless it was mid-bash).
    if (this.state === 'chase' || this.state === 'idle' || this.state === 'notice') {
      this.blockT = BOUND_BLOCK_POSE;
      this.pose('block');
    }
  }

  hurt(hit: Hit): void {
    if (this.blocks(hit)) {
      this.turnAside();
      super.hurt({ ...hit, damage: hit.damage * BOUND_BLOCK_KEEP, heavy: false, knock: hit.knock * 0.3 });
      return;
    }
    super.hurt(hit);
  }

  netHurt(hit: Hit, damage: number): void {
    if (this.blocks(hit)) {
      this.turnAside();
      super.netHurt({ ...hit, heavy: false, knock: hit.knock * 0.3 }, damage * BOUND_BLOCK_KEEP);
      return;
    }
    super.netHurt(hit, damage);
  }

  private clear(): void {
    this.lane?.destroy();
    this.lane = null;
  }

  protected staggers(): boolean {
    return this.state !== 'attack' && this.state !== 'windup';
  }

  protected onInterrupted(): void {
    this.clear();
  }
}

// ---------------------------------------------------------------- Rimewitch

const WITCH_NEAR = 58;
const WITCH_FAR = 124;
const WITCH_CROWDED = 40;
const WITCH_BLINK_OUT = 300;
const WITCH_BLINK_IN = 320;
const WITCH_BLINK_CD = 4200;
const WITCH_BLINK_TO = 92;
const WITCH_WINDUP = 820;
const WITCH_STEP = 26;
const WITCH_SPIKE_DELAY = 480;
const WITCH_SPIKE_GAP = 150;
const WITCH_FLOAT = 3;

/**
 * A hooded frost witch afloat on her own mist. She keeps her distance and,
 * crowded, blinks away in a puff; from a sigil under her she sends a line
 * of three ice spikes erupting toward the hero, one after the next.
 */
export class Rimewitch extends Monster {
  private skill: 'cast' | 'blink' = 'cast';
  private strafe = Math.random() < 0.5 ? 1 : -1;
  private blinkCd = 0;
  private aim = { x: 0, y: 0 };
  private sigil: Phaser.GameObjects.Sprite | null = null;
  private t = Math.random() * 1000;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'rimewitch', hp: mobHp('rimewitch'), radius: 7, bodyY: 18, speed: 36, sight: 160, leash: 280, mass: 1, barY: 48, debris: CLOTH_TINTS });
    this.cooldown = 1000;
  }

  update(dt: number, target: Target | null, daylight: number): void {
    this.t += dt;
    this.blinkCd = Math.max(0, this.blinkCd - dt);
    this.hover = WITCH_FLOAT + Math.sin(this.t * 0.003) * 1.5;
    super.update(dt, target, daylight);
    if (!this.dead && this.sigil) this.sigil.setPosition(snap(this.x), snap(this.y));
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    const dx = (target.x - this.x) / (dist || 1);
    const dy = (target.y - this.y) / (dist || 1);
    if (this.blinkCd === 0 && dist < WITCH_CROWDED) {
      this.skill = 'blink';
      this.enter('windup', WITCH_BLINK_OUT);
      this.play('blink', true);
      sound.vanish(this.world.pan(this.x));
      return;
    }
    if (dist > WITCH_FAR) this.move(dt, dx, dy, this.stats.speed);
    else if (dist < WITCH_NEAR) this.move(dt, -dx * 0.8 - dy * 0.6 * this.strafe, -dy * 0.8 + dx * 0.6 * this.strafe, this.stats.speed * 1.1);
    else if (this.cooldown === 0) {
      this.skill = 'cast';
      this.enter('windup', WITCH_WINDUP);
      this.play('windup', true);
      this.sigil = this.world.add.sprite(snap(this.x), snap(this.y), 'fn_sigil', 's0').setBlendMode(Phaser.BlendModes.ADD).setDepth(2.1).setTint(T_ICE).setAlpha(0).setScale(0.6);
      this.sigil.play('fn_sigil_turn');
      sound.cast(this.world.pan(this.x));
    } else {
      if (Math.random() < dt / 1800) this.strafe = -this.strafe;
      this.move(dt, -dy * this.strafe, dx * this.strafe, this.stats.speed * 0.55);
    }
    this.face(target.x - this.x);
  }

  protected act(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (this.skill === 'blink') {
        this.fade = Math.max(0, this.timer / WITCH_BLINK_OUT);
        if (this.timer <= 0) this.blinkAway(target);
        return;
      }
      const t = 1 - this.timer / WITCH_WINDUP;
      this.sigil?.setAlpha(0.25 + t * 0.6).setScale(0.6 + t * 0.45);
      if (target) {
        this.face(target.x - this.x);
        if (t < 0.8) {
          this.aim.x = target.x;
          this.aim.y = target.y;
        }
      }
      if (Math.random() < dt / 60) {
        const sx = this.x + (this.facing === 'r' ? 8 : -8);
        w.debris(ICE_TINTS, sx + (Math.random() - 0.5) * 14, this.y - 30 + (Math.random() - 0.5) * 12, 1, this.y + 1, 'gather');
      }
      if (this.timer <= 0) this.cast();
      return;
    }
    if (this.state === 'attack') {
      if (this.skill === 'blink') {
        this.fade = Math.min(1, 1 - this.timer / WITCH_BLINK_IN);
        if (this.timer <= 0) {
          this.fade = 1;
          this.enter('chase', 0);
          this.cooldown = Math.min(this.cooldown, 450);
        }
        return;
      }
      this.sigil?.setAlpha(Math.max(0, this.timer / 400) * 0.8);
      if (this.timer <= 0) {
        this.clear();
        this.enter('recover', 500);
        this.play('idle', true);
      }
      return;
    }
    this.stand(dt);
    if (this.timer <= 0) this.enter('chase', 0);
  }

  /** Gone in a puff, back in another a good way off from the hero. */
  private blinkAway(target: Target | null): void {
    const w = this.world;
    mistPuff(w, this.x, this.y);
    const from = target ?? { x: this.homeX, y: this.homeY };
    const a0 = Math.atan2(this.y - from.y, this.x - from.x);
    for (const da of [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2, Math.PI]) {
      const a = a0 + da + (Math.random() - 0.5) * 0.4;
      const x = from.x + Math.cos(a) * WITCH_BLINK_TO;
      const y = from.y + Math.sin(a) * WITCH_BLINK_TO * 0.7;
      if (standable(w, x, y)) {
        this.x = x;
        this.y = y;
        break;
      }
    }
    mistPuff(w, this.x, this.y);
    sound.blink(w.pan(this.x));
    this.enter('attack', WITCH_BLINK_IN);
    this.play('blink', true);
    this.blinkCd = WITCH_BLINK_CD;
  }

  private cast(): void {
    const w = this.world;
    this.pose('cast');
    this.enter('attack', 400);
    const dx = this.aim.x - this.x;
    const dy = this.aim.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    // Three spikes along her line to the hero: short of them, on them, past them.
    for (let k = 0; k < 3; k++) {
      const r = Math.max(18 + k * WITCH_STEP, d + (k - 1) * WITCH_STEP);
      const x = this.x + ux * r;
      const y = this.y + uy * r;
      if (!standable(w, x, y)) continue;
      w.addEffect(new IceSpike(w, x, y, { delay: WITCH_SPIKE_DELAY + k * WITCH_SPIKE_GAP, damage: mobHit('rimewitch', 0.9), chill: CHILL_LIGHT, size: 0.9, quiet: k > 0 }));
    }
    w.debris(ICE_TINTS, snap(this.x + (this.facing === 'r' ? 10 : -10)), snap(this.y) - 24, 10, this.y + 2);
    sound.frost('freeze', w.pan(this.x));
    this.cooldown = 2600 + Math.random() * 1000;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
  }

  private clear(): void {
    this.sigil?.destroy();
    this.sigil = null;
  }

  protected onInterrupted(): void {
    this.clear();
    this.fade = 1;
  }
}

// ---------------------------------------------------------------- Galeclaw

const GALE_HOVER = 12;
const GALE_NEAR = 66;
const GALE_FAR = 112;
const GALE_GUST_RANGE = 76;
const GALE_GUST_WINDUP = 680;
const GALE_GUST_TIME = 650;
const GALE_GUST_LEN = 92;
const GALE_GUST_HALF = 0.5;
const GALE_GUST_PUSH = 150;
const GALE_GUST_CD = 4600;
const GALE_VOLLEY_WINDUP = 620;
const GALE_FEATHERS = 5;
const GALE_SPREAD = 0.42;
const GALE_FEATHER_SPEED = 165;
const GALE_FEATHER_RANGE = 170;

/** An ice feather flung by the harpy: it flies straight and shatters on the hero or at its range's end. */
class IceFeather implements Effect {
  dead = false;
  private img: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private travelled = 0;
  private trail = 0;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private damage: number,
  ) {
    this.img = world.add.image(x, y, 'fn_feather').setBlendMode(Phaser.BlendModes.ADD).setRotation(Math.atan2(uy, ux));
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(T_ICE).setScale(0.32).setAlpha(0.45);
  }

  update(dt: number): void {
    if (this.dead) return;
    const w = this.world;
    const d = (GALE_FEATHER_SPEED * dt) / 1000;
    this.x += this.ux * d;
    this.y += this.uy * d;
    this.travelled += d;
    const depth = this.y + 16;
    const fade = Math.min(1, (GALE_FEATHER_RANGE - this.travelled) / 30);
    this.img.setPosition(snap(this.x), snap(this.y)).setDepth(depth).setAlpha(fade);
    this.halo.setPosition(this.x, this.y).setDepth(depth - 0.1).setAlpha(0.45 * fade);
    this.trail -= dt;
    if (this.trail <= 0) {
      this.trail = 50;
      w.debris(ICE_TINTS, this.x - this.ux * 5, this.y - this.uy * 5, 1, depth - 0.2, 'trail');
    }
    const hit = w.hurtHeroAt(this.x, this.y, 4, { damage: this.damage, fromX: this.x - this.ux * 8, fromY: this.y - this.uy * 8, knock: 80 });
    if (hit || this.travelled > GALE_FEATHER_RANGE || !w.monsterBounds.contains(this.x, this.y)) {
      if (hit || this.travelled <= GALE_FEATHER_RANGE) {
        iceBurst(w, this.x, this.y, 5, depth);
        sound.frost('chime', w.pan(this.x));
      }
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

/**
 * A snow harpy hovering out of reach. Up close she rears and beats a gust
 * that hurls the hero back (its cone shows on the ice first); at range she
 * gathers frost on her primaries and flings a fan of ice feathers.
 */
export class Galeclaw extends Monster {
  private skill: 'gust' | 'volley' = 'volley';
  private strafe = Math.random() < 0.5 ? 1 : -1;
  private gustCd = 0;
  private ax = 1;
  private ay = 0;
  private struck = false;
  private cone: Phaser.GameObjects.Sprite | null = null;
  private t = Math.random() * 1000;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'galeclaw', hp: mobHp('galeclaw'), radius: 8, bodyY: 20, speed: 46, sight: 170, leash: 300, mass: 1, barY: 50, debris: FEATHER_TINTS });
    this.cooldown = 1100;
  }

  get pinned(): boolean {
    return true;
  }

  update(dt: number, target: Target | null, daylight: number): void {
    this.t += dt;
    this.gustCd = Math.max(0, this.gustCd - dt);
    // She rides her wingbeats: a little lift on every downstroke.
    this.hover = GALE_HOVER + Math.sin(this.t * 0.011) * 1.5;
    super.update(dt, target, daylight);
    if (!this.dead && this.cone) this.cone.setPosition(snap(this.x), snap(this.y));
  }

  private aimAt(target: Target): void {
    const l = Math.hypot(target.x - this.x, target.y - this.y) || 1;
    this.ax = (target.x - this.x) / l;
    this.ay = (target.y - this.y) / l;
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    const dx = (target.x - this.x) / (dist || 1);
    const dy = (target.y - this.y) / (dist || 1);
    if (this.gustCd === 0 && dist < GALE_GUST_RANGE) {
      this.skill = 'gust';
      this.aimAt(target);
      this.enter('windup', GALE_GUST_WINDUP);
      this.play('windup', true);
      this.cone = this.world.add.sprite(snap(this.x), snap(this.y), 'fn_gust', 'g0').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(2.2).setTint(0xc8f0ff).setAlpha(0);
      sound.windCharge(this.world.pan(this.x));
      sound.screech(this.world.pan(this.x));
      return;
    }
    if (this.cooldown === 0 && dist < GALE_FAR + 30) {
      this.startVolley(target);
      return;
    }
    if (dist > GALE_FAR) this.move(dt, dx, dy, this.stats.speed);
    else if (dist < GALE_NEAR && this.gustCd > 0) this.move(dt, -dx * 0.7 - dy * 0.7 * this.strafe, -dy * 0.7 + dx * 0.7 * this.strafe, this.stats.speed);
    else {
      if (Math.random() < dt / 2200) this.strafe = -this.strafe;
      this.move(dt, -dy * this.strafe, dx * this.strafe, this.stats.speed * 0.6);
    }
    this.face(target.x - this.x);
  }

  private startVolley(target: Target): void {
    this.skill = 'volley';
    this.aimAt(target);
    this.enter('windup', GALE_VOLLEY_WINDUP);
    this.play('gather', true);
    sound.feather(this.world.pan(this.x));
  }

  protected act(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      if (this.skill === 'gust') {
        const t = 1 - this.timer / GALE_GUST_WINDUP;
        if (target && t < 0.7) {
          this.aimAt(target);
          this.face(this.ax);
        }
        this.layCone(0.12 + t * 0.35, 0.4 + t * 0.6);
        if (this.timer <= 0) {
          this.struck = false;
          this.enter('attack', GALE_GUST_TIME);
          this.pose('gust');
          this.cone?.play('fn_gust_blow');
          sound.gust(w.pan(this.x));
          sound.frost('gust', w.pan(this.x), true);
        }
        return;
      }
      const t = 1 - this.timer / GALE_VOLLEY_WINDUP;
      if (target && t < 0.75) {
        this.aimAt(target);
        this.face(this.ax);
      }
      if (Math.random() < dt / 50) w.debris(ICE_TINTS, this.x + (Math.random() - 0.5) * 30, this.y - this.hover - 20 + (Math.random() - 0.5) * 16, 1, this.y + 1, 'gather');
      if (this.timer <= 0) this.volley();
      return;
    }
    if (this.state === 'attack') {
      if (this.skill === 'gust') {
        this.layCone(0.75 * Math.min(1, this.timer / 200 + 0.3), 1);
        this.blow(dt);
        if (this.timer <= 0) {
          this.clear();
          this.gustCd = GALE_GUST_CD;
          // The hero, thrown back, gets a fan of feathers after them.
          if (target) this.startVolley(target);
          else this.rest();
        }
        return;
      }
      if (this.timer <= 0) this.rest();
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private layCone(alpha: number, reach: number): void {
    this.cone?.setRotation(Math.atan2(this.ay, this.ax)).setScale((GALE_GUST_LEN / FN_GUST_W) * reach, 1.15 * reach).setAlpha(alpha);
  }

  /** The gust pushes whoever stands in its cone straight away from her. */
  private blow(dt: number): void {
    const w = this.world;
    if (Math.random() < dt / 25) {
      const r = Math.random() * GALE_GUST_LEN;
      const s = (Math.random() - 0.5) * 2 * GALE_GUST_HALF * 0.8;
      const a = Math.atan2(this.ay, this.ax) + s;
      w.debris(SNOW_TINTS, this.x + Math.cos(a) * r, this.y + Math.sin(a) * r - 4, 1, this.y + r + 2, 'trail');
    }
    const h = w.heroPos;
    if (!h) return;
    const dx = h.x - this.x;
    const dy = h.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d > GALE_GUST_LEN || d < 1) return;
    const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - Math.atan2(this.ay, this.ax)));
    if (off > GALE_GUST_HALF && d > 14) return;
    w.pullHero(h.x + (dx / d) * 120, h.y + (dy / d) * 120, GALE_GUST_PUSH * (1 - d / (GALE_GUST_LEN * 1.4)), dt);
    if (!this.struck) {
      this.struck = w.hurtHeroAt(h.x, h.y - 11, 6, { damage: mobHit('galeclaw', 0.35), fromX: this.x, fromY: this.y - 4, knock: 220 });
      if (this.struck) chill(w, CHILL_LIGHT);
    }
  }

  private volley(): void {
    const w = this.world;
    this.pose('throw');
    this.enter('attack', 420);
    const sx = this.x + this.ax * 6;
    const sy = this.y - this.hover - 14;
    const h = w.heroPos;
    // Aimed at the hero's body from her height in the air.
    const tx = this.x + this.ax * 60;
    const ty = this.y + this.ay * 60 - 11;
    const base = h ? Math.atan2(ty - sy, tx - sx) : Math.atan2(this.ay, this.ax);
    for (let k = 0; k < GALE_FEATHERS; k++) {
      const a = base + (k / (GALE_FEATHERS - 1) - 0.5) * 2 * GALE_SPREAD;
      w.addEffect(new IceFeather(w, sx, sy, Math.cos(a), Math.sin(a), mobHit('galeclaw', 0.45)));
    }
    w.debris(ICE_TINTS, snap(sx), snap(sy), 8, this.y + 2);
    sound.screech(w.pan(this.x));
    this.cooldown = 2600 + Math.random() * 900;
  }

  private rest(): void {
    this.enter('recover', 500);
    this.play('idle', true);
    this.strafe = Math.random() < 0.5 ? 1 : -1;
  }

  private clear(): void {
    this.cone?.destroy();
    this.cone = null;
  }

  protected onInterrupted(): void {
    this.clear();
  }
}

// ---------------------------------------------------------------- Chillstone

const STONE_REST = 220;
const STONE_CROUCH = 260;
const STONE_AIR = 440;
const STONE_LAND = 240;
const STONE_HOP = 20;
const STONE_HOP_H = 9;
const STONE_BIG_EVERY = 4;
const STONE_BIG_NEAR = 64;
const STONE_BIG_WINDUP = 950;
const STONE_BIG_AIR = 640;
const STONE_BIG_H = 26;
const STONE_BIG_REACH = 46;
const STONE_SPENT = 1200;
/** Blows land this much harder while its runes are dark. */
const STONE_SPENT_HURT = 1.5;

/**
 * A rune-carved standing stone that only hops. Every few hops, or with the
 * hero near, its runes blaze, it leaps high onto a marked spot and lands
 * with a ring of frost; spent, its runes go dark and blows bite deeper.
 */
export class Chillstone extends Monster {
  private hop: 'rest' | 'crouch' | 'air' | 'land' = 'rest';
  private hopT = STONE_REST;
  private hops = 0;
  private ux = 0;
  private uy = 0;
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private toY = 0;
  private mark: Phaser.GameObjects.Image | null = null;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'chillstone', hp: mobHp('chillstone'), radius: 9, bodyY: 14, speed: 18, sight: 140, leash: 260, mass: 6, barY: 38, debris: STONE_TINTS });
    this.cooldown = 1500;
  }

  get pinned(): boolean {
    return this.hover > 2;
  }

  protected chase(dt: number, target: Target, dist: number): void {
    const w = this.world;
    if (this.hop === 'rest' && this.cooldown === 0 && (dist < STONE_BIG_NEAR || this.hops >= STONE_BIG_EVERY) && dist < 140) {
      this.hops = 0;
      this.enter('windup', STONE_BIG_WINDUP);
      this.play('windup', true);
      this.aimLanding(target);
      this.mark = dangerMark(w, this.toX, this.toY, 20, 12, T_ICE);
      sound.frost('freeze', w.pan(this.x));
      return;
    }
    if (dist < 14 && this.hop === 'rest') {
      // On top of the hero already: hop aside rather than in place.
      const a = Math.random() * Math.PI * 2;
      this.move(dt, Math.cos(a), Math.sin(a), 0);
    } else this.move(dt, (target.x - this.x) / (dist || 1), (target.y - this.y) / (dist || 1), 0);
  }

  /** It gets about only by hopping: rest, squat, up, down hard. */
  protected move(dt: number, ux: number, uy: number, _speed: number): void {
    const w = this.world;
    this.hopT -= dt;
    switch (this.hop) {
      case 'rest':
        this.play('idle');
        this.face(ux);
        if (this.hopT <= 0) {
          this.hop = 'crouch';
          this.hopT = STONE_CROUCH;
          this.pose('crouch');
        }
        break;
      case 'crouch':
        if (this.hopT <= 0) {
          this.ux = ux;
          this.uy = uy;
          this.face(ux);
          this.hop = 'air';
          this.hopT = STONE_AIR;
          this.pose('air');
        }
        break;
      case 'air': {
        const p = 1 - Math.max(0, this.hopT) / STONE_AIR;
        const s = (STONE_HOP * dt) / STONE_AIR;
        this.x += this.ux * s;
        this.y += this.uy * s;
        this.hover = Math.sin(p * Math.PI) * STONE_HOP_H;
        if (this.hopT <= 0) {
          this.hover = 0;
          this.hop = 'land';
          this.hopT = STONE_LAND;
          this.pose('land');
          this.hops++;
          w.debris(SNOW_TINTS, snap(this.x), snap(this.y), 6, this.y + 1, 'spores');
          sound.thud(w.pan(this.x));
          if (this.state === 'chase') w.hurtHeroInEllipse(this.x, this.y, 12, 8, { damage: mobHit('chillstone', 0.5), fromX: this.x, fromY: this.y - 6, knock: 160 });
        }
        break;
      }
      case 'land':
        if (this.hopT <= 0) {
          this.hop = 'rest';
          this.hopT = STONE_REST + Math.random() * 160;
        }
        break;
    }
  }

  /** Standing still: a hop already begun still comes down. */
  protected stand(dt: number): void {
    if (this.hop === 'rest' || this.hop === 'crouch') {
      this.hop = 'rest';
      this.play('idle');
    } else this.move(dt, this.ux, this.uy, 0);
  }

  /** Where the big leap comes down: on the hero, but no further than its reach. */
  private aimLanding(target: Target): void {
    let dx = target.x - this.x;
    let dy = target.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d > STONE_BIG_REACH) {
      dx = (dx / d) * STONE_BIG_REACH;
      dy = (dy / d) * STONE_BIG_REACH;
    }
    const run = d > 1 ? clearRun(this.world, this.x, this.y, dx / Math.hypot(dx, dy), dy / Math.hypot(dx, dy), Math.hypot(dx, dy)) : 0;
    const k = d > 1 ? run / Math.max(1, Math.hypot(dx, dy)) : 0;
    this.fromX = this.x;
    this.fromY = this.y;
    this.toX = this.x + dx * k;
    this.toY = this.y + dy * k;
  }

  protected act(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      const t = 1 - this.timer / STONE_BIG_WINDUP;
      if (target && t < 0.6) {
        this.aimLanding(target);
        this.face(target.x - this.x);
      }
      this.mark?.setPosition(snap(this.toX), snap(this.toY)).setAlpha(0.3 + t * 0.55 + Math.sin(this.timer * 0.04) * 0.08);
      if (Math.random() < dt / 70) w.debris(ICE_TINTS, this.x + (Math.random() - 0.5) * 16, this.y - 6 - Math.random() * 22, 1, this.y + 1, 'gather');
      if (this.timer <= 0) {
        this.fromX = this.x;
        this.fromY = this.y;
        this.enter('attack', STONE_BIG_AIR);
        this.pose('air');
        w.debris(SNOW_TINTS, snap(this.x), snap(this.y), 10, this.y + 1, 'spores');
        sound.windDash(w.pan(this.x));
      }
      return;
    }
    if (this.state === 'attack') {
      const p = 1 - Math.max(0, this.timer) / STONE_BIG_AIR;
      // It hangs at the top a moment, then drops like a stone.
      const q = p < 0.5 ? p * 1.2 : 0.6 + (p - 0.5) * 0.8;
      this.x = this.fromX + (this.toX - this.fromX) * q;
      this.y = this.fromY + (this.toY - this.fromY) * q;
      this.hover = Math.sin(Math.min(1, p) * Math.PI) * STONE_BIG_H * (p > 0.5 ? 1 - (p - 0.5) * 0.4 : 1);
      if (this.timer <= 0) this.slam();
      return;
    }
    // Spent: its runes dark, slumped where it fell.
    if (this.timer <= 0) {
      this.hop = 'rest';
      this.hopT = STONE_REST;
      this.enter('chase', 0);
    }
  }

  private slam(): void {
    const w = this.world;
    this.x = this.toX;
    this.y = this.toY;
    this.hover = 0;
    this.clear();
    if (w.hurtHeroInEllipse(this.x, this.y, 18, 11, { damage: mobHit('chillstone', 1.2), fromX: this.x, fromY: this.y - 6, knock: 230 })) chill(w, CHILL_LIGHT);
    w.addEffect(new FrostRing(w, this.x, this.y, { from: 10, to: 76, speed: 120, damage: mobHit('chillstone', 0.7), chill: CHILL_LIGHT }));
    iceBurst(w, this.x, this.y - 4, 16);
    w.debris(STONE_TINTS, snap(this.x), snap(this.y) - 8, 8, this.y + 2);
    w.cameras.main.shake(170, 0.003);
    sound.slam(w.pan(this.x));
    sound.frost('crack', w.pan(this.x), true);
    this.enter('recover', STONE_SPENT);
    this.play('spent', true);
    this.cooldown = 3200 + Math.random() * 1200;
  }

  hurt(hit: Hit): void {
    super.hurt(this.state === 'recover' ? { ...hit, damage: hit.damage * STONE_SPENT_HURT } : hit);
  }

  netHurt(hit: Hit, damage: number): void {
    super.netHurt(hit, this.state === 'recover' ? damage * STONE_SPENT_HURT : damage);
  }

  private clear(): void {
    this.mark?.destroy();
    this.mark = null;
  }

  protected staggers(): boolean {
    return false;
  }

  protected onInterrupted(): void {
    this.clear();
    this.hover = 0;
    this.hop = 'rest';
    this.hopT = STONE_REST;
  }
}

// ---------------------------------------------------------------- Snowstalker

const STALK_FADE = 0.12;
const STALK_SPEED = 32;
const STALK_REVEAL = 46;
const STALK_SNARL = 540;
const STALK_DASH = 30;
const STALK_SWIPE1 = 170;
const STALK_GAP = 130;
const STALK_SWIPE2 = 170;
const STALK_RECOVER = 620;
const STALK_SEEN = 3600;
const STALK_RING = 48;

/**
 * A white lynx, nearly invisible as it creeps up (a shimmer and two aurora
 * eyes). Close enough, it shows itself with a snarl and a raised paw, then
 * rakes twice; afterwards it stays seen a while, circling, before it melts
 * back into the snow. A blow while it stalks gives it away.
 */
export class Snowstalker extends Monster {
  private hidden = true;
  private seenT = 0;
  private phase: 'one' | 'gap' | 'two' = 'one';
  private ux = 1;
  private uy = 0;
  private struck = false;
  private orbit = Math.random() * Math.PI * 2;
  private spin = Math.random() < 0.5 ? 1 : -1;
  private lane: Phaser.GameObjects.Image | null = null;
  private t = Math.random() * 1000;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, { key: 'snowstalker', hp: mobHp('snowstalker'), radius: 9, bodyY: 9, speed: 56, sight: 170, leash: 300, mass: 1.3, barY: 26, debris: FUR_TINTS });
    this.cooldown = 600;
    this.fade = STALK_FADE;
  }

  get pinned(): boolean {
    return this.state === 'attack';
  }

  update(dt: number, target: Target | null, daylight: number): void {
    this.t += dt;
    if (!this.hidden && this.state !== 'windup' && this.state !== 'attack') {
      this.seenT -= dt;
      if (this.seenT <= 0) this.hidden = true;
    }
    // Hidden: a shimmer in the snow. Seen: fully there.
    const want = this.hidden ? STALK_FADE + Math.max(0, Math.sin(this.t * 0.013)) * 0.07 : 1;
    this.fade += (want - this.fade) * Math.min(1, dt / (this.hidden ? 260 : 90));
    if (this.hidden && Math.random() < dt / 700) this.world.debris(SNOW_TINTS, this.x + (Math.random() - 0.5) * 18, this.y - 4 - Math.random() * 10, 1, this.y + 1, 'spores');
    super.update(dt, target, daylight);
  }

  /** It walks seen, and creeps (belly low) while hidden. */
  protected move(dt: number, ux: number, uy: number, speed: number): void {
    this.x += (ux * speed * dt) / 1000;
    this.y += (uy * speed * dt) / 1000;
    this.face(ux);
    this.play(this.hidden ? 'stalk' : 'walk');
  }

  private reveal(ms: number): void {
    this.hidden = false;
    this.seenT = Math.max(this.seenT, ms);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    this.face(target.x - this.x);
    const dx = (target.x - this.x) / (dist || 1);
    const dy = (target.y - this.y) / (dist || 1);
    if (this.hidden) {
      if (this.cooldown === 0 && dist < STALK_REVEAL) {
        this.snarl(target);
        return;
      }
      // Creeping in on a slow curve, belly to the snow.
      this.move(dt, dx * 0.9 - dy * 0.35 * this.spin, dy * 0.9 + dx * 0.35 * this.spin, STALK_SPEED);
      this.face(target.x - this.x);
      return;
    }
    // Seen: it keeps its distance, circling, until it can melt away again.
    this.orbit += (dt / 1000) * 0.9 * this.spin;
    const gx = target.x + Math.cos(this.orbit) * STALK_RING;
    const gy = target.y + Math.sin(this.orbit) * STALK_RING * 0.7;
    const d = Math.hypot(gx - this.x, gy - this.y);
    if (d > 5) this.move(dt, (gx - this.x) / d, (gy - this.y) / d, this.stats.speed * (d > 30 ? 1 : 0.6));
    else this.stand(dt);
    this.face(target.x - this.x);
  }

  private snarl(target: Target): void {
    const w = this.world;
    this.reveal(STALK_SEEN);
    this.face(target.x - this.x);
    const l = Math.hypot(target.x - this.x, target.y - this.y) || 1;
    this.ux = (target.x - this.x) / l;
    this.uy = (target.y - this.y) / l;
    this.enter('windup', STALK_SNARL);
    this.play('windup', true);
    this.lane = frostLane(w, this.x, this.y, 1.3, T_TEAL);
    w.debris(SNOW_TINTS, snap(this.x), snap(this.y) - 6, 10, this.y + 1, 'spores');
    sound.roar(w.pan(this.x), false);
  }

  protected act(dt: number, target: Target | null): void {
    const w = this.world;
    if (this.state === 'windup') {
      const t = 1 - this.timer / STALK_SNARL;
      if (target && t < 0.7) {
        const l = Math.hypot(target.x - this.x, target.y - this.y) || 1;
        this.ux = (target.x - this.x) / l;
        this.uy = (target.y - this.y) / l;
        this.face(this.ux);
      }
      if (this.lane) layLane(this.lane, this.x, this.y, this.ux, this.uy, STALK_DASH + 18, 1.3, 0.15 + t * 0.5);
      if (this.timer <= 0) {
        this.phase = 'one';
        this.struck = false;
        this.enter('attack', STALK_SWIPE1);
        this.pose('swipe0');
        sound.rake(w.pan(this.x));
        clawStreak(w, this.x + this.ux * 16, this.y + this.uy * 9 - 10, this.facing === 'r' ? 1 : -1, false, this.y + 12);
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.phase === 'one') {
        const s = (STALK_DASH * dt) / STALK_SWIPE1;
        this.x += this.ux * s;
        this.y += this.uy * s;
        this.lane?.setAlpha(Math.max(0, this.timer / STALK_SWIPE1) * 0.5);
        if (!this.struck) this.struck = this.swipe(0.8, false);
        if (this.timer <= 0) {
          this.clear();
          this.phase = 'gap';
          this.enter('attack', STALK_GAP);
        }
        return;
      }
      if (this.phase === 'gap') {
        if (this.timer <= 0) {
          // The backhand: a half step on, the other way.
          this.phase = 'two';
          this.struck = false;
          this.enter('attack', STALK_SWIPE2);
          this.pose('swipe1');
          sound.rake(w.pan(this.x), true);
          clawStreak(w, this.x + this.ux * 14, this.y + this.uy * 8 - 12, this.facing === 'r' ? 1 : -1, true, this.y + 12);
        }
        return;
      }
      const s = (10 * dt) / STALK_SWIPE2;
      this.x += this.ux * s;
      this.y += this.uy * s;
      if (!this.struck) this.struck = this.swipe(0.8, true);
      if (this.timer <= 0) {
        this.enter('recover', STALK_RECOVER);
        this.play('idle', true);
        this.cooldown = 2800 + Math.random() * 1200;
        this.reveal(STALK_SEEN);
        this.spin = Math.random() < 0.5 ? 1 : -1;
        this.orbit = Math.atan2(this.y - (target?.y ?? this.y), this.x - (target?.x ?? this.x));
      }
      return;
    }
    if (this.timer <= 0) this.enter('chase', 0);
  }

  private swipe(k: number, chills: boolean): boolean {
    const w = this.world;
    const cx = this.x + this.ux * 13;
    const cy = this.y + this.uy * 8;
    const hit = w.hurtHeroInEllipse(cx, cy, 12, 8, { damage: mobHit('snowstalker', k), fromX: this.x, fromY: this.y - 8, knock: 150 });
    if (hit) {
      if (chills) chill(w, CHILL_LIGHT);
      w.debris(FUR_TINTS, snap(cx), snap(cy) - 10, 6, cy + 12);
    }
    return hit;
  }

  hurt(hit: Hit): void {
    // Struck while it stalks: it's given away.
    if (this.alive && this.hidden) this.reveal(STALK_SEEN * 0.7);
    super.hurt(hit);
  }

  netHurt(hit: Hit, damage: number): void {
    if (this.alive && this.hidden) this.reveal(STALK_SEEN * 0.7);
    super.netHurt(hit, damage);
  }

  private clear(): void {
    this.lane?.destroy();
    this.lane = null;
  }

  protected onInterrupted(): void {
    this.clear();
  }
}
