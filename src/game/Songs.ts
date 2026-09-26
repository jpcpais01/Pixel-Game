import Phaser from 'phaser';
import { NOTE_H } from '../art/bard';
import { snap } from './display';
import { sound } from '../audio';
import type { BuffDef } from './buffs';
import type { Hurtbox } from './combat';
import type { Effect } from './Slash';
import type { WorldScene } from '../scenes/WorldScene';
import { bloom, dither, easeOut, flare, Fx, type Ink, pal, ring, shade, type Pal } from './ultimate/ink';

// The bard's music made visible: the minstrel's notes, which fly from the
// lute and leap from foe to foe; the war drummer's shockwaves, rolling out of
// the drum and throwing foes back; and the songs' own buffs.

/** The minstrel's music: white-teal light. */
export const SONG_PAL: Pal = pal(0xf4fffc, 0xa8fff0, 0x3fd8c8, 0x1a7a8a, 0x6fe8d8);
/** The minstrel's wildsong skin: firefly light, gold-green. */
export const WILD_PAL: Pal = pal(0xfffde6, 0xeaffa0, 0x9ee85a, 0x2e7a3e, 0xb8f070);
/** The drummer's: amber fire. */
export const DRUM_PAL: Pal = pal(0xfffbe8, 0xffd98a, 0xff9a3a, 0xb8401e, 0xffa850);

/** The minstrel's song: quicker feet and wounds closing, for everyone who hears it. */
export const HASTE: BuffDef = {
  id: 'haste',
  name: 'Song of haste',
  icon: 'icon_song',
  tint: 0x6fe8d8,
  duration: 8000,
  mods: { speed: 1.3, regen: 4 },
};

/** The same song in the wildsong's voice. */
export const WILD_HASTE: BuffDef = { ...HASTE, name: 'Song of the grove', icon: 'icon_song_wild', tint: 0xb8f070 };

/** How the minstrel's music looks: the notes' texture (frames n0 and n1) and their colours. */
export interface SongLook {
  tex: string;
  pal: Pal;
}

export const TROUBADOUR_SONG: SongLook = { tex: 'note_e', pal: SONG_PAL };
/** Leaf-flagged notes and little wisps. */
export const WILD_SONG: SongLook = { tex: 'note_wild_e', pal: WILD_PAL };

/** The drummer's rhythm: every blow lands harder. */
export const RHYTHM: BuffDef = {
  id: 'rhythm',
  name: 'Battle rhythm',
  icon: 'icon_rhythm',
  tint: 0xffa850,
  duration: 8000,
  mods: { damage: 1.35 },
};

/** How a note flies and what it does. */
export interface NoteKind {
  damage: number;
  /** How many more foes it leaps to after the first. */
  bounces: number;
  /** Each leap strikes for this share of the one before. */
  falloff: number;
  speed: number;
  range: number;
  /** How fast it turns towards a foe near its path, in radians a second. */
  seek: number;
  /** Casts a real light (kept off for the Special's many notes: lights are few). */
  lit: boolean;
}

/** A note leaps to the nearest foe this close to the one it struck. */
const BOUNCE_RANGE = 80;
/** Foes a note bends towards: this far ahead of it, and within this cone. */
const SEEK_RANGE = 90;
const SEEK_CONE = 0.3;

/** Is a body standing at (x, y) close enough to the ground point (gx, gy) for a note passing over it to strike it? */
function inPath(h: Hurtbox, gx: number, gy: number): boolean {
  return Math.abs(h.x - gx) <= h.radius + 2 && Math.abs(h.y - gy) <= h.radius * 0.6 + 3.5;
}

/**
 * A note of music: it flies bobbing at lute height over its shadow, bends
 * towards a foe ahead, and when it strikes leaps on to the nearest foe it
 * hasn't struck yet, a little weaker each time, ringing higher with each leap.
 */
export class Note implements Effect {
  dead = false;
  private img: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light | null;
  private travelled = 0;
  private t: number;
  private trailT = 0;
  private seekT = 0;
  private hops = 0;
  private struck = new Set<Hurtbox>();
  private readonly inPathNow = (h: Hurtbox) => !this.struck.has(h) && inPath(h, this.x, this.y);

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private kind: NoteKind,
    private target: Hurtbox | null = null,
    private look: SongLook = TROUBADOUR_SONG,
  ) {
    this.t = Math.random() * 1000;
    this.img = world.add.image(x, y - NOTE_H, look.tex, Math.random() < 0.5 ? 'n0' : 'n1').setBlendMode(Phaser.BlendModes.ADD);
    this.halo = world.add.image(x, y - NOTE_H, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(look.pal.mid).setAlpha(0.5).setScale(0.6);
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(0.35, 0.3).setAlpha(0.25);
    this.light = kind.lit ? world.lights.addLight(x, y - NOTE_H, 60, look.pal.light, 1.4) : null;
    this.place();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    this.steer(dt);
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
        this.pop(0.5);
        return;
      }
      const hit = this.world.firstHurtbox(this.inPathNow);
      if (hit && this.strike(hit)) return;
      if (this.travelled >= (this.hops === 0 ? this.kind.range : BOUNCE_RANGE + 30)) {
        this.pop(0.5);
        return;
      }
    }
    this.place();
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 40;
      this.world.debris(this.look.pal.tints, snap(this.x - this.ux * 4), snap(this.y - NOTE_H - this.uy * 4), 1, this.y - 0.2, 'trail');
    }
  }

  /** Turn towards the target: gently on the first flight, sharply once it has leapt. */
  private steer(dt: number): void {
    if (this.target && !this.target.alive) this.target = null;
    if (!this.target && this.hops === 0 && this.kind.seek > 0) {
      this.seekT -= dt;
      if (this.seekT <= 0) {
        this.seekT = 90;
        this.target = this.ahead();
      }
    }
    if (!this.target) return;
    const rate = this.hops > 0 ? 16 : this.kind.seek;
    const want = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    const now = Math.atan2(this.uy, this.ux);
    const off = Math.atan2(Math.sin(want - now), Math.cos(want - now));
    const turn = Phaser.Math.Clamp(off, -rate * (dt / 1000), rate * (dt / 1000));
    this.ux = Math.cos(now + turn);
    this.uy = Math.sin(now + turn);
  }

  /** The nearest foe ahead, within reach of a bend. */
  private ahead(): Hurtbox | null {
    let best = SEEK_RANGE;
    let pick: Hurtbox | null = null;
    for (const h of this.world.hurtboxesWhere((h) => h.alive && !this.struck.has(h))) {
      const dx = h.x - this.x;
      const dy = h.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d >= best || d < 1) continue;
      if ((dx * this.ux + dy * this.uy) / d < SEEK_CONE) continue;
      best = d;
      pick = h;
    }
    return pick;
  }

  /** The nearest foe it hasn't struck, close to the one it just did. */
  private nextFrom(from: Hurtbox): Hurtbox | null {
    let best = BOUNCE_RANGE;
    let pick: Hurtbox | null = null;
    for (const h of this.world.hurtboxesWhere((h) => h.alive && !this.struck.has(h))) {
      const d = Math.hypot(h.x - from.x, h.y - from.y);
      if (d < best) {
        best = d;
        pick = h;
      }
    }
    return pick;
  }

  /** Strike a body; returns true if the note is spent. */
  private strike(h: Hurtbox): boolean {
    this.struck.add(h);
    const damage = Math.max(1, Math.round(this.kind.damage * Math.pow(this.kind.falloff, this.hops)));
    h.hurt({ damage, heavy: false, knock: 40, fromX: h.x - this.ux * 8, fromY: h.y - h.bodyY - this.uy * 8 });
    this.world.debris(this.look.pal.tints, snap(h.x - this.ux * (h.radius - 1)), snap(h.y - h.bodyY), 6, h.y + 20);
    sound.noteHit(this.world.pan(h.x), this.hops);
    this.hops++;
    const next = this.hops <= this.kind.bounces ? this.nextFrom(h) : null;
    if (!next) {
      this.pop(1);
      return true;
    }
    // Leap: straight for the next foe, the flight measured afresh.
    this.target = next;
    const dx = next.x - this.x;
    const dy = next.y - this.y;
    const l = Math.hypot(dx, dy) || 1;
    this.ux = dx / l;
    this.uy = dy / l;
    this.travelled = 0;
    return false;
  }

  private place(): void {
    const bob = Math.round(Math.sin(this.t * 0.012) * 1.5);
    const x = snap(this.x);
    const y = snap(this.y - NOTE_H) + bob;
    const depth = this.y + 1;
    this.img.setPosition(x, y).setDepth(depth).setFlipX(this.ux < -0.2);
    this.halo.setPosition(x, y).setDepth(depth - 0.1);
    this.shadow.setPosition(snap(this.x), snap(this.y));
    this.light?.setPosition(this.x, this.y - NOTE_H);
  }

  /** It ends in a soft flash of its colour. */
  private pop(size: number): void {
    bloom(this.world, this.x, this.y - NOTE_H, this.look.pal.hot, 0.5 + size * 0.5, 260, this.y + 20, 0.7);
    this.world.debris(this.look.pal.tints, snap(this.x), snap(this.y - NOTE_H), Math.round(3 + size * 4), this.y + 20);
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
    this.halo.destroy();
    this.shadow.destroy();
    if (this.light) this.world.lights.removeLight(this.light);
  }
}

/**
 * A wave of sound rolling out from (x, y): two bands of light along an arc
 * `spread` either side of `angle` (a whole ring when it's a full turn),
 * swelling out to `radius` and thinning away in a dithered checker.
 */
export class Shockwave extends Fx {
  private pix: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private angle: number,
    private spread: number,
    private radius: number,
    private p: Pal,
    life = 280,
  ) {
    super(world, life);
    this.pix = this.ink(Math.ceil(radius * 2 + 12), Math.ceil(radius * 1.4 + 12));
  }

  protected step(): void {
    const { x, y, p } = this;
    const k = Math.min(1, this.t / this.life);
    const r = 5 + (this.radius - 5) * easeOut(k);
    const full = this.spread >= Math.PI - 0.01;
    const g = this.pix.begin(x, y, y + 30);
    for (let band = 0; band < 2; band++) {
      const rb = r - band * 5 * (0.4 + 0.6 * k);
      if (rb < 3) continue;
      const w = (2.2 - band * 0.8) * (1 - k) + 0.5;
      const a = (1 - k * k) * (band ? 0.6 : 1);
      const steps = Math.ceil(2 * this.spread * rb * 1.3) + 4;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const th = this.angle - this.spread + 2 * this.spread * u;
        // The arc's ends taper off, so it reads as a wave, not a blade.
        const e = full ? 1 : 1 - Math.pow(Math.abs(u * 2 - 1), 3);
        const c = Math.cos(th);
        const sn = Math.sin(th) * 0.7;
        const n = Math.ceil(w);
        for (let j = -n; j <= n; j++) {
          const o = j * (w / n);
          const px = Math.round(x + c * (rb + o));
          const py = Math.round(y + sn * (rb + o));
          if (dither(px, py) >= a * e * 1.3) continue;
          g.put(px, py, shade(p, Math.abs(o) / (w || 1)), Math.min(1, a * e * 1.2));
        }
      }
    }
    g.end();
  }
}

/** The song rising off the lute: a ring of light rolling out over the ground, notes drifting up and away. */
export class SongBurst extends Fx {
  private ground: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
    tex = 'note_e',
  ) {
    // Long enough for the last note's drift to finish before it's cleared away.
    super(world, 1150);
    this.ground = this.ink(110, 70);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const note = this.own(
        world.add
          .image(Math.round(x + Math.cos(a) * 8), Math.round(y - 12 + Math.sin(a) * 4), tex, i % 2 ? 'n1' : 'n0')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(y + 40)
          .setAlpha(0),
      );
      world.tweens.add({ targets: note, alpha: { from: 1, to: 0 }, x: note.x + Math.cos(a) * 20, y: note.y - 22 + Math.sin(a) * 6, duration: 850, delay: i * 50, ease: 'Sine.easeOut' });
    }
    bloom(world, x, y - 12, p.hot, 1.6, 500, y + 30, 0.8);
    flare(world, x, y - 14, 120, p.light, 2.5, 700);
  }

  protected step(): void {
    const k = Math.min(1, this.t / 900);
    const g = this.ground.begin(this.x, this.y, 2.5);
    ring(g, this.x, this.y, 6 + 44 * easeOut(k), 2.5 * (1 - k) + 0.6, this.p, 1 - k);
    const k2 = (this.t - 150) / 750;
    if (k2 > 0 && k2 < 1) ring(g, this.x, this.y, 4 + 34 * easeOut(k2), 1.5 * (1 - k2) + 0.5, this.p, 0.7 * (1 - k2));
    g.end();
  }
}
