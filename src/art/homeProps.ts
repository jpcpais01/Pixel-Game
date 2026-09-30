// Everything a player can place in their Home (see world/homeParts.ts):
// plants and garden pieces, furniture, lights and things hung on walls, each
// drawn from the game's high three-quarter view, lit like the heroes (diffuse,
// normal map and glow) so lamps and the sun play over them.
//
// Every drawing stands on its footprint: a canvas `pad` px wider than the
// footprint on each side and `up` px taller above it, the footprint filling
// its bottom rows. Things with fire flicker through a few frames; the world
// only animates their glow. Trees, bushes, ferns, stumps, the brazier and the
// rune crystal reuse the forest's own art (see art/homeArt.ts).

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { FIRE_COLS, hash2, rng } from './env';
import { canopy, crown, leaner, roots, swayAt, trunk } from './trees';
import { FIELDSTONE, IRON } from './sanctum';
import { CELL } from '../world/homeLayout';
import { partById } from '../world/homeParts';

const ramp = (...c: string[]): RGB[] => c.map(hex);
const mat = (o: string, ...c: string[]): Material => ({ ramp: ramp(...c), outline: hex(o) });

// ---------------------------------------------------------------- Materials

const OAKW = mat('#120904', '#2a170c', '#3d2413', '#52311a', '#6a4122', '#83532c', '#9c6737', '#b57d46', '#cc9458');
const DARKW = mat('#0a0503', '#150b07', '#21120b', '#2f1b10', '#3e2416', '#4f2f1d', '#613b25', '#744830');
const PALEW = mat('#1e140a', '#4a3420', '#634730', '#7e5c3e', '#9a744e', '#b58d60', '#cca674', '#dfbd8a');
const BRASS: Material = { ...mat('#1c1004', '#3a2408', '#5c3c10', '#84581a', '#a87624', '#c89634', '#e2b84e', '#f6dc84'), shine: true };
const STEEL: Material = { ...mat('#0a0c10', '#1a1c24', '#2a2e38', '#3e4450', '#565e6a', '#727a86', '#929aa4', '#b8bec6', '#e0e4ea'), shine: true };
const LINEN = mat('#26262e', '#5a5a66', '#7c7c88', '#a0a0a8', '#c2c0c4', '#dcdad8', '#eeece6', '#faf8f2');
const QUILT_R = mat('#1a0406', '#3a0c10', '#5a1418', '#7c1e20', '#9c2c28', '#b83e32', '#d05a42', '#e27c5a');
const QUILT_B = mat('#060c1a', '#0c1a36', '#132850', '#1c386a', '#284a84', '#365e9c', '#4a76b2', '#6490c6');
const VELVET = mat('#040e0a', '#0a1f16', '#103024', '#174232', '#1f5642', '#296a52', '#378064', '#4c9878');
const GOLD_CLOTH = mat('#241804', '#4a320a', '#6e4c12', '#94681c', '#b88828', '#d4a83e', '#ecc85e');
const PALE_STONE = mat('#18161c', '#3c3a40', '#56525a', '#706b72', '#8a858a', '#a49ea0', '#bdb6b4', '#d4ccc6', '#e8e0d8');
const MOSS: Material = { ...mat('#0a1a0a', '#1c3a1c', '#2a5226', '#3c6c2e', '#56883a', '#72a246'), noOutline: true };
const WATER: Material = { ...mat('#04121a', '#0a2230', '#10323f', '#17454f', '#1f5a62', '#2a7276', '#3a8c8a', '#58aaa2', '#8accc0'), noAO: true };
const LEAF = mat('#08160d', '#10291a', '#173823', '#1f4a2b', '#2b5e33', '#3b753c', '#528d46', '#71a653', '#97c264');
const LEAF_DARK = mat('#061209', '#0c2214', '#12301b', '#1a4224', '#24562e', '#306a38', '#407f44', '#58964e');
const STEM: Material = { ...mat('#0a1808', '#1c3a16', '#2a5220', '#3a6a2a', '#4e8436'), noOutline: true };
const ROSE: Material = { ...mat('#1a0208', '#3a0610', '#620c1a', '#8e1426', '#b82032', '#dc3444', '#f25a60', '#ff8a86'), shine: true };
const TULIP_R = mat('#1a0406', '#4a0a0e', '#781416', '#a41e1c', '#cc3226', '#e8503a', '#f87a5a');
const TULIP_Y = mat('#2a1a04', '#5a3a06', '#8a5e0a', '#b88412', '#dcaa20', '#f2cc40', '#ffe278', '#fff2b4');
const TULIP_P = mat('#240818', '#4a1030', '#761c48', '#a02c62', '#c8467e', '#e46a9a', '#f898ba', '#ffc4d8');
const LAVENDER = mat('#0e0a1c', '#1e1438', '#2e1e56', '#422c74', '#583e92', '#7054ae', '#8c70c8', '#aa92dc');
const SAGE: Material = { ...mat('#0c140e', '#1c2a22', '#2a3c30', '#3a5040', '#4c6450', '#607a62', '#789276'), noOutline: true };
const PETAL_Y = mat('#2a1802', '#5a3204', '#8a5006', '#b87210', '#e09a1c', '#f8c030', '#ffdc5e', '#fff09a');
const SEEDS = mat('#0a0402', '#140a04', '#241408', '#38200e', '#4e3016', '#664020');
const PUMPKIN: Material = { ...mat('#200a02', '#4a1a04', '#6e2806', '#94380a', '#b84c10', '#d6621a', '#ec7c2a', '#f89c48'), shine: true };
const CABBAGE = mat('#0c1a0c', '#1a3418', '#28482a', '#3a603a', '#50784a', '#6a925c', '#88ac72', '#a8c68c', '#c8deaa');
const HAY = mat('#241a08', '#4a3410', '#6a4c18', '#8c6620', '#ac822c', '#c89c3c', '#dcb652', '#ecd070');
const TERRA = mat('#1a0804', '#3a140a', '#5a2010', '#7a3018', '#984222', '#b4562e', '#cc6c3c', '#de8650');
const SOIL = mat('#0a0604', '#1a100a', '#2a1a10', '#3a2618', '#4c3220');
const BURLAP = mat('#1a1208', '#3a2c1a', '#524026', '#6c5634', '#886e44', '#a28656', '#b89e6a');
const DENIM = mat('#0a1020', '#1a2440', '#26345a', '#344674', '#46598c', '#5a6ea2', '#7288b8');
const RED_PAINT: Material = { ...mat('#1a0404', '#3a0808', '#5c0e0e', '#821616', '#a82020', '#c8302a', '#e04a3a', '#f47456'), shine: true };
const GLASS: Material = { ...mat('#060e14', '#10202c', '#1a3242', '#284a5c', '#3c6478', '#588294', '#80a6b4', '#b4d0da', '#e4f2f6'), noAO: true };
const WAX = mat('#2a241a', '#6a5e48', '#8e8266', '#b2a686', '#d0c6a6', '#e8e0c4', '#f8f4e0');
const LILY = mat('#081a0c', '#12301a', '#1a4424', '#245a2c', '#307236', '#428a40', '#5aa24c');
const CATTAIL = mat('#140a04', '#2a1a0c', '#402812', '#58381a', '#704a24');
const BLOSSOM = mat('#26101a', '#4a1a30', '#6e2a48', '#963c62', '#bc5680', '#d8789c', '#ec9cb8', '#f8c0d2', '#ffe2ec');
const CHERRY_BARK = mat('#0c0606', '#1a0e0e', '#2c1816', '#402420', '#56322a', '#6c4236');
const ANTLER = mat('#1a140c', '#4a3e2c', '#6c5e44', '#8e7e60', '#b0a07e', '#ccbe9c', '#e4d8ba');
const SKIN = mat('#1a0e08', '#5a3424', '#7e4c36', '#a0684a', '#be8662', '#d8a47e', '#ecc29c');
const BREW: Material = { ...mat('#041a08', '#0c3a12', '#18642a', '#2c9a3e', '#56c85a', '#9af08a', '#dcffc8'), emissive: 0.8, noAO: true };
const EMBERS: Material = { ...mat('#1a0602', '#4a1204', '#8a2808', '#d0501a', '#ff8a3a', '#ffc070'), emissive: 0.9, noAO: true, noOutline: true };
const SHROOM: Material = { ...mat('#3a0e1a', '#6e1e30', '#9a2e44', '#c4445a', '#e26a72', '#f7948e', '#ffbcae', '#ffe2d4'), emissive: 0.55 };
const SPOTS: Material = { ...mat('#5a4a3a', '#d8c8a8', '#f0e4c8', '#fff6e4', '#fffcf4'), emissive: 0.7, noOutline: true };
const STALK = mat('#2e2418', '#6e5e48', '#9a8a6c', '#bcae90', '#d8ccb0', '#ece4cc', '#f8f2e2');
const LAMP: Material = { ...mat('#3a2008', '#8a5a1a', '#d8a048', '#ffd488', '#fff0c8', '#fffaec'), emissive: 0.95, noAO: true };
const SOOT = mat('#040304', '#0a0808', '#141012', '#1e1a1c', '#2a2428');
const DIAL = mat('#2a2418', '#8a7e64', '#b8ae94', '#d8d0b8', '#eeead8', '#fcfaf0');
const FLAG_RED = mat('#1a0404', '#4a0c0c', '#7a1414', '#a82020', '#d03a2a');
const BOOKS = [
  mat('#140404', '#3a0a0a', '#5c1210', '#801c16', '#a42a1e', '#c23e2a'),
  mat('#04081a', '#0e1a3a', '#16285a', '#223a7a', '#304e98', '#4466b2'),
  mat('#041206', '#0e2a14', '#164020', '#20582c', '#2e7038', '#408a48'),
  mat('#160c04', '#3a2410', '#543618', '#6e4822', '#8a5c2e', '#a6723c'),
  mat('#10061a', '#2a1440', '#3e1e5c', '#542a7a', '#6a3a94', '#8452ae'),
  mat('#1a1204', '#4a3408', '#6e4e0e', '#946a16', '#b88a22', '#d4a834'),
];
const PAINT_SKY = mat('#0c1a2a', '#3a6a9a', '#5a8ab8', '#7aa6cc', '#9cc2dc', '#c4dcea');
const PAINT_HILL = mat('#0a1a0c', '#1e3e1c', '#2e5a28', '#447836', '#5e9646', '#7cb45a');
const PAINT_DARK = mat('#08060a', '#140e16', '#1e1622', '#2a1e2e', '#382a3c');
const BANNER = mat('#04081a', '#0c1638', '#142456', '#1e3474', '#2a4690', '#3a5aaa');

// ---------------------------------------------------------------- Normals and helpers

const n3 = (x: number, y: number, z: number): Vec3 => {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
};
/** Facing the viewer, facing up, and the flat of something lying on the ground. */
const FACE: Vec3 = n3(0, -0.42, 0.9);
const TOP: Vec3 = n3(0, 0.35, 0.94);
const FLOOR: Vec3 = n3(0, 0.12, 0.99);
const EAST: Vec3 = n3(0.75, -0.15, 0.65);
const WEST: Vec3 = n3(-0.75, -0.15, 0.65);

/**
 * A block: ground rect [x0, x1) x [y0, y1), from `z0` to `z1` px up. Its top
 * shows lifted by its height and its front face below that; edges catch the
 * light on the lit side and fall away on the other.
 */
function box(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: Material, o: { top?: Material; bias?: number; topBias?: number } = {}): void {
  c.part();
  const fy0 = y1 - z1;
  const fy1 = y1 - z0;
  for (let y = fy0; y < fy1; y++) {
    for (let x = x0; x < x1; x++) {
      let b = o.bias ?? 0;
      if (x === x0) b += 1;
      if (x === x1 - 1) b -= 1;
      if (y === fy1 - 1 && z0 === 0) b -= 1;
      c.px(x, y, m, FACE, { bias: b });
    }
  }
  const tm = o.top ?? m;
  for (let y = y0 - z1; y < fy0; y++) {
    for (let x = x0; x < x1; x++) {
      let b = o.topBias ?? 0;
      if (y === y0 - z1) b += 1;
      if (y === fy0 - 1) b += 1;
      if (x === x1 - 1) b -= 1;
      c.px(x, y, tm, TOP, { bias: b });
    }
  }
}

/** Wood grain over a drawn area: long streaks a shade darker, the odd knot. */
function grain(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, seed: number, across = true): void {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const a = across ? hash2(Math.floor(x / 5), y, seed) : hash2(x, Math.floor(y / 5), seed);
      if (a > 0.82) c.shade(x, y, -1);
      else if (a < 0.08) c.shade(x, y, 1);
    }
  }
}

/**
 * An upright drum: an ellipse `rx` by `ry` on the ground centred at (cx, gy),
 * standing from `z0` to `z1`: its round side, then its top. `top` null leaves it open.
 */
function drum(c: PixelCanvas, cx: number, gy: number, rx: number, ry: number, z0: number, z1: number, m: Material, top: Material | null = m, o: { bias?: number; topBias?: number } = {}): void {
  c.part();
  for (let x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++) {
    const t = (x + 0.5 - cx) / rx;
    if (Math.abs(t) > 1) continue;
    const e = Math.sqrt(1 - t * t) * ry;
    const ya = Math.round(gy - z1 + e);
    const yb = Math.round(gy - z0 + e);
    for (let y = ya; y < yb; y++) c.px(x, y, m, cyl(t, -0.3), { bias: (o.bias ?? 0) + (y === yb - 1 && z0 === 0 ? -1 : 0) });
  }
  if (!top) return;
  c.part();
  c.ellipse(cx, gy - z1, rx, ry, top, { normal: (_x, _y, dx, dy) => n3(dx * 0.3, 0.4 - dy * 0.25, 0.9), bias: o.topBias ?? 0 });
}

/** Flames of sparks: `hw` wide at the base, `h` tall, swaying with the frame. */
function flame(c: PixelCanvas, cx: number, by: number, hw: number, h: number, f: number, seed: number, a = 1): void {
  const R = rng(seed + f * 31);
  for (let y = Math.floor(by - h); y <= by; y++) {
    const u = (y - (by - h)) / h; // 0 at the tip, 1 at the base
    const w = 0.4 + u * hw;
    const sway = Math.sin(f * 1.7 + y * 0.9 + seed) * (1 - u) * hw * 0.35;
    for (let x = Math.floor(cx - hw - 2); x <= cx + hw + 2; x++) {
      const dx = (x + 0.5 - cx - sway) / w;
      if (Math.abs(dx) > 1) continue;
      const heat = (1 - Math.abs(dx)) * (0.35 + u * 0.85) + (R() - 0.5) * 0.3;
      if (heat < 0.2) continue;
      const col = heat > 0.95 ? FIRE_COLS[0] : heat > 0.7 ? FIRE_COLS[1] : heat > 0.45 ? FIRE_COLS[2] : heat > 0.3 ? FIRE_COLS[3] : FIRE_COLS[4];
      c.spark(x, y, col, a);
    }
  }
}

/** A soft pool of warm light, only in the glow. */
function halo(c: PixelCanvas, cx: number, cy: number, r: number, col: RGB, a: number): void {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d < 1) c.spark(x, y, col, a * (1 - d) * (1 - d));
    }
  }
}

/** A few blades of grass round a base, so things sit in the lawn rather than on it. */
function tufts(c: PixelCanvas, cx: number, by: number, spread: number, seed: number, n = 5): void {
  const R = rng(seed);
  c.part();
  for (let k = 0; k < n; k++) {
    const x = Math.round(cx + (R() - 0.5) * spread * 2);
    const hgt = 1 + Math.floor(R() * 3);
    for (let j = 0; j < hgt; j++) c.px(x + (j === hgt - 1 && R() < 0.5 ? (R() < 0.5 ? -1 : 1) : 0), by - 1 - j, LEAF, n3(0, 0.3, 0.9), { bias: 1 + j });
  }
}

// ---------------------------------------------------------------- The drawings' frames

/** A drawing's footprint inside its canvas. */
interface Foot {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  cx: number;
  cy: number;
}

export interface PropArt {
  /** Canvas size. */
  w: number;
  h: number;
  /** Where the canvas's top-left sits from its footprint's top-left corner. */
  dx: number;
  dy: number;
  frames: number;
  fps: number;
  draw(f: number): PixelCanvas;
}

type Drawer = (c: PixelCanvas, g: Foot, f: number) => void;

function art(id: string, pad: number, up: number, draw: Drawer, frames = 1, fps = 8): PropArt {
  const p = partById(id)!;
  return sized(p.w, p.h, pad, up, draw, frames, fps);
}

/** A drawing over a footprint `fw` x `fh` cells (a turned part's is its own). */
function sized(fw: number, fh: number, pad: number, up: number, draw: Drawer, frames = 1, fps = 8): PropArt {
  const w = fw * CELL + pad * 2;
  const h = up + fh * CELL + 2;
  const g: Foot = { x0: pad, x1: pad + fw * CELL, y0: up, y1: up + fh * CELL, cx: pad + (fw * CELL) / 2, cy: up + (fh * CELL) / 2 };
  return {
    w,
    h,
    dx: -pad,
    dy: -up,
    frames,
    fps,
    draw: (f) => {
      const c = new PixelCanvas(w, h);
      draw(c, g, f);
      return c;
    },
  };
}

/** Wall decorations: 16 x 18, hung on the face of the wall cell they belong to, centred about 16 px up it. */
export const DECOR_W = 16;
export const DECOR_H = 18;
function decor(draw: (c: PixelCanvas, f: number) => void, frames = 1, fps = 8): PropArt {
  return {
    w: DECOR_W,
    h: DECOR_H,
    dx: 0,
    dy: -14,
    frames,
    fps,
    draw: (f) => {
      const c = new PixelCanvas(DECOR_W, DECOR_H);
      draw(c, f);
      return c;
    },
  };
}

// ---------------------------------------------------------------- Garden

/** A cherry tree in bloom, on the forest trees' 96 x 128 frame, petals fallen round its roots; frame `f` of its sway. */
export function blossomTree(v: number, f = 0): PixelCanvas {
  const c = new PixelCanvas(96, 128);
  const R = rng(4100 + v * 37);
  const bx = 48;
  const by = 124;
  const dx = leaner(swayAt(f, 1.3), by - 34, by - 92);
  // Fallen petals first, under everything.
  c.part();
  for (let k = 0; k < 34; k++) {
    const a = R() * Math.PI * 2;
    const d = 6 + R() * 18;
    c.px(bx + Math.cos(a) * d * 1.4, by - 1 + Math.sin(a) * d * 0.4, BLOSSOM, FLOOR, { bias: 1 + Math.floor(R() * 3) });
  }
  const lean = 1.2 + v * 0.4;
  trunk(c, bx, by, 38, 3, CHERRY_BARK, lean);
  // Bands round the bark, as cherries have.
  for (let y = by - 36; y < by - 2; y += 3) for (let x = bx - 3; x < bx + 4; x++) if (hash2(x, y, 88) > 0.4) c.shade(x + Math.round(lean * (1 - (y - by + 38) / 38) ** 2 * 4), y, -1);
  roots(c, bx, by, 7, CHERRY_BARK, R);
  // Crooked boughs spreading wide, as a cherry's do.
  c.part();
  c.capsule(bx + 3, by - 30, bx - 22 + dx(by - 52), by - 52, 2.2, 1, CHERRY_BARK);
  c.capsule(bx + 4, by - 34, bx + 24 + dx(by - 50), by - 50, 2, 1, CHERRY_BARK);
  c.capsule(bx + 4, by - 36, bx + 6 + dx(by - 62), by - 62, 2, 1, CHERRY_BARK);
  crown(c, { cx: bx + 2, cy: by - 68, rx: 36, ry: 24, size: 0.9, ring: 1, gaps: 0.5, leaf: BLOSSOM, twig: CHERRY_BARK, fork: { x: bx + 4, y: by - 34 }, dx, frame: f, R });
  // White flecks of fresh blossom on top, deeper pink in the hollows.
  for (let y = by - 96; y < by - 40; y++) {
    for (let x = bx - 42; x < bx + 46; x++) {
      if (c.materialAt(x, y) !== BLOSSOM) continue;
      const h = hash2(x - Math.round(dx(y)), y, 97 + v);
      if (h > 0.93) c.shade(x, y, 2);
      else if (h < 0.05) c.shade(x, y, -2);
    }
  }
  return c;
}

function rose(c: PixelCanvas, x: number, y: number, m: Material): void {
  c.part();
  c.ellipse(x, y, 1.8, 1.5, m, { flatten: 0.8 });
  c.shade(x, y, -2);
  c.shade(x + 1, y, -1);
  c.px(x - 1, y - 1, m, sphere(-0.5, 0.5), { bias: 2 });
}

const roses = art('roses', 5, 12, (c, g) => {
  const R = rng(1201);
  canopy(c, g.cx, g.y1 - 8, 9, 6.5, 6, LEAF_DARK, R, 0.55);
  const spots: [number, number][] = [];
  for (let k = 0; k < 7; k++) spots.push([g.cx - 7 + R() * 14, g.y1 - 15 + R() * 10]);
  spots.sort((a, b) => a[1] - b[1]);
  for (const [x, y] of spots) rose(c, x, y, ROSE);
  // A couple of buds.
  c.part();
  c.px(g.cx + 6, g.y1 - 14, ROSE, sphere(0, 0.5), { bias: -1 });
  c.px(g.cx - 8, g.y1 - 9, ROSE, sphere(0, 0.5), { bias: -1 });
});

const tulips = art('tulips', 3, 11, (c, g) => {
  const R = rng(1301);
  const cols = [TULIP_R, TULIP_Y, TULIP_P, TULIP_R, TULIP_Y, TULIP_P, TULIP_R];
  const list = cols.map((m, k) => ({ m, x: g.cx - 6 + (k / (cols.length - 1)) * 12 + (R() - 0.5) * 2, y: g.y1 - 4 - R() * 7, h: 6 + R() * 4 }));
  list.sort((a, b) => a.y - b.y);
  for (const t of list) {
    c.part();
    // Two long leaves hugging the stem.
    c.capsule(t.x, t.y, t.x - 2.5, t.y - 4, 1, 0.4, LEAF);
    c.capsule(t.x, t.y, t.x + 2, t.y - 3, 0.9, 0.4, LEAF);
    c.line(t.x, t.y, t.x, t.y - t.h, STEM, () => n3(0.2, 0, 1));
    c.part();
    const top = t.y - t.h - 2;
    // A cup of three petals, split at the rim.
    c.shape(top, top + 3, (y) => {
      const k = y - top;
      const hw = [1.6, 2, 2, 1.4][k];
      return [t.x + 0.5 - hw, t.x + 0.5 + hw];
    }, t.m, (_x, _y, tt, u) => cyl(tt, 0.3 - u * 0.5));
    c.shade(t.x, top, -2);
    c.px(t.x - 1, top + 1, t.m, sphere(-0.5, 0.3), { bias: 2 });
  }
});

const lavender = art('lavender', 4, 13, (c, g) => {
  const R = rng(1401);
  c.part();
  for (let k = 0; k < 14; k++) {
    const a = -Math.PI * (0.08 + R() * 0.84);
    const len = 3 + R() * 4;
    c.capsule(g.cx + (R() - 0.5) * 4, g.y1 - 4, g.cx + Math.cos(a) * len * 1.3, g.y1 - 4 + Math.sin(a) * len, 0.8, 0.5, SAGE);
  }
  const spikes = Array.from({ length: 11 }, (_, k) => ({ x: g.cx - 7 + k * 1.4 + (R() - 0.5), lean: (k - 5) * 0.35 + (R() - 0.5), h: 8 + R() * 5 }));
  for (const s of spikes) {
    c.part();
    const bx = s.x;
    const by = g.y1 - 6;
    const tx = bx + s.lean * 2;
    const ty = by - s.h;
    c.line(bx, by, tx, ty + 4, SAGE);
    // Buds in pairs up the last few px.
    for (let j = 0; j < 5; j++) {
      const y = ty + j;
      const x = tx - s.lean * 0.1 * j;
      c.px(x, y, LAVENDER, sphere(-0.3, 0.4), { bias: 2 - Math.floor(j / 2) });
      if (j % 2 === 1) c.px(x + (j % 4 === 1 ? 1 : -1), y, LAVENDER, sphere(0.4, 0.2), { bias: 0 });
    }
  }
});

const sunflowers = art('sunflowers', 5, 30, (c, g) => {
  const stalks = [
    { x: g.cx - 4, h: 22, lean: -1.5 },
    { x: g.cx + 4, h: 18, lean: 1.5 },
    { x: g.cx, h: 27, lean: 0.3 },
  ];
  for (const s of stalks) {
    const by = g.y1 - 5;
    const tx = s.x + s.lean;
    const ty = by - s.h;
    c.part();
    c.capsule(s.x, by, tx, ty + 2, 1, 0.8, STEM);
    // Broad heart-shaped leaves off the stalk.
    c.part();
    c.ellipse(s.x - 3, by - s.h * 0.35, 3, 1.7, LEAF, { flatten: 0.7 });
    c.ellipse(s.x + 3, by - s.h * 0.6, 2.6, 1.5, LEAF, { flatten: 0.7 });
    // The head: a ring of pointed petals round a dark disc of seeds.
    c.part();
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const ex = Math.cos(a);
      const ey = Math.sin(a);
      c.capsule(tx + ex * 2.2, ty + ey * 2, tx + ex * 4.8, ty + ey * 4.4, 1.1, 0.4, PETAL_Y);
    }
    c.part();
    c.ellipse(tx, ty, 2.6, 2.4, SEEDS, { flatten: 0.6 });
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if ((x + y) % 2 === 0) c.shade(tx + x, ty + y, 1);
    c.px(tx - 1, ty - 1, SEEDS, sphere(-0.4, 0.4), { bias: 2 });
  }
});

function cabbage(c: PixelCanvas, x: number, y: number, s: number): void {
  c.part();
  // Loose outer leaves with pale veins, then the tight head.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    c.ellipse(x + Math.cos(a) * 2.6 * s, y + Math.sin(a) * 1.6 * s, 2.8 * s, 2 * s, CABBAGE, { flatten: 0.7, bias: -1 });
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    c.line(x + Math.cos(a) * 1.5 * s, y + Math.sin(a) * 1 * s, x + Math.cos(a) * 4.4 * s, y + Math.sin(a) * 2.8 * s, CABBAGE, () => TOP, { bias: 2 });
  }
  c.part();
  c.ellipse(x, y - 1, 3 * s, 2.6 * s, CABBAGE, { bias: 1 });
  c.line(x - 1.5 * s, y - 1, x + 0.5 * s, y - 2.5 * s, CABBAGE, () => TOP, { bias: 3 });
}

const cabbages = art('cabbages', 2, 5, (c, g) => {
  cabbage(c, g.cx + 3.5, g.y1 - 11, 0.85);
  cabbage(c, g.cx - 3.5, g.y1 - 5, 1);
});

function pumpkinAt(c: PixelCanvas, x: number, y: number, s: number): void {
  c.part();
  // Lobes from the sides in, so the front one sits on top.
  const lobes = [-4, 4, -2.2, 2.2, 0];
  for (const o of lobes) {
    c.part();
    c.ellipse(x + o * s, y, 2.8 * s, 3.8 * s, PUMPKIN, { flatten: 0.9, bias: o === 0 ? 1 : 0 });
  }
  c.part();
  c.capsule(x, y - 3.4 * s, x + 1, y - 5.4 * s, 0.9, 0.6, STEM);
}

const pumpkin = art('pumpkin', 4, 9, (c, g) => {
  const R = rng(1501);
  c.part();
  // Its vine: a few leaves and a curl.
  for (let k = 0; k < 4; k++) c.ellipse(g.cx - 7 + k * 4.5 + R(), g.y1 - 10 + R() * 3, 2.6, 1.7, LEAF, { flatten: 0.6, bias: -1 });
  c.line(g.cx + 7, g.y1 - 11, g.cx + 9, g.y1 - 13, STEM);
  c.px(g.cx + 10, g.y1 - 12, STEM);
  pumpkinAt(c, g.cx + 5, g.y1 - 6, 0.55);
  pumpkinAt(c, g.cx - 2, g.y1 - 6, 1);
});

const planter = art('planter', 2, 16, (c, g) => {
  const R = rng(1601);
  box(c, g.x0 + 1, g.x1 - 1, g.y0 + 5, g.y1 - 2, 0, 8, OAKW);
  // Planks along the front and a darker rim board.
  for (let x = g.x0 + 1; x < g.x1 - 1; x++) {
    c.shade(x, g.y1 - 2 - 4, -1);
    if ((x - g.x0) % 11 === 0) for (let y = g.y1 - 10; y < g.y1 - 2; y++) c.shade(x, y, -1);
  }
  grain(c, g.x0 + 1, g.x1 - 1, g.y1 - 10, g.y1 - 2, 161);
  c.part();
  for (let y = g.y0 + 5 - 8 + 1; y < g.y1 - 2 - 8 - 1; y++) for (let x = g.x0 + 2; x < g.x1 - 2; x++) c.px(x, y, SOIL, TOP, { bias: hash2(x, y, 162) > 0.7 ? 1 : 0 });
  // Flowers along it, and ivy spilling over the front.
  const heads = [TULIP_R, TULIP_Y, TULIP_P, LAVENDER, ROSE];
  for (let k = 0; k < 9; k++) {
    const x = g.x0 + 4 + k * 3 + R();
    const y = g.y1 - 12 + R() * 3;
    c.part();
    c.line(x, y, x + (R() - 0.5) * 2, y - 3 - R() * 3, STEM);
    c.ellipse(x + (R() - 0.5), y - 3 - R() * 3, 1.3, 1.2, LEAF);
    const m = heads[k % heads.length];
    c.part();
    c.ellipse(x, y - 5 - R() * 2, 1.4, 1.2, m, { bias: 1 });
  }
  c.part();
  for (let k = 0; k < 5; k++) {
    const x = g.x0 + 3 + k * 6 + R() * 2;
    const len = 2 + R() * 4;
    for (let j = 0; j < len; j++) c.px(x + (j % 2), g.y1 - 10 + j, LEAF_DARK, sphere(0, 0), { bias: 2 - (j % 2) });
  }
});

const mossRock = art('rock', 3, 10, (c, g) => {
  const R = rng(1701);
  c.part();
  c.ellipse(g.cx + 3, g.y1 - 5, 4.5, 3.3, FIELDSTONE, { flatten: 0.8, bias: -1 });
  c.part();
  c.ellipse(g.cx - 1, g.y1 - 7, 7, 5.5, FIELDSTONE, { flatten: 0.75 });
  // Facets: flat planes a step lighter or darker.
  for (let y = g.y1 - 13; y < g.y1; y++) {
    for (let x = g.x0 - 3; x < g.x1 + 3; x++) {
      if (!c.filled(x, y)) continue;
      const h = hash2(Math.floor((x + y) / 3), Math.floor((x - y) / 4), 171);
      if (h > 0.72) c.shade(x, y, 1);
      else if (h < 0.2) c.shade(x, y, -1);
    }
  }
  // Moss on its crown, where rain sits.
  c.part();
  for (let y = g.y1 - 13; y < g.y1 - 6; y++) {
    for (let x = g.cx - 7; x < g.cx + 6; x++) {
      if (c.materialAt(x, y) !== FIELDSTONE || c.filled(x, y - 1) && c.materialAt(x, y - 1) !== FIELDSTONE && c.materialAt(x, y - 1) !== MOSS) continue;
      const d = Math.hypot((x - g.cx + 1) / 6, (y - g.y1 + 11) / 3);
      if (d + (R() - 0.5) * 0.5 < 1) c.px(x, y, MOSS, sphere((x - g.cx) / 8, 0.6), { bias: hash2(x, y, 172) > 0.6 ? 1 : 0 });
    }
  }
  tufts(c, g.cx, g.y1 - 1, 8, 173, 6);
});

const stepping = art('stepping', 0, 0, (c, g) => {
  const stones = [
    { x: g.cx - 3, y: g.y0 + 4, rx: 3.6, ry: 2.8 },
    { x: g.cx + 3.5, y: g.y0 + 8.5, rx: 3.2, ry: 2.5 },
    { x: g.cx - 2, y: g.y0 + 13, rx: 3.8, ry: 2.6 },
  ];
  for (const s of stones) {
    c.part();
    c.ellipse(s.x, s.y, s.rx, s.ry, PALE_STONE, { normal: (_x, _y, dx, dy) => n3(dx * 0.25, -dy * 0.25 + 0.1, 0.96) });
    c.shade(s.x - 1, s.y - 1, 1);
    c.shade(s.x + 1, s.y + 1, -1);
  }
}, 1);

const lilypad = art('lilypad', 0, 0, (c, g) => {
  const pads = [
    { x: g.cx - 2.5, y: g.cy - 2.5, r: 4.5, a: 0.6 },
    { x: g.cx + 4, y: g.cy + 3, r: 3.4, a: 2.4 },
    { x: g.cx - 3, y: g.cy + 5, r: 2.4, a: -1 },
  ];
  for (const p of pads) {
    c.part();
    c.ellipse(p.x, p.y, p.r, p.r * 0.72, LILY, { normal: (_x, _y, dx, dy) => n3(dx * 0.3, -dy * 0.3, 0.95) });
    // The notch, cut to the middle.
    for (let d = 0; d < p.r + 1; d += 0.5) {
      const px = p.x + Math.cos(p.a) * d;
      const py = p.y + Math.sin(p.a) * d * 0.72;
      if (d > 0.8) c.erase(px, py);
    }
    // Veins from the middle.
    for (let k = 0; k < 5; k++) {
      const a = p.a + 0.8 + k * 0.9;
      c.shade(p.x + Math.cos(a) * p.r * 0.5, p.y + Math.sin(a) * p.r * 0.36, 1);
    }
  }
  // A water lily, white going pink, open on the biggest pad.
  c.part();
  const fx = g.cx - 3;
  const fy = g.cy - 3.5;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    c.capsule(fx, fy, fx + Math.cos(a) * 2.2, fy + Math.sin(a) * 1.5, 0.9, 0.5, TULIP_P, { bias: 2 });
  }
  c.part();
  c.px(fx, fy, PETAL_Y, TOP, { bias: 3 });
});

const reeds = art('reeds', 4, 22, (c, g) => {
  const R = rng(1801);
  const list = Array.from({ length: 10 }, (_, k) => ({ x: g.cx - 6 + k * 1.3 + (R() - 0.5), lean: (R() - 0.5) * 4, h: 12 + R() * 10, head: k % 3 === 1 }));
  for (const s of list) {
    c.part();
    const by = g.y1 - 4 + R() * 2;
    c.line(s.x, by, s.x + s.lean, by - s.h, s.head ? STEM : LILY, () => n3(0.3, 0.2, 0.9), { bias: s.head ? 0 : 1 });
    if (s.head) {
      c.part();
      c.capsule(s.x + s.lean * 0.85, by - s.h + 2, s.x + s.lean * 0.95, by - s.h + 5, 1.2, 1.2, CATTAIL);
    }
  }
  // Flat blades curving out at the foot.
  c.part();
  for (let k = 0; k < 6; k++) {
    const x = g.cx - 5 + k * 2;
    const dir = k % 2 ? 1 : -1;
    for (let j = 0; j < 6; j++) c.px(x + dir * Math.floor(j * j * 0.12), g.y1 - 4 - j, LEAF, n3(dir * 0.4, 0.2, 0.9), { bias: 1 });
  }
});

const bench = art('bench', 1, 17, (c, g) => {
  const x0 = g.x0 + 2;
  const x1 = g.x1 - 2;
  // Backrest: two slats on iron uprights.
  for (const x of [x0 + 1, x1 - 3]) box(c, x, x + 2, g.y0 + 4, g.y0 + 6, 0, 16, IRON);
  for (const [z0, z1] of [[9, 12], [13, 16]]) {
    box(c, x0, x1, g.y0 + 5, g.y0 + 6, z0, z1, PALEW);
    grain(c, x0, x1, g.y0 + 6 - z1, g.y0 + 6 - z0, 191);
  }
  // Seat of slats, iron legs in front.
  box(c, x0, x1, g.y0 + 6, g.y1 - 3, 6, 8, PALEW);
  for (let y = g.y0 + 6 - 8; y < g.y1 - 3 - 8; y += 3) for (let x = x0; x < x1; x++) c.shade(x, y, -2);
  grain(c, x0, x1, g.y0 - 2, g.y1 - 11, 192);
  for (const x of [x0 + 1, x1 - 3]) {
    box(c, x, x + 2, g.y1 - 5, g.y1 - 3, 0, 6, IRON);
    // Curled arms.
    c.part();
    c.line(x, g.y1 - 3 - 11, x + 1, g.y1 - 3 - 12, IRON, () => FACE, { bias: 2 });
  }
});

const well = art('well', 3, 32, (c, g) => {
  const cx = g.cx;
  const gy = g.y1 - 12;
  // Stone drum: courses of blocks round it.
  drum(c, cx, gy, 13, 8, 0, 12, FIELDSTONE, null);
  for (let y = gy - 12; y < gy + 9; y++) {
    for (let x = cx - 13; x < cx + 13; x++) {
      if (c.materialAt(x, y) !== FIELDSTONE) continue;
      const t = (x + 0.5 - cx) / 13;
      const e = Math.sqrt(Math.max(0, 1 - t * t)) * 8;
      const z = gy + e - y;
      const row = Math.floor(z / 4);
      const col = Math.floor((Math.asin(Math.max(-1, Math.min(1, t))) * 5 + (row % 2) * 0.5));
      if (Math.floor(z) % 4 === 3 || Math.abs((Math.asin(Math.max(-1, Math.min(1, t))) * 5 + (row % 2) * 0.5) - col) < 0.12) c.shade(x, y, -3);
      else c.shade(x, y, Math.round((hash2(col, row, 201) - 0.5) * 2.4));
    }
  }
  // Rim and dark water with a glint.
  c.part();
  c.ellipse(cx, gy - 12, 13, 8, PALE_STONE, { normal: () => TOP });
  c.part();
  c.ellipse(cx, gy - 12, 10, 5.8, SOOT);
  c.part();
  c.ellipse(cx, gy - 10, 8, 4, WATER, { normal: () => TOP, bias: -3 });
  c.px(cx - 3, gy - 11, WATER, TOP, { bias: 3 });
  c.px(cx - 2, gy - 11, WATER, TOP, { bias: 2 });
  // Moss creeping up the stones.
  c.part();
  for (let x = cx - 12; x < cx + 12; x++) if (hash2(x, 3, 202) > 0.55) c.px(x, gy + Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / 13) ** 2)) * 8 - 1, MOSS, FACE, { bias: 1 });
  // Posts, crossbeam, rope and bucket.
  for (const x of [cx - 12, cx + 10]) box(c, x, x + 2, gy - 1, gy + 1, 0, 30, OAKW);
  box(c, cx - 12, cx + 12, gy - 1, gy, 26, 28, OAKW);
  c.part();
  c.line(cx, gy - 26, cx, gy - 17, BURLAP, () => FACE, { bias: 1 });
  drum(c, cx, gy - 12, 2.5, 1.2, 1, 5, OAKW, SOOT);
  c.part();
  c.px(cx - 3, gy - 14, IRON, FACE, { bias: 2 });
  c.px(cx + 2, gy - 14, IRON, FACE, { bias: 2 });
  // A little shingled roof over it all.
  c.part();
  const ry = gy - 36;
  for (let y = ry; y < ry + 10; y++) {
    const u = (y - ry) / 9;
    const hw = 4 + u * 12;
    for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) {
      const t = (x + 0.5 - cx) / hw;
      const course = (y - ry) % 3 === 2;
      const joint = Math.floor(x / 3 + (Math.floor((y - ry) / 3) % 2) * 0.5) % 2 === 0 && (x + Math.floor((y - ry) / 3)) % 3 === 0;
      c.px(x, y, OAKW, n3(t * 0.7, 0.3, 0.7), { bias: course || joint ? -2 : 1 });
    }
  }
  c.part();
  for (let x = cx - 4; x < cx + 4; x++) c.px(x, ry, DARKW, TOP, { bias: 2 });
});

const birdbath = art('birdbath', 4, 16, (c, g) => {
  const gy = g.y1 - 7;
  drum(c, g.cx, gy, 4, 2, 0, 2, PALE_STONE);
  drum(c, g.cx, gy, 1.6, 0.9, 2, 10, PALE_STONE, null);
  drum(c, g.cx, gy, 6.5, 3, 10, 13, PALE_STONE);
  c.part();
  c.ellipse(g.cx, gy - 13, 5, 2, WATER, { normal: () => TOP });
  c.px(g.cx - 2, gy - 14, WATER, TOP, { bias: 3 });
  // A bluebird on the rim.
  c.part();
  const bx = g.cx + 5;
  const by = gy - 15;
  c.ellipse(bx, by, 1.8, 1.3, DENIM, { bias: 2 });
  c.px(bx - 1, by - 2, DENIM, sphere(-0.3, 0.5), { bias: 3 });
  c.px(bx - 2, by - 2, PETAL_Y, FACE, { bias: 2 });
  c.px(bx + 2, by - 1, DENIM, FACE, { bias: 0 });
  c.px(bx - 1, by + 1, TULIP_R, FACE, { bias: 2 });
});

const scarecrow = art('scarecrow', 7, 34, (c, g) => {
  const cx = g.cx;
  const by = g.y1 - 6;
  box(c, cx - 1, cx + 1, by - 1, by + 1, 0, 26, PALEW);
  box(c, cx - 11, cx + 11, by - 1, by, 19, 21, PALEW);
  // Shirt over the cross, sleeves along the bar, straw spilling out.
  c.part();
  c.shape(by - 21, by - 9, (y) => {
    const u = (y - by + 21) / 12;
    const hw = 5 - u * 1.2;
    return [cx - hw, cx + hw];
  }, DENIM, (_x, _y, t, u) => n3(t * 0.5, 0.1 - u * 0.4, 0.85));
  // Plaid lines.
  for (let y = by - 21; y < by - 9; y++) for (let x = cx - 5; x < cx + 5; x++) if (c.materialAt(x, y) === DENIM && ((x & 3) === 0 || ((y + 1) & 3) === 0)) c.shade(x, y, -2);
  c.part();
  c.capsule(cx - 4, by - 20, cx - 10, by - 20, 1.8, 1.5, DENIM);
  c.capsule(cx + 4, by - 20, cx + 10, by - 20, 1.8, 1.5, DENIM);
  c.part();
  // A patch.
  c.px(cx + 2, by - 14, QUILT_R, FACE, { bias: 1 });
  c.px(cx + 3, by - 14, QUILT_R, FACE, { bias: 1 });
  c.px(cx + 2, by - 13, QUILT_R, FACE, { bias: 0 });
  c.px(cx + 3, by - 13, QUILT_R, FACE, { bias: 0 });
  const straw = (x: number, y: number, dx: number, dy: number) => {
    for (let k = 0; k < 3; k++) c.line(x, y, x + dx + (k - 1) * dy * 0.5, y + dy + (k - 1) * dx * 0.3, HAY, () => FACE, { bias: 2 - k });
  };
  c.part();
  straw(cx - 11, by - 20, -2, 1);
  straw(cx + 11, by - 20, 2, 1);
  straw(cx - 2, by - 9, -1, 3);
  straw(cx + 2, by - 9, 1, 3);
  // Burlap head with a stitched grin, and a battered straw hat, tipped.
  c.part();
  c.ellipse(cx, by - 25, 3.6, 3.4, BURLAP);
  c.px(cx - 1.5, by - 26, SOOT, FACE, { bias: 0 });
  c.px(cx + 1.5, by - 26, SOOT, FACE, { bias: 0 });
  for (let x = -2; x <= 2; x++) c.px(cx + x, by - 23 - (Math.abs(x) === 2 ? 1 : 0), SOOT, FACE, { bias: 1 });
  c.part();
  c.ellipse(cx + 0.5, by - 28, 6.5, 1.6, HAY, { normal: () => TOP, bias: 1 });
  c.part();
  c.shape(by - 33, by - 28, (y) => {
    const u = (y - by + 33) / 5;
    const hw = 2.4 + u * 1.4;
    return [cx + 1 - hw, cx + 1 + hw];
  }, HAY, (_x, _y, t) => cyl(t, 0.2));
  for (let x = cx - 3; x < cx + 5; x++) c.shade(x, by - 29, -3);
  // A crow on its arm, which rather defeats the point.
  c.part();
  const kx = cx + 8;
  const ky = by - 23;
  c.ellipse(kx, ky, 2.2, 1.6, SOOT, { bias: 2 });
  c.ellipse(kx + 2, ky - 2, 1.3, 1.2, SOOT, { bias: 2 });
  c.px(kx + 3.5, ky - 2, PETAL_Y, FACE, { bias: -1 });
  c.px(kx - 3, ky + 1, SOOT, FACE, { bias: 1 });
  c.px(kx + 2, ky - 2, LINEN, FACE, { bias: 3 });
});

const haybale = art('haybale', 1, 11, (c, g) => {
  const x0 = g.x0 + 1;
  const x1 = g.x1 - 1;
  const y0 = g.y0 + 5;
  const y1 = g.y1 - 2;
  box(c, x0, x1, y0, y1, 0, 9, HAY);
  // Round its corners.
  for (const [x, y] of [[x0, y0 - 9], [x1 - 1, y0 - 9], [x0, y1 - 1], [x1 - 1, y1 - 1]]) c.erase(x, y);
  // Straw: short strokes, bristling at the edges.
  for (let y = y0 - 9; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!c.filled(x, y)) continue;
      const h = hash2(x, Math.floor(y / 2), 211 + (x & 1));
      if (h > 0.75) c.shade(x, y, 1);
      else if (h < 0.22) c.shade(x, y, -1);
    }
  }
  c.part();
  for (let x = x0; x < x1; x += 2) if (hash2(x, 0, 212) > 0.5) c.px(x, y0 - 10, HAY, TOP, { bias: 2 });
  // Twine.
  for (const tx of [x0 + 4, x1 - 5]) {
    for (let y = y0 - 9; y < y1; y++) c.shade(tx, y, -3);
  }
});

const mailbox = art('mailbox', 5, 19, (c, g) => {
  const cx = g.cx;
  const gy = g.y1 - 5;
  box(c, cx - 1, cx + 1, gy - 1, gy + 1, 0, 11, OAKW);
  // The tube-shaped box running back, and its arched front.
  c.part();
  const z = 11;
  for (let y = gy - z - 13; y < gy - z - 3; y++) {
    for (let x = cx - 4; x < cx + 4; x++) {
      const t = (x + 0.5 - cx) / 4;
      c.px(x, y, RED_PAINT, cyl(t, 0.6), { bias: 0 });
    }
  }
  c.part();
  c.shape(gy - z - 7, gy - z, (y) => {
    const k = y - (gy - z - 7);
    const hw = k < 3 ? [2.6, 3.6, 4][k] : 4;
    return [cx - hw, cx + hw];
  }, RED_PAINT, () => FACE);
  c.shade(cx - 3, gy - z - 2, 1);
  c.px(cx, gy - z - 3, BRASS, FACE, { bias: 2 });
  // Its flag, up: there's post.
  c.part();
  c.line(cx + 4, gy - z - 6, cx + 4, gy - z - 13, IRON, () => EAST, { bias: 1 });
  c.part();
  for (let y = gy - z - 13; y < gy - z - 10; y++) for (let x = cx + 5; x < cx + 8; x++) c.px(x, y, FLAG_RED, EAST, { bias: 2 });
  c.part();
  for (let x = cx - 2; x < cx + 2; x++) c.px(x, gy - z - 13, LINEN, TOP, { bias: 2 });
  tufts(c, cx, gy + 1, 4, 221, 4);
});

const ROD_CORK = mat('#1a1006', '#5a3e1e', '#7e5a30', '#a07a46', '#c09a60', '#dcbc82');
const ROD_LINE: Material = { ...mat('#0a0a10', '#8a96a8', '#c0cad8', '#eef4ff'), noAO: true, noOutline: true };
const FLOAT_RED: Material = { ...mat('#1a0204', '#4a0608', '#7a0c10', '#a8161a', '#d02a26', '#f04a3a', '#ff7a60'), shine: true };
const FLOAT_WHITE: Material = { ...mat('#1a1a1e', '#8a8a92', '#b8b8c0', '#dcdce2', '#f4f4f8', '#ffffff'), shine: true };
const BAIT = mat('#1a0608', '#5a1a22', '#8a3040', '#b84a5a', '#dc7080');

/**
 * A wooden pail with an iron bail, a little water in it (and a minnow's tail
 * flicking out), a tin of bait beside it and, unless `rod` is false (while
 * the hero has it at the water, see world/Fishing.ts), a fishing rod standing
 * in it: cork grip, brass reel, the line threaded up the rod and hanging from
 * its tip with a red and white float.
 */
function rodBucket(c: PixelCanvas, g: Foot, rod: boolean): void {
  const cx = g.cx;
  const gy = g.y1 - 5;
  const H = 10;
  // The bait tin, behind and to the left.
  drum(c, cx - 7, gy - 2, 2.2, 1.2, 0, 3, STEEL, SOIL, { bias: -1 });
  c.part();
  c.px(cx - 7, gy - 6, BAIT, TOP, { bias: 2 });
  c.px(cx - 6, gy - 6, BAIT, TOP, { bias: 1 });
  c.px(cx - 6, gy - 7, BAIT, TOP, { bias: 2 });
  // The pail: staves flaring a little toward the rim, bound with two iron hoops.
  c.part();
  for (let z = 0; z < H; z++) {
    const rx = 4.4 + (z / (H - 1)) * 0.9;
    for (let x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++) {
      const t = (x + 0.5 - cx) / rx;
      if (Math.abs(t) > 1) continue;
      const e = Math.sqrt(1 - t * t) * 2.4;
      const y = Math.round(gy + e - z);
      const stave = Math.floor((Math.asin(t) + 2) * 3.2);
      c.px(x, y, PALEW, cyl(t, -0.2), { bias: (stave % 2 ? -1 : 0) + (z === 0 ? -1 : 0) });
      if (Math.round(gy + e - z - 1) < y - 1) c.px(x, y - 1, PALEW, cyl(t, -0.2), { bias: stave % 2 ? -1 : 0 });
    }
  }
  c.part();
  for (const hz of [2, 7]) {
    const rx = 4.4 + (hz / (H - 1)) * 0.9 + 0.3;
    for (let x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++) {
      const t = (x + 0.5 - cx) / rx;
      if (Math.abs(t) > 1) continue;
      c.px(x, Math.round(gy + Math.sqrt(1 - t * t) * 2.4 - hz), IRON, cyl(t, -0.1), { bias: 1 });
    }
  }
  // Its rim, and the water inside with a glint on it.
  c.part();
  const top = gy - H;
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2;
    c.px(cx + Math.cos(t) * 5.1, top + Math.sin(t) * 2.3, DARKW, TOP, { bias: Math.sin(t) > 0 ? 1 : 2 });
  }
  c.part();
  c.ellipse(cx, top + 0.6, 3.9, 1.5, WATER, { normal: () => TOP, bias: 1 });
  c.px(cx - 2, top, WATER, TOP, { bias: 4 });
  c.px(cx - 1, top, WATER, TOP, { bias: 3 });
  // A minnow's tail flicking up out of the water.
  c.part();
  const fx = rod ? cx + 1 : cx - 1;
  c.px(fx, top - 1, STEEL, FACE, { bias: 1 });
  c.px(fx - 1, top - 2, STEEL, FACE, { bias: 2 });
  c.px(fx + 1, top - 2, STEEL, FACE, { bias: 0 });
  // The bail: an iron handle arching over the back.
  c.part();
  for (let k = 0; k <= 14; k++) {
    const t = k / 14;
    const x = cx - 5.4 + t * 10.8;
    const y = top - 1 - Math.sin(t * Math.PI) * 4.5;
    c.px(x, y, IRON, n3(0, 0.6, 0.8), { bias: t < 0.5 ? 1 : 0 });
  }
  if (!rod) {
    tufts(c, cx, gy + 2, 6, 1901, 5);
    return;
  }
  // The rod: its butt in the pail, leaning out over the rim to a fine tip.
  const bx = cx - 1.5;
  const by = top + 1;
  const tx = cx + 8.5;
  const ty = 3;
  const at = (s: number) => ({ x: bx + (tx - bx) * s, y: by + (ty - by) * s });
  c.part();
  for (let k = 0; k <= 44; k++) {
    const s = k / 44;
    const p = at(s);
    // Thick in the hand, tapering: the lower third two pixels wide.
    const m = s < 0.18 ? ROD_CORK : s < 0.97 ? OAKW : DARKW;
    c.px(p.x, p.y, m, cyl(-0.3, 0.4), { bias: m === ROD_CORK ? 1 : 2 - Math.floor(s * 3) });
    if (s < 0.34) c.px(p.x + 1, p.y, m, cyl(0.5, 0.4), { bias: -1 });
  }
  // Binding wraps on the cork, and the line guides along the rod.
  for (const s of [0.05, 0.16]) {
    const p = at(s);
    c.px(p.x, p.y, BRASS, cyl(-0.3, 0.4), { bias: 1 });
    c.px(p.x + 1, p.y, BRASS, cyl(0.5, 0.4));
  }
  c.part();
  for (const s of [0.42, 0.62, 0.8, 0.96]) {
    const p = at(s);
    c.px(p.x + 1, p.y, STEEL, EAST, { bias: 2 });
  }
  // The reel, hung under the grip: a brass drum with its crank.
  c.part();
  const r = at(0.24);
  c.ellipse(r.x - 1.2, r.y + 0.8, 2.1, 2.1, BRASS, { flatten: 0.8 });
  c.px(r.x - 1.2, r.y + 0.8, SOOT, FACE);
  c.part();
  c.px(r.x - 3.4, r.y + 1.8, DARKW, FACE, { bias: 2 });
  // The line: up the rod from the reel, through the guides, then hanging from the tip to the float.
  c.part();
  for (let k = 0; k <= 30; k++) {
    const p = at(0.24 + (0.99 - 0.24) * (k / 30));
    c.px(p.x + 1, p.y - 1, ROD_LINE, FACE, { bias: 2 });
  }
  const drop = 17;
  for (let k = 1; k <= drop; k++) c.px(tx + 1 + Math.round(Math.sin((k / drop) * 2) * 0.8), ty + k, ROD_LINE, FACE, { bias: 1 });
  // The float, then a glint of hook below it.
  c.part();
  const fyy = ty + drop + 1;
  const fxx = tx + 1;
  c.px(fxx, fyy - 1, FLOAT_RED, FACE, { bias: 1 });
  for (const dx of [-1, 0, 1]) c.px(fxx + dx, fyy, FLOAT_RED, sphere(dx * 0.6, 0.5), { bias: dx < 0 ? 1 : 0 });
  for (const dx of [-1, 0, 1]) c.px(fxx + dx, fyy + 1, FLOAT_WHITE, sphere(dx * 0.6, -0.2), { bias: dx < 0 ? 1 : 0 });
  c.px(fxx, fyy + 2, FLOAT_WHITE, sphere(0, -0.6));
  c.part();
  c.px(fxx, fyy + 3, ROD_LINE, FACE);
  c.px(fxx, fyy + 4, STEEL, FACE, { bias: 3 });
  c.px(fxx - 1, fyy + 4, STEEL, FACE, { bias: 1 });
  tufts(c, cx, gy + 2, 6, 1901, 5);
}

const fishrod = art('fishrod', 6, 32, (c, g) => rodBucket(c, g, true));

/** The pail on its own, while its rod is out at the water: the same frame, so it swaps straight in. */
export function emptyRodBucket(mirror: boolean): PixelCanvas {
  const c = art('fishrod', 6, 32, (cv, g) => rodBucket(cv, g, false)).draw(0);
  return mirror ? c.mirrored() : c;
}

/** The float bobbing on the water while the hero fishes: a red cap on a white body, the rest under the surface. */
export const BOBBER_W = 7;
export const BOBBER_H = 8;
export function bobber(): PixelCanvas {
  const c = new PixelCanvas(BOBBER_W, BOBBER_H);
  c.part();
  c.px(3, 1, DARKW, FACE, { bias: 2 });
  c.px(3, 2, FLOAT_RED, FACE, { bias: 2 });
  c.part();
  for (const [x, y] of [[2, 3], [3, 3], [4, 3], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4]]) c.px(x, y, FLOAT_RED, sphere((x - 3) / 2.5, 0.5), { bias: x < 3 ? 1 : 0 });
  c.part();
  for (let x = 1; x < 6; x++) c.px(x, 5, FLOAT_WHITE, sphere((x - 3) / 2.5, -0.1), { bias: x < 3 ? 1 : 0 });
  for (let x = 2; x < 5; x++) c.px(x, 6, FLOAT_WHITE, sphere((x - 3) / 2, -0.6), { bias: -1 });
  return c;
}

const signpost = art('signpost', 8, 26, (c, g) => {
  const cx = g.cx;
  const gy = g.y1 - 5;
  box(c, cx - 1, cx + 1, gy - 1, gy + 1, 0, 24, OAKW);
  c.part();
  c.px(cx - 1, gy - 25, OAKW, TOP, { bias: 1 });
  const board = (y: number, dir: number, len: number, m: Material) => {
    c.part();
    for (let yy = y; yy < y + 4; yy++) {
      for (let k = 0; k < len; k++) {
        const tip = len - k;
        if (tip <= 2 && Math.abs(yy - y - 1.5) > tip) continue;
        const x = dir > 0 ? cx + 1 + k : cx - 2 - k;
        c.px(x, yy, m, FACE, { bias: yy === y ? 2 : yy === y + 3 ? -1 : 0 });
      }
    }
    // Words, as scratches.
    for (let k = 2; k < len - 3; k++) if (hash2(k, y, 231) > 0.4) c.shade(dir > 0 ? cx + 1 + k : cx - 2 - k, y + 1 + (k & 1), -3);
  };
  board(gy - 23, -1, 12, PALEW);
  board(gy - 17, 1, 11, OAKW);
  tufts(c, cx, gy + 1, 5, 232, 5);
});

// ---------------------------------------------------------------- Furniture

function bedArt(quilt: Material, pillows: number): Drawer {
  return (c, g) => {
    const x0 = g.x0 + 1;
    const x1 = g.x1 - 1;
    // Headboard with a carved crest and posts.
    box(c, x0, x1, g.y0 + 1, g.y0 + 3, 0, 15, OAKW);
    grain(c, x0, x1, g.y0 + 3 - 15, g.y0 + 3, 241, false);
    c.part();
    for (let x = x0 + 2; x < x1 - 2; x++) {
      const t = (x + 0.5 - g.cx) / ((x1 - x0) / 2);
      const rise = Math.round(Math.cos(t * Math.PI * 0.5) * 3);
      for (let k = 1; k <= rise; k++) c.px(x, g.y0 + 1 - 15 - k, OAKW, FACE, { bias: k === rise ? 2 : 0 });
    }
    for (const x of [x0, x1 - 2]) box(c, x, x + 2, g.y0 + 1, g.y0 + 3, 0, 18, DARKW);
    // Frame, then the mattress.
    box(c, x0, x1, g.y0 + 3, g.y1 - 2, 0, 6, OAKW);
    box(c, x0 + 1, x1 - 1, g.y0 + 3, g.y1 - 3, 6, 9, LINEN, { topBias: 1 });
    // Pillows.
    const pw = (x1 - x0 - 4) / pillows;
    for (let k = 0; k < pillows; k++) {
      c.part();
      const px = x0 + 2 + pw * (k + 0.5);
      c.ellipse(px, g.y0 + 3 - 9 + 3, pw / 2 - 0.3, 2.6, LINEN, { bias: 1, flatten: 0.8 });
      c.shade(px, g.y0 + 3 - 9 + 3, -1);
    }
    // The quilt, turned down at the top, hanging over the sides.
    const qy0 = g.y0 + 12;
    box(c, x0, x1, qy0, g.y1 - 2, 3, 10, quilt, { topBias: 0 });
    c.part();
    for (let y = qy0 - 10; y < qy0 - 8; y++) for (let x = x0; x < x1; x++) c.px(x, y, LINEN, TOP, { bias: y === qy0 - 10 ? 2 : 0 });
    // Patchwork: squares a shade apart, stitched.
    for (let y = qy0 - 8; y < g.y1 - 2 - 3; y++) {
      for (let x = x0; x < x1; x++) {
        if (c.materialAt(x, y) !== quilt) continue;
        const px = Math.floor((x - x0) / 4);
        const py = Math.floor((y - qy0) / 4);
        if ((x - x0) % 4 === 0 || (y - qy0) % 4 === 0) c.shade(x, y, -1);
        else if ((px + py) % 2 === 0) c.shade(x, y, 1);
      }
    }
    // Footboard.
    box(c, x0, x1, g.y1 - 3, g.y1 - 1, 0, 8, OAKW);
    for (const x of [x0, x1 - 2]) box(c, x, x + 2, g.y1 - 3, g.y1 - 1, 0, 10, DARKW);
  };
}

const bed = art('bed', 1, 20, bedArt(QUILT_R, 1));
const bigbed = art('bigbed', 1, 20, bedArt(QUILT_B, 2));

const bookshelf = art('bookshelf', 1, 32, (c, g) => {
  const x0 = g.x0 + 1;
  const x1 = g.x1 - 1;
  const gy = g.y0 + 9;
  box(c, x0, x1, g.y0 + 2, gy, 0, 30, OAKW);
  grain(c, x0, x1, gy - 30, gy, 251, false);
  // Four shelves of books, sunk in the case's shadow.
  const R = rng(252);
  const shelves = [[3, 9], [10, 16], [17, 23], [24, 28]];
  for (const [z0, z1] of shelves) {
    c.part();
    for (let z = z0; z < z1; z++) for (let x = x0 + 2; x < x1 - 2; x++) c.px(x, gy - 1 - z, DARKW, FACE, { bias: -2 });
    c.part();
    let x = x0 + 2;
    while (x < x1 - 3) {
      if (R() < 0.12) {
        // A gap with a jar, a candle or nothing.
        const kind = R();
        if (kind < 0.4) {
          for (let z = z0; z < z0 + 3; z++) for (let k = 0; k < 2; k++) c.px(x + k, gy - 1 - z, GLASS, FACE, { bias: 2 - k });
        } else if (kind < 0.7) {
          for (let z = z0; z < z0 + 3; z++) c.px(x, gy - 1 - z, WAX, FACE, { bias: 2 });
        }
        x += 3;
        continue;
      }
      const w = R() < 0.3 ? 2 : 1;
      const hgt = Math.min(z1 - z0, 3 + Math.floor(R() * 4));
      const m = BOOKS[Math.floor(R() * BOOKS.length)];
      for (let k = 0; k < w; k++) {
        for (let z = z0; z < z0 + hgt; z++) {
          const band = z === z0 + hgt - 2 || z === z0 + 1;
          c.px(x + k, gy - 1 - z, m, FACE, { bias: (k === 0 ? 1 : 0) + (band ? 2 : 0) });
        }
      }
      x += w;
    }
    // Shelf lip.
    for (let x2 = x0 + 1; x2 < x1 - 1; x2++) c.px(x2, gy - 1 - (z0 - 1), OAKW, FACE, { bias: 2 });
  }
  // Crown and a globe on top.
  box(c, x0 - 1, x1 + 1, g.y0 + 1, gy + 1, 29, 31, DARKW);
  c.part();
  c.ellipse(x1 - 6, gy - 34, 2.6, 2.6, QUILT_B, { bias: 1 });
  c.px(x1 - 7, gy - 35, LEAF, sphere(-0.4, 0.4), { bias: 2 });
  c.px(x1 - 6, gy - 34, LEAF, sphere(0, 0), { bias: 1 });
  c.px(x1 - 6, gy - 31, BRASS, FACE, { bias: 1 });
});

const wardrobe = art('wardrobe', 2, 36, (c, g) => {
  const x0 = g.x0 + 1;
  const x1 = g.x1 - 1;
  const gy = g.y0 + 10;
  box(c, x0 + 1, x1 - 1, g.y0 + 2, gy, 0, 2, DARKW);
  box(c, x0, x1, g.y0 + 2, gy, 2, 31, OAKW);
  grain(c, x0, x1, gy - 31, gy - 2, 261, false);
  // Two doors with raised panels and a brass pull each.
  const mid = Math.round(g.cx);
  c.part();
  for (let z = 3; z < 30; z++) c.px(mid - 1, gy - 1 - z, DARKW, FACE, { bias: -1 });
  for (const [a, b] of [[x0 + 2, mid - 2], [mid + 1, x1 - 2]]) {
    for (const [z0, z1] of [[5, 15], [17, 28]]) {
      for (let x = a; x < b; x++) {
        c.shade(x, gy - 1 - z1, 2);
        c.shade(x, gy - 1 - z0, -2);
      }
      for (let z = z0; z <= z1; z++) {
        c.shade(a, gy - 1 - z, 2);
        c.shade(b - 1, gy - 1 - z, -2);
      }
    }
  }
  c.part();
  c.px(mid - 3, gy - 17, BRASS, FACE, { bias: 2 });
  c.px(mid + 2, gy - 17, BRASS, FACE, { bias: 2 });
  // Crown moulding.
  box(c, x0 - 1, x1 + 1, g.y0 + 1, gy + 1, 31, 34, DARKW);
  c.part();
  for (let x = x0; x < x1; x++) c.px(x, gy + 1 - 32, BRASS, FACE, { bias: x % 3 === 0 ? 1 : -1 });
});

const dresser = art('dresser', 1, 22, (c, g) => {
  const x0 = g.x0 + 1;
  const x1 = g.x1 - 1;
  const gy = g.y0 + 12;
  box(c, x0, x1, g.y0 + 3, gy, 0, 14, OAKW);
  grain(c, x0, x1, gy - 14, gy, 271);
  for (const z of [4, 8, 12]) {
    for (let x = x0 + 1; x < x1 - 1; x++) c.shade(x, gy - z, -2);
    c.part();
    c.px(g.cx - 3, gy - z + 2, BRASS, FACE, { bias: 2 });
    c.px(g.cx + 2, gy - z + 2, BRASS, FACE, { bias: 2 });
  }
  // A vase of flowers and a candle on top.
  drum(c, x0 + 4, g.y0 + 6, 1.8, 1, 14, 18, QUILT_B, SOOT);
  c.part();
  for (const [dx, dy, m] of [[-1, -21, TULIP_Y], [1, -22, TULIP_R], [0, -23, TULIP_P], [2, -20, LAVENDER]] as [number, number, Material][]) {
    c.line(x0 + 4, g.y0 + 6 - 18, x0 + 4 + dx, g.y0 + 6 + dy + 1, STEM);
    c.px(x0 + 4 + dx, g.y0 + 6 + dy, m, sphere(0, 0.4), { bias: 2 });
  }
  c.part();
  for (let z = 14; z < 18; z++) c.px(x1 - 4, g.y0 + 7 - z, WAX, FACE, { bias: 2 });
  c.spark(x1 - 4, g.y0 + 7 - 19, FIRE_COLS[1], 0.9);
  c.spark(x1 - 4, g.y0 + 7 - 20, FIRE_COLS[0], 0.5);
});

const table = art('table', 1, 16, (c, g) => {
  const x0 = g.x0 + 1;
  const x1 = g.x1 - 1;
  const y0 = g.y0 + 2;
  const y1 = g.y1 - 3;
  for (const x of [x0 + 1, x1 - 3]) box(c, x, x + 2, y0 + 1, y0 + 3, 0, 9, DARKW);
  box(c, x0, x1, y0, y1, 9, 11, OAKW);
  grain(c, x0, x1, y0 - 11, y1 - 9, 281);
  for (const x of [x0 + 1, x1 - 3]) box(c, x, x + 2, y1 - 3, y1 - 1, 0, 9, DARKW);
  // A runner down the middle, a bowl of fruit and a candle.
  c.part();
  for (let y = y0 - 11; y < y1 - 11; y++) for (let x = Math.round(g.cx) - 4; x < Math.round(g.cx) + 4; x++) c.px(x, y, LINEN, TOP, { bias: Math.abs(x + 0.5 - g.cx) > 3 ? -1 : 1 });
  const by = (y0 + y1) / 2 - 11;
  drum(c, g.cx - 7, by + 2, 4, 2, 0, 2, PALEW);
  c.part();
  for (const [dx, dy, m] of [[-2, -1, TULIP_R], [0, -2, CABBAGE], [2, -1, PETAL_Y], [-1, 0, TULIP_R], [1, 0, PUMPKIN]] as [number, number, Material][]) c.ellipse(g.cx - 7 + dx, by + dy, 1.3, 1.2, m, { bias: 1 });
  c.part();
  for (let z = 0; z < 4; z++) c.px(g.cx + 7, by + 1 - z, WAX, FACE, { bias: 2 });
  drum(c, g.cx + 7, by + 2, 1.6, 0.8, 0, 1, BRASS);
  c.spark(g.cx + 7, by - 4, FIRE_COLS[1], 0.9);
  c.spark(g.cx + 7, by - 5, FIRE_COLS[0], 0.5);
});

const roundtable = art('roundtable', 2, 16, (c, g) => {
  const gy = g.y1 - 8;
  drum(c, g.cx, gy, 4, 2, 0, 1, DARKW);
  drum(c, g.cx, gy, 1.4, 0.8, 1, 10, DARKW, null);
  drum(c, g.cx, gy, 7, 4.5, 10, 12, OAKW);
  c.part();
  c.ellipse(g.cx, gy - 12, 4.5, 2.8, LINEN, { normal: () => TOP, bias: 1 });
  for (let a = 0; a < 16; a++) c.shade(g.cx + Math.cos((a / 16) * Math.PI * 2) * 4, gy - 12 + Math.sin((a / 16) * Math.PI * 2) * 2.6, -1);
  drum(c, g.cx, gy - 12, 1.5, 0.8, 0, 4, GLASS, WATER);
  c.part();
  c.line(g.cx, gy - 16, g.cx - 1, gy - 19, STEM);
  rose(c, g.cx - 1, gy - 20, ROSE);
});

const chairSide = sized(1, 1, 2, 18, (c, g) => {
  // Seen from the side, facing east: the back on the west.
  const x0 = g.cx - 5;
  const x1 = g.cx + 4;
  const y0 = g.y0 + 5;
  const y1 = g.y1 - 4;
  for (const x of [x0, x1 - 1]) box(c, x, x + 1, y0, y0 + 1, 0, 7, OAKW);
  box(c, x0, x0 + 2, y0, y1, 7, 18, OAKW);
  // Spindles in the back.
  c.part();
  for (let y = y0 - 17; y < y1 - 18; y++) c.px(x0 + 1, y, OAKW, EAST, { bias: 1 });
  for (let z = 9; z < 16; z++) for (let y = y0 + 1; y < y1 - 1; y++) if ((y - y0) % 3 === 0) c.px(x0 + 1, y - z, OAKW, EAST, { bias: 0 });
  box(c, x0, x1, y0, y1, 6, 8, OAKW, { top: QUILT_R, topBias: 1 });
  for (const x of [x0, x1 - 1]) box(c, x, x + 1, y1 - 1, y1, 0, 6, OAKW);
});

const stool = art('stool', 2, 11, (c, g) => {
  const gy = g.y1 - 7;
  c.part();
  c.line(g.cx - 4, gy + 2, g.cx - 2, gy - 7, OAKW, () => WEST);
  c.line(g.cx + 4, gy + 2, g.cx + 2, gy - 7, OAKW, () => EAST);
  c.line(g.cx, gy - 1, g.cx, gy - 7, OAKW, () => FACE);
  c.line(g.cx - 3, gy - 2, g.cx + 3, gy - 2, OAKW, () => FACE, { bias: -1 });
  drum(c, g.cx, gy - 2, 4.5, 2.6, 6, 8, PALEW);
  grain(c, g.cx - 4, g.cx + 4, gy - 12, gy - 7, 291);
});

const sofa = art('sofa', 1, 18, (c, g) => {
  const x0 = g.x0 + 1;
  const x1 = g.x1 - 1;
  const y0 = g.y0 + 2;
  const y1 = g.y1 - 2;
  box(c, x0, x1, y0, y0 + 5, 3, 16, VELVET);
  // Tufted buttons in the back.
  for (let z = 8; z < 15; z += 3) for (let x = x0 + 4 + (z % 2) * 2; x < x1 - 4; x += 4) c.shade(x, y0 + 5 - z, -2);
  box(c, x0, x1, y0 + 4, y1, 0, 5, VELVET, { bias: -1 });
  // Two seat cushions.
  const mid = Math.round(g.cx);
  box(c, x0 + 3, mid, y0 + 5, y1, 5, 8, VELVET, { topBias: 1 });
  box(c, mid, x1 - 3, y0 + 5, y1, 5, 8, VELVET, { topBias: 1 });
  // Rolled arms.
  for (const [a, b] of [[x0, x0 + 3], [x1 - 3, x1]]) {
    c.part();
    for (let y = y0 - 11; y < y1 - 5; y++) {
      for (let x = a; x < b; x++) {
        const t = (x + 0.5 - (a + b) / 2) / 1.5;
        c.px(x, y, VELVET, y < y0 + 2 - 11 + 2 ? n3(t * 0.6, 0.6, 0.6) : cyl(t, -0.2), { bias: 0 });
      }
    }
  }
  box(c, x0, x0 + 2, y1 - 2, y1, 0, 2, DARKW);
  box(c, x1 - 2, x1, y1 - 2, y1, 0, 2, DARKW);
  // A gold cushion thrown in the corner.
  c.part();
  c.ellipse(x1 - 7, y0 - 5, 3, 2.6, GOLD_CLOTH, { bias: 1 });
  c.shade(x1 - 7, y0 - 5, -1);
});

const desk = art('desk', 1, 18, (c, g) => {
  const x0 = g.x0 + 1;
  const x1 = g.x1 - 1;
  const y0 = g.y0 + 3;
  const y1 = g.y1 - 4;
  box(c, x1 - 3, x1 - 1, y0 + 1, y0 + 3, 0, 10, DARKW);
  // Drawers down the west side.
  box(c, x0, x0 + 11, y0 + 1, y1, 0, 10, DARKW);
  for (const z of [3, 6, 9]) {
    for (let x = x0 + 1; x < x0 + 10; x++) c.shade(x, y1 - z, -2);
    c.part();
    c.px(x0 + 5, y1 - z + 1, BRASS, FACE, { bias: 2 });
  }
  box(c, x1 - 3, x1 - 1, y1 - 2, y1, 0, 10, DARKW);
  box(c, x0 - 1, x1, y0, y1 + 1, 10, 12, DARKW, { topBias: 1 });
  grain(c, x0, x1, y0 - 12, y1 - 10, 301);
  // An open book, papers, the inkwell and its quill.
  const ty = y0 - 12;
  c.part();
  for (let y = ty + 2; y < ty + 7; y++) for (let x = x0 + 12; x < x0 + 22; x++) c.px(x, y, LINEN, TOP, { bias: x === x0 + 17 ? -2 : (y - ty) % 2 ? 0 : 1 });
  for (let y = ty + 3; y < ty + 7; y++) for (let x = x0 + 13; x < x0 + 21; x++) if (x !== x0 + 17 && (y - ty) % 2 === 1 && hash2(x, y, 302) > 0.3) c.shade(x, y, -2);
  c.part();
  for (let y = ty + 3; y < ty + 8; y++) for (let x = x0 + 2; x < x0 + 8; x++) c.px(x, y, WAX, TOP, { bias: 1 });
  drum(c, x1 - 5, ty + 6, 1.6, 1, 0, 2, SOOT);
  c.part();
  c.line(x1 - 5, ty + 4, x1 - 2, ty - 2, LINEN, () => EAST, { bias: 3 });
});

const chest = art('chest', 2, 14, (c, g) => {
  const x0 = g.cx - 7;
  const x1 = g.cx + 7;
  const y0 = g.y0 + 4;
  const y1 = g.y1 - 3;
  box(c, x0, x1, y0, y1, 0, 7, OAKW);
  grain(c, x0, x1, y1 - 7, y1, 311);
  // A rounded lid: its top turning from the sky to the viewer.
  c.part();
  const lt = y0 - 11;
  const lb = y1 - 7;
  for (let y = lt; y < lb; y++) {
    const u = (y - lt) / (lb - lt);
    for (let x = x0; x < x1; x++) c.px(x, y, OAKW, n3(0, 0.9 - u * 1.3, 0.75), { bias: x === x0 ? 1 : x === x1 - 1 ? -1 : 0 });
  }
  grain(c, x0, x1, lt, lb, 312);
  // Iron bands and the brass lock.
  c.part();
  for (const bx of [x0 + 2, x1 - 3]) for (let y = lt; y < y1; y++) c.px(bx, y, IRON, y < lb ? n3(0, 0.5, 0.8) : FACE, { bias: 1 });
  for (let x = x0; x < x1; x++) c.px(x, lb, IRON, FACE, { bias: 0 });
  c.part();
  for (let y = lb - 1; y < lb + 3; y++) for (let x = g.cx - 1.5; x < g.cx + 1.5; x++) c.px(x, y, BRASS, FACE, { bias: y === lb - 1 ? 2 : 0 });
  c.px(g.cx - 0.5, lb + 1, SOOT, FACE);
  // A handle on the east end.
  c.part();
  c.px(x1, y1 - 4, IRON, EAST, { bias: 1 });
  c.px(x1, y1 - 5, IRON, EAST, { bias: 2 });
});

const barrel = art('barrel', 2, 18, (c, g) => {
  const cx = g.cx;
  const gy = g.y1 - 6;
  const H = 15;
  c.part();
  // Staves bulging at the middle.
  for (let z = 0; z < H; z++) {
    const bulge = 5.2 + Math.sin((z / (H - 1)) * Math.PI) * 1.2;
    for (let x = Math.floor(cx - bulge); x < Math.ceil(cx + bulge); x++) {
      const t = (x + 0.5 - cx) / bulge;
      if (Math.abs(t) > 1) continue;
      const e = Math.sqrt(1 - t * t) * 3;
      const y = Math.round(gy + e - z);
      const stave = Math.floor((Math.asin(t) + 2) * 3.4);
      c.px(x, y, OAKW, cyl(t, -0.2), { bias: stave % 2 ? -1 : 0 });
      if (Math.round(gy + e - z - 1) < y - 1) c.px(x, y - 1, OAKW, cyl(t, -0.2), { bias: stave % 2 ? -1 : 0 });
    }
  }
  // Iron hoops.
  c.part();
  for (const hz of [2, 7, 12]) {
    const bulge = 5.2 + Math.sin((hz / (H - 1)) * Math.PI) * 1.2 + 0.3;
    for (let x = Math.floor(cx - bulge); x < Math.ceil(cx + bulge); x++) {
      const t = (x + 0.5 - cx) / bulge;
      if (Math.abs(t) > 1) continue;
      const e = Math.sqrt(1 - t * t) * 3;
      c.px(x, Math.round(gy + e - hz), IRON, cyl(t, -0.1), { bias: 1 });
    }
  }
  c.part();
  c.ellipse(cx, gy - H, 5.2, 3, OAKW, { normal: () => TOP, bias: 1 });
  for (let x = cx - 5; x < cx + 5; x++) if ((x & 3) === 0) for (let y = gy - H - 2; y <= gy - H + 2; y++) if (c.materialAt(x, y) === OAKW) c.shade(x, y, -1);
  c.px(cx + 1, gy - H, SOOT, TOP);
});

const crate = art('crate', 2, 22, (c, g) => {
  const plankBox = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, seed: number) => {
    box(c, x0, x1, y0, y1, z0, z1, PALEW);
    grain(c, x0, x1, y0 - z1, y1 - z0, seed);
    // Frame boards round the face, a brace across it, and nails.
    const fy0 = y1 - z1;
    const fy1 = y1 - z0;
    for (let y = fy0; y < fy1; y++) {
      for (let x = x0; x < x1; x++) {
        const edge = x < x0 + 2 || x >= x1 - 2 || y < fy0 + 2 || y >= fy1 - 2;
        const brace = Math.abs((x - x0) / (x1 - x0) - (fy1 - 1 - y) / (fy1 - fy0)) < 0.09;
        if (edge || brace) c.shade(x, y, 1);
        else c.shade(x, y, -1);
      }
    }
    for (const [x, y] of [[x0 + 1, fy0 + 1], [x1 - 2, fy0 + 1], [x0 + 1, fy1 - 2], [x1 - 2, fy1 - 2]]) c.shade(x, y, -3);
  };
  plankBox(g.x0 + 1, g.x1 - 1, g.y0 + 3, g.y1 - 2, 0, 10, 321);
  plankBox(g.x0 + 6, g.x1 - 1, g.y0 + 4, g.y1 - 6, 10, 17, 322);
  // Straw poking out from under the small one's lid.
  c.part();
  for (let k = 0; k < 4; k++) c.px(g.x0 + 7 + k * 2, g.y1 - 6 - 18, HAY, TOP, { bias: 2 });
});

const fireplace = art('fireplace', 2, 36, (c, g, f) => {
  const x0 = g.x0 + 1;
  const x1 = g.x1 - 1;
  const gy = g.y0 + 9;
  // Chimney breast above, then the hearth's stone body.
  box(c, x0 + 6, x1 - 6, g.y0 + 1, g.y0 + 6, 20, 36, FIELDSTONE);
  box(c, x0, x1, g.y0 + 1, gy, 0, 20, FIELDSTONE);
  for (let y = g.y0 - 35; y < gy; y++) {
    for (let x = x0; x < x1; x++) {
      if (c.materialAt(x, y) !== FIELDSTONE) continue;
      const row = Math.floor((gy - y) / 4);
      const off = row % 2 ? 3 : 0;
      if ((gy - y) % 4 === 0 || (x + off) % 6 === 0) c.shade(x, y, -2);
      else c.shade(x, y, Math.round((hash2(Math.floor((x + off) / 6), row, 331) - 0.5) * 2));
    }
  }
  // The firebox: an arch, sooty inside.
  const cx = g.cx;
  c.part();
  for (let z = 0; z < 13; z++) {
    for (let x = Math.floor(cx - 9); x < cx + 9; x++) {
      const dx = Math.abs(x + 0.5 - cx);
      if (z > 8 && Math.hypot(dx, (z - 8) * 1.8) > 9) continue;
      c.px(x, gy - 1 - z, SOOT, FACE, { bias: z < 2 ? 1 : 0 });
    }
  }
  // Keystones round the arch.
  for (let a = 0; a <= 8; a++) {
    const t = (a / 8) * Math.PI;
    c.shade(cx - Math.cos(t) * 10, gy - 1 - 8 - Math.sin(t) * 5.5, 2);
  }
  // Logs and the fire on them.
  c.part();
  c.capsule(cx - 6, gy - 2, cx + 4, gy - 3, 1.5, 1.5, OAKW);
  c.capsule(cx - 3, gy - 3, cx + 6, gy - 2, 1.4, 1.4, DARKW);
  c.part();
  for (let x = Math.floor(cx - 6); x < cx + 6; x++) c.px(x, gy - 1, EMBERS, FACE, { bias: hash2(x, f, 332) > 0.5 ? 1 : -1 });
  flame(c, cx - 2, gy - 4, 3.5, 9, f, 333);
  flame(c, cx + 3, gy - 4, 2.6, 7, (f + 2) % 4, 334);
  halo(c, cx, gy - 6, 9, [255, 140, 50], 0.35);
  // Mantel, candles, and the hearthstone in front.
  box(c, x0 - 1, x1 + 1, g.y0 + 7, gy + 2, 18, 20, OAKW);
  grain(c, x0 - 1, x1 + 1, g.y0 - 13, gy - 18, 335);
  for (const kx of [x0 + 3, x1 - 4]) {
    c.part();
    for (let z = 20; z < 24; z++) c.px(kx, gy - z, WAX, FACE, { bias: 2 });
    c.spark(kx, gy - 25, FIRE_COLS[(f + kx) % 2], 0.9);
    c.spark(kx, gy - 26, FIRE_COLS[0], 0.4);
  }
  drum(c, cx, gy - 3, 2, 1, 20, 23, BRASS, BRASS);
  box(c, x0 + 2, x1 - 2, gy, gy + 4, 0, 1, PALE_STONE);
}, 4, 9);

const cauldron = art('cauldron', 3, 14, (c, g, f) => {
  const gy = g.y1 - 6;
  // Its fire underneath, between the legs.
  flame(c, g.cx, gy, 3, 4, f, 341, 0.9);
  c.part();
  c.line(g.cx - 5, gy + 1, g.cx - 4, gy - 4, IRON, () => WEST);
  c.line(g.cx + 5, gy + 1, g.cx + 4, gy - 4, IRON, () => EAST);
  c.part();
  c.ellipse(g.cx, gy - 7, 6.5, 5, IRON, { flatten: 0.9 });
  c.part();
  c.ellipse(g.cx, gy - 11, 6.2, 2.2, IRON, { normal: () => TOP, bias: 2 });
  c.part();
  c.ellipse(g.cx, gy - 11, 5, 1.5, BREW, { normal: () => TOP });
  // Bubbles rising and bursting.
  const R = rng(342 + f * 5);
  for (let k = 0; k < 3; k++) c.px(g.cx - 3 + R() * 6, gy - 11 + (R() - 0.5), BREW, TOP, { bias: 3 });
  for (let k = 0; k < 3; k++) c.spark(g.cx - 3 + R() * 6, gy - 13 - ((f + k) % 4) * 1.5, [150, 255, 150], 0.5 - ((f + k) % 4) * 0.1);
  c.part();
  c.px(g.cx - 6, gy - 10, IRON, WEST, { bias: 1 });
  c.px(g.cx + 6, gy - 10, IRON, EAST, { bias: 1 });
}, 4, 7);

const clock = art('clock', 2, 38, (c, g, f) => {
  const x0 = g.cx - 5;
  const x1 = g.cx + 5;
  const gy = g.y0 + 11;
  box(c, x0 - 1, x1 + 1, g.y0 + 4, gy + 1, 0, 3, DARKW);
  box(c, x0, x1, g.y0 + 4, gy, 3, 30, DARKW);
  grain(c, x0, x1, gy - 30, gy - 3, 351, false);
  // Hood with a round pediment.
  box(c, x0 - 1, x1 + 1, g.y0 + 3, gy + 1, 30, 32, OAKW);
  c.part();
  for (let x = x0; x < x1; x++) {
    const rise = Math.round(Math.sqrt(Math.max(0, 1 - ((x + 0.5 - g.cx) / 5) ** 2)) * 3);
    for (let k = 1; k <= rise; k++) c.px(x, gy + 1 - 32 - k, OAKW, FACE, { bias: k === rise ? 2 : 0 });
  }
  // The dial, hands, and brass spandrels.
  c.part();
  c.ellipse(g.cx, gy - 25, 3.6, 3.6, DIAL, { normal: () => FACE, bias: 1 });
  for (let k = 0; k < 12; k += 3) c.shade(g.cx + Math.cos((k / 12) * Math.PI * 2) * 3, gy - 25 + Math.sin((k / 12) * Math.PI * 2) * 3, -3);
  c.line(g.cx, gy - 25, g.cx, gy - 27, SOOT, () => FACE);
  c.line(g.cx, gy - 25, g.cx + 2, gy - 24, SOOT, () => FACE);
  // A glass window with the pendulum swinging behind it.
  c.part();
  for (let z = 6; z < 19; z++) for (let x = x0 + 2; x < x1 - 2; x++) c.px(x, gy - z, GLASS, FACE, { bias: -2 + (x === x0 + 2 ? 1 : 0) });
  const swing = [0, 1.5, 0, -1.5][f];
  c.part();
  c.line(g.cx, gy - 18, g.cx + swing, gy - 10, BRASS, () => FACE, { bias: 1 });
  c.ellipse(g.cx + swing, gy - 9, 1.6, 1.6, BRASS, { bias: 1 });
  c.part();
  c.line(x0 + 3, gy - 18, x0 + 5, gy - 16, GLASS, () => FACE, { bias: 4 });
}, 4, 2);

const armorstand = art('armorstand', 5, 32, (c, g) => {
  const cx = g.cx;
  const gy = g.y1 - 6;
  // Cross-footed stand and its pole.
  box(c, cx - 5, cx + 5, gy - 1, gy + 1, 0, 1, OAKW);
  box(c, cx - 1, cx + 1, gy - 4, gy + 4, 0, 1, OAKW);
  box(c, cx - 1, cx + 1, gy - 1, gy + 1, 0, 26, OAKW);
  // Mail skirt, a red tabard under the breastplate.
  c.part();
  c.shape(gy - 12, gy - 5, (y) => [cx - 4.6 - (y - gy + 12) * 0.1, cx + 4.6 + (y - gy + 12) * 0.1], STEEL, (x, y, t) => n3(t * 0.6, -0.2, 0.8 + ((x + y) % 2) * 0.1));
  for (let y = gy - 12; y < gy - 5; y++) for (let x = cx - 5; x < cx + 5; x++) if ((x + y) % 2 === 0) c.shade(x, y, -2);
  c.part();
  c.shape(gy - 14, gy - 3, (y) => [cx - 2, cx + 2 - (y > gy - 5 ? 1 : 0)], QUILT_R, () => FACE);
  for (let y = gy - 14; y < gy - 3; y++) {
    c.shade(cx - 2, y, 2);
    c.shade(cx + 1, y, -1);
  }
  c.part();
  c.shape(gy - 23, gy - 12, (y) => {
    const u = (y - gy + 23) / 11;
    const hw = 5.2 - u * 1.4;
    return [cx - hw, cx + hw];
  }, STEEL, (_x, _y, t, u) => n3(t * 0.8, 0.2 - u * 0.5, 0.75));
  c.shade(cx, gy - 18, 2);
  c.shade(cx, gy - 17, 2);
  // Pauldrons.
  c.part();
  c.ellipse(cx - 5.5, gy - 22, 2.6, 2.2, STEEL);
  c.ellipse(cx + 5.5, gy - 22, 2.6, 2.2, STEEL);
  // Great helm with a slit and a red plume.
  c.part();
  c.shape(gy - 30, gy - 24, (y) => [cx - 3.2, cx + 3.2 - (y === gy - 30 ? 0.5 : 0)], STEEL, (_x, _y, t) => cyl(t, 0.1));
  for (let x = cx - 2; x < cx + 3; x++) c.px(x, gy - 27, SOOT, FACE);
  c.px(cx, gy - 25, SOOT, FACE);
  c.part();
  c.capsule(cx, gy - 30, cx - 3, gy - 34, 1.4, 0.8, QUILT_R);
});

const weaponrack = art('weaponrack', 1, 30, (c, g) => {
  const x0 = g.x0 + 2;
  const x1 = g.x1 - 2;
  const gy = g.y0 + 6;
  for (const x of [x0, x1 - 2]) box(c, x, x + 2, gy - 2, gy, 0, 20, OAKW);
  box(c, x0, x1, gy - 2, gy - 1, 17, 19, DARKW);
  box(c, x0, x1, g.y0 + 2, gy + 3, 0, 2, DARKW);
  // A sword, an axe and a spear, leaning in the rack.
  c.part();
  const sx = x0 + 6;
  c.line(sx, gy - 3, sx + 1, gy - 22, STEEL, () => FACE, { bias: 2 });
  c.line(sx + 1, gy - 4, sx + 2, gy - 22, STEEL, () => EAST, { bias: -1 });
  c.part();
  c.line(sx - 2, gy - 20, sx + 4, gy - 21, BRASS, () => FACE, { bias: 1 });
  c.line(sx + 1, gy - 22, sx + 1, gy - 25, BURLAP, () => FACE);
  c.px(sx + 1, gy - 26, BRASS, FACE, { bias: 2 });
  c.part();
  const ax = g.cx + 1;
  c.line(ax, gy - 2, ax + 1, gy - 24, PALEW, () => FACE, { bias: 1 });
  c.part();
  c.shape(gy - 24, gy - 17, (y) => {
    const u = (y - gy + 24) / 7;
    const hw = 1 + Math.sin(u * Math.PI) * 3.5;
    return [ax + 1, ax + 2 + hw];
  }, STEEL, (_x, _y, t) => n3(t * 0.5, 0, 0.9));
  c.part();
  const px2 = x1 - 7;
  c.line(px2, gy - 1, px2 + 1, gy - 28, OAKW, () => FACE, { bias: 1 });
  c.part();
  c.shape(gy - 33, gy - 28, (y) => {
    const u = (y - gy + 33) / 5;
    const hw = 0.3 + Math.sin(u * Math.PI * 0.8) * 1.4;
    return [px2 + 1.5 - hw, px2 + 1.5 + hw];
  }, STEEL, (_x, _y, t) => cyl(t));
  // A round shield leaning at the front.
  c.part();
  const shx = x1 - 12;
  const shy = gy + 1 - 6;
  c.ellipse(shx, shy, 5.5, 5.5, OAKW, { flatten: 0.6 });
  for (let y = shy - 5; y < shy; y++) for (let x = shx; x < shx + 6; x++) if (c.materialAt(x, y) === OAKW) c.px(x, y, QUILT_R, sphere((x - shx) / 5.5, (y - shy) / 5.5, 0.6));
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    c.px(shx + Math.cos(t) * 5, shy + Math.sin(t) * 5, IRON, sphere(Math.cos(t) * 0.7, Math.sin(t) * 0.7), { bias: 1 });
  }
  c.part();
  c.ellipse(shx, shy, 1.5, 1.5, STEEL);
});

/** Where the critter shelf's jars stand: px from its footprint's top-left, each jar's foot. */
export const JAR_SPOTS = { y: 0, xs: [9, 24, 39] };

const jarShelf = art('jarshelf', 1, 16, (c, g) => {
  // A low glass-fronted cabinet, the jars standing along its top (placed by the world, see Home.ts).
  const x0 = g.x0 + 1;
  const x1 = g.x1 - 1;
  const y1 = g.y1 - 3;
  box(c, x0 + 1, x1 - 1, g.y0 + 4, y1, 0, 2, DARKW);
  box(c, x0, x1, g.y0 + 4, y1, 2, 11, OAKW);
  grain(c, x0, x1, y1 - 11, y1 - 2, 471);
  // Three glazed doors, a brass plaque on each.
  c.part();
  for (let k = 0; k < 3; k++) {
    const a = x0 + 2 + k * 15;
    for (let z = 3; z < 9; z++) for (let x = a; x < a + 12; x++) {
      const edge = x === a || x === a + 11 || z === 3 || z === 8;
      c.px(x, y1 - 1 - z, edge ? DARKW : GLASS, FACE, { bias: edge ? 1 : x - a === 2 && z > 4 ? 3 : -2 });
    }
    for (let x = a + 4; x < a + 8; x++) c.px(x, y1 - 11 + 1, BRASS, FACE, { bias: x === a + 4 ? 2 : 0 });
  }
  // Its top: a dark shelf of polished wood with a lip.
  box(c, x0 - 1, x1 + 1, g.y0 + 3, y1 + 1, 11, 12, DARKW, { topBias: 1 });
});

const pottedPlant = art('plant', 5, 22, (c, g) => {
  const gy = g.y1 - 6;
  drum(c, g.cx, gy, 4.5, 2.5, 0, 8, TERRA, SOIL);
  drum(c, g.cx, gy, 5, 2.8, 6, 8, TERRA, null, { bias: 1 });
  // Broad split leaves on arching stems, leaning to one side.
  const R = rng(361);
  const leaves = [
    { a: -2.4, l: 9, s: 3.4 },
    { a: -1.9, l: 12, s: 3.8 },
    { a: -1.35, l: 14, s: 4 },
    { a: -0.9, l: 11, s: 3.6 },
    { a: -0.5, l: 8, s: 3.2 },
    { a: -1.6, l: 7, s: 3 },
  ];
  for (const lf of leaves) {
    c.part();
    const bx = g.cx;
    const by = gy - 9;
    const ex = bx + Math.cos(lf.a) * lf.l;
    const ey = by + Math.sin(lf.a) * lf.l * 0.9;
    c.line(bx, by, ex, ey + 1, STEM);
    c.part();
    c.ellipse(ex, ey, lf.s, lf.s * 0.7, LEAF, { flatten: 0.8 });
    // The splits and the midrib.
    for (let k = -1; k <= 1; k += 2) c.erase(ex + k * lf.s * 0.9, ey + (R() - 0.5));
    c.line(ex - Math.cos(lf.a) * lf.s * 0.8, ey, ex + Math.cos(lf.a) * lf.s * 0.6, ey - 0.5, LEAF, () => TOP, { bias: 2 });
  }
});

/** A rug: a flat field inside a border, fringed at its ends. */
function rugArt(field: Material, border: Material, round = false, ends: 'x' | 'y' = 'x'): Drawer {
  return (c, g) => {
    c.part();
    if (round) {
      const rx = (g.x1 - g.x0) / 2 - 2;
      const ry = (g.y1 - g.y0) / 2 - 3;
      for (let y = g.y0; y < g.y1; y++) {
        for (let x = g.x0; x < g.x1; x++) {
          const d = Math.hypot((x + 0.5 - g.cx) / rx, (y + 0.5 - g.cy) / ry);
          if (d > 1) continue;
          // Braided rings, each a colour, the braid stippled across it.
          const ring = Math.floor(d * 6);
          const m = ring % 3 === 0 ? field : ring % 3 === 1 ? border : LINEN;
          const braid = hash2(Math.floor(Math.atan2(y - g.cy, x - g.cx) * 12), ring, 371) > 0.5;
          c.px(x, y, m, FLOOR, { bias: (braid ? 1 : 0) - (d > 0.94 ? 1 : 0) });
        }
      }
      return;
    }
    const x0 = g.x0 + (ends === 'x' ? 3 : 2);
    const x1 = g.x1 - (ends === 'x' ? 3 : 2);
    const y0 = g.y0 + (ends === 'y' ? 3 : 2);
    const y1 = g.y1 - (ends === 'y' ? 3 : 2);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const e = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y);
        let m = field;
        let b = 0;
        if (e < 3) {
          m = border;
          b = e === 1 ? 1 : 0;
          if (e === 1 && (x + y) % 4 === 0) b = -1;
        } else {
          // A diamond medallion and a lattice in the field.
          const dx = Math.abs(x + 0.5 - (x0 + x1) / 2) / ((x1 - x0) / 2 - 3);
          const dy = Math.abs(y + 0.5 - (y0 + y1) / 2) / ((y1 - y0) / 2 - 3);
          const d = dx + dy;
          if (d < 0.45) {
            m = d < 0.2 ? border : field;
            b = d < 0.2 ? 1 : 2;
          } else if (Math.abs(d - 0.55) < 0.06) m = border;
          else if ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0) b = -1;
        }
        c.px(x, y, m, FLOOR, { bias: b });
      }
    }
    // Fringe.
    c.part();
    if (ends === 'x') {
      for (let y = y0 + 1; y < y1 - 1; y += 2) {
        c.px(x0 - 1, y, LINEN, FLOOR, { bias: 1 });
        c.px(x0 - 2, y, LINEN, FLOOR, { bias: 0 });
        c.px(x1, y, LINEN, FLOOR, { bias: 1 });
        c.px(x1 + 1, y, LINEN, FLOOR, { bias: 0 });
      }
    } else {
      for (let x = x0 + 1; x < x1 - 1; x += 2) {
        c.px(x, y0 - 1, LINEN, FLOOR, { bias: 1 });
        c.px(x, y0 - 2, LINEN, FLOOR, { bias: 0 });
        c.px(x, y1, LINEN, FLOOR, { bias: 1 });
        c.px(x, y1 + 1, LINEN, FLOOR, { bias: 0 });
      }
    }
  };
}

const rug = art('rug', 0, 0, rugArt(QUILT_R, GOLD_CLOTH));
const roundrug = art('roundrug', 0, 0, rugArt(QUILT_B, TULIP_R, true));
const runner = art('runner', 0, 0, rugArt(VELVET, GOLD_CLOTH, false, 'y'));

// ---------------------------------------------------------------- Lights

const lamppost = art('lamppost', 5, 46, (c, g) => {
  const cx = g.cx;
  const gy = g.y1 - 6;
  drum(c, cx, gy, 3.2, 1.8, 0, 3, IRON);
  drum(c, cx, gy, 1, 0.6, 3, 34, IRON, null);
  drum(c, cx, gy, 1.8, 1, 16, 18, IRON);
  // Lantern: four iron posts round warm glass, a pointed cap, a ring on top.
  c.part();
  const ly = gy - 34;
  for (let y = ly - 8; y < ly; y++) {
    const hw = 3 + (y > ly - 3 ? -1 : 0);
    for (let x = cx - hw; x < cx + hw; x++) {
      const post = x === cx - hw || x === cx + hw - 1;
      c.px(x, y, post ? IRON : LAMP, post ? FACE : cyl((x + 0.5 - cx) / hw, 0), { bias: post ? 1 : 3 - Math.abs(Math.floor(x + 0.5 - cx)) });
    }
  }
  c.part();
  c.shape(ly - 13, ly - 8, (y) => {
    const hw = 1 + ((y - ly + 13) / 5) * 3.5;
    return [cx - hw, cx + hw];
  }, IRON, (_x, _y, t, u) => n3(t * 0.6, 0.6 - u * 0.4, 0.7));
  c.part();
  c.px(cx - 0.5, ly - 14, IRON, TOP, { bias: 2 });
  halo(c, cx, ly - 4, 7, [255, 200, 120], 0.35);
});

const stoneLantern = art('lantern', 4, 24, (c, g, f) => {
  const cx = g.cx;
  const gy = g.y1 - 6;
  drum(c, cx, gy, 4.5, 2.4, 0, 2, PALE_STONE);
  drum(c, cx, gy, 1.8, 1, 2, 9, PALE_STONE);
  box(c, cx - 4, cx + 4, gy - 3, gy + 2, 9, 16, PALE_STONE);
  // Its window: the flame inside flickering.
  c.part();
  for (let y = gy + 2 - 15; y < gy + 2 - 10; y++) for (let x = cx - 2; x < cx + 2; x++) c.px(x, y, LAMP, FACE, { bias: f % 2 ? 2 : 1 });
  flame(c, cx, gy + 2 - 11, 1.4, 4, f, 381, 0.8);
  // A wide, upswept cap and its finial.
  c.part();
  for (let y = gy + 2 - 20; y < gy + 2 - 16; y++) {
    const u = (y - (gy + 2 - 20)) / 3;
    const hw = 2.5 + u * 5;
    for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) c.px(x, y, PALE_STONE, n3((x + 0.5 - cx) / hw * 0.7, 0.6, 0.6), { bias: y === gy + 2 - 17 ? 1 : 0 });
  }
  c.px(cx - 6, gy + 2 - 17, PALE_STONE, TOP, { bias: 2 });
  c.px(cx + 5, gy + 2 - 17, PALE_STONE, TOP, { bias: 1 });
  c.part();
  c.ellipse(cx, gy + 2 - 21.5, 1.5, 1.5, PALE_STONE);
  // Moss on its cap.
  c.part();
  for (let x = cx - 4; x < cx + 2; x++) if (hash2(x, 1, 382) > 0.45) c.px(x, gy + 2 - 20 + (x & 1), MOSS, TOP, { bias: 1 });
  halo(c, cx, gy - 11, 6, [255, 180, 90], 0.3);
}, 4, 8);

const torch = art('torch', 4, 32, (c, g, f) => {
  const cx = g.cx;
  const gy = g.y1 - 6;
  c.part();
  c.shape(gy - 22, gy, (y) => {
    const u = (y - gy + 22) / 22;
    const hw = 0.9 + u * 0.5;
    return [cx - hw, cx + hw];
  }, OAKW, (_x, _y, t) => cyl(t, 0));
  // Iron cage and rag.
  c.part();
  c.shape(gy - 26, gy - 21, (y) => {
    const hw = 2.4 - (y - gy + 26) * 0.2;
    return [cx - hw, cx + hw];
  }, IRON, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  c.ellipse(cx, gy - 26, 2, 0.8, EMBERS);
  flame(c, cx, gy - 26, 2.2, 8, f, 391);
  halo(c, cx, gy - 29, 5, [255, 150, 60], 0.3);
  tufts(c, cx, gy + 1, 3, 392, 3);
}, 4, 9);

const campfire = art('campfire', 3, 18, (c, g, f) => {
  const cx = g.cx;
  const gy = g.y1 - 8;
  // Ash bed glowing.
  c.part();
  c.ellipse(cx, gy, 6, 3, SOOT, { normal: () => FLOOR });
  c.part();
  c.ellipse(cx, gy, 4, 2, EMBERS, { normal: () => FLOOR, bias: f % 2 });
  // Stones round the back half, then logs leaning together, then the front stones.
  const stones = Array.from({ length: 9 }, (_, k) => {
    const a = (k / 9) * Math.PI * 2;
    return { x: cx + Math.cos(a) * 7.5, y: gy + Math.sin(a) * 4, k };
  });
  for (const s of stones.filter((s) => s.y < gy)) {
    c.part();
    c.ellipse(s.x, s.y - 1, 2, 1.6, FIELDSTONE, { bias: s.k % 2 });
  }
  c.part();
  c.capsule(cx - 5, gy + 1, cx + 1, gy - 5, 1.2, 0.8, OAKW);
  c.capsule(cx + 5, gy + 1, cx - 1, gy - 5, 1.2, 0.8, DARKW);
  c.capsule(cx - 1, gy + 3, cx + 0.5, gy - 5, 1.1, 0.8, OAKW);
  flame(c, cx, gy - 1, 4.2, 12, f, 401);
  flame(c, cx + 2, gy - 1, 2, 6, (f + 1) % 4, 402, 0.8);
  for (const s of stones.filter((s) => s.y >= gy)) {
    c.part();
    c.ellipse(s.x, s.y - 1, 2.1, 1.7, FIELDSTONE, { bias: s.k % 2 });
  }
  // Sparks rising.
  c.spark(cx - 2 + f, gy - 14 - f, FIRE_COLS[1], 0.9);
  c.spark(cx + 3 - f, gy - 16 + (f % 2), FIRE_COLS[0], 0.7);
  halo(c, cx, gy - 4, 9, [255, 130, 50], 0.3);
}, 4, 9);

const candelabra = art('candelabra', 4, 30, (c, g, f) => {
  const cx = g.cx;
  const gy = g.y1 - 6;
  drum(c, cx, gy, 3.4, 1.8, 0, 2, BRASS);
  drum(c, cx, gy, 0.9, 0.5, 2, 18, BRASS, null);
  drum(c, cx, gy, 1.6, 0.8, 8, 10, BRASS);
  // Two curling arms and three cups.
  c.part();
  for (const s of [-1, 1]) {
    c.capsule(cx, gy - 16, cx + s * 4, gy - 16, 0.7, 0.7, BRASS);
    c.capsule(cx + s * 5, gy - 17, cx + s * 5, gy - 19, 0.7, 0.7, BRASS);
  }
  const tops = [cx - 5, cx, cx + 5];
  tops.forEach((x, k) => {
    const base = k === 1 ? gy - 19 : gy - 20;
    c.part();
    c.ellipse(x, base, 1.6, 0.8, BRASS, { bias: 1 });
    c.part();
    const h = k === 1 ? 6 : 4;
    for (let z = 0; z < h; z++) c.px(x, base - 1 - z, WAX, FACE, { bias: 2 });
    c.px(x + 0.5, base - 1, WAX, FACE, { bias: 1 });
    // A drip of wax.
    if (k === 0) c.px(x - 1, base - 2, WAX, FACE, { bias: 3 });
    flame(c, x, base - h - 1, 0.9, 3, (f + k) % 4, 411 + k);
  });
  halo(c, cx, gy - 24, 7, [255, 190, 110], 0.3);
}, 4, 8);

const fireflyJar = art('fairylights', 4, 14, (c, g, f) => {
  const cx = g.cx;
  const gy = g.y1 - 6;
  // A glass jar: faint, with highlights down its side.
  drum(c, cx, gy, 4.2, 2.2, 0, 10, GLASS, null, { bias: -2 });
  c.part();
  for (let z = 1; z < 9; z++) {
    c.px(cx - 3, gy + 1 - z, GLASS, FACE, { bias: 4 });
    if (z > 2 && z < 7) c.px(cx + 2, gy + 1 - z, GLASS, FACE, { bias: 1 });
  }
  c.part();
  c.ellipse(cx, gy - 10, 3.8, 1.8, GLASS, { normal: () => TOP, bias: 1 });
  drum(c, cx, gy - 10, 2.6, 1.3, 0, 2, OAKW);
  c.part();
  c.line(cx - 3, gy - 11, cx + 3, gy - 11, BURLAP, () => FACE, { bias: 1 });
  // The fireflies drifting, and their soft light.
  const R = rng(421);
  for (let k = 0; k < 6; k++) {
    const ph = R() * Math.PI * 2;
    const x = cx + Math.cos(ph + f * 1.3) * 2.2;
    const y = gy - 5 + Math.sin(ph * 1.7 + f * 1.1) * 3;
    c.spark(x, y, [220, 255, 140], 0.95);
    c.spark(x + 1, y, [160, 230, 90], 0.3);
  }
  halo(c, cx, gy - 5, 6, [180, 240, 110], 0.25);
  tufts(c, cx, gy + 2, 5, 422, 4);
}, 4, 5);

const mushLamp = art('mushlamp', 4, 16, (c, g, f) => {
  // A little toadstool lamp: a glowing cap with cream spots on a stout stalk,
  // a baby one beside it, breathing its light slowly in and out.
  const cx = g.cx + 1;
  const gy = g.y1 - 6;
  const breath = [0, 1, 1, 0][f];
  c.part();
  c.ellipse(cx - 1, gy + 0.5, 5, 2, MOSS, { normal: () => FLOOR });
  // The baby, behind and to the left.
  const bx = cx - 5;
  c.part();
  c.shape(gy - 4, gy - 1, (y) => [bx - 0.8 - (y - gy + 4) * 0.1, bx + 0.8 + (y - gy + 4) * 0.1], STALK, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.shape(gy - 7, gy - 3, (y) => {
    const u = (y - gy + 7) / 4;
    const hw = 0.8 + Math.sqrt(u) * 2;
    return [bx - hw, bx + hw];
  }, SHROOM, (_x, _y, t, u) => n3(t * 0.7, 0.6 - u * 0.7, 0.7), { bias: breath - 1 });
  c.px(bx - 1, gy - 6, SPOTS, TOP, { bias: 1 });
  // The stalk, flared at its foot, and the gills under the cap.
  c.part();
  c.shape(gy - 8, gy, (y) => {
    const u = (y - gy + 8) / 8;
    const hw = 1.6 + u * u * 0.9;
    return [cx - hw, cx + hw];
  }, STALK, (_x, _y, t) => cyl(t, -0.1));
  c.part();
  for (let x = cx - 4; x < cx + 4; x++) c.px(x, gy - 8, STALK, n3(0, -0.8, 0.4), { bias: -2 + (x & 1) });
  // The cap: a round dome, lit from within.
  c.part();
  c.shape(gy - 15, gy - 8, (y) => {
    const u = (y - gy + 15) / 7;
    const hw = 1 + Math.sqrt(u) * 4.6;
    return [cx - hw, cx + hw];
  }, SHROOM, (_x, _y, t, u) => n3(t * 0.75, 0.62 - u * 0.8, 0.66), { bias: breath - 1 });
  for (const [x, y, b] of [[-2, -13, 2], [2, -12, 1], [-3, -10, 0], [1, -14, 2], [3, -10, 0]]) c.px(cx + x, gy + y, SPOTS, TOP, { bias: b });
  c.px(cx + 3, gy - 11, SPOTS, TOP, { bias: 0 });
  // Two motes drifting round it.
  c.spark(cx - 4 + f, gy - 14 - (f % 2), [255, 214, 196], 0.8);
  c.spark(cx + 5 - (f % 2), gy - 7 - f, [255, 190, 170], 0.6);
  halo(c, cx, gy - 10, 7, [255, 170, 150], 0.26 + breath * 0.08);
  tufts(c, cx, gy + 2, 5, 431, 4);
}, 4, 3);

// ---------------------------------------------------------------- Wall decor

/** A frame of a colour round an inner area. */
function frame(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, m: Material): void {
  c.part();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (x > x0 && x < x1 - 1 && y > y0 && y < y1 - 1) continue;
      c.px(x, y, m, FACE, { bias: y === y0 || x === x0 ? 2 : y === y1 - 1 || x === x1 - 1 ? -1 : 0 });
    }
  }
}

const painting = decor((c) => {
  // A landscape: sky, a sun, hills and a tree, inside a gilt frame.
  c.part();
  for (let y = 4; y < 12; y++) {
    for (let x = 3; x < 13; x++) {
      const hill = 8 + Math.sin(x * 0.7) * 1.2;
      const far = 7 + Math.cos(x * 0.5 + 1) * 1;
      if (y > hill) c.px(x, y, PAINT_HILL, FACE, { bias: 1 - (y > 10 ? 1 : 0) });
      else if (y > far) c.px(x, y, PAINT_HILL, FACE, { bias: 3 });
      else c.px(x, y, PAINT_SKY, FACE, { bias: 3 - Math.floor((y - 4) / 2) });
    }
  }
  c.px(10, 5, PETAL_Y, FACE, { bias: 3 });
  c.px(5, 8, PAINT_DARK, FACE, { bias: 2 });
  c.px(5, 7, PAINT_HILL, FACE, { bias: 0 });
  c.px(4, 7, PAINT_HILL, FACE, { bias: 0 });
  c.px(6, 7, PAINT_HILL, FACE, { bias: 0 });
  c.px(5, 6, PAINT_HILL, FACE, { bias: 1 });
  frame(c, 2, 3, 14, 13, BRASS);
});

const portrait = decor((c) => {
  c.part();
  for (let y = 3; y < 15; y++) for (let x = 4; x < 12; x++) c.px(x, y, PAINT_DARK, FACE, { bias: 1 });
  // A stern ancestor: dark coat, a white collar, a face and grey hair.
  c.part();
  c.shape(10, 14, (y) => [8 - 1.5 - (y - 10) * 0.6, 8 + 1.5 + (y - 10) * 0.6], PAINT_DARK, () => FACE, { bias: 3 });
  c.px(7, 10, LINEN, FACE, { bias: 1 });
  c.px(8, 10, LINEN, FACE, { bias: 1 });
  c.part();
  c.ellipse(8, 7.5, 1.8, 2.2, SKIN, { flatten: 0.8 });
  c.px(7, 5, LINEN, FACE, { bias: -1 });
  c.px(8, 5, LINEN, FACE, { bias: -1 });
  c.px(6.5, 6, LINEN, FACE, { bias: -2 });
  frame(c, 3, 2, 13, 16, BRASS);
});

const banner = decor((c) => {
  c.part();
  for (let x = 3; x < 13; x++) c.px(x, 2, BRASS, FACE, { bias: x === 3 || x === 12 ? 2 : 0 });
  c.part();
  for (let y = 3; y < 17; y++) {
    for (let x = 4; x < 12; x++) {
      // Swallowtail hem.
      if (y > 13 && Math.abs(x + 0.5 - 8) < (y - 13) * 1.1) continue;
      const fold = Math.sin(x * 1.3) * 0.3;
      c.px(x, y, BANNER, n3(fold, -0.3, 0.9), { bias: x === 4 || x === 11 ? 3 : 0 });
    }
  }
  for (let y = 3; y < 15; y++) {
    c.px(4, y, GOLD_CLOTH, FACE, { bias: 1 });
    c.px(11, y, GOLD_CLOTH, FACE, { bias: 0 });
  }
  // A gold star.
  c.part();
  for (const [x, y] of [[8, 6], [7, 7], [8, 7], [9, 7], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [7, 9], [8, 9], [9, 9], [7, 10], [9, 10]]) c.px(x - 0.5, y, GOLD_CLOTH, FACE, { bias: 3 });
});

const crest = decor((c) => {
  // Two crossed swords behind a heater shield.
  c.part();
  c.line(2, 2, 14, 15, STEEL, () => FACE, { bias: 2 });
  c.line(14, 2, 2, 15, STEEL, () => FACE, { bias: 2 });
  c.px(2, 2, BRASS, FACE, { bias: 2 });
  c.px(13, 2, BRASS, FACE, { bias: 2 });
  c.part();
  c.shape(3, 15, (y) => {
    const u = (y - 3) / 12;
    const hw = u < 0.5 ? 5 : 5 * Math.cos(((u - 0.5) / 0.5) * Math.PI * 0.5) + 0.3;
    return [8 - hw, 8 + hw];
  }, QUILT_R, (_x, _y, t) => n3(t * 0.5, -0.3, 0.85));
  // Quartered, white and red, with a gold rim.
  for (let y = 3; y < 15; y++) {
    for (let x = 3; x < 13; x++) {
      if (c.materialAt(x, y) !== QUILT_R) continue;
      if ((x < 8) !== (y < 9)) c.px(x, y, LINEN, n3((x - 8) / 10, -0.3, 0.85), { bias: 0 });
      if (!c.filled(x - 1, y) || !c.filled(x + 1, y) || y === 3 || (c.materialAt(x, y + 1) !== QUILT_R && c.materialAt(x, y + 1) !== LINEN)) c.px(x, y, BRASS, FACE, { bias: 1 });
    }
  }
});

const antlers = decor((c) => {
  c.part();
  c.shape(8, 14, (y) => [8 - 2.6 + (y - 8) * 0.25, 8 + 2.6 - (y - 8) * 0.25], OAKW, (_x, _y, t) => n3(t * 0.5, -0.3, 0.85));
  c.part();
  for (const s of [-1, 1]) {
    c.capsule(8 + s * 1.5, 8, 8 + s * 5, 5, 0.8, 0.6, ANTLER);
    c.capsule(8 + s * 5, 5, 8 + s * 6.5, 1.5, 0.6, 0.4, ANTLER);
    c.capsule(8 + s * 3.5, 6.5, 8 + s * 3.5, 3, 0.6, 0.4, ANTLER);
    c.capsule(8 + s * 5.5, 4.5, 8 + s * 7.5, 4, 0.5, 0.4, ANTLER);
  }
});

const wallshelf = decor((c) => {
  // A plank on two brackets, with jars, a lying book and a trailing plant.
  box(c, 1, 15, 10, 12, 0, 2, OAKW);
  c.part();
  c.line(3, 12, 4, 14, DARKW, () => FACE);
  c.line(12, 12, 11, 14, DARKW, () => FACE);
  c.part();
  for (let y = 4; y < 8; y++) for (let x = 2; x < 5; x++) c.px(x, y, GLASS, FACE, { bias: x === 2 ? 3 : 0 });
  for (let x = 2; x < 5; x++) c.px(x, 3, OAKW, TOP, { bias: 1 });
  for (let y = 5; y < 8; y++) for (let x = 6; x < 8; x++) c.px(x, y, BREW, FACE, { bias: 1, glow: 0.3 });
  c.part();
  for (let y = 6; y < 8; y++) for (let x = 9; x < 14; x++) c.px(x, y, BOOKS[0], y === 6 ? TOP : FACE, { bias: y === 6 ? 1 : 0 });
  c.part();
  c.ellipse(12, 4.5, 2, 1.6, LEAF, { bias: 1 });
  c.line(13, 5, 14, 11, LEAF_DARK);
  c.px(14, 12, LEAF_DARK, FACE, { bias: 2 });
});

const sconce = decor((c, f) => {
  c.part();
  c.shape(7, 13, (y) => [8 - 1.8 + (y > 11 ? 0.6 : 0), 8 + 1.8 - (y > 11 ? 0.6 : 0)], BRASS, (_x, _y, t) => n3(t * 0.6, -0.3, 0.8));
  c.part();
  c.line(8, 11, 10, 9, BRASS, () => FACE, { bias: 1 });
  c.ellipse(10.5, 8.5, 1.6, 0.8, BRASS, { bias: 1 });
  c.part();
  for (let y = 5; y < 8; y++) c.px(10, y, WAX, FACE, { bias: 2 });
  flame(c, 10, 4, 1, 3, f, 431);
  halo(c, 10, 3, 4, [255, 180, 90], 0.3);
}, 4, 8);

const wreath = decor((c) => {
  c.part();
  const R = rng(441);
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2;
    const r = 4.3 + R() * 0.8;
    c.px(8 + Math.cos(t) * r, 8.5 + Math.sin(t) * r, LEAF_DARK, sphere(Math.cos(t) * 0.6, -Math.sin(t) * 0.6), { bias: Math.floor(R() * 3) });
    c.px(8 + Math.cos(t) * (r - 1.2), 8.5 + Math.sin(t) * (r - 1.2), LEAF, sphere(Math.cos(t) * 0.3, -Math.sin(t) * 0.3), { bias: Math.floor(R() * 2) });
  }
  c.part();
  for (let k = 0; k < 7; k++) {
    const t = (k / 7) * Math.PI * 2 + 0.4;
    c.px(8 + Math.cos(t) * 4.6, 8.5 + Math.sin(t) * 4.6, ROSE, sphere(-0.4, 0.4), { bias: 2 });
  }
  // A red bow at the bottom.
  c.part();
  c.ellipse(6.5, 13, 1.6, 1.1, QUILT_R, { bias: 1 });
  c.ellipse(9.5, 13, 1.6, 1.1, QUILT_R, { bias: 1 });
  c.px(8, 13, QUILT_R, FACE, { bias: 3 });
  c.px(7, 15, QUILT_R, FACE, { bias: 0 });
  c.px(9, 15, QUILT_R, FACE, { bias: 0 });
});

// ---------------------------------------------------------------- Turned views
//
// Seats and beds turn to face each way (see PartDef.turns): the drawing above
// each is its front, facing south; here are its side (facing east, mirrored
// for west) and its back. Seen from above and the south as everything is, a
// side view shows its pieces end on: a sofa's back is a long strip beside the
// cushions, and a chair's back seen from behind hides its seat.

/** The top of a block rounded across its depth (a sofa's rolled arm seen end on). */
function rollTop(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, z: number, m: Material): void {
  c.part();
  const mid = (y0 + y1) / 2;
  const half = (y1 - y0) / 2;
  for (let y = y0; y < y1; y++) {
    const t = (y + 0.5 - mid) / half;
    for (let x = x0; x < x1; x++) c.px(x, y - z, m, n3(0, -t * 0.62, 0.78), { bias: x === x0 ? 1 : x === x1 - 1 ? -1 : 0 });
  }
}

/** A quilt's patchwork and stitching over whatever of it shows, from screen row `top`. */
function patchwork(c: PixelCanvas, quilt: Material, x0: number, x1: number, top: number, bottom: number): void {
  for (let y = top; y < bottom; y++) {
    for (let x = x0; x < x1; x++) {
      if (c.materialAt(x, y) !== quilt) continue;
      const px = Math.floor((x - x0) / 4);
      const py = Math.floor((y - top) / 4);
      if ((x - x0) % 4 === 0 || (y - top) % 4 === 0) c.shade(x, y, -1);
      else if ((px + py) % 2 === 0) c.shade(x, y, 1);
    }
  }
}

const chair = art('chair', 2, 20, (c, g) => {
  // Facing us: the back beyond the seat, spindles between two posts.
  const x0 = g.cx - 5;
  const x1 = g.cx + 5;
  const y0 = g.y0 + 4;
  const y1 = g.y1 - 4;
  box(c, x0, x1, y0, y0 + 2, 15, 18, OAKW);
  grain(c, x0, x1, y0 - 18, y0 - 13, 281);
  c.part();
  for (let x = x0 + 3; x < x1 - 2; x += 2) for (let z = 8; z < 15; z++) c.px(x, y0 + 2 - z, OAKW, FACE, { bias: z === 14 ? 0 : 1 });
  for (const x of [x0, x1 - 2]) box(c, x, x + 2, y0, y0 + 2, 0, 19, OAKW);
  box(c, x0, x1, y0 + 2, y1, 6, 8, OAKW, { top: QUILT_R, topBias: 1 });
  // A tuft stitched in the middle of the cushion.
  c.shade(g.cx, y0 + 2 - 8 + Math.floor((y1 - y0 - 2) / 2), -2);
  for (const x of [x0, x1 - 1]) box(c, x, x + 1, y1 - 1, y1, 0, 6, OAKW);
});

const chairBack = sized(1, 1, 2, 20, (c, g) => {
  // Its back to us: the seat beyond, glimpsed between the spindles.
  const x0 = g.cx - 5;
  const x1 = g.cx + 5;
  const y0 = g.y0 + 4;
  const y1 = g.y1 - 4;
  for (const x of [x0, x1 - 1]) box(c, x, x + 1, y0, y0 + 1, 0, 6, OAKW);
  box(c, x0, x1, y0, y1 - 2, 6, 8, OAKW, { top: QUILT_R, topBias: 1 });
  box(c, x0, x1, y1 - 2, y1, 8, 9, OAKW, { bias: -1 });
  c.part();
  for (let x = x0 + 3; x < x1 - 2; x += 2) for (let z = 9; z < 15; z++) c.px(x, y1 - z, OAKW, FACE, { bias: 0 });
  box(c, x0, x1, y1 - 2, y1, 15, 18, OAKW);
  grain(c, x0, x1, y1 - 20, y1 - 15, 283);
  for (const x of [x0, x1 - 2]) box(c, x, x + 2, y1 - 2, y1, 0, 19, OAKW, { bias: -1 });
});

const sofaSide = sized(1, 2, 2, 18, (c, g) => {
  // Facing east: its back along the west, the rolled arms at either end.
  const x0 = g.x0 + 2;
  const x1 = g.x1 - 2;
  const y0 = g.y0 + 1;
  const y1 = g.y1 - 1;
  box(c, x0, x1, y0, y0 + 4, 0, 11, VELVET);
  rollTop(c, x0, x1, y0, y0 + 4, 11, VELVET);
  box(c, x0, x0 + 5, y0 + 4, y1 - 4, 3, 16, VELVET);
  // Piping along the back's crest, and its buttoned panels seen edge on.
  for (let y = y0 + 4 - 16; y < y1 - 4 - 16; y++) {
    c.shade(x0 + 4, y, -1);
    if ((y - y0) % 5 === 0) c.shade(x0 + 2, y, -2);
  }
  box(c, x0 + 4, x1, y0 + 4, y1 - 4, 0, 5, VELVET, { bias: -1 });
  const mid = Math.round((y0 + y1) / 2);
  box(c, x0 + 5, x1, y0 + 4, mid, 5, 8, VELVET, { topBias: 1 });
  box(c, x0 + 5, x1, mid, y1 - 4, 5, 8, VELVET, { topBias: 1 });
  // The gold cushion leant in the far corner.
  c.part();
  c.ellipse(x0 + 6.5, y0 + 8 - 11, 2.4, 3, GOLD_CLOTH, { bias: 1 });
  c.shade(x0 + 6.5, y0 + 8 - 11, -1);
  box(c, x0, x1, y1 - 4, y1, 0, 11, VELVET);
  rollTop(c, x0, x1, y1 - 4, y1, 11, VELVET);
  box(c, x0, x0 + 2, y1 - 2, y1, 0, 2, DARKW);
  box(c, x1 - 2, x1, y1 - 2, y1, 0, 2, DARKW);
});

const sofaBack = sized(2, 1, 1, 18, (c, g) => {
  // Its back to us: tall and plain, the arms and a cushion showing over it.
  const x0 = g.x0 + 1;
  const x1 = g.x1 - 1;
  const y0 = g.y0 + 2;
  const y1 = g.y1 - 2;
  box(c, x0, x1, y0, y1 - 4, 0, 5, VELVET, { bias: -1 });
  box(c, x0 + 3, x1 - 3, y0, y1 - 5, 5, 8, VELVET, { topBias: 1 });
  for (const [a, b] of [[x0, x0 + 3], [x1 - 3, x1]]) {
    c.part();
    for (let y = y0 - 11; y < y1 - 5; y++) {
      for (let x = a; x < b; x++) {
        const t = (x + 0.5 - (a + b) / 2) / 1.5;
        c.px(x, y, VELVET, y < y0 + 2 - 11 + 2 ? n3(t * 0.6, 0.6, 0.6) : cyl(t, -0.2), { bias: 0 });
      }
    }
  }
  c.part();
  c.ellipse(x1 - 7, y1 - 21, 3, 2.6, GOLD_CLOTH, { bias: 1 });
  box(c, x0, x1, y1 - 5, y1, 3, 16, VELVET);
  // Piping round its top, a welt at its foot, and seams between three panels.
  for (let x = x0; x < x1; x++) {
    c.shade(x, y1 - 16, 1);
    c.shade(x, y1 - 4, -1);
  }
  for (const k of [1, 2]) {
    const sx = Math.round(x0 + ((x1 - x0) * k) / 3);
    for (let y = y1 - 15; y < y1 - 4; y++) c.shade(sx, y, -1);
  }
  box(c, x0, x0 + 2, y1 - 2, y1, 0, 3, DARKW);
  box(c, x1 - 2, x1, y1 - 2, y1, 0, 3, DARKW);
});

const benchSide = sized(1, 2, 2, 17, (c, g) => {
  // Facing east: the back along the west, the iron arms at either end.
  const y0 = g.y0 + 2;
  const y1 = g.y1 - 2;
  const bx = g.x0 + 3;
  const sx0 = bx + 2;
  const sx1 = g.x1 - 3;
  const arm = (y: number) => {
    box(c, sx1 - 2, sx1, y - 1, y + 1, 0, 11, IRON);
    c.part();
    c.line(bx + 1, y - 13, sx1 - 1, y - 11, IRON, () => TOP, { bias: 1 });
    c.px(sx1, y - 11, IRON, FACE, { bias: 2 });
  };
  box(c, bx, bx + 2, y0 + 1, y0 + 3, 0, 16, IRON);
  arm(y0 + 2);
  for (const [z0, z1] of [[9, 12], [13, 16]]) box(c, bx, bx + 2, y0, y1, z0, z1, PALEW);
  grain(c, bx, bx + 2, y0 - 16, y1 - 9, 193, false);
  box(c, sx0, sx1, y0, y1, 6, 8, PALEW);
  // The seat's slats run its length.
  for (let x = sx0 + 2; x < sx1; x += 3) for (let y = y0 - 8; y < y1 - 8; y++) c.shade(x, y, -2);
  grain(c, sx0, sx1, y0 - 8, y1 - 6, 194, false);
  box(c, bx, bx + 2, y1 - 3, y1 - 1, 0, 16, IRON);
  arm(y1 - 2);
});

const benchBack = sized(2, 1, 1, 17, (c, g) => {
  // Its back to us: the slats across, the seat and arms beyond.
  const x0 = g.x0 + 2;
  const x1 = g.x1 - 2;
  const posts = [x0 + 1, x1 - 3];
  for (const x of posts) box(c, x, x + 2, g.y0 + 3, g.y0 + 5, 0, 6, IRON);
  box(c, x0, x1, g.y0 + 3, g.y1 - 6, 6, 8, PALEW);
  for (let y = g.y0 + 3 - 8 + 2; y < g.y1 - 6 - 8; y += 3) for (let x = x0; x < x1; x++) c.shade(x, y, -2);
  grain(c, x0, x1, g.y0 - 5, g.y1 - 12, 195);
  c.part();
  for (const x of posts) c.line(x + 1, g.y0 + 4 - 11, x + 1, g.y1 - 5 - 12, IRON, () => TOP, { bias: 1 });
  for (const [z0, z1] of [[9, 12], [13, 16]]) {
    box(c, x0, x1, g.y1 - 6, g.y1 - 5, z0, z1, PALEW, { bias: -1 });
    grain(c, x0, x1, g.y1 - 5 - z1, g.y1 - 5 - z0, 196);
  }
  for (const x of posts) box(c, x, x + 2, g.y1 - 6, g.y1 - 4, 0, 16, IRON);
});

function bedSide(quilt: Material, pillows: number): Drawer {
  return (c, g) => {
    // Feet to the east: the headboard along the west, both ends seen end on.
    const x0 = g.x0 + 1;
    const x1 = g.x1 - 1;
    const y0 = g.y0 + 1;
    const y1 = g.y1 - 1;
    box(c, x0, x0 + 2, y0, y0 + 2, 0, 18, DARKW);
    box(c, x1 - 2, x1, y0, y0 + 2, 0, 10, DARKW);
    box(c, x0, x0 + 2, y0 + 2, y1 - 2, 0, 15, OAKW);
    grain(c, x0, x0 + 2, y0 + 2 - 15, y1 - 2 - 15, 243, false);
    box(c, x0 + 2, x1 - 2, y0 + 1, y1 - 1, 0, 6, OAKW);
    box(c, x0 + 2, x1 - 3, y0 + 2, y1 - 2, 6, 9, LINEN, { topBias: 1 });
    const ph = (y1 - y0 - 4) / pillows;
    for (let k = 0; k < pillows; k++) {
      c.part();
      const py = y0 + 2 + ph * (k + 0.5) - 10;
      c.ellipse(x0 + 5.5, py, 2.6, ph / 2 - 0.3, LINEN, { bias: 1, flatten: 0.8 });
      c.shade(x0 + 5.5, py, -1);
    }
    // The quilt, turned down at the pillows' end, hanging over the near side.
    const qx0 = x0 + 10;
    box(c, qx0, x1 - 2, y0 + 1, y1 - 1, 3, 10, quilt);
    patchwork(c, quilt, qx0 + 2, x1 - 2, y0 + 1 - 10, y1 - 1 - 3);
    c.part();
    for (let y = y0 + 1 - 10; y < y1 - 1 - 3; y++) {
      for (const x of [qx0, qx0 + 1]) {
        if (c.materialAt(x, y) === quilt) c.px(x, y, LINEN, y < y1 - 1 - 10 ? TOP : FACE, { bias: x === qx0 ? 2 : 0 });
      }
    }
    box(c, x1 - 2, x1, y0 + 2, y1 - 2, 0, 8, OAKW);
    box(c, x0, x0 + 2, y1 - 2, y1, 0, 18, DARKW);
    box(c, x1 - 2, x1, y1 - 2, y1, 0, 10, DARKW);
  };
}

function bedBack(quilt: Material, pillows: number): Drawer {
  return (c, g) => {
    // Feet away from us: the footboard beyond, the headboard's back towards us.
    const x0 = g.x0 + 1;
    const x1 = g.x1 - 1;
    box(c, x0, x1, g.y0 + 1, g.y0 + 3, 0, 8, OAKW);
    for (const x of [x0, x1 - 2]) box(c, x, x + 2, g.y0 + 1, g.y0 + 3, 0, 10, DARKW);
    box(c, x0, x1, g.y0 + 3, g.y1 - 2, 0, 6, OAKW);
    box(c, x0 + 1, x1 - 1, g.y0 + 3, g.y1 - 3, 6, 9, LINEN, { topBias: 1 });
    const qy1 = g.y1 - 12;
    box(c, x0, x1, g.y0 + 3, qy1, 3, 10, quilt);
    patchwork(c, quilt, x0, x1, g.y0 + 3 - 10, qy1 - 10);
    // Its turned-down edge.
    c.part();
    for (let y = qy1 - 12; y < qy1 - 8; y++) {
      for (let x = x0; x < x1; x++) if (c.materialAt(x, y) === quilt) c.px(x, y, LINEN, y < qy1 - 10 ? TOP : FACE, { bias: y === qy1 - 12 ? 2 : y === qy1 - 9 ? -1 : 0 });
    }
    const pw = (x1 - x0 - 4) / pillows;
    for (let k = 0; k < pillows; k++) {
      c.part();
      const px = x0 + 2 + pw * (k + 0.5);
      c.ellipse(px, g.y1 - 7 - 11, pw / 2 - 0.3, 2.6, LINEN, { bias: 1, flatten: 0.8 });
    }
    // The headboard from behind: plain boards on a rail, the crest along its top.
    box(c, x0, x1, g.y1 - 3, g.y1 - 1, 0, 15, OAKW, { bias: -1 });
    for (let x = x0 + 2; x < x1 - 2; x++) {
      for (let y = g.y1 - 1 - 15; y < g.y1 - 1; y++) if ((x - x0) % 4 === 0) c.shade(x, y, -1);
      c.shade(x, g.y1 - 1 - 6, -1);
    }
    c.part();
    for (let x = x0 + 2; x < x1 - 2; x++) {
      const t = (x + 0.5 - g.cx) / ((x1 - x0) / 2);
      const rise = Math.round(Math.cos(t * Math.PI * 0.5) * 3);
      for (let k = 1; k <= rise; k++) c.px(x, g.y1 - 3 - 15 - k, OAKW, FACE, { bias: k === rise ? 1 : -1 });
    }
    for (const x of [x0, x1 - 2]) box(c, x, x + 2, g.y1 - 3, g.y1 - 1, 0, 18, DARKW);
  };
}

/** The views a turning part has besides its front: its side (facing east; west is it mirrored) and its back. */
export const PROP_TURNS: Record<string, { side: PropArt; back: PropArt }> = {
  chair: { side: chairSide, back: chairBack },
  sofa: { side: sofaSide, back: sofaBack },
  bench: { side: benchSide, back: benchBack },
  bed: { side: sized(2, 1, 1, 20, bedSide(QUILT_R, 1)), back: sized(1, 2, 1, 20, bedBack(QUILT_R, 1)) },
  bigbed: { side: sized(2, 2, 1, 20, bedSide(QUILT_B, 2)), back: sized(2, 2, 1, 20, bedBack(QUILT_B, 2)) },
};

// ---------------------------------------------------------------- The list

/** Every part drawn here, by id. The rest (trees, bushes, ferns, stumps, brazier, crystal) reuse the forest's art. */
export const PROP_ART: Record<string, PropArt> = {
  roses,
  tulips,
  lavender,
  sunflowers,
  cabbages,
  pumpkin,
  planter,
  rock: mossRock,
  stepping,
  lilypad,
  reeds,
  bench,
  well,
  birdbath,
  scarecrow,
  haybale,
  mailbox,
  fishrod,
  signpost,
  bed,
  bigbed,
  bookshelf,
  wardrobe,
  dresser,
  table,
  roundtable,
  chair,
  stool,
  sofa,
  desk,
  chest,
  barrel,
  crate,
  fireplace,
  cauldron,
  clock,
  armorstand,
  weaponrack,
  jarshelf: jarShelf,
  plant: pottedPlant,
  rug,
  roundrug,
  runner,
  lamppost,
  lantern: stoneLantern,
  torch,
  campfire,
  candelabra,
  fairylights: fireflyJar,
  mushlamp: mushLamp,
  painting,
  portrait,
  banner,
  shield: crest,
  antlers,
  wallshelf,
  sconce,
  wreath,
};
