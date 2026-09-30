import Phaser from 'phaser';
import { PROP_BASE_Y, PROP_H, RAY_FOOT_X, RAY_H, RAY_W, TREE_BASE_Y, TREE_H } from '../art/trees';
import { settings } from '../game/settings';
import { sway, treeSwayReady } from '../game/treeSway';
import { TREE_SHAPE, type SceneryLayout, type TreeKind } from './common';

// What stands along an arena's roof: trees, undergrowth and shafts of light,
// plus leaves (or petals) drifting down. Only what is near the view is drawn
// (the rest is hidden, which Phaser skips entirely), and trees fade when a
// hero walks behind them.

type Img = Phaser.GameObjects.Image;

interface Placed {
  obj: Img;
  /** World-space box it can cover. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Tree extends Placed {
  obj: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  kind: TreeKind;
  v: number;
  alpha: number;
}

interface Ray {
  img: Img;
  x: number;
  y: number;
  seed: number;
}

/** Falling leaves sit over the world, under damage numbers and the sky. */
const OVERHEAD = 9990;
/** ms between leaves dropping from the trees in view (pines keep theirs). */
const TREE_LEAF_MS = 1300;
/** The leaves each kind drops: its greens, and a few turned yellow. */
const LEAF_TINTS: Record<TreeKind, number[]> = {
  oak: [0x3b753c, 0x528d46, 0x71a653, 0xc8a040],
  birch: [0x8eb54c, 0xb2cd62, 0xd2e287, 0xe8c050],
  pine: [],
};

/** A spot in a tree's crown a leaf can fall from, and the leaf's colours. */
export interface LeafSource {
  x: number;
  y: number;
  tints: number[];
}

/**
 * Leaves (or petals) that now and then come loose from the trees and flutter
 * down: `pick` chooses where the next one starts, or null for none.
 */
export function treeLeaves(scene: Phaser.Scene, pick: () => LeafSource | null, frequency: number): Phaser.GameObjects.Particles.ParticleEmitter {
  let tints = [0xffffff];
  const zone = {
    getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
      const s = pick();
      p.x = s ? s.x : -1000;
      p.y = s ? s.y : -1000;
      if (s) tints = s.tints;
      return p;
    },
  };
  return scene.add
    .particles(0, 0, 'leafbit', {
      emitZone: { type: 'random', source: zone } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 3200, max: 5200 },
      speedX: { min: -7, max: 7 },
      speedY: { min: 8, max: 14 },
      // A leaf's flutter: it tips back and forth as it drifts down (each out of step, by its lifespan).
      rotate: { onEmit: () => 0, onUpdate: (p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * 12 + p.life) * 55 },
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.min(1, t * 8, (1 - t) * 3) },
      tint: { onEmit: () => tints[Math.floor(Math.random() * tints.length)] },
      frequency,
    })
    .setDepth(OVERHEAD - 1);
}

export interface Drift {
  /** Leaf (or petal) colours. */
  tints: number[];
  /** ms between specks. */
  frequency: number;
  /** Whether any fall where the camera is looking. */
  where(view: Phaser.Geom.Rectangle): boolean;
}

export class Scenery {
  private placed: Placed[] = [];
  private trees: Tree[] = [];
  private glows: { halo: Img; x: number; y: number; seed: number }[] = [];
  private rays: Ray[] = [];
  private leaves: Phaser.GameObjects.Particles.ParticleEmitter;
  private treeLeaves: Phaser.GameObjects.Particles.ParticleEmitter;
  /** The trees sway once their animations are built (see game/treeSway.ts). */
  private swaying = false;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private view = new Phaser.Geom.Rectangle();

  constructor(
    scene: Phaser.Scene,
    layout: SceneryLayout,
    private drift: Drift,
  ) {
    const add = scene.add;

    for (const t of layout.trees) {
      const obj = add.sprite(t.x, t.y, 'tree', `${t.kind}${t.v}`).setOrigin(0.5, TREE_BASE_Y / TREE_H).setPipeline('Lit').setDepth(t.y);
      const tree: Tree = { obj, x: t.x, y: t.y, kind: t.kind, v: t.v, alpha: 1, x0: t.x - 48, x1: t.x + 48, y0: t.y - TREE_BASE_Y, y1: t.y + 4 };
      this.trees.push(tree);
      this.placed.push(tree);
    }
    for (const p of layout.props) {
      const frame = `${p.kind}${p.v}`;
      let obj: Img;
      if (p.kind === 'rock') {
        obj = add.image(p.x, p.y, 'rock', `r${p.v}`).setOrigin(0.5, 12 / 14);
      } else {
        obj = add.image(p.x, p.y, 'flora', frame).setOrigin(0.5, PROP_BASE_Y / PROP_H);
      }
      obj.setPipeline('Lit').setDepth(p.y);
      this.placed.push({ obj, x0: p.x - 24, x1: p.x + 24, y0: p.y - 26, y1: p.y + 4 });
      if (p.kind === 'shrooms') {
        const glow = add.image(p.x, p.y, 'flora_e', frame).setOrigin(0.5, PROP_BASE_Y / PROP_H).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y + 0.1);
        this.placed.push({ obj: glow, x0: p.x - 24, x1: p.x + 24, y0: p.y - 26, y1: p.y + 4 });
        if (p.v === 0) {
          const halo = add.image(p.x, p.y - 6, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x4ff0d0).setScale(1.4).setDepth(p.y + 0.2);
          this.glows.push({ halo, x: p.x, y: p.y, seed: Math.random() * 10 });
          this.placed.push({ obj: halo, x0: p.x - 24, x1: p.x + 24, y0: p.y - 30, y1: p.y + 10 });
        }
      }
    }

    for (const r of layout.rays) {
      const img = add
        .image(r.x, r.y, 'ray', `ray${Math.floor(r.seed) % 2}`)
        .setOrigin(RAY_FOOT_X / RAY_W, 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(r.y + 1);
      this.rays.push({ img, x: r.x, y: r.y, seed: r.seed });
    }

    // Leaves drifting down over the whole view.
    const view = this.view;
    const zone = {
      getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
        p.x = view.x + Math.random() * view.width;
        p.y = view.y - 8 + Math.random() * view.height * 0.8;
        return p;
      },
    };
    this.leaves = add
      .particles(0, 0, 'leafbit', {
        emitZone: { type: 'random', source: zone } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: { min: 5000, max: 8000 },
        speedX: { min: -5, max: 11 },
        speedY: { min: 7, max: 15 },
        rotate: { start: 0, end: 540, random: true } as unknown as Phaser.Types.GameObjects.Particles.EmitterOpOnEmitType,
        alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.min(1, t * 6, (1 - t) * 4) },
        tint: drift.tints,
        frequency: drift.frequency,
      })
      .setDepth(OVERHEAD - 1);

    // Now and then a leaf comes loose from a tree in view.
    const leafy = this.trees.filter((t) => LEAF_TINTS[t.kind].length);
    this.treeLeaves = treeLeaves(
      scene,
      () => {
        const shown = leafy.filter((t) => t.obj.visible);
        const t = shown[Math.floor(Math.random() * shown.length)];
        if (!t) return null;
        const s = TREE_SHAPE[t.kind];
        return { x: t.x + (Math.random() - 0.5) * s.canopyR * 1.4, y: t.y - s.canopyY + (Math.random() - 0.2) * s.canopyR * 0.7, tints: LEAF_TINTS[t.kind] };
      },
      TREE_LEAF_MS,
    );

    // Dust glittering in the shafts of light.
    const rays = this.rays;
    const rayZone = {
      getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
        const shown = rays.filter((r) => r.img.visible);
        const r = shown[Math.floor(Math.random() * shown.length)];
        if (!r) {
          p.x = p.y = -100;
          return p;
        }
        const t = 0.15 + Math.random() * 0.8;
        const flip = r.img.flipX ? -1 : 1;
        p.x = r.x + flip * (-(1 - t) * RAY_H * 0.22 + (Math.random() - 0.5) * 14);
        p.y = r.y - (1 - t) * RAY_H;
        return p;
      },
    };
    this.motes = add
      .particles(0, 0, 'spark', {
        emitZone: { type: 'random', source: rayZone } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: { min: 2000, max: 3600 },
        speedX: { min: -3, max: 3 },
        speedY: { min: -2, max: 4 },
        scale: 0.5,
        alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.9 },
        tint: [0xfff6d0, 0xffffff, 0xffe8a0],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 110,
      })
      .setDepth(OVERHEAD - 2);

    const offQuality = settings.watch((s) => {
      const k = s.quality !== 'full' ? 2 : 1;
      this.leaves.frequency = drift.frequency * k;
      this.treeLeaves.frequency = TREE_LEAF_MS * k;
      this.motes.frequency = 110 * k;
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, offQuality);
  }

  /** `hero` is where the player stands; `view` the camera's world view. */
  update(time: number, dt: number, daylight: number, hero: { x: number; y: number }, view: Phaser.Geom.Rectangle): void {
    this.view.setTo(view.x, view.y, view.width, view.height);
    const vx0 = view.x - 16;
    const vx1 = view.right + 16;
    const vy0 = view.y - 16;
    const vy1 = view.bottom + 16;
    for (const p of this.placed) p.obj.setVisible(p.x1 > vx0 && p.x0 < vx1 && p.y1 > vy0 && p.y0 < vy1);
    if (!this.swaying && this.trees.length && treeSwayReady(this.trees[0].obj.scene)) {
      this.swaying = true;
      for (const t of this.trees) sway(t.obj, `tree_${t.kind}${t.v}`);
    }

    // A hero behind a tree sees through its crown.
    const k = Math.min(1, dt / 120);
    for (const t of this.trees) {
      if (!t.obj.visible) continue;
      const s = TREE_SHAPE[t.kind];
      const behind = hero.y < t.y - 2 && hero.y > t.y - s.canopyY - 34 && Math.abs(hero.x - t.x) < s.canopyR + 4;
      const goal = behind ? 0.45 : 1;
      if (t.alpha !== goal) {
        t.alpha += (goal - t.alpha) * k;
        if (Math.abs(goal - t.alpha) < 0.01) t.alpha = goal;
        t.obj.setAlpha(t.alpha);
      }
    }

    // Sunbeams by day; fainter moonbeams, slanting the other way, by night.
    const night = daylight < 0.5;
    const strength = Math.abs(daylight - 0.5) * 2;
    for (const r of this.rays) {
      const on = r.x + RAY_W > view.x && r.x - RAY_W < view.right && r.y > view.y && r.y - RAY_H < view.bottom;
      r.img.setVisible(on && strength > 0.02);
      if (!r.img.visible) continue;
      const breathe = 0.72 + Math.sin(time * 0.0009 + r.seed) * 0.18 + Math.sin(time * 0.0023 + r.seed * 2) * 0.1;
      r.img.setFlipX(night).setOrigin(night ? 1 - RAY_FOOT_X / RAY_W : RAY_FOOT_X / RAY_W, 1);
      r.img.setTint(night ? 0x9ab8ff : 0xffffff).setAlpha(strength * breathe * (night ? 0.45 : 1));
    }
    this.motes.emitting = !night && strength > 0.3 && this.rays.some((r) => r.img.visible);

    // Glowing mushrooms by night.
    for (const g of this.glows) {
      if (g.halo.visible) g.halo.setAlpha((1 - daylight) * (0.45 + Math.sin(time * 0.0017 + g.seed) * 0.12));
    }

    this.leaves.emitting = this.drift.where(view);
    this.treeLeaves.emitting = this.trees.some((t) => t.obj.visible && t.kind !== 'pine');
  }
}
