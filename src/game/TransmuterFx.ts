import Phaser from 'phaser';
import type { Hurtbox } from './combat';
import { onGround } from './Toxins';
import { bindFoe } from './Strings';
import { sound } from '../audio';
import type { WorldScene } from '../scenes/WorldScene';
import { bloom, circle, clamp01, dither, flare, Fx, GROUND, hash, line, segDist, star, type Ink, type Pal } from './ultimate/ink';

// The Transmuter's working effects: the quicksilver bead she flicks, the
// beads it splits into, and the chalk circle that turns foes to lead.
// (Her Special, the Magnum Opus, is in ultimate/transmuter.ts.)

const GROUND_DEPTH = 3;

/** The bead: how fast it flies, how far, and how high off the ground it rides. */
export const BEAD_SPEED = 230;
export const BEAD_RANGE = 120;
export const BEAD_DAMAGE = 10;
/** On a hit it splits in two, each seeking another foe within this reach. */
const SPLITS = 2;
const SPLIT_REACH = 72;
const SPLIT_DAMAGE = 5;
const SPLIT_SPEED = 190;
/** How hard a split bead turns toward its foe, in radians a second; it gives up after this long. */
const SPLIT_TURN = 9;
const SPLIT_LIFE = 900;
/** With no foe to seek, a split bead skips off this far and splashes on the ground. */
const SPLIT_STRAY = 22;

/** Something that can be turned to metal (the monsters; see Monster.frail). */
type Metal = Hurtbox & { frail(k: number, ms: number, tint: number): void };
const metal = (h: Hurtbox): h is Metal => typeof (h as Partial<Metal>).frail === 'function';

/** Turn a foe to metal for `ms`: every blow lands `k` times as hard and it is drawn in `tint`. */
export function turnToMetal(h: Hurtbox, k: number, ms: number, tint: number): void {
  if (metal(h)) h.frail(k, ms, tint);
}

/**
 * A bead of quicksilver flicked from the gauntlet: a wobbling chrome drop with
 * a thin trail, its shadow sliding along the ground under it. On the first foe
 * it meets it bursts, and splits into two smaller beads that each curve off
 * after the next nearest foe. A split bead (`target` set) just seeks its one.
 */
export class QuicksilverBead extends Fx {
  private g: Ink;
  private shadow: Phaser.GameObjects.Image;
  private trail: { x: number; y: number }[] = [];
  private left: number;
  private ux: number;
  private uy: number;
  private readonly seed = Math.floor(Math.random() * 1000);

  constructor(
    world: WorldScene,
    /** The ground point under the bead. */
    private gx: number,
    private gy: number,
    ux: number,
    uy: number,
    /** How high over the ground it flies. */
    private fly: number,
    private p: Pal,
    private damage = BEAD_DAMAGE,
    private target: Hurtbox | null = null,
    /** The foe the parent bead struck, which a split bead never seeks. */
    private skip: Hurtbox | null = null,
    range = BEAD_RANGE,
  ) {
    super(world, 99999);
    const l = Math.hypot(ux, uy) || 1;
    this.ux = ux / l;
    this.uy = uy / l;
    this.left = range;
    this.g = this.ink(40, 40);
    this.shadow = this.own(world.add.image(gx, gy, 'shadow').setDepth(1).setScale(0.3, 0.22).setAlpha(0.3));
  }

  private get split(): boolean {
    return this.skip !== null;
  }

  protected step(dt: number): void {
    const w = this.world;
    const ox = this.gx;
    const oy = this.gy;
    const speed = this.split ? SPLIT_SPEED : BEAD_SPEED;
    // A split bead steers after its foe, so it curves in rather than flying straight.
    if (this.target) {
      if (!this.target.alive || this.t > SPLIT_LIFE) this.target = null;
      else {
        const want = Math.atan2(this.target.y - this.gy, this.target.x - this.gx);
        const now = Math.atan2(this.uy, this.ux);
        const turn = Phaser.Math.Angle.Wrap(want - now);
        const a = now + Phaser.Math.Clamp(turn, -SPLIT_TURN * (dt / 1000), SPLIT_TURN * (dt / 1000));
        this.ux = Math.cos(a);
        this.uy = Math.sin(a);
        // It sinks toward the foe's middle as it closes.
        this.fly += (this.target.bodyY - this.fly) * Math.min(1, dt / 200);
      }
    }
    const move = Math.min(this.left, (speed * dt) / 1000);
    this.gx += this.ux * move;
    this.gy += this.uy * move;
    if (!this.split || !this.target) this.left -= move;
    const hit = w.firstHurtbox((h) => h.alive && h !== this.skip && (this.target ? h === this.target : true) && segDist(h.x, h.y, ox, oy, this.gx, this.gy) < h.radius + 3);
    if (hit) {
      this.strike(hit);
      return;
    }
    if (this.left <= 0 || !w.area.contains(this.gx, this.gy)) {
      // Spent: it drops and splashes harmlessly.
      w.addEffect(new Splat(w, this.gx, this.gy, 0, this.p, false));
      this.destroy();
      return;
    }
    this.draw();
  }

  private strike(h: Hurtbox): void {
    const w = this.world;
    const hy = h.y - Math.min(this.fly, h.bodyY + 2);
    h.hurt({ damage: this.damage, heavy: false, knock: this.split ? 20 : 40, fromX: this.gx - this.ux * 8, fromY: this.gy - this.uy * 8 });
    w.addEffect(new Splat(w, h.x, h.y, h.y - hy, this.p, !this.split));
    if (this.split) sound.quickSplash(w.pan(h.x), true);
    else {
      sound.quickSplash(w.pan(h.x), false);
      this.splitOff(h, hy);
    }
    this.destroy();
  }

  /** Two smaller beads leap off the struck foe after the nearest others (or skip off and splash if there are none). */
  private splitOff(h: Hurtbox, hy: number): void {
    const w = this.world;
    const foes = w
      .hurtboxesWhere((o) => o.alive && o !== h && Math.hypot(o.x - h.x, o.y - h.y) <= SPLIT_REACH)
      .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    for (let i = 0; i < SPLITS; i++) {
      const foe = foes[i] ?? null;
      // They leap out to either side first, so the two read as a fork, then curve in.
      const side = i === 0 ? 1 : -1;
      const ax = foe ? foe.x - h.x : this.ux;
      const ay = foe ? foe.y - h.y : this.uy;
      const l = Math.hypot(ax, ay) || 1;
      const nx = -ay / l;
      const ny = ax / l;
      const dx = ax / l + nx * side * 1.1;
      const dy = ay / l + ny * side * 1.1;
      w.addEffect(new QuicksilverBead(w, h.x, h.y, dx, dy, h.y - hy, this.p, SPLIT_DAMAGE, foe, h, foe ? SPLIT_REACH * 2 : SPLIT_STRAY));
    }
  }

  private draw(): void {
    const x = this.gx;
    const y = this.gy - this.fly;
    const p = this.p;
    const g = this.g.begin(x, y, this.gy + 1);
    // The trail: the last few spots it passed, thinning to the dark of the metal.
    for (let i = 0; i < this.trail.length; i++) {
      const q = this.trail[i];
      const k = i / this.trail.length;
      g.put(q.x, q.y, k > 0.6 ? p.mid : p.deep, 0.3 + k * 0.5);
    }
    // The drop: it trembles, stretching the way it flies and squashing back,
    // lit from above: a white glint, bright crown, dark belly.
    const r = this.split ? 1.3 : 2.1;
    const wob = Math.sin(this.t * 0.045 + this.seed) * 0.28;
    const sx = r * (1 + wob);
    const sy = r * (1 - wob);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        // Stretch along the line of flight.
        const along = dx * this.ux + dy * this.uy;
        const across = -dx * this.uy + dy * this.ux;
        const d = Math.hypot(along / sx, across / sy);
        if (d > 1.05) continue;
        const c = dy < -r * 0.4 ? p.hot : dy > r * 0.35 ? p.deep : d > 0.75 ? p.mid : p.hot;
        g.put(x + dx, y + dy, c);
      }
    }
    g.put(x - (this.split ? 0 : 1), y - (this.split ? 1 : 1), p.core);
    if (!this.split && Math.floor(this.t / 70) % 3 === 0) g.put(x + 1, y - 2, p.core, 0.8);
    g.end();
    this.trail.push({ x, y });
    if (this.trail.length > (this.split ? 3 : 5)) this.trail.shift();
    this.shadow.setPosition(Math.round(this.gx), Math.round(this.gy));
  }
}

const SPLAT_MS = 520;
const DROPS = 9;

/**
 * Quicksilver bursting: droplets thrown out and falling, each landing as a
 * tiny bead that shrinks away. A big one (the first bead's burst) also rings.
 */
class Splat extends Fx {
  private g: Ink;
  private drops: { vx: number; vy: number; vz: number }[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    /** How high off the ground it burst. */
    private z: number,
    private p: Pal,
    private big: boolean,
  ) {
    super(world, SPLAT_MS);
    this.g = this.ink(48, 48);
    const n = big ? DROPS : 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const s = (big ? 40 : 26) * (0.6 + Math.random() * 0.6);
      this.drops.push({ vx: Math.cos(a) * s, vy: Math.sin(a) * s * GROUND, vz: 30 + Math.random() * 40 });
    }
    if (big) flare(world, x, y - z, 40, p.light, 0.9, 200);
  }

  protected step(): void {
    const s = this.t / 1000;
    const g = this.g.begin(this.x, this.y - 8, this.y + 2);
    const fade = 1 - clamp01((this.t - SPLAT_MS * 0.55) / (SPLAT_MS * 0.45));
    // The burst itself: a flash of chrome for a moment.
    if (this.t < 90) {
      const r = this.big ? 3 : 2;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) g.put(this.x + dx, this.y - this.z + dy, dx * dx + dy * dy < 2 ? this.p.core : this.p.hot, 1 - this.t / 90);
    }
    for (const d of this.drops) {
      const h = Math.max(0, this.z + d.vz * s - 160 * s * s);
      const fx = this.x + d.vx * Math.min(s, 0.25);
      const fy = this.y + d.vy * Math.min(s, 0.25);
      if (h > 0) {
        g.put(fx, fy - h, this.p.hot, fade);
        g.put(fx, fy - h + 1, this.p.deep, fade * 0.7);
      } else if (dither(Math.round(fx), Math.round(fy)) < fade) {
        // Landed: a bead on the ground.
        g.put(fx, fy, this.p.mid, fade);
        g.put(fx, fy - 1, this.p.core, fade * 0.8);
      }
    }
    g.end();
  }
}

/** The chalk circle: how wide, how long it takes to draw, how long the lead holds. */
export const CIRCLE_R = 30;
export const CIRCLE_DRAW = 450;
export const LEAD_MS = 2500;
const CIRCLE_DAMAGE = 4;
/** Lead takes blows this much harder. */
const LEAD_FRAILTY = 1.3;
const CIRCLE_FADE = 500;

/** Small alchemical marks, five by five: mercury, lead (Saturn), sulphur, salt. */
const GLYPHS = [
  ['#...#', '.###.', '#...#', '.###.', '..#..'],
  ['.#...', '###..', '.#.#.', '.##.#', '.#..#'],
  ['..#..', '.#.#.', '#####', '..#..', '.###.'],
  ['.###.', '#...#', '#####', '#...#', '.###.'],
];

/**
 * A transmutation circle chalked on the ground at a spot: the ring, a square
 * in it, a triangle in that, a small ring at the heart and four marks, drawn
 * stroke by stroke as if by an unseen hand. Finished, it flares, and every
 * foe standing in it is turned to lead: held fast, drawn grey, and every blow
 * on it lands harder. Bosses are too strong to hold, but still turn to lead.
 */
export class TransmutationCircle extends Fx {
  private g: Ink;
  private fired = false;
  private lamp: Phaser.GameObjects.Light;
  private leaden: Hurtbox[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
    private lead: number,
  ) {
    super(world, CIRCLE_DRAW + LEAD_MS);
    this.g = this.ink(CIRCLE_R * 2 + 12, Math.ceil(CIRCLE_R * GROUND * 2) + 16);
    this.lamp = this.light(x, y, 50, p.light, 0.3);
    sound.chalk(world.pan(x));
  }

  protected step(): void {
    if (!this.fired && this.t >= CIRCLE_DRAW) this.fire();
    const k = clamp01(this.t / CIRCLE_DRAW);
    const fade = 1 - clamp01((this.t - (this.life - CIRCLE_FADE)) / CIRCLE_FADE);
    const g = this.g.begin(this.x, this.y, GROUND_DEPTH);
    this.drawCircle(g, k, fade);
    g.end();
    if (this.fired) {
      const since = this.t - CIRCLE_DRAW;
      this.lamp.intensity = (0.5 + 2 * Math.max(0, 1 - since / 300)) * fade;
    } else this.lamp.intensity = 0.3 + k * 0.6;
  }

  /** The circle, drawn `k` of the way through; once lit, a pulse runs round it. */
  private drawCircle(g: Ink, k: number, fade: number): void {
    const { x, y, p } = this;
    const R = CIRCLE_R;
    const lit = this.fired ? Math.max(0, 1 - (this.t - CIRCLE_DRAW) / 400) : 0;
    const chalk = (c: number) => (lit > 0.5 ? p.core : c);
    const at = (a: number, r: number): [number, number] => [x + Math.cos(a) * r, y + Math.sin(a) * r * GROUND];
    const seg = (a0: [number, number], a1: [number, number], f: number, c: number, a: number) => {
      if (f <= 0) return;
      line(g, a0[0], a0[1], a0[0] + (a1[0] - a0[0]) * f, a0[1] + (a1[1] - a0[1]) * f, c, a);
    };
    const part = (from: number, to: number) => clamp01((k - from) / (to - from));
    const a = fade;
    // A faint dust of chalk inside, darker where the ring will glow.
    if (this.fired) for (let i = 0; i < 26; i++) {
      const [px, py] = at(hash(i, 3) * Math.PI * 2, R * Math.sqrt(hash(i, 5)));
      if (dither(Math.round(px), Math.round(py)) < 0.5 * a) g.put(px, py, p.deep, 0.5 * a);
    }
    // The outer ring, two lines, drawn round from the top.
    const ringK = part(0, 0.4);
    const top = -Math.PI / 2;
    circle(g, x, y, R, chalk(p.hot), a, GROUND, top, top + ringK * Math.PI * 2);
    circle(g, x, y, R - 2, chalk(p.mid), a * 0.85, GROUND, top, top + ringK * Math.PI * 2);
    // The square, then the triangle, each corner to corner.
    const sq = [0, 1, 2, 3].map((i) => at(top + Math.PI / 4 + (i * Math.PI) / 2, R - 2));
    const sqK = part(0.3, 0.62) * 4;
    for (let i = 0; i < 4; i++) seg(sq[i], sq[(i + 1) % 4], clamp01(sqK - i), chalk(p.mid), a * 0.9);
    const tri = [0, 1, 2].map((i) => at(top + (i * Math.PI * 2) / 3, R * 0.68));
    const triK = part(0.5, 0.8) * 3;
    for (let i = 0; i < 3; i++) seg(tri[i], tri[(i + 1) % 3], clamp01(triK - i), chalk(p.hot), a);
    // The heart: a small ring.
    const inK = part(0.7, 0.9);
    circle(g, x, y, R * 0.35, chalk(p.hot), a, GROUND, top, top + inK * Math.PI * 2);
    // The four marks, between the square's corners and the ring.
    const glK = part(0.82, 1) * 4;
    for (let i = 0; i < 4; i++) {
      if (glK - i <= 0) continue;
      const [cx, cy] = at(top + (i * Math.PI) / 2, R * 0.84);
      const rows = GLYPHS[i];
      const ga = a * clamp01(glK - i);
      rows.forEach((row, ry) => [...row].forEach((on, rx) => on === '#' && g.put(cx - 2 + rx, cy - 2 + ry, chalk(p.core), ga)));
    }
    // Where the unseen hand is drawing, a bright point and a little dust.
    if (k < 1) {
      const pen: [number, number] =
        ringK < 1 ? at(top + ringK * Math.PI * 2, R) : sqK < 4 ? lerp(sq[Math.floor(sqK)], sq[(Math.floor(sqK) + 1) % 4], sqK % 1) : triK < 3 ? lerp(tri[Math.floor(triK)], tri[(Math.floor(triK) + 1) % 3], triK % 1) : at(top + inK * Math.PI * 2, R * 0.35);
      star(g, pen[0], pen[1], 2, p);
    }
    // Lit: a pulse of light races round the ring, and fades as the lead sets.
    if (this.fired) {
      const run = (this.t - CIRCLE_DRAW) * 0.006;
      for (let j = 0; j < 3; j++) {
        const th = top + run + (j * Math.PI * 2) / 3;
        for (let s = 0; s < 6; s++) {
          const [px, py] = at(th - s * 0.06, R);
          g.put(px, py, s < 2 ? p.core : p.hot, a * (1 - s / 6));
        }
      }
      if (lit > 0) {
        // The flash as it kindles: the whole floor of the circle lights up.
        for (let dy = -Math.ceil(R * GROUND); dy <= R * GROUND; dy++) {
          for (let dx = -R; dx <= R; dx++) {
            if (Math.hypot(dx, dy / GROUND) > R - 2) continue;
            if (dither(Math.round(x + dx), Math.round(y + dy)) < lit * 0.55) g.put(x + dx, y + dy, p.hot, lit * 0.7);
          }
        }
      }
    }
  }

  /** The circle kindles: everything in it is struck and turned to lead. */
  private fire(): void {
    this.fired = true;
    const w = this.world;
    const { x, y, p } = this;
    this.leaden = w.hurtboxesWhere((h) => h.alive && onGround(h, x, y, CIRCLE_R));
    for (const h of this.leaden) {
      h.hurt({ damage: CIRCLE_DAMAGE, heavy: false, knock: 0, fromX: x, fromY: y });
      bindFoe(h, LEAD_MS);
      turnToMetal(h, LEAD_FRAILTY, LEAD_MS, this.lead);
      w.debris([this.lead, 0x6a707a, 0xd8dce4], h.x, h.y - h.bodyY, 6, h.y + 4, 'burst');
    }
    bloom(w, x, y, p.hot, 2.2, 380, y + 2, 0.6);
    flare(w, x, y - 6, 90, p.light, 2.2, 400);
    sound.transmute(w.pan(x), this.leaden.length > 0);
  }

  /** The lead's own time, for the HUD: from the moment it kindles. */
  timeLeft(): { left: number; total: number } | null {
    return this.dead ? null : { left: Math.min(LEAD_MS, this.life - this.t), total: LEAD_MS };
  }
}

const lerp = (a: [number, number], b: [number, number], f: number): [number, number] => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
