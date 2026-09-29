// Builds a painted arena's textures off the main thread (see arenaLoader.ts).
//
// The arena's steps run as they would in the game, against a stand-in scene
// that writes down what they do: each texture's pixels, its frames, its
// normal map and each animation. The main thread plays that list back, a
// texture at a time, so the heavy part (drawing and lighting every pixel)
// never touches a frame.

import type Phaser from 'phaser';
import type { PixelImage } from './canvas';
import { ARENA_JOBS, type ArenaJob } from './textures';

/** One thing an arena's steps did to the scene, in the order they did it. */
export type ArenaOp =
  | { op: 'tex'; key: string; img: PixelImage }
  | { op: 'normal'; key: string; img: PixelImage }
  | { op: 'frame'; key: string; name: string | number; x: number; y: number; w: number; h: number }
  | { op: 'anim'; config: { key: string; frames: { key: string; frame: string | number }[]; frameRate?: number; repeat?: number } };

export interface ArenaResult {
  job: ArenaJob;
  ops: ArenaOp[];
}

interface WorkerScope {
  onmessage: ((e: MessageEvent<ArenaJob>) => void) | null;
  postMessage(message: ArenaResult, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

/** A scene with just the texture and animation calls the arenas' steps make. */
function recorder(ops: ArenaOp[]): Phaser.Scene {
  const anims = new Set<string>();
  const textures = {
    addCanvas(key: string, source: HTMLCanvasElement) {
      ops.push({ op: 'tex', key, img: source as unknown as PixelImage });
      const tex = {
        add(name: string | number, _source: number, x: number, y: number, w: number, h: number) {
          ops.push({ op: 'frame', key, name, x, y, w, h });
          return null;
        },
        setDataSource(normal: HTMLCanvasElement) {
          ops.push({ op: 'normal', key, img: normal as unknown as PixelImage });
          return tex;
        },
      };
      return tex;
    },
  };
  const animations = {
    create(config: Extract<ArenaOp, { op: 'anim' }>['config']) {
      anims.add(config.key);
      ops.push({ op: 'anim', config });
      return null;
    },
    exists: (key: string) => anims.has(key),
    generateFrameNames(key: string, o: { prefix?: string; start?: number; end?: number }) {
      const out: { key: string; frame: string }[] = [];
      for (let i = o.start ?? 0; i <= (o.end ?? 0); i++) out.push({ key, frame: `${o.prefix ?? ''}${i}` });
      return out;
    },
  };
  return { textures, anims: animations } as unknown as Phaser.Scene;
}

scope.onmessage = (e) => {
  const ops: ArenaOp[] = [];
  const steps = ARENA_JOBS[e.data].steps(recorder(ops));
  while (!steps.next().done);
  // The same pixels can back two textures; each buffer is handed over once.
  const buffers = new Set<ArrayBuffer>();
  for (const o of ops) if (o.op === 'tex' || o.op === 'normal') buffers.add(o.img.pixels.buffer);
  scope.postMessage({ job: e.data, ops }, [...buffers]);
};
