// Hushfall's own living parts (see ../types.ts LandExtra): the snow falling
// softly and settling, the wanderer's footprints filling in behind them,
// steam rising off the hot springs, smoke from a cabin's chimney, and the
// sun glinting on the powder. All of it a hundred-odd small sprites round
// the view, pooled and reused: no full-screen layers.

import Phaser from 'phaser';
import type { WorldScene } from '../../../scenes/WorldScene';
import type { LandExtra } from '../types';
import type { HushGen } from './gen';

type Img = Phaser.GameObjects.Image;

// ---------------------------------------------------------------- tuning

/** Flakes in the air at once, how high they start (px over the ground they'll land on), and how fast they fall (px/s). */
const FLAKES = 90;
const FLAKE_Z: [number, number] = [30, 150];
const FLAKE_FALL: [number, number] = [9, 19];
/** The breeze carrying them (px/s east), and their side to side sway (px). */
const BREEZE = 4;
const SWAY = 3;
/** How long (ms) a landed flake takes to melt into the snow. */
const SETTLE_MS = 700;
/** The flakes' colour by day and by night, and how strong. */
const FLAKE_DAY = 0xffffff;
const FLAKE_NIGHT = 0x9fb2e0;

/** Footprints kept, how far apart (px) a stride lays them, how far (px) either side of the line, and how long (ms) the snow takes to fill them in. */
const PRINTS = 90;
const STRIDE = 6;
const STEP_SIDE = 1.5;
const FILL_MS = 26000;
/** Moved further than this in one frame (px): carried, not walked; no prints across the gap. */
const LEAP = 40;

/** Puffs of steam and smoke at once; how often (ms) a spring and a chimney breathe one out. */
const PUFFS = 48;
const SPRING_EVERY = 380;
const CHIMNEY_EVERY = 520;
/** How long (ms) a puff lives, how fast (px/s) it rises, and how strong it is at its thickest. */
const STEAM_MS: [number, number] = [2600, 4200];
const STEAM_RISE: [number, number] = [6, 11];
const STEAM_ALPHA = 0.42;
const SMOKE_MS: [number, number] = [3200, 4800];
const SMOKE_RISE: [number, number] = [9, 14];
const SMOKE_ALPHA = 0.5;
const STEAM_TINT_DAY = 0xffffff;
const STEAM_TINT_NIGHT = 0x8fd8c8;
const SMOKE_TINT_DAY = 0xd6dae6;
const SMOKE_TINT_NIGHT = 0x6a7698;

/** Glints of the sun on the powder at once. */
const GLINTS = 16;
const GLINT_TINTS = [0xffffff, 0xeaf2ff, 0xfff4e0];

interface Flake {
  img: Img;
  /** Where it will land, and how high above that it still is. */
  x: number;
  gy: number;
  z: number;
  fall: number;
  phase: number;
  /** ms since it landed (-1 while falling). */
  settled: number;
}

interface Print {
  img: Img;
  t: number;
}

interface Puff {
  img: Img;
  x: number;
  y: number;
  z: number;
  rise: number;
  t: number;
  life: number;
  smoke: boolean;
}

interface Glint {
  img: Img;
  t: number;
  life: number;
}

export class HushLife implements LandExtra {
  private flakes: Flake[] = [];
  private prints: Print[] = [];
  private nextPrint = 0;
  private puffs: Puff[] = [];
  private glints: Glint[] = [];
  private lastX = NaN;
  private lastY = NaN;
  private walked = 0;
  private side = 1;
  /** ms till each spring and chimney next breathes out, by its position. */
  private breath = new Map<number, number>();
  private flakeTint = -1;

  constructor(
    world: WorldScene,
    private gen: HushGen,
  ) {
    const add = world.add;
    for (let k = 0; k < FLAKES; k++) {
      const img = add.image(0, 0, 'hush_flake', `f${k % 5 === 0 ? 2 : k % 3 === 0 ? 1 : 0}`).setDepth(9985).setVisible(false);
      this.flakes.push({ img, x: 0, gy: 0, z: -2, fall: 0, phase: 0, settled: -1 });
    }
    for (let k = 0; k < PRINTS; k++) this.prints.push({ img: add.image(0, 0, 'hush_print', 'p0').setPipeline('Lit').setDepth(1.5).setVisible(false), t: FILL_MS });
    for (let k = 0; k < PUFFS; k++) this.puffs.push({ img: add.image(0, 0, 'hush_steam', 's0').setVisible(false), x: 0, y: 0, z: 0, rise: 0, t: 0, life: 0, smoke: false });
    for (let k = 0; k < GLINTS; k++) this.glints.push({ img: add.image(0, 0, 'spark').setBlendMode(Phaser.BlendModes.ADD).setDepth(3.2).setVisible(false), t: 0, life: 0 });
  }

  update(time: number, dt: number, d: number, hero: { x: number; y: number }, view: Phaser.Geom.Rectangle): void {
    this.updateFlakes(time, dt, d, view);
    this.updatePrints(dt, hero);
    this.updatePuffs(dt, d, view);
    this.updateGlints(dt, d, view);
  }

  destroy(): void {
    for (const f of this.flakes) f.img.destroy();
    for (const p of this.prints) p.img.destroy();
    for (const p of this.puffs) p.img.destroy();
    for (const g of this.glints) g.img.destroy();
    this.flakes = [];
    this.prints = [];
    this.puffs = [];
    this.glints = [];
  }

  // ---------------------------------------------------------------- snowfall

  /** Each flake falls toward a spot on the ground, drawn as high above it as it still is, and melts in where it lands. */
  private updateFlakes(time: number, dt: number, d: number, view: Phaser.Geom.Rectangle): void {
    const s = dt / 1000;
    const tint = d > 0.5 ? FLAKE_DAY : FLAKE_NIGHT;
    const strength = 0.55 + d * 0.4;
    const recolor = tint !== this.flakeTint;
    this.flakeTint = tint;
    for (const f of this.flakes) {
      if (recolor) f.img.setTint(tint);
      // Gone from round the view (the wanderer walked on, or travelled): fall again somewhere in it.
      const away = f.x < view.left - 30 || f.x > view.right + 30 || f.gy < view.top - 10 || f.gy > view.bottom + FLAKE_Z[1] + 20;
      if (f.z < 0 || away) {
        this.dropFlake(f, view, away || f.z < -1);
        continue;
      }
      if (f.settled >= 0) {
        f.settled += dt;
        if (f.settled >= SETTLE_MS) {
          f.z = -1;
          f.img.setVisible(false);
          continue;
        }
        f.img.setAlpha(strength * 0.8 * (1 - f.settled / SETTLE_MS));
        continue;
      }
      f.z -= f.fall * s;
      f.x += BREEZE * s;
      if (f.z <= 0) {
        f.z = 0;
        f.settled = 0;
      }
      const sway = Math.sin(time * 0.0011 + f.phase) * SWAY;
      f.img.setPosition(Math.round(f.x + sway), Math.round(f.gy - f.z)).setAlpha(strength * Math.min(1, (FLAKE_Z[1] - f.z) / 20 + 0.3)).setVisible(true);
    }
  }

  private dropFlake(f: Flake, view: Phaser.Geom.Rectangle, anyHeight: boolean): void {
    f.x = view.left - 10 + Math.random() * (view.width + 20);
    f.z = anyHeight ? FLAKE_Z[0] + Math.random() * (FLAKE_Z[1] - FLAKE_Z[0]) : FLAKE_Z[1] * (0.7 + Math.random() * 0.3);
    // It lands somewhere it will be seen falling to: low enough that it starts near the view's top or below.
    f.gy = view.top + Math.random() * (view.height + f.z * 0.6) + (anyHeight ? 0 : f.z * 0.4);
    f.fall = FLAKE_FALL[0] + Math.random() * (FLAKE_FALL[1] - FLAKE_FALL[0]);
    f.phase = Math.random() * 6.3;
    f.settled = -1;
    f.img.setVisible(false);
  }

  // ---------------------------------------------------------------- footprints

  /** A print every stride, left and right in turn, into the snow (not the ice); the snow fills each in slowly. */
  private updatePrints(dt: number, hero: { x: number; y: number }): void {
    for (const p of this.prints) {
      if (p.t >= FILL_MS) continue;
      p.t += dt;
      const k = p.t / FILL_MS;
      // Crisp for a while, then softening away as the snow settles into it.
      const a = k < 0.35 ? 0.95 : 0.95 * (1 - (k - 0.35) / 0.65) ** 1.6;
      p.img.setAlpha(a).setVisible(p.t < FILL_MS);
    }
    const dx = hero.x - this.lastX;
    const dy = hero.y - this.lastY;
    const step = Math.hypot(dx, dy);
    if (!Number.isFinite(step) || step > LEAP) {
      this.lastX = hero.x;
      this.lastY = hero.y;
      this.walked = 0;
      return;
    }
    if (step < 0.01) return;
    this.walked += step;
    this.lastX = hero.x;
    this.lastY = hero.y;
    if (this.walked < STRIDE) return;
    this.walked = 0;
    this.side = -this.side;
    const ux = dx / step;
    const uy = dy / step;
    const x = Math.round(hero.x - uy * STEP_SIDE * this.side);
    const y = Math.round(hero.y + ux * STEP_SIDE * this.side);
    if (!this.gen.printable(x, y)) return;
    const p = this.prints[this.nextPrint];
    this.nextPrint = (this.nextPrint + 1) % this.prints.length;
    p.t = 0;
    p.img.setPosition(x, y).setFrame(Math.abs(dx) > Math.abs(dy) ? 'p0' : 'p1').setAlpha(0.95).setVisible(true);
  }

  // ---------------------------------------------------------------- steam and smoke

  private updatePuffs(dt: number, d: number, view: Phaser.Geom.Rectangle): void {
    const s = dt / 1000;
    const night = 1 - d;
    for (const p of this.puffs) {
      if (p.t >= p.life) continue;
      p.t += dt;
      if (p.t >= p.life) {
        p.img.setVisible(false);
        continue;
      }
      const k = p.t / p.life;
      p.z += p.rise * s * (1 - k * 0.4);
      p.x += (BREEZE + (p.smoke ? 3 : 1.5) * k) * s;
      const frame = k < 0.3 ? 's0' : k < 0.65 ? 's1' : 's2';
      const peak = p.smoke ? SMOKE_ALPHA : STEAM_ALPHA * (0.75 + night * 0.25);
      p.img
        .setPosition(Math.round(p.x), Math.round(p.y - p.z))
        .setFrame(frame)
        .setAlpha(Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (1 - k) * peak * 1.6)
        .setTint(p.smoke ? (d > 0.5 ? SMOKE_TINT_DAY : SMOKE_TINT_NIGHT) : d > 0.5 ? STEAM_TINT_DAY : STEAM_TINT_NIGHT)
        .setVisible(true);
    }
    const pad = 60;
    const x0 = view.left - pad;
    const y0 = view.top - pad;
    const x1 = view.right + pad;
    const y1 = view.bottom + pad * 2;
    for (const sp of this.gen.springsIn(x0, y0, x1, y1)) {
      if (!this.due(sp.x * 3 + sp.y, dt, SPRING_EVERY)) continue;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.75;
      this.puff(sp.x + Math.cos(a) * sp.rx * r, sp.y + Math.sin(a) * sp.ry * r, 0, false, sp.y + sp.ry + 20);
    }
    for (const cb of this.gen.cabinsIn(x0, y0, x1, y1 + 80)) {
      if (!this.due(cb.x * 3 + cb.y + 0.5, dt, CHIMNEY_EVERY)) continue;
      this.puff(cb.smokeX + (Math.random() - 0.5) * 2, cb.y, cb.y - cb.smokeY, true, cb.y + 1);
    }
  }

  /** Counts down a source's breath; true when it's time for another puff. */
  private due(key: number, dt: number, every: number): boolean {
    const left = (this.breath.get(key) ?? Math.random() * every) - dt;
    if (left > 0) {
      this.breath.set(key, left);
      return false;
    }
    this.breath.set(key, every * (0.6 + Math.random() * 0.8));
    if (this.breath.size > 64) this.breath.clear();
    return true;
  }

  private puff(x: number, y: number, z: number, smoke: boolean, depth: number): void {
    const p = this.puffs.find((q) => q.t >= q.life);
    if (!p) return;
    const [l0, l1] = smoke ? SMOKE_MS : STEAM_MS;
    const [r0, r1] = smoke ? SMOKE_RISE : STEAM_RISE;
    p.x = x;
    p.y = y;
    p.z = z;
    p.t = 0;
    p.life = l0 + Math.random() * (l1 - l0);
    p.rise = r0 + Math.random() * (r1 - r0);
    p.smoke = smoke;
    p.img.setDepth(depth).setFlipX(Math.random() < 0.5).setAlpha(0).setVisible(false);
  }

  // ---------------------------------------------------------------- glints

  /** The low sun catching a crystal of the powder here and there; by night, now and then, the moon. */
  private updateGlints(dt: number, d: number, view: Phaser.Geom.Rectangle): void {
    const strength = 0.25 + d * 0.75;
    for (const g of this.glints) {
      g.t += dt;
      if (g.t >= g.life) {
        g.img.setVisible(false);
        if (Math.random() > 0.08 + d * 0.5) {
          g.t = 0;
          g.life = 300 + Math.random() * 500;
          continue;
        }
        const x = Math.round(view.left + Math.random() * view.width);
        const y = Math.round(view.top + Math.random() * view.height);
        if (!this.gen.printable(x, y)) continue;
        g.t = 0;
        g.life = 260 + Math.random() * 420;
        g.img
          .setPosition(x, y)
          .setTint(d > 0.4 ? GLINT_TINTS[Math.floor(Math.random() * 3)] : 0xb8ccff)
          .setScale(0.35 + Math.random() * 0.35)
          .setVisible(true);
      }
      if (g.img.visible) g.img.setAlpha(Math.sin((g.t / Math.max(1, g.life)) * Math.PI) * strength);
    }
  }
}
