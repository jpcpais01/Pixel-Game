import { bloom, bump, circle, clamp01, easeOut, flare, Fx, GROUND, pal, pool, ring, type Ink, type Pal } from './ultimate/ink';
import type { Hurtbox } from './combat';
import type { WorldScene } from '../scenes/WorldScene';

// The companions' powers as they are seen: the yeti cub's ring of frost, the
// old turtle's ward round the hero, the fairy's mending, the gryphon's talon
// marks and the krakling's tentacles. Each is solid pixels on the world's
// grid, like the Specials (see ultimate/ink.ts). Companion.ts decides when.

export const ICE: Pal = pal(0xffffff, 0xd8f6ff, 0x8ad8ff, 0x3a8ac8, 0x9ae4ff);
export const WARD: Pal = pal(0xeafffa, 0x9ffff0, 0x5ae8d8, 0x1a8a8a, 0x5ae8d8);
export const MEND: Pal = pal(0xffffff, 0xeaffc0, 0x9dff9a, 0x3ab85a, 0xb8ffb0);
export const TALON: Pal = pal(0xffffff, 0xfff0b0, 0xf0c060, 0x8a5418, 0xffd070);
export const STORM: Pal = pal(0xffffff, 0xfff080, 0xffc830, 0x8a6a10, 0xfff080);
/** The krakling's hide, darkest last, and its suckers. */
const INK = { rim: 0x1a0e2e, body: 0x4a2a7a, lit: 0x7a4ab0, sheen: 0xb890e0, sucker: 0xf0e0ff };

type Point = { x: number; y: number };

/**
 * The yeti cub stamps: a ring of frost races out over the ground, throwing up
 * a crown of ice spikes as it goes, and leaves a rime that fades behind it.
 */
export class FrostNova extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private r: number,
  ) {
    super(world, 620);
    this.g = this.ink(Math.ceil(r * 2 + 12), Math.ceil(r * 2 * GROUND + 24));
    flare(world, x, y - 6, r * 1.6, ICE.light, 1.2, 480);
    bloom(world, x, y - 4, ICE.hot, 1.3, 360, y + 1, 0.75);
  }

  protected step(): void {
    const k = easeOut(this.t / (this.life * 0.55));
    const fade = 1 - clamp01((this.t - this.life * 0.4) / (this.life * 0.6));
    const r = this.r * k;
    const g = this.g.begin(this.x, this.y + 4, 2.5);
    pool(g, this.x, this.y, r * 0.9, ICE.hot, ICE.mid, fade * 0.8);
    ring(g, this.x, this.y, r, 1 + (1 - k) * 2, ICE, fade);
    // Spikes of ice round the ring's edge, rising as it passes and sinking after.
    const h = 4 * bump(this.t / (this.life * 0.7));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.26;
      const px = Math.round(this.x + Math.cos(a) * r);
      const py = Math.round(this.y + Math.sin(a) * r * GROUND);
      const tall = h * (i % 3 === 0 ? 1.3 : 0.8);
      for (let d = 0; d < tall; d++) {
        const c = d > tall - 1.5 ? ICE.core : d > tall * 0.4 ? ICE.hot : ICE.mid;
        g.put(px, py - d, c, fade);
        if (d < tall * 0.5) g.put(px + 1, py - d, ICE.deep, fade * 0.9);
      }
    }
    g.end();
  }
}

/**
 * The old turtle's ward: a faint shell of light round the hero, turning slow
 * facets, that shatters outward when it turns a blow.
 */
export class WardBubble extends Fx {
  private g: Ink;
  private popT = -1;

  constructor(
    world: WorldScene,
    private at: () => Point,
  ) {
    super(world, Infinity);
    this.g = this.ink(48, 52);
    const p = at();
    bloom(world, p.x, p.y - 12, WARD.light, 1.1, 420, p.y + 2, 0.6);
  }

  /** The blow is turned: it bursts, and is gone. */
  pop(): void {
    if (this.popT >= 0) return;
    this.popT = this.t;
    this.life = this.t + 280;
    const p = this.at();
    flare(this.world, p.x, p.y - 12, 70, WARD.light, 1.4, 360);
    this.world.debris(WARD.tints, Math.round(p.x), Math.round(p.y) - 12, 18, p.y + 20, 'burst');
  }

  protected step(): void {
    const p = this.at();
    const cx = Math.round(p.x);
    const cy = Math.round(p.y) - 13;
    const grow = easeOut(this.t / 320);
    const burst = this.popT >= 0 ? clamp01((this.t - this.popT) / 280) : 0;
    const rx = (12 + burst * 8) * grow;
    const ry = (14 + burst * 8) * grow;
    const a = (0.5 + 0.12 * Math.sin(this.t * 0.005)) * (1 - burst);
    const g = this.g.begin(cx, cy, p.y + 2);
    // A dotted shell: its facets come and go as it turns, brightest top-left where the light is.
    const n = Math.ceil((rx + ry) * 2.2);
    const turn = this.t * 0.0015;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const facet = Math.floor(((th + turn) / (Math.PI * 2)) * 12) % 2 === 0;
      if (!facet && i % 2) continue;
      const lit = Math.cos(th + Math.PI * 0.75);
      const c = lit > 0.6 ? WARD.core : lit > 0 ? WARD.hot : WARD.mid;
      g.put(cx + Math.cos(th) * rx, cy + Math.sin(th) * ry, c, a * (facet ? 1 : 0.6));
    }
    // A gleam on the upper left, and a band where it meets the ground.
    for (let i = 0; i < 4; i++) g.put(cx - rx * 0.55 + i, cy - ry * 0.6 - i * 0.6, WARD.core, a * 0.8);
    circle(g, cx, cy + ry * 0.8, rx * 0.85, WARD.mid, a * 0.5, 0.35);
    g.end();
  }
}

/**
 * The fairy's mending: a ring of light blooms on the ground under the hero
 * and motes of green and gold spiral up round them, keeping to them as they move.
 */
export class MendBloom extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private at: () => Point,
  ) {
    super(world, 900);
    this.g = this.ink(48, 60);
    const p = at();
    flare(world, p.x, p.y - 10, 70, MEND.light, 1.1, 700);
    bloom(world, p.x, p.y - 12, MEND.hot, 1.2, 600, p.y + 2, 0.55);
  }

  protected step(): void {
    const p = this.at();
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const u = this.t / this.life;
    const fade = 1 - clamp01((u - 0.55) / 0.45);
    const g = this.g.begin(x, y + 6, y + 2, 0.5, 1);
    ring(g, x, y, 5 + easeOut(u * 1.6) * 9, 1, MEND, fade * 0.8, GROUND, 0.35, 7);
    for (let i = 0; i < 9; i++) {
      const s = clamp01(u * 1.4 - i * 0.05);
      if (s <= 0 || s >= 1) continue;
      const th = i * 2.1 + s * 5;
      const r = 10 - s * 5;
      const mx = x + Math.cos(th) * r;
      const my = y - 2 - s * 30 + Math.sin(th) * r * GROUND;
      const c = i % 3 === 0 ? MEND.core : i % 3 === 1 ? MEND.hot : 0xffe08a;
      const a = fade * (1 - s * 0.6);
      g.put(mx, my, c, a);
      g.put(mx, my + 1, MEND.mid, a * 0.6);
      if (i % 3 === 0) {
        g.put(mx + 1, my, MEND.hot, a * 0.7);
        g.put(mx - 1, my, MEND.hot, a * 0.7);
      }
    }
    g.end();
  }
}

/** Where the gryphon strikes: three talon marks raked across the foe, flashing white and fading to gold. */
export class TalonRake extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private facing: number,
  ) {
    super(world, 300);
    this.g = this.ink(30, 30);
    flare(world, x, y, 50, TALON.light, 1.3, 260);
  }

  protected step(): void {
    const reveal = easeOut(this.t / 90);
    const fade = 1 - clamp01((this.t - 120) / 180);
    const g = this.g.begin(this.x, this.y, this.y + 30);
    for (let k = -1; k <= 1; k++) {
      const x0 = this.x - this.facing * 7 + k * 3;
      const y0 = this.y - 8 + Math.abs(k);
      const x1 = x0 + this.facing * 12 * reveal;
      const y1 = y0 + 13 * reveal;
      const n = Math.max(1, Math.ceil(13 * reveal));
      for (let i = 0; i <= n; i++) {
        const s = i / n;
        const px = x0 + (x1 - x0) * s;
        const py = y0 + (y1 - y0) * s;
        const thick = Math.sin(s * Math.PI);
        g.put(px, py, this.t < 90 ? TALON.core : TALON.hot, fade);
        if (thick > 0.4) g.put(px + this.facing, py, TALON.mid, fade * 0.9);
      }
    }
    g.end();
  }
}

const LASH_OUT = 110;
const LASH_HOLD = 90;

/**
 * One of the krakling's tentacles: it curls out from under it to a foe,
 * strikes as it arrives (`onReach`), and draws back. Round in section, lit on
 * its upper side, with pale suckers along the underside.
 */
export class TentacleLash extends Fx {
  private g: Ink;
  private reached = false;
  private tx: number;
  private ty: number;

  constructor(
    world: WorldScene,
    private ox: number,
    private oy: number,
    private foe: Hurtbox,
    private bend: number,
    private delay: number,
    private onReach: () => void,
  ) {
    super(world, delay + LASH_OUT + LASH_HOLD + 180);
    this.tx = foe.x;
    this.ty = foe.y - foe.bodyY;
    this.g = this.ink(Math.ceil(Math.abs(this.tx - ox) + 44), Math.ceil(Math.abs(this.ty - oy) + 44));
  }

  protected step(): void {
    const t = this.t - this.delay;
    if (t < 0) return;
    if (this.foe.alive && !this.reached) {
      this.tx = this.foe.x;
      this.ty = this.foe.y - this.foe.bodyY;
    }
    const out = t < LASH_OUT ? easeOut(t / LASH_OUT) : t < LASH_OUT + LASH_HOLD ? 1 : 1 - clamp01((t - LASH_OUT - LASH_HOLD) / 180);
    if (!this.reached && t >= LASH_OUT) {
      this.reached = true;
      this.onReach();
    }
    const { ox, oy, tx, ty } = this;
    const len = Math.hypot(tx - ox, ty - oy) || 1;
    // A curve bowed to one side, the bend easing as it straightens to strike.
    const bow = this.bend * Math.min(14, len * 0.35) * (1.2 - out * 0.5);
    const qx = (ox + tx) / 2 + (-(ty - oy) / len) * bow;
    const qy = (oy + ty) / 2 + ((tx - ox) / len) * bow;
    const g = this.g.begin((ox + tx) / 2, (oy + ty) / 2, Math.max(oy, this.foe.y) + 2);
    const n = Math.ceil(len * 1.4 * out);
    for (let i = 0; i <= n; i++) {
      const s = (i / Math.max(1, n)) * out;
      const a = (1 - s) * (1 - s);
      const b = 2 * (1 - s) * s;
      const c = s * s;
      const px = a * ox + b * qx + c * tx;
      const py = a * oy + b * qy + c * ty;
      const r = 2 - 1.3 * (s / Math.max(0.01, out));
      const R = Math.ceil(r);
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > r) continue;
          const col = d > r - 0.8 ? INK.rim : dy < -r * 0.3 ? (dx < 0 ? INK.sheen : INK.lit) : INK.body;
          g.put(px + dx, py + dy, col);
        }
      }
      if (i % 4 === 2 && r > 1) g.put(px, py + Math.max(1, r - 0.5), INK.sucker);
    }
    g.end();
  }
}
