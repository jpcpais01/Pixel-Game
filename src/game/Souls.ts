import Phaser from 'phaser';
import type { Effect, Scheme } from './Slash';
import type { Hurtbox } from './combat';
import { BOLT_H } from '../art/necromancer';
import { SKELETON_BODY_Y, SKELETON_FRAME, SKELETON_STRIKE_FRAME } from '../art/skeleton';
import { snap } from './display';
import { sound } from '../audio';
import type { WorldScene } from '../scenes/WorldScene';

// The necromancer's magic: soul bolts that curve into the nearest foe (or,
// for the blood mage, blood lances that tear straight through several), and
// the risen dead, skeletons that shamble after his foes until their time runs
// out and they fall back to bones.

/** Soul fire: white-green burning to a deep sea-green. */
export const SOUL_FX: Scheme = { core: 0xf0fff8, hot: 0x9dffd4, mid: 0x3fe0a0, deep: 0x127a62, light: 0x60f0b0 };
/** Blood light: white-hot pink down to dark crimson. */
export const BLOOD_FX: Scheme = { core: 0xfff0f0, hot: 0xff8a96, mid: 0xe8243c, deep: 0x7a0a1e, light: 0xff4050 };

/** How a bolt flies and what it does. */
export interface BoltKind {
  /** Texture suffix of its orb and burst: '_soul' or '_blood'. */
  suffix: string;
  fx: Scheme;
  speed: number;
  range: number;
  damage: number;
  /** How fast it turns towards a foe near its path, in radians a second (0: flies straight). */
  seek: number;
  /** How many more bodies it tears through after the first. */
  pierce: number;
  blood: boolean;
}

/** Is a body standing at (x, y) close enough to the ground point (gx, gy) for a bolt passing over it to strike it? */
function inPath(h: Hurtbox, gx: number, gy: number): boolean {
  return Math.abs(h.x - gx) <= h.radius + 2 && Math.abs(h.y - gy) <= h.radius * 0.6 + 3.5;
}

/** Foes a seeking bolt will turn for: this far ahead of it, and within this cone. */
const SEEK_RANGE = 80;
const SEEK_CONE = 0.35;

/**
 * A bolt from the caster's palm: it flies at hand height over its shadow,
 * leaving a trail of motes; a soul bolt bends towards the nearest foe ahead,
 * a blood lance flies straight through up to `pierce` more. `onHit` runs for
 * every body it strikes.
 */
export class SoulBolt implements Effect {
  dead = false;
  private sprite: Phaser.GameObjects.Sprite;
  private halo: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private travelled = 0;
  private trailT = 0;
  private seekT = 0;
  private target: Hurtbox | null = null;
  private struck = new Set<Hurtbox>();
  private pierceLeft: number;
  private readonly tints: number[];
  private readonly inPathNow = (h: Hurtbox) => !this.struck.has(h) && inPath(h, this.x, this.y);

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private kind: BoltKind,
    private onHit: (h: Hurtbox, ux: number, uy: number) => void,
  ) {
    this.pierceLeft = kind.pierce;
    const fx = kind.fx;
    this.tints = [fx.core, fx.hot, fx.mid];
    this.sprite = world.add.sprite(x, y - BOLT_H, `orb${kind.suffix}_e`, 'o0').setBlendMode(Phaser.BlendModes.ADD).play(`orb${kind.suffix}_spin`);
    if (kind.blood) this.sprite.setScale(0.8);
    this.halo = world.add.image(x, y - BOLT_H, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(fx.mid).setAlpha(0.7).setScale(0.8);
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(0.45, 0.35).setAlpha(0.3);
    this.light = world.lights.addLight(x, y - BOLT_H, 70, fx.light ?? fx.hot, 1.8);
    this.place();
  }

  update(dt: number): void {
    if (this.dead) return;
    if (this.kind.seek > 0) this.steer(dt);
    // Step a few pixels at a time so it never skips over a small body.
    let move = (this.kind.speed * dt) / 1000;
    const area = this.world.area;
    while (move > 0) {
      const d = Math.min(3, move);
      move -= d;
      this.x += this.ux * d;
      this.y += this.uy * d;
      this.travelled += d;
      if (!area.contains(this.x, this.y)) {
        this.burst(false);
        return;
      }
      const hit = this.world.firstHurtbox(this.inPathNow);
      if (hit) {
        this.strike(hit);
        if (this.pierceLeft < 0) {
          this.burst(true);
          return;
        }
      }
      if (this.travelled >= this.kind.range) {
        this.burst(false);
        return;
      }
    }
    this.place();
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = this.kind.blood ? 26 : 34;
      this.world.debris(this.tints, snap(this.x - this.ux * 4), snap(this.y - BOLT_H - this.uy * 4), 1, this.y - 0.2, 'trail');
    }
  }

  /** Bend towards the nearest foe ahead, rechecked a few times a second. */
  private steer(dt: number): void {
    this.seekT -= dt;
    if (this.seekT <= 0 || (this.target && !this.target.alive)) {
      this.seekT = 90;
      this.target = null;
      let best = SEEK_RANGE;
      for (const h of this.world.hurtboxesWhere((h) => h.alive && !this.struck.has(h))) {
        const dx = h.x - this.x;
        const dy = h.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d >= best || d < 1) continue;
        if ((dx * this.ux + dy * this.uy) / d < SEEK_CONE) continue;
        best = d;
        this.target = h;
      }
    }
    if (!this.target) return;
    const want = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    const now = Math.atan2(this.uy, this.ux);
    const off = Math.atan2(Math.sin(want - now), Math.cos(want - now));
    const turn = Phaser.Math.Clamp(off, -this.kind.seek * (dt / 1000), this.kind.seek * (dt / 1000));
    this.ux = Math.cos(now + turn);
    this.uy = Math.sin(now + turn);
  }

  private place(): void {
    const x = snap(this.x);
    const y = snap(this.y - BOLT_H);
    const depth = this.y + 1;
    this.sprite.setPosition(x, y).setDepth(depth);
    this.halo.setPosition(x, y).setDepth(depth - 0.1);
    this.shadow.setPosition(snap(this.x), snap(this.y));
    this.light.setPosition(this.x, this.y - BOLT_H);
  }

  private strike(h: Hurtbox): void {
    this.struck.add(h);
    this.pierceLeft--;
    const bx = h.x - this.ux * (h.radius - 1);
    const by = h.y - h.bodyY;
    this.world.debris(this.tints, snap(bx), snap(by), this.kind.blood ? 9 : 7, h.y + 20);
    sound.soulHit(this.world.pan(bx), this.kind.blood);
    this.onHit(h, this.ux, this.uy);
  }

  /** It bursts where it ends: against a body, or fizzling out at the end of its flight. */
  private burst(struck: boolean): void {
    const s = this.kind.suffix;
    const b = this.world.add.sprite(snap(this.x), snap(this.y - BOLT_H), `burst${s}_e`, 'b0').setBlendMode(Phaser.BlendModes.ADD).setDepth(this.y + 20).play(`burst${s}_pop`);
    if (!struck) b.setScale(0.6);
    b.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => b.destroy());
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
    this.halo.destroy();
    this.shadow.destroy();
    this.world.lights.removeLight(this.light);
  }
}

// ---------------------------------------------------------------------------
// The risen dead

type RisenState = 'rise' | 'idle' | 'walk' | 'hit' | 'fall';

/** How a risen skeleton fights. */
export interface RisenStats {
  /** How long it stays before falling apart, in ms. */
  life: number;
  damage: number;
  speed: number;
  /** Rest between blows, in ms. */
  rest: number;
  /** It only goes after foes this close to its master. */
  leash: number;
}

/** Something to follow: where the necromancer stands. */
export interface Master {
  readonly x: number;
  readonly y: number;
}

/**
 * A skeleton that claws its way up out of the ground where it was raised,
 * then shambles after the nearest foe near its master and hacks at it with a
 * rusted blade. With no foe about it keeps close to its master, and when its
 * time is up (or it is dismissed) it falls back into a heap of bones.
 */
export class Risen implements Effect {
  dead = false;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private state: RisenState = 'rise';
  private side: 'r' | 'l';
  private target: Hurtbox | null = null;
  private lookT = 0;
  private restT = 0;
  private struck = false;
  private fade = -1;
  private life: number;

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private master: Master,
    /** Where it keeps to around its master while there's no fight, as an offset. */
    private slot: { x: number; y: number },
    private stats: RisenStats,
  ) {
    this.life = stats.life;
    this.side = x < master.x ? 'l' : 'r';
    const ox = SKELETON_FRAME.ox / SKELETON_FRAME.w;
    const oy = SKELETON_FRAME.oy / SKELETON_FRAME.h;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(0.75, 0.8).setAlpha(0);
    this.sprite = world.add.sprite(x, y, 'skeleton', `rise0_${this.side}`).setOrigin(ox, oy).setPipeline('Lit');
    this.glow = world.add.sprite(x, y, 'skeleton_e', `rise0_${this.side}`).setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.play('rise');
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (anim.key.startsWith('skeleton_rise') || anim.key.startsWith('skeleton_hit')) this.state = 'idle';
      else if (anim.key.startsWith('skeleton_fall')) this.fade = 600;
    });
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith('skeleton_hit') && frame.index - 1 === SKELETON_STRIKE_FRAME) this.land();
    });
    this.sync();
  }

  /** Still standing (not yet falling apart). */
  get standing(): boolean {
    return this.state !== 'fall' && !this.dead;
  }

  update(dt: number): void {
    if (this.dead) return;
    if (this.fade >= 0) {
      this.fade -= dt;
      const a = Math.max(0, this.fade / 600);
      this.sprite.setAlpha(a);
      this.glow.setAlpha(a);
      this.shadow.setAlpha(0.5 * a);
      if (this.fade <= 0) this.destroy();
      return;
    }
    this.life -= dt;
    if (this.life <= 0 && this.state !== 'fall') {
      this.crumble();
      return;
    }
    this.restT = Math.max(0, this.restT - dt);
    if (this.state === 'rise' || this.state === 'hit' || this.state === 'fall') {
      this.sync();
      return;
    }

    this.lookT -= dt;
    if (this.lookT <= 0 || (this.target && !this.target.alive)) {
      this.lookT = 250;
      this.target = this.nearestFoe();
    }
    const t = this.target;
    let gx: number;
    let gy: number;
    let reach: number;
    if (t) {
      // Stand beside the foe, on whichever side it is already on.
      gx = t.x + (this.x < t.x ? -1 : 1) * (t.radius + 4);
      gy = t.y;
      reach = 3;
    } else {
      gx = this.master.x + this.slot.x;
      gy = this.master.y + this.slot.y;
      reach = 10;
    }
    const dx = gx - this.x;
    const dy = gy - this.y;
    const d = Math.hypot(dx, dy);
    if (d > reach) {
      const step = Math.min(d, (this.stats.speed * dt) / 1000 * (t ? 1 : d > 40 ? 1.6 : 1));
      const nx = this.x + (dx / d) * step;
      const ny = this.y + (dy / d) * step;
      const area = this.world.area;
      if (this.world.walkable(nx, this.y)) this.x = Phaser.Math.Clamp(nx, area.left, area.right);
      if (this.world.walkable(this.x, ny)) this.y = Phaser.Math.Clamp(ny, area.top, area.bottom);
      if (Math.abs(dx) > 1) this.side = dx < 0 ? 'l' : 'r';
      this.setState('walk');
    } else if (t && this.restT === 0) {
      this.side = t.x < this.x ? 'l' : 'r';
      this.state = 'hit';
      this.struck = false;
      this.play('hit');
    } else {
      if (t) this.side = t.x < this.x ? 'l' : 'r';
      this.setState('idle');
    }
    this.sync();
  }

  /** The nearest live foe within its master's reach. */
  private nearestFoe(): Hurtbox | null {
    let best: Hurtbox | null = null;
    let bestD = Infinity;
    const m = this.master;
    const leash = this.stats.leash;
    for (const h of this.world.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - m.x, h.y - m.y) <= leash)) {
      const d = Math.hypot(h.x - this.x, h.y - this.y);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  /** The blade comes down. */
  private land(): void {
    if (this.struck) return;
    this.struck = true;
    this.restT = this.stats.rest;
    const t = this.target;
    if (!t || !t.alive) return;
    if (Math.abs(t.x - this.x) > t.radius + 9 || Math.abs(t.y - this.y) > 8) return;
    t.hurt({ damage: this.stats.damage, heavy: false, knock: 35, fromX: this.x, fromY: this.y - SKELETON_BODY_Y });
    this.world.debris([0xf0fff8, 0x9dffd4, 0xdcd4b4], snap(t.x + (this.x < t.x ? -t.radius : t.radius)), snap(t.y - t.bodyY), 5, t.y + 20);
    sound.boneHit(this.world.pan(this.x));
  }

  /** Its time is up: it falls apart. */
  crumble(): void {
    if (this.state === 'fall' || this.dead) return;
    this.state = 'fall';
    this.play('fall');
    this.world.debris([0xf0fff8, 0x9dffd4, 0x3fe0a0], snap(this.x), snap(this.y) - 10, 8, this.y + 20, 'spores');
    sound.boneCrumble(this.world.pan(this.x));
  }

  private setState(s: 'idle' | 'walk'): void {
    this.state = s;
    this.play(s, true);
  }

  private play(anim: RisenState, ignoreIfPlaying = false): void {
    this.sprite.play(`skeleton_${anim}_${this.side}`, ignoreIfPlaying);
  }

  private sync(): void {
    // Keep facing in step with the side it turned to, mid-walk or at rest.
    const cur = this.sprite.anims.currentAnim?.key;
    if (cur && !cur.endsWith(`_${this.side}`) && (this.state === 'walk' || this.state === 'idle')) this.play(this.state);
    const rx = snap(this.x);
    const ry = snap(this.y);
    this.sprite.setPosition(rx, ry).setDepth(ry);
    this.glow.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(this.sprite.frame.name);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.state === 'rise' ? 0.2 : 0.5);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
    this.glow.destroy();
    this.shadow.destroy();
  }
}
