// Heaven Lands' app icon: a little floating island with a cottage and a
// round tree, hanging in a dawn sky (lilac at the top warming through rose
// and peach to gold), a pale sun behind it and a cloud drifting under its
// rocky tip. The island is drawn once on its own small grid and laid in the
// middle of every icon; the sky is drawn per size. Everything is scaled up by
// a whole number, so every icon keeps crisp square pixels, and the island
// stays readable at 32 px.

import { hex, type RGB } from '../../art/pixel';

export interface IconSpec {
  /** Output file name. */
  name: string;
  /** Output size in real pixels. */
  size: number;
  /** Logical grid size; size must be a multiple of it. */
  grid: number;
  /** 'rounded' cuts pixel-stepped corners; 'full' bleeds to the edge (maskable, iOS). */
  shape: 'rounded' | 'full';
  purpose: 'any' | 'maskable';
}

export const ICONS: IconSpec[] = [
  { name: 'icon-512.png', size: 512, grid: 32, shape: 'rounded', purpose: 'any' },
  { name: 'icon-192.png', size: 192, grid: 32, shape: 'rounded', purpose: 'any' },
  // Maskable icons get a wider grid, so the same island sits well inside the
  // safe circle (the centre 80% of the width) with sky all round it.
  { name: 'maskable-480.png', size: 480, grid: 40, shape: 'full', purpose: 'maskable' },
  { name: 'maskable-200.png', size: 200, grid: 40, shape: 'full', purpose: 'maskable' },
  { name: 'apple-touch-icon.png', size: 180, grid: 36, shape: 'full', purpose: 'any' },
  { name: 'favicon-32.png', size: 32, grid: 32, shape: 'rounded', purpose: 'any' },
];

/** The island's own grid, outline included. */
const ISLE = 26;
/** Where the island's grass ellipse sits on its grid, and its size. */
const TOP_Y = 14;
const TOP_RX = 10.5;
const TOP_RY = 3;
/** How far the rocky underside hangs below the grass. */
const ROOT_DEPTH = 10;

// Dawn sky, top to bottom.
const SKY = ['#a99ad8', '#bfa2dc', '#d6a8d6', '#eab0cc', '#f8bcc0', '#ffc8b2', '#ffd6aa', '#ffe4a8'].map(hex);
const SUN = [hex('#fffbe8'), hex('#fff0b8'), hex('#ffe29a')];
const GLOW = hex('#fff4d0');
const RIM = hex('#fff2e2');
const EDGE = hex('#4a2850');
const INK = hex('#4a2850');

const C: Record<string, RGB> = {
  G: hex('#b4ec84'), // grass, sunlit
  g: hex('#7fcc62'),
  d: hex('#4f9e52'), // grass in shade, the lip
  E: hex('#d9a070'), // earth, lit
  e: hex('#ad6e50'),
  r: hex('#7c4a48'),
  k: hex('#583448'), // the deepest rock, at the tip
  s: hex('#c8b4c8'), // a pale stone in the earth
  W: hex('#fff3e0'), // cottage walls
  w: hex('#e9c8aa'),
  P: hex('#f78a96'), // roof, lit
  p: hex('#cf5872'),
  q: hex('#a2405e'), // the roof's eave shadow
  D: hex('#8a5240'), // door
  Y: hex('#ffd65e'), // a lit window
  c: hex('#b8949e'), // chimney
  T: hex('#9ee070'), // tree crown, lit
  t: hex('#5fb85a'),
  u: hex('#3a8a4e'),
  b: hex('#8a5a40'), // trunk
  f: hex('#ff9ec0'), // flowers
  y: hex('#fff1a0'),
};

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// A cloud stamp: 'w' white, 'c' a blush of pink, 'l' its lilac belly.
const CLOUD = [
  '....www......',
  '..wwwwwww.ww.',
  '.wwwwwwwwwwww',
  'cccccccccccc.',
  '.lllllllll...',
];
const WISP = ['..www..', 'wwwwwww', '.lllll.'];

const hash = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const add = (a: RGB, b: RGB, k: number): RGB => [
  Math.min(255, a[0] + b[0] * k),
  Math.min(255, a[1] + b[1] * k),
  Math.min(255, a[2] + b[2] * k),
];

/** Is (x, y) outside a pixel-stepped rounded square of size n? */
function cornerCut(x: number, y: number, n: number, r: number): boolean {
  const cx = x < r ? r - x - 0.5 : x >= n - r ? x - (n - r) + 0.5 : 0;
  const cy = y < r ? r - y - 0.5 : y >= n - r ? y - (n - r) + 0.5 : 0;
  return cx > 0 && cy > 0 && cx * cx + cy * cy > r * r;
}

/** The island with its cottage and tree, as palette letters on an ISLE grid ('' = empty). */
function drawIsland(): string[] {
  const g: string[] = new Array(ISLE * ISLE).fill('');
  const set = (x: number, y: number, k: string) => {
    if (x >= 0 && y >= 0 && x < ISLE && y < ISLE) g[y * ISLE + x] = k;
  };
  const get = (x: number, y: number) => (x >= 0 && y >= 0 && x < ISLE && y < ISLE ? g[y * ISLE + x] : '');
  const cx = ISLE / 2;

  // The rocky underside: a jagged cone, lit from the left, darkening to its tip.
  for (let y = TOP_Y; y <= TOP_Y + ROOT_DEPTH; y++) {
    const k = (y - TOP_Y) / ROOT_DEPTH;
    const half = TOP_RX * Math.pow(1 - k, 1.15) + (hash(y, 1) - 0.5) * 1.2;
    for (let x = Math.floor(cx - half); x < Math.ceil(cx + half); x++) {
      const side = (x + 0.5 - cx) / Math.max(1, half);
      const depth = k + side * 0.25;
      let c = depth < 0.2 ? 'E' : depth < 0.5 ? 'e' : depth < 0.8 ? 'r' : 'k';
      if (c === 'e' && hash(x, y, 7) > 0.86) c = 's';
      set(x, y, c);
    }
  }
  // The grass top, an ellipse, sunlit at the back and shaded at the lip.
  for (let y = TOP_Y - TOP_RY - 1; y <= TOP_Y + TOP_RY; y++) {
    for (let x = 0; x < ISLE; x++) {
      const dx = (x + 0.5 - cx) / TOP_RX;
      const dy = (y + 0.5 - TOP_Y) / TOP_RY;
      if (dx * dx + dy * dy > 1) continue;
      set(x, y, dy < -0.35 ? 'G' : dy < 0.45 ? 'g' : 'd');
    }
  }
  // Tufts of grass hanging over the edge, a pixel or two.
  for (let x = 2; x < ISLE - 2; x++) {
    const y = TOP_Y + TOP_RY + 1;
    if (get(x, y - 1) === 'd' && hash(x, 3) > 0.55) set(x, y, 'd');
  }

  // The round tree on the right: trunk, then a crown lit from the top left.
  const tx = 18;
  for (let y = 9; y <= TOP_Y - 1; y++) set(tx, y, 'b');
  set(tx - 1, TOP_Y - 1, 'b');
  // The crown is three leafy clumps, each lit from the top left, the upper
  // ones laid over the lower so their shaded rims read as layers of leaves.
  const CLUMPS: [number, number, number][] = [
    [tx - 1.6, 7.6, 3.1],
    [tx + 2.1, 7.4, 2.9],
    [tx + 0.3, 4.6, 3.4],
  ];
  for (let y = 0; y < 12; y++) {
    for (let x = tx - 6; x < tx + 7; x++) {
      let shade = '';
      for (const [ccx, ccy, cr] of CLUMPS) {
        const dx = x + 0.5 - ccx;
        const dy = y + 0.5 - ccy;
        if (Math.hypot(dx, dy) > cr) continue;
        const light = (-dx - dy * 1.2) / cr;
        shade = light > 0.45 ? 'T' : light > -0.55 ? 't' : 'u';
      }
      if (shade) set(x, y, shade);
    }
  }
  // A leafy glint or two.
  set(tx - 1, 2, 'G');
  set(tx - 3, 6, 'G');

  // The cottage: cream walls, a pink gabled roof, a warm window and a door.
  const [hx0, hx1, wallTop, ground] = [4, 11, 9, TOP_Y];
  for (let y = wallTop; y < ground; y++) for (let x = hx0; x <= hx1; x++) set(x, y, x >= hx1 - 1 ? 'w' : 'W');
  // Chimney first, so the roof's slope sits in front of its foot.
  for (let y = 3; y <= 6; y++) set(hx1 - 2, y, 'c');
  set(hx1 - 1, 3, 'c');
  for (let y = 4; y <= wallTop; y++) {
    const reach = y - 4;
    for (let x = 7 - reach; x <= 8 + reach; x++) {
      if (x < hx0 - 1 || x > hx1 + 1) continue;
      set(x, y, y === wallTop ? 'q' : x <= 7 ? 'P' : 'p');
    }
  }
  set(7, 4, 'W'); // a sunlit ridge
  set(5, 10, 'Y');
  set(5, 11, 'Y');
  set(9, 10, 'Y');
  set(8, 11, 'D');
  set(8, 12, 'D');
  set(8, 13, 'D');

  // Flowers in the grass.
  set(3, 13, 'f');
  set(13, 12, 'y');
  set(15, 14, 'f');
  set(21, 13, 'y');
  set(12, 15, 'f');

  // Outline everything in plum.
  const solid = g.map((k) => k !== '');
  for (let y = 0; y < ISLE; y++) {
    for (let x = 0; x < ISLE; x++) {
      if (solid[y * ISLE + x]) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const xx = x + dx;
        const yy = y + dy;
        return xx >= 0 && yy >= 0 && xx < ISLE && yy < ISLE && solid[yy * ISLE + xx];
      });
      if (near) g[y * ISLE + x] = 'o';
    }
  }
  return g;
}

/** Render one icon to RGBA at its full output size. */
export function renderIcon(spec: IconSpec): Uint8ClampedArray {
  const n = spec.grid;
  const k = spec.size / n;
  if (!Number.isInteger(k)) throw new Error(`${spec.name}: ${spec.size} is not a multiple of ${n}`);

  const isle = drawIsland();
  // The island sits a pixel above centre, leaving room for the cloud under its tip.
  const ix = Math.floor((n - ISLE) / 2);
  const iy = Math.floor((n - ISLE) / 2) - 1;
  // The sun hangs behind the island's upper left, between cottage and sky.
  const sunX = ix + 4.5;
  const sunY = iy + 4;
  const sunR = 3.6;
  const r = Math.max(3, Math.round(n * 0.16));

  const px = new Uint8ClampedArray(n * n * 4);
  const paint = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    px.set([c[0], c[1], c[2], 255], (y * n + x) * 4);
  };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // Sky: a vertical dawn ramp, ordered dither between palette steps.
      const t = y / (n - 1);
      const level = t * (SKY.length - 1) + (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.9;
      let c: RGB = [...SKY[Math.max(0, Math.min(SKY.length - 1, Math.round(level)))]];
      // The sun and its soft banded glow.
      const d = Math.hypot(x + 0.5 - sunX, y + 0.5 - sunY);
      if (d < sunR) c = [...SUN[d < sunR * 0.45 ? 0 : d < sunR * 0.8 ? 1 : 2]];
      else if (d < sunR + 2) c = add(c, GLOW, 0.32);
      else if (d < sunR + 4.5 && (x + y) % 2 === 0) c = add(c, GLOW, 0.18);
      // A few last stars in the lilac at the very top.
      else if (t < 0.2 && hash(x, y, 5) > 0.975) c = add(c, GLOW, 0.4);
      paint(x, y, c);
    }
  }

  // Clouds: a wisp high on the right, behind; the island; a cloud under its tip, in front.
  const stamp = (art: string[], x0: number, y0: number) => {
    const pal: Record<string, RGB> = { w: hex('#ffffff'), c: hex('#ffe6ea'), l: hex('#dcbde6') };
    art.forEach((row, y) => [...row].forEach((p, x) => p !== '.' && paint(x0 + x, y0 + y, pal[p])));
  };
  stamp(WISP, ix + ISLE - 6, iy + 2);
  for (let y = 0; y < ISLE; y++) {
    for (let x = 0; x < ISLE; x++) {
      const p = isle[y * ISLE + x];
      if (p) paint(ix + x, iy + y, p === 'o' ? INK : C[p]);
    }
  }
  stamp(CLOUD, ix + 2, iy + TOP_Y + ROOT_DEPTH - 2);

  // Frame: a lit rim on the top-left, dark on the bottom-right, corners cut away.
  if (spec.shape === 'rounded') {
    const inside = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < n && yy < n && !cornerCut(xx, yy, n, r);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const o = (y * n + x) * 4;
        if (!inside(x, y)) {
          px.fill(0, o, o + 4);
          continue;
        }
        const edgeTL = !inside(x - 1, y) || !inside(x, y - 1);
        const edgeBR = !inside(x + 1, y) || !inside(x, y + 1);
        if (edgeTL && !edgeBR && x + y < n) paint(x, y, RIM);
        else if (edgeTL || edgeBR) paint(x, y, EDGE);
      }
    }
  }

  // Scale up.
  const S = spec.size;
  const out = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const o = (Math.floor(y / k) * n + Math.floor(x / k)) * 4;
      out.set(px.subarray(o, o + 4), (y * S + x) * 4);
    }
  }
  return out;
}
