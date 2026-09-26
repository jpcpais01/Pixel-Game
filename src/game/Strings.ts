import Phaser from 'phaser';
import { PUPPET_BODY_Y, PUPPET_FRAME, PUPPET_HOVER, PUPPET_STRIKE_FRAME, PUPPET_TIES } from '../art/puppeteer';
import { snap } from './display';
import { sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { sound } from '../audio';
import { onGround } from './Toxins';
import type { Hurtbox } from './combat';
import type { WorldScene } from '../scenes/WorldScene';
import { bloom, clamp01, dither, drag, easeOut, flare, Fx, Ink, pal, ring, segDist, type Pal } from './ultimate/ink';

// The puppeteer's strings made visible: the marionettist's puppet, which
// fights for him at the end of its strings, and the stringweaver's threads,
// which lash, snag and string up her foes.

/** The marionettist's strings: gold. */
export const GOLD_STRINGS: Pal = pal(0xfff8e0, 0xffe08a, 0xffb040, 0xb86a1e);
/** The porcelain look's: ice blue. */
export const ICE_STRINGS: Pal = pal(0xf2fbff, 0xb8ecff, 0x5ec8ff, 0x2a6ad8);
/** The stringweaver's silk: violet silver. */
export const SILK_STRINGS: Pal = pal(0xfbf4ff, 0xdcc0ff, 0xa878ff, 0x5a3ab0);
/** The red threads of fate. */
export const FATE_STRINGS: Pal = pal(0xfff0f0, 0xff9aa0, 0xff3a4a, 0x8a0f1f);

/** Something strings can hold: the monsters (bosses shrug them off). */
type Bindable = Hurtbox & { bind(ms: number, lift?: number): boolean; readonly held?: boolean };
const bindable = (h: Hurtbox): h is Bindable => typeof (h as Partial<Bindable>).bind === 'function';

/** Hold a foe helpless on strings for `ms`, lifted `lift` px; false if it can't be held. */
export function bindFoe(h: Hurtbox, ms: number, lift = 0): boolean {
  return bindable(h) && h.bind(ms, lift);
}

/**
 * A string of light from (x0, y0) to (x1, y1), sagging `sag` px at its middle:
 * a bright thread with a glint running along it (by `t`), faded by `a` in a
 * dithered checker.
 */
export function strand(ink: Ink, x0: number, y0: number, x1: number, y1: number, p: Pal, a: number, t: number, sag = 0): void {
  if (a <= 0) return;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(len * 1.2));
  const glint = (t * 0.0022) % 1;
  let lx = NaN;
  let ly = NaN;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = Math.round(x0 + (x1 - x0) * u);
    const y = Math.round(y0 + (y1 - y0) * u + sag * 4 * u * (1 - u));
    if (x === lx && y === ly) continue;
    lx = x;
    ly = y;
    if (a < 1 && dither(x, y) >= a) continue;
    const g = Math.abs(u - glint);
    ink.put(x, y, g < 0.04 ? p.core : g < 0.1 ? p.hot : i % 5 === 0 ? p.mid : p.hot, 0.9);
  }
}

// ---------------------------------------------------------------------------
// The puppet

/** How the marionettist's puppet fights. */
export interface PuppetKit {
  /** Its texture: 'puppet' or 'puppet_porcelain'. */
  key: string;
  strings: Pal;
  /** How far from the hand it can go, in px. */
  reach: number;
  strike: { damage: number; radius: number };
  chop: { damage: number; radius: number; knock: number };
  spin: { damage: number; radius: number; every: number; time: number };
}

type PState = 'follow' | 'dash' | 'strike' | 'spin' | 'show';

/** Where the hero is, for the puppet to follow and hang from. */
export interface Master {
  readonly x: number;
  readonly y: number;
  readonly alpha: number;
  daylight: number;
  /** The hand working the cross, in the world. */
  hand(): { x: number; y: number };
}

/**
 * The marionettist's puppet: a wooden knight dangling on three strings from
 * his cross. It keeps just ahead of him, bobbing, and on his word dashes out
 * to strike or to spin, then comes back. Monsters pay it no mind; it can't be
 * hurt. A Special can take it over (`show`) and move it by hand.
 */
export class Puppet {
  x: number;
  y: number;
  /** Extra height off the ground and size, while a Special has it. */
  lift = 0;
  scale = 1;
  /** Strings run up out of sight rather than to the hand (the Grand Finale). */
  stringsUp = false;
  private state: PState = 'follow';
  private facing: 'r' | 'l' = 'r';
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private ink: Ink;
  private t = 0;
  private tx = 0;
  private ty = 0;
  /** The way it lunged, for the arc of its blow. */
  private ux = 1;
  private uy = 0;
  private heavy = false;
  private struck = false;
  private spinT = 0;
  private tickT = 0;
  private front = { x: 0, y: 1 };
  private walking = false;

  constructor(
    private world: WorldScene,
    x: number,
    y: number,
    readonly kit: PuppetKit,
    private master: Master,
  ) {
    this.x = x;
    this.y = y + 8;
    const ox = PUPPET_FRAME.ox / PUPPET_FRAME.w;
    const oy = PUPPET_FRAME.oy / PUPPET_FRAME.h;
    const k = kit.key;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(0.8, 0.8);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${k}_s`, 'idle0_r').setOrigin(ox, oy));
    this.sprite = world.add.sprite(x, y, k, 'idle0_r').setOrigin(ox, oy).setPipeline('Lit');
    this.glow = world.add.sprite(x, y, `${k}_e`, 'idle0_r').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.ink = new Ink(world, 144, 120);
    this.ink.image.setBlendMode(Phaser.BlendModes.ADD);
    this.play('idle');
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (this.state === 'strike' && !this.struck && /_(strike|chop)_/.test(anim.key) && frame.index - 1 === PUPPET_STRIKE_FRAME) this.land();
    });
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (this.state === 'strike' && /_(strike|chop)_/.test(anim.key)) {
        if (!this.struck) this.land();
        this.state = 'follow';
      }
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Mid-lunge or mid-blow: it can't take another order yet. */
  get busy(): boolean {
    return this.state === 'dash' || this.state === 'strike' || this.state === 'spin' || this.state === 'show';
  }

  get spinning(): boolean {
    return this.state === 'spin';
  }

  /** Lunge at (x, y) and strike there; the heavy blow is a leaping chop. False if it's busy. */
  strike(x: number, y: number, heavy: boolean): boolean {
    if (this.busy) return false;
    this.heavy = heavy;
    this.go(x, y);
    this.state = 'dash';
    return true;
  }

  /** Dash to (x, y) and spin there, blade out. */
  pirouette(x: number, y: number): boolean {
    if (this.state === 'show') return false;
    this.go(x, y);
    this.state = 'dash';
    this.spinT = this.kit.spin.time;
    this.tickT = 0;
    this.heavy = false;
    return true;
  }

  /** A Special takes it over: it stays where it's put, playing what it's told. */
  show(): void {
    this.state = 'show';
    this.spinT = 0;
  }

  /** Give it back to the hero. */
  release(): void {
    this.state = 'follow';
    this.lift = 0;
    this.scale = 1;
    this.stringsUp = false;
  }

  /** Play one of its animations, facing `dx`'s way. */
  perform(anim: string, dx = 0): void {
    if (Math.abs(dx) > 0.5) this.facing = dx < 0 ? 'l' : 'r';
    this.play(anim);
  }

  /** Where its blade reaches from: the middle of its body, in the world. */
  get chest(): { x: number; y: number } {
    return { x: this.x, y: this.y - (PUPPET_HOVER + PUPPET_BODY_Y) * this.scale - this.lift };
  }

  /** Aim the next dash: within reach of the hand, on open ground. */
  private go(x: number, y: number): void {
    const m = this.master;
    let dx = x - m.x;
    let dy = y - m.y;
    const d = Math.hypot(dx, dy);
    if (d > this.kit.reach) {
      dx *= this.kit.reach / d;
      dy *= this.kit.reach / d;
    }
    const area = this.world.area;
    for (let k = 1; k >= 0; k -= 0.1) {
      this.tx = Phaser.Math.Clamp(m.x + dx * k, area.left, area.right);
      this.ty = Phaser.Math.Clamp(m.y + dy * k, area.top, area.bottom);
      if (this.world.walkable(this.tx, this.ty)) break;
    }
    const ux = this.tx - this.x;
    const uy = this.ty - this.y;
    const l = Math.hypot(ux, uy);
    if (l > 1) {
      this.ux = ux / l;
      this.uy = uy / l;
    }
  }

  update(dt: number, aim: { x: number; y: number } | null, walk: { x: number; y: number }): void {
    this.t += dt;
    const m = this.master;
    if (aim) this.front = aim;
    else if (walk.x || walk.y) this.front = walk;
    const px = this.x;
    const py = this.y;
    switch (this.state) {
      case 'follow': {
        // Just ahead of him and a little to his cross's side.
        const fx = this.front.x;
        const fy = this.front.y;
        const gx = m.x + fx * 16 - fy * 7;
        const gy = m.y + fy * 9 + fx * 3 + 4;
        const dx = gx - this.x;
        const dy = gy - this.y;
        const d = Math.hypot(dx, dy);
        if (d > 1.5) {
          const s = Math.min(d, (Math.min(260, 30 + d * 5) * dt) / 1000);
          this.x += (dx / d) * s;
          this.y += (dy / d) * s;
        }
        const far = Math.hypot(this.x - m.x, this.y - m.y);
        if (far > this.kit.reach + 20) {
          // Left behind: the strings haul it in.
          const k = (this.kit.reach + 20) / far;
          this.x = m.x + (this.x - m.x) * k;
          this.y = m.y + (this.y - m.y) * k;
        }
        const moved = Math.hypot(this.x - px, this.y - py) / Math.max(1, dt) * 1000;
        this.walking = moved > 14 || (this.walking && moved > 6);
        if (aim) this.facing = aim.x < -0.1 ? 'l' : aim.x > 0.1 ? 'r' : this.facing;
        else if (Math.abs(this.x - px) > 0.05) this.facing = this.x < px ? 'l' : 'r';
        this.play(this.walking ? 'walk' : 'idle');
        break;
      }
      case 'dash': {
        const dx = this.tx - this.x;
        const dy = this.ty - this.y;
        const d = Math.hypot(dx, dy);
        const s = (340 * dt) / 1000;
        if (Math.abs(dx) > 1) this.facing = dx < 0 ? 'l' : 'r';
        if (d <= s + 1) {
          this.x = this.tx;
          this.y = this.ty;
          if (this.spinT > 0) {
            this.state = 'spin';
            this.play('spin');
            sound.whirr(this.world.pan(this.x));
          } else {
            this.state = 'strike';
            this.struck = false;
            this.play(this.heavy ? 'chop' : 'strike', true);
          }
        } else {
          this.x += (dx / d) * s;
          this.y += (dy / d) * s;
          this.play('walk');
          if (Math.floor(this.t / 30) !== Math.floor((this.t - dt) / 30)) this.world.debris(this.kit.strings.tints, snap(this.x), snap(this.y) - 14, 1, this.y - 1, 'trail');
        }
        break;
      }
      case 'spin':
        this.spinStep(dt);
        break;
      case 'strike':
      case 'show':
        break;
    }
    this.sync();
  }

  /** The pirouette: a blow all round it every beat, drifting towards the nearest foe. */
  private spinStep(dt: number): void {
    const sp = this.kit.spin;
    this.spinT -= dt;
    this.tickT -= dt;
    const foe = this.nearest(40);
    if (foe) {
      const dx = foe.x - this.x;
      const dy = foe.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 6) {
        this.x += (dx / d) * 34 * (dt / 1000);
        this.y += (dy / d) * 34 * (dt / 1000);
      }
    }
    if (this.tickT <= 0) {
      this.tickT += sp.every;
      const c = this.chest;
      const hits = this.world.melee({ kind: 'circle', x: c.x, y: c.y, radius: sp.radius }, { damage: sp.damage, knock: 70, fromX: c.x, fromY: c.y });
      for (const h of hits) this.world.debris(this.kit.strings.tints, snap(h.x), snap(h.y), 4, h.y + 20);
      if (hits.length) sound.clack(this.world.pan(c.x), false);
      sound.whirr(this.world.pan(c.x));
    }
    if (Math.floor(this.t / 40) !== Math.floor((this.t - dt) / 40)) {
      const a = this.t * 0.03;
      const c = this.chest;
      this.world.debris(this.kit.strings.tints, snap(c.x + Math.cos(a) * 10), snap(c.y + 2 + Math.sin(a) * 4), 1, this.y + 1, 'trail');
    }
    if (this.spinT <= 0) this.state = 'follow';
  }

  /** The blade comes down (or the chop lands). */
  private land(): void {
    this.struck = true;
    const c = this.chest;
    const angle = Math.atan2(this.uy, this.ux);
    const b = this.heavy ? this.kit.chop : { ...this.kit.strike, knock: 80 };
    const hits = this.world.melee({ kind: 'arc', x: c.x, y: c.y, radius: b.radius, angle, spread: 1.3 }, { damage: b.damage, heavy: this.heavy, knock: b.knock, fromX: c.x, fromY: c.y });
    sound.clack(this.world.pan(c.x), this.heavy);
    for (const h of hits) this.world.debris(this.kit.strings.tints, snap(h.x), snap(h.y), this.heavy ? 8 : 5, h.y + 20);
    if (this.heavy) {
      this.world.cameras.main.shake(70, 0.001);
      bloom(this.world, c.x + this.ux * 8, c.y + 6, this.kit.strings.hot, 0.8, 220, this.y + 20, 0.6);
    }
  }

  private nearest(range: number): Hurtbox | null {
    let best = range;
    let pick: Hurtbox | null = null;
    for (const h of this.world.hurtboxesWhere((h) => h.alive)) {
      const d = Math.hypot(h.x - this.x, h.y - this.y);
      if (d < best) {
        best = d;
        pick = h;
      }
    }
    return pick;
  }

  private play(anim: string, restart = false): void {
    const key = `${this.kit.key}_${anim}_${this.facing}`;
    const cur = this.sprite.anims.currentAnim?.key;
    if (cur === key && !restart && this.sprite.anims.isPlaying) return;
    const same = !restart && cur && cur.slice(0, -2) === key.slice(0, -2);
    this.sprite.play({ key, startFrame: same ? Math.max(0, (this.sprite.anims.currentFrame?.index ?? 1) - 1) : 0 });
  }

  private sync(): void {
    const m = this.master;
    const bob = this.state === 'show' ? 0 : Math.round(Math.sin(this.t * 0.005) * 1);
    const rx = snap(this.x);
    const ry = snap(this.y);
    const hy = snap(ry - (PUPPET_HOVER + bob) * this.scale - this.lift);
    const frame = this.sprite.frame.name;
    const a = m.alpha;
    this.sprite.setPosition(rx, hy).setDepth(ry).setScale(this.scale).setAlpha(a);
    this.glow.setPosition(rx, hy).setDepth(ry + 0.1).setFrame(frame).setScale(this.scale).setAlpha(a);
    const up = Math.min(1, this.lift / 60);
    this.shadow.setPosition(rx, ry - 1).setScale(0.8 * this.scale * (1 - up * 0.5), 0.8 * this.scale * (1 - up * 0.5)).setAlpha(a * (1 - up * 0.6));
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setScale(this.scale, -0.46 * this.scale).setAlpha(SUN_SHADOW_ALPHA * m.daylight * a * (1 - up));
    this.drawStrings(rx, hy, frame, a);
  }

  /** Three strings from the cross's ends to its head and hands (or, held by a Special, up out of sight). */
  private drawStrings(rx: number, hy: number, frame: string, a: number): void {
    const ties = (PUPPET_TIES.get(frame) ?? []).map(([x, y]) => [rx + x * this.scale, hy + y * this.scale] as [number, number]).sort((p, q) => p[0] - q[0]);
    const p = this.kit.strings;
    if (this.stringsUp) {
      const g = this.ink.begin(rx, hy - 40 * this.scale, this.y + 30);
      for (const [x, y] of ties) strand(g, x, y, x + (x - rx) * 0.3, y - 90, p, a, this.t);
      g.end();
      return;
    }
    const h = this.master.hand();
    const cx = Math.round(h.x);
    const cy = Math.round(h.y);
    const g = this.ink.begin((cx + rx) / 2, (cy + hy - 16 * this.scale) / 2, Math.max(this.y, this.master.y) + 3);
    const ends: [number, number][] = [[cx - 3, cy], [cx, cy + 1], [cx + 3, cy]];
    const slack = this.state === 'follow' && !this.walking ? 1.2 : 0.3;
    ties.forEach(([x, y], i) => strand(g, ends[i][0], ends[i][1], x, y, p, a * 0.9, this.t + i * 300, slack));
    g.end();
  }

  destroy(): void {
    this.sprite.destroy();
    this.glow.destroy();
    this.shadow.destroy();
    this.castShadow.destroy();
    this.ink.destroy();
  }
}

// ---------------------------------------------------------------------------
// The stringweaver's threads

/** How a lash of thread flies and what it does. */
export interface LashKind {
  length: number;
  damage: number;
  /** The snag: hooks the first foe and reels it in, held. */
  snag: boolean;
  /** How long a snagged foe is held, and how hard it's reeled in (px/s). */
  hold: number;
  reel: number;
}

const OUT = 80;
const HOLD = 50;
const BACK = 110;
const REEL = 300;

/**
 * A razor thread cracking out from her fingers like a whip: it unspools along
 * the aim, cuts everything along its length, and springs back. The snag
 * hooks the first foe it meets instead, holds it and reels it in.
 */
export class ThreadLash extends Fx {
  private pix: Ink;
  private hit = false;
  private hooked: Hurtbox | null = null;
  private tip = { x: 0, y: 0 };

  constructor(
    world: WorldScene,
    private from: () => { x: number; y: number },
    private ux: number,
    private uy: number,
    private kind: LashKind,
    private p: Pal,
  ) {
    super(world, OUT + HOLD + (kind.snag ? REEL : 0) + BACK);
    this.pix = this.ink(Math.ceil(kind.length * 2 + 24), Math.ceil(kind.length * 2 + 24));
    this.pix.image.setBlendMode(Phaser.BlendModes.ADD);
  }

  protected step(dt: number): void {
    const { t, kind } = this;
    const o = this.from();
    const reelEnd = OUT + HOLD + (kind.snag ? REEL : 0);
    // How far out the thread is.
    const out = t < OUT ? easeOut(t / OUT) : t < reelEnd ? 1 : 1 - clamp01((t - reelEnd) / BACK);
    if (!this.hit && t >= OUT) this.strike(o);
    const h = this.hooked;
    if (h && t < reelEnd) {
      // Reel the hooked foe in, the thread taut to its body.
      if (h.alive) drag(h, o.x, o.y + 6, kind.reel, dt);
      this.tip = { x: h.x, y: h.y - h.bodyY };
    } else {
      this.tip = { x: o.x + this.ux * kind.length * out, y: o.y + this.uy * kind.length * out };
      if (h) this.hooked = null;
    }
    const g = this.pix.begin(o.x, o.y, Math.max(o.y, this.tip.y) + 40);
    // A whip's wave running out along it, dying as it goes taut.
    const len = Math.hypot(this.tip.x - o.x, this.tip.y - o.y);
    const n = Math.max(2, Math.ceil(len));
    const amp = t < OUT ? 3 * (1 - t / OUT) : 0;
    const nx = -this.uy;
    const ny = this.ux;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const w = Math.sin(u * 9 - t * 0.05) * amp * u * (1 - u) * 4;
      const x = Math.round(o.x + (this.tip.x - o.x) * u + nx * w);
      const y = Math.round(o.y + (this.tip.y - o.y) * u + ny * w);
      g.put(x, y, u > 0.92 ? this.p.core : i % 4 === 0 ? this.p.mid : this.p.hot, 0.95);
    }
    // The needle at its head.
    const tx = Math.round(this.tip.x);
    const ty = Math.round(this.tip.y);
    g.put(tx, ty, this.p.core);
    g.put(tx + Math.round(this.ux), ty + Math.round(this.uy), this.p.core);
    g.put(tx - 1, ty, this.p.hot, 0.7);
    g.put(tx + 1, ty, this.p.hot, 0.7);
    g.put(tx, ty - 1, this.p.hot, 0.7);
    g.end();
  }

  /** At full stretch: the thread cuts along its length, or hooks the first foe on it. */
  private strike(o: { x: number; y: number }): void {
    this.hit = true;
    const { kind } = this;
    const x1 = o.x + this.ux * kind.length;
    const y1 = o.y + this.uy * kind.length;
    if (!kind.snag) {
      const hits = this.world.melee({ kind: 'line', x0: o.x, y0: o.y, x1, y1, radius: 4 }, { damage: kind.damage, knock: 50, fromX: o.x, fromY: o.y });
      for (const h of hits) this.world.debris(this.p.tints, snap(h.x), snap(h.y), 4, h.y + 20);
      return;
    }
    // The first foe along the thread.
    let best = Infinity;
    let pick: Hurtbox | null = null;
    for (const h of this.world.hurtboxesWhere((h) => h.alive)) {
      const bx = h.x;
      const by = h.y - h.bodyY;
      if (segDist(bx, by, o.x, o.y, x1, y1) > h.radius + 4) continue;
      const along = (bx - o.x) * this.ux + (by - o.y) * this.uy;
      if (along < best) {
        best = along;
        pick = h;
      }
    }
    if (!pick) return;
    pick.hurt({ damage: kind.damage, heavy: false, knock: 0, fromX: pick.x, fromY: pick.y });
    this.world.debris(this.p.tints, snap(pick.x), snap(pick.y - pick.bodyY), 8, pick.y + 20);
    sound.twang(this.world.pan(pick.x), true);
    if (bindFoe(pick, kind.hold, 3)) this.hooked = pick;
  }
}

/**
 * The marionette: strings drop out of the air onto every foe in a circle,
 * hoist them up and hold them helpless, jerking, then slam them down.
 */
export class Marionette extends Fx {
  private pix: Ink;
  private foes: Hurtbox[] = [];
  private caught = false;
  private slammed = false;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
    private radius = 36,
    private hold = 1500,
    private slam = 16,
  ) {
    super(world, 300 + hold + 350);
    this.pix = this.ink(Math.ceil(radius * 2 + 40), Math.ceil(radius + 130));
    world.debris(p.tints, snap(x), snap(y) - 70, 10, y + 40, 'spores');
    sound.strings(world.pan(x));
  }

  protected step(): void {
    const { t, x, y, p, world } = this;
    const drop = 300;
    const barY = y - 78;
    if (!this.caught && t >= drop - 60) {
      this.caught = true;
      this.foes = world.hurtboxesWhere((h) => h.alive && onGround(h, x, y, this.radius));
      for (const h of this.foes) {
        bindFoe(h, this.hold, 8);
        h.hurt({ damage: 5, heavy: false, knock: 0, fromX: h.x, fromY: h.y });
      }
      if (this.foes.length) sound.twang(world.pan(x), true);
    }
    const end = drop + this.hold;
    if (!this.slammed && t >= end) {
      this.slammed = true;
      for (const h of this.foes) {
        if (!h.alive) continue;
        h.hurt({ damage: this.slam, heavy: true, knock: 40, fromX: h.x, fromY: h.y - 20 });
        world.debris(p.tints, snap(h.x), snap(h.y) - 2, 8, h.y + 20);
      }
      sound.clack(world.pan(x), true);
      world.cameras.main.shake(90, 0.0014);
      flare(world, x, y - 6, 70, p.light, 2, 400);
    }
    const g = this.pix.begin(x, y + 20, y + 60, 0.5, 1);
    const fade = t < end ? 1 : 1 - clamp01((t - end) / 300);
    // A bar of light in the air, the cross the strings hang from.
    const open = easeOut(t / 250) * fade;
    const bw = Math.round(this.radius * 0.8 * open);
    for (let i = -bw; i <= bw; i++) g.put(x + i, barY, Math.abs(i) < bw * 0.3 ? p.core : p.hot, 0.9 * fade);
    for (let i = -4; i <= 4; i++) g.put(x, barY + i * open, p.mid, 0.8 * fade);
    if (!this.caught) {
      // Strings drop towards whoever stands in the circle.
      const k = easeOut(t / drop);
      for (const h of world.hurtboxesWhere((h) => h.alive && onGround(h, x, y, this.radius))) {
        const tx = h.x;
        const ty = h.y - h.bodyY - 4;
        strand(g, x + (tx - x) * 0.3, barY, x + (tx - x) * 0.3 + (tx - x) * 0.7 * k, barY + (ty - barY) * k, p, 0.9, t);
      }
    } else if (t < end + 120) {
      for (const h of this.foes) {
        if (!h.alive) continue;
        const jerk = Math.sin(t * 0.02 + h.x) * 1.5;
        const top = h.y - h.bodyY - 5;
        strand(g, x + (h.x - x) * 0.3 - 2, barY, h.x - 2 + jerk, top, p, fade, t);
        strand(g, x + (h.x - x) * 0.3 + 2, barY, h.x + 2 + jerk, top, p, fade * 0.8, t + 400);
      }
    }
    ring(g, x, y, this.radius * open, 1.2, p, 0.5 * open * (t < drop ? t / drop : 1), undefined, 0.35, 7);
    g.end();
  }
}
