import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { BANSHEE_CHEST_Y, BANSHEE_H, BANSHEE_MOUTH_Y, BANSHEE_ORIGIN_X, BANSHEE_ORIGIN_Y, BANSHEE_W } from '../art/banshee';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { Phase, PHASE_SPEED } from './phase';
import { bloom, clamp01, dither, easeOut, Fx, GROUND, pal, ring, shade, type Ink, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Banshee (the Phantom's third type): a gaunt keening spirit woman.
//  - Attack (held): Keen. She wails the way she aims: ripples of sound roll
//    out of her mouth in a short cone, striking every foe the front passes.
//  - Ability: Shriek. A piercing shriek bursts out in a ring round her: it
//    hurts, and it terrifies whatever is near, sending it fleeing from her,
//    slowed and shivering, for a moment.
//  - Special: Lament (see ultimate/banshee.ts). She rises and sings while it
//    lasts, drifting slowly, and can't keen or shriek over her own song.
// Like every Phantom she phases through the next blow (see phase.ts).
// The Ghost Bride wails in pale lilac, blue rose petals caught in her keen;
// she plays the same.

const KEEN_EVERY = 420;
/** The cone: how far it reaches, how wide either side of the aim, and how long the front takes to get there. */
const KEEN_R = 70;
const KEEN_SPREAD = (32 * Math.PI) / 180;
const KEEN_TRAVEL = 260;
const KEEN_DAMAGE = 7;
/** The keen leaves her mouth this long into the move (the breath drawn first). */
const KEEN_AT = 90;

const SHRIEK_R = 48;
const SHRIEK_DAMAGE = 12;
const SHRIEK_AT = 110;
const SHRIEK_COOLDOWN = 6000;
/** Terror: how long foes flee, how fast they're driven off, and how slow their own feet are meanwhile. */
const FEAR_MS = 1500;
const FEAR_PUSH = 62;
const FEAR_SLOW = 0.35;

/** Singing her lament: how slow she drifts. */
const SING_SPEED = 0.45;

type State = 'free' | 'keen' | 'shriek' | 'sing';

export interface BansheeKit {
  key: string;
  bride: boolean;
  maxHp: number;
  speed: number;
  pal: Pal;
}

export const BANSHEE_KIT: BansheeKit = {
  key: 'weeper',
  bride: false,
  maxHp: HERO_STATS['phantom.weeper'].hp,
  speed: HERO_STATS['phantom.weeper'].speed,
  pal: pal(0xf2f6ff, 0xc4d4ff, 0xa0b8ff, 0x3a4c8a, 0xa8c0ff),
};

export const BRIDE_KIT: BansheeKit = {
  ...BANSHEE_KIT,
  key: 'weeper_bride',
  bride: true,
  pal: pal(0xfbf8ff, 0xdcd0ff, 0xb4a4f0, 0x4a3e8a, 0xc8b8ff),
};

/** The Bride's blue rose petals. */
export const PETALS = [0x6a86e0, 0x3c52b4, 0xa4bcff];

type Fleer = Hurtbox & { shove?(dx: number, dy: number): void; boss?: boolean };

export class Banshee implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: BansheeKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private aura: Phaser.GameObjects.Light;
  private phase: Phase;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private keenT = 0;
  private fireT = -1;
  private shriekT = -1;
  private shriekCd = 0;
  private singT = 0;
  private prevSpecial = false;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: BansheeKit = BANSHEE_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = BANSHEE_ORIGIN_X / BANSHEE_W;
    const oy = BANSHEE_ORIGIN_Y / BANSHEE_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(0.75, 0.65);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 64, kit.pal.light, 0);
    this.phase = new Phase(world, this, kit.pal.hot);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if ((this.state === 'keen' && anim.key.startsWith(`${key}_keen_`)) || (this.state === 'shriek' && anim.key.startsWith(`${key}_shriek_`))) this.state = 'free';
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.phase.destroy());
  }

  dodge(): boolean {
    return this.phase.dodge();
  }

  /** The Lament has begun: she rises and sings for `ms`, drifting slowly, her own moves held. */
  sing(ms: number): void {
    this.singT = ms;
    this.state = 'sing';
    this.fireT = -1;
    this.shriekT = -1;
    this.body.play(`${this.kit.key}_sing_${this.dir}`, true);
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.keenT = Math.max(0, this.keenT - dt);
    this.shriekCd = Math.max(0, this.shriekCd - dt);
    this.phase.update(dt);
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;

    if (this.state === 'sing') {
      this.singT -= dt;
      if (this.singT <= 0) this.state = 'free';
    } else if (this.state !== 'shriek') {
      if (pressed && this.shriekCd === 0) this.shriek();
      else if (attack && this.keenT === 0) this.keen();
    }
    if (this.fireT >= 0) {
      this.fireT -= dt;
      if (this.fireT < 0) this.wail();
    }
    if (this.shriekT >= 0) {
      this.shriekT -= dt;
      if (this.shriekT < 0) this.burst();
    }

    const k = this.state === 'sing' ? SING_SPEED : this.state === 'shriek' ? 0.25 : this.state === 'keen' ? 0.7 : 1;
    const speed = this.kit.speed * k * (this.phase.active ? PHASE_SPEED : 1) * Math.min(1, len);
    if (moving) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * speed * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * speed * (dt / 1000), bounds.top, bounds.bottom);
    }
    if (this.state === 'free' || this.state === 'sing') {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key =
        this.state === 'sing' ? `${this.kit.key}_sing_${this.dir}` : moving ? `${this.kit.key}_move_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    }
    this.sync();
    this.updateHud();
  }

  // -------------------------------------------------------------------------

  /** The keen: a breath drawn, then the wail leaves her mouth. */
  private keen(): void {
    const u = this.aimVec();
    this.keenT = KEEN_EVERY;
    this.state = 'keen';
    this.fireT = KEEN_AT;
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_keen_${this.dir}`, true);
  }

  private wail(): void {
    const u = this.aimVec();
    this.world.addEffect(new KeenWave(this.world, this, Math.atan2(u.y, u.x), this.kit));
    sound.wail(this.world.pan(this.x));
  }

  private shriek(): void {
    const u = this.aimVec();
    this.state = 'shriek';
    this.shriekCd = SHRIEK_COOLDOWN;
    this.shriekT = SHRIEK_AT;
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_shriek_${this.dir}`, true);
  }

  /** The shriek bursts out: everything near is struck and flees in terror. */
  private burst(): void {
    const w = this.world;
    const x = this.x;
    const y = this.y;
    const struck = w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - x, (b.y - y) / GROUND) <= SHRIEK_R + b.radius);
    for (const h of struck) {
      h.hurt({ damage: SHRIEK_DAMAGE, heavy: true, knock: 150, fromX: x, fromY: y });
      h.slow?.(FEAR_SLOW, FEAR_MS, this.kit.pal.mid);
      w.debris(this.kit.pal.tints, h.x, h.y - h.bodyY, 6, h.y + 10, 'burst');
    }
    w.addEffect(new ShriekBurst(w, x, y, this.kit));
    if (struck.length) w.addEffect(new Terror(w, struck as Fleer[], this, this.kit));
    bloom(w, x, y - BANSHEE_MOUTH_Y, this.kit.pal.hot, 2.4, 380, y + 30);
    w.debris([0xffffff, ...this.kit.pal.tints], x, y - BANSHEE_MOUTH_Y, 18, y + 20, 'burst');
    if (this.kit.bride) w.debris(PETALS, x, y - BANSHEE_CHEST_Y, 10, y + 20, 'spores');
    w.cameras.main.shake(180, 0.0012);
    sound.screech(w.pan(x));
    sound.gust(w.pan(x));
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.shriekCd / SHRIEK_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'shriek';
    comboHud.hits = 0;
    comboHud.window = 0;
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    const a = this.alpha * this.phase.opacity;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(a);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    // She floats: a soft shadow under her, fainter while she's risen in song.
    const high = this.state === 'sing';
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha * (high ? 0.35 : 0.5));
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * a * 0.6);
    this.aura.setPosition(rx, ry - 20);
    this.aura.intensity = (high ? 1.2 : 0.7) * (1 - this.daylight) + 0.2;
  }
}

/** Where a hurtbox stands off a cone's axis: true when inside `spread` (its body counted) and within `r`. */
function inCone(h: Hurtbox, x: number, y: number, ang: number, r: number, spread: number): boolean {
  const dx = h.x - x;
  const dy = (h.y - y) / GROUND;
  const d = Math.hypot(dx, dy);
  if (d - h.radius > r) return false;
  if (d <= h.radius + 4) return true;
  let off = Math.atan2(dy, dx) - ang;
  off = Math.atan2(Math.sin(off), Math.cos(off));
  return Math.abs(off) <= spread + Math.atan2(h.radius, d);
}

/**
 * One keen: three ripples of sound rolling out of her mouth in a cone, the
 * front striking each foe it passes once, a faint echo of them drawn on the
 * ground under it. The Bride's carry a few blue petals along.
 */
class KeenWave extends Fx {
  private g: Ink;
  private hit = new Set<Hurtbox>();
  private x0: number;
  private y0: number;
  private struck = false;

  constructor(
    world: WorldScene,
    from: { x: number; y: number },
    private ang: number,
    private kit: BansheeKit,
  ) {
    super(world, KEEN_TRAVEL + 220);
    this.x0 = from.x;
    this.y0 = from.y;
    this.g = this.ink(KEEN_R * 2 + 20, KEEN_R * 2 + 40);
  }

  protected step(): void {
    const w = this.world;
    const p = this.kit.pal;
    const front = KEEN_R * easeOut(this.t / KEEN_TRAVEL);
    // Struck as the front reaches them.
    for (const h of w.hurtboxesWhere((b) => b.alive && !this.hit.has(b) && inCone(b, this.x0, this.y0, this.ang, front, KEEN_SPREAD))) {
      this.hit.add(h);
      h.hurt({ damage: KEEN_DAMAGE, heavy: false, knock: 70, fromX: this.x0, fromY: this.y0 });
      w.debris(this.kit.bride ? [...PETALS, p.core] : p.tints, h.x, h.y - h.bodyY, 4, h.y + 10, 'spores');
      if (!this.struck) {
        this.struck = true;
        sound.soulHit(w.pan(h.x));
      }
    }
    // The ripples, at her mouth's height, and their echo on the ground.
    const mx = this.x0;
    const my = this.y0 - BANSHEE_MOUTH_Y;
    const g = this.g.begin(mx, this.y0, this.y0 + 30);
    const fade = 1 - clamp01((this.t - KEEN_TRAVEL) / 220);
    for (let i = 0; i < 3; i++) {
      const r = front - i * 11;
      if (r < 6) continue;
      const a = fade * (1 - (r / KEEN_R) * 0.55) * (1 - i * 0.22);
      this.arc(g, mx, my, r, i === 0 ? 1.4 : 0.9, p, a, i);
      this.arc(g, this.x0, this.y0, r, 0.5, p, a * 0.35, i + 5, GROUND);
    }
    if (this.kit.bride) {
      // Petals tumbling along just behind the front.
      for (let i = 0; i < 4; i++) {
        const q = this.ang + (i / 3 - 0.5) * KEEN_SPREAD * 1.4 + Math.sin(this.t * 0.02 + i) * 0.1;
        const r = Math.max(0, front - 6 - i * 3);
        const px = mx + Math.cos(q) * r;
        const py = my + Math.sin(q) * r * 0.75 + Math.sin(this.t * 0.03 + i * 2) * 1.5;
        g.put(px, py, PETALS[i % 3], fade);
        g.put(px + 1, py, PETALS[(i + 1) % 3], fade * 0.8);
      }
    }
    g.end();
  }

  /** A ripple: a band `w` thick bowed across the cone, thinning away to its ends. */
  private arc(g: Ink, cx: number, cy: number, r: number, w: number, p: Pal, a: number, seed: number, sq = 0.75): void {
    if (a <= 0) return;
    const steps = Math.ceil(KEEN_SPREAD * 2 * r * 1.4);
    for (let s = 0; s <= steps; s++) {
      const k = s / steps;
      const q = this.ang - KEEN_SPREAD + k * KEEN_SPREAD * 2;
      const end = Math.abs(k - 0.5) * 2;
      // A tremble along the band, like a voice breaking.
      const rr = r + Math.sin(k * 14 + this.t * 0.04 + seed) * 0.8;
      for (let o = -w; o <= w; o += 0.5) {
        const x = cx + Math.cos(q) * (rr + o);
        const y = cy + Math.sin(q) * (rr + o) * sq;
        if (end > 0.7 && dither(Math.round(x), Math.round(y)) < (end - 0.7) * 3) continue;
        g.put(x, y, shade(p, Math.abs(o) / (w + 0.5) + end * 0.3), a);
      }
    }
  }
}

/** The shriek: rings of sound bursting from her, and shrill jags flung off them. */
class ShriekBurst extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private kit: BansheeKit,
  ) {
    super(world, 520);
    this.g = this.ink(SHRIEK_R * 2 + 40, SHRIEK_R * 2 + 60);
  }

  protected step(): void {
    const p = this.kit.pal;
    const { x, y } = this;
    const g = this.g.begin(x, y - 8, y + 2);
    for (let i = 0; i < 3; i++) {
      const k = clamp01((this.t - i * 70) / 420);
      if (k <= 0 || k >= 1) continue;
      ring(g, x, y, SHRIEK_R * easeOut(k), 2.2 - i * 0.6, p, (1 - k) * (1 - i * 0.2), GROUND, 0.25 + i * 0.15, i);
    }
    // Jags of the shriek flung out round her head.
    const k = clamp01(this.t / 300);
    if (k < 1) {
      const hy = y - BANSHEE_MOUTH_Y;
      for (let i = 0; i < 10; i++) {
        const q = (i / 10) * Math.PI * 2 + 0.3;
        const r0 = 8 + k * 26;
        let px = x + Math.cos(q) * r0;
        let py = hy + Math.sin(q) * r0 * 0.75;
        for (let j = 0; j < 4; j++) {
          const nx = px + Math.cos(q + (j % 2 ? 0.6 : -0.6)) * 3;
          const ny = py + Math.sin(q + (j % 2 ? 0.6 : -0.6)) * 2.2;
          g.put(nx, ny, j < 2 ? p.core : p.hot, 1 - k);
          px = nx;
          py = ny;
        }
      }
    }
    g.end();
  }
}

/**
 * Terror: each foe the shriek caught flees from her, driven off (bosses
 * stand their ground, only slowed), shivering, a wisp of fright over its head.
 */
class Terror extends Fx {
  private g: Ink[] = [];

  constructor(
    world: WorldScene,
    private foes: Fleer[],
    private from: { x: number; y: number },
    private kit: BansheeKit,
  ) {
    super(world, FEAR_MS);
    for (let i = 0; i < foes.length; i++) this.g.push(this.ink(14, 12));
  }

  protected step(dt: number): void {
    const p = this.kit.pal;
    const left = 1 - this.t / FEAR_MS;
    this.foes.forEach((h, i) => {
      const g = this.g[i];
      if (!h.alive) {
        g.begin(h.x, h.y, 0).end();
        return;
      }
      if (!h.boss && h.shove) {
        // Away from where she is now, harder at first.
        const dx = h.x - this.from.x;
        const dy = h.y - this.from.y;
        const d = Math.hypot(dx, dy) || 1;
        const s = (FEAR_PUSH * (0.4 + left * 0.8) * dt) / 1000;
        h.shove((dx / d) * s, (dy / d) * s);
      }
      // Over the head: two shivering ticks and a little wailing wisp.
      const hx = h.x;
      const hy = h.y - h.bodyY * 2 - 6;
      const j = Math.floor(this.t / 40) % 2 ? 1 : 0;
      const a = Math.min(1, left * 3);
      const ink = g.begin(hx, hy, h.y + 40);
      ink.put(hx - 4 + j, hy - 2, p.core, a);
      ink.put(hx - 4 + j, hy - 1, p.hot, a);
      ink.put(hx - 5 + j, hy, p.mid, a);
      ink.put(hx + 4 + j, hy - 2, p.core, a);
      ink.put(hx + 4 + j, hy - 1, p.hot, a);
      ink.put(hx + 5 + j, hy, p.mid, a);
      const wy = hy - 2 + Math.sin(this.t * 0.012 + i) * 1.5;
      ink.put(hx + j * 0.5, wy - 1, p.core, a);
      ink.put(hx - 1 + j * 0.5, wy, p.hot, a);
      ink.put(hx + 1 + j * 0.5, wy, p.hot, a);
      ink.put(hx + j * 0.5, wy + 1, p.mid, a * 0.7);
      ink.end();
    });
  }
}
