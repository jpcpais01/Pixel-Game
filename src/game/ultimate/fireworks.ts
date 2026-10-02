import Phaser from 'phaser';
import type { Hurtbox } from '../combat';
import { sound } from '../../audio';
import type { WorldScene } from '../../scenes/WorldScene';
import { starsFor } from '../Pyrotechnist';
import type { Cast } from './types';
import { bloom, circle, clamp01, dither, easeOut, flare, Fx, GROUND, hash, type Ink, type Pal, pool, shade, star, strikeGround } from './ink';

// The Pyrotechnist's Special, Skyburst. He plants a little crate of rockets
// at his feet and lights it; one after another the rockets leap out, climb
// on a hissing trail of sparks and curve over the foes round the aimed spot,
// each picking a foe the others haven't, and burst high over them in a great
// chrysanthemum: long rays of coloured fire that spread, droop and fade, a
// ring of a second colour inside, and a rain of glitter that drifts down
// and burns what stands under it. The last rocket is the biggest.
//
// The sky is lit with one light that swells with every burst (in the
// burst's colour), plus the usual brief flares, so it stays well within the
// renderer's lights.

const ROCKETS = 6;
/** When the first rocket leaves, and the gap between rockets. */
const FIRST_AT = 150;
const EVERY = 260;
/** A rocket's climb, and how high over its foe it bursts. */
const FLIGHT = 520;
const BURST_H = 46;
/** Rockets look for foes this far round the aimed spot. */
const SEEK_R = 64;
/** Everything standing this close under a burst is struck, then burned by the glitter. */
const BURST_R = 28;
const BURST_DAMAGE = 14;
const BURST_KNOCK = 80;
const GLITTER_TICKS = 3;
const GLITTER_EVERY = 250;
const GLITTER_DAMAGE = 3;
/** How long a burst hangs in the sky, its reach in the air, and how far its sparks droop. */
const BLOOM_MS = 1150;
const SPREAD = 32;
const DROOP = 22;
/** The long rays and the inner ring of a second colour. */
const RAYS = 30;
const INNER = 12;
/** Each spark's tail: points back along its path, this many ms apart. */
const TAIL = 5;
const TAIL_GAP = 26;
/** The finale rocket's burst is this much bigger. */
const FINALE = 1.3;
/** Falling glitter: how many specks, and how long a speck takes to reach the ground. */
const GLITTER = 26;
const FALL_MS = 700;
const LIFE = FIRST_AT + (ROCKETS - 1) * EVERY + FLIGHT + BLOOM_MS;
/** Bursts draw over everything standing near them. */
const SKY_DEPTH = 60;
const GROUND_DEPTH = 3;

/** The crate's wood and the rockets' fuse sparks. */
const CRATE = [0xb07a48, 0x8a5a32, 0x5e3a1e, 0x3e2412];
const SPARKS = [0xffffff, 0xfff0b0, 0xffb040, 0xc0602a];
const SMOKE = [0xd8d0c8, 0xb0a8a0, 0x888078];

interface Rocket {
  at: number;
  p: Pal;
  inner: Pal;
  tx: number;
  ty: number;
  big: boolean;
  seed: number;
  launched: boolean;
  burst: boolean;
  ticks: number;
  /** Its last few spots in the air (screen space), for the trail. */
  trail: [number, number][];
  fly: Ink;
  sky: Ink;
  floor: Ink;
}

export class Skyburst extends Fx {
  private rockets: Rocket[] = [];
  private crate: Ink;
  private lamp: Phaser.GameObjects.Light;
  private glow = 0;
  private readonly bx: number;
  private readonly by: number;
  /** How many rockets have gone for each foe, so they spread over the pack. */
  private aimed = new Map<Hurtbox, number>();

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, LIFE);
    this.bx = c.x + c.dx * 8;
    this.by = c.y + c.dy * 5;
    const stars = starsFor(c.look);
    for (let i = 0; i < ROCKETS; i++) {
      const big = i === ROCKETS - 1;
      this.rockets.push({
        at: FIRST_AT + i * EVERY,
        // The finale burns in the Special's own colours, the rest in the candle's stars in turn.
        p: big ? c.pal : stars[i % stars.length],
        inner: stars[(i + 2) % stars.length],
        tx: c.tx,
        ty: c.ty,
        big,
        seed: Math.floor(Math.random() * 10000),
        launched: false,
        burst: false,
        ticks: 0,
        trail: [],
        fly: this.ink(64, 64),
        sky: this.ink(116, 124),
        floor: this.ink(84, 48),
      });
    }
    this.crate = this.ink(24, 24);
    this.lamp = this.light(this.bx, this.by - 8, 60, 0xffa040, 0.6);
    sound.sizzle(world.pan(this.bx));
  }

  protected step(dt: number): void {
    const { t, world } = this;
    this.glow *= Math.exp(-dt / 260);
    for (const r of this.rockets) {
      if (t < r.at) continue;
      if (!r.launched) this.launch(r);
      const k = (t - r.at) / FLIGHT;
      if (k < 1) {
        this.drawFlight(r, k);
        continue;
      }
      if (!r.burst) this.burst(r);
      const s = t - r.at - FLIGHT;
      while (r.ticks < GLITTER_TICKS && s >= GLITTER_EVERY * (r.ticks + 1)) {
        r.ticks++;
        strikeGround(world, r.tx, r.ty, BURST_R * (r.big ? FINALE : 1), { damage: GLITTER_DAMAGE, heavy: false, knock: 10, fromX: r.tx, fromY: r.ty });
      }
      this.drawBurst(r, s);
    }
    this.drawCrate();
    // Before the first burst the lamp is the fuse's glow at the crate; then it lights the sky over the foes.
    if (this.rockets[0].burst) {
      this.lamp.setPosition(this.c.tx, this.c.ty - 20);
      this.lamp.radius = 150;
      this.lamp.intensity = 0.4 + this.glow * 2.6;
    }
    if (t > LIFE - 300) this.lamp.intensity *= clamp01((LIFE - t) / 300);
  }

  /** The foe this rocket goes for: one fewest rockets have gone for, nearest the aim; or a spot in the area if none are there. */
  private pick(r: Rocket): void {
    const { c, world } = this;
    const foes = world.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - c.tx, h.y - c.ty) <= SEEK_R);
    if (foes.length) {
      const near = (h: Hurtbox) => Math.hypot(h.x - c.tx, h.y - c.ty);
      foes.sort((a, b) => (this.aimed.get(a) ?? 0) - (this.aimed.get(b) ?? 0) || near(a) - near(b));
      const h = foes[0];
      this.aimed.set(h, (this.aimed.get(h) ?? 0) + 1);
      r.tx = h.x;
      r.ty = h.y;
      return;
    }
    const a = hash(r.seed, 1) * Math.PI * 2;
    const d = Math.sqrt(hash(r.seed, 2)) * SEEK_R * 0.6;
    r.tx = c.tx + Math.cos(a) * d;
    r.ty = c.ty + Math.sin(a) * d * GROUND;
  }

  private launch(r: Rocket): void {
    const { world } = this;
    r.launched = true;
    this.pick(r);
    const [mx, my] = this.mouth(this.rockets.indexOf(r));
    sound.rocketWhistle(world.pan(this.bx));
    world.debris(SMOKE, mx, my, 4, this.by + 2, 'spores');
    world.debris(SPARKS, mx, my, 5, this.by + 2, 'burst');
    bloom(world, mx, my, 0xffc060, 0.6, 220, this.by + 2, 0.7);
  }

  /** Where rocket i stands in the crate: the top of its tube. */
  private mouth(i: number): [number, number] {
    const col = i % 3;
    const row = Math.floor(i / 3);
    return [this.bx - 4 + col * 4, this.by - 11 + row * 2];
  }

  /** The rocket climbing: up first, then curving over to its foe, on a hissing trail of sparks. */
  private drawFlight(r: Rocket, k: number): void {
    const [mx, my] = this.mouth(this.rockets.indexOf(r));
    // On the ground it moves late (k²), in the air early (ease out): so it leaps up, then leans over.
    const e = k * k;
    const gx = mx + (r.tx - mx) * e;
    const gy = this.by + (r.ty - this.by) * e;
    const h = this.by - my + (BURST_H - (this.by - my)) * (1 - (1 - k) * (1 - k));
    const x = gx + Math.sin(k * 17 + r.seed) * 0.8 * (1 - k);
    const y = gy - h;
    r.trail.unshift([x, y]);
    if (r.trail.length > 6) r.trail.pop();
    const g = r.fly.begin(x, y, Math.max(gy, this.by) + 2);
    // The trail: a line of sparks thinning back, flickering.
    for (let i = 0; i < r.trail.length - 1; i++) {
      const [x0, y0] = r.trail[i];
      const [x1, y1] = r.trail[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let j = 0; j < n; j++) {
        const f = (i + j / n) / r.trail.length;
        const px = x0 + ((x1 - x0) * j) / n + (hash(i, j, r.seed + Math.floor(this.t / 40)) - 0.5) * f * 3;
        const py = y0 + ((y1 - y0) * j) / n + f * 1.5;
        if (dither(Math.round(px), Math.round(py)) < 1 - f * 0.8) g.put(px, py, SPARKS[Math.min(3, Math.floor(f * 4))]);
      }
    }
    // The rocket: a paper body in its colour, nose ahead, the burning end white.
    const [lx, ly] = r.trail[1] ?? [x, y + 1];
    const d = Math.hypot(x - lx, y - ly) || 1;
    const ux = (x - lx) / d;
    const uy = (y - ly) / d;
    for (let i = -2; i <= 1; i++) g.put(x + ux * i, y + uy * i, i === 1 ? r.p.core : i === -2 ? 0xffffff : i < 0 ? r.p.mid : r.p.hot);
    g.put(x + ux * 2, y + uy * 2, r.p.deep);
    g.end();
    // Its foe's ground marked faintly, firmer as it nears.
    const f = r.floor.begin(r.tx, r.ty, GROUND_DEPTH);
    const R = BURST_R * (r.big ? FINALE : 1);
    circle(f, r.tx, r.ty, R * (1.25 - 0.25 * k), r.p.mid, 0.2 + 0.4 * k);
    f.end();
    if (Math.random() < 0.5) this.world.debris(SPARKS.slice(1), x, y + 1, 1, gy + 2, 'trail');
  }

  /** The rocket bursts over its foe: the blow under it, a flash, a flare, a boom. */
  private burst(r: Rocket): void {
    const { world } = this;
    r.burst = true;
    r.fly.begin(0, 0, 0).end();
    const R = BURST_R * (r.big ? FINALE : 1);
    const sy = r.ty - BURST_H;
    strikeGround(world, r.tx, r.ty, R, { damage: BURST_DAMAGE, heavy: true, knock: BURST_KNOCK, fromX: r.tx, fromY: r.ty - 2 });
    sound.fireworkBurst(world.pan(r.tx));
    flare(world, r.tx, sy, r.big ? 200 : 150, r.p.light, r.big ? 3.5 : 2.5, 600);
    bloom(world, r.tx, sy, r.p.hot, r.big ? 3.4 : 2.6, 520, r.ty + SKY_DEPTH + 1, 0.8);
    bloom(world, r.tx, r.ty, r.p.mid, 1.6, 420, GROUND_DEPTH + 1, 0.35);
    world.debris(r.p.tints, r.tx, sy, r.big ? 16 : 10, r.ty + SKY_DEPTH, 'burst');
    world.cameras.main.shake(r.big ? 200 : 110, r.big ? 0.004 : 0.002);
    this.lamp.setColor(r.p.light);
    this.glow = Math.min(1.4, this.glow + (r.big ? 1 : 0.7));
  }

  /** The chrysanthemum and its glitter, `s` ms after the burst. */
  private drawBurst(r: Rocket, s: number): void {
    const R = SPREAD * (r.big ? FINALE : 1);
    const GR = BURST_R * (r.big ? FINALE : 1);
    const cx = r.tx;
    const cy = r.ty - BURST_H;
    const g = r.sky.begin(cx, cy, r.ty + SKY_DEPTH, 0.5, 48 / 124);
    if (s < BLOOM_MS) {
      // The flash at its heart.
      if (s < 110) {
        const fr = 2 + 3 * (1 - s / 110);
        for (let dy = -fr; dy <= fr; dy++) for (let dx = -fr; dx <= fr; dx++) if (Math.hypot(dx, dy) <= fr) g.put(cx + dx, cy + dy, Math.hypot(dx, dy) < fr * 0.5 ? 0xffffff : r.p.core);
      }
      this.rays(g, r, cx, cy, s, RAYS, R, r.p, 0);
      this.rays(g, r, cx, cy, s, INNER, R * 0.45, r.inner, 7);
      // The glitter: specks drifting down from the burst to the ground under it, twinkling.
      for (let i = 0; i < GLITTER; i++) {
        const s0 = 280 + hash(i, r.seed, 11) * 420;
        const k = (s - s0) / FALL_MS;
        if (k < 0 || k > 1) continue;
        const a = hash(i, r.seed, 12) * Math.PI * 2;
        const d = Math.sqrt(hash(i, r.seed, 13));
        const ax = cx + Math.cos(a) * R * 0.8 * d;
        const ay = cy + Math.sin(a) * R * 0.6 * d;
        const gx = r.tx + Math.cos(a) * GR * d;
        const gy = r.ty + Math.sin(a) * GR * d * GROUND;
        const e = k * k * (3 - 2 * k);
        const x = ax + (gx - ax) * e + Math.sin(s * 0.012 + i) * 1.2;
        const y = ay + (gy - ay) * e;
        if (hash(i, Math.floor(s / 70), r.seed) < 0.3) continue;
        g.put(x, y, hash(i, Math.floor(s / 140), r.seed + 1) < 0.4 ? 0xffffff : r.p.hot);
      }
    }
    g.end();
    // On the ground: the burst's light, a ring flashing out, and the glitter winking where it lands.
    const f = r.floor.begin(r.tx, r.ty, GROUND_DEPTH);
    if (s < 420) {
      pool(f, r.tx, r.ty, GR * 0.85, r.p.hot, r.p.mid, 1 - s / 420, GROUND, 0.35);
      circle(f, r.tx, r.ty, GR * easeOut(s / 220), r.p.hot, 1 - s / 420);
    }
    for (let i = 0; i < GLITTER; i++) {
      const s0 = 280 + hash(i, r.seed, 11) * 420 + FALL_MS;
      const k = (s - s0) / 320;
      if (k < 0 || k > 1) continue;
      const a = hash(i, r.seed, 12) * Math.PI * 2;
      const d = Math.sqrt(hash(i, r.seed, 13));
      const x = r.tx + Math.cos(a) * GR * d;
      const y = r.ty + Math.sin(a) * GR * d * GROUND;
      if (k < 0.3) star(f, x, y, 1, r.p, 1 - k);
      else if (dither(Math.round(x), Math.round(y)) < 1 - k) f.put(x, y, r.p.hot);
    }
    f.end();
  }

  /**
   * One shell of rays: each spark flies out fast and slows, droops as it
   * goes, and leaves a tail that cools from white through the colour to
   * its deep shade; near its end it twinkles and goes out.
   */
  private rays(g: Ink, r: Rocket, cx: number, cy: number, s: number, n: number, reach: number, p: Pal, salt: number): void {
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2 + (hash(i, r.seed, salt) - 0.5) * 0.18;
      const v = reach * (0.8 + 0.35 * hash(i, r.seed, salt + 1));
      const life = BLOOM_MS * (0.6 + 0.35 * hash(i, r.seed, salt + 2)) * (salt ? 0.8 : 1);
      if (s > life) continue;
      const age = s / life;
      // Twinkling out near the end.
      if (age > 0.7 && hash(i, Math.floor(s / 60), r.seed + salt) < (age - 0.7) * 2.5) continue;
      for (let j = 0; j < TAIL; j++) {
        const sj = s - j * TAIL_GAP * (1 + age);
        if (sj < 0) break;
        const rr = v * easeOut(sj / 650);
        const x = cx + Math.cos(th) * rr;
        const y = cy + Math.sin(th) * rr * 0.85 + DROOP * Math.pow(sj / 1000, 2);
        const u = clamp01(j / TAIL + age * 0.65);
        if (j > 0 && dither(Math.round(x), Math.round(y)) >= 1 - j / (TAIL + 1) - age * 0.3) continue;
        g.put(x, y, j === 0 && age < 0.25 ? 0xffffff : shade(p, u));
      }
    }
  }

  /** The crate of rockets at his feet: tubes standing in it, dark once fired, the next one's fuse spitting. */
  private drawCrate(): void {
    const { bx, by, t } = this;
    const fade = clamp01((LIFE - t) / 400);
    const g = this.crate.begin(bx, by, by + 1, 0.5, 0.75);
    const live = this.rockets.findIndex((r) => !r.launched);
    const put = (x: number, y: number, c: number) => {
      if (fade >= 1 || dither(Math.round(x), Math.round(y)) < fade) g.put(x, y, c);
    };
    // Back row of tubes first, then the front row, then the crate's front.
    for (let i = 0; i < ROCKETS; i++) {
      const r = this.rockets[i];
      const [mx, my] = this.mouth(i);
      const base = by - 5;
      for (let y = my; y < base; y++) {
        put(mx - 1, y, r.p.hot);
        put(mx, y, r.p.mid);
        put(mx + 1, y, r.p.deep);
      }
      // A paper band round each tube.
      put(mx - 1, my + 2, 0xf0e8d8);
      put(mx, my + 2, 0xd8d0c0);
      put(mx + 1, my + 2, 0xa8a090);
      if (r.launched) {
        put(mx, my, 0x1a120c);
        put(mx - 1, my, 0x3a2a1a);
        put(mx + 1, my, 0x3a2a1a);
      } else {
        // A paper cap and its fuse.
        put(mx - 1, my, r.p.core);
        put(mx, my, r.p.hot);
        put(mx + 1, my, r.p.mid);
        put(mx, my - 1, 0x3a2a1a);
        if (i === live) put(mx + (Math.floor(t / 50) % 2), my - 2, SPARKS[Math.floor(t / 35) % 3]);
      }
    }
    for (let y = by - 5; y <= by; y++) {
      for (let x = bx - 6; x <= bx + 5; x++) {
        const edge = x === bx - 6 || x === bx + 5;
        const c = edge ? CRATE[3] : y === by - 5 ? CRATE[0] : y === by - 2 ? CRATE[3] : y === by ? CRATE[2] : CRATE[1];
        put(x, y, c);
      }
    }
    // A painted star on its front.
    put(bx - 1, by - 3, 0xf8d870);
    put(bx, by - 4, 0xf8d870);
    put(bx, by - 3, 0xfff0b0);
    put(bx + 1, by - 3, 0xf8d870);
    put(bx, by - 2, 0xc8a040);
    g.end();
    if (live >= 0) {
      const [mx, my] = this.mouth(live);
      this.lamp.setPosition(mx, my - 2);
      this.lamp.intensity = 0.5 + 0.3 * Math.sin(t * 0.05);
      if (Math.random() < 0.3) this.world.debris(SPARKS, mx, my - 2, 1, by + 2, 'trail');
    }
  }
}
