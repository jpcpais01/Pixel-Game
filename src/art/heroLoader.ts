// Hero sheets as textures, built when they're first needed or ahead of time
// by workers, instead of all of them during the loading screen.
//
// Nothing else has to know: asking the texture manager for a look's texture
// (or its `_e`, `_s`, `_w` layers) or the animation manager for one of its
// animations builds the look right there if it isn't built yet. Meanwhile
// workers build every look in the background, the ones on show first, and
// the main thread only uploads them, one per frame, so by the time a menu or
// a run needs a look it's usually waiting.

import Phaser from 'phaser';
import { registerAtlas } from './atlas';
import { buildHeroSheet, HERO_SHEETS, sheetFlashes, type HeroSheet, type MetaKind } from './heroSheets';
import type { FrameMeta } from './wizard';
import type { WarriorMeta } from './warrior';
import type { PaladinMeta } from './paladin';
import type { JediMeta } from './jedi';
import type { SamuraiMeta } from './samurai';

/** Most workers to run at once; a phone keeps a core or two for the game itself. */
const MAX_WORKERS = 3;

// Filled as each rig's looks are built.
export const wizardMeta = new Map<string, FrameMeta>();
export const warriorMeta = new Map<string, WarriorMeta>();
export const paladinMeta = new Map<string, PaladinMeta>();
export const jediMeta = new Map<string, JediMeta>();
export const samuraiMeta = new Map<string, SamuraiMeta>();
const METAS: Record<MetaKind, Map<string, unknown>> = { wizard: wizardMeta, warrior: warriorMeta, paladin: paladinMeta, jedi: jediMeta, samurai: samuraiMeta };

/** Looks not built yet, and which look each texture key belongs to. */
const pending = new Set<string>();
const owner = new Map<string, string>();
/** Pending looks, longest key first, to tell 'wizard_void_idle_down' from 'wizard_idle_down'. */
let byLength: string[] = [];
/** Set while a look is being registered: its own textures and animations mustn't set off another build. */
let building = false;
let home: Phaser.Scene | null = null;
/** Built by a worker, waiting for a frame to be uploaded in. */
const ready: HeroSheet[] = [];

function take(sheet: HeroSheet): void {
  if (!home || !pending.has(sheet.key)) return;
  pending.delete(sheet.key);
  byLength = byLength.filter((k) => k !== sheet.key);
  building = true;
  try {
    registerAtlas(home, sheet.key, sheet.atlas, sheet.fw, sheet.fh);
    for (const a of sheet.anims) {
      home.anims.create({ key: a.key, frames: a.frames.map((frame) => ({ key: sheet.key, frame })), frameRate: a.fps, repeat: a.loop ? -1 : 0 });
    }
    if (sheet.meta) {
      // Every look of a rig agrees on the frames they share, but not every
      // look has every frame (the King has no spin), so each adds what's new.
      // Each is also kept under its look's own key ('jedi_sith:idle_down_0'),
      // for rigs whose looks pose the same frame differently (the Sith's staff).
      const map = METAS[sheet.meta.kind];
      for (const [k, m] of sheet.meta.frames) {
        if (!map.has(k)) map.set(k, m);
        map.set(`${sheet.key}:${k}`, m);
      }
    }
  } finally {
    building = false;
  }
}

/** Build a look now, on this thread, because something needs it this moment. */
function buildNow(key: string): void {
  if (!pending.has(key)) return;
  const waiting = ready.findIndex((s) => s.key === key);
  take(waiting >= 0 ? ready.splice(waiting, 1)[0] : buildHeroSheet(key));
}

/**
 * Make the texture and animation managers build a look the first time
 * anything asks for one of its textures or animations. Call once, before
 * anything could ask.
 */
export function lazyHeroSheets(scene: Phaser.Scene): void {
  if (home) return;
  home = scene;
  for (const key of HERO_SHEETS) {
    pending.add(key);
    for (const k of [key, `${key}_e`, `${key}_s`, ...(sheetFlashes(key) ? [`${key}_w`] : [])]) owner.set(k, key);
  }
  byLength = [...HERO_SHEETS].sort((a, b) => b.length - a.length);

  // The texture manager keeps its textures in a plain object and reads it
  // directly everywhere (get, getFrame, exists), so a proxy on it sees every ask.
  const textures = scene.textures as Phaser.Textures.TextureManager & { list: Record<string, Phaser.Textures.Texture> };
  const wake = (k: string | symbol) => {
    if (building || typeof k !== 'string') return;
    const look = owner.get(k);
    if (look) buildNow(look);
  };
  textures.list = new Proxy(textures.list, {
    get(t, k, r) {
      if (!(k in t)) wake(k);
      return Reflect.get(t, k, r);
    },
    has(t, k) {
      if (!(k in t)) wake(k);
      return Reflect.has(t, k);
    },
    getOwnPropertyDescriptor(t, k) {
      if (!(k in t)) wake(k);
      return Reflect.getOwnPropertyDescriptor(t, k);
    },
  });

  // Animations live in a map; an animation named after a pending look builds it.
  const anims = scene.anims as Phaser.Animations.AnimationManager & { anims: Phaser.Structs.Map<string, Phaser.Animations.Animation> };
  const map = anims.anims;
  const get = map.get;
  const has = map.has;
  const wakeAnim = (key: string): void => {
    if (building || has.call(map, key)) return;
    for (const look of byLength) {
      if (!key.startsWith(`${look}_`)) continue;
      buildNow(look);
      if (has.call(map, key)) return;
    }
  };
  map.get = function (key: string) {
    wakeAnim(key);
    return get.call(map, key);
  };
  map.has = function (key: string) {
    wakeAnim(key);
    return has.call(map, key);
  };
}

/**
 * Build every look in the background, `first` before the rest: in workers
 * when the browser has them, else one look a frame here. Each finished look
 * is uploaded on a frame of its own.
 */
export function warmHeroSheets(game: Phaser.Game, first: string[]): void {
  const queue = [...new Set([...first.filter((k) => pending.has(k)), ...HERO_SHEETS])];
  const next = (): string | undefined => {
    let k = queue.shift();
    while (k !== undefined && !pending.has(k)) k = queue.shift();
    return k;
  };

  let workers = 0;
  const cores = navigator.hardwareConcurrency || 2;
  const count = Math.max(1, Math.min(MAX_WORKERS, cores - 1));
  try {
    for (let i = 0; i < count; i++) {
      const w = new Worker(new URL('./sheetWorker.ts', import.meta.url), { type: 'module' });
      workers++;
      let doing: string | undefined;
      const feed = () => {
        doing = next();
        if (doing !== undefined) w.postMessage(doing);
        else {
          w.terminate();
          workers--;
        }
      };
      w.onmessage = (e: MessageEvent<HeroSheet>) => {
        ready.push(e.data);
        feed();
      };
      // A worker that fails hands its look back, and leaves the rest to the others or to this thread.
      w.onerror = (e) => {
        e.preventDefault();
        w.terminate();
        workers--;
        if (doing !== undefined) queue.unshift(doing);
      };
      feed();
    }
  } catch {
    // No workers here; the main thread builds them below.
  }

  const step = () => {
    const sheet = ready.shift();
    if (sheet) take(sheet);
    else if (workers <= 0) {
      const k = next();
      if (k !== undefined) buildNow(k);
    }
    if (!pending.size && !ready.length) game.events.off(Phaser.Core.Events.POST_STEP, step);
  };
  game.events.on(Phaser.Core.Events.POST_STEP, step);
}
