import Phaser from 'phaser';
import { inFlight, type Hurtbox } from './combat';
import { LICH_BOLT_H } from '../art/lich';
import { snap } from './display';
import { onGround } from './Toxins';
import { sound } from '../audio';
import type { Effect } from './Slash';
import type { WorldScene } from '../scenes/WorldScene';
import { clamp01, dither, easeOut, Fx, GROUND, hash, Ink, pal, type Pal } from './ultimate/ink';

// The Lich's magic (see Lich.ts): rime bolts, shards of bone-ice that chill
// what they strike; the frost that locks a foe solid; and the bone spikes,
// a line of jagged ice and bone bursting out of the ground one after
// another. The Drowned King's are brine and coral. Everything is drawn in
// solid pixels (ultimate/ink.ts), lit by a few real lights.

/** The bolt's flight: speed in world px a second, and how far it goes. */
const BOLT_SPEED = 175;
const BOLT_RANGE = 150;
/** How often a frost mote falls off the bolt's tail. */
const BOLT_TRAIL_MS = 30;

/** The spikes: how many, how far apart, the first one's distance ahead, the gap between eruptions. */
const SPIKES = 6;
const SPIKE_GAP = 11;
const SPIKE_FIRST = 14;
const SPIKE_EVERY = 55;
/** How long a spike takes to burst up, how long it stands, and how long it takes to shatter. */
const SPIKE_RISE = 80;
const SPIKE_STAND = 650;
const SPIKE_BREAK = 160;
/** Its reach on the ground, its blow and the root it leaves (pace, ms). */
const SPIKE_R = 9;
const SPIKE_DAMAGE = 9;
const ROOT_PACE = 0.08;
const ROOT_MS = 900;
/** The spikes' tallest, world px. */
const SPIKE_H = 15;

/** How the lich's frost looks: its light, brightest first, and the spikes' ice (coral) and bone. */
export interface RimeLook {
  ice: Pal;
  /** The spikes from their lit face to their dark one, and the bone (coral branch) banded through them. */
  spike: [number, number, number, number];
  bone: [number, number];
  /** The cracked ground they burst from. */
  crack: number;
  /** Coral: the spikes branch, and the bolt is brine and coral. */
  coral: boolean;
}

/** The lich's: ice-blue frost, pale bone. */
export const LICH_RIME: RimeLook = {
  ice: pal(0xf4fdff, 0xa8e8ff, 0x4ab4f0, 0x1c4aa8, 0x7ad0ff),
  spike: [0xe4f8ff, 0x9cd8f4, 0x4e92cc, 0x1e4a80],
  bone: [0xeee8d4, 0xa8a290],
  crack: 0x0c1428,
  coral: false,
};

/** The Drowned King's: sea foam and brine, coral for bone. */
export const DROWNED_RIME: RimeLook = {
  ice: pal(0xf0fffa, 0x9cffe4, 0x2ad8b4, 0x0c6a72, 0x40f0c8),
  spike: [0xffd8c4, 0xf28a70, 0xd0504a, 0x7a1a2a],
  bone: [0xc8fff0, 0x4ad8b8],
  crack: 0x06140f,
  coral: true,
};

/**
 * A shard of bone-ice flung from the palm: it flies at hand height over its
 * shadow, frost streaming off it, and shatters on the first body it meets
 * (or at the end of its flight). `onHit` runs for the body it strikes.
 */
export class RimeBolt implements Effect {
  dead = false;
  private ink: Ink;
  private halo: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private travelled = 0;
  private trailT = 0;
  private t = 0;
  private readonly inPath = (h: Hurtbox) => inFlight(h, this.x, this.y, LICH_BOLT_H);

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private look: RimeLook,
    private onHit: (h: Hurtbox, ux: number, uy: number) => void,
  ) {
    const p = look.ice;
    this.ink = new Ink(world, 20, 20);
    this.halo = world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(p.mid).setAlpha(0.55).setScale(0.6);
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(0.45, 0.3).setAlpha(0.3);
    this.light = world.lights.addLight(x, y - LICH_BOLT_H, 60, p.light, 1.6);
    this.draw();
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    let move = (BOLT_SPEED * dt) / 1000;
    const area = this.world.area;
    // A few pixels at a time, so it never skips over a small body.
    while (move > 0) {
      const d = Math.min(3, move);
      move -= d;
      this.x += this.ux * d;
      this.y += this.uy * d;
      this.travelled += d;
      if (!area.contains(this.x, this.y)) return this.burst(false);
      const hit = this.world.firstHurtbox(this.inPath);
      if (hit) {
        this.onHit(hit, this.ux, this.uy);
        return this.burst(true, hit);
      }
      if (this.travelled >= BOLT_RANGE) return this.burst(false);
    }
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = BOLT_TRAIL_MS;
      const p = this.look.ice;
      this.world.debris([p.hot, p.mid, this.look.coral ? this.look.spike[1] : p.core], snap(this.x - this.ux * 6), snap(this.y - LICH_BOLT_H - this.uy * 4), 1, this.y - 0.2, 'trail');
    }
    this.draw();
  }

  /** The shard along its flight: a long diamond, lit along its top edge, a spine of bone (coral) down its tail. */
  private draw(): void {
    const p = this.look.ice;
    const cx = this.x;
    const cy = this.y - LICH_BOLT_H;
    const g = this.ink.begin(cx, cy, this.y + 1);
    // Screen-space direction: the flight, squashed a touch as it goes up or down the screen.
    const l = Math.hypot(this.ux, this.uy * 0.8) || 1;
    const ax = this.ux / l;
    const ay = (this.uy * 0.8) / l;
    // Across the shard: which side faces up (the lit side).
    const nx = -ay;
    const ny = ax;
    const up = ny <= 0 ? 1 : -1;
    const twinkle = Math.floor(this.t / 60) % 3;
    for (let a = -6; a <= 4; a += 0.5) {
      // Fattest a little behind the tip, thinning to a splinter at the tail.
      const w = a >= 1 ? (4 - a) * 0.45 : 1.35 * (1 - Math.max(0, -a - 1) / 6);
      for (let o = -w; o <= w + 0.01; o += 0.5) {
        const side = o * up;
        const tail = a < -1;
        let col = side > 0.4 ? p.hot : side < -0.4 ? p.deep : a > 1.5 ? p.core : p.mid;
        // Its spine: bone (coral) down the tail.
        const spine = this.look.coral ? [this.look.spike[1], this.look.spike[2]] : this.look.bone;
        if (tail && Math.abs(o) < 0.45) col = (Math.floor(-a) & 1) === 0 ? spine[0] : spine[1];
        g.put(cx + ax * a + nx * o, cy + ay * a + ny * o, col);
      }
    }
    // The tip's glint, and frost flickering round it.
    g.put(cx + ax * 4, cy + ay * 4, p.core);
    if (twinkle === 0) g.put(cx + ax * 2 - nx * 2, cy + ay * 2 - ny * 2, p.hot, 0.8);
    if (twinkle === 1) g.put(cx - ax * 3 + nx * 2, cy - ay * 3 + ny * 2, p.mid, 0.8);
    g.end();
    this.halo.setPosition(snap(cx), snap(cy)).setDepth(this.y + 0.9);
    this.shadow.setPosition(snap(this.x), snap(this.y));
    this.light.setPosition(cx, cy);
  }

  /** It shatters where it ends: shards of ice and bone flying off a body, or a puff of frost at the end of its flight. */
  private burst(struck: boolean, h?: Hurtbox): void {
    const p = this.look.ice;
    const bx = h ? h.x - this.ux * (h.radius - 1) : this.x;
    const by = h ? h.y - h.bodyY : this.y - LICH_BOLT_H;
    this.world.debris([p.core, p.hot, p.mid, this.look.bone[0]], snap(bx), snap(by), struck ? 9 : 4, (h?.y ?? this.y) + 20);
    if (struck) {
      this.world.addEffect(new FrostPop(this.world, bx, by, (h?.y ?? this.y) + 21, this.look, 1));
      if (this.look.coral) sound.splash(this.world.pan(bx));
      sound.frost('crack', this.world.pan(bx));
    } else this.world.addEffect(new FrostPop(this.world, bx, by, this.y + 21, this.look, 0.6));
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.ink.destroy();
    this.halo.destroy();
    this.shadow.destroy();
    this.world.lights.removeLight(this.light);
  }
}

/** A star of frost flashing where a bolt shatters: four spines of ice and a ring of motes, gone in a moment. */
class FrostPop extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private depth: number,
    private look: RimeLook,
    private size: number,
  ) {
    super(world, 220);
    this.g = this.ink(24, 24);
  }

  protected step(): void {
    const k = this.t / this.life;
    const p = this.look.ice;
    const g = this.g.begin(this.x, this.y, this.depth);
    const r = (3 + 6 * easeOut(k)) * this.size;
    const a = 1 - k;
    for (let i = 0; i < 8; i++) {
      const th = (i / 8) * Math.PI * 2 + 0.2;
      const long = i % 2 === 0;
      const len = long ? r : r * 0.55;
      for (let s = 1; s <= len; s++) {
        const x = this.x + Math.cos(th) * s;
        const y = this.y + Math.sin(th) * s * 0.85;
        if (dither(Math.round(x), Math.round(y)) > a * (1.2 - s / (len + 1))) continue;
        g.put(x, y, s < len * 0.4 ? p.core : s < len * 0.75 ? p.hot : p.mid);
      }
    }
    if (k < 0.4) g.put(this.x, this.y, p.core);
    g.end();
  }
}

/**
 * A foe locked in frost for `ms`: a shell of ice crystals standing round
 * and over its body, a pale sheen of frost across it, glinting; then it
 * shatters in a spray of shards (`onShatter` runs then, with the body if it
 * still stands). It follows the body as it is shoved about.
 */
export class FrostLock extends Fx {
  private g: Ink;
  private shards: { dx: number; h: number; w: number; lean: number }[] = [];
  private broken = false;

  constructor(
    world: WorldScene,
    private h: Hurtbox,
    ms: number,
    private look: RimeLook,
    private onShatter?: (h: Hurtbox) => void,
  ) {
    super(world, ms);
    const R = Math.max(5, h.radius + 2);
    const tall = Math.max(8, h.bodyY * 2 + 2);
    this.g = this.ink(Math.ceil(R * 2 + 12), Math.ceil(tall + 12));
    // Crystals: a ring of them round the body, taller at the back, one big one across the front.
    const n = 5 + Math.round(R / 4);
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      this.shards.push({ dx: u * R, h: tall * (0.55 + 0.4 * hash(i, 7)) * (1 - Math.abs(u) * 0.35), w: 1.5 + hash(i, 3) * 1.5, lean: u * 0.25 + (hash(i, 9) - 0.5) * 0.2 });
    }
    sound.frost('freeze', world.pan(h.x));
  }

  protected step(): void {
    const h = this.h;
    if (!h.alive && !this.broken) return this.shatter();
    const p = this.look.ice;
    const [lit, face, side, dark] = this.look.spike;
    const ice = this.look.coral ? [p.core, p.hot, p.mid, p.deep] : [lit, face, side, dark];
    const grow = easeOut(this.t / 120);
    const x = h.x;
    const y = h.y;
    const R = Math.max(5, h.radius + 2);
    const tall = Math.max(8, h.bodyY * 2 + 2);
    const g = this.g.begin(x, y - tall / 2, y + 0.5);
    // The sheen: a dithered veil of frost over the body, so the foe shows through it.
    for (let yy = Math.round(y - tall * grow); yy <= y; yy++) {
      for (let xx = Math.round(x - R); xx <= Math.round(x + R); xx++) {
        const u = (xx - x) / R;
        if (Math.abs(u) > 1 - Math.max(0, (y - yy) / tall - 0.75) * 2) continue;
        if (dither(xx, yy) > 0.32) continue;
        g.put(xx, yy, ice[1], 0.55);
      }
    }
    // The crystals: tall diamonds standing on the ground round it.
    for (const s of this.shards) {
      const H = s.h * grow;
      for (let k = 0; k < H; k++) {
        const u = k / Math.max(1, H);
        const w = s.w * (u < 0.7 ? 0.6 + u * 0.6 : (1 - u) * 3.4);
        const cx = x + s.dx + s.lean * k;
        for (let o = -w; o <= w + 0.01; o += 0.5) {
          const col = o < -w * 0.3 ? ice[0] : o > w * 0.4 ? ice[3] : u > 0.75 ? ice[0] : ice[2];
          g.put(cx + o, y - k, col, 0.92);
        }
      }
    }
    // Glints running up the crystals.
    const run = (this.t / 280) % 1;
    for (const [i, s] of this.shards.entries()) if ((i + Math.floor(this.t / 140)) % 3 === 0) g.put(x + s.dx + s.lean * s.h * run, y - s.h * grow * run, p.core);
    g.end();
    if (this.t >= this.life - 20 && !this.broken) this.shatter();
  }

  private shatter(): void {
    this.broken = true;
    const h = this.h;
    const p = this.look.ice;
    this.world.debris([p.core, p.hot, p.mid, this.look.spike[1]], snap(h.x), snap(h.y - h.bodyY), 14, h.y + 20);
    sound.shatter(this.world.pan(h.x));
    this.onShatter?.(h);
    this.destroy();
  }
}

/** One spike of the line: where it stands, when it bursts up, how it is shaped. */
interface Spike {
  x: number;
  y: number;
  at: number;
  ink: Ink;
  tall: number;
  /** Small shards leaning out beside the main one: offset, height, lean. */
  side: [number, number, number][];
  up: boolean;
  broke: boolean;
}

/**
 * Bone spikes: from (x, y) along (ux, uy), jagged spikes of ice and bone (or
 * coral) burst out of the ground one after another, each striking and
 * rooting whatever stands on it; they stand a moment, then shatter. The line
 * stops at the first ground that can't be stood on.
 */
export class BoneSpikes extends Fx {
  private spikes: Spike[] = [];
  private struck = new Set<Hurtbox>();
  private lamp: Phaser.GameObjects.Light;

  constructor(
    world: WorldScene,
    x: number,
    y: number,
    ux: number,
    uy: number,
    private look: RimeLook,
    private onStrike: (h: Hurtbox) => void,
  ) {
    super(world, SPIKE_FIRST + SPIKES * SPIKE_EVERY + SPIKE_RISE + SPIKE_STAND + SPIKE_BREAK + 50);
    for (let i = 0; i < SPIKES; i++) {
      const d = SPIKE_FIRST + i * SPIKE_GAP;
      const sx = x + ux * d + (hash(i, 5) - 0.5) * 3;
      const sy = y + uy * d * 0.9 + (hash(i, 6) - 0.5) * 2;
      if (!world.area.contains(sx, sy) || !world.walkable(sx, sy)) break;
      // They grow as the line runs out, the last a touch smaller.
      const tall = SPIKE_H * (0.65 + 0.35 * Math.min(1, i / 3)) * (i === SPIKES - 1 ? 0.85 : 1);
      this.spikes.push({
        x: sx,
        y: sy,
        at: i * SPIKE_EVERY,
        ink: this.ink(24, 24),
        tall,
        side: [
          [-3 - hash(i, 1) * 1.5, tall * (0.4 + hash(i, 2) * 0.2), -0.35],
          [3 + hash(i, 3) * 1.5, tall * (0.35 + hash(i, 4) * 0.25), 0.35],
        ],
        up: false,
        broke: false,
      });
    }
    this.lamp = this.light(x, y, 70, look.ice.light, 0);
  }

  protected step(): void {
    const t = this.t;
    let lit = 0;
    let lx = 0;
    let ly = 0;
    for (const s of this.spikes) {
      const age = t - s.at;
      if (age < 0) continue;
      if (!s.up) this.erupt(s);
      const breaking = clamp01((age - SPIKE_RISE - SPIKE_STAND) / SPIKE_BREAK);
      if (breaking >= 1) {
        if (!s.broke) this.shatter(s);
        continue;
      }
      // Up fast with a little overshoot, then still.
      const r = clamp01(age / SPIKE_RISE);
      const grow = r < 1 ? easeOut(r) * 1.12 : 1 + 0.12 * Math.max(0, 1 - (age - SPIKE_RISE) / 60);
      this.draw(s, Math.min(1.12, grow), breaking, age);
      if (breaking < 0.5) {
        lit++;
        lx = s.x;
        ly = s.y;
      }
    }
    // The light follows the newest spike standing.
    if (lit) this.lamp.setPosition(lx, ly - 8);
    this.lamp.intensity = lit ? 1.4 : Math.max(0, this.lamp.intensity - 0.1);
  }

  private erupt(s: Spike): void {
    s.up = true;
    const w = this.world;
    const p = this.look.ice;
    for (const h of w.hurtboxesWhere((b) => b.alive && !this.struck.has(b) && onGround(b, s.x, s.y, SPIKE_R))) {
      this.struck.add(h);
      h.hurt({ damage: SPIKE_DAMAGE, heavy: false, knock: 20, fromX: s.x, fromY: s.y + 4 });
      h.slow?.(ROOT_PACE, ROOT_MS, p.hot);
      w.debris([p.core, p.hot, this.look.bone[0]], snap(h.x), snap(h.y - h.bodyY), 6, h.y + 20);
      this.onStrike(h);
    }
    w.debris([this.look.crack, this.look.spike[2], this.look.bone[1]], snap(s.x), snap(s.y) - 1, 5, s.y + 1);
    w.debris([p.core, p.hot], snap(s.x), snap(s.y) - 8, 3, s.y + 2, 'spores');
    sound.frost('crack', w.pan(s.x), s === this.spikes[0]);
    if (s === this.spikes[0]) {
      sound.boneHit(w.pan(s.x));
      w.cameras.main.shake(80, 0.0004);
    }
  }

  private shatter(s: Spike): void {
    s.broke = true;
    s.ink.begin(s.x, s.y, s.y).end();
    const p = this.look.ice;
    this.world.debris([p.core, p.hot, this.look.spike[1], this.look.bone[0]], snap(s.x), snap(s.y) - 6, 7, s.y + 2);
    if (s === this.spikes[Math.floor(this.spikes.length / 2)]) sound.shatter(this.world.pan(s.x));
  }

  /** One spike: cracked frosted ground at its foot, the main shard banded with bone, two small ones leaning out. */
  private draw(s: Spike, grow: number, breaking: number, age: number): void {
    const [lit, face, side, dark] = this.look.spike;
    const [bone, boneDark] = this.look.bone;
    const p = this.look.ice;
    const g = s.ink.begin(s.x, s.y - 8, s.y, 0.5, 0.5);
    // The ground: a patch of frost (foam) and dark cracks running out.
    for (let i = 0; i < 6; i++) {
      const th = (i / 6) * Math.PI * 2 + hash(i, Math.round(s.x)) * 0.8;
      const len = 3 + hash(i, Math.round(s.y)) * 4;
      for (let k = 1; k <= len; k++) g.put(s.x + Math.cos(th) * k, s.y + Math.sin(th) * k * GROUND, k < 2 ? p.deep : this.look.crack, 0.9 * (1 - breaking));
    }
    for (let dx = -5; dx <= 5; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const d = Math.hypot(dx / 5, dy / 2.5);
        if (d > 1 || dither(Math.round(s.x + dx), Math.round(s.y + dy)) > 0.5 * (1 - d) * (1 - breaking)) continue;
        g.put(s.x + dx, s.y + dy, p.hot, 0.8);
      }
    }
    // Breaking: the shards drop and split apart.
    const drop = breaking * 6;
    const spread = breaking * 3;
    const shard = (bx: number, H: number, lean: number, main: boolean) => {
      if (H < 1) return;
      for (let k = 0; k < H; k++) {
        const u = k / H;
        // Jagged: the width steps in, with a notch now and then.
        const notch = main && Math.abs(u - 0.55) < 0.06 ? 0.5 : 0;
        const w = Math.max(0, (1 - u) * (main ? 2.4 : 1.4) - notch);
        const cx = s.x + bx + lean * k + Math.sign(bx || 1) * spread * u;
        const cy = s.y - k + drop;
        const banded = main && Math.abs(u - 0.3) < 0.08;
        for (let o = -w; o <= w + 0.01; o += 0.5) {
          let col = o < -w * 0.35 ? lit : o > w * 0.35 ? dark : u > 0.8 ? lit : k % 4 === 1 ? side : face;
          if (banded) col = o <= 0 ? bone : boneDark;
          g.put(cx + o, cy, col, 1 - breaking * 0.6);
        }
        // Coral branches off its sides.
        if (this.look.coral && main && (k === Math.round(H * 0.5) || k === Math.round(H * 0.72))) {
          const sd = k === Math.round(H * 0.5) ? -1 : 1;
          for (let j = 1; j <= 3; j++) g.put(cx + sd * (w + j * 0.8), cy - j * 0.7, j === 3 ? lit : face, 1 - breaking * 0.6);
        }
      }
      // Its point glints.
      if (breaking === 0) g.put(s.x + bx + lean * (H - 1), s.y - H + 1, p.core);
    };
    for (const [ox, h, lean] of s.side) shard(ox, h * grow, lean, false);
    shard(0, s.tall * grow, (hash(Math.round(s.x), 2) - 0.5) * 0.25, true);
    // A shimmer running up the main spike while it stands.
    if (breaking === 0 && age > SPIKE_RISE) {
      const k = Math.floor((age / 40) % s.tall);
      g.put(s.x, s.y - k, p.core, 0.8);
    }
    g.end();
  }
}
