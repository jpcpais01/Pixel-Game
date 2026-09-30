// The floors of a Home, painted a patch at a time from the layout (see
// world/homeLayout.ts). Every floor is a function of the pixel's place on the
// plot, so neighbouring patches meet without seams and each cobble, board and
// flower stays put when the patch is repainted.
//
// A patch is painted in passes: which floor each pixel belongs to (soft ones
// melt into their neighbours with ragged, rounded edges; laid ones keep to
// their cells); then each floor's own texture and height (domed cobbles, the
// ridges of a garden bed, boards and their gaps, the pond deepening from its
// shore); then light: normals from the heights, shadows cast down and to the
// right by whatever stands higher toward the sun, and soft shade at the foot
// of every wall. Bare lawn is left clear, so the meadow underneath shows,
// darkened only where a wall stands on it.

import { bayer } from './bitmap';
import { hash2, valueNoise } from './env';
import { flagstone, nightify, ramp, stone } from './ground';
import { KEY_LIGHT, type RGB } from './pixel';
import { fbm } from './spirit';
import { CELL, COLS, HomeLayout, ROWS, cellIndex, inPlot, wallBoxes } from '../world/homeLayout';
import { FLOORS, WALLS, floorIndex, wallMat } from '../world/homeParts';

// ---------------------------------------------------------------- Palette

const LAWN = ramp('#173f22', '#215728', '#2d6e2e', '#3d8634', '#529e3e', '#6fb74c', '#94cc5e', '#bce27c');
const MEADOW = ramp('#15381f', '#1d4b24', '#28612a', '#387a31', '#4c923a', '#67aa46', '#88c056');
const SOIL = ramp('#170f0b', '#241810', '#342316', '#462f1e', '#5a3d27', '#6f4d31', '#86603e');
const PATH = ramp('#3a2a1c', '#524028', '#6a5334', '#846a44', '#9d8054', '#b59866', '#ccb07e', '#e0c898');
const GRAVEL = ramp('#2e2b2a', '#423e3b', '#58534e', '#6f6962', '#888078', '#a39a8e', '#bfb6a8', '#d9d0c0');
const GRAVEL_WARM = ramp('#342c24', '#4a3f33', '#615343', '#7a6953', '#948066', '#ad997c', '#c6b294', '#dccaac');
const SAND = ramp('#5e4e32', '#7c6a46', '#9a865a', '#b6a070', '#ccb886', '#dfcd9e', '#ede0b8', '#f8f0d4');
const WATER = ramp('#081e2a', '#0b2c3a', '#0f3d4b', '#15515c', '#1c676e', '#277f82', '#3a9a96', '#5cb8ac', '#94d8c8', '#d4f4ea');
const MORTAR = ramp('#141214', '#1e1c1e', '#2a2828', '#383634');
const MOSS = ramp('#142c16', '#1d3e1c', '#2a5424', '#3a6c2c', '#4e8636');
const COBBLE = ramp('#26252c', '#35333b', '#46434c', '#59555e', '#6e6972', '#857f87', '#9e979d', '#b8b0b2');
const COBBLE_WARM = ramp('#2c2622', '#3d352e', '#50463c', '#655849', '#7b6c59', '#92816b', '#aa977e', '#c2ae94');
const FLAGS = ramp('#322c28', '#453d36', '#5a5046', '#706458', '#877a6b', '#9e907e', '#b6a792', '#cdbfa8');
const BRICK = ramp('#2e120e', '#461a14', '#60241a', '#7a3022', '#943e2a', '#ac5036', '#c26646', '#d8825c');
const MORTAR_PALE = ramp('#4a423a', '#62584e', '#7a7064', '#948a7c', '#aca294');
const OAK = ramp('#24160c', '#341f10', '#482c16', '#5e3a1d', '#764b26', '#8e5e31', '#a6743f', '#be8c52');
const WALNUT = ramp('#120a07', '#1c110b', '#28180f', '#362115', '#462b1c', '#573624', '#6a432e', '#7e5239');
const MARBLE_W = ramp('#5e5a64', '#7a7680', '#96929c', '#b2aeb6', '#cac6cc', '#dedadf', '#eeebee', '#fbfafb');
const MARBLE_D = ramp('#1c1f2a', '#272b38', '#333947', '#414858', '#51596a', '#636c7e', '#778194', '#8c97aa');
const TERRA = ramp('#3a160c', '#561f10', '#712b16', '#8c381e', '#a44828', '#ba5a34', '#cc6e44', '#de8656');
const ASHLAR = ramp('#201f24', '#2c2a31', '#39373f', '#48454e', '#58545e', '#6a6570', '#7e7984', '#948f99');
const PETALS: RGB[][] = [
  ramp('#9a9488', '#d8d4c8', '#f4f2ea', '#ffffff'),
  ramp('#6a1414', '#b02820', '#e4483a', '#ff7a60'),
  ramp('#20306e', '#3c58c0', '#6a8ef0', '#a8c0ff'),
  ramp('#7a5a0c', '#d0a820', '#f4dc4a', '#fff49a'),
  ramp('#7a2a5e', '#c85c98', '#f08cc0', '#ffc4e0'),
];
const HEARTS: RGB[][] = [ramp('#8a5a08', '#e0a820', '#ffe060'), ramp('#140a0a', '#2a1410', '#3a2016')];

/** How high each floor lies: water low, grass and flowers standing up, bare lawn (no floor) in between. */
const LAWN_H = 0.5;

// ---------------------------------------------------------------- Painting one pixel

/** What a pixel's floor paints: a ramp, a place on it, and how high it stands. */
const px = { r: LAWN as RGB[], i: 3, h: 0.5 };

/** Nearest two seeds on a jittered grid of `size` px: how far into its stone a pixel is, and that stone's own number. */
const cell = { edge: 0, id: 0 };
function voronoi(x: number, y: number, size: number, seed: number): void {
  const gx = Math.floor(x / size);
  const gy = Math.floor(y / size);
  let d1 = 1e9;
  let d2 = 1e9;
  let id = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox;
      const cy = gy + oy;
      const sx = (cx + 0.2 + hash2(cx, cy, seed) * 0.6) * size;
      const sy = (cy + 0.2 + hash2(cx, cy, seed + 1) * 0.6) * size;
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash2(cx, cy, seed + 2);
      } else if (d < d2) d2 = d;
    }
  }
  cell.edge = (d2 - d1) / 2;
  cell.id = id;
}

function lawn(x: number, y: number): void {
  // Mown stripes, soft patches of lighter and darker grass, and blades catching the sun.
  const stripe = (Math.floor((x - y * 0.5) / 18) & 1 ? 0.28 : -0.18) + (valueNoise(x, y, 11, 301) - 0.5) * 1.1;
  const blade = hash2(x, y, 303);
  let i = 3.4 + stripe + (valueNoise(x, y, 3, 305) - 0.5) * 0.7;
  let h = LAWN_H + 0.06 + (valueNoise(x, y, 3, 305) - 0.5) * 0.05;
  if (blade > 0.84) {
    i += 1.1;
    h += 0.06;
  } else if (blade < 0.1) i -= 0.9;
  px.r = LAWN;
  px.i = i;
  px.h = h;
  // Now and then a daisy.
  if (hash2(x >> 2, y >> 2, 307) > 0.985 && ((x ^ y) & 3) === 1) {
    px.r = PETALS[0];
    px.i = 3;
    px.h = h + 0.15;
  }
}

function meadow(x: number, y: number): void {
  const tall = hash2(x, y, 311);
  px.r = MEADOW;
  px.i = 3 + (valueNoise(x, y, 8, 313) - 0.5) * 1.6 + (tall > 0.8 ? 1.2 : tall < 0.14 ? -1 : 0);
  px.h = 0.6 + (tall > 0.8 ? 0.08 : 0);
  // Flowers on a jittered grid: a heart and four petals each.
  const G = 6;
  const gx = Math.floor(x / G);
  const gy = Math.floor(y / G);
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox;
      const cy = gy + oy;
      if (hash2(cx, cy, 317) < 0.42) continue;
      const fx = cx * G + 1 + Math.floor(hash2(cx, cy, 319) * 4);
      const fy = cy * G + 1 + Math.floor(hash2(cx, cy, 321) * 4);
      const dx = x - fx;
      const dy = y - fy;
      const kind = Math.floor(hash2(cx, cy, 323) * PETALS.length);
      if (dx === 0 && dy === 0) {
        px.r = HEARTS[kind === 1 ? 1 : 0];
        px.i = 2;
        px.h = 0.86;
        return;
      }
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        px.r = PETALS[kind];
        // The petals toward the sun are brightest.
        px.i = 2 + (dx < 0 || dy < 0 ? 1 : 0);
        px.h = 0.82;
        return;
      }
    }
  }
}

function soil(x: number, y: number, edge: number): void {
  // A raised bed: an oak edging, and furrows of dark earth inside it.
  if (edge < 2) {
    px.r = OAK;
    px.i = edge < 1 ? 3.6 : 2.2;
    px.h = 0.66;
    if (((x + y) & 7) === 0 && edge < 1) px.i -= 1.4;
    return;
  }
  const row = (y % 6) / 6;
  const ridge = Math.sin(row * Math.PI * 2);
  px.r = SOIL;
  px.i = 3 + ridge * 0.5 + (valueNoise(x, y, 3, 331) - 0.5) * 1.2 + (hash2(x, y, 333) > 0.92 ? 1 : 0);
  px.h = 0.34 + ridge * 0.07 + (hash2(x >> 1, y, 335) - 0.5) * 0.04;
  // A pale pebble here and there.
  if (hash2(x, y, 337) > 0.985) {
    px.r = GRAVEL;
    px.i = 5;
    px.h += 0.05;
  }
}

function path(x: number, y: number, edge: number): void {
  px.r = PATH;
  px.i = 3.6 + (valueNoise(x, y, 7, 341) - 0.5) * 1.3 + (valueNoise(x, y, 2.5, 343) - 0.5) * 0.6 - Math.max(0, 3 - edge) * 0.25;
  px.h = 0.3 + (valueNoise(x, y, 4, 345) - 0.5) * 0.04;
  const p = hash2(x, y, 347);
  if (p > 0.94) {
    px.i += p > 0.975 ? 1.6 : -1.2;
    px.h += 0.07;
  }
  // Tufts of grass creeping in from the edges.
  if (edge < 2.5 && hash2(x, y, 349) > 0.72) {
    px.r = LAWN;
    px.i = 3.4 + hash2(x, y, 351);
    px.h = 0.56;
  }
}

function gravel(x: number, y: number, edge: number): void {
  voronoi(x, y, 3, 361);
  const warm = cell.id > 0.62;
  px.r = warm ? GRAVEL_WARM : GRAVEL;
  if (cell.edge < 0.35) {
    px.i = 1.2;
    px.h = 0.3;
  } else {
    px.i = 3.4 + (cell.id - 0.5) * 3 + Math.min(cell.edge, 1.2) * 0.8;
    px.h = 0.34 + Math.min(cell.edge, 1.2) * 0.07;
  }
  if (edge < 2 && hash2(x, y, 363) > 0.78) {
    px.r = LAWN;
    px.i = 3.2 + hash2(x, y, 365);
    px.h = 0.56;
  }
}

function sand(x: number, y: number, edge: number): void {
  const ripple = Math.sin(x * 0.32 + y * 0.85 + valueNoise(x, y, 18, 371) * 7);
  px.r = SAND;
  px.i = 4.2 + ripple * 0.45 + (valueNoise(x, y, 6, 373) - 0.5) * 0.8 - Math.max(0, 2 - edge) * 0.3;
  px.h = 0.42 + ripple * 0.025;
  const s = hash2(x, y, 375);
  if (s > 0.992) px.i += 2;
  else if (s < 0.006) {
    // A tiny shell.
    px.r = PETALS[4];
    px.i = 3;
  }
}

function pond(x: number, y: number, depth: number): void {
  px.r = WATER;
  px.h = 0.06;
  if (depth < 1) {
    // Foam where it laps the shore.
    px.i = hash2(x, y, 381) > 0.35 ? 9 : 8;
    return;
  }
  if (depth < 2.2) {
    // Sandy shallows.
    px.r = SAND;
    px.i = 2.4 + (valueNoise(x, y, 4, 383) - 0.5) * 0.8;
    return;
  }
  const d = Math.min(depth - 2, 8);
  let i = 6.4 - d * 0.62 + (valueNoise(x, y, 14, 385) - 0.5) * 0.9;
  // Ripples: short bright crests drifting across.
  const wave = y * 0.9 + Math.sin(x * 0.21 + valueNoise(x, y, 20, 387) * 5) * 2.2;
  const f = wave - Math.floor(wave / 7) * 7;
  if (f < 0.9 && hash2(x >> 2, Math.floor(wave / 7), 389) > 0.45) i += 1.7;
  px.i = i;
}

function cobble(x: number, y: number): void {
  voronoi(x, y, 7, 401);
  if (cell.edge < 0.75) {
    const mossy = valueNoise(x, y, 9, 403) > 0.6;
    px.r = mossy ? MOSS : MORTAR;
    px.i = mossy ? 2 + hash2(x, y, 405) * 2 : 1.5;
    px.h = 0.34;
    return;
  }
  px.r = cell.id > 0.7 ? COBBLE_WARM : COBBLE;
  px.i = 2.6 + (cell.id - 0.5) * 2 + Math.min(cell.edge, 2.5) * 0.35 + (hash2(x, y, 407) - 0.5) * 0.5;
  px.h = 0.36 + Math.min(cell.edge / 2.5, 1) * 0.22;
}

function flags(x: number, y: number): void {
  flagstone(x, y);
  if (stone.edge < 0.7) {
    const grassy = valueNoise(x, y, 11, 411) > 0.45;
    px.r = grassy ? LAWN : MORTAR;
    px.i = grassy ? 2.6 + hash2(x, y, 413) * 1.5 : 1.6;
    px.h = grassy ? 0.5 : 0.38;
    return;
  }
  const crack = Math.abs(fbm(x, y, 9, 415, 2) - 0.5) < 0.012;
  px.r = FLAGS;
  px.i = 3.4 + (stone.t - 0.5) * 1.8 + (hash2(x, y, 417) - 0.5) * 0.5 + (valueNoise(x, y, 4, 419) - 0.5) * 0.5 - (crack ? 1.5 : 0);
  px.h = 0.45 + Math.min(stone.edge, 1.4) * 0.035;
}

function bricks(x: number, y: number): void {
  // Basket weave: blocks of two bricks, lying one way then the other.
  const bx = Math.floor(x / 8);
  const by = Math.floor(y / 8);
  const lx = ((x % 8) + 8) % 8;
  const ly = ((y % 8) + 8) % 8;
  const across = ((bx + by) & 1) === 0;
  const joint = across ? ly === 3 || ly === 7 || lx === 7 : lx === 3 || lx === 7 || ly === 7;
  if (joint) {
    px.r = MORTAR_PALE;
    px.i = 1.6 + hash2(x, y, 421) * 0.8;
    px.h = 0.36;
    return;
  }
  const n = across ? (ly < 4 ? 0 : 1) : lx < 4 ? 0 : 1;
  const t = hash2(bx * 2 + n, by, 423);
  const top = across ? ly === 0 || ly === 4 : lx === 0 || lx === 4;
  px.r = BRICK;
  px.i = 3.3 + (t - 0.5) * 1.8 + (top ? 0.5 : 0) + (hash2(x, y, 425) > 0.9 ? -0.8 : 0);
  px.h = 0.42;
}

function boards(x: number, y: number, r: RGB[], seed: number, tall: number): void {
  const row = Math.floor(y / tall);
  const ly = y - row * tall;
  px.r = r;
  if (ly === tall - 1) {
    // The dark gap between boards.
    px.i = 0.8;
    px.h = 0.34;
    return;
  }
  const off = Math.floor(hash2(row, 0, seed) * 30);
  const len = 26 + Math.floor(hash2(row, 1, seed) * 3) * 6;
  const seg = Math.floor((x + off) / len);
  const lx = x + off - seg * len;
  const t = hash2(row, seg, seed + 1);
  // Grain running along the board, and a knot now and then.
  const grain = Math.sin(x * 0.55 + fbm(x, y * 5, 9, seed + 2, 2) * 9 + t * 20) * 0.4;
  let i = 3.4 + (t - 0.5) * 1.6 + grain + (ly === 0 ? 0.5 : 0);
  if (lx === 0) i = 1.2;
  else if ((lx === 2 || lx === len - 2) && ly === 1 && ((row + seg) & 1) === 0) i = 1.4; // nails
  const kx = off + seg * len + len / 2 - x;
  if (hash2(row, seg, seed + 3) > 0.8 && Math.hypot(kx * 0.6, ly - tall / 2 + 0.5) < 1.2) i -= 1.3;
  px.i = i;
  px.h = 0.42;
}

function marble(x: number, y: number): void {
  const tx = Math.floor(x / 8);
  const ty = Math.floor(y / 8);
  const lx = ((x % 8) + 8) % 8;
  const ly = ((y % 8) + 8) % 8;
  const dark = ((tx + ty) & 1) === 1;
  px.r = dark ? MARBLE_D : MARBLE_W;
  px.h = 0.42;
  if (lx === 0 || ly === 0) {
    px.i = dark ? 1 : 2.4;
    px.h = 0.4;
    return;
  }
  const vein = Math.abs(fbm(x * 1.2, y, 14, dark ? 431 : 433, 3) - 0.5);
  let i = 4 + (valueNoise(x, y, 20, 435) - 0.5) * 0.9 + (hash2(tx, ty, 437) - 0.5) * 0.6;
  if (vein < 0.012) i += dark ? 1.6 : -1.8;
  else if (vein < 0.03) i += dark ? 0.6 : -0.6;
  if (lx === 1 || ly === 1) i += 0.6;
  if (lx === 7 || ly === 7) i -= 0.5;
  px.i = i;
}

function terracotta(x: number, y: number): void {
  const tx = Math.floor(x / 8);
  const ty = Math.floor(y / 8);
  const lx = ((x % 8) + 8) % 8;
  const ly = ((y % 8) + 8) % 8;
  if (lx === 0 || ly === 0) {
    px.r = MORTAR_PALE;
    px.i = 2.4;
    px.h = 0.38;
    return;
  }
  const t = hash2(tx, ty, 441);
  const worn = Math.hypot(lx - 4, ly - 4) < 2.5 ? 0.3 : 0;
  px.r = TERRA;
  px.i = 3.4 + (t - 0.5) * 1.6 + worn + (lx === 1 || ly === 1 ? 0.6 : 0) + (lx === 7 || ly === 7 ? -0.6 : 0) + (hash2(x, y, 443) - 0.5) * 0.5;
  // A chipped corner.
  if (hash2(tx, ty, 445) > 0.86 && lx + ly < 3) px.i = 1.6;
  px.h = 0.42;
}

function ashlar(x: number, y: number): void {
  const row = Math.floor(y / 8);
  const ly = y - row * 8;
  const off = Math.floor(hash2(row, 0, 451) * 20);
  const len = 12 + Math.floor(hash2(row, 1, 451) * 3) * 4;
  const seg = Math.floor((x + off) / len);
  const lx = x + off - seg * len;
  px.r = ASHLAR;
  px.h = 0.42;
  if (ly === 7 || lx === 0) {
    px.i = 0.8;
    px.h = 0.38;
    return;
  }
  const t = hash2(row, seg, 453);
  const crack = Math.abs(fbm(x, y, 7, 455, 2) - 0.5) < 0.01;
  px.i = 3.2 + (t - 0.5) * 1.8 + (ly === 0 ? 0.6 : 0) + (lx === 1 ? 0.3 : 0) + (valueNoise(x, y, 3, 457) - 0.5) * 0.7 - (crack ? 1.4 : 0);
}

/** Paint floor `k` (1-based, as the layout stores it) at plot pixel (x, y), `edge` px from where it meets another. */
function paint(k: number, x: number, y: number, edge: number): void {
  switch (FLOORS[k - 1].id) {
    case 'lawn':
      return lawn(x, y);
    case 'meadow':
      return meadow(x, y);
    case 'soil':
      return soil(x, y, edge);
    case 'path':
      return path(x, y, edge);
    case 'gravel':
      return gravel(x, y, edge);
    case 'sand':
      return sand(x, y, edge);
    case 'pond':
      return pond(x, y, edge);
    case 'cobble':
      return cobble(x, y);
    case 'flags':
      return flags(x, y);
    case 'bricks':
      return bricks(x, y);
    case 'oak':
      return boards(x, y, OAK, 461, 4);
    case 'walnut':
      return boards(x, y, WALNUT, 471, 5);
    case 'marble':
      return marble(x, y);
    case 'terracotta':
      return terracotta(x, y);
    default:
      return ashlar(x, y);
  }
}

// ---------------------------------------------------------------- Which floor a pixel is

const SOFT = FLOORS.map((f) => !!f.soft);
const PONDS = FLOORS.map((f) => !!f.water);

/**
 * The floor at plot pixel (x, y). Inside a laid floor's cell, that floor.
 * Elsewhere the soft floors (and bare lawn) of the four nearest cells blend:
 * each one's share is how much of the pixel's surroundings it covers, eased,
 * with a ragged edge of noise. So a lone pond cell is a round pool, a path
 * wanders a little, and corners are rounded. Laid floors count as the cell's
 * own floor here, so a path runs right up to the cobbles beside it.
 */
function floorAt(l: HomeLayout, x: number, y: number): number {
  const ox = Math.floor(x / CELL);
  const oy = Math.floor(y / CELL);
  const own = l.floorAt(ox, oy);
  if (own && !SOFT[own - 1]) return own;
  const fx = x / CELL - 0.5;
  const fy = y / CELL - 0.5;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  let tx = fx - ix;
  let ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx);
  ty = ty * ty * (3 - 2 * ty);
  const k = [0, 0, 0, 0];
  const w = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
  for (let j = 0; j < 4; j++) {
    const cx = ix + (j & 1);
    const cy = iy + (j >> 1);
    // Off the plot counts as bare lawn; a laid floor, or a wall, as this cell's own.
    const f = inPlot(cx, cy) ? l.floor[cellIndex(cx, cy)] : 0;
    k[j] = f && !SOFT[f - 1] ? own : f;
  }
  if (k[0] === k[1] && k[1] === k[2] && k[2] === k[3]) return k[0];
  let best = own;
  let bestV = -1;
  for (let j = 0; j < 4; j++) {
    const kind = k[j];
    if (j > 0 && k.indexOf(kind) < j) continue;
    let v = 0;
    for (let m = 0; m < 4; m++) if (k[m] === kind) v += w[m];
    // Each floor's edge frays in its own way; the pond's stays smooth and round.
    const fray = kind && PONDS[kind - 1] ? 0.12 : 0.3;
    v += (valueNoise(x, y, 5, 491 + kind * 7) - 0.5) * fray + (hash2(x, y, 493 + kind) - 0.5) * (kind && PONDS[kind - 1] ? 0.02 : 0.1);
    if (kind === own) v += 0.02;
    if (v > bestV) {
      bestV = v;
      best = kind;
    }
  }
  return best;
}

// ---------------------------------------------------------------- A patch

/** A patch of floor, `w` x `h` at plot pixel (x, y): day and night colours sharing one normal map. */
export interface FloorPatch {
  x: number;
  y: number;
  w: number;
  h: number;
  day: Uint8ClampedArray<ArrayBuffer>;
  night: Uint8ClampedArray<ArrayBuffer>;
  normal: Uint8ClampedArray<ArrayBuffer>;
  /** Anything drawn at all (a floor, or the shade of a wall on the lawn). */
  any: boolean;
}

/** Margin painted round a patch so its normals, shadows and edges match its neighbours'. */
const M = 8;
/** How far a wall's shade reaches over the floor at its foot. */
const WALL_SHADE = 4;

/** Two-pass chamfer distance: 0 at the seeds, growing outward, capped at `cap`. */
function chamfer(d: Float32Array, W: number, H: number, cap: number): void {
  const D = Math.SQRT2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = d[i];
      if (v === 0) continue;
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - W] + 1);
        if (x > 0) v = Math.min(v, d[i - W - 1] + D);
        if (x < W - 1) v = Math.min(v, d[i - W + 1] + D);
      }
      d[i] = v;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = d[i];
      if (v === 0) continue;
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + 1);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + D);
        if (x > 0) v = Math.min(v, d[i + W - 1] + D);
      }
      d[i] = Math.min(v, cap);
    }
  }
}

/** Paint the floors of plot pixels [x, x + w) x [y, y + h). */
export function paintFloors(l: HomeLayout, x0: number, y0: number, w: number, h: number): FloorPatch {
  const W = w + M * 2;
  const H = h + M * 2;
  const n = W * H;
  const kind = new Uint8Array(n);
  let anyFloor = false;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = floorAt(l, x0 - M + x, y0 - M + y);
      kind[y * W + x] = k;
      if (k) anyFloor = true;
    }
  }

  // Walls' footprints, for the shade at their feet.
  const wallD = new Float32Array(n).fill(WALL_SHADE);
  let anyWall = false;
  const c0 = Math.floor((x0 - M) / CELL) - 1;
  const c1 = Math.floor((x0 + w + M) / CELL) + 1;
  const r0 = Math.floor((y0 - M) / CELL) - 1;
  const r1 = Math.floor((y0 + h + M) / CELL) + 1;
  for (let cy = Math.max(0, r0); cy <= Math.min(ROWS - 1, r1); cy++) {
    for (let cx = Math.max(0, c0); cx <= Math.min(COLS - 1, c1); cx++) {
      const v = l.wall[cellIndex(cx, cy)];
      if (!v) continue;
      for (const b of wallBoxes(l.wallMask(cx, cy), WALLS[wallMat(v)].thick)) {
        for (let y = cy * CELL + b.y0; y < cy * CELL + b.y1; y++) {
          for (let x = cx * CELL + b.x0; x < cx * CELL + b.x1; x++) {
            const lx = x - x0 + M;
            const ly = y - y0 + M;
            if (lx < 0 || ly < 0 || lx >= W || ly >= H) continue;
            wallD[ly * W + lx] = 0;
            anyWall = true;
          }
        }
      }
    }
  }
  const out = {
    x: x0,
    y: y0,
    w,
    h,
    day: new Uint8ClampedArray(w * h * 4),
    night: new Uint8ClampedArray(w * h * 4),
    normal: new Uint8ClampedArray(w * h * 4),
    any: anyFloor || anyWall,
  };
  if (!out.any) return out;
  if (anyWall) chamfer(wallD, W, H, WALL_SHADE);

  // How far each pixel is from where its floor meets another.
  const edge = new Float32Array(n).fill(8);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const k = kind[i];
      if ((x > 0 && kind[i - 1] !== k) || (x < W - 1 && kind[i + 1] !== k) || (y > 0 && kind[i - W] !== k) || (y < H - 1 && kind[i + W] !== k)) edge[i] = 0;
    }
  }
  chamfer(edge, W, H, 8);

  // Each floor's own texture and height.
  const ramps: RGB[][] = [];
  const rampOf = new Uint8Array(n);
  const idx = new Float32Array(n);
  const height = new Float32Array(n).fill(LAWN_H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const k = kind[i];
      if (!k) continue;
      paint(k, x0 - M + x, y0 - M + y, edge[i]);
      let r = ramps.indexOf(px.r);
      if (r < 0) r = ramps.push(px.r) - 1;
      rampOf[i] = r;
      idx[i] = px.i;
      height[i] = px.h;
    }
  }

  // Light: normals from the heights, shadows cast by what stands higher toward the sun, shade at the walls' feet.
  const L = KEY_LIGHT;
  const Ll = Math.hypot(L.x, L.y, L.z);
  const flat = L.z / Ll;
  const SLOPE = 5;
  for (let y = M; y < M + h; y++) {
    for (let x = M; x < M + w; x++) {
      const i = y * W + x;
      const o = ((y - M) * w + (x - M)) * 4;
      const k = kind[i];
      const wd = wallD[i];
      if (!k) {
        // Bare lawn: only the shade of a wall, in the night layer (which always shows under the day one).
        if (wd < WALL_SHADE) {
          const a = (1 - wd / WALL_SHADE) ** 1.5 * 0.42;
          out.night[o + 3] = Math.round(a * 255);
          out.normal[o] = 128;
          out.normal[o + 1] = 128;
          out.normal[o + 2] = 255;
          out.normal[o + 3] = 255;
        }
        continue;
      }
      const hx = (height[i - 1] - height[i + 1]) * SLOPE;
      const hy = (height[i + W] - height[i - W]) * SLOPE;
      const nl = Math.hypot(hx, hy, 1);
      const nx = hx / nl;
      const ny = hy / nl;
      const nz = 1 / nl;
      let t = idx[i] + ((nx * L.x + ny * L.y + nz * L.z) / Ll - flat) * 3;
      // Cast shadow: anything toward the sun (up and left) standing higher than the fall of its shadow.
      let cast = 0;
      for (let d = 1; d <= 4; d++) cast = Math.max(cast, height[i - d * W - d] - height[i] - d * 0.05);
      t -= Math.min(1.6, cast * 7);
      if (wd < WALL_SHADE) t -= (1 - wd / WALL_SHADE) * 1.8;
      const r = ramps[rampOf[i]];
      const c = r[Math.max(0, Math.min(r.length - 1, Math.floor(t + bayer(x, y) * 0.7 + 0.15)))];
      const nc = nightify(c);
      out.day[o] = c[0];
      out.day[o + 1] = c[1];
      out.day[o + 2] = c[2];
      out.day[o + 3] = 255;
      out.night[o] = nc[0];
      out.night[o + 1] = nc[1];
      out.night[o + 2] = nc[2];
      out.night[o + 3] = 255;
      out.normal[o] = Math.round(nx * 127.5 + 127.5);
      out.normal[o + 1] = Math.round(ny * 127.5 + 127.5);
      out.normal[o + 2] = Math.round(nz * 127.5 + 127.5);
      out.normal[o + 3] = 255;
    }
  }
  return out;
}

/** A floor's sample for the build palette: a patch of it `size` px square, in daylight. */
export function floorSwatch(id: string, size: number): Uint8ClampedArray<ArrayBuffer> {
  const l = new HomeLayout();
  const k = floorIndex(id);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) l.floor[cellIndex(x, y)] = k;
  const o = Math.round(CELL * 2 - size / 2);
  return paintFloors(l, o, o, size, size).day;
}
