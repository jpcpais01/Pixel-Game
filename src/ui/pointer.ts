// The mouse pointer on a computer: the picked pointer (art/pointers.ts) as
// the page's own cursor, so it moves with the mouse at the system's speed
// with no lag, a lit variant while over anything clickable, and the effects
// it leaves behind on a small overlay canvas drawn at the pointer's own pixel
// size: a ring or a swish on click for the light ones, and for the heavy
// ones a fire that burns on the pointer and streams off it as it moves
// (Ember), a comet's tail, falling stars and two motes circling the
// crystal (Starfall), a breath of frost and drifting snow that shatters into
// ice on a click (Frost), or cherry blossom shedding petals (Sakura). The overlay only draws while something is alive on
// it, and phones and tablets (no mouse) get none of this.

import type Phaser from 'phaser';
import { POINTER_HOT, POINTER_SIZE, pointerDef, pointerPixels, type PointerDef, type PointerId } from '../art/pointers';
import { settings } from '../game/settings';

/** Whether this device has a mouse (or a pen): only then is there a pointer to pick. */
export const hasMouse = typeof matchMedia === 'function' && matchMedia('(any-pointer: fine)').matches;

/** CSS px per art px wanted for the pointer; the real size is whole device px nearest below it. */
const ART_CSS = 2;
/** Most particles alive at once, whatever the mouse does. */
const MAX_PARTS = 320;

// Ember's fire.
const FIRE = ['#fffbe0', '#fff0a0', '#ffd860', '#ffb03a', '#ff8a28', '#f2601e', '#d23a18', '#a82418'];
/** A flame every this many px the pointer moves. */
const FLAME_STEP = 1;
/** Flames a second licking the pointer while it rests. */
const IDLE_FLAMES = 18;
// Starfall's comet, stars and motes.
const TRAIL_S = 0.24;
const TRAIL = ['#ffffff', '#d8faff', '#8ee4ff', '#7aa8ff', '#9a7aff', '#6a46c8'];
const STARS = ['#ffffff', '#9ef0ff', '#c8a8ff', '#9ef0ff', '#ffe08a'];
const STAR_STEP = 6;
const IDLE_STARS = 2.5;
const ORBIT_S = 1.7;
// Frost's snow and mist, Sakura's blossom.
const SNOW_STEP = 7;
const MIST_STEP = 2;
const IDLE_SNOW = 3;
const PETAL_STEP = 9;
const IDLE_PETALS = 1.4;
const PETALS = ['#ffd0e2', '#ffb0cc', '#ff8ab4', '#fff0f6'];

const FLAME = 0;
const EMBER = 1;
const SMOKE = 2;
const SPARK = 3;
const STAR = 4;
const SHARD = 5;
const RING = 6;
const LEAF = 7;
const GLINT = 8;
const SLASH = 9;
const FLASH = 10;
const SPARKLE = 11;
const INK = 12;
const SNOW = 13;
const MIST = 14;
const PETAL = 15;
const SUCK = 16;
const ICE = 17;

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  kind: number;
  /** A per-particle random number: colour pick, sway phase, ring size. */
  seed: number;
  size: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Device px per art px, and CSS px per art px, for the current pixel ratio. */
function metrics(): { k: number; unit: number; dpr: number } {
  const dpr = window.devicePixelRatio || 1;
  const k = Math.max(1, Math.floor(ART_CSS * dpr + 0.01));
  return { k, unit: k / dpr, dpr };
}

const urls = new Map<string, string>();
/** The pointer as a PNG, each art px a k x k block. */
function pointerUrl(id: PointerId, hover: boolean, k: number): string {
  const key = `${id}${hover ? 'h' : ''}${k}`;
  const done = urls.get(key);
  if (done) return done;
  const N = POINTER_SIZE;
  const src = pointerPixels(id, hover);
  const c = document.createElement('canvas');
  c.width = c.height = N * k;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(N * k, N * k);
  for (let y = 0; y < N * k; y++) {
    for (let x = 0; x < N * k; x++) {
      const i = (Math.floor(y / k) * N + Math.floor(x / k)) * 4;
      img.data.set(src.subarray(i, i + 4), (y * N * k + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL('image/png');
  urls.set(key, url);
  return url;
}

/** The CSS cursor for a pointer: crisp at this screen's pixel ratio where the browser allows it. */
function cursorValue(id: PointerId, hover: boolean): string {
  const { k, dpr } = metrics();
  const hot = Math.round((POINTER_HOT * k) / dpr);
  for (const fn of ['image-set', '-webkit-image-set']) {
    const v = `${fn}(url("${pointerUrl(id, hover, k)}") ${dpr}x) ${hot} ${hot}, auto`;
    if (CSS.supports('cursor', v)) return v;
  }
  return `url("${pointerUrl(id, hover, ART_CSS)}") ${POINTER_HOT * ART_CSS} ${POINTER_HOT * ART_CSS}, auto`;
}

class PointerFx {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly style: HTMLStyleElement;
  private def: PointerDef = pointerDef(settings.values.pointer);
  private unit = 1;
  private w = 0;
  private h = 0;
  /** The tip, in overlay px. */
  private x = -99;
  private y = -99;
  private inside = false;
  private parts: Part[] = [];
  private trail: { x: number; y: number; t: number }[] = [];
  /** px moved since the last flame or star. */
  private carry = 0;
  private starCarry = 0;
  private snowCarry = 0;
  private mistCarry = 0;
  private idle = 0;
  private hover = false;
  private raf = 0;
  private last = 0;
  private now = 0;

  constructor(private game: Phaser.Game) {
    this.style = document.createElement('style');
    document.head.appendChild(this.style);
    document.documentElement.classList.add('mlp');

    const c = (this.canvas = document.createElement('canvas'));
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:5;pointer-events:none;image-rendering:pixelated;';
    this.ctx = c.getContext('2d')!;
    document.body.appendChild(c);

    this.measure();
    this.applyCursor();

    settings.watch((s) => {
      if (s.pointer === this.def.id) return;
      this.def = pointerDef(s.pointer);
      this.trail.length = 0;
      this.applyCursor();
      this.wake();
    });
    window.addEventListener('resize', () => this.measure());
    const watchRatio = () => {
      matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener(
        'change',
        () => {
          this.measure();
          this.applyCursor();
          watchRatio();
        },
        { once: true },
      );
    };
    watchRatio();

    const mouse = (e: PointerEvent) => e.pointerType === 'mouse' || e.pointerType === 'pen';
    window.addEventListener('pointermove', (e) => mouse(e) && this.move(e.clientX, e.clientY), { passive: true });
    window.addEventListener('pointerdown', (e) => mouse(e) && this.click(e.clientX, e.clientY), { passive: true });
    // The game hears the mouse as mouse events, which come after pointer events: by the time this one
    // reaches the window, the game has seen the move and knows what's under it.
    window.addEventListener('mousemove', () => this.checkHover(), { passive: true });
    // A press can open or close a menu under a still mouse: look again once it has.
    window.addEventListener('pointerup', (e) => mouse(e) && requestAnimationFrame(() => this.checkHover()), { passive: true });
    document.documentElement.addEventListener('mouseleave', () => {
      this.inside = false;
      this.trail.length = 0;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      } else this.wake();
    });
  }

  private measure(): void {
    this.unit = metrics().unit;
    this.w = Math.ceil(window.innerWidth / this.unit) + 1;
    this.h = Math.ceil(window.innerHeight / this.unit) + 1;
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.canvas.style.width = `${this.w * this.unit}px`;
    this.canvas.style.height = `${this.h * this.unit}px`;
  }

  private applyCursor(): void {
    const id = this.def.id;
    const n = cursorValue(id, false);
    const h = cursorValue(id, true);
    this.style.textContent = [
      `html.mlp, html.mlp * { cursor: ${n} !important; }`,
      `html.mlp.mlp-hover canvas, html.mlp button:not(:disabled), html.mlp a[href], html.mlp select { cursor: ${h} !important; }`,
      'html.mlp input:not([type=button]):not([type=submit]):not([type=range]):not([type=checkbox]), html.mlp textarea { cursor: text !important; }',
    ].join('\n');
  }

  /** Is the mouse over something clickable in the game (anything made with the hand cursor)? */
  private checkHover(): void {
    let on = false;
    for (const s of this.game.scene.getScenes(true)) {
      const over = (s.input as unknown as { _over?: Phaser.GameObjects.GameObject[][] } | undefined)?._over?.[0];
      if (over?.some((o) => o.input?.enabled && o.input.cursor)) {
        on = true;
        break;
      }
    }
    if (on === this.hover) return;
    this.hover = on;
    document.documentElement.classList.toggle('mlp-hover', on);
  }

  private move(cx: number, cy: number): void {
    const x = cx / this.unit;
    const y = cy / this.unit;
    const was = this.inside;
    this.inside = true;
    const dx = x - this.x;
    const dy = y - this.y;
    const d = was ? Math.hypot(dx, dy) : 0;
    this.x = x;
    this.y = y;
    if (this.def.fx === 'ember' && d > 0) {
      // Flames all along the way, so a fast flick leaves a solid streak, not dots.
      this.carry += d;
      const n = Math.min(40, Math.floor(this.carry / FLAME_STEP));
      this.carry -= n * FLAME_STEP;
      for (let i = 0; i < n; i++) {
        const f = (i + 1) / n;
        this.flame(x - dx * (1 - f), y - dy * (1 - f), -dx * 2, -dy * 2, false);
      }
    } else if (this.def.fx === 'frost' && d > 0) {
      // A breath of frost along the way, and now and then a flake drifting down from it.
      this.mistCarry += d;
      this.snowCarry += d;
      for (; this.mistCarry > MIST_STEP; this.mistCarry -= MIST_STEP) {
        const f = Math.random();
        this.add(MIST, x - dx * f + rand(0, 5), y - dy * f + rand(0, 5), rand(-4, 4), rand(-3, 6), rand(0.25, 0.5), Math.random(), 1);
      }
      for (; this.snowCarry > SNOW_STEP; this.snowCarry -= SNOW_STEP) this.snow(x - dx * Math.random() + rand(-2, 6), y - dy * Math.random() + rand(-2, 6));
    } else if (this.def.fx === 'petals' && d > 0) {
      this.snowCarry += d;
      for (; this.snowCarry > PETAL_STEP; this.snowCarry -= PETAL_STEP) this.petal(x - dx * Math.random() + rand(0, 5), y - dy * Math.random() + rand(0, 5), -dx * 0.8, -dy * 0.8);
    } else if (this.def.fx === 'starfall') {
      this.trail.push({ x, y, t: this.now });
      this.starCarry += d;
      while (this.starCarry > STAR_STEP) {
        this.starCarry -= STAR_STEP;
        const f = Math.random();
        this.star(x - dx * f + rand(-3, 3), y - dy * f + rand(-3, 3));
      }
    }
    this.wake();
  }

  private click(cx: number, cy: number): void {
    const x = cx / this.unit;
    const y = cy / this.unit;
    this.x = x;
    this.y = y;
    this.inside = true;
    switch (this.def.fx) {
      case 'ripple':
        this.add(RING, x, y, 0, 0, 0.28, 7, 1);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          this.add(GLINT, x + Math.cos(a) * 3, y + Math.sin(a) * 3, Math.cos(a) * 40, Math.sin(a) * 40, 0.16, 0, 1);
        }
        break;
      case 'slash':
        this.add(SLASH, x + 5, y + 5, 0, 0, 0.22, 0, 1);
        for (let i = 0; i < 3; i++) this.add(GLINT, x + rand(10, 13), y + rand(-1, 3), rand(10, 40), rand(-30, 10), rand(0.15, 0.25), 0, 1);
        break;
      case 'leaves':
        for (let i = 0; i < 6; i++) this.add(LEAF, x + rand(1, 7), y + rand(1, 7), rand(-30, 30), rand(-40, -12), rand(0.9, 1.4), Math.random(), 1);
        this.add(RING, x, y, 0, 0, 0.2, 4, 1);
        break;
      case 'ember':
        this.add(RING, x, y, 0, 0, 0.24, 10, 1);
        this.add(FLASH, x, y, 0, 0, 0.12, 0, 1);
        for (let i = 0; i < 22; i++) {
          const a = Math.random() * Math.PI * 2;
          const v = rand(45, 120);
          this.add(SPARK, x, y, Math.cos(a) * v, Math.sin(a) * v - 20, rand(0.3, 0.6), Math.random(), 1);
        }
        for (let i = 0; i < 10; i++) this.flame(x + rand(-3, 3), y + rand(-2, 4), rand(-20, 20), rand(-40, -10), false);
        break;
      case 'sparkle':
        // A puff of gold twinkles off the star.
        this.add(FLASH, x + 3, y + 3, 0, 0, 0.14, 0, 1);
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2;
          const v = rand(30, 85);
          this.add(SPARKLE, x + 3, y + 3, Math.cos(a) * v, Math.sin(a) * v, rand(0.35, 0.7), Math.random(), 1);
        }
        break;
      case 'ink':
        // A splash of ink from the nib: drops thrown up and falling.
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI / 2 + rand(-1.3, 1.3);
          const v = rand(25, 70);
          this.add(INK, x + rand(0, 2), y + rand(0, 2), Math.cos(a) * v, Math.sin(a) * v, rand(0.45, 0.75), Math.random(), Math.random() < 0.4 ? 2 : 1);
        }
        this.add(RING, x, y, 0, 0, 0.2, 4, 1);
        break;
      case 'frost':
        // The ice shatters: shards flung out and falling, a ring of rime, a flurry.
        this.add(RING, x, y, 0, 0, 0.32, 11, 1);
        this.add(FLASH, x, y, 0, 0, 0.12, 0, 1);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + rand(-0.2, 0.2);
          const v = rand(50, 100);
          this.add(ICE, x, y, Math.cos(a) * v, Math.sin(a) * v - 15, rand(0.35, 0.6), Math.random(), 1);
        }
        for (let i = 0; i < 6; i++) this.snow(x + rand(-8, 8), y + rand(-8, 4));
        break;
      case 'petals':
        this.add(RING, x, y, 0, 0, 0.3, 8, 1);
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2;
          const v = rand(25, 60);
          this.petal(x + 2, y + 2, Math.cos(a) * v, Math.sin(a) * v - 20);
        }
        break;
      case 'void':
        // Light is drawn in from all round into the tip, then a dark ring breaks outward.
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + rand(-0.2, 0.2);
          const r = rand(9, 14);
          const life = rand(0.22, 0.32);
          this.add(SUCK, x + Math.cos(a) * r, y + Math.sin(a) * r, (-Math.cos(a) * r) / life, (-Math.sin(a) * r) / life, life, Math.random(), 1);
        }
        this.add(RING, x, y, 0, 0, 0.8, 10, 0.5);
        break;
      case 'starfall':
        this.add(RING, x, y, 0, 0, 0.4, 13, 0);
        this.add(RING, x, y, 0, 0, 0.55, 8, 0.5);
        this.add(FLASH, x, y, 0, 0, 0.16, 0, 1);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + rand(-0.15, 0.15);
          const v = rand(60, 95);
          this.add(SHARD, x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.35, 0.5), Math.random(), 1);
        }
        for (let i = 0; i < 6; i++) this.star(x + rand(-8, 8), y + rand(-8, 8));
        break;
    }
    this.wake();
  }

  private add(kind: number, x: number, y: number, vx: number, vy: number, life: number, seed: number, size: number): void {
    if (this.parts.length >= MAX_PARTS) return;
    this.parts.push({ x, y, vx, vy, age: 0, life, kind, seed, size });
  }

  /** A flame from the pointer's body: (x, y) is the tip; it rises, cooling from white to red. */
  private flame(x: number, y: number, pushX: number, pushY: number, small: boolean): void {
    // Somewhere on the arrow's body: a triangle down the left edge.
    const oy = rand(1, 9);
    const ox = rand(0, Math.min(oy * 0.8, 5));
    const ember = !small && Math.random() < 0.22;
    this.add(
      ember ? EMBER : FLAME,
      x + ox,
      y + oy,
      rand(-7, 7) + pushX * 0.05,
      (ember ? rand(-38, -18) : rand(-34, -14)) + pushY * 0.05,
      ember ? rand(0.8, 1.4) : small ? rand(0.18, 0.36) : rand(0.32, 0.6),
      Math.random(),
      !ember && Math.random() < (small ? 0.3 : 0.7) ? 2 : 1,
    );
  }

  private snow(x: number, y: number): void {
    this.add(SNOW, x, y, rand(-4, 4), rand(8, 16), rand(1.1, 1.8), Math.random(), Math.random() < 0.3 ? 2 : 1);
  }

  private petal(x: number, y: number, vx: number, vy: number): void {
    this.add(PETAL, x, y, vx * 0.3 + rand(-8, 8), vy * 0.3 + rand(-6, 4), rand(1.3, 2), Math.random(), 1);
  }

  private star(x: number, y: number): void {
    this.add(STAR, x, y, rand(-5, 5), rand(6, 20), rand(0.7, 1.2), Math.random(), 1);
  }

  private wake(): void {
    if (this.raf || document.hidden) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private busy(): boolean {
    return this.parts.length > 0 || this.trail.length > 0 || (this.inside && this.def.heavy);
  }

  private tick = (time: number): void => {
    this.raf = 0;
    const dt = Math.min(0.05, Math.max(0, (time - this.last) / 1000));
    this.last = time;
    this.now += dt;
    this.step(dt);
    this.draw();
    if (this.busy()) this.raf = requestAnimationFrame(this.tick);
  };

  private step(dt: number): void {
    const fx = this.def.fx;
    // The heavy ones stay alive while the mouse rests: Ember keeps burning, Starfall sheds the odd star.
    if (this.inside) {
      if (fx === 'ember') {
        this.idle += dt * IDLE_FLAMES;
        for (; this.idle >= 1; this.idle--) this.flame(this.x, this.y, 0, 0, true);
      } else if (fx === 'frost') {
        this.idle += dt * IDLE_SNOW;
        for (; this.idle >= 1; this.idle--) this.snow(this.x + rand(-2, 10), this.y + rand(0, 10));
      } else if (fx === 'petals') {
        // Now and then a petal lets go of the blossom.
        this.idle += dt * IDLE_PETALS;
        for (; this.idle >= 1; this.idle--) this.petal(this.x + rand(1, 5), this.y + rand(1, 5), 0, 0);
      } else if (fx === 'starfall') {
        this.idle += dt * IDLE_STARS;
        for (; this.idle >= 1; this.idle--) this.star(this.x + rand(-2, 12), this.y + rand(-2, 12));
      }
    }
    while (this.trail.length && this.now - this.trail[0].t > TRAIL_S) this.trail.shift();

    const parts = this.parts;
    let n = 0;
    for (const p of parts) {
      p.age += dt;
      if (p.age >= p.life) {
        // Some flames leave a wisp of smoke.
        if (p.kind === FLAME && p.size === 2 && Math.random() < 0.2 && parts.length < MAX_PARTS) {
          parts[n++] = { x: p.x, y: p.y, vx: rand(-4, 4), vy: rand(-14, -8), age: 0, life: rand(0.6, 0.9), kind: SMOKE, seed: 0, size: 2 };
        }
        continue;
      }
      switch (p.kind) {
        case FLAME:
          p.vx *= 1 - dt * 3;
          p.vy -= 20 * dt;
          break;
        case EMBER:
          p.vx = Math.sin(p.age * 7 + p.seed * 6) * 10;
          p.vy *= 1 - dt * 0.6;
          break;
        case SMOKE:
          p.vx *= 1 - dt;
          break;
        case SPARK:
          p.vx *= 1 - dt * 3.5;
          p.vy = p.vy * (1 - dt * 3.5) + 90 * dt;
          break;
        case SHARD:
          p.vx *= 1 - dt * 4;
          p.vy *= 1 - dt * 4;
          break;
        case LEAF:
          p.vx = p.vx * (1 - dt * 2.5) + Math.sin(p.age * 6 + p.seed * 6) * 40 * dt;
          p.vy = Math.min(p.vy + 70 * dt, 22);
          break;
        case GLINT:
        case SPARKLE:
          p.vx *= 1 - dt * (p.kind === GLINT ? 6 : 4);
          p.vy *= 1 - dt * (p.kind === GLINT ? 6 : 4);
          break;
        case INK:
          p.vx *= 1 - dt * 1.5;
          p.vy += 140 * dt;
          break;
        case ICE:
          p.vx *= 1 - dt * 2.5;
          p.vy = p.vy * (1 - dt * 2.5) + 110 * dt;
          break;
        case SNOW:
          p.vx = Math.sin(p.age * 3 + p.seed * 6) * 7;
          break;
        case MIST:
          p.vx *= 1 - dt * 3;
          p.vy *= 1 - dt * 3;
          break;
        case PETAL:
          // Drifts down, swinging side to side as it goes.
          p.vx = p.vx * (1 - dt * 1.8) + Math.sin(p.age * 4 + p.seed * 6) * 30 * dt;
          p.vy = Math.min(p.vy + 30 * dt, 14);
          break;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      parts[n++] = p;
    }
    parts.length = n;
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    const dot = (x: number, y: number, c: string, s = 1) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.floor(x), Math.floor(y), s, s);
    };

    // Smoke and leaves sit on the scene as they are; everything else is light, so it adds.
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.parts) {
      const f = p.age / p.life;
      if (p.kind === SMOKE) {
        ctx.globalAlpha = 0.35 * (1 - f);
        dot(p.x, p.y, '#3a3044', 2);
      } else if (p.kind === LEAF) {
        ctx.globalAlpha = f > 0.75 ? (1 - f) * 4 : 1;
        const c = p.seed < 0.4 ? '#b8e070' : p.seed < 0.8 ? '#7ab048' : '#e0b848';
        // A leaf turning over as it falls: wide, then edge on.
        const flat = Math.sin(p.age * 9 + p.seed * 9) > -0.3;
        dot(p.x, p.y, c);
        dot(p.x + (flat ? 1 : 0), p.y + (flat ? 0 : 1), flat ? c : '#4a7a2a');
      } else if (p.kind === INK) {
        ctx.globalAlpha = f > 0.7 ? (1 - f) / 0.3 : 1;
        dot(p.x, p.y, '#1a2460', p.size);
        // A glint of the light on a big drop.
        if (p.size > 1) dot(p.x, p.y, '#6a8ae0');
      } else if (p.kind === PETAL) {
        ctx.globalAlpha = f > 0.8 ? (1 - f) * 5 : 1;
        const c = PETALS[Math.floor(p.seed * PETALS.length)];
        // A petal tumbling: open (three pixels and a deeper pink tip), then edge on, then its underside.
        const turn = Math.sin(p.age * 5 + p.seed * 9);
        dot(p.x, p.y, c);
        if (turn > 0.3) {
          dot(p.x + 1, p.y, c);
          dot(p.x, p.y + 1, c);
          dot(p.x + 1, p.y + 1, '#e8609a');
        } else if (turn < -0.3) dot(p.x + 1, p.y + 1, '#e8609a');
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';

    if (this.trail.length > 1) this.drawTrail(dot);

    for (const p of this.parts) {
      const f = p.age / p.life;
      switch (p.kind) {
        case FLAME: {
          const c = FIRE[Math.min(FIRE.length - 1, Math.floor(f * FIRE.length))];
          dot(p.x, p.y, c, f < 0.45 ? p.size : 1);
          break;
        }
        case EMBER: {
          // Flickers as it rises, and dims to red at the end.
          const flick = Math.floor(p.age * 14 + p.seed * 5) % 3;
          dot(p.x, p.y, f > 0.7 ? '#a82418' : flick === 0 ? '#fff0a0' : flick === 1 ? '#ffb03a' : '#ff7a22');
          break;
        }
        case SPARK: {
          const c = f < 0.25 ? '#ffffff' : f < 0.5 ? '#ffe070' : f < 0.75 ? '#ff9a30' : '#c83a18';
          dot(p.x, p.y, c);
          // A short streak behind it while it's fast.
          if (Math.abs(p.vx) + Math.abs(p.vy) > 50) dot(p.x - p.vx * 0.016, p.y - p.vy * 0.016, f < 0.5 ? '#ff9a30' : '#7a1a10');
          break;
        }
        case STAR: {
          const c = STARS[Math.floor(p.seed * STARS.length)];
          ctx.globalAlpha = f > 0.7 ? (1 - f) / 0.3 : 1;
          // Twinkles: a cross now and then, a point between.
          const lit = Math.floor(p.age * 9 + p.seed * 7) % 3 === 0;
          dot(p.x, p.y, c);
          if (lit) {
            ctx.globalAlpha *= 0.6;
            dot(p.x - 1, p.y, c);
            dot(p.x + 1, p.y, c);
            dot(p.x, p.y - 1, c);
            dot(p.x, p.y + 1, c);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case SHARD: {
          const c = f < 0.3 ? '#ffffff' : f < 0.65 ? '#9ef0ff' : '#9a7aff';
          dot(p.x, p.y, c);
          dot(p.x - p.vx * 0.02, p.y - p.vy * 0.02, f < 0.5 ? '#7aa8ff' : '#5a3aa8');
          break;
        }
        case RING:
          this.drawRing(p, f, dot);
          break;
        case GLINT:
          dot(p.x, p.y, f < 0.5 ? '#ffffff' : this.def.fx === 'ripple' ? '#c9cce4' : '#9ef0ff');
          break;
        case SLASH:
          this.drawSlash(p, f, dot);
          break;
        case SPARKLE: {
          const c = f < 0.3 ? '#ffffff' : p.seed < 0.5 ? '#ffe08a' : '#ffb84a';
          ctx.globalAlpha = f > 0.6 ? (1 - f) / 0.4 : 1;
          dot(p.x, p.y, c);
          // Twinkles into a little cross now and then.
          if (Math.floor(p.age * 12 + p.seed * 5) % 3 === 0) {
            ctx.globalAlpha *= 0.55;
            dot(p.x - 1, p.y, c);
            dot(p.x + 1, p.y, c);
            dot(p.x, p.y - 1, c);
            dot(p.x, p.y + 1, c);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case SNOW: {
          ctx.globalAlpha = f > 0.75 ? (1 - f) * 4 : f < 0.1 ? f * 10 : 1;
          const c = p.seed < 0.6 ? '#ffffff' : '#bff4ff';
          if (p.size > 1) {
            // A proper flake: a little six-armed cross.
            ctx.globalAlpha *= 0.85;
            dot(p.x, p.y, '#ffffff');
            dot(p.x - 1, p.y, c);
            dot(p.x + 1, p.y, c);
            dot(p.x, p.y - 1, c);
            dot(p.x, p.y + 1, c);
          } else dot(p.x, p.y, c);
          ctx.globalAlpha = 1;
          break;
        }
        case MIST:
          ctx.globalAlpha = 0.55 * (1 - f);
          dot(p.x, p.y, f < 0.4 ? '#d8faff' : '#5ab8e0');
          ctx.globalAlpha = 1;
          break;
        case ICE: {
          const c = f < 0.3 ? '#ffffff' : f < 0.7 ? '#bff4ff' : '#4a9ad8';
          dot(p.x, p.y, c);
          dot(p.x - p.vx * 0.018, p.y - p.vy * 0.018, f < 0.5 ? '#7ad8f6' : '#2a5a9a');
          break;
        }
        case SUCK: {
          // Bright as it nears the tip.
          const c = f < 0.4 ? '#6a2aa8' : f < 0.75 ? '#c070ff' : '#f4d8ff';
          dot(p.x, p.y, c);
          dot(p.x - p.vx * 0.02, p.y - p.vy * 0.02, '#3a1468');
          break;
        }
        case FLASH: {
          const c = this.def.fx === 'ember' || this.def.fx === 'sparkle' ? '#fff0a0' : '#ffffff';
          const r = f < 0.5 ? 3 : 2;
          for (let i = -r; i <= r; i++) {
            dot(p.x + i, p.y, c);
            if (i) dot(p.x, p.y + i, c);
          }
          break;
        }
      }
    }

    if (this.inside && this.def.fx === 'starfall') this.drawMotes(dot);
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Starfall's comet: the path of the last fraction of a second, white at the head, violet at the end. */
  private drawTrail(dot: (x: number, y: number, c: string, s?: number) => void): void {
    const t = this.trail;
    for (let i = t.length - 1; i > 0; i--) {
      const age = (this.now - t[i].t) / TRAIL_S;
      const c = TRAIL[Math.min(TRAIL.length - 1, Math.floor(age * TRAIL.length))];
      const thick = age < 0.3;
      // A pixel line from one point to the next.
      let x0 = Math.floor(t[i - 1].x);
      let y0 = Math.floor(t[i - 1].y);
      const x1 = Math.floor(t[i].x);
      const y1 = Math.floor(t[i].y);
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (let guard = 0; guard < 600; guard++) {
        dot(x0, y0, c);
        if (thick) dot(x0 + 1, y0 + 1, TRAIL[Math.min(TRAIL.length - 1, Math.floor(age * TRAIL.length) + 2)]);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y0 += sy;
        }
      }
    }
  }

  /** A pixel circle growing to its size (the seed) as it fades. */
  private drawRing(p: Part, f: number, dot: (x: number, y: number, c: string, s?: number) => void): void {
    // A second ring can wait a moment before it starts (`size` 0.5 is half its life late).
    const start = p.size < 1 ? 0.3 : 0;
    if (f < start) return;
    const g = (f - start) / (1 - start);
    const r = Math.max(1, Math.round(p.seed * (1 - (1 - g) * (1 - g))));
    const fx = this.def.fx;
    const pal =
      fx === 'ember' ? ['#ffe070', '#ff8a28', '#a82418'] : fx === 'frost' ? ['#ffffff', '#9ef0ff', '#3a8ad0'] : fx === 'petals' ? ['#fff0f6', '#ff9ec4', '#b04a7a'] : fx === 'ink' ? ['#8ab4ff', '#4a68c8', '#1a2460'] : fx === 'void' ? ['#f0c8ff', '#a050f0', '#3a1468'] : fx === 'starfall' ? (p.size < 1 ? ['#e0c8ff', '#9a7aff', '#4a2a90'] : ['#ffffff', '#8ee4ff', '#5a6ac8']) : fx === 'leaves' ? ['#e0f8a0', '#7ab048', '#3a5a20'] : ['#ffffff', '#c9cce4', '#6a6e9a'];
    const c = pal[Math.min(2, Math.floor(g * 3))];
    // Midpoint circle.
    let x = r;
    let y = 0;
    let err = 1 - r;
    while (x >= y) {
      for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) dot(p.x + a, p.y + b, c);
      y++;
      if (err < 0) err += 2 * y + 1;
      else {
        x--;
        err += 2 * (y - x) + 1;
      }
    }
  }

  /** The Blade's swish: an arc over the tip, its head sweeping left to right and its tail following. */
  private drawSlash(p: Part, f: number, dot: (x: number, y: number, c: string, s?: number) => void): void {
    const a0 = Math.PI * 1.05;
    const a1 = Math.PI * 1.95;
    const head = a0 + (a1 - a0) * Math.min(1, f * 1.8);
    const tail = a0 + (a1 - a0) * Math.max(0, f * 1.8 - 0.8);
    const R = 8;
    for (let a = tail; a <= head; a += 0.07) {
      const near = (head - a) / (a1 - a0);
      const c = near < 0.15 ? '#ffffff' : near < 0.4 ? '#c8f8ff' : '#5ab8e0';
      dot(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, c);
      if (near < 0.3) dot(p.x + Math.cos(a) * (R - 1), p.y + Math.sin(a) * (R - 1), '#7ad8f0');
    }
  }

  /** Two motes circling Starfall's crystal like a ring round a planet, each with a short tail. */
  private drawMotes(dot: (x: number, y: number, c: string, s?: number) => void): void {
    const cx = this.x + 5;
    const cy = this.y + 5;
    // The ring's long axis lies across the crystal, its short one along it.
    const ux = Math.SQRT1_2;
    const uy = -Math.SQRT1_2;
    for (let m = 0; m < 2; m++) {
      for (let k = 3; k >= 0; k--) {
        const a = (this.now / ORBIT_S) * Math.PI * 2 + m * Math.PI - k * 0.22;
        const along = Math.cos(a) * 8;
        const across = Math.sin(a) * 3;
        const x = cx + ux * along + ux * across;
        const y = cy + uy * along - uy * across;
        // Dimmer while behind the crystal.
        const back = Math.sin(a) < 0;
        const c = k === 0 ? (back ? '#8ee4ff' : '#ffffff') : k === 1 ? '#8ee4ff' : k === 2 ? '#9a7aff' : '#4a2a90';
        dot(x, y, c);
      }
    }
  }
}

let fx: PointerFx | null = null;

/** Use the picked pointer from now on (once, at startup; does nothing without a mouse). */
export function installPointer(game: Phaser.Game): void {
  if (fx || !hasMouse) return;
  fx = new PointerFx(game);
}
