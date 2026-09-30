// The painted arenas' textures, built by a worker and only uploaded here.
//
// An arena is a few big lit images (the Glimmerdeep's floor is a whole cave)
// plus props and monster sheets, and drawing them took seconds of main-thread
// time: done a slice per frame on the menus, it cost frames there; done at
// once when a run starts, it froze the screen. Now a worker draws them (see
// arenaWorker.ts) and this side turns the finished pixels into textures, one
// texture per call, so a menu keeps its frame rate while an arena loads.

import type Phaser from 'phaser';
import { pixelCanvas, type PixelImage } from './canvas';
import { ARENA_JOBS, type ArenaJob } from './textures';
import type { ArenaOp, ArenaResult } from './arenaWorker';

interface Job {
  /** What the worker built, once it has; played back from `next`. */
  ops: ArenaOp[] | null;
  next: number;
  /** Textures made so far, by key: an atlas makes all its layers before it names their frames. */
  made: Map<string, Phaser.Textures.Texture>;
  /** Built here instead: no worker, the worker failed, or the world needed it before the worker was done. */
  local: Generator<void, void, void> | null;
}

/** One set of jobs per texture manager (so per game). */
const jobs = new WeakMap<Phaser.Textures.TextureManager, Map<ArenaJob, Job>>();
let worker: Worker | null = null;
/** Set once workers turn out not to work here: every job is built on this thread. */
let noWorker = false;
/** Where each job's result goes when it comes back. */
const waiting = new Map<ArenaJob, Job>();

function ask(job: ArenaJob, j: Job): void {
  if (noWorker) return;
  try {
    if (!worker) {
      worker = new Worker(new URL('./arenaWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<ArenaResult>) => {
        const w = waiting.get(e.data.job);
        waiting.delete(e.data.job);
        if (w && !w.local) w.ops = e.data.ops;
      };
      // A worker that fails leaves every job still out to this thread.
      worker.onerror = (e) => {
        e.preventDefault();
        worker?.terminate();
        worker = null;
        noWorker = true;
        waiting.clear();
      };
    }
    waiting.set(job, j);
    worker.postMessage(job);
  } catch {
    noWorker = true;
  }
}

const image = (img: PixelImage): HTMLCanvasElement => pixelCanvas(img.width, img.height, img.pixels);

/** Play back up to the next texture upload (or all the rest, when `all`). True once it's all played. */
function replay(scene: Phaser.Scene, j: Job, all: boolean): boolean {
  const ops = j.ops!;
  let uploaded = false;
  for (; j.next < ops.length; j.next++) {
    const o = ops[j.next];
    if (o.op === 'tex') {
      if (uploaded && !all) return false;
      uploaded = true;
      // One already there is left be, along with its frames.
      if (!scene.textures.exists(o.key)) j.made.set(o.key, scene.textures.addCanvas(o.key, image(o.img))!);
    } else if (o.op === 'normal') j.made.get(o.key)?.setDataSource(image(o.img));
    else if (o.op === 'frame') j.made.get(o.key)?.add(o.name, 0, o.x, o.y, o.w, o.h);
    else if (!scene.anims.exists(o.config.key)) scene.anims.create(o.config);
  }
  return true;
}

/**
 * Build a painted arena's textures, spending at most `budget` ms of this
 * thread: with a worker, that's asking for them and then uploading a texture
 * per call once they're back. A budget of 0 only checks; Infinity (the world,
 * which needs them now) finishes them at once, here if the worker isn't done.
 * True once they're all there.
 */
export function warmArenaTextures(scene: Phaser.Scene, job: ArenaJob, budget: number): boolean {
  const def = ARENA_JOBS[job];
  if (scene.textures.exists(def.done)) return true;
  if (budget <= 0) return false;
  let all = jobs.get(scene.textures);
  if (!all) jobs.set(scene.textures, (all = new Map()));
  let j = all.get(job);
  if (!j) {
    all.set(job, (j = { ops: null, next: 0, made: new Map(), local: null }));
    ask(job, j);
  }
  const done = () => {
    all.delete(job);
    return true;
  };

  if (j.ops) {
    if (budget === Infinity) return replay(scene, j, true) && done();
    const start = performance.now();
    do if (replay(scene, j, false)) return done();
    while (performance.now() - start < budget);
    return false;
  }
  if (!j.local && (budget === Infinity || noWorker)) {
    j.local = def.steps(scene);
    waiting.delete(job);
  }
  if (!j.local) return false;
  const start = performance.now();
  while (performance.now() - start < budget) if (j.local.next().done) return done();
  return false;
}

// Each painted arena's set, at most `budget` ms at a time (see warmArenaTextures).
export const warmCosmos = (scene: Phaser.Scene, budget = Infinity): boolean => warmArenaTextures(scene, 'cosmos', budget);
export const warmIsland = (scene: Phaser.Scene, budget = Infinity): boolean => warmArenaTextures(scene, 'island', budget);
export const warmRift = (scene: Phaser.Scene, budget = Infinity): boolean => warmArenaTextures(scene, 'rift', budget);
export const warmSpirit = (scene: Phaser.Scene, budget = Infinity): boolean => warmArenaTextures(scene, 'spirit', budget);
export const warmTemple = (scene: Phaser.Scene, budget = Infinity): boolean => warmArenaTextures(scene, 'temple', budget);
export const warmDeep = (scene: Phaser.Scene, budget = Infinity): boolean => warmArenaTextures(scene, 'deep', budget);
/** Sky Glide flies off the Floating Island, so it builds the island's set as well as its own. */
export const warmGlide = (scene: Phaser.Scene, budget = Infinity): boolean => {
  const island = warmIsland(scene, budget);
  return warmArenaTextures(scene, 'glide', budget) && island;
};
