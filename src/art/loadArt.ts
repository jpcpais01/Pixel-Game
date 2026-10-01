// The arenas' loading screens: a small painted scene of each place, shown
// while its textures are built (see scenes/ArenaLoadScene.ts).
//
// - The Glimmerdeep: a cavern under a skylight, giant glowcaps on one bank of
//   an underground river and amethyst spires on the other.
// - The Spirit Dungeon: an ossuary wall, skulls in their niches, a pointed
//   arch over stairs that sink into a cold blue light, soul-fire braziers.
// - The Elementinho Temple: a stepped ziggurat in the Emberwaste at dusk, a
//   fire on its crown, four elemental obelisks and lava cracks at its feet.
// - The Cosmos: a floating rune platform among nebulae, a ringed planet.
// - The Endless Rift: a tear in the void, rock torn loose drifting round it.
// - The Aurora Colosseum: arcades under the aurora, a frozen lake below.
// - The Floating Island and Sky Glide: the island over a sea of clouds.
//
// Painted like the mode menu's windows (art/modes.ts): a material and a light
// level per pixel, dithered between the steps of its ramp, and what glows in
// its own layer for the screen to pulse. The edges dissolve into the dark of
// the loading screen.

import { hex, type RGB } from './pixel';
import { Bitmap, bayer, clamp01, mix } from './bitmap';
import { Paint, fbm, hash, inPoly, noise, noise2 } from './modes';

export interface LoadArt {
  base: Bitmap;
  glow: Bitmap;
  /** Points the screen's live touches hang on (flames, crystals...), in art px. */
  spots: Record<string, [number, number][]>;
}

export const LOAD_W = 224;
export const LOAD_H = 132;
/** The loading screen's backdrop, which the picture's edges dissolve into. */
export const LOAD_BG = 0x07080d;

const ramp = (...c: string[]) => c.map(hex);

// Materials.
const CAVE = 1;
const CROCK = 2;
const CAP = 3;
const STEM = 4;
const AMETHYST = 5;
const RIVER = 6;
const CRYPT = 7;
const BONE = 8;
const IRON = 9;
const DUSK = 10;
const SANDSTONE = 11;
const DUNE = 12;
const BASALT = 13;
const SPACE = 14;
const PLANET = 15;
const ASTRAL = 16;
const VOID = 17;
const RIFTROCK = 18;
const TEAR = 19;
const AURORA_SKY = 20;
const FROSTSTONE = 21;
const SNOW = 22;
const ICE = 23;
const SKY = 24;
const CLOUD = 25;
const GRASS = 26;
const ISLE_ROCK = 27;
const MARBLE = 28;
const LEAF = 29;
const CANOPY = 30;
const PEAK = 31;
const GEM = 32;

/** Colour ramps per material, darkest first. */
const RAMPS: RGB[][] = [];
RAMPS[CAVE] = ramp('#030409', '#070914', '#0c0f20', '#12162c', '#1a1f3a', '#232a48', '#2e3858', '#3c4a6a', '#506080');
RAMPS[CROCK] = ramp('#05060c', '#0b0e18', '#121826', '#1a2434', '#243244', '#304456', '#3e586a', '#527280', '#70949c');
RAMPS[CAP] = ramp('#06141a', '#0a2228', '#0e3438', '#124a4a', '#18665e', '#20887a', '#36ae98', '#6ad4bc', '#b8f6e4');
RAMPS[STEM] = ramp('#120e1c', '#1e1a2e', '#2c2840', '#3c3852', '#504a66', '#68627c', '#847e94', '#a8a2b4', '#d2ccd8');
RAMPS[AMETHYST] = ramp('#0e0618', '#1c0a2e', '#2e1046', '#441862', '#5e2482', '#7c38a4', '#9c56c4', '#c084e0', '#ecc8ff');
RAMPS[RIVER] = ramp('#02070a', '#051016', '#081a22', '#0c2630', '#123440', '#1a4652', '#285e68', '#3e7c84', '#64a8a8');
RAMPS[CRYPT] = ramp('#05060c', '#0a0c18', '#111526', '#1a2034', '#242c44', '#303a54', '#3e4a66', '#525e7a', '#6c7892');
RAMPS[BONE] = ramp('#16141a', '#2a2630', '#403a42', '#585058', '#726a6e', '#8e8686', '#aca49e', '#cac2b6', '#ece4d4');
RAMPS[IRON] = ramp('#050508', '#0c0c12', '#14141c', '#1e1e28', '#2a2a36', '#383846', '#4a4a5a', '#60606e', '#7c7c88');
RAMPS[DUSK] = ramp('#140a26', '#22103a', '#34164a', '#4c1c54', '#6c2456', '#902e50', '#b8404a', '#dc6440', '#f8a048');
RAMPS[SANDSTONE] = ramp('#1a0c10', '#2c1416', '#42201c', '#5a2e22', '#764028', '#94562e', '#b47038', '#d49048', '#f2b666');
RAMPS[DUNE] = ramp('#180a14', '#28101a', '#3c1820', '#542226', '#6e302a', '#8c402e', '#ac5632', '#cc703a', '#ec9448');
RAMPS[BASALT] = ramp('#06040a', '#0e0a12', '#18101a', '#221822', '#2e202a', '#3c2a32', '#4c363c', '#604448', '#785658');
RAMPS[SPACE] = ramp('#020208', '#05050f', '#090818', '#0e0c22', '#15122e', '#1e183c', '#28204a', '#342a5a', '#44366c');
RAMPS[PLANET] = ramp('#0a0814', '#161026', '#24183a', '#36224c', '#4c2e5c', '#66406a', '#865676', '#aa7282', '#d29a96');
RAMPS[ASTRAL] = ramp('#06060e', '#0e0e1c', '#16182c', '#20243c', '#2c324e', '#3a4262', '#4c5678', '#626e90', '#7e8cac');
RAMPS[VOID] = ramp('#030108', '#070310', '#0d0519', '#150824', '#1f0c30', '#2b103e', '#3a164e', '#4c1e60', '#622874');
RAMPS[RIFTROCK] = ramp('#050409', '#0c0912', '#15101e', '#20182c', '#2c213a', '#3a2c4a', '#4c3a5e', '#644c74', '#86628e');
RAMPS[TEAR] = ramp('#3a0a3e', '#5a1060', '#801884', '#a824a8', '#cc3cc6', '#e664da', '#f692e8', '#fcc0f4', '#ffeefe');
RAMPS[AURORA_SKY] = ramp('#020410', '#040818', '#060c22', '#0a122e', '#0e1a3a', '#142446', '#1c3052', '#263e5e', '#345070');
RAMPS[FROSTSTONE] = ramp('#05080e', '#0a0f1a', '#111826', '#1a2434', '#243244', '#304256', '#3e546a', '#526a80', '#6c8498');
RAMPS[SNOW] = ramp('#1a2438', '#26324a', '#34425c', '#46566e', '#5a6c82', '#728698', '#8ea2b0', '#b0c2cc', '#dce8ee');
RAMPS[ICE] = ramp('#030a12', '#06121e', '#0a1c2c', '#10283a', '#163648', '#1e4658', '#2a5a6a', '#3c727e', '#5a9298');
RAMPS[SKY] = ramp('#1c3a7a', '#24488a', '#2e5898', '#3a6aa8', '#4a7eb6', '#5e94c4', '#78aad0', '#98c2dc', '#c4dcea');
RAMPS[CLOUD] = ramp('#5068a0', '#6078ac', '#7488b8', '#8a9cc4', '#a2b2d0', '#bcc8dc', '#d4dce8', '#eaeef4', '#ffffff');
RAMPS[GRASS] = ramp('#0e1e14', '#16301a', '#1e4420', '#285a26', '#36722c', '#4a8a32', '#64a23a', '#86ba48', '#b4d466');
RAMPS[ISLE_ROCK] = ramp('#1a1426', '#261e34', '#342a42', '#443650', '#56465e', '#6a586c', '#806c7c', '#9a868e', '#b8a6a8');
RAMPS[MARBLE] = ramp('#3a3a52', '#4e4e66', '#64647a', '#7c7c90', '#9696a8', '#b0b0c0', '#c8c8d4', '#e0e0e8', '#ffffff');
RAMPS[LEAF] = ramp('#0a1610', '#102418', '#163420', '#1e4628', '#285a30', '#347038', '#448842', '#5aa04e', '#7cba60');
RAMPS[CANOPY] = ramp('#3a0e1a', '#5a1424', '#7c1c2e', '#a0283a', '#c43a46', '#e05452', '#f27a62', '#fca07c', '#ffcaa0');
RAMPS[PEAK] = ramp('#06081a', '#0a0e24', '#10162e', '#161e3a', '#1e2846', '#283454', '#344262', '#445472', '#586a86');
RAMPS[GEM] = ramp('#101010', '#202020', '#363636', '#4e4e4e', '#686868', '#868686', '#a6a6a6', '#cacaca', '#f4f4f4');

const W = LOAD_W;
const H = LOAD_H;

const newPaint = () => new Paint(W, H, RAMPS);

/** A filled ellipse. */
function ellipse(p: Paint, cx: number, cy: number, rx: number, ry: number, m: number, l: (x: number, y: number, d: number) => number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d < 1) p.put(x, y, m, l(x, y, d));
    }
  }
}

/** Every pixel inside a polygon. */
function poly(p: Paint, pts: [number, number][], m: number, l: (x: number, y: number) => number): void {
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  p.fill(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), m, l, (x, y) => inPoly(pts, x + 0.5, y + 0.5));
}

/**
 * A crystal: a blade from a base to its tip, its two faces split along the
 * spine, the face toward the light (`lit` = +1 right, -1 left) bright, an
 * edge catching a line of light and a glint at the tip.
 */
function crystal(p: Paint, bx: number, by: number, tx: number, ty: number, half: number, m: number, lit: number, base = 0.32): void {
  const len = Math.hypot(tx - bx, ty - by);
  const ux = (tx - bx) / len;
  const uy = (ty - by) / len;
  const nx = -uy;
  const ny = ux;
  const shoulder = 0.72;
  const sx = bx + (tx - bx) * shoulder;
  const sy = by + (ty - by) * shoulder;
  const pts: [number, number][] = [
    [bx + nx * half, by + ny * half],
    [sx + nx * half, sy + ny * half],
    [tx, ty],
    [sx - nx * half, sy - ny * half],
    [bx - nx * half, by - ny * half],
  ];
  poly(p, pts, m, (x, y) => {
    const px = x + 0.5 - bx;
    const py = y + 0.5 - by;
    const across = px * nx + py * ny;
    const along = (px * ux + py * uy) / len;
    // Which face: the one whose normal leans to the light side.
    const face = Math.sign(across * nx || across) === Math.sign(lit) ? 1 : 0;
    let l = base + face * 0.28 + along * 0.22;
    if (Math.abs(across) < 0.6) l += 0.18;
    if (Math.abs(Math.abs(across) - half * (along > shoulder ? (1 - along) / (1 - shoulder) : 1)) < 0.8 && face) l += 0.22;
    return l;
  });
  p.put(tx, ty, m, 1);
}

/** Dissolve the picture's edges into the loading screen's dark, in dithered steps. */
function feather(art: { base: Bitmap; glow: Bitmap }): void {
  const bg: RGB = [7, 8, 13];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = Math.abs((x + 0.5 - W / 2) / (W / 2));
      const dy = Math.abs((y + 0.5 - H / 2) / (H / 2));
      // A rounded rectangle more than an oval, so most of the picture shows.
      const d = Math.pow(Math.pow(dx, 3.2) + Math.pow(dy, 3.2), 1 / 3.2);
      const fade = clamp01((d - 0.7) / 0.3);
      if (fade <= 0) continue;
      const i = (y * W + x) * 4;
      if (fade >= 1 || bayer(x, y) < (fade - 0.55) / 0.45) {
        art.base.data[i + 3] = 0;
        art.glow.data[i + 3] = 0;
        continue;
      }
      const c = mix([art.base.data[i], art.base.data[i + 1], art.base.data[i + 2]], bg, Math.min(1, fade * 1.15));
      art.base.set(x, y, c);
      if (art.glow.data[i + 3]) {
        const g = 1 - fade;
        art.glow.set(x, y, [art.glow.data[i] * g, art.glow.data[i + 1] * g, art.glow.data[i + 2] * g]);
      }
    }
  }
}

function finish(p: Paint, spots: LoadArt['spots']): LoadArt {
  const art = p.resolve();
  feather(art);
  return { ...art, spots };
}

/** A scatter of stars, brighter ones with a faint cross. */
function stars(p: Paint, n: number, seed: number, maxY: number, c: RGB, x0 = 0, x1 = W): void {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(x0 + hash(i, 1, seed) * (x1 - x0));
    const y = Math.floor(Math.pow(hash(i, 2, seed), 1.3) * maxY);
    const a = 0.25 + hash(i, 3, seed) * 0.75;
    p.glow(x, y, c, a);
    if (a > 0.92) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.glow(x + dx, y + dy, c, 0.3);
  }
}

// ---------------------------------------------------------------- The Glimmerdeep

export function paintDeep(): LoadArt {
  const p = newPaint();
  const shaftTop: [number, number] = [100, 10];
  const pool: [number, number] = [118, 100];
  // How much of the skylight reaches a spot.
  const daylight = (x: number, y: number) => {
    const t = clamp01((y - shaftTop[1]) / (pool[1] - shaftTop[1]));
    const cx = shaftTop[0] + (pool[0] - shaftTop[0]) * t;
    const half = 5 + t * 20;
    const k = clamp01(1 - Math.abs(x - cx) / half);
    return k * k * (0.4 + 0.6 * t);
  };
  const poolLight = (x: number, y: number) => Math.exp(-(((x - pool[0]) / 34) ** 2) - (((y - pool[1]) / 9) ** 2));

  // The far wall: cold rock, faintly lit where the light falls past it.
  p.fill(0, 0, W - 1, H - 1, CAVE, (x, y) => 0.26 + (fbm(x / 26, y / 16, 1) - 0.5) * 0.28 + (noise2(x / 6, y / 4, 2) - 0.5) * 0.08 + daylight(x, y) * 0.35 + poolLight(x, y) * 0.25);
  // Ledges and strata across the far wall.
  for (let y = 0; y < 92; y++) {
    for (let x = 0; x < W; x++) {
      const band = Math.sin(y * 0.55 + noise(x / 18, 3) * 4);
      if (band > 0.93) p.shade(x, y, 0.06);
      else if (band < -0.95) p.shade(x, y, -0.05);
    }
  }
  // Glints of crystal in the far wall.
  for (let i = 0; i < 14; i++) {
    const x = 8 + hash(i, 1, 4) * (W - 16);
    const y = 24 + hash(i, 2, 4) * 52;
    p.put(x, y, AMETHYST, 0.7);
    p.halo(x, y, 4, hex('#a050e0'), 0.25);
  }

  // The ceiling: a ragged roof with the skylight torn through it, stalactites hanging.
  const roof = (x: number) => 16 + 8 * noise(x / 22, 5) + 5 * noise(x / 7, 6) - 12 * Math.exp(-(((x - shaftTop[0]) / 12) ** 2));
  for (let x = 0; x < W; x++) {
    const r = roof(x);
    for (let y = 0; y < r; y++) p.put(x, y, CROCK, 0.18 + (y > r - 2 ? 0.14 + daylight(x, y + 6) * 0.5 : 0) + (hash(x, y, 7) - 0.5) * 0.06);
  }
  // Daylight through the hole: a scrap of sky and hanging roots.
  for (let y = 0; y < 8; y++) {
    for (let x = shaftTop[0] - 7; x <= shaftTop[0] + 7; x++) {
      if (Math.hypot((x - shaftTop[0]) / 7, (y - 1) / 6) < 1) p.put(x, y, STEM, 0.92 - y * 0.03);
    }
  }
  for (const rx of [93, 97, 104, 108]) {
    const len = 6 + hash(rx, 0, 8) * 10;
    for (let y = 2; y < len; y++) p.put(rx + Math.round(Math.sin(y * 0.6 + rx) * 0.6), y, CROCK, 0.3);
  }
  const stalactite = (sx: number, len: number, w: number) => {
    const top = roof(sx) - 2;
    for (let y = 0; y < len; y++) {
      const half = w * (1 - y / len);
      for (let x = Math.floor(sx - half); x <= sx + half; x++) {
        const side = (x - sx) / Math.max(1, half);
        p.put(x, top + y, CROCK, 0.26 + (side > 0.3 ? 0.1 : side < -0.3 ? -0.06 : 0) + daylight(x, top + y) * 0.4 - y * 0.003);
      }
    }
  };
  for (const [sx, len, w] of [[14, 20, 4], [30, 12, 3], [52, 26, 4.5], [70, 10, 2.5], [132, 16, 3.5], [150, 28, 5], [170, 12, 3], [192, 22, 4], [212, 14, 3]] as const) stalactite(sx, len, w);

  // The floor: dark rock, the pool of daylight on it.
  const floor = (x: number) => 90 + 4 * noise(x / 30, 9) + 3 * Math.exp(-(((x - 112) / 40) ** 2));
  for (let x = 0; x < W; x++) {
    for (let y = Math.floor(floor(x)); y < H; y++) {
      const near = (y - 90) / 42;
      let l = 0.3 + near * 0.06 + (fbm(x / 18, y / 7, 10) - 0.5) * 0.22 + poolLight(x, y) * 0.5;
      if (y - floor(x) < 1.5) l += 0.12;
      p.put(x, y, CROCK, l);
    }
  }
  p.halo(pool[0], pool[1], 36, hex('#e8d8a0'), 0.2, 0.28);

  // The river, sliding left to right across the front, holding the glow of both banks.
  const riverY = (x: number) => 114 + 5 * Math.sin(x / 34 + 0.6) + 2 * noise(x / 12, 11);
  for (let x = 0; x < W; x++) {
    const cy = riverY(x);
    const half = 5.5 + 1.5 * noise(x / 20, 12);
    for (let y = Math.floor(cy - half); y <= cy + half; y++) {
      const e = half - Math.abs(y - cy);
      if (e < 0) continue;
      let l = 0.3 + (y - cy) * 0.02 + (noise2(x / 10, y / 1.5, 13) - 0.5) * 0.2;
      if (e < 1) l = 0.12;
      // Long glints on the current.
      if (hash(Math.floor(x / 5), y, 14) > 0.84 && e > 1.5) l += 0.32;
      p.put(x, y, RIVER, l);
      if (x < 92) p.glow(x, y, hex('#2ad8b0'), 0.08 + (e > 1.5 && hash(Math.floor(x / 4), y, 15) > 0.86 ? 0.35 : 0));
      else if (x > 136) p.glow(x, y, hex('#b050ff'), 0.06 + (e > 1.5 && hash(Math.floor(x / 4), y, 16) > 0.86 ? 0.3 : 0));
    }
  }

  // Giant glowcaps on the west bank: pale stems under domed teal caps, gills dark beneath.
  const caps: [number, number][] = [];
  const shroom = (cx: number, base: number, r: number, stemH: number, lean: number) => {
    const top = base - stemH;
    for (let y = top; y <= base; y++) {
      const t = (y - top) / stemH;
      const sx = cx + lean * (1 - t) * (1 - t) * 6;
      const half = r * 0.16 + t * t * r * 0.1 + 1;
      for (let x = Math.floor(sx - half); x <= sx + half; x++) {
        const side = (x - sx) / half;
        p.put(x, y, STEM, 0.36 + side * 0.18 + (1 - t) * 0.25 - Math.abs(side) * 0.1);
      }
    }
    const capX = cx + lean * 6;
    const ry = r * 0.55;
    for (let y = Math.floor(top - ry); y <= top + 2; y++) {
      for (let x = Math.floor(capX - r); x <= capX + r; x++) {
        const dx = (x + 0.5 - capX) / r;
        const dy = (y + 0.5 - top) / ry;
        const under = y >= top && Math.abs(dx) < 1 - (y - top) * 0.12;
        if (dx * dx + dy * dy < 1 && y < top) {
          // The dome: brightest on top toward the skylight, a darker rim, pale spots.
          let l = 0.45 + (-dy) * 0.32 + dx * 0.08;
          if (dx * dx + dy * dy > 0.78) l -= 0.12;
          if (noise2(x / 2.2, y / 2.2, cx) > 0.74) l += 0.22;
          p.put(x, y, CAP, l);
        } else if (under) {
          // Gills: fine dark lines fanning out, lit from the cap's own glow.
          p.put(x, y, CAP, 0.22 + ((x & 1) === 0 ? 0.08 : 0) - (y - top) * 0.04);
        }
      }
    }
    p.halo(capX, top - ry * 0.3, r * 1.9, hex('#22e0b8'), 0.3, 0.75);
    p.halo(capX, top + 3, r * 1.2, hex('#5affd8'), 0.28, 0.4);
    for (let x = Math.floor(capX - r + 1); x <= capX + r - 1; x++) p.glow(x, top + 1, hex('#7affe0'), 0.35);
    caps.push([capX, top - ry * 0.5]);
  };
  shroom(30, 108, 17, 34, 0.4);
  shroom(60, 104, 10, 20, -0.3);
  shroom(10, 100, 8, 14, 0.6);
  // Little caps along the bank.
  for (const [x, y, s] of [[44, 108, 3], [48, 109, 2], [74, 105, 3], [79, 106, 2], [18, 110, 2], [86, 103, 2]] as const) {
    for (let dy = 0; dy < s; dy++) p.put(x, y - dy, STEM, 0.6);
    ellipse(p, x, y - s, s + 0.6, s * 0.6 + 0.4, CAP, (_x, yy) => 0.7 - (yy - (y - s)) * 0.1);
    p.halo(x, y - s, s * 3, hex('#3ae8c0'), 0.4);
  }

  // Amethyst on the east bank: a cluster of spires breaking from the rock.
  const crystals: [number, number][] = [];
  const cluster = (cx: number, cy: number, blades: [number, number, number][]) => {
    for (const [ang, len, half] of blades) {
      const a = (ang * Math.PI) / 180;
      const tx = cx + Math.sin(a) * len;
      const ty = cy - Math.cos(a) * len;
      crystal(p, cx + Math.sin(a) * 2, cy, tx, ty, half, AMETHYST, -1, 0.36);
      crystals.push([tx, ty]);
    }
    p.halo(cx, cy - 12, 30, hex('#9a40ff'), 0.32, 0.9);
    p.halo(cx, cy - 6, 12, hex('#e0a0ff'), 0.25);
  };
  cluster(182, 106, [[-34, 24, 4], [-12, 40, 6], [8, 33, 5], [30, 22, 4], [52, 13, 3], [-58, 13, 3]]);
  cluster(150, 100, [[-20, 14, 2.5], [6, 18, 3], [28, 10, 2]]);
  cluster(214, 92, [[-10, 16, 2.5], [18, 10, 2]]);

  // The skylight's shaft: dust-gold light falling through the dark.
  for (let y = shaftTop[1]; y < pool[1] + 4; y++) {
    for (let x = 60; x < 170; x++) {
      const k = daylight(x, y);
      if (k > 0.02) p.glow(x, y, hex('#f6e6b0'), k * 0.32 * (0.85 + 0.15 * noise2(x / 3, y / 9, 17)));
    }
  }

  // Foreground stalagmites, nearly black against the cave.
  const mound = (cx: number, h: number, w: number) => {
    for (let y = 0; y < h; y++) {
      const half = w * Math.pow(y / h, 0.6);
      for (let x = Math.floor(cx - half); x <= cx + half; x++) p.put(x, H - h + y, CROCK, 0.1 + (x > cx ? 0.04 : 0) + (y < 2 ? 0.1 : 0));
    }
  };
  mound(4, 30, 10);
  mound(216, 24, 12);
  mound(100, 9, 16);

  return finish(p, { caps, crystals, pool: [pool], shaft: [shaftTop] });
}

// ---------------------------------------------------------------- The Spirit Dungeon

export function paintSpirit(): LoadArt {
  const p = newPaint();
  const DX = 112;
  const FLOOR = 100;
  const braziers: [number, number][] = [
    [70, 84],
    [154, 84],
  ];
  const fireLight = (x: number, y: number) => braziers.reduce((s, [bx, by]) => s + Math.exp(-Math.hypot(x - bx, (y - by) * 1.2) / 26), 0);

  // The wall: courses of dressed stone, lit cold blue by the braziers.
  for (let y = 0; y < FLOOR; y++) {
    const row = Math.floor(y / 7);
    const inRow = y % 7;
    for (let x = 0; x < W; x++) {
      const off = (row * 9) % 16;
      const bw = 14 + Math.floor(hash(row, Math.floor((x + off) / 16), 20) * 3);
      const col = (x + off) % 16;
      let l = 0.22 + (noise2(x / 5, y / 5, 21) - 0.5) * 0.08 + hash(row, Math.floor((x + off) / 16), 22) * 0.06 + fireLight(x, y) * 0.32;
      if (inRow === 6 || col === 0 || col > bw) l = 0.06 + fireLight(x, y) * 0.08;
      else if (inRow === 0) l += 0.06;
      p.put(x, y, CRYPT, l - Math.max(0, (30 - y) / 30) * 0.08);
    }
  }

  // Ossuary niches either side: little arched holes, a skull in each.
  const niche = (nx: number, ny: number, seed: number) => {
    for (let y = ny - 7; y <= ny; y++) {
      for (let x = nx - 4; x <= nx + 4; x++) {
        const arch = y < ny - 4 ? Math.hypot(x + 0.5 - nx, (y + 0.5 - (ny - 4)) * 1.3) < 4.6 : Math.abs(x + 0.5 - nx) < 4.6;
        if (arch) p.put(x, y, CRYPT, 0.03);
      }
    }
    for (let x = nx - 5; x <= nx + 5; x++) p.put(x, ny + 1, CRYPT, 0.3 + fireLight(x, ny) * 0.2);
    const lit = 0.42 + fireLight(nx, ny) * 0.4;
    if (hash(seed, 1, 23) < 0.8) {
      // A skull: the dome, two dark sockets, the jaw.
      for (const [dx, dy, l] of [[-1, -4, 0], [0, -4, 0.05], [1, -4, 0.05], [-2, -3, -0.05], [-1, -3, 0], [0, -3, 0.05], [1, -3, 0.08], [2, -3, 0.05], [-2, -2, -0.05], [0, -2, 0], [2, -2, 0.05], [-1, -1, -0.1], [0, -1, 0], [1, -1, 0], [-1, 0, -0.15], [1, 0, -0.1]] as const) {
        p.put(nx + dx, ny + dy, BONE, lit + l);
      }
      p.put(nx - 1, ny - 2, CRYPT, 0);
      p.put(nx + 1, ny - 2, CRYPT, 0);
    } else {
      // Crossed long bones.
      for (let k = -3; k <= 3; k++) {
        p.put(nx + k, ny - 1 - Math.round(k * 0.5) - 1, BONE, lit - 0.05);
        p.put(nx + k, ny - 1 + Math.round(k * 0.5) - 1, BONE, lit);
      }
    }
  };
  let ni = 0;
  for (const ny of [28, 48, 68]) {
    for (const nx of [10, 26, 42, 182, 198, 214]) niche(nx, ny, ni++);
  }

  // The doorway: a pointed arch of big voussoirs over stairs sinking into blue light.
  const half = 21;
  const spring = 48;
  const r = half * 1.6;
  const inArch = (x: number, y: number, grow: number) => {
    const ax = x + 0.5 - DX;
    if (Math.abs(ax) > half + grow) return false;
    if (y >= spring) return y < FLOOR;
    // Two arcs, each centred on the far side, meeting at a point.
    const cL = DX - half + r;
    const cR = DX + half - r;
    return Math.hypot(x + 0.5 - cL, y + 0.5 - spring) < r + grow && Math.hypot(x + 0.5 - cR, y + 0.5 - spring) < r + grow;
  };
  // Pilasters and the surround.
  for (let y = 4; y < FLOOR; y++) {
    for (let x = DX - half - 10; x <= DX + half + 10; x++) {
      if (!inArch(x, y, 7) || inArch(x, y, 0)) continue;
      const ax = x + 0.5 - DX;
      // Joints radiate from the arch's middle above the spring, run level below.
      const joint = y < spring ? Math.abs(Math.sin(Math.atan2(y - spring, ax) * 7)) < 0.12 : y % 9 === 0;
      const inner = inArch(x, y, 2);
      let l = 0.36 + fireLight(x, y) * 0.3 + (ax > 0 ? -0.04 : 0.02) + (noise2(x / 3, y / 3, 24) - 0.5) * 0.08;
      if (inner) l += 0.12;
      if (joint) l -= 0.2;
      p.put(x, y, CRYPT, l);
    }
  }
  // The keystone, with a carved skull.
  p.fill(DX - 3, 4, DX + 3, 12, CRYPT, (x, y) => 0.5 + (y === 4 ? 0.1 : 0) + (x === DX + 3 ? -0.1 : 0));
  for (const [dx, dy] of [[-1, 7], [1, 7], [0, 9]] as const) p.put(DX + dx, dy, CRYPT, 0.12);
  // Within: stairs going down, each step higher up the opening, narrower and darker.
  for (let y = 8; y < FLOOR; y++) {
    for (let x = DX - half; x <= DX + half; x++) {
      if (!inArch(x, y, 0)) continue;
      const depth = clamp01((FLOOR - y) / (FLOOR - 50));
      let l = 0.02;
      if (y > 50) {
        const k = (FLOOR - y) / 3.4;
        const nose = k - Math.floor(k) < 0.3;
        l = (nose ? 0.42 : 0.24) * (1 - depth) + 0.03;
        if (Math.abs(x + 0.5 - DX) > half - 3 - depth * 6) l *= 0.4;
      }
      p.put(x, y, CRYPT, l);
    }
  }
  // The cold light rising from below.
  p.halo(DX, 56, 30, hex('#3a8aff'), 0.55, 1.1);
  p.halo(DX, 54, 12, hex('#9ad8ff'), 0.6, 1.2);
  for (let y = 50; y < FLOOR; y++) {
    for (let x = DX - half; x <= DX + half; x++) {
      if (!inArch(x, y, 0)) continue;
      const k = (FLOOR - y) / 3.4;
      if (k - Math.floor(k) < 0.3) p.glow(x, y, hex('#5aa8ff'), 0.25 * clamp01((FLOOR - y) / 50));
    }
  }

  // Flagstones on the floor, running toward the door.
  for (let y = FLOOR; y < H; y++) {
    const near = (y - FLOOR) / (H - FLOOR);
    const rowH = 3 + near * 6;
    const row = Math.floor(Math.log(1 + (y - FLOOR) / 3) * 3.2);
    for (let x = 0; x < W; x++) {
      // Seams converge on the doorway.
      const u = (x - DX) / (1 + near * 3.2);
      const seam = Math.abs(u / 12 - Math.round(u / 12)) * 12 < 0.5 + near * 0.3;
      const rowEdge = Math.abs(Math.log(1 + (y - FLOOR) / 3) * 3.2 - row) < 0.12 + 0.2 / rowH;
      let l = 0.22 + near * 0.06 + fireLight(x, y) * 0.35 + hash(row, Math.round(u / 12), 25) * 0.07 + (noise2(x / 4, y / 2, 26) - 0.5) * 0.08;
      // The light spilling out of the doorway onto the floor.
      l += Math.exp(-(((x - DX) / (18 + near * 30)) ** 2)) * (1 - near) * 0.18;
      if (seam || rowEdge) l -= 0.14;
      p.put(x, y, CRYPT, l);
    }
  }
  for (let x = DX - half; x <= DX + half; x++) p.glow(x, FLOOR, hex('#5aa8ff'), 0.3);

  // Chains hanging either side of the arch.
  for (const cx of [DX - 34, DX + 34]) {
    const len = 18 + hash(cx, 0, 27) * 10;
    for (let y = 0; y < len; y++) p.put(cx + (y % 4 < 2 ? 0 : 1), y, IRON, y % 2 ? 0.5 : 0.3);
    p.put(cx, len, IRON, 0.6);
    p.put(cx + 1, len + 1, IRON, 0.45);
  }

  // The braziers: iron bowls on tripods, burning with soul fire.
  for (const [bx, by] of braziers) {
    for (let y = by + 3; y < FLOOR + 6; y++) {
      p.put(bx, y, IRON, 0.36);
      const spread = (y - by - 3) * 0.32;
      p.put(bx - spread, y, IRON, 0.28);
      p.put(bx + spread, y, IRON, 0.42);
    }
    for (let y = by - 1; y <= by + 3; y++) {
      const w = 6 - (y - by + 1) * 0.8;
      for (let x = Math.floor(bx - w); x <= bx + w; x++) p.put(x, y, IRON, 0.32 + (x - bx) * 0.04 + (y === by - 1 ? 0.25 : 0));
    }
    // The flame: a teardrop of cold fire.
    for (let y = by - 16; y < by; y++) {
      const t = (by - y) / 16;
      const fw = 4.6 * Math.sin(Math.PI * Math.pow(1 - t, 0.7)) * (1 - t * 0.3);
      for (let x = Math.floor(bx - fw); x <= bx + fw; x++) {
        const core = 1 - Math.abs(x + 0.5 - bx) / Math.max(1, fw);
        p.glow(x, y, core > 0.55 && t < 0.6 ? hex('#e8fbff') : core > 0.2 ? hex('#6ad0ff') : hex('#2a6aff'), 0.6 + core * 0.4);
      }
    }
    p.halo(bx, by - 6, 26, hex('#2a7aff'), 0.4);
  }

  // Mist pooling along the floor.
  for (let y = FLOOR - 6; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = fbm(x / 22, y / 5, 28);
      const k = clamp01((m - 0.45) * 2.4) * clamp01((y - FLOOR + 6) / 10);
      if (k > 0) p.glow(x, y, hex('#6a88c8'), k * 0.22);
    }
  }

  // Cobwebs in the top corners.
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 14 - i * 3; k++) {
      p.put(k, i * 4 + Math.round(k * 0.2), BONE, 0.25);
      p.put(W - 1 - k, i * 4 + Math.round(k * 0.2), BONE, 0.22);
    }
  }

  return finish(p, { braziers: braziers.map(([x, y]) => [x, y - 7]), door: [[DX, 58]] });
}

// ---------------------------------------------------------------- The Elementinho Temple

export function paintTemple(): LoadArt {
  const p = newPaint();
  const HORIZON = 78;
  const TX = 112;
  const sun: [number, number] = [176, 80];
  const afterglow = (x: number, y: number) => Math.exp(-Math.hypot((x - sun[0]) / 90, (y - sun[1]) / 40));

  // Dusk over the Emberwaste: plum above, burning orange at the horizon where the sun has gone.
  p.fill(0, 0, W - 1, HORIZON + 4, DUSK, (x, y) => 0.05 + 0.6 * Math.pow(y / HORIZON, 1.8) + afterglow(x, y) * 0.35 + (noise2(x / 40, y / 6, 30) - 0.5) * 0.06);
  stars(p, 40, 31, 40, hex('#ffe8d0'));
  p.halo(sun[0], sun[1], 70, hex('#ff7a30'), 0.35, 0.45);
  // Thin bands of cloud catching the last light.
  for (const [yc, s] of [[30, 1], [46, 2], [58, 3]] as const) {
    for (let x = 0; x < W; x++) {
      const th = (noise(x / 30 + s * 5, 32 + s) * 0.7 + noise(x / 9 + s, 35 + s) * 0.3 - 0.5) * 12;
      if (th <= 0) continue;
      for (let y = Math.floor(yc - th * 0.6); y <= yc + Math.min(2, th * 0.25); y++) {
        // Thin ends dither away into the sky.
        if (th < 3 && bayer(x, y) > th / 3) continue;
        p.put(x, y, DUSK, 0.26 + (y / HORIZON) * 0.4 + afterglow(x, y) * 0.45 + (y >= yc ? 0.14 : (y - yc) * 0.02));
      }
    }
  }

  // Mesas far off, flat-topped, purple in the haze.
  const mesa = (x: number) => {
    const m = noise(x / 34, 33);
    return HORIZON - (m > 0.55 ? 12 + (m - 0.55) * 12 : 3 + m * 4) - noise(x / 6, 34) * 1.2;
  };
  for (let x = 0; x < W; x++) for (let y = Math.floor(mesa(x)); y <= HORIZON + 6; y++) p.put(x, y, BASALT, 0.3 + afterglow(x, y) * 0.25 + (mesa(x + 1) > mesa(x) + 1 ? 0.12 : 0));

  // The dunes, sunward faces aglow.
  const dune = (x: number) => HORIZON + 2 + 4 * noise(x / 28, 35) + 3 * noise(x / 11, 36);
  for (let x = 0; x < W; x++) {
    const top = dune(x);
    const lit = clamp01((dune(x - 2) - dune(x + 2)) / 2);
    for (let y = Math.floor(top); y < H; y++) {
      let l = 0.28 + lit * 0.3 + afterglow(x, y) * 0.3 + (y - top) * 0.004;
      if (Math.sin(x * 0.4 + y * 1.6 + noise(x / 10, 37) * 6) > 0.85) l += 0.08;
      if (y - top < 1) l += 0.15;
      p.put(x, y, DUNE, l);
    }
  }

  // The ziggurat: five tiers, a stair up the front, a shrine and its fire on top.
  const BASE = 106;
  const tiers = [126, 102, 80, 60, 42];
  const TH = 10;
  tiers.forEach((tw, i) => {
    const y1 = BASE - i * TH;
    const y0 = y1 - TH + 1;
    const half = tw / 2;
    for (let y = y0; y <= y1; y++) {
      // Each tier battered: a touch narrower at its top.
      const h2 = half - (y1 - y) * 0.35;
      for (let x = Math.floor(TX - h2); x <= TX + h2; x++) {
        const side = (x - TX) / half;
        let l = 0.32 + side * 0.16 + afterglow(x, y) * 0.22 + (noise2(x / 3, y / 2, 38) - 0.5) * 0.08;
        if (y === y0) l += 0.3;
        else if (y === y0 + 1) l += 0.1;
        // Courses of brick.
        if ((y - y0) % 3 === 0 && y !== y0) l -= 0.08;
        if (((x + (Math.floor((y - y0) / 3) % 2) * 3) % 7 === 0) && y !== y0) l -= 0.06;
        if (Math.abs(x - TX - h2) < 1 || Math.abs(x - TX + h2) < 1) l -= 0.1;
        p.put(x, y, SANDSTONE, l);
      }
    }
    // A band of glyphs along each tier, glowing ember-red.
    for (let x = Math.floor(TX - half + 4); x <= TX + half - 4; x += 5) {
      if (Math.abs(x - TX) < 9) continue;
      p.put(x, y0 + 5, SANDSTONE, 0.12);
      p.glow(x, y0 + 5, hex('#ff5a20'), 0.55);
    }
  });
  // The stair: steps up the middle, shadowed on the left.
  const top = BASE - tiers.length * TH + 1;
  for (let y = top; y <= BASE; y++) {
    const t = (BASE - y) / (BASE - top);
    const sh = 8 - t * 3;
    for (let x = Math.floor(TX - sh); x <= TX + sh; x++) {
      const tread = (BASE - y) % 2 === 0;
      let l = (tread ? 0.62 : 0.4) + ((x - TX) / sh) * 0.1 + afterglow(x, y) * 0.15;
      if (Math.abs(x - TX) > sh - 1) l = 0.22;
      p.put(x, y, SANDSTONE, l);
    }
  }
  // The shrine on the crown.
  const SY = top - 1;
  p.fill(TX - 11, SY - 12, TX + 11, SY, SANDSTONE, (x, y) => 0.36 + ((x - TX) / 11) * 0.15 + (y === SY - 12 ? 0.3 : 0));
  p.fill(TX - 13, SY - 15, TX + 13, SY - 13, SANDSTONE, (_x, y) => (y === SY - 15 ? 0.72 : 0.48));
  p.fill(TX - 3, SY - 9, TX + 3, SY, SANDSTONE, () => 0.04);
  p.halo(TX, SY - 4, 10, hex('#ff8a30'), 0.8);
  p.halo(TX, SY - 4, 3, hex('#ffe0a0'), 0.9);
  // The great fire on the roof.
  const fire: [number, number] = [TX, SY - 16];
  for (let y = fire[1] - 20; y < fire[1]; y++) {
    const t = (fire[1] - y) / 20;
    const fw = 7 * Math.sin(Math.PI * Math.pow(1 - t, 0.6)) * (1 - t * 0.4) + (noise(y / 2, 39) - 0.5) * 2;
    for (let x = Math.floor(fire[0] - fw); x <= fire[0] + fw; x++) {
      const core = 1 - Math.abs(x + 0.5 - fire[0]) / Math.max(1, fw);
      p.glow(x, y, core > 0.5 && t < 0.55 ? hex('#fff2b0') : core > 0.2 ? hex('#ffa030') : hex('#e04010'), 0.55 + core * 0.45);
    }
  }
  p.halo(fire[0], fire[1] - 6, 44, hex('#ff6a20'), 0.4, 0.9);
  // The door at the stair's foot, open on fire within.
  for (let y = BASE - 9; y <= BASE; y++) {
    for (let x = TX - 5; x <= TX + 5; x++) {
      const arch = y < BASE - 5 ? Math.hypot(x + 0.5 - TX, (y + 0.5 - (BASE - 5)) * 1.2) < 5.2 : true;
      if (arch) p.put(x, y, SANDSTONE, 0.03);
    }
  }
  p.halo(TX, BASE - 4, 12, hex('#ff6a10'), 0.75);
  p.halo(TX, BASE - 3, 4, hex('#ffd080'), 0.8);

  // Four obelisks, an element's gem burning on each: water and earth west, air and fire east.
  const gems: [number, number][] = [];
  const obelisk = (ox: number, base: number, h: number, gem: string) => {
    for (let y = base - h; y <= base; y++) {
      const t = (y - (base - h)) / h;
      const half = 1.5 + t * 2;
      for (let x = Math.floor(ox - half); x <= ox + half; x++) {
        const side = (x - ox) / half;
        p.put(x, y, BASALT, 0.3 + side * 0.22 + afterglow(x, y) * 0.2 + (Math.abs(side) > 0.8 ? -0.08 : 0));
      }
    }
    p.fill(ox - 4, base - 1, ox + 4, base + 1, BASALT, (x) => 0.36 + (x - ox) * 0.03);
    const gy = base - h - 3;
    ellipse(p, ox, gy, 2.2, 3, GEM, (x, y) => 0.6 + (x - ox) * 0.1 - (y - gy) * 0.08);
    p.halo(ox, gy, 14, hex(gem), 0.55);
    p.halo(ox, gy, 4, hex(gem), 0.8);
    gems.push([ox, gy]);
  };
  obelisk(22, 112, 30, '#3a9aff');
  obelisk(52, 104, 22, '#7ad040');
  obelisk(172, 104, 22, '#d8f4ff');
  obelisk(202, 112, 30, '#ff7a20');

  // The ground at the front: dark basalt split by veins of lava.
  const ground = (x: number) => 112 + 3 * noise(x / 20, 40);
  for (let x = 0; x < W; x++) {
    for (let y = Math.floor(ground(x)); y < H; y++) {
      p.put(x, y, BASALT, 0.16 + (fbm(x / 12, y / 5, 41) - 0.5) * 0.2 + (y - ground(x) < 1 ? 0.12 : 0) + afterglow(x, y) * 0.08);
    }
  }
  const vein = (x0: number, y0: number, seed: number, len: number) => {
    let x = x0;
    let y = y0;
    for (let i = 0; i < len; i++) {
      p.put(x, y, BASALT, 0.05);
      p.glow(x, y, hex('#ff8a20'), 0.85);
      p.glow(x, y - 1, hex('#ff4a10'), 0.25);
      p.glow(x, y + 1, hex('#ff4a10'), 0.25);
      x += hash(i, 0, seed) < 0.5 ? 1 : -1 + (hash(i, 1, seed) < 0.7 ? 2 : 0);
      y += hash(i, 2, seed) < 0.35 ? 1 : 0;
      if (y >= H) break;
    }
  };
  vein(70, 116, 42, 40);
  vein(150, 115, 43, 36);
  vein(110, 120, 44, 24);
  vein(34, 122, 45, 20);
  vein(190, 120, 46, 22);

  return finish(p, { fire: [fire], gems, door: [[TX, BASE - 4]] });
}

// ---------------------------------------------------------------- The Cosmos

export function paintCosmos(): LoadArt {
  const p = newPaint();
  // The void, clouds of nebula through it.
  p.fill(0, 0, W - 1, H - 1, SPACE, (x, y) => {
    const n = fbm(x / 46, y / 34, 50);
    return 0.06 + clamp01((n - 0.42) * 2) * 0.4 + (noise2(x / 8, y / 8, 51) - 0.5) * 0.04;
  });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm(x / 46, y / 34, 50);
      const k = clamp01((n - 0.48) * 2.4);
      if (k <= 0) continue;
      const tint = fbm(x / 60, y / 60, 52) > 0.5 ? hex('#7040d0') : hex('#2a70c8');
      p.glow(x, y, tint, k * 0.35);
    }
  }
  stars(p, 120, 53, H, hex('#e8eaff'));
  stars(p, 30, 54, H, hex('#ffd8a0'));

  // A ringed planet, lit from the east.
  const PL: [number, number] = [42, 30];
  const R = 20;
  const ring = (x: number, y: number) => {
    // A tilted ellipse round the planet.
    const a = -0.32;
    const rx = (x + 0.5 - PL[0]) * Math.cos(a) - (y + 0.5 - PL[1]) * Math.sin(a);
    const ry = (x + 0.5 - PL[0]) * Math.sin(a) + (y + 0.5 - PL[1]) * Math.cos(a);
    const d = Math.hypot(rx / 36, ry / 7);
    return { d, ry };
  };
  const ringAt = (x: number, y: number, front: boolean) => {
    const { d, ry } = ring(x, y);
    if (d < 0.72 || d > 1) return;
    if (front !== ry > 0) return;
    const band = d < 0.8 ? 0.55 : d < 0.86 ? 0.3 : d < 0.95 ? 0.65 : 0.45;
    p.put(x, y, PLANET, band + (x - PL[0]) * 0.006);
  };
  for (let y = PL[1] - 14; y <= PL[1] + 14; y++) for (let x = PL[0] - 40; x <= PL[0] + 40; x++) ringAt(x, y, false);
  ellipse(p, PL[0], PL[1], R, R, PLANET, (x, y) => {
    const lx = (x + 0.5 - PL[0]) / R;
    const ly = (y + 0.5 - PL[1]) / R;
    const lit = clamp01(lx * 0.8 - ly * 0.3 + 0.45);
    const bands = Math.sin(ly * 9 + noise(x / 6, 55) * 1.6) * 0.06;
    return 0.08 + lit * 0.62 + bands;
  });
  // Its shadow on the ring behind it, the ring in front over it.
  for (let y = PL[1] - 14; y <= PL[1] + 14; y++) for (let x = PL[0] - 40; x <= PL[0] + 40; x++) ringAt(x, y, true);
  p.halo(PL[0] + 6, PL[1] - 4, 32, hex('#c070c0'), 0.18);

  // The platform: a floating disc of runed stone, its rock tapering beneath.
  const C: [number, number] = [118, 88];
  const RX = 64;
  const RY = 16;
  for (let x = C[0] - RX; x <= C[0] + RX; x++) {
    const u = (x - C[0]) / RX;
    const rim = C[1] + RY * Math.sqrt(Math.max(0, 1 - u * u));
    const depth = (1 - u * u) * 36 + 6 + noise(x / 5, 56) * 6;
    for (let y = Math.floor(rim); y < rim + depth; y++) {
      const t = (y - rim) / depth;
      let l = 0.28 - t * 0.22 + u * 0.14 + (noise2(x / 4, y / 2, 57) - 0.5) * 0.12;
      if (Math.sin(y * 0.9 + noise(x / 9, 58) * 3) > 0.85) l -= 0.06;
      if (y - rim < 2) l += 0.16;
      p.put(x, y, ASTRAL, l);
    }
  }
  ellipse(p, C[0], C[1], RX, RY, ASTRAL, (x, y, d) => {
    let l = 0.42 + ((x - C[0]) / RX) * 0.12 + (noise2(x / 3, y / 2, 59) - 0.5) * 0.08;
    // Flagstones in rings.
    const ang = Math.atan2((y + 0.5 - C[1]) * (RX / RY), x + 0.5 - C[0]);
    if (Math.abs(d - 0.5) < 0.03 || Math.abs(d - 0.82) < 0.025) l -= 0.14;
    if (d > 0.5 && Math.abs(Math.sin(ang * 8)) < 0.08) l -= 0.12;
    if (d > 0.95) l += 0.14;
    return l;
  });
  // The rune ring glowing on the stone.
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const x = C[0] + Math.cos(a) * RX * 0.66;
    const y = C[1] + Math.sin(a) * RY * 0.66;
    if (i % 4 === 3) continue;
    p.glow(x, y, hex('#6ad8ff'), 0.75);
  }
  p.halo(C[0], C[1], 30, hex('#3a8aff'), 0.22, 0.3);
  // Three obelisks round it, a star burning at each tip.
  const tips: [number, number][] = [];
  for (const [ox, oy, h] of [[118, 74, 26], [72, 90, 22], [164, 90, 22]] as const) {
    for (let y = oy - h; y <= oy; y++) {
      const t = (y - (oy - h)) / h;
      const half = 1 + t * 2.4;
      for (let x = Math.floor(ox - half); x <= ox + half; x++) p.put(x, y, ASTRAL, 0.3 + ((x - ox) / half) * 0.22 + (t < 0.1 ? 0.2 : 0));
    }
    for (let y = oy - h + 4; y < oy - 2; y += 4) p.glow(ox, y, hex('#8ac8ff'), 0.6);
    p.halo(ox, oy - h - 3, 9, hex('#a0d8ff'), 0.7);
    p.halo(ox, oy - h - 3, 3, hex('#ffffff'), 0.9);
    tips.push([ox, oy - h - 3]);
  }
  // Loose rocks drifting about.
  for (const [rx, ry, s] of [[22, 96, 6], [200, 58, 5], [188, 112, 4], [46, 118, 3], [212, 20, 3]] as const) {
    ellipse(p, rx, ry, s, s * 0.6, ASTRAL, (x, y) => 0.36 + ((x - rx) / s) * 0.2 - ((y - ry) / s) * 0.2);
    for (let y = ry; y < ry + s; y++) {
      const half = s * (1 - (y - ry) / s);
      for (let x = Math.floor(rx - half); x <= rx + half; x++) p.put(x, y + 1, ASTRAL, 0.16 + ((x - rx) / s) * 0.1);
    }
  }

  return finish(p, { tips, ring: [C] });
}

// ---------------------------------------------------------------- The Endless Rift

export function paintRift(): LoadArt {
  const p = newPaint();
  const C: [number, number] = [112, 58];
  const TOP = 8;
  const BOT = 108;
  // The tear's half-width at a row.
  const tearHalf = (y: number) => {
    const t = (y - TOP) / (BOT - TOP);
    if (t <= 0 || t >= 1) return 0;
    return 13 * Math.pow(Math.sin(Math.PI * t), 0.9) + (noise(y / 2.2, 60) - 0.5) * 4 * Math.sin(Math.PI * t);
  };
  const tearX = (y: number) => C[0] + Math.sin(y / 14) * 3;

  // The void, swirling about the tear.
  p.fill(0, 0, W - 1, H - 1, VOID, (x, y) => {
    const dx = x - C[0];
    const dy = (y - C[1]) * 1.3;
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const swirl = noise2(a * 2 + r / 18, r / 22, 61);
    return 0.06 + swirl * 0.22 + Math.exp(-r / 50) * 0.35;
  });
  stars(p, 50, 62, H, hex('#e0c8ff'));
  p.halo(C[0], C[1], 90, hex('#a020c0'), 0.3, 0.9);
  p.halo(C[0], C[1], 40, hex('#ff40d0'), 0.35, 1.4);

  // Rock torn loose, drifting round the tear, rims lit magenta on the side facing it.
  const shardRock = (cx: number, cy: number, r: number, seed: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + hash(i, 0, seed) * 0.5;
      const rr = r * (0.6 + hash(i, 1, seed) * 0.5) * (Math.sin(a) > 0 ? 1.3 : 0.8);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8]);
    }
    const toward = Math.sign(C[0] - cx);
    poly(p, pts, RIFTROCK, (x, y) => {
      let l = 0.42 + (noise2(x / 3, y / 3, seed) - 0.5) * 0.14 - ((y - cy) / r) * 0.1 + ((x - cx) * toward / r) * 0.08;
      if (!inPoly(pts, x + 0.5 + toward * 2, y + 0.5)) {
        l = 0.8;
        p.glow(x, y, hex('#ff5ae0'), 0.5);
      }
      return l;
    });
  };
  for (const [cx, cy, r, s] of [[40, 30, 9, 63], [182, 22, 7, 64], [24, 84, 6, 65], [196, 76, 10, 66], [70, 66, 4, 67], [156, 44, 4, 68], [214, 46, 3, 69]] as const) shardRock(cx, cy, r, s);

  // Cracks of light spreading from the tear across the void.
  for (let i = 0; i < 10; i++) {
    const y0 = TOP + 12 + hash(i, 0, 70) * (BOT - TOP - 24);
    const dir = i % 2 ? 1 : -1;
    let x = tearX(y0) + dir * tearHalf(y0);
    let y = y0;
    const len = 10 + hash(i, 1, 70) * 26;
    for (let k = 0; k < len; k++) {
      p.glow(x, y, hex('#ff70e8'), 0.6 * (1 - k / len));
      x += dir;
      y += hash(i, k, 71) < 0.3 ? -1 : hash(i, k, 72) < 0.4 ? 1 : 0;
    }
  }

  // The tear itself: a ragged lens of light, white at the heart.
  for (let y = TOP; y <= BOT; y++) {
    const half = tearHalf(y);
    const cx = tearX(y);
    for (let x = Math.floor(cx - half - 2); x <= cx + half + 2; x++) {
      const d = Math.abs(x + 0.5 - cx) / Math.max(0.5, half);
      if (d < 1) {
        p.put(x, y, TEAR, 1 - d * 0.75 + (noise2(x / 2, y / 5, 73) - 0.5) * 0.2);
        p.glow(x, y, hex('#ff9af0'), 0.35 * (1 - d));
      } else if (d < 1 + 2 / Math.max(1, half)) p.glow(x, y, hex('#ff40c8'), 0.5);
    }
  }

  // The broken platform the heroes stand on, in front: slate flags, a runed edge.
  const edge = (x: number) => 108 + 4 * noise(x / 16, 74) + (Math.abs(x - 112) > 80 ? (Math.abs(x - 112) - 80) * 0.6 : 0);
  for (let x = 0; x < W; x++) {
    const e = edge(x);
    for (let y = Math.floor(e); y < H; y++) {
      const near = (y - e) / 24;
      let l = 0.32 + (noise2(x / 5, y / 3, 75) - 0.5) * 0.12 + Math.exp(-(((x - C[0]) / 50) ** 2)) * (1 - near) * 0.3;
      if (y - e < 1.5) l += 0.3;
      if ((y + Math.floor(x / 11)) % 6 === 0 || x % 11 === 0) l -= 0.1;
      p.put(x, y, RIFTROCK, l);
    }
    if (x % 9 === 4) p.glow(x, Math.floor(e) + 2, hex('#c050ff'), 0.6);
  }

  return finish(p, { tear: [C], rocks: [[40, 30], [182, 22], [196, 76]] });
}

// ---------------------------------------------------------------- The Aurora Colosseum

export function paintFrost(): LoadArt {
  const p = newPaint();
  const HORIZON = 76;
  // Ribbons of aurora: a wavering line each, curtains hanging from it.
  const ribbons: [number, number, number, string, string][] = [
    [16, 9, 80, '#40f0a0', '#a070ff'],
    [30, 6, 81, '#30d8c8', '#60a0ff'],
  ];
  const auroraAt = (x: number, y: number) => {
    let k = 0;
    for (const [base, amp, seed] of ribbons) {
      const line = base + amp * Math.sin(x / 26 + seed) + 4 * noise(x / 9, seed);
      const below = y - line;
      if (below < -2 || below > 34) continue;
      const curtain = 0.6 + 0.4 * noise(x / 2.5, seed + 1);
      k += (below < 0 ? 1 + below / 2 : Math.exp(-below / 12)) * curtain;
    }
    return k;
  };

  p.fill(0, 0, W - 1, HORIZON + 4, AURORA_SKY, (x, y) => 0.05 + 0.45 * Math.pow(y / HORIZON, 1.6) + auroraAt(x, y) * 0.22);
  stars(p, 90, 82, HORIZON, hex('#e0f0ff'));
  for (let y = 0; y < HORIZON + 10; y++) {
    for (let x = 0; x < W; x++) {
      for (const [base, amp, seed, low, high] of ribbons) {
        const line = base + amp * Math.sin(x / 26 + seed) + 4 * noise(x / 9, seed);
        const below = y - line;
        if (below < -2 || below > 34) continue;
        const curtain = 0.55 + 0.45 * noise(x / 2.5, seed + 1);
        const k = (below < 0 ? 1 + below / 2 : Math.exp(-below / 11)) * curtain;
        p.glow(x, y, below < 3 ? hex(high) : hex(low), k * 0.42);
      }
    }
  }

  // Snowy peaks far behind, their faces lit by the sky.
  const peaks = (x: number) => HORIZON - 4 - 22 * noise(x / 30, 83) - 7 * noise(x / 9, 84);
  for (let x = 0; x < W; x++) {
    const r = peaks(x);
    const lit = clamp01((peaks(x + 2) - peaks(x - 2)) / 4);
    for (let y = Math.floor(r); y <= HORIZON + 6; y++) {
      const snowy = y - r < 6 + noise(x / 4, 85) * 4;
      p.put(x, y, snowy ? SNOW : PEAK, snowy ? 0.22 + lit * 0.35 : 0.3 + lit * 0.15 - (y - r) * 0.004);
    }
  }

  // The colosseum's north wall: a curve of arcades in two storeys, snow on its ledges.
  const wallBase = (x: number) => 100 - 16 * Math.sqrt(Math.max(0, 1 - ((x - 112) / 128) ** 2));
  const WALL_H = 30;
  const braziers: [number, number][] = [];
  for (let x = 0; x < W; x++) {
    const b = wallBase(x);
    const t = b - WALL_H;
    for (let y = Math.floor(t); y <= b; y++) {
      const v = y - t;
      // Two storeys of arches, 12 px apart, the upper smaller.
      const storey = v < 13 ? 0 : 1;
      const top0 = storey ? 15 : 3;
      const ah = storey ? 13 : 9;
      const pitch = storey ? 14 : 12;
      const ax = ((x + (storey ? 3 : 9)) % pitch) - pitch / 2 + 0.5;
      const aw = storey ? 4.5 : 3.6;
      const archTop = top0 + aw;
      const inArch = v >= top0 && v <= top0 + ah && Math.abs(ax) < aw && (v >= archTop || Math.hypot(ax, v - archTop) < aw);
      let l = 0.34 + (noise2(x / 3, y / 3, 86) - 0.5) * 0.08 + auroraAt(x, 10) * 0.05;
      if (v === 0 || v === 13) l += 0.18;
      if (v === 12 || v === 1) l -= 0.1;
      if (inArch) l = 0.06 + (Math.abs(ax) > aw - 1 ? 0.06 : 0);
      p.put(x, y, FROSTSTONE, l);
      // Snow on the ledges and the top.
      if ((v === 0 || v === 13) && noise(x / 3, 87 + v) > 0.25) p.put(x, y - 1, SNOW, 0.6 + noise(x / 2, 88) * 0.2);
    }
  }
  // Two arches burning with braziers.
  for (const bx of [57, 165]) {
    const by = Math.round(wallBase(bx) - 8);
    braziers.push([bx, by]);
    p.halo(bx, by, 14, hex('#ff9a40'), 0.5);
    p.halo(bx, by, 4, hex('#ffe0a0'), 0.8);
  }

  // The frozen lake: dark ice, the aurora mirrored in it, cracks catching the light.
  for (let x = 0; x < W; x++) {
    for (let y = Math.floor(wallBase(x)) + 1; y < H; y++) {
      const mirror = 99 - (y - 99) * 1.4;
      let l = 0.3 + (y - 99) * 0.004 + auroraAt(x, mirror) * 0.22 + (noise2(x / 14, y / 2, 89) - 0.5) * 0.1;
      const crack = Math.abs(noise2(x / 9, y / 5, 90) - 0.5) < 0.012;
      if (crack) l += 0.3;
      // The wall's foot in shadow.
      if (y - wallBase(x) < 3) l -= 0.12;
      p.put(x, y, ICE, l);
    }
  }
  for (let y = 99; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const mirror = 99 - (y - 99) * 1.4;
      const k = auroraAt(x, mirror);
      if (k > 0.05 && bayer(x, y) < 0.7) p.glow(x, y, hex('#30e0b0'), k * 0.16);
    }
  }
  // Snow drifts at the lake's edge.
  for (let x = 0; x < W; x++) {
    const b = Math.floor(wallBase(x)) + 1;
    const d = 2 + 3 * noise(x / 11, 91);
    for (let y = b; y < b + d; y++) p.put(x, y, SNOW, 0.56 - (y - b) * 0.06 + (noise(x / 3, 92) - 0.5) * 0.1);
  }
  for (let x = 0; x < W; x++) {
    const d = 4 + 6 * noise(x / 15, 93);
    for (let y = H - Math.floor(d); y < H; y++) p.put(x, y, SNOW, 0.5 + (H - y) * 0.03);
  }

  // Spires of ice grown up out of the lake at the front corners, the aurora in them.
  const ice: [number, number][] = [];
  const spire = (cx: number, cy: number, blades: [number, number, number][], lit: number) => {
    for (const [ang, len, half] of blades) {
      const a = (ang * Math.PI) / 180;
      crystal(p, cx, cy, cx + Math.sin(a) * len, cy - Math.cos(a) * len, half, ICE, lit, 0.4);
      ice.push([cx + Math.sin(a) * len, cy - Math.cos(a) * len]);
    }
    p.halo(cx, cy - 10, 22, hex('#40e0c0'), 0.22);
  };
  spire(46, 122, [[-28, 18, 3.5], [-6, 30, 5], [18, 20, 4], [40, 11, 2.5]], 1);
  spire(180, 124, [[-36, 12, 2.5], [-14, 24, 4.5], [8, 32, 5], [30, 16, 3]], -1);

  return finish(p, { braziers, ice, aurora: [[60, 20], [160, 30]] });
}

// ---------------------------------------------------------------- The Floating Island and Sky Glide

export function paintSky(glider: boolean): LoadArt {
  const p = newPaint();
  const HORIZON = 88;
  const sun: [number, number] = [182, 22];
  const sunny = (x: number, y: number) => Math.exp(-Math.hypot(x - sun[0], y - sun[1]) / 40);

  p.fill(0, 0, W - 1, HORIZON + 6, SKY, (x, y) => 0.15 + 0.7 * Math.pow(y / HORIZON, 1.3) + sunny(x, y) * 0.3);
  p.halo(sun[0], sun[1], 34, hex('#fff2c0'), 0.45);
  p.halo(sun[0], sun[1], 8, hex('#ffffff'), 0.9);

  // High wisps of cloud.
  for (const [yc, s] of [[16, 1], [34, 2]] as const) {
    for (let x = 0; x < W; x++) {
      const th = (noise(x / 30 + s * 9, 100 + s) - 0.5) * 6;
      if (th <= 0) continue;
      for (let y = Math.floor(yc - th * 0.4); y <= yc + th * 0.2; y++) if (bayer(x, y) < th / 2) p.put(x, y, CLOUD, 0.5 + sunny(x, y) * 0.3);
    }
  }

  // Far islets.
  const islet = (cx: number, cy: number, r: number, seed: number) => {
    ellipse(p, cx, cy, r, r * 0.28, GRASS, (x) => 0.45 + ((x - cx) / r) * 0.15);
    for (let y = cy; y < cy + r * 1.1; y++) {
      const t = (y - cy) / (r * 1.1);
      const half = r * (1 - t) ** 1.4 + (noise(y / 2, seed) - 0.5) * 2;
      for (let x = Math.floor(cx - half); x <= cx + half; x++) p.put(x, y, ISLE_ROCK, 0.45 + ((x - cx) / r) * 0.2 - t * 0.2);
    }
  };
  islet(30, 52, 9, 101);
  islet(204, 60, 7, 102);
  islet(170, 40, 4, 103);

  // The sea of clouds, piled in rolls, their tops in the sun.
  for (const [base, s, k] of [[80, 104, 0.5], [92, 105, 0.7], [108, 106, 0.9]] as const) {
    for (let x = 0; x < W; x++) {
      const top = base - (noise(x / 18, s) * 10 + noise(x / 6, s + 1) * 4) * k;
      for (let y = Math.floor(top); y < H; y++) {
        const f = (y - top) / 14;
        p.put(x, y, CLOUD, 0.86 - f * 0.4 + sunny(x, y) * 0.1 - (1 - k) * 0.2 + (noise2(x / 5, y / 3, s + 2) - 0.5) * 0.1);
      }
    }
  }

  // The Floating Island: grass on top, the rock tapering beneath it, roots trailing, a waterfall.
  const I: [number, number] = [108, 62];
  const RX = 46;
  const RY = 9;
  for (let x = I[0] - RX; x <= I[0] + RX; x++) {
    const u = (x - I[0]) / RX;
    const rim = I[1] + RY * Math.sqrt(Math.max(0, 1 - u * u));
    const depth = (1 - u * u) ** 0.8 * 40 + noise(x / 4, 107) * 6;
    for (let y = Math.floor(rim - 1); y < rim + depth; y++) {
      const t = (y - rim) / depth;
      let l = 0.42 - t * 0.3 + u * 0.18 + (noise2(x / 4, y / 2, 108) - 0.5) * 0.12;
      if (Math.sin(y * 0.7 + noise(x / 8, 109) * 3) > 0.88) l -= 0.08;
      p.put(x, y, y < rim + 2 ? GRASS : ISLE_ROCK, y < rim + 2 ? 0.3 : l);
    }
  }
  ellipse(p, I[0], I[1], RX, RY, GRASS, (x, y, d) => 0.5 + ((x - I[0]) / RX) * 0.15 + (noise2(x / 3, y / 2, 110) - 0.5) * 0.12 + (d > 0.9 ? -0.1 : 0));
  for (const rx of [76, 88, 98, 124, 136]) {
    const len = 6 + hash(rx, 0, 111) * 10;
    const top = I[1] + 30 + hash(rx, 1, 111) * 8;
    for (let y = 0; y < len; y++) p.put(rx + Math.round(Math.sin(y * 0.5 + rx) * 0.8), top + y, LEAF, 0.2);
  }
  // The waterfall spilling off the east edge and fraying into mist.
  for (let y = I[1] + 2; y < 106; y++) {
    const fade = (y - I[1]) / 44;
    for (let dx = 0; dx < 3; dx++) {
      if (bayer(150 + dx, y) < fade * 0.8) continue;
      p.put(150 + dx, y, CLOUD, 0.95 - dx * 0.08 - fade * 0.2);
    }
  }
  p.halo(151, 104, 10, hex('#ffffff'), 0.3, 0.6);

  // A ring of white columns, one fallen, and a cherry tree in bloom.
  const cols: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    cols.push([I[0] + Math.cos(a) * 26, I[1] + Math.sin(a) * 5.5]);
  }
  cols.sort((a, b) => a[1] - b[1]);
  for (const [cx0, cy0] of cols) {
    const cx = Math.round(cx0);
    const cy = Math.round(cy0);
    const fallen = cx > 122 && cy > I[1];
    const h = fallen ? 5 : 16;
    for (let y = cy - h; y <= cy; y++) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        // Round shaft lit from the sun's side, a dark flute down the middle.
        const l = [0.4, 0.55, 0.62, 0.78, 0.7][x - cx + 2] + (x === cx ? -0.08 : 0);
        p.put(x, y, MARBLE, l);
      }
    }
    if (fallen) {
      // Its broken drum lying in the grass.
      p.fill(cx + 4, cy - 2, cx + 11, cy, MARBLE, (_x, y) => (y === cy - 2 ? 0.8 : 0.5));
    } else p.fill(cx - 3, cy - h - 2, cx + 3, cy - h - 1, MARBLE, (_x, y) => (y === cy - h - 2 ? 0.9 : 0.6));
    p.fill(cx - 3, cy, cx + 3, cy + 1, MARBLE, () => 0.5);
  }
  const tree: [number, number] = [84, 60];
  for (let y = tree[1] - 12; y <= tree[1]; y++) {
    const bend = y < tree[1] - 7 ? Math.round((tree[1] - 7 - y) * 0.3) : 0;
    p.put(tree[0] + bend, y, ISLE_ROCK, 0.3);
    p.put(tree[0] + bend + 1, y, ISLE_ROCK, 0.45);
  }
  const blossom: [number, number, number][] = [[tree[0] - 5, tree[1] - 15, 5], [tree[0] + 3, tree[1] - 19, 6], [tree[0] + 8, tree[1] - 13, 4.5], [tree[0] - 1, tree[1] - 11, 4]];
  for (const [bx, by, br] of blossom) {
    for (let y = Math.floor(by - br); y <= by + br; y++) {
      for (let x = Math.floor(bx - br); x <= bx + br; x++) {
        const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by) / (br - hash(x, y, 112) * 1.2);
        if (d >= 1) continue;
        // Lit on the side toward the sun, shadowed beneath; clusters of brighter petals.
        let l = 0.5 + (x - bx) / br * 0.18 - (y - by) / br * 0.22;
        if (noise2(x / 2, y / 2, 113) > 0.62) l += 0.16;
        if (d > 0.85) l -= 0.1;
        p.put(x, y, CANOPY, l);
      }
    }
  }
  const spots: LoadArt['spots'] = { tree: [[tree[0] + 2, tree[1] - 15]], fall: [[151, 104]] };
  if (glider) {
    // A glider riding down off the island, its wing in a warm red.
    const G: [number, number] = [52, 80];
    for (let x = -10; x <= 10; x++) {
      const y = G[1] - 8 + (x / 10) ** 2 * 4;
      for (let k = 0; k < 3; k++) p.put(G[0] + x, y + k, CANOPY, k === 0 ? 0.85 : 0.55 - Math.abs(x) * 0.02);
    }
    for (const sx of [-9, -3, 3, 9]) for (let k = 0; k < 6; k++) p.put(G[0] + Math.round((sx * (6 - k)) / 6), G[1] - 4 + k, MARBLE, 0.3);
    p.fill(G[0] - 1, G[1] + 2, G[0] + 1, G[1] + 5, ISLE_ROCK, () => 0.3);
    spots.glider = [G];
  }

  return finish(p, spots);
}
