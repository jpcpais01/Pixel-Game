// The maps' art: the minimap's picture of an arena, the Everwood's hand-drawn
// explorer's map, and the little inked icons pinned on both. Plain pixels, no
// page: the world turns them into textures (see scenes/MapScene.ts), and a
// script can paint them to a PNG.
//
// An arena's minimap is the arena itself, small: every cell of the map is
// MAP_CELL world pixels, coloured as the ground engine would colour it at
// that spot (the grass, the paving, the water, the roof of treetops), its
// trees stamped on as round shaded crowns, then drawn into relief from what
// can be walked: the open ground bright, what can't be walked sunk into
// shadow with an inked rim, and a wall's shadow along its foot.
//
// The Everwood's map is drawn as a traveller would draw it on parchment:
// watercolour washes for each wood, thickets inked round and stippled with
// crowns, streams and ponds in blue with their banks drawn in, trails in
// worn brown, every tree a little mark, cliffs inked as a hard line with
// hachures down their faces (slopes and stairs left open), each terrace a
// shade lighter than the one below. What hasn't been walked is blank paper,
// the known world fraying into it.

import { hash2, valueNoise } from './env';
import { K, type Cell, type GroundSpec, type Look } from './ground';
import { hex, type RGB } from './pixel';
import { bayer, mix } from './bitmap';
import { BIOMES, CHUNK, type FTree, type ForestGen, type WoodKind } from '../world/forestGen';

/** World pixels per map pixel, on every map. */
export const MAP_CELL = 8;
/** Map pixels across a chunk of the Everwood. */
export const TREK_T = CHUNK / MAP_CELL;

/** How much lighter the explorer's map draws each terrace above the plain. */
const MAP_LIFT = 0.035;
/** The Everwood's fog is lifted in squares this many world pixels across (4 to a chunk's side). */
export const FOG_CELL = 64;
/** The forest's tree grid (forestGen's TREE_CELL). */
const TREE_GRID = 22;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const shade = (c: RGB, k: number): RGB => [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)];

// ---------------------------------------------------------------- icons

const PAL: Record<string, RGB> = {
  k: hex('#1b1420'),
  w: hex('#fffaf0'),
  l: hex('#f0e0b8'),
  y: hex('#ffd84a'),
  Y: hex('#c8901e'),
  o: hex('#ff9a2e'),
  O: hex('#c8601a'),
  r: hex('#e8452c'),
  R: hex('#8a2418'),
  n: hex('#9a6a3a'),
  N: hex('#5a3820'),
  s: hex('#b4b4c4'),
  S: hex('#74748a'),
  d: hex('#4a4a5e'),
  g: hex('#7cc84e'),
  G: hex('#2f7a3a'),
  h: hex('#1f4a2c'),
  b: hex('#6ac4f4'),
  B: hex('#2a6aa8'),
  c: hex('#8af6e0'),
  p: hex('#c48aff'),
  P: hex('#6a3aa8'),
  m: hex('#ff8ac8'),
  M: hex('#b8467e'),
};

/** Each icon as rows of palette letters ('.' clear). Centred on its spot. */
const ICONS: Record<string, string[]> = {
  campfire: [
    '....k....',
    '...kyk...',
    '..kyoyk..',
    '..koyok..',
    '.kroyork.',
    '.krRoRrk.',
    'knnkRknnk',
    'kNNnknNNk',
    '.kk.k.kk.',
  ],
  ember: [
    '...k.....',
    '..ksk....',
    '...ksk...',
    '...ksk...',
    '..ksk....',
    '..kk.....',
    'knnkkknnk',
    'kNNnknNNk',
    '.kk.k.kk.',
  ],
  shrine: [
    '..kkkkk..',
    '.kssssSk.',
    'kssSkSsSk',
    'ksk.c.kSk',
    'kskcwckSk',
    'ksk.c.kSk',
    'kssk.kSSk',
    'kdddddddk',
    '.kkkkkkk.',
  ],
  chest: [
    '.kkkkkkk.',
    'knnnynnnk',
    'kNNNyNNNk',
    'kkkkykkkk',
    'knnyYynnk',
    'knnnynnnk',
    'kNNNyNNNk',
    '.kkkkkkk.',
  ],
  ruins: [
    '.kk......',
    'kssk..kk.',
    'ksSk.kssk',
    'ksSk.ksSk',
    'ksSk.ksSk',
    'ksSk.ksSk',
    'ksSkkksSk',
    'kdddddddk',
    '.kkkkkkk.',
  ],
  stones: [
    '....kk...',
    '...kssk..',
    '.kkksSkk.',
    'ksskspksk',
    'ksSkpSkSk',
    'ksSksSkSk',
    'ksSksSkSk',
    'kdddddddk',
    '.kkkkkkk.',
  ],
  elder: [
    '..kkkkk..',
    '.kgggggk.',
    'kgGgcgGgk',
    'kgggggGgk',
    'kGgGgGGGk',
    '.kkhNhkk.',
    '...kNk...',
    '..kNNNk..',
    '..kkkkk..',
  ],
  fairy: [
    '..k...k..',
    '.kmk.kmk.',
    'kmMk.kMmk',
    '.k..c..k.',
    '...cwc...',
    '.k..c..k.',
    'kmMk.kMmk',
    '.kmk.kmk.',
    '..k...k..',
  ],
  spring: [
    '..kkkkk..',
    '.kbbbbbk.',
    'kbbBwbbbk',
    'kbBwwbbBk',
    'kbBwwbbBk',
    'kbbBwbbbk',
    '.kbbbbbk.',
    '..kkkkk..',
  ],
  grove: [
    '..kkkkk..',
    '.kgGgGgk.',
    'kgGk.kGgk',
    'kGk.y.kGk',
    'kgk.y.kgk',
    'kGkkYkkGk',
    'kgkYyYkgk',
    'kGkkkkkGk',
    '.k.....k.',
  ],
  hollow: [
    '.k...k...',
    'kwk.kwk..',
    'klk.klk..',
    '.kwkwwkk.',
    '.kwwwwwwk',
    'kwwkwwwwk',
    'kwwwwwwk.',
    '.kllllk..',
    '..kkkk...',
  ],
  build: [
    '....k....',
    '...knk...',
    '..knnnk..',
    '.knnnnnk.',
    'kkkkkkkkk',
    '.klllllk.',
    '.klNkllk.',
    '.klNklyk.',
    '.kkkkkkk.',
  ],
  temple: [
    '....k....',
    '...kSk...',
    '..kSsSk..',
    '.kSsssSk.',
    'kkkkkkkkk',
    '.kskpksk.',
    '.kskpksk.',
    'kdddddddk',
    '.kkkkkkk.',
  ],
  anvil: [
    '.......o.',
    'kkkkkkko.',
    'kssssssk.',
    '.kSSSSSkk',
    '..kSSSk..',
    '..kdSdk..',
    '.kdddddk.',
    '.kkkkkkk.',
  ],
  butterfly: [
    '.kk...kk.',
    'kbbk.kbbk',
    'kbyBkBybk',
    '.kbBkBbk.',
    '.kbBkBbk.',
    'kbbk.kbbk',
    '.kk...kk.',
  ],
  pumpkin: [
    '....kGk..',
    '..kkGkk..',
    '.kooOook.',
    'koOooOoOk',
    'koOyoyOok',
    'koOoooOok',
    'kooyyyook',
    '.kooooOk.',
    '..kkkkk..',
  ],
  fountain: [
    '....b....',
    '...bwb...',
    '..b.b.b..',
    '.b..b..b.',
    '.kkkkkkk.',
    'kbbBbBbbk',
    'ksssssssk',
    '.kSSSSSk.',
    '..kkkkk..',
  ],
  legend: [
    '.k.k.k.k.',
    '.kykykyk.',
    '.kyyyyyk.',
    '.kkkkkkk.',
    'klllllllk',
    'klkklkklk',
    'klkrlkrlk',
    'klllklllk',
    '.klklklk.',
    '..kkkkk..',
  ],
  myth: [
    'kk.....kk',
    'kpk...kpk',
    '.kpkkkpk.',
    '.kpppppk.',
    'kpkkpkkpk',
    'kpkcpkcpk',
    'kpppkpppk',
    '.kpPpPpk.',
    '..kpkpk..',
    '...kkk...',
  ],
  mob: ['.kkk.', 'krrrk', 'krwrk', 'krRrk', '.kkk.'],
  mate: ['.kkk.', 'kwwwk', 'kwwwk', 'kwwwk', '.kkk.'],
};

/** The hero's arrow, turned to face each of 8 ways (0 = up, clockwise). */
function arrow(dir: number): string[] {
  const a = (dir * Math.PI) / 4;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const N = 9;
  const inside = (px: number, py: number) => {
    // Into the arrow's own frame: its tip at (0, -3.6), its base across y = 3.
    const x = (px - 4) * ca + (py - 4) * sa;
    const y = -(px - 4) * sa + (py - 4) * ca;
    if (y < -3.6 || y > 3) return false;
    return Math.abs(x) <= ((y + 3.6) / 6.6) * 3.2;
  };
  const rows: string[] = [];
  for (let y = 0; y < N; y++) {
    let r = '';
    for (let x = 0; x < N; x++) {
      if (inside(x, y)) {
        const deep = inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1);
        r += deep ? 'y' : 'w';
      } else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) r += 'k';
      else r += '.';
    }
    rows.push(r);
  }
  return rows;
}

export type MapIcon = keyof typeof ICONS | `me${number}`;

/** Every icon packed in a row: the sheet's pixels and each frame's box. */
export function mapIconSheet(): { w: number; h: number; px: Uint8ClampedArray; frames: Record<string, [number, number, number, number]> } {
  const all: [string, string[]][] = [...Object.entries(ICONS), ...[0, 1, 2, 3, 4, 5, 6, 7].map((d) => [`me${d}`, arrow(d)] as [string, string[]])];
  let w = 0;
  let h = 0;
  for (const [, rows] of all) {
    w += rows[0].length + 1;
    h = Math.max(h, rows.length);
  }
  const px = new Uint8ClampedArray(w * h * 4);
  const frames: Record<string, [number, number, number, number]> = {};
  let x0 = 0;
  for (const [id, rows] of all) {
    const iw = rows[0].length;
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < iw; x++) {
        const c = PAL[rows[y][x]];
        if (!c) continue;
        const o = (y * w + x0 + x) * 4;
        px[o] = c[0];
        px[o + 1] = c[1];
        px[o + 2] = c[2];
        px[o + 3] = 255;
      }
    }
    frames[id] = [x0, 0, iw, rows.length];
    x0 += iw + 1;
  }
  return { w, h, px, frames };
}

// ---------------------------------------------------------------- an arena's minimap

/** The colour the ground engine would give open ground at (x, y), flat and in plain light. */
function groundColour(spec: GroundSpec, look: Look, x: number, y: number, cell: Cell): RGB {
  const wall = spec.roofDepth(x, y);
  if (wall > 0) {
    const ramp = look.roof[spec.roofSpecies?.(x, y) ?? 0] ?? look.roof[0];
    // Clumps of crowns, darker toward the rim.
    const t = valueNoise(x, y, 13, 71) * 0.7 + valueNoise(x, y, 5, 73) * 0.3;
    const i = Math.round(1.8 + t * 3.4 - (wall < 6 ? 1.2 : 0));
    return ramp[clamp(i, 0, ramp.length - 1)];
  }
  cell.kind = K.Grass;
  cell.sub = 0;
  cell.height = 0;
  cell.tone = 0;
  spec.floor(x, y, wall, cell);
  const g = look.ground;
  const dark = spec.gloom(x, y, wall, look);
  const s = cell.tone - dark;
  const pick = (r: RGB[], at: number) => r[clamp(Math.round(at), 0, r.length - 1)];
  switch (cell.kind) {
    case K.Stone:
    case K.Pebble:
      return pick(g.stone, 3 + s);
    case K.Grout:
      return pick(g.grout, cell.tone - dark * 0.6);
    case K.Dirt:
      return pick(g.dirt, 2 + s);
    case K.Flower:
      return cell.sub ? look.bloom[Math.abs(Math.round(cell.tone)) % look.bloom.length] : g.flowers[Math.abs(Math.round(cell.tone)) % g.flowers.length];
    case K.Moss:
      return pick(look.moss, 2.6 + s);
    case K.Litter:
      return pick(look.litter, cell.tone - dark * 0.8);
    case K.Path:
      return pick(look.path, 3.2 + s);
    case K.Twig:
      return pick(look.bark, 2 - dark * 0.5);
    case K.Shroom:
      return cell.sub ? look.stem : look.shroom;
    case K.Water:
      return pick(look.water ?? g.stone, 2.6 + cell.tone - dark * 0.5);
    case K.Tile:
      return pick(look.tile ?? g.stone, 3.2 + s);
    case K.Petal:
      return (look.petal ?? g.flowers)[Math.abs(cell.sub) % (look.petal ?? g.flowers).length];
    case K.Pad:
      return pick(look.pad ?? look.moss, 2.4 + s);
    case K.Lotus:
      return (look.lotus ?? g.flowers)[Math.abs(cell.sub) % (look.lotus ?? g.flowers).length];
    case K.Plank:
      return pick(look.plank ?? look.path, 3 + s);
    case K.Fallen:
      return pick(look.fallen ?? look.litter, cell.tone - Math.max(0, dark) * 0.9);
    default:
      return pick(g.grass, 2.4 + s);
  }
}

/** An arena's map as colours, before relief: each cell the average of four spots in it. */
export interface MapBase {
  w: number;
  h: number;
  /** RGB per cell. */
  rgb: Uint8ClampedArray;
  /** Cells that stand up above the ground (treetops, crowns): they keep their colour off the walkable ground. */
  raised: Uint8Array;
}

/** Paint a streamed ground's map, a row of cells at a time (yields between rows). */
export function* groundMapBase(spec: GroundSpec, w: number, h: number): Generator<void, MapBase, void> {
  const cw = Math.ceil(w / MAP_CELL);
  const ch = Math.ceil(h / MAP_CELL);
  const rgb = new Uint8ClampedArray(cw * ch * 3);
  const raised = new Uint8Array(cw * ch);
  const cell: Cell = { kind: 0, sub: 0, height: 0, tone: 0 };
  const look = spec.day;
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let roof = 0;
      for (let k = 0; k < 4; k++) {
        const x = i * MAP_CELL + 2 + (k & 1) * 4;
        const y = j * MAP_CELL + 2 + (k >> 1) * 4;
        const c = groundColour(spec, look, x, y, cell);
        if (spec.roofDepth(x, y) > 0) roof++;
        r += c[0];
        g += c[1];
        b += c[2];
      }
      const o = (j * cw + i) * 3;
      rgb[o] = r / 4;
      rgb[o + 1] = g / 4;
      rgb[o + 2] = b / 4;
      raised[j * cw + i] = roof >= 2 ? 1 : 0;
    }
    yield;
  }
  return { w: cw, h: ch, rgb, raised };
}

/** Crown colours by tree, dark to light. */
const CROWNS: Record<string, RGB[]> = {
  oak: ['#16391f', '#21502a', '#2f6835', '#438040', '#5f9a4b', '#80b35a'].map(hex),
  birch: ['#2c4a1c', '#3d6224', '#527c2c', '#6a9636', '#88b346', '#a8cc5c'].map(hex),
  pine: ['#0a221f', '#0f2f29', '#163d33', '#1f4d3f', '#2b604c', '#3c745a'].map(hex),
  cherry: ['#6a2c48', '#94405e', '#bc5c78', '#d98396', '#eba6b4', '#f8c8d2'].map(hex),
};

/** Stamp trees on a map as round crowns, lit from the upper left, each with a shadow at its south side. */
export function stampCrowns(base: MapBase, trees: { x: number; y: number; kind: string; r: number }[]): void {
  const { w, h, rgb, raised } = base;
  for (const t of trees) {
    const ramp = CROWNS[t.kind] ?? CROWNS.oak;
    const r = Math.max(1.4, (t.r / MAP_CELL) * 0.82);
    const cx = t.x / MAP_CELL;
    const cy = (t.y - t.r * 0.55) / MAP_CELL;
    for (let j = Math.floor(cy - r - 1); j <= Math.ceil(cy + r + 1); j++) {
      for (let i = Math.floor(cx - r - 1); i <= Math.ceil(cx + r + 1); i++) {
        if (i < 0 || j < 0 || i >= w || j >= h) continue;
        const dx = i + 0.5 - cx;
        const dy = j + 0.5 - cy;
        const d = Math.hypot(dx, dy) / r;
        const o = (j * w + i) * 3;
        if (d >= 1) {
          // Its shadow on the ground, down and to the right of the crown.
          if (d < 1.35 && dy > 0 && dx > -r * 0.4 && !raised[j * w + i]) {
            rgb[o] *= 0.66;
            rgb[o + 1] *= 0.68;
            rgb[o + 2] *= 0.74;
          }
          continue;
        }
        const light = -(dx + dy) / r;
        const k = clamp(Math.round(2.3 + light * 1.7 - (d > 0.8 ? 1 : 0) + (hash2(i, j, 77) - 0.5) * 0.9), 0, ramp.length - 1);
        rgb[o] = ramp[k][0];
        rgb[o + 1] = ramp[k][1];
        rgb[o + 2] = ramp[k][2];
        raised[j * w + i] = 1;
      }
    }
  }
}

const SHADOW: RGB = hex('#120e1c');

/**
 * The map in relief, from its colours and what can be walked: the walkable
 * ground bright, a lit lip where it meets a wall below and a shadow where a
 * wall stands above; the rest sunk into shade, inked round its edge.
 */
export function reliefMap(base: MapBase, walk: Uint8Array): Uint8ClampedArray {
  const { w, h, rgb, raised } = base;
  const out = new Uint8ClampedArray(w * h * 4);
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : walk[j * w + i]);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const n = j * w + i;
      let c: RGB = [rgb[n * 3], rgb[n * 3 + 1], rgb[n * 3 + 2]];
      // A little more colour than the ground has, so it reads small.
      const l = (c[0] + c[1] + c[2]) / 3;
      c = [clamp(Math.round(l + (c[0] - l) * 1.2), 0, 255), clamp(Math.round(l + (c[1] - l) * 1.2), 0, 255), clamp(Math.round(l + (c[2] - l) * 1.2), 0, 255)];
      const edge = !walk[n] && (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1));
      if (walk[n]) {
        if (!at(i, j - 1)) c = mix(c, SHADOW, 0.3);
        else if (!at(i, j + 1)) c = mix(c, [255, 248, 224], 0.16);
        else if (!at(i - 1, j - 1) || !at(i + 1, j - 1)) c = mix(c, SHADOW, 0.12);
      } else if (raised[n]) c = edge ? mix(c, SHADOW, 0.42) : shade(c, 0.86);
      else c = mix(c, SHADOW, edge ? 0.66 : 0.46 + (bayer(i, j) > 0.5 ? 0.06 : 0));
      const o = n * 4;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
    }
  }
  return out;
}

// ---------------------------------------------------------------- the Everwood on parchment

const PAPER: RGB = hex('#ead7a8');
const PAPER_DARK: RGB = hex('#cfb47e');
const BLANK: RGB = hex('#dcc495');
export const INK: RGB = hex('#3b2a1e');
const WATER: RGB[] = ['#2e5a6e', '#4a7f92', '#6b9fae', '#94bec4'].map(hex);
const TRAIL: RGB[] = ['#6e4a2a', '#9a7448'].map(hex);
const PLANK: RGB = hex('#8a6438');

/** Each wood's wash over the paper, and its thickets' colour (light, dark). */
const WOODS: Record<string, { wash: RGB; leaf: RGB; deep: RGB; fleck: RGB | null }> = {
  oak: { wash: hex('#9db56e'), leaf: hex('#6f9448'), deep: hex('#3d5e2c'), fleck: null },
  birch: { wash: hex('#c9cf86'), leaf: hex('#9cb253'), deep: hex('#5e7a2e'), fleck: hex('#f4f0d8') },
  pine: { wash: hex('#8faa90'), leaf: hex('#4d7864'), deep: hex('#244a3e'), fleck: null },
  sakura: { wash: hex('#e6b8b4'), leaf: hex('#d48aa0'), deep: hex('#8e4a66'), fleck: hex('#ffd8e4') },
  meadow: { wash: hex('#d2d27c'), leaf: hex('#86a648'), deep: hex('#4e6a2c'), fleck: hex('#f6e070') },
  autumn: { wash: hex('#dcae6c'), leaf: hex('#c46a30'), deep: hex('#7a3418'), fleck: hex('#e8502a') },
  hollow: { wash: hex('#9a98a8'), leaf: hex('#4e6872'), deep: hex('#26363e'), fleck: hex('#7af0d0') },
};

/** Little tree marks, by kind: (light, dark). */
const MARKS: Record<WoodKind, [RGB, RGB]> = {
  oak: [hex('#5f8a3e'), hex('#2f4e22')],
  birch: [hex('#a0b85a'), hex('#5a7030')],
  pine: [hex('#3e6e58'), hex('#1c3a30')],
  cherry: [hex('#e494aa'), hex('#9a4a68')],
  maple: [hex('#e0782e'), hex('#8a3416')],
  willow: [hex('#9ab650'), hex('#55702c')],
};

/** Paper at (x, y): mottled with age, a fibre here and there. */
function paper(x: number, y: number, base: RGB): RGB {
  const age = valueNoise(x, y, 180, 401) * 0.7 + valueNoise(x, y, 46, 403) * 0.3;
  let c = mix(base, PAPER_DARK, clamp((age - 0.35) * 0.9, 0, 0.5));
  if (hash2(x >> 3, y >> 3, 405) > 0.985) c = mix(c, INK, 0.12);
  return c;
}

const THICKET = 1;
const WATERC = 2;
const TRAILC = 3;
const BRIDGE = 4;

/**
 * Paint chunk (cx, cy) of the Everwood as the explorer's map shows it once
 * walked: TREK_T x TREK_T map pixels, RGBA. `cleared` says which trees the
 * player took away (they leave no mark).
 */
export function trekTile(gen: ForestGen, cx: number, cy: number, cleared: (x: number, y: number) => boolean): Uint8ClampedArray {
  const T = TREK_T;
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const cls = new Uint8Array(T * T);
  const depth = new Float32Array(T * T);
  const core = new Uint8Array(T * T);
  const bio = new Uint8Array(T * T);
  // Each cell's terrace, and whether the way up from it is open (a slope or stairs).
  const lvl = new Int8Array(T * T);
  const open = new Uint8Array(T * T);
  for (let j = 0; j < T; j++) {
    for (let i = 0; i < T; i++) {
      const x = x0 + i * MAP_CELL + 4;
      const y = y0 + j * MAP_CELL + 4;
      const s = gen.sample(x, y);
      const water = Math.max(s.stream, s.pond);
      const trail = s.trail;
      const roof = s.roof;
      const n = j * T + i;
      // Trails and streams are drawn a little wider than they are, as on any map.
      if (trail < 2.5 && water > -4) cls[n] = BRIDGE;
      else if (water > -2.5) {
        cls[n] = WATERC;
        depth[n] = water;
      } else if (trail < 2.5) {
        cls[n] = TRAILC;
        core[n] = trail < -1 ? 1 : 0;
      } else if (roof > 0) {
        cls[n] = THICKET;
        depth[n] = roof;
      }
      bio[n] = gen.biomeAt(x, y);
      const land = gen.terrain(s);
      lvl[n] = land.level;
      open[n] = land.slope ? 1 : 0;
    }
  }
  const out = new Uint8ClampedArray(T * T * 4);
  const kind = (i: number, j: number) => cls[clamp(j, 0, T - 1) * T + clamp(i, 0, T - 1)];
  const level = (i: number, j: number) => lvl[clamp(j, 0, T - 1) * T + clamp(i, 0, T - 1)];
  for (let j = 0; j < T; j++) {
    for (let i = 0; i < T; i++) {
      const n = j * T + i;
      const x = x0 + i * MAP_CELL;
      const y = y0 + j * MAP_CELL;
      const wood = WOODS[BIOMES[bio[n]].id];
      const k = cls[n];
      const p = paper(x, y, PAPER);
      let c: RGB;
      if (k === WATERC) {
        const shore = kind(i - 1, j) !== WATERC && kind(i - 1, j) !== BRIDGE || kind(i + 1, j) !== WATERC && kind(i + 1, j) !== BRIDGE || kind(i, j - 1) !== WATERC && kind(i, j - 1) !== BRIDGE || kind(i, j + 1) !== WATERC && kind(i, j + 1) !== BRIDGE;
        if (shore) c = WATER[0];
        else {
          const deep = clamp(depth[n] / 9, 0, 1);
          c = mix(WATER[3], WATER[1], deep);
          // Ripples drawn as short strokes.
          if (hash2(Math.floor(x / 24), Math.floor(y / 8), 407) > 0.82 && hash2(x >> 3, y >> 3, 409) > 0.4) c = mix(c, [236, 246, 240], 0.5);
        }
        c = mix(p, c, 0.88);
      } else if (k === BRIDGE) {
        c = (i + j) % 2 ? PLANK : shade(PLANK, 0.78);
      } else if (k === TRAILC) {
        c = mix(p, core[n] ? TRAIL[0] : TRAIL[1], core[n] ? 0.72 : 0.5);
      } else if (k === THICKET) {
        const rim = kind(i - 1, j) !== THICKET || kind(i + 1, j) !== THICKET || kind(i, j - 1) !== THICKET || kind(i, j + 1) !== THICKET;
        if (rim) c = mix(p, wood.deep, 0.85);
        else {
          // Stippled crowns: a light dot over a dark one, in loose rows.
          const row = Math.floor(y / 24);
          const sx = (x / MAP_CELL + (row % 2) * 2) % 4;
          const sy = (y / MAP_CELL) % 3;
          const t = valueNoise(x, y, 40, 411);
          c = mix(p, mix(wood.leaf, wood.deep, 0.25 + t * 0.35), 0.62);
          if (sx === 1 && sy === 0) c = mix(c, [255, 250, 220], 0.22);
          else if (sx === 1 && sy === 1) c = mix(c, wood.deep, 0.55);
        }
      } else {
        const t = valueNoise(x, y, 70, 413);
        c = mix(p, wood.wash, 0.2 + t * 0.16);
        if (wood.fleck && hash2(x >> 3, y >> 3, 415) > 0.965) c = mix(c, wood.fleck, 0.6);
        // A bank: earth drawn along the water.
        if (kind(i - 1, j) === WATERC || kind(i + 1, j) === WATERC || kind(i, j - 1) === WATERC || kind(i, j + 1) === WATERC) c = mix(c, INK, 0.22);
        // A thicket's shadow at its south side.
        else if (kind(i, j - 1) === THICKET) c = mix(c, wood.deep, 0.22);
      }
      // The lie of the land: higher terraces a shade lighter.
      c = shade(c, 1 + clamp(lvl[n], -3, 3) * MAP_LIFT);
      const up = level(i, j - 1) > lvl[n];
      if (k === WATERC) {
        // Water wears its banks down to slopes: no cliff is inked across it.
      } else if (!open[n] && (up || level(i - 1, j) > lvl[n] || level(i + 1, j) > lvl[n] || level(i, j + 1) > lvl[n])) {
        // The foot of a cliff: a hard inked line, hachured down a face turned south.
        c = mix(c, INK, up ? 0.78 : 0.5);
      } else if (!open[n] && level(i, j - 2) > lvl[n] && (x / MAP_CELL) % 2 === 0) {
        c = mix(c, INK, 0.38);
      }
      const o = n * 4;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
    }
  }
  // Every tree in the open a little mark: a crown and its trunk.
  const put = (i: number, j: number, c: RGB, a = 1) => {
    if (i < 0 || j < 0 || i >= T || j >= T) return;
    const o = (j * T + i) * 4;
    const m = a >= 1 ? c : mix([out[o], out[o + 1], out[o + 2]], c, a);
    out[o] = m[0];
    out[o + 1] = m[1];
    out[o + 2] = m[2];
  };
  for (const t of chunkTrees(gen, cx, cy)) {
    if (cleared(t.x, t.y)) continue;
    const i = Math.floor((t.x - x0) / MAP_CELL);
    const j = Math.floor((t.y - y0) / MAP_CELL) - 1;
    if (kind(i, j) === THICKET || kind(i, j) === WATERC) continue;
    const [light, dark] = MARKS[t.kind];
    if (t.kind === 'pine') {
      put(i, j - 1, dark, 0.9);
      put(i - 1, j, dark, 0.9);
      put(i, j, light);
      put(i + 1, j, dark, 0.9);
    } else {
      put(i, j - 1, light);
      put(i - 1, j, light, 0.85);
      put(i, j, dark, 0.9);
      put(i + 1, j, light, 0.85);
    }
    put(i, j + 1, INK, 0.75);
  }
  return out;
}

/**
 * The trees standing in chunk (cx, cy): from its layout if the forest has
 * laid it out, else straight from the tree grid (a layout costs many times
 * more, all for its undergrowth and blockers), skipping the cells that
 * straddle the chunk's edge so no neighbour's fields are made for them.
 */
function chunkTrees(gen: ForestGen, cx: number, cy: number): FTree[] {
  if (gen.hasLayout(cx, cy)) return gen.layout(cx, cy).trees;
  const out: FTree[] = [];
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  for (let j = Math.ceil(y0 / TREE_GRID); j < Math.floor((y0 + CHUNK) / TREE_GRID); j++) {
    for (let i = Math.ceil(x0 / TREE_GRID); i < Math.floor((x0 + CHUNK) / TREE_GRID); i++) {
      const t = gen.treeAt(i, j);
      if (t) out.push(t);
    }
  }
  return out;
}

/**
 * The tile as far as it's known: where its squares are walked, the map;
 * elsewhere blank paper, the known world fraying into it. `known` says
 * whether a fog square (FOG_CELL world px) has been walked; `blank` is the
 * tile's blank paper (see `blankTile`).
 */
export function fogTile(terrain: Uint8ClampedArray, blank: Uint8ClampedArray, cx: number, cy: number, known: (fx: number, fy: number) => boolean): Uint8ClampedArray {
  const T = TREK_T;
  const out = new Uint8ClampedArray(T * T * 4);
  const per = FOG_CELL / MAP_CELL;
  // The squares round this tile, known or not.
  const F = CHUNK / FOG_CELL;
  const fx0 = cx * F - 1;
  const fy0 = cy * F - 1;
  const grid = new Float32Array((F + 2) * (F + 2));
  let sum = 0;
  for (let j = 0; j < F + 2; j++) for (let i = 0; i < F + 2; i++) sum += grid[j * (F + 2) + i] = known(fx0 + i, fy0 + j) ? 1 : 0;
  // Known all round, or nowhere near: nothing frays.
  if (sum === grid.length) return terrain.slice();
  if (sum === 0) return blank.slice();
  for (let j = 0; j < T; j++) {
    for (let i = 0; i < T; i++) {
      const x = cx * CHUNK + i * MAP_CELL;
      const y = cy * CHUNK + j * MAP_CELL;
      // How known this spot is, blended from the squares' middles.
      const gx = (i + 0.5) / per + 0.5;
      const gy = (j + 0.5) / per + 0.5;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const u = gx - ix;
      const v = gy - iy;
      const g = (a: number, b: number) => grid[clamp(iy + b, 0, F + 1) * (F + 2) + clamp(ix + a, 0, F + 1)];
      const known01 = g(0, 0) * (1 - u) * (1 - v) + g(1, 0) * u * (1 - v) + g(0, 1) * (1 - u) * v + g(1, 1) * u * v;
      const ragged = known01 + (valueNoise(x, y, 30, 417) - 0.5) * 0.5 + (hash2(i + cx * T, j + cy * T, 419) - 0.5) * 0.18;
      const o = (j * T + i) * 4;
      const b: RGB = [blank[o], blank[o + 1], blank[o + 2]];
      let c: RGB;
      if (ragged > 0.6) c = [terrain[o], terrain[o + 1], terrain[o + 2]];
      else if (ragged > 0.5) c = mix(mix([terrain[o], terrain[o + 1], terrain[o + 2]], b, 0.45), INK, 0.12);
      else c = b;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
    }
  }
  return out;
}

/** Blank paper for a tile nothing is known of (or whose map isn't painted yet). */
export function blankTile(cx: number, cy: number): Uint8ClampedArray {
  const T = TREK_T;
  const out = new Uint8ClampedArray(T * T * 4);
  for (let j = 0; j < T; j++) {
    for (let i = 0; i < T; i++) {
      const c = paper(cx * CHUNK + i * MAP_CELL, cy * CHUNK + j * MAP_CELL, BLANK);
      const o = (j * T + i) * 4;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
    }
  }
  return out;
}
