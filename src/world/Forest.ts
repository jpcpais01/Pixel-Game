import Phaser from 'phaser';
import { sound } from '../audio';
import { warmForest } from '../art/arenaLoader';
import { CAMPFIRE, CAMPFIRE_FOOT, CHEST_BASE_Y, CHEST_H, FPROP_BASE_Y, FPROP_H, FPROP_LOOKS, MENHIR_BASE_Y, MENHIR_H, SHRINE_BASE_Y, SHRINE_H, type FPropKind } from '../art/forest';
import { PILLAR_BASE, PILLAR_H, RUIN_H_BASE, RUIN_H_H, RUIN_V_BASE, RUIN_V_H } from '../art/garden';
import { STRIP_H, buildStrip, type GroundSpec, type GroundStrip } from '../art/ground';
import { ELDER_BASE_Y, ELDER_H, PROP_BASE_Y, PROP_H, RAY_FOOT_X, RAY_H, RAY_W, TREE_BASE_Y, TREE_H } from '../art/trees';
import { MIGHT, RENEW, SWIFTNESS, WARD, heroBuffs, type BuffDef } from '../game/buffs';
import { settings } from '../game/settings';
import { sway, treeSwayReady } from '../game/treeSway';
import { SUN_SHADOW_ALPHA, sunShadow } from '../game/Wizard';
import type { WorldScene } from '../scenes/WorldScene';
import { install } from './GroundStreamer';
import { treeLeaves } from './Scenery';
import { CAMP_SEATS, CHUNK, FOREST_WORLD, WOOD_SHAPE, ruinPieces, stonePieces, type Blocker, type ForestGen, type Poi, type WoodKind } from './forestGen';
import { WhiteStag } from './WhiteStag';
import { forestTile } from './forestGround';
import type { TileAsk, TileDone } from './forestWorker';

// The Everwood as it is walked: its ground painted tile by tile round the
// view (a tile is a chunk wide and a strip of rows tall, see forestGround.ts)
// and its trees, undergrowth, sunbeams and places stood up chunk by chunk,
// all given back once the view is far away. Nothing is made twice the same
// way: the forest is a function of its seed (see forestGen.ts).
//
// The places do something when walked up to: a campfire mends the hero and
// becomes where they rise; a shrine grants a blessing, once; a chest opens on
// treasure; a fairy ring gives a gift of gems. Walking into a new wood shows
// its name. Now and then the White Stag comes to lead the hero somewhere
// secret (see WhiteStag.ts).

type Img = Phaser.GameObjects.Image;
type Sprite = Phaser.GameObjects.Sprite;

/** Ground tiles built ahead of the view, and kept beyond it before they are dropped, in tiles. */
const AHEAD_X = 1;
const AHEAD_Y = 2;
const KEEP_X = 2;
const KEEP_Y = 4;
/** Workers painting the ground (at most, and fewer on a phone with few cores), and tiles asked of each at once. */
const MAX_WORKERS = 3;
const IN_FLIGHT = 2;
/** A tile in view still missing after this long (ms) is painted here, whatever it costs. */
const MISSING_MS = 1500;
/** The world opens once the view's ground is in, or after this long (ms) regardless. */
const OPEN_BY = 6000;
/** How far past the view (px) a chunk's things are stood up, and past which they are taken down. */
const STAND = 96;
const FORGET = 2 * CHUNK;
/** Chunks stood up per frame ahead of the view (those already in it come at once). */
const CHUNKS_PER_FRAME = 1;
/** ms between leaves falling from the trees in view (pines keep theirs). */
const TREE_LEAF_MS = 1100;
/** A new wood's name is shown once the hero has been in it this long (ms), so an edge walked along doesn't flicker. */
const REGION_SETTLE = 1400;
/** How near (px) a place must be walked to wake it. */
const CAMP_R = 34;
const SHRINE_R = 20;
const CHEST_R = 18;
const FAIRY_R = 18;
/** A campfire mends this share of the hero's health each tick while they stand by it. */
const CAMP_MEND = 0.03;
const CAMP_TICK = 600;
/** The shrines' blessings last longer than a potion's. */
const SHRINE_BLESSINGS: BuffDef[] = [MIGHT, WARD, RENEW, SWIFTNESS].map((d) => ({ ...d, duration: d.duration * 3 }));
/** The lights of a camp and a shrine: radius, colour, strength, and how much is left by day. */
const CAMP_LIGHT = { r: 150, color: 0xff9a4a, i: 2, day: 0.35 };
const SHRINE_LIGHT = { r: 80, color: 0x7ae6dc, i: 1.2, day: 0.4 };

/** The leaves each kind lets fall. */
const LEAF_TINTS: Record<WoodKind, number[][]> = {
  oak: [[0x3b753c, 0x528d46, 0x71a653, 0xc8a040]],
  birch: [[0x8eb54c, 0xb2cd62, 0xd2e287, 0xe8c050]],
  pine: [],
  cherry: [[0xf9cbd4, 0xefabb9, 0xe08c9e, 0xffe8ec]],
  maple: [
    [0xe8802a, 0xd05e1e, 0xf6a540],
    [0xe6b22e, 0xd09320, 0xf4cd4c],
    [0xd44a44, 0xb83038, 0xec6c56],
  ],
  willow: [[0x86ae40, 0xa8c655, 0x689536]],
};

interface Tile {
  night: Img;
  day: Img;
  glow: Img | null;
  y: number;
  x: number;
}

/** Something stood up, with the box it can cover, to hide when out of view. */
interface Placed {
  obj: Img | Sprite;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Tree {
  obj: Sprite;
  x: number;
  y: number;
  kind: WoodKind | 'elder';
  v: number;
  /** Sways once its animation is built. */
  anim: string;
  swaying: boolean;
  alpha: number;
  r: number;
  top: number;
  glow: Sprite | null;
}

interface Place {
  poi: Poi;
  body: Sprite | null;
  glow: Sprite | null;
  light: Phaser.GameObjects.Light | null;
  halo: Img | null;
  sparks: Img[];
}

interface Stood {
  placed: Placed[];
  trees: Tree[];
  places: Place[];
  rays: { img: Img; x: number; y: number; seed: number }[];
  shrooms: { halo: Img | Sprite; seed: number }[];
  shadows: Img[];
  lights: Phaser.GameObjects.Light[];
}

export class Forest {
  private tiles = new Map<number, Tile>();
  private job: { key: number; spec: GroundSpec; gen: Generator<void, GroundStrip, void> } | null = null;
  /** The ground's painters (null once they fail, or where there are none: then it's painted here, a slice a frame). */
  private pool: { w: Worker; out: number }[] | null = null;
  private asked = new Set<number>();
  private arrived: TileDone[] = [];
  private missingT = 0;
  private onReady: (() => void) | null = null;
  private openT = 0;
  private stood = new Map<number, Stood>();
  private daylight = 0;
  private glowAlpha = 1;
  private night = 0;
  private treeLeaves: Phaser.GameObjects.Particles.ParticleEmitter;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  /** What has been used up this visit: shrines taken, chests opened, fairy rings visited, by place id. */
  private used = new Set<number>();
  /** The campfire the hero rises at, if they have rested by one. */
  private camp: Poi | null = null;
  private mendT = 0;
  private region = { ci: 0, cj: 0, shown: false, heldT: 0, nextCi: 0, nextCj: 0 };
  private view = new Phaser.Geom.Rectangle();
  private stag: WhiteStag;

  constructor(
    private world: WorldScene,
    readonly gen: ForestGen,
    private adopt: (img: Img) => Img,
  ) {
    // Its own trees and places, if the arena select hasn't finished building them.
    warmForest(world);
    this.startPool();
    const s = gen.spawn();
    const h = gen.sample(s.x, s.y);
    const w = gen.region(s.x, s.y, h.wx, h.wy);
    this.region.ci = this.region.nextCi = w.ci;
    this.region.cj = this.region.nextCj = w.cj;

    // Now and then a leaf comes loose from a tree in view.
    this.treeLeaves = treeLeaves(
      world,
      () => {
        const leafy: Tree[] = [];
        for (const c of this.stood.values()) for (const t of c.trees) if (t.obj.visible && t.kind !== 'pine' && t.kind !== 'elder') leafy.push(t);
        const t = leafy[Math.floor(Math.random() * leafy.length)];
        if (!t) return null;
        const tints = LEAF_TINTS[t.kind as WoodKind];
        return { x: t.x + (Math.random() - 0.5) * t.r * 1.4, y: t.y - t.top + (Math.random() - 0.2) * t.r * 0.7, tints: tints[t.v % tints.length] };
      },
      TREE_LEAF_MS,
    );
    // Dust glittering in the shafts of light.
    const rayZone = {
      getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
        const shown: Stood['rays'] = [];
        for (const c of this.stood.values()) for (const r of c.rays) if (r.img.visible) shown.push(r);
        const r = shown[Math.floor(Math.random() * shown.length)];
        if (!r) {
          p.x = p.y = -100;
          return p;
        }
        const t = 0.15 + Math.random() * 0.8;
        p.x = r.x - (1 - t) * RAY_H * 0.22 + (Math.random() - 0.5) * 14;
        p.y = r.y - (1 - t) * RAY_H;
        return p;
      },
    };
    this.motes = world.add
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
      .setDepth(9988);
    this.stag = new WhiteStag(world, this, gen);
    const offQuality = settings.watch((q) => {
      const k = q.quality !== 'full' ? 2 : 1;
      this.treeLeaves.frequency = TREE_LEAF_MS * k;
      this.motes.frequency = 110 * k;
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offQuality();
      this.job = null;
      this.stopPool();
      this.onReady = null;
      // The ground's textures go with the world; the forest's layouts with the generator.
      for (const key of this.tiles.keys()) this.dropTile(key);
      this.stood.clear();
    });
  }

  /** Where the hero rises: by the campfire they last rested at, else where they started. */
  get risePoint(): { x: number; y: number } | null {
    return this.camp ? { x: this.camp.x, y: this.camp.y + 18 } : null;
  }

  // ---------------------------------------------------------------- the ground

  private static tileKey(col: number, row: number): number {
    return col * 8192 + row;
  }

  private texKey(col: number, row: number): string {
    return `gnd_fw${this.gen.seed}_${col}_${row}`;
  }

  private spec(col: number, row: number): GroundSpec {
    return forestTile(this.gen, col, row);
  }

  /** Tiles covering `view` grown by (ax, ay) tiles, nearest its centre first. */
  private wanted(view: Phaser.Geom.Rectangle, ax: number, ay: number): number[] {
    const c0 = Math.max(0, Math.floor(view.left / CHUNK) - ax);
    const c1 = Math.min(FOREST_WORLD / CHUNK - 1, Math.floor(view.right / CHUNK) + ax);
    const r0 = Math.max(0, Math.floor(view.top / STRIP_H) - ay);
    const r1 = Math.min(FOREST_WORLD / STRIP_H - 1, Math.floor(view.bottom / STRIP_H) + ay);
    const mx = view.centerX / CHUNK;
    const my = view.centerY / STRIP_H;
    const list: { k: number; d: number }[] = [];
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) list.push({ k: Forest.tileKey(c, r), d: ((c + 0.5 - mx) * 2) ** 2 + (r + 0.5 - my) ** 2 });
    return list.sort((a, b) => a.d - b.d).map((e) => e.k);
  }

  private ready(key: number): boolean {
    return this.world.textures.exists(this.texKey(Math.floor(key / 8192), key % 8192));
  }

  private buildNow(key: number): void {
    const col = Math.floor(key / 8192);
    const row = key % 8192;
    const spec = this.spec(col, row);
    const gen = buildStrip(spec, row);
    let r = gen.next();
    while (!r.done) r = gen.next();
    install(this.world, spec, r.value);
  }

  private showTile(key: number): void {
    if (this.tiles.has(key)) return;
    const col = Math.floor(key / 8192);
    const row = key % 8192;
    const k = this.texKey(col, row);
    const x = col * CHUNK;
    const y = row * STRIP_H;
    const add = this.world.add;
    const night = this.adopt(add.image(x, y, k).setOrigin(0).setPipeline('Lit').setDepth(0));
    const day = this.adopt(add.image(x, y, `${k}_day`).setOrigin(0).setPipeline('Lit').setDepth(1).setAlpha(this.daylight));
    const glow = this.world.textures.exists(`${k}_e`) ? this.adopt(add.image(x, y, `${k}_e`).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(2).setAlpha(this.glowAlpha)) : null;
    this.tiles.set(key, { night, day, glow, x, y });
  }

  private dropTile(key: number): void {
    const t = this.tiles.get(key);
    const col = Math.floor(key / 8192);
    const row = key % 8192;
    if (t) {
      this.tiles.delete(key);
      t.night.destroy();
      t.day.destroy();
      t.glow?.destroy();
    }
    const k = this.texKey(col, row);
    const textures = this.world.textures;
    for (const name of [k, `${k}_day`, `${k}_e`]) if (textures.exists(name)) textures.remove(name);
  }

  // ---------------------------------------------------------------- the painters

  private startPool(): void {
    const n = Math.min(MAX_WORKERS, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
    try {
      const pool: { w: Worker; out: number }[] = [];
      for (let i = 0; i < n; i++) {
        const w = new Worker(new URL('./forestWorker.ts', import.meta.url), { type: 'module' });
        const p = { w, out: 0 };
        w.onmessage = (e: MessageEvent<TileDone>) => {
          p.out--;
          if (e.data.seed === this.gen.seed) this.arrived.push(e.data);
        };
        // A painter that fails leaves the ground to this thread, as before there were any.
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

  /** Ask the least busy painter for tile `key`; false if they all have enough to do. */
  private ask(key: number): boolean {
    let best: { w: Worker; out: number } | null = null;
    for (const p of this.pool!) if (p.out < IN_FLIGHT && (!best || p.out < best.out)) best = p;
    if (!best) return false;
    best.out++;
    this.asked.add(key);
    const m: TileAsk = { seed: this.gen.seed, col: Math.floor(key / 8192), row: key % 8192 };
    best.w.postMessage(m);
    return true;
  }

  /** Put up a tile a painter sent: its fields and layouts go to the generator; its pixels become textures. */
  private land(t: TileDone, view: Phaser.Geom.Rectangle): void {
    const key = Forest.tileKey(t.col, t.row);
    this.asked.delete(key);
    this.gen.adopt(t.fresh);
    if (this.ready(key) || !this.near(t.col, t.row, view)) return;
    install(this.world, this.spec(t.col, t.row), t.strip);
    this.showTile(key);
  }

  /** Is tile (col, row) within the ground kept round `view`? */
  private near(col: number, row: number, view: Phaser.Geom.Rectangle): boolean {
    return col >= Math.floor(view.left / CHUNK) - KEEP_X && col <= Math.floor(view.right / CHUNK) + KEEP_X && row >= Math.floor(view.top / STRIP_H) - KEEP_Y && row <= Math.floor(view.bottom / STRIP_H) + KEEP_Y;
  }

  // ---------------------------------------------------------------- the ground, kept

  /** Keep the ground round `view` built and shown: painted by the workers, or here within `budget` ms. */
  private updateGround(view: Phaser.Geom.Rectangle, budget: number, dt: number): void {
    const inView = this.wanted(view, 0, 0);
    if (this.pool) {
      // What came back: all of it while the view has holes, else one texture upload a frame.
      const holes = inView.some((k) => !this.ready(k));
      while (this.arrived.length) {
        this.land(this.arrived.shift()!, view);
        if (!holes) break;
      }
      for (const key of this.wanted(view, AHEAD_X, AHEAD_Y)) if (!this.ready(key) && !this.asked.has(key) && !this.ask(key)) break;
      // A hole that stays (the painters are behind, after a jump across the forest) is filled here.
      const hole = inView.find((k) => !this.ready(k));
      this.missingT = hole === undefined ? 0 : this.missingT + dt;
      if (hole !== undefined && this.missingT > MISSING_MS) this.buildNow(hole);
    } else {
      // What the view shows now is built at once, whatever it costs (after a jump, like rising at a campfire).
      for (const key of inView) {
        if (this.ready(key)) continue;
        if (this.job?.key === key) this.job = null;
        this.buildNow(key);
      }
    }
    for (const key of this.wanted(view, AHEAD_X, AHEAD_Y)) if (this.ready(key)) this.showTile(key);
    for (const [key, t] of this.tiles) {
      if (!this.near(Math.floor(key / 8192), key % 8192, view)) {
        this.dropTile(key);
        continue;
      }
      const on = t.x < view.right && t.x + CHUNK > view.left && t.y < view.bottom && t.y + STRIP_H > view.top;
      t.night.setVisible(on);
      t.day.setVisible(on && this.daylight > 0.01);
      t.glow?.setVisible(on && this.glowAlpha > 0.01);
    }
    if (this.onReady) {
      this.openT += dt;
      if (this.openT > OPEN_BY || inView.every((k) => this.ready(k))) {
        const f = this.onReady;
        this.onReady = null;
        f();
      }
    }
    if (this.pool || budget <= 0) return;
    const start = performance.now();
    while (performance.now() - start < budget) {
      if (!this.job) {
        const next = this.wanted(view, AHEAD_X, AHEAD_Y).find((k) => !this.ready(k));
        if (next === undefined) return;
        const col = Math.floor(next / 8192);
        const row = next % 8192;
        const spec = this.spec(col, row);
        this.job = { key: next, spec, gen: buildStrip(spec, row) };
      }
      const r = this.job.gen.next();
      if (r.done) {
        install(this.world, this.job.spec, r.value);
        this.showTile(this.job.key);
        this.job = null;
      }
    }
  }

  /** Day ground's opacity, and the glow of the runes, mushrooms and fairy rings. */
  setLight(daylight: number, glow: number): void {
    this.daylight = daylight;
    this.glowAlpha = glow;
    for (const t of this.tiles.values()) {
      t.day.setAlpha(daylight);
      t.glow?.setAlpha(glow);
    }
  }

  /**
   * The world opening: ask for the view's ground, and call `ready` once it's
   * in (the world stays dark till then). With no painters it's built now.
   */
  prime(view: Phaser.Geom.Rectangle, ready: () => void): void {
    this.onReady = ready;
    this.openT = 0;
    this.updateGround(view, 0, 0);
    if (!this.pool) for (const key of this.chunksIn(view, STAND)) this.stand(key);
  }

  // ---------------------------------------------------------------- what stands

  /** Chunks whose things could be in `view` grown by `pad` (trees reach up out of the chunk below). */
  private chunksIn(view: Phaser.Geom.Rectangle, pad: number): number[] {
    const out: number[] = [];
    const c0 = Math.floor((view.left - pad) / CHUNK);
    const c1 = Math.floor((view.right + pad) / CHUNK);
    const r0 = Math.floor((view.top - pad) / CHUNK);
    const r1 = Math.floor((view.bottom + pad + ELDER_H) / CHUNK);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(c * 4096 + r);
    return out;
  }

  /** Stand up chunk `key`'s trees, undergrowth, sunbeams and places. */
  private stand(key: number): void {
    if (this.stood.has(key)) return;
    const l = this.gen.layout(Math.floor(key / 4096), key % 4096);
    const st: Stood = { placed: [], trees: [], places: [], rays: [], shrooms: [], shadows: [], lights: [] };
    this.stood.set(key, st);
    const add = this.world.add;
    const place = (obj: Placed['obj'], x: number, y: number, hw: number, up: number) => st.placed.push({ obj, x0: x - hw, x1: x + hw, y0: y - up, y1: y + 6 });

    for (const t of l.trees) {
      // Where the White Stag opened a glade, the trees stand aside.
      if (this.gen.inGlade(t.x, t.y)) continue;
      const old = t.kind === 'oak' || t.kind === 'birch' || t.kind === 'pine';
      const obj = add.sprite(t.x, t.y, old ? 'tree' : 'ftree', `${t.kind}${t.v}`).setOrigin(0.5, TREE_BASE_Y / TREE_H).setPipeline('Lit').setDepth(t.y).setFlipX(t.flip);
      const shape = WOOD_SHAPE[t.kind];
      st.trees.push({ obj, x: t.x, y: t.y, kind: t.kind, v: t.v, anim: `${old ? 'tree' : 'ftree'}_${t.kind}${t.v}`, swaying: false, alpha: 1, r: shape.canopyR, top: shape.canopyY, glow: null });
      place(obj, t.x, t.y, 48, TREE_BASE_Y);
    }
    for (const p of l.props) if (!this.gen.inGlade(p.x, p.y)) this.prop(st, place, p.kind, p.x, p.y, p.v, p.flip);
    for (const r of l.rays) {
      const img = add.image(r.x, r.y, 'ray', `ray${r.seed % 2}`).setOrigin(RAY_FOOT_X / RAY_W, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(r.y + 1).setVisible(false);
      st.rays.push({ img, x: r.x, y: r.y, seed: r.seed });
    }
    for (const p of l.pois) this.poi(st, place, p);
  }

  /** One piece of undergrowth: the older forests' art where it has it, the Everwood's own for the rest. */
  private prop(st: Stood, place: (obj: Placed['obj'], x: number, y: number, hw: number, up: number) => void, kind: string, x: number, y: number, v: number, flip: boolean): void {
    const add = this.world.add;
    let obj: Img;
    const flora = (frame: string) => add.image(x, y, 'flora', frame).setOrigin(0.5, PROP_BASE_Y / PROP_H);
    if (kind === 'rock') obj = add.image(x, y, 'rock', `r${v % 3}`).setOrigin(0.5, 12 / 14);
    else if (kind === 'bush') obj = flora('bush0');
    else if (kind === 'berry') obj = flora('bush1');
    else if (kind === 'fern') obj = flora(`fern${v % 2}`);
    else if (kind === 'stump') obj = flora(`stump${v % 2}`);
    else if (kind === 'log') obj = flora('log0');
    else if (kind === 'glowcap') obj = flora('shrooms0');
    else if (kind === 'redcap') obj = flora('shrooms1');
    else {
      const k = kind as FPropKind;
      obj = add.image(x, y, 'fprop', `${k}${v % FPROP_LOOKS[k]}`).setOrigin(0.5, FPROP_BASE_Y / FPROP_H);
    }
    obj.setPipeline('Lit').setDepth(y).setFlipX(flip && kind !== 'log');
    place(obj, x, y, 24, 40);
    // What glows: the little glowing caps, and the giant mushrooms of the hollows.
    const glowKey = kind === 'glowcap' ? 'flora_e' : kind === 'bigshroom' ? 'fprop_e' : null;
    if (glowKey) {
      const glow = add.image(x, y, glowKey, obj.frame.name).setOrigin(obj.originX, obj.originY).setFlipX(obj.flipX).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1);
      place(glow, x, y, 24, 40);
      const big = kind === 'bigshroom';
      const halo = add.image(x - (big ? 2 : 0), y - (big ? 22 : 6), 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(big && v % 2 ? 0xb88aff : 0x4ff0d0).setScale(big ? 2.4 : 1.4).setDepth(y + 0.2);
      place(halo, x, y, 30, 50);
      st.shrooms.push({ halo, seed: Math.random() * 10 });
    }
  }

  /** A place: its pieces, and its light. */
  private poi(st: Stood, place: (obj: Placed['obj'], x: number, y: number, hw: number, up: number) => void, p: Poi): void {
    const add = this.world.add;
    const lit = (x: number, y: number, key: string, frame: string, oy: number, hw: number, up: number): Sprite => {
      const obj = add.sprite(x, y, key, frame).setOrigin(0.5, oy).setPipeline('Lit').setDepth(y);
      place(obj, x, y, hw, up);
      const sh = sunShadow(add.image(x, y, `${key}_s`, frame).setOrigin(0.5, oy));
      st.shadows.push(sh);
      place(sh, x, y, hw + 30, up);
      return obj;
    };
    const glowOf = (body: Sprite, key: string): Sprite => {
      const g = add.sprite(body.x, body.y, key, body.frame.name).setOrigin(body.originX, body.originY).setBlendMode(Phaser.BlendModes.ADD).setDepth(body.depth + 0.1);
      place(g, body.x, body.y, 30, 60);
      return g;
    };
    const light = (x: number, y: number, l: { r: number; color: number; i: number }, tint: number, scale: number) => {
      const lt = this.world.lights.addLight(x, y, l.r, l.color, l.i);
      st.lights.push(lt);
      const halo = add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(scale).setDepth(y + 60).setAlpha(0.3);
      place(halo, x, y, 40, 40);
      return { lt, halo };
    };
    const pl: Place = { poi: p, body: null, glow: null, light: null, halo: null, sparks: [] };
    switch (p.kind) {
      case 'campfire': {
        const body = lit(p.x, p.y, 'fcamp', 'c0', CAMPFIRE_FOOT.y / CAMPFIRE.h, 16, 40).play({ key: 'fcamp_burn', startFrame: Math.floor(Math.random() * 4) });
        pl.body = body;
        pl.glow = glowOf(body, 'fcamp_e').play({ key: 'fcamp_e_burn', startFrame: body.anims.currentFrame?.index ? body.anims.currentFrame.index - 1 : 0 });
        for (const s of CAMP_SEATS) lit(p.x + s.x, p.y + s.y, 'flora', `stump${s.v}`, PROP_BASE_Y / PROP_H, 24, 26);
        const { lt, halo } = light(p.x, p.y - 8, CAMP_LIGHT, 0xffa04a, 1.8);
        pl.light = lt;
        pl.halo = halo;
        break;
      }
      case 'shrine': {
        const spent = this.used.has(p.id);
        const body = lit(p.x, p.y, 'fshrine', spent ? 'spent' : 's0', SHRINE_BASE_Y / SHRINE_H, 18, 50);
        pl.body = body;
        pl.glow = glowOf(body, 'fshrine_e');
        if (!spent) {
          body.play('fshrine_pulse');
          pl.glow.play('fshrine_e_pulse');
          const { lt, halo } = light(p.x, p.y - 20, SHRINE_LIGHT, 0x8af6ff, 1.2);
          pl.light = lt;
          pl.halo = halo;
        }
        break;
      }
      case 'chest':
        pl.body = lit(p.x, p.y, 'fchest', this.used.has(p.id) ? 'open' : 'shut', CHEST_BASE_Y / CHEST_H, 16, 30);
        // A glint on the lock, to be seen from afar.
        if (!this.used.has(p.id)) pl.sparks.push(this.spark(place, p.x, p.y - 13, 0xffe070));
        break;
      case 'ruins':
        for (const r of ruinPieces(p)) {
          if (this.gen.sample(r.x, r.y).trail <= 2) continue;
          if (r.kind === 'pillar') lit(r.x, r.y, 'pillar', `p${r.v}`, PILLAR_BASE / PILLAR_H, 22, 54);
          else if (r.kind === 'wall_h') lit(r.x, r.y, 'ruin_h', `h${r.v}`, RUIN_H_BASE / RUIN_H_H, 16, 26);
          else lit(r.x, r.y, 'ruin_v', `v${r.v}`, RUIN_V_BASE / RUIN_V_H, 10, 30);
        }
        break;
      case 'stones':
        for (const s of stonePieces(p)) {
          const body = lit(s.x, s.y, 'menhir', `m${s.v}`, MENHIR_BASE_Y / MENHIR_H, 12, 40);
          // Their runes wake after dark: the glow's alpha follows the night.
          st.shrooms.push({ halo: glowOf(body, 'menhir_e'), seed: s.x });
        }
        break;
      case 'elder': {
        const obj = add.sprite(p.x, p.y, 'elder', 'e0').setOrigin(0.5, ELDER_BASE_Y / ELDER_H).setPipeline('Lit').setDepth(p.y);
        place(obj, p.x, p.y, 90, ELDER_BASE_Y);
        const glow = add.sprite(p.x, p.y, 'elder_e', 'e0').setOrigin(0.5, ELDER_BASE_Y / ELDER_H).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y + 0.1);
        place(glow, p.x, p.y, 90, ELDER_BASE_Y);
        st.trees.push({ obj, x: p.x, y: p.y, kind: 'elder', v: 0, anim: 'elder_sway', swaying: false, alpha: 1, r: 76, top: 118, glow });
        break;
      }
      case 'fairy':
        // Fairy lights bobbing over the ring, brightest at night.
        for (let k = 0; k < 6; k++) pl.sparks.push(this.spark(place, p.x + Math.cos(k * 1.05) * 16, p.y - 8 + Math.sin(k * 1.05) * 8, k % 2 ? 0xffb8f0 : 0x9afff0));
        break;
    }
    st.places.push(pl);
  }

  private spark(place: (obj: Placed['obj'], x: number, y: number, hw: number, up: number) => void, x: number, y: number, tint: number): Img {
    const img = this.world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.35).setDepth(y + 30);
    img.setData('x', x).setData('y', y).setData('seed', Math.random() * 10);
    place(img, x, y, 10, 20);
    return img;
  }

  /**
   * The forest stands aside round (x, y) for a secret place (see
   * WhiteStag.ts): the trees and undergrowth there fade away in a glitter,
   * stop no feet, and aren't stood up again; the place's own `blocks` do.
   */
  part(x: number, y: number, r: number, blocks: Blocker[]): void {
    this.gen.addGlade(x, y, r, blocks);
    const inside = (px: number, py: number) => (px - x) ** 2 + (py - y) ** 2 < r * r;
    for (const st of this.stood.values()) {
      const gone = new Set<Placed['obj']>();
      st.placed = st.placed.filter((p) => {
        const px = (p.x0 + p.x1) / 2;
        const py = p.y1 - 6;
        const key = p.obj.texture.key;
        if (!inside(px, py) || key === 'elder' || key === 'elder_e') return true;
        gone.add(p.obj);
        if (key === 'ftree' || key === 'tree') this.world.debris([0xffffff, 0xd8f0ff, 0xb8ffd8], px, py - 30, 14, py + 20, 'spores');
        this.world.tweens.add({ targets: p.obj, alpha: 0, duration: 1100, ease: 'Sine.easeIn', onComplete: () => p.obj.destroy() });
        return false;
      });
      st.trees = st.trees.filter((t) => !gone.has(t.obj));
      st.shrooms = st.shrooms.filter((g) => !gone.has(g.halo));
    }
  }

  /** Take a chunk's things down again. */
  private unstand(key: number): void {
    const st = this.stood.get(key);
    if (!st) return;
    this.stood.delete(key);
    for (const p of st.placed) p.obj.destroy();
    for (const r of st.rays) r.img.destroy();
    for (const l of st.lights) this.world.lights.removeLight(l);
  }

  // ---------------------------------------------------------------- each frame

  /**
   * `hero` is where the player stands and `view` the camera's world view;
   * `d` is the eased daylight (0 night .. 1 day).
   */
  update(time: number, dt: number, d: number, hero: { x: number; y: number; alive: boolean }, view: Phaser.Geom.Rectangle): void {
    this.view.setTo(view.x, view.y, view.width, view.height);
    this.night = 1 - d;
    this.updateGround(view, settings.values.quality !== 'full' ? 2.5 : 4, dt);

    // Chunks: those in view at once, the ones just beyond a few a frame; far ones taken down.
    let made = 0;
    // (While the world is still dark at its opening, even those wait for the painters' layouts.)
    for (const key of this.chunksIn(view, 0)) if (!this.onReady || !this.pool || this.gen.hasLayout(Math.floor(key / 4096), key % 4096)) this.stand(key);
    for (const key of this.chunksIn(view, STAND)) {
      if (this.stood.has(key)) continue;
      // With painters, a chunk ahead waits for them to lay it out, rather than laying it out here.
      if (this.pool && !this.gen.hasLayout(Math.floor(key / 4096), key % 4096)) continue;
      if (made++ >= CHUNKS_PER_FRAME) break;
      this.stand(key);
    }
    for (const key of this.stood.keys()) {
      const cx = Math.floor(key / 4096) * CHUNK;
      const cy = (key % 4096) * CHUNK;
      if (cx + CHUNK < view.left - FORGET || cx > view.right + FORGET || cy + CHUNK < view.top - FORGET || cy > view.bottom + FORGET + ELDER_H) this.unstand(key);
    }

    const vx0 = view.x - 16;
    const vx1 = view.right + 16;
    const vy0 = view.y - 16;
    const vy1 = view.bottom + 16;
    const swayReady = treeSwayReady(this.world);
    const k = Math.min(1, dt / 120);
    const shadowAlpha = SUN_SHADOW_ALPHA * d;
    const nightRays = d < 0.5;
    const strength = Math.abs(d - 0.5) * 2;
    let raysShown = false;
    let leafy = false;
    for (const st of this.stood.values()) {
      for (const p of st.placed) p.obj.setVisible(p.x1 > vx0 && p.x0 < vx1 && p.y1 > vy0 && p.y0 < vy1);
      for (const s of st.shadows) s.setAlpha(shadowAlpha);
      for (const t of st.trees) {
        if (!t.obj.visible) continue;
        if (t.kind !== 'pine' && t.kind !== 'elder') leafy = true;
        if (!t.swaying && (t.anim.startsWith('ftree') || t.kind === 'elder' || swayReady)) {
          t.swaying = true;
          sway(t.obj, t.anim);
          if (t.glow) {
            t.glow.play({ key: 'elder_e_sway', startFrame: t.obj.anims.currentFrame ? t.obj.anims.currentFrame.index - 1 : 0 });
            t.glow.anims.timeScale = t.obj.anims.timeScale;
          }
        }
        // A hero behind a tree sees through its crown.
        const behind = hero.y < t.y - 2 && hero.y > t.y - t.top - 34 && Math.abs(hero.x - t.x) < t.r + 4;
        const goal = behind ? 0.45 : 1;
        if (t.alpha !== goal) {
          t.alpha += (goal - t.alpha) * k;
          if (Math.abs(goal - t.alpha) < 0.01) t.alpha = goal;
          t.obj.setAlpha(t.alpha);
          t.glow?.setAlpha(t.alpha);
        }
      }
      // Sunbeams by day; fainter moonbeams, slanting the other way, by night.
      for (const r of st.rays) {
        const on = r.x + RAY_W > view.x && r.x - RAY_W < view.right && r.y > view.y && r.y - RAY_H < view.bottom;
        r.img.setVisible(on && strength > 0.02);
        if (!r.img.visible) continue;
        raysShown = true;
        const breathe = 0.72 + Math.sin(time * 0.0009 + r.seed) * 0.18 + Math.sin(time * 0.0023 + r.seed * 2) * 0.1;
        r.img.setFlipX(nightRays).setOrigin(nightRays ? 1 - RAY_FOOT_X / RAY_W : RAY_FOOT_X / RAY_W, 1);
        r.img.setTint(nightRays ? 0x9ab8ff : 0xffffff).setAlpha(strength * breathe * (nightRays ? 0.45 : 1));
      }
      // Glowing mushrooms and the standing stones' runes by night.
      for (const g of st.shrooms) if (g.halo.visible) g.halo.setAlpha(this.night * (0.5 + Math.sin(time * 0.0017 + g.seed) * 0.14));
      for (const pl of st.places) this.updatePlace(pl, time, d);
    }
    this.motes.emitting = !nightRays && strength > 0.3 && raysShown;
    this.treeLeaves.emitting = leafy;

    this.stag.update(time, dt, d, hero, view);
    if (hero.alive) {
      this.visit(hero, dt);
      this.updateRegion(hero, dt);
    }
  }

  /** A place's light breathing and its sparks bobbing. */
  private updatePlace(pl: Place, time: number, d: number): void {
    const p = pl.poi;
    if (pl.light && pl.halo) {
      const l = p.kind === 'campfire' ? CAMP_LIGHT : SHRINE_LIGHT;
      const kd = 1 + (l.day - 1) * d;
      const n = p.kind === 'campfire' ? Math.sin(time * 0.011 + p.x) * 0.5 + Math.sin(time * 0.027 + p.y) * 0.3 + Math.sin(time * 0.061) * 0.2 : Math.sin(time * 0.002 + p.x) * 0.8;
      pl.light.intensity = l.i * (0.85 + n * 0.15) * kd;
      pl.halo.setAlpha((0.26 + n * 0.05) * kd);
    }
    for (const s of pl.sparks) {
      if (!s.visible) continue;
      const seed = s.getData('seed') as number;
      const bright = p.kind === 'chest' ? 0.35 + 0.65 * Math.max(0, Math.sin(time * 0.004 + seed)) ** 6 : 0.25 + this.night * 0.6;
      s.setPosition(s.getData('x') + Math.sin(time * 0.0013 + seed) * 3, s.getData('y') + Math.sin(time * 0.0021 + seed * 2) * 3);
      s.setAlpha(bright * (0.7 + Math.sin(time * 0.009 + seed * 5) * 0.3));
    }
  }

  /** The places near the hero, woken by walking up to them. */
  private visit(hero: { x: number; y: number }, dt: number): void {
    const w = this.world;
    for (const st of this.stood.values()) {
      for (const pl of st.places) {
        const p = pl.poi;
        const dist = Math.hypot(hero.x - p.x, (hero.y - p.y) * 1.25);
        if (dist > 60) continue;
        if (p.kind === 'campfire' && dist < CAMP_R) {
          // Resting by the fire: it mends, and here is where the hero rises now.
          if (this.camp?.id !== p.id) {
            this.camp = p;
            w.setRisePoint(p.x, p.y + 18);
            w.popNumber(p.x, p.y - 34, 'CAMP MADE', 0xffb45a);
            sound.pickup(w.pan(p.x));
          }
          this.mendT += dt;
          if (this.mendT >= CAMP_TICK) {
            this.mendT = 0;
            const got = w.mendHero(CAMP_MEND);
            if (got > 0) w.debris([0xffd08a, 0xff9a4a], hero.x, hero.y - 12, 5, hero.y + 20, 'spores');
          }
        } else if (p.kind === 'shrine' && dist < SHRINE_R && !this.used.has(p.id)) {
          this.used.add(p.id);
          const def = SHRINE_BLESSINGS[Math.floor(Math.random() * SHRINE_BLESSINGS.length)];
          heroBuffs.add(def);
          w.buffGained(def);
          sound.heal(w.pan(p.x));
          w.debris([0xffffff, 0x8af6ff, def.tint], p.x, p.y - 20, 26, p.y + 20, 'burst');
          pl.body?.stop().setFrame('spent');
          pl.glow?.stop().setFrame('spent');
          if (pl.light) {
            w.lights.removeLight(pl.light);
            st.lights.splice(st.lights.indexOf(pl.light), 1);
            pl.light = null;
          }
          pl.halo?.setVisible(false).setScale(0);
          pl.halo = null;
        } else if (p.kind === 'chest' && dist < CHEST_R && !this.used.has(p.id)) {
          this.used.add(p.id);
          pl.body?.setFrame('open');
          for (const s of pl.sparks) s.setScale(0);
          w.openTreasure(p.x, p.y - 12);
        } else if (p.kind === 'fairy' && dist < FAIRY_R && !this.used.has(p.id)) {
          this.used.add(p.id);
          w.debris([0xffb8f0, 0x9afff0, 0xffffff], p.x, p.y - 10, 30, p.y + 20, 'gather');
          w.dropGems(Math.random() < 0.3 ? 2 : 1, p.x, p.y - 10);
          for (const s of pl.sparks) s.setScale(0.6);
        }
      }
    }
    if (this.camp && Math.hypot(hero.x - this.camp.x, (hero.y - this.camp.y) * 1.25) >= CAMP_R) this.mendT = 0;
  }

  /** Show a wood's name when the hero has walked into it. */
  private updateRegion(hero: { x: number; y: number }, dt: number): void {
    const s = this.gen.sample(hero.x, hero.y);
    const w = this.gen.region(hero.x, hero.y, s.wx, s.wy);
    const r = this.region;
    if (w.ci === r.ci && w.cj === r.cj) {
      r.heldT = 0;
      return;
    }
    if (w.ci !== r.nextCi || w.cj !== r.nextCj) {
      r.nextCi = w.ci;
      r.nextCj = w.cj;
      r.heldT = 0;
      return;
    }
    r.heldT += dt;
    if (r.heldT < REGION_SETTLE) return;
    r.ci = w.ci;
    r.cj = w.cj;
    r.heldT = 0;
    this.world.announce(this.gen.regionName(w.ci, w.cj));
  }

  /** How far the nearest campfire burns from (x, y), for its crackle. */
  fireDistance(x: number, y: number): number {
    let near = Infinity;
    for (const st of this.stood.values()) for (const pl of st.places) if (pl.poi.kind === 'campfire') near = Math.min(near, Math.hypot(pl.poi.x - x, pl.poi.y - y));
    return near;
  }
}
