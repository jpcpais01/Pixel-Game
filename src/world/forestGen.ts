// The Everwood: an endless forest grown from a seed. Everything here is a
// pure function of the seed and world coordinates, so the same seed always
// gives the same forest, any piece of it can be made in any order (a ground
// tile, a patch of trees, whether a spot can be walked on), and two players
// with the same seed walk the same woods. No Phaser: the arena worker paints
// the map panel's window with it too.
//
// The land is split into regions (a warped Voronoi), each one kind of wood:
// oak woods, birch groves, pine hills, Sakura glades, flower meadows, autumn
// maples, mushroom hollows. Where two meet they mingle over a band rather
// than change at a line. Over them run smooth fields, sampled on a 4 px
// lattice and blended between its nodes (cheap enough to ask per pixel):
//  - thickets, where the treetops close into a roof of leaves (not walkable);
//  - streams, the contour lines of a noise, widening and fading with a
//    second one, with shallow fords here and there;
//  - ponds, the high ground of another noise;
//  - trails, the contour lines of a third, worn into the ground, crossing
//    water on plank bridges.
// Trees, undergrowth, sunbeams, creatures and rare places (a campfire, a
// shrine, a chest, old ruins, standing stones, an elder tree, a fairy ring)
// are picked cell by cell on grids of their own, each cell from its own
// hash, so a chunk's contents never depend on which chunks were made first.

import { hash2, valueNoise } from '../art/env';

/** The world's size: about two hours' walk from the middle to any edge. */
export const FOREST_WORLD = 1 << 20;
export const FOREST_MID = FOREST_WORLD / 2;
/** Side of a chunk: what is made, shown and forgotten together. */
export const CHUNK = 256;

/** Spacing of the field lattice, and nodes per chunk side (with the far edge). */
const NODE = 4;
const NN = CHUNK / NODE;
const NS = NN + 1;
/** Size of a region (one kind of wood), and the band over which neighbours mingle. */
const REGION = 560;
const BAND = 96;
/** Grids things are picked on. */
const TREE_CELL = 22;
/** How far below a place (px) a tree's crown would still stand over it. */
const TREE_SHADE = 96;
const PROP_CELL = 13;
const POI_CELL = 704;
const RAY_CELL = 230;
/** Monster spots tried per chunk, and how far from the start none stand. */
const SPOTS_PER_CHUNK = 2;
const QUIET_START = 280;
/** Caches: field chunks (the heavy ones), chunk layouts, rare places. */
const FIELD_CACHE = 48;
const LAYOUT_CACHE = 120;
const POI_CACHE = 400;

// ---------------------------------------------------------------- the woods

export type BiomeId = 'oak' | 'birch' | 'pine' | 'sakura' | 'meadow' | 'autumn' | 'hollow';
export type WoodKind = 'oak' | 'birch' | 'pine' | 'cherry' | 'maple' | 'willow';

export interface Biome {
  id: BiomeId;
  /** How often a region is this wood. */
  weight: number;
  /** Noise level above which the treetops close into a thicket (higher: fewer). */
  thicket: number;
  /** Chance a tree cell holds a tree. */
  trees: number;
  /** Which trees, by weight. */
  kinds: [WoodKind, number][];
  /** Its thickets' roof ramp (see forestGround.ts). */
  roof: number;
  /** Added to the pond noise: more ponds, or fewer. */
  ponds: number;
  /** Chance a prop cell holds something, and what, by weight. */
  props: number;
  undergrowth: [PropKind, number][];
  /** Monsters that live here, by weight. */
  monsters: [ForestMonster, number][];
  /** A region's name: one of the first words, one of the second. */
  names: [string[], string[]];
}

export type ForestMonster = 'beetle' | 'barkling' | 'puffcap' | 'glowmoth' | 'frog';

export type PropKind =
  | 'bush'
  | 'berry'
  | 'fern'
  | 'rock'
  | 'stump'
  | 'log'
  | 'glowcap'
  | 'redcap'
  | 'tuft'
  | 'flowers'
  | 'reeds'
  | 'boulder'
  | 'bigshroom';

export const BIOMES: Biome[] = [
  {
    id: 'oak',
    weight: 24,
    thicket: 0.6,
    trees: 0.075,
    kinds: [['oak', 80], ['birch', 10], ['pine', 10]],
    roof: 0,
    ponds: 0,
    props: 0.12,
    undergrowth: [['fern', 28], ['bush', 16], ['berry', 6], ['tuft', 24], ['rock', 6], ['stump', 6], ['log', 4], ['redcap', 4], ['flowers', 6]],
    monsters: [['beetle', 3], ['barkling', 2], ['puffcap', 1]],
    names: [['Bramble', 'Acorn', 'Hart', 'Badger', 'Wren', 'Thistle', 'Old Oak', 'Hazel', 'Foxglove', 'Kingfisher'], ['Wood', 'Weald', 'Woods', 'Thicket', 'Copse']],
  },
  {
    id: 'birch',
    weight: 16,
    thicket: 0.7,
    trees: 0.09,
    kinds: [['birch', 82], ['oak', 18]],
    roof: 1,
    ponds: 0.01,
    props: 0.12,
    undergrowth: [['tuft', 36], ['flowers', 22], ['fern', 14], ['bush', 10], ['stump', 6], ['rock', 6]],
    monsters: [['beetle', 2], ['glowmoth', 2], ['puffcap', 1]],
    names: [['Silver', 'White', 'Pale', 'Moon', 'Whisper', 'Frost', 'Linen', 'Dove'], ['Birches', 'Grove', 'Glade', 'Stand']],
  },
  {
    id: 'pine',
    weight: 17,
    thicket: 0.57,
    trees: 0.1,
    kinds: [['pine', 90], ['birch', 10]],
    roof: 2,
    ponds: -0.03,
    props: 0.1,
    undergrowth: [['fern', 24], ['rock', 18], ['boulder', 8], ['stump', 10], ['log', 8], ['redcap', 6], ['tuft', 10]],
    monsters: [['barkling', 3], ['beetle', 2]],
    names: [['Raven', 'Wolf', 'Needle', 'Shadow', 'Cone', 'Black', 'Winter', 'Owl'], ['Pines', 'Pinewood', 'Hills', 'Firs']],
  },
  {
    id: 'sakura',
    weight: 11,
    thicket: 0.72,
    trees: 0.06,
    kinds: [['cherry', 78], ['birch', 12], ['oak', 10]],
    roof: 4,
    ponds: 0.03,
    props: 0.12,
    undergrowth: [['flowers', 26], ['tuft', 30], ['bush', 14], ['rock', 12], ['fern', 10]],
    monsters: [['glowmoth', 3], ['frog', 1], ['puffcap', 1]],
    names: [['Petal', 'Blossom', 'Rosy', 'Dawn', 'Spring', 'Blush', 'Lantern', 'Plum'], ['Glade', 'Grove', 'Garden', 'Bower']],
  },
  {
    id: 'meadow',
    weight: 13,
    thicket: 0.84,
    trees: 0.015,
    kinds: [['oak', 50], ['cherry', 20], ['birch', 30]],
    roof: 0,
    ponds: 0.02,
    props: 0.26,
    undergrowth: [['flowers', 46], ['tuft', 44], ['rock', 5], ['bush', 5]],
    monsters: [['beetle', 2], ['glowmoth', 2], ['frog', 1]],
    names: [['Clover', 'Honey', 'Bell', 'Buttercup', 'Lark', 'Sunny', 'Bumble', 'Daisy'], ['Meadow', 'Fields', 'Lea', 'Green']],
  },
  {
    id: 'autumn',
    weight: 12,
    thicket: 0.62,
    trees: 0.07,
    kinds: [['maple', 74], ['oak', 16], ['birch', 10]],
    roof: 3,
    ponds: 0,
    props: 0.12,
    undergrowth: [['bush', 16], ['berry', 6], ['tuft', 24], ['stump', 10], ['log', 8], ['fern', 14], ['redcap', 8], ['rock', 5]],
    monsters: [['barkling', 2], ['beetle', 2], ['puffcap', 2]],
    names: [['Amber', 'Ember', 'Rust', 'Copper', 'Harvest', 'Gold', 'Fox', 'Hearth'], ['Wood', 'Grove', 'Vale', 'Dale']],
  },
  {
    id: 'hollow',
    weight: 7,
    thicket: 0.56,
    trees: 0.08,
    kinds: [['oak', 55], ['pine', 45]],
    roof: 5,
    ponds: 0.03,
    props: 0.16,
    undergrowth: [['bigshroom', 12], ['glowcap', 30], ['fern', 24], ['log', 10], ['stump', 8], ['boulder', 5], ['redcap', 8]],
    monsters: [['puffcap', 4], ['glowmoth', 2], ['barkling', 1]],
    names: [['Moss', 'Glow', 'Toad', 'Spore', 'Dim', 'Fey', 'Hush', 'Lantern'], ['Hollow', 'Dell', 'Bottom', 'Mire']],
  },
];

const BIOME_WEIGHT = BIOMES.reduce((s, b) => s + b.weight, 0);
/** The start's region is always an oak wood: the forest as it is best known. */
const START_BIOME = 0;

// ---------------------------------------------------------------- places

export type PoiKind = 'campfire' | 'shrine' | 'chest' | 'ruins' | 'stones' | 'elder' | 'fairy';

/** How much room each kind of place clears round itself. */
const POI_R: Record<PoiKind, number> = { campfire: 30, shrine: 26, chest: 22, ruins: 64, stones: 46, elder: 58, fairy: 26 };
const POI_WEIGHTS: [PoiKind, number][] = [
  ['campfire', 20],
  ['shrine', 16],
  ['chest', 16],
  ['ruins', 14],
  ['stones', 12],
  ['elder', 8],
  ['fairy', 10],
];

export interface Poi {
  /** Unique within the seed: which places have been used up this visit. */
  id: number;
  kind: PoiKind;
  x: number;
  y: number;
  /** The glade it keeps clear. */
  r: number;
  /** The biome it stands in. */
  biome: BiomeId;
}

export interface FTree {
  x: number;
  y: number;
  kind: WoodKind;
  v: number;
  flip: boolean;
}

export interface FProp {
  x: number;
  y: number;
  kind: PropKind;
  v: number;
  flip: boolean;
}

export interface Blocker {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface FSpot {
  /** Unique within the seed, and stable: the online slot it's known by. */
  id: number;
  kind: ForestMonster;
  x: number;
  y: number;
}

export interface ChunkLayout {
  cx: number;
  cy: number;
  trees: FTree[];
  props: FProp[];
  /** Places whose middle is in this chunk. */
  pois: Poi[];
  rays: { x: number; y: number; seed: number }[];
  spots: FSpot[];
  /** Everything standing in this chunk that feet can't cross (its own, and its neighbours' that reach in). */
  blockers: Blocker[] | null;
  /** Own blockers only, before the neighbours are merged in. */
  own: Blocker[];
}

/** Field chunks (cx, cy, lattice) and layouts a worker made, for the main thread to take. */
export interface FreshWork {
  fields: [number, number, Float32Array][];
  layouts: ChunkLayout[];
}

/** Trunk footprint and crown reach of each tree, in px from its foot (see Scenery's TREE_SHAPE). */
export const WOOD_SHAPE: Record<WoodKind, { trunk: number; canopyR: number; canopyY: number }> = {
  oak: { trunk: 5, canopyR: 34, canopyY: 68 },
  birch: { trunk: 3, canopyR: 22, canopyY: 78 },
  pine: { trunk: 4, canopyR: 24, canopyY: 56 },
  cherry: { trunk: 5, canopyR: 38, canopyY: 64 },
  maple: { trunk: 5, canopyR: 34, canopyY: 70 },
  willow: { trunk: 5, canopyR: 38, canopyY: 66 },
};

/** Blockers of the undergrowth that stops feet. */
const PROP_BLOCK: Partial<Record<PropKind, [number, number]>> = { rock: [6, 3], stump: [6, 3], log: [15, 4], boulder: [11, 5], bigshroom: [4, 3] };

// ---------------------------------------------------------------- fields

/** Field indices on the lattice. */
const F_WX = 0;
const F_WY = 1;
const F_ROOF = 2;
const F_STREAM = 3;
const F_POND = 4;
const F_TRAIL = 5;
const F_FORD = 6;
const F_TGX = 7;
const F_TGY = 8;
const F_SGX = 9;
const F_SGY = 10;
const NF = 11;

/** What the fields say at one spot (see `sample`). */
export interface Here {
  /** Warp applied before the regions are looked up. */
  wx: number;
  wy: number;
  /** Positive inside a thicket, negative in the open: roughly px from its edge. */
  roof: number;
  /** Positive inside a stream (px from its bank), negative outside. */
  stream: number;
  /** Positive inside a pond, negative outside. */
  pond: number;
  /** Negative on a trail, else px from its edge. */
  trail: number;
  /** 0..1: how much a stream here is a shallow ford. */
  ford: number;
  /** The trail's cross direction (unit), for plank seams. */
  tgx: number;
  tgy: number;
  /** The stream's cross direction (unit), for ripples. */
  sgx: number;
  sgy: number;
}

/** The region (and its neighbour) a spot is in: see `region`. */
export interface Where {
  /** The region's cell, and its biome. */
  ci: number;
  cj: number;
  a: number;
  /** The nearest other region's biome, and how far toward it the spot leans (0 in a region's heart, 0.5 on the border). */
  b: number;
  w: number;
}

const smooth = (a: number, b: number, v: number): number => {
  const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a);
  return t * t * (3 - 2 * t);
};

/** A small LRU cache. */
class Lru<V> {
  private map = new Map<number, V>();
  constructor(private max: number) {}
  get(k: number): V | undefined {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: number, v: V): void {
    this.map.set(k, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }
  has(k: number): boolean {
    return this.map.has(k);
  }
}

const key2 = (i: number, j: number): number => (i + 32768) * 65536 + (j + 32768);

/** A seed from a word (a room's code), so everyone in a room grows the same forest. */
export function seedFrom(word: string): number {
  let h = 2166136261;
  for (let i = 0; i < word.length; i++) h = Math.imul(h ^ word.charCodeAt(i), 16777619);
  return 1 + ((h >>> 0) % 60000);
}

export const randomSeed = (): number => 1 + Math.floor(Math.random() * 60000);
/** The forest the arena select's window looks into. */
export const PREVIEW_SEED = 2718;

export class ForestGen {
  private fields = new Lru<Float32Array>(FIELD_CACHE);
  private layouts = new Lru<ChunkLayout>(LAYOUT_CACHE);
  private poiCells = new Lru<Poi | null>(POI_CACHE);
  /** Salts every noise with the seed. */
  private readonly k: number;
  private startCell: { i: number; j: number };
  private start: { x: number; y: number } | null = null;
  private startFire: Poi | null = null;
  /** The field chunk last sampled, so a run of samples in one chunk skips the cache. */
  private fresh: FreshWork | null = null;
  private lastKey = -1;
  private lastF: Float32Array | null = null;
  private readonly here: Here = { wx: 0, wy: 0, roof: 0, stream: 0, pond: 0, trail: 0, ford: 0, tgx: 0, tgy: 1, sgx: 0, sgy: 1 };
  private readonly where: Where = { ci: 0, cj: 0, a: 0, b: 0, w: 0 };

  constructor(readonly seed: number) {
    this.k = (seed % 60001) * 131;
    // The start's region, looked up exactly (the lattice needs it to exist first).
    const wx = this.warpX(FOREST_MID, FOREST_MID);
    const wy = this.warpY(FOREST_MID, FOREST_MID);
    this.startCell = { i: 0, j: 0 };
    this.nearestCell(FOREST_MID + wx, FOREST_MID + wy);
    this.startCell = { i: this.where.ci, j: this.where.cj };
  }

  private n(x: number, y: number, scale: number, salt: number): number {
    return valueNoise(x, y, scale, this.k + salt);
  }

  private h(x: number, y: number, salt: number): number {
    return hash2(x, y, this.k + salt);
  }

  private warpX(x: number, y: number): number {
    return (this.n(x, y, 230, 11) - 0.5) * 130 + (this.n(x, y, 70, 12) - 0.5) * 24;
  }

  private warpY(x: number, y: number): number {
    return (this.n(x, y, 230, 13) - 0.5) * 130 + (this.n(x, y, 70, 14) - 0.5) * 24;
  }

  // ---------------------------------------------------------------- regions

  private biomeOfCell(i: number, j: number): number {
    if (i === this.startCell.i && j === this.startCell.j) return START_BIOME;
    let r = this.h(i, j, 21) * BIOME_WEIGHT;
    for (let b = 0; b < BIOMES.length; b++) {
      r -= BIOMES[b].weight;
      if (r < 0) return b;
    }
    return 0;
  }

  /** The region cell nearest the warped spot (xw, yw), into `where`. */
  private nearestCell(xw: number, yw: number): Where {
    const gx = Math.floor(xw / REGION);
    const gy = Math.floor(yw / REGION);
    let d1 = 1e12;
    let d2 = 1e12;
    let i1 = 0;
    let j1 = 0;
    let i2 = 0;
    let j2 = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const i = gx + ox;
        const j = gy + oy;
        const px = (i + 0.18 + this.h(i, j, 23) * 0.64) * REGION;
        const py = (j + 0.18 + this.h(i, j, 25) * 0.64) * REGION;
        const d = Math.hypot(xw - px, yw - py);
        if (d < d1) {
          d2 = d1;
          i2 = i1;
          j2 = j1;
          d1 = d;
          i1 = i;
          j1 = j;
        } else if (d < d2) {
          d2 = d;
          i2 = i;
          j2 = j;
        }
      }
    }
    const w = this.where;
    w.ci = i1;
    w.cj = j1;
    w.a = this.biomeOfCell(i1, j1);
    w.b = this.biomeOfCell(i2, j2);
    w.w = w.a === w.b ? 0 : 0.5 * (1 - smooth(0, BAND, d2 - d1));
    return w;
  }

  /** The region at (x, y), with its warp already known (from `sample`). */
  region(x: number, y: number, wx: number, wy: number): Where {
    return this.nearestCell(x + wx, y + wy);
  }

  /** Which biome a single spot takes where two regions mingle: patches of each, not a line. */
  biomeAt(x: number, y: number): number {
    const s = this.sample(x, y);
    const w = this.region(x, y, s.wx, s.wy);
    if (w.w <= 0) return w.a;
    const d = this.n(x, y, 11, 27) * 0.7 + this.h(x >> 1, y >> 1, 29) * 0.3;
    return d < w.w ? w.b : w.a;
  }

  /** The region's name, for the banner when the hero walks into it. */
  regionName(ci: number, cj: number): string {
    const b = BIOMES[this.biomeOfCell(ci, cj)];
    const [first, second] = b.names;
    return `${first[Math.floor(this.h(ci, cj, 31) * first.length)]} ${second[Math.floor(this.h(ci, cj, 33) * second.length)]}`;
  }

  // ---------------------------------------------------------------- the lattice

  /** One lattice node's fields, exactly (the raw stream and trail noise come from the caller, with their slopes). */
  private node(x: number, y: number, out: Float32Array, o: number, sv: number, sgx: number, sgy: number, tv: number, tgx: number, tgy: number, wx: number, wy: number, pois: boolean): void {
    const where = this.nearestCell(x + wx, y + wy);
    const A = BIOMES[where.a];
    const B = BIOMES[where.b];
    const w = where.w;
    const mixB = (f: (b: Biome) => number) => f(A) * (1 - w) + f(B) * w;

    // Streams: where the noise crosses its middle, as wide as a second noise says, only in the wetter lands.
    const sg = Math.max(Math.hypot(sgx, sgy), 0.00035);
    const presence = smooth(0.36, 0.52, this.n(x, y, 1100, 41));
    const hw = presence * (3.4 + 3.6 * this.n(x, y, 260, 43));
    const stream = hw - Math.abs(sv - 0.5) / sg - (1 - presence) * 30;
    // Trails likewise, everywhere.
    const tg = Math.max(Math.hypot(tgx, tgy), 0.00035);
    const trail = Math.abs(tv - 0.5) / tg - (3 + 1.6 * this.n(x, y, 140, 45));
    // Ponds: the peaks of their own noise.
    const pv = this.n(x, y, 180, 47) * 0.7 + this.n(x, y, 54, 49) * 0.3;
    const pond = (pv - 0.8 - mixB((b) => b.ponds)) * 150;
    const ford = smooth(0.68, 0.74, this.n(x, y, 85, 51));

    // Thickets, drawn back from the trails, the water and the places.
    const rv = this.n(x, y, 165, 53) * 0.62 + this.n(x, y, 56, 55) * 0.38;
    let roof = (rv - mixB((b) => b.thicket)) * 120 + (this.n(x, y, 7, 57) - 0.5) * 8 + (this.n(x, y, 19, 59) - 0.5) * 14;
    roof -= Math.max(0, 22 - trail) * 2.2;
    roof -= Math.max(0, 20 + Math.max(stream, pond)) * 2;
    if (pois) {
      for (const p of this.poisNear(x, y)) {
        const d = Math.hypot(x - p.x, (y - p.y) * 1.2);
        roof -= Math.max(0, p.r + 36 - d) * 2.2;
      }
    }

    out[o + F_WX] = wx;
    out[o + F_WY] = wy;
    out[o + F_ROOF] = roof;
    out[o + F_STREAM] = stream;
    out[o + F_POND] = pond;
    out[o + F_TRAIL] = trail;
    out[o + F_FORD] = ford;
    out[o + F_TGX] = tgx / tg;
    out[o + F_TGY] = tgy / tg;
    out[o + F_SGX] = sgx / sg;
    out[o + F_SGY] = sgy / sg;
  }

  private streamNoise(xw: number, yw: number): number {
    return this.n(xw, yw, 470, 61) * 0.8 + this.n(xw, yw, 150, 63) * 0.2;
  }

  private trailNoise(xw: number, yw: number): number {
    return this.n(xw, yw, 330, 65) * 0.84 + this.n(xw, yw, 95, 67) * 0.16;
  }

  /** A chunk's lattice: every node's fields, the slopes taken from the nodes either side. */
  private fieldChunk(cx: number, cy: number): Float32Array {
    const key = key2(cx, cy);
    const had = this.fields.get(key);
    if (had) return had;
    const M = NS + 2;
    const sv = new Float32Array(M * M);
    const tv = new Float32Array(M * M);
    const wxs = new Float32Array(M * M);
    const wys = new Float32Array(M * M);
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < M; i++) {
        const x = x0 + (i - 1) * NODE;
        const y = y0 + (j - 1) * NODE;
        const wx = this.warpX(x, y);
        const wy = this.warpY(x, y);
        const r = j * M + i;
        wxs[r] = wx;
        wys[r] = wy;
        sv[r] = this.streamNoise(x + wx, y + wy);
        tv[r] = this.trailNoise(x + wx, y + wy);
      }
    }
    const f = new Float32Array(NS * NS * NF);
    for (let j = 0; j < NS; j++) {
      for (let i = 0; i < NS; i++) {
        const r = (j + 1) * M + i + 1;
        const sgx = (sv[r + 1] - sv[r - 1]) / (2 * NODE);
        const sgy = (sv[r + M] - sv[r - M]) / (2 * NODE);
        const tgx = (tv[r + 1] - tv[r - 1]) / (2 * NODE);
        const tgy = (tv[r + M] - tv[r - M]) / (2 * NODE);
        this.node(x0 + i * NODE, y0 + j * NODE, f, (j * NS + i) * NF, sv[r], sgx, sgy, tv[r], tgx, tgy, wxs[r], wys[r], true);
      }
    }
    this.fields.set(key, f);
    this.fresh?.fields.push([cx, cy, f]);
    return f;
  }

  /**
   * Keep a note of every field chunk and layout made from here on (a worker
   * does, to hand them to the main thread, which then needn't make them too).
   */
  noteFresh(): void {
    this.fresh = { fields: [], layouts: [] };
  }

  /** What was made since the last call (see `noteFresh`). */
  takeFresh(): FreshWork {
    const f = this.fresh ?? { fields: [], layouts: [] };
    if (this.fresh) this.fresh = { fields: [], layouts: [] };
    return f;
  }

  /** Take what a worker made, where this side hasn't made it itself. */
  adopt(w: FreshWork): void {
    for (const [cx, cy, f] of w.fields) if (!this.fields.has(key2(cx, cy))) this.fields.set(key2(cx, cy), f);
    for (const l of w.layouts) if (!this.layouts.has(key2(l.cx, l.cy))) this.layouts.set(key2(l.cx, l.cy), { ...l, blockers: null });
  }

  /** Is this chunk's lattice made yet? (The world makes them ahead, a little each frame.) */
  hasFields(cx: number, cy: number): boolean {
    return this.fields.has(key2(cx, cy));
  }

  /** Make a chunk's lattice now, if it isn't. */
  prepare(cx: number, cy: number): void {
    this.fieldChunk(cx, cy);
  }

  /** The fields at (x, y), blended from the lattice. The result is reused: copy what must be kept. */
  sample(x: number, y: number): Here {
    const cx = Math.floor(x / CHUNK);
    const cy = Math.floor(y / CHUNK);
    const key = key2(cx, cy);
    let f = this.lastF;
    if (key !== this.lastKey || !f) {
      f = this.fieldChunk(cx, cy);
      this.lastKey = key;
      this.lastF = f;
    }
    const lx = (x - cx * CHUNK) / NODE;
    const ly = (y - cy * CHUNK) / NODE;
    const i = Math.min(NN - 1, Math.floor(lx));
    const j = Math.min(NN - 1, Math.floor(ly));
    const u = lx - i;
    const v = ly - j;
    const a = (j * NS + i) * NF;
    const b = a + NF;
    const c = a + NS * NF;
    const d = c + NF;
    const k00 = (1 - u) * (1 - v);
    const k10 = u * (1 - v);
    const k01 = (1 - u) * v;
    const k11 = u * v;
    const at = (q: number) => f![a + q] * k00 + f![b + q] * k10 + f![c + q] * k01 + f![d + q] * k11;
    const h = this.here;
    h.wx = at(F_WX);
    h.wy = at(F_WY);
    h.roof = at(F_ROOF);
    h.stream = at(F_STREAM);
    h.pond = at(F_POND);
    h.trail = at(F_TRAIL);
    h.ford = at(F_FORD);
    h.tgx = at(F_TGX);
    h.tgy = at(F_TGY);
    h.sgx = at(F_SGX);
    h.sgy = at(F_SGY);
    return h;
  }

  /** The fields at one spot, straight from the noise (for the start and the places, which the lattice itself waits on). */
  private exact(x: number, y: number): Here {
    const e = 2;
    const wx = this.warpX(x, y);
    const wy = this.warpY(x, y);
    const at = (fn: (a: number, b: number) => number, dx: number, dy: number) => fn.call(this, x + dx + this.warpX(x + dx, y + dy), y + dy + this.warpY(x + dx, y + dy));
    const sv = this.streamNoise(x + wx, y + wy);
    const tv = this.trailNoise(x + wx, y + wy);
    const sgx = (at(this.streamNoise, e, 0) - at(this.streamNoise, -e, 0)) / (2 * e);
    const sgy = (at(this.streamNoise, 0, e) - at(this.streamNoise, 0, -e)) / (2 * e);
    const tgx = (at(this.trailNoise, e, 0) - at(this.trailNoise, -e, 0)) / (2 * e);
    const tgy = (at(this.trailNoise, 0, e) - at(this.trailNoise, 0, -e)) / (2 * e);
    const f = new Float32Array(NF);
    this.node(x, y, f, 0, sv, sgx, sgy, tv, tgx, tgy, wx, wy, false);
    return { wx: f[F_WX], wy: f[F_WY], roof: f[F_ROOF], stream: f[F_STREAM], pond: f[F_POND], trail: f[F_TRAIL], ford: f[F_FORD], tgx: f[F_TGX], tgy: f[F_TGY], sgx: f[F_SGX], sgy: f[F_SGY] };
  }

  // ---------------------------------------------------------------- the start

  /**
   * Where the heroes start: on a trail near the middle of the world, in the
   * open, well away from water. A campfire burns beside it.
   */
  spawn(): { x: number; y: number } {
    if (this.start) return this.start;
    let best: { x: number; y: number } | null = null;
    for (let r = 0; r < 1400 && !best; r += 10) {
      const steps = Math.max(1, Math.round((r * Math.PI * 2) / 14));
      for (let s = 0; s < steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        const x = Math.round(FOREST_MID + Math.cos(a) * r);
        const y = Math.round(FOREST_MID + Math.sin(a) * r);
        const e = this.exact(x, y);
        if (e.trail > -1 || e.trail < -3 || e.roof > -40 || Math.max(e.stream, e.pond) > -44) continue;
        // Room for the campfire on the open side.
        const fx = x + e.tgx * 34;
        const fy = y + e.tgy * 34;
        const f = this.exact(fx, fy);
        if (f.trail < 10 || Math.max(f.stream, f.pond) > -30 || f.roof > -30) continue;
        best = { x, y };
        this.startFire = { id: -1, kind: 'campfire', x: Math.round(fx), y: Math.round(fy), r: POI_R.campfire, biome: BIOMES[START_BIOME].id };
        break;
      }
    }
    this.start = best ?? { x: FOREST_MID, y: FOREST_MID };
    return this.start;
  }

  // ---------------------------------------------------------------- places

  /** The place in POI cell (i, j), if it has one. */
  private poiIn(i: number, j: number): Poi | null {
    const key = key2(i, j);
    const had = this.poiCells.get(key);
    if (had !== undefined) return had;
    let poi: Poi | null = null;
    this.spawn();
    const fire = this.startFire;
    if (fire && Math.floor(fire.x / POI_CELL) === i && Math.floor(fire.y / POI_CELL) === j) {
      poi = fire;
    } else if (this.h(i, j, 71) < 0.74) {
      let r = this.h(i, j, 73) * POI_WEIGHTS.reduce((s, p) => s + p[1], 0);
      let kind: PoiKind = 'campfire';
      for (const [k, wt] of POI_WEIGHTS) {
        r -= wt;
        if (r < 0) {
          kind = k;
          break;
        }
      }
      const rad = POI_R[kind];
      for (let t = 0; t < 4 && !poi; t++) {
        const x = Math.round((i + 0.18 + this.h(i, j, 75 + t) * 0.64) * POI_CELL);
        const y = Math.round((j + 0.18 + this.h(i, j, 79 + t) * 0.64) * POI_CELL);
        // Not too near the start: its own campfire is enough there.
        if (fire && Math.hypot(x - fire.x, y - fire.y) < 300) continue;
        const e = this.exact(x, y);
        if (Math.max(e.stream, e.pond) > -(rad + 12) || e.trail < 6) continue;
        const w = this.nearestCell(x + e.wx, y + e.wy);
        const biome = BIOMES[w.a].id;
        // An elder tree wants a wood about it, not a meadow.
        const k: PoiKind = kind === 'elder' && biome === 'meadow' ? 'stones' : kind;
        poi = { id: key, kind: k, x, y, r: POI_R[k], biome };
      }
    }
    this.poiCells.set(key, poi);
    return poi;
  }

  /** Places whose glade might reach (x, y). */
  poisNear(x: number, y: number): Poi[] {
    const out: Poi[] = [];
    const i0 = Math.floor((x - 130) / POI_CELL);
    const i1 = Math.floor((x + 130) / POI_CELL);
    const j0 = Math.floor((y - 130) / POI_CELL);
    const j1 = Math.floor((y + 130) / POI_CELL);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const p = this.poiIn(i, j);
        if (p && Math.abs(p.x - x) < p.r + 60 && Math.abs(p.y - y) < p.r + 60) out.push(p);
      }
    }
    return out;
  }

  /** Places in a box, for a ground tile's floor and glow. */
  poisIn(x0: number, y0: number, x1: number, y1: number): Poi[] {
    const out: Poi[] = [];
    for (let j = Math.floor((y0 - 80) / POI_CELL); j <= Math.floor((y1 + 80) / POI_CELL); j++) {
      for (let i = Math.floor((x0 - 80) / POI_CELL); i <= Math.floor((x1 + 80) / POI_CELL); i++) {
        const p = this.poiIn(i, j);
        if (p && p.x + p.r + 20 > x0 && p.x - p.r - 20 < x1 && p.y + p.r + 20 > y0 && p.y - p.r - 20 < y1) out.push(p);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- trees

  private pick<T>(list: [T, number][], r: number): T {
    let total = 0;
    for (const [, w] of list) total += w;
    let t = r * total;
    for (const [v, w] of list) {
      t -= w;
      if (t < 0) return v;
    }
    return list[0][0];
  }

  /** The tree in tree cell (i, j), if any. */
  treeAt(i: number, j: number): FTree | null {
    const x = Math.round((i + 0.2 + this.h(i, j, 101) * 0.6) * TREE_CELL);
    const y = Math.round((j + 0.2 + this.h(i, j, 103) * 0.6) * TREE_CELL);
    const s = this.sample(x, y);
    if (s.roof > -6) return null;
    const water = Math.max(s.stream, s.pond);
    if (water > -8 || s.trail < 8) return null;
    const start = this.spawn();
    if (Math.hypot(x - start.x, y - start.y) < 46 || (y > start.y && y - start.y < TREE_SHADE && Math.abs(x - start.x) < 60)) return null;
    for (const p of this.poisNear(x, y)) {
      if (Math.hypot(x - p.x, (y - p.y) * 1.2) < p.r + 6) return null;
      // Nor just below one, where its crown would hide the place.
      if (y > p.y && y - p.y < TREE_SHADE && Math.abs(x - p.x) < p.r + 24) return null;
    }
    const biome = BIOMES[this.biomeAt(x, y)];
    let chance = biome.trees * (0.5 + 0.95 * this.n(x, y, 120, 105));
    // Trees crowd a thicket's edge, so their crowns hide where the roof begins.
    if (s.roof > -24) chance = Math.max(chance, 0.22);
    // Willows lean over the water.
    const bank = water > -26 && biome.id !== 'pine';
    if (bank) chance = Math.max(chance, 0.18);
    if (this.h(i, j, 107) >= chance) return null;
    const kind: WoodKind = bank && this.h(i, j, 109) < 0.6 ? 'willow' : this.pick(biome.kinds, this.h(i, j, 111));
    return { x, y, kind, v: Math.floor(this.h(i, j, 113) * 3), flip: this.h(i, j, 115) < 0.5 };
  }

  // ---------------------------------------------------------------- chunks

  /** Everything that stands in chunk (cx, cy). */
  layout(cx: number, cy: number): ChunkLayout {
    const key = key2(cx, cy);
    const had = this.layouts.get(key);
    if (had) return had;
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const x1 = x0 + CHUNK;
    const y1 = y0 + CHUNK;

    // Trees whose foot is in the chunk; the cells either side are kept too, for the undergrowth to keep clear of.
    const trees: FTree[] = [];
    const near = new Map<number, FTree | null>();
    const treeCell = (i: number, j: number) => {
      const k = key2(i, j);
      if (!near.has(k)) near.set(k, this.treeAt(i, j));
      return near.get(k)!;
    };
    for (let j = Math.floor(y0 / TREE_CELL) - 1; j <= Math.floor(y1 / TREE_CELL) + 1; j++) {
      for (let i = Math.floor(x0 / TREE_CELL) - 1; i <= Math.floor(x1 / TREE_CELL) + 1; i++) {
        const t = treeCell(i, j);
        if (t && t.x >= x0 && t.x < x1 && t.y >= y0 && t.y < y1) trees.push(t);
      }
    }

    // Undergrowth.
    const props: FProp[] = [];
    for (let j = Math.floor(y0 / PROP_CELL); j < Math.ceil(y1 / PROP_CELL); j++) {
      for (let i = Math.floor(x0 / PROP_CELL); i < Math.ceil(x1 / PROP_CELL); i++) {
        const x = Math.round((i + 0.15 + this.h(i, j, 121) * 0.7) * PROP_CELL);
        const y = Math.round((j + 0.15 + this.h(i, j, 123) * 0.7) * PROP_CELL);
        if (x < x0 || x >= x1 || y < y0 || y >= y1) continue;
        const p = this.propAt(i, j, x, y, treeCell);
        if (p) props.push(p);
      }
    }

    // Places whose middle is here.
    const pois: Poi[] = [];
    for (let j = Math.floor(y0 / POI_CELL); j <= Math.floor((y1 - 1) / POI_CELL); j++) {
      for (let i = Math.floor(x0 / POI_CELL); i <= Math.floor((x1 - 1) / POI_CELL); i++) {
        const p = this.poiIn(i, j);
        if (p && p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1) pois.push(p);
      }
    }

    // Shafts of light into the glades.
    const rays: ChunkLayout['rays'] = [];
    for (let j = Math.floor(y0 / RAY_CELL); j <= Math.floor((y1 - 1) / RAY_CELL); j++) {
      for (let i = Math.floor(x0 / RAY_CELL); i <= Math.floor((x1 - 1) / RAY_CELL); i++) {
        if (this.h(i, j, 131) > 0.34) continue;
        const x = Math.round((i + 0.2 + this.h(i, j, 133) * 0.6) * RAY_CELL);
        const y = Math.round((j + 0.2 + this.h(i, j, 135) * 0.6) * RAY_CELL);
        if (x < x0 || x >= x1 || y < y0 || y >= y1) continue;
        const s = this.sample(x, y);
        if (s.roof > -14 || Math.max(s.stream, s.pond) > -2) continue;
        rays.push({ x, y, seed: Math.floor(this.h(i, j, 137) * 100) });
      }
    }

    // A creature or two.
    const spots: FSpot[] = [];
    const start = this.spawn();
    for (let k = 0; k < SPOTS_PER_CHUNK; k++) {
      if (this.h(cx, cy, 141 + k) > 0.33) continue;
      const x = Math.round(x0 + 24 + this.h(cx, cy, 145 + k) * (CHUNK - 48));
      const y = Math.round(y0 + 24 + this.h(cx, cy, 149 + k) * (CHUNK - 48));
      if (Math.hypot(x - start.x, y - start.y) < QUIET_START) continue;
      const s = this.sample(x, y);
      const water = Math.max(s.stream, s.pond);
      if (s.roof > -14 || water > -6) continue;
      if (this.poisNear(x, y).some((p) => Math.hypot(x - p.x, y - p.y) < p.r + 10)) continue;
      const biome = BIOMES[this.biomeAt(x, y)];
      const kind: ForestMonster = water > -40 && this.h(cx, cy, 153 + k) < 0.6 ? 'frog' : this.pick(biome.monsters, this.h(cx, cy, 157 + k));
      spots.push({ id: (((cx & 0xfff) * 4096 + (cy & 0xfff)) * 4 + k), kind, x, y });
    }

    // What stops feet.
    const own: Blocker[] = [];
    for (const t of trees) own.push({ x: t.x, y: t.y - 1, rx: WOOD_SHAPE[t.kind].trunk + 1, ry: 3 });
    for (const p of props) {
      const b = PROP_BLOCK[p.kind];
      if (b) own.push({ x: p.kind === 'log' ? p.x + (p.flip ? -1 : 1) : p.x, y: p.y - 2, rx: b[0], ry: b[1] });
    }
    for (const p of pois) own.push(...poiBlockers(p, this));

    const out: ChunkLayout = { cx, cy, trees, props, pois, rays, spots, blockers: null, own };
    this.layouts.set(key, out);
    this.fresh?.layouts.push(out);
    return out;
  }

  /** The undergrowth in prop cell (i, j), at (x, y), if any. */
  private propAt(i: number, j: number, x: number, y: number, treeCell: (i: number, j: number) => FTree | null): FProp | null {
    const s = this.sample(x, y);
    if (s.roof > -3 || s.trail < 3) return null;
    const water = Math.max(s.stream, s.pond);
    const r = this.h(i, j, 161);
    const v = Math.floor(this.h(i, j, 163) * 4);
    const flip = this.h(i, j, 165) < 0.5;
    // Reeds along the banks.
    if (water > -6 && water < -1.2) return r < 0.55 ? { x, y, kind: 'reeds', v, flip } : null;
    if (water > -8) return null;
    for (const p of this.poisNear(x, y)) if (Math.hypot(x - p.x, (y - p.y) * 1.2) < p.r) return null;
    const start = this.spawn();
    if (Math.hypot(x - start.x, y - start.y) < 20) return null;
    const ti = Math.floor(x / TREE_CELL);
    const tj = Math.floor(y / TREE_CELL);
    for (let b = -1; b <= 1; b++) {
      for (let a = -1; a <= 1; a++) {
        const t = treeCell(ti + a, tj + b);
        if (t && Math.abs(t.x - x) < 10 && Math.abs(t.y - y) < 7) return null;
      }
    }
    const biome = BIOMES[this.biomeAt(x, y)];
    // The thicket's edge is crowded with ferns and bushes.
    if (s.roof > -22) {
      if (r > 0.34) return null;
      return { x, y, kind: r < 0.17 ? 'fern' : biome.id === 'hollow' ? 'glowcap' : 'bush', v, flip };
    }
    const chance = biome.props * (0.6 + this.n(x, y, 60, 167) * 0.8);
    if (r >= chance) return null;
    return { x, y, kind: this.pick(biome.undergrowth, this.h(i, j, 169)), v, flip };
  }

  /** Everything that stops feet in a chunk, its neighbours' included where they reach in. */
  blockers(cx: number, cy: number): Blocker[] {
    const l = this.layout(cx, cy);
    if (l.blockers) return l.blockers;
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const list: Blocker[] = [];
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const src = i === 0 && j === 0 ? l.own : this.layout(cx + i, cy + j).own;
        for (const b of src) if (b.x + b.rx > x0 - 1 && b.x - b.rx < x0 + CHUNK + 1 && b.y + b.ry > y0 - 1 && b.y - b.ry < y0 + CHUNK + 1) list.push(b);
      }
    }
    l.blockers = list;
    return list;
  }

  /** Can feet stand at (x, y)? */
  walkable(x: number, y: number): boolean {
    if (x < 16 || y < 16 || x > FOREST_WORLD - 16 || y > FOREST_WORLD - 16) return false;
    const s = this.sample(x, y);
    if (s.roof > -9) return false;
    const water = Math.max(s.stream, s.pond);
    // Water stops feet, but for a bridge, or a ford's shallows.
    if (water > 0.5 && s.trail > 0.5 && !(s.ford > 0.5 && s.stream >= s.pond)) return false;
    for (const b of this.blockers(Math.floor(x / CHUNK), Math.floor(y / CHUNK))) {
      const dx = (x - b.x) / b.rx;
      const dy = (y - b.y) / b.ry;
      if (dx * dx + dy * dy < 1) return false;
    }
    return true;
  }

  /** Has chunk (cx, cy)'s layout been made? */
  hasLayout(cx: number, cy: number): boolean {
    return this.layouts.has(key2(cx, cy));
  }

  /** Where a monster spot's id says it is (the host names monsters by it). */
  spotById(id: number): FSpot | null {
    // Chunk coordinates are within 0..4095 in this world (see `layout`).
    const cell = Math.floor(id / 4);
    return this.layout(Math.floor(cell / 4096), cell % 4096).spots.find((s) => s.id === id) ?? null;
  }
}

// ---------------------------------------------------------------- the places' pieces

/** Ruins: pillars round a broken floor, a wall or two, from the place's own hash. */
export function ruinPieces(p: Poi): { kind: 'pillar' | 'wall_h' | 'wall_v'; x: number; y: number; v: number }[] {
  const out: { kind: 'pillar' | 'wall_h' | 'wall_v'; x: number; y: number; v: number }[] = [];
  const h = (k: number) => hash2(p.x, p.y, 900 + k);
  const n = 5 + Math.floor(h(1) * 3);
  const turn = h(2) * Math.PI * 2;
  for (let k = 0; k < n; k++) {
    // Some of the ring has fallen: skip a pillar now and then.
    if (h(10 + k) < 0.22) continue;
    const a = turn + (k / n) * Math.PI * 2;
    out.push({ kind: 'pillar', x: Math.round(p.x + Math.cos(a) * 44), y: Math.round(p.y + Math.sin(a) * 30), v: Math.floor(h(20 + k) * 3) });
  }
  // A run of fallen wall to the north (two or three stones of it), and now and then one down a side.
  const hx = Math.round(p.x - 26 + h(3) * 30);
  const hy = Math.round(p.y - 36 - h(4) * 8);
  const hn = 2 + Math.floor(h(5) * 2);
  for (let k = 0; k < hn; k++) out.push({ kind: 'wall_h', x: hx + k * 22, y: hy, v: Math.floor(h(30 + k) * 3) });
  if (h(6) < 0.6) {
    const vx = Math.round(p.x + (h(7) < 0.5 ? -58 : 58));
    const vy = Math.round(p.y - 4 + h(8) * 10);
    for (let k = 0; k < 2; k++) out.push({ kind: 'wall_v', x: vx, y: vy + k * 20, v: Math.floor(h(40 + k) * 3) });
  }
  return out;
}

/** Standing stones: a ring of them round the place's middle. */
export function stonePieces(p: Poi): { x: number; y: number; v: number }[] {
  const n = 5 + Math.floor(hash2(p.x, p.y, 931) * 3);
  const turn = hash2(p.x, p.y, 933) * Math.PI;
  return Array.from({ length: n }, (_, k) => {
    const a = turn + (k / n) * Math.PI * 2;
    return { x: Math.round(p.x + Math.cos(a) * 34), y: Math.round(p.y + Math.sin(a) * 22), v: Math.floor(hash2(p.x + k, p.y, 935) * 3) };
  });
}

/** The stumps sat round a campfire, from its middle. */
export const CAMP_SEATS = [
  { x: -21, y: 5, v: 0 },
  { x: 20, y: -4, v: 1 },
];

/** Where a place stops feet. */
function poiBlockers(p: Poi, gen: ForestGen): Blocker[] {
  switch (p.kind) {
    case 'campfire':
      return [{ x: p.x, y: p.y - 1, rx: 8, ry: 4 }, ...CAMP_SEATS.map((s) => ({ x: p.x + s.x, y: p.y + s.y - 1, rx: 6, ry: 3 }))];
    case 'shrine':
      return [{ x: p.x, y: p.y - 2, rx: 10, ry: 4 }];
    case 'chest':
      return [{ x: p.x, y: p.y - 2, rx: 8, ry: 3 }];
    case 'elder':
      return [{ x: p.x, y: p.y - 2, rx: 15, ry: 6 }];
    case 'stones':
      return stonePieces(p).map((s) => ({ x: s.x, y: s.y - 1, rx: 5, ry: 3 }));
    case 'ruins':
      return ruinPieces(p)
        .filter((r) => gen.sample(r.x, r.y).trail > 2)
        .map((r) => (r.kind === 'pillar' ? { x: r.x, y: r.y - 2, rx: 8, ry: 4 } : r.kind === 'wall_h' ? { x: r.x, y: r.y - 4, rx: 13, ry: 5 } : { x: r.x, y: r.y - 9, rx: 6, ry: 11 }));
    default:
      return [];
  }
}

// ---------------------------------------------------------------- the forest being walked

let current: ForestGen | null = null;

/** The forest the world is in now (walkability asks it), or null elsewhere. */
export function useForest(gen: ForestGen | null): void {
  current = gen;
}

export const currentForest = (): ForestGen | null => current;

export const forestWalkable = (x: number, y: number): boolean => (current ? current.walkable(x, y) : false);
