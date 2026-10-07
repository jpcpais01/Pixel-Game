// A wanderer's whole sheet from one appearance: every animation, every way
// it faces (right is left mirrored), packed and registered as textures with
// animations named like the heroes' (`<key>_<anim>_<dir>`). Built on demand
// and kept per appearance, so friends dressed alike share one.

import type Phaser from 'phaser';
import { PixelCanvas } from '../../art/pixel';
import { packAtlas, registerAtlas, type PixelAtlas } from '../../art/atlas';
import { encodeLook, type Appearance } from '../look';
import { GEAR } from './gear';
import { geometry, makeKit, type View } from './kit';
import { ANIMS, drawFigure, pose } from './rig';

export const WFW = 32;
export const WFH = 42;
/** Where the soles stand in a frame (its origin), as fractions. */
export const W_ORIGIN = { x: 16 / WFW, y: 40.5 / WFH };

export type Dir = 'down' | 'up' | 'left' | 'right';

export interface WandererSheet {
  atlas: PixelAtlas;
  anims: { key: string; frames: string[]; fps: number; loop: boolean }[];
}

/** One frame of one appearance, drawn. */
export function wandererFrame(a: Appearance, anim: (typeof ANIMS)[number]['name'], view: View, i: number): PixelCanvas {
  const k = makeKit(a);
  const c = new PixelCanvas(WFW, WFH);
  drawFigure(c, k, geometry(k, pose(k, anim, view, i)), GEAR);
  return c;
}

export function buildWanderer(a: Appearance, key: string): WandererSheet {
  const k = makeKit(a);
  const frames: { name: string; r: ReturnType<PixelCanvas['render']> }[] = [];
  const anims: WandererSheet['anims'] = [];
  for (const def of ANIMS) {
    for (const view of def.views) {
      const dirs: Dir[] = view === 'side' ? ['left', 'right'] : [view];
      const names: Record<string, string[]> = {};
      for (let i = 0; i < def.frames; i++) {
        const c = new PixelCanvas(WFW, WFH);
        drawFigure(c, k, geometry(k, pose(k, def.name, view, i)), GEAR);
        for (const d of dirs) {
          const name = `${def.name}_${d}_${i}`;
          frames.push({ name, r: (d === 'right' ? c.mirrored() : c).render() });
          (names[d] ??= []).push(name);
        }
      }
      for (const d of dirs) anims.push({ key: `${key}_${def.name}_${d}`, frames: names[d], fps: def.fps, loop: def.loop });
    }
  }
  return { atlas: packAtlas(frames, WFW, WFH, 16), anims };
}

/** The texture key for an appearance. */
export const wandererKey = (a: Appearance): string => `wd_${encodeLook(a)}`;

/** Builds and registers an appearance's sheet if it isn't yet; returns its key. */
export function ensureWanderer(scene: Phaser.Scene, a: Appearance): string {
  const key = wandererKey(a);
  if (scene.textures.exists(key)) return key;
  const sheet = buildWanderer(a, key);
  registerAtlas(scene, key, sheet.atlas, WFW, WFH);
  for (const an of sheet.anims) {
    if (scene.anims.exists(an.key)) scene.anims.remove(an.key);
    scene.anims.create({ key: an.key, frames: an.frames.map((frame) => ({ key, frame })), frameRate: an.fps, repeat: an.loop ? -1 : 0 });
  }
  return key;
}
