// The world's ground, generated in horizontal strips of STRIP_H rows so it
// can stream in as the heroes walk (see world/GroundStreamer.ts). Every
// feature is a function of world coordinates, so strips built in any order
// meet without seams.
//
// One pass classifies each pixel (grass, flagstone, forest floor, path,
// treetops...) and computes its height; the colouring pass then runs once
// per look (night and day), each with its own palette and its own shadows:
// the sun casts from the upper left, the moon from the upper right.
//
// Out beyond the forest corridor, the ground is a roof of treetops: round
// clumps of leaves with their own normals, so the sun and spells light them.

import { KEY_LIGHT, hex, type RGB } from './pixel';
import { DAY_GROUND, NIGHT_GROUND, hash2, rng, valueNoise, type GroundPalette } from './env';
import {
  PLAZA_CX,
  PLAZA_CY,
  PLAZA_H,
  PLAZA_R,
  PLAZA_Y,
  TREE_SHAPE,
  WORLD_H,
  WORLD_W,
  forestLayout,
  pathHalfW,
  roofDepth,
  row,
  smoothstep,
  type Row,
} from '../world/layout';

export const STRIP_H = 128;
export const STRIP_COUNT = Math.ceil(WORLD_H / STRIP_H);

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** Moonlight version of a daylight colour: dim, cool, a little desaturated. */
function nightify(c: RGB): RGB {
  const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  return [Math.round(c[0] * 0.2 + l * 0.08), Math.round(c[1] * 0.3 + l * 0.11), Math.round(c[2] * 0.26 + l * 0.24 + 9)];
}

interface Look {
  ground: GroundPalette;
  moss: RGB[];
  litter: RGB[];
  path: RGB[];
  bark: RGB[];
  /** Treetop ramps: oak, birch, pine, autumn gold. */
  roof: RGB[][];
  bloom: RGB[];
  shroom: RGB;
  stem: RGB;
  /** How far the treetops' shadows fall, in pixels, and how dark they are. */
  cast: [number, number];
  shadow: number;
  /** How much lighter a pool of sun (or moon) light is where a ray lands. */
  pool: number;
  /** How far the forest floor sinks into shade near the treetops. */
  wallDark: number;
}

const DAY_LOOK: Look = {
  ground: DAY_GROUND,
  moss: ramp('#17331f', '#1e4226', '#28542d', '#356a34', '#4a803b', '#679a46', '#8ab45a'),
  litter: ramp('#3a2718', '#58391f', '#7a5024', '#9c6c2c', '#bf8e3c', '#93402a'),
  path: ramp('#3e2e22', '#55402d', '#6e553a', '#876c4a', '#a1865d', '#baa072', '#cfb788'),
  bark: ramp('#1f140e', '#352318', '#4f3524', '#6b4a32'),
  roof: [
    ramp('#0d2419', '#133220', '#1b4328', '#255630', '#336b38', '#468241', '#5f9a4b', '#80b35a'),
    ramp('#1a3319', '#26461f', '#355d25', '#46742c', '#5c8c35', '#77a53f', '#96be4f', '#b8d466'),
    ramp('#0a1f1d', '#0f2b27', '#153830', '#1d4739', '#275743', '#33694d', '#437b58', '#568e64'),
    ramp('#3a220d', '#573511', '#7a4c15', '#9c661b', '#bf8424', '#dca334', '#f0c250', '#fbdc7c'),
  ],
  bloom: ramp('#7d8cf0', '#eef3ff', '#f4e27c', '#f0a0cf', '#a6d8ff'),
  shroom: hex('#c8fff0'),
  stem: hex('#e8e2cc'),
  cast: [14, 16],
  shadow: 1.9,
  pool: 2.4,
  wallDark: 1.1,
};

const NIGHT_LOOK: Look = {
  ground: NIGHT_GROUND,
  moss: DAY_LOOK.moss.map(nightify),
  litter: DAY_LOOK.litter.map(nightify),
  path: DAY_LOOK.path.map(nightify),
  bark: DAY_LOOK.bark.map(nightify),
  roof: DAY_LOOK.roof.map((r) => r.map(nightify)),
  bloom: ramp('#4a5694', '#8a93b8', '#7b7a6a', '#7a5a86', '#5a7aa0'),
  shroom: hex('#9ffff0'),
  stem: hex('#6a7888'),
  cast: [-12, 14],
  shadow: 0.9,
  pool: 0.9,
  wallDark: 1.7,
};

const GLOW: RGB = [80, 255, 214];
const RUNE: RGB = [150, 110, 255];

const enum K {
  Grass,
  Stone,
  Grout,
  Dirt,
  Flower,
  Moss,
  Litter,
  Path,
  Pebble,
  Roof,
  Twig,
  Shroom,
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

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// Treetop clumps: one per cell of a jittered grid; a pixel belongs to the
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
        // Neighbouring clumps mostly share a kind of tree; now and then a
        // whole crown has turned gold.
        const s = valueNoise(sx, sy, 90, 97) + (hash2(cx, cy, 113) - 0.5) * 0.35;
        this.species[k] = valueNoise(sx, sy, 34, 131) > 0.82 ? 3 : s < 0.3 ? 2 : s > 0.74 ? 1 : 0;
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

/** Nearest flagstone seeds (world grid, shared by the plaza and the old paving on the path). */
const CELL = 19;
const stone = { edge: 0, t: 0 };
function flagstone(x: number, y: number): void {
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

/** How far above a strip its roof grid reaches, for the shadows the treetops cast into it. */
const CAST_REACH = 18;

/** Build strip `index`, yielding every few rows so the work spreads across frames. */
export function* buildStrip(index: number): Generator<void, GroundStrip, void> {
  const W = WORLD_W;
  const y0 = index * STRIP_H;
  const H = Math.min(STRIP_H, WORLD_H - y0);
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

  // Per-row values, reaching far enough up for the shadows cast from above.
  const rowBase = y0 - 1 - CAST_REACH;
  const rows: Row[] = [];
  const halves: number[] = [];
  for (let y = rowBase; y <= y0 + H + 1; y++) {
    rows.push(row(y));
    halves.push(pathHalfW(y));
  }
  const rowAt = (y: number) => rows[y - rowBase] ?? row(y);
  const inPlazaBand = y0 + H > PLAZA_Y - 40;

  // How deep into the treetops each pixel is, from CAST_REACH rows above the
  // strip down to its margin, x from -1 to W.
  const RW = W + 2;
  const roof = new Float32Array(RW * (y0 + H + 1 - rowBase + 1));
  for (let y = rowBase; y <= y0 + H; y++) {
    const r = rowAt(y);
    const o = (y - rowBase) * RW;
    for (let x = -1; x <= W; x++) roof[o + x + 1] = roofDepth(x, y, r);
    if ((y & 15) === 15) yield;
  }
  const roofAt = (x: number, y: number) => roof[(y - rowBase) * RW + clamp(x, -1, W) + 1];
  const clumps = new Clumps(-1, W, y0 - 1, y0 + H);

  for (let py = 0; py < PH; py++) {
    const wy = y0 - 1 + py;
    const r = rowAt(wy);
    const half = halves[wy - rowBase];
    const ly = wy - PLAZA_Y;
    const reg = smoothstep(PLAZA_Y + 80, PLAZA_Y - 30, wy);
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
        if (rd < 1.6) tone[i] -= 2.2; // dark rim where the treetops end
        else if (rd < 4) tone[i] -= 0.8;
        continue;
      }

      let placed = false;
      // The plaza: flagstones, a lawn, bare dirt.
      if (inPlazaBand && ly > -30) {
        const lx = wx - PLAZA_CX;
        const d = Math.hypot(lx, (wy - PLAZA_CY) * 1.15);
        const edgeNoise = (valueNoise(wx, wy, 9, 3) - 0.5) * 22;
        if (d < PLAZA_R + edgeNoise) {
          const mossy = valueNoise(wx, wy, 14, 5);
          flagstone(wx, wy);
          if (stone.edge < 0.55) {
            kind[i] = K.Grout;
            tone[i] = mossy > 0.55 ? 2 : mossy > 0.4 ? 1 : 0;
          } else {
            kind[i] = K.Stone;
            height[i] = Math.min(1, stone.edge / 2.2) * 0.7 + valueNoise(wx, wy, 3, 11) * 0.08;
            tone[i] = (stone.t - 0.5) * 0.9 + (valueNoise(wx, wy, 6, 13) - 0.5) * 0.6;
            if (mossy > 0.62 && d > PLAZA_R * 0.55 && hash2(wx, wy, 3) > 0.35) {
              kind[i] = K.Grass;
              tone[i] = 0;
            }
          }
          placed = true;
        } else if (valueNoise(wx, wy, 20, 21) > 0.8 && d < PLAZA_R + 40 && Math.abs(wx - r.px) > half + 6) {
          kind[i] = K.Dirt;
          height[i] = valueNoise(wx, wy, 2, 23) * 0.2;
          tone[i] = (valueNoise(wx, wy, 4, 29) - 0.5) * 1.5;
          placed = true;
        }
      }
      if (placed) continue;

      // The path: packed earth, worn lighter down the middle, pebbles, and
      // the broken remains of the plaza's paving near its start.
      const off = Math.abs(wx - r.px);
      const dp = off - half + (valueNoise(wx, wy, 4, 57) - 0.5) * 4.5;
      if (dp < 0 && wy < PLAZA_CY) {
        const paving = smoothstep(PLAZA_Y - 330, PLAZA_Y + 40, wy) * 0.75;
        if (paving > 0) {
          flagstone(wx, wy);
          if (stone.t < paving && stone.edge > 0.9 && dp < -1.5) {
            kind[i] = K.Stone;
            height[i] = Math.min(1, stone.edge / 2.2) * 0.6;
            tone[i] = (stone.t - 0.5) * 0.9 - 0.4;
            continue;
          }
        }
        if (hash2(wx, wy, 59) > 0.982) {
          kind[i] = K.Pebble;
          height[i] = 0.9;
          tone[i] = (hash2(wx, wy, 61) - 0.5) * 1.6;
          continue;
        }
        kind[i] = K.Path;
        height[i] = valueNoise(wx, wy, 3, 63) * 0.25 + valueNoise(wx, wy, 9, 65) * 0.15;
        const worn = 1 - off / half;
        tone[i] = (valueNoise(wx, wy, 6, 67) - 0.5) * 1.3 + worn * 0.9 - (dp > -2.5 ? 0.9 : 0);
        continue;
      }

      // Grass in the plaza, the forest's moss and leaf litter to the north,
      // mingling where they meet.
      const forest = reg > 0.5 + (valueNoise(wx, wy, 9, 61) - 0.5) * 0.9;
      if (!forest) {
        kind[i] = K.Grass;
        height[i] = valueNoise(wx, wy, 4, 17) * 0.25 + valueNoise(wx, wy, 11, 19) * 0.25;
        tone[i] = (valueNoise(wx, wy, 18, 31) - 0.5) * 2.2;
      } else if (valueNoise(wx, wy, 13, 51) > 0.56 && hash2(wx, wy, 53) > 0.32) {
        kind[i] = K.Litter;
        height[i] = 0.35 + hash2(wx, wy, 55) * 0.35;
        tone[i] = 1 + Math.floor(hash2(wx >> 1, wy, 57) * 4) + (hash2(wx, wy, 58) > 0.96 ? 1 : 0);
      } else {
        kind[i] = K.Moss;
        height[i] = valueNoise(wx, wy, 3, 17) * 0.3 + valueNoise(wx, wy, 9, 19) * 0.2;
        tone[i] = (valueNoise(wx, wy, 16, 33) - 0.5) * 2 + (valueNoise(wx, wy, 5, 35) - 0.5) * 0.8;
      }
    }
    if ((py & 3) === 3) yield;
  }

  // Small scattered details.
  const R = rng(index * 7919 + 13);
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
  // Wildflowers in the plaza's lawn; bluebells and anemones in the forest.
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
  // Clusters of tiny mushrooms that glow in the dark, near the treeline.
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
  // The faint rune circle in the plaza.
  const runeR = PLAZA_R * 0.42;
  if (y0 < PLAZA_CY + runeR + 4 && y0 + H > PLAZA_CY - runeR - 4) {
    for (let y = y0; y < y0 + H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - PLAZA_CX;
        const dy = (y + 0.5 - PLAZA_CY) * 1.15;
        const d = Math.hypot(dx, dy);
        if (Math.abs(d - runeR * 0.91) > runeR * 0.1 + 2.5) continue;
        const a = Math.atan2(dy, dx);
        const ring = Math.abs(d - runeR) < 0.6 || Math.abs(d - runeR * 0.82) < 0.55;
        const tick = Math.abs(d - runeR * 0.91) < 2.2 && Math.abs(((a * 12) / Math.PI) % 2) < 0.18;
        const glyph = Math.abs(d - runeR * 0.91) < 1.8 && hash2(Math.floor(a * 30), Math.floor(d), 5) > 0.72;
        if (!ring && !tick && !glyph) continue;
        const e = ((y - y0) * W + x) * 4;
        const s = ring ? 0.55 : 0.4;
        emissive[e] = RUNE[0] * s;
        emissive[e + 1] = RUNE[1] * s;
        emissive[e + 2] = RUNE[2] * s;
        emissive[e + 3] = 255;
        const i = at(x, y);
        kind[i] = kind[i] === K.Grass || kind[i] === K.Flower ? K.Grass : K.Grout;
        glows = true;
      }
    }
  }
  yield;

  // Trees whose shadows might reach this strip.
  const layout = forestLayout();
  const trees = layout.trees.filter((t) => t.y > y0 - 30 && t.y < y0 + H + 50);
  const pools = layout.rays.filter((p) => Math.abs(p.y - y0 - H / 2) < H / 2 + 20);

  const night = yield* colour(NIGHT_LOOK);
  const day = yield* colour(DAY_LOOK);
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
    // The treetops' shadow, with a softer edge...
    for (let y = y0; y < Math.min(y0 + H, PLAZA_Y + 60); y++) {
      for (let x = 0; x < W; x++) {
        const s = roofAt(x - ox, y - oy) > 0 ? 1 : roofAt(x - Math.round(ox * 0.7), y - Math.round(oy * 0.7)) > 0 ? 0.5 : 0;
        if (s) shadow[(y - y0) * W + x] = s;
      }
      if ((y & 31) === 31) yield;
    }
    // ...each tree's crown and trunk...
    for (const t of trees) {
      const sh = TREE_SHAPE[t.kind];
      const cx = t.x + ox * 1.4;
      const cy = t.y + Math.abs(oy) * 0.4;
      const rx = sh.canopyR * 0.9;
      const ry = sh.canopyR * 0.5;
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
    for (let y = 0; y < H; y++) {
      const wy = y0 + y;
      const r = rowAt(wy);
      const reg = smoothstep(PLAZA_Y + 90, PLAZA_Y - 20, wy);
      const ly = wy - PLAZA_Y;
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
          // Normals from the height field, ignoring the step up to the treetops.
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
          // Shade: the plaza's edges, the gloom under the treeline, and cast shadows.
          const vd = Math.hypot((x - PLAZA_CX) / (WORLD_W / 2), (ly - PLAZA_H / 2) / (PLAZA_H / 2));
          let pd = Math.max(0, vd - 0.55) * g.edgeDark;
          // ...opening up where the path leaves for the forest.
          pd *= 1 - 0.9 * (1 - smoothstep(18, 120, Math.abs(x - r.px))) * (1 - smoothstep(PLAZA_Y + 110, PLAZA_Y + 200, wy));
          const fd = smoothstep(-46, 0, wall[i]) * look.wallDark;
          let dark = pd * (1 - reg) + fd * reg;

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
