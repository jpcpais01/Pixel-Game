import Phaser from 'phaser';
import { sound } from '../../audio';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, column, easeOut, flare, Fx, GROUND, hash, ring, stroke, type Ink } from './ink';
import type { Cast, IconPainter } from './types';

// The Yurei's Special: Hundred Candles. In the old ghost-story game a hundred
// candles are lit and one is snuffed after each tale; when the last goes out,
// something comes. Here a ring of candles flickers alight round her, one after
// another, out to a wide circle. Then one by one they go out, and from each
// snuffed wick a vengeful hitodama streaks at a foe in the ring. When the
// last is out there's a breath of dark... and every candle flares at once,
// a pillar of spirit-fire each, burning everything inside the ring.
// Yuki-onna's candles are ice, their flames white, and snow falls in the ring.

const CANDLES = 16;
const RING_R = 84;
/** All lit over this long, one after another round the ring. */
const LIGHT_MS = 900;
/** Then the first goes out, and one more every SNUFF_EVERY. */
const SNUFF_AT = 1100;
const SNUFF_EVERY = 170;
/** The dark beat after the last goes out, before they all flare. */
const DARK_MS = 280;
const FLARE_MS = 620;
const SPIRIT_SPEED = 280;
const SPIRIT_DAMAGE = 6;
const FLARE_DAMAGE = 28;
const LAST_OUT = SNUFF_AT + (CANDLES - 1) * SNUFF_EVERY;
const FLARE_AT = LAST_OUT + DARK_MS;

interface Candle {
  x: number;
  y: number;
  lit: number;
  out: number;
  /** A little taller or shorter than its neighbours. */
  h: number;
}

interface Spirit {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  target: Hurtbox | null;
  t: number;
  trail: { x: number; y: number }[];
}

const inRing = (h: Hurtbox, x: number, y: number, r: number): boolean => Math.hypot(h.x - x, (h.y - y) / GROUND) <= r + h.radius;

export class HundredCandles extends Fx {
  private back: Ink;
  private front: Ink;
  private air: Ink;
  private candles: Candle[] = [];
  private spirits: Spirit[] = [];
  private lamp: Phaser.GameObjects.Light;
  private flared = false;
  private readonly x: number;
  private readonly y: number;
  private readonly yuki: boolean;
  private readonly wisp: string;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, FLARE_AT + FLARE_MS);
    this.x = c.x;
    this.y = c.y;
    this.yuki = c.look === 'yuki';
    this.wisp = this.yuki ? 'yurei_wisp_yuki' : 'yurei_wisp';
    const W = RING_R * 2 + 20;
    const H = Math.ceil(RING_R * GROUND) + 30;
    this.back = this.ink(W, H);
    this.front = this.ink(W, H);
    this.air = this.ink(W, Math.ceil(RING_R * GROUND * 2) + 80);
    for (let i = 0; i < CANDLES; i++) {
      // Lit starting from the back of the ring, round both ways at once.
      const th = -Math.PI / 2 + (i / CANDLES) * Math.PI * 2;
      const order = Math.min(i, CANDLES - i);
      this.candles.push({
        x: this.x + Math.cos(th) * RING_R,
        y: this.y + Math.sin(th) * RING_R * GROUND,
        lit: (order / (CANDLES / 2)) * LIGHT_MS,
        out: SNUFF_AT + i * SNUFF_EVERY,
        h: 4 + Math.round(hash(i, 3) * 2),
      });
    }
    this.lamp = this.light(this.x, this.y - 10, RING_R * 1.6, c.pal.light, 0);
    bloom(world, this.x, this.y - 12, c.pal.mid, 2.4, 500, this.y + 40);
    sound.wail(world.pan(this.x));
    sound.swell(world.pan(this.x));
  }

  protected step(dt: number): void {
    const w = this.world;
    const p = this.c.pal;
    const t = this.t;

    // Snuff the next candle: smoke, and a spirit streaking out of the wick.
    for (const cd of this.candles) {
      if (cd.out <= t && cd.out > t - dt) this.snuff(cd);
    }
    if (!this.flared && t >= FLARE_AT) this.flareAll();

    // The light: rising as they're lit, falling as they go out, black in the beat before the flare.
    const lit = this.candles.filter((cd) => t >= cd.lit && t < cd.out).length / CANDLES;
    const after = t >= FLARE_AT ? 1 - clamp01((t - FLARE_AT) / FLARE_MS) : 0;
    this.lamp.intensity = 1.4 * lit + 3 * after;

    // The candles, the back half behind everything in the ring and the front half before it.
    const gb = this.back.begin(this.x, this.y, this.y - RING_R * GROUND - 1, 0.5, 1);
    const gf = this.front.begin(this.x, this.y + RING_R * GROUND + 20, this.y + RING_R * GROUND + 2, 0.5, 1);
    for (const cd of this.candles) {
      if (t < cd.lit) continue;
      this.drawCandle(cd.y < this.y ? gb : gf, cd, t);
    }
    gb.end();
    gf.end();

    // Spirits in flight, and the flare's pillars, over everything.
    const ga = this.air.begin(this.x, this.y + RING_R * GROUND + 10, this.y + RING_R * GROUND + 30, 0.5, 1);
    if (after > 0) {
      const k = (t - FLARE_AT) / FLARE_MS;
      ring(ga, this.x, this.y, RING_R * (0.96 + 0.06 * easeOut(k)), 2.5 * (1 - k) + 0.5, p, after);
      for (const cd of this.candles) column(ga, cd.x, cd.y, 30 * (1 - k * 0.5) * (0.6 + 0.4 * easeOut(k * 4)), 3, p, after, t + cd.x);
    }
    this.stepSpirits(ga, dt);
    ga.end();

    if (this.yuki && t < FLARE_AT && Math.floor(t / 110) !== Math.floor((t - dt) / 110)) {
      // Snow falling inside the ring.
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * RING_R;
      w.debris([0xffffff, 0xe8f6ff], this.x + Math.cos(a) * r, this.y + Math.sin(a) * r * GROUND - 40, 1, this.y + 40, 'spores');
    }
  }

  /** A candle: a dish, a pale stub with a drip, its wick, and a flickering blue flame while lit; a thread of smoke once out. */
  private drawCandle(g: Ink, cd: Candle, t: number): void {
    const p = this.c.pal;
    const x = Math.round(cd.x);
    const y = Math.round(cd.y);
    const wax = this.yuki ? [0xe8f6ff, 0xb8dcf4, 0x7ab4dc] : [0xfff8ec, 0xe4dac8, 0xa89c88];
    const pop = clamp01((t - cd.lit) / 120);
    // The dish.
    for (let dx = -2; dx <= 2; dx++) g.put(x + dx, y, dx === -2 ? 0x2a2630 : 0x4a4452, 1);
    g.put(x - 1, y + 1, 0x221e28, 1);
    g.put(x, y + 1, 0x221e28, 1);
    g.put(x + 1, y + 1, 0x221e28, 1);
    // The stub, lit on its left.
    for (let dy = 1; dy <= cd.h; dy++) {
      g.put(x - 1, y - dy, wax[0], 1);
      g.put(x, y - dy, wax[1], 1);
    }
    g.put(x + 1, y - cd.h + 1, wax[0], 1);
    g.put(x + 1, y - cd.h + 2, wax[2], 1);
    const top = y - cd.h - 1;
    g.put(x - 1, top, 0x2a2420, 1);
    const lit = t >= cd.lit && t < cd.out;
    if (lit) {
      // The flame, swaying and flickering.
      const f = Math.floor(t / 70 + cd.x) % 4;
      const sway = [0, 1, 0, -1][f] * 0.5;
      const tall = (f === 2 ? 4 : 3) * (0.4 + 0.6 * pop);
      g.put(x - 1, top - 1, p.core, 1);
      g.put(x - 1, top - 2, p.hot, 1);
      g.put(x - 1 + sway, top - tall, p.mid, 0.9);
      if (tall > 3) g.put(x - 1 + sway, top - tall + 1, p.hot, 1);
      g.put(x - 2, top - 1, p.mid, 0.6);
      g.put(x, top - 1, p.mid, 0.6);
    } else if (t >= cd.out && t < cd.out + 700) {
      // Smoke curling up from the wick.
      const k = (t - cd.out) / 700;
      for (let i = 0; i < 6; i++) {
        const up = i * 2 + k * 10;
        const sx = x - 1 + Math.sin(up * 0.35 + cd.x) * (1 + up * 0.08);
        if (i / 6 > 1 - k) continue;
        g.put(sx, top - 1 - up, this.yuki ? 0xe0f0ff : 0x8a94a8, 0.6 * (1 - k));
      }
    }
  }

  /** The candle goes out, and a hitodama tears loose from its wick. */
  private snuff(cd: Candle): void {
    const w = this.world;
    const x = cd.x - 1;
    const y = cd.y - cd.h - 3;
    w.debris([this.c.pal.hot, 0xffffff], x, y, 3, cd.y + 2, 'spores');
    const foes = w.hurtboxesWhere((b) => b.alive && inRing(b, this.x, this.y, RING_R + 6));
    // One of the two foes nearest the candle, so the spirits spread round the ring.
    const target = foes.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[Math.floor(Math.random() * Math.min(2, foes.length))] ?? null;
    const sprite = this.own(w.add.sprite(Math.round(x), Math.round(y), this.wisp, 'w0').setBlendMode(Phaser.BlendModes.ADD).play(`${this.wisp}_flicker`));
    const a = Math.atan2(this.y - cd.y, this.x - cd.x) * 0.3 - Math.PI / 2;
    this.spirits.push({ sprite, x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 90, target, t: 0, trail: [] });
    sound.soulCast(w.pan(x));
  }

  private stepSpirits(g: Ink, dt: number): void {
    const w = this.world;
    const p = this.c.pal;
    const s = dt / 1000;
    for (let i = this.spirits.length - 1; i >= 0; i--) {
      const sp = this.spirits[i];
      sp.t += dt;
      const h = sp.target;
      let done = false;
      if (h && h.alive) {
        // A moment rising off the wick, then it homes in hard.
        const tx = h.x;
        const ty = h.y - h.bodyY;
        const dx = tx - sp.x;
        const dy = ty - sp.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = sp.t < 140 ? 0.02 : 1 - Math.exp(-dt / 70);
        sp.vx += ((dx / d) * SPIRIT_SPEED - sp.vx) * k;
        sp.vy += ((dy / d) * SPIRIT_SPEED - sp.vy) * k;
        if (d < h.radius + 3) {
          h.hurt({ damage: SPIRIT_DAMAGE, heavy: false, knock: 40, fromX: sp.x - sp.vx * 0.05, fromY: sp.y - sp.vy * 0.05, poison: p.hot });
          w.debris([0xffffff, ...p.tints], sp.x, sp.y, 6, h.y + 6, 'burst');
          bloom(w, sp.x, sp.y, p.hot, 0.8, 220, h.y + 8, 0.7);
          sound.soulHit(w.pan(sp.x));
          done = true;
        }
      } else {
        // Nothing to haunt: it drifts up and fades.
        sp.vx *= 1 - Math.min(1, dt / 400);
        sp.vy += (-50 - sp.vy) * Math.min(1, dt / 300);
        if (sp.t > 900) done = true;
      }
      if (sp.t > 2000) done = true;
      if (done) {
        sp.sprite.destroy();
        this.spirits.splice(i, 1);
        continue;
      }
      sp.x += sp.vx * s;
      sp.y += sp.vy * s;
      sp.trail.unshift({ x: sp.x, y: sp.y + 3 });
      if (sp.trail.length > 7) sp.trail.pop();
      // A streak of spirit-light behind it.
      for (let j = 1; j < sp.trail.length; j++) {
        const a = 1 - j / sp.trail.length;
        stroke(g, sp.trail[j - 1].x, sp.trail[j - 1].y, sp.trail[j].x, sp.trail[j].y, 1.2 * a, p, a * 0.8);
      }
      const fade = h && h.alive ? 1 : 1 - clamp01((sp.t - 500) / 400);
      sp.sprite.setPosition(Math.round(sp.x), Math.round(sp.y - 5)).setDepth(sp.y + 30).setAlpha(fade).setRotation(Math.atan2(sp.vy, sp.vx) + Math.PI / 2 + Math.PI);
    }
  }

  /** Every candle flares at once: a pillar of spirit-fire each, and the whole ring burns. */
  private flareAll(): void {
    this.flared = true;
    const w = this.world;
    const p = this.c.pal;
    for (const h of w.hurtboxesWhere((b) => b.alive && inRing(b, this.x, this.y, RING_R))) {
      h.hurt({ damage: FLARE_DAMAGE, heavy: true, knock: 140, fromX: this.x, fromY: this.y, poison: p.hot });
      w.debris([0xffffff, ...p.tints], h.x, h.y - h.bodyY, 8, h.y + 10, 'burst');
    }
    for (const cd of this.candles) w.debris([0xffffff, p.hot, p.mid], cd.x, cd.y - 8, 4, cd.y + 4, 'burst');
    if (this.yuki) w.debris([0xffffff, 0xe8f6ff], this.x, this.y - 20, 30, this.y + 30, 'spores');
    flare(w, this.x, this.y - 10, RING_R * 2.4, p.light, 4, 650);
    bloom(w, this.x, this.y - 10, p.hot, 4.5, 600, this.y + 60);
    w.cameras.main.shake(280, 0.0016);
    sound.starImpact(w.pan(this.x));
    sound.flame(w.pan(this.x));
  }

  destroy(): void {
    for (const sp of this.spirits) sp.sprite.destroy();
    this.spirits = [];
    super.destroy();
  }
}

type Put = (x: number, y: number, c: number) => void;

/** Hundred Candles: a ring of candles in perspective, the nearest ones tall, a hitodama rising from the middle. */
export const candlesIcon: IconPainter = (put: Put, p) => {
  for (let i = 0; i < 10; i++) {
    const th = (i / 10) * Math.PI * 2;
    const x = Math.round(8 + Math.cos(th) * 6.5);
    const y = Math.round(11 + Math.sin(th) * 3);
    const near = Math.sin(th) > 0.2;
    put(x, y, p.deep);
    put(x, y - 1, near ? 0xffffff : p.mid);
    if (near) put(x, y - 2, 0xe8e8f0);
    put(x, y - (near ? 3 : 2), i % 3 === 0 ? p.deep : p.hot);
  }
  // The hitodama: a ball of flame, its tail licking up.
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 7);
      if (d <= 2.4) put(x, y, d < 1.2 ? p.core : p.hot);
    }
  put(8, 4, p.hot);
  put(9, 3, p.mid);
  put(9, 2, p.mid);
  put(10, 1, p.deep);
  put(7, 4, p.mid);
};
