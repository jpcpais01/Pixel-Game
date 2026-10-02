import { sound } from '../../audio';
import { onGround } from '../Toxins';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, column, dither, easeIn, easeOut, flare, Fx, GROUND, hash, ring, strikeGround, type Ink } from './ink';
import type { Cast, IconPainter } from './types';

// The Deep Diver's Special, Crushing Depths: a great bell of the deep sea
// drops over the spot. Inside the dome of dark water the light wavers in
// caustics, bubbles rise and the shadows of fish circle; every foe inside is
// slowed to a crawl and crushed by the pressure, tick by tick, the dome
// clenching each time. Then it gives way in a huge splash that hurls them
// all out. The Barnacle's sea is lit coral pink, coral fans growing round
// its floor.

/** The dome's reach on the ground, and its height over the spot. */
const RADIUS = 40;
const DOME_H = 36;
/** Falling, then holding, then giving way, ms. */
const DROP = 380;
const COLLAPSE = 3300;
const SPLASH = 600;
const CRUSH_EVERY = 400;
const CRUSH_DAMAGE = 7;
/** How hard the deep holds them: their pace, kept up while they're inside. */
const CRUSH_SLOW = 0.3;
const BURST_DAMAGE = 26;
const BURST_KNOCK = 260;
/** How far the dome falls from. */
const FALL = 80;
const BUBBLES = 22;
const FISH = 4;

const W = RADIUS * 2 + 30;
const H = 160;
/** Where the spot sits in the canvas, from the top: room above for the fall and the dome. */
const AY = 0.8;

interface Bubble {
  x: number;
  y: number;
  /** Height over the floor. */
  h: number;
  speed: number;
  r: number;
  seed: number;
}

export class CrushingDepths extends Fx {
  private g: Ink;
  private back: Ink;
  private bubbles: Bubble[] = [];
  private crushT = CRUSH_EVERY * 2;
  /** The dome clenching on each crush: 1 just after, easing back to 0. */
  private clench = 0;
  private landed = false;
  private burst = false;
  private coral: boolean;
  private seed = Math.floor(Math.random() * 1000);

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, COLLAPSE + SPLASH);
    this.coral = c.look === 'barnacle';
    // Behind the foes: the floor's light and the far wall. Over them: the near wall, fish and bubbles.
    this.back = this.ink(W, H);
    this.g = this.ink(W, H);
    for (let i = 0; i < BUBBLES; i++) this.bubbles.push(this.newBubble(i, Math.random()));
    sound.splash(world.pan(c.tx));
  }

  private newBubble(i: number, rise = 0): Bubble {
    const a = hash(i, this.seed, Math.floor(this.t)) * Math.PI * 2;
    const d = Math.sqrt(hash(i, this.seed + 1, Math.floor(this.t))) * RADIUS * 0.85;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * GROUND, h: rise * DOME_H, speed: 14 + hash(i, this.seed + 2) * 20, r: hash(i, this.seed + 3) < 0.3 ? 1 : 0, seed: hash(i, this.seed + 4) * 10 };
  }

  protected step(dt: number): void {
    const w = this.world;
    const { tx, ty, pal: p } = this.c;
    const t = this.t;

    if (!this.landed && t >= DROP) {
      this.landed = true;
      w.cameras.main.shake(200, 0.004);
      w.debris(p.tints, tx, ty - 6, 20, ty + 30, 'burst');
      w.debris([0xffffff, p.core, p.hot], tx, ty - 20, 14, ty + 30, 'spores');
      flare(w, tx, ty - 16, 140, p.light, 2.4, 500);
      bloom(w, tx, ty - 14, p.mid, 2.6, 420, ty + 40, 0.7);
      sound.blast(w.pan(tx));
      sound.splash(w.pan(tx));
    }
    if (this.landed && !this.burst) {
      // The pressure: everything inside crawls, and every so often it all clenches and crushes.
      const inside = w.hurtboxesWhere((h) => h.alive && onGround(h, tx, ty, RADIUS));
      for (const h of inside) h.slow?.(CRUSH_SLOW, 250, p.deep);
      this.crushT -= dt;
      if (this.crushT <= 0 && t < COLLAPSE) {
        this.crushT = CRUSH_EVERY;
        this.clench = 1;
        const hit: Hurtbox[] = strikeGround(w, tx, ty, RADIUS, { damage: CRUSH_DAMAGE, knock: 4, fromX: tx, fromY: ty });
        for (const h of hit) w.debris([p.core, p.hot, 0xffffff], h.x, h.y - h.bodyY, 3, h.y + 8, 'spores');
        if (hit.length) sound.thud(w.pan(tx), true);
      }
    }
    if (!this.burst && t >= COLLAPSE) {
      this.burst = true;
      strikeGround(w, tx, ty, RADIUS + 6, { damage: BURST_DAMAGE, heavy: true, knock: BURST_KNOCK, fromX: tx, fromY: ty + 2 });
      w.cameras.main.shake(300, 0.006);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        w.debris([0xffffff, p.core, p.hot, p.mid], tx + Math.cos(a) * RADIUS * 0.8, ty + Math.sin(a) * RADIUS * GROUND * 0.8 - 6, 6, ty + 40, 'burst');
      }
      w.debris([0xffffff, p.core, p.hot], tx, ty - 30, 24, ty + 40, 'burst');
      flare(w, tx, ty - 20, 190, p.light, 3, 600);
      bloom(w, tx, ty - 20, p.hot, 3.4, 520, ty + 50);
      sound.blast(w.pan(tx));
      sound.splash(w.pan(tx));
    }
    this.clench = Math.max(0, this.clench - dt / 260);

    const front = this.g.begin(tx, ty, ty + RADIUS * GROUND + 6, 0.5, AY);
    const back = this.back.begin(tx, ty, ty - RADIUS * GROUND - 2, 0.5, AY);
    if (!this.landed) this.drawFall(front, back, t / DROP);
    else if (!this.burst) this.drawDome(front, back, dt);
    else this.drawSplash(front, back, (t - COLLAPSE) / SPLASH);
    front.end();
    back.end();
  }

  /** Falling from the sky: the bell of water dropping, its shadow growing on the ground under it. */
  private drawFall(g: Ink, b: Ink, k: number): void {
    const { tx, ty, pal: p } = this.c;
    const e = easeIn(k);
    const lift = FALL * (1 - e);
    // The shadow.
    const sr = RADIUS * (0.35 + 0.65 * e);
    for (let dy = -Math.ceil(sr * GROUND); dy <= sr * GROUND; dy++)
      for (let dx = -Math.ceil(sr); dx <= sr; dx++) {
        const d = Math.hypot(dx / sr, dy / (sr * GROUND));
        if (d > 1 || dither(tx + dx, ty + dy) >= 0.25 + 0.45 * e) continue;
        b.put(tx + dx, ty + dy, 0x020a12, 0.5);
      }
    // The bell: the dome's shell coming down, stretched by its fall.
    const hh = DOME_H * (1 + (1 - e) * 0.4);
    for (let i = 0; i <= 60; i++) {
      const a = Math.PI + (i / 60) * Math.PI;
      const x = tx + Math.cos(a) * RADIUS * (0.8 + 0.2 * e);
      const y = ty - lift + Math.sin(a) * hh;
      g.put(x, y, i % 7 === 0 ? p.core : p.hot, 0.9);
      g.put(x, y + 1, p.mid, 0.6);
    }
    // Water streaming off its rim as it falls.
    for (let i = 0; i < 14; i++) {
      const x = tx + (hash(i, this.seed) * 2 - 1) * RADIUS * 0.9;
      const len = 3 + hash(i, this.seed, 1) * 6;
      for (let j = 0; j < len; j++) g.put(x, ty - lift + 2 + j * 2 + ((this.t * 0.2) % 2), j < 2 ? p.hot : p.mid, 0.7 * (1 - j / len));
    }
  }

  /** The dome itself, its water, light, bubbles and fish. */
  private drawDome(g: Ink, b: Ink, dt: number): void {
    const { tx, ty, pal: p } = this.c;
    const t = this.t - DROP;
    const open = easeOut(clamp01(t / 160));
    // Clenching pulls it in a touch, and it wobbles back.
    const squeeze = 1 - this.clench * 0.07 + Math.sin(this.t * 0.012) * 0.01;
    const R = RADIUS * squeeze * (0.9 + 0.1 * open);
    const ry = R * GROUND;
    const Hd = DOME_H * squeeze * (1.15 - 0.15 * open);
    const end = clamp01((COLLAPSE - this.t) / 180);
    const deep = 0x041824;

    for (let dy = -Math.ceil(Hd) - 1; dy <= Math.ceil(ry) + 1; dy++) {
      for (let dx = -Math.ceil(R) - 1; dx <= Math.ceil(R) + 1; dx++) {
        const floor = Math.hypot(dx / R, dy / ry);
        const up = dy <= 0 ? Math.hypot(dx / R, dy / Hd) : 9;
        const e = Math.min(floor, up);
        if (e > 1) continue;
        const x = tx + dx;
        const y = ty + dy;
        const onFloor = floor <= 1;
        // Behind the foes: the floor and the far half of the wall. Over them: a thin veil of water and the near rim.
        if (onFloor) {
          // The floor: dark sea, the caustics' wavering net of light across it.
          const c1 = Math.sin(x * 0.42 + this.t * 0.0042 + Math.sin(y * 0.3 + this.t * 0.002) * 1.6);
          const c2 = Math.sin(y * 0.7 - this.t * 0.0033 + Math.sin(x * 0.25 - this.t * 0.0021) * 1.4);
          const net = c1 + c2;
          if (net > 1.55) b.put(x, y, net > 1.8 ? p.hot : p.mid, 0.7 * end);
          else if (dither(x, y) < 0.7) b.put(x, y, floor > 0.85 ? p.deep : deep, 0.55 * end);
        } else if (dither(x, y) < 0.55) b.put(x, y, deep, 0.45 * end);
        // The near veil: a faint dither of water over everything inside, thicker towards the top.
        const veil = dy < 0 ? 0.18 + 0.25 * (-dy / Hd) : 0.12;
        if (dither(x + 1, y + 2) < veil) g.put(x, y, p.deep, 0.5 * end);
        // The rim: the dome's edge catching the light, brightest high on the left.
        if (e > 0.9 && (dy <= 0 ? up > 0.9 : floor > 0.9 && dy > 0)) {
          const lit = dy < -Hd * 0.4 && dx < 0;
          g.put(x, y, lit ? p.core : dy > 0 ? p.mid : p.hot, (lit ? 0.95 : 0.75) * end);
        }
        // Shafts of light slanting down through the water from the top.
        if (dy < 0 && up < 0.85 && (((dx + dy * 0.45 + this.t * 0.012) % 17) + 17) % 17 < 1.6) g.put(x, y, p.mid, 0.22 * end);
      }
    }
    if (this.coral) this.drawCoral(b, R, ry, end);

    // Fish: dark shapes circling at different depths, turning the way they swim.
    for (let i = 0; i < FISH; i++) {
      const dirn = i % 2 ? 1 : -1;
      const a = this.t * 0.0011 * dirn * (1 + i * 0.15) + i * 1.7;
      const rr = R * (0.35 + 0.15 * i);
      const fx = tx + Math.cos(a) * rr;
      const fy = ty + Math.sin(a) * rr * GROUND - 8 - i * 5;
      const vx = -Math.sin(a) * dirn;
      this.fish(g, fx, fy, vx >= 0 ? 1 : -1, i, end);
    }
    // Bubbles: up from the floor, wobbling, popping at the dome's roof.
    for (let i = 0; i < this.bubbles.length; i++) {
      const bb = this.bubbles[i];
      bb.h += (bb.speed * dt) / 1000;
      const roof = Hd * Math.sqrt(Math.max(0, 1 - (bb.x / R) ** 2)) - 2;
      if (bb.h > roof) {
        this.bubbles[i] = this.newBubble(i);
        continue;
      }
      const x = tx + bb.x + Math.sin(this.t * 0.006 + bb.seed) * 1.2;
      const y = ty + bb.y - bb.h;
      if (bb.r) {
        g.put(x, y - 1, p.core, 0.85 * end);
        g.put(x - 1, y, p.hot, 0.7 * end);
        g.put(x + 1, y, p.mid, 0.7 * end);
        g.put(x, y + 1, p.mid, 0.6 * end);
      } else g.put(x, y, p.core, 0.8 * end);
    }
    // The clench: a dark ring of pressure squeezing in over the floor.
    if (this.clench > 0) ring(g, tx, ty, R * (0.3 + 0.7 * this.clench), 1.2, p, this.clench * 0.6 * end);
  }

  /** A fish's dark shadow, `s` the way it faces: a body, a forked tail, a glint of an eye. */
  private fish(g: Ink, x: number, y: number, s: number, i: number, a: number): void {
    const shade = this.coral ? 0x3a0a22 : 0x021018;
    const n = i === 0 ? 4 : 3;
    for (let k = -n; k <= n - 1; k++) {
      const hgt = k < -n + 2 ? 0 : k > n - 3 ? 0 : 1;
      g.put(x + k * s, y, shade, 0.8 * a);
      if (hgt) g.put(x + k * s, y - 1, shade, 0.8 * a);
    }
    g.put(x - (n + 1) * s, y - 1, shade, 0.7 * a);
    g.put(x - (n + 1) * s, y + 1, shade, 0.7 * a);
    g.put(x + (n - 2) * s, y - 1, this.c.pal.hot, 0.6 * a);
  }

  /** The Barnacle's sea floor: little coral fans and sprigs grown round the dome's edge. */
  private drawCoral(b: Ink, R: number, ry: number, a: number): void {
    const { tx, ty, pal: p } = this.c;
    for (let i = 0; i < 9; i++) {
      const th = (i / 9) * Math.PI * 2 + 0.3;
      const x = tx + Math.cos(th) * R * 0.82;
      const y = ty + Math.sin(th) * ry * 0.82;
      const h = 3 + Math.round(hash(i, this.seed) * 3);
      const sway = Math.sin(this.t * 0.003 + i) * 0.8;
      for (let k = 0; k < h; k++) {
        b.put(x + sway * (k / h), y - k, k === h - 1 ? p.core : p.hot, a);
        if (k === h - 2) {
          b.put(x - 1 + sway, y - k, p.mid, a);
          b.put(x + 1 + sway, y - k - 1, p.mid, a);
        }
      }
    }
  }

  /** Giving way: a pillar of water bursting up and a wave racing out along the ground. */
  private drawSplash(g: Ink, b: Ink, k: number): void {
    const { tx, ty, pal: p } = this.c;
    ring(b, tx, ty, RADIUS * (0.6 + 1.1 * easeOut(k)), 2.4 * (1 - k) + 0.6, p, 1 - k);
    ring(b, tx, ty, RADIUS * (0.3 + 0.8 * easeOut(k)), 1, p, 0.7 * (1 - k), GROUND, 0.4, this.seed);
    if (k < 0.6) column(g, tx, ty, 70 * easeOut(k / 0.35) * (1 - Math.max(0, k - 0.35) / 0.25 * 0.5), 9 * (1 - k), p, 1 - k / 0.6, this.t);
    // Sheets of spray flung out over the rim.
    for (let i = 0; i < 16; i++) {
      const th = (i / 16) * Math.PI * 2;
      const d = RADIUS * (0.7 + 0.9 * easeOut(k));
      const x = tx + Math.cos(th) * d;
      const y = ty + Math.sin(th) * d * GROUND - Math.sin(k * Math.PI) * 18;
      g.put(x, y, k < 0.4 ? p.core : p.hot, 1 - k);
      g.put(x, y + 1, p.mid, 0.7 * (1 - k));
    }
  }
}

/** Crushing Depths: a dome of deep water over the sea floor, a fish in it, bubbles rising. */
export const depthsIcon: IconPainter = (put, p) => {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const dx = (x + 0.5 - 8) / 7;
      const dy = (y + 0.5 - 12) / 10;
      const e = Math.hypot(dx, dy);
      if (y <= 12 && e <= 1 && e > 0.84) put(x, y, y < 6 ? p.core : p.hot);
      else if (y <= 12 && e <= 0.84 && (x + y) % 2 === 0 && y > 8) put(x, y, p.deep);
    }
  // The floor.
  for (let x = 1; x <= 14; x++) put(x, 13, x % 3 ? p.mid : p.hot);
  for (let x = 3; x <= 12; x++) put(x, 14, p.deep);
  // A fish swimming left.
  for (const [x, y] of [[5, 8], [6, 8], [7, 8], [6, 7], [6, 9], [8, 7], [8, 9]] as const) put(x, y, p.mid);
  put(5, 8, p.core);
  // Bubbles.
  for (const [x, y] of [[10, 9], [11, 6], [10, 4]] as const) put(x, y, p.core);
  put(9, 6, p.hot);
};
