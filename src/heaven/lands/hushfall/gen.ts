// Hushfall, grown: an endless snowy vale under soft snowfall. Deep powder
// swells into long drifts that the wind has carved into ridges, lilac and
// blue on their lee sides; fir groves stand close here and thin out there;
// ponds lie frozen (walkable, the ice clear and cracked, bubbles caught in
// it); now and then a hot spring steams in a ring of dark stones, the snow
// thawed round it to moss; an old pilgrims' way winds through it all, lined
// with stone lanterns and half-buried gates; and once in a long while a
// cabin stands with its window lit.
//
// Everything is a function of the fixed seed and the position (see
// ../types.ts). The rare things (springs, cabins) are one per cell of a
// coarse grid, kept well inside their cell, so a pixel only ever asks its
// own cell. No Phaser here: the land worker and scripts/lands.ts grow it too.

import { hash2, rng, valueNoise } from '../../../art/env';
import { bayer, smooth } from '../paint';
import { CHUNK, LAND_MID, type ChunkLayout, type GroundCell, type LandGen, type LandGround, type LandLight, type LandProp, type LifeSpot, type TileFields } from '../types';
import { HUSH_KINDS, K } from './palette';

/** The one Hushfall everyone walks. */
export const HUSH_SEED = 70913;

// ---------------------------------------------------------------- the snow's shape

/** The drifts' long swells: their size (px) and height. */
const SWELL_SCALE = 230;
const SWELL_AMP = 8;
/** Wind ridges: how far apart (px), how tall, and how much of each ridge is the gentle windward side. */
const RIDGE_GAP = 38;
const RIDGE_AMP = 1.5;
const RIDGE_WINDWARD = 0.78;
/** The wind blows from the west-north-west: ridges run across it. */
const WIND_X = 0.84;
const WIND_Y = 0.54;

// ---------------------------------------------------------------- ponds

const POND_SCALE = 250;
/** The pond field passes ICE_T on the ice; just under it, the bank of snow piled round the edge. */
const ICE_T = 0.735;
const BANK = 0.05;
/** The ice's cracks: the size of the field whose contours they follow (px). */
const CRACK_SCALE = 48;

// ---------------------------------------------------------------- the old way

/** The way winds along a contour of a broad noise field: its size, and how wide the trodden snow is (half, px). */
const WAY_SCALE = 760;
const WAY_HALF = 6;
/** The banks of snow pushed up either side of it (px). */
const WAY_BANK = 5;
/** Where the way runs at all (it fades out under fresh snow elsewhere). */
const WAY_MASK_SCALE = 1500;
const WAY_MASK = 0.3;

// ---------------------------------------------------------------- groves

const GROVE_SCALE = 300;

// ---------------------------------------------------------------- springs and cabins

/** One hot spring at most per cell of this size (px), with these odds; its radius across (px). */
const SPRING_CELL = 400;
const SPRING_ODDS = 0.3;
const SPRING_R: [number, number] = [20, 32];
/** How far out (in its own radii) the stones, then the thaw, reach. */
const STONES_TO = 1.7;
/** The stones' grid round a spring (px). */
const STONE_CW = 7;
const STONE_CH = 5.5;
const THAW_TO = 2.45;
/** One cabin at most per cell of this size (px), with these odds. */
const CABIN_CELL = 1100;
const CABIN_ODDS = 0.42;
/** The cabin's trodden yard before its door (radii, px). */
const YARD_RX = 46;
const YARD_RY = 17;

// ---------------------------------------------------------------- landmarks

const LANTERN_ODDS = 0.55;
const GATE_ODDS = 0.2;
const JIZO_ODDS = 0.12;
/** The lanterns' light, and the springs' and the cabin window's. */
export const LANTERN: Omit<LandLight, 'x' | 'y'> = { radius: 92, color: 0xffb35e, intensity: 1.15, day: 0, flicker: 0.3, halo: 0.5 };
const SPRING_LIGHT: Omit<LandLight, 'x' | 'y' | 'radius'> = { color: 0x8ff0d8, intensity: 0.75, day: 0, flicker: 0.06, halo: 0.3 };
const WINDOW_LIGHT: Omit<LandLight, 'x' | 'y'> = { radius: 96, color: 0xffa850, intensity: 1.2, day: 0.05, flicker: 0.15, halo: 0.45 };

export interface Spring {
  x: number;
  y: number;
  rx: number;
  ry: number;
  seed: number;
}

export interface Cabin {
  /** Its feet: the middle of the front wall's foot. */
  x: number;
  y: number;
  flip: boolean;
  /** Where its chimney's smoke leaves (world px). */
  smokeX: number;
  smokeY: number;
}

/** Cabin art's numbers the gen needs: its chimney top and window, from its feet (unflipped). */
export const CABIN_CHIMNEY = { x: 17, y: -72 };
export const CABIN_WINDOW = { x: -14, y: -20 };

export class HushGen implements LandGen {
  readonly seed = HUSH_SEED;
  readonly ground: LandGround;
  private springs = new Map<number, Spring | null>();
  private cabins = new Map<number, Cabin | null>();
  private probe: GroundCell = { kind: 0, height: 0, tone: 0, glow: 0 };

  constructor() {
    const self = this;
    this.ground = {
      kinds: HUSH_KINDS,
      cell: (x, y, c) => self.cell(x, y, c),
      decorate: (f) => self.decorate(f),
    };
  }

  /** A well-mixed 0..1 draw for grid cell (i, j). */
  private draw(i: number, j: number, salt: number): number {
    let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(j + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(salt + this.seed, 0x27d4eb2f);
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ---------------------------------------------------------------- fields

  /** The pond field: past ICE_T is ice. */
  pond(x: number, y: number): number {
    const s = this.seed;
    return valueNoise(x, y, POND_SCALE, s + 11) * 0.8 + valueNoise(x, y, 80, s + 13) * 0.2;
  }

  /** How close the firs stand (0..1). */
  grove(x: number, y: number): number {
    const s = this.seed;
    return valueNoise(x, y, GROVE_SCALE, s + 41) * 0.72 + valueNoise(x, y, 80, s + 43) * 0.28;
  }

  private wayN(x: number, y: number): number {
    const s = this.seed;
    return valueNoise(x, y, WAY_SCALE, s + 31) + (valueNoise(x, y, 150, s + 33) - 0.5) * 0.06;
  }

  /** How far (px) from the old way's middle (x, y) is; Infinity where it isn't near or doesn't run. */
  way(x: number, y: number): number {
    // The broad field alone rules out most of the land before the wobble is worked out.
    const n0 = valueNoise(x, y, WAY_SCALE, this.seed + 31) - 0.5;
    if (n0 > 0.07 || n0 < -0.07) return Infinity;
    const n = this.wayN(x, y) - 0.5;
    if (n > 0.035 || n < -0.035) return Infinity;
    const gx = (this.wayN(x + 2, y) - 0.5 - n) / 2;
    const gy = (this.wayN(x, y + 2) - 0.5 - n) / 2;
    const g = Math.hypot(gx, gy);
    if (g < 1e-5) return Infinity;
    const mask = valueNoise(x, y, WAY_MASK_SCALE, this.seed + 35);
    if (mask < WAY_MASK) return Infinity;
    // The way narrows to nothing where it fades out, rather than stopping square.
    const narrow = smooth(WAY_MASK, WAY_MASK + 0.08, mask);
    return Math.abs(n) / g / Math.max(0.05, narrow);
  }

  /** The way's direction at (x, y): its field's gradient, unit length (the way runs across it). */
  wayGrad(x: number, y: number): { gx: number; gy: number; n: number } {
    const n = this.wayN(x, y) - 0.5;
    const gx = (this.wayN(x + 2, y) - 0.5 - n) / 2;
    const gy = (this.wayN(x, y + 2) - 0.5 - n) / 2;
    const g = Math.hypot(gx, gy) || 1e-9;
    return { gx: gx / g, gy: gy / g, n: n / g };
  }

  /** The snow's height at (x, y): swells and wind ridges. */
  private drift(x: number, y: number): number {
    const s = this.seed;
    const swell = (valueNoise(x, y, SWELL_SCALE, s + 1) * 0.7 + valueNoise(x, y, 90, s + 2) * 0.3) * SWELL_AMP;
    // Ridges only where the wind has had its way: most pixels stop here, which keeps the painting quick.
    const m0 = valueNoise(x, y, 260, s + 5) * 0.65;
    if (m0 + 0.35 <= 0.5) return swell;
    const mask = smooth(0.5, 0.82, m0 + valueNoise(x, y, 70, s + 6) * 0.35);
    if (mask <= 0) return swell;
    const warp = valueNoise(x, y, 130, s + 3) * 74;
    const r = (x * WIND_X + y * WIND_Y + warp) / RIDGE_GAP;
    const f = r - Math.floor(r);
    // A long gentle windward rise, then a short steep lee where the blue shadow lies.
    const p = f < RIDGE_WINDWARD ? f / RIDGE_WINDWARD : (1 - f) / (1 - RIDGE_WINDWARD);
    return swell + p * p * (3 - 2 * p) * RIDGE_AMP * mask;
  }

  // ---------------------------------------------------------------- springs and cabins

  /** The hot spring of grid cell (i, j), if it has one. */
  springOf(i: number, j: number): Spring | null {
    const k = i * 65536 + j;
    const had = this.springs.get(k);
    if (had !== undefined) return had;
    let sp: Spring | null = null;
    if (this.draw(i, j, 61) < SPRING_ODDS) {
      const m = 90;
      const x = i * SPRING_CELL + m + this.draw(i, j, 62) * (SPRING_CELL - m * 2);
      const y = j * SPRING_CELL + m + this.draw(i, j, 63) * (SPRING_CELL - m * 2);
      const rx = SPRING_R[0] + this.draw(i, j, 64) * (SPRING_R[1] - SPRING_R[0]);
      // Not on a pond, and not on the way.
      if (this.pond(x, y) < ICE_T - 0.12 && this.way(x, y) > rx * 3.2 && !this.cabinNear(x, y, 150)) sp = { x, y, rx, ry: rx * 0.64, seed: Math.floor(this.draw(i, j, 65) * 9999) };
    }
    if (this.springs.size > 1024) this.springs.clear();
    this.springs.set(k, sp);
    return sp;
  }

  /** The spring whose cell (x, y) is in, if any. */
  springAt(x: number, y: number): Spring | null {
    return this.springOf(Math.floor(x / SPRING_CELL), Math.floor(y / SPRING_CELL));
  }

  /** How far into its spring (x, y) is, in its radii (under 1 is water), with a wobble so the edge isn't a clean oval. */
  springE(sp: Spring, x: number, y: number): number {
    const dx = (x - sp.x) / sp.rx;
    const dy = (y - sp.y) / sp.ry;
    const d2 = dx * dx + dy * dy;
    if (d2 > 9) return 99;
    return Math.sqrt(d2) * (1 + (valueNoise(x, y, 9, sp.seed) - 0.5) * 0.22);
  }

  /** Springs whose middles lie in a rectangle (for their steam and light). */
  springsIn(x0: number, y0: number, x1: number, y1: number): Spring[] {
    const out: Spring[] = [];
    for (let j = Math.floor(y0 / SPRING_CELL); j <= Math.floor(y1 / SPRING_CELL); j++) {
      for (let i = Math.floor(x0 / SPRING_CELL); i <= Math.floor(x1 / SPRING_CELL); i++) {
        const sp = this.springOf(i, j);
        if (sp && sp.x >= x0 && sp.x < x1 && sp.y >= y0 && sp.y < y1) out.push(sp);
      }
    }
    return out;
  }

  /** The cabin of grid cell (i, j), if it has one. */
  cabinOf(i: number, j: number): Cabin | null {
    const k = i * 65536 + j;
    const had = this.cabins.get(k);
    if (had !== undefined) return had;
    let cb: Cabin | null = null;
    if (this.draw(i, j, 71) < CABIN_ODDS) {
      const m = 200;
      const x = Math.round(i * CABIN_CELL + m + this.draw(i, j, 72) * (CABIN_CELL - m * 2));
      const y = Math.round(j * CABIN_CELL + m + this.draw(i, j, 73) * (CABIN_CELL - m * 2));
      let ok = true;
      for (const [ox, oy] of [[0, -30], [-50, 0], [50, 0], [0, 40], [-40, -40], [40, -40], [0, 90]]) if (this.pond(x + ox, y + oy) > ICE_T - 0.1) ok = false;
      if (ok && this.way(x, y - 20) > 60) {
        const flip = this.draw(i, j, 74) < 0.5;
        cb = { x, y, flip, smokeX: x + (flip ? -CABIN_CHIMNEY.x : CABIN_CHIMNEY.x), smokeY: y + CABIN_CHIMNEY.y };
      }
    }
    if (this.cabins.size > 512) this.cabins.clear();
    this.cabins.set(k, cb);
    return cb;
  }

  cabinAt(x: number, y: number): Cabin | null {
    return this.cabinOf(Math.floor(x / CABIN_CELL), Math.floor(y / CABIN_CELL));
  }

  private cabinNear(x: number, y: number, r: number): boolean {
    const c = this.cabinAt(x, y);
    return !!c && Math.abs(c.x - x) < r && Math.abs(c.y - y) < r;
  }

  /** Cabins whose feet lie in a rectangle (for their chimney smoke). */
  cabinsIn(x0: number, y0: number, x1: number, y1: number): Cabin[] {
    const out: Cabin[] = [];
    for (let j = Math.floor(y0 / CABIN_CELL); j <= Math.floor(y1 / CABIN_CELL); j++) {
      for (let i = Math.floor(x0 / CABIN_CELL); i <= Math.floor(x1 / CABIN_CELL); i++) {
        const c = this.cabinOf(i, j);
        if (c && c.x >= x0 && c.x < x1 && c.y >= y0 && c.y < y1) out.push(c);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- the ground, a pixel at a time

  cell(x: number, y: number, c: GroundCell): void {
    const s = this.seed;
    const sp = this.springAt(x, y);
    if (sp) {
      const e = this.springE(sp, x, y);
      if (e < THAW_TO && this.spring(x, y, e, sp, c)) return;
    }

    const P = this.pond(x, y);
    if (P > ICE_T) return this.ice(x, y, P, c);

    let h = this.drift(x, y);
    // Round a pond the snow piles into a bank, steep on its inner side.
    if (P > ICE_T - BANK) {
      const b = (P - (ICE_T - BANK)) / BANK;
      h = h * (1 - b * 0.7) + Math.sin(b * Math.PI * 0.85) * 2.2;
    }

    // A cabin's yard, trodden flat before its door, and its little path away south.
    const cb = this.cabinAt(x, y);
    if (cb) {
      const yx = (x - cb.x) / YARD_RX;
      const yy = (y - cb.y - 12) / YARD_RY;
      const ye = yx * yx + yy * yy * (yy < 0 ? 0.6 : 1);
      const pathX = cb.x + (cb.flip ? -10 : 10) + Math.sin((y - cb.y) * 0.05) * 6;
      const onPath = y > cb.y + 10 && y < cb.y + 110 && Math.abs(x - pathX) < 4.5 - (y - cb.y) * 0.02;
      if (ye < 1 || onPath) {
        if (ye > 0.82 && !onPath && bayer(x, y) < (ye - 0.82) / 0.18) {
          // dithering out into the snow
        } else {
          c.kind = K.Trod;
          c.height = h * 0.3 + valueNoise(x, y, 4, s + 91) * 0.5;
          c.tone = (valueNoise(x, y, 11, s + 93) - 0.5) * 1.2;
          return;
        }
      }
    }

    // The old way: trodden snow, a little sunk, between banks the walkers pushed up.
    const w = this.way(x, y);
    if (w < WAY_HALF + WAY_BANK) {
      if (w < WAY_HALF && !(w > WAY_HALF - 2 && bayer(x, y) < (w - WAY_HALF + 2) / 2)) {
        c.kind = K.Trod;
        c.height = h * 0.35 - (1 - w / WAY_HALF) * 0.6 + valueNoise(x, y, 3, s + 95) * 0.45;
        // Footfalls pressed into it, many walkers deep.
        c.tone = (valueNoise(x, y, 5, s + 97) - 0.5) * 1.3 + (valueNoise(x, y, 60, s + 98) - 0.5) * 0.8;
        return;
      }
      const b = (w - WAY_HALF) / WAY_BANK;
      h = h * (0.35 + b * 0.65) + Math.sin(Math.max(0, b) * Math.PI) * 1.6;
    }

    // Powder: the drifts, fine grain, the firs' blue shade, and the odd glint of the sun.
    c.kind = K.Snow;
    c.height = h + valueNoise(x, y, 5, s + 7) * 0.14;
    // Bluer under the groves (the broad part of the grove field is enough for a shade).
    const g = valueNoise(x, y, GROVE_SCALE, s + 41);
    let t = (valueNoise(x, y, 40, s + 8) - 0.5) * 0.9 - smooth(0.55, 0.85, g) * 1.1;
    if (hash2(x, y, s + 9) > 0.9965) t += 3;
    c.tone = t;
  }

  /** Pond ice: clear and blue in its depths, frosted at the edge, cracked, dusted with snow in drifts. */
  private ice(x: number, y: number, P: number, c: GroundCell): void {
    const s = this.seed;
    const depth = smooth(ICE_T, ICE_T + 0.07, P);
    // Snow blown across the ice in soft tongues, thinning toward the middle.
    const dust = valueNoise(x * 0.8 + y * 0.5, y * 0.9 - x * 0.3, 24, s + 21) * 0.6 + valueNoise(x, y, 9, s + 22) * 0.4;
    const need = 0.67 + depth * 0.2;
    if (dust > need + 0.05 || (dust > need && bayer(x, y) < (dust - need) / 0.05)) {
      c.kind = K.Snow;
      c.height = 0.6 + (dust - need) * 4;
      c.tone = -0.6 + (dust - need) * 8;
      return;
    }
    c.kind = K.Ice;
    c.height = 0.3;
    let t = 9.5 - depth * 5.5;
    // Long pale streaks where the wind polished it, and darker clear patches.
    t += (valueNoise(x * 0.4 - y * 0.9, x * 0.9 + y * 0.4, 30, s + 23) - 0.5) * 1.6;
    // A frosted rim right at the edge.
    if (P < ICE_T + 0.006) t += 2.5;
    else if (P < ICE_T + 0.012 && bayer(x, y) < 0.5) t += 1.5;
    // Cracks: hairlines wandering along the contours of two noise fields, dark, with a pale fractured plane on one side.
    if (depth > 0.1) {
      const n1 = valueNoise(x, y, CRACK_SCALE, s + 25) - 0.5;
      const a1 = Math.abs(n1);
      if (a1 < 0.024 && valueNoise(x, y, 110, s + 26) > 0.38) {
        if (a1 < 0.0075) t = 2.5 + depth;
        else if (n1 > 0) t += 1.6 * (1 - a1 / 0.024);
      } else if (depth > 0.45) {
        const n2 = valueNoise(x, y, CRACK_SCALE * 0.42, s + 27) - 0.5;
        const a2 = Math.abs(n2);
        if (a2 < 0.012 && valueNoise(x, y, 60, s + 28) > 0.55) t = a2 < 0.006 ? t - 2.5 : t + 1;
      }
    }
    // Faint ripples frozen in, catching the light.
    if (valueNoise(x, y * 4, 18, s + 28) > 0.82) t += 1;
    c.tone = t;
  }

  /** A hot spring and its ring: water, dark stones, then thawed moss and earth melting out into the snow. False past the thaw. */
  private spring(x: number, y: number, e: number, sp: Spring, c: GroundCell): boolean {
    const s = this.seed;
    if (e < 1) {
      c.kind = K.Spring;
      const deep = Math.sqrt(1 - e);
      let t = 8.6 - deep * 7;
      // Rings spreading from where it wells up, just off its middle.
      const wx = (x - sp.x + sp.rx * 0.2) / sp.rx;
      const wy = (y - sp.y + sp.ry * 0.1) / sp.ry;
      const wr = Math.hypot(wx, wy);
      if (wr < 0.7 && Math.sin(wr * 26) > 0.75) t += 1;
      if (wr < 0.12) t += 1.5;
      // The stones' reflections, dark just inside the rim.
      if (e > 0.86) t -= 1.5;
      const fl = Math.floor(t);
      c.tone = t - fl > bayer(x, y) ? fl + 1 : fl;
      c.glow = 0.22 + deep * 0.4;
      return true;
    }
    if (e < STONES_TO + 0.25) {
      // Rounded stones set close round the water: one to each cell of a grid, jittered, the nearest on top.
      const gx = Math.floor(x / STONE_CW);
      const gy = Math.floor(y / STONE_CH);
      let best = 0;
      let bdx = 0;
      let bdy = 0;
      let bh = 0;
      let be = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const ci = gx + i;
          const cj = gy + j;
          const hh = hash2(ci, cj, sp.seed);
          const px = (ci + 0.2 + hash2(ci, cj, sp.seed + 1) * 0.6) * STONE_CW;
          const py = (cj + 0.2 + hash2(ci, cj, sp.seed + 2) * 0.6) * STONE_CH;
          const se = this.springE(sp, px, py);
          if (se < 0.98 || se > STONES_TO - hh * 0.35) continue;
          const rx = 2.8 + hh * 1.6 - (se > 1.4 ? 0.6 : 0);
          const dx = (x + 0.5 - px) / rx;
          const dy = (y + 0.5 - py) / (rx * 0.74);
          const d2 = dx * dx + dy * dy;
          if (d2 >= 1) continue;
          const z = Math.sqrt(1 - d2) + hh * 0.3;
          if (z > best) {
            best = z;
            bdx = dx;
            bdy = dy;
            bh = hh;
            be = se;
          }
        }
      }
      if (best > 0) {
        // Outer stones carry a cap of snow on their tops; the warm inner ones are bare and wet.
        if (be > 1.32 && bdy < -0.1 && bh > 0.25) {
          c.kind = K.Snow;
          c.height = 3.5 + best * 1.5;
          c.tone = bdy < -0.5 ? 1 : 0;
          return true;
        }
        c.kind = K.Stone;
        c.height = 1 + best * 2.6;
        // Lit on its upper left, a wet sheen on the warm ones, dark where it meets its neighbours.
        c.tone = (bh - 0.5) * 1.4 + (-bdx - bdy) * 0.9 + (best < 0.45 ? -1.4 : 0) + (be < 1.2 && bdx < -0.2 && bdy < -0.2 ? 1.5 : 0);
        return true;
      }
      if (e < STONES_TO - 0.15) {
        // The gaps between stones: dark wet earth.
        c.kind = K.Earth;
        c.height = 0.6;
        c.tone = -1.5;
        return true;
      }
    }
    // The thaw: moss and earth where the warmth reaches, patchy, dithering out into wet snow.
    const warm = 1 - smooth(STONES_TO - 0.2, THAW_TO, e);
    const patch = valueNoise(x, y, 7, s + 81) * 0.6 + valueNoise(x, y, 18, s + 82) * 0.4;
    const v = warm * 1.25 + (patch - 0.5) * 0.7;
    if (v > 0.62 || (v > 0.52 && bayer(x, y) < (v - 0.52) / 0.1)) {
      const moss = valueNoise(x, y, 11, s + 83) > 0.36;
      c.kind = moss ? K.Moss : K.Earth;
      c.height = 0.8 + patch * 1.2;
      c.tone = (patch - 0.5) * 2 + (moss && hash2(x, y, s + 84) > 0.9 ? 1.5 : 0);
      return true;
    }
    if (warm > 0.05) {
      // Wet, sunk snow at the thaw's edge.
      c.kind = K.Snow;
      c.height = this.drift(x, y) * (1 - warm * 0.8) + 1.2;
      c.tone = -warm * 2.2 + (valueNoise(x, y, 5, s + 85) - 0.5) * 0.8;
      return true;
    }
    return false;
  }

  /** Small things over the finished ground: fallen needles, hare tracks, dry grass, bubbles caught in the ice. */
  decorate(f: TileFields): void {
    const s = this.seed;
    const R = rng(Math.floor(hash2(f.x0 / 64, f.y0 / 64, s + 101) * 2 ** 31));
    const at = (x: number, y: number) => (y - f.y0 + 1) * f.pw + (x - f.x0) + 1;
    const inside = (x: number, y: number) => x >= f.x0 - 1 && x <= f.x0 + f.w && y >= f.y0 - 1 && y <= f.y0 + f.h;
    const W = f.w;
    const H = f.h;
    // Needles and twigs fallen under the firs.
    for (let k = 0; k < (W * H) / 260; k++) {
      const x = f.x0 + Math.floor(R() * W);
      const y = f.y0 + Math.floor(R() * H);
      const i = at(x, y);
      if (f.kind[i] !== K.Snow) continue;
      const g = this.grove(x, y);
      if (g < 0.62 || R() > (g - 0.62) * 3) continue;
      const len = R() < 0.2 ? 3 + Math.floor(R() * 3) : 1 + Math.floor(R() * 2);
      const dx = R() < 0.5 ? 1 : -1;
      const steep = R() < 0.4;
      for (let j = 0; j < len; j++) {
        const bx = x + (steep ? (j >> 1) * dx : j * dx);
        const by = y + (steep ? j : j >> 1);
        if (!inside(bx, by)) break;
        const b = at(bx, by);
        if (f.kind[b] !== K.Snow) break;
        f.kind[b] = K.Twig;
        f.tone[b] = (R() - 0.5) * 1.5;
        f.height[b] += 0.3;
      }
    }
    // Dry grass poking up through the snow in the open meadows.
    for (let k = 0; k < (W * H) / 260; k++) {
      const x = f.x0 + Math.floor(R() * W);
      const y = f.y0 + Math.floor(R() * H);
      const i = at(x, y);
      if (f.kind[i] !== K.Snow) continue;
      const m = valueNoise(x, y, 120, s + 111) - this.grove(x, y) * 0.4;
      if (m < 0.5 || R() > (m - 0.5) * 2.5) continue;
      const len = 2 + Math.floor(R() * 3);
      const lean = R() < 0.5 ? -1 : 1;
      for (let j = 0; j < len; j++) {
        const bx = x + (j >= 2 && R() < 0.6 ? lean : 0);
        const by = y - j;
        if (!inside(bx, by)) break;
        const b = at(bx, by);
        if (f.kind[b] !== K.Snow && f.kind[b] !== K.Grass) break;
        f.kind[b] = K.Grass;
        f.height[b] += 0.6 + j * 0.3;
        f.tone[b] = (j - 1) * 0.8 + (lean < 0 ? 0.6 : -0.3);
      }
      // A little hollow blown round its foot, on the lee side.
      const hb = at(x + 1, y);
      if (inside(x + 1, y) && f.kind[hb] === K.Snow) f.tone[hb] -= 1.4;
    }
    // A hare's tracks: hops in a wandering line, each hop two hind prints ahead of two small fore prints.
    const hares = R() < 0.55 ? 1 + Math.floor(R() * 2) : 0;
    for (let k = 0; k < hares; k++) {
      let x = f.x0 + 20 + R() * (W - 40);
      let y = f.y0 + 16 + R() * (H - 32);
      let a = R() * Math.PI * 2;
      const hops = 6 + Math.floor(R() * 10);
      for (let n = 0; n < hops; n++) {
        a += (R() - 0.5) * 0.7;
        const ux = Math.cos(a);
        const uy = Math.sin(a) * 0.7;
        x += ux * 13;
        y += uy * 13;
        // hind feet side by side ahead; fore feet one behind the other behind them
        const marks: [number, number][] = [
          [x + ux * 3 - uy * 2, y + uy * 3 + ux * 2],
          [x + ux * 3 + uy * 2, y + uy * 3 - ux * 2],
          [x - ux * 2, y - uy * 2],
          [x - ux * 5 + uy * 0.6, y - uy * 5 - ux * 0.6],
        ];
        for (const [mx, my] of marks) {
          const px = Math.round(mx);
          const py = Math.round(my);
          if (!inside(px, py) || !inside(px + 1, py + 1)) continue;
          const b = at(px, py);
          if (f.kind[b] !== K.Snow) continue;
          f.height[b] -= 1;
          f.tone[b] -= 1.6;
          const b2 = at(px + 1, py + 1);
          if (f.kind[b2] === K.Snow) f.tone[b2] += 0.8;
        }
      }
    }
    // Bubbles caught in the ice: little pale discs in clusters, rising in chains.
    for (let k = 0; k < (W * H) / 900; k++) {
      const x = f.x0 + 2 + Math.floor(R() * (W - 4));
      const y = f.y0 + 2 + Math.floor(R() * (H - 4));
      if (f.kind[at(x, y)] !== K.Ice || f.tone[at(x, y)] > 7) continue;
      const n = 3 + Math.floor(R() * 6);
      let bx = x;
      let by = y;
      for (let q = 0; q < n; q++) {
        bx += Math.round((R() - 0.5) * 3);
        by -= 1 + Math.floor(R() * 2);
        if (!inside(bx, by) || !inside(bx + 1, by + 1)) break;
        const big = R() < 0.3;
        const b = at(bx, by);
        if (f.kind[b] !== K.Ice) continue;
        f.tone[b] = 10.5;
        if (big) {
          for (const [i, j, t] of [[1, 0, 9.5], [0, 1, 8.5], [1, 1, 8]] as const) {
            const o = at(bx + i, by + j);
            if (f.kind[o] === K.Ice) f.tone[o] = t;
          }
        } else {
          const o = at(bx, by + 1);
          if (f.kind[o] === K.Ice) f.tone[o] -= 0.6;
        }
      }
    }
  }

  // ---------------------------------------------------------------- feet

  open(x: number, y: number): boolean {
    const sp = this.springAt(x, y);
    if (sp && this.springE(sp, x, y) < 1.08) return false;
    return true;
  }

  /** Is the ground at (x, y) snow a foot would leave a print in? */
  printable(x: number, y: number): boolean {
    const c = this.probe;
    c.kind = 0;
    this.cell(Math.floor(x), Math.floor(y), c);
    return c.kind === K.Snow || c.kind === K.Trod;
  }

  /** Is (x, y) somewhere a hare or fox may run (snow, ice, the way; not the springs' water)? */
  roam(x: number, y: number): boolean {
    return this.open(x, y);
  }

  spawn(): { x: number; y: number } {
    // On the old way if it's near, else on open snow, clear of ponds and groves.
    for (let k = 0; k < 600; k++) {
      const a = k * 2.399;
      const r = 12 * Math.sqrt(k);
      const x = Math.round(LAND_MID + Math.cos(a) * r * 8);
      const y = Math.round(LAND_MID + Math.sin(a) * r * 8);
      if (this.way(x, y) < WAY_HALF - 2 && this.clearAround(x, y)) return { x, y };
    }
    for (let k = 0; k < 600; k++) {
      const x = LAND_MID + k * 24;
      const y = LAND_MID;
      if (this.clearAround(x, y)) return { x, y };
    }
    return { x: LAND_MID, y: LAND_MID };
  }

  private clearAround(x: number, y: number): boolean {
    if (this.pond(x, y) > ICE_T - 0.15 || this.grove(x, y) > 0.5) return false;
    const sp = this.springAt(x, y);
    if (sp && this.springE(sp, x, y) < 4) return false;
    return !this.cabinNear(x, y, 120);
  }

  // ---------------------------------------------------------------- what stands

  layout(cx: number, cy: number): ChunkLayout {
    const props: LandProp[] = [];
    const lights: LandLight[] = [];
    const life: LifeSpot[] = [];
    const s = this.seed;
    const R = rng(Math.floor(hash2(cx, cy, s + 201) * 2 ** 31));
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const inChunk = (x: number, y: number) => x >= x0 && x < x0 + CHUNK && y >= y0 && y < y0 + CHUNK;
    const cabin = this.cabinAt(x0 + CHUNK / 2, y0 + CHUNK / 2);
    const nearCabin = (x: number, y: number, r: number) => {
      for (const cb of this.cabinsIn(x - r, y - r, x + r, y + r)) if (Math.abs(cb.x - x) < r && y - cb.y > -70 && y - cb.y < r * 1.2) return true;
      return false;
    };
    const springNear = (x: number, y: number, e: number) => {
      const sp = this.springAt(x, y);
      return !!sp && this.springE(sp, x, y) < e;
    };
    const busy: { x: number; y: number; r: number }[] = [];
    const free = (x: number, y: number, r: number) => busy.every((b) => Math.hypot(b.x - x, b.y - y) > b.r + r);

    // The cabin, its window lit, its woodpile, and someone's snowman out front.
    if (cabin && inChunk(cabin.x, cabin.y)) {
      const f = cabin.flip;
      const sx = f ? -1 : 1;
      props.push({ sheet: 'hush_cabin', frame: 'cabin', x: cabin.x, y: cabin.y, flip: f, block: { rx: 38, ry: 14, oy: -12 } });
      lights.push({ x: cabin.x + sx * CABIN_WINDOW.x, y: cabin.y + CABIN_WINDOW.y + 14, ...WINDOW_LIGHT });
      props.push({ sheet: 'hush_wood', frame: 'w0', x: cabin.x + sx * 46, y: cabin.y - 4, flip: f, block: { rx: 10, ry: 4 } });
      props.push({ sheet: 'hush_lantern', frame: 'post', x: cabin.x - sx * 22, y: cabin.y + 30, block: { rx: 3, ry: 2 } });
      lights.push({ x: cabin.x - sx * 22, y: cabin.y + 30 - 22, ...LANTERN, radius: 70, intensity: 0.9 });
      if (this.draw(cx, cy, 75) < 0.8) props.push(snowman(cabin.x + sx * 34, cabin.y + 40, Math.floor(this.draw(cx, cy, 76) * 3), !f));
      busy.push({ x: cabin.x, y: cabin.y, r: 70 });
    }

    // Springs: their faint light, and sometimes a lantern set by the stones.
    for (const sp of this.springsIn(x0, y0, x0 + CHUNK, y0 + CHUNK)) {
      lights.push({ x: sp.x, y: sp.y, radius: sp.rx * 3.4, ...SPRING_LIGHT });
      busy.push({ x: sp.x, y: sp.y, r: sp.rx * 2.6 });
      if (this.draw(Math.floor(sp.x), Math.floor(sp.y), 81) < 0.6) {
        const a = -Math.PI * (0.15 + this.draw(Math.floor(sp.x), Math.floor(sp.y), 82) * 0.7);
        const lx = Math.round(sp.x + Math.cos(a) * sp.rx * 2.05);
        const ly = Math.round(sp.y + Math.sin(a) * sp.ry * 2.05);
        props.push({ sheet: 'hush_lantern', frame: 'small', x: lx, y: ly, block: { rx: 5, ry: 3 } });
        lights.push({ x: lx, y: ly - 14, ...LANTERN, radius: 64, intensity: 0.8 });
      }
    }

    // The old way: lanterns along its sides, a gate where it runs north and south, a little stone figure in a red bib.
    for (let k = 0; k < 3; k++) {
      const at = this.ontoWay(x0 + R() * CHUNK, y0 + R() * CHUNK);
      const odds = R();
      const side = R() < 0.5 ? -1 : 1;
      const pick = R();
      if (!at) continue;
      const { x, y, gx, gy } = at;
      if (k === 0 && Math.abs(gx) > 0.93 && pick < GATE_ODDS) {
        // The gate stands across the way, its posts on the banks.
        const gxp = Math.round(x);
        const gyp = Math.round(y);
        if (!inChunk(gxp, gyp) || !free(gxp, gyp, 40)) continue;
        props.push({ sheet: 'hush_gate', frame: 'gate', x: gxp, y: gyp, shadow: true });
        props.push({ sheet: 'hush_blank', frame: 'b', x: gxp - GATE_POST, y: gyp, shadow: false, block: { rx: 4, ry: 3 } });
        props.push({ sheet: 'hush_blank', frame: 'b', x: gxp + GATE_POST, y: gyp, shadow: false, block: { rx: 4, ry: 3 } });
        busy.push({ x: gxp, y: gyp, r: 40 });
        continue;
      }
      const off = WAY_HALF + WAY_BANK + 5;
      const lx = Math.round(x + gx * off * side);
      const ly = Math.round(y + gy * off * side);
      if (!inChunk(lx, ly) || !free(lx, ly, 34) || springNear(lx, ly, 3) || this.pond(lx, ly) > ICE_T - 0.04 || nearCabin(lx, ly, 60)) continue;
      if (odds < LANTERN_ODDS) {
        const tall = pick < 0.6;
        props.push({ sheet: 'hush_lantern', frame: tall ? 'tall' : 'small', x: lx, y: ly, block: { rx: tall ? 6 : 5, ry: 3 } });
        lights.push({ x: lx, y: ly - (tall ? 24 : 14), ...LANTERN, ...(tall ? {} : { radius: 70, intensity: 0.85 }) });
        busy.push({ x: lx, y: ly, r: 20 });
      } else if (odds < LANTERN_ODDS + JIZO_ODDS) {
        props.push({ sheet: 'hush_jizo', frame: 'j0', x: lx, y: ly, flip: side < 0, block: { rx: 5, ry: 3 } });
        busy.push({ x: lx, y: ly, r: 16 });
      } else if (odds < LANTERN_ODDS + JIZO_ODDS + 0.06) {
        props.push(snowman(lx, ly, Math.floor(pick * 3), side < 0));
        busy.push({ x: lx, y: ly, r: 16 });
      }
    }

    // Everything else, on a jittered grid: firs in their groves, boulders, berry bushes, grass, now and then a snowman; hares and the odd fox.
    const G = 32;
    for (let j = 0; j < CHUNK / G; j++) {
      for (let i = 0; i < CHUNK / G; i++) {
        const x = Math.round(x0 + (i + 0.12 + R() * 0.76) * G);
        const y = Math.round(y0 + (j + 0.12 + R() * 0.76) * G);
        const r = R();
        const v = R();
        const flip = R() < 0.5;
        if (!free(x, y, 14)) continue;
        if (this.way(x, y) < WAY_HALF + WAY_BANK + 4) continue;
        const P = this.pond(x, y);
        if (P > ICE_T - 0.03) {
          if (P > ICE_T + 0.02 && r < 0.02) life.push({ kind: 'hare', x, y });
          continue;
        }
        if (springNear(x, y, THAW_TO + 0.4) || nearCabin(x, y, 64)) continue;
        const g = this.grove(x, y);
        const firP = smooth(0.42, 0.72, g) * 0.62 + 0.035;
        // Tall firs keep clear of the ground just north of them, so they don't hide a spring.
        if (r < firP && !springNear(x, y - 50, THAW_TO + 0.8)) {
          // Big old firs in the hearts of the groves, saplings at their edges and out in the open.
          const big = g > 0.6 ? v : v * 0.6;
          const k = big < 0.18 ? 0 : big < 0.4 ? 1 : big < 0.62 ? 2 : big < 0.84 ? 3 : 4;
          props.push({ sheet: 'hush_fir', frame: `f${k}`, x, y, flip, block: { rx: FIR_BLOCK[k], ry: FIR_BLOCK[k] * 0.6 } });
          continue;
        }
        const q = (r - firP) / (1 - firP);
        if (q < 0.035) props.push({ sheet: 'hush_rock', frame: `r${Math.floor(v * 3)}`, x, y, flip, block: { rx: [5, 9, 12][Math.floor(v * 3)], ry: [3, 4, 5][Math.floor(v * 3)] } });
        else if (q < 0.07) props.push({ sheet: 'hush_bush', frame: `b${Math.floor(v * 2)}`, x, y, flip, block: { rx: 7, ry: 3 } });
        else if (q < 0.2 && g < 0.55) props.push({ sheet: 'hush_reed', frame: `t${Math.floor(v * 3)}`, x, y, flip, shadow: false });
        else if (q < 0.2006) props.push(snowman(x, y, Math.floor(v * 3), flip));
        else if (q < 0.214) life.push({ kind: 'hare', x, y });
        else if (q < 0.2152) life.push({ kind: 'fox', x, y });
      }
    }
    return { props, lights, life };
  }

  /** The nearest point on the old way to (x, y), with the way's across direction; null when it isn't near or doesn't run there. */
  private ontoWay(x: number, y: number): { x: number; y: number; gx: number; gy: number } | null {
    for (let k = 0; k < 4; k++) {
      const g = this.wayGrad(x, y);
      if (!Number.isFinite(g.n) || Math.abs(g.n) > 400) return null;
      x -= g.gx * g.n;
      y -= g.gy * g.n;
    }
    if (this.way(x, y) > 2) return null;
    const g = this.wayGrad(x, y);
    return { x, y, gx: g.gx, gy: g.gy };
  }
}

/** How far the gate's posts stand from its middle (px); its art matches. */
export const GATE_POST = 22;
/** The firs' trunks, by size. */
const FIR_BLOCK = [3, 4, 5, 6, 7];

const snowman = (x: number, y: number, v: number, flip: boolean): LandProp => ({ sheet: 'hush_snowman', frame: `s${v}`, x, y, flip, block: { rx: 6, ry: 3 } });
