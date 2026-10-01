import Phaser from 'phaser';
import { pixelCanvas } from '../art/canvas';
import { paintFloors } from '../art/homeFloors';
import type { ForestEdits } from './forestEdits';
import { CELL } from './homeLayout';

// The floors the player has laid in the Everwood (see forestEdits.ts),
// painted over the forest's ground by the Home's own floor painter
// (art/homeFloors.ts) in square patches: only the patches round the view,
// a couple a frame, and only those that hold a floor. A change repaints the
// patches round the cells that changed (soft floors and cobbles reach a cell
// or two past their own). Like the ground, each patch is a night picture
// under a day one that the daylight fades in.

/** A patch's side, px. */
const PATCH = 64;
/** How far past the view patches are painted ahead, and how far before they're let go. */
const AHEAD = 96;
const FORGET = 900;
/** Patches painted a frame beyond those in view (those in view are painted at once). */
const PER_FRAME = 2;
/** Over the ground tiles and their glow, under everything the main camera draws. */
const DEPTH = 2.5;

type Img = Phaser.GameObjects.Image;

const patchKey = (px: number, py: number): number => px * 32768 + py;

export class ForestFloors {
  private patches = new Map<number, { day: Img; night: Img; keys: string[] }>();
  /** Patches with a floor in or near them, worth painting. */
  private want = new Set<number>();
  /** The floors as last painted, to find what changed. */
  private shown = new Map<number, number>();
  private version = 0;
  private daylight = 1;

  constructor(
    private scene: Phaser.Scene,
    private adopt: (img: Img) => Img,
  ) {}

  /** The floors changed (or came in): the patches round the changed cells are painted again. */
  sync(e: ForestEdits): void {
    const changed = new Set<number>();
    for (const [k, v] of e.floors) if (this.shown.get(k) !== v) changed.add(k);
    for (const k of this.shown.keys()) if (!e.floors.has(k)) changed.add(k);
    if (!changed.size) return;
    this.shown = new Map(e.floors);
    this.want.clear();
    for (const k of e.floors.keys()) for (const p of this.round(k)) this.want.add(p);
    for (const k of changed) {
      for (const p of this.round(k)) {
        const had = this.patches.get(p);
        if (!had) continue;
        this.drop(had);
        this.patches.delete(p);
      }
    }
  }

  /** The patches a floor cell paints into: its own and those a soft edge reaches. */
  private round(k: number): number[] {
    const cx = Math.floor(k / 65536);
    const cy = k % 65536;
    const out: number[] = [];
    for (let py = Math.floor((cy * CELL - CELL * 2) / PATCH); py <= Math.floor((cy * CELL + CELL * 3) / PATCH); py++) {
      for (let px = Math.floor((cx * CELL - CELL * 2) / PATCH); px <= Math.floor((cx * CELL + CELL * 3) / PATCH); px++) out.push(patchKey(px, py));
    }
    return out;
  }

  /** Paint what's wanted round the view, and let go what's far behind. */
  update(e: ForestEdits, view: Phaser.Geom.Rectangle): void {
    if (!this.want.size && !this.patches.size) return;
    let made = 0;
    for (const p of this.want) {
      if (this.patches.has(p)) continue;
      const x = Math.floor(p / 32768) * PATCH;
      const y = (p % 32768) * PATCH;
      if (x + PATCH < view.left - AHEAD || x > view.right + AHEAD || y + PATCH < view.top - AHEAD || y > view.bottom + AHEAD) continue;
      const seen = x + PATCH > view.left && x < view.right && y + PATCH > view.top && y < view.bottom;
      if (!seen && made >= PER_FRAME) continue;
      made++;
      this.paint(e, p, x, y);
    }
    for (const [p, v] of this.patches) {
      const x = Math.floor(p / 32768) * PATCH;
      const y = (p % 32768) * PATCH;
      if (x + PATCH > view.left - FORGET && x < view.right + FORGET && y + PATCH > view.top - FORGET && y < view.bottom + FORGET) continue;
      this.drop(v);
      this.patches.delete(p);
    }
  }

  private paint(e: ForestEdits, p: number, x: number, y: number): void {
    const patch = paintFloors(e, x, y, PATCH, PATCH, false);
    if (!patch.any) {
      this.want.delete(p);
      return;
    }
    const v = this.version++;
    const keys = [`ff${v}_d`, `ff${v}_n`];
    const tex = this.scene.textures;
    tex.addCanvas(keys[0], pixelCanvas(PATCH, PATCH, patch.day))!.setDataSource(pixelCanvas(PATCH, PATCH, patch.normal));
    tex.addCanvas(keys[1], pixelCanvas(PATCH, PATCH, patch.night))!.setDataSource(pixelCanvas(PATCH, PATCH, patch.normal));
    const add = this.scene.add;
    const night = this.adopt(add.image(x, y, keys[1]).setOrigin(0).setPipeline('Lit').setDepth(DEPTH));
    const day = this.adopt(add.image(x, y, keys[0]).setOrigin(0).setPipeline('Lit').setDepth(DEPTH + 0.1).setAlpha(this.daylight));
    this.patches.set(p, { day, night, keys });
  }

  setLight(daylight: number): void {
    this.daylight = daylight;
    for (const p of this.patches.values()) p.day.setAlpha(daylight);
  }

  private drop(v: { day: Img; night: Img; keys: string[] }): void {
    v.day.destroy();
    v.night.destroy();
    for (const k of v.keys) this.scene.textures.remove(k);
  }

  destroy(): void {
    for (const v of this.patches.values()) this.drop(v);
    this.patches.clear();
  }
}
