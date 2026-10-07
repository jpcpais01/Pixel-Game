// Glowtide Shore's own living parts (see ../types.ts LandExtra): the waves
// washing up the sand and back, a foam line further out, and the sparkles,
// gold on the sea in the low sun and blue in the plankton by night. All of
// it a few dozen small sprites round the view: no full-screen layers.

import Phaser from 'phaser';
import type { WorldScene } from '../../../scenes/WorldScene';
import { CHUNK, type LandExtra } from '../types';
import { FOAM_FRAMES } from './art';
import type { ShoreGen } from './gen';

type Sprite = Phaser.GameObjects.Sprite;
type Img = Phaser.GameObjects.Image;

/** A wave's whole wash, up and back (ms), and how far apart (px) the pieces of foam stand. */
export const WAVE_MS = 5600;
const STEP = 20;
/** How far out (px into the water) a wave's foam starts, and how much of the wet sand it runs up. */
const OUT = 10;
const RUN = 0.85;
/** The breaker line further out: where it forms and where it fades (px into the water), and how bright it gets. */
const BREAK_FROM = 34;
const BREAK_TO = 12;
const BREAK_ALPHA = 0.55;
/** Sparkles at once: plankton by night, sun glints by day. */
const PLANKTON = 30;
const GLINTS = 18;
const PLANKTON_TINTS = [0x5ce0ff, 0x9af0ff, 0x38b8ff];
const GLINT_TINTS = [0xfff6d8, 0xffe6a8, 0xffffff];

interface Piece {
  foam: Sprite;
  glow: Sprite;
}

interface Spark {
  img: Img;
  t: number;
  life: number;
  glint: boolean;
}

const frac = (v: number) => v - Math.floor(v);
/** A fixed 0..1 for a piece of shore, so the waves don't arrive all in a line. */
const jitter = (x: number) => frac(Math.sin(x * 12.9898) * 43758.5453);

export class ShoreWaves implements LandExtra {
  private swash: Piece[] = [];
  private breakers: Piece[] = [];
  private sparks: Spark[] = [];

  constructor(
    private world: WorldScene,
    private gen: ShoreGen,
  ) {
    for (let k = 0; k < PLANKTON + GLINTS; k++) {
      const img = world.add.image(0, 0, 'spark').setBlendMode(Phaser.BlendModes.ADD).setDepth(3.2).setVisible(false);
      this.sparks.push({ img, t: 0, life: 0, glint: k >= PLANKTON });
    }
  }

  update(time: number, dt: number, d: number, _hero: { x: number; y: number }, view: Phaser.Geom.Rectangle): void {
    const glow = Math.max(0, Math.min(1, 1.15 - d * 1.5));
    const x0 = Math.floor((view.left - STEP) / STEP) * STEP;
    const n = Math.ceil((view.right + STEP * 2 - x0) / STEP);
    this.grow(this.swash, n);
    this.grow(this.breakers, n);
    for (let i = 0; i < this.swash.length; i++) {
      const x = x0 + i * STEP;
      const s = this.swash[i];
      const b = this.breakers[i];
      const col = this.gen.col(x);
      const sy = col.shore;
      if (i >= n || sy < view.top - 40 || sy > view.bottom + 50 || this.byPier(x)) {
        this.hide(s);
        this.hide(b);
        continue;
      }
      const p = frac(time / WAVE_MS + x * 0.0009 + jitter(x) * 0.07);
      // Up the sand fast, slowing as it goes; then back down, thinning to bubbles.
      let off: number;
      let frame: number;
      let alpha: number;
      if (p < 0.42) {
        const k = p / 0.42;
        off = OUT - (OUT + col.wet * RUN) * (1 - (1 - k) * (1 - k));
        frame = k < 0.55 ? 0 : 1;
        alpha = Math.min(1, k * 6);
      } else {
        const k = (p - 0.42) / 0.58;
        off = -col.wet * RUN + (OUT + col.wet * RUN) * k * k * 0.55;
        frame = k < 0.35 ? 2 : 3;
        alpha = 1 - k;
      }
      this.place(s, x, sy + off, frame, alpha, glow, jitter(x + 1) < 0.5);
      // Further out a line of foam forms, rolls in and dissolves before the next wave runs up.
      const q = frac(p + 0.45);
      const boff = BREAK_FROM + (BREAK_TO - BREAK_FROM) * q;
      this.place(b, x, sy + boff, q < 0.5 ? 1 : 2, Math.sin(q * Math.PI) * BREAK_ALPHA, glow * 0.7, jitter(x + 2) < 0.5);
    }
    this.updateSparks(dt, d, glow, view);
  }

  destroy(): void {
    for (const p of [...this.swash, ...this.breakers]) {
      p.foam.destroy();
      p.glow.destroy();
    }
    for (const s of this.sparks) s.img.destroy();
    this.swash = [];
    this.breakers = [];
    this.sparks = [];
  }

  /** Is x under a pier (the waves pass beneath it, out of sight)? */
  private byPier(x: number): boolean {
    const p = this.gen.pierOf(Math.floor(x / CHUNK));
    return !!p && Math.abs(x - p.x) < 26;
  }

  private grow(list: Piece[], n: number): void {
    while (list.length < n) {
      const foam = this.world.add.sprite(0, 0, 'shore_foam', 'f0').setPipeline('Lit').setDepth(3).setVisible(false);
      const glow = this.world.add.sprite(0, 0, 'shore_foam_e', 'n0').setBlendMode(Phaser.BlendModes.ADD).setDepth(3.1).setVisible(false);
      list.push({ foam, glow });
    }
  }

  private hide(p: Piece): void {
    p.foam.setVisible(false);
    p.glow.setVisible(false);
  }

  private place(p: Piece, x: number, y: number, frame: number, alpha: number, glow: number, flip: boolean): void {
    const f = Math.min(FOAM_FRAMES - 1, frame);
    const X = Math.round(x);
    const Y = Math.round(y);
    p.foam.setPosition(X, Y).setFrame(`f${f}`).setAlpha(alpha).setFlipX(flip).setVisible(alpha > 0.02);
    const g = alpha * glow;
    p.glow.setPosition(X, Y).setFrame(`n${f}`).setAlpha(g).setFlipX(flip).setVisible(g > 0.02);
  }

  /** Glints of the low sun on the open sea; by night, plankton winking in the shallows and the lagoons. */
  private updateSparks(dt: number, d: number, glow: number, view: Phaser.Geom.Rectangle): void {
    for (const s of this.sparks) {
      const strength = s.glint ? Math.max(0, d - 0.25) * 1.2 : glow;
      s.t += dt;
      if (s.t >= s.life) {
        s.img.setVisible(false);
        if (strength < 0.03) continue;
        const at = this.spot(view, s.glint);
        if (!at) continue;
        s.t = 0;
        s.life = s.glint ? 350 + Math.random() * 500 : 900 + Math.random() * 1400;
        s.img
          .setPosition(at.x, at.y)
          .setTint((s.glint ? GLINT_TINTS : PLANKTON_TINTS)[Math.floor(Math.random() * 3)])
          .setScale(s.glint ? 0.5 + Math.random() * 0.5 : 0.5)
          .setVisible(true);
      }
      s.img.setAlpha(Math.sin((s.t / Math.max(1, s.life)) * Math.PI) * strength);
    }
  }

  private spot(view: Phaser.Geom.Rectangle, glint: boolean): { x: number; y: number } | null {
    for (let k = 0; k < 6; k++) {
      const x = Math.round(view.left + Math.random() * view.width);
      let y: number;
      if (!glint && Math.random() < 0.6) {
        // Most plankton gathers where the waves break.
        y = Math.round(this.gen.shore(x) + Math.random() * 30);
        if (y < view.top || y > view.bottom) continue;
      } else y = Math.round(view.top + Math.random() * view.height);
      if (glint ? this.gen.sea(x, y) : this.gen.glowWater(x, y)) return { x, y };
    }
    return null;
  }
}
