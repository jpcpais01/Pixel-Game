// The Home's textures (see world/Home.ts): every wall piece and every placed
// thing drawn by homeProps.ts, packed on one lit sheet ('home', with its glow
// 'home_e' and sun shadow 'home_s'), and the build palette's floor and roof
// samples. Made once, the first time a Home is visited.
//
// A placed thing is described by `thingLook`: which texture and frame, where
// it stands, what glows on it and how it animates. Trees, bushes, ferns,
// stumps, the brazier and the rune crystal reuse the forest's own sheets.

import type Phaser from 'phaser';
import type { PixelCanvas, RenderedFrame } from './pixel';
import { pixelCanvas } from './canvas';
import { floorSwatch } from './homeFloors';
import { bridgeIcon } from './bridgeArt';
import { CHIMNEY_H, CHIMNEY_W, chimney, roofSwatch, wallFrameH, wallFrames } from './homeWalls';
import { PROP_ART as FIRST_ART, PROP_TURNS as FIRST_TURNS, blossomTree, bobber, emptyRodBucket, type PropArt } from './homeProps';
import { YARD_ART, YARD_TURNS } from './homeYard';
import { ROOM_ART, ROOM_TURNS } from './homeRoom';
import { DOOR_OX, DOOR_OY, DOOR_STEP, DOOR_STEPS, DOOR_WAYS, doorArt, doorFrame, doorIcon } from './homeDoor';
import { GATE_MATS, GATE_WAYS, gateFrames } from './homeGate';
import { TREE_SWAY_FPS, TREE_SWAY_FRAMES } from './trees';
import { hash2 } from './env';
import { CELL, HomeLayout, PLOT_X, PLOT_Y, type Thing } from '../world/homeLayout';
import { FLOORS, ROOFS, WALLS, extent, partById } from '../world/homeParts';

/** Every placed thing's drawing by part id, and the turning ones' other views (homeYard.ts and homeRoom.ts hold the later pieces). */
const PROP_ART: Record<string, PropArt> = { ...FIRST_ART, ...YARD_ART, ...ROOM_ART };
const PROP_TURNS: Record<string, { side: PropArt; back: PropArt }> = { ...FIRST_TURNS, ...YARD_TURNS, ...ROOM_TURNS };

/** How wide the sheet is; it grows downward as frames are packed. */
const SHEET_W = 1024;

/** Frames that glow, by their name without the frame number. */
const glowing = new Set<string>();

interface Packed {
  name: string;
  r: RenderedFrame;
  w: number;
  h: number;
  x: number;
  y: number;
}

/** Shelf-pack frames of any size onto one sheet, tallest first. */
function packSheet(list: { name: string; r: RenderedFrame; w: number; h: number }[]): { w: number; h: number; frames: Packed[] } {
  const frames: Packed[] = list.map((f) => ({ ...f, x: 0, y: 0 })).sort((a, b) => b.h - a.h || b.w - a.w);
  let x = 0;
  let y = 0;
  let row = 0;
  for (const f of frames) {
    if (x + f.w > SHEET_W) {
      x = 0;
      y += row + 1;
      row = 0;
    }
    f.x = x;
    f.y = y;
    x += f.w + 1;
    row = Math.max(row, f.h);
  }
  return { w: SHEET_W, h: y + row, frames };
}

type Entry = { name: string; r: RenderedFrame; w: number; h: number };

/** The sheet being painted, a piece at a time, and the pieces still to paint. */
let job: { list: Entry[]; tasks: (() => void)[]; next: number } | null = null;

/** Painting the sheet, cut into small pieces (a wall material, a part, a door's way...) so it can be spread over frames. */
function homeTasks(list: Entry[]): (() => void)[] {
  const tasks: (() => void)[] = [];
  const add = (name: string, c: PixelCanvas) => list.push({ name, r: c.render(), w: c.w, h: c.h });
  const frame = (name: string, r: RenderedFrame) => list.push({ name, r, w: r.w, h: r.h });

  WALLS.forEach((w, m) =>
    tasks.push(() => {
      for (const f of wallFrames(m)) add(`w:${w.id}:${f.name}`, f.canvas);
    }),
  );
  for (const [id, a] of Object.entries(PROP_ART)) {
    tasks.push(() => {
      const flip = !!partById(id)?.flip;
      for (let f = 0; f < a.frames; f++) {
        const c = a.draw(f);
        add(`p:${id}:${f}`, c);
        if (flip) add(`p:${id}:m${f}`, c.mirrored());
      }
    });
  }
  // Turned views: right, back, and left (the right one mirrored).
  for (const [id, v] of Object.entries(PROP_TURNS)) {
    tasks.push(() => {
      for (let f = 0; f < v.side.frames; f++) {
        const c = v.side.draw(f);
        add(`p:${id}:r${f}`, c);
        add(`p:${id}:l${f}`, c.mirrored());
      }
      for (let f = 0; f < v.back.frames; f++) add(`p:${id}:b${f}`, v.back.draw(f));
    });
  }
  // The cherry trees and their sway (the forest's trees sway from their own sheet, see game/treeSway.ts).
  for (let v = 0; v < 3; v++) for (let f = 0; f < TREE_SWAY_FRAMES; f++) tasks.push(() => add(f ? `p:blossom:${v}_${f}` : `p:blossom:${v}`, blossomTree(v, f)));
  tasks.push(() => {
    add('chimney', chimney());
    // The fishing rod's pail with its rod out at the water, and the float (see world/Fishing.ts).
    add('rodbucket', emptyRodBucket(false));
    add('rodbucket_m', emptyRodBucket(true));
    add('bobber', bobber());
    // The door's picture for the palette (mirrored: hinged on the right).
    frame('p:door:0', doorIcon(0));
    frame('p:door:m0', doorIcon(1));
  });
  // The door: every way it hangs and every step of its swing; and the garden gates, on the same steps (world/swing.ts).
  for (const way of DOOR_WAYS) for (let hinge = 0; hinge < 2; hinge++) tasks.push(() => {
    for (let s = 0; s < DOOR_STEPS; s++) frame(doorFrame(way, hinge, s), doorArt(way, hinge, s * DOOR_STEP));
  });
  for (const mat of GATE_MATS) for (const way of GATE_WAYS) tasks.push(() => {
    for (const f of gateFrames(DOOR_STEPS, DOOR_STEP, mat, way)) frame(f.name, f.r);
  });
  return tasks;
}

/**
 * Paint the Home's sheet for at most about `budget` ms, carrying on where
 * the last call stopped: the menus warm it a little each frame before the
 * Home is opened, as painting it at once holds the screen black for
 * seconds on a phone. True once it's made.
 */
export function warmHomeSoon(scene: Phaser.Scene, budget: number): boolean {
  if (scene.textures.exists('home')) return true;
  if (!job) {
    const list: Entry[] = [];
    job = { list, tasks: homeTasks(list), next: 0 };
  }
  const end = performance.now() + budget;
  while (job.next < job.tasks.length) {
    job.tasks[job.next++]();
    if (performance.now() >= end) break;
  }
  if (job.next < job.tasks.length) return false;
  const list = job.list;
  job = null;
  finishHome(scene, list);
  return true;
}

/** The Home's sheet and palette samples, made the first time they're needed (finishing any warming begun). */
export function warmHome(scene: Phaser.Scene): void {
  warmHomeSoon(scene, Infinity);
}

/** Pack the painted pieces on the sheet and register it, its animations and the palette's samples. */
function finishHome(scene: Phaser.Scene, list: Entry[]): void {
  const sheet = packSheet(list);
  const W = sheet.w;
  const H = sheet.h;
  const layers = { diffuse: new Uint8ClampedArray(W * H * 4), normal: new Uint8ClampedArray(W * H * 4), emissive: new Uint8ClampedArray(W * H * 4) };
  for (const f of sheet.frames) {
    let glows = false;
    for (const k of ['diffuse', 'normal', 'emissive'] as const) {
      const src = f.r[k];
      for (let y = 0; y < f.h; y++) layers[k].set(src.subarray(y * f.w * 4, (y + 1) * f.w * 4), ((f.y + y) * W + f.x) * 4);
    }
    const e = f.r.emissive;
    for (let i = 0; i < e.length && !glows; i += 4) if (e[i] > 6 || e[i + 1] > 6 || e[i + 2] > 6) glows = true;
    if (glows) glowing.add(f.name.replace(/:[mrbl]?\d+$/, ''));
  }
  const sil = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    sil[i * 4] = 6;
    sil[i * 4 + 1] = 8;
    sil[i * 4 + 2] = 22;
    sil[i * 4 + 3] = layers.diffuse[i * 4 + 3];
  }
  const tex = scene.textures.addCanvas('home', pixelCanvas(W, H, layers.diffuse))!;
  tex.setDataSource(pixelCanvas(W, H, layers.normal));
  const etex = scene.textures.addCanvas('home_e', pixelCanvas(W, H, layers.emissive))!;
  const stex = scene.textures.addCanvas('home_s', pixelCanvas(W, H, sil))!;
  for (const f of sheet.frames) for (const t of [tex, etex, stex]) t.add(f.name, 0, f.x, f.y, f.w, f.h);

  // Things that flicker animate their glow; their lit frame stays put.
  for (const [id, a] of Object.entries(PROP_ART)) {
    if (a.frames < 2) continue;
    for (const m of partById(id)?.flip ? ['', 'm'] : ['']) {
      scene.anims.create({
        key: `home_${id}${m ? '_m' : ''}`,
        frames: Array.from({ length: a.frames }, (_, f) => ({ key: 'home_e', frame: `p:${id}:${m}${f}` })),
        frameRate: a.fps,
        repeat: -1,
      });
    }
  }

  for (let v = 0; v < 3; v++) {
    scene.anims.create({
      key: `home_blossom${v}`,
      frames: Array.from({ length: TREE_SWAY_FRAMES }, (_, f) => ({ key: 'home', frame: f ? `p:blossom:${v}_${f}` : `p:blossom:${v}` })),
      frameRate: TREE_SWAY_FPS,
      repeat: -1,
    });
  }

  // The build palette's samples.
  FLOORS.forEach((f, i) => scene.textures.addCanvas(`hs_f${i + 1}`, pixelCanvas(16, 16, floorSwatch(f.id, 16))));
  ROOFS.forEach((_r, i) => scene.textures.addCanvas(`hs_r${i + 1}`, pixelCanvas(20, 20, roofSwatch(i + 1, 20, new HomeLayout()))));
  const bridge = bridgeIcon();
  scene.textures.addCanvas('hs_bridge', pixelCanvas(bridge.w, bridge.h, bridge.px));
}

/** Whether a frame on the sheet has anything that glows. */
export const glows = (frame: string): boolean => glowing.has(frame) || glowing.has(frame.replace(/:[mrbl]?\d+$/, ''));

/** A wall cell's frame on the sheet. */
export const wallFrameName = (mat: number, frame: string): string => `w:${WALLS[mat].id}:${frame}`;
export { wallFrameH, CHIMNEY_W, CHIMNEY_H, DOOR_OX, DOOR_OY };

/** How a placed thing is drawn. */
export interface ThingLook {
  key: string;
  frame: string;
  /** Its glow's texture, or null; and the animation that plays on it. */
  glow: string | null;
  anim: string | null;
  /** Mirrored with setFlipX (the forest's sheets have no mirrored frames). */
  flipX: boolean;
  /** A tree's sway, played on the thing itself once it exists (see game/treeSway.ts). */
  sway: string | null;
  /** Where it stands in the world (its foot), and that point in its frame, as an origin. */
  x: number;
  y: number;
  ox: number;
  oy: number;
}

/** The forest's sheets: frame size, where a thing's foot is in its frame, and how many variants. */
const REUSED: Record<string, { key: string; prefix: string; w: number; h: number; fx: number; fy: number; n: number; glow?: string; anim?: string }> = {
  oak: { key: 'tree', prefix: 'oak', w: 96, h: 128, fx: 48, fy: 124, n: 3 },
  birch: { key: 'tree', prefix: 'birch', w: 96, h: 128, fx: 48, fy: 124, n: 3 },
  pine: { key: 'tree', prefix: 'pine', w: 96, h: 128, fx: 48, fy: 124, n: 3 },
  blossom: { key: 'home', prefix: 'p:blossom:', w: 96, h: 128, fx: 48, fy: 124, n: 3 },
  bush: { key: 'flora', prefix: 'bush', w: 48, h: 26, fx: 24, fy: 23, n: 2 },
  fern: { key: 'flora', prefix: 'fern', w: 48, h: 26, fx: 24, fy: 23, n: 2 },
  stump: { key: 'flora', prefix: 'stump', w: 48, h: 26, fx: 24, fy: 23, n: 2 },
  brazier: { key: 'brazier', prefix: 'f', w: 16, h: 26, fx: 8, fy: 25, n: 1, glow: 'brazier_e', anim: 'brazier_burn' },
  crystal: { key: 'crystals', prefix: 'c', w: 20, h: 22, fx: 10, fy: 20, n: 2, glow: 'crystals_e' },
};

/** A thing's foot in the world: the middle of its footprint's south edge, a few px in. */
export function thingFoot(t: Thing): { x: number; y: number } {
  const p = partById(t.id)!;
  const e = extent(p, t.turn);
  return { x: PLOT_X + (t.x + e.w / 2) * CELL, y: PLOT_Y + (t.y + e.h) * CELL - (e.w === 1 && e.h === 1 && !p.flat ? 3 : 2) };
}

export function thingLook(t: Thing): ThingLook {
  const p = partById(t.id)!;
  const foot = thingFoot(t);
  if (p.door) {
    // Shut, face on, standing in its doorway (the world swings it: see world/Home.ts).
    return { key: 'home', frame: t.flip ? 'p:door:m0' : 'p:door:0', glow: 'home_e', anim: null, flipX: false, sway: null, x: PLOT_X + t.x * CELL, y: PLOT_Y + t.y * CELL - DOOR_OY, ox: 0, oy: 0 };
  }
  const r = REUSED[t.id];
  if (r) {
    const v = Math.floor(hash2(t.x, t.y, 919) * r.n);
    return {
      key: r.key,
      frame: `${r.prefix}${v}`,
      glow: r.glow ?? null,
      anim: r.anim ?? null,
      flipX: t.flip,
      sway: t.id === 'blossom' ? `home_blossom${v}` : r.key === 'tree' ? `tree_${r.prefix}${v}` : null,
      x: foot.x,
      y: foot.y,
      ox: r.fx / r.w,
      oy: r.fy / r.h,
    };
  }
  // A turned part: its side or back view (a left turn is the right one mirrored).
  const view = p.turns ? ['', 'r', 'b', 'l'][t.turn & 3] : '';
  const turned = PROP_TURNS[t.id];
  const a: PropArt = view && turned ? (view === 'b' ? turned.back : turned.side) : PROP_ART[t.id];
  const m = view || (t.flip && p.flip ? 'm' : '');
  // The foot in the frame: the frame's corner sits at (dx, dy) from the footprint's.
  const fx = foot.x - (PLOT_X + t.x * CELL + a.dx);
  const fy = foot.y - (PLOT_Y + t.y * CELL + a.dy);
  return {
    key: 'home',
    frame: `p:${t.id}:${m}0`,
    glow: glowing.has(`p:${t.id}`) ? 'home_e' : null,
    anim: a.frames > 1 ? `home_${t.id}${m ? '_m' : ''}` : null,
    flipX: false,
    sway: null,
    x: foot.x,
    y: foot.y,
    ox: fx / a.w,
    oy: fy / a.h,
  };
}

/** A part's picture for the build palette: its texture and frame. */
export function partIcon(id: string): { key: string; frame: string } {
  // A bridge has no one look: it shapes itself to the cells laid (see art/bridgeArt.ts).
  if (partById(id)?.bridge) return { key: 'hs_bridge', frame: '__BASE' };
  const r = REUSED[id];
  if (r) return { key: r.key, frame: `${r.prefix}0` };
  return { key: 'home', frame: `p:${id}:0` };
}
