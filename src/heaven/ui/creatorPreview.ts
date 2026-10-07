// The wanderer in the dressing room: one image, its frames stepped by hand,
// drawn from small textures this file paints and throws away as the look
// changes. Only what's on screen is drawn: the idle frames of the way the
// wanderer faces (another way is painted when it turns), or an emote's
// frames while one plays. Changes come in fast when someone taps through
// options, so repaints wait a beat after the last one.

import type Phaser from 'phaser';
import { packAtlas } from '../../art/atlas';
import { pixelCanvas } from '../../art/canvas';
import { ANIMS, type AnimName } from '../art/rig';
import { wandererFrame, WFH, WFW, type Dir } from '../art/sheet';
import { bakeLit } from '../art/creatorArt';
import type { Appearance } from '../look';

/** The shortest wait between two repaints of the preview, ms. */
const REPAINT_GAP = 90;
/** How long a dance goes on before the wanderer settles, ms. */
const DANCE_MS = 2800;

export type PreviewEmote = 'wave' | 'cheer' | 'dance' | 'heart';

/** The four ways to face, in the order dragging to the right turns through them. */
export const TURN: Dir[] = ['down', 'right', 'up', 'left'];

let made = 0;

/** One animation's frames for one way of facing, lit and packed as a texture of its own. */
export function paintStrip(scene: Phaser.Scene, look: Appearance, anim: AnimName, dir: Dir): { key: string; frames: number } {
  const def = ANIMS.find((a) => a.name === anim)!;
  const view = dir === 'left' || dir === 'right' ? 'side' : dir;
  const frames = [];
  for (let i = 0; i < def.frames; i++) {
    const c = wandererFrame(look, anim, view, i);
    frames.push({ name: String(i), r: (dir === 'right' ? c.mirrored() : c).render() });
  }
  const atlas = packAtlas(frames, WFW, WFH, def.frames);
  const key = `hl_cr_pv${++made}`;
  const tex = scene.textures.addCanvas(key, pixelCanvas(atlas.w, atlas.h, bakeLit(atlas)))!;
  for (const r of atlas.rects) tex.add(r.name, 0, r.x, r.y, WFW, WFH);
  return { key, frames: def.frames };
}

interface Playing {
  key: string;
  frames: number;
  fps: number;
  loop: boolean;
  /** For an emote: when it ends, ms (a dance ends by time, the rest by their last frame). */
  until: number;
  emote: PreviewEmote | null;
}

export class Preview {
  readonly image: Phaser.GameObjects.Image;
  private scene: Phaser.Scene;
  private look: Appearance;
  private dir: Dir = 'down';
  private idle = new Map<Dir, string>();
  private playing: Playing | null = null;
  private frame = 0;
  private clock = 0;
  private dirty = true;
  private lastPaint = -Infinity;
  private elapsed = 0;
  /** Told when an emote starts, so the scene can float hearts or notes. */
  onEmote: ((e: PreviewEmote) => void) | null = null;

  constructor(scene: Phaser.Scene, look: Appearance) {
    this.scene = scene;
    this.look = { ...look };
    this.image = scene.add.image(0, 0, '__WHITE').setOrigin(0).setVisible(false);
  }

  get facing(): Dir {
    return this.dir;
  }

  setLook(look: Appearance): void {
    this.look = { ...look };
    this.dirty = true;
  }

  /** Face another way; its idle frames are painted if they aren't yet. */
  face(dir: Dir): void {
    if (dir === this.dir) return;
    this.dir = dir;
    if (this.playing?.emote) this.stopEmote();
    this.showIdle();
  }

  /** Turn a step: +1 to the right, -1 to the left. */
  turn(step: number): void {
    const i = TURN.indexOf(this.dir);
    this.face(TURN[(i + step + TURN.length * 4) % TURN.length]);
  }

  emote(e: PreviewEmote): void {
    // Emotes face the viewer.
    this.dir = 'down';
    if (this.dirty) this.paint();
    this.dropEmote();
    const def = ANIMS.find((a) => a.name === e)!;
    const strip = paintStrip(this.scene, this.look, e, 'down');
    this.playing = { key: strip.key, frames: strip.frames, fps: def.fps, loop: def.loop, until: def.loop ? this.elapsed + DANCE_MS : Infinity, emote: e };
    this.frame = 0;
    this.clock = 0;
    this.image.setTexture(strip.key, '0').setVisible(true);
    this.onEmote?.(e);
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.dirty && this.elapsed - this.lastPaint >= REPAINT_GAP) this.paint();
    const p = this.playing;
    if (!p) return;
    this.clock += dt;
    const step = 1000 / p.fps;
    while (this.clock >= step) {
      this.clock -= step;
      this.frame++;
      if (this.frame >= p.frames) {
        if (p.loop && this.elapsed < p.until) this.frame = 0;
        else if (p.emote) {
          this.stopEmote();
          return;
        } else this.frame = 0;
      }
    }
    this.image.setFrame(String(this.frame));
  }

  destroy(): void {
    this.dropEmote();
    for (const key of this.idle.values()) this.scene.textures.remove(key);
    this.idle.clear();
    this.image.destroy();
  }

  /** Repaint for a new look: the way it faces now; the other ways wait until they're turned to. */
  private paint(): void {
    this.dirty = false;
    this.lastPaint = this.elapsed;
    // An emote can't carry on in the old clothes.
    if (this.playing?.emote) this.dropEmote();
    const old = [...this.idle.values()];
    this.idle.clear();
    this.showIdle();
    for (const key of old) this.scene.textures.remove(key);
  }

  private showIdle(): void {
    let key = this.idle.get(this.dir);
    if (!key) {
      key = paintStrip(this.scene, this.look, 'idle', this.dir).key;
      this.idle.set(this.dir, key);
    }
    const def = ANIMS.find((a) => a.name === 'idle')!;
    const same = this.playing && !this.playing.emote;
    this.playing = { key, frames: def.frames, fps: def.fps, loop: true, until: Infinity, emote: null };
    // Keep the breathing's place when only the facing changes, so a turn doesn't hitch.
    if (!same) {
      this.frame = 0;
      this.clock = 0;
    }
    this.image.setTexture(key, String(this.frame % def.frames)).setVisible(true);
  }

  private stopEmote(): void {
    this.dropEmote();
    this.showIdle();
  }

  /** Forget an emote's texture (after the image has moved off it). */
  private dropEmote(): void {
    const p = this.playing;
    if (!p?.emote) return;
    this.playing = null;
    const key = p.key;
    // Move the image off it first: a texture in use mustn't vanish under it.
    const idle = this.idle.get(this.dir);
    if (idle) this.image.setTexture(idle, '0');
    else this.image.setTexture('__WHITE').setVisible(false);
    this.scene.textures.remove(key);
  }
}
