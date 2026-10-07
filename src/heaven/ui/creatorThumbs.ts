// The little pictures on the creator's choices: each option worn by the
// wanderer being made, cropped to where it shows (the head for hats, the
// face drawn twice as big for eyes and mouths, the back for wings), and the
// wardrobe's saved outfits as tiny full portraits. They are painted a few at
// a time each frame into two canvas textures that live as long as the scene,
// so tapping through options never stalls and memory stays flat.

import type Phaser from 'phaser';
import { wandererFrame, WFH, WFW } from '../art/sheet';
import { bakeLit } from '../art/creatorArt';
import type { View } from '../art/kit';
import type { Appearance } from '../look';

/** A thumbnail's picture, px (it sits in a slightly bigger tile). */
export const THUMB = 20;
/** Thumbnails the sheet holds: enough for the busiest tab (Accessories). */
const THUMB_COLS = 10;
const THUMB_ROWS = 8;
export const THUMB_SLOTS = THUMB_COLS * THUMB_ROWS;
export const OUTFIT_SLOTS_DRAWN = 8;
/** Painting time allowed a frame, ms: the rest waits for the next. */
const BUDGET_MS = 4;

export type ThumbKind = 'head' | 'face' | 'torso' | 'dress' | 'legs' | 'feet' | 'back' | 'hand';

/** Where each kind looks, in the frame (the head's centre is at 16, 21.5 less one when tall), and how much it's enlarged. */
const CROPS: Record<ThumbKind, { view: View; x: number; y: number; zoom: 1 | 2; tallLifts: boolean }> = {
  head: { view: 'down', x: 16, y: 18, zoom: 1, tallLifts: true },
  face: { view: 'down', x: 16, y: 22, zoom: 2, tallLifts: true },
  torso: { view: 'down', x: 16, y: 29, zoom: 1, tallLifts: true },
  dress: { view: 'down', x: 16, y: 31, zoom: 1, tallLifts: false },
  legs: { view: 'down', x: 16, y: 32, zoom: 1, tallLifts: false },
  feet: { view: 'down', x: 16, y: 39, zoom: 2, tallLifts: false },
  back: { view: 'up', x: 16, y: 28, zoom: 1, tallLifts: true },
  hand: { view: 'down', x: 19, y: 30, zoom: 1, tallLifts: true },
};

interface Job {
  sheet: 'thumb' | 'outfit';
  slot: number;
  look: () => Appearance;
  kind?: ThumbKind;
}

export class Thumbs {
  readonly thumbKey = 'hl_cr_thumbs';
  readonly outfitKey = 'hl_cr_outfits';
  private thumbs: Phaser.Textures.CanvasTexture;
  private outfits: Phaser.Textures.CanvasTexture;
  private jobs: Job[] = [];

  constructor(scene: Phaser.Scene) {
    // A scene that closed without cleaning up mustn't block the new sheets.
    for (const k of [this.thumbKey, this.outfitKey]) if (scene.textures.exists(k)) scene.textures.remove(k);
    this.thumbs = scene.textures.createCanvas(this.thumbKey, THUMB_COLS * THUMB, THUMB_ROWS * THUMB)!;
    for (let i = 0; i < THUMB_SLOTS; i++) this.thumbs.add(`t${i}`, 0, (i % THUMB_COLS) * THUMB, Math.floor(i / THUMB_COLS) * THUMB, THUMB, THUMB);
    this.outfits = scene.textures.createCanvas(this.outfitKey, OUTFIT_SLOTS_DRAWN * WFW, WFH)!;
    for (let i = 0; i < OUTFIT_SLOTS_DRAWN; i++) this.outfits.add(`o${i}`, 0, i * WFW, 0, WFW, WFH);
  }

  /** Forget what's waiting and blank the sheets (a new tab shows fresh tiles filling in, not the last tab's). */
  clear(): void {
    this.jobs = [];
    this.thumbs.context.clearRect(0, 0, this.thumbs.width, this.thumbs.height);
    this.thumbs.refresh();
  }

  /** Paint a thumbnail of `look()` (read when it's painted, so it's always the latest) in a slot. */
  thumb(slot: number, kind: ThumbKind, look: () => Appearance): void {
    if (slot >= THUMB_SLOTS) return;
    this.jobs = this.jobs.filter((j) => j.sheet !== 'thumb' || j.slot !== slot);
    this.jobs.push({ sheet: 'thumb', slot, kind, look });
  }

  /** Paint an outfit's portrait; null leaves the slot empty. */
  outfit(slot: number, look: (() => Appearance) | null): void {
    this.jobs = this.jobs.filter((j) => j.sheet !== 'outfit' || j.slot !== slot);
    if (look) this.jobs.push({ sheet: 'outfit', slot, look });
    else {
      this.outfits.context.clearRect(slot * WFW, 0, WFW, WFH);
      this.outfits.refresh();
    }
  }

  /** Paint what fits in this frame's budget. */
  update(): void {
    if (!this.jobs.length) return;
    const start = performance.now();
    let thumbs = false;
    let outfits = false;
    while (this.jobs.length && performance.now() - start < BUDGET_MS) {
      const j = this.jobs.shift()!;
      if (j.sheet === 'thumb') {
        this.paintThumb(j.slot, j.kind!, j.look());
        thumbs = true;
      } else {
        this.paintOutfit(j.slot, j.look());
        outfits = true;
      }
    }
    if (thumbs) this.thumbs.refresh();
    if (outfits) this.outfits.refresh();
  }

  private paintThumb(slot: number, kind: ThumbKind, look: Appearance): void {
    const crop = CROPS[kind];
    const r = wandererFrame(look, 'idle', crop.view, 0).render();
    const lit = bakeLit({ w: WFW, h: WFH, diffuse: r.diffuse, normal: r.normal, emissive: r.emissive });
    const span = THUMB / crop.zoom;
    const x0 = Math.round(crop.x - span / 2);
    const y0 = Math.round(crop.y - (crop.tallLifts && look.height ? 1 : 0) - span / 2);
    const out = new Uint8ClampedArray(THUMB * THUMB * 4);
    for (let y = 0; y < THUMB; y++) {
      const sy = y0 + Math.floor(y / crop.zoom);
      if (sy < 0 || sy >= WFH) continue;
      for (let x = 0; x < THUMB; x++) {
        const sx = x0 + Math.floor(x / crop.zoom);
        if (sx < 0 || sx >= WFW) continue;
        const s = (sy * WFW + sx) * 4;
        out.set(lit.subarray(s, s + 4), (y * THUMB + x) * 4);
      }
    }
    this.thumbs.context.putImageData(new ImageData(out, THUMB, THUMB), (slot % THUMB_COLS) * THUMB, Math.floor(slot / THUMB_COLS) * THUMB);
  }

  private paintOutfit(slot: number, look: Appearance): void {
    const r = wandererFrame(look, 'idle', 'down', 0).render();
    const lit = bakeLit({ w: WFW, h: WFH, diffuse: r.diffuse, normal: r.normal, emissive: r.emissive });
    this.outfits.context.putImageData(new ImageData(lit, WFW, WFH), slot * WFW, 0);
  }
}
