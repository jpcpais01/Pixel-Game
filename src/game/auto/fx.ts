// Auto Battle's effects, drawn a pixel at a time: missiles, slashes, rings,
// beams, lightning, falling strikes, sparks. Each lives a moment in the
// layer's list, drawn each frame onto one plain and one glowing Graphics, with
// soft 'glow' sprites for the brightest flashes. Colours come from the hero's
// own Special palette, so a skin's colours carry into its fights.

import Phaser from 'phaser';
import type { Pal } from '../ultimate/ink';
import type { Missile, SpellFx } from './units';

export type Pt = { x: number; y: number };
type Draw = (g: Phaser.GameObjects.Graphics, glow: Phaser.GameObjects.Graphics, k: number, t: number) => void;

interface Live {
  t: number;
  dur: number;
  draw: Draw;
  /** Seconds before it starts. */
  wait: number;
  done?: () => void;
}

interface Spark {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  g: number;
  life: number;
  max: number;
  col: number;
  glow: boolean;
}

/** How flat a circle on the board looks. */
const FLAT = 0.62;
const MAX_SPARKS = 500;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);

export class FxLayer {
  private lives: Live[] = [];
  private sparks: Spark[] = [];
  private g: Phaser.GameObjects.Graphics;
  private glowG: Phaser.GameObjects.Graphics;
  private glows: Phaser.GameObjects.Image[] = [];
  private glowUsed = 0;

  constructor(
    private scene: Phaser.Scene,
    under: Phaser.GameObjects.Container,
    over: Phaser.GameObjects.Container,
  ) {
    this.g = scene.add.graphics();
    this.glowG = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    over.add([this.g, this.glowG]);
    this.under = scene.add.graphics();
    under.add(this.under);
    this.overC = over;
  }

  /** Marks on the ground, drawn under the heroes (telegraphs, rings). */
  readonly under: Phaser.GameObjects.Graphics;
  private overC: Phaser.GameObjects.Container;
  private grounds: Live[] = [];

  clear(): void {
    this.lives = [];
    this.grounds = [];
    this.sparks = [];
  }

  private add(dur: number, draw: Draw, wait = 0, done?: () => void, ground = false): void {
    (ground ? this.grounds : this.lives).push({ t: 0, dur, draw, wait, done });
  }

  update(dt: number): void {
    this.g.clear();
    this.glowG.clear();
    this.under.clear();
    this.glowUsed = 0;
    const run = (list: Live[], g: Phaser.GameObjects.Graphics, glow: Phaser.GameObjects.Graphics): Live[] =>
      list.filter((l) => {
        if (l.wait > 0) {
          l.wait -= dt;
          return true;
        }
        l.t += dt;
        const k = Math.min(1, l.t / l.dur);
        l.draw(g, glow, k, l.t);
        if (k >= 1) {
          l.done?.();
          return false;
        }
        return true;
      });
    this.grounds = run(this.grounds, this.under, this.under);
    this.lives = run(this.lives, this.g, this.glowG);
    // Sparks: a little arc through the air, then gone.
    this.sparks = this.sparks.filter((s) => {
      s.life -= dt;
      if (s.life <= 0) return false;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vz -= s.g * dt;
      s.z = Math.max(0, s.z + s.vz * dt);
      const a = Math.min(1, (s.life / s.max) * 1.6);
      (s.glow ? this.glowG : this.g).fillStyle(s.col, a).fillRect(Math.round(s.x), Math.round(s.y - s.z), 1, 1);
      return true;
    });
    for (let i = this.glowUsed; i < this.glows.length; i++) this.glows[i].setVisible(false);
  }

  /** A soft light (the shared 'glow' texture), for this frame only. */
  private light(x: number, y: number, size: number, col: number, a: number): void {
    let img = this.glows[this.glowUsed];
    if (!img) {
      img = this.scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD);
      this.overC.add(img);
      this.glows.push(img);
    }
    this.glowUsed++;
    img.setVisible(true).setPosition(x, y).setScale(size / 32, (size / 32) * 0.8).setTint(col).setAlpha(a);
  }

  sparksAt(x: number, y: number, n: number, cols: number[], o: { speed?: number; up?: number; g?: number; life?: number; glow?: boolean; spread?: number } = {}): void {
    for (let i = 0; i < n && this.sparks.length < MAX_SPARKS; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 30) * (0.4 + Math.random() * 0.8);
      const life = (o.life ?? 0.45) * (0.6 + Math.random() * 0.7);
      const sx = (Math.random() - 0.5) * (o.spread ?? 0);
      this.sparks.push({
        x: x + sx,
        y: y + sx * 0.3,
        z: 2,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * FLAT,
        vz: (o.up ?? 30) * (0.5 + Math.random()),
        g: o.g ?? 90,
        life,
        max: life,
        col: cols[i % cols.length],
        glow: o.glow ?? true,
      });
    }
  }

  // --- Drawing helpers -------------------------------------------------------

  private static dot(g: Phaser.GameObjects.Graphics, x: number, y: number, col: number, a = 1, s = 1): void {
    g.fillStyle(col, a).fillRect(Math.round(x - (s - 1) / 2), Math.round(y - (s - 1) / 2), s, s);
  }

  /** A ring on the ground, a pixel thick, `r` across. */
  private static ring(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, col: number, a: number, dash = 0, spin = 0): void {
    const n = Math.max(12, Math.round(r * 5));
    for (let i = 0; i < n; i++) {
      if (dash && i % dash >= dash / 2) continue;
      const t = (i / n) * Math.PI * 2 + spin;
      FxLayer.dot(g, x + Math.cos(t) * r, y + Math.sin(t) * r * FLAT, col, a);
    }
  }

  /** A pixel line. */
  private static line(g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, col: number, alpha = 1, s = 1): void {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
    for (let i = 0; i <= n; i++) FxLayer.dot(g, lerp(a.x, b.x, i / n), lerp(a.y, b.y, i / n), col, alpha, s);
  }

  /** A jagged bolt between two points. */
  private static zig(g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, col: number, core: number, alpha: number, seed: number): void {
    const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 6));
    let prev = a;
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const j = i === n ? 0 : Math.sin(seed * 12.9 + i * 78.2) * 3.5;
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      const p = { x: lerp(a.x, b.x, k) + (nx / len) * j, y: lerp(a.y, b.y, k) + (ny / len) * j };
      FxLayer.line(g, prev, p, col, alpha * 0.8, 2);
      FxLayer.line(g, prev, p, core, alpha);
      prev = p;
    }
  }

  // --- Basic attacks ---------------------------------------------------------

  /** A blow in reach: a crescent sweeping across the target. */
  slash(at: Pt, from: Pt, pal: Pal, heavy: boolean): void {
    const ang = Math.atan2(at.y - from.y, at.x - from.x);
    const r = heavy ? 9 : 7;
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.add(0.2, (g, glow, k) => {
      const sweep = easeOut(k);
      const a = 1 - k;
      for (let i = 0; i < 14; i++) {
        const f = i / 13;
        if (f > sweep) break;
        const t = ang + dir * (f - 0.5) * 2.2;
        const rr = r * (0.85 + Math.sin(f * Math.PI) * 0.25);
        const x = at.x - Math.cos(ang) * 3 + Math.cos(t) * rr * 0.6;
        const y = at.y - 12 + Math.sin(t) * rr * 0.6;
        FxLayer.dot(glow, x, y, pal.mid, a * 0.9, 2);
        FxLayer.dot(g, x, y, i > 10 ? pal.hot : pal.core, a);
      }
    });
    this.sparksAt(at.x, at.y - 10, heavy ? 6 : 3, [pal.core, pal.hot, pal.mid], { speed: 26, up: 14, life: 0.3 });
  }

  /** A missile from `a` to `b` taking `dur` seconds, drawn as its kind. */
  missile(a: Pt, b: Pt, dur: number, kind: Missile, pal: Pal): void {
    const lob = kind === 'flask' || kind === 'chem' || kind === 'junk';
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    const pos = (k: number) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) - 11 - (lob ? Math.sin(k * Math.PI) * 14 : Math.sin(k * Math.PI) * 2) });
    if (kind === 'spark') {
      // Lightning is there at once and flickers out.
      this.add(0.18, (g, _glow, k, t) => FxLayer.zig(g, { x: a.x, y: a.y - 14 }, { x: b.x, y: b.y - 11 }, pal.mid, pal.core, 1 - k, Math.floor(t * 30)));
      return;
    }
    this.add(dur, (g, glow, k, t) => {
      const p = pos(k);
      switch (kind) {
        case 'arrow':
        case 'lance':
        case 'thread':
        case 'feather': {
          const len = kind === 'lance' ? 7 : kind === 'feather' ? 4 : 6;
          FxLayer.line(g, { x: p.x - cx * len, y: p.y - cy * len }, p, kind === 'arrow' ? 0xd8c8a8 : pal.mid);
          FxLayer.dot(glow, p.x, p.y, pal.hot, 0.9, 2);
          FxLayer.dot(g, p.x, p.y, pal.core);
          if (kind === 'feather')
            for (const s of [-1, 1]) {
              const q = { x: p.x - cy * 3 * s - cx * 2, y: p.y + cx * 3 * s - cy * 2 };
              FxLayer.line(g, { x: q.x - cx * 3, y: q.y - cy * 3 }, q, pal.mid, 0.8);
            }
          break;
        }
        case 'flask':
        case 'chem':
        case 'junk': {
          const spin = Math.floor(t * 16) % 4;
          const w = spin % 2 ? 2 : 3;
          const h = spin % 2 ? 3 : 2;
          g.fillStyle(0x0b0818, 1).fillRect(Math.round(p.x - w / 2) - 1, Math.round(p.y - h / 2) - 1, w + 2, h + 2);
          g.fillStyle(kind === 'junk' ? 0x9a7a5a : pal.mid, 1).fillRect(Math.round(p.x - w / 2), Math.round(p.y - h / 2), w, h);
          FxLayer.dot(g, p.x - 0.5, p.y - 0.5, pal.core);
          FxLayer.dot(glow, p.x, p.y, pal.hot, 0.5, 3);
          break;
        }
        case 'hand': {
          const s = t * 20;
          FxLayer.line(g, p, { x: p.x + Math.cos(s) * 4, y: p.y + Math.sin(s) * 4 }, pal.core);
          FxLayer.dot(glow, p.x, p.y, pal.mid, 0.9, 3);
          break;
        }
        case 'shard': {
          const s = Math.floor(t * 20) % 2;
          FxLayer.dot(glow, p.x, p.y, pal.mid, 0.8, 3);
          FxLayer.line(g, { x: p.x - (s ? 2 : 0), y: p.y - (s ? 0 : 2) }, { x: p.x + (s ? 2 : 0), y: p.y + (s ? 0 : 2) }, pal.core);
          break;
        }
        case 'note': {
          const bob = Math.sin(t * 18) * 1.5;
          FxLayer.dot(glow, p.x, p.y + bob, pal.mid, 0.7, 3);
          g.fillStyle(pal.core, 1).fillRect(Math.round(p.x) - 1, Math.round(p.y + bob), 2, 2);
          g.fillRect(Math.round(p.x) + 1, Math.round(p.y + bob) - 3, 1, 4);
          break;
        }
        case 'bullet':
        case 'drone': {
          FxLayer.line(g, { x: p.x - cx * 4, y: p.y - cy * 4 }, p, pal.mid, 0.7);
          FxLayer.dot(g, p.x, p.y, pal.core, 1, 2);
          FxLayer.dot(glow, p.x, p.y, pal.hot, 0.8, 3);
          break;
        }
        default: {
          // Orbs of every kind: a bright core, a glow, a fading tail.
          for (let i = 3; i >= 1; i--) {
            const q = pos(Math.max(0, k - i * 0.06));
            FxLayer.dot(glow, q.x, q.y, pal.mid, 0.5 - i * 0.12, 2);
          }
          FxLayer.dot(glow, p.x, p.y, pal.mid, 0.9, 4);
          FxLayer.dot(g, p.x, p.y, pal.hot, 1, 2);
          FxLayer.dot(g, p.x, p.y, pal.core);
          this.light(p.x, p.y, 14, pal.mid, 0.5);
          if (kind === 'fire' || kind === 'firebolt' || kind === 'soul') {
            if (Math.random() < 0.5) this.sparksAt(p.x, p.y + 10, 1, [pal.hot, pal.mid], { speed: 6, up: 10, g: -10, life: 0.3 });
          }
        }
      }
    }, 0, () => {
      this.pop(b, pal, lob || kind === 'firebolt' || kind === 'fire');
    });
  }

  /** A small burst where a missile lands. */
  pop(at: Pt, pal: Pal, big: boolean): void {
    this.add(0.22, (_g, glow, k) => {
      FxLayer.ring(glow, at.x, at.y - 8, 2 + k * (big ? 7 : 4), pal.mid, 1 - k);
      if (k < 0.4) this.light(at.x, at.y - 9, big ? 22 : 14, pal.hot, 0.7 * (1 - k / 0.4));
    });
    this.sparksAt(at.x, at.y - 8, big ? 7 : 4, [pal.core, pal.hot, pal.mid], { speed: 24, up: 18, life: 0.35 });
  }

  // --- Spells ----------------------------------------------------------------

  /** A cast gathering: a turning rune circle under the caster. */
  gather(at: Pt, pal: Pal, dur: number, big: boolean): void {
    this.add(
      dur,
      (g, _glow, k, t) => {
        const r = (big ? 11 : 8) * easeOut(Math.min(1, k * 3));
        const a = k < 0.8 ? 0.9 : (1 - k) * 4.5;
        FxLayer.ring(g, at.x, at.y, r, pal.mid, a, 4, t * 3);
        FxLayer.ring(g, at.x, at.y, r * 0.65, pal.hot, a * 0.8, 0, -t * 4);
      },
      0,
      undefined,
      true,
    );
    this.add(dur, (_g, _glow, k) => this.light(at.x, at.y - 12, big ? 40 : 26, pal.mid, 0.5 * Math.sin(k * Math.PI)));
    this.sparksAt(at.x, at.y, big ? 10 : 5, [pal.hot, pal.mid], { speed: 14, up: 30, g: -20, life: 0.6, spread: 14 });
  }

  /** Where a delayed blast will land: a ring that closes in. */
  telegraph(at: Pt, r: number, pal: Pal, dur: number): void {
    this.add(
      dur,
      (g, _glow, k, t) => {
        FxLayer.ring(g, at.x, at.y, r, pal.deep, 0.7, 3, t);
        FxLayer.ring(g, at.x, at.y, r * (1 - k), pal.mid, 0.5 + k * 0.5);
      },
      0,
      undefined,
      true,
    );
  }

  /** A spell going off. Every kind has a shape; `fx` flavours it. */
  spell(o: { fx: SpellFx; kind: string; from: Pt; at: Pt; r: number; pal: Pal; hits: Pt[]; path: Pt[]; big: boolean; span: number }): void {
    const { fx, pal, at, from } = o;
    const R = o.r * 18;
    switch (o.kind) {
      case 'nova':
      case 'blast':
      case 'leap': {
        const c = o.kind === 'nova' ? from : at;
        this.shock(c, R, pal, o.big);
        this.flavour(fx, c, R, pal, o.big);
        break;
      }
      case 'beam':
        this.beam(from, at, pal, fx, o.big);
        break;
      case 'dash':
        this.add(0.3, (g, glow, k) => {
          FxLayer.line(glow, { x: from.x, y: from.y - 10 }, { x: at.x, y: at.y - 10 }, pal.mid, (1 - k) * 0.8, 3);
          FxLayer.line(g, { x: from.x, y: from.y - 10 }, { x: at.x, y: at.y - 10 }, pal.core, 1 - k);
        });
        for (const h of o.hits) this.pop(h, pal, true);
        break;
      case 'chain': {
        const pts = [from, ...o.path];
        this.add(0.35, (g, _glow, k, t) => {
          for (let i = 1; i < pts.length; i++)
            FxLayer.zig(g, { x: pts[i - 1].x, y: pts[i - 1].y - 12 }, { x: pts[i].x, y: pts[i].y - 11 }, pal.mid, pal.core, 1 - k, Math.floor(t * 25) + i);
        });
        for (const p of o.path) this.pop(p, pal, false);
        if (fx === 'shadow') for (const p of o.path) this.afterimage(p, pal);
        break;
      }
      case 'rain':
        o.path.forEach((p, i) => this.drop(p, pal, fx, Math.max(0, (o.span * i) / Math.max(1, o.path.length) - 0.16)));
        if (o.big) this.add(o.span + 0.3, (_g, _glow, k) => this.light(at.x, at.y - 30, 70, pal.deep, 0.35 * Math.sin(k * Math.PI)));
        break;
      case 'mend':
        this.shock(from, Math.max(10, R), pal, false);
        for (const h of o.hits) this.blessing(h, pal, fx);
        break;
    }
  }

  /** An expanding shock ring with a flash and a spray of sparks. */
  private shock(c: Pt, R: number, pal: Pal, big: boolean): void {
    this.add(
      0.42,
      (g, _glow, k) => {
        const r = Math.max(4, R) * easeOut(k);
        FxLayer.ring(g, c.x, c.y, r, pal.hot, 1 - k);
        FxLayer.ring(g, c.x, c.y, r * 0.8, pal.mid, (1 - k) * 0.8);
        if (big) FxLayer.ring(g, c.x, c.y, r * 0.55, pal.deep, (1 - k) * 0.6);
      },
      0,
      undefined,
      true,
    );
    this.add(0.3, (_g, _glow, k) => this.light(c.x, c.y - 8, R * 2.2 + 20, pal.mid, 0.9 * (1 - k)));
    this.sparksAt(c.x, c.y - 4, big ? 26 : 12, [pal.core, pal.hot, pal.mid, pal.deep], { speed: 18 + R * 1.4, up: 26, life: 0.55, spread: R * 0.6 });
  }

  /** Each Special's own touch on top of its shape. */
  private flavour(fx: SpellFx, c: Pt, R: number, pal: Pal, big: boolean): void {
    switch (fx) {
      case 'light':
      case 'holy':
      case 'spear': {
        // A shaft of light (or the spear) comes down from the sky.
        this.add(0.45, (g, glow, k) => {
          const a = 1 - k;
          const w = big ? 5 : 3;
          for (let y = -80; y < 0; y += 1) {
            const f = (y + 80) / 80;
            FxLayer.dot(glow, c.x + Math.sin(y * 0.3 + k * 10) * 0.5, c.y + y, pal.mid, a * f * 0.6, w);
          }
          FxLayer.line(g, { x: c.x, y: c.y - 80 }, { x: c.x, y: c.y - 2 }, pal.core, a);
          if (fx === 'spear' && k < 0.3) {
            const y = lerp(c.y - 70, c.y - 4, k / 0.3);
            FxLayer.line(g, { x: c.x, y: y - 14 }, { x: c.x, y }, pal.hot, 1, 2);
          }
        });
        break;
      }
      case 'lightning':
        this.add(0.3, (g, _glow, k, t) => {
          FxLayer.zig(g, { x: c.x + 6, y: c.y - 90 }, { x: c.x, y: c.y - 4 }, pal.mid, pal.core, 1 - k, Math.floor(t * 30));
        });
        break;
      case 'clock':
        this.add(0.7, (g, _glow, k) => {
          const r = Math.max(10, R * 0.8);
          const a = k < 0.7 ? 1 : (1 - k) / 0.3;
          FxLayer.ring(g, c.x, c.y - 2, r, pal.hot, a);
          for (let i = 0; i < 12; i++) {
            const t = (i / 12) * Math.PI * 2;
            FxLayer.dot(g, c.x + Math.cos(t) * r * 0.85, c.y - 2 + Math.sin(t) * r * 0.85 * FLAT, pal.core, a);
          }
          const h = -Math.PI / 2 + k * Math.PI * 4;
          FxLayer.line(g, { x: c.x, y: c.y - 2 }, { x: c.x + Math.cos(h) * r * 0.7, y: c.y - 2 + Math.sin(h) * r * 0.7 * FLAT }, pal.core, a);
        }, 0, undefined, true);
        break;
      case 'thorns':
      case 'quake':
      case 'haunt':
      case 'strings': {
        // Spikes (roots, stones, junk, threads) jut up across the area.
        const n = Math.round(6 + R / 3);
        const spikes = Array.from({ length: n }, () => {
          const a = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * Math.max(8, R);
          return { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * FLAT, h: 4 + Math.random() * 6 };
        });
        this.add(0.55, (g, _glow, k) => {
          const up = k < 0.25 ? k / 0.25 : k > 0.75 ? (1 - k) / 0.25 : 1;
          for (const s of spikes) {
            if (fx === 'strings') FxLayer.line(g, { x: s.x, y: s.y - 60 }, { x: s.x, y: s.y - s.h * up }, pal.light, 0.7 * up);
            else {
              const col = fx === 'quake' ? 0x8a7a6a : fx === 'haunt' ? 0x9a7a5a : pal.deep;
              FxLayer.line(g, { x: s.x, y: s.y }, { x: s.x, y: s.y - s.h * up }, col, 1, 2);
              FxLayer.dot(g, s.x, s.y - s.h * up, fx === 'thorns' ? pal.hot : 0xd8ccb8);
            }
          }
        });
        break;
      }
      case 'water':
      case 'poison':
      case 'acid':
      case 'blood':
        // A lingering pool.
        this.add(1.2, (g, _glow, k) => {
          const r = Math.max(8, R) * (0.7 + easeOut(Math.min(1, k * 4)) * 0.3);
          const a = (k < 0.8 ? 0.45 : (1 - k) * 2.25) * 1;
          for (let y = -r * FLAT; y <= r * FLAT; y += 1)
            for (let x = -r; x <= r; x += 2) {
              if ((x * x) / (r * r) + (y * y) / (r * r * FLAT * FLAT) > 1) continue;
              if ((Math.round(x) + Math.round(y)) % 2) continue;
              FxLayer.dot(g, c.x + x, c.y + y, pal.deep, a * 0.8);
            }
          if (Math.random() < 0.3) this.sparksAt(c.x + (Math.random() - 0.5) * r * 1.6, c.y + (Math.random() - 0.5) * r * FLAT, 1, [pal.hot], { speed: 2, up: 12, g: 10, life: 0.3 });
        }, 0, undefined, true);
        break;
      case 'arcane':
      case 'shadow':
      case 'souls':
      case 'fear':
        // Motes spiral in to the centre before the burst.
        this.add(0.5, (g, glow, k) => {
          for (let i = 0; i < 10; i++) {
            const t = (i / 10) * Math.PI * 2 + k * 6;
            const d = Math.max(10, R) * (1 - k);
            FxLayer.dot(glow, c.x + Math.cos(t) * d, c.y - 6 + Math.sin(t) * d * FLAT, pal.mid, 1 - k * 0.5, 2);
            FxLayer.dot(g, c.x + Math.cos(t) * d, c.y - 6 + Math.sin(t) * d * FLAT, pal.core, 1 - k);
          }
        });
        break;
      case 'fire':
      case 'flame':
        this.sparksAt(c.x, c.y - 2, big ? 30 : 16, [pal.core, pal.hot, pal.mid, pal.deep], { speed: 10, up: 50, g: 20, life: 0.8, spread: R });
        break;
      case 'notes':
      case 'drums':
      case 'roar':
      case 'wind':
        // A second, wider wave.
        this.add(0.5, (g, _glow, k) => FxLayer.ring(g, c.x, c.y, Math.max(8, R) * 1.3 * easeOut(k), pal.light, (1 - k) * 0.7, 2), 0.1, undefined, true);
        break;
      default:
        break;
    }
  }

  /** A beam or a thrown line from the caster to the far end. */
  private beam(from: Pt, to: Pt, pal: Pal, fx: SpellFx, big: boolean): void {
    const a = { x: from.x, y: from.y - 12 };
    const b = { x: to.x, y: to.y - 10 };
    const w = big ? 5 : 3;
    this.add(0.45, (g, glow, k, t) => {
      const fade = k < 0.2 ? k / 0.2 : (1 - k) / 0.8;
      const reach = Math.min(1, k * 4);
      const end = { x: lerp(a.x, b.x, reach), y: lerp(a.y, b.y, reach) };
      if (fx === 'lightning') {
        FxLayer.zig(g, a, end, pal.mid, pal.core, fade, Math.floor(t * 30));
        return;
      }
      FxLayer.line(glow, a, end, pal.deep, fade * 0.8, w + 2);
      FxLayer.line(glow, a, end, pal.mid, fade, w);
      FxLayer.line(g, a, end, pal.core, fade, Math.max(1, w - 2));
      if (fx === 'saber' || fx === 'spear' || fx === 'feathers' || fx === 'beasts' || fx === 'arrows') {
        // A thing flies the line: a spinning blade, a spear, a spirit animal, a great arrow.
        FxLayer.dot(g, end.x, end.y, pal.hot, 1, 4);
        FxLayer.dot(g, end.x, end.y, 0xffffff, 1, 2);
      }
    });
    this.add(0.45, (_g, _glow, k) => this.light(lerp(a.x, b.x, Math.min(1, k * 4)), lerp(a.y, b.y, Math.min(1, k * 4)), big ? 34 : 24, pal.mid, 0.8 * (1 - k)));
    const n = Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 5);
    for (let i = 0; i < n; i++) this.sparksAt(lerp(a.x, b.x, i / n), lerp(a.y, b.y, i / n) + 10, 1, [pal.hot, pal.mid], { speed: 12, up: 16, life: 0.4 });
  }

  /** One strike falling from the sky. */
  private drop(p: Pt, pal: Pal, fx: SpellFx, wait: number): void {
    const dur = 0.16;
    const ox = fx === 'missiles' || fx === 'drones' || fx === 'bullets' ? (Math.random() - 0.5) * 40 : (Math.random() - 0.5) * 8;
    this.add(
      dur,
      (g, glow, k, t) => {
        const y = lerp(p.y - 70, p.y - 6, k);
        const x = lerp(p.x + ox, p.x, k);
        if (fx === 'lightning') {
          FxLayer.zig(g, { x: p.x + 4, y: p.y - 80 }, { x: p.x, y: p.y - 4 }, pal.mid, pal.core, 1, Math.floor(t * 40));
          return;
        }
        FxLayer.line(glow, { x: x - ox * 0.15, y: y - 10 }, { x, y }, pal.mid, 0.8, 2);
        FxLayer.line(g, { x: x - ox * 0.1, y: y - 6 }, { x, y }, pal.core);
      },
      wait,
      () => this.pop(p, pal, fx === 'missiles' || fx === 'fire' || fx === 'blood'),
    );
  }

  /** A heal or blessing on an ally: rising motes and a soft plus. */
  private blessing(p: Pt, pal: Pal, fx: SpellFx): void {
    this.add(0.7, (g, _glow, k) => {
      const a = 1 - k;
      const y = p.y - 16 - k * 10;
      if (fx === 'notes') {
        g.fillStyle(pal.core, a).fillRect(Math.round(p.x) + 3, Math.round(y), 2, 2).fillRect(Math.round(p.x) + 5, Math.round(y) - 3, 1, 4);
      } else {
        g.fillStyle(0x9aff9a, a).fillRect(Math.round(p.x) - 1, Math.round(y) - 3, 1, 5).fillRect(Math.round(p.x) - 3, Math.round(y) - 1, 5, 1);
      }
    });
    this.sparksAt(p.x, p.y, 6, [0xd8ffd0, pal.hot], { speed: 8, up: 26, g: -10, life: 0.6, spread: 10 });
  }

  /** A shadow left behind a blink. */
  afterimage(p: Pt, pal: Pal): void {
    this.add(0.3, (g, _glow, k) => {
      g.fillStyle(pal.deep, 0.5 * (1 - k)).fillRect(Math.round(p.x) - 3, Math.round(p.y) - 18, 6, 16);
    });
  }

  /** Stars circling a stunned head. */
  stun(get: () => Pt | null, sec: number): void {
    this.add(sec, (g, _glow, k, t) => {
      const p = get();
      if (!p) return;
      for (let i = 0; i < 3; i++) {
        const a = t * 7 + (i / 3) * Math.PI * 2;
        FxLayer.dot(g, p.x + Math.cos(a) * 5, p.y - 32 + Math.sin(a) * 2, 0xffe08a, k > 0.85 ? (1 - k) / 0.15 : 1);
      }
    });
  }

  /** A hero falls: a puff of dust and a wisp that rises away. */
  death(p: Pt, pal: Pal): void {
    this.sparksAt(p.x, p.y - 4, 14, [0x8a86a8, 0x5c567a, pal.mid], { speed: 22, up: 12, g: 40, life: 0.6, glow: false, spread: 8 });
    this.add(0.9, (g, glow, k) => {
      const y = p.y - 14 - k * 30;
      const x = p.x + Math.sin(k * 9) * 3;
      FxLayer.dot(glow, x, y, pal.mid, (1 - k) * 0.8, 3);
      FxLayer.dot(g, x, y, pal.core, 1 - k);
    });
  }
}
