import Phaser from 'phaser';
import { sound } from '../audio';
import { GUST_FRAMES } from '../art/wildlife';
import type { WorldScene } from '../scenes/WorldScene';
import type { Bending, Forest, StandingTree } from './Forest';

// The wind in the Everwood. Every so often a gust sweeps across the forest,
// a front moving along the wind with a band of push behind it: as it passes,
// the grass, flowers and reeds bend over and spring back (their bent frames
// are drawn in art/forest.ts), the treetops thrash faster and let a few
// leaves go, which blow along with it, and thin white streaks of wind curl
// across the view. The hero hears it come: a rising whoosh from the side it
// blows from, and the leaves hissing.
//
// It all runs from where the front is, so the ripple travels: the grass at
// one side of the view bends first and the far side last.

/** ms between gusts (at random between the two), and the first one of a visit. */
const EVERY = [7000, 15000];
const FIRST = 4000;
/** The front's speed (px/s), and how deep the band of push behind it is (px). */
const SPEED = 150;
const BAND = 120;
/** The wind's way each visit varies this much (radians) round west to east or east to west, and each gust a little more. */
const PREVAIL_SPREAD = 0.45;
const GUST_SPREAD = 0.3;
/** Trees in the band sway this much faster at the strongest. */
const TREE_RUSH = 1.7;
/** Leaves a tree lets go as a strong gust strikes it; and at most this many trees shed per gust. */
const SHED = [1, 3];
const SHED_TREES = 10;
/** Wind streaks: one this often (ms) while the front crosses the view, at most this many at once. */
const STREAK_EVERY = 170;
const STREAK_MAX = 6;
const STREAK_ALPHA = 0.36;
/** The whoosh starts this long (s) before the front reaches the hero. */
const HEAR_AHEAD = 1.1;

interface Gust {
  /** Unit direction it blows. */
  dx: number;
  dy: number;
  /** The front, as a distance along (dx, dy) from the world's origin; and where it ends. */
  front: number;
  end: number;
  strength: number;
  heard: boolean;
  shed: number;
  struck: WeakSet<object>;
}

export class ForestWind {
  private gusts: Gust[] = [];
  private nextT = FIRST;
  private prevail: number;
  private streakT = 0;
  private streaks: Phaser.GameObjects.Sprite[] = [];
  /** Each tree's own sway pace, before the wind hurried it. */
  private pace = new WeakMap<Phaser.GameObjects.Sprite, number>();
  private rushed = new Set<Phaser.GameObjects.Sprite>();
  private leaves: Phaser.GameObjects.Particles.ParticleEmitter;
  private tints = [0x71a653];
  private bent = new Set<Bending>();

  constructor(
    private world: WorldScene,
    private forest: Forest,
  ) {
    // Mostly one way or the other across the screen, so the grass is seen to lean.
    this.prevail = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 2 * PREVAIL_SPREAD;
    // Leaves torn off by a gust, blown along with it, fluttering as they fall.
    this.leaves = world.add
      .particles(0, 0, 'leafbit', {
        emitting: false,
        lifespan: { min: 2600, max: 4200 },
        speedX: { onEmit: () => this.blowX() * (40 + Math.random() * 45) },
        speedY: { onEmit: () => this.blowY() * (40 + Math.random() * 45) + 4 + Math.random() * 8 },
        accelerationY: 7,
        rotate: { onEmit: () => 0, onUpdate: (p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * 14 + p.life) * 70 },
        alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.min(1, t * 8, (1 - t) * 3) },
        tint: { onEmit: () => this.tints[Math.floor(Math.random() * this.tints.length)] },
      })
      .setDepth(9989);
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const s of this.streaks) s.destroy();
      this.streaks = [];
    });
  }

  private blowX(): number {
    return this.gusts[0]?.dx ?? Math.cos(this.prevail);
  }

  private blowY(): number {
    return this.gusts[0]?.dy ?? Math.sin(this.prevail);
  }

  update(dt: number, daylight: number, hero: { x: number; y: number }, view: Phaser.Geom.Rectangle): void {
    this.nextT -= dt;
    if (this.nextT <= 0) {
      this.nextT = EVERY[0] + Math.random() * (EVERY[1] - EVERY[0]);
      if (this.gusts.length < 2) this.start(view);
    }

    const s = dt / 1000;
    for (const g of this.gusts) g.front += SPEED * s;
    this.gusts = this.gusts.filter((g) => g.front < g.end);

    // The hero hears each gust coming, from the side it blows from.
    for (const g of this.gusts) {
      if (g.heard) continue;
      const at = hero.x * g.dx + hero.y * g.dy;
      if (g.front + SPEED * HEAR_AHEAD >= at) {
        g.heard = true;
        sound.forestGust(g.strength, -g.dx * 0.6);
      }
    }

    this.bendGrass();
    this.rushTrees();
    this.streak(dt, daylight, view);
  }

  /** A new gust, its front starting just upwind of the view. */
  private start(view: Phaser.Geom.Rectangle): void {
    const a = this.prevail + (Math.random() - 0.5) * 2 * GUST_SPREAD;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let lo = Infinity;
    let hi = -Infinity;
    for (const [x, y] of [[view.left, view.top], [view.right, view.top], [view.left, view.bottom], [view.right, view.bottom]]) {
      const d = x * dx + y * dy;
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
    }
    // Strong gusts are rarer than soft ones.
    const strength = 0.45 + Math.pow(Math.random(), 1.6) * 0.55;
    this.gusts.push({ dx, dy, front: lo - 140, end: hi + BAND + 260, strength, heard: false, shed: 0, struck: new WeakSet() });
  }

  /** How hard the wind pushes at (x, y) now, 0..1: rising fast as the front arrives, easing off behind it. */
  private push(x: number, y: number): { k: number; g: Gust | null } {
    let k = 0;
    let by: Gust | null = null;
    for (const g of this.gusts) {
      const u = (g.front - (x * g.dx + y * g.dy)) / BAND;
      if (u <= 0 || u >= 1) continue;
      const v = (u < 0.22 ? u / 0.22 : 1 - (u - 0.22) / 0.78) * g.strength;
      if (v > k) {
        k = v;
        by = g;
      }
    }
    return { k, g: by };
  }

  /** Grass in the band bends over, the harder the push the further, and springs back as it passes. */
  private bendGrass(): void {
    const calm = this.gusts.length === 0;
    if (calm && this.bent.size === 0) return;
    this.forest.eachGrass((b) => {
      if (!b.obj.active) {
        this.bent.delete(b);
        return;
      }
      let want = 0;
      if (!calm && b.obj.visible) {
        const { k, g } = this.push(b.x, b.y);
        const level = k > 0.62 ? 2 : k > 0.2 ? 1 : 0;
        // The frames lean right; a mirrored one shows them leaning left.
        if (level && g) want = level * (g.dx >= 0 ? 1 : -1) * (b.obj.flipX ? -1 : 1);
      }
      if (want === b.bend) return;
      b.bend = want;
      if (want) {
        b.obj.setTexture('fbend', `${b.kind}${b.v}~${want}`);
        this.bent.add(b);
      } else {
        b.obj.setTexture('fprop', `${b.kind}${b.v}`);
        this.bent.delete(b);
      }
    });
  }

  /** Treetops in the band sway faster; a strong gust tears a few leaves off as it strikes. */
  private rushTrees(): void {
    if (this.gusts.length === 0 && this.rushed.size === 0) return;
    const still = new Set(this.rushed);
    this.forest.eachTree((t: StandingTree) => {
      const anims = t.obj.anims;
      if (!anims.isPlaying) return;
      const { k, g } = this.push(t.x, t.y - t.top);
      let base = this.pace.get(t.obj);
      if (base === undefined) {
        base = anims.timeScale;
        this.pace.set(t.obj, base);
      }
      if (k <= 0) return;
      still.delete(t.obj);
      this.rushed.add(t.obj);
      anims.timeScale = base * (1 + k * TREE_RUSH);
      if (g && k > 0.55 && !g.struck.has(t.obj) && g.shed < SHED_TREES) {
        g.struck.add(t.obj);
        const tints = this.forest.leafTints(t.kind, 0);
        if (!tints.length) return;
        g.shed++;
        this.tints = tints;
        const n = SHED[0] + Math.floor(Math.random() * (SHED[1] - SHED[0] + 1) * g.strength);
        for (let i = 0; i < n; i++) this.leaves.emitParticleAt(t.x + (Math.random() - 0.5) * t.r * 1.4, t.y - t.top + (Math.random() - 0.3) * t.r * 0.8, 1);
      }
    });
    // Out of the band (or out of view): back to its own pace.
    for (const obj of still) {
      this.rushed.delete(obj);
      if (!obj.active) continue;
      const base = this.pace.get(obj);
      if (base !== undefined) obj.anims.timeScale = base;
    }
  }

  /** Thin streaks of wind riding the front across the view. */
  private streak(dt: number, daylight: number, view: Phaser.Geom.Rectangle): void {
    this.streaks = this.streaks.filter((s) => s.active);
    const g = this.gusts[0];
    if (!g) return;
    for (const s of this.streaks) {
      s.x += g.dx * SPEED * 1.15 * (dt / 1000);
      s.y += g.dy * SPEED * 1.15 * (dt / 1000);
    }
    this.streakT -= dt;
    if (this.streakT > 0 || this.streaks.length >= STREAK_MAX) return;
    this.streakT = STREAK_EVERY * (0.6 + Math.random() * 0.8);
    // A spot on the front line inside the view (a little behind it, in the band).
    const along = g.front - Math.random() * BAND * 0.5;
    const px = -g.dy;
    const py = g.dx;
    const cx = view.centerX;
    const cy = view.centerY;
    const base = along - (cx * g.dx + cy * g.dy);
    const side = (Math.random() - 0.5) * Math.hypot(view.width, view.height);
    const x = cx + g.dx * base + px * side;
    const y = cy + g.dy * base + py * side;
    if (!view.contains(x, y)) return;
    const s = this.world.add
      .sprite(x, y, 'wgust', 'g0')
      .setTint(daylight > 0.4 ? 0xf6fbff : 0xbcd0ff)
      .setAlpha(STREAK_ALPHA * g.strength * (0.45 + 0.55 * daylight))
      .setScale(0.8 + Math.random() * 0.5)
      .setDepth(9989);
    // Drawn blowing right: mirrored for a wind to the left, so its loop still curls over the top.
    const left = g.dx < 0;
    s.setFlipX(left).setRotation(Math.atan2(g.dy, g.dx) - (left ? Math.PI : 0));
    s.play('wgust');
    s.anims.timeScale = (GUST_FRAMES / 12) * (0.8 + Math.random() * 0.4);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
    this.streaks.push(s);
  }
}
