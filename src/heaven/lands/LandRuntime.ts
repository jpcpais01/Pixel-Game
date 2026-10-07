// A land as it is walked (see types.ts for what a land is): its ground
// painted tile by tile round the view, by workers when the browser has them
// (landWorker.ts) and else here a few rows a frame; what stands in each
// chunk stood up as lit sprites with sun shadows, and taken down once the
// view is far away; the nearest lanterns given the world's point lights
// (there are only 16 for everything, so a land takes a few); and the shared
// little lives: walkers on the ground (crabs) and flyers overhead (gulls).
// A land's own living parts come from its `extra`.

import Phaser from 'phaser';
import { sound } from '../../audio';
import { packAtlas, registerAtlas } from '../../art/atlas';
import { pixelCanvas } from '../../art/canvas';
import type { CozyLand } from '../../game/cozy';
import { SUN_SHADOW_ALPHA, sunShadow } from '../../game/Wizard';
import type { WorldScene } from '../../scenes/WorldScene';
import { LandWorld } from './landWorld';
import { paintSteps } from './paint';
import type { TileAsk, TileDone } from './landWorker';
import { CHUNK, TILE_H, TILE_W, type FlyerDef, type LandDef, type LandExtra, type LandLight, type LandTile, type SheetDef, type WalkerDef } from './types';

type Img = Phaser.GameObjects.Image;
type Sprite = Phaser.GameObjects.Sprite;

/** Ground tiles kept round the view (in tiles past its edges) before they are dropped, and painted ahead of it. */
const AHEAD = 1;
const KEEP = 2;
/** Workers painting the ground (at most), and tiles asked of each at once. */
const MAX_WORKERS = 2;
const IN_FLIGHT = 2;
/** A tile in view still missing after this long (ms) is painted here at once. */
const MISSING_MS = 1200;
/** ms of painting a frame on the main thread, when there are no workers. */
const PAINT_BUDGET = 3;
/** How far past the view (px) a chunk's things are stood up, and past which they are taken down. */
const STAND = 120;
const FORGET = CHUNK * 2;
/** Chunks stood up per frame ahead of the view (those already in it come at once). */
const CHUNKS_PER_FRAME = 1;
/** Point lights a land may hold at once, and how often (ms) they go to the lanterns nearest the view. */
const MAX_LIGHTS = 6;
const LIGHT_EVERY = 300;
/** How often (ms) the land's ambient sound is asked again. */
const SOUND_EVERY = 250;
/** The ground's glow (plankton, glowing moss) by daylight: gone by day, full by night. */
const glowFor = (d: number): number => Math.max(0, Math.min(1, 1.15 - d * 1.5));

interface Tile {
  night: Img;
  day: Img;
  glow: Img | null;
  x: number;
  y: number;
}

interface Placed {
  obj: Img | Sprite;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Walker {
  def: WalkerDef;
  obj: Sprite;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** ms left of what it's doing. */
  t: number;
  mode: 'idle' | 'walk' | 'run';
}

interface Stood {
  placed: Placed[];
  shadows: Img[];
  glows: Img[];
  lights: LandLight[];
  walkers: Walker[];
}

interface Flyer {
  def: FlyerDef;
  obj: Sprite;
  shadow: Img;
  cx: number;
  cy: number;
  a: number;
  r: number;
  dir: number;
}

interface Lamp {
  light: Phaser.GameObjects.Light;
  halo: Img | null;
  seed: number;
}

/** Build a land's prop sheets, a sheet at a time within `budget` ms; true once they're all in. */
export function warmSheets(scene: Phaser.Scene, sheets: SheetDef[], budget: number): boolean {
  const t0 = performance.now();
  for (const s of sheets) {
    if (scene.textures.exists(s.key)) continue;
    if (performance.now() - t0 > budget) return false;
    registerAtlas(scene, s.key, packAtlas(s.frames.map((f) => ({ name: f.name, r: f.draw().render() })), s.w, s.h, 8), s.w, s.h, !!s.glows);
    for (const a of s.anims ?? []) {
      const key = `${s.key}_${a.name}`;
      if (!scene.anims.exists(key)) scene.anims.create({ key, frames: a.frames.map((frame) => ({ key: s.key, frame })), frameRate: a.fps, repeat: a.loop ? -1 : 0 });
    }
  }
  return true;
}

export class LandRuntime implements CozyLand {
  private readonly sheets: Map<string, SheetDef>;
  private tiles = new Map<number, Tile>();
  private asked = new Set<number>();
  private arrived: LandTile[] = [];
  private pool: { w: Worker; out: number }[] | null = null;
  private job: { key: number; steps: Generator<void, LandTile, void> } | null = null;
  private missingT = 0;
  private first = true;
  private stood = new Map<number, Stood>();
  private flyers: Flyer[] = [];
  private lamps = new Map<LandLight, Lamp>();
  private lightT = LIGHT_EVERY;
  private soundT = 0;
  private daylight = -1;
  private glowAlpha = -1;
  private shadowAlpha = -1;
  private extra: LandExtra | null;
  private dead = false;

  constructor(
    private world: WorldScene,
    private def: LandDef,
    private land: LandWorld,
    private adopt: (img: Img) => Img,
  ) {
    const sheets = def.sheets();
    this.sheets = new Map(sheets.map((s) => [s.key, s]));
    // Whatever the way in didn't warm is built now.
    warmSheets(world, sheets, Infinity);
    this.startPool();
    for (const f of def.flyers ?? []) for (let k = 0; k < f.count; k++) this.flyers.push(this.makeFlyer(f, k));
    this.extra = def.extra?.(world, land.gen, adopt) ?? null;
  }

  update(time: number, dt: number, daylight: number, hero: { x: number; y: number }, view: Phaser.Geom.Rectangle): void {
    if (this.dead) return;
    this.updateGround(view, dt);
    this.setLight(daylight);
    this.updateStanding(view);
    this.updateWalkers(dt, hero, view);
    this.updateFlyers(dt, view, daylight);
    this.lightT += dt;
    if (this.lightT >= LIGHT_EVERY) {
      this.lightT = 0;
      this.assignLights(view);
    }
    this.updateLamps(time, daylight);
    this.soundT -= dt;
    if (this.def.sound && this.soundT <= 0) {
      this.soundT = SOUND_EVERY;
      sound.setWild(this.def.sound(this.land.gen, hero.x, hero.y, time));
    }
    this.extra?.update(time, dt, daylight, hero, view);
  }

  destroy(): void {
    this.dead = true;
    this.stopPool();
    this.job = null;
    for (const key of [...this.tiles.keys()]) this.dropTile(key);
    for (const key of [...this.stood.keys()]) this.unstand(key);
    for (const f of this.flyers) {
      f.obj.destroy();
      f.shadow.destroy();
    }
    this.flyers = [];
    for (const l of this.lamps.values()) this.freeLamp(l);
    this.lamps.clear();
    this.extra?.destroy();
    this.extra = null;
    if (this.def.sound) sound.setWild(null);
  }

  // ---------------------------------------------------------------- the ground

  private static tileKey(col: number, row: number): number {
    return col * 16384 + row;
  }

  private texKey(col: number, row: number): string {
    return `land_${this.def.id}_${col}_${row}`;
  }

  private ready(key: number): boolean {
    return this.world.textures.exists(this.texKey(Math.floor(key / 16384), key % 16384));
  }

  /** Tiles covering `view` grown by `pad` tiles, nearest its middle first. */
  private wanted(view: Phaser.Geom.Rectangle, pad: number): number[] {
    const c0 = Math.floor(view.left / TILE_W) - pad;
    const c1 = Math.floor(view.right / TILE_W) + pad;
    const r0 = Math.floor(view.top / TILE_H) - pad;
    const r1 = Math.floor(view.bottom / TILE_H) + pad;
    const out: { k: number; d: number }[] = [];
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const d = Math.abs((c + 0.5) * TILE_W - view.centerX) / TILE_W + Math.abs((r + 0.5) * TILE_H - view.centerY) / TILE_H;
        out.push({ k: LandRuntime.tileKey(c, r), d });
      }
    }
    return out.sort((a, b) => a.d - b.d).map((o) => o.k);
  }

  private near(col: number, row: number, view: Phaser.Geom.Rectangle): boolean {
    return col >= Math.floor(view.left / TILE_W) - KEEP && col <= Math.floor(view.right / TILE_W) + KEEP && row >= Math.floor(view.top / TILE_H) - KEEP && row <= Math.floor(view.bottom / TILE_H) + KEEP;
  }

  private updateGround(view: Phaser.Geom.Rectangle, dt: number): void {
    const inView = this.wanted(view, 0);
    if (this.first) {
      // The world opening: what it shows is painted now, so it never opens on a hole.
      this.first = false;
      for (const k of inView) if (!this.ready(k)) this.paintNow(k);
    }
    if (this.pool) {
      // What came back: all of it while the view has holes, else one texture upload a frame.
      const holes = inView.some((k) => !this.ready(k));
      while (this.arrived.length) {
        this.land_(this.arrived.shift()!, view);
        if (!holes) break;
      }
      for (const k of this.wanted(view, AHEAD)) if (!this.ready(k) && !this.asked.has(k) && !this.ask(k)) break;
      const hole = inView.find((k) => !this.ready(k));
      this.missingT = hole === undefined ? 0 : this.missingT + dt;
      if (hole !== undefined && this.missingT > MISSING_MS) this.paintNow(hole);
    } else {
      for (const k of inView) {
        if (this.ready(k)) continue;
        if (this.job?.key === k) this.job = null;
        this.paintNow(k);
      }
      const t0 = performance.now();
      while (performance.now() - t0 < PAINT_BUDGET) {
        if (!this.job) {
          const next = this.wanted(view, AHEAD).find((k) => !this.ready(k));
          if (next === undefined) break;
          this.job = { key: next, steps: paintSteps(this.land.gen.ground, Math.floor(next / 16384), next % 16384) };
        }
        const r = this.job.steps.next();
        if (r.done) {
          this.job = null;
          this.install(r.value);
        }
      }
    }
    for (const k of this.wanted(view, AHEAD)) if (this.ready(k)) this.showTile(k);
    for (const [k, t] of this.tiles) {
      if (!this.near(Math.floor(k / 16384), k % 16384, view)) {
        this.dropTile(k);
        continue;
      }
      const on = t.x < view.right && t.x + TILE_W > view.left && t.y < view.bottom && t.y + TILE_H > view.top;
      t.night.setVisible(on && this.daylight < 0.99);
      t.day.setVisible(on && this.daylight > 0.01);
      t.glow?.setVisible(on && this.glowAlpha > 0.01);
    }
  }

  private paintNow(key: number): void {
    const steps = paintSteps(this.land.gen.ground, Math.floor(key / 16384), key % 16384);
    let r = steps.next();
    while (!r.done) r = steps.next();
    this.install(r.value);
  }

  /** A painted tile's pixels as textures: night and day sharing one normal map, and its glow. */
  private install(t: LandTile): void {
    const k = this.texKey(t.col, t.row);
    const textures = this.world.textures;
    if (textures.exists(k)) return;
    const normal = pixelCanvas(t.w, t.h, t.normal);
    textures.addCanvas(k, pixelCanvas(t.w, t.h, t.night))!.setDataSource(normal);
    textures.addCanvas(`${k}_day`, pixelCanvas(t.w, t.h, t.day))!.setDataSource(normal);
    if (t.glow) textures.addCanvas(`${k}_e`, pixelCanvas(t.w, t.h, t.glow));
  }

  private showTile(key: number): void {
    if (this.tiles.has(key)) return;
    const col = Math.floor(key / 16384);
    const row = key % 16384;
    const k = this.texKey(col, row);
    const x = col * TILE_W;
    const y = row * TILE_H;
    const add = this.world.add;
    const night = this.adopt(add.image(x, y, k).setOrigin(0).setPipeline('Lit').setDepth(0));
    const day = this.adopt(add.image(x, y, `${k}_day`).setOrigin(0).setPipeline('Lit').setDepth(1).setAlpha(Math.max(0, this.daylight)));
    const glow = this.world.textures.exists(`${k}_e`) ? this.adopt(add.image(x, y, `${k}_e`).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(2).setAlpha(Math.max(0, this.glowAlpha))) : null;
    this.tiles.set(key, { night, day, glow, x, y });
  }

  private dropTile(key: number): void {
    const t = this.tiles.get(key);
    if (t) {
      this.tiles.delete(key);
      t.night.destroy();
      t.day.destroy();
      t.glow?.destroy();
    }
    const k = this.texKey(Math.floor(key / 16384), key % 16384);
    const textures = this.world.textures;
    for (const name of [k, `${k}_day`, `${k}_e`]) if (textures.exists(name)) textures.remove(name);
  }

  private setLight(d: number): void {
    const g = glowFor(d);
    if (Math.abs(d - this.daylight) > 0.002 || Math.abs(g - this.glowAlpha) > 0.002) {
      this.daylight = d;
      this.glowAlpha = g;
      for (const t of this.tiles.values()) {
        t.day.setAlpha(d);
        t.glow?.setAlpha(g);
      }
      for (const st of this.stood.values()) for (const gl of st.glows) gl.setAlpha(0.35 + g * 0.65);
    }
    const s = SUN_SHADOW_ALPHA * d;
    if (Math.abs(s - this.shadowAlpha) > 0.002) {
      this.shadowAlpha = s;
      for (const st of this.stood.values()) for (const sh of st.shadows) sh.setAlpha(s);
    }
  }

  // ---------------------------------------------------------------- the painters

  private startPool(): void {
    if (typeof Worker === 'undefined') return;
    const n = Math.min(MAX_WORKERS, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
    try {
      const pool: { w: Worker; out: number }[] = [];
      for (let i = 0; i < n; i++) {
        const w = new Worker(new URL('./landWorker.ts', import.meta.url), { type: 'module' });
        const p = { w, out: 0 };
        w.onmessage = (e: MessageEvent<TileDone>) => {
          p.out--;
          if (e.data.land === this.def.id) this.arrived.push(e.data.tile);
        };
        // A painter that fails leaves the ground to this thread.
        w.onerror = (e) => {
          e.preventDefault();
          this.stopPool();
        };
        pool.push(p);
      }
      this.pool = pool;
    } catch {
      this.stopPool();
    }
  }

  private stopPool(): void {
    for (const p of this.pool ?? []) p.w.terminate();
    this.pool = null;
    this.asked.clear();
  }

  private ask(key: number): boolean {
    let best: { w: Worker; out: number } | null = null;
    for (const p of this.pool!) if (p.out < IN_FLIGHT && (!best || p.out < best.out)) best = p;
    if (!best) return false;
    best.out++;
    this.asked.add(key);
    const m: TileAsk = { land: this.def.id, col: Math.floor(key / 16384), row: key % 16384 };
    best.w.postMessage(m);
    return true;
  }

  /** Put up a tile a painter sent, if it's still wanted. */
  private land_(t: LandTile, view: Phaser.Geom.Rectangle): void {
    const key = LandRuntime.tileKey(t.col, t.row);
    this.asked.delete(key);
    if (this.ready(key) || !this.near(t.col, t.row, view)) return;
    this.install(t);
    this.showTile(key);
  }

  // ---------------------------------------------------------------- what stands

  private chunksIn(view: Phaser.Geom.Rectangle, pad: number): number[] {
    const out: number[] = [];
    const c0 = Math.floor((view.left - pad) / CHUNK);
    const c1 = Math.floor((view.right + pad) / CHUNK);
    const r0 = Math.floor((view.top - pad) / CHUNK);
    // Tall things reach up into the view from the chunk below.
    const r1 = Math.floor((view.bottom + pad + 100) / CHUNK);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(LandWorld.key(c, r));
    return out;
  }

  private updateStanding(view: Phaser.Geom.Rectangle): void {
    for (const k of this.chunksIn(view, 0)) this.stand(k);
    let n = 0;
    for (const k of this.chunksIn(view, STAND)) {
      if (this.stood.has(k)) continue;
      this.stand(k);
      if (++n >= CHUNKS_PER_FRAME) break;
    }
    for (const [k, st] of this.stood) {
      const cx = Math.floor(k / 8192);
      const cy = k - cx * 8192;
      const x = cx * CHUNK;
      const y = cy * CHUNK;
      if (x > view.right + FORGET || x + CHUNK < view.left - FORGET || y > view.bottom + FORGET || y + CHUNK < view.top - FORGET) {
        this.unstand(k);
        continue;
      }
      for (const p of st.placed) p.obj.setVisible(p.x1 > view.left && p.x0 < view.right && p.y1 > view.top && p.y0 < view.bottom);
    }
  }

  private stand(key: number): void {
    if (this.stood.has(key)) return;
    const cx = Math.floor(key / 8192);
    const cy = key - cx * 8192;
    const l = this.land.layout(cx, cy);
    const st: Stood = { placed: [], shadows: [], glows: [], lights: l.lights, walkers: [] };
    this.stood.set(key, st);
    const add = this.world.add;
    for (const p of l.props) {
      const sh = this.sheets.get(p.sheet);
      if (!sh) continue;
      const ox = sh.footX / sh.w;
      const oy = sh.footY / sh.h;
      const depth = p.y + (p.sortY ?? 0);
      const obj = add.sprite(p.x, p.y, p.sheet, p.frame).setOrigin(ox, oy).setPipeline('Lit').setDepth(depth).setFlipX(!!p.flip);
      if (p.anim) {
        const anim = `${p.sheet}_${p.anim}`;
        const frames = sh.anims?.find((a) => a.name === p.anim)?.frames.length ?? 1;
        obj.play({ key: anim, startFrame: Math.abs(p.x * 7 + p.y * 13) % frames });
      }
      const box = { x0: p.x - sh.w, x1: p.x + sh.w, y0: p.y - sh.h - 8, y1: p.y + sh.h };
      st.placed.push({ obj, ...box });
      if (p.shadow !== false) {
        const s = sunShadow(add.image(p.x, p.y, `${p.sheet}_s`, p.frame).setOrigin(ox, oy).setFlipX(!!p.flip));
        s.setAlpha(Math.max(0, this.shadowAlpha));
        st.shadows.push(s);
        st.placed.push({ obj: s, x0: p.x - sh.h * 1.6, x1: p.x + sh.h * 1.6, y0: p.y - sh.h * 1.6, y1: p.y + sh.h * 1.6 });
      }
      if (sh.glows) {
        const g = add.sprite(p.x, p.y, `${p.sheet}_e`, p.frame).setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.1).setFlipX(!!p.flip).setAlpha(0.35 + Math.max(0, this.glowAlpha) * 0.65);
        st.glows.push(g);
        st.placed.push({ obj: g, ...box });
      }
    }
    for (const s of l.life) {
      const def = this.def.walkers?.find((w) => w.id === s.kind);
      if (!def) continue;
      const sh = this.sheets.get(def.sheet);
      if (!sh) continue;
      const obj = add.sprite(s.x, s.y, def.sheet).setOrigin(sh.footX / sh.w, sh.footY / sh.h).setPipeline('Lit').setDepth(s.y);
      obj.play({ key: `${def.sheet}_${def.idle}`, startFrame: Math.abs(s.x + s.y) % 2 });
      st.walkers.push({ def, obj, homeX: s.x, homeY: s.y, x: s.x, y: s.y, tx: s.x, ty: s.y, t: 500 + Math.abs(s.x * 31 + s.y) % 2500, mode: 'idle' });
    }
  }

  private unstand(key: number): void {
    const st = this.stood.get(key);
    if (!st) return;
    this.stood.delete(key);
    for (const p of st.placed) p.obj.destroy();
    for (const w of st.walkers) w.obj.destroy();
    for (const L of st.lights) {
      const lamp = this.lamps.get(L);
      if (lamp) {
        this.freeLamp(lamp);
        this.lamps.delete(L);
      }
    }
  }

  // ---------------------------------------------------------------- lights

  /** Give the world's lights to the lanterns nearest the view's middle, taking them back from the rest. */
  private assignLights(view: Phaser.Geom.Rectangle): void {
    const all: LandLight[] = [];
    for (const st of this.stood.values()) {
      for (const L of st.lights) {
        if (L.x + L.radius < view.left || L.x - L.radius > view.right || L.y + L.radius < view.top || L.y - L.radius > view.bottom) continue;
        all.push(L);
      }
    }
    const d = (L: LandLight) => Math.hypot(L.x - view.centerX, L.y - view.centerY);
    const keep = new Set(all.sort((a, b) => d(a) - d(b)).slice(0, MAX_LIGHTS));
    for (const [L, lamp] of this.lamps) {
      if (keep.has(L)) continue;
      this.freeLamp(lamp);
      this.lamps.delete(L);
    }
    for (const L of keep) {
      if (this.lamps.has(L)) continue;
      const light = this.world.lights.addLight(L.x, L.y, L.radius, L.color, 0);
      const halo = L.halo ? this.world.add.image(L.x, L.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(L.color).setScale(1.1).setDepth(L.y + 40).setAlpha(0) : null;
      this.lamps.set(L, { light, halo, seed: (L.x * 13 + L.y * 7) % 100 });
    }
  }

  private updateLamps(time: number, d: number): void {
    for (const [L, lamp] of this.lamps) {
      const night = (L.day ?? 0) + (1 - (L.day ?? 0)) * (1 - d);
      const fl = L.flicker ? 1 - L.flicker * 0.5 * (0.5 + 0.5 * Math.sin(time * 0.011 + lamp.seed) * Math.sin(time * 0.0037 + lamp.seed * 2)) : 1;
      lamp.light.setIntensity(L.intensity * night * fl);
      lamp.halo?.setAlpha((L.halo ?? 0) * night * fl);
    }
  }

  private freeLamp(l: Lamp): void {
    this.world.lights.removeLight(l.light);
    l.halo?.destroy();
  }

  // ---------------------------------------------------------------- walkers

  private updateWalkers(dt: number, hero: { x: number; y: number }, view: Phaser.Geom.Rectangle): void {
    const s = dt / 1000;
    for (const st of this.stood.values()) {
      for (const w of st.walkers) {
        const on = w.x > view.left - 20 && w.x < view.right + 20 && w.y > view.top - 20 && w.y < view.bottom + 20;
        const when = w.def.when;
        const out = !when || (when === 'day' ? this.daylight > 0.3 : this.daylight < 0.5);
        w.obj.setVisible(on && out);
        if (!on || !out) continue;
        const def = w.def;
        const hx = w.x - hero.x;
        const hy = w.y - hero.y;
        const hd = Math.hypot(hx, hy);
        if (hd < def.fear && w.mode !== 'run') {
          // Away from the wanderer, as far as a short dash goes.
          const k = (def.range * 0.8) / (hd || 1);
          w.tx = w.x + hx * k;
          w.ty = w.y + hy * k * 0.6;
          w.mode = 'run';
          w.t = 900;
          w.obj.play(`${def.sheet}_${def.walk}`, true);
        }
        w.t -= dt;
        if (w.mode === 'idle') {
          if (w.t <= 0) {
            // Off somewhere near home.
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * def.range;
            w.tx = w.homeX + Math.cos(a) * r;
            w.ty = w.homeY + Math.sin(a) * r * 0.5;
            w.mode = 'walk';
            w.t = 2500;
            w.obj.play(`${def.sheet}_${def.walk}`, true);
          }
        } else {
          const dx = w.tx - w.x;
          const dy = w.ty - w.y;
          const dist = Math.hypot(dx, dy);
          const step = (w.mode === 'run' ? def.run : def.speed) * s;
          const nx = w.x + (dist > 0 ? (dx / dist) * Math.min(step, dist) : 0);
          const ny = w.y + (dist > 0 ? (dy / dist) * Math.min(step, dist) : 0);
          const blocked = !def.where(nx, ny);
          if (!blocked) {
            w.x = nx;
            w.y = ny;
          }
          if (!def.sideways && Math.abs(dx) > 0.5) w.obj.setFlipX(dx < 0);
          if (blocked || dist < 1 || w.t <= 0) {
            w.mode = 'idle';
            w.t = 900 + Math.random() * 3200;
            w.obj.play(`${def.sheet}_${def.idle}`, true);
          }
          w.obj.setPosition(Math.round(w.x), Math.round(w.y)).setDepth(w.y);
        }
      }
    }
  }

  // ---------------------------------------------------------------- flyers

  private makeFlyer(def: FlyerDef, k: number): Flyer {
    const sh = this.sheets.get(def.sheet)!;
    const obj = this.world.add.sprite(0, 0, def.sheet).setPipeline('Lit').setDepth(9990).setVisible(false);
    obj.play({ key: `${def.sheet}_${def.anim}`, startFrame: k * 3 });
    const shadow = this.world.add.image(0, 0, `${def.sheet}_s`, sh.frames[0].name).setDepth(3).setAlpha(0).setVisible(false);
    return { def, obj, shadow, cx: NaN, cy: NaN, a: k * 2.1, r: def.radius * (0.7 + ((k * 37) % 10) / 20), dir: k % 2 ? 1 : -1 };
  }

  private updateFlyers(dt: number, view: Phaser.Geom.Rectangle, d: number): void {
    for (const f of this.flyers) {
      const when = f.def.when;
      const out = !when ? 1 : when === 'day' ? Math.max(0, Math.min(1, (d - 0.35) * 3)) : Math.max(0, Math.min(1, (0.5 - d) * 3));
      // A flock wheels round a spot near the view, and moves on when the view leaves it behind.
      if (!Number.isFinite(f.cx) || Math.abs(f.cx - view.centerX) > view.width * 1.2 || Math.abs(f.cy - view.centerY) > view.height * 1.2) {
        f.cx = view.centerX + (Math.random() - 0.5) * view.width * 0.9;
        f.cy = view.centerY + (Math.random() - 0.5) * view.height * 0.9;
      }
      f.a += ((f.def.speed / f.r) * dt * f.dir) / 1000;
      // The spot itself drifts with the wind, so the wheel never quite repeats.
      f.cx += dt * 0.006;
      const x = f.cx + Math.cos(f.a) * f.r;
      const y = f.cy + Math.sin(f.a) * f.r * 0.55;
      const z = f.def.height + Math.sin(f.a * 2) * 6;
      const vx = -Math.sin(f.a) * f.dir;
      f.obj.setPosition(Math.round(x), Math.round(y - z)).setFlipX(vx < 0).setAlpha(out).setVisible(out > 0.02);
      f.shadow.setPosition(Math.round(x + z * 0.3), Math.round(y + z * 0.1)).setFrame(f.obj.frame.name).setFlipX(vx < 0).setAlpha(0.22 * out * d).setVisible(out > 0.02 && d > 0.05);
    }
  }
}
