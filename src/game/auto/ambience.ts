// The life in Auto Battle's dusk sky, kept quiet so it never pulls the eye
// from the board: now and then a small flock of birds crosses the warm low
// sky, a falling star streaks overhead, a few stars twinkle, and long wisps
// of cloud drift over the cloud sea. Everything is single pixels on one
// Graphics (and three wisp images), in page px, under the board.

import Phaser from 'phaser';

/** Seconds between flocks, and the first one's wait. */
const FLOCK_EVERY = [9, 18];
const FLOCK_FIRST = [3, 6];
/** Birds in a flock, their speed (page px a second) and wingbeat (seconds). */
const FLOCK_SIZE = [2, 5];
const BIRD_SPEED = [13, 21];
const WINGBEAT = 0.42;
/** Seconds between falling stars, and how long one lasts. */
const STAR_EVERY = [16, 34];
const STAR_SEC = 0.55;
const TWINKLES = 9;
const WISPS = 3;
/** The sky's horizon, as a share of the page's height (as the backdrop paints it). */
const HORIZON = 0.62;

const BIRD_NEAR = 0x1a1030;
const BIRD_FAR = 0x5a3a64;
const STAR = 0xfff4d6;
const STAR_TAIL = 0xb8c0ff;
const WISP = [0xd89a9a, 0xb07a96, 0xe0a890];

const rnd = (r: number[]) => r[0] + Math.random() * (r[1] - r[0]);

/** A bird's wings by frame, as pixels round its body (up, level, down, level). */
const WINGS: [number, number][][] = [
  [[-2, -2], [-1, -1], [1, -1], [2, -2]],
  [[-2, -1], [-1, 0], [1, 0], [2, -1]],
  [[-2, 1], [-1, 0], [1, 0], [2, 1]],
  [[-2, -1], [-1, 0], [1, 0], [2, -1]],
];
/** A far bird is a three-pixel flicker. */
const FAR_WINGS: [number, number][][] = [
  [[-1, -1], [1, -1]],
  [[-1, 0], [1, 0]],
];

interface Bird {
  x: number;
  y: number;
  phase: number;
  bob: number;
}

interface Flock {
  birds: Bird[];
  v: number;
  far: boolean;
  t: number;
}

export class AutoAmbience {
  private g: Phaser.GameObjects.Graphics;
  private wisps: { img: Phaser.GameObjects.Image; v: number }[] = [];
  private flocks: Flock[] = [];
  private nextFlock = rnd(FLOCK_FIRST);
  private nextStar = rnd(STAR_EVERY);
  private star: { x: number; y: number; vx: number; vy: number; t: number } | null = null;
  private twinkles: { x: number; y: number; phase: number; rate: number }[] = [];
  private w = 0;
  private h = 0;
  private t = 0;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < WISPS; i++) {
      const img = scene.add.image(0, 0, wispTexture(scene, i)).setOrigin(0, 0.5).setTint(WISP[i % WISP.length]).setAlpha(0.32);
      this.wisps.push({ img, v: 2.5 + i * 1.6 });
    }
    this.g = scene.add.graphics();
  }

  /** The page's size changed: spread the wisps and the twinkling stars over it again. */
  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    const horizon = h * HORIZON;
    this.wisps.forEach((wp, i) => {
      wp.img.setPosition(Math.round(((i * 0.37 + 0.1) % 1) * w), Math.round(horizon + (h - horizon) * (0.18 + i * 0.27)));
    });
    this.twinkles = [];
    for (let i = 0; i < TWINKLES; i++)
      this.twinkles.push({ x: Math.floor(Math.random() * w), y: Math.floor(Math.pow(Math.random(), 1.6) * horizon * 0.7), phase: Math.random() * 6.28, rate: 0.6 + Math.random() * 1.2 });
  }

  update(dt: number): void {
    if (!this.w) return;
    this.t += dt;
    const g = this.g.clear();
    const { w, h } = this;
    const horizon = h * HORIZON;

    for (const wp of this.wisps) {
      wp.img.x += wp.v * dt;
      if (wp.img.x > w) wp.img.x = -wp.img.width;
    }

    // Twinkles: a soft pulse, now and then a small cross at the peak.
    for (const s of this.twinkles) {
      const k = 0.5 + 0.5 * Math.sin(this.t * s.rate + s.phase);
      g.fillStyle(STAR, 0.25 + k * 0.6).fillRect(s.x, s.y, 1, 1);
      if (k > 0.93) {
        g.fillStyle(STAR_TAIL, (k - 0.93) * 6).fillRect(s.x - 1, s.y, 1, 1).fillRect(s.x + 1, s.y, 1, 1).fillRect(s.x, s.y - 1, 1, 1).fillRect(s.x, s.y + 1, 1, 1);
      }
    }

    // A falling star: a bright head and a tail thinning behind it.
    if ((this.nextStar -= dt) <= 0) {
      this.nextStar = rnd(STAR_EVERY);
      const left = Math.random() < 0.5;
      this.star = { x: w * (0.15 + Math.random() * 0.7), y: horizon * (0.05 + Math.random() * 0.3), vx: (left ? -1 : 1) * (90 + Math.random() * 40), vy: 34 + Math.random() * 20, t: 0 };
    }
    if (this.star) {
      const s = this.star;
      s.t += dt;
      const k = s.t / STAR_SEC;
      if (k >= 1) this.star = null;
      else {
        const life = Math.sin(k * Math.PI);
        const len = 9;
        for (let i = 0; i <= len; i++) {
          const f = i / len;
          const x = Math.round(s.x + s.vx * (s.t - f * 0.07));
          const y = Math.round(s.y + s.vy * (s.t - f * 0.07));
          g.fillStyle(i === 0 ? STAR : STAR_TAIL, life * (1 - f) * (i === 0 ? 1 : 0.7)).fillRect(x, y, 1, 1);
        }
      }
    }

    // Flocks: in from one side, across the warm low sky, out the other.
    if ((this.nextFlock -= dt) <= 0) {
      this.nextFlock = rnd(FLOCK_EVERY);
      this.flocks.push(this.flock());
    }
    this.flocks = this.flocks.filter((f) => {
      f.t += dt;
      let inView = false;
      for (const b of f.birds) {
        b.x += f.v * dt;
        if (b.x > -6 && b.x < w + 6) inView = true;
        const beat = Math.floor(((this.t + b.phase) / WINGBEAT) * (f.far ? 2 : 4)) % (f.far ? 2 : 4);
        const bx = Math.round(b.x);
        const by = Math.round(b.y + Math.sin(this.t * 1.7 + b.phase * 3) * b.bob);
        g.fillStyle(f.far ? BIRD_FAR : BIRD_NEAR, f.far ? 0.8 : 0.95).fillRect(bx, by, 1, 1);
        for (const [dx, dy] of (f.far ? FAR_WINGS : WINGS)[beat]) g.fillRect(bx + (f.v < 0 ? -dx : dx), by + dy, 1, 1);
      }
      // Gone once every bird has crossed (and given the flock time to come in).
      return inView || f.t < 2;
    });
  }

  /** A loose V of birds just off one side, heading across. */
  private flock(): Flock {
    const fromLeft = Math.random() < 0.5;
    const far = Math.random() < 0.4;
    const n = Math.round(rnd(FLOCK_SIZE));
    const v = rnd(BIRD_SPEED) * (far ? 0.6 : 1) * (fromLeft ? 1 : -1);
    const horizon = this.h * HORIZON;
    const y0 = horizon * (far ? 0.6 + Math.random() * 0.25 : 0.35 + Math.random() * 0.35);
    const x0 = fromLeft ? -8 : this.w + 8;
    const gap = far ? 4 : 6;
    const birds: Bird[] = [];
    for (let i = 0; i < n; i++) {
      // Leader in front, the rest trailing back on alternate sides.
      const rank = Math.ceil(i / 2);
      const side = i % 2 ? -1 : 1;
      birds.push({
        x: x0 - Math.sign(v) * rank * gap + (Math.random() - 0.5) * 2,
        y: y0 + side * rank * (gap * 0.55) + (Math.random() - 0.5) * 2,
        phase: Math.random() * WINGBEAT * 3,
        bob: far ? 0.5 : 1 + Math.random(),
      });
    }
    return { birds, v, far, t: 0 };
  }
}

/** A long, thin wisp of cloud: soft at its ends and edges, dithered, white (tinted in use). */
function wispTexture(scene: Phaser.Scene, i: number): string {
  const key = `ab_wisp_${i}`;
  if (scene.textures.exists(key)) return key;
  const w = 70 + i * 22;
  const h = 5 + (i % 2) * 2;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const v = (y - (h - 1) / 2) / (h / 2);
      // Fat in the middle, tapering to points, the top edge a little wavy.
      const body = Math.sin(u * Math.PI) * (1 - v * v) * (0.85 + 0.15 * Math.sin(u * 17 + i * 2));
      if (body <= (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16) continue;
      const o = (y * w + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
      img.data[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, canvas);
  return key;
}
