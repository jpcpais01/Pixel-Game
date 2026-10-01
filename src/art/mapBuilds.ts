// What the player has built, drawn small for the maps (see scenes/MapScene.ts):
// the Home's plot, and whatever they've set out in the Everwood. A cell of the
// building grid (16 world px) is 2 x 2 map pixels, so everything is drawn as
// what it is from above rather than as a stand-in: floors in their own colours
// (boards in rows, flags in a check, a pond with its shore), house walls in
// their stone, timber or brick, a hedge as a green band and a fence as a thin
// line, trees as round shaded crowns, flower beds as dots of colour, furniture
// as little lit blocks, lamps as points of light, a bridge's planks over the
// water, and only a house that has a roof drawn as a house: its roof hipped
// from above, each slope lit as the sun lights the world (from the top left),
// with its shadow on the ground. Everything standing casts a pixel of shadow
// down and to the right. On the Everwood's parchment the colours are washed
// toward the paper so they sit in the drawing.
//
// Plain pixels, no page: the map turns them into canvases.

import { hash2 } from './env';
import { hex, type RGB } from './pixel';
import { mix } from './bitmap';
import { FLOORS, ROOFS, TENTS, WALLS, extent, partById, wallKind, wallMat } from '../world/homeParts';

/** Map pixels to a building cell's side. */
export const BUILD_PX = 2;

/** What's built, cell by cell: floors (FLOORS index from 1), walls (packed, see homeParts), roofs (ROOFS index from 1), and the things set out. */
export interface BuiltSource {
  floorAt(cx: number, cy: number): number;
  wallAt(cx: number, cy: number): number;
  roofAt(cx: number, cy: number): number;
  /** Tents (TENTS index from 1), drawn from above like roofs in their cloth. */
  tentAt?(cx: number, cy: number): number;
  things: readonly { id: string; x: number; y: number; turn: number }[];
}

const FLOOR_RGB: Record<string, string> = {
  lawn: '#6aa84f',
  meadow: '#78b456',
  soil: '#6b4a30',
  path: '#b08a5a',
  gravel: '#a6a298',
  sand: '#e0cc94',
  pond: '#3f7fb0',
  cobble: '#8e8a84',
  flags: '#a49c90',
  bricks: '#b0604a',
  oak: '#b8844c',
  walnut: '#7a5232',
  marble: '#e2e0ea',
  terracotta: '#c8744a',
  ashlar: '#9c968c',
};
/** Laid floors: boards run in rows, the rest are set in a check. */
const BOARDS = new Set(['oak', 'walnut']);
const TILES = new Set(['flags', 'bricks', 'marble', 'terracotta', 'ashlar']);
const SHORE: RGB = hex('#7cc0dc');

const WALL_RGB: Record<string, [string, string]> = {
  stone: ['#7c7c88', '#a4a4b0'],
  timber: ['#7a4e2c', '#a8784a'],
  logs: ['#6a4426', '#946238'],
  brick: ['#8e3e30', '#b85a44'],
  hedge: ['#2f6a2c', '#58a046'],
  fence: ['#d8ccb0', '#f4ead4'],
  lowwall: ['#8a8478', '#b4ae9e'],
};
const DOORWAY: RGB = hex('#c49a6a');
const GLASS: RGB = hex('#bfe4f4');

/** Roof slopes from darkest (facing south, away from the sun) to lightest (facing north, up the map). */
const ROOF_RGB: Record<string, string[]> = {
  slate: ['#323a52', '#4a5672', '#66749a', '#8a9ac0'],
  clay: ['#6e2e20', '#963e2a', '#bc5a38', '#dc7c50'],
  thatch: ['#6e5020', '#9a7634', '#c09a4a', '#dcbc68'],
  shingle: ['#3e2c1e', '#5c402c', '#7e5a3e', '#9e7652'],
};
const TENT_RGB: Record<string, string[]> = {
  canvas: ['#8a7a56', '#b4a37b', '#cbbb93', '#e2d6b4'],
  festival: ['#8a1d20', '#c23a32', '#e8dec0', '#f6f0dc'],
  ranger: ['#4f3623', '#694527', '#865c30', '#a07040'],
};
const CHIMNEY: RGB[] = ['#3a3a42', '#6a6a74'].map(hex);

/** Trees as crowns: dark, mid, light. */
const TREES: Record<string, string[]> = {
  oak: ['#2c5a26', '#3f7a32', '#62a048'],
  birch: ['#4a7a2e', '#6aa040', '#94c45c'],
  pine: ['#1e4630', '#2c6040', '#428058'],
  blossom: ['#b45a7a', '#e08aa8', '#f8c0d2'],
};
/** Small plants: their leaves and, on two of their four pixels, their colour. */
const PLANTS: Record<string, [string, string]> = {
  bush: ['#2f6a2c', '#4e9440'],
  roses: ['#2f6a2c', '#d83a48'],
  fern: ['#3a7a34', '#5aa048'],
  tulips: ['#3a7a34', '#e8504a'],
  lavender: ['#3a7a34', '#9a6ad8'],
  sunflowers: ['#3a7a34', '#f4c83a'],
  cabbages: ['#4a8a3a', '#9ccc6a'],
  pumpkin: ['#a84e18', '#f08a2a'],
  reeds: ['#3e6a2c', '#7a9a46'],
  lilypad: ['#2e7a3a', '#5ab05a'],
};
/** Things drawn as a single mark: its colour. */
const MARKS: Record<string, string> = {
  rock: '#9a9aa4',
  stump: '#7a5434',
  stepping: '#b4b0a6',
  birdbath: '#c8c8d4',
  scarecrow: '#d8b850',
  mailbox: '#4a6ab8',
  signpost: '#8a6236',
  fishrod: '#8a6236',
  chair: '#9a6a3e',
  stool: '#9a6a3e',
  plant: '#4e9440',
  armorstand: '#a4a4b0',
  clock: '#6a4426',
};
const RUGS: Record<string, string> = { rug: '#a83a3a', roundrug: '#c05a5a', runner: '#8a3a5a' };
/** Furniture and the rest: a little block lit along its top. */
const BLOCK: Record<string, string> = {
  haybale: '#d0b04a',
  well: '#8a8a94',
  planter: '#8a5a34',
  bench: '#9a6a3e',
  chest: '#8a5a2a',
  barrel: '#8a5a2a',
  crate: '#a87a44',
  fireplace: '#7c7c88',
  cauldron: '#3a3a44',
  bookshelf: '#6a4426',
  wardrobe: '#6a4426',
  jarshelf: '#6a4426',
  bed: '#c8c0d8',
  bigbed: '#c8c0d8',
};
const WOOD: RGB = hex('#9a6a3e');
const PLANK: RGB[] = ['#5a3a1c', '#8a5a2e', '#b07a42'].map(hex);
const WATER_DEEP: RGB = hex('#2a4a6a');
const PAPER: RGB = hex('#ead7a8');

const rgbOf = (s: string): RGB => hex(s);
const tone = (c: RGB, k: number): RGB => [Math.max(0, Math.min(255, Math.round(c[0] * k))), Math.max(0, Math.min(255, Math.round(c[1] * k))), Math.max(0, Math.min(255, Math.round(c[2] * k)))];

/**
 * The builds in cells [c0, c0 + cols) x [r0, r0 + rows), as RGBA pixels
 * (BUILD_PX to a cell), clear where nothing is built. Things whose footprint
 * starts outside still draw the part of them that falls inside (a tree's
 * crown reaching over). `paper` washes it toward the explorer's parchment.
 */
export function paintBuilds(src: BuiltSource, c0: number, r0: number, cols: number, rows: number, paper = false): Uint8ClampedArray {
  const W = cols * BUILD_PX;
  const H = rows * BUILD_PX;
  const rgb = new Float32Array(W * H * 3);
  // A roof or a tent's cloth: both cover what's under them.
  const tentAt = (cx: number, cy: number) => src.tentAt?.(cx, cy) ?? 0;
  const coverAt = (cx: number, cy: number) => src.roofAt(cx, cy) || tentAt(cx, cy);
  const al = new Float32Array(W * H);
  const X0 = c0 * BUILD_PX;
  const Y0 = r0 * BUILD_PX;
  /** Lay `c` over pixel (x, y) (in map pixels of the whole grid) at strength `a`. */
  const put = (x: number, y: number, c: RGB, a = 1) => {
    const i = x - X0;
    const j = y - Y0;
    if (i < 0 || j < 0 || i >= W || j >= H) return;
    const n = j * W + i;
    const k = 1 - a;
    rgb[n * 3] = c[0] * a + rgb[n * 3] * k;
    rgb[n * 3 + 1] = c[1] * a + rgb[n * 3 + 1] * k;
    rgb[n * 3 + 2] = c[2] * a + rgb[n * 3 + 2] * k;
    al[n] = a + al[n] * k;
  };
  const shadow = (x: number, y: number, a = 0.3) => put(x, y, [10, 12, 20], a);
  // A margin round the box, so what stands just outside still reaches in.
  const M = 3;
  const inBox = (cx: number, cy: number) => cx >= c0 - M && cy >= r0 - M && cx < c0 + cols + M && cy < r0 + rows + M;

  // ---- floors
  const floorId = (cx: number, cy: number) => {
    const f = src.floorAt(cx, cy);
    return f > 0 ? (FLOORS[f - 1]?.id ?? '') : '';
  };
  for (let cy = r0; cy < r0 + rows; cy++) {
    for (let cx = c0; cx < c0 + cols; cx++) {
      const id = floorId(cx, cy);
      if (!id) continue;
      const base = rgbOf(FLOOR_RGB[id] ?? '#a09a90');
      for (let j = 0; j < BUILD_PX; j++) {
        for (let i = 0; i < BUILD_PX; i++) {
          const x = cx * BUILD_PX + i;
          const y = cy * BUILD_PX + j;
          let c = base;
          if (id === 'pond') {
            // The shore where the pond meets anything else, deeper in the middle.
            const nx = i === 0 ? cx - 1 : cx + 1;
            const ny = j === 0 ? cy - 1 : cy + 1;
            const shore = floorId(nx, cy) !== 'pond' || floorId(cx, ny) !== 'pond';
            c = shore ? mix(base, SHORE, 0.45) : mix(base, WATER_DEEP, 0.25);
          } else if (BOARDS.has(id)) c = tone(base, j === 0 ? 1.08 : 0.9);
          else if (TILES.has(id)) c = tone(base, (i + j) % 2 === 0 ? 1.08 : 0.9);
          else if (id === 'meadow' && hash2(x, y, 7) > 0.78) c = hash2(x, y, 8) > 0.5 ? hex('#f0d050') : hex('#e88ab0');
          else c = tone(base, 0.93 + hash2(x, y, 5) * 0.14);
          put(x, y, c);
        }
      }
    }
  }

  // ---- shadows of what stands (walls, roofs, furniture, trees), down and to the right
  const wallInfo = (cx: number, cy: number) => {
    const v = src.wallAt(cx, cy);
    if (!v) return null;
    const def = WALLS[wallMat(v)];
    return def ? { def, kind: wallKind(v) } : null;
  };
  for (let cy = r0 - 1; cy < r0 + rows; cy++) {
    for (let cx = c0 - 1; cx < c0 + cols; cx++) {
      const w = wallInfo(cx, cy);
      if (w && w.kind !== 'door' && w.def.id !== 'fence') {
        put(cx * BUILD_PX + 2, cy * BUILD_PX + 1, [10, 12, 20], 0.28);
        put(cx * BUILD_PX + 1, cy * BUILD_PX + 2, [10, 12, 20], 0.28);
        put(cx * BUILD_PX + 2, cy * BUILD_PX + 2, [10, 12, 20], 0.28);
      }
      if (coverAt(cx, cy)) {
        // The roof's shadow falls a cell's width down and to the right.
        for (const [dx, dy] of [
          [2, 1],
          [1, 2],
          [2, 2],
          [3, 2],
          [2, 3],
        ])
          if (!coverAt(cx + Math.floor((dx + 1) / 2), cy + Math.floor((dy + 1) / 2))) shadow(cx * BUILD_PX + dx, cy * BUILD_PX + dy, 0.18);
      }
    }
  }

  // ---- walls: house walls in their material, hedges as a band, fences and low walls as a line
  for (let cy = r0; cy < r0 + rows; cy++) {
    for (let cx = c0; cx < c0 + cols; cx++) {
      const w = wallInfo(cx, cy);
      if (!w) continue;
      const [dk, lt] = (WALL_RGB[w.def.id] ?? ['#7c7c88', '#a4a4b0']).map(rgbOf);
      const x = cx * BUILD_PX;
      const y = cy * BUILD_PX;
      if (w.kind === 'door') {
        // A doorway or gate: open, a step of worn wood.
        put(x, y, DOORWAY);
        put(x + 1, y + 1, DOORWAY);
        continue;
      }
      if (w.def.id === 'fence' || w.def.id === 'lowwall') {
        // A thin line, joined to its neighbours.
        put(x, y, lt);
        if (wallInfo(cx + 1, cy)) put(x + 1, y, w.def.id === 'fence' ? lt : dk);
        if (wallInfo(cx, cy + 1)) put(x, y + 1, dk);
        continue;
      }
      put(x, y, lt);
      put(x + 1, y, w.def.id === 'hedge' ? lt : dk);
      put(x, y + 1, dk);
      put(x + 1, y + 1, w.kind === 'window' ? GLASS : dk);
    }
  }

  // ---- things, flat first, then small ones, then furniture, then trees over the rest
  const things = src.things.filter((t) => inBox(t.x, t.y));
  const order = (id: string) => (RUGS[id] || id === 'stepping' || id === 'lilypad' ? 0 : TREES[id] ? 3 : PLANTS[id] || MARKS[id] ? 1 : 2);
  things.sort((a, b) => order(a.id) - order(b.id));
  for (const t of things) {
    const p = partById(t.id);
    if (!p || p.wall || p.critter || p.door) continue;
    const e = extent(p, t.turn);
    const x = t.x * BUILD_PX;
    const y = t.y * BUILD_PX;
    const pw = e.w * BUILD_PX;
    const ph = e.h * BUILD_PX;
    if (p.bridge) {
      // Planks across, its rails dark where the deck has no neighbour.
      const isB = (cx: number, cy: number) => src.things.some((o) => o.x === cx && o.y === cy && partById(o.id)?.bridge);
      const ew = isB(t.x - 1, t.y) || isB(t.x + 1, t.y);
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          const rail = ew ? (j === 0 && !isB(t.x, t.y - 1)) || (j === 1 && !isB(t.x, t.y + 1)) : (i === 0 && !isB(t.x - 1, t.y)) || (i === 1 && !isB(t.x + 1, t.y));
          put(x + i, y + j, rail ? PLANK[0] : PLANK[(ew ? i : j) === 0 ? 2 : 1]);
        }
      continue;
    }
    if (TREES[t.id]) {
      // A round crown over its trunk, lit from the top left, with its shadow.
      const [dk, md, lt] = TREES[t.id].map(rgbOf);
      const cx = x + 1;
      const cy = y;
      const r = 2.6;
      for (let j = -3; j <= 4; j++)
        for (let i = -3; i <= 4; i++) if (Math.hypot(i - 1, j - 1) <= r) shadow(cx + i, cy + j, 0.22);
      for (let j = -3; j <= 3; j++)
        for (let i = -3; i <= 3; i++) {
          const d = Math.hypot(i, j);
          if (d > r) continue;
          const v = -(i + j) / r;
          put(cx + i, cy + j, d > r - 0.9 && v < 0.3 ? dk : v > 0.5 ? lt : v < -0.55 ? dk : md);
        }
      continue;
    }
    const plant = PLANTS[t.id];
    if (plant) {
      const [leaf, bloom] = plant.map(rgbOf);
      const flat = t.id === 'lilypad' || t.id === 'reeds' || t.id === 'fern';
      put(x, y, flat ? leaf : bloom, flat ? 0.9 : 1);
      put(x + 1, y + 1, flat ? leaf : bloom, flat ? 0.9 : 1);
      put(x + 1, y, leaf);
      put(x, y + 1, leaf);
      if (!flat && (t.id === 'bush' || t.id === 'roses' || t.id === 'pumpkin')) shadow(x + 2, y + 2, 0.22);
      continue;
    }
    const mark = MARKS[t.id];
    if (mark) {
      const c = rgbOf(mark);
      if (t.id === 'stepping') {
        put(x, y, c);
        put(x + 1, y + 1, c);
      } else {
        put(x, y + 1, c);
        put(x + 1, y + 1, tone(c, 0.75));
        shadow(x + 2, y + 2, 0.2);
      }
      continue;
    }
    const rug = RUGS[t.id];
    if (rug) {
      const c = rgbOf(rug);
      for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) put(x + i, y + j, i === 0 || j === 0 || i === pw - 1 || j === ph - 1 ? tone(c, 0.8) : c, 0.9);
      continue;
    }
    if (p.light) {
      // A point of light with a soft glow round it (a ward's in its own cool colour).
      const c = mix(rgbOf('#' + p.light.color.toString(16).padStart(6, '0')), [255, 255, 255], 0.35);
      const lx = x + (e.w > 1 ? e.w : 0);
      const ly = y + (e.h > 1 ? e.h : 0);
      for (const [i, j] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ])
        put(lx + i, ly + j, c, 0.32);
      put(lx, ly, c);
      shadow(lx + 1, ly + 1, 0.2);
      continue;
    }
    if (t.id === 'well') {
      // A ring of stone round dark water.
      for (let j = 0; j < 4; j++)
        for (let i = 0; i < 4; i++) {
          const inner = i > 0 && i < 3 && j > 0 && j < 3;
          if ((i === 0 || i === 3) && (j === 0 || j === 3)) continue;
          put(x + i, y + j, inner ? WATER_DEEP : i + j < 3 ? hex('#b4b4c0') : hex('#7a7a86'));
        }
      shadow(x + 4, y + 2, 0.24);
      shadow(x + 3, y + 4, 0.24);
      continue;
    }
    // A block: its footprint, lit along its top edge, darker along its foot, with a shadow.
    const c = BLOCK[t.id] ? rgbOf(BLOCK[t.id]) : WOOD;
    for (let i = 1; i <= pw; i++) shadow(x + i, y + ph, 0.24);
    for (let j = 1; j < ph; j++) shadow(x + pw, y + j, 0.24);
    for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) put(x + i, y + j, j === 0 ? tone(c, 1.18) : j === ph - 1 ? tone(c, 0.78) : c);
    if (t.id === 'chest') put(x + 1, y, hex('#f0c040'));
  }

  // ---- roofs: each slope lit by which edge of its roof is nearest, so a hipped roof reads from above
  const roofed = (x: number, y: number) => coverAt(Math.floor(x / BUILD_PX), Math.floor(y / BUILD_PX)) > 0;
  const reach = (x: number, y: number, dx: number, dy: number) => {
    let n = 0;
    while (n < 64 && roofed(x + dx * (n + 1), y + dy * (n + 1))) n++;
    return n;
  };
  for (let cy = r0; cy < r0 + rows; cy++) {
    for (let cx = c0; cx < c0 + cols; cx++) {
      const r = src.roofAt(cx, cy);
      const tent = tentAt(cx, cy);
      if (!r && !tent) continue;
      const pal = (r ? (ROOF_RGB[ROOFS[r - 1]?.id ?? 'slate'] ?? ROOF_RGB.slate) : (TENT_RGB[TENTS[tent - 1]?.id ?? 'canvas'] ?? TENT_RGB.canvas)).map(rgbOf);
      for (let j = 0; j < BUILD_PX; j++) {
        for (let i = 0; i < BUILD_PX; i++) {
          const x = cx * BUILD_PX + i;
          const y = cy * BUILD_PX + j;
          const n = reach(x, y, 0, -1);
          const s = reach(x, y, 0, 1);
          const w = reach(x, y, -1, 0);
          const e = reach(x, y, 1, 0);
          const m = Math.min(n, s, w, e);
          // Facing up the map is lit most, then west, east, and south least.
          let k = m === n ? 3 : m === w ? 2 : m === e ? 1 : 0;
          // The eaves a shade darker, the ridge where slopes meet a shade lighter.
          if (m === 0) k = Math.max(0, k - 1);
          else if ((m === n && m === s) || (m === w && m === e)) k = Math.min(3, k + 1);
          put(x, y, pal[k]);
        }
      }
    }
  }
  // Chimneys rise through the roof over a fireplace.
  for (const t of things) {
    if (!partById(t.id)?.chimney || !src.roofAt(t.x, t.y)) continue;
    put(t.x * BUILD_PX + 1, t.y * BUILD_PX - 1, CHIMNEY[1]);
    put(t.x * BUILD_PX + 1, t.y * BUILD_PX, CHIMNEY[0]);
    shadow(t.x * BUILD_PX + 2, t.y * BUILD_PX, 0.3);
  }

  const out = new Uint8ClampedArray(W * H * 4);
  for (let n = 0; n < W * H; n++) {
    const a = al[n];
    if (a <= 0.01) continue;
    // Colours were laid premultiplied over clear: undo that to store them straight.
    let c: RGB = [rgb[n * 3] / a, rgb[n * 3 + 1] / a, rgb[n * 3 + 2] / a];
    if (paper) c = mix(c, PAPER, 0.22);
    out[n * 4] = c[0];
    out[n * 4 + 1] = c[1];
    out[n * 4 + 2] = c[2];
    out[n * 4 + 3] = Math.round(a * 255);
  }
  return out;
}
