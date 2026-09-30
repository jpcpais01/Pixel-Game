import Phaser from 'phaser';
import { bolt, clamp01, hash, Ink, type Pal } from './ultimate/ink';
import type { Effect } from './Slash';

// The Sith's Force lightning: forked bolts pouring from the open hand into
// whatever it seizes, and jumping on from each foe to the next. Every bolt is
// struck again a few times a second, so it crackles and writhes; with nothing
// to strike it lashes out into the air ahead instead.

/** How often the bolts are struck anew, ms. */
const RESTRIKE = 45;
/** Half the canvas: bolts reach this far from the hand. */
const HALF = 104;

export interface Arc {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Chained on from a foe rather than straight from the hand: thinner. */
  chain?: boolean;
}

export class ForceLightning implements Effect {
  dead = false;
  private ink: Ink;
  private glow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private src = { x: 0, y: 0 };
  private arcs: Arc[] = [];
  private strays: { x: number; y: number }[] = [];
  private depth = 0;
  private age = 0;
  private seed = 1;
  private restrike = 0;
  /** Counts down once it's let go, fading the bolts. */
  private ending = -1;

  constructor(
    private scene: Phaser.Scene,
    private p: Pal,
  ) {
    this.ink = new Ink(scene, HALF * 2, HALF * 2);
    this.glow = scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(p.mid).setScale(0.7).setAlpha(0);
    this.light = scene.lights.addLight(0, 0, 90, p.light, 0);
  }

  /** Where the bolts come from and go to this moment; `strays` are points in the air they lash at when nothing is struck. */
  set(x: number, y: number, arcs: Arc[], strays: { x: number; y: number }[], depth: number): void {
    this.src = { x, y };
    this.arcs = arcs;
    this.strays = strays;
    this.depth = depth;
    // A fresh strike the moment the targets change.
    this.restrike = 0;
  }

  /** Follow the hand as the hero moves, keeping the targets. */
  follow(x: number, y: number, depth: number): void {
    const dx = x - this.src.x;
    const dy = y - this.src.y;
    this.src = { x, y };
    for (const a of this.arcs) {
      if (a.chain) continue;
      a.x0 += dx;
      a.y0 += dy;
    }
    this.depth = depth;
  }

  /** Let go: the bolts flicker out. */
  stop(): void {
    if (this.ending < 0) this.ending = 140;
  }

  update(dt: number): void {
    if (this.dead) return;
    this.age += dt;
    if (this.ending >= 0) {
      this.ending -= dt;
      if (this.ending <= 0) {
        this.destroy();
        return;
      }
    }
    this.restrike -= dt;
    if (this.restrike <= 0) {
      this.restrike = RESTRIKE;
      this.seed++;
    }
    this.draw();
  }

  private draw(): void {
    const { src, p, seed } = this;
    const fade = this.ending >= 0 ? clamp01(this.ending / 140) : clamp01(this.age / 60);
    // Every other strike the whole thing dims a touch: the flicker of real lightning.
    const flicker = seed % 3 === 0 ? 0.7 : 1;
    const a = fade * flicker;
    const g = this.ink.begin(src.x, src.y, this.depth);
    for (const [i, arc] of this.arcs.entries()) {
      const s = seed * 7 + i;
      bolt(g, arc.x0, arc.y0, arc.x1, arc.y1, p, s, a * (arc.chain ? 0.85 : 1), arc.chain ? 0.45 : 0.6);
      this.branch(g, arc.x0, arc.y0, arc.x1, arc.y1, s, a * 0.8);
      // Where it bites: a white knot of light and a few loose sparks.
      g.put(arc.x1, arc.y1, p.core, a);
      for (let k = 0; k < 4; k++) {
        const ang = hash(s, k, 5) * Math.PI * 2;
        const r = 1 + hash(s, k, 6) * 3;
        g.put(arc.x1 + Math.cos(ang) * r, arc.y1 + Math.sin(ang) * r, k % 2 ? p.hot : p.mid, a * 0.9);
      }
    }
    for (const [i, t] of this.strays.entries()) {
      // With nothing to hold, it thrashes: each stray lands somewhere new every strike.
      const s = seed * 13 + i;
      const wob = (hash(s, 1, 9) - 0.5) * 18;
      const tx = t.x + wob;
      const ty = t.y + (hash(s, 2, 9) - 0.5) * 12;
      bolt(g, src.x, src.y, tx, ty, p, s, a * 0.9, 0.7);
      this.branch(g, src.x, src.y, tx, ty, s, a * 0.7);
    }
    // The hand itself, blazing.
    g.put(src.x, src.y, p.core, a);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.put(src.x + dx, src.y + dy, p.hot, a);
    g.end();
    this.glow.setPosition(Math.round(src.x), Math.round(src.y)).setDepth(this.depth - 0.05).setAlpha(0.8 * a).setScale(0.55 + 0.2 * flicker);
    this.light.setPosition(src.x, src.y);
    this.light.intensity = 2.4 * a;
  }

  /** A short fork off a bolt, from somewhere along it, trailing away to one side. */
  private branch(g: Ink, x0: number, y0: number, x1: number, y1: number, s: number, a: number): void {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 16) return;
    for (let b = 0; b < 2; b++) {
      const u = 0.25 + hash(s, b, 11) * 0.5;
      let x = x0 + (x1 - x0) * u;
      let y = y0 + (y1 - y0) * u;
      let ang = Math.atan2(y1 - y0, x1 - x0) + (hash(s, b, 12) < 0.5 ? -1 : 1) * (0.5 + hash(s, b, 13) * 0.6);
      const n = 4 + Math.floor(hash(s, b, 14) * 5);
      for (let k = 0; k < n; k++) {
        ang += (hash(s, b * 16 + k, 15) - 0.5) * 1.2;
        x += Math.cos(ang) * 1.6;
        y += Math.sin(ang) * 1.6;
        g.put(x, y, k < n / 2 ? this.p.hot : this.p.mid, a * (1 - k / (n + 1)));
      }
    }
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.ink.destroy();
    this.glow.destroy();
    this.scene.lights.removeLight(this.light);
  }
}
