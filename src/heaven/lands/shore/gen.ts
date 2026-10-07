// Glowtide Shore, grown: an endless coast running east and west, the calm sea
// to the south, a warm beach, then dunes, then a sea-grape thicket too thick
// to walk into. Everything is a function of the fixed seed and the position
// (see ../types.ts), and most of it of x alone: the shoreline, how wide the
// wet sand is, where the dunes and the thicket begin, which stretches are
// rocky, where a pier runs out or a lantern stands. So a column of the coast
// is worked out once and kept (`col`), and each pixel only adds its own
// small noise: ripples, dither, the odd glint.
//
// No Phaser here: the land worker and scripts/lands.ts grow it too.

import { hash2, rng, valueNoise } from '../../../art/env';
import { bayer, smooth } from '../paint';
import { CHUNK, LAND_MID, type ChunkLayout, type GroundCell, type LandGen, type LandGround, type LandLight, type LandProp, type LifeSpot, type TileFields } from '../types';
import { SHORE_KINDS, S } from './palette';

/** The one Glowtide Shore everyone walks. */
export const SHORE_SEED = 51121;

// ---------------------------------------------------------------- the coast's shape (px)

/** How far the shoreline swings north and south: wide bays, then coves, then a ragged edge. */
const BAY_AMP = 300;
const BAY_SCALE = 900;
const COVE_AMP = 90;
const COVE_SCALE = 210;
const EDGE_AMP = 10;
const EDGE_SCALE = 46;
/** Wet sand's width (px from the water), at least and at most. */
const WET_MIN = 9;
const WET_MAX = 18;
/** Where the dunes begin (px inland from the water) and how much it wanders. */
const DUNE_AT = 130;
const DUNE_SPREAD = 90;
/** How far past the dunes' start the thicket begins, and how much that wanders. */
const SCRUB_GAP = 150;
const SCRUB_SPREAD = 100;
/** Past this far into the thicket nothing can be walked, gaps or not. */
const SCRUB_WALL = 60;
/** How far into the water feet may wade (px). */
const WADE = 7;
/** Where the sea's colour bands change (px of depth), shallow to deep. */
const BANDS = [3, 8, 15, 25, 38, 55, 78, 106, 140, 182, 235, 300];
/** A stretch of coast is rocky (stones, tide pools, pebbles) where its noise passes this. */
const ROCKY = 0.64;

// ---------------------------------------------------------------- lagoons and pools

/** Lagoons lie this far inland at least (px), and their water starts where the field passes LAG_T. */
const LAG_IN = 48;
const LAG_T = 0.66;
/** Lagoons' water can be waded this far from its edge (in the field's units). */
const LAG_WADE = 0.06;
/** Tide pools: their size (rx px) and the chance a sandy column of the coast has one. */
const POOL_R: [number, number] = [6, 12];
const POOL_ODDS = 0.3;

// ---------------------------------------------------------------- landmarks

/** The chance a column of the coast (a chunk wide) has a pier, a rowboat, a lantern. */
const PIER_ODDS = 0.07;
const BOAT_ODDS = 0.05;
const LANTERN_ODDS = 0.45;
/** A pier: half its width, its length out to sea (at least, plus up to), its head's half width and depth. */
const PIER_HALF = 7;
const PIER_LEN: [number, number] = [110, 70];
const PIER_HEAD = 15;
const PIER_HEAD_LEN = 16;
/** Its posts stand out of the water this far apart (px). */
const PIER_POSTS = 15;
/** The lanterns' light. */
const LANTERN: Omit<LandLight, 'x' | 'y'> = { radius: 100, color: 0xffb35e, intensity: 1.2, day: 0, flicker: 0.3, halo: 0.55 };

/** A column of the coast: everything about it that depends on x alone. */
interface Col {
  x: number;
  shore: number;
  wet: number;
  dune: number;
  scrub: number;
  rocky: number;
}

interface Pool {
  x: number;
  y: number;
  rx: number;
  ry: number;
  seed: number;
}

interface Pier {
  x: number;
  y0: number;
  y1: number;
}

/** Columns kept (a ring keyed by x). */
const COLS = 4096;

export class ShoreGen implements LandGen {
  readonly seed = SHORE_SEED;
  readonly ground: LandGround;
  private colX = new Float64Array(COLS).fill(NaN);
  private cols: Col[] = new Array(COLS);
  private pools = new Map<number, Pool[]>();
  private piers = new Map<number, Pier | null>();
  /** The last canopy clump found: its own shade (0..1), and how far toward its sunny upper left the pixel is. */
  private clump = 0;
  private rim = 0;

  constructor() {
    const self = this;
    this.ground = {
      kinds: SHORE_KINDS,
      cell: (x, y, c) => self.cell(x, y, c),
      decorate: (f) => self.decorate(f),
    };
  }

  /** A well-mixed 0..1 draw for column `n` (the per-pixel hash2 is too lumpy for rare one-offs like piers). */
  private draw(n: number, salt: number): number {
    let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + this.seed, 0xc2b2ae35);
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ---------------------------------------------------------------- the coast, by column

  col(x: number): Col {
    x = Math.floor(x);
    const i = x & (COLS - 1);
    if (this.colX[i] === x) return this.cols[i];
    const s = this.seed;
    const n = (scale: number, k: number) => valueNoise(x, 0, scale, s + k);
    const shore = LAND_MID + (n(BAY_SCALE, 1) - 0.5) * BAY_AMP + (n(COVE_SCALE, 2) - 0.5) * COVE_AMP + (n(EDGE_SCALE, 3) - 0.5) * EDGE_AMP;
    const dune = DUNE_AT + n(260, 5) * DUNE_SPREAD;
    const c: Col = {
      x,
      shore,
      wet: WET_MIN + n(70, 4) * (WET_MAX - WET_MIN),
      dune,
      scrub: dune + SCRUB_GAP + n(190, 6) * SCRUB_SPREAD,
      rocky: n(380, 7),
    };
    this.colX[i] = x;
    this.cols[i] = c;
    return c;
  }

  /** The shoreline's y at x. */
  shore(x: number): number {
    return this.col(x).shore;
  }

  /** The tide pools of the coast's column `cx` (a chunk wide). */
  poolsOf(cx: number): Pool[] {
    let list = this.pools.get(cx);
    if (list) return list;
    list = [];
    const R = rng(Math.floor(this.draw(cx, 11) * 2 ** 31));
    const rocky = this.col(cx * CHUNK + CHUNK / 2).rocky > ROCKY;
    const n = rocky ? 2 + Math.floor(R() * 2) : R() < POOL_ODDS ? 1 : 0;
    for (let k = 0; k < n; k++) {
      const x = cx * CHUNK + 24 + R() * (CHUNK - 48);
      const rx = POOL_R[0] + R() * (POOL_R[1] - POOL_R[0]);
      const c = this.col(x);
      const y = c.shore - c.wet - 6 - R() * 26;
      if (this.pierOf(cx) && Math.abs(x - this.pierOf(cx)!.x) < 40) continue;
      if (list.some((p) => Math.abs(p.x - x) < p.rx + rx + 10)) continue;
      list.push({ x, y, rx, ry: rx * 0.62, seed: Math.floor(R() * 1000) });
    }
    if (this.pools.size > 512) this.pools.clear();
    this.pools.set(cx, list);
    return list;
  }

  /** The pier of the coast's column `cx`, if it has one. */
  pierOf(cx: number): Pier | null {
    const had = this.piers.get(cx);
    if (had !== undefined) return had;
    let p: Pier | null = null;
    const mid = cx * CHUNK + CHUNK / 2;
    if (this.draw(cx, 31) < PIER_ODDS && this.col(mid).rocky < ROCKY) {
      const x = cx * CHUNK + 96 + Math.floor(this.draw(cx, 32) * 64);
      const c = this.col(x);
      p = { x, y0: Math.round(c.shore - c.wet - 14), y1: Math.round(c.shore + PIER_LEN[0] + this.draw(cx, 33) * PIER_LEN[1]) };
    }
    if (this.piers.size > 512) this.piers.clear();
    this.piers.set(cx, p);
    return p;
  }

  /** Is (x, y) on a pier's deck, and how wide is the deck there? */
  private deck(x: number, y: number): { p: Pier; half: number } | null {
    const p = this.pierOf(Math.floor(x / CHUNK));
    if (!p || y < p.y0 || y >= p.y1) return null;
    const half = y >= p.y1 - PIER_HEAD_LEN ? PIER_HEAD : PIER_HALF;
    return x >= p.x - half && x < p.x + half ? { p, half } : null;
  }

  /** The pier's posts, standing out of the water on either side of its deck. */
  private post(x: number, y: number): boolean {
    const p = this.pierOf(Math.floor(x / CHUNK));
    if (!p || y < p.y0 || y >= p.y1) return false;
    const half = y >= p.y1 - PIER_HEAD_LEN ? PIER_HEAD : PIER_HALF;
    const lx = x - p.x;
    const along = (p.y1 - 1 - y) % PIER_POSTS;
    return along < 2 && (lx === -half - 1 || lx === -half - 2 || lx === half || lx === half + 1);
  }

  /** How far into a tide pool (x, y) is: under 1 is water, up to about 1.8 its rim of stones; Infinity when none is near. */
  private poolAt(x: number, y: number): { e: number; pool: Pool } | null {
    const cx = Math.floor(x / CHUNK);
    for (let k = cx - 1; k <= cx + 1; k++) {
      for (const p of this.poolsOf(k)) {
        const dx = (x - p.x) / p.rx;
        const dy = (y - p.y) / p.ry;
        if (Math.abs(dx) > 1.8 || Math.abs(dy) > 1.8) continue;
        const e = (dx * dx + dy * dy) * (1 + (valueNoise(x, y, 4, p.seed) - 0.5) * 0.4);
        if (e < 3.4) return { e, pool: p };
      }
    }
    return null;
  }

  /** The lagoon field at (x, y): above 0 is water (deeper as it rises), a little below 0 its wet rim. */
  private lagoon(x: number, y: number, u: number, c: Col): number {
    if (u < LAG_IN || u > c.scrub - 20) return -1;
    const mask = smooth(LAG_IN, LAG_IN + 40, u) * (1 - smooth(c.scrub - 70, c.scrub - 20, u));
    const L = (valueNoise(x, y, 130, this.seed + 21) * 0.62 + valueNoise(x, y, 46, this.seed + 23) * 0.38) * mask;
    return (L - LAG_T) / 0.1;
  }

  /** The thicket's canopy at (x, y): how high its clump of leaves stands (0 for none). */
  private canopy(x: number, y: number, u: number, c: Col): number {
    if (u < c.scrub - 30) return 0;
    const G = 12;
    const gx = Math.floor(x / G);
    const gy = Math.floor(y / G);
    let best = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const ci = gx + i;
        const cj = gy + j;
        const sx = (ci + 0.2 + hash2(ci, cj, 401) * 0.6) * G;
        const sy = (cj + 0.2 + hash2(ci, cj, 403) * 0.6) * G;
        const r = 7 + hash2(ci, cj, 407) * 5;
        const dx = (x + 0.5 - sx) / r;
        const dy = (y + 0.5 - sy) / (r * 0.85);
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        const z = hash2(ci, cj, 409) * 0.5 + Math.sqrt(1 - d2);
        if (z > best) {
          best = z;
          this.clump = hash2(ci, cj, 411);
          this.rim = -dx * 0.5 - dy * 0.85;
        }
      }
    }
    // The thicket thins to scattered bushes at its edge.
    const need = 1.45 * (1 - smooth(c.scrub - 30, c.scrub + 50, u));
    return best > need ? best : 0;
  }

  // ---------------------------------------------------------------- the ground, a pixel at a time

  cell(x: number, y: number, c: GroundCell): void {
    const col = this.col(x);
    const d = y - col.shore;
    const s = this.seed;
    const dk = this.deck(x, y);
    if (dk) return this.plank(x, y, dk.p, dk.half, d > 0, c);

    if (d > 0 && this.post(x, y)) {
      c.kind = S.Post;
      c.height = 4;
      c.tone = 2;
      return;
    }
    if (d > 0) {
      // The sea: bands of colour by depth, the sand banks under it making
      // the shallows reach out here and pull in there.
      c.kind = S.Sea;
      const dd = d * (0.72 + valueNoise(x, y, 80, s + 41) * 0.56);
      let i = 0;
      while (i < BANDS.length && dd >= BANDS[i]) i++;
      let t = BANDS.length - 1 - i;
      if (i > 0 && i < BANDS.length) {
        const f = (dd - BANDS[i - 1]) / (BANDS[i] - BANDS[i - 1]);
        if (f > 0.7 && bayer(x, y) < (f - 0.7) * 1.6) t--;
      }
      if (i >= BANDS.length) t = 0;
      // Long low swells, and now and then a glint of the low sun.
      if (dd > 14 && valueNoise(x, y * 6, 30, s + 43) > 0.83) t += 1;
      if (dd > 24 && hash2(Math.floor(x / 4), y, s + 45) > 0.991) t += 2;
      // A pier's shadow lies on the water to its south-east.
      const pier = this.pierOf(Math.floor(x / CHUNK));
      if (pier && y >= pier.y0 + 2 && y < pier.y1 + 3) {
        const half = y >= pier.y1 - PIER_HEAD_LEN + 2 ? PIER_HEAD : PIER_HALF;
        if (x >= pier.x + half && x < pier.x + half + 3) t -= 2;
        if (y >= pier.y1 && x >= pier.x - half + 2 && x < pier.x + half + 2) t -= 2;
      }
      c.tone = t;
      // Glowing plankton where the water meets the sand, and a few specks further out.
      if (d < 7) c.glow = 0.9 * (1 - d / 7);
      else if (d < 60 && hash2(x, y, s + 47) > 0.993) c.glow = 0.65;
      return;
    }

    const u = -d;
    if (u < 70) {
      const tp = this.poolAt(x, y);
      if (tp && this.pool(x, y, tp.e, tp.pool, c)) return;
    }
    if (u < col.wet) {
      // Wet sand: darker, a glassy film right at the water, dithering out into the dry.
      const edge = col.wet - 3;
      if (!(u > edge && bayer(x, y) < (u - edge) / 3)) {
        c.kind = S.Wet;
        c.tone = (valueNoise(x, y, 7, s + 51) - 0.5) * 0.9 + (u < 3 ? 1.6 : u < 5 ? 0.6 : 0);
        c.height = valueNoise(x, y, 5, s + 52) * 0.25;
        if (u < 4) c.glow = 0.35 * (1 - u / 4);
        return;
      }
    }
    // The wrack line, where the last high tide left its weed.
    if (u >= col.wet && u < col.wet + 4 && valueNoise(x, 0, 36, s + 55) > 0.42 && valueNoise(x, y, 5, s + 57) > 0.7) {
      c.kind = S.Kelp;
      c.height = 0.7;
      c.tone = valueNoise(x, y, 3, s + 58) > 0.5 ? 1 : 0;
      return;
    }

    const lv = this.lagoon(x, y, u, col);
    if (lv > -0.22) {
      if (lv > 0) {
        // Lagoon water, pale at its edge and deepening to its middle.
        c.kind = S.Pool;
        const t = 6 - lv * 9;
        const fl = Math.floor(t);
        c.tone = Math.max(1, t - fl > bayer(x, y) ? fl + 1 : fl);
        // Faint ripples catching the light on still water.
        if (lv > 0.15 && valueNoise(x, y * 5, 22, s + 63) > 0.8) c.tone += 1;
        if (lv < 0.12) c.glow = 0.75 * (1 - lv / 0.12);
        else if (hash2(x, y, s + 61) > 0.992) c.glow = 0.6;
        return;
      }
      // Its rim of wet sand, dithering out into the dry.
      if (lv > -0.14 || bayer(x, y) < (lv + 0.22) / 0.08) {
        c.kind = S.Wet;
        c.tone = (lv > -0.04 ? 1.2 : 0) + (valueNoise(x, y, 7, s + 51) - 0.5) * 0.8;
        if (lv > -0.03) c.glow = 0.3;
        return;
      }
    }

    const z = this.canopy(x, y, u, col);
    if (z > 0) {
      // The sea-grape thicket: domed clumps of round leaves, dark in the gaps.
      c.kind = S.Scrub;
      c.height = 3 + z * 4.5;
      // Each clump its own shade, lit on its upper left, dark in the creases.
      let t = (hash2(x >> 1, y >> 1, s + 71) - 0.5) * 0.9 + (this.clump - 0.5) * 1.6;
      if (this.rim > 0.45) t += 0.8;
      if (z < 0.4) t -= 1.6;
      c.tone = t;
      return;
    }
    if (u > col.scrub + 40) {
      // Deep in the thicket, a gap between clumps: shade.
      c.kind = S.Scrub;
      c.tone = -3;
      c.height = 1;
      return;
    }

    // Dry sand: wind ripples, and the dunes' long swells.
    c.kind = S.Sand;
    const dune = smooth(col.dune - 30, col.dune + 40, u);
    // Ripples only in patches, where the wind has had its way.
    const patch = smooth(0.42, 0.72, valueNoise(x, y, 110, s + 89));
    const ripple = Math.sin(x * 0.2 + y * 0.93 + valueNoise(x, y, 50, s + 81) * 11) * smooth(col.wet, col.wet + 40, u) * (1 - dune * 0.7) * patch;
    const swell = (valueNoise(x, y, 84, s + 83) * 0.75 + valueNoise(x, y, 40, s + 85) * 0.25) * 7 * dune;
    c.height = ripple * 0.12 + swell;
    c.tone = (valueNoise(x, y, 70, s + 87) - 0.5) * 1.1;
    // The thicket's shade falls on the sand below and to the right of it.
    if (u > col.scrub - 40 && this.canopy(x - 2, y - 4, u + 4, col) > 0) c.tone -= 2.2;
  }

  /** A pier's deck: boards across it, beams down its sides, posts standing out. */
  private plank(x: number, y: number, p: Pier, half: number, wet: boolean, c: GroundCell): void {
    const lx = x - p.x;
    const ly = y - p.y0;
    c.height = 3;
    if (lx === -half || lx === half - 1 || (half === PIER_HEAD && y === p.y1 - 1)) {
      c.kind = S.Post;
      c.tone = 1;
      c.height = 3.4;
      return;
    }
    if (ly % 4 === 3) {
      c.kind = S.Post;
      c.tone = wet ? -1 : 0;
      c.height = 2.4;
      return;
    }
    c.kind = S.Plank;
    const board = Math.floor(ly / 4);
    c.tone = (hash2(board, p.x, this.seed + 91) - 0.5) * 1.4 + (hash2(x >> 2, board, this.seed + 93) > 0.85 ? -0.8 : 0);
  }

  /** A tide pool: still water ringed by rounded stones. False outside its rim. */
  private pool(x: number, y: number, e: number, p: Pool, c: GroundCell): boolean {
    if (e < 1) {
      c.kind = S.Pool;
      c.tone = Math.round(6 - Math.sqrt(1 - e) * 5);
      if (e > 0.72) c.glow = 0.8;
      return true;
    }
    const sx = x / 3.6;
    const sy = y / 2.8;
    const ci = Math.floor(sx);
    const cj = Math.floor(sy);
    const h = hash2(ci, cj, p.seed);
    if (e > 1.5 + h * 0.5) return false;
    const fx = sx - ci - 0.5;
    const fy = sy - cj - 0.5;
    const dome = 1 - (fx * fx + fy * fy) * 2.2;
    c.kind = S.Rock;
    c.height = 1.2 + Math.max(0, dome) * 1.8 + h * 0.6;
    c.tone = (h - 0.5) * 1.6 + (dome < 0.2 ? -1.3 : 0);
    return true;
  }

  /** Small things over the finished ground: dune grass, pebbles, shells and starfish. */
  decorate(f: TileFields): void {
    const R = rng(Math.floor(hash2(f.x0 / 64, f.y0 / 64, this.seed + 101) * 2 ** 31));
    const at = (x: number, y: number) => (y - f.y0 + 1) * f.pw + (x - f.x0) + 1;
    const inside = (x: number, y: number) => x >= f.x0 - 1 && x <= f.x0 + f.w && y >= f.y0 - 1 && y <= f.y0 + f.h;
    const W = f.w;
    const H = f.h;
    // Dune grass: short blades where the dunes are greenest.
    for (let k = 0; k < (W * H) / 14; k++) {
      const x = f.x0 + Math.floor(R() * W);
      const y = f.y0 + Math.floor(R() * H);
      const i = at(x, y);
      if (f.kind[i] !== S.Sand) continue;
      const c = this.col(x);
      const u = c.shore - y;
      const g = valueNoise(x, y, 20, this.seed + 111) * smooth(c.dune - 10, c.dune + 60, u);
      if (g < 0.5 || R() > (g - 0.5) * 2.5) continue;
      const len = 2 + Math.floor(R() * 3);
      const lean = R() < 0.5 ? -1 : 1;
      for (let j = 0; j < len; j++) {
        const bx = x + (j >= 2 && R() < 0.6 ? lean : 0);
        const by = y - j;
        if (!inside(bx, by)) break;
        const b = at(bx, by);
        if (f.kind[b] !== S.Sand && f.kind[b] !== S.Grass) break;
        f.kind[b] = S.Grass;
        f.height[b] += 0.5 + j * 0.3;
        f.tone[b] = (j - 1) * 0.7 + (lean < 0 ? 0.5 : -0.3);
      }
    }
    // Pebbles on the rocky stretches, smooth and round.
    for (let k = 0; k < (W * H) / 650; k++) {
      const x = f.x0 + Math.floor(R() * W);
      const y = f.y0 + Math.floor(R() * H);
      const c = this.col(x);
      const u = c.shore - y;
      if (c.rocky < ROCKY - 0.06 || u < 2 || u > c.wet + 40 + R() * c.dune) continue;
      const k0 = f.kind[at(x, y)];
      if (k0 !== S.Sand && k0 !== S.Wet) continue;
      const r = R() < 0.3 ? 1.6 : 1;
      const tone = 0.5 + R() * 1.5;
      for (let j = -2; j <= 2; j++) {
        for (let i = -2; i <= 2; i++) {
          const dx = i / (r + 0.4);
          const dy = j / (r * 0.8 + 0.3);
          const e = dx * dx + dy * dy;
          if (e > 1 || !inside(x + i, y + j)) continue;
          const b = at(x + i, y + j);
          f.kind[b] = S.Rock;
          f.height[b] = 1 + Math.sqrt(1 - e) * 1.2;
          f.tone[b] = tone + 0.5;
        }
      }
    }
    // Shells on the wet sand and the beach, and the odd starfish.
    for (let k = 0; k < (W * H) / 1800; k++) {
      const x = f.x0 + 1 + Math.floor(R() * (W - 2));
      const y = f.y0 + 1 + Math.floor(R() * (H - 2));
      const c = this.col(x);
      const u = c.shore - y;
      if (u < 1 || u > c.wet + 50 + R() * c.dune * 0.5) continue;
      const b = at(x, y);
      if (f.kind[b] !== S.Sand && f.kind[b] !== S.Wet) continue;
      if (R() < 0.16 && u < c.wet + 30) {
        // A starfish: five short arms.
        for (const [i, j] of STAR) {
          const s = at(x + i, y + j);
          if (f.kind[s] !== S.Sand && f.kind[s] !== S.Wet) continue;
          f.kind[s] = S.Star;
          f.height[s] = i === 0 && j === 0 ? 1.4 : 0.8;
          f.tone[s] = i === 0 && j === 0 ? 1 : j < 0 ? 0.6 : -0.4;
        }
        continue;
      }
      // A shell: a little fan, or a curl.
      const shape = R() < 0.5 ? FAN : CURL;
      const tone = R() < 0.25 ? -1 : 0;
      for (const [i, j, h] of shape) {
        const s = at(x + i, y + j);
        if (f.kind[s] !== S.Sand && f.kind[s] !== S.Wet) continue;
        f.kind[s] = S.Shell;
        f.height[s] = h;
        f.tone[s] = tone + (j < 0 ? 0.5 : 0) + (i < 0 ? 0.3 : 0);
      }
    }
  }

  // ---------------------------------------------------------------- feet

  open(x: number, y: number): boolean {
    const col = this.col(x);
    const d = y - col.shore;
    if (this.deck(x, y)) return true;
    if (d > WADE) return false;
    const u = -d;
    if (u > col.scrub + SCRUB_WALL) return false;
    if (u < 70) {
      const tp = this.poolAt(x, y);
      if (tp && tp.e < 1.6) return false;
    }
    if (this.lagoon(x, y, u, col) > LAG_WADE) return false;
    if (this.canopy(x, y, u, col) > 0) return false;
    return true;
  }

  spawn(): { x: number; y: number } {
    for (let k = 0; k < 400; k++) {
      const x = LAND_MID + k * 24;
      const c = this.col(x);
      const y = Math.round(c.shore - c.wet - 40);
      if (this.open(x, y) && this.open(x, y - 30) && !this.pierOf(Math.floor(x / CHUNK))) return { x, y };
    }
    return { x: LAND_MID, y: LAND_MID - 60 };
  }

  // ---------------------------------------------------------------- what stands

  layout(cx: number, cy: number): ChunkLayout {
    const props: LandProp[] = [];
    const lights: LandLight[] = [];
    const life: LifeSpot[] = [];
    const R = rng(Math.floor(hash2(cx, cy, this.seed + 201) * 2 ** 31));
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const mid = this.col(x0 + CHUNK / 2);
    // Far from the coast in either direction, nothing stands (the thicket's ground is its own picture).
    if (y0 > mid.shore + BAY_AMP || y0 + CHUNK < mid.shore - mid.scrub - SCRUB_WALL - BAY_AMP) return { props, lights, life };
    const pier = this.pierOf(cx);
    const nearPier = (x: number, y: number) => {
      for (let k = cx - 1; k <= cx + 1; k++) {
        const p = this.pierOf(k);
        if (p && Math.abs(x - p.x) < PIER_HEAD + 14 && y > p.y0 - 24 && y < p.y1 + 10) return true;
      }
      return false;
    };
    const clear = (x: number, y: number) => this.open(x, y) && !nearPier(x, y);
    const inChunk = (y: number) => y >= y0 && y < y0 + CHUNK;

    const G = 32;
    for (let j = 0; j < CHUNK / G; j++) {
      for (let i = 0; i < CHUNK / G; i++) {
        const x = Math.round(x0 + (i + 0.15 + R() * 0.7) * G);
        const y = Math.round(y0 + (j + 0.15 + R() * 0.7) * G);
        const r = R();
        const v = R();
        const flip = R() < 0.5;
        const c = this.col(x);
        const u = c.shore - y;
        if (u < 0) continue;
        if (u > c.scrub - 30) {
          // The thicket: palms rise out of it, bushes bulge along its edge.
          const z = this.canopy(x, y, u, c);
          if (z > 0) {
            if (r < 0.14 && u < c.scrub + 120) props.push({ sheet: 'shore_palm', frame: `p${Math.floor(v * 3)}_0`, x, y, flip, anim: `sway${Math.floor(v * 3)}`, shadow: false });
            continue;
          }
          if (!clear(x, y)) continue;
          if (r < 0.45) props.push(bush(x, y, v, flip));
          else if (r < 0.62) props.push(palm(x, y, v, flip));
          else if (r < 0.9) tufts(props, R, x, y, 2);
          continue;
        }
        if (!clear(x, y)) continue;
        if (u < c.wet) {
          if (r < 0.03) life.push({ kind: 'crab', x, y });
          continue;
        }
        const dunes = u > c.dune;
        const rocky = c.rocky > ROCKY;
        if (dunes) {
          // A palm grove here and there, sea grape, and grass on the dunes.
          const grove = valueNoise(x, y, 160, this.seed + 211);
          if (r < 0.04 + grove * 0.14) props.push(palm(x, y, v, flip));
          else if (r < 0.26) props.push(bush(x, y, v, flip));
          else if (r < 0.8) tufts(props, R, x, y, 1 + Math.floor(R() * 3));
          continue;
        }
        // The beach: stones on the rocky stretches, driftwood, a leaning palm up by the dunes.
        if (rocky && r < 0.2) props.push(stone(x, y, v, flip));
        else if (r < 0.025 && u > 24) props.push({ sheet: 'shore_drift', frame: `d${Math.floor(v * 2)}`, x, y, flip, block: { rx: 13, ry: 3 } });
        else if (r < 0.06 && u > c.dune * 0.6) props.push(palm(x, y, v, flip));
        else if (r < 0.075) props.push(stone(x, y, v * 0.5, flip));
        else if (r < 0.1 && u < 70) life.push({ kind: 'crab', x, y });
        else if (r < 0.15 && u > c.dune * 0.7) tufts(props, R, x, y, 1);
      }
    }

    // A lantern on a post, here and there along the upper beach.
    if (this.draw(cx, 41) < LANTERN_ODDS) {
      const x = x0 + 30 + Math.floor(this.draw(cx, 42) * (CHUNK - 60));
      const c = this.col(x);
      const y = Math.round(c.shore - c.wet - 30 - this.draw(cx, 43) * (c.dune - c.wet - 40));
      if (inChunk(y) && clear(x, y)) {
        props.push({ sheet: 'shore_lamp', frame: 'l0', x, y, block: { rx: 3, ry: 2 } });
        lights.push({ x, y: y - 27, ...LANTERN });
      }
    }
    // A pier: its lantern on the head, and its mooring posts.
    if (pier && inChunk(pier.y1 - 6)) {
      const lx = pier.x + PIER_HEAD - 4;
      const ly = pier.y1 - 4;
      props.push({ sheet: 'shore_lamp', frame: 'l0', x: lx, y: ly, block: { rx: 3, ry: 2 } });
      lights.push({ x: lx, y: ly - 27, ...LANTERN });
    }
    // A rowboat drawn up on the sand.
    if (!pier && this.draw(cx, 51) < BOAT_ODDS) {
      const x = x0 + 50 + Math.floor(this.draw(cx, 52) * (CHUNK - 100));
      const c = this.col(x);
      const y = Math.round(c.shore - c.wet - 10 - this.draw(cx, 53) * 14);
      if (inChunk(y) && this.open(x, y)) props.push({ sheet: 'shore_boat', frame: 'boat', x, y, flip: this.draw(cx, 54) < 0.5, block: { rx: 20, ry: 6, oy: -3 } });
    }
    return { props, lights, life };
  }

  /** Is (x, y) water that glows at night (for the shore's sparkles)? */
  glowWater(x: number, y: number): boolean {
    const c = this.col(x);
    const d = y - c.shore;
    if (d > 0) return d < 40 && !this.deck(x, y);
    return this.lagoon(x, y, -d, c) > 0.04;
  }

  /** Is (x, y) the open sea (for the low sun's glints)? */
  sea(x: number, y: number): boolean {
    return y - this.shore(x) > 24 && !this.deck(x, y);
  }

  /** Is (x, y) sand a crab may walk on? */
  sandy(x: number, y: number): boolean {
    const c = this.col(x);
    const u = c.shore - y;
    return u > -2 && u < c.dune && this.open(x, y);
  }
}

/** Little shapes stamped into the sand: [dx, dy, height]. */
const STAR: [number, number][] = [[0, 0], [0, -1], [0, -2], [-1, 0], [-2, -1], [1, 0], [2, -1], [-1, 1], [-1, 2], [1, 1], [1, 2]];
const FAN: [number, number, number][] = [[-1, -1, 0.8], [0, -1, 1], [1, -1, 0.8], [-1, 0, 1], [0, 0, 1.2], [1, 0, 1], [0, 1, 0.6]];
const CURL: [number, number, number][] = [[0, -1, 0.9], [1, -1, 0.8], [-1, 0, 0.8], [0, 0, 1.3], [1, 0, 1], [0, 1, 0.7]];

const palm = (x: number, y: number, v: number, flip: boolean): LandProp => {
  const k = Math.floor(v * 3);
  return { sheet: 'shore_palm', frame: `p${k}_0`, x, y, flip, anim: `sway${k}`, block: { rx: 4, ry: 2.5 } };
};
const bush = (x: number, y: number, v: number, flip: boolean): LandProp => ({ sheet: 'shore_bush', frame: `b${Math.floor(v * 3)}`, x, y, flip, block: { rx: 9, ry: 4 } });
const stone = (x: number, y: number, v: number, flip: boolean): LandProp => {
  const k = Math.min(3, Math.floor(v * 4));
  return { sheet: 'shore_stone', frame: `s${k}`, x, y, flip, block: k === 0 ? undefined : { rx: [0, 6, 10, 6][k], ry: [0, 3, 4, 3][k] } };
};
function tufts(props: LandProp[], R: () => number, x: number, y: number, n: number): void {
  for (let k = 0; k < n; k++) {
    props.push({ sheet: 'shore_tuft', frame: `t${Math.floor(R() * 4)}`, x: Math.round(x + (k ? (R() - 0.5) * 18 : 0)), y: Math.round(y + (k ? (R() - 0.5) * 10 : 0)), flip: R() < 0.5, shadow: false });
  }
}
