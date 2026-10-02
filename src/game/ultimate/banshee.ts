import type Phaser from 'phaser';
import { sound } from '../../audio';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, circle, dither, easeOut, flare, Fx, GROUND, hash, pool, ring, type Ink } from './ink';
import type { Cast, IconPainter } from './types';

// The Banshee's Special, Lament: she rises and sings. For a few seconds great
// rings of sound peal out from her over a wide circle, each louder than the
// last, slowing and hurting every foe they wash over, ripples running out
// over the ground between them and ghost-lights rising round her, until the
// last peal: a death knell that strikes like a falling bell. The Ghost
// Bride's lament scatters blue rose petals that swirl out with every peal.

const LAMENT_MS = 4200;
const LAMENT_R = 110;
/** When each peal rings out (ms in), and what it deals; the last is the knell. */
const PEALS = [450, 1100, 1750, 2400, 3050];
const PEAL_DAMAGE = [4, 5, 6, 7, 8];
const PEAL_SLOW = 0.55;
const PEAL_SLOW_MS = 800;
const KNELL_AT = 3750;
const KNELL_DAMAGE = 24;
/** How long a peal's ring takes to roll out to the rim. */
const ROLL_MS = 650;
const LIGHTS = 14;
const PETAL_N = 26;
const PETALS = [0x6a86e0, 0x3c52b4, 0xa4bcff];

const inside = (h: Hurtbox, x: number, y: number, r: number): boolean => {
  const dx = (h.x - x) / (r + h.radius);
  const dy = (h.y - y) / ((r + h.radius) * GROUND);
  return dx * dx + dy * dy <= 1;
};

export class Lament extends Fx {
  private ground: Ink;
  private air: Ink;
  private glow: Phaser.GameObjects.Light;
  private next = 0;
  private knelled = false;
  private bride: boolean;
  /** When each peal rang (or -1), for drawing its ring rolling out. */
  private rung: number[] = [];

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, LAMENT_MS);
    this.bride = c.look === 'bride';
    this.ground = this.ink(LAMENT_R * 2 + 24, Math.ceil(LAMENT_R * GROUND * 2) + 24);
    this.air = this.ink(150, 120);
    this.glow = this.light(c.hero.x, c.hero.y - 20, 120, c.pal.light, 0);
    (c.hero as { sing?(ms: number): void }).sing?.(LAMENT_MS);
    bloom(world, c.hero.x, c.hero.y - 20, c.pal.hot, 3, 600, c.hero.y + 40);
    world.debris(c.pal.tints, c.hero.x, c.hero.y - 16, 20, c.hero.y + 20, 'gather');
    sound.wail(world.pan(c.hero.x));
  }

  protected step(): void {
    const h = this.c.hero;
    const p = this.c.pal;
    const x = h.x;
    const y = h.y;
    const on = clamp01(this.t / 400) * (1 - clamp01((this.t - (LAMENT_MS - 350)) / 350));

    // The peals, each louder than the last.
    while (this.next < PEALS.length && this.t >= PEALS[this.next]) this.peal(this.next++);
    if (!this.knelled && this.t >= KNELL_AT) this.knell();

    // The light swells with each peal and settles between.
    const since = Math.min(...this.rung.map((r) => this.t - r).filter((d) => d >= 0), 9999);
    this.glow.setPosition(x, y - 20);
    this.glow.intensity = on * (0.8 + Math.max(0, 1 - since / 400) * (1 + this.rung.length * 0.25));

    // On the ground: a dark pool under her, ripples running out, and each peal's ring rolling to the rim.
    const g = this.ground.begin(x, y, y - 30);
    pool(g, x, y, 26 + 6 * Math.sin(this.t * 0.004), p.deep, p.deep, on * 0.7, GROUND, 0.5);
    for (let i = 0; i < 4; i++) {
      const k = ((this.t / 900 + i / 4) % 1);
      circle(g, x, y, 12 + k * (LAMENT_R - 12), i % 2 ? p.mid : p.deep, on * (1 - k) * 0.7);
    }
    this.rung.forEach((at, i) => {
      const k = clamp01((this.t - at) / ROLL_MS);
      if (k >= 1) return;
      const loud = (i + 1) / PEALS.length;
      ring(g, x, y, LAMENT_R * easeOut(k), 1 + loud * 2.2, p, (1 - k * k) * on, GROUND, 0.15, i);
      circle(g, x, y, LAMENT_R * easeOut(k) - 5, p.core, (1 - k) * on * 0.6);
    });
    // The rim of her song, faint.
    circle(g, x, y, LAMENT_R, p.deep, on * 0.35);
    g.end();

    // In the air: ghost-lights rising round her on slow spirals; the Bride's petals swirling out.
    const a = this.air.begin(x, y - 30, y + 30);
    for (let i = 0; i < LIGHTS; i++) {
      const life = ((this.t * 0.0004 + hash(i, 3)) % 1);
      const q = hash(i, 7) * Math.PI * 2 + this.t * 0.0015 * (i % 2 ? 1 : -1);
      const r = 14 + hash(i, 11) * 44 + life * 10;
      const lx = x + Math.cos(q) * r;
      const ly = y + Math.sin(q) * r * GROUND - 4 - life * 46;
      const fa = on * Math.sin(life * Math.PI);
      if (fa <= 0.05) continue;
      a.put(lx, ly, p.core, fa);
      a.put(lx - 1, ly, p.hot, fa * 0.7);
      a.put(lx + 1, ly, p.hot, fa * 0.7);
      a.put(lx, ly + 1, p.mid, fa * 0.6);
      if (dither(Math.round(lx), Math.round(ly + 2)) < fa * 0.6) a.put(lx, ly + 2, p.mid, fa * 0.4);
    }
    if (this.bride) {
      const burst = Math.max(0, 1 - since / 700);
      for (let i = 0; i < PETAL_N; i++) {
        const q = hash(i, 13) * Math.PI * 2 + this.t * 0.0012 + burst * 0.5;
        const r = 10 + hash(i, 17) * 50 + burst * 12;
        const fall = ((this.t * 0.0003 + hash(i, 19)) % 1);
        const px = x + Math.cos(q) * r + Math.sin(this.t * 0.004 + i) * 2;
        const py = y + Math.sin(q) * r * GROUND - 50 + fall * 50;
        a.put(px, py, PETALS[i % 3], on);
        if (i % 2) a.put(px + 1, py, PETALS[(i + 1) % 3], on * 0.8);
      }
    }
    a.end();
  }

  /** A peal: a ring of sound rolls out over everything near, hurting and slowing it. */
  private peal(i: number): void {
    const w = this.world;
    const h = this.c.hero;
    const p = this.c.pal;
    this.rung.push(this.t);
    for (const f of w.hurtboxesWhere((b) => b.alive && inside(b, h.x, h.y, LAMENT_R))) {
      f.hurt({ damage: PEAL_DAMAGE[i], heavy: false, knock: 40 + i * 10, fromX: h.x, fromY: h.y });
      f.slow?.(PEAL_SLOW, PEAL_SLOW_MS, p.mid);
      w.debris(p.tints, f.x, f.y - f.bodyY, 3, f.y + 10, 'spores');
    }
    w.debris([0xffffff, ...p.tints], h.x, h.y - 20, 6 + i * 3, h.y + 20, 'burst');
    if (this.bride) w.debris(PETALS, h.x, h.y - 20, 6 + i * 2, h.y + 20, 'spores');
    w.cameras.main.shake(80 + i * 30, 0.0003 + i * 0.00018);
    if (i % 2 === 0) sound.wail(w.pan(h.x));
    else sound.soulCast(w.pan(h.x));
  }

  /** The death knell: the last and heaviest peal, struck like a great bell. */
  private knell(): void {
    this.knelled = true;
    const w = this.world;
    const h = this.c.hero;
    const p = this.c.pal;
    this.rung.push(this.t);
    for (const f of w.hurtboxesWhere((b) => b.alive && inside(b, h.x, h.y, LAMENT_R))) {
      f.hurt({ damage: KNELL_DAMAGE, heavy: true, knock: 170, fromX: h.x, fromY: h.y });
      w.debris(p.tints, f.x, f.y - f.bodyY, 8, f.y + 10, 'burst');
    }
    flare(w, h.x, h.y - 20, 240, p.light, 4, 650);
    bloom(w, h.x, h.y - 20, p.hot, 4.5, 600, h.y + 60);
    w.debris([0xffffff, ...p.tints], h.x, h.y - 20, 40, h.y + 30, 'burst');
    if (this.bride) w.debris(PETALS, h.x, h.y - 20, 30, h.y + 30, 'burst');
    w.cameras.main.shake(320, 0.0018);
    sound.hourStrike(w.pan(h.x));
    sound.quakeSlam(w.pan(h.x));
  }
}

/** Lament: a wailing spirit's face, her hair rising off it in a plume, over rings of sound spreading on the ground. */
export const lamentIcon: IconPainter = (draw, p) => {
  const put = (x: number, y: number, c: number) => draw(Math.round(x), Math.round(y), c);
  for (const [r, c] of [[7.5, p.deep], [5.5, p.mid], [3.5, p.hot]] as const) {
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      // Only the near half of the inner rings shows below her.
      if (Math.sin(a) < 0 && r < 7) continue;
      put(7.5 + Math.cos(a) * r, 12.5 + Math.sin(a) * r * 0.4, c);
    }
  }
  // The plume of hair, then the long pale face over it.
  for (const [x0, y0, x1, y1] of [[6, 4, 3, 0], [7, 3, 6, 0], [8, 3, 9, 0], [9, 4, 12, 0], [9, 5, 14, 2], [6, 5, 1, 2]] as const) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, i > n - 2 ? p.hot : p.core);
  }
  for (let y = 4; y <= 11; y++) for (let x = 5; x <= 10; x++) if (!((x === 5 || x === 10) && (y === 4 || y > 9))) put(x, y, y < 6 ? p.core : p.hot);
  // Hollow eyes, the black wail, a tear.
  for (const [x, y] of [[6, 6], [9, 6], [6, 7], [9, 7], [7, 9], [8, 9], [7, 10], [8, 10]]) put(x, y, 0x05060c);
  put(6, 8, p.core);
};
