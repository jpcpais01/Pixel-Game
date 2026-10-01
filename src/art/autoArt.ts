// Art for Auto Battle: the sky the arena floats in, the floating stone dais
// of the board, the bench dock, the shop's cards, and the small icons (trait
// badges, coin, heart, stars). All flat painted pixels, cached by key.

import Phaser from 'phaser';
import { Bitmap, bayer, clamp01, mix } from './bitmap';
import { hex, type RGB } from './pixel';
import type { TraitId } from '../game/auto/units';

/** A board cell's size in art pixels (wide, and deep as seen from above). */
export const CELL_W = 24;
export const CELL_H = 15;
/** The carved rim round the tiles, and the stone face below the front edge. */
export const RIM = 5;
export const FACE = 7;
/** How far the rock under the dais hangs. */
const UNDER = 30;
export const BENCH_SLOT = 21;

const hash = (x: number, y: number, s = 0): number => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Smooth value noise, 0..1. */
function noise(x: number, y: number, s = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const fbm = (x: number, y: number, s = 0): number => noise(x, y, s) * 0.55 + noise(x * 2.1, y * 2.1, s + 7) * 0.3 + noise(x * 4.3, y * 4.3, s + 13) * 0.15;

/** Pick between colours in steps with an ordered dither, so gradients band like pixel art. */
function ramp(cols: RGB[], t: number, x: number, y: number): RGB {
  const f = clamp01(t) * (cols.length - 1);
  const i = Math.floor(f);
  if (i >= cols.length - 1) return cols[cols.length - 1];
  return f - i > bayer(x, y) ? cols[i + 1] : cols[i];
}

function add(scene: Phaser.Scene, key: string, b: Bitmap): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

const SKY: RGB[] = ['#07061a', '#0d0a26', '#161036', '#221748', '#33205a', '#4a2a68', '#6a3670', '#8e4a72', '#b8646a', '#e08a64'].map(hex);
const CLOUD: RGB[] = ['#1a1236', '#2a1c4a', '#3c2a5e', '#56386e', '#7a4c7a', '#a86a82'].map(hex);

/**
 * The sky the arena hangs in, `w` x `h`: night deepening overhead, a warm
 * dusk low down, stars, a pale moon, far floating islands, and a sea of
 * cloud below the horizon.
 */
export function autoBackdrop(scene: Phaser.Scene, w: number, h: number): string {
  const key = `ab_sky_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(w, h);
  const horizon = Math.round(h * 0.62);
  const moon = { x: Math.round(w * 0.82), y: Math.round(h * 0.2), r: Math.max(9, Math.round(h * 0.055)) };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Sky: the glow gathers toward the horizon and the moon.
      const t = Math.pow(clamp01(y / horizon), 1.6);
      const md = Math.hypot(x - moon.x, (y - moon.y) * 1.1);
      const halo = clamp01(1 - md / (moon.r * 5)) * 0.18;
      let c = ramp(SKY, t * 0.95 + halo, x, y);
      // Wisps of high cloud drifting across the dusk.
      const wisp = fbm(x / 60, y / 9, 3);
      if (y < horizon && wisp > 0.62 && t > 0.25) c = mix(c, hex('#c87a8a'), (wisp - 0.62) * 1.6 * t);
      b.set(x, y, c);
    }
  }
  // Stars: brighter and more of them overhead, a few twinkle-crosses.
  for (let i = 0; i < (w * h) / 180; i++) {
    const x = Math.floor(hash(i, 1, 5) * w);
    const y = Math.floor(Math.pow(hash(i, 2, 5), 1.8) * horizon * 0.85);
    const lum = hash(i, 3, 5);
    const col = lum > 0.85 ? hex('#fff4d6') : lum > 0.5 ? hex('#b8c0ff') : hex('#6a6aa8');
    b.set(x, y, col);
    if (lum > 0.95) {
      const dim = mix(col, hex('#2a2150'), 0.5);
      b.set(x + 1, y, dim);
      b.set(x - 1, y, dim);
      b.set(x, y + 1, dim);
      b.set(x, y - 1, dim);
    }
  }
  // The moon: a lit disc with soft maria, shaded on its lower left.
  for (let y = -moon.r; y <= moon.r; y++) {
    for (let x = -moon.r; x <= moon.r; x++) {
      const d = Math.hypot(x, y) / moon.r;
      if (d > 1) continue;
      const lit = clamp01(0.95 - (-x * 0.35 + y * 0.45) / moon.r - d * 0.2);
      const mare = fbm((x + 40) / 5, (y + 40) / 5, 9) > 0.58 ? 0.18 : 0;
      b.set(moon.x + x, moon.y + y, ramp(['#8a86b8', '#b8b4d8', '#dcd8ee', '#f4f0ff'].map(hex), lit - mare, x, y));
    }
  }
  // Far islands on the horizon, dark against the dusk, with a lit rim.
  const islands = [
    { x: 0.1, y: 0.5, s: 0.1 },
    { x: 0.27, y: 0.56, s: 0.05 },
    { x: 0.66, y: 0.53, s: 0.07 },
    { x: 0.93, y: 0.47, s: 0.09 },
  ];
  islands.forEach((isl, k) => {
    const cx = isl.x * w;
    const top = isl.y * h;
    const half = isl.s * w;
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const u = (x - cx) / half;
      const edge = Math.sqrt(Math.max(0, 1 - u * u));
      const bump = (fbm(x / 7, k, 11) - 0.5) * 4;
      const y0 = Math.round(top - edge * 3 + bump);
      const depth = edge * half * 0.55 * (0.7 + fbm(x / 5, k, 12) * 0.6);
      for (let y = y0; y < top + depth; y++) {
        const shade = (y - y0) / Math.max(1, top + depth - y0);
        b.set(x, y, y === y0 ? hex('#c0708a') : mix(hex('#2a1a44'), hex('#150e2a'), shade));
      }
      // A tree or ruin now and then on top.
      if (hash(x, k, 14) > 0.9 && edge > 0.4) for (let y = y0 - 1 - Math.floor(hash(x, k, 15) * 4); y < y0; y++) b.set(x, y, hex('#1c1232'));
    }
  });
  // The sea of cloud below: billows with lit tops fading into the deep.
  for (let y = horizon; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = (y - horizon) / (h - horizon);
      const bill = fbm(x / 26, y / 7 - t * 3, 21);
      const lit = clamp01(bill * 1.25 - t * 0.55 + 0.1);
      b.set(x, y, ramp(CLOUD, lit, x, y));
    }
  }
  // The horizon's thin bright seam.
  for (let x = 0; x < w; x++) if (fbm(x / 26, 0, 21) > 0.35) b.set(x, horizon, hex('#e0a0a0'));
  return add(scene, key, b);
}

const STONE: RGB[] = ['#1e1a34', '#2c2748', '#3a3458', '#4a4468', '#5c567a', '#726c90', '#8c86a8'].map(hex);
const ROCK: RGB[] = ['#0f0b1e', '#18122c', '#221a3a', '#2e2448', '#3c3058'].map(hex);

/** The board's texture size. */
export const boardSize = (cols: number, rows: number) => ({ w: cols * CELL_W + RIM * 2, h: rows * CELL_H + RIM * 2 + FACE + UNDER });

/**
 * The floating dais: flagstone tiles in two halves (cool below for the
 * player, warm above for the rival) with a glowing rune seam between, a
 * carved rim, a stone face under the front edge, and rough rock hanging
 * beneath, with a few glowing crystals.
 */
export function autoBoard(scene: Phaser.Scene, cols: number, rows: number): string {
  const key = `ab_board_${cols}x${rows}`;
  if (scene.textures.exists(key)) return key;
  const { w, h } = boardSize(cols, rows);
  const b = new Bitmap(w, h);
  const top = rows * CELL_H + RIM * 2;
  const half = rows / 2;
  // Rim: carved stone, lit along its top and left, shaded on the right.
  for (let y = 0; y < top; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, top - 1 - y);
      if (ex >= RIM && ey >= RIM) continue;
      const n = fbm(x / 3, y / 3, 31);
      let v = 0.5 + (n - 0.5) * 0.4;
      if (y === 0 || x === 0) v = 0.9;
      else if (x === w - 1 || y === top - 1) v = 0.15;
      else if (ex === RIM - 1 || ey === RIM - 1) v = 0.25; // the inner lip, in shadow
      else if (y === 1) v = 0.72;
      // Blocks: a mortar joint every so often round the rim.
      if ((ey < RIM && (x + 3) % 16 === 0) || (ex < RIM && (y + 5) % 12 === 0)) v = 0.2;
      b.set(x, y, ramp(STONE, v, x, y));
    }
  }
  // Corner caps: square studs of brighter stone with a rune spark.
  for (const [cx, cy] of [
    [0, 0],
    [w - 9, 0],
    [0, top - 9],
    [w - 9, top - 9],
  ]) {
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 9; x++) {
        const edge = x === 0 || y === 0 ? 0.95 : x === 8 || y === 8 ? 0.1 : 0.62 - (x + y) * 0.015;
        b.set(cx + x, cy + y, ramp(STONE, edge, x, y));
      }
    b.set(cx + 4, cy + 4, hex('#ffe08a'));
    b.set(cx + 3, cy + 4, hex('#b8742c'));
    b.set(cx + 5, cy + 4, hex('#b8742c'));
  }
  // Tiles.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const mine = r >= half;
      const base = (c + r) % 2 === 0 ? 0.5 : 0.42;
      const tint = mine ? hex('#3a5a9a') : hex('#8a3a4a');
      const x0 = RIM + c * CELL_W;
      const y0 = RIM + r * CELL_H;
      const worn = hash(c, r, 40);
      for (let y = 0; y < CELL_H; y++) {
        for (let x = 0; x < CELL_W; x++) {
          const px = x0 + x;
          const py = y0 + y;
          let v = base + (fbm(px / 5, py / 4, 33) - 0.5) * 0.28;
          if (x === 0 || y === 0) v = 0.14; // mortar
          else if (y === 1 || x === 1) v += 0.14; // lit edge
          else if (x === CELL_W - 1 || y === CELL_H - 1) v -= 0.12; // shade edge
          // Cracks on worn stones.
          if (worn > 0.7 && Math.abs(x - 6 - y * 0.8 - worn * 6) < 0.6 && y > 2 && y < CELL_H - 3) v -= 0.18;
          let col = ramp(STONE, v, px, py);
          col = mix(col, tint, 0.16);
          // Moss creeping in at a few joints.
          if ((x < 3 || y < 3) && fbm(px / 3, py / 3, 35) > 0.72) col = mix(col, hex('#3a6a4a'), 0.55);
          b.set(px, py, col);
        }
      }
      // A faint carved rune in the middle of the back rows of each half.
      if ((r === 0 || r === rows - 1) && c % 2 === 1) {
        const rx = x0 + 12;
        const ry = y0 + 7;
        const rc = mix(tint, hex('#fff4d6'), 0.3);
        for (const [dx, dy] of [
          [0, -3],
          [0, -2],
          [0, -1],
          [0, 0],
          [0, 1],
          [0, 2],
          [-2, -1],
          [-1, 0],
          [1, 0],
          [2, -1],
          [-1, 2],
          [1, 2],
        ])
          b.set(rx + dx, ry + dy, mix(rc, hex('#1e1a34'), 0.45));
      }
    }
  }
  // The seam between halves: a gold rune line.
  const sy = RIM + half * CELL_H;
  for (let x = RIM; x < w - RIM; x++) {
    b.set(x, sy, hex(x % 6 === 0 ? '#fff4d6' : '#ffc94a'));
    b.set(x, sy - 1, hex('#8a5a2a'));
  }
  // The face under the front edge: dressed blocks, darker going down.
  for (let y = top; y < top + FACE; y++) {
    for (let x = 0; x < w; x++) {
      const t = (y - top) / FACE;
      let v = 0.42 - t * 0.28 + (fbm(x / 4, y / 2, 37) - 0.5) * 0.15;
      if ((x + (y - top < 4 ? 0 : 8)) % 16 === 0) v = 0.1;
      if (y === top + 3) v = Math.min(v, 0.18);
      if (x === 0 || x === w - 1) v = 0.08;
      b.set(x, y, ramp(STONE, v, x, y));
    }
  }
  // Rock hanging beneath: jagged, tapering to a point, darker at depth.
  const under = top + FACE;
  for (let x = 0; x < w; x++) {
    const u = (x - w / 2) / (w / 2);
    const depth = (1 - u * u) * UNDER * (0.75 + fbm(x / 6, 0, 41) * 0.5);
    for (let y = under; y < under + depth; y++) {
      const t = (y - under) / UNDER;
      const v = 0.8 - t * 0.9 + (fbm(x / 4, y / 4, 43) - 0.5) * 0.5 - Math.abs(u) * 0.2;
      b.set(x, y, ramp(ROCK, v, x, y));
    }
  }
  // Glowing crystals in the rock.
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(w * (0.12 + hash(i, 0, 47) * 0.76));
    const u = (x - w / 2) / (w / 2);
    const y = Math.floor(under + 3 + hash(i, 1, 47) * (1 - u * u) * UNDER * 0.6);
    const col = hash(i, 2, 47) > 0.5 ? ['#bff4ff', '#6fd4f0', '#2a86b8'] : ['#ffd0f4', '#d070e0', '#6a2a9a'];
    for (let k = 0; k < 4; k++) {
      b.set(x, y + k, hex(col[Math.min(2, k)]));
      if (k > 0 && k < 3) b.set(x + 1, y + k + 1, hex(col[2]));
    }
  }
  return add(scene, key, b);
}

const WOOD: RGB[] = ['#1e120e', '#3a2418', '#5a3a24', '#7a5030', '#9a6a3e', '#b8864e'].map(hex);

/** The bench: a wooden dock of `cols` x `rows` slots, planks with iron studs. */
export function autoBench(scene: Phaser.Scene, cols: number, rows = 1): string {
  const key = `ab_bench_${cols}x${rows}`;
  if (scene.textures.exists(key)) return key;
  const w = cols * BENCH_SLOT + 6;
  const h = rows * BENCH_SLOT + 6;
  const b = new Bitmap(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      if (edge && (x === 0 || x === w - 1) && (y === 0 || y === h - 1)) continue;
      const grain = fbm(x / 14, y / 1.5, 51);
      let v = 0.45 + (grain - 0.5) * 0.5;
      if (edge) v = 0.02;
      else if (y === 1) v = 0.85;
      else if (y === h - 2 || x === w - 2) v = 0.12;
      else if ((y - 2) % 6 === 5) v = 0.15; // plank joints
      b.set(x, y, ramp(WOOD, v, x, y));
    }
  }
  // Slots: sunken squares, each with a faint ring.
  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x0 = 3 + col * BENCH_SLOT + 1;
    const y0 = 3 + row * BENCH_SLOT + 1;
    const s = BENCH_SLOT - 2;
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const d = Math.hypot(x - s / 2 + 0.5, (y - s / 2 + 0.5) * 1.4);
        let v = 0.2 + (fbm((x0 + x) / 10, (y0 + y) / 2, 53) - 0.5) * 0.2;
        if (y === 0 || x === 0) v = 0.05;
        else if (y === s - 1 || x === s - 1) v = 0.5;
        if (Math.abs(d - 6.5) < 0.6 && y > s / 2 - 2) v += 0.2;
        b.set(x0 + x, y0 + y, ramp(WOOD, v, x0 + x, y0 + y));
      }
    // Iron studs between slots, along the dock's edges.
    if (col > 0 && row === 0) b.set(x0 - 1, 2, hex('#b8b4d8'));
    if (col > 0 && row === rows - 1) b.set(x0 - 1, h - 3, hex('#6a6488'));
    if (row > 0 && col === 0) b.set(2, y0 - 1, hex('#b8b4d8'));
    if (row > 0 && col === cols - 1) b.set(w - 3, y0 - 1, hex('#6a6488'));
  }
  return add(scene, key, b);
}

/** Small icons: a coin, a heart, a star pip (lit and dim), an XP pip, a lock. */
export function autoIcons(scene: Phaser.Scene): void {
  if (scene.textures.exists('ab_coin')) return;
  const draw = (key: string, rows: string[], pal: Record<string, string>) => {
    const b = new Bitmap(rows[0].length, rows.length);
    rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && b.set(x, y, hex(pal[ch]))));
    add(scene, key, b);
  };
  draw('ab_coin', ['.kkkk.', 'kyyyok', 'kywyok', 'kyyyok', 'kyoook', '.kkkk.'], { k: '#3a2410', y: '#ffd35c', w: '#fff8d0', o: '#c07f30' });
  draw('ab_heart', ['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'], { k: '#2a0a14', r: '#ff4a5a', w: '#ffc0c8' });
  draw('ab_star', ['..k..', '.kyk.', 'kyyyk', '.kyk.', 'k.k.k'], { k: '#3a2410', y: '#ffe08a' });
  draw('ab_star2', ['..k..', '.kyk.', 'kyyyk', '.kyk.', 'k.k.k'], { k: '#10183a', y: '#dce8ff' });
  draw('ab_star3', ['..k..', '.kyk.', 'kyyyk', '.kyk.', 'k.k.k'], { k: '#3a1010', y: '#ffb04a' });
  // The shop's freeze: a padlock, open and grey, or shut and rimed with frost.
  draw('ab_lock_open', ['..kkk..', '.k...k.', '.k.....', '.k.....', 'kkkkkkk', 'kgggggk', 'kgg.ggk', 'kgggggk', 'kkkkkkk'], { k: '#1a1430', g: '#8a80b8' });
  draw('ab_lock', ['..kkk..', '.kwwwk.', '.kw.wk.', '.kw.wk.', 'kkkkkkk', 'kbwbbbk', 'kbb.bbk', 'kbbbbwk', 'kkkkkkk'], { k: '#0e2440', w: '#e8f8ff', b: '#6fc8ff' });
  draw('ab_sword', ['....kw', '...kwk', 'k.kwk.', '.kwk..', '.kk...', 'k..k..'], { k: '#1a1430', w: '#e8e8f4' });
}

/** Trait badges, 9x9 each, painted in their trait's colour on a dark hexagon. */
const TRAIT_MARKS: Record<TraitId, string[]> = {
  arcane: ['...#...', '..###..', '#######', '.#####.', '..#.#..', '.#...#.', '.......'],
  order: ['.#####.', '.#.#.#.', '.#####.', '.#.#.#.', '..###..', '...#...', '.......'],
  shadow: ['..###..', '.##....', '##.....', '##.....', '.##....', '..###..', '.......'],
  wild: ['...#...', '..###..', '.#.#.#.', '...#...', '.#.#.#.', '...#...', '...#...'],
  forged: ['.#.#.#.', '#######', '.#...#.', '##.#.##', '.#...#.', '#######', '.#.#.#.'],
  show: ['...###.', '...#.#.', '...#.#.', '...#.#.', '.###.#.', '####...', '.##....'],
  blade: ['......#', '.....#.', '....#..', '.#.#...', '..#....', '.#.#...', '#......'],
  tank: ['#######', '#.....#', '#.###.#', '#.###.#', '.#...#.', '..#.#..', '...#...'],
  melee: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '.......'],
  ranged: ['...#...', '..#.#..', '.#...#.', '###.###', '.#...#.', '..#.#..', '...#...'],
  caster: ['..###..', '.#...#.', '#..#..#', '#.###.#', '#..#..#', '.#...#.', '..###..'],
};

export function traitIcons(scene: Phaser.Scene, colors: Record<TraitId, number>): void {
  for (const [id, mark] of Object.entries(TRAIT_MARKS) as [TraitId, string[]][]) {
    for (const on of [true, false]) {
      const key = `ab_trait_${id}${on ? '' : '_off'}`;
      if (scene.textures.exists(key)) continue;
      const b = new Bitmap(9, 9);
      const c = colors[id];
      const col: RGB = on ? [(c >> 16) & 255, (c >> 8) & 255, c & 255] : hex('#6a6488');
      const dark = on ? mix(col, hex('#0b0818'), 0.78) : hex('#1a1430');
      for (let y = 0; y < 9; y++)
        for (let x = 0; x < 9; x++) {
          // A hexagon-ish badge: corners cut.
          const cut = (x + y < 2) || (8 - x + y < 2) || (x + 8 - y < 2) || (16 - x - y < 2);
          if (cut) continue;
          const rimmed = x === 0 || y === 0 || x === 8 || y === 8 || x + y === 2 || 8 - x + y === 2 || x + 8 - y === 2 || 16 - x - y === 2;
          b.set(x, y, rimmed ? mix(col, hex('#0b0818'), on ? 0.35 : 0.2) : dark);
        }
      mark.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && b.set(x + 1, y + 1, x + y < 4 && on ? mix(col, hex('#ffffff'), 0.35) : col)));
      add(scene, key, b);
    }
  }
}
