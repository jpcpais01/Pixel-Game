// An arena's ground, generated in horizontal strips of STRIP_H rows so it
// can stream in as the heroes walk (see world/GroundStreamer.ts). Every
// feature is a function of world coordinates, so strips built in any order
// meet without seams.
//
// This file is the engine every arena shares; an arena describes its ground
// with a GroundSpec (world/layout.ts for the clearing, world/garden.ts for the
// Sunken Garden). One pass classifies each pixel (grass, flagstone, water,
// treetops...) and computes its height; the colouring pass then runs once
// per look (night and day), each with its own palette and its own shadows:
// the sun casts from the upper left, the moon from the upper right.
//
// Wherever the spec's roof is deep, the ground is a roof of leaves: round
// clumps with their own normals, so the sun and spells light them.

import { KEY_LIGHT, hex, type RGB } from './pixel';
import { hash2, rng, valueNoise, type GroundPalette } from './env';

export const STRIP_H = 128;

export const ramp = (...c: string[]): RGB[] => c.map(hex);

/** Moonlight version of a daylight colour: dim, cool, a little desaturated. */
export function nightify(c: RGB): RGB {
  const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  return [Math.round(c[0] * 0.23 + l * 0.09), Math.round(c[1] * 0.34 + l * 0.12), Math.round(c[2] * 0.3 + l * 0.26 + 10)];
}

export interface Look {
  ground: GroundPalette;
  moss: RGB[];
  litter: RGB[];
  path: RGB[];
  bark: RGB[];
  /** Roof ramps, one per species of treetop (or vine). */
  roof: RGB[][];
  bloom: RGB[];
  shroom: RGB;
  stem: RGB;
  /** How far the roof's shadow falls, in pixels, and how dark it is. */
  cast: [number, number];
  shadow: number;
  /** How much lighter a pool of sun (or moon) light is where a ray lands. */
  pool: number;
  /** How far the open ground sinks into shade near the roof. */
  wallDark: number;
  /** Arena extras: water, square paving, fallen petals, lily pads and lotus flowers. */
  water?: RGB[];
  tile?: RGB[];
  petal?: RGB[];
  pad?: RGB[];
  lotus?: RGB[];
}

/** What a pixel of ground is. */
export const K = {
  Grass: 0,
  Stone: 1,
  Grout: 2,
  Dirt: 3,
  Flower: 4,
  Moss: 5,
  Litter: 6,
  Path: 7,
  Pebble: 8,
  Roof: 9,
  Twig: 10,
  Shroom: 11,
  Water: 12,
  Tile: 13,
  Petal: 14,
  Pad: 15,
  Lotus: 16,
} as const;

/** One pixel of ground, as the spec classifies it. */
export interface Cell {
  kind: number;
  /** Variant within the kind (flower colour, roof species...). */
  sub: number;
  height: number;
  tone: number;
}

/** A strip's fields while it is built, for a spec's decorations (runes, lotus glow). */
export interface StripFields {
  y0: number;
  W: number;
  H: number;
  /** Row stride of the fields, which carry a one-pixel margin all round. */
  PW: number;
  kind: Uint8Array;
  sub: Uint8Array;
  height: Float32Array;
  tone: Float32Array;
  /** W x H, RGBA; whatever a decoration writes here glows. */
  emissive: Uint8ClampedArray;
}

/** Something that shades the ground beneath it: a tree's crown. */
export interface Caster {
  x: number;
  y: number;
  /** Crown radius. */
  r: number;
}

/** A pool of light on the ground, where a shaft of sunlight lands. */
export interface LightPool {
  x: number;
  y: number;
}

export interface GroundSpec {
  /** Texture key prefix, unique per arena. */
  key: string;
  w: number;
  h: number;
  night: Look;
  day: Look;
  /** Positive inside the roof, negative in the open, roughly in pixels from its edge. */
  roofDepth(x: number, y: number): number;
  /** Classify a pixel of open ground; `wall` is roofDepth there. */
  floor(x: number, y: number, wall: number, c: Cell): void;
  /** How much darker the open ground is at (x, y): edges, gloom by the roof. */
  gloom(x: number, y: number, wall: number, look: Look): number;
  /** Drawn over the finished fields (runes, glowing flowers). Returns whether anything glows. */
  decorate?(s: StripFields): boolean;
  /** Crowns that shade the ground, and pools of light. */
  casters(): Caster[];
  pools(): LightPool[];
}

export interface GroundLayers {
  diffuse: Uint8ClampedArray;
  normal: Uint8ClampedArray;
}

export interface GroundStrip {
  index: number;
  /** World y of the strip's top row. */
  y: number;
  w: number;
  h: number;
  night: GroundLayers;
  day: GroundLayers;
  /** Glowing runes and mushrooms, or null when the strip has none. */
  emissive: Uint8ClampedArray | null;
}

export const stripCount = (spec: GroundSpec): number => Math.ceil(spec.h / STRIP_H);

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export const smoothstep = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Roof clumps: one per cell of a jittered grid; a pixel belongs to the
// clump whose dome stands highest over it. Each strip caches its cells.
const CLUMP = 17;
const canopy = { z: 0, z2: 0, nx: 0, ny: 0, nz: 1, species: 0, edge: 0, hi: 0 };

class Clumps {
  readonly gx0: number;
  readonly gy0: number;
  readonly cols: number;
  readonly sx: Float32Array;
  readonly sy: Float32Array;
  readonly rad: Float32Array;
  readonly zb: Float32Array;
  readonly species: Uint8Array;

  constructor(x0: number, x1: number, y0: number, y1: number) {
    this.gx0 = Math.floor(x0 / CLUMP) - 1;
    this.gy0 = Math.floor(y0 / CLUMP) - 1;
    this.cols = Math.floor(x1 / CLUMP) + 2 - this.gx0;
    const rows = Math.floor(y1 / CLUMP) + 2 - this.gy0;
    const n = this.cols * rows;
    this.sx = new Float32Array(n);
    this.sy = new Float32Array(n);
    this.rad = new Float32Array(n);
    this.zb = new Float32Array(n);
    this.species = new Uint8Array(n);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const cx = this.gx0 + i;
        const cy = this.gy0 + j;
        const k = j * this.cols + i;
        const sx = (cx + 0.15 + hash2(cx, cy, 101) * 0.7) * CLUMP;
        const sy = (cy + 0.15 + hash2(cx, cy, 103) * 0.7) * CLUMP;
        this.sx[k] = sx;
        this.sy[k] = sy;
        this.rad[k] = 11 + hash2(cx, cy, 107) * 7;
        this.zb[k] = hash2(cx, cy, 109) * 0.55;
        // Neighbouring clumps mostly share a species; now and then a whole
        // crown stands out (autumn gold, or pale jasmine).
        const s = valueNoise(sx, sy, 90, 97) + (hash2(cx, cy, 113) - 0.5) * 0.35;
        this.species[k] = valueNoise(sx, sy, 34, 131) > 0.86 ? 3 : s < 0.3 ? 2 : s > 0.74 ? 1 : 0;
      }
    }
  }

  at(x: number, y: number): boolean {
    const gx = Math.floor(x / CLUMP) - this.gx0;
    const gy = Math.floor(y / CLUMP) - this.gy0;
    let best = -1;
    let second = -1;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const k = (gy + oy) * this.cols + gx + ox;
        const rad = this.rad[k];
        const dx = (x + 0.5 - this.sx[k]) / rad;
        const dy = (y + 0.5 - this.sy[k]) / (rad * 0.85);
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        const z = this.zb[k] + Math.sqrt(1 - d2);
        if (z > best) {
          second = best;
          best = z;
          canopy.species = this.species[k];
          // Dome normal, leaning a little toward the top of the screen.
          const nz = Math.sqrt(Math.max(0.05, 1 - d2)) * 1.1;
          const l = Math.hypot(dx, -dy + 0.15, nz);
          canopy.nx = dx / l;
          canopy.ny = (-dy + 0.15) / l;
          canopy.nz = nz / l;
          canopy.edge = d2;
          canopy.hi = dx < -0.1 && dy < -0.25 ? 1 : 0;
        } else if (z > second) second = z;
      }
    }
    canopy.z = best;
    canopy.z2 = second;
    return best > 0;
  }
}

/** Nearest flagstone seeds on a world grid: `stone.edge` is the distance to the joint, `stone.t` the stone's own tone. */
const CELL = 19;
export const stone = { edge: 0, t: 0 };
export function flagstone(x: number, y: number): void {
  const gx = Math.floor(x / CELL);
  const gy = Math.floor(y / CELL);
  let d1 = 1e9;
  let d2 = 1e9;
  let t = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox;
      const cy = gy + oy;
      const sx = (cx + 0.2 + hash2(cx, cy, 201) * 0.6) * CELL;
      const sy = (cy + 0.2 + hash2(cx, cy, 203) * 0.6) * CELL;
      const dd = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (dd < d1) {
        d2 = d1;
        d1 = dd;
        t = hash2(cx, cy, 205);
      } else if (dd < d2) d2 = dd;
    }
  }
  stone.edge = (d2 - d1) / 2;
  stone.t = t;
}

/**
 * A faint circle of glowing runes centred on (cx, cy), squashed by `squash`
 * vertically, drawn into the emissive layer. Returns whether it touched the strip.
 */
export function runeCircle(s: StripFields, cx: number, cy: number, r: number, squash: number, colour: RGB, onKind: (k: number) => number): boolean {
  const { y0, W, H, PW, kind, emissive } = s;
  if (y0 > cy + r / squash + 4 || y0 + H < cy - r / squash - 4) return false;
  let any = false;
  for (let y = y0; y < y0 + H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) * squash;
      const d = Math.hypot(dx, dy);
      if (Math.abs(d - r * 0.91) > r * 0.1 + 2.5) continue;
      const a = Math.atan2(dy, dx);
      const ring = Math.abs(d - r) < 0.6 || Math.abs(d - r * 0.82) < 0.55;
      const tick = Math.abs(d - r * 0.91) < 2.2 && Math.abs(((a * 12) / Math.PI) % 2) < 0.18;
      const glyph = Math.abs(d - r * 0.91) < 1.8 && hash2(Math.floor(a * 30), Math.floor(d), 5) > 0.72;
      if (!ring && !tick && !glyph) continue;
      const e = ((y - y0) * W + x) * 4;
      const k = ring ? 0.55 : 0.4;
      emissive[e] = colour[0] * k;
      emissive[e + 1] = colour[1] * k;
      emissive[e + 2] = colour[2] * k;
      emissive[e + 3] = 255;
      const i = (y - y0 + 1) * PW + x + 1;
      kind[i] = onKind(kind[i]);
      any = true;
    }
  }
  return any;
}

const GLOW: RGB = [80, 255, 214];

/** How far above a strip its roof field reaches, for the shadows the roof casts into it. */
const CAST_REACH = 18;

/** Build strip `index` of `spec`'s ground, yielding every few rows so the work spreads across frames. */
export function* buildStrip(spec: GroundSpec, index: number): Generator<void, GroundStrip, void> {
  const W = spec.w;
  const y0 = index * STRIP_H;
  const H = Math.min(STRIP_H, spec.h - y0);
  // Fields carry a one-pixel margin, so normals at the strip's edges match its neighbours.
  const PW = W + 2;
  const PH = H + 2;
  const n = PW * PH;
  const kind = new Uint8Array(n);
  const sub = new Uint8Array(n);
  const height = new Float32Array(n);
  const tone = new Float32Array(n);
  const wall = new Float32Array(n);
  const rnx = new Float32Array(n);
  const rny = new Float32Array(n);
  const rnz = new Float32Array(n);
  const emissive = new Uint8ClampedArray(W * H * 4);
  let glows = false;

  // How deep into the roof each pixel is, from CAST_REACH rows above the
  // strip down to its margin, x from -1 to W.
  const rowBase = y0 - 1 - CAST_REACH;
  const RW = W + 2;
  const roof = new Float32Array(RW * (y0 + H + 1 - rowBase + 1));
  let anyRoof = false;
  for (let y = rowBase; y <= y0 + H; y++) {
    const o = (y - rowBase) * RW;
    for (let x = -1; x <= W; x++) {
      const d = spec.roofDepth(x, y);
      roof[o + x + 1] = d;
      if (d > 0) anyRoof = true;
    }
    if ((y & 15) === 15) yield;
  }
  const roofAt = (x: number, y: number) => roof[(y - rowBase) * RW + clamp(x, -1, W) + 1];
  const clumps = new Clumps(-1, W, y0 - 1, y0 + H);
  const cell: Cell = { kind: 0, sub: 0, height: 0, tone: 0 };

  for (let py = 0; py < PH; py++) {
    const wy = y0 - 1 + py;
    for (let px = 0; px < PW; px++) {
      const wx = px - 1;
      const i = py * PW + px;
      const rd = roofAt(wx, wy);
      wall[i] = rd;
      if (rd > 0) {
        kind[i] = K.Roof;
        height[i] = 3;
        if (clumps.at(wx, wy)) {
          sub[i] = canopy.species;
          rnx[i] = canopy.nx;
          rny[i] = canopy.ny;
          rnz[i] = canopy.nz;
          let t = (hash2(wx >> 1, wy >> 1, 7) - 0.5) * 1.1 + (hash2(wx, wy, 9) - 0.5) * 0.7;
          if (canopy.z - canopy.z2 < 0.14) t -= 1.4; // crevice between clumps
          if (canopy.edge > 0.8) t -= 0.7;
          if (canopy.hi && hash2(wx, wy, 11) > 0.62) t += 1.2; // sunlit leaf tips
          tone[i] = t;
        } else {
          // A gap in the canopy: deep shade.
          sub[i] = 0;
          rnz[i] = 1;
          tone[i] = -3;
        }
        if (rd < 1.6) tone[i] -= 2.2; // dark rim where the roof ends
        else if (rd < 4) tone[i] -= 0.8;
        continue;
      }
      cell.kind = K.Grass;
      cell.sub = 0;
      cell.height = 0;
      cell.tone = 0;
      spec.floor(wx, wy, rd, cell);
      kind[i] = cell.kind;
      sub[i] = cell.sub;
      height[i] = cell.height;
      tone[i] = cell.tone;
    }
    if ((py & 3) === 3) yield;
  }

  // Small scattered details.
  const R = rng(index * 7919 + 13 + spec.key.length * 101);
  const at = (x: number, y: number) => (y - y0 + 1) * PW + x + 1;
  const inside = (x: number, y: number) => x >= -1 && x <= W && y >= y0 - 1 && y <= y0 + H;

  // Grass blades catch the light.
  for (let k = 0; k < (W * H) / 20; k++) {
    const x = Math.floor(R() * W);
    const y = y0 + Math.floor(R() * H);
    const len = 1 + Math.floor(R() * 3);
    for (let j = 0; j < len; j++) {
      if (!inside(x, y - j)) break;
      const i = at(x, y - j);
      if (kind[i] !== K.Grass && kind[i] !== K.Moss) break;
      height[i] = 0.55 + j * 0.2;
      tone[i] += 0.9 + j * 0.4;
    }
  }
  // Wildflowers in the lawns; bluebells and anemones in the moss under the trees.
  for (let k = 0; k < (W * H) / 800; k++) {
    const x0 = Math.floor(R() * W);
    const yy = y0 + Math.floor(R() * H);
    const colour = Math.floor(R() * 8);
    for (let j = 0; j < 4; j++) {
      const x = x0 + Math.floor(R() * 7) - 3;
      const y = yy + Math.floor(R() * 5) - 2;
      if (x < 0 || x >= W || y < y0 || y >= y0 + H) continue;
      const i = at(x, y);
      if (kind[i] === K.Grass) sub[i] = 0;
      else if (kind[i] === K.Moss && wall[i] < -14) sub[i] = 1;
      else continue;
      kind[i] = K.Flower;
      height[i] = 0.9;
      tone[i] = colour;
    }
  }
  // Twigs in the leaf litter.
  for (let k = 0; k < (W * H) / 1400; k++) {
    let x = Math.floor(R() * W);
    let y = y0 + Math.floor(R() * H);
    const dx = R() < 0.5 ? 1 : -1;
    const len = 3 + Math.floor(R() * 4);
    for (let j = 0; j < len; j++) {
      if (!inside(x, y)) break;
      const i = at(x, y);
      if (kind[i] !== K.Moss && kind[i] !== K.Litter) break;
      kind[i] = K.Twig;
      height[i] = 0.8;
      x += dx;
      if (R() < 0.4) y += 1;
    }
  }
  // Clusters of tiny mushrooms that glow in the dark, near the roof's edge.
  if (anyRoof) {
    for (let k = 0; k < 5; k++) {
      const cx = Math.floor(R() * W);
      const cy = y0 + 2 + Math.floor(R() * (H - 4));
      const w = wall[at(cx, cy)];
      if (w < -30 || w > -3 || (kind[at(cx, cy)] !== K.Moss && kind[at(cx, cy)] !== K.Litter)) continue;
      const count = 3 + Math.floor(R() * 4);
      for (let j = 0; j < count; j++) {
        const x = cx + Math.floor(R() * 9) - 4;
        const y = cy + Math.floor(R() * 5) - 2;
        if (x < 0 || x >= W || y <= y0 || y >= y0 + H - 1) continue;
        const cap = at(x, y);
        if (kind[cap] === K.Roof || kind[cap] === K.Path) continue;
        kind[cap] = K.Shroom;
        sub[cap] = 0;
        height[cap] = 1.2;
        const stem = at(x, y + 1);
        if (kind[stem] !== K.Roof && kind[stem] !== K.Path) {
          kind[stem] = K.Shroom;
          sub[stem] = 1;
          height[stem] = 0.9;
        }
        const e = ((y - y0) * W + x) * 4;
        const g = 0.5 + R() * 0.3;
        emissive[e] = GLOW[0] * g;
        emissive[e + 1] = GLOW[1] * g;
        emissive[e + 2] = GLOW[2] * g;
        emissive[e + 3] = 255;
        glows = true;
      }
    }
  }
  if (spec.decorate?.({ y0, W, H, PW, kind, sub, height, tone, emissive })) glows = true;
  yield;

  // Crowns whose shadows might reach this strip, and pools of light in it.
  const casters = spec.casters().filter((t) => t.y > y0 - 30 && t.y < y0 + H + 50);
  const pools = spec.pools().filter((p) => Math.abs(p.y - y0 - H / 2) < H / 2 + 20);

  const night = yield* colour(spec.night);
  const day = yield* colour(spec.day);
  return { index, y: y0, w: W, h: H, night, day, emissive: glows ? emissive : null };

  function* colour(look: Look): Generator<void, GroundLayers, void> {
    const diffuse = new Uint8ClampedArray(W * H * 4);
    const normal = new Uint8ClampedArray(W * H * 4);
    const L = KEY_LIGHT;
    const Ll = Math.hypot(L.x, L.y, L.z);
    const [ox, oy] = look.cast;
    const shadow = new Float32Array(W * H);
    const light = new Float32Array(W * H);
    const put = (a: Float32Array, x: number, y: number, v: number) => {
      if (x < 0 || x >= W || y < y0 || y >= y0 + H) return;
      const i = (y - y0) * W + x;
      if (v > a[i]) a[i] = v;
    };
    // The roof's shadow, with a softer edge...
    if (anyRoof) {
      for (let y = y0; y < y0 + H; y++) {
        for (let x = 0; x < W; x++) {
          const s = roofAt(x - ox, y - oy) > 0 ? 1 : roofAt(x - Math.round(ox * 0.7), y - Math.round(oy * 0.7)) > 0 ? 0.5 : 0;
          if (s) shadow[(y - y0) * W + x] = s;
        }
        if ((y & 31) === 31) yield;
      }
    }
    // ...each tree's crown and trunk...
    for (const t of casters) {
      const cx = t.x + ox * 1.4;
      const cy = t.y + Math.abs(oy) * 0.4;
      const rx = t.r * 0.9;
      const ry = t.r * 0.5;
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
          const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
          if (e < 1) put(shadow, x, y, e < 0.7 ? 1 : 0.5);
        }
      }
      const steps = Math.ceil(Math.hypot(cx - t.x, cy - t.y));
      for (let k = 0; k <= steps; k++) {
        const x = Math.round(t.x + ((cx - t.x) * k) / steps);
        const y = Math.round(t.y + ((cy - t.y) * k) / steps);
        put(shadow, x, y, 0.8);
        put(shadow, x + 1, y, 0.8);
      }
    }
    // ...and pools of light where the rays land.
    for (const p of pools) {
      for (let y = p.y - 7; y <= p.y + 7; y++) {
        for (let x = p.x - 15; x <= p.x + 15; x++) {
          const e = ((x - p.x) / 15) ** 2 + ((y - p.y) / 7) ** 2;
          if (e < 1) put(light, x, y, e < 0.45 ? 1 : 0.55 - (hash2(x, y, 81) > 0.5 ? 0.25 : 0));
        }
      }
    }
    const g = look.ground;
    const water = look.water ?? g.stone;
    const tile = look.tile ?? g.stone;
    const petal = look.petal ?? g.flowers;
    const pad = look.pad ?? look.moss;
    const lotus = look.lotus ?? g.flowers;
    for (let y = 0; y < H; y++) {
      const wy = y0 + y;
      for (let x = 0; x < W; x++) {
        const i = (y + 1) * PW + x + 1;
        const o = (y * W + x) * 4;
        const k = kind[i];
        let nx: number;
        let ny: number;
        let nz: number;
        if (k === K.Roof) {
          nx = rnx[i];
          ny = rny[i];
          nz = rnz[i];
        } else {
          // Normals from the height field, ignoring the step up to the roof.
          const hc = height[i];
          const hl = kind[i - 1] === K.Roof ? hc : height[i - 1];
          const hr = kind[i + 1] === K.Roof ? hc : height[i + 1];
          const hu = kind[i - PW] === K.Roof ? hc : height[i - PW];
          const hd = kind[i + PW] === K.Roof ? hc : height[i + PW];
          nx = (hl - hr) * 3.2;
          ny = (hd - hu) * 3.2;
          nz = 1;
          const l = Math.hypot(nx, ny, nz);
          nx /= l;
          ny /= l;
          nz /= l;
        }
        const lit = (nx * L.x + ny * L.y + nz * L.z) / Ll;
        let col: RGB;
        if (k === K.Roof) {
          const rp = look.roof[sub[i]];
          col = rp[clamp(Math.round(3.4 + (lit - 0.78) * 5 + tone[i]), 0, rp.length - 1)];
        } else {
          let dark = spec.gloom(x, wy, wall[i], look);
          const j = y * W + x;
          let s = shadow[j];
          // Dappled light through the leaves.
          if (s > 0 && valueNoise(x, wy, 4, 77) > 0.7) s *= 0.3;
          const pool = light[j];
          if (pool > 0) s *= 1 - pool;
          dark += s * look.shadow - pool * look.pool;

          const shade = (lit - 0.78) * 6 + tone[i] - dark;
          switch (k) {
            case K.Stone:
              col = g.stone[clamp(Math.round(3 + shade), 0, g.stone.length - 1)];
              break;
            case K.Grout:
              col = g.grout[clamp(Math.round(tone[i] - dark * 0.6), 0, g.grout.length - 1)];
              break;
            case K.Dirt:
              col = g.dirt[clamp(Math.round(2 + shade), 0, g.dirt.length - 1)];
              break;
            case K.Flower:
              if (dark > 1.5) col = look.moss[clamp(Math.round(2.5 + shade), 0, look.moss.length - 1)];
              else col = sub[i] ? look.bloom[tone[i] % look.bloom.length] : g.flowers[tone[i] % g.flowers.length];
              break;
            case K.Moss:
              col = look.moss[clamp(Math.round(2.6 + shade), 0, look.moss.length - 1)];
              break;
            case K.Litter:
              col = look.litter[clamp(Math.round(tone[i] + (lit - 0.78) * 3 - dark * 0.8), 0, look.litter.length - 1)];
              break;
            case K.Path:
              col = look.path[clamp(Math.round(3.2 + shade), 0, look.path.length - 1)];
              break;
            case K.Pebble:
              col = g.stone[clamp(Math.round(3.6 + shade), 0, g.stone.length - 1)];
              break;
            case K.Twig:
              col = look.bark[clamp(Math.round(2 + (lit - 0.78) * 4 - dark * 0.5), 0, look.bark.length - 1)];
              break;
            case K.Shroom:
              col = sub[i] ? look.stem : look.shroom;
              break;
            case K.Water:
              // Water keeps its own tone: shade only darkens it a little.
              col = water[clamp(Math.round(2.6 + tone[i] - dark * 0.5), 0, water.length - 1)];
              break;
            case K.Tile:
              col = tile[clamp(Math.round(3.2 + shade), 0, tile.length - 1)];
              break;
            case K.Petal:
              if (dark > 1.8) col = look.moss[clamp(Math.round(2.5 + shade), 0, look.moss.length - 1)];
              else col = petal[sub[i] % petal.length];
              break;
            case K.Pad:
              col = pad[clamp(Math.round(2.4 + shade), 0, pad.length - 1)];
              break;
            case K.Lotus:
              col = lotus[sub[i] % lotus.length];
              break;
            default:
              col = g.grass[clamp(Math.round(2.4 + shade), 0, g.grass.length - 1)];
          }
        }
        diffuse[o] = col[0];
        diffuse[o + 1] = col[1];
        diffuse[o + 2] = col[2];
        diffuse[o + 3] = 255;
        normal[o] = Math.round((nx * 0.5 + 0.5) * 255);
        normal[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        normal[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        normal[o + 3] = 255;
      }
      if ((y & 7) === 7) yield;
    }
    return { diffuse, normal };
  }
}
